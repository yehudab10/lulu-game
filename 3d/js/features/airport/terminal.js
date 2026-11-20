// ─────────────────────────────────────────────────────────────────────────
//  features/airport — ✈️ THE JFK TERMINAL (stage 2 of roadmap 12, 3d/docs/airport-plan.md).
//
//  ONE walk-in hall on the interiors engine (interiors/engine.js), left (landside, the kerb doors) to right
//  (airside, the gate) — models: 3d/blender/assets_airport_terminal.py:
//    • CHECK-IN — Kugel Air, El Oy, Shmear Jet: an agent each with their own jokes; Bubbe Faigy's overweight bag on
//      the Kugel Air scale (wear her sweaters / "lighten" a kugel / sit on it)
//    • THE DEPARTURES BOARD — a canvas: silly destinations, statuses that flip ("DELAYED — PILOT AT A SIMCHA")
//    • ARRIVALS — the frosted doors slide open, people come out with luggage, greeters with signs cheer + hug;
//      an empty VIP red carpet (stage 3: a famous singer comes through here — strangers don't know who)
//    • THE SECURITY LINE — one long silly gag: wait the snake (captions), or duck under the ropes (the line's outrage,
//      the Segway guard); the BEEP-O-MATIC 3000 beeps at her keys and her kugel, Rex the dog only ever finds kugel.
//      Airside is behind a glass divider; the way back is a one-way EXIT lane.
//    • THE FOOD COURT — Shmuley's deli + the H2-OY! water bar: a snack restores a heart at a fixed price, capped
//      (FOOD_CAP hearts a run, nothing when her hearts are full, never pays out a coin)
//    • THE GATE — GATE 18, rows of seats she can sit in (friends see her sitting), the desk ("BOARDING SOON — NOT YOU"),
//      a window onto the apron: a parked Kugel Air plane at the jet bridge, planes taking off down the runway
//    • THE CROWD — terminal-crowd.js (homes' instanced rigs): rolling suitcases, the line, the family with ten kids
//      doing laps looking for gate 18, the man asleep across four seats, the PA
//    • THE LAW — walked in WANTED: Officer Segal on his Segway + Rex follow her (Rex has her shoelace: she's slow),
//      then two real cops walk in through the doors; caught → out the door into law's arrest (solo; a 🎉 party: the
//      guard + Rex only)
//  A SHARED room (features/together/rooms.js › SHARED.terminal): friends in a party see each other walk, sit and
//  emote inside; presence "✈️ in the JFK terminal". Strangers are never inside.
//
//  ctx.airport.terminal = { enter(opts), warm(), ready(), canEnter(), inside, vip(), addBuilder(fn), debug }
//  ctx.airport.debug.enterTerminal() — walk in from wherever she's standing (until stage 1's doors land; tests).
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { registerModels, models, findNodes, cloneWithColors } from "../../models.js";
import { wallet } from "../../core/save.js";
import { heal } from "../../core/driving.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { defineInterior, current, pool, pick, rand } from "../interiors/engine.js";
import { canvasPlane, drawLines, sfx, tone } from "../interiors/fx.js";
import { Crowd, path } from "./terminal-crowd.js";
import * as D from "./terminal-data.js";

registerModels({ airportTerminal: "airport_terminal", airportTerminalProps: "airport_terminal_props", lawK9: "law_k9" });

/** Tuning (tests read these). */
export const TUNE = {
    FOOD_CAP: 2,            // hearts the food court can restore in one run
    COPS_AT: 14,            // game seconds after a WANTED Lulu walks in before the real cops come through the doors
    COP_SPEED: 2.7,
    SLOW: 1.9,              // her walking speed while Rex has her shoelace (normal 3.6)
    WALK: 3.6,
    FULL: { low: 8, medium: 14, high: 20 },        // full-detail people at once (the rest: the LOD figure)
};
const BUILDERS = [];
const T = { pendingArrest: null, visits: 0 };
const say = (rt, who, text, style, agent) => {
    if (agent) { agent.talkT = 99; agent.faceTo = rt.lulu.obj.position; }
    return rt.say(who, text, style || {}).then(r => { if (agent) { agent.talkT = 0; agent.faceTo = null; } return r; });
};
const S_AGENT = c => ({ emoji: "✈️", color: c });
const S_LULU = { emoji: "💁‍♀️", color: "#AD1457" };
const S_GUARD = { emoji: "🛴", color: "#1F3A5F" };
const S_DELI = { emoji: "🥪", color: "#2E7D32" };
const S_WATER = { emoji: "💧", color: "#0277BD" };
const S_GATE = { emoji: "🎫", color: "#283593" };
const S_BUBBE = { emoji: "👵", color: "#6A1B9A" };

const boardLine = pool(D.BOARD_LULU), guardLine = pool(D.GUARD), dogLine = pool(D.DOG), arrLine = pool(D.ARRIVALS), greetLine = pool(D.GREETERS),
    vipLine = pool(D.VIP), deskLine = pool(D.GATE.desk), windowLine = pool(D.GATE.window), sleepLine = pool(D.GATE.sleeper), sitLine = pool(D.GATE.sit),
    famLine = pool(D.FAMILY), paLine = pool(D.PA), enterLine = pool(D.ENTER);
const HELLO = {}; for (const k of Object.keys(D.AIRLINES)) HELLO[k] = pool(D.AIRLINES[k].hello);

const tier = () => (ctx.gfx && ctx.gfx.tier) || "medium";
const partyOn = () => !!(ctx.party && ctx.party.active);
const V = new THREE.Vector3();

// ════ the room ═══════════════════════════════════════════════════════════
const def = defineInterior({
    id: "terminal", name: "the JFK terminal", short: "the terminal", emoji: "✈️",
    title: "✈️ JFK · TERMINAL 4½", tagline: "Parody airlines · real delays",
    model: "airportTerminal", models: ["airportTerminalProps", "npcMan", "npcWoman", "npcKid", "copPerson", "lawK9"],
    music: "../story-relax.mp3",
    light: "indoor", sky: "#BFE3F7", fog: [80, 220],
    bounds: { x0: -27.4, x1: 27.4, z0: -6.5, z1: 6.4 },
    cam: { dist: 8.4, height: 5.2, clampX: 4.5 },
    walkSpeed: TUNE.WALK,
    build, tick, luluPost, dispose,
});

/** A clone of one of the terminal's props (Prop_<name>). */
function tprop(name) {
    const src = models.airportTerminalProps && findNodes(models.airportTerminalProps, "Prop_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    return c;
}

function build(rt) {
    const set = rt.set, d = rt.data, sp = n => rt.spots[n] || { x: 0, z: 0, ry: 0 };
    T.visits++;
    // ── light: a bright hall; the sun's shadow box follows her down the 56 m hall (tick) ──
    set.hemi.color.set("#F4F8FF"); set.hemi.groundColor.set("#9AA4AE"); set.hemi.intensity = 1.55;
    set.sun.color.set("#FFF6E5"); set.sun.intensity = 1.25;
    Object.assign(set.sun.shadow.camera, { left: -15, right: 15, top: 15, bottom: -15, far: 60 });
    set.sun.shadow.camera.updateProjectionMatrix();
    rt.pointLight("tube1", "#FFF8EE", 5, 16, 1.4, true);
    rt.pointLight("tube2", "#FFF8EE", 5, 16, 1.4, true);
    // the hall itself never casts (it's walls and floor — the people do)
    rt.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
    d.doorL = rt.node("ArrDoor_L"); d.doorR = rt.node("ArrDoor_R");
    d.doorL0 = d.doorL ? d.doorL.position.x : 0; d.doorR0 = d.doorR ? d.doorR.position.x : 0; d.doorOpen = 0; d.doorT = 0;
    d.lampR = rt.node("ScanLamp_red"); d.lampG = rt.node("ScanLamp_green");
    if (d.lampR) d.lampR.visible = false;
    d.col = id => rt.cols.find(c => c.id === id);
    d.side = "land";            // landside | airside (the divider at x = 12)

    // ── the people ──
    const C = d.crowd = new Crowd(set, models.airportTerminalProps, { fullMax: TUNE.FULL[tier()] || 14 });
    const A = d.A = {};
    const named = (id, look, at, o = {}) => (A[id] = C.add(Object.assign({ id, look, x: at.x, z: at.z, ry: at.ry || 0, homeRy: at.ry || 0, named: true }, o)));
    named("kugel", "woman", sp("kugel"), { top: "#FFC107", hair: "#5D4037" });
    named("eloy", "man", sp("eloy"), { top: "#29B6F6", hair: "#212121" });
    named("shmear", "woman", sp("shmear"), { top: "#FF7043", hair: "#FFB74D" });
    const sc = sp("scale");
    named("bubbe", "woman", { x: sc.x + 0.75, z: sc.z + 0.85, ry: Math.PI }, { top: "#8E24AA", bot: "#4A148C", hair: "#ECEFF1", scale: 0.94 });
    d.bag = tprop("BigBag"); d.bag.position.set(sc.x, 0.16, sc.z); d.bag.rotation.y = 0.1; rt.add(d.bag);
    d.bagLb = 41;
    named("deli", "man", sp("deli"), { top: "#FAFAFA", hair: "#3E2723" });
    named("water", "woman", sp("water"), { top: "#26C6DA", hair: "#212121" });
    named("gate", "woman", sp("gateAgent"), { top: "#283593", hair: "#5D4037" });
    const g0 = sp("guard");
    named("guard", "cop", g0, { pose: { ride: true }, y: 0.16, speed: 1.0, path: path([[g0.x + 1.1, -1.4], [g0.x + 1.1, 3.6]], false) });
    d.segway = tprop("Segway"); rt.add(d.segway);
    const dg = sp("dog");
    d.dog = C.addDog({ x: dg.x, z: dg.z, ry: dg.ry, home: { x: dg.x, z: dg.z } });
    // the check-in lines (inside each desk's ropes) — Kugel Air's is the long one, Shmear Jet has none
    for (const [k, n] of [["kugel", 3], ["eloy", 2]]) {
        const s = sp(k);
        for (let i = 0; i < n; i++) C.add({ look: i === 1 ? "woman" : "man", x: s.x + (i % 2 ? 0.12 : -0.1), z: -2.85 + i * 0.75, ry: Math.PI, bag: true, seed: 0.13 * (i + 1) + (k === "eloy" ? 0.5 : 0) });
    }
    // the security snake: people in every lane (to one side: she walks the other), facing the way it goes
    d.line = [];
    const lanes = [-1.2, -2.4, -3.6];
    lanes.forEach((lz, li) => {
        const xs = li === 2 ? [6.6, 7.9, 9.2] : [6.0, 7.2, 8.4, 9.6];
        xs.forEach((x, i) => {
            const a = C.add({ look: (i + li) % 3 === 2 ? "kid" : (i + li) % 2 ? "woman" : "man", x, z: lz + 0.3, ry: li === 1 ? -Math.PI / 2 : Math.PI / 2, bag: (i + li) % 2 === 0, seed: 0.07 * (i + 1) + li * 0.31 });
            a.home = { x, z: lz + 0.3 }; a.dir = li === 1 ? -1 : 1;
            d.line.push(a);
        });
    });
    d.shuffleT = 4; d.shuffleK = 0;
    // the arrivals greeters (signs up) + the guy reading the board
    for (let k = 0; k < 4; k++) { const s = sp("greeter" + k); C.add({ id: "greeter" + k, look: k === 2 ? "woman" : "man", x: s.x, z: s.z, ry: Math.PI, pose: { hold: true }, seed: 0.21 * k + 0.05 }); }
    C.add({ look: "man", x: -6.6, z: -3.7, ry: Math.PI + 0.25, seed: 0.66, pose: { phone: true } });
    // the gate: people waiting, the man asleep across four seats
    for (const [r, i, look] of [[0, 1, "woman"], [0, 4, "man"], [1, 0, "man"], [1, 5, "woman"], [2, 5, "kid"]]) {
        const s = sp(`seat${r}_${i}`);
        C.add({ look, x: s.x, z: s.z, ry: Math.PI, pose: { sit: true }, seed: 0.17 * (r * 6 + i) + 0.02 });
    }
    d.taken = new Set(["0_1", "0_4", "1_0", "1_5", "2_5", "2_0", "2_1", "2_2", "2_3"]);
    const sl = sp("sleeper");
    A.sleeper = C.add({ id: "sleeper", look: "man", x: sl.x - 0.95, z: sl.z - 0.1, y: 0.62, ry: -Math.PI / 2, pose: { lie: true }, top: "#6D4C41", scale: 1.08, named: true, collide: false });
    for (const k of [0, 3]) { const s = sp(`seat2_${k}`); const b = tprop("Suitcase"); b.position.set(s.x, 0.52, s.z); b.rotation.set(Math.PI / 2, 0, 0.2); recolour(b, k === 0 ? "#6A1B9A" : "#2E7D32"); rt.add(b); }
    // the food court: people eating
    for (const [k, j] of [[0, 0], [1, 1], [2, 0]]) { const s = sp(`eat${k}_${j}`); C.add({ look: k === 1 ? "woman" : "man", x: s.x, z: s.z, ry: s.ry, pose: { sit: true, talk: k === 2 }, seed: 0.29 * k + 0.4 }); }
    // walkers rolling suitcases: landside laps + airside laps
    const land = path([[-25.5, 5.5], [3.6, 5.5], [3.6, 0.3], [-25.5, 0.3]]), air = path([[13.6, 5.9], [27.0, 5.9], [27.0, 4.7], [13.6, 4.7]]);
    for (let i = 0; i < 5; i++) C.add({ look: i === 2 ? "woman" : i === 4 ? "kid" : i % 2 ? "woman" : "man", path: land, u: i * land.total / 5, speed: 1.15 + (i % 3) * 0.15, bag: i !== 4, seed: 0.11 * i + 0.3 });
    for (let i = 0; i < 2; i++) C.add({ look: i ? "man" : "woman", path: air, u: i * air.total / 2, speed: 1.2, bag: true, seed: 0.37 * i + 0.6 });
    // the family with ten kids doing laps of the food court looking for gate 18 (it's right there)
    const fam = path([[14.0, 3.1], [19.6, 3.1], [19.6, -3.9], [14.0, -3.9]]);
    d.family = [];
    A.ima = C.add({ id: "ima", look: "woman", path: fam, u: 11, speed: 1.05, top: "#00897B", hair: "#3E2723", bag: true, named: true });
    d.family.push(A.ima);
    d.family.push(C.add({ look: "man", path: fam, u: 10.1, speed: 1.05, top: "#263238", bag: true }));
    for (let k = 0; k < 10; k++) d.family.push(C.add({ look: "kid", path: fam, u: 9.2 - k * 0.72, speed: 1.05, seed: 0.09 * k + 0.01, top: ["#E53935", "#1E88E5", "#FDD835", "#43A047", "#FB8C00", "#8E24AA", "#00ACC1", "#F06292", "#7CB342", "#FF7043"][k] }));

    // ── the boards ──
    makeBoards(rt);
    // the greeters' signs: four quads on ONE canvas (one texture, one draw call)
    makeSigns(rt);
    // ── outside: the parked plane at the jet bridge + planes taking off down the runway ──
    d.planes = [];
    const parked = makePlane(rt, D.AIRLINES.kugel.color);
    parked.position.set(22.6, -0.18, -23.5);
    d.takeoffT = 5;

    // ── hotspots ──
    hotspots(rt);

    // ── walked in WANTED: cartoon security slows her, the real cops can catch up ──
    const wanted = !!(ctx.law && ctx.law.wanted > 0 && !ctx.law.lowKey);
    d.law = wanted ? { t: 0, cops: null, caught: false, spotted: false, slowSaid: 0 } : null;
    def.walkSpeed = TUNE.WALK;
    d.paT = 9;
    d.exitSaid = 0;
    d.enterSaid = false;
    // stage 3 (Dovid Dov at arrivals, the lost suitcase, the taxi rank…) adds its own bits here
    for (const fn of BUILDERS) { try { fn(rt, API); } catch (e) { console.error("[airport] terminal builder", e); } }
    emit("airport:terminal", { in: true, wanted });
    emit("stat", { id: "airportTerminalVisits", n: 1 });
}

function recolour(obj, hex) {
    obj.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(hex); } });
}

function makePlane(rt, livery) {
    const src = models.airportTerminalProps && findNodes(models.airportTerminalProps, "Prop_Plane")[0];
    const p = src ? cloneWithColors(src, { Livery: livery }) : new THREE.Group();
    p.position.set(0, 0, 0);
    p.scale.setScalar(4.5);
    p.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
    rt.add(p);
    return p;
}

// ── the boards (canvases) ────────────────────────────────────────────────
const FLAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function scramble(s, k) { let o = ""; for (let i = 0; i < s.length; i++) o += s[i] === " " ? " " : (Math.random() < k ? FLAP[Math.floor(Math.random() * FLAP.length)] : s[i]); return o; }
function makeBoards(rt) {
    const d = rt.data;
    // the departures board
    d.rows = D.FLIGHTS.slice(0, 7).map(r => Object.assign({}, r));
    d.nextFlight = 7; d.flap = null; d.flapT = 0; d.boardT = 7; d.scrollT = 40;
    const bf = rt.fx("board");
    d.board = canvasPlane(rt.set, 7.2, 2.75, (g, w, h) => {
        g.fillStyle = "#0E1621"; g.fillRect(0, 0, w, h);
        g.fillStyle = "#16273A"; g.fillRect(0, 0, w, 56);
        g.font = "700 34px Fredoka, Arial, sans-serif"; g.textBaseline = "middle"; g.textAlign = "left";
        g.fillStyle = "#FFD54F"; g.fillText("✈ DEPARTURES", 18, 29);
        g.font = "600 20px Fredoka, Arial, sans-serif"; g.fillStyle = "#90A4AE";
        const cols = [18, 108, 218, 486, 552];
        ["TIME", "FLIGHT", "TO", "GATE", "STATUS"].forEach((t, i) => g.fillText(t, cols[i], 72));
        const rh = (h - 92) / d.rows.length;
        d.rows.forEach((r, i) => {
            const y = 92 + rh * (i + 0.5);
            if (i % 2) { g.fillStyle = "rgba(255,255,255,0.04)"; g.fillRect(0, y - rh / 2, w, rh); }
            const fl = d.flap && d.flap.i === i ? d.flap.k : 0;
            g.font = "700 25px 'Courier New', monospace";
            g.fillStyle = "#FFE082";
            g.fillText(r.t, cols[0], y); g.fillText(r.f, cols[1], y);
            g.fillText(r.to.length > 15 ? r.to.slice(0, 15) : r.to, cols[2], y); g.fillText(r.g, cols[3], y);
            const st = fl ? scramble(r.s, fl) : r.s;
            g.fillStyle = /CANCEL/.test(st) ? "#FF5252" : /ON TIME|BOARDING —|SHE'S WAITING/.test(st) ? "#69F0AE" : /DELAYED|CHANGED|WAITING/.test(st) ? "#FFAB40" : "#FFE082";
            g.font = `700 ${st.length > 26 ? 16 : 19}px 'Courier New', monospace`;
            g.fillText(st, cols[4], y, w - cols[4] - 10);
        });
    }, { px: 1024 });
    d.board.mesh.position.set(bf.x, bf.y, bf.z + 0.02);
    rt.add(d.board.mesh);
    // the security wait-time board
    const wf = rt.fx("waitBoard");
    d.waits = ["3 HRS · 2 KUGELS", "YES", "ASK YOUR MOTHER", "4 MIN (IT LIES)", "∞ -ISH", "ONE SHABBOS", "BRING A SNACK"];
    d.waitI = 0; d.waitT = 10;
    d.wait = canvasPlane(rt.set, 3.3, 0.95, (g, w, h) => {
        g.fillStyle = "#0E1621"; g.fillRect(0, 0, w, h);
        drawLines(g, "WAIT TIME:", w / 2, h * 0.3, 40, "#90A4AE");
        drawLines(g, d.waits[d.waitI], w / 2, h * 0.7, 52, "#FFAB40", { maxW: w - 20 });
    }, { px: 512 });
    d.wait.mesh.position.set(wf.x, wf.y, wf.z + 0.03);
    rt.add(d.wait.mesh);
    // the gate board
    const gf = rt.fx("gateBoard");
    d.gateBoard = canvasPlane(rt.set, 1.5, 1.0, (g, w, h) => {
        g.fillStyle = "#0E1621"; g.fillRect(0, 0, w, h);
        const L = D.GATE.boardSign;
        drawLines(g, L[0], w / 2, h * 0.16, 38, "#FFD54F");
        drawLines(g, L[1], w / 2, h * 0.38, 44, "#FFFFFF");
        drawLines(g, L[2], w / 2, h * 0.6, 40, "#69F0AE");
        drawLines(g, L[3], w / 2, h * 0.83, 40, "#FF5252");
    }, { px: 384 });
    d.gateBoard.mesh.position.set(gf.x, gf.y, gf.z + 0.03);
    rt.add(d.gateBoard.mesh);
    // the bag scale's screen
    const sf = rt.fx("scaleScreen");
    d.scaleScreen = canvasPlane(rt.set, 0.55, 0.32, (g, w, h) => {
        const over = d.bagLb > 0;
        g.fillStyle = "#101010"; g.fillRect(0, 0, w, h);
        drawLines(g, `${50 + Math.max(-8, d.bagLb)} LB`, w / 2, h * 0.42, 70, over ? "#FF5252" : "#69F0AE");
        drawLines(g, over ? "OVER!" : "OK!", w / 2, h * 0.82, 34, over ? "#FF8A80" : "#B9F6CA");
    }, { px: 256 });
    d.scaleScreen.mesh.position.set(sf.x, sf.y + 0.5, sf.z + 0.08);
    rt.add(d.scaleScreen.mesh);
}

function makeSigns(rt) {
    const N = D.SIGNS.length, W = 512, RH = 128;
    const c = document.createElement("canvas"); c.width = W; c.height = RH * N;
    const g = c.getContext("2d");
    D.SIGNS.forEach((t, i) => {
        g.fillStyle = "#FFFDF5"; g.fillRect(4, i * RH + 4, W - 8, RH - 8);
        g.strokeStyle = ["#E53935", "#1E88E5", "#43A047", "#FB8C00"][i % 4]; g.lineWidth = 8; g.strokeRect(10, i * RH + 10, W - 20, RH - 20);
        drawLines(g, t, W / 2, i * RH + RH / 2, t.length > 18 ? 40 : 48, "#263238", { maxW: W - 40 });
    });
    const tex = rt.own(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace;
    const geos = [];
    for (let i = 0; i < N; i++) {
        const s = rt.spots["greeter" + i];
        if (!s) continue;
        const pg = new THREE.PlaneGeometry(1.0, 0.25);
        const uv = pg.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setY(k, 1 - (i + 1 - uv.getY(k)) / N);
        pg.translate(s.x, 2.05, s.z + 0.15);
        geos.push(pg);
    }
    if (!geos.length) return;
    // (merge by hand: four quads → one geometry)
    let nv = 0, ni = 0; for (const q of geos) { nv += q.attributes.position.count; ni += q.index.count; }
    const P = new Float32Array(nv * 3), U = new Float32Array(nv * 2), Nn = new Float32Array(nv * 3), I = new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const q of geos) {
        P.set(q.attributes.position.array, ov * 3); U.set(q.attributes.uv.array, ov * 2); Nn.set(q.attributes.normal.array, ov * 3);
        for (let k = 0; k < q.index.count; k++) I[oi + k] = q.index.getX(k) + ov;
        ov += q.attributes.position.count; oi += q.index.count; q.dispose();
    }
    const geo = rt.own(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(P, 3)); geo.setAttribute("uv", new THREE.BufferAttribute(U, 2)); geo.setAttribute("normal", new THREE.BufferAttribute(Nn, 3));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    const m = new THREE.Mesh(geo, rt.own(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide })));
    m.name = "TerminalSigns";
    rt.add(m);
}

// ── hotspots ─────────────────────────────────────────────────────────────
function hotspots(rt) {
    const d = rt.data, A = d.A;
    // check-in: the three desks
    for (const k of Object.keys(D.AIRLINES)) {
        const AL = D.AIRLINES[k];
        rt.hot({ id: "desk_" + k, spot: k + "Talk", r: 1.5, label: `${AL.emoji} ${AL.name} check-in`, action: async rt => {
            const st = S_AGENT(AL.color);
            await say(rt, AL.agent, HELLO[k](), st, A[k]);
            if (rt.disposed) return;
            const i = await rt.choose(AL.agent, AL.motto, AL.ask.map(a => a[0]).concat(["👋 Never mind"]), st);
            if (rt.disposed || i < 0 || i >= AL.ask.length) return;
            await say(rt, AL.agent, AL.ask[i][1], st, A[k]);
            emit("stat", { id: "airportCheckins", n: 1 });
            emit("airport:checkin", { airline: k });
        } });
    }
    // Bubbe Faigy's overweight bag
    rt.hot({ id: "scale", spot: "scaleTalk", r: 1.5, label: "⚖️ Bubbe's overweight bag", action: async rt => {
        d.bagLb = 41; d.scaleScreen.redraw(); bagBounce(d);
        tone(220, 0.25, "square", 0.08, 180);
        await say(rt, D.AIRLINES.kugel.agent, D.BAG.agentOver, S_AGENT(D.AIRLINES.kugel.color), A.kugel);
        if (rt.disposed) return;
        await say(rt, D.BAG.who, pick(D.BAG.bubbe), S_BUBBE, A.bubbe);
        if (rt.disposed) return;
        const i = await rt.choose(D.BAG.who, D.BAG.ask, D.BAG.opts, S_BUBBE);
        if (rt.disposed || i < 0) return;
        if (i === 0) {
            d.bagLb -= 12; d.puffT = 25; d.scaleScreen.redraw(); bagBounce(d);
            await say(rt, "Lulu", D.BAG.sweaters, S_LULU);
            if (!rt.disposed) await say(rt, D.BAG.who, D.BAG.sweatersBubbe, S_BUBBE, A.bubbe);
            A.bubbe.cheerT = 1.6;
        } else if (i === 1) {
            d.bagLb -= 3; d.scaleScreen.redraw(); bagBounce(d);
            rt.luluHold(null);
            await say(rt, "Lulu", D.BAG.kugel, S_LULU);
            if (!rt.disposed) await say(rt, D.BAG.who, D.BAG.kugelBubbe, S_BUBBE, A.bubbe);
        } else {
            const at = rt.spot("scale");
            await rt.walkTo(at.x + 0.05, at.z + 0.55, 2);
            d.bagLb += 120; d.scaleScreen.redraw(); bagBounce(d); sfx.womp();
            rt.luluPose = { sit: true }; d.onBag = 2.5;
            await say(rt, "Lulu", D.BAG.sit, S_LULU);
            if (!rt.disposed) await say(rt, D.AIRLINES.kugel.agent, D.BAG.sitAgent, S_AGENT(D.AIRLINES.kugel.color), A.kugel);
            rt.luluPose = null; d.onBag = 0;
        }
        emit("stat", { id: "airportBagGags", n: 1 });
        emit("airport:bag", { choice: i });
    } });
    // the departures board
    rt.hot({ id: "board", spot: "board", r: 1.7, label: "📋 Read the departures board", action: async rt => {
        flapRow(d, Math.floor(Math.random() * d.rows.length));
        const r = pick(d.rows);
        await rt.say("Departures", `${r.f} to ${r.to} — ${r.s}`, { emoji: "📋", color: "#263238" });
        if (!rt.disposed) await say(rt, "Lulu", boardLine(), S_LULU);
        emit("stat", { id: "airportBoardReads", n: 1 });
    } });
    // the arrivals door
    rt.hot({ id: "arrivals", spot: "arrivalsTalk", r: 1.5, label: "🛬 Watch the arrivals door", action: async rt => {
        const who = arrive(rt);
        await rt.say("Arrivals", arrLine(), { emoji: "🛬", color: "#00695C" });
        if (who && !rt.disposed) emit("airport:arrival", { by: "lulu" });
    } });
    rt.hot({ id: "greeters", x: -4.6, z: -3.0, r: 1.3, label: "🪧 Read the greeters' signs", action: async rt => {
        const k = Math.floor(Math.random() * 4), g = d.crowd.byId["greeter" + k];
        await rt.say("Greeter", greetLine(), { emoji: "🪧", color: "#5D4037" });
        if (g) g.cheerT = 1.2;
    } });
    rt.hot({ id: "vip", spot: "vipTalk", r: 1.4, label: "⭐ The VIP red carpet", action: rt => say(rt, "Lulu", vipLine(), { emoji: "⭐", color: "#C62828" }) });
    // the security line
    rt.hot({ id: "line", spot: "lineTalk", r: 1.6, label: () => d.side === "air" ? "🛂 The security line (you're through!)" : "🛂 The security line", action: securityLine });
    rt.hot({ id: "guard", r: 1.8, label: "🛴 Talk to the Segway guard", enabled: () => !d.law, action: async rt => {
        const g = A.guard; g.path = null; g.faceTo = rt.lulu.obj.position;
        await say(rt, "Officer Segal", guardLine(), S_GUARD, g);
        g.faceTo = null; resumeGuard(rt);
    } });
    rt.hot({ id: "dog", r: 1.5, label: "🐕 Pet Rex the sniffer dog", action: async rt => {
        const D2 = d.dog; D2.sniff = 2.5; D2.faceTo = rt.lulu.obj.position;
        tone(700, 0.06, "triangle", 0.08, 900);
        await rt.say("Rex", rt.used.kugel ? D.DOG_GUARDING : dogLine(), { emoji: "🐕", color: "#795548" });
        D2.faceTo = null;
        emit("stat", { id: "airportDogPets", n: 1 });
    } });
    // the food court
    rt.hot({ id: "deli", spot: "deliTalk", r: 1.5, label: "🥪 Shmuley's Sky-High Deli", action: rt => shop(rt, D.DELI, S_DELI, A.deli) });
    rt.hot({ id: "water", spot: "waterTalk", r: 1.5, label: "💧 H2-OY! water bar", action: rt => shop(rt, D.WATER, S_WATER, A.water) });
    // the gate
    rt.hot({ id: "gateDesk", spot: "gateTalk", r: 1.5, label: "🎫 The gate desk", action: async rt => {
        await say(rt, D.GATE.who, deskLine(), S_GATE, A.gate);
        emit("stat", { id: "airportGateAsks", n: 1 });
    } });
    rt.hot({ id: "window", spot: "window", r: 1.8, label: "🪟 Watch the planes", action: async rt => {
        takeoff(rt, true);
        d.lookT = 4.5;
        await say(rt, "Lulu", windowLine(), S_LULU);
    } });
    for (let r = 0; r < 3; r++) {
        const s = rt.spots[`seat${r}_2`];
        if (!s) continue;
        rt.hot({ id: "seats" + r, x: 23.5, z: s.z + (r === 0 ? -0.85 : -0.95), r: 2.6, label: "💺 Sit down", enabled: () => !d.sit && freeSeat(rt, r) != null, action: rt => sitDown(rt, r) });
    }
    rt.hot({ id: "sleeper", x: 22.0, z: 2.0, r: 1.3, label: "😴 The man asleep across four seats", action: async rt => {
        d.zzzT = 0;
        await rt.say("Sleeping man", sleepLine(), { emoji: "😴", color: "#5D4037" });
    } });
    rt.hot({ id: "family", r: 1.9, label: "👨‍👩‍👧‍👦 The family with ten kids", action: async rt => {
        const ima = A.ima; const sp0 = ima.speed;
        for (const a of d.family) a.speed = 0;
        await say(rt, "A mother of ten", famLine(), { emoji: "👩‍👧‍👦", color: "#00897B" }, ima);
        for (const a of d.family) a.speed = sp0 || 1.05;
        emit("stat", { id: "airportFamily", n: 1 });
    } });
    // the moving hotspots follow their people (findNear reads h.x / h.z)
    d.movingHots = { guard: rt.hots.find(h => h.id === "guard"), dog: rt.hots.find(h => h.id === "dog"), family: rt.hots.find(h => h.id === "family") };
}

function bagBounce(d) { d.bagHop = 0.5; }

/** Buy a snack: a fixed price, +1 heart, at most FOOD_CAP hearts a run; nothing when her hearts are full; never pays. */
async function shop(rt, M, st, agent) {
    await say(rt, M.who, pick(M.hello), st, agent);
    if (rt.disposed) return;
    const opts = M.menu.map(it => it.price ? `${it.label} · 💰${it.price}` : it.label).concat([M.nah]);
    const i = await rt.choose(M.who, "What'll it be?", opts, st);
    if (rt.disposed || i < 0) return;
    if (i >= M.menu.length) { await say(rt, M.who, M.nahLine, st, agent); return; }
    const it = M.menu[i];
    await buy(rt, it, M, st, agent);
}
/** → "bought" | "full" | "capped" | "broke" | "free" (tests read rt.data.lastBuy). */
export async function buy(rt, it, M, st, agent) {
    const d = rt.data, G = ctx.G || { hearts: 3, maxHearts: 3 };
    let res;
    const healed = rt.used.healed || 0;
    if (it.heal && G.hearts >= G.maxHearts) res = "full";
    else if (it.heal && healed >= TUNE.FOOD_CAP) res = "capped";
    else if (it.price && !rt.pay(it.price)) res = "broke";
    else res = it.price ? "bought" : "free";
    d.lastBuy = { id: it.id, res };
    if (res === "full") { await say(rt, M.who, D.FOOD.full, st, agent); return res; }
    if (res === "capped") { await say(rt, M.who, D.FOOD.capped, st, agent); return res; }
    if (res === "broke") { await say(rt, M.who, D.FOOD.broke, st, agent); return res; }
    if (it.prop) { rt.luluHold(null); rt.inHand = rt.hold(rt.lulu, tprop(it.prop), { y: -0.5, z: 0.08 }); rt.inHandName = it.prop; }
    if (it.heal && ctx.G) {
        rt.used.healed = healed + it.heal;
        heal(it.heal);
        rt.burst(new THREE.Vector3(rt.lulu.obj.position.x, 1.6, rt.lulu.obj.position.z), ["#FF4081", "#FF80AB", "#FFFFFF"], 12, 1.8, 0.06);
    }
    tone(660, 0.08, "triangle", 0.1, 990);
    emit("stat", { id: "airportSnacks", n: 1 });
    emit("airport:snack", { id: it.id, price: it.price || 0, heal: it.heal || 0 });
    await say(rt, "Lulu", it.line, S_LULU);
    return res;
}

// ── the security line ────────────────────────────────────────────────────
async function securityLine(rt) {
    const d = rt.data;
    if (d.side === "air") { await say(rt, "Lulu", D.LINE.again, S_LULU); return; }
    const i = await rt.choose("Security", D.LINE.ask, [D.LINE.wait, D.LINE.duck, D.LINE.nah], { emoji: "🛂", color: "#1F3A5F" });
    if (rt.disposed || i < 0 || i === 2) return;
    if (i === 0) return waitLine(rt);
    return duckLine(rt);
}
function caption(rt, text) {
    if (!rt.extraEl) return;
    rt.extraEl.innerHTML = text ? `<div class="int-caption">${text}</div>` : "";
}
/** The long way: the snake, a caption per lane, then the scanner. */
async function waitLine(rt) {
    const d = rt.data, snake = d.col("snake");
    emit("airport:security", { how: "wait" });
    if (snake) snake.on = false;
    d.inLine = true;
    const pts = [[4.6, -1.45], [10.9, -1.45], [10.9, -2.65], [5.5, -2.65], [5.5, -3.85], [11.2, -3.6]];
    for (let k = 0; k < pts.length; k++) {
        if (rt.disposed) return;
        if (k < D.LINE.captions.length + 1 && k > 0) caption(rt, D.LINE.captions[Math.min(k - 1, D.LINE.captions.length - 1)]);
        if (k > 0 && k % 2 === 0) shuffleLine(rt, true);
        await rt.walkTo(pts[k][0], pts[k][1], 4);
    }
    caption(rt, "");
    await scanner(rt, false);
    d.inLine = false;
}
/** The short way: duck under the ropes → the line's outrage → the Segway guard → back of the line, or plead. */
async function duckLine(rt) {
    const d = rt.data, A = d.A, snake = d.col("snake");
    emit("airport:security", { how: "duck" });
    emit("stat", { id: "airportLineCuts", n: 1 });
    if (snake) snake.on = false;
    d.inLine = true;
    d.crouch = true;
    const L = rt.lulu.obj.position;
    // the line notices
    const near = d.line.slice().sort((a, b) => Math.hypot(a.x - L.x, a.z - L.z) - Math.hypot(b.x - L.x, b.z - L.z)).slice(0, 3);
    near.forEach((a, k) => rt.timers.push({ once: true, t: 0.4 + k * 0.5, gate: false, fn: () => { if (!rt.disposed) { rt.bubble(pick(D.LINE.outrage), a.anchor, 1.8, { color: "#B71C1C" }); a.waveT = 1.2; } } }));
    // the guard zooms to the arch
    const g = A.guard; g.path = null;
    const so = rt.spot("scanOut");
    const zoom = d.crowd.walkTo(g, so.x + 0.4, so.z, 4.2);
    await rt.walkTo(9.0, -2.4, 3);
    await rt.walkTo(11.2, -3.6, 2);
    d.crouch = false;
    await zoom;
    g.faceTo = L;
    tone(1200, 0.08, "square", 0.06, 1500); tone(1200, 0.08, "square", 0.06, 1500, 0.15);
    await say(rt, "Officer Segal", D.LINE.guardStop, S_GUARD, g);
    if (rt.disposed) return;
    const i = await rt.choose("Officer Segal", "Well?", [D.LINE.backOfLine, D.LINE.plead], S_GUARD);
    if (rt.disposed) return;
    if (i === 1) {
        await say(rt, "Officer Segal", D.LINE.pleadGuard, S_GUARD, g);
        g.faceTo = null;
        await scanner(rt, true);
    } else {
        await rt.walkTo(10.9, -2.65, 2); await rt.walkTo(5.5, -1.9, 3); await rt.walkTo(4.2, -1.2, 2);
        if (snake) snake.on = true;
        g.faceTo = null;
        H.toast("🧍 Back of the line (it got longer)", "", { key: "terminalLine" });
        await say(rt, "Lulu", D.LINE.backLine, S_LULU);
        emit("airport:security", { how: "back" });
    }
    resumeGuard(rt);
    d.inLine = false;
}
/** The BEEP-O-MATIC 3000: keys → kugel (Rex!) → (chutzpah) → clear. Ends airside. */
async function scanner(rt, chutzpah) {
    const d = rt.data, A = d.A, g = A.guard, s = rt.spot("scanner"), so = rt.spot("scanOut");
    const step = async (lines, who, extra) => {
        beep(rt, 0.9);
        rt.bubble(lines[0], new THREE.Vector3(s.x, 1.2, s.z), 1.1, { color: "#C62828" });
        await say(rt, who || "Officer Segal", lines[1], S_GUARD, g);
        if (extra) await extra();
    };
    d.scan = { step: 0, chutzpah };
    await rt.walkTo(s.x, s.z, 2);
    if (rt.disposed) return;
    // 1: the keys go in a tray down the belt
    await step(D.LINE.beepKeys);
    d.scan.step = 1;
    trayRide(rt, "Keys");
    // 2: the kugel (Ima packed it) — Rex has waited his whole career for this
    if (!rt.used.kugel) {
        await step(D.LINE.beepKugel);
        if (rt.disposed) return;
        await say(rt, "Lulu", D.LINE.luluKugel, S_LULU);
        const D2 = d.dog; D2.hop = 2.2; D2.sniff = 3;
        D2.target = { x: so.x - 0.2, z: so.z + 0.6, speed: 4 };
        tone(880, 0.08, "triangle", 0.1, 1100); tone(990, 0.08, "triangle", 0.1, 1300, 0.12);
        await rt.say("Rex", D.LINE.dogKugel, { emoji: "🐕", color: "#795548" });
        rt.used.kugel = true; d.scan.kugel = true;
        trayRide(rt, "Kugel");
    } else {
        await step(["BEEP BEEP!", "…a bobby pin. ONE bobby pin. The machine is very sensitive today."]);
    }
    d.scan.step = 2;
    if (chutzpah && !rt.disposed) {
        await step(D.LINE.beepChutzpah);
        if (!rt.disposed) await say(rt, "Officer Segal", D.LINE.guardChutzpah, S_GUARD, g);
        d.scan.chutzpah = true;
    }
    if (rt.disposed) return;
    // clear!
    if (d.lampR) d.lampR.visible = false; if (d.lampG) d.lampG.visible = true;
    d.beepT = 0;
    tone(880, 0.12, "sine", 0.12, 1320);
    rt.bubble(D.LINE.clear[0], new THREE.Vector3(s.x, 1.2, s.z), 1.4, { color: "#2E7D32" });
    await rt.walkTo(so.x, so.z, 2);
    d.side = "air";
    const snake = d.col("snake"); if (snake) snake.on = true;
    await say(rt, "Officer Segal", D.LINE.clear[1], S_GUARD, g);
    if (!rt.disposed) await say(rt, "Lulu", D.LINE.luluClear, S_LULU);
    d.dog.target = { x: d.dog.home.x, z: d.dog.home.z, speed: 2.5 };
    d.scan.done = true;
    emit("stat", { id: "airportScans", n: 1 });
    emit("airport:scanned", { kugel: !!d.scan.kugel, chutzpah: !!d.scan.chutzpah });
}
function beep(rt, secs) {
    const d = rt.data;
    d.beepT = secs;
    if (d.lampG) d.lampG.visible = false;
    tone(1560, 0.12, "square", 0.08); tone(1560, 0.12, "square", 0.08, 0, 0.22);
}
/** A tray with `what` in it rides the belt through the X-ray tunnel. */
function trayRide(rt, what) {
    const d = rt.data, tray = tprop("Tray"), it = tprop(what);
    it.position.set(0, 0.06, 0); tray.add(it);
    tray.position.set(8.6, 0.9, -5.2);
    rt.add(tray);
    (d.trays || (d.trays = [])).push({ obj: tray, t: 0, what });
}
function shuffleLine(rt, forward) {
    const d = rt.data;
    d.shuffleK = forward ? 0.35 : 0;
    for (const a of d.line) if (Math.random() < 0.3) rt.bubble(pick(D.LINE.shuffle), a.anchor, 1.6);
}
function resumeGuard(rt) {
    const d = rt.data, g = d.A.guard, g0 = rt.spot("guard");
    if (d.law) return;
    g.target = null; g.faceTo = null;
    d.crowd.walkTo(g, g0.x + 1.1, -1.4, 2.2).then(() => { if (!rt.disposed && !d.law && !g.target) { g.path = path([[g0.x + 1.1, -1.4], [g0.x + 1.1, 3.6]], false); g.u = 0; g.speed = 1.0; } });
}

// ── the arrivals door ────────────────────────────────────────────────────
function arrive(rt) {
    const d = rt.data, C = d.crowd;
    if (d.arrivers && d.arrivers.length > 4) return null;
    d.doorT = 3.2;
    const s = rt.spot("arrivals"), n = 1 + Math.floor(Math.random() * 2), out = [];
    for (let k = 0; k < n; k++) {
        const a = C.add({ look: Math.random() < 0.5 ? "woman" : "man", x: s.x + (k ? 0.5 : -0.3), z: s.z - 0.2, ry: 0, bag: true, seed: Math.random() });
        a.collide = false;
        (d.arrivers || (d.arrivers = [])).push(a);
        out.push(a);
        const greeter = C.byId["greeter" + Math.floor(Math.random() * 4)];
        (async () => {
            await rt.wait(0.4 + k * 0.6);
            await C.walkTo(a, s.x + (k ? 0.4 : -0.4), -3.3, 1.3);
            if (greeter && k === 0) { a.hugT = 1.6; greeter.cheerT = 1.8; greeter.hugT = 1.6; a.faceTo = { x: greeter.x, z: greeter.z }; await rt.wait(1.6); a.faceTo = null; }
            await C.walkTo(a, s.x - 1.5 - k * 0.6, 1.2, 1.3);
            await C.walkTo(a, -26.6, 2.5 + k * 0.5, 1.4);
            C.remove(a);
            d.arrivers = d.arrivers.filter(x => x !== a);
        })().catch(() => { });
    }
    return out;
}

// ── the gate: sitting, the window, planes ────────────────────────────────
function freeSeat(rt, r) {
    const d = rt.data, L = rt.lulu.obj.position;
    let best = null, bd = 1e9;
    for (let i = 0; i < 6; i++) {
        if (d.taken.has(`${r}_${i}`)) continue;
        const s = rt.spots[`seat${r}_${i}`];
        if (!s) continue;
        const dd = Math.abs(s.x - L.x);
        if (dd < bd) { bd = dd; best = i; }
    }
    return best;
}
async function sitDown(rt, r) {
    const d = rt.data, i = freeSeat(rt, r);
    if (i == null) return;
    const s = rt.spots[`seat${r}_${i}`];
    await rt.walkTo(s.x, s.z - 0.75, 2.5);
    if (rt.disposed) return;
    d.sit = { r, i, x: s.x, z: s.z, ry: Math.PI, t: 0 };
    d.taken.add(`${r}_${i}`);
    rt.luluPose = { sit: true };
    emit("stat", { id: "airportSits", n: 1 });
    emit("airport:sit", { row: r, seat: i });
    rt.bubble(sitLine(), rt.lulu.obj, 2.6);
}
function standUp(rt) {
    const d = rt.data, s = d.sit;
    if (!s) return;
    d.taken.delete(`${s.r}_${s.i}`);
    d.sit = null;
    rt.luluPose = null;
    rt.lulu.obj.position.set(s.x, 0, s.z - 0.8);
    rt.vel.set(0, 0, 0);
}
function luluPost(rt, dt) {
    const d = rt.data, o = rt.lulu.obj;
    if (d.sit) {
        if (Math.hypot(input.moveX || 0, input.moveY || 0) > 0.4 && !rt.busy && !ctx.dialogOpen) { standUp(rt); return; }
        d.sit.t += dt;
        o.position.set(d.sit.x, 0, d.sit.z);
        o.rotation.y = d.sit.ry;
        rt.vel.set(0, 0, 0);
    } else if (d.onBag > 0) {
        const s = rt.spot("scale");
        o.position.set(s.x + 0.05, 0.42, s.z + 0.1); o.rotation.y = 0;
    }
    // six of Bubbe's sweaters
    const puff = d.puffT > 0 ? 1.32 : 1;
    o.scale.x += (puff - o.scale.x) * Math.min(1, dt * 6); o.scale.z = o.scale.x;
    const sy = d.crouch ? 0.76 : 1;
    o.scale.y += (sy - o.scale.y) * Math.min(1, dt * 9);
}
function takeoff(rt, now) {
    const d = rt.data;
    if (d.planes.length >= 2) return;
    const keys = Object.keys(D.AIRLINES), k = pick(keys);
    const p = makePlane(rt, D.AIRLINES[k].color);
    d.planes.push({ obj: p, x: -70, v: now ? 22 : 14, airline: k });
    emit("airport:takeoff", { airline: k });
}

// ── per frame ────────────────────────────────────────────────────────────
function tick(rt, dt) {
    const d = rt.data, L = rt.lulu.obj.position, A = d.A, C = d.crowd;
    if (!C) return;
    // the sun's shadow box follows her
    rt.set.sun.position.set(L.x - 8, 16, -6); rt.set.sun.target.position.set(L.x, 0, 0); rt.set.sun.target.updateMatrixWorld();
    if (!d.enterSaid && rt.t > 1.2) { d.enterSaid = true; rt.bubble(enterLine(), rt.lulu.obj, 2.8); }
    // landside / airside, and the one-way exit lane
    if (L.x > 12.5) d.side = "air"; else if (L.x < 11.0) d.side = "land";
    const gate = d.col("exitGate");
    if (gate) {
        gate.on = d.side === "land" && !d.inLine;
        const ew = rt.spot("exitWrong");
        if (gate.on && Math.hypot(L.x - ew.x, L.z - ew.z) < 1.0 && rt.t > d.exitSaid) { d.exitSaid = rt.t + 6; rt.bubble(pick(D.GUARD_EXIT), A.guard.anchor, 2); }
    }
    // the moving hotspots follow their people
    const MH = d.movingHots;
    if (MH.guard) { MH.guard.x = A.guard.x; MH.guard.z = A.guard.z; }
    if (MH.dog) { MH.dog.x = d.dog.x; MH.dog.z = d.dog.z; }
    if (MH.family) { MH.family.x = A.ima.x; MH.family.z = A.ima.z; }
    // the guard's Segway rides under him
    const g = A.guard;
    d.segway.position.set(g.x, 0, g.z); d.segway.rotation.y = g.ry + Math.PI;
    // nobody walks through her (the walkers, the line, the agents)
    if (!rt.auto && !d.sit && !d.onBag) C.push(L, 0.32);
    // the line shuffles forward… then reconsiders
    d.shuffleT -= dt;
    if (d.shuffleT <= 0) { d.shuffleT = rand(4, 7); d.shuffleK = d.shuffleK > 0 ? 0 : 0.35; }
    for (const a of d.line) {
        const want = a.home.x + a.dir * d.shuffleK;
        a.x += (want - a.x) * Math.min(1, dt * 2.5);
        a.walk = Math.abs(want - a.x) > 0.05 ? 0.6 : 0;
    }
    // Bubbe's bag hops on the scale
    if (d.bagHop > 0) { d.bagHop -= dt; d.bag.position.y = 0.16 + Math.abs(Math.sin(d.bagHop * 14)) * 0.12; } else d.bag.position.y = 0.16;
    if (d.puffT > 0) d.puffT -= dt;
    // the arrivals doors
    if (d.doorT > 0) d.doorT -= dt;
    d.doorOpen += ((d.doorT > 0 ? 1 : 0) - d.doorOpen) * Math.min(1, dt * 5);
    if (d.doorL) d.doorL.position.x = d.doorL0 - d.doorOpen * 1.25;
    if (d.doorR) d.doorR.position.x = d.doorR0 + d.doorOpen * 1.25;
    // the scanner's lamp blinks red while it beeps
    if (d.beepT > 0) { d.beepT -= dt; if (d.lampR) d.lampR.visible = Math.floor(d.beepT * 8) % 2 === 0; if (d.beepT <= 0 && d.lampR) d.lampR.visible = false; }
    // trays ride the belt
    if (d.trays) for (let i = d.trays.length - 1; i >= 0; i--) {
        const tr = d.trays[i]; tr.t += dt;
        tr.obj.position.x = Math.min(13.3, 8.6 + tr.t * 1.4);
        if (tr.t > 7) { tr.obj.removeFromParent(); d.trays.splice(i, 1); }
    }
    // the departures board flips a row now and then; the wait-time board changes its mind
    d.boardT -= dt;
    if (d.boardT <= 0) { d.boardT = rand(7, 11); flapRow(d, Math.floor(Math.random() * d.rows.length)); }
    if (d.flap) {
        d.flap.t += dt;
        d.flapT -= dt;
        if (d.flap.t >= 0.6) { d.flap = null; d.board.redraw(); }
        else if (d.flapT <= 0) { d.flapT = 1 / 12; d.flap.k = 1 - d.flap.t / 0.6; d.board.redraw(); }
    }
    d.scrollT -= dt;
    if (d.scrollT <= 0) { d.scrollT = rand(35, 50); d.rows.shift(); d.rows.push(Object.assign({}, D.FLIGHTS[d.nextFlight++ % D.FLIGHTS.length])); d.board.redraw(); }
    d.waitT -= dt;
    if (d.waitT <= 0) { d.waitT = rand(9, 13); d.waitI = (d.waitI + 1) % d.waits.length; d.wait.redraw(); }
    // arrivals every so often; the PA; Zzz
    d.arrT = (d.arrT == null ? 6 : d.arrT) - dt;
    if (d.arrT <= 0) { d.arrT = rand(14, 22); if (ctx.enabled("interiors") || ctx.enabled("airport")) arrive(rt); }
    d.paT -= dt;
    if (d.paT <= 0) {
        d.paT = rand(22, 36);
        if (ctx.enabled("interiors") || ctx.enabled("airport")) rt.bubble(d.law ? D.PA_WANTED : d.sit && Math.random() < 0.5 ? pick(D.GATE.boardingPA) : paLine(), new THREE.Vector3(L.x + 1.5, 1.7, L.z - 2.2), 4, { color: "#1F3A5F" });
    }
    d.zzzT = (d.zzzT || 0) - dt;
    if (d.zzzT <= 0) { d.zzzT = 3.5; rt.bubble("Z z z…", A.sleeper.anchor, 2.2, { color: "#5C6BC0", yOff: 1.5, size: 0.6 }); }
    // planes take off down the runway (and one sometimes sits on the taxiway); looking out of the window
    d.takeoffT -= dt;
    if (d.takeoffT <= 0) { d.takeoffT = rand(14, 22); takeoff(rt, false); }
    for (let i = d.planes.length - 1; i >= 0; i--) {
        const P = d.planes[i];
        P.v = Math.min(70, P.v + dt * 9);
        P.x += P.v * dt;
        const up = Math.max(0, P.x - 15);
        P.obj.position.set(P.x, -0.18 + up * 0.32, -58);
        P.obj.rotation.set(up > 0 ? -Math.min(0.22, up * 0.01) : 0, Math.PI / 2, 0, "YXZ");
        if (P.x > 150) { P.obj.removeFromParent(); d.planes.splice(i, 1); }
    }
    if (d.lookT > 0) { d.lookT -= dt; rt.focusAt = (d.focusW || (d.focusW = new THREE.Vector3(24, 1.5, -12))); } else if (d.sit && d.sit.t > 2) rt.focusAt = (d.focus || (d.focus = new THREE.Vector3(24, 1.2, -9))); else rt.focusAt = null;
    // walked in wanted
    if (d.law) lawTick(rt, dt);
    C.update(dt, rt.set.camera);
}
function flapRow(d, i) {
    const r = d.rows[i];
    if (!r) return;
    let s = pick(D.STATUSES);
    if (s === r.s) s = pick(D.STATUSES);
    r.s = s;
    d.flap = { i, t: 0, k: 1 }; d.flapT = 0;
    tone(300, 0.03, "square", 0.03); tone(320, 0.03, "square", 0.03, 0, 0.06); tone(310, 0.03, "square", 0.03, 0, 0.12);
}

// ── the law (walked in WANTED) ───────────────────────────────────────────
function lawTick(rt, dt) {
    const d = rt.data, Lw = d.law, L = rt.lulu.obj.position, g = d.A.guard, D2 = d.dog, C = d.crowd;
    Lw.t += dt;
    if (Lw.caught) return;
    // Officer Segal + Rex come after her (slowly — it's a Segway)
    g.path = null;
    if (!rt.busy || !Lw.spotted) {
        const dx = g.x - L.x, dz = g.z - L.z, dd = Math.hypot(dx, dz) || 1;
        if (dd > 1.6) g.target = { x: L.x + dx / dd * 1.4, z: L.z + dz / dd * 1.4, speed: 2.4 }; else { g.target = null; g.faceTo = L; }
        const ex = D2.x - L.x, ez = D2.z - L.z, ed = Math.hypot(ex, ez) || 1;
        if (ed > 0.9) D2.target = { x: L.x + ex / ed * 0.7, z: L.z + ez / ed * 0.7, speed: 3.6 }; else { D2.target = null; D2.faceTo = L; D2.sniff = 0.5; }
    }
    if (!Lw.spotted && rt.t > 1.0) {
        Lw.spotted = true;
        rt.bubble(pick(D.LAW.spot), g.anchor, 2.4, { color: "#B71C1C" });
        tone(1200, 0.1, "square", 0.06, 1500); tone(1200, 0.1, "square", 0.06, 1500, 0.18);
        emit("airport:security", { how: "wanted" });
    }
    // Rex has her shoelace: she's slow while he's at her heels
    const slow = Math.hypot(D2.x - L.x, D2.z - L.z) < 1.4 || Math.hypot(g.x - L.x, g.z - L.z) < 2.0;
    def.walkSpeed = slow ? TUNE.SLOW : TUNE.WALK;
    Lw.slowed = slow;
    if (slow && rt.t > Lw.slowSaid) { Lw.slowSaid = rt.t + 9; rt.bubble(pick(D.LAW.dog), D2.anchor, 2, { color: "#795548", yOff: 1.0 }); }
    // the real cops (solo only: in a 🎉 party the law stays on its own screen, and only the guard + Rex play here)
    if (partyOn() || !ctx.law) return;
    if (!Lw.cops && Lw.t > TUNE.COPS_AT) {
        const s = rt.spot("cops");
        Lw.cops = [0, 1].map(k => C.add({ id: "cop" + k, look: "cop", x: s.x + 0.2, z: s.z + (k ? 0.7 : -0.7), ry: Math.PI / 2, named: true, collide: false }));
        H.toast(D.LAW.cops, "red", { key: "terminalCops", prio: 3 });
        emit("airport:cops", {});
    }
    if (Lw.cops) {
        for (const c of Lw.cops) {
            const dx = L.x - c.x, dz = L.z - c.z, dd = Math.hypot(dx, dz);
            c.target = { x: L.x - dx / (dd || 1) * 0.6, z: L.z - dz / (dd || 1) * 0.6, speed: TUNE.COP_SPEED };
            if (dd < 1.05 && !ctx.dialogOpen) { caught(rt, c); return; }
        }
    }
}
function caught(rt, cop) {
    const d = rt.data, Lw = d.law;
    Lw.caught = true;
    rt.busy = true;
    d.sit && standUp(rt);
    rt.bubble(D.LAW.caught, cop.anchor, 2.4, { color: "#1F3A5F" });
    const charges = (ctx.law && ctx.law.warrants && ctx.law.warrants.length ? ctx.law.warrants.slice(0, 2) : []).concat([D.LAW.charge]);
    T.pendingArrest = charges;
    emit("airport:caught", { charges });
    rt.wait(1.4).then(() => { if (!rt.disposed) { rt.busy = false; rt.leave(); } });
}
// the arrest happens out on the kerb, once she's back on her feet outside (foot's exit resumes first)
on("state", e => {
    if (!T.pendingArrest || e.from !== "interior" || e.to === "interior") return;
    const ch = T.pendingArrest;
    T.pendingArrest = null;
    setTimeout(() => {
        try {
            const p = ctx.foot && ctx.foot.active && ctx.foot.pos;
            if (ctx.law) ctx.law.arrest(ch, p ? { onFoot: true, x: p.x, z: p.z, h: ctx.car ? ctx.car.h : 0 } : {});
        } catch (err) { console.error("[airport] arrest", err); }
    }, 0);
});

function dispose(rt) {
    const d = rt.data;
    def.walkSpeed = TUNE.WALK;
    if (d.crowd) d.crowd.dispose();
    if (rt.lulu) rt.lulu.obj.scale.set(1, 1, 1);
    if (d.law && !d.law.caught && d.law.cops) emit("airport:escaped", {});
    emit("airport:terminal", { in: false });
}

// ════ the service ════════════════════════════════════════════════════════
const inRoom = () => { const r = current(); return r && r.def === def ? r : null; };
/** Can she walk in right now? Not mid-chase; with friends only in 🌍 Free Roam (a visit: friends inside see each other). */
function canEnter() {
    if (!ctx.interiors || !ctx.interiors.terminal || inRoom()) return false;
    if ((ctx.law && ctx.law.chasing) || (ctx.foot && ctx.foot.chasing)) return false;
    const party = partyOn(), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (party && !roam) return false;
    return true;
}
/** Walk in from foot (stage 1's doors call this from their ✋ spot): a soft cut when warmed. door: { s, d, side } road coords
 *  of the doors (foot resumes there on the way out); opts.exit overrides the way out. → bool */
function enter(opts = {}) {
    if (!canEnter()) return false;
    if (ctx.foot && ctx.foot.active && ctx.state === "footRun" && ctx.foot.handoff && !opts.exit) {
        const door = opts.door || doorHere();
        return ctx.foot.handoff("terminal", Object.assign({ id: "terminal" }, door));
    }
    return ctx.interiors.terminal.enter({ exit: opts.exit || (() => { }), door: "terminal", from: opts.from || "foot" });
}
function doorHere() {
    const p = (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos) || { x: 0, z: 0 };
    const n = ctx.world && ctx.world.road ? ctx.world.road.nearest(p.x, p.z, ctx.car ? ctx.car.s : 0, {}) : { s: 0, d: 6 };
    return { s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
/** Debug / tests (until stage 1's doors land): from wherever she's standing (on foot; driving → she hops out first). */
async function debugEnter() {
    if (!ctx.interiors || !ctx.interiors.terminal) return false;
    if (ctx.state === "playing" && ctx.foot && ctx.foot.start && !ctx.foot.active) ctx.foot.start("parked", { noIntro: true });
    try { await ctx.interiors.terminal.warm(); } catch (e) { /* the loading path */ }
    for (let i = 0; i < 300 && ctx.state !== "footRun"; i++) await wait(30);
    if (ctx.state !== "footRun") return false;
    for (let i = 0; i < 100 && ctx.foot.phase !== "walk"; i++) await wait(30);
    return enter({});
}

const API = {
    id: "terminal",
    enter, canEnter,
    warm: () => (ctx.interiors.terminal ? ctx.interiors.terminal.warm() : Promise.resolve()),
    ready: () => !!(ctx.interiors.terminal && ctx.interiors.terminal.ready()),
    get inside() { return !!inRoom(); },
    /** The empty VIP red carpet by the arrivals doors (room coords) — stage 3's Dovid Dov comes through here. */
    vip: () => { const r = inRoom(); return r ? r.spot("vip") : null; },
    /** Stage 3: fn(rt, api) runs at the end of every build (add people, hotspots, a scene). */
    addBuilder(fn) { if (typeof fn === "function") BUILDERS.push(fn); },
    tune: TUNE,
    debug: {
        room: () => inRoom(),
        T,
        buy: (shopId, itemId) => { const r = inRoom(); if (!r) return null; const M = shopId === "water" ? D.WATER : D.DELI; const it = M.menu.find(x => x.id === itemId); return it ? buy(r, it, M, {}, null) : null; },
        arrive: () => { const r = inRoom(); return r ? !!arrive(r) : false; },
        takeoff: () => { const r = inRoom(); if (r) takeoff(r, true); return !!r; },
        flap: () => { const r = inRoom(); if (r) flapRow(r.data, 0); return !!r; },
        crowd: () => { const r = inRoom(); return r && r.data.crowd ? Object.assign({ n: r.data.crowd.agents.length }, r.data.crowd.stats) : null; },
    },
};
function attach() {
    const A = ctx.airport || (ctx.airport = {});
    A.terminal = API;
    A.debug = Object.assign(A.debug || {}, { enterTerminal: debugEnter, terminal: () => inRoom() });
}
attach();
on("boot", attach);
export { def as terminalDef, API as terminal };
