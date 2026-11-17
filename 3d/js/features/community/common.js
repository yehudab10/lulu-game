// features/community — shared bits: the feature's state, models, pooled people, a
// game-time flow helper (beats survive ⏭ skip), light bars, speech bubbles and a tiny
// WebAudio synth (radio squelch, the Shomrim "bloop", wrench clinks, the beat tick).
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { models, registerModels, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { forTown } from "./towns.js";

export const OWN = ["community_chaverim", "community_shomrim", "community_hatzalah", "community_shomer", "community_volunteer",
    "community_emt", "community_bygirl", "community_menahel", "community_spare"];
registerModels(Object.fromEntries([...OWN, "community_baisyaakov"].map(k => [k, k])));
/** Models we borrow (core's townsfolk; the town's own are loaded with the town). */
const BORROW = ["npcMan", "npcWoman", "copPerson"];

/** The feature's live state (also ctx.community.debug.CM). */
export const CM = {
    loaded: false, loading: null, vehicles: [], scene: null, chase: null, help: null, by: null,
    hwT: 6, sceneT: 20, assistCool: 0, lastSee: {}, seen: new Set(), stats: { called: 0, chesed: 0, holds: 0, blends: 0 },
    hinted: {}, town: null,
};

export function loadModels() {
    if (!CM.loading) CM.loading = ensureModels([...OWN, ...BORROW]).then(() => { CM.loaded = true; }).catch(e => { console.warn("[community] models", e); CM.loading = null; });
    return CM.loading;
}
export const has = k => !!models[k];

/** Random content gate: the feature (tests opt in), never in a 🎉 party. */
export const on = () => ctx.enabled("community") && !(ctx.party && ctx.party.active);
/** The community config of the town she's in (null outside a town / a town without orgs). */
export function townCfg() { return ctx.town && ctx.town.active ? forTown(ctx.town.id) : null; }
export const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.foot.pos);
/** Where Lulu is (on foot or in a car): a Vector3. */
export const luluPos = () => onFoot() ? ctx.foot.pos : ctx.car.pos;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
export const stat = (id, n = 1) => emit("stat", { id, n });

// ── game-time timers (⏭ skip-safe, cleared with the run) ─────────────────
const TIMERS = [];
export function later(sec, fn) { TIMERS.push({ at: ctx.time + sec, fn }); }
export function tickTimers() {
    for (let i = TIMERS.length - 1; i >= 0; i--) if (ctx.time >= TIMERS[i].at) { const t = TIMERS.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error("[community] timer", e); } }
}
export function clearTimers() { TIMERS.length = 0; }

// ── pooled people ────────────────────────────────────────────────────────
const POOL = {};
/** A pooled, animatable person (people.js) added to the driving scene. */
export function getPerson(key, colors = null) {
    if (!models[key]) key = models.npcMan ? "npcMan" : null;
    if (!key) return null;
    const list = POOL[key] || (POOL[key] = []);
    let p = list.pop();
    if (!p) {
        p = spawnPerson(key, { colors });
        p.key = key;
        p.obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    }
    p.obj.visible = true;
    p.obj.rotation.set(0, 0, 0);
    p.obj.position.set(0, 0, 0);
    ctx.scene.add(p.obj);
    return p;
}
export function putPerson(p) {
    if (!p || !p.obj) return null;
    if (p.obj.parent) p.obj.parent.remove(p.obj);
    (POOL[p.key] || (POOL[p.key] = [])).push(p);
    return null;
}
/** Walk a person toward (x, z) at `speed`; true once there. */
export function walkTo(p, x, z, speed, dt) {
    const o = p.obj, dx = x - o.position.x, dz = z - o.position.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { p.update(dt, {}); return true; }
    const k = Math.min(d, speed * dt) / d;
    o.position.x += dx * k; o.position.z += dz * k;
    p.face(x, z, dt, 10);
    p.update(dt, { walk: speed });
    return false;
}

// ── a game-time flow: await f.sleep(1.2) (⏭ skip fast-forwards it in order) ──
export function flow(fn) {
    const f = { t: 0, waits: [], dead: false, done: false,
        sleep(sec) { return new Promise(r => f.waits.push({ at: f.t + sec, r })); },
        tick(dt) { f.t += dt; for (let i = f.waits.length - 1; i >= 0; i--) if (f.t >= f.waits[i].at) { const w = f.waits.splice(i, 1)[0]; if (!f.dead) w.r(); } },
        kill() { f.dead = true; f.waits.length = 0; } };
    Promise.resolve().then(() => fn(f)).catch(e => console.error("[community] flow", e)).finally(() => { f.done = true; });
    return f;
}

// ── light bars (per-org patterns on the Light* materials; cloned once per pooled car) ──
const LIGHT = /^Light(Amber|Blue|Red|White)$/;
export function lightRig(obj) {
    if (obj.userData.cmRig) return obj.userData.cmRig;
    const r = { amber: [], blue: [], red: [], white: [], all: [], on: null };
    obj.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const m = LIGHT.exec(o.material.name);
        if (!m) return;
        o.material = o.material.clone();
        r[m[1].toLowerCase()].push(o.material);
        r.all.push(o.material);
    });
    obj.userData.cmRig = r;
    return r;
}
export function setLights(r, on, t, org) {
    if (!r) return;
    if (!on) {
        if (r.on === false) return;
        r.on = false;
        for (const m of r.all) m.emissiveIntensity = 0.3;
        return;
    }
    r.on = true;
    const set = (list, v) => { for (const m of list) m.emissiveIntensity = v; };
    if (org === "chaverim") {
        const ph = (t * 1.5) % 1, lit = ph < 0.1 || (ph > 0.2 && ph < 0.3) || (ph > 0.5 && ph < 0.6) || (ph > 0.7 && ph < 0.8);
        set(r.amber, lit ? 8 : 0.4);
    } else if (org === "shomrim") {
        const ph = (t * 1.8) % 1, st = x => ((x * 5) % 1) < 0.55;
        set(r.blue, ph < 0.5 && st(ph) ? 8 : 0.4);
        set(r.amber, ph >= 0.5 && st(ph - 0.5) ? 8 : 0.4);
    } else {
        const ph = (t * 2.2) % 1;
        set(r.red, ((ph * 4) % 1) < 0.5 ? 8 : 0.5);
        set(r.white, Math.sin(t * 31) > 0.3 ? 7 : 0.6);
    }
}

// ── bubbles + Lulu's lines ───────────────────────────────────────────────
export function bubble(obj, text, sec = 2.6, cls = "nice") {
    if (!obj || !text || ctx.skipping) return false;
    try {
        if (onFoot() && ctx.foot.say) return !!ctx.foot.say(obj, text, sec, { cls: cls === "cop" ? "cop" : cls === "pink" ? "pink" : "" });
        if (ctx.banter && ctx.banter.bubble) return !!ctx.banter.bubble(text, obj, { dur: sec, cls });
    } catch (e) { console.error("[community] bubble", e); }
    return false;
}
export function luluSay(text, sec = 2.8) {
    if (!text || ctx.skipping) return false;
    try {
        if (onFoot() && ctx.foot.say && ctx.foot.obj) return !!ctx.foot.say(ctx.foot.obj, text, sec);
        if (ctx.banter && ctx.banter.say && ctx.state === "playing") return !!ctx.banter.say("community", {}, { force: true, line: text });
    } catch (e) { console.error("[community] say", e); }
    H.toast(`💬 ${text}`, "pink");
    return true;
}
/** A first-time hint (once per save) through the notification manager. */
export function hintOnce(key, html, ms = 3400) {
    const S = CM.save;
    if (!S || S.hints[key]) return false;
    S.hints[key] = true;
    if (CM.saveSoon) CM.saveSoon();
    H.banner(html, ms, { key: "community-" + key, prio: 1 });
    return true;
}

// ── the town's street names (for the radio) ──────────────────────────────
export function streetName() { return (ctx.town && ctx.town.street) || "Route 9"; }

// ── a tiny synth ─────────────────────────────────────────────────────────
let ac = null, out = null, noiseBuf = null;
function audio() {
    if (save3d.sound === false || ctx.skipping || ctx.TEST) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); } catch (e) { return null; }
        out = ac.createGain(); out.gain.value = 0.45; out.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac.state === "running" ? ac : null;
}
window.addEventListener("pointerdown", () => audio(), { passive: true });
window.addEventListener("keydown", () => audio(), { passive: true });
function tone(f, dur, { type = "sine", vol = 0.1, at = 0, slide = 0 } = {}) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function hiss(dur, { vol = 0.08, at = 0, f = 1800, q = 0.8 } = {}) {
    const a = audio(); if (!a) return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = a.currentTime + at, s = a.createBufferSource(), bp = a.createBiquadFilter(), g = a.createGain();
    s.buffer = noiseBuf; bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t); s.stop(t + dur + 0.02);
}
export const sfx = {
    radio() { hiss(0.12, { vol: 0.07 }); tone(1350, 0.06, { type: "square", vol: 0.03, at: 0.1 }); hiss(0.18, { vol: 0.05, at: 0.6 }); },
    bloop() { tone(520, 0.18, { type: "triangle", vol: 0.09, slide: 1100 }); tone(1100, 0.2, { type: "triangle", vol: 0.07, at: 0.2, slide: 480 }); },
    wrench() { tone(2400, 0.07, { type: "square", vol: 0.03 }); tone(3100, 0.06, { type: "square", vol: 0.025, at: 0.13 }); },
    shutter() { hiss(0.05, { vol: 0.06, f: 4000 }); tone(900, 0.03, { type: "square", vol: 0.02, at: 0.05 }); },
    tick(hi = false) { tone(hi ? 1320 : 880, 0.07, { type: "sine", vol: 0.07 }); },
    good() { tone(784, 0.12, { vol: 0.08 }); tone(1046, 0.18, { vol: 0.08, at: 0.1 }); },
    bad() { tone(330, 0.2, { type: "sawtooth", vol: 0.05, slide: 220 }); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { vol: 0.08, at: i * 0.09 })); },
    dial() { tone(440, 0.14, { vol: 0.05 }); tone(480, 0.14, { vol: 0.05, at: 0.2 }); },
};
export { THREE, models };
