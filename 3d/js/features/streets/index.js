// features/streets — 🚗 STREET MAYHEM (GTA-style, PG-13 cartoon crime comedy).
//
//   jack.js    carjack anything on foot (one smooth yank-and-slide animation; the
//              driver sees stars, gets up ANGRY and reacts), drive THAT vehicle with
//              handling to match, 🤸 bail out of a moving car (dive + roll, it coasts on)
//   heat.js    3★+ roadblocks (cruisers across the lanes, barricades, cops who dive for
//              cover) + spike strips (flat tyres: wobble, sparks, no nitro)
//              — the star HUD, line-of-sight SEARCH and escape live in features/law
//   paint.js   🎨 PAINT & PRAY: Moishe's drive-through spray booth (new colour, tyres
//              fixed, heat gone; a skippable cutscene)
//   props.js   💥 smashable street props (instanced, pooled debris, a damage $ tally)
//   chop.js    🔧 Shmuel's Chop Shop: a call asks for a car ("a blue minivan"), jack one, deliver it
//   lab.js     the chase lab (a getaway-driver bot + a headless pursuit sim — tests / tuning)
//
// Everything random (props, garages, roadblocks, chop-shop calls, family texts) is
// gated by ctx.enabled("streets"): off in ?test unless enabled. In a 🎉 party it's ON and party-aware: props +
// Paint & Pray booths are seeded (the party's rng / road plan: the same for every friend), roadblocks + Shmuel's
// calls are personal (data.partyLocal cars, only for the player with the heat), and the carjack works on a shared
// car she CLAIMED (features/party: it pulls over the same way on every screen; gone for everyone once she drives
// off in it — ctx.party.claimTraffic). Sports coupes join the shared traffic (ctx.party.addTrafficKind).
// Events: streets:carjack · streets:bail · streets:roadblock · streets:spiked · streets:paint ·
// streets:smash · streets:crime · streets:chop (see ARCHITECTURE.md › Cross-feature contracts).
import { ctx, on, hook, css } from "../../core/ctx.js";
import { addTouchButton } from "../../input.js";
import { setControlRow } from "../../core/screens.js";
import { registerKind } from "../../traffic.js";
import { live, need, flushCrimes, PROP_KINDS, models } from "./common.js";
import { bot, sim } from "./lab.js";
import { J, RIDES, BIG_CAM, force, jackSpot, currentRide, canBail, bail, bailHint, startJack, nearestCandidate, jackable } from "./jack.js";
import { HEAT, spawnRoadblock, layStrip, puncture, repairTyres } from "./heat.js";
import { PROPS, loadProps, smashNear, addLooseProp, debrisCount, geysersOn } from "./props.js";
import { PAINT, cost as paintCost, start as paintStart, garageAhead, nearestGarage, paintCar, restorePaint } from "./paint.js";
import { CHOP, chopRequest, chopShopAhead } from "./chop.js";

// a sports coupe joins the traffic (and the carjack menu)
registerKind("streets_sports", { len: 4.3, halfW: 0.93, circles: [1.2, -1.2], r: 0.92, mass: 1.1, model: "streets_sports", paint: true });
hook("runStart", () => {
    const mix = ctx.traffic && ctx.traffic.config.mix;
    if (!mix) return;
    if (live()) need(["sports"]).then(() => { if (live()) mix.streets_sports = 0.07; }).catch(() => {});
    else delete mix.streets_sports;
});

on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(jackSpot);
    if (ctx.party && ctx.party.addTrafficKind) ctx.party.addTrafficKind("streets_sports", 0.04, () => live());
    if (live()) need(["npcMan", "npcWoman", "sports"]).catch(() => {});
    addTouchButton({ id: "streets_bail", emoji: "✋", label: "BAIL", action: "bail",
        visible: () => ctx.state === "playing" && canBail() && !!(currentRide() || (ctx.foot && ctx.foot.borrowed) || (ctx.law && ctx.law.wanted > 0)) });
    setControlRow("interact", "Interact · carjack (on foot)");
    setControlRow("bail", "Bail out (moving car)", "interact");
});
// crimes a cop saw while she was on foot are reported the moment she's driving again
hook("update", () => flushCrimes());

css("streets", `#tx_streets_bail { background: rgba(230, 81, 0, 0.85); }`);

ctx.streets = {
    // ── carjacking + rides ──
    /** On foot: jack this traffic car (or the nearest jackable one near her). → bool */
    carjack(car = null) {
        if (!ctx.foot || !ctx.foot.active || ctx.state !== "footRun") return false;
        const c = car || nearestCandidate();
        return !!(c && jackable(c) && startJack(c));
    },
    /** Traffic kinds she can jack and how each drives: { sedan: { label, feel, handling }, van, truck, cop, streets_sports }. */
    rides: RIDES,
    /** Ride model key → { d, h }: how much further back / higher the chase cam sits in a big ride (features/rides adds its own). */
    cams: BIG_CAM,
    /** The jacked vehicle she's driving right now: { kind, color } | null. */
    get ride() { const r = currentRide(); return r ? { kind: r.kind, color: r.color } : null; },
    /** The carjack animation is playing. */
    get jacking() { return !!J.active; },
    /** Can she dive out right now? / do it (returns true when she's out). */
    canBail, bail,
    /** "hold △" / "E at speed" / "✋ BAIL" for the current device. */
    bailHint,
    // ── heat (law owns the pursuit + stars + search; these are the extra teeth) ──
    /** A roadblock `ahead` metres up the road: { gap: lane d left open, spikes: false to leave them out }. */
    roadblock: (ahead = 280, opts = {}) => spawnRoadblock(ahead, opts),
    /** A spike strip across lane d at road distance s. */
    spikes: (s, d) => layStrip(s, d),
    /** Her tyres are shredded right now. */
    get flat() { return !!HEAT.flat; },
    puncture, repairTyres,
    // ── 🎨 Paint & Pray ──
    paint: {
        /** What a respray costs right now (30 + 15 per star). */
        cost: paintCost,
        /** The next booth ahead: { s, dist, built } | null. */
        nearest() { const n = nearestGarage(); return n ? { s: n.s, dist: n.dist, built: n.built } : null; },
        /** Start the drive-through right now at the next booth (it builds if needed). */
        enter() { const n = nearestGarage(); return n ? paintStart(n.g) : false; },
        /** Recolour her car / ride: { name, body, light, dark } (a per-run disguise). */
        repaint: paintCar, restore: restorePaint,
        get color() { return PAINT.color; },
    },
    // ── 💥 props ──
    /** This drive's property damage in $. */
    get damage() { return (ctx.G && ctx.G.streetDamage) || 0; },
    /** Smash every street prop within r of (x, z) — explosions, a getaway through a market… → count. */
    smashNear,
    // ── 🔧 chop shop ──
    chop: { request: chopRequest, get job() { return CHOP.job; } },
    /** Test knobs: { reaction: "fist"|"yell"|"chase"|"call", jack: true (spot without the gate), bail: true } */
    force,
    debug: { bot, sim, J, HEAT, PROPS, PAINT, CHOP, loadProps, garageAhead, chopShopAhead, addLooseProp, PROP_KINDS, nearestCandidate, debrisCount, geysersOn, models },

};
