// features/law — ctx.law, the service other features call:
//   ctx.law.startChase(reason, opts)   — borrowed cars on foot, the steamroller, a stopped school bus…
//   ctx.law.arrest(charges[], opts)    — straight to the arrest cinematic (ER bill-skipping, a foot chase lost…)
//   ctx.law.wanted                     — heat 0–5 (chase stars / fugitive stars / 1 with open warrants)
// plus: chasing · fugitive · warrants · addWarrant() · clearHeat() · copNear() · report() · pullOver() · hold() · config
// and resumeDriving(), which every "you're free" exit uses to put Lulu back on the road.
import { ctx, setState } from "../../core/ctx.js";
import { startRun } from "../../core/driving.js";
import * as H from "../../hud.js";
import { L, config, beginChase, endChase, copNear, startFugitive, endFugitive, prisonClothes } from "./cops.js";
import { S, addWanted, clearLockup, fugitiveStars } from "./rules.js";

export const run = { live: false, mode: "cruise" };   // is a run in progress that an arrest interrupted?
/** Test-only overrides (scripts/tests3d/law.js): bustOutcome, verdict, quietCourt, escapeKind. Empty in the game. */
export const FORCE = {};
let pullOverFn = null;
export function setPullOver(fn) { pullOverFn = fn; }

const DRIVING_OK = new Set(["playing", "intro", "wrecked", "arriving"]);

export const law = {
    /** Start (or escalate) a pursuit. reason: plain-language charge. opts: { msg, charges[], heat } */
    startChase(reason, opts = {}) {
        if (!ctx.car || !DRIVING_OK.has(ctx.state)) return false;
        return beginChase(reason || "RECKLESS DRIVING", opts);
    },
    /**
     * Arrest her now: the cinematic → booking → cell → court.
     * opts: { fromBust, onFoot, x, z, h (on-foot position), skipCinematic }
     */
    arrest(charges = [], opts = {}) {
        const go = () => {
            const ch = (charges && charges.length ? charges : ["DISTURBING THE PEACE"]).slice();
            if (opts.onFoot === undefined && ctx.foot && ctx.foot.active) opts.onFoot = true;
            if (opts.skipCinematic) setState("lawJail", { charges: ch, sResume: ctx.car.s + 200 });
            else setState("lawArrest", Object.assign({ charges: ch }, opts));
        };
        // while driving, never switch state from inside an event handler mid-frame: run it next frame
        if (ctx.state === "playing" || ctx.state === "intro") L.pending = go; else go();
        return true;
    },
    get wanted() {
        if (L.chase) return L.chase.heat;
        if (L.fug) return fugitiveStars(L.fug.t);
        return S.wanted.length ? 1 : 0;
    },
    get chasing() { return !!L.chase; },
    get fugitive() { return !!L.fug; },
    get warrants() { return S.wanted.slice(); },
    addWarrant(charges) { addWanted(Array.isArray(charges) ? charges : [charges]); },
    /** Shake the heat (a disguise on foot, a long lay-low): ends the fugitive stretch + any chase. */
    clearHeat(msg = "🥸 New look — nobody recognises you!") {
        if (L.chase) endChase("disguise");
        if (L.fug) { clearLockup(); endFugitive(msg); }
    },
    /** Is a cop (parked, patrolling or chasing) within r metres of (x, z)? */
    copNear(x, z, r = 40) { return !!copNear(x, z, r); },
    /** A crime happened at (x, z): a cop who saw it gives chase (or arrests on the spot). */
    report(charge, { x, z, arrest = false, r = 60 } = {}) {
        if (x == null) { x = ctx.car.pos.x; z = ctx.car.pos.z; }
        if (!copNear(x, z, r)) return false;
        if (arrest) return law.arrest([charge]);
        return law.startChase(charge, { msg: "🚨 BUSTED!" });
    },
    /** Lulu is driving a cruiser: pull over the car ahead (the 2D copStop). */
    pullOver() { return pullOverFn ? pullOverFn() : false; },
    /** Keep random cop events away for `sec` seconds (tutorials, cutscenes). */
    hold(sec = 10) { L.hold = Math.max(L.hold, sec); },
    config,
};
// test hook: internals + a log of law events (only read by the smoke test)
Object.defineProperty(law, "_dbg", { enumerable: false, value: { L, FORCE, run, log: [] } });

/**
 * Back on the road after the station / court / a jailbreak. Continues the run
 * that was interrupted (score, coins, the trip) a little further down the road,
 * or starts a fresh one when there is none (a lockup resumed after a refresh).
 */
export function resumeDriving({ s = null, fugitive = false, banner = "", onPlaced = null } = {}) {
    if (!run.live) {
        startRun({ mode: run.mode || "cruise" });
        if (fugitive && !L.fug) startFugitive(0);
        if (banner) H.toast(banner, "pink");
        return;
    }
    const G = ctx.G, car = ctx.car, road = ctx.world.road;
    const s0 = Math.max(12, Number.isFinite(s) ? s : Number.isFinite(car.s) ? car.s + 120 : 12);
    const p = road.point(s0, 1.75, {});
    ctx.traffic.clear();
    L.units.length = 0;
    car.place(p.x, p.z, p.h);
    car.s = s0; car.d = 1.75;
    car.vx = Math.sin(p.h) * 12; car.vz = Math.cos(p.h) * 12;
    car.showDriver(true);
    car.obj.visible = true;
    ctx.world.prebuild(s0);
    G.lastS = Math.max(G.lastS || 0, s0);
    G.hearts = Math.max(G.hearts, 1);
    H.setHearts(G.hearts, G.maxHearts);
    G.invT = Math.max(G.invT, 6);
    L.grace = 6; L.wantedSpot = 0; L.apbCool = Math.max(L.apbCool, 8); L.wantedPatrolT = Math.max(L.wantedPatrolT, 5);
    if (fugitive) { if (!L.fug) startFugitive(0); } else if (L.fug) endFugitive();
    prisonClothes(!!L.fug);
    ctx.cam.snap();
    G.goText = banner || G.goText;
    if (onPlaced) { setState("playing"); onPlaced(); return; }
    setState("intro");
}
