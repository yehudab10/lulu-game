// features/community — ROADSIDE SCENES: other people's problems, on the kerb in town (and on
// the highway's shoulder as she nears the exit). A silver minivan with a flat / a lockout /
// a dead battery (→ Chaverim), a bochur who came off his e-bike (→ Hatzalah). Somebody calls
// it in after a while anyway; if LULU calls first (the 📞 app, or ✋ on foot), it's a mitzvah:
// coins, a stat, and the group chat is confused about her for once. One scene at a time.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { models, cloneWithColors, findNodes } from "../../models.js";
import * as H from "../../hud.js";
import { CM, on, onFoot, luluPos, rand, pick, clamp, getPerson, putPerson, walkTo, bubble, luluSay, sfx, stat, townCfg, hintOnce, later } from "./common.js";
import { respond, leave, removeVehicle } from "./fleet.js";
import { SCENES, ARRIVE_FAST, CHESED, GOSSIP_CHESED, LULU_CALL, ORGS } from "./lines.js";

const VICTIM = { flat: ["town_mom", "npcWoman"], lockout: ["town_local", "npcMan"], battery: ["npcMan", "town_local"], hurt: ["town_bochur", "npcMan"] };
const WORKER = { chaverim: "community_volunteer", hatzalah: "community_emt", shomrim: "community_shomer" };
const _v = new THREE.Vector3();
const hazGeo = new THREE.SphereGeometry(0.09, 8, 6);
const hazMat = new THREE.MeshStandardMaterial({ color: "#FFB300", emissive: "#FFB300", emissiveIntensity: 2.5 });
let bike = null, spare = null;

const inTown = () => !!(ctx.town && ctx.town.active);
const keyOf = list => list.find(k => models[k]) || "npcMan";

/** Start a scene of `kind` (random if omitted) near her: in town on a free kerb, else on the highway's shoulder ahead. */
export function startScene(kind = null, opts = {}) {
    if (CM.scene || !CM.loaded) return null;
    const town = inTown();
    const cfg = townCfg();
    const kinds = (town && cfg ? cfg.scenes.kinds : ["flat", "lockout", "battery"]).filter(k => SCENES[k] && (!cfg || cfg.orgs[SCENES[k].org] !== false));
    kind = kind || pick(kinds);
    const def = SCENES[kind];
    if (!def) return null;
    let at = opts.at || null;          // (a 🎉 party picks the kerb from its seed: party.js)
    if (at) { /* given */ } else if (town) {
        const k = ctx.town.curbSpot({ len: kind === "hurt" ? 9 : 14, minD: opts.minD || 40, maxD: opts.maxD || 130, near: opts.near || null });
        if (!k) return null;
        at = { x: k.x, z: k.z, s: k.s, d: k.d, h: k.h, side: k.side, street: k.street };
    } else {
        const s = ctx.car.s + (opts.ahead || rand(280, 340)), p = ctx.world.road.point(s, 8.3, {});
        at = { x: p.x, z: p.z, s, d: 8.3, h: p.h, side: 1, street: null };
    }
    const sc = { kind, def, org: def.org, at, town, phase: "wait", t: opts.t0 || 0, callT: opts.callT != null ? opts.callT : rand(22, 36), called: false, byLulu: false,
        pleadT: 0, van: null, haz: null, victim: null, worker: null, V: null, prop: null, said: 0 };
    // the stranded minivan (a stopped traffic car: crash into it, carjack it — it's real)
    if (kind !== "hurt") {
        const vk = models.town_minivan ? "town_van" : "van";
        sc.van = ctx.traffic.add(vk, at.s, at.d, at.side, 0, { ai: (dt, c) => { c.speed = 0; }, keep: true, noNearMiss: true, data: { communityScene: sc } });
        const g = new THREE.Group();
        for (const sx of [-0.8, 0.8]) for (const sz of [-2.45, 2.45]) { const b = new THREE.Mesh(hazGeo, hazMat); b.position.set(sx, 0.9, sz); g.add(b); }
        sc.van.obj.add(g);
        sc.haz = g;
    }
    // the person who needs help
    const vk = keyOf(VICTIM[kind]);
    sc.victim = getPerson(vk);
    if (!sc.victim) { endScene(sc); return null; }
    placeVictim(sc);
    CM.scene = sc;
    emit("community:scene", { kind, org: sc.org, phase: "wait", where: town ? "town" : "highway" });
    return sc;
}
function placeVictim(sc) {
    const a = sc.at, rd = ctx.world.road, o = sc.victim.obj;
    if (sc.kind === "hurt") {
        // flat on his back on the sidewalk, his e-bike on its side next to him
        rd.point(a.s, a.side * 7.0, _p2);
        o.rotation.order = "YXZ";
        o.rotation.set(-Math.PI / 2, a.h + Math.PI / 2, 0);
        o.position.set(_p2.x, 0.2, _p2.z);
        if (models.town_ebike) {
            if (!bike) bike = cloneWithColors(models.town_ebike);
            rd.point(a.s + 1.6, a.side * 6.2, _p2);
            bike.position.set(_p2.x, 0.3, _p2.z);
            bike.rotation.set(0, a.h + 0.4, Math.PI / 2 - 0.15);
            ctx.scene.add(bike);
            sc.prop = bike;
        }
    } else {
        rd.point(a.s - a.side * 1.6, a.d + a.side * 1.9, _p2);
        o.position.set(_p2.x, 0, _p2.z);
        o.rotation.y = Math.atan2(a.x - _p2.x, a.z - _p2.z);
    }
}
const _p2 = {};

/** Someone (Lulu, or "somebody") calls it in: the responder is dispatched. */
export function callFor(sc = CM.scene, byLulu = true) {
    if (!sc || sc.called || sc.phase !== "wait") return false;
    sc.called = true;
    sc.byLulu = byLulu;
    sc.phase = "coming";
    const fast = sc.org === "hatzalah";
    const gap = sc.kind === "hurt" ? 0 : 7.2;
    const target = { s: sc.at.s, d: sc.at.d };
    sc.V = respond(sc.org, target, { gap, lights: true, siren: fast, v: fast ? 15 : 12, from: fast ? 55 : 80, onArrive: V => arrived(sc, V) });
    if (!sc.V) { sc.phase = "wait"; sc.called = false; return false; }
    if (byLulu) {
        CM.stats.called++;
        if (fast) later(2.4, () => { if (CM.scene === sc) H.toast(pick(ARRIVE_FAST), "pink"); });
    }
    emit("community:scene", { kind: sc.kind, org: sc.org, phase: "coming", byLulu });
    return true;
}

function arrived(sc, V) {
    if (CM.scene !== sc) { leave(V); return; }
    sc.phase = "work"; sc.t = 0;
    const c = V.car;
    sc.worker = getPerson(WORKER[sc.org]);
    if (!sc.worker) { finish(sc); return; }
    // out of the driver's door
    sc.worker.obj.position.set(c.x - Math.cos(c.h) * 1.3, 0, c.z + Math.sin(c.h) * 1.3);
    sc.workAt = workSpot(sc);
    if (sc.kind === "flat" && models.community_spare) {
        if (!spare) spare = cloneWithColors(models.community_spare);
        spare.position.set(sc.workAt.x, 0, sc.workAt.z);
        spare.rotation.y = sc.at.h;
        ctx.scene.add(spare);
    }
}
/** Where the volunteer kneels / stands to work. */
function workSpot(sc) {
    const a = sc.at, rd = ctx.world.road;
    if (sc.kind === "hurt") { rd.point(a.s - 1.0, a.side * 6.3, _p2); return { x: _p2.x, z: _p2.z }; }
    if (sc.kind === "lockout") { rd.point(a.s + a.side * 0.4, a.d + a.side * -1.35, _p2); return { x: _p2.x, z: _p2.z }; }
    if (sc.kind === "battery") { rd.point(a.s + a.side * 3.3, a.d, _p2); return { x: _p2.x, z: _p2.z }; }
    rd.point(a.s - a.side * 1.6, a.d + a.side * 1.4, _p2);
    return { x: _p2.x, z: _p2.z };
}

function finish(sc) {
    sc.phase = "leave"; sc.t = 0;
    if (sc.byLulu) {
        addCoins(15, "chesed");
        CM.stats.chesed++;
        if (CM.save) { CM.save.chesed = (CM.save.chesed || 0) + 1; if (CM.saveSoon) CM.saveSoon(); }
        H.toast(`${pick(CHESED)} +15`, "gold");
        sfx.good();
        stat("communityChesed", 1);
        const L = ctx.town && ctx.town.def && ctx.town.def.lines;
        if (L && L.GROUP && ctx.phone && ctx.phone.text) { try { ctx.phone.text({ from: L.GROUP.from, emoji: L.GROUP.emoji, color: L.GROUP.color, msg: pick(GOSSIP_CHESED), dur: 4.5 }); } catch (e) { /* no phone */ } }
    }
    emit("community:scene", { kind: sc.kind, org: sc.org, phase: "done", byLulu: sc.byLulu });
}

export function endScene(sc = CM.scene) {
    if (!sc) return;
    if (sc.van) {
        if (sc.haz && sc.haz.parent) sc.haz.parent.remove(sc.haz);
        if (ctx.traffic.cars.includes(sc.van) && sc.van.data && sc.van.data.communityScene === sc) { sc.van.data.communityScene = null; ctx.traffic.remove(sc.van); }
    }
    sc.victim = putPerson(sc.victim);
    sc.worker = putPerson(sc.worker);
    if (sc.prop && sc.prop.parent) sc.prop.parent.remove(sc.prop);
    if (spare && spare.parent) spare.parent.remove(spare);
    if (sc.V && !sc.V.dead) { if (sc.V.mode === "stop" || sc.V.mode === "go") leave(sc.V); }
    if (CM.scene === sc) CM.scene = null;
}

// ── per frame ────────────────────────────────────────────────────────────
export function tickScenes(dt) {
    const sc = CM.scene;
    if (!sc) { maybeStart(dt); return; }
    sc.t += dt;
    const lp = luluPos(), a = sc.at;
    const dist = Math.hypot(a.x - lp.x, a.z - lp.z);
    // gone from view: tidy up (on the highway: once she's well past it)
    const behind = !sc.town && ctx.car.s - a.s > 120;
    if (behind || dist > 190 || (sc.town !== inTown())) { endScene(sc); return; }
    // somebody carjacked the minivan (it happens): scene over, everyone yells
    if (sc.van && (!ctx.traffic.cars.includes(sc.van) || sc.van.data.streetsJack)) {
        if (sc.victim) bubble(sc.victim.obj, "MY MINIVAN! With the CAR SEATS!", 2.6, "angry");
        sc.van = null; sc.phase = "leave"; sc.t = 0;
    }
    const v = sc.victim;
    if (sc.phase === "wait") {
        if (v && sc.kind !== "hurt") { v.update(dt, { talk: Math.sin(sc.t * 0.9) > 0.3, wave: dist < 26 && Math.sin(sc.t * 1.7) > 0.6 }); v.face(dist < 26 ? lp.x : a.x, dist < 26 ? lp.z : a.z, dt, 3); }
        else if (v) v.update(dt, { wave: Math.sin(sc.t * 2) > 0.7 });
        sc.pleadT -= dt;
        if (dist < 22 && sc.pleadT <= 0) { sc.pleadT = rand(6, 9); bubble(v.obj, pick(sc.said++ % 2 ? sc.def.plead : sc.def.waiting), 2.8, "nice"); }
        if (dist < 40) hintOnce("scene", `<b>📞 ${sc.def.icon} Somebody needs ${ORGS[sc.org].name}</b><small>open the 📱 phone → 📞 Call — a mitzvah!</small>`, 3800);
        if (sc.t > sc.callT) callFor(sc, false);
    } else if (sc.phase === "coming") {
        if (v) v.update(dt, { wave: sc.kind !== "hurt" && Math.sin(sc.t * 2.4) > 0.2 });
    } else if (sc.phase === "work") {
        const w = sc.worker;
        if (!w) { finish(sc); return; }
        const there = walkTo(w, sc.workAt.x, sc.workAt.z, 2.6, dt);
        if (there) {
            w.face(sc.kind === "hurt" && v ? v.obj.position.x : a.x, sc.kind === "hurt" && v ? v.obj.position.z : a.z, dt, 6);
            sc.workT = (sc.workT || 0) + dt;
            w.update(dt, { point: Math.sin(sc.workT * 6) > 0, sit: sc.kind === "flat" || sc.kind === "hurt", talk: true });
            if (sc.org === "chaverim" && Math.random() < dt * 3) { sfx.wrench(); if (dist < 50) ctx.car.fx.burst(sc.workAt.x, 0.5, sc.workAt.z, 3, 2, [1, 0.85, 0.4], 0.15, 0.4); }
            if (!sc.workSaid && sc.workT > 0.6) { sc.workSaid = true; bubble(w.obj, pick(sc.def.worker), 3.2, "nice"); }
            if (sc.workT > 6.5) { if (v) bubble(v.obj, pick(sc.def.thanks), 3, "nice"); finish(sc); }
        }
        if (v) v.update(dt, { talk: there });
    } else if (sc.phase === "leave") {
        // the volunteer climbs back in and drives off; the minivan pulls away; the bochur limps off
        const w = sc.worker, V = sc.V;
        if (w && V && !V.dead) {
            const c = V.car;
            if (walkTo(w, c.x - Math.cos(c.h) * 1.3, c.z + Math.sin(c.h) * 1.3, 2.8, dt)) { sc.worker = putPerson(w); leave(V); }
        } else if (w) sc.worker = putPerson(w);
        if (spare && spare.parent && sc.t > 0.4) spare.parent.remove(spare);
        if (sc.kind === "hurt" && v) {
            if (sc.t < 0.6) { v.obj.rotation.x = -Math.PI / 2 * (1 - sc.t / 0.6); v.obj.position.y = 0.2 * (1 - sc.t / 0.6); }
            else { v.obj.rotation.x = 0; v.obj.rotation.order = "XYZ"; const h = a.h + (a.side > 0 ? 0 : Math.PI); v.obj.rotation.y = h; v.obj.position.x += Math.sin(h) * 1.1 * dt; v.obj.position.z += Math.cos(h) * 1.1 * dt; v.update(dt, { walk: 1.1, wave: sc.t < 2.5 }); }
        } else if (v) {
            v.update(dt, { cheer: sc.t < 1.6, wave: sc.t >= 1.6 });
            if (sc.t > 2.4 && sc.van && !sc.vanGo) {
                sc.vanGo = true;
                if (sc.haz && sc.haz.parent) sc.haz.parent.remove(sc.haz);
                sc.victim = putPerson(v);   // (she hopped in)
                const van = sc.van;
                van.ai = (d2, c) => { c.speed = Math.min(sc.town ? 9 : 22, c.speed + 3 * d2); c.s += c.speed * c.dir * d2; c.d += clamp(c.dir * (sc.town ? 1.75 : 5.25) - c.d, -1.4 * d2, 1.4 * d2); c.dTarget = c.d; };
            }
        }
        if (sc.t > 16 || (!sc.worker && (!sc.van || sc.vanGo) && sc.t > (sc.kind === "hurt" ? 11 : 6))) {
            if (sc.van && sc.vanGo) { const van = sc.van; sc.van = null; van.keep = false; van.data.communityScene = null; later(6, () => { if (ctx.traffic.cars.includes(van) && Math.hypot(van.x - luluPos().x, van.z - luluPos().z) > 50) ctx.traffic.remove(van); }); }
            endScene(sc);
        }
    }
}

function maybeStart(dt) {
    const cfg = townCfg();
    if (!cfg || !on() || !CM.loaded) return;
    CM.sceneT -= dt;
    if (CM.sceneT > 0) return;
    CM.sceneT = rand(cfg.scenes.every[0], cfg.scenes.every[1]);
    if ((ctx.law && ctx.law.chasing) || CM.chase || ctx.engaged()) return;      // (ci/hud: one activity at a time)
    startScene();
}
/** The highway's version (fleet.js asks for it on the approach to a town). */
CM.onRoadside = () => { if (!CM.scene && on()) startScene(pick(["flat", "battery", "lockout"])); };

// ── on foot: ✋ "call Chaverim for them" ──────────────────────────────────
export const sceneSpot = {
    r: 3.0, short: "CALL",
    pos() {
        const sc = CM.scene;
        if (!sc || sc.phase !== "wait" || !sc.victim || !onFoot()) return null;
        return { x: sc.victim.obj.position.x, z: sc.victim.obj.position.z };
    },
    label() { const sc = CM.scene; return sc ? `📞 CALL ${ORGS[sc.org].name.toUpperCase()} FOR THEM` : null; },
    act() {
        const sc = CM.scene;
        if (!sc) return;
        luluSay(LULU_CALL[sc.org], 2.4);
        sfx.dial();
        callFor(sc, true);
    },
};
export { _v };
