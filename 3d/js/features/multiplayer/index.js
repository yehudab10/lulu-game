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
import { save3d } from "../../core/save.js";
import { startRun } from "../../core/driving.js";
import { addTouchButton, input, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { showTitle } from "../../core/screens.js";
import * as N from "./net.js";
import { MP, DI_PER_M, X_PER_M, X_MID } from "./net.js";
import { updateGhosts, clearGhosts } from "./ghosts.js";
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
    get room() { return MP.room; },
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
const me = { s: 0, d: 0, sp: 0, foot: false, driving: false, sending: false, vk: "car" };
function myPose() {
    const car = ctx.car;
    const def = ctx.states[ctx.state] || {};
    const foot = !!(ctx.foot && ctx.foot.active);
    me.foot = foot;
    me.driving = !!def.driving && !foot;
    me.parking = ctx.state === "parking";
    me.sending = me.driving || foot || me.parking;
    me.s = car ? car.s : 0; me.d = car ? car.d : 0; me.sp = car ? car.speed : 0;
    if (foot) {
        const fp = footPos();
        if (fp && ctx.world) {
            const n = ctx.world.road.nearest(fp.x, fp.z, car.s, tmp);
            me.s = n.s; me.d = n.d;
            me.sp = typeof ctx.foot.speed === "number" ? ctx.foot.speed : 1.3;
        } else me.sp = 1.3;
    }
    if (me.parking) me.sp = 0;
    const veh = ctx.foot && ctx.foot.vehicle;   // a borrowed ride, if the foot feature exposes one
    if (!foot && veh && veh.kind) { me.vk = "borrowed"; me.ct = veh.ct || 0; me.co = veh.color || "#E53935"; }
    else me.vk = (ctx.G && ctx.G.vehicleKind) || "car";
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
        N.tick(dt, me);
        const inRun = me.driving || me.foot;
        updateGhosts(dt, me, inRun && !ctx.view);
        U.overlayTick();
        U.uiTick();
        U.wheelTick(dt, inRun && !ctx.paused && !ctx.dialogOpen);
        U.setKeyInRun(inRun && !ctx.paused);
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
hook("runStart", G => { prevScore = 0; G.mpPbDone = false; MP.scorePosted = false; MP.convoy.active = false; MP.convoy.t = 0; MP.draft.active = false; MP.draft.t = 0; });
hook("update", (dt, P, controlsOn) => {
    const G = ctx.G, car = ctx.car;
    honkCd = Math.max(0, honkCd - dt);
    // party record toast: I just beat my best score mid-run
    if (!G.mpPbDone && save3d.best > 0 && G.score > save3d.best && controlsOn) { G.mpPbDone = true; if (MP.connected) N.noteRecord(G.score); }
    if (!MP.connected || ctx.state !== "playing") { prevScore = G.score; return; }
    const friend = N.friendRoom();
    let near = false, draftWin = false;
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    for (const id in MP.peers) {
        const p = MP.peers[id];
        if (!p.seen) continue;
        const rel = p.rel;
        if (Math.abs(rel) < 500) near = true;
        if (!friend || p.m !== 0) { p.bonkOverlap = false; continue; }
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
            H.toast("BONK!", "gold");
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
on("run:start", ({ mode }) => { if (mode === "cruise") N.autoConnect(); });
on("run:end", ({ score }) => { N.postScore(score); });
for (const ev of ["arrest", "law:arrest", "jail"]) on(ev, e => { if (e && e.charges) N.postWanted(e.charges); });
// a friend race starts while we're on the title → hop into a cruise in time for GO
on("mp:raceRun", () => { if (ctx.state === "title") { H.hideScreen(); startRun({ mode: "cruise" }); } });
on("mp:status", () => U.uiDirty());
on("mp:riders", () => U.uiDirty());

// ── HUD + menus ──────────────────────────────────────────────────────────
hook("hud", () => U.hudTick());
addMenuItem("title", {
    id: "sharedroad", order: 60, cls: "purple",
    label: () => MP.connected ? `🌐 Online · ${N.riderCount()} rider${N.riderCount() === 1 ? "" : "s"}` : MP.want ? "🌐 Connecting…" : "🌐 Shared Road",
    visible: () => N.allowed(),
    action: () => U.openSharedRoad("title"),
});
addMenuItem("pause", { id: "sharedroad", order: 40, label: () => MP.connected ? `🌐 Shared Road · ${N.riderCount()}` : "🌐 Shared Road",
    visible: () => N.allowed(), action: () => U.openSharedRoad("pause") });
addMenuItem("titleInfo", { id: "mpCrew", visible: () => MP.connected, label: () => U.titleCrewHtml() });
addMenuItem("titleInfo", { id: "mpBoard", visible: () => !!(N.allowed() && N.scoresList() && N.scoresList().length), label: () => U.titleBoardHtml() });
addTouchButton({ id: "mpEmote", emoji: "😀", label: "EMOTE", action: "mpEmote", visible: () => MP.connected && (me.driving || me.foot) });
hook("update", (dt, P) => { if (P.mpEmote) { if (U.wheelOpen()) U.closeWheel(); else U.openWheel(false); } }, -6);

// tidy up ghosts when leaving a session
on("mp:status", e => { if (e && e.want === false) clearGhosts(); });
