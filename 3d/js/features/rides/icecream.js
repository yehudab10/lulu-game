// features/rides — 🍦 THE ICE-CREAM TRUCK.
//
// Horn = the jingle. Pull over onto the right side, stop, play it — and kids come
// running from the sidewalk to the serving window (the truck's right side), pay,
// get a cone, and skip off. A few per spot ("out of sprinkles here"), then drive on.
// Drive off while they're running and they're heartbroken. Kids only come while the
// feature's random content is on (ctx.enabled("rides")), never in a party.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { rumble } from "../../input.js";
import { saveSoon } from "../../core/save.js";
import * as A from "../../audio.js";
import { add, HORN_KINDS, S } from "./registry.js";
import { live, partyOn, inTown, need, models, pick, rand, pt, carLocal, bubble, luluSays, toast, stat,
    borrowPerson, returnPerson, hornGlyph } from "./common.js";
import * as T from "./lines.js";

const KIDS = [];                     // { p, phase: "run" | "buy" | "leave", t, s, said }
const CONES = [];                    // pooled cone props
const _v = new THREE.Vector3();
const PAY = 3;

HORN_KINDS.jingle = R => {
    const car = ctx.car, d = R.data;
    if (A.spatial && A.spatial.ready) A.spatial.play("jingle", car.obj, { gain: 1.3, key: "rides-jingle" });
    d.jingleT = 10;
    bubble(pick(["♪ ♫ ♪", "♫ ♪ ♫", "♪ ♪ ♫"]), car.obj, { cls: "kid", y: 5.9, dur: 2 });
    rumble(0.05, 0.25, 120);
    const parked = car.speed < 3 && car.d > 3.2;
    if (!parked) { if (!d.toldPark) { d.toldPark = true; toast(T.PULL_OVER_FIRST, "", "rides:ice"); } }
    else if (d.served >= d.cap) toast(T.SOLD_OUT, "", "rides:ice");
    else if (Math.random() < 0.45) luluSays(pick(T.JINGLE_LULU));
    emit("rides:jingle", { parked });
};

add({
    id: "icecream", name: "Ice-cream truck", emoji: "🍦", keys: ["journey_icecream"],
    handling: { top: 0.68, acc: 0.6, grip: 0.85, brake: 0.7 }, mass: 3.2, sturdy: 1.0, feel: "heavy",
    stops: true,
    horn: "jingle",
    hint: () => `Pull over to the right, STOP and ${hornGlyph()} play the jingle — kids come running with coins 🪙`,
    enter(R) {
        Object.assign(R.data, { jingleT: 0, served: 0, cap: 4, stopS: ctx.car.s, spawnT: 0.3, toldPark: false, coming: 0 });
        need(["npcKid", "rides_cone"]).catch(() => {});
    },
    exit() { clearKids(); },
    status(R) {
        const d = R.data;
        if (!KIDS.length && !(d.jingleT > 0 && d.served)) return "";
        return `🍦 <b>${d.served}</b>/${d.cap} cones`;
    },
    update(dt, R, playing) {
        const car = ctx.car, d = R.data;
        if (d.jingleT > 0) d.jingleT -= dt;
        if (Math.abs(car.s - d.stopS) > 120) { d.stopS = car.s; d.served = 0; d.cap = 3 + Math.floor(Math.random() * 3); }
        const parked = car.speed < 1.4 && car.d > 3.2;
        if (playing && d.jingleT > 0 && parked && (live() || partyOn()) && !inTown() && models.npcKid) {
            d.spawnT -= dt;
            if (d.spawnT <= 0 && KIDS.length < 3 && d.served + comingCount() < d.cap) { spawnKid(); d.spawnT = rand(0.5, 1.1); }
        }
        updateKids(dt, R);
    },
    traffic: {
        kind: "rides_icecream", alsoKinds: ["journey_icecream"], mix: 0.02, models: ["journey_icecream"],
        spec: { len: 6.4, halfW: 1.15, circles: [-2.2, 0, 2.2], r: 1.2, mass: 3.2, model: "journey_icecream", paint: false },
        jack: { model: "journey_icecream", label: "🍦 JACK THE ICE-CREAM TRUCK", vtype: "car", feel: "heavy", half: 1.06, fwd: 2.4, len: 0.95, y: [0.6, 1.95],
            handling: { top: 0.68, acc: 0.6, grip: 0.85, brake: 0.7 } },
        cam: { d: 2.6, h: 1.6 },
    },
});

function comingCount() { let n = 0; for (const k of KIDS) if (k.phase === "run") n++; return n; }
function spawnKid() {
    const car = ctx.car;
    const p = borrowPerson("npcKid");
    if (!p) return;
    const s = car.s + rand(-14, 14);
    const q = pt(s, 10.6);
    p.obj.position.set(q.x, 0, q.z);
    KIDS.push({ p, phase: "run", t: 0, s, said: false });
}
function giveCone(k) {
    const arm = k.p.limbs.Arm_R;
    if (!arm || !models.rides_cone) return;
    const c = CONES.pop() || models.rides_cone.clone();
    c.position.set(0, -0.55, 0.08);
    c.rotation.set(0, 0, 0);
    arm.add(c);
    k.p.held = c;
}
function dropKid(i) {
    const k = KIDS[i];
    if (k.p.held) { CONES.push(k.p.held); }
    returnPerson(k.p);
    KIDS.splice(i, 1);
}
function clearKids() { for (let i = KIDS.length - 1; i >= 0; i--) dropKid(i); }

function updateKids(dt, R) {
    const car = ctx.car, d = R.data;
    const moving = car.speed > 2.2;
    carLocal(-1.75, -0.6, _v);                         // the serving window (the truck's right side)
    for (let i = KIDS.length - 1; i >= 0; i--) {
        const k = KIDS[i], o = k.p.obj;
        k.t += dt;
        if (k.phase === "run") {
            if (moving) { k.phase = "leave"; k.t = 0; bubble(pick(T.KID_LEFT), o, { cls: "kid", y: 1.6, dur: 1.8 }); continue; }
            const dx = _v.x - o.position.x, dz = _v.z - o.position.z, dist = Math.hypot(dx, dz);
            k.p.face(_v.x, _v.z, dt, 10);
            if (dist > 0.45) { const st = Math.min(dist, 3.4 * dt) / dist; o.position.x += dx * st; o.position.z += dz * st; k.p.update(dt, { walk: 3.4 }); }
            else { k.phase = "buy"; k.t = 0; }
            if (k.t > 12) { k.phase = "leave"; k.t = 0; }
        } else if (k.phase === "buy") {
            k.p.face(car.pos.x, car.pos.z, dt, 8);
            k.p.update(dt, { cheer: k.t > 0.5 });
            if (!k.said && k.t > 0.5) {
                k.said = true;
                addCoins(PAY, "rides:icecream");
                toast(`🍦 +${PAY} 💰`, "pink", "rides:cone");
                giveCone(k);
                bubble(pick(T.KIDS), o, { cls: "kid", y: 1.6, dur: 2 });
                d.served++;
                S.cones++; saveSoon();
                stat("ridesCones", 1);
                emit("rides:cone", { served: d.served });
                if (d.served >= d.cap) toast(T.SOLD_OUT, "", "rides:ice");
            }
            if (k.t > 1.5 || moving) { k.phase = "leave"; k.t = 0; }
        } else {
            // skip back to the sidewalk and away
            const q = pt(k.s + (k.t > 1.5 ? 6 : 0), 12.5);
            const dx = q.x - o.position.x, dz = q.z - o.position.z, dist = Math.hypot(dx, dz);
            if (dist > 0.3) { const st = Math.min(dist, 2.6 * dt) / dist; o.position.x += dx * st; o.position.z += dz * st; k.p.face(q.x, q.z, dt, 8); }
            k.p.update(dt, { walk: dist > 0.3 ? 2.6 : 0, wave: k.said && dist <= 0.3 });
            if (k.t > 4.5 || Math.abs(k.s - car.s) > 90) dropKid(i);
        }
    }
}
on("title", clearKids);
export const iceDebug = { KIDS };
