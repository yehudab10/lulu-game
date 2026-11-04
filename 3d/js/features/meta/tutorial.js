// features/meta — the FIRST-DRIVE TUTORIAL (port of src/10g-tutorial.js).
// Quick steps taught DURING a real run: each advances when the player actually
// does the thing (or after a generous timeout), so it never feels like homework.
// Only for a genuinely new 3D player (no 3D best score yet); "Skip" (the pill, or
// ⏭ in the pause menu) ends it forever. Non-modal: it's a HUD card, the game
// never stops. 3D-only flag: store("meta").tutorialDone.
import { ctx, on, hook, emit, addMenuItem, css } from "../../core/ctx.js";
import { save3d, saveSoon, store } from "../../core/save.js";
import { input, glyph } from "../../input.js";
import * as H from "../../hud.js";
import { resume } from "../../core/screens.js";
import { tone, note } from "./util.js";

export const M = store("meta", { tutorialDone: false });

const g = a => glyph(a);
const touch = () => input.device === "touch";
// a/b: the two text lines (strings or functions of G). done(T, G): learnt it?
// The ROAD TRIP and STAY ALIVE beats are info only (min === timeout).
// point: on touch screens, which on-screen control to pulse during the step (2D: the 👇 arrow)
const STEPS = [
    { icon: "🏡", title: "ROAD TRIP!",
      a: G => G.mode === "story" ? "You're driving to Bubbe's for Shabbos —" : "Endless cruise — how far can you go?",
      b: G => G.mode === "story" ? "watch the bar up top. Hot cholent awaits!" : "watch the miles tick up top.", min: 3.4, timeout: 3.4 },
    { icon: "🕹️", title: "STEER",
      a: () => touch() ? "Drag the STEER stick" : `${g("steer")} to steer`, b: "to weave through traffic.",
      min: 1.2, timeout: 99, done: T => T.steerAcc > 6, point: ["stickBase"] },
    { icon: "⏫", title: "SPEED",
      a: () => touch() ? "Hold GAS to go, BRAKE to slow —" : `Hold ${g("gas")} to go, ${g("brake")} to brake —`, b: "hold the brake when stopped to reverse.",
      min: 1.2, timeout: 12, done: T => T.speedHeld > 0.7, point: ["tGas", "tBrake"] },
    { icon: "🔥", title: "NITRO",
      a: () => `Tap ${g("boost")} for a blast of NITRO —`, b: "coins & close calls refill the flame bar.",
      min: 1.2, timeout: 10, done: T => T.boosted, point: ["tBoost"] },
    { icon: "🪙", title: "COINS", a: "Grab coins — quick pickups", b: "chain into a COMBO.",
      min: 1.2, timeout: 10, done: (T, G) => G.coins > T.coins0 },
    { icon: "😤", title: "CLOSE CALLS", a: "Shave past cars for bonus points —", b: "chain them to multiply your score!",
      min: 1.2, timeout: 10, done: (T, G) => G.closeCalls > T.cc0 },
    { icon: "📣", title: "HONK",
      a: () => `${g("honk")} honks — slowpokes in your lane`, b: "scoot over (or speed up). Rude? A little.",
      min: 1.2, timeout: 8, done: T => T.honked, point: ["tHonk"] },
    { icon: "❤️", title: "STAY ALIVE", a: "Hearts are lives — crashes cost one.", b: "Good luck out there, Lulu! 🍀", min: 3.5, timeout: 3.5 },
];

css("meta-tut", `
#metaTutBox { position: absolute; left: 50%; transform: translateX(-50%); bottom: calc(max(14px, env(safe-area-inset-bottom)) + 46px);
  pointer-events: none; z-index: 3; }
body.touch #metaTutBox { bottom: auto; top: calc(max(12px, env(safe-area-inset-top)) + 104px); }
@media (max-aspect-ratio: 1/1) { body.touch #metaTutBox { top: calc(max(12px, env(safe-area-inset-top)) + 206px); } }
body.tv #metaTutBox { bottom: calc(3vh + 64px); }
#metaTutBox .skip { pointer-events: auto; }
.meta-tut { position: relative; display: flex; gap: 12px; align-items: center; width: min(460px, 92vw); padding: 10px 14px 18px 10px;
  background: rgba(20,28,36,.88); border: 2.5px solid rgba(255,193,7,.85); border-radius: 18px; color: #ECEFF1;
  box-shadow: 0 6px 22px rgba(0,0,0,.3); animation: metaTutIn .3s cubic-bezier(.2,1.6,.4,1); }
.meta-tut.ok { border-color: #66BB6A; }
.meta-tut .ic { flex: none; width: 58px; height: 58px; border-radius: 14px; background: rgba(255,255,255,.08); display: flex;
  align-items: center; justify-content: center; font-size: 32px; }
.meta-tut .tx { flex: 1; min-width: 0; text-align: left; }
.meta-tut .tt { font-weight: 700; font-size: 15px; color: #FFD54F; letter-spacing: .06em; }
.meta-tut .ln { font-weight: 600; font-size: 14px; line-height: 1.3; }
.meta-tut .ln .glyph { background: #fff; color: #2b1b2e; height: 20px; min-width: 20px; font-size: 12px; }
.meta-tut .pips { position: absolute; left: 82px; bottom: 7px; display: flex; gap: 6px; }
.meta-tut .pips i { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.25); }
.meta-tut .pips i.d { background: #66BB6A; } .meta-tut .pips i.c { background: #FFD54F; }
.meta-tut .skip { position: absolute; right: 8px; bottom: 4px; border: none; background: rgba(255,255,255,.12); color: #ECEFF1;
  font: 700 11px var(--font); border-radius: 999px; padding: 3px 10px; cursor: pointer; }
.meta-point { animation: metaPoint .8s ease-in-out infinite alternate !important; }
@keyframes metaPoint { from { box-shadow: 0 0 0 0 rgba(255,213,79,.0); } to { box-shadow: 0 0 0 7px rgba(255,213,79,.95), 0 0 22px 8px rgba(255,213,79,.6); } }
@keyframes metaTutIn { from { transform: scale(.7); opacity: 0; } to { transform: none; opacity: 1; } }
body.tv .meta-tut { width: min(760px, 60vw); padding: 16px 22px 26px 16px; }
body.tv .meta-tut .ic { width: 86px; height: 86px; font-size: 48px; }
body.tv .meta-tut .tt { font-size: 24px; } body.tv .meta-tut .ln { font-size: 22px; } body.tv .meta-tut .pips { left: 118px; }
`);

let T = null;      // the running tutorial (null = off)
let el = null;

export const tutorialActive = () => !!T;
/** The live tutorial state (tests poke .t to fast-forward a beat). */
export const tutState = () => T;

function wants() {
    return ctx.enabled("meta") && !M.tutorialDone && !(save3d.best > 0) && !/dina|foot/i.test(ctx.G.mode || "");
}
function start() {
    const G = ctx.G;
    T = { step: 0, t: 0, steerAcc: 0, lastD: ctx.car.d, speedHeld: 0, boosted: false, honked: false, coins0: G.coins, cc0: G.closeCalls, okT: 0, shown: -1, key: "" };
    G.tutorial = true;
}
export function finishTutorial(skipped) {
    if (!T) return;
    T = null;
    ctx.G.tutorial = false;
    M.tutorialDone = true;
    saveSoon();
    if (el) { el.remove(); el = null; }
    point(null);
    if (!skipped) { note("🎉 You're ready!", "gold"); tone(523, 0.1, "triangle", 0.14, 0, 784); }
    emit("tutorial:done", { skipped: !!skipped });
}

const txt = (v, G) => (typeof v === "function" ? v(G) : v);
let pointed = [];
function point(ids) {
    for (const e of pointed) e.classList.remove("meta-point");
    pointed = [];
    for (const id of ids || []) { const e = document.getElementById(id); if (e) { e.classList.add("meta-point"); pointed.push(e); } }
}
function render(force) {
    if (!T) return;
    const st = STEPS[T.step], G = ctx.G;
    // re-render on step change or when the device (→ glyphs) changes
    const key = T.step + "|" + input.device + "|" + input.padKind;
    if (!force && key === T.key && el && el.isConnected) { el.classList.toggle("ok", T.okT > 0); return; }
    const newStep = T.shown !== T.step;
    T.key = key; T.shown = T.step;
    if (!el || !el.isConnected) {
        let box = document.getElementById("metaTutBox");
        if (!box) { box = document.createElement("div"); box.id = "metaTutBox"; document.getElementById("hud").appendChild(box); }
        el = document.createElement("div");
        el.className = "meta-tut";
        box.appendChild(el);
    }
    el.innerHTML = `<div class="ic">${st.icon}</div><div class="tx"><div class="tt">${st.title}</div>
        <div class="ln">${txt(st.a, G)}</div><div class="ln">${txt(st.b, G)}</div></div>
        <div class="pips">${STEPS.map((_, i) => `<i class="${i < T.step ? "d" : i === T.step ? "c" : ""}"></i>`).join("")}</div>
        <button class="skip" type="button">Skip tutorial ✕</button>`;
    el.querySelector(".skip").addEventListener("click", e => { e.stopPropagation(); tone(660, 0.05, "square", 0.06); finishTutorial(true); });
    if (newStep) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
    point(st.point);
    el.classList.toggle("ok", T.okT > 0);
}

on("run:start", () => {
    if (T) { T = null; if (el) { el.remove(); el = null; } }
    if (wants()) start();
});
on("boost", () => { if (T) T.boosted = true; });
on("honk", () => { if (T) T.honked = true; });
on("state", ({ to }) => {
    // the card only shows while actually driving (not during the 3-2-1, wrecks, scenes…)
    if (T && to !== "playing") { if (el) { el.remove(); el = null; } T.key = ""; point(null); }
    if (T && (to === "title" || to === "gameover")) { T = null; ctx.G.tutorial = false; }
});

hook("update", (dt, P, controlsOn) => {
    if (!T || ctx.state !== "playing" || !controlsOn) return;
    const G = ctx.G, car = ctx.car;
    T.t += dt;
    if (T.okT > 0) T.okT -= dt;
    if (T.step === 1) T.steerAcc += Math.min(1, Math.abs(car.d - T.lastD));
    T.lastD = car.d;   // always track, so entering the STEER step sees no stale jump
    if (T.step === 2 && (input.throttle > 0.5 || input.brake > 0.5)) T.speedHeld += dt;
    const st = STEPS[T.step];
    const done = st.done ? st.done(T, G) : false;
    if (T.t >= st.min && (done || T.t >= st.timeout)) {
        T.step++; T.t = 0; T.okT = 0.5;
        if (T.step === 4) T.coins0 = G.coins;        // only coins grabbed DURING the coins step
        if (T.step === 5) T.cc0 = G.closeCalls;
        if (T.step === 3) T.boosted = false;
        if (T.step === 6) T.honked = false;
        if (T.step >= STEPS.length) { finishTutorial(false); return; }
        tone(660, 0.08, "sine", 0.1, 0, 880);
    }
    render(false);
});

// ⏭ in the pause menu (controller-friendly skip)
addMenuItem("pause", { id: "metaSkipTut", order: 5, cls: "alt", label: "⏭ Skip tutorial", visible: () => !!T,
    action: () => { finishTutorial(true); resume(); } });

/** For other features: true while a new player is learning (2D: ambient cop heat stays calm). */
export const tutorialCalm = () => !!T;
