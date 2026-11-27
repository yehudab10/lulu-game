// features/party — the party session over the Shared Road relay (protocol v1,
// MULTIPLAYER.md): a dumb relay that fans out `d` verbatim, ≤ 8 state msgs/s
// per client, ≤ 2 KB frames, ids per connection. Everything party-specific
// rides inside `d`; the server needs no changes.
//
//  • identity  — a stable uid per tab (sessionStorage) + a session id per page
//                load; the relay's join `name` carries "Rider name|uid" so a
//                peer is known the instant it joins. A reconnect gets a new
//                relay id but keeps its uid → same slot, same car.
//  • snapshots — ~7 Hz while driving (4 Hz in menus): seq number + sender's
//                party clock + pose along the ROAD (s, d, speeds in m per
//                party-second) + profile + flags. Client-side sliding window
//                keeps us under the relay's 8/s limit.
//  • clock     — NTP-style echo against the host (cq → cr in the host's next
//                snapshot, hold time subtracted, min-RTT filter); the client
//                slews ≤ 5 % so the party clock never jumps or runs backwards.
//                The host's clock IS the party clock; a new host keeps the
//                timeline it was synced to.
//  • host      — the host's snapshot carries H = { e: epoch, r: roster, A:
//                activity state, ak: acks, cr: clock replies }. State, not
//                deltas: every host snapshot is the whole truth, so a lost
//                packet costs nothing and a late joiner is current at once
//                (the relay's hello replays everyone's last `d`).
//  • events    — client → host "reliable" events ride in `ev` in every
//                snapshot until the host acks them (ak[uid] = highest nonce);
//                handlers are idempotent so a new host may safely re-run them.
//                Ephemeral broadcasts (emotes, chat, waves) ride in `bc` for
//                ~1.5 s and are de-duplicated per sender.
//  • election  — host silent > 4 s AND for 20 of my own frames (one long stall
//                of a crawling page isn't a dead host) → the first FRESH uid in
//                the roster order claims epoch + 1; higher epoch wins, ties go to
//                roster order. The old host steps down if it comes back.
import { ctx, emit } from "../../core/ctx.js";
import { shared } from "../../core/save.js";

const QS = new URLSearchParams(location.search);
export const RELAY = (ctx.TEST && QS.get("mpurl")) || "wss://lulu-shared-road.lulu-boats-1f4cdd.workers.dev";
export const CODE_ABC = "ABCDEFGHJKMNPQRTWXYZ";      // 20 letters nobody misreads (no I L O S U V)
export const CODE_LEN = 4;
export const MAX_PLAYERS = 8;
const ROOM_PREFIX = "LP3";                            // a digit inside → never a Shared Road friend room (letters only)
const PV = 1;
export const NAMES = [
    "Cholent Boy", "Rugelach Queen", "Bubby's Favorite", "Kugel Kid",
    "Shabbos Racer", "Babka Baron", "Gefilte Ghost", "Mitzvah Machine",
    "Sheitel Slayer", "Dreidel Daredevil", "Latke Legend", "Schmaltz Speedster",
];

export const now = () => performance.now();
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function randId(n) { let s = ""; for (let i = 0; i < n; i++) s += "abcdefghjkmnpqrstuvwxyz23456789"[rint(0, 30)]; return s; }
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Allowed to touch the network at all? (test runs must opt in with &enable=party) */
/** (a ?test page only ever talks to a relay the test points it at — &mpurl= — never the real one) */
export function allowed() { return typeof WebSocket !== "undefined" && !!RELAY && (!ctx.TEST || (ctx.enabled("party") && !!QS.get("mpurl"))); }
export function validCode(c) { return typeof c === "string" && c.length === CODE_LEN && [...c].every(ch => CODE_ABC.includes(ch)); }
export function worldSeed() { return hashStr("world:" + N.code); }
export function newCode() { let c = ""; for (let i = 0; i < CODE_LEN; i++) c += CODE_ABC[rint(0, CODE_ABC.length - 1)]; return c; }

// ── identity (stable per tab: a reload rejoins as the same player) ───────
function loadUid() {
    try { const u = sessionStorage.getItem("luluPartyUid"); if (u && /^[a-z0-9]{6,10}$/.test(u)) return u; } catch (e) { /* private mode */ }
    const u = randId(8);
    try { sessionStorage.setItem("luluPartyUid", u); } catch (e) { /* fine */ }
    return u;
}

// ── the session ──────────────────────────────────────────────────────────
export const N = {
    uid: loadUid(), si: randId(4),
    want: false, sock: null, connected: false, rid: null, code: "", room: "",
    joinedAt: 0, connectedAt: 0, everConnected: false, reconnectAt: 0, backoff: 500, attempts: 0,
    players: new Map(),          // uid → remote player
    byRid: new Map(),            // relay id → uid
    host: null, epoch: 0, roster: [], A: { v: 0, k: "lobby", id: 0 }, isHost: false,
    seq: 0, sendT: 0, sends: [], urgent: false, lastSendAt: 0,
    evNonce: 0, pending: [],     // my reliable events → host
    silentTicks: 0,              // frames the host's been silent (takeover hysteresis)
    bcNonce: rint(1, 1e6), bcast: [],
    seen: {}, acks: {},          // host: processed nonces per uid
    replies: [],                 // host: clock replies to send
    profile: { n: "", sk: "pink", hn: "beep", hc: "", rd: 0 },
    mode: 0, flags: 0, pose: null, extra: null,
    xk: {},                      // per-feature extras (presence, foot pose, parked car, cops…) merged into d.x with `extra`
    full: false, lost: false, hostSince: 0,
};
// clock
const C = { off: 0, target: 0, synced: false, samples: [], nextPing: 0, nonce: 0, pend: new Map() };
export function clock() { return now() + C.off; }
export const clockSynced = () => C.synced;
export const clockInfo = () => ({ off: C.off, target: C.target, synced: C.synced, samples: C.samples.length, rtt: C.samples.length ? Math.min(...C.samples.map(s => s.rtt)) : -1 });

export function myName() { const n = shared.get().mpName; return NAMES.includes(n) ? n : NAMES[0]; }
export function setMyName(n) { if (NAMES.includes(n)) shared.update(s => { s.mpName = n; }); N.urgent = true; }

// ── connection ───────────────────────────────────────────────────────────
function sockOpen() { return !!N.sock && N.sock.readyState === 1; }
function rawSend(obj) {
    try { if (sockOpen()) { N.sock.send(JSON.stringify(obj)); return true; } } catch (e) { /* offline is fine */ }
    return false;
}

/** Start (or rejoin) party `code`. host = true: I'm creating it. */
export function start(code, host) {
    if (!allowed() || !validCode(code)) return false;
    stop(false);
    if (!shared.get().mpName || !NAMES.includes(shared.get().mpName)) shared.update(s => { s.mpName = NAMES[rint(0, NAMES.length - 1)]; });
    Object.assign(N, { want: true, code, room: ROOM_PREFIX + code, connected: false, rid: null, joinedAt: now(), connectedAt: 0, everConnected: false,
        reconnectAt: 0, backoff: 500, attempts: 0, host: null, epoch: 0, roster: [], A: { v: 0, k: "lobby", id: 0 }, isHost: false,
        pending: [], bcast: [], seen: {}, acks: {}, replies: [], full: false, lost: false, xk: {} });
    N.players.clear(); N.byRid.clear();
    C.synced = false; C.samples.length = 0; C.pend.clear(); C.nextPing = 0;
    if (host) becomeHost(1, true);
    try { sessionStorage.setItem("luluParty", JSON.stringify({ code, at: Date.now() })); } catch (e) { /* fine */ }
    openSocket();
    emit("party:status", { want: true });
    return true;
}

/** Leave the party (forget = don't auto-rejoin on reload). */
export function stop(forget = true) {
    const was = N.want;
    N.want = false; N.connected = false;
    if (N.sock) { const s = N.sock; N.sock = null; try { s.onclose = null; s.onmessage = null; s.close(); } catch (e) { /* gone */ } }
    N.players.clear(); N.byRid.clear(); N.isHost = false; N.host = null; N.roster = []; N.pending = []; N.silentTicks = 0; N.bcast = [];
    if (forget) { try { sessionStorage.removeItem("luluParty"); } catch (e) { /* fine */ } }
    if (was) emit("party:status", { want: false });
}

/** Test hook: drop the socket as if the network blinked (we reconnect by ourselves). */
export function blink() { if (N.sock) { try { N.sock.close(); } catch (e) { /* gone */ } } }

function openSocket() {
    if (!N.want) return;
    try {
        const ws = new WebSocket(RELAY + "/room/" + N.room);
        N.sock = ws;
        ws.onopen = () => { if (ws === N.sock) rawSend({ t: "j", v: 1, room: N.room, name: ((N.profile.n || myName()) + "|" + N.uid).slice(0, 40), sk: N.profile.sk || "pink" }); };
        ws.onmessage = ev => { if (ws !== N.sock) return; try { onMessage(ev); } catch (e) { console.error("[party] message", e); } };
        ws.onclose = () => { if (ws !== N.sock) return; onClose(); };
        ws.onerror = () => { };
    } catch (e) { N.sock = null; scheduleReconnect(); }
}
function onClose() {
    N.sock = null; N.connected = false; N.rid = null; N.drops = (N.drops || 0) + 1;
    if (N.want) { scheduleReconnect(); emit("party:status", { connected: false }); }
}
function scheduleReconnect() { N.attempts++; N.reconnectAt = now() + N.backoff; N.backoff = Math.min(N.backoff * 2, 4000); }

function onMessage(ev) {
    let m;
    try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m || !m.t) return;
    if (m.t === "h") {
        N.rid = m.id; N.connected = true; N.connectedAt = now(); N.everConnected = true; N.backoff = 500; N.attempts = 0;
        N.byRid.clear();
        for (const p of m.peers || []) { peerJoined(p.id, p.name); if (p.d) applySnap(p.id, p.d, true); }
        N.urgent = true;
        emit("party:status", { connected: true });
    } else if (m.t === "+") peerJoined(m.id, m.name);
    else if (m.t === "s") applySnap(m.id, m.d, false);
    else if (m.t === "-") {
        const uid = N.byRid.get(m.id);
        N.byRid.delete(m.id);
        const p = uid && N.players.get(uid);
        if (p && p.rid === m.id) { p.left = true; p.leftAt = now(); emit("party:player", { p, left: true }); }
    }
}

function parseUid(name) { const i = String(name || "").lastIndexOf("|"); return i >= 0 ? name.slice(i + 1) : null; }
function peerJoined(rid, name) {
    const uid = parseUid(name);
    if (!uid || uid === N.uid) return;
    N.byRid.set(rid, uid);
    const p = player(uid);
    if (p.left) emit("party:player", { p, back: true });
    p.rid = rid; p.left = false;
    if (!p.n) p.n = String(name).slice(0, String(name).lastIndexOf("|"));
}

/** A remote player record (created on first sight). */
function player(uid) {
    let p = N.players.get(uid);
    if (!p) {
        p = { uid, rid: null, si: "", q: -1, n: "", sk: "pink", hn: "beep", hc: "", rd: 0, m: 0, f: 0, cs: false,
            lastRecv: now(), firstRecv: now(), left: false, leftAt: 0, samples: [], bcSeen: -1, aid: 0, rs: 0, data: {} };
        N.players.set(uid, p);
        emit("party:player", { p, joined: true });
    }
    return p;
}

// ── receiving a snapshot ─────────────────────────────────────────────────
function applySnap(rid, d, hello) {
    if (!d || d.pv !== PV || typeof d.u !== "string" || d.u === N.uid) return;
    const p = player(d.u);
    if (p.rid !== rid) { p.rid = rid; N.byRid.set(rid, d.u); }
    p.left = false;
    if (d.si !== p.si) {   // a new page load (or first sight): forget per-session state
        p.si = d.si; p.q = -1; p.bcSeen = hello ? Infinity : -1; p.samples.length = 0; p.rs = -1;
    }
    if (typeof d.q === "number") { if (d.q <= p.q) return; p.q = d.q; }
    if (!hello) p.lastRecv = now();
    else p.lastRecv = now() - 1500;   // a hello replay may be old: not "fresh" until a live packet arrives
    p.cs = !!d.cs;
    if (typeof d.n === "string" && NAMES.includes(d.n)) p.n = d.n;
    if (typeof d.sk === "string") p.sk = d.sk.slice(0, 16);
    if (typeof d.hn === "string") p.hn = d.hn.slice(0, 16);
    if (typeof d.hc === "string") p.hc = d.hc.slice(0, 9);
    p.rd = d.rd ? 1 : 0;
    p.m = d.m | 0; p.f = d.f | 0;
    p.aid = d.a | 0;
    p.x = d.x || null;            // activity extras (finish, score, cop…) – read by the activities
    // pose → the interpolation buffer (party-clock stamped)
    if (Array.isArray(d.p) && d.p.length >= 6 && !hello) {
        const t = d.cs && typeof d.t === "number" ? d.t : clock() - 60;
        const rs = d.p[7] | 0;
        if (rs !== p.rs) { p.samples.length = 0; p.rs = rs; p.respawn = true; }
        pushSample(p, { t, s: d.p[0] / 10, d: d.p[1] / 100, vs: d.p[2] / 100, vd: d.p[3] / 100, yaw: d.p[4] / 1000, steer: d.p[5] / 100, y: (d.p[6] | 0) / 100, f: p.f });
    } else if (Array.isArray(d.p) && hello) {
        p.helloPose = { s: d.p[0] / 10, d: d.p[1] / 100 };
    }
    // host state
    if (d.H && typeof d.H.e === "number") hostSnap(p, d.H, hello);
    // reliable events → me if I host
    if (N.isHost && Array.isArray(d.ev)) for (const e of d.ev) hostEvent(d.u, e);
    // broadcasts
    if (Array.isArray(d.bc)) for (const b of d.bc) {
        if (!Array.isArray(b) || typeof b[0] !== "number") continue;
        if (b[0] <= p.bcSeen) continue;
        p.bcSeen = Math.max(p.bcSeen === Infinity ? -1 : p.bcSeen, b[0]);
        emit("party:bc", { p, k: b[1], a: b.slice(2) });
    }
    if (hello && Array.isArray(d.bc) && d.bc.length) p.bcSeen = Math.max(...d.bc.map(b => b[0] || 0));
    else if (hello && p.bcSeen === Infinity) p.bcSeen = -1;
    // clock pings → me if I host
    if (N.isHost && Array.isArray(d.cq) && !hello) N.replies.push([d.u, d.cq[0], d.cq[1], Math.round(clock() * 10) / 10]);
}

function pushSample(p, s) {
    const S = p.samples;
    if (S.length && s.t <= S[S.length - 1].t) s.t = S[S.length - 1].t + 1;   // keep time strictly increasing
    S.push(s);
    if (S.length > 12) S.shift();
    p.lastSampleWall = now();
}

function rosterIndex(uid) { const i = N.roster.indexOf(uid); return i < 0 ? 99 : i; }

function hostSnap(p, H, hello) {
    const e = H.e | 0;
    // who wins? higher epoch; same epoch → earlier in the roster
    const better = e > N.epoch || (e === N.epoch && (N.host == null || N.host === p.uid || rosterIndex(p.uid) < rosterIndex(N.host)));
    if (!better) return;
    if (N.isHost && p.uid !== N.uid) {   // someone outranks me: step down
        N.isHost = false;
        emit("party:host", { host: p.uid, stepDown: true });
    }
    const was = N.host;
    N.host = p.uid; N.epoch = e;
    if (Array.isArray(H.r)) N.roster = H.r.filter(u => typeof u === "string").slice(0, MAX_PLAYERS);
    if (H.A && typeof H.A === "object" && (H.A.v | 0) !== (N.A.v | 0) || (H.A && was !== p.uid)) {
        const prev = N.A;
        N.A = H.A;
        emit("party:act", { A: N.A, prev });
    }
    if (H.ak && typeof H.ak === "object") {
        N.acks = H.ak;   // remembered: a new host starts from these
        const mine = H.ak[N.uid];
        if (typeof mine === "number") N.pending = N.pending.filter(ev => ev.n > mine);
    }
    if (!hello && Array.isArray(H.cr) && typeof H.ct === "number") {
        const t1 = now();
        for (const r of H.cr) {
            if (!Array.isArray(r) || r[0] !== N.uid) continue;
            const t0 = C.pend.get(r[1]);
            if (t0 == null) continue;
            C.pend.delete(r[1]);
            clockSample(t0, r[3], H.ct, t1);
        }
    }
    if (was !== p.uid) {
        C.samples.length = 0; C.nextPing = 0; C.pend.clear();   // re-sync against the new host's clock (we keep slewing meanwhile)
        N.replies = [];
        emit("party:host", { host: p.uid });
    }
}

// ── clock ────────────────────────────────────────────────────────────────
function clockSample(t0, tRecv, tSend, t1) {
    const rtt = (t1 - t0) - (tSend - tRecv);
    if (!(rtt >= 0) || rtt > 5000) return;
    const off = ((tRecv - t0) + (tSend - t1)) / 2;
    C.samples.push({ rtt, off, at: now() });
    while (C.samples.length > 10) C.samples.shift();
    let best = null;
    for (const s of C.samples) if (now() - s.at < 60000 && (!best || s.rtt < best.rtt)) best = s;
    C.target = best.off;
    if (!C.synced) { C.off = C.target; C.synced = true; emit("party:synced", {}); }
}
function slewClock(dtMs) {
    if (!C.synced || N.isHost) return;
    const err = C.target - C.off;
    if (Math.abs(err) > 1500) { C.off = C.target; return; }   // a stranger host clock: jump once
    const max = Math.max(0.5, dtMs * 0.05);                     // ≤ 5 % slew: monotonic, invisible
    C.off += Math.max(-max, Math.min(max, err));
}

// ── host ─────────────────────────────────────────────────────────────────
function becomeHost(epoch, fresh) {
    N.isHost = true; N.host = N.uid; N.epoch = epoch; N.hostSince = now();
    if (fresh) {
        C.off = 1000 - now(); C.target = C.off; C.synced = true;   // party time starts at 1 s
        N.roster = [N.uid];
        N.A = { v: 1, k: "lobby", id: 0, seed: hashStr(N.code + ":" + N.uid) };
    } else {
        C.target = C.off; C.synced = true;                           // keep the timeline we were synced to
        if (!N.roster.includes(N.uid)) N.roster.unshift(N.uid);
        N.seen = Object.assign({}, N.acks);                          // don't re-run what the old host already did
        N.A = Object.assign({}, N.A, { v: (N.A.v | 0) + 1 });
    }
    N.urgent = true;
    emit("party:host", { host: N.uid, me: true, fresh: !!fresh });
}

/** Host: change the activity state (bumps the version; goes out in the next snapshot). */
export function setA(next) {
    if (!N.isHost) return;
    const prev = N.A;
    N.A = Object.assign({}, next, { v: (prev.v | 0) + 1 });
    N.urgent = true;
    emit("party:act", { A: N.A, prev });
}

const eventHandlers = [];
/** Host side: fn(uid, kind, args) handles a reliable event (must be idempotent). */
export function onHostEvent(fn) { eventHandlers.push(fn); }
function hostEvent(uid, e) {
    if (!Array.isArray(e) || typeof e[0] !== "number") return;
    if (e[0] <= (N.seen[uid] | 0)) return;
    N.seen[uid] = e[0];
    N.acks[uid] = e[0];
    for (const fn of eventHandlers) { try { fn(uid, e[1], e.slice(2)); } catch (err) { console.error("[party] host event", err); } }
    N.urgent = true;
}

/** Send a reliable event to the host (re-sent in every snapshot until acked). */
export function sendEvent(kind, ...args) { queueEvent(kind, args); }
// (NOT re-sent on a host change: a reliable event is only de-duplicated by its nonce — re-running one later under a new
//  nonce (a chase started, a race finished, a claim) replays the game, e.g. a crew that shook the cops chased again.)
function queueEvent(kind, args) {
    const ev = { n: ++N.evNonce, k: kind, a: args };
    if (N.isHost) { hostEvent(N.uid, [ev.n, kind, ...args]); return; }
    N.pending.push(ev);
    if (N.pending.length > 12) N.pending.shift();
    N.urgent = true;
}
/** Broadcast an ephemeral event to everyone (emote, chat, wave): repeated ~1.5 s, de-duplicated. */
export function broadcast(kind, ...args) {
    N.bcast.push({ n: ++N.bcNonce, k: kind, a: args, at: now() });
    if (N.bcast.length > 10 && !N.bcast.shift().sent) N.bcLost = (N.bcLost | 0) + 1;
    N.urgent = true;
}

// ── who's here ───────────────────────────────────────────────────────────
/** Fresh = heard from recently (an away tab says so before going quiet). */
export function fresh(p, ms = 2500) {
    if (!p || p.left) return false;
    const age = now() - p.lastRecv;
    return age < ms || ((p.f & 16) && age < 60000);
}
/** Present party members (in the roster, connected), me included, in roster order. */
export function members() {
    const out = [];
    for (const u of N.roster) {
        if (u === N.uid) { out.push(u); continue; }
        const p = N.players.get(u);
        if (p && !p.left && now() - p.lastRecv < 20000) out.push(u);
    }
    if (!out.includes(N.uid)) out.push(N.uid);
    return out;
}
export function hostAlive() {
    if (N.isHost) return true;
    const h = N.host && N.players.get(N.host);
    return !!h && !h.left && now() - h.lastRecv < 4000 + ((h.f & 16) ? 20000 : 0);
}

// ── the per-frame tick ───────────────────────────────────────────────────
let lastWall = 0;
export function tick() {
    const t = now();
    const dtMs = lastWall ? Math.min(250, t - lastWall) : 16;
    lastWall = t;
    if (!N.want) return;
    slewClock(dtMs);
    if (!N.sock && t >= N.reconnectAt) openSocket();
    // drop players who left long ago
    for (const [uid, p] of N.players) {
        if ((p.left && t - p.leftAt > 30000) || t - p.lastRecv > 90000) { N.players.delete(uid); emit("party:player", { p, gone: true }); }
    }
    if (!N.connected) return;
    electHost(t);
    if (N.isHost) hostTick(t);
    // clock pings to the host
    if (!N.isHost && N.host && t >= C.nextPing) {
        C.nonce++;
        N.ping = C.nonce;          // stamped when it actually goes out (sendSnap)
        C.nextPing = t + (C.samples.length < 6 ? 500 : 3000);
        N.urgent = true;
    }
    // snapshot schedule
    const interval = (N.mode >= 2 && N.mode <= 5) || N.xk.in ? 1000 / 7 : 250;     // (d.x.in: walking in a room shared with friends — features/together)
    const due = t - N.lastSendAt >= interval || (N.urgent && t - N.lastSendAt >= 60);
    if (due && windowOk(t)) sendSnap(t);
}

function windowOk(t) {
    while (N.sends.length && t - N.sends[0] > 1000) N.sends.shift();
    return N.sends.length < 7;     // the relay allows 8/s; 1 spare for jitter
}

const TAKEOVER_TICKS = 20;
function electHost(t) {
    if (N.isHost) return;
    if (t - N.connectedAt < 1500) return;                       // let the hello + first host snapshot land
    if (hostAlive()) { N.silentTicks = 0; return; }
    // hysteresis: silent for 4 s of wall time AND for TAKEOVER_TICKS of my own frames — one long stall of MY page (a crawling
    // tab, a model load) isn't the host being gone (a takeover flip-flopped the host for ~10 frames on a slow CI page)
    if (++N.silentTicks < TAKEOVER_TICKS) return;
    const cands = N.roster.filter(u => u !== N.host && (u === N.uid || fresh(N.players.get(u), 2500)));
    if (!N.roster.length || !N.host) {
        // nobody has ever hosted this room (an empty or brand-new code)
        if (t - N.connectedAt > 2500 && ![...N.players.values()].some(p => fresh(p))) { N.lost = true; }
        return;
    }
    if (cands[0] === N.uid || (!cands.length)) becomeHost(N.epoch + 1, false);
}

function hostTick(t) {
    // the roster: everyone fresh joins (up to 8); long-gone members drop out
    for (const [uid, p] of N.players) {
        if (N.roster.includes(uid) || p.left || !fresh(p)) continue;
        if (N.roster.length < MAX_PLAYERS) { N.roster.push(uid); N.urgent = true; emit("party:roster", {}); }
    }
    const keep = N.roster.filter(u => {
        if (u === N.uid) return true;
        const p = N.players.get(u);
        return p && !(p.left && t - p.leftAt > 20000) && t - p.lastRecv < 45000;
    });
    if (keep.length !== N.roster.length) { N.roster = keep; N.urgent = true; emit("party:roster", {}); }
}

function sendSnap(t) {
    N.lastSendAt = t;
    N.sends.push(t);
    N.urgent = false;
    const pr = N.profile;
    const d = { pv: PV, u: N.uid, si: N.si, q: ++N.seq, t: Math.round(clock()), cs: C.synced ? 1 : 0,
        n: pr.n || myName(), sk: pr.sk, hn: pr.hn, m: N.mode, f: N.flags, a: N.A.id | 0 };
    if (pr.hc) d.hc = pr.hc;
    if (pr.rd) d.rd = 1;
    if (N.pose) d.p = N.pose;
    const xk = N.xk;
    let hasXk = false;
    for (const k in xk) { hasXk = true; break; }
    if (N.extra || hasXk) d.x = hasXk ? Object.assign({}, N.extra, xk) : N.extra;
    if (N.pending.length) d.ev = N.pending.slice(0, 8).map(e => [e.n, e.k, ...e.a]);
    const live = N.bcast.filter(b => t - b.at < 1500);
    N.bcast = live;
    if (live.length) d.bc = live.map(b => (b.sent = true, [b.n, b.k, ...b.a]));
    if (N.ping) {
        const ts = now();
        C.pend.set(N.ping, ts);
        if (C.pend.size > 8) C.pend.delete(C.pend.keys().next().value);
        d.cq = [N.ping, Math.round(ts * 10) / 10]; N.ping = null;
    }
    if (N.isHost) {
        const H = { e: N.epoch, r: N.roster, A: N.A, ak: N.acks };
        if (N.replies.length) { H.cr = N.replies.splice(0, 8); H.ct = Math.round(clock() * 10) / 10; }
        d.H = H;
    }
    let s = JSON.stringify({ t: "s", d });
    if (s.length > 1900 && d.x && hasXk) { d.x = Object.assign({}, N.extra, { pr: xk.pr }); s = JSON.stringify({ t: "s", d }); }   // the bulky extras go first (presence stays)
    // (the one-off broadcasts are the last to go: a ring's "pzs", a claim — repeated extras come back next packet)
    if (s.length > 1900 && d.x) { delete d.x; s = JSON.stringify({ t: "s", d }); N.slim = (N.slim | 0) + 1; }
    if (s.length > 1900) { delete d.bc; s = JSON.stringify({ t: "s", d }); N.bcBig = (N.bcBig | 0) + 1; }
    N.maxLen = Math.max(N.maxLen | 0, s.length);
    try { if (sockOpen()) N.sock.send(s); } catch (e) { /* offline */ }
}

/** A per-feature extras key in my snapshots' `d.x` (null / undefined removes it). Keys are short: pr f pc v cp ws jk. */
export function setX(k, v) { if (v == null) delete N.xk[k]; else N.xk[k] = v; }

/** Send right now (e.g. the tab is about to be hidden), if the rate window allows. */
export function flush() { if (N.connected && windowOk(now())) sendSnap(now()); }

// debug (tests)
export const debugClock = C;
