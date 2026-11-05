// features/roadevents — the RAILROAD CROSSING.
//
// 2D: "R X R" painted on the road, twin flashing lamps on both shoulders, a
// short train sweeping across ("🚂 TRAIN! Steer to a clear lane (or brake)");
// only the train body hurts.
// 3D: a real grade crossing — crossbucks, alternating red lamps, a clanging
// bell, gates that swing down, and a long freight (locomotive, boxcars, tank
// cars and a red caboose) thundering across with its horn blaring. Traffic
// queues at the gates. Brake and wait (+100 for patience), or try to beat it…
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { instanced } from "../../models.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { PAY, ENGINEER_LINES } from "./config.js";
import { defineEvent, inc, count } from "./state.js";
import { K, need, pt, place, rnd, rint, pick, clamp, claimSlot, reserve, makePiece, cloneOwn, findNodes, blockers, bubble, sfx, stat, roadPaint, builtEnd, loop, copWitness, models, cloneWithColors } from "./common.js";

const TRAIN_V = 24;            // m/s
const HALF_W = 1.55;           // train half width
const TRACK_LEN = 340;         // track runs ±340 m from the road
const ROAD_HALF = 10;          // the flush crossing panels cover |D| < 10
const BOX_COLORS = ["#8D3B2B", "#2E7D32", "#1565C0", "#6A1B9A", "#EF6C00", "#5D4037", "#C62828", "#455A64"];

export async function spawnTrain(opts = {}) {
    await need(["rail_signal", "rail_arm", "track", "track_xing", "train_loco", "train_box", "train_tank", "train_caboose", "npcMan"]);
    const slot = claimSlot(330, 140, opts);
    const s = slot.s;
    const road = ctx.world.road;
    const P = makePiece("train");
    P.later(slot.release);
    reserve(s - 14, s + 14, 0, 7, 999);
    reserve(s - 34, s + 34, 0, 36, 999);
    const h = road.at(s).h;
    const F = { x: Math.sin(h), z: Math.cos(h) }, Rv = { x: -Math.cos(h), z: Math.sin(h) };
    const O = pt(s, 0);
    const lineAt = (D, out = {}) => { out.x = O.x + Rv.x * D; out.z = O.z + Rv.z * D; return out; };

    // how far the track can run each way without crossing the road again
    const reach = [TRACK_LEN, TRACK_LEN];
    for (const [k, sgn] of [[0, -1], [1, 1]]) {
        for (let D = 20; D <= TRACK_LEN; D += 10) {
            const q = lineAt(sgn * D);
            let bad = false;
            for (const hint of [s - 320, s - 160, s + 160, s + 320]) {
                const n = road.nearest(q.x, q.z, Math.max(0, hint));
                if (Math.abs(n.d) < 12 && Math.abs(n.s - s) > 30) { bad = true; break; }
            }
            if (bad) { reach[k] = D - 20; break; }
        }
    }

    // track: flush crossing panels on the road, ties + rails off it (sunk so only ties/rails show)
    const segs = [], xings = [];
    for (const D of [-6, 0, 6]) xings.push(D);
    for (let D = ROAD_HALF + 4; D <= reach[1]; D += 8) segs.push(D);
    for (let D = -(ROAD_HALF + 4); D >= -reach[0]; D -= 8) segs.push(D);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);
    q.setFromAxisAngle(up, h + Math.PI / 2);
    const tr = P.own(instanced(models[K("track")], segs.length));
    segs.forEach((D, i) => { const p = lineAt(D); tr.set(i, mtx.compose(v.set(p.x, -0.3, p.z), q, one)); });
    tr.finish();
    P.add(tr.group);
    const xi = P.own(instanced(models[K("track_xing")], xings.length));
    xings.forEach((D, i) => { const p = lineAt(D); xi.set(i, mtx.compose(v.set(p.x, 0, p.z), q, one)); });
    xi.finish();
    P.add(xi.group);
    // a gravel bed along the line
    const bedMat = P.own(new THREE.MeshStandardMaterial({ color: "#9a958d", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    for (const [a, b] of [[ROAD_HALF, reach[1]], [-reach[0], -ROAD_HALF]]) {
        if (b - a < 2) continue;
        const geo = P.own(new THREE.PlaneGeometry(3.6, b - a));
        const bed = new THREE.Mesh(geo, bedMat);
        bed.rotation.x = -Math.PI / 2;
        const holder = new THREE.Group();
        const c = lineAt((a + b) / 2);
        holder.position.set(c.x, 0.02, c.z);
        holder.rotation.y = h + Math.PI / 2;
        holder.add(bed);
        bed.receiveShadow = true;
        P.add(holder);
    }
    // road paint + stop line + an advance sign
    for (const [txt, at] of [["X", s - 120], ["R X R", s - 88]]) {
        const paint = roadPaint(txt, "#F5F5DC", 6.4, 2.4);
        place(paint, at, 3.5, 0, 0.045);
        P.add(paint);
    }
    const stopLine = new THREE.Mesh(P.own(new THREE.PlaneGeometry(6.8, 0.45)), P.own(new THREE.MeshBasicMaterial({ color: "#f4f4f0", polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));
    stopLine.rotation.x = -Math.PI / 2;
    const sl = place(new THREE.Group(), s - 11, 3.5, 0, 0.045);
    sl.add(stopLine);
    P.add(sl);
    const signS = s - 300;
    if (builtEnd() < signS - 10) {
        const def = { s: signS, d: 10.4, lines: ["R X R", "RAILROAD"], bg: "#FFD600", fg: "#111111", w: 2.2, h: 2.2, tw: 256, th: 256 };
        ctx.world.addSign(def);
        P.later(() => { const i = ctx.world.signs.indexOf(def); if (i >= 0) ctx.world.signs.splice(i, 1); });
    }

    // signals + gates: ours on the right before the track, theirs on the left after it
    const signals = [];
    for (const [ss, d, yaw] of [[s - 5.5, 9.4, 0], [s + 5.5, -9.4, Math.PI]]) {
        const sig = cloneOwn(models[K("rail_signal")], ["LampA", "LampB", "BellGold"]);
        place(sig, ss, d, yaw);
        P.add(sig);
        const arm = cloneWithColors(models[K("rail_arm")]);
        arm.traverse(o => { if (o.isMesh && o.material.name === "LampA") o.material = sig.userData.mats.LampA; });
        arm.scale.x = 1.28;
        const anc = findNodes(sig, "Anchor_arm")[0];
        (anc || sig).add(arm);
        arm.rotation.z = 1.5;
        const bell = findNodes(sig, "RailSignal")[0];
        signals.push({ sig, arm, mats: sig.userData.mats, s: ss, d, smashed: false, bell });
    }

    // the train
    const dir = opts.dir || (Math.random() < 0.5 ? 1 : -1);
    const nCars = opts.cars || rint(5, 8);
    const consist = [{ key: "train_loco", len: 17 }];
    for (let i = 0; i < nCars; i++) consist.push(Math.random() < 0.65 ? { key: "train_box", len: 14, color: pick(BOX_COLORS) } : { key: "train_tank", len: 13, color: pick(["#ECEFF1", "#263238", "#FFB300", "#B0BEC5"]) });
    consist.push({ key: "train_caboose", len: 10.4 });
    let off = 0;
    for (const c of consist) {
        c.obj = c.color ? cloneWithColors(models[K(c.key)], { Paint: c.color }) : cloneWithColors(models[K(c.key)]);
        c.off = off + c.len / 2;
        off += c.len + 0.9;
        c.obj.visible = false;
        P.add(c.obj);
    }
    const trainLen = off - 0.9;
    const engineer = spawnPerson("npcMan", { colors: { Top: "#1565C0", Bottom: "#37474F", Hair: "#6D4C41" } });
    const eAnc = findNodes(consist[0].obj, "Anchor_engineer")[0];
    if (eAnc) { eAnc.add(engineer.obj); engineer.obj.rotation.y = Math.PI / 2; engineer.obj.scale.setScalar(0.95); }

    const T = { s, dir, phase: "idle", front: 0, t: 0, arrive: 1e9, lights: false, gate: 1, waited: false, hit: false, horn: [], bellT: 0, rumble: null, passedT: 0, tailClear: false };
    // cars queue before the gates (both directions)
    blockers.add(T.blockOurs = { s: s - 7, d0: -1, d1: 8, dir: 1, reach: 70, active: () => T.lights });
    blockers.add(T.blockOnc = { s: s + 7, d0: -8, d1: 1, dir: -1, reach: 70, active: () => T.lights });
    P.later(() => { blockers.delete(T.blockOurs); blockers.delete(T.blockOnc); if (T.rumble) T.rumble.stop(); });
    inc("train");
    count("trains");

    const _p = {};
    function layTrain() {
        // the FRONT is at D = front, heading +dir·right; cars trail behind
        for (const c of consist) {
            const D = T.front - dir * c.off;
            const hide = (dir > 0 ? D < -reach[0] - 10 || D > reach[1] + 10 : D > reach[1] + 10 || D < -reach[0] - 10);
            c.obj.visible = !hide && T.phase !== "idle";
            lineAt(D, _p);
            c.obj.position.set(_p.x, 0.1, _p.z);
            c.obj.rotation.y = h - dir * Math.PI / 2;
        }
    }
    function trainSpan() { // [min D, max D] occupied
        const a = T.front, b = T.front - dir * trainLen;
        return [Math.min(a, b), Math.max(a, b)];
    }

    const actor = {
        foot: true, train: T,
        update(dt) {
            const car = ctx.car;
            const ahead = s - car.s;
            T.t += dt;
            if (T.phase === "idle") {
                if (ahead < (opts.trigger || 330) || opts.now) {
                    // time the train to reach the road just as Lulu would
                    const eta = clamp((ahead - 8) / Math.max(car.speed, 13), 4.5, 16) * (opts.early ? 0.5 : 0.95);
                    T.front = -dir * (ROAD_HALF + TRAIN_V * eta);
                    T.arrive = T.t + eta;
                    T.phase = "coming";
                    T.rumble = loop(80);
                    layTrain();
                }
                return car.s < s + 250;
            }
            // move
            T.front += dir * TRAIN_V * dt;
            layTrain();
            const toArrive = T.arrive - T.t;
            const [lo, hi] = trainSpan();
            const onRoad = lo < ROAD_HALF && hi > -ROAD_HALF;
            T.tailClear = dir > 0 ? lo > ROAD_HALF : hi < -ROAD_HALF;
            if (T.tailClear && T.phase !== "gone") { T.phase = "gone"; T.passedT = T.t; }
            // lights + bell from 9 s before until 1.5 s after the tail clears
            T.lights = toArrive < 9 && !(T.phase === "gone" && T.t - T.passedT > 1.5);
            if (T.lights && !T.announced && ctx.state === "playing") {
                T.announced = true;
                H.banner(`🚂 <b>TRAIN!</b><small>Brake for the crossing (or beat it…)</small>`, 2400);
            }
            // gates: start down 7 s before, take 3 s; back up 2 s after the tail clears
            const want = T.lights && toArrive < 7.2 ? 0 : 1;
            T.gate += Math.sign(want - T.gate) * Math.min(Math.abs(want - T.gate), dt / 3);
            const blink = Math.sin(T.t * 11.5) > 0;
            for (const sg of signals) {
                sg.mats.LampA.emissiveIntensity = T.lights ? (blink ? 4 : 0.15) : 0.15;
                sg.mats.LampB.emissiveIntensity = T.lights ? (blink ? 0.15 : 4) : 0.15;
                if (!sg.smashed) sg.arm.rotation.z = 1.5 * T.gate;
            }
            if (T.lights) {
                T.bellT -= dt;
                if (T.bellT <= 0) { T.bellT = 0.42; sfx.bell(Math.floor(T.t / 0.42)); }
            }
            // horn: ― ― ○ ― as it approaches (2D's ding-ding, louder)
            if (!T.horn[0] && toArrive < 7) { T.horn[0] = 1; sfx.trainHorn(0.9); sfx.trainHorn(0.9, 1.1); sfx.trainHorn(0.35, 2.2); sfx.trainHorn(1.4, 2.7); }
            // rumble by distance
            const near = Math.max(0, Math.min(Math.abs(lo), Math.abs(hi), onRoad ? 0 : 1e9));
            const dist = Math.hypot(Math.abs(ahead), lo > 0 ? lo : hi < 0 ? -hi : 0);
            if (T.rumble) T.rumble.set(clamp(1 - dist / 220, 0, 1) * 0.5, 70 + clamp(1 - dist / 200, 0, 1) * 90);
            if (dist < 30 && onRoad) rumble(0.25 * (1 - dist / 30), 0.5 * (1 - dist / 30), 120);
            // patience: stopped at the gates while the train is crossing
            if (onRoad && ahead > 6 && ahead < 45 && car.speed < 2.5 && !T.waited && !T.hit && ctx.state === "playing") {
                T.waited = true;
                addScore(PAY.trainWait, "train");
                H.toast(`🚂 Patient driver! +${PAY.trainWait}`, "gold");
                bubble(pick(ENGINEER_LINES), engineer.obj, { t: 2.6, y: 2.0, cls: "gold" });
                sfx.trainHorn(0.3); sfx.trainHorn(0.3, 0.4);
                stat("trainsWaited", 1);
                T.waveT = 3;
            }
            engineer.update(dt, { wave: T.waveT > 0 });
            if (T.waveT > 0) T.waveT -= dt;
            // running the gate: the arm snaps off
            for (const sg of signals) {
                if (sg.smashed || T.gate > 0.55) continue;
                const ours = sg.d > 0;
                const crossing = ours ? car.s > sg.s - 0.5 && car.s < sg.s + 2 && car.d > 0.5 : car.s < sg.s + 0.5 && car.s > sg.s - 2 && car.d < -0.5;
                if (crossing && car.speed > 1) smashGate(sg);
            }
            const gone = T.phase === "gone" && (dir > 0 ? lo > reach[1] + 5 : hi < -reach[0] - 5);
            if (gone && T.rumble) { T.rumble.stop(); T.rumble = null; }
            return car.s < s + 260 && !(gone && car.s > s + 40);
        },
        collide(car) {
            if (T.phase === "idle" || Math.abs(s - car.s) > 20) return null;
            const [lo, hi] = trainSpan();
            if (hi < -ROAD_HALF - 6 || lo > ROAD_HALF + 6) return null;
            // car in line coordinates: along (D), perp (along the road)
            const dx = car.pos.x - O.x, dz = car.pos.z - O.z;
            const along = dx * Rv.x + dz * Rv.z, perp = dx * F.x + dz * F.z;
            const ext = 0.93 + 1.15 * Math.abs(Math.sin(car.h - h));        // the car's half-depth along the road
            const extA = 0.93 + 1.15 * Math.abs(Math.cos(car.h - h));       // …and along the track
            const penP = HALF_W + ext - Math.abs(perp);
            const penLo = along + extA - lo, penHi = hi - (along - extA);
            if (penP <= 0 || penLo <= 0 || penHi <= 0) return null;
            const tv = dir * TRAIN_V;
            const cvA = car.vx * Rv.x + car.vz * Rv.z, cvP = car.vx * F.x + car.vz * F.z;
            let impact = 0;
            const frontFace = dir > 0 ? penHi : penLo;
            if (penP < Math.min(penLo, penHi) && penP < 1.2) {
                // side of the train: bounce back along the road
                const n = Math.sign(perp) || -1;
                car.pos.x += F.x * n * penP; car.pos.z += F.z * n * penP;
                if (cvP * n < 0) { impact = Math.abs(cvP); car.vx -= F.x * cvP * 1.4; car.vz -= F.z * cvP * 1.4; }
                // the train drags her along a bit
                car.vx += Rv.x * (tv - cvA) * 0.25; car.vz += Rv.z * (tv - cvA) * 0.25;
                car.spin += n * dir * 1.5;
            } else {
                // the locomotive plows into her: shoved down the track
                const push = frontFace + 0.05;
                car.pos.x += Rv.x * dir * push; car.pos.z += Rv.z * dir * push;
                impact = Math.abs(tv - cvA);
                car.vx += Rv.x * (tv * 1.05 - cvA); car.vz += Rv.z * (tv * 1.05 - cvA);
                car.spin += (Math.random() < 0.5 ? -1 : 1) * 3;
            }
            if (impact < 2) return null;
            T.hit = true;
            rumble(1, 1, 500, true);
            return { impact: Math.max(impact, 12), why: "Lulu vs. the 5:15 freight: the freight won", source: "train" };
        },
        dispose() { P.disposePiece(); inc("train", -1); },
    };
    function smashGate(sg) {
        sg.smashed = true;
        const arm = sg.arm;
        const wp = arm.getWorldPosition(new THREE.Vector3()), wq = arm.getWorldQuaternion(new THREE.Quaternion());
        arm.parent.remove(arm);
        arm.position.copy(wp); arm.quaternion.copy(wq);
        P.add(arm);
        const car = ctx.car;
        const vel = new THREE.Vector3(car.vx * 0.6, 4, car.vz * 0.6);
        let t = 0;
        addActor({ update(dt) { t += dt; vel.y -= 14 * dt; arm.position.addScaledVector(vel, dt); arm.rotation.x += 6 * dt; if (arm.position.y < 0.1) { arm.position.y = 0.1; vel.multiplyScalar(0.3); } return t < 3; }, dispose() { if (arm.parent) arm.parent.remove(arm); } });
        A.sfxCrash(0.45);
        rumble(0.6, 0.7, 250, true);
        H.toast("🚧 You RAN the gate!", "red");
        count("railGatesSmashed");
        stat("railGates", 1);
        if (copWitness(110) && ctx.law && ctx.law.startChase) ctx.law.startChase("railroad");
    }
    addActor(actor);
    return T;
}
defineEvent("train", { label: "Railroad crossing", emoji: "🚂", models: ["rail_signal", "rail_arm", "track", "track_xing", "train_loco", "train_box", "train_tank", "train_caboose"], spawn: spawnTrain, setPiece: true });
