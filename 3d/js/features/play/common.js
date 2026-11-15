// features/play — shared plumbing for the playground: the save namespace, a
// tiny WebAudio synth (chimes, shutter, whoosh, thump), road helpers and the
// per-frame "world tick" the dreidels / ramps / confetti hang off.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { store, saveSoon, save3d } from "../../core/save.js";
import { registerModels } from "../../models.js";
import * as A from "../../audio.js";

export const ID = "play";

/** 3D-only progress (lulu3dSave → f.play). The photo album keeps small JPEG thumbnails. */
export const SAVE = store(ID, {
    dreidels: 0,        // lifetime golden dreidels
    milestones: 0,      // CHAI! rewards earned (every 18)
    jumps: 0, bestAir: 0, spins: 0, leapfrogs: 0,
    photos: 0,
    album: [],          // [{ img: "data:image/jpeg…", t, place, filter, frame }] newest first, max ALBUM_MAX
    filter: 0, frame: 0,
});
export const ALBUM_MAX = 6;
export { saveSoon };

/** Random roadside content (dreidels, ramps, parked trucks) only when the feature is on. */
export const enabled = () => ctx.enabled(ID);

// Models are part of the driving set pieces (built in chunk:build) → load them at boot.
registerModels({ play_dreidel: "play_dreidel", play_ramp: "play_ramp" }, { preload: true });

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function stat(id, n = 1) { emit("stat", { id, n }); }

/** Lulu's car visual height (the ramp/jump lift), so pickups and the photo camera know it. */
export const lift = { y: 0 };

// ── one tick per rendered frame for everything animated on the road ──────
// (called from every chunk's onAnimate → deduped by frame number; runs while
// the world streams, also during pause/photo mode like the core coins do)
const ticks = [];
export function onWorldTick(fn) { ticks.push(fn); }
let lastFrame = -1, lastTime = 0;
export function worldTick(time) {
    if (ctx.frames === lastFrame) return;
    lastFrame = ctx.frames;
    const dt = Math.min(0.1, Math.max(0, time - lastTime));
    lastTime = time;
    for (const fn of ticks) { try { fn(time, dt); } catch (e) { console.error("[play tick]", e); } }
}

// ── a tiny synth (feature sounds stay quiet while a cutscene is skipped) ──
let ac = null, out = null, noiseBuf = null;
function actx() {
    if (save3d.sound === false || ctx.skipping || !A.audio.ready) return null;
    try {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            ac = new AC();
            out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
            const len = ac.sampleRate;
            noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { return null; }
    return ac;
}
for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, () => { if (ac && ac.state === "suspended") ac.resume().catch(() => {}); }, { passive: true });

function tone(freq, dur, type = "sine", vol = 0.12, when = 0, slideTo = 0) {
    const c = actx(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, when = 0, f0 = 1200, f1 = 0, type = "bandpass", q = 0.8) {
    const c = actx(); if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.05);
}

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
export const sfx = {
    /** Golden dreidel pickup: a little bell that climbs with the streak. */
    chime(n = 0) {
        const base = 880 * Math.pow(2, PENTA[Math.min(PENTA.length - 1, n)] / 12);
        tone(base, 0.5, "sine", 0.11);
        tone(base * 2.01, 0.32, "sine", 0.045, 0.004);
        tone(base * 1.5, 0.4, "triangle", 0.04, 0.05);
    },
    /** CHAI! milestone jingle. */
    jingle() {
        [0, 4, 7, 12, 16].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.35, "triangle", 0.09, i * 0.08));
        tone(1320 * Math.pow(2, 7 / 12), 0.8, "sine", 0.06, 0.42);
    },
    /** Camera shutter: two quick mechanical clicks + a breath of noise. */
    shutter() {
        noise(0.035, 0.35, 0, 3800, 0, "highpass", 0.7);
        tone(1900, 0.03, "square", 0.05, 0.002);
        noise(0.05, 0.3, 0.075, 2600, 0, "highpass", 0.7);
        tone(1400, 0.04, "square", 0.04, 0.078);
    },
    click() { tone(1500, 0.04, "triangle", 0.05); },
    /** Off the lip: a rising whoosh. */
    whoosh(power = 1) {
        noise(0.55, 0.16 * power, 0, 500, 2600, "bandpass", 1.2);
        tone(220, 0.35, "sine", 0.05 * power, 0, 420);
    },
    /** Touchdown: a springy thump. */
    land(power = 1) {
        tone(120, 0.28, "sine", 0.2 * Math.min(1.4, power), 0, 55);
        noise(0.22, 0.18 * Math.min(1.4, power), 0, 700, 180, "lowpass", 0.7);
        tone(330, 0.16, "triangle", 0.04, 0.05, 520);   // the boing
    },
    /** Trick landed: quick happy arpeggio. */
    trick(steps = 3) {
        for (let i = 0; i < steps; i++) tone(523 * Math.pow(2, PENTA[i * 2] / 12), 0.22, "square", 0.045, i * 0.06);
    },
    wobble() { tone(300, 0.4, "sine", 0.07, 0, 180); tone(200, 0.3, "sine", 0.05, 0.12, 260); },
};

// ── road helpers ─────────────────────────────────────────────────────────
const _p = {};
export function roadPoint(s, d, out = _p) { return ctx.world.road.point(s, d, out); }

/** A soft round texture (shadow blobs, glows). */
export function radialTexture(inner = "rgba(0,0,0,0.55)", outer = "rgba(0,0,0,0)", size = 64) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, inner);
    grd.addColorStop(0.55, inner.replace(/[\d.]+\)$/, m => (parseFloat(m) * 0.6).toFixed(2) + ")"));
    grd.addColorStop(1, outer);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Inline SVG of a little gold dreidel (HUD chip, toasts). */
export const DREIDEL_SVG = `<svg class="pl-dr" viewBox="0 0 24 30" aria-hidden="true"><rect x="10.5" y="0.5" width="3" height="6" rx="1.4" fill="#E0A100"/><rect x="4" y="6" width="16" height="15" rx="3" fill="#FFC233" stroke="#B37400" stroke-width="1.2"/><path d="M5 20.5 L12 29 L19 20.5 Z" fill="#F0A800" stroke="#B37400" stroke-width="1.2" stroke-linejoin="round"/><text x="12" y="17.5" font-size="10" font-weight="700" text-anchor="middle" fill="#2340B8" font-family="Arial, sans-serif">ג</text></svg>`;
