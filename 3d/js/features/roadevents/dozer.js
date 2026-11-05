// features/roadevents — the STEAMROLLER.
//
// 2D: a steamroller sits parked in a coned-off work zone — drive into it to
// COMMANDEER it. It's SLOW (≈ 45 mph) but FLATTENS any car it touches ("SPLAT!",
// "PANCAKED! 🥞" +60, +3 💰), rolls over cones, and has 13 s of diesel. If a cop
// sees (or you flatten a cruiser) → VEHICULAR DESTRUCTION, chase. Steamrollers
// also trundle along in construction traffic (and, rarely, anywhere).
// 3D: Lulu's car is swapped for the roller (drum spinning, beacon flashing), she
// sits up in the cab, and flattened cars stay behind as pancakes for 6 s.
import * as THREE from "three";
import { ctx, on, emit, hook, addActor } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { registerKind } from "../../traffic.js";
import { shared } from "../../core/save.js";
import { input, rumble, glyph, addTouchButton } from "../../input.js";
import * as H from "../../hud.js";
import { PAY, DOZER_TOP, CRUSH_LINES } from "./config.js";
import { defineEvent, inc, count } from "./state.js";
import { K, need, pt, place, rnd, pick, clamp, claimSlot, reserve, findNodes, marker, sfx, stat, burst, smoke, loop, copWitness, models, cloneWithColors } from "./common.js";
import { addCone } from "./construction.js";

const drivers = new WeakSet();   // pooled roller objects that already have a worker in the cab
let nearRoller = false;
let touchBtn = null;
export const D = { active: false, t: 0, max: PAY.dozerSecs, obj: null, lulu: null, stats: null, pre: { vx: 0, vz: 0 }, chased: false, loop: null, drum: null };

registerKind("roadevents_roller", { len: 4.8, halfW: 1.15, circles: [1.5, -1.0], r: 1.2, mass: 6, model: K("steamroller"), paint: false });

let beacon = null;
function beaconMat() {
    if (beacon !== null) return beacon;
    const tpl = models[K("steamroller")];
    if (!tpl) return null;
    beacon = [];
    tpl.traverse(o => { if (o.isMesh && o.material.name === "NeonAmber" && !beacon.includes(o.material)) beacon.push(o.material); });
    return beacon;
}
export function blinkBeacons(t) { const b = beaconMat(); if (b) for (const m of b) m.emissiveIntensity = Math.sin(t * 9) > 0 ? 3.2 : 0.3; }

// ── a parked steamroller you can commandeer ────────────────────────────────
export async function spawnParkedRoller(opts = {}) {
    await need(["steamroller", "cone", "luluPerson"]);
    const slot = claimSlot(30, 30, opts);
    const s = slot.s, d = opts.d || 10.6;
    reserve(s - 25, s + 25, 1, 8.8, 15);
    const obj = cloneWithColors(models[K("steamroller")]);
    place(obj, s, d, 0);
    ctx.scene.add(obj);
    for (const [a, b] of [[-3.6, -1.9], [-3.6, 1.9], [3.4, -1.9], [3.4, 1.9]]) addCone(s + a, d + b, { zone: true });
    const label = marker("🚜 <small>DRIVE IN!</small>", obj, 4.2);
    const E = { s, d, taken: false, t: 0, prompted: false };
    inc("steamroller");
    count("rollersParked");
    addActor({
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car, ahead = s - car.s;
            if (E.taken) return car.s < s + 60;
            label.el.style.visibility = Math.sin(E.t * 6) > -0.3 ? "visible" : "hidden";
            const dx = obj.position.x - car.pos.x, dz = obj.position.z - car.pos.z, dist = Math.hypot(dx, dz);
            const near = ahead > -6 && ahead < 45 && ctx.state === "playing" && !D.active;
            nearRoller = near;
            if (!touchBtn) touchBtn = addTouchButton({ id: "re_roller", emoji: "🚜", label: "HOP IN", action: "interact", visible: () => nearRoller && ctx.state === "playing" });
            if (near) H.prompt(`🚜 Drive into the steamroller — or ${glyph("interact")} — to commandeer it!`);
            else if (E.prompted) H.prompt("");
            E.prompted = near;
            if (near && (dist < 4.4 || (input.pressed.interact && dist < 14))) {
                E.taken = true;
                nearRoller = false;
                H.prompt("");
                label.remove();
                obj.visible = false;
                commandeer();
            }
            return car.s < s + 160;
        },
        dispose() { nearRoller = false; if (obj.parent) obj.parent.remove(obj); label.remove(); slot.release(); inc("steamroller", -1); if (E.prompted) H.prompt(""); },
    });
    return E;
}
defineEvent("steamroller", { label: "Steamroller (commandeer)", emoji: "🚜", models: ["steamroller", "cone"], spawn: spawnParkedRoller, setPiece: true });

/** Lulu climbs into the steamroller (her car becomes it until the diesel runs out). */
export function commandeer() {
    if (D.active) return;
    const car = ctx.car, G = ctx.G;
    D.active = true;
    D.t = D.max = PAY.dozerSecs;
    D.chased = false;
    D.stats = car.stats;
    car.stats = Object.assign({}, car.stats, { top: DOZER_TOP / 42, acc: 0.8, grip: 1.25, brake: 1.3 });
    if (car.model) car.model.visible = false;
    D.obj = cloneWithColors(models[K("steamroller")]);
    D.obj.position.set(0, 0, 0.3);
    car.tilt.add(D.obj);
    D.drum = findNodes(D.obj, "Wheel_F")[0] || null;
    D.rear = findNodes(D.obj, "Wheel_R");
    const hair = shared.get().luluHair;
    D.lulu = spawnPerson("luluPerson", { colors: hair ? { Hair: hair } : null });
    const seatA = findNodes(D.obj, "Anchor_seat")[0];
    (seatA || D.obj).add(D.lulu.obj);
    D.lulu.obj.position.set(0, -0.36, 0);
    G.noBoost = true;
    G.invT = Math.max(G.invT, 0.4);
    H.toast("🚜 STEAMROLLER!", "big");
    H.banner(`🚜 <b>STEAMROLLER!</b><small>CRUSH everything! (slow though)</small>`, 2200);
    sfx.engine(70);
    rumble(0.8, 0.6, 400, true);
    D.loop = loop(70);
    if (ctx.roadevents) ctx.roadevents.vehicle = "steamroller";
    stat("steamrollers", 1);
    count("steamrollers");
    emit("roadevents:steamroller", { active: true });
}
/** Out of diesel (or the run changed): back to her own car. */
export function endDozer(msg) {
    if (!D.active) return;
    D.active = false;
    const car = ctx.car, G = ctx.G;
    if (D.stats) car.stats = D.stats;
    if (car.model) car.model.visible = true;
    if (D.obj && D.obj.parent) D.obj.parent.remove(D.obj);
    if (D.lulu && D.lulu.obj.parent) D.lulu.obj.parent.remove(D.lulu.obj);
    if (D.loop) { D.loop.stop(); D.loop = null; }
    G.noBoost = false;
    if (ctx.roadevents) ctx.roadevents.vehicle = null;
    emit("roadevents:steamroller", { active: false });
    if (msg === null) { D.obj = null; return; }
    G.invT = Math.max(G.invT, 1.2);
    // the empty roller stays behind, parked where she hopped out
    const left = cloneWithColors(models[K("steamroller")]);
    left.position.set(car.pos.x, 0, car.pos.z);
    left.rotation.y = car.h;
    ctx.scene.add(left);
    const s = car.s;
    addActor({ update() { return ctx.car.s - s < 120; }, dispose() { if (left.parent) left.parent.remove(left); } });
    for (let i = 0; i < 4; i++) smoke(car.pos.x, 1, car.pos.z, 3, [0.8, 0.78, 0.7]);
    H.toast(msg || "⛽ Out of diesel — back to your car!", "gold");
    sfx.pop();
    D.obj = null;
}

// keep her momentum through the crunch (the roller doesn't bounce off cars)
hook("controls", () => { if (D.active) { D.pre.vx = ctx.car.vx; D.pre.vz = ctx.car.vz; } }, 5);
hook("damage", info => (D.active && info.source !== "train" ? false : undefined), 60);
on("crash", e => {
    if (!D.active || !e.car || !ctx.traffic.cars.includes(e.car)) return;
    const c = e.car;
    c.onCrash = () => false;
    flatten(c);
    const car = ctx.car;
    car.vx = D.pre.vx * 0.93; car.vz = D.pre.vz * 0.93;
    car.spin *= 0.2;
});
on("wreck", () => endDozer(null));
on("state", ({ to }) => { if (D.active && !["playing", "intro", "arriving", "wrecked"].includes(to)) endDozer(null); });

function flatten(c) {
    const flat = c.obj.clone();
    flat.position.copy(c.obj.position);
    flat.rotation.copy(c.obj.rotation);
    flat.scale.set(1.14, 0.14, 1.06);
    ctx.scene.add(flat);
    const s = c.s;
    let t = 0;
    addActor({ update(dt) { t += dt; return t < 6 && ctx.car.s - s < 140; }, dispose() { if (flat.parent) flat.parent.remove(flat); } });
    burst(c.x, 0.6, c.z, 22, 5, [0.85, 0.85, 0.85], 0.5, 0.7);
    burst(c.x, 0.4, c.z, 10, 3, [1, 0.75, 0.3], 0.4, 0.5);
    sfx.crunch();
    rumble(0.9, 0.6, 220, true);
    ctx.G.shake = Math.max(ctx.G.shake || 0, 0.4);
    addScore(PAY.crushScore, "crush");
    addCoins(PAY.crushCoins, "crush");
    H.toast(`${pick(CRUSH_LINES)} +${PAY.crushScore}`, "red");
    count("crushes");
    stat("crushes", 1);
    emit("roadevents:crush", { kind: c.kind });
    const cop = c.kind === "cop" || (c.data && c.data.cop);
    ctx.traffic.remove(c);
    if (!D.chased && (cop || copWitness(110))) {
        D.chased = true;
        H.toast("🚨 VEHICULAR DESTRUCTION!", "red");
        if (ctx.law && ctx.law.startChase) ctx.law.startChase("steamroller");
        emit("roadevents:witnessed", { what: "steamroller", charges: ["VEHICULAR DESTRUCTION", "JOYRIDING A STEAMROLLER"] });
    }
}

/** Per-frame while driving (from index.js). */
export function updateDozer(dt, controlsOn) {
    blinkBeacons(ctx.time);
    if (!D.active) return;
    const car = ctx.car;
    if (car.model && car.model.visible) car.model.visible = false;
    if (D.drum) D.drum.rotation.x += car.vF * dt / 0.72;
    for (const w of D.rear || []) w.rotation.x += car.vF * dt / 0.62;
    if (D.lulu) D.lulu.update(dt, { sit: true, cheer: D.cheerT > 0 });
    if (D.cheerT > 0) D.cheerT -= dt;
    if (D.loop) D.loop.set(0.18 + clamp(car.speed / DOZER_TOP, 0, 1) * 0.2, 55 + car.speed * 4);
    if (Math.random() < 0.25) {
        const v = new THREE.Vector3(-0.62, 3.1, -1.4);
        D.obj.localToWorld(v);
        smoke(v.x, v.y, v.z, 1, [0.4, 0.4, 0.42]);
    }
    if (controlsOn) {
        D.t -= dt;
        if (D.t <= 0) endDozer();
    }
}

// ── a steamroller trundling along in traffic ───────────────────────────────
export async function spawnRollerNpc(opts = {}) {
    await need(["steamroller", "roadevents_worker"]);
    const car = ctx.car;
    const s = opts.s != null ? opts.s : car.s + rnd(260, 380);
    const d = opts.d != null ? opts.d : pick([1.75, 5.25]);
    const c = ctx.traffic.add("roadevents_roller", s, d, 1, opts.speed || rnd(3.5, 5), { immune: true, data: { roller: true } });
    if (!drivers.has(c.obj)) {
        const drv = spawnPerson(K("worker"));
        const seatA = findNodes(c.obj, "Anchor_seat")[0];
        (seatA || c.obj).add(drv.obj);
        drv.obj.position.set(0, -0.36, 0);
        drv.update(0, { sit: true });
        drivers.add(c.obj);
    }
    count("rollersNpc");
    return c;
}
defineEvent("rollerNpc", { label: "Steamroller in traffic", emoji: "🚧", models: ["steamroller", "worker"], spawn: spawnRollerNpc });
