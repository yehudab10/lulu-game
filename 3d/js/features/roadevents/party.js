// features/roadevents — ROADSIDE EVENTS IN A 🎉 PARTY.
//
// Solo, events come from timers + dice around Lulu's car. In a party that would give every
// friend a different road, so the random scheduler is off (state.js canSpawn) and this takes
// over: WHICH event happens WHERE is a pure function of the party's seed + the road position
// (ctx.party.road / h01), so every friend meets the same thing at the same s. Each screen
// builds its own copy as its car gets near (set pieces ~950 m out, before their chunks are
// built, so the reservations land the same everywhere); what you do with it (a scoop, a
// burger, a passenger, a splash) is yours — rewards go to whoever earns them.
//
//   big (one per planned chunk, shared with cameos / hustle): 🍦 ice-cream stand · 🍔 drive-thru ·
//        ⛽ gas station + 🛢️ nitro cans  (Road Trip / 🌍 Free Roam only)
//   small (their own sub-slots per chunk): 🚧 cones · 💦 puddles · 🕳️ potholes · 🦆 animals ·
//        🚶 strollers (passengers) · 🙋 hitchhikers — races / dashes / tag get only the fair
//        hazards (cones, puddles, potholes, animals)
//
// Left out on purpose: anything that DRIVES (ambulances, school buses, ice-cream trucks, drunk
// drivers, steamrollers, fender benders) — party traffic is a pure function of the clock and
// can't stop for them — and anything that must stop the traffic (toll plaza, train crossing,
// parade, crossing guards, construction zones' closed lanes).
import { ctx, hook, on } from "../../core/ctx.js";
import { LANES_OURS, LANES_ONCOMING } from "../../world.js";
import { EVENTS } from "./state.js";
import { K, models, personColors } from "./common.js";
import { addPed } from "./passengers.js";

const CH = 200;
const BIG = {
    iceCream: { ev: "iceCream", lead: 950 },
    driveThru: { ev: "driveThru", lead: 950 },
    gas: { ev: "gasStation", lead: 950 },
};
const P = { done: new Set(), log: [], seen: 0 };
export const partyRun = () => !!(ctx.party && ctx.party.active && ctx.G.mode === "party");
const full = A => !!A && (A.k === "trip" || A.k === "roam");

// register the big kinds with the party's road plan (boot: ctx.party exists by then on every screen,
// and every screen registers in the same order — the import order)
on("boot", () => {
    if (!ctx.party || !ctx.party.road) return;
    ctx.party.road.claim("roadevents", {
        iceCream: A => (full(A) ? 1 : 0),
        driveThru: A => (full(A) ? 1 : 0),
        gas: A => (full(A) ? 0.6 : 0),
    });
});
on("run:start", () => { P.done.clear(); P.log.length = 0; });

const modelsReady = name => (EVENTS[name] ? EVENTS[name].models : []).every(k => models[K(k)] || models[k]);

/** The small things planned in chunk k: [{ key, ev, s, opts, at(car) → spawn now? }] (pure). */
export function smallsAt(k) {
    const party = ctx.party, A = party.activity || {};
    const sp = party.road.span, out = [];
    const s0 = k * CH;
    if (s0 + CH < Math.max(240, sp.s0 - 300) || s0 > sp.s1) return out;
    const big = party.road.slot(k);
    const clear = s => !big || Math.abs(s - big.s) > 70;
    const r = party.rng("re:" + k);
    // hazards on the road: up to three sub-slots
    for (let i = 0; i < 3; i++) {
        const on_ = r() < 0.5, kr = r(), s = s0 + 18 + i * 62 + r() * 40, oncoming = r() < 0.2, lane = r(), jit = r() - 0.5, n = r() < 0.25 ? 2 : 1;
        if (!on_ || !clear(s)) continue;
        const d = (oncoming ? LANES_ONCOMING : LANES_OURS)[lane < 0.5 ? 0 : 1] + jit * 1.4;
        if (kr < 0.45) out.push({ key: `cone:${k}:${i}`, ev: "cone", s, opts: { s, d, n, oncoming }, ahead: 150 });
        else if (kr < 0.75) out.push({ key: `puddle:${k}:${i}`, ev: "puddle", s, opts: { s, d }, ahead: 150 });
        else out.push({ key: `pothole:${k}:${i}`, ev: "pothole", s, opts: { s, d }, ahead: 150 });
    }
    // an animal crossing
    const ar = r(), type = ["duck", "raccoon", "ostrich"][Math.floor(r() * 3)], side = r() < 0.5 ? -1 : 1, v = r(), as = s0 + 40 + r() * 120;
    if (ar < 0.3 && k >= 4 && clear(as)) out.push({ key: `animal:${k}`, ev: "animal", s: as, opts: { s: as, type, side, v: v }, animal: true });
    if (full(A)) {
        // a stroller on the right edge (honk-scare / pick up as a passenger) and a hitchhiker
        const pr = r(), ps = s0 + 30 + r() * 140, pk = r(), pd = 5.6 + r(), pv = 1 + r() * 0.6;
        if (pr < 0.2 && clear(ps)) out.push({ key: `ped:${k}`, ev: "pedestrian", s: ps, opts: { s: ps, d: pd, kind: "walker", cross: false, model: ["npcWoman", "npcMan", "npcWoman", "npcMan", "npcKid"][Math.floor(pk * 5)], vs: pv, colors: party.seeded("rePed:" + k, () => personColors()) }, ahead: 150 });
        const hr = r(), hs = s0 + 40 + r() * 120, hside = r() < 0.5 ? -1 : 1;
        if (hr < 0.12 && clear(hs)) out.push({ key: `hitch:${k}`, ev: "hitchhiker", s: hs, opts: { s: hs, side: hside }, ahead: 170 });
    }
    return out;
}

const SPEC_V = { duck: [1.6, 2.4], raccoon: [2.6, 4.0], ostrich: [5.0, 8.0] };
function fire(name, opts, key, s) {
    P.done.add(key);
    P.log.push({ key, ev: name, s: Math.round(s * 10) / 10 });
    if (P.log.length > 80) P.log.shift();
    try {
        if (name === "pedestrian") { addPed(opts); return; }       // (its spawner re-rolls the stroll speed + colours)
        const ev = EVENTS[name];
        if (ev) ev.spawn(opts).catch(e => console.error("[roadevents] party", name, e));
    } catch (e) { console.error("[roadevents] party", name, e); }
}

hook("update", (dt, _P, controlsOn) => {
    if (!partyRun() || !controlsOn || ctx.state !== "playing" || !ctx.enabled("roadevents") || !ctx.party.road) return;
    if (ctx.roadevents && ctx.roadevents.auto === false) return;
    const car = ctx.car, road = ctx.party.road;
    // the big ones (set pieces): far enough out that their reservations beat the chunk builder
    for (let k = Math.floor((car.s - 40) / CH); k <= Math.floor((car.s + 1000) / CH); k++) {
        const sl = road.slot(k);
        if (!sl || sl.id !== "roadevents" || P.done.has(sl.key)) continue;
        const B = BIG[sl.kind];
        if (!B || car.s < sl.s - B.lead || car.s > sl.s - 120) { if (B && car.s > sl.s - 120) P.done.add(sl.key); continue; }
        if (!modelsReady(B.ev)) continue;
        fire(B.ev, { s: sl.s, side: sl.side }, sl.key, sl.s);
        if (sl.kind === "gas") {
            // the station's nitro cans out on the road just past it (the same lanes for everyone)
            const r = ctx.party.rng("gas:" + k);
            for (let i = 0; i < 2; i++) { const s = sl.s + 45 + i * 38 + r() * 20, d = LANES_OURS[r() < 0.5 ? 0 : 1] + (r() - 0.5); fire("fuelCan", { s, d }, sl.key + ":can" + i, s); }
        }
    }
    // the small ones: just ahead of the car (the same distance out for everyone)
    for (let k = Math.floor((car.s - 20) / CH); k <= Math.floor((car.s + 260) / CH); k++) {
        for (const it of smallsAt(k)) {
            if (P.done.has(it.key)) continue;
            if (it.s < car.s + 25) { P.done.add(it.key); continue; }          // too late: it's yours to miss
            let ahead = it.ahead || 150;
            if (it.animal) {
                const V = SPEC_V[it.opts.type], v = V[0] + it.opts.v * (V[1] - V[0]);
                ahead = Math.max(45, Math.min(200, Math.max(8, car.speed) * (10 - 3.5) / v));
            }
            if (it.s - car.s > ahead) continue;
            if (!modelsReady(it.ev)) continue;
            const opts = it.animal ? Object.assign({}, it.opts, { v: SPEC_V[it.opts.type][0] + it.opts.v * (SPEC_V[it.opts.type][1] - SPEC_V[it.opts.type][0]) }) : it.opts;
            fire(it.ev, opts, it.key, it.s);
        }
    }
}, 3);

/** For tests: what this screen has spawned from the plan ([{key, ev, s}]), and the plan itself. */
export const partyDebug = {
    log: P.log,
    done: P.done,
    smallsAt,
    /** Every planned roadevents thing (big + small) with s in [s0, s1], sorted. */
    plan(s0, s1) {
        if (!ctx.party || !ctx.party.road) return [];
        const out = [];
        for (let k = Math.floor(s0 / CH); k <= Math.floor(s1 / CH); k++) {
            const sl = ctx.party.road.slot(k);
            if (sl && sl.id === "roadevents" && sl.s >= s0 && sl.s <= s1) out.push({ key: sl.key, ev: BIG[sl.kind].ev, s: Math.round(sl.s * 10) / 10 });
            for (const it of smallsAt(k)) if (it.s >= s0 && it.s <= s1) out.push({ key: it.key, ev: it.ev, s: Math.round(it.s * 10) / 10 });
        }
        return out.sort((a, b) => a.s - b.s);
    },
};
