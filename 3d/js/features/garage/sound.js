// Garage sounds, synthesized with WebAudio: every Bling horn (same recipes as
// the 2D game's playPlayerHorn in src/06d-bling.js, pitched by the Honk
// Symphony chain note), the held classic horn, and the shop / item SFX
// (buy, deny, missile launch, explosion, pepper-spray pssst, shield pop).
//
// The core audio graph is private to audio.js, so the garage keeps its own
// small AudioContext, unlocked by the same user gestures and muted with the
// game's Sound setting (save3d.sound).
import { save3d } from "../../core/save.js";

let ac = null, out = null, noise = null;

function ensure() {
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); } catch (e) { return null; }
        out = ac.createGain();
        out.gain.value = 0.75;
        out.connect(ac.destination);
        const len = Math.floor(ac.sampleRate * 1.5);
        noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
}
const unlock = () => { ensure(); };
window.addEventListener("pointerdown", unlock, { passive: true });
window.addEventListener("keydown", unlock, { passive: true });
window.addEventListener("touchend", unlock, { passive: true });

function ready() {
    if (save3d.sound === false) return null;
    const a = ensure();
    return a && a.state === "running" ? a : null;
}

/** One shaped voice: quick attack, hold, short release (the 2D hornVoice). */
function voice(a, type, freq, t0, dur, vol, fType, fHz, fQ) {
    const o = a.createOscillator(), g = a.createGain();
    let tail = o;
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (fType) {
        const f = a.createBiquadFilter();
        f.type = fType; f.frequency.value = fHz; if (fQ) f.Q.value = fQ;
        o.connect(f); tail = f;
    }
    tail.connect(g).connect(out);
    dur = Math.max(dur, 0.08);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    g.gain.setValueAtTime(vol, t0 + dur - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
}

/** A pitched one-shot tone (2D playTone). */
function tone(freq, dur, type = "sine", vol = 0.2, sweepTo = 0, when = 0) {
    const a = ready(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.02);
}

function noiseHit(dur, vol, f0, f1, type = "lowpass", when = 0, q = 0.7) {
    const a = ready(); if (!a) return;
    const t = a.currentTime + when;
    const src = a.createBufferSource();
    src.buffer = noise;
    const f = a.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t); src.stop(t + dur + 0.05);
}

// ── horns ────────────────────────────────────────────────────────────────
/** Honk Symphony notes: each honk in a chain is the next note of C major. */
export const HONK_NOTES = [262, 294, 330, 349, 392, 440, 494, 523];

/**
 * Lulu's honk with horn `id`, pitched by the Symphony note (262 = first honk).
 * Returns true if anything played.
 */
export function playHorn(id = "beep", note = 262) {
    const a = ready(); if (!a) return false;
    const k = Math.max(1, Math.min(2, (note || 262) / 262)), t = a.currentTime;
    let o;
    if (id === "duck") {
        o = voice(a, "sawtooth", 640 * k, t, 0.2, 0.3, "bandpass", 1100, 2.5);
        o.frequency.exponentialRampToValueAtTime(390 * k, t + 0.18);
    } else if (id === "clown") {
        o = voice(a, "square", 410 * k, t, 0.13, 0.12, "lowpass", 2600);
        o.frequency.linearRampToValueAtTime(450 * k, t + 0.1);
        o = voice(a, "square", 330 * k, t + 0.17, 0.17, 0.12, "lowpass", 2600);
        o.frequency.linearRampToValueAtTime(360 * k, t + 0.3);
    } else if (id === "shofar") {
        const f0 = 233 * k;   // a tekiah: scoop up, hold, crack at the top
        o = voice(a, "sawtooth", f0 * 0.8, t, 0.72, 0.16, "lowpass", 1500);
        o.frequency.exponentialRampToValueAtTime(f0, t + 0.14);
        o.frequency.setValueAtTime(f0, t + 0.56);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.5, t + 0.64);
    } else if (id === "cucaracha") {
        const tune = [392, 392, 392, 523, 659];
        tune.forEach((f, i) => voice(a, "square", f * k, t + i * 0.1, i === 4 ? 0.24 : 0.085, 0.09, "lowpass", 3200));
    } else if (id === "train") {
        [220, 277, 330].forEach((f, i) => voice(a, "sawtooth", f * k * (1 + (i - 1) * 0.004), t, 0.6, 0.08, "lowpass", 950));
    } else {
        // Classic Beep (2D playHonkPitched): BEEP-BEEP at the chain pitch
        for (let b = 0; b < 2; b++) {
            const tt = t + b * 0.12;
            const osc = a.createOscillator(), g = a.createGain();
            osc.type = "square"; osc.frequency.value = (note || 262) * 1.55 + b * 30;
            g.gain.setValueAtTime(0.13, tt);
            g.gain.setValueAtTime(0.13, tt + 0.06);
            g.gain.exponentialRampToValueAtTime(0.001, tt + 0.12);
            const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
            osc.connect(lp).connect(g).connect(out);
            osc.start(tt); osc.stop(tt + 0.13);
        }
    }
    return true;
}

// The classic horn can be HELD (lean on it!) — a two-tone square, like the
// core horn, but pitched by the Symphony note. The train horn holds too.
let held = null;
export function holdHorn(on, id = "beep", note = 262) {
    const a = on ? ready() : ac;
    if (!a) return;
    const t = a.currentTime;
    if (on && !held) {
        const k = Math.max(1, Math.min(2, note / 262));
        const g = a.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(id === "train" ? 0.08 : 0.13, t + 0.03);
        const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = id === "train" ? 950 : 1800;
        const freqs = id === "train" ? [220, 277, 330] : [415, 523];
        const oscs = freqs.map(f => { const o = a.createOscillator(); o.type = id === "train" ? "sawtooth" : "square"; o.frequency.value = f * k; o.connect(lp); o.start(t); return o; });
        lp.connect(g).connect(out);
        held = { g, oscs };
    } else if (!on && held) {
        const h = held; held = null;
        h.g.gain.setTargetAtTime(0, t, 0.03);
        for (const o of h.oscs) o.stop(t + 0.25);
    }
}
export const hornHeld = () => !!held;

// ── shop + item SFX ──────────────────────────────────────────────────────
export function sfxBuy() { tone(523, 0.08, "triangle", 0.2); tone(659, 0.08, "triangle", 0.2, 0, 0.07); tone(784, 0.12, "triangle", 0.2, 0, 0.14); }
export function sfxDeny() { tone(180, 0.15, "square", 0.15); }
export function sfxClick() { tone(700, 0.04, "square", 0.06); }
export function sfxEquip() { tone(660, 0.07, "triangle", 0.16, 990); tone(990, 0.1, "triangle", 0.16, 1320, 0.07); }
export function sfxMissile() {
    tone(200, 0.4, "sawtooth", 0.13, 600);
    noiseHit(0.55, 0.22, 600, 3200, "bandpass", 0, 1.2);
}
export function sfxExplosion(power = 1) {
    noiseHit(0.6, 0.42 * power, 2000, 200);
    noiseHit(1.1, 0.2 * power, 600, 60, "lowpass", 0.05);
    tone(90, 0.45, "sine", 0.45 * power, 38);
}
export function sfxPssst() { tone(540, 0.05, "sawtooth", 0.09, 240); noiseHit(0.35, 0.16, 5200, 2400, "highpass"); }
export function sfxWhiff() { tone(300, 0.08, "sawtooth", 0.05); }
export function sfxShieldPop() { tone(1200, 0.25, "sine", 0.18, 300); noiseHit(0.25, 0.15, 6000, 900, "bandpass", 0, 2); }
export function sfxShieldUp() { tone(320, 0.35, "sine", 0.1, 960); }
export function sfxPhone() { tone(1318, 0.06, "sine", 0.08); tone(1568, 0.08, "sine", 0.08, 0, 0.08); }
