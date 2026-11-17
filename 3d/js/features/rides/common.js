// features/rides — shared plumbing: models, maths, who-says-what, a pooled cast of
// townsfolk, the one roadside beacon, and placing set pieces past the built road.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { registerModels, ensureModels, models, cloneWithColors } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { save3d } from "../../core/save.js";
import * as H from "../../hud.js";
import { input, glyph } from "../../input.js";

export const ID = "rides";
/** Random / surprise content (patients, kids, extra traffic): off in ?test unless enabled, off in a 🎉 party. */
export const live = () => ctx.enabled(ID);
/** Nothing of ours runs in a party (the shared, seeded world must stay identical for every friend). */
export const partyOn = () => !!(ctx.party && ctx.party.active);

registerModels({ rides_taxi: "rides_taxi", rides_er: "rides_er", rides_busstop: "rides_busstop", rides_cone: "rides_cone" });
export function need(keys) { return ensureModels(keys); }
export { models, cloneWithColors };

// ── maths ───────────────────────────────────────────────────────────────
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const _p = {};
/** road point (reused object — copy what you need) */
export function pt(s, d, out = _p) { return ctx.world.road.point(s, d, out); }
/** world position of a point in Lulu's car frame: x = to her LEFT, z = forward. */
export function carLocal(x, z, out) {
    const car = ctx.car, h = car.h;
    return out.set(car.pos.x + Math.cos(h) * x + Math.sin(h) * z, 0, car.pos.z - Math.sin(h) * x + Math.cos(h) * z);
}

// ── who says what (respects Settings › Lulu's chatter) ───────────────────
const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";
export function talkOk(big = false) {
    const c = chatter();
    if (c === "quiet") return big && Math.random() < 0.5;
    if (c === "chatty") return true;
    return big || Math.random() < 0.7;
}
/** Lulu's one-liner (banter's bubble). */
export function luluSays(text, big = false) {
    if (!text || ctx.skipping || !talkOk(big)) return false;
    try { return !!(ctx.banter && ctx.banter.say && ctx.banter.say(text)); } catch (e) { console.error("[rides] say", e); return false; }
}
/** Someone else's bubble over an Object3D. cls: "nice" | "angry" | "cop" | "kid" | "truck". */
export function bubble(text, obj, { cls = "nice", y = 2.2, dur = 2.4, always = true } = {}) {
    if (!text || !obj || ctx.skipping || (!always && !talkOk(false))) return false;
    try { return !!(ctx.banter && ctx.banter.bubble && ctx.banter.bubble(text, obj, { cls, y, dur })); } catch (e) { console.error("[rides] bubble", e); return false; }
}
export const toast = (text, cls = "", key = null) => H.toast(text, cls, key ? { key } : {});
export const stat = (id, n = 1) => emit("stat", { id, n });

// ── a pooled cast (townsfolk for patients, riders, kids) ─────────────────
const TOPS = ["#81C784", "#4FC3F7", "#FFB74D", "#F06292", "#9575CD", "#FFFFFF", "#E57373", "#4DB6AC", "#FFD54F"];
const BOTTOMS = ["#37474F", "#283593", "#212121", "#5D4037", "#1565C0", "#455A64"];
const HAIRS = ["#4E342E", "#3E2723", "#1A1A1A", "#8D6E63", "#D7B56D", "#BDBDBD"];
const POOL = new Map();          // model key → [Person] (free)
/** A person from the pool (null until the model is loaded). Add `.obj` to the scene yourself? No: we do. */
export function borrowPerson(key) {
    if (!models[key]) return null;
    const free = POOL.get(key);
    let p = free && free.pop();
    if (!p) {
        p = spawnPerson(key, { colors: key === "copPerson" ? null : { Top: pick(TOPS), Bottom: pick(BOTTOMS), Hair: pick(HAIRS) } });
        p.key = key;
        p.obj.rotation.order = "YXZ";
    }
    p.obj.rotation.set(0, 0, 0);
    p.obj.position.set(0, 0, 0);
    p.obj.visible = true;
    ctx.scene.add(p.obj);
    return p;
}
export function returnPerson(p) {
    if (!p) return;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    if (p.held && p.held.parent) p.held.parent.remove(p.held);
    p.held = null;
    if (!POOL.has(p.key)) POOL.set(p.key, []);
    POOL.get(p.key).push(p);
}

// ── the beacon: one soft light column over the current objective ─────────
let beacon = null;
function makeBeacon() {
    const c = document.createElement("canvas");
    c.width = 4; c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.55, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0.9)");
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, color: "#FF5252", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.85 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 14, 16, 1, true), mat);
    m.position.y = 7;
    const g0 = new THREE.Group();
    g0.add(m);
    g0.userData.mat = mat;
    g0.visible = false;
    return g0;
}
export const beam = {
    /** Show the column at (x, z) in a colour. */
    show(x, z, color = "#FF5252") {
        if (!beacon) beacon = makeBeacon();
        if (!beacon.parent) ctx.scene.add(beacon);
        beacon.position.set(x, 0, z);
        beacon.userData.mat.color.set(color);
        beacon.visible = true;
    },
    pulse(t) { if (beacon && beacon.visible) beacon.userData.mat.opacity = 0.6 + Math.sin(t * 4) * 0.25; },
    hide() { if (beacon) { beacon.visible = false; if (beacon.parent) beacon.parent.remove(beacon); } },
    get on() { return !!(beacon && beacon.visible); },
};

// ── prompts ─────────────────────────────────────────────────────────────
/** The trick's button for prompts: "hold L1" / "X" ("" on touch: it has its own button). */
export function trickGlyph() { return input.device === "touch" ? "" : glyph("rideAct"); }
/** The horn, inside a sentence. */
export function hornGlyph() { return input.device === "touch" ? "<b>HONK</b>" : glyph("honk"); }
/** The trick, inside a sentence: "hold L1" on a pad, "X" on a keyboard, "the 🚨 button" on touch. */
export function trickWords(emoji = "⭐") { return input.device === "touch" ? `the ${emoji} button` : glyph("rideAct"); }

// ── placing a set piece where the scenery hasn't been built yet ──────────
/** First s ≥ car.s + minAhead past the built road where the roadside (side, dMin..dMax) is free. */
export function slotAhead(minAhead, side, dMin, dMax, len = 30) {
    let built = 0;
    for (const ch of ctx.world.activeChunks()) built = Math.max(built, ch.s1 || (ch.s0 + 200));
    let s = Math.max(ctx.car.s + minAhead, built + len + 10);
    for (let i = 0; i < 12; i++) {
        let ok = true;
        for (let k = -len; k <= len && ok; k += 6) if (ctx.world.isReserved(s + k, side * (dMin + dMax) / 2)) ok = false;
        if (ok) break;
        s += 70;
    }
    return s;
}
