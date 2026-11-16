// features/feel — DAMAGE YOU CAN SEE on Lulu's own car.
//
// Every heart she loses leaves a mark where she got hit, and it adds up:
//   stage 1  dents + scratches at the impact (front / rear / left / right)
//   stage 2  + a cracked windshield
//   stage 3  + a smoking hood
//   stage 4  her LAST heart: + a hubcap pops off and rolls away down the road,
//            a bumper droops and drags, throwing sparks (and scraping, positionally)
//   wrecked  thick black smoke
// With the usual 3 hearts: hit 1 → dents + crack, hit 2 (last heart) → smoke,
// hubcap, bumper. More hearts (the floatie) spread the stages out.
//
// Cheap tricks only: the Body / Chrome geometry is CLONED once per car model and its
// vertices nudged (dents, the drooping bumper); dents + scratches are projected decals
// (triangles copied off the dented body, planar UVs) packed into two pre-allocated
// buffers — 2 draw calls however many hits; the crack is one quad on the windshield;
// the hubcap is swapped for a bare hub (Blender: feel_hubcap / feel_barehub). Smoke and
// sparks write straight into the car's particle arrays. Nothing allocates per frame.
//
// Repairs: a new run, Paint & Pray (streets:paint), the ER (er:admit → cameos:resume),
// the title screen; a heart pickup undoes one stage. Only her OWN car (not on foot,
// not a borrowed / jacked ride). In a party it's purely local and cosmetic.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { models, registerModels, ensureModels } from "../../models.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";

registerModels({ feel_hubcap: "feel_hubcap", feel_barehub: "feel_barehub" });

const MAX_HITS = 8;
const DENT_TRIS = 900, SCRATCH_TRIS = 900;

export const D = {
    k: 0,                // hits shown (wear)
    hits: [],            // { side, x, y, z, seed } in model space, oldest first
    stage: 0,
    model: null,         // the car.model the damage is built on
    body: null, bodyOrig: null, chrome: null, chromeOrig: null,
    crack: null, ws: null,
    rimHidden: [], bareHub: null, hubWheel: null,
    dragPt: null, dragFront: false,
    scrape: null,
    smokeT: 0, sparkT: 0,
    hub: null,           // the rolling hubcap { obj, x, z, vx, vz, roll, lean, t, flat }
    lastCrash: { x: 0, z: 0, t: -99 },
    stats: { hits: 0, repairs: 0, hubcaps: 0, rebuilds: 0, sparks: 0 },
};

// ── textures (canvas, made once) ──────────────────────────────────────────
function tex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d");
    draw(g, w, h);
    g.clearRect(0, 0, w, 2); g.clearRect(0, h - 2, w, 2); g.clearRect(0, 0, 2, h); g.clearRect(w - 2, 0, 2, h);   // clamp → transparent outside
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = 4;
    return t;
}
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// The dent: a decal in the car's OWN paint (it shares the Body material's colour) whose normal map
// is a crumpled bowl — on the big flat panels (no vertices to push) the light does the denting.
const DENT_TEX = tex(128, 128, (g, w, h) => {
    const r = rng(7);
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2 - 3);
    grd.addColorStop(0, "rgba(205,200,202,1)"); grd.addColorStop(0.62, "rgba(235,232,233,0.95)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(90,80,85,0.55)"; g.lineWidth = 1.6;
    for (let i = 0; i < 6; i++) {                       // crumple creases
        const a = r() * Math.PI * 2, l = w * (0.14 + r() * 0.2);
        g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 6, h / 2 + Math.sin(a) * 6); g.lineTo(w / 2 + Math.cos(a + 0.2) * l, h / 2 + Math.sin(a + 0.2) * l); g.stroke();
    }
});
const DENT_NRM = (() => {
    const n = 128, c = document.createElement("canvas");
    c.width = c.height = n;
    const g = c.getContext("2d"), img = g.createImageData(n, n), r = rng(3);
    const waves = [0, 1, 2, 3, 4].map(() => [r() * 6.28, 4 + Math.floor(r() * 5), 0.05 + r() * 0.06]);
    const H = (x, y) => {                               // a bowl with crumple ridges, 0 at the rim
        const dx = x / n * 2 - 1, dy = y / n * 2 - 1, rr = Math.sqrt(dx * dx + dy * dy);
        if (rr >= 1) return 0;
        const a = Math.atan2(dy, dx);
        let k = 0;
        for (const [ph, f, amp] of waves) k += Math.sin(a * f + ph) * amp;
        return -Math.pow(1 - rr * rr, 2) * (1 + k * (1 - rr));
    };
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const sx = (H(x + 1, y) - H(x - 1, y)) * 9, sy = (H(x, y + 1) - H(x, y - 1)) * 9;
        let nx = -sx, ny = sy, nz = 1;                 // canvas y runs down, the texture's v up
        const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
        const o = (y * n + x) * 4;
        img.data[o] = (nx * 0.5 + 0.5) * 255; img.data[o + 1] = (ny * 0.5 + 0.5) * 255; img.data[o + 2] = (nz * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
})();
const SCRATCH_TEX = tex(256, 96, (g, w, h) => {
    const r = rng(11);
    for (let i = 0; i < 22; i++) {
        const y = h * (0.2 + r() * 0.6), x0 = w * (0.05 + r() * 0.3), x1 = w * (0.55 + r() * 0.4), dy = (r() - 0.5) * h * 0.25;
        g.strokeStyle = i % 4 === 0 ? "rgba(40,40,45,0.55)" : `rgba(235,236,240,${0.45 + r() * 0.45})`;
        g.lineWidth = 0.8 + r() * 2.2;
        g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y + dy, x1, y + dy * 0.4); g.stroke();
    }
    for (let i = 0; i < 14; i++) {                      // paint chips (primer grey)
        g.fillStyle = "rgba(170,172,178,0.85)";
        g.beginPath(); g.ellipse(w * (0.15 + r() * 0.7), h * (0.25 + r() * 0.5), 2 + r() * 5, 1.5 + r() * 3, r() * 3, 0, Math.PI * 2); g.fill();
    }
});
const CRACK_TEX = tex(512, 160, (g, w, h) => {
    const r = rng(23), cx = w * 0.28, cy = h * 0.45;
    g.fillStyle = "rgba(255,255,255,0.18)";
    g.beginPath(); g.arc(cx, cy, 14, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineCap = "round";
    for (let i = 0; i < 13; i++) {                      // the star
        let a = (i / 13) * Math.PI * 2 + r() * 0.3, x = cx, y = cy, len = 40 + r() * 180;
        g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x, y);
        for (let s = 0; s < 6; s++) { a += (r() - 0.5) * 0.5; x += Math.cos(a) * len / 6; y += Math.sin(a) * len / 6 * 0.6; g.lineTo(x, y); g.lineWidth = 2.2 - s * 0.3; }
        g.stroke();
    }
    g.lineWidth = 1.1; g.strokeStyle = "rgba(255,255,255,0.65)";
    for (const rad of [24, 46, 74]) {                   // the rings
        g.beginPath();
        for (let k = 0; k <= 26; k++) { const a = k / 26 * Math.PI * 2, rr = rad * (0.85 + r() * 0.3); const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6; k ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
    }
});

const decalMat = map => new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const SCRATCH_MAT = decalMat(SCRATCH_TEX);
const DENT_MAT = new THREE.MeshStandardMaterial({ map: DENT_TEX, normalMap: DENT_NRM, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.35, metalness: 0.05,
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
const CRACK_MAT = new THREE.MeshBasicMaterial({ map: CRACK_TEX, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.95 });
const CRACK_GEO = new THREE.PlaneGeometry(1.34, 0.4);

/** A pre-allocated decal buffer: triangles copied off the body, one draw call. */
class DecalBuf {
    constructor(max, mat) {
        this.max = max; this.n = 0;
        this.pos = new Float32Array(max * 9); this.nrm = new Float32Array(max * 9); this.uv = new Float32Array(max * 6);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
        geo.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(this.uv, 2));
        geo.setDrawRange(0, 0);
        this.geo = geo;
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.name = "FeelDecals";
        this.mesh.renderOrder = 2;
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = false;
    }
    reset() { this.n = 0; this.geo.setDrawRange(0, 0); }
    commit() {
        this.geo.setDrawRange(0, this.n * 3);
        for (const k of ["position", "normal", "uv"]) this.geo.attributes[k].needsUpdate = true;
        this.mesh.visible = this.n > 0;
    }
}
const DENTS = new DecalBuf(DENT_TRIS, DENT_MAT), SCRATCHES = new DecalBuf(SCRATCH_TRIS, SCRATCH_MAT);

// scratch vectors (no per-frame allocation)
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

// ── where on the body a hit lands ─────────────────────────────────────────
const SIDES = {
    front: { N: [0, 0, 1], T: [0, 1, 0], B: [1, 0, 0] },
    rear:  { N: [0, 0, -1], T: [0, 1, 0], B: [-1, 0, 0] },
    left:  { N: [1, 0, 0], T: [0, 1, 0], B: [0, 0, -1] },     // model +X = the car's LEFT
    right: { N: [-1, 0, 0], T: [0, 1, 0], B: [0, 0, 1] },
    top:   { N: [0, 1, 0], T: [0, 0, 1], B: [1, 0, 0] },
};
/** World hit point → { side, x, y, z } on the body surface (model space). */
export function sideOf(wx, wz) {
    const car = ctx.car;
    const dx = wx - car.pos.x, dz = wz - car.pos.z, ch = Math.cos(car.h), sh = Math.sin(car.h);
    const lx = dx * ch - dz * sh, lz = dx * sh + dz * ch;
    return surfacePoint(Math.abs(lz) / 1.98 >= Math.abs(lx) / 0.9 ? (lz >= 0 ? "front" : "rear") : (lx >= 0 ? "left" : "right"), lx, lz);
}
function surfacePoint(side, lx, lz) {
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    if (side === "front") return { side, x: clamp(lx, -0.55, 0.55), y: 0.64, z: 1.97 };
    if (side === "rear") return { side, x: clamp(lx, -0.55, 0.55), y: 0.64, z: -1.97 };
    const z = clamp(lz, -1.55, 1.55);
    return { side, x: side === "left" ? 0.9 : -0.9, y: 0.62, z: Math.abs(Math.abs(z) - 1.28) < 0.32 ? (z > 0 ? 0.88 : -0.86) : z };   // not over a wheel arch
}

// ── building it on the current model ─────────────────────────────────────
function findParts(model) {
    let body = null, chrome = null, ws = null;
    model.traverse(o => {
        if (o.name === "ws") ws = o;
        if (!o.isMesh || !o.parent || !/LuluCar_body/.test(o.parent.name + o.name)) return;
        if (o.material.name === "Body") body = o;
        else if (o.material.name === "Chrome") chrome = o;
    });
    return { body, chrome, ws };
}

function attach(model) {
    detach();
    D.model = model;
    if (!model) return;
    const p = findParts(model);
    D.body = p.body; D.chrome = p.chrome; D.ws = p.ws;
    if (D.body) {
        D.body.add(DENTS.mesh); D.body.add(SCRATCHES.mesh);
        const m = D.body.material;
        DENT_MAT.color = m.color;                        // the SAME Color: a repaint recolours the dents too
        DENT_MAT.roughness = m.roughness != null ? m.roughness : 0.35; DENT_MAT.metalness = m.metalness || 0;
    }
    if (!D.dragPt) { D.dragPt = new THREE.Object3D(); D.dragPt.name = "FeelDragPoint"; }
    model.add(D.dragPt);
}
function detach() {
    restoreGeo();
    if (DENTS.mesh.parent) DENTS.mesh.parent.remove(DENTS.mesh);
    if (SCRATCHES.mesh.parent) SCRATCHES.mesh.parent.remove(SCRATCHES.mesh);
    if (D.crack && D.crack.parent) D.crack.parent.remove(D.crack);
    if (D.dragPt && D.dragPt.parent) D.dragPt.parent.remove(D.dragPt);
    showRim();
    D.model = null; D.body = D.chrome = D.ws = null;
}
function restoreGeo() {
    if (D.body && D.bodyOrig) { D.body.geometry.dispose(); D.body.geometry = D.bodyOrig; }
    if (D.chrome && D.chromeOrig) { D.chrome.geometry.dispose(); D.chrome.geometry = D.chromeOrig; }
    D.bodyOrig = D.chromeOrig = null;
}
function ownGeo(mesh, key) {
    if (!mesh) return null;
    if (!D[key]) { D[key] = mesh.geometry; mesh.geometry = mesh.geometry.clone(); }
    else mesh.geometry.attributes.position.array.set(D[key].attributes.position.array);
    return mesh.geometry;
}

/** Push vertices near p inward along -N (a dent), with a little crumple. */
function dent(geo, p, N, R, depth, seed) {
    const pos = geo.attributes.position, a = pos.array, r = rng(seed);
    const jx = (r() - 0.5) * 0.02, jy = (r() - 0.5) * 0.03;
    for (let i = 0; i < a.length; i += 3) {
        const dx = a[i] - p.x, dy = a[i + 1] - p.y, dz = a[i + 2] - p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d >= R) continue;
        const w = (1 - d / R) ** 2, h = Math.sin(i * 12.9898 + seed) * 0.5 + 0.5;
        a[i] -= N[0] * w * depth * (0.8 + 0.4 * h) - jx * w;
        a[i + 1] -= N[1] * w * depth + w * 0.018 * h - jy * w;
        a[i + 2] -= N[2] * w * depth * (0.8 + 0.4 * h);
    }
    pos.needsUpdate = true;
}
/** The drooping bumper: rear (or front) chrome bar swings down from its left end. */
function droop(geo, front) {
    const a = geo.attributes.position.array, zs = front ? 1 : -1;
    for (let i = 0; i < a.length; i += 3) {
        if (a[i + 2] * zs < 1.86 || a[i + 1] > 0.6) continue;
        const k = (0.83 - a[i]) / 1.66;                          // 0 at the hinge (left end) … 1 at the far end
        a[i + 1] -= k * 0.36;
        a[i + 2] += zs * k * 0.03;
    }
    geo.attributes.position.needsUpdate = true;
    D.dragPt.position.set(-0.8, 0.1, zs * 2.04);
    D.dragFront = front;
}

/** Copy the body triangles under a decal (planar projection along N) into buf. */
function project(geo, buf, p, S, w, h, maxDepth) {
    const pos = geo.attributes.position.array, nrm = geo.attributes.normal.array, idx = geo.index ? geo.index.array : null;
    const nTri = idx ? idx.length / 3 : pos.length / 9;
    const N = S.N, T = S.T, B = S.B;
    const uvs = [0, 0, 0, 0, 0, 0];
    for (let t = 0; t < nTri && buf.n < buf.max; t++) {
        const ia = idx ? idx[t * 3] : t * 3, ib = idx ? idx[t * 3 + 1] : t * 3 + 1, ic = idx ? idx[t * 3 + 2] : t * 3 + 2;
        _a.fromArray(pos, ia * 3); _b.fromArray(pos, ib * 3); _c.fromArray(pos, ic * 3);
        _e1.subVectors(_b, _a); _e2.subVectors(_c, _a); _n.crossVectors(_e1, _e2);
        const len = _n.length();
        if (len < 1e-9) continue;
        if ((_n.x * N[0] + _n.y * N[1] + _n.z * N[2]) / len < 0.25) continue;     // faces the hit
        let dsum = 0;
        for (let k = 0; k < 3; k++) {
            const v = k === 0 ? _a : k === 1 ? _b : _c;
            const dx = v.x - p.x, dy = v.y - p.y, dz = v.z - p.z;
            uvs[k * 2] = (dx * B[0] + dy * B[1] + dz * B[2]) / w + 0.5;
            uvs[k * 2 + 1] = (dx * T[0] + dy * T[1] + dz * T[2]) / h + 0.5;
            dsum += dx * N[0] + dy * N[1] + dz * N[2];
        }
        if (dsum / 3 < -maxDepth || dsum / 3 > 0.3) continue;        // the surface under the decal, not the far side
        if (!triOverlapsUnit(uvs)) continue;                         // its footprint touches the decal square
        const o = buf.n * 9, ou = buf.n * 6;
        for (let k = 0; k < 3; k++) {
            const vi = (k === 0 ? ia : k === 1 ? ib : ic) * 3;
            const nx = nrm[vi], ny = nrm[vi + 1], nz = nrm[vi + 2];
            buf.pos[o + k * 3] = pos[vi] + nx * 0.006; buf.pos[o + k * 3 + 1] = pos[vi + 1] + ny * 0.006; buf.pos[o + k * 3 + 2] = pos[vi + 2] + nz * 0.006;
            buf.nrm[o + k * 3] = nx; buf.nrm[o + k * 3 + 1] = ny; buf.nrm[o + k * 3 + 2] = nz;
            buf.uv[ou + k * 2] = uvs[k * 2]; buf.uv[ou + k * 2 + 1] = uvs[k * 2 + 1];
        }
        buf.n++;
    }
}
/** 2-D separating-axis test: does triangle t (u0,v0,u1,v1,u2,v2) overlap the square [0,1]²? */
function triOverlapsUnit(t) {
    if (Math.max(t[0], t[2], t[4]) < 0 || Math.min(t[0], t[2], t[4]) > 1) return false;
    if (Math.max(t[1], t[3], t[5]) < 0 || Math.min(t[1], t[3], t[5]) > 1) return false;
    for (let e = 0; e < 3; e++) {
        const ax = t[e * 2], ay = t[e * 2 + 1], bx = t[(e * 2 + 2) % 6], by = t[(e * 2 + 3) % 6], cx = t[(e * 2 + 4) % 6], cy = t[(e * 2 + 5) % 6];
        const nx = ay - by, ny = bx - ax;                            // edge normal
        const side = (cx - ax) * nx + (cy - ay) * ny;                // where the third vertex is
        let lo = Infinity, hi = -Infinity;
        for (let k = 0; k < 4; k++) { const d = ((k & 1) - ax) * nx + ((k >> 1) - ay) * ny; if (d < lo) lo = d; if (d > hi) hi = d; }
        if (side >= 0 ? hi < 0 : lo > 0) return false;               // the whole square is outside this edge
    }
    return true;
}

/** Stage for k hits (with this many max hearts). */
export function stageFor(k, maxHearts) {
    if (k <= 0) return 0;
    const lastK = Math.max(1, maxHearts - 1);
    if (k >= lastK) return 4;
    return Math.min(3, Math.ceil(k * 3 / lastK));
}

/** Rebuild everything from D.hits[0..k) on the current model (event time only). */
function rebuild(fresh = false) {
    const car = ctx.car;
    if (!car || !car.model) return;
    if (D.model !== car.model) attach(car.model);
    D.stats.rebuilds++;
    if (D.body) DENT_MAT.color = D.body.material.color;     // (a respray may have swapped the material)
    const k = D.k, hits = D.hits.slice(0, k);
    const maxH = (ctx.G && ctx.G.maxHearts) || 3;
    const prevStage = D.stage;
    D.stage = stageFor(k, maxH);
    DENTS.reset(); SCRATCHES.reset();
    if (!k) {
        restoreGeo();
        DENTS.commit(); SCRATCHES.commit();
        if (D.crack) D.crack.visible = false;
        showRim(); stopScrape(); despawnHub();
        return;
    }
    // dents (vertex nudges on our own copy of the geometry)
    const bg = ownGeo(D.body, "bodyOrig"), cg = ownGeo(D.chrome, "chromeOrig");
    for (const h of hits) {
        const S = SIDES[h.side];
        if (bg) dent(bg, h, S.N, h.side === "front" || h.side === "rear" ? 0.62 : 0.5, 0.075, h.seed);
        if (cg && (h.side === "front" || h.side === "rear")) dent(cg, h, S.N, 0.5, 0.06, h.seed);
        if (bg && (h.side === "front" || h.side === "rear")) {      // the chase cam sees the hood / deck: crumple the top edge too
            _v.set(h.x, 0.89, h.side === "front" ? 1.62 : -1.62);
            dent(bg, _v, SIDES.top.N, 0.4, 0.05, h.seed + 1);
        }
    }
    if (D.stage >= 4 && cg) droop(cg, hits.length > 0 && hits[hits.length - 1].side === "front");
    if (bg) { bg.computeVertexNormals(); bg.computeBoundingSphere(); }
    if (cg) { cg.computeVertexNormals(); }
    // decals on the dented surface
    if (bg) for (const h of hits) {
        const S = SIDES[h.side], side = h.side === "left" || h.side === "right";
        project(bg, DENTS, h, S, 0.55, 0.42, 0.5);
        project(bg, SCRATCHES, h, S, side ? 1.1 : 0.8, side ? 0.32 : 0.28, 0.5);
        if (!side) { _v.set(h.x, 0.89, h.side === "front" ? 1.62 : -1.62); project(bg, DENTS, _v, SIDES.top, 0.5, 0.42, 0.3); }
    }
    DENTS.commit(); SCRATCHES.commit();
    // the windshield
    if (D.stage >= 2 && D.ws) {
        if (!D.crack) { D.crack = new THREE.Mesh(CRACK_GEO, CRACK_MAT); D.crack.name = "FeelCrack"; D.crack.renderOrder = 3; D.crack.castShadow = false; }
        if (D.crack.parent !== D.ws) D.ws.add(D.crack);
        const right = hits.some(h => h.side === "right") && !hits.some(h => h.side === "left");
        D.crack.position.set(0, 0, 0.022);
        D.crack.scale.set(right ? -1 : 1, 1, 1);
        D.crack.visible = true;
    } else if (D.crack) D.crack.visible = false;
    // the last heart: a hubcap pops, the bumper drags
    if (D.stage >= 4) {
        const side = hits.length ? hits[hits.length - 1].side : "left";
        hideRim(side === "right" ? "Wheel_RR" : "Wheel_RL", !fresh && prevStage < 4);
    } else { showRim(); stopScrape(); despawnHub(); }
}

// ── hubcap off / back on ──────────────────────────────────────────────────
function hideRim(wheelName, pop) {
    if (D.rimHidden.length && D.hubWheel && D.hubWheel.name.startsWith(wheelName)) return;
    showRim();
    const car = ctx.car, w = car.wheels && car.wheels.find(x => x.obj.name.startsWith(wheelName));
    if (!w) return;
    w.obj.traverse(o => { if (o.isMesh && o.material && o.material.name === "Rim") { o.visible = false; D.rimHidden.push(o); } });
    D.hubWheel = w.obj;
    const put = () => {
        if (!models.feel_barehub || D.hubWheel !== w.obj || !D.rimHidden.length) return;
        if (!D.bareHub) { D.bareHub = models.feel_barehub.clone(true); D.bareHub.traverse(o => { if (o.isMesh) o.castShadow = false; }); }
        const left = wheelName.endsWith("L");
        D.bareHub.position.set(left ? 0.135 : -0.135, 0, 0);
        D.bareHub.rotation.set(0, left ? 0 : Math.PI, 0);
        w.obj.add(D.bareHub);
    };
    if (models.feel_barehub) put(); else ensureModels(["feel_barehub"]).then(put).catch(() => {});
    if (pop) popHubcap(w.obj, wheelName.endsWith("L") ? 1 : -1);
}
function showRim() {
    for (const o of D.rimHidden) o.visible = true;
    D.rimHidden.length = 0;
    if (D.bareHub && D.bareHub.parent) D.bareHub.parent.remove(D.bareHub);
    D.hubWheel = null;
}

function popHubcap(wheel, side) {
    const go = () => {
        if (!models.feel_hubcap || !ctx.scene) return;
        let hub = D.hub;
        if (!hub) {
            const obj = models.feel_hubcap.clone(true);
            obj.traverse(o => { if (o.isMesh) o.castShadow = true; });
            obj.rotation.order = "YZX";
            hub = D.hub = { obj, x: 0, z: 0, vx: 0, vz: 0, roll: 0, lean: 0, t: 0, flat: false, active: false };
        }
        const car = ctx.car;
        wheel.getWorldPosition(_w);
        // her LEFT in world space = model +X = (cos h, -sin h)
        const lx = Math.cos(car.h) * side, lz = -Math.sin(car.h) * side;
        hub.x = _w.x + lx * 0.25; hub.z = _w.z + lz * 0.25;
        hub.vx = car.vx * 0.92 + lx * 2.6; hub.vz = car.vz * 0.92 + lz * 2.6;
        hub.roll = 0; hub.lean = 0.05 * side; hub.t = 0; hub.flat = false; hub.active = true;
        if (!hub.obj.parent) ctx.scene.add(hub.obj);
        placeHub(hub);
        D.stats.hubcaps++;
        emit("feel:hubcap", { x: hub.x, z: hub.z });
        A.spatial.play("hubcap", hub.obj, { gain: 0.9 });
        H.toast("🛞 There goes a hubcap!", "", { key: "feel-hubcap" });
    };
    if (models.feel_hubcap) go(); else ensureModels(["feel_hubcap"]).then(go).catch(() => {});
}
function placeHub(hub) {
    const sp = Math.hypot(hub.vx, hub.vz);
    const head = sp > 0.05 ? Math.atan2(hub.vx, hub.vz) : hub.obj.rotation.y;
    const R = 0.21;
    hub.obj.position.set(hub.x, Math.max(0.03, R * Math.cos(hub.lean)) + 0.01, hub.z);
    hub.obj.rotation.set(hub.roll, head, hub.lean);   // order YZX: yaw to the travel direction (axle = model X across it), lean, roll
}
function updateHub(dt) {
    const hub = D.hub;
    if (!hub || !hub.active) return;
    hub.t += dt;
    const sp = Math.hypot(hub.vx, hub.vz);
    if (!hub.flat) {
        const drag = Math.exp(-(sp > 6 ? 0.35 : 0.9) * dt);
        hub.vx *= drag; hub.vz *= drag;
        hub.roll += sp / 0.21 * dt;
        // it wobbles more and more as it slows, then falls flat (spinning down like a coin)
        const wob = Math.min(1.5, 0.08 + Math.max(0, 1 - sp / 10) * 1.6);
        hub.lean += (Math.sign(hub.lean || 1) * wob - hub.lean) * Math.min(1, dt * 1.4) + Math.sin(hub.t * 9) * 0.02;
        if (Math.abs(hub.lean) > 1.45 || sp < 0.4) { hub.flat = true; hub.lean = Math.sign(hub.lean || 1) * Math.PI / 2; hub.vx *= 0.2; hub.vz *= 0.2; }
    } else {
        hub.vx *= Math.exp(-4 * dt); hub.vz *= Math.exp(-4 * dt);
    }
    hub.x += hub.vx * dt; hub.z += hub.vz * dt;
    placeHub(hub);
    const car = ctx.car, dx = hub.x - car.pos.x, dz = hub.z - car.pos.z;
    if (dx * dx + dz * dz > 160 * 160) despawnHub();
}
function despawnHub() {
    if (!D.hub) return;
    D.hub.active = false;
    if (D.hub.obj.parent) D.hub.obj.parent.remove(D.hub.obj);
}
function stopScrape() { if (D.scrape) D.scrape = D.scrape.stop(); }

// ── particles straight into the car's arrays (car.fx.emit allocates) ──────
function fx(x, y, z, vx, vy, vz, size, life, r, g, b) {
    const P = ctx.car.fx, i = P.i++ % P.max, j = i * 3;
    P.p[j] = x; P.p[j + 1] = y; P.p[j + 2] = z;
    P.v[j] = vx; P.v[j + 1] = vy; P.v[j + 2] = vz;
    P.col[j] = r; P.col[j + 1] = g; P.col[j + 2] = b;
    P.size[i] = size; P.grow[i] = size * 1.4; P.life[i] = P.maxLife[i] = life;
}

/** Per frame (driving / walking): smoke, sparks + scrape, the rolling hubcap, model swaps. */
export function tickDamage(dt) {
    const car = ctx.car, G = ctx.G;
    if (!car || !car.model) return;
    if (car.model !== D.model && (D.model || D.k)) { attach(car.model); rebuild(true); }
    // never more wear than hearts lost (ER / jail / a reprieve hand some back)
    if (G && G.hearts > 0 && D.k > (G.maxHearts || 3) - G.hearts) { D.k = Math.max(0, (G.maxHearts || 3) - G.hearts); rebuild(); }
    updateHub(dt);
    const visible = car.obj.visible !== false && car.model.visible !== false && D.k > 0;
    const sp = car.speed;
    // smoke from under the hood
    if (visible && D.stage >= 3) {
        const wrecked = D.k >= ((G && G.maxHearts) || 3);
        const every = wrecked ? 0.035 : D.stage >= 4 ? 0.08 : 0.15;
        D.smokeT -= dt;
        const a = car.anchors && car.anchors.hood;
        if (D.smokeT <= 0 && a) {
            D.smokeT = every;
            const m = a.matrixWorld.elements, rr = Math.random();
            const c = wrecked ? 0.16 : D.stage >= 4 ? 0.38 : 0.62;
            fx(m[12] + (rr - 0.5) * 0.5, m[13] + 0.15, m[14] + (Math.random() - 0.5) * 0.4,
                car.vx * 0.55 + (rr - 0.5) * 0.4, 1.1 + rr * 0.8, car.vz * 0.55, wrecked ? 1.25 : 0.8, wrecked ? 1.9 : 1.3, c, c, c + 0.02);
        }
    }
    // the dragging bumper: sparks + a positional scrape
    const dragging = visible && D.stage >= 4 && D.dragPt && D.dragPt.parent && sp > 3;
    if (dragging) {
        const m = D.dragPt.matrixWorld.elements;
        D.sparkT -= dt;
        while (D.sparkT <= 0) {
            D.sparkT += 0.03 / Math.min(2, sp / 12);
            const rr = Math.random();
            fx(m[12], 0.07, m[14], car.vx * 0.15 + (rr - 0.5) * 2.4, 0.8 + rr * 1.6, car.vz * 0.15 + (Math.random() - 0.5) * 2.4, 0.11, 0.28, 1, 0.62 + rr * 0.3, 0.18);
            D.stats.sparks++;
        }
        if (!D.scrape && A.spatial.ready) D.scrape = A.spatial.loop("scrape", D.dragPt, { gain: 0 });
        if (D.scrape) D.scrape.set({ gain: Math.min(1, sp / 25), rate: 0.85 + Math.min(0.4, sp / 80) });
    } else if (D.scrape) stopScrape();
}

// ── hits, heals, repairs ──────────────────────────────────────────────────
export function ownCar() {
    const car = ctx.car, f = ctx.foot;
    return !!(car && car.model && car.model.visible !== false && !(f && (f.active || f.shellObj)));
}
export function addHit(pt) {
    const max = (ctx.G && ctx.G.maxHearts) || 3;
    if (D.k >= Math.max(max, 1) + 2) return;
    if (D.hits.length > D.k) D.hits.length = D.k;          // forget hits a heal undid
    if (D.hits.length >= MAX_HITS) D.hits.shift();
    D.hits.push({ side: pt.side, x: pt.x, y: pt.y, z: pt.z, seed: (Math.random() * 1e6) | 0 });
    D.k = Math.min(D.k + 1, D.hits.length);
    D.stats.hits++;
    if (D.k === 1) ensureModels(["feel_hubcap", "feel_barehub"]).catch(() => {});
    rebuild();
    emit("feel:wear", { k: D.k, stage: D.stage, side: pt.side });
}
export function undo(n = 1) {
    if (D.k <= 0) return;
    D.k = Math.max(0, D.k - n);
    rebuild();
    emit("feel:wear", { k: D.k, stage: D.stage, side: null });
}
export function repair(why = "") {
    const had = D.k > 0 || (D.hub && D.hub.active);
    D.k = 0; D.hits.length = 0;
    D.smokeT = D.sparkT = 0;
    rebuild();
    despawnHub();
    if (had) { D.stats.repairs++; emit("feel:repair", { why }); }
    return had;
}

// crash → where (the damage event that follows within a moment uses it)
on("crash", e => {
    if (!e || !ctx.car) return;
    let x = e.x, z = e.z;
    if (x == null && e.collider) { x = e.collider.x; z = e.collider.z; }
    if (x == null && e.car) { x = e.car.x; z = e.car.z; }
    if (x == null) return;
    D.lastCrash.x = x; D.lastCrash.z = z; D.lastCrash.t = ctx.time;
});
on("damage", () => {
    if (!ownCar()) return;
    const car = ctx.car;
    let pt;
    if (ctx.time - D.lastCrash.t < 0.3) pt = sideOf(D.lastCrash.x, D.lastCrash.z);
    else {   // no crash point (a missile, a spike, a scripted bump): the front if she's moving, else a side
        const f = car.vF >= 0 ? 1.9 : -1.9;
        pt = sideOf(car.pos.x + Math.sin(car.h) * f, car.pos.z + Math.cos(car.h) * f);
    }
    addHit(pt);
});
on("heart", e => undo((e && e.n) || 1));
on("run:start", () => repair("run"));
on("state", e => { if (e && e.to === "title") repair("title"); });
on("streets:paint", () => { if (repair("paint")) H.toast("🔧 Moishe banged the dents out too!", "pink", { key: "feel-repair" }); });
let erVisit = false;
on("er:admit", () => { erVisit = true; });
on("cameos:resume", () => { if (erVisit) { erVisit = false; repair("er"); } });

/** Debug / tests: force k hits on one side (or "mix"). */
export function wear(k, side = "left") {
    repair("debug");
    const order = ["front", "left", "rear", "right"];
    for (let i = 0; i < k; i++) {
        const s = side === "mix" ? order[i % 4] : side;
        addHit(surfacePoint(s, s === "left" ? 0.9 : s === "right" ? -0.9 : 0.25 * (i % 2 ? 1 : -1), s === "front" ? 1.9 : s === "rear" ? -1.9 : 0.4 - i * 0.5));
    }
    return info();
}
function centre(buf) {
    if (!buf.n) return null;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < buf.n * 9; i += 3) { x += buf.pos[i]; y += buf.pos[i + 1]; z += buf.pos[i + 2]; }
    const k = buf.n * 3;
    return [+(x / k).toFixed(2), +(y / k).toFixed(2), +(z / k).toFixed(2)];
}
export function info() {
    const bg = D.body && D.body.geometry;
    let moved = 0;
    if (bg && D.bodyOrig) {
        const a = bg.attributes.position.array, o = D.bodyOrig.attributes.position.array;
        for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - o[i]) > 1e-4) moved++;
    }
    return {
        k: D.k, stage: D.stage, sides: D.hits.slice(0, D.k).map(h => h.side), hits: D.hits.slice(0, D.k).map(h => ({ side: h.side, x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2) })),
        dentTris: DENTS.n, scratchTris: SCRATCHES.n, dentCenter: centre(DENTS), movedVerts: moved / 3 | 0, ownGeo: !!D.bodyOrig,
        crack: !!(D.crack && D.crack.visible && D.crack.parent), rimHidden: D.rimHidden.length, bareHub: !!(D.bareHub && D.bareHub.parent),
        hub: D.hub ? { active: D.hub.active, flat: D.hub.flat, x: +D.hub.x.toFixed(1), z: +D.hub.z.toFixed(1), inScene: !!D.hub.obj.parent } : null,
        scrape: !!(D.scrape && D.scrape.alive), bumperDroop: D.stage >= 4, onModel: D.model === (ctx.car && ctx.car.model),
        stats: Object.assign({}, D.stats),
    };
}
