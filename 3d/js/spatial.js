// Positional 3D audio — sounds you can LOCATE: the cruiser closing from behind-left,
// a truck whooshing past on the right, the train horn off to the side.
//
//   import * as A from "./audio.js";
//   A.spatial.play("horn", car.obj, { gain: 0.8 })     → handle | null   (a one-shot)
//   const h = A.spatial.loop("siren", cruiser.obj)       → handle | null   (a looping emitter)
//   h.set({ gain, rate, kind }); h.stop(); h.alive
//   A.spatial.define("myKind", { gen: sr => Float32Array, loop, ref, max, gain, prio })
//
// Targets are any three.js Object3D (followed every frame; the emitter dies by itself
// once the object leaves the scene) or a plain {x, y, z} position (read every frame,
// so you may move it). Kinds are short sample buffers synthesized ONCE in JS (24 kHz
// mono) — see features/feel/kinds.js — so a sound is just a pooled voice playing a buffer.
//
// The graph: a fixed pool of voices, each  src → env → lowpass → gain → PannerNode
// (equalpower: cheap on phones; front/back is told by a "behind you" lowpass instead
// of HRTF) → the spatial bus → core master (so Sound off mutes it). Emitters (≤ 40) are
// virtual: every frame the loudest ones get the voices (hard cap, default 8, stealing
// the quietest — loops come back when a voice frees up, one-shots are dropped).
// Distance roll-off, the rear lowpass, air absorption and a Doppler pitch shift from the
// distance rate are computed here in JS. Nothing allocates per frame.
//
// The listener sits on the camera's axes, 75 % of the way from the camera to the focus
// (Lulu's car, or Lulu on foot — ctx.car.pos follows her), so "behind" means behind HER.

const MAX_EMITTERS = 40;
const SR = 24000;                 // buffer sample rate (plenty for road sounds, half the synth time)
const C_SOUND = 343;

let ac = null, bus = null;
let maxVoices = 8;
let gateOpen = true;
const KINDS = Object.create(null);
const voices = [];
const ems = [];
const stats = { played: 0, loops: 0, stolen: 0, dropped: 0, peak: 0, generated: 0 };
// listener (camera axes) — written each frame
const LM = new Float32Array(16);
let fcx = 0, fcy = 0, fcz = 0;
let lastNow = 0;

for (let i = 0; i < MAX_EMITTERS; i++) {
    ems.push({ i, active: false, gen: 0, kind: null, K: null, target: null, isObj: false, loop: false, gain: 1, rate: 1, floor: 0,
        prio: 1, t0: 0, endT: 0, cut: 0, voice: null, dist: -1, prevDist: -1, dop: 1, aud: 0, lx: 0, ly: 0, lz: 0, cutoff: 20000, stopping: 0, key: null });
}

class Handle {
    constructor(e) { this.e = e; this.gen = e.gen; }
    get alive() { return this.e.active && this.e.gen === this.gen; }
    /** Fade out and free (safe to call twice, or after it already ended). */
    stop(fade = 0.12) { if (this.alive) stopEmitter(this.e, fade); return null; }
    /** Change gain / base pitch rate / floor / kind (a siren's wail → yelp) live. */
    set(o) {
        if (!this.alive || !o) return this;
        const e = this.e;
        if (o.gain != null) e.gain = o.gain;
        if (o.rate != null) e.rate = o.rate;
        if (o.floor != null) e.floor = o.floor;
        if (o.kind && o.kind !== e.kind && KINDS[o.kind]) {
            ensureBuf(KINDS[o.kind]);
            e.kind = o.kind; e.K = KINDS[o.kind];
            if (e.voice) releaseVoice(e.voice, 0.05);          // rebinds next frame with the new buffer
        }
        return this;
    }
    /** Debug: where the listener hears it (x right, y up, z BEHIND), its gain, lowpass, Doppler. */
    info() {
        const e = this.e;
        if (!this.alive) return null;
        return { kind: e.kind, x: +e.lx.toFixed(2), y: +e.ly.toFixed(2), z: +e.lz.toFixed(2), dist: +e.dist.toFixed(1), aud: +e.aud.toFixed(3),
            cutoff: Math.round(e.cutoff), doppler: +e.dop.toFixed(3), voiced: !!e.voice, pan: e.voice ? +panOf(e).toFixed(2) : null };
    }
}

function panOf(e) { return e.dist > 0.01 ? e.lx / Math.max(e.dist, 1) : 0; }

/** Called by audio.js once its AudioContext exists (the first gesture). */
export function initSpatial(audioCtx, destination) {
    if (ac || !audioCtx) return;
    try {
        ac = audioCtx;
        bus = ac.createGain();
        bus.gain.value = 1;
        bus.connect(destination);
        for (let i = 0; i < 12; i++) voices.push(makeVoice(i));
        // synthesize the kinds in the background, one per tick, so the first siren doesn't hitch
        const names = Object.keys(KINDS);
        let k = 0;
        const idle = window.requestIdleCallback ? f => window.requestIdleCallback(f, { timeout: 400 }) : f => setTimeout(f, 40);
        const next = () => { if (k < names.length) { const K = KINDS[names[k++]]; try { ensureBuf(K); } catch (e) { /* on demand */ } idle(next); } };
        setTimeout(() => idle(next), 200);
    } catch (e) {
        console.warn("[spatial] init", e);
        ac = null;
    }
}

function makeVoice(i) {
    const env = ac.createGain();
    const filt = ac.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 20000; filt.Q.value = 0.5;
    const gain = ac.createGain(); gain.gain.value = 0;
    const pan = ac.createPanner();
    pan.panningModel = "equalpower";
    pan.distanceModel = "linear"; pan.rolloffFactor = 0; pan.refDistance = 1; pan.maxDistance = 10000;   // WE do the roll-off
    env.connect(filt).connect(gain).connect(pan).connect(bus);
    return { i, env, filt, gain, pan, src: null, em: null, busyUntil: 0 };
}

function ensureBuf(K) {
    if (K.buf || !ac) return K.buf;
    const data = K.gen(SR);
    const buf = ac.createBuffer(1, data.length, SR);
    if (buf.copyToChannel) buf.copyToChannel(data, 0); else buf.getChannelData(0).set(data);
    K.buf = buf;
    K.dur = data.length / SR;
    stats.generated++;
    return buf;
}

function setPos(p, x, y, z, now) {
    if (p.positionX) {
        p.positionX.setTargetAtTime(x, now, 0.025);
        p.positionY.setTargetAtTime(y, now, 0.025);
        p.positionZ.setTargetAtTime(z, now, 0.025);
    } else p.setPosition(x, y, z);
}

function bind(e, v, now) {
    const K = e.K;
    if (!ensureBuf(K)) return false;
    const src = ac.createBufferSource();
    src.buffer = K.buf;
    src.loop = e.loop;              // a loop kind played as a one-shot plays once
    src.playbackRate.value = e.rate * e.dop;
    src.connect(v.env);
    src.onended = () => { try { src.disconnect(); } catch (err) { /* gone */ } };
    let when = now, offset = 0;
    if (e.loop) offset = Math.max(0, now - e.t0) % K.dur;
    else if (e.t0 > now) when = e.t0;
    else offset = now - e.t0;
    if (!e.loop && offset >= K.dur - 0.02) return false;
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(0, now);
    v.env.gain.setTargetAtTime(1, when, offset > 0.02 ? 0.03 : 0.004);
    if (!e.loop && e.cut) {
        const end = e.t0 + e.cut;
        v.env.gain.setTargetAtTime(0, Math.max(when, end - 0.05), 0.02);
        src.stop(end + 0.15);
    }
    // start where the emitter is: no fade-in sweep from the last voice's position
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(e.aud, now);
    if (v.pan.positionX) { v.pan.positionX.cancelScheduledValues(now); v.pan.positionY.cancelScheduledValues(now); v.pan.positionZ.cancelScheduledValues(now);
        v.pan.positionX.setValueAtTime(e.lx, now); v.pan.positionY.setValueAtTime(e.ly, now); v.pan.positionZ.setValueAtTime(e.lz, now); }
    else v.pan.setPosition(e.lx, e.ly, e.lz);
    v.filt.frequency.cancelScheduledValues(now);
    v.filt.frequency.setValueAtTime(e.cutoff, now);
    try { src.start(when, offset); } catch (err) { return false; }
    v.src = src; v.em = e; e.voice = v;
    return true;
}

function releaseVoice(v, fade = 0.04) {
    const now = ac.currentTime;
    if (v.em) { v.em.voice = null; v.em = null; }
    if (v.src) {
        v.env.gain.cancelScheduledValues(now);
        v.env.gain.setTargetAtTime(0, now, fade / 3);
        try { v.src.stop(now + fade + 0.02); } catch (err) { /* not started */ }
        v.src = null;
    }
    v.busyUntil = now + fade + 0.03;   // let the fade finish before reuse (no clicks)
}

function stopEmitter(e, fade = 0.08) {
    if (e.voice) releaseVoice(e.voice, fade);
    e.active = false; e.gen++; e.target = null; e.key = null;
}

function grab(kind, target, opts, loop) {
    if (!ac) return null;
    const K = KINDS[kind];
    if (!K || !target) return null;
    // a keyed one-shot replaces the previous one with the same key (bells, sirens that re-fire)
    let e = null;
    for (const x of ems) if (!x.active) { e = x; break; }
    if (!e) {   // all emitters busy: recycle the quietest non-loop one
        let q = null;
        for (const x of ems) if (!x.loop && (!q || x.aud < q.aud)) q = x;
        if (!q) { stats.dropped++; return null; }
        stopEmitter(q, 0.03); stats.dropped++;
        e = q;
    }
    const now = ac.currentTime;
    e.active = true; e.gen++;
    e.kind = kind; e.K = K; e.target = target; e.isObj = !!target.isObject3D;
    e.loop = loop; e.gain = opts && opts.gain != null ? opts.gain : 1; e.rate = opts && opts.rate || 1; e.floor = opts && opts.floor || 0;
    e.prio = opts && opts.prio != null ? opts.prio : (K.prio || 1);
    e.t0 = now + (opts && opts.delay || 0); e.cut = opts && opts.dur || 0;
    e.voice = null; e.dist = -1; e.prevDist = -1; e.dop = 1; e.aud = 0; e.stopping = 0;
    e.endT = loop ? Infinity : e.t0 + (e.cut || (K.dur || estimateDur(K))) + 0.05;
    e.key = opts && opts.key || null;
    measure(e, 0);
    if (!loop) stats.played++; else stats.loops++;
    return new Handle(e);
}
function estimateDur(K) { ensureBuf(K); return K.dur || 1; }

function inScene(o) { let n = 0; while (o.parent && n < 64) { o = o.parent; n++; } return !!o.isScene; }

// ── where is it? (listener space: x right, y up, z BEHIND — WebAudio's default listener) ──
function measure(e, dt) {
    let x, y, z;
    const t = e.target;
    if (e.isObj) { const m = t.matrixWorld.elements; x = m[12]; y = m[13] + (e.K.lift || 0); z = m[14]; }
    else { x = t.x; y = t.y != null ? t.y : 1; z = t.z; }
    const cx = LM[0] * x + LM[4] * y + LM[8] * z + LM[12];
    const cy = LM[1] * x + LM[5] * y + LM[9] * z + LM[13];
    const cz = LM[2] * x + LM[6] * y + LM[10] * z + LM[14];
    e.lx = cx - fcx; e.ly = cy - fcy; e.lz = cz - fcz;
    const d = Math.sqrt(e.lx * e.lx + e.ly * e.ly + e.lz * e.lz);
    // Doppler from how fast the distance changes (both of them moving)
    if (e.prevDist >= 0 && dt > 0) {
        const vr = (d - e.prevDist) / dt;
        if (Math.abs(vr) < 120) {
            const want = Math.max(0.78, Math.min(1.28, C_SOUND / (C_SOUND + vr * (e.K.doppler != null ? e.K.doppler : 1))));
            e.dop += (want - e.dop) * Math.min(1, dt * 7);
        }
    }
    e.prevDist = d; e.dist = d;
    const K = e.K, ref = K.ref || 6, max = K.max || 160;
    let g = ref / (ref + Math.max(0, d - ref));
    if (d > max * 0.75) g *= Math.max(0, (max - d) / (max * 0.25));
    g *= e.gain * (K.gain != null ? K.gain : 1);
    if (e.floor) g = Math.max(g, e.floor * e.gain);
    e.aud = g;
    // behind you → duller (a cheap head-shadow cue: equalpower can't do front/back); far → duller (air)
    const behind = d > 0.5 ? Math.max(0, e.lz / d) : 0;
    const rear = 18000 * Math.pow(0.17, behind);
    e.cutoff = Math.max(450, rear * (0.38 + 0.62 / (1 + d / 110)));
}

/**
 * Every frame (app.js, after render): sync the listener to `camera`, follow the
 * emitters, hand out the voices. focus = {x, y, z} the listener leans toward (Lulu).
 * open = false fades everything out (paused, a set is on screen, skipping a cutscene).
 */
function update(dt, camera, focus, open) {
    if (!ac) return;
    const now = ac.currentTime;
    if (open !== gateOpen) { gateOpen = open; bus.gain.setTargetAtTime(open ? 1 : 0, now, open ? 0.08 : 0.05); }
    if (camera) {
        const mi = camera.matrixWorldInverse.elements;
        for (let k = 0; k < 16; k++) LM[k] = mi[k];
        if (focus) {
            const m = camera.matrixWorld.elements;
            // the listener: 75 % from the camera toward Lulu (+1 m: ear height), on the camera's axes
            const lx = m[12] + (focus.x - m[12]) * 0.75, ly = m[13] + ((focus.y || 0) + 1 - m[13]) * 0.75, lz = m[14] + (focus.z - m[14]) * 0.75;
            fcx = LM[0] * lx + LM[4] * ly + LM[8] * lz + LM[12];
            fcy = LM[1] * lx + LM[5] * ly + LM[9] * lz + LM[13];
            fcz = LM[2] * lx + LM[6] * ly + LM[10] * lz + LM[14];
        } else { fcx = fcy = fcz = 0; }
    }
    lastNow = now;
    // 1) follow every emitter; retire the finished / orphaned ones
    for (const e of ems) {
        if (!e.active) continue;
        if ((e.isObj && !inScene(e.target)) || now > e.endT) { stopEmitter(e, 0.06); continue; }
        measure(e, dt);
    }
    // 2) voices: loops that faded to nothing give theirs back
    let busy = 0;
    for (const v of voices) {
        if (v.em && v.em.loop && v.em.aud < 0.0015) releaseVoice(v, 0.08);
        if (v.em) busy++;
    }
    // 3) the loudest unvoiced emitters get a voice (free one, or steal the quietest)
    for (const e of ems) {
        if (!e.active || e.voice || e.aud < 0.002 || (!e.loop && e.t0 > now + 0.25)) continue;
        let v = null;
        for (let i = 0; i < maxVoices; i++) { const w = voices[i]; if (!w.em && now >= w.busyUntil) { v = w; break; } }
        if (!v) {
            let victim = null, vs = Infinity;
            for (let i = 0; i < maxVoices; i++) {
                const w = voices[i];
                if (!w.em) continue;
                const s = w.em.aud * (1 + w.em.prio);
                if (s < vs) { vs = s; victim = w; }
            }
            if (victim && e.aud * (1 + e.prio) > vs * 1.25) {
                const ve = victim.em;
                stats.stolen++;
                if (ve.loop) releaseVoice(victim, 0.04);       // a loop goes virtual, it comes back later
                else stopEmitter(ve, 0.04);                    // a one-shot is gone
            }
            continue;   // the stolen voice is free once its fade ends (a frame or two)
        }
        if (bind(e, v, now)) busy++;
        else if (!e.loop) stopEmitter(e, 0.02);
    }
    if (busy > stats.peak) stats.peak = busy;
    // 4) push the numbers into the voiced nodes
    for (let i = 0; i < voices.length; i++) {
        const v = voices[i], e = v.em;
        if (!e) continue;
        v.gain.gain.setTargetAtTime(e.aud, now, 0.04);
        setPos(v.pan, e.lx, e.ly, e.lz, now);
        v.filt.frequency.setTargetAtTime(e.cutoff, now, 0.05);
        if (v.src) v.src.playbackRate.setTargetAtTime(e.rate * e.dop, now, 0.05);
    }
}

export const spatial = {
    /** true once the first gesture unlocked audio (before that play/loop return null). */
    get ready() { return !!ac && ac.state === "running"; },
    get unlocked() { return !!ac; },
    /** Register a sound: { gen(sampleRate) → Float32Array, loop, ref (m, full volume inside), max (m, silent beyond),
     *  gain, prio (1 whoosh … 3 sirens), lift (m above the object's origin), doppler (scale, default 1) }. */
    define(kind, spec) { KINDS[kind] = Object.assign({ buf: null, dur: 0 }, spec); if (ac) setTimeout(() => { try { ensureBuf(KINDS[kind]); } catch (e) { /* later */ } }, 0); },
    has(kind) { return !!KINDS[kind]; },
    /** A one-shot at an Object3D (followed) or {x,y,z}. opts: gain, rate, delay (s), dur (s, cut short), prio, key. */
    play(kind, target, opts) {
        try {
            if (opts && opts.key) for (const e of ems) if (e.active && e.key === opts.key) stopEmitter(e, 0.03);
            return grab(kind, target, opts, false);
        } catch (e) { console.warn("[spatial] play", e); return null; }
    },
    /** A looping emitter (→ handle; keep it and call .stop()). opts: gain, rate, floor (min audibility), prio. */
    loop(kind, target, opts) {
        try { return grab(kind, target, opts, true); } catch (e) { console.warn("[spatial] loop", e); return null; }
    },
    /** Silence and free every emitter (a new run, the title). */
    stopAll() { if (!ac) return; for (const e of ems) if (e.active) stopEmitter(e, 0.1); },
    update(dt, camera, focus, open = true) { try { update(dt, camera, focus, open); } catch (e) { console.warn("[spatial] update", e); } },
    /** Hard cap on simultaneous voices (1–12). */
    setMaxVoices(n) { maxVoices = Math.max(1, Math.min(12, n | 0)); if (ac) for (let i = maxVoices; i < voices.length; i++) if (voices[i].em) releaseVoice(voices[i], 0.05); },
    get maxVoices() { return maxVoices; },
    /** Numbers for tests / the perf report. */
    stats() {
        let active = 0, voiced = 0, loops = 0;
        for (const e of ems) if (e.active) { active++; if (e.voice) voiced++; if (e.loop) loops++; }
        return Object.assign({ unlocked: !!ac, running: !!ac && ac.state === "running", emitters: active, loopsActive: loops, voiced, maxVoices, gate: gateOpen }, stats);
    },
    /** Every active emitter's info() (tests). */
    list() { const out = []; for (const e of ems) if (e.active) out.push(new Handle(e).info()); return out; },
    /** The voice graph (tests inspect the real nodes). */
    get voices() { return voices; },
};
