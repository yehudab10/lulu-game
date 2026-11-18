// features/town — what the town tells features/law (through ctx.town; law calls these
// only while ctx.town.active):
//   blocksSight(ax, az, bx, bz)  the town's buildings break a cruiser's line of sight
//   copRoute(c, u)               { gap, aim(la, out) }: a cruiser chasing her round the
//                                grid (shortest path through the crossings, not "straight
//                                down the road"), and how far behind her it really is
//   copSpawn(how, fromAhead)     { s, d, dir }: where a new cruiser joins (on the street grid,
//                                out of her sight unless it's the first one — or the town's
//                                own patrol car that just saw her do it)
//   hideSpot(T, x, z)            could a car stopped at (x, z) be tucked away? { ok, spot, why } —
//                                at the kerb among parked cars, off the street surface (sidewalk, a
//                                driveway apron, a front yard), Ocean Pkwy's tree mall; NOT a travel
//                                lane, a crossing, or an empty stretch of kerb (law adds line of sight)
//   searchPoint(last) / prowlPoint(at, c)  where SEARCHING cruisers drive: on to where she was
//                                heading when they lost her, then crossing to crossing around it
//                                (they don't know where she is — copRoute(c, to) takes them there)
import { ctx } from "../../core/ctx.js";
import { PL, LANE, toLocal, streetOfS, streetPoint, streetCoords, nodesAround, nodeAlong, pathNodes, segmentBlocked, blocked, sharedStreet } from "./plan.js";

const _a = {}, _b = {}, _c = {}, _p = {};

export function blocksSight(ax, az, bx, bz) {
    toLocal(ax, az, _a); toLocal(bx, bz, _b);
    return segmentBlocked(_a.x, _a.z, _b.x, _b.z);
}

/** The local polyline from (from) to Lulu along the streets, and its length. */
function routeTo(fx, fz, fst, tx, tz, tst) {
    const pts = [];
    if (fst === tst) { pts.push({ x: tx, z: tz }); return { pts, len: Math.hypot(tx - fx, tz - fz) }; }
    streetCoords(fst, fx, fz, _c); const fa = _c.along;
    streetCoords(tst, tx, tz, _c); const ta = _c.along;
    let best = null;
    for (const a of nodesAround(fst, fa)) for (const b of nodesAround(tst, ta)) {
        const path = a === b ? [a] : pathNodes(a, b);
        if (!path) continue;
        let len = Math.abs(nodeAlong(fst, a) - fa) + Math.abs(nodeAlong(tst, b) - ta);
        for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
        if (!best || len < best.len) best = { path, len };
    }
    if (!best) { pts.push({ x: tx, z: tz }); return { pts, len: Math.hypot(tx - fx, tz - fz) }; }
    for (let i = 0; i < best.path.length; i++) {
        const n = best.path[i], nx = best.path[i + 1];
        // a jammed stretch: the cruiser takes the oncoming lane through it
        let ox = 0, oz = 0;
        if (nx) {
            const st = sharedStreet(n, nx), dir = nodeAlong(st, nx) > nodeAlong(st, n) ? 1 : -1;
            if (blocked(st.id, dir, n) && !st.oneway) { const q = streetPoint(st, 0, -dir * (LANE + 0.5), _p), z = streetPoint(st, 0, 0, {}); ox = q.x - z.x; oz = q.z - z.z; }
        }
        pts.push({ x: n.x + ox, z: n.z + oz });
    }
    pts.push({ x: tx, z: tz });
    return { pts, len: best.len };
}

/** The cruiser's route round the grid to her — or, given `to` ({x, z, s} world), to that point instead
 *  (a SEARCHING cruiser doesn't know where she is: law passes searchPoint / prowlPoint). */
export function copRoute(c, to = null) {
    const car = ctx.car;
    const fst = streetOfS(c.s), tst = streetOfS(to ? to.s : car.s);
    if (!fst || !tst) return null;
    toLocal(c.x, c.z, _a);
    if (to) toLocal(to.x, to.z, _b); else toLocal(car.pos.x, car.pos.z, _b);
    const r = routeTo(_a.x, _a.z, fst, _b.x, _b.z, tst);
    const ax = _a.x, az = _a.z;
    return {
        gap: r.len,
        /** The point `la` metres down the route (world coords). */
        aim(la, out) {
            let px = ax, pz = az, left = la;
            for (const q of r.pts) {
                const sl = Math.hypot(q.x - px, q.z - pz);
                if (sl >= left) { const t = left / (sl || 1); out.x = PL.ORIGIN.x + px + (q.x - px) * t; out.z = PL.ORIGIN.z + pz + (q.z - pz) * t; return out; }
                left -= sl; px = q.x; pz = q.z;
            }
            out.x = PL.ORIGIN.x + px; out.z = PL.ORIGIN.z + pz;
            return out;
        },
    };
}

/** Where a new cruiser joins the chase. how: "first" | "seen" | "search". */
export function copSpawn(how, takePatrol) {
    const car = ctx.car;
    // the town's own patrol car saw it happen: it IS the first cruiser
    const pat = takePatrol && takePatrol();
    if (pat) return pat;
    toLocal(car.pos.x, car.pos.z, _b);
    const want = how === "first" ? [35, 70] : how === "search" ? [120, 200] : [70, 130];
    let best = null, bs = -1e9;
    for (const st of PL.STREETS) {
        for (let a = st.a0 + 8; a < st.a1 - 8; a += 9) {
            if (st.cross.some(cc => Math.abs(cc.a - a) < 10)) continue;
            const p = streetPoint(st, a, 0, _p);
            const dist = Math.abs(p.x - _b.x) + Math.abs(p.z - _b.z);
            if (dist < want[0] || dist > want[1]) continue;
            const hidden = segmentBlocked(p.x, p.z, _b.x, _b.z);
            const score = (how === "first" ? 0 : hidden ? 40 : 0) - Math.abs(dist - (want[0] + want[1]) / 2) * 0.3 + Math.random() * 12;
            if (score > bs) {
                bs = score;
                // face toward her along this street
                streetCoords(st, _b.x, _b.z, _c);
                const dir = _c.along > a ? 1 : -1;
                best = { s: st.base + a, d: dir * LANE, dir };
            }
        }
    }
    return best;
}

// ── hiding (what ctx.law.hiding asks in a town) ─────────────────────────
const _h = {}, _k = {};
const NOPE_LANE = { ok: false, why: "lane", spot: "lane" }, NOPE_JUNCTION = { ok: false, why: "lane", spot: "junction" };
/**
 * Could a car stopped at (x, z) (world) be tucked away here? The street surface is no hiding place —
 * a travel lane, a service road's lane or a crossing's box: `{ ok: false, why: "lane" }`. What is:
 *   "kerb"  in a parking lane at the kerb, a parked car within 13 m on that side (one of the row). An
 *           EMPTY stretch of kerb (alternate-side parking, the wedding hall's no-parking) is
 *           `{ ok: false, why: "empty" }`: a lone car at an empty kerb is the first thing they look at
 *   "mall"  Ocean Pkwy's tree mall (between the main road and the service road)
 *   "walk" / "yard"  off the street surface: up on the sidewalk, a driveway apron, a front yard, off the grid
 * T is the built town (T.parked: the parked cars, local coords). Law adds the line of sight on top.
 */
export function hideSpot(T, x, z) {
    toLocal(x, z, _h);
    let st = null, bd = 1e9, ca = 0, cd = 0;
    for (const s of PL.STREETS) {
        streetCoords(s, _h.x, _h.z, _k);
        if (_k.along < s.a0 - 4 || _k.along > s.a1 + 4) continue;
        if (Math.abs(_k.d) < bd) { bd = Math.abs(_k.d); st = s; ca = _k.along; cd = _k.d; }
    }
    if (!st) return { ok: true, spot: "yard" };                       // off the grid altogether (past a street's end)
    // in a crossing's box (on the asphalt of both streets): that's the junction, not a parking spot
    for (const n of PL.NODES) {
        if (Math.abs(n.x - _h.x) > 30 || Math.abs(n.z - _h.z) > 30) continue;
        const A = PL.STREETS[n.ns], B = PL.STREETS[n.ew];
        const dA = Math.abs(streetCoords(A, _h.x, _h.z, _k).d), dB = Math.abs(streetCoords(B, _h.x, _h.z, _k).d);
        if (dA < A.outer + 0.3 && dB < B.outer + 0.3) return NOPE_JUNCTION;
    }
    const ad = Math.abs(cd), side = cd >= 0 ? 1 : -1, edge = 3.5 * st.lanes;
    if (ad < edge + 0.35) return NOPE_LANE;                           // a travel lane
    let lane = 0;
    if (st.boulevard) {
        if (ad < st.mallOut) return { ok: true, spot: "mall" };      // the tree mall
        if (ad < st.svcPark - 0.75) return NOPE_LANE;                // the service road's travel lane
        if (ad <= st.outer + 0.3) lane = st.svcPark;
    } else if (ad <= st.curb + 0.3) {
        if (!st.parkLane) return NOPE_LANE;
        lane = st.park;
    }
    if (!lane) return { ok: true, spot: ad < st.walk ? "walk" : "yard" };   // off the street surface
    // at the kerb: one of the row only if there are parked cars around her
    const want = side * lane;
    for (const p of T.parked) {
        streetCoords(st, p.x, p.z, _k);
        if (Math.abs(_k.d - want) < 1.8 && Math.abs(_k.along - ca) < 13) return { ok: true, spot: "kerb" };
    }
    const O = PL.ORIGIN;
    for (const c of ctx.traffic.cars) {                               // a stopped car in the lane (a double-parked van…)
        if (c.speed > 0.5 || (c.data && c.data.law)) continue;
        streetCoords(st, c.x - O.x, c.z - O.z, _k);
        if (Math.abs(_k.d - want) < 2.2 && Math.abs(_k.along - ca) < 13 && Math.abs(_k.along - ca) > 1) return { ok: true, spot: "kerb" };
    }
    return { ok: false, why: "empty", spot: "kerb" };
}

/** Where they think she went: `last` (the last sighting {s, h, v, t}) carried on down that street (≤ 20 s of it),
 *  stopping short of its end. → {x, z, s} world, or null. */
export function searchPoint(last, out = {}) {
    const st = last && streetOfS(last.s);
    if (!st) return null;
    const dir = Number.isFinite(last.h) && Math.sin(last.h) * st.ux + Math.cos(last.h) * st.uz < 0 ? -1 : 1;
    const run = Math.max(0, last.v || 0) * Math.min(20, Math.max(0, ctx.time - last.t));
    const along = Math.max(st.a0 + 6, Math.min(st.a1 - 6, last.s - st.base + dir * run));
    const p = streetPoint(st, along, dir * LANE, _p);
    out.x = PL.ORIGIN.x + p.x; out.z = PL.ORIGIN.z + p.z; out.s = st.base + along;
    return out;
}

/** The next crossing a prowling cruiser `c` checks, looking around `at` ({x, z} world): a random crossing
 *  within ~170 m of it, not the one the cruiser is at. → {x, z, s} world. */
export function prowlPoint(at, c) {
    toLocal(at.x, at.z, _h); toLocal(c.x, c.z, _k);
    const near = PL.NODES.filter(n => Math.hypot(n.x - _h.x, n.z - _h.z) < 170 && Math.hypot(n.x - _k.x, n.z - _k.z) > 25);
    const n = near.length ? near[Math.floor(Math.random() * near.length)] : PL.NODES[Math.floor(Math.random() * PL.NODES.length)];
    const st = PL.STREETS[n.ns];
    return { x: PL.ORIGIN.x + n.x, z: PL.ORIGIN.z + n.z, s: st.base + nodeAlong(st, n) };
}
