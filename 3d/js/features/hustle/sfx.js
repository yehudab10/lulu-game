// features/hustle — tiny WebAudio synth: radio static + talk-radio babble, the
// payphone bell, the bingo-hall alarm, ka-ching, splosh, hop-in boing. Own
// context (like banter / garage); quiet while skipping or with Sound off.
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";

let ac = null, out = null, noise = null;
function audio() {
    if (save3d.sound === false || ctx.skipping) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); } catch (e) { return null; }
        out = ac.createGain();
        out.gain.value = 0.55;
        out.connect(ac.destination);
        const len = ac.sampleRate;
        noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac.state === "running" ? ac : null;
}
const unlock = () => { audio(); };
window.addEventListener("pointerdown", unlock, { passive: true });
window.addEventListener("keydown", unlock, { passive: true });

function tone(f, dur, { type = "sine", vol = 0.12, at = 0, slide = 0, lp = 0 } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f2 = a.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.03);
}
function hiss(dur, { vol = 0.12, at = 0, f0 = 1800, f1 = 600, q = 1.2, type = "bandpass" } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const s = a.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    const bp = a.createBiquadFilter();
    bp.type = type; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bp).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
}

/** Between stations: a burst of crackly static that sweeps down, plus the dial's squeal. */
export function radioStatic() {
    hiss(0.42, { vol: 0.16, f0: 3200, f1: 500, q: 0.8 });
    hiss(0.18, { vol: 0.09, f0: 900, f1: 2400, q: 6, at: 0.05 });
    tone(1400 + Math.random() * 900, 0.22, { type: "sine", vol: 0.035, slide: 300 + Math.random() * 300, at: 0.04 });
}
/** Talk radio: a few AM-radio "voice" blips (no words — the ticker has those). */
export function babble(n = 9, low = false) {
    for (let i = 0; i < n; i++) {
        const f = (low ? 120 : 165) + Math.random() * 90;
        tone(f, 0.07 + Math.random() * 0.05, { type: "square", vol: 0.022, at: i * 0.105 + Math.random() * 0.03, lp: 900, slide: f * (0.85 + Math.random() * 0.3) });
    }
}
/** The payphone: a classic double trill. */
export function ring() {
    for (let i = 0; i < 10; i++) {
        tone(i % 2 ? 480 : 440, 0.05, { type: "triangle", vol: 0.05, at: i * 0.05 });
        tone(i % 2 ? 1320 : 1100, 0.04, { type: "sine", vol: 0.02, at: i * 0.05 });
    }
}
export function pickUp() { tone(320, 0.05, { type: "square", vol: 0.05, lp: 1200 }); tone(240, 0.06, { type: "square", vol: 0.04, at: 0.06, lp: 1200 }); }
export function kaching() {
    tone(1568, 0.09, { type: "square", vol: 0.05 });
    tone(2093, 0.25, { type: "square", vol: 0.05, at: 0.07 });
    hiss(0.12, { vol: 0.05, f0: 5000, f1: 3000, q: 2, at: 0.02 });
}
export function hop() { tone(330, 0.14, { type: "triangle", vol: 0.07, slide: 660 }); }
export function plop() { tone(520, 0.12, { type: "triangle", vol: 0.06, slide: 260 }); }
export function splosh() { hiss(0.28, { vol: 0.12, f0: 900, f1: 200, q: 0.9, type: "lowpass" }); tone(180, 0.16, { type: "sine", vol: 0.08, slide: 90 }); }
/** The bingo hall's alarm bell (a few seconds of panic). */
export function alarm(secs = 2.4) {
    const n = Math.floor(secs / 0.06);
    for (let i = 0; i < n; i++) tone(i % 2 ? 960 : 880, 0.05, { type: "square", vol: 0.035, at: i * 0.06, lp: 2600 });
}
export function door() { hiss(0.9, { vol: 0.07, f0: 300, f1: 900, q: 1.5 }); for (let i = 0; i < 6; i++) tone(90 + i * 6, 0.06, { type: "square", vol: 0.03, at: i * 0.14, lp: 500 }); }
export function sadTrombone() { [392, 370, 349, 294].forEach((f, i) => tone(f, i === 3 ? 0.7 : 0.32, { type: "sawtooth", vol: 0.05, at: i * 0.32, lp: 1400, slide: i === 3 ? 260 : 0 })); }
export function feathers() { for (let i = 0; i < 3; i++) tone(900 + Math.random() * 500, 0.06, { type: "square", vol: 0.03, at: i * 0.07, slide: 1500 }); }
