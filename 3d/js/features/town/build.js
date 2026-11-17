// features/town — BUILD: turns the current plan + the town's data (towns/<id>.js) into one
// scene graph, built when Lulu takes the exit and disposed when she leaves. Static stuff
// goes through the kit's Merger (a few meshes per 80 m cluster) and the sign atlas (one
// mesh); the only per-object meshes are the things that move (crane jibs, coins, glows).
//
// Returns T = { root, colliders + near(x, z), coins, lamps, cranes, stops, bumps, spots, jam, … dispose() }.
import * as THREE from "three";
import { models, findNodes } from "../../models.js";
import { worldMaterials, canvasTex } from "../../world.js";
import { Merger, Atlas, lookMaterials } from "./kit.js";
import { PL, LANE, PARK, CURB, WALK, FRONT, STOP, street, streetPoint, nodeAlong, blockRect, rng } from "./plan.js";

const UP = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
const mtx = (x, z, rot, sc = 1, y = 0) => new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromAxisAngle(UP, rot), _s.setScalar(sc));

const SIDING = ["#E9DCC7", "#DADFE3", "#F5F2EA", "#EFE3B8", "#C9D6C3", "#C8D8E6", "#E3CFC1", "#D9D4CC"];
const ROOFS = ["#5D6D7E", "#4E4E58", "#6D5E52", "#3E4A57", "#7A6A5F"];
const TOWN_WALLS = ["#D7CCC8", "#ECE5D8", "#CFC8BC", "#F2EEE6", "#BFB7AC"];
const SHOP_WALLS = ["#F2D7B6", "#E8C9C0", "#D6E4E0", "#F3E6C4", "#E1D5E7", "#D9E2EC"];
const AWNINGS = ["#2E7D32", "#C62828", "#1A237E", "#6A1B9A", "#00695C", "#EF6C00", "#AD1457"];
const SILVER = ["#C3C8CE", "#BEC3C9", "#C8CCD1", "#B9BEC4"];

// model key → { w (along the face), d (depth), prot (how far its front sticks out past the facade) }
const DIMS = {
    town_duplex: { w: 14, d: 10, prot: 1.6 },
    town_townhouses: { w: 16.5, d: 11, prot: 1.0 },
    town_shop: { w: 12, d: 13, prot: 1.5 },
    town_pizza: { w: 12, d: 13, prot: 1.5 },
    town_hall: { w: 34, d: 22, prot: 4.3 },
    town_yeshiva: { w: 30, d: 18, prot: 1.2 },
    town_frame: { w: 24, d: 11, prot: 6.1 },
};

/** The models a town build needs (load them first). */
export const BUILD_MODELS = ["town_duplex", "town_townhouses", "town_shop", "town_pizza", "town_hall", "town_yeshiva", "town_frame", "town_crane",
    "town_minivan", "town_minivan_lod", "town_lamp", "town_stop", "town_chair", "town_welcome", "town_billboard", "town_circle", "town_reeds", "roadevents_school_bus", "foot_bus",
    "treeRound", "treePine"];

export function buildTown(def) {
    const R = rng(91);
    const S = def.lines.SIGNS;
    const O = PL.ORIGIN;
    const root = new THREE.Group();
    root.name = "Town:" + def.id;
    root.position.set(O.x, 0, O.z);
    const own = [];                     // geometries / materials / textures to dispose
    const mats = lookMaterials();
    own.push(...Object.values(mats));
    const merge = new Merger(60);
    const atlas = new Atlas(2048);
    const colliders = [];
    const T = { def, root, colliders, coins: [], lamps: [], cranes: [], spots: {}, stops: [], bumps: [], jam: [], signs: atlas, mats, own, parked: [] };

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
    /** A parked minivan: the light LOD model, no shadow of its own, a soft dark patch under it instead. */
    const parkedVan = (x, z, rot) => {
        place("town_minivan_lod", x, z, rot, { Paint: pickOf(SILVER, R) }, { noShadow: true });
        const b = new THREE.PlaneGeometry(2.3, 5.4); b.rotateX(-Math.PI / 2); b.rotateY(rot); b.translate(x, 0.05, z);
        addColored(merge, b, "#4a4c50", x, z, "flat");
    };
    const pt = (name, along, d) => { const st = street(name); return st ? streetPoint(st, along, d, {}) : null; };
    const clearAt = (st, u, side) => (def.clearParking || []).some(c => c.street === st.name && u >= c.from && u <= c.to && (c.side == null || c.side === side));

    // ── ground: asphalt, markings, sidewalks, curbs ──────────────────────
    const asphalt = [], walks = [], marks = [];
    const quad = (list, x0, z0, x1, z1, y, color) => list.push({ x0, z0, x1, z1, y, color });
    for (const st of PL.STREETS) {
        const { a0, a1 } = st;
        if (st.axis === "ns") quad(asphalt, st.c - CURB, a0, st.c + CURB, a1, 0.03);
        else quad(asphalt, a0, st.c - CURB, a1, st.c + CURB, 0.03);
        // stretches between crossings (and out to the street's ends)
        const cuts = [a0 - 1, ...st.cross.map(c => c.a), a1 + 1];
        for (let k = 0; k < cuts.length - 1; k++) {
            const open0 = k === 0, open1 = k === cuts.length - 2;
            const u0 = open0 ? a0 : cuts[k] + CURB, u1 = open1 ? a1 : cuts[k + 1] - CURB;
            if (u1 - u0 < 1) continue;
            for (const side of [-1, 1]) {
                const dA = side * CURB, dB = side * WALK;
                if (st.axis === "ns") quad(walks, Math.min(st.c - dA, st.c - dB), u0, Math.max(st.c - dA, st.c - dB), u1, 0.045);
                else quad(walks, u0, Math.min(st.c + dA, st.c + dB), u1, Math.max(st.c + dA, st.c + dB), 0.045);
                const mid = (u0 + u1) / 2, len = u1 - u0;
                const cp = streetPoint(st, mid, side * (CURB + 0.08), {});
                const g = new THREE.BoxGeometry(st.axis === "ns" ? 0.18 : len, 0.12, st.axis === "ns" ? len : 0.18);
                g.translate(cp.x, 0.06, cp.z);
                addColored(merge, g, "#B8B4AC", cp.x, cp.z, "flat");
            }
            const m0 = open0 ? a0 : cuts[k] + 9.5, m1 = open1 ? a1 : cuts[k + 1] - 9.5;
            if (m1 - m0 > 2) {
                for (const off of [-0.14, 0.14]) laneLine(marks, st, m0, m1, off, 0.11, "#F2C230");
                for (const off of [-3.5, 3.5]) laneLine(marks, st, m0, m1, off, 0.09, "#E8E8E2");
            }
        }
    }
    let circleGeo = null;
    if (PL.circle) {
        circleGeo = new THREE.CircleGeometry(15, 40);
        circleGeo.rotateX(-Math.PI / 2);
        circleGeo.translate(PL.circle.x, 0.034, PL.circle.z);
    }
    // crosswalks, stop bars (a 4-way stop at every crossing but the circle)
    for (const n of PL.NODES) {
        for (const sid of [n.ns, n.ew]) {
            const st = PL.STREETS[sid], na = nodeAlong(st, n);
            for (const dir of [-1, 1]) {
                const along = na - dir * STOP;
                if (along < st.a0 || along > st.a1) continue;
                const zc = na - dir * (CURB + 1.6);
                for (let k = -4; k <= 4; k++) {
                    const p = streetPoint(st, zc, k * 1.2, {});
                    const hw = st.axis === "ns" ? 0.3 : 1.1, hd = st.axis === "ns" ? 1.1 : 0.3;
                    quad(marks, p.x - hw, p.z - hd, p.x + hw, p.z + hd, 0.04, "#F2F2EE");
                }
                if (n.circle) continue;
                const p0 = streetPoint(st, along, dir * 0.4, {}), p1 = streetPoint(st, along, dir * (CURB - 0.2), {});
                const bx0 = Math.min(p0.x, p1.x), bx1 = Math.max(p0.x, p1.x), bz0 = Math.min(p0.z, p1.z), bz1 = Math.max(p0.z, p1.z);
                if (st.axis === "ns") quad(marks, bx0, bz0 - 0.25, bx1, bz1 + 0.25, 0.041, "#F2F2EE");
                else quad(marks, bx0 - 0.25, bz0, bx1 + 0.25, bz1, 0.041, "#F2F2EE");
                T.stops.push({ street: st.id, dir, along, node: n });
            }
        }
    }
    // speed bumps
    for (const b of def.bumps || []) {
        const st = street(b.street);
        if (!st) continue;
        for (let u = st.a0 + 12; u < st.a1 - 10; u += b.every) {
            if (st.cross.some(c => Math.abs(c.a - u) < 13)) continue;
            T.bumps.push({ street: st.id, along: u });
            const p = streetPoint(st, u, 0, {});
            for (let s = -5; s < 5; s++) {
                const g = st.axis === "ns" ? new THREE.BoxGeometry(1.1, 0.1, 0.7) : new THREE.BoxGeometry(0.7, 0.1, 1.1);
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
    const ag = quadsGeo(asphalt, 9);
    const asphaltMesh = new THREE.Mesh(circleGeo ? mergeTwo(ag, uvPlanar(circleGeo, 9)) : ag, asphaltMat);
    const walkMesh = new THREE.Mesh(quadsGeo(walks, 3), walkMat);
    const markMesh = new THREE.Mesh(quadsGeo(marks, 0, true), markMat);
    for (const m of [asphaltMesh, walkMesh, markMesh]) { m.receiveShadow = true; m.matrixAutoUpdate = false; root.add(m); own.push(m.geometry); }

    // ── blocks: buildings along every face, solid behind a ring of colliders ──
    let shopIdx = 0;
    for (const b of PL.BLOCKS) {
        const r = blockRect(b);
        if (b.solid) {
            const c = blockRect(b, FRONT + 1.4), step = 2.1, rad = 1.25;
            for (let x = c.x0; x <= c.x1 + 0.01; x += step) { col(x, c.z0, rad, "house"); col(x, c.z1, rad, "house"); }
            for (let z = c.z0 + step; z < c.z1; z += step) { col(c.x0, z, rad, "house"); col(c.x1, z, rad, "house"); }
        }
        for (const [face, kind] of Object.entries(b.faces)) {
            const fr = faceFrame(r, face);
            for (const it of layoutFace(kind, fr.len, R)) {
                const D = DIMS[it.key] || { w: 10, d: 10, prot: 0 };
                const back = D.prot + D.d / 2;       // centre's distance in from the lot line
                const lotX = fr.ox + fr.ux * it.u, lotZ = fr.oz + fr.uz * it.u;
                const cx = lotX - fr.nx * back, cz = lotZ - fr.nz * back;
                if (it.key === "van") {         // a minivan in the driveway, nose to the street
                    const vx = lotX - fr.nx * 3.2, vz = lotZ - fr.nz * 3.2;
                    parkedVan(vx, vz, fr.rot);
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
                const tints = it.key === "town_duplex" ? { Walls: pickOf(SIDING, R), Roof: pickOf(ROOFS, R) }
                    : it.key === "town_townhouses" ? { Walls: pickOf(TOWN_WALLS, R), Roof: pickOf(ROOFS, R) }
                    : it.key === "town_shop" || it.key === "town_pizza" ? { Walls: pickOf(SHOP_WALLS, R), Awning: it.key === "town_pizza" ? "#C62828" : pickOf(AWNINGS, R) }
                    : null;
                // a duplex's deck sticks out on its model +X side: shift so the whole footprint fits the slot
                const shift = it.key === "town_duplex" ? -1.5 : 0;
                const sx = cx + Math.cos(fr.rot) * shift, sz = cz - Math.sin(fr.rot) * shift;
                place(it.key, sx, sz, fr.rot, tints, { dark: R() < 0.32 });
                const text = it.key === "town_shop" ? S.shops[shopIdx++ % S.shops.length]
                    : it.key === "town_pizza" ? S.pizza : it.key === "town_hall" ? S.hall : it.key === "town_yeshiva" ? S.yeshiva
                    : it.key === "town_frame" ? (kind === "construction2" ? S.construction2 : S.construction) : null;
                const a = text && anchorAt(it.key, sx, sz, fr.rot);
                if (a) {
                    const big = it.key === "town_hall" ? [15.4, 1.45, 96] : it.key === "town_yeshiva" ? [11.4, 1.15, 104] : it.key === "town_frame" ? [11.6, 1.7, 150] : [10.0, 0.98, 100];
                    const bg = it.key === "town_frame" ? "#FFFFFF" : it.key === "town_hall" ? "#1B1B1B" : "#FBF8F0";
                    const fg = it.key === "town_frame" ? ["#B71C1C", "#1B5E20"] : it.key === "town_hall" ? ["#E8C766", "#F5F1E6"] : ["#2B1B2E", "#6D4C41"];
                    sign({ lines: text, bg, fg, w: 1024, h: big[2] * 2, radius: 10 }, a.x + fr.nx * 0.02, a.y, a.z + fr.nz * 0.02, fr.rot, big[0], big[1]);
                }
                const spot = { x: lotX + fr.nx * 2.6, z: lotZ + fr.nz * 2.6, rot: fr.rot, ux: fr.ux, uz: fr.uz, nx: fr.nx, nz: fr.nz };
                if (it.key === "town_pizza") T.spots.pizza = spot;
                if (it.key === "town_hall") T.spots.hall = spot;
                if (it.key === "town_yeshiva") T.spots.yeshiva = spot;
                if (it.key === "town_frame") {
                    T.spots[kind] = spot;
                    // a tower crane behind every construction lot (its jib slews: a separate object)
                    const kx = cx - fr.nx * 14 + fr.ux * 6, kz = cz - fr.nz * 14 + fr.uz * 6;
                    place("town_crane", kx, kz, fr.rot, null, { skip: /^Jib/ });
                    const jibT = models.town_crane && findNodes(models.town_crane, "Jib")[0];
                    if (jibT) {
                        const jib = jibT.clone(true);
                        jib.position.set(kx, 0, kz);
                        jib.rotation.y = fr.rot + R() * 6;
                        root.add(jib);
                        T.cranes.push({ obj: jib, speed: (R() < 0.5 ? -1 : 1) * (0.05 + R() * 0.05) });
                    }
                }
            }
            if (kind === "homes" || kind === "townhouses") {   // yard trees between the sidewalk and the lots
                for (let u = 6; u < fr.len - 4; u += 13 + R() * 6) {
                    const tx = fr.ox + fr.ux * u + fr.nx * 1.6, tz = fr.oz + fr.uz * u + fr.nz * 1.6;
                    place(R() < 0.8 ? "treeRound" : "treePine", tx, tz, R() * 6.28, { Leaves: leaf(R), PineLeaves: "#2F8F46" }, { scale: 0.75 + R() * 0.3 });
                    col(tx, tz, 0.4, "tree");
                }
            }
        }
    }

    // ── street furniture: parked minivans, lamps ─────────────────────────
    const chair = def.chair && street(def.chair.street);
    function lampAt(x, z, rot) {
        place("town_lamp", x, z, rot, null, { noShadow: true });
        col(x, z, 0.22, "pole");
        const fx = Math.sin(rot), fz = Math.cos(rot);
        T.lamps.push({ x: x + fx * 2.0, y: 6.2, z: z + fz * 2.0, gx: x + fx * 3.6, gz: z + fz * 3.6 });
    }
    for (const st of PL.STREETS) {
        for (let k = 0; k < st.cross.length - 1; k++) {
            const u0 = st.cross[k].a + 14, u1 = st.cross[k + 1].a - 14;
            if (u1 - u0 < 6) continue;
            for (const side of [-1, 1]) {
                for (let u = u0; u < u1; u += 6.6) {
                    if (clearAt(st, u, side)) continue;
                    if (chair === st && side === def.chair.side && Math.abs(u - def.chair.along) < 4) {
                        // THE one free spot in town… and a lawn chair is saving it
                        const c = streetPoint(st, u, side * PARK, {}), w = streetPoint(st, u + 1.6, side * 7.2, {});
                        place("town_chair", c.x, c.z, st.h + Math.PI / 2, null, { scale: 1.15 });
                        col(c.x, c.z, 0.45, "chair");
                        T.spots.chair = { x: w.x, z: w.z, cx: c.x, cz: c.z, rot: st.h - side * Math.PI / 2, street: st.id, along: u };
                        continue;
                    }
                    if (R() < 0.42) continue;
                    const p = streetPoint(st, u, side * PARK, {});
                    const rot = st.h + (side > 0 ? 0 : Math.PI) + (R() - 0.5) * 0.05;
                    parkedVan(p.x, p.z, rot);
                    const fx = Math.sin(rot), fz = Math.cos(rot);
                    col(p.x + fx * 1.25, p.z + fz * 1.25, 1.0, "car"); col(p.x - fx * 1.25, p.z - fz * 1.25, 1.0, "car");
                    T.parked.push({ x: p.x, z: p.z, rot });
                }
            }
            const side = (st.id + k) % 2 ? 1 : -1;      // a lamp at mid-block, alternating sides
            const mid = (u0 + u1) / 2 + 6, lp = streetPoint(st, mid, side * (WALK - 0.4), {}), lc = streetPoint(st, mid, 0, {});
            lampAt(lp.x, lp.z, Math.atan2(lc.x - lp.x, lc.z - lp.z));
        }
    }
    // stop signs (white STOP from the atlas), street blades + a lamp at each corner
    const stopUV = atlas.sign({ key: "STOP", w: 256, h: 256, draw: (g, w, h) => {
        g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `800 ${h * 0.34}px Arial, sans-serif`; g.fillText("STOP", w / 2, h / 2 + 4, w * 0.86);
    } });
    for (const s of T.stops) {
        const st = PL.STREETS[s.street];
        const p = streetPoint(st, s.along - s.dir * 1.2, s.dir * (CURB + 1.0), {});
        const face = st.h + (s.dir > 0 ? Math.PI : 0);     // faces the approaching driver
        place("town_stop", p.x, p.z, face, null, { noShadow: true });
        col(p.x, p.z, 0.14, "sign");
        const a = anchorAt("town_stop", p.x, p.z, face);
        if (a) atlas.quad(stopUV, a.x + Math.sin(face) * 0.035, a.y, a.z + Math.cos(face) * 0.035, face, 0.62, 0.62);
        s.x = p.x; s.z = p.z;
    }
    for (const n of PL.NODES) {
        if (n.circle) continue;
        const x = n.x + 7.4, z = n.z + 7.4;
        poleAt(merge, x, z, 3.4);
        col(x, z, 0.12, "sign");
        sign({ lines: [PL.STREETS[n.ns].name], bg: "#1E6B3C", fg: "#FFFFFF", w: 512, h: 96, radius: 8 }, x, 3.2, z, Math.PI / 2, 1.7, 0.32, true);
        sign({ lines: [PL.STREETS[n.ew].name], bg: "#1E6B3C", fg: "#FFFFFF", w: 512, h: 96, radius: 8 }, x, 3.55, z, 0, 1.7, 0.32, true);
        const lx = n.x - 7.6, lz = n.z - 7.6;
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
        for (let u = j.from; u < j.to; u += j.gap || 6.2) {
            if (st.cross.some(c => Math.abs(c.a - u) < 9)) continue;      // the cross streets stay (barely) open
            const p = streetPoint(st, u, j.d, {});
            const rot = st.h + (j.d > 0 ? 0 : Math.PI) + (R() - 0.5) * 0.12;
            parkedVan(p.x, p.z, rot);
            const fx = Math.sin(rot), fz = Math.cos(rot);
            col(p.x + fx * 1.2, p.z + fz * 1.2, 1.0, "car"); col(p.x - fx * 1.2, p.z - fz * 1.2, 1.0, "car");
            T.jam.push({ x: p.x, z: p.z });
        }
    }
    if (def.bandBus && models[def.bandBus.model]) {
        const B = def.bandBus, st = street(B.street), p = streetPoint(st, B.along, B.d, {});
        place(B.model, p.x, p.z, st.h, B.colors);
        for (const o of [-3.6, -1.2, 1.2, 3.6]) { const q = streetPoint(st, B.along + o, B.d, {}); col(q.x, q.z, 1.3, "car"); }
        if (B.lines) {
            const s2 = streetPoint(st, B.along, B.d + 1.3, {});
            sign({ lines: B.lines, bg: "#4A148C", fg: ["#FFD54F", "#F3E5F5"], w: 1024, h: 200 }, s2.x, 1.9, s2.z, st.h + Math.PI / 2, 6.4, 1.2);
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
    for (const sg of def.signs || []) {
        const p = pt(sg.street, sg.along, sg.d);
        if (!p) continue;
        if (sg.kind === "green") {
            const w = sg.w || 2.6;
            poleAt(merge, p.x - Math.cos(sg.rot) * w * 0.32, p.z + Math.sin(sg.rot) * w * 0.32, 2.3);
            poleAt(merge, p.x + Math.cos(sg.rot) * w * 0.32, p.z - Math.sin(sg.rot) * w * 0.32, 2.3);
            col(p.x, p.z, 0.3, "sign");
            sign({ lines: sg.lines, bg: "#1F7A46", fg: "#FFFFFF", w: 768, h: 300, border: "#FFFFFF" }, p.x, 2.65, p.z, sg.rot, w, w * 0.39, true);
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

    // ── bake ─────────────────────────────────────────────────────────────
    const merged = merge.build(mats);
    for (const m of merged) { root.add(m); own.push(m.geometry); }
    const signMesh = atlas.mesh();
    root.add(signMesh);
    own.push(signMesh.geometry, signMesh.material, signMesh.material.map);
    T.tris = merge.tris;
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
    for (const st of PL.STREETS) {
        const along = st.axis === "ns" ? z : x, d = st.axis === "ns" ? x - st.c : z - st.c;
        const a = Math.max(st.a0, Math.min(st.a1, along));
        best = Math.min(best, Math.hypot(along - a, d));
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
function laneLine(list, st, u0, u1, d, w, color) {
    const a = streetPoint(st, u0, d - w / 2, {}), b = streetPoint(st, u1, d + w / 2, {});
    list.push({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z), y: 0.036, color });
}
/** Axis-aligned flat quads → one geometry (planar UVs every `uvScale` m, or vertex colours). */
function quadsGeo(list, uvScale, colors = false) {
    const n = list.length;
    const P = new Float32Array(n * 12), N = new Float32Array(n * 12), U = new Float32Array(n * 8), C = colors ? new Float32Array(n * 12) : null, I = [];
    const c = new THREE.Color();
    list.forEach((q, k) => {
        const v = [[q.x0, q.z0], [q.x0, q.z1], [q.x1, q.z1], [q.x1, q.z0]];
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

/** A block face as a frame: origin at the face's start corner on the lot line, `u` along it, `n` out toward the street. */
function faceFrame(r, face) {
    const inset = 13;     // the side faces leave the corners to the front/back rows
    if (face === "s") return { ox: r.x0, oz: r.z0, ux: 1, uz: 0, nx: 0, nz: -1, len: r.x1 - r.x0, rot: Math.PI };
    if (face === "n") return { ox: r.x1, oz: r.z1, ux: -1, uz: 0, nx: 0, nz: 1, len: r.x1 - r.x0, rot: 0 };
    if (face === "w") return { ox: r.x0, oz: r.z1 - inset, ux: 0, uz: -1, nx: -1, nz: 0, len: r.z1 - r.z0 - inset * 2, rot: -Math.PI / 2 };
    return { ox: r.x1, oz: r.z0 + inset, ux: 0, uz: 1, nx: 1, nz: 0, len: r.z1 - r.z0 - inset * 2, rot: Math.PI / 2 };
}
/** What stands along a face of `len` metres: [{key, u (centre along the face)}]. */
function layoutFace(kind, len, R) {
    const out = [];
    const fill = (keys, gapVan) => {
        let u = 0.5;
        while (u < len) {
            const key = keys[Math.floor(R() * keys.length)];
            const w = DIMS[key].w;
            if (u + w > len + 0.5) break;
            out.push({ key, u: u + w / 2 });
            u += w;
            if (gapVan && u + 4 < len && R() < 0.5) { out.push({ key: "van", u: u + 1.9 }); u += 3.8; }
            else u += 0.8;
        }
        // centre what fitted
        const used = out.length ? Math.max(...out.map(o => o.u + (o.key === "van" ? 1.9 : DIMS[o.key].w / 2))) : 0;
        const shift = (len - used) / 2;
        for (const o of out) o.u += shift;
    };
    if (kind === "homes") fill(["town_duplex", "town_duplex", "town_townhouses"], true);
    else if (kind === "townhouses") fill(["town_townhouses"], true);
    else if (kind === "shops") fill(["town_shop"], false);
    else if (kind === "pizza") { out.push({ key: "town_shop", u: len / 2 - 13 }, { key: "town_pizza", u: len / 2 }, { key: "town_shop", u: len / 2 + 13 }); }
    else if (kind === "hall") { out.push({ key: "town_hall", u: len / 2 - 5 }, { key: "town_shop", u: len / 2 + 19 }); }
    else if (kind === "yeshiva") { out.push({ key: "town_yeshiva", u: len / 2 - 6 }, { key: "town_duplex", u: len / 2 + 19 }); }
    else if (kind === "construction" || kind === "construction2") { out.push({ key: "town_frame", u: len / 2 }); }
    else if (kind === "buses") { out.push({ key: "buses", u: len / 2 - 4 }); }
    return out;
}
