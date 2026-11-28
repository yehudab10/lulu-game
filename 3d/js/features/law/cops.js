// features/law — the cops on the road.
//
//  • light bars that really flash (per-car emissive LightRed/LightBlue + glow
//    sprites + a red/blue wash on the asphalt) and a WebAudio siren with Doppler
//  • hidden roadside speed traps (copHide timing from the 2D SPAWN_CONFIG),
//    tucked behind a bush, a tree or a billboard, with a RADAR fuse you can brake out of
//  • patrol cars cruising in traffic (both directions — an oncoming cruiser that
//    clocks you pulls a U-turn) and the K9 unit
//  • the pursuit: real cruisers that chase, PIT-nudge and box Lulu in, crash
//    into traffic, get taken out by a good ram; BUSTED / EVADING meters; heat
//    stars that climb (3★ box-ins + K9 dogs, 4★ cop missiles, 5★ the chopper)
//  • APB call-ins, the open-warrant file, and the fugitive stretch after a jailbreak
import * as THREE from "three";
import { ctx, emit, addActor, setState, MPH, wrapAngle, hooks } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import { models, cloneWithColors, findNodes, registerModels, ensureModels } from "../../models.js";
import { registerKind } from "../../traffic.js";
import { facingRoad, LANES_OURS } from "../../world.js";
import { input, rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import * as X from "./sfx.js";
import * as UI from "./ui.js";
import { SPAWN, SPEEDING_MPH, APB_FAST, COP_PULLOVER, WARN_LINES, BOLO_MSG, LOOK_MSG } from "./data.js";
import { rand, pick, clamp, S, stat, patchLockup, clearLockup, fugitiveStars } from "./rules.js";

registerModels({ lawBillboard: "law_billboard", lawK9: "law_k9", lawMissile: "law_missile", lawChopper: "law_chopper" });
registerKind("lawK9car", { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.6, model: "cop", colors: { CopPaint: "#20242B", CopWhite: "#3A4048" } });

// ── state ────────────────────────────────────────────────────────────────
export const L = {
    chase: null,        // { reason, charges, msg, heat, t, bust, evade, units: [], hazardT… }
    units: [],          // every cop car we drive: { car, mode, slot, rig, … }
    traps: [],          // hidden roadside cops
    fug: null,          // { t, spot, posterT, copT, k9T, mslT, chopper }   (prison clothes)
    spawnT: {},         // copHide timer
    grace: 0,           // post-escape breather (no cop can pounce)
    apbCool: 22,        // spontaneous call-in cooldown
    wantedSpot: 0, wantedPatrolT: 0,
    patrolT: 0,
    hold: 0,            // ctx.law.hold(): suspend random cop events (tutorials, cutscenes)
    pending: null,      // an arrest requested from inside an event, run next frame
    radar: 0,
    threats: new Set(),  // live K9 dogs / missiles {kind, s, d} (the chase lab's driver dodges them)
    // ── heat before a chase (see notice / callIn / changeLook) ──
    sus: 0,             // 0–1 petty heat: a cop clocked her (a WARNING); full → a chase. Drains while she drives clean
    susT: -99,          // when the last warning landed
    bolo: null,         // a witness CALLED IT IN: { charge, charges, msg, t (s until a cruiser's out), phase "called"|"looking", unit, look, seeT, desc }
    lowKey: false,      // she changed her look since the warrants were filed (new car / paint / disguise): patrols don't know her
    lowKeyT: -99,
    lost: null,         // { t, how } — the "LOST 'EM" moment on the HUD after an escape
    hint: 0,            // how many "how to hide" hints this run
    hint2: 0,           // …and "not hidden here" hints
};
export const config = { traps: true, patrols: true, apb: true };

// ── pursuit tuning ───────────────────────────────────────────────────────
// Measured with the chase lab (features/streets/lab.js: a getaway-driver bot +
// a fast headless sim). GTA rules: cruisers are never faster than Lulu's own
// (unboosted) top speed and never out-accelerate her, no rubber-banding, and
// she escapes by breaking LINE OF SIGHT and staying hidden while they search.
export const TUNE = {
    copSpeed: [0, 0.92, 0.92, 0.94, 0.98, 1.0],   // cruiser top speed × Lulu's unboosted top, by stars
    copAccel: 9,                                  // m/s² off the line, fading toward the top (like her engine)
    sight: [0, 75, 90, 105, 120, 135],            // m a cruiser can spot her (× 0.75 at night)
    search: [0, 6.5, 7, 8, 9.5, 11],              // s out of sight before they give up



    searchGap: 40,                                // m — any closer and they still hear her
    offRoad: 11,                                  // |d| where the line of sight cuts through roadside trees / houses
    heatEvery: 40,                                // s of being SEEN before another star (not while hidden)
    pitFrom: 3,                                   // PIT manoeuvres from 3★
    reinforce: 6,                                 // s between reinforcements
    chopperSight: 120,                            // m the chopper sees her by day (at night: only in its spotlight)
    chopperSpeed: 0.86,                           // × Lulu's top: flat out (or nitro) she can outrun it
    // hiding: stopped (≤ 4 m/s) while they SEARCH, tucked away — in a rest-area lot, well off the asphalt and out of
    // view, or in a town at the kerb among parked cars / off the street surface and out of every cruiser's line of
    // sight (see hideInfo). A travel lane is never a hiding place.
    hideSeen: 25,                                 // m — tucked away or not, a cruiser with a CLEAR line of sight this close sees her (× 0.75 at night)
    prowl: 13,                                    // m/s — a searching cruiser in a town, crossing to crossing
    hideClose: 10,                                // m — tucked away, engine off: a cruiser only spots her this close
    hideGlimpse: 0.5,                             // s — one flashing past her hiding spot quicker than this never registers her
    hideGap: 18,                                  // m — the "they can still hear her" gap while hidden (else searchGap)
    hideMul: 2,                                   // × how fast the LOSING THEM meter fills while hidden
    // petty heat (speeding past a trap / a patrol, a dispatch complaint): one WARNING, then a chase
    susWarn: 0.55,                                // what one petty offense adds (two before it drains = a chase)
    susDecay: 0.025,                              // per s of driving clean (not speeding): a warning drains in ~22 s
    recklessMph: 92,                              // over this (or on nitro) past a cop there's no warning
    // the open-warrant file: a patrol who gets a good look at her recognises her
    warrantRange: 32,                             // m, with a clear line of sight
    warrantSee: 1.6,                              // s of looking (twice as fast while she's speeding)
    warrantPatrol: [14, 22],                      // s between the extra patrols a wanted driver draws (≤ 1 extra)
    // a call-in (BOLO): a delay, then one unlit cruiser cruises up the road looking for her car
    boloDelay: [8, 14],                           // s from the call to a cruiser on the road
    boloLook: 35,                                 // s it looks before giving up
    boloSee: 1.2,                                 // s in sight before it lights her up
    boloSpeed: 32,                                // m/s it prowls at (~72 mph): drive clean and fast, or hide
    escapeGrace: 10,                              // s after LOST 'EM before any cop can pounce again
};
const topCache = new WeakMap();
/** Lulu's top speed WITHOUT nitro for the car she's driving (m/s: what drag lets the engine reach). */
export function luluTop() {
    const st = ctx.car && ctx.car.stats;
    if (!st) return 37;
    let v = topCache.get(st);
    if (v) return v;
    const top = 42 * (st.top || 1), acc = 12.5 * (st.acc || 1);
    let lo = 4, hi = top;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (acc * (1 - (m / top) ** 2) - (0.35 + 0.0016 * m * m) > 0) lo = m; else hi = m; }
    topCache.set(st, lo);
    return lo;
}

const tmpP = {}, tmpN = {}, tmpQ = {};
const _v = new THREE.Vector3();

// ── light bars ───────────────────────────────────────────────────────────
let glowTex = null;
function glow() {
    if (glowTex) return glowTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    return glowTex;
}
const washGeo = new THREE.PlaneGeometry(1, 1);
/** Give a cop-car object its own flashable light bar (idempotent; survives traffic pooling). */
export function rig(obj) {
    if (obj.userData.lawRig) return obj.userData.lawRig;
    const red = [], blue = [];
    obj.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const n = o.material.name;
        if (n === "LightRed" || n === "LightBlue") { o.material = o.material.clone(); (n === "LightRed" ? red : blue).push(o.material); }
    });
    const spr = (color, x) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
        s.position.set(x, 1.68, -0.28);
        s.scale.setScalar(2.4);
        s.visible = false;
        obj.add(s);
        return s;
    };
    const wash = new THREE.Mesh(washGeo, new THREE.MeshBasicMaterial({ map: glow(), color: "#ff2244", blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.55 }));
    wash.rotation.x = -Math.PI / 2;
    wash.position.y = 0.07;
    wash.scale.setScalar(11);
    wash.visible = false;
    obj.add(wash);
    const r = { red, blue, sr: spr("#ff2a4a", -0.32), sb: spr("#3a7bff", 0.32), wash, on: null };
    obj.userData.lawRig = r;
    setRig(r, false, 0);
    return r;
}
export function setRig(r, on, t) {
    if (!r) return;
    if (!on) {
        if (r.on === false) return;
        r.on = false;
        for (const m of r.red) m.emissiveIntensity = 0.35;
        for (const m of r.blue) m.emissiveIntensity = 0.35;
        r.sr.visible = r.sb.visible = r.wash.visible = false;
        return;
    }
    r.on = true;
    const ph = (t * 1.9) % 1;
    const strobe = x => ((x * 6) % 1) < 0.55;
    const redOn = ph < 0.5 && strobe(ph), blueOn = ph >= 0.5 && strobe(ph - 0.5);
    for (const m of r.red) m.emissiveIntensity = redOn ? 9 : 0.5;
    for (const m of r.blue) m.emissiveIntensity = blueOn ? 9 : 0.5;
    r.sr.visible = redOn; r.sb.visible = blueOn;
    r.wash.visible = redOn || blueOn;
    r.wash.material.color.set(redOn ? "#ff2244" : "#2a62ff");
}

// ── helpers ──────────────────────────────────────────────────────────────
export function speeding() {
    const G = ctx.G;
    return !ctx.foot?.active && input.brake < 0.3 && (ctx.car.speed * MPH > SPEEDING_MPH || G.boosting);
}
/** The tutorial (meta) keeps ambient cop heat off, like the 2D tutorialCalm(). */
function calm() { try { return !!(ctx.meta && ctx.meta.calm && ctx.meta.calm()); } catch (e) { return false; } }
function canPounce() {
    return L.grace <= 0 && L.hold <= 0 && !L.chase && ctx.state === "playing" && !(ctx.G.tutorial) && !calm();
}
export function activeUnits() { return L.units.filter(u => u.car && !u.car.hit && u.mode === "chase"); }
function nearestUnit(list = L.units, onlyChase = false) {
    let best = null, bd = 1e9;
    const p = ctx.car.pos;
    for (const u of list) {
        if (!u.car || (onlyChase && (u.mode !== "chase" || u.car.hit))) continue;
        const d = Math.hypot(u.car.x - p.x, u.car.z - p.z);
        if (d < bd) { bd = d; best = u; }
    }
    return best ? { u: best, d: bd } : null;
}
/** Any cop (parked trap, patrol, cruiser) within r metres of (x, z). */
export function copNear(x, z, r = 40) {
    for (const u of L.units) if (u.car && Math.hypot(u.car.x - x, u.car.z - z) < r) return u;
    for (const t of L.traps) if (!t.gone && Math.hypot(t.x - x, t.z - z) < r) return t;
    return null;
}
/**
 * A cop who can actually SEE (x, z): within r with a clear line of sight (close up — 15 m — always).
 * A searching (BOLO) cruiser or a downed one doesn't count. Returns the unit / trap, or null.
 */
export function copSees(x, z, r = 45) {
    let best = null, bd = r;
    for (const u of L.units) {
        const c = u.car;
        if (!c || c.hit || u.bolo) continue;
        const d = Math.hypot(c.x - x, c.z - z);
        if (d < bd && (d < 15 || clearLine(c.x, c.z, c.s, c, x, z))) { best = u; bd = d; }
    }
    for (const t of L.traps) {
        if (t.gone) continue;
        const d = Math.hypot(t.x - x, t.z - z);
        if (d < bd && (d < 15 || clearLine(t.x, t.z, t.s, null, x, z))) { best = t; bd = d; }
    }
    return best;
}
/** Is she tucked away right now (stopped, out of the traffic, out of sight)? "lot" | "town" | "verge" | "". */
export function hiding() { return hideInfo().kind; }
/** A chasing cruiser with a clear line of sight to her within `r` m (× 0.75 at night), or null. */
function exposedTo(r) {
    const p = ctx.car.pos;
    r *= 1 - 0.25 * nightness();
    for (const u of L.units) {
        const c = u.car;
        if (!c || c.hit || u.mode !== "chase") continue;
        if (Math.hypot(c.x - p.x, c.z - p.z) < r && clearLine(c.x, c.z, c.s, c)) return u;
    }
    return null;
}
const HIDE_NO = { kind: "", why: "" };
let hideCache = { t: -1, v: HIDE_NO };
/**
 * Where she is, hiding-wise: { kind: "lot" | "town" | "verge" | "", spot, why }. kind "" (not hidden) carries why:
 *   "moving" (> 4 m/s) · "road" (on the highway's asphalt) · "lane" (a town street's travel lane / a crossing) ·
 *   "empty" (a town kerb with no parked cars around her) · "seen" (a cruiser has a clear view of her, ≤ hideSeen m).
 *   lot    a rest area's lot (a real lot: always counts)
 *   verge  > 9.2 m off the highway's centre line, with no cruiser looking straight at her from up close
 *   town   ctx.town.hideSpot: at the kerb among parked cars / off the street surface — and out of their sight
 */
export function hideInfo() {
    const car = ctx.car;
    if (!car || ctx.state !== "playing") return HIDE_NO;
    if (hideCache.t === ctx.time && hideCache.x === car.pos.x && hideCache.z === car.pos.z) return hideCache.v;
    let v;
    if (car.speed > 4) v = { kind: "", why: "moving" };
    else if (ctx.exits && ctx.exits.inside) v = { kind: "lot", spot: "lot" };
    else if (ctx.town && ctx.town.active) {
        const sp = ctx.town.hideSpot ? ctx.town.hideSpot(car.pos.x, car.pos.z) : null;
        if (!sp || !sp.ok) v = { kind: "", why: sp ? sp.why : "lane", spot: sp ? sp.spot : "" };
        else v = exposedTo(TUNE.hideSeen) ? { kind: "", why: "seen", spot: sp.spot } : { kind: "town", spot: sp.spot };
    }
    else if (Math.abs(car.d) <= 9.2) v = { kind: "", why: "road" };
    else v = exposedTo(TUNE.hideSeen) ? { kind: "", why: "seen", spot: "verge" } : { kind: "verge", spot: "verge" };
    hideCache = { t: ctx.time, x: car.pos.x, z: car.pos.z, v };
    return v;
}
/** The HUD's "not hidden" line: why stopping HERE doesn't count (or "" when it does / she's moving). */
const NOT_HIDDEN = {
    lane: "🚫 not hidden — park at the kerb or get out of sight",
    empty: "🚫 not hidden — an empty kerb: park between parked cars",
    road: "🚫 not hidden — pull well off the road, out of sight",
    seen: "🚫 not hidden — they can see you from there · get out of sight",
};
export function notHiddenHint() { const h = hideInfo(); return h.kind ? "" : NOT_HIDDEN[h.why] || ""; }
/** What the cops would describe her by: the car she's in (her own / a borrowed shell) + its paint. */
export function rideDesc() {
    const sh = ctx.foot && ctx.foot.shellObj;
    const pc = ctx.streets && ctx.streets.paint && ctx.streets.paint.color;
    return (sh ? sh.uuid : "own") + "|" + (pc ? pc.name : "");
}

// ── cop cars (traffic cars with our AI) ──────────────────────────────────
function addUnit(s, d, dir, speed, opts = {}) {
    const tr = ctx.traffic;
    const kind = opts.k9 ? "lawK9car" : "cop";
    const u = { mode: opts.mode || "patrol", slot: "rear", k9: !!opts.k9, spot: 0, pitT: rand(3, 6), t: 0, vmax: 38, siren: false, downT: 0 };
    const car = tr.add(kind, s, d, dir, speed, {
        keep: opts.mode === "chase", noNearMiss: opts.mode === "chase",
        data: { law: u },
        onRemove: () => { u.car = null; const i = L.units.indexOf(u); if (i >= 0) L.units.splice(i, 1); },
    });
    u.car = car;
    u.rig = rig(car.obj);
    setRig(u.rig, false, 0);
    car.onCrash = e => onCopCrash(u, e);
    L.units.push(u);
    if (opts.mode === "chase") toChase(u, opts.slot || "rear");
    return u;
}
/** Turn any of our cop cars into a pursuer (keeps where it is; oncoming ones U-turn). */
function toChase(u, slot = "rear") {
    const c = u.car;
    u.mode = "chase"; u.slot = slot; u.siren = true;
    c.keep = true; c.noNearMiss = true;
    if (!c.ai) { c.free = true; c.ai = (dt, car) => driveUnit(dt, car, u); }
}
function onCopCrash(u, e) {
    // gentle shoves from a cruiser never cost a heart; a real collision does
    if (u.mode === "chase" && u.car && u.car.hit && !u.downed) {
        u.downed = true;
        UI.say("💥 COP DOWN!", "gold");
        addScore(250, "copDown");
        // (the charge only when SHE drove into it — a cruiser that rammed her and spun out is on them: traffic.js e.fault)
        if (L.chase && e.fault !== "them" && !L.chase.charges.includes("DESTROYING A POLICE CRUISER")) L.chase.charges.push("DESTROYING A POLICE CRUISER");
    }
    return e.impact > 8 ? undefined : false;
}

/** A searching cruiser in a town: drive to where she was heading when they lost her (ctx.town.searchPoint), then
 *  check the crossings around it one by one (prowlPoint). They don't know where she is. → a copRoute, or null. */
function prowlRoute(c, u, ch) {
    if (!u.prowl || u.prowl.key !== ch.last.t) {
        const to = ctx.town.searchPoint(ch.last);
        if (!to) return ctx.town.copRoute(c, u);
        u.prowl = { key: ch.last.t, to, at: { x: to.x, z: to.z }, n: 0 };
    }
    let r = ctx.town.copRoute(c, u, u.prowl.to);
    if (r && r.gap < 12) {
        const nx = ctx.town.prowlPoint(u.prowl.at, c);
        if (nx) { u.prowl.to = nx; u.prowl.n++; r = ctx.town.copRoute(c, u, nx); }
    }
    return r;
}

/** A place off the highway with roads of its own (features/airport) routes a chase / a pull-over through them:
 *  hook "copRoute" (c, u, chase) → { gap, aim(la, out) } or null; and its own buildings block the view: hook
 *  "copSight" (ax, az, bx, bz) → true (clear) · false (blocked) · undefined (not its business). */
function placeRoute(c, u, ch) {
    for (const fn of hooks.copRoute || []) { try { const r = fn(c, u, ch); if (r) return r; } catch (e) { console.error("[law] copRoute", e); } }
    return null;
}
/** Her car itself (features/carcare): hook "copLook" () → × how fast a cop's look lands (a dirty car 1.1, a QUIET muffler at
 *  night 0.85) · hook "copHear" () → × how far they still hear her (a LOUD muffler 1.2). Numbers only; 1 when nobody says. */
export function copMul(name) {
    let m = 1;
    for (const fn of hooks[name] || []) { try { const r = fn(); if (typeof r === "number" && r > 0) m *= r; } catch (e) { console.error("[law] " + name, e); } }
    return m;
}
function placeSight(ax, az, bx, bz) {
    for (const fn of hooks.copSight || []) { try { const r = fn(ax, az, bx, bz); if (r === true || r === false) return r; } catch (e) { console.error("[law] copSight", e); } }
    return undefined;
}

/** Free-mode driver for our cruisers: pursue / box in / pull over / haul away / give up. */
function driveUnit(dt, c, u) {
    const px = c.x, pz = c.z, ph = c.h, ps = c.s;
    steerUnit(dt, c, u);
    // never let a bad frame poison the cruiser (or anything that reads it) with NaN
    if (!Number.isFinite(c.x) || !Number.isFinite(c.z) || !Number.isFinite(c.h) || !Number.isFinite(c.speed)) {
        c.x = px; c.z = pz; c.h = Number.isFinite(ph) ? ph : 0; c.s = Number.isFinite(ps) ? ps : ctx.car.s; c.speed = 0;
    }
}
function steerUnit(dt, c, u) {
    const road = ctx.world.road, car = ctx.car;
    u.t += dt;
    road.nearest(c.x, c.z, c.s, tmpN);
    c.s = tmpN.s; c.d = tmpN.d;
    let lv = Math.max(0, car.vF), ls = car.s, ld = car.d;
    let tD = c.d, vT = 0;
    const D = travelDir();        // (+1 up the lap; −1 she's driving down it: "behind her" is +s)
    const ch = L.chase, heat = ch ? ch.heat : 1;
    // in a town the chase goes round corners: its street graph gives the route and the real gap — and once they've
    // lost her, the route goes where they THINK she is (on to where she was heading, then crossing to crossing)
    const inTown = u.mode === "chase" && ctx.town && ctx.town.active && ctx.town.copRoute;
    // a CALL-IN's cruiser in town doesn't know where she is either: it prowls round where the call came from (or where it
    // first came into town after her) — it used to drive the street grid straight to her car (AGENTS §7 known issue)
    const B = u.bolo && L.bolo && !ch && inTown && ctx.town.searchPoint ? L.bolo : null;
    if (B && !B.last) B.last = { s: car.s, d: car.d, h: car.h, v: 0, t: ctx.time };
    const prowling = inTown && ((ch && ch.searching && ch.last && !u.bolo) || !!B) && !!ctx.town.searchPoint;
    if (!prowling) u.prowl = null;
    const route = !inTown ? ((u.mode === "chase" || u.mode === "pull") && !(ctx.town && ctx.town.active) ? placeRoute(c, u, ch) : null)
        : prowling ? prowlRoute(c, u, B || ch) : ctx.town.copRoute(c, u);
    // SEARCHING: they don't know where she is — they drive on to where she was heading when they lost her
    // (pull off and stop out of sight, and they fly right past)
    if (u.mode === "chase" && ch && ch.searching && ch.last && !route) {
        lv = ch.last.v; ls = ch.last.s + D * ch.last.v * Math.min(ctx.time - ch.last.t, 20); ld = clamp(ch.last.d, -5.25, 5.25);
    }
    if (u.bolo) {                               // a call-in: one unlit cruiser prowls up the road looking for her car
        tD = D * (c.d * D > 3.5 ? 5.25 : 1.75); vT = TUNE.boloSpeed;      // (her side's lanes: the far ones down the lap) u.vmax = route ? 14 : TUNE.boloSpeed;
        if (route) { const err = route.gap - 6; vT = B ? clamp(4 + route.gap * 0.5, 4, TUNE.prowl) : clamp(lv + err * 0.9, 0, 14); }
    } else if (u.mode === "chase") {
        u.pitT -= dt;
        let want = -7;             // where it wants to sit, relative to Lulu along the road
        let side = 0;
        if (u.slot === "rear2") { want = -15; side = ld > 3.5 ? -3.5 : 3.5; }
        else if (u.slot === "front") want = 11;
        else if (u.slot === "side") { want = -0.5; side = ld > 3.5 ? -3.3 : 3.3; }
        if (u.slot === "rear" && heat >= TUNE.pitFrom && u.pitT < 0) { want = -2.4; if (u.pitT < -1.6) u.pitT = rand(6, 9) - heat * 0.4; }
        const err = route ? route.gap + want : (ls + D * want - c.s) * D;
        vT = lv + clamp(err * 0.9, -12, 18);
        const behind = (c.s - ls) * D < -2;
        if (u.slot === "front" && behind) tD = ld + (ld > 3.5 ? -3.5 : 3.5);   // overtake in the other lane…
        else if (u.slot === "front") { tD = ld; vT = Math.min(vT, lv - 2.5); } // …then merge in front and brake-check
        else tD = ld + side;
        if (u.slot === "side" && Math.abs(err) < 3) tD = ld + Math.sign(side) * 2.5;   // lean on her
        if (prowling && route) vT = clamp(4 + route.gap * 0.5, 4, TUNE.prowl);     // looking, not chasing: a steady prowl (any slot)
        if (Math.hypot(c.x - car.pos.x, c.z - car.pos.z) > 70) tD = clamp(ld, -5.25, 5.25);
        u.vmax = Math.max(22, luluTop() * TUNE.copSpeed[clamp(Math.round(heat), 1, 5)]);   // never faster than her, no catch-up bonus
    } else if (u.mode === "pull") {             // pull up behind her on the shoulder
        tD = Number.isFinite(u.pullD) ? u.pullD : pullDAt(c.s);
        const err = route ? route.gap : ((Number.isFinite(u.stopS) ? u.stopS : c.s) - c.s) * D;
        vT = clamp(err * 1.1, 0, 22);
        if (err < 0.4) vT = 0;
        u.vmax = 30;
    } else if (u.mode === "haul") {             // drive Lulu downtown
        tD = D * 1.75; vT = 30; u.vmax = 32;
    } else if (u.mode === "giveup") {
        // (off the highway's asphalt — a ramp, a cross road, JFK's roads — it stops where it is: it used to cut back across
        //  the grass to the highway's shoulder)
        tD = (ctx.town && ctx.town.active) || Math.abs(c.d) > 9.5 ? c.d : D > 0 ? clamp(c.d, 7.6, 7.9) : clamp(c.d, -7.9, -7.6); vT = 0; u.vmax = 20;
    } else if (u.mode === "park") { vT = 0; u.vmax = 0; }

    // traffic in the way: pass (cops will use any lane) or slow down; bang into it if we can't
    if (u.mode === "chase" || u.mode === "haul") {
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        for (const o of ctx.traffic.cars) {
            if (o === c || o.hit || (o.data && o.data.law)) continue;
            const dx = o.x - c.x, dz = o.z - c.z;
            const lon = dx * fx + dz * fz, lat = -dx * fz + dz * fx;
            // a car Lulu just rattled with a near miss: the cruiser only reacts at the last moment
            const look = o.data && o.data.spookT > ctx.time ? 2 + c.speed * 0.12 : 7 + c.speed * 0.6;
            if (lon > -1 && lon < look && Math.abs(lat) < 2.3) {

                const alt = [o.d - 3.5, o.d + 3.5].filter(x => Math.abs(x) <= 5.4).sort((a, b) => Math.abs(a - tD) - Math.abs(b - tD));
                if (alt.length) tD = alt[0];
                if (lon < 9 && o.dir * D > 0) vT = Math.min(vT, o.speed + 1);
            }
            if (Math.hypot(dx, dz) < 2.1 && o.immune) {      // a 🎉 party's shared car never spins on one screen only: the cruiser bounces off it
                c.hit = true; c.hitT = 0; c.vx = -fx * c.speed * 0.25; c.vz = -fz * c.speed * 0.25; c.spinV = (Math.random() < 0.5 ? -1 : 1) * 3;
                return;
            }
            if (Math.hypot(dx, dz) < 2.1) {            // a real crash with traffic
                o.hit = true; o.hitT = 0; o.vx = fx * c.speed * 0.6; o.vz = fz * c.speed * 0.6; o.spinV = (Math.random() < 0.5 ? -1 : 1) * 3;
                c.hit = true; c.hitT = 0; c.vx = fx * c.speed * 0.4; c.vz = fz * c.speed * 0.4; c.spinV = (Math.random() < 0.5 ? -1 : 1) * 4;
                if (u.mode === "chase" && Math.hypot(c.x - car.pos.x, c.z - car.pos.z) < 120) { UI.say("💥 Cop pile-up!", "gold"); addScore(200, "copPileup"); }
                return;
            }
        }
    }
    vT = Math.min(vT, u.vmax);
    // steer: pure pursuit toward a look-ahead point in the target lane
    const la = Math.max(7, c.speed * 0.55);
    if (route) route.aim(la, tmpP);
    else road.point(c.s + D * la, tD, tmpP);
    const want = Math.atan2(tmpP.x - c.x, tmpP.z - c.z);
    const dh = wrapAngle(want - c.h);
    if (Math.abs(dh) > 0.7) vT = Math.min(vT, 9);
    const v = Math.max(c.speed, 0.01);
    const maxYaw = Math.min(14 / v, v / 6, 2.0) * dt;
    c.h += clamp(dh, -maxYaw, maxYaw);
    // a cruiser's engine pulls like hers: strong off the line, fading toward its top speed
    const acc = u.mode === "chase" ? Math.max(1.2, TUNE.copAccel * (1 - (c.speed / (u.vmax * 1.12)) ** 2)) : 10;
    c.speed += clamp(vT - c.speed, -16 * dt, acc * dt);

    c.speed = Math.max(0, c.speed);
    c.x += Math.sin(c.h) * c.speed * dt;
    c.z += Math.cos(c.h) * c.speed * dt;
}

// ── hidden speed traps ───────────────────────────────────────────────────
function tickSpawn(dt) {
    const c = SPAWN.copHide;
    if (L.spawnT.copHide === undefined) L.spawnT.copHide = rand(c.first[0], c.first[1]);
    L.spawnT.copHide -= dt;
    if (L.spawnT.copHide > 0) return false;
    L.spawnT.copHide = rand(c.every[0], c.every[1]);
    return Math.random() < c.chance;
}
export function spawnTrap(sAhead = 240, side = Math.random() < 0.5 ? -1 : 1) {
    const road = ctx.world.road, car = ctx.car;
    const s = car.s + (downLap() ? -sAhead : sAhead), dCop = side * rand(11.5, 13);
    const hides = ["bush", "tree"];
    if (models.lawBillboard) hides.push("billboard");
    const hide = pick(hides);
    const g = new THREE.Group();
    road.point(s, dCop, tmpP);
    const h = road.at(s).h;
    const fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    const cop = cloneWithColors(models.cop);
    cop.position.set(tmpP.x, 0, tmpP.z);
    // nose angled toward the road and a little forward — ready to pounce
    const fw = downLap() ? -0.6 : 0.6;      // (a little forward: her way — down the lap too)
    cop.rotation.y = Math.atan2(-rx * side * 0.8 + fx * fw, -rz * side * 0.8 + fz * fw);
    const r = rig(cop);
    g.add(cop);
    // the cover, between the cruiser and the approaching traffic
    let prop = null;
    const pd = dCop - side * 3.4;
    road.point(s - 3, pd, tmpQ);
    if (hide === "billboard") {
        prop = cloneWithColors(models.lawBillboard);
        prop.rotation.y = facingRoad(h, side);
        prop.position.set(tmpQ.x, 0, tmpQ.z);
        const face = findNodes(prop, "Face")[0];
        if (face) face.traverse(o => { if (o.isMesh) o.material = billboardAd(); });
    } else if (hide === "tree") {
        prop = cloneWithColors(models.treeRound);
        prop.scale.setScalar(1.25);
        prop.position.set(tmpQ.x, 0, tmpQ.z);
    } else {
        prop = new THREE.Group();
        for (let i = 0; i < 3; i++) {
            const b = cloneWithColors(models.bush);
            b.scale.setScalar(1.5 + i * 0.2);
            road.point(s - 4.5 + i * 2.6, pd + (i - 1) * 0.4 * side, tmpQ);
            b.position.set(tmpQ.x, 0, tmpQ.z);
            prop.add(b);
        }
    }
    if (prop) g.add(prop);
    ctx.scene.add(g);
    const trap = { obj: g, cop, rig: r, s, d: dCop, side, hide, x: tmpP.x, z: tmpP.z, h: cop.rotation.y, spot: 0, gone: false, near: false };
    L.traps.push(trap);
    addActor({
        update() { return (ctx.car.s - trap.s) * travelDir() < 140; },      // (along her way: down the lap too)
        collide(pcar) {
            if (trap.gone) return null;
            const imp = pcar.collideStatic(trap.x, trap.z, 1.5);
            return imp ? { impact: imp, why: "You hit a parked COP CAR?!", source: "cop" } : null;
        },
        dispose() { ctx.scene.remove(g); trap.gone = true; trap.dead = true; const i = L.traps.indexOf(trap); if (i >= 0) L.traps.splice(i, 1); },
    });
    return trap;
}
const ADS = [["BUBBE'S CHOLENT", "Hot every Friday · since 1962"], ["HESHY'S POOLS", "Cannonball approved 🏊"], ["DRIVE SAFE", "Bubbe is watching"],
    ["RUGELACH WORLD", "Exit 12 · open late"], ["AVIGAIL'S NAILS", "Fabulous, guaranteed 💅"]];
const adMats = [];
function billboardAd() {
    if (adMats.length < ADS.length) {
        const [a, b] = ADS[adMats.length];
        adMats.push(new THREE.MeshStandardMaterial({ map: posterTexture([a, b], ["#E91E63", "#1E88E5", "#43A047", "#FB8C00", "#8E24AA"][adMats.length], "#fff"), roughness: 0.7 }));
    }
    return pick(adMats);
}
function posterTexture(lines, bg, fg, mug = false) {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 512;
    const g = c.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 14; g.strokeRect(20, 20, 984, 472);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    const x = mug ? 640 : 512;
    g.font = `700 ${mug ? 120 : 110}px Fredoka, Arial, sans-serif`;
    g.fillText(lines[0], x, mug ? 140 : 200, mug ? 680 : 940);
    g.font = "600 60px Fredoka, Arial, sans-serif";
    lines.slice(1).forEach((l, i) => g.fillText(l, x, (mug ? 270 : 340) + i * 80, mug ? 680 : 940));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

function updateTraps(dt, controlsOn) {
    const car = ctx.car;
    L.radar = 0;
    for (const t of L.traps) {
        if (t.gone) continue;
        if (t.flashT > 0) t.flashT -= dt;
        setRig(t.rig, t.flashT > 0, ctx.time);           // (a warning: a burst of the lights, no chase)
        const rel = (car.s - t.s) * travelDir();
        const inView = rel > -70 && rel < 12;
        if (inView) t.near = true;
        if (controlsOn && canPounce() && inView && speeding() && !(t.noticeUntil > ctx.time)) {
            t.spot += dt * copMul("copLook");
            L.radar = Math.max(L.radar, t.spot / 0.65);
            if (t.spot >= 0.65) {
                t.spot = 0;
                // a first offense is a WARNING (lights + radar chirp); already warned — or reckless — they pull out
                const r = notice("SPEEDING", { msg: "🚨 SPEED TRAP!", warn: pick(WARN_LINES.trap), trap: t, src: t, amount: reckless() ? 1 : TUNE.susWarn });
                if (r === "chase") return;
                if (r === "warn") { t.flashT = 1.6; t.warned = true; }
            }
        } else {
            t.spot = Math.max(0, t.spot - dt * 1.5);
            L.radar = Math.max(L.radar, t.spot / 0.65);
        }
        if (t.near && !t.passed && rel > 12) {
            t.passed = true;
            if (controlsOn && !L.chase && !t.warned) { addScore(150, "legal"); H.toast("👮 Nice and legal! +150", "gold"); }
        }
    }
}
/** The parked cruiser pulls out and becomes the pursuer. */
function trapToChase(t) { beginChase("SPEEDING", { msg: "🚨 SPEED TRAP!", unit: trapUnit(t) }); }
/** The hidden cruiser pulls out of its hiding spot as a chase unit (it's the one that saw her). */
function trapUnit(t) {
    t.gone = true;
    t.obj.remove(t.cop);
    const u = addUnit(t.s, t.d, travelDir(), 0, { mode: "chase" });
    const c = u.car;
    c.free = true; c.x = t.x; c.z = t.z; c.h = t.h;
    c.obj.position.set(c.x, 0, c.z); c.obj.rotation.y = c.h;
    return u;
}
/** Too fast to be a mistake: on nitro, or way over the limit. */
function reckless() { return !!(ctx.G && ctx.G.boosting) || ctx.car.speed * MPH > TUNE.recklessMph; }

/** Is she heading down the lap on the open highway (the far carriageway — ci/twoway)? */
const downLap = () => !!(ctx.world && ctx.world.dir === -1 && !ctx.world.district);
/** +1 up the lap, −1 down it: which way "ahead of her" runs along the road (the chase + the pull-over mirror with it). */
export const travelDir = () => (downLap() ? -1 : 1);
// ── patrols ──────────────────────────────────────────────────────────────
export function spawnPatrol(opts = {}) {
    const car = ctx.car;
    const r = Math.random();
    let u;
    // (heading DOWN the lap — ci/twoway: the same three patrols, mirrored — "oncoming" is the one coming toward HER)
    const D = downLap() ? -1 : 1, mine = D > 0 ? LANES_OURS : [-1.75, -5.25], theirs = D > 0 ? [-1.75, -5.25] : LANES_OURS;
    if (opts.oncoming ?? r < 0.45) u = addUnit(car.s + D * rand(380, 460), pick(theirs), -D, rand(18, 22), opts);
    else if (opts.fast ?? r < 0.7) u = addUnit(car.s - D * rand(60, 80), pick(mine), D, rand(29, 33), opts);
    else u = addUnit(car.s + D * rand(300, 360), pick(mine), D, rand(13, 15), opts);
    if (opts.aggro) { toChase(u, "rear"); u.hunter = true; u.siren = false; }
    return u;
}
function updatePatrols(dt, controlsOn) {
    const car = ctx.car, fug = L.fug;
    for (const u of L.units.slice()) {
        if (!u.car) continue;
        const c = u.car;
        const lit = u.siren && (u.mode === "chase" || u.mode === "pull" || u.mode === "haul" || u.mode === "park");
        if (u.blipT > 0) u.blipT -= dt;
        setRig(u.rig, lit || u.mode === "park" || u.blipT > 0, ctx.time + (u.phase || (u.phase = Math.random())));
        if (c.hit && c.hitT > 2.8 && u.mode === "chase") {       // shake it off and get back in the chase
            c.hit = false; c.speed = 0; c.free = true; c.h = c.obj.rotation.y; u.downed = false;
            if (!c.ai) c.ai = (d, cc) => driveUnit(d, cc, u);
        }
        if (u.mode === "giveup" && (u.t > 22 || car.s - c.s > 170)) { c.keep = false; }
        if (u.flavour) updateFlavourUnit(dt, u);
        if ((u.mode !== "patrol" && !u.hunter) || u.bolo) continue;
        if (!controlsOn || !canPounce()) { u.spot = Math.max(0, u.spot - dt); continue; }
        const dist = Math.hypot(c.x - car.pos.x, c.z - car.pos.z);
        const sees = dist < (u.hunter ? 45 : 34) && (dist < 15 || clearLine(c.x, c.z, c.s, c));
        if (fug) continue;                  // the fugitive "recognised" meter handles these
        if (sees && speeding() && !(u.noticeUntil > ctx.time)) {
            u.spot += dt * copMul("copLook");
            if (u.spot > 0.7) {
                u.spot = 0;
                // first time: the patrol flashes its lights (a WARNING); she keeps it up — or it's reckless — a chase
                const r = notice("SPEEDING", { msg: u.k9 ? "🐕 K9 UNIT!" : "🚨 PATROL!", warn: pick(WARN_LINES.patrol), unit: u, src: u,
                    amount: u.hunter || reckless() ? 1 : TUNE.susWarn });
                if (r === "chase") return;
                if (r === "warn") u.blipT = 1.6;
            }
        } else u.spot = Math.max(0, u.spot - dt * 1.5);
    }
}

// ── the pursuit ──────────────────────────────────────────────────────────
/**
 * Start a chase. reason = a plain-language charge ("SPEEDING", "GRAND THEFT AUTO"…).
 * opts: { msg, charges[], heat (stars), unit (an existing cop unit to lead) }
 */
export function beginChase(reason, opts = {}) {
    if (L.chase) {                                   // already running: pile the new charge on, turn up the heat
        if (reason && !L.chase.charges.includes(reason)) L.chase.charges.push(reason);
        for (const c of opts.charges || []) if (!L.chase.charges.includes(c)) L.chase.charges.push(c);
        L.chase.heat = Math.min(5, Math.max(L.chase.heat, opts.heat || 0) + 1);
        UI.say(opts.msg || "🚨 MORE UNITS!", "red");
        return true;
    }
    const fug = !!L.fug;
    const charges = (opts.charges || []).slice();
    // the cop who saw it (opts.at: where it happened) is the one who pulls out after her
    if (!opts.unit && opts.at) opts.unit = witnessUnit(opts.at.x, opts.at.z);
    // a call-in still out: its cruiser joins (it was looking for her anyway)
    if (L.bolo) {
        for (const c of L.bolo.charges) if (!charges.includes(c) && c !== reason) charges.push(c);
        const bu = L.bolo.unit;
        L.bolo = null;
        if (bu && bu.car && bu !== opts.unit) { bu.bolo = false; bu.hunter = false; bu.siren = true; bu.slot = "rear2"; }
        emit("law:bolo", { active: false, why: "chase" });
    }
    // a fresh description: whatever disguise she had, THIS car is what they're chasing now
    L.sus = 0; L.lowKey = false; L.lost = null;
    const heat = Math.max(1, opts.heat || (fug ? fugitiveStars(L.fug.t) : S.wanted.length ? 2 : 1));
    L.chase = { reason: reason || charges[0] || "RECKLESS DRIVING", charges, explicit: !!(opts.charges && opts.charges.length), heat, t: 0,
        bust: 0, evade: 0, nextHeat: TUNE.heatEvery, seenT: 0, seen: true, searching: false, hiding: "", k9T: rand(4, 6), mslT: rand(5, 7), reinfT: 0, fug,
        last: { s: ctx.car.s, d: ctx.car.d, h: ctx.car.h, v: Math.max(0, ctx.car.vF), t: ctx.time } };
    if (!L.chase.charges.length) L.chase.charges.push(L.chase.reason);
    if (opts.unit) { opts.unit.slot = "rear"; if (opts.unit.mode !== "chase") toChase(opts.unit, "rear"); opts.unit.hunter = false; opts.unit.siren = true; }
    else spawnChaser("rear", "first");
    H.banner(`<b>${opts.msg || "🚨 BUSTED!"}</b><small>${L.chase.reason} · floor it to get away!</small>`, 2200);
    X.whoop();
    rumble(0.5, 0.7, 400, true);
    ctx.G.shake = Math.max(ctx.G.shake || 0, 0.4);
    ensureCopModels();
    emit("cop:chase", { active: true, reason: L.chase.reason, heat });
    return true;
}
/** A cruiser joins the pursuit. how: "first" (right on her tail), "seen" (coming up behind), "search" (far back, hunting). */
function spawnChaser(slot, how = "seen") {
    const car = ctx.car;
    const fromAhead = slot === "front" && Math.random() < 0.5;
    const back = how === "first" ? rand(45, 60) : how === "search" ? rand(170, 230) : rand(85, 115);
    // (heading DOWN the lap — ci/twoway's far carriageway: "behind her" is up the lap, her lanes are the far side's)
    const D = travelDir();
    const s = fromAhead ? car.s + D * rand(160, 220) : car.s - D * back;
    const d = (fromAhead ? -D : D) * pick(LANES_OURS);
    // (never faster than she can go: the first one only just closes in so it shows in the mirror)
    const v = how === "search" ? car.speed * 0.85 : Math.min(luluTop(), Math.max(18, car.speed + (how === "first" ? 1.5 : 0)));
    // in a town: join on its street grid (out of sight, or right where its patrol car saw her)
    const tp = ctx.town && ctx.town.active && ctx.town.copSpawn ? ctx.town.copSpawn(how, fromAhead) : null;
    if (tp) return addUnit(tp.s, tp.d, tp.dir, Math.min(v, 14), { mode: "chase", slot, k9: false });
    const u = addUnit(s, d, fromAhead ? -D : D, fromAhead ? 20 : v, { mode: "chase", slot, k9: L.chase && L.chase.heat >= 4 && Math.random() < 0.4 });
    return u;
}
/** The cop who saw something at (x, z) — a patrol / a parked cruiser pulls out, a hidden trap leaves its bush. */
function witnessUnit(x, z) {
    const w = copSees(x, z, 75);
    if (!w) return null;
    if (w.car) return w.mode === "pull" || w.mode === "haul" ? null : w;
    return w.cop && !w.gone ? trapUnit(w) : null;
}

// ── heat before a chase ──────────────────────────────────────────────────
/**
 * A petty offense a cop noticed (speeding past a trap / a patrol, a dispatcher's complaint, a town stop sign).
 * The first one is a WARNING (L.sus fills; it drains while she drives clean); one more before it drains — or
 * an `amount` of 1 (reckless) — and it's a chase: led by the cop who saw it (opts.unit / trap / witness: true),
 * or, with nobody in sight, a call-in (BOLO). opts.src: a per-source 4 s cooldown (no double warnings).
 * Returns "chase" | "warn" | "" (ignored: a chase is on, a hold, the tutorial).
 */
export function notice(charge, opts = {}) {
    if (L.chase || L.hold > 0 || L.grace > 0 || calm() || (ctx.G && ctx.G.tutorial) || L.partyHold > ctx.time) return "";
    if (opts.src && opts.src.noticeUntil > ctx.time) return "";
    const amount = opts.amount != null ? opts.amount : TUNE.susWarn;
    // (a warning stays live until it has drained: any offense meanwhile is the second strike)
    if (amount >= 0.999 || L.sus > 0.04) {
        L.sus = 0;
        const unit = opts.unit || (opts.trap ? trapUnit(opts.trap) : null);
        if (unit || opts.witness) beginChase(charge, { msg: opts.msg, unit, heat: opts.heat });
        else callIn(charge, { msg: opts.msg });
        return "chase";
    }
    L.sus = Math.min(0.95, L.sus + amount);
    L.susT = ctx.time;
    if (opts.src) opts.src.noticeUntil = ctx.time + 4;
    H.banner(`<b>${opts.warn || pick(WARN_LINES.patrol)}</b><small>${charge.toLowerCase()} · ease off — once more and they chase</small>`, 2400, { key: "law:warn", prio: 2 });
    X.chirp();
    rumble(0.2, 0.4, 160);
    emit("law:warning", { charge, heat: L.sus });
    return "warn";
}

/**
 * A witness phoned it in (a carjacked driver, a grudge, a dispatch complaint): nobody's chasing her YET.
 * After TUNE.boloDelay one unlit cruiser comes up the road looking for the car she's in — if it gets a good
 * look (TUNE.boloSee) it lights her up; if she changed cars / paint, ditched the car, or kept out of its way
 * for TUNE.boloLook, they call it off. Returns "bolo" | "chase" (one's already on) | "".
 */
export function callIn(charge, opts = {}) {
    if (L.chase) { if (charge && !L.chase.charges.includes(charge)) L.chase.charges.push(charge); return "chase"; }
    if (calm() || (ctx.G && ctx.G.tutorial) || L.partyHold > ctx.time || !ctx.car) return "";
    if (L.bolo) { if (charge && !L.bolo.charges.includes(charge)) L.bolo.charges.push(charge); return "bolo"; }
    const delay = opts.delay != null ? opts.delay : rand(TUNE.boloDelay[0], TUNE.boloDelay[1]);
    L.bolo = { charge: charge || "RECKLESS DRIVING", charges: [charge || "RECKLESS DRIVING"], msg: opts.msg || BOLO_MSG, t: delay, delay,
        phase: "called", unit: null, look: TUNE.boloLook, seeT: 0, desc: rideDesc() };
    H.banner(`<b>${L.bolo.msg}</b><small>a cruiser's on its way · change cars, hide, or keep clean</small>`, 2600, { key: "law:bolo", prio: 2 });
    X.chirp();
    emit("law:bolo", { active: true, charge: L.bolo.charge, delay });
    return "bolo";
}
export function endBolo(why = "ended", msg = "") {
    const b = L.bolo;
    if (!b) return;
    L.bolo = null;
    const u = b.unit;
    if (u && u.car) { u.bolo = false; u.hunter = false; u.mode = "giveup"; u.siren = false; u.t = 0; }
    if (msg) H.toast(msg, "pink", { key: "law:bolo" });
    emit("law:bolo", { active: false, why });
}
function updateBolo(dt, controlsOn) {
    const b = L.bolo;
    if (!b) return;
    if (L.chase) { L.bolo = null; return; }
    if (rideDesc() !== b.desc) { endBolo("switched", LOOK_MSG.car); return; }
    if (!controlsOn || ctx.state !== "playing") return;
    if (b.phase === "called") {
        b.t -= dt;
        if (b.t > 0 || L.hold > 0) return;
        const car = ctx.car;
        const tp = ctx.town && ctx.town.active && ctx.town.copSpawn ? ctx.town.copSpawn("search", false) : null;
        const u = tp ? addUnit(tp.s, tp.d, tp.dir, 10, { mode: "chase" })
            : addUnit(car.s - travelDir() * rand(170, 220), travelDir() * pick(LANES_OURS), travelDir(), clamp(car.speed * 0.9, 18, TUNE.boloSpeed), { mode: "chase" });
        u.bolo = true; u.hunter = true; u.siren = false;
        b.unit = u; b.phase = "looking";
        // (in town: where the caller saw her — the cruiser prowls round there, it doesn't know where she's gone since)
        if (tp) b.last = { s: car.s, d: car.d, h: car.h, v: 0, t: ctx.time };
        H.toast("🚓 A cruiser's out looking for your car…", "red", { key: "law:bolo" });
        return;
    }
    const u = b.unit;
    if (!u || !u.car || !L.units.includes(u)) { endBolo("lost"); return; }
    const hide = hiding();
    b.look -= dt * (hide ? 2 : 1);
    if (unitSees(u, 1, nightness(), !!hide)) {
        b.seeT += dt * copMul("copLook");
        if (b.seeT >= TUNE.boloSee) {
            const charges = b.charges.slice();
            L.bolo = null;
            u.bolo = false; u.hunter = false;
            emit("law:bolo", { active: false, why: "found" });
            beginChase(b.charge, { msg: "🚨 THAT'S THE CAR!", unit: u, charges });
            return;
        }
    } else b.seeT = Math.max(0, b.seeT - dt * 0.5);
    if (b.look <= 0) endBolo("gaveup", "📻 …they called off the search. 😎");
}

/**
 * She changed what the cops would recognise (an unseen carjack / hotwire / a hailed ride, Paint & Pray, the
 * quick-change booth): a call-in out for her old car is off, the warning heat is gone, and for the rest of the
 * run patrols don't recognise her from the warrant file (a new chase gives them a fresh description).
 */
export function changeLook(how = "car") {
    if (L.chase) return false;                 // (they're watching her do it: nothing to shake)
    const had = !!(L.bolo || S.wanted.length || L.sus > 0.05);
    if (L.bolo) endBolo("switched");
    L.sus = 0; L.wantedSpot = 0;
    L.lowKey = how; L.lowKeyT = ctx.time;
    if (had && LOOK_MSG[how]) H.toast(LOOK_MSG[how], "pink", { key: "law:look" });
    emit("law:look", { how, had });
    return had;
}

// ── line of sight ────────────────────────────────────────────────────────
function nightness() { const a = ctx.atmos; return a && typeof a.night === "number" ? clamp(a.night, 0, 1) : 0; }
/** Is the straight line from (ax, az) to Lulu (or to (bx, bz)) clear? Not if it cuts across the roadside on a
 *  bend (trees, houses) or a truck / bus is in the way. */
function clearLine(ax, az, as, self, bx = ctx.car.pos.x, bz = ctx.car.pos.z) {
    const car = ctx.car, road = ctx.world.road;
    // in a town (features/town) its buildings are the occluders; on the highway, the roadside on a bend
    const own = placeSight(ax, az, bx, bz);
    if (own === false) return false;
    if (ctx.town && ctx.town.active) { if (ctx.town.blocksSight(ax, az, bx, bz)) return false; }
    else if (own !== true) for (const k of [0.3, 0.55, 0.8]) {
        road.nearest(ax + (bx - ax) * k, az + (bz - az) * k, Number.isFinite(as) ? as + (car.s - as) * k : car.s, tmpN);
        if (Math.abs(tmpN.d) > TUNE.offRoad) return false;
    }
    const lx = bx - ax, lz = bz - az, len2 = lx * lx + lz * lz || 1;
    for (const o of ctx.traffic.cars) {
        if (o === self || o.hit || !o.spec || o.spec.halfW < 1.1) continue;       // only trucks / buses / big rigs block the view
        const t = ((o.x - ax) * lx + (o.z - az) * lz) / len2;
        if (t < 0.08 || t > 0.92) continue;
        const px = ax + lx * t - o.x, pz = az + lz * t - o.z;
        if (px * px + pz * pz < (o.spec.halfW + 0.4) ** 2) return false;
    }
    return true;
}
/** Does this cruiser have eyes on her right now? (hidden: she's stopped and tucked away — see hiding()) */
function unitSees(u, heat, night, hidden = false) {
    const c = u.car;
    if (!c || c.hit) return false;
    const car = ctx.car, d = Math.hypot(car.pos.x - c.x, car.pos.z - c.z);
    if (hidden) return d < TUNE.hideClose;      // (behind the bushes / between parked cars: only right up close)
    if (d > TUNE.sight[clamp(Math.round(heat), 1, 5)] * (1 - 0.25 * night)) return false;
    return d < 22 || clearLine(c.x, c.z, c.s, c);
}
function chopperSees(night) {
    const ch = L.chopper;
    if (!ch) return false;
    const car = ctx.car;
    if (night > 0.5) return Math.hypot(ch.poolX - car.pos.x, ch.poolZ - car.pos.z) < 8;      // only what the spotlight's on
    return Math.hypot(ch.x - car.pos.x, ch.z - car.pos.z) < TUNE.chopperSight;
}
const SLOTS = ["rear", "front", "side", "rear2"];
function updateChase(dt, controlsOn) {
    const ch = L.chase, car = ctx.car;
    if (!controlsOn) return;
    ch.t += dt;
    // heat climbs while they've got eyes on her — not while she's hidden (fugitive heat follows her time on the lam)
    if (ch.fug && L.fug) ch.heat = Math.max(ch.heat, fugitiveStars(L.fug.t));
    if (!ch.searching) ch.seenT += dt;
    if (ch.seenT > ch.nextHeat && ch.heat < 5) { ch.heat++; ch.nextHeat = ch.seenT + TUNE.heatEvery; UI.say(`🚨 ${"★".repeat(ch.heat)} MORE UNITS!`, "red"); X.whoop(); }
    // reinforcements by heat: 1 · 2 · 2 · 3 · 4 cruisers
    const want = [0, 1, 2, 2, 3, 4][ch.heat];
    const units = L.units.filter(u => u.mode === "chase" && u.car);
    ch.reinfT -= dt;
    if (units.length < want && ch.reinfT <= 0 && units.length < 4) {
        const taken = new Set(units.map(u => u.slot));
        const slot = SLOTS.find(s => !taken.has(s) && (s !== "front" || ch.heat >= 4) && (s !== "side" || ch.heat >= 4)) || "rear2";
        spawnChaser(slot, ch.searching ? "search" : "seen");
        ch.reinfT = TUNE.reinforce;
    }
    // 3★+ the K9 dogs, 4★+ the missiles — only while they can see her, and dodgeable
    if (ch.heat >= 3 && !ch.searching) { ch.k9T -= dt; if (ch.k9T <= 0) { ch.k9T = rand(8, 12) - (ch.heat - 3) * 1.5; if (ctx.enabled("law")) spawnK9(); } }
    if (ch.heat >= 4 && !ch.searching) { ch.mslT -= dt; if (ch.mslT <= 0) { ch.mslT = rand(9, 13) - (ch.heat - 4) * 2; if (ctx.enabled("law")) fireMissile(); } }
    if (ch.heat >= 5) ensureChopper();

    // BUSTED meter: a cruiser on top of her while she's slow (or boxed in)
    const near = nearestUnit(L.units, true);
    const close = units.filter(u => !u.car.hit && Math.hypot(u.car.x - car.pos.x, u.car.z - car.pos.z) < 12).length;
    const sp = car.speed;
    let fill = 0;
    // (a moment's slow-down in traffic isn't an arrest; sitting still next to a cruiser is)
    if (near && near.d < 10 && sp < 9) fill = 0.6 * (1 - sp / 9) + (close >= 2 ? 0.35 : 0);

    // (sitting still near one = BUSTED — unless she's tucked away and they're searching: then only one right on top of her)
    const tucked = ch.searching && hiding();
    if (near && near.d < (tucked ? TUNE.hideClose : 22) && sp < 2) fill = Math.max(fill, 1.2);
    ch.bust = clamp(ch.bust + (fill > 0 ? fill * dt : -0.5 * dt), 0, 1);
    if (ch.bust >= 1) { bust(near ? near.u : null); return; }
    // SEARCH (GTA): break every cruiser's line of sight — and the chopper's — and keep some distance;
    // the stars flash while they look for her, and staying hidden long enough loses them. A glimpse
    // only knocks the progress back a little.
    const night = nightness();
    // HIDING: stopped and tucked away (a rest-area lot, off the asphalt out of view, a town kerb among parked cars) — harder to spot,
    // and once they've lost her the meter runs twice as fast. Out on the open road she's just a parked target.
    const hide = hiding();
    const sky = chopperSees(night);
    let seen = false;
    for (const u of units) if (!seen && unitSees(u, ch.heat, night, !!hide)) seen = true;
    // hidden: a cruiser flashing past for a split second doesn't register her (they drive right by)
    if (hide && seen) { ch.glimpse = (ch.glimpse || 0) + dt; seen = ch.glimpse > TUNE.hideGlimpse; } else ch.glimpse = 0;
    if (sky) seen = true;
    if (!seen && ch.tipT > ctx.time) seen = true;       // ctx.law.spot(): a tip-off (features/community's Shomrim radio)
    const gap = near ? near.d : 999;
    if (seen) ch.last = { s: car.s, d: car.d, h: car.h, v: Math.max(0, car.vF), t: ctx.time };     // where they think she's heading
    const wasSearching = ch.searching;
    ch.seen = seen;
    ch.searching = !seen && gap > (hide ? TUNE.hideGap : TUNE.searchGap) * copMul("copHear");
    ch.hiding = ch.searching ? hide : "";
    if (ch.searching && !wasSearching && L.hint < 1 && ch.t > 2) {
        L.hint++;
        H.toast(ctx.town && ctx.town.active ? "👀 They lost sight of you — park at the kerb between parked cars, or pull off the street, out of sight!"
            : "👀 They lost sight of you — pull off & stop out of sight, or take an exit!", "pink", { key: "law:hint" });
    }
    // stopped somewhere that DOESN'T count (a travel lane, an empty kerb, in plain view): say so, once a run
    const why = ch.searching && !hide ? notHiddenHint() : "";
    ch.exposedT = why ? (ch.exposedT || 0) + dt : 0;
    if (why && ch.exposedT > 1.5 && L.hint2 < 1) { L.hint2 = (L.hint2 || 0) + 1; H.toast(why, "red", { key: "law:hint" }); }
    // …and once she IS tucked away, the "not hidden" / "pull off" advice goes (it used to linger, saying she wasn't)
    if (ch.hiding && !ch.hidSaid) { ch.hidSaid = true; if (H.dropToast) H.dropToast("law:hint"); }
    else if (!ch.hiding) ch.hidSaid = false;
    const need = TUNE.search[clamp(Math.round(ch.heat), 1, 5)];
    if (ch.searching) ch.evade = clamp(ch.evade + dt / need * (hide ? TUNE.hideMul : 1), 0, 1);
    else ch.evade = Math.max(0, ch.evade - dt * (seen ? 0.3 : 0.08));
    if (ch.evade >= 1) {
        // 🔗 partners in crime (crew.js): nobody's LOST 'EM lands while a partner is still seen — the meter waits at the top
        if (L.crewHold && L.crewHold()) ch.evade = 0.97;
        else escape(hide ? "hid" : "lost");
    }

}

/** She shook them. how: "lost" (out of sight long enough) · "hid" · "town" (took an exit unseen) · … */
export function escape(how = "lost", msg = "") {
    const ch = L.chase;
    if (!ch) return;
    endChase("escaped");
    UI.say("Lost 'em! 😎", "green");
    const sub = msg || (how === "hid" ? "they drove right past you 🤫" : how === "town" ? "they never saw you take the exit" : "");
    H.banner(`<b>😎 LOST 'EM!</b><small>${sub || (ch.heat > 1 ? `${ch.heat}★ heat shaken off` : "Back to cruising")}</small>`, 2200);
    X.lost();
    addScore(500 * ch.heat, "escape");
    stat("escapes2", 1);
    if (how === "hid") stat("lawHides", 1);
    L.apbCool = rand(18, 28);
    L.grace = TUNE.escapeGrace;
    L.lost = { t: ctx.time + 3.5, how };
}

/** Wind down: cruisers kill the sirens and drift onto the shoulder. */
export function endChase(result = "ended") {
    const ch = L.chase;
    if (!ch) return;
    L.chase = null;
    for (const u of L.units) {
        if (u.mode === "chase" && u.car) { u.mode = "giveup"; u.siren = false; u.t = 0; u.car.keep = true; }
    }
    removeChopper();
    X.sirenOff();
    emit("cop:chase", { active: false, result, reason: ch.reason });
}

/** She's been run down: hand over to the pull-over scene. */
function bust(u) {
    const ch = L.chase;
    if (!u) u = activeUnits()[0];
    if (!u) { endChase("ended"); return; }
    L.chase = null;
    removeChopper();
    for (const o of L.units) if (o !== u && o.mode === "chase" && o.car) { o.mode = "giveup"; o.siren = true; o.t = 0; }
    emit("cop:chase", { active: false, result: "busted", reason: ch.reason });
    setState("lawBust", { unit: u, reason: ch.reason, charges: ch.explicit ? ch.charges.slice() : null,
        extra: ch.charges.filter(c => c !== ch.reason), fugitive: !!L.fug });
}

// ── near misses rattle traffic: a car she just skimmed past swerves and brakes,
//    and a cruiser right behind her reacts late (cop pile-ups shake the tail) ──
export function spook() {
    if (!L.chase) return;
    const car = ctx.car, fx = Math.sin(car.h), fz = Math.cos(car.h);
    for (const c of ctx.traffic.cars) {
        if (c.hit || (c.data && c.data.law) || c.ai) continue;
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z, lon = dx * fx + dz * fz;
        if (lon > 2 || lon < -12 || Math.abs(dx * -fz + dz * fx) > 5.5) continue;
        c.data.spookT = ctx.time + 2.2;
        c.want = Math.max(0, c.speed - 9);
        const lanes = c.dir > 0 ? LANES_OURS : [-1.75, -5.25];
        const other = lanes.find(l => Math.abs(l - c.dTarget) > 1);
        if (other !== undefined && Math.random() < 0.6) { c.dTarget = other; c.laneCooldown = 3; }
    }
}

// ── random cop events while driving ──────────────────────────────────────
function updateRandom(dt, controlsOn) {
    const G = ctx.G;
    if (!controlsOn || !ctx.enabled("law") || L.hold > 0 || calm()) return;
    // hidden traps
    if (config.traps && tickSpawn(dt) && G.runTime > 15 && !L.chase && L.traps.length < 2) spawnTrap();
    // patrol cars cruising the road (rare)
    const patrols = L.units.filter(u => u.mode === "patrol").length;
    if (config.patrols && G.runTime > 20 && !L.chase && patrols < 1 && Math.random() < dt * 0.03) spawnPatrol({ k9: false });
    // the APB: somebody phones in a speeder. Only while she IS speeding (driving clean, nobody calls), and it
    // goes through the same warning step: a first complaint is a warning, a second (or a warning already live)
    // puts out a call-in — a cruiser comes looking, it doesn't appear on her bumper.
    if (config.apb && canPounce() && car().speed > 12 && !L.bolo) {
        L.apbCool -= dt;
        if (L.apbCool <= 0) {
            L.apbCool = rand(10, 16);
            const lvl = Math.floor(G.runTime / 30);
            if (lvl >= 2 && speeding() && Math.random() < clamp(0.1 + 0.04 * (lvl - 2), 0, 0.35)) {
                notice("RECKLESS DRIVING", { msg: pick(APB_FAST), warn: pick(WARN_LINES.apb), src: L });
            }
        }
    }
    // flavour: a cruiser pulls somebody ELSE over up ahead
    L.flavourT -= dt;
    if (L.flavourT <= 0 && !L.chase) { L.flavourT = rand(45, 80); startFlavour(); }
    // the open-warrant file: a cop who gets a GOOD look at her (close, clear line of sight, a second or two)
    // recognises her — unless she's changed her look since (L.lowKey: a new car, fresh paint, a disguise)
    const wanted = S.wanted;
    if (wanted.length && !L.fug && !L.lowKey && canPounce()) {
        const p = car().pos;
        const pu = L.units.find(u => u.car && !u.car.hit && u.mode === "patrol" && Math.hypot(u.car.x - p.x, u.car.z - p.z) < TUNE.warrantRange
            && clearLine(u.car.x, u.car.z, u.car.s, u.car));
        const seen = pu || L.traps.find(t => !t.gone && car().s - t.s > -45 && car().s - t.s < 8);
        if (seen) {
            L.wantedSpot += dt * (speeding() ? 2 : 1) * copMul("copLook");
            if (L.wantedSpot > TUNE.warrantSee) {
                L.wantedSpot = 0;
                beginChase("OUTSTANDING WARRANT", { msg: "🚨 THAT'S HER — WANTED!", charges: wanted.slice(0, 3), unit: pu || trapUnit(seen) });
            }
        } else L.wantedSpot = Math.max(0, L.wantedSpot - dt * 0.8);
        L.wantedPatrolT -= dt;
        if (L.wantedPatrolT <= 0) { L.wantedPatrolT = rand(TUNE.warrantPatrol[0], TUNE.warrantPatrol[1]); if (patrols < 1) spawnPatrol(); }
    } else if (L.lowKey) L.wantedSpot = 0;
}
const car = () => ctx.car;

// ── fugitive ─────────────────────────────────────────────────────────────
export function startFugitive(fugT = 0) {
    L.fug = { t: fugT, spot: 0, posterT: 1.2, copT: 2.5, k9T: rand(5, 8), mslT: rand(5, 8), saveT: 1 };
    prisonClothes(true);
}
export function endFugitive(msg) {
    if (!L.fug) return;
    L.fug = null;
    prisonClothes(false);
    for (const u of L.units) if (u.hunter && u.car) { u.hunter = false; u.mode = "giveup"; u.siren = false; u.t = 0; }
    removeChopper();
    if (msg) { H.banner(`<b>${msg}</b>`, 2400); X.lost(); }
}
function updateFugitive(dt, controlsOn) {
    const f = L.fug;
    if (!f || !controlsOn) return;
    f.t += dt;
    const wl = fugitiveStars(f.t);
    // lay-low fallback: survive long enough clean and the heat dies down
    if (f.t > 100 && !L.chase) { clearLockup(); endFugitive("😎 Laid low long enough — heat's off."); return; }
    f.saveT -= dt;
    if (f.saveT <= 0) { f.saveT = 1; patchLockup({ fugT: f.t }); }
    if (!ctx.enabled("law") || L.partyHold > ctx.time) return;      // (a 🎉 party race / game: law/index.js partyStandDown)
    // WANTED posters keep going up
    f.posterT -= dt;
    if (f.posterT <= 0) { f.posterT = rand(7, 12); spawnPoster(); }
    // the heat escalates by stage: trickling cruisers, 3★ hunters, 4★ K9 units
    f.copT -= dt;
    if (f.copT <= 0) {
        f.copT = Math.max(3.4, 8.2 - wl * 0.7);
        if (L.units.filter(u => u.mode === "patrol" || u.hunter).length < 3) {
            const u = spawnPatrol({ k9: wl >= 4 && Math.random() < 0.4 });
            if (wl >= 3 && Math.random() < (wl >= 4 ? 0.7 : 0.2)) { toChase(u, "rear"); u.hunter = true; u.siren = false; }
        }
    }
    if (wl >= 3 && !L.chase) { f.k9T -= dt; if (f.k9T <= 0) { f.k9T = Math.max(2.2, rand(4.5, 7) - wl * 0.4); spawnK9(); } }
    if (wl >= 4 && !L.chase) { f.mslT -= dt; if (f.mslT <= 0) { f.mslT = Math.max(2.4, rand(4, 6) - (wl - 4) * 0.7); fireMissile(); } }
    if (wl >= 5) ensureChopper();
    if (L.chase || L.grace > 0) { f.spot = Math.max(0, f.spot - dt); return; }
    // RECOGNISED → a chase she gets a real shot at out-running
    const bustAt = Math.max(0.7, 1.6 - wl * 0.2);
    const pos = ctx.car.pos;
    const seen = L.units.find(u => u.car && !u.car.hit && Math.hypot(u.car.x - pos.x, u.car.z - pos.z) < 38)
        || L.traps.find(t => !t.gone && (ctx.car.s - t.s) * travelDir() > -60 && (ctx.car.s - t.s) * travelDir() < 10);
    if (wl >= 5) {
        f.spot += dt * 1.1;
        if (f.spot > bustAt) { f.spot = 0; beginChase("ESCAPE FROM CUSTODY", { msg: "🚁 SPOTLIGHT — FLOOR IT!", unit: seen && seen.car ? seen : null }); }
        return;
    }
    if (seen) {
        f.spot += dt * (1 + wl * 0.35);
        if (f.spot > bustAt) {
            f.spot = 0;
            if (seen.cop && !seen.car) trapToChaseFug(seen);
            else beginChase("ESCAPE FROM CUSTODY", { msg: "🚨 RECOGNIZED — DRIVE!", unit: seen.car ? seen : null });
        }
    } else f.spot = Math.max(0, f.spot - dt * 0.8);
}
function trapToChaseFug(t) {
    t.gone = true; t.obj.remove(t.cop);
    const u = addUnit(t.s, t.d, 1, 0, { mode: "chase" });
    Object.assign(u.car, { free: true, x: t.x, z: t.z, h: t.h });
    beginChase("ESCAPE FROM CUSTODY", { msg: "🚨 RECOGNIZED — DRIVE!", unit: u });
}

/** Lulu's in the orange jumpsuit (the driver's shirt in the car, too). */
let jumpsuitMat = null;
export function prisonClothes(on) {
    const m = ctx.car && ctx.car.model;
    if (!m) return;
    m.traverse(o => {
        if (!o.isMesh || !o.material) return;
        if (on && o.material.name === "Shirt") {
            if (!jumpsuitMat) { jumpsuitMat = o.material.clone(); jumpsuitMat.color.set("#FF6D2E"); jumpsuitMat.name = "ShirtJumpsuit"; }
            o.userData.lawShirt = o.material; o.material = jumpsuitMat;
        } else if (!on && o.userData.lawShirt) { o.material = o.userData.lawShirt; delete o.userData.lawShirt; }
    });
}

// ── WANTED posters ───────────────────────────────────────────────────────
let mugTex = null;
/** A real 3D mugshot (Lulu in the jumpsuit vs. the height lines) rendered once to a texture. */
export function mugshot() {
    if (mugTex || !models.luluPerson || !ctx.renderer) return mugTex;
    const rt = new THREE.WebGLRenderTarget(256, 256);
    const sc = new THREE.Scene();
    sc.background = new THREE.Color("#C9D3DC");
    sc.add(new THREE.HemisphereLight("#ffffff", "#8a8a8a", 2.2));
    const sun = new THREE.DirectionalLight("#ffffff", 1.6); sun.position.set(1, 2, 3); sc.add(sun);
    for (let i = 0; i < 6; i++) {
        const line = new THREE.Mesh(new THREE.BoxGeometry(3, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: "#5c6a78" }));
        line.position.set(0, 1.0 + i * 0.15, -0.6);
        sc.add(line);
    }
    const p = cloneWithColors(models.luluPerson, { Top: "#FF6D2E", Bottom: "#FF6D2E" });
    sc.add(p);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 1.5, 2.2); cam.lookAt(0, 1.42, 0);
    const r = ctx.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(rt); r.render(sc, cam); r.setRenderTarget(prev);
    mugTex = rt.texture;
    return mugTex;
}
let posterMat = null;
function spawnPoster() {
    if (!models.lawBillboard) return;
    const road = ctx.world.road, side = Math.random() < 0.5 ? -1 : 1;
    const s = ctx.car.s + (downLap() ? -1 : 1) * rand(250, 300), d = side * 13.5;
    road.point(s, d, tmpP);
    const h = road.at(s).h;
    const b = cloneWithColors(models.lawBillboard);
    b.position.set(tmpP.x, 0, tmpP.z);
    b.rotation.y = facingRoad(h, side);
    if (!posterMat) posterMat = new THREE.MeshStandardMaterial({ map: posterTexture(["WANTED", "LULU BRUCK", `REWARD 💰${400}`], "#F3E5C0", "#7A1F1A", true), roughness: 0.8 });
    const face = findNodes(b, "Face")[0];
    if (face) face.traverse(o => { if (o.isMesh) o.material = posterMat; });
    const tex = mugshot();
    if (tex) {
        const mug = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.3), new THREE.MeshBasicMaterial({ map: tex }));
        mug.position.set(-1.6, 4.75, 0.08);
        b.add(mug);
        b.userData.mug = mug;
    }
    ctx.scene.add(b);
    const posts = [-2, 2].map(o => { road.point(s + o, d, tmpQ); return { x: tmpQ.x, z: tmpQ.z }; });
    addActor({
        update() { return (ctx.car.s - s) * travelDir() < 80; },
        collide(pc) {
            for (const q of posts) {
                const imp = pc.collideStatic(q.x, q.z, 0.3);
                if (imp) return { impact: imp, why: "Lulu vs. her own WANTED poster", source: "sign" };
            }
            return null;
        },
        dispose() { ctx.scene.remove(b); if (b.userData.mug) b.userData.mug.geometry.dispose(); },
    });
    UI.say("🪧 WANTED: LULU", "red");
}

// ── K9 dogs ──────────────────────────────────────────────────────────────
export function spawnK9() {
    if (!models.lawK9) { ensureCopModels(); return; }
    const road = ctx.world.road, car = ctx.car;
    // loosed from a cruiser up ahead if there is one, else from the roadside
    const D = travelDir();      // (down the lap "up ahead" is −s, her lanes the far side's)
    const lead = L.units.find(u => u.car && (u.car.s - car.s) * D > 20 && (u.car.s - car.s) * D < 140);
    let s = lead ? lead.car.s - D * 3 : car.s + D * rand(70, 95), d = lead ? lead.car.d : D * pick([1.75, 5.25, -1.75]);
    const dog = cloneWithColors(models.lawK9);
    dog.scale.setScalar(1.25);
    ctx.scene.add(dog);
    const legs = ["Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR"].map(n => findNodes(dog, n)[0]).filter(Boolean);
    const tail = findNodes(dog, "Tail")[0], head = findNodes(dog, "Head")[0];
    let t = 0, barkT = rand(0.3, 0.9), hit = false;
    X.bark();
    UI.say("🐕 K9 LOOSE!", "gold");
    const threat = { kind: "k9", s, d };
    L.threats.add(threat);
    addActor({
        update(dt) {
            t += dt;
            s -= D * 9 * dt;
            // soft homing, and it commits to a line in the last few metres — a late lane change shakes the dog
            if ((s - car.s) * D > 18) d += (car.d - d) * Math.min(1, 0.55 * dt);
            threat.s = s; threat.d = d;
            road.point(s, d, tmpQ);
            const h = road.at(s).h + (D > 0 ? Math.PI : 0);
            dog.position.set(tmpQ.x, Math.abs(Math.sin(t * 9)) * 0.12, tmpQ.z);
            dog.rotation.y = h;
            legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 18 + (i % 2 ? 0 : Math.PI) + (i > 1 ? 1.2 : 0)) * 0.8; });
            if (tail) tail.rotation.x = Math.sin(t * 14) * 0.5;
            if (head) head.rotation.x = Math.sin(t * 9) * 0.08;
            barkT -= dt;
            if (barkT <= 0) { barkT = rand(0.6, 1.2); if (Math.abs(car.s - s) < 60) X.bark(); }
            return !hit && (car.s - s) * D < 40;
        },
        dispose() { ctx.scene.remove(dog); L.threats.delete(threat); },
        collide(pc) {
            const dx = dog.position.x - pc.pos.x, dz = dog.position.z - pc.pos.z;
            if (hit || dx * dx + dz * dz > 1.9 * 1.9 || ctx.G.invT > 0) return null;
            hit = true;
            // below 5★ the dog just hangs off the bumper: it slows her down (the cruisers close in), no heart
            const heat = L.chase ? L.chase.heat : 5;
            UI.say(heat >= 5 ? "🐕 CHOMP!" : "🐕 CHOMP! It's got the bumper!", "red");
            pc.vx *= 0.6; pc.vz *= 0.6;
            return { impact: 8, why: "🐕 The K9 got your bumper!", source: "law:k9", harmless: heat < 5 };
        },
    });
}

// ── cop missiles ─────────────────────────────────────────────────────────
export function fireMissile() {
    if (!models.lawMissile) { ensureCopModels(); return; }
    const road = ctx.world.road, car = ctx.car;
    const D = travelDir();
    const lead = L.units.find(u => u.car && (u.car.s - car.s) * D > 20 && (u.car.s - car.s) * D < 160);
    let s = lead ? lead.car.s - D * 3 : car.s + D * rand(110, 130), d = lead ? lead.car.d : D * pick([1.75, 5.25]);
    const m = cloneWithColors(models.lawMissile);
    m.scale.setScalar(1.3);
    ctx.scene.add(m);
    let t = 0, hit = false;
    X.missileLaunch();
    UI.say("🚀 INCOMING!", "red");
    const threat = { kind: "missile", s, d };
    L.threats.add(threat);
    addActor({
        update(dt) {
            t += dt;
            s -= D * 22 * dt;
            if ((s - car.s) * D > 32) d += (car.d - d) * Math.min(1, 0.8 * dt);      // locks on, then flies straight: a late lane change dodges it
            threat.s = s; threat.d = d;

            road.point(s, d, tmpQ);
            const h = road.at(s).h + (D > 0 ? Math.PI : 0);
            m.position.set(tmpQ.x, 1.0 + Math.sin(t * 7) * 0.05, tmpQ.z);
            m.rotation.set(0, h, Math.sin(t * 9) * 0.3);   // nose (+Z after export) points back down the road at Lulu
            if (Math.random() < 0.8) car.fx.emit(tmpQ.x - Math.sin(h) * 1.1, 1.0, tmpQ.z - Math.cos(h) * 1.1, (Math.random() - 0.5), 0.6, (Math.random() - 0.5), 0.45, 0.5, [1, 0.55 + Math.random() * 0.3, 0.15]);
            return !hit && (car.s - s) * D < 30;
        },
        collide(pc) {
            const dx = m.position.x - pc.pos.x, dz = m.position.z - pc.pos.z;
            if (hit || dx * dx + dz * dz > 2.0 * 2.0 || ctx.G.invT > 0) return null;

            hit = true;
            X.boom();
            pc.fx.burst(m.position.x, 1, m.position.z, 30, 7, [1, 0.6, 0.2], 0.7, 0.8);
            pc.fx.burst(m.position.x, 1, m.position.z, 16, 3, [0.4, 0.4, 0.42], 1.6, 1.4);
            return { impact: 11, why: "🚀 A cop MISSILE?! Really?!", source: "law:missile" };
        },
        dispose() { ctx.scene.remove(m); L.threats.delete(threat); },
    });
}

// ── the chopper (5★) ─────────────────────────────────────────────────────
export function ensureChopper() {
    if (L.chopper || !models.lawChopper) { if (!models.lawChopper) ensureCopModels(); return; }
    const g = cloneWithColors(models.lawChopper);
    g.rotation.order = "YXZ";
    const r = rig(g);
    const rotor = findNodes(g, "Rotor")[0], tail = findNodes(g, "TailRotor")[0];
    // the searchlight: a soft cone + a pool of light on the road (no real light → no shader recompiles)
    const coneMat = new THREE.MeshBasicMaterial({ color: "#fffbe0", transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 4.2, 1, 24, 1, true), coneMat);
    const pool = new THREE.Mesh(washGeo, new THREE.MeshBasicMaterial({ map: glow(), color: "#fff6c8", transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.scale.setScalar(10);
    ctx.scene.add(g, cone, pool);
    const ch = { g, r, rotor, tail, cone, pool, coneMat, t: 0, x: ctx.car.pos.x, z: ctx.car.pos.z - 40, thumpT: 0, poolX: ctx.car.pos.x, poolZ: ctx.car.pos.z };
    L.chopper = ch;
    H.banner(`<b>🚁 POLICE AIR UNIT</b><small>They've got eyes in the sky!</small>`, 2000);
    addActor({
        update(dt) {
            if (L.chopper !== ch) return false;
            ch.t += dt;
            const car = ctx.car;
            const tx = car.pos.x - Math.sin(car.h) * 8 + Math.cos(ch.t * 0.4) * 6, tz = car.pos.z - Math.cos(car.h) * 8;
            // it's quick, but flat out (or on nitro) she can outrun it
            let mx = (tx - ch.x) * Math.min(1, dt * 1.6), mz = (tz - ch.z) * Math.min(1, dt * 1.6);
            const step = Math.hypot(mx, mz), vmax = luluTop() * TUNE.chopperSpeed * dt;
            if (step > vmax) { mx *= vmax / step; mz *= vmax / step; }
            ch.x += mx; ch.z += mz;
            const y = 21 + Math.sin(ch.t * 1.3) * 1.2;
            g.position.set(ch.x, y, ch.z);
            g.rotation.set(0.12, car.h, Math.sin(ch.t * 0.9) * 0.06);   // nose (+Z) leans into the chase
            if (rotor) rotor.rotation.y += dt * 38;
            if (tail) tail.rotation.x += dt * 50;
            setRig(r, true, ctx.time * 1.4);
            // the searchlight tracks her with a little lag and only reaches so far from the chopper
            const sway = Math.sin(ch.t * 1.1) * 2.5;
            let px = car.pos.x + Math.cos(car.h) * sway, pz = car.pos.z - Math.sin(car.h) * sway;
            ch.poolX += (px - ch.poolX) * Math.min(1, dt * 3.2); ch.poolZ += (pz - ch.poolZ) * Math.min(1, dt * 3.2);
            const rx = ch.poolX - ch.x, rz = ch.poolZ - ch.z, reach = Math.hypot(rx, rz);
            if (reach > 30) { ch.poolX = ch.x + rx * 30 / reach; ch.poolZ = ch.z + rz * 30 / reach; }
            px = ch.poolX; pz = ch.poolZ;
            pool.position.set(px, 0.08, pz);
            // a faint shaft by day, a proper spotlight cone at night
            const night = nightness();
            coneMat.opacity = 0.035 + 0.2 * night;
            pool.material.opacity = 0.22 + 0.6 * night;

            const sx = ch.x, sz = ch.z, sy = y - 0.9;
            const len = Math.hypot(px - sx, sy, pz - sz);
            cone.position.set((sx + px) / 2, sy / 2, (sz + pz) / 2);
            cone.scale.set(1, len, 1);
            cone.lookAt(px, 0, pz); cone.rotateX(Math.PI / 2);
            ch.thumpT -= dt;
            // the rotor: a located loop (behind / above her) once positional audio is up, else the flat thump
            if (!ch.sp && A.spatial.ready) ch.sp = A.spatial.loop("rotor", g);
            if (ch.thumpT <= 0) { ch.thumpT = 0.09; if (!ch.sp) X.rotorThump(0.5); }
            return true;
        },
        dispose() { if (ch.sp) ch.sp = ch.sp.stop(); ctx.scene.remove(g, cone, pool); cone.geometry.dispose(); coneMat.dispose(); pool.material.dispose(); if (L.chopper === ch) L.chopper = null; },
    });
}
export function removeChopper() { L.chopper = null; }

// ── per-frame (from hooks.update) ────────────────────────────────────────
export function update(dt, P, controlsOn) {
    if (L.grace > 0) L.grace -= dt;
    if (L.hold > 0) L.hold -= dt;
    if (L.pending) { const p = L.pending; L.pending = null; p(); return; }
    if (ctx.state === "arriving" && L.chase) {   // safe at Bubbe's — the cops won't follow her in there
        endChase("safe");
        H.toast("🏡 Safe at Bubbe's! The cops back off.", "pink");
    }
    // a warning drains while she drives clean (not while she keeps speeding)
    if (L.sus > 0 && controlsOn && !L.chase) L.sus = Math.max(0, L.sus - (speeding() ? 0 : TUNE.susDecay * dt));
    updateTraps(dt, controlsOn);
    updatePatrols(dt, controlsOn);
    updateBolo(dt, controlsOn);
    if (L.chase) updateChase(dt, controlsOn);
    updateFugitive(dt, controlsOn);
    updateRandom(dt, controlsOn);
    // the siren follows the nearest lit cruiser
    let loud = 0, closing = 0;
    const p = ctx.car.pos;
    for (const u of L.units) {
        if (!u.car || !u.siren || !(u.mode === "chase" || u.mode === "pull")) continue;
        const c = u.car, d = Math.hypot(c.x - p.x, c.z - p.z);
        const l = Math.pow(clamp(1 - d / 170, 0, 1), 1.4);
        if (l > loud) {
            loud = l;
            const ux = (p.x - c.x) / (d || 1), uz = (p.z - c.z) / (d || 1);
            closing = (Math.sin(c.h) * c.speed - ctx.car.vx) * ux + (Math.cos(c.h) * c.speed - ctx.car.vz) * uz;
        }
    }
    if (L.chase && loud < 0.15) loud = Math.max(loud, 0.15);
    // with positional audio every lit cruiser is its own located siren (you HEAR it closing
    // from behind-left); the flat one is the fallback before the first gesture / without feel
    X.sirenUpdate(dt, spatialSirens() ? 0 : loud, closing, L.chase && L.chase.bust > 0.3 ? "yelp" : "wail");
}

// ── positional sirens (A.spatial, kinds from features/feel) ──────────────
const SIRENS = [];   // units holding a live spatial siren
const sirenOn = u => !!(u.car && u.car.obj && u.siren && (u.mode === "chase" || u.mode === "pull"));
/** Keep one looping, located siren per lit cruiser. Returns true while they carry the sound. */
export function spatialSirens() {
    const ok = A.spatial.ready && A.spatial.has("siren");
    const yelp = !!(L.chase && L.chase.bust > 0.3);
    if (ok) for (const u of L.units) {
        if (!sirenOn(u) || (u.sp && u.sp.alive)) continue;
        u.sp = A.spatial.loop(yelp ? "sirenYelp" : "siren", u.car.obj, { floor: L.chase ? 0.08 : 0 });
        u.spYelp = yelp;
        if (u.sp && !SIRENS.includes(u)) SIRENS.push(u);
    }
    for (let i = SIRENS.length - 1; i >= 0; i--) {
        const u = SIRENS[i];
        if (!ok || !sirenOn(u) || !u.sp || !u.sp.alive || !L.units.includes(u)) { if (u.sp) u.sp = u.sp.stop(); SIRENS.splice(i, 1); continue; }
        if (u.spYelp !== yelp) { u.spYelp = yelp; u.sp.set(yelp ? YELP : WAIL); }   // closing in: wail → yelp
    }
    return SIRENS.length > 0;
}
const YELP = { kind: "sirenYelp" }, WAIL = { kind: "siren" };

/** Driving HUD: stars, PURSUIT / FUGITIVE tag, meters. */
// ── flavour: somebody else gets pulled over (2D COP_PULLOVER bickering) ──
export function startFlavour() {
    const car = ctx.car;
    const victim = ctx.traffic.cars.find(c => !c.hit && !c.ai && c.dir > 0 && c.s > car.s + 110 && c.s < car.s + 280 && !(c.data && c.data.law));
    if (!victim) return null;
    const u = addUnit(victim.s - 16, victim.d, 1, victim.speed + 4, { mode: "chase" });
    u.mode = "pull"; u.pullD = 7.9; u.stopS = victim.s - 7.5; u.siren = true; u.flavour = victim; u.talkT = 0;
    victim.keep = true;
    victim.ai = (dt, c) => {
        c.dTarget = 7.9;
        c.d += Math.sign(7.9 - c.d) * Math.min(Math.abs(7.9 - c.d), 2 * dt);
        c.speed = Math.max(0, c.speed - 6 * dt);
        c.s += c.speed * dt;
    };
    return u;
}
function updateFlavourUnit(dt, u) {
    const v = u.flavour, car = ctx.car;
    u.stopS = v.s - 7.5;
    const rel = car.s - v.s;
    u.talkT -= dt;
    if (Math.abs(rel) < 60 && u.talkT <= 0 && v.obj) {
        u.talkT = 2.6;
        u.flip = !u.flip;
        UI.bubble("pull" + (u.id || (u.id = Math.random())), u.flip || !u.car ? v.obj : u.car.obj, pick(COP_PULLOVER), { y: 2.3, sec: 2.4 });
    }
    if (rel > 140) { v.keep = false; if (u.car) u.car.keep = false; u.flavour = null; u.mode = "park"; }
}

/**
 * The star HUD says which stage she's in — and how to get out of it (the small hint line):
 *   🚨 PURSUIT (they see her) · 👀 SEARCHING (stars flash: stay out of sight) · 🤫 HIDING (stopped, tucked away)
 *   📞 REPORTED / 🚓 LOOKING FOR YOU (a call-in) · ⚠️ WARNING (petty heat, draining) · ⚠️ WANTED (warrants on file)
 *   😎 LOST 'EM · 🥸 LOW PROFILE (a new look: the warrant file doesn't know her)
 */
export function hud() {
    UI.updateBubbles(ctx.camera);
    const ch = L.chase, f = L.fug, b = L.bolo;
    const lost = L.lost && L.lost.t > ctx.time;
    const fresh = L.lowKey && ctx.time - L.lowKeyT < 4 && S.wanted.length;
    const warrants = S.wanted.length && !L.lowKey;
    const crew = L.crewHud ? L.crewHud() : null;          // 🔗 partners in crime (crew.js)
    if (!ch && !f && !b && !lost && !fresh && L.sus <= 0.04 && L.radar < 0.02 && !warrants && !crew) { UI.wantedHud(null); return; }
    const info = { stars: 0, tag: "", fug: !!f, blink: false, hint: "", meters: [], crew };
    if (f) { info.stars = fugitiveStars(f.t); info.tag = "🔒 FUGITIVE"; info.blink = true; info.spot = ch ? 0 : clamp(f.spot / Math.max(0.7, 1.6 - info.stars * 0.2), 0, 1); info.hint = "the jumpsuit gives you away · Paint & Pray / a disguise"; }
    if (ch) {
        info.stars = Math.max(info.stars, ch.heat);
        info.search = !!ch.searching;
        const hid = ch.searching && ch.hiding;
        info.tag = ch.searching ? (f ? "🔒 FUGITIVE · SEARCHING" : hid ? "🤫 HIDING…" : "👀 SEARCHING…") : (f ? "🔒 FUGITIVE · PURSUIT" : "🚨 PURSUIT");
        info.bust = ch.bust; info.evade = ch.evade; info.blink = !ch.searching;
        info.evadeLabel = hid ? "THEY DRIVE PAST…" : "LOSING THEM…";
        info.hint = !ch.searching ? "break their line of sight" : hid ? "stay put — they're driving past"
            : notHiddenHint() || (ctx.town && ctx.town.active ? "stay out of sight · park at the kerb · pull off the street" : "stay out of sight · pull off & stop · take an exit");
    } else if (lost) { info.tag = "😎 LOST 'EM"; info.cls = "lost"; info.hint = "keep it clean for a bit"; }
    else if (b) {
        if (b.phase === "called") { info.tag = "📞 REPORTED"; info.meters.push([1 - b.t / (b.delay || 10), "🚓 ON ITS WAY", "#FFB74D"]); info.hint = "switch cars, hide, or keep clean"; }
        else { info.tag = hiding() ? "🤫 HIDING…" : "🚓 LOOKING FOR YOU"; info.search = true; info.spot = clamp(b.seeT / TUNE.boloSee, 0, 1); info.meters.push([clamp(1 - b.look / TUNE.boloLook, 0, 1), "THEY GIVE UP…", "#69F0AE"]); info.hint = notHiddenHint() || "out of its sight · pull off & stop · new car"; }
        info.cls = "search";
    } else if (!f && L.sus > 0.04) { info.tag = "⚠️ WARNING"; info.cls = "warn"; info.meters.push([L.sus / TUNE.susWarn, "COOLING OFF…", "#FFD740"]); info.hint = "once more and they chase · drive clean"; }
    else if (!f && warrants) { info.tag = "⚠️ WANTED"; info.spot = clamp(L.wantedSpot / TUNE.warrantSee, 0, 1); info.hint = "patrols know your car · paint it or switch"; }
    else if (!f && fresh) { info.tag = "🥸 LOW PROFILE"; info.cls = "lost"; info.hint = "the warrant file's looking for someone else"; }
    info.radar = ch ? 0 : L.radar;
    UI.wantedHud(info);
}

/** Clear the road side of the law (new run / title). Traffic + actors are cleared by core. */
export function resetRunState() {
    L.chase = null; L.units.length = 0; L.traps.length = 0; L.spawnT = {}; L.grace = 0; L.apbCool = 22;
    L.wantedSpot = 0; L.wantedPatrolT = rand(TUNE.warrantPatrol[0] * 0.5, TUNE.warrantPatrol[1] * 0.5); L.pending = null; L.radar = 0; L.chopper = null; L.flavourT = rand(35, 60); L.threats.clear();
    L.sus = 0; L.susT = -99; L.bolo = null; L.lowKey = false; L.lowKeyT = -99; L.lost = null; L.hint = 0; L.hint2 = 0;

    X.sirenOff();
    UI.wantedHud(null);
}

let modelsAsked = false;
export function ensureCopModels() {
    if (modelsAsked) return;
    modelsAsked = true;
    ensureModels(["copPerson", "lawK9", "lawMissile", "lawChopper", "lawBillboard"]).catch(e => { modelsAsked = false; console.warn("[law] models", e); });
}

/** A unit for scripted scenes: a cruiser that slides up behind Lulu. */
/** Where a pull-over stops (d): the highway's shoulder (7.9) — in a TOWN the right lane's outer edge, beside the parked
 *  row (the town's 7.9 is the sidewalk, through the parked cars): "double-parked with the lights on", Lakewood-style. */
export function pullDAt(s = ctx.car.s) {
    if (!(ctx.town && ctx.town.active)) return travelDir() * 7.9;     // (her side's shoulder — the far one going down the lap)
    const rd = ctx.world.road, p = rd.point(s, 0, {}), n = rd.nearest(p.x, p.z, s, {}), st = n && n.street;
    return st && st.lanes ? Math.max(1.75, st.lanes * 3.5 - 0.9) : 2.6;
}
export function scriptedCruiser(sBehind = 26, d = null, s0 = null) {
    const car = ctx.car;
    const D = travelDir();
    const u = addUnit((s0 != null ? s0 : car.s) - D * sBehind, d == null ? car.d : d, D, Math.max(8, car.speed + 6), { mode: "chase" });
    u.siren = true;
    return u;
}
export { addUnit, toChase, driveUnit };
