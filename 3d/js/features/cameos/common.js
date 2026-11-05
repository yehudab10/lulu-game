// features/cameos — shared helpers: spawn timers (port of 2D 01b-spawn-tuning),
// in-world speech bubbles, roadside spot finding, captions / chips / fades,
// a tiny WebAudio synth for the cameo stings, and wallet helpers.
import * as THREE from "three";
import { ctx, css, emit, rand } from "../../core/ctx.js";
import { save3d, shared, wallet, flushShared } from "../../core/save.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { facingRoad } from "../../world.js";

// ── spawn tuning (same numbers as src/01b-spawn-tuning.js) ───────────────
//   first: [min,max] s before the first try · every: [min,max] s between tries · chance per try
export const SPAWN_CONFIG = {
    avigail:    { first: [40, 110], every: [110, 190], chance: 0.4 },  // Avigail walking → the porch visit (rare EVENT)
    avigailCar: { first: [30, 70],  every: [55, 110],  chance: 0.5 },  // 💅 Avigail out DRIVING (taunts; sometimes pulled over)
    salon:      { first: [30, 85],  every: [65, 115],  chance: 0.45 }, // 💇 Chez Fabio by the road
    sasquatch:  { first: [40, 100], every: [75, 150],  chance: 0.35 }, // 🦶 sasquatch easter egg
    heshyPool:  { first: [25, 70],  every: [40, 80],   chance: 0.50 }, // 🏊 Heshy-in-the-pool easter egg
    uncle:      { first: [35, 90],  every: [80, 150],  chance: 0.4 },  // 👨 Uncle sighting
};
export class SpawnTimers {
    constructor(cfg) { this.cfg = cfg; this.t = {}; this.reset(); }
    reset() { for (const k in this.cfg) this.t[k] = rand(...this.cfg[k].first); }
    /** Counts down; true only on the frame an attempt succeeds. */
    tick(name, dt) {
        const c = this.cfg[name];
        this.t[name] -= dt;
        if (this.t[name] > 0) return false;
        this.t[name] = rand(...c.every);
        return Math.random() < c.chance;
    }
}

export const sleep = s => new Promise(r => setTimeout(r, s * 1000));
/** Wait n seconds of GAME time (deterministic in ?test, pauses with the game). */
export function wait(s) {
    let left = s, last = ctx.time;
    return new Promise(r => {
        const tick = () => {
            const now = ctx.time;
            if (!ctx.paused) left -= now - last;
            last = now;
            if (left <= 0) r(); else setTimeout(tick, 16);
        };
        tick();
    });
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => t * t * (3 - 2 * t);

export async function loadModels(keys) {
    try { await ensureModels(keys); return true; } catch (e) { console.error("[cameos] model load", e); return false; }
}
/** spawnPerson that tolerates a missing model (falls back to a townsperson). */
export function person(key, opts = {}, fallback = "npcMan") {
    if (models[key]) return spawnPerson(key, opts);
    if (models[fallback]) return spawnPerson(fallback, opts);
    return spawnPerson("luluPerson", opts);
}
/** A named child of a props template (Scissors, MilkJug…), cloned. */
export function prop(modelKey, name) {
    const t = models[modelKey];
    if (!t) return new THREE.Group();
    const n = findNodes(t, name)[0];
    return n ? n.clone(true) : new THREE.Group();
}
/** Put a hand prop in a person's right (or left) hand. */
export function inHand(p, obj, side = "R", off = [0, -0.47, 0.02]) {
    const arm = p.limbs["Arm_" + side];
    if (!arm) return obj;
    obj.position.set(...off);
    arm.add(obj);
    return obj;
}
/** Attach something to a person's body at head height (+Z = their front). */
export function onBody(p, obj, pos) {
    const b = p.limbs.Body || p.obj;
    obj.position.set(...pos);
    b.add(obj);
    return obj;
}

// ── shared save helpers ──────────────────────────────────────────────────
export function stat(id, n = 1) { emit("stat", { id, n }); if (ctx.cameos && ctx.cameos.log) ctx.cameos.log.push(id); }
/** Take up to n coins from the wallet (like the 2D chargeCoins): returns what was paid. */
export function charge(n) {
    flushShared();
    const pay = Math.max(0, Math.min(Math.round(n), wallet.coins));
    if (pay > 0) wallet.spend(pay);
    return pay;
}
export function luluHair() {
    const s = shared.get();
    return { color: s.luluHair || "#8B5A2B", style: s.luluHairStyle || "sheitel" };
}
/** Lulu on foot with her current salon look. */
export function luluOnFoot(colors = {}) {
    const h = luluHair();
    const key = models["luluPerson_" + h.style] ? "luluPerson_" + h.style : "luluPerson";
    return spawnPerson(key, { colors: Object.assign({ Hair: h.color }, colors) });
}

// ── roadside placement ───────────────────────────────────────────────────
const _p = {};
export function roadPoint(s, d) { return ctx.world.road.point(s, d, {}); }
/** Is (x, z) clear of every chunk collider (trees, houses, poles, cops…) within r? */
export function spotClear(x, z, r) {
    for (const ch of ctx.world.activeChunks()) {
        for (const c of ch.colliders) {
            const dx = c.x - x, dz = c.z - z, rr = r + (c.r || 0.5);
            if (dx * dx + dz * dz < rr * rr) return false;
        }
    }
    return true;
}
/** A free roadside spot in [s0, s1] on `side` (±1, 0 = either) between dMin..dMax. */
export function findSpot(s0, s1, side, dMin, dMax, r) {
    const road = ctx.world.road;
    for (let k = 0; k < 30; k++) {
        const sd = side || (Math.random() < 0.5 ? -1 : 1);
        const s = rand(s0, s1), d = sd * rand(dMin, dMax);
        const p = road.point(s, d, {});
        if (!spotClear(p.x, p.z, r)) continue;
        // the winding road must not pass near this spot further along / back
        let ok = true;
        for (let ss = s - 160; ss <= s + 160 && ok; ss += 8) {
            if (Math.abs(ss - s) < 20) continue;
            road.at(Math.max(0, ss), _p);
            if ((_p.x - p.x) ** 2 + (_p.z - p.z) ** 2 < (r + 10) ** 2) ok = false;
        }
        if (ok) return { s, d, side: sd, x: p.x, z: p.z, h: p.h };
    }
    return null;
}
/** Is a roadside strip [s0, s1] × [d0, d1] clear of colliders (poles, parked cops, trees…)? */
export function stripClear(s0, s1, d0, d1, r = 1.2) {
    const road = ctx.world.road;
    for (let s = s0; s <= s1 + 0.01; s += 2.5) {
        for (let d = d0; d <= d1 + 0.01; d += 2) {
            const p = road.point(s, d, _p);
            if (!spotClear(p.x, p.z, r)) return false;
        }
    }
    return true;
}
export function placeFacingRoad(obj, s, d) {
    const p = ctx.world.road.point(s, d, {});
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = facingRoad(p.h, Math.sign(d) || 1);
    return p;
}

// ── in-world speech bubbles (canvas sprites that face the camera) ────────
const BUBBLE_W = 640, BUBBLE_H = 300;
function wrap(g, text, maxW) {
    const out = [];
    for (const para of String(text).split("\n")) {
        let line = "";
        for (const w of para.split(" ")) {
            const t = line ? line + " " + w : w;
            if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
        }
        out.push(line);
    }
    return out.slice(0, 4);
}
/**
 * bubble(text, {bg, fg, tail, size}) → THREE.Sprite. Position it at the speaker's
 * head; call b.tick(dt, camera) each frame (keeps it readable at any distance).
 */
export function bubble(text, { bg = "#ffffff", fg = "#2b1b2e", tail = true, size = 1, border = "rgba(0,0,0,0.18)" } = {}) {
    const c = document.createElement("canvas");
    c.width = BUBBLE_W; c.height = BUBBLE_H;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
    const sp = new THREE.Sprite(mat);
    sp.center.set(0.5, 0);
    sp.renderOrder = 20;
    sp.userData.base = size;
    sp.userData.age = 0;
    sp.setText = t => {
        const g = c.getContext("2d");
        g.clearRect(0, 0, c.width, c.height);
        g.font = `700 46px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        const lines = wrap(g, t, c.width - 90);
        const lh = 52, boxH = lines.length * lh + 44, boxW = Math.min(c.width - 16, Math.max(...lines.map(l => g.measureText(l).width)) + 70);
        const x0 = (c.width - boxW) / 2, y0 = c.height - boxH - (tail ? 46 : 8);
        g.fillStyle = border;
        rrect(g, x0, y0 + 6, boxW, boxH, 34); g.fill();
        g.fillStyle = bg;
        rrect(g, x0, y0, boxW, boxH, 34); g.fill();
        if (tail) { g.beginPath(); g.moveTo(c.width / 2 - 24, y0 + boxH - 2); g.lineTo(c.width / 2, c.height - 4); g.lineTo(c.width / 2 + 26, y0 + boxH - 2); g.closePath(); g.fill(); }
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        lines.forEach((l, i) => g.fillText(l, c.width / 2, y0 + 22 + lh * (i + 0.5)));
        tex.needsUpdate = true;
        sp.userData.text = t;
    };
    sp.tick = (dt, camera = ctx.view ? ctx.view.camera : ctx.camera) => {
        sp.userData.age += dt;
        const d = camera ? camera.position.distanceTo(sp.getWorldPosition(_w)) : 10;
        const pop = Math.min(1, sp.userData.age * 6);
        const s = clamp(d * 0.11, 1.0, 6) * sp.userData.base * (0.6 + 0.4 * ease(pop));
        sp.scale.set(s * 2.1, s * 2.1 * BUBBLE_H / BUBBLE_W, 1);
    };
    sp.dispose = () => { tex.dispose(); mat.dispose(); if (sp.parent) sp.parent.remove(sp); };
    sp.setText(text);
    sp.tick(0);
    return sp;
}
const _w = new THREE.Vector3();
function rrect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ── DOM overlays: captions, chips, fade ──────────────────────────────────
css("cameos", `
#cameosFade { position: fixed; inset: 0; background: #000; opacity: 0; pointer-events: none; z-index: 30; transition: opacity .6s; }
#cameosCap { position: fixed; left: 50%; top: max(16px, env(safe-area-inset-top)); transform: translateX(-50%); z-index: 31;
  display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; width: min(92vw, 720px); }
#cameosCap .cap { background: rgba(43,27,46,.84); color: #fff; border-radius: 18px; padding: 9px 18px; font-weight: 700; font-size: 18px;
  text-align: center; box-shadow: 0 4px 0 rgba(0,0,0,.2); animation: camPop .3s ease-out; }
#cameosCap .cap.gold { color: #FFE082; } #cameosCap .cap.pink { color: #FFC1E0; } #cameosCap .cap.mint { color: #B2DFDB; }
#cameosCap .cap.big { font-size: 30px; padding: 12px 26px; }
#cameosChips { position: fixed; left: max(12px, env(safe-area-inset-left)); top: max(12px, env(safe-area-inset-top)); z-index: 31;
  display: flex; flex-direction: column; gap: 8px; align-items: flex-start; pointer-events: none; }
#cameosChips .hud-chip { font-size: 15px; }
@keyframes camPop { from { transform: scale(.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
body.tv #cameosCap .cap { font-size: 26px; padding: 12px 26px; } body.tv #cameosCap .cap.big { font-size: 40px; }
body.tv #cameosChips .hud-chip { font-size: 22px; padding: 8px 18px; }
@media (max-width: 600px) { #cameosCap { top: max(64px, env(safe-area-inset-top)); } #cameosCap .cap { font-size: 15px; } #cameosCap .cap.big { font-size: 22px; } }
body.cameos-panel #screen { background: none; justify-content: flex-end; align-items: center; }
body.cameos-panel #screen .card { width: min(430px, 46vw); }
@media (max-aspect-ratio: 1/1) { body.cameos-panel #screen { align-items: flex-end; justify-content: center; }
  body.cameos-panel #screen .card { width: min(560px, 100%); max-height: 52vh; } }
body.tv.cameos-panel #screen .card { width: min(620px, 44vw); }
`);
function overlay(id) {
    let e = document.getElementById(id);
    if (!e) { e = document.createElement("div"); e.id = id; document.body.appendChild(e); }
    return e;
}
export function fade(alpha, sec = 0.6) {
    const e = overlay("cameosFade");
    e.style.transition = `opacity ${sec}s`;
    void e.offsetWidth;
    e.style.opacity = String(alpha);
}
let capTimers = [];
/** Top-of-screen captions (subtitles for cutscenes). caption("") clears. */
export function caption(html, cls = "", ms = 0) {
    const e = overlay("cameosCap");
    if (!html) { e.innerHTML = ""; return null; }
    const d = document.createElement("div");
    d.className = "cap " + cls;
    d.innerHTML = html;
    e.appendChild(d);
    while (e.children.length > 3) e.firstChild.remove();
    if (ms > 0) capTimers.push(setTimeout(() => d.remove(), ms));
    return d;
}
export function clearCaptions() { for (const t of capTimers) clearTimeout(t); capTimers = []; caption(""); }
/** Top-left status chips (Avigail meter, 🍪 promised…). chips([]) clears. */
export function chips(list) {
    const e = overlay("cameosChips");
    e.innerHTML = list.map(t => `<div class="hud-chip">${t}</div>`).join("");
}
/** Show a showScreen card as a side panel so the 3D scene stays visible. */
export function sidePanel(on) { document.body.classList.toggle("cameos-panel", !!on); }

// ── a tiny synth for cameo stings (knocks, womp-womps, splashes) ─────────
let ac = null, out = null;
function audio() {
    if (save3d.sound === false) return null;
    try {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            ac = new AC(); out = ac.createGain(); out.gain.value = 0.7; out.connect(ac.destination);
        }
        if (ac.state === "suspended") ac.resume().catch(() => {});
        return ac;
    } catch (e) { return null; }
}
export function tone(freq, dur = 0.12, type = "sine", vol = 0.15, slideTo = 0, delay = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
}
export function noise(dur = 0.3, vol = 0.2, freq = 900, delay = 0) {
    const a = audio(); if (!a) return;
    const t = a.currentTime + delay;
    const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = freq;
    const g = a.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(out); s.start(t);
}
export const sfx = {
    womp() { tone(392, 0.32, "sawtooth", 0.09, 370); tone(349, 0.32, "sawtooth", 0.09, 330, 0.34); tone(311, 0.7, "sawtooth", 0.1, 240, 0.68); },
    knock() { for (let i = 0; i < 3; i++) { tone(140, 0.07, "square", 0.22, 90, i * 0.22); noise(0.05, 0.18, 600, i * 0.22); } },
    splash() { noise(0.7, 0.32, 1800); tone(523, 0.12, "triangle", 0.2); tone(392, 0.18, "triangle", 0.2, 0, 0.13); },
    sting() { tone(660, 0.12, "sine", 0.2, 880); },
    coin() { tone(988, 0.08, "square", 0.08); tone(1319, 0.14, "square", 0.08, 0, 0.07); },
    snip() { noise(0.05, 0.14, 4000); },
    fanfare() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.12, "triangle", 0.18, 0, i * 0.1)); },
    boom() { noise(1.1, 0.5, 500); tone(80, 0.6, "sawtooth", 0.2, 40); },
    beep() { tone(880, 0.1, "sine", 0.06); },
    thud() { tone(90, 0.18, "square", 0.14); noise(0.15, 0.2, 300); },
    siren() { tone(740, 0.16, "sine", 0.12, 1100); tone(1100, 0.16, "sine", 0.12, 740, 0.2); tone(740, 0.16, "sine", 0.1, 1100, 0.42); },
    glass() { noise(0.6, 0.35, 6000); tone(2400, 0.2, "triangle", 0.05, 1800); },
};

// ── camera helper for sets ───────────────────────────────────────────────
export class SetCam {
    constructor(camera) { this.c = camera; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.snap = true; }
    to(px, py, pz, lx, ly, lz, dt, rate = 2.5) {
        const k = this.snap ? 1 : Math.min(1, dt * rate);
        this.pos.lerp(_a.set(px, py, pz), k);
        this.look.lerp(_a.set(lx, ly, lz), this.snap ? 1 : Math.min(1, dt * rate * 1.4));
        this.snap = false;
        this.c.position.copy(this.pos);
        this.c.lookAt(this.look);
    }
}
const _a = new THREE.Vector3();

/** Recolour a person's materials in place (they're cloned per person by cloneWithColors). */
export function tintPerson(p, colors) {
    p.obj.traverse(o => {
        if (!o.isMesh || !colors[o.material.name]) return;
        o.material = o.material.clone();
        o.material.color.set(colors[o.material.name]);
    });
}
export { THREE, models, cloneWithColors, findNodes, shared, wallet };
