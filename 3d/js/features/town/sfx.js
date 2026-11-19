// features/town — a tiny WebAudio synth for the town: goose honks, minivan horns (the
// two-tone "beep-BEEP" of a hundred carpools), the speed-bump THUNK, an e-bike bell.
// Own context (like hustle / banter); quiet while skipping or with Sound off.
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";

let ac = null, out = null;
function audio() {
    if (save3d.sound === false || ctx.skipping || ctx.TEST) return null;
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
window.addEventListener("pointerdown", () => audio(), { passive: true });
window.addEventListener("keydown", () => audio(), { passive: true });

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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f2 = a.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.05);
}
/** vol: 0..1 by distance. */
export function goose(vol = 1) {
    const v = 0.1 * vol;
    tone(520, 0.16, { type: "sawtooth", vol: v, slide: 430, lp: 1400 });
    tone(540, 0.2, { type: "sawtooth", vol: v, at: 0.2, slide: 420, lp: 1300 });
}
export function minivanHorn(vol = 1) {
    tone(392, 0.18, { type: "square", vol: 0.05 * vol, lp: 1800 });
    tone(466, 0.32, { type: "square", vol: 0.05 * vol, at: 0.22, lp: 1800 });
}
export function thunk(power = 1) { tone(90, 0.16, { type: "sine", vol: 0.25 * Math.min(1, power), slide: 50 }); tone(140, 0.06, { type: "triangle", vol: 0.08 * power }); }
export function bell() { tone(1760, 0.18, { type: "triangle", vol: 0.05 }); tone(1760, 0.22, { type: "triangle", vol: 0.05, at: 0.12 }); }
export function ping() { tone(1318, 0.09, { type: "sine", vol: 0.06 }); tone(1760, 0.12, { type: "sine", vol: 0.05, at: 0.08 }); }
/** A pigeon's coo (vol: 0..1 by distance). */
export function coo(vol = 1) { tone(330, 0.22, { type: "sine", vol: 0.07 * vol, slide: 280, lp: 900 }); tone(300, 0.3, { type: "sine", vol: 0.06 * vol, at: 0.26, slide: 250, lp: 800 }); }
/** The subway's door chime (ding… dong): stand clear of the closing doors, please. */
export function chime(vol = 1) { tone(988, 0.35, { type: "sine", vol: 0.06 * vol }); tone(784, 0.5, { type: "sine", vol: 0.06 * vol, at: 0.32 }); }
// a train going over: a looping band of low noise whose loudness follows the nearest train (0 = silent)
let rum = null;
export function rumble(vol) {
    const a = vol > 0.01 || rum ? audio() : null;
    if (!a) return;
    if (!rum) {
        const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) { last = (last + (Math.random() * 2 - 1) * 0.08) * 0.985; d[i] = last * 4 * (1 + 0.35 * Math.sin(i / a.sampleRate * Math.PI * 2 * 6)); }
        const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260;
        const g = a.createGain(); g.gain.value = 0;
        src.connect(lp); lp.connect(g); g.connect(out); src.start();
        rum = { src, g };
    }
    rum.g.gain.setTargetAtTime(Math.min(1, vol) * 0.5, a.currentTime, 0.12);
}
export function rumbleStop() { if (rum) { try { rum.src.stop(); } catch (e) { /* stopped */ } rum = null; } }
/** A bumped parked car's alarm: a few rising whoops (vol 0..1). */
export function alarm(vol = 1) {
    for (let k = 0; k < 4; k++) tone(620, 0.24, { type: "square", vol: 0.035 * vol, at: k * 0.28, slide: 1240, lp: 2200 });
}
