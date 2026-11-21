// features/life — the positional sound kinds, synthesized ONCE (24 kHz mono, core spatial.js voices):
// footsteps per surface, splashes, a leaf-pile crunch, the neighbourhood (birds, dogs, a screen door, a
// basketball, someone hammering, wind chimes, crickets, an owl) and the wind. All short, all quiet: they sit
// UNDER the game's own sounds (prio 1 — a siren or a horn always wins a voice).
import { spatial } from "../../spatial.js";

const TAU = Math.PI * 2;
const N = () => Math.random() * 2 - 1;
const mk = (sr, sec) => new Float32Array(Math.max(1, Math.round(sr * sec)));
/** One-pole lowpass / highpass in place. */
function lp(b, sr, f, from = 0, to = b.length) { const a = 1 - Math.exp(-TAU * f / sr); let y = 0; for (let i = from; i < to; i++) { y += a * (b[i] - y); b[i] = y; } return b; }
function hp(b, sr, f) { const a = Math.exp(-TAU * f / sr); let y = 0, x1 = 0; for (let i = 0; i < b.length; i++) { const x = b[i]; y = a * (y + x - x1); x1 = x; b[i] = y; } return b; }
const bp = (b, sr, lo, hi) => lp(hp(b, sr, lo), sr, hi);
function norm(b, peak = 0.9) { let m = 0; for (let i = 0; i < b.length; i++) m = Math.max(m, Math.abs(b[i])); if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; }
/** Soft fade in/out at the ends (no clicks). */
function edges(b, sr, ms = 3) { const n = Math.min(b.length >> 1, Math.round(sr * ms / 1000)); for (let i = 0; i < n; i++) { const k = i / n; b[i] *= k; b[b.length - 1 - i] *= k; } return b; }
/** Add `src` into `dst` at sample `at` × g. */
function mix(dst, src, at, g = 1) { for (let i = 0; i < src.length && at + i < dst.length; i++) if (at + i >= 0) dst[at + i] += src[i] * g; return dst; }

// ── footsteps ────────────────────────────────────────────────────────────
function stepHard(sr, bright = 1) {
    const b = mk(sr, 0.09);
    for (let i = 0; i < b.length; i++) { const t = i / sr; b[i] = N() * Math.exp(-t / 0.011); }
    bp(b, sr, 500 * bright, 3200 * bright);
    for (let i = 0; i < b.length; i++) { const t = i / sr; b[i] += Math.sin(TAU * 95 * t) * Math.exp(-t / 0.018) * 0.55; }   // the heel's thump
    return edges(norm(b, 0.85), sr, 1);
}
function stepGrass(sr) {
    const b = mk(sr, 0.15);
    for (let i = 0; i < b.length; i++) { const t = i / sr; const env = Math.min(1, t / 0.014) * Math.exp(-t / 0.045); b[i] = N() * env * (Math.random() < 0.3 ? 1.6 : 0.6); }
    bp(b, sr, 1800, 6500);
    return edges(norm(b, 0.7), sr);
}
function stepGravel(sr) {
    const b = mk(sr, 0.13);
    for (let i = 0; i < b.length; i++) { const t = i / sr; const env = Math.exp(-t / 0.04); b[i] = (Math.random() < 0.06 ? N() * 2 : N() * 0.25) * env; }
    bp(b, sr, 1200, 5200);
    return edges(norm(b, 0.75), sr);
}
function stepWet(sr) {
    const b = mk(sr, 0.17);
    mix(b, stepHard(sr, 0.8), 0, 0.6);
    for (let i = 0; i < b.length; i++) {
        const t = i / sr, env = Math.min(1, t / 0.006) * Math.exp(-t / 0.05);
        b[i] += N() * env * 0.9;
        if (t > 0.02 && t < 0.07) b[i] += Math.sin(TAU * (380 + (t - 0.02) * 9000) * t) * Math.exp(-(t - 0.02) / 0.02) * 0.25;   // the little "plip"
    }
    lp(b, sr, 3600);
    return edges(norm(b, 0.8), sr);
}
function stepSnow(sr) {
    const b = mk(sr, 0.17);
    for (let i = 0; i < b.length; i++) { const t = i / sr; const env = Math.min(1, t / 0.03) * Math.exp(-t / 0.06); b[i] = (Math.random() < 0.15 ? N() * 1.8 : N() * 0.35) * env; }
    lp(b, sr, 2400); hp(b, sr, 250);
    return edges(norm(b, 0.75), sr);
}
function stepMetal(sr) {
    const b = mk(sr, 0.3);
    for (let i = 0; i < b.length; i++) {
        const t = i / sr;
        b[i] = (Math.sin(TAU * 410 * t) * 0.6 + Math.sin(TAU * 1130 * t) * 0.35 + Math.sin(TAU * 2270 * t) * 0.18) * Math.exp(-t / 0.06)
            + N() * Math.exp(-t / 0.006) * 0.6;
    }
    return edges(norm(b, 0.8), sr);
}
function stepWood(sr) {
    const b = mk(sr, 0.13);
    for (let i = 0; i < b.length; i++) { const t = i / sr; b[i] = (Math.sin(TAU * 190 * t) * 0.8 + Math.sin(TAU * 520 * t) * 0.4) * Math.exp(-t / 0.025) + N() * Math.exp(-t / 0.004) * 0.5; }
    return edges(norm(b, 0.8), sr);
}

// ── splashes + the leaf pile ─────────────────────────────────────────────
function splash(sr, big = 1) {
    const b = mk(sr, 0.35 + 0.25 * big);
    for (let i = 0; i < b.length; i++) { const t = i / sr; b[i] = N() * Math.min(1, t / 0.01) * Math.exp(-t / (0.08 + 0.08 * big)); }
    lp(b, sr, 2600 + 1200 * big); hp(b, sr, 180);
    for (let k = 0; k < 5 + 4 * big; k++) {                     // drops falling back
        const at = Math.floor(sr * (0.05 + Math.random() * (0.25 + 0.2 * big))), f0 = 500 + Math.random() * 700, d = mk(sr, 0.04);
        for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(TAU * (f0 + t * 14000) * t) * Math.exp(-t / 0.012); }
        mix(b, d, at, 0.18);
    }
    return edges(norm(b, 0.85), sr);
}
function crunch(sr) {
    const b = mk(sr, 0.55);
    for (let i = 0; i < b.length; i++) { const t = i / sr; const env = Math.min(1, t / 0.02) * Math.exp(-t / 0.16); b[i] = (Math.random() < 0.09 ? N() * 2.2 : N() * 0.3) * env; }
    bp(b, sr, 900, 6000);
    return edges(norm(b, 0.85), sr);
}

// ── the neighbourhood ────────────────────────────────────────────────────
/** "ruff ruff": two (or three) barks, a sawtooth growl through a mouth formant. */
function bark(sr, n = 2, pitch = 1) {
    const b = mk(sr, 0.18 + n * 0.21);
    for (let k = 0; k < n; k++) {
        const at = Math.floor(sr * k * 0.21), d = mk(sr, 0.15);
        let ph = 0;
        for (let i = 0; i < d.length; i++) {
            const t = i / sr, f = (560 - t * 1500) * pitch * (1 + (k === n - 1 ? -0.05 : 0));
            ph += TAU * f / sr;
            const saw = ((ph / TAU) % 1) * 2 - 1;
            d[i] = (saw * 0.7 + N() * 0.45) * Math.min(1, t / 0.008) * Math.exp(-t / 0.05);
        }
        bp(d, sr, 380, 1900);
        mix(b, d, at, k === n - 1 ? 0.85 : 1);
    }
    return edges(norm(b, 0.9), sr);
}
/** A songbird: a few quick rising whistles, then a trill. */
function chirp(sr, style = 0) {
    const b = mk(sr, style ? 1.0 : 0.7);
    const notes = style ? [[0, 0.09, 2600, 3900], [0.14, 0.07, 3900, 3300], [0.26, 0.05, 3400, 4300], [0.35, 0.05, 3400, 4300], [0.44, 0.05, 3400, 4300], [0.56, 0.18, 4200, 2900]]
        : [[0, 0.05, 3200, 4300], [0.08, 0.05, 3200, 4300], [0.17, 0.08, 4600, 3500], [0.32, 0.12, 2900, 3800]];
    for (const [t0, dur, f0, f1] of notes) {
        const d = mk(sr, dur);
        let ph = 0;
        for (let i = 0; i < d.length; i++) { const u = i / d.length, f = f0 + (f1 - f0) * u + Math.sin(u * TAU * 3) * 90; ph += TAU * f / sr; d[i] = Math.sin(ph) * Math.sin(Math.PI * u); }
        mix(b, d, Math.floor(sr * t0));
    }
    return edges(norm(b, 0.7), sr);
}
/** Crickets (a seamless 2 s loop): two of them, trilling at slightly different rates. */
function crickets(sr) {
    const b = mk(sr, 2.0);
    for (const [f, rate, every, off, g] of [[4500, 32, 0.5, 0, 1], [4950, 36, 0.4, 0.13, 0.7]]) {
        for (let i = 0; i < b.length; i++) {
            const t = i / sr, cyc = ((t + off) % every) / every;
            const trill = cyc < 0.3 ? Math.max(0, Math.sin(TAU * rate * t)) ** 2 : 0;
            b[i] += Math.sin(TAU * f * t) * trill * g;
        }
    }
    return norm(b, 0.6);
}
/** An owl: "hoo… hoo-hoo". */
function owl(sr) {
    const b = mk(sr, 1.5);
    for (const [t0, dur, f] of [[0, 0.38, 390], [0.62, 0.18, 370], [0.86, 0.42, 360]]) {
        const d = mk(sr, dur);
        for (let i = 0; i < d.length; i++) { const u = i / d.length, t = i / sr; d[i] = (Math.sin(TAU * f * (1 - u * 0.04) * t) + N() * 0.04) * Math.sin(Math.PI * u) ** 1.5; }
        mix(b, d, Math.floor(sr * t0));
    }
    return edges(norm(b, 0.7), sr);
}
/** A screen door: a creak, then the slap and a little rattle. */
function door(sr) {
    const b = mk(sr, 0.95);
    let ph = 0;
    for (let i = 0; i < sr * 0.5; i++) {
        const t = i / sr, f = 120 + Math.sin(t * 9) * 25 + N() * 15;
        ph += TAU * f / sr;
        b[i] = (((ph / TAU) % 1) * 2 - 1) * Math.sin(Math.PI * t / 0.5) * 0.35;
    }
    bp(b, sr, 600, 2600);
    const slap = mk(sr, 0.4);
    for (let i = 0; i < slap.length; i++) { const t = i / sr; slap[i] = N() * (Math.exp(-t / 0.012) + (t > 0.09 ? Math.exp(-(t - 0.09) / 0.01) * 0.4 : 0) + (t > 0.16 ? Math.exp(-(t - 0.16) / 0.01) * 0.15 : 0)); }
    lp(slap, sr, 2200);
    mix(b, slap, Math.floor(sr * 0.52), 1.4);
    return edges(norm(b, 0.85), sr);
}
/** A basketball being dribbled on a driveway: thump… thump… thump-thump. */
function ball(sr) {
    const b = mk(sr, 1.7);
    for (const t0 of [0, 0.48, 0.92, 1.3, 1.6]) {
        const d = mk(sr, 0.1);
        for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = Math.sin(TAU * (130 - t * 300) * t) * Math.exp(-t / 0.03) + N() * Math.exp(-t / 0.004) * 0.4; }
        mix(b, d, Math.floor(sr * t0));
    }
    return edges(norm(b, 0.8), sr);
}
/** Someone hammering (a sukkah, a fence, a renovation that never ends). */
function hammer(sr) {
    const b = mk(sr, 1.4);
    for (const t0 of [0, 0.42, 0.84]) {
        const d = mk(sr, 0.18);
        for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sin(TAU * 880 * t) * 0.5 + Math.sin(TAU * 1730 * t) * 0.3 + Math.sin(TAU * 240 * t) * 0.4) * Math.exp(-t / 0.035) + N() * Math.exp(-t / 0.005) * 0.7; }
        mix(b, d, Math.floor(sr * t0));
    }
    return edges(norm(b, 0.8), sr);
}
/** Wind chimes on a porch (a pentatonic handful). */
function chimes(sr) {
    const b = mk(sr, 2.4), notes = [1568, 1760, 2093, 2349, 2637];
    for (let k = 0; k < 5; k++) {
        const f = notes[Math.floor(Math.random() * notes.length)], at = Math.floor(sr * (k * 0.22 + Math.random() * 0.1)), d = mk(sr, 1.6);
        for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = (Math.sin(TAU * f * t) + Math.sin(TAU * f * 2.76 * t) * 0.25) * Math.exp(-t / 0.45) * Math.min(1, t / 0.002); }
        mix(b, d, at, 0.5);
    }
    return edges(norm(b, 0.6), sr, 20);
}
/** A gust of wind: a swell of low noise with a faint whistle. */
function gust(sr) {
    const b = mk(sr, 3.2);
    for (let i = 0; i < b.length; i++) b[i] = N();
    lp(b, sr, 700); lp(b, sr, 900);
    const w = mk(sr, 3.2);
    for (let i = 0; i < w.length; i++) w[i] = N();
    bp(w, sr, 1100, 1500);
    for (let i = 0; i < b.length; i++) { const u = i / b.length, env = Math.sin(Math.PI * u) ** 2 * (0.8 + 0.2 * Math.sin(u * 17)); b[i] = (b[i] * 2.2 + w[i] * 0.35) * env; }
    return edges(norm(b, 0.8), sr, 40);
}

// ── round 2: pigeons, a car alarm, steam ─────────────────────────────────
/** A flock taking off: a ragged burst of wing claps that thins out. */
function flutter(sr) {
    const b = mk(sr, 1.3);
    for (let k = 0; k < 34; k++) {
        const t0 = Math.pow(Math.random(), 1.6) * 1.0, at = Math.floor(sr * t0), d = mk(sr, 0.05);
        for (let i = 0; i < d.length; i++) { const t = i / sr; d[i] = N() * Math.exp(-t / 0.009) * (1 + Math.sin(TAU * 180 * t) * 0.4); }
        mix(b, d, at, (1 - t0 * 0.7) * (0.6 + Math.random() * 0.5));
    }
    bp(b, sr, 350, 3800);
    return edges(norm(b, 0.85), sr, 8);
}
/** A pigeon: "hoo-ROO-coo" — a throaty warble that rises and falls. */
function coo(sr) {
    const b = mk(sr, 1.05);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
        const t = i / sr, u = t / 1.05;
        const f = 300 + 170 * Math.sin(Math.PI * Math.min(1, u * 1.6)) - 60 * u;
        ph += TAU * f / sr;
        const seg = u < 0.22 ? Math.sin(Math.PI * u / 0.22) : u < 0.3 ? 0.15 : Math.sin(Math.PI * (u - 0.3) / 0.7) ** 0.7;
        b[i] = (Math.sin(ph) + Math.sin(ph * 2) * 0.35 + N() * 0.06) * seg * (0.75 + 0.25 * Math.sin(TAU * 24 * t));
    }
    lp(b, sr, 1400);
    return edges(norm(b, 0.7), sr, 10);
}
/** A car alarm's tail (after the town's own first whoops): WHOOP-WHOOP-WHOOP, then BEEP BEEP BEEP. */
function alarmTail(sr) {
    const b = mk(sr, 3.4);
    let ph = 0;
    for (let i = 0; i < b.length; i++) {
        const t = i / sr;
        let f = 0, g = 0;
        if (t < 1.8) { const u = (t % 0.3) / 0.3; f = 620 + 640 * u; g = u < 0.92 ? 1 : 0; }
        else if (t < 3.3) { const u = ((t - 1.8) % 0.5) / 0.5; f = 760; g = u < 0.55 ? 1 : 0; }
        ph += TAU * f / sr;
        const sq = Math.sign(Math.sin(ph)) * 0.6 + Math.sin(ph) * 0.4;
        b[i] = sq * g;
    }
    lp(b, sr, 2400); hp(b, sr, 300);
    // (no clicks at the gates)
    for (let i = 1; i < b.length; i++) b[i] = b[i - 1] + (b[i] - b[i - 1]) * 0.35;
    return edges(norm(b, 0.8), sr, 6);
}
/** Steam out of a manhole (a seamless 2.5 s loop): a soft hiss that breathes. */
function hiss(sr) {
    const n = Math.round(sr * 2.5), b = mk(sr, 2.5);
    for (let i = 0; i < n; i++) b[i] = N();
    hp(b, sr, 1500); lp(b, sr, 7000);
    for (let i = 0; i < n; i++) { const u = i / n; b[i] *= 0.75 + 0.25 * Math.sin(TAU * 2 * u); }
    // crossfade the ends for a seamless loop
    const x = Math.round(sr * 0.2);
    for (let i = 0; i < x; i++) { const k = i / x; b[i] = b[i] * k + b[n - x + i] * (1 - k); }
    return norm(b.subarray(0, n - x).slice(), 0.6);
}

// ── register (kinds are built lazily by spatial on the first unlock) ─────
const STEP = { ref: 2, max: 22, prio: 1, doppler: 0, lift: 0.05 };
const AMB = { ref: 6, max: 70, prio: 1, doppler: 0 };
const KINDS = {
    lifeStep: Object.assign({ gen: sr => stepHard(sr), gain: 0.2 }, STEP),
    lifeStepGrass: Object.assign({ gen: stepGrass, gain: 0.16 }, STEP),
    lifeStepGravel: Object.assign({ gen: stepGravel, gain: 0.18 }, STEP),
    lifeStepWet: Object.assign({ gen: stepWet, gain: 0.22 }, STEP),
    lifeStepSnow: Object.assign({ gen: stepSnow, gain: 0.2 }, STEP),
    lifeStepMetal: Object.assign({ gen: stepMetal, gain: 0.22 }, STEP),
    lifeStepWood: Object.assign({ gen: stepWood, gain: 0.22 }, STEP),
    lifeSplash: { gen: sr => splash(sr, 0), ref: 3, max: 45, gain: 0.32, prio: 1, doppler: 0 },
    lifeSplashBig: { gen: sr => splash(sr, 1), ref: 5, max: 70, gain: 0.45, prio: 2, doppler: 0.3 },
    lifeCrunch: { gen: crunch, ref: 3, max: 45, gain: 0.4, prio: 1, doppler: 0 },
    lifeBark: Object.assign({ gen: sr => bark(sr, 2, 1), gain: 0.3, lift: 0.5 }, AMB),
    lifeBarkSmall: Object.assign({ gen: sr => bark(sr, 3, 1.35), gain: 0.26, lift: 0.3 }, AMB),
    lifeChirp: Object.assign({ gen: sr => chirp(sr, 0), gain: 0.16, lift: 5 }, AMB),
    lifeChirp2: Object.assign({ gen: sr => chirp(sr, 1), gain: 0.15, lift: 6 }, AMB),
    lifeCrickets: { gen: crickets, loop: true, ref: 4, max: 40, gain: 0.07, prio: 1, doppler: 0, lift: 0.1 },
    lifeOwl: Object.assign({ gen: owl, gain: 0.2, lift: 8 }, AMB),
    lifeDoor: Object.assign({ gen: door, gain: 0.26, lift: 1 }, AMB),
    lifeBall: Object.assign({ gen: ball, gain: 0.26, lift: 0.2 }, AMB),
    lifeHammer: Object.assign({ gen: hammer, gain: 0.2, lift: 2 }, AMB),
    lifeChimes: Object.assign({ gen: chimes, gain: 0.14, lift: 2.4 }, AMB),
    lifeGust: { gen: gust, ref: 8, max: 80, gain: 0.3, prio: 1, doppler: 0, lift: 2 },
    lifeFlutter: Object.assign({ gen: flutter, gain: 0.34, lift: 1 }, AMB),
    lifeCoo: Object.assign({ gen: coo, gain: 0.2, lift: 0.3 }, AMB, { ref: 3, max: 30 }),
    lifeAlarm: { gen: alarmTail, ref: 8, max: 90, gain: 0.3, prio: 2, doppler: 0, lift: 0.8 },
    lifeHiss: { gen: hiss, loop: true, ref: 2.5, max: 22, gain: 0.12, prio: 1, doppler: 0, lift: 0.3 },
};
for (const k in KINDS) spatial.define(k, KINDS[k]);
export const SOUND_KINDS = Object.keys(KINDS);

/** Play one at a point (a pooled {x, y, z} target, or an Object3D). Quietly nothing before the first unlock. */
export function play(kind, target, opts) {
    if (!spatial.ready) return null;
    return spatial.play(kind, target, opts);
}
export function loop(kind, target, opts) {
    if (!spatial.ready) return null;
    return spatial.loop(kind, target, opts);
}
/** Test helper: synthesize one kind's buffer here (length in s, peak) without the audio graph. */
export function probe(kind) {
    const K = KINDS[kind];
    if (!K) return null;
    const b = K.gen(24000);
    let m = 0, nan = false;
    for (let i = 0; i < b.length; i++) { if (!Number.isFinite(b[i])) nan = true; m = Math.max(m, Math.abs(b[i])); }
    return { sec: +(b.length / 24000).toFixed(2), peak: +m.toFixed(2), nan };
}
