// features/heist — 🦸‍♀️ FOIL A ROBBERY. Now and then, near a bank or a store, a cartoon robbery is
// under way: a robber in a striped shirt and a mask bursts out with a money bag and a banana (or a
// water pistol, a baguette, a confetti blaster), jumps into a purple getaway car and peels out.
//
//   in a town     at the bank (or the pizza shop / the bakery / the hall) — the getaway car is a town
//                 driver (ctx.town.addDriver at the door): it follows the streets, rolls the stop signs
//   on the highway at the KOSHER QUIK-MART, a roadside store set up ~720 m ahead (world.reserve); the
//                 getaway car flees up the lanes, a cruiser comes wailing up behind it
//
// Stop it: RAM it (3 rams), PIT it (features/moves: data.pit) or BOX IT IN (it sits stuck with her car
// right there). On foot, before he reaches the car: ✋ TACKLE (foot's addSpot). Cops show up for the
// collar; they never chase Lulu for helping (ctx.law.hold while it plays; rams into the getaway car never
// cost a heart). Pays PAY.foil (+ clean / tackle bonuses), a hero toast, stats, a memory line.
import * as THREE from "three";
import { ctx, on, hook, emit, addActor, wrapAngle } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { registerKind } from "../../traffic.js";
import { spawnPerson } from "../../core/people.js";
import { facingRoad } from "../../world.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { TUNE, PAY, PROPS, ROBBER_NAMES, STORE_NAMES, ROBBERY } from "./data.js";
import { models, cloneWithColors, findNodes, need, live, rand, pick, clamp, pt, onFoot, luluPos, distTo, stat, remember,
    luluSays, npcSays, hold, setChip, setBeacon, fmtM, sfx, confetti, burst, inTown, g } from "./common.js";

registerKind("heist_getaway", { len: 4.6, halfW: 0.92, circles: [1.3, -1.3], r: 0.95, mass: 1.3, model: "heistGetaway", paint: false });
const MODELS = ["heistGetaway", "heistRobber", "heistProps", "copPerson"];
const T = TUNE.robbery;
const TOWN_SPOTS = ["bank", "pizza", "bakery", "hall"];

export const R = { nextT: rand(T.first[0], T.first[1]), ev: null, store: null, log: [] };

/** Lulu's top speed WITHOUT nitro (what drag lets the engine reach) — the same sum law uses. */
export function luluTop() {
    const st = ctx.car && ctx.car.stats;
    const top = 42 * ((st && st.top) || 1), acc = 12.5 * ((st && st.acc) || 1);
    let lo = 4, hi = top;
    for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (acc * (1 - (m / top) ** 2) - (0.35 + 0.0016 * m * m) > 0) lo = m; else hi = m; }
    return lo;
}

// ── the highway's roadside store ────────────────────────────────────────
function placeStore(s) {
    if (!models.heistStore) return null;
    const d = 17.5;
    const obj = cloneWithColors(models.heistStore);
    const p = pt(s, d);
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = facingRoad(p.h, 1);
    ctx.scene.add(obj);
    const w = ctx.world;
    w.reserve(s - 16, s + 16, 1, 9, 30);
    const res = w.reserved[w.reserved.length - 1];
    obj.updateMatrixWorld(true);
    const door = new THREE.Vector3();
    const a = findNodes(obj, "Anchor_door")[0];
    if (a) a.getWorldPosition(door); else door.set(p.x, 0, p.z);
    const pts = [];
    for (const u of [-5, 0, 5]) { const q = pt(s + u, d); pts.push({ x: q.x, z: q.z, r: 4.2 }); }
    const st = { s, d, obj, door, alive: true };
    st.actor = addActor({
        update() { return st.alive && ctx.car.s - s < 190; },
        collide(car) {
            for (const c of pts) {
                const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
                if (dx * dx + dz * dz > (c.r + 3) ** 2) continue;
                const imp = car.collideStatic(c.x, c.z, c.r);
                if (imp) return { impact: imp, why: "store", source: "heist" };
            }
            return null;
        },
        dispose() { st.alive = false; if (obj.parent) obj.parent.remove(obj); const i = w.reserved.indexOf(res); if (i >= 0) w.reserved.splice(i, 1); if (R.store === st) R.store = null; },
    });
    return st;
}

// ── staging ─────────────────────────────────────────────────────────────
/** A town spot with a door (bank first) at a sensible distance from her, or null. */
function townSpot(force = null) {
    const names = force ? [force] : TOWN_SPOTS;
    const out = [];
    for (const n of names) {
        const sp = ctx.town.spot(n);
        if (!sp) continue;
        const d = distTo(sp.x, sp.z);
        if (force || (d > T.townR[0] && d < T.townR[1])) out.push({ name: n, sp, d });
    }
    if (!out.length) return null;
    return out.find(o => o.name === "bank") || out[0];
}

/** Stage a robbery. opts: { where: "town" | "highway", spot (a town spot name), prop, now (the robber runs out at once) } */
export function stage(opts = {}) {
    if (R.ev) return false;
    if (ctx.law && ctx.law.chasing) return false;
    const town = opts.where ? opts.where === "town" : inTown();
    if (town && !inTown()) return false;
    const prop = opts.prop ? PROPS.find(p => p.id === opts.prop) || PROPS[0] : pick(PROPS);
    const ev = { where: town ? "town" : "highway", prop, name: pick(ROBBER_NAMES), phase: "staged", t: 0, rams: 0, ramT: 0, boxT: 0,
        robber: null, car: null, cop: null, copPerson: null, hearts: ctx.G.hearts, foot: false, tackled: false, spotRm: null, siren: null, ready: false };
    if (town) {
        const ts = townSpot(opts.spot || null);
        if (!ts) return false;
        ev.spotName = ts.name;
        ev.door = new THREE.Vector3(ts.sp.x, 0, ts.sp.z);
        ev.label = ts.name === "bank" ? bankName() : STORE_NAMES[ts.name] || "the shop";
        ev.trig = true;
    } else {
        const s = opts.s || unbuiltAhead(TUNE.robbery.storeAhead);
        ev.storeS = s;
        ev.label = STORE_NAMES.store;
        ev.trig = !!opts.now;
    }
    R.ev = ev;
    need(MODELS.concat(town ? [] : ["heistStore"])).then(ok => {
        if (R.ev !== ev) return;
        if (!ok) { cleanup(); return; }
        if (!town) {
            R.store = placeStore(ev.storeS);
            if (!R.store) { cleanup(); return; }
            ev.door = R.store.door.clone();
        }
        ev.ready = true;
    });
    emit("heist:robbery", { phase: "staged", where: ev.where, at: ev.spotName || "store" });
    return true;
}
function bankName() { try { const id = ctx.town && ctx.town.id; return id === "midwood" ? "Kings County Savings & Bagel" : "the First Minivan Bank"; } catch (e) { return "the bank"; } }
function unbuiltAhead(min, half = 24) {
    const w = ctx.world, C = 200;
    let s = ctx.car.s + min;
    for (let i = 0; i < 12 && w && w.chunks && (w.chunks.has(Math.floor((s - half) / C)) || w.chunks.has(Math.floor((s + half) / C))); i++) s += 40;
    return s;
}

// ── the robbery starts: the car at the kerb, the robber bursts out ──────
function begin(ev) {
    ev.phase = "run"; ev.t = 0;
    // the getaway car, waiting at the kerb with the engine running
    const carData = { heist: true, pit: true, heistGetaway: true, partyLocal: true, local: true };
    if (ev.where === "town") {
        ev.car = ctx.town.addDriver("heist_getaway", { at: { x: ev.door.x, z: ev.door.z }, speed: 0, cruise: 0.01 });
        if (ev.car) { Object.assign(ev.car.data, carData); ev.car.data.town.cruise = 0; ev.car.data.town.roll = true; ev.car.keep = true; }
    } else {
        const s = ev.storeS + 9;
        ev.car = ctx.traffic.add("heist_getaway", s, 8.3, 1, 0, { keep: true, noNearMiss: true, data: carData, ai: (dt, c) => hwyAi(dt, c, ev) });
    }
    if (!ev.car) { cleanup(); return; }
    ev.car.onCrash = e => { onRam(ev, e); return false; };      // ramming the robbers never costs a heart
    // the robber, out the door with the bag and the "weapon"
    const p = spawnPerson("heistRobber");
    p.obj.position.copy(ev.door);
    ctx.scene.add(p.obj);
    hold(p, "MoneyBag", { arm: "Arm_L", y: -0.5, z: 0.05, rx: 0 });
    ev.propObj = hold(p, ev.prop.id, { arm: "Arm_R", y: -0.47, z: 0.06, rx: -1.4 });
    ev.robber = p;
    sfx.bell(8);
    ev.foot = onFoot();
    H.banner(ev.foot ? ROBBERY.footBanner(ev.label) : ROBBERY.banner(ev.label, ev.prop.name), 3200, { key: "heist:robbery", prio: 3 });
    npcSays(p.obj, pick(ev.prop.says), 2.4);
    setTimeout(() => { if (R.ev === ev) luluSays(pick(ROBBERY.lulu), true); }, 900);
    if (ctx.foot && ctx.foot.addSpot) {
        ev.spotRm = ctx.foot.addSpot({ pos: () => (R.ev === ev && ev.phase === "run" && ev.robber ? ev.robber.obj.position : null), r: 2.8,
            label: "🏈 TACKLE HIM!", short: "TACKLE", act: () => tackle(ev) });
    }
    emit("heist:robbery", { phase: "start", where: ev.where, at: ev.spotName || "store", prop: ev.prop.id });
}

/** The robber's sprint to the car (and, when it's done, the getaway). */
function runRobber(dt, ev) {
    const p = ev.robber, c = ev.car;
    if (!p || !c) return;
    const lx = Math.cos(c.h), lz = -Math.sin(c.h);         // the car's LEFT (driver's door)
    const tx = c.x + lx * 1.3, tz = c.z + lz * 1.3;
    const dx = tx - p.obj.position.x, dz = tz - p.obj.position.z, d = Math.hypot(dx, dz);
    if (d > 0.5 && ev.t < 6) {
        const v = 4.6 * dt;
        p.obj.position.x += dx / d * Math.min(v, d); p.obj.position.z += dz / d * Math.min(v, d);
        p.face(tx, tz, dt, 10);
        p.update(dt, { walk: 4.6 });
        if (ev.propObj) ev.propObj.rotation.z = Math.sin(ctx.time * 12) * 0.4;
        return;
    }
    // in he hops: he sits at the wheel, the prop out the window
    ctx.scene.remove(p.obj);
    const anchor = findNodes(c.obj, "Anchor_driver")[0];
    (anchor || c.obj).add(p.obj);
    p.obj.position.set(anchor ? 0 : 0.38, anchor ? -0.62 : 0, 0);
    p.obj.rotation.set(0, 0, 0);
    p.seated = true;
    ev.phase = "flee"; ev.t = 0;
    if (ev.where === "town" && c.data.town) c.data.town.cruise = T.townCruise;
    copsComing(ev);
    if (ev.spotRm) { ev.spotRm(); ev.spotRm = null; }
    if (onFoot()) H.toast("🚗 He's in the car! Grab a ride — or let the cops have him", "pink", { key: "heist:foot" });
}

// ── the getaway car's drive (highway) ───────────────────────────────────
function hwyAi(dt, c, ev) {
    if (ev.phase === "staged" || ev.phase === "run") { c.speed = 0; return; }
    if (ev.phase === "foiled" || ev.phase === "done") {
        c.speed = Math.max(0, c.speed - 12 * dt);
        c.d += (8.2 - c.d) * Math.min(1, dt * 1.6);
        c.dTarget = c.d;
        c.s += c.speed * dt;
        return;
    }
    // flee: up to ~0.8 × her top, keeps to her side, weaves round traffic
    const want = luluTop() * T.hwySpeed;
    c.speed += clamp(want - c.speed, -12 * dt, 7 * dt);
    if (c.d > 6.5) c.dTarget = 5.25;
    let ahead = null, gap = 1e9;
    for (const o of ctx.traffic.cars) {
        if (o === c || o.dir < 0 || Math.abs(o.d - c.dTarget) > 1.9) continue;
        const gg = o.s - c.s;
        if (gg > 0 && gg < gap) { gap = gg; ahead = o; }
    }
    if (ahead && gap < 30) {
        const other = Math.abs(c.dTarget - 1.75) < 0.5 ? 5.25 : 1.75;
        if (ctx.traffic.laneFree(c.s, other, 1, 14)) c.dTarget = other;
        else c.speed = Math.min(c.speed, ahead.speed + gap * 0.3);
    }
    c.d += clamp(c.dTarget - c.d, -2.4 * dt, 2.4 * dt);
    c.s += c.speed * dt;
}

// ── the cops (a cosmetic cruiser on the highway; a siren + a car at the end in town) ──
function copsComing(ev) {
    sfx.siren(1.6);
    if (ev.where !== "highway") { townCop(ev); return; }
    const car = ctx.car;
    ev.cop = ctx.traffic.add("cop", Math.min(car.s, ev.car.s) - 110, 1.75, 1, Math.max(20, car.speed), {
        keep: true, noNearMiss: true, data: { heist: true, heistCop: true, partyLocal: true, local: true },
        ai: (dt, c) => copAi(dt, c, ev),
    });
    ev.cop.onCrash = () => false;
    lightBar(ev, ev.cop);
}
/** In a town: a real cruiser joins on the street grid (law's spawn point) and chases the GETAWAY car round the
 *  corners (the town's own router, ctx.town.copRoute(c, u, target)) — never her. */
function townCop(ev) {
    if (!models.cop || !ctx.town.copSpawn || !ctx.town.copRoute) return;
    const sp = ctx.town.copSpawn("seen", false);
    if (!sp) return;
    ev.cop = ctx.traffic.add("cop", sp.s, sp.d, sp.dir || 1, 8, { keep: true, noNearMiss: true,
        data: { heist: true, heistCop: true, local: true, partyLocal: true }, ai: (dt, c) => townCopAi(dt, c, ev) });
    ev.cop.free = true;
    ev.cop.onCrash = () => false;
    lightBar(ev, ev.cop);
}
const _tn = {}, _tp = {};
function townCopAi(dt, c, ev) {
    const gc = ev.car;
    const n = ctx.world.road.nearest(c.x, c.z, c.s, _tn);
    c.s = n.s; c.d = n.d;
    const route = gc && ctx.traffic.cars.includes(gc) ? ctx.town.copRoute(c, null, gc) : null;
    let vT = 0;
    if (route) {
        const stopped = ev.phase !== "flee";
        vT = stopped ? clamp((route.gap - 9) * 1.2, 0, 13) : clamp((gc.speed || 0) + (route.gap - 14) * 0.8, 0, 17);
        route.aim(Math.max(6, c.speed * 0.55), _tp);
        const dh = wrapAngle(Math.atan2(_tp.x - c.x, _tp.z - c.z) - c.h);
        if (Math.abs(dh) > 0.7) vT = Math.min(vT, 7);
        const v = Math.max(c.speed, 0.01), maxYaw = Math.min(14 / v, v / 5, 2.2) * dt;
        c.h += clamp(dh, -maxYaw, maxYaw);
    }
    c.speed += clamp(vT - c.speed, -14 * dt, 8 * dt);
    c.speed = Math.max(0, c.speed);
    c.x += Math.sin(c.h) * c.speed * dt;
    c.z += Math.cos(c.h) * c.speed * dt;
    if (ev.bar) ev.bar.set(true);
}
function lightBar(ev, c) {
    try { if (ctx.law && ctx.law.lightBar) { ev.bar = ctx.law.lightBar(c.obj); ev.bar.set(true); } } catch (e) { /* */ }
    try { if (A.spatial && A.spatial.ready) ev.siren = A.spatial.loop("siren", c.obj, { gain: 0.7 }); } catch (e) { ev.siren = null; }
}
function copAi(dt, c, ev) {
    const gc = ev.car;
    if (!gc) { c.speed = Math.max(0, c.speed - 8 * dt); c.s += c.speed * dt; return; }
    const stopped = ev.phase === "foiled" || ev.phase === "done";
    const wantS = gc.s - (stopped ? 9 : 34);
    const err = wantS - c.s;
    const vT = stopped ? clamp(err * 1.2, 0, 26) : clamp(gc.speed + err * 0.6, 0, luluTop() * 0.95);
    c.speed += clamp(vT - c.speed, -14 * dt, 8 * dt);
    c.dTarget = stopped ? 8.0 : gc.d;
    c.d += clamp(c.dTarget - c.d, -2.2 * dt, 2.2 * dt);
    c.s += c.speed * dt;
    if (ev.bar) ev.bar.set(true);
}

// ── stopping it ─────────────────────────────────────────────────────────
function onRam(ev, e) {
    if (!e || ev.phase !== "flee" && ev.phase !== "run") return;
    if ((e.impact || 0) < 1.2 || ev.ramT > ctx.time) return;
    ev.ramT = ctx.time + 0.6;
    ev.rams++;
    sfx.pop();
    burst(ev.car.x, 1.0, ev.car.z, 10, 3, [1, 0.85, 0.3], 0.3, 0.6);
    if (ev.rams < T.rams) { H.toast(`💥 RAM ${ev.rams}/${T.rams}`, "gold", { key: "heist:ram" }); if (ev.robber) npcSays(ev.robber.obj, pick(["HEY! Watch the paint!", "Lady, are you CRAZY?!", "My insurance!!"]), 1.6); }
    else foil(ev, "ram");
}
function tackle(ev) {
    if (R.ev !== ev || ev.phase !== "run" || !ev.robber) return;
    ev.tackled = true;
    const o = ev.robber.obj;
    o.rotation.order = "YXZ";
    o.rotation.x = -1.45;
    o.position.y = 0.25;
    burst(o.position.x, 0.6, o.position.z, 14, 3, [1, 1, 1], 0.35, 0.7);
    confetti(o.position.x, 1.0, o.position.z, 20);
    sfx.pop();
    if (ctx.foot && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(["TOUCHDOWN!", "Not on MY sidewalk!", "Gotcha, stripey!"]), 2);
    if (ev.spotRm) { ev.spotRm(); ev.spotRm = null; }
    stat("heistTackles", 1);
    foil(ev, "tackle");
}

function foil(ev, how) {
    if (ev.phase === "foiled" || ev.phase === "done") return;
    ev.phase = "foiled"; ev.t = 0; ev.how = how;
    if (ev.where === "town" && ev.car && ev.car.data.town) ev.car.data.town.cruise = 0;
    // the robber out of the car (unless he never got in), hands up
    const p = ev.robber;
    if (p && p.seated) {
        p.seated = false;
        if (p.obj.parent) p.obj.parent.remove(p.obj);
        const c = ev.car, lx = Math.cos(c.h), lz = -Math.sin(c.h);
        p.obj.position.set(c.x + lx * 1.6, 0, c.z + lz * 1.6);
        ctx.scene.add(p.obj);
    }
    if (ev.propObj && ev.propObj.parent) ev.propObj.parent.remove(ev.propObj);
    // the town's collar: a cruiser rolls up behind the getaway car
    if (ev.where === "town" && ev.car && models.cop && !ev.cop) {
        const c = ev.car, fx = Math.sin(c.h), fz = Math.cos(c.h);
        const near = ctx.world.road.nearest(c.x - fx * 9, c.z - fz * 9, c.s, {});
        ev.cop = ctx.traffic.add("cop", near.s, c.d, c.dir || 1, 0, { keep: true, noNearMiss: true, data: { heist: true, heistCop: true, local: true, partyLocal: true },
            ai: (dt, cc) => { cc.speed = 0; } });
        ev.cop.free = true; ev.cop.x = c.x - fx * 9; ev.cop.z = c.z - fz * 9; ev.cop.h = c.h;
        ctx.traffic.place(ev.cop, 0);
        ev.cop.onCrash = () => false;
        lightBar(ev, ev.cop);
    }
    // the reward
    const G = ctx.G;
    let pay = Math.round(rand(PAY.foil[0], PAY.foil[1]));
    const clean = (G.hearts || 0) >= (ev.hearts || 0);
    if (clean) pay += PAY.foilClean;
    if (how === "tackle") pay += PAY.tackle;
    pay = Math.round(pay / 5) * 5;
    ev.pay = pay;
    addCoins(pay, "heist:foil");
    sfx.yay();
    const how2 = how === "tackle" ? "a flying tackle" : how === "pit" ? "a PIT maneuver" : how === "box" ? "boxed him in" : "three good rams";
    H.banner(`<b>🦸‍♀️ ROBBERY FOILED! +${pay} 💰</b><small>${how2}${clean ? " · not a scratch" : ""} · the cops take it from here</small>`, 3000, { key: "heist:robbery", prio: 3 });
    H.toast("🦸‍♀️ HERO OF THE BLOCK!", "gold", { key: "heist:hero" });
    if (p) npcSays(p.obj, pick(ROBBERY.foiled).replace("{prop}", ev.prop.name.toLowerCase()), 2.6);
    setTimeout(() => { if (R.ev === ev) luluSays(pick(ROBBERY.hero), true); }, 1500);
    stat("heistFoils", 1);
    remember("foil", { where: ev.where, at: ev.spotName || "store", how, pay, town: ctx.town && ctx.town.id || "" });
    R.log.push({ how, pay, where: ev.where });
    emit("heist:robbery", { phase: "foiled", where: ev.where, how, pay, clean });
    if (ctx.phone && ctx.phone.text && Math.random() < 0.7 && !ctx.TEST) {
        setTimeout(() => { try { ctx.phone.text({ from: "Mishpacha 💕🙄", thread: "mishpacha", emoji: "📺", color: "#E91E63", msg: pick(["IMA: Lulu is on the NEWS?! Stopping a ROBBER?! I'm calling everyone.", "HESHY: bro u tackled a guy holding a BANANA 💀", "BUBBE: My hero. Now EAT something."]) }); } catch (e) { /* */ } }, 4000);
    }
}

function escaped(ev) {
    if (ev.phase === "done") return;
    ev.phase = "done"; ev.t = 0;
    H.banner(`<b>${ROBBERY.escaped}</b><small>no harm done — and no reward</small>`, 2400, { key: "heist:robbery", prio: 2 });
    emit("heist:robbery", { phase: "escaped", where: ev.where });
    ev.escaped = true;
}

// ── per frame ───────────────────────────────────────────────────────────
function tick(dt) {
    const ev = R.ev;
    if (!ev) return;
    ev.t += dt;
    if (ev.phase !== "done" && ctx.law && ctx.law.hold) ctx.law.hold(0.6);     // helping ≠ a crime: no cop pounces on HER
    if (!ev.ready) { if (ev.t > 20) cleanup(); return; }
    if (ev.phase === "staged") {
        if (ev.where === "highway") {
            const rel = ev.storeS - ctx.car.s;
            if (rel < -60) { cleanup(); return; }                   // she drove past before it began
            if (ev.trig || rel < T.trigger) begin(ev);
        } else begin(ev);
        return;
    }
    if (!ev.car || !ctx.traffic.cars.includes(ev.car)) { if (ev.phase !== "done") { ev.phase = "done"; } cleanup(); return; }
    const c = ev.car, gap = distTo(c.x, c.z);
    if (ev.phase === "run") runRobber(dt, ev);
    else if (ev.phase === "flee") {
        if (c.hit) { foil(ev, c.data.movesPitT > ctx.time - 1 ? "pit" : "spin"); }
        else {
            // boxed in: stuck, with her car right there
            const stuck = c.speed < 2.5 && !onFoot() && gap < 9;
            ev.boxT = stuck ? ev.boxT + dt : Math.max(0, ev.boxT - dt * 0.5);
            if (ev.boxT >= T.boxT && ev.t > 2) foil(ev, "box");
            else if (ev.t > T.maxT || gap > T.lostR) escaped(ev);
        }
    }
    // the HUD: one chip + the beacon
    if (ev.phase === "run" || ev.phase === "flee") {
        const what = ev.phase === "run" && onFoot() ? "🏈 TACKLE THE ROBBER" : "🦹 STOP THE GETAWAY CAR";
        const sub = ev.phase === "run" && onFoot() ? `${g("interact")} tackle · ${fmtM(distTo(ev.robber.obj.position.x, ev.robber.obj.position.z))}`
            : `💥 ram ${ev.rams}/${T.rams} · PIT it · box it in · ${fmtM(gap)}`;
        setChip(what, sub, ev.phase === "flee" ? 1 - ev.t / T.maxT : null, "#FF4081");
        setBeacon(ev.phase === "run" ? ev.robber.obj : { x: c.x, y: 0, z: c.z, lift: 2.6 }, "#FF4081");
    } else { setChip(null); setBeacon(null); }
    // the end of it: the robber hands up, the cop walks over; everything tidies away
    if (ev.phase === "foiled") {
        const p = ev.robber;
        if (p) { p.update(dt, { cheer: true }); p.face(luluPos().x, luluPos().z, dt, 4); }
        if (!ev.copPerson && ev.t > 1.2 && models.copPerson && p) {
            const cp = spawnPerson("copPerson");
            const o = p.obj.position;
            cp.obj.position.set(o.x - Math.sin(c.h) * 4, 0, o.z - Math.cos(c.h) * 4);
            ctx.scene.add(cp.obj);
            ev.copPerson = cp;
            npcSays(cp.obj, pick(ROBBERY.cop), 2.8, "cop");
        }
        if (ev.copPerson && p) {
            const cp = ev.copPerson, o = p.obj.position, q = cp.obj.position;
            const dx = o.x - q.x, dz = o.z - q.z, d = Math.hypot(dx, dz);
            if (d > 1.1) { q.x += dx / d * 2.2 * dt; q.z += dz / d * 2.2 * dt; cp.face(o.x, o.z, dt, 8); cp.update(dt, { walk: 2.2 }); }
            else cp.update(dt, { point: true });
        }
        if (ev.t > 14 || (ev.t > 4 && gap > 140)) cleanup();
    } else if (ev.phase === "done") {
        if (ev.t > 1 && (gap > 120 || ev.t > 8)) cleanup();
    }
}

/** Everything gone (cars, people, the store stays until she's past it). */
export function cleanup() {
    const ev = R.ev;
    R.ev = null;
    setChip(null); setBeacon(null);
    if (!ev) return;
    if (ev.spotRm) { try { ev.spotRm(); } catch (e) { /* */ } }
    if (ev.siren) { try { ev.siren.stop(); } catch (e) { /* */ } }
    if (ev.robber && ev.robber.obj.parent) ev.robber.obj.parent.remove(ev.robber.obj);
    if (ev.copPerson && ev.copPerson.obj.parent) ev.copPerson.obj.parent.remove(ev.copPerson.obj);
    for (const c of [ev.car, ev.cop]) if (c && ctx.traffic.cars.includes(c)) { if (ev.bar && c === ev.cop) ev.bar.set(false); ctx.traffic.remove(c); }
    R.nextT = rand(T.every[0], T.every[1]);
}

// ── the scheduler: Cruise (the highway and the towns), never in a chase / a job / the tutorial ──
hook("update", (dt, P, controlsOn) => {
    if (R.ev || !controlsOn || ctx.state !== "playing" || !live()) return;
    const G = ctx.G;
    if (G.mode !== "cruise" || G.tutorial || (ctx.law && (ctx.law.chasing || ctx.law.reported)) || (ctx.heist && ctx.heist.busy && ctx.heist.busy("robbery"))) return;
    R.nextT -= dt;
    if (R.nextT > 0) return;
    R.nextT = rand(20, 35);     // (try again soon if nothing fits right now)
    if (inTown()) stage({ where: "town" });
    else if (!(ctx.exits && ctx.exits.inside)) stage({ where: "highway" });
});
// the event itself ticks every frame of driving AND walking (footRun runs the HUD hook too, not the driving sim's)
hook("hud", dt => {
    if (ctx.paused || (ctx.state !== "playing" && ctx.state !== "footRun")) return;
    try { tick(dt); } catch (e) { console.error("[heist robbery]", e); }
});
on("state", ({ to }) => {
    if (!R.ev) return;
    if (to === "title" || to === "gameover" || (ctx.states[to] && ctx.states[to].driving === false && to !== "footRun" && to !== "playPhoto")) cleanup();
});
on("town:leave", () => { if (R.ev && R.ev.where === "town") cleanup(); });
on("town:enter", () => { if (R.ev && R.ev.where === "highway") cleanup(); });
hook("runStart", () => { cleanup(); if (R.store && R.store.actor) R.store.alive = false; R.nextT = rand(T.first[0], T.first[1]); R.log.length = 0; });
on("title", () => cleanup());
export const robberyTick = tick;
