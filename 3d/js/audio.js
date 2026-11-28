// All sound is synthesized with WebAudio (engine, wind, tires, horn, coins,
// crashes) except the music, which reuses the 2D game's driving track.
// Positional sounds (sirens, passing cars, horns, the train…) go through
// `spatial` (./spatial.js) on this same AudioContext; the music can be muffled
// (`setMusicMuffle`: a lowpass through a MediaElementSource — Lulu on foot).
import { spatial, initSpatial } from "./spatial.js";
export { spatial };

let ctx = null, master = null, sfxBus = null;
let engine = null, wind = null, screech = null, hornNodes = null;
let music = null, musicOn = true, muted = false;
let noiseBuf = null;

export const audio = {
    get ready() { return !!ctx && ctx.state === "running"; },
    get started() { return !!ctx; },
    get musicOn() { return musicOn; },
};

function makeNoise() {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
}

function noiseSource() {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    return s;
}

/** Call from a user gesture (click / key / touch). Safe to call repeatedly. */
export function unlockAudio() {
    if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : 0.9;
        master.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.8;
        sfxBus.connect(master);
        noiseBuf = makeNoise();
        buildEngine();
        buildWind();
        buildScreech();
        initSpatial(ctx, master);
    }
    // "suspended" (autoplay policy) or iOS's "interrupted" (a call, an ad, the app backgrounded)
    if (ctx.state !== "running" && ctx.state !== "closed") ctx.resume().catch(() => {});
    if (musicOn && music && music.paused) music.play().catch(() => {});
    probeVolume();
}

function buildEngine() {
    const out = ctx.createGain();
    out.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 900;
    lp.Q.value = 2;
    const o1 = ctx.createOscillator(); o1.type = "sawtooth";
    const o2 = ctx.createOscillator(); o2.type = "square";
    const o3 = ctx.createOscillator(); o3.type = "sine";
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    const g3 = ctx.createGain(); g3.gain.value = 0.6;
    o1.connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(out);
    lp.connect(out);
    out.connect(sfxBus);
    o1.start(); o2.start(); o3.start();
    engine = { out, lp, o1, o2, o3 };
}

function buildWind() {
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp).connect(g).connect(sfxBus);
    src.start();
    wind = { g, bp };
}

function buildScreech() {
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 2400; bp.Q.value = 8;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(bp).connect(g).connect(sfxBus);
    src.start();
    screech = { g, bp };
}

/**
 * Per-frame engine/ambience update.
 * speed m/s, throttle 0..1, slip 0..1 (tire squeal), rough 0..1 (off-road rumble)
 */
export function updateEngine(speed, throttle, slip, rough, boosting, active) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const v = Math.abs(speed);
    // Fake a 5-speed gearbox so the pitch climbs, drops on each shift, climbs again.
    const gearTop = [0, 9, 17, 25, 34, 44, 60];
    let g = 1;
    while (g < gearTop.length - 1 && v > gearTop[g]) g++;
    const lo = gearTop[g - 1], hi = gearTop[g];
    const frac = Math.min(1, (v - lo) / (hi - lo));
    const rpm = 0.18 + frac * 0.72 + throttle * 0.1;
    const f = 38 + rpm * 120 + g * 6 + (boosting ? 18 : 0);
    const vol = active ? 0.07 + throttle * 0.07 + Math.min(v / 40, 1) * 0.04 : 0;
    engine.o1.frequency.setTargetAtTime(f, t, 0.05);
    engine.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    engine.o3.frequency.setTargetAtTime(f * 0.25, t, 0.05);
    engine.lp.frequency.setTargetAtTime(500 + throttle * 1300 + rpm * 600, t, 0.08);
    engine.out.gain.setTargetAtTime(vol, t, 0.08);
    wind.g.gain.setTargetAtTime(active ? Math.min(0.16, (v / 45) ** 2 * 0.16) + rough * 0.12 : 0, t, 0.15);
    wind.bp.frequency.setTargetAtTime(rough > 0 ? 180 : 380 + v * 12, t, 0.2);
    screech.g.gain.setTargetAtTime(active ? Math.min(0.12, slip * 0.14) : 0, t, 0.05);
}

function blip(freq, dur, type = "sine", vol = 0.25, when = 0, slideTo = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t);
    o.stop(t + dur + 0.02);
}

export function sfxCoin(combo = 0) {
    const base = 988 * Math.pow(1.059, Math.min(combo, 12));
    blip(base, 0.09, "square", 0.08);
    blip(base * 1.335, 0.16, "square", 0.08, 0.07);
}

export function sfxCloseCall(n) {
    blip(520 + n * 60, 0.12, "triangle", 0.18, 0, 900 + n * 80);
}

export function sfxBoost() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    src.connect(bp).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + 1);
}

export function sfxCrash(power = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.6 * power, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(lp).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + 0.8);
    blip(90, 0.35, "sine", 0.5 * power, 0, 40);
    // a little glass tinkle
    for (let i = 0; i < 4; i++) blip(2400 + Math.random() * 2400, 0.08, "triangle", 0.05, 0.05 + i * 0.05);
}

/** A LOUD muffler backfiring as she lifts off (features/carcare): a short low crack + a thump (vol 0..1). */
export function sfxPop(vol = 1) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = noiseSource();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900 + Math.random() * 500, t);
    bp.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    src.connect(bp).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + 0.13);
    blip(70 + Math.random() * 20, 0.09, "sine", 0.22 * vol, 0, 38);
}

export function sfxBump() {
    blip(70, 0.18, "sine", 0.3, 0, 40);
}

/** On foot: a springy little "hup" (a jump; `h` 0–1 = how high she's going). */
export function sfxJump(h = 1) {
    blip(300 + h * 80, 0.16, "triangle", 0.12, 0, 620 + h * 160);
}
/** On foot: feet hitting the ground (p 0–1: a hop … a drop off a car roof). */
export function sfxLand(p = 0.4) {
    if (!ctx) return;
    blip(120, 0.09 + p * 0.08, "sine", 0.12 + p * 0.22, 0, 55);
    const t = ctx.currentTime;
    const src = noiseSource();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 500 + p * 500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05 + p * 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12 + p * 0.1);
    src.connect(lp).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + 0.3);
}

export function sfxHorn(on) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (on && !hornNodes) {
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.02);
        const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
        const a = ctx.createOscillator(); a.type = "square"; a.frequency.value = 415;
        const b = ctx.createOscillator(); b.type = "square"; b.frequency.value = 523;
        a.connect(lp); b.connect(lp); lp.connect(g).connect(sfxBus);
        a.start(); b.start();
        hornNodes = { g, a, b };
    } else if (!on && hornNodes) {
        const h = hornNodes;
        hornNodes = null;
        h.g.gain.setTargetAtTime(0, t, 0.03);
        h.a.stop(t + 0.2); h.b.stop(t + 0.2);
    }
}

export function sfxSiren(dur = 1.6) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "triangle";
    const g = ctx.createGain(); g.gain.value = 0.12;
    for (let i = 0; i < dur / 0.4; i++) {
        o.frequency.setValueAtTime(i % 2 ? 960 : 720, t + i * 0.4);
    }
    g.gain.setValueAtTime(0.12, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g).connect(sfxBus);
    o.start(t); o.stop(t + dur);
}

export function sfxFanfare() {
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((n, i) => blip(n, i === notes.length - 1 ? 0.6 : 0.16, "square", 0.09, i * 0.13));
}

export function sfxSelect() { blip(660, 0.06, "square", 0.06); }
export function sfxMove() { blip(440, 0.04, "square", 0.04); }

// ── music ────────────────────────────────────────────────────────────
// A change of track is a short CROSSFADE (getting out of the car, walking into a scene…), and each track keeps its
// own <audio> element, so it picks up where it left off instead of starting over. Where the browser won't let a
// page set an element's volume (iOS), the switch is the old instant one.
const MUSIC_VOL = 0.32, XFADE = 0.7;       // s
const tracks = new Map();                  // src → <audio>
const fadeOuts = new Set();                // elements on their way out
// What we last set each element's volume to. NEVER read el.volume back: on an iPhone a page can't set it, and a set
// reads back for one task and is 1 again after — a fade that counted on the read never ended, so every track that
// had been "faded out" kept playing under the next one.
const level = new WeakMap();
let musicVol = MUSIC_VOL, fadeIn = false, fadeTimer = null, canFade = null, probing = false;
function setVol(el, v) { level.set(el, v); try { el.volume = v; } catch (e) { /* read-only volume */ } }
const volOf = el => (level.has(el) ? level.get(el) : MUSIC_VOL);
/** Once: can this browser set an element's volume at all? (Asked a moment after the set: see `level`.) Until we know, no crossfades. */
function probeVolume() {
    if (canFade != null || probing) return;
    probing = true;
    try {
        const p = new Audio();
        p.volume = 0.5;
        setTimeout(() => { try { canFade = Math.abs(p.volume - 0.5) < 0.01; } catch (e) { canFade = false; } }, 150);
    } catch (e) { canFade = false; }
}
let fadeLast = 0;
function fadeStep() {
    // by the clock, not by the tick: on a slow device the timer fires late, and the fade must still take XFADE
    const t = performance.now(), dt = Math.min(0.3, Math.max(0.01, (t - fadeLast) / 1000));
    fadeLast = t;
    const step = dt / XFADE * MUSIC_VOL;
    for (const el of fadeOuts) {
        const v = volOf(el) - step;
        if (v <= 0.001) { el.pause(); setVol(el, 0); fadeOuts.delete(el); } else setVol(el, v);
    }
    if (fadeIn && music) {
        const v = Math.min(musicVol, volOf(music) + step);
        setVol(music, v);
        if (v >= musicVol - 0.001) fadeIn = false;
    } else fadeIn = false;
    if (!fadeOuts.size && !fadeIn) { clearInterval(fadeTimer); fadeTimer = null; }
}
export function setMusic(src) {
    if (music && music.dataset.src === src) return;
    const old = music;
    music = null; fadeIn = false;
    probeVolume();
    if (!src) { if (old) old.pause(); return; }
    let el = tracks.get(src);
    if (!el) { el = new Audio(src); el.dataset.src = src; el.loop = true; tracks.set(src, el); }
    fadeOuts.delete(el);
    const cross = !!old && musicOn && !!ctx && !muted && canFade === true && !old.paused;
    if (old) { if (cross) fadeOuts.add(old); else old.pause(); }
    // one song at a time, whatever happened before: anything that isn't the new track or on its way out is stopped
    for (const t of tracks.values()) if (t !== el && !fadeOuts.has(t) && !t.paused) t.pause();
    musicVol = MUSIC_VOL;
    setVol(el, cross ? 0 : MUSIC_VOL);
    el.muted = muted;
    music = el;
    if (musicOn && ctx) el.play().catch(() => {});
    if (cross) { fadeIn = true; if (!fadeTimer) { fadeLast = performance.now(); fadeTimer = setInterval(fadeStep, 40); } }
}
/** Tests: ask again whether volume can be set (after a test swaps in a browser that can't). */
export function debugReprobe() { canFade = null; probing = false; probeVolume(); }
/** Tests: every music element that is sounding right now ([{src, vol}]) and whether this browser can fade. */
export function musicPlaying() { return { canFade, fading: fadeOuts.size, playing: [...tracks.values()].filter(t => !t.paused).map(t => ({ src: t.dataset.src, vol: +volOf(t).toFixed(3) })) }; }

/** The music track playing now (its url as passed to setMusic) or null. */
export function musicSrc() { return music ? music.dataset.src : null; }

/** Music on / off to match the save (⚙️ 🎵 Music OFF came back ON after a reload — nothing read it back; ci/sweep-phone). */
export function setMusicOn(on) { if (!!on !== musicOn) toggleMusic(); return musicOn; }

export function toggleMusic() {
    musicOn = !musicOn;
    for (const el of fadeOuts) el.pause();
    fadeOuts.clear();
    if (music) { if (musicOn) music.play().catch(() => {}); else music.pause(); }
    return musicOn;
}

/** An ad is on screen: every sound stops where it is (the music element pauses, the AudioContext — engine, sfx,
 *  positional voices — is suspended); holdAll(false) picks it all up again. (features/native/ads.js) */
let held = null;
export function holdAll(on) {
    if (on) {
        if (held) return;
        held = { music: music && !music.paused ? music : null, ctx: !!ctx && ctx.state === "running" };
        for (const el of fadeOuts) el.pause();
        fadeOuts.clear();
        if (held.music) held.music.pause();
        if (held.ctx) ctx.suspend().catch(() => {});
    } else {
        if (!held) return;
        const h = held; held = null;
        if (h.music && h.music === music && musicOn) h.music.play().catch(() => {});
        if (h.ctx && ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    }
}
/** Tests: is the sound held (by an ad)? */
export function audioHeld() { return !!held; }

export function duckMusic(v) {
    musicVol = v;
    if (music && !fadeIn) setVol(music, v);        // (mid-crossfade the fade simply ends at the new level)
}

// ── muffled music (on foot the car radio is "out there") ────────────────
// Routed through WebAudio only once a muffle is first asked for (the element plays
// directly until then); each <audio> element gets its MediaElementSource once.
let muffle = 0, mChain = null;
const mSources = new WeakMap();
/** 0 = clear … 1 = heavily muffled (lowpass ~450 Hz). Cheap to call every frame. */
export function setMusicMuffle(amount = 0) {
    amount = Math.max(0, Math.min(1, amount || 0));
    if (!ctx) { muffle = amount; return; }
    if (amount > 0.001 && music && ctx.state === "running" && (!mChain || mChain.el !== music)) routeMusic();
    if (!mChain || Math.abs(amount - muffle) < 0.002) { muffle = amount; return; }
    muffle = amount;
    mChain.lp.frequency.setTargetAtTime(20000 * Math.pow(450 / 20000, amount), ctx.currentTime, 0.12);
}
function routeMusic() {
    try {
        if (!mChain) {
            const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 20000; lp.Q.value = 0.7;
            lp.connect(master);
            mChain = { lp, el: null, src: null };
        }
        // (each element is routed ONCE and stays connected: tracks are kept, and one that's fading out still plays)
        let src = mSources.get(music);
        if (!src) { src = ctx.createMediaElementSource(music); mSources.set(music, src); src.connect(mChain.lp); }
        mChain.src = src; mChain.el = music;
        mChain.lp.frequency.setValueAtTime(20000 * Math.pow(450 / 20000, muffle), ctx.currentTime);
    } catch (e) { console.warn("[audio] muffle", e); }
}
/** Debug / tests: the music chain's state. */
export function musicMuffleInfo() {
    return { muffle, routed: !!(mChain && mChain.el && mChain.el === music), target: Math.round(20000 * Math.pow(450 / 20000, muffle)) };
}

export function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.9;
    if (music) music.muted = m;
    for (const el of fadeOuts) el.muted = m;
}
