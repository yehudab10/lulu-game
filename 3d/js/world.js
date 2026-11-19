// The world: an endless, gently winding 4-lane country road generated in
// 200 m chunks just ahead of the car (and recycled behind it), lined with
// Blender-made trees and houses, power lines, coin trails, speed traps, road
// signs. Features add set pieces through the "chunk:build" event, change the
// look with world.biomeAt / setSky, and keep roadside space free with reserve().
import * as THREE from "three";
import { models, instanced, cloneWithColors, findNodes } from "./models.js";
import { ctx, emit, listenersOf } from "./core/ctx.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ChunkMerger, restFilter } from "./merge.js";
import { farLod } from "./lod.js";

const _tint = new THREE.Color();
const _cm = new THREE.Matrix4(), _cq = new THREE.Quaternion(), _cv = new THREE.Vector3(), _cs = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);
/** Scenery further than this from the road's centre casts no shadow (the sun's shadow box is ±46 m around the car). */
const SHADOW_D = 40;

export const STEP = 2;            // metres between road centre-line samples
export const LANE = 3.5;
export const HALF_ROAD = 7;       // 4 lanes
export const SHOULDER = 8.8;      // edge of the gravel shoulder
export const CHUNK = 200;         // metres per scenery chunk

/**
 * Paved ground off the highway's asphalt (exit ramps, a rest area's lot…): features push predicates
 * (s, d) → 0 (not theirs) | 1 (walkable grounds: a lawn, a picnic area — still grass for the car) |
 * 2 (asphalt: the car drives it like road, no grass drag or shoulder rumble) | 3 (a LANE off the highway:
 * a decel / accel lane, a ramp, a painted gore, a lot's drive aisle — asphalt she drives through, so nothing
 * may ever stand on it). Highway road coords only (ignored while a district is active).
 * THE RULE for anything placed beside the road: check offLanes() first (Chunk.addSign does, for every sign).
 */
export const paved = [];
/** The highest paved level any feature reports at highway (s, d): 0 | 1 | 2 | 3. */
export function pavedAt(s, d) {
    let best = 0;
    for (const f of paved) { const v = +f(s, d) || 0; if (v > best) { best = v; if (best >= 3) break; } }
    return best;
}
/** Is a footprint (centre s, d; ±halfD across, ±halfS along) clear of every lane (paved 3)? */
export function offLanes(s, d, halfD = 0.5, halfS = 0.5) {
    if (!paved.length) return true;
    const stepS = Math.max(0.5, halfS), stepD = Math.min(0.5, Math.max(0.1, halfD));
    for (let a = -halfS; a <= halfS + 1e-6; a += stepS) for (let b = -halfD; b <= halfD + 1e-6; b += stepD) if (pavedAt(s + a, d + b) >= 3) return false;
    return true;
}
const AHEAD = 640, BEHIND = 160;

// Our lanes are on the RIGHT (positive d); oncoming traffic on the left.
export const LANES_OURS = [LANE / 2, LANE * 1.5];
export const LANES_ONCOMING = [-LANE / 2, -LANE * 1.5];

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ── road centre-line ───────────────────────────────────────────────────
export class Road {
    constructor(seed) {
        const r = mulberry32(seed);
        this.ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
        this.x = [0]; this.z = [0]; this.h = [0];
    }

    // The heading itself is a bounded wiggle (never more than ~65° off north),
    // so the road can never loop back over itself.
    headingFn(s) {
        const e = Math.min(1, Math.max(0, (s - 80) / 260));
        const env = e * e * (3 - 2 * e); // a straight start, then ease into the curves
        const amp = 0.62 + 0.38 * Math.sin(s / 900 + this.ph[3]);
        const p = this.ph;
        const w = 0.62 * Math.sin(s / 270 + p[0]) + 0.30 * Math.sin(s / 105 + p[1]) + 0.1 * Math.sin(s / 48 + p[2]);
        return env * amp * w;
    }

    ensure(sMax) {
        let i = this.x.length - 1;
        while (i * STEP < sMax) {
            const s = i * STEP;
            const h0 = this.h[i], h1 = this.headingFn(s + STEP);
            const hm = (h0 + h1) / 2;
            this.x.push(this.x[i] + Math.sin(hm) * STEP);
            this.z.push(this.z[i] + Math.cos(hm) * STEP);
            this.h.push(h1);
            i++;
        }
    }

    /** Centre point + heading at distance s (linear between samples). */
    at(s, out = {}) {
        this.ensure(s + STEP * 2);
        const f = Math.max(0, s / STEP);
        const i = Math.floor(f), t = f - i;
        out.x = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
        out.z = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
        out.h = this.h[i] + (this.h[i + 1] - this.h[i]) * t;
        return out;
    }

    /** World point at distance s, lateral offset d (positive = right of travel). */
    point(s, d, out = {}) {
        this.at(s, out);
        out.x += -Math.cos(out.h) * d;
        out.z += Math.sin(out.h) * d;
        return out;
    }

    /** Closest road position to (x, z): {s, d, h}. `hint` is a previous s. */
    nearest(x, z, hint, out = {}) {
        let i0 = Math.max(0, Math.floor(hint / STEP));
        this.ensure((i0 + 200) * STEP);
        let best = 1e18, bi = i0;
        const span = 60;
        for (let i = Math.max(0, i0 - span); i <= i0 + span; i++) {
            const dx = x - this.x[i], dz = z - this.z[i];
            const d2 = dx * dx + dz * dz;
            if (d2 < best) { best = d2; bi = i; }
        }
        const h = this.h[bi];
        const fx = Math.sin(h), fz = Math.cos(h);
        const dx = x - this.x[bi], dz = z - this.z[bi];
        const lon = dx * fx + dz * fz;
        out.s = Math.max(0, bi * STEP + lon);
        out.d = dx * -Math.cos(h) + dz * Math.sin(h);
        out.h = h;
        return out;
    }
}

// ── textures ───────────────────────────────────────────────────────────
function canvasTex(w, h, draw, repeat = true) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
}

function speckle(g, w, h, n, colors, rMax) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = colors[i % colors.length];
        const r = Math.random() * rMax + 0.5;
        g.fillRect(Math.random() * w, Math.random() * h, r, r);
    }
}

const ROAD_TEX_LEN = 24; // metres of road per texture repeat
function roadTexture() {
    return canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h);
        speckle(g, w, h, 9000, ["#676b73", "#53575e", "#70747c", "#4c5057"], 2.2);
        // tire wear: slightly darker strips in each lane
        g.fillStyle = "rgba(40,42,48,0.10)";
        for (const u of [0.09, 0.19, 0.31, 0.43, 0.57, 0.69, 0.81, 0.91]) g.fillRect(u * w - 10, 0, 20, h);
        const px = d => (d + HALF_ROAD) / (HALF_ROAD * 2) * w;
        g.fillStyle = "#f4f4f0";
        g.fillRect(px(-6.75) - 4, 0, 8, h);       // solid white edge lines
        g.fillRect(px(6.75) - 4, 0, 8, h);
        g.fillStyle = "#ffcf33";                  // double yellow centre line
        g.fillRect(px(0) - 9, 0, 6, h);
        g.fillRect(px(0) + 3, 0, 6, h);
        g.fillStyle = "#f4f4f0";                  // dashed lane lines (3 m dash / 9 m gap)
        const dash = 3 / ROAD_TEX_LEN * h;
        for (const d of [-LANE, LANE]) {
            g.fillRect(px(d) - 3, 0, 6, dash);
            g.fillRect(px(d) - 3, h / 2, 6, dash);
        }
    });
}

function grassTexture() {
    return canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#79c258"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) {
            g.fillStyle = i % 2 ? "rgba(98,170,70,0.35)" : "rgba(150,210,110,0.3)";
            g.beginPath();
            g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 26, 0, 7);
            g.fill();
        }
        speckle(g, w, h, 2600, ["#6bb34c", "#8ad06a", "#5fa344", "#97d877"], 2.5);
    });
}

// Sign textures are cached by text + look. The road's own signs count their users and free the
// texture (+ its material) when the last chunk showing it is recycled: a long drive passes a lot
// of distinct mileage signs. A texture handed out to a feature (signTexture) is kept for good.
const signTexCache = new Map();   // key → { key, tex, refs, ext }
function signEntry(lines, bg = "#1f7a46", fg = "#ffffff", w = 512, h = 256) {
    const key = lines.join("|") + bg + fg + w + h;
    let e = signTexCache.get(key);
    if (e) return e;
    const t = canvasTex(w, h, (g) => {
        g.fillStyle = bg;
        g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill();
        g.strokeStyle = fg; g.lineWidth = 8;
        g.beginPath(); g.roundRect(16, 16, w - 32, h - 32, 18); g.stroke();
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        const n = lines.length;
        lines.forEach((line, i) => {
            const size = i === 0 && n > 1 ? h * 0.26 : h * (n > 1 ? 0.22 : 0.36);
            g.font = `700 ${size}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(line, w / 2, h * (n === 1 ? 0.52 : 0.34 + i * (0.36 / Math.max(1, n - 1)) * (n > 2 ? 1 : 0.95)), w - 50);
        });
    }, false);
    signTexCache.set(key, e = { key, tex: t, refs: 0, ext: false });
    return e;
}
function signTexture(lines, bg, fg, w, h) { const e = signEntry(lines, bg, fg, w, h); e.ext = true; return e.tex; }
function releaseSign(e) {
    if (--e.refs > 0 || e.ext || signTexCache.get(e.key) !== e) return;
    signTexCache.delete(e.key);
    const m = signMats.get(e.tex);
    if (m) { m.dispose(); signMats.delete(e.tex); }
    e.tex.dispose();
}

/** One material per sign texture (both are cached: the same sign text never makes a second one). */
const signMats = new Map();
function signMaterial(tex) {
    let m = signMats.get(tex);
    if (!m) signMats.set(tex, m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    return m;
}

// ── shared materials / geometry ────────────────────────────────────────
let MAT = null;
function materials() {
    if (MAT) return MAT;
    const road = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.92 });
    road.polygonOffset = true; road.polygonOffsetFactor = -2; road.polygonOffsetUnits = -2;
    const shoulder = new THREE.MeshStandardMaterial({ color: "#c4b394", roughness: 1 });
    shoulder.polygonOffset = true; shoulder.polygonOffsetFactor = -1; shoulder.polygonOffsetUnits = -1;
    MAT = {
        road, shoulder,
        drive: new THREE.MeshStandardMaterial({ color: "#a9a49a", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        pole: new THREE.MeshStandardMaterial({ color: "#8a6a4a", roughness: 0.9 }),
        metal: new THREE.MeshStandardMaterial({ color: "#9aa3ab", roughness: 0.5, metalness: 0.6 }),
        wire: new THREE.LineBasicMaterial({ color: "#3a3a3a", transparent: true, opacity: 0.55 }),
        coin: new THREE.MeshStandardMaterial({ color: "#ffc61a", emissive: "#b8860b", emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.75 }),
        heart: new THREE.MeshStandardMaterial({ color: "#ff3d7f", emissive: "#c2185b", emissiveIntensity: 0.6, roughness: 0.35 }),
    };
    return MAT;
}

let GEO = null;
function geometry() {
    if (GEO) return GEO;
    const coin = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20);
    coin.rotateX(Math.PI / 2); // face along Z, so spinning about Y shows its face
    const pole = new THREE.CylinderGeometry(0.13, 0.17, 8.2, 7);
    pole.translate(0, 4.1, 0);
    const bar = new THREE.BoxGeometry(2.4, 0.14, 0.14);
    bar.translate(0, 7.6, 0);
    // a puffy heart (two spheres + a cone)
    const heartParts = [new THREE.SphereGeometry(0.33, 14, 10), new THREE.SphereGeometry(0.33, 14, 10), new THREE.ConeGeometry(0.47, 0.75, 14)];
    heartParts[0].translate(-0.24, 0.16, 0); heartParts[1].translate(0.24, 0.16, 0);
    heartParts[2].rotateZ(Math.PI); heartParts[2].translate(0, -0.3, 0);
    const heart = mergeGeometries(heartParts.map(g => g.clone()), false);   // one draw call a heart
    // the power pole as a tiny "model", so the chunk merger bakes it in with the trees
    const poleTemplate = new THREE.Group();
    const pm = new THREE.Mesh(pole, materials().pole), bm = new THREE.Mesh(bar, materials().pole);
    pm.castShadow = bm.castShadow = true;
    poleTemplate.add(pm, bm);
    GEO = { coin, pole, bar, heartParts, heart, poleTemplate, post: new THREE.CylinderGeometry(0.09, 0.09, 1, 8) };
    return GEO;
}

// ── chunk building ─────────────────────────────────────────────────────
function ribbon(road, s0, s1, d0, d1, y, vScale) {
    const n = Math.round((s1 - s0) / STEP) + 1;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), nor = new Float32Array(n * 2 * 3);
    const idx = [];
    const p = {};
    for (let k = 0; k < n; k++) {
        const s = s0 + k * STEP;
        road.point(s, d0, p);
        pos.set([p.x, y, p.z], k * 6);
        road.point(s, d1, p);
        pos.set([p.x, y, p.z], k * 6 + 3);
        uv.set([0, s / vScale, 1, s / vScale], k * 4);
        nor.set([0, 1, 0, 0, 1, 0], k * 6);
        if (k < n - 1) {
            const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
            idx.push(a, b, c, b, d, c);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}

function facingRoad(h, side) {
    // rotation.y so a model whose front is +Z faces the road from `side`
    return side > 0 ? Math.atan2(Math.cos(h), -Math.sin(h)) : Math.atan2(-Math.cos(h), Math.sin(h));
}

/** Perf probe (tests / the console): set world.sliceLog = [] to collect [chunk, step, ms, name] per build step. */
let SLICE_LOG = null;
const SLICE_MS = 3;          // per frame, for a chunk that's built in slices
const SLICE_NEAR = 300;      // m: a missing chunk this close to her is built at once (a restart, a warp)
const WALLS = ["#FFE0B2", "#FFF3E0", "#E3F2FD", "#F8BBD0", "#DCEDC8", "#FFF9C4", "#E1BEE7", "#D7CCC8"];
const ROOFS = ["#C0504D", "#5D6D7E", "#8D6E63", "#3E6B4F", "#455A8C", "#A0522D"];

class Chunk {
    constructor(world, k, sliced = false) {
        this.k = k;
        this.s0 = k * CHUNK;
        this.s1 = this.s0 + CHUNK;
        this.group = new THREE.Group();
        this.colliders = [];
        this.coins = [];
        this.hearts = [];
        this.traps = [];
        this.disposables = [];
        this.anim = [];
        this.group.name = "chunk";
        if (sliced) {
            // A far chunk is built a STEP at a time over several frames (World.update): a whole chunk plus every feature's
            // set pieces in one frame is a hitch every 200 m on a phone. It is in the scene from the start; until it is
            // done it is simply "always drawn" (bounds() needs everything in it).
            const mid = world.road.at(this.s0 + CHUNK / 2);
            this.center = new THREE.Vector3(mid.x, 0, mid.z);
            this.radius = CHUNK; this.noCull = true;
            this.steps = this.build(world);
            world.scene.add(this.group);
            return;
        }
        for (const _ of this.build(world)) { /* all of it, now */ }
        this.bounds();
        world.scene.add(this.group);
    }
    /** Is it still being built in slices? */
    get building() { return !!this.steps; }
    /** Carry on a sliced build for about `ms` (at least one step; Infinity = finish it now). → done? */
    advance(ms = SLICE_MS) {
        if (!this.steps) return true;
        const t0 = performance.now();
        for (;;) {
            let r;
            const t1 = SLICE_LOG ? performance.now() : 0;
            try { r = this.steps.next(); } catch (e) { console.error("[chunk build]", e); r = { done: true }; }
            if (SLICE_LOG) SLICE_LOG.push([this.k, this.stepN = (this.stepN || 0) + 1, +(performance.now() - t1).toFixed(1), r.value || (r.done ? "end" : "")]);
            if (r.done) { this.steps = null; this.bounds(); return true; }
            // (a ?test run takes exactly one step a frame — the same on every machine — unless it must finish)
            if (ms !== Infinity && (ctx.TEST || performance.now() - t0 >= ms)) return false;
        }
    }

    /** Where the chunk's stuff is (centre + radius) for the draw-distance cull; anything drawn without
     *  fog (a skyline meant to be seen from afar) keeps the chunk always drawn. */
    bounds() {
        const c = this.center = new THREE.Vector3(), b = new THREE.Box3(), s = new THREE.Sphere();
        this.group.updateMatrixWorld(true);
        let r = 0, n = 0;
        this.noCull = false;
        this.group.traverse(o => {
            if (!o.geometry || !(o.isMesh || o.isLine || o.isPoints)) return;
            for (const m of [].concat(o.material)) if (m && m.fog === false) this.noCull = true;
            if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); s.copy(o.boundingSphere); }
            else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); s.copy(o.geometry.boundingSphere); }
            s.applyMatrix4(o.matrixWorld);
            if (!isFinite(s.radius)) return;
            b.expandByPoint(s.center.clone().addScalar(s.radius)); b.expandByPoint(s.center.clone().subScalar(s.radius)); n++;
        });
        if (!n) { this.radius = 0; return; }
        b.getCenter(c);
        this.radius = b.getSize(s.center).length() / 2 + 20;   // (+ a margin: things added later, animated props)
    }

    addMesh(geo, mat, { cast = false, receive = true } = {}) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = cast; m.receiveShadow = receive;
        this.group.add(m);
        this.disposables.push(geo);
        return m;
    }

    tooCloseToRoad(road, x, z, s, minD) {
        const tmp = {};
        for (let ss = Math.max(0, s - 140); ss <= s + 140; ss += 10) {
            road.at(ss, tmp);
            const dx = x - tmp.x, dz = z - tmp.z;
            if (dx * dx + dz * dz < minD * minD) return true;
        }
        return false;
    }

    /** The whole build as a generator: each `yield` is a place a sliced build may stop for the frame. */
    *build(world) {
        const { road } = world;
        const M = materials(), G = geometry();
        const rnd = mulberry32(this.k * 7919 + world.seed);
        const p = {};

        // road + shoulders
        this.addMesh(ribbon(road, this.s0, this.s1, -HALF_ROAD, HALF_ROAD, 0.03, ROAD_TEX_LEN), M.road);
        const sh = [ribbon(road, this.s0, this.s1, HALF_ROAD - 0.05, SHOULDER, 0.02, 10), ribbon(road, this.s0, this.s1, -SHOULDER, -HALF_ROAD + 0.05, 0.02, 10)];
        this.addMesh(mergeGeometries(sh, false), M.shoulder);   // both shoulders: one draw call
        for (const g of sh) g.dispose();
        const drives = [];

        const nearStart = this.s0 < 120;
        const biome = world.biomeAt(this.s0 + CHUNK / 2);
        this.biome = biome;
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        const merger = new ChunkMerger();   // houses, trees, bushes, poles → a few merged meshes (merge.js)

        // houses first (not at the very start, not in reserved stretches) so trees can avoid them
        const houseSpots = [];
        if (!nearStart && biome.houses > 0) {
            const nh = rnd() < biome.houses ? 1 + Math.floor(rnd() * 3) : 0;
            for (let i = 0; i < nh; i++) {
                const s = this.s0 + 20 + rnd() * (CHUNK - 40);
                const side = rnd() < 0.5 ? -1 : 1;
                const d = side * (23 + rnd() * 10);
                if (world.isReserved(s, d, 22)) continue;
                road.point(s, d, p);
                if (this.tooCloseToRoad(road, p.x, p.z, s, 20)) continue;
                if (houseSpots.some(hh => Math.hypot(hh.x - p.x, hh.z - p.z) < 14)) continue;
                const h = road.at(s).h;
                houseSpots.push({ x: p.x, z: p.z, s, d, rot: facingRoad(h, side), walls: biome.walls[Math.floor(rnd() * biome.walls.length)], roof: biome.roofs[Math.floor(rnd() * biome.roofs.length)] });
                this.colliders.push({ x: p.x, z: p.z, r: 5.2, kind: "house" });
                // a driveway out to the road
                drives.push(ribbon(road, s - 1.6, s + 1.6, side > 0 ? SHOULDER : -Math.abs(d) + 3, side > 0 ? Math.abs(d) - 3 : -SHOULDER, 0.025, 10));
            }
            const houseModel = models[biome.houseModel || "house"];
            for (const hh of houseSpots) {
                q.setFromAxisAngle(up, hh.rot);
                mtx.compose(v.set(hh.x, 0, hh.z), q, sc.setScalar(1));
                merger.add(houseModel, mtx, { Walls: hh.walls, Roof: hh.roof }, { cast: true });
            }
        }
        this.houses = houseSpots;
        if (drives.length) { this.addMesh(mergeGeometries(drives, false), M.drive); for (const g of drives) g.dispose(); }   // the chunk's driveways: one draw call

        // trees & bushes (biome mix; features can register more types, e.g. palms)
        const mix = Object.entries(biome.trees).filter(([t, w]) => w > 0 && models[SCENERY[t] ? SCENERY[t].model : t]);
        const total = mix.reduce((acc, [, w]) => acc + w, 0);
        const spots = {};
        const dense = rnd() < 0.35;
        const count = Math.round((dense ? 54 : 34) * biome.density);
        for (let i = 0; i < count && total > 0; i++) {
            const s = this.s0 + rnd() * CHUNK;
            const side = rnd() < 0.5 ? -1 : 1;
            const d = side * (13.5 + Math.pow(rnd(), 1.5) * 80);
            if (world.isReserved(s, d, 4)) continue;
            road.point(s, d, p);
            if (this.tooCloseToRoad(road, p.x, p.z, s, 12.5)) continue;
            if (houseSpots.some(hh => Math.hypot(hh.x - p.x, hh.z - p.z) < 8)) continue;
            let r = rnd() * total, type = mix[0][0];
            for (const [t, w] of mix) { if ((r -= w) <= 0) { type = t; break; } }
            const def = SCENERY[type] || { collide: type === "bush" ? 0 : 0.5, scale: type === "bush" ? [0.8, 1.4] : [0.85, 1.45] };
            const scale = def.scale[0] + rnd() * (def.scale[1] - def.scale[0]);
            (spots[type] = spots[type] || []).push({ x: p.x, z: p.z, rot: rnd() * 6.28, scale, far: Math.abs(d) > SHADOW_D });
            if (def.collide) this.colliders.push({ x: p.x, z: p.z, r: def.collide * scale, kind: "tree" });
        }
        for (const type of Object.keys(spots)) {
            const list = spots[type];
            const def = SCENERY[type];
            const modelKey = def ? def.model : type;
            const tints = def ? def.tint : ["Leaves", "PineLeaves"];
            for (const t of list) {
                q.setFromAxisAngle(up, t.rot);
                mtx.compose(v.set(t.x, 0, t.z), q, sc.setScalar(t.scale));
                const tc = {};
                for (const tn of tints) {
                    const base = (def && def.colors && def.colors[tn]) || (tn === "PineLeaves" ? "#2F8F46" : "#6CC24A");
                    tc[tn] = new THREE.Color(base).offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.08);
                }
                merger.add(models[modelKey], mtx, tc, { cast: !t.far });   // (out in the fields: no shadow — outside the sun's box anyway)
            }
        }

        // power poles + wires on the right
        const POLE_GAP = 46;
        const poles = [];
        for (let s = Math.ceil(this.s0 / POLE_GAP) * POLE_GAP; s < this.s1 && biome.poles; s += POLE_GAP) {
            if (world.isReserved(s, 11.5, 6)) continue;
            poles.push(s);
        }
        if (poles.length) {
            const wirePts = [];
            poles.forEach((s, i) => {
                const a = road.point(s, 11.5, {});
                q.setFromAxisAngle(up, a.h);
                mtx.compose(v.set(a.x, 0, a.z), q, sc.setScalar(1));
                merger.add(G.poleTemplate, mtx, null, { cast: true });
                this.colliders.push({ x: a.x, z: a.z, r: 0.25, kind: "pole" });
                // wires to the next pole (sagging)
                const b = road.point(s + POLE_GAP, 11.5, {});
                for (const off of [-1.1, 0, 1.1]) {
                    const ax = a.x - Math.cos(a.h) * off, az = a.z + Math.sin(a.h) * off;
                    const bx = b.x - Math.cos(b.h) * off, bz = b.z + Math.sin(b.h) * off;
                    const SEG = 6;
                    for (let k = 0; k < SEG; k++) {
                        const t0 = k / SEG, t1 = (k + 1) / SEG;
                        const sag = t => 7.7 - Math.sin(t * Math.PI) * 0.9;
                        wirePts.push(ax + (bx - ax) * t0, sag(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, sag(t1), az + (bz - az) * t1);
                    }
                }
            });
            const wg = new THREE.BufferGeometry();
            wg.setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3));
            const wires = new THREE.LineSegments(wg, M.wire);
            this.group.add(wires);
            this.disposables.push(wg);
        }

        yield "scenery";      // (the road is down, the scenery is placed)
        // bake the static scenery: a few merged meshes + instanced copies of any parts that can't merge
        const baked = merger.build();
        for (const m of baked.meshes) { this.group.add(m); this.disposables.push(m.geometry); }
        for (const r of baked.rest) {
            const tints = [...new Set(r.list.flatMap(e => Object.keys(e.tints)))];
            const inst = instanced(r.template, r.list.length, tints, restFilter);
            r.list.forEach((e, i) => { inst.set(i, e.matrix); for (const tn of tints) if (e.tints[tn]) inst.color(i, tn, e.tints[tn]); });
            inst.finish();
            this.group.add(inst.group);
            this.disposables.push(inst);
        }

        // coin trails
        if (!nearStart) {
            const trails = Math.round((1 + (rnd() < 0.6 ? 1 : 0)) * biome.coins);
            for (let t = 0; t < trails; t++) {
                const start = this.s0 + 15 + rnd() * (CHUNK - 90);
                const risky = rnd() < 0.22;
                const lanes = risky ? LANES_ONCOMING : LANES_OURS;
                const pattern = rnd();
                const lane = lanes[Math.floor(rnd() * 2)];
                for (let i = 0; i < 8; i++) {
                    const s = start + i * 8;
                    let d = lane;
                    if (pattern < 0.3) d = (risky ? -1 : 1) * (LANE + Math.sin(i / 7 * Math.PI * 2) * LANE * 0.9); // slalom
                    road.point(s, d, p);
                    this.coins.push({ x: p.x, z: p.z, s, d, taken: false, value: risky ? 2 : 1 });
                }
            }
            // rare heart pickup (only matters if you've lost one)
            if (rnd() < 0.12) {
                const s = this.s0 + 40 + rnd() * 120;
                const d = LANES_OURS[Math.floor(rnd() * 2)];
                road.point(s, d, p);
                this.hearts.push({ x: p.x, z: p.z, s, taken: false });
            }
        }
        for (const ht of this.hearts) {
            const g = new THREE.Group();
            const m = new THREE.Mesh(G.heart, M.heart);
            m.castShadow = true;
            g.add(m);
            g.position.set(ht.x, 1.3, ht.z);
            ht.obj = g;
            this.group.add(g);
        }

        // road signs at fixed distances
        for (const sign of world.signs) {
            if (sign.s >= this.s0 && sign.s < this.s1) this.addSign(world, sign);
        }

        // speed trap: a parked cop with a speed-limit sign 170 m before it
        if (world.config.speedTraps && this.k % 6 === 4 && !world.isReserved(this.s0 + 120, 10.4, 8)) {
            const s = this.s0 + 120;
            this.addSign(world, { s: s - 170, d: 10.2, lines: ["SPEED", "LIMIT", "70"], bg: "#ffffff", fg: "#111111", w: 1.6, h: 2.0, tw: 256, th: 320 });
            road.point(s, 10.4, p);
            const cop = cloneWithColors(models.cop);
            cop.position.set(p.x, 0, p.z);
            cop.rotation.y = road.at(s).h + 0.12;
            this.group.add(cop);
            this.disposables.push(farLod(cop));     // one draw call while it's far away (lod.js)
            this.colliders.push({ x: p.x, z: p.z, r: 1.4, kind: "cop" });
            this.traps.push({ s, triggered: false, obj: cop });
        }

        yield "bake";      // (the built-in scenery is baked + signs, the speed trap)
        // features add their own set pieces (stops, toll plazas, events…) — one listener at a time, so a sliced build
        // can spread them over frames (same order, same payload, errors logged: as emit("chunk:build") does)
        const ev = { chunk: this, world, rnd, s0: this.s0, s1: this.s1, biome };
        for (const fn of listenersOf("chunk:build")) {
            try { fn(ev); } catch (e) { console.error("[event chunk:build]", e); }
            yield "feature";
        }

        // coins last, so chunk:build listeners can add their own to this.coins
        if (this.coins.length) {
            this.coinMesh = new THREE.InstancedMesh(G.coin, M.coin, this.coins.length);
            this.coinMesh.castShadow = true;
            this.group.add(this.coinMesh);
            this.disposables.push(this.coinMesh);
            this.updateCoins(0);
            this.coinMesh.computeBoundingSphere();
        }
    }

    /** For "chunk:build" listeners: add an object to this chunk (removed with it). */
    add(obj) { this.group.add(obj); return obj; }
    /** Free a geometry / material / instanced helper when the chunk is recycled. */
    own(thing) { this.disposables.push(thing); return thing; }
    /** A static obstacle circle the car bumps into ({x, z, r, kind}). */
    addCollider(c) { this.colliders.push(c); return c; }
    /** fn(time, dt) every frame while the chunk is alive. */
    onAnimate(fn) { this.anim.push({ fn }); }
    /** A road sign (same look as the built-in ones). */
    sign(world, def) { this.addSign(world, def); }

    addSign(world, sign) {
        const M = materials(), G = geometry();
        // never on a lane (an exit's decel lane, a ramp, a gore — see `paved`): slide it out past the asphalt
        let d = sign.d;
        const half = (sign.w || 4.2) / 2 + 0.25;
        if (!offLanes(sign.s, d, half, 0.4)) {
            const dir = d < 0 ? -1 : 1;
            let k = 1;
            while (k <= 60 && !offLanes(sign.s, d + dir * k, half, 0.4)) k++;
            if (k > 60) return;
            d += dir * k;
        }
        sign.builtD = d;
        const p = world.road.point(sign.s, d, {});
        const h = world.road.at(sign.s).h;
        const w = sign.w || 4.2, ht = sign.h || 2.1;
        const g = new THREE.Group();
        g.position.set(p.x, 0, p.z);
        g.rotation.y = h + Math.PI; // board faces oncoming drivers (us)
        const te = signEntry(sign.lines, sign.bg, sign.fg, sign.tw, sign.th), tex = te.tex;
        te.refs++;
        this.disposables.push({ dispose: () => releaseSign(te) });
        // two draw calls a sign: the metal (board edges + back + posts, merged) and the printed face
        const y = 2.2 + ht / 2;
        const box = new THREE.BoxGeometry(w, ht, 0.08).translate(0, y, 0);
        const idx = box.index.array, keep = [];
        for (let i = 0; i < idx.length; i++) if (i < 24 || i >= 30) keep.push(idx[i]);   // (group 4 = the +Z face)
        box.setIndex(keep); box.clearGroups();
        const parts = [box];
        for (const off of (w > 2.5 ? [-w * 0.32, w * 0.32] : [0])) {
            const sy = 2.2 + ht * 0.6;
            parts.push(G.post.clone().scale(1, sy, 1).translate(off, sy / 2, 0.06));
        }
        // an exit-number tab on top of the board, at its right end ("EXIT 91"): its metal joins the merged metal,
        // its face is a ref-counted sign texture like the board's (freed with the chunk)
        let tabFace = null;
        if (sign.tab) {
            const tw = Math.max(1.4, w * 0.42), th = 0.55;
            const tx = w / 2 - tw / 2, ty = 2.2 + ht + th / 2 - 0.02;
            const tb = new THREE.BoxGeometry(tw, th, 0.08).translate(tx, ty, 0);
            const ti = tb.index.array, tk = [];
            for (let i = 0; i < ti.length; i++) if (i < 24 || i >= 30) tk.push(ti[i]);
            tb.setIndex(tk); tb.clearGroups();
            parts.push(tb);
            const tt = signEntry([sign.tab], sign.bg, sign.fg, 320, 112);
            tt.refs++;
            this.disposables.push({ dispose: () => releaseSign(tt) });
            tabFace = new THREE.Mesh(new THREE.PlaneGeometry(tw, th).translate(tx, ty, 0.0405), signMaterial(tt.tex));
            this.disposables.push(tabFace.geometry);
        }
        const metalGeo = mergeGeometries(parts, false);
        for (const x of parts) x.dispose();
        const metal = new THREE.Mesh(metalGeo, M.metal);
        metal.castShadow = true;
        const face = new THREE.Mesh(new THREE.PlaneGeometry(w, ht).translate(0, y, 0.0405), signMaterial(tex));
        g.add(metal, face);
        if (tabFace) g.add(tabFace);
        this.group.add(g);
        this.disposables.push(metalGeo, face.geometry);
        this.colliders.push({ x: p.x, z: p.z, r: 0.3, kind: "sign" });
    }

    updateCoins(time) {
        if (!this.coinMesh) return;
        const mtx = _cm, q = _cq, v = _cv, sc = _cs, cs = this.coins;
        for (let i = 0; i < cs.length; i++) {
            const c = cs[i];
            q.setFromAxisAngle(_UP, time * 3 + c.s * 0.1);
            const y = 1.05 + Math.sin(time * 4 + c.s) * 0.12;
            mtx.compose(v.set(c.x, y, c.z), q, sc.setScalar(c.taken ? 0 : c.value > 1 ? 1.25 : 1));
            this.coinMesh.setMatrixAt(i, mtx);
        }
        this.coinMesh.instanceMatrix.needsUpdate = true;
    }

    animate(time) {
        this.updateCoins(time);
        for (const ht of this.hearts) {
            if (ht.taken) continue;
            ht.obj.rotation.y = time * 2.2;
            ht.obj.position.y = 1.3 + Math.sin(time * 3) * 0.15;
        }
        for (const a of this.anim) {
            if (a.fn) { try { a.fn(time); } catch (e) { console.error("[chunk anim]", e); a.fn = null; } }
            else if (a.obj) a.obj.position.y = a.base + Math.sin(time * 1.6 + a.ph) * 0.18;
        }
    }

    dispose(scene) {
        this.steps = null;          // (a sliced build that never finished: it stops here)
        emit("chunk:dispose", { chunk: this });
        scene.remove(this.group);
        for (const d of this.disposables) if (d && d.dispose) d.dispose();
    }
}

// ── scenery types features can add (palms, cacti, neon signs…) ─────────
const SCENERY = {};
/**
 * registerScenery("palm", { model: "palm", collide: 0.4, scale: [0.9, 1.3], tint: ["PalmLeaves"], colors: {PalmLeaves: "#3fa34d"} })
 * then use it in a biome's `trees` mix: { palm: 0.6, bush: 0.4 }.
 */
export function registerScenery(type, def) {
    SCENERY[type] = Object.assign({ collide: 0.5, scale: [0.85, 1.4], tint: [], colors: {} }, def);
}

const DEFAULT_BIOME = Object.freeze({
    name: "suburbs",
    trees: { treeRound: 0.48, treePine: 0.34, bush: 0.18 },
    density: 1,          // tree count multiplier
    houses: 0.55,        // chance a chunk has 1–3 houses
    houseModel: "house",
    walls: WALLS, roofs: ROOFS,
    poles: true,         // power poles + wires on the right
    coins: 1,            // coin-trail multiplier
    ground: "#ffffff",   // tint multiplied onto the grass texture (#fff = green grass)
});

// ── the world ──────────────────────────────────────────────────────────
export class World {
    constructor(scene, seed = 20261104) {
        this.scene = scene;
        this.seed = seed;
        this.highway = new Road(seed);
        this.district = null;
        this.chunks = new Map();
        this.config = { speedTraps: true };
        this.drawScale = 1;          // × the fog's far distance = how far chunks are drawn (core/quality.js: Low pulls it in)
        this.reserved = [];
        // Road signs: {s, d, lines, bg, fg, w, h}. Add yours with addSign() before
        // the chunk at that distance is built (i.e. at init or ~700 m ahead).
        this.signs = [
            { s: 50, d: 10.6, lines: ["LEAVING", "LAKEWOOD"], bg: "#1f7a46" },
            { s: 70, d: -10.6, lines: ["WELCOME TO", "LAKEWOOD"], bg: "#1f7a46" },
        ];
        this.buildGround();
        this.buildSky();
        this.time = 0;
        this.groundTint = new THREE.Color("#ffffff");
    }

    /**
     * The biome at distance s. Features (the journey) REPLACE this function:
     *   world.biomeAt = s => ({ ...world.defaultBiome(), trees: { palm: 1 }, houses: 0.2, ground: "#f3e3b0" })
     */
    biomeAt(s) { return DEFAULT_BIOME; }

    /** The road everything drives on: the highway, or (while one is active) a district's streets. */
    get road() { return this.district ? this.district.road : this.highway; }

    /**
     * A DISTRICT takes the player off the highway into a separate street network in the
     * same scene (features/town: Lakewood). While one is set, world.road is the district's
     * road (same API: at / point / nearest, s + d along its streets), activeChunks() yields
     * the district's chunk-likes ({s0, s1, colliders, coins, hearts, traps}), and the
     * highway's chunks are kept but hidden and stop streaming. setDistrict(null) puts it back.
     * district: { road, chunks: [], ground?: "#hex", keepHighway?: true }
     * keepHighway (a town ATTACHED to the highway at an interchange): the highway's chunks stay in view (drawn
     * out to the fog like on the highway, but no streaming) — she drove off it, it's still there behind her.
     */
    setDistrict(d) {
        this.district = d || null;
        const show = !this.district || !!this.district.keepHighway;
        for (const c of this.chunks.values()) c.group.visible = show;
    }
    defaultBiome() { return { ...DEFAULT_BIOME, trees: { ...DEFAULT_BIOME.trees } }; }

    /** Keep a stretch of roadside clear of random scenery (for a set piece). side: 1 right, -1 left, 0 both. */
    reserve(s0, s1, side = 0, dMin = 0, dMax = 999) { this.reserved.push({ s0, s1, side, dMin, dMax }); }
    isReserved(s, d, margin = 0) {
        for (const r of this.reserved) {
            if (s < r.s0 - margin || s > r.s1 + margin) continue;
            if (r.side && Math.sign(d) !== r.side) continue;
            const ad = Math.abs(d);
            if (ad >= r.dMin - margin && ad <= r.dMax + margin) return true;
        }
        return false;
    }
    clearReserved() { this.reserved.length = 0; }

    addSign(def) { this.signs.push(def); }

    /** Sky gradient + fog colour (journey: dusk at the beach, night in Vegas…). */
    setSky({ top, mid, bottom, fog, fogNear, fogFar } = {}) {
        const u = this.sky.material.uniforms;
        if (top) u.top.value.set(top);
        if (mid) u.mid.value.set(mid);
        if (bottom) u.bottom.value.set(bottom);
        if (this.scene.fog) {
            if (fog) this.scene.fog.color.set(fog);
            if (fogNear) this.scene.fog.near = fogNear;
            if (fogFar) this.scene.fog.far = fogFar;
        }
    }

    buildGround() {
        const tex = grassTexture();
        const SIZE = 1800, PERIOD = 9;
        tex.repeat.set(SIZE / PERIOD, SIZE / PERIOD);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: "#ffffff" }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.ground = ground;
        this.groundPeriod = PERIOD;
        this.scene.add(ground);
    }

    buildSky() {
        const geo = new THREE.SphereGeometry(950, 32, 16);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { top: { value: new THREE.Color("#3f9be6") }, mid: { value: new THREE.Color("#9fd4fa") }, bottom: { value: new THREE.Color("#dff3ff") } },
            vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
            fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bottom, mid, smoothstep(-0.02, 0.15, h)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}",
        });
        this.sky = new THREE.Mesh(geo, mat);
        this.sky.renderOrder = -1;
        this.scene.add(this.sky);

        // puffy low-poly clouds
        this.clouds = new THREE.Group();
        const cm = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, fog: false, emissive: "#ffffff", emissiveIntensity: 0.35, flatShading: true });
        const cg = new THREE.IcosahedronGeometry(1, 1);
        const rnd = mulberry32(99);
        for (let i = 0; i < 16; i++) {
            const c = new THREE.Group();
            for (let j = 0; j < 5; j++) {
                const m = new THREE.Mesh(cg, cm);
                const r = 14 + rnd() * 14;
                m.scale.set(r * 1.4, r * 0.7, r);
                m.position.set((j - 2) * 18 + rnd() * 8, rnd() * 6, rnd() * 10);
                c.add(m);
            }
            const a = rnd() * Math.PI * 2, dist = 450 + rnd() * 300;
            c.position.set(Math.cos(a) * dist, 120 + rnd() * 90, Math.sin(a) * dist);
            c.rotation.y = rnd() * 6;
            this.clouds.add(c);
        }
        this.scene.add(this.clouds);
    }

    /** Stream chunks around the player; animate coins etc. */
    update(dt, playerS, camPos, buildBudget = 1) {
        this.time += dt;
        if (this.district) {
            if (this.district.keepHighway) this.cullChunks(camPos, this.district.highwayFar);
            this.follow(dt, camPos, this.district.ground || "#ffffff", buildBudget);
            return;
        }
        const kMin = Math.max(0, Math.floor((playerS - BEHIND) / CHUNK));
        const kMax = Math.floor((playerS + AHEAD) / CHUNK);
        for (const [k, c] of this.chunks) {
            if (k < kMin || k > kMax) { c.dispose(this.scene); this.chunks.delete(k); }
        }
        let built = 0;
        // a chunk that's being built in slices: carry on (finish it now if she is suddenly close, or on a prebuild)
        let pend = this.pending && this.chunks.get(this.pending.k) === this.pending ? this.pending : null;
        if (pend) {
            const now = buildBudget > 1 || pend.s0 < playerS + SLICE_NEAR;
            if (pend.advance(now ? Infinity : SLICE_MS)) pend = null; else built++;
        }
        this.pending = pend;
        for (let k = kMin; k <= kMax && built < buildBudget; k++) {
            if (this.chunks.has(k)) continue;
            // far ahead (the normal case while driving): in slices; close by or prebuilding: all at once
            const sliced = buildBudget === 1 && !this.pending && k * CHUNK >= playerS + SLICE_NEAR;
            const c = new Chunk(this, k, sliced);
            this.chunks.set(k, c);
            if (sliced) this.pending = c;
            built++;
        }
        for (const c of this.chunks.values()) c.animate(this.time);
        this.cullChunks(camPos);
        this.follow(dt, camPos, this.biomeAt(playerS).ground || "#ffffff", buildBudget);
    }

    /** Draw distance: a chunk wholly beyond the fog (× the graphics tier's drawScale; or `cap` m) isn't drawn —
     *  it would only be fog-coloured there anyway. (Its colliders, coins and animation carry on.) */
    cullChunks(camPos, cap = Infinity) {
        const fog = this.scene.fog, far = Math.min(cap, Math.max(200, (fog ? fog.far : 2000) * this.drawScale));
        for (const c of this.chunks.values()) {
            const dx = c.center.x - camPos.x, dz = c.center.z - camPos.z;
            c.group.visible = c.noCull || dx * dx + dz * dz < (far + c.radius) * (far + c.radius);
            // (in a district that keeps the highway: it may hide a chunk it stands in front of — a town's blocks)
            if (c.group.visible && this.district && this.district.see && !this.district.see(c)) c.group.visible = false;
        }
    }

    /** Ground, sky and clouds ride along with the camera; the grass eases toward `ground`. */
    follow(dt, camPos, ground, buildBudget = 1) {
        const P = this.groundPeriod;
        this.ground.position.set(Math.round(camPos.x / P) * P, 0, Math.round(camPos.z / P) * P);
        this.sky.position.copy(camPos);
        this.clouds.position.set(camPos.x, 0, camPos.z);
        this.clouds.rotation.y += dt * 0.004;
        _tint.set(ground);
        this.groundTint.lerp(_tint, Math.min(1, dt * 0.6 + (buildBudget > 1 ? 1 : 0)));
        this.ground.material.color.copy(this.groundTint);
    }

    /** Build everything near the start before the first frame (always the highway's chunks). */
    prebuild(playerS) {
        const d = this.district;
        this.district = null;
        this.update(0, playerS, new THREE.Vector3(), 99);
        if (d) this.setDistrict(d);
    }

    /** (see SLICE_LOG) */
    get sliceLog() { return SLICE_LOG; }
    set sliceLog(v) { SLICE_LOG = v || null; }

    activeChunks() { return this.district ? this.district.chunks : this.chunks.values(); }   // (no generator: called every frame by many features)

    resetCoins() {
        for (const c of this.chunks.values()) {
            for (const coin of c.coins) coin.taken = false;
            for (const t of c.traps) t.triggered = false;
            for (const ht of c.hearts) { ht.taken = false; ht.obj.visible = true; }
        }
    }
}

// helpers for features building their own roadside set pieces
export { ribbon, signTexture, facingRoad, materials as worldMaterials, mulberry32, canvasTex };
