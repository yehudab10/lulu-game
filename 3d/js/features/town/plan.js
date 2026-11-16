// features/town — THE PLAN ENGINE: turns a town definition (towns/<id>.js — plain data:
// streets with names, block uses, landmarks, signs, lines, traffic mix, the ramps) into
// what everything else uses:
//   • STREETS — straight streets (axis "ns" runs along +z, heading 0; "ew" along +x,
//     heading π/2), each owning SLEN metres of s from S0 so s ↔ street is unambiguous;
//   • NODES — every crossing of an ns and an ew street, and each street's ordered crossings;
//   • BLOCKS — the rectangles between neighbouring streets, with each face's use;
//   • the TownRoad — the same API as the highway's Road (at / point / nearest), so every
//     system that thinks in road coordinates (driving, traffic, cops, on foot, carjacking)
//     works on the town's streets unchanged;
//   • the graph (moves out of a node, shortest paths) and the occluders (law's line of sight).
// Spacing doesn't have to be uniform: service roads, wide avenues and short East-streets all work.
//
// Local frame: x, z in metres; world = ORIGIN + local. d = metres to the RIGHT of a street's
// heading (the game's convention): lanes d = ±1.75, parking ±4.6, curb ±5.6, sidewalk to ±8.6,
// lots from ±11.

export const LANE = 1.75, PARK = 4.6, CURB = 5.6, WALK = 8.6, FRONT = 11, STOP = 7.6;
export const SLEN = 1000;
export const HALF_PI = Math.PI / 2;

/** The current town's plan (filled by setPlan). Modules read PL.* at call time. */
export const PL = { def: null, ORIGIN: { x: 0, z: 0 }, S0: 500000, STREETS: [], NODES: [], BLOCKS: [], OCCLUDERS: [], byName: {}, circle: null };

export function setPlan(def) {
    if (PL.def === def) return PL;
    PL.def = def;
    PL.ORIGIN = def.origin;
    PL.S0 = def.s0 || 500000;
    PL.STREETS = def.streets.map((s, id) => ({ id, name: s.name, axis: s.axis, c: s.c, a0: s.a0, a1: s.a1, h: s.axis === "ns" ? 0 : HALF_PI,
        base: PL.S0 + id * SLEN, cross: [], wide: s.wide || 0 }));
    PL.byName = {};
    for (const st of PL.STREETS) PL.byName[st.name] = st;
    // crossings
    PL.NODES = [];
    for (const a of PL.STREETS) if (a.axis === "ns") for (const b of PL.STREETS) if (b.axis === "ew") {
        if (a.c < b.a0 - 0.1 || a.c > b.a1 + 0.1 || b.c < a.a0 - 0.1 || b.c > a.a1 + 0.1) continue;
        const n = { id: PL.NODES.length, x: a.c, z: b.c, ns: a.id, ew: b.id, circle: false };
        PL.NODES.push(n);
        a.cross.push({ a: b.c, node: n });
        b.cross.push({ a: a.c, node: n });
    }
    for (const st of PL.STREETS) st.cross.sort((p, q) => p.a - q.a);
    // the traffic circle (if any)
    PL.circle = null;
    if (def.circle) {
        const n = nodeOf(def.circle.ns, def.circle.ew);
        if (n) { n.circle = true; PL.circle = Object.assign({ node: n, x: n.x, z: n.z }, def.circle); }
    }
    // blocks: between neighbouring parallel streets that actually bound the rectangle
    const xs = [...new Set(PL.STREETS.filter(s => s.axis === "ns").map(s => s.c))].sort((p, q) => p - q);
    const zs = [...new Set(PL.STREETS.filter(s => s.axis === "ew").map(s => s.c))].sort((p, q) => p - q);
    PL.BLOCKS = [];
    for (let k = 0; k < xs.length - 1; k++) for (let l = 0; l < zs.length - 1; l++) {
        const x0 = xs[k], x1 = xs[k + 1], z0 = zs[l], z1 = zs[l + 1];
        const covers = (axis, c, lo, hi) => PL.STREETS.some(s => s.axis === axis && s.c === c && s.a0 <= lo + 0.1 && s.a1 >= hi - 0.1);
        if (!covers("ns", x0, z0, z1) || !covers("ns", x1, z0, z1) || !covers("ew", z0, x0, x1) || !covers("ew", z1, x0, x1)) continue;
        const o = (def.blocks && def.blocks[k + "," + l]) || {};
        const faces = Object.assign({ s: def.blockDefault || "homes", n: def.blockDefault || "homes", w: def.blockDefault || "homes", e: def.blockDefault || "homes" }, o.faces || {});
        if (o.all) for (const f of "snwe") faces[f] = o.all;
        PL.BLOCKS.push({ k, l, x0, x1, z0, z1, faces, solid: o.solid !== false });
    }
    PL.OCCLUDERS = PL.BLOCKS.filter(b => b.solid).map(b => blockRect(b, FRONT + 1.2));
    return PL;
}

export const street = name => PL.byName[name] || null;
export function nodeOf(nsName, ewName) {
    const a = street(nsName), b = street(ewName);
    return a && b ? PL.NODES.find(n => n.ns === a.id && n.ew === b.id) || null : null;
}
/** A block's lot rectangle (local), inset from the street centre lines. */
export function blockRect(b, inset = FRONT) { return { x0: b.x0 + inset, x1: b.x1 - inset, z0: b.z0 + inset, z1: b.z1 - inset }; }

// ── conversions ──────────────────────────────────────────────────────────
export const toWorld = (lx, lz, out = {}) => { out.x = PL.ORIGIN.x + lx; out.z = PL.ORIGIN.z + lz; return out; };
export const toLocal = (x, z, out = {}) => { out.x = x - PL.ORIGIN.x; out.z = z - PL.ORIGIN.z; return out; };
export function streetOfS(s) {
    if (s == null) return null;
    const k = Math.floor((s - PL.S0 + SLEN / 2) / SLEN);
    return k >= 0 && k < PL.STREETS.length ? PL.STREETS[k] : null;
}
/** Local point on street st at `along`, lateral d. */
export function streetPoint(st, along, d, out = {}) {
    if (st.axis === "ns") { out.x = st.c - d; out.z = along; }
    else { out.x = along; out.z = st.c + d; }
    out.h = st.h;
    return out;
}
export function streetCoords(st, lx, lz, out = {}) {
    if (st.axis === "ns") { out.along = lz; out.d = st.c - lx; }
    else { out.along = lx; out.d = lz - st.c; }
    return out;
}
export const headingOf = (st, dir) => dir > 0 ? st.h : st.h + Math.PI;
/** Where node n sits along street st. */
export const nodeAlong = (st, n) => st.axis === "ns" ? n.z : n.x;

// ── the road: same API as world.js's Road ────────────────────────────────
const _c = {}, _l = {};
export class TownRoad {
    constructor(highway) { this.highway = highway; this.town = true; }
    /** Centre point + heading at s. (A highway s — someone's stale value — is answered by the highway.) */
    at(s, out = {}) {
        const st = streetOfS(s);
        if (!st) return this.highway.at(s, out);
        streetPoint(st, s - st.base, 0, out);
        out.x += PL.ORIGIN.x; out.z += PL.ORIGIN.z;
        return out;
    }
    point(s, d, out = {}) {
        const st = streetOfS(s);
        if (!st) return this.highway.point(s, d, out);
        streetPoint(st, s - st.base, d, out);
        out.x += PL.ORIGIN.x; out.z += PL.ORIGIN.z;
        return out;
    }
    /** The street (x, z) is on. Sticky: stays on the hint's street while still in its corridor,
     *  so crossing an intersection doesn't flip her onto the cross street. */
    nearest(x, z, hint, out = {}) {
        toLocal(x, z, _l);
        const cur = streetOfS(hint);
        if (cur) {
            streetCoords(cur, _l.x, _l.z, _c);
            if (Math.abs(_c.d) <= 9.5 && _c.along >= cur.a0 - 6 && _c.along <= cur.a1 + 6) return fill(out, cur, _c.along, _c.d);
        }
        let best = null, bd = 1e18, ba = 0, bdd = 0;
        for (const st of PL.STREETS) {
            streetCoords(st, _l.x, _l.z, _c);
            const a = Math.max(st.a0, Math.min(st.a1, _c.along));
            const e = (_c.along - a) * (_c.along - a) + _c.d * _c.d;
            if (e < bd) { bd = e; best = st; ba = _c.along; bdd = _c.d; }
        }
        return fill(out, best, ba, bdd);
    }
    ensure() {}
}
function fill(out, st, along, d) { out.s = st.base + along; out.d = d; out.h = st.h; out.street = st; return out; }

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
/** A directed segment no ordinary driver takes (the town's jams): from node `n` along (street, dir). */
export function blocked(sid, dir, n) {
    const st = PL.STREETS[sid];
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
