// ─────────────────────────────────────────────────────────────────────────
//  The shared game context. Every feature module talks to the game through
//  this file: the `ctx` object (renderer, scene, car, world, traffic, run
//  state…), an event bus, ordered hooks, a state machine, menu registries,
//  "actors" (anything that lives on the road) and per-feature save storage.
//
//  See 3d/ARCHITECTURE.md for the full contract.
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";

export const ctx = {
    THREE,
    TEST: /[?&]test\b/.test(location.search),
    time: 0,          // seconds since boot (game time)
    frames: 0,
    // filled in by main.js at boot:
    renderer: null, scene: null, camera: null, lights: null,
    world: null, car: null, traffic: null,
    // What to render this frame. null → the driving scene + main camera.
    // A state with its own "set" (interior, parking lot, courtroom…) assigns
    // { scene, camera } in enter() and clears it in exit().
    view: null,
    G: {},            // per-run state, reset by core/driving.js resetRun()
    state: "loading", prevState: null, stateT: 0, stateData: null,
    states: {},
    paused: false,    // pause overlay (does NOT change state)
    dialogOpen: false,
    actors: [],
    trip: null,       // { label(): string, progress(): 0..1 } — the HUD trip bar (journey feature)
};

// ── events ────────────────────────────────────────────────────────────────
const listeners = new Map();
/** Subscribe. Returns an unsubscribe function. */
export function on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(fn);
    return () => off(name, fn);
}
export function off(name, fn) {
    const l = listeners.get(name);
    if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); }
}
/** Fire an event. Listener errors are logged, never thrown into the caller. */
export function emit(name, payload) {
    const l = listeners.get(name);
    if (!l) return;
    for (const fn of l.slice()) {
        try { fn(payload); } catch (e) { console.error(`[event ${name}]`, e); }
    }
}

// ── hooks: ordered lists of functions (higher priority runs first) ────────
export const hooks = {
    controls: [],   // (ctl, dt) → mutate the car controls before physics (Ima call, distracted mode…)
    update: [],     // (dt, P) → every frame while DRIVING (playing/intro/wrecked/arriving)
    damage: [],     // (info) → return false to cancel a hit (shield…); info = {power, why, source}
    wreck: [],      // (info) → return true if you take over the out-of-hearts moment (arrest, ER, on foot…)
    hud: [],        // (dt) → every frame while the driving HUD is up
    runStart: [],   // (G) → after resetRun(), before the countdown
    titleCamera: [],// (dt, camera) → return true to own the title-screen camera
};
export function hook(name, fn, priority = 0) {
    if (!hooks[name]) hooks[name] = [];
    fn.__prio = priority;
    hooks[name].push(fn);
    hooks[name].sort((a, b) => (b.__prio || 0) - (a.__prio || 0));
    return () => { const i = hooks[name].indexOf(fn); if (i >= 0) hooks[name].splice(i, 1); };
}
export function runHooks(name, ...args) {
    for (const fn of hooks[name] || []) {
        try { fn(...args); } catch (e) { console.error(`[hook ${name}]`, e); }
    }
}
/** First hook that returns `true` wins. */
export function claimHooks(name, ...args) {
    for (const fn of hooks[name] || []) {
        try { if (fn(...args) === true) return true; } catch (e) { console.error(`[hook ${name}]`, e); }
    }
    return false;
}
/** Any hook returning `false` vetoes. */
export function vetoHooks(name, ...args) {
    for (const fn of hooks[name] || []) {
        try { if (fn(...args) === false) return true; } catch (e) { console.error(`[hook ${name}]`, e); }
    }
    return false;
}

// ── state machine ─────────────────────────────────────────────────────────
/**
 * registerState(name, {
 *   enter(data, prev), exit(next), update(dt, P), camera(dt) → true if handled,
 *   hud: bool       — show the driving HUD (hearts, coins, speedo, trip bar)
 *   touch: bool     — show the driving touch controls (stick + pedals)
 *   pausable: bool  — Start / Esc / ❚❚ opens the pause overlay
 *   world: bool     — keep streaming/animating the road world (default true)
 *   driving: bool   — run the core driving sim (car physics, traffic, actors…)
 * })
 */
export function registerState(name, def) {
    ctx.states[name] = Object.assign({ hud: false, touch: false, pausable: false, world: true, driving: false }, def);
}

export function setState(name, data = {}) {
    const to = ctx.states[name];
    if (!to) { console.error("setState: unknown state", name); return; }
    const prev = ctx.state;
    const from = ctx.states[prev];
    if (from && from.exit) { try { from.exit(name); } catch (e) { console.error(`[exit ${prev}]`, e); } }
    ctx.prevState = prev;
    ctx.state = name;
    ctx.stateT = 0;
    ctx.stateData = data;
    if (chrome) chrome(to);
    if (to.enter) { try { to.enter(data, prev); } catch (e) { console.error(`[enter ${name}]`, e); } }
    emit("state", { from: prev, to: name, data });
}
let chrome = null;
/** main.js installs the function that shows/hides HUD + touch controls per state. */
export function setChromeHandler(fn) { chrome = fn; }
export function currentState() { return ctx.states[ctx.state]; }

// ── menus: features add buttons to the title / pause / other menus ────────
const menus = new Map();
/**
 * addMenuItem("title" | "pause" | <your menu>, {
 *   id, order (lower = higher up), label: string | () => string, cls,
 *   visible: () => bool, action: (buttonEl) => void
 * })
 */
export function addMenuItem(menu, item) {
    if (!menus.has(menu)) menus.set(menu, []);
    const list = menus.get(menu).filter(i => i.id !== item.id);
    list.push(Object.assign({ order: 50, cls: "alt" }, item));
    list.sort((a, b) => a.order - b.order);
    menus.set(menu, list);
}
export function menuItems(menu) {
    return (menus.get(menu) || []).filter(i => !i.visible || i.visible()).map(i => ({
        id: i.id, cls: i.cls, action: i.action,
        label: typeof i.label === "function" ? i.label() : i.label,
    }));
}

// ── actors: things on the road with their own update/collision ───────────
/**
 * addActor({
 *   update(dt) → return false to remove it,
 *   collide?(car) → null | { impact (m/s), why, source }  (core turns impact > 6.5 into damage)
 *   dispose?(),
 *   foot?: bool  — keep updating while Lulu is on foot too
 * })
 */
export function addActor(actor) { ctx.actors.push(actor); return actor; }
export function removeActor(actor) {
    const i = ctx.actors.indexOf(actor);
    if (i >= 0) { ctx.actors.splice(i, 1); if (actor.dispose) actor.dispose(); }
}
export function clearActors() {
    for (const a of ctx.actors) { try { if (a.dispose) a.dispose(); } catch (e) { console.error(e); } }
    ctx.actors.length = 0;
}

// ── cameras that need their aspect kept in sync on resize ─────────────────
const cams = new Set();
export function trackCamera(cam) { cams.add(cam); syncCamera(cam); return cam; }
export function untrackCamera(cam) { cams.delete(cam); }
export function syncCamera(cam) {
    cam.aspect = window.innerWidth / Math.max(1, window.innerHeight);
    cam.updateProjectionMatrix();
}
export function syncAllCameras() { for (const c of cams) syncCamera(c); }

// ── small shared helpers ──────────────────────────────────────────────────
export const MPH = 2.23694;
export function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
export function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${String(s).padStart(2, "0")}`; }

/** Inject a feature's CSS once. */
const cssDone = new Set();
export function css(id, text) {
    if (cssDone.has(id)) return;
    cssDone.add(id);
    const s = document.createElement("style");
    s.dataset.feature = id;
    s.textContent = text;
    document.head.appendChild(s);
}
