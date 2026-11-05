// features/journey/trip.js — THE STORY TRIP run layer: legs, chapter tasks,
// milestones, the arrival pull-in + cutscene + rewards (scaled per tour, the
// tour jackpot), postcards, checkpoints, boons, the trip bar, leg music and
// banners, and ctx.journey. Ported from src/05a-journey.js.
import * as THREE from "three";
import { ctx, on, hook, emit, registerState, setState, css, fmtTime, wrapAngle } from "../../core/ctx.js";
import { save3d, saveSoon, store, shared } from "../../core/save.js";
import { startRun, updateDriving, endRun, statsHtml, addScore, addCoins, heal } from "../../core/driving.js";
import { say } from "../../core/dialog.js";
import { models, cloneWithColors } from "../../models.js";
import { rumble, glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import * as SFX from "./sfx.js";
import { STOPS, N_STOPS, EPILOGUE, TASK_GOAL, PULL_IN, legStartS, cycleMult, spawnBiasFor, bumpAvigail } from "./data.js";
import { isStory, layoutMult, stopAt, curLeg, curStop, legEnd, legProgress, hasHeat, heat } from "./state.js";
import { focus, rebuildStaleChunks, warmLeg, env } from "./env.js";
import { phoneGuards } from "./phone.js";

export const J = store("journey", { arrivals: 0, bestTime: 0, legBest: {}, trips: 0 });

css("journey-trip", `
#banner .jleg { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#banner .jleg .lg { font-size: 13px; letter-spacing: .14em; background: var(--acc); color: #3E2723; border-radius: 999px; padding: 3px 12px; }
#banner .jleg .nx { font-size: 24px; color: var(--ink); }
#banner .jleg .tk { font-size: 15px; color: #7a5a00; font-weight: 700; }
#banner .jleg .vb { font-size: 14px; font-style: italic; opacity: .75; font-weight: 600; }
.hud-chip.jtask { background: rgba(18,24,36,.78); color: #FFF5E6; border: 2px solid var(--acc, #FFD54F); font-size: 14px; }
.hud-chip.jtask.met { background: rgba(255,213,79,.95); color: #3E2723; }
.card.jarr { width: min(620px, 100%); }
.jarr .top { font-size: 34px; font-weight: 700; color: var(--pink); text-shadow: 0 3px 0 rgba(0,0,0,.12); line-height: 1; margin-top: 2px; }
.jarr .top.fin { color: #E6A700; font-size: 30px; }
.jarr .stopname { font-size: 22px; font-weight: 700; margin: 4px 0 2px; color: var(--ink); }
.jarr .stopname span { background: var(--acc); border-radius: 999px; padding: 2px 14px; }
.jarr .quote { text-align: left; position: relative; border: 2.5px solid var(--acc); }
.jarr .quote small { display: block; font-size: 13px; opacity: .6; margin-top: 2px; }
.jarr .beat { display: block; font-size: 14.5px; font-style: italic; color: #8D5A2B; margin-top: 6px; font-weight: 600; }
.jarr .epi { font-size: 15px; line-height: 1.45; background: #fff8e8; border-radius: 16px; padding: 10px 14px; text-align: left; }
.jarr .epi b { display: block; text-align: center; color: #E6A700; font-size: 18px; margin-top: 6px; }
.jarr .rw { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 8px 0 4px; }
.jarr .pill2 { background: #fff; border-radius: 999px; padding: 5px 14px; font-weight: 700; font-size: 16px; box-shadow: 0 2px 0 rgba(0,0,0,.08); }
.jarr .pill2.gold { background: #FFE082; color: #5D4037; font-size: 20px; }
.jarr .pill2.blue { background: #E1F5FE; color: #0277BD; }
.jarr .pill2.green { background: #DCEDC8; color: #2E7D32; }
.jarr .pill2.grey { background: #ECEFF1; color: #607D8B; font-weight: 600; font-size: 14px; }
.jarr .pill2.star { background: #FFEB3B; color: #5D4037; }
.jarr .tour { display: inline-block; background: #3E2723; color: #FFE082; border-radius: 999px; padding: 3px 14px; font-weight: 700; font-size: 14px; margin: 4px 0; }
.jarr .jack { font-size: 22px; font-weight: 700; color: #E6A700; animation: jpulse 1s infinite alternate; }
.btn.jboon { width: min(420px, 100%); background: linear-gradient(135deg, var(--acc), #fff3); color: var(--ink); border: 3px dashed rgba(0,0,0,.18); margin: 8px auto 0; }
.btn.jboon .em { font-size: 30px; }
.btn.jboon small { display: block; font-size: 12.5px; font-weight: 600; opacity: .75; }
.btn.jboon.taken { background: #DCEDC8; color: #2E7D32; border-style: solid; }
.jarr .stats .stat b { font-size: 20px; }
.jstops { font-size: 30px; letter-spacing: 6px; margin: 6px 0; }
@keyframes jpulse { from { transform: scale(.96); } to { transform: scale(1.05); } }
body.tv .jarr .top { font-size: 52px; } body.tv .jarr .stopname { font-size: 34px; } body.tv .jarr .pill2 { font-size: 24px; }
body.tv .hud-chip.jtask { font-size: 22px; padding: 8px 18px; } body.tv #banner .jleg .nx { font-size: 36px; } body.tv #banner .jleg .tk { font-size: 22px; }
@media (max-width: 600px) { .jarr .top { font-size: 26px; } .jarr .quote { font-size: 16px; } .jarr .stats .stat { min-width: 70px; padding: 6px 8px; } }
`);

// ── chapter tasks ─────────────────────────────────────────────────────────
export const task = { cur: null };
function armTask(i) {
    const id = STOPS[i].id, G = ctx.G;
    const t = { id, goal: TASK_GOAL[id] || 0, coinStart: G.coins, bestChain: 0, gear: 0, gearSpawned: 0, aviBumped: false, heartLost: false, legEndCoins: null };
    task.cur = t;
    return t;
}
export function taskMet(t = task.cur) {
    if (!t) return false;
    if (t.id === "bubbe") return ((t.legEndCoins != null ? t.legEndCoins : ctx.G.coins) - t.coinStart) >= t.goal;
    if (t.id === "heshy") return t.bestChain >= t.goal;
    if (t.id === "beach") return t.gear >= t.goal;
    if (t.id === "avigail") return !t.aviBumped;
    if (t.id === "vegas") return !t.heartLost;
    return false;
}
function taskLine(t = task.cur) {
    if (!t) return "";
    if (t.id === "bubbe") return `🛒 Groceries ${Math.max(0, Math.min(t.goal, ctx.G.coins - t.coinStart))}/${t.goal} 💰`;
    if (t.id === "heshy") return `🔥 Close-call chain: best ${Math.min(t.goal, t.bestChain)}/${t.goal}`;
    if (t.id === "beach") return `🏖️ Beach gear ${t.gear}/${t.goal}`;
    if (t.id === "avigail") return t.aviBumped ? "💅 Oops — keep it classy!" : "💅 Staying classy!";
    if (t.id === "vegas") return t.heartLost ? "🎲 Careful — protect the pot!" : "🎲 Hearts safe so far!";
    return "";
}
function taskMilestone() {
    const t = task.cur;
    if (!t) return;
    let msg = "";
    if (t.id === "bubbe") msg = `🛒 groceries: ${Math.max(0, ctx.G.coins - t.coinStart)}/${t.goal} 💰`;
    else if (t.id === "heshy") msg = `🔥 close calls: ${t.bestChain}/${t.goal}`;
    else if (t.id === "beach") msg = `🏖️ beach gear: ${t.gear}/${t.goal}`;
    else if (t.id === "avigail") msg = t.aviBumped ? "💅 oops — keep it classy!" : "💅 staying classy!";
    else if (t.id === "vegas") msg = t.heartLost ? "🎲 careful — protect the pot!" : "🎲 hearts safe so far!";
    if (msg) setTimeout(() => H.toast(msg, "gold"), 900);
}
on("closeCall", ({ combo }) => { const t = task.cur; if (isStory() && t && t.id === "heshy" && combo > t.bestChain) t.bestChain = combo; });
on("damage", () => { const t = task.cur; if (isStory() && t && t.id === "vegas") t.heartLost = true; });
on("crash", e => {
    const t = task.cur;
    if (!isStory() || !t || t.id !== "avigail" || t.aviBumped) return;
    const avi = e && (e.kind === "avigail" || e.kind === "journey_avigail" || (e.car && e.car.data && e.car.data.journeyAvi));
    if (avi && (e.impact || 0) > 0.8) { t.aviBumped = true; H.toast("💅 Oops — you bumped Avigail's car!", "red"); }
});

// HUD chip (under the trip bar)
let chip = null;
function updateChip() {
    const show = isStory() && !ctx.G.jDone && task.cur && ["playing", "intro", "storyTalk"].includes(ctx.state);
    if (!show) { if (chip) { chip.remove(); chip = null; } return; }
    if (!chip) { chip = document.createElement("div"); chip.className = "hud-chip jtask"; H.hudSlot("center").prepend(chip); }
    const met = taskMet();
    const txt = `${met ? "⭐" : "☆"} ${taskLine()}`;
    if (chip.dataset.t !== txt) { chip.dataset.t = txt; chip.textContent = txt; chip.classList.toggle("met", met && task.cur.id !== "avigail" && task.cur.id !== "vegas"); }
    const st = curStop();
    if (st) chip.style.setProperty("--acc", st.accent);
}
hook("hud", () => updateChip());
on("state", () => updateChip());

// ── trip bar ──────────────────────────────────────────────────────────────
function setTripIcon(icon) {
    const el = document.querySelector(".trip-to");
    if (el && el.textContent !== icon) el.textContent = icon;
}
ctx.trip = {
    progress() {
        const G = ctx.G;
        if (!isStory() || G.jDone) return 1;
        if (G.jArriving) return 1;
        return legProgress();
    },
    label() {
        const G = ctx.G, car = ctx.car;
        if (!isStory() || G.jDone) return `${G.jDone ? "ENDLESS CRUISE" : "CRUISE"} · ${((car.s - (G.startS || 0)) / 1609).toFixed(1)} mi`;
        const st = curStop();
        if (G.jArriving) return `${st.icon} ARRIVED!`;
        const rem = Math.max(0, stopAt(curLeg()) - car.s);
        if (rem < 2500 / 11.67 + PULL_IN) return `${st.icon} ${st.name} · ALMOST THERE!`;
        return `${st.icon} ${st.name} · ${(rem / 1609).toFixed(1)} mi`;
    },
};

// ── run lifecycle ─────────────────────────────────────────────────────────
let lastLeg = null;
/** Start a Story Trip run at leg `leg` (default: the banked checkpoint, shared storyStop). */
export function startStory(leg) {
    const s2 = shared.get();
    const L = leg == null ? (s2.storyStop || 0) % N_STOPS : Math.max(0, Math.min(N_STOPS - 1, leg));
    lastLeg = L;
    startRun({ mode: "story", leg: L, s: legStartS(L, cycleMult(s2.storyCycle || 0)) });
}

hook("runStart", (G, opts) => {
    G.jStops = 0;
    G.jNames = [];
    G.jLastScore = 0;
    layoutMult();
    if (G.mode !== "story") {
        task.cur = null;
        setTripIcon("🛣️");
        rebuildStaleChunks();
        emit("journey:leg", { index: -1 });
        return;
    }
    const s2 = shared.get();
    let L = opts && opts.leg != null ? opts.leg : (lastLeg != null ? lastLeg : (s2.storyStop || 0) % N_STOPS);
    L = Math.max(0, Math.min(N_STOPS - 1, L));
    lastLeg = L;
    G.jLeg = L;
    G.jTour = s2.storyCycle || 0;
    if (!opts || opts.s == null) {
        // pause-menu Restart / "Try again": put the car back at this leg's start
        const s0 = legStartS(L, G.jMult), p = ctx.world.road.point(s0, 1.75, {});
        ctx.car.place(p.x, p.z, p.h);
        ctx.car.s = s0; ctx.car.d = 1.75;
        G.lastS = G.startS = s0;
        ctx.world.prebuild(s0);
        ctx.world.resetCoins();
        if (ctx.cam) ctx.cam.snap();
    }
    rebuildStaleChunks();
    G.musicSet = true;
    armLeg(L, true);
}, 10);

/** Arm leg i: task, banner, music, milestones, the trip bar icon; tell the story beats. */
export function armLeg(i, fresh = false) {
    const G = ctx.G, st = STOPS[i];
    G.jLeg = i;
    G.jLegStart = ctx.car.s;
    G.jLegT = 0;
    G.jMile50 = G.jMile85 = false;
    G.jVegasFlip = false;
    G.jArriving = false;
    G.jPostponeAt = 0;
    G.jBannerT = fresh ? 0.9 : 0.45;   // after GO! / after the arrival screen
    G.goText = "";
    armTask(i);
    setTripIcon(st.icon);
    A.setMusic(st.music);
    warmLeg(i);
    emit("journey:leg", { index: i, stop: st, fresh });
}

export function legBannerHtml(i) {
    const st = STOPS[i];
    return `<div class="jleg" style="--acc:${st.accent}"><span class="lg">LEG ${i + 1}/${N_STOPS}</span>
        <span class="nx">NEXT STOP: ${st.icon} ${st.name}</span>
        <span class="tk">⭐ ${st.task}</span><span class="vb">${st.vibe}</span></div>`;
}

// guards so Ima doesn't ring over a leg banner or right before a stop
phoneGuards.push(() => !(isStory() && !ctx.G.jDone && ((ctx.G.jBannerShowT || 0) > 0 || (ctx.G.jBannerT || 0) > 0)));
phoneGuards.push(() => !(isStory() && !ctx.G.jDone && stopAt(curLeg()) - ctx.car.s < 420));

// ── the per-frame trip layer ──────────────────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    const G = ctx.G;
    // boons tick in any mode
    if (G.jSpritzT > 0) { G.jSpritzT -= dt; if (controlsOn) G.score += Math.max(0, G.score - (G.jLastScore || G.score)); if (G.jSpritzT <= 0) H.toast("✨ spritzer wore off", ""); }
    G.jLastScore = G.score;
    if (G.jSugarT > 0) { G.jSugarT -= dt; G.boost = 1; }
    if (G.jFloatT > 0) { G.jFloatT -= dt; if (G.jFloatT <= 0) floatieOff(); }
    if (!isStory() || G.jDone || ctx.state !== "playing") return;
    G.jLegT = (G.jLegT || 0) + dt;
    if (G.jBannerT > 0) {
        G.jBannerT -= dt;
        if (G.jBannerT <= 0) { H.banner(legBannerHtml(G.jLeg), 2800); G.jBannerShowT = 2.8; SFX.chime(523, 784); }
    } else if (G.jBannerShowT > 0) G.jBannerShowT -= dt;
    const st = curStop(), prog = legProgress();
    if (!G.jMile50 && prog >= 0.5 && prog < 0.98) {
        G.jMile50 = true;
        H.toast(`🏁 halfway to ${st.name}!`, "gold");
        SFX.chime(523, 659);
        taskMilestone();
    }
    if (!G.jMile85 && prog >= 0.85 && prog < 0.995) {
        G.jMile85 = true;
        H.toast(`${st.icon} ${st.name} — next exit!`, "gold");
        SFX.chime(659, 880);
        H.banner(`${st.icon} <b>${st.nice[0].toUpperCase() + st.nice.slice(1)} ahead!</b><small>Pull in under the ${["balloons", "pool noodles", "surfboards", "big pink heart", "neon dice"][G.jLeg]}</small>`, 2400);
    }
    if (st.id === "vegas" && !G.jVegasFlip && prog >= st.nightAt) {
        G.jVegasFlip = true;
        H.toast("🌃 the neon skyline rises…", "pink");
        SFX.chime(392, 587);
    }
    if (ctx.car.s >= legEnd()) {
        if (hasHeat()) {
            if (ctx.car.s >= (G.jPostponeAt || 0)) {
                H.toast("🚨 can't stop with heat on you! next chance ahead…", "red");
                G.jPostponeAt = ctx.car.s + 686;
            }
        } else beginArrival();
    }
}, 0);
on("cop:chase", e => { heat.chase = !!(e && e.active); });
on("run:start", () => { heat.chase = false; });

// ── boons ─────────────────────────────────────────────────────────────────
let floatieObj = null;
function floatieOn() {
    if (!models.journey_floatie || !ctx.car) return;
    if (!floatieObj) {
        floatieObj = cloneWithColors(models.journey_floatie);
        floatieObj.scale.set(1.2, 1, 2.25);
        floatieObj.position.set(0, 0.62, 0);
    }
    ctx.car.tilt.add(floatieObj);
}
function floatieOff() { if (floatieObj && floatieObj.parent) floatieObj.parent.remove(floatieObj); }
on("run:start", () => floatieOff());

function applyBoon(b) {
    if (!b || b.applied) return;
    b.applied = true;
    const G = ctx.G;
    if (b.id === "cholent") {
        if (G.hearts < G.maxHearts) heal(1);
        else { G.maxHearts = Math.min(5, G.maxHearts + 1); G.hearts = G.maxHearts; H.setHearts(G.hearts, G.maxHearts); emit("heart", { n: 1 }); }
        H.toast("Bubbe's cholent: +1 ❤️", "pink");
    } else if (b.id === "floatie") {
        G.invT = Math.max(G.invT, 8);
        G.jFloatT = 8;
        floatieOn();
        H.toast("floatie shield: 8s 🛡️", "gold");
    } else if (b.id === "icecream") {
        G.jSugarT = 5;
        G.boost = 1;
        H.toast("sugar rush! 🍦💨 free nitro", "pink");
    } else if (b.id === "spritzer") {
        G.jSpritzT = 15;
        G.jLastScore = G.score;
        H.toast("spritzer confidence: ×2 ✨", "pink");
    }
}

// ── arrival ───────────────────────────────────────────────────────────────
export const arr = { i: -1, t: 0, phase: "", data: null, spot: new THREE.Vector3(), shotFrom: new THREE.Vector3(), shotLook: new THREE.Vector3(), done: false };
const SHOTS = {
    bubbe: { from: [16, -5, 4.6], look: [0, 17, 2.0], target: [-3, 12.5] },
    heshy: { from: [12, 4, 7.5], look: [0, 25, 0.8], target: [-3, 12.5] },
    beach: { from: [20, 3, 5.5], look: [2, 23, 1.6], target: [-4, 12] },
    avigail: { from: [15, -4, 4.2], look: [0, 21, 2.4], target: [-3, 13] },
    vegas: { from: [24, -2, 6.5], look: [1, 22, 4.5], target: [-6, 12.5] },
};

function beginArrival() {
    const G = ctx.G, i = curLeg();
    if (i < 0 || G.jArriving) return;
    G.jArriving = true;
    const S = stopAt(i), road = ctx.world.road;
    // stuck far past the stop (a chase postponed it)? glide back to the gate
    if (ctx.car.s > S + 20 || ctx.car.s < S - PULL_IN - 80) {
        const p = road.point(S - 70, 5.25, {});
        ctx.car.place(p.x, p.z, p.h);
        ctx.car.vx = Math.sin(p.h) * 14; ctx.car.vz = Math.cos(p.h) * 14;
        ctx.cam.snap();
    }
    arr.i = i; arr.t = 0; arr.phase = "pull"; arr.done = false;
    const sh = SHOTS[STOPS[i].id];
    road.point(S + sh.target[0], sh.target[1], arr.target = {});
    const f = road.point(S + sh.from[0], sh.from[1], {}), l = road.point(S + sh.look[0], sh.look[1], {});
    arr.shotFrom.set(f.x, sh.from[2], f.z);
    arr.shotLook.set(l.x, sh.look[2], l.z);
    arr.data = applyArrival(i);
    focus.stop = i; focus.t = 0; focus.phase = "pull";
    A.sfxFanfare();
    A.sfxHorn(false);
    SFX.jingle();
    rumble(0.4, 0.8, 500, true);
    H.banner(`${STOPS[i].icon} <b>${STOPS[i].name}!</b><small>pulling in… ${STOPS[i].icon}</small>`, 2600);
    confetti(70);
    setState("arriving", { i });
}

function confetti(n) {
    const car = ctx.car;
    const cols = [[1, 0.25, 0.5], [1, 0.84, 0.25], [0.25, 0.77, 1], [0.7, 0.53, 1], [0.41, 0.94, 0.68]];
    const c = arr.target ? arr.target : car.pos;
    for (let k = 0; k < n; k++) {
        car.fx.emit(c.x + (Math.random() - 0.5) * 8, 4 + Math.random() * 4, c.z + (Math.random() - 0.5) * 8,
            (Math.random() - 0.5) * 5, 3 + Math.random() * 4, (Math.random() - 0.5) * 5, 0.45, 2.4, cols[k % cols.length]);
    }
}

/** Apply this stop's rewards exactly once (2D updateArrival's "claimed" block). */
function applyArrival(i) {
    const G = ctx.G, st = STOPS[i], s2 = shared.get();
    const D = { i, stop: st, greet: st.greet(), beat: st.beat };
    const t = task.cur;
    if (t) t.legEndCoins = G.coins;          // the grocery run counts only coins from the drive
    const tourIdx = s2.storyCycle || 0;
    const tourMult = 1 + 0.5 * Math.min(tourIdx, 4);
    D.tourMult = tourMult;
    D.reward = Math.round(st.reward * tourMult);
    addCoins(D.reward, "arrival");
    G.jStops = (G.jStops || 0) + 1;
    G.jNames.push(st.icon);
    D.stopsThisRun = G.jStops;
    if (st.id === "avigail") bumpAvigail(4);
    const legT = G.jLegT || 0;
    D.legTime = legT;
    D.fastest = !J.legBest[st.id] || legT < J.legBest[st.id];
    if (D.fastest) J.legBest[st.id] = legT;
    J.arrivals++;
    if (i === 0 && (!J.bestTime || G.runTime < J.bestTime)) J.bestTime = G.runTime;
    D.bonus = 500 + G.hearts * 250;
    addScore(D.bonus, "arrival");
    if (G.score > save3d.best) save3d.best = Math.floor(G.score);
    saveSoon();
    let jackpot = 0, taskBonus = 0;
    shared.update(s => {
        if (!Array.isArray(s.postcards)) s.postcards = [];
        if (!s.postcards.includes(st.id)) { s.postcards.push(st.id); D.newPostcard = true; }
        if ((s.tripBest || 0) < G.jStops) s.tripBest = G.jStops;
        if (i >= N_STOPS - 1) {
            // CYCLE RULE: only a FRONTIER Vegas (storyStop was 4) banks a new tour
            if ((s.storyStop || 0) >= N_STOPS - 1) {
                s.storyStop = 0;
                s.storyCycle = (s.storyCycle || 0) + 1;
                D.storyComplete = true;
                D.tourNum = s.storyCycle + 1;
                jackpot = D.jackpot = Math.min(1000, 250 * s.storyCycle);
            }
        } else if (i + 1 > (s.storyStop || 0)) s.storyStop = i + 1;   // checkpoints only move forward
        if (t) {
            D.taskId = t.id;
            D.taskMet = taskMet(t);
            if (D.taskMet) {
                if (!s.storyStars || typeof s.storyStars !== "object") s.storyStars = {};
                if (!s.storyTaskTour || typeof s.storyTaskTour !== "object") s.storyTaskTour = {};
                const paidTour = s.storyTaskTour[t.id];
                if (!s.storyStars[t.id]) { s.storyStars[t.id] = true; taskBonus = 40; D.taskNewStar = true; }
                else if (tourIdx > 0 && paidTour !== tourIdx) { taskBonus = Math.round(40 * tourMult); D.taskTourAgain = true; }
                else D.taskAlready = true;
                s.storyTaskTour[t.id] = tourIdx;
            }
        }
        if (!s.cruiseUnlocked) { s.cruiseUnlocked = true; D.unlockedCruise = true; }
    });
    D.taskBonus = taskBonus;
    if (taskBonus) addCoins(taskBonus, "chapterTask");
    if (jackpot) addCoins(jackpot, "tourJackpot");
    emit("journey:arrive", { index: i, stop: st, reward: D.reward, storyComplete: !!D.storyComplete, taskMet: !!D.taskMet });
    emit("stat", { id: "stops3d", n: 1 });
    if (D.storyComplete) emit("stat", { id: "tours3d", n: 1 });
    return D;
}

function pullCtl() {
    const car = ctx.car, T = arr.target;
    const dx = T.x - car.pos.x, dz = T.z - car.pos.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz), diff = wrapAngle(want - car.h);
    const vWant = Math.min(20, dist * 0.75);
    const steer = THREE.MathUtils.clamp(-diff * 2.6, -1, 1);
    if (dist < 2.2 || Math.abs(diff) > 2.2) return { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true, dist };
    return { steer, throttle: car.speed < vWant ? 0.55 : 0, brake: car.speed > vWant + 1.5 ? 0.7 : 0, handbrake: false, analog: true, dist };
}
function snapToSpot() {
    const T = arr.target, road = ctx.world.road, S = stopAt(arr.i);
    const h = road.at(S).h + 0.55;
    ctx.car.place(T.x, T.z, h);
    ctx.cam.snap();
}

registerState("arriving", {
    hud: true, touch: false, driving: true, pausable: false,
    enter() { ctx.cam.snap(); },
    update(dt, P) {
        arr.t += dt; focus.t = arr.t;
        if (arr.phase === "pull") {
            const ctl = pullCtl();
            updateDriving(dt, {}, false, ctl);
            const stopped = ctl.dist < 2.6 && ctx.car.speed < 1.5;
            if (arr.t > 0.9 && (P.confirm || P.start)) snapToSpot();
            if (stopped || arr.t > 3.1 || (arr.t > 0.9 && (P.confirm || P.start))) {
                arr.phase = focus.phase = "greet";
                const st = STOPS[arr.i];
                say(st.greeter, arr.data.greet, { emoji: st.greeterEmoji, color: st.ink, auto: 1.7 }).then(() => {
                    if (ctx.state === "arriving") setState("arrivedScreen", { i: arr.i });
                });
            }
        } else {
            updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true });
        }
        if (Math.random() < dt * 2.5) confetti(6);
    },
    camera(dt) {
        const k = Math.min(1, arr.t / 6);
        _from.copy(arr.shotFrom).lerp(arr.shotLook, k * 0.12);
        ctx.cam.cinematic(_from, arr.shotLook, dt, 1.4, 52);
        return true;
    },
});
const _from = new THREE.Vector3();

// ── the arrival screen ────────────────────────────────────────────────────
function arrivalHtml(D) {
    const st = D.stop, fin = !!D.storyComplete;
    const lines = [];
    lines.push(`<div class="top${fin ? " fin" : ""}">${fin ? "🏆 STORY COMPLETE!" : "YOU MADE IT!"}</div>`);
    lines.push(`<div class="stopname"><span>${st.icon} ${st.name}</span></div>`);
    if (fin) {
        lines.push(`<div class="tour">TOUR ${D.tourNum} unlocked — longer roads, same mishpacha</div>`);
        if (D.jackpot) lines.push(`<div class="jack">🎰 TOUR JACKPOT +${D.jackpot.toLocaleString()} 💰</div>`);
        lines.push(`<div class="epi"><i>${st.beat}</i><br>${EPILOGUE}<b>THE END — until Tour ${D.tourNum} 🎲</b></div>`);
    } else {
        lines.push(`<div class="quote">"${D.greet}"<small>— ${st.greeter}</small>${isStory() ? `<span class="beat">${st.beat}</span>` : ""}</div>`);
    }
    const rw = [`<span class="pill2 gold">+${D.reward} 💰${D.tourMult > 1 ? ` <small>(tour ×${D.tourMult})</small>` : ""}</span>`];
    rw.push(D.newPostcard ? `<span class="pill2 blue">📮 postcard collected!</span>` : `<span class="pill2 grey">stop #${D.stopsThisRun} this trip</span>`);
    if (D.taskNewStar) rw.push(`<span class="pill2 star">⭐ CHAPTER TASK DONE! +${D.taskBonus} 💰</span>`);
    else if (D.taskTourAgain) rw.push(`<span class="pill2 star">⭐ TASK DONE AGAIN THIS TOUR! +${D.taskBonus} 💰</span>`);
    else if (D.taskAlready) rw.push(`<span class="pill2 green">task done ✓ (already starred)</span>`);
    else if (D.taskMet === false) rw.push(`<span class="pill2 grey">task: not this time</span>`);
    if (D.unlockedCruise) rw.push(`<span class="pill2 green">🔓 ENDLESS CRUISE + SHARED ROAD unlocked — back at the menu!</span>`);
    lines.push(`<div class="rw">${rw.join("")}</div>`);
    lines.push(statsHtml(`<div class="stat"><b>${fmtTime(D.legTime)}</b><span>LEG TIME${D.fastest ? " 🏆" : ""}</span></div>`));
    lines.push(`<p class="fine">Arrival bonus +${D.bonus} (${"❤️".repeat(Math.max(0, ctx.G.hearts))} left${ctx.G.tickets ? `, ${ctx.G.tickets} speeding ticket${ctx.G.tickets > 1 ? "s" : ""} 🙈` : ""})</p>`);
    const b = st.boon;
    if (D.boon) lines.push(`<button class="btn jboon taken nav" id="jBoon"><span class="em">${b.emoji}</span><span>✓ ${b.label}${D.boon.id === "dice" ? ` — rolled +${D.boon.roll} 💰` : ""}<small>${b.id === "dice" ? "paid out!" : "ready for the next leg"}</small></span></button>`);
    else lines.push(`<button class="btn jboon nav" id="jBoon"><span class="em">${b.emoji}</span><span>Take ${b.label}!<small>${b.desc}</small></span></button>`);
    return `<div class="jarr" style="--acc:${st.accent}">${lines.join("")}</div>`;
}

function arrivalButtons(D) {
    const i = D.i, next = STOPS[i + 1];
    const last = i >= N_STOPS - 1;
    return [
        { id: "jKeep", label: last ? `🛣️ Keep cruising the Strip ${glyph("confirm")}` : `🚗 Keep driving → ${next.icon} ${next.nice} ${glyph("confirm")}`, action: continueTrip },
        { id: "jMap", label: "🗺️ Story map", cls: "alt", action: () => { H.hideScreen(); if (ctx.journey.openMap) ctx.journey.openMap({ from: "arrived" }); } },
        { id: "jEnd", label: "🏁 Call it a trip", cls: "purple", action: () => { H.hideScreen(); endRun("trip"); setState("tripDone"); } },
    ];
}

function takeBoon() {
    const D = arr.data;
    if (!D || D.boon) return;
    const b = D.stop.boon;
    D.boon = { id: b.id };
    if (b.id === "dice") {
        const roll = 25 + Math.floor(Math.random() * 76);
        D.boon.roll = roll;
        D.boon.applied = true;
        addCoins(roll, "dice");
        SFX.dice();
        H.toast(`🎲 rolled +${roll} 💰`, "gold");
    } else { SFX.chime(659, 988); H.toast(`${b.emoji} ${b.label} — packed for the next leg!`, "pink"); }
    showArrival(true);
}

function showArrival(keepFocus = false) {
    const D = arr.data;
    const card = H.showScreen(arrivalHtml(D), arrivalButtons(D), { focus: keepFocus ? "jBoon" : "jKeep", cls: "jarr", onBack: null });
    const bb = card.querySelector("#jBoon");
    if (bb) bb.addEventListener("click", () => { A.sfxSelect(); takeBoon(); });
}

function continueTrip() {
    const G = ctx.G, D = arr.data;
    H.hideScreen();
    focus.stop = -1;
    G.jArriving = false;
    if (D.i >= N_STOPS - 1) {
        G.jDone = true;
        task.cur = null;
        setTripIcon("🌃");
        H.toast("Endless cruise — how far can you go?", "pink");
    } else {
        armLeg(D.i + 1);
        H.toast(`NEXT STOP: ${STOPS[D.i + 1].name} — ${((stopAt(D.i + 1) - ctx.car.s) / 1609).toFixed(1)} mi!`, "gold");
    }
    if (D.boon) applyBoon(D.boon);
    G.invT = Math.max(G.invT, 2.5);
    setState("playing");
}

registerState("arrivedScreen", {
    hud: false, touch: false,
    enter(data) { if (arr.data) showArrival(); },
    exit() { H.hideScreen(); },
    update(dt, P) {
        arr.t += dt; focus.t = arr.t;
        H.menuInput(P);
        if (Math.random() < dt * 1.5) confetti(5);
    },
    camera(dt) {
        _from.copy(arr.shotFrom).lerp(arr.shotLook, 0.14);
        ctx.cam.cinematic(_from, arr.shotLook, dt, 1.2, 52);
        return true;
    },
});

// ── CALL IT A TRIP ────────────────────────────────────────────────────────
registerState("tripDone", {
    hud: false, touch: false,
    enter() {
        const G = ctx.G, s2 = shared.get();
        J.trips++; saveSoon();
        A.setMusic("../lulu.mp3");
        const next = STOPS[(s2.storyStop || 0) % N_STOPS];
        H.showScreen(`<div class="jarr" style="--acc:#FFE082"><div class="top fin">🏁 TRIP COMPLETE!</div>
            <div class="jstops">${(G.jNames || []).join(" ") || "🚗"}</div>
            <p><b>${G.jStops || 0}</b> stop${G.jStops === 1 ? "" : "s"} this trip · ✈️ furthest trip: <b>${s2.tripBest || 0}</b></p>
            ${statsHtml()}
            <div class="quote">"Lulu, mamele — you call that a road trip? I call it a MITZVAH. Call me when you get home!" <small>— Bubbe 📞</small></div></div>`,
            [
                { label: `🚗 Next chapter: ${next.icon} ${next.nice} ${glyph("confirm")}`, action: () => { H.hideScreen(); startStory(); } },
                { label: "🗺️ Story map", cls: "alt", action: () => { H.hideScreen(); if (ctx.journey.openMap) ctx.journey.openMap({ from: "title" }); } },
                { label: "⌂ Title screen", cls: "purple", action: () => { H.hideScreen(); setState("title"); } },
            ], { onBack: () => { H.hideScreen(); setState("title"); }, cls: "jarr" });
    },
    exit() { H.hideScreen(); },
    update(dt, P) { H.menuInput(P); },
});

// a story-mode game over gets the trip line (stops reached + where the next run starts)
on("state", ({ to }) => {
    if (to !== "gameover" || ctx.G.mode !== "story") return;
    const card = H.screenCard(), s2 = shared.get();
    if (!card) return;
    const next = STOPS[(s2.storyStop || 0) % N_STOPS];
    const p = document.createElement("p");
    p.className = "jover";
    p.innerHTML = `🗺️ ${ctx.G.jStops ? `${ctx.G.jStops} stop${ctx.G.jStops > 1 ? "s" : ""} this trip (${ctx.G.jNames.join(" ")}) · ` : ""}checkpoint: <b>${next.icon} ${next.name}</b>`;
    const menu = card.querySelector(".menu");
    card.insertBefore(p, menu);
    if (menu && ctx.journey.openMap) {
        const b = document.createElement("button");
        b.className = "btn alt";
        b.innerHTML = "🗺️ Story map";
        b.addEventListener("click", () => { A.sfxSelect(); H.hideScreen(); ctx.journey.openMap({ from: "title" }); });
        menu.insertBefore(b, menu.children[1] || null);
        H.refreshFocus(true);
    }
});

// leg music comes back after any scene that changed it
on("state", ({ from, to }) => {
    if (to === "playing" && isStory() && !ctx.G.jDone && from !== "intro" && from !== "arriving") {
        const st = curStop();
        if (st) A.setMusic(st.music);
    }
    if (to !== "arriving" && to !== "arrivedScreen" && focus.stop >= 0 && to !== "storyMap") focus.stop = -1;
});

// ── ctx.journey ───────────────────────────────────────────────────────────
ctx.journey = {
    stops: STOPS,
    stop() { return curStop(); },
    get stopIndex() { return curLeg(); },
    get mode() { return ctx.G.mode; },
    get progress() { return legProgress(); },
    get task() { return task.cur ? { id: task.cur.id, line: taskLine(), met: taskMet() } : null; },
    /** storySpawnBias(name): 1 in cruise; a per-leg multiplier in story mode (pedestrian, heart, heshyPool, iceCream, avigailCar, toll, parade). */
    spawnBias(name) { return isStory() && !ctx.G.jDone ? spawnBiasFor(curLeg(), name) : 1; },
    /** Where stop i is on this run's road (metres). */
    stopS(i) { return stopAt(i); },
    /** Start a story run at leg i (default: the checkpoint). */
    start(i) { startStory(i); },
    openMap: null,   // set by map.js
    get env() { return env.key; },
};
