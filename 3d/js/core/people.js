// People: runtime animation for the characters built by 3d/blender/lib_people.py.
//
// Every person .glb has a root with these parts (origin = the joint):
//   Body (torso + head, baked) · Arm_L / Arm_R (pivot at the shoulder)
//   Leg_L / Leg_R (pivot at the hip)  — the person faces +Z in three.js.
//
//   const bubbe = spawnPerson("bubbe2", { scale: 1 });   // clone of models.bubbe2
//   scene.add(bubbe.obj);
//   bubbe.update(dt, { walk: speed_m_s, wave: true, talk: true, cheer: false, sit: false });
import * as THREE from "three";
import { models, cloneWithColors, findNodes } from "../models.js";

const PARTS = ["Arm_L", "Arm_R", "Leg_L", "Leg_R", "Body", "Head"];

export class Person {
    constructor(obj) {
        this.obj = obj;
        this.limbs = {};
        for (const p of PARTS) {
            const n = findNodes(obj, p)[0];
            if (n) { this.limbs[p] = n; n.userData.base = n.quaternion.clone(); n.userData.basePos = n.position.clone(); }
        }
        this.phase = Math.random() * 6;
        this.t = Math.random() * 10;
        this.waveT = 0;
    }

    /**
     * opts: walk (m/s, 0 = idle), wave (bool), talk (bool), cheer (bool, both arms up),
     *       sit (bool), point (bool, right arm forward), dance (bool)
     */
    update(dt, opts = {}) {
        this.t += dt;
        const L = this.limbs;
        const walk = opts.walk || 0;
        this.phase += dt * (walk > 0.05 ? 2.2 + walk * 2.4 : 0);
        const swing = walk > 0.05 ? Math.min(0.75, 0.25 + walk * 0.22) : 0;
        const s = Math.sin(this.phase);
        const breathe = Math.sin(this.t * 2.2) * 0.015;
        const rot = (node, x, z = 0, y = 0) => {
            if (!node) return;
            const q = node.userData.base.clone();
            q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, "XYZ")));
            node.quaternion.copy(q);
        };
        let legL = s * swing, legR = -s * swing, armL = -s * swing * 0.8, armR = s * swing * 0.8, armLz = 0.06, armRz = -0.06;
        if (opts.sit) { legL = legR = -1.4; armL = armR = -0.5; }
        if (opts.dance) {
            const d = Math.sin(this.t * 7);
            armL = -2.4 + d * 0.4; armR = -2.4 - d * 0.4; armLz = 0.4; armRz = -0.4;
            legL = d * 0.25; legR = -d * 0.25;
        }
        if (opts.cheer) { armL = armR = -2.7 + Math.sin(this.t * 10) * 0.15; armLz = 0.25; armRz = -0.25; }
        if (opts.wave) { armR = -2.6; armRz = -0.35 + Math.sin(this.t * 9) * 0.45; }
        if (opts.point) { armR = -1.5; armRz = -0.05; }
        rot(L.Leg_L, legL); rot(L.Leg_R, legR);
        rot(L.Arm_L, armL, armLz); rot(L.Arm_R, armR, armRz);
        if (L.Body) {
            const bob = walk > 0.05 ? Math.abs(Math.cos(this.phase)) * 0.035 * Math.min(1, walk) : 0;
            L.Body.position.copy(L.Body.userData.basePos);
            L.Body.position.y += bob + breathe + (opts.talk ? Math.abs(Math.sin(this.t * 12)) * 0.01 : 0) + (opts.sit ? -0.35 : 0);
            rot(L.Body, opts.talk ? Math.sin(this.t * 6) * 0.03 : 0, opts.dance ? Math.sin(this.t * 7) * 0.12 : 0);
        }
        // arms ride along with the body's sit offset
        for (const k of ["Arm_L", "Arm_R"]) {
            if (L[k]) L[k].position.y = L[k].userData.basePos.y - (opts.sit ? 0.35 : 0);
        }
    }

    /** Turn to face a world point (on the ground plane). */
    face(x, z, dt = 1, rate = 8) {
        const want = Math.atan2(x - this.obj.position.x, z - this.obj.position.z);
        let d = want - this.obj.rotation.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.obj.rotation.y += d * Math.min(1, dt * rate);
    }
}

/** Clone a person model (optionally recolouring materials by name) and wrap it. */
export function spawnPerson(key, { colors = null, scale = 1 } = {}) {
    if (!models[key]) throw new Error(`spawnPerson: model "${key}" isn't loaded (ensureModels first)`);
    const obj = cloneWithColors(models[key], colors);
    obj.scale.setScalar(scale);
    return new Person(obj);
}
