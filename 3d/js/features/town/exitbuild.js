// features/town — DRAWING an interchange (exit.js is the plan: the layout, the phases, the lanes). Everything is
// built in chunk:build from the layout in highway road coords (u = s − exit.s, d), so the same chunk always
// rebuilds the same ramps, and per chunk it stays a handful of draw calls:
//   asphalt   one mesh per surface: the ramp lanes (decel / branches / on-ramp / accel — edge lines), the local
//             cross roads + the on-ramp's corner (a double yellow line), the painted gores, the dashed lane lines,
//             the paint (EXIT ONLY + arrows in the decel lane, the STOP bars)
//   props     merged by town's kit.js: the gantry (its own), crash cushions at the gore noses, guardrails (procedural
//             W-beams + posts) with flared end terminals, STOP signs, the T-junction guide boards, a gas station
//             (canopy, pylon, a car at the pump), "Welcome to …", the first houses along the road into town
//   faces     every bit of text on those props is one quad mesh from a shared atlas
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on } from "../../core/ctx.js";
import { models, registerModels, ensureModels, findNodes } from "../../models.js";
import { canvasTex, signTexture } from "../../world.js";
import { Merger, Atlas, lookMaterials } from "./kit.js";
import { X, TAPER0, RAMP0, GANTRY, PART, HALF, XW, ON0, ON1, ACC1, ARC_R, ON_D0, X_IN, STOP_IN, STOP_OUT,
    rampD, outerD, taperEdge, onD, onHalf, accelEdge, crossRoads } from "./exit.js";
import { INTERCHANGE, fillLine, TOWNS } from "./towns/index.js";

const PROPS = ["exits_stop", "exits_guide", "exits_welcome", "exits_pylon", "exits_cushion", "exits_railend", "exits_advisory", "exits_canopy"];
registerModels(Object.fromEntries(PROPS.map(k => [k, k])));
/** What the far end needs (the core's house / tree / sedan are always loaded). */
export const EXIT_MODELS = PROPS;

// ── materials (made once) ────────────────────────────────────────────────
let M = null;
function mats() {
    if (M) return M;
    const speck = (g, w, h, n) => { for (let i = 0; i < n; i++) { g.fillStyle = ["#676b73", "#53575e", "#70747c"][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); } };
    const off = f => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
    const rampTex = canvasTex(128, 256, (g, w, h) => { g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h); speck(g, w, h, 1600); g.fillStyle = "#f4f4f0"; g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h); });
    // a two-lane local road: white edges, a double yellow centre line
    const localTex = canvasTex(128, 256, (g, w, h) => { g.fillStyle = "#5a5e66"; g.fillRect(0, 0, w, h); speck(g, w, h, 1600); g.fillStyle = "#f4f4f0"; g.fillRect(4, 0, 4, h); g.fillRect(w - 8, 0, 4, h); g.fillStyle = "#F2C230"; g.fillRect(w / 2 - 5, 0, 3, h); g.fillRect(w / 2 + 2, 0, 3, h); });
    const goreTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h); g.strokeStyle = "#f4f4f0"; g.lineWidth = 7; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w / 2, h * 0.25); g.lineTo(w, h * 0.75); g.stroke(); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); });
    const dashTex = canvasTex(8, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h / 3); });
    M = {
        ramp: new THREE.MeshStandardMaterial(Object.assign({ map: rampTex, roughness: 0.92 }, off(-3))),
        local: new THREE.MeshStandardMaterial(Object.assign({ map: localTex, roughness: 0.92 }, off(-3))),
        gore: new THREE.MeshStandardMaterial(Object.assign({ map: goreTex, roughness: 0.8 }, off(-4))),
        dash: new THREE.MeshStandardMaterial(Object.assign({ map: dashTex, roughness: 0.7, transparent: true, alphaTest: 0.5 }, off(-5))),
        paint: new THREE.MeshStandardMaterial(Object.assign({ map: paintTex(), roughness: 0.7, transparent: true, alphaTest: 0.5 }, off(-6))),
        look: lookMaterials(),
    };
    return M;
}
/** The pavement paint: EXIT / ONLY (top half), a lane-drop arrow bearing right (bottom-left), solid white (bottom-right). */
function paintTex() {
    return canvasTex(256, 512, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "#f4f4f0"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `800 92px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        g.save(); g.scale(1, 1.0);
        g.fillText("ONLY", w / 2, 64, w - 16);
        g.fillText("EXIT", w / 2, 192, w - 16);
        g.restore();
        // the arrow (bottom-left quarter): a shaft up, curving off to the right
        g.strokeStyle = "#f4f4f0"; g.lineWidth = 16; g.lineCap = "butt";
        g.beginPath(); g.moveTo(64, 500); g.lineTo(64, 400); g.quadraticCurveTo(64, 330, 100, 300); g.stroke();
        g.beginPath(); g.moveTo(84, 280); g.lineTo(124, 282); g.lineTo(110, 322); g.closePath(); g.fill();
        g.fillRect(132, 260, 124, 252);
    }, false);
}
const UV_TEXT = [0, 0.5, 1, 1], UV_ARROW = [0, 0, 0.5, 0.5], UV_WHITE = [0.6, 0.05, 0.95, 0.45];

// ── geometry in (u, d) space, mapped through the highway ─────────────────
const _p = {};
/** Index a grid of rows × 2 so every triangle faces up (whatever way the road curves). */
function finish(pos, uv, idx) {
    const g = new THREE.BufferGeometry();
    // make the first triangle face +y; flip all if not
    if (idx.length >= 3) {
        const a = idx[0] * 3, b = idx[1] * 3, c = idx[2] * 3;
        const ux = pos[b] - pos[a], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vz = pos[c + 2] - pos[a + 2];
        if (uz * vx - ux * vz < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
}
/** A strip between d0(s) and d1(s), s ∈ [a, b] (uv: across 0..1, along s / vScale). */
export function strip(road, a, b, d0, d1, y, vScale = 12) {
    const n = Math.max(2, Math.round((b - a) / 2) + 1), pos = [], uv = [], idx = [];
    for (let k = 0; k < n; k++) {
        const s = a + (b - a) * k / (n - 1);
        road.point(s, d0(s), _p); pos.push(_p.x, y, _p.z);
        road.point(s, d1(s), _p); pos.push(_p.x, y, _p.z);
        uv.push(0, s / vScale, 1, s / vScale);
        if (k < n - 1) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    return finish(pos, uv, idx);
}
/** A road running across the highway's direction (constant u): centre u = s − E, half width hw, d0 → d1. */
function crossStrip(road, E, uc, hw, d0, d1, y, vScale = 12) {
    const n = Math.max(2, Math.round((d1 - d0) / 3) + 1), pos = [], uv = [], idx = [];
    for (let k = 0; k < n; k++) {
        const d = d0 + (d1 - d0) * k / (n - 1);
        road.point(E + uc - hw, d, _p); pos.push(_p.x, y, _p.z);
        road.point(E + uc + hw, d, _p); pos.push(_p.x, y, _p.z);
        uv.push(0, d / vScale, 1, d / vScale);
        if (k < n - 1) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    return finish(pos, uv, idx);
}
/** A ring sector in (u, d) around (cu, cd): radii r0 → r1, angles a0 → a1 (u = cu + r cos, d = cd + r sin). */
function arcStrip(road, E, cu, cd, r0, r1, a0, a1, y, vScale = 12) {
    const n = 12, pos = [], uv = [], idx = [], rm = (r0 + r1) / 2;
    for (let k = 0; k <= n; k++) {
        const a = a0 + (a1 - a0) * k / n, c = Math.cos(a), sn = Math.sin(a), v = rm * Math.abs(a - a0) / vScale;
        road.point(E + cu + r0 * c, cd + r0 * sn, _p); pos.push(_p.x, y, _p.z);
        road.point(E + cu + r1 * c, cd + r1 * sn, _p); pos.push(_p.x, y, _p.z);
        uv.push(0, v, 1, v);
        if (k < n) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    return finish(pos, uv, idx);
}
/** A flat painted quad: u0 → u1 along, d0 → d1 across, showing paint-texture rect [ua, va, ub, vb] (v along u). */
function paintQuad(road, E, u0, u1, d0, d1, y, r) {
    const pos = [], uv = [];
    for (const [u, d, uu, vv] of [[u0, d0, r[0], r[1]], [u0, d1, r[2], r[1]], [u1, d0, r[0], r[3]], [u1, d1, r[2], r[3]]]) { road.point(E + u, d, _p); pos.push(_p.x, y, _p.z); uv.push(uu, vv); }
    return finish(pos, uv, [0, 1, 2, 1, 3, 2]);
}
function addMerged(chunk, list, mat) {
    if (!list.length) return null;
    const g = list.length > 1 ? mergeGeometries(list, false) : list[0];
    if (list.length > 1) for (const x of list) x.dispose();
    if (!g) return null;
    g.computeBoundingSphere();
    const mesh = chunk.addMesh(g, mat);
    mesh.receiveShadow = true;
    return mesh;
}

// ── guardrails: a W-beam on posts (procedural, vertex-coloured, merged with the props) ──
const RAIL = new THREE.Color("#AAB4BC"), POST = new THREE.Color("#7E8A93");
/** A rail along d = dOf(u) for u ∈ [a, b] (clipped to the chunk by the caller): one geometry (position / normal / colour). */
function railGeo(road, E, dOf, a, b) {
    const P = [];
    for (let u = a; u <= b + 0.01; u += 2) { road.point(E + u, dOf(u), _p); P.push({ x: _p.x, z: _p.z }); }
    if (P.length < 2) return null;
    const pos = [], nor = [], col = [], idx = [];
    const vtx = (x, y, z, nx, ny, nz, c) => { pos.push(x, y, z); nor.push(nx, ny, nz); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
    const quad = (a0, a1, a2, a3) => idx.push(a0, a1, a2, a0, a2, a3);
    const Y0 = 0.52, Y1 = 0.82, T = 0.05;
    for (let i = 0; i < P.length; i++) {
        const p = P[i], q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)];
        let tx = q.x - o.x, tz = q.z - o.z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        p.nx = -tz; p.nz = tx;
    }
    for (let i = 0; i < P.length - 1; i++) {
        const p = P[i], q = P[i + 1];
        for (const sd of [1, -1]) {
            const a0 = vtx(p.x + p.nx * T * sd, Y0, p.z + p.nz * T * sd, p.nx * sd, 0, p.nz * sd, RAIL);
            const a1 = vtx(q.x + q.nx * T * sd, Y0, q.z + q.nz * T * sd, q.nx * sd, 0, q.nz * sd, RAIL);
            const a2 = vtx(q.x + q.nx * T * sd, Y1, q.z + q.nz * T * sd, q.nx * sd, 0, q.nz * sd, RAIL);
            const a3 = vtx(p.x + p.nx * T * sd, Y1, p.z + p.nz * T * sd, p.nx * sd, 0, p.nz * sd, RAIL);
            if (sd > 0) quad(a0, a1, a2, a3); else quad(a0, a3, a2, a1);
        }
        const t0 = vtx(p.x + p.nx * T, Y1, p.z + p.nz * T, 0, 1, 0, RAIL), t1 = vtx(q.x + q.nx * T, Y1, q.z + q.nz * T, 0, 1, 0, RAIL);
        const t2 = vtx(q.x - q.nx * T, Y1, q.z - q.nz * T, 0, 1, 0, RAIL), t3 = vtx(p.x - p.nx * T, Y1, p.z - p.nz * T, 0, 1, 0, RAIL);
        quad(t0, t3, t2, t1);
    }
    // posts every 4 m, just behind the beam
    for (let i = 0; i < P.length; i += 2) {
        const p = P[i], fx = -p.nz, fz = p.nx, cx = p.x - p.nx * 0.14, cz = p.z - p.nz * 0.14, h = 0.07;
        const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: cx + fx * a * h + p.nx * b * h, z: cz + fz * a * h + p.nz * b * h }));
        for (let k = 0; k < 4; k++) {
            const A = c[k], B = c[(k + 1) % 4], nx = (A.x + B.x) / 2 - cx, nz = (A.z + B.z) / 2 - cz, nl = Math.hypot(nx, nz) || 1;
            const v0 = vtx(A.x, 0, A.z, nx / nl, 0, nz / nl, POST), v1 = vtx(B.x, 0, B.z, nx / nl, 0, nz / nl, POST);
            const v2 = vtx(B.x, 0.78, B.z, nx / nl, 0, nz / nl, POST), v3 = vtx(A.x, 0.78, A.z, nx / nl, 0, nz / nl, POST);
            idx.push(v0, v1, v2, v0, v2, v3, v0, v2, v1, v0, v3, v2);      // both windings (no culling surprises)
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    return g;
}
/** The rails an exit has: [{ dOf, a, b }] — the outer side of the ramp and each branch, the fill side of the inner
 *  branch, the outside of the on-ramp (each starts with a flared end terminal). */
export function railsOf(e) {
    const off = 0.9, out = [];
    if (e.two) {
        out.push({ dOf: u => outerD(u) + HALF + off, a: -36, b: STOP_OUT - 14 });
        out.push({ dOf: u => rampD(u) + HALF + off, a: 54, b: STOP_IN - 14 });
    } else out.push({ dOf: u => rampD(u) + HALF + off, a: -36, b: STOP_IN - 14 });
    out.push({ dOf: u => rampD(u) - HALF - off, a: 76, b: STOP_IN - 14 });
    out.push({ dOf: u => onD(u) + onHalf(u) + off, a: ON0 + 22, b: ON1 - 14 });
    return out;
}

// ── the sign faces: one atlas for every interchange (both towns' copy), built on first use ──
let AT = null;
function atlas() {
    if (AT) return AT;
    const a = new Atlas(1024);
    const cell = (key, spec) => a.sign(Object.assign({ key }, spec));
    const C = {
        stop: cell("stop", { w: 256, h: 256, draw: (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#FAFAFA"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = `800 ${Math.round(h * 0.34)}px Fredoka, Arial, sans-serif`; g.fillText("STOP", w / 2, h * 0.53, w * 0.86); } }),
        advisory: cell("advisory", { w: 256, h: 320, draw: (g, w, h) => {
            g.clearRect(0, 0, w, h); g.strokeStyle = "#111"; g.lineWidth = 10; g.strokeRect(12, 12, w - 24, h - 24);
            g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
            g.font = `800 ${Math.round(h * 0.2)}px Fredoka, Arial, sans-serif`; g.fillText("RAMP", w / 2, h * 0.3, w * 0.84);
            g.font = `800 ${Math.round(h * 0.3)}px Fredoka, Arial, sans-serif`; g.fillText("25", w / 2, h * 0.58, w * 0.84);
            g.font = `800 ${Math.round(h * 0.13)}px Fredoka, Arial, sans-serif`; g.fillText("MPH", w / 2, h * 0.82, w * 0.84);
        } }),
    };
    for (const t of Object.values(TOWNS)) {
        const S = t.lines.SIGNS, id = t.id;
        const W = S.welcome || [`WELCOME TO ${t.name.toUpperCase()}`];
        C["welcome_" + id] = cell("welcome_" + id, { lines: [W[0].replace(/^WELCOME TO /i, "Welcome to "), ...W.slice(1, 3)], bg: "#F6EEDC", fg: ["#1F3A5F", "#6D4C41"], w: 768, h: 256, border: "#6D4C41" });
        const tee = S.tee || [`${t.name.toUpperCase()} →`, "← HIGHWAY"];
        C["tee_" + id] = cell("tee_" + id, { lines: tee, bg: "#1F7A46", fg: "#FFFFFF", w: 1024, h: 440, border: "#FFFFFF" });
        const gas = S.gas || { name: ["GAS · FOOD"], prices: ["REG 4.19"] };
        C["gas_" + id] = cell("gas_" + id, { lines: gas.name, bg: "#C62828", fg: ["#FFFFFF", "#FFE082"], w: 512, h: 320, border: "#FFFFFF" });
        C["price_" + id] = cell("price_" + id, { lines: gas.prices, bg: "#151515", fg: ["#FFB300", "#7CFC4F", "#FFB300"], w: 512, h: 320 });
    }
    const m0 = a.mesh();          // packs + draws the canvas once; each chunk builds its own quads with this material
    m0.geometry.dispose();
    AT = { C, mat: m0.material };
    return AT;
}
function signMesh(list) {
    const A = atlas(), P = [], U = [], N = [], I = [];
    const v = new THREE.Vector3(), mtx = new THREE.Matrix4(), eu = new THREE.Euler();
    list.forEach((q, k) => {
        mtx.makeRotationFromEuler(eu.set(0, q.yaw, 0, "YXZ")).setPosition(q.x, q.y, q.z);
        for (const [x, y] of [[-q.w / 2, -q.h / 2], [q.w / 2, -q.h / 2], [q.w / 2, q.h / 2], [-q.w / 2, q.h / 2]]) { v.set(x, y, 0).applyMatrix4(mtx); P.push(v.x, v.y, v.z); }
        const [u0, v0, u1, v1] = q.cell.uv;
        U.push(u0, v0, u1, v0, u1, v1, u0, v1);
        for (let i = 0; i < 4; i++) N.push(Math.sin(q.yaw), 0, Math.cos(q.yaw));
        I.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, A.mat);
    mesh.receiveShadow = true;
    return mesh;
}

// ── placing props (u, d, yaw: "along" faces +s · "back" faces −s (toward her as she drives up) · "out" faces +d ·
//    "in" faces −d (toward the highway) · a number = radians on top of the road's heading) ──
const YAW = { along: 0, back: Math.PI, out: -Math.PI / 2, in: Math.PI / 2 };
function at(E, u, d, yaw = "back") {
    const road = ctx.world.highway;
    road.point(E + u, d, _p);
    return { x: _p.x, z: _p.z, h: _p.h, yaw: _p.h + (typeof yaw === "number" ? yaw : YAW[yaw]) };
}
const mtxAt = q => new THREE.Matrix4().makeRotationY(q.yaw).setPosition(q.x, 0, q.z);
function anchorWorld(tpl, name, m, out = new THREE.Vector3()) {
    tpl.updateMatrixWorld(true);
    const n = findNodes(tpl, name)[0];
    if (!n) return null;
    const rel = tpl.matrixWorld.clone().invert().multiply(n.matrixWorld);
    return out.setFromMatrixPosition(rel).applyMatrix4(m);
}
const HOUSE_WALLS = ["#FFE0B2", "#E3F2FD", "#DCEDC8", "#FFF9C4", "#D7CCC8", "#F8BBD0"], HOUSE_ROOFS = ["#8D6E63", "#546E7A", "#C0504D", "#5D4037"];

/** Every placed piece of an exit's far end (DATA: the tests scan it against the lanes): [{ key, u, d, yaw, face?, r }]. */
export function propsOf(e) {
    const out = [];
    const two = e.two;
    // crash cushions at the gore noses
    // (u = the nose; the barrels run 3.5 m on down the gore — `at` is the middle, for the lane scan)
    out.push({ key: "exits_cushion", u: 14, d: (8.8 + rampD(15.8) - HALF) / 2, yaw: "back", r: 1.4, len: 3.6, at: 15.8 });
    if (two) out.push({ key: "exits_cushion", u: 49, d: (rampD(50.8) + outerD(50.8)) / 2, yaw: "back", r: 1.4, len: 3.6, at: 50.8 });
    // the speed advisory on the ramp's right, just after the gore
    out.push({ key: "exits_advisory", u: -30, d: rampD(-30) + HALF + 2.0, yaw: "back", face: "advisory", r: 0.7 });
    for (const b of e.branches) {
        const c = b.cross, t = b.town, id = t.id, dEnd = b.dOf(b.stop);
        out.push({ key: "exits_stop", u: b.stop - 1.5, d: dEnd + HALF + 0.8, yaw: "back", face: "stop", r: 0.5 });
        out.push({ key: "exits_guide", u: c.u + XW + 2.6, d: dEnd, yaw: "back", face: "tee_" + id, r: 2.3 });
        out.push({ key: "exits_welcome", u: c.u - XW - 3.4, d: 96, yaw: "in", face: "welcome_" + id, r: 2.9 });
        out.push({ key: "exits_pylon", u: c.u + XW + 8, d: b.k ? 86 : 48, yaw: "back", face: "gas_" + id, face2: "price_" + id, r: 1.6 });
        // houses start along the road into town
        for (const [k, dd] of [[0, 106], [1, 126], [2, 146], [3, 166]]) for (const side of [-1, 1]) {
            out.push({ key: "house", u: c.u + side * (XW + 12.5), d: dd + (side > 0 ? 6 : 0), yaw: side < 0 ? "along" : "back", r: 6, tint: { Walls: HOUSE_WALLS[(k * 2 + (side > 0) + b.k) % HOUSE_WALLS.length], Roof: HOUSE_ROOFS[(k + b.k) % HOUSE_ROOFS.length] } });
        }
        out.push({ key: "treeRound", u: c.u - XW - 9, d: dEnd - 14, yaw: 0.6, r: 0.6 });
        out.push({ key: "treeRound", u: c.u - XW - 9, d: dEnd + 20, yaw: 1.4, r: 0.6 });
    }
    // the gas station by the inner T: a canopy over a pump island, a car filling up
    out.push({ key: "exits_canopy", u: X_IN + XW + 15, d: 64, yaw: "back", r: 5 });
    out.push({ key: "sedan", u: X_IN + XW + 13.2, d: 60, yaw: "out", r: 2.4, tint: { Paint: "#42A5F5" } });
    return out;
}
const FACES = { stop: [0.68, 0.68], advisory: [1.1, 1.4], tee: [4.2, 1.8], welcome: [4.0, 1.34], gas: [2.6, 1.62], price: [2.4, 1.5] };

function buildProps(e, chunk, s0, s1) {
    const E = e.s, mg = new Merger(4000), signs = [], A = atlas();
    const inChunk = u => E + u >= s0 && E + u < s1;
    for (const p of propsOf(e)) {
        if (!inChunk(p.u) || !models[p.key]) continue;
        const q = at(E, p.u, p.d, p.yaw), m = mtxAt(q), tpl = models[p.key];
        mg.add(tpl, m, p.tint || null, { at: [0, 0], noShadow: p.key === "house" || p.key === "treeRound" || p.key === "sedan" });
        const fx = Math.sin(q.yaw) * 0.03, fz = Math.cos(q.yaw) * 0.03;
        for (const [fk, an] of [[p.face, "Anchor_sign"], [p.face2, "Anchor_price"]]) {
            if (!fk) continue;
            const v = anchorWorld(tpl, an, m), sz = FACES[fk.replace(/_.*/, "")];
            if (v && A.C[fk]) signs.push({ cell: A.C[fk], x: v.x + fx, y: v.y, z: v.z + fz, yaw: q.yaw, w: sz[0], h: sz[1] });
        }
        chunk.addCollider({ x: q.x, z: q.z, r: p.r || 0.5, kind: p.key === "house" ? "house" : p.key === "treeRound" ? "tree" : "sign" });
    }
    // the guardrails + their flared end terminals
    const road = ctx.world.highway;
    for (const r of railsOf(e)) {
        const a = Math.max(r.a, s0 - E), b = Math.min(r.b, s1 - E);
        if (a < b) {
            const g = railGeo(road, E, r.dOf, a, b);
            if (g) mg.addGeometry(g, "flat", 0, 0);
            for (let u = Math.ceil(a / 4) * 4; u <= b; u += 4) { road.point(E + u, r.dOf(u), _p); chunk.addCollider({ x: _p.x, z: _p.z, r: 0.35, kind: "rail" }); }
        }
        if (inChunk(r.a) && models.exits_railend) {
            const slope = (r.dOf(r.a + 1) - r.dOf(r.a - 1)) / 2;
            mg.add(models.exits_railend, mtxAt(at(E, r.a, r.dOf(r.a), Math.PI - Math.atan(slope))), null, { at: [0, 0], noShadow: true });
        }
    }
    for (const mesh of mg.build(mats().look)) { chunk.add(mesh); chunk.own(mesh.geometry); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); }
    if (signs.length) { const sm = signMesh(signs); chunk.add(sm); chunk.own(sm.geometry); }
}

// ── the gantry: EXIT ONLY over the decel lane (with its exit-number tab), ↑ THRU over the lanes ──
/** A board's face: green, a white border, the lines; `yellow` = a yellow EXIT ONLY strip along the bottom; `tab` = an
 *  exit-number tab at the top right. */
function boardTex(lines, w, h, yellow = null, tab = null) {
    return canvasTex(w, h, g => {
        const top = tab ? h * 0.2 : 0;
        if (tab) {
            const tw = w * 0.44;
            g.fillStyle = "#1f7a46"; g.beginPath(); g.roundRect(w - tw - 4, 4, tw, top + 18, 14); g.fill();
            g.strokeStyle = "#fff"; g.lineWidth = 5; g.beginPath(); g.roundRect(w - tw + 6, 12, tw - 20, top - 4, 9); g.stroke();
            g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
            g.font = `800 ${Math.round(top * 0.58)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(tab, w - tw / 2 - 4, 10 + top / 2, tw - 30);
        }
        g.fillStyle = "#1f7a46"; g.beginPath(); g.roundRect(4, 4 + top, w - 8, h - 8 - top, 22); g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 7; g.beginPath(); g.roundRect(14, 14 + top, w - 28, h - 28 - top, 16); g.stroke();
        let body = h - 36 - top;
        if (yellow) {
            const yh = (h - top) * 0.24;
            g.fillStyle = "#FFD600"; g.fillRect(20, h - 20 - yh, w - 40, yh);
            g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
            g.font = `800 ${Math.round(yh * 0.66)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(yellow, w / 2, h - 20 - yh / 2, w - 70);
            body -= yh + 4;
        }
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        const n = lines.length;
        lines.forEach((line, i) => {
            const size = (i === 0 ? 0.36 : 0.27) * body / Math.max(1.4, n * 0.72);
            g.font = `700 ${Math.round(size)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(line, w / 2, top + 22 + body * (i + 0.5) / n + 4, w - 60);
        });
    }, false);
}
function addGantry(chunk, world, e) {
    const road = world.highway, gs = e.s + GANTRY;
    const nu = models.exits_gantry;
    const IS = INTERCHANGE.signs, S0 = e.town.lines.SIGNS;
    const tab = e.two ? `EXITS ${e.towns.map(t => t.highway.no).filter(Boolean).join(" · ")}` : e.town.highway.no ? `EXIT ${e.town.highway.no}` : null;
    if (nu) {
        // the interchange gantry: post beyond the decel lane, an arm across the whole carriageway;
        // the EXIT ONLY board over the decel lane, ↑ THRU TRAFFIC over the through lanes
        const p = road.point(gs, 13.4, {});
        const g = nu.clone(true);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.h + Math.PI;              // the boards face us; the arm (model −X) reaches LEFT over our lanes
        g.updateMatrixWorld(true);
        const ex = e.two ? IS.exitOnly.slice(0, 2).map(l => fillLine(l, e.towns)) : [`EXIT ${e.town.highway.no || ""} ↘`, e.town.highway.label || e.town.name.toUpperCase()];
        const faces = [["Anchor_exit", boardTex(ex, 512, 360, "EXIT ONLY", tab), 4.1, 2.88, 0.24], ["Anchor_thru", boardTex(e.two ? IS.thru : [IS.thru[0], IS.thru[1], (S0.gantry && S0.gantry[1]) || IS.thru[2]], 640, 300), 6.0, 2.8, 0]];
        for (const [name, tex, w, h, up] of faces) {
            const a = findNodes(g, name)[0];
            if (!a) continue;
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.08, alphaTest: 0.4, transparent: false });
            const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            a.getWorldPosition(q.position);
            q.position.y += up;
            q.position.x -= Math.sin(p.h) * 0.02; q.position.z -= Math.cos(p.h) * 0.02;
            q.rotation.y = p.h + Math.PI;
            chunk.add(q);
            chunk.own(q.geometry); chunk.own(mat); chunk.own(tex);
        }
        chunk.add(g);
        chunk.addCollider({ x: p.x, z: p.z, r: 0.45, kind: "sign" });
        return;
    }
    if (!models.town_gantry) return;
    const p = road.point(gs, 13.4, {});
    const g = models.town_gantry.clone(true);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.h + Math.PI;
    g.scale.x = -1;
    g.updateMatrixWorld(true);
    const anchor = findNodes(g, "Anchor_sign")[0];
    if (anchor) {
        const lines = e.two ? INTERCHANGE.signs.exitOnly.map(l => fillLine(l, e.towns)) : e.town.lines.SIGNS.gantry;
        const mat = new THREE.MeshStandardMaterial({ map: signTexture(lines, "#1f7a46", "#ffffff", 768, 340), roughness: 0.6 });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 3.1), mat);
        anchor.getWorldPosition(q.position);
        q.position.x -= Math.sin(p.h) * 0.02; q.position.z -= Math.cos(p.h) * 0.02;
        q.rotation.y = p.h + Math.PI;
        chunk.add(q);
        chunk.own(q.geometry); chunk.own(mat);
    }
    chunk.add(g);
    chunk.addCollider({ x: p.x, z: p.z, r: 0.45, kind: "sign" });
}

// ── one exit, one chunk ──────────────────────────────────────────────────
function buildChunk(e, chunk, world, s0, s1) {
    const road = world.highway, E = e.s, MT = mats();
    const clip = (u0, u1) => [Math.max(s0, E + u0), Math.min(s1, E + u1)];
    const L = { ramp: [], local: [], gore: [], dash: [], paint: [] };
    let a, b;
    // the taper + parallel decel lane, its dashed EXIT ONLY line, the paint in it
    [a, b] = clip(TAPER0, RAMP0 + 2); if (a < b) L.ramp.push(strip(road, a, b, () => 6.9, s => taperEdge(s - E), 0.033));
    [a, b] = clip(TAPER0 + 30, RAMP0 + 8); if (a < b) L.dash.push(strip(road, a, b, () => 6.84, () => 7.16, 0.037, 6));
    for (const [u, r] of [[-150, UV_TEXT], [-136, UV_ARROW], [-96, UV_TEXT], [-82, UV_ARROW]]) if (E + u >= s0 && E + u < s1) {
        const len = r === UV_TEXT ? 7 : 4.6, w = r === UV_TEXT ? 3.0 : 2.0;
        L.paint.push(paintQuad(road, E, u, u + len, 9.1 - w / 2, 9.1 + w / 2, 0.042, r));
    }
    // the ramp: the shared stretch + the inner branch, the widening to the split, the outer branch
    [a, b] = clip(RAMP0, STOP_IN); if (a < b) L.ramp.push(strip(road, a, b, s => rampD(s - E) - HALF, s => rampD(s - E) + HALF, 0.034));
    if (e.two) {
        [a, b] = clip(0, PART); if (a < b) L.ramp.push(strip(road, a, b, s => rampD(s - E) + HALF - 0.3, s => outerD(s - E) + HALF, 0.0345));
        [a, b] = clip(PART - 2, STOP_OUT); if (a < b) L.ramp.push(strip(road, a, b, s => outerD(s - E) - HALF, s => outerD(s - E) + HALF, 0.034));
        [a, b] = clip(22, 44); if (a < b) L.gore.push(strip(road, a, b, s => rampD(s - E) + HALF, s => Math.max(rampD(s - E) + HALF + 0.05, outerD(s - E) - HALF), 0.036, 5));
    }
    // the painted gore between the highway's edge line and the ramp
    [a, b] = clip(RAMP0 + 8, RAMP0 + 70); if (a < b) L.gore.push(strip(road, a, b, () => 7.0, s => Math.max(7.05, rampD(s - E) - HALF), 0.036, 5));
    // STOP bars at the T-junctions
    for (const br of e.branches) if (E + br.stop >= s0 && E + br.stop < s1) {
        const dE = br.dOf(br.stop);
        L.paint.push(paintQuad(road, E, br.stop - 0.6, br.stop, dE - HALF + 0.3, dE + HALF - 0.3, 0.043, UV_WHITE));
    }
    // the local cross roads (the whole road goes with the chunk its centre line is in) + the corner into the on-ramp
    for (const c of crossRoads(e)) if (E + c.u >= s0 && E + c.u < s1) {
        L.local.push(crossStrip(road, E, c.u, XW, c.d0, c.d1, 0.035));
        if (c.k === 0) L.local.push(arcStrip(road, E, ON0, ON_D0 + ARC_R, ARC_R - XW, ARC_R + XW, Math.PI, Math.PI * 1.5, 0.0352));
    }
    // the on-ramp back, the merge gore, the accel lane tapering into the right lane (+ its dashed line)
    [a, b] = clip(ON0, ON1 + 2); if (a < b) L.ramp.push(strip(road, a, b, s => onD(s - E) - onHalf(s - E), s => onD(s - E) + onHalf(s - E), 0.034));
    [a, b] = clip(ON1 - 60, ON1 - 6); if (a < b) L.gore.push(strip(road, a, b, () => 7.0, s => Math.max(7.05, onD(s - E) - onHalf(s - E)), 0.036, 5));
    [a, b] = clip(ON1 - 2, ACC1); if (a < b) L.ramp.push(strip(road, a, b, () => 6.9, s => accelEdge(s - E), 0.033));
    [a, b] = clip(ON1 - 6, ACC1 - 30); if (a < b) L.dash.push(strip(road, a, b, () => 6.84, () => 7.16, 0.037, 6));
    addMerged(chunk, L.ramp, MT.ramp); addMerged(chunk, L.local, MT.local); addMerged(chunk, L.gore, MT.gore);
    addMerged(chunk, L.dash, MT.dash); addMerged(chunk, L.paint, MT.paint);
    // the props (their models load early; if not yet, they come in when they are)
    if (EXIT_MODELS.every(k => models[k])) buildProps(e, chunk, s0, s1);
    else ensureModels(EXIT_MODELS).then(() => { if (!chunk.dead && X.exits.includes(e)) buildProps(e, chunk, s0, s1); }).catch(err => console.warn("[town] exit models", err));
    const gs = E + GANTRY;
    if (gs >= s0 && gs < s1) addGantry(chunk, world, e);
}

on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (world.district) return;
    for (const e of X.exits) if (s1 > e.s + TAPER0 && s0 < e.s + ACC1 + 1) buildChunk(e, chunk, world, s0, s1);
});
on("chunk:dispose", ({ chunk }) => { chunk.dead = true; });
// load the gantry + the far end's props early (they're tiny), so the first exit has them
on("boot", () => {
    ensureModels(["exits_gantry"]).catch(() => ensureModels(["town_gantry"]).catch(() => {}));
    ensureModels(EXIT_MODELS).catch(() => {});
});
