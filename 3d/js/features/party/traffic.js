// features/party — deterministic traffic: the SAME cars, in the same lanes, at
// the same places at the same PARTY time on every screen. No per-client AI,
// no randomness, no state: each lane is an endless conveyor of slots moving
// at that lane's speed, and slot k holds a car (or not) by a hash of the
// activity seed. A car's position is a pure function of the party clock:
//     s(t) = u_k + dir · v_lane · t
// so a late joiner, a reconnect or a slow phone all agree to the centimetre.
// Cars are immune: a bump bounces the PLAYER, never the traffic (a traffic car
// knocked into a spin on one screen only would split the worlds apart).
// In our direction no car exists on or behind the grid during the countdown
// (u_k ≥ U0), so nobody is ever rear-ended on the grid.
import { ctx } from "../../core/ctx.js";
import { models } from "../../models.js";
import { clock } from "./net.js";

const LANES = [
    { d: 5.25, dir: 1, v: 16, slot: 60, p: 0.42 },     // our slow lane
    { d: 1.75, dir: 1, v: 21.5, slot: 64, p: 0.36 },   // our fast lane
    { d: -1.75, dir: -1, v: 21, slot: 72, p: 0.38 },   // oncoming
    { d: -5.25, dir: -1, v: 17.5, slot: 80, p: 0.34 },
];
const KINDS = [["sedan", 0.58], ["van", 0.28], ["truck", 0.14]];
const PAINTS = ["#42A5F5", "#FFFFFF", "#FFCA28", "#66BB6A", "#EF5350", "#8D6E63", "#26C6DA", "#263238", "#FF8A65", "#BA68C8"];
const BEHIND = 160, AHEAD = 720;

function h32(a, b, c) {
    let h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0x632BE5AB, 0xC2B2AE35) ^ Math.imul(c + 0x27D4EB2F, 0x165667B1);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
}

export const PT = { seed: 1, U0s: 0, t0: 0, on: false, cars: new Map(), t: 0, gone: new Set() };
/** Cars only THIS screen has, which the party sync must leave alone: her parked car (foot), her own cops (law),
 *  a party car she's jacking (streets), anything a feature marks data.local. Everything else that isn't a
 *  party car is a stray random spawn and goes. */
export const localCar = c => !!(c.data && (c.data.local || c.data.footStub || c.data.law || c.data.streetsJack || c.data.streetsHold));

/** Configure for an activity: seed, GO time (party ms) and the start line s (nothing of ours behind it at GO). */
export function configure(seed, t0ms, startS) {
    PT.seed = seed >>> 0; PT.t0 = t0ms / 1000; PT.startS = startS;
    PT.gone.clear();
    clearTraffic();
    if (ctx.traffic) ctx.traffic.config.enabled = false;   // before the first frame: the core spawner must never add a local-only car
}

/** The car in lane L slot k, or null. Pure. */
function slotCar(Li, k) {
    const L = LANES[Li];
    const r = h32(PT.seed, Li * 7919 + 13, k);
    if (r >= L.p) return null;
    const r2 = h32(PT.seed ^ 0x51ED27, Li, k), r3 = h32(PT.seed, Li + 101, k * 3 + 1), r4 = h32(PT.seed + 77, Li, k * 5 + 2);
    const u = k * L.slot + (r2 - 0.5) * (L.slot - 32);
    // nothing of ours on (or behind) the grid during the countdown: at GO − 8 s the
    // rearmost car is already 40 m past the front row, and it only pulls away from there
    if (L.dir > 0 && u + L.v * (PT.t0 - 8) < PT.startS + 40) return null;
    let kind = "sedan", acc = 0;
    for (const [kk, w] of KINDS) { acc += w; if (r3 < acc) { kind = kk; break; } }
    const v = L.v;   // one speed per lane: the conveyor never closes up
    return { key: Li + ":" + k, lane: Li, k, u, v, d: L.d, dir: L.dir, kind, paint: PAINTS[Math.floor(r4 * PAINTS.length)] };
}

/** Every party car with s in [s0, s1] at party time T (ms). Pure — the test compares screens with it. */
export function trafficAt(Tms, s0, s1) {
    const t = Tms / 1000, out = [];
    LANES.forEach((L, Li) => {
        // s = u + dir·v·t  →  u ∈ [s0 − dir·v·t, s1 − dir·v·t] (a little slack for trucks' slower v)
        const a = s0 - L.dir * L.v * t - 60, b = s1 - L.dir * L.v * t + 60;
        for (let k = Math.floor(a / L.slot); k <= Math.ceil(b / L.slot); k++) {
            const c = slotCar(Li, k);
            if (!c) continue;
            const s = c.u + c.dir * c.v * t;
            if (s >= s0 && s <= s1) out.push({ key: c.key, s, d: c.d, kind: c.kind, dir: c.dir, v: c.v, paint: c.paint });
        }
    });
    return out;
}

// ── keeping ctx.traffic in step ──────────────────────────────────────────
const paintCache = new Map();
function paintCar(obj, kind, hex) {
    obj.traverse(o => {
        if (!o.isMesh || o.material.name !== "Paint") return;
        const key = kind + hex;
        let m = paintCache.get(key);
        if (!m) { m = o.material.clone(); m.name = "Paint"; m.color.set(hex); paintCache.set(key, m); }
        o.material = m;
    });
}
function ai(dt, c) {
    const D = c.data;
    c.s = D.u + c.dir * D.v * PT.t;
    c.d = c.dTarget = D.lane;
    c.speed = D.v;
    D.at = PT.tms;
}

/**
 * Per frame while the party drives: add the cars that should be within
 * [s − 160, s + 720] of `aroundS`, drop the ones that left. Call before
 * ctx.traffic.update (we drive from hooks.update, so the newcomers are
 * placed right away by traffic.add and updated next frame).
 */
export function syncTraffic(aroundS) {
    const tr = ctx.traffic;
    if (!tr || !models.sedan) return;
    PT.on = true;
    tr.config.enabled = false;
    PT.tms = clock(); PT.t = PT.tms / 1000;
    const want = trafficAt(PT.tms, aroundS - BEHIND, aroundS + AHEAD);
    const keep = new Set();
    for (const w of want) {
        keep.add(w.key);
        if (PT.cars.has(w.key) || PT.gone.has(w.key)) continue;
        const [Li, k] = w.key.split(":").map(Number);
        const c = tr.add(w.kind, w.s, w.d, w.dir, w.v, {
            ai, keep: true, immune: true,
            data: { party: w.key, u: slotCar(Li, k).u, v: w.v, lane: w.d, at: PT.tms },
            onRemove: car => { if (PT.cars.get(car.data.party) === car) PT.cars.delete(car.data.party); },
        });
        paintCar(c.obj, w.kind, w.paint);
        c.onCrash = () => false;          // a bump never costs a heart in a party
        PT.cars.set(w.key, c);
    }
    for (const [key, c] of PT.cars) if (!keep.has(key)) { PT.cars.delete(key); tr.remove(c); }
    // anything that isn't ours (a stray random spawn) would exist on ONE screen only
    for (let i = tr.cars.length - 1; i >= 0; i--) { const c = tr.cars[i]; if ((!c.data || !c.data.party) && !localCar(c)) tr.remove(c); }
}

/** Not driving (spectating / podium): still place our cars where the clock says. */
export function placeOnly(aroundS, dt) {
    syncTraffic(aroundS);
    for (const c of PT.cars.values()) { ai(dt, c); ctx.traffic.place(c, dt); }
}

export function clearTraffic() {
    const tr = ctx.traffic;
    for (const c of PT.cars.values()) { if (tr) tr.remove(c); }
    PT.cars.clear();
}

/** Back to normal random traffic (the party is over). */
export function releaseTraffic() {
    clearTraffic();
    PT.on = false;
    if (ctx.traffic) ctx.traffic.config.enabled = true;
}

/**
 * A party car leaves the shared traffic for good (it was carjacked): every screen drops key `key`
 * (the jacker's own screen keeps the car object — it's hers now, a local car). Returns that car or null.
 */
export function goneCar(key, keepIt = false) {
    if (typeof key !== "string" || key.length > 40) return null;
    PT.gone.add(key);
    const c = PT.cars.get(key) || null;
    if (!c) return null;
    PT.cars.delete(key);
    if (keepIt) { c.data.party = null; c.data.local = true; c.data.wasParty = key; c.onRemove = null; return c; }
    ctx.traffic.remove(c);
    return c;
}

/** Live cars as the screen shows them: [{key, s, d, at (party ms of that position)}]. */
export function trafficLive() {
    return [...PT.cars.values()].map(c => ({ key: c.data.party, s: c.s, d: c.d, at: c.data.at }));
}

/** Is lane d near s clear of party traffic at party time T (for slotting a late joiner in)? */
export function laneClear(s, d, Tms, gap = 22) {
    for (const c of trafficAt(Tms, s - gap, s + gap)) if (Math.abs(c.d - d) < 2) return false;
    return true;
}
