// Tiny WebAudio tone helper for the parking + Shared Road features — the 2D
// game's playTone(freq, dur, type, vol, sweepTo) chimes, beeps and stings.
// It keeps its own AudioContext (core/audio.js doesn't export its synth), only
// starts after the first user gesture, and respects the Sound setting.
import { save3d } from "../../core/save.js";

let ac = null, out = null;
function ready() {
    if (save3d.sound === false) return false;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try { ac = new AC(); } catch (e) { return false; }
        out = ac.createGain();
        out.gain.value = 0.55;
        out.connect(ac.destination);
        const resume = () => { if (ac.state === "suspended") ac.resume().catch(() => {}); };
        window.addEventListener("pointerdown", resume, { passive: true });
        window.addEventListener("keydown", resume, { passive: true });
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac.state !== "closed";
}

/** playTone(freq, seconds, "sine"|"square"|"triangle"|"sawtooth", volume, sweepTo, delaySeconds) */
export function tone(freq, dur = 0.1, type = "sine", vol = 0.15, sweepTo = 0, delay = 0) {
    if (!ready()) return;
    try {
        const t = ac.currentTime + delay;
        const o = ac.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t);
        if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.03);
    } catch (e) { /* audio is optional */ }
}

/** A list of [freq, dur, type, vol] notes, spaced `gap` seconds apart. */
export function notes(list, gap = 0.1) {
    list.forEach((n, i) => tone(n[0], n[1], n[2] || "triangle", n[3] || 0.18, n[4] || 0, i * gap));
}

/** The 2D game's "womp womp" fail sting. */
export function wompWomp() {
    [392, 370, 349, 330].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.17, "sawtooth", 0.12, f * 0.6, i * 0.2));
}

/** Short noise-ish thud (crash crunch layer). */
export function crunch(power = 1) {
    tone(180, 0.18, "sawtooth", 0.18 * power);
    tone(90, 0.12, "square", 0.1 + power * 0.08);
}
