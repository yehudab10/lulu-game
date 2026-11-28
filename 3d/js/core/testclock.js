// core/testclock.js — ?test ONLY: THE FAST TEST CLOCK (ci/fasttests). Never on for a player: it needs ?test AND
// the test harness's window.__luluFast (scripts/smoke3d.js sets it for every page it opens; a test file opts out
// with `fast: false`).
//
// Why: in software WebGL one drawn frame costs ~100–300 ms (the game's own step is ~4 ms), and the game drew every
// 1/30 s step, so a test's "3 minutes of driving" was 5,400 draws. With the clock on — still ONE step per browser
// frame, so every rAF / timer / microtask lands where it always did:
//   • DRAW    only every TC.every-th frame is drawn, on a smaller canvas backing store (the CSS layout + the HUD stay
//             at the real viewport size); the other frames do everything else a frame does (LODs, prerender hooks,
//             gfx, audio, the touch buttons). drawNow() draws this frame for a check that reads the picture
//   • GATES   the harness asks "stop at frame N" or "stop the first frame this condition is true": the game holds
//             right there until the harness has seen it and lets go — so a fast game can never run past a
//             short-lived state a test is waiting for (the old 100 ms poll could; this is stricter)
//   • PACE    between the harness's waits, the old clock's pace (one step per ~133 ms of real time): the game time
//             that passes between two test commands is what it always was; inside a wait, a step every browser frame
//   • CLOCK   the page's timers + performance.now follow game time (scripts/lib/vclock.js)
//   • a real frame on demand: realFrame() draws one full-size picture (screenshots)
import { ctx } from "./ctx.js";

const cfg = ctx.TEST && typeof window !== "undefined" && window.__luluFast ? window.__luluFast : null;

export const TC = {
    on: !!cfg,
    every: cfg ? Math.max(1, Math.min(60, cfg.every | 0 || 6)) : 1,      // (draw every n-th frame)
    scale: cfg ? Math.max(0.1, Math.min(1, +cfg.scale || 0.25)) : 1,
    k: 0, drawn: -1,
    // (between the harness's waits the game keeps the OLD clock's pace — one step per ~133 ms of real time — so the
    //  game time that passes between two test commands is what it always was; only inside a wait does it run flat out)
    idleMs: cfg ? Math.max(1, +cfg.idleMs || 133) : 133,
    idleAt: 0,
    run: 0,             // harness: run flat out with no gate (the OTHER pages of a test, while it waits on one)
    gate: null,         // { frame, fn, hit }
    renders: 0,
    /** The page's clock (scripts/lib/vclock.js, installed by the harness before the game loads): timers,
     *  performance.now, Date and rAF follow GAME time once the loop runs — 1/30 s a step, like a player at 30 fps. */
    clock: cfg && window.__luluClock ? window.__luluClock : null,
};
const STEP_MS = 1000 / 30;
/** Before a step: the page's clock moves one frame (the first one starts it). */
export function beforeStep() { const c = TC.clock; if (!c) return; if (!c.started) c.start(); c.advance(STEP_MS); }
/** After a step's microtasks: the page's timers that are due fire (a promise: their microtasks run too). */
export function timers() { return TC.clock ? TC.clock.pump() : null; }
/** An ad holds the game (ctx.hold): no game time, but the page's clock keeps going as wall time would. */
export function idle() { const c = TC.clock; if (c && c.started) c.idle(); }

/** The game holds (no steps) while a gate has been hit and the harness hasn't let go yet. */
export function held() { return !!(TC.gate && TC.gate.hit); }
/** "hold" (a gate was hit) · "burst" (the harness is waiting: flat out) · "idle" (the old clock's pace). */
export function mode() { return held() ? "hold" : (TC.gate || TC.run > 0) ? "burst" : "idle"; }
export const realNow = () => (TC.clock ? TC.clock.real() : performance.now());
/** Harness: +1 / -1 — run flat out while it waits on another page of the same test. */
export function runAdd(n) { TC.run = Math.max(0, TC.run + (n | 0)); return TC.run; }

/** After each step: has the gate's frame / condition been reached? */
export function afterStep() {
    const g = TC.gate;
    if (!g || g.hit) return;
    if (g.frame && ctx.frames >= g.frame) g.hit = true;
    else if (g.fn) { try { if (g.fn(window.__lulu3d, ctx)) g.hit = true; } catch (e) { /* not yet */ } }
}

/** Harness: hold at frame (now + frames) or the first step `code` is truthy. Returns hit-now. */
export function setGate({ frames = 0, code = "", scope = true } = {}) {
    let fn = null;
    // (scope: L3 + ctx in scope like party3d's waitOn; scope false = page globals only, like smoke3d's t.until)
    if (code) fn = scope ? new Function("L3", "ctx", `try { return !!(${code}); } catch (e) { return false; }`)
        : new Function(`try { return !!(${code}); } catch (e) { return false; }`);
    TC.gate = { frame: frames ? ctx.frames + frames : 0, fn, hit: false };
    afterStep();            // (already true → hit at once, nothing runs past it)
    return TC.gate.hit;
}
export function gateHit() { return !!(TC.gate && TC.gate.hit); }
export function clearGate() { TC.gate = null; return true; }
