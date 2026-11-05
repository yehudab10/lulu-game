// features/foot — LULU ON FOOT (+ Avigail's wedding, see wedding.js).
//
// When the car is wrecked (cameos' crash reprieve), impounded (law), parked
// (parking) or she just pulls onto the shoulder and climbs out, Lulu walks the
// REAL road world: chunks keep streaming around her, traffic keeps flowing
// (cars come up from behind and the other way), actors with foot:true keep
// running. She is NOT invincible — a car that clips her knocks her flat and
// costs a heart; at zero it's the ER or game over.
//
// The hand button (✕ / E / ✋) does whatever's nearest: talk to people, pet
// animals, ENTER a storefront (ctx.interiors[id].enter), duck into the
// QUICK-CHANGE booth, hotwire a parked car, hail a passing one, climb back into
// her own parked car — or, with nothing around, busk for tips.
//
// Provides ctx.foot { start(reason, opts), active, level, addSpot(spot), meetAvigail(outcome) }.
// Emits foot:start {reason, level} / foot:end {why, reason, coins}, stat footDist / weddings.
import * as THREE from "three";
import { ctx, on, emit, hook, registerState, setState, css, rand, pick, wrapAngle } from "../../core/ctx.js";
import { store, saveSoon, shared } from "../../core/save.js";
import { updateActors, addCoins, heal, resetRun } from "../../core/driving.js";
import { models, registerModels, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { registerKind, kindSpec } from "../../traffic.js";
import { SKINS } from "../../car.js";
import { LANES_OURS } from "../../world.js";
import { input, glyph, addTouchButton, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import * as L from "./lines.js";
import { bubble, floater, clearBubbles, showBubbles, updateBubbles, hasBubble } from "./bubbles.js";
import { allDoors, refreshDoors, nextDoorAt } from "./street.js";
import { startWedding, weddingState } from "./wedding.js";

const WALK = 3.4, RUN = 7.6;        // m/s (the 2D walk was 150 px/s cruise, ×2 running)
const LULU_R = 0.32;
const BUBBE_S = 4800;               // Bubbe's house (56,000 px in 2D)
const PX = 11.7;                    // 2D px per metre (the footDist quest counts 2D px)

const LAZY = ["npcWoman", "npcMan", "npcKid", "avigailPerson", "copPerson",
    "foot_booth", "foot_ambulance", "foot_bus", "foot_dozer", "foot_duck", "foot_raccoon", "foot_ostrich"];
registerModels({
    foot_booth: "foot_booth", foot_ambulance: "foot_ambulance", foot_bus: "foot_bus", foot_dozer: "foot_dozer",
    foot_duck: "foot_duck", foot_raccoon: "foot_raccoon", foot_ostrich: "foot_ostrich",
});

const S = store("foot", { walks: 0, borrowed: 0, hailed: 0, knockouts: 0, weddings: 0, bouquets: 0, bestFrac: 0 });

// parked rides: what the 2D game left on the shoulder, and how hard each one is to hotwire
const VEH = {
    car:       { label: "🚗 HOTWIRE CAR", pins: 1, zoneW: 0.36, speed: 0.85 },
    cop:       { label: "🚓 HOTWIRE COP CAR", pins: 2, zoneW: 0.25, speed: 1.08, key: "cop", circles: [1.3, -1.3], r: 0.95 },
    ambulance: { label: "🚑 HOTWIRE AMBULANCE", pins: 2, zoneW: 0.25, speed: 1.08, key: "foot_ambulance", circles: [1.6, -1.4], r: 1.1 },
    bus:       { label: "🚌 HOTWIRE BUS", pins: 2, zoneW: 0.25, speed: 1.08, key: "foot_bus", circles: [-3.6, -1.2, 1.2, 3.6], r: 1.3 },
    dozer:     { label: "🚜 HOTWIRE STEAMROLLER", pins: 3, zoneW: 0.19, speed: 1.30, key: "foot_dozer", circles: [1.0, -1.4], r: 1.15 },
};
const PAINTS = ["#E53935", "#42A5F5", "#FFFFFF", "#FFCA28", "#66BB6A", "#8D6E63", "#9E9E9E", "#26C6DA", "#263238", "#BA68C8"];
const TOPS = ["#81C784", "#4FC3F7", "#FFB74D", "#F06292", "#9575CD", "#FFFFFF", "#E57373", "#4DB6AC", "#FFD54F", "#90A4AE"];
const BOTTOMS = ["#37474F", "#283593", "#212121", "#5D4037", "#1565C0", "#6A1B9A", "#455A64"];
const HAIRS = ["#4E342E", "#3E2723", "#1A1A1A", "#8D6E63", "#D7B56D", "#BDBDBD", "#6D4C41"];

// ── tiny helpers ─────────────────────────────────────────────────────────
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _p = {}, _n = {};
const PROXY = { pos: new THREE.Vector3(1e7, 0, 1e7), h: 0, vx: 0, vz: 0, speed: 0, applyImpulse() {} };
function road() { return ctx.world.road; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function wanted() { return ((ctx.law && ctx.law.wanted) || 0) > 0 || (F && F.disguise === "prison"); }
function avigailRel() {
    try { if (ctx.avigail && ctx.avigail.rel) return ctx.avigail.rel(); } catch (e) { /* fall through */ }
    const r = shared.get().avigailRel;
    return typeof r === "number" ? r : 50;
}
function bumpAvigail(d) {
    if (ctx.avigail && ctx.avigail.bump) { try { ctx.avigail.bump(d); return; } catch (e) { console.error(e); } }
    let rel = 50;
    shared.update(s => { rel = s.avigailRel = clamp((typeof s.avigailRel === "number" ? s.avigailRel : 50) + d, 0, 100); });
    emit("avigail:rel", { rel });
}
function beep(n = 1) {
    for (let i = 0; i < n; i++) setTimeout(() => { A.sfxHorn(true); setTimeout(() => A.sfxHorn(false), 140); }, i * 260);
}

// ── CSS + DOM: hotwire slider, the ✋ button, chips, the arrest wash ─────
css("foot", `
body.onfoot .hud-br { display: none !important; }
body.onfoot #touch .pedals { display: none !important; }
body.onfoot #touchExtra { left: auto !important; right: max(18px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); flex-direction: column; }
#tx_foot_hand { width: 96px; height: 96px; border-radius: 50%; font-size: 40px; background: rgba(46, 125, 50, 0.78); }
#tx_foot_hand.has { background: rgba(255, 193, 7, 0.92); color: #2b1b2e; }
#tx_foot_hand small { font-size: 11px; }
#tx_foot_exit { width: 84px; height: 64px; font-size: 26px; background: rgba(126, 87, 194, 0.85); }
.foot-chip { background: var(--glass); border-radius: 999px; padding: 5px 12px; font-weight: 700; font-size: 15px; box-shadow: var(--shadow); white-space: nowrap; }
.foot-chip small { opacity: .65; font-size: 12px; }
.foot-chase { background: rgba(183, 28, 28, .9); color: #fff; border-radius: 16px; padding: 6px 14px; font-weight: 700; text-align: center; min-width: 230px; box-shadow: var(--shadow); }
.foot-chase .meter { height: 8px; background: rgba(0,0,0,.35); border-radius: 99px; margin-top: 5px; overflow: hidden; }
.foot-chase .meter i { display: block; height: 100%; border-radius: 99px; transition: width .1s; }
.foot-chase small { display: block; font-size: 12px; opacity: .9; margin-top: 2px; }
#footHot { position: fixed; left: 50%; top: 58%; transform: translate(-50%, -50%); width: min(520px, 88vw); z-index: 8;
  background: rgba(8, 10, 18, .88); border: 3px solid #FFD54F; border-radius: 18px; padding: 12px 18px 14px; color: #fff; text-align: center; pointer-events: auto; }
#footHot.fail { border-color: #FF5252; }
#footHot .ttl { font-weight: 700; font-size: 18px; color: #FFD54F; margin-bottom: 8px; }
#footHot.fail .ttl { color: #FF8A80; }
#footHot .bar { position: relative; height: 30px; border-radius: 10px; background: #37474F; overflow: hidden; }
#footHot .zone { position: absolute; top: 0; bottom: 0; background: #66BB6A; border-radius: 6px; }
#footHot .needle { position: absolute; top: -2px; bottom: -2px; width: 8px; margin-left: -4px; background: #fff; border-radius: 4px; box-shadow: 0 0 8px #fff; }
#footHot .pins { margin-top: 9px; display: flex; gap: 10px; justify-content: center; }
#footHot .pins i { width: 14px; height: 14px; border-radius: 50%; background: #546E7A; display: inline-block; }
#footHot .pins i.on { background: #FFD54F; box-shadow: 0 0 8px #FFD54F; }
#footHot .hint { margin-top: 6px; font-size: 14px; opacity: .85; }
#footWash { position: fixed; inset: 0; pointer-events: none; z-index: 5; opacity: 0; background: #000; transition: opacity .25s; }
body.tv #footHot { width: min(760px, 70vw); } body.tv #footHot .ttl { font-size: 28px; } body.tv .foot-chip { font-size: 22px; }
@media (max-aspect-ratio: 1/1) { body.onfoot.touch .hud-slot.bottom { bottom: calc(max(14px, env(safe-area-inset-bottom)) + 130px); }
  body.onfoot.touch .hud-slot.left { top: calc(max(12px, env(safe-area-inset-top)) + 196px); } }
`);
const hot = document.createElement("div");
hot.id = "footHot";
hot.className = "hidden";
hot.innerHTML = `<div class="ttl"></div><div class="bar"><div class="zone"></div><div class="needle"></div></div><div class="pins"></div><div class="hint"></div>`;
document.body.appendChild(hot);
let hotTap = false;
hot.addEventListener("pointerdown", e => { e.preventDefault(); hotTap = true; });
const wash = document.createElement("div");
wash.id = "footWash";
document.body.appendChild(wash);

let handBtn = null, exitBtn = null;

// ── session ──────────────────────────────────────────────────────────────
let F = null;               // the on-foot session (null when Lulu's in a car)
let shell = null;           // a borrowed vehicle's body riding on Lulu's car physics
let driveOff = { t: 0, shown: false };
let chaseActive = false;
on("cop:chase", e => { chaseActive = !!(e && e.active); });

function bumpRuns() {
    let n = 1;
    shared.update(s => { n = s.footRunsPlayed = (s.footRunsPlayed || 0) + 1; });
    S.walks++;
    saveSoon();
    return n;
}

function luluKey() {
    const st = shared.get().luluHairStyle;
    return st && models["luluPerson_" + st] ? "luluPerson_" + st : "luluPerson";
}
function luluColors(disguise) {
    const hair = shared.get().luluHair || null;
    const c = hair ? { Hair: hair } : {};
    if (disguise === "oldLady") Object.assign(c, { Hair: "#CFCFCF", Top: "#C2185B", Bottom: "#8D6E63" });
    if (disguise === "oldMan") Object.assign(c, { Hair: "#CFCFCF", Top: "#546E7A", Bottom: "#455A64" });
    if (disguise === "prison") Object.assign(c, { Top: "#FF6F00", Bottom: "#E65100" });
    return c;
}
function makeLulu() {
    const p = spawnPerson(luluKey(), { colors: luluColors(F && F.disguise) });
    p.obj.rotation.order = "YXZ";
    return p;
}
function swapLulu() {
    const old = F.lulu;
    const p = makeLulu();
    p.obj.position.copy(old.obj.position);
    p.obj.rotation.copy(old.obj.rotation);
    ctx.scene.remove(old.obj);
    ctx.scene.add(p.obj);
    F.lulu = p;
}

/**
 * Lulu climbs out and walks. reason: carWreck | crashReprieve | droveOff | copWalk | jailbreak | parked
 * opts: { line, crash (parked → the parking crash lines), noIntro }
 */
function start(reason = "carWreck", opts = {}) {
    if (F && !F.suspended && ctx.state === "footRun") return false;
    if (F) end("restart");
    if (!ctx.world || !ctx.car) return false;
    if (ctx.G.hearts == null) resetRun({ mode: "cruise" });
    ensureModels(LAZY).catch(e => console.error("[foot] models", e));
    const G = ctx.G, car = ctx.car, T = ctx.traffic;
    const level = bumpRuns();
    const rd = road();
    const near = rd.nearest(car.pos.x, car.pos.z, car.s, {});
    let pos = car.pos.clone(), h = car.h;
    if (reason === "parked") {   // her car is tucked in on the right shoulder
        rd.point(near.s, 8.0, _p);
        pos.set(_p.x, 0, _p.z); h = _p.h;
    }
    F = {
        reason, level, t: 0, phase: "intro", phaseT: 0, handoff: null, suspended: null,
        lulu: null, pos: new THREE.Vector3(), vel: new THREE.Vector3(), s: near.s, d: near.d, h: rd.at(near.s).h, camYaw: rd.at(near.s).h,
        car: null, peds: [], animals: [], parked: [], booth: null, companion: null, walker: null,
        chase: null, hotwire: null, approach: null, hail: null, prompt: null, knock: null, arrest: null, enter: null,
        coins: 0, distAcc: 0, statT: 0, startS: near.s, maxFrac: 0, fracSaved: 0,
        chatT: rand(2.5, 4.5), buskT: 0, parkCool: 4.5, pedCool: 0, animalCool: rand(4, 8), behindT: 2, boothCool: 3,
        avigailT: rand(14, 30), avigailDone: false, chaseCool: 3, disguise: reason === "jailbreak" ? "prison" : null,
        attn: Math.max(0.35, 0.75 - level * 0.04), savedOurs: T.config.ours, hintT: 6,
        introDur: reason === "droveOff" ? 0.8 : 2.1, introLine: opts.line || pick(introPool(reason, opts)), introSaid: false, titleShown: false,
    };
    T.config.ours = 1;           // she isn't overtaking anything; cars come at her from behind (see trafficStep)
    // her car: parked (drivable) or wrecked, or gone (impounded / she broke out of jail)
    if (reason !== "copWalk" && reason !== "jailbreak") {
        F.car = makeCarStub(pos, h, { drivable: (reason === "droveOff" || reason === "parked") && !opts.crash });
    }
    // Lulu, hopping out over the convertible's door toward the roadside
    F.lulu = makeLulu();
    ctx.scene.add(F.lulu.obj);
    const out = Math.sign(near.d || 1);
    const rr = rd.at(near.s);
    F.hopFrom = F.car ? F.car.stub.obj.localToWorld(new THREE.Vector3(0.38, 0.62, -0.06)) : pos.clone();
    F.hopTo = new THREE.Vector3(pos.x - Math.cos(rr.h) * out * 1.8, 0.05, pos.z + Math.sin(rr.h) * out * 1.8);
    if (!F.car) F.hopFrom.copy(F.hopTo);
    F.pos.copy(F.hopFrom);
    F.lulu.obj.position.copy(F.pos);
    F.lulu.obj.rotation.y = h;
    // the player's car object becomes an invisible anchor that follows Lulu, so the
    // world streaming, the sun's shadow box and the trip bar all follow HER
    car.obj.visible = false;
    car.vx = car.vz = car.vF = car.vR = car.spin = 0;
    car.boosting = G.boosting = false;
    G.hearts = Math.max(G.hearts || 0, 1);
    G.invT = 2.0;
    H.setHearts(G.hearts, G.maxHearts);
    A.sfxHorn(false);
    if (ctx.cam) ctx.cam.snap();
    setState("footRun", { start: true });
    emit("foot:start", { reason, level });
    emit("stat", { id: "footWalks", n: 1 });
    return true;
}

function introPool(reason, opts) {
    if (reason === "parked") return opts.crash ? L.FOOT_INTRO_LINES.parkingCrash : L.FOOT_INTRO_LINES.droveOff;
    if (reason === "copWalk") return L.FOOT_INTRO_LINES.copWalk;
    if (reason === "droveOff") return L.FOOT_INTRO_LINES.droveOff;
    if (reason === "jailbreak") return L.FOOT_INTRO_LINES.jailbreak;
    return L.FOOT_INTRO_LINES.wreck;
}

// Her car left on the road, as a stationary traffic "car" so the other drivers
// slow down and steer round it (and so a later crash into it is a real crash).
function makeCarStub(pos, h, { drivable }) {
    const T = ctx.traffic, rd = road();
    const key = shell ? shell.key : "lulu";
    const sk = SKINS[ctx.car.skinKey] || SKINS.pink;
    const colors = shell ? shell.colors : { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark };
    const kind = "foot_wreck_" + key;
    if (!kindSpec(kind)) registerKind(kind, { len: 4.4, halfW: 0.95, circles: [1.15, -1.15], r: 0.95, mass: 3, model: key });
    const near = rd.nearest(pos.x, pos.z, ctx.car.s, {});
    const c = T.add(kind, near.s, near.d, near.d >= 0 ? 1 : -1, 0, { ai: (dt, cc) => { cc.speed = 0; }, data: { footStub: true }, noNearMiss: true });
    c.free = true; c.x = pos.x; c.z = pos.z; c.h = h;
    T.place(c, 0);
    c.obj.traverse(o => {
        if (!o.isMesh || !colors || !colors[o.material.name]) return;
        if (!o.userData.footOwn) { o.material = o.material.clone(); o.userData.footOwn = true; }
        o.material.color.set(colors[o.material.name]);
    });
    for (const n of [...findNodes(c.obj, "Driver"), ...findNodes(c.obj, "Hair_")]) n.visible = false;
    if (!c.obj.userData.footHaz) {   // amber hazard blinkers on the rear corners
        const m = new THREE.MeshStandardMaterial({ color: "#FFB300", emissive: "#FFB300", emissiveIntensity: 2.5 });
        const g = new THREE.SphereGeometry(0.09, 10, 8);
        const haz = [];
        for (const sx of [-0.72, 0.72]) for (const sz of [-1.95, 1.95]) {
            const b = new THREE.Mesh(g, m); b.position.set(sx, 0.78, sz); c.obj.add(b); haz.push(b);
        }
        c.obj.userData.footHaz = haz;
    }
    return { stub: c, drivable, wrecked: !drivable, key, colors, vtype: shell ? shell.vtype : null };
}

/** Tear the session down. why: car | hail | own | gameover | er | arrest | title | runStart | restart … */
function end(why = "end") {
    if (!F) return;
    const f = F;
    F = null;
    const G = ctx.G, T = ctx.traffic;
    saveFrac(f, true);
    flushDist(f);
    ctx.scene.remove(f.lulu.obj);
    for (const p of f.peds) ctx.scene.remove(p.p.obj);
    for (const a of f.animals) ctx.scene.remove(a.p.obj);
    for (const pc of f.parked) ctx.scene.remove(pc.obj);
    if (f.booth) ctx.scene.remove(f.booth.obj);
    if (f.companion) ctx.scene.remove(f.companion.p.obj);
    if (f.walker) ctx.scene.remove(f.walker.p.obj);
    if (f.chase) ctx.scene.remove(f.chase.p.obj);
    if (f.arrest && f.arrest.cop) ctx.scene.remove(f.arrest.cop.p.obj);
    clearBubbles();
    showBubbles(false);
    hot.classList.add("hidden");
    wash.style.opacity = "0";
    H.prompt("");
    clearChips();
    G.hint = null;
    T.config.ours = f.savedOurs;
    const car = ctx.car;
    const driving = why === "car" || why === "hail" || why === "own";
    if (f.car && f.car.stub && T.cars.includes(f.car.stub) && !driving) {
        // she's not driving anything else: put the real car back where she left it
        const c = f.car.stub;
        car.place(c.x, c.z, c.h);
        T.remove(c);
    }
    if (!driving) { car.obj.visible = true; car.showDriver(true); }
    emit("foot:end", { why, reason: f.reason, coins: f.coins });
}

// ── back behind a wheel ─────────────────────────────────────────────────
/** v: { own, vtype, key, colors, x, z, h, lemon, how } */
function enterCar(v) {
    const car = ctx.car, G = ctx.G, T = ctx.traffic;
    const ownStub = F && F.car && F.car.stub;
    end(v.own ? "own" : v.how || "car");
    if ((v.own || v.removeStub) && ownStub && T.cars.includes(ownStub)) T.remove(ownStub);
    restoreCar();
    car.place(v.x, v.z, v.h);
    const near = road().nearest(v.x, v.z, car.s, _n);
    car.s = near.s; car.d = near.d;
    if (!v.own) attachShell(v);
    car.obj.visible = true;
    car.showDriver(!shell);
    G.hearts = Math.max(G.hearts, 1);
    H.setHearts(G.hearts, G.maxHearts);
    G.invT = Math.max(G.invT || 0, 2.0);
    G.lemon = v.lemon ? { type: v.lemon, drift: Math.random() < 0.5 ? -1 : 1, sput: 0 } : null;
    G.borrowed = v.own ? null : v.vtype;
    if (ctx.cam) ctx.cam.snap();
    setState("playing");
    A.setMusic("../luludriving.mp3");
    if (v.lemon === "tire") H.toast("🛠️ FLAT TIRE — it PULLS!", "red");
    else if (v.lemon === "engine") H.toast("🛠️ BAD ENGINE — it SPUTTERS!", "red");
}

function attachShell(v) {
    const tpl = models[v.key];
    if (!tpl) return;
    const obj = cloneWithColors(tpl, v.colors || null);
    ctx.car.tilt.add(obj);
    ctx.car.model.visible = false;
    shell = { obj, key: v.key, colors: v.colors || null, vtype: v.vtype, wheels: findNodes(obj, "Wheel_") };
    for (const w of shell.wheels) w.rotation.order = "YXZ";
}
function restoreCar() {
    const car = ctx.car;
    if (!car) return;
    if (shell) { if (shell.obj.parent) shell.obj.parent.remove(shell.obj); shell = null; }
    if (car.model) car.model.visible = true;
    if (ctx.G) { ctx.G.lemon = null; ctx.G.borrowed = null; }
}

// borrowed-ride extras while driving: spin the shell's wheels, the lemon's misbehaviour
hook("update", (dt, P, controlsOn) => {
    const car = ctx.car;
    if (shell) for (const w of shell.wheels) w.rotation.x += car.vF * dt / (shell.key === "foot_bus" ? 0.5 : shell.key === "foot_dozer" ? 0.7 : 0.36);
    const lm = ctx.G.lemon;
    if (lm && lm.type === "engine" && Math.random() < 0.35) {
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        car.fx.emit(car.pos.x + fx * 1.9, 1.1, car.pos.z + fz * 1.9, (Math.random() - 0.5), 1.6, (Math.random() - 0.5), 1.3, 1.0, [0.45, 0.45, 0.47]);
    }
    updateDriveOff(dt, P, controlsOn);
});
hook("controls", (ctl, dt) => {
    const lm = ctx.G.lemon;
    if (!lm) return;
    if (lm.type === "tire") ctl.steer = clamp(ctl.steer + lm.drift * 0.2, -1, 1);
    else {
        lm.sput -= dt;
        if (lm.sput <= -1.7) lm.sput = 0.45;
        if (lm.sput > 0) ctl.throttle *= 0.15;
    }
});
hook("runStart", () => { if (F) end("runStart"); restoreCar(); driveOff.t = 0; });
on("title", () => { if (F) end("title"); restoreCar(); });
on("skin", () => { if (shell) restoreCar(); });
on("wreck", () => { ensureModels(LAZY).catch(() => {}); });   // get the townsfolk loading early
on("pause", e => {   // keep our overlays off the pause menu
    const p = !!(e && e.paused);
    hot.style.visibility = p ? "hidden" : "";
    if (p) showBubbles(false);
});

// ── pulling onto the shoulder and climbing out (the 2D "EXIT" button) ────
function updateDriveOff(dt, P, controlsOn) {
    const car = ctx.car, G = ctx.G;
    // (✕ is also the gas button on a pad, so act on the prompt that was showing BEFORE this press)
    if (driveOff.shown && P.interact && ctx.state === "playing") {
        driveOff.t = 0; driveOff.shown = false;
        H.prompt("");
        start("droveOff");
        return;
    }
    const ok = ctx.state === "playing" && controlsOn && !chaseActive && !G.arrived && !(ctx.law && ctx.law.chasing) &&
        Math.abs(car.d) > 6.4 && car.speed < 0.8 && input.throttle < 0.05;
    driveOff.t = ok ? driveOff.t + dt : 0;
    const show = driveOff.t > 1.3;
    if (show !== driveOff.shown) {
        driveOff.shown = show;
        H.prompt(show ? `${glyph("interact")} 🚶‍♀️ Get out &amp; walk` : "");
    }
}

// a wreck nobody else claimed (no cameos / law feature present): the 2D crash
// reprieve — sometimes she just climbs out and walks on
hook("wreck", info => {
    if (!ctx.enabled("foot") || ctx.foot.force.wreck === false) return false;
    if (ctx.foot.force.wreck === true || Math.random() < 0.2) { start("carWreck"); return true; }
    return false;
}, 1);

// ── the state ───────────────────────────────────────────────────────────
registerState("footRun", {
    hud: true, touch: true, pausable: true, world: true, driving: false,
    enter(data = {}) {
        document.body.classList.add("onfoot");
        input.stick2d = true;
        const lbl = document.querySelector("#stickZone span");
        if (lbl) lbl.textContent = "WALK";
        ctx.view = null;
        A.updateEngine(0, 0, 0, 0, false, false);
        A.sfxHorn(false);
        A.setMusic("../walking.mp3");
        showBubbles(true);
        refreshDoors();
        if (!F) return;
        if (data.resume || F.suspended) resume(data);
    },
    exit(next) {
        document.body.classList.remove("onfoot");
        input.stick2d = false;
        const lbl = document.querySelector("#stickZone span");
        if (lbl) lbl.textContent = "STEER";
        H.prompt("");
        hot.classList.add("hidden");
        showBubbles(false);
        if (!F) return;
        if (F.handoff) { F.suspended = F.handoff; return; }
        if (["title", "gameover", "intro", "playing"].includes(next)) end(next);
        else F.suspended = next;     // somebody else's cutscene; we'll pick up where we left off
    },
    update(dt, P) { if (F && !F.handoff) footUpdate(dt, P); },
    camera(dt) { return footCamera(dt); },
});

// a cutscene that took over on foot then dropped straight into driving: tidy up
on("state", ({ to }) => {
    if (!F || !F.suspended || to === "footRun" || to === "footWedding") return;
    const def = ctx.states[to];
    if (def && def.driving) end("drove");
});

function resume(data) {
    const G = ctx.G;
    const kind = data.resume || F.suspended;
    F.handoff = null; F.suspended = null;
    if (kind === "interior" && data.door) {
        const dr = data.door;
        const rd = road();
        rd.point(dr.s, dr.side * (Math.abs(dr.d) - 1.4), _p);
        F.pos.set(_p.x, 0.05, _p.z);
        F.lulu.obj.rotation.y = Math.atan2(-Math.cos(_p.h) * -dr.side, Math.sin(_p.h) * -dr.side);
        bubble(F.lulu.obj, pick(L.FOOT_EXIT_QUIPS), 2.2);
    }
    F.phase = "walk"; F.phaseT = 0; F.enter = null;
    F.vel.set(0, 0, 0);
    F.lulu.obj.rotation.x = 0;
    F.lulu.obj.position.copy(F.pos);
    G.invT = Math.max(G.invT || 0, 2.0);   // shield on re-entry to the road
    wash.style.opacity = "0";
    if (ctx.cam) ctx.cam.snap();
}

// ── per-frame ───────────────────────────────────────────────────────────
function footUpdate(dt, P) {
    const G = ctx.G;
    if (F.t < 0.25) { A.updateEngine(0, 0, 0, 0, false, false); A.sfxHorn(false); }   // (climbing out mid-drive-frame left them on)
    F.t += dt; F.phaseT += dt;
    G.invT = Math.max(0, (G.invT || 0) - dt);
    if (F.buskT > 0) F.buskT -= dt;
    if (F.chaseCool > 0) F.chaseCool -= dt;

    const rd = road();
    if (F.phase === "intro") updateIntro(dt);
    else if (F.phase === "knock") updateKnock(dt);
    else if (F.phase === "arrest") updateArrest(dt);
    else if (F.phase === "enter") updateEnter(dt);
    else if (F.phase === "approach") updateApproach(dt);
    else if (F.phase === "hail") updateHail(dt);
    else if (F.phase === "hotwire") updateHotwire(dt, P);
    else walk(dt);
    if (!F) return;

    // keep road coordinates, the invisible car anchor, and the world in step with her
    const near = rd.nearest(F.pos.x, F.pos.z, F.s, _n);
    F.s = near.s; F.d = near.d; F.h = near.h;
    const car = ctx.car;
    car.pos.set(F.pos.x, 0, F.pos.z);
    car.s = F.s; car.d = F.d; car.h = F.h;
    car.vx = car.vz = 0;
    car.obj.visible = false;
    F.camYaw += wrapAngle(F.h - F.camYaw) * Math.min(1, dt * 2);

    trafficStep(dt);
    if (!F) return;
    updateActors(dt, true);
    car.fx.update(dt);
    updateStub(dt);
    if (F.phase !== "intro") {
        pickups();
        spawners(dt);
        updatePeds(dt);
        updateAnimals(dt);
        updateParked(dt);
        updateBooth(dt);
        updateAvigail(dt);
        updateChase(dt);
        if (!F) return;
        if (F.phase === "walk") interact(P);
        if (!F) return;
        chatter(dt);
        arrivedOnFoot();
        if (!F) return;
    }
    stats(dt);
    hud(dt);
    showBubbles(!ctx.paused && !H.screenOpen());
    updateBubbles(dt, ctx.camera);
}

function walk(dt) {
    const L1 = F.lulu;
    let mx = ctx.dialogOpen ? 0 : input.moveX, my = ctx.dialogOpen ? 0 : input.moveY;
    const mag = Math.min(1, Math.hypot(mx, my));
    const running = input.boost || (input.device === "gamepad" && input.throttle > 0.5) || (input.device === "touch" && mag > 0.9);
    const h = F.h;
    const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    let wx = fx * -my + rx * mx, wz = fz * -my + rz * mx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const sp = (F.buskT > 0 ? 0 : (running ? RUN : WALK));
    _v.set(wx * sp, 0, wz * sp);
    F.vel.lerp(_v, Math.min(1, dt * (mag > 0.05 ? 9 : 12)));
    F.pos.x += F.vel.x * dt;
    F.pos.z += F.vel.z * dt;
    collideStatic();
    // an invisible fence far out in the fields (like the car's)
    const near = road().nearest(F.pos.x, F.pos.z, F.s, _n);
    if (Math.abs(near.d) > 60) {
        const push = (Math.abs(near.d) - 60) * Math.sign(near.d);
        F.pos.x -= -Math.cos(near.h) * push; F.pos.z -= Math.sin(near.h) * push;
    }
    if (near.s < 4) { F.pos.x += Math.sin(near.h) * (4 - near.s); F.pos.z += Math.cos(near.h) * (4 - near.s); }
    const speed = Math.hypot(F.vel.x, F.vel.z);
    if (speed > 0.25) L1.face(F.pos.x + F.vel.x, F.pos.z + F.vel.z, dt, 10);
    L1.obj.position.set(F.pos.x, 0.05, F.pos.z);
    L1.obj.rotation.x += ((speed > RUN * 0.7 ? 0.14 : 0) - L1.obj.rotation.x) * Math.min(1, dt * 6);
    L1.obj.rotation.z = 0;
    L1.update(dt, { walk: speed, dance: F.buskT > 0, wave: F.waveT > 0 });
    if (F.waveT > 0) F.waveT -= dt;
    // shield blink
    L1.obj.visible = !(ctx.G.invT > 0 && F.phase === "walk" && Math.floor(ctx.time * 12) % 2 === 0 && ctx.G.invT < 1.9);
    F.distAcc += speed * dt;
}

function collideStatic() {
    const p = F.pos;
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - F.s) > 220) continue;
        for (const c of ch.colliders) {
            if (c.off) continue;
            const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + LULU_R;
            const d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr || d2 < 1e-8) continue;
            const d = Math.sqrt(d2);
            p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr;
        }
    }
    for (const pc of F.parked) pushOut(pc, pc.circles, pc.r);
    if (F.booth) pushCircle(F.booth.x, F.booth.z, 0.95);
    for (const ped of F.peds) pushCircle(ped.p.obj.position.x, ped.p.obj.position.z, 0.3);
}
function pushCircle(x, z, r) {
    const p = F.pos, dx = p.x - x, dz = p.z - z, rr = r + LULU_R;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-8) return false;
    const d = Math.sqrt(d2);
    p.x = x + dx / d * rr; p.z = z + dz / d * rr;
    return true;
}
function pushOut(o, circles, r) {
    const fx = Math.sin(o.h), fz = Math.cos(o.h);
    let hit = false;
    for (const co of circles) hit = pushCircle(o.x + fx * co, o.z + fz * co, r) || hit;
    return hit;
}

// ── traffic around a pedestrian ─────────────────────────────────────────
function trafficStep(dt) {
    const T = ctx.traffic, rd = road();
    for (const c of T.cars) {
        if (c.hit || c.ai || c.free) continue;
        if (c.data.footAttn === undefined) c.data.footAttn = Math.random() < F.attn;
        const g = (F.s - c.s) * c.dir;
        if (g > 0 && g < 34 && Math.abs(c.d - F.d) < 1.8 && F.phase !== "intro") {
            if (c.data.footAttn) c.want = Math.min(c.want, Math.max(0, (g - 7) * 0.7));
            else if (!c.data.footHonk && g < 28) { c.data.footHonk = true; beep(2); floater(c.obj, pick(["BEEP BEEP!", "📣 Outta the ROAD!", "📣 MOVE, lady!"]), "#FFFFFF", 1.3, 1.8); }
        }
    }
    // cars come up from behind her (the built-in spawner only adds them ahead)
    F.behindT -= dt;
    if (F.behindT <= 0 && ctx.enabled("foot")) {
        F.behindT = Math.max(1.6, 4.4 - F.level * 0.15) * rand(0.7, 1.3);
        const d = LANES_OURS[Math.random() < 0.5 ? 0 : 1];
        const s = F.s - 150;
        if (s > 20 && T.laneFree(s, d, 1, 30)) {
            const mix = T.config.mix;
            let r = Math.random() * Object.values(mix).reduce((a, b) => a + b, 0), kind = "sedan";
            for (const [k, w] of Object.entries(mix)) { if ((r -= w) <= 0) { kind = k; break; } }
            T.add(kind, s, d, 1, rand(15, 23));
        }
    }
    const diff = Math.min(1, (F.s - (ctx.G.startS || 0)) / 9000) * 0.6 + Math.min(0.4, F.level * 0.03);
    const events = T.update(dt, PROXY, F.s, F.d, diff, false, ctx.time);
    for (const e of events) {
        if (e.type === "oncomingHonk" && F.phase === "walk") H.toast("📣 BEEP! Off the road, lady!", "red");
    }
    // cars vs. Lulu: slow ones shove her, fast ones knock her flat
    if (F.phase === "intro" || F.phase === "knock" || F.phase === "arrest") return;
    for (const c of T.cars) {
        const dx0 = c.x - F.pos.x, dz0 = c.z - F.pos.z;
        if (dx0 * dx0 + dz0 * dz0 > 64) continue;
        const sp = c.hit ? Math.hypot(c.vx, c.vz) : c.speed;
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        for (const co of c.spec.circles) {
            const qx = c.x + fx * co, qz = c.z + fz * co;
            const dx = F.pos.x - qx, dz = F.pos.z - qz, rr = c.spec.r + LULU_R;
            const d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr) continue;
            const d = Math.sqrt(d2) || 1e-3;
            F.pos.x = qx + dx / d * rr; F.pos.z = qz + dz / d * rr;
            if (sp > 3.2) { knockout(c, sp); return; }
        }
    }
}

function knockout(c, sp) {
    const G = ctx.G;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    if (G.invT > 0) {   // shielded: just a shove out of the way
        F.vel.set(fx * 4, 0, fz * 4);
        return;
    }
    G.hearts--;
    G.invT = 2.0;
    G.crashes = (G.crashes || 0) + 1;
    H.setHearts(G.hearts, G.maxHearts);
    H.flash();
    A.sfxCrash(0.7);
    rumble(1, 1, 450, true);
    S.knockouts++; saveSoon();
    if (!c.ai) { c.want = 0; c.speed *= 0.4; }
    const info = { power: 0.7, why: "Clipped by a car — on FOOT!", source: "foot" };
    emit("damage", info);
    emit("stat", { id: "footKnockouts", n: 1 });
    floater(F.lulu.obj, G.hearts > 0 ? "OW! watch it!" : "💫", "#FF8A80", 1.4);
    ctx.car.fx.burst(F.pos.x, 1.0, F.pos.z, 18, 4, [1, 0.85, 0.45], 0.45, 0.6);
    if (F.hotwire) { F.hotwire = null; hot.classList.add("hidden"); }
    F.approach = null; F.hail = null;
    F.knock = { vx: fx * Math.min(9, sp * 0.45), vz: fz * Math.min(9, sp * 0.45), vy: 3.2, y: 0.05, fatal: G.hearts <= 0 };
    F.phase = "knock"; F.phaseT = 0;
    F.vel.set(0, 0, 0);
}

function updateKnock(dt) {
    const k = F.knock, o = F.lulu.obj, t = F.phaseT;
    if (t < 0.55) {
        F.pos.x += k.vx * dt; F.pos.z += k.vz * dt;
        k.vx *= Math.exp(-2 * dt); k.vz *= Math.exp(-2 * dt);
        k.vy -= 14 * dt; k.y = Math.max(0.05, k.y + k.vy * dt);
        o.rotation.x += (-1.5 - o.rotation.x) * Math.min(1, dt * 9);
    } else if (t < 1.15) {
        k.y += (0.2 - k.y) * Math.min(1, dt * 10);
        o.rotation.x = -1.5;
    } else {
        k.y += (0.05 - k.y) * Math.min(1, dt * 10);
        o.rotation.x += (0 - o.rotation.x) * Math.min(1, dt * 8);
    }
    collideStatic();
    o.position.set(F.pos.x, k.y, F.pos.z);
    o.visible = true;
    F.lulu.update(dt, { walk: 0, cheer: t > 1.15 && t < 1.5 && !k.fatal });
    if (k.fatal && t > 1.3) { knockedOut(); return; }
    if (t > 1.55) { o.rotation.x = 0; F.phase = "walk"; F.phaseT = 0; F.knock = null; }
}

// Out of hearts on foot: sometimes the ER scoops her up, otherwise game over.
function knockedOut() {
    const force = ctx.foot.force.er;
    const er = ctx.er && ctx.er.admit && (force === true || (force !== false && ctx.enabled("foot") && Math.random() < 0.45));
    if (er) {
        end("er");
        try { ctx.er.admit("knockout"); } catch (e) { console.error(e); setState("gameover", {}); }
        return;
    }
    end("gameover");
    setState("gameover", { quote: `"Hit by a CAR? While WALKING?! Mamele, come home, I'm making soup." — Bubbe 📞` });
}

// ── the intro: she hops out over the door, the car smokes, LULU ON FOOT ──
function updateIntro(dt) {
    const o = F.lulu.obj, t = F.phaseT, T = F.introDur;
    const k = clamp(t / (T * 0.5), 0, 1);
    const e = k * k * (3 - 2 * k);
    F.pos.lerpVectors(F.hopFrom, F.hopTo, e);
    const y = F.hopFrom.y * (1 - e) + Math.sin(e * Math.PI) * 0.6 + 0.05;
    o.position.set(F.pos.x, Math.max(0.05, y), F.pos.z);
    if (k < 1) F.lulu.face(F.hopTo.x + (F.hopTo.x - F.hopFrom.x), F.hopTo.z + (F.hopTo.z - F.hopFrom.z), dt, 10);
    else if (F.car) F.lulu.face(F.car.stub.x, F.car.stub.z, dt, 3);
    F.lulu.update(dt, { walk: k < 1 ? 2 : 0, cheer: k < 0.5 && F.reason !== "droveOff" });
    const prog = t / T;
    if (!F.titleShown && prog > 0.2 && F.reason !== "droveOff") {
        F.titleShown = true;
        H.banner(`🚶‍♀️ <b>LULU ON FOOT</b><small>borrow a car to get back on the road</small>`, 2600);
    }
    if (!F.introSaid && prog > 0.32) { F.introSaid = true; bubble(o, F.introLine, 3.2); }
    if (t >= T) {
        F.phase = "walk"; F.phaseT = 0;
        if (input.device !== "touch") ctx.G.hint = `Find a car to “borrow” 🚗 · ${glyph("interact")} to interact · ${glyph("boost")} run`;
        F.hintT = 6;
    }
}

function updateStub(dt) {
    const c = F.car && F.car.stub;
    if (!c || !ctx.traffic.cars.includes(c)) return;
    const haz = c.obj.userData.footHaz;
    if (haz) { const on = Math.sin(ctx.time * 6) > 0; for (const b of haz) b.visible = on; }
    if (F.car.wrecked) {
        const dx = c.x - F.pos.x, dz = c.z - F.pos.z;
        if (dx * dx + dz * dz < 4900 && Math.random() < (F.phase === "intro" ? 0.9 : 0.4)) {
            const fx = Math.sin(c.h), fz = Math.cos(c.h);
            ctx.car.fx.emit(c.x + fx * 1.5 + rand(-0.3, 0.3), 1.0, c.z + fz * 1.5 + rand(-0.3, 0.3), rand(-0.3, 0.3), rand(1.2, 2.2), rand(-0.3, 0.3), 1.6, 1.6, [0.42, 0.42, 0.44]);
            if (F.phase === "intro" && F.phaseT < 0.9 && Math.random() < 0.3) ctx.car.fx.burst(c.x + fx * 1.7, 0.9, c.z + fz * 1.7, 3, 3, [1, 0.7, 0.2], 0.25, 0.4);
        }
    }
}

// ── camera ──────────────────────────────────────────────────────────────
const shot = { from: new THREE.Vector3(), look: new THREE.Vector3() };
function footCamera(dt) {
    if (!F) return false;
    const cam = ctx.cam;
    if (F.phase === "intro") {
        const ref = F.car ? F.car.stub : { x: F.pos.x, z: F.pos.z, h: F.h };
        const fx = Math.sin(ref.h), fz = Math.cos(ref.h);
        const out = Math.sign(F.d || 1);
        const rx = -Math.cos(F.h) * out, rz = Math.sin(F.h) * out;
        shot.from.set(ref.x + fx * 6.5 + rx * 4.2, 2.6, ref.z + fz * 6.5 + rz * 4.2);
        shot.look.set((ref.x + F.pos.x) / 2, 1.0, (ref.z + F.pos.z) / 2);
        cam.cinematic(shot.from, shot.look, dt, 2.5, 50);
        return true;
    }
    if (F.phase === "arrest" && F.arrest) {
        const a = F.arrest;
        shot.from.set(F.pos.x - Math.sin(F.h) * 7 + Math.cos(F.h) * 3, 3.2, F.pos.z - Math.cos(F.h) * 7 - Math.sin(F.h) * 3);
        shot.look.set((F.pos.x + a.x) / 2, 1.1, (F.pos.z + a.z) / 2);
        cam.cinematic(shot.from, shot.look, dt, 2, 50);
        return true;
    }
    const close = F.phase === "hotwire" || F.phase === "approach";
    cam.follow(F.lulu.obj, { dist: close ? 4.4 : 6.3, height: close ? 2.3 : 3.0, look: 1.15, yaw: F.camYaw, fov: 58 }, dt);
    return true;
}

// ── pickups ─────────────────────────────────────────────────────────────
function pickups() {
    const G = ctx.G;
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - F.s) > 220) continue;
        for (const coin of ch.coins) {
            if (coin.taken) continue;
            const dx = coin.x - F.pos.x, dz = coin.z - F.pos.z;
            if (dx * dx + dz * dz < 1.7) {
                coin.taken = true;
                addCoins(coin.value, "foot");
                F.coins += coin.value;
                A.sfxCoin(0);
                rumble(0, 0.25, 40);
                ctx.car.fx.burst(coin.x, 1.1, coin.z, 6, 2.5, [1, 0.85, 0.3], 0.35, 0.5);
            }
        }
        for (const ht of ch.hearts) {
            if (ht.taken) continue;
            const dx = ht.x - F.pos.x, dz = ht.z - F.pos.z;
            if (dx * dx + dz * dz < 2) {
                ht.taken = true; ht.obj.visible = false;
                if (G.hearts < G.maxHearts) { heal(1); H.toast("❤️ +1 HEART", "pink"); }
                A.sfxCoin(10);
            }
        }
    }
}

// ── the people, animals and cars around her ─────────────────────────────
function spawners(dt) {
    if (!ctx.enabled("foot")) return;
    F.pedCool -= dt;
    const want = 5 + Math.min(3, Math.floor(F.level / 3));
    if (F.pedCool <= 0 && F.peds.length < want && models.npcWoman && models.npcMan && models.npcKid) {
        F.pedCool = 0.6;
        spawnPed();
    }
    F.animalCool -= dt;
    if (F.animalCool <= 0) {
        F.animalCool = rand(9, 15);
        if (F.animals.length < 2) spawnAnimal();
    }
    F.parkCool -= dt;
    if (F.parkCool <= 0) {
        F.parkCool = rand(5, 9);
        if (!F.parked.some(p => p.s > F.s - 8 && !p.busted)) spawnParked();
    }
    F.avigailT -= dt;
    if (F.avigailT <= 0 && !F.avigailDone && !F.walker && !F.companion && models.avigailPerson) spawnAvigail();
}

function nearBar() { return allDoors().some(d => d.id === "bar" && Math.abs(d.s - F.s) < 70); }

function spawnPed(opts = {}) {
    const key = opts.key || pick(["npcWoman", "npcWoman", "npcMan", "npcMan", "npcKid"]);
    if (!models[key]) return null;
    const p = spawnPerson(key, { colors: { Top: pick(TOPS), Bottom: pick(BOTTOMS), Hair: pick(HAIRS) } });
    const ahead = opts.s != null ? opts.s : F.s + (Math.random() < 0.65 ? rand(22, 70) : -rand(18, 45));
    const side = opts.side || (Math.random() < 0.5 ? 1 : -1);
    const ped = {
        p, s: ahead, d: opts.d != null ? opts.d : side * rand(9.4, 11.8), dir: Math.random() < 0.5 ? 1 : -1,
        speed: opts.speed != null ? opts.speed : (Math.random() < 0.3 ? 0 : rand(0.9, 1.5)),
        drunk: opts.drunk != null ? opts.drunk : Math.random() < (nearBar() ? 0.3 : 0.1), talkT: 0, commentT: rand(1, 3), sway: Math.random() * 6,
    };
    road().point(ped.s, ped.d, _p);
    p.obj.position.set(_p.x, 0.05, _p.z);
    p.obj.rotation.y = _p.h + (ped.dir < 0 ? Math.PI : 0);
    ctx.scene.add(p.obj);
    F.peds.push(ped);
    return ped;
}

function updatePeds(dt) {
    const rd = road();
    for (let i = F.peds.length - 1; i >= 0; i--) {
        const ped = F.peds[i], o = ped.p.obj;
        if (Math.abs(ped.s - F.s) > 95) { ctx.scene.remove(o); F.peds.splice(i, 1); continue; }
        const dx = F.pos.x - o.position.x, dz = F.pos.z - o.position.z, dist = Math.hypot(dx, dz);
        if (ped.talkT > 0) {
            ped.talkT -= dt;
            ped.p.face(F.pos.x, F.pos.z, dt);
            ped.p.update(dt, { talk: true, wave: ped.waveT > 0, cheer: ped.cheerT > 0 });
            if (ped.waveT > 0) ped.waveT -= dt;
            if (ped.cheerT > 0) ped.cheerT -= dt;
            continue;
        }
        ped.commentT -= dt;
        if (ped.drunk && dist < 12) {
            // drunk folk shuffle toward her and holler
            ped.s += (F.s - ped.s) * Math.min(1, dt * 0.5);
            ped.d += (F.d - ped.d) * Math.min(1, dt * 0.3);
            if (Math.abs(ped.d) < 8.2) ped.d = Math.sign(ped.d || 1) * 8.2;
            ped.sway += dt;
            if (ped.commentT <= 0 && Math.random() < dt * 0.5) { ped.commentT = 2.6; bubble(o, pick(L.FOOT_DRUNK_REPLY), 2.0, { cls: "drunk" }); }
            rd.point(ped.s, ped.d + Math.sin(ped.sway * 2.3) * 0.25, _p);
            o.position.set(_p.x, 0.05, _p.z);
            ped.p.face(F.pos.x, F.pos.z, dt, 3);
            o.rotation.z = Math.sin(ped.sway * 2.3) * 0.12;
            ped.p.update(dt, { walk: 0.8 });
        } else {
            ped.s += ped.dir * ped.speed * dt;
            rd.point(ped.s, ped.d, _p);
            o.position.set(_p.x, 0.05, _p.z);
            if (ped.speed > 0) { const want = _p.h + (ped.dir < 0 ? Math.PI : 0); o.rotation.y += wrapAngle(want - o.rotation.y) * Math.min(1, dt * 5); }
            else if (dist < 6) ped.p.face(F.pos.x, F.pos.z, dt, 3);
            ped.p.update(dt, { walk: ped.speed, wave: ped.speed === 0 && dist < 6 && Math.sin(ctx.time + ped.sway) > 0.6 });
        }
    }
}

const ANIMALS = { foot_duck: { r: 0.3, speed: 0.6 }, foot_raccoon: { r: 0.35, speed: 0.9 }, foot_ostrich: { r: 0.5, speed: 1.4 } };
function spawnAnimal(opts = {}) {
    const key = opts.key || pick(["foot_duck", "foot_duck", "foot_raccoon", "foot_raccoon", "foot_ostrich"]);
    if (!models[key]) return null;
    const p = spawnPerson(key);
    const s = opts.s != null ? opts.s : F.s + rand(18, 45), side = opts.side || (Math.random() < 0.5 ? 1 : -1);
    const a = { p, key, s, d: opts.d != null ? opts.d : side * rand(9, 14), ts: s, td: 0, wait: rand(0.5, 2), scoot: 0, petT: 0 };
    a.td = a.d;
    road().point(a.s, a.d, _p);
    p.obj.position.set(_p.x, 0, _p.z);
    ctx.scene.add(p.obj);
    F.animals.push(a);
    return a;
}
function updateAnimals(dt) {
    const rd = road();
    for (let i = F.animals.length - 1; i >= 0; i--) {
        const a = F.animals[i], o = a.p.obj, def = ANIMALS[a.key];
        if (Math.abs(a.s - F.s) > 90) { ctx.scene.remove(o); F.animals.splice(i, 1); continue; }
        a.wait -= dt;
        if (a.wait <= 0 && a.scoot <= 0) { a.wait = rand(1.5, 4); a.ts = a.s + rand(-3, 3); a.td = clamp(a.d + rand(-2.5, 2.5), -16, 16); if (Math.abs(a.td) < 8.2) a.td = Math.sign(a.td || 1) * 8.4; }
        const sp = def.speed * (a.scoot > 0 ? 3 : 1);
        if (a.scoot > 0) a.scoot -= dt;
        const ds = a.ts - a.s, dd = a.td - a.d, len = Math.hypot(ds, dd);
        let moving = 0;
        if (len > 0.1) { const k = Math.min(1, sp * dt / len); a.s += ds * k; a.d += dd * k; moving = sp; }
        rd.point(a.s, a.d, _p);
        if (moving) a.p.face(_p.x + (_p.x - o.position.x), _p.z + (_p.z - o.position.z), dt, 8);
        o.position.set(_p.x, 0.02, _p.z);
        o.rotation.z = a.key === "foot_duck" && moving ? Math.sin(ctx.time * 12) * 0.12 : 0;
        a.p.update(dt, { walk: moving });
        if (a.petT > 0) a.petT -= dt;
        // she trips over critters when running into them ("oof!")
        const dx = F.pos.x - o.position.x, dz = F.pos.z - o.position.z;
        if (dx * dx + dz * dz < (def.r + LULU_R) ** 2) {
            const fast = Math.hypot(F.vel.x, F.vel.z) > RUN * 0.8;
            pushCircle(o.position.x, o.position.z, def.r);
            if (fast && F.phase === "walk" && ctx.G.invT <= 0) { ctx.G.invT = 0.7; F.vel.multiplyScalar(0.1); floater(F.lulu.obj, "oof!", "#FFFFFF", 1); A.sfxBump(); }
        }
    }
}

function spawnParked(opts = {}) {
    const r = Math.random();
    const vtype = opts.vtype || (r < 0.68 ? "car" : r < 0.80 ? "cop" : r < 0.90 ? "ambulance" : r < 0.97 ? "bus" : "dozer");
    const def = VEH[vtype];
    let key = def.key || pick(["sedan", "sedan", "sedan", "van", "truck"]);
    if (!models[key]) key = "sedan";
    const paint = (key === "sedan" || key === "van" || key === "truck") ? { Paint: pick(PAINTS) } : null;
    const lemon = opts.lemon !== undefined ? opts.lemon : (vtype === "car" && Math.random() < 0.25 ? (Math.random() < 0.5 ? "engine" : "tire") : null);
    const side = opts.side || (Math.random() < 0.7 ? 1 : -1);
    const s = opts.s != null ? opts.s : F.s + rand(30, 55);
    for (const pc of F.parked) if (Math.abs(pc.s - s) < 14 && pc.side === side) return null;
    const rd = road();
    const d = side * (key === "foot_bus" ? 8.4 : 8.05);
    rd.point(s, d, _p);
    const obj = cloneWithColors(models[key], paint);
    const h = _p.h;
    obj.position.set(_p.x, 0, _p.z);
    obj.rotation.order = "YXZ";
    obj.rotation.y = h;
    if (lemon === "tire") { obj.rotation.z = -side * 0.05; obj.position.y = -0.04; }
    ctx.scene.add(obj);
    const spec = kindSpec(key === "cop" ? "cop" : key) || {};
    const pc = {
        vtype, key, colors: paint, obj, x: _p.x, z: _p.z, h, s, d, side, lemon, busted: false,
        circles: def.circles || spec.circles || [1.3, -1.3], r: def.r || spec.r || 0.95,
    };
    F.parked.push(pc);
    return pc;
}
function updateParked(dt) {
    for (let i = F.parked.length - 1; i >= 0; i--) {
        const pc = F.parked[i];
        if (pc.s < F.s - 70 || pc.s > F.s + 240) { ctx.scene.remove(pc.obj); F.parked.splice(i, 1); continue; }
        if (pc.lemon === "engine" && Math.random() < 0.3) {
            const fx = Math.sin(pc.h), fz = Math.cos(pc.h);
            ctx.car.fx.emit(pc.x + fx * 1.8 + rand(-0.2, 0.2), 1.05, pc.z + fz * 1.8, rand(-0.2, 0.2), rand(0.8, 1.5), rand(-0.2, 0.2), 1.1, 1.1, [0.5, 0.5, 0.52]);
        }
        if (pc.alarmT > 0) {
            pc.alarmT -= dt;
            const on = Math.sin(ctx.time * 14) > 0;
            pc.obj.position.y = on ? 0.03 : 0;
        }
    }
}

// the QUICK-CHANGE booth turns up on the shoulder while she's wanted
function updateBooth(dt) {
    F.boothCool -= dt;
    const want = wanted() && F.disguise !== "oldLady" && F.disguise !== "oldMan";
    if (!F.booth && want && F.boothCool <= 0 && models.foot_booth && ctx.enabled("foot")) spawnBooth();
    const b = F.booth;
    if (!b) return;
    b.t += dt;
    if (b.s < F.s - 60 || (!want && Math.abs(b.s - F.s) > 25)) { ctx.scene.remove(b.obj); F.booth = null; F.boothCool = rand(4, 8); return; }
    b.glow.material.opacity = 0.18 + 0.12 * Math.abs(Math.sin(b.t * 4));
}
function spawnBooth(opts = {}) {
    if (!models.foot_booth) return null;
    const rd = road();
    const side = opts.side || (Math.random() < 0.5 ? 1 : -1);
    const s = opts.s != null ? opts.s : F.s + rand(28, 42);
    const d = side * 10.6;
    rd.point(s, d, _p);
    const obj = models.foot_booth.clone(true);
    obj.position.set(_p.x, 0, _p.z);
    obj.rotation.y = Math.atan2(-Math.cos(_p.h) * -side, Math.sin(_p.h) * -side);
    const sign = findNodes(obj, "Anchor_sign")[0];
    if (sign) {
        const c = document.createElement("canvas"); c.width = 512; c.height = 112;
        const g = c.getContext("2d");
        g.fillStyle = "#311B92"; g.fillRect(0, 0, 512, 112);
        g.fillStyle = "#F3E5F5"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "700 60px Fredoka, Arial, sans-serif"; g.fillText("QUICK CHANGE", 256, 60, 480);
        const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
        plane.position.copy(sign.position); plane.position.z += 0.012;
        sign.parent.add(plane);
    }
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: "#CE93D8", transparent: true, opacity: 0.25, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.07;
    obj.add(glow);
    ctx.scene.add(obj);
    const front = new THREE.Vector3(0, 0, 1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), obj.rotation.y).add(obj.position);
    F.booth = { obj, x: _p.x, z: _p.z, s, side, t: 0, glow, fx: front.x, fz: front.z };
    return F.booth;
}

// ── Avigail ─────────────────────────────────────────────────────────────
function spawnAvigail(opts = {}) {
    if (!models.avigailPerson) return null;
    const p = spawnPerson("avigailPerson");
    const side = Math.sign(F.d || 1);
    const s = opts.s != null ? opts.s : F.s + 42;
    const w = { p, s, d: opts.d != null ? opts.d : side * 9.8, dir: -1, speed: 1.3, busy: false, t: 0 };
    road().point(w.s, w.d, _p);
    p.obj.position.set(_p.x, 0.05, _p.z);
    ctx.scene.add(p.obj);
    F.walker = w;
    F.avigailT = 9999;
    return w;
}
function updateAvigail(dt) {
    const rd = road();
    const w = F.walker;
    if (w) {
        w.t += dt;
        w.s += w.dir * w.speed * dt;
        if (!w.busy) w.d += (F.d - w.d) * Math.min(1, dt * 0.25) * (Math.abs(w.s - F.s) < 20 ? 1 : 0);
        rd.point(w.s, w.d, _p);
        const o = w.p.obj;
        o.position.set(_p.x, 0.05, _p.z);
        if (w.busy) { const want = _p.h; o.rotation.y += wrapAngle(want - o.rotation.y) * Math.min(1, dt * 5); }
        else w.p.face(F.pos.x, F.pos.z, dt, 4);
        w.p.update(dt, { walk: w.speed, wave: !w.busy && Math.abs(w.s - F.s) < 15 });
        const dist = Math.hypot(F.pos.x - o.position.x, F.pos.z - o.position.z);
        if (!w.busy && dist < 2.0 && F.phase === "walk") { meetAvigail(); return; }
        if (w.s < F.s - 35 || w.s > F.s + 60 && w.busy) { ctx.scene.remove(o); F.walker = null; }
    }
    const c = F.companion;
    if (c) {
        const h = F.h, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
        _v.set(F.pos.x - fx * 1.5 - rx * 1.0, 0.05, F.pos.z - fz * 1.5 - rz * 1.0);
        const o = c.p.obj;
        const before = _w.copy(o.position);
        o.position.lerp(_v, Math.min(1, dt * 3.5));
        const moved = before.distanceTo(o.position) / Math.max(dt, 1e-3);
        if (moved > 0.3) c.p.face(o.position.x + (o.position.x - before.x), o.position.z + (o.position.z - before.z), dt, 8);
        else c.p.face(F.pos.x, F.pos.z, dt, 3);
        c.p.update(dt, { walk: moved, talk: hasBubble(o) });
        c.sayNext -= dt;
        if (c.sayNext <= 0) { c.sayNext = rand(4, 7); bubble(o, pick(L.AVIGAIL_WALK_LINES), 2.2, { cls: "pink" }); }
    }
}

/** On foot she runs into Avigail: usually she tags along, sometimes she's off with
 *  her chosson Aviel, and (rarely!) she's getting MARRIED right now. */
function meetAvigail(outcome) {
    if (!F) return;
    const w = F.walker;
    F.avigailDone = true;
    const rel = avigailRel();
    const wedCh = rel >= 65 ? 0.25 : 0.10;
    const r = Math.random();
    const forced = outcome || ctx.foot.force.avigail;
    const res = forced || (r < wedCh ? "wedding" : r < wedCh + 0.2 ? "busy" : "join");
    if (res === "wedding") {
        if (w) { ctx.scene.remove(w.p.obj); F.walker = null; }
        goWedding();
        return;
    }
    if (!w) return;
    if (res === "busy") {
        w.busy = true; w.dir = 1; w.speed = 2.2;
        bubble(w.p.obj, "💕 " + pick(L.AVIGAIL_BUSY), 2.6, { cls: "pink" });
        setTimeout(() => { if (F) bubble(F.lulu.obj, pick(L.LULU_AVIGAIL_BUSY), 2.6); }, 900);
        A.sfxCloseCall(3);
        const o = w.p.obj.position;
        for (let i = 0; i < 6; i++) ctx.car.fx.emit(o.x + rand(-0.4, 0.4), 1.6, o.z + rand(-0.4, 0.4), rand(-0.5, 0.5), rand(1.2, 2.2), rand(-0.5, 0.5), 0.6, 1.0, [1, 0.5, 0.67]);
        return;
    }
    // she joins the walk
    F.walker = null;
    F.companion = { p: w.p, sayNext: rand(3, 5) };
    bubble(w.p.obj, "Lulu?! Wait for ME!", 2.4, { cls: "pink" });
    bubble(F.lulu.obj, "Avigail! Walk with me!", 2.2);
    floater(F.lulu.obj, "Avigail joined the walk! 💅", "#FF80AB", 1.8, 2.6);
    A.sfxCloseCall(4);
}

function goWedding() {
    F.handoff = "wedding";
    H.prompt("");
    S.weddings++; saveSoon();
    startWedding({
        rel: avigailRel(),
        luluKey: luluKey(), luluColors: luluColors(F.disguise),
        onReward(caught) {
            const n = caught ? 40 : 15;
            addCoins(n, "wedding");
            if (caught) addCoins(1, "wedding star");   // the 2D footAwardStar: +1 ⭐ (= the coin wallet)
            if (F) F.coins += n + (caught ? 1 : 0);
            if (caught) { S.bouquets++; saveSoon(); }
            bumpAvigail(caught ? 20 : 15);
            return n;
        },
        onDone() { if (F) setState("footRun", { resume: "wedding" }); else setState("playing"); },
    });
}

// ── the cop chase on foot (when she's WANTED) ───────────────────────────
function copNearby(range) {
    const r2 = range * range;
    for (const c of ctx.traffic.cars) {
        if (!/cop/.test(c.kind) || (F.car && c === F.car.stub)) continue;
        const dx = c.x - F.pos.x, dz = c.z - F.pos.z;
        if (dx * dx + dz * dz < r2) return { x: c.x, z: c.z };
    }
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - F.s) > 200) continue;
        for (const t of ch.traps) {
            if (!t.obj) continue;
            const dx = t.obj.position.x - F.pos.x, dz = t.obj.position.z - F.pos.z;
            if (dx * dx + dz * dz < r2) return { x: t.obj.position.x, z: t.obj.position.z };
        }
    }
    return null;
}

function updateChase(dt) {
    if (!F.chase) {
        const recognisable = F.disguise !== "oldLady" && F.disguise !== "oldMan";
        if (wanted() && recognisable && F.buskT <= 0 && F.chaseCool <= 0 && F.phase === "walk" && ctx.enabled("foot")) {
            const cop = copNearby(30);
            if (cop && Math.random() < dt * 0.7) startFootChase(cop);
        }
        return;
    }
    const ch = F.chase, o = ch.p.obj;
    ch.t += dt;
    if (ch.giveUp) {
        ch.giveUp -= dt;
        o.position.x -= Math.sin(o.rotation.y) * -2 * dt; o.position.z -= Math.cos(o.rotation.y) * -2 * dt;
        ch.p.update(dt, { walk: 1.2 });
        if (ch.giveUp <= 0) { ctx.scene.remove(o); F.chase = null; }
        return;
    }
    const speed = Math.min(6.9, 6.0 + F.level * 0.06);
    const dx = F.pos.x - o.position.x, dz = F.pos.z - o.position.z, dist = Math.hypot(dx, dz);
    if (dist > 0.01 && F.phase !== "knock") {
        const k = Math.min(dist, speed * dt) / dist;
        o.position.x += dx * k; o.position.z += dz * k;
    }
    ch.p.face(F.pos.x, F.pos.z, dt, 8);
    ch.p.update(dt, { walk: speed, point: Math.sin(ch.t * 3) > 0.3 });
    ch.dist = dist;
    ch.tauntT -= dt;
    if (ch.tauntT <= 0 && Math.random() < dt * 0.8) { ch.tauntT = 2.0; bubble(o, pick(L.FOOT_CHASE_TAUNTS), 1.9, { cls: "cop" }); }
    if (dist > 32) {
        ch.escapeT += dt;
        if (ch.escapeT > 1.8) {
            floater(F.lulu.obj, "Lost the cop! 😎", "#7CFC4F", 1.8);
            A.sfxCloseCall(6);
            ch.giveUp = 2.5;
            F.buskT = 0; F.chaseCool = 8;
            emit("stat", { id: "escapes", n: 1 });
            return;
        }
    } else ch.escapeT = 0;
    if (dist < 1.1 && F.phase === "walk") caught();
}

function startFootChase(from) {
    if (!models.copPerson) return null;
    const p = spawnPerson("copPerson");
    const rd = road();
    let x = from && from.x, z = from && from.z;
    if (x == null) { rd.point(F.s - 26, F.d, _p); x = _p.x; z = _p.z; }
    p.obj.position.set(x, 0.05, z);
    ctx.scene.add(p.obj);
    F.chase = { p, t: 0, escapeT: 0, tauntT: 1.6, dist: 30 };
    bubble(p.obj, pick(L.FOOT_CHASE_TAUNTS), 1.8, { cls: "cop" });
    floater(F.lulu.obj, "🚓 A cop's after you — RUN! 🏃‍♀️", "#FF5252", 2);
    A.sfxSiren(1.2);
    rumble(0.4, 0.6, 300, true);
    return F.chase;
}

// Run down by the cop: the law takes it from here (or, without it, a cruiser
// pulls up and walks her into the precinct).
function caught() {
    const charges = (ctx.law && Array.isArray(ctx.law.charges) && ctx.law.charges.length) ? ctx.law.charges.slice() : ["EVADING ARREST", "RESISTING ARREST"];
    if (ctx.law && ctx.law.arrest) {
        end("arrest");
        try { ctx.law.arrest(charges, { foot: true }); } catch (e) { console.error(e); }
        return;
    }
    footStartArrest();
}
function footStartArrest() {
    const rd = road();
    if (F.chase) { ctx.scene.remove(F.chase.p.obj); F.chase = null; }
    const cop = models.copPerson ? spawnPerson("copPerson") : null;
    rd.point(F.s + 3, F.d + (F.d > 0 ? -1.4 : 1.4), _p);
    if (cop) { cop.obj.position.set(_p.x, 0.05, _p.z); ctx.scene.add(cop.obj); }
    F.arrest = { x: _p.x, z: _p.z, cop: cop ? { p: cop } : null, line: pick(L.FOOT_COP_PICKUP) };
    F.phase = "arrest"; F.phaseT = 0;
    bubble(F.lulu.obj, pick(L.FOOT_ARREST_PROTEST), 2.0);
    A.sfxSiren(2.4);
}
function updateArrest(dt) {
    const a = F.arrest, t = F.phaseT;
    F.lulu.update(dt, { walk: 0 });
    if (a.cop) { a.cop.p.face(F.pos.x, F.pos.z, dt); a.cop.p.update(dt, { point: true, talk: t > 0.6 }); }
    if (t > 0.6 && !a.said && a.cop) { a.said = true; bubble(a.cop.p.obj, a.line, 1.8, { cls: "cop" }); }
    wash.style.transition = "none";
    wash.style.background = Math.sin(ctx.time * 8) > 0 ? "rgba(80,120,255,1)" : "rgba(255,70,70,1)";
    wash.style.opacity = t < 1.7 ? String(0.14 + 0.08 * Math.sin(ctx.time * 16)) : String(clamp((t - 1.7) / 0.7, 0, 1));
    if (t >= 2.4) {
        if (a.cop) ctx.scene.remove(a.cop.p.obj);
        F.arrest = null;
        wash.style.background = "#000";
        const reg = ctx.interiors && ctx.interiors.police;
        const door = allDoors().find(d => d.id === "police") || { s: F.s, d: F.d, side: Math.sign(F.d || 1), id: "police" };
        if (reg) { handoffInterior("police", door); return; }
        wash.style.opacity = "0";
        H.toast("👮 Let off with a warning. Walk on!", "gold");
        F.phase = "walk"; F.phaseT = 0; F.chaseCool = 10;
    }
}

// ── interactions (the ✋ hand button) ────────────────────────────────────
const spotList = [];
function interactables() {
    const out = [];
    const p = F.pos;
    const consider = (kind, ent, label, x, z, range) => {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d < range) out.push({ kind, ent, label, score: d / range });
    };
    for (const dr of allDoors()) {
        const reg = ctx.interiors && ctx.interiors[dr.id];
        consider("enter", dr, reg ? `🚪 ENTER ${L.FOOT_DOOR_NAME[dr.id] || dr.id.toUpperCase()}` : "🔒 CLOSED — back soon", dr.x, dr.z, 2.3);
    }
    if (F.booth) consider("disguise", F.booth, "🥸 DUCK IN — change your look", F.booth.fx, F.booth.fz, 2.2);
    for (const pc of F.parked) {
        if (pc.busted) continue;
        consider("borrow", pc, VEH[pc.vtype].label, pc.x, pc.z, pc.vtype === "bus" ? 6.2 : 3.4);
    }
    if (F.car && F.car.stub && ctx.traffic.cars.includes(F.car.stub)) {
        const c = F.car.stub;
        const ripLabel = F.car.key === "lulu" ? "💀 RIP, little pink car" : "💀 That one's had it";
        consider(F.car.drivable ? "own" : "rip", c, F.car.drivable ? "🚗 GET BACK IN" : ripLabel, c.x, c.z, 3.3);
    }
    for (const ped of F.peds) consider("talk", ped, "💬 TALK", ped.p.obj.position.x, ped.p.obj.position.z, 2.1);
    for (const a of F.animals) consider("pet", a, "🐾 PET", a.p.obj.position.x, a.p.obj.position.z, a.key === "foot_ostrich" ? 2.4 : 1.9);
    if (F.companion) consider("avigail", F.companion, "💅 CHAT WITH AVIGAIL", F.companion.p.obj.position.x, F.companion.p.obj.position.z, 1.6);
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.ai || c.free || c.speed < 1) continue;
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        const dx = c.x - p.x, dz = c.z - p.z;
        const lon = dx * fx + dz * fz, lat = dx * -fz + dz * fx;
        if (Math.abs(lat) < 4.8 && lon > -3 && lon < 14) {
            out.push({ kind: "hail", ent: c, label: /cop/.test(c.kind) ? "🚓 HAIL COP CAR" : "🚕 HAIL RIDE", score: 0.85 + Math.abs(lat) / 20 });
        }
    }
    for (const sp of spotList) {
        const at = sp.pos ? sp.pos() : sp;
        if (!at) continue;
        const lbl = typeof sp.label === "function" ? sp.label() : sp.label;
        if (lbl) consider("spot", sp, lbl, at.x, at.z, sp.r || 2.0);
    }
    out.sort((a, b) => a.score - b.score);
    return out[0] || null;
}

function interact(P) {
    const pr = interactables();
    F.prompt = pr;
    H.prompt(pr ? `${glyph("interact")} ${pr.label}` : (F.t > 4 && F.t < 16 ? `${glyph("interact")} 💃 busk for tips` : ""));
    if (handBtn) {
        const has = !!pr;
        if (handBtn.classList.contains("has") !== has) {
            handBtn.classList.toggle("has", has);
            handBtn.innerHTML = has ? `👉<small>${pr.kind.toUpperCase()}</small>` : `✋<small>HAND</small>`;
        }
    }
    if (!P.interact) return;
    if (!pr) { busk(); return; }
    doInteract(pr);
}

function doInteract(pr) {
    const e = pr.ent;
    switch (pr.kind) {
        case "enter": return enterDoor(e);
        case "disguise": return doDisguise();
        case "borrow": return startApproach(e);
        case "own": return F.car.key === "lulu"
            ? enterCar({ own: true, x: e.x, z: e.z, h: e.h })
            : enterCar({ vtype: F.car.vtype || "car", key: F.car.key, colors: F.car.colors, x: e.x, z: e.z, h: e.h, how: "own", removeStub: true });
        case "rip": bubble(F.lulu.obj, pick(["She's taking a nap.\nA... permanent nap. 😴", "RIP, little pink car. 🥀\nYou served me... okay.", "It's not a car now,\nit's modern ART."]), 2.4); return;
        case "talk": return talkTo(e);
        case "pet": return pet(e);
        case "avigail": bubble(e.p.obj, pick(L.AVIGAIL_WALK_LINES), 2.2, { cls: "pink" }); return;
        case "hail": return hail(e);
        case "spot": try { e.act(); } catch (err) { console.error(err); } return;
    }
}

function talkTo(ped) {
    const o = ped.p.obj;
    ped.talkT = 2.6;
    if (!ped.drunk && Math.random() < 0.25) {      // sometimes it's a high-five
        bubble(F.lulu.obj, "Up high! ✋", 1.6);
        bubble(o, pick(L.FOOT_HIGHFIVE), 2.0);
        ped.cheerT = 0.8; F.waveT = 0.8;
        A.sfxCloseCall(5);
    } else {
        bubble(o, pick(ped.drunk ? L.FOOT_DRUNK_REPLY : L.FOOT_PED_REPLY), 2.4, { cls: ped.drunk ? "drunk" : "" });
        bubble(F.lulu.obj, pick(L.FOOT_TALK_LULU), 2.0);
        A.sfxCloseCall(1);
    }
    if (Math.random() < 0.3 || ctx.foot.force.tip) {
        addCoins(1, "tip"); F.coins++;
        floater(o, "+1 💰 tip", "#FFD700", 1.4, 2.4);
        A.sfxCoin(0);
    }
    emit("stat", { id: "footChats", n: 1 });
}

function pet(a) {
    addCoins(1, "pet"); F.coins++;
    floater(a.p.obj, pick(L.FOOT_PET_LINES) + " +1", "#FFB74D", 1.5, a.key === "foot_ostrich" ? 2.5 : 1.0);
    A.sfxCloseCall(2);
    rumble(0.1, 0.3, 120);
    // it scoots off, delighted
    a.scoot = 1.2;
    const away = Math.sign(a.d - F.d || 1);
    a.ts = a.s + rand(-2, 2); a.td = clamp(a.d + away * 3, -16, 16);
    a.petT = 1.5;
    emit("stat", { id: "pets", n: 1 });
}

// With nothing nearby the hand button makes her busk/dance; passers-by tip.
function busk() {
    F.buskT = 1.6;
    bubble(F.lulu.obj, pick(L.FOOT_BUSK_LINES), 1.8);
    A.sfxCloseCall(3);
    const cols = [[1, 0.5, 0.67], [0.31, 0.76, 0.97], [1, 0.84, 0.31], [0.68, 0.84, 0.5]];
    for (let i = 0; i < 10; i++) ctx.car.fx.emit(F.pos.x + rand(-0.5, 0.5), 1.4, F.pos.z + rand(-0.5, 0.5), rand(-1.5, 1.5), rand(2, 4), rand(-1.5, 1.5), 0.35, 1.0, cols[i % 4]);
    let tips = 0;
    for (const ped of F.peds) {
        const o = ped.p.obj;
        if (Math.hypot(o.position.x - F.pos.x, o.position.z - F.pos.z) < 12) { tips++; bubble(o, "👏", 1.2); ped.talkT = 1.4; ped.cheerT = 1.0; }
    }
    if (tips > 0) {
        addCoins(tips, "busk"); F.coins += tips;
        floater(F.lulu.obj, `+${tips} 💰 tips!`, "#FFD700", 1.6, 2.7);
        A.sfxCoin(2);
    }
}

function doDisguise() {
    const b = F.booth;
    ctx.scene.remove(b.obj); F.booth = null; F.boothCool = rand(8, 14);
    if (F.chase) { F.chase.giveUp = 2.5; }
    F.disguise = Math.random() < 0.5 ? "oldLady" : "oldMan";
    swapLulu();
    if (ctx.law) {
        try { if (ctx.law.clearWanted) ctx.law.clearWanted(); else ctx.law.wanted = 0; } catch (e) { /* read-only */ }
    }
    emit("foot:disguise", { look: F.disguise });
    floater(F.lulu.obj, F.disguise === "oldLady" ? "👵 SWEET OLD LADY!" : "👴 OLD MAN DISGUISE!", "#7CFC4F", 2.0, 2.8);
    bubble(F.lulu.obj, "Heat's off — nobody knows you! 😎", 2.4);
    A.sfxCloseCall(5); setTimeout(() => A.sfxCloseCall(8), 110);
    const cols = [[0.81, 0.58, 0.85], [1, 0.84, 0.31], [0.5, 0.87, 0.92], [1, 1, 1]];
    for (let i = 0; i < 18; i++) ctx.car.fx.emit(F.pos.x + rand(-0.6, 0.6), 1.0, F.pos.z + rand(-0.6, 0.6), rand(-2, 2), rand(2, 4.5), rand(-2, 2), 0.3, 0.8, cols[i % 4]);
}

// ── doors → the interiors feature ───────────────────────────────────────
function enterDoor(door) {
    const reg = ctx.interiors && ctx.interiors[door.id];
    if (!reg) {
        floater(F.lulu.obj, "🔒 CLOSED — back soon", "#FF8A80", 1.6, 2.4);
        bubble(F.lulu.obj, pick(["Closed?! On a TUESDAY?", "Ugh. Fine. NEXT.", "Who closes at noon?!"]), 1.8);
        A.sfxBump();
        return;
    }
    F.phase = "enter"; F.phaseT = 0; F.enter = { door, from: F.pos.clone() };
    A.sfxSelect();
}
function updateEnter(dt) {
    const e = F.enter, t = F.phaseT, dr = e.door;
    const rd = road();
    rd.point(dr.s, dr.side * (Math.abs(dr.d) + 1.2), _p);
    _v.set(_p.x, 0, _p.z);
    F.pos.lerpVectors(e.from, _v, clamp(t / 0.7, 0, 1));
    F.lulu.face(_v.x, _v.z, dt, 10);
    F.lulu.obj.position.set(F.pos.x, 0.05, F.pos.z);
    F.lulu.update(dt, { walk: 2.2 });
    wash.style.transition = "none";
    wash.style.background = "#000";
    wash.style.opacity = String(clamp((t - 0.3) / 0.45, 0, 1));
    if (t > 0.8) handoffInterior(dr.id, dr);
}
function handoffInterior(id, door) {
    const reg = ctx.interiors && ctx.interiors[id];
    F.handoff = "interior";
    H.prompt("");
    clearBubbles();
    const exit = () => { if (F) setState("footRun", { resume: "interior", door }); };
    emit("stat", { id: "footInteriors", n: 1 });
    try { reg.enter({ exit, door: id, from: "foot" }); }
    catch (err) { console.error("[foot] interior", id, err); exit(); }
    setTimeout(() => { wash.style.transition = "opacity .4s"; wash.style.opacity = "0"; }, 60);
}

// ── borrowing a parked car: walk up, then the HOTWIRE timing challenge ───
function startApproach(pc) {
    F.phase = "approach"; F.phaseT = 0;
    F.approach = { pc };
    floater(F.lulu.obj, "🚗 …sidling up to it", "#FFE082", 1.4, 2.4);
    A.sfxCloseCall(-2);
}
function doorSpot(pc) {
    // the driver's door: the vehicle's LEFT side (+X in the model), a little forward on the big ones
    const fx = Math.sin(pc.h), fz = Math.cos(pc.h), lx = Math.cos(pc.h), lz = -Math.sin(pc.h);
    const half = { foot_bus: 1.3, foot_ambulance: 1.1, foot_dozer: 1.1 }[pc.key] || 0.95;
    const fwd = { foot_bus: 3.6, foot_ambulance: 1.6, foot_dozer: 0.3 }[pc.key] || 0.25;
    return { x: pc.x + lx * (half + 0.5) + fx * fwd, z: pc.z + lz * (half + 0.5) + fz * fwd };
}
function updateApproach(dt) {
    const pc = F.approach.pc;
    if (!F.parked.includes(pc)) { F.approach = null; F.phase = "walk"; return; }
    const tgt = doorSpot(pc);
    const dx = tgt.x - F.pos.x, dz = tgt.z - F.pos.z, dist = Math.hypot(dx, dz);
    if (dist > 0.05) { const k = Math.min(dist, WALK * 1.2 * dt) / dist; F.pos.x += dx * k; F.pos.z += dz * k; }
    if (dist > 0.3) F.lulu.face(tgt.x, tgt.z, dt, 10); else F.lulu.face(pc.x, pc.z, dt, 8);
    F.lulu.obj.position.set(F.pos.x, 0.05, F.pos.z);
    F.lulu.update(dt, { walk: dist > 0.1 ? WALK : 0 });
    if ((dist < 0.25 && F.phaseT > 0.4) || F.phaseT > 1.5) { F.approach = null; startHotwire(pc); }
}
function startHotwire(pc) {
    const v = VEH[pc.vtype];
    F.hotwire = { pc, pins: v.pins, zoneW: v.zoneW, speed: v.speed, hit: 0, misses: 0, pos: 0, dir: 1, zoneC: rand(0.28, 0.72), result: null, resultT: 0 };
    F.phase = "hotwire"; F.phaseT = 0;
    hotTap = false;
    bubble(F.lulu.obj, pick(L.FOOT_STEAL_LINES), 2.0);
    A.sfxCloseCall(0);
    drawHotwire();
    hot.classList.remove("hidden");
}
function drawHotwire() {
    const h = F.hotwire;
    const name = { car: "CAR", cop: "COP CAR", ambulance: "AMBULANCE", bus: "BUS", dozer: "STEAMROLLER" }[h.pc.vtype];
    hot.classList.toggle("fail", h.result === "fail");
    hot.querySelector(".ttl").textContent = h.result === "win" ? "🔓 GOT IT!" : h.result === "fail" ? "🚨 ALARM — BAIL!" : `HOTWIRE THE ${name} — press in the GREEN!`;
    const z = hot.querySelector(".zone");
    z.style.left = ((h.zoneC - h.zoneW / 2) * 100).toFixed(1) + "%";
    z.style.width = (h.zoneW * 100).toFixed(1) + "%";
    hot.querySelector(".needle").style.left = (h.pos * 100).toFixed(1) + "%";
    const pins = hot.querySelector(".pins");
    if (pins.children.length !== h.pins) pins.innerHTML = "<i></i>".repeat(h.pins);
    [...pins.children].forEach((el, i) => el.classList.toggle("on", i < h.hit));
    hot.querySelector(".hint").innerHTML = h.result ? "" : `${glyph("interact")} when the needle's in the green · ${h.misses ? "one more slip sets off the ALARM!" : "two slips sets off the alarm"}`;
}
function updateHotwire(dt, P) {
    const h = F.hotwire;
    F.lulu.update(dt, { walk: 0, point: true });
    F.lulu.face(h.pc.x, h.pc.z, dt, 6);
    if (h.result) {
        h.resultT += dt;
        if (h.result === "win" && h.resultT > 0.5) { hot.classList.add("hidden"); finalizeBorrow(h.pc); return; }
        if (h.result === "fail" && h.resultT > 1.1) { hot.classList.add("hidden"); hotwireFail(h); return; }
        drawHotwire();
        return;
    }
    const tap = P.interact || P.confirm || hotTap;
    hotTap = false;
    if (tap) {
        if (Math.abs(h.pos - h.zoneC) < h.zoneW / 2 || ctx.foot.force.hotwire === true) {
            h.hit++;
            A.sfxCloseCall(2 + h.hit * 2);
            rumble(0.2, 0.4, 80);
            if (h.hit >= h.pins) { h.result = "win"; h.resultT = 0; A.sfxCoin(6); }
            else { h.zoneC = rand(0.22, 0.78); h.speed *= 1.06; }
        } else {
            h.misses++;
            A.sfxBump();
            rumble(0.5, 0.3, 160, true);
            floater(F.lulu.obj, "✖ slipped!", "#FF8A80", 1.0, 2.2);
            if (h.misses >= 2) { h.result = "fail"; h.resultT = 0; }
        }
    } else {
        h.pos += h.dir * h.speed * dt;
        if (h.pos >= 1) { h.pos = 1; h.dir = -1; } else if (h.pos <= 0) { h.pos = 0; h.dir = 1; }
    }
    drawHotwire();
}
function finalizeBorrow(pc) {
    floater(F.lulu.obj, "🔓 HOTWIRED!", "#7CFC4F", 1.4);
    // only a cop GENUINELY nearby (close enough to witness it) reacts
    const watcher = copNearby(40);
    const i = F.parked.indexOf(pc);
    if (i >= 0) F.parked.splice(i, 1);
    ctx.scene.remove(pc.obj);
    S.borrowed++; saveSoon();
    emit("stat", { id: "carsBorrowed", n: 1 });
    enterCar({ vtype: pc.vtype, key: pc.key, colors: pc.colors, x: pc.x, z: pc.z, h: pc.h, lemon: pc.lemon, how: "car" });
    H.toast(L.FOOT_HAIL_VEHICLE[pc.vtype] || "🔓 HOTWIRED!", "gold");
    if (watcher) {
        H.banner(`🚨 <b>GRAND THEFT AUTO — DRIVE!</b>`, 2200);
        if (ctx.law && ctx.law.startChase) { try { ctx.law.startChase("borrowed"); } catch (e) { console.error(e); } }
        emit("foot:crime", { charges: ["GRAND THEFT AUTO", "JOYRIDING"], seen: true });
    }
}
function hotwireFail(h) {
    floater(F.lulu.obj, "🚨 ALARM! Walk AWAY, casual...", "#FF8A80", 1.8);
    beep(3);
    h.pc.busted = true; h.pc.alarmT = 2.5;
    F.hotwire = null; F.phase = "walk"; F.phaseT = 0;
    if (copNearby(60)) {
        floater(F.lulu.obj, "👮 a cop SAW that — you're WANTED!", "#FF8A80", 2.0, 2.9);
        if (ctx.law && ctx.law.addWanted) { try { ctx.law.addWanted(["ATTEMPTED GRAND THEFT AUTO"]); } catch (e) { console.error(e); } }
        emit("foot:crime", { charges: ["ATTEMPTED GRAND THEFT AUTO"], seen: true });
    }
}

// ── thumbing a ride from a passing car ──────────────────────────────────
function hail(c) {
    const ok = ctx.foot.force.hail != null ? ctx.foot.force.hail : Math.random() < 0.42;   // most folks blow past
    F.waveT = 1.0;
    if (!ok) {
        bubble(c.obj, "Off duty!", 1.4);
        floater(F.lulu.obj, pick(L.FOOT_HAIL_NO), "#FF8A80", 1.6, 2.4);
        beep(1);
        return;
    }
    // they pull over beside her
    c.ai = (dt, car) => {
        car.speed = Math.max(0, car.speed - 12 * dt);
        car.s += car.speed * car.dir * dt;
    };
    c.noNearMiss = true;
    F.hail = { c };
    F.phase = "hail"; F.phaseT = 0;
    A.sfxCloseCall(4);
}
function updateHail(dt) {
    const c = F.hail.c;
    if (!ctx.traffic.cars.includes(c)) { F.hail = null; F.phase = "walk"; return; }
    const tx = c.x, tz = c.z;
    const dx = tx - F.pos.x, dz = tz - F.pos.z, dist = Math.hypot(dx, dz);
    if (c.speed < 0.5 && dist > 2.2) { const k = Math.min(dist - 2.0, WALK * 1.3 * dt) / dist; F.pos.x += dx * k; F.pos.z += dz * k; }
    F.lulu.face(tx, tz, dt, 8);
    F.lulu.obj.position.set(F.pos.x, 0.05, F.pos.z);
    F.lulu.update(dt, { walk: c.speed < 0.5 && dist > 2.2 ? WALK : 0, wave: c.speed >= 0.5 });
    if ((c.speed < 0.5 && dist <= 2.4) || F.phaseT > 4) {
        const spec = c.spec || {};
        const key = spec.model || c.kind;
        let colors = null;
        c.obj.traverse(o => { if (!colors && o.isMesh && o.material.name === "Paint") colors = { Paint: "#" + o.material.color.getHexString() }; });
        const vtype = /cop/.test(c.kind) ? "cop" : "car";
        const v = { vtype, key: models[key] ? key : "sedan", colors, x: c.x, z: c.z, h: c.h, how: "hail" };
        ctx.traffic.remove(c);
        S.hailed++; saveSoon();
        enterCar(v);
        H.toast(L.FOOT_HAIL_VEHICLE[vtype] || pick(L.FOOT_HAIL_OK), "gold");
    }
}

// ── chatter, arrival, stats, HUD ────────────────────────────────────────
function chatter(dt) {
    F.chatT -= dt;
    if (F.chatT <= 0) {
        F.chatT = rand(4, 7);
        if (!hasBubble(F.lulu.obj) && !F.chase) bubble(F.lulu.obj, pick(L.FOOT_LULU_CHAT), 2.0);
    }
    if (F.hintT > 0) { F.hintT -= dt; if (F.hintT <= 0) ctx.G.hint = null; }
}

// Walked all the way to Bubbe's? Zeidy's got the car — she drives the last bit in.
function arrivedOnFoot() {
    const G = ctx.G;
    if (G.mode !== "story" || G.arrived || !ctx.trip || F.phase !== "walk") return;
    if (ctx.trip.progress() < 0.999) return;
    H.banner(`🏡 <b>You WALKED to Bubbe's?!</b><small>Zeidy towed the car over. Hop in!</small>`, 2600);
    const rd = road();
    rd.point(F.s, 1.75, _p);
    enterCar({ own: true, x: _p.x, z: _p.z, h: _p.h });
}

function frac(f) {
    const G = ctx.G;
    if (G.mode === "story" && ctx.trip) return clamp(ctx.trip.progress(), 0, 1);
    const s0 = G.startS || 0;
    return clamp((f.s - s0) / Math.max(1, BUBBE_S - s0), 0, 1);
}
function saveFrac(f, force) {
    f.maxFrac = Math.max(f.maxFrac, frac(f));
    if (!force && f.maxFrac < f.fracSaved + 0.02) return;
    f.fracSaved = f.maxFrac;
    const v = Math.round(f.maxFrac * 1000) / 1000;
    if (v > (S.bestFrac || 0)) { S.bestFrac = v; saveSoon(); }
    if (v > (shared.get().footRunHigh || 0)) shared.update(s => { s.footRunHigh = Math.max(s.footRunHigh || 0, v); });
}
function flushDist(f) {
    const px = Math.floor(f.distAcc * PX);
    if (px >= 1) { emit("stat", { id: "footDist", n: px }); f.distAcc -= px / PX; }
}
function stats(dt) {
    F.statT += dt;
    if (F.statT >= 1) { F.statT = 0; flushDist(F); saveFrac(F, false); }
}

let chipEl = null, chaseEl = null;
function clearChips() {
    if (chipEl) { chipEl.remove(); chipEl = null; }
    if (chaseEl) { chaseEl.remove(); chaseEl = null; }
}
let chipText = "";
function hud() {
    if (!chipEl) { chipEl = document.createElement("div"); chipEl.className = "foot-chip"; H.hudSlot("left").appendChild(chipEl); chipText = ""; }
    const f = frac(F), best = Math.max(shared.get().footRunHigh || 0, F.maxFrac);
    const label = ctx.G.mode === "story" && ctx.trip ? "trip" : "🏡";
    const t = `🚶‍♀️ ON FOOT <small>· ${label} ${Math.round(f * 100)}% · best ${Math.round(best * 100)}%</small>${F.coins ? ` <small>· 💰+${F.coins}</small>` : ""}`;
    if (t !== chipText) { chipText = t; chipEl.innerHTML = t; }
    const ch = F.chase;
    if (ch && !ch.giveUp) {
        if (!chaseEl) { chaseEl = document.createElement("div"); chaseEl.className = "foot-chase"; H.hudSlot("center").appendChild(chaseEl); }
        const gp = clamp(ch.dist / 32, 0, 1);
        const col = gp > 0.6 ? "#7CFC4F" : gp > 0.3 ? "#FFD740" : "#FF5252";
        chaseEl.innerHTML = `🚨 COP CHASING — RUN! ⚡ <small>${glyph("boost")} sprint</small><div class="meter"><i style="width:${(gp * 100).toFixed(0)}%;background:${col}"></i></div>${ch.dist > 32 ? "<small>KEEP GOING! 🏃‍♀️</small>" : "<small>distance</small>"}`;
    } else if (chaseEl) { chaseEl.remove(); chaseEl = null; }
}

// ── touch: the ✋ hand button (on foot) and 🚶‍♀️ WALK (pulled over) ────────
on("boot", () => {
    handBtn = addTouchButton({ id: "foot_hand", emoji: "✋", label: "HAND", action: "interact",
        visible: () => ctx.state === "footRun" && !!F && (F.phase === "walk" || F.phase === "hotwire") });
    exitBtn = addTouchButton({ id: "foot_exit", emoji: "🚶‍♀️", label: "WALK", action: "interact",
        visible: () => ctx.state === "playing" && driveOff.shown });
});

// ── the service other features call ─────────────────────────────────────
ctx.foot = {
    start,
    /** true from the moment she climbs out until she's behind a wheel again (incl. inside a building / the wedding). */
    get active() { return !!F; },
    get level() { return F ? F.level : (shared.get().footRunsPlayed || 0); },
    get phase() { return F ? F.phase : null; },
    get pos() { return F ? F.pos : null; },
    get borrowed() { return shell ? shell.vtype : null; },
    /** Add an on-foot interactable: { x, z } or pos() → {x, z}; r; label (string | fn); act(). Returns a remover. */
    addSpot(spot) { spotList.push(spot); return () => { const i = spotList.indexOf(spot); if (i >= 0) spotList.splice(i, 1); }; },
    /** Bump into Avigail right now ("wedding" | "busy" | "join"; default: the 2D odds). */
    meetAvigail(outcome) {
        if (!F) return false;
        if (!F.walker && outcome !== "wedding") { if (!spawnAvigail({ s: F.s + 1.5, d: F.d + 0.6 })) return false; }
        meetAvigail(outcome);
        return true;
    },
    end(why = "end") { if (F) end(why); },
    /** Test / debug knobs: { avigail, er, hail, hotwire, tip, wreck } */
    force: {},
    debug: {
        get F() { return F; },
        spawnParked: o => F && spawnParked(o), spawnPed: o => F && spawnPed(o), spawnAnimal: o => F && spawnAnimal(o),
        spawnAvigail: o => F && spawnAvigail(o), spawnBooth: o => F && spawnBooth(o), startChase: o => F && startFootChase(o),
        interactables: () => F && interactables(), nextDoorAt, weddingState, allDoors,
        wedding: () => { if (!F) return false; goWedding(); return true; },
    },
};
