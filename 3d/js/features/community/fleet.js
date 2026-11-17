// features/community — THE FLEET: Chaverim / Shomrim / Hatzalah vehicles. Every one is an
// ordinary ctx.traffic car (pooled by traffic.js: crashes, near misses, cops' traffic
// dodging all just work) with a record V = { car, org, mode, lights, … }:
//   "traffic"  a highway sighting on the plain lane AI (traffic.js)
//   "cruise"   a town cruiser on the town's own lane AI (ctx.town.addDriver)
//   "go"       driving to a fixed kerbside point (a roadside scene) in road coords, then "stop"
//   "pursue"   following LULU round corners (ctx.town.copRoute / the highway), free mode
//   "leave"    pulling out and driving off; removed once she can't see it
// Lights flash per org (common.js setLights); a responding Hatzalah wails through A.spatial.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { registerKind } from "../../traffic.js";
import * as A from "../../audio.js";
import { CM, has, on, onFoot, luluPos, rand, pick, clamp, wrap, lightRig, setLights, luluSay, townCfg } from "./common.js";
import { LULU_SEES } from "./lines.js";
import { forTown } from "./towns.js";

export const KIND = { chaverim: "community_chaverim", shomrim: "community_shomrim", hatzalah: "community_hatzalah" };
registerKind("community_chaverim", { len: 4.8, halfW: 1.0, circles: [1.5, -1.5], r: 1.02, mass: 1.9, model: "community_chaverim" });
registerKind("community_shomrim", { len: 5.3, halfW: 0.95, circles: [1.7, 0, -1.7], r: 0.96, mass: 1.7, model: "community_shomrim" });
// (halfW 1.1: the box van blocks a cruiser's line of sight like a truck — hide behind Hatzalah)
registerKind("community_hatzalah", { len: 5.8, halfW: 1.1, circles: [1.8, 0, -1.8], r: 1.12, mass: 2.6, model: "community_hatzalah" });
export const ORG_OF = { community_chaverim: "chaverim", community_shomrim: "shomrim", community_hatzalah: "hatzalah" };

const _n = {}, _p = {};
const inTown = () => !!(ctx.town && ctx.town.active);

// ── records ──────────────────────────────────────────────────────────────
function track(car, org, mode, opts = {}) {
    const V = { car, org, mode, lights: !!opts.lights, siren: !!opts.siren, sp: null, rig: lightRig(car.obj), t: 0, phase: Math.random(),
        v: opts.v || 12, laneD: 1.75, go: null, onArrive: null, gapWant: -7, side: 0, vmax: 24, seen: false, data: {} };
    car.data.community = V;
    // a nudge from a volunteer never costs a heart; a real crash does
    car.onCrash = e => (e.impact > 9 ? undefined : false);
    const prev = car.onRemove;
    car.onRemove = c => { if (prev) try { prev(c); } catch (e) { console.error(e); } forget(V); };
    CM.vehicles.push(V);
    return V;
}
function forget(V) {
    if (V.sp) V.sp = V.sp.stop();
    setLights(V.rig, false, 0, V.org);
    V.dead = true;
    if (V.car && V.car.data && V.car.data.community === V) delete V.car.data.community;
    if (V.car) { V.car.onCrash = null; V.car.onRemove = null; V.car.free = false; }
    const i = CM.vehicles.indexOf(V);
    if (i >= 0) CM.vehicles.splice(i, 1);
}
export function removeVehicle(V) {
    if (!V || V.dead) return;
    const c = V.car;
    if (c && ctx.traffic.cars.includes(c)) ctx.traffic.remove(c);     // → onRemove → forget
    else forget(V);
}
export function clearFleet() { for (const V of CM.vehicles.slice()) removeVehicle(V); CM.vehicles.length = 0; }

// ── spawning ─────────────────────────────────────────────────────────────
/** A highway sighting on the plain lane AI. */
export function spawnHighway(org, { s, d, dir = 1, speed = 20, lights = false, siren = false } = {}) {
    const kind = KIND[org];
    if (!has(kind)) return null;
    const c = ctx.traffic.add(kind, s, d, dir, speed, { data: {} });
    return track(c, org, "traffic", { lights, siren });
}
/** Any org vehicle at road coords (s, d), heading dir, on the plain lane AI until you give it a mode. */
export function spawnAt(org, s, d, dir, speed, { lights = false, siren = false } = {}) {
    const kind = KIND[org];
    if (!has(kind)) return null;
    const c = ctx.traffic.add(kind, s, d, dir, speed, { keep: true, noNearMiss: true, data: {} });
    return track(c, org, "traffic", { lights, siren });
}
/** A town cruiser on the town's own lane AI. */
export function spawnCruiser(org) {
    const kind = KIND[org];
    if (!has(kind) || !ctx.town || !ctx.town.addDriver) return null;
    const c = ctx.town.addDriver(kind, { minD: 70 });
    if (!c) return null;
    return track(c, org, "cruise");
}

/** Street extents of a town s (from the town's data): { base, a0, a1 } | null. */
export function streetSpan(s) {
    const def = ctx.town && ctx.town.def;
    if (!def) return null;
    const s0 = def.s0 || 500000, id = Math.floor((s - s0 + 500) / 1000), st = def.streets[id];
    return st ? { base: s0 + id * 1000, a0: st.a0, a1: st.a1, name: st.name } : null;
}

/**
 * A vehicle on its way to a kerbside point { s, d } (road coords — a scene's stopped car,
 * Lulu's own stopped car…): it comes down the same street (or the highway) in the lane on
 * that side, slows and pulls in `gap` metres behind it. onArrive(V) once it's parked.
 */
export function respond(org, target, { gap = 7, lights = true, siren = false, v = 13, onArrive = null, from = 75 } = {}) {
    const kind = KIND[org];
    if (!has(kind)) return null;
    const dir = target.d >= 0 ? 1 : -1;
    let s;
    const span = inTown() ? streetSpan(target.s) : null;
    if (span) {
        const along = target.s - span.base;
        const a = clamp(along - dir * from, span.a0 + 4, span.a1 - 4);
        s = span.base + a;
    } else s = target.s - dir * Math.max(from, 120);
    const laneD = inTown() ? dir * 1.75 : (dir > 0 ? 5.25 : -5.25);
    const c = ctx.traffic.add(kind, s, laneD, dir, Math.min(v, 9), { keep: true, noNearMiss: true, data: {} });
    const V = track(c, org, "go", { lights, siren, v });
    V.laneD = laneD;
    V.go = { s: target.s - dir * gap, d: target.d, dir };
    V.onArrive = onArrive;
    c.ai = (dt, cc) => goAi(dt, cc, V);
    return V;
}

/** Follow Lulu round the grid (or down the highway) and sit `gapWant` m off her (negative = behind). */
export function pursue(V, { gapWant = -7, side = 0, vmax = null, lights = true } = {}) {
    const c = V.car;
    V.mode = "pursue"; V.gapWant = gapWant; V.side = side; V.lights = lights; V.t = 0;
    V.vmax = vmax || topSpeed() * 0.8;
    c.keep = true; c.noNearMiss = true; c.free = true;
    c.ai = (dt, cc) => pursueAi(dt, cc, V);
    return V;
}
/** Pull out and drive off (removed once she can't see it). */
export function leave(V, { lights = false } = {}) {
    if (!V || V.dead) return;
    const c = V.car;
    ctx.world.road.nearest(c.x, c.z, c.s, _n);
    const fwd = Math.sin(c.h) * Math.sin(_n.h) + Math.cos(c.h) * Math.cos(_n.h);
    c.dir = fwd >= 0 ? 1 : -1;
    c.s = _n.s; c.d = _n.d; c.dTarget = c.d;
    c.free = false;
    V.mode = "leave"; V.lights = lights; V.siren = false; V.t = 0;
    V.laneD = inTown() ? c.dir * 1.75 : (c.dir > 0 ? 5.25 : -5.25);
    c.keep = true;
    c.ai = (dt, cc) => leaveAi(dt, cc, V);
}
/** Stop dead where it is (lights as asked): a parked car with its flashers going. */
export function park(V, lights = true) {
    if (!V || V.dead) return;
    V.mode = "stop"; V.lights = lights;
    V.car.keep = true;
    V.car.ai = (dt, cc) => { cc.speed = Math.max(0, cc.speed - 12 * dt); if (cc.free) { cc.x += Math.sin(cc.h) * cc.speed * dt; cc.z += Math.cos(cc.h) * cc.speed * dt; } else cc.s += cc.speed * cc.dir * dt; };
}

// ── AIs ──────────────────────────────────────────────────────────────────
/** Metres to the nearest thing in this car's lane ahead (traffic or Lulu), road coords. */
function laneGap(c) {
    let gap = 1e9;
    for (const o of ctx.traffic.cars) {
        if (o === c || o.free || Math.abs(o.s - c.s) > 60 || Math.abs(o.d - c.d) > 1.9) continue;
        const g = (o.s - c.s) * c.dir;
        if (g > 0 && g < gap) gap = g;
    }
    const car = ctx.car;
    if (Math.abs(car.s - c.s) < 60 && Math.abs(car.d - c.d) < (onFoot() ? 1.4 : 1.9)) {
        const g = (car.s - c.s) * c.dir - (onFoot() ? 2.5 : 0);
        if (g > -1 && g < gap) gap = Math.max(0.1, g);
    }
    return gap;
}
function goAi(dt, c, V) {
    V.t += dt;
    const g = V.go;
    const rem = (g.s - c.s) * c.dir;
    let v = V.v;
    if (rem < 42) v = Math.min(v, Math.max(0, rem * 0.42));
    const gap = laneGap(c);
    if (gap < 26 && rem > 12) v = Math.min(v, Math.max(0, (gap - 6.5) * 0.7));
    c.speed += clamp(v - c.speed, -10 * dt, 4 * dt);
    c.speed = Math.max(0, c.speed);
    c.s += c.speed * c.dir * dt;
    const dW = rem < 24 ? g.d : V.laneD;
    c.dTarget = dW;
    c.d += clamp(dW - c.d, -1.7 * dt, 1.7 * dt);
    if ((rem < 0.8 && c.speed < 0.4) || rem < -2 || V.t > 45) {
        V.mode = "stop";
        c.speed = 0;
        c.ai = (d2, cc) => { cc.speed = 0; };
        if (V.onArrive) { const f = V.onArrive; V.onArrive = null; try { f(V); } catch (e) { console.error("[community] arrive", e); } }
    }
}
function leaveAi(dt, c, V) {
    V.t += dt;
    const v = inTown() ? 11 : 26;
    let want = v;
    const gap = laneGap(c);
    if (gap < 26) want = Math.min(want, Math.max(0, (gap - 6.5) * 0.7));
    c.speed += clamp(want - c.speed, -10 * dt, 3.5 * dt);
    c.s += c.speed * c.dir * dt;
    c.dTarget = V.laneD;
    c.d += clamp(V.laneD - c.d, -1.6 * dt, 1.6 * dt);
    const span = inTown() ? streetSpan(c.s) : null;
    const lp = luluPos(), far = Math.hypot(c.x - lp.x, c.z - lp.z);
    const atEnd = span && ((c.s - span.base) > span.a1 - 6 || (c.s - span.base) < span.a0 + 6);
    if (far > 110 || (atEnd && far > 35) || V.t > 40) setTimeout0(() => removeVehicle(V));
}
// (never remove a traffic car from inside traffic.update's own loop)
const later = [];
function setTimeout0(fn) { later.push(fn); }
export function flushLater() { while (later.length) { try { later.shift()(); } catch (e) { console.error(e); } } }

export function topSpeed() {
    const st = ctx.car && ctx.car.stats;
    return 42 * ((st && st.top) || 1) * 0.88;
}
function pursueAi(dt, c, V) {
    V.t += dt;
    const px = c.x, pz = c.z, ph = c.h;
    try { steer(dt, c, V); } catch (e) { console.error("[community] pursue", e); }
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.h) || !Number.isFinite(c.speed)) { c.x = px; c.z = pz; c.h = Number.isFinite(ph) ? ph : 0; c.speed = 0; }
}
function steer(dt, c, V) {
    const road = ctx.world.road, car = ctx.car, lp = luluPos();
    road.nearest(c.x, c.z, c.s, _n);
    c.s = _n.s; c.d = _n.d;
    const foot = onFoot();
    const lv = foot ? 0 : Math.max(0, car.vF || 0);
    const route = inTown() && ctx.town.copRoute ? ctx.town.copRoute(c) : null;
    const err = route ? route.gap + V.gapWant : car.s + V.gapWant - c.s;
    let vT = lv + clamp(err * 0.9, -12, 16);
    const dist = Math.hypot(lp.x - c.x, lp.z - c.z);
    if (foot && dist < 9) vT = Math.min(vT, Math.max(0, (dist - 5) * 0.8));
    // slow behind anything in the way
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    for (const o of ctx.traffic.cars) {
        if (o === c || o.hit) continue;
        const dx = o.x - c.x, dz = o.z - c.z, lon = dx * fx + dz * fz;
        if (lon > 0 && lon < 9 + c.speed * 0.4 && Math.abs(-dx * fz + dz * fx) < 2.2) vT = Math.min(vT, Math.max(0, o.speed * 0.9 - 1));
    }
    vT = clamp(vT, 0, V.vmax);
    const la = Math.max(7, c.speed * 0.55);
    if (route && dist > 14) route.aim(la, _p);
    else if (inTown() || dist < 14) { _p.x = lp.x - Math.sin(car.h) * 3 + Math.cos(car.h) * V.side; _p.z = lp.z - Math.cos(car.h) * 3 - Math.sin(car.h) * V.side; }
    else road.point(c.s + la, clamp(car.d + V.side, -5.25, 5.25), _p);
    const want = Math.atan2(_p.x - c.x, _p.z - c.z);
    const dh = wrap(want - c.h);
    if (Math.abs(dh) > 0.7) vT = Math.min(vT, 8);
    const v = Math.max(c.speed, 0.01);
    const maxYaw = Math.min(14 / v, v / 5, 2.2) * dt;
    c.h += clamp(dh, -maxYaw, maxYaw);
    const acc = Math.max(1.4, 8.5 * (1 - (c.speed / (V.vmax * 1.1)) ** 2));
    c.speed += clamp(vT - c.speed, -15 * dt, acc * dt);
    c.speed = Math.max(0, c.speed);
    c.x += Math.sin(c.h) * c.speed * dt;
    c.z += Math.cos(c.h) * c.speed * dt;
}

// ── per frame: lights, sirens, sightings, the town's cruisers ────────────
export function tickFleet(dt) {
    flushLater();
    const t = ctx.time, lp = luluPos();
    for (const V of CM.vehicles) {
        V.t += V.mode === "cruise" || V.mode === "traffic" || V.mode === "stop" ? dt : 0;
        setLights(V.rig, V.lights, t + V.phase, V.org);
        // the located wail (Hatzalah) — only once positional audio is up
        if (V.siren && !V.sp && A.spatial.ready && !ctx.skipping) V.sp = A.spatial.loop("ambulance", V.car.obj, { floor: 0 });
        else if (!V.siren && V.sp) V.sp = V.sp.stop();
        // Lulu notices (once per org per visit)
        if (!CM.seen.has(V.org) && Math.hypot(V.car.x - lp.x, V.car.z - lp.z) < 30) {
            CM.seen.add(V.org);
            if (Math.random() < 0.75) luluSay(pick(LULU_SEES[V.org]));
        }
    }
}

/** Highway sightings as she nears a town's exit (and just after it). */
export function tickHighway(dt) {
    if (inTown() || !on() || !CM.loaded || !ctx.town || ctx.state !== "playing" || ctx.G.mode !== "cruise") return;
    const car = ctx.car;
    let cfg = null, ahead = 1e9;
    for (const e of ctx.town.exits || []) {
        const c = forTown(e.id);
        if (!c) continue;
        const a = e.s - car.s;
        if (a > -250 && a < c.approach && a < ahead) { ahead = a; cfg = c; }
    }
    if (!cfg) return;
    if (!CM.saidApproach) { CM.saidApproach = true; CM.hwT = Math.min(CM.hwT, 2.5); }
    CM.hwT -= dt;
    if (CM.hwT > 0) return;
    const H = cfg.highway;
    CM.hwT = rand(H.every[0], H.every[1]) * (ahead < cfg.approach * 0.4 ? 0.7 : 1);
    if (CM.vehicles.filter(V => V.mode === "traffic").length >= H.max) return;
    const orgs = Object.keys(H.weights).filter(o => cfg.orgs[o]);
    let r = Math.random() * orgs.reduce((a, o) => a + H.weights[o], 0), org = orgs[0];
    for (const o of orgs) { if ((r -= H.weights[o]) <= 0) { org = o; break; } }
    // a roadside scene instead (scenes.js listens)
    if (org === "chaverim" && Math.random() < H.roadside && CM.onRoadside) { CM.onRoadside(); return; }
    if (org === "hatzalah" && Math.random() < 0.5) {
        // responding: lights + siren, flying up the fast lane past her
        const V = spawnHighway("hatzalah", { s: car.s - 90, d: 1.75, dir: 1, speed: Math.max(33, car.speed + 7), lights: true, siren: true });
        if (V) { V.car.base = V.car.want = V.car.speed; }
        return;
    }
    const oncoming = Math.random() < 0.45;
    const sp = org === "shomrim" ? rand(18, 21) : rand(19, 24);
    spawnHighway(org, oncoming ? { s: car.s + rand(420, 520), d: pick([-1.75, -5.25]), dir: -1, speed: sp, lights: org === "shomrim" && Math.random() < 0.3 }
        : { s: car.s + rand(300, 380), d: 5.25, dir: 1, speed: sp, lights: false });
    if (!CM.saidApproach2) { CM.saidApproach2 = true; setTimeout0(() => luluSay(pick(LULU_SEES.approach))); }
}

/** Keep the town's cruisers on the streets (the town's own lane AI drives them). */
export function tendCruisers(dt) {
    const cfg = townCfg();
    if (!cfg || !CM.loaded || !on()) return;
    CM.tendT = (CM.tendT || 0) - dt;
    if (CM.tendT > 0) return;
    CM.tendT = 1.5;
    const lp = luluPos();
    for (const V of CM.vehicles.slice()) {
        if (V.mode !== "cruise") continue;
        const far = Math.hypot(V.car.x - lp.x, V.car.z - lp.z) > 80;
        const T = V.car.data.town;
        if (far && ((V.car.hit && V.car.hitT > 6) || (T && T.stuck > 20))) removeVehicle(V);
        // a Hatzalah cruiser is ALWAYS responding to something (a stubbed toe on Forest Ave)
        if (V.org === "hatzalah") V.lights = Math.sin(ctx.time * 0.11 + V.phase * 6) > 0.35;
    }
    for (const [org, n] of Object.entries(cfg.cruisers || {})) {
        if (!cfg.orgs[org]) continue;
        const have = CM.vehicles.filter(V => V.org === org && V.mode === "cruise").length;
        if (have < n) spawnCruiser(org);
    }
}

/** The nearest Shomrim car (any mode) that can see her within r metres, or null. */
export function shomrimSees(r = 55) {
    const lp = luluPos();
    let best = null, bd = r;
    for (const V of CM.vehicles) {
        if (V.org !== "shomrim" || V.car.hit) continue;
        const d = Math.hypot(V.car.x - lp.x, V.car.z - lp.z);
        if (d > bd) continue;
        if (inTown() && ctx.town.blocksSight(V.car.x, V.car.z, lp.x, lp.z)) continue;
        bd = d; best = V;
    }
    return best;
}
export { THREE };
