// features/law — synthesized sound: the pursuit siren (a real wail whose
// loudness and pitch follow the nearest cruiser — a touch of Doppler), the
// cuffs, the gavel, the mugshot camera, lock pins, a K9 bark, womp-womp…
//
// The core audio module doesn't expose its AudioContext, so the law feature
// keeps a tiny one of its own. It's created lazily once the core audio is
// unlocked (a user gesture has happened by then) and follows the Sound setting.
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { audio } from "../../audio.js";

let ac = null, out = null, siren = null, noise = null;

function ready() {
    if (ctx.TEST) return false;
    if (!ac) {
        if (!audio.ready) return false;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        try { ac = new AC(); } catch (e) { return false; }
        out = ac.createGain();
        out.gain.value = 0.8;
        out.connect(ac.destination);
        const len = ac.sampleRate;
        noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    out.gain.value = save3d.sound === false ? 0 : 0.8;
    return true;
}

function tone(freq, dur, type = "sine", vol = 0.2, when = 0, slideTo = 0) {
    if (!ready()) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.03);
}
function burst(dur, freq, q, vol, when = 0) {
    if (!ready()) return;
    const t = ac.currentTime + when;
    const s = ac.createBufferSource();
    s.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t); s.stop(t + dur + 0.02);
}

// ── the siren ────────────────────────────────────────────────────────────
function buildSiren() {
    const o = ac.createOscillator(); o.type = "sawtooth";
    const o2 = ac.createOscillator(); o2.type = "square";
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
    const g = ac.createGain(); g.gain.value = 0;
    const g2 = ac.createGain(); g2.gain.value = 0.25;
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
    o.start(); o2.start();
    siren = { o, o2, g, lp, phase: 0 };
}
/**
 * Every frame: loud = 0..1 (distance falloff), closing = m/s the cruiser closes
 * on Lulu (Doppler), mode "wail" | "yelp". loud 0 silences it.
 */
export function sirenUpdate(dt, loud, closing = 0, mode = "wail") {
    if (!loud && !siren) return;
    if (!ready()) return;
    if (!siren) buildSiren();
    const t = ac.currentTime;
    siren.phase += dt * (mode === "yelp" ? 3.2 : 0.42);
    const w = (Math.sin(siren.phase * Math.PI * 2) + 1) / 2;
    const base = 640 + w * 560;
    const dop = Math.max(0.85, Math.min(1.15, 1 + closing / 340));
    const f = base * dop;
    siren.o.frequency.setTargetAtTime(f, t, 0.02);
    siren.o2.frequency.setTargetAtTime(f * 1.01, t, 0.02);
    const vol = ctx.paused ? 0 : Math.max(0, Math.min(1, loud)) * 0.11;
    siren.g.gain.setTargetAtTime(vol, t, 0.08);
}
export function sirenOff() { if (siren && ac) siren.g.gain.setTargetAtTime(0, ac.currentTime, 0.1); }

/** The "whoop-whoop" when a cruiser lights up. */
export function whoop() { tone(680, 0.25, "sawtooth", 0.13, 0, 460); tone(460, 0.25, "sawtooth", 0.13, 0.24, 680); }
export function chirp() { tone(900, 0.12, "sine", 0.13, 0, 1320); tone(1320, 0.12, "sine", 0.13, 0.16, 900); }
export function wompWomp() { tone(392, 0.32, "triangle", 0.14, 0, 370); tone(311, 0.6, "triangle", 0.14, 0.34, 262); }
export function cuffClick() { tone(1200, 0.05, "square", 0.13); tone(1500, 0.04, "square", 0.12, 0.07); }
export function doorThunk() { tone(220, 0.08, "square", 0.12); burst(0.12, 300, 1.2, 0.2); }
export function shutter() { burst(0.05, 4000, 2, 0.25); tone(1400, 0.04, "sine", 0.12, 0.02); }
export function gavel() { burst(0.09, 700, 1.5, 0.5); tone(150, 0.12, "square", 0.18); }
export function pin(n) { tone(740 + n * 80, 0.06, "sine", 0.12); }
export function miss() { tone(150, 0.12, "square", 0.16); }
export function unlock() { tone(988, 0.14, "triangle", 0.2); tone(1318, 0.18, "triangle", 0.16, 0.12); }
export function caught() { tone(90, 0.3, "square", 0.16); }
export function blip(who) { tone(who === "cop" || who === "judge" ? 300 : 620, 0.04, "sine", 0.06); }
export function lost() { tone(659, 0.1, "triangle", 0.2); tone(988, 0.12, "triangle", 0.2, 0.09); }
export function cellSlam() { tone(110, 0.5, "square", 0.12); tone(80, 0.4, "square", 0.12, 0.22); burst(0.3, 500, 0.8, 0.3); }
export function bark() { tone(380, 0.08, "sawtooth", 0.16, 0, 240); tone(330, 0.1, "sawtooth", 0.14, 0.11, 200); }
export function missileLaunch() { tone(300, 0.3, "sawtooth", 0.12, 0, 140); burst(0.4, 900, 0.7, 0.2); }
export function boom() { burst(0.6, 220, 0.6, 0.6); tone(70, 0.4, "sine", 0.4, 0, 35); }
export function ringRing() { for (let i = 0; i < 3; i++) tone(1180, 0.12, "sine", 0.13, i * 0.22); }
export function triumphant() { tone(523, 0.1, "triangle", 0.16); tone(784, 0.14, "triangle", 0.16, 0.12); tone(1047, 0.18, "triangle", 0.16, 0.26); }
export function chime() { tone(587, 0.12, "triangle", 0.12); tone(880, 0.16, "triangle", 0.12, 0.13); }
export function gasp() { tone(300, 0.35, "sine", 0.11, 0, 720); }
export function ominous() { tone(160, 0.22, "sawtooth", 0.15, 0, 110); }
export function deny() { tone(180, 0.15, "square", 0.15); }
export function coins() { for (let i = 0; i < 4; i++) tone(988 * (1 + i * 0.12), 0.08, "square", 0.06, i * 0.06); }
export function work(n) { tone(360 + (n % 6) * 26, 0.04, "square", 0.08); }
export function rotorThump(loud) { if (loud > 0.05) burst(0.06, 120, 0.9, 0.35 * loud); }
