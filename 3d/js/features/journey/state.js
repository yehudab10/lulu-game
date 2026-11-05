// features/journey/state.js — run-state helpers shared by the journey modules.
//
// Per-run fields live on ctx.G (wiped by resetRun) with a "j" prefix:
//   jMult      tour length multiplier (1.5^storyCycle in story mode, 1 in cruise)
//   jLeg       the leg in progress (0..4), story mode only
//   jLegStart  where this leg began (metres)
//   jDone      the Vegas finale played → endless cruise from here
import { ctx } from "../../core/ctx.js";
import { shared } from "../../core/save.js";
import { STOPS, N_STOPS, stopS, cycleMult, PULL_IN } from "./data.js";

/** A stop's region runs this far past it, so the stop's own chunk always belongs to its leg. */
export const REGION_PAD = 100;

export const isStory = () => ctx.G.mode === "story";

/** The layout multiplier for THIS run (fixed at the first call after a reset). */
export function layoutMult() {
    const G = ctx.G;
    if (G.jMult == null) G.jMult = G.mode === "story" ? cycleMult(shared.get().storyCycle || 0) : 1;
    return G.jMult;
}

/** Stop i's position for this run. */
export const stopAt = i => stopS(i, layoutMult());

/** The leg in progress (story) or -1. */
export function curLeg() { return isStory() && !ctx.G.jDone ? (ctx.G.jLeg || 0) : -1; }
export function curStop() { const i = curLeg(); return i >= 0 ? STOPS[i] : null; }

/** Where the arrival pull-in fires for the current leg. */
export function legEnd() { return stopAt(curLeg()) - PULL_IN; }
/** 0..1 progress through the current leg. */
export function legProgress() {
    const G = ctx.G, i = curLeg();
    if (i < 0) return 1;
    const a = G.jLegStart || 0, b = legEnd();
    return Math.max(0, Math.min(1, (ctx.car.s - a) / Math.max(1, b - a)));
}

/** Which leg's REGION a road position belongs to (scenery / sky), plus the Vegas night flip. */
export function regionAt(s, mult = layoutMult()) {
    for (let i = 0; i < N_STOPS; i++) {
        if (s <= stopS(i, mult) + REGION_PAD) {
            if (i === 4) {
                const a = stopS(3, mult) + REGION_PAD, b = stopS(4, mult);
                if (s >= a + (b - a) * STOPS[4].nightAt) return { leg: 4, key: "strip" };
                return { leg: 4, key: "desert" };
            }
            return { leg: i, key: ["fall", "pool", "coast", "dusk"][i] };
        }
    }
    return { leg: 4, key: "strip" };
}
/** Start of region boundaries (for sky blending): [{s, from, to}] (memoized per tour length). */
const bCache = new Map();
export function boundaries(mult = layoutMult()) {
    let b = bCache.get(mult);
    if (b) return b;
    b = [];
    bCache.set(mult, b);
    const keys = ["fall", "pool", "coast", "dusk", "desert"];
    for (let i = 0; i < 4; i++) b.push({ s: stopS(i, mult) + REGION_PAD, from: keys[i], to: keys[i + 1] });
    const a = stopS(3, mult) + REGION_PAD, e = stopS(4, mult);
    b.push({ s: a + (e - a) * STOPS[4].nightAt, from: "desert", to: "strip" });
    return b;
}

/** Is a cop chase (or bust) on? Arrivals and interludes wait for the heat to clear. */
export const heat = { chase: false };
export function hasHeat() {
    try { if (ctx.law && (ctx.law.chasing || ctx.law.active === true)) return true; } catch (e) { /* ignore */ }
    return heat.chase;
}
