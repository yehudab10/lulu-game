// features/roadevents — ANIMALS crossing the road.
//
// 2D: ducks and raccoons (and, after a minute, OSTRICHES) wander across every
// 8–14 s; hitting one costs a heart (and if it's the last one, the animals'
// friends come for revenge — that's the cameos' crash aftermath). Honking makes
// them bolt (×1.9) and sometimes turn back. 15% of the time it's a DUCK PARADE:
// Mama ("Excuse me!", "We have right of way!") and six ducklings in single
// file — and the last one trips.
// 3D: waddling, scurrying, sprinting animals with real legs; traffic stops for
// the duck parade, and so should you (+150).
import * as THREE from "three";
import { ctx, emit, addActor } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { shared } from "../../core/save.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { PAY, DUCK_SAYS, ANIMAL_HIT, ANIMAL_HONK } from "./config.js";
import { defineEvent, inc, count, live } from "./state.js";
import { K, need, pt, rnd, pick, clamp, findNodes, carTouches, blockers, bubble, sfx, stat, tone, burst, models, cloneWithColors } from "./common.js";

const SPEC = {
    duck:    { model: "duck", scale: 2.2, r: 0.4, v: [1.6, 2.4], feathers: [1, 0.92, 0.3], swing: 0.6, freq: 11 },
    raccoon: { model: "raccoon", scale: 1.75, r: 0.5, v: [2.6, 4.0], feathers: [0.55, 0.6, 0.65], swing: 0.55, freq: 9 },
    ostrich: { model: "ostrich", scale: 1.15, r: 0.55, v: [5.0, 8.0], feathers: [0.15, 0.15, 0.15], swing: 0.75, freq: 7 },
};
const _q = new THREE.Quaternion(), _e = new THREE.Euler();

function rig(obj) {
    const r = {};
    for (const n of ["Body", "Leg_L", "Leg_R", "Arm_L", "Arm_R"]) { const node = findNodes(obj, n)[0]; if (node) r[n] = { node, q: node.quaternion.clone() }; }
    return r;
}
function rot(r, n, x, z = 0) { const e = r[n]; if (e) e.node.quaternion.copy(e.q).multiply(_q.setFromEuler(_e.set(x, 0, z))); }

function voice(type) {
    if (type === "duck") sfx.quack();
    else if (type === "raccoon") { tone(1400, 0.06, "square", 0.05, 0, 1900); tone(1500, 0.06, "square", 0.05, 0.08, 2000); }
    else { tone(110, 0.35, "sine", 0.18, 0, 70); tone(95, 0.3, "sine", 0.14, 0.32, 65); }
}

/** One animal crossing at road distance s, from side (±1), at speed v (m/s). */
function addAnimal(type, s, d, vx, opts = {}) {
    const sp = SPEC[type];
    const holder = new THREE.Group();
    const inner = new THREE.Group();
    const obj = cloneWithColors(models[K(sp.model)], opts.colors || null);
    inner.add(obj);
    holder.add(inner);
    const sc = (opts.scale || 1) * sp.scale;
    holder.scale.setScalar(sc);
    ctx.scene.add(holder);
    const R = rig(obj);
    const A = { type, s, d, vx, sc, holder, inner, R, phase: Math.random() * 6, hit: false, t: 0, flyV: null, dazed: 0, trip: opts.trip || 0, parade: opts.parade || null, mama: !!opts.mama, gone: false };
    inc("animal");
    const actor = {
        foot: true, animal: A,
        update(dt) {
            A.t += dt;
            const car = ctx.car;
            if (A.flyV) {
                // tumbling through the air after a bonk (cartoon physics), then dazed, then off it runs
                A.flyV.y -= 16 * dt;
                holder.position.addScaledVector(A.flyV, dt);
                inner.rotation.x += 9 * dt; inner.rotation.z += 5 * dt;
                if (holder.position.y <= 0) {
                    holder.position.y = 0;
                    inner.rotation.set(0, 0, 0);
                    A.flyV = null; A.dazed = 1.6;
                    bubble("💫", holder, { t: 1.6, y: 1.0 * sc });
                    const n = ctx.world.road.nearest(holder.position.x, holder.position.z, A.s);
                    A.s = n.s; A.d = n.d;
                    A.vx = (A.d > 0 ? 1 : -1) * SPEC[type].v[1] * 1.4;
                }
                return true;
            }
            if (A.dazed > 0) { A.dazed -= dt; inner.rotation.z = Math.sin(A.t * 14) * 0.25; animate(A, 0, dt); return true; }
            inner.rotation.z = 0;
            // the parade's last duckling trips halfway across
            if (A.trip === 1 && Math.abs(A.d) < 2.5) { A.trip = 2; A.tripT = 0; bubble("*trips*", holder, { t: 1.2, y: 0.9 }); }
            let v = A.vx;
            if (A.trip === 2) {
                A.tripT += dt;
                inner.rotation.x = Math.min(1, A.tripT / 0.6) * Math.PI * 2;
                v = 0;
                if (A.tripT > 1.1) { A.trip = 3; inner.rotation.x = 0; A.vx *= 1.8; }
            }
            A.d += v * dt;
            const p = pt(A.s, A.d);
            holder.position.set(p.x, 0, p.z);
            holder.rotation.y = p.h + (A.vx > 0 ? -Math.PI / 2 : Math.PI / 2);
            animate(A, Math.abs(v), dt);
            if (A.mama && A.parade && !A.parade.done) {
                A.sayT = (A.sayT == null ? 1.5 : A.sayT) - dt;
                if (A.sayT <= 0) { A.sayT = 4; bubble(pick(DUCK_SAYS), holder, { t: 2.6, y: 1.1 * sc, cls: "gold" }); sfx.quack(); }
            }
            return Math.abs(A.d) < 15 && A.s - car.s > -80 && A.s - car.s < 900;
        },
        collide(car) {
            if (A.flyV || A.gone || ctx.state !== "playing") return null;
            const pos = holder.position;
            if (!carTouches(pos.x, pos.z, SPEC[type].r * sc / SPEC[type].scale * 1.0)) return null;
            if (car.speed < 2) { A.vx = -A.vx || 1.5; bubble("Hey!", holder, { t: 1, y: 1 * sc }); voice(type); return null; }
            // bonk!
            A.flyV = new THREE.Vector3(car.vx * 0.55 + rnd(-2, 2), 5 + car.speed * 0.08, car.vz * 0.55 + rnd(-2, 2));
            burst(pos.x, 0.6, pos.z, 18, 3.5, SPEC[type].feathers, 0.35, 0.9);
            voice(type);
            count("animalsHit");
            ctx.G.lastAnimal = type;
            emit("roadevents:animal", { type, hit: true });
            if (A.parade) A.parade.hit = true;
            const harmless = ctx.roadevents && ctx.roadevents.vehicle === "steamroller";
            return { impact: Math.max(7, car.speed * 0.8), why: pick(ANIMAL_HIT[type]), source: "animal", animal: type, harmless };
        },
        dispose() { if (holder.parent) holder.parent.remove(holder); inc("animal", -1); },
    };
    addActor(actor);
    return A;
}

function animate(A, v, dt) {
    const sp = SPEC[A.type], R = A.R;
    A.phase += dt * (v > 0.05 ? sp.freq * (0.6 + v / sp.v[1] * 0.6) : 0);
    const s = Math.sin(A.phase) * (v > 0.05 ? sp.swing : 0);
    if (A.type === "raccoon") { rot(R, "Arm_L", s); rot(R, "Leg_R", s); rot(R, "Arm_R", -s); rot(R, "Leg_L", -s); }
    else {
        rot(R, "Leg_L", s); rot(R, "Leg_R", -s);
        const flap = A.scared > 0 ? Math.sin(A.t * 30) * 0.8 : A.type === "ostrich" ? Math.sin(A.phase) * 0.2 : 0.05;
        rot(R, "Arm_L", 0, Math.max(0, flap)); rot(R, "Arm_R", 0, -Math.max(0, flap));
    }
    if (A.type === "duck" && v > 0.05) A.inner.rotation.z = Math.sin(A.phase) * 0.14;          // the waddle
    if (A.type === "ostrich") A.inner.position.y = Math.abs(Math.cos(A.phase)) * 0.06;
    if (A.scared > 0) A.scared -= dt;
}

/** 2D spawnAnimal(): a duck / raccoon / ostrich wanders across ahead. */
export async function spawnAnimal(opts = {}) {
    const G = ctx.G;
    const types = ["duck", "raccoon"];
    if ((G.runTime || 0) > 60 || shared.get().distractedUnlocked || opts.type === "ostrich") types.push("ostrich");
    const type = opts.type || pick(types);
    await need([SPEC[type].model]);
    const car = ctx.car;
    const side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const v = opts.v || rnd(...SPEC[type].v);
    const tLane = (10 - 3.5) / v;   // time to reach Lulu's side of the road
    const s = opts.s != null ? opts.s : car.s + clamp(car.speed * tLane * rnd(0.8, 1.3), 45, 200);
    count("animals");
    return addAnimal(type, s, side * (opts.d0 || 10.5), -side * v);
}
defineEvent("animal", { label: "Animal crossing", emoji: "🦝", models: ["duck", "raccoon", "ostrich"], spawn: spawnAnimal });
for (const t of ["duck", "raccoon", "ostrich"]) defineEvent(t, { label: t[0].toUpperCase() + t.slice(1), emoji: { duck: "🦆", raccoon: "🦝", ostrich: "🦤" }[t], models: [t], spawn: o => spawnAnimal(Object.assign({ type: t }, o)) });

/** 2D spawnDuckParade(): Mama + 6 ducklings, single file, slow. */
export async function spawnDuckParade(opts = {}) {
    await need(["duck"]);
    const car = ctx.car;
    const side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const v = 1.25;
    const s = opts.s != null ? opts.s : car.s + clamp(car.speed * 4.5 + 25, 45, 170);
    const parade = { done: false, hit: false, waited: false, ducks: [] };
    parade.ducks.push(addAnimal("duck", s, side * 10.2, -side * v, { mama: true, parade }));
    for (let i = 0; i < 6; i++) {
        parade.ducks.push(addAnimal("duck", s + rnd(-0.15, 0.15), side * (10.2 + 0.9 + i * 0.62), -side * v * rnd(0.95, 1.03),
            { scale: 0.5, colors: { DuckYellow: "#FFF176" }, parade, trip: i === 5 ? 1 : 0 }));
    }
    const onRoad = () => parade.ducks.some(a => !a.flyV && Math.abs(a.d) < 8.5);
    const b1 = { s: s - 6, d0: -8, d1: 8, dir: 1, reach: 55, active: onRoad };
    const b2 = { s: s + 6, d0: -8, d1: 8, dir: -1, reach: 55, active: onRoad };
    blockers.add(b1); blockers.add(b2);
    count("duckParades");
    inc("duckParade");
    if (ctx.state === "playing") H.toast("🦆 DUCK CROSSING!", "gold");
    let t = 0;
    addActor({
        foot: true,
        update(dt) {
            t += dt;
            const ahead = s - ctx.car.s;
            const any = onRoad();
            if (!parade.waited && !parade.hit && any && ahead > 5 && ahead < 40 && ctx.car.speed < 2 && ctx.state === "playing") {
                parade.waited = true;
                addScore(PAY.duckWait, "ducks");
                H.toast(`🦆 You let the ducklings cross! +${PAY.duckWait}`, "gold");
                stat("duckParades", 1);
                sfx.quack();
            }
            if (t > 2 && !any && parade.ducks.every(a => Math.abs(a.d) > 9 || a.flyV)) parade.done = true;
            return !(parade.done && t > 3) && ahead > -80;
        },
        dispose() { blockers.delete(b1); blockers.delete(b2); inc("duckParade", -1); },
    });
    return parade;
}
defineEvent("duckParade", { label: "Duck parade", emoji: "🦆", models: ["duck"], spawn: spawnDuckParade });

/** Honk: animals near Lulu bolt (×1.9) and sometimes turn back (2D honkScare). */
export function honkScareAnimals(chance) {
    for (const a of ctx.actors) {
        const A = a.animal;
        if (!A || A.flyV || A.parade) continue;
        const ahead = A.s - ctx.car.s;
        if (ahead < -5 || ahead > 95 || Math.random() > chance) continue;
        A.vx *= 1.9;
        if (Math.random() < 0.4) A.vx = -A.vx;
        A.scared = 0.8;
        voice(A.type);
        if (Math.random() < 0.5) bubble(pick(ANIMAL_HONK), A.holder, { t: 1.1, y: 1.1 * A.sc });
    }
}
