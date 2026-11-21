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

// ── Shadow proxies (MEDIUM / HIGH): a multi-part model casts its shadow in ONE draw ──────────────
// A traffic car is ~10–20 meshes, Lulu's car ~25: each one is a draw call in the sun's shadow pass too (renderer.info
// never shows those — three resets it after the shadow map). A proxy bakes the parts that cast (positions only, in the
// root's space) into one mesh that is hidden in the main pass and switched on only while the shadow map is drawn
// (installShadowProxies wraps renderer.shadowMap.render); the baked parts stop casting on their own. Same silhouette —
// a wheel turning on its axle casts the same shadow. Anything that changes the parts (one hidden or removed, the far
// LOD showing) hands the casting straight back to the real parts at once (never a missing shadow), and the proxy is
// re-baked from what's there a moment later.
//
//   const sp = shadowProxy(root, { skip: o => o.name === "Driver", lod })   // skip(node): leave that subtree alone
//   sp.dispose()                                                            // the parts cast on their own again
const SH = { live: new Set(), cache: new Map(), mats: new Map(), on: true, frame: 0, dropped: 0 };
function shMat(side) {
    let m = SH.mats.get(side);
    if (!m) { m = new THREE.MeshBasicMaterial({ side }); m.name = "ShadowProxy"; SH.mats.set(side, m); }
    return m;
}
function shGeometry(list) {
    // positions only (+ index): the depth material reads nothing else
    const geos = list.map(({ o, m }) => {
        const src = o.geometry, g = new THREE.BufferGeometry();
        g.setAttribute("position", src.attributes.position.clone().applyMatrix4(m));
        if (src.index) g.setIndex(src.index.clone());
        return g;
    });
    const indexed = geos.every(g => g.index);
    const merged = mergeGeometries(indexed ? geos : geos.map(g => (g.index ? g.toNonIndexed() : g)), false);
    for (const g of geos) g.dispose();
    if (merged) merged.computeBoundingSphere();
    return merged;
}
function shCastable(o) {
    if (!o.isMesh || !o.castShadow || !o.visible || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return false;
    if (o.geometry.morphAttributes && Object.keys(o.geometry.morphAttributes).length) return false;
    const m = o.material;
    // (an alpha-tested / alpha-mapped / textured-transparent part shadows through its texture: it keeps its own draw)
    if (!m || Array.isArray(m) || !m.visible || m.alphaTest > 0 || m.alphaMap || (m.map && m.transparent) || m.shadowSide != null) return false;
    return true;
}
class ShadowProxy {
    constructor(root, opts) {
        this.root = root; this.skip = opts.skip || null; this.lod = opts.lod || null;
        this.parts = []; this.meshes = []; this.entry = null; this.wait = 0; this.dead = false; this.drops = [];
        SH.live.add(this);
    }
    /** Bake the parts that cast right now (cached per layout: the same geometries at the same places — a wheel's spin
     *  doesn't change the key, so pooled / re-baked copies share one geometry). */
    build() {
        const root = this.root;
        root.updateMatrixWorld(true);
        _inv.copy(root.matrixWorld).invert();
        const bySide = new Map(), sig = [];
        const walk = o => {
            if (o !== root && (!o.visible || (this.skip && this.skip(o)))) return;
            if (o.name === "lodFar" || o.name === "shadowProxy") return;
            if (shCastable(o)) {
                const side = o.material.side;
                if (!bySide.has(side)) bySide.set(side, []);
                const m = new THREE.Matrix4().multiplyMatrices(_inv, o.matrixWorld), e = m.elements;
                bySide.get(side).push({ o, m });
                sig.push(o.geometry.uuid + "@" + side + ":" + Math.round(e[12] * 50) + "," + Math.round(e[13] * 50) + "," + Math.round(e[14] * 50));
            }
            for (const c of o.children) walk(c);
        };
        walk(root);
        if (sig.length < 3) return false;          // nothing to gain
        const key = sig.join("|");
        let entry = SH.cache.get(key);
        if (!entry) {
            entry = { users: 0, built: [...bySide].map(([side, list]) => ({ side, geo: shGeometry(list) })).filter(b => b.geo) };
            SH.cache.set(key, entry);
            // (bounded: a handful of models × layouts; unused ones are freed — GPU memory too — past 64)
            if (SH.cache.size > 64) for (const [k, en] of SH.cache) {
                if (SH.cache.size <= 48) break;
                if (en.users > 0 || en === entry) continue;
                for (const b of en.built) b.geo.dispose();
                SH.cache.delete(k);
            }
        }
        entry.users++;
        this.entry = entry;
        for (const b of entry.built) {
            const mesh = new THREE.Mesh(b.geo, shMat(b.side));
            mesh.name = "shadowProxy";
            mesh.castShadow = true; mesh.receiveShadow = false; mesh.visible = false;
            mesh.matrixAutoUpdate = false;         // (identity in the root's space)
            root.add(mesh);
            mesh.updateMatrixWorld(true);          // (baked mid-frame, inside the shadow pass: placed right away)
            this.meshes.push(mesh);
        }
        for (const l of bySide.values()) for (const { o } of l) { o.castShadow = false; this.parts.push(o); }
        return true;
    }
    /** Back to the real parts casting (and no proxy) — e.g. a part was hidden. */
    release(wait = 30) {
        for (const o of this.parts) o.castShadow = true;
        this.parts.length = 0;
        for (const m of this.meshes) if (m.parent) m.parent.remove(m);
        this.meshes.length = 0;
        if (this.entry) { this.entry.users--; this.entry = null; }
        this.wait = wait;
    }
    /** A part changed under the proxy: the real parts cast. A model whose parts keep changing (blinking, swapped
     *  over and over) is left to cast on its own for a while rather than re-baked again and again. */
    drop() {
        const f = SH.frame;
        SH.dropped++;
        this.drops.push(f);
        while (this.drops.length && f - this.drops[0] > 600) this.drops.shift();
        this.release(this.drops.length >= 3 ? 1800 : 30);
    }
    /** Right before the shadow pass: does the proxy cast this frame? (parts that changed → the real parts cast) */
    prepare() {
        if (!this.root.parent) return false;                 // (pooled / not in the scene)
        if (this.lod && this.lod.on) return false;            // far: the far copy shows and the parts are hidden (no shadow, as before)
        if (!this.meshes.length) {
            if (this.wait > 0) { this.wait--; return false; }
            if (!this.build()) { this.wait = 120; return false; }
        }
        const root = this.root;
        for (let i = 0; i < this.parts.length; i++) {
            const o = this.parts[i];
            if (o.castShadow) { this.drop(); return false; }        // (someone switched it back on)
            for (let a = o; a !== root; a = a.parent) if (!a || !a.visible) { this.drop(); return false; }
        }
        return true;
    }
    dispose() { if (this.dead) return; this.release(0); this.dead = true; SH.live.delete(this); }
}

/** Give a model a shadow proxy (only MEDIUM / HIGH ever draw it). opts: { skip(node), lod (its FarLod) }. */
export function shadowProxy(root, opts = {}) { return new ShadowProxy(root, opts); }

/** app.js, once: the proxies cast only inside the renderer's shadow pass. */
export function installShadowProxies(renderer) {
    const sm = renderer.shadowMap, orig = sm.render, shown = [];
    sm.render = function (lights) {
        if (!sm.enabled || !SH.on || !SH.live.size || !lights || !lights.length || (sm.autoUpdate === false && sm.needsUpdate === false)) return orig.apply(this, arguments);
        SH.frame++;
        for (const p of SH.live) if (p.prepare()) for (const m of p.meshes) { m.visible = true; shown.push(m); }
        try { return orig.apply(this, arguments); }
        finally { for (const m of shown) m.visible = false; shown.length = 0; }
    };
}
/** Tests / the perf harness: { n: registered, active: baked now, parts: real meshes they stand in for, cached, dropped (hand-backs so far), on }. */
export function shadowProxyInfo() {
    let active = 0, parts = 0;
    for (const p of SH.live) if (p.meshes.length) { active++; parts += p.parts.length; }
    return { n: SH.live.size, active, parts, cached: SH.cache.size, dropped: SH.dropped, on: SH.on };
}
/** Tests: every part casts on its own again (false) / proxies back on (true). */
export function shadowProxiesOn(on) { SH.on = !!on; if (!on) for (const p of SH.live) p.release(0); }
