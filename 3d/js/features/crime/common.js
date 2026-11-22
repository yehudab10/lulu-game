// features/crime — shared state + helpers: the save (per-day caps), who's watching (the law's units + the town's
// patrol car, line of sight), the on-foot ⚠️ look → foot chase rule, coins, bubbles, cheap props, people.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, emit } from "../../core/ctx.js";
import { store, saveSoon, save3d } from "../../core/save.js";
import { addCoins } from "../../core/driving.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { ID, PAY, TUNE, LINES } from "./data.js";

export { models };

// ── the save: per-REAL-day caps, lifetime numbers, what characters remember ──
export const SAVE = store(ID, { day: "", paid: {}, rides: 0, stats: {}, mem: {} });
if (!SAVE.paid || typeof SAVE.paid !== "object") SAVE.paid = {};
if (!SAVE.stats || typeof SAVE.stats !== "object") SAVE.stats = {};
if (!SAVE.mem || typeof SAVE.mem !== "object") SAVE.mem = {};
export const dirty = () => saveSoon();
export function today() { const d = ctx.crime && ctx.crime.debug && ctx.crime.debug.day ? ctx.crime.debug.day : new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
function rollDay() { const t = today(); if (SAVE.day !== t) { SAVE.day = t; SAVE.paid = {}; SAVE.rides = 0; dirty(); } }
/** Coins already paid today for `kind`. */
export function paidToday(kind) { rollDay(); return SAVE.paid[kind] || 0; }
/**
 * Pay up to `want` coins for `kind`, never past its per-day cap (`cap`). → coins actually paid.
 * (addCoins: earnings → the shared wallet + the run's coin counter.)
 */
export function payCapped(kind, want, cap) {
    rollDay();
    const k = Math.max(0, Math.min(Math.round(want), cap - (SAVE.paid[kind] || 0)));
    if (k > 0) { SAVE.paid[kind] = (SAVE.paid[kind] || 0) + k; addCoins(k, "crime:" + kind); dirty(); }
    log("pay", { kind, want: Math.round(want), paid: k });
    return k;
}

// ── per-run state every module shares ─────────────────────────────────────
export const CR = {
    town: "",            // the town the street pieces are built for
    sus: {},             // on-foot ⚠️ looks: kind → ctx.time it expires
    log: [],             // tests: what happened
    force: {},           // tests: { cop: true | false } — who's watching
};
export function log(ev, data = {}) { CR.log.push(Object.assign({ ev, t: +ctx.time.toFixed(2) }, data)); if (CR.log.length > 160) CR.log.shift(); emit("crime:" + ev, data); }
export function stat(id, n = 1) { SAVE.stats[id] = (SAVE.stats[id] || 0) + n; dirty(); emit("stat", { id, n }); }

// ── when crime is on ──────────────────────────────────────────────────────
export const inParty = () => !!(ctx.party && ctx.party.active);
export const inTown = () => !!(ctx.town && ctx.town.active);
export const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
export const walking = () => onFoot() && ctx.foot.phase === "walk";
const mode = () => (ctx.G && ctx.G.mode) || "";
/** Solo first: a Cruise (▶ PLAY) / Story run IN A TOWN, never in a party (partners' crimes for two cover friends), never Dina. */
export function live() {
    if (!ctx.enabled(ID) || inParty() || !inTown()) return false;
    if (!/^(cruise|story)$/.test(mode())) return false;
    if (ctx.G && ctx.G.tutorial) return false;
    return true;
}
export const chasing = () => !!(ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || !!(ctx.foot && ctx.foot.chasing);

// ── who's watching ────────────────────────────────────────────────────────
/** A cop with a clear view of (x, z) within r: the law's own units / traps, or the town's patrol car. → {x, z} | null */
export function copWatching(x, z, r = TUNE.copSight) {
    if (CR.force.cop === false) return null;
    if (CR.force.cop === true) return { x: x + 18, z: z + 4 };
    const law = ctx.law;
    try { if (law && law.copSees && law.copSees(x, z, r)) return { x, z, law: true }; } catch (e) { /* no law */ }
    const T = ctx.town, pat = T && T.debug && T.debug.C && T.debug.C.patrol;
    if (pat && !pat.hit && ctx.traffic.cars.includes(pat)) {
        const d = Math.hypot(pat.x - x, pat.z - z);
        if (d < r && (d < 12 || !(T.blocksSight && T.blocksSight(pat.x, pat.z, x, z)))) return { x: pat.x, z: pat.z, patrol: pat };
    }
    return null;
}

/**
 * A petty thing she did ON FOOT that a cop may have seen: the first is a ⚠️ look (a line over the cop / a banner), another
 * of the same kind while that look is live (TUNE.susLife) is a foot chase with the charge. Nobody watching = nothing.
 * → "" | "warn" | "chase"
 */
export function footCrime(kind, charge, at) {
    if (!onFoot() || chasing()) return "";
    const cop = copWatching(at.x, at.z);
    if (!cop) return "";
    const live = (CR.sus[kind] || 0) > ctx.time;
    if (!live) {
        CR.sus[kind] = ctx.time + TUNE.susLife;
        H.banner(`<b>${pick(LINES.warn[kind] || ["🚓 \"I saw that.\""])}</b><small>${charge.toLowerCase()} · once more and he chases</small>`, 2400, { key: "crime:warn", prio: 2 });
        log("warn", { kind, charge });
        return "warn";
    }
    CR.sus[kind] = 0;
    let ok = false;
    try { ok = !!(ctx.foot && ctx.foot.startChase && ctx.foot.startChase({ x: cop.x, z: cop.z }, { charges: [charge] })); } catch (e) { console.error("[crime] chase", e); }
    if (ok) { H.banner(`<b>${LINES.chase[kind] || "🚨 BUSTED!"}</b><small>${charge.toLowerCase()} · RUN!</small>`, 2400, { key: "crime:warn", prio: 3 }); stat("crimeChases"); }
    log("chase", { kind, charge, ok });
    return ok ? "chase" : "";
}

// ── dice + talking ────────────────────────────────────────────────────────
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const chatter = () => { try { return (save3d.settings && save3d.settings.chatter) || "normal"; } catch (e) { return "normal"; } };
/** Lulu says something: on foot over her head, in the car a banter line. */
export function lulu(text, force = false) {
    if (!text || ctx.skipping) return false;
    if (!force && chatter() === "quiet" && Math.random() < 0.6) return false;
    try {
        if (onFoot() && ctx.foot.obj && ctx.foot.say) return !!ctx.foot.say(ctx.foot.obj, text, 2.4);
        if (ctx.banter && ctx.banter.say) return !!ctx.banter.say(text);
    } catch (e) { /* no banter */ }
    return false;
}
/** A speech bubble over anyone (cls: "" | "cop" | "kid" | "nice" | "angry"). Never a toast (the pop-up budget). */
export function bubble(text, obj, { dur = 2.4, y = 2.1, cls = "" } = {}) {
    if (!text || !obj || ctx.skipping) return false;
    try {
        if (ctx.banter && ctx.banter.bubble && ctx.banter.bubble(text, obj, { dur, y, cls: cls || "angry" })) return true;
        if (ctx.foot && ctx.foot.say) return !!ctx.foot.say(obj, text, dur, { cls: cls === "cop" ? "cop" : "" });
    } catch (e) { /* none */ }
    return false;
}
/** The ONE must-see line a crime gets (its payout / its bust) — everything else is bubbles. */
export function mustSee(text, cls = "gold", key = "crime") { H.toast(text, cls, { prio: 3, key }); }

// ── people + models (lazy) ────────────────────────────────────────────────
export async function need(keys) {
    try { await ensureModels(keys); return keys.every(k => !!models[k]); } catch (e) { console.warn("[crime] models", e); return false; }
}
export function person(key, colors = null, fallback = "npcMan") {
    const k = models[key] ? key : models[fallback] ? fallback : null;
    if (!k) return null;
    const p = spawnPerson(k, { colors });
    p.key = k;
    return p;
}
export function drop(obj) { if (obj && obj.parent) obj.parent.remove(obj); }

// ── cheap props: plain boxes baked into ONE vertex-coloured mesh (1 draw call) ──
let bakedMat = null;
export function bakeBoxes(parts, owned) {
    // parts: [{ w, h, d, x, y, z, ry?, color }]
    const geos = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const c = new THREE.Color();
    for (const b of parts) {
        const g = new THREE.BoxGeometry(b.w, b.h, b.d);
        e.set(b.rx || 0, b.ry || 0, b.rz || 0); q.setFromEuler(e); p.set(b.x || 0, b.y || 0, b.z || 0);
        g.applyMatrix4(m.compose(p, q, s));
        c.set(b.color || "#999999");
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        geos.push(g);
    }
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (owned) owned.push(merged);
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 });
    const mesh = new THREE.Mesh(merged, bakedMat);
    mesh.castShadow = false; mesh.receiveShadow = true;
    return mesh;
}

// ── town geometry ─────────────────────────────────────────────────────────
const _n = {};
/** Where (x, z) is on the town's streets: { st (the street), s, d (signed, from the centre line), along, curb, walk, mid (m from the nearest crossing) } | null. */
export function streetAt(x, z, hint) {
    const road = ctx.world && ctx.world.road;
    if (!road || !road.town || !inTown()) return null;
    const n = road.nearest(x, z, hint, _n);
    const st = n.street;
    if (!st) return null;
    const along = n.s - st.base;
    let mid = 1e9;
    for (const cr of st.cross) mid = Math.min(mid, Math.abs(cr.a - along));
    return { st, s: n.s, d: n.d, along, curb: st.curb, walk: st.walk, mid, h: n.h };
}
/** A named town spot (ctx.town.spot) — the first of `keys` this town has — moved u m along its face and n m out. */
export function townSpot(keys, u = 0, n = 0) {
    const T = ctx.town;
    if (!T || !T.spot) return null;
    for (const k of keys) {
        const sp = T.spot(k);
        if (!sp) continue;
        const rot = sp.rot || 0;
        const nx = sp.nx != null ? sp.nx : Math.sin(rot), nz = sp.nz != null ? sp.nz : Math.cos(rot);
        const ux = sp.ux != null ? sp.ux : Math.cos(rot), uz = sp.uz != null ? sp.uz : -Math.sin(rot);
        return { key: k, x: sp.x + ux * u + nx * n, z: sp.z + uz * u + nz * n, nx, nz, ux, uz, yaw: Math.atan2(nx, nz) };
    }
    return null;
}
export function luluPos() { return onFoot() && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos; }
export { PAY, TUNE, LINES };
