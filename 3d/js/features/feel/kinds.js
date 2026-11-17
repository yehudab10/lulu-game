// features/feel — the positional sound kinds, synthesized ONCE into short sample
// buffers (24 kHz mono) and played by core spatial.js voices. Same timbres as the
// flat originals (law's siren, roadevents' bells/horns/jingle, banter's NPC horns),
// so nothing sounds new — it just comes from somewhere now.
//
//   kind          loop  where it's used
//   siren         ✓     law: every lit cruiser (the wail)        sirenYelp ✓ (closing in)
//   rotor         ✓     law: the police chopper
//   ambulance     ✓     roadevents: an ambulance coming through (hi-lo)
//   whoosh / whooshTruck   feel: traffic passing her (trucks louder, longer)
//   horn / hornVan / hornTruck / hornCop   banter + roadevents: NPC honks
//   trainHorn  bell  roadevents: the freight's horn, the crossing bell
//   jingle           roadevents: the ice-cream truck
import { spatial } from "../../spatial.js";

const TAU = Math.PI * 2;

// Band-limited-ish oscillators from small wavetables (a few harmonics: plenty for road
// sounds, no aliasing at 24 kHz, and ~10× cheaper than summing sines per sample).
const TBL = 2048;
function table(odd, n) {
    const t = new Float32Array(TBL + 1);
    for (let i = 0; i <= TBL; i++) {
        const ph = i / TBL * TAU;
        let s = 0;
        for (let k = 1; k <= n; k += odd ? 2 : 1) s += Math.sin(ph * k) / k;
        t[i] = s;
    }
    return t;
}
const SAW = table(false, 6), SQR = table(true, 9);
function look(t, ph) {
    const x = ((ph / TAU) % 1 + 1) % 1 * TBL, i = x | 0, f = x - i;
    return t[i] + (t[i + 1] - t[i]) * f;
}
const saw = ph => look(SAW, ph) * 0.6;
const square = ph => look(SQR, ph) * 0.8;
/** RBJ biquad (in place, with a per-sample centre frequency function or a constant). */
function biquad(buf, sr, type, freq, q = 0.8) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    let b0, b1, b2, a1, a2, lastF = -1;
    for (let i = 0; i < buf.length; i++) {
        const f = typeof freq === "function" ? ((i & 15) === 0 ? freq(i / sr) : lastF) : freq;
        if (f !== lastF) {
            lastF = f;
            const w = TAU * Math.min(f, sr * 0.45) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
            const a0 = 1 + al;
            if (type === "lowpass") { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; }
            else if (type === "highpass") { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; }
            else { b0 = al; b1 = 0; b2 = -al; }                     // bandpass (0 dB peak)
            a1 = -2 * cw; a2 = 1 - al;
            b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
        }
        const x = buf[i];
        const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1; x1 = x; y2 = y1; y1 = y;
        buf[i] = y;
    }
    return buf;
}
function normalize(buf, peak = 0.9) {
    let m = 0;
    for (let i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i]));
    if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
    return buf;
}
/** Short fades at both ends (one-shots) so nothing clicks. */
function edges(buf, sr, a = 0.006, r = 0.03) {
    const na = Math.floor(a * sr), nr = Math.floor(r * sr);
    for (let i = 0; i < na && i < buf.length; i++) buf[i] *= i / na;
    for (let i = 0; i < nr && i < buf.length; i++) buf[buf.length - 1 - i] *= i / nr;
    return buf;
}
const noise = n => { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = Math.random() * 2 - 1; return b; };

// ── sirens: a seamless loop (whole cycles of the sweep, integer cycles of the tone) ──
function sirenGen(period, lo, span) {
    return sr => {
        const n = Math.round(period * sr), b = new Float32Array(n);
        let ph = 0;
        for (let i = 0; i < n; i++) {
            const t = i / sr;
            const f = lo + span * (1 - Math.cos(TAU * t / period)) / 2;     // mean = lo + span/2 → whole cycles per loop
            ph += TAU * f / sr;
            b[i] = saw(ph) * 0.75 + square(ph * 2) * 0.12;
        }
        return normalize(loopFilter(b, sr, "lowpass", 2600, 0.7), 0.8);
    };
}
/** Filter a loop as if it had been playing already (no start-up transient at the seam). */
function loopFilter(b, sr, type, f, q) {
    const n = b.length, t = new Float32Array(n * 2);
    t.set(b); t.set(b, n);
    biquad(t, sr, type, f, q);
    return t.slice(n);
}
spatial.define("siren", { gen: sirenGen(2.4, 640, 560), loop: true, ref: 12, max: 280, gain: 0.42, prio: 3, lift: 1.4 });
spatial.define("sirenYelp", { gen: sirenGen(0.32, 700, 600), loop: true, ref: 12, max: 280, gain: 0.4, prio: 3, lift: 1.4 });

// ── the chopper: blade thumps + a turbine whine (8 thumps per loop) ──
spatial.define("rotor", { loop: true, ref: 16, max: 320, gain: 0.95, prio: 2, doppler: 0.6, gen(sr) {
    const n = Math.round(0.72 * sr), b = new Float32Array(n), nz = biquad(noise(n), sr, "lowpass", 220, 0.9);
    for (let i = 0; i < n; i++) {
        const t = i / sr, k = (t % 0.09) / 0.09;
        const env = Math.exp(-k * 9) * (0.85 + 0.15 * Math.sin(Math.floor(t / 0.09) * 2.3));
        b[i] = nz[i] * env * 3 + Math.sin(TAU * 58 * t) * env * 0.5 + Math.sin(TAU * 1450 * t) * 0.012;
    }
    return normalize(b, 0.85);
} });

// ── the ambulance: hi-lo, 4 × 0.2 s (loopable) ──
spatial.define("ambulance", { loop: true, ref: 12, max: 240, gain: 0.32, prio: 3, lift: 1.8, gen(sr) {
    const n = Math.round(0.8 * sr), b = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
        const t = i / sr, f = Math.floor(t / 0.2) % 2 ? 1320 : 900;     // 0.2 s × 900 = 180, × 1320 = 264 cycles: seamless
        ph += TAU * f / sr;
        b[i] = Math.sin(ph) * 0.8 + Math.sin(ph * 2) * 0.15;
    }
    return normalize(b, 0.8);
} });

// ── passing traffic: a filtered-noise swell that sweeps down (it fakes its own Doppler) ──
function whooshGen(dur, f0, f1, rumbleHz) {
    return sr => {
        const n = Math.round(dur * sr), b = noise(n);
        biquad(b, sr, "bandpass", t => f0 * Math.pow(f1 / f0, Math.min(1, t / dur)), 0.7);
        biquad(b, sr, "lowpass", 5200, 0.7);
        for (let i = 0; i < n; i++) {
            const t = i / n;
            const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.1)), 2.2);   // peaks a little before the middle
            b[i] *= env;
            if (rumbleHz) b[i] += Math.sin(TAU * rumbleHz * i / sr) * env * 0.35;
        }
        return edges(normalize(b, 0.9), sr);
    };
}
spatial.define("whoosh", { gen: whooshGen(1.3, 2400, 420, 0), ref: 3, max: 55, gain: 0.32, prio: 1, doppler: 0.3, lift: 0.6 });
spatial.define("whooshTruck", { gen: whooshGen(1.9, 1500, 230, 46), ref: 4, max: 80, gain: 0.55, prio: 1, doppler: 0.3, lift: 1 });

// ── horns (two beeps; `dur` cuts it to one) ──
function hornGen(freqs, len, gap, beeps, sq, cutoff) {
    return sr => {
        const total = beeps * len + (beeps - 1) * gap + 0.04, n = Math.round(total * sr), b = new Float32Array(n);
        const phs = freqs.map(() => 0);
        for (let i = 0; i < n; i++) {
            const t = i / sr, k = t % (len + gap);
            if (k > len || t > beeps * (len + gap)) { continue; }
            const env = Math.min(1, k / 0.012) * Math.min(1, (len - k) / 0.03);
            let s = 0;
            for (let j = 0; j < freqs.length; j++) { phs[j] = TAU * freqs[j] * t; s += sq ? square(phs[j], freqs[j], sr, 5) : saw(phs[j]); }
            b[i] = s * env / freqs.length;
        }
        return edges(normalize(biquad(b, sr, "lowpass", cutoff, 0.7), 0.85), sr);
    };
}
spatial.define("horn", { gen: hornGen([420, 525], 0.13, 0.07, 2, true, 2200), ref: 8, max: 170, gain: 0.5, prio: 2, lift: 1 });
spatial.define("hornVan", { gen: hornGen([330, 415], 0.15, 0.08, 2, true, 1900), ref: 8, max: 170, gain: 0.5, prio: 2, lift: 1.1 });
spatial.define("hornCop", { gen: hornGen([520, 650], 0.1, 0.06, 2, true, 2400), ref: 8, max: 170, gain: 0.45, prio: 2, lift: 1 });
spatial.define("hornTruck", { gen: hornGen([155, 195, 233], 0.42, 0.12, 2, false, 900), ref: 10, max: 240, gain: 0.75, prio: 2, lift: 2 });

// ── the railroad: the freight's three-note horn (1.5 s; `dur` cuts it) and the crossing bell ──
spatial.define("trainHorn", { ref: 22, max: 520, gain: 0.7, prio: 3, lift: 4, doppler: 1.4, gen(sr) {
    const dur = 1.5, n = Math.round(dur * sr), b = new Float32Array(n), fs = [311, 370, 466];
    for (let i = 0; i < n; i++) {
        const t = i / sr, env = Math.min(1, t / 0.06) * Math.min(1, (dur - t) / 0.12);
        let s = 0;
        for (const f of fs) s += saw(TAU * f * t * (1 - 0.015 * t / dur));
        b[i] = s * env / 3;
    }
    return edges(normalize(biquad(b, sr, "lowpass", 1800, 0.8), 0.85), sr);
} });
spatial.define("bell", { ref: 6, max: 160, gain: 0.32, prio: 2, lift: 2.6, gen(sr) {
    const n = Math.round(0.42 * sr), b = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = i / sr, env = Math.exp(-t * 9) * Math.min(1, t / 0.003);
        b[i] = (square(TAU * 650 * t, 650, sr, 4) * 0.55 + Math.sin(TAU * 1300 * t) * 0.35 + Math.sin(TAU * 1735 * t) * 0.15) * env;
    }
    return edges(normalize(b, 0.85), sr, 0.002, 0.02);
} });

// ── the ice-cream truck's music-box tune ──
spatial.define("jingle", { ref: 9, max: 230, gain: 0.32, prio: 2, lift: 2.6, gen(sr) {
    const notes = [659, 587, 523, 587, 659, 659, 659], step = 0.14, n = Math.round((notes.length * step + 0.25) * sr), b = new Float32Array(n);
    notes.forEach((f, k) => {
        const s0 = Math.round(k * step * sr), len = Math.round(0.35 * sr);
        for (let i = 0; i < len && s0 + i < n; i++) {
            const t = i / sr, env = Math.exp(-t * 7) * Math.min(1, t / 0.004);
            b[s0 + i] += (Math.sin(TAU * f * t) * 0.7 + Math.sin(TAU * f * 3 * t) * 0.18 + square(TAU * f * t, f, sr, 3) * 0.15) * env;
        }
    });
    return edges(normalize(b, 0.85), sr);
} });

// ── her own car falling apart: the dragging bumper (loop) and the hubcap clang + rattle ──
spatial.define("scrape", { loop: true, ref: 3, max: 60, gain: 0.5, prio: 2, doppler: 0, gen(sr) {
    const n = Math.round(1.0 * sr), b = biquad(noise(n), sr, "bandpass", 2600, 1.4), r = noise(n);
    for (let i = 0; i < n; i++) {
        const t = i / sr;
        const grit = 0.55 + 0.45 * Math.sin(TAU * 13 * t) * Math.sin(TAU * 7.3 * t);
        b[i] = b[i] * grit + (r[i] > 0.997 ? r[i] * 0.9 : 0) + Math.sin(TAU * 3100 * t) * 0.04 * grit;   // grit, crackle, a squeal
    }
    // crossfade the ends so it loops without a seam
    const x = Math.round(0.05 * sr);
    for (let i = 0; i < x; i++) { const k = i / x; b[i] = b[i] * k + b[n - x + i] * (1 - k); }
    return normalize(b.subarray(0, n - x).slice(), 0.8);
} });
spatial.define("hubcap", { ref: 4, max: 90, gain: 0.55, prio: 2, doppler: 0.5, gen(sr) {
    const dur = 1.7, n = Math.round(dur * sr), b = new Float32Array(n), nz = biquad(noise(n), sr, "bandpass", 3400, 2);
    for (let i = 0; i < n; i++) {
        const t = i / sr;
        const clang = (Math.sin(TAU * 1870 * t) * 0.5 + Math.sin(TAU * 2930 * t) * 0.3 + Math.sin(TAU * 4410 * t) * 0.2) * Math.exp(-t * 11);
        const rate = 18 - t * 8, rat = Math.pow(Math.abs(Math.sin(Math.PI * rate * t)), 12) * Math.exp(-t * 1.4);   // a rattle that slows
        b[i] = clang * 0.9 + nz[i] * rat * 0.8;
    }
    return edges(normalize(b, 0.85), sr, 0.001, 0.08);
} });

/** NPC horn kind for a traffic kind. */
export function hornKind(kind) {
    if (kind === "truck" || /bus|truck|dozer|steam/.test(kind || "")) return "hornTruck";
    if (kind === "van" || /van|minivan/.test(kind || "")) return "hornVan";
    if (kind === "cop") return "hornCop";
    return "horn";
}
