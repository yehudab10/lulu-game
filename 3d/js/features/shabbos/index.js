// ─────────────────────────────────────────────────────────────────────────
//  features/shabbos — 🕯️ EREV SHABBOS RUSH
//
//  It's Friday afternoon, Lulu's spending Shabbos at Bubbe's, and the sun is
//  going down. Drive from Lakewood to BUBBE'S HOUSE (the journey's stop 0,
//  built in every mode) before candle-lighting.
//
//   · The deadline is the SKY: atmos's Cruise day runs off our clock (G.atmosClock)
//     — a long golden hour, then the pink sunset right at candle-lighting.
//   · The countdown lives in the trip bar ("🕯️ Candles in 2:41 · 1.8 mi"), no extra HUD.
//   · It gets crazier as time runs out: thicker minivan traffic, people rushing home
//     on the sidewalks (challah, a cholent-pot jogger, a bekishe man running for the
//     mikvah), shops pulling their gates down, a flashing "SHABBOS IN 2 MIN" trailer,
//     Ima calling twice (listen to the whole call: she stalls Bubbe, +10 s), and Lulu
//     getting more frantic (banter's line API; respects Chatter: Quiet).
//   · Made it: Bubbe's door opens, Ima lights the candles (⏭ skippable), coins by
//     margin, the 🕯️ "Made It for Candles" badge. Late: a gentle, funny fail card + retry.
//
//  How you find it (roadmap 10 — not a title mode): on FRIDAYS (device clock, noon → evening)
//  it's what Ima asks for at the door when ▶ PLAY starts at home ("🕯️ get to Bubbe's before
//  sunset") — getting in the car starts it (walk off instead: an ordinary day); once she's made
//  it this Friday, Fridays are ordinary again. ▶ PLAY's subtitle says so on the title. On any
//  day, Ima may ring in Cruise — "Oy, it's erev Shabbos!" — and letting it ring turns the drive
//  into the rush. The result card ends back home in the world (features/onegame), not on the title.
//
//  Mode: G.mode = "shabbos" (Restart / Try again / a jail release start a fresh rush).
//  Service: ctx.shabbos (bottom). Events: shabbos:start {via}, shabbos:call {i, result},
//  shabbos:candles {margin, pay}, shabbos:late {}, shabbos:end {made}. Stats: shabbosMade,
//  shabbosLate, shabbosMargin (best). Random parts gated by ctx.enabled("shabbos").
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, hook, emit, registerState, setState, addMenuItem, addActor, css, fmtTime, wrapAngle, pick, rand } from "../../core/ctx.js";
import { save3d, store, saveSoon, shared } from "../../core/save.js";
import { startRun, updateDriving, endRun, addCoins, addScore, statsHtml } from "../../core/driving.js";
import { say } from "../../core/dialog.js";
import { glyph } from "../../input.js";
import { addPlaySub } from "../../core/screens.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { TUNE, MIX_LATE, IMA_CALLS, ERUV_CALL, LULU_LINES, IMA_PORCH, bubbeLine, marginTag, LATE_LINES } from "./data.js";
import { now, setNow, erevShabbos, isFriday } from "./calendar.js";
import { loadProps, ready, placePorch, setPorch, tickPorch, porchPoint, planShops, placeSign, spawnPed, tickProps, propsActor, resetProps, propsInfo } from "./props.js";
import * as SFX from "./sfx.js";

const REC = store("shabbos", { made: 0, late: 0, best: 0, tries: 0, madeDay: "" });
const dayKey = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
/** Friday afternoon, not made it yet today, solo: Ima asks for the rush at the door (features/world's home start). */
export function atDoor() {
    if (!ctx.enabled("shabbos") || (ctx.party && ctx.party.active)) return false;
    const d = now();
    return erevShabbos(d) && REC.madeDay !== dayKey(d);
}

css("shabbos", `
body.shabbos-hurry #tripLabel { color: #FFE082; text-shadow: 0 0 6px rgba(255,87,34,.9), 0 1px 0 rgba(0,0,0,.4); animation: shbPulse .8s ease-in-out infinite; }
@keyframes shbPulse { 50% { transform: scale(1.06); } }
.card.shb { width: min(540px, 100%); padding: 14px 18px 16px; }
.shb .top { font-size: 32px; font-weight: 700; color: #E65100; line-height: 1.05; margin-top: 2px; }
.shb.late .top { color: #6A1B9A; }
.shb .candles { font-size: 34px; letter-spacing: 6px; margin: 2px 0; }
.shb .margin { display: inline-block; background: #3E2723; color: #FFE082; border-radius: 999px; padding: 3px 14px; font-weight: 700; font-size: 15px; }
.shb .quote { text-align: left; border: 2.5px solid #FFB74D; font-size: 17px; padding: 9px 13px; margin: 8px 0; }
.shb .quote small { display: block; font-size: 13px; opacity: .6; margin-top: 2px; }
.shb .rw { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin: 8px 0 4px; }
.shb .pill2 { background: #fff; border-radius: 999px; padding: 5px 14px; font-weight: 700; font-size: 16px; box-shadow: 0 2px 0 rgba(0,0,0,.08); }
.shb .pill2.gold { background: #FFE082; color: #5D4037; font-size: 20px; }
.shb .pill2.badge { background: #FFF3E0; color: #E65100; }
.shb .pill2.grey { background: #ECEFF1; color: #607D8B; font-weight: 600; font-size: 14px; }
.shb .line { font-size: 13.5px; font-weight: 600; opacity: .75; margin: 4px 0 0; }
@media (min-aspect-ratio: 5/4) and (min-width: 820px) {
  .screen:has(.card.shb.made) { justify-content: flex-start; padding-left: max(3vw, 18px); background: linear-gradient(90deg, rgba(43,27,46,.4), rgba(43,27,46,0) 62%); }
  .card.shb.made { width: min(480px, 46vw); }
}
.card.shb .menu { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 8px; }
.card.shb .menu .btn { width: auto; flex: 1 1 200px; }
@media (max-height: 520px) {
  .card.shb { padding: 8px 14px 10px; } .shb .candles { display: none; } .shb .top { font-size: 22px; }
  .shb .margin { font-size: 13px; padding: 2px 10px; } .shb .quote { font-size: 14px; padding: 6px 10px; margin: 5px 0; }
  .shb .rw { margin: 4px 0 2px; gap: 5px; } .shb .pill2 { font-size: 13px; padding: 3px 10px; } .shb .pill2.gold { font-size: 16px; }
  .shb .stats { display: none; } .card.shb .menu { margin-top: 6px; } .card.shb .menu .btn { padding: 8px 12px; font-size: 15px; }
}
@media (max-width: 600px) { .shb .top { font-size: 26px; } .shb .quote { font-size: 15.5px; } .shb .stats .stat { min-width: 66px; padding: 6px 8px; } }
body.tv .shb .top { font-size: 50px; } body.tv .shb .pill2 { font-size: 24px; } body.tv .shb .quote { font-size: 26px; }
/* TV: the card's own (slimmer) padding, and wider beside the porch — at 480 px with TV padding the longest Bubbe line,
   the badge pill, the stats and the buttons all wrapped and the card scrolled at 1920 × 1080 (it must fit on any day) */
body.tv .card.shb { padding: 22px 28px 24px; }
@media (min-aspect-ratio: 5/4) and (min-width: 820px) { body.tv .card.shb.made { width: min(660px, 40vw); } }
`);

// ── the run state ──────────────────────────────────────────────────────────
const R = {
    active: false, phase: "", via: "", s0: 0, dest: 0, total: 0, used: 0, bonus: 0,
    blendFrom: null, blendT: 0, ima: 0, lineT: 0, said: {}, pedT: 0, signs: 0, ticks: 0,
    margin: 0, pay: 0, newBadge: false, late: "", saved: null, actor: null, arr: null, waits: [],
    cruiseT: 60, cruiseRolled: true,
};
const left = () => R.total + R.bonus - R.used;
const frac = () => Math.max(0, R.used / Math.max(1, R.total + R.bonus));
/** Where Bubbe's house is (the journey's stop 0; our own fallback spot without it). */
function destS(from) {
    if (ctx.journey && ctx.journey.stopS) return ctx.journey.stopS(0);
    return from + 4600;
}
const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";

// the sky clock: golden hour → candles at sunset → dusk if she's late
function skyClock() {
    const u = frac();
    let c = u <= 1 ? TUNE.clockStart + (TUNE.clockCandles - TUNE.clockStart) * u
        : Math.min(TUNE.clockLate, TUNE.clockCandles + (u - 1) * 0.4);
    if (R.phase === "late") c = Math.min(TUNE.clockLate, Math.max(c, TUNE.clockCandles + 0.012 + Math.min(1, ctx.stateT / 8) * 0.03));
    if (R.blendFrom != null && R.blendT < 6) {          // a Cruise turned into a rush: time flies forward
        const k = R.blendT / 6, e = k * k * (3 - 2 * k);
        let from = R.blendFrom;
        if (from > c) from -= 1;
        c = ((from + (c - from) * e) % 1 + 1) % 1;
    }
    return c;
}

// ── arming / tearing down ─────────────────────────────────────────────────
function arm(G, via) {
    teardown(false);
    const car = ctx.car;
    Object.assign(R, {
        active: true, phase: "drive", via, s0: car.s, used: 0, bonus: 0, ima: 0, said: {}, signs: 0, ticks: 0,
        pedT: 4, lineT: 9, margin: 0, pay: 0, newBadge: false, late: "", arr: null, waits: [], blendFrom: null, blendT: 0,
    });
    R.dest = destS(car.s);
    R.total = Math.round(Math.max(TUNE.minT, TUNE.baseT + (R.dest - R.s0) / TUNE.pace));
    if (via === "cruise" && ctx.atmos) { R.blendFrom = ctx.atmos.clock; R.blendT = 0; }
    G.mode = "shabbos";
    G.atmosClock = skyClock;
    G.atmosClear = true;
    G.goText = "🕯️ Beat the sunset to Bubbe's!";
    G.music = "../story-electric.mp3";
    if (via !== "cruise") G.musicSet = true;
    A.setMusic(G.music);
    const cfg = ctx.traffic.config;
    R.saved = { ours: cfg.ours, oncoming: cfg.oncoming, mix: { sedan: cfg.mix.sedan, van: cfg.mix.van, truck: cfg.mix.truck } };
    setTripIcon("🏡");
    REC.tries++; saveSoon();
    R.actor = addActor(propsActor());
    loadProps().then(() => {
        if (!R.active) return;
        placePorch(R.dest);
        planShops(R.s0, R.dest);
    }).catch(() => {});
    emit("shabbos:start", { via, total: R.total, dest: R.dest });
}
/** End the rush's world changes (traffic, sky, props, HUD). */
function teardown(keepCard = true) {
    if (R.saved && ctx.traffic) {
        const cfg = ctx.traffic.config;
        cfg.ours = R.saved.ours; cfg.oncoming = R.saved.oncoming;
        Object.assign(cfg.mix, R.saved.mix);
        R.saved = null;
    }
    if (R.active && ctx.G) { delete ctx.G.atmosClock; delete ctx.G.atmosClear; }
    R.active = false;
    for (const w of R.waits) w.resolve();
    R.waits = [];
    resetProps();
    document.body.classList.remove("shabbos-hurry");
    if (R.actor) { const i = ctx.actors.indexOf(R.actor); if (i >= 0) ctx.actors.splice(i, 1); R.actor = null; }
}
function setTripIcon(icon) {
    const el = document.querySelector(".trip-to");
    if (el && el.textContent !== icon) el.textContent = icon;
}

/** Start a fresh rush from the start of the road. */
export function startRush(via = "title") {
    R.via = via;
    if (ctx.paused) { H.hideScreen(); ctx.paused = false; }
    H.hideScreen();
    startRun({ mode: "shabbos", shabbosVia: via });
}

hook("runStart", (G, opts) => {
    // a fresh run tears down the last rush; the rush only arms for an explicit shabbos start
    // (title chip, retry, Restart, a jail release) — not the title screen's attract loop
    if (opts && opts.mode === "shabbos") arm(G, opts.shabbosVia || "retry");
    else { if (R.active) teardown(); if (G.mode === "shabbos") G.mode = "cruise"; }
    R.cruiseT = rand(TUNE.cruise.firstAt[0], TUNE.cruise.firstAt[1]);
    R.cruiseRolled = false;
}, -20);
on("run:end", () => { if (R.active && R.phase === "drive") teardown(); });
on("state", ({ to }) => {
    if (to === "title") { teardown(); setTripIcon("🏡"); }
    if (to !== "playing") document.body.classList.remove("shabbos-hurry");
});

// ── the trip bar carries the countdown (no extra HUD) ────────────────────
on("boot", () => {
    const base = ctx.trip;
    ctx.trip = {
        progress() {
            if (!R.active) return base ? base.progress() : 1;
            if (R.phase !== "drive") return 1;
            return Math.max(0, Math.min(1, (ctx.car.s - R.s0) / Math.max(1, R.dest - TUNE.pullIn - R.s0)));
        },
        label() {
            if (!R.active) return base ? base.label() : `CRUISE · ${Math.max(0, (ctx.car.s - (ctx.G.startS || 0)) / 1609).toFixed(1)} mi`;
            if (R.phase === "arrive" || R.phase === "done") return "🏡 BUBBE'S HOUSE · GOOD SHABBOS!";
            if (R.phase === "late") return "🕯️ Candles are lit…";
            const l = Math.max(0, left()), mi = Math.max(0, (R.dest - ctx.car.s) / 1609);
            return l < 30 ? `🕯️ CANDLES IN ${fmtTime(Math.ceil(l))}! · ${mi.toFixed(1)} mi` : `🕯️ Candles in ${fmtTime(Math.ceil(l))} · ${mi.toFixed(1)} mi`;
        },
    };
    // during a rush the only Ima calls are OURS (no random "did you eat?" on top)
    const ph = ctx.phone;
    if (ph && typeof ph.call === "function" && !ph.__shabbos) {
        const orig = ph.call;
        try {
            ph.call = function (opts) {
                if (R.active && opts && !opts.shabbos && /^IMA$/i.test(String(opts.from || ""))) return null;
                return orig.apply(this, arguments);
            };
            ph.__shabbos = true;
        } catch (e) { /* a sealed phone: Ima may call extra, that's all */ }
    }
});

// ── per frame while driving ──────────────────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    if (!R.active) { cruiseEvent(dt); return; }
    if (R.blendFrom != null) R.blendT += dt;
    for (let i = R.waits.length - 1; i >= 0; i--) if (ctx.stateT >= R.waits[i].at || ctx.state !== R.waits[i].state) { R.waits[i].resolve(); R.waits.splice(i, 1); }
    if (R.phase === "drive") {
        if (ctx.state === "playing" && controlsOn) {
            R.used += dt;
            escalate(dt);
            if (left() <= 0) { lateNow(); return; }
            if (ctx.car.s >= R.dest - TUNE.pullIn) { arrive(); return; }
        }
        const u = Math.min(1.2, frac());
        tickProps(dt, u, left());
    }
});

function escalate(dt) {
    const u = Math.min(1, frac()), l = left(), G = ctx.G;
    // traffic thickens: everyone's rushing home, in minivans
    const cfg = ctx.traffic.config, S = R.saved;
    if (S) {
        cfg.ours = Math.round(TUNE.trafficOurs[0] + (TUNE.trafficOurs[1] - TUNE.trafficOurs[0]) * u);
        cfg.oncoming = Math.round(TUNE.trafficOnc[0] + (TUNE.trafficOnc[1] - TUNE.trafficOnc[0]) * u);
        for (const k of ["sedan", "van", "truck"]) cfg.mix[k] = (S.mix[k] || 0) + (MIX_LATE[k] - (S.mix[k] || 0)) * u;
    }
    // people rushing home
    R.pedT -= dt;
    if (R.pedT <= 0 && u >= TUNE.pedFrom && ready()) {
        R.pedT = TUNE.pedGap[0] + (TUNE.pedGap[1] - TUNE.pedGap[0]) * u;
        const types = u < 0.3 ? ["challah", "challah", "cholent"] : u < 0.55 ? ["challah", "cholent", "bekishe"] : ["cholent", "bekishe", "bekishe", "challah"];
        spawnPed(pick(types));
    }
    // the LED trailer
    if (R.signs < TUNE.signAt.length && u >= TUNE.signAt[R.signs]) { if (placeSign(220)) R.signs++; }
    // Ima rings (twice)
    // (random calls paused: the rush has no calls — skip them so this doesn't retry every frame)
    if (ctx.phone && !ctx.phone.randomCalls) R.ima = IMA_CALLS.length;
    if (R.ima < IMA_CALLS.length && u >= TUNE.imaCalls[R.ima] && ctx.phone && !ctx.phone.busy()) imaCall(R.ima);
    // beats
    if (!R.said.sun && u >= 0.5) { R.said.sun = true; H.toast("🌇 The sun's getting low…", "gold", { key: "shabbos-sun" }); }
    if (!R.said.minute && l <= 60) {
        R.said.minute = true;
        H.banner(`🕯️ <b>ONE MINUTE TO CANDLES!</b><small>Bubbe's at the window…</small>`, 2400, { prio: 2, key: "shabbos" });
        luluSay(LULU_LINES.minute, true);
    }
    if (!R.said.last && l <= 10) { R.said.last = true; luluSay(LULU_LINES.last, true); }
    document.body.classList.toggle("shabbos-hurry", l <= 30);
    if (l <= 10) { const s = Math.ceil(l); if (s !== R.ticks) { R.ticks = s; SFX.tick(s <= 3); } }
    // Lulu, more frantic by the minute (Chatty talks more, Quiet keeps to the big moments)
    R.lineT -= dt;
    if (R.lineT <= 0) {
        const ch = chatter();
        R.lineT = ch === "chatty" ? rand(12, 16) : rand(22, 30);
        if (ch !== "quiet") {
            const stage = u < 0.35 ? "calm" : u < 0.7 ? "hurry" : "frantic";
            if (!luluSay(pick(LULU_LINES[stage]))) R.lineT = 2;
        }
    }
}
function luluSay(text, big = false) {
    if (!ctx.banter || !ctx.banter.say) return false;
    if (!big && chatter() === "quiet") return false;
    try { return !!ctx.banter.say(text); } catch (e) { return false; }
}

// ── Ima's two calls ──────────────────────────────────────────────────────
function imaCall(i) {
    const def = IMA_CALLS[i];
    const c = ctx.phone.call({
        from: "IMA", shabbos: true, emoji: "📞", talkEmoji: "🗣️", color: "#FF80AB", lines: def.lines, flip: true, declinable: true,
        ringText: `📣 ${glyph("honk")} HONK = "I'm DRIVING, Ima!"`, ringSub: "…or pick up: she can stall Bubbe (+0:10)",
        talkSub: "🔄 steering's flipped! · 📣 {honk} to hang up",
        doneText: r => def.done[r] || "",
        onDone(r) {
            if (r === "interrupted") return;
            if (r === "full" && R.active && R.phase === "drive") { R.bonus += TUNE.imaBonus; H.toast(`⏱️ +0:${String(TUNE.imaBonus).padStart(2, "0")} — Ima's stalling Bubbe`, "pink"); }
            emit("stat", { id: r === "full" ? "imaCalls" : "imaDeclines", n: 1 });
            emit("shabbos:call", { i, result: r });
        },
    });
    if (c) R.ima++;
}

// ── the rare Cruise event: "Oy, it's erev Shabbos!" ──────────────────────
function cruiseEvent(dt) {
    const G = ctx.G;
    if (G.mode !== "cruise" || ctx.state !== "playing" || R.cruiseRolled || !ctx.enabled("shabbos")) return;
    R.cruiseT -= dt;
    if (R.cruiseT > 0) return;
    R.cruiseRolled = true;
    if (Math.random() < (isFriday(now()) ? TUNE.cruise.fridayChance : TUNE.cruise.chance)) offer();
}
/** Ima rings in Cruise; let it ring (pick up) and the drive becomes the rush. */
export function offer() {
    const G = ctx.G, car = ctx.car;
    if (!ctx.phone || ctx.phone.busy() || R.active || G.mode !== "cruise" || ctx.state !== "playing") return false;
    if (ctx.party && ctx.party.active) return false;
    if (ctx.hustle && ctx.hustle.job) return false;
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted > 0)) return false;
    if (ctx.foot && ctx.foot.active) return false;
    const dest = destS(car.s);
    if (car.s < TUNE.cruise.minS || dest - car.s < TUNE.cruise.minLeft) return false;
    if (ctx.atmos && ctx.atmos.clock > TUNE.clockStart - 0.01) return false;     // it's already evening / night
    const c = ctx.phone.call({
        from: "IMA", shabbos: true, emoji: "📞", talkEmoji: "🕯️", color: "#FFB74D", lines: ERUV_CALL.lines, flip: false, declinable: true,
        ringText: `📣 ${glyph("honk")} HONK = "Not this week, Ima!"`, ringSub: "…or let it ring: race the sunset to Bubbe's 🕯️",
        talkSub: "🕯️ Erev Shabbos Rush — get to Bubbe's!",
        onAnswer() {
            if (ctx.G.mode !== "cruise" || R.active) return;
            arm(ctx.G, "cruise");
            H.banner(`🕯️ <b>Oy, it's erev Shabbos!</b><small>Beat the sunset to Bubbe's — ${fmtTime(R.total)}</small>`, 2800, { prio: 2, key: "shabbos" });
        },
        doneText: r => r === "declined" ? "Ima: \"Fine. I'll tell Bubbe you're 'busy.'\"" : "",
    });
    return !!c;
}

// ── made it ──────────────────────────────────────────────────────────────
const _from = new THREE.Vector3(), _look = new THREE.Vector3(), _tgt = new THREE.Vector3();
function wait(sec) { return new Promise(resolve => R.waits.push({ at: ctx.stateT + sec, state: ctx.state, resolve })); }
function arrive() {
    const G = ctx.G;
    R.phase = "arrive";
    R.margin = Math.max(0, left());
    // Bubbe's porch is sanctuary: the cops wish her a good Shabbos
    if (ctx.law && (ctx.law.chasing || ctx.law.wanted > 0) && ctx.law.clearHeat) ctx.law.clearHeat("👮 The cops: \"…Good Shabbos, ma'am.\"");
    if (ctx.phone && ctx.phone.busy()) ctx.phone.hangUp(true);
    // rewards (once)
    const before = (shared.get().stats || {}).shabbosMade || 0;
    R.pay = Math.min(TUNE.pay.max, TUNE.pay.base + TUNE.pay.perSec * Math.floor(R.margin));
    addCoins(R.pay, "shabbos");
    addScore(1000 + Math.floor(R.margin) * 20, "shabbos");
    R.newBadge = before === 0;
    REC.madeDay = dayKey(now()); saveSoon();
    R.newBest = R.margin > REC.best;
    REC.made++; REC.best = Math.max(REC.best, Math.round(R.margin)); saveSoon();
    emit("stat", { id: "shabbosMade", n: 1 });
    emit("stat", { id: "shabbosMargin", best: Math.round(R.margin) });
    emit("shabbos:candles", { margin: R.margin, pay: R.pay });
    document.body.classList.remove("shabbos-hurry");
    if (!ready() || !placePorchNow()) { setState("shabbosResult", { made: true }); return; }
    setState("shabbosArrive");
}
function placePorchNow() {
    if (!ready()) return false;
    if (!(propsInfo().porch)) placePorch(R.dest);
    return propsInfo().porch;
}
function pullCtl(T) {
    const car = ctx.car;
    const dx = T.x - car.pos.x, dz = T.z - car.pos.z, dist = Math.hypot(dx, dz);
    const diff = wrapAngle(Math.atan2(dx, dz) - car.h);
    const vWant = Math.min(18, dist * 0.75);
    if (dist < 2.2 || Math.abs(diff) > 2.2) return { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true, dist };
    return { steer: THREE.MathUtils.clamp(-diff * 2.6, -1, 1), throttle: car.speed < vWant ? 0.55 : 0, brake: car.speed > vWant + 1.5 ? 0.7 : 0, handbrake: false, analog: true, dist };
}

registerState("shabbosArrive", {
    hud: false, touch: false, driving: true, pausable: false, skip: true,
    enter() {
        const road = ctx.world.road, S = R.dest;
        // stuck way off (a chase)? glide in from just up the road
        if (ctx.car.s < S - TUNE.pullIn - 80 || ctx.car.s > S + 20) {
            const p = road.point(S - 60, 5.25, {});
            ctx.car.place(p.x, p.z, p.h);
            ctx.car.vx = Math.sin(p.h) * 12; ctx.car.vz = Math.cos(p.h) * 12;
        }
        R.arr = { target: road.point(S - 3, 12.5, {}), talk: false, bless: false, scripted: false };
        setPorch(0, 0);
        ctx.cam.blend(0.6);
        A.sfxHorn(false);
        H.banner(`🏡 <b>BUBBE'S HOUSE!</b><small>${fmtTime(Math.floor(R.margin))} to spare 🕯️</small>`, 2400, { prio: 2, key: "shabbos" });
    },
    update(dt, P) {
        const a = R.arr, t = ctx.stateT;
        const ctl = a.parked ? { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true } : pullCtl(a.target);
        updateDriving(dt, {}, false, ctl);
        if (!a.parked && ((ctl.dist < 2.6 && ctx.car.speed < 1.5) || t > 3.2)) a.parked = true;
        // the door swings open on the warm hallway
        setPorch(Math.max(0, Math.min(1, (t - 1.0) / 0.9)), R.arr.lit || 0);
        tickPorch(dt, { talk: a.talk, bless: a.bless, cheer: a.cheer });
        if (a.parked && !a.scripted) {
            a.scripted = true;
            (async () => {
                a.talk = true;
                await say("Ima", IMA_PORCH, { emoji: "👩", color: "#E91E63", auto: 1.8 });
                a.talk = false; a.bless = true;
                await wait(0.35);
                R.arr.lit = 1; SFX.candles();
                await wait(0.45);
                R.arr.lit = 2;
                emit("stat", { id: "shabbosCandles", n: 1 });
                await wait(0.9);
                a.bless = false; a.cheer = true;
                await say("Bubbe", bubbeLine(R.margin), { emoji: "👵", color: "#B8860B", auto: 2.2 });
                if (ctx.state === "shabbosArrive") setState("shabbosResult", { made: true });
            })().catch(e => console.error("[shabbos] arrival", e));
        }
    },
    camera(dt) { return porchCam(dt, 0); },
});
function porchCam(dt, card) {
    if (!propsInfo().porch) return false;
    // from the driveway side: the open door, Ima at the candle table, the cholent steaming on the
    // right; Bubbe waving out in the yard sits at the left edge (she's the journey's greeter)
    const k = Math.min(1, ctx.stateT / 5);
    porchPoint(7.0 - k * 0.8, 2.7 - k * 0.2, 14.0 - k * 1.0, _from);
    porchPoint(-0.9, 1.3, 5.0, _look);
    ctx.cam.cinematic(_from, _look, dt, 1.4, 50);
    // the card sits on the left on wide screens → turn so the porch shows on the right
    if (card && ctx.camera.aspect > 1.25 && window.innerWidth >= 820) ctx.camera.rotateY(0.3);
    return true;
}

// ── too late ─────────────────────────────────────────────────────────────
function lateNow() {
    R.phase = "late";
    R.late = pick(LATE_LINES);
    REC.late++; saveSoon();
    emit("stat", { id: "shabbosLate", n: 1 });
    emit("shabbos:late", {});
    if (ctx.phone && ctx.phone.busy()) ctx.phone.hangUp(true);
    document.body.classList.remove("shabbos-hurry");
    SFX.late();
    setState("shabbosResult", { made: false });
}

// ── the result card (made it / late) ─────────────────────────────────────
function resultHtml(made) {
    const G = ctx.G, rows = [];
    if (made) {
        rows.push(`<div class="candles">🕯️🕯️</div><div class="top">MADE IT FOR CANDLES!</div>`);
        rows.push(`<div class="margin">${fmtTime(Math.floor(R.margin))} to spare · ${marginTag(R.margin)}</div>`);
        rows.push(`<div class="quote">"${bubbeLine(R.margin)}"<small>— Bubbe 👵</small></div>`);
        const rw = [`<span class="pill2 gold">+${R.pay} 💰</span>`];
        if (R.newBadge) rw.push(`<span class="pill2 badge">🏆 New badge: 🕯️ Made It for Candles</span>`);
        rw.push(R.newBest && REC.made > 1 ? `<span class="pill2 gold">⏱️ New best margin!</span>` : `<span class="pill2 grey">best: ${fmtTime(REC.best)} to spare</span>`);
        rows.push(`<div class="rw">${rw.join("")}</div>`);
    } else {
        rows.push(`<div class="candles">🕯️🌙</div><div class="top">Too late for candles…</div>`);
        rows.push(`<div class="quote">${R.late}<small>— the family group chat 📱</small></div>`);
        const mi = Math.max(0, (R.dest - ctx.car.s) / 1609);
        rows.push(`<div class="rw"><span class="pill2 grey">${mi < 0.1 ? "SO close" : `${mi.toFixed(1)} mi short`}</span>${REC.made ? `<span class="pill2 grey">made it ${REC.made}× before</span>` : ""}</div>`);
    }
    rows.push(statsHtml());
    return `<div class="shb ${made ? "made" : "late"}">${rows.join("")}</div>`;
}
/** The card's way out: back in the world at home (features/onegame), or the title without it. */
function headHome() {
    if (ctx.onegame && ctx.onegame.home) ctx.onegame.home({ via: "shabbos" });
    else setState("title");
}
registerState("shabbosResult", {
    hud: false, touch: false, world: true,
    enter({ made }) {
        R.phase = made ? "done" : "late";
        R.made = !!made;
        endRun(made ? "shabbos" : "shabbosLate");
        emit("shabbos:end", { made: !!made, margin: R.margin });
        if (made) A.sfxFanfare();
        H.showScreen(resultHtml(made), [
            { id: "shbAgain", label: made ? `↺ Race the sunset again ${glyph("confirm")}` : `↺ Try again ${glyph("confirm")}`, action: () => startRush("retry") },
            { id: "shbTitle", label: made ? "🏠 Good Shabbos! (head home)" : "🏠 Head home", cls: "alt", action: () => { H.hideScreen(); headHome(); } },
        ], { focus: "shbAgain", cls: "shb" + (made ? " made" : ""), onBack: () => { H.hideScreen(); headHome(); } });
    },
    exit() { H.hideScreen(); if (R.active && R.phase !== "drive") teardown(); },
    update(dt, P) {
        H.menuInput(P);
        updateDriving(dt, {}, false, R.made ? { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true } : null);
        if (R.made) tickPorch(dt, { cheer: true });
    },
    // late: our own shot (behind the stopped car, out to the sunset). Without one, core falls back to
    // the title camera hooks, where the journey repaints its daytime palette after atmos has ticked.
    camera(dt) { return R.made ? porchCam(dt, 1) : lateCam(dt); },
});
function lateCam(dt) {
    const car = ctx.car, fx = Math.sin(car.h), fz = Math.cos(car.h);
    _from.set(car.pos.x - fx * 9, 3.4, car.pos.z - fz * 9);
    _look.set(car.pos.x + fx * 40, 4.5, car.pos.z + fz * 40);
    ctx.cam.cinematic(_from, _look, dt, 1.2, 55);
    return true;
}

// ── Friday at the door (roadmap 10: no title chip — ▶ PLAY's subtitle says it, Ima asks at home) ─────
// world's home start asks atDoor() for Ima's line; getting in her car (world:depart) arms the rush, from the driveway.
const DOOR = { on: false };
on("world:homeStart", ({ mode }) => { DOOR.on = mode === "cruise" && atDoor(); if (DOOR.on) H.toast("🕯️ Erev Shabbos! Get in the car — beat the sunset to Bubbe's", "gold", { key: "shabbos-door" }); });
on("run:start", () => { DOOR.on = false; });
on("world:depart", ({ mode, left }) => {
    if (!DOOR.on) return;
    DOOR.on = false;
    if (mode !== "cruise" || left || R.active || !atDoor()) return;      // (she walked off first: an ordinary day)
    arm(ctx.G, "home");
    H.banner(`🕯️ <b>Erev Shabbos Rush!</b><small>Beat the sunset to Bubbe's — ${fmtTime(R.total)}</small>`, 2600, { prio: 2, key: "shabbos" });
});
addPlaySub(() => atDoor() ? `🕯️ <b>Erev Shabbos!</b> Ima needs you at Bubbe's before sunset` : "", 10);

// ── the service ──────────────────────────────────────────────────────────
ctx.shabbos = {
    /** A rush is on (driving, arriving or on its result card). */
    get active() { return R.active; },
    get phase() { return R.phase; },
    /** Seconds to candle-lighting (incl. Ima's stalling). */
    get left() { return R.active ? left() : 0; },
    get total() { return R.total; },
    get dest() { return R.dest; },
    /** Start a fresh rush (title chip / retry). */
    start: (via = "title") => startRush(via),
    /** Cruise: Ima rings with "Oy, it's erev Shabbos!" (false if now's not a good moment). */
    offer,
    /** Is it Friday afternoon on this device? */
    friday: () => erevShabbos(now()),
    /** Friday afternoon + not made it yet today: Ima asks for it at the door (world's home start). */
    atDoor,
    records: REC,
    debug: {
        /** Pin the device clock ("2026-11-20T15:00", local) — null = the real clock. */
        date(iso) { setNow(iso); return now().toString(); },
        /** Jump the countdown: seconds left. */
        setLeft(sec) { if (R.active) R.used = R.total + R.bonus - sec; return left(); },
        /** Jump to a fraction of the time used (0..1). */
        setFrac(u) { if (R.active) R.used = (R.total + R.bonus) * u; return frac(); },
        /** Lulu's next frantic line is due now. */
        line() { R.lineT = 0; return true; },
        props: () => propsInfo(),
        info: () => ({ active: R.active, phase: R.phase, via: R.via, s0: Math.round(R.s0), dest: Math.round(R.dest), total: R.total, used: +R.used.toFixed(2),
            bonus: R.bonus, left: +left().toFixed(2), ima: R.ima, signs: R.signs, margin: +R.margin.toFixed(2), pay: R.pay, clock: R.active ? +skyClock().toFixed(4) : null }),
    },
};
