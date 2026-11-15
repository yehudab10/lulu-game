// features/banter — the road talks back.
//
//  · Honk at the car ahead and its driver answers (and sometimes honks back):
//    "OK OK!", "Who taught you to drive, your Bubbe?", a cop's "Ma'am. I'm
//    right here." — and honk the same car twice and they get REALLY annoyed.
//  · Oncoming drivers who find Lulu in their lane flail out the window.
//  · Near-missed drivers shake a fist out of the window.
//  · A slow driver in front sometimes waves her by and pulls over.
//  · Folks on the roadside wave hello, gasp when she whooshes past, and kids
//    cheer when she honks.
// The arms out of the windows are tiny pooled 3D props; the words are bubbles.
// All of it is random content → only when ctx.enabled("banter").
import * as THREE from "three";
import { ctx, on, MPH } from "../../core/ctx.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { LANES_OURS, facingRoad } from "../../world.js";
import { NPC, PED } from "./lines.js";
import { draw, quiet, clamp, npcHorn, Spring, chance } from "./util.js";
import { npcBubble } from "./bubbles.js";
import { say } from "./lulu.js";
import { lookAt } from "./rig.js";

const KINDS = new Set(["sedan", "van", "truck", "cop"]);
// the driver's window (car-model space; every driver sits on the car's left = +X)
const MOUNT = { sedan: [0.83, 1.1, 0.22], cop: [0.83, 1.1, 0.22], van: [0.95, 1.25, 1.15], truck: [1.12, 1.6, 2.75] };
const BUB_Y = { sedan: 2.05, cop: 2.25, van: 2.5, truck: 3.8 };
const line = (cat, list) => draw("npc:" + cat, list);

export const npcState = { replies: 0, lastReply: null, wrongWays: 0, fists: 0, waveBys: 0, pedWaves: 0, pedGasps: 0, pedCheers: 0, peds: 0 };

// ── arms out of the window (pooled) ────────────────────────────────────────
const SKINS = ["#F5C9A6", "#E0A97E", "#C68642", "#8D5524", "#FFDBC2"];
const SLEEVES = ["#1E88E5", "#43A047", "#FB8C00", "#8E24AA", "#E53935", "#546E7A", "#FDD835"];
let GEO = null;
function geo() {
    if (GEO) return GEO;
    const sleeve = new THREE.CylinderGeometry(0.075, 0.08, 0.28, 8); sleeve.translate(0, 0.14, 0);
    const fore = new THREE.CylinderGeometry(0.055, 0.065, 0.28, 8); fore.translate(0, 0.38, 0);
    const fist = new THREE.SphereGeometry(0.095, 12, 8); fist.scale(1, 0.92, 1.12); fist.translate(0, 0.57, 0);
    const thumb = new THREE.SphereGeometry(0.04, 8, 6); thumb.translate(-0.07, 0.56, 0.06);
    GEO = { sleeve, fore, fist, thumb };
    return GEO;
}
const arms = [];      // { obj, skin, sleeve, car, mode, t, dur, s: Spring }
function makeArm(i) {
    const G = geo();
    const skin = new THREE.MeshStandardMaterial({ color: SKINS[i % SKINS.length], roughness: 0.7 });
    const sleeve = new THREE.MeshStandardMaterial({ color: SLEEVES[i % SLEEVES.length], roughness: 0.8 });
    const obj = new THREE.Group();
    obj.name = "BanterArm";
    const inner = new THREE.Group();
    inner.add(new THREE.Mesh(G.sleeve, sleeve), new THREE.Mesh(G.fore, skin), new THREE.Mesh(G.fist, skin), new THREE.Mesh(G.thumb, skin));
    obj.add(inner);
    return { obj, inner, skin, sleeve, car: null, mode: "", t: 0, dur: 0, s: new Spring(140, 0.5) };
}
for (let i = 0; i < 4; i++) arms.push(makeArm(i));

/** Stick an arm out of `car`'s driver window: mode "fist" | "wave" | "panic" | "waveBy". */
function armOut(car, mode, dur = 1.8) {
    const m = MOUNT[car.kind];
    if (!m) return null;
    let a = arms.find(x => x.car === car) || arms.find(x => !x.car);
    if (!a) return null;
    if (a.car !== car) {
        a.skin.color.set(SKINS[Math.floor(Math.random() * SKINS.length)]);
        a.sleeve.color.set(SLEEVES[Math.floor(Math.random() * SLEEVES.length)]);
        a.s.reset(0);
    }
    a.car = car; a.mode = mode; a.t = 0; a.dur = dur;
    a.obj.position.set(m[0], m[1], m[2]);
    a.obj.scale.setScalar(car.kind === "truck" ? 1.45 : 1.25);
    car.obj.add(a.obj);
    return a;
}
function armIn(a) { if (a.obj.parent) a.obj.parent.remove(a.obj); a.car = null; }

function updateArms(dt) {
    const T = ctx.traffic;
    for (const a of arms) {
        if (!a.car) continue;
        a.t += dt;
        if (a.t > a.dur + 0.4 || !T.cars.includes(a.car) || a.car.hit) { armIn(a); continue; }
        const pop = a.s.step(a.t < a.dur ? 1 : 0, dt);
        a.inner.scale.setScalar(Math.max(0.001, pop));
        const t = a.t, o = a.obj.rotation;
        switch (a.mode) {
            case "fist": o.set(Math.sin(t * 8) * 0.15, 0, -0.78 + Math.sin(t * 17) * 0.24); break;
            case "wave": o.set(0, 0, -0.55 + Math.sin(t * 9) * 0.5); break;
            case "panic": o.set(Math.cos(t * 17) * 0.35, 0, -0.5 + Math.sin(t * 23) * 0.6); break;
            case "waveBy": o.set(Math.sin(t * 7) * 0.65, 0, -1.3); break;
            default: o.set(0, 0, -0.7);
        }
    }
}

// ── honk → the car ahead answers ───────────────────────────────────────────
let pendingReply = null;
on("honk", () => {
    if (!ctx.enabled("banter") || ctx.state !== "playing") return;
    const car = ctx.car;
    let best = null, bestGap = 55;
    for (const c of ctx.traffic.cars) {
        if (c.hit || (c.ai && c.kind !== "cop") || c.data.beh) continue;
        const gap = (c.s - car.s);
        if (c.dir > 0 && gap > 2 && gap < bestGap && Math.abs(c.d - car.d) < 2.2) { best = c; bestGap = gap; }
    }
    if (!best) {   // nobody in her lane: an oncoming car close ahead takes it personally
        for (const c of ctx.traffic.cars) {
            if (c.hit || c.ai || c.dir > 0 || c.data.beh) continue;
            const gap = c.s - car.s;
            if (gap > 4 && gap < Math.min(bestGap, 40)) { best = c; bestGap = gap; }
        }
    }
    if (!best || !KINDS.has(best.kind)) return;
    const now = ctx.time, d = best.data;
    d.bnHonks = d.bnHonkT && now - d.bnHonkT < 6 ? (d.bnHonks || 1) + 1 : 1;
    d.bnHonkT = now;
    lookAt(best, 1.2);
    if (pendingReply && pendingReply.car === best) { pendingReply.n = d.bnHonks; return; }
    pendingReply = { car: best, dT0: best.dTarget, at: now + 0.55 + Math.random() * 0.25, n: d.bnHonks, checked: false };
});

function reply(p) {
    const c = p.car;
    if (!ctx.traffic.cars.includes(c) || c.hit) return;
    const moved = c.dTarget !== p.dT0;
    let cat, cls, mode = "fist", horn = 0.3;
    if (c.kind === "cop") { cat = "honkCop"; cls = "cop"; mode = ""; horn = 0; }
    else if (c.dir < 0) { cat = "honkOncoming"; cls = "angry"; mode = "wave"; horn = 0.5; }
    else if (p.n >= 2) { cat = "honkAgain"; cls = "angry"; horn = 0.55; }
    else if (c.kind === "truck") { cat = "honkTruck"; cls = "truck"; mode = "wave"; horn = 0.75; }
    else if (moved) { cat = "honkMoved"; cls = "nice"; mode = "wave"; horn = 0.15; }
    else { cat = "honkStuck"; cls = "angry"; }
    // roadevents may already have quipped for a car that moved over — then gesture, and only sometimes talk
    const words = !(moved && ctx.enabled("roadevents")) || chance(0.6);
    if (words) npcBubble(line(cat, NPC[cat]), c.obj, { dur: 2.5, y: BUB_Y[c.kind] || 2.2, cls });
    if (mode) armOut(c, mode, 1.9);
    if (Math.random() < horn) npcHorn(c.kind, clamp(1 - (c.s - ctx.car.s) / 70, 0.25, 1), c.kind === "truck" ? 2 : 2);
    npcState.replies++;
    npcState.lastReply = { cat, kind: c.kind, words, moved };
    if (cls === "angry" && words) say("comeback", {}, { delay: 1.5 });
}

// ── wrong lane: oncoming drivers panic ─────────────────────────────────────
let wwCool = 0;
function wrongWayWatch(dt) {
    wwCool -= dt;
    const car = ctx.car;
    for (const c of ctx.traffic.cars) {
        if (c.dir > 0 || c.hit || c.ai || c.data.bnWW || !(c.flash > 0.95)) continue;
        const gap = c.s - car.s;
        if (gap < 8 || gap > 70) continue;
        c.data.bnWW = true;
        if (wwCool > 0 || !KINDS.has(c.kind) || !chance(0.85)) continue;
        wwCool = 2.5;
        npcBubble(line("wrongWay", NPC.wrongWay), c.obj, { dur: 2.2, y: BUB_Y[c.kind] || 2.2, cls: "angry" });
        armOut(c, "panic", 1.8);
        npcState.wrongWays++;
    }
}

// ── near miss: a fist out of the window ────────────────────────────────────
on("closeCall", () => {
    if (!ctx.enabled("banter") || ctx.state !== "playing") return;
    const car = ctx.car;
    let best = null, bd = 13 * 13;
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.ai) continue;
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < bd) { bd = d2; best = c; }
    }
    if (!best || !KINDS.has(best.kind) || best.data.beh || !chance(0.8)) return;
    armOut(best, "fist", 1.7);
    npcState.fists++;
    // roadevents has its own near-miss quips; without it, the driver yells too
    if (!ctx.enabled("roadevents") && chance(0.65)) {
        npcBubble(line("nearMiss", NPC.nearMiss), best.obj, { dur: 2.0, y: BUB_Y[best.kind] || 2.2, cls: "angry" });
        if (Math.random() < 0.3) npcHorn(best.kind, 0.6, 2);
    }
});

// ── a slow driver waves her by ─────────────────────────────────────────────
let stuck = { car: null, t: 0 }, waveCool = 12;
function waveByWatch(dt) {
    waveCool -= dt;
    const car = ctx.car;
    let ahead = null, gap = 30;
    for (const c of ctx.traffic.cars) {
        if (c.dir < 0 || c.hit || c.ai || c.data.beh || c.data.bnWaved || !KINDS.has(c.kind) || c.kind === "cop") continue;
        const g = c.s - car.s;
        if (g > 7 && g < gap && Math.abs(c.d - car.d) < 1.6) { ahead = c; gap = g; }
    }
    const stuckBehind = ahead && car.speed > 6 && ahead.speed < 22 && car.speed < ahead.speed + 4;
    if (!stuckBehind) { stuck.car = null; stuck.t = 0; return; }
    if (stuck.car !== ahead) { stuck.car = ahead; stuck.t = 0; }
    stuck.t += dt;
    if (stuck.t < 2.2 || waveCool > 0) return;
    ahead.data.bnWaved = true;
    stuck.car = null;
    if (!chance(0.5)) return;
    waveCool = 18;
    const other = LANES_OURS.find(l => Math.abs(l - ahead.dTarget) > 1);
    if (other !== undefined && other > ahead.dTarget && ctx.traffic.laneFree(ahead.s, other, 1, 14)) { ahead.dTarget = other; ahead.laneCooldown = 6; }
    else ahead.want = Math.max(8, ahead.base * 0.7);
    armOut(ahead, "waveBy", 2.4);
    npcBubble(line("waveBy", NPC.waveBy), ahead.obj, { dur: 2.6, y: BUB_Y[ahead.kind] || 2.2, cls: "nice" });
    npcState.waveBys++;
    say("thanks", {}, { delay: 1.8 });
}

// ── roadside onlookers ──────────────────────────────────────────────────────
const PED_LOOKS = [
    { key: "npcWoman", colors: { Top: "#E91E63", Bottom: "#37474F", Hair: "#5D4037" } },
    { key: "npcMan", colors: { Top: "#42A5F5", Bottom: "#3E2723", Hair: "#212121" } },
    { key: "npcKid", colors: { Top: "#FFCA28", Bottom: "#1565C0", Hair: "#8D6E63" }, kid: true },
    { key: "npcWoman", colors: { Top: "#7E57C2", Bottom: "#263238", Hair: "#212121" } },
    { key: "npcKid", colors: { Top: "#66BB6A", Bottom: "#6D4C41", Hair: "#3E2723" }, kid: true },
];
let pedModels = 0;           // 0 not loaded · 1 loading · 2 ready · −1 failed
const peds = [];             // { look, p, on, s, d, side, said, t, react, honkT, hop: Spring, lean: Spring }
let pedT = 6;
function loadPeds() {
    if (pedModels !== 0) return;
    pedModels = 1;
    ensureModels(["npcWoman", "npcMan", "npcKid"]).then(() => {
        for (const look of PED_LOOKS) {
            const p = spawnPerson(look.key, { colors: look.colors, scale: look.kid ? 0.8 : 1 });
            peds.push({ look, p, on: false, s: 0, d: 0, side: 1, said: false, t: 0, react: "", reactT: 0, honkT: -9, hop: new Spring(160, 0.35), lean: new Spring(90, 0.5) });
        }
        pedModels = 2;
    }).catch(e => { pedModels = -1; console.error("[banter] onlookers", e); });
}
const _p = {};
function spotFree(s, d) {
    const w = ctx.world;
    if (w.isReserved(s, d, 3)) return false;
    w.road.point(s, d, _p);
    for (const ch of w.activeChunks()) {
        if (s < ch.s0 - 10 || s > ch.s1 + 10) continue;
        for (const c of ch.colliders) { const dx = c.x - _p.x, dz = c.z - _p.z; if (dx * dx + dz * dz < (c.r + 1.6) * (c.r + 1.6)) return false; }
    }
    return true;
}
function spawnPed() {
    const free = peds.filter(x => !x.on);
    if (!free.length) return;
    const P = free[Math.floor(Math.random() * free.length)];
    const car = ctx.car;
    const s = car.s + 150 + Math.random() * 60;
    const side = Math.random() < 0.7 ? 1 : -1;
    const d = side * (9.5 + Math.random() * 0.9);
    if (!spotFree(s, d)) return;
    const h = ctx.world.road.at(s).h;
    P.p.obj.position.set(_p.x, 0, _p.z);
    P.p.obj.rotation.set(0, facingRoad(h, side) - side * 0.5, 0);
    ctx.scene.add(P.p.obj);
    Object.assign(P, { on: true, s, d, side, said: false, t: 0, react: "", reactT: 0, honkT: -9 });
    P.hop.reset(); P.lean.reset();
    npcState.peds++;
}
function despawnPed(P) { P.on = false; if (P.p.obj.parent) P.p.obj.parent.remove(P.p.obj); }
export function clearPeds() { for (const P of peds) if (P.on) despawnPed(P); }

function updatePeds(dt, live) {
    if (pedModels !== 2) return;
    const car = ctx.car;
    if (live) {
        pedT -= dt;
        if (pedT <= 0) { pedT = 9 + Math.random() * 13; if (car.speed > 5 && peds.filter(x => x.on).length < 2) spawnPed(); }
    }
    for (const P of peds) {
        if (!P.on) continue;
        P.t += dt;
        const rel = P.s - car.s;
        if (rel < -30 || rel > 400) { despawnPed(P); continue; }
        const o = P.p.obj;
        const dx = car.pos.x - o.position.x, dz = car.pos.z - o.position.z, dist = Math.hypot(dx, dz);
        if (dist < 45) P.p.face(car.pos.x, car.pos.z, dt, 3);
        // she's driving right at them: jump out of the way
        if (dist < 4.5 && P.react !== "dive") {
            P.react = "dive"; P.reactT = 0; P.hop.kick(5); P.said = true;
            if (live) { npcBubble(line("gasp", PED.gasp), o, { dur: 1.8, y: P.look.kid ? 1.6 : 2.05, cls: "angry" }); npcState.pedGasps++; }
        }
        if (P.react === "dive") { P.d += P.side * dt * 5 * Math.max(0, 1 - P.reactT / 0.5); ctx.world.road.point(P.s, P.d, _p); o.position.x = _p.x; o.position.z = _p.z; }
        // as she comes by
        if (!P.said && live && rel < 34 && rel > -4) {
            P.said = true; P.reactT = 0;
            const fast = car.speed * MPH > 68 || Math.abs(car.d - P.d) < 4.2 || car.boosting;
            const honked = ctx.time - honkAt < 1.6;
            let cat, cls;
            if (P.look.kid) { cat = honked ? "kidHonk" : "kid"; cls = "kid"; P.react = "cheer"; npcState.pedCheers++; }
            else if (fast) { cat = "gasp"; cls = "angry"; P.react = "gasp"; P.hop.kick(3.2); P.lean.kick(-5); npcState.pedGasps++; }
            else { cat = "wave"; cls = "nice"; P.react = "wave"; npcState.pedWaves++; }
            if (chance(0.75)) npcBubble(line(cat, PED[cat]), o, { dur: 2.0, y: P.look.kid ? 1.6 : 2.05, cls });
            if (P.react === "wave" && Math.random() < 0.5) lookAt(o, 1.0);
        }
        if (P.honkT > 0) {     // she honked nearby: kids LOVE it
            if (P.look.kid && live && P.said) { P.react = "cheer"; P.reactT = 0; npcBubble(line("kidHonk", PED.kidHonk), o, { dur: 1.8, y: 1.6, cls: "kid" }); }
            P.honkT = -9;
        }
        P.reactT += dt;
        const r = P.reactT < 2.2 ? P.react : "";
        o.position.y = Math.max(0, P.hop.step(0, dt));
        P.lean.step(0, dt);
        o.rotation.x = P.lean.x * 0.12;
        P.p.update(dt, { wave: r === "wave", cheer: r === "cheer" || (r === "gasp" && P.reactT < 0.7) || r === "dive" });
    }
}
let honkAt = -9;
on("honk", () => {
    honkAt = ctx.time;
    for (const P of peds) if (P.on && Math.abs(P.s - ctx.car.s) < 40) P.honkT = ctx.time;
});

// ── per frame / lifecycle ─────────────────────────────────────────────────
/** Every driving frame (hud hook). */
export function tickNpc(dt) {
    const on_ = ctx.enabled("banter");
    const live = on_ && !quiet();
    if (pendingReply && ctx.time >= pendingReply.at) {
        const p = pendingReply; pendingReply = null;
        if (live) reply(p);
    }
    updateArms(dt);
    if (on_ && ctx.state === "playing") {
        wrongWayWatch(dt);
        waveByWatch(dt);
    }
    updatePeds(dt, live);
}
on("run:start", () => {
    pendingReply = null; stuck = { car: null, t: 0 }; waveCool = 12; wwCool = 0; pedT = 6;
    for (const a of arms) armIn(a);
    clearPeds();
    if (ctx.enabled("banter")) loadPeds();
});
on("state", ({ to }) => { if (to === "title" || to === "gameover") { for (const a of arms) armIn(a); clearPeds(); } });

/** Debug / tests: make a car react right now. */
export function forceReply(car, n = 1) { reply({ car, dT0: car.dTarget, n }); }
export { armOut, arms as npcArms, peds as npcPeds, spawnPed as forcePed };
