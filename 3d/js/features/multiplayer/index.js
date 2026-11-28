// features/multiplayer — 🌐 SHARED ROAD (port of src/10f-multiplayer.js).
//
// 2D and 3D players on the SAME relay (protocol v1, MULTIPLAYER.md): ghosts with
// nametags (3D: translucent cars in their skin colour / walking Lulus), honks +
// waves + the six emotes, curated rider names, the EVERYONE lobby and 4-letter
// FRIEND rooms (switch without disconnecting), FRIEND RACES to 200k, TAG, BONK!,
// SLIPSTREAM (+8%), CONVOY (×1.5 score), party record toasts, the daily
// leaderboard + wanted posters board, and PARTY PARKING (a friend room shares
// one seeded lot; members' cars appear as ghosts in it).
//
// Files: net.js (protocol, party logic, the 2D↔3D scale) · ghosts.js (3D ghosts)
//        ui.js (screen, HUD chips, overlay, emote wheel).
//
// Service ctx.mp: { open(from), connect(room), disconnect(), emote(idx), connected, riders,
//   parkingRng(), parkingSpotIndex(), parkingGhosts(), postWanted(charges), wantedList(), scoresList() }
// Events emitted: mp:status, mp:riders, mp:race, mp:honk, stat {mpEmotes, mpRaceWins, mpBonks}
// Consumed: run:start (cruise auto-join), run:end (daily score), honk, arrest / law:arrest / jail (wanted board)
import * as THREE from "three";
import { ctx, on, emit, hook, addMenuItem } from "../../core/ctx.js";
import { save3d, shared } from "../../core/save.js";
import { startRun } from "../../core/driving.js";
import { addTouchButton, input, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { showTitle } from "../../core/screens.js";
import * as N from "./net.js";
import * as WC from "./worldclock.js";
import { MP, DI_PER_M, X_PER_M, X_MID } from "./net.js";
import { updateGhosts, clearGhosts, ghostStats, ghostAt, tagOnScreen } from "./ghosts.js";
import * as U from "./ui.js";
import { tone } from "../parking/sfx.js";

const tmp = {};

// ── the service other features (and parking) use ─────────────────────────
ctx.mp = {
    open: from => U.openSharedRoad(from),
    connect: (room = "lobby") => N.connect(room, room === "lobby" ? "everyone" : "friend"),
    disconnect: () => N.disconnect(true),
    emote: idx => N.sendEmote(idx),
    get connected() { return MP.connected; },
    get riders() { return N.riderCount(); },
    get room() { return MP.roomKind === "place" ? "lobby" : MP.room; },   // (🌍 a place room is "the everyone world" to the rest of the game)
    get placeRoom() { return MP.roomKind === "place" ? MP.room : null; },
    parkingRng: N.parkingRng,
    parkingSpotIndex: N.parkingSpotIndex,
    parkingGhosts: N.parkingGhosts,
    postWanted: N.postWanted,
    wantedList: N.wantedList,
    scoresList: N.scoresList,
    _debug: MP,
};

// ── where am I? (driving, walking or parking) ───────────────────────────
function footPos() {
    const f = ctx.foot;
    if (!f) return null;
    const p = f.pos || (f.obj && f.obj.position) || (f.person && f.person.obj && f.person.obj.position) || (f.lulu && (f.lulu.position || (f.lulu.obj && f.lulu.obj.position)));
    return p && typeof p.x === "number" ? p : null;
}
const me = { s: 0, d: 0, sp: 0, foot: false, driving: false, sending: false, hidden: false, inWorld: false, vk: "car",
    zone: "", lx: 0, lz: 0, h: 0, w: null };
const r1 = v => Math.round(v * 10) / 10;
function myPose() {
    const car = ctx.car;
    const def = ctx.states[ctx.state] || {};
    const foot = !!(ctx.foot && ctx.foot.active);
    // out in the open world (a road, a town, on foot outside) — anywhere else (indoors, a scene, a menu, Dina's
    // mode) she's "~": hidden from everyone, ghosts hidden from her, the horn / emotes don't go out
    // (a 🎉 party: only its 🌍 Free Roam is the open world — a race / dash / tag / road trip keeps strangers out)
    const pa = ctx.party && ctx.party.active ? ctx.party : null;
    const partyBusy = !!pa && !(pa.activity && pa.activity.k === "roam");
    me.inWorld = (!!def.driving || ctx.state === "footRun") && !partyBusy;
    // inside a PUBLIC room (a shop, the bank, the terminal, the lanes… — together/rooms.js › publicRoom; never a house,
    // never Ima's) she stays online: her spot in the room rides along as d.in, and nobody draws her out on the street
    const pr = !partyBusy && ctx.state === "interior" && ctx.together && ctx.together.publicRoom ? ctx.together.publicRoom() : null;
    me.in = pr ? [pr.id, pr.inst, pr.x, pr.z, pr.h, pr.bits] : null;
    me.pt = pa && pa.code ? N.partyTag(pa.code) : null;
    me.foot = foot;
    me.driving = !!def.driving && !foot;
    me.parking = ctx.state === "parking";
    me.sending = (me.inWorld && !ctx.view) || me.parking || !!me.in;
    me.hidden = !me.sending;
    me.s = car ? car.s : 0; me.d = car ? car.d : 0; me.sp = car ? car.speed : 0;
    const T = ctx.town, inTown = !!(T && T.active && T.plan);
    let wx = car ? car.pos.x : 0, wz = car ? car.pos.z : 0, yaw = car ? car.h : 0;
    if (me.in && me.outAt) { wx = me.outAt.x; wz = me.outAt.z; }
    if (foot) {
        const fp = footPos();
        if (fp) { wx = fp.x; wz = fp.z; }
        const fv = ctx.foot.vel;
        me.sp = fv ? Math.hypot(fv.x, fv.z) : typeof ctx.foot.speed === "number" ? ctx.foot.speed : 1.3;
        if (typeof ctx.foot.facing === "number") yaw = ctx.foot.facing;
        if (fp && ctx.world && !inTown) {
            const n = ctx.world.road.nearest(fp.x, fp.z, car.s, tmp);
            me.s = n.s; me.d = n.d;
        }
    }
    if (me.parking || me.in) me.sp = 0;
    if (me.inWorld) me.outAt = { x: wx, z: wz };       // (the last spot outside: where she's "standing" while in a room)
    me.zone = !me.sending || me.parking ? "~" : inTown ? String(T.id || "") : "";
    if (me.zone === "" && ctx.world) {
        // the highway: road distance + offset + heading relative to the road (riders' roads can bend differently)
        ctx.world.road.point(me.s, 0, tmp);
        me.h = yaw - tmp.h;
        me.w = ["", r1(me.s), r1(me.d), Math.round(Math.atan2(Math.sin(me.h), Math.cos(me.h)) * 100) / 100];
    } else if (inTown && me.zone !== "~") {
        const O = T.plan.ORIGIN;
        me.lx = wx - O.x; me.lz = wz - O.z; me.h = yaw;
        me.w = [me.zone, r1(me.lx), r1(me.lz), Math.round(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * 100) / 100];
        // a 2D rider sees a 3D rider in town as parked by that town's exit
        me.s = T.highwayS || me.s; me.d = 9; me.sp = 0;
    } else me.w = ["~", 0, 0, 0];
    const veh = ctx.foot && ctx.foot.vehicle;   // a borrowed ride, if the foot feature exposes one
    if (!foot && veh && veh.kind) { me.vk = "borrowed"; me.ct = veh.ct || 0; me.co = veh.color || "#E53935"; }
    else me.vk = (ctx.G && ctx.G.vehicleKind) || "car";
    // her look, so everyone sees her the way friends do (stage 3, "no ghosts"): hair colour + the outfit's compact
    // form (features/clothes) — read every couple of seconds, not per frame
    if (!me.lookAt || performance.now() - me.lookAt > 2000) {
        me.lookAt = performance.now();
        const s2 = shared.get();
        me.hc = typeof s2.luluHair === "string" && /^#[0-9a-fA-F]{6}$/.test(s2.luluHair) ? s2.luluHair : null;
        let ot = null;
        try { if (ctx.clothes && ctx.clothes.encode) { const o = ctx.clothes.encode(ctx.clothes.current()); ot = /[^,]/.test(o) ? o : null; } } catch (e) { ot = null; }
        me.ot = ot;
    }
    return me;
}

// ── the tick: our own rAF (runs every frame, before the game loop) ───────
let lastT = -1;
function frame() {
    requestAnimationFrame(frame);
    if (!ctx.car || ctx.state === "loading") return;
    const now = ctx.time;
    const dt = lastT < 0 ? 0 : Math.min(0.1, Math.max(0, now - lastT));
    lastT = now;
    if (dt <= 0) return;
    try {
        myPose();
        ambientTick(dt);
        N.tick(dt, me);
        const inRun = me.inWorld;
        updateGhosts(dt, me, inRun && !ctx.view);
        U.overlayTick();
        U.uiTick();
        // the emote wheel / 1–7 keys / 😀 button only while someone is actually around (or in a friend room): alone
        // on the road, the horn is just a horn
        // (in a 🎉 party the party's own wheel is the emote system — strangers just see your ghost)
        const social = !(ctx.party && ctx.party.active) && (N.friendRoom() || Object.values(MP.peers).some(p => p.onScreen));
        me.social = social;
        U.wheelTick(dt, inRun && social && !ctx.paused && !ctx.dialogOpen);
        U.setKeyInRun(inRun && social && !ctx.paused);
        titleRefresh();
    } catch (e) { console.error("[mp] frame", e); }
}
requestAnimationFrame(frame);

// live title card (crew joins / leaves, today's riders)
let titleKey = "";
function titleRefresh() {
    if (ctx.state !== "title" || !H.screenOpen() || !document.querySelector("#screenCard .logo")) return;
    const key = (MP.connected ? "c" : MP.want ? "w" : "o") + N.riderCount() + "|" + Object.values(MP.peers).map(p => p.name).join(",") + "|" + (MP.scoresCache.ok ? MP.scoresCache.data.length : -1);
    if (key !== titleKey) { if (titleKey) showTitle(true); titleKey = key; }
}

// ── party mechanics while driving (friend rooms) ─────────────────────────
let prevScore = 0, honkCd = 0;
// 🚗 Everyone follows the same bump rule (stage 3, "no ghosts"): two players' cars that touch get ONE harmless bounce
// (sparks + a thunk, never a heart, a coin or a star), then that player drives THROUGH her for a moment — so nobody can
// pin, drag, shove or trap anyone: a second bounce from the same player waits SB.PER s, and any bounce at all waits
// SB.ANY s. Judged on my own screen, on where I see her (ghosts.js: p.ws / p.wd, only while she's drawn).
const SB = { R: 2.3, PER: 2.5, ANY: 1.0, PUSH: 3.0 };
let sbAny = 0;
function strangerBump(p, car, dt) {
    if (p.m !== 0 || !p.onScreen || typeof p.ws !== "number" || ctx.foot && ctx.foot.active) { p.bonkOverlap = false; return; }
    const dx = car.pos.x - p.ws, dz = car.pos.z - p.wd, d = Math.hypot(dx, dz);
    const overlap = d < SB.R;
    if (overlap && !p.bonkOverlap && !(p.bonkCd > 0) && !(sbAny > 0) && d > 1e-3) {
        const nx = dx / d, nz = dz / d, side = nx * -Math.cos(car.h) + nz * Math.sin(car.h);
        car.applyImpulse(nx * SB.PUSH, nz * SB.PUSH, side * 0.3);
        p.bonkCd = SB.PER; sbAny = SB.ANY;
        // (no toast: the bounce, the sparks and the sound are the feedback)
        car.fx.burst(car.pos.x - nx * 1.0, 1.0, car.pos.z - nz * 1.0, 14, 4, [1, 0.94, 0.46], 0.35, 0.45);
        tone(150, 0.12, "square", 0.22, 90);
        rumble(0.45, 0.5, 160, true);
        MP.bumps = (MP.bumps || 0) + 1;
    }
    p.bonkOverlap = overlap;
}
hook("runStart", G => { prevScore = 0; G.mpPbDone = false; MP.scorePosted = false; MP.convoy.active = false; MP.convoy.t = 0; MP.draft.active = false; MP.draft.t = 0; });
hook("update", (dt, P, controlsOn) => {
    const G = ctx.G, car = ctx.car;
    honkCd = Math.max(0, honkCd - dt);
    // party record toast: I just beat my best score mid-run
    if (!G.mpPbDone && save3d.best > 0 && G.score > save3d.best && controlsOn) { G.mpPbDone = true; if (MP.connected) N.noteRecord(G.score); }
    if (!MP.connected || ctx.state !== "playing") { prevScore = G.score; return; }
    const friend = N.friendRoom();
    if (sbAny > 0) sbAny -= dt;            // (the shared bump cooldown: once a frame)
    let near = false, draftWin = false;
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    for (const id in MP.peers) {
        const p = MP.peers[id];
        if (!p.seen) continue;
        const rel = p.rel;
        if (Math.abs(rel) < 500) near = true;
        if (!friend) { strangerBump(p, car, dt); continue; }
        if (p.m !== 0) { p.bonkOverlap = false; continue; }
        const ds = rel / DI_PER_M, dd = (p.x - X_MID) / X_PER_M - car.d;
        // SLIPSTREAM: a friend 10–36 m ahead, lined up
        if (rel > 120 && rel < 420 && Math.abs(dd) < 1.7) draftWin = true;
        // TAG pass (slightly bigger box) + BONK! (comedy bounce, no damage)
        const tagHit = Math.abs(dd) < 2.7 && Math.abs(ds) < 6;
        const T = MP.tag;
        if (tagHit && T && !T.over && !T.itIsMe && T.itPeer === id && MP.clock > (T.tagGuardUntil || 0)) N.tagBecomeIt();
        const overlap = Math.abs(dd) < 2.2 && Math.abs(ds) < 4.6;
        if (overlap && !p.bonkOverlap && !(p.bonkCd > 0)) {
            const dir = dd <= 0 ? 1 : -1;            // shove AWAY from the ghost (sideways)
            car.applyImpulse(rx * dir * 4.2, rz * dir * 4.2, dir * 0.35);
            p.bonkCd = 0.6;
            // (no toast: the bounce, the sparks and the sound are the feedback — a pop-up per bump flooded calm's budget)
            const cx = car.pos.x - rx * dir * 1.1, cz = car.pos.z - rz * dir * 1.1;
            car.fx.burst(cx, 1.0, cz, 14, 4, [1, 0.94, 0.46], 0.35, 0.45);
            tone(150, 0.12, "square", 0.22, 90);
            rumble(0.5, 0.6, 180, true);
            MP.bonks = (MP.bonks || 0) + 1;
            emit("stat", { id: "mpBonks", n: 1 });
        }
        p.bonkOverlap = overlap;
    }
    // CONVOY ×1.5 (friend rooms): a party member within 500 px for 2 s
    const C = MP.convoy;
    if (friend) {
        if (near) {
            C.grace = 0; C.t += dt;
            if (!C.active && C.t >= 2) { C.active = true; H.toast("🚗🚗 CONVOY! ×1.5 score", "gold"); tone(660, 0.14, "triangle", 0.2, 880); rumble(0.2, 0.4, 150); }
        } else if (C.active) { C.grace += dt; if (C.grace >= 3) { C.active = false; C.t = C.grace = 0; H.toast("convoy ended", ""); } }
        else C.t = 0;
    } else { if (C.active) H.toast("convoy ended", ""); C.active = false; C.t = C.grace = 0; }
    if (C.active && G.score > prevScore) G.score += (G.score - prevScore) * 0.5;
    prevScore = G.score;
    // SLIPSTREAM +8%: tuck in behind a friend for 1 s
    const D = MP.draft;
    if (friend && draftWin) {
        D.grace = 0; D.t += dt;
        if (!D.active && D.t >= 1) { D.active = true; tone(520, 0.16, "sine", 0.14, 900); rumble(0.1, 0.3, 120); H.toast("💨 SLIPSTREAM!", "pink"); }
    } else if (D.active) { D.grace += dt; if (D.grace >= 0.7) { D.active = false; D.t = D.grace = 0; } }
    else D.t = 0;
    if (D.active && controlsOn && input.throttle > 0.2 && car.vF > 6) {
        car.vx += fx * 2.4 * dt; car.vz += fz * 2.4 * dt;
        if (Math.random() < 0.7) for (const s of [-1, 1]) {
            car.fx.emit(car.pos.x + rx * s * (0.9 + Math.random() * 0.5) + fx * 2, 0.6 + Math.random() * 1.2, car.pos.z + rz * s * (0.9 + Math.random() * 0.5) + fz * 2,
                -fx * 22, 0, -fz * 22, 0.12, 0.25, [0.7, 0.9, 1]);
        }
    }
}, -5);

// my honks go out to the room (rate-limited)
on("honk", () => { if (MP.connected && honkCd <= 0) { honkCd = 0.5; N.sendEvent("honk"); } });
// a peer honks nearby → 📣 + a little two-tone honk
on("mp:honk", ({ peer }) => {
    if (peer && peer.onScreen && Math.abs(peer.rel) < 320) { tone(415, 0.18, "square", 0.08); tone(523, 0.18, "square", 0.08); }
});

// ── run lifecycle: cruise auto-join, daily leaderboard, wanted board ─────
// 🌐 EVERYONE IN THE SAME WORLD: out in the open world she's online by default (the EVERYONE room — drop-in, no
// lobby, no code). Off: ⚙️ Settings › Play online (or the phone's "Go solo"), a party (it has its own room),
// Dina's mode (disconnects; back in the world it reconnects). Offline / relay down → silently solo: the socket just
// keeps backing off (≤ 10 s), nothing on screen says so.
const AMB = { t: 0, resume: null };
export const onlineOn = () => !shared.get().mpAutoOff;
const dinaMode = () => /^dina/.test(ctx.state || "") || !!(ctx.G && ctx.G.mode === "dina");
function ambientTick(dt) {
    if ((AMB.t -= dt) > 0) return;
    AMB.t = 0.5;
    if (!N.allowed()) return;
    if (dinaMode()) { if (MP.want) { AMB.resume = { room: MP.room, kind: MP.roomKind }; N.disconnect(false); } return; }
    if (!onlineOn() || MP.want || !me.inWorld) return;
    const r = AMB.resume; AMB.resume = null;
    N.connect(r ? r.room : "lobby", r ? r.kind : "everyone");
}
/** ⚙️ Play online on / off (the shared save's mpAutoOff — the 2D game reads the same flag). */
export function setOnline(on) {
    shared.update(s => { s.mpAutoOff = !on; });
    if (!on) { AMB.resume = null; if (MP.want) N.disconnect(true); }
    else AMB.t = 0;
    emit("mp:online", { on: !!on });
}
ctx.mp.setOnline = setOnline;
ctx.mp.peersIn = N.peersIn;              // (features/together: other players inside the same public room)
ctx.mp.setFr = N.setFr;                 // (features/friends: ➕ a friend from 📍 Nearby)
ctx.mp.relabel = N.relabel;             // (features/friends: a friend recognised in EVERYONE → 👯 + her name over her ghost)
// Tap a NAME over a car (a ghost in EVERYONE) → 📍 Nearby's page for that driver (➕ ask to be friends — features/friends).
// A tap = short + still, not on a button / the phone; nothing for a hold (touch steering) or a drag.
ctx.mp.ghostAt = ghostAt;
ctx.mp.tagOnScreen = id => { const p = MP.peers[id] ? null : ctx.mp.peerById && ctx.mp.peerById(id); return tagOnScreen(p && p.key ? p.key : id); };   // (a relay id or a key)
const TAP = { x: 0, y: 0, t: 0, id: -1 };
function tapOk(e) {
    if (!MP.connected || !(MP.room === "lobby" || MP.roomKind === "place") || !ctx.friends || !ctx.friends.ui) return false;
    if (!(ctx.state === "playing" || ctx.state === "footRun") || ctx.dialogOpen || (ctx.phone && ctx.phone.isOpen)) return false;
    const t = e.target;
    return !(t && t.closest && t.closest("button, a, input, select, .btn, #lpPhone, .lp-phone, .toast, #banner"));
}
window.addEventListener("pointerdown", e => { TAP.x = e.clientX; TAP.y = e.clientY; TAP.t = performance.now(); TAP.id = e.pointerId; }, true);
window.addEventListener("pointerup", e => {
    if (e.pointerId !== TAP.id || performance.now() - TAP.t > 350 || Math.hypot(e.clientX - TAP.x, e.clientY - TAP.y) > 12 || !tapOk(e)) return;
    const id = ghostAt(e.clientX, e.clientY), p = id && MP.peers[id];
    if (!p || !ctx.phone || !ctx.phone.openPhone) return;
    ctx.phone.openPhone("nearby", { driver: p.id || id, name: p.name });   // (the relay id — in place mode the key is "S:…")
}, true);
Object.defineProperty(ctx.mp, "myId", { get: () => (MP.connected ? MP.myId : null) });
Object.defineProperty(ctx.mp, "allowed", { get: () => N.allowed() });
Object.defineProperty(ctx.mp, "online", { get: onlineOn });
Object.defineProperty(ctx.mp, "near", { get: () => Object.values(MP.peers).filter(p => p.onScreen).length });
ctx.mp.ghostStats = ghostStats;
addMenuItem("settings", {
    id: "online", order: 58,
    visible: () => N.allowed(),
    label: () => `🌐 Play online <b>${onlineOn() ? "ON" : "OFF"}</b> <small style="opacity:.75">${onlineOn() ? "See other players driving around" : "Just you in the world"}</small>`,
    action: () => { setOnline(!onlineOn()); H.toast(onlineOn() ? "🌐 Online. You'll see other players out driving." : "🌐 Offline. It's just you now.", "", 2.5); },
});
on("run:end", ({ score, bestStreak = 0 }) => { N.postScore(Math.max(score || 0, bestStreak)); });   // (knock-outs bank streaks: post the run's best)
for (const ev of ["arrest", "law:arrest", "jail"]) on(ev, e => { if (e && e.charges) N.postWanted(e.charges); });
// a friend race starts while we're on the title → hop into a cruise in time for GO
on("mp:raceRun", () => { if (ctx.state === "title") { H.hideScreen(); startRun({ mode: "cruise" }); } });
on("mp:status", () => U.uiDirty());
// 🌍 one shared world (ci/oneserver): the relay's kill switches + clock at boot (and again every 10 min on a hello);
// when the relay is over its free daily allowance, ONE quiet line — play goes on solo
on("boot", () => { WC.config(true); });
on("mp:status", e => { if (e && e.connected) WC.config(); });
on("world:resting", e => {
    if (!e || !e.resting) return;
    const t = e.until ? new Date(e.until).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "midnight";
    H.toast(`🌙 Online play is resting until ${t}. You can keep playing.`, "", { prio: 1, key: "worldResting" });
});
ctx.mp.event = (k, d) => N.sendRel(k, d);
// 🌍 step 3: a player by her relay id (Nearby / a tap pass that; in place mode MP.peers is keyed by room / session tag) —
// the one in my own room first
ctx.mp.peerById = id => { if (MP.peers[id]) return MP.peers[id]; let best = null; for (const k in MP.peers) { const p = MP.peers[k]; if (p.id === id) { if (!p.room || p.room === N.roomPath()) return p; best = best || p; } } return best; };          // 🌍 step 2: a reliable one-time event to the room (→ mp:event on the others)
on("accounts:names", () => { N.relabel(); U.uiDirty(); });          // (features/accounts: a name came back from the server / ⚙️ names on-off)
on("mp:riders", () => U.uiDirty());

// ── HUD + menus ──────────────────────────────────────────────────────────
hook("hud", () => U.hudTick());
// With the party feature present, Shared Road is "🕹️ Classic 2D friends" in the title's ⚙️ More drawer,
// so the title has ONE multiplayer entry; without it, Shared Road keeps its own title button.
addMenuItem("title", {
    id: "sharedroad", order: 60, cls: "purple",
    label: () => MP.connected ? `🌐 Online · ${N.riderCount()} rider${N.riderCount() === 1 ? "" : "s"}` : MP.want ? "🌐 Connecting…" : "🌐 Shared Road",
    visible: () => N.allowed() && !ctx.party,
    action: () => U.openSharedRoad("title"),
});
// …and its Classic 2D cross-play room sits in ⚙️ More, beside "Classic 2D" (the 👯 Friends screen stays one button).
addMenuItem("title", { id: "mp2d", order: 98, group: "more", short: "2D friends", label: "🕹️ Classic 2D friends",
    sub: "Play with friends on the old 2D game", visible: () => N.allowed() && !!ctx.party, action: () => U.openSharedRoad("title") });
addMenuItem("pause", { id: "sharedroad", order: 40, label: "🕹️ Classic 2D friends",
    visible: () => N.allowed() && !(ctx.party && ctx.party.active), action: () => U.openSharedRoad("pause") });
addMenuItem("titleInfo", { id: "mpCrew", visible: () => MP.connected, label: () => U.titleCrewHtml() });
addMenuItem("titleInfo", { id: "mpBoard", visible: () => !!(N.allowed() && N.scoresList() && N.scoresList().length), label: () => U.titleBoardHtml() });
addTouchButton({ id: "mpEmote", emoji: "😀", label: "EMOTE", action: "mpEmote", visible: () => MP.connected && me.social && me.inWorld });
hook("update", (dt, P) => { if (P.mpEmote) { if (U.wheelOpen()) U.closeWheel(); else U.openWheel(false); } }, -6);

// tidy up ghosts when leaving a session
on("mp:status", e => { if (e && e.want === false) clearGhosts(); });
