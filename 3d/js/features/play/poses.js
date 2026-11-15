// features/play — 📸 Lulu's photo poses. Purely additive and fully undone on
// exit: in the car, the arm(s) she lifts are hidden from her baked "Driver"
// mesh (a filtered copy of its index buffer — the arm pieces are found by
// where they sit, so the shared model is untouched) and replaced by posable
// arms built from her own Shirt/Skin materials; heart sunglasses ride on her
// face. On foot she just uses the people.js gestures (wave, cheer, dance…).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";

export const CAR_POSES = [
    { id: "drive", name: "Driving", emoji: "🚗" },
    { id: "wave", name: "Wave", emoji: "👋" },
    { id: "peace", name: "Peace sign", emoji: "✌️" },
    { id: "shades", name: "Too cool", emoji: "😎" },
    { id: "hands", name: "Hands up!", emoji: "🙌" },
];
export const FOOT_POSES = [
    { id: "stand", name: "Standing", emoji: "🧍‍♀️", flags: {} },
    { id: "wave", name: "Wave", emoji: "👋", flags: { wave: true } },
    { id: "cheer", name: "Cheer", emoji: "🙌", flags: { cheer: true } },
    { id: "dance", name: "Dance", emoji: "💃", flags: { dance: true } },
    { id: "point", name: "Point", emoji: "👉", flags: { point: true } },
];

// Lulu's rig in car-model space (three.js: +X = her left / the car's left, +Z = forward).
// From assets_core.py build_lulu_car(): shoulders at Blender (lx ± 0.19, 0.42, 1.24).
const SHOULDER = { L: new THREE.Vector3(0.57, 1.235, -0.42), R: new THREE.Vector3(0.19, 1.235, -0.42) };
const HAND = { L: new THREE.Vector3(0.51, 1.05, 0.18), R: new THREE.Vector3(0.25, 1.05, 0.18) };
const FACE = new THREE.Vector3(0.38, 1.6, -0.122);

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const BALL = new THREE.SphereGeometry(1, 12, 9);

let P = null;    // the live pose: { kind, car, model, group, swaps, arms, shades, id, t }

// ── hiding the baked arms ─────────────────────────────────────────────────
const armlessCache = new Map();     // geometry.uuid|mask → filtered geometry
function segDist(p, a, b) {
    _d.subVectors(b, a);
    const t = Math.max(0, Math.min(1, _c.subVectors(p, a).dot(_d) / _d.lengthSq()));
    return { d: _c.copy(a).addScaledVector(_d, t).distanceTo(p), t };
}
/** A copy of `geo` without the connected pieces that make up the masked arm(s). */
function armless(mesh, model, mask) {
    const geo = mesh.geometry;
    const key = geo.uuid + "|" + mask;
    if (armlessCache.has(key)) return armlessCache.get(key);
    const pos = geo.attributes.position, n = pos.count;
    const idx = geo.index ? geo.index.array : null, tris = idx ? idx.length : n;
    const I = t => idx ? idx[t] : t;
    // union-find over vertices that share a triangle → connected pieces
    const parent = new Int32Array(n);
    for (let i = 0; i < n; i++) parent[i] = i;
    const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let t = 0; t < tris; t += 3) {
        const a = find(I(t)), b = find(I(t + 1)), c = find(I(t + 2));
        if (a !== b) parent[a] = b;
        const b2 = find(b);
        if (find(c) !== b2) parent[find(c)] = b2;
    }
    // each piece's centre, in car-model space
    model.updateMatrixWorld(true);
    _m.copy(model.matrixWorld).invert().multiply(mesh.matrixWorld);
    const sum = new Map();
    for (let i = 0; i < n; i++) {
        const r = find(i);
        let s = sum.get(r);
        if (!s) { s = [0, 0, 0, 0]; sum.set(r, s); }
        _a.fromBufferAttribute(pos, i).applyMatrix4(_m);
        s[0] += _a.x; s[1] += _a.y; s[2] += _a.z; s[3]++;
    }
    const drop = new Set();
    for (const [r, s] of sum) {
        _b.set(s[0] / s[3], s[1] / s[3], s[2] / s[3]);
        for (const side of mask) {
            const sd = segDist(_b, SHOULDER[side], HAND[side]);
            if (sd.d < 0.085 || _b.distanceTo(HAND[side]) < 0.08) { drop.add(r); break; }
        }
    }
    let out = geo;
    if (drop.size) {
        const keep = [];
        for (let t = 0; t < tris; t += 3) if (!drop.has(find(I(t)))) keep.push(I(t), I(t + 1), I(t + 2));
        out = new THREE.BufferGeometry();
        for (const name of Object.keys(geo.attributes)) out.setAttribute(name, geo.attributes[name]);
        out.setIndex(keep);
        out.boundingSphere = geo.boundingSphere ? geo.boundingSphere.clone() : null;
        out.boundingBox = geo.boundingBox ? geo.boundingBox.clone() : null;
    }
    armlessCache.set(key, out);
    return out;
}

// ── posable arms ──────────────────────────────────────────────────────────
function setLimb(m, a, b, r) {
    _d.subVectors(b, a);
    const len = Math.max(0.001, _d.length());
    m.position.copy(a).addScaledVector(_d, 0.5);
    m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / len));
    m.scale.set(r, len, r);
}
function makeArm(group, shirt, skin) {
    const mk = (geo, mat) => { const o = new THREE.Mesh(geo, mat); o.castShadow = true; group.add(o); return o; };
    return {
        upper: mk(CYL, shirt), lower: mk(CYL, shirt), elbow: mk(BALL, shirt), shoulder: mk(BALL, shirt), hand: mk(BALL, skin),
        fingers: [mk(CYL, skin), mk(CYL, skin)], tips: [mk(BALL, skin), mk(BALL, skin)],
        S: new THREE.Vector3(), E: new THREE.Vector3(), H: new THREE.Vector3(),
    };
}
function poseArm(arm, S, E, H, { open = false, peace = false } = {}) {
    setLimb(arm.upper, S, E, 0.046);
    setLimb(arm.lower, E, H, 0.042);
    arm.shoulder.position.copy(S); arm.shoulder.scale.setScalar(0.05);
    arm.elbow.position.copy(E); arm.elbow.scale.setScalar(0.046);
    arm.hand.position.copy(H);
    if (open) arm.hand.scale.set(0.058, 0.066, 0.034);      // flat open palm, facing forward
    else arm.hand.scale.setScalar(0.055);
    for (let i = 0; i < 2; i++) {
        arm.fingers[i].visible = arm.tips[i].visible = peace;
        if (!peace) continue;
        _d.subVectors(H, E).normalize();
        _a.copy(H).addScaledVector(_d, 0.03);
        _b.copy(_d).applyAxisAngle(_c.set(0, 0, 1), i ? 0.32 : -0.32);
        _b.multiplyScalar(0.1).add(_a);
        setLimb(arm.fingers[i], _a, _b, 0.017);
        arm.tips[i].position.copy(_b); arm.tips[i].scale.setScalar(0.018);
    }
}

// heart-shaped pink sunglasses
let shadesTpl = null;
function heartShape(s) {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.5 * s);
    sh.bezierCurveTo(-0.15 * s, -0.32 * s, -0.56 * s, -0.06 * s, -0.5 * s, 0.2 * s);
    sh.bezierCurveTo(-0.45 * s, 0.5 * s, -0.08 * s, 0.56 * s, 0, 0.26 * s);
    sh.bezierCurveTo(0.08 * s, 0.56 * s, 0.45 * s, 0.5 * s, 0.5 * s, 0.2 * s);
    sh.bezierCurveTo(0.56 * s, -0.06 * s, 0.15 * s, -0.32 * s, 0, -0.5 * s);
    return sh;
}
function makeShades() {
    if (shadesTpl) return shadesTpl.clone();
    const g = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: "#FF4FA3", roughness: 0.35, metalness: 0.2 });
    const lensMat = new THREE.MeshStandardMaterial({ color: "#2a0f2e", roughness: 0.08, metalness: 0.6, emissive: "#3a0030", emissiveIntensity: 0.25 });
    const frameGeo = new THREE.ExtrudeGeometry(heartShape(0.118), { depth: 0.014, bevelEnabled: false, curveSegments: 10 });
    const lensGeo = new THREE.ShapeGeometry(heartShape(0.096), 10);
    for (const x of [-0.088, 0.088]) {
        const f = new THREE.Mesh(frameGeo, frameMat); f.position.set(x, 0, -0.012); g.add(f);
        const l = new THREE.Mesh(lensGeo, lensMat); l.position.set(x, 0.002, 0.0035); g.add(l);
    }
    const bridge = new THREE.Mesh(CYL, frameMat);
    bridge.scale.set(0.008, 0.06, 0.008); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.022, -0.004); g.add(bridge);
    for (const s of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.24), frameMat);
        t.position.set(s * 0.2, 0.015, -0.125); t.rotation.y = s * -0.12; g.add(t);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
    shadesTpl = g;
    return g.clone();
}

// ── public API ────────────────────────────────────────────────────────────
/** What can pose right now? "car" (Lulu at the wheel), "foot" (walking), or null. */
export function poseTarget(state = ctx.state) {
    if (ctx.foot && ctx.foot.person && ctx.foot.obj && ctx.foot.obj.visible !== false && /^foot/.test(state)) return "foot";
    const car = ctx.car;
    if (!ctx.view && car && car.driver && car.driver.visible && car.model && car.model.visible !== false) return "car";
    return null;
}
export function posesFor(kind) { return kind === "car" ? CAR_POSES : kind === "foot" ? FOOT_POSES : []; }

/** Freeze-frame pose (call clearPose() to undo everything). */
export function setPose(kind, id) {
    clearPose();
    if (!kind) return;
    if (kind === "foot") { P = { kind, id, t: 0, flags: (FOOT_POSES.find(p => p.id === id) || FOOT_POSES[0]).flags }; return; }
    const car = ctx.car, model = car.model;
    P = { kind, id, t: 0, car, model, group: null, swaps: [], arms: {}, shades: null };
    if (id === "drive") return;
    const mask = id === "hands" ? ["L", "R"] : ["L"];
    let shirt = null, skin = null;
    car.driver.traverse(o => {
        if (!o.isMesh) return;
        const n = o.material && o.material.name;
        if (/^Shirt/.test(n)) shirt = o.material;
        if (n === "Skin") skin = o.material;
        const g2 = armless(o, model, mask);
        if (g2 !== o.geometry) { P.swaps.push({ mesh: o, geo: o.geometry }); o.geometry = g2; }
    });
    shirt = shirt || new THREE.MeshStandardMaterial({ color: "#4FC3F7", roughness: 0.75 });
    skin = skin || new THREE.MeshStandardMaterial({ color: "#FFD2B0", roughness: 0.7 });
    P.group = new THREE.Group();
    P.group.name = "playPose";
    model.add(P.group);
    for (const side of mask) P.arms[side] = makeArm(P.group, shirt, skin);
    if (id === "shades") {
        P.shades = makeShades();
        P.shades.position.copy(FACE);
        P.group.add(P.shades);
    }
    updatePose(0);
}

const V = (x, y, z) => _a.set(x, y, z);
export function updatePose(dt) {
    if (!P) return;
    P.t += dt;
    const t = P.t;
    if (P.kind === "foot") { if (ctx.foot && ctx.foot.person) ctx.foot.person.update(dt, P.flags); return; }
    const L = P.arms.L, R = P.arms.R;
    if (P.id === "wave" && L) {
        L.E.set(0.76, 1.37, -0.38);
        L.H.copy(L.E).add(V(0.05 + Math.sin(t * 9) * 0.11, 0.22, 0.03));
        poseArm(L, SHOULDER.L, L.E, L.H, { open: true });
    } else if (P.id === "peace" && L) {
        L.E.set(0.73, 1.36, -0.3);
        L.H.set(0.71 + Math.sin(t * 2.2) * 0.008, 1.58, -0.2);
        poseArm(L, SHOULDER.L, L.E, L.H, { peace: true });
    } else if (P.id === "shades" && L) {
        L.E.set(0.86, 1.0, -0.36);                   // elbow out on the door, hand dangling
        L.H.set(0.9, 0.99, -0.07);
        poseArm(L, SHOULDER.L, L.E, L.H);
    } else if (P.id === "hands") {
        const w = Math.sin(t * 6) * 0.025;
        if (L) { L.E.set(0.75, 1.42, -0.42); L.H.set(0.81 + w, 1.67, -0.38); poseArm(L, SHOULDER.L, L.E, L.H, { open: true }); }
        if (R) { R.E.set(0.01, 1.42, -0.42); R.H.set(-0.05 - w, 1.67, -0.38); poseArm(R, SHOULDER.R, R.E, R.H, { open: true }); }
    }
}

export function clearPose() {
    if (!P) return;
    if (P.kind === "car") {
        for (const s of P.swaps) s.mesh.geometry = s.geo;
        if (P.group && P.group.parent) P.group.parent.remove(P.group);
    }
    P = null;
}
export function currentPose() { return P ? P.id : null; }
/** Tests: which driver meshes had arm pieces hidden, and how many indices went. */
export function poseDebug() {
    if (!P) return null;
    return { id: P.id, kind: P.kind, arms: Object.keys(P.arms || {}), swaps: (P.swaps || []).map(s => ({ mat: s.mesh.material.name,
        removed: (s.geo.index ? s.geo.index.count : s.geo.attributes.position.count) - s.mesh.geometry.index.count })) };
}
