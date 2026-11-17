// features/banter — small shared helpers: springs (all the animation is
// springy, never snapped), shuffle bags (no line twice in a row), a seeded
// RNG for the deterministic driver animation, "may we talk right now?", and a
// tiny WebAudio voice for the other drivers' horns.
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import * as H from "../../hud.js";
import { spatial } from "../../audio.js";

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Test knobs: always = every dice roll succeeds (deterministic tests). */
export const knobs = { always: false };
/** true with probability p (always true when knobs.always). */
export const chance = p => knobs.always || Math.random() < p;
export const lerp = (a, b, t) => a + (b - a) * t;

/** Seeded RNG (mulberry32) → () => [0, 1). */
export function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** A damped spring toward a moving target. k = stiffness, zeta < 1 = a little overshoot. */
export class Spring {
    constructor(k = 90, zeta = 0.72) { this.x = 0; this.v = 0; this.set(k, zeta); }
    set(k, zeta) { this.k = k; this.c = 2 * Math.sqrt(k) * zeta; return this; }
    step(target, dt) {
        const n = Math.max(1, Math.ceil(dt * 90));    // sub-step: stable at 20 fps too
        const h = dt / n;
        for (let i = 0; i < n; i++) {
            this.v += (this.k * (target - this.x) - this.c * this.v) * h;
            this.x += this.v * h;
        }
        return this.x;
    }
    kick(v) { this.v += v; }
    reset(x = 0) { this.x = x; this.v = 0; }
}

/**
 * A shuffle bag: every item comes out once per round, in random order, and a
 * new round never starts with the line that ended the last one.
 */
export class Bag {
    constructor(items) { this.items = items.slice(); this.left = []; this.last = null; }
    next() {
        if (!this.items.length) return null;
        if (!this.left.length) {
            this.left = this.items.slice();
            for (let i = this.left.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const t = this.left[i]; this.left[i] = this.left[j]; this.left[j] = t;
            }
            // pop() takes from the END: keep the last-said line away from it
            if (this.left.length > 1 && this.left[this.left.length - 1] === this.last) {
                const t = this.left[0]; this.left[0] = this.left[this.left.length - 1]; this.left[this.left.length - 1] = t;
            }
        }
        this.last = this.left.pop();
        return this.last;
    }
}
const bags = new Map();
/** The next line from a named list (one bag per list). */
export function draw(key, list) {
    let b = bags.get(key);
    if (!b || b.items.length !== list.length) { b = new Bag(list); bags.set(key, b); }
    return b.next();
}

/** Free driving, nothing else on screen: the only time anybody gets a speech bubble. */
export function quiet() {
    if (ctx.state !== "playing" || ctx.paused || ctx.dialogOpen || ctx.skipping || ctx.view) return true;
    if (ctx.cutscene && ctx.cutscene.active()) return true;
    if (H.screenOpen()) return true;
    if (ctx.foot && ctx.foot.active) return true;
    return false;
}

/** Night factor 0 (day) … 1 (the Vegas strip), read off the sun. */
export function nightness() {
    const L = ctx.lights;
    if (!L || !L.sun) return 0;
    return clamp((2.4 - L.sun.intensity) / 1.5, 0, 1);
}

// ── a tiny synth for the other drivers' horns (own context, like garage/sound.js) ──
let ac = null, out = null;
function audio() {
    if (save3d.sound === false || ctx.skipping) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); } catch (e) { return null; }
        out = ac.createGain();
        out.gain.value = 0.5;
        out.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac.state === "running" ? ac : null;
}
const unlock = () => { audio(); };
window.addEventListener("pointerdown", unlock, { passive: true });
window.addEventListener("keydown", unlock, { passive: true });

/** "Beep beep!" from another car: kind picks the voice, vol 0..1 (by distance).
 *  With `obj` (the car's Object3D) and positional audio up, the honk comes FROM that car. */
export function npcHorn(kind = "sedan", vol = 0.6, beeps = 2, obj = null) {
    if (obj && spatial.ready && save3d.sound !== false && !ctx.skipping) {
        const sk = kind === "truck" ? "hornTruck" : kind === "van" ? "hornVan" : kind === "cop" ? "hornCop" : "horn";
        const len = kind === "truck" ? 0.42 : kind === "van" ? 0.15 : kind === "cop" ? 0.1 : 0.13;
        if (spatial.play(sk, obj, { gain: 0.95, rate: sk === "horn" ? 0.95 + Math.random() * 0.15 : 1, dur: beeps === 1 ? len + 0.03 : 0 })) return;
    }
    const a = audio();
    if (!a || vol < 0.05) return;
    const t0 = a.currentTime + 0.01;
    const truck = kind === "truck";
    const f = truck ? 155 : kind === "van" ? 330 : kind === "cop" ? 520 : 400 + Math.random() * 60;
    const len = truck ? 0.42 : 0.13, gap = truck ? 0.12 : 0.07;
    for (let i = 0; i < beeps; i++) {
        const s = t0 + i * (len + gap);
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.11 * vol, s + 0.012);
        g.gain.setValueAtTime(0.11 * vol, s + len - 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, s + len);
        const lp = a.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = truck ? 900 : 2200;
        lp.connect(g); g.connect(out);
        for (const mul of truck ? [1, 1.26, 1.5] : [1, 1.25]) {
            const o = a.createOscillator();
            o.type = truck ? "sawtooth" : "square";
            o.frequency.setValueAtTime(f * mul, s);
            o.connect(lp);
            o.start(s); o.stop(s + len + 0.02);
        }
    }
}
