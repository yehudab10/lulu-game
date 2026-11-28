// features/dealers/route.js — ⚡ FULL SCHLEP DRIVING TO THE 📍 PING (stage 2b): with a place pinged (features/pins), the
// self-driving Tushla doesn't just hold a lane — it TAKES THE PLACE'S EXIT, follows the town's streets and pulls up by
// the door ("📍 You have arrived. Probably.").
//
//   • ONE WORLD-SPACE PATH, ONE FOLLOWER. The way there is a polyline of points ({ x, z, v (the most it may do there),
//     stop?, node? }) and a pure-pursuit follower (steer at a point ahead along it, the speed the next points allow).
//   • THE EXIT (highway coords, town/exit.js's own layout): the right lane from ~700 m out, the taper, the decel lane, the
//     ramp's branch to its town (b.dOf), a full STOP at the T, a right turn onto the cross road and on toward town. An
//     attached town takes over as she rolls up its approach (town/index.js attachedAt) — the follower doesn't care which
//     road is under her, the points are world points.
//   • THE TOWN (town/plan.js's graph): a Dijkstra over (crossing, the way she came in) — never a U-turn, never the wrong
//     way down a one-way (plan.js blocked) — to the crossing behind the door, then up the block with the door on her
//     RIGHT. Turns are the town drivers' own bezier through the lane lines (cars.js), the circle is driven round. A full
//     stop at every stop sign (life.js judges it — never a "ran the stop"), then on when the crossing is clear.
//   • THE RULES: ≤ 24 mph in town (Ocean Pkwy's camera fires above 35, its limit is 25), ≤ 14 mph in a school zone in
//     school hours (cameras: the beacon's on), 4.5 m/s down a speed-bump street; it stops for anything in its path —
//     cars, people, geese, e-bikes (life.js) — and hands back if it's stuck there.
//   • It hands back (a chime, schlep.js) for anything it can't do: arrived, off its path, stuck, a ping in another town
//     while she's in this one (it only knows the way IN, for now).
import { ctx, wrapAngle, MPH } from "../../core/ctx.js";
import { PL, LANE, streetOfS, streetPoint, streetCoords, nodeAlong, nodeAhead, otherAt, cutAt, stopsAt, movesFrom, blocked, headingOf, toLocal, toWorld } from "../town/plan.js";
import { X, TAPER0, TAPER1, RAMP0 } from "../town/exit.js";
import { LIFE } from "../town/life.js";
import { C as TC } from "../town/cars.js";

export const NAV = {
    TOWN_MPH: 24, SCHOOL_MPH: 14, BUMP_V: 4.5, TURN_V: 5, RING_V: 6, RAMP_MPH: 25,
    ACC: 2.4,             // m/s² it plans its braking with (gentle: a passenger's coffee stays in the cup)
    STOP_HOLD: 0.9,       // s at a stop line before it looks to go
    STUCK: 9,             // s held up by the same thing before it hands back
    OFF: 7.5,             // m off its path → it re-plans (in town) or hands back
    EXIT_FROM: 700,       // m before the exit it moves over and commits
};
const RING_OUT = 15.5, RAMP_D0 = 9.1, R_LANE = 5.25;
const laneD = dir => dir * LANE;

// ── the path: build, sample, follow ──
/** A route: { kind: "exit" | "town", pts: [{x, z, v, stop?, node?, end?}], cum: [m], i, hold, stuckT, town?, exitS?, dest? } */
function finish(kind, pts, extra = {}) {
    // densify to ≤ 3 m and drop duplicates
    const out = [];
    for (const p of pts) {
        const q = out[out.length - 1];
        if (q) {
            const L = Math.hypot(p.x - q.x, p.z - q.z);
            if (L < 0.3) { if (p.stop || p.end || p.v < q.v) Object.assign(q, p, { x: q.x, z: q.z }); continue; }
            const n = Math.floor(L / 3);
            for (let k = 1; k <= n; k++) { const t = k / (n + 1); out.push({ x: q.x + (p.x - q.x) * t, z: q.z + (p.z - q.z) * t, v: Math.max(q.v, p.v) }); }
        }
        out.push(Object.assign({}, p));
    }
    const cum = [0];
    for (let k = 1; k < out.length; k++) cum.push(cum[k - 1] + Math.hypot(out[k].x - out[k - 1].x, out[k].z - out[k - 1].z));
    return Object.assign({ kind, pts: out, cum, i: 0, along: 0, hold: 0, stuckT: 0, lat: 0, stops: 0 }, extra);
}
const at = (R, a) => {
    const { pts, cum } = R;
    let k = R.i;
    while (k < pts.length - 2 && cum[k + 1] < a) k++;
    const L = cum[k + 1] - cum[k] || 1, t = Math.max(0, Math.min(1, (a - cum[k]) / L));
    return { x: pts[k].x + (pts[k + 1].x - pts[k].x) * t, z: pts[k].z + (pts[k + 1].z - pts[k].z) * t };
};
/** Where she is along it (and how far off it). */
function project(R, x, z) {
    const { pts, cum } = R;
    let best = R.i, bd = 1e18, bt = 0;
    for (let k = Math.max(0, R.i - 2); k < Math.min(pts.length - 1, R.i + 12); k++) {
        const a = pts[k], b = pts[k + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2));
        const dx = a.x + ex * t - x, dz = a.z + ez * t - z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = k; bt = t; }
    }
    R.i = best; R.along = cum[best] + (cum[best + 1] - cum[best]) * bt; R.lat = Math.sqrt(bd);
}

// ── things in the way ──
const _ob = [];
/** Everything that might stand in its path: cars, people, geese, bikes → [x, z, r] triples in _ob. */
function obstacles() {
    _ob.length = 0;
    const car = ctx.car, cx = car.pos.x, cz = car.pos.z, near = (x, z) => Math.abs(x - cx) < 45 && Math.abs(z - cz) < 45;
    const T = ctx.traffic;
    if (T && T.cars) for (const c of T.cars) if (near(c.x, c.z)) _ob.push(c.x, c.z, c.kind && /bus|sweeper/.test(c.kind) ? 2.6 : 2.15);
    if (ctx.town && ctx.town.active && LIFE.on) {
        for (const r of LIFE.people) { const p = r.p && r.p.obj && r.p.obj.position; if (p && near(p.x, p.z)) _ob.push(p.x, p.z, 1.5); }
        for (const g of LIFE.geese) { const p = g.obj && g.obj.position; if (p && near(p.x, p.z)) _ob.push(p.x, p.z, 1.4); }
        for (const b of LIFE.bikes) { const p = b.obj && b.obj.position; if (p && near(p.x, p.z)) _ob.push(p.x, p.z, 1.6); }
    }
    for (const f of SOURCES) { try { f(_ob, near); } catch (e) { /* a source went away */ } }
    return _ob;
}
/** Other features can add what the car should stop for (a parade, a crossing guard…): fn(out, near) pushes x, z, r. */
export const SOURCES = [];
/** The free path ahead (m) before something's in it. */
function gapAhead(R, look = 26) {
    const ob = obstacles(), { pts, cum } = R;
    let gap = 1e9;
    for (let k = R.i + 1; k < pts.length && cum[k] - R.along < look; k++) {
        const p = pts[k];
        for (let j = 0; j < ob.length; j += 3) {
            const dx = ob[j] - p.x, dz = ob[j + 1] - p.z, r = ob[j + 2];
            if (dx * dx + dz * dz < r * r) { gap = cum[k] - R.along; break; }
        }
        if (gap < 1e9) break;
    }
    return gap;
}
/** Is anyone in (or turning through) this crossing? (cars.js's boxBusy, for her) */
function boxBusy(node) {
    if (!node) return false;
    const w = toWorld(node.x, node.z, {}), r = node.r || 8;
    for (const o of ctx.traffic.cars) {
        if (o.hit) continue;
        const T = o.data && o.data.town;
        if (T && T.mode === "turn" && T.turn && T.turn.node === node) return true;
        if (Math.hypot(o.x - w.x, o.z - w.z) < r && o.speed > 0.5) return true;
    }
    return false;
}

// ── the exit: the right lane → the ramp → STOP → right onto the cross road ──
/** The exit + branch that leads to town `id`, if it's the next one ahead and far enough to make. */
export function exitFor(id) {
    const T = ctx.town;
    if (!T || !T.exitOf || !ctx.car) return null;
    const s = T.exitOf(id);
    const e = s == null ? null : X.exits.find(x => x.s === s);
    if (!e || !e.branches) return null;
    const b = e.branches.find(b => b.town && b.town.id === id);
    return b ? { e, b, ahead: e.s - ctx.car.s } : null;
}
const rampD = (b, u) => u < TAPER0 + 10 ? R_LANE : u < TAPER1 + 15 ? R_LANE + (u - TAPER0 - 10) / (TAPER1 - TAPER0 + 5) * (RAMP_D0 - R_LANE) : u < RAMP0 ? RAMP_D0 : b.dOf(u);
export function buildExit(x, hwV) {
    const { e, b } = x, H = ctx.world.highway || ctx.world.road, car = ctx.car, pts = [], o = {};
    const u0 = car.s - e.s, d0 = car.d, vR = NAV.RAMP_MPH / MPH;
    pts.push({ x: car.pos.x, z: car.pos.z, v: hwV });
    // over to the right lane in the first 120 m, then the lane, the taper, the decel lane, the branch
    for (let u = Math.ceil((u0 + 6) / 5) * 5; u <= b.stop - 2.5; u += 5) {
        const k = Math.min(1, (u - u0) / 120), d = u < TAPER0 ? d0 + (R_LANE - d0) * (k * k * (3 - 2 * k)) : rampD(b, u);
        H.point(e.s + u, d, o);
        pts.push({ x: o.x, z: o.z, v: u < TAPER1 ? hwV : u < RAMP0 ? Math.max(vR, hwV - (u - TAPER1) * 0.12) : vR });
    }
    // the STOP sign at the T (a real stop), then the right turn onto the cross road, then on toward town
    const c = b.cross, dS = b.dOf(b.stop), uL = c.u - 1.75;
    H.point(e.s + b.stop - 2.5, dS, o); pts.push({ x: o.x, z: o.z, v: 0, go: NAV.TURN_V, stop: true });
    const A = H.point(e.s + b.stop, dS, {}), K = H.point(e.s + uL, dS, {}), B = H.point(e.s + uL, dS + 9, {});
    for (let i = 1; i <= 8; i++) { const t = i / 8, w = 1 - t; pts.push({ x: w * w * A.x + 2 * w * t * K.x + t * t * B.x, z: w * w * A.z + 2 * w * t * K.z + t * t * B.z, v: NAV.TURN_V }); }
    for (let d = dS + 12; d <= c.d1 + 60; d += 4) { H.point(e.s + uL, d, o); pts.push({ x: o.x, z: o.z, v: NAV.TOWN_MPH / MPH }); }
    pts[pts.length - 1].end = true;
    return finish("exit", pts, { exitS: e.s, town: b.town.id });
}

// ── the town: a route over the street graph ──
function lineMeet(a, ha, b, hb) {
    const ax = Math.sin(ha), az = Math.cos(ha), bx = Math.sin(hb), bz = Math.cos(hb);
    const den = ax * bz - az * bx;
    if (Math.abs(den) < 1e-3) return null;
    const t = ((b.x - a.x) * bz - (b.z - a.z) * bx) / den;
    return { x: a.x + ax * t, z: a.z + az * t };
}
function ringSign(cx, cz, a) {
    const t = Math.atan2(a.z - cz, a.x - cx), tx = -Math.sin(t), tz = Math.cos(t);
    const toCx = cx - a.x, toCz = cz - a.z;
    return toCx * -tz + toCz * tx < 0 ? 1 : -1;
}
/** Where she is on the grid: { st, along, dir, pre: [local points before it] } — the street whose asphalt she's on and
 *  that runs the way she's facing (an intersection: the one she's lined up with); on an attached town's approach, the
 *  street it runs into. null: she isn't lined up on a street (parked across a driveway, on a lawn…). */
function startOf() {
    const car = ctx.car, L = toLocal(car.pos.x, car.pos.z, {}), lh = car.h - PL.ROT, c = {};
    const pre = [{ x: L.x, z: L.z }];
    let best = null, bs = -1;
    for (const st of PL.STREETS) {
        streetCoords(st, L.x, L.z, c);
        if (Math.abs(c.d) > st.curb + 0.6 || c.along < st.a0 - 2 || c.along > st.a1 + 2) continue;
        const al = Math.cos(lh - st.h), score = Math.abs(al) - Math.abs(c.d) * 0.01;
        if (Math.abs(al) > 0.8 && score > bs) { bs = score; best = { st, along: c.along, dir: al >= 0 ? 1 : -1 }; }
    }
    if (best) return { st: best.st, along: best.along + best.dir * 4, dir: best.dir, pre };
    const ap = PL.APPROACH;
    if (!ap) return null;
    streetCoords(ap, L.x, L.z, c);
    if (Math.abs(c.d) > 8 || c.along < ap.a0 - 4 || c.along > ap.a1 + 4 || Math.cos(lh - ap.h) < 0.7) return null;
    const to = { x: ap.px + ap.ux * ap.a1, z: ap.pz + ap.uz * ap.a1 };
    let J = null;
    for (const s of PL.STREETS) { streetCoords(s, to.x, to.z, c); if (Math.abs(c.d) < 1.5 && c.along >= s.a0 - 2 && c.along <= s.a1 + 2) { J = s; break; } }
    if (!J) return null;
    const dir = Math.cos(lh - J.h) >= 0 ? 1 : -1;
    streetCoords(J, L.x, L.z, c);
    const along = dir > 0 ? Math.max(J.a0 + 2, c.along + 4) : Math.min(J.a1 - 2, c.along - 4);
    return { st: J, along, dir, pre };
}
/** The door's street and the block to stop on (the door on her RIGHT; a one-way: its own way). */
function destOf(wx, wz) {
    const L = toLocal(wx, wz, {}), c = {};
    let best = null, bd = 1e9;
    for (const st of PL.STREETS) {
        streetCoords(st, L.x, L.z, c);
        if (c.along < st.a0 + 3 || c.along > st.a1 - 3) continue;
        if (Math.abs(c.d) < bd) { bd = Math.abs(c.d); best = { st, along: c.along, d: c.d }; }
    }
    if (!best || bd > 45) return null;
    const st = best.st;
    let dir = best.d >= 0 ? 1 : -1;
    if (st.oneway && st.oneway !== dir) dir = st.oneway;
    let a = best.along;
    for (const cr of st.cross) if (Math.abs(a - cr.a) < 15) a = cr.a + (a >= cr.a ? 15 : -15);
    a = Math.max(st.a0 + 6, Math.min(st.a1 - 6, a));
    return { st, along: a, dir, door: L };
}
/** Dijkstra over (crossing, the street + way she came in on): the edges [{ st, dir, n0, n1 }] from her to the door. */
function search(S0, D) {
    if (S0.st === D.st && S0.dir === D.dir && (D.along - S0.along) * S0.dir > 6) return [];
    const n0 = nodeAhead(S0.st, S0.along, S0.dir), nEnd = nodeAhead(D.st, D.along, -D.dir);
    if (!n0 || !nEnd) return null;
    const idx = new Map(PL.NODES.map((n, i) => [n, i]));
    const key = (n, sid, dir) => idx.get(n) * 4 + (sid === n.ns ? 0 : 2) + (dir > 0 ? 0 : 1);
    const start = { n: n0, sid: S0.st.id, dir: S0.dir, cost: Math.abs(nodeAlong(S0.st, n0) - S0.along), prev: null };
    const open = [start], done = new Set();
    let goal = null, guard = 0;
    while (open.length && guard++ < 6000) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (open[i].cost < open[bi].cost) bi = i;
        const s = open.splice(bi, 1)[0], k = key(s.n, s.sid, s.dir);
        if (done.has(k)) continue;
        done.add(k);
        if (s.n === nEnd && !(s.sid === D.st.id && s.dir === -D.dir)) { goal = s; break; }
        for (const m of movesFrom(s.n)) {
            if (!m.node || (m.street === s.sid && m.dir === -s.dir) || blocked(m.street, m.dir, s.n)) continue;
            if (done.has(key(m.node, m.street, m.dir))) continue;
            open.push({ n: m.node, sid: m.street, dir: m.dir, cost: s.cost + m.len + (m.street !== s.sid ? 14 : 0), prev: s });
        }
    }
    if (!goal) return null;
    const chain = [];
    for (let s = goal; s; s = s.prev) chain.unshift(s);
    return chain;
}
/** The town route to world point (wx, wz) → a route, or null (no way: it hands back). */
export function buildTown(wx, wz, opts = {}) {
    if (!(ctx.town && ctx.town.active) || !PL.STREETS.length) return null;
    const S0 = startOf(), D = destOf(wx, wz);
    if (!S0) return { fail: "street" };
    if (!D) return null;
    const chain = search(S0, D);
    if (!chain) return null;
    const V = (opts.townMph || NAV.TOWN_MPH) / MPH, pts = S0.pre.map(p => ({ x: p.x, z: p.z, v: V }));
    let cur = { st: S0.st, dir: S0.dir, along: S0.along };
    const sample = (st, dir, a, b, v) => {
        if ((b - a) * dir <= 0) return;
        const n = Math.max(1, Math.ceil(Math.abs(b - a) / 3));
        for (let k = 0; k <= n; k++) { const p = streetPoint(st, a + (b - a) * k / n, laneD(dir), {}); pts.push({ x: p.x, z: p.z, v }); }
    };
    // the crossings in order: chain[0].n is the first one ahead of her; each next state says which way she leaves it
    const legs = chain.map((s, i) => ({ n: s.n, next: chain[i + 1] ? { st: PL.STREETS[chain[i + 1].sid], dir: chain[i + 1].dir } : { st: D.st, dir: D.dir } }));
    for (const { n, next } of legs) {
        const na = nodeAlong(cur.st, n), circle = !!n.circle, same = next.st === cur.st && next.dir === cur.dir;
        const lineA = circle ? na - cur.dir * RING_OUT : cutAt(cur.st, n, cur.dir, laneD(cur.dir), otherAt(n, cur.st.id).outer + 2);
        sample(cur.st, cur.dir, cur.along, lineA - cur.dir * 2.5, V);
        const stop = !circle && stopsAt(cur.st, n) && !(cur.st.oneway && cur.dir !== cur.st.oneway);
        const pL = streetPoint(cur.st, lineA - cur.dir * 2.5, laneD(cur.dir), {});
        pts.push({ x: pL.x, z: pL.z, v: stop ? 0 : same && !circle ? V : NAV.TURN_V, go: same && !circle ? V : NAV.TURN_V, stop, node: n });
        if (same && !circle) { cur.along = lineA - cur.dir * 2.5; continue; }
        const nst = next.st, nna = nodeAlong(nst, n);
        const exitA = circle ? nna + next.dir * RING_OUT : cutAt(nst, n, -next.dir, laneD(next.dir), otherAt(n, nst.id).outer + 3);
        const a = streetPoint(cur.st, lineA, laneD(cur.dir), {}), b = streetPoint(nst, exitA, laneD(next.dir), {});
        if (circle && PL.circle) {
            const cx = n.x, cz = n.z, Rr = PL.circle.ring;
            const a0 = Math.atan2(a.z - cz, a.x - cx), a1 = Math.atan2(b.z - cz, b.x - cx);
            let da = a1 - a0;
            if (ringSign(cx, cz, a) < 0) { while (da > 0) da -= Math.PI * 2; } else { while (da < 0) da += Math.PI * 2; }
            const k = Math.max(6, Math.ceil(Math.abs(da) / 0.25));
            for (let j = 0; j <= k; j++) { const t = a0 + da * j / k; pts.push({ x: cx + Math.cos(t) * Rr, z: cz + Math.sin(t) * Rr, v: NAV.RING_V }); }
        } else {
            const K = lineMeet(a, headingOf(cur.st, cur.dir), b, headingOf(nst, next.dir)) || { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
            for (let j = 0; j <= 8; j++) { const t = j / 8, w = 1 - t; pts.push({ x: w * w * a.x + 2 * w * t * K.x + t * t * b.x, z: w * w * a.z + 2 * w * t * K.z + t * t * b.z, v: NAV.TURN_V }); }
        }
        cur = { st: nst, dir: next.dir, along: exitA };
    }
    // up the block to the door: ease over toward the kerb (double-parked — this is Brooklyn), stop beside it
    const aEnd = D.along, a0 = cur.along, len = (aEnd - a0) * cur.dir;
    if (len > 0) {
        const n = Math.max(2, Math.ceil(len / 3));
        for (let k = 1; k <= n; k++) {
            const a = a0 + (aEnd - a0) * k / n, left = (aEnd - a) * cur.dir, d = laneD(cur.dir) + cur.dir * 0.6 * Math.max(0, Math.min(1, 1 - (left - 4) / 12));
            const p = streetPoint(cur.st, a, d, {});
            pts.push({ x: p.x, z: p.z, v: V });
        }
    }
    const last = pts[pts.length - 1];
    last.v = 0; last.end = true;
    // local → world
    const w = {};
    for (const p of pts) { toWorld(p.x, p.z, w); p.x = w.x; p.z = w.z; }
    return finish("town", pts, { town: ctx.town.id, dest: { x: wx, z: wz }, street: cur.st.name });
}

// ── following it ──
const school = () => {
    const CAM = ctx.cameras;
    if (!CAM || !CAM.debug || !CAM.schoolHours || !CAM.schoolHours()) return null;
    return CAM.debug.CM.cams.filter(c => c.kind === "school");
};
/** One frame along route R → the controls, or { done: "arrived" | "off" | "stuck" }. */
export function follow(R, dt, opts = {}) {
    const car = ctx.car;
    project(R, car.pos.x, car.pos.z);
    const { pts, cum } = R, total = cum[cum.length - 1];
    if (R.lat > NAV.OFF) return { done: "off" };
    const v0 = Math.abs(car.speed);
    // the most it may do: the points ahead (braking for each), the town's limits, what's in the way
    let v = opts.cap || 1e9;
    let stopK = -1;
    for (let k = R.i + 1; k < pts.length && cum[k] - R.along < 70; k++) {
        const p = pts[k], dist = cum[k] - R.along;
        const pv = p.stop ? (p.cleared ? (p.go || NAV.TURN_V) : 0) : p.v;
        if (p.stop && !p.cleared && stopK < 0) stopK = k;
        v = Math.min(v, Math.sqrt(pv * pv + 2 * NAV.ACC * Math.max(0, dist - (pv === 0 ? 0.6 : 0))));
        if (p.stop && !p.cleared) break;
    }
    // (a stop line it has just rolled onto — or a hair past — still counts)
    if (stopK < 0) for (let k = Math.max(0, R.i - 1); k <= R.i + 1 && k < pts.length; k++) if (pts[k].stop && !pts[k].cleared && R.along - cum[k] < 3) { stopK = k; v = 0; }
    if (ctx.town && ctx.town.active) {
        v = Math.min(v, (opts.townMph || NAV.TOWN_MPH) / MPH);
        const st = streetOfS(car.s);
        if (st && TC.slow && TC.slow.has(st.id)) v = Math.min(v, NAV.BUMP_V);
        const cams = opts.school === false ? null : school();
        if (cams && cams.length) {
            const look = at(R, R.along + 30), inZ = ctx.cameras.debug.inZone;
            if (cams.some(c => { try { return inZ(c, car.pos.x, car.pos.z) || inZ(c, look.x, look.z); } catch (e) { return false; } })) v = Math.min(v, NAV.SCHOOL_MPH / MPH);
        }
    }
    const gap = gapAhead(R, Math.max(18, v0 * 2.2));
    if (gap < 1e9) v = Math.min(v, Math.max(0, (gap - (opts.margin || 4.5)) * 0.8));
    // the stop line: stand, then go when the crossing's clear
    if (stopK >= 0) {
        const dist = cum[stopK] - R.along;
        if (dist < 2.2 && v0 < 0.4) {
            R.hold += dt;
            if (R.hold > NAV.STOP_HOLD && (!boxBusy(pts[stopK].node) || R.hold > 6)) { pts[stopK].cleared = true; R.hold = 0; R.stops++; }
        }
    }
    // stuck behind something that won't move
    R.stuckT = gap < 1e9 && v0 < 0.3 && v < 0.3 ? R.stuckT + dt : 0;
    if (R.stuckT > NAV.STUCK) return { done: "stuck" };
    // arrived
    if (R.along >= total - 1.2 || (pts[pts.length - 1].end && total - R.along < 2.5 && v0 < 0.5)) {
        if (R.kind === "exit") return { done: "ran-out" };
        if (v0 < 0.6) return { done: "arrived" };
        v = 0;
    }
    // steer: pure pursuit at a point ahead along the path
    const L = 4.5 + v0 * 0.45, tg = at(R, R.along + L);
    const want = Math.atan2(tg.x - car.pos.x, tg.z - car.pos.z), diff = wrapAngle(want - car.h);
    const steer = Math.max(-1, Math.min(1, -diff * 2.6));
    let throttle = 0, brake = 0;
    if (v0 < v - 0.25) throttle = Math.max(0.18, Math.min(0.85, (v - v0) * 0.22));
    else if (v0 > v + 0.35) brake = Math.max(0.12, Math.min(1, (v0 - v) * 0.3));
    if (v < 0.05 && v0 < 0.8) { throttle = 0; brake = 1; }
    R.v = v;
    return { steer, throttle, brake, handbrake: false, analog: true, blocked: gap < 12 && v0 > 1 };
}

export const routeDebug = { NAV, startOf, destOf, search, buildTown, buildExit, exitFor, follow, gapAhead, obstacles, boxBusy };
