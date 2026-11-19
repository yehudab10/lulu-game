// features/exits — drawing a rest area into the highway's road chunks (chunk:build, so the same
// chunk always rebuilds the same way, and the chunk system hides / recycles it like any set piece).
// Per chunk: ONE asphalt mesh (ramps + lot), the stall lines, the gore paint, the sidewalk, the
// props MERGED into a few vertex-coloured meshes (features/town/kit.js — the town's own kit), and
// one quad mesh for every sign face (a shared atlas). ~8–10 draw calls a chunk, 3–4 chunks.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on } from "../../core/ctx.js";
import { models, registerModels, ensureModels } from "../../models.js";
import { canvasTex, facingRoad } from "../../world.js";
import { Merger, Atlas, lookMaterials } from "../town/kit.js";
import * as LY from "./layout.js";
import { LOT, NAMES } from "./lines.js";

const OWN = ["exits_building", "exits_canopy", "exits_semi", "exits_picnic", "exits_vending", "exits_kiosk", "exits_garage", "exits_dogrun", "exits_lamp"];
registerModels(Object.fromEntries(OWN.map(k => [k, k])));
/** What a rest area needs before its chunks build (the cars + trees are core, already loaded). */
export const MODELS = OWN;

// ── shared materials (made once) ─────────────────────────────────────────
let M = null;
function mats() {
    if (M) return M;
    const speck = (g, w, h, n) => { for (let i = 0; i < n; i++) { g.fillStyle = ["#676b73", "#53575e", "#70747c"][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); } };
    const rampTex = canvasTex(128, 256, (g, w, h) => { g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h); speck(g, w, h, 1600); g.fillStyle = "#f4f4f0"; g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h); });
    const lotTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#5a5e66"; g.fillRect(0, 0, w, h); speck(g, w, h, 4000); g.fillStyle = "rgba(30,30,34,.18)"; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 18, 0, 7); g.fill(); } });
    const goreTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h); g.strokeStyle = "#f4f4f0"; g.lineWidth = 7; g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w / 2, h * 0.25); g.lineTo(w, h * 0.75); g.stroke(); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h); });
    const stallTex = canvasTex(32, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, 3); });
    const dashTex = canvasTex(8, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h / 3); });
    const off = f => ({ polygonOffset: true, polygonOffsetFactor: f, polygonOffsetUnits: f });
    M = {
        ramp: new THREE.MeshStandardMaterial(Object.assign({ map: rampTex, roughness: 0.92 }, off(-3))),
        lot: new THREE.MeshStandardMaterial(Object.assign({ map: lotTex, roughness: 0.95 }, off(-3))),
        gore: new THREE.MeshStandardMaterial(Object.assign({ map: goreTex, roughness: 0.8 }, off(-4))),
        stall: new THREE.MeshStandardMaterial(Object.assign({ map: stallTex, roughness: 0.7, transparent: true, alphaTest: 0.5 }, off(-5))),
        dash: new THREE.MeshStandardMaterial(Object.assign({ map: dashTex, roughness: 0.7, transparent: true, alphaTest: 0.5 }, off(-5))),
        walk: new THREE.MeshStandardMaterial({ color: "#C9C4BA", roughness: 0.95 }),
        look: lookMaterials(),
    };
    return M;
}
/** The props' merged looks (life.js lights the windows / lamps at night). */
export function lookMats() { return mats().look; }

// ── the sign atlas: every lot sign + every rest area's name, drawn once ──
let AT = null;
function atlas() {
    if (AT) return AT;
    const a = new Atlas(1024);
    const cell = (key, lines, bg, fg = "#fff", w = 512, h = 192) => a.sign({ key, lines, bg, fg, w, h, border: fg });
    const C = {
        food: cell("food", LOT.food, "#2E7D5B"), restroom: cell("restroom", LOT.restroom, "#1565C0"), vending: cell("vending", LOT.vending, "#C62828", "#fff", 384, 160),
        souvenir: cell("souvenir", LOT.souvenir, "#4A148C"), mechanic: cell("mechanic", LOT.mechanic, "#E65100", "#fff", 768, 128), gas: cell("gas", LOT.gas, "#1565C0", "#fff", 768, 96),
        pets: cell("pets", LOT.pets, "#6D4C41", "#fff", 384, 192), picnic: cell("picnic", LOT.picnic, "#2E7D32", "#fff", 384, 192), stay: cell("stay", LOT.stay, "#FAFAFA", "#C62828", 256, 192),
    };
    C.names = NAMES.map((n, i) => cell("name" + i, [n.name, n.sub], "#1B5E20", "#FFF59D", 768, 128));
    C.monument = NAMES.map((n, i) => cell("mon" + i, [n.name, n.sub, "FOOD · GAS · RESTROOMS"], "#1B5E20", "#fff", 512, 256));
    const m0 = a.mesh();            // packs + draws the canvas (no quads: each chunk builds its own); we keep its material
    m0.geometry.dispose();
    AT = { C, mat: m0.material };
    return AT;
}
/** A mesh of sign quads: [{cell, x, y, z, yaw, w, h}]. */
function signMesh(list) {
    const A = atlas();
    const P = [], U = [], N = [], I = [];
    const v = new THREE.Vector3(), mtx = new THREE.Matrix4(), e = new THREE.Euler();
    list.forEach((q, k) => {
        mtx.makeRotationFromEuler(e.set(0, q.yaw, 0, "YXZ")).setPosition(q.x, q.y, q.z);
        for (const [x, y] of [[-q.w / 2, -q.h / 2], [q.w / 2, -q.h / 2], [q.w / 2, q.h / 2], [-q.w / 2, q.h / 2]]) { v.set(x, y, 0).applyMatrix4(mtx); P.push(v.x, v.y, v.z); }
        const [u0, v0, u1, v1] = q.cell.uv;
        U.push(u0, v0, u1, v0, u1, v1, u0, v1);
        const nx = Math.sin(q.yaw), nz = Math.cos(q.yaw);
        for (let i = 0; i < 4; i++) N.push(nx, 0, nz);
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

// ── small runtime templates (sign posts) ─────────────────────────────────
let POST = null;
function postTemplate() {
    if (POST) return POST;
    const grp = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: "#8E979E", name: "Post" });
    for (const x of [-0.7, 0.7]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.2, 0.1), mat); m.position.set(x, 1.1, 0); grp.add(m); }
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 0.06), new THREE.MeshStandardMaterial({ color: "#37474F", name: "Board" }));
    back.position.set(0, 2.0, -0.04); grp.add(back);
    POST = grp;
    return POST;
}

// ── helpers ──────────────────────────────────────────────────────────────
const _p = {}, _m = new THREE.Matrix4(), _v = new THREE.Vector3();
/** World position + yaw of (u, d) at rest area R. */
export function at(R, u, d, yaw = "road", out = {}) {
    const road = ctx.world.highway;
    road.point(R.s + u, d, _p);
    out.x = _p.x; out.z = _p.z; out.h = _p.h; out.s = R.s + u;
    out.yaw = typeof yaw === "number" ? _p.h + yaw : yaw === "along" ? _p.h : yaw === "back" ? _p.h + Math.PI : yaw === "right" ? _p.h - Math.PI / 2 : facingRoad(_p.h, 1);
    return out;
}
function matAt(R, u, d, yaw) { const q = at(R, u, d, yaw); return _m.makeRotationY(q.yaw).setPosition(q.x, 0, q.z).clone(); }
/** An anchor of a template placed with matrix m, in world coords. */
function anchorWorld(tpl, name, m, out = new THREE.Vector3()) {
    tpl.updateMatrixWorld(true);
    const n = tpl.getObjectByName(name);
    if (!n) return null;
    const rel = tpl.matrixWorld.clone().invert().multiply(n.matrixWorld);
    out.setFromMatrixPosition(rel).applyMatrix4(m);
    return out;
}
/** A strip between d0(s) and d1(s) along the highway, s ∈ [a, b] (uv: across 0..1, along s / vScale). */
function strip(road, a, b, d0, d1, y, vScale, uFn = null) {
    const n = Math.max(2, Math.round((b - a) / 2) + 1);
    const pos = [], uv = [], nor = [], idx = [];
    for (let k = 0; k < n; k++) {
        const s = a + (b - a) * k / (n - 1), A = d0(s), B = d1(s);
        road.point(s, A, _p); pos.push(_p.x, y, _p.z);
        road.point(s, B, _p); pos.push(_p.x, y, _p.z);
        if (uFn) uv.push(uFn(A), s / vScale, uFn(B), s / vScale); else uv.push(0, s / vScale, 1, s / vScale);
        nor.push(0, 1, 0, 0, 1, 0);
        if (k < n - 1) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
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

// ── one rest area, one chunk ─────────────────────────────────────────────
export function buildChunk(R, chunk, world, s0, s1) {
    const road = world.highway, E = R.s, MT = mats();
    const clip = (u0, u1) => [Math.max(s0, E + u0), Math.min(s1, E + u1)];
    const ramp = [], lot = [], gore = [], stall = [], dash = [], walk = [];
    let a, b;
    // asphalt: decel lane, off-ramp, the lot (minus the lawn), on-ramp, accel lane
    [a, b] = clip(LY.TAPER0, LY.RAMP0 + 2); if (a < b) ramp.push(strip(road, a, b, () => 6.9, s => LY.decelEdge(s - E), 0.033, 12));
    [a, b] = clip(LY.RAMP0, LY.RAMP1 + 6); if (a < b) ramp.push(strip(road, a, b, s => LY.offD(s - E) - LY.HALF, s => LY.offD(s - E) + LY.HALF, 0.034, 12));
    [a, b] = clip(LY.ON0 - 6, LY.ON1); if (a < b) ramp.push(strip(road, a, b, s => LY.onD(s - E) - LY.HALF, s => LY.onD(s - E) + LY.HALF, 0.034, 12));
    [a, b] = clip(LY.ON1 - 2, LY.ACC1); if (a < b) ramp.push(strip(road, a, b, () => 6.9, s => LY.accelEdge(s - E), 0.033, 12));
    const uLot = d => d / 9;
    [a, b] = clip(LY.LOT0, LY.LOT1); if (a < b) lot.push(strip(road, a, b, () => LY.LOT_D0, () => LY.LAWN.d0, 0.032, 9, uLot));
    [a, b] = clip(LY.LAWN.u1, LY.LOT1); if (a < b) lot.push(strip(road, a, b, () => LY.LAWN.d0 - 0.2, () => LY.LOT_D1, 0.032, 9, uLot));
    // the gores + the dashed lane lines that keep the right lane going straight
    [a, b] = clip(LY.RAMP0 + 6, LY.RAMP0 + 60); if (a < b) gore.push(strip(road, a, b, () => 7.0, s => Math.max(7.05, LY.offD(s - E) - LY.HALF), 0.036, 5));
    [a, b] = clip(LY.ON1 - 60, LY.ON1 - 6); if (a < b) gore.push(strip(road, a, b, () => 7.0, s => Math.max(7.05, LY.onD(s - E) - LY.HALF), 0.036, 5));
    [a, b] = clip(LY.TAPER0 + 30, LY.RAMP0 + 6); if (a < b) dash.push(strip(road, a, b, () => 6.84, () => 7.16, 0.037, 6));
    [a, b] = clip(LY.ON1 - 6, LY.ACC1 - 30); if (a < b) dash.push(strip(road, a, b, () => 6.84, () => 7.16, 0.037, 6));
    // stall lines (one line per stall boundary) + the sidewalk in front of the building
    for (const row of LY.STALLS) { [a, b] = clip(row.u0, row.u1); if (a < b) stall.push(strip(road, a, b, () => row.d - 2.4, () => row.d + 2.4, 0.039, LY.STALL_W)); }
    [a, b] = clip(30, 124); if (a < b) walk.push(strip(road, a, b, () => 48, () => 51.4, 0.12, 4));
    addMerged(chunk, ramp, MT.ramp); addMerged(chunk, lot, MT.lot); addMerged(chunk, gore, MT.gore);
    addMerged(chunk, stall, MT.stall); addMerged(chunk, dash, MT.dash);
    const w = addMerged(chunk, walk, MT.walk); if (w) w.castShadow = false;

    // colliders
    for (const [u, d, r] of R.colliders) {
        const s = E + u;
        if (s < s0 || s >= s1) continue;
        road.point(s, d, _p);
        chunk.addCollider({ x: _p.x, z: _p.z, r, kind: "prop" });
    }
    // props (merged): models must be loaded — else they come in when they are
    if (MODELS.every(k => models[k])) buildProps(R, chunk, s0, s1);
    else ensureModels(MODELS).then(() => { if (!chunk.dead && R.alive) buildProps(R, chunk, s0, s1); }).catch(e => console.warn("[exits] models", e));
}
on("chunk:dispose", ({ chunk }) => { chunk.dead = true; });

function buildProps(R, chunk, s0, s1) {
    const E = R.s, mg = new Merger(2000), signs = [];
    const inChunk = u => E + u >= s0 && E + u < s1;
    for (const p of LY.PROPS) {
        if (!inChunk(p.u)) continue;
        const tpl = models[p.key], m = matAt(R, p.u, p.d, p.yaw);
        mg.add(tpl, m, p.tint || null, { at: [0, 0] });
        // the faces on the props' anchors
        const q = at(R, p.u, p.d, p.yaw), fx = Math.sin(q.yaw) * 0.06, fz = Math.cos(q.yaw) * 0.06;
        const face = (anchor, cell, w, h, dy = 0) => { const v = anchorWorld(tpl, anchor, m); if (v) signs.push({ cell, x: v.x + fx, y: v.y + dy, z: v.z + fz, yaw: q.yaw, w, h }); };
        const C = atlas().C;
        if (p.id === "building") { face("Anchor_sign", C.names[R.k % NAMES.length], 21.4, 1.4); face("Anchor_foodSign", C.food, 6.0, 1.5, 0.95); face("Anchor_restSign", C.restroom, 4.6, 1.4); }
        else if (p.id === "canopy") face("Anchor_sign", C.gas, 15.0, 0.38);
        else if (p.id === "garage") face("Anchor_sign", C.mechanic, 13.8, 0.95);
        else if (p.id === "kiosk") face("Anchor_sign", C.souvenir, 2.3, 0.52);
        else if (p.id === "vending") signs.push({ cell: C.vending, x: q.x + fx * 15, y: 2.45, z: q.z + fz * 15, yaw: q.yaw, w: 2.4, h: 0.85 });
    }
    // free-standing signs on posts: the monument at the entrance, the pet area, the picnic area, the 2 HR limit
    const C = atlas().C;
    const post = (u, d, yaw, cell, w, h, y) => {
        if (!inChunk(u)) return;
        const m = matAt(R, u, d, yaw); mg.add(postTemplate(), m, null, { at: [0, 0] });
        const q = at(R, u, d, yaw);
        signs.push({ cell, x: q.x + Math.sin(q.yaw) * 0.02, y, z: q.z + Math.cos(q.yaw) * 0.02, yaw: q.yaw, w, h });
    };
    post(16, 21.6, "back", C.monument[R.k % NAMES.length], 2.0, 1.0, 2.0);
    post(22, 50.8, "road", C.pets, 1.9, 0.95, 2.0);
    post(54, 49.0, "road", C.picnic, 1.9, 0.95, 2.0);
    post(150, LY.LOT_D0 - 1.1, "back", C.stay, 1.2, 0.9, 2.0);         // (on the verge, not in the drive aisle)
    for (const [u, d] of LY.LAMPS) if (inChunk(u)) mg.add(models.exits_lamp, matAt(R, u, d, "along"), null, { at: [0, 0] });
    for (const [u, d] of LY.TREES) if (inChunk(u) && models.treeRound) mg.add(models.treeRound, matAt(R, u, d, (u * 7) % 6.28), null, { at: [0, 0], noShadow: true });
    for (const c of R.cars) if (inChunk(c.u) && models[c.key]) mg.add(models[c.key], matAt(R, c.u, c.d, "right"), { Paint: c.color }, { at: [0, 0], noShadow: true });
    for (const mesh of mg.build(mats().look)) { chunk.add(mesh); chunk.own(mesh.geometry); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); }
    if (signs.length) { const sm = signMesh(signs); chunk.add(sm); chunk.own(sm.geometry); }
}
