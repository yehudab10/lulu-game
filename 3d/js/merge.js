// Static scenery → a few merged, vertex-coloured meshes (the highway's version of
// features/town/kit.js). A road chunk's trees, bushes, houses and power poles used to
// be one InstancedMesh per material per model (≈ 16 draw calls a chunk, the same again
// in the shadow pass); merged they are ~4: one per "look" (same roughness / metalness),
// split into shadow-casting (near the road) and not (out in the fields), leaves on their
// own look (they sway in the wind: core/quality.js patches that one material).
//
// Only plain parts merge: a material with a texture, transparency, an emissive glow or an
// animatable name (Neon, LightRed…) stays an instanced part (models.instanced(…, filter)),
// so a feature's scenery keeps exactly its look. "Window" parts merge into a look whose
// material SHARES the source window's emissive (atmos lights the windows at night).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const LIVE = /^(Headlight|Taillight|LightRed|LightBlue|Neon|Siren|Beacon|Glass|Lamp|Water)/;
const LEAF = /Leaves|^Brush$|^Bush/i;
const WINDOW = /^(Window|ShopWindow)$/;

/** Each mesh of a template with its transform relative to the template root (cached). */
export function templateParts(template) {
    if (template.userData.mergeParts) return template.userData.mergeParts;
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert();
    const parts = [];
    template.traverse(o => {
        if (!o.isMesh || Array.isArray(o.material)) return;
        parts.push({ geometry: o.geometry, material: o.material, local: inv.clone().multiply(o.matrixWorld), cast: o.castShadow, name: o.material.name || "" });
    });
    template.userData.mergeParts = parts;
    return parts;
}

/** Can this material's parts be baked into vertex colours without changing the look? */
export function plainMaterial(m) {
    if (!m || !m.isMeshStandardMaterial || m.map || m.transparent || m.alphaTest > 0 || m.vertexColors) return false;
    const n = m.name || "";
    if (WINDOW.test(n)) return !!m.emissive;
    if (LIVE.test(n)) return false;
    if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.001 && m.emissiveIntensity > 0) return false;
    return true;
}

/** A copy of geometry g transformed by m, one colour (+ optional per-vertex sway weight: its height). */
export function bakeGeometry(g, m, color, sway = false) {
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
    _n.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(m);
        P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z;
        if (nor) { _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); N[i * 3] = _v.x; N[i * 3 + 1] = _v.y; N[i * 3 + 2] = _v.z; }
        else N[i * 3 + 1] = 1;
        C[i * 3] = color.r; C[i * 3 + 1] = color.g; C[i * 3 + 2] = color.b;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(P, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.BufferAttribute(C, 3));
    if (sway) {
        // sway weight = height above the model's base (trunks stay put, crowns move)
        const W = new Float32Array(n), y0 = m.elements[13];
        for (let i = 0; i < n; i++) W[i] = Math.max(0, P[i * 3 + 1] - y0);
        out.setAttribute("sway", new THREE.BufferAttribute(W, 1));
    }
    if (g.index) out.setIndex(new THREE.BufferAttribute(g.index.array.slice(), 1));
    else { const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) idx[i] = i; out.setIndex(new THREE.BufferAttribute(idx, 1)); }
    return out;
}

// ── the look materials (shared by every chunk; never disposed — a handful) ─
const LOOKS = new Map();
/** Called for every new leaf look material (quality.js adds the wind sway). */
export const lookHooks = { leaf: null };
function lookMaterial(src, leaf) {
    const win = WINDOW.test(src.name || "");
    const key = win ? "w:" + src.uuid : `${leaf ? "leaf" : "solid"}:${(src.roughness ?? 1).toFixed(2)}:${(src.metalness ?? 0).toFixed(2)}:${src.flatShading ? 1 : 0}:${src.side}`;
    let m = LOOKS.get(key);
    if (m) return m;
    m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: src.roughness ?? 1, metalness: src.metalness ?? 0, flatShading: !!src.flatShading, side: src.side });
    m.name = win ? src.name : leaf ? "MergedLeaves" : "MergedSolid";
    if (win) {
        // the same emissive Color object + intensity as the source: atmos lights it with the template's windows
        m.emissive = src.emissive;
        Object.defineProperty(m, "emissiveIntensity", { get: () => src.emissiveIntensity, set: () => { }, configurable: true });
    }
    if (leaf) { m.userData.leaf = true; if (lookHooks.leaf) lookHooks.leaf(m); }
    LOOKS.set(key, m);
    return m;
}
export function leafMaterials() { return [...LOOKS.values()].filter(m => m.userData.leaf); }

/**
 * Collects the static pieces of ONE chunk, then bakes them.
 *   add(template, matrix, tints, { cast })   tints: { MatName: THREE.Color | "#hex" }
 *   build() → { meshes: [Mesh], rest: [{ template, list: [{ matrix, tints }] }] }  (rest = the parts that don't merge)
 */
export class ChunkMerger {
    constructor() { this.looks = new Map(); this.rest = new Map(); this.tris = 0; }
    add(template, matrix, tints = null, { cast = true } = {}) {
        let hasRest = false;
        for (const p of templateParts(template)) {
            if (!plainMaterial(p.material)) { hasRest = true; continue; }
            const leaf = LEAF.test(p.name);
            const mat = lookMaterial(p.material, leaf);
            const c = cast && p.cast;
            const key = mat.uuid + (c ? ":c" : ":n");
            let L = this.looks.get(key);
            if (!L) this.looks.set(key, L = { mat, cast: c, list: [] });
            const t = tints && tints[p.name];
            if (t) _c.set(t); else _c.copy(p.material.color);
            L.list.push(bakeGeometry(p.geometry, _m.multiplyMatrices(matrix, p.local), _c, leaf));
            this.tris += (p.geometry.index ? p.geometry.index.count : p.geometry.attributes.position.count) / 3;
        }
        if (hasRest) {
            let r = this.rest.get(template);
            if (!r) this.rest.set(template, r = { template, list: [] });
            const tc = {};
            if (tints) for (const k of Object.keys(tints)) tc[k] = new THREE.Color(tints[k]);
            r.list.push({ matrix: matrix.clone(), tints: tc });
        }
    }
    build() {
        const meshes = [];
        for (const L of this.looks.values()) {
            const g = mergeGeometries(L.list, false);
            for (const x of L.list) x.dispose();
            if (!g) continue;
            g.computeBoundingSphere();
            const mesh = new THREE.Mesh(g, L.mat);
            mesh.castShadow = L.cast;
            mesh.receiveShadow = true;
            mesh.matrixAutoUpdate = false;
            mesh.name = L.mat.name;
            meshes.push(mesh);
        }
        this.looks.clear();
        const rest = [...this.rest.values()];
        this.rest.clear();
        return { meshes, rest };
    }
}

/** For models.instanced(): only the parts that did NOT merge. */
export const restFilter = p => !plainMaterial(p.material);

// ── Slot batches: the same material across many owners (ci/perf4) ─────────────────────────────────────────────────
// Every highway chunk had its own road, shoulders, driveways and sign metal: one draw call each, so ~4–6 a chunk and
// ~25 on the open highway. A SlotBatch draws ALL of one material's pieces as ONE BatchedMesh (one WEBGL_multi_draw call;
// without the extension three draws them one by one — no worse than before). Each piece lives in a reserved slot of
// the batch's buffers; a slot that's freed (its chunk recycled) is reused by the next piece that fits, so a long
// drive doesn't grow the buffers. The piece follows its OWNER: drawn only while the owner and every parent up to the
// scene are visible (the chunk's draw-distance cull, a district hiding the highway, a sign group taken down), at the
// owner's matrixWorld (a chunk is at the origin; a sign group stands where it stands) — read right before each draw,
// main pass and shadow pass. The batch draws with its own copy of the material, kept in step with the original right
// before each draw (the weather darkening the road, the wet road's reflection… still apply): one material drawn both
// batched and plain (the sign metal, the driveways are also used by features' own meshes) would make three switch its
// shader program back and forth every frame.
//
//   const b = new SlotBatch(material, scene, { cast, name })
//   const item = b.add(geometry, owner)   → null if it can't (different attributes: draw a Mesh instead); the
//                                           geometry's data is COPIED in (dispose yours)
//   b.remove(item)
const _bs = new THREE.Sphere();
export class SlotBatch {
    constructor(material, scene, { cast = false, receive = true, name = "slotBatch" } = {}) {
        this.src = material; this.material = material.clone(); this.ver = material.version; this.dver = this.material.version; this.scene = scene; this.cast = cast; this.receive = receive; this.name = name;
        this.mesh = null; this.items = []; this.free = []; this.cap = null; this.verts = 0; this.idx = 0; this.insts = 0; this.attrs = null;
    }
    _sig(geo) { return Object.keys(geo.attributes).sort().map(k => k + geo.attributes[k].itemSize + (geo.attributes[k].normalized ? "n" : "")).join(",") + (geo.index ? "+i" : ""); }
    _init(geo) {
        this.attrs = this._sig(geo);
        this.cap = { v: 8192, i: 16384, n: 64 };
        const m = this.mesh = new THREE.BatchedMesh(this.cap.n, this.cap.v, this.cap.i, this.material);
        m.name = this.name;
        m.castShadow = this.cast; m.receiveShadow = this.receive; m.frustumCulled = false;
        // (no per-piece culling: a piece is a few hundred triangles, and then a frame where nothing changed costs no
        //  re-upload at all — three only rebuilds the draw list when a piece's visibility changes)
        m.sortObjects = false; m.perObjectFrustumCulled = false; m.matrixAutoUpdate = false;
        const base = THREE.BatchedMesh.prototype.onBeforeRender;
        m.onBeforeRender = (r, s, c, g, mt, grp) => { this.sync(); return base.call(m, r, s, c, g, mt, grp); };   // (the shadow pass calls this too)
        this.scene.add(m);
    }
    add(geo, owner) {
        if (!geo || !geo.attributes.position || geo.groups.length > 1) return null;
        if (!this.mesh) this._init(geo);
        if (this._sig(geo) !== this.attrs) return null;
        const v = geo.attributes.position.count, i = geo.index ? geo.index.count : 0;
        // a freed slot it fits in (the smallest), else a new one rounded up so near sizes can reuse it later
        let k = -1;
        for (let j = 0; j < this.free.length; j++) { const f = this.free[j]; if (f.v >= v && f.i >= i && (k < 0 || f.v < this.free[k].v)) k = j; }
        let slot;
        if (k >= 0) { slot = this.free.splice(k, 1)[0]; this.mesh.setGeometryAt(slot.gid, geo); }
        else {
            const rv = Math.ceil(v / 32) * 32, ri = Math.ceil(i / 96) * 96;
            this._grow(this.verts + rv, this.idx + ri, this.insts);
            slot = { gid: this.mesh.addGeometry(geo, rv, ri || -1), v: rv, i: ri };
            this.verts += rv; this.idx += ri;
        }
        this._grow(this.verts, this.idx, this.insts + 1);
        const id = this.mesh.addInstance(slot.gid);
        this.insts++;
        if (!geo.boundingSphere) geo.computeBoundingSphere();
        const item = { slot, id, owner, sphere: geo.boundingSphere.clone(), last: new Float64Array(16).fill(NaN), vis: false };
        this.items.push(item);
        owner.updateMatrixWorld(true);
        this.mesh.setVisibleAt(id, false);           // (shown by the next sync, if its owner is in view)
        return item;
    }
    remove(item) {
        if (!item || !this.mesh) return;
        const k = this.items.indexOf(item);
        if (k < 0) return;
        this.items.splice(k, 1);
        this.mesh.deleteInstance(item.id);
        this.insts--;
        this.free.push(item.slot);
    }
    _grow(needV, needI, needN) {
        const c = this.cap, m = this.mesh;
        if (needV > c.v || needI > c.i) { c.v = Math.max(c.v * 2, needV); c.i = Math.max(c.i * 2, needI); m.setGeometrySize(c.v, c.i); }
        if (needN > c.n) { c.n = Math.max(c.n * 2, needN); m.setInstanceCount(c.n); }
    }
    /** Every piece: drawn while its owner (and all its parents up to a scene) is visible, at the owner's matrixWorld. */
    /** The batch's material follows the original: everything after a needsUpdate, the colours / roughness /
     *  reflection that features change on the fly every frame. */
    mirror() {
        const s = this.src, d = this.material;
        // (a recompile asked of the batch's copy — the tier change turning shadows on / off does it to everything in the
        //  scene — goes to the original too, which may not be in the scene any more but is still used by features' meshes)
        if (d.version !== this.dver) { s.needsUpdate = true; this.ver = s.version; this.dver = d.version; }
        if (s.version !== this.ver) { d.copy(s); d.needsUpdate = true; this.ver = s.version; this.dver = d.version; return; }
        d.color.copy(s.color); d.roughness = s.roughness; d.metalness = s.metalness; d.envMap = s.envMap; d.envMapIntensity = s.envMapIntensity;
        if (d.emissive) { d.emissive.copy(s.emissive); d.emissiveIntensity = s.emissiveIntensity; }
        d.opacity = s.opacity; d.visible = s.visible;
    }
    sync() {
        this.mirror();
        const m = this.mesh, items = this.items;
        let any = false;
        for (let j = 0; j < items.length; j++) {
            const it = items[j];
            let vis = true, a = it.owner, top = a;
            for (; a; a = a.parent) { if (!a.visible) vis = false; top = a; }
            if (!top.isScene) vis = false;
            if (vis !== it.vis) { it.vis = vis; m.setVisibleAt(it.id, vis); }
            if (!vis) continue;
            any = true;
            // (only a piece that moved is written: a still frame uploads nothing)
            const e = it.owner.matrixWorld.elements, l = it.last;
            for (let k = 0; k < 16; k++) if (e[k] !== l[k]) { l.set(e); m.setMatrixAt(it.id, it.owner.matrixWorld); break; }
        }
        return any;
    }
    /** World-space bounds of one piece (Chunk.bounds). */
    sphereOf(item) { return _bs.copy(item.sphere).applyMatrix4(item.owner.matrixWorld); }
    info() { return { items: this.items.length, free: this.free.length, verts: this.verts, idx: this.idx, slots: this.items.length + this.free.length }; }
}
