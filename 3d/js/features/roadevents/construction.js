// features/roadevents — CONES, PUDDLES, POTHOLES and CONSTRUCTION ZONES.
//
// 2D: stray cones every 2.5–5 s (a hit costs a heart), puddles every 4–8 s
// (a splash slows you for 0.7 s), and the construction zone: a cone gauntlet,
// hard-hatted road workers (who catcall now and then), and steamrollers.
// 3D: cones are instanced and go flying (they only cost a heart above ~30 mph),
// puddles splash, potholes jolt, and a work zone closes a lane with a cone taper,
// a flashing arrow board, barricades and workers — switching sides so you weave.
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { damage } from "../../core/driving.js";
import { instanced } from "../../models.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import { LANES_OURS, LANES_ONCOMING } from "../../world.js";
import { defineEvent, R, count } from "./state.js";
import { K, need, pt, place, rnd, rint, pick, clamp, funnels, sfx, burst, models, cloneWithColors, carTouches, solid, stat } from "./common.js";
import { addPed } from "./passengers.js";

// ── the cone pool (one InstancedMesh per material for every cone on the road) ──
const MAX_CONES = 160;
let pool = null;
const cones = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function ensurePool() {
    if (pool || !models[K("cone")]) return pool;
    pool = instanced(models[K("cone")], MAX_CONES);
    for (const im of pool.group.children) { im.frustumCulled = false; im.count = 0; }
    ctx.scene.add(pool.group);
    return pool;
}
export function addCone(s, d, opts = {}) {
    if (!ensurePool() || cones.length >= MAX_CONES) return null;
    const p = pt(s, d);
    const c = { s, d, x: p.x, z: p.z, y: 0, ry: rnd(0, 6.28), rx: 0, rz: 0, vx: 0, vy: 0, vz: 0, spin: 0, flying: false, down: false, zone: !!opts.zone };
    cones.push(c);
    return c;
}
function knock(c, vx, vz, power = 1) {
    c.flying = true;
    c.vx = vx * 1.1 + rnd(-1.5, 1.5); c.vz = vz * 1.1 + rnd(-1.5, 1.5);
    c.vy = 3 + Math.hypot(vx, vz) * 0.18 * power;
    c.spin = rnd(6, 12) * (Math.random() < 0.5 ? -1 : 1);
}
export function updateCones(dt, collide) {
    if (!pool) return;
    const car = ctx.car;
    let n = 0;
    for (let i = cones.length - 1; i >= 0; i--) {
        const c = cones[i];
        if (c.flying) {
            c.vy -= 16 * dt;
            c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
            c.rx += c.spin * dt; c.rz += c.spin * 0.6 * dt;
            if (c.y <= 0) {
                c.y = 0;
                if (Math.abs(c.vy) < 2.5) { c.flying = false; c.down = true; c.rx = Math.PI / 2; c.rz = 0; }
                c.vy = -c.vy * 0.3; c.vx *= 0.5; c.vz *= 0.5;
            }
        }
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z, d2 = dx * dx + dz * dz;
        if (d2 > 260 * 260 || (c.s < car.s - 50 && !c.flying)) { cones.splice(i, 1); continue; }
        if (collide && !c.flying && !c.down && d2 < 9 && carTouches(c.x, c.z, 0.28)) hitCone(c);
    }
    // traffic knocks cones flying too
    for (const t of ctx.traffic.cars) {
        if (t.hit) continue;
        for (const c of cones) {
            if (c.flying || c.down) continue;
            const dx = c.x - t.x, dz = c.z - t.z;
            if (dx * dx + dz * dz < 2.2) knock(c, Math.sin(t.h) * t.speed, Math.cos(t.h) * t.speed, 0.7);
        }
    }
    for (const c of cones) {
        _q.setFromEuler(_e.set(c.rx, c.ry, c.rz, "YXZ"));
        pool.set(n++, _m.compose(_v.set(c.x, c.y + (c.down ? 0.2 : 0), c.z), _q, _s.set(1, 1, 1)));
    }
    for (const im of pool.group.children) { im.count = n; im.instanceMatrix.needsUpdate = true; }
}
function hitCone(c) {
    const car = ctx.car;
    knock(c, car.vx, car.vz);
    count("cones");
    stat("cones", 1);
    if (ctx.roadevents && ctx.roadevents.vehicle === "steamroller") { sfx.thud(); return; }
    rumble(0.4, 0.4, 120, true);
    if (car.speed > 14 && ctx.G.invT <= 0 && ctx.state === "playing") {
        damage(0.45, pick(["CONED! 🚧", "That cone came outta NOWHERE!", "Orange is NOT your color, Lulu"]), "cone");
    } else {
        sfx.thud();
        car.vx *= 0.94; car.vz *= 0.94;
        if (Math.random() < 0.3) H.toast("🚧 Bonk!", "");
    }
}
export function clearCones() { cones.length = 0; if (pool) for (const im of pool.group.children) im.count = 0; }

/** 2D spawnObstacle("cone"): a stray cone (or a little cluster) in a lane ahead. */
export async function spawnCone(opts = {}) {
    await need(["cone"]);
    const car = ctx.car;
    const s = opts.s != null ? opts.s : car.s + clamp(car.speed * 6, 80, 220);
    const oncoming = opts.oncoming != null ? opts.oncoming : Math.random() < 0.2;
    let d;
    if (opts.d != null) d = opts.d;
    else if (Math.random() < 0.28) d = (oncoming ? -1 : 1) * 3.5 + rnd(-0.7, 0.7);     // straddling the lane line
    else d = pick(oncoming ? LANES_ONCOMING : LANES_OURS) + rnd(-0.9, 0.9);
    const n = opts.n || (Math.random() < 0.25 ? rint(2, 3) : 1);
    const out = [];
    for (let i = 0; i < n; i++) out.push(addCone(s + i * rnd(1.5, 2.5), d + rnd(-0.5, 0.5)));
    count("conesSpawned", n);
    return out;
}
defineEvent("cone", { label: "Stray cones", emoji: "🚧", models: ["cone"], spawn: spawnCone });

// ── puddles & potholes ─────────────────────────────────────────────────────
let PUD = null;
function pudMats() {
    if (PUD) return PUD;
    const geo = new THREE.CircleGeometry(1, 28);
    geo.rotateX(-Math.PI / 2);
    PUD = {
        geo,
        water: new THREE.MeshStandardMaterial({ color: "#5f8fb8", roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.78, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    };
    PUD.water.name = "WaterPuddle";
    return PUD;
}
export async function spawnPuddle(opts = {}) {
    const pothole = !!opts.pothole;
    if (pothole) await need(["pothole"]);
    const car = ctx.car;
    const s = opts.s != null ? opts.s : car.s + clamp(car.speed * 6, 80, 220);
    const d = opts.d != null ? opts.d : pick(Math.random() < 0.8 ? LANES_OURS : LANES_ONCOMING) + rnd(-0.8, 0.8);
    let obj;
    if (pothole) {
        obj = cloneWithColors(models[K("pothole")]);
        place(obj, s, d, rnd(0, 6), 0);
        obj.scale.setScalar(rnd(0.8, 1.2));
    } else {
        const M = pudMats();
        obj = new THREE.Mesh(M.geo, M.water);
        obj.receiveShadow = true;
        place(obj, s, d, rnd(-0.3, 0.3), 0.04);
        obj.scale.set(rnd(1.1, 1.6), 1, rnd(1.8, 2.8));
    }
    ctx.scene.add(obj);
    const E = { s, d, hit: false };
    count(pothole ? "potholes" : "puddles");
    addActor({
        foot: true,
        update() { return E.s - ctx.car.s > -40 && E.s - ctx.car.s < 900; },
        collide(car) {
            if (E.hit || Math.abs(E.s - car.s) > 4) return null;
            if (!carTouches(obj.position.x, obj.position.z, pothole ? 0.5 : 0.9)) return null;
            E.hit = true;
            if (pothole) {
                rumble(0.9, 0.5, 220, true);
                ctx.G.shake = Math.max(ctx.G.shake || 0, 0.5);
                car.vx *= 0.88; car.vz *= 0.88;
                car.bump = (car.bump || 0) + 0.25;
                sfx.thud();
                burst(obj.position.x, 0.3, obj.position.z, 10, 2.5, [0.4, 0.4, 0.42], 0.35, 0.6);
                H.toast("🕳️ POTHOLE!", "");
                stat("potholes", 1);
            } else if (car.speed > 3) {
                wet.t = Math.max(wet.t, 0.7);
                car.vx *= 0.92; car.vz *= 0.92;
                sfx.splash();
                rumble(0.15, 0.4, 140);
                const v = Math.min(car.speed, 30) / 30;
                for (let i = 0; i < 24; i++) car.fx.emit(car.pos.x + rnd(-1, 1), 0.3, car.pos.z + rnd(-1, 1), rnd(-4, 4) * v, rnd(2, 5) * v + 1, rnd(-4, 4) * v, 0.35, 0.6, pick([[0.26, 0.65, 0.96], [0.56, 0.79, 0.98], [0.73, 0.87, 0.98]]));
                if (Math.random() < 0.4) H.toast("💦 SPLASH!", "");
                stat("puddles", 1);
            }
            return null;
        },
        dispose() { if (obj.parent) obj.parent.remove(obj); },
    });
    return E;
}
export const wet = { t: 0 };
defineEvent("puddle", { label: "Puddle", emoji: "💦", models: [], spawn: spawnPuddle });
defineEvent("pothole", { label: "Pothole", emoji: "🕳️", models: ["pothole"], spawn: o => spawnPuddle(Object.assign({ pothole: true }, o)) });

// ── the work zone: a closed lane that switches sides ────────────────────────
/** Start (or force) a construction stretch from s0 to s1. */
export async function startWorkZone(s0, s1) {
    await need(["cone", "barrier", "arrowboard", "roadevents_worker"]);
    ensurePool();
    const W = { s0, s1, genS: s0, segs: [], props: [], lane: Math.random() < 0.6 ? 1 : 0 };
    // plan the segments (closed lane alternates; 35 m tapers)
    let a = s0 + 40;
    while (a < s1 - 80) {
        const len = Math.min(rnd(160, 240), s1 - 40 - a);
        W.segs.push({ a, b: a + len, closed: W.lane, built: false });
        W.lane = 1 - W.lane;
        a += len + 30;
    }
    for (const sg of W.segs) {
        const open = LANES_OURS[1 - sg.closed];
        const f = { s: sg.b, lanes: [open], len: sg.b - sg.a + 70, speed: 15 };
        funnels.add(f);
        sg.funnel = f;
    }
    const group = new THREE.Group();
    ctx.scene.add(group);
    count("workZones");
    addActor({
        foot: true, workZone: W,
        update(dt) {
            const car = ctx.car;
            for (const sg of W.segs) if (!sg.built && sg.a < car.s + 330) buildSeg(W, sg, group);
            for (const p of W.props) if (p.blink) p.blink(ctx.time);
            return car.s < s1 + 120;
        },
        collide(car) {
            let w = 0;
            for (const p of W.props) {
                if (!p.solid || Math.abs(p.s - car.s) > 6) continue;
                w = Math.max(w, solid(p.x, p.z, p.r));
            }
            return w > 2 ? { impact: w * 0.9, why: "Lulu vs. the road crew's barricade", source: "construction" } : null;
        },
        dispose() { for (const sg of W.segs) if (sg.funnel) funnels.delete(sg.funnel); if (group.parent) group.parent.remove(group); },
    });
    return W;
}
function buildSeg(W, sg, group) {
    sg.built = true;
    const right = sg.closed === 1;                 // closing the right (outer) lane?
    const edge = right ? 7.0 : 0.25, line = right ? 3.85 : 3.15, mid = right ? 5.3 : 1.7;
    // taper in, straight run, taper out
    for (let s = sg.a; s <= sg.b; s += 6.5) {
        const k = clamp((s - sg.a) / 35, 0, 1) * clamp((sg.b - s) / 20, 0, 1);
        addCone(s, edge + (line - edge) * k, { zone: true });
    }
    // flashing arrow board at the start of the closure, in the closed lane
    const ab = cloneWithColors(models[K("arrowboard")]);
    place(ab, sg.a + 4, right ? 7.6 : 1.4, Math.PI);
    if (right) ab.scale.x = -1;          // arrow points to the open lane
    group.add(ab);
    const amber = [];
    ab.traverse(o => { if (o.isMesh && o.material.name === "NeonAmber") { o.material = o.material.clone(); amber.push(o.material); } });
    const p0 = pt(sg.a + 4, right ? 7.6 : 1.4);
    W.props.push({ s: sg.a + 4, x: p0.x, z: p0.z, r: 1.1, solid: true, blink: t => { for (const m of amber) m.emissiveIntensity = Math.sin(t * 7) > 0 ? 3 : 0.1; } });
    // barricades + workers inside the closed lane
    for (let s = sg.a + 45; s < sg.b - 25; s += rnd(38, 55)) {
        const b = cloneWithColors(models[K("barrier")]);
        place(b, s, mid + rnd(-0.6, 0.6), Math.PI + rnd(-0.2, 0.2));
        group.add(b);
        const p = pt(s, mid);
        W.props.push({ s, x: p.x, z: p.z, r: 0.8, solid: true });
        if (Math.random() < 0.55) {
            const ped = addPed({ s: s + rnd(4, 9), d: mid + rnd(-0.8, 0.8), kind: "worker", model: "roadevents_worker" });
            if (ped) ped.faceYaw = pick([Math.PI / 2, -Math.PI / 2, Math.PI]);
        }
    }
}
export function inWorkZone(s) { return R.zone === "construction" && s >= R.zoneS0 && s <= R.zoneS1; }
