// features/world/lapsigns.js — 🌍 ONE WORLD (ci/onemap stage 3): real distances on the highway's signs.
//
// The highway is a 16 km lap with every place at a fixed lap metre (world/lapmap.js › lapPlaces), so a sign can say
// how far it really is: just past each town's and JFK's on-ramp a green board lists the next three places up the road,
// in real miles ("✈ JFK · 3.2 MI"). Added a few km ahead of her, once per lap per board (fixed data: the same boards,
// the same numbers, on every lap and every friend's screen).
import { ctx, hook, on } from "../../core/ctx.js";
import { lapWorld, lapAt } from "../../world.js";
import { lapPlaces, ahead } from "./lapmap.js";

const DONE = new Set();
let tick = 0;
const BIG = new Set(["town", "airport", "rest"]);
/** Where a board stands: past the place's on-ramp merge (a town's accel lane ends ~420 m on, JFK's ~900 m). */
const boardAfter = p => p.m + (p.kind === "airport" ? 1100 : 520);    // (clear of the next place's 1 MI sign)
/** …and for drivers going down the lap: just before the place in lap terms (past it, their way). */
const boardBefore = p => p.m - (p.kind === "airport" ? 1100 : 520);
const _h = {};
/** Is she driving up the lap (+s)? (her heading against the road's) */
function upLap() {
    const road = ctx.world.road, car = ctx.car;
    if (!road || !road.at) return true;
    const rh = road.at(car.s, _h).h;
    return Math.sin(car.h) * Math.sin(rh) + Math.cos(car.h) * Math.cos(rh) >= 0;
}
const label = p => p.kind === "rest" ? "REST AREA" : p.name.toUpperCase();

hook("runStart", () => { DONE.clear(); tick = 0; if (ctx.world) ctx.world.dir = 1; }, 30);      // (a new run streams up the lap again — ci/twoway)
on("title", () => DONE.clear());

hook("update", dt => {
    if ((tick -= dt) > 0) return;
    tick = 1;
    if (!lapWorld() || !ctx.world || !ctx.car || (ctx.town && ctx.town.active)) return;
    const w = ctx.world, s = ctx.car.s, places = lapPlaces().filter(p => BIG.has(p.kind));
    for (const p of places) {
        if (p.kind === "rest") continue;
        const at = lapAt(s, boardAfter(p), true);
        if (at - s < 1200 || at - s > 4200 || DONE.has(Math.round(at))) continue;
        DONE.add(Math.round(at));
        const from = boardAfter(p) % 16000;
        const next = places.filter(q => q !== p).map(q => ({ q, d: ahead(q.m, from) })).sort((a, b) => a.d - b.d).slice(0, 3);
        w.addSign({ s: at, d: 10.6, bg: "#1f7a46", w: 5.2, h: 3.0, tw: 512, th: 300,
            lines: next.map(({ q, d }) => `${label(q)}  ${(d / 1609).toFixed(1)} MI`) });
    }
    // (the far carriageway — drivers going DOWN the lap, ci/twoway: a board just past each place THEIR way, facing them,
    //  listing the next three places down the lap; added a few km ahead of her when she's going that way)
    const up = upLap();
    if (up) return;
    for (const p of places) {
        if (p.kind === "rest") continue;
        let at = lapAt(s, boardBefore(p));
        if (at > s) at -= 16000;          // (the copy behind her: she's driving toward it)
        if (s - at < 1200 || s - at > 4200 || at < 0 || DONE.has("b" + Math.round(at))) continue;
        DONE.add("b" + Math.round(at));
        const from = ((boardBefore(p) % 16000) + 16000) % 16000;
        const next = places.filter(q => q !== p).map(q => ({ q, d: ahead(from, q.m) })).sort((a, b) => a.d - b.d).slice(0, 3);
        w.addSign({ s: at, d: -10.6, back: true, bg: "#1f7a46", w: 5.2, h: 3.0, tw: 512, th: 300,
            lines: next.map(({ q, d }) => `${label(q)}  ${(d / 1609).toFixed(1)} MI`) });
    }
    // …and 600 m before each town / JFK / rest area their way: its exit is on the other side (for now — ci/twoway's plan)
    for (const p of lapPlaces().filter(q => BIG.has(q.kind))) {
        let at = lapAt(s, p.m + 600);
        if (at > s) at -= 16000;
        if (s - at < 600 || s - at > 4200 || at < 0 || DONE.has("x" + Math.round(at))) continue;
        DONE.add("x" + Math.round(at));
        w.addSign({ s: at, d: -10.6, back: true, bg: "#1f7a46", w: 4.6, h: 2.6, tw: 512, th: 300,
            lines: [label(p), "EXIT ON THE OTHER SIDE", "turn around to get off"] });
    }
});
