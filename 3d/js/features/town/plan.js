// features/town — THE PLAN ENGINE: turns a town definition (towns/<id>.js — plain data:
// streets with names, block uses, landmarks, signs, lines, traffic mix, the ramps) into
// what everything else uses:
//   • STREETS — straight streets: axis "ns" (runs along +z, heading 0), "ew" (along +x,
//     heading π/2) or "diag" (from [x, z] to [x, z]: Kings Highway ignores the grid), each
//     owning SLEN metres of s from S0 so s ↔ street is unambiguous. A street can be wider
//     than the default (lanes: 2; a boulevard with malls + service roads), one-way, or a
//     priority road (no stop sign facing it where it crosses a side street);
//   • NODES — every crossing of two streets, and each street's ordered crossings;
//   • BLOCKS — the rectangles between neighbouring streets (and the 4-sided blocks between
//     a diagonal and the grid), with each face's use;
//   • the TownRoad — the same API as the highway's Road (at / point / nearest), so every
//     system that thinks in road coordinates (driving, traffic, cops, on foot, carjacking)
//     works on the town's streets unchanged;
//   • the graph (moves out of a node, shortest paths) and the occluders (law's line of sight).
// Spacing doesn't have to be uniform: service roads, wide avenues and short East-streets all work.
// (A diagonal bounds the grid — it may not cut through a row of rectangular blocks.)
//
// Local frame: x, z in metres; world = ORIGIN + local. d = metres to the RIGHT of a street's
// heading (the game's convention). A default street: lanes d = ±1.75, parking ±4.6, curb ±5.6,
// sidewalk to ±8.6, lots from ±11 — each street carries its own (st.park / curb / outer / walk / front).

export const LANE = 1.75, PARK = 4.6, CURB = 5.6, WALK = 8.6, FRONT = 11, STOP = 7.6;
export const SLEN = 1000;
export const HALF_PI = Math.PI / 2;

/** The current town's plan (filled by setPlan). Modules read PL.* at call time. */
export const PL = { def: null, ORIGIN: { x: 0, z: 0 }, ROT: 0, COS: 1, SIN: 0, S0: 500000, STREETS: [], NODES: [], BLOCKS: [], STRIPS: [], OCCLUDERS: [], byName: {}, circle: null, APPROACH: null };
/** Each def's computed plan (a town is planned once; switching between two built towns just swaps these in). */
const PLANS = new Map();
const PLAN_KEYS = ["def", "S0", "STREETS", "NODES", "BLOCKS", "STRIPS", "OCCLUDERS", "byName", "circle", "APPROACH"];

/** A street's geometry from its data: direction, right vector, and every lateral width. */
function makeStreet(s, id) {
    let px, pz, ux, uz, a0 = s.a0, a1 = s.a1, axis = s.axis;
    if (axis === "ns") { px = s.c; pz = 0; ux = 0; uz = 1; }
    else if (axis === "ew") { px = 0; pz = s.c; ux = 1; uz = 0; }
    else {
        // a diagonal: along = 0 at its midpoint, extended past its ends by ext0 / ext1
        const [x0, z0] = s.from, [x1, z1] = s.to, L = Math.hypot(x1 - x0, z1 - z0);
        ux = (x1 - x0) / L; uz = (z1 - z0) / L; px = (x0 + x1) / 2; pz = (z0 + z1) / 2;
        a0 = -L / 2 - (s.ext0 || 0); a1 = L / 2 + (s.ext1 || 0); axis = "diag";
    }
    const lanes = s.lanes || 1, parkLane = s.park !== false;
    const edge = 3.5 * lanes;                                       // the travel lanes' outer edge
    const curb = parkLane ? edge + 2.1 : edge + 0.2;                // (1 lane + parking: 5.6)
    const B = s.boulevard || null;                                  // { mall, service }: a mall + a service road each side
    const outer = B ? curb + B.mall + B.service : curb;
    const walk = outer + (s.sidewalk || 3), front = walk + 2.4;
    const st = { id, name: s.name, axis, c: s.c, a0, a1, h: axis === "ns" ? 0 : axis === "ew" ? HALF_PI : Math.atan2(ux, uz), px, pz, ux, uz, rx: -uz, rz: ux,
        base: PL.S0 + id * SLEN, cross: [], wide: s.wide || 0,
        lanes, parkLane, park: edge + 1.1, curb, outer, walk, front, oneway: s.oneway || 0, priority: !!s.priority, data: s };
    if (B) Object.assign(st, { boulevard: B, mallIn: curb, mallOut: curb + B.mall, svcIn: curb + B.mall, svcOut: outer,
        svcLane: curb + B.mall + 1.9, svcPark: outer - 1.2 });
    return st;
}

/** Where streets a and b cross (local), with each one's along there, or null. */
function crossing(a, b) {
    const den = a.ux * b.uz - a.uz * b.ux;
    if (Math.abs(den) < 1e-6) return null;
    const dx = b.px - a.px, dz = b.pz - a.pz;
    const ta = (dx * b.uz - dz * b.ux) / den, tb = (dx * a.uz - dz * a.ux) / den;
    if (ta < a.a0 - 0.1 || ta > a.a1 + 0.1 || tb < b.a0 - 0.1 || tb > b.a1 + 0.1) return null;
    return { x: a.px + a.ux * ta, z: a.pz + a.uz * ta, ta, tb };
}

/**
 * Make `def` the current plan, placed at `at` = { x, z, rot } (world origin of the local frame + its yaw: a local
 * heading h is world heading h + rot; local (lx, lz) → world ORIGIN + R(rot)·(lx, lz)). Without `at`: the town's
 * own data origin, unrotated. Every town is laid out the same in its local frame wherever it stands.
 */
export function setPlan(def, at = null) {
    const O = at || def.origin, rot = at && at.rot || 0;
    if (PL.def === def && PL.ORIGIN.x === O.x && PL.ORIGIN.z === O.z && PL.ROT === rot) return PL;
    PL.ORIGIN = { x: O.x, z: O.z };
    PL.ROT = rot; PL.COS = Math.cos(rot); PL.SIN = Math.sin(rot);
    if (PL.def === def) return PL;              // (same town, moved: the local plan stands as it is)
    const cached = PLANS.get(def);
    if (cached) { Object.assign(PL, cached); return PL; }
    PL.def = def;
    PL.S0 = def.s0 || 500000;
    PL.STREETS = def.streets.map(makeStreet);
    PL.byName = {};
    for (const st of PL.STREETS) PL.byName[st.name] = st;
    // crossings (the grid first: ns × ew; then every diagonal with whatever it crosses)
    PL.NODES = [];
    const addNode = (a, b, x, z, ta, tb) => {
        const n = { id: PL.NODES.length, x, z, ns: a.id, ew: b.id, circle: false };
        n.r = Math.max(a.outer, b.outer) + 2.4;                       // the box (8 m for two default streets)
        PL.NODES.push(n);
        a.cross.push({ a: ta, node: n });
        b.cross.push({ a: tb, node: n });
        return n;
    };
    for (const a of PL.STREETS) if (a.axis === "ns") for (const b of PL.STREETS) if (b.axis === "ew") {
        if (a.c < b.a0 - 0.1 || a.c > b.a1 + 0.1 || b.c < a.a0 - 0.1 || b.c > a.a1 + 0.1) continue;
        addNode(a, b, a.c, b.c, b.c, a.c);
    }
    PL.STREETS.forEach((a, i) => {
        if (a.axis !== "diag") return;
        PL.STREETS.forEach((b, j) => {
            if (b === a || (b.axis === "diag" && j < i)) return;
            const X = crossing(b, a);
            if (X) addNode(b, a, X.x, X.z, X.ta, X.tb);
        });
    });
    for (const st of PL.STREETS) st.cross.sort((p, q) => p.a - q.a);
    // the traffic circle (if any)
    PL.circle = null;
    if (def.circle) {
        const n = nodeOf(def.circle.ns, def.circle.ew);
        if (n) { n.circle = true; PL.circle = Object.assign({ node: n, x: n.x, z: n.z }, def.circle); }
    }
    // blocks: between neighbouring parallel streets that actually bound the rectangle
    // (a street with `grid: false` — an attached town's extra approach street — bounds no block and shifts no block key)
    const xs = [...new Set(PL.STREETS.filter(s => s.axis === "ns" && s.data.grid !== false).map(s => s.c))].sort((p, q) => p - q);
    const zs = [...new Set(PL.STREETS.filter(s => s.axis === "ew" && s.data.grid !== false).map(s => s.c))].sort((p, q) => p - q);
    const coverer = (axis, c, lo, hi) => PL.STREETS.find(s => s.axis === axis && s.c === c && s.a0 <= lo + 0.1 && s.a1 >= hi - 0.1);
    const faceUse = o => {
        const dflt = PL.def.blockDefault || "homes";
        const faces = Object.assign({ s: dflt, n: dflt, w: dflt, e: dflt }, o.faces || {});
        if (o.all) for (const f of "snwe") faces[f] = o.all;
        return faces;
    };
    PL.BLOCKS = [];
    for (let k = 0; k < xs.length - 1; k++) for (let l = 0; l < zs.length - 1; l++) {
        const x0 = xs[k], x1 = xs[k + 1], z0 = zs[l], z1 = zs[l + 1];
        const W = coverer("ns", x0, z0, z1), E = coverer("ns", x1, z0, z1), Sx = coverer("ew", z0, x0, x1), N = coverer("ew", z1, x0, x1);
        if (!W || !E || !Sx || !N) continue;
        const key = k + "," + l, o = (def.blocks && def.blocks[key]) || {};
        PL.BLOCKS.push({ k, l, key, x0, x1, z0, z1, faces: faceUse(o), solid: o.solid !== false, whole: o.whole || null,
            sides: { s: Sx.id, n: N.id, w: W.id, e: E.id }, poly: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]] });
    }
    // …and the 4-sided blocks between a diagonal and the nearest avenue on either side of it
    for (const D of PL.STREETS) {
        if (D.axis !== "diag") continue;
        const crossAt = x => D.cross.find(c => { const o = PL.STREETS[c.node.ns === D.id ? c.node.ew : c.node.ns]; return o.axis === "ns" && o.c === x; });
        for (let k = 0; k < xs.length - 1; k++) {
            const x0 = xs[k], x1 = xs[k + 1], nW = crossAt(x0), nE = crossAt(x1);
            if (!nW || !nE) continue;
            const zW = nW.node.z, zE = nE.node.z;
            for (const side of [1, -1]) {
                const cand = zs.filter(z => side > 0 ? z > Math.max(zW, zE) : z < Math.min(zW, zE));
                if (!cand.length) continue;
                const zA = side > 0 ? Math.min(...cand) : Math.max(...cand);
                const lo = Math.min(zA, zW, zE), hi = Math.max(zA, zW, zE);
                const A = coverer("ew", zA, x0, x1), W = coverer("ns", x0, Math.min(zA, zW), Math.max(zA, zW)), E = coverer("ns", x1, Math.min(zA, zE), Math.max(zA, zE));
                if (!A || !W || !E) continue;
                const key = k + "," + D.name + (side > 0 ? "" : ":s"), o = (def.blocks && def.blocks[key]) || {};
                // corners counter-clockwise from the south-west; faces s · e · n · w along its edges
                const poly = side > 0 ? [[x0, zW], [x1, zE], [x1, zA], [x0, zA]] : [[x0, zA], [x1, zA], [x1, zE], [x0, zW]];
                PL.BLOCKS.push({ k, l: key, key, x0, x1, z0: lo, z1: hi, faces: faceUse(o), solid: o.solid !== false, whole: o.whole || null, quad: true,
                    sides: side > 0 ? { s: D.id, n: A.id, w: W.id, e: E.id } : { s: A.id, n: D.id, w: W.id, e: E.id }, poly });
            }
        }
    }
    // frontage strips: a row of buildings along one side of a street, outside the blocks (the town's edges)
    PL.STRIPS = (def.strips || []).map(sp => {
        const st = street(sp.street);
        if (!st) return null;
        const a = streetPoint(st, sp.from, sp.side * (st.front + 1.2), {}), b = streetPoint(st, sp.to, sp.side * (st.front + (sp.depth || 13)), {});
        return Object.assign({}, sp, { st, rect: { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) } });
    }).filter(Boolean);
    PL.OCCLUDERS = PL.BLOCKS.filter(b => b.solid).map(b => blockRect(b, FRONT + 1.2))
        .concat(PL.STRIPS.filter(sp => sp.st.axis !== "diag" && sp.solid !== false).map(sp => sp.rect));
    // an ATTACHED town's approach: the interchange's cross road, from its T-junction to where the town's own drawn
    // street takes over — a street of the plan (she drives it on the town's road) that the build never draws (the
    // highway's interchange already did) and nothing else in town uses (no blocks, nodes, parking, people, drivers)
    const ap = def.approach;
    PL.APPROACH = ap ? Object.assign(makeStreet({ name: ap.name, axis: "diag", from: ap.from, to: ap.to, park: false, sidewalk: 1 }, PL.STREETS.length), { approach: true }) : null;
    PLANS.set(def, Object.fromEntries(PLAN_KEYS.map(k => [k, PL[k]])));
    return PL;
}

export const street = name => PL.byName[name] || null;
export function nodeOf(nsName, ewName) {
    const a = street(nsName), b = street(ewName);
    return a && b ? PL.NODES.find(n => (n.ns === a.id && n.ew === b.id) || (n.ns === b.id && n.ew === a.id)) || null : null;
}
/** The other street at node n. */
export const otherAt = (n, sid) => PL.STREETS[n.ns === sid ? n.ew : n.ns];

/** A block's lot polygon (local, counter-clockwise from the SW corner), each edge pulled in from its street's
 *  centre line by that street's lot setback (+ `extra`). */
export function blockPoly(b, extra = 0) {
    const ins = [b.sides.s, b.sides.e, b.sides.n, b.sides.w].map(id => PL.STREETS[id].front + extra);
    const P = b.poly, out = [];
    const line = i => {
        const a = P[i], c = P[(i + 1) % 4], L = Math.hypot(c[0] - a[0], c[1] - a[1]), ex = (c[0] - a[0]) / L, ez = (c[1] - a[1]) / L;
        return { x: a[0] - ez * ins[i], z: a[1] + ex * ins[i], ex, ez };    // shifted along the inward (left) normal
    };
    for (let i = 0; i < 4; i++) {
        const A = line((i + 3) % 4), B = line(i);
        const den = A.ex * B.ez - A.ez * B.ex;
        if (Math.abs(den) < 1e-9) { out.push([B.x, B.z]); continue; }
        const t = ((B.x - A.x) * B.ez - (B.z - A.z) * B.ex) / den;
        out.push([A.x + A.ex * t, A.z + A.ez * t]);
    }
    return out;
}
/** A block's lot rectangle (local), inset from the street centre lines (`inset` = a default street's FRONT
 *  + whatever extra; each side uses its own street's setback). A 4-sided block → the rectangle inside its lot. */
export function blockRect(b, inset = FRONT) {
    const e = inset - FRONT;
    if (!b.quad) {
        const f = k => PL.STREETS[b.sides[k]].front + e;
        return { x0: b.x0 + f("w"), x1: b.x1 - f("e"), z0: b.z0 + f("s"), z1: b.z1 - f("n") };
    }
    const p = blockPoly(b, e);
    return { x0: Math.max(p[0][0], p[3][0]), x1: Math.min(p[1][0], p[2][0]), z0: Math.max(p[0][1], p[1][1]), z1: Math.min(p[2][1], p[3][1]) };
}

// ── conversions ──────────────────────────────────────────────────────────
// (three.js rotation.y convention: a local heading h is the world heading h + ROT — the town's root has rotation.y = ROT)
export const toWorld = (lx, lz, out = {}) => { const x = lx, z = lz; out.x = PL.ORIGIN.x + x * PL.COS + z * PL.SIN; out.z = PL.ORIGIN.z - x * PL.SIN + z * PL.COS; return out; };
export const toLocal = (x, z, out = {}) => { const dx = x - PL.ORIGIN.x, dz = z - PL.ORIGIN.z; out.x = dx * PL.COS - dz * PL.SIN; out.z = dx * PL.SIN + dz * PL.COS; return out; };
/** World x / z of a local point (one coordinate at a time, for hot loops). */
export const wx = (lx, lz) => PL.ORIGIN.x + lx * PL.COS + lz * PL.SIN;
export const wz = (lx, lz) => PL.ORIGIN.z - lx * PL.SIN + lz * PL.COS;
/** Local heading → world heading, and back. */
export const wH = h => h + PL.ROT;
export const lH = h => h - PL.ROT;
/** A local direction (x, z) → world (in place on out). */
export const dirWorld = (x, z, out = {}) => { out.x = x * PL.COS + z * PL.SIN; out.z = -x * PL.SIN + z * PL.COS; return out; };
export function streetOfS(s) {
    if (s == null) return null;
    const k = Math.floor((s - PL.S0 + SLEN / 2) / SLEN);
    return k >= 0 && k < PL.STREETS.length ? PL.STREETS[k] : k === PL.STREETS.length && PL.APPROACH ? PL.APPROACH : null;
}
/** Local point on street st at `along`, lateral d. */
export function streetPoint(st, along, d, out = {}) {
    if (st.axis === "ns") { out.x = st.c - d; out.z = along; }
    else if (st.axis === "ew") { out.x = along; out.z = st.c + d; }
    else { out.x = st.px + st.ux * along + st.rx * d; out.z = st.pz + st.uz * along + st.rz * d; }
    out.h = st.h;
    return out;
}
export function streetCoords(st, lx, lz, out = {}) {
    if (st.axis === "ns") { out.along = lz; out.d = st.c - lx; }
    else if (st.axis === "ew") { out.along = lx; out.d = lz - st.c; }
    else { const dx = lx - st.px, dz = lz - st.pz; out.along = dx * st.ux + dz * st.uz; out.d = dx * st.rx + dz * st.rz; }
    return out;
}
export const headingOf = (st, dir) => dir > 0 ? st.h : st.h + Math.PI;
/** Where node n sits along street st. */
export const nodeAlong = (st, n) => st.axis === "ns" ? n.z : st.axis === "ew" ? n.x : (n.x - st.px) * st.ux + (n.z - st.pz) * st.uz;
/**
 * Where, along street st at lateral d, you are `w` metres (measured square to the cross street) short of
 * the other street at node n, coming toward it travelling `dir` (±1). Square crossings: n ± w; a diagonal
 * cross street gives the slanted line. cutAt(st, n, -dir, …) is the same distance past it.
 */
export function cutAt(st, n, dir, d, w) {
    const cs = otherAt(n, st.id), na = nodeAlong(st, n);
    const k = st.ux * cs.rx + st.uz * cs.rz;
    if (Math.abs(k) < 1e-6 || st.axis !== "diag" && cs.axis !== "diag") return na - dir * w;
    const m = st.rx * cs.rx + st.rz * cs.rz, sg = Math.sign(-dir * k);
    return na - dir * (w - sg * d * m) / Math.abs(k);
}
/** Does street st's traffic get a stop sign at node n? (Not on a priority road crossing a side street.) */
export function stopsAt(st, n) { return !n.circle && !(st.priority && !otherAt(n, st.id).priority); }

// ── the road: same API as world.js's Road ────────────────────────────────
const _c = {}, _l = {};
export class TownRoad {
    constructor(highway) { this.highway = highway; this.town = true; }
    /** Centre point + heading at s. (A highway s — someone's stale value — is answered by the highway.) */
    at(s, out = {}) {
        const st = streetOfS(s);
        if (!st) return this.highway.at(s, out);
        return worldOut(streetPoint(st, s - st.base, 0, out));
    }
    point(s, d, out = {}) {
        const st = streetOfS(s);
        if (!st) return this.highway.point(s, d, out);
        return worldOut(streetPoint(st, s - st.base, d, out));
    }
    /** The street (x, z) is on. Sticky: stays on the hint's street while still in its corridor,
     *  so crossing an intersection doesn't flip her onto the cross street. */
    nearest(x, z, hint, out = {}) {
        toLocal(x, z, _l);
        const cur = streetOfS(hint);
        if (cur) {
            streetCoords(cur, _l.x, _l.z, _c);
            if (Math.abs(_c.d) <= cur.walk + 0.9 && _c.along >= cur.a0 - 6 && _c.along <= cur.a1 + 6) return fill(out, cur, _c.along, _c.d);
        }
        let best = null, bd = 1e18, ba = 0, bdd = 0;
        for (let i = 0, n = PL.STREETS.length + (PL.APPROACH ? 1 : 0); i < n; i++) {
            const st = i < PL.STREETS.length ? PL.STREETS[i] : PL.APPROACH;
            streetCoords(st, _l.x, _l.z, _c);
            const a = Math.max(st.a0, Math.min(st.a1, _c.along));
            const e = (_c.along - a) * (_c.along - a) + _c.d * _c.d + (st.approach ? 0.01 : 0);    // (a tie: the town's own street)
            if (e < bd) { bd = e; best = st; ba = _c.along; bdd = _c.d; }
        }
        return fill(out, best, ba, bdd);
    }
    ensure() {}
}
function fill(out, st, along, d) { out.s = st.base + along; out.d = d; out.h = st.h + PL.ROT; out.street = st; return out; }
/** A local street point {x, z, h} → world, in place. */
function worldOut(o) { const x = o.x, z = o.z; o.x = PL.ORIGIN.x + x * PL.COS + z * PL.SIN; o.z = PL.ORIGIN.z - x * PL.SIN + z * PL.COS; o.h += PL.ROT; return o; }

// ── the graph ────────────────────────────────────────────────────────────
/** Moves out of node n: [{street, dir, node (next crossing) | null, exit (index into def.exits) | undefined, len}] */
export function movesFrom(n) {
    const out = [];
    for (const sid of [n.ns, n.ew]) {
        const st = PL.STREETS[sid], i = st.cross.findIndex(c => c.node === n);
        for (const dir of [1, -1]) {
            const nb = st.cross[i + dir];
            if (nb) { out.push({ street: sid, dir, node: nb.node, len: Math.abs(nb.a - nodeAlong(st, n)) }); continue; }
            const ex = (PL.def.exits || []).findIndex(e => e.street === st.name && e.dir === dir);
            if (ex >= 0) out.push({ street: sid, dir, node: null, exit: ex, len: 60 });
        }
    }
    return out;
}
/** The next crossing ahead along street st from `along`, travelling dir (±1). */
export function nodeAhead(st, along, dir) {
    if (dir > 0) { for (const c of st.cross) if (c.a > along + 1e-6) return c.node; }
    else for (let i = st.cross.length - 1; i >= 0; i--) if (st.cross[i].a < along - 1e-6) return st.cross[i].node;
    return null;
}
/** The crossings on either side of `along` on street st (1 or 2 nodes). */
export function nodesAround(st, along) {
    const out = [];
    const a = nodeAhead(st, along - 1e-3, 1), b = nodeAhead(st, along + 1e-3, -1);
    if (a) out.push(a);
    if (b && b !== a) out.push(b);
    return out;
}
/** The street two neighbouring nodes share. */
export function sharedStreet(a, b) {
    for (const id of [a.ns, a.ew]) if (id === b.ns || id === b.ew) return PL.STREETS[id];
    return PL.STREETS[a.ns];
}
/** A directed segment no ordinary driver takes (the town's jams, the wrong way down a one-way): from node `n` along (street, dir). */
export function blocked(sid, dir, n) {
    const st = PL.STREETS[sid];
    if (st.oneway && dir !== st.oneway) return true;
    for (const b of PL.def.blocked || []) {
        if (b.street !== st.name || b.dir !== dir) continue;
        const a = nodeAlong(st, n);
        if (a >= b.from - 0.1 && a < b.to - 0.1) return true;
    }
    return false;
}
/** Shortest path between nodes (Dijkstra over ≤ a few hundred nodes): [node…] from a to b, or null. */
export function pathNodes(a, b, avoidBlocked = false) {
    if (a === b) return [a];
    const dist = new Map([[a, 0]]), prev = new Map(), open = [a];
    while (open.length) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
        const n = open.splice(bi, 1)[0];
        if (n === b) break;
        for (const m of movesFrom(n)) {
            if (!m.node || (avoidBlocked && blocked(m.street, m.dir, n))) continue;
            const d = dist.get(n) + m.len;
            if (d < (dist.has(m.node) ? dist.get(m.node) : 1e18)) { dist.set(m.node, d); prev.set(m.node, n); open.push(m.node); }
        }
    }
    if (!prev.has(b)) return null;
    const out = [b];
    while (out[0] !== a) out.unshift(prev.get(out[0]));
    return out;
}

// ── occluders (law's line of sight) ──────────────────────────────────────
/** Does the segment a→b (LOCAL coords) cut through a solid block? */
export function segmentBlocked(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    for (const r of PL.OCCLUDERS) {
        let t0 = 0.02, t1 = 0.98;
        if (Math.abs(dx) < 1e-9) { if (ax < r.x0 || ax > r.x1) continue; }
        else {
            let ta = (r.x0 - ax) / dx, tb = (r.x1 - ax) / dx;
            if (ta > tb) [ta, tb] = [tb, ta];
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
            if (t0 > t1) continue;
        }
        if (Math.abs(dz) < 1e-9) { if (az < r.z0 || az > r.z1) continue; }
        else {
            let ta = (r.z0 - az) / dz, tb = (r.z1 - az) / dz;
            if (ta > tb) [ta, tb] = [tb, ta];
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
            if (t0 > t1) continue;
        }
        return true;
    }
    return false;
}

/** Like segmentBlocked, but blocks containing either end don't count (the camera can stand in a yard;
 *  a cluster's sample point sits inside its own block). For the town's cluster culling. */
export function sightBlocked(ax, az, bx, bz, occ = PL.OCCLUDERS) {
    const dx = bx - ax, dz = bz - az;
    for (const r of occ) {
        if ((bx > r.x0 && bx < r.x1 && bz > r.z0 && bz < r.z1) || (ax > r.x0 && ax < r.x1 && az > r.z0 && az < r.z1)) continue;
        let t0 = 0, t1 = 1;
        if (Math.abs(dx) < 1e-9) { if (ax < r.x0 || ax > r.x1) continue; }
        else { let ta = (r.x0 - ax) / dx, tb = (r.x1 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) continue; }
        if (Math.abs(dz) < 1e-9) { if (az < r.z0 || az > r.z1) continue; }
        else { let ta = (r.z0 - az) / dz, tb = (r.z1 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) continue; }
        return true;
    }
    return false;
}

/** Seeded RNG (a town is built the same every visit). */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// (for features that hold the plan as `ctx.town.plan`: its local ↔ world conversions)
PL.world = toWorld;
PL.local = toLocal;
PL.wh = wH;
