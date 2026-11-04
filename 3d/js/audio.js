// All sound is synthesized with WebAudio (engine, wind, tires, horn, coins,
// crashes) except the music, which reuses the 2D game's driving track.

let ctx = null, master = null, sfxBus = null;
let engine = null, wind = null, screech = null, hornNodes = null;
let music = null, musicOn = true, muted = false;
let noiseBuf = null;

export const audio = {
    get ready() { return !!ctx && ctx.state === "running"; },
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
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (musicOn && music && music.paused) music.play().catch(() => {});
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

export function sfxBump() {
    blip(70, 0.18, "sine", 0.3, 0, 40);
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

// ── music ──────────────────────────────────────────────────────────────
export function setMusic(src) {
    if (music && music.dataset.src === src) return;
    if (music) { music.pause(); music = null; }
    if (!src) return;
    music = new Audio(src);
    music.dataset.src = src;
    music.loop = true;
    music.volume = 0.32;
    if (musicOn && ctx) music.play().catch(() => {});
}

export function toggleMusic() {
    musicOn = !musicOn;
    if (music) { if (musicOn) music.play().catch(() => {}); else music.pause(); }
    return musicOn;
}

export function duckMusic(v) {
    if (music) music.volume = v;
}

export function setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : 0.9;
    if (music) music.muted = m;
}
