// features/town — what the town tells features/law (through ctx.town; law calls these
// only while ctx.town.active):
//   blocksSight(ax, az, bx, bz)  the town's buildings break a cruiser's line of sight
//   copRoute(c, u)               { gap, aim(la, out) }: a cruiser chasing her round the
//                                grid (shortest path through the crossings, not "straight
//                                down the road"), and how far behind her it really is
//   copSpawn(how, fromAhead)     { s, d, dir }: where a new cruiser joins (on the street grid,
//                                out of her sight unless it's the first one — or the town's
//                                own patrol car that just saw her do it)
import { ctx } from "../../core/ctx.js";
import { PL, LANE, toLocal, streetOfS, streetPoint, streetCoords, nodesAround, nodeAlong, pathNodes, segmentBlocked, blocked } from "./plan.js";

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
        for (let i = 1; i < path.length; i++) len += Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].z - path[i - 1].z);
        if (!best || len < best.len) best = { path, len };
    }
    if (!best) { pts.push({ x: tx, z: tz }); return { pts, len: Math.hypot(tx - fx, tz - fz) }; }
    for (let i = 0; i < best.path.length; i++) {
        const n = best.path[i], nx = best.path[i + 1];
        // a jammed stretch: the cruiser takes the oncoming lane through it
        let ox = 0, oz = 0;
        if (nx) {
            const st = n.x === nx.x ? PL.STREETS[n.ns] : PL.STREETS[n.ew], dir = nodeAlong(st, nx) > nodeAlong(st, n) ? 1 : -1;
            if (blocked(st.id, dir, n)) { const q = streetPoint(st, 0, -dir * (LANE + 0.5), _p), z = streetPoint(st, 0, 0, {}); ox = q.x - z.x; oz = q.z - z.z; }
        }
        pts.push({ x: n.x + ox, z: n.z + oz });
    }
    pts.push({ x: tx, z: tz });
    return { pts, len: best.len };
}

export function copRoute(c) {
    const car = ctx.car;
    const fst = streetOfS(c.s), tst = streetOfS(car.s);
    if (!fst || !tst) return null;
    toLocal(c.x, c.z, _a); toLocal(car.pos.x, car.pos.z, _b);
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
