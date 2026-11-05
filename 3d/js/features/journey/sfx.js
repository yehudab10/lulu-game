// features/journey/sfx.js — a few synthesized sounds the journey needs that
// core audio.js doesn't have (phone ring, a van's honk, gulls, splashes, the
// arrival jingle, slot-machine dice). Its own small AudioContext, created only
// after core audio has been unlocked by a user gesture.
import { audio } from "../../audio.js";

let ac = null, out = null;
function ctx() {
    if (!audio.ready) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ac = new AC();
        out = ac.createGain();
        out.gain.value = 0.7;
        out.connect(ac.destination);
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
}
export function setVolume(v) { if (out) out.gain.value = v; }

function tone(freq, dur, type = "sine", vol = 0.15, when = 0, slide = 0) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.03);
}
function noise(dur, freq, q, vol, when = 0) {
    const a = ctx();
    if (!a) return;
    const t = a.currentTime + when;
    const len = Math.ceil(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource(); src.buffer = buf;
    const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
    const g = a.createGain(); g.gain.value = vol;
    src.connect(bp).connect(g).connect(out);
    src.start(t);
}

/** brrring-brrring (one beat; call every 0.8 s while ringing). */
export function ring() { tone(880, 0.08, "sine", 0.12); tone(988, 0.08, "sine", 0.12, 0.11); }
export function pickUp() { tone(660, 0.06, "triangle", 0.12); }
export function hangUp() { tone(520, 0.08, "triangle", 0.1); tone(390, 0.1, "triangle", 0.1, 0.09); }
/** A little C–E–G arrival jingle. */
export function jingle() { tone(523, 0.12, "sine", 0.18); tone(659, 0.12, "sine", 0.18, 0.12); tone(784, 0.18, "sine", 0.2, 0.24); }
export function chime(a = 523, b = 659) { tone(a, 0.09, "sine", 0.12); tone(b, 0.09, "sine", 0.1, 0.12); }
export function honk() {
    const a = ctx();
    if (!a) return;
    for (const f of [392, 494]) tone(f, 0.35, "square", 0.05);
}
export function squawk() { tone(1300, 0.14, "sawtooth", 0.05, 0, 700); tone(1200, 0.12, "sawtooth", 0.04, 0.18, 650); }
export function splash() { noise(0.6, 900, 0.7, 0.5); noise(0.4, 2400, 1.2, 0.2, 0.05); }
export function dice() { for (let i = 0; i < 6; i++) tone(700 + i * 90, 0.05, "square", 0.05, i * 0.06); tone(1320, 0.3, "triangle", 0.12, 0.4); }
export function pop() { tone(500, 0.08, "triangle", 0.1, 0, 700); }
