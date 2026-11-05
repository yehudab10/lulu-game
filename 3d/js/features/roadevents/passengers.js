// features/roadevents — pedestrians, hitchhikers and the PASSENGER SEAT.
//
// 2D: bump a walker and "Shua went flying!" — they hop in, and for 30 s every
// road coin counts double (up to 4 riders). A thumber on the shoulder with a
// "BUBBE'S?" sign hops in when you honk (+15 💰, same 2× window). Plow into
// someone at speed in front of a cop → HIT AND RUN. In 3D the bonked walker
// cartwheels through the air and lands in the passenger seat; extra riders sit
// up on the rear deck.
import * as THREE from "three";
import { ctx, on, emit, hook, addActor, MPH } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { rumble, glyph } from "../../input.js";
import * as H from "../../hud.js";
import { PAY, KO_NAMES, KO_LINES, HITCH_LINES, BAR_CATCALLS, HONK_REACT } from "./config.js";
import { EVENTS, defineEvent, R, count, inc } from "./state.js";
import { K, need, pt, place, rnd, pick, clamp, bubble, sfx, burst, confetti, copWitness, stat, personColors, findNodes, models, cloneWithColors } from "./common.js";

// ── the passenger seat ─────────────────────────────────────────────────────
export const seat = { riders: [], t: 0, wrap: null };
// rider slots relative to the car's passenger anchor (three.js axes: +Z forward, +X left)
const SLOTS = [[0, -0.33, 0.02], [0.0, -0.06, -0.86], [0.76, -0.06, -0.86], [0.38, 0.04, -1.3]];

function wrapper() {
    if (seat.wrap && ctx.car.attached && ctx.car.attached.passenger === seat.wrap) return seat.wrap;
    const cur = ctx.car.attached && ctx.car.attached.passenger;
    if (cur && cur !== seat.wrap) return null;          // someone else (the sasquatch?) has the seat
    seat.wrap = new THREE.Group();
    seat.wrap.name = "re_riders";
    ctx.car.attach("passenger", seat.wrap);
    return seat.wrap;
}

/**
 * Put a person in Lulu's car. person: a core Person (spawnPerson). opts.bonus = the
 * 2× coin window (default true), opts.secs, opts.who (name for toasts), opts.keep (stays all run).
 */
export function seatRider(person, opts = {}) {
    const w = wrapper();
    if (!w) return false;
    if (seat.riders.length >= PAY.maxPassengers) dropRider(seat.riders[0], true);
    const slot = SLOTS[seat.riders.length];
    person.obj.position.set(slot[0], slot[1], slot[2]);
    person.obj.rotation.set(0, 0, 0);
    person.obj.scale.setScalar(opts.scale || (person.kid ? 0.95 : 0.86));
    w.add(person.obj);
    const r = { person, bonus: opts.bonus !== false, keep: !!opts.keep, who: opts.who || "", waveT: rnd(2, 6) };
    seat.riders.push(r);
    if (r.bonus) seat.t = Math.max(seat.t, opts.secs || PAY.passengerSecs);
    stat("passengers", 1);
    count("passengers");
    emit("roadevents:passenger", { who: r.who, n: seat.riders.length });
    return true;
}

function dropRider(r, quiet) {
    const i = seat.riders.indexOf(r);
    if (i < 0) return;
    seat.riders.splice(i, 1);
    const p = r.person;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    // re-pack the remaining riders
    seat.riders.forEach((rr, k) => rr.person.obj.position.set(...SLOTS[k]));
    if (quiet) return;
    // hop out onto the shoulder and wave goodbye for a few seconds
    const s = ctx.car.s - 4, side = ctx.car.d > 0 ? 1 : -1;
    const obj = p.obj;
    obj.scale.setScalar(1);
    place(obj, s, side * 9.6, Math.PI);
    ctx.scene.add(obj);
    const car = ctx.car;
    burst(obj.position.x, 1.2, obj.position.z, 8, 2.5, [0.56, 0.64, 0.68], 0.4, 0.7);
    let t = 0;
    if (Math.random() < 0.6) bubble(pick(["Thanks for the lift!", "Bye, Lulu! 👋", "Tell Bubbe I said hi!", "Mensch!"]), obj, { t: 2.4, y: 2.1 });
    addActor({
        foot: true,
        update(dt) {
            t += dt;
            p.update(dt, { wave: true });
            p.face(car.pos.x, car.pos.z, dt, 3);
            return t < 6 && Math.abs(ctx.car.s - s) < 200;
        },
        dispose() { if (obj.parent) obj.parent.remove(obj); },
    });
}
export function clearRiders() {
    for (const r of seat.riders.slice()) dropRider(r, true);
    seat.riders.length = 0;
    seat.t = 0;
    if (seat.wrap && ctx.car && ctx.car.attached && ctx.car.attached.passenger === seat.wrap) ctx.car.attach("passenger", null);
    seat.wrap = null;
}
export function ridersBonus() { return seat.t > 0; }

// the 2× coin window: every road coin is paid again
on("coin", e => {
    if (seat.t > 0 && e.why === "road" && e.n > 0 && ctx.state === "playing") addCoins(e.n, "passenger");
});

hook("update", (dt, P, controlsOn) => {
    if (seat.t > 0 && controlsOn) {
        seat.t -= dt;
        if (seat.t <= 0) {
            seat.t = 0;
            for (const r of seat.riders.slice()) if (r.bonus && !r.keep) dropRider(r, false);
            const car = ctx.car;
            burst(car.pos.x, 1.4, car.pos.z, 8, 2.5, [0.56, 0.64, 0.68], 0.4, 0.6);
        }
    }
    for (const r of seat.riders) {
        r.waveT -= dt;
        const wave = r.waveT < 0;
        if (r.waveT < -1.6) r.waveT = rnd(4, 9);
        r.person.update(dt, { sit: true, wave, talk: r.waveT > 0 && r.waveT < 0.8 });
    }
});
on("foot:start", () => { for (const r of seat.riders.slice()) if (!r.keep) dropRider(r, false); });

// ── flying into the car (the bonk) ─────────────────────────────────────────
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
function flyIntoCar(person, opts = {}) {
    const obj = person.obj;
    const from = obj.getWorldPosition(new THREE.Vector3());
    if (!obj.parent) ctx.scene.add(obj);
    let t = 0;
    const dur = opts.dur || 0.85, spins = opts.spins == null ? 1 : opts.spins;
    addActor({
        update(dt) {
            t += dt;
            const k = clamp(t / dur, 0, 1);
            const anc = ctx.car.anchors && ctx.car.anchors.passenger;
            if (anc) anc.getWorldPosition(_b); else _b.copy(ctx.car.pos);
            _a.lerpVectors(from, _b, k * k * (3 - 2 * k));
            _a.y += Math.sin(Math.PI * k) * (opts.arc || 3.2);
            obj.position.copy(_a);
            obj.rotation.set(-spins * Math.PI * 2 * k, ctx.car.h, 0, "YXZ");
            person.update(dt, { cheer: true });
            if (k >= 1) {
                obj.rotation.set(0, 0, 0);
                if (obj.parent) obj.parent.remove(obj);
                if (!seatRider(person, opts)) return false;
                sfx.happy();
                return false;
            }
            return true;
        },
    });
}

// ── pedestrians ────────────────────────────────────────────────────────────
// kinds: walker (crosses the road), stroller (walks along the edge), runner (parade /
// marathon), worker (construction zone), drunk (bar district), kid (school zone — they
// always dodge; kids are never a collision)
const PED_MODEL = { worker: "roadevents_worker", kid: "npcKid" };
export function pedModel(kind) { return PED_MODEL[kind] || pick(["npcWoman", "npcMan", "npcWoman", "npcMan", "npcKid"]); }

/**
 * Spawn a person on the road. opts: s, d, kind, vx (m/s across the road, + = to the
 * right), vs (m/s along the road), colors, model, life (m behind Lulu before culling)
 */
export function addPed(opts = {}) {
    const kind = opts.kind || "walker";
    const key = opts.model || pedModel(kind);
    if (!models[key]) return null;
    const kid = kind === "kid" || key === "npcKid";
    const colors = opts.colors || (key === "roadevents_worker" ? null : personColors());
    const p = spawnPerson(key, { colors });
    p.kid = kid;
    const ped = {
        p, kind, s: opts.s, d: opts.d, vx: opts.vx || 0, vs: opts.vs || 0, kid,
        drunk: kind === "drunk", worker: kind === "worker", catT: rnd(0.2, 1.0), scared: 0, gone: false, sway: 0,
    };
    place(p.obj, ped.s, ped.d);
    ctx.scene.add(p.obj);
    inc("ped");
    const actor = {
        foot: true, ped,
        update(dt) {
            if (ped.gone) return false;
            const car = ctx.car;
            // kids (and anyone in a crowd) jump out of the way of a fast car
            const ahead = ped.s - car.s, lat = Math.abs(ped.d - car.d);
            if (kid && !ped.scared && ahead > 0 && ahead < Math.max(8, car.speed * 0.9) && lat < 4 && car.speed > 4) {
                ped.scared = 1;
                ped.vx = (ped.d >= car.d ? 1 : -1) * 5.5;
                bubble(pick(["EEK!", "AAH!", "Whoa!!", "Mommy!"]), p.obj, { t: 1.2, y: 1.6 });
            }
            ped.d += ped.vx * dt;
            ped.s += ped.vs * dt;
            ped.sway += dt;
            const sp = Math.hypot(ped.vx, ped.vs);
            const pp = pt(ped.s, ped.d);
            p.obj.position.set(pp.x, 0, pp.z);
            p.obj.rotation.y = pp.h + headingFor(ped);
            if (ped.drunk) p.obj.rotation.z = Math.sin(ped.sway * 3) * 0.18;
            p.update(dt, { walk: sp, wave: !!ped.waving, cheer: ped.cheer });
            if (ped.waving) ped.waving = Math.max(0, ped.waving - dt);
            // drunk patrons holler a lot, workers now and then (2D catcalls)
            if ((ped.drunk || ped.worker) && Math.abs(ahead) < 40) {
                ped.catT -= dt;
                if (ped.catT <= 0) {
                    if (Math.random() < (ped.drunk ? 0.85 : 0.06)) bubble(pick(BAR_CATCALLS), p.obj, { t: 2.6, y: 2.0, cls: "pink" });
                    ped.catT = ped.drunk ? rnd(0.8, 1.8) : rnd(1.6, 3.4);
                }
            }
            if (Math.abs(ped.d) > 16 || ahead < -60 || ahead > 900) return false;
            return true;
        },
        collide(car) {
            if (ped.gone || kid || ctx.state !== "playing") return null;
            const pos = p.obj.position;
            const fx = Math.sin(car.h), fz = Math.cos(car.h);
            let hit = false;
            for (const o of [1.4, 0, -1.2]) {
                const dx = car.pos.x + fx * o - pos.x, dz = car.pos.z + fz * o - pos.z;
                if (dx * dx + dz * dz < 1.35 * 1.35) hit = true;
            }
            if (!hit) return null;
            bonk(ped);
            return null;
        },
        dispose() { if (!ped.flying && p.obj.parent) p.obj.parent.remove(p.obj); inc("ped", -1); },
    };
    addActor(actor);
    return ped;
}
function headingFor(ped) {
    // face the way they're walking: 0 = along the road, ±π/2 = across
    if (Math.abs(ped.vx) < 0.05 && Math.abs(ped.vs) < 0.05) return ped.faceYaw || 0;
    return Math.atan2(-ped.vx, ped.vs);
}

/** Lulu bonked a pedestrian: they fly into the car (2D pickUpPassenger) — unless a cop saw it. */
function bonk(ped) {
    ped.gone = true;
    ped.flying = true;
    const car = ctx.car;
    const reckless = (car.speed > 30 || ctx.G.boosting) && ctx.G.invT <= 0;
    const witness = copWitness(90);
    H.toast(`🤸 ${pick(KO_NAMES)}${pick(KO_LINES)}`, "pink");
    rumble(0.3, 0.6, 160);
    sfx.thud();
    car.vx *= 0.93; car.vz *= 0.93;
    const pos = ped.p.obj.position;
    burst(pos.x, 1.0, pos.z, 10, 3, [1, 0.5, 0.7], 0.45, 0.8);
    count("bonks");
    emit("roadevents:bonk", { reckless, witness: !!witness });
    if (reckless && witness && ctx.law) {
        if (ctx.law.arrest) { ctx.law.arrest(["HIT AND RUN", "RECKLESS ENDANGERMENT"], { source: "roadevents" }); return; }
        if (ctx.law.startChase) ctx.law.startChase("reckless");
    }
    flyIntoCar(ped.p, { who: "walker" });
    if (witness && !reckless && ctx.law && ctx.law.startChase) ctx.law.startChase("reckless");
}

/** 2D spawnObstacle("ped"): someone wanders into the road ahead. */
export async function spawnPedestrian(opts = {}) {
    const kind = opts.kind || (R.zone === "construction" ? "worker" : R.zone === "bars" ? "drunk" : R.zone === "school" ? "kid" : "walker");
    const key = opts.model || pedModel(kind);
    await need([key]);
    const car = ctx.car;
    const s = opts.s != null ? opts.s : car.s + clamp(car.speed * 4.5, 70, 170) + rnd(0, 30);
    const cross = opts.cross != null ? opts.cross : Math.random() < 0.65;
    if (cross) {
        const side = opts.side || (Math.random() < 0.5 ? -1 : 1);
        return addPed({ s, d: opts.d != null ? opts.d : side * rnd(5.5, 8.8), vx: -side * rnd(1.0, 1.5), kind, model: key });
    }
    // a stroller along the right edge of our lanes, slower than traffic (2D speedMult 0.5)
    return addPed({ s, d: opts.d != null ? opts.d : rnd(5.6, 6.6), vs: rnd(1.0, 1.6), kind, model: key });
}
defineEvent("pedestrian", { label: "Pedestrian", emoji: "🚶", models: ["npcWoman", "npcMan", "npcKid"], spawn: spawnPedestrian });

// honking scares walkers off the road (2D honkScare)
export function honkScarePeds(chance) {
    for (const a of ctx.actors) {
        const ped = a.ped;
        if (!ped || ped.gone) continue;
        const ahead = ped.s - ctx.car.s;
        if (ahead < -4 || ahead > 90 || Math.random() > chance) continue;
        ped.vx = (ped.d >= ctx.car.d ? 1 : -1) * rnd(3.5, 5);
        ped.vs = 0;
        ped.waving = 0.6;
        if (Math.random() < 0.4) bubble(pick(HONK_REACT), ped.p.obj, { t: 1.3, y: 2.0 });
    }
}

// ── hitchhikers ────────────────────────────────────────────────────────────
let hitch = null;
export async function spawnHitchhiker(opts = {}) {
    if (hitch) return hitch;
    await need(["hitchhiker", "hitch_sign"]);
    const car = ctx.car;
    const side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const s = opts.s != null ? opts.s : car.s + clamp(car.speed * 6, 110, 220);
    const p = spawnPerson(K("hitchhiker"));
    const obj = p.obj;
    const sign = cloneWithColors(models[K("hitch_sign")]);
    const armL = findNodes(obj, "Arm_L")[0];
    if (armL) { armL.add(sign); sign.position.set(0.02, -0.47, 0.16); sign.rotation.set(0, 0, 0); }
    const h = { p, s, d: side * 8.7, side, t: 0, honked: false, picked: false, passed: false, sign };
    place(obj, s, h.d, Math.PI);
    ctx.scene.add(obj);
    hitch = h;
    count("hitchhikers");
    addActor({
        foot: true,
        update(dt) {
            h.t += dt;
            if (h.picked) return false;
            const ahead = h.s - ctx.car.s;
            p.update(dt, { point: true, wave: ahead < 50 && ahead > 0 && Math.sin(h.t * 2) > 0.6 });
            if (armL) armL.rotation.x -= 0.9;      // hold the BUBBE'S? sign up
            p.face(ctx.car.pos.x, ctx.car.pos.z, dt, 2);
            if (ahead < -8 && !h.passed) { h.passed = true; bubble(pick(["Aw, c'mon!", "I'll walk… 😩", "Next time!"]), obj, { t: 2, y: 2.1 }); }
            if (ahead < -60) return false;
            if (ahead > -2 && ahead < 70 && ctx.state === "playing") H.prompt(`🙋 ${glyph("honk")} Honk to pick up the hitchhiker!`);
            else if (h.prompted) H.prompt("");
            h.prompted = ahead > -2 && ahead < 70;
            return true;
        },
        dispose() { if (!h.picked && obj.parent) obj.parent.remove(obj); if (hitch === h) hitch = null; if (h.prompted) H.prompt(""); },
    });
    return h;
}
defineEvent("hitchhiker", { label: "Hitchhiker", emoji: "🙋", models: ["hitchhiker", "hitch_sign"], spawn: spawnHitchhiker });

/** Called on every honk: pick up a nearby hitchhiker (2D: within 110 px + on screen). */
export function honkHitch() {
    const h = hitch;
    if (!h || h.picked) return false;
    const ahead = h.s - ctx.car.s, lat = Math.abs(h.d - ctx.car.d);
    if (ahead < -2 || ahead > 70 || lat > 12) return false;
    h.picked = true;
    if (h.prompted) H.prompt("");
    addCoins(PAY.hitch, "hitchhiker");
    bubble(pick(HITCH_LINES), h.p.obj, { t: 2.6, y: 2.1, cls: "gold" });
    H.toast(`🚗 +${PAY.hitch} 💰  2× coins!`, "gold");
    sfx.coin(4);
    rumble(0.2, 0.5, 120);
    if (h.sign && h.sign.parent) h.sign.parent.remove(h.sign);      // tossed over the shoulder
    stat("hitchhikers", 1);
    emit("roadevents:hitchhiker", {});
    flyIntoCar(h.p, { who: "hitchhiker", arc: 2.2, spins: 0, dur: 0.7 });
    hitch = null;
    return true;
}
export function resetPassengers() { clearRiders(); hitch = null; }
