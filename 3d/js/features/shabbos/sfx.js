// features/shabbos — a tiny WebAudio synth (own context, like hustle / banter):
// the last-seconds tick, the candle-lighting chime, a shop gate rattling down,
// a startled yelp. Quiet while skipping or with Sound off.
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
function tone(f, dur, { type = "sine", vol = 0.1, at = 0, slide = 0 } = {}) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
}
/** The clock in the last ten seconds. */
export function tick(urgent = false) { tone(urgent ? 1320 : 990, 0.07, { type: "square", vol: 0.05 }); }
/** Candles lit: a soft rising chime. */
export function candles() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.9, { vol: 0.07, at: i * 0.16 })); }
/** A roll-down shop gate: a quick metallic rattle. */
export function gate() { for (let i = 0; i < 9; i++) tone(180 + (i % 3) * 40, 0.05, { type: "sawtooth", vol: 0.025, at: i * 0.045 }); tone(90, 0.25, { type: "square", vol: 0.05, at: 0.42 }); }
/** "Oy!" — somebody hopping out of the way. */
export function yelp() { tone(700, 0.18, { type: "triangle", vol: 0.05, slide: 1100 }); }
/** Too late: a sad little slide. */
export function late() { tone(392, 0.35, { type: "triangle", vol: 0.07 }); tone(330, 0.5, { type: "triangle", vol: 0.07, at: 0.3, slide: 262 }); }
