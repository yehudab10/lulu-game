// Far LODs: a detailed model (a traffic car: 13–16 meshes, one draw call each, plus as many
// again in the shadow pass) becomes ONE vertex-coloured mesh once it is far from the camera.
//
//   const lod = farLod(car.obj);          // build lazily, the first time it is far away
//   updateLods(camera)                    // app.js, once a frame before the render
//   lod.dispose()                         // a chunk-owned model: unregister (chunk.own(lod))
//
// Only static, opaque, untextured parts are merged; anything a feature animates or that
// needs its own material (Headlight flashes, LightRed / LightBlue bars, Neon, Glass, a sign
// with a texture) stays real and visible. Parts a feature added after the LOD was built are
// never touched. Shared by every copy with the same model + colours (one geometry each).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { bakeGeometry as bake } from "./merge.js";

/** Distance (m) beyond which a model shows its far copy; quality tiers scale it (core/quality.js). */
export const LOD = { dist: 60 };
const LIVE = /^(Headlight|LightRed|LightBlue|Neon|Siren|Beacon|Glass|Lamp)/;
const MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.12 });
MAT.name = "LodFar";
const cache = new Map();          // signature → merged geometry (shared, never disposed: a handful of models × paints)
const live = new Set();
const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _c = new THREE.Color();

function mergeable(o) {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible || !o.geometry || !o.geometry.attributes.position) return false;
    const m = o.material;
    if (!m || Array.isArray(m) || m.transparent || m.map || !m.color || LIVE.test(m.name || "")) return false;
    return true;
}

class FarLod {
    constructor(root, dist) {
        this.root = root;
        this.dist = dist;
        this.parts = null;       // the meshes the far copy stands in for
        this.hidden = [];        // the ones WE hid (only these come back)
        this.far = null;
        this.on = false;
        this.dead = false;
        live.add(this);
    }
    build() {
        const root = this.root;
        root.updateMatrixWorld(true);
        _inv.copy(root.matrixWorld).invert();
        const parts = [], sig = [];
        root.traverse(o => { if (mergeable(o)) { parts.push(o); sig.push(o.geometry.uuid + o.material.color.getHexString()); } });
        this.parts = parts;
        if (parts.length < 3) return false;      // nothing to gain
        const key = sig.join("|");
        let geo = cache.get(key);
        if (!geo) {
            const list = parts.map(o => bake(o.geometry, _m.multiplyMatrices(_inv, o.matrixWorld), _c.copy(o.material.color)));
            geo = mergeGeometries(list, false);
            for (const g of list) g.dispose();
            if (!geo) return false;
            geo.computeBoundingSphere();
            cache.set(key, geo);
        }
        const far = this.far = new THREE.Mesh(geo, MAT);
        far.name = "lodFar";
        far.castShadow = false; far.receiveShadow = false;
        far.visible = false;
        root.add(far);
        return true;
    }
    set(farOn) {
        if (farOn === this.on) return;
        if (farOn) {
            if (!this.far && (this.parts || !this.build())) { this.parts = this.parts || []; return; }
            if (!this.far) return;
            for (const o of this.parts) if (o.visible) { o.visible = false; this.hidden.push(o); }
            this.far.visible = true;
        } else {
            for (const o of this.hidden) o.visible = true;
            this.hidden.length = 0;
            if (this.far) this.far.visible = false;
        }
        this.on = farOn;
    }
    /** Back to the full model and out of the registry (the model itself is left alone). */
    dispose() {
        if (this.dead) return;
        this.set(false);
        if (this.far && this.far.parent) this.far.parent.remove(this.far);
        this.dead = true;
        live.delete(this);
    }
}

/** Give a model a far copy (built lazily the first time it is far away). */
export function farLod(root, { dist = 0 } = {}) { return new FarLod(root, dist); }

/** Once a frame before the render: each registered model in the scene picks its near / far look. */
export function updateLods(camera) {
    if (!live.size) return;
    const cx = camera.position.x, cz = camera.position.z, base = LOD.dist;
    for (const l of live) {
        const r = l.root;
        if (!r.parent) continue;               // pooled / not in the scene
        const e = r.matrixWorld.elements, dx = e[12] - cx, dz = e[14] - cz;
        const d = (l.dist || base) * (l.on ? 0.92 : 1.08);   // a little hysteresis: no flicker at the edge
        l.set(dx * dx + dz * dz > d * d);
    }
}

/** Tests / the perf harness: how many models are registered and how many show their far copy. */
export function lodInfo() { let far = 0, n = 0; for (const l of live) { if (!l.root.parent) continue; n++; if (l.on) far++; } return { n, far, cached: cache.size, dist: LOD.dist }; }
