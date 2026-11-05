// features/roadevents — the TOLL-BOOTH GAUNTLET.
//
// 2D: a toll plaza across the road with 3 lanes, 1–2 of them OPEN (green light,
// gate up); a closed gate costs a heart (and smashes open); passing the plaza is
// "🎫 TOLL!" +60 and the weekly "tolls4" quest. Painted warnings: TOLL AHEAD,
// chevrons, SLOW.
// 3D: the road fans out into three booth lanes (the third on the widened right
// shoulder) under a canopy, attendants in the booths, real gate arms that fly
// off when you crash through, and traffic that funnels into the open lanes.
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { addScore, damage } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { PAY, SPAWN_CONFIG, TOLL_LINES, TOLL_CRASH } from "./config.js";
import { defineEvent, inc, live, count } from "./state.js";
import { K, M, need, place, pt, rnd, pick, claimSlot, reserve, makePiece, cloneOwn, findNodes, funnels, solid, bubble, sfx, stat, roadPaint, builtEnd, personColors, models } from "./common.js";

export const TOLL_LANES = [2.3, 6.5, 10.7];
const ISLANDS = [0.2, 4.4, 8.6, 12.8];
const ONC_ISLANDS = [-3.5, -7.4];
const EDGE = 13.6;

/** A road-surface strip whose edges vary with s: d0(s) … d1(s). */
export function varRibbon(s0, s1, d0, d1, y = 0.035, step = 2) {
    const road = ctx.world.road, p = {};
    const n = Math.max(2, Math.round((s1 - s0) / step) + 1);
    const pos = new Float32Array(n * 6), nor = new Float32Array(n * 6), uv = new Float32Array(n * 4), idx = [];
    for (let k = 0; k < n; k++) {
        const s = s0 + (s1 - s0) * k / (n - 1);
        road.point(s, d0(s), p); pos.set([p.x, y, p.z], k * 6);
        road.point(s, d1(s), p); pos.set([p.x, y, p.z], k * 6 + 3);
        nor.set([0, 1, 0, 0, 1, 0], k * 6);
        uv.set([0, s / 10, 1, s / 10], k * 4);
        if (k < n - 1) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}
let ASPHALT = null, GRAVEL = null, LINE = null;
function mats() {
    if (ASPHALT) return;
    ASPHALT = new THREE.MeshStandardMaterial({ color: "#5d6169", roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    GRAVEL = new THREE.MeshStandardMaterial({ color: "#c4b394", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    LINE = new THREE.MeshBasicMaterial({ color: "#f4f4f0", polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
}

export async function spawnToll(opts = {}) {
    await need(["toll_booth", "toll_curb", "toll_arm", "toll_canopy", "npcWoman", "npcMan"]);
    mats();
    const slot = claimSlot(150, 70, opts);
    const s = slot.s;
    const road = ctx.world.road;
    const P = makePiece("toll");
    P.later(slot.release);
    reserve(s - 130, s + 70, 1, 7, 34);
    reserve(s - 25, s + 25, -1, 7, 18);
    // which lanes are open: 1–2 of the 3 (2D)
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    const open = opts.open || order.slice(0, Math.random() < 0.5 ? 1 : 2);
    const gateS = s - 3.2;

    // the widened plaza: asphalt out to d = 13.6 with tapers, a gravel edge, lane dividers
    const edge = x => x < s - 100 ? 7 : x < s - 60 ? 7 + (EDGE - 7) * (x - (s - 100)) / 40 : x < s + 15 ? EDGE : x < s + 45 ? EDGE - (EDGE - 7) * (x - (s + 15)) / 30 : 7;
    P.add(new THREE.Mesh(P.own(varRibbon(s - 104, s + 49, () => 6.95, edge, 0.034)), ASPHALT)).receiveShadow = true;
    P.add(new THREE.Mesh(P.own(varRibbon(s - 104, s + 49, x => edge(x) - 0.02, x => edge(x) + 1.6, 0.024)), GRAVEL)).receiveShadow = true;
    for (const dl of [4.4, 8.6]) {
        for (let a = s - 56; a < s - 6; a += 6) P.add(new THREE.Mesh(P.own(varRibbon(a, a + 3, () => dl - 0.07, () => dl + 0.07, 0.04, 1.5)), LINE));
    }
    // road paint warnings (2D drawTollWarnings)
    for (const [txt, at, col] of [["TOLL AHEAD", s - 125, "#F5F5DC"], ["^", s - 100, "#F5F5DC"], ["SLOW", s - 62, "#FFE082"]]) {
        const paint = roadPaint(txt, col, 6.4, 2.4);
        place(paint, at, 3.5, 0, 0.045);
        P.add(paint);
    }
    // a big sign well before the plaza (only if that stretch isn't built yet)
    const signS = s - 330;
    let signDef = null;
    if (builtEnd() < signS - 10) {
        signDef = { s: signS, d: -10.6, lines: ["TOLL PLAZA", "¼ MILE"], bg: "#1f7a46" };
        ctx.world.addSign(signDef);
        P.later(() => { const i = ctx.world.signs.indexOf(signDef); if (i >= 0) ctx.world.signs.splice(i, 1); });
    }

    // canopy over everything
    P.add(place(models[K("toll_canopy")].clone(), s, 0));
    // booths: one on the island to the LEFT of each of our lanes (window faces the lane)
    const booths = [];
    for (let i = 0; i < 3; i++) {
        const b = cloneOwn(models[K("toll_booth")], ["LampRed", "LampGreen"]);
        place(b, s, ISLANDS[i]);
        P.add(b);
        const isOpen = open.includes(i);
        const arm = models[K("toll_arm")].clone();
        const anc = findNodes(b, "Anchor_arm")[0];
        (anc || b).add(arm);
        arm.rotation.z = isOpen ? -1.35 : 0;
        // the attendant
        const who = spawnPerson(Math.random() < 0.5 ? "npcWoman" : "npcMan", { colors: personColors() });
        const at = findNodes(b, "Anchor_attendant")[0];
        (at || b).add(who.obj);
        who.obj.rotation.y = -Math.PI / 2;
        booths.push({ i, b, arm, open: isOpen, smashed: false, who, mats: b.userData.mats, d0: ISLANDS[i] + 0.45, d1: ISLANDS[i + 1] - 0.45 });
    }
    P.add(place(models[K("toll_curb")].clone(), s, ISLANDS[3]));
    for (const d of ONC_ISLANDS) {
        const b = cloneOwn(models[K("toll_booth")], ["LampRed", "LampGreen"]);
        place(b, s, d, Math.PI);
        b.userData.mats.LampRed.emissiveIntensity = 0.1;
        b.userData.mats.LampGreen.emissiveIntensity = 3;
        const arm = models[K("toll_arm")].clone();
        const anc = findNodes(b, "Anchor_arm")[0];
        (anc || b).add(arm);
        arm.rotation.z = -1.35;
        P.add(b);
    }
    // solid bits: islands (+ booths) as rows of circles
    const solids = [];
    for (const d of ISLANDS.concat(ONC_ISLANDS)) {
        for (let a = s - 3.7; a <= s + 3.71; a += 1.0) { const p = pt(a, d); solids.push({ x: p.x, z: p.z, r: 0.5 }); }
    }
    const funnel = { s: gateS, lanes: open.map(i => TOLL_LANES[i]), len: 120, speed: 9 };
    funnels.add(funnel);
    P.later(() => funnels.delete(funnel));

    const T = { s, gateS, open, booths, paid: false, warned: false, flying: [], t: 0 };
    inc("toll");
    count("tolls");
    const actor = {
        foot: true, toll: T,
        update(dt) {
            T.t += dt;
            const car = ctx.car, ahead = s - car.s;
            // lamps: open = steady green, closed = blinking red
            const blink = Math.sin(ctx.time * 8) > 0;
            for (const bt of booths) {
                const m = bt.mats;
                const isOpen = bt.open || bt.smashed;
                m.LampGreen.emissiveIntensity = isOpen ? 3.2 : 0.1;
                m.LampRed.emissiveIntensity = isOpen ? 0.12 : blink ? 3.2 : 0.4;
                bt.who.update(dt, { talk: Math.abs(ahead) < 12, wave: bt.waveT > 0 });
                if (bt.waveT > 0) bt.waveT -= dt;
            }
            if (!T.warned && ahead < 230 && ahead > 0 && ctx.state === "playing") {
                T.warned = true;
                H.banner(`🎫 <b>TOLL AHEAD!</b><small>Pick a lane with a GREEN light</small>`, 2200);
            }
            // flying gate arms
            for (let i = T.flying.length - 1; i >= 0; i--) {
                const f = T.flying[i];
                f.t += dt;
                f.v.y -= 14 * dt;
                f.obj.position.addScaledVector(f.v, dt);
                f.obj.rotation.x += f.spin * dt; f.obj.rotation.z += f.spin * 0.7 * dt;
                if (f.obj.position.y < 0.1) { f.obj.position.y = 0.1; f.v.multiplyScalar(0.4); f.v.y = Math.abs(f.v.y) * 0.3; }
                if (f.t > 4) { P.group.remove(f.obj); T.flying.splice(i, 1); }
            }
            // crossing the gate line
            if (!T.passed && car.s > gateS && car.s < gateS + 8 && Math.abs(ahead) < 20) {
                T.passed = true;
                const bt = booths.find(b => car.d > b.d0 - 0.6 && car.d < b.d1 + 0.6);
                if (bt && !bt.open && !bt.smashed) smash(bt);
                pay(bt);
            }
            return car.s < s + 220;
        },
        collide(car) {
            if (Math.abs(s - car.s) > 14) return null;
            let worst = 0;
            for (const c of solids) {
                const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
                if (dx * dx + dz * dz > 9) continue;
                worst = Math.max(worst, solid(c.x, c.z, c.r));
            }
            if (worst > 2) return { impact: worst * 0.75, why: "Lulu vs. the toll booth: the booth won", source: "toll" };
            return null;
        },
        dispose() { P.disposePiece(); inc("toll", -1); for (const bt of booths) if (bt.who.obj.parent) bt.who.obj.parent.remove(bt.who.obj); },
    };

    function smash(bt) {
        bt.smashed = true;
        const car = ctx.car;
        const slow = car.speed < 4;
        const arm = bt.arm;
        const wp = arm.getWorldPosition(new THREE.Vector3());
        const wq = arm.getWorldQuaternion(new THREE.Quaternion());
        arm.parent.remove(arm);
        arm.position.copy(wp); arm.quaternion.copy(wq);
        P.group.add(arm);
        T.flying.push({ obj: arm, t: 0, v: new THREE.Vector3(car.vx * 0.7, 3 + car.speed * 0.15, car.vz * 0.7), spin: (Math.random() < 0.5 ? -1 : 1) * rnd(4, 8) });
        bubble(pick(TOLL_CRASH), bt.who.obj, { t: 2.4, y: 2.2, cls: "red" });
        A.sfxCrash(0.5);
        rumble(0.8, 0.8, 300, true);
        funnel.lanes.push(TOLL_LANES[bt.i]);
        count("tollGatesSmashed");
        if (!slow) damage(0.7, pick(["You were supposed to PAY!", "Ran the toll gate!", "That gate was CLOSED, Lulu!"]), "toll");
    }
    function pay(bt) {
        if (T.paid) return;
        T.paid = true;
        stat("tolls4", 1);
        addScore(PAY.toll, "toll");
        H.toast(`🎫 TOLL! +${PAY.toll}`, "gold");
        sfx.coin(6);
        rumble(0.1, 0.35, 90);
        if (bt && !bt.smashed) { bt.waveT = 2; bubble(pick(TOLL_LINES), bt.who.obj, { t: 2.4, y: 2.2, cls: "gold" }); }
    }
    addActor(actor);
    return T;
}
defineEvent("toll", { label: "Toll plaza", emoji: "🎫", models: ["toll_booth", "toll_curb", "toll_arm", "toll_canopy"], spawn: spawnToll, setPiece: true });
