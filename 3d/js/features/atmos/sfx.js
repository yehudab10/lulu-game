// features/atmos/sfx.js — synthesized weather + wildlife sounds (own small
// AudioContext, like the journey's): a rain loop, thunder, bird chirps and wing
// flutters, the banner plane's little propeller. Silent while muted, paused or
// skipping a cutscene, and before core audio has been unlocked by a gesture.
import { audio } from "../../audio.js";
import { ctx as game } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";

let ac = null, out = null, white = null, brown = null;
const loops = {};

function get() {
    if (!audio.ready) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try {
            ac = new AC();
            out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
            const n = ac.sampleRate * 2;
            white = ac.createBuffer(1, n, ac.sampleRate);
            brown = ac.createBuffer(1, n, ac.sampleRate);
            const w = white.getChannelData(0), b = brown.getChannelData(0);
            let last = 0;
            for (let i = 0; i < n; i++) {
                const r = Math.random() * 2 - 1;
                w[i] = r;
                last = (last + 0.02 * r) / 1.02; b[i] = last * 3.5;
            }
        } catch (e) { ac = null; return null; }
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
}
const quiet = () => save3d.sound === false || game.skipping || game.paused;

function noiseSrc(a, buf) { const s = a.createBufferSource(); s.buffer = buf; s.loop = true; return s; }

/** Continuous rain hiss (0..1), with a softer patter layer. */
export function rainLoop(level) {
    const a = ac || (level > 0.01 ? get() : null);
    if (!a) return;
    let L = loops.rain;
    if (!L) {
        if (level < 0.01) return;
        const src = noiseSrc(a, white);
        const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
        const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 7000;
        const g = a.createGain(); g.gain.value = 0;
        src.connect(hp).connect(lp).connect(g).connect(out);
        const src2 = noiseSrc(a, brown);
        const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 380; bp.Q.value = 0.7;
        const g2 = a.createGain(); g2.gain.value = 0;
        src2.connect(bp).connect(g2).connect(out);
        src.start(); src2.start();
        L = loops.rain = { g, g2 };
    }
    const v = quiet() ? 0 : level;
    L.g.gain.setTargetAtTime(v * 0.075, a.currentTime, 0.4);
    L.g2.gain.setTargetAtTime(v * 0.2, a.currentTime, 0.4);
}

/** A propeller drone (0..1) for the banner plane. */
export function propLoop(level) {
    const a = ac || (level > 0.01 ? get() : null);
    if (!a) return;
    let L = loops.prop;
    if (!L) {
        if (level < 0.01) return;
        const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = 88;
        const lfo = a.createOscillator(); lfo.frequency.value = 23;
        const lg = a.createGain(); lg.gain.value = 0.35;
        const am = a.createGain(); am.gain.value = 0.65;
        lfo.connect(lg).connect(am.gain);
        const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 520;
        const g = a.createGain(); g.gain.value = 0;
        o.connect(am).connect(lp).connect(g).connect(out);
        o.start(); lfo.start();
        L = loops.prop = { g };
    }
    L.g.gain.setTargetAtTime(quiet() ? 0 : level * 0.05, a.currentTime, 0.3);
}

/** Thunder: `near` 0 (far, a low grumble) … 1 (close, a crack and a long roll). */
export function thunder(near = 0.5) {
    const a = get();
    if (!a || quiet()) return;
    const t = a.currentTime;
    const src = a.createBufferSource(); src.buffer = brown;
    const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(260 + near * 500, t); lp.frequency.exponentialRampToValueAtTime(90, t + 3.5);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 + near * 0.5, t + 0.08 + (1 - near) * 0.4);
    g.gain.exponentialRampToValueAtTime(0.25, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8 + near);
    src.connect(lp).connect(g).connect(out);
    src.start(t, Math.random()); src.stop(t + 5);
    if (near > 0.55) {   // the crack
        const c = a.createBufferSource(); c.buffer = white;
        const hp = a.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 1200;
        const cg = a.createGain();
        cg.gain.setValueAtTime(0.0001, t); cg.gain.exponentialRampToValueAtTime(0.18 * near, t + 0.01); cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        c.connect(hp).connect(cg).connect(out);
        c.start(t); c.stop(t + 0.4);
    }
}

/** A few quick bird chirps. */
export function chirps(n = 4, vol = 0.05) {
    const a = get();
    if (!a || quiet()) return;
    const t0 = a.currentTime;
    for (let i = 0; i < n; i++) {
        const t = t0 + i * 0.07 + Math.random() * 0.12;
        const o = a.createOscillator(), g = a.createGain();
        o.type = "sine";
        const f = 2600 + Math.random() * 1800;
        o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.35 : 0.75), t + 0.06);
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        o.connect(g).connect(out); o.start(t); o.stop(t + 0.1);
    }
}

/** Wings: a burst of soft flaps. */
export function flutter(vol = 0.12) {
    const a = get();
    if (!a || quiet()) return;
    const t0 = a.currentTime;
    for (let i = 0; i < 9; i++) {
        const t = t0 + i * 0.045 + Math.random() * 0.02;
        const s = a.createBufferSource(); s.buffer = white;
        const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 700 + Math.random() * 500; bp.Q.value = 0.9;
        const g = a.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * (1 - i / 12), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
        s.connect(bp).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + 0.06);
    }
}

/** Everything continuous off (title, interiors). */
export function hush() { rainLoop(0); propLoop(0); }
