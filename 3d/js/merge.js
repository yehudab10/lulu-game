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
import { seeThrough, seeFlag } from "./core/seethrough.js";

const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const LIVE = /^(Headlight|Taillight|LightRed|LightBlue|Neon|Siren|Beacon|Glass|Lamp|Water)/;
const LEAF = /Leaves|^Brush$|^Bush/i;
const WINDOW = /^(Window|ShopWindow)$/;
const win = m => WINDOW.test(m.name || "");

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
export function bakeGeometry(g, m, color, sway = false, flag = 0) {
    const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3);
    _n.getNormalMatrix(m);
    for (let i = 0; i < n; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(m);
        P[i * 3] = _v.x; P[i * 3 + 1] = _v.y; P[i * 3 + 2] = _v.z;
        if (nor) { _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); N[i * 3] = _v.x; N[i * 3 + 1] = _v.y; N[i * 3 + 2] = _v.z; }
        else N[i * 3 + 1] = 1;
        C[i * 3] = color.r + flag; C[i * 3 + 1] = color.g; C[i * 3 + 2] = color.b;     // (flag: core/seethrough.js)
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
    if (leaf) { m.userData.leaf = true; if (lookHooks.leaf) lookHooks.leaf(m); seeThrough(m, { all: true }); }     // (between the camera and her they thin out: core/seethrough.js)
    else if (!win) seeThrough(m);       // (a trunk's vertices are flagged: cut along the line of sight too)
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
            // (a trunk in a solid look: flagged, cut along the line of sight — core/seethrough.js; the leaves' look is cut whole)
            L.list.push(bakeGeometry(p.geometry, _m.multiplyMatrices(matrix, p.local), _c, leaf, leaf || win(mat) ? 0 : seeFlag(p.name)));
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
