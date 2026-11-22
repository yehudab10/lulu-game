// features/onegame/bus.js — 🚌 DINA'S SCHOOL BUS at the door (the owner, 2026-11-22: Dina's mode is hidden — "maybe if
// Dina's school bus happens to pass by the house").
//
// Now and then, when Lulu's day starts at home (the family house on its Midwood street — features/world), the Lev Bais
// Yaakov bus comes up the street a few seconds in, pulls in at the kerb in front of the house, flashes its lights and
// opens its door. Walk up: ✋ "🚌 Hop on with Dina" → Dina's mode, straight into her bus ride + the race home
// (features/dina; leaving her picker brings Lulu back home — onegame). Ignore it and after a while the door closes and
// it drives off. Nothing on the HUD, no toast, no beacon: a nice surprise, never a nag.
//
// Rare by design: BUS.chance per home start, never a player's first day, never on Friday's rush, never in a party, at
// most once a real day (whether she hops on or not). Test hook: ctx.onegame.bus { force(), state() }.
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { models, ensureModels, cloneWithColors } from "../../models.js";
import { home } from "../world/home.js";
import { ONEGAME } from "./switches.js";

/** Tuning: chance per home start · seconds before it shows · how long it waits at the kerb · run-up (m) · speeds. */
export const BUS = { chance: 0.12, delay: [4, 8], wait: 24, approach: 38, speed: 9, along: -6.6, lean: 1.45 };
const BS = store("onegameBus", { day: "", seen: 0, rode: 0 });
const K = { phase: "off", t: 0, obj: null, door: null, arm: null, step: null, wheels: [], mats: [], stop: new THREE.Vector3(), fwd: new THREE.Vector3(), side: new THREE.Vector3(), h: 0, x: 0, v: 0, open: 0, force: false, doorAt: new THREE.Vector3() };
const v1 = new THREE.Vector3();
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const solo = () => !(ctx.party && ctx.party.active) && !(ctx.G && ctx.G.mode === "party");

/** Where it stops: in the parking lane in front of the house (the lot's kerb is kept clear of parked cars — features/town),
 *  just short of the driveway; its door toward the house. */
function plan() {
    const L = home.lotSpot;
    if (!L || home.site !== "town") return false;
    const nx = L.nx, nz = L.nz, ux = L.ux, uz = L.uz;
    // (the kerb in front of the driveway; a lot without one: 8.6 m out from the drive — town/plan.js FRONT − CURB + 3.2)
    const kb = L.kerb || (L.drive && { x: L.drive.x + nx * 8.6, z: L.drive.z + nz * 8.6 });
    if (!kb) return false;
    K.stop.set(kb.x + nx * BUS.lean + ux * BUS.along, 0, kb.z + nz * BUS.lean + uz * BUS.along);
    // its door is on its right (−x of a bus driving +z, features/dina/bus.js): facing along the street with the door to the house
    K.h = Math.atan2(-nz, nx);
    K.fwd.set(Math.sin(K.h), 0, Math.cos(K.h));
    K.side.set(nx, 0, nz);
    return true;
}
function build() {
    const src = models.dinaBus;
    if (!src || !home.ready) return false;
    const bus = cloneWithColors(src);
    bus.name = "OneGameDinaBus";
    K.mats = [];
    bus.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        if (/LightRed|NeonAmber/.test(o.material.name)) { o.material = o.material.clone(); K.mats.push(o.material); }
    });
    const node = n => bus.getObjectByName(n);
    K.door = node("Door"); K.arm = node("StopArm"); K.step = node("DoorStep");
    K.wheels = ["Wheel_FL", "Wheel_FR", "Wheel_RL", "Wheel_RR"].map(node).filter(Boolean);
    bus.rotation.y = K.h;
    ctx.scene.add(bus);
    K.obj = bus;
    return true;
}
function stop() {
    if (K.obj) {
        K.obj.removeFromParent();
        for (const m of K.mats) m.dispose();
    }
    K.obj = null; K.mats = []; K.phase = "off"; K.t = 0; K.open = 0;
}
function place() {
    const b = K.obj;
    // (x: metres along the street from the stop — negative before it, positive after)
    b.position.set(K.stop.x + K.fwd.x * K.x, 0, K.stop.z + K.fwd.z * K.x);
    if (K.door) K.door.rotation.y = 1.3 * K.open;
    if (K.arm) K.arm.rotation.y = -Math.PI / 2 * K.open;
}

/** Should the bus come today? (called at every home start) */
function roll(e) {
    if (K.phase !== "off") stop();
    if (!e || e.mode !== "cruise" || e.first || e.friday || e.via === "startAt") return;
    if (!solo() || !ctx.dina || !ctx.dina.start || !ctx.enabled("dina") || !home.ready || home.site !== "town") return;
    if (!K.force && (BS.day === today() || Math.random() >= BUS.chance)) return;
    K.force = false;
    if (!plan()) return;
    K.phase = "due"; K.t = BUS.delay[0] + Math.random() * (BUS.delay[1] - BUS.delay[0]);
    ensureModels(["dinaBus"]).catch(() => stop());
}
on("world:homeStart", roll);
on("state", ({ to }) => { if (K.phase !== "off" && to !== "footRun" && to !== "worldPullOut" && to !== "playing" && to !== "paused") stop(); });
on("run:end", () => stop());
on("world:homeBuilt", () => stop());

hook("update", dt => {
    if (K.phase === "off") return;
    // (she's gone — left town, or far off down the street: no bus left behind)
    if (!home.ready || !(ctx.town && ctx.town.active && ctx.town.id === home.town)) { stop(); return; }
    K.t -= dt;
    if (K.phase === "due") {
        if (K.t > 0) return;
        if (!K.obj && !build()) { K.t = 0.5; return; }
        BS.day = today(); BS.seen++; saveSoon();
        K.phase = "in"; K.x = -BUS.approach; K.v = BUS.speed; K.open = 0;
    }
    if (K.phase === "in") {
        // ease in to the kerb: slows to a stop at x = 0
        K.v = Math.max(0.6, Math.min(BUS.speed, Math.sqrt(2 * 2.2 * Math.max(0, -K.x))));
        K.x = Math.min(0, K.x + K.v * dt);
        if (K.x >= -0.01) { K.x = 0; K.v = 0; K.phase = "open"; K.t = BUS.wait; sayDina(); }
    } else if (K.phase === "open") {
        K.open = Math.min(1, K.open + dt / 0.5);
        if (K.t <= 0 || farAway()) { K.phase = "close"; K.t = 0.5; }
    } else if (K.phase === "close") {
        K.open = Math.max(0, K.open - dt / 0.45);
        if (K.t <= 0) { K.phase = "out"; K.v = 0; }
    } else if (K.phase === "out") {
        K.v = Math.min(14, K.v + 4 * dt);
        K.x += K.v * dt;
        if (K.x > 70) { stop(); return; }
    }
    for (const w of K.wheels) w.rotation.x += K.v * dt / 0.52;
    const blink = Math.sin(ctx.time * 9) > 0;
    for (const m of K.mats) m.emissiveIntensity = K.phase === "open" ? (blink ? 3 : 0.25) : K.phase === "in" ? (blink ? 2.4 : 0.3) : 0.25;
    place();
}, -40);
const farAway = () => {
    const c = ctx.car.pos;
    return ctx.state !== "footRun" ? Math.hypot(c.x - K.stop.x, c.z - K.stop.z) > 45 : Math.hypot(c.x - K.stop.x, c.z - K.stop.z) > 70;
};
/** Dina on the porch notices it (a bubble over her — nothing on the HUD). */
function sayDina() {
    const d = home.people && home.people.dina;
    if (ctx.foot && ctx.foot.say && d && d.obj && d.obj.visible && ctx.state === "footRun") ctx.foot.say(d.obj, ["MY BUS!! Lulu, come on! 🚌", "It's the BUS! Ride with me, Lulu! 🎒"][Math.random() < 0.5 ? 0 : 1], 2.2, { y: 1.3 });
}

// ✋ at the bus door
const busSpot = {
    r: 2.2,
    pos: () => {
        if (K.phase !== "open" || K.open < 0.6 || ctx.state !== "footRun" || !K.obj) return null;
        K.obj.updateMatrixWorld(true);
        if (K.step) K.step.getWorldPosition(K.doorAt); else K.doorAt.copy(K.stop).addScaledVector(K.side, -1.6);
        K.doorAt.y = 0;
        return K.doorAt;
    },
    label: "🚌 Hop on with Dina",
    short: "BUS",
    act: () => hop(),
};
function hop() {
    if (K.phase !== "open" || !ctx.onegame || !ctx.onegame.dina) return false;
    BS.rode++; saveSoon();
    K.phase = "close"; K.t = 0.5;
    return ctx.onegame.dina({ via: "bus" });
}
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(busSpot); });

export const busApi = {
    /** The next home start brings the bus (tests; ONEGAME's preview). */
    force() { K.force = true; return true; },
    state: () => ({ phase: K.phase, x: +K.x.toFixed(2), open: +K.open.toFixed(2), at: K.obj ? { x: +K.obj.position.x.toFixed(2), z: +K.obj.position.z.toFixed(2) } : null, stop: { x: +K.stop.x.toFixed(2), z: +K.stop.z.toFixed(2) }, ...BS }),
    hop, stop, K, BUS, ONEGAME,
};
