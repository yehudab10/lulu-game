// features/homes — 🎭 STAGING a scene of home life in whatever layout a house has (2–4 rooms in a row: kids?,
// living, dining?, kitchen), plus WHO CATCHES HER and what that person does about it.
//
//   anchors(V, rt)   named places worked out from the furniture house.js laid out: the table's seats (the dining
//                    table, or the kitchen table when there's no dining room), the couch, the armchair, the stove /
//                    sink / counter, the kids' desk + bunk bed, open floor — every standing spot pushed clear of the
//                    walls + furniture colliders (nobody stands inside anything)
//   stageScene()     runs the scene's stage(S) → { place: {kind: spot}, extras: […≤3], props: […], zones: […] }
//   buildProps()     every scene prop merged into ONE Kit (decor's primitive builder: 1–3 draw calls for the lot)
//   CATCH            when a resident would raise the alarm on a sneaking Lulu, the scene (or the kind of person) can
//                    turn it into something else: a kid makes her play, Zeidy thinks she's the cleaning lady, the
//                    mah-jongg ladies deal her in, the Shabbos table sets a place for her…
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { Kit } from "../decor/props.js";
import { tone } from "../interiors/fx.js";
import { linesFor } from "./scenes.js";

const D = 5.6, BZ = -D / 2;
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ANIMALS = ["cat", "dog"];

/** Push a standing spot clear of the colliders (r = a person's radius) and inside the house. */
export function clearSpot(rt, p, r = 0.36) {
    const B = rt.bounds, q = { x: p.x, z: p.z };
    for (let it = 0; it < 3; it++) {
        for (const c of rt.cols) {
            if (q.x > c.x0 - r && q.x < c.x1 + r && q.z > c.z0 - r && q.z < c.z1 + r) {
                const dl = q.x - (c.x0 - r), dr = (c.x1 + r) - q.x, dn = q.z - (c.z0 - r), df = (c.z1 + r) - q.z;
                const m = Math.min(dl, dr, dn, df);
                if (m === dl) q.x = c.x0 - r; else if (m === dr) q.x = c.x1 + r; else if (m === dn) q.z = c.z0 - r; else q.z = c.z1 + r;
            }
        }
        q.x = clamp(q.x, B.x0 + r, B.x1 - r); q.z = clamp(q.z, B.z0 + r, B.z1 - r);
    }
    return Object.assign({}, p, q);
}

/** The named places of this house's layout. */
export function anchors(V, rt, cast) {
    const R = V.rooms, room = t => R.find(r => r.type === t);
    const L = room("living"), K = room("kitchen"), Dn = room("dining"), Kd = room("kids");
    const free = (x, z, ry = 0, extra = {}) => clearSpot(rt, Object.assign({ x, z, ry }, extra));
    const A = {};
    if (Dn) {
        const cx = Dn.cx;
        A.table = { c: { x: cx, z: -0.2 }, y: 0.8, seats: [[-0.65, -1.02, 0], [0.75, 0.62, Math.PI], [0.05, -1.02, 0], [-0.65, 0.62, Math.PI], [0.75, -1.02, 0], [0.05, 0.62, Math.PI], [-1.55, -0.2, Math.PI / 2]]
            .map(([dx, z, ry]) => ({ x: cx + dx, z, ry })) };
        A.tableSide = free(cx + 1.65, 0.95, -2.2); A.tableSide2 = free(cx - 1.5, 1.35, 2.4);
    } else {
        const cx = K.cx;
        const seats = [[-1.3, 1.75, Math.PI], [-2.15, 0.9, Math.PI / 2], [-1.3, 0.05, 0]];
        if (!cast.includes("baby")) seats.push([-0.45, 0.9, -Math.PI / 2]);
        A.table = { c: { x: cx - 1.3, z: 0.9 }, y: 0.78, seats: seats.map(([dx, z, ry]) => ({ x: cx + dx, z, ry })) };
        A.tableSide = free(cx - 0.1, 2.0, -2.6); A.tableSide2 = free(cx - 2.4, 2.05, 2.6);
    }
    A.tableSeat0 = A.table.seats[0];
    // a window for the menorah: the dining room's (on its own little stand) or over the kitchen counter
    A.window = Dn ? { x: Dn.cx, y: 0, z: BZ + 0.3 } : { x: K.cx - 1.5, y: 0.92, z: BZ + 0.32 };
    A.stove = free(K.cx + 1.4, BZ + 1.15, Math.PI); A.sink = free(K.cx + 0.45, BZ + 1.12, Math.PI); A.counter = free(K.cx - 0.7, BZ + 1.12, Math.PI);
    A.fridge = free(K.cx + 2.5, BZ + 1.35, Math.PI);
    A.sinkUnder = { x: K.cx + 0.45, z: BZ + 1.0, ry: Math.PI, y: -0.3 };
    A.counterTop = { x: K.cx - 1.0, y: 0.92, z: BZ + 0.35 };
    A.kitchenFloor = { x0: K.x0 + 0.3, x1: K.x1 - 0.3, z0: -1.55, z1: 2.3, x: K.cx, z: 0.4 };
    A.couch = { x: L.cx - 0.8, z: BZ + 0.85, ry: 0 };
    A.couchSeat = i => ({ x: L.cx - 0.8 + [-0.6, 0.6, 0][i % 3], z: BZ + 0.85, ry: 0 });
    A.couchLie = { x: L.cx - 0.8, z: BZ + 0.82, ry: 0, y: 0.55 };
    A.armchair = { x: L.cx + 1.0, z: BZ + 0.85, ry: -0.5 };
    A.livingFloor = free(L.cx + 0.25, 1.15, 0);
    const runs = [free(L.cx - 0.2, 1.6), free(L.cx + 0.8, 0.5), free(L.cx - 1.8, 1.85)];
    A.livingRun = i => runs[i % runs.length];
    A.livingCorner = free(L.cx - 2.0, 2.2);
    A.door2 = free(L.cx + 0.6, 1.7);
    A.rugSpot = free(L.cx - 1.9, 1.3);
    A.around = (p, i) => { const a = [-2.3, -0.75, 0.75, 2.3, -1.5, 1.5][i % 6]; const q = free(p.x + Math.sin(a) * 1.05, p.z + Math.cos(a) * 1.05); q.ry = Math.atan2(p.x - q.x, p.z - q.z); return q; };
    if (Kd) {
        A.desk = { x: Kd.cx + 1.68, z: 0.6, ry: Math.PI / 2 }; A.deskTop = 0.74; A.deskSide = free(Kd.cx + 1.35, 1.55, 2.2);
        A.kidsFloor = free(Kd.cx - 0.25, 0.4);
        const bunks = [{ x: Kd.cx - 1.65, z: BZ + 0.6, ry: 0, y: 0.42 }, { x: Kd.cx - 1.65, z: BZ + 0.6, ry: 0, y: 1.36 }, { x: Kd.cx - 0.9, z: -0.4, ry: 0, y: 0.1 }];
        A.bunkLie = i => bunks[i % bunks.length];
        A.bunkSide = { x: Kd.cx - 0.3, z: -1.55, ry: -Math.PI / 2 - 0.35 };
    } else {
        A.desk = A.table.seats[0]; A.deskTop = A.table.y; A.deskSide = A.tableSide;
        A.kidsFloor = free(L.cx - 0.6, 1.5);
        A.bunkLie = i => (i % 2 ? { x: L.cx + 0.6, z: 1.6, ry: 0, y: 0.1 } : A.couchLie);
        A.bunkSide = A.armchair;
    }
    return A;
}

/** Run a scene's stage(S) for this house: what goes where. */
export function stageScene(scene, cast, A, rt, w = {}) {
    const out = { place: {}, extras: [], props: [], zones: [], slots: new Set() };
    const S = {
        A, cast, n: 0, w,
        has: k => cast.includes(k),
        animal: k => ANIMALS.includes(k),
        placed: k => !!out.place[k],
        taken: s => out.slots.has(s), claim: s => out.slots.add(s),
        place(kind, at, opts = {}) {
            if (!kind || !at || !cast.includes(kind)) return;
            const sitting = opts.sit || opts.lie || opts.sleep;
            const p = sitting || at.y != null ? Object.assign({}, at) : clearSpot(rt, at);
            out.place[kind] = Object.assign({ x: p.x, z: p.z, ry: opts.ry != null ? opts.ry : p.ry || 0, y: opts.y != null ? opts.y : p.y || 0 }, opts,
                { path: opts.path ? opts.path.map(q => { const c = clearSpot(rt, q); return [c.x, c.z]; }) : null });
        },
        seat(kind, i, sit = true) {
            // more people than chairs: the rest stand round the table (nobody shares a chair)
            if (i >= A.table.seats.length) { const q = A.around(A.table.c, i); return S.place(kind, q, { ry: q.ry }); }
            const s = A.table.seats[i]; S.place(kind, s, { sit, ry: s.ry });
        },
        extra(kind, at, opts = {}) {
            if (out.extras.length >= 3 || !at) return;
            const sitting = opts.sit;
            const p = sitting ? at : clearSpot(rt, at);
            out.extras.push(Object.assign({ kind, x: p.x, z: p.z, ry: opts.ry != null ? opts.ry : p.ry || 0, y: opts.y || p.y || 0 }, opts));
        },
        prop(name, x, y, z, ry = 0) { if (out.props.length < 8) out.props.push({ name, x, y, z, ry }); },
        zone(kind, rect) { out.zones.push(Object.assign({ kind }, rect)); },
    };
    try { if (scene && scene.stage) scene.stage(S); } catch (e) { console.error("[homes] stage", scene && scene.id, e); }
    return out;
}

// ── the props (primitive-built, merged: one Kit for the whole scene) ─────
const P = {
    plates(k, x, y, z) { for (const [dx, dz] of [[-0.7, -0.3], [0, -0.3], [0.7, -0.3], [-0.7, 0.3], [0, 0.3], [0.7, 0.3]]) k.cyl(0.13, 0.11, 0.02, "#FFFFFF", x + dx * 0.9, y + 0.01, z + dz); },
    platter(k, x, y, z) { k.cyl(0.26, 0.22, 0.03, "#ECEFF1", x, y + 0.015, z); k.ball(0.14, "#A1683A", x, y + 0.08, z, { sy: 0.6 }); k.ball(0.05, "#7CB342", x + 0.12, y + 0.05, z + 0.06); },
    books(k, x, y, z) { k.box(0.3, 0.05, 0.22, "#1E88E5", x, y + 0.025, z); k.box(0.28, 0.04, 0.2, "#E53935", x + 0.02, y + 0.07, z); k.box(0.22, 0.01, 0.3, "#FFFFFF", x - 0.05, y + 0.095, z + 0.02); },
    tiles(k, x, y, z) { for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) { const a = i * Math.PI / 2, r = 0.32; const ox = Math.cos(a) * r - Math.sin(a) * (j - 3) * 0.05, oz = Math.sin(a) * r + Math.cos(a) * (j - 3) * 0.05; k.box(0.04, 0.05, 0.03, "#FFFDE7", x + ox, y + 0.025, z + oz, { ry: a }); } k.box(0.26, 0.02, 0.26, "#2E7D32", x, y + 0.01, z); },
    toolbox(k, x, y, z) { k.box(0.5, 0.22, 0.24, "#C62828", x, y + 0.11, z); k.box(0.3, 0.04, 0.04, "#212121", x, y + 0.25, z); k.box(0.3, 0.03, 0.05, "#90A4AE", x + 0.35, y + 0.015, z + 0.1, { ry: 0.6 }); },
    suitcases(k, x, y, z) { k.box(0.75, 0.32, 0.5, "#6A1B9A", x, y + 0.16, z); k.box(0.55, 0.45, 0.25, "#00897B", x + 0.75, y + 0.225, z - 0.1); k.box(0.45, 0.3, 0.3, "#F9A825", x - 0.7, y + 0.15, z + 0.2); k.box(0.16, 0.04, 0.04, "#212121", x, y + 0.34, z); },
    lunchboxes(k, x, y, z) { for (let i = 0; i < 3; i++) k.box(0.2, 0.14, 0.12, ["#E91E63", "#2196F3", "#4CAF50"][i], x + i * 0.26, y + 0.07, z); k.ball(0.06, "#D32F2F", x - 0.25, y + 0.06, z); },
    mopBucket(k, x, y, z) { k.cyl(0.17, 0.14, 0.3, "#FBC02D", x, y + 0.15, z); k.cyl(0.015, 0.015, 1.25, "#8D6E63", x + 0.05, y + 0.62, z, { rz: 0.15 }); k.box(0.28, 0.42, 0.02, "#FFEB3B", x + 0.45, y + 0.21, z, { rx: -0.25 }); k.box(0.2, 0.06, 0.021, "#212121", x + 0.45, y + 0.26, z + 0.006, { rx: -0.25 }); },
    challah(k, x, y, z) { k.box(0.6, 0.012, 0.4, "#ECEFF1", x, y + 0.006, z); k.ball(0.15, "#C68642", x, y + 0.09, z, { sx: 1.6, sy: 0.7 }); k.box(0.48, 0.05, 0.34, "#1A237E", x, y + 0.16, z, { m: "solid" }); },
    candles(k, x, y, z) { for (const dx of [-0.08, 0.08]) { k.cyl(0.035, 0.05, 0.28, "#ECEFF1", x + dx, y + 0.14, z, { m: "shiny" }); k.cyl(0.012, 0.012, 0.08, "#FFFFFF", x + dx, y + 0.32, z); k.cone(0.014, 0.045, "#FFD54F", x + dx, y + 0.38, z, { m: "glow" }); } k.box(0.32, 0.015, 0.16, "#B0BEC5", x, y + 0.007, z, { m: "shiny" }); },
    kiddushTable(k, x, y, z) { for (const [dx, c] of [[-0.8, "#F9A825"], [-0.35, "#D7A15A"], [0.15, "#ECEFF1"], [0.6, "#8D6E63"]]) { k.box(0.34, 0.06, 0.28, "#B0BEC5", x + dx, y + 0.03, z, { m: "shiny" }); k.box(0.3, 0.06, 0.24, c, x + dx, y + 0.08, z); } k.cyl(0.035, 0.03, 0.12, "#B0BEC5", x + 1.0, y + 0.06, z - 0.2, { m: "shiny" }); },
    pizza(k, x, y, z) { for (const [dx, dz] of [[-0.45, 0], [0.45, 0.05]]) { k.box(0.5, 0.04, 0.5, "#D7CCC8", x + dx, y + 0.02, z + dz); k.cyl(0.22, 0.22, 0.015, "#FFB300", x + dx, y + 0.05, z + dz, {}, 16); for (let i = 0; i < 4; i++) k.cyl(0.03, 0.03, 0.01, "#C62828", x + dx + Math.cos(i * 1.6) * 0.11, y + 0.06, z + dz + Math.sin(i * 1.6) * 0.11); } k.box(0.5, 0.04, 0.5, "#D7CCC8", x, y + 0.17, z - 0.55, { rx: -1.1 }); },
    simchaTable(k, x, y, z) { k.box(2.3, 0.012, 0.95, "#FFFFFF", x, y + 0.006, z); for (const dx of [-0.7, 0, 0.7]) { k.cyl(0.07, 0.09, 0.14, "#B0BEC5", x + dx, y + 0.07, z, { m: "shiny" }); k.ball(0.1, "#F48FB1", x + dx, y + 0.2, z); k.ball(0.07, "#FFFFFF", x + dx + 0.06, y + 0.24, z + 0.05); } },
    cake(k, x, y, z) { k.cyl(0.24, 0.24, 0.18, "#FFFFFF", x, y + 0.09, z, {}, 16); k.cyl(0.17, 0.17, 0.12, "#F8BBD0", x, y + 0.24, z, {}, 16); k.ball(0.05, "#E91E63", x, y + 0.33, z); P.plates(k, x, y, z); },
    balloons(k, x, y, z) { for (const [dx, h, c] of [[0, 1.9, "#F06292"], [0.18, 2.05, "#FFFFFF"], [-0.16, 1.8, "#64B5F6"]]) { k.ball(0.17, c, x + dx, y + h, z, { sy: 1.2 }); k.cyl(0.005, 0.005, h - 0.2, "#EEEEEE", x + dx * 0.5, y + (h - 0.2) / 2, z); } k.box(0.12, 0.08, 0.12, "#795548", x, y + 0.04, z); },
    menorah(k, x, y, z, n = 1) {
        if (y < 0.1) { k.box(0.8, 0.05, 0.36, "#8D6E63", x, 0.86, z); k.box(0.06, 0.86, 0.06, "#6D4C41", x - 0.34, 0.43, z - 0.13); k.box(0.06, 0.86, 0.06, "#6D4C41", x + 0.34, 0.43, z - 0.13); k.box(0.06, 0.86, 0.06, "#6D4C41", x - 0.34, 0.43, z + 0.13); k.box(0.06, 0.86, 0.06, "#6D4C41", x + 0.34, 0.43, z + 0.13); y = 0.885; }
        k.box(0.62, 0.03, 0.08, "#C9A227", x, y + 0.24, z, { m: "shiny" }); k.cyl(0.02, 0.03, 0.24, "#C9A227", x, y + 0.12, z, { m: "shiny" }); k.cyl(0.08, 0.1, 0.03, "#C9A227", x, y + 0.015, z, { m: "shiny" });
        // eight branches + the shamash (taller, in the middle); tonight's candles lit right to left
        for (let i = 0; i < 8; i++) {
            const bx = x + (i < 4 ? -0.28 + i * 0.07 : 0.07 + (i - 4) * 0.07);
            k.cyl(0.012, 0.012, 0.03, "#C9A227", bx, y + 0.27, z, { m: "shiny" });
            const lit = 7 - i < n;
            if (lit) { k.cyl(0.008, 0.008, 0.07, ["#42A5F5", "#FFFFFF", "#FFEB3B", "#EF5350"][i % 4], bx, y + 0.32, z); k.cone(0.012, 0.035, "#FFD54F", bx, y + 0.375, z, { m: "glow" }); }
        }
        k.cyl(0.015, 0.015, 0.1, "#C9A227", x, y + 0.29, z, { m: "shiny" }); k.cyl(0.008, 0.008, 0.07, "#FFFFFF", x, y + 0.37, z); k.cone(0.012, 0.035, "#FFD54F", x, y + 0.425, z, { m: "glow" });
    },
    latkes(k, x, y, z) { k.cyl(0.25, 0.21, 0.03, "#ECEFF1", x - 0.3, y + 0.015, z); for (let i = 0; i < 7; i++) k.cyl(0.06, 0.06, 0.02, "#C68A3A", x - 0.3 + Math.cos(i) * 0.12, y + 0.04 + (i % 3) * 0.015, z + Math.sin(i) * 0.12); k.cyl(0.08, 0.07, 0.06, "#F5DEB3", x + 0.25, y + 0.03, z + 0.1); k.cyl(0.08, 0.07, 0.06, "#FFFFFF", x + 0.45, y + 0.03, z - 0.05); for (let i = 0; i < 4; i++) k.ball(0.05, "#FFB300", x + 0.6 + (i % 2) * 0.1, y + 0.05, z + 0.25 + (i >> 1) * 0.1, { sy: 0.7 }); P.plates(k, x, y, z); },
    dreidels(k, x, y, z) { for (const [dx, dz, c] of [[-0.3, 0.1, "#1E88E5"], [0.25, -0.15, "#E53935"], [0.05, 0.35, "#43A047"]]) { k.box(0.07, 0.07, 0.07, c, x + dx, y + 0.07, z + dz, { ry: dx * 3 }); k.cone(0.045, 0.05, c, x + dx, y + 0.02, z + dz, { rx: Math.PI }); k.cyl(0.008, 0.008, 0.05, c, x + dx, y + 0.13, z + dz); } for (let i = 0; i < 6; i++) k.cyl(0.025, 0.025, 0.006, "#FFD54F", x - 0.1 + i * 0.05, y + 0.003, z - 0.3, { m: "shiny" }); },
    hamantaschen(k, x, y, z) { k.cyl(0.24, 0.2, 0.03, "#ECEFF1", x, y + 0.015, z); for (let i = 0; i < 6; i++) { k.cone(0.06, 0.03, "#E0A955", x + Math.cos(i) * 0.12, y + 0.045, z + Math.sin(i) * 0.12, {}, 3); k.ball(0.022, i % 2 ? "#3E2723" : "#C62828", x + Math.cos(i) * 0.12, y + 0.06, z + Math.sin(i) * 0.12); } P.plates(k, x, y, z); k.cyl(0.03, 0.03, 0.22, "#5D4037", x + 0.9, y + 0.11, z - 0.2); },
    manos(k, x, y, z) { for (let i = 0; i < 4; i++) { const bx = x - 0.45 + i * 0.3; k.box(0.22, 0.12, 0.18, ["#FFF59D", "#F8BBD0", "#B3E5FC", "#C8E6C9"][i], bx, y + 0.06, z); k.box(0.24, 0.24, 0.2, "#FFFFFF", bx, y + 0.12, z, { m: "glass" }); k.ball(0.04, "#E91E63", bx, y + 0.26, z); } },
    cushions(k, x, y, z) { for (const [dx, dz, r] of [[0, 0, 0.1], [0.45, 0.15, -0.3], [-0.35, 0.25, 0.4]]) k.box(0.6, 0.16, 0.5, "#7E57C2", x + dx, y + 0.08 + (dx > 0 ? 0.16 : 0), z + dz, { ry: r }); },
    seder(k, x, y, z) { k.cyl(0.2, 0.2, 0.02, "#E0E0E0", x, y + 0.01, z, { m: "shiny" }); for (let i = 0; i < 6; i++) k.ball(0.035, ["#8BC34A", "#FFFFFF", "#795548", "#FFEB3B", "#9E9E9E", "#AED581"][i], x + Math.cos(i * 1.05) * 0.12, y + 0.035, z + Math.sin(i * 1.05) * 0.12); k.box(0.3, 0.06, 0.3, "#F5F5F5", x + 0.55, y + 0.03, z); k.box(0.26, 0.012, 0.26, "#E8D2A6", x + 0.55, y + 0.07, z); k.cyl(0.035, 0.025, 0.12, "#B0BEC5", x - 0.5, y + 0.06, z + 0.1, { m: "shiny" }); k.cyl(0.04, 0.04, 0.08, "#7B1FA2", x - 0.5, y + 0.16, z + 0.1); P.plates(k, x, y, z); },
    boxes(k, x, y, z) { for (const [dx, dz, h, r] of [[0, 0, 0, 0.1], [0.5, 0.1, 0, -0.2], [0.2, 0.05, 0.42, 0.3], [-0.45, 0.2, 0, 0.5]]) { k.box(0.48, 0.4, 0.42, "#C8A26B", x + dx, y + h + 0.2, z + dz, { ry: r }); k.box(0.49, 0.03, 0.08, "#8D6E63", x + dx, y + h + 0.41, z + dz, { ry: r }); } },
    chair(k, x, y, z) { k.box(0.44, 0.06, 0.44, "#8D6E63", x, y + 0.42, z); for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) k.box(0.05, 0.42, 0.05, "#6D4C41", x + a, y + 0.21, z + b); k.box(0.44, 0.5, 0.05, "#8D6E63", x, y + 0.7, z - 0.2); },
};
/** Held props (one small Kit each, in a hand). */
const HELD = {
    violin(k) { k.ball(0.09, "#A0522D", 0, -0.02, 0.05, { sx: 0.75, sz: 0.35 }); k.ball(0.07, "#A0522D", 0, 0.1, 0.05, { sx: 0.7, sz: 0.35 }); k.box(0.025, 0.28, 0.02, "#3E2723", 0, 0.28, 0.05); k.cyl(0.004, 0.004, 0.55, "#D7CCC8", 0.12, 0.1, 0.12, { rz: 1.1 }); },
    bowl(k) { k.cyl(0.08, 0.05, 0.06, "#FFFFFF", 0, 0, 0.12); k.cyl(0.07, 0.07, 0.01, "#FFCC80", 0, 0.025, 0.12); k.box(0.015, 0.012, 0.15, "#B0BEC5", 0.03, 0.05, 0.08, { rx: 0.5 }); },
    newspaper(k) { k.box(0.42, 0.01, 0.3, "#ECEFF1", 0, 0, 0.1, { rx: 1.2 }); k.box(0.3, 0.012, 0.04, "#616161", 0, 0.03, 0.12, { rx: 1.2 }); },
    book(k) { k.box(0.22, 0.03, 0.16, "#7E57C2", 0, 0, 0.12, { rx: 1.0 }); },
    hatFace(k) { k.cyl(0.17, 0.17, 0.02, "#212121", 0, 0.62, 0.15, { rx: 1.5 }); k.cyl(0.11, 0.11, 0.12, "#212121", 0, 0.62, 0.2, { rx: 1.5 }); },
    scissors(k) { k.box(0.02, 0.12, 0.01, "#B0BEC5", 0.01, 0, 0.08, { m: "shiny", rz: 0.2 }); k.box(0.02, 0.12, 0.01, "#B0BEC5", -0.01, 0, 0.08, { m: "shiny", rz: -0.2 }); k.torus(0.025, 0.006, "#E53935", 0, -0.08, 0.08); },
    plate(k) { k.cyl(0.14, 0.11, 0.02, "#FFFFFF", 0, 0, 0.16); k.ball(0.06, "#C68642", 0, 0.03, 0.16, { sy: 0.6 }); },
    toothbrush(k) { k.box(0.02, 0.2, 0.02, "#29B6F6", 0, 0, 0.08); k.box(0.024, 0.04, 0.03, "#FFFFFF", 0, 0.1, 0.095); },
};
function own(rt, g) { g.traverse(o => { if (o.isMesh && o.geometry) rt.own(o.geometry); }); return g; }
/** All of a scene's table / floor props as one merged object (1–3 draw calls). */
export function buildProps(rt, list) {
    if (!list || !list.length) return null;
    const k = new Kit();
    for (const p of list) { const f = P[p.name]; if (f) f(k, p.x, p.y, p.z, p.ry); }
    const g = own(rt, k.build("HomeScene"));
    rt.add(g);
    return g;
}
export function heldProp(rt, name) {
    const f = HELD[name];
    if (!f) return null;
    const k = new Kit(); f(k);
    return own(rt, k.build("HomeHeld"));
}

// ── who catches her ──────────────────────────────────────────────────────
/** Turn the whole visit into a guest visit (the household decided she's company after all). */
export function toGuest(rt, why) {
    const V = rt.data.V;
    V.mode = "guest"; V.converted = why || true;
    if (ctx.homes && ctx.homes.debug && ctx.homes.debug.VISIT.cur) ctx.homes.debug.VISIT.cur.mode = "guest";
    for (const q of V.res) { q.friendly = true; q.meter = 0; if (q.state !== "routine") q.state = "routine"; q.fight = null; }
    V.caller = null; V.callT = 0;
    if (V.crouch) V.crouch = false;
    emit("homes:guest", { key: V.home.key, why: V.converted });
}
const asK = (r, base) => (r.name || base);
/** The catch outcomes. Each: async (rt, r, scene) → true (handled: no alarm) | false (raise the alarm after all). */
export const CATCH = {
    async play(rt, r) {
        const V = rt.data.V;
        const i = await rt.choose(`${r.K.emoji} ${asK(r)}`, pick(["Play with me or I'm SCREAMING. I'm a VERY good screamer.", "You're sneaking! I LOVE sneaking! Play hide-and-seek with me or I tell!", "Are you a ROBBER? Robbers have to play LEGO. It's the rule."]),
            ["🧸 Play (just a minute)", "🏃 \"I can't right now…\""], { emoji: r.K.emoji, person: r.rec });
        if (rt.disposed) return true;
        if (i !== 0) return false;
        r.friendly = true; r.meter = 0; r.state = "routine";
        rt.luluPose = { cheer: true }; r.rec.pose = { dance: true };
        rt.bubble(pick(["...okay, ONE game. ONE.", "Fine. I'm the horsey. Neigh."]), rt.lulu.obj, 2.2);
        tone(660, 0.1, "triangle", 0.08); tone(880, 0.12, "triangle", 0.08, 0, 0.12);
        await rt.wait(2.4);
        if (rt.disposed) return true;
        rt.luluPose = null; r.rec.pose = {};
        rt.bubble(pick(["You're my BEST friend. I won't tell. ...for a WHILE.", "Okay you can go. Come back TOMORROW."]), r.p.obj, 2.6);
        V.played = (V.played || 0) + 1;
        emit("stat", { id: "homesPlayed", n: 1 });
        return true;
    },
    async homework(rt, r) {
        const i = await rt.choose(`${r.K.emoji} ${asK(r)}`, "A GROWN-UP! Quick — what's seven times eight? If you get it right I won't tell.", ["5️⃣6️⃣ \"Fifty-six.\"", "5️⃣4️⃣ \"Fifty-four?\"", "🤷 \"Ask your mother.\""], { emoji: r.K.emoji, person: r.rec });
        if (rt.disposed) return true;
        if (i === 2 || i < 0) { rt.bubble("MOMMYYY! The ROBBER doesn't know MATH!", r.p.obj, 2.6); return false; }
        r.friendly = true; r.meter = 0; r.state = "routine";
        rt.bubble(i === 0 ? "YES! ...wait, are you SURE? ...writing it down. You're a GENIUS." : "Fifty-FOUR?! HAHA! Even I know that's wrong! ...okay you can stay, you're FUNNY.", r.p.obj, 3);
        return true;
    },
    async cleaning(rt, r) {
        r.friendly = true; r.meter = 0; r.state = "routine";
        rt.bubble(pick(["Ah, the cleaning lady! You're EARLY. The kitchen first, and don't touch my papers.", "You're the new girl? Good. The last one moved my GLASSES.", "Finally! The floor by the fridge. It's STICKY. Since Pesach."]), r.p.obj, 3.2);
        await rt.wait(1.2);
        if (!rt.disposed) rt.bubble(pick(["...yes! Cleaning! That's me. Love to clean.", "*grabs nothing, pretends to dust* Mm-hm. Very dusty."]), rt.lulu.obj, 2.4);
        rt.data.V.cleaner = true;
        emit("stat", { id: "homesCleaningLady", n: 1 });
        return true;
    },
    async dealIn(rt, r, scene) {
        rt.bubble(pick(["A FOURTH! Finally! SIT!", "Look who came! Do you play? Doesn't matter. SIT."]), r.p.obj, 2.6);
        toGuest(rt, "dealIn");
        await rt.wait(1.0);
        if (!rt.disposed) rt.bubble("*loses three hands in a row* ...this game is RIGGED.", rt.lulu.obj, 2.6);
        return true;
    },
    async apprentice(rt, r) {
        rt.bubble(pick(["You're the helper? FINALLY. Hold the flashlight. Not on my FACE.", "Oh good, you're with Moti. He's under the sink. Bring him a coffee."]), r.p.obj, 3);
        toGuest(rt, "apprentice");
        return true;
    },
    async pact(rt, r) {
        r.friendly = true; r.meter = 0; r.state = "routine";
        rt.bubble(pick(["...you didn't see me. I didn't see you. Deal?", "*freezes, spoon in mouth* ...shh. SHH. We're both not here."]), r.p.obj, 3);
        await rt.wait(1.1);
        if (!rt.disposed) rt.bubble("...deal. 🤝", rt.lulu.obj, 1.8);
        return true;
    },
    async eat(rt, r, scene) {
        rt.bubble(pick(["Who are— never mind. You look HUNGRY. Sit! EAT!", "A guest! Why didn't you KNOCK? Sit, sit, there's plenty.", "You're too thin. Whoever you are. SIT."]), r.p.obj, 3);
        toGuest(rt, "eat");
        return true;
    },
    async shabbosGuest(rt, r) {
        rt.bubble(pick(["Gut Shabbos! ...the front door works too, you know. Sit, sit — there's room.", "A guest! Gut Shabbos! We'll squeeze in another chair."]), r.p.obj, 3.2);
        toGuest(rt, "shabbos");
        return true;
    },
    async sleepy(rt, r) {
        r.meter = 0; r.state = "routine"; r.sleep = true;
        rt.bubble(pick(["*one eye opens* ...is it time for shalosh seudos? ...*zzz*", "*mumbles* ...five more minutes... *snore*"]), r.p.obj, 2.8);
        return true;
    },
    async caterer(rt, r) {
        rt.bubble(pick(["FINALLY, the caterer! The salads go THERE. Go!", "You're from the caterer? Straighten the centrepieces. ALL of them."]), r.p.obj, 3);
        toGuest(rt, "caterer");
        return true;
    },
    async toothbrush(rt, r) {
        rt.bubble(pick(["You! You're here to HELP? Wonderful. Here's a toothbrush. The grout. GO.", "A volunteer! Take a toothbrush — every crumb, sheifele, EVERY crumb."]), r.p.obj, 3.2);
        toGuest(rt, "toothbrush");
        const tb = heldProp(rt, "toothbrush"); if (tb) rt.luluHold(tb, { y: -0.42, z: 0.02 });
        return true;
    },
    async honour(rt, r) {
        rt.bubble("A guest! You get a snip! It's a segulah — for SOMETHING!", r.p.obj, 3);
        toGuest(rt, "honour");
        rt.luluPose = { cheer: true };
        rt.timers.push({ once: true, t: 1.2, gate: false, fn: () => { rt.luluPose = null; } });
        return true;
    },
};
/** Which catch applies when resident r would raise the alarm (null = the alarm, as always). */
export function catchFor(V, r) {
    if (V.noCatch || V.mode === "guest" || V.alarm || r.friendly || r.K.animal || r.kind === "baby") return null;
    const sc = V.scene && V.scene.def;
    const c = sc && linesFor(sc.caught, r.kind);
    if (c && CATCH[c]) return c;
    if (r.kind === "zeidy") return "cleaning";
    if ((r.kind === "boy" || r.kind === "girl") && V.catchRoll < 0.45) return "play";
    return null;
}
