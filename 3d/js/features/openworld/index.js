// ─────────────────────────────────────────────────────────────────────────
//  features/openworld — 🌍 AN OPEN WORLD YOU CAN DO THINGS IN (especially with friends)
//
//  With friends (a 🎉 party): the lobby gets 🌍 FREE ROAM — everyone on the same seeded
//  highway AND into the towns (Lakewood…) together. A town in a party is kept identical
//  on every screen: no random drivers (towntraffic.js: seeded right-turn block loops, a
//  pure function of the party clock), seeded townsfolk + geese, no e-bikes, shared coin
//  pickups. Friends are real cars wherever they are: on the highway in road coordinates
//  (party's own netcode), on a town's streets in a flat world frame (so corners never
//  "snap"), hidden when they're somewhere else (the 👯 app says where — and warps you).
//
//  Party games start from the 📱 phone (👯 Party app — no new buttons): 🚓 Cops & Robbers,
//  📍 Race to a Pin, 🥘 Hot Kugel, 📸 Photo Hunt (games.js). The host owns the game state
//  (it rides inside the party activity, so a late packet / a new host loses nothing);
//  every screen claims only what IT saw (my bump, my arrival, my snap) and the host
//  settles it. Everyone lines up at the starter's spot, 3-2-1, go; a scoreboard + 🔁
//  Rematch at the end (in the phone).
//
//  Solo: the 📍 Nearby app — what's around (people to talk to, landmarks, coins, the way
//  out, the next town exit, places up the road…) with a map pin, plus solo 📍 time trials
//  and 📸 photo hunts in town. One objective chip while something's live, nothing else.
//
//  Service: ctx.openworld = { partyTowns(), seeded(key, fn), zone, game, start(k), end(),
//    warpTo(uid), pin(def) / unpin(), nearby(), debug }
//  Party protocol (all inside the existing relay `d` packet — no server change):
//    d.x = { z: zone ("" | town id), ex: the town's highway exit s }   (my extras)
//    pose in a town: s = z + 20000, d = −x, heading frame 0           (flat frame)
//    A.g = the game (host state) · reliable events: owg (start) owf (finish) owb (bust)
//    owd (delivered) owk (kugel pass) owp (snap) · party:bc "k" keys "c-1:i" = town coins
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import { dissolve } from "../../core/transition.js";
import { store, saveSoon } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { rumble, input } from "../../input.js";
import * as H from "../../hud.js";
import * as AU from "../../audio.js";
import { tone } from "../parking/sfx.js";
import { GAMES, ORDER, winners } from "./games.js";
import * as HUD from "./hud.js";
import { beacon, hideBeacon, hideBeacons, roofProp, tickProps, beaconCount } from "./marks.js";
import { syncTownTraffic, clearTownTraffic, townCarsAt, townLive, TT, loopPoint, townClaims } from "./towntraffic.js";
import { registerApps } from "./apps.js";
import { initSpots, spotsDebug } from "./spots.js";
import { initRide, startRide, stopRide, riding, tickSeats, ridingWith } from "./ride.js";

const SAVE = store("openworld", { best: {}, games: 0, wins: 0, snaps: 0, pins: 0 });
const OFF = 20000;                 // the flat frame's s offset (towns sit south of the highway's start)
const GRID_S = 60;

// ── who / where / when ───────────────────────────────────────────────────
const party = () => !!(ctx.party && ctx.party.active);
/** In a party that's free-roaming (the only party activity with games + towns). */
const roam = () => party() && !!ctx.party.activity && ctx.party.activity.k === "roam";
const me = () => (roam() ? ctx.party.uid : "me");
const SOLO = { ms: 0, g: null, n: 0 };
const now = () => (roam() ? ctx.party.clock() : SOLO.ms);
const isHost = () => !roam() || ctx.party.isHost;
const members = () => (roam() ? ctx.party.members() : ["me"]);
export const zone = () => (ctx.town && ctx.town.active ? ctx.town.id || "" : "");
const zoneOfPeer = p => (p && p.x && typeof p.x.z === "string" ? p.x.z : "");
const onFoot = () => !!(ctx.foot && ctx.foot.active);
function nameOf(uid) { return uid === "me" ? "You" : ctx.party ? ctx.party.displayName(uid) : "Friend"; }
function skinHex(uid) { try { return ctx.party.skinHex(ctx.party.skinOf(uid)); } catch (e) { return "#E91E63"; } }
const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");

const _pos = {};
/** Where player uid is right now (world x/z), as THIS screen sees them — or null. */
function posOf(uid) {
    if (uid === me()) { const p = onFoot() && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos; _pos.x = p.x; _pos.z = p.z; return _pos; }
    if (!roam()) return null;
    const rc = ctx.party.remoteCar(uid);
    return rc && rc.shown ? { x: rc.x, z: rc.z } : null;
}
/** Is my car touching friend uid's car (oriented box test, both cars ~4.3 × 2 m)? */
function touching(uid) {
    const rc = roam() && ctx.party.remoteCar(uid);
    if (!rc || !rc.shown || onFoot()) return false;
    const car = ctx.car, dx = rc.x - car.pos.x, dz = rc.z - car.pos.z;
    const lon = dx * Math.sin(car.h) + dz * Math.cos(car.h), lat = dx * -Math.cos(car.h) + dz * Math.sin(car.h);
    return Math.abs(lon) < 4.7 && Math.abs(lat) < 2.45;
}

// ── seeded helpers ───────────────────────────────────────────────────────
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** Run fn with Math.random seeded from the party (every friend's town builds its townsfolk the same). */
function seeded(key, fn) {
    const r = mulberry(hashStr(String(key) + ":" + (party() ? ctx.party.seed : 0)));
    const orig = Math.random;
    Math.random = r;
    try { return fn(); } finally { Math.random = orig; }
}

// ── the flat frame: a town's streets as plain world axes (s = z + OFF, d = −x, heading 0) ──
const FLAT = {
    free: true,
    point(s, d, o = {}) { o.x = -d; o.z = s - OFF; o.h = 0; return o; },
    at(s, o = {}) { o.x = 0; o.z = s - OFF; o.h = 0; return o; },
};

// ── 🌍 FREE ROAM: the party activity ─────────────────────────────────────
const ROAM = { zone: null, exitS: null, leftExit: null, leftT: -9, extra: { z: "", ex: 0 } };
const POSE = { s: 0, d: 0, h: 0 };
function registerRoam() {
    if (!ctx.party || !ctx.party.addActivity) return;
    ctx.party.addActivity("roam", {
        emoji: "🌍", name: "Free Roam", blurb: "Highway + Lakewood together · games on 📱", go: "Go anywhere! 📱 👯 for games",
        planFirst: true, noGrid: true,
        init: () => ({ g: null }),
        slotIn: A => { lateJoin(A); return true; },
        respawnAt() {
            if (ROAM.leftExit != null && ctx.time - ROAM.leftT < 3) { const s = ROAM.leftExit + 190; ROAM.leftExit = null; return { s, d: 5.25 }; }
            return null;
        },
        label: icon => roamLabel(icon),
        progress: () => roamProgress(),
        show: p => zoneOfPeer(p) === zone() && !ridingWith(p),
        frame: p => (zoneOfPeer(p) ? FLAT : null),
        pose() {
            const z = zone();
            if (z !== ROAM.zone) { ROAM.zone = z; ctx.party.respawned(); }       // a new frame: friends restart my track
            ROAM.extra.z = z; ROAM.extra.ex = Math.round(ROAM.exitS || 0);
            ctx.party.setExtra(ROAM.extra);
            if (!z) return null;
            const c = ctx.car;
            POSE.s = c.pos.z + OFF; POSE.d = -c.pos.x; POSE.h = 0;
            return POSE;
        },
        decorate: (rc, p) => decorateFriend(rc, p),
        ownTraffic: () => !!zone(),
    });
}
registerRoam();
// a town minivan / bus can be CLAIMED (party's carjack plumbing): it leaves its loop for everyone, parks for her
if (ctx.party && ctx.party.claimKinds) ctx.party.claimKinds("tw", townClaims);
// …and the yellow school bus on its loop is jackable too (streets' table of rides; town adds the minivan)
on("boot", () => {
    const R = ctx.streets && ctx.streets.rides;
    if (R && R.truck && !R.town_bus) R.town_bus = Object.assign({}, R.truck, { model: "roadevents_school_bus", label: "🚌 JACK THE SCHOOL BUS", half: 1.27, fwd: 3.9, len: 1.0, y: [0.7, 2.2] });
    const C = ctx.streets && ctx.streets.cams;
    if (C && !C.roadevents_school_bus) C.roadevents_school_bus = { d: 4.2, h: 1.9 };
});

function roamLabel(icon) {
    const g = getG();
    if (g && g.ph === "go") {
        const G = GAMES[g.k];
        if (icon && icon.textContent !== G.emoji) icon.textContent = G.emoji;
        const left = g.dur ? Math.max(0, g.t0 + (g.k === "kugel" ? 0 : g.dur) - now()) : 0;
        return `${G.emoji} ${G.name.toUpperCase()}${g.k !== "kugel" && left ? ` · ${HUD.fmtT(left)} left` : ""}`;
    }
    if (icon && icon.textContent !== "🌍") icon.textContent = "🌍";
    const e = nextExit();
    return e ? `🌍 FREE ROAM · ${e.emoji || "🏙️"} ${e.name} exit in ${(Math.max(0, e.s - ctx.car.s) / 1609).toFixed(1)} mi` : "🌍 FREE ROAM";
}
function roamProgress() {
    const g = getG();
    if (g && g.ph === "go" && g.dur && g.k !== "kugel") return Math.max(0, Math.min(1, (now() - g.t0) / g.dur));
    const e = nextExit();
    return e ? Math.max(0, Math.min(1, 1 - (e.s - ctx.car.s) / 3600)) : 1;
}
function nextExit() {
    if (!ctx.town || !ctx.town.exits || zone()) return null;
    const s = ctx.car.s;
    let best = null;
    for (const e of ctx.town.exits) if (e.s > s - 60 && (!best || e.s < best.s)) best = e;
    return best;
}

/** Late to a free roam: land next to a friend — the one whose link I opened, else the host, else anyone —
 *  wherever they are; if they're walking, she climbs out and walks over too (standing next to them, not a lane away). */
function lateJoin(A) {
    const t = findFriend(A);
    if (t && t.zone) {
        ctx.party.beginRun(Math.max(GRID_S, (t.ex || 2000) + 190), 5.25, 0);
        afterGo(() => { warpTo(t, t.foot ? 8 : 14); if (t.foot) afterWarp(() => joinOnFoot(t), t.zone); });
    } else if (t) {
        ctx.party.beginRun(Math.max(GRID_S, t.s - (t.foot ? 10 : 22)), t.foot ? 5.25 : t.d > 3.5 ? 1.75 : 5.25, t.foot ? 0 : Math.min(25, Math.max(0, t.vs)));
        if (t.foot) afterGo(() => joinOnFoot(t));
    } else ctx.party.beginRun(GRID_S, 5.25, 0);
    ctx.party.sendEvent("in", A.id);
    setState("playing");
    H.banner(`<b>🌍 You're in!</b><small>${t ? `Right next to ${HUD.esc(nameOf(t.uid))}${t.foot ? " (they're on foot — hop out and say hi 👋)" : ""}` : "Free roam — 📱 👯 for games"}</small>`, 2600);
    tone(660, 0.12, "triangle", 0.16, 990);
}
/** The friend I joined is walking: climb out beside them (a parked car behind her, like any walk). */
function joinOnFoot(t) {
    if (!ctx.foot || !ctx.foot.start || ctx.state !== "playing" || onFoot()) return;
    try { ctx.foot.start("droveOff", { line: `There's ${nameOf(t.uid)}! 👋` }); } catch (e) { console.error("[openworld] join on foot", e); }
}
// a step that waits until a warp (a soft cut, maybe a town download) has landed her
let pendingWarp = null;
function afterWarp(fn, zoneWanted = "") { pendingWarp = { fn, at: performance.now(), zone: zoneWanted }; }
let pendingGo = null;
function afterGo(fn) { pendingGo = fn; }
/** A friend's latest place: {uid, zone, ex, s, d, vs, x, z, h, foot} (the friend whose link I opened first, then the host). */
function findFriend(A) {
    const list = members().filter(u => u !== me());
    const inv = ctx.party.inviter || "";
    const rank = u => (u === inv ? 2 : 0) + (u === ctx.party.host ? 1 : 0);
    list.sort((a, b) => rank(b) - rank(a));
    for (const u of list) {
        const p = ctx.party.peer(u);
        if (!p || !p.samples || !p.samples.length || (A && p.aid !== A.id) || p.m < 2 || p.m > 4) continue;
        const sm = p.samples[p.samples.length - 1], z = zoneOfPeer(p), foot = !!(p.x && Array.isArray(p.x.f));
        if (z) return { uid: u, zone: z, ex: (p.x && p.x.ex) || 0, x: -sm.d, z: sm.s - OFF, h: sm.yaw, s: 0, d: 0, vs: 0, foot };
        return { uid: u, zone: "", s: sm.s, d: sm.d, vs: sm.vs, x: 0, z: 0, h: 0, foot };
    }
    return null;
}

// ── warping (catch up with a friend · line up for a game) ────────────────
/** Put my car `back` metres behind `at` = {zone, x, z, h} (a town) or {zone: "", s, d} (the highway).
 *  A SOFT CUT: the place she's leaving melts into the place she lands (the frame a town takes to build hides behind it). */
function warpTo(at, back = 0) {
    const T = ctx.town, car = ctx.car;
    if (!car || onFoot()) return false;
    if (at.zone && T && !T.active && T.load && !(T.loaded ? T.loaded(at.zone) : true)) return warpNow(at, back);   // (still downloading: it cuts in when it arrives)
    return dissolve(() => warpNow(at, back));
}
function warpNow(at, back = 0) {
    const T = ctx.town, car = ctx.car;
    const done = () => {
        car.vx = car.vz = 0; car.vF = 0;
        if (ctx.cam) ctx.cam.snap();
        if (roam()) ctx.party.respawned();
        sparkle(car.pos.x, car.pos.z);
        emit("openworld:warp", { zone: at.zone || "" });
        return true;
    };
    if (at.zone) {
        if (!T || !T.enter) return false;
        if (T.active && T.id !== at.zone) T.leave("reset");
        if (!T.active) {
            const go = () => {
                if (!T.active && !T.enter({ town: at.zone, exitS: at.ex || ROAM.exitS || car.s, speed: 0 })) { H.toast("🚧 Couldn't get into town — try again", "red"); return; }
                placeInTown(at, back); done();
            };
            const p = T.load && T.load(at.zone);
            const ready = T.loaded ? T.loaded(at.zone) : !!(T.debug && T.debug.S && T.debug.S.loaded);
            if (p && p.then && !ready) { p.then(go).catch(() => { }); return true; }
            go();
            return true;
        }
        placeInTown(at, back);
        return done();
    }
    if (T && T.active) T.leave("reset");
    const s = Math.max(GRID_S, (at.s || 0) - back), d = at.d > 3.5 ? 5.25 : at.d < -3.5 ? -5.25 : at.d < 0 ? -1.75 : 1.75;
    if (roam()) ctx.party.placeCar(s, Math.abs(d) < 1 ? 1.75 : d, 0);
    else { const p = ctx.world.road.point(s, d, {}); car.place(p.x, p.z, p.h); car.s = s; car.d = d; ctx.world.prebuild(s); }
    return done();
}
function placeInTown(at, back) {
    const road = ctx.world.road, car = ctx.car;
    const n = road.nearest(at.x, at.z, null, {}), st = n.street;
    if (!st) return;
    const dir = Math.cos((at.h || 0) - st.h) >= 0 ? 1 : -1;
    let along = n.s - st.base - dir * back;
    let lo = st.a0 + 6, hi = st.a1 - 6;
    for (const ex of (ctx.town.plan && ctx.town.plan.def.exits) || []) {      // never line up in an on-ramp's mouth
        if (ex.street !== st.name) continue;
        if (ex.dir < 0) lo = Math.max(lo, ex.at + 14); else hi = Math.min(hi, ex.at - 14);
    }
    if (along < lo) along = Math.min(hi, lo + (lo - along));
    if (along > hi) along = Math.max(lo, hi - (along - hi));
    const d = dir * 1.75, p = road.point(st.base + along, d, {}), h = dir > 0 ? st.h : st.h + Math.PI;
    car.place(p.x, p.z, h);
    car.s = st.base + along; car.d = d;
}
function sparkle(x, z) { if (ctx.car && ctx.car.fx) ctx.car.fx.burst(x, 1.2, z, 26, 4, [1, 0.85, 1], 0.6, 0.9); }
/** Warp next to friend uid (the 👯 app's "Catch up"). */
function warpToFriend(uid, quiet = false) {
    const p = roam() && members().includes(uid) ? ctx.party.peer(uid) : null;
    if (!p || !p.samples || !p.samples.length) { H.toast("📶 Can't see where they are yet", "red"); return false; }
    const sm = p.samples[p.samples.length - 1], z = zoneOfPeer(p);
    const at = z ? { zone: z, ex: (p.x && p.x.ex) || 0, x: -sm.d, z: sm.s - OFF, h: sm.yaw } : { zone: "", s: sm.s, d: sm.d };
    const ok = warpTo(at, 12);
    if (ok && !quiet) { H.toast(`🚀 Caught up with ${nameOf(uid)}!`, "pink"); emit("stat", { id: "owWarps", n: 1 }); }
    return ok;
}

// ── zones: entering / leaving a town ─────────────────────────────────────
on("town:enter", e => {
    ROAM.exitS = e && e.exitS != null ? e.exitS : ctx.car.s;
    if (NP.pin && NP.pin.zone !== zone()) unpin();
    if (roam()) seedFlock();
});
/** The town's geese / pigeons where the PARTY seed says (three.js eats Math.random for every clone's uuid, so the
 *  town's own seeded build can drift between screens that cached different materials). */
function seedFlock() {
    const T = ctx.town, L = T && T.debug && T.debug.LIFE, plan = T && T.plan, spots = T && T.spots;
    if (!L || !plan || !spots || !L.geese || !L.geese.length) return;
    const FL = plan.def.flock || { spot: "lake" }, lake = spots[FL.spot];
    if (!lake || lake.z0 == null) return;
    const r = mulberry(hashStr("flock:" + T.id + ":" + ctx.party.seed));
    for (const g of L.geese) {
        const x = lake.x - 3 + r() * 6, z = lake.z0 + r() * (lake.z1 - lake.z0), h = r() * 6;
        g.x = g.home.x = x; g.z = g.home.z = z; g.h = h; g.mode = "graze"; g.t = r() * 5;
        const w = plan.world(x, z, {});
        g.obj.position.set(w.x, g.obj.position.y, w.z); g.obj.rotation.y = plan.wh(h);
    }
}
on("town:leave", e => {
    ROAM.leftExit = ROAM.exitS; ROAM.leftT = ctx.time; ROAM.exitS = null;
    clearTownTraffic();
    if (NP.pin && NP.pin.zone && !NP.pin.uid) unpin();
    if (e && e.why !== "reset") HUD.hideAll();
});

// town coins: the party shares coin pickups as "chunk k : coin i" keys; the town's chunk is k = −1
on("party:bc", ({ p, k, a }) => {
    if (k !== "k" || !roam() || !zone() || zoneOfPeer(p) !== zone() || !ctx.town.coins) return;
    for (const key of a) {
        if (typeof key !== "string" || !key.startsWith("c-1:")) continue;
        const c = ctx.town.coins[+key.slice(4)];
        if (c && !c.taken) { c.taken = true; c._pk = true; }
    }
});

// ── the game engine (solo: local state; party: the host's state inside the activity) ──
function getG() { return roam() ? ctx.party.activity.g || null : SOLO.g; }
function setG(g) { if (roam()) ctx.party.setA(Object.assign({}, ctx.party.activity, { g })); else SOLO.g = g; }
function send(kind, ...a) { if (roam()) ctx.party.sendEvent(kind, ...a); else hostEvent("me", kind, a); }
const clone = o => JSON.parse(JSON.stringify(o));

/** Host: a player's event. */
function hostEvent(uid, kind, a) {
    if (!/^ow/.test(kind)) return;
    const g = getG(), t = now();
    if (kind === "owg") {
        if (g && (g.ph === "go" || g.ph === "in")) return;
        startGame(a[0], uid, a[1]);
        return;
    }
    // an invitation: a friend opts in (came over to the spot · tapped the chip · 📱 👯) / the starter starts it now / calls it off
    if (kind === "owi" || kind === "owgo" || kind === "owx") {
        if (!g || g.ph !== "in" || (a[0] | 0) !== g.n) return;
        if (kind === "owi") { if (!g.ps.includes(uid)) { const ng = clone(g); ng.ps.push(uid); setG(ng); } }
        else if (uid === g.by) setG(kind === "owgo" ? launch(clone(g), t) : Object.assign(clone(g), { ph: "off", why: "called off", endAt: Math.round(t) }));
        return;
    }
    if (!g || g.ph !== "go" || (a[0] | 0) !== g.n || !g.ps.includes(uid)) return;
    const ng = clone(g);
    if (GAMES[g.k].event(ng, uid, kind, a, t)) setG(ng);
}
if (ctx.party && ctx.party.onHostEvent) ctx.party.onHostEvent((uid, k, a) => { if (roam() && /^ow/.test(k)) hostEvent(uid, k, a); });

function startGame(k, starter, req) {
    const G = GAMES[k];
    if (!G || !req || !req.at) return false;
    const prev = getG(), t = now();
    const mem = members();
    const n = ((prev && prev.n) || (roam() ? 0 : SOLO.n)) + 1;
    if (!roam()) SOLO.n = n;
    // With friends it's an INVITATION: the starter is in, everyone else opts in (drive / walk over to the spot, tap the
    // chip, 📱 👯 → Join) within INVITE_MS — nobody is warped, held or pulled out of what they're doing.
    if (roam() && mem.length > 1) {
        setG({ k, n, ph: "in", at: req.at, ps: [starter], by: starter, spot: req.spot || null, until: Math.round(t + INVITE_MS), req });
        return true;
    }
    const g = launch({ k, n, at: req.at, ps: [starter].concat(mem.filter(u => u !== starter)), by: starter, req }, t);
    if (g.ph === "off") { if (starter === me()) H.toast(g.why, "red"); return false; }
    setG(g);
    return true;
}
const INVITE_MS = ctx.TEST ? 45000 : 15000;   // an invitation stays open this long (or until everyone's in) — party-clock (real) ms: a crawling ?test page gets longer
const JOIN_R = 24;                 // coming this close to the spot opts you in
/** An invitation (or a solo request) → the game itself: { ph: "go", … } or { ph: "off", why }. */
function launch(g, t) {
    const G = GAMES[g.k], mem = members();
    const ps = g.ps.filter(u => mem.includes(u));
    const ng = { k: g.k, n: g.n, ph: "go", t0: Math.round(t + (roam() ? 4500 : 3200)), at: g.at, ps, by: g.by, spot: g.spot || null };
    if (ps.length < (G.min || 1)) return Object.assign(ng, { ph: "off", why: `${G.emoji} ${G.name} needs ${G.min} players — nobody else hopped in this time`, endAt: Math.round(t) });
    const why = G.setup(ng, g.req, mulberry(hashStr(g.k + ":" + g.n + ":" + t)));
    if (why) return Object.assign(ng, { ph: "off", why, endAt: Math.round(t) });
    return ng;
}
/** Opt in to the invitation that's open (once). */
function optIn(g = getG()) {
    if (!g || g.ph !== "in" || g.ps.includes(me()) || CL.optSent === g.n) return false;
    CL.optSent = g.n;
    send("owi", g.n);
    H.toast(`✅ You're in: ${GAMES[g.k].emoji} ${GAMES[g.k].name}!`, "gold");
    tone(660, 0.1, "triangle", 0.16, 990);
    emit("openworld:optin", { k: g.k, n: g.n });
    return true;
}
let hostAt = -1e9;
function hostTick(force = false) {
    const g = getG();
    if (!g || (g.ph !== "go" && g.ph !== "in")) return;
    const w = performance.now();
    if (!force && w - hostAt < 100) return;              // the end conditions at 10 Hz (a clone per check)
    hostAt = w;
    if (g.ph === "in") {                                 // the invitation closes: time's up, everyone's in, or the starter left
        const t = now(), mem = members();
        if (t >= g.until || mem.every(u => g.ps.includes(u)) || !mem.includes(g.by)) setG(launch(clone(g), t));
        return;
    }
    const t = now(), ng = clone(g);
    const r = GAMES[g.k].tick(ng, t, members());
    if (r === true) { ng.ph = "done"; ng.endAt = Math.round(t); setG(ng); }
    else if (r) setG(ng);
}

/** Why game k can't start from here right now ("" = it can). */
function blockReason(k) {
    const G = GAMES[k];
    if (!G) return "?";
    if (party() && !roam()) return "Games run in 🌍 Free Roam";
    if (!party() && !G.solo) return "Needs friends — 👯 Friends on the home screen";
    if (roam() && members().length < (G.min || 1)) return `Needs ${G.min} players — invite a friend 👯`;
    if (ctx.state !== "playing" && !(ctx.state === "footRun" && onFoot())) return "Get driving first 🚗";   // (on foot: back in the car at GO)
    if (!party() && (ctx.G.mode === "story" || ctx.G.mode === "shabbos")) return "Free drive only — try 🛣️ Cruise";
    if (!party() && ctx.law && (ctx.law.chasing || ctx.law.wanted >= 2)) return "Lose the cops first 🚓";
    if (!party() && ctx.hustle && ctx.hustle.job) return "Finish your side job first 💼";
    const g = getG();
    if (g && g.ph === "go") return `${GAMES[g.k].emoji} ${GAMES[g.k].name} is already on`;
    if (g && g.ph === "in") return `${GAMES[g.k].emoji} ${GAMES[g.k].name} is starting — join in!`;
    if (G.town && !zone()) return "Happens in town — take the exit 🏙️";
    return "";
}
/** Ask for game k (anyone: the host starts it from MY spot). → "" or the reason it didn't. */
function requestGame(k, opts = {}) {
    const why = blockReason(k);
    if (why) return why;
    const req = GAMES[k].request(X);
    if (typeof req === "string") return req;
    req.at = opts.at || here();
    if (opts.spot) req.spot = { name: String(opts.spot.name).slice(0, 30), x: +(+opts.spot.x).toFixed(1), z: +(+opts.spot.z).toFixed(1) };
    send("owg", k, req);
    return "";
}
function here() {
    const c = ctx.car, z = zone();
    if (z) { const p = clearOfJams(c.pos.x, c.pos.z, c.h); return { zone: z, ex: Math.round(ROAM.exitS || 0), x: +p.x.toFixed(1), z: +p.z.toFixed(1), h: +c.h.toFixed(3) }; }
    return { zone: "", s: +c.s.toFixed(1), d: +c.d.toFixed(2) };
}
/** A town start spot that isn't inside one of the town's forever-jams (Route 9): the line-up goes behind the jam. */
function clearOfJams(x, z, h) {
    const plan = ctx.town && ctx.town.plan, out = { x, z };
    if (!plan || !plan.def.jams) return out;
    const n = ctx.world.road.nearest(x, z, null, {}), st = n.street;
    if (!st || (st.axis !== "ns" && st.axis !== "ew")) return out;
    const dir = Math.cos(h - plan.wh(st.h)) >= 0 ? 1 : -1, along = n.s - st.base;
    for (const j of plan.def.jams) {
        if (j.street !== st.name || Math.sign(j.d) !== dir || along < j.from - 8 || along > j.to + 8) continue;
        const a = dir > 0 ? j.from - 10 : j.to + 10, d = dir * 1.75;
        const lx = st.axis === "ns" ? st.c - d : a, lz = st.axis === "ns" ? a : st.c + d;
        plan.world(lx, lz, out);
    }
    return out;
}
function endGameNow() {
    const g = getG();
    if (!g || g.ph !== "go" || !isHost()) return false;
    const ng = clone(g); ng.ph = "done"; ng.endAt = Math.round(now()); ng.cut = true;
    if (ng.k === "kugel") { ng.held[ng.it] = (ng.held[ng.it] || 0) + Math.max(0, Math.round(now() - ng.since)); ng.loser = ng.it; }
    setG(ng);
    return true;
}

// ── pins for a game (asked for on the requesting screen: it knows where it is) ──
const SPOT_NAMES = { pizza: "🍕", hall: "💍", yeshiva: "📚", chair: "🪑", lake: "🦢", welcome: "🪧", construction: "🏗️", construction2: "🏗️", band: "🎺",
    precinct: "🚓", court: "⚖️", hospital: "🏥", impound: "🚧",   // (features/places: the civic buildings)
    dealer: "🚗", makolet: "🛒",   // (features/shops: Uncle Moishe's lot, the makolet — already listed by their town signs; their icons)
    realty: "🏘️",   // (features/realestate: the realtor's office)
    cityhall: "🏛️" };   // (features/cityhall: city hall)
const SPOT_FALLBACK = { chair: "the one free parking spot", lake: "the lake (mind the geese)", welcome: "the WELCOME sign", band: "the band bus", construction: "the crane", construction2: "the other crane", cityhall: "City Hall" };
function spotName(key, plan) {
    const S = plan && plan.def && plan.def.lines && plan.def.lines.SIGNS;
    const sign = S && (S[key] || (key === "band" && S.bandBus));
    const raw = SPOT_FALLBACK[key] || (sign && sign[0]) || key;
    return raw.length > 26 ? raw.slice(0, 25) + "…" : raw;
}
/** A spot (local) moved onto the nearest street's curb lane so a car can get right up to it → world {x, z}. */
function onStreet(plan, lx, lz) {
    let best = null, bd = 1e9;
    for (const st of plan.STREETS) {
        if (st.axis !== "ns" && st.axis !== "ew") continue;          // (a diagonal avenue: skip)
        const along = st.axis === "ns" ? lz : lx, d = st.axis === "ns" ? st.c - lx : lz - st.c;
        const a = Math.max(st.a0 + 8, Math.min(st.a1 - 8, along));
        const e = (along - a) ** 2 + d * d;
        if (e < bd) { bd = e; best = { st, a, side: d >= 0 ? 1 : -1 }; }
    }
    if (!best) return null;
    const { st, a, side } = best, dd = side * 4.2;
    const x = st.axis === "ns" ? st.c - dd : a, z = st.axis === "ns" ? a : st.c + dd;
    return plan.world(x, z, {});
}
/** Named places in this town (world, on the street): [{x, z, name, icon, key}]. */
function townSights() {
    const T = ctx.town, plan = T && T.plan, spots = T && T.spots;
    if (!plan || !spots) return [];
    const out = [];
    for (const key of Object.keys(spots)) {
        const sp = spots[key];
        if (sp == null || sp.x == null) continue;
        const S = plan.def.lines && plan.def.lines.SIGNS;
        if (!SPOT_NAMES[key] && !(S && Array.isArray(S[key]))) continue;            // (internal spots: the jam, the hazards…)
        const p = onStreet(plan, sp.x, sp.z);
        if (p) out.push({ x: +p.x.toFixed(1), z: +p.z.toFixed(1), name: spotName(key, plan), icon: SPOT_NAMES[key] || "📍", key });
    }
    return out;
}
function streetCorners() {
    const T = ctx.town, plan = T && T.plan;
    if (!plan) return [];
    return plan.NODES.filter(n => !n.circle && plan.STREETS[n.ns] && plan.STREETS[n.ew]).map(n => ({ ...plan.world(n.x + 4, n.z + 4, {}), name: `${plan.STREETS[n.ns].name} & ${plan.STREETS[n.ew].name}`, icon: "🚦" }));
}
/** Pins at least minD metres from here: town sights first (then corners); the highway: up the road. */
function pins(minD, n, sightsOnly = false) {
    const c = ctx.car.pos;
    const far = p => Math.hypot(p.x - c.x, p.z - c.z);
    if (zone()) {
        let list = townSights().filter(p => far(p) >= minD).sort((a, b) => far(b) - far(a));
        if (!sightsOnly && list.length < n) list = list.concat(streetCorners().filter(p => far(p) >= Math.max(minD, 120)).sort((a, b) => far(b) - far(a)).slice(0, n - list.length));
        return list.slice(0, n).map(({ x, z, name, icon }) => ({ x, z, name, icon }));
    }
    if (sightsOnly) return [];
    const road = ctx.world.road, out = [];
    for (const [k, nm] of [[1150, "the next mile marker"], [1450, "the lay-by up the road"], [950, "the big green sign"]].slice(0, n)) {
        const p = road.point(ctx.car.s + k, 9.5, {});
        out.push({ x: +p.x.toFixed(1), z: +p.z.toFixed(1), name: nm, icon: "🚩" });
    }
    return out;
}

// the helpers a game's rules get (games.js)
const CL = { key: "", n: -1, L: null, res: "", last: null, lastRows: null, props: new Map(), sirens: new Map(), goShown: "", warped: "" };
const X = {
    pos: uid => posOf(uid), touching, pins, inTown: () => !!zone(), name: nameOf, ord,
    send: (k, ...a) => send(k, ...a),
    get L() { return CL.L; },
    speed: () => (ctx.car ? Math.hypot(ctx.car.vx, ctx.car.vz) : 0),
    banner: (h, ms) => H.banner(h, ms, { key: "ow", prio: 2 }),
    fanfare() { tone(523, 0.12, "triangle", 0.2); tone(659, 0.14, "triangle", 0.2, 0, 0.12); tone(784, 0.2, "triangle", 0.2, 0, 0.24); rumble(0.3, 0.6, 220, true); },
    burst() { const c = ctx.car; for (let i = 0; i < 3; i++) c.fx.burst(c.pos.x, 1.6, c.pos.z, 18, 6, [[1, 0.3, 0.55], [1, 0.85, 0.2], [0.3, 0.75, 1]][i], 0.5, 1.2); },
    siren() { AU.sfxSiren(0.9); rumble(0.6, 0.8, 260, true); },
    snap(s) {
        H.flash();
        tone(1800, 0.04, "square", 0.12); tone(900, 0.08, "square", 0.1, 0, 0.05);
        H.banner(`<b>📸 SNAP! ${HUD.esc(s.icon || "")} ${HUD.esc(s.name)}</b><small>${pick(SNAP_LINES)}</small>`, 2000, { key: "ow", prio: 2 });
        SAVE.snaps++; saveSoon();
        emit("stat", { id: "owSnaps", n: 1 });
    },
};
const SNAP_LINES = ["For the group chat.", "Bubbe will want a print.", "That's going on the fridge.", "Ugh, my eyes were closed. Good enough.", "Influencer behaviour."];
const pick = a => a[Math.floor(Math.random() * a.length)];

/** Every rAF (paused or not): the host's clock checks, entering / leaving games, results, markers. */
function tickGames() {
    if (!ctx.car || ctx.state === "loading") return;
    if (isHost() && (roam() || SOLO.g)) hostTick();
    const g = getG();
    const src = roam() ? "p:" + ctx.party.code : "s";
    if (!g) { if (CL.n !== -1) leaveGame(); return; }
    const key = src + ":" + g.n + (g.ph === "in" ? "i" : g.ph === "off" ? "x" : "");
    if (key !== CL.key) enterGame(g, key);
    const t = now(), mine = g.ps.includes(me());
    // an open invitation from a game spot: walking / driving up to the spot opts me in (one from the phone: the chip / 📱 only)
    if (g.ph === "in") {
        if (roam() && !mine && g.spot && (g.at.zone || "") === zone() && (ctx.state === "playing" || ctx.state === "footRun")) {
            const sp = invitePos(g), lp = onFoot() && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos;
            if (sp && Math.hypot(lp.x - sp.x, lp.z - sp.z) < JOIN_R) optIn(g);
        }
        markers(g, t);
        return;
    }
    // the 3-2-1 (it shows over a paused game too: the party never stops)
    if (g.ph === "go" && mine && t < g.t0 && ctx.state === "playing" && g.at.zone === zone()) {
        const G = GAMES[g.k], n = Math.ceil((g.t0 - t) / 1000);
        HUD.count(`${G.emoji} ${G.name.toUpperCase()}`, n > 3 ? "…" : n, roleLine(g));
        if (n <= 3 && CL.lastCount !== n) { CL.lastCount = n; tone(440, 0.12, "square", 0.16); rumble(0.1, 0.2, 80); }
    } else HUD.count(null);
    if (g.ph === "go" && mine && t >= g.t0 && CL.goShown !== key) {
        CL.goShown = key;
        H.banner(`<b>GO!</b><small>${roleLine(g)}</small>`, 1600, { key: "ow", prio: 3 });
        tone(660, 0.18, "triangle", 0.2, 990); rumble(0.3, 0.6, 200, true);
    }
    if (g.ph === "done" && CL.res !== key) { CL.res = key; finishGame(g); }
    // a player who ended up in another zone mid-game (an on-ramp, a scene that sent her back to the highway): back in
    if (g.ph === "go" && mine && roam() && t > g.t0 && (g.at.zone || "") !== zone() && ctx.state === "playing" && !ctx.paused) {
        CL.away = (CL.away || 0) + 1;
        if (CL.away > 45 && performance.now() - (CL.backAt || 0) > 4000) { CL.backAt = performance.now(); CL.away = 0; if (warpToGame()) H.toast(`🚀 Back to the ${GAMES[g.k].name}!`, "pink"); }
    } else CL.away = 0;
    markers(g, t);
}
function roleLine(g) {
    const u = me();
    if (g.k === "cnr") return u === g.cop ? "🚓 You're the COP — 5 s head start for them, then bump them!" : `💰 You've got the stash — get it to Uncle Moishe's van! (${HUD.esc(nameOf(g.cop))} is the cop)`;
    if (g.k === "kugel") return g.it === u ? "🥘 YOU start with the hot kugel — bump someone!" : `🥘 ${HUD.esc(nameOf(g.it))} has the hot kugel — scatter!`;
    if (g.k === "pin") return `📍 First to ${HUD.esc(g.pin.name)}!`;
    if (g.k === "photo") return `📸 Stop at ${g.spots.length} sights to snap them`;
    return "";
}
function enterGame(g, key) {
    CL.key = key; CL.n = g.n; CL.lastCount = null;
    CL.L = { fin: false, claimed: {}, snap: {}, passed: -1 };
    const G = GAMES[g.k];
    if (g.ph === "in") {
        if (g.by !== me()) {
            H.toast(`🎮 ${nameOf(g.by)} is starting ${G.emoji} ${G.name}${g.spot ? " at " + g.spot.name : ""} — come over to join!`, "pink", { key: "owinv" });
            tone(523, 0.08, "triangle", 0.12); tone(784, 0.12, "triangle", 0.12, 0, 0.09);
        } else H.toast(`🎮 ${G.emoji} ${G.name}: friends nearby can hop in — starts in ${Math.round(INVITE_MS / 1000)} s`, "pink", { key: "owinv" });
        return;
    }
    if (g.ph === "off") {
        if (g.ps.includes(me())) H.toast(g.why || "Called off", "red", { key: "owinv" });
        hideBeacons("g:"); HUD.hideAll();
        return;
    }
    if (g.ph !== "go") return;
    const mine = g.ps.includes(me()), t = now();
    if (!mine) { if (roam()) H.toast(`${G.emoji} ${G.name} started without you — catch the next one!`, ""); return; }
    if (onFoot() && ctx.state === "footRun") backInCar();          // (opted in on foot: the car's back under her for GO)
    if (ctx.phone && ctx.phone.isOpen && ctx.phone.closePhone) { try { ctx.phone.closePhone(); } catch (e) { /* fine */ } }
    if (riding()) stopRide(true);
    if (roam() && t < g.t0 + 1500 && CL.warped !== key) {
        CL.warped = key;
        const i = g.ps.indexOf(me()), cop = g.k === "cnr" && g.cop === me();
        const back = g.ps[0] === me() && !cop ? 0 : (i + (cop ? 2 : 0)) * 9;
        const far = !posNear(g.at, back);
        if (far) warpTo(g.at, back);
    }
    emit("openworld:start", { k: g.k, n: g.n });
    emit("stat", { id: "owGames", n: 1 });
}
/** Where an invitation is: the spot it was started from, else the starter. */
function invitePos(g) { return g.spot ? { x: g.spot.x, z: g.spot.z } : posOf(g.by); }
/** Off her feet and back behind the wheel (a game she opted into on foot is about to start). */
function backInCar() {
    try {
        const pk = ctx.foot.parkedCar, p = ctx.foot.pos;
        if (pk && !pk.wrecked && pk.key === "lulu") ctx.foot.drive({ own: true, x: pk.x, z: pk.z, h: pk.h });
        else ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 });
    } catch (e) { console.error("[openworld] back in car", e); }
}
/** Back to the game I'm in (it moved to another zone without me). */
function warpToGame() {
    const g = getG();
    if (!g || g.ph !== "go" || !g.ps.includes(me())) return false;
    return warpTo(g.at, (g.ps.indexOf(me()) + 1) * 9);
}
/** Am I already roughly at slot `back` behind `at` (no need to warp)? */
function posNear(at, back) {
    if ((at.zone || "") !== zone()) return false;
    const c = ctx.car;
    if (at.zone) return back === 0 && Math.hypot(c.pos.x - at.x, c.pos.z - at.z) < 6;
    return Math.abs(c.s - (at.s - back)) < 6 && Math.abs(c.d - at.d) < 3;
}
function leaveGame() {
    CL.key = ""; CL.n = -1; CL.L = null;
    HUD.hideAll();
    hideBeacons("g:");
    for (const [, pr] of CL.props) pr.g.visible = false;
    stopSirens();
}
function finishGame(g) {
    const G = GAMES[g.k];
    const rows = G.rows(g, X), mine = g.ps.includes(me());
    CL.last = clone(g); CL.lastRows = rows.map(r => Object.assign({}, r, { name: nameOf(r.uid), hex: r.uid === "me" ? "#E91E63" : skinHex(r.uid) }));
    CL.lastTitle = G.title(g, me(), rows, X);
    HUD.hideAll();
    hideBeacons("g:");
    stopSirens();
    if (g.k === "kugel" && g.loser) {
        const p = posOf(g.loser);
        if (p) for (let i = 0; i < 4; i++) ctx.car.fx.burst(p.x, 1.8, p.z, 26, 7, [[1, 0.55, 0.1], [1, 0.85, 0.3], [0.95, 0.75, 0.4], [1, 1, 1]][i], 0.6, 1.4);
        tone(90, 0.5, "sawtooth", 0.22, 40); rumble(0.9, 1, 500, true);
    }
    if (!mine) { H.toast(`${G.emoji} ${CL.lastTitle.replace(/<[^>]+>/g, "")}`, "gold"); return; }
    const won = winners(g).includes(me());
    SAVE.games++;
    if (won) { SAVE.wins++; emit("stat", { id: "owWins", n: 1 }); if (g.ps.length > 1) addCoins(20, "openworld"); }
    if (g.k === "pin" && g.ps.length === 1 && g.fin[me()] != null) {
        const ms = g.fin[me()] - g.t0, k = g.pin.name, best = SAVE.best[k];
        CL.lastBest = best;
        if (!best || ms < best) { SAVE.best[k] = ms; CL.newBest = true; addCoins(5, "openworld"); } else CL.newBest = false;
    } else CL.newBest = false;
    if (g.k === "cnr") emit("stat", { id: g.cop === me() ? "owBusts" : "owStashes", n: g.cop === me() ? Object.values(g.out).filter(x => x === "b").length : g.out[me()] === "d" ? 1 : 0 });
    saveSoon();
    if (won) X.fanfare(); else tone(392, 0.2, "triangle", 0.16, 330);
    showResults();
}
function showResults() {
    const app = roam() ? "owparty" : "nearby";
    const ok = ctx.phone && ctx.phone.openPhone && ctx.state === "playing" && ctx.phone.openPhone(app, { results: true });
    if (!ok) H.banner(`<b>${CL.lastTitle}</b><small>📱 ${roam() ? "👯 Party" : "📍 Nearby"} for the scoreboard + rematch</small>`, 4200, { key: "ow", prio: 2 });
}

// ── markers: beacons + roof props + the cop's siren ──────────────────────
function markers(g, t) {
    const here = (g.at.zone || "") === zone() && !ctx.view;
    const live = g.ph === "go" && here;
    if (g.ph === "in") {                                  // the invitation: a gold beacon over the spot
        const p = here && invitePos(g);
        if (p) beacon("g:inv", p.x, p.z, "#FFD54F", 3.6); else hideBeacons("g:");
        tickProps(ctx.time, []);
        return;
    }
    if (!live) hideBeacons("g:");
    else if (g.k === "pin") beacon("g:pin", g.pin.x, g.pin.z, "#FFD54F", 4);
    else if (g.k === "cnr") beacon("g:drop", g.drop.x, g.drop.z, "#66BB6A", 4.5);
    else if (g.k === "photo") g.spots.forEach((s, i) => { const done = (CL.L && CL.L.snap[i]) || (g.got[i] || []).includes(me()); if (done) hideBeacon("g:ph" + i); else beacon("g:ph" + i, s.x, s.z, "#F06292", 3.2, 22); });
    // roof props: who's the cop / who has the kugel / who still carries the stash
    const want = new Map();
    if (live && t >= g.t0 - 4000) {
        if (g.k === "cnr") for (const u of g.ps) { if (u === g.cop) want.set(u, "cop"); else if (!g.out[u]) want.set(u, "stash"); }
        if (g.k === "kugel") want.set(g.it, "kugel");
    }
    const list = [];
    for (const [uid, kind] of want) {
        const host = uid === me() ? ctx.car.tilt : (() => { const rc = roam() && ctx.party.remoteCar(uid); return rc && rc.shown ? rc.v.tilt : null; })();
        if (!host) continue;
        const k = uid + ":" + kind;
        let pr = CL.props.get(k);
        if (!pr) { pr = { g: roofProp(kind), kind, uid }; CL.props.set(k, pr); }
        if (pr.g.parent !== host) host.add(pr.g);
        pr.g.visible = true;
        list.push(pr.g);
        if (kind === "cop" && uid !== me()) siren(uid, pr.g);
    }
    for (const pr of CL.props.values()) if (want.get(pr.uid) !== pr.kind) { pr.g.visible = false; if (pr.kind === "cop") stopSiren(pr.uid); }
    tickProps(ctx.time, list);
}
function siren(uid, obj) {
    if (CL.sirens.has(uid)) return;
    const sp = AU.spatial;
    const h = sp && sp.ready ? sp.loop("siren", obj, { gain: 0.7 }) : null;
    CL.sirens.set(uid, h);
}
function stopSiren(uid) { const h = CL.sirens.get(uid); if (h) { try { h.stop(); } catch (e) { /* gone */ } } CL.sirens.delete(uid); }
function stopSirens() { for (const uid of [...CL.sirens.keys()]) stopSiren(uid); }
function decorateFriend(rc, p) { rc.noBonk = p.uid === riding(); }

// ── per driving frame: my claims, the town's party traffic, the solo clock ──
hook("update", (dt, P, controlsOn) => {
    if (!roam()) SOLO.ms += dt * 1000;
    if (roam() && zone() && ctx.town.plan) syncTownTraffic(zone(), ctx.town.plan, ctx.party.seed >>> 0);
    if (pendingGo && ctx.state === "playing") { const f = pendingGo; pendingGo = null; try { f(); } catch (e) { console.error("[openworld] go", e); } }
    else if (pendingWarp && ctx.state === "playing" && performance.now() - pendingWarp.at > 700) {
        const w = pendingWarp, landed = zone() === (w.zone || "");
        if (landed || performance.now() - w.at > 30000) { pendingWarp = null; if (landed) { try { w.fn(); } catch (e) { console.error("[openworld] after warp", e); } } }
    }
    const g = getG();
    if (g && g.ph === "go" && CL.L && g.ps.includes(me()) && ctx.state === "playing" && (g.at.zone || "") === zone()) {
        try { GAMES[g.k].play(g, me(), now(), X); } catch (e) { console.error("[openworld] play", e); }
    }
    pinTick(dt);
}, 30);

// hold the car on the line during the 3-2-1 (and the cop for the robbers' head start)
hook("controls", ctl => {
    const g = getG();
    if (!g || g.ph !== "go" || !g.ps.includes(me()) || ctx.state !== "playing") return;
    const t = now(), until = g.k === "cnr" && g.cop === me() ? g.copGo : g.t0;
    if (t < until) { ctl.throttle = 0; ctl.brake = 1; ctl.handbrake = false; }
});

// the objective chip + score list (5×/s), the arrow every frame
let hudT = 0;
hook("hud", dt => {
    const car = ctx.car;
    HUD.arrowTick(onFoot() && ctx.foot.pos ? ctx.foot.pos : car.pos);
    hudT -= dt;
    if (hudT > 0) return;
    hudT = 0.2;
    if (ctx.paused) return;
    const g = getG(), t = now();
    if (g && g.ph === "in") {
        const G = GAMES[g.k], left = Math.max(0, Math.ceil((g.until - t) / 1000)), mine = g.ps.includes(me());
        const where = g.spot ? ` at ${HUD.esc(g.spot.name)}` : "", sp = (g.at.zone || "") === zone() ? invitePos(g) : null;
        if (mine) HUD.chip(`✅ ${G.emoji} ${HUD.esc(G.name)}${where} · ${g.ps.length} in · starts in <b>${left}</b>${g.by === me() && g.ps.length >= (G.min || 1) ? ` · ${input.device === "touch" ? "tap" : "📱"} to start now` : ""}`, "green", g.by === me() ? null : sp, g.by === me() ? () => send("owgo", g.n) : null);
        else HUD.chip(`🎮 ${HUD.esc(nameOf(g.by))}: ${G.emoji} ${HUD.esc(G.name)}${where} · ${left} s — <b>${input.device === "touch" ? "tap to join" : sp ? "come over or 📱 to join" : "📱 👯 to join"}</b>`, "gold", sp, () => optIn(g));
        HUD.board("");
        return;
    }
    if (g && g.ph === "go" && CL.L && (g.at.zone || "") === zone()) {
        if (!g.ps.includes(me())) { HUD.chip(`👀 ${GAMES[g.k].emoji} ${GAMES[g.k].name} is on — you're in the next one`, ""); HUD.board(""); return; }
        if (t < g.t0) { HUD.chip(""); HUD.board(""); return; }
        const h = GAMES[g.k].hud(g, me(), t, X);
        HUD.chip(h.chip, h.cls, h.to);
        HUD.board(g.ps.length > 1 ? boardHtml(g, h) : "");
        return;
    }
    if (g && g.ph === "go" && (g.at.zone || "") !== zone() && g.ps.includes(me())) { HUD.chip(`${GAMES[g.k].emoji} ${GAMES[g.k].name} is on ${g.at.zone ? "in town" : "on the highway"} — 📱 👯 to warp back`, ""); HUD.board(""); return; }
    if (NP.pin) { const p = pinPos(); HUD.chip(`${HUD.esc(NP.pin.icon || "📍")} ${HUD.esc(NP.pin.name)}`, "", p); HUD.board(""); return; }
    HUD.chip(""); HUD.board("");
});
function boardHtml(g, h) {
    const G = GAMES[g.k], u = me();
    return `<div class="t">${G.emoji} ${G.name.toUpperCase()}</div>` + h.rows.slice(0, 8).map(r =>
        `<div class="r${r.uid === u ? " me" : ""}${r.out ? " out" : ""}"><i style="background:${r.uid === "me" ? "#E91E63" : skinHex(r.uid)}"></i><span class="n">${HUD.esc(nameOf(r.uid))}</span><span class="v">${h.unit(r)}</span></div>`).join("");
}

// ── 📍 the Nearby pin (solo or party): a beacon + the chip, until you get there ──
const NP = { pin: null };
function pin(def) {
    if (!def || def.x == null) return false;
    const lp = onFoot() && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos;
    if (!def.uid && Math.hypot(lp.x - def.x, lp.z - def.z) < 15) { H.toast(`📍 ${def.name} is right here!`, "pink"); return true; }
    NP.pin = Object.assign({ zone: zone() }, def);
    SAVE.pins++; saveSoon();
    const p = pinPos();
    if (p) beacon("np", p.x, p.z, "#4FC3F7", 3.4);
    tone(880, 0.08, "triangle", 0.14, 1320);
    return true;
}
function unpin() { NP.pin = null; hideBeacon("np"); }
function pinPos() {
    const pn = NP.pin;
    if (!pn) return null;
    if (pn.uid) return posOf(pn.uid);
    return { x: pn.x, z: pn.z };
}
function pinTick() {
    const pn = NP.pin;
    if (!pn) return;
    if (pn.uid && !members().includes(pn.uid)) { unpin(); return; }
    const p = pinPos();
    if (!p || (pn.zone || "") !== zone() && !pn.uid) { hideBeacon("np"); return; }
    beacon("np", p.x, p.z, "#4FC3F7", 3.4);
    const lp = onFoot() && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos;
    if (Math.hypot(lp.x - p.x, lp.z - p.z) < (pn.uid ? 9 : 15)) {
        H.toast(`📍 You're here: ${pn.name}${pn.talk && !onFoot() ? " — hop out to talk" : ""}`, "pink");
        tone(660, 0.1, "triangle", 0.14, 990);
        unpin();
    }
}

// ── lifecycle ────────────────────────────────────────────────────────────
on("run:start", () => { SOLO.g = null; if (!party()) { unpin(); leaveGame(); } });
on("title", () => { SOLO.g = null; unpin(); leaveGame(); clearTownTraffic(); });
on("party:status", e => { if (e && e.want === false) { stopRide(true); leaveGame(); clearTownTraffic(); CL.last = null; } });
on("state", ({ to }) => { if (to !== "playing" && to !== "footRun" && to !== "playPhoto") HUD.hideAll(); });

let lastW = 0;
function frame() {
    requestAnimationFrame(frame);
    const w = performance.now(), dt = lastW ? Math.min(0.1, (w - lastW) / 1000) : 1 / 60;
    lastW = w;
    try { tickGames(); if (party()) tickSeats(dt); } catch (e) { console.error("[openworld] frame", e); }
}
requestAnimationFrame(frame);

// ── the service ──────────────────────────────────────────────────────────
const E = {
    roam, party, me, now, zone, members, nameOf, skinHex, posOf, isHost, getG, requestGame, blockReason, endGameNow, optIn, invitePos, send,
    warpToFriend, warpToGame, startRide, stopRide, riding, setRide(uid) { if (uid) ROAM.extra.rd = uid; else delete ROAM.extra.rd; }, pin, unpin, get pinned() { return NP.pin; }, townSights, findFriend, zoneOfPeer, GAMES, ORDER, CL, SAVE,
    fmtRace: HUD.fmtRace,
};
registerApps(E);
on("boot", () => initSpots(E));
initRide(E);
ctx.openworld = {
    /** Towns in a 🎉 party: only while the party free-roams (town/index.js asks). */
    partyTowns: () => roam(),
    seeded,
    get zone() { return zone(); },
    get game() { const g = getG(); return g ? clone(g) : null; },
    start: (k, opts) => requestGame(k, opts),
    /** Opt in to the game invitation that's open (→ true when sent). */
    join: () => optIn(),
    end: () => endGameNow(),
    warpTo: uid => warpToFriend(uid),
    /** 🚗 Ride along in friend uid's passenger seat ("" or why not) · hop out. */
    ride: uid => startRide(uid),
    hopOut: opts => stopRide(false, opts || {}),
    get riding() { return riding(); },
    pin, unpin, get pinned() { return NP.pin; },
    /** A party town's block loops, read-only (community runs its org cars on them): { loops, origin, point(L, u, out) } | null. */
    /** world(local {x, z, h}) → the same pose in world coords (in place): the town can stand turned at its interchange */
    townLoops: () => (TT.plan && TT.loops.length ? { loops: TT.loops, world: o => { const h = o.h; TT.plan.world(o.x, o.z, o); if (h != null) o.h = TT.plan.wh(h); return o; }, point: loopPoint, town: TT.town } : null),
    debug: {
        CL, SOLO, NP, TT, townCarsAt, townLive, townClaims, beaconCount, sights: townSights, pins, hostTick, getG, here,
        /** tests: claim a game event as me (exactly what play() would send). */
        claim: (k, ...a) => send(k, ...a),
        touching, posOf, spots: spotsDebug,
    },
};
