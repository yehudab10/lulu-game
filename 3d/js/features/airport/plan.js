// features/airport — WHERE the airport goes, and its geometry in world space.
//
// The placement is a pure function of fixed data — the highway (the same road for everyone: world seed), the world's
// constant pull-in places, the interchanges / rest areas already planned — so every friend in a 🎉 party gets the
// airport on the same metre. From AIR.first it slides on in 50 m steps until:
//   • FIT: the highway keeps out of the airport's box (BOX, its own frame — terminal, fence, apron, runway, the planes'
//     low passes) from 3 km back to 3.6 km on, and every point of the landside / airside finds its nearest highway point
//     with the road's own local search (no "two nearest bends" far out — car.s / foot's s stay smooth in there);
//   • it is clear of the world's pull-in places, the towns' interchanges (their signs → ramps + their attached towns:
//     1.5 km either side) and the rest areas.
// Then plan() reserves the roadside (no trees / houses / poles on the ramps or in the airport; a thin strip either side
// that the town's + rest areas' solo planners see as busy) and adds the highway signs.
//
// The geometry (world space, built once per plan): the roads as polylines {x, z, tx, tz, w, v} (the in-road Bézier from
// the off-ramp's end to the west leg, the loop, the out-road Bézier to the on-ramp, the lot's aisle), a hash grid for
// "is this point on a road?", the colliders (with the highway s they belong to: highway chunks carry them), the vehicle
// loop, the fence segments.
import { ctx } from "../../core/ctx.js";
import * as LY from "./layout.js";

export const AIR = { first: 5900, every: 30000, step: 50, tries: 400, townGap: 1500, slotSlide: 1000, slotGap: 300 };

/**
 * THE SWITCH-ON HOOK (for after ci/exits2 — see 3d/docs/airport-plan.md › Sync log): the towns' per-town ROUTE can give
 * the airport a slot of its own — `ctx.town.routeSlot("airport", from)` → the slot's metre at or past `from` (fixed
 * data: the same on every run and every friend's screen), or null. With a slot the airport plans there (FIT may slide it
 * ≤ AIR.slotSlide) and keeps only AIR.slotGap from the towns' exits (the route already spaced them); without one it
 * searches from AIR.first as before.
 */
export function routeSlot(from) {
    try { const f = ctx.town && ctx.town.routeSlot; const s = typeof f === "function" ? f("airport", from) : null; return Number.isFinite(s) ? s : null; } catch (e) { return null; }
}
/** Does the towns' route give the airport slots (a 🎉 party can then have it: every friend plans the same metres)? */
export const routed = () => !!(ctx.town && typeof ctx.town.routeSlot === "function");

const _p = {}, _q = {};
const hw = () => ctx.world.highway;
const clamp01 = t => Math.max(0, Math.min(1, t));
const smooth = t => { t = clamp01(t); return t * t * (3 - 2 * t); };
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** The airport's frame at exit E: origin = the highway's centre line at E + UA, f along its heading, r to its right. */
export function frameAt(E) {
    const o = hw().point(E + LY.UA, 0, {});
    const h = o.h, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h), ox = o.x, oz = o.z;
    return {
        ox, oz, h, fx, fz, rx, rz,
        world(f, r, out = {}) { out.x = ox + f * fx + r * rx; out.z = oz + f * fz + r * rz; return out; },
        local(x, z, out = {}) { const dx = x - ox, dz = z - oz; out.f = dx * fx + dz * fz; out.r = dx * rx + dz * rz; return out; },
        dir(df, dr, out = {}) { out.x = df * fx + dr * rx; out.z = df * fz + dr * rz; return out; },
        /** A world yaw (three.js rotation.y) for a model whose front faces A-frame direction (df, dr). */
        yaw(df, dr) { return Math.atan2(df * fx + dr * rx, df * fz + dr * rz); },
    };
}
const inBox = (b, f, r, pad = 0) => f > b.f0 - pad && f < b.f1 + pad && r > b.r0 - pad && r < b.r1 + pad;

/** Would an airport with its exit at E stand clear of the highway (and keep the road's nearest-point search sane)? */
export function fits(E) {
    const road = hw(), F = frameAt(E), q = {};
    for (let t = Math.max(0, E - 3000); t < E + 3600; t += 10) {
        road.at(t, _p); F.local(_p.x, _p.z, q);
        if (inBox(LY.BOX, q.f, q.r)) return false;
    }
    // every point in there finds its nearest highway point with the road's own local search (± 120 m round a hint)
    const lo = Math.max(0, E - 3000), hi = E + 3600;
    const pts = [];
    for (let f = LY.LAND.f0; f <= LY.LAND.f1 + 1; f += 50) for (let r = LY.LAND.r0; r <= LY.RUNWAY.r1 + 1; r += 40) pts.push([f, r]);
    for (const [f, r] of pts) {
        F.world(f, r, _q);
        const n = road.nearest(_q.x, _q.z, E + LY.UA + f, {});
        let best = 1e18;
        for (let t = lo; t < hi; t += 4) { road.at(t, _p); const dx = _q.x - _p.x, dz = _q.z - _p.z, d2 = dx * dx + dz * dz; if (d2 < best) best = d2; }
        if (Math.abs(Math.abs(n.d) - Math.sqrt(best)) > 3) return false;
    }
    return true;
}

/** The journey's fixed roadside (every mode builds it): the family stops' properties and the coast's ocean on the right
 *  (stop 1 → stop 2) — [a, b] stretches the airport keeps out of (Cruise's layout: mult 1). */
function journeyBusy() {
    const J = ctx.journey, out = [];
    if (!J || !J.stopS) return out;
    try {
        const st = i => J.stopS(i);
        for (let i = 0; i < 5; i++) { const s = st(i); if (s != null) out.push([s - 1100, s + 600]); }
        const c0 = st(1), c1 = st(2);
        if (c0 != null && c1 != null) out.push([c0 - 400, c1 + 1100]);
    } catch (e) { /* none */ }
    return out;
}
/** Is E clear of the other things beside the highway (places, the journey's stops + coast, the towns' interchanges +
 *  their towns, rest areas)? */
export function clearOf(E, gap = AIR.townGap) {
    const a = E + LY.SPAN.a, b = E + LY.SPAN.b;
    // (the airport itself reaches ±640 m round E + UA; its roadside reserve + a town gap beyond the accel lane)
    // (the ramps + the airport's own footprint: its advance signs may pass a family's gate or a pull-in like any sign)
    const a2 = E - 600, b2 = Math.max(E + LY.ACC1 + 120, E + LY.UA + 700);
    if (journeyBusy().some(([x, y]) => y > a2 && x < b2)) return false;
    const P = ctx.places;
    try { if (P && P.list && P.at) for (const p of P.list()) { if (/^exits_/.test(p.id)) continue; for (const x of P.at(p.id) || []) if (x > a2 && x < b2) return false; } } catch (e) { /* none */ }
    const T = ctx.town;
    if (T && T.exits) { const sp = T.span || { a: -1500, b: 480 }; for (const e of T.exits) if (e.s + sp.b + gap > a && e.s + sp.a - gap < b) return false; }
    try { if (ctx.exits && ctx.exits.spans) for (const o of ctx.exits.spans()) if (o.b > a && o.a < b) return false; } catch (e) { /* none */ }
    return true;
}

const FOUND = new Map();
/** The first exit metre ≥ s0 an airport fits (slid on in AIR.step steps), or null. Fixed data → FIT cached. */
export function findSpot(s0, { force = false } = {}) {
    if (force) return s0;
    const it = searchSteps(s0);
    for (;;) { const r = it.next(Infinity); if (r.done) return r.value; }
}
/** findSpot as a generator: yields after each candidate FIT measured (a few ms); returns E or null. */
export function* searchSteps(s0) {
    const slot = routeSlot(s0);
    if (slot != null) s0 = slot;
    s0 = Math.ceil(s0 / AIR.step) * AIR.step;          // (on the 50 m lattice: the same candidates whatever the run's start)
    const tries = slot != null ? Math.round(AIR.slotSlide / AIR.step) : AIR.tries, gap = slot != null ? AIR.slotGap : AIR.townGap;
    for (let k = 0; k < tries; k++) {
        const E = s0 + k * AIR.step;
        if (!clearOf(E, gap)) continue;
        let ok = FOUND.get(E);
        if (ok === undefined) { ok = fits(E); FOUND.set(E, ok); yield E; }
        if (ok) return E;
    }
    return null;
}

// ── geometry ─────────────────────────────────────────────────────────────
/** A world polyline [{x, z}] → resampled every `step` m with tangents + arc length. w(k01) = half width. */
function polyline(raw, w, step = 2) {
    const len = [0];
    for (let i = 1; i < raw.length; i++) len.push(len[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
    const L = len[len.length - 1], n = Math.max(2, Math.round(L / step) + 1), out = [];
    let j = 0;
    for (let k = 0; k < n; k++) {
        const v = L * k / (n - 1);
        while (j < raw.length - 2 && len[j + 1] < v) j++;
        const t = (v - len[j]) / Math.max(1e-6, len[j + 1] - len[j]);
        out.push({ x: raw[j].x + (raw[j + 1].x - raw[j].x) * t, z: raw[j].z + (raw[j + 1].z - raw[j].z) * t, v, w: typeof w === "function" ? w(v / L) : w });
    }
    for (let k = 0; k < n; k++) {
        const a = out[Math.max(0, k - 1)], b = out[Math.min(n - 1, k + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
        out[k].tx = (b.x - a.x) / l; out[k].tz = (b.z - a.z) / l;
    }
    out.len = L;
    return out;
}
/** A cubic Bézier between two world poses (p, dir) — tangent lengths k × the gap. */
function bezier(p0, d0, p3, d3, k = 0.42, n = 160) {
    const L = Math.hypot(p3.x - p0.x, p3.z - p0.z) * k;
    const p1 = { x: p0.x + d0.x * L, z: p0.z + d0.z * L }, p2 = { x: p3.x - d3.x * L, z: p3.z - d3.z * L }, out = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
        out.push({ x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, z: a * p0.z + b * p1.z + c * p2.z + d * p3.z });
    }
    return out;
}
const norm = v => { const l = Math.hypot(v.x, v.z) || 1; return { x: v.x / l, z: v.z / l }; };
/** World point + unit tangent of the highway-coords curve d(u) at u (numeric). */
function hwPose(E, u, dOf) {
    const road = hw(), a = road.point(E + u - 0.5, dOf(u - 0.5), {}), b = road.point(E + u + 0.5, dOf(u + 0.5), {}), p = road.point(E + u, dOf(u), {});
    return { x: p.x, z: p.z, d: norm({ x: b.x - a.x, z: b.z - a.z }) };
}

/** A hash grid of road segments: onRoad(x, z, pad) → the road's id or null. */
function segGrid(roads, cell = 12) {
    const G = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
    for (const rd of roads) {
        const P = rd.pts;
        for (let i = 0; i < P.length - 1; i++) {
            const a = P[i], b = P[i + 1], w = Math.max(a.w, b.w) + 1;
            const i0 = Math.floor((Math.min(a.x, b.x) - w) / cell), i1 = Math.floor((Math.max(a.x, b.x) + w) / cell);
            const j0 = Math.floor((Math.min(a.z, b.z) - w) / cell), j1 = Math.floor((Math.max(a.z, b.z) + w) / cell);
            for (let I = i0; I <= i1; I++) for (let J = j0; J <= j1; J++) { const k = key(I, J); let l = G.get(k); if (!l) G.set(k, l = []); l.push([a, b, rd]); }
        }
    }
    return {
        at(x, z, pad = 0.3) {
            const l = G.get(key(Math.floor(x / cell), Math.floor(z / cell)));
            if (!l) return null;
            for (const [a, b, rd] of l) {
                const ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
                const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2));
                const px = a.x + ex * t - x, pz = a.z + ez * t - z, w = a.w + (b.w - a.w) * t;
                if (px * px + pz * pz <= (w + pad) * (w + pad)) return rd;
            }
            return null;
        },
    };
}

/** Everything the airport at exit E is, in world space. */
export function geometry(E) {
    const F = frameAt(E), road = hw();
    const W = (f, r) => F.world(f, r, {});
    // the in-road: off-ramp's end (u OFF1) → the west leg's foot; the out-road: the east leg's foot → the on-ramp's start
    const j1 = hwPose(E, LY.OFF1, LY.offD), k1 = W(-LY.LEG_F, LY.LEG_R0), k1d = F.dir(0, 1);
    const k2 = W(LY.LEG_F, LY.LEG_R0), k2d = F.dir(0, -1), j2 = hwPose(E, LY.ON0, LY.onD);
    const roads = [
        { id: "in", tex: "ramp", pts: polyline(bezier(j1, j1.d, k1, k1d), t => LY.HALF + (LY.ROAD_W - LY.HALF) * smooth(t * 1.3)) },
        { id: "loop", tex: "kerb", pts: polyline(LY.samplePieces(LY.LOOP).map(([f, r]) => W(f, r)), LY.ROAD_W) },
        { id: "out", tex: "ramp", pts: polyline(bezier(k2, k2d, j2, j2.d), t => LY.HALF + (LY.ROAD_W - LY.HALF) * smooth((1 - t) * 1.3)) },
        { id: "aisle", tex: "aisle", pts: polyline([W(LY.AISLE.f1, LY.AISLE.r), W(LY.AISLE.f0, LY.AISLE.r)], LY.AISLE.w) },
    ];
    const grid = segGrid(roads);
    // the vehicles' loop (world), with its kerb stops as distances along it
    const vl = polyline(LY.samplePieces(LY.VLOOP, 1.5).map(([f, r]) => W(f, r)), 0, 1.5);
    const vAt = f0 => { const t = W(f0, LY.KERB_LANE); let best = 0, bd = 1e18; for (const p of vl) { const d = (p.x - t.x) ** 2 + (p.z - t.z) ** 2; if (d < bd) { bd = d; best = p.v; } } return best; };
    const vloop = { pts: vl, len: vl.len, stops: { shuttle: vAt(LY.STOPS.shuttle), taxiHead: vAt(LY.STOPS.taxiHead) } };
    // the fences (world segments; the runway ones are the joke's)
    const fences = LY.FENCES.map(fc => ({ runway: !!fc.runway, pts: fc.pts.map(([f, r]) => W(f, r)), A: fc.pts }));
    // the colliders, each tagged with the highway s it belongs to (its chunk carries it)
    const col = [];
    const sOf = (x, z, hint) => road.nearest(x, z, hint, _q).s;
    const add = (x, z, r, kind, hint, low = true) => { const c = { x, z, r, kind, s: sOf(x, z, hint) }; if (!low) c.notLow = true; col.push(c); };
    const addA = (f, r, rad, kind, low = true) => { const p = W(f, r); add(p.x, p.z, rad, kind, E + LY.UA + f, low); };
    for (const [f, r, rad, kind] of LY.colliderList()) addA(f, r, rad, kind);
    for (const fc of LY.FENCES) for (let i = 0; i < fc.pts.length - 1; i++) {
        const [f0, r0] = fc.pts[i], [f1, r1] = fc.pts[i + 1], L = Math.hypot(f1 - f0, r1 - r0), n = Math.max(1, Math.ceil(L / 1.4));
        for (let k = i ? 1 : 0; k <= n; k++) addA(f0 + (f1 - f0) * k / n, r0 + (r1 - r0) * k / n, 0.75, "fence");
    }
    for (const p of LY.propList()) if (p.col) addA(p.f, p.r, p.col, p.key === "treeRound" ? "tree" : "pole", p.low !== false);
    addA(-LY.LOT.f1 + 4, LY.AISLE.r + 6.4, 1.3, "prop");                                     // the booth
    for (const b of LY.BOARD_POSTS) if (!b.onFence) addA(b.f, b.r, b.big ? 0.5 : 0.25, "sign");
    // the planters along the kerb (mirrored from the model: its +X is our −f) — low: she can hop on them
    for (let k = 0; k < 8; k++) { let x = -95 + 17 + k * 156 / 7; if (Math.min(...LY.DOORS.map(d => Math.abs(x + d))) < 6) x += 7; addA(-x, LY.TERM.r0 - 3.6, 1.0, "bench"); }
    // the parked cars (seeded: the same lot for everyone), two circles each
    const rnd = mulberry(20261120), cars = [];
    const PAINTS = ["#E53935", "#42A5F5", "#FFFFFF", "#FFCA28", "#9E9E9E", "#263238", "#8D6E63", "#66BB6A", "#BA68C8", "#B0BEC5", "#C0C6CC", "#1E3A5F"];
    for (const row of LY.STALLS) for (let f = row.f0 + LY.STALL_W / 2; f < row.f1; f += LY.STALL_W) {
        if (rnd() > 0.26) continue;
        const key = rnd() < 0.55 ? "town_minivan_lod" : "town_mw_sedan_lod";
        // (every other parked car stays home on the LOW graphics tier — its two circles switch off with it)
        const low = cars.length % 2 === 0;
        cars.push({ f, r: row.r, face: row.face, key, color: PAINTS[Math.floor(rnd() * PAINTS.length)], low });
        addA(f, row.r - 1.2, 1.15, "car", low); addA(f, row.r + 1.2, 1.15, "car", low);
    }
    // the guardrails along both roads to the highway (outside the landside): posts every 3 m
    const rails = [];
    const railOf = (pts, hint) => { if (pts.length < 3) return; rails.push(pts); for (let i = 0; i < pts.length; i += 2) add(pts[i].x, pts[i].z, 0.35, "rail", hint); };
    // the off-ramp's outside (from just past the gore) and the on-ramp's outside, in highway coords
    { const pts = []; for (let u = -36; u <= LY.OFF1; u += 2) pts.push(road.point(E + u, LY.offD(u) + LY.HALF + 0.9, {})); railOf(pts, E); }
    { const pts = []; for (let u = LY.ON0; u <= LY.ON1 - 20; u += 2) pts.push(road.point(E + u, LY.onD(u) + LY.HALF + 0.9, {})); railOf(pts, E + LY.ON0); }
    // both sides of the two roads, out to the landside fence (right of travel = (−tz, tx))
    for (const [rd, hint] of [[roads[0], E + LY.UA - LY.LEG_F], [roads[2], E + LY.UA + LY.LEG_F]]) for (const side of [-1, 1]) {
        const pts = [];
        for (const p of rd.pts) {
            const o = p.w + 0.9, x = p.x - p.tz * side * o, z = p.z + p.tx * side * o;
            if (F.local(x, z, _p).r > LY.LAND.r0 - 1) continue;
            pts.push({ x, z });
        }
        railOf(pts, hint);
    }
    // the bucket of each collider's chunk
    const byChunk = new Map();
    for (const c of col) { const k = Math.floor(c.s / 200); let l = byChunk.get(k); if (!l) byChunk.set(k, l = []); l.push(c); }
    const kerbS = sOf(F.world(0, LY.KERB_R).x, F.world(0, LY.KERB_R).z, E + LY.UA);
    return { E, F, roads, grid, vloop, fences, col, byChunk, cars, rails, kerbS, kerbChunk: Math.floor(kerbS / 200) };
}

/** Is world (x, z) in the fenced landside? */
export const inLand = (G, x, z, pad = 0) => { const q = G.F.local(x, z, _p); return q.f > LY.LAND.f0 - pad && q.f < LY.LAND.f1 + pad && q.r > LY.LAND.r0 - pad && q.r < LY.LAND.r1 + pad; };
