// features/law — ctx.law, the service other features call:
//   ctx.law.startChase(reason, opts)   — borrowed cars on foot, the steamroller, a stopped school bus…
//   ctx.law.arrest(charges[], opts)    — straight to the arrest cinematic (ER bill-skipping, a foot chase lost…)
//   ctx.law.wanted                     — heat 0–5 (chase stars / fugitive stars / 1 with open warrants)
// plus: chasing · fugitive · warrants · addWarrant()/addWanted() · clearHeat() · copNear() · report() · pullOver() · hold() · config
// and resumeDriving(), which every "you're free" exit uses to put Lulu back on the road.
import { ctx, setState } from "../../core/ctx.js";
import { startRun } from "../../core/driving.js";
import * as H from "../../hud.js";
import { L, config, TUNE, beginChase, endChase, copNear, copSees, startFugitive, endFugitive, prisonClothes, rig, setRig,
    notice, callIn, endBolo, changeLook, escape, spawnTrap } from "./cops.js";
import { REASON_CHARGES, CHARGE_DIALOGUE, CHARGE_DEFENSE, CHARGE_WEIGHT } from "./data.js";
import { S, addWanted, clearLockup, fugitiveStars } from "./rules.js";

export const run = { live: false, mode: "cruise", ride: null };   // is a run in progress that an arrest interrupted? (+ her wheels, below)

/**
 * What became of her wheels when she was arrested — every release follows it (she only ever
 * drives out in a car that's really hers and in one piece):
 *   "own"       her own car, intact (driving it, or parked on the shoulder while she walked) → she drives it out
 *   "wrecked"   her own car, totaled (the cop-caused wreck, the wreck she walked away from) → towed: she walks
 *   "stolen"    a jacked / hotwired / hailed ride → it goes back to its owner: she walks
 *   "impounded" no car before the arrest (an earlier impound, a jailbreak on foot)   → she walks
 * Captured as she enters the law's scenes (law/index.js); null = nothing captured (a fresh run).
 */
export function captureRide(from) {
    const f = ctx.foot, G = ctx.G || {};
    let r;
    if (f && (f.borrowed || f.vehicle)) r = "stolen";
    else {
        const own = f && f.ownCar ? f.ownCar : "ok";
        if (own === "ok") r = from === "wrecked" || (G.hearts != null && G.hearts <= 0) ? "wrecked" : "own";
        else r = own === "parked" ? "own" : own === "wrecked" ? "wrecked" : "impounded";
    }
    run.ride = r;
    return r;
}
/** Does she get a car back on release? (No run in progress → a fresh drive in her own car.) */
export function carBack() { return !run.live || !run.ride || run.ride === "own"; }
/** The line that says why she's walking out on foot. */
export function rideNote() {
    return run.ride === "stolen" ? "The “borrowed” ride went back to its owner. 🚶‍♀️"
        : run.ride === "wrecked" ? "Your car got towed to the impound — it's totaled. 🚧"
        : run.ride === "impounded" ? "Your car's still in the impound. Walking it is. 🚶‍♀️" : "";
}
/** Test-only overrides (scripts/tests3d/law.js): bustOutcome, verdict, quietCourt, escapeKind. Empty in the game. */
export const FORCE = {};
/** Courtroom events other features' charges bring (law.addCharge({ court })): [{ key, ev }]. */
export const CHARGE_EVENTS = [];
let pullOverFn = null;
export function setPullOver(fn) { pullOverFn = fn; }

const DRIVING_OK = new Set(["playing", "intro", "wrecked", "arriving"]);

export const law = {
    /** Start (or escalate) a pursuit. reason: plain-language charge. opts: { msg, charges[], heat } */
    startChase(reason, opts = {}) {
        if (!ctx.car || !DRIVING_OK.has(ctx.state)) return false;
        return beginChase(REASON_CHARGES[reason] || reason || "RECKLESS DRIVING", opts);
    },
    /**
     * A PETTY offense a cop saw (a stop sign, speeding in a zone…): the first is a ⚠️ WARNING that drains while she
     * drives clean; another while it's live — or opts.amount ≥ 1 (reckless) — is a chase. opts: { msg, warn (the
     * warning line), witness (a cop's right there: chase now; else a call-in), src (an object: 4 s cooldown), heat }.
     * → "chase" | "warn" | "".
     */
    notice(charge, opts = {}) { return DRIVING_OK.has(ctx.state) ? notice(charge, opts) : ""; },
    /**
     * A witness phoned it in — no cop saw it: after a delay (opts.delay, else 8–14 s) an unlit cruiser comes up the road
     * looking for the car she's in. Change cars / paint / ditch it, hide, or stay out of its sight and they call it off.
     * → "bolo" | "chase" (one was on: the charge piles on) | "".
     */
    callIn(charge, opts = {}) { return callIn(REASON_CHARGES[charge] || charge, opts); },
    /** A call-in is out (📞 REPORTED / 🚓 LOOKING FOR YOU). */
    get reported() { return !!L.bolo; },
    /** 0–1 the ⚠️ WARNING heat (petty offenses; draining). */
    get suspicion() { return L.sus; },
    /** She changed her look this run (a new car / paint / disguise): the warrant file doesn't know her. */
    get lowKey() { return !!L.lowKey; },
    /** Mid-chase she's tucked away out of sight ("lot" | "town" | "verge" | ""): see cops.js hideInfo() — a town street's travel lane never counts. */
    get hiding() { return L.chase && L.chase.searching ? L.chase.hiding || "" : ""; },
    /** She switched cars / painted / disguised unseen: drop the old description (see cops.js changeLook). how: car | paint | disguise. */
    changeLook(how = "car") { return changeLook(how); },
    /** Mid-chase and unseen: she got away (e.g. she took an exit into a town). → bool */
    lose(how = "lost", msg = "") { if (!L.chase || !L.chase.searching) return false; escape(how, msg); return true; },
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
        return S.wanted.length && !L.lowKey ? 1 : 0;     // (warrants on file, unless she's changed her look this run)
    },
    get chasing() { return !!L.chase; },
    /** Mid-chase: the cops have lost sight of her and are SEARCHING (the stars flash). */
    get searching() { return !!(L.chase && L.chase.searching); },
    /** 0–1 how close she is to losing them (the "losing them…" meter). */
    get searchProgress() { return L.chase ? L.chase.evade : 0; },
    /** The pursuit tuning table (cop speed / sight / search time by stars). */
    tune: TUNE,
    /** A flashing police light bar for any cop-car Object3D (roadblocks…): { set(on, t) }. */
    lightBar(obj) { const r = rig(obj); return { set: (on, t = ctx.time) => setRig(r, on, t) }; },

    get fugitive() { return !!L.fug; },
    get warrants() { return S.wanted.slice(); },
    // (a NEW warrant is a fresh description: whatever new look she had this run, this one is on file now)
    addWarrant(charges) { addWanted(Array.isArray(charges) ? charges : [charges]); L.lowKey = false; },
    /** alias (cameos uses this name) */
    addWanted(charges) { addWanted(Array.isArray(charges) ? charges : [charges]); L.lowKey = false; },
    /** Shake the heat (a disguise on foot, a long lay-low): ends the fugitive stretch + any chase. */
    clearHeat(msg = "🥸 New look — nobody recognises you!", { lowKey = true } = {}) {
        if (L.chase) endChase("disguise");
        if (L.fug) { clearLockup(); endFugitive(msg); }
        if (L.bolo) endBolo("cleared");
        L.sus = 0; L.wantedSpot = 0;
        // the warrants stay on file (only a judge clears them) — but nobody out here recognises her this run
        if (lowKey && S.wanted.length) { L.lowKey = L.lowKey || "clear"; L.lowKeyT = ctx.time; }
    },
    /** Is a cop (parked, patrolling or chasing) within r metres of (x, z)? */
    copNear(x, z, r = 40) { return !!copNear(x, z, r); },
    /** Can a cop actually SEE (x, z) — within r, clear line of sight (≤ 15 m always)? */
    copSees(x, z, r = 45) { return !!copSees(x, z, r); },
    /** A crime happened at (x, z): a cop who SAW it gives chase (or arrests on the spot). */
    report(charge, { x, z, arrest = false, r = 60 } = {}) {
        if (x == null) { x = ctx.car.pos.x; z = ctx.car.pos.z; }
        if (!copSees(x, z, r)) return false;
        if (arrest) return law.arrest([charge]);
        return law.startChase(charge, { msg: "🚨 BUSTED!", at: { x, z } });
    },
    /** Lulu is driving a cruiser: pull over the car ahead (the 2D copStop). */
    pullOver() { return pullOverFn ? pullOverFn() : false; },
    /** Keep random cop events away for `sec` seconds (tutorials, cutscenes). */
    hold(sec = 10) { L.hold = Math.max(L.hold, sec); },
    /** The cops back off: any pursuit winds down (no arrest, no new charges) — a 🎉 party game starting, a race. */
    standDown(why = "standDown") { if (!L.chase) return false; endChase(why); return true; },
    /**
     * For a 🎉 party's friends: up to n LIT cruisers near her (chasing / pulling her over / hauling her in),
     * as one flat int array [x×10, z×10, heading×1000, …] in world space (party/presence.js draws them as puppets).
     */
    partyUnits(n = 3) {
        const p = ctx.car && ctx.car.pos;
        if (!p || !L.units.length) return null;
        const list = [];
        for (const u of L.units) {
            const c = u.car;
            if (!c || !u.siren || !(u.mode === "chase" || u.mode === "pull" || u.mode === "haul")) continue;
            const d = Math.hypot(c.x - p.x, c.z - p.z);
            if (d < 170 && Number.isFinite(c.x) && Number.isFinite(c.h)) list.push({ c, d });
        }
        if (!list.length) return null;
        const out = [];                    // (in the units' own order: a friend's puppet #i stays the same cruiser)
        for (const { c } of list.slice(0, n)) out.push(Math.round(c.x * 10), Math.round(c.z * 10), Math.round(c.h * 1000) % 6283);
        return out;
    },
    config,
    /** Park a hidden speed-trap cruiser `ahead` metres up the road (another feature wants a cop around: underworld's
     *  "lead the bad guy past a cop"). Never mid-chase / in a town. → bool */
    trap(ahead = 300, side) {
        if (L.chase || !ctx.car || (ctx.town && ctx.town.active)) return false;
        try { return !!spawnTrap(ahead, side === undefined ? (Math.random() < 0.5 ? -1 : 1) : side); } catch (e) { console.error("[law] trap", e); return false; }
    },
    /** Wipe a live ⚠️ WARNING (a "donation" made it disappear). → bool (there was one) */
    clearWarning() { const had = L.sus > 0.04; L.sus = 0; return had; },
    /**
     * Another feature's charge gets its own lines: { key (a substring of the charge), name + weight (bounty 1–4),
     * cop: [arrest lines], lulu: [her replies], defense: "the lawyer's argument…", court: [{ who, p, text }…] (a courtroom
     * EVENT that always plays when the charge is on the sheet), nudge: "help" | "hurt" | "none" }. First match wins, so
     * these go before the built-in ones.
     */
    addCharge(def) {
        if (!def || !def.key) return false;
        if (def.cop || def.lulu) CHARGE_DIALOGUE.unshift({ key: def.key, cop: def.cop || ["You're under arrest."], lulu: def.lulu || ["…"] });
        if (def.defense) CHARGE_DEFENSE.unshift({ key: def.key, arg: def.defense });
        if (def.weight && def.name) CHARGE_WEIGHT[def.name] = def.weight;
        if (def.court) CHARGE_EVENTS.push({ key: def.key, ev: { id: "charge:" + def.key, nudge: def.nudge || "none", lines: def.court } });
        return true;
    },
    /** The courtroom event a charge sheet brings (court.js asks; see addCharge). */
    chargeEvent(charges) {
        for (const c of CHARGE_EVENTS) if ((charges || []).some(x => String(x).includes(c.key))) return c.ev;
        return null;
    },
    /** Someone who isn't a cruiser has eyes on her (a Shomrim radio tip, a chopper-cam…): mid-chase, the cops count
     *  her as SEEN for `sec` seconds (the search meter stops filling). Returns false when there's no chase. */
    spot(sec = 1) {
        if (!L.chase) return false;
        L.chase.tipT = Math.max(L.chase.tipT || 0, ctx.time + sec);
        return true;
    },
};
// test hook: internals + a log of law events (only read by the smoke test)
Object.defineProperty(law, "_dbg", { enumerable: false, value: { L, FORCE, run, log: [] } });

/**
 * Back on the road after the station / court / a jailbreak. Continues the run
 * that was interrupted (score, coins, the trip) a little further down the road,
 * or starts a fresh one when there is none (a lockup resumed after a refresh).
 */
export function resumeDriving({ s = null, fugitive = false, banner = "", onPlaced = null } = {}) {
    // a stolen ride is never handed back (it was evidence, then its owner's again)
    if (ctx.foot && ctx.foot.dropRide) ctx.foot.dropRide();
    run.ride = null;
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
