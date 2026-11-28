// features/airport — THE CHASE AT THE AIRPORT: highway cruisers that follow her off the exit drive the airport's own
// roads instead of beelining through the fence and the terminal.
//
// law's cops.js asks every frame, for each of its cruisers (hooks "copRoute" / "copSight" — two small additive hooks):
//   copRoute(c, u, chase) → { gap, aim(la, out) } or null   — the cruiser's way to her (or, while they SEARCH, to where
//                            they last saw her; on a pull-over, to its stop behind her car) along the airport's ROAD NET,
//                            and how far that really is. Null while both are out on the highway's own lanes (law's
//                            normal lane steering) or nowhere near the airport.
//   copSight(ax, az, bx, bz) → false when Terminal 4½ (or the tower) is between them, true across the open landside;
//                            undefined anywhere else (law's own test: the highway's roadside on a bend).
//
// THE NET is a handful of world polylines meeting at 4 junctions (cruisers use any lane, either way — like a town's):
//   hwIn  the highway's right lanes from 2 km back → the decel lane → A (the gore, u RAMP0)
//   hwMid A → along the highway → B (the merge, u ON1)
//   hwOut B → the accel lane → 1.2 km on
//   in    A → the off-ramp → the road in → up the west leg → WA (the lot's aisle)
//   top   WA → the rest of the west leg → the kerb road past the terminal → the east leg → EA
//   aisle WA → the lot's main aisle → EA
//   out   EA → down the east leg → the road out → the on-ramp → B
// A route = from the cruiser's nearest point on the net, the shorter way to either end of its piece, the junctions
// between (Dijkstra on 6 nodes), along her piece to her nearest point, then straight to her (she may be in the lot).
import { ctx } from "../../core/ctx.js";
import * as LY from "./layout.js";

const STEP = 4;          // metres between net points (the highway pieces: every 10 m)

/** A polyline piece of the net: pts [{x, z}], cumulative lengths L, end nodes n0 → n1. */
function piece(id, pts, n0, n1, hw = false) {
    const L = [0];
    for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    return { id, pts, L, len: L[L.length - 1], n0, n1, hw };
}
/** Thin a dense polyline to ~every `step` metres (keeps both ends). */
function thin(pts, step = STEP) {
    const out = [pts[0]];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
        acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
        if (acc >= step || i === pts.length - 1) { out.push({ x: pts[i].x, z: pts[i].z }); acc = 0; }
    }
    return out;
}
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** Build the net for airport geometry G (plan.js). */
export function makeNet(G) {
    const road = ctx.world.highway, E = G.E, F = G.F;
    const hwPts = (u0, u1, dOf, step = 10) => { const out = []; const n = Math.max(2, Math.round(Math.abs(u1 - u0) / step) + 1); for (let k = 0; k < n; k++) { const u = u0 + (u1 - u0) * k / (n - 1); const p = road.point(E + u, dOf(u), {}); out.push({ x: p.x, z: p.z }); } return out; };
    // the highway: the right lane (5.25), easing into the decel lane before the gore / out of the accel lane after the merge
    const laneIn = u => 5.25 + (LY.RAMP_D0 - 5.25) * smooth((u - LY.TAPER0) / (LY.RAMP0 - LY.TAPER0));
    const laneMid = u => 5.25 + (LY.RAMP_D0 - 5.25) * Math.max(1 - smooth((u - LY.RAMP0) / 80), smooth((u - (LY.ON1 - 80)) / 80));
    const laneOut = u => 5.25 + (LY.RAMP_D0 - 5.25) * (1 - smooth((u - LY.ON1) / (LY.ACC1 - LY.ON1)));
    const R = Object.fromEntries(G.roads.map(r => [r.id, r.pts]));
    // the loop, split where the lot's aisle meets each leg
    const loop = R.loop, la = q => F.local(q.x, q.z, {});
    let iW = loop.findIndex(p => { const q = la(p); return q.f < 0 && q.r >= LY.AISLE.r; });
    let iE = loop.length - 1 - [...loop].reverse().findIndex(p => { const q = la(p); return q.f > 0 && q.r >= LY.AISLE.r; });
    if (iW < 1) iW = 1;
    if (iE <= iW) iE = loop.length - 2;
    const offRamp = hwPts(LY.RAMP0, LY.OFF1, LY.offD, 4), onRamp = hwPts(LY.ON0, LY.ON1, LY.onD, 4);
    // nodes: 0 far back · 1 A (the gore) · 2 B (the merge) · 3 far on · 4 WA · 5 EA
    const P = [
        piece("hwIn", hwPts(-2000, LY.RAMP0, laneIn), 0, 1, true),
        piece("hwMid", hwPts(LY.RAMP0, LY.ON1, laneMid), 1, 2, true),
        piece("hwOut", hwPts(LY.ON1, LY.ACC1 + 1200, laneOut), 2, 3, true),
        piece("in", thin([...offRamp, ...R.in, ...loop.slice(0, iW + 1)]), 1, 4),
        piece("top", thin(loop.slice(iW, iE + 1)), 4, 5),
        piece("aisle", thin([F.world(-LY.LEG_F, LY.AISLE.r, {}), F.world(LY.LEG_F, LY.AISLE.r, {})], 6), 4, 5),
        piece("out", thin([...loop.slice(iE), ...R.out, ...onRamp]), 5, 2),
    ];
    return { pieces: P, nodes: 6 };
}

/** The nearest point of the net to (x, z) → { p (piece), v (metres along it), dist, x, z }. */
export function nearestOnNet(net, x, z, out = {}) {
    out.dist = Infinity;
    for (const pc of net.pieces) {
        const P = pc.pts;
        for (let i = 0; i < P.length - 1; i++) {
            const a = P[i], b = P[i + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1e-9;
            const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2));
            const px = a.x + ex * t, pz = a.z + ez * t, d = Math.hypot(px - x, pz - z);
            if (d < out.dist) { out.dist = d; out.p = pc; out.v = pc.L[i] + (pc.L[i + 1] - pc.L[i]) * t; out.x = px; out.z = pz; }
        }
    }
    return out;
}
/** The point v metres along piece pc. */
function pointAt(pc, v, out) {
    const L = pc.L, P = pc.pts;
    v = Math.max(0, Math.min(pc.len, v));
    let lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= v) lo = m; else hi = m; }
    const t = (v - L[lo]) / Math.max(1e-9, L[hi] - L[lo]);
    out.x = P[lo].x + (P[hi].x - P[lo].x) * t; out.z = P[lo].z + (P[hi].z - P[lo].z) * t;
    return out;
}
/** Shortest distances from node `src` (Dijkstra on the net's few nodes) → { dist[], prev[] (piece, from node) }. */
function paths(net, src) {
    const n = net.nodes, dist = new Array(n).fill(Infinity), prev = new Array(n).fill(null), done = new Array(n).fill(false);
    dist[src] = 0;
    for (;;) {
        let k = -1;
        for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (k < 0 || dist[i] < dist[k])) k = i;
        if (k < 0) break;
        done[k] = true;
        for (const pc of net.pieces) {
            const o = pc.n0 === k ? pc.n1 : pc.n1 === k ? pc.n0 : -1;
            if (o < 0 || dist[k] + pc.len >= dist[o]) continue;
            dist[o] = dist[k] + pc.len; prev[o] = { pc, from: k };
        }
    }
    return { dist, prev };
}

/**
 * A route along the net from (fx, fz) to (tx, tz): { gap, aim(la, out), legs } — legs = [{ pc, v0, v1 }] then the last
 * straight bit to the target. Null when the net doesn't help (both on the same piece and the straight line is fine).
 */
export function routeOnNet(net, fx, fz, tx, tz) {
    const a = nearestOnNet(net, fx, fz, {}), b = nearestOnNet(net, tx, tz, {});
    if (!a.p || !b.p) return null;
    const legs = [];
    let len = 0;
    if (a.p === b.p) { legs.push({ pc: a.p, v0: a.v, v1: b.v }); len = Math.abs(b.v - a.v); }
    else {
        // the 2 × 2 ways out of her piece and into his: the shortest through the junctions
        let best = null;
        for (const [na, ca] of [[a.p.n0, a.v], [a.p.n1, a.p.len - a.v]]) {
            const sp = paths(net, na);
            for (const [nb, cb] of [[b.p.n0, b.v], [b.p.n1, b.p.len - b.v]]) {
                const tot = ca + sp.dist[nb] + cb;
                if (!best || tot < best.tot) best = { tot, na, nb, sp };
            }
        }
        if (!best || !Number.isFinite(best.tot)) return null;
        legs.push({ pc: a.p, v0: a.v, v1: best.na === a.p.n0 ? 0 : a.p.len });
        // the junction pieces, from his end back to hers
        const mid = [];
        for (let k = best.nb; k !== best.na;) { const pv = best.sp.prev[k]; if (!pv) break; mid.unshift({ pc: pv.pc, v0: pv.pc.n0 === pv.from ? 0 : pv.pc.len, v1: pv.pc.n0 === pv.from ? pv.pc.len : 0 }); k = pv.from; }
        legs.push(...mid);
        legs.push({ pc: b.p, v0: best.nb === b.p.n0 ? 0 : b.p.len, v1: b.v });
        len = best.tot;
    }
    const tail = Math.hypot(tx - b.x, tz - b.z);
    len += tail;
    return {
        gap: len, legs, from: a, to: b,
        /** The point `la` metres down the route (world coords; from the cruiser's nearest point on the net — a cruiser
         *  a few metres off it steers back on). */
        aim(la, out) {
            let left = la;
            for (const lg of legs) {
                const span = Math.abs(lg.v1 - lg.v0);
                if (span >= left) return pointAt(lg.pc, lg.v0 + Math.sign(lg.v1 - lg.v0) * left, out);
                left -= span;
            }
            if (tail > 0.01) { const k = Math.min(1, left / tail); out.x = b.x + (tx - b.x) * k; out.z = b.z + (tz - b.z) * k; return out; }
            out.x = tx; out.z = tz;
            return out;
        },
    };
}

/** Is (x, z) off the highway's own lanes (on the airport's part of the net, or off the net altogether)? */
function offHighway(n, x, z) { return !n.p || !n.p.hw || n.dist > 6; }

/**
 * The hook law calls: a route for cruiser c (unit u) — or null. S = the airport's state (index.js), chase = law's chase.
 */
export function copRoute(S, c, u, chase) {
    const G = S.G;
    if (!G || !S.net || !ctx.car || (ctx.town && ctx.town.active)) return null;
    const u0 = c.s - G.E;
    if (u0 < LY.TAPER0 - 600 || u0 > LY.ACC1 + 900) return null;
    // where it's going: her car — or where they last saw her (searching), or its stop behind her (a pull-over)
    const car = ctx.car;
    let tx = car.pos.x, tz = car.pos.z;
    if (u.mode === "pull") { tx -= Math.sin(car.h) * 7.2; tz -= Math.cos(car.h) * 7.2; }
    else if (chase && chase.searching && chase.last && !u.bolo) { const p = ctx.world.highway.point(chase.last.s, chase.last.d, {}); tx = p.x; tz = p.z; }
    const net = S.net, nc = nearestOnNet(net, c.x, c.z, S._nc || (S._nc = {}));
    // (her nearest point: once a frame per target)
    const key = ctx.time + ":" + tx.toFixed(1) + ":" + tz.toFixed(1);
    if (S._ntKey !== key) { S._ntKey = key; S._nt = nearestOnNet(net, tx, tz, S._nt || {}); }
    const nt = S._nt;
    if (!offHighway(nc, c.x, c.z) && !offHighway(nt, tx, tz)) return null;     // both on the highway: law's own lanes
    const r = routeOnNet(net, c.x, c.z, tx, tz);
    if (r) S.routes = (S.routes || 0) + 1;
    return r;
}

/**
 * The hook law's pull-over calls (bust.js "pullOverSpot"): off the highway's own lanes — the ramps, the roads in / out, the
 * loop, the kerb road, the lot — she stops right where she is, facing along the road she's on (the net's direction nearest
 * her heading; her own heading off the net, in the lot's stalls) → { h }. Null on the highway's lanes (law's shoulder), on
 * its left side, or nowhere near the airport.
 */
const _ps = {}, _pa = {}, _pb = {};
export function pullOverSpot(S, car) {
    const G = S.G;
    if (!G || !S.net || !car || !car.pos || (ctx.town && ctx.town.active)) return null;
    const u0 = car.s - G.E;
    if (u0 < LY.TAPER0 - 600 || u0 > LY.ACC1 + 900 || !(car.d > 6.5)) return null;
    const n = nearestOnNet(S.net, car.pos.x, car.pos.z, _ps);
    if (!offHighway(n)) return null;
    S.spots = (S.spots || 0) + 1;
    if (!n.p || n.dist > 8) return { h: car.h };
    pointAt(n.p, n.v - 2, _pa); pointAt(n.p, n.v + 2, _pb);
    let h = Math.atan2(_pb.x - _pa.x, _pb.z - _pa.z);
    let dh = h - car.h;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    if (Math.abs(dh) > Math.PI / 2) h += Math.PI;          // (the way she's already facing — cruisers use either way)
    return { h };
}

/**
 * THE KERB EDGE: a cruiser that leans on her / rams her at the kerb can't shove her car up onto the kerb sidewalk (Terminal
 * 4½'s, r WALK.r0 → r1, f TERM ± 22). For KERB_EDGE.hold s after a cop's contact her car's outer edge (its two circles +
 * their radius, toward the terminal) is held at the kerb line (+ `give`: a tyre may touch it), her velocity into the kerb
 * is dropped (a small bounce), and the cruiser pressing on her is held off her car — so it can't drive through her either.
 * Only when she was on the road when the cop touched her (she may still drive up on the sidewalk herself). No geometry.
 */
export const KERB_EDGE = { hold: 2.5, give: 0.25, bounce: 0.2, start: 1.0 };
const CAR_CIRCLES = [1.15, -1.15], CAR_RADIUS = 0.93;      // (car.js — her car's collision circles)
const _k = {};
/** How far (m) her car's outer edge is past the kerb line (≤ 0: on the road; null: not along the terminal's kerb). */
function kerbOver(G, car) {
    const F = G.F, q = F.local(car.pos.x, car.pos.z, _k);
    if (q.f < LY.TERM.f0 - 22 || q.f > LY.TERM.f1 + 22 || q.r < LY.KERB_R - LY.ROAD_W || q.r > LY.WALK.r1 + 2) return null;
    const dr = Math.sin(car.h) * F.rx + Math.cos(car.h) * F.rz;
    return q.r + Math.abs(dr) * CAR_CIRCLES[0] + CAR_RADIUS - (LY.WALK.r0 + KERB_EDGE.give);
}
/** A law car touched her (law's crash event): arm the kerb edge if she's on the road. */
export function copShove(S, car) {
    const G = S.G;
    if (!G || !car) return;
    const over = kerbOver(G, car);
    if (over == null) return;
    if (over <= KERB_EDGE.start || (S.kerb && ctx.time - S.kerb.t < KERB_EDGE.hold)) S.kerb = { t: ctx.time };
    kerbHold(S, car);
}
/** Every frame (after traffic): keep her car off the sidewalk while the kerb edge is armed. → true if it held her. */
export function kerbHold(S, car) {
    const G = S.G, K = S.kerb;
    if (!G || !K || !car || ctx.time - K.t > KERB_EDGE.hold) return false;
    const over = kerbOver(G, car);
    if (over == null || over <= 0) return false;
    const F = G.F;
    car.pos.x -= F.rx * over; car.pos.z -= F.rz * over;
    const vr = car.vx * F.rx + car.vz * F.rz;
    if (vr > 0) { car.vx -= vr * F.rx * (1 + KERB_EDGE.bounce); car.vz -= vr * F.rz * (1 + KERB_EDGE.bounce); }
    S.kerbHolds = (S.kerbHolds || 0) + 1;
    // the cruiser pressing on her: held off her car (it can't push her through the kerb, so it can't drive into her)
    for (const c of ctx.traffic ? ctx.traffic.cars : []) {
        if (!c.data || !c.data.law || !c.spec) continue;      // (a WRECKED cruiser too: a hard ram's wreck slid on into her — sweep-health)
        const dx0 = c.x - car.pos.x, dz0 = c.z - car.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > 49) continue;
        const pfx = Math.sin(car.h), pfz = Math.cos(car.h), cfx = Math.sin(c.h), cfz = Math.cos(c.h);
        let best = null;
        for (const po of CAR_CIRCLES) for (const co of c.spec.circles) {
            const dx = (c.x + cfx * co) - (car.pos.x + pfx * po), dz = (c.z + cfz * co) - (car.pos.z + pfz * po), rr = CAR_RADIUS + c.spec.r, d2 = dx * dx + dz * dz;
            if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); if (!best || rr - d > best.pen) best = { nx: dx / d, nz: dz / d, pen: rr - d }; }
        }
        if (!best) continue;
        c.x += best.nx * best.pen; c.z += best.nz * best.pen;
        if (c.hit) {                                        // (a tumbling wreck: it keeps its slide, minus the part into her car)
            const vin = -(c.vx * best.nx + c.vz * best.nz);
            if (vin > 0) { c.vx += best.nx * vin; c.vz += best.nz * vin; }
            if (c.obj) c.obj.position.set(c.x, 0, c.z);
        } else if (cfx * -best.nx + cfz * -best.nz > 0.5) c.speed = 0;   // (nosing into her: it stops — and eases on again, law's own pace)
        K.t = ctx.time;                                     // (still pressing: the kerb keeps holding)
    }
    return true;
}

/** The hook law calls for line of sight: the terminal (and the tower) block it inside the airport. */
const _a = {}, _b = {};
export function copSight(S, ax, az, bx, bz) {
    const G = S.G;
    if (!G) return undefined;
    const F = G.F;
    F.local(ax, az, _a); F.local(bx, bz, _b);
    const inA = inZone(_a) || onRamps(G, ax, az), inB = inZone(_b) || onRamps(G, bx, bz);
    if (!inA && !inB) return undefined;
    // across the terminal's box (or the tower's)? blocked
    for (const box of BLOCKERS) if (segBox(_a.f, _a.r, _b.f, _b.r, box)) return false;
    return true;
}
// (the airport's ground: the landside (its rigid frame) + the interchange — the decel lane, the ramps, the roads in / out,
//  in highway coords: the road bends there, the rigid frame doesn't — open grass and a chain-link fence: they see across it)
const inZone = q => q.f > LY.LAND.f0 - 40 && q.f < LY.LAND.f1 + 40 && q.r > LY.LAND.r0 - 40 && q.r < LY.LAND.r1 + 60;
const _n = {}, _a2 = {};
function onRamps(G, x, z) {
    // (the road's nearest-point search looks ±120 m round a hint: the rigid frame's f is a good enough first guess)
    const f = G.F.local(x, z, _a2).f, n = ctx.world.highway.nearest(x, z, G.E + LY.UA + f, _n), u = n.s - G.E;
    return u > LY.TAPER0 - 20 && u < LY.ACC1 + 20 && n.d > 6.8;
}
const BLOCKERS = [{ f0: LY.TERM.f0, f1: LY.TERM.f1, r0: LY.TERM.r0, r1: LY.TERM.r1 }, { f0: 132, f1: 144, r0: 262, r1: 274 }];
/** Does segment (f0, r0) → (f1, r1) cross the box? (slab test) */
function segBox(fa, ra, fb, rb, B) {
    let t0 = 0, t1 = 1;
    for (const [p, d, lo, hi] of [[fa, fb - fa, B.f0, B.f1], [ra, rb - ra, B.r0, B.r1]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
        let a = (lo - p) / d, b = (hi - p) / d;
        if (a > b) { const t = a; a = b; b = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, b);
        if (t0 > t1) return false;
    }
    return true;
}
