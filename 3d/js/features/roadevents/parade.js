// features/roadevents — the PARADE / MARATHON.
//
// 2D: "🎉 PARADE! Mind the crowd!" — for 4.5–7 s a stream of people runs across
// the road (9 a second). Bump one and they become a passenger, like any walker.
// 3D: a balloon arch over the road ("LAKEWOOD PARADE" or "LAKEWOOD MARATHON"),
// crowd barriers and cheering spectators on both shoulders, and the marchers /
// runners streaming across as you arrive — drawn as instanced crowds so a whole
// parade costs a handful of draw calls. Traffic waits; so can you (+80).
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { signTexture, worldMaterials } from "../../world.js";
import { instanced } from "../../models.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { PARADE_KINDS, PARADE_CHEERS, KO_NAMES, KO_LINES } from "./config.js";
import { defineEvent, inc, count } from "./state.js";
import { K, need, pt, place, rnd, rint, pick, clamp, claimSlot, reserve, makePiece, Crowd, blockers, bubble, sfx, stat, personColors, SHIRTS, models, copWitness } from "./common.js";
import { seatRider } from "./passengers.js";

const KEYS = ["npcWoman", "npcMan", "npcKid"];

export async function spawnParade(opts = {}) {
    await need(["crowd_barrier", ...KEYS]);
    const slot = claimSlot(50, 40, opts);
    const s = slot.s;
    const kind = opts.kind || (Math.random() < 0.5 ? "parade" : "marathon");
    const K2 = PARADE_KINDS[kind];
    const P = makePiece("parade");
    P.later(slot.release);
    reserve(s - 30, s + 30, 0, 8.8, 18);
    const road = ctx.world.road, h = road.at(s).h;
    const M = worldMaterials();

    // the arch: two posts, a banner, balloons
    const arch = place(new THREE.Group(), s + 14, 0);
    const postGeo = P.own(new THREE.CylinderGeometry(0.2, 0.2, 7.4, 10));
    const ballGeo = P.own(new THREE.SphereGeometry(0.5, 12, 9));
    const cols = ["#FF4081", "#FFD740", "#40C4FF", "#B388FF", "#69F0AE"];
    const ballMats = cols.map(c => P.own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.15 })));
    const balls = [];
    for (const sd of [-1, 1]) {
        const post = new THREE.Mesh(postGeo, P.own(new THREE.MeshStandardMaterial({ color: sd > 0 ? "#7E57C2" : "#26C6DA", roughness: 0.5 })));
        post.position.set(sd * 10.2, 3.7, 0);
        post.castShadow = true;
        arch.add(post);
        for (let k = 0; k < 6; k++) {
            const b = new THREE.Mesh(ballGeo, ballMats[k % 5]);
            b.scale.y = 1.2;
            b.position.set(sd * 10.2 + Math.cos(k * 1.1) * 0.9, 7.8 + k * 0.3, Math.sin(k * 1.1) * 0.9);
            b.castShadow = true;
            arch.add(b);
            balls.push({ b, base: b.position.y, ph: k + sd });
        }
    }
    const banner = new THREE.Mesh(P.own(new THREE.BoxGeometry(20.4, 2.0, 0.12)), [M.metal, M.metal, M.metal, M.metal,
        P.own(new THREE.MeshStandardMaterial({ map: signTexture([K2.banner], "#E91E63", "#ffffff", 1024, 128), roughness: 0.6 })),
        P.own(new THREE.MeshStandardMaterial({ map: signTexture([K2.back], "#E91E63", "#ffffff", 1024, 128), roughness: 0.6 }))]);
    banner.position.y = 6.5;
    banner.rotation.y = Math.PI;
    banner.castShadow = true;
    arch.add(banner);
    P.add(arch);
    // crowd barriers on both shoulders
    const nB = 12;
    const bar = P.own(instanced(models[K("crowd_barrier")], nB * 2));
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    let bi = 0;
    for (const sd of [-1, 1]) for (let i = 0; i < nB; i++) {
        const a = s - 14 + i * 2.45;
        if (Math.abs(a - s) < 7) continue;         // the gap the marchers come through
        const p = pt(a, sd * 9.4);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.h + Math.PI / 2);
        bar.set(bi++, mtx.compose(v.set(p.x, 0, p.z), q, one));
    }
    for (; bi < nB * 2; bi++) bar.set(bi, mtx.makeScale(0, 0, 0));
    bar.finish();
    P.add(bar.group);
    // spectators (instanced crowds), cheering behind the barriers
    const crowds = {};
    for (const key of KEYS) { crowds[key] = new Crowd(key, 40, ["Top", "Bottom", "Hair"]); P.add(crowds[key].group); P.later(() => crowds[key].dispose()); }
    for (const sd of [-1, 1]) for (let i = 0; i < 9; i++) {
        const a = s - 15 + i * 3.4 + rnd(-0.6, 0.6);
        if (Math.abs(a - s) < 6) continue;
        const p = pt(a, sd * rnd(10.4, 12.2));
        crowds[pick(KEYS)].add({ x: p.x, z: p.z, rot: p.h + (sd > 0 ? Math.PI / 2 : -Math.PI / 2) + rnd(-0.3, 0.3), colors: personColors(), cheer: Math.random() < 0.6, wave: Math.random() < 0.3, spectator: true });
    }
    for (const c of Object.values(crowds)) c.update(0);

    const E = { s, kind, started: false, streamT: 0, t: 0, marchers: [], spawnAcc: 0, waited: false, done: false, cheerT: 0 };
    const blk = { s: s - 10, d0: -8, d1: 8, dir: 1, reach: 60, active: () => E.started && !E.done };
    const blk2 = { s: s + 10, d0: -8, d1: 8, dir: -1, reach: 60, active: () => E.started && !E.done };
    blockers.add(blk); blockers.add(blk2);
    P.later(() => { blockers.delete(blk); blockers.delete(blk2); });
    inc("parade");
    count("parades");

    function addMarcher() {
        const sd = Math.random() < 0.5 ? -1 : 1;
        const key = pick(KEYS);
        const a = s + rnd(-6, 6);
        const speed = kind === "marathon" ? rnd(5, 9.8) : rnd(1.6, 2.6);
        const colors = kind === "marathon" ? { Top: pick(["#FFFFFF", "#FFEB3B", "#00E5FF", "#FF4081", "#76FF03"]), Bottom: "#212121", Hair: pick(["#3E2723", "#6D4C41", "#FFC107", "#1A1A1A"]) }
            : { Top: pick(["#D32F2F", "#1565C0", "#FFFFFF", pick(SHIRTS)]), Bottom: pick(["#FAFAFA", "#1A237E", "#212121"]), Hair: pick(["#3E2723", "#6D4C41", "#FFC107", "#1A1A1A"]) };
        const p = pt(a, sd * 10);
        const m = crowds[key].add({ x: p.x, z: p.z, rot: 0, colors, walk: speed, cheer: kind === "parade" && Math.random() < 0.35 });
        if (!m) return;
        m.key = key; m.s = a; m.d = sd * 10; m.vx = -sd * speed;
        E.marchers.push(m);
    }
    const actor = {
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car, ahead = s - car.s;
            for (const bb of balls) bb.b.position.y = bb.base + Math.sin(E.t * 1.6 + bb.ph) * 0.18;
            // start the stream so it's crossing as Lulu arrives (2D: 4.5–7 s of runners)
            if (!E.started && (opts.now || ahead < Math.max(70, car.speed * 4.5))) {
                E.started = true;
                E.streamT = rnd(4.5, 7);
                if (ctx.state === "playing") H.banner(`<b>${K2.title.split("!")[0]}!</b><small>${K2.title.split("!")[1].trim()}</small>`, 2400);
                sfx.cheer();
                if (kind === "parade") sfx.whistle();
            }
            if (E.started && E.streamT > 0) {
                E.streamT -= dt;
                E.spawnAcc += dt * (kind === "marathon" ? 7 : 4.5);
                while (E.spawnAcc >= 1) { E.spawnAcc -= 1; addMarcher(); }
            }
            for (let i = E.marchers.length - 1; i >= 0; i--) {
                const m = E.marchers[i];
                m.d += m.vx * dt;
                const p = pt(m.s, m.d);
                m.x = p.x; m.z = p.z;
                m.rot = p.h + (m.vx > 0 ? -Math.PI / 2 : Math.PI / 2);
                if (Math.abs(m.d) > 10.5) { crowds[m.key].remove(m); E.marchers.splice(i, 1); }
            }
            if (E.started && E.streamT <= 0 && !E.marchers.length) E.done = true;
            // spectators cheer when Lulu's near
            E.cheerT -= dt;
            if (E.cheerT <= 0 && Math.abs(ahead) < 40) { E.cheerT = rnd(1.2, 2.4); const sp = crowds[pick(KEYS)].members.find(m => m.spectator); if (sp) bubble(pick(PARADE_CHEERS), sp, { t: 1.6, y: 2.1, cls: "pink" }); }
            for (const c of Object.values(crowds)) c.update(Math.abs(ahead) < 220 ? dt : 0);
            // waiting for the parade: +80
            if (!E.waited && E.marchers.length && ahead > 8 && ahead < 40 && car.speed < 2.5 && ctx.state === "playing") {
                E.waited = true;
                addScore(80, "parade");
                H.toast(kind === "marathon" ? "🏃 You let the runners through! +80" : "🎺 You let the parade through! +80", "gold");
                stat("parades", 1);
            }
            return car.s < s + 160;
        },
        collide(car) {
            if (!E.marchers.length || Math.abs(s - car.s) > 12) return null;
            const fx = Math.sin(car.h), fz = Math.cos(car.h);
            for (let i = E.marchers.length - 1; i >= 0; i--) {
                const m = E.marchers[i];
                for (const o of [1.4, 0, -1.2]) {
                    const dx = car.pos.x + fx * o - m.x, dz = car.pos.z + fz * o - m.z;
                    if (dx * dx + dz * dz < 1.3 * 1.3) { bonkMarcher(m, i); return null; }
                }
            }
            return null;
        },
        dispose() { P.disposePiece(); inc("parade", -1); },
    };
    // a bumped marcher becomes a real person who flips into the car (like any walker)
    function bonkMarcher(m, i) {
        crowds[m.key].remove(m);
        E.marchers.splice(i, 1);
        const person = spawnPerson(m.key, { colors: m.colors });
        place(person.obj, m.s, m.d);
        ctx.scene.add(person.obj);
        H.toast(`🤸 ${pick(KO_NAMES)}${pick(KO_LINES)}`, "pink");
        rumble(0.3, 0.6, 160);
        sfx.thud();
        count("bonks");
        const car = ctx.car;
        car.vx *= 0.95; car.vz *= 0.95;
        if ((car.speed > 30 || ctx.G.boosting) && copWitness(90) && ctx.law && ctx.law.arrest) { ctx.law.arrest(["HIT AND RUN", "RECKLESS ENDANGERMENT"], { source: "roadevents" }); ctx.scene.remove(person.obj); return; }
        // reuse the walker flight
        const from = person.obj.position.clone();
        let t = 0;
        addActor({
            update(dt) {
                t += dt;
                const k = clamp(t / 0.8, 0, 1);
                const anc = ctx.car.anchors && ctx.car.anchors.passenger;
                const to = anc ? anc.getWorldPosition(new THREE.Vector3()) : ctx.car.pos.clone();
                person.obj.position.lerpVectors(from, to, k * k * (3 - 2 * k));
                person.obj.position.y += Math.sin(Math.PI * k) * 3;
                person.obj.rotation.set(-Math.PI * 2 * k, ctx.car.h, 0, "YXZ");
                person.update(dt, { cheer: true });
                if (k >= 1) { person.obj.rotation.set(0, 0, 0); ctx.scene.remove(person.obj); seatRider(person, { who: kind }); sfx.happy(); return false; }
                return true;
            },
        });
    }
    addActor(actor);
    return E;
}
defineEvent("parade", { label: "Parade / marathon", emoji: "🎉", models: ["crowd_barrier", ...KEYS], spawn: spawnParade, setPiece: true });
