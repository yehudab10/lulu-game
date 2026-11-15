// features/banter — Lulu comes alive in the driver's seat.
//
// The car's "Driver" is ONE baked mesh (torso, head, arms, hands, face), so at
// runtime we carve it into four pieces by connected component — torso, head,
// left arm, right arm — and hang them on pivots (hips, neck, shoulders) inside
// the same Driver node. Nothing in the asset or in car.js changes: showDriver()
// still hides her, skins/recolours keep working (same materials), and when the
// car model is rebuilt (new skin) we simply rig the new one. Her hair, shades
// and anything on the head anchor (hats) follow the head's motion.
//
// Everything is springs: she bops to the music, leans into turns, her hands
// ride the steering wheel, she flinches at near misses, throws a hand up when
// she honks, fist-pumps combos, waves at the cops she passes legally and looks
// over her shoulder in a chase. If the model ever stops matching (a different
// Driver), she falls back to animating the whole Driver as one piece.
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { CAMS } from "../../core/camera.js";
import { save3d } from "../../core/save.js";
import { Spring, seeded, clamp } from "./util.js";

// Lulu's joints in car-model space (Blender assets_core.py build_lulu_car → glTF y-up, front +Z)
const LX = 0.38;
const HIP = new THREE.Vector3(LX, 0.92, -0.44);
const NECK = new THREE.Vector3(LX, 1.38, -0.40);
const SH_L = new THREE.Vector3(LX + 0.19, 1.24, -0.42);     // her LEFT = the car's +X side (outside)
const SH_R = new THREE.Vector3(LX - 0.19, 1.24, -0.42);
const HAND_L = new THREE.Vector3(LX + 0.13, 1.05, 0.18);
const HAND_R = new THREE.Vector3(LX - 0.13, 1.05, 0.18);
const HEAD_C = new THREE.Vector3(0, 0.22, 0.02);             // head centre, in the neck pivot's frame
const TORSO = 0, HEAD = 1, ARM_L = 2, ARM_R = 3;
const PIVOT = [HIP, NECK, SH_L, SH_R];

function classify(x, y) {
    if (y > 1.45) return HEAD;           // head, eyes, cheeks, mouth, shine
    if (x - LX > 0.07) return ARM_L;     // arm + hand on her left
    if (x - LX < -0.07) return ARM_R;
    return TORSO;                        // torso + neck
}

// ── carving the baked mesh (once per source geometry; clones share it) ─────
const splitCache = new Map();
function raw(attr, i, k) {
    return attr.isInterleavedBufferAttribute ? attr.data.array[i * attr.data.stride + attr.offset + k] : attr.array[i * attr.itemSize + k];
}
function splitGeometry(geo) {
    if (splitCache.has(geo.uuid)) return splitCache.get(geo.uuid);
    let res = null;
    try { res = carve(geo); } catch (e) { console.error("[banter] rig split", e); }
    splitCache.set(geo.uuid, res);
    return res;
}
function carve(geo) {
    const pos = geo.attributes.position;
    if (!pos) return null;
    const n = pos.count;
    const idx = geo.index ? geo.index.array : null;
    const nTri = Math.floor((idx ? idx.length : n) / 3);
    const vert = k => (idx ? idx[k] : k);
    // union-find over triangles → connected components (each baked part is its own island)
    const par = new Int32Array(n);
    for (let i = 0; i < n; i++) par[i] = i;
    const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    for (let t = 0; t < nTri; t++) {
        const a = find(vert(t * 3)), b = find(vert(t * 3 + 1));
        if (a !== b) par[b] = a;
        const c = find(vert(t * 3 + 2)), r = find(a);
        if (c !== r) par[c] = r;
    }
    const sx = new Float64Array(n), sy = new Float64Array(n), cnt = new Int32Array(n);
    for (let v = 0; v < n; v++) { const r = find(v); sx[r] += pos.getX(v); sy[r] += pos.getY(v); cnt[r]++; }
    const cls = new Int8Array(n).fill(-1), part = new Int8Array(n);
    for (let v = 0; v < n; v++) {
        const r = find(v);
        if (cls[r] < 0) cls[r] = classify(sx[r] / cnt[r], sy[r] / cnt[r]);
        part[v] = cls[r];
    }
    const out = [null, null, null, null];
    for (let p = 0; p < 4; p++) {
        const tris = [];
        for (let t = 0; t < nTri; t++) { const a = vert(t * 3); if (part[a] === p) tris.push(a, vert(t * 3 + 1), vert(t * 3 + 2)); }
        if (!tris.length) continue;
        const remap = new Int32Array(n).fill(-1), order = [];
        for (const v of tris) if (remap[v] < 0) { remap[v] = order.length; order.push(v); }
        const m = order.length, g = new THREE.BufferGeometry();
        for (const [name, attr] of Object.entries(geo.attributes)) {
            const size = attr.itemSize;
            const src = attr.isInterleavedBufferAttribute ? attr.data.array : attr.array;
            const arr = new src.constructor(m * size);
            for (let i = 0; i < m; i++) for (let k = 0; k < size; k++) arr[i * size + k] = raw(attr, order[i], k);
            if (name === "position") for (let i = 0; i < m; i++) { arr[i * 3] -= PIVOT[p].x; arr[i * 3 + 1] -= PIVOT[p].y; arr[i * 3 + 2] -= PIVOT[p].z; }
            g.setAttribute(name, new THREE.BufferAttribute(arr, size, attr.normalized));
        }
        const ia = m > 65535 ? new Uint32Array(tris.length) : new Uint16Array(tris.length);
        for (let i = 0; i < tris.length; i++) ia[i] = remap[tris[i]];
        g.setIndex(new THREE.BufferAttribute(ia, 1));
        g.computeBoundingSphere();
        out[p] = g;
    }
    return out;
}

// ── the rig on the current car model ────────────────────────────────────────
const R = { model: null, driver: null, ok: false, rigid: false, body: null, head: null, armL: null, armR: null, parts: 0 };
const EMPTY = new THREE.BufferGeometry();

function rig(car) {
    R.model = car.model; R.driver = car.driver; R.ok = false; R.rigid = false; R.body = R.head = R.armL = R.armR = null; R.parts = 0;
    const drv = car.driver;
    if (!drv) return;
    const meshes = [];
    drv.traverse(o => { if (o.isMesh && o.name !== "BanterPart") meshes.push(o); });
    const ident = o => o === drv || (o.position.lengthSq() < 1e-8 && Math.abs(o.quaternion.w) > 0.99999 && Math.abs(o.scale.x - 1) < 1e-6);
    const splits = meshes.map(m => (ident(m) && m.parent === drv || m === drv) ? splitGeometry(m.geometry) : null);
    const has = [false, false, false, false];
    for (const s of splits) if (s) for (let p = 0; p < 4; p++) if (s[p]) has[p] = true;
    if (!meshes.length || splits.some(s => !s) || !has.every(Boolean)) {
        R.rigid = R.ok = true;          // fallback: the whole Driver moves as one
        return;
    }
    const body = new THREE.Group(), head = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
    body.name = "BanterBody"; head.name = "BanterHead"; armL.name = "BanterArmL"; armR.name = "BanterArmR";
    body.position.copy(HIP);
    head.position.copy(NECK).sub(HIP);
    armL.position.copy(SH_L).sub(HIP);
    armR.position.copy(SH_R).sub(HIP);
    body.add(head, armL, armR);
    const holder = [body, head, armL, armR];
    meshes.forEach((m, i) => {
        for (let p = 0; p < 4; p++) {
            const g = splits[i][p];
            if (!g) continue;
            const part = new THREE.Mesh(g, m.material);
            part.name = "BanterPart";
            part.castShadow = m.castShadow; part.receiveShadow = m.receiveShadow;
            part.userData = Object.assign({}, m.userData);   // e.g. law's jumpsuit swap remembers the real shirt
            holder[p].add(part);
            R.parts++;
        }
        if (m === drv) m.geometry = EMPTY;      // a single-material Driver: keep the node, drop its body
        else m.parent.remove(m);
    });
    drv.add(body);
    Object.assign(R, { ok: true, body, head, armL, armR });
}

// ── animation state ─────────────────────────────────────────────────────────
const S = {
    roll: new Spring(60, 0.55), pitch: new Spring(65, 0.55), yaw: new Spring(40, 0.8), bob: new Spring(170, 0.45),
    hYaw: new Spring(48, 0.78), hPitch: new Spring(95, 0.5), hRoll: new Spring(70, 0.55),
    wL: new Spring(70, 0.85), wR: new Spring(70, 0.85),
};
const A = {
    t: 0, beat: 0, vibe: 0, talk: 0,
    gL: null, gR: null,                  // arm gestures {kind, t, dur}
    look: null,                          // {target: Vector3 | Object3D | {x,z}, t, dur}
    glanceT: 3, glance: 0, glanceYaw: 0,
    cop: false, copT: 0, copBehind: false, scanT: 0,
    titleWaveT: 4,
    rnd: seeded(7),
};
const OVL = { L: new THREE.Quaternion(), R: new THREE.Quaternion() };   // last overlay pose (blends out smoothly)

/** An arm gesture: "hi" (honk: hand up, then a wave), "wave", "woo", "pump", "up" (both hands up), "shimmy". */
export function gesture(kind, dur = 1.2) {
    if (kind === "up") { A.gL = { kind, t: 0, dur }; A.gR = { kind, t: 0, dur }; return; }
    if (kind === "pump") { A.gR = { kind, t: 0, dur }; return; }
    A.gL = { kind, t: 0, dur };
}
/** Turn her head toward something for a while (Vector3, Object3D, or {x, z}). */
export function lookAt(target, dur = 1.2) { A.look = { target, t: 0, dur }; }
/** Flinch away from a near miss on `side` (+1 = the car passed on her right, −1 left). */
export function flinch(side = 1, power = 1) {
    S.roll.kick(-side * 2.4 * power); S.pitch.kick(-2.6 * power); S.hPitch.kick(-4.5 * power); S.hRoll.kick(-side * 3 * power);
    if (power > 0.8 && !A.gL) gesture("up", 0.45);
}
/** A bump / crash: a jolt that shakes her. */
export function jolt(power = 1) {
    S.pitch.kick(4 * power); S.hPitch.kick(7 * power); S.roll.kick((A.rnd() - 0.5) * 5 * power); S.hRoll.kick((A.rnd() - 0.5) * 6 * power); S.bob.kick(0.6 * power);
}
/** She's saying something: a few emphatic nods. */
export function talk(sec = 1.2) { A.talk = Math.max(A.talk, sec); }
/** Groove a bit harder for a while (combos, nitro, coin streaks). */
export function vibe(v = 1) { A.vibe = Math.max(A.vibe, v); }
export function rigInfo() { return R; }

// ── per frame ───────────────────────────────────────────────────────────────
const _e = new THREE.Euler(0, 0, 0, "YXZ"), _q = new THREE.Quaternion(), _qi = new THREE.Quaternion(), _qs = new THREE.Quaternion();
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _axis = new THREE.Vector3();
const _M = new THREE.Matrix4(), _D = new THREE.Matrix4(), _N = new THREE.Matrix4().makeTranslation(-NECK.x, -NECK.y, -NECK.z);
const REST_L = HAND_L.clone().sub(SH_L).normalize(), REST_R = HAND_R.clone().sub(SH_R).normalize();
const SH_L_B = SH_L.clone().sub(HIP), SH_R_B = SH_R.clone().sub(HIP);
const DIR = {
    waveL: new THREE.Vector3(0.62, 0.74, 0.16).normalize(),
    wooL: new THREE.Vector3(0.14, 1, 0.1).normalize(),
    shrugL: new THREE.Vector3(0.66, 0.45, 0.6).normalize(),
    upL: new THREE.Vector3(0.45, 0.85, 0.3).normalize(),
    upR: new THREE.Vector3(-0.45, 0.85, 0.3).normalize(),
    pumpHi: new THREE.Vector3(-0.1, 1, 0.18).normalize(),
    pumpLo: new THREE.Vector3(-0.12, 0.42, 0.9).normalize(),
};
const Z = new THREE.Vector3(0, 0, 1);
const SIDES = ["L", "R"];
const bases = new WeakMap();     // follower (hair, head anchor) → its rest matrix

/** Lulu's head centre in world space → out (false if she isn't there). */
export function headWorld(out) {
    const car = ctx.car;
    if (!car || !car.driver || !car.driver.visible) return false;
    if (R.ok && !R.rigid && R.head && R.model === car.model) {
        R.head.updateWorldMatrix(true, false);
        out.copy(HEAD_C).applyMatrix4(R.head.matrixWorld);
    } else {
        car.driver.updateWorldMatrix(true, false);
        out.set(LX, 1.6, -0.38).applyMatrix4(car.driver.matrixWorld);
    }
    return true;
}

function lookYawTo(tx, tz) {
    const car = ctx.car, h = car.h;
    const dx = tx - car.pos.x, dz = tz - car.pos.z;
    const lx = dx * Math.cos(h) - dz * Math.sin(h), lz = dx * Math.sin(h) + dz * Math.cos(h);
    return clamp(Math.atan2(lx - LX, lz + 0.4), -2.2, 2.2);
}
function targetXZ(tg, out) {
    if (!tg) return false;
    if (tg.isObject3D) { if (!tg.parent) return false; tg.getWorldPosition(out); return true; }
    if (tg.obj && tg.obj.isObject3D) { if (!tg.obj.parent) return false; out.copy(tg.obj.position); return true; }
    out.set(tg.x, 0, tg.z);
    return true;
}

function armOverlay(side, g, out) {
    const t = g.t, rest = side === "L" ? REST_L : REST_R;
    switch (g.kind) {
        case "hi":
            if (t < 0.32) { out.setFromUnitVectors(rest, DIR.shrugL); break; }
        // falls through: then wave
        case "wave":
            out.setFromUnitVectors(rest, DIR.waveL);
            _qs.setFromAxisAngle(Z, Math.sin(t * 13) * 0.42);
            out.premultiply(_qs);
            break;
        case "woo":
            out.setFromUnitVectors(rest, DIR.wooL);
            _qs.setFromAxisAngle(Z, Math.sin(t * 19) * 0.13);
            out.premultiply(_qs);
            break;
        case "pump":
            _d.copy(DIR.pumpLo).lerp(DIR.pumpHi, 0.5 - 0.5 * Math.cos(t * 15)).normalize();
            out.setFromUnitVectors(rest, _d);
            break;
        case "up":
            out.setFromUnitVectors(rest, side === "L" ? DIR.upL : DIR.upR);
            _qs.setFromAxisAngle(Z, Math.sin(t * 24) * 0.08 * (side === "L" ? 1 : -1));
            out.premultiply(_qs);
            break;
        default:
            out.identity();
    }
    return out;
}

let lastFrame = -1;
/**
 * One frame of animation. mode: "drive" (driving states) | "title" (attract mode).
 * Runs after the car's physics + visuals, before the frame renders.
 */
export function updateRig(dt, mode = "drive") {
    if (ctx.frames === lastFrame) return;
    lastFrame = ctx.frames;
    const car = ctx.car;
    if (!car || !car.model) return;
    if (car.model !== R.model || car.driver !== R.driver) rig(car);
    if (!R.ok || !car.driver || !car.driver.visible) return;

    A.t += dt;
    if (A.gL) { A.gL.t += dt; if (A.gL.t >= A.gL.dur) A.gL = null; }
    if (A.gR) { A.gR.t += dt; if (A.gR.t >= A.gR.dur) A.gR = null; }
    const fpCam = mode === "drive" && !!(CAMS[ctx.cam ? ctx.cam.mode : 0] || {}).fp;
    const k = fpCam ? 0.3 : 1;                   // first person: her head is the camera — keep it still
    const speed = car.speed, steer = car.steerVal || 0;
    const wrecked = ctx.state === "wrecked";

    // music bop (≈120 bpm), stronger when she's vibing
    A.vibe = Math.max(0, A.vibe - dt * 0.35);
    A.beat += dt * Math.PI * 2 * 2.0;
    const amp = ((mode === "title" ? 0.075 : speed > 2 ? 0.05 : 0.032) * (save3d.music === false ? 0.55 : 1) + A.vibe * 0.06) * (wrecked ? 0 : 1);
    const nod = Math.max(0, Math.sin(A.beat));
    let hp = amp * nod, hr = amp * 0.75 * Math.sin(A.beat * 0.5), bob = amp * 0.14 * nod;
    if (A.talk > 0) { A.talk -= dt; hp += 0.055 * Math.max(0, Math.sin(A.t * 13)); hr += 0.04 * Math.sin(A.t * 6.5); }

    // g-forces: lean INTO turns, lurch forward on the brakes, pinned back by the nitro
    let roll = clamp((car.latAcc || 0) * 0.011, -0.16, 0.16);
    let pitch = clamp(-(car.accelLong || 0) * 0.0065, -0.1, 0.13) + (car.boosting ? -0.13 : 0);
    let yaw = 0;
    let hy = -steer * 0.28;
    hp += car.boosting ? -0.12 : 0;
    if (car.offroad > 0.2 && speed > 3) bob += Math.sin(A.t * 41) * 0.014 * car.offroad;
    if (A.gL && A.gL.kind === "shimmy") roll += Math.sin(A.gL.t * 16) * 0.07;
    if (wrecked) { const w = ctx.stateT * 5; hr = 0.2 * Math.sin(w); hp = 0.1 + 0.14 * Math.cos(w); roll = 0.07 * Math.sin(w * 0.5); }

    // where she looks: cops in a chase > something interesting > little idle glances
    let look = null;
    if (mode === "drive" && !A.cop) {
        A.scanT -= dt;
        if (A.scanT <= 0) {       // a cop car right behind her? (cheap: twice a second)
            A.scanT = 0.5; A.copBehind = false;
            for (const c of ctx.traffic.cars) {
                const gap = c.s - car.s;
                if (gap < -4 && gap > -38 && !c.hit && (c.kind === "cop" || /K9/.test(c.kind) || (c.data && c.data.cop))) { A.copBehind = true; break; }
            }
        }
        if (A.copBehind) { A.copT += dt; if (A.copT % 3.4 < 0.85) look = 1.6; }    // nervous mirror checks
    }
    if (A.cop && mode === "drive") {
        A.copT += dt;
        const ph = A.copT % 2.6;
        if (ph < 0.9) { look = 1.95; yaw = 0.32; }      // over the left shoulder
    }
    if (look === null && A.look) {
        A.look.t += dt;
        if (A.look.t > A.look.dur || !targetXZ(A.look.target, _v)) A.look = null;
        else { look = lookYawTo(_v.x, _v.z); if (Math.abs(look) > 1.3) yaw = look * 0.16; }
    }
    if (look === null && mode === "title") {
        A.titleWaveT -= dt;
        if (A.titleWaveT <= 0) { A.titleWaveT = 7 + A.rnd() * 5; gesture("wave", 1.7); lookAt(ctx.camera.position.clone(), 1.9); }
    }
    if (look === null) {
        A.glanceT -= dt;
        if (A.glanceT <= 0) {
            A.glance = 0.45 + A.rnd() * 0.6;
            A.glanceYaw = (A.rnd() < 0.5 ? -1 : 1) * (0.3 + A.rnd() * 0.45);
            A.glanceT = A.glance + 3 + A.rnd() * 5;
        }
        if (A.glance > 0) { A.glance -= dt; look = A.glanceYaw; }
    }
    if (look !== null) hy = look;

    // springs
    roll = S.roll.step(roll * k, dt);
    pitch = S.pitch.step(pitch * k, dt);
    yaw = S.yaw.step(yaw * k, dt);
    bob = S.bob.step(bob * k, dt);
    hy = S.hYaw.step(hy * (fpCam ? 0.15 : 1), dt);
    hp = S.hPitch.step(hp * k, dt);
    hr = S.hRoll.step((hr - roll * 0.45) * k, dt);

    if (R.rigid) return applyRigid(roll, pitch, yaw, bob);

    // body + head
    R.body.position.set(HIP.x, HIP.y + bob, HIP.z);
    R.body.quaternion.setFromEuler(_e.set(pitch, yaw, roll));
    R.head.quaternion.setFromEuler(_e.set(hp, hy, hr));

    // hands ride the steering wheel (car.js turns it by steerVal × 1.6 about its own axis)
    const sw = car.steeringWheel;
    _qi.copy(R.body.quaternion).invert();
    if (sw && car.swBase) {
        _axis.set(0, 1, 0).applyQuaternion(car.swBase);
        _q.setFromAxisAngle(_axis, clamp(steer * 1.6, -1.15, 1.15));
    } else _q.identity();
    for (const side of SIDES) {
        const hand = side === "L" ? HAND_L : HAND_R, rest = side === "L" ? REST_L : REST_R, sh = side === "L" ? SH_L_B : SH_R_B;
        const arm = side === "L" ? R.armL : R.armR;
        // hand target on the rim, in the body's frame
        if (sw) _v.copy(hand).sub(sw.position).applyQuaternion(_q).add(sw.position); else _v.copy(hand);
        _v.sub(R.body.position).applyQuaternion(_qi).sub(sh).normalize();
        arm.quaternion.setFromUnitVectors(rest, _v);
        // a gesture blends over it
        const live = side === "L" ? A.gL : A.gR;
        if (live && live.kind !== "shimmy") armOverlay(side, live, OVL[side]);
        const w = (side === "L" ? S.wL : S.wR).step(live && live.kind !== "shimmy" && !wrecked ? 1 : 0, dt);
        if (w > 0.002) arm.quaternion.slerp(OVL[side], clamp(w, 0, 1));
    }

    // hair, shades and hats follow the head
    R.body.updateMatrix(); R.head.updateMatrix();
    _D.copy(R.driver.matrix).multiply(R.body.matrix).multiply(R.head.matrix).multiply(_N);
    follow(car, _D);
}

function applyRigid(roll, pitch, yaw, bob) {
    const drv = R.driver;
    drv.quaternion.setFromEuler(_e.set(pitch, yaw, roll));
    drv.position.copy(HIP).negate().applyQuaternion(drv.quaternion).add(HIP);
    drv.position.y += bob;
    drv.updateMatrix();
    follow(ctx.car, drv.matrix);
}

function follow(car, D) {
    if (car.hairs) for (const f of car.hairs) followOne(f, D);
    if (car.anchors && car.anchors.head) followOne(car.anchors.head, D);
}
function followOne(f, D) {
    let base = bases.get(f);
    if (!base) { f.updateMatrix(); base = f.matrix.clone(); bases.set(f, base); }
    _M.multiplyMatrices(D, base);
    _M.decompose(f.position, f.quaternion, f.scale);
}

/** Snap back to the rest pose (cutscenes, menus: the car is a prop again). */
export function restPose() {
    for (const s of Object.values(S)) s.reset();
    A.gL = A.gR = A.look = null; A.talk = 0; A.glance = 0;
    const car = ctx.car;
    if (!car || !R.ok || car.model !== R.model) return;
    if (R.rigid) { applyRigid(0, 0, 0, 0); return; }
    R.body.position.copy(HIP); R.body.quaternion.identity(); R.head.quaternion.identity();
    R.armL.quaternion.identity(); R.armR.quaternion.identity();
    R.body.updateMatrix(); R.head.updateMatrix();
    _D.copy(R.driver.matrix).multiply(R.body.matrix).multiply(R.head.matrix).multiply(_N);
    follow(car, _D);
}

// ── when to animate ─────────────────────────────────────────────────────────
const DRIVE = new Set(["playing", "intro", "wrecked", "arriving"]);
hook("hud", dt => { if (DRIVE.has(ctx.state) && !ctx.paused) updateRig(dt, "drive"); });
// the title screen's attract mode (Lulu cruising on autopilot): bop, steer, wave at the camera
hook("titleCamera", dt => { if (ctx.state === "title") updateRig(dt, "title"); return false; }, 1000);
on("state", ({ to }) => {
    if (!DRIVE.has(to) && to !== "title") restPose();
    if (to === "intro") gesture("up", 0.9);           // a big stretch before the countdown ends
    if (to !== "playing") { A.cop = false; }
});

// ── physical reactions (deterministic: they follow what the player did) ────
const _p = new THREE.Vector3();
on("honk", () => { gesture("hi", 1.25); S.hPitch.kick(2); });
on("boost", () => { gesture("woo", 0.9); vibe(1); S.pitch.kick(-2.5); });
on("closeCall", ({ oncoming, combo }) => {
    const car = ctx.car;
    // which side did it pass on? the nearest traffic car
    let side = oncoming ? -1 : 1, best = 14 * 14;
    for (const c of ctx.traffic.cars) {
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < best) { best = d2; side = (dx * -Math.cos(car.h) + dz * Math.sin(car.h)) >= 0 ? 1 : -1; _p.set(c.x, 0, c.z); }
    }
    flinch(side, oncoming ? 1 : 0.7);
    if (best < 14 * 14) lookAt(_p.clone(), 0.7);
    if (combo >= 3) { gesture("pump", 1.4); vibe(1); }
});
on("crash", e => { if (e && e.impact > 1.5 && ctx.state === "playing") jolt(Math.min(1.4, e.impact / 10)); });
on("damage", () => { jolt(1.3); gesture("up", 0.7); });
on("coin", ({ why }) => {
    const G = ctx.G;
    if (why === "road" && G.coinStreak > 0 && G.coinStreak % 6 === 5) { gesture("shimmy", 0.9); vibe(0.8); }
});
on("cop:chase", ({ active }) => { A.cop = !!active; A.copT = 0; });
on("speedTrap", ({ ticketed, trap }) => {
    if (trap && trap.obj) lookAt(trap.obj, 1.4);
    if (!ticketed) gesture("wave", 1.5);
    else S.hPitch.kick(-3);
});
on("heart", () => { vibe(0.6); });
on("run:start", () => { restPose(); A.vibe = 0; A.cop = false; });
