// features/openworld — a town's traffic in a 🎉 PARTY: the same minivans in the same
// places at the same party time on every friend's screen. The town's own drivers react to
// whoever's in front of them (each screen would disagree within seconds), so in a party
// they stay home and these take over: every car loops round ONE block, right turns only,
// at a constant speed. Right-turn block loops never share a lane or cross in a box (each
// corner stays in its own quadrant), so they need no AI at all — a car's pose is a pure
// function of (party seed, block, party clock), like the highway's party traffic. It's
// Lakewood: nobody stops at the 4-way stops anyway. Cars are immune (a bump bounces
// Lulu, never the car — one screen must never knock a minivan off its loop).
import { ctx } from "../../core/ctx.js";

const LANE = 1.75, R = 5.5, V = 7, BUS_V = 5.6, FAR = 140;
export const TT = { town: null, seed: 0, loops: [], cars: new Map(), plan: null };

function h01(a, b) { let h = Math.imul(a ^ 0x2545F491, 0x9E3779B1) ^ Math.imul(b + 0x6C8E9CF5, 0x85EBCA77); h ^= h >>> 15; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 13; return (h >>> 0) / 4294967296; }

/** The loops for a town plan (local coords): one per block that a car can circle without
 *  cutting through the traffic circle or the double-parked vans. */
export function planLoops(plan, seed) {
    const loops = [];
    const circ = plan.circle;
    const haz = [];
    for (const hz of plan.def.hazards || []) {
        const st = plan.byName[hz.street];
        if (st) haz.push(st.axis === "ns" ? { x: st.c - hz.d, z: hz.along } : { x: hz.along, z: st.c + hz.d });
    }
    plan.BLOCKS.forEach((b, i) => {
        if (circ && [b.x0, b.x1].some(x => Math.abs(x - circ.x) < 1) && [b.z0, b.z1].some(z => Math.abs(z - circ.z) < 1)) return;
        const X0 = b.x0 + LANE, X1 = b.x1 - LANE, Z0 = b.z0 + LANE, Z1 = b.z1 - LANE;
        if (X1 - X0 < 4 * R || Z1 - Z0 < 4 * R) return;
        if (haz.some(p => p.x > X0 - 3 && p.x < X1 + 3 && p.z > Z0 - 3 && p.z < Z1 + 3 && (Math.abs(p.x - X0) < 3 || Math.abs(p.x - X1) < 3 || Math.abs(p.z - Z0) < 3 || Math.abs(p.z - Z1) < 3))) return;
        // counter-clockwise in (x, z) = the block always on the driver's right (the game's lanes)
        const segs = [
            { k: "L", ax: X1, az: Z0 + R, bx: X1, bz: Z1 - R },
            { k: "A", cx: X1 - R, cz: Z1 - R, a0: 0 },
            { k: "L", ax: X1 - R, az: Z1, bx: X0 + R, bz: Z1 },
            { k: "A", cx: X0 + R, cz: Z1 - R, a0: Math.PI / 2 },
            { k: "L", ax: X0, az: Z1 - R, bx: X0, bz: Z0 + R },
            { k: "A", cx: X0 + R, cz: Z0 + R, a0: Math.PI },
            { k: "L", ax: X0 + R, az: Z0, bx: X1 - R, bz: Z0 },
            { k: "A", cx: X1 - R, cz: Z0 + R, a0: Math.PI * 1.5 },
        ];
        let len = 0;
        for (const s of segs) { s.u0 = len; s.len = s.k === "L" ? Math.hypot(s.bx - s.ax, s.bz - s.az) : Math.PI / 2 * R; len += s.len; }
        loops.push({ i, block: b.k + "," + b.l, segs, len });
    });
    // who drives where (seeded): most loops get a minivan, some two; one gets the school bus
    const busAt = loops.length ? Math.floor(h01(seed, 911) * loops.length) : -1;
    loops.forEach((L, j) => {
        L.cars = [];
        const n = (h01(seed, j * 3 + 1) < 0.8 ? 1 : 0) + (h01(seed, j * 3 + 2) < 0.3 ? 1 : 0);
        for (let k = 0; k < n; k++) L.cars.push({ key: `tw:${L.i}:${k}`, phase: (h01(seed + 5, j * 7 + k) + k * 0.5) * L.len, kind: j === busAt && k === 0 ? "town_bus" : "town_van", v: j === busAt && k === 0 ? BUS_V : V });
    });
    return loops;
}

/** A loop's pose at arc length u (local): out {x, z, h}. */
export function loopPoint(L, u, out) {
    u = ((u % L.len) + L.len) % L.len;
    let s = L.segs[L.segs.length - 1];
    for (const sg of L.segs) if (u < sg.u0 + sg.len) { s = sg; break; }
    const f = u - s.u0;
    if (s.k === "L") {
        const t = f / s.len;
        out.x = s.ax + (s.bx - s.ax) * t; out.z = s.az + (s.bz - s.az) * t;
        out.h = Math.atan2(s.bx - s.ax, s.bz - s.az);
    } else {
        const th = s.a0 + f / R;
        out.x = s.cx + R * Math.cos(th); out.z = s.cz + R * Math.sin(th);
        out.h = Math.atan2(-Math.sin(th), Math.cos(th));
    }
    return out;
}

/** Every party town car's world pose at party time T (ms). Pure — the test compares screens with it. */
export function townCarsAt(Tms) {
    const out = [], p = {}, O = TT.plan ? TT.plan.ORIGIN : { x: 0, z: 0 }, t = Tms / 1000;
    for (const L of TT.loops) for (const c of L.cars) {
        loopPoint(L, c.phase + c.v * t, p);
        out.push({ key: c.key, kind: c.kind, x: O.x + p.x, z: O.z + p.z, h: p.h });
    }
    return out;
}

const _p = {};
function ai(dt, c) {
    const D = c.data, L = D.loop, O = TT.plan.ORIGIN;
    const T = ctx.party ? ctx.party.clock() : ctx.time * 1000;
    loopPoint(L, D.phase + D.v * T / 1000, _p);
    c.x = O.x + _p.x; c.z = O.z + _p.z; c.h = _p.h; c.speed = D.v;
    D.at = T;
}

/** In a party town: make sure every loop car exists (call each frame; cheap when nothing changed). */
export function syncTownTraffic(town, plan, seed) {
    const tr = ctx.traffic;
    if (!tr || !plan) return;
    if (TT.town !== town || TT.seed !== seed || TT.plan !== plan) {
        clearTownTraffic();
        TT.town = town; TT.seed = seed; TT.plan = plan;
        TT.loops = planLoops(plan, seed);
    }
    for (const L of TT.loops) for (const k of L.cars) {
        let c = TT.cars.get(k.key);
        if (c && tr.cars.includes(c)) continue;
        c = tr.add(k.kind, ctx.car.s, LANE, 1, k.v, {
            ai, keep: true, immune: true,
            data: { party: k.key, owTown: true, loop: L, phase: k.phase, v: k.v, at: 0 },
            onRemove: car => { if (TT.cars.get(car.data.party) === car) TT.cars.delete(car.data.party); },
        });
        c.free = true;
        c.onCrash = () => false;
        if (!c.obj.userData.owLean) { c.obj.userData.owLean = true; c.obj.traverse(o => { if (o.isMesh) o.castShadow = /^(Paint|BusYellow)$/.test(o.material.name); }); }
        ai(0, c); tr.place(c, 0);
        TT.cars.set(k.key, c);
    }
    // far ones hidden (the blocks hide most of them anyway)
    const cam = ctx.camera.position;
    for (const c of TT.cars.values()) c.obj.visible = Math.abs(c.x - cam.x) < FAR && Math.abs(c.z - cam.z) < FAR;
}
export function clearTownTraffic() {
    const tr = ctx.traffic;
    for (const c of TT.cars.values()) { c.obj.visible = true; if (tr) tr.remove(c); }
    TT.cars.clear();
    TT.loops = []; TT.town = null; TT.plan = null;
}
/** Live cars: [{key, x, z, at}] (tests compare them with townCarsAt(at)). */
export function townLive() { return [...TT.cars.values()].map(c => ({ key: c.data.party, x: c.x, z: c.z, at: c.data.at })); }
