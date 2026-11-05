// features/roadevents — shared plumbing for every road event: models, road
// placement, set-piece slots beyond the built world, a traffic "governor"
// (cars queue at the train crossing, funnel into open toll lanes…), speech
// bubbles, a tiny WebAudio synth, cheap instanced crowds, pickups and stats.
import * as THREE from "three";
import { ctx, on, emit, css, MPH } from "../../core/ctx.js";
import { registerModels, ensureModels, models, cloneWithColors, findNodes } from "../../models.js";
import { LANES_OURS } from "../../world.js";
import { save3d } from "../../core/save.js";
import * as A from "../../audio.js";

export const ID = "roadevents";
export const K = n => "roadevents_" + n;

// ── models (lazy; background-loaded after boot when road events are on) ──
const FILES = ["cone", "barrier", "arrowboard", "pothole", "steamroller", "toll_booth", "toll_curb", "toll_arm", "toll_canopy",
    "rail_signal", "rail_arm", "track", "track_xing", "train_loco", "train_box", "train_tank", "train_caboose",
    "icecream_truck", "icecream_stand", "treat", "drivethru", "menuboard", "burger", "fuel_can", "gas_station",
    "school_bus", "ambulance", "duck", "raccoon", "ostrich", "hitch_sign", "stop_paddle", "billboard", "crowd_barrier",
    "worker", "hitchhiker", "vendor"];
registerModels(Object.fromEntries(FILES.map(f => [K(f), K(f)])));
export const CAST = ["npcWoman", "npcMan", "npcKid", "copPerson", "luluPerson", "dinaPerson"];
export const ALL_MODELS = FILES.map(K).concat(CAST);
let allReady = null;
/** Load models (feature keys may be given without the prefix). */
export function need(keys) {
    return ensureModels(keys.map(k => CAST.includes(k) || k.startsWith("roadevents_") ? k : K(k)));
}
export function loadAll() { return allReady || (allReady = ensureModels(ALL_MODELS).catch(e => { allReady = null; throw e; })); }
export const M = n => models[K(n)] || models[n];

// ── road helpers ──────────────────────────────────────────────────────────
const _p = {};
export const road = () => ctx.world.road;
export function pt(s, d, out = {}) { return ctx.world.road.point(s, d, out); }
export function headingAt(s) { return ctx.world.road.at(s, _p).h; }
/** Put obj at road (s, d), facing along the road (+ yaw). */
export function place(obj, s, d, yaw = 0, y = 0) {
    const p = ctx.world.road.point(s, d, _p);
    obj.position.set(p.x, y, p.z);
    obj.rotation.set(0, p.h + yaw, 0);
    return obj;
}
export function fwd(h) { return { x: Math.sin(h), z: Math.cos(h) }; }
export function right(h) { return { x: -Math.cos(h), z: Math.sin(h) }; }
export const carS = () => ctx.car.s;
export const carD = () => ctx.car.d;
export const mph = () => ctx.car.speed * MPH;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const driving = () => ctx.state === "playing";

/** Where the furthest built chunk ends (set pieces go beyond it so no tree is in the way). */
export function builtEnd() {
    let m = 0;
    for (const ch of ctx.world.activeChunks()) m = Math.max(m, ch.s1);
    return m;
}

// ── set-piece slots: keep my pieces apart and off the journey's reserved yards ──
const slots = [];       // {s0, s1}
const myReserves = [];  // entries we pushed into world.reserved
export function slotFree(s0, s1) {
    for (const sl of slots) if (s0 < sl.s1 + 60 && s1 > sl.s0 - 60) return false;
    const w = ctx.world;
    for (const d of [10, -10, 20, -20]) if (w.isReserved(s0, d, 0) || w.isReserved(s1, d, 0) || w.isReserved((s0 + s1) / 2, d, 0)) return false;
    return true;
}
/** Pick s for a set piece spanning [s-before, s+after], beyond the built range (or at opts.s). */
export function claimSlot(before, after, opts = {}) {
    let s = opts.s != null ? opts.s : Math.max(carS() + (opts.minAhead || 420), builtEnd() + before + 25);
    if (opts.s == null) for (let i = 0; i < 14 && !slotFree(s - before, s + after); i++) s += 80;
    const sl = { s0: s - before, s1: s + after };
    slots.push(sl);
    return { s, release() { const i = slots.indexOf(sl); if (i >= 0) slots.splice(i, 1); } };
}
export function reserve(s0, s1, side, dMin, dMax) {
    const w = ctx.world;
    w.reserve(s0, s1, side, dMin, dMax);
    const r = w.reserved[w.reserved.length - 1];
    myReserves.push(r);
    return r;
}
export function resetSlots() {
    slots.length = 0;
    const w = ctx.world;
    if (w) for (const r of myReserves) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
    myReserves.length = 0;
}

// ── the traffic governor ────────────────────────────────────────────────────
// blockers: {s, d0, d1, dir?, reach?, active()} — cars approaching (in dir, or both) stop
// before s while active (train crossing, parade, duck parade, crossing guard).
// funnels: {s, lanes:[d…], len} — our-direction cars steer into the open lanes.
export const blockers = new Set();
export const funnels = new Set();
export function governTraffic() {
    const T = ctx.traffic;
    if (!T) return;
    for (const c of T.cars) {
        if (c.hit || c.ai) continue;
        let hold = false;
        for (const b of blockers) {
            if (b.dir && b.dir !== c.dir) continue;
            if (b.active && !b.active()) continue;
            const dist = (b.s - c.s) * c.dir;
            if (dist > 3 && dist < (b.reach || 46) && c.d > b.d0 - 1.4 && c.d < b.d1 + 1.4) { hold = true; break; }
        }
        if (hold) { c.want = 0; c.data.reHeld = true; }
        else if (c.data.reHeld) { c.data.reHeld = false; c.want = Math.max(c.want, c.base * 0.7); }
        if (c.dir > 0) {
            let f = null;
            for (const fu of funnels) { const g = fu.s - c.s; if (g > -6 && g < fu.len) { f = fu; break; } }
            if (f) {
                let best = f.lanes[0];
                for (const l of f.lanes) if (Math.abs(l - c.d) < Math.abs(best - c.d)) best = l;
                c.dTarget = best;
                c.want = Math.min(c.want, f.speed || 9);
                c.data.reFunnel = true;
            } else if (c.data.reFunnel) {
                c.data.reFunnel = false;
                c.dTarget = LANES_OURS.reduce((a, l) => Math.abs(l - c.d) < Math.abs(a - c.d) ? l : a, LANES_OURS[0]);
                c.want = c.base;
            }
        }
    }
}

// ── who's watching? (a cop car in traffic or a parked speed-trap cop nearby) ──
export function copWitness(range = 85) {
    const car = ctx.car;
    for (const c of ctx.traffic.cars) {
        if (c.kind !== "cop" && !(c.data && c.data.cop)) continue;
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
        if (dx * dx + dz * dz < range * range) return c;
    }
    for (const ch of ctx.world.activeChunks()) for (const t of ch.traps) {
        if (!t.obj) continue;
        const dx = t.obj.position.x - car.pos.x, dz = t.obj.position.z - car.pos.z;
        if (dx * dx + dz * dz < range * range) return t;
    }
    return null;
}

// ── stats (2D quest ids where they exist) ───────────────────────────────────
export function stat(id, n = 1) { emit("stat", { id, n }); }

// ── speech bubbles (DOM, projected from the 3D world) ───────────────────────
css(ID, `
#re-bubbles { position: fixed; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
#re-bubbles.off { display: none; }
.re-bub { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); background: #fff; color: var(--ink);
  font: 700 15px var(--font); padding: 6px 12px; border-radius: 16px; white-space: nowrap; max-width: 46vw; text-overflow: ellipsis; overflow: hidden;
  box-shadow: 0 3px 0 rgba(0,0,0,.18), 0 4px 14px rgba(0,0,0,.18); transition: opacity .25s; will-change: transform; }
.re-bub::after { content: ""; position: absolute; left: 50%; bottom: -7px; margin-left: -7px; border: 7px solid transparent; border-bottom: 0; border-top-color: #fff; }
.re-bub.pink { background: #FCE4EC; } .re-bub.pink::after { border-top-color: #FCE4EC; }
.re-bub.gold { background: #FFF8E1; } .re-bub.gold::after { border-top-color: #FFF8E1; }
.re-bub.red { background: #FFEBEE; color: #B71C1C; } .re-bub.red::after { border-top-color: #FFEBEE; }
.re-bub.cop { background: #E3F2FD; color: #0D47A1; } .re-bub.cop::after { border-top-color: #E3F2FD; }
.re-bub.big { font-size: 19px; padding: 8px 16px; }
.re-badge { background: rgba(43,27,46,.78); color: #fff; border-radius: 999px; padding: 5px 14px; font-weight: 700; font-size: 15px; white-space: nowrap;
  display: flex; align-items: center; gap: 8px; }
.re-badge .bar { width: 64px; height: 7px; border-radius: 4px; background: rgba(255,255,255,.25); overflow: hidden; }
.re-badge .bar i { display: block; height: 100%; background: #FFD54F; border-radius: 4px; }
.re-badge.low .bar i { background: #FF7043; }
.re-mark { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); font: 700 22px var(--font); color: #fff;
  text-shadow: 0 2px 0 rgba(0,0,0,.45), 0 0 10px rgba(0,0,0,.35); white-space: nowrap; }
body.tv .re-bub { font-size: 24px; padding: 9px 18px; } body.tv .re-badge { font-size: 22px; padding: 8px 20px; } body.tv .re-mark { font-size: 32px; }
@media (max-width: 600px) { .re-bub { font-size: 13px; padding: 5px 10px; } .re-badge { font-size: 13px; } }
`);
const layer = document.createElement("div");
layer.id = "re-bubbles";
document.body.appendChild(layer);
const bubbles = [];
const _v = new THREE.Vector3();
/**
 * A speech bubble over a 3D thing. target: Object3D | () => {x,y,z} | {x,y,z}.
 * opts: t (s), y (height offset), cls ("pink" | "gold" | "red" | "cop" | "big")
 */
export function bubble(text, target, { t = 2.4, y = 2.3, cls = "" } = {}) {
    for (const b of bubbles) if (b.target === target) { b.t = 0; b.dur = t; b.el.textContent = text; b.el.className = "re-bub " + cls; return b; }
    const el = document.createElement("div");
    el.className = "re-bub " + cls;
    el.textContent = text;
    layer.appendChild(el);
    const b = { el, target, t: 0, dur: t, y };
    bubbles.push(b);
    while (bubbles.length > 7) killBubble(bubbles[0]);
    return b;
}
/** A floating marker (emoji/text) pinned to a world point: returns {el, remove()}. */
export function marker(html, target, y = 1.6) {
    const el = document.createElement("div");
    el.className = "re-mark";
    el.innerHTML = html;
    layer.appendChild(el);
    const m = { el, target, y, mark: true, t: 0, dur: 1e9 };
    bubbles.push(m);
    m.remove = () => killBubble(m);
    return m;
}
function killBubble(b) { const i = bubbles.indexOf(b); if (i >= 0) bubbles.splice(i, 1); b.el.remove(); }
export function clearBubbles() { while (bubbles.length) killBubble(bubbles[0]); }
function targetPos(tg, out) {
    if (typeof tg === "function") { const p = tg(); return out.set(p.x, p.y || 0, p.z); }
    if (tg.isObject3D) return tg.getWorldPosition(out);
    return out.set(tg.x, tg.y || 0, tg.z);
}
/** Called every frame (hud hook). */
export function updateBubbles(dt) {
    const cam = ctx.camera, W = innerWidth, Hh = innerHeight;
    layer.classList.toggle("off", !!ctx.view || !(ctx.states[ctx.state] && ctx.states[ctx.state].hud));
    for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.t += dt;
        if (b.t > b.dur) { killBubble(b); continue; }
        targetPos(b.target, _v);
        _v.y += b.y;
        const dist = _v.distanceTo(cam.position);
        _v.project(cam);
        const vis = _v.z < 1 && dist < (b.mark ? 140 : 95) && Math.abs(_v.x) < 1.2 && Math.abs(_v.y) < 1.2;
        if (!vis) { b.el.style.opacity = "0"; continue; }
        const x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * Hh;
        const sc = b.mark ? clamp(30 / dist, 0.55, 1.4) : clamp(26 / dist, 0.7, 1.15);
        b.el.style.opacity = b.t > b.dur - 0.3 ? "0" : "1";
        b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, ${b.mark ? "-50%" : "-100%"}) scale(${sc.toFixed(2)})`;
    }
}

// ── a tiny synth for the sounds core audio doesn't have (bells, horns, quacks, jingles) ──
let ac = null, out = null, noiseBuf = null;
function actx() {
    if (save3d.sound === false || !A.audio.ready) return null;
    try {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            ac = new AC();
            out = ac.createGain(); out.gain.value = 0.55; out.connect(ac.destination);
            const len = ac.sampleRate * 2;
            noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { return null; }
    return ac;
}
for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, () => { if (ac && ac.state === "suspended") ac.resume().catch(() => {}); }, { passive: true });
export function tone(freq, dur, type = "sine", vol = 0.15, when = 0, slideTo = 0) {
    const c = actx(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
export function noise(dur, freq = 800, vol = 0.2, type = "bandpass", when = 0, q = 1) {
    const c = actx(); if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.05);
}
/** A looping rumble whose volume you set every frame (train, steamroller). */
export function loop(freq = 90, type = "lowpass") {
    const c = actx(); if (!c) return { set() {}, stop() {} };
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(out); s.start();
    return {
        set(v, fr) { g.gain.setTargetAtTime(v, c.currentTime, 0.1); if (fr) f.frequency.setTargetAtTime(fr, c.currentTime, 0.1); },
        stop() { try { g.gain.setTargetAtTime(0, c.currentTime, 0.1); s.stop(c.currentTime + 0.4); } catch (e) { /* already stopped */ } },
    };
}
export const sfx = {
    coin: n => A.sfxCoin(n || 0),
    buy() { [784, 988, 1175].forEach((f, i) => tone(f, 0.12, "triangle", 0.12, i * 0.08)); },
    happy() { tone(523, 0.08, "triangle", 0.18); tone(784, 0.12, "triangle", 0.2, 0.08); },
    bell(i) { tone(i % 2 ? 660 : 640, 0.22, "square", 0.05); tone(i % 2 ? 1320 : 1280, 0.15, "sine", 0.04); },
    trainHorn(len = 0.9, when = 0) { for (const f of [311, 370, 466]) tone(f, len, "sawtooth", 0.035, when, f * 0.985); },
    quack() { tone(560, 0.09, "sawtooth", 0.07, 0, 380); tone(520, 0.1, "sawtooth", 0.06, 0.11, 360); },
    jingle() { [659, 587, 523, 587, 659, 659, 659].forEach((f, i) => tone(f, 0.12, "square", 0.05, i * 0.14)); },
    crunch() { A.sfxCrash(0.6); tone(64, 0.24, "square", 0.12); },
    splash() { noise(0.35, 1400, 0.25, "bandpass", 0, 0.8); tone(280, 0.12, "sine", 0.06, 0, 120); },
    thud() { A.sfxBump(); noise(0.12, 300, 0.2, "lowpass"); },
    whistle() { tone(2100, 0.18, "sine", 0.08, 0, 2400); tone(2300, 0.28, "sine", 0.08, 0.2, 1900); },
    siren() { A.sfxSiren(1.2); },
    honk() { tone(415, 0.18, "square", 0.05); tone(523, 0.18, "square", 0.05); },
    cheer() { noise(0.9, 1800, 0.12, "bandpass", 0, 0.5); },
    pop() { tone(880, 0.06, "sine", 0.1, 0, 1320); },
    engine(f = 80) { tone(f, 0.3, "sawtooth", 0.12); tone(f * 1.25, 0.4, "square", 0.08, 0.18); },
    ambulance() { [900, 1320, 900, 1320].forEach((f, i) => tone(f, 0.18, "sine", 0.08, i * 0.2)); },
};

// ── particles in the world (Lulu's car owns the particle system) ────────────
export function burst(x, y, z, n, speed, color, size = 0.6, life = 0.8) { ctx.car.fx.burst(x, y, z, n, speed, color, size, life); }
export function confetti(x, z, n = 36) {
    const cols = [[1, 0.25, 0.5], [1, 0.84, 0.25], [0.25, 0.77, 1], [0.7, 0.53, 1], [0.41, 0.94, 0.68]];
    for (let i = 0; i < n; i++) ctx.car.fx.emit(x + rnd(-2, 2), 2 + rnd(0, 2), z + rnd(-2, 2), rnd(-4, 4), rnd(3, 7), rnd(-4, 4), 0.4, 1.6, cols[i % 5]);
}
export function smoke(x, y, z, n = 1, col = [0.6, 0.6, 0.62]) {
    for (let i = 0; i < n; i++) ctx.car.fx.emit(x + rnd(-0.3, 0.3), y, z + rnd(-0.3, 0.3), rnd(-0.4, 0.4), rnd(0.8, 1.6), rnd(-0.4, 0.4), rnd(0.9, 1.5), rnd(1, 1.6), col);
}

// ── instanced crowds: many animated people for ~one draw call per material ──
const LIMBS = ["Arm_L", "Arm_R", "Leg_L", "Leg_R", "Body"];
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _c = new THREE.Color();
const _q2 = new THREE.Quaternion(), _pos = new THREE.Vector3(), _scl = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
/**
 * new Crowd(modelKey, max, tintMats) → crowd.add({x, z, rot, scale, colors:{Top,Bottom,Hair}, walk, cheer, wave, dance})
 * members are plain objects you move; call crowd.update(dt) once per frame; crowd.group goes in the scene.
 */
export class Crowd {
    constructor(key, max, tints = ["Top", "Bottom", "Hair"]) {
        const tpl = models[key];
        tpl.updateMatrixWorld(true);
        this.group = new THREE.Group();
        this.members = [];
        this.max = max;
        this.nodes = [];   // {name, parentWorld, pos, quat, scale}
        this.meshes = [];
        const rootEmpty = tpl.children[0];
        const inv = new THREE.Matrix4();
        tpl.traverse(o => {
            if (!o.isMesh) return;
            let part = o;
            while (part.parent && part.parent !== rootEmpty && part.parent !== tpl) part = part.parent;
            const limb = LIMBS.find(n => part.name.startsWith(n)) || null;
            let node = this.nodes.find(n => n.obj === part);
            if (!node) {
                node = { obj: part, limb, parentWorld: part.parent.matrixWorld.clone(), pos: part.position.clone(), quat: part.quaternion.clone(), scale: part.scale.clone(), mat: new THREE.Matrix4() };
                this.nodes.push(node);
            }
            inv.copy(part.matrixWorld).invert();
            const local = inv.multiply(o.matrixWorld.clone());
            let mat = o.material;
            const tinted = tints.includes(mat.name);
            if (tinted) { mat = mat.clone(); mat.color.set("#ffffff"); }
            const im = new THREE.InstancedMesh(o.geometry, mat, max);
            im.count = 0;
            im.castShadow = true; im.receiveShadow = true;
            im.frustumCulled = false;
            this.group.add(im);
            this.meshes.push({ im, node, local: local.clone(), tinted, matName: o.material.name, base: o.material.color.clone(), owned: tinted ? mat : null });
        });
    }
    add(m) {
        if (this.members.length >= this.max) return null;
        const mm = Object.assign({ x: 0, y: 0, z: 0, rot: 0, scale: 1, walk: 0, phase: Math.random() * 6, t: Math.random() * 9, colors: null, visible: true }, m);
        this.members.push(mm);
        this.dirtyColors = true;
        return mm;
    }
    remove(m) { const i = this.members.indexOf(m); if (i >= 0) { this.members.splice(i, 1); this.dirtyColors = true; } }
    update(dt) {
        const list = this.members.filter(m => m.visible);
        for (const mesh of this.meshes) mesh.im.count = list.length;
        list.forEach((m, i) => {
            m.t += dt;
            m.phase += dt * (m.walk > 0.05 ? 2.2 + m.walk * 2.4 : 0);
            const swing = m.walk > 0.05 ? Math.min(0.8, 0.25 + m.walk * 0.22) : 0;
            const s = Math.sin(m.phase);
            let legL = s * swing, legR = -s * swing, armL = -s * swing * 0.8, armR = s * swing * 0.8, armLz = 0.06, armRz = -0.06;
            if (m.cheer) { armL = armR = -2.7 + Math.sin(m.t * 10 + m.phase) * 0.18; armLz = 0.25; armRz = -0.25; }
            if (m.wave) { armR = -2.6; armRz = -0.35 + Math.sin(m.t * 9) * 0.45; }
            if (m.dance) { const d = Math.sin(m.t * 7); armL = -2.4 + d * 0.4; armR = -2.4 - d * 0.4; armLz = 0.4; armRz = -0.4; legL = d * 0.25; legR = -d * 0.25; }
            const bob = m.walk > 0.05 ? Math.abs(Math.cos(m.phase)) * 0.04 : Math.sin(m.t * 2.2) * 0.01 + (m.cheer ? Math.abs(Math.sin(m.t * 6)) * 0.05 : 0);
            _q.setFromAxisAngle(_up, m.rot);
            _m.compose(_pos.set(m.x, m.y + bob, m.z), _q, _scl.setScalar(m.scale));
            for (const n of this.nodes) {
                let rx = 0, rz = 0;
                if (n.limb === "Leg_L") rx = legL; else if (n.limb === "Leg_R") rx = legR;
                else if (n.limb === "Arm_L") { rx = armL; rz = armLz; } else if (n.limb === "Arm_R") { rx = armR; rz = armRz; }
                _q.copy(n.quat).multiply(_q2.setFromEuler(_e.set(rx, 0, rz)));
                n.mat.compose(n.pos, _q, n.scale).premultiply(n.parentWorld).premultiply(_m);
            }
            for (const mesh of this.meshes) mesh.im.setMatrixAt(i, _m2.multiplyMatrices(mesh.node.mat, mesh.local));
        });
        if (this.dirtyColors || list.length !== this.lastN) {
            this.dirtyColors = false;
            this.lastN = list.length;
            for (const mesh of this.meshes) {
                if (!mesh.tinted) continue;
                list.forEach((m, i) => mesh.im.setColorAt(i, _c.set((m.colors && m.colors[mesh.matName]) || mesh.base)));
                if (mesh.im.instanceColor) mesh.im.instanceColor.needsUpdate = true;
            }
        }
        for (const mesh of this.meshes) mesh.im.instanceMatrix.needsUpdate = true;
    }
    dispose() {
        if (this.group.parent) this.group.parent.remove(this.group);
        for (const mesh of this.meshes) { mesh.im.dispose(); if (mesh.owned) mesh.owned.dispose(); }
    }
}

// people colours for crowds / passengers (2D PASSENGER_SHIRT_COLORS + friends)
export const SHIRTS = ["#E91E63", "#FFC107", "#43A047", "#2196F3", "#FF5722", "#9C27B0", "#26C6DA", "#FF8A65", "#7E57C2", "#FFFFFF"];
export const HAIRS = ["#FFC107", "#3E2723", "#6D4C41", "#FAFAFA", "#E91E63", "#FF9800", "#1A1A1A", "#8D6E63"];
export const BOTTOMS = ["#283593", "#37474F", "#212121", "#5D4037", "#1565C0", "#6A1B9A", "#455A64"];
export function personColors() { return { Top: pick(SHIRTS), Bottom: pick(BOTTOMS), Hair: pick(HAIRS) }; }

// ── canvas-texture road paint ("TOLL AHEAD", "R X R"…) ─────────────────────
const paintCache = new Map();
export function roadPaint(text, color = "#F5F5DC", w = 6.4, h = 2.4) {
    const key = text + color;
    let mat = paintCache.get(key);
    if (!mat) {
        const c = document.createElement("canvas");
        c.width = 512; c.height = 192;
        const g = c.getContext("2d");
        g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle";
        if (text === "X") {
            g.lineWidth = 26; g.strokeStyle = color; g.lineCap = "round";
            g.beginPath(); g.moveTo(170, 20); g.lineTo(342, 172); g.moveTo(342, 20); g.lineTo(170, 172); g.stroke();
        } else if (text === "^") {
            g.lineWidth = 22; g.strokeStyle = color; g.lineCap = "round"; g.lineJoin = "round";
            for (const cx of [128, 384]) { g.beginPath(); g.moveTo(cx - 80, 150); g.lineTo(cx, 50); g.lineTo(cx + 80, 150); g.stroke(); }
        } else {
            g.font = `700 150px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.save(); g.translate(256, 96); g.scale(1, 1.25); g.fillText(text, 0, 0, 500); g.restore();
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
        paintCache.set(key, mat);
    }
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.renderOrder = 1;
    const g = new THREE.Group();
    g.add(plane);
    g.userData.geo = plane.geometry;
    return g;
}

// ── a set-piece "event" = an actor with its own scene group ─────────────────
/**
 * makePiece(name) → { group, own(disposable), objects… } with dispose() that cleans up.
 * Put it in the scene, then addActor({...piece, update, collide}).
 */
export function makePiece(name) {
    const group = new THREE.Group();
    group.name = "re_" + name;
    ctx.scene.add(group);
    const owned = [];
    const extras = [];
    return {
        name, group,
        own(x) { owned.push(x); return x; },
        later(fn) { extras.push(fn); },
        add(obj) { group.add(obj); return obj; },
        disposePiece() {
            if (group.parent) group.parent.remove(group);
            group.traverse(o => {
                if (o.userData && o.userData.geo) o.userData.geo.dispose();
                if (o.userData && o.userData.mats) for (const m of Object.values(o.userData.mats)) m.dispose();
            });
            for (const x of owned) { try { x.dispose(); } catch (e) { /* ignore */ } }
            for (const fn of extras) { try { fn(); } catch (e) { console.error(e); } }
        },
    };
}

/** Clone a model, giving the named materials per-instance copies (to blink lamps, recolour…). */
export function cloneOwn(template, matNames = [], colors = null) {
    const obj = cloneWithColors(template, colors);
    const mats = {};
    obj.traverse(o => {
        if (!o.isMesh || !matNames.includes(o.material.name)) return;
        const n = o.material.name;
        if (!mats[n]) mats[n] = o.material.clone();
        o.material = mats[n];
    });
    obj.userData.mats = mats;
    return obj;
}
export { findNodes, models, cloneWithColors };

// ── collisions ──────────────────────────────────────────────────────────────
/** Is Lulu's car (circles) touching circle (x, z, r)? */
export function carTouches(x, z, r) {
    const car = ctx.car;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    for (const o of [1.15, -1.15]) {
        const dx = car.pos.x + fx * o - x, dz = car.pos.z + fz * o - z;
        if (dx * dx + dz * dz < (r + 0.93) * (r + 0.93)) return true;
    }
    return false;
}
/** Lulu's car vs. a static circle (bounces like a tree). Returns impact m/s. */
export function solid(x, z, r) { return ctx.car.collideStatic(x, z, r); }

/** Reset everything shared at run start. */
export function resetCommon() {
    resetSlots();
    blockers.clear();
    funnels.clear();
    clearBubbles();
}
on("state", ({ to }) => {
    if (to === "title" || to === "gameover") clearBubbles();
    layer.classList.toggle("off", !(ctx.states[to] && ctx.states[to].hud));
});
