// features/seasons — 🎭 THE PURIM MUSIC VAN: a minivan doing laps of town with two horn speakers and a
// "FREILICHEN PURIM!" board on the roof, playing a jolly (synthesized) freylekhs tune you hear as it passes —
// the tzedakah collectors' ride. One of the town's own lane-following drivers (ctx.town.addDriver), solo only: in a
// 🎉 party the town's traffic is the party's seeded loops, so the van stays home (the collectors on foot are there).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { signTexture } from "../../world.js";
import * as A from "../../audio.js";
import { propMesh } from "./dress.js";

const V = { car: null, kit: null, sign: null, loop: null, mat: null, kind: "seasonsMusicVan", tries: 0 };

// the tune: a bouncy freylekhs in D freygish (D Eb F# G A Bb C), oom-pah bass, ~4.3 s, looped
function tune(sr) {
    const bpm = 168, beat = 60 / bpm, bars = 6, len = Math.floor(sr * beat * 4 * bars), out = new Float32Array(len);
    const N = { D4: 293.7, Eb4: 311.1, Fs4: 370.0, G4: 392.0, A4: 440.0, Bb4: 466.2, C5: 523.3, D5: 587.3, D3: 146.8, A2: 110.0, G2: 98.0 };
    const mel = ["D4", "Fs4", "A4", "A4", "Bb4", "A4", "G4", "Fs4", "G4", "A4", "Bb4", "C5", "D5", "C5", "Bb4", "A4", "G4", "Fs4", "Eb4", "Fs4", "G4", "Fs4", "Eb4", "D4"];
    const add = (f, t0, dur, vol, shape) => {
        const a = Math.floor(t0 * sr), n = Math.floor(dur * sr);
        for (let i = 0; i < n && a + i < len; i++) {
            const ph = (i / sr) * f, env = Math.min(1, i / (sr * 0.008)) * Math.exp(-i / (sr * dur * 0.55));
            const w = shape === "sq" ? (ph % 1 < 0.5 ? 1 : -1) * 0.6 + Math.sin(ph * Math.PI * 2) * 0.4 : Math.sin(ph * Math.PI * 2);
            out[a + i] += w * env * vol;
        }
    };
    mel.forEach((k, i) => add(N[k], i * beat, beat * 0.92, 0.28, "sq"));
    for (let b = 0; b < bars * 4; b++) add(b % 2 ? N.A2 : N.D3, b * beat, beat * 0.45, 0.32, "sin");
    // a little shine on the off-beats
    for (let b = 0; b < bars * 4; b++) add(1760, b * beat + beat / 2, 0.03, 0.05, "sin");
    return out;
}

export function vanStart() {
    vanStop();
    if (!ctx.town || !ctx.town.active || !ctx.town.addDriver || (ctx.party && ctx.party.active)) return false;
    const c = ctx.town.addDriver("van", { minD: 55, speed: 4.5 });
    if (!c || !c.obj) return false;
    V.car = c;
    // the roof kit, on top of the van (its own bounding box: works for whichever van model)
    const box = new THREE.Box3().setFromObject(c.obj), top = box.max.y - c.obj.position.y;
    const kit = propMesh("SpeakerKit");
    if (kit) { kit.mesh.position.set(0, top - 0.02, -0.2); kit.mesh.name = "SeasonsVanKit"; c.obj.add(kit.mesh); V.kit = kit.mesh;
        if (kit.anchors.Sign) {
            V.mat = V.mat || new THREE.MeshBasicMaterial({ map: signTexture(["FREILICHEN PURIM!", "🎺 tzedakah for the poor 🎺"], "#6A1B9A", "#FFF3C4", 512, 140), toneMapped: false });
            // a face on each side of the board (cars ahead see one in the mirror, cars behind the other)
            const geo = new THREE.PlaneGeometry(1.42, 0.4), sg = new THREE.Group();
            const base = kit.anchors.Sign.clone().add(kit.mesh.position);
            for (const [dz, ry] of [[0.035, 0], [-0.085, Math.PI]]) { const q = new THREE.Mesh(geo, V.mat); q.position.copy(base).add(new THREE.Vector3(0, 0, dz)); q.rotation.y = ry; sg.add(q); }
            sg.userData.geo = geo;
            sg.name = "SeasonsVanSign";
            c.obj.add(sg); V.sign = sg;
        } }
    // a pooled traffic car is reused later: take our things off when the town lets it go
    const prev = c.onRemove;
    c.onRemove = car => { detach(); if (prev) prev(car); };
    V.tries = 0;
    return true;
}
function detach() {
    if (V.loop) { try { V.loop.stop(); } catch (e) { /* gone */ } V.loop = null; }
    for (const o of [V.kit, V.sign]) if (o && o.parent) o.parent.remove(o);
    if (V.sign && V.sign.userData.geo) V.sign.userData.geo.dispose();
    V.kit = V.sign = null;
    V.car = null;
}
export function vanStop() {
    const c = V.car;
    detach();
    if (c && ctx.traffic && ctx.traffic.cars.includes(c)) ctx.traffic.remove(c);
}
/** Every frame: keep the music on it (once audio is unlocked) and the van in town. */
export function vanTick() {
    if (!V.car) return;
    if (!ctx.traffic.cars.includes(V.car)) { detach(); return; }
    if (!V.loop && A.spatial && A.spatial.ready && !ctx.skipping) {
        if (!A.spatial.has(V.kind)) A.spatial.define(V.kind, { gen: tune, loop: true, ref: 9, gain: 0.55, max: 1 });
        V.loop = A.spatial.loop(V.kind, V.car.obj, { gain: 0.6 });
    }
}
export const vanInfo = () => ({ on: !!V.car, kit: !!V.kit, sign: !!V.sign, music: !!(V.loop && V.loop.alive), x: V.car ? V.car.obj.position.x : null, z: V.car ? V.car.obj.position.z : null });
