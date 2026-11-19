// features/party — 👋 EMOTES + QUICK CHAT: gestures friends SEE on your puppet.
//
//  Eight slots, each a gesture (core/people.js poses) + a short, FIXED, friendly phrase — no free
//  text anywhere (Dina-aged players). Hold D-pad ↑ (F / M) for the wheel, aim, let go · a quick
//  tap = 👋 Hi! · 1–8 on a keyboard · the 😀 touch button. On foot (solo or with friends — D-pad ↑ has no
//  other job on foot) and from the car with friends (where ↑ never fires a missile: party/index.js blanks it).
//
//  On the wire: my snapshot extras `d.x.e = [slot, seq]` for as long as the gesture plays (~2.6 s) — tiny,
//  survives a dropped packet, and a late joiner sees it too. Friends' walkers play the pose; friends' cars wave
//  an arm out of the window; both get the phrase in a bubble + the emoji popping up.
//
//  Fun, and never in anyone's way: an emote never moves, blocks or touches another player (cosmetic only), one
//  can start every 0.9 s at most (sender) and a friend's are taken at most every 0.7 s (receiver).
//  · REACTIONS: two friends who emote at each other (≤ 14 m, ≤ 3 s apart) get a little combo — ✋ HIGH FIVE,
//    🕺 DANCE-OFF, 🥂 L'CHAIM… (each screen works it out from the two gestures it saw: nothing extra is sent).
//  · GREETINGS: passing a friend (≤ 9 m, once a minute and a half per friend) → their puppet waves, yours too
//    on foot, a little toot. Purely local (both screens see the same moment their own way).
//  Moving off cancels an on-foot gesture (she never freezes in place); no rewards (stats only — golden rule 5).
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { input, rumble, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";
import { tone } from "../parking/sfx.js";
import { N, setX } from "./net.js";
import * as R from "./remote.js";
import * as U from "./ui.js";

export const EMOTES = [
    { id: "hi", e: "👋", say: "Hi!", pose: { wave: true } },
    { id: "follow", e: "👉", say: "Follow me!", pose: { point: true } },
    { id: "wait", e: "✋", say: "Wait up!", pose: { stop: true } },
    { id: "cheer", e: "🙌", say: "Woohoo!", pose: { cheer: true }, hop: 0.16 },
    { id: "dance", e: "💃", say: "💃", pose: { dance: true }, dur: 4 },
    { id: "facepalm", e: "🤦", say: "Oy vey!", pose: { facepalm: true } },
    { id: "mazel", e: "🥂", say: "Mazel tov!", pose: { cheer: true }, hop: 0.24 },
    { id: "gg", e: "👏", say: "GG!", pose: { clap: true } },
];
const IDX = Object.fromEntries(EMOTES.map((x, i) => [x.id, i]));
const DUR = 2.6, NEAR = 14, GREET_R = 9, GREET_EVERY = 90000;
// two gestures at each other → a combo (unordered pairs; "*" = with anything)
const COMBOS = [
    ["hi", "hi", "✋", "HIGH FIVE!"],
    ["dance", "dance", "🕺", "DANCE-OFF!"],
    ["mazel", "mazel", "🥂", "L'CHAIM!"],
    ["mazel", "cheer", "🥂", "L'CHAIM!"],
    ["cheer", "cheer", "🙌", "TEAM SPIRIT!"],
    ["gg", "gg", "🤝", "GOOD GAME!"],
    ["follow", "follow", "👉👈", "WHICH WAY?!"],
    ["follow", "wait", "🚗", "RIGHT BEHIND YOU!"],
    ["dance", "*", "💃", "JOIN THE DANCE!"],
    ["facepalm", "*", "😅", "OY VEY…"],
];
function comboOf(a, b) {
    const A = EMOTES[a] && EMOTES[a].id, B = EMOTES[b] && EMOTES[b].id;
    for (const [x, y, e, t] of COMBOS) if ((x === A && (y === B || y === "*")) || (x === B && (y === A || y === "*"))) return { e, t };
    return null;
}

// ── me ────────────────────────────────────────────────────────────────────
const ME = { i: -1, t: 0, dur: 0, seq: 0, at: -1e9, local: false, bubble: null, combos: new Map(), greet: new Map(), greetT: 0, waveT: 0 };
const party = () => !!N.want;
const onFootNow = () => ctx.state === "footRun" && !!ctx.foot && ctx.foot.active && ctx.foot.phase === "walk" && !!ctx.foot.person;
const carNow = () => party() && ctx.state === "playing" && !!ctx.G && ctx.G.mode === "party";
/** Can I emote right now? (on foot — solo or a party — or in the car with friends) */
function allowed() {
    if (ctx.paused || ctx.dialogOpen || H.screenOpen() || ctx.view) return false;
    if (ctx.phone && ctx.phone.isOpen) return false;
    return onFootNow() || carNow();
}
function myPos() { return onFootNow() && ctx.foot.pos ? ctx.foot.pos : ctx.car ? ctx.car.pos : null; }

/** Play emote slot i as me. → true when it played. */
export function play(i, opts = {}) {
    const E = EMOTES[i];
    if (!E || (!opts.force && !allowed())) return false;
    const w = performance.now();
    if (!opts.force && w - ME.at < 900) return false;            // no spamming
    ME.at = w;
    ME.i = i; ME.t = 0; ME.dur = E.dur || DUR; ME.local = !!opts.local;
    if (!ME.local) ME.seq = (ME.seq + 1) % 100;
    // the phrase over her head (on foot: foot's own bubble) or over my car
    if (onFootNow()) { try { ctx.foot.say(ctx.foot.obj, E.say === E.e ? E.e : `${E.e} ${E.say}`, Math.min(2.4, ME.dur)); } catch (e) { /* cosmetic */ } }
    else if (ME.bubble) ME.bubble.show(E.say === E.e ? E.e : `${E.e} ${E.say}`);
    if (!ME.local) {
        tone(660, 0.07, "triangle", 0.12, 900);
        emit("stat", { id: "partyEmotes", n: 1 });
        emit("party:emote", { uid: N.uid || "me", i, id: E.id, me: true });
        // a friend emoted at me a moment ago? → a combo
        for (const rc of R.cars.values()) if (rc.shown && rc.emote && rc.emote.t < 3) tryCombo(rc, rc.emote.i, i);
    }
    return true;
}
function stop() { ME.i = -1; ME.t = 0; }

// ── friends' gestures (remote.js calls this for every friend it draws, every frame) ──
function remoteEmote(rc, p) {
    const e = p.x && Array.isArray(p.x.e) ? p.x.e : null;
    const key = e ? (e[0] | 0) + ":" + (e[1] | 0) : "";
    if (!e) { if (rc.emote && !rc.emote.local) rc.emote = null; return; }          // they moved off / it ended
    if (key === rc.emKey) {                                                         // the same gesture (a dropped snapshot came back)
        if (!rc.emote && rc.emLast && rc.emLast.t < rc.emLast.dur) rc.emote = rc.emLast;
        return;
    }
    rc.emKey = key;
    const i = e[0] | 0, E = EMOTES[i];
    if (!E) return;
    const w = performance.now();
    if (w - (rc.emAt || -1e9) < 700) return;                                       // (a flood is just ignored)
    rc.emAt = w;
    rc.emote = rc.emLast = { i, t: 0, dur: E.dur || DUR, pose: E.pose, hop: E.hop || 0 };
    rc.bubble.show(E.say === E.e ? E.e : E.say);
    rc.pop.show(E.e);
    if (!rc.foot) rc.v.wave(rc.emote.dur);
    if (rc.shown && Math.hypot(rc.x - ctx.car.pos.x, rc.z - ctx.car.pos.z) < 60) tone(880, 0.05, "sine", 0.08);
    emit("party:emote", { uid: rc.uid, i, id: E.id, me: false });
    if (ME.i >= 0 && !ME.local && ME.t < 3) tryCombo(rc, i, ME.i);
}
R.setEmoteFn(remoteEmote);

function tryCombo(rc, theirs, mine) {
    const c = comboOf(theirs, mine), me = myPos();
    if (!c || !me || !rc.shown) return;
    const dx = rc.x - me.x, dz = rc.z - me.z;
    if (dx * dx + dz * dz > NEAR * NEAR) return;
    const w = performance.now();
    if (w - (ME.combos.get(rc.uid) || -1e9) < 6000) return;
    ME.combos.set(rc.uid, w);
    const mx = (rc.x + me.x) / 2, mz = (rc.z + me.z) / 2;
    if (ctx.car && ctx.car.fx) for (let k = 0; k < 3; k++) ctx.car.fx.burst(mx, 1.6, mz, 16, 5, [[1, 0.3, 0.55], [1, 0.85, 0.2], [0.3, 0.75, 1]][k], 0.5, 1.1);
    const name = ctx.party ? ctx.party.displayName(rc.uid) : "a friend";
    H.toast(`${c.e} ${c.t} — with ${name}`, "gold", { key: "emcombo", merge: false });
    tone(523, 0.1, "triangle", 0.16); tone(784, 0.16, "triangle", 0.16, 0, 0.1);
    rumble(0.2, 0.5, 160);
    emit("stat", { id: "partyCombos", n: 1 });
    emit("party:combo", { uid: rc.uid, e: c.e, t: c.t });
    ME.lastCombo = { uid: rc.uid, t: c.t, at: w };
}

// ── greetings: passing a friend ──────────────────────────────────────────
function greetings(dt) {
    ME.greetT -= dt;
    if (ME.greetT > 0) return;
    ME.greetT = 0.25;
    const me = myPos();
    if (!party() || !me || !(onFootNow() || carNow())) return;
    const g = ctx.openworld && ctx.openworld.game;
    if (g && g.ph === "go" && (g.ps || []).includes(N.uid)) return;                // (mid-game: no time for pleasantries)
    const w = performance.now();
    for (const rc of R.cars.values()) {
        if (!rc.shown) { rc.seenAt = 0; continue; }
        if (!rc.seenAt) rc.seenAt = w;
        const dx = rc.x - me.x, dz = rc.z - me.z;
        if (dx * dx + dz * dz > GREET_R * GREET_R || w - (ME.greet.get(rc.uid) || -1e9) < GREET_EVERY) continue;
        ME.greet.set(rc.uid, w);
        // their puppet waves (unless they're mid-gesture), I wave on foot, a friendly toot
        if (rc.foot) { if (!rc.emote) rc.emote = { i: IDX.hi, t: 0, dur: 1.4, pose: EMOTES[IDX.hi].pose, hop: 0, local: true }; }
        else rc.v.wave(1.4);
        rc.pop.show("👋");
        if (onFootNow() && ME.i < 0) play(IDX.hi, { local: true, force: true });
        else if (!onFootNow()) { tone(587, 0.07, "square", 0.05); tone(740, 0.09, "square", 0.05, 0, 0.09); }
        const name = ctx.party ? ctx.party.displayName(rc.uid) : "a friend";
        H.toast(`👋 ${name}${rc.foot ? "" : " drove by"}`, "pink", { key: "greet:" + rc.uid });
        emit("stat", { id: "partyGreets", n: 1 });
        emit("party:greet", { uid: rc.uid });
        break;
    }
}

// ── per frame (after the state's update: we pose her on top of what foot drew) ──
hook("hud", dt => {
    const ok = allowed();
    U.wheelTick(dt, ok);
    U.setChatKeys(ok);
    if (input.pressed.partyChat && ok) { if (U.wheelOpen()) U.closeWheel(); else U.openWheel(false); }
    if (ME.bubble) ME.bubble.update(dt, 3.5);
    if (ME.i >= 0) {
        ME.t += dt;
        const foot = onFootNow(), E = EMOTES[ME.i];
        const moving = foot && ctx.foot.vel && Math.hypot(ctx.foot.vel.x, ctx.foot.vel.z) > 1.4 && ME.t > 0.25;
        if (ME.t > ME.dur || moving || !(foot || carNow())) stop();
        else if (foot) {
            const p = ctx.foot.person;
            const sp = ctx.foot.vel ? Math.hypot(ctx.foot.vel.x, ctx.foot.vel.z) : 0;
            // face the nearest friend (a gesture AT someone reads better)
            let best = null, bd = NEAR * NEAR;
            for (const rc of R.cars.values()) { if (!rc.shown) continue; const d = (rc.x - ctx.foot.pos.x) ** 2 + (rc.z - ctx.foot.pos.z) ** 2; if (d < bd) { bd = d; best = rc; } }
            if (best && sp < 0.6) p.face(best.x, best.z, dt, 6);
            p.update(0, Object.assign({ walk: sp }, E.pose));
            if (E.hop) p.obj.position.y += Math.abs(Math.sin(ME.t * 7)) * E.hop;
        }
    }
    // what friends see
    setX("e", party() && ME.i >= 0 && !ME.local ? [ME.i, ME.seq] : null);
    greetings(dt);
});
U.setChatHandler(i => {
    if (ctx.state === "partyLobby" || ctx.state === "partyResults") return;           // (the lobby stage has its own chat)
    play(i);
}, EMOTES, () => play(IDX.hi));

// the 😀 touch button (it replaces the old 💬 CHAT one: the wheel has the phrases too)
addTouchButton({ id: "partyChat", emoji: "😀", label: "EMOTE", action: "partyChat", visible: () => allowed() });

on("boot", () => {
    ME.bubble = new R.Bubble(); ME.bubble.k = 1.2;
    ctx.car.obj.add(ME.bubble.sp);
});
on("party:status", e => { if (e && e.want === false) { stop(); ME.greet.clear(); ME.combos.clear(); setX("e", null); if (ME.bubble) ME.bubble.sp.visible = false; } });
on("state", ({ to }) => { if (to !== "footRun" && to !== "playing" && to !== "playPhoto") { stop(); U.closeWheel(); } });

// ── service ───────────────────────────────────────────────────────────────
ctx.emotes = {
    list: EMOTES.map(x => ({ id: x.id, e: x.e, say: x.say })),
    /** Play an emote by slot (0–7) or id ("hi", "dance"…) → true when it played. */
    play: k => play(typeof k === "string" ? IDX[k] : k),
    get active() { return ME.i >= 0 ? { id: EMOTES[ME.i].id, t: ME.t, local: ME.local } : null; },
    get allowed() { return allowed(); },
    /** What this screen shows friend uid doing: { id, t } | null. */
    friend(uid) { const rc = R.cars.get(uid); return rc && rc.emote ? { id: EMOTES[rc.emote.i].id, t: rc.emote.t, local: !!rc.emote.local } : null; },
    get lastCombo() { return ME.lastCombo || null; },
    debug: { ME, comboOf: (a, b) => comboOf(IDX[a], IDX[b]), resetCool() { ME.at = -1e9; ME.greet.clear(); ME.combos.clear(); return true; } },
};
