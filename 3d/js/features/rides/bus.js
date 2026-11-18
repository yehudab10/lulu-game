// features/rides — 🚌 THE CITY BUS (line 18).
//
// Heavy (small cars bounce off), an air horn, and stops: a 🚏 shelter goes up on the
// right past the built road with one to three people waiting under a blue beacon.
// Stop at it and they shuffle to the front door, board and pay their fare; then the
// next stop goes up. Miss one and it's "next time, maybe". Riders only appear while
// the feature's random content is on (ctx.enabled("rides")), never in a party.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { facingRoad } from "../../world.js";
import { rumble } from "../../input.js";
import { saveSoon } from "../../core/save.js";
import * as A from "../../audio.js";
import { add, S } from "./registry.js";
import { live, partyOn, inTown, need, models, pick, rand, pt, carLocal, bubble, luluSays, toast, stat,
    borrowPerson, returnPerson, beam, slotAhead, hornGlyph } from "./common.js";
import * as T from "./lines.js";

// the next stop (obj = a pooled shelter { obj, resv, s }) and the one she just served (old)
const STOP = { phase: "off", t: 0, s: 0, obj: null, old: null, riders: [], boarded: 0 };
const SHELTERS = [];                 // free shelters (two at most ever exist)
const PEOPLE = ["npcMan", "npcWoman", "npcKid"];
const FARE = 3;
const _v = new THREE.Vector3();

add({
    id: "bus", name: "City bus", emoji: "🚌", keys: ["foot_bus"], vtype: "bus",
    handling: { top: 0.7, acc: 0.5, grip: 0.8, brake: 0.6 }, mass: 5, sturdy: 1.3, feel: "heavy",
    stops: true,
    horn: "air",
    hint: () => `Line 18! Pull into the 🚏 stops on the right and STOP — riders board and pay · small cars bounce off · ${hornGlyph()} air horn`,
    enter() {
        clear();
        STOP.phase = "wait"; STOP.t = 2.5;
        need(["rides_busstop", ...PEOPLE]).catch(() => {});
        if (Math.random() < 0.6) luluSays(pick(T.BUS_LULU));
    },
    exit() { clear(); },
    status() {
        if (STOP.phase === "waiting") return `🚏 Next stop <b>${Math.max(0, Math.round(STOP.s - ctx.car.s))} m</b>`;
        if (STOP.phase === "board") return "🚏 All aboard…";
        return "";
    },
    update(dt, R, playing) { tick(dt, playing); },
    traffic: {
        kind: "rides_bus", mix: 0.012, models: ["foot_bus"],
        spec: { len: 10.6, halfW: 1.25, circles: [-3.6, -1.2, 1.2, 3.6], r: 1.3, mass: 5, model: "foot_bus", paint: false },
        jack: { model: "foot_bus", label: "🚌 JACK THE BUS", vtype: "bus", feel: "heavy", half: 1.26, fwd: 4.3, len: 1.0, y: [0.6, 2.4], paint: "BusWhite",
            handling: { top: 0.7, acc: 0.5, grip: 0.8, brake: 0.6 } },
    },
});

function unreserve(r) { if (r) { const a = ctx.world.reserved, i = a.indexOf(r); if (i >= 0) a.splice(i, 1); } }
function dropShelter(sh) {
    if (!sh) return;
    if (sh.obj.parent) sh.obj.parent.remove(sh.obj);
    unreserve(sh.resv);
    sh.resv = null;
    SHELTERS.push(sh);
}
function dropRiders() {
    for (const r of STOP.riders) returnPerson(r.p);
    STOP.riders.length = 0;
    beam.hide();
}
function clear() {
    dropRiders();
    dropShelter(STOP.obj); STOP.obj = null;
    dropShelter(STOP.old); STOP.old = null;
    STOP.phase = "off";
}
/** The stop she just served (or missed) stays standing until it's well behind her. */
function retire() {
    dropRiders();
    if (STOP.old) dropShelter(STOP.old);
    STOP.old = STOP.obj; STOP.obj = null;
}

/** Put the next stop up the road. */
export function placeStop(minAhead = 380, at = null) {
    if (!models.rides_busstop || !models.npcMan || !models.npcWoman || !models.npcKid) return false;
    retire();
    const s = at != null ? at : slotAhead(minAhead, 1, 9, 13, 7);
    const sh = SHELTERS.pop() || { obj: models.rides_busstop.clone(), resv: null, s: 0 };
    ctx.world.reserve(s - 8, s + 8, 1, 8.9, 14);
    sh.resv = ctx.world.reserved[ctx.world.reserved.length - 1];
    sh.s = s;
    const q = pt(s, 9.4);
    sh.obj.position.set(q.x, 0, q.z);
    sh.obj.rotation.set(0, facingRoad(q.h, 1), 0);
    ctx.scene.add(sh.obj);
    STOP.obj = sh;
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
        const p = borrowPerson(pick(PEOPLE));
        if (!p) continue;
        const w = pt(s - 1 + i * 1.2, 9.9 + Math.random() * 0.5);
        p.obj.position.set(w.x, 0, w.z);
        p.obj.rotation.set(0, facingRoad(w.h, 1) + rand(-0.4, 0.4), 0);
        STOP.riders.push({ p, done: false });
    }
    const b = pt(s, 7.4);
    beam.show(b.x, b.z, "#42A5F5");
    Object.assign(STOP, { phase: "waiting", t: 0, s, boarded: 0 });
    emit("rides:busstop", { s, riders: STOP.riders.length });
    return true;
}

function tick(dt, playing) {
    const car = ctx.car;
    beam.pulse(ctx.time);
    if (inTown() && STOP.phase === "waiting") { retire(); STOP.phase = "wait"; STOP.t = 3; }
    if (STOP.old && car.s - STOP.old.s > 60) { dropShelter(STOP.old); STOP.old = null; }
    if (STOP.phase === "wait") {
        if (!playing) return;
        STOP.t -= dt;
        if (STOP.t <= 0) { if (!live() || partyOn() || inTown() || !placeStop()) STOP.t = 3; }
        return;
    }
    if (STOP.phase === "waiting") {
        for (const r of STOP.riders) r.p.update(dt, { talk: Math.sin(ctx.time * 1.7 + r.p.t) > 0.6 });
        if (!playing) return;
        const rel = STOP.s - car.s;
        if (Math.abs(rel) < 10 && car.d > 4.0 && car.speed < 2.6) { STOP.phase = "board"; STOP.t = 0; return; }
        if (rel < -30) { toast("🚏 Missed the stop! They'll catch the next one. Probably.", "red", "rides:bus"); retire(); STOP.phase = "wait"; STOP.t = 2; }
        return;
    }
    if (STOP.phase === "board") {
        STOP.t += dt;
        carLocal(-1.4, 3.9, _v);                    // the front door (the bus's right side)
        let left = 0;
        for (let i = 0; i < STOP.riders.length; i++) {
            const r = STOP.riders[i];
            if (r.done) continue;
            left++;
            if (STOP.t < i * 0.45) { r.p.update(dt, {}); continue; }
            const o = r.p.obj, dx = _v.x - o.position.x, dz = _v.z - o.position.z, d = Math.hypot(dx, dz);
            r.p.face(_v.x, _v.z, dt, 10);
            if (d > 0.5) { const st = Math.min(d, 2.4 * dt) / d; o.position.x += dx * st; o.position.z += dz * st; r.p.update(dt, { walk: 2.4 }); }
            else {
                r.done = true; o.visible = false;
                STOP.boarded++;
                if (STOP.boarded === 1) bubble(pick(T.RIDERS), car.obj, { cls: "nice", y: 3.6, dur: 2.4 });
            }
        }
        if (car.speed > 3 && STOP.t > 0.3) {   // she pulled away mid-boarding: whoever got on, paid
            for (const r of STOP.riders) if (!r.done) bubble("HEY! WAIT!", r.p.obj, { cls: "angry", y: 2, dur: 1.6 });
            pay();
            return;
        }
        if (!left || STOP.t > 8) pay();
    }
}
function pay() {
    const n = STOP.boarded;
    if (n > 0) {
        const coins = n * FARE + 2;
        addCoins(coins, "rides:bus");
        toast(`🚌 +${coins} 💰 · ${n} fare${n === 1 ? "" : "s"}`, "gold", "rides:bus");
        S.fares += n; saveSoon();
        stat("ridesFares", n);
        rumble(0.1, 0.3, 120);
        A.sfxCoin(4);
    }
    emit("rides:fares", { n });
    retire();
    STOP.phase = "wait"; STOP.t = 3;
}
// the town's street grid: shelters go, the next stop waits for the highway
on("town:enter", () => { if (STOP.phase !== "off") { clear(); STOP.phase = "wait"; STOP.t = 3; } });
export const busDebug = { STOP, placeStop };
