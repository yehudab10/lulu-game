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
    // Cross-feature services (see ARCHITECTURE.md › Cross-feature contracts). A feature
    // assigns its object at import time; callers must check it exists first.
    foot: null,       // foot:        { start(reason, opts), active }
    interiors: {},    // interiors:   id → { name, emoji, enter({ exit }) }
    law: null,        // law:         { startChase(reason), arrest(charges, opts), wanted }
    er: null,         // cameos:      { admit(reason) }
    phone: null,      // journey:     { call({ from, emoji, lines, onAnswer, onDecline }) }
    parking: null,    // parking:     { start(opts) }
    journey: null,    // journey:     { stop(), stopIndex, mode }
    avigail: null,    // cameos:      { rel(), bump(d) }
    garage: null,     // garage:      { items(), use(id) }
};

// ── test gating ───────────────────────────────────────────────────────────
// In ?test mode, RANDOM / surprise content (road events, cameos, cop patrols,
// holiday popups, the tutorial…) must stay off so every feature's test stays
// deterministic. A test opts in with ?test&enable=roadevents,cameos.
const ENABLED = new Set((new URLSearchParams(location.search).get("enable") || "").split(",").filter(Boolean));
/** True unless this is a test run that didn't opt in to feature `id`. Gate random spawns with it. */
ctx.enabled = id => !ctx.TEST || ENABLED.has(id) || ENABLED.has("all");

// ── one activity at a time (ci/hud, 2026-11-26) ─────────────────────────────
// The owner's friend was on a timed kugel delivery, in a chase, AND got offered a robbery to foil — five chips at once.
// The rule: while she's IN an activity (a chase, a side job, a heist thing — a robbery to foil / a snatcher / her own
// heist —, the 🅿️ challenge, the Shabbos rush, a bad-guy encounter, or anything a feature adds), no NEW world event is
// started or offered: robberies, snatchers, road-ragers / gang cars, the Fixer's / the chop shop's / a job's phone
// offers, payphones, roadside cameos and drive-thrus, the town's street scenes and crimes, the Shabbos call. Background
// things (Ima's list, bonuses) carry on but step out of the way on the HUD (hud.js › the objective line).
// A scheduler asks `ctx.engaged(except)` → the id of the activity she's in ("" = free); `except` = its OWN family, so
// it can keep checking its own rules (heist passes "heist"). A feature with an activity of its own adds it once:
// `addActivity(id, () => bool)`. Test: scripts/tests3d/oneact.js.
const ACTIVITIES = [
    ["chase", () => !!(ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || !!(ctx.foot && ctx.foot.chasing)],
    ["job", () => !!(ctx.hustle && ctx.hustle.job)],
    // (a heist only PLANNED — "pull up out front of the bank" — isn't an activity yet: it has no clock and no way to call
    //  it off but a new run, and the whole world went quiet until she did it — ci/sweep-logic2. Heist's own schedulers
    //  still wait for it: heist.busy())
    ["heist", () => !!(ctx.heist && ctx.heist.busy && ctx.heist.busy("plan"))],
    ["parking", () => !!(ctx.parking && ctx.parking.active)],
    ["shabbos", () => !!(ctx.shabbos && ctx.shabbos.active && ctx.shabbos.phase === "drive")],
    ["underworld", () => !!(ctx.underworld && ctx.underworld.enc)],      // (a road-rager, a gang car, a pickpocket; the Fixer's jobs are side jobs)
];
/** Add an activity: while fn() is true, nothing new is started or offered (except by its own feature). */
export function addActivity(id, fn) { ACTIVITIES.push([id, fn]); }
ctx.addActivity = addActivity;
/** The activity she's in right now ("" = none), ignoring `except` (a scheduler's own family). */
ctx.engaged = (except = "") => {
    for (const [id, fn] of ACTIVITIES) { if (id === except) continue; try { if (fn()) return id; } catch (e) { /* a service mid-boot */ } }
    return "";
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
/** The functions listening for `name`, in order (a copy) — for a caller that runs them one at a time across
 *  frames (world.js builds a far chunk in slices: its "chunk:build" listeners don't all run in one frame). */
export function listenersOf(name) { return (listeners.get(name) || []).slice(); }
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
    prerender: [],  // (dt, camera) → right before the driving scene is drawn, every frame in every state (app.js present)
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
 * addMenuItem("title" | "pause" | "settings" | "titleInfo" | <your menu>, {
 *   id, order (lower = higher up), label: string | () => string, cls,
 *   visible: () => bool, action: (buttonEl) => void,
 *   // optional, title / pause only (see core/screens.js › menu groups):
 *   group: "play" | "garage" | "book" | "more"   (title)   ·   "main" | "tools" | "exit"   (pause)
 *          — omitted → a default picked from `order` (menuGroup()), so old items still show up
 *   sub:   string | () => string   — a small subtitle line under the label (title tiles / rows)
 *   short: string                  — a 1–2 word name for group summaries ("Shop", "Quests")
 * })
 * titleInfo items (html lines) may add `bar: true` (a chip in the home screen's top bar),
 * `for: "<title item id>"` (appended to that item's subtitle) or `group: "<title group>"`
 * (a line at the top of that sub-menu); with none of these they're a small note on the home card.
 */
export function addMenuItem(menu, item) {
    if (!menus.has(menu)) menus.set(menu, []);
    const list = menus.get(menu).filter(i => i.id !== item.id);
    list.push(Object.assign({ order: 50, cls: "alt" }, item));
    list.sort((a, b) => a.order - b.order);
    menus.set(menu, list);
}
const val = v => typeof v === "function" ? v() : v;
export function menuItems(menu) {
    return (menus.get(menu) || []).filter(i => { try { return !i.visible || i.visible(); } catch (e) { console.error(`[menu ${menu}] ${i.id}`, e); return false; } }).map(i => {
        const o = {
            id: i.id, cls: i.cls, action: i.action, order: i.order,
            label: val(i.label),
            group: menuGroup(menu, i),
        };
        if (i.sub !== undefined) { try { o.sub = val(i.sub) || ""; } catch (e) { console.error(`[menu ${menu}] ${i.id} sub`, e); o.sub = ""; } }
        if (i.short) o.short = i.short;
        if (i.bar) o.bar = true;
        if (i.for) o.for = i.for;
        return o;
    });
}
/**
 * Which group an item lives in. Explicit `group` wins; otherwise the documented
 * order guide decides, so items that never heard of groups land somewhere sensible:
 *   title: < 70 → "play" (the home screen) · 70–79 → "garage" · ≥ 80 → "more"
 *   pause: < 10 → "main" · 10–69 → "tools" · 70–89 → "main" · ≥ 90 → "exit"
 */
export function menuGroup(menu, item) {
    if (item.group) return item.group;
    const o = item.order === undefined ? 50 : item.order;
    if (menu === "title") return o < 70 ? "play" : o < 80 ? "garage" : "more";
    if (menu === "pause") return o < 10 ? "main" : o < 70 ? "tools" : o < 90 ? "main" : "exit";
    if (menu === "titleInfo") return "";
    return "";
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
