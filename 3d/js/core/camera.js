// Camera rigs for the driving scene: chase, far chase, Lulu's eyes, the
// title-screen orbit, plus helpers features use for cutscenes and on-foot.
//
//   ctx.cam.cinematic(fromVec3, lookVec3, dt, lerp = 2)  — ease toward a shot
//   ctx.cam.follow(object3D, { dist, height, look, yaw }, dt) — 3rd-person follow (on foot)
//   ctx.cam.snap()   — jump instead of easing on the next frame
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
    snap() { st.snap = true; if (ctx.car) st.yaw = ctx.car.h; },
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
    update(dt) { updateCamera(dt); },
    state: st,
};
ctx.cam = cam;

function updateCamera(dt) {
    const camera = ctx.camera, car = ctx.car, G = ctx.G;
    // right stick look (springs back when released)
    const inv = save3d.settings.invertLook ? -1 : 1;
    const lx = input.lookX, ly = input.lookY * inv;
    st.lookYaw += ((lx ? -lx * 2.2 : 0) - st.lookYaw) * Math.min(1, dt * (lx ? 6 : 3));
    st.lookPitch += ((ly ? ly * 0.5 : 0) - st.lookPitch) * Math.min(1, dt * (ly ? 6 : 3));

    const def = ctx.states[ctx.state];
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
    if (st.snap) st.pos.copy(_v); else st.pos.lerp(_v, Math.min(1, dt * 9));
    st.snap = false;
    camera.position.copy(st.pos);
    if (shake > 0) camera.position.add(_w.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.6, (Math.random() - 0.5) * shake));
    camera.position.y += car.bump * 0.6;
    _w.set(car.pos.x + Math.sin(yaw) * 4, cfg.look, car.pos.z + Math.cos(yaw) * 4);
    camera.lookAt(_w);
    const fov = cfg.fov + Math.min(sp, 50) * 0.3 + (G.boosting ? 10 : 0) + (portrait ? 16 : 0);
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
}
