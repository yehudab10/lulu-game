// Shared Road — networking + party logic (port of src/10f-multiplayer.js).
//
// Same relay, same protocol v1 as the 2D game (MULTIPLAYER.md), so 2D and 3D
// riders share one road. A presence layer: tiny state heartbeats (≤5 Hz) and
// emoji events; ghosts never collide (except the comedy BONK in friend rooms).
//
// ── 2D ↔ 3D mapping (documented scale) ──────────────────────────────────
//   distance  di (2D px of road, scrollOffset)  = s (3D metres) × DI_PER_M
//             DI_PER_M = 56000 / 4800 ≈ 11.67  (Bubbe's house: 56,000 px in 2D = 4,800 m in 3D)
//   lateral   x (2D canvas px, road 100…380, centre 240) = 240 + d × 20
//             i.e. the 3D asphalt (|d| ≤ 7 m, 4 lanes) spans the 2D road (280 px, 3 lanes);
//             shoulders / sidewalks fall on the 2D grass edges.
//   speed     sp (px/s) = m/s × DI_PER_M
//   parking   pk {x, y, r} in 2D LOT pixels (see parking/lot.js: 17 px per metre, curb at y 150)
//   ring      positions wrap on a 60,000 px "highway ring" (≈ 5.1 km) — relative distance only.
//
// Everything is a silent no-op unless the player joins (or cruise auto-joins
// the EVERYONE lobby), and in ?test runs nothing connects unless the test opts
// in with &enable=multiplayer (and points &mpurl= at a local relay).
import { ctx, emit } from "../../core/ctx.js";
import { save3d, shared } from "../../core/save.js";
import { tone } from "../parking/sfx.js";

const QS = new URLSearchParams(location.search);
export const MP_URL_LIVE = "wss://lulu-shared-road.lulu-boats-1f4cdd.workers.dev";
export const MP_URL = (ctx.TEST && QS.get("mpurl")) || MP_URL_LIVE;
export const CURATED_NAMES = [
    "Cholent Boy", "Rugelach Queen", "Bubby's Favorite", "Kugel Kid",
    "Shabbos Racer", "Babka Baron", "Gefilte Ghost", "Mitzvah Machine",
    "Sheitel Slayer", "Dreidel Daredevil", "Latke Legend", "Schmaltz Speedster",
];
export const EMOTES = ["😂", "❤️", "😱", "🏁", "🐢", "🔥"];
export const RING = 60000;
export const DI_PER_M = 56000 / 4800;
export const X_PER_M = 20, X_MID = 240;
export const VIS_PX = 900;               // 2D's ghost range (px)
export const VIS_M = 320;                // 3D shows ghosts much further up the road
export const RACE_GOAL = 200000;         // px of road (≈ 17 km in 3D)
export const TAG_DUR = 90;

export const MP = {
    sock: null, want: false, connected: false, ever: false, room: "lobby", roomKind: "everyone",
    myId: null, peers: {}, clock: 0, sendT: 0, pingT: 0, reconnectAt: 0, reconnectDelay: 1, wantSince: 0,
    switchTo: null, forceSends: 0,
    codeSlots: [0, 0, 0, 0].map(() => Math.floor(Math.random() * 26)),
    race: null, raceSeq: Math.floor(Math.random() * 1e6) + 1,
    convoy: { t: 0, grace: 0, active: false },
    draft: { t: 0, grace: 0, active: false },
    tag: null, tagBanner: null, tagDur: TAG_DUR,
    emoteNonce: Math.floor(Math.random() * 1e6) + 1, myEmote: null, myBurst: null,
    recordNonce: 0, myRecord: null, recordAt: -1e9, toasts: [],
    scorePosted: false, wantedCache: { t: -1e9, data: [], loading: false }, scoresCache: { t: -1e9, data: [], ok: false, loading: false },
    chipPulse: 0, lastRiders: -1,
    me: { s: 0, d: 0, di: 0, x: X_MID, foot: false, driving: false },
};

/** Allowed to touch the network at all? (test runs must opt in) */
export function allowed() { return !!MP_URL && typeof WebSocket !== "undefined" && (!ctx.TEST || ctx.enabled("multiplayer")); }
export function myName() { return shared.get().mpName || CURATED_NAMES[0]; }
export function setName(n) { if (CURATED_NAMES.includes(n)) shared.update(s => { s.mpName = n; }); }
export function peerCount() { return Object.keys(MP.peers).length; }
export function riderCount() { return peerCount() + (MP.connected ? 1 : 0); }
export function wrap(v) { v %= RING; if (v < -RING / 2) v += RING; else if (v >= RING / 2) v -= RING; return v; }
export function roomLabel(room) { return room === "lobby" ? "EVERYONE" : String(room).toUpperCase(); }
export function targetRoom() {
    if (MP.roomKind !== "friend") return "lobby";
    return MP.codeSlots.map(c => String.fromCharCode(65 + c)).join("");
}
export function friendRoom() { return MP.connected && MP.room !== "lobby"; }
export function rerollCode() { MP.codeSlots = MP.codeSlots.map(() => Math.floor(Math.random() * 26)); }

// ── connection ───────────────────────────────────────────────────────────
function sockOpen() { return !!MP.sock && MP.sock.readyState === 1; }
export function send(obj) { try { if (sockOpen()) MP.sock.send(JSON.stringify(obj)); } catch (e) { /* offline is fine */ } }

export function connect(room, kind) {
    if (!allowed()) return;
    if (room) { MP.room = room; MP.roomKind = kind || (room === "lobby" ? "everyone" : "friend"); }
    if (!shared.get().mpName) shared.update(s => { s.mpName = CURATED_NAMES[Math.floor(Math.random() * CURATED_NAMES.length)]; });
    MP.want = true; MP.wantSince = MP.clock; MP.ever = true;
    MP.connected = false; MP.peers = {}; MP.reconnectDelay = 1; MP.reconnectAt = MP.clock;
    openSocket();
    emit("mp:status", { want: true });
}

export function disconnect(optOut = true) {
    MP.want = false; MP.connected = false; MP.myId = null; MP.peers = {};
    MP.race = null; MP.forceSends = 0; MP.tag = null; MP.tagBanner = null; MP.switchTo = null;
    MP.convoy.active = false; MP.convoy.t = MP.convoy.grace = 0;
    MP.draft.active = false; MP.draft.t = MP.draft.grace = 0;
    if (MP.sock) { try { MP.sock.onclose = null; MP.sock.close(); } catch (e) { } MP.sock = null; }
    if (optOut) shared.update(s => { s.mpAutoOff = true; });   // explicit solo: cruise won't auto-join
    emit("mp:status", { want: false });
}

/** Hop rooms without opting out (MULTIPLAYER.md "Switch rooms while connected"). */
export function switchRoom(room, kind) {
    if (!allowed()) return;
    if (MP.race) { const live = MP.race.state !== "done"; MP.race = null; MP.forceSends = 0; if (live) emit("mp:toast", { text: "🏁 race cancelled — left the room" }); }
    MP.convoy.active = false; MP.convoy.t = MP.convoy.grace = 0;
    MP.tag = null; MP.tagBanner = null;
    MP.draft.active = false; MP.draft.t = MP.draft.grace = 0;
    if (MP.sock) { try { MP.sock.onclose = null; MP.sock.close(); } catch (e) { } MP.sock = null; }
    MP.connected = false; MP.myId = null; MP.peers = {};
    MP.room = room; MP.roomKind = kind; MP.want = true; MP.ever = true;
    MP.wantSince = MP.clock; MP.reconnectDelay = 1; MP.reconnectAt = MP.clock;
    MP.switchTo = roomLabel(room);
    openSocket();
}

/** Cruise silently joins the EVERYONE lobby (non-blocking) unless she opted out. */
export function autoConnect() {
    if (!allowed() || MP.connected || MP.want || MP.sock) return;
    if (shared.get().mpAutoOff) return;
    try { connect("lobby", "everyone"); } catch (e) { /* silent solo */ }
}

function openSocket() {
    if (!allowed() || !MP.want) return;
    try {
        if (MP.sock) { try { MP.sock.onclose = null; MP.sock.close(); } catch (e) { } MP.sock = null; }
        const ws = new WebSocket(MP_URL + "/room/" + encodeURIComponent(MP.room));
        MP.sock = ws;
        ws.onopen = () => { try { onOpen(); } catch (e) { } };
        ws.onmessage = ev => { try { onMessage(ev); } catch (e) { console.error("[mp]", e); } };
        ws.onclose = () => { try { onClose(ws); } catch (e) { } };
        ws.onerror = () => { };
    } catch (e) {
        MP.sock = null;
        scheduleReconnect();
    }
}
function onOpen() {
    MP.reconnectDelay = 1; MP.pingT = 0; MP.sendT = 0;
    send({ t: "j", v: 1, room: MP.room === "lobby" ? "lobby" : MP.room.toUpperCase(), name: myName(), sk: ctx.car ? ctx.car.skinKey : "pink" });
}
function onClose(ws) {
    if (ws !== MP.sock) return;
    MP.sock = null; MP.connected = false; MP.peers = {};
    if (MP.want) scheduleReconnect();
}
function scheduleReconnect() { MP.reconnectAt = MP.clock + MP.reconnectDelay; MP.reconnectDelay = Math.min(MP.reconnectDelay * 2, 10); }

function onMessage(ev) {
    let msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }
    if (!msg || !msg.t) return;
    if (msg.t === "h") {
        MP.myId = msg.id; MP.connected = true; MP.switchTo = null; MP.peers = {};
        for (const pp of msg.peers || []) { addPeer(pp.id, pp.name, pp.sk); if (pp.d) applyState(pp.id, pp.d, true); }
        emit("mp:status", { connected: true });
    } else if (msg.t === "+") addPeer(msg.id, msg.name, msg.sk);
    else if (msg.t === "s") applyState(msg.id, msg.d);
    else if (msg.t === "e") peerEvent(msg.id, msg.e);
    else if (msg.t === "-") { const p = MP.peers[msg.id]; if (p) p.dropping = true, p.left = true; }
}

function addPeer(id, name, sk) {
    if (!id || id === MP.myId) return null;
    let p = MP.peers[id];
    if (!p) {
        p = MP.peers[id] = { id, name: name || "Rider", sk: sk || "pink", m: 0, vk: "car", ct: 0, co: null,
            x: X_MID, tx: X_MID, di: 0, sp: 0, seen: false, lastPacket: MP.clock, honkT: 0, waveT: 0, emT: 0,
            rel: 0, vis: 0, dropping: false, bonkCd: 0, bonkOverlap: false };
    } else { if (name) p.name = name; if (sk) p.sk = sk; }
    return p;
}

function applyState(id, d, snap) {
    if (!id || id === MP.myId || !d) return;
    const p = MP.peers[id] || addPeer(id, null, null);
    if (!p) return;
    p.lastPacket = MP.clock; p.dropping = false;
    if (typeof d.m === "number") p.m = d.m;
    if (typeof d.x === "number") p.tx = d.x;
    if (d.vk) p.vk = d.vk;
    if (typeof d.ct === "number") p.ct = d.ct;
    if (d.co) p.co = d.co;
    if (typeof d.sp === "number") p.sp = d.sp;
    if (typeof d.di === "number") {
        if (!p.seen) { p.di = d.di; p.x = p.tx; p.seen = true; }
        else { const err = d.di - p.di; if (Math.abs(err) > 250) p.di = d.di; else p.di += err * 0.4; }
    }
    // race fields: a hello snapshot's nonce is stale; any live new nonce is an invite
    if (typeof d.rn === "number") {
        if (snap) { p.rn = d.rn; p.rnInit = true; }
        else if (!p.rnInit || d.rn !== p.rn) { p.rn = d.rn; p.rnInit = true; raceJoin(d.rn); }
    }
    if (typeof d.rp === "number") p.raceProg = d.rp;
    if (d.pk) { p.pk = d.pk; p.pkT = MP.clock; } else p.pk = null;
    if (typeof d.rw === "number" && MP.race && d.rw === MP.race.id && MP.race.state !== "done") raceWon(p.name || "A rider");
    if (d.pb && d.pb.length === 2 && typeof d.pb[0] === "number") {
        if (snap) p.pbNonce = d.pb[0];
        else if (p.pbNonce !== d.pb[0]) { p.pbNonce = d.pb[0]; pushRecordToast(p.name, d.pb[1]); }
    }
    if (d.em && d.em.length === 2 && typeof d.em[0] === "number") {
        if (snap) p.emNonce = d.em[0];
        else if (p.emNonce !== d.em[0]) { p.emNonce = d.em[0]; p.emT = 1.1; p.emEmoji = EMOTES[d.em[1]] || "❤️"; }
    }
    if (d.it && d.it.length === 2 && typeof d.it[0] === "number" && !snap) tagApplyMarker(id, d.it[0], d.it[1]);
    if (typeof d.tgo === "number" && !snap) tagLearn(id, d.tgo);
    if (d.tgr && d.tgr.length === 2 && typeof d.tgr[0] === "number" && !snap && MP.tag && MP.tag.gid === d.tgr[0]) {
        MP.tag.results[id] = { name: p.name, secs: Math.max(0, d.tgr[1] || 0) };
        MP.tag.participants[id] = 1;
        if (!MP.tag.over) { MP.tag.over = true; MP.tag.resultsT = 0; if (MP.tag.resultsSentAt < 0) tagBroadcastResults(); }
    }
}

function peerEvent(id, e) {
    const p = MP.peers[id];
    if (!p) return;
    if (e === "honk") { p.honkT = 1.1; emit("mp:honk", { peer: p }); }
    else if (e === "wave") { p.waveT = 1.1; }
}

/** Tell the room I honked / waved. */
export function sendEvent(e) { if (MP.connected) send({ t: "e", e }); }

// ── my state → 2D format ─────────────────────────────────────────────────
function sendState() {
    const me = MP.me;
    const d = { m: me.foot ? 1 : 0, x: me.x, di: Math.round(me.di), sp: Math.round(me.sp || 0), vk: me.vk || "car" };
    if (d.vk === "borrowed") { d.ct = me.ct || 0; d.co = me.co || "#E53935"; }
    const pk = ctx.parking && ctx.parking.pose ? ctx.parking.pose() : null;
    if (pk) d.pk = pk;
    if (MP.race) {
        d.rn = MP.race.id;
        if (MP.race.state === "go") d.rp = Math.round(MP.race.prog || 0);
        if (MP.race.state === "done" && MP.race.winner === "me") d.rw = MP.race.id;
    }
    if (MP.myRecord && MP.clock - MP.recordAt < 4) d.pb = [MP.myRecord.n, MP.myRecord.v];
    if (MP.myEmote && MP.clock - MP.myEmote.at < 2) d.em = [MP.myEmote.n, MP.myEmote.idx];
    if (MP.tag) {
        if (MP.tag.itIsMe && !MP.tag.over) d.it = [MP.tag.n, MP.tag.gid];
        if (!MP.tag.over && MP.clock - MP.tag.tgoAt < 4) d.tgo = MP.tag.gid;
        if (MP.tag.over && MP.tag.resultsSentAt >= 0 && MP.clock - MP.tag.resultsSentAt < 4) d.tgr = [MP.tag.gid, Math.round(MP.tag.myItTime)];
    }
    send({ t: "s", d });
}

// ── records / emotes ─────────────────────────────────────────────────────
export function noteRecord(score) {
    MP.recordNonce++;
    MP.myRecord = { v: Math.floor(score || 0), n: MP.recordNonce };
    MP.recordAt = MP.clock;
    if (MP.forceSends < 3) MP.forceSends = 3;
}
function pushRecordToast(name, score) {
    MP.toasts.push({ name: name || "A rider", score: Math.floor(score || 0), t: 0 });
    while (MP.toasts.length > 4) MP.toasts.shift();
    tone(880, 0.09, "triangle", 0.14, 1180);
}
/** Fire one of the six 2D emotes (idx 0–5) — or 6 = 👋 wave (sent as the "wave" event). */
export function sendEmote(idx) {
    if (idx === 6) { sendEvent("wave"); MP.myBurst = { emoji: "👋", t: 1.1 }; tone(700, 0.1, "triangle", 0.14, 950); return; }
    MP.emoteNonce++;
    MP.myEmote = { n: MP.emoteNonce, idx, at: MP.clock };
    if (MP.forceSends < 2) MP.forceSends = 2;
    MP.myBurst = { emoji: EMOTES[idx] || "❤️", t: 1.1 };
    tone(660, 0.1, "triangle", 0.16, 900);
}

// ── FRIEND RACE ──────────────────────────────────────────────────────────
export function raceStart() {
    if (!friendRoom()) return;
    MP.raceSeq += 1 + Math.floor(Math.random() * 7);
    raceBegin(MP.raceSeq);
    MP.forceSends = 4;
}
function raceJoin(id) { if (!MP.race || MP.race.id !== id) raceBegin(id); }
function raceBegin(id) {
    MP.race = { id, state: "count", t: 0, lastBeep: 4, lastDi: 0, prog: 0, winner: null, winName: "", started: false };
    tone(392, 0.12, "square", 0.16);
    emit("mp:race", { state: "count" });
}
function raceWon(name) {
    if (!MP.race || MP.race.state === "done") return;
    Object.assign(MP.race, { state: "done", winner: "peer", winName: name, t: 0 });
    tone(392, 0.14, "triangle", 0.16); tone(523, 0.2, "triangle", 0.16, 0, 0.14);
    emit("mp:race", { state: "done", winner: name });
}
function raceUpdate(dt) {
    const R = MP.race;
    if (!R) return;
    R.t += dt;
    if (R.state === "count") {
        const n = Math.ceil(3 - R.t);
        if (n < R.lastBeep && n > 0) { R.lastBeep = n; tone(440, 0.09, "square", 0.16); }
        // racers waiting on the title hop into a fresh cruise, timed so the 3-2-1 lands on GO
        if (!R.started && R.t >= 0.6 && ctx.state === "title") { R.started = true; emit("mp:raceRun", {}); }
        if (R.t >= 3) {
            R.state = "go"; R.t = 0; R.lastDi = MP.me.di; R.prog = 0;
            tone(660, 0.16, "triangle", 0.2, 880);
            emit("mp:race", { state: "go" });
        }
    } else if (R.state === "go") {
        const dd = MP.me.di - R.lastDi;
        if (dd > 0 && dd < 3000) R.prog += dd;     // cumulative: crashes cost time, not progress
        R.lastDi = MP.me.di;
        if (R.prog >= RACE_GOAL) {
            Object.assign(R, { state: "done", winner: "me", winName: myName(), t: 0 });
            MP.forceSends = 5;
            tone(523, 0.12, "triangle", 0.2); tone(784, 0.14, "triangle", 0.2, 0, 0.12); tone(1047, 0.2, "triangle", 0.2, 0, 0.26);
            emit("mp:race", { state: "done", winner: "me" });
            emit("stat", { id: "mpRaceWins", n: 1 });
        }
        if (R.t > 1500) MP.race = null;
    } else if (R.state === "done" && R.t > 6) MP.race = null;
}

// ── TAG ─────────────────────────────────────────────────────────────────
function hashStr(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h >>> 0; }
function tagNewId() {
    const base = Math.floor(MP.clock * 1000) & 0x7fffff;
    const idh = MP.myId ? (hashStr(MP.myId) & 0xff) : ((Math.random() * 256) | 0);
    return (base * 256 + idh) >>> 0;
}
function tagInit(gid) {
    MP.tag = { gid, n: 0, itIsMe: false, itPeer: null, t: 0, dur: MP.tagDur, myItTime: 0, participants: {}, tgoAt: -1e9,
        over: false, resultsSentAt: -1, resultsT: 0, results: {}, wonTone: false, tagGuardUntil: MP.clock + 1.2 };
    return MP.tag;
}
export function tagStart() {
    if (!friendRoom()) return;
    const g = tagInit(tagNewId());
    g.n = 1; g.itIsMe = true; g.tgoAt = MP.clock;
    if (MP.myId) g.participants[MP.myId] = 1;
    MP.forceSends = Math.max(MP.forceSends, 5);
    MP.tagBanner = { text: "🏷 TAG! You're IT", sub: "Bump a friend to pass it — 90s!", t: 0 };
    tone(392, 0.12, "square", 0.16); tone(523, 0.14, "triangle", 0.16, 0, 0.13);
}
function tagLearn(id, gid) {
    if (MP.tag) { if (MP.tag.gid === gid) { MP.tag.participants[id] = 1; if (MP.myId) MP.tag.participants[MP.myId] = 1; } return; }
    tagInit(gid);
    MP.tag.participants[id] = 1; if (MP.myId) MP.tag.participants[MP.myId] = 1;
    MP.tagBanner = { text: "🏷 TAG started!", sub: "Avoid whoever's IT — 90s!", t: 0 };
    tone(440, 0.1, "square", 0.14);
}
function tagApplyMarker(id, n, gid) {
    if (!MP.tag) tagInit(gid);
    else if (MP.tag.gid !== gid) return;
    const T = MP.tag;
    T.participants[id] = 1; if (MP.myId) T.participants[MP.myId] = 1;
    if (n > T.n) { T.n = n; T.itIsMe = false; T.itPeer = id; T.tagGuardUntil = MP.clock + 1.2; }
    else if (n === T.n) {
        if (T.itIsMe) { if (MP.myId && id > MP.myId) { T.itIsMe = false; T.itPeer = id; } }
        else if (T.itPeer !== id) T.itPeer = (T.itPeer && id > T.itPeer) ? id : (T.itPeer || id);
    }
}
export function tagBecomeIt() {
    const T = MP.tag;
    if (!T || T.over || T.itIsMe) return;
    T.n += 1; T.itIsMe = true; T.itPeer = null;
    MP.forceSends = Math.max(MP.forceSends, 5);
    MP.tagBanner = { text: "YOU'RE IT! 🏷", sub: "Pass it back — bump a friend!", t: 0 };
    tone(311, 0.14, "square", 0.2); tone(415, 0.16, "sawtooth", 0.18, 0, 0.12);
}
function tagBroadcastResults() {
    if (!MP.tag) return;
    MP.tag.resultsSentAt = MP.clock;
    if (MP.myId) MP.tag.results[MP.myId] = { name: myName() + " (you)", secs: Math.round(MP.tag.myItTime) };
    MP.forceSends = Math.max(MP.forceSends, 5);
}
function tagUpdate(dt) {
    const T = MP.tag;
    if (!T) return;
    if (!friendRoom()) { MP.tag = null; return; }
    if (!T.over) {
        T.t += dt;
        if (T.itIsMe) T.myItTime += dt;
        if (T.t >= (T.dur || TAG_DUR)) { T.over = true; T.resultsT = 0; tagBroadcastResults(); tone(523, 0.16, "triangle", 0.18); }
    } else {
        T.resultsT += dt;
        if (!T.wonTone && T.resultsT > 0.3) { T.wonTone = true; tone(523, 0.12, "triangle", 0.18); tone(784, 0.16, "triangle", 0.18, 0, 0.12); }
        if (T.resultsT > 8) MP.tag = null;
    }
}
export function tagItName() {
    const T = MP.tag;
    if (!T) return "a rider";
    if (T.itIsMe) return myName();
    const p = MP.peers[T.itPeer];
    return p ? p.name : "a rider";
}
export function tagRows() {
    const T = MP.tag, rows = [];
    if (!T) return rows;
    for (const pid in T.results) rows.push(T.results[pid]);
    for (const q in T.participants) {
        if (T.results[q] || q === MP.myId) continue;
        const pp = MP.peers[q];
        rows.push({ name: pp ? pp.name : "Rider", secs: null });
    }
    rows.sort((a, b) => (a.secs === null ? 1e9 : a.secs) - (b.secs === null ? 1e9 : b.secs));
    return rows;
}

// ── PARTY PARKING ────────────────────────────────────────────────────────
function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function parkingRng() { return friendRoom() ? mulberry(hashStr("lot:" + MP.room.toUpperCase())) : null; }
export function parkingSpotIndex() {
    if (!friendRoom() || !MP.myId) return 0;
    const ids = [MP.myId, ...Object.keys(MP.peers)].sort();
    return Math.max(0, ids.indexOf(MP.myId));
}
export function parkingGhosts() {
    if (!friendRoom()) return null;
    const out = [];
    for (const id in MP.peers) {
        const p = MP.peers[id];
        if (p.pk && MP.clock - (p.pkT || -99) <= 3) out.push({ id, name: p.name, sk: p.sk, x: p.pk.x, y: p.pk.y, r: p.pk.r || 0 });
    }
    return out;
}

// ── async board: wanted posters + daily leaderboard ──────────────────────
function httpBase() { return MP_URL.replace(/^ws/, "http"); }
export function postScore(score) {
    if (MP.scorePosted) return;
    MP.scorePosted = true;
    if (!allowed() || !MP.ever || !shared.get().mpName) return;
    try {
        fetch(httpBase() + "/board/score", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: shared.get().mpName, score: Math.max(0, Math.round(score || 0)) }) })
            .then(() => { MP.scoresCache.t = -1e9; }).catch(() => { });
    } catch (e) { }
}
export function postWanted(charges) {
    if (!allowed() || !MP.ever || !shared.get().mpName || !charges || !charges.length) return;
    try {
        fetch(httpBase() + "/board/wanted", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: shared.get().mpName, charges: charges.slice(0, 3).map(String) }) })
            .then(() => { MP.wantedCache.t = -1e9; }).catch(() => { });
    } catch (e) { }
}
export function wantedList() {
    if (!allowed() || !shared.get().mpName) return [];
    const c = MP.wantedCache;
    if (MP.clock - c.t > 60 && !c.loading) {
        c.t = MP.clock; c.loading = true;
        try { fetch(httpBase() + "/board/wanted").then(r => r.json()).then(j => { c.data = (j && j.list) || []; c.loading = false; }).catch(() => { c.loading = false; }); }
        catch (e) { c.loading = false; }
    }
    return c.data || [];
}
export function scoresList() {
    if (!allowed() || !shared.get().mpName) return null;
    const c = MP.scoresCache;
    if (MP.clock - c.t > 60 && !c.loading) {
        c.t = MP.clock; c.loading = true;
        try {
            fetch(httpBase() + "/board/scores").then(r => r.json())
                .then(j => { c.data = (j && j.list) || []; c.ok = true; c.loading = false; emit("mp:scores", c.data); })
                .catch(() => { c.loading = false; });
        } catch (e) { c.loading = false; }
    }
    return c.ok ? c.data : null;
}

// ── the per-frame tick ───────────────────────────────────────────────────
/** me = { s, d, sp (m/s), foot, driving, sending, vk } from index.js */
export function tick(dt, me) {
    if (!MP_URL) return;
    MP.clock += dt;
    const M = MP.me;
    Object.assign(M, me);
    M.di = me.s * DI_PER_M;
    M.x = Math.round(Math.max(4, Math.min(476, X_MID + me.d * X_PER_M)));
    M.sp = (me.sp || 0) * DI_PER_M;
    if (MP.want && (!MP.sock || MP.sock.readyState >= 2) && MP.clock >= MP.reconnectAt) openSocket();
    if (sockOpen()) { MP.pingT += dt; if (MP.pingT >= 25) { MP.pingT = 0; send({ t: "pi" }); } }
    raceUpdate(dt);
    if (MP.connected && (me.sending || MP.race)) {
        MP.sendT += dt;
        if (MP.sendT >= 0.2 || MP.forceSends > 0) { MP.sendT = 0; if (MP.forceSends > 0) MP.forceSends--; sendState(); }
    }
    const fade = dt / 0.4;
    for (const id in MP.peers) {
        const p = MP.peers[id];
        p.di += (p.sp || 0) * dt;
        p.x += (p.tx - p.x) * Math.min(1, dt * 8);
        if (p.honkT > 0) p.honkT -= dt;
        if (p.waveT > 0) p.waveT -= dt;
        if (p.emT > 0) p.emT -= dt;
        if (p.bonkCd > 0) p.bonkCd -= dt;
        if (MP.clock - p.lastPacket > 6) p.dropping = true;
        const target = p.dropping ? 0 : 1;
        p.vis = p.vis < target ? Math.min(target, p.vis + fade) : Math.max(target, p.vis - fade);
        if ((p.dropping && p.vis <= 0.01) || MP.clock - p.lastPacket > 9) { emit("mp:peerGone", { peer: p }); delete MP.peers[id]; }
        else p.rel = wrap(p.di - M.di);
    }
    tagUpdate(dt);
    if (MP.tagBanner) { MP.tagBanner.t += dt; if (MP.tagBanner.t > 2.4) MP.tagBanner = null; }
    if (MP.myBurst) { MP.myBurst.t -= dt; if (MP.myBurst.t <= 0) MP.myBurst = null; }
    for (let i = MP.toasts.length - 1; i >= 0; i--) { MP.toasts[i].t += dt; if (MP.toasts[i].t > 3) MP.toasts.splice(i, 1); }
    const rc = riderCount();
    if (rc !== MP.lastRiders) { if (MP.lastRiders >= 0) MP.chipPulse = 1; MP.lastRiders = rc; emit("mp:riders", { n: rc }); }
    if (MP.chipPulse > 0) MP.chipPulse = Math.max(0, MP.chipPulse - dt / 0.6);
}

// debug: shrink the tag game in tests, inspect state
ctx.mpNet = { MP, connect, disconnect, switchRoom, sendEmote, raceStart, tagStart, noteRecord };
