// 🎨 LOOK TEST — Lulu on foot with a skeleton (3d/blender/assets_looktest.py › looktest_lulu): three authored cycles
// (Idle 3 s · Walk 0.8 s · Run 0.5 s) cross-faded by her speed, walk + run kept in step (one shared phase, so a speed
// change never stutters the feet), a lean into turns, and the old poses (wave, cheer, sit, the jump…) laid over the
// cycles bone by bone with the SAME numbers core/people.js uses — so every feature that asks for a pose still gets it.
//
// The clothes (features/clothes/wear.js) keep working: it recolours by material name (same names as lulu_person) and
// hangs a coat / an accessory on nodes named Body / Arm_L / Arm_R — here those are small "sockets" riding the spine
// and the forearms, placed so their frame is exactly the old nodes' frame (a coat sits where it always did).
import * as THREE from "three";
import { clone as skClone } from "three/addons/utils/SkeletonUtils.js";
import { Person } from "../../core/people.js";

const WALK = 3.4, RUN = 7.6;                     // features/foot's walking and running speeds (m/s)
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _m = new THREE.Matrix4();
const matCache = new Map(), _X = new THREE.Vector3(1, 0, 0);

/** Model-space rotation `d` (Euler x, z like people.js) applied to a bone, measured from its rest pose. */
function poseBone(b, x, z = 0, y = 0) {
    if (!b) return;
    const R = b.userData.restW;                               // rest orientation relative to the model root
    _q.setFromEuler(_e.set(x, y, z, "XYZ"));
    _q2.copy(R).invert().multiply(_q).multiply(R);            // the same turn, in the bone's own frame
    b.quaternion.copy(b.userData.rest).multiply(_q2);
}

export class LookPerson extends Person {
    constructor(obj, clips) {
        super(obj);
        this.look = true;
        const B = this.bones = {};
        obj.traverse(o => { if (o.isBone) B[o.name] = o; });
        this.rig = B.Hips ? B.Hips.parent : obj;             // the armature node: banks into turns, drops to sit
        this.rigBase = this.rig.position.clone();
        this.mixer = new THREE.AnimationMixer(obj);
        const act = n => { const c = clips.find(c => c.name === n); const a = c ? this.mixer.clipAction(c) : null; if (a) { a.play(); a.setEffectiveWeight(0); } return a; };
        this.idle = act("Idle"); this.walkA = act("Walk"); this.runA = act("Run");
        for (const a of [this.walkA, this.runA]) if (a) a.timeScale = 0;      // (their time is set from the shared phase)
        if (this.idle) this.idle.time = Math.random() * this.idle.getClip().duration;
        this.w = { idle: 1, walk: 0, run: 0 };
        this.cyc = 0;                                          // the walk / run phase, 0..1
        this.lastYaw = null; this.bank = 0; this.sitK = 0;
    }

    update(dt, opts = {}) {
        this.t += dt;
        const sp = opts.walk || 0;
        // target blend by speed: standing → walking → running
        let ti = 0, tw = 0, tr = 0;
        if (sp < 0.12) ti = 1;
        else if (sp < WALK * 0.55) { const k = sp / (WALK * 0.55); ti = 1 - k; tw = k; }
        else if (sp < WALK * 1.15) tw = 1;
        else if (sp < RUN * 0.8) { const k = (sp - WALK * 1.15) / (RUN * 0.8 - WALK * 1.15); tw = 1 - k; tr = k; }
        else tr = 1;
        if (opts.sit || opts.air) { ti = 1; tw = tr = 0; }
        // the cross-fade: weights glide (starting / stopping never snaps); stopping settles a bit faster than starting
        const W = this.w, rate = (ti > W.idle ? 7 : 9) * dt;
        W.idle += (ti - W.idle) * Math.min(1, rate); W.walk += (tw - W.walk) * Math.min(1, rate); W.run += (tr - W.run) * Math.min(1, rate);
        // one shared phase: the cycle rate follows the speed (each clip's own pace at its own speed)
        const wd = this.walkA ? this.walkA.getClip().duration : 0.8, rd = this.runA ? this.runA.getClip().duration : 0.5;
        const sw = W.walk + W.run || 1;
        const rateW = THREE.MathUtils.clamp(sp / 2.6, 0.55, 1.6) / wd, rateR = THREE.MathUtils.clamp(sp / 7.0, 0.7, 1.3) / rd;
        this.cyc = (this.cyc + dt * (rateW * W.walk + rateR * W.run) / sw) % 1;
        if (this.walkA) { this.walkA.time = this.cyc * wd; this.walkA.setEffectiveWeight(W.walk); }
        if (this.runA) { this.runA.time = this.cyc * rd; this.runA.setEffectiveWeight(W.run); }
        if (this.idle) this.idle.setEffectiveWeight(W.idle);
        this.mixer.update(dt);

        // a lean into turns (from how fast she's turning × how fast she's going)
        const yaw = this.obj.rotation.y;
        let dy = this.lastYaw == null ? 0 : yaw - this.lastYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.lastYaw = yaw;
        const want = THREE.MathUtils.clamp(-(dy / Math.max(dt, 1e-3)) * sp * 0.035, -0.22, 0.22);
        this.bank += (want - this.bank) * Math.min(1, dt * 8);
        this.rig.rotation.z = this.bank;
        this.sitK += ((opts.sit ? 1 : 0) - this.sitK) * Math.min(1, dt * 10);
        this.rig.position.y = this.rigBase.y - 0.35 * this.sitK;

        this.poses(opts);
    }

    /** The old people.js poses, over the cycles: only the limbs a pose uses are taken over. */
    poses(o) {
        const B = this.bones;
        if (!(o.sit || o.dance || o.cheer || o.wave || o.point || o.stop || o.clap || o.facepalm || o.air || o.talk)) return;
        let legs = null, armL = null, armR = null;
        if (o.sit) { legs = [-1.4, -1.4]; armL = [-0.5, 0.06]; armR = [-0.5, -0.06]; }
        if (o.dance) { const d = Math.sin(this.t * 7); armL = [-2.4 + d * 0.4, 0.4]; armR = [-2.4 - d * 0.4, -0.4]; legs = [d * 0.25, -d * 0.25]; }
        if (o.cheer) { const c = -2.7 + Math.sin(this.t * 10) * 0.15; armL = [c, 0.25]; armR = [c, -0.25]; }
        if (o.wave) armR = [-2.6, -0.35 + Math.sin(this.t * 9) * 0.45];
        if (o.point) armR = [-1.5, -0.05];
        if (o.stop) { armL = [-1.55, 0.18]; armR = [-1.55, -0.18]; }
        if (o.clap) { const c = 0.5 + Math.sin(this.t * 15) * 0.5; armL = [-1.25, 0.3 - c * 0.5]; armR = [-1.25, -(0.3 - c * 0.5)]; }
        if (o.facepalm) armR = [-2.55, 0.55];
        if (o.air) { const up = o.air > 0; legs = [-0.95, 0.35]; const a = up ? -2.5 : -1.6, z = up ? 0.3 : 0.9; armL = [a, z]; armR = [a, -z]; }
        if (legs) {
            poseBone(B.ThighL, legs[0]); poseBone(B.ThighR, legs[1]);
            // knees that bend (the old model had none): a sit folds them, the jump tucks the front one
            poseBone(B.ShinL, o.sit ? 1.4 : o.air ? 1.1 : 0.1); poseBone(B.ShinR, o.sit ? 1.4 : o.air ? 0.4 : 0.1);
        }
        if (armL) { poseBone(B.UpperArmL, armL[0], armL[1]); poseBone(B.ForeArmL, o.clap || o.stop ? -0.25 : -0.12); }
        if (armR) { poseBone(B.UpperArmR, armR[0], armR[1]); poseBone(B.ForeArmR, o.facepalm ? -1.2 : o.clap || o.stop ? -0.25 : -0.12); }
        if (o.talk && B.Head) { _q.setFromAxisAngle(_X, Math.sin(this.t * 6) * 0.05); B.Head.quaternion.multiply(_q); }
    }
}

/** A skinned Lulu: cloned with her skeleton, recoloured, given the clothes sockets, dressed, wrapped. */
export function lookPerson(template, clips, { colors = null, scale = 1, outfit } = {}, dresser = null) {
    const obj = skClone(template);
    obj.scale.setScalar(1);
    if (colors) obj.traverse(o => {
        if (!o.isMesh) return;
        const hex = colors[o.material.name];
        if (!hex) return;
        const key = o.material.uuid + hex;
        let m = matCache.get(key);
        if (!m) { m = o.material.clone(); m.color.set(hex); matCache.set(key, m); }
        o.material = m;
    });
    obj.updateMatrixWorld(true);
    const inv = _m.copy(obj.matrixWorld).invert();
    obj.traverse(o => {
        if (!o.isBone) return;
        o.userData.rest = o.quaternion.clone();
        const w = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        o.userData.restW = new THREE.Quaternion().setFromRotationMatrix(w);
    });
    // the clothes sockets: Body on the spine (frame = the model root), Arm_L / Arm_R on the forearms (frame = the old arm
    // node: at the shoulder, unrotated) — features/clothes hangs a coat / a bag / a coffee on them
    const B = {}; obj.traverse(o => { if (o.isBone) B[o.name] = o; });
    const socket = (name, bone, at) => {
        if (!bone) return;
        const s = new THREE.Object3D();
        s.name = name;
        const target = new THREE.Matrix4().makeTranslation(at[0], at[1], at[2]);
        const local = new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().multiplyMatrices(inv, bone.matrixWorld).invert(), target);
        local.decompose(s.position, s.quaternion, s.scale);
        bone.add(s);
    };
    socket("Body", B.Spine, [0, 0, 0]);
    socket("Arm_L", B.ForeArmL, [0.22, 1.30, 0]);
    socket("Arm_R", B.ForeArmR, [-0.22, 1.30, 0]);
    obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    obj.scale.setScalar(scale);
    if (dresser && outfit !== false && !(colors && colors.Top)) { try { dresser(obj, outfit); } catch (e) { console.error("[looktest] dress", e); } }
    return new LookPerson(obj, clips);
}
