// ─────────────────────────────────────────────────────────────────────────
//  ⏭ SKIP — the small pill in the top-right corner during cutscenes.
//
//  Hold ○/B (Backspace on a keyboard) or click/tap the pill, or pick
//  "Skip this scene" in the pause menu.
//
//  A state opts in when it registers:
//      registerState("lawArrest", { skip: true, … })
//      registerState("lawJail",   { skip: () => st && st.phase === "intake", … })   // only some phases
//  and an in-state cutscene (inside "playing", say) brackets itself:
//      ctx.cutscene.begin("bigReveal");  …  ctx.cutscene.end("bigReveal");
//  (scenes are dropped automatically when the state changes).
//
//  Skipping FAST-FORWARDS the scene behind a veil: the state's own update runs
//  many game-time steps per frame, dialogue LINES advance by themselves, and
//  every async script, sleep, walk and tween plays out in a blink — so all the
//  scene's side effects (fines, coins, saves, the next state…) still happen in
//  order. It stops at a choice, a menu screen, a state change, when the scene
//  ends (`skip()` turns false / ctx.cutscene.end), or after 90 s of game time.
//  A state can add `onSkip()` for anything that waits on real time.
//
//  While skipping, ctx.skipping is true (feature sound effects stay quiet).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, css, on, emit } from "./ctx.js";
import { save3d } from "./save.js";
import { input, glyph } from "../input.js";
import * as H from "../hud.js";
import * as A from "../audio.js";
import { dialogFastForward, isChoiceOpen } from "./dialog.js";

export const HOLD = 0.45;            // seconds of holding ○/B to skip
export const FF_DT = 1 / 30;         // game time per fast-forward step
export const FF_STEPS = 14;          // steps per frame (≈ 28× speed at 60 fps)

css("skip", `
#skipBtn { position: fixed; z-index: 46; top: calc(max(12px, env(safe-area-inset-top)) + 4px); right: calc(max(12px, env(safe-area-inset-right)) + 4px);
  display: none; align-items: center; gap: 8px; padding: 7px 14px 7px 12px; border: none; border-radius: 999px; isolation: isolate; overflow: hidden;
  background: rgba(20,16,30,.5); color: #fff; font: 700 14px var(--font); letter-spacing: .05em; cursor: pointer; opacity: .8;
  box-shadow: 0 2px 10px rgba(0,0,0,.22); -webkit-tap-highlight-color: transparent; pointer-events: auto; }
#skipBtn.show { display: inline-flex; animation: skipIn .35s ease-out; }
#skipBtn:hover, #skipBtn.holding { opacity: 1; }
#skipBtn .fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0; background: linear-gradient(90deg, #FF4FA3, #E91E63); z-index: -1; }
#skipBtn .g { font-size: 12px; background: rgba(255,255,255,.2); border-radius: 6px; padding: 1px 7px; letter-spacing: 0; }
#skipBtn .g:empty { display: none; }
@keyframes skipIn { from { transform: translateY(-10px); opacity: 0; } to { transform: none; opacity: .8; } }
#skipVeil { position: fixed; inset: 0; z-index: 44; pointer-events: none; opacity: 0; transition: opacity .12s;
  background: radial-gradient(ellipse at center, rgba(20,12,30,.35), rgba(20,12,30,.75));
  display: flex; align-items: center; justify-content: center; color: #fff; font: 700 28px var(--font); letter-spacing: .12em;
  text-shadow: 0 2px 8px rgba(0,0,0,.5); }
#skipVeil.on { opacity: 1; }
#skipBtn.lower { top: calc(max(12px, env(safe-area-inset-top)) + 64px); }   /* under the HUD's pause button */
body.tv #skipBtn { font-size: 22px; padding: 10px 22px 10px 18px; top: 3vh; right: 3vw; }
body.tv #skipBtn.lower { top: calc(3vh + 90px); }
body.tv #skipBtn .g { font-size: 18px; }
`);

const el = document.createElement("button");
el.id = "skipBtn";
el.setAttribute("aria-label", "Skip this scene");
el.innerHTML = `<i class="fill"></i><span>⏭ SKIP</span><span class="g"></span>`;
document.body.appendChild(el);
const $fill = el.querySelector(".fill"), $g = el.querySelector(".g");
el.addEventListener("pointerdown", e => e.stopPropagation());
el.addEventListener("click", e => { e.stopPropagation(); e.preventDefault(); skipNow(); });

const veil = document.createElement("div");
veil.id = "skipVeil";
veil.textContent = "⏩";
document.body.appendChild(veil);

// ── in-state cutscenes ───────────────────────────────────────────────────
const scenes = new Map();     // id → { state, onSkip }
export const cutscene = {
    begin(id, opts = {}) { scenes.set(id, Object.assign({ state: ctx.state }, opts)); },
    end(id) { scenes.delete(id); },
    active(id) { return id ? scenes.has(id) : scenes.size > 0; },
};
ctx.cutscene = cutscene;
on("state", ({ to }) => { for (const [id, s] of scenes) if (s.state !== to) scenes.delete(id); });

function stateSkippable() {
    const def = ctx.states[ctx.state];
    if (!def || !def.skip) return false;
    if (typeof def.skip !== "function") return true;
    try { return !!def.skip(); } catch (e) { return false; }
}
/** Could the player skip right now (ignoring the pause overlay)? */
export function canSkip(ignorePause = false) {
    if ((ctx.paused && !ignorePause) || ctx.state === "loading") return false;
    if (H.screenOpen() && !(ignorePause && ctx.paused)) return false;
    if (isChoiceOpen()) return false;
    return stateSkippable() || scenes.size > 0;
}

// ── the fast-forward ─────────────────────────────────────────────────────
const S = { shown: false, hold: 0, armed: true, ff: null, glyph: "" };

export function skipNow() {
    if (S.ff || !canSkip()) return false;
    const mode = stateSkippable() ? "state" : "scene";
    S.ff = { mode, state: ctx.state, scenes: new Set(scenes.keys()), t: 0 };
    ctx.skipping = true;
    A.setMuted(true);
    veil.classList.add("on");
    show(false);
    const def = ctx.states[ctx.state];
    if (mode === "state" && def && typeof def.onSkip === "function") { try { def.onSkip(); } catch (e) { console.error("[skip]", e); } }
    for (const s of scenes.values()) if (s.onSkip) { try { s.onSkip(); } catch (e) { console.error("[skip]", e); } }
    emit("skip", { state: ctx.state, mode });
    return true;
}
function stop(reason) {
    if (!S.ff) return false;
    S.ff = null;
    ctx.skipping = false;
    A.setMuted(save3d.sound === false);
    veil.classList.remove("on");
    emit("skip:end", { reason });
    return false;
}
/** Is a fast-forward running? (the main loop then calls skipBefore/skipAfter around each step) */
export function skipping() { return !!S.ff; }
/** Before each fast-forward step: dialogue lines advance themselves; a choice stops the skip. */
export function skipBefore() {
    if (!S.ff) return false;
    if (ctx.paused) return stop("paused");
    if (ctx.dialogOpen && !dialogFastForward()) return stop("choice");
    return true;
}
/** After each fast-forward step: keep going? */
export function skipAfter(dt) {
    const f = S.ff;
    if (!f) return false;
    f.t += dt;
    if (ctx.state !== f.state) return stop("state");
    if (H.screenOpen()) return stop("screen");
    if (isChoiceOpen()) return stop("choice");
    if (f.mode === "state" ? !stateSkippable() : ![...f.scenes].some(id => scenes.has(id))) return stop("done");
    if (f.t > 90) return stop("cap");
    return true;
}

function show(on) {
    if (on === S.shown) return;
    S.shown = on;
    el.classList.toggle("show", on);
    if (on) { S.hold = 0; S.armed = !input.backHeld; }   // still holding ○ from braking? let go first
}

/** Every frame, before the game steps: show/hide the pill, and the hold-○ gesture. */
export function skipInput(dt) {
    if (S.ff) return;
    const can = canSkip();
    show(can);
    const def = ctx.states[ctx.state];
    el.classList.toggle("lower", !!(def && def.hud));
    if (!can) { S.hold = 0; $fill.style.width = "0"; return; }
    const g = input.device === "gamepad" ? `hold ${glyph("back")}` : input.device === "keyboard" ? "hold ⌫" : "";
    if (g !== S.glyph) { S.glyph = g; $g.textContent = g.replace(/<[^>]*>/g, ""); }   // glyph() is HTML: the pill shows plain "hold B"
    if (!input.backHeld) S.armed = true;
    if (S.armed && input.backHeld) S.hold += dt;
    else S.hold = Math.max(0, S.hold - dt * 3);
    el.classList.toggle("holding", S.hold > 0);
    $fill.style.width = `${Math.min(100, S.hold / HOLD * 100)}%`;
    if (S.hold >= HOLD) { S.hold = 0; skipNow(); }
}
