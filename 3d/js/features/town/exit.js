// features/town — the EXITS on the Cruise highway: the PLAN (exitbuild.js draws it). Each Cruise exit is an
// INTERCHANGE that offers every town (towns/index.js › INTERCHANGE), laid out like a real US exit: advance signs with
// exit-number tabs (1 MI, ½ MI), a taper into a parallel deceleration lane (EXIT ONLY painted in it, the gantry's EXIT ONLY
// board over it), the gore (painted, then grass with a crash cushion), a RAMP 25 MPH advisory, ONE off-ramp that S-curves
// away and splits (the inner branch → the first town, the outer → the second), guardrails, and each branch ends at a STOP
// line at a T-junction with a local cross road — a gas station, a "Welcome to …" sign, the first houses — where the town
// fades in. The inner cross road's near end turns into the on-ramp back (a merge gore, an acceleration lane): driving out
// of town puts her there. Staying in lane always passes it; only a branch past COMMIT takes her into a town, so a drift
// onto the shoulder or the decel lane never does: she can steer back across the painted gore until the split. Every lane
// is `paved` level 3 (core: the car drives it like road, and nothing may be placed on it). A one-town exit (tests / debug:
// `exitAhead(ahead, id)`) is the same with a single branch and that town's own signs.
// Exits sit at fixed distances into a Cruise run (`highway: { first, every }`), planned ≥ 900 m ahead so world.reserve()
// keeps the trees, houses and poles off the ramps and cross roads, slid clear of pull-in places, rest areas
// (features/exits) and reserved stretches (the coast's ocean, a family's house), and built in chunk:build like every
// other set piece (same chunk → same ramps).
import { ctx, on, hook } from "../../core/ctx.js";
import { registerModels, ensureModels } from "../../models.js";
import { paved } from "../../core/driving.js";
import { INTERCHANGE, fillLine } from "./towns/index.js";

// the interchange gantry (features/exits' Blender module builds it; the old one-board gantry is the fallback)
registerModels({ town_gantry: "town_gantry", exits_gantry: "exits_gantry" });

export const X = { exits: [] };
/** index.js: `fits(s, towns)` — would the towns this exit offers stand clear of the highway if it were at s (they are
 *  ATTACHED to its cross roads)? Planning slides an exit on until they do. */
export const FIT = { fits: null };
// ── the layout (u = s − exit.s along the highway, d = metres right of its centre line) ──
//   u −230 → −175   the taper: the decel lane widens out of the right lane's edge (EXIT ONLY painted in it)
//   u −175 → −60    the parallel deceleration lane (the gantry's EXIT ONLY board over it at −110)
//   u −60           the gore nose: the ramp leaves (a painted gore, then grass, a crash cushion at its tip)
//   u 0             the split (two towns): the inner branch → towns[0], the outer → towns[1]
//   u 55            COMMIT: past here on a branch, that town it is
//   u 118 / 168     each branch's STOP line at a T-junction with a local road (a cross road at X_OUT / X_IN),
//                   guide signs, a gas station, "Welcome to …", houses starting → the fade into town
//   u 181 → 300     the on-ramp back (from the inner cross road's near end), the merge gore,
//   u 300 → 420     the acceleration lane tapering back into the right lane
export const TAPER0 = -230, TAPER1 = -175, RAMP0 = -60;
/** Where the ramp's branches part (u = s − exit.s), and where a branch commits her to its town. */
export const PART = 55, COMMIT = 55, GANTRY = -110;
export const HALF = 2.3;                   // a ramp lane's half width (lane + shoulders)
export const XW = 3.6;                     // a local cross road's half width (two lanes)
export const STOP_IN = 168, STOP_OUT = 118, D_IN = 40, D_OUT = 72;
export const X_IN = STOP_IN + XW + 0.6, X_OUT = STOP_OUT + XW + 0.6;
/** The cross roads' far ends (toward town) and the on-ramp's corner off the inner one. */
export const X_FAR = 172, ARC_R = 9, ON_D0 = 22;
export const ON0 = X_IN + ARC_R, ON1 = 300, ACC1 = 420;
/** Kept for callers of the old layout: where the inner / outer branches end. */
export const RAMP1 = STOP_IN, OUTER1 = STOP_OUT;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const LANE_EDGE = 7, DECEL_EDGE = 11.2, RAMP_D0 = (LANE_EDGE + DECEL_EDGE) / 2;
/** The inner branch's centre line: leaves the decel lane at the gore, an S-curve out to D_IN, straight into its T. */
export const rampD = u => RAMP_D0 + (D_IN - RAMP_D0) * smooth((u - RAMP0) / (STOP_IN - 8 - RAMP0));
const DELTA = D_OUT - rampD(STOP_OUT);
/** The outer branch (the second town) peels off it after the split at u = 0, out to D_OUT. */
export const outerD = u => rampD(u) + DELTA * smooth(u / (STOP_OUT - 8));
/** The decel lane's outer edge (it tapers out from the highway's edge line). */
export const taperEdge = u => LANE_EDGE + (DECEL_EDGE - LANE_EDGE) * smooth((u - TAPER0) / (TAPER1 - TAPER0));
/** The on-ramp's centre line (off the inner cross road's corner, back down to the accel lane) + its half width. */
export const onD = u => ON_D0 - (ON_D0 - RAMP_D0) * smooth((u - ON0) / (ON1 - ON0));
export const onHalf = u => HALF + (XW - HALF) * (1 - smooth((u - ON0) / 24));
/** The acceleration lane's outer edge (it tapers back into the right lane). */
export const accelEdge = u => LANE_EDGE + (DECEL_EDGE - LANE_EDGE) * (1 - smooth((u - ON1) / (ACC1 - ON1)));
/** The cross roads: { k (its branch), u (centre line), d0 → d1 (the near end → toward town), t (the T's d) }. */
export function crossRoads(e) {
    const out = [{ k: 0, u: X_IN, d0: ON_D0 + ARC_R, d1: X_FAR, t: D_IN }];
    if (e.two) out.push({ k: 1, u: X_OUT, d0: D_OUT - 12, d1: X_FAR, t: D_OUT });
    return out;
}

/** The advance signs (u = s − exit.s, metres) — before the gantry and the decel lane. */
const SIGN_MILE = -1450, SIGN_HALF = -880, SIGN_LAST = -470;
/** The stretch an exit's signs → ramps cover (for other planners: rest areas keep out of it). */
export const SPAN = { a: SIGN_MILE - 40, b: ACC1 + 60 };

/** Is a stretch [a, b] on the right side reserved by something big (the coast's ocean, a family's yard, a rest area)? */
export function reservedRight(a, b, dMin = 9, dMax = 60) {
    const w = ctx.world;
    if (!w || !w.reserved) return false;
    return w.reserved.some(r => r.side !== -1 && r.s1 > a && r.s0 < b && r.dMax > dMin && r.dMin < dMax && r.dMax - r.dMin > 12);
}
/** Is a sign spot taken (another set piece's reserve right there)? */
function signBusy(s) { const w = ctx.world; return !(ctx.party && ctx.party.active) && !!w && w.isReserved && (w.isReserved(s, 10.6, 6) || w.isReserved(s, 14, 6)); }

/** Slide an exit forward until its signs, decel lane and ramps keep clear of every pull-in place
 *  (features/world's ctx.places: Gas 'n' Go, the Lookout, the family's driveways…), every rest area
 *  (features/exits) and big reserved stretches (the coast's ocean). */
const airportIn = (a, b) => { try { return !!(ctx.airport && ctx.airport.zones && ctx.airport.zones(a, b).length > 0); } catch (e) { return false; } };
function clearOfPlaces(s, towns = null, once = false) {
    const P = ctx.places;
    let busy = [];
    try { if (P && P.list && P.at) for (const p of P.list()) busy = busy.concat(P.at(p.id) || []); } catch (e) { busy = []; }
    const spans = () => { try { return ctx.exits && ctx.exits.spans ? ctx.exits.spans() : []; } catch (e) { return []; } };
    // (fixed data only — the places + the town's fit beside the road — so every run and every friend's screen has the exits
    //  on the same metres: rest areas, set pieces and the rest plan around the exits, never the other way — ci/exits2)
    const party = true;
    for (let k = 0; k < 300; k++) {
        const a = s + SPAN.a, b = s + SPAN.b;
        const clash = busy.some(x => x > s - 760 && x < s + ACC1 + 80) ||
            (!party && spans().some(o => o.b > a && o.a < b)) ||
            (!party && reservedRight(s + TAPER0 - 30, s + ACC1 + 30)) ||
            (towns && FIT.fits && !FIT.fits(s, towns)) ||
            // (✈ the airport is planned FIRST from fixed data; a town exit slides past its zone — empty until it's switched on)
            airportIn(s + SPAN.a, s + ACC1 + 80);
        if (!clash) return s;
        if (once) return null;
        s += 50;              // (fine steps: an attached town fits ~a third of the spots along the road — FIT)
    }
    return s;
}

/**
 * Plan an exit at s (slid clear first) for these towns: one → a plain exit with its own signs;
 * two → the interchange (the inner branch is towns[0]). Returns the exit or null.
 */
/** Would an exit at s for these towns plan right there (no sliding)? (debug: exitAhead looks either way for one) */
export const exitClear = (s, towns) => clearOfPlaces(s, towns, true) != null;
/** Where an exit planned at s for these towns would land (slid clear; fixed data only — a pure function of s). */
export const exitFitS = (s, towns) => clearOfPlaces(s, (Array.isArray(towns) ? towns : [towns]).filter(Boolean));
export function planExit(s, towns) {
    const w = ctx.world;
    towns = (Array.isArray(towns) ? towns : [towns]).filter(Boolean);
    if (!w || !towns.length) return null;
    s = clearOfPlaces(s, towns);
    if (X.exits.some(e => Math.abs(e.s - s) < 50)) return null;
    const res = [];
    const reserve = (a, b, side, d0, d1) => { w.reserve(a, b, side, d0, d1); res.push(w.reserved[w.reserved.length - 1]); };
    const two = towns.length > 1;
    reserve(s + TAPER0 - 30, s + ACC1 + 30, 1, 7.2, 125);
    reserve(s + GANTRY - 12, s + GANTRY + 12, 1, 7.2, 16);
    const e = { s, town: towns[0], towns, two, res, signs: [], used: 0 };
    // the cross roads run on out toward town (houses start along them): keep the world's own houses / trees off
    for (const c of crossRoads(e)) reserve(s + c.u - 18, s + c.u + 18, 1, 7.2, c.d1 + 14);
    const T0 = towns[0], S0 = T0.lines.SIGNS, IS = INTERCHANGE.signs;
    const fill = lines => lines.map(l => fillLine(l, towns));
    const tab = two ? `EXITS ${towns.map(t => t.highway.no).filter(Boolean).join(" · ")}` : (T0.highway.no ? `EXIT ${T0.highway.no}` : null);
    const signs = e.signs;
    const add = (u, def) => {
        let at = s + u;
        // (a busy spot: an advance board ("1 MI" / "½ MI") slides BACK, away from the exit — sliding toward it put the "½ MI"
        //  board 420 m out; the last-chance board still slides on)
        for (let k = 0; k < 4 && signBusy(at); k++) at += u <= -600 ? -70 : 70;
        reserve(at - 20, at + 20, 1, 9, 13);
        signs.push(Object.assign({ s: at, d: 10.6, bg: "#1f7a46", tab }, def));
    };
    // the gore sign stands on the grass past the painted gore (with a crash cushion at its nose — exitbuild.js)
    const goreD = u => (8.8 + rampD(u) - HALF) / 2;
    if (two) {
        add(SIGN_MILE, { lines: fill(IS.mile), w: 4.8, h: 2.6, tw: 512, th: 280 });
        add(SIGN_HALF, { lines: fill(IS.half), w: 4.8, h: 2.6, tw: 512, th: 280 });
        add(SIGN_LAST, { lines: IS.lastChance, w: 4.4, h: 2.4, tw: 512, th: 280, tab: null });
        signs.push({ s: s + 26, d: goreD(26), lines: fill(IS.gore), bg: "#1f7a46", w: 2.4, h: 1.4 });
        // the split: one board just before the fork, then each town's own funny copy beside its branch
        signs.push({ s: s + 10, d: outerD(10) + HALF + 2.6, lines: fill(IS.split), bg: "#1f7a46", w: 3.6, h: 1.8, tw: 512, th: 256 });
        signs.push({ s: s + 85, d: rampD(85) - HALF - 2.4, lines: S0.lastChance, bg: "#1f7a46", w: 3.0, h: 1.7, tw: 512, th: 280 });
        const S1 = towns[1].lines.SIGNS;
        signs.push({ s: s + 85, d: outerD(85) + HALF + 2.4, lines: S1.lastChance, bg: "#1f7a46", w: 3.0, h: 1.7, tw: 512, th: 280 });
    } else {
        add(-700, { lines: S0.advance, w: 4.6, h: 2.5, tw: 512, th: 280 });
        add(SIGN_LAST, { lines: S0.lastChance, w: 4.2, h: 2.3, tw: 512, th: 280 });
        signs.push({ s: s + 26, d: goreD(26), lines: S0.gore, bg: "#1f7a46", w: 2.4, h: 1.4 });
    }
    for (const sg of signs) w.addSign(sg);
    const roads = crossRoads(e);
    e.branches = towns.slice(0, 2).map((town, k) => ({ town, k, dOf: k ? outerD : rampD, end: k ? STOP_OUT : STOP_IN, stop: k ? STOP_OUT : STOP_IN, cross: roads[k] }));
    X.exits.push(e);
    X.exits.sort((a, b) => a.s - b.s);
    return e;
}
export function clearExits() {
    const w = ctx.world;
    for (const e of X.exits) {
        for (const r of e.res) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
        for (const sg of e.signs) { const i = w.signs.indexOf(sg); if (i >= 0) w.signs.splice(i, 1); }
    }
    X.exits.length = 0;
}
/** The exit whose ramps / roads are at highway distance s (or null). */
export function exitAt(s) { return X.exits.find(e => s > e.s + TAPER0 - 20 && s < e.s + ACC1 + 40) || null; }

/**
 * Where the car is relative to exit e: { phase: null | "decel" | "ramp" | "branch", branch: k | null, u }.
 *   decel  — in the deceleration lane (she can still drift back into the right lane)
 *   ramp   — on the shared ramp before the split (back across the painted gore is still possible)
 *   branch — clearly on branch k past COMMIT: that town it is (index.js fades across at its stop sign)
 */
export function rampPhase(e, s, d, out = {}) {
    const u = s - e.s;
    out.u = u; out.phase = null; out.branch = null;
    if (u < TAPER0 || u > STOP_IN + 4 || d < 6.6) return out;
    if (u >= COMMIT) {
        for (const b of e.branches) {
            if (u > b.stop + 2) continue;
            if (Math.abs(d - b.dOf(u)) < HALF + 0.9) { out.phase = "branch"; out.branch = b.k; return out; }
        }
        return out;
    }
    if (u < RAMP0 + 6) { if (d > 7.35 && d < taperEdge(u) + 1.2) out.phase = "decel"; return out; }
    const lo = rampD(u) - HALF - 0.6, hi = (e.two ? outerD(u) : rampD(u)) + HALF + 0.6;
    if (d > lo && d < hi) out.phase = "ramp";
    else if (d > 7.35 && d < lo && u < RAMP0 + 70) out.phase = "decel";      // on the painted gore: still deciding
    return out;
}
/** Is the car on a branch, far enough along to commit? → the branch index, or −1. */
export function onRamp(e, s, d) { const r = rampPhase(e, s, d); return r.phase === "branch" ? r.branch : -1; }

/** Is (u, d) on cross road c's asphalt? It runs STRAIGHT off the highway at e.s + c.u (exitbuild.js crossStrip) —
 *  on a bend two lines of constant u fan apart by metres out at its far end, so the test is in its own frame. */
const _o = {}, _q = {};
function onCross(e, c, u, d) {
    if (Math.abs(u - c.u) <= 1e-3) return true;
    const road = ctx.world && ctx.world.highway;
    if (!road) return Math.abs(u - c.u) <= XW + 0.3;
    road.point(e.s + c.u, 0, _o); road.point(e.s + u, d, _q);
    const fx = Math.sin(_o.h), fz = Math.cos(_o.h), dx = _q.x - _o.x, dz = _q.z - _o.z;
    return Math.abs(dx * fx + dz * fz) <= XW + 0.3;
}
/** Is (u, d) on one of exit e's LANES (decel / accel lane, a ramp, a painted gore, a cross road)? */
export function laneAt(e, u, d) {
    if (d < 6.5 || u < TAPER0 - 1 || u > ACC1 + 1) return false;
    if (u <= RAMP0 + 2 && d <= taperEdge(u) + 0.3) return true;                          // the taper + decel lane
    if (u >= RAMP0 - 2 && u <= RAMP0 + 72 && d <= rampD(u) - HALF + 0.2) return true;     // the painted gore
    for (const b of e.branches) if (u >= RAMP0 - 2 && u <= b.stop + 0.5 && Math.abs(d - b.dOf(u)) <= HALF + 0.3) return true;
    if (e.two && u >= 0 && u <= 46 && d >= rampD(u) && d <= outerD(u)) return true;      // the widening + the second gore
    for (const c of crossRoads(e)) if (Math.abs(u - c.u) <= XW + 25 && d >= c.d0 - 0.3 && d <= c.d1 && onCross(e, c, u, d)) return true;
    // the inner cross road's corner into the on-ramp
    if (u >= X_IN - XW - 0.3 && u <= ON0 + 0.3 && d >= ON_D0 - XW - 0.3 && d <= ON_D0 + ARC_R + 0.3) {
        const r = Math.hypot(u - ON0, d - (ON_D0 + ARC_R));
        if (Math.abs(r - ARC_R) <= XW + 0.3) return true;
    }
    if (u >= ON0 - 0.5 && u <= ON1 + 2 && Math.abs(d - onD(u)) <= onHalf(u) + 0.3) return true;   // the on-ramp
    if (u >= ON1 - 62 && u <= ON1 && d < onD(u) - onHalf(u)) return true;                         // the merge gore
    if (u >= ON1 - 2 && d <= accelEdge(u) + 0.3) return true;                                     // the accel lane
    return false;
}

// the ramps are road, not grass — and LANES (core's paved registry: level 3, so nothing is ever placed on them)
paved.push((s, d) => {
    if (d < 6.5 || !X.exits.length || (ctx.town && ctx.town.active)) return 0;
    const e = exitAt(s);
    return e && laneAt(e, s - e.s, d) ? 3 : 0;
});

/** Where she rejoins the highway from town: on the on-ramp, heading down it → { s, d, h } (highway coords). */
export function onRampSpot(exitS, u = ON0 + 22) {
    const road = ctx.world.highway, d = onD(u), p = road.point(exitS + u, d, {});
    const slope = (onD(u + 1) - onD(u - 1)) / 2;
    return { s: exitS + u, d, x: p.x, z: p.z, h: p.h - Math.atan(slope) };
}

/** The line a car drives off exit e onto branch b at u: the right lane → the decel lane → the ramp → the branch (d). */
export function exitLineD(b, u) {
    return u < TAPER0 + 10 ? 5.25 : u < TAPER1 + 15 ? 5.25 + (u - TAPER0 - 10) / (TAPER1 - TAPER0 + 5) * (RAMP_D0 - 5.25) : u < RAMP0 ? RAMP_D0 : b.dOf(u);
}
/** Test / debug: a driving line (u, d pairs) from the right lane down the decel lane onto branch k, to its stop line. */
export function rampRoute(e, k = 0, from = -300) {
    const b = e.branches[k] || e.branches[0], pts = [];
    for (let u = from; u <= b.stop - 4; u += 10) pts.push([u, +exitLineD(b, u).toFixed(2)]);
    return pts;
}

// ── a chase down the off-ramp (law's hook "copRoute", as JFK's chase.js does for the airport's roads) ──
// Law's own steering aims a cruiser at her lateral offset off the highway: on a curving ramp that cut straight across the
// painted gore, the grass and the guardrails. While she's on a town exit's decel lane / ramp / branch / at its T (the town
// not entered yet), a chasing cruiser behind her drives the ramp's own line instead, and straight at her once past its end.
const _cr = {}, _ca = { e: null, b: null, uC: 0, tx: 0, tz: 0 };
function aimRamp(la, out) {
    const A = _ca, b = A.b, ua = A.uC + la;
    if (ua >= b.stop - 4) { out.x = A.tx; out.z = A.tz; return out; }
    return ctx.world.highway.point(A.e.s + ua, exitLineD(b, ua), out);
}
/** The on-ramp's line at u (the ramp, then the middle of the acceleration lane). */
const onLineD = u => (u < ON1 ? onD(u) : (LANE_EDGE + accelEdge(u)) / 2);
const _co = { e: null, uC: 0, dC: 0 };
function aimOn(la, out) {
    const A = _co, hw = ctx.world.highway;
    // still up the inner cross road (the town side of the ramp's corner): down it toward the corner first
    if (A.dC > ON_D0 + ARC_R + 2 && Math.abs(A.uC - X_IN) < 16) return hw.point(A.e.s + X_IN, Math.max(ON_D0 + ARC_R, A.dC - la), out);
    const ua = Math.max(ON0, A.uC) + la;
    return hw.point(A.e.s + ua, ua < ACC1 ? onLineD(ua) : 5.25, out);
}
hook("copRoute", (c, unit, ch) => {
    if (!unit || (unit.mode !== "chase" && unit.mode !== "pull") || (ctx.town && ctx.town.active) || !ctx.car || !ctx.world) return null;
    const car = ctx.car, hw = ctx.world.highway, pull = unit.mode === "pull";
    // (SEARCHING — they've lost sight of her: law's own lanes, they fly on up the highway; that's how taking an exit unseen
    //  shakes them — law/index.js town:enter. Only a cruiser that can SEE her follows her down the ramp.)
    if (ch && ch.searching) return null;
    const look = null;
    const ts = look ? look.s : car.s, td = look ? look.d : car.d;
    const e = exitAt(ts);
    if (!e) return null;
    const ph = rampPhase(e, ts, td, _cr), u = ts - e.s;
    const uC = c.s - e.s;
    // back OUT of town: she's on the on-ramp / the accel lane — a cruiser behind her comes down the cross road to the ramp's
    // corner, then along the on-ramp (not across the grass between them)
    if (!ph.phase && u > ON0 - 6 && u < ACC1 && td > 6.6 && Math.abs(td - onLineD(u)) < 4.5) {
        if (uC > u + 5 || uC < X_IN - 40) return null;
        Object.assign(_co, { e, uC, dC: c.d });
        return { gap: Math.max(0, (u - uC) + Math.max(0, c.d - ON_D0 - ARC_R) - (pull ? 7.2 : 0)), aim: aimOn };
    }
    const atT = !ph.phase && u > STOP_OUT - 8 && u < X_IN + 30 && td > D_IN - 12;     // past a stop line, at / on the cross road
    if (!ph.phase && !atT) return null;
    if (uC < TAPER0 - 400 || uC > u + 5) return null;        // (far back on the highway: law's lanes; level with / past her: its own)
    // (her branch; at the T: the branch whose stop line is nearest her)
    const b = ph.branch != null ? e.branches[ph.branch] : e.branches.reduce((m, x) => (Math.abs(td - x.dOf(x.stop)) < Math.abs(td - m.dOf(m.stop)) ? x : m), e.branches[0]);
    const p = look ? hw.point(look.s, look.d, {}) : car.pos;
    // (a pull-over: it stops 7 m behind her car, on the ramp)
    const bx = pull ? -Math.sin(car.h) * 7.2 : 0, bz = pull ? -Math.cos(car.h) * 7.2 : 0;
    Object.assign(_ca, { e, b, uC: pull ? Math.min(uC, u - 7.2) : uC, tx: p.x + bx, tz: p.z + bz });
    return { gap: Math.max(0, ts - c.s - (pull ? 7.2 : 0)), aim: aimRamp };
});
// …and BUSTED on a ramp / at its T / on the on-ramp: she stops right where she is (law's pull-over used to steer her back
// across the grass to the highway's shoulder, d 7.9) — law's hook "pullOverSpot" (as JFK's roads do)
hook("pullOverSpot", car => {
    if ((ctx.town && ctx.town.active) || !car || !(car.d > 9.5)) return null;
    const e = exitAt(car.s);
    return e ? { h: car.h } : null;
});

on("boot", () => { ensureModels(["exits_gantry"]).catch(() => ensureModels(["town_gantry"]).catch(() => {})); });
