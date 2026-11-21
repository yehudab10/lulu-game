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
        // (the people's batch moves their real parts to PEOPLE_LAYER: the shadow cameras still see it — see below)
        if (lights) for (let i = 0; i < lights.length; i++) { const sc = lights[i].shadow && lights[i].shadow.camera; if (sc && !(sc.layers.mask & PM.mask)) sc.layers.enable(PEOPLE_LAYER); }
        if (!sm.enabled || !SH.on || (!SH.live.size && !PB.roots.size) || !lights || !lights.length || (sm.autoUpdate === false && sm.needsUpdate === false)) return orig.apply(this, arguments);
        SH.frame++;
        for (const p of SH.live) if (p.prepare()) for (const m of p.meshes) { m.visible = true; shown.push(m); }
        const batch = prepareBatch(scene);
        if (batch) for (const m of batch) { m.visible = true; shown.push(m); }
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
const PB = { roots: new Map(), sides: new Map(), on: true, frame: 0 };
/** One shadow-only BatchedMesh per material side (the shadow pass renders a FrontSide part's BACK faces etc.). */
function sideBatch(side) {
    let sb = PB.sides.get(side);
    if (sb) return sb;
    const mat = new THREE.MeshBasicMaterial({ side });
    mat.name = "ShadowBatch";
    const m = new THREE.BatchedMesh(128, 16384, 32768, mat);
    m.name = "shadowBatch";
    m.castShadow = true; m.receiveShadow = false; m.visible = false; m.frustumCulled = false;
    m.sortObjects = false; m.perObjectFrustumCulled = true;
    m.matrixAutoUpdate = false;
    sb = { side, mesh: m, geos: new Map(), verts: 0, idx: 0, insts: 0, cap: { v: 16384, i: 32768, n: 128 }, used: false };
    PB.sides.set(side, sb);
    return sb;
}
function sbGrow(sb, needV, needI, needN) {
    const c = sb.cap, m = sb.mesh;
    if (needV > c.v || needI > c.i) { c.v = Math.max(c.v * 2, needV); c.i = Math.max(c.i * 2, needI); m.setGeometrySize(c.v, c.i); }
    if (needN > c.n) { c.n = Math.max(c.n * 2, needN); m.setInstanceCount(c.n); }
}
function sbGeometry(sb, src) {
    let g = sb.geos.get(src);
    if (g != null) return g;
    const pos = src.attributes.position, b = new THREE.BufferGeometry();
    b.setAttribute("position", pos.clone());
    if (src.index) b.setIndex(src.index.clone());
    else { const n = pos.count, a = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) a[i] = i; b.setIndex(new THREE.BufferAttribute(a, 1)); }
    sbGrow(sb, sb.verts + pos.count, sb.idx + b.index.count, sb.insts);
    g = sb.mesh.addGeometry(b);
    sb.verts += pos.count; sb.idx += b.index.count;
    b.dispose();
    sb.geos.set(src, g);
    return g;
}
class Batched {
    constructor(root, opts) { this.root = root; this.skip = opts.skip || null; this.parts = []; this.wait = 0; this.gone = 0; this.optOut = false; }
    collect() {
        const root = this.root, out = [];
        const walk = o => {
            if (o !== root && this.skip && this.skip(o)) return;
            if (o.name === "shadowProxy" || o.name === "lodFar") return;
            if (o.isMesh && o.castShadow && shCastable(o)) out.push(o);
            for (const c of o.children) walk(c);
        };
        walk(root);
        return out;
    }
    build() {
        const list = this.collect();
        if (!list.length) return false;
        for (const o of list) {
            const sb = sideBatch(o.material.side), g = sbGeometry(sb, o.geometry);
            sbGrow(sb, sb.verts, sb.idx, sb.insts + 1);
            const id = sb.mesh.addInstance(g);
            sb.insts++;
            o.castShadow = false;
            this.parts.push({ o, id, sb });
        }
        return true;
    }
    release(wait = 60) {
        for (const p of this.parts) { p.o.castShadow = true; p.sb.mesh.deleteInstance(p.id); p.sb.insts--; }
        this.parts.length = 0;
        this.wait = wait;
    }
    /** Each shadow pass: copy the parts' live transforms in (false = a part changed: they cast on their own again). */
    sync() {
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
            p.sb.mesh.setVisibleAt(p.id, vis);
            if (vis) { p.sb.mesh.setMatrixAt(p.id, o.matrixWorld); p.sb.used = true; }
        }
        return true;
    }
}
function inScene(o, scene) { for (let a = o; a; a = a.parent) if (a === scene) return true; return false; }
function prepareBatch(scene) {
    if (!PB.on || !PB.roots.size) return null;
    PB.frame++;
    for (const sb of PB.sides.values()) sb.used = false;
    for (const [root, b] of PB.roots) {
        if (!inScene(root, scene)) {
            // (not in the scene being drawn — an interior set, pooled: its instances stay hidden; after ~10 s its slots are
            //  freed (it re-joins when it's back in view), and one that left the world altogether is forgotten)
            for (const p of b.parts) p.sb.mesh.setVisibleAt(p.id, false);
            if (++b.gone > 600) { if (b.parts.length) b.release(0); if (!root.parent) PB.roots.delete(root); }
            continue;
        }
        b.gone = 0;
        if (!b.parts.length && (b.optOut || b.wait > 0)) { if (b.wait > 0) b.wait--; continue; }
        b.sync();
    }
    const out = [];
    for (const sb of PB.sides.values()) if (sb.used) { if (sb.mesh.parent !== scene) scene.add(sb.mesh); out.push(sb.mesh); }
    return out.length ? out : null;
}
/** Put a moving person's shadow into the people's shadow batch (see above). opts: { skip(node) }. */
export function shadowBatch(root, opts = {}) {
    if (!root || PB.roots.has(root)) return;
    // (LOW never draws a shadow pass, where the out-of-the-world ones are let go: sweep them here so the list stays small)
    if (PB.roots.size >= 256) for (const [r, b] of PB.roots) if (!r.parent) { b.release(0); PB.roots.delete(r); }
    PB.roots.set(root, new Batched(root, opts));
}
/** Tests: { people, parts, geometries, multiDraw (the extension is there), on }. */
export function shadowBatchInfo(renderer) {
    let parts = 0, people = 0;
    for (const b of PB.roots.values()) { if (b.parts.length) people++; parts += b.parts.length; }
    let md = null;
    try { md = renderer ? !!renderer.extensions.get("WEBGL_multi_draw") : null; } catch (e) { md = null; }
    let geometries = 0; for (const sb of PB.sides.values()) geometries += sb.geos.size;
    return { people, parts, registered: PB.roots.size, geometries, sides: PB.sides.size, multiDraw: md, on: PB.on };
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

// ── The people's main-pass batch (every tier) ───────────────────────────────────────────────────────────────────
// A spawned person (core/people.js) is ~13 meshes — body, arms, legs, hair, face, clothes — so ~13 draw calls in the main
// pass wherever she stands: a pedestrian on the highway, the home street, the crowd round a roadside event. Here every
// registered person's plain parts are instances of ONE BatchedMesh per kind of material (in practice 1–2), drawn with
// one WEBGL_multi_draw call (iOS Safari 15+, Chrome / Android; elsewhere three draws them one by one — no worse than
// before). Each render copies every part's LIVE matrixWorld + visibility in, so walk cycles, waves and a turned head
// stay exact near or far, and each instance's colour + roughness come from its own material (the batch's per-instance
// colour texture: rgb = colour, alpha = roughness), so a recolour or a flash shows at once. The real parts are moved
// to a layer the main camera doesn't draw (PEOPLE_LAYER) — never hidden: every feature's `visible`, matrices and
// raycasts are untouched, and the sun's shadow camera still sees that layer (the shadow batch above, or the part
// itself, casts as before). Anything a batch can't draw exactly — a texture, transparency, emissive, a custom shader,
// a skinned / instanced / multi-material mesh — stays a real mesh. A person who isn't in the main scene when it's drawn
// (an interior set, a portrait, pooled) gets her parts back on layer 0 before that render; a part whose material
// changes kind (turns transparent, gets a map…) or that leaves her hands her back to real meshes, and she re-joins a
// moment later.
//
//   installPeopleBatch(renderer, scene)   (app.js, once)
//   peopleBatch(personRoot)               (core/people.js, for every spawned person)
export const PEOPLE_LAYER = 30;
/** `?nobatch` (A/B measuring): the people's main-pass batch, the chunks' slot batches and the car's moving parts in the
 *  shadow batch all off — the game drawn the way it was before ci/perf4. */
export const BATCHES = { off: typeof location !== "undefined" && /[?&]nobatch\b/.test(location.search) };
const PM = { roots: new Map(), batches: new Map(), on: !BATCHES.off, scene: null, frame: 0, released: 0, resets: 0, mask: 1 << PEOPLE_LAYER, maxVerts: 600000 };
const _proto = THREE.Object3D.prototype, _mproto = THREE.Material.prototype;
const MAPS = ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "lightMap", "bumpMap", "alphaMap", "envMap", "displacementMap"];
const KEYS = ["side", "flatShading", "metalness", "envMapIntensity", "fog", "toneMapped", "dithering", "polygonOffset", "polygonOffsetFactor", "polygonOffsetUnits", "shadowSide", "premultipliedAlpha"];
function pmPlain(m) {
    if (!m || Array.isArray(m) || m.type !== "MeshStandardMaterial") return false;
    if (m.transparent || m.opacity !== 1 || m.alphaTest > 0 || !m.visible || m.vertexColors || m.wireframe || m.alphaHash || m.alphaToCoverage) return false;
    if (m.blending !== THREE.NormalBlending || !m.colorWrite || !m.depthTest || !m.depthWrite || m.clippingPlanes || m.onBeforeCompile !== _mproto.onBeforeCompile) return false;
    if (m.emissive.r || m.emissive.g || m.emissive.b) return false;
    for (const k of MAPS) if (m[k]) return false;
    return true;
}
function pmEligible(o) {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || o.isBatchedMesh || !o.geometry) return false;
    if (o.layers.mask !== 1 || o.renderOrder !== 0 || !o.receiveShadow || o.onBeforeRender !== _proto.onBeforeRender || o.onAfterRender !== _proto.onAfterRender) return false;
    const g = o.geometry, a = g.attributes;
    if (!a.position || !a.normal || a.position.itemSize !== 3 || a.normal.itemSize !== 3 || a.position.isInterleavedBufferAttribute || a.normal.isInterleavedBufferAttribute) return false;
    if (g.groups.length > 1 || g.drawRange.start !== 0 || g.drawRange.count !== Infinity) return false;
    if (g.morphAttributes && Object.keys(g.morphAttributes).length) return false;
    return pmPlain(o.material);
}
/** What a batch's ONE material has to match: everything but the colour + roughness (those are per instance). */
function pmKey(m) { let k = ""; for (const n of KEYS) k += m[n] + ","; return k; }
function pmBatch(key, src) {
    let b = PM.batches.get(key);
    if (b) return b;
    const mat = new THREE.MeshStandardMaterial();
    for (const k of KEYS) mat[k] = src[k];
    mat.color.setRGB(1, 1, 1); mat.roughness = 1; mat.name = "PeopleBatch";
    mat.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader
            .replace("#include <common>", "#include <common>\nflat varying float vPbRough;")
            .replace("#include <color_vertex>", "#include <color_vertex>\n#ifdef USE_BATCHING_COLOR\n{ int pbI = int( getIndirectIndex( gl_DrawID ) ); int pbS = textureSize( batchingColorTexture, 0 ).x; vPbRough = texelFetch( batchingColorTexture, ivec2( pbI % pbS, pbI / pbS ), 0 ).a; }\n#else\nvPbRough = 1.0;\n#endif");
        sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nflat varying float vPbRough;")
            .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vPbRough;");
    };
    mat.customProgramCacheKey = () => "peopleBatch1";
    const mesh = new THREE.BatchedMesh(256, 32768, 65536, mat);
    mesh.name = "peopleBatch";
    mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false;
    mesh.sortObjects = false; mesh.perObjectFrustumCulled = true;
    mesh.matrixAutoUpdate = false; mesh.visible = false;
    b = { key, mesh, mat, geos: new Map(), verts: 0, idx: 0, insts: 0, cap: { v: 32768, i: 65536, n: 256 }, parts: [], full: false };
    const base = THREE.BatchedMesh.prototype.onBeforeRender;
    mesh.onBeforeRender = function (r, s, c, g, m, grp) { pmSync(b); return base.call(this, r, s, c, g, m, grp); };
    PM.batches.set(key, b);
    return b;
}
function pmGrow(b, needV, needI, needN) {
    const c = b.cap, m = b.mesh;
    if (needV > c.v || needI > c.i) { c.v = Math.max(c.v * 2, needV); c.i = Math.max(c.i * 2, needI); m.setGeometrySize(c.v, c.i); }
    if (needN > c.n) { c.n = Math.max(c.n * 2, needN); m.setInstanceCount(c.n); }
}
function pmGeometry(b, src) {
    let g = b.geos.get(src);
    if (g != null) return g;
    const pos = src.attributes.position, geo = new THREE.BufferGeometry();
    geo.setAttribute("position", pos.clone());
    geo.setAttribute("normal", src.attributes.normal.clone());
    if (src.index) geo.setIndex(src.index.clone());
    else { const n = pos.count, a = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) a[i] = i; geo.setIndex(new THREE.BufferAttribute(a, 1)); }
    pmGrow(b, b.verts + pos.count, b.idx + geo.index.count, b.insts);
    g = b.mesh.addGeometry(geo);
    b.verts += pos.count; b.idx += geo.index.count;
    geo.dispose();
    b.geos.set(src, g);
    // (every person model that ever walked by keeps its parts in the batch's buffers: past maxVerts it starts afresh)
    if (b.verts > PM.maxVerts) b.full = true;
    return g;
}
const _pc = new THREE.Color();
function pmColor(p) {
    const m = p.o.material, c = m.color, mesh = p.b.mesh;
    p.r = c.r; p.g = c.g; p.bl = c.b; p.rough = m.roughness;
    mesh.setColorAt(p.id, _pc.setRGB(c.r, c.g, c.b));
    mesh._colorsTexture.image.data[p.id * 4 + 3] = m.roughness;     // (alpha = roughness: the batch's shader reads it)
}
class PersonBatch {
    constructor(root) { this.root = root; this.parts = []; this.wait = 0; this.gone = 0; this.drops = []; this.active = false; this.changed = false; this.vf = -1; this.rv = false; }
    build() {
        const root = this.root, list = [];
        const walk = o => {
            if (o.name === "shadowProxy" || o.name === "lodFar") return;
            if (pmEligible(o)) list.push(o);
            for (const c of o.children) walk(c);
        };
        walk(root);
        if (!list.length) return false;
        // (in the order three would have drawn them — by material — so a face patch on the head still lands on top)
        list.sort((a, b) => a.material.id - b.material.id);
        root.updateMatrixWorld(true);
        for (const o of list) {
            const m = o.material, b = pmBatch(pmKey(m), m), g = pmGeometry(b, o.geometry);
            pmGrow(b, b.verts, b.idx, b.insts + 1);
            const id = b.mesh.addInstance(g);
            b.insts++;
            const p = { o, id, b, pb: this, mat: m, ver: m.version, mask: o.layers.mask, r: 0, g: 0, bl: 0, rough: 0 };
            b.parts.push(p);
            pmColor(p);
            b.mesh.setMatrixAt(id, o.matrixWorld);
            o.layers.mask = PM.mask;
            this.parts.push(p);
        }
        this.active = true;
        this.changed = false;
        return true;
    }
    release(wait = 30) {
        for (const p of this.parts) {
            if (p.o.layers.mask === PM.mask) p.o.layers.mask = p.mask;
            p.b.mesh.deleteInstance(p.id); p.b.insts--;
            const i = p.b.parts.indexOf(p); if (i >= 0) p.b.parts.splice(i, 1);
        }
        this.parts.length = 0;
        this.active = false;
        this.changed = false;
        this.wait = wait;
    }
    /** A part changed kind under the batch: real meshes again (a person whose parts keep changing waits longer). */
    drop() {
        PM.released++;
        this.drops.push(PM.frame);
        while (this.drops.length && PM.frame - this.drops[0] > 600) this.drops.shift();
        this.release(this.drops.length >= 3 ? 1800 : 30);
    }
}
/** Right before a batch draws (its onBeforeRender: the matrices are up to date) — every part's live transform,
 *  visibility and colour. A part that changed kind is still drawn as it was this once and handed back before the next
 *  render (no blink). */
function pmSync(b) {
    const mesh = b.mesh, parts = b.parts, bm = b.mat;
    for (let i = 0; i < parts.length; i++) {
        const p = parts[i], o = p.o, pb = p.pb;
        // (her own visibility up to the scene once a frame — a hidden / far-culled person costs one walk, not one a part)
        if (pb.vf !== PM.frame) { pb.vf = PM.frame; let v = true; for (let a = pb.root; a; a = a.parent) if (!a.visible) { v = false; break; } pb.rv = v; }
        if (!pb.rv) { mesh.setVisibleAt(p.id, false); continue; }
        let vis = true, a = o;
        for (; a && a !== pb.root; a = a.parent) if (!a.visible) vis = false;
        if (!a) { pb.changed = true; vis = false; }          // (the part left her)
        mesh.setVisibleAt(p.id, vis);
        if (!vis) continue;
        // changed KIND? (another material; turned see-through / glowing; or anything that needed a recompile — a map, a
        //  side, flat shading: three's material.version) → she's handed back before the next render
        const m = o.material;
        // (a recompile — the tier change asks it of every material in the scene: still the same kind? then carry on)
        if (m === p.mat && m.version !== p.ver) { if (pmPlain(m) && pmKey(m) === b.key) p.ver = m.version; else pb.changed = true; }
        if (m !== p.mat || m.transparent || m.opacity !== 1 || !m.visible || m.emissive.r || m.emissive.g || m.emissive.b
            || m.metalness !== bm.metalness || o.layers.mask !== PM.mask) pb.changed = true;
        mesh.setMatrixAt(p.id, o.matrixWorld);
        if (m === p.mat && (m.color.r !== p.r || m.color.g !== p.g || m.color.b !== p.bl || m.roughness !== p.rough)) pmColor(p);
    }
}
function pmUnder(o, top) { for (let a = o; a; a = a.parent) if (a === top) return true; return false; }
function pmInScene(o) { return pmUnder(o, PM.scene); }
/** Before every render: only people in the main scene, and only for the main scene's render, are batched. */
function pmPrepare(scene) {
    if (scene !== PM.scene) {
        // (another scene — an interior set, a portrait, the salon's mirror: whoever of ours is IN it is drawn by her own meshes)
        for (const pb of PM.roots.values()) if (pb.active && pmUnder(pb.root, scene)) pb.release(0);
        return;
    }
    const main = PM.on;
    if (main) PM.frame++;
    for (const b of PM.batches.values()) if (b.full) {
        // (start this batch afresh: its people re-join right away, only the models still around are copied in again)
        for (const p of b.parts.slice()) if (p.pb.active) p.pb.release(0);
        if (b.mesh.parent) b.mesh.parent.remove(b.mesh);
        b.mesh.dispose(); b.mat.dispose();
        PM.batches.delete(b.key); PM.resets++;
    }
    for (const pb of PM.roots.values()) {      // (values(): no [key, value] pair a person a frame)
        const root = pb.root;
        if (pb.active) {
            if (pb.changed) { pb.drop(); continue; }
            if (!main || !pmInScene(root)) pb.release(main ? 30 : 0);   // (main && not in it: removed / pooled)
            else { pb.gone = 0; continue; }
        }
        if (!main) continue;
        if (!root.parent || !pmInScene(root)) {
            // (left the world for good: forgotten — Person.update() registers her again if she comes back)
            if (++pb.gone > 600 && !root.parent) { PM.roots.delete(root); root.userData.pbGone = true; }
            continue;
        }
        pb.gone = 0;
        if (pb.wait > 0) { pb.wait--; continue; }
        if (!pb.build()) pb.wait = 240;
    }
    for (const b of PM.batches.values()) {
        if (b.mesh.parent !== scene) scene.add(b.mesh);
        b.mesh.visible = main && b.parts.length > 0;
    }
}
/** app.js, once: the batch is filled right before each render of the main scene (any render call — the bloom path,
 *  the dissolve snapshot, the photo mode — goes through here). */
export function installPeopleBatch(renderer, scene) {
    PM.scene = scene;
    const orig = renderer.render;
    renderer.render = function (s) {
        if (PM.roots.size || PM.batches.size) { try { pmPrepare(s); } catch (e) { console.error("[peopleBatch]", e); } }
        return orig.apply(this, arguments);
    };
}
/** Draw a spawned person's plain parts through the people's main-pass batch (see above). */
export function peopleBatch(root) {
    if (!root || PM.roots.has(root)) return;
    root.userData.pbGone = false;
    PM.roots.set(root, new PersonBatch(root));
}
/** Tests: { people (batched now), parts, registered, batches, geometries, verts, released, resets, on, layer }. */
export function peopleBatchInfo() {
    let people = 0, parts = 0, geometries = 0, verts = 0;
    for (const pb of PM.roots.values()) if (pb.active) { people++; parts += pb.parts.length; }
    for (const b of PM.batches.values()) { geometries += b.geos.size; verts += b.verts; }
    return { people, parts, registered: PM.roots.size, batches: PM.batches.size, geometries, verts, released: PM.released, resets: PM.resets, on: PM.on, layer: PEOPLE_LAYER };
}
/** Tests: every person drawn by her own meshes again (false) / back in the batch (true). */
export function peopleBatchOn(on) {
    PM.on = !!on;
    if (!on) { for (const pb of PM.roots.values()) if (pb.active) pb.release(0); for (const b of PM.batches.values()) b.mesh.visible = false; }
}
