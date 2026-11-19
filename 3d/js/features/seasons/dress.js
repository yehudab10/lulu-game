// features/seasons — THE DRESSING ENGINE: how a whole town full of menorahs stays cheap.
//
//   Props     every seasonal piece (seasons_props.glb, Prop_<Name>) is baked ONCE into one vertex-coloured geometry
//             (+ a separate glowing one for cartoon flames). Each kind is ONE InstancedMesh for the whole world:
//             every few frames it is filled with the placements nearest the camera (≤ max within R), so 800 window
//             menorahs cost one draw call and ~30 × 110 triangles — the far ones are just their lights.
//   Lights    every candle / lamp / fire (the props' Light_<k> empties) is one point in ONE THREE.Points per size
//             (a soft additive glow sprite): no real light sources, fogged, hidden behind houses by the depth test,
//             faded in by atmos' night. A whole lit-up town = 3 draw calls.
//   Signs     a stall's sign is a textured quad (world.js signTexture, cached per text).
//
// Items come and go in SETS (a road chunk's, the town's): add(setKey, item) / drop(setKey). A set can carry a
// vis() predicate (a highway chunk hidden while she's in a town district). Nothing is built in a long frame:
// a set is a list of numbers; the meshes only re-fill.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import { signTexture } from "../../world.js";

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

// ── baking a prop ────────────────────────────────────────────────────────
const BAKED = new Map();
export const propNode = name => models.seasonsProps ? findNodes(models.seasonsProps, "Prop_" + name)[0] || null : null;

function bakeList(list) {
    let nv = 0, ni = 0;
    for (const { g } of list) { nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
    if (!nv) return null;
    const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3);
    const I = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const { g, m, c } of list) {
        const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
        _n.getNormalMatrix(m);
        for (let i = 0; i < n; i++) {
            _v.fromBufferAttribute(pos, i).applyMatrix4(m);
            P[(ov + i) * 3] = _v.x; P[(ov + i) * 3 + 1] = _v.y; P[(ov + i) * 3 + 2] = _v.z;
            if (nor) { _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); N[(ov + i) * 3] = _v.x; N[(ov + i) * 3 + 1] = _v.y; N[(ov + i) * 3 + 2] = _v.z; }
            else N[(ov + i) * 3 + 1] = 1;
            C[(ov + i) * 3] = c.r; C[(ov + i) * 3 + 1] = c.g; C[(ov + i) * 3 + 2] = c.b;
        }
        if (g.index) for (let k = 0; k < g.index.count; k++) I[oi + k] = g.index.getX(k) + ov;
        else for (let k = 0; k < n; k++) I[oi + k] = ov + k;
        oi += g.index ? g.index.count : n;
        ov += n;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    out.setIndex(new THREE.BufferAttribute(I, 1));
    out.computeBoundingSphere();
    return out;
}

/** A prop baked: { geo, flame (glowing parts, or null), lights: [Vector3] (Light_1…, Light_S last), anchors: {Sign, Goods}, tris }.
 *  tints: { MatName: "#hex" } recolours those materials (a variant is its own bake). */
export function baked(name, tints = null) {
    const key = name + (tints ? JSON.stringify(tints) : "");
    if (BAKED.has(key)) return BAKED.get(key);
    const node = propNode(name);
    if (!node) return null;
    node.updateMatrixWorld(true);
    const inv = node.matrixWorld.clone().invert();
    const solid = [], flame = [], lights = [], anchors = {};
    node.traverse(o => {
        if (o === node) return;
        const local = inv.clone().multiply(o.matrixWorld);
        if (o.isMesh) {
            const mat = Array.isArray(o.material) ? o.material[0] : o.material;
            const nm = (mat && mat.name) || "";
            const c = new THREE.Color().copy(mat && mat.color ? mat.color : new THREE.Color(1, 1, 1));
            if (tints && tints[nm]) c.set(tints[nm]);
            (/^Flame/.test(nm) ? flame : solid).push({ g: o.geometry, m: local, c });
        } else if (/^Light_/.test(o.name)) {
            lights.push({ k: o.name.slice(6), p: new THREE.Vector3().setFromMatrixPosition(local) });
        } else if (o.name === "Sign" || o.name === "Goods") {
            anchors[o.name] = new THREE.Vector3().setFromMatrixPosition(local);
        }
    });
    // lights in candle order: 1…8 then the shamash (S)
    lights.sort((a, b) => (a.k === "S" ? 99 : +a.k) - (b.k === "S" ? 99 : +b.k));
    const geo = bakeList(solid), fl = bakeList(flame);
    const b = { geo, flame: fl, lights: lights.map(l => l.p), lightKeys: lights.map(l => l.k), anchors, tris: (geo ? geo.index.count / 3 : 0) + (fl ? fl.index.count / 3 : 0) };
    BAKED.set(key, b);
    return b;
}

// ── the shared materials ─────────────────────────────────────────────────
let SOLID = null, FLAME = null;
const solidMat = () => SOLID || (SOLID = Object.assign(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.08 }), { name: "SeasonsSolid" }));
const flameMat = () => FLAME || (FLAME = Object.assign(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), { name: "SeasonsFlame" }));

let glowTex = null;
function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,250,225,1)"); gr.addColorStop(0.18, "rgba(255,226,140,0.95)"); gr.addColorStop(0.45, "rgba(255,170,50,0.35)"); gr.addColorStop(1, "rgba(255,140,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
}

// ── a kind of prop: one InstancedMesh (+ one for its flames), filled with the nearest placements ──
class Kind {
    constructor(root, id, b, { max = 32, R = 90, anim = null, live = false } = {}) {
        this.id = id; this.b = b; this.max = max; this.R = R; this.anim = anim; this.live = live;
        this.items = [];
        this.mesh = b.geo ? new THREE.InstancedMesh(b.geo, solidMat(), max) : null;
        this.fmesh = b.flame ? new THREE.InstancedMesh(b.flame, flameMat(), max) : null;
        for (const m of [this.mesh, this.fmesh]) if (m) {
            m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.count = 0; m.visible = false;
            m.name = "Seasons:" + id;
            root.add(m);
        }
        this.drawn = 0;
    }
    fill(cx, cz, t) {
        const R2 = this.R * this.R, near = [];
        for (const it of this.items) {
            if (it.set.vis && !it.set.vis()) continue;
            const dx = it.x - cx, dz = it.z - cz, d2 = dx * dx + dz * dz;
            if (d2 <= R2) near.push([d2, it]);
        }
        if (near.length > this.max) near.sort((a, b) => a[0] - b[0]);
        const n = Math.min(this.max, near.length);
        for (let i = 0; i < n; i++) {
            const it = near[i][1];
            _q.setFromAxisAngle(UP, it.rot);
            _m.compose(_v.set(it.x, it.y, it.z), _q, _s.setScalar(it.s || 1));
            if (this.mesh) this.mesh.setMatrixAt(i, _m);
            if (this.fmesh) {
                if (this.anim) this.anim(it, t, _m); else _m.compose(_v.set(it.x, it.y, it.z), _q, _s.setScalar(it.s || 1));
                this.fmesh.setMatrixAt(i, _m);
            }
        }
        for (const m of [this.mesh, this.fmesh]) if (m) { m.count = n; m.visible = n > 0; if (n) m.instanceMatrix.needsUpdate = true; }
        this.drawn = n;
    }
    dispose() { for (const m of [this.mesh, this.fmesh]) if (m) { if (m.parent) m.parent.remove(m); m.dispose(); } }
}

// ── the lights: one Points per size ──────────────────────────────────────
const GLOW = { candle: { size: 0.55, max: 9000 }, lamp: { size: 1.1, max: 600 }, fire: { size: 5.0, max: 64 } };
class Glow {
    constructor(root, kind) {
        const G = GLOW[kind];
        this.max = G.max; this.kind = kind;
        this.pos = new Float32Array(G.max * 3);
        this.geo = new THREE.BufferGeometry();
        this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
        this.geo.setDrawRange(0, 0);
        this.mat = new THREE.PointsMaterial({ map: glowTexture(), size: G.size, color: "#FFD27A", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
        // far away a candle is still a dot of light (≥ ~2.5 css px): a whole street of windows reads as lit from the end of it
        const minPx = (2.5 * ((ctx.renderer && ctx.renderer.getPixelRatio && ctx.renderer.getPixelRatio()) || 1)).toFixed(1);
        this.mat.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace("#include <fog_vertex>", `gl_PointSize = max(gl_PointSize, ${minPx});\n#include <fog_vertex>`); };
        this.mat.customProgramCacheKey = () => "seasonsGlow" + minPx;
        this.pts = new THREE.Points(this.geo, this.mat);
        this.pts.frustumCulled = false; this.pts.visible = false; this.pts.renderOrder = 3;
        this.pts.name = "SeasonsGlow:" + kind;
        root.add(this.pts);
        this.n = 0;
    }
    begin() { this.n = 0; }
    push(x, y, z) { if (this.n >= this.max) return; const i = this.n++ * 3; this.pos[i] = x; this.pos[i + 1] = y; this.pos[i + 2] = z; }
    end() { this.geo.setDrawRange(0, this.n); this.geo.attributes.position.needsUpdate = true; this.geo.attributes.position.addUpdateRange?.(0, this.n * 3); }
    show(o) { this.mat.opacity = o; this.pts.visible = o > 0.01 && this.n > 0; }
    dispose() { if (this.pts.parent) this.pts.parent.remove(this.pts); this.geo.dispose(); this.mat.dispose(); }
}

// ── the dresser ──────────────────────────────────────────────────────────
export const D = {
    root: null, kinds: new Map(), sets: new Map(), glows: {}, signs: [], frame: 0, glowDirty: true, lit: 0, litForce: null,
    stats: { items: 0, drawn: 0, lights: 0, tris: 0, calls: 0 },
};
/** Kinds the features use: id → { prop, tints, max, R, anim } (registered by index.js for the season in force). */
export const KINDS = {};

export function ensureRoot() {
    if (D.root) return D.root;
    D.root = new THREE.Group(); D.root.name = "Seasons";
    ctx.scene.add(D.root);
    for (const k of Object.keys(GLOW)) D.glows[k] = new Glow(D.root, k);
    return D.root;
}
function kind(id) {
    let k = D.kinds.get(id);
    if (k) return k;
    const def = KINDS[id];
    if (!def) return null;
    const b = baked(def.prop, def.tints || null);
    if (!b) return null;
    k = new Kind(ensureRoot(), id, b, def);
    D.kinds.set(id, k);
    return k;
}

/**
 * Add a set of items (a road chunk's, the town's). items: [{ kind, x, y, z, rot, s, lit: "candle" | "lamp" | "fire" | null,
 *   lights: n (how many of the prop's lights burn — a menorah: tonight's candles + the shamash), sign: {lines, bg, fg} }].
 * opts.vis: () → bool (drawn only while true).
 */
export function addSet(key, items, opts = {}) {
    dropSet(key);
    ensureRoot();
    const set = { key, items: [], vis: opts.vis || null, signs: [] };
    for (const it of items) {
        const k = kind(it.kind);
        if (!k) continue;
        const e = Object.assign({ set, s: 1, y: 0, rot: 0 }, it);
        e.k = k;
        k.items.push(e);
        set.items.push(e);
        if (it.sign && k.b.anchors.Sign) set.signs.push(makeSign(e, k.b.anchors.Sign, it.sign));
        if (it.goods && KINDS[it.goods] && k.b.anchors.Goods) {
            // what's on the counter rides along as an item of its own
            const a = rotXZ(k.b.anchors.Goods, e.rot, e.s);
            const g = kind(it.goods);
            if (g) { const ge = { set, k: g, kind: it.goods, x: e.x + a.x, y: e.y + a.y, z: e.z + a.z, rot: e.rot, s: e.s }; g.items.push(ge); set.items.push(ge); }
        }
    }
    D.sets.set(key, set);
    D.glowDirty = true;
    D.frame = 0;
    return set;
}
export function dropSet(key) {
    const set = D.sets.get(key);
    if (!set) return;
    for (const e of set.items) { const i = e.k.items.indexOf(e); if (i >= 0) e.k.items.splice(i, 1); }
    for (const s of set.signs) { if (s.parent) s.parent.remove(s); s.geometry.dispose(); }
    D.sets.delete(key);
    D.glowDirty = true;
    D.frame = 0;
}
export function dropAll() { for (const k of [...D.sets.keys()]) dropSet(k); }
export function dispose() {
    dropAll();
    for (const k of D.kinds.values()) k.dispose();
    D.kinds.clear();
    for (const g of Object.values(D.glows)) g.dispose();
    D.glows = {};
    for (const m of SIGN_MATS.values()) m.dispose();
    SIGN_MATS.clear();
    if (D.root && D.root.parent) D.root.parent.remove(D.root);
    D.root = null;
}
export const hasSet = key => D.sets.has(key);

function rotXZ(p, rot, s = 1) {
    const c = Math.cos(rot), si = Math.sin(rot);
    return { x: (p.x * c + p.z * si) * s, y: p.y * s, z: (-p.x * si + p.z * c) * s };
}

const SIGN_MATS = new Map();
const signGeo = new THREE.PlaneGeometry(1, 1);
function makeSign(e, at, spec) {
    const key = spec.lines.join("|") + spec.bg + spec.fg;
    let mat = SIGN_MATS.get(key);
    if (!mat) { mat = new THREE.MeshBasicMaterial({ map: signTexture(spec.lines, spec.bg, spec.fg, 512, 112), toneMapped: false }); SIGN_MATS.set(key, mat); }
    const m = new THREE.Mesh(signGeo, mat);
    const a = rotXZ(at, e.rot, e.s);
    m.position.set(e.x + a.x, e.y + a.y, e.z + a.z);
    m.rotation.y = e.rot;                     // (the prop's front is Blender −Y = +Z here: the sign faces out the front)
    m.scale.set(1.95 * e.s, 0.4 * e.s, 1);
    m.name = "SeasonsSign";
    m.userData.vis = e.set;
    D.root.add(m);
    return m;
}

/** Re-collect every burning light (a set changed). */
function collectLights() {
    for (const g of Object.values(D.glows)) g.begin();
    for (const set of D.sets.values()) {
        if (set.vis && !set.vis()) continue;
        for (const e of set.items) {
            if (!e.lit || !e.k.b.lights.length) continue;
            const g = D.glows[e.lit];
            if (!g) continue;
            const L = e.k.b.lights, n = e.lights == null ? L.length : Math.min(L.length, e.lights);
            const keys = e.k.b.lightKeys;
            for (let i = 0; i < L.length; i++) {
                // a menorah: candles 1…n + the shamash (always lit)
                if (keys[i] !== "S" && i >= n) continue;
                const p = rotXZ(L[i], e.rot, e.s);
                g.push(e.x + p.x, e.y + p.y, e.z + p.z);
            }
        }
    }
    for (const g of Object.values(D.glows)) g.end();
    D.glowDirty = false;
}

/** Every frame the driving scene shows: re-fill the near instances (every few frames), fade the lights by night. */
export function tick(dt, night, cam) {
    if (!D.root) return;
    D.frame++;
    const t = ctx.time;
    let visDirty = false;
    // a set whose visibility flipped (her town ↔ the highway) re-collects the lights
    for (const set of D.sets.values()) if (set.vis) { const v = !!set.vis(); if (v !== set._v) { set._v = v; visDirty = true; } }
    if (visDirty) D.glowDirty = true;
    if (D.glowDirty) collectLights();
    const every = ctx.TEST ? 1 : 6;
    let drawn = 0, tris = 0, calls = 0, items = 0;
    for (const k of D.kinds.values()) {
        items += k.items.length;
        if (k.anim || k.live || D.frame % every === 1 || every === 1 || visDirty) k.fill(cam.x, cam.z, t);
        drawn += k.drawn;
        tris += k.drawn * k.b.tris;
        calls += k.drawn ? (k.mesh ? 1 : 0) + (k.fmesh ? 1 : 0) : 0;
    }
    for (const s of D.root.children) if (s.name === "SeasonsSign") { const set = s.userData.vis; s.visible = !set.vis || !!set.vis(); if (s.visible) { calls++; tris += 2; } }
    const lit = D.litForce != null ? D.litForce : night;
    D.lit = lit;
    let lights = 0;
    for (const g of Object.values(D.glows)) {
        // fires burn all day (a little dimmer in the sun); candles + lamps show from dusk
        const o = g.kind === "fire" ? 0.55 + 0.45 * lit : Math.min(1, Math.max(0, (lit - 0.12) * 1.6));
        g.show(o);
        if (g.pts.visible) { calls++; lights += g.n; }
    }
    Object.assign(D.stats, { items, drawn, lights, tris: Math.round(tris), calls });
}
