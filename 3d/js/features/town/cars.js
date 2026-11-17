// features/town — the town's DRIVERS: identical silver minivans, school buses at all
// hours, one patrol cruiser. They're ordinary ctx.traffic cars (so crashes, near
// misses, honks, cops' traffic-dodging and CARJACKING all just work) driven by a small
// lane-following AI: down the street in the right-hand lane (traffic.place does the
// positioning through the TownRoad), a 4-way stop at every corner (four in ten drivers
// do the Lakewood roll-through), a curve through the intersection (free mode, a short
// bezier — or once round the gold minivan at the circle), then onto the next street.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { registerKind } from "../../traffic.js";
import { PL, LANE, streetPoint, streetOfS, movesFrom, nodeAhead, nodeAlong, headingOf, toLocal, blocked, rng, cutAt, otherAt, stopsAt } from "./plan.js";

registerKind("town_van", { len: 5.0, halfW: 0.98, circles: [1.5, -1.5], r: 1.0, mass: 1.5, model: "town_minivan", colors: { Paint: "#C3C8CE" } });
registerKind("town_bus", { len: 10.6, halfW: 1.25, circles: [-3.6, -1.2, 1.2, 3.6], r: 1.3, mass: 5, model: "roadevents_school_bus", paint: false });
// Midwood's: the car service (a black sedan, "five minutes"), the city bus, the alternate-side street sweeper
registerKind("town_carsvc", { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.2, model: "sedan", colors: { Paint: "#1C1C1E" } });
registerKind("town_citybus", { len: 10.6, halfW: 1.25, circles: [-3.6, -1.2, 1.2, 3.6], r: 1.3, mass: 5, model: "foot_bus", colors: { BusBlue: "#1565C0", BusWhite: "#F2F2F2", BusYellow: "#FFC107" } });
registerKind("town_sweeper", { len: 5.6, halfW: 1.15, circles: [1.6, -1.4], r: 1.15, mass: 3.5, model: "town_mw_sweeper", paint: false });
const CRUISE = { town_bus: 7.5, town_citybus: 7, town_sweeper: 3.2 };

const _l = {}, _p = {};
export const C = { cars: [], patrol: null, rnd: rng(7), hazards: [], slow: new Set(), routes: {} };
/** The streets a kind may drive (def.routes: the city bus keeps to the avenues): a Set of street ids, or null = anywhere. */
const routeOf = kind => C.routes[kind] || null;

function laneD(dir) { return dir * LANE; }
const isCircle = node => !!(node && node.circle);
const RING_OUT = 15.5;     // where the circle's entry / exit sits from its centre

/** Put a town driver on the road at (street, along, dir). kind: town_van | town_bus | cop */
export function spawnDriver(kind, street, along, dir, opts = {}) {
    const st = PL.STREETS[street];
    const T = {
        town: true, street, dir, mode: "drive", turn: null, waited: 0, stopFor: null,
        cruise: opts.cruise || CRUISE[kind] || 8.5 + C.rnd() * 3.5,
        roll: !CRUISE[kind] && C.rnd() < 0.4, wait: 0.5 + C.rnd() * 0.9, stuck: 0, patrol: kind === "cop",
    };
    const c = ctx.traffic.add(kind, st.base + along, laneD(dir), dir, opts.speed || 0, {
        ai: (dt, car) => drive(dt, car), keep: true,
        data: { town: T, streetsHold: true },
    });
    T.node = nodeAhead(st, along, dir);
    C.cars.push(c);
    if (T.patrol) C.patrol = c;
    lean(c);
    return c;
}

/** The parked-in-the-lane hazard vans in front of the wedding hall (stationary, jackable). */
export function spawnHazard(street, along, d, kind = "town_van") {
    const st = PL.STREETS[street], dir = d < 0 ? -1 : 1;
    const T = { town: true, street, dir, mode: "park", hazard: true };
    const c = ctx.traffic.add(kind, st.base + along, d, dir, 0, { ai: (dt, car) => { car.speed = 0; }, keep: true, data: { town: T, streetsHold: true }, noNearMiss: true });
    C.cars.push(c);
    lean(c);
    C.hazards.push(c);
    return c;
}

/** Our own vehicles cast ONE shadow (the body paint), not one per wheel / seat / light: a third of the shadow pass. */
const BODY = /^(Paint|BusYellow|BusWhite|SweeperBody)$/;
function lean(c) {
    if (!/^town_/.test(c.kind) || c.obj.userData.townLean) return;
    c.obj.userData.townLean = true;
    c.obj.traverse(o => { if (o.isMesh) o.castShadow = BODY.test(o.material.name); });
}
/** Far-off town cars are hidden (the blocks hide most of them anyway). */
export function lodDrivers(cam, far = 120) {
    for (const c of C.cars) c.obj.visible = Math.abs(c.x - cam.x) < far && Math.abs(c.z - cam.z) < far;
}

export function clearDrivers() {
    for (const c of C.cars) { c.obj.visible = true; if (ctx.traffic.cars.includes(c)) ctx.traffic.remove(c); }
    C.cars.length = 0; C.hazards.length = 0; C.patrol = null;
}

/** Someone (or Lulu, on foot or driving) in this car's lane just ahead: the gap in metres. */
function gapAhead(c, T, st) {
    let gap = 1e9;
    for (const o of ctx.traffic.cars) {
        if (o === c || o.hit && o.hitT > 8) continue;
        const dd = o.free ? null : o.s;
        if (dd == null) {
            // a car mid-turn: close in world space ahead of us?
            const dx = o.x - c.x, dz = o.z - c.z, f = dx * Math.sin(c.h) + dz * Math.cos(c.h), lat = Math.abs(-dx * Math.cos(c.h) + dz * Math.sin(c.h));
            if (f > 0 && f < 14 && lat < 2.4) gap = Math.min(gap, f);
            continue;
        }
        if (streetOfS(o.s) !== st || Math.abs(o.d - c.d) > 2.1) continue;
        const g = (o.s - c.s) * T.dir;
        if (g > 0 && g < gap) gap = g;
    }
    // Lulu: in her car or on foot
    const car = ctx.car, onFoot = ctx.foot && ctx.foot.active && ctx.foot.pos;
    const px = onFoot ? onFoot.x : car.pos.x, pz = onFoot ? onFoot.z : car.pos.z;
    const dx = px - c.x, dz = pz - c.z, f = dx * Math.sin(c.h) + dz * Math.cos(c.h), lat = Math.abs(-dx * Math.cos(c.h) + dz * Math.sin(c.h));
    if (f > 0 && f < 30 && lat < (onFoot ? 1.8 : 2.3)) gap = Math.min(gap, f - (onFoot ? 2.5 : 0));
    return gap;
}

/** Is anyone in (or about to be in) this intersection? */
function boxBusy(node, self) {
    const nx = PL.ORIGIN.x + node.x, nz = PL.ORIGIN.z + node.z;
    const r = node.r || 8, mine = self.data && self.data.town, side = !!mine && !PL.STREETS[mine.street].priority;
    for (const o of ctx.traffic.cars) {
        if (o === self || o.hit) continue;
        const T = o.data && o.data.town;
        if (T && T.mode === "turn" && T.turn.node === node) return true;
        if (!T && Math.hypot(o.x - nx, o.z - nz) < r) return true;
        // a side street waits for the priority road's traffic coming up to the crossing
        if (side && T && T.mode === "drive" && o.speed > 2 && T.node === node && PL.STREETS[T.street].priority) {
            const ost = PL.STREETS[T.street], gap = (nodeAlong(ost, node) - (o.s - ost.base)) * T.dir;
            if (gap > 0 && gap < r + 22) return true;
        }
    }
    const car = ctx.car;
    return !(ctx.foot && ctx.foot.active) && Math.hypot(car.pos.x - nx, car.pos.z - nz) < r - 1 && car.speed > 1.5;
}

function drive(dt, c) {
    const T = c.data.town;
    if (T.mode === "turn") return turning(dt, c, T);
    const st = PL.STREETS[T.street];
    const along = c.s - st.base;
    let v = T.cruise;
    if (C.slow.has(T.street)) v = Math.min(v, 4.5);                 // speed bumps (the locals know)
    const gap = gapAhead(c, T, st);
    if (gap < 30) v = Math.min(v, Math.max(0, (gap - 6.5) * 0.7));
    // the corner ahead
    const node = T.node;
    if (node) {
        const na = nodeAlong(st, node);
        const circle = isCircle(node);
        const lineAt = circle ? na - T.dir * RING_OUT : cutAt(st, node, T.dir, laneD(T.dir), otherAt(node, st.id).outer + 2);
        const dist = (lineAt - along) * T.dir;
        if (circle) {
            if (dist < 18) v = Math.min(v, Math.max(4, dist * 0.6));       // "yield" (lol)
            if (dist < 0.4) beginTurn(c, T, st, node);
        } else if (!stopsAt(st, node)) {
            // the priority road: no stop sign, just ease off for the turn
            if (dist < 20) v = Math.min(v, Math.max(5.5, dist * 0.5));
            if (dist < 0.8) beginTurn(c, T, st, node);
        } else if (dist < 24) {
            v = Math.min(v, Math.max(T.roll ? 3.2 : 0, dist * 0.55));
            if (dist < 0.8 && (T.roll || c.speed < 0.5)) {
                T.waited += dt;
                if ((T.roll || T.waited > T.wait) && !boxBusy(node, c)) { T.waited = 0; beginTurn(c, T, st, node); }
            }
        }
    } else if ((T.dir > 0 ? st.a1 - along : along - st.a0) < 10) {
        v = 0;   // the end of a dead-end stub (shouldn't happen): U-turn
        T.dir = -T.dir; c.dir = T.dir; c.d = c.dTarget = laneD(T.dir); T.node = nodeAhead(st, along, T.dir);
    }
    c.speed += Math.max(-9 * dt, Math.min(3.2 * dt, v - c.speed));
    c.speed = Math.max(0, c.speed);
    c.s += c.speed * T.dir * dt;
    c.d += (laneD(T.dir) - c.d) * Math.min(1, dt * 2);
    c.dTarget = c.d;
    T.stuck = c.speed < 0.2 ? T.stuck + dt : 0;
}

function beginTurn(c, T, st, node) {
    const R = routeOf(c.kind);
    let moves = movesFrom(node).filter(m => m.node && !(m.street === T.street && m.dir === -T.dir) && !blocked(m.street, m.dir, node));
    if (R) { const ok = moves.filter(m => R.has(m.street)); if (ok.length) moves = ok; }
    if (!moves.length) { T.dir = -T.dir; c.dir = T.dir; T.node = nodeAhead(st, c.s - st.base, T.dir); return; }
    const straight = moves.find(m => m.street === T.street);
    const m = straight && C.rnd() < 0.5 ? straight : moves[Math.floor(C.rnd() * moves.length)];
    const nst = PL.STREETS[m.street];
    const na = nodeAlong(nst, node);
    const exitAlong = isCircle(node) ? na + m.dir * RING_OUT : cutAt(nst, node, -m.dir, laneD(m.dir), otherAt(node, nst.id).outer + 3);
    // the path (local coords): from here to the new lane
    toLocal(c.x, c.z, _l);
    const a = { x: _l.x, z: _l.z };
    const b = streetPoint(nst, exitAlong, laneD(m.dir), {});
    const pts = [a];
    if (isCircle(node)) {
        // round the island, keeping it on the left (a full ring for a U-ey… never mind)
        const cx = node.x, cz = node.z, R = PL.circle.ring;
        let a0 = Math.atan2(a.z - cz, a.x - cx), a1 = Math.atan2(b.z - cz, b.x - cx);
        // travelling with the island on the LEFT means the angle decreases (x right, z up seen from above, heading convention)
        let da = a1 - a0;
        const sgn = ringSign(cx, cz, a, R);
        if (sgn < 0) { while (da > 0) da -= Math.PI * 2; } else { while (da < 0) da += Math.PI * 2; }
        const n = Math.max(6, Math.ceil(Math.abs(da) / 0.25));
        for (let k = 0; k <= n; k++) { const t = a0 + da * k / n; pts.push({ x: cx + Math.cos(t) * R, z: cz + Math.sin(t) * R }); }
    } else {
        // a quadratic bezier through where the two lane lines meet
        const h0 = headingOf(st, T.dir), h1 = headingOf(nst, m.dir);
        const k = lineMeet(a, h0, b, h1) || { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
        for (let i = 1; i <= 8; i++) { const t = i / 8, u = 1 - t; pts.push({ x: u * u * a.x + 2 * u * t * k.x + t * t * b.x, z: u * u * a.z + 2 * u * t * k.z + t * t * b.z }); }
    }
    pts.push(b);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    T.mode = "turn";
    T.turn = { pts, len, u: 0, node, to: m, exitAlong };
    c.free = true;
}
/** +1 / −1: which way round the circle keeps the island on the driver's left, from point a. */
function ringSign(cx, cz, a, R) {
    const t = Math.atan2(a.z - cz, a.x - cx);
    const tx = -Math.sin(t), tz = Math.cos(t);         // tangent for increasing angle
    const toC = { x: cx - a.x, z: cz - a.z };
    const right = { x: -tz, z: tx };                    // the driver's right for heading (tx, tz)
    return toC.x * right.x + toC.z * right.z < 0 ? 1 : -1;
}
function lineMeet(a, ha, b, hb) {
    const ax = Math.sin(ha), az = Math.cos(ha), bx = Math.sin(hb), bz = Math.cos(hb);
    const den = ax * bz - az * bx;
    if (Math.abs(den) < 1e-3) return null;
    const t = ((b.x - a.x) * bz - (b.z - a.z) * bx) / den;
    return { x: a.x + ax * t, z: a.z + az * t };
}

function turning(dt, c, T) {
    const tr = T.turn;
    const v = Math.min(T.cruise, isCircle(tr.node) ? 6.5 : tr.to.street === T.street ? 8 : 5.5);
    // still give way to whoever's right in front
    const ahead = gapTurn(c);
    const want = ahead < 9 ? 0 : v;
    c.speed += Math.max(-9 * dt, Math.min(3 * dt, want - c.speed));
    tr.u += c.speed * dt;
    if (tr.u >= tr.len) {
        const nst = PL.STREETS[tr.to.street];
        T.street = tr.to.street; T.dir = tr.to.dir; T.mode = "drive"; T.turn = null;
        c.free = false; c.dir = T.dir;
        c.s = nst.base + tr.exitAlong; c.d = c.dTarget = laneD(T.dir);
        T.node = nodeAhead(nst, tr.exitAlong, T.dir);
        return;
    }
    // walk the polyline
    let u = tr.u, i = 1;
    for (; i < tr.pts.length; i++) {
        const sl = Math.hypot(tr.pts[i].x - tr.pts[i - 1].x, tr.pts[i].z - tr.pts[i - 1].z);
        if (u <= sl) break;
        u -= sl;
    }
    i = Math.min(i, tr.pts.length - 1);
    const p0 = tr.pts[i - 1], p1 = tr.pts[i];
    const sl = Math.hypot(p1.x - p0.x, p1.z - p0.z) || 1, t = Math.min(1, u / sl);
    c.x = PL.ORIGIN.x + p0.x + (p1.x - p0.x) * t;
    c.z = PL.ORIGIN.z + p0.z + (p1.z - p0.z) * t;
    const hw = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    let dh = hw - c.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
    c.h += dh * Math.min(1, dt * 8);
}
function gapTurn(c) {
    let g = 1e9;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    for (const o of ctx.traffic.cars) {
        if (o === c || o.hit) continue;
        const dx = o.x - c.x, dz = o.z - c.z, f = dx * fx + dz * fz;
        if (f > 0 && f < 12 && Math.abs(-dx * fz + dz * fx) < 2.4) g = Math.min(g, f);
    }
    const car = ctx.car, dx = car.pos.x - c.x, dz = car.pos.z - c.z, f = dx * fx + dz * fz;
    if (!(ctx.foot && ctx.foot.active) && f > 0 && f < 12 && Math.abs(-dx * fz + dz * fx) < 2.4) g = Math.min(g, f);
    return g;
}

/** A free spot on the grid for a new driver, at least `minD` m from Lulu: {street, along, dir}. */
export function randomSpot(minD = 60, kind = "town_van") {
    const car = ctx.car;
    const R = routeOf(kind), pool = R ? PL.STREETS.filter(s => R.has(s.id)) : PL.STREETS;
    for (let k = 0; k < 40; k++) {
        const st = pool[Math.floor(C.rnd() * pool.length)];
        if (st.cross.length < 2) continue;
        const seg = Math.floor(C.rnd() * (st.cross.length - 1));
        const a0 = st.cross[seg].a, a1 = st.cross[seg + 1].a;
        if (a1 - a0 < 34) continue;
        const along = a0 + 16 + C.rnd() * (a1 - a0 - 32);
        const dir = C.rnd() < 0.5 ? 1 : -1;
        if (blocked(st.id, 1, st.cross[seg].node) && dir > 0) continue;
        if (blocked(st.id, -1, st.cross[seg + 1].node) && dir < 0) continue;
        const p = streetPoint(st, along, laneD(dir), _p);
        const wx = PL.ORIGIN.x + p.x, wz = PL.ORIGIN.z + p.z;
        if (Math.hypot(wx - car.pos.x, wz - car.pos.z) < minD) continue;
        if (ctx.traffic.cars.some(o => Math.hypot(o.x - wx, o.z - wz) < (kind === "town_bus" ? 16 : 11))) continue;
        return { street: st.id, along, dir };
    }
    return null;
}

/** Keep the town busy: respawn wrecked / stuck drivers somewhere out of the way. */
export function tendDrivers(dt, want) {
    const car = ctx.car;
    for (let i = C.cars.length - 1; i >= 0; i--) {
        const c = C.cars[i], T = c.data.town;
        if (!ctx.traffic.cars.includes(c)) { C.cars.splice(i, 1); if (C.patrol === c) C.patrol = null; continue; }
        if (T.hazard) continue;
        const far = Math.hypot(c.x - car.pos.x, c.z - car.pos.z) > 70;
        const gone = (c.hit && c.hitT > 7) || (T.stuck > 25 && far) || (c.data.streetsJack && false);
        if (gone && far) {
            const sp = randomSpot(70, c.kind);
            if (!sp) continue;
            ctx.traffic.remove(c);
            C.cars.splice(i, 1);
            if (C.patrol === c) C.patrol = null;
            spawnDriver(c.kind === "cop" ? "cop" : c.kind, sp.street, sp.along, sp.dir, { speed: 4 });
        }
    }
    for (const [kind, n] of Object.entries(want)) {
        const have = C.cars.filter(c => c.kind === kind && !c.data.town.hazard).length;
        if (have < n) { const sp = randomSpot(70, kind); if (sp) spawnDriver(kind, sp.street, sp.along, sp.dir, { speed: 5 }); }
    }
}

export { THREE };
