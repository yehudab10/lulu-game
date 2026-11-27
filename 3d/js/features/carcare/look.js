// features/carcare/look.js — how a car's condition SHOWS: dirt (the body paint toward road grime, a duller finish), a fresh
// wash's shine (a glossier finish; the twinkles are index.js'), and dents (small decals on the body: 2 a level, ≤ 6).
// Works on any clone of the "lulu" car model — ctx.car's, her parked car on foot (foot's stub), her other parked cars
// (features/cars' props). Each object is re-dressed only when its look changes (a signature), never per frame.
import * as THREE from "three";
import { models } from "../../models.js";

const BODY = new Set(["Body", "BodyLight", "BodyDark"]);
const MUD = new THREE.Color("#6d5c48");
const _c = new THREE.Color();

// ── dirt + shine on the paint ──
function bodyMats(obj) {
    const out = [];
    obj.traverse(o => {
        if (!o.isMesh || !o.material || !BODY.has(o.material.name)) return;
        // (the model cache shares a material between clones of one colour: ours only)
        if (o.material.userData.careFor !== o.uuid) { o.material = o.material.clone(); o.material.userData = { careFor: o.uuid }; }
        out.push(o.material);
    });
    return out;
}
/** Tint obj's paint: dirt 0..1, shine 0..1. */
export function paintLook(obj, dirt, shine, mats = null) {
    for (const m of mats || bodyMats(obj)) {
        const u = m.userData;
        // (somebody repainted it since — a new skin on the stub: take the new colour as the clean one)
        if (u.base == null || m.color.getHex() !== u.tint) { u.base = m.color.getHex(); u.rough = m.roughness; u.metal = m.metalness; }
        _c.setHex(u.base).lerp(MUD, Math.min(1, dirt) * 0.5);
        m.color.copy(_c);
        u.tint = m.color.getHex();
        if (u.rough != null) m.roughness = THREE.MathUtils.clamp(u.rough + dirt * 0.35 - shine * 0.35, 0.05, 1);
        if (u.metal != null) m.metalness = THREE.MathUtils.clamp(u.metal + shine * 0.25, 0, 1);
    }
}
/** Ima's minivan (a traffic model: its one "Paint"): always a bit dirty. Once per object. */
export function grime(obj, dirt) {
    if (!obj || obj.userData.careGrime) return;
    obj.userData.careGrime = true;
    obj.traverse(o => {
        if (!o.isMesh || !o.material || o.material.name !== "Paint") return;
        o.material = o.material.clone();
        o.material.color.lerp(MUD, dirt * 0.5);
        o.material.roughness = Math.min(1, (o.material.roughness || 0.5) + dirt * 0.3);
    });
}

// ── dents ──
let SPOTS = null, TEX = null, GEO = null, MAT = null;
/** Where the dents go on the car model: a ray from outside onto the body at 6 places (left front, right rear, right front,
 *  left rear, the front bumper, the back bumper) → [{ p, n }] in the model's own frame. Once. */
function spots() {
    if (SPOTS) return SPOTS;
    const tpl = models.lulu;
    if (!tpl) return null;
    tpl.updateMatrixWorld(true);
    const inv = tpl.matrixWorld.clone().invert();
    const meshes = [];
    tpl.traverse(o => { if (o.isMesh && o.material && BODY.has(o.material.name)) meshes.push(o); });
    const rc = new THREE.Raycaster();
    const want = [[-1, 0.55, 1.15], [1, 0.6, -1.05], [1, 0.55, 1.25], [-1, 0.6, -1.2], [0, 0.5, 9], [0, 0.55, -9]];
    const out = [];
    const nm = new THREE.Matrix3();
    for (const [sx, y, z] of want) {
        const front = Math.abs(z) > 5;
        const o = front ? new THREE.Vector3(0.35 * (out.length % 2 ? -1 : 1), y, Math.sign(z) * 4) : new THREE.Vector3(sx * 3, y, z);
        const d = front ? new THREE.Vector3(0, 0, -Math.sign(z)) : new THREE.Vector3(-sx, 0, 0);
        rc.set(o.applyMatrix4(tpl.matrixWorld), d.transformDirection(tpl.matrixWorld));
        const hit = rc.intersectObjects(meshes, false)[0];
        if (!hit || !hit.face) continue;
        const p = hit.point.clone().applyMatrix4(inv);
        nm.getNormalMatrix(hit.object.matrixWorld);
        const n = hit.face.normal.clone().applyMatrix3(nm).normalize().transformDirection(inv);
        out.push({ p, n });
    }
    SPOTS = out;
    return SPOTS;
}
function dentTex() {
    if (TEX) return TEX;
    const cv = document.createElement("canvas"); cv.width = cv.height = 128;
    const g = cv.getContext("2d");
    // a shallow crumple: a dark dish, a light crescent where the light catches the rim, two scratches
    const r = g.createRadialGradient(60, 66, 6, 64, 64, 58);
    r.addColorStop(0, "rgba(20,16,14,0.55)"); r.addColorStop(0.55, "rgba(40,34,30,0.35)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.beginPath(); g.ellipse(64, 64, 60, 44, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 5; g.beginPath(); g.ellipse(66, 62, 40, 28, 0, Math.PI * 1.1, Math.PI * 1.75); g.stroke();
    g.strokeStyle = "rgba(230,230,230,0.7)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(26, 50); g.lineTo(84, 74); g.stroke();
    g.beginPath(); g.moveTo(40, 84); g.lineTo(96, 58); g.stroke();
    TEX = new THREE.CanvasTexture(cv); TEX.colorSpace = THREE.SRGBColorSpace;
    return TEX;
}
/** Show `n` dents (0..6) on obj (a lulu-model clone). */
export function dentLook(obj, n) {
    let g = obj.userData.careDents;
    if (!n && !g) return;
    const S = spots();
    if (!S) return;
    if (!g) {
        GEO = GEO || new THREE.PlaneGeometry(0.46, 0.34);
        MAT = MAT || new THREE.MeshStandardMaterial({ map: dentTex(), transparent: true, depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4 });
        g = new THREE.Group(); g.name = "carcareDents";
        for (let i = 0; i < S.length; i++) {
            const { p, n: nn } = S[i];
            const m = new THREE.Mesh(GEO, MAT);
            m.position.copy(p).addScaledVector(nn, 0.012);
            m.lookAt(m.position.clone().add(nn));
            m.rotation.z += (i * 1.7) % 3;
            m.renderOrder = 2; m.castShadow = false; m.receiveShadow = false;
            g.add(m);
        }
        obj.add(g);
        obj.userData.careDents = g;
    }
    g.children.forEach((m, i) => { m.visible = i < n; });
    g.visible = n > 0;
}
/** A point on obj's body (world) — for a twinkle: one of the dent spots, or the roof. */
export function bodyPoint(obj, out) {
    const S = spots();
    const s = S && S.length ? S[Math.floor(Math.random() * S.length)] : null;
    out.set(s ? s.p.x : 0, s ? s.p.y + Math.random() * 0.5 : 1.2, s ? s.p.z : 0);
    return obj.localToWorld(out);
}
export const lookDebug = { spots: () => spots(), bodyMats };
