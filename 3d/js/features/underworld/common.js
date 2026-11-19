// features/underworld — shared state + small helpers: the save, dice, models, speech bubbles,
// Lulu's lines, coins in / out, a roadside pull-in pad, timers on game time.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { store, saveSoon, wallet, save3d } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { registerModels, ensureModels, models, cloneWithColors, findNodes } from "../../models.js";
import { registerKind } from "../../traffic.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { ID, SPAWN, RATES, TUNE } from "./data.js";

// ── models (all lazy: loaded the first time something needs them) ─────────
registerModels({
    uw_krupnik: "underworld_krupnik", uw_velvel: "underworld_velvel", uw_fixer: "underworld_fixer",
    uw_pickpocket: "underworld_pickpocket", uw_goon: "underworld_goon", uw_rager: "underworld_rager",
    uw_gangcar: "underworld_gangcar", uw_shack: "underworld_shack", uw_package: "underworld_package",
    uw_kugelcan: "underworld_kugelcan",
});
// the bad guys' cars are ordinary traffic cars with our own AI
registerKind("underworld_rager", { len: 5.6, halfW: 1.05, circles: [1.7, 0, -1.7], r: 1.05, mass: 2.0, model: "uw_rager" });
registerKind("underworld_gangcar", { len: 5.0, halfW: 0.98, circles: [1.5, -1.5], r: 1.0, mass: 1.4, model: "uw_gangcar" });
export const SEATS = { underworld_rager: { x: 0.45, y: 0.5, z: -0.05 }, underworld_gangcar: { x: 0.42, y: 0.0, z: 0.1 }, cop: { x: 0.5, y: 0.12, z: 0.05 } };
export { models, cloneWithColors, findNodes };

/** Load models; resolves false (never throws). */
export async function need(keys) {
    try { await ensureModels(keys); return keys.every(k => !!models[k]); } catch (e) { console.warn("[underworld] models", e); return false; }
}

// ── the save (3D-only: heat, rivals, settings, lifetime numbers) ──────────
export const SAVE = store(ID, { heat: 0, at: 0, rate: "normal", rivals: [], owed: 0, stats: {}, seen: {} });
if (!Array.isArray(SAVE.rivals)) SAVE.rivals = [];
if (!SAVE.stats || typeof SAVE.stats !== "object") SAVE.stats = {};
if (!SAVE.seen || typeof SAVE.seen !== "object") SAVE.seen = {};
export const dirty = () => saveSoon();

// ── the per-run state every module shares ─────────────────────────────────
export const UW = {
    enc: null,            // the live bad-guy encounter { kind, … } (rager | gang | pickpocket) — at most one
    nextT: 0,             // s until the scheduler may roll the next encounter
    runT: 0,              // s of this run (driving + walking)
    offer: null,          // a roadside offer up the road (Krupnik's cruiser / Velvel's shack)
    crookCool: 0,         // ctx.time before Krupnik offers again
    lastHeat: 0,          // the stars of the chase that just ended (a pull-over offer only from a petty one)
    hot: null,            // Velvel's parts / paint were hot: { why, seeT, coolT }
    flatBy: null,         // the rival who gave her a flat (Chaverim tie-in)
    force: {},            // tests: { sting: true|false, hot: true|false, offer: true }
    log: [],              // tests: what happened
};
export function log(ev, data = {}) { UW.log.push(Object.assign({ ev, t: +ctx.time.toFixed(2) }, data)); if (UW.log.length > 120) UW.log.shift(); emit("underworld:" + ev, data); }

// ── dice ──────────────────────────────────────────────────────────────────
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
/** The Settings multiplier × the SPAWN.rate knob. */
export const rate = () => (RATES[SAVE.rate] ?? 1) * (SPAWN.rate ?? 1);
/** A chance scaled by the rate (capped). */
export const chance = p => Math.random() < Math.min(0.97, p * rate());
/** In a 🎉 party only the underworld's PERSONAL bit runs: the 🫳 pickpocket on foot (a scene prop, her own wallet,
 *  the coins always come home; the Shomrim who jog after him are hers too) — on a 🏡 Road Trip / 🌍 Free Roam run, never
 *  while a party game (a race / dash / tag / a Free Roam game she's in) is on. The bad-guy CARS (a local car in the
 *  shared traffic), Krupnik's / Velvel's roadside stops, the Fixer's jobs and the street's heat stay solo: ARCHITECTURE ›
 *  the party parity table says what they'd need. */
export const PARTY_OK = new Set(["pickpocket"]);
export const inParty = () => !!(ctx.party && ctx.party.active);
export function partyFree() {
    const pt = ctx.party, G = ctx.G;
    if (!pt || !pt.active || !G || G.mode !== "party") return false;
    const k = pt.activity && pt.activity.k;
    if (k !== "trip" && k !== "roam") return false;
    const ow = ctx.openworld, g = ow && ow.debug && ow.debug.getG ? ow.debug.getG() : null;
    return !(g && g.ph === "go" && Array.isArray(g.ps) && g.ps.includes(pt.uid));
}
/** Is the underworld on right now? (?test opt-in, Settings not Off; in a 🎉 party only `what` ∈ PARTY_OK.) */
export const live = (what = "") => ctx.enabled(ID) && (!inParty() || (PARTY_OK.has(what) && partyFree())) && rate() > 0;
export const inTown = () => !!(ctx.town && ctx.town.active);
export const onFoot = () => !!(ctx.foot && ctx.foot.active);
export const mode = () => (ctx.G && ctx.G.mode) || "";
export const calm = () => { try { return !!(ctx.meta && ctx.meta.calm && ctx.meta.calm()) || !!(ctx.G && ctx.G.tutorial); } catch (e) { return false; } };
export const chasing = () => !!(ctx.law && (ctx.law.chasing || ctx.law.fugitive));
export const stars = () => (ctx.law && ctx.law.wanted) || 0;

// ── stats ─────────────────────────────────────────────────────────────────
export function stat(id, n = 1) {
    SAVE.stats[id] = (SAVE.stats[id] || 0) + n;
    dirty();
    emit("stat", { id, n });
}

// ── coins (taken coins are capped and always come back) ──────────────────
export function coins() { return wallet.coins; }
/** Take up to n coins (never more than TUNE.coinCap). → what was taken. */
// (like law's fines: out of the WALLET only — the run's coin counter never goes negative)
export function takeCoins(n, why) {
    const k = Math.max(0, Math.min(Math.round(n), TUNE.coinCap, wallet.coins));
    if (k > 0 && !wallet.spend(k)) return 0;
    if (k > 0) log("coins", { n: -k, why });
    return k;
}
/** Give coins back (a refund: not counted as earnings). */
export function refund(n, why = "refund") {
    if (!(n > 0)) return 0;
    wallet.add(n);
    log("coins", { n, why });
    return n;
}
/** Pay for something (a bribe, a paint job). → bool */
export function pay(n, why) {
    if (wallet.coins < n || !wallet.spend(n)) return false;
    log("coins", { n: -n, why });
    return true;
}
export function earn(n, why) { if (n > 0) addCoins(n, why); return n; }

// ── talking ───────────────────────────────────────────────────────────────
const chatter = () => { try { return (save3d.settings && save3d.settings.chatter) || "normal"; } catch (e) { return "normal"; } };
/** Lulu says something: in the car a banter bubble, on foot over her head. */
export function lulu(text, force = false) {
    if (!text || ctx.skipping) return false;
    if (!force && chatter() === "quiet" && Math.random() < 0.6) return false;
    try {
        if (onFoot() && ctx.foot.obj && ctx.foot.say) return !!ctx.foot.say(ctx.foot.obj, text, 2.6);
        if (ctx.banter && ctx.banter.say) return !!ctx.banter.say(text);
    } catch (e) { /* no banter */ }
    return false;
}
/** A speech bubble over anyone / any car. cls: angry | nice | cop | kid. */
export function bubble(text, obj, { dur = 2.8, y = 2.3, cls = "angry" } = {}) {
    if (!text || !obj || ctx.skipping) return false;
    try {
        if (ctx.banter && ctx.banter.bubble && ctx.banter.bubble(text, obj, { dur, y, cls })) return true;
        if (onFoot() && ctx.foot.say) return !!ctx.foot.say(obj, text, dur);
    } catch (e) { /* no banter */ }
    return false;
}
export function toast(text, cls = "", key = "") { H.toast(text, cls, key ? { key } : undefined); }
export function banner(title, sub = "", ms = 2600, key = "underworld") { H.banner(`<b>${title}</b>${sub ? `<small>${sub}</small>` : ""}`, ms, { key, prio: 2 }); }

// ── people ────────────────────────────────────────────────────────────────
/** A person (with a fallback model). → Person or null */
export function person(key, colors = null, fallback = "npcMan") {
    const k = models[key] ? key : models[fallback] ? fallback : null;
    if (!k) return null;
    const p = spawnPerson(k, { colors });
    p.key = k;
    return p;
}
/** Sit a person in a traffic car's driver seat. */
export function seatIn(car, p) {
    if (!p || !car) return null;
    const s = SEATS[car.kind] || SEATS.cop;
    p.obj.position.set(s.x, s.y, s.z);
    p.obj.rotation.set(0, 0, 0);
    p.update(0, { sit: true });
    car.obj.add(p.obj);
    return p;
}
export function drop(obj) { if (obj && obj.parent) obj.parent.remove(obj); }

/** Restyle a pooled traffic car's Paint (undone in its onRemove): → undo list. */
export function paintCar(car, hex) {
    const undo = [];
    car.obj.traverse(o => {
        if (!o.isMesh || !o.material || o.material.name !== "Paint") return;
        const m = o.material.clone();
        m.color.set(hex);
        undo.push([o, o.material, m]);
        o.material = m;
    });
    return () => { for (const [o, orig, m] of undo) { o.material = orig; m.dispose(); } };
}

// ── road helpers ──────────────────────────────────────────────────────────
const _p = {};
export function pt(s, d) { return ctx.world.road.point(s, d, _p); }
export function carDist(x, z) { const c = ctx.car.pos; return Math.hypot(x - c.x, z - c.z); }
/** Lulu's top speed without nitro (m/s) for the car she's in. */
export function luluTop() {
    const st = ctx.car && ctx.car.stats;
    return 42 * ((st && st.top) || 1) * 0.88;
}
/** The first spot ≥ min metres ahead whose chunks aren't built (so reserve() keeps the trees away). */
export function unbuiltAhead(min, half = 20) {
    const w = ctx.world, C = 200;
    let s = ctx.car.s + min;
    for (let i = 0; i < 12 && w && w.chunks && (w.chunks.has(Math.floor((s - half) / C)) || w.chunks.has(Math.floor((s + half) / C))); i++) s += 40;
    return s;
}
export function reserve(s0, s1, side, dMin, dMax) {
    const w = ctx.world;
    if (!w || !w.reserve) return () => {};
    w.reserve(s0, s1, side, dMin, dMax);
    const r = w.reserved[w.reserved.length - 1];
    return () => { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); };
}

// ── a glowing pull-in pad (Krupnik's shoulder, Velvel's apron) ─────────────
let padGeo = null, ringGeo = null, colGeo = null;
export function makePad(color = "#FFCA28", r = 3.2) {
    if (!padGeo) {
        padGeo = new THREE.CircleGeometry(1, 36); padGeo.rotateX(-Math.PI / 2);
        ringGeo = new THREE.RingGeometry(0.86, 1, 36); ringGeo.rotateX(-Math.PI / 2);
        colGeo = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true); colGeo.translate(0, 0.5, 0);
    }
    const base = { color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false };
    const mPad = new THREE.MeshBasicMaterial(Object.assign({ opacity: 0.22 }, base));
    const mRing = new THREE.MeshBasicMaterial(Object.assign({ opacity: 0.7 }, base));
    const mCol = new THREE.MeshBasicMaterial(Object.assign({ opacity: 0.16, side: THREE.DoubleSide }, base));
    const g = new THREE.Group();
    const pad = new THREE.Mesh(padGeo, mPad), ring = new THREE.Mesh(ringGeo, mRing), col = new THREE.Mesh(colGeo, mCol);
    pad.scale.setScalar(r); ring.scale.setScalar(r); col.scale.set(r * 0.85, 7, r * 0.85);
    pad.position.y = 0.04; ring.position.y = 0.05;
    g.add(pad, ring, col);
    g.userData.tick = t => { mRing.opacity = 0.45 + 0.3 * Math.sin(t * 4); mCol.opacity = 0.1 + 0.06 * Math.sin(t * 2.3); ring.scale.setScalar(r * (1 + 0.06 * Math.sin(t * 4))); };
    g.userData.dispose = () => { mPad.dispose(); mRing.dispose(); mCol.dispose(); };
    return g;
}

// ── game-time timers (skip-safe; cleared at run start) ────────────────────
const timers = [];
export function later(sec, fn) { timers.push({ t: ctx.time + sec, fn }); }
export function tickTimers() {
    for (let i = timers.length - 1; i >= 0; i--) {
        if (ctx.time < timers[i].t) continue;
        const { fn } = timers.splice(i, 1)[0];
        try { fn(); } catch (e) { console.error("[underworld] timer", e); }
    }
}
export function clearTimers() { timers.length = 0; }

// ── traffic removal outside traffic.update's own loop ────────────────────
const pendingRemove = [];
export function removeCar(c) { if (c) pendingRemove.push(c); }
export function flushRemovals() {
    while (pendingRemove.length) { const c = pendingRemove.shift(); if (ctx.traffic.cars.includes(c)) ctx.traffic.remove(c); }
}
