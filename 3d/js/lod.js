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
    sm.render = function (lights, scene) {
        if (!sm.enabled || !SH.on || (!SH.live.size && !PB.roots.size) || !lights || !lights.length || (sm.autoUpdate === false && sm.needsUpdate === false)) return orig.apply(this, arguments);
        SH.frame++;
        for (const p of SH.live) if (p.prepare()) for (const m of p.meshes) { m.visible = true; shown.push(m); }
        const batch = prepareBatch(scene);
        if (batch) { batch.visible = true; shown.push(batch); }
        try { return orig.apply(this, arguments); }
        finally { for (const m of shown) m.visible = false; shown.length = 0; }
    };
}

// ── The people's shadow batch (MEDIUM / HIGH) ───────────────────────────────────────────────────────────────
// A person is ~13 casting parts (body, arms, legs, hair, clothes…) = 13 draws in the sun's shadow pass, and they MOVE
// (walk cycles, waving, Lulu turning her head at the wheel), so a baked proxy would freeze their shadows. Instead every
// registered person's casting parts are instances of ONE shadow-only BatchedMesh: each shadow pass copies every
// part's live matrixWorld + visibility into it, so the shadow is exact, in one multi-draw (WEBGL_multi_draw: iOS
// Safari 15+, Chrome; without it three draws the parts one by one — no worse than before). Hidden in the main pass,
// switched on inside the shadow pass like the proxies. A part someone sets castShadow on again, or removes, hands
// that person back to casting on their own; a person out of the scene for ~10 s is let go.
//
//   shadowBatch(personRoot, { skip })   (core/people.js does it for every spawned person; car.js for Lulu at the wheel)
const PB = { roots: new Map(), mesh: null, geos: new Map(), verts: 0, idx: 0, insts: 0, on: true, frame: 0 };
const PB_MAT = new THREE.MeshBasicMaterial();
PB_MAT.name = "ShadowBatch";
function pbMesh(needV, needI, needN) {
    let m = PB.mesh;
    if (!m) {
        m = PB.mesh = new THREE.BatchedMesh(256, 32768, 65536, PB_MAT);
        m.name = "shadowBatch";
        m.castShadow = true; m.receiveShadow = false; m.visible = false; m.frustumCulled = false;
        m.sortObjects = false; m.perObjectFrustumCulled = true;
        m.matrixAutoUpdate = false;
        PB.cap = { v: 32768, i: 65536, n: 256 };
    }
    const c = PB.cap;
    if (needV > c.v || needI > c.i) {
        c.v = Math.max(c.v * 2, needV); c.i = Math.max(c.i * 2, needI);
        m.setGeometrySize(c.v, c.i);
    }
    if (needN > c.n) { c.n = Math.max(c.n * 2, needN); m.setInstanceCount(c.n); }
    return m;
}
function pbGeometry(src) {
    let g = PB.geos.get(src);
    if (g != null) return g;
    const pos = src.attributes.position, b = new THREE.BufferGeometry();
    b.setAttribute("position", pos.clone());
    if (src.index) b.setIndex(src.index.clone());
    else { const n = pos.count, a = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) a[i] = i; b.setIndex(new THREE.BufferAttribute(a, 1)); }
    const m = pbMesh(PB.verts + pos.count, PB.idx + b.index.count, PB.insts);
    g = m.addGeometry(b);
    PB.verts += pos.count; PB.idx += b.index.count;
    b.dispose();
    PB.geos.set(src, g);
    return g;
}
class Batched {
    constructor(root, opts) { this.root = root; this.skip = opts.skip || null; this.parts = []; this.wait = 0; this.gone = 0; this.optOut = false; }
    collect() {
        const root = this.root, out = [];
        const walk = o => {
            if (o !== root && this.skip && this.skip(o)) return;
            if (o.name === "shadowProxy" || o.name === "lodFar") return;
            if (o.isMesh && o.castShadow && shCastable(o) && o.material.side === THREE.FrontSide) out.push(o);
            for (const c of o.children) walk(c);
        };
        walk(root);
        return out;
    }
    build() {
        const list = this.collect();
        if (!list.length) return false;
        for (const o of list) {
            const g = pbGeometry(o.geometry);
            const m = pbMesh(PB.verts, PB.idx, PB.insts + 1);
            const id = m.addInstance(g);
            PB.insts++;
            o.castShadow = false;
            this.parts.push({ o, id });
        }
        return true;
    }
    release(wait = 60) {
        const m = PB.mesh;
        for (const p of this.parts) { p.o.castShadow = true; if (m) { m.deleteInstance(p.id); PB.insts--; } }
        this.parts.length = 0;
        this.wait = wait;
    }
    /** Each shadow pass: copy the parts' live transforms in (false = a part changed: they cast on their own again). */
    sync(m) {
        if (!this.parts.length) {
            if (this.optOut) return true;
            if (this.wait > 0) { this.wait--; return true; }
            if (!this.build()) { this.wait = 240; return true; }
        }
        for (const p of this.parts) {
            const o = p.o;
            if (o.castShadow) { this.release(); this.optOut = true; return true; }   // (a feature wants this person's parts its own way)
            if (!o.parent) { this.release(); return true; }
            let vis = true;
            for (let a = o; a; a = a.parent) if (!a.visible) { vis = false; break; }
            m.setVisibleAt(p.id, vis);
            if (vis) m.setMatrixAt(p.id, o.matrixWorld);
        }
        return true;
    }
}
function inScene(o, scene) { for (let a = o; a; a = a.parent) if (a === scene) return true; return false; }
function prepareBatch(scene) {
    if (!PB.on || !PB.roots.size) return null;
    PB.frame++;
    let any = false;
    for (const [root, b] of PB.roots) {
        if (!inScene(root, scene)) {
            // (not drawn this frame: its instances stay hidden; let go after ~10 s out of the scene)
            if (b.parts.length && PB.mesh) for (const p of b.parts) PB.mesh.setVisibleAt(p.id, false);
            if (++b.gone > 600) { b.release(0); PB.roots.delete(root); }
            continue;
        }
        b.gone = 0;
        if (!b.parts.length && (b.optOut || b.wait > 0)) { if (b.wait > 0) b.wait--; continue; }
        b.sync(PB.mesh || pbMesh(0, 0, 0));
        if (b.parts.length) any = true;
    }
    const m = PB.mesh;
    if (!m || !any) return null;
    if (m.parent !== scene) scene.add(m);
    return m;
}
/** Put a moving person's shadow into the people's shadow batch (see above). opts: { skip(node) }. */
export function shadowBatch(root, opts = {}) {
    if (!root || PB.roots.has(root)) return;
    PB.roots.set(root, new Batched(root, opts));
}
/** Tests: { people, parts, geometries, multiDraw (the extension is there), on }. */
export function shadowBatchInfo(renderer) {
    let parts = 0, people = 0;
    for (const b of PB.roots.values()) { if (b.parts.length) people++; parts += b.parts.length; }
    let md = null;
    try { md = renderer ? !!renderer.extensions.get("WEBGL_multi_draw") : null; } catch (e) { md = null; }
    return { people, parts, registered: PB.roots.size, geometries: PB.geos.size, multiDraw: md, on: PB.on };
}
/** Tests: every person's parts cast on their own again (false) / back in the batch (true). */
export function shadowBatchOn(on) { PB.on = !!on; if (!on) for (const b of PB.roots.values()) b.release(0); }
/** Tests / the perf harness: { n: registered, active: baked now, parts: real meshes they stand in for, cached, dropped (hand-backs so far), on }. */
export function shadowProxyInfo() {
    let active = 0, parts = 0;
    for (const p of SH.live) if (p.meshes.length) { active++; parts += p.parts.length; }
    return { n: SH.live.size, active, parts, cached: SH.cache.size, dropped: SH.dropped, on: SH.on };
}
/** Tests: every part casts on its own again (false) / proxies back on (true). */
export function shadowProxiesOn(on) { SH.on = !!on; if (!on) for (const p of SH.live) p.release(0); }
