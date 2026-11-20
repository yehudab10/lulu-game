// Camera rigs for the driving scene: chase, far chase, Lulu's eyes, the
// title-screen orbit, plus helpers features use for cutscenes and on-foot.
//
//   ctx.cam.cinematic(fromVec3, lookVec3, dt, lerp = 2)  — ease toward a shot
//   ctx.cam.follow(object3D, { dist, height, look, yaw }, dt) — 3rd-person follow behind a yaw (a friend's car)
//   ctx.cam.orbit(object3D, { dist, look, fov, y, auto: { yaw, k } }, dt) — the FREE camera on foot: the player
//                      turns it (right stick, a mouse / finger drag) and it STAYS there; `auto` eases it toward
//                      a yaw only while the player leaves the look alone. ctx.cam.free = its state (yaw, pitch…).
// The LOOK controls (right stick + drag, invert-look, Settings › 🎥 Look speed) live here: in the car the look is
// HELD (it stays where the stick leaves it for a moment, then drifts back behind the car); R3 / V looks behind.
//   ctx.cam.snap()   — jump instead of easing on the next frame
//   ctx.cam.blend(s) — like snap() for the rigs, but the PICTURE glides from where the camera is now to wherever
//                      the next rig puts it, over s seconds (car ↔ on foot, into and out of a roadside cutscene).
//                      A jump of more than BLEND_MAX metres is a teleport: that one stays a cut.
// A state can own the camera by defining camera(dt) → true in registerState.
import * as THREE from "three";
import { ctx, wrapAngle, runHooks, claimHooks } from "./ctx.js";
import { save3d, saveSoon } from "./save.js";
import { input } from "../input.js";

export const CAMS = [
    { name: "Chase cam", dist: 7.4, height: 2.7, look: 1.2, fov: 60 },
    { name: "Far chase", dist: 11.5, height: 4.4, look: 1.6, fov: 56 },
    { name: "Lulu's eyes", fp: true, fov: 72 },
];

const st = { mode: save3d.cam || 0, yaw: 0, lookYaw: 0, lookPitch: 0, pos: new THREE.Vector3(), orbit: 0, snap: true, look: new THREE.Vector3() };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _axis = new THREE.Vector3();
// a running blend (cam.blend): the pose the picture is leaving, and how far along it is
const BLEND_MAX = 70;
const bl = { on: false, fresh: false, t: 0, dur: 0.6, pos: new THREE.Vector3(), quat: new THREE.Quaternion(), fov: 60 };
const ease = k => k * k * (3 - 2 * k);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── the look controls ──────────────────────────────────────────────────
/** rate: rad/s at full stick · hold: s the car's look stays put after you let go · back: its drift-back rate */
export const LOOK = { rate: 2.9, pitchRate: 1.8, hold: 1.4, back: 1.6, carPitch: [-0.35, 0.55],
    // the free camera on foot: pitch = the camera's elevation round her shoulders (rad)
    pitch: 0.29, pitchMin: -0.28, pitchMax: 1.05, autoAfter: 1.2, pitchBackAfter: 3.5 };
const _li = { yaw: 0, pitch: 0, active: false };
/** This frame's look input (radians to turn): the right stick (a rate) + a mouse / finger drag (a delta). */
function lookInput(dt) {
    const S = save3d.settings, inv = S.invertLook ? -1 : 1, k = S.lookSens || 1;
    // (ci/hangout's emote wheel is aimed with the right stick: no look while it's open)
    if (document.body.classList.contains("emote-wheel")) { _li.yaw = _li.pitch = 0; _li.active = false; return _li; }
    const sx = input.lookX || 0, sy = input.lookY || 0, dx = input.lookDX || 0, dy = input.lookDY || 0;
    _li.yaw = (-sx * LOOK.rate * dt - dx) * k;
    _li.pitch = (sy * LOOK.pitchRate * dt + dy) * inv * k;
    _li.active = !!(sx || sy || dx || dy || input.lookDrag);
    return _li;
}
// the free camera's state (on foot)
const FREE = { yaw: 0, pitch: LOOK.pitch, idle: 9, frame: -9, reT: 0, reYaw: 0, tgt: new THREE.Vector3(), n: 0, dist: 6.6, look: 1.2, clipD: 99 };
const _t = new THREE.Vector3();

export const cam = {
    get mode() { return st.mode; },
    get name() { return CAMS[st.mode].name; },
    cycle() {
        st.mode = (st.mode + 1) % CAMS.length;
        save3d.cam = st.mode;
        saveSoon();
        cam.snap();
        return CAMS[st.mode].name;
    },
    // (a snap is a CUT: it also ends a glide still running — one left running across a teleport swooped the picture
    //  from the old place to the new one, through whatever stood between; blend() starts its own glide after this)
    snap() { st.snap = true; bl.on = false; if (ctx.car) st.yaw = ctx.car.h; st.lookYaw = 0; st.lookPitch = 0; },
    /** A soft cut: the rigs jump (as with snap), the picture glides there over `sec` seconds. */
    blend(sec = 0.6) {
        const camera = ctx.camera;
        cam.snap();
        if (!camera || ctx.view || ctx.skipping || !(sec > 0)) { bl.on = false; return; }
        // (a blend already running: leave from the pose on screen, which is what camera holds right now)
        startBlend(sec);
    },
    get blending() { return bl.on; },
    /** Ease the camera toward a shot (cutscenes, arrivals). */
    cinematic(from, look, dt, rate = 2, fov = 50) {
        const camera = ctx.camera;
        if (st.snap) { st.pos.copy(from); st.look.copy(look); st.snap = false; }
        st.pos.lerp(from, Math.min(1, dt * rate));
        st.look.lerp(look, Math.min(1, dt * rate * 1.5));
        camera.position.copy(st.pos);
        camera.lookAt(st.look);
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 2);
        camera.updateProjectionMatrix();
    },
    /** Third-person follow behind an object (on foot). yaw defaults to the object's heading. */
    follow(obj, { dist = 5.5, height = 2.6, look = 1.3, yaw = null, fov = 58 } = {}, dt = 1 / 60) {
        const camera = ctx.camera;
        const want = (yaw == null ? obj.rotation.y : yaw) + st.lookYaw;
        st.yaw += wrapAngle(want - st.yaw) * Math.min(1, dt * 4);
        const portrait = camera.aspect < 1;
        const D = dist * (portrait ? 1.3 : 1), Hh = height * (portrait ? 1.2 : 1) + st.lookPitch * 2;
        _v.set(obj.position.x - Math.sin(st.yaw) * D, obj.position.y + Hh, obj.position.z - Math.cos(st.yaw) * D);
        if (st.snap) { st.pos.copy(_v); st.snap = false; } else st.pos.lerp(_v, Math.min(1, dt * 7));
        camera.position.copy(st.pos);
        _w.set(obj.position.x + Math.sin(st.yaw) * 2, obj.position.y + look, obj.position.z + Math.cos(st.yaw) * 2);
        camera.lookAt(_w);
        camera.fov += (fov + (portrait ? 14 : 0) - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
    },
    /** The FREE third-person camera (on foot): it orbits obj at the player's yaw / pitch and stays where they leave it.
     *  opts: dist (m), look (pivot height over her feet), fov, y (her height to frame — default obj.position.y),
     *  auto { yaw, k } (ease toward that yaw while the look is left alone — foot: down the road / the street),
     *  clip(tgt, dx, dy, dz, D) → the farthest the camera may sit from the pivot along that direction (walls), or
     *  { d, noLift } (noLift: don't rise over her head when that close — she's under a tree). */
    orbit(obj, { dist = 6.6, look = 1.2, fov = 58, y = null, auto = null, clip = null } = {}, dt = 1 / 60) {
        const camera = ctx.camera;
        // the rig wasn't running last frame (a cutscene's shot, a script's camera): its follow point jumps to her at
        // once and the PICTURE glides from what was on screen (a blend), so nothing swoops in from a stale spot
        const fresh = FREE.frame < ctx.frames - 1;
        // (a glide already running — getting out of the car starts a 0.7 s one, and she's walking after ~0.5 s — is
        //  restarted from the picture on screen: letting it run on toward the NEW rig jumped the picture by metres)
        if (fresh && !st.snap && !ctx.skipping) startBlend(bl.on ? Math.max(0.45, bl.dur - bl.t) : 0.45);
        FREE.frame = ctx.frames;
        const L = lookInput(dt);
        if (L.active) { FREE.idle = 0; FREE.reT = 0; FREE.n++; } else FREE.idle += dt;
        FREE.yaw = wrapAngle(FREE.yaw + L.yaw);
        FREE.pitch = clamp(FREE.pitch + L.pitch, LOOK.pitchMin, LOOK.pitchMax);
        if (FREE.reT > 0) {
            FREE.reT -= dt;
            FREE.yaw += wrapAngle(FREE.reYaw - FREE.yaw) * Math.min(1, dt * 9);
            FREE.pitch += (LOOK.pitch - FREE.pitch) * Math.min(1, dt * 6);
        } else if (auto && FREE.idle > LOOK.autoAfter) {
            FREE.yaw = wrapAngle(FREE.yaw + wrapAngle(auto.yaw - FREE.yaw) * Math.min(1, dt * (auto.k || 0.8)));
        }
        if (FREE.idle > LOOK.pitchBackAfter) FREE.pitch += (LOOK.pitch - FREE.pitch) * Math.min(1, dt * 0.5);
        const portrait = camera.aspect < 1;
        // (a closer framing — at a car, hotwiring — eases in rather than jumping)
        if (st.snap || fresh) { FREE.dist = dist; FREE.look = look; }
        else { FREE.dist += (dist - FREE.dist) * Math.min(1, dt * 4); FREE.look += (look - FREE.look) * Math.min(1, dt * 4); }
        const D0 = FREE.dist * (portrait ? 1.3 : 1);
        _t.set(obj.position.x, (y == null ? obj.position.y : y) + FREE.look, obj.position.z);
        if (st.snap || fresh) FREE.tgt.copy(_t);
        else if (Math.hypot(_t.x - FREE.tgt.x, _t.z - FREE.tgt.z) > 2.5) {
            // she was moved a few metres at once (a scene put her somewhere): the rig follows now, the picture glides —
            // from what's on screen (even mid-glide); moved farther than a glide may go (a teleport), it's a cut
            if (Math.hypot(_t.x - FREE.tgt.x, _t.z - FREE.tgt.z) > BLEND_MAX) bl.on = false;
            else if (!ctx.skipping) startBlend(0.35);
            FREE.tgt.copy(_t);
        } else { FREE.tgt.x += (_t.x - FREE.tgt.x) * Math.min(1, dt * 12); FREE.tgt.z += (_t.z - FREE.tgt.z) * Math.min(1, dt * 12); FREE.tgt.y += (_t.y - FREE.tgt.y) * Math.min(1, dt * 7); }
        const snapped = st.snap;
        st.snap = false;
        const cp = Math.cos(FREE.pitch), sp = Math.sin(FREE.pitch), fx = Math.sin(FREE.yaw), fz = Math.cos(FREE.yaw);
        let D = D0;
        if (FREE.tgt.y + sp * D < 0.4) D = Math.max(1.6, (FREE.tgt.y - 0.4) / -sp);      // looking up: slide in along the ground
        // a wall / a house between her and the camera (opts.clip — foot's: the same colliders she bumps into): the camera
        // comes in to this side of it at once, and eases back out once it's clear (no popping in and out at a corner)
        if (clip) {
            const r = clip(FREE.tgt, -fx * cp, sp, -fz * cp, D), lim = typeof r === "number" ? r : r.d;
            FREE.noLift = typeof r === "object" && !!r.noLift;
            if (snapped || fresh || lim < FREE.clipD) FREE.clipD = lim;
            else FREE.clipD = Math.min(lim, FREE.clipD + (D - FREE.clipD) * Math.min(1, dt * 4) + dt * 1.5);
            D = Math.min(D, FREE.clipD);
        } else { FREE.clipD = 99; FREE.noLift = false; }
        // (pressed right up against a wall: rather than sit in it, the camera rises over her head and looks down)
        const lift = D < 1.5 && !FREE.noLift ? (1.5 - D) * 1.4 : 0;
        camera.position.set(FREE.tgt.x - fx * cp * D, FREE.tgt.y + sp * D + lift, FREE.tgt.z - fz * cp * D);
        // the look point sits a little ahead of her (she stands a touch low in the frame, the way she's going)
        camera.lookAt(FREE.tgt.x + fx * 1.8, FREE.tgt.y - 0.05, FREE.tgt.z + fz * 1.8);
        camera.fov += (fov + (portrait ? 14 : 0) - camera.fov) * Math.min(1, dt * 3);
        camera.updateProjectionMatrix();
        st.pos.copy(camera.position);
        st.yaw = FREE.yaw;
    },
    /** The free camera's state: yaw / pitch (rad), idle (s since the player last looked), looks (how many frames they did). */
    free: {
        get yaw() { return FREE.yaw; }, set yaw(v) { FREE.yaw = wrapAngle(v); },
        get pitch() { return FREE.pitch; }, set pitch(v) { FREE.pitch = clamp(v, LOOK.pitchMin, LOOK.pitchMax); },
        get idle() { return FREE.idle; },
        get looks() { return FREE.n; },
        /** How far the walls let it sit right now (m; 99 = nothing in the way) — tests. */
        get clipD() { return FREE.clipD; },
        /** Is the free camera the one on screen (it ran last frame)? */
        get on() { return FREE.frame >= ctx.frames - 1; },
        /** Start from where the camera is looking right now (no swing when the rig takes over). */
        fromCamera() {
            const c = ctx.camera;
            if (!c) return;
            c.getWorldDirection(_t);
            if (Math.hypot(_t.x, _t.z) > 1e-3) FREE.yaw = Math.atan2(_t.x, _t.z);
            FREE.pitch = LOOK.pitch; FREE.idle = 9; FREE.reT = 0;
        },
        /** Swing it back behind a yaw (R3 / V on foot), over a moment. */
        recentre(yaw) { FREE.reYaw = yaw; FREE.reT = 0.45; },
        reset(yaw = 0, pitch = LOOK.pitch) { FREE.yaw = wrapAngle(yaw); FREE.pitch = pitch; FREE.idle = 9; FREE.reT = 0; },
    },
    update(dt) { updateCamera(dt); applyBlend(dt); },
    /** (tgt, dx, dy, dz, D) → how far the CHASE cam may sit from the car (walls) | null — foot sets it in a town. */
    carClip: null,
    /** How far the walls let the chase cam sit right now (m; 99 = nothing in the way) — tests. */
    get carClipD() { return CAR.clipD; },
    state: st,
};
ctx.cam = cam;

function startBlend(sec) {
    const camera = ctx.camera;
    if (!camera) return;
    // (a blend already running: leave from the pose on screen, which is what camera holds right now)
    bl.pos.copy(camera.position); bl.quat.copy(camera.quaternion); bl.fov = camera.fov;
    bl.on = true; bl.fresh = true; bl.t = 0; bl.dur = sec;
}

/** After the rig has placed the camera: ease the picture from the pose cam.blend() captured to that placement. */
function applyBlend(dt) {
    if (!bl.on) return;
    const camera = ctx.camera;
    if (bl.fresh) {
        bl.fresh = false;
        if (camera.position.distanceTo(bl.pos) > BLEND_MAX) { bl.on = false; return; }      // a teleport: cut
    }
    bl.t += dt;
    const k = bl.t / bl.dur;
    if (k >= 1) { bl.on = false; return; }
    const e = ease(k);
    camera.position.lerpVectors(bl.pos, camera.position, e);
    _q.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(bl.quat, _q, e);
    camera.fov = bl.fov + (camera.fov - bl.fov) * e;
    camera.updateProjectionMatrix();
}
const _q = new THREE.Quaternion();

// ── the chase cam's walls (cam.carClip — set by foot while she's in a TOWN; null on the highway: no cost there) ──
// Like the free camera on foot: a house / a block / the circle's statue / a tree's leaves between the car and the camera
// brings it in at once to this side (rising a little when it's very close), then it eases back out.
const CAR = { clipD: 99 }, _cp = new THREE.Vector3();
function carClip(snapped, dt) {
    const fn = cam.carClip, car = ctx.car, camera = ctx.camera;
    if (!fn) { CAR.clipD = 99; return; }
    _cp.set(car.pos.x, 1.4, car.pos.z);
    const vx = st.pos.x - _cp.x, vy = st.pos.y - _cp.y, vz = st.pos.z - _cp.z, D = Math.hypot(vx, vy, vz);
    const r = D > 0.5 ? fn(_cp, vx / D, vy / D, vz / D, D) : null;
    if (r == null) { CAR.clipD = 99; return; }
    const lim = typeof r === "number" ? r : r.d;
    if (snapped || lim < CAR.clipD) CAR.clipD = lim;
    else CAR.clipD = Math.min(lim, CAR.clipD + (D - CAR.clipD) * Math.min(1, dt * 4) + dt * 2);
    const d = Math.min(D, CAR.clipD);
    if (d >= D) return;
    const k = d / D;
    const lift = d < 2.5 && !(typeof r === "object" && r.noLift) ? (2.5 - d) * 0.8 : 0;     // (not up into a tree's leaves)
    camera.position.set(_cp.x + vx * k, _cp.y + vy * k + lift, _cp.z + vz * k);
}

function updateCamera(dt) {
    const camera = ctx.camera, car = ctx.car, G = ctx.G;
    const def = ctx.states[ctx.state];
    // the car's look: HELD — the right stick / a drag turns it and it stays a moment, then drifts back behind the car
    // (outside a driving state it just settles to the middle; the free camera on foot keeps its own)
    const L = lookInput(dt);
    if (def && def.driving && L.active) {
        st.lookIdle = 0;
        st.lookYaw = wrapAngle(st.lookYaw + L.yaw);
        st.lookPitch = clamp(st.lookPitch + L.pitch * 0.55, LOOK.carPitch[0], LOOK.carPitch[1]);
    } else {
        st.lookIdle = (st.lookIdle || 0) + dt;
        const back = def && def.driving ? (st.lookIdle > LOOK.hold ? LOOK.back + Math.min(2, (ctx.car ? ctx.car.speed : 0) * 0.04) : 0) : 6;
        st.lookYaw = wrapAngle(st.lookYaw - st.lookYaw * Math.min(1, dt * back));
        st.lookPitch -= st.lookPitch * Math.min(1, dt * back);
    }

    if (def && def.camera && def.camera(dt) === true) return;

    const shake = save3d.settings.calm ? 0 : (G.shake || 0);
    G.shake = Math.max(0, (G.shake || 0) - dt * 1.8);
    const portrait = camera.aspect < 1;
    const sp = car.speed;

    if (ctx.state === "title" || !def || !def.driving) {
        if (claimHooks("titleCamera", dt, camera)) return;
        // slow orbit around the car
        st.orbit += dt * 0.18;
        const a = car.h + Math.PI * 0.75 + st.orbit;
        _v.set(car.pos.x + Math.sin(a) * 8.5, 2.3 + Math.sin(st.orbit * 0.7) * 0.6, car.pos.z + Math.cos(a) * 8.5);
        st.pos.lerp(_v, st.snap ? 1 : Math.min(1, dt * 2));
        camera.position.copy(st.pos);
        camera.lookAt(car.pos.x, 1.0, car.pos.z);
        if (camera.aspect > 1.25 && ctx.state === "title") camera.rotateY(0.3); // menu on the left → car on the right
        camera.fov += (55 - camera.fov) * Math.min(1, dt * 2);
        st.snap = false;
        camera.updateProjectionMatrix();
        return;
    }

    const back = input.lookBack && ctx.state === "playing" ? Math.PI : 0;
    const cfg = CAMS[st.mode];
    if (cfg.fp) {
        // Lulu's eyes: ride along in the driver's seat, with the car's pitch and roll
        car.tilt.updateMatrixWorld(true);
        _v.set(0.38, 1.68, -0.06);
        car.tilt.localToWorld(_v);
        camera.position.copy(_v);
        const yaw = car.h + st.lookYaw + back;
        _w.set(Math.sin(yaw), -0.035 - st.lookPitch * 0.6, Math.cos(yaw));
        _w.applyAxisAngle(_axis.set(Math.sin(car.h), 0, Math.cos(car.h)), -car.roll * 1.2);
        camera.up.set(-Math.cos(car.h) * car.roll * 1.2, 1, Math.sin(car.h) * car.roll * 1.2).normalize();
        camera.lookAt(_v.add(_w));
        camera.up.set(0, 1, 0);
        const fov = cfg.fov + sp * 0.22 + (G.boosting ? 9 : 0) + (portrait ? 14 : 0);
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
        if (shake > 0) camera.position.add(_w.set((Math.random() - 0.5) * shake * 0.12, (Math.random() - 0.5) * shake * 0.12, 0));
        camera.updateProjectionMatrix();
        st.yaw = car.h;
        st.pos.copy(camera.position);
        return;
    }

    // chase: follow the direction of travel when drifting, so slides look great
    let desiredYaw = car.h;
    if (sp > 4 && car.vF > 0) desiredYaw = car.h + wrapAngle(Math.atan2(car.vx, car.vz) - car.h) * 0.55;
    st.yaw += wrapAngle(desiredYaw - st.yaw) * Math.min(1, dt * 5);
    const yaw = st.yaw + st.lookYaw + back;
    const dist = cfg.dist * (portrait ? 1.25 : 1) + (G.boosting ? 1.2 : 0) + Math.min(sp, 45) * 0.025;
    const height = cfg.height * (portrait ? 1.25 : 1) + st.lookPitch * 3;
    _v.set(car.pos.x - Math.sin(yaw) * dist, height, car.pos.z - Math.cos(yaw) * dist);
    const snapped = st.snap;
    if (st.snap) st.pos.copy(_v); else st.pos.lerp(_v, Math.min(1, dt * 9));
    st.snap = false;
    camera.position.copy(st.pos);
    carClip(snapped, dt);
    if (shake > 0) camera.position.add(_w.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.6, (Math.random() - 0.5) * shake));
    camera.position.y += car.bump * 0.6;
    _w.set(car.pos.x + Math.sin(yaw) * 4, cfg.look, car.pos.z + Math.cos(yaw) * 4);
    camera.lookAt(_w);
    const fov = cfg.fov + Math.min(sp, 50) * 0.3 + (G.boosting ? 10 : 0) + (portrait ? 16 : 0);
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
}
