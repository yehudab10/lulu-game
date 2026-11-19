// features/town — BUILD: turns the current plan + the town's data (towns/<id>.js) into one
// scene graph, built when Lulu takes the exit and disposed when she leaves. Static stuff
// goes through the kit's Merger (a few meshes per 60 m cluster) and the sign atlas (one
// mesh); the only per-object meshes are the things that move (crane jibs, coins, glows,
// the B/Q's trains).
//
// Everything reads the plan's per-street widths (st.curb / outer / walk / front / park), so a
// wide avenue, a boulevard with malls + service roads, a one-way East street and a DIAGONAL
// (Kings Highway) all build from the same code; a 4-sided block next to the diagonal is laid
// out along its slanted face. Landmarks that aren't block faces live next door: rail.js (an
// embankment railway, its bridges, stations and trains) and landmarks.js (the boulevard's
// malls, frontage strips, a college quad, the skyline around a city town, barricades).
//
// Returns T = { root, colliders + near(x, z), coins, lamps, cranes, stops, bumps, spots, jam, … dispose() }.
import * as THREE from "three";
import { models, findNodes } from "../../models.js";
import { worldMaterials, canvasTex } from "../../world.js";
import { Merger, Atlas, lookMaterials } from "./kit.js";
import { PL, LANE, WALK, FRONT, street, streetPoint, streetCoords, nodeAlong, blockPoly, rng, cutAt, otherAt, stopsAt } from "./plan.js";
import { buildRail, RAIL_MODELS } from "./rail.js";
import { buildBoulevards, buildStrip, buildSkyline, buildBarricades, wholeBlock, LANDMARK_MODELS } from "./landmarks.js";

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const mtx = (x, z, rot, sc = 1, y = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, rot), _s.setScalar(sc));

const SIDING = ["#E9DCC7", "#DADFE3", "#F5F2EA", "#EFE3B8", "#C9D6C3", "#C8D8E6", "#E3CFC1", "#D9D4CC"];
const ROOFS = ["#5D6D7E", "#4E4E58", "#6D5E52", "#3E4A57", "#7A6A5F"];
const TOWN_WALLS = ["#D7CCC8", "#ECE5D8", "#CFC8BC", "#F2EEE6", "#BFB7AC"];
const SHOP_WALLS = ["#F2D7B6", "#E8C9C0", "#D6E4E0", "#F3E6C4", "#E1D5E7", "#D9E2EC"];
const AWNINGS = ["#2E7D32", "#C62828", "#1A237E", "#6A1B9A", "#00695C", "#EF6C00", "#AD1457"];
const SILVER = ["#C3C8CE", "#BEC3C9", "#C8CCD1", "#B9BEC4"];
// Brooklyn: brick, stucco, limestone
const BRICK = ["#9C4A3C", "#A85A44", "#8E3F33", "#B5654F", "#7F4436", "#B97A5B"];
const STUCCO = ["#E8DCC4", "#DCCFB8", "#F1E7D3", "#CFC2AA", "#E6D3C3", "#D8D2C6"];

// model key → { w (along the face), d (depth), prot (how far its front sticks out past the facade) }
const DIMS = {
    town_duplex: { w: 14, d: 10, prot: 1.6 },
    town_townhouses: { w: 16.5, d: 11, prot: 1.0 },
    town_shop: { w: 12, d: 13, prot: 1.5 },
    town_pizza: { w: 12, d: 13, prot: 1.5 },
    town_hall: { w: 34, d: 22, prot: 4.3 },
    town_yeshiva: { w: 30, d: 18, prot: 1.2 },
    town_frame: { w: 24, d: 11, prot: 6.1 },
    // Midwood
    town_mw_house: { w: 12.5, d: 15, prot: 2.2 },
    town_mw_rowhouse: { w: 15.6, d: 11, prot: 1.8 },
    town_mw_apts: { w: 24, d: 16, prot: 1.4 },
    town_mw_store: { w: 10, d: 13, prot: 1.5 },
    town_mw_bakery: { w: 10, d: 13, prot: 1.5 },
    town_mw_carbase: { w: 14, d: 12, prot: 6.5 },
    town_mw_shul: { w: 18, d: 18, prot: 2.4 },
};
/** Which sign list a store face reads (and its sign style). */
const STORE_STYLE = {
    avej: { bg: "#FBF8F0", fg: ["#1A237E", "#6D4C41"] },
    avem: { bg: "#FFFDE7", fg: ["#2E7D32", "#5D4037"] },
    kh: { bg: "#FFFFFF", fg: ["#C62828", "#1565C0"] },
    cia: { bg: "#FFD54F", fg: ["#1B1B1B", "#B71C1C"] },
};

/** The models a town build needs (load them first). Lakewood's set (a town with def.models lists its own). */
export const BUILD_MODELS = ["town_duplex", "town_townhouses", "town_shop", "town_pizza", "town_hall", "town_yeshiva", "town_frame", "town_crane",
    "town_minivan", "town_minivan_lod", "town_lamp", "town_stop", "town_chair", "town_welcome", "town_billboard", "town_circle", "town_reeds", "roadevents_school_bus", "foot_bus",
    "treeRound", "treePine"];
export { RAIL_MODELS, LANDMARK_MODELS };

export function buildTown(def) {
    const R = rng(def.seed || 91);
    const S = def.lines.SIGNS;
    const O = PL.ORIGIN;
    const root = new THREE.Group();
    root.name = "Town:" + def.id;
    root.position.set(O.x, 0, O.z);
    const own = [];                     // geometries / materials / textures to dispose
    const mats = lookMaterials();
    own.push(...Object.values(mats));
    const merge = new Merger(def.cell || 60);       // (a bigger town can use bigger clusters: fewer draw calls)
    const mergeFar = new Merger(150);     // the skyline: big cells, few draw calls
    const atlas = new Atlas(2048);
    const colliders = [];
    const T = { def, root, colliders, coins: [], lamps: [], cranes: [], spots: {}, stops: [], bumps: [], jam: [], signs: atlas, mats, own, parked: [], pcars: [], trains: [], anims: [] };

    const col = (lx, lz, r, kind = "town") => colliders.push({ x: O.x + lx, z: O.z + lz, r, kind });
    const sign = (spec, x, y, z, yaw, w, h, twoSided = false) => {
        const uv = atlas.sign(spec);
        atlas.quad(uv, x, y, z, yaw, w, h);
        if (twoSided) atlas.quad(uv, x - Math.sin(yaw) * 0.02, y, z - Math.cos(yaw) * 0.02, yaw + Math.PI, w, h);
        return uv;
    };
    const anchorOf = (key, name = "Anchor_sign") => {
        const m = models[key];
        if (!m) return null;
        const A = m.userData.townAnchors || (m.userData.townAnchors = {});
        if (A[name] !== undefined) return A[name];
        m.updateMatrixWorld(true);
        const n = findNodes(m, name)[0];
        return (A[name] = n ? n.getWorldPosition(new THREE.Vector3()).sub(m.getWorldPosition(new THREE.Vector3())) : null);
    };
    /** Place a model (local coords) into the merge. */
    const place = (key, x, z, rot, tints = null, opts = {}) => {
        const m = models[key];
        if (!m) return null;
        const M = mtx(x, z, rot, opts.scale || 1, opts.y || 0);
        merge.add(m, M, tints, opts);
        return M;
    };
    /** Local point of a model's anchor for a placement at (x, z, rot). */
    const anchorAt = (key, x, z, rot, name) => {
        const a = anchorOf(key, name);
        if (!a) return null;
        const c = Math.cos(rot), s = Math.sin(rot);
        return { x: x + a.x * c + a.z * s, y: a.y, z: z - a.x * s + a.z * c };
    };
    /** A parked car: a light LOD model, no shadow of its own, a soft dark patch under it instead.
     *  (Lakewood: always the silver minivan; a town's def.parked mixes models + paints.) */
    const PARKED = def.parked || [{ key: "town_minivan_lod", w: 1, paints: SILVER }];
    const PW = PARKED.reduce((a, p) => a + (p.w || 1), 0);
    // Every parked car is SOLID (two collider circles) and tagged (kit.js): parked.js can lift one out of the merged
    // cluster — a nudge when she bumps it, a real car she can hotwire on foot — and put it back. → T.pcars entry
    const parkedCar = (x, z, rot) => {
        let P = PARKED[0];
        if (PARKED.length > 1) { let r = R() * PW; for (const p of PARKED) { r -= p.w || 1; if (r <= 0) { P = p; break; } } }
        const paint = pickOf(P.paints || SILVER, R), tag = {};
        place(P.key, x, z, rot, { Paint: paint }, { noShadow: true, tag });
        const sedan = /sedan/.test(P.key);
        const b = new THREE.PlaneGeometry(sedan ? 2.1 : 2.3, sedan ? 4.8 : 5.4); b.rotateX(-Math.PI / 2); b.rotateY(rot); b.translate(x, 0.05, z);
        b.userData.tag = tag;
        addColored(merge, b, "#4a4c50", x, z, "flat");
        const fx = Math.sin(rot), fz = Math.cos(rot), off = sedan ? 1.15 : 1.25;
        const cols = [1, -1].map(k => ({ x: O.x + x + fx * off * k, z: O.z + z + fz * off * k, r: sedan ? 0.95 : 1.0, kind: "car" }));
        colliders.push(...cols);
        const pc = { x, z, rot, key: P.key, paint, tag, cols, off, sedan };
        T.pcars.push(pc);
        return pc;
    };
    const pt = (name, along, d) => { const st = street(name); return st ? streetPoint(st, along, d, {}) : null; };
    const clearAt = (st, u, side) => (def.clearParking || []).some(c => c.street === st.name && u >= c.from && u <= c.to && (c.side == null || c.side === side));

    // ── ground: asphalt, markings, sidewalks, curbs ──────────────────────
    const asphalt = [], walks = [], marks = [];
    /** A strip of street st between along u0 → u1 and lateral d0 → d1 (the far edge's alongs can differ: a slanted end). */
    const strip = (list, st, u0, u1, d0, d1, y, color, u0b = u0, u1b = u1) => {
        if (st.axis !== "diag" && u0 === u0b && u1 === u1b) {
            const a = streetPoint(st, u0, d0, {}), b = streetPoint(st, u1, d1, {});
            list.push({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), y, color });
        } else {
            const P = (u, d) => { const p = streetPoint(st, u, d, {}); return [p.x, p.z]; };
            list.push({ pts: [P(u0, d0), P(u1, d0), P(u1b, d1), P(u0b, d1)], y, color });
        }
    };
    /** The along where a stretch of st ends at node n (on the side `dir` points away from), at lateral d,
     *  `w` past the cross street's centre line. (A dead end: the street's own end.) */
    const stretchEnd = (st, c, towardNode, d, w) => c ? cutAt(st, c.node, towardNode, d, w(otherAt(c.node, st.id))) : null;
    for (const st of PL.STREETS) {
        const { a0, a1 } = st;
        strip(asphalt, st, a0, a1, -st.curb, st.curb, 0.03);
        // stretches between crossings (and out to the street's ends)
        const cr = st.cross, n = cr.length;
        for (let k = 0; k <= n; k++) {
            const c0 = k > 0 ? cr[k - 1] : null, c1 = k < n ? cr[k] : null;
            if (c0 && c1 === null && c0.a >= a1 - 1) continue;
            if (c1 && c0 === null && c1.a <= a0 + 1) continue;
            for (const side of [-1, 1]) {
                const dA = side * st.outer, dB = side * st.walk;
                const uA0 = c0 ? stretchEnd(st, c0, -1, dA, o => o.outer) : a0, uB0 = c0 ? stretchEnd(st, c0, -1, dB, o => o.outer) : a0;
                const uA1 = c1 ? stretchEnd(st, c1, 1, dA, o => o.outer) : a1, uB1 = c1 ? stretchEnd(st, c1, 1, dB, o => o.outer) : a1;
                if (uA1 - uA0 < 1 || uB1 - uB0 < 1) continue;
                strip(walks, st, uA0, uA1, dA, dB, 0.045, null, uB0, uB1);
                const mid = (uA0 + uA1) / 2, len = uA1 - uA0;
                const cp = streetPoint(st, mid, side * (st.outer + 0.08), {});
                const g = new THREE.BoxGeometry(0.18, 0.12, len); g.rotateY(st.h);
                g.translate(cp.x, 0.06, cp.z);
                addColored(merge, g, "#B8B4AC", cp.x, cp.z, "flat");
            }
            // lane lines: a double yellow down the middle (not on a one-way), white at the parking lanes, dashed between two lanes
            const lines = [];
            if (!st.oneway) lines.push([-0.14, 0.11, "#F2C230"], [0.14, 0.11, "#F2C230"]);
            if (st.lanes > 1) lines.push([-3.5, 0.1, "#E8E8E2", true], [3.5, 0.1, "#E8E8E2", true]);
            if (st.parkLane) lines.push([-3.5 * st.lanes, 0.09, "#E8E8E2"], [3.5 * st.lanes, 0.09, "#E8E8E2"]);
            if (st.boulevard) lines.push([-(st.svcIn + 3.5), 0.09, "#E8E8E2"], [st.svcIn + 3.5, 0.09, "#E8E8E2"]);
            for (const [off, w, color, dash] of lines) {
                const m0 = c0 ? stretchEnd(st, c0, -1, off, o => o.outer + 3.9) : a0, m1 = c1 ? stretchEnd(st, c1, 1, off, o => o.outer + 3.9) : a1;
                if (m1 - m0 <= 2) continue;
                if (!dash) laneLine(marks, st, m0, m1, off, w, color, strip);
                else for (let u = m0; u < m1 - 1; u += 6) laneLine(marks, st, u, Math.min(m1, u + 3), off, w, color, strip);
            }
        }
    }
    // the boulevard's malls + service roads, frontage strips, the skyline (landmarks.js) — they add to these lists
    const B = { def, R, T, S, O, root, own, merge, mergeFar, atlas, mats, colliders, col, sign, place, anchorAt, anchorOf, parkedCar, pt, strip, asphalt, walks, marks,
        addColored, poleAt, pickOf, layoutFace, placeFace, DIMS, BRICK, STUCCO, clearAt };
    buildBoulevards(B);
    let circleGeo = null;
    if (PL.circle) {
        circleGeo = new THREE.CircleGeometry(15, 40);
        circleGeo.rotateX(-Math.PI / 2);
        circleGeo.translate(PL.circle.x, 0.034, PL.circle.z);
    }
    // crosswalks, stop bars (a stop sign at every approach but the circle's and a priority road's)
    for (const n of PL.NODES) {
        for (const sid of [n.ns, n.ew]) {
            const st = PL.STREETS[sid], cs = otherAt(n, sid), na = nodeAlong(st, n);
            for (const dir of [-1, 1]) {
                const along = cutAt(st, n, dir, dir * LANE, cs.outer + 2);
                if (along < st.a0 || along > st.a1) continue;
                const kmax = Math.floor((st.curb - 0.8) / 1.2 + 1e-9);
                for (let k = -kmax; k <= kmax; k++) {
                    const zc = cutAt(st, n, dir, k * 1.2, cs.outer + 1.6);
                    strip(marks, st, zc - 1.1, zc + 1.1, k * 1.2 - 0.3, k * 1.2 + 0.3, 0.04, "#F2F2EE");
                }
                if (!stopsAt(st, n) || (st.oneway && dir !== st.oneway)) continue;
                const dA = dir * 0.4, dB = dir * (st.curb - 0.2);
                const uA = cutAt(st, n, dir, dA, cs.outer + 2), uB = cutAt(st, n, dir, dB, cs.outer + 2);
                strip(marks, st, uA - 0.25, uA + 0.25, dA, dB, 0.041, "#F2F2EE", uB - 0.25, uB + 0.25);
                T.stops.push({ street: st.id, dir, along, node: n, na });
            }
        }
    }
    // speed bumps
    for (const b of def.bumps || []) {
        const st = street(b.street);
        if (!st) continue;
        const half = Math.round(st.curb / 1.1);
        for (let u = st.a0 + 12; u < st.a1 - 10; u += b.every) {
            if (st.cross.some(c => Math.abs(c.a - u) < 13)) continue;
            T.bumps.push({ street: st.id, along: u });
            const p = streetPoint(st, u, 0, {});
            for (let s = -half; s < half; s++) {
                const g = new THREE.BoxGeometry(1.1, 0.1, 0.7); g.rotateY(st.h);
                const q = streetPoint(st, u, (s + 0.5) * 1.1, {});
                g.translate(q.x, 0.05, q.z);
                addColored(merge, g, s % 2 ? "#F9C623" : "#2B2B2B", p.x, p.z);
            }
        }
    }

    // ── ground meshes ────────────────────────────────────────────────────
    const asphaltTex = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#5f636b"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 4200; i++) { g.fillStyle = ["#686c74", "#55595f", "#71757d", "#4e5258"][i % 4]; const r = Math.random() * 2 + 0.5; g.fillRect(Math.random() * w, Math.random() * h, r, r); }
        g.strokeStyle = "rgba(30,30,34,0.25)"; g.lineWidth = 1.5;   // patched cracks
        for (let i = 0; i < 6; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    });
    const walkTex = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = "#c9c4ba"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) { g.fillStyle = i % 2 ? "#d2cdc3" : "#bfbab0"; g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
        g.fillStyle = "#a9a49a"; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
    });
    own.push(asphaltTex, walkTex);
    const asphaltMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.93, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const walkMat = new THREE.MeshStandardMaterial({ map: walkTex, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    own.push(asphaltMat, walkMat, markMat);

    // ── blocks: buildings along every face, solid behind a ring of colliders ──
    const counters = {};
    for (const b of PL.BLOCKS) {
        const lot = blockPoly(b);
        if (b.solid) {
            const step = 2.1, rad = 1.25;
            if (!b.quad) {
                const c = blockPoly(b, 1.4), x0 = c[0][0], x1 = c[1][0], z0 = c[0][1], z1 = c[2][1];
                for (let x = x0; x <= x1 + 0.01; x += step) { col(x, z0, rad, "house"); col(x, z1, rad, "house"); }
                for (let z = z0 + step; z < z1; z += step) { col(x0, z, rad, "house"); col(x1, z, rad, "house"); }
            } else {
                const c = blockPoly(b, 1.4);
                for (let i = 0; i < 4; i++) {
                    const a = c[i], e = c[(i + 1) % 4], L = Math.hypot(e[0] - a[0], e[1] - a[1]);
                    for (let u = 0; u < L; u += step) col(a[0] + (e[0] - a[0]) * u / L, a[1] + (e[1] - a[1]) * u / L, rad, "house");
                }
            }
        }
        if (b.whole && wholeBlock(B, b, lot)) continue;
        for (const [face, kind] of Object.entries(b.faces)) {
            for (const fr of railSplit(faceFrame(lot, face), def.rail)) placeFace(B, kind, fr, counters);
        }
    }
    for (const sp of PL.STRIPS) buildStrip(B, sp, counters);

    // ── street furniture: parked cars, lamps ─────────────────────────────
    const chair = def.chair && street(def.chair.street);
    const parkSkip = 1 - (def.parkRate != null ? def.parkRate : 0.58);
    function lampAt(x, z, rot) {
        place("town_lamp", x, z, rot, null, { noShadow: true });
        col(x, z, 0.22, "pole");
        const fx = Math.sin(rot), fz = Math.cos(rot);
        T.lamps.push({ x: x + fx * 2.0, y: 6.2, z: z + fz * 2.0, gx: x + fx * 3.6, gz: z + fz * 3.6 });
    }
    for (const st of PL.STREETS) {
        const lanesPark = [];
        if (st.parkLane) lanesPark.push(st.park);
        if (st.boulevard) lanesPark.push(st.svcPark);
        for (let k = 0; k < st.cross.length - 1; k++) {
            const n0 = st.cross[k].node, n1 = st.cross[k + 1].node;
            for (const side of [-1, 1]) for (const pd of lanesPark) {
                const u0 = cutAt(st, n0, -1, side * pd, otherAt(n0, st.id).outer + 8.4), u1 = cutAt(st, n1, 1, side * pd, otherAt(n1, st.id).outer + 8.4);
                if (u1 - u0 < 6) continue;
                for (let u = u0; u < u1; u += 6.6) {
                    if (clearAt(st, u, side)) continue;
                    if (chair === st && side === def.chair.side && Math.abs(u - def.chair.along) < 4) {
                        // THE one free spot in town… and a lawn chair is saving it
                        const c = streetPoint(st, u, side * pd, {}), w = streetPoint(st, u + 1.6, side * (pd + 2.6), {});
                        place("town_chair", c.x, c.z, st.h + Math.PI / 2, null, { scale: 1.15 });
                        col(c.x, c.z, 0.45, "chair");
                        T.spots.chair = { x: w.x, z: w.z, cx: c.x, cz: c.z, rot: st.h - side * Math.PI / 2, street: st.id, along: u };
                        continue;
                    }
                    if (R() < parkSkip) continue;
                    const p = streetPoint(st, u, side * pd, {});
                    const rot = st.h + (side > 0 ? 0 : Math.PI) + (R() - 0.5) * 0.05;
                    parkedCar(p.x, p.z, rot);
                    T.parked.push({ x: p.x, z: p.z, rot });
                }
            }
            const u0 = st.cross[k].a + 14, u1 = st.cross[k + 1].a - 14;
            if (u1 - u0 < 6) continue;
            const side = (st.id + k) % 2 ? 1 : -1;      // a lamp at mid-block, alternating sides
            const mid = (u0 + u1) / 2 + 6, lp = streetPoint(st, mid, side * (st.walk - 0.4), {}), lc = streetPoint(st, mid, 0, {});
            lampAt(lp.x, lp.z, Math.atan2(lc.x - lp.x, lc.z - lp.z));
        }
    }
    // stop signs (white STOP from the atlas), street blades (+ ONE WAY arrows) + a lamp at each corner
    const stopUV = atlas.sign({ key: "STOP", w: 256, h: 256, draw: (g, w, h) => {
        g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `800 ${h * 0.34}px Arial, sans-serif`; g.fillText("STOP", w / 2, h / 2 + 4, w * 0.86);
    } });
    for (const s of T.stops) {
        const st = PL.STREETS[s.street];
        const p = streetPoint(st, s.along - s.dir * 1.2, s.dir * (st.outer + 1.0), {});
        const face = st.h + (s.dir > 0 ? Math.PI : 0);     // faces the approaching driver
        place("town_stop", p.x, p.z, face, null, { noShadow: true });
        col(p.x, p.z, 0.14, "sign");
        const a = anchorAt("town_stop", p.x, p.z, face);
        if (a) atlas.quad(stopUV, a.x + Math.sin(face) * 0.035, a.y, a.z + Math.cos(face) * 0.035, face, 0.62, 0.62);
        s.x = p.x; s.z = p.z;
    }
    let oneWayCells = null;     // (made on first use: a town without one-ways keeps its atlas as it was)
    const oneWayUV = () => oneWayCells || (oneWayCells = [1, -1].map(pointing => atlas.sign({ key: "ONEWAY" + pointing, w: 512, h: 160, draw: (g, w, h) => {
        g.fillStyle = "#111111"; g.fillRect(4, 4, w - 8, h - 8);
        g.fillStyle = "#FFFFFF"; g.save(); g.translate(w / 2, h / 2); g.scale(pointing, 1);
        g.beginPath(); g.moveTo(-w * 0.44, -h * 0.17); g.lineTo(w * 0.2, -h * 0.17); g.lineTo(w * 0.2, -h * 0.36); g.lineTo(w * 0.45, 0); g.lineTo(w * 0.2, h * 0.36); g.lineTo(w * 0.2, h * 0.17); g.lineTo(-w * 0.44, h * 0.17); g.closePath(); g.fill();
        g.restore();
        g.fillStyle = "#111111"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${h * 0.26}px Arial, sans-serif`;
        g.fillText(S.oneWay || "ONE WAY", w / 2 - pointing * w * 0.07, h / 2 + 2);
    } })));
    for (const n of PL.NODES) {
        if (n.circle) continue;
        const A = PL.STREETS[n.ns], Bs = PL.STREETS[n.ew];
        // the corner between +A and +B (Lakewood: the NE corner, 7.4 m out each way)
        const sn = Math.abs(A.ux * Bs.uz - A.uz * Bs.ux) || 1;
        const x = n.x + Bs.ux * (A.outer + 1.8) / sn + A.ux * (Bs.outer + 1.8) / sn, z = n.z + Bs.uz * (A.outer + 1.8) / sn + A.uz * (Bs.outer + 1.8) / sn;
        poleAt(merge, x, z, 3.4);
        col(x, z, 0.12, "sign");
        sign({ lines: [A.name], bg: "#1E6B3C", fg: "#FFFFFF", w: 512, h: 96, radius: 8 }, x, 3.2, z, A.h + Math.PI / 2, 1.7, 0.32, true);
        sign({ lines: [Bs.name], bg: "#1E6B3C", fg: "#FFFFFF", w: 512, h: 96, radius: 8 }, x, 3.55, z, Bs.h - Math.PI / 2, 1.7, 0.32, true);
        // a ONE WAY arrow under the blade of a one-way street (one cell per face, so it points the right way from both sides)
        for (const [st, y] of [[A, 2.72], [Bs, 2.42]]) {
            if (!st.oneway) continue;
            const yaw = st.h + Math.PI / 2;     // the plate's +x runs along -u… so the arrow drawn pointing "−x" points along +u
            atlas.quad(oneWayUV()[st.oneway > 0 ? 1 : 0], x + Math.sin(yaw) * 0.03, y, z + Math.cos(yaw) * 0.03, yaw, 1.05, 0.33);
            atlas.quad(oneWayUV()[st.oneway > 0 ? 0 : 1], x - Math.sin(yaw) * 0.03, y, z - Math.cos(yaw) * 0.03, yaw + Math.PI, 1.05, 0.33);
        }
        const lx = n.x - Bs.ux * (A.outer + 2) / sn - A.ux * (Bs.outer + 2) / sn, lz = n.z - Bs.uz * (A.outer + 2) / sn - A.uz * (Bs.outer + 2) / sn;
        lampAt(lx, lz, Math.atan2(n.x - lx, n.z - lz));
    }

    // ── the traffic circle: the island, its statue, YIELD — lol ───────────
    if (PL.circle) {
        const C = PL.circle, cx = C.x, cz = C.z;
        place("town_circle", cx, cz, 0);
        col(cx, cz, C.r, "island");
        if (C.statue) {
            const tint = C.statueTint;
            place(C.statue, cx, cz, Math.PI / 4, { Paint: tint, Glass: tint, GlassTint: tint, CarSeat: tint, CarSeatB: tint, DarkTrim: tint, Tire: tint, Rim: tint, Headlight: tint, Taillight: tint }, { y: 2.03, scale: 1.15 });
        }
        if (S.plaque) sign({ lines: S.plaque, bg: "#5D4A2A", fg: "#F3E1A0", w: 512, h: 220 }, cx, 1.2, cz - 2.88, Math.PI, 1.35, 0.58);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ax = cx + dx * 17 + dz * 7, az = cz + dz * 17 - dx * 7, face = Math.atan2(dx, dz);
            poleAt(merge, ax, az, 2.2);
            col(ax, az, 0.12, "sign");
            sign({ key: "yield", w: 256, h: 256, draw: (g, w, h) => {
                g.fillStyle = "#C62828"; g.beginPath(); g.moveTo(w / 2, h - 8); g.lineTo(8, 14); g.lineTo(w - 8, 14); g.closePath(); g.fill();
                g.fillStyle = "#FFFFFF"; g.beginPath(); g.moveTo(w / 2, h - 52); g.lineTo(46, 38); g.lineTo(w - 46, 38); g.closePath(); g.fill();
                g.fillStyle = "#C62828"; g.textAlign = "center"; g.font = `800 ${h * 0.15}px Arial, sans-serif`; g.fillText((S.yield || ["YIELD"])[0], w / 2, h * 0.36);
                g.font = `700 ${h * 0.13}px Arial, sans-serif`; g.fillText((S.yield || [])[1] || "", w / 2, h * 0.53);
            } }, ax, 2.55, az, face, 1.0, 1.0);
        }
    }

    // ── jams, the band bus, billboards, the welcome sign, signs, woods, water ──
    for (const j of def.jams || []) {
        const st = street(j.street);
        if (!st) continue;
        const jam = [];
        for (let u = j.from; u < j.to; u += j.gap || 6.2) {
            if (st.cross.some(c => Math.abs(c.a - u) < 9)) continue;      // the cross streets stay (barely) open
            const p = streetPoint(st, u, j.d, {});
            const rot = st.h + (j.d > 0 ? 0 : Math.PI) + (R() - 0.5) * 0.12;
            parkedCar(p.x, p.z, rot);
            jam.push({ x: p.x, z: p.z });
        }
        if (j.kind && jam.length) T.spots[j.kind] = Object.assign({}, jam[Math.floor(jam.length / 2)], { street: st.id, d: j.d });
        else T.jam.push(...jam);
    }
    if (T.jam.length && !T.spots.jam) T.spots.jam = T.jam[0];
    if (def.bandBus && models[def.bandBus.model]) {
        const Bb = def.bandBus, st = street(Bb.street), p = streetPoint(st, Bb.along, Bb.d, {});
        place(Bb.model, p.x, p.z, st.h + (Bb.dir < 0 ? Math.PI : 0), Bb.colors);
        for (const o of [-3.6, -1.2, 1.2, 3.6]) { const q = streetPoint(st, Bb.along + o, Bb.d, {}); col(q.x, q.z, 1.3, "car"); }
        if (Bb.lines) {
            // the sign hangs on the bus's street side, facing the traffic going by
            const sd = Bb.d < 0 ? -1 : 1, s2 = streetPoint(st, Bb.along, Bb.d - sd * 1.3, {});
            sign({ lines: Bb.lines, bg: Bb.bg || "#4A148C", fg: Bb.fg || ["#FFD54F", "#F3E5F5"], w: 1024, h: 200 }, s2.x, 1.9, s2.z, st.h + sd * Math.PI / 2, 6.4, 1.2);
        }
        T.spots.band = { x: p.x, z: p.z };
    }
    for (const bb of def.billboards || []) {
        place("town_billboard", bb.x, bb.z, bb.rot);
        col(bb.x + Math.cos(bb.rot) * 3, bb.z - Math.sin(bb.rot) * 3, 0.3, "sign"); col(bb.x - Math.cos(bb.rot) * 3, bb.z + Math.sin(bb.rot) * 3, 0.3, "sign");
        const a = anchorAt("town_billboard", bb.x, bb.z, bb.rot);
        if (a) sign({ lines: bb.lines, bg: "#FFF8E1", fg: ["#1A237E", "#C62828", "#37474F"], w: 1024, h: 480, radius: 6 }, a.x + Math.sin(bb.rot) * 0.03, a.y, a.z + Math.cos(bb.rot) * 0.03, bb.rot, 9.6, 4.3);
    }
    if (def.welcome) {
        const w = def.welcome, p = pt(w.street, w.along, w.d);
        place("town_welcome", p.x, p.z, w.rot);
        for (const o of [-2.6, 0, 2.6]) col(p.x + Math.cos(w.rot) * o, p.z - Math.sin(w.rot) * o, 0.8, "sign");
        const a = anchorAt("town_welcome", p.x, p.z, w.rot);
        if (a) sign({ lines: w.lines, bg: "#1F5E3B", fg: ["#FFFFFF", "#FFE082", "#C8E6C9"], w: 1024, h: 440, radius: 12, border: "#E8D9A8" }, a.x + Math.sin(w.rot) * 0.02, a.y, a.z + Math.cos(w.rot) * 0.02, w.rot, 5.1, 2.15);
        T.spots.welcome = { x: p.x, z: p.z, rot: w.rot };
    }
    const aspUV = () => atlas.sign({ key: "ASP", w: 360, h: 300, draw: (g, w, h) => {
        // the broom-P: no parking during street cleaning
        g.fillStyle = "#FFFFFF"; g.fillRect(3, 3, w - 6, h - 6);
        g.strokeStyle = "#C62828"; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
        g.fillStyle = "#C62828"; g.font = `800 ${h * 0.46}px Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("P", w * 0.27, h * 0.36);
        g.strokeStyle = "#C62828"; g.lineWidth = 9; g.beginPath(); g.moveTo(w * 0.08, h * 0.64); g.lineTo(w * 0.46, h * 0.08); g.stroke();
        g.fillStyle = "#6D4C41"; g.save(); g.translate(w * 0.43, h * 0.13); g.rotate(-0.98); g.fillRect(-4, -16, 30, 32); g.restore();
        g.fillStyle = "#111111"; g.textAlign = "left"; g.font = `700 ${h * 0.12}px Arial, sans-serif`;
        const L = S.asp || ["8:30–10 AM", "TUES & FRI", "(Yes, You.)"];
        g.fillText(L[0], w * 0.52, h * 0.2, w * 0.45); g.fillText(L[1], w * 0.52, h * 0.38, w * 0.45);
        g.fillStyle = "#C62828"; g.font = `italic 700 ${h * 0.11}px Arial, sans-serif`; g.textAlign = "center"; g.fillText(L[2] || "", w / 2, h * 0.82, w * 0.9);
    } });
    for (const sg of def.signs || []) {
        const p = pt(sg.street, sg.along, sg.d);
        if (!p) continue;
        if (sg.kind === "green") {
            const w = sg.w || 2.6;
            poleAt(merge, p.x - Math.cos(sg.rot) * w * 0.32, p.z + Math.sin(sg.rot) * w * 0.32, 2.3);
            poleAt(merge, p.x + Math.cos(sg.rot) * w * 0.32, p.z - Math.sin(sg.rot) * w * 0.32, 2.3);
            col(p.x, p.z, 0.3, "sign");
            sign({ lines: sg.lines, bg: "#1F7A46", fg: "#FFFFFF", w: 768, h: 300, border: "#FFFFFF" }, p.x, 2.65, p.z, sg.rot, w, w * 0.39, true);
        } else if (sg.kind === "asp") {
            poleAt(merge, p.x, p.z, 2.6);
            col(p.x, p.z, 0.1, "sign");
            atlas.quad(aspUV(), p.x + Math.sin(sg.rot) * 0.03, 2.3, p.z + Math.cos(sg.rot) * 0.03, sg.rot, 0.6, 0.5);
            atlas.quad(aspUV(), p.x - Math.sin(sg.rot) * 0.03, 2.3, p.z - Math.cos(sg.rot) * 0.03, sg.rot + Math.PI, 0.6, 0.5);
        } else {
            poleAt(merge, p.x, p.z, 1.9 + sg.h * 0.5);
            col(p.x, p.z, 0.12, "sign");
            sign({ lines: sg.lines, bg: sg.bg, fg: sg.fg, border: sg.border, w: Math.round(sg.w * 360), h: Math.round(sg.h * 360) },
                p.x + Math.sin(sg.rot) * 0.04, 2.0 + sg.h * 0.5, p.z + Math.cos(sg.rot) * 0.04, sg.rot, sg.w, sg.h, true);
        }
    }
    for (const [x0, z0, x1, z1, gap] of def.woods || []) {
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(len / gap));
        let nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
        // the second row goes AWAY from the streets (a line's normal depends on which way it was drawn)
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        if (streetGap(mx + nx * 5, mz + nz * 5) < streetGap(mx - nx * 5, mz - nz * 5)) { nx = -nx; nz = -nz; }
        for (let k = 0; k <= n; k++) {
            const t = k / n;
            for (const off of k % 3 ? [0] : [0, 6]) {
                const x = x0 + (x1 - x0) * t + nx * off + (R() - 0.5) * 2, z = z0 + (z1 - z0) * t + nz * off + (R() - 0.5) * 2;
                place(R() < 0.55 ? "treePine" : "treeRound", x, z, R() * 6.28, { Leaves: leaf(R), PineLeaves: R() < 0.5 ? "#2F8F46" : "#3C7D4A" }, { scale: 1.1 + R() * 0.5, noShadow: true });
                if (off === 0) col(x, z, 1.4, "tree");
            }
        }
    }
    for (const W of def.water || []) {
        const { x0, x1, z0, z1 } = W;
        const waterTex = canvasTex(256, 256, (g, w, h) => {
            g.fillStyle = "#4B9CC4"; g.fillRect(0, 0, w, h);
            g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 2;
            for (let i = 0; i < 40; i++) { const x = Math.random() * w, y = Math.random() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 4, x + 20, y); g.stroke(); }
        });
        waterTex.repeat.set((x1 - x0) / 18, (z1 - z0) / 18);
        const wm = new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.15, metalness: 0.1 });
        const wg = new THREE.PlaneGeometry(x1 - x0, z1 - z0); wg.rotateX(-Math.PI / 2); wg.translate((x0 + x1) / 2 + 4, 0.02, (z0 + z1) / 2);
        own.push(waterTex, wm, wg);
        const water = new THREE.Mesh(wg, wm);
        water.receiveShadow = true; water.matrixAutoUpdate = false;
        root.add(water);
        (T.waters || (T.waters = [])).push(water);
        const sg = new THREE.PlaneGeometry(10, z1 - z0); sg.rotateX(-Math.PI / 2); sg.translate(x0 + 1, 0.025, (z0 + z1) / 2);
        addColored(merge, sg, "#E3D3A6", x0, (z0 + z1) / 2, "flat");
        for (let z = z0 + 6; z < z1 - 4; z += 2.4) col(x0 + 4.2, z, 1.4, "lake");
        for (let k = 0; k < 16; k++) place("town_reeds", x0 + 3 + R() * 3, z0 + 10 + R() * (z1 - z0 - 20), R() * 6, null, { scale: 0.8 + R() * 0.6 });
        if (W.geese) T.spots.lake = { x: x0 - 1.5, z: (z0 + z1) / 2, z0: z0 + 20, z1: z1 - 30, x0 };
    }
    // the railway on its embankment, the skyline, the barricades (rail.js / landmarks.js)
    if (def.rail) buildRail(B);
    buildSkyline(B);
    buildBarricades(B);

    // ── coins (a few trails to make the detour pay) ──────────────────────
    for (const ct of def.coins || []) {
        const st = street(ct.street);
        if (!st) continue;
        for (let k = 0; k < ct.n; k++) {
            const u = ct.from + k * 6, p = streetPoint(st, u, ct.d, {});
            T.coins.push({ x: O.x + p.x, z: O.z + p.z, s: st.base + u, d: ct.d, taken: false, value: 1 });
        }
    }
    if (PL.circle) for (let k = 0; k < 10; k++) {    // a ring of risky coins round the island (nobody yields)
        const a = k / 10 * Math.PI * 2;
        T.coins.push({ x: O.x + PL.circle.x + Math.cos(a) * PL.circle.ring, z: O.z + PL.circle.z + Math.sin(a) * PL.circle.ring, s: 0, d: 0, taken: false, value: 2 });
    }

    // ── ground meshes (after the landmarks added their pieces) ───────────
    const ag = quadsGeo(asphalt, 9);
    const asphaltMesh = new THREE.Mesh(circleGeo ? mergeTwo(ag, uvPlanar(circleGeo, 9)) : ag, asphaltMat);
    const walkMesh = new THREE.Mesh(quadsGeo(walks, 3), walkMat);
    const markMesh = new THREE.Mesh(quadsGeo(marks, 0, true), markMat);
    for (const m of [asphaltMesh, walkMesh, markMesh]) { m.receiveShadow = true; m.matrixAutoUpdate = false; root.add(m); own.push(m.geometry); }

    // ── bake ─────────────────────────────────────────────────────────────
    const merged = merge.build(mats).concat(mergeFar.build(mats));
    for (const m of merged) { root.add(m); own.push(m.geometry); }
    const signMesh = atlas.mesh();
    root.add(signMesh);
    own.push(signMesh.geometry, signMesh.material, signMesh.material.map);
    T.tris = merge.tris + mergeFar.tris;
    T.merged = merged.length;
    T.clusters = merged;

    // coins: one instanced mesh (world space)
    const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 18); coinGeo.rotateX(Math.PI / 2);
    T.coinMesh = new THREE.InstancedMesh(coinGeo, worldMaterials().coin, Math.max(1, T.coins.length));
    T.coinMesh.castShadow = true;
    T.coinMesh.frustumCulled = false;
    own.push(coinGeo, T.coinMesh);

    // night: lamp halos + pools of light (2 draw calls, hidden by day)
    const glowTex = canvasTex(64, 64, (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }, false);
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute("position", new THREE.Float32BufferAttribute(T.lamps.flatMap(l => [l.x, l.y - 0.1, l.z]), 3));
    const haloMat = new THREE.PointsMaterial({ map: glowTex, size: 3.2, sizeAttenuation: true, color: "#ffd99a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    T.halos = new THREE.Points(haloGeo, haloMat);
    T.halos.matrixAutoUpdate = false;
    T.halos.visible = false;
    root.add(T.halos);
    const poolGeo = new THREE.PlaneGeometry(1, 1); poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, color: "#ffe6b8", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    T.pools = new THREE.InstancedMesh(poolGeo, poolMat, Math.max(1, T.lamps.length));
    T.lamps.forEach((l, k) => T.pools.setMatrixAt(k, new THREE.Matrix4().compose(_p.set(l.gx, 0.06, l.gz), _q.identity(), _s.set(9, 1, 9))));
    T.pools.visible = false;
    root.add(T.pools);
    own.push(glowTex, haloGeo, haloMat, poolGeo, poolMat, T.pools);

    // ── colliders: a coarse grid so a lookup only returns what's near ─────
    const CELL = 24, grid = new Map();
    for (const c of colliders) {
        const m = c.r + 10;
        for (let gx = Math.floor((c.x - m) / CELL); gx <= Math.floor((c.x + m) / CELL); gx++)
            for (let gz = Math.floor((c.z - m) / CELL); gz <= Math.floor((c.z + m) / CELL); gz++) {
                const k = gx * 100000 + gz;
                let l = grid.get(k); if (!l) grid.set(k, l = []);
                l.push(c);
            }
    }
    const EMPTY = [];
    T.near = (x, z) => grid.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL)) || EMPTY;

    T.dispose = () => {
        if (root.parent) root.parent.remove(root);
        if (T.coinMesh.parent) T.coinMesh.parent.remove(T.coinMesh);
        for (const o of own) { try { o.dispose(); } catch (e) { /* already gone */ } }
        own.length = 0;
    };
    return T;
}

const pickOf = (list, R) => list[Math.floor(R() * list.length)];
/** Distance (local) from a point to the nearest street centre line. */
function streetGap(x, z) {
    let best = 1e9;
    const c = {};
    for (const st of PL.STREETS) {
        streetCoords(st, x, z, c);
        const a = Math.max(st.a0, Math.min(st.a1, c.along));
        best = Math.min(best, Math.hypot(c.along - a, c.d));
    }
    return best;
}
// ── helpers ──────────────────────────────────────────────────────────────
function leaf(R) { const L = ["#6CC24A", "#E8A33D", "#D9572B", "#C8B43A", "#7FB24A", "#B8452F"]; return L[Math.floor(R() * L.length)]; }

/** A coloured geometry (BoxGeometry, PlaneGeometry…) into the merger's solid look. */
function addColored(merge, g, hex, x, z, look = "solid") {
    const c = new THREE.Color(hex), n = g.attributes.position.count;
    const C = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(C, 3));
    g.deleteAttribute("uv");
    if (!g.index) { const idx = []; for (let i = 0; i < n; i++) idx.push(i); g.setIndex(idx); }
    merge.addGeometry(g, look, x, z);
}
function poleAt(merge, x, z, h) {
    const g = new THREE.CylinderGeometry(0.05, 0.05, h, 6);
    g.translate(x, h / 2, z);
    addColored(merge, g, "#9AA3AB", x, z, "flat");
}
function laneLine(list, st, u0, u1, d, w, color, strip) {
    strip(list, st, u0, u1, d - w / 2, d + w / 2, 0.036, color);
}
/** Flat quads → one geometry (planar UVs every `uvScale` m, or vertex colours). A quad is an axis-aligned
 *  {x0, z0, x1, z1} or any 4 corners {pts: [[x, z] ×4]} (a diagonal street's pieces). */
function quadsGeo(list, uvScale, colors = false) {
    const n = list.length;
    const P = new Float32Array(n * 12), N = new Float32Array(n * 12), U = new Float32Array(n * 8), C = colors ? new Float32Array(n * 12) : null, I = [];
    const c = new THREE.Color();
    list.forEach((q, k) => {
        let v = q.pts || [[q.x0, q.z0], [q.x0, q.z1], [q.x1, q.z1], [q.x1, q.z0]];
        if (q.pts) {
            // wind them so the face points up (the order the axis-aligned quads use)
            const [a, b, d] = [v[0], v[1], v[2]];
            if ((b[1] - a[1]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[1] - a[1]) < 0) v = [v[0], v[3], v[2], v[1]];
        }
        v.forEach(([x, z], i) => {
            P.set([x, q.y, z], k * 12 + i * 3);
            N.set([0, 1, 0], k * 12 + i * 3);
            if (uvScale) U.set([x / uvScale, z / uvScale], k * 8 + i * 2);
            if (C) { c.set(q.color); C.set([c.r, c.g, c.b], k * 12 + i * 3); }
        });
        I.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    if (C) g.setAttribute("color", new THREE.BufferAttribute(C, 3));
    g.setIndex(I);
    g.computeBoundingSphere();
    return g;
}
function uvPlanar(g, scale) {
    const p = g.attributes.position, U = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { U[i * 2] = p.getX(i) / scale; U[i * 2 + 1] = p.getZ(i) / scale; }
    g.setAttribute("uv", new THREE.BufferAttribute(U, 2));
    return g;
}
function mergeTwo(a, b) {
    // (both: position / normal / uv, indexed)
    const pa = a.attributes.position.count;
    const cat = (x, y, k) => { const o = new Float32Array(x.array.length + y.array.length); o.set(x.array); o.set(y.array, x.array.length); return new THREE.BufferAttribute(o, k); };
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", cat(a.attributes.position, b.attributes.position, 3));
    g.setAttribute("normal", cat(a.attributes.normal, b.attributes.normal, 3));
    g.setAttribute("uv", cat(a.attributes.uv, b.attributes.uv, 2));
    const ia = Array.from(a.index.array), ib = Array.from(b.index.array).map(i => i + pa);
    g.setIndex(ia.concat(ib));
    g.computeBoundingSphere();
    a.dispose(); b.dispose();
    return g;
}

/** A block face as a frame: origin at the face's start corner on the lot line, `u` along it, `n` out toward
 *  the street. (Corners counter-clockwise from SW: faces s · e · n · w; the side faces w / e leave the corners
 *  to the front / back rows.) */
function faceFrame(lot, face) {
    const inset = face === "w" || face === "e" ? 13 : 0;
    const i = "senw".indexOf(face), A = lot[i], Bc = lot[(i + 1) % 4];
    const L = Math.hypot(Bc[0] - A[0], Bc[1] - A[1]), ux = (Bc[0] - A[0]) / L, uz = (Bc[1] - A[1]) / L;
    const nx = uz, nz = -ux;
    return { ox: A[0] + ux * inset, oz: A[1] + uz * inset, ux, uz, nx, nz, len: L - inset * 2, rot: Math.atan2(nx, nz) };
}
/** A face the railway's embankment runs through becomes two faces, one each side of it. */
function railSplit(fr, rail) {
    if (!rail || Math.abs(fr.ux) < 0.3) return [fr];
    const uc = (rail.x - fr.ox) / fr.ux;
    if (uc <= 0 || uc >= fr.len) return [fr];
    const gh = rail.base / 2 + 3, out = [];
    if (uc - gh > 6) out.push(Object.assign({}, fr, { len: uc - gh }));
    if (fr.len - uc - gh > 6) out.push(Object.assign({}, fr, { ox: fr.ox + fr.ux * (uc + gh), oz: fr.oz + fr.uz * (uc + gh), len: fr.len - uc - gh }));
    return out;
}
/** What stands along a face of `len` metres: [{key, u (centre along the face), sign?, spot?}].
 *  A town can name its own landmark uses as DATA — def.uses[kind] = { key, fallback, dims {w, d, prot}, u (offset
 *  from the face's middle), sign [lines], signSize, signBg, signFg, spot (its T.spots name), tints, with [{key, u}] } —
 *  e.g. Lakewood's Bais Yaakov (a model features/community builds; town loads it with the town's models). */
function layoutFace(kind, len, R, def = null) {
    const out = [];
    const use = def && def.uses && def.uses[kind];
    if (use) {
        const key = models[use.key] ? use.key : use.fallback;
        if (key) out.push({ key, u: len / 2 + (use.u || 0), use: Object.assign({ dims: DIMS[key] }, use) });
        for (const w of use.with || []) if (DIMS[w.key]) out.push({ key: w.key, u: len / 2 + w.u });
        return out;
    }
    const fill = (keys, gapVan, gap = 0.8) => {
        let u = 0.5;
        while (u < len) {
            const key = keys[Math.floor(R() * keys.length)];
            const w = DIMS[key].w;
            if (u + w > len + 0.5) break;
            out.push({ key, u: u + w / 2 });
            u += w;
            if (gapVan && u + 4 < len && R() < 0.5) { out.push({ key: "van", u: u + 1.9 }); u += 3.8; }
            else u += gap;
        }
        // centre what fitted
        const used = out.length ? Math.max(...out.map(o => o.u + (o.key === "van" ? 1.9 : DIMS[o.key].w / 2))) : 0;
        const shift = (len - used) / 2;
        for (const o of out) o.u += shift;
    };
    const centred = list => {     // a fixed row of keys, centred on the face (as many as fit)
        let total = list.reduce((a, k) => a + DIMS[k].w + 0.6, -0.6);
        while (list.length > 1 && total > len) { const k = list.pop(); total -= DIMS[k].w + 0.6; }
        let u = (len - total) / 2;
        for (const key of list) { out.push({ key, u: u + DIMS[key].w / 2 }); u += DIMS[key].w + 0.6; }
    };
    if (kind === "homes") fill(["town_duplex", "town_duplex", "town_townhouses"], true);
    else if (kind === "townhouses") fill(["town_townhouses"], true);
    else if (kind === "shops") fill(["town_shop"], false);
    else if (kind === "pizza") { out.push({ key: "town_shop", u: len / 2 - 13 }, { key: "town_pizza", u: len / 2 }, { key: "town_shop", u: len / 2 + 13 }); }
    else if (kind === "hall") { out.push({ key: "town_hall", u: len / 2 - 5 }, { key: "town_shop", u: len / 2 + 19 }); }
    else if (kind === "yeshiva") { out.push({ key: "town_yeshiva", u: len / 2 - 6 }, { key: "town_duplex", u: len / 2 + 19 }); }
    else if (kind === "construction" || kind === "construction2") { out.push({ key: "town_frame", u: len / 2 }); }
    else if (kind === "buses") { out.push({ key: "buses", u: len / 2 - 4 }); }
    // Midwood
    else if (kind === "mwhomes") fill(["town_mw_house", "town_mw_house", "town_mw_house", "town_mw_rowhouse"], false, 0.4);
    else if (kind === "rowhouses") fill(["town_mw_rowhouse"], false, 0.3);
    else if (kind === "shtiebel") { fill(["town_mw_house"], false, 0.4); for (const o of out) o.shtiebel = true; }
    else if (kind === "pkwy") fill(["town_mw_house", "town_mw_apts", "town_mw_house"], false, 1.6);
    else if (kind === "apts") fill(["town_mw_apts"], false, 0.8);
    else if (STORE_STYLE[kind]) { fill(["town_mw_store"], false, 0.2); for (const o of out) o.list = kind; }
    else if (kind === "mwpizza") centred(["town_mw_store", "town_pizza", "town_mw_store", "town_mw_store"]);
    else if (kind === "bakery") centred(["town_mw_bakery", "town_mw_store", "town_mw_store"]);
    else if (kind === "carsvc") centred(["town_mw_carbase", "town_mw_store", "town_mw_store"]);
    else if (kind === "shul") centred(["town_mw_house", "town_mw_shul", "town_mw_house"]);
    else if (kind === "school") centred(["town_yeshiva", "town_mw_house"]);
    for (const o of out) if (o.key === "town_mw_store" && !o.list) o.list = kind === "carsvc" ? "cia" : "avej";     // (the plain storefronts beside a landmark)
    return out;
}

/** Lay out one block face (or a frontage strip) of `kind` along the frame `fr` and place everything on it. */
function placeFace(B, kind, fr, counters) {
    const { R, T, S, merge, place, sign, anchorAt, parkedCar, col } = B;
    const next = (key, list) => { const c = counters[key] || 0; counters[key] = c + 1; return list[c % list.length]; };
    // a one-off landmark face split in two (the railway runs through it): the other half is ordinary shops
    if ((kind === "bakery" && T.spots.bakery) || (kind === "mwpizza" && T.spots.pizza) || (kind === "carsvc" && T.spots.carsvc)) kind = "avej";
    for (const it of layoutFace(kind, fr.len, R, B.def)) {
        const D = DIMS[it.key] || (it.use && it.use.dims) || { w: 10, d: 10, prot: 0 };
        const back = D.prot + D.d / 2;       // centre's distance in from the lot line
        const lotX = fr.ox + fr.ux * it.u, lotZ = fr.oz + fr.uz * it.u;
        const cx = lotX - fr.nx * back, cz = lotZ - fr.nz * back;
        if (it.key === "van") {         // a minivan in the driveway, nose to the street
            const vx = lotX - fr.nx * 3.2, vz = lotZ - fr.nz * 3.2;
            parkedCar(vx, vz, fr.rot);
            const dg = new THREE.PlaneGeometry(3.2, FRONT - WALK + 5.5); dg.rotateX(-Math.PI / 2); dg.rotateY(fr.rot);
            dg.translate(lotX - fr.nx * 2.2, 0.04, lotZ - fr.nz * 2.2);
            addColored(merge, dg, "#B9B3A8", vx, vz, "flat");
            continue;
        }
        if (it.key === "buses") {       // the depot: school buses nose-in + its sign
            for (let k = 0; k < 3; k++) {
                const u = it.u - 3.4 + k * 3.4;
                place("roadevents_school_bus", fr.ox + fr.ux * u - fr.nx * 8.5, fr.oz + fr.uz * u - fr.nz * 8.5, fr.rot, null, { skip: /^StopArm/ });
            }
            const sx = fr.ox + fr.ux * (it.u + 9) - fr.nx * 0.6, sz = fr.oz + fr.uz * (it.u + 9) - fr.nz * 0.6;
            poleAt(merge, sx - fr.ux * 1.8, sz - fr.uz * 1.8, 1.8); poleAt(merge, sx + fr.ux * 1.8, sz + fr.uz * 1.8, 1.8);
            sign({ lines: S.buses, bg: "#FFC107", fg: ["#1B1B1B", "#3E2723"], w: 1024, h: 256 }, sx, 2.3, sz, fr.rot, 4.2, 1.05, true);
            continue;
        }
        if (it.use) {                  // a landmark another feature models (the town's `uses`: data, see layoutFace)
            const u = it.use;
            place(it.key, cx, cz, fr.rot, u.tints || null, { dark: false });
            const a = u.sign && anchorAt(it.key, cx, cz, fr.rot);
            if (a) { const g = u.signSize || [11.4, 1.15, 104]; sign({ lines: u.sign, bg: u.signBg || "#FBF8F0", fg: u.signFg || ["#1F2D63", "#6D4C41"], w: 1024, h: g[2] * 2, radius: 10 }, a.x + fr.nx * 0.02, a.y, a.z + fr.nz * 0.02, fr.rot, g[0], g[1]); }
            T.spots[u.spot || kind] = { x: lotX + fr.nx * 2.6, z: lotZ + fr.nz * 2.6, rot: fr.rot, ux: fr.ux, uz: fr.uz, nx: fr.nx, nz: fr.nz, len: D.w };
            continue;
        }
        const k = it.key;
        const tints = k === "town_duplex" ? { Walls: pickOf(SIDING, R), Roof: pickOf(ROOFS, R) }
            : k === "town_townhouses" ? { Walls: pickOf(TOWN_WALLS, R), Roof: pickOf(ROOFS, R) }
            : k === "town_shop" || k === "town_pizza" ? { Walls: pickOf(SHOP_WALLS, R), Awning: k === "town_pizza" ? "#C62828" : pickOf(AWNINGS, R) }
            : k === "town_mw_house" ? { Walls: R() < 0.5 ? pickOf(B.BRICK, R) : pickOf(B.STUCCO, R), Roof: pickOf(ROOFS, R) }
            : k === "town_mw_rowhouse" || k === "town_mw_apts" ? { Walls: pickOf(B.BRICK, R) }
            : k === "town_mw_store" || k === "town_mw_bakery" ? { Walls: pickOf(B.BRICK, R), Awning: k === "town_mw_bakery" ? "#6D4C41" : pickOf(AWNINGS, R) }
            : null;
        // a duplex's deck sticks out on its model +X side: shift so the whole footprint fits the slot
        const shift = k === "town_duplex" ? -1.5 : 0;
        const sx = cx + Math.cos(fr.rot) * shift, sz = cz - Math.sin(fr.rot) * shift;
        place(k, sx, sz, fr.rot, tints, { dark: R() < 0.32 });
        let text = null, style = null;
        if (k === "town_shop") text = next("shops", S.shops);
        else if (k === "town_pizza") text = S.pizza;
        else if (k === "town_hall") text = S.hall;
        else if (k === "town_yeshiva") text = kind === "school" ? S.school : S.yeshiva;
        else if (k === "town_frame") text = kind === "construction2" ? S.construction2 : S.construction;
        else if (k === "town_mw_store") { text = next(it.list, S[it.list] || S.avej); style = STORE_STYLE[it.list]; }
        else if (k === "town_mw_bakery") text = S.bakery;
        else if (k === "town_mw_carbase") text = S.carService;
        else if (k === "town_mw_shul") text = S.shul;
        else if (k === "town_mw_apts") text = next("apts", S.apts);
        const a = text && anchorAt(k, sx, sz, fr.rot);
        if (a) {
            const big = k === "town_hall" ? [15.4, 1.45, 96] : k === "town_yeshiva" ? [11.4, 1.15, 104] : k === "town_frame" ? [11.6, 1.7, 150]
                : k === "town_mw_store" || k === "town_mw_bakery" ? [8.4, 0.9, 88] : k === "town_mw_carbase" ? [11.0, 1.1, 104] : k === "town_mw_shul" ? [9.6, 0.9, 96]
                : k === "town_mw_apts" ? [3.0, 0.42, 56] : [10.0, 0.98, 100];
            const bg = k === "town_frame" ? "#FFFFFF" : k === "town_hall" ? "#1B1B1B" : k === "town_mw_carbase" ? "#111111" : k === "town_mw_apts" ? "#1B3A2B" : k === "town_mw_shul" ? "#F3E9D2" : style ? style.bg : "#FBF8F0";
            const fg = k === "town_frame" ? ["#B71C1C", "#1B5E20"] : k === "town_hall" ? ["#E8C766", "#F5F1E6"] : k === "town_mw_carbase" ? ["#FFD54F", "#FFFFFF"]
                : k === "town_mw_apts" ? ["#E8C766"] : k === "town_mw_shul" ? ["#1A237E", "#5D4037"] : style ? style.fg : ["#2B1B2E", "#6D4C41"];
            sign({ lines: text, bg, fg, w: style ? 640 : k === "town_mw_apts" ? 512 : 1024, h: Math.round(big[2] * (style ? 1.4 : 2)), radius: 10 }, a.x + fr.nx * 0.02, a.y, a.z + fr.nz * 0.02, fr.rot, big[0], big[1]);
        }
        if (it.shtiebel && R() < 0.6) {
            // a shtiebel: a house with a little sign on the lawn
            const text2 = next("shtiebels", S.shtiebels);
            const px = lotX + fr.nx * 0.2 + fr.ux * 2.5, pz = lotZ + fr.nz * 0.2 + fr.uz * 2.5;
            poleAt(merge, px - fr.ux * 0.8, pz - fr.uz * 0.8, 1.2); poleAt(merge, px + fr.ux * 0.8, pz + fr.uz * 0.8, 1.2);
            sign({ lines: text2, bg: "#FFF8E1", fg: ["#1A237E", "#4E342E"], w: 512, h: 176, radius: 10 }, px + fr.nx * 0.03, 1.15, pz + fr.nz * 0.03, fr.rot, 2.0, 0.7, true);
            if (!T.spots.shtiebel) T.spots.shtiebel = { x: px + fr.nx * 2, z: pz + fr.nz * 2, rot: fr.rot, ux: fr.ux, uz: fr.uz, nx: fr.nx, nz: fr.nz };
        }
        if (k === "town_mw_carbase") {     // the car-service base: its black sedans nose-in out front
            for (const o of [-3.2, 0, 3.2]) {
                const vx = lotX + fr.ux * o - fr.nx * 3.2, vz = lotZ + fr.uz * o - fr.nz * 3.2;
                place("town_mw_sedan_lod", vx, vz, fr.rot + Math.PI, { Paint: o ? "#1C1C1E" : "#2B2D31" }, { noShadow: true });
                col(vx, vz, 1.4, "car");
            }
        }
        const spot = { x: lotX + fr.nx * 2.6, z: lotZ + fr.nz * 2.6, rot: fr.rot, ux: fr.ux, uz: fr.uz, nx: fr.nx, nz: fr.nz };
        const spotKey = k === "town_pizza" ? "pizza" : k === "town_hall" ? "hall" : k === "town_yeshiva" ? (kind === "school" ? "school" : "yeshiva")
            : k === "town_mw_bakery" ? "bakery" : k === "town_mw_carbase" ? "carsvc" : k === "town_mw_shul" ? "shul" : it.list === "cia" ? "cia" : it.list === "kh" ? "kh" : null;
        if (spotKey && !T.spots[spotKey]) T.spots[spotKey] = spot;
        if (k === "town_frame") {
            T.spots[kind] = spot;
            // a tower crane behind every construction lot (its jib slews: a separate object)
            const kx = cx - fr.nx * 14 + fr.ux * 6, kz = cz - fr.nz * 14 + fr.uz * 6;
            place("town_crane", kx, kz, fr.rot, null, { skip: /^Jib/ });
            const jibT = models.town_crane && findNodes(models.town_crane, "Jib")[0];
            if (jibT) {
                const jib = jibT.clone(true);
                jib.position.set(kx, 0, kz);
                jib.rotation.y = fr.rot + R() * 6;
                B.root.add(jib);
                T.cranes.push({ obj: jib, speed: (R() < 0.5 ? -1 : 1) * (0.05 + R() * 0.05) });
            }
        }
    }
    if (kind === "homes" || kind === "townhouses" || kind === "mwhomes" || kind === "rowhouses" || kind === "shtiebel") {   // yard / street trees between the sidewalk and the lots
        for (let u = 6; u < fr.len - 4; u += 13 + R() * 6) {
            const tx = fr.ox + fr.ux * u + fr.nx * 1.6, tz = fr.oz + fr.uz * u + fr.nz * 1.6;
            place(R() < 0.8 ? "treeRound" : "treePine", tx, tz, R() * 6.28, { Leaves: leaf(R), PineLeaves: "#2F8F46" }, { scale: 0.75 + R() * 0.3 });
            col(tx, tz, 0.4, "tree");
        }
    }
}
