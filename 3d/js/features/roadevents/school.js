// features/roadevents — SCHOOL stuff: the stopped school bus (stop arm out,
// red lights flashing, kids getting off — and sometimes DINA waiting, +60), the
// crossing guard with kids in the crosswalk, and yellow school buses in traffic
// (with the odd field-trip convoy). Pass a stopped bus / a crossing guard slowly
// (+40) — blow past and, if a cop sees it, that's a chase.
import * as THREE from "three";
import { ctx, emit, addActor } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { registerKind } from "../../traffic.js";
import { input, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { PAY, BUS_QUIPS, BUS_STOP_QUIPS, COP_BUS_SNARK, GUARD_QUIPS } from "./config.js";
import { defineEvent, inc, count, R } from "./state.js";
import { K, need, pt, place, rnd, rint, pick, clamp, claimSlot, reserve, makePiece, cloneOwn, findNodes, blockers, bubble, marker, sfx, stat, personColors, copWitness, solid, roadPaint, models, cloneWithColors } from "./common.js";
import { addPed, seatRider } from "./passengers.js";

registerKind("roadevents_bus", { len: 10.6, halfW: 1.25, circles: [-3.6, -1.2, 1.2, 3.6], r: 1.3, mass: 5, model: K("school_bus"), paint: false });

const slowEnough = () => ctx.car.speed < 11.2 || input.brake > 0.5;   // ≈ 25 mph, or on the brakes

// ── the stopped school bus ─────────────────────────────────────────────────
export async function spawnBusStop(opts = {}) {
    await need(["school_bus", "npcKid", "dinaPerson"]);
    const slot = claimSlot(40, 30, opts);
    const s = slot.s;
    const P = makePiece("busStop");
    P.later(slot.release);
    reserve(s - 30, s + 30, 1, 8.8, 16);
    const bus = cloneOwn(models[K("school_bus")], ["LightRed"]);
    place(bus, s, 7.5, 0);
    P.add(bus);
    const arm = findNodes(bus, "StopArm")[0];
    const lamps = bus.userData.mats.LightRed;
    // kids getting off on the curb side
    const kids = [];
    for (let i = 0, n = rint(2, 4); i < n; i++) {
        const k = spawnPerson("npcKid", { colors: personColors() });
        place(k.obj, s - 3.5 + rnd(-1.5, 1.5), rnd(9.5, 11.5), -Math.PI / 2 + rnd(-0.8, 0.8));
        P.add(k.obj);
        kids.push({ p: k, vd: rnd(0.4, 0.8) });
    }
    const hasDina = opts.dina != null ? opts.dina : Math.random() < 0.3;
    let dina = null, dinaMark = null;
    if (hasDina) {
        dina = spawnPerson("dinaPerson");
        place(dina.obj, s - 13, 6.1, Math.PI);
        P.add(dina.obj);
        dinaMark = marker("👧 <small>DINA!</small>", dina.obj, 1.9);
        P.later(() => dinaMark && dinaMark.remove());
    }
    const solids = [];
    for (let a = -4.6; a <= 4.61; a += 2.3) solids.push({ ...pt(s + a, 7.5), r: 1.3 });
    const E = { s, signOut: true, checked: false, violated: false, dinaTaken: false, t: 0, armK: 0, stopT: 0, leaving: 0 };
    const blk = { s: s - 9, d0: 0, d1: 8, dir: 1, reach: 50, active: () => E.signOut };
    blockers.add(blk);
    P.later(() => blockers.delete(blk));
    inc("busStop");
    count("busStops");
    addActor({
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car, ahead = s - car.s;
            E.armK += Math.sign((E.signOut ? 1 : 0) - E.armK) * Math.min(Math.abs((E.signOut ? 1 : 0) - E.armK), dt * 2);
            if (arm) arm.rotation.y = E.armK * Math.PI / 2;
            const flash = Math.sin(E.t * 12) > 0;
            if (lamps) lamps.emissiveIntensity = E.signOut ? (flash ? 4 : 0.2) : 0.2;
            for (const k of kids) {
                k.p.update(dt, { walk: E.signOut ? k.vd : 0, wave: !E.signOut });
                if (E.signOut) { k.p.obj.translateZ(k.vd * dt * 0.4); }
            }
            if (dina && !E.dinaTaken) {
                dina.update(dt, { wave: true });
                dina.face(car.pos.x, car.pos.z, dt, 3);
                if (Math.abs(s - 13 - car.s) < 4.5 && car.d > 3.6 && ctx.state === "playing") {
                    E.dinaTaken = true;
                    dinaMark.remove(); dinaMark = null;
                    addCoins(PAY.busStopDina, "dina");
                    addScore(300, "dina");
                    H.toast(`👧 Got Dina! +${PAY.busStopDina}`, "gold");
                    sfx.buy();
                    rumble(0.2, 0.6, 160);
                    P.group.remove(dina.obj);
                    seatRider(dina, { bonus: false, keep: false, who: "dina", scale: 0.95 });
                    stat("dinaPickups", 1);
                    emit("roadevents:dina", {});
                }
            }
            // she stopped behind the bus → the driver pulls the arm in and waves her on
            if (E.signOut && ahead > 3 && ahead < 40 && car.speed < 1.5) {
                E.stopT += dt;
                if (E.stopT > 2.2) {
                    E.signOut = false;
                    if (!E.checked) { E.checked = true; addScore(PAY.safeStop, "busStop"); H.toast(`🛑 Safe stop! +${PAY.safeStop}`, "gold"); stat("safeStops", 1); }
                }
            }
            // passing the bus: did she slow down?
            if (!E.checked && car.s > s && car.s < s + 12 && ctx.state === "playing") {
                E.checked = true;
                if (E.signOut && !slowEnough()) {
                    E.violated = true;
                    bubble(pick(BUS_STOP_QUIPS), bus, { t: 2.4, y: 3.6, cls: "red" });
                    count("busViolations");
                    const cop = copWitness(120);
                    if (cop) {
                        H.toast(`🚨 ${pick(COP_BUS_SNARK)}`, "red");
                        if (ctx.law && ctx.law.startChase) ctx.law.startChase("busStop");
                        emit("roadevents:witnessed", { what: "busStop", charges: ["PASSING A STOPPED SCHOOL BUS"] });
                    }
                } else if (E.signOut) {
                    addScore(PAY.safeStop, "busStop");
                    H.toast(`🛑 Safe stop! +${PAY.safeStop}`, "gold");
                    stat("safeStops", 1);
                }
            }
            if (car.s > s + 6 && E.signOut && E.checked) E.signOut = false;
            return car.s < s + 160;
        },
        collide(car) {
            if (Math.abs(s - car.s) > 9) return null;
            let w = 0;
            for (const c of solids) { const dx = c.x - car.pos.x, dz = c.z - car.pos.z; if (dx * dx + dz * dz < 12) w = Math.max(w, solid(c.x, c.z, c.r)); }
            return w > 2 ? { impact: w * 0.9, why: "You hit a SCHOOL BUS?! Oy.", source: "bus" } : null;
        },
        dispose() { P.disposePiece(); inc("busStop", -1); },
    });
    return E;
}
defineEvent("busStop", { label: "Stopped school bus", emoji: "🚌", models: ["school_bus", "npcKid", "dinaPerson"], spawn: spawnBusStop, setPiece: true });

// ── the crossing guard ─────────────────────────────────────────────────────
export async function spawnCrossingGuard(opts = {}) {
    await need(["roadevents_worker", "stop_paddle", "npcKid"]);
    const slot = claimSlot(30, 25, opts);
    const s = slot.s, side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const P = makePiece("guard");
    P.later(slot.release);
    // a zebra crosswalk
    const stripeMat = P.own(new THREE.MeshBasicMaterial({ color: "#f4f4f0", polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const stripeGeo = P.own(new THREE.PlaneGeometry(0.55, 3.2));
    for (let dd = -6.5; dd <= 6.6; dd += 1.1) {
        const m = new THREE.Mesh(stripeGeo, stripeMat);
        m.rotation.x = -Math.PI / 2;
        const g = place(new THREE.Group(), s, dd, 0, 0.042);
        g.add(m);
        P.add(g);
    }
    const paint = roadPaint("SCHOOL", "#F5F5DC", 6.4, 2.4);
    place(paint, s - 45, 3.5, 0, 0.045);
    P.add(paint);
    const guard = spawnPerson(K("worker"), { colors: { Top: "#FF7043", Hat: "#FBC02D" } });
    place(guard.obj, s - 2, side * 7.6, side > 0 ? Math.PI / 2 + 0.6 : -Math.PI / 2 - 0.6);
    P.add(guard.obj);
    const paddle = cloneWithColors(models[K("stop_paddle")]);
    const armR = findNodes(guard.obj, "Arm_R")[0];
    if (armR) { armR.add(paddle); paddle.position.set(0, -0.46, 0.05); paddle.rotation.x = Math.PI / 2; }
    // kids crossing in the crosswalk
    const kids = [];
    const E = { s, side, checked: false, t: 0, kids, done: false };
    for (let i = 0, n = rint(2, 3); i < n; i++) {
        const ped = addPed({ s: s + rnd(-1.2, 1.2), d: side * rnd(8, 10.5) + (i * side * 1.2), vx: -side * rnd(1.0, 1.4), kind: "kid", model: "npcKid" });
        if (ped) kids.push(ped);
    }
    const onRoad = () => kids.some(k => !k.gone && Math.abs(k.d) < 8);
    const b1 = { s: s - 6, d0: -8, d1: 8, dir: 1, reach: 55, active: onRoad }, b2 = { s: s + 6, d0: -8, d1: 8, dir: -1, reach: 55, active: onRoad };
    blockers.add(b1); blockers.add(b2);
    P.later(() => { blockers.delete(b1); blockers.delete(b2); });
    inc("guard");
    count("guards");
    addActor({
        foot: true, ev: E,
        update(dt) {
            E.t += dt;
            const car = ctx.car, ahead = s - car.s;
            guard.update(dt, { point: true, talk: ahead < 40 && ahead > 0 });
            if (armR) armR.rotation.x -= 0.7;     // paddle up high
            if (!E.checked && car.s > s && car.s < s + 10 && ctx.state === "playing") {
                E.checked = true;
                if (!slowEnough()) {
                    bubble(pick(GUARD_QUIPS), guard.obj, { t: 2.4, y: 2.2, cls: "red" });
                    count("guardViolations");
                    if (copWitness(120)) {
                        H.toast(`🚨 ${pick(COP_BUS_SNARK)}`, "red");
                        if (ctx.law && ctx.law.startChase) ctx.law.startChase("crossingGuard");
                        emit("roadevents:witnessed", { what: "crossingGuard", charges: ["BLOWING PAST A CROSSING GUARD"] });
                    }
                } else {
                    addScore(PAY.safeStop, "guard");
                    H.toast(`🛑 Thanks, driver! +${PAY.safeStop}`, "gold");
                    bubble("Thanks, driver! 👋", guard.obj, { t: 2, y: 2.2, cls: "gold" });
                    stat("safeStops", 1);
                }
            }
            return car.s < s + 150;
        },
        dispose() { P.disposePiece(); inc("guard", -1); },
    });
    return E;
}
defineEvent("crossingGuard", { label: "Crossing guard", emoji: "🦺", models: ["worker", "stop_paddle", "npcKid"], spawn: spawnCrossingGuard, setPiece: true });

// ── school buses in traffic ────────────────────────────────────────────────
export async function spawnSchoolBus(opts = {}) {
    await need(["school_bus"]);
    const car = ctx.car;
    const s = opts.s != null ? opts.s : car.s + rnd(300, 420);
    const d = opts.d != null ? opts.d : pick([1.75, 5.25]);
    if (!ctx.traffic.laneFree(s, d, 1, 30)) return null;
    const c = ctx.traffic.add("roadevents_bus", s, d, 1, opts.speed || rnd(11, 13), { data: { bus: true, quipT: 0 } });
    count("schoolBuses");
    return c;
}
defineEvent("schoolBus", { label: "School bus", emoji: "🚌", models: ["school_bus"], spawn: spawnSchoolBus });

/** Bus chatter (2D BUS_QUIPS, "by chance" when you're close). */
export function busChatter(dt) {
    for (const c of ctx.traffic.cars) {
        if (c.kind !== "roadevents_bus" || c.hit) continue;
        if (Math.abs(c.s - ctx.car.s) < 22 && Math.random() < dt * 0.4) bubble(pick(BUS_QUIPS), c.obj, { t: 2, y: 3.6 });
    }
}
