// features/roadevents — the event registry and per-run state shared by the event modules.
import { ctx } from "../../core/ctx.js";

/** name → { spawn(opts), models: [keys], label, emoji } — see ctx.roadevents.spawn(name). */
export const EVENTS = {};
export function defineEvent(name, def) { EVENTS[name] = Object.assign({ models: [], label: name, emoji: "⭐" }, def); }

/** Per-run state (reset at every run start by index.js). */
export const R = {
    zone: null,           // current road zone kind (construction, school, …) or null on the open road
    zoneS0: 0, zoneS1: 0, // its extent
    live: {},             // name → count of live events of that kind
    honkChain: 0, honkT: 0,
};
export function live(name) { return R.live[name] || 0; }
export function inc(name, n = 1) { R.live[name] = Math.max(0, (R.live[name] || 0) + n); }

/** Small per-run counters for tests and the scrapbook-ish summary. */
export const tally = {};
export function count(id, n = 1) { tally[id] = (tally[id] || 0) + n; }

/** True when random road events may spawn right now. */
export function canSpawn() {
    return ctx.enabled("roadevents") && ctx.state === "playing" && !ctx.paused && !ctx.G.ended && !ctx.G.roadeventsOff;
}
