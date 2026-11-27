// features/clothes/wear.js — WHAT SHE'S WEARING, on her own model. Cheap on a phone:
//   • top / skirt / tights / shoes RECOLOUR the materials her model already has (no extra draw call);
//   • a coat recolours her sleeves (the Top material) and adds its own shape; one accessory adds one;
//     each is ONE merged, vertex-coloured mesh per limb it sits on (≤ 2 extra draws, and only on her + friends).
// people.js calls dress() for every Lulu it spawns (setDresser): her outfit by default, a friend's by passing theirs.
// A save without clothes = BASE (today's Lulu exactly).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, emit, on } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { setDresser } from "../../core/people.js";
import { SLOTS, BASE, pieceById, OWN } from "./data.js";

/** Save: owned piece ids, what she wears per slot, saved outfits, totals. */
export const S = store("clothes", { owned: [], wear: {}, saved: [], spent: 0, bought: 0, changes: 0 });
if (!Array.isArray(S.owned)) S.owned = [];
if (!S.wear || typeof S.wear !== "object") S.wear = {};
if (!Array.isArray(S.saved)) S.saved = [];

const SLOT_IDS = SLOTS.map(s => s.id);
/** A clean outfit: { slot: pieceId } — only known pieces in their own slot. */
export function clean(o) {
    const out = {};
    if (!o || typeof o !== "object") return out;
    for (const k of SLOT_IDS) { const p = pieceById(o[k]); if (p && p.slot === k) out[k] = p.id; }
    return out;
}
/** What she has on now (a copy). */
export const current = () => clean(S.wear);
export const owns = id => OWN.includes(id) || S.owned.includes(id);

// ── the compact form other players get (party / EVERYONE state: d.x.ot) — a few short ids, "" = nothing ──
export const encode = o => { const c = clean(o); return SLOT_IDS.map(k => c[k] || "").join(","); };
export function decode(s) {
    if (typeof s !== "string" || s.length > 160) return {};
    const parts = s.split(","), o = {};
    SLOT_IDS.forEach((k, i) => { if (parts[i]) o[k] = parts[i].slice(0, 24); });
    return clean(o);
}

// ── materials (recolours) ─────────────────────────────────────────────────
const MAT_SLOT = { Top: "top", Bottom: "skirt", Tights: "tights", Shoes: "shoes" };
const matCache = new Map();
function tinted(base, hex) {
    const key = base.uuid + hex;
    let m = matCache.get(key);
    if (!m) { m = base.clone(); m.color.set(hex); matCache.set(key, m); }
    return m;
}
/** The colour each recoloured material gets (null = the model's own). */
function colorsOf(o) {
    const c = { top: null, skirt: null, tights: null, shoes: null };
    for (const k of ["top", "skirt", "tights", "shoes"]) { const p = pieceById(o[k]); if (p) c[k] = p.color; }
    const coat = pieceById(o.outer);
    c.shirt = c.top || BASE.top;
    // (a long coat / the robe covers the skirt to the hem: the skirt takes its colour, so nothing peeks through)
    if (coat) { c.top = coat.color; if (coat.shape === "robe" || coat.shape === "coat") c.skirt = coat.color; }
    return c;
}

// ── the shapes (Body-local metres: y up, she faces +z; arms: pivot at the shoulder, the hand 0.44 m down) ──
const accMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
accMat.name = "Outfit";
const _c = new THREE.Color();
function part(geo, hex, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    const g = geo;
    g.deleteAttribute("uv");
    g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z);
    _c.set(hex);
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
}
const shade = (hex, k) => "#" + _c.set(hex).multiplyScalar(k).getHexString();
const lift = (hex, k) => "#" + _c.set(hex).lerp(new THREE.Color("#FFFFFF"), k).getHexString();
const sph = (r, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (a, b, h, s = 16, open = false) => new THREE.CylinderGeometry(a, b, h, s, 1, open);
const tor = (r, t, arc = Math.PI * 2, rs = 6, ts = 18) => new THREE.TorusGeometry(r, t, rs, ts, arc);
// a long coat's outline (radius, height): close at the waist so her hands hang outside it, flared over the skirt's hem
const COAT = [[0.17, 1.33], [0.205, 1.12], [0.212, 0.96], [0.235, 0.78], [0.272, 0.6], [0.318, 0.41], [0.3, 0.4]];
const ROBE = [[0.17, 1.33], [0.205, 1.12], [0.212, 0.96], [0.24, 0.72], [0.285, 0.4], [0.31, 0.08], [0.29, 0.07]];
const lathe = pts => new THREE.LatheGeometry(pts.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), 18);   // (bottom → top: faces outward)

/** Parts on her BODY for a coat shape (shirt = the colour of the top under it). */
function coatParts(p, shirt) {
    const c = p.color, out = [];
    if (p.shape === "coat") {
        out.push(part(lathe(COAT), c));
        out.push(part(sph(1, 10, 8), shirt, { y: 1.22, z: 0.0, sx: 0.045, sy: 0.11, sz: 0.2 }));      // (the shirt showing at the neck)
        out.push(part(tor(0.095, 0.034), shade(c, 0.85), { y: 1.335, rx: Math.PI / 2 }));             // collar
        for (const y of [1.08, 0.93, 0.78]) out.push(part(sph(0.016, 8, 6), shade(c, 0.55), { y, z: 0.205 + (1.08 - y) * 0.15 }));
    } else if (p.shape === "puffer") {
        out.push(part(sph(1, 16, 12), c, { y: 1.09, sx: 0.252, sy: 0.27, sz: 0.205 }));
        for (const [y, r] of [[1.25, 0.2], [1.12, 0.245], [0.98, 0.238], [0.86, 0.19]]) out.push(part(tor(r, 0.018, Math.PI * 2, 5, 20), shade(c, 0.86), { y, rx: Math.PI / 2, sz: 0.8 }));
        out.push(part(tor(0.09, 0.045), c, { y: 1.34, rx: Math.PI / 2 }));                         // the big collar
    } else if (p.shape === "cardigan") {
        out.push(part(sph(1, 10, 8), shirt, { y: 1.13, sx: 0.042, sy: 0.215, sz: 0.153 }));        // (the blouse down the front)
        for (const y of [1.25, 1.15, 1.05, 0.95]) out.push(part(sph(0.012, 6, 5), "#F5F1E6", { x: 0.05, y, z: 0.152 - Math.abs(y - 1.14) * 0.12 }));
    } else if (p.shape === "robe") {
        out.push(part(lathe(ROBE), c));
        out.push(part(tor(0.092, 0.03), lift(c, 0.25), { y: 1.335, rx: Math.PI / 2 }));
        out.push(part(box(0.018, 1.0, 0.012), "#E8C766", { y: 0.82, z: 0.235, rx: -0.115 }));         // the zipper
    }
    return out;
}
/** Parts of an accessory, by where they sit: { body: [...], armR: [...], armL: [...] }. */
function accParts(p) {
    const c = p.color, out = { body: [], armR: [], armL: [] };
    if (p.shape === "shades") {
        for (const s of [-1, 1]) out.body.push(part(sph(1, 12, 8), c, { x: s * 0.074, y: 1.565, z: 0.188, sx: 0.07, sy: 0.054, sz: 0.022 }));
        out.body.push(part(box(0.05, 0.012, 0.012), shade(c, 0.7), { y: 1.578, z: 0.205 }));
    } else if (p.shape === "headband") {
        out.body.push(part(tor(0.218, 0.026, Math.PI, 6, 16), c, { y: 1.555, z: 0.0, rx: -0.42 }));
    } else if (p.shape === "scarf") {
        out.body.push(part(tor(0.098, 0.046), c, { y: 1.34, rx: Math.PI / 2 }));
        out.body.push(part(box(0.075, 0.24, 0.03), shade(c, 0.9), { x: 0.06, y: 1.2, z: 0.165, rx: -0.2 }));
    } else if (p.shape === "pearls") {
        for (let k = 0; k < 16; k++) {
            const a = (k / 16) * Math.PI * 2;
            out.body.push(part(sph(0.017, 8, 6), c, { x: Math.sin(a) * 0.112, y: 1.31 - Math.max(0, Math.cos(a)) * 0.05, z: Math.cos(a) * 0.1 + 0.012 }));
        }
    } else if (p.shape === "bag") {
        out.body.push(part(box(0.17, 0.12, 0.065), c, { x: -0.285, y: 0.93, z: -0.03 }));
        out.body.push(part(box(0.012, 0.012, 0.07), "#C9A227", { x: -0.285, y: 0.94, z: 0.004 }));
        out.body.push(part(box(0.018, 0.62, 0.012), shade(c, 0.75), { x: -0.03, y: 1.2, z: 0.158, rz: -0.62 }));   // the strap across
    } else if (p.shape === "bigbag") {
        out.armL.push(part(box(0.1, 0.2, 0.25), c, { x: 0.07, y: -0.6, z: 0.02 }));
        out.armL.push(part(tor(0.06, 0.012, Math.PI, 5, 10), shade(c, 0.7), { x: 0.07, y: -0.5, z: 0.02, ry: Math.PI / 2 }));
        out.armL.push(part(box(0.02, 0.03, 0.06), "#C9A227", { x: 0.123, y: -0.56, z: 0.02 }));
    } else if (p.shape === "coffee") {
        out.armR.push(part(cyl(0.042, 0.034, 0.15, 12), c, { x: -0.05, y: -0.47, z: 0.08 }));
        out.armR.push(part(cyl(0.046, 0.046, 0.018, 12), "#F5F5F5", { x: -0.05, y: -0.388, z: 0.08 }));
        out.armR.push(part(cyl(0.006, 0.006, 0.12, 5), "#43A047", { x: -0.05, y: -0.33, z: 0.08, rx: 0.15 }));
    }
    return out;
}

const geoCache = new Map();      // "slot shapes + colours" → merged geometry (shared by every Lulu wearing it)
function merged(key, build) {
    if (geoCache.has(key)) return geoCache.get(key);
    const parts = build();
    const allIdx = parts.every(p => !!p.index);
    const flat = allIdx ? parts : parts.map(p => (p.index ? p.toNonIndexed() : p));
    const g = flat.length ? mergeGeometries(flat, false) : null;
    if (!allIdx) for (const p of flat) if (!parts.includes(p)) p.dispose();
    for (const p of parts) p.dispose();
    if (g) g.computeBoundingSphere();
    geoCache.set(key, g);
    return g;
}

/** The limbs of a person root (by name). */
function limbsOf(obj) {
    const L = {};
    obj.traverse(o => { if (o.name === "Body" || o.name === "Arm_L" || o.name === "Arm_R") L[o.name] = L[o.name] || o; });
    return L;
}

/**
 * Dress a Lulu model (a person root, as spawned): recolour + the shapes. outfit = { slot: id } (default: hers).
 * Safe to call again on the same model (a change) — the old shapes go, the materials go back to the model's own first.
 */
export function dress(obj, outfit) {
    if (!obj) return obj;
    const o = clean(outfit === undefined ? S.wear : outfit);
    const col = colorsOf(o);
    obj.traverse(m => {
        if (!m.isMesh || m.userData.outfit) return;
        const base = m.userData.clBase || m.material;
        const slot = base && MAT_SLOT[base.name];
        if (!slot) return;
        m.userData.clBase = base;
        const hex = col[slot];
        m.material = hex ? tinted(base, hex) : base;
    });
    // the shapes: one merged mesh per limb
    const old = [];
    obj.traverse(m => { if (m.userData.outfit) old.push(m); });
    for (const m of old) m.removeFromParent();
    const coat = pieceById(o.outer), acc = pieceById(o.acc);
    if (coat || acc) {
        const L = limbsOf(obj);
        const a = acc ? accParts(acc) : null;
        const add = (node, key, build) => {
            if (!node) return;
            const g = merged(key, build);
            if (!g) return;
            const mesh = new THREE.Mesh(g, accMat);
            mesh.name = "Outfit_" + node.name;
            mesh.userData.outfit = true;
            mesh.castShadow = false;
            node.add(mesh);
        };
        const bodyKey = `b|${coat ? coat.id : ""}|${acc ? acc.id : ""}|${col.shirt}`;
        add(L.Body, bodyKey, () => [...(coat ? coatParts(coat, col.shirt) : []), ...(a ? a.body : [])]);
        if (a && a.armR.length) add(L.Arm_R, "r|" + acc.id, () => accParts(acc).armR);
        if (a && a.armL.length) add(L.Arm_L, "l|" + acc.id, () => accParts(acc).armL);
    }
    obj.userData.outfitKey = encode(o);
    return obj;
}

// ── her Lulus: every one people.js spawns for HER is dressed + remembered (a change re-dresses them in place) ──
const mine = new Set();
setDresser((obj, outfit) => {
    dress(obj, outfit);
    if (outfit === undefined) mine.add(obj);
});
function redressMine() {
    for (const obj of mine) {
        if (!obj.parent) { mine.delete(obj); continue; }
        dress(obj);
    }
    if (ctx.foot && ctx.foot.obj && !mine.has(ctx.foot.obj) && ctx.foot.lookCode === 0) dress(ctx.foot.obj);
    dressCar();
}

// ── in the car: her shirt (only her top half shows) ──
function dressCar() {
    const car = ctx.car, d = car && car.driver;
    if (!d) return;
    const col = colorsOf(clean(S.wear));
    d.traverse(m => {
        if (!m.isMesh) return;
        const base = m.userData.clBase || m.material;
        if (!base || base.name !== "Shirt") return;
        m.userData.clBase = base;
        m.material = col.top ? tinted(base, col.top) : base;
    });
}
on("boot", () => dressCar());
on("title", () => setTimeout(dressCar, 0));
setInterval(() => { try { dressCar(); } catch (e) { /* no car yet */ } }, 2000);     // (a car rebuilt by anyone: her shirt within 2 s)
on("skin", () => setTimeout(dressCar, 0));
on("run:start", () => dressCar());

/**
 * Put on an outfit (the closet / the fitting room) — the only ways she changes. Saves it, re-dresses every Lulu of hers
 * on screen and the car's driver. Pieces she doesn't own are dropped. → the outfit worn
 */
export function wear(outfit, why = "closet") {
    const o = clean(outfit);
    for (const k of Object.keys(o)) if (!owns(o[k])) delete o[k];
    S.wear = o;
    S.changes = (S.changes | 0) + 1;
    saveSoon();
    redressMine();
    emit("clothes:changed", { outfit: Object.assign({}, o), why });
    return o;
}
/** She owns it now (buying: features/garage/buy.js calls this through its `give`). */
export function addOwned(id) {
    if (!pieceById(id) || owns(id)) return false;
    S.owned.push(id);
    saveSoon();
    return true;
}

/** Tests / the shop: the colours an outfit gives (for checks), the geometry cache size. */
export const wearDebug = { colorsOf, clean, mine, geoCache, redressMine, dressCar };
