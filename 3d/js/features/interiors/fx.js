// interiors/fx.js — the little effects every interior shares: confetti-style
// particles, floating speech bubbles (world-space sprites), canvas-painted
// signs/screens, and a tiny WebAudio synth for the 2D game's blips and the
// jukebox's klezmer loop.
import * as THREE from "three";
import { save3d } from "../../core/save.js";
import { audio as coreAudio } from "../../audio.js";

// ── particles ────────────────────────────────────────────────────────────
const MAXP = 240;
export class Particles {
    constructor(set) {
        const geo = set.own(new THREE.IcosahedronGeometry(1, 0));
        const mat = set.own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }));
        this.mesh = new THREE.InstancedMesh(geo, mat, MAXP);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 5;
        this.list = [];
        this.m = new THREE.Matrix4();
        this.q = new THREE.Quaternion();
        this.c = new THREE.Color();
        this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
        for (let i = 0; i < MAXP; i++) { this.mesh.setMatrixAt(i, this.zero); this.mesh.setColorAt(i, this.c.set(0xffffff)); }
        set.add(this.mesh);
    }
    /** emit(x, y, z, vx, vy, vz, size, life, color, gravity) */
    emit(x, y, z, vx, vy, vz, size, life, color, gravity = 9) {
        if (this.list.length >= MAXP) this.list.shift();
        this.list.push({ x, y, z, vx, vy, vz, size, life, max: life, color: new THREE.Color(color), g: gravity, spin: Math.random() * 6 });
    }
    burst(pos, colors, n = 14, speed = 2.6, size = 0.06, life = 0.9, up = 2.2, gravity = 7) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
            this.emit(pos.x, pos.y, pos.z, Math.cos(a) * s, up + Math.random() * up, Math.sin(a) * s,
                size * (0.6 + Math.random() * 0.8), life * (0.7 + Math.random() * 0.6), colors[i % colors.length], gravity);
        }
    }
    update(dt) {
        const L = this.list;
        for (let i = L.length - 1; i >= 0; i--) {
            const p = L[i];
            p.life -= dt;
            if (p.life <= 0) { L.splice(i, 1); continue; }
            p.vy -= p.g * dt;
            p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
            if (p.y < 0.02) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
            p.spin += dt * 5;
        }
        for (let i = 0; i < MAXP; i++) {
            const p = L[i];
            if (!p) { this.mesh.setMatrixAt(i, this.zero); continue; }
            const s = p.size * Math.min(1, p.life / (p.max * 0.35));
            this.q.setFromAxisAngle(AX, p.spin);
            this.m.compose(TMP.set(p.x, p.y, p.z), this.q, SC.set(s, s, s));
            this.mesh.setMatrixAt(i, this.m);
            this.mesh.setColorAt(i, p.color);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }
}
const AX = new THREE.Vector3(0.3, 1, 0.2).normalize();
const TMP = new THREE.Vector3(), SC = new THREE.Vector3();

// ── canvas-painted planes (signs, TV screens, posters, chalkboards) ──────
/**
 * canvasPlane(set, w, h, draw(g, W, H, t), { px: 512, lit: false, emissive })
 * → { mesh, redraw(t) }. lit=false uses an unlit material (screens/neon);
 *   lit=true a standard material (paper posters that should take the room light).
 */
export function canvasPlane(set, w, h, draw, { px = 512, lit = false, double = false } = {}) {
    const c = document.createElement("canvas");
    c.width = px; c.height = Math.max(8, Math.round(px * h / w));
    const g = c.getContext("2d");
    const tex = set.own(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const mat = set.own(lit ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
        : new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    if (double) mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(set.own(new THREE.PlaneGeometry(w, h)), mat);
    const api = {
        mesh, canvas: c, g,
        redraw(t = 0) { g.clearRect(0, 0, c.width, c.height); draw(g, c.width, c.height, t); tex.needsUpdate = true; },
    };
    api.redraw(0);
    return api;
}

/** Text with an outline, centred; handles "\n". */
export function drawLines(g, text, x, y, size, fill, { stroke = null, lw = 0, font = "Fredoka, Arial, sans-serif", weight = 700, lh = 1.15, maxW = 0 } = {}) {
    const lines = String(text).split("\n");
    g.font = `${weight} ${size}px ${font}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    const y0 = y - (lines.length - 1) * size * lh / 2;
    lines.forEach((l, i) => {
        const yy = y0 + i * size * lh;
        if (stroke && lw) { g.lineJoin = "round"; g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(l, x, yy, maxW || undefined); }
        g.fillStyle = fill; g.fillText(l, x, yy, maxW || undefined);
    });
}

export function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// ── speech bubbles (sprites that float above someone's head) ─────────────
export class Bubbles {
    constructor(set) { this.set = set; this.list = []; }
    /** say(text, anchorObj | Vector3, secs, {color, bg, yOff}) */
    say(text, at, secs = 2.6, { color = "#2b1b2e", bg = "#ffffff", yOff = 2.1, size = 1 } = {}) {
        // one bubble per anchor
        for (const b of this.list) if (b.at === at) b.t = Math.min(b.t, 0.15);
        const lines = String(text).split("\n");
        const W = 640, fs = 44, H = Math.round(fs * 1.25 * lines.length + 52);
        const c = document.createElement("canvas");
        c.width = W; c.height = H + 26;
        const g = c.getContext("2d");
        g.font = `700 ${fs}px Fredoka, Arial, sans-serif`;
        const tw = Math.min(W - 20, Math.max(...lines.map(l => g.measureText(l).width)) + 56);
        const x0 = (W - tw) / 2;
        g.fillStyle = "rgba(0,0,0,0.18)"; roundRect(g, x0 + 4, 8, tw, H - 4, 30); g.fill();
        g.fillStyle = bg; roundRect(g, x0, 2, tw, H - 6, 30); g.fill();
        g.beginPath(); g.moveTo(W / 2 - 18, H - 6); g.lineTo(W / 2 + 4, H + 22); g.lineTo(W / 2 + 18, H - 6); g.closePath(); g.fill();
        drawLines(g, text, W / 2, (H - 4) / 2 + 2, fs, color, { maxW: tw - 30 });
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, toneMapped: false });
        const sp = new THREE.Sprite(mat);
        const sw = 2.6 * size;
        sp.scale.set(sw, sw * c.height / W, 1);
        sp.renderOrder = 10;
        this.set.add(sp);
        this.list.push({ sp, mat, tex, at, t: secs, yOff, life: secs });
    }
    update(dt) {
        for (let i = this.list.length - 1; i >= 0; i--) {
            const b = this.list[i];
            b.t -= dt;
            const p = b.at.isVector3 ? b.at : b.at.position;
            const rise = Math.min(1, (b.life - b.t) * 6);
            b.sp.position.set(p.x, p.y + b.yOff + rise * 0.15, p.z);
            b.mat.opacity = Math.min(1, b.t * 4) * Math.min(1, rise * 1.5);
            if (b.t <= 0) { this.set.scene.remove(b.sp); b.mat.dispose(); b.tex.dispose(); this.list.splice(i, 1); }
        }
    }
    clear() { for (const b of this.list) { this.set.scene.remove(b.sp); b.mat.dispose(); b.tex.dispose(); } this.list.length = 0; }
}

// ── a tiny synth (the 2D game's playTone, plus a klezmer jukebox loop) ───
let ac = null, out = null;
function actx() {
    if (save3d.sound === false) return null;
    if (!ac) {
        if (!coreAudio.ready) return null;      // wait for the first gesture (the core unlocks it)
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); out = ac.createGain(); out.gain.value = 0.55; out.connect(ac.destination); } catch (e) { ac = null; return null; }
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac;
}
/** tone(freq, dur, type, vol, slideTo, when) — mirrors the 2D game's playTone. */
export function tone(freq, dur = 0.1, type = "sine", vol = 0.12, slideTo = 0, when = 0) {
    const a = actx();
    if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.03);
}
export const sfx = {
    click() { tone(660, 0.05, "square", 0.05); },
    coin() { tone(988, 0.08, "square", 0.07); tone(1319, 0.16, "square", 0.07, 0, 0.07); },
    womp() { tone(392, 0.22, "triangle", 0.14, 0, 0); tone(370, 0.22, "triangle", 0.14, 0, 0.24); tone(330, 0.5, "triangle", 0.14, 260, 0.48); },
    deny() { tone(220, 0.12, "square", 0.08); tone(180, 0.18, "square", 0.08, 0, 0.12); },
    hop() { tone(523, 0.08, "triangle", 0.12, 1046); },
    clink() { tone(1100 + Math.random() * 400, 0.07, "triangle", 0.16); tone(1320, 0.1, "sine", 0.1, 1600, 0.04); },
    fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.4 : 0.12, "square", 0.07, 0, i * 0.1)); },
    whistle() { tone(2300, 0.35, "sine", 0.1, 2500); tone(2350, 0.25, "sine", 0.06, 0, 0.36); },
    splash() { tone(160, 0.25, "sine", 0.1, 70); noise(0.4, 0.12, 900); },
    bell() { tone(1320, 0.13, "square", 0.1); tone(990, 0.18, "square", 0.08, 0, 0.13); },
};
function noise(dur, vol, freq) {
    const a = actx();
    if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(); s.buffer = buf;
    const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
    const g = a.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(out); s.start();
}

/**
 * A little klezmer loop (freygish melody + oom-pah) for the jukebox dance.
 * Returns { beat: seconds per beat, t0: audio-clock start (or null), stop() }.
 */
export function klezmer(beats = 16, bpm = 150) {
    const spb = 60 / bpm;
    const a = actx();
    if (!a) return { spb, stop() {} };
    const t0 = a.currentTime + 0.05;
    // D freygish: D Eb F# G A Bb C D
    const S = [293.7, 311.1, 370.0, 392.0, 440.0, 466.2, 523.3, 587.3];
    const mel = [4, 3, 2, 1, 2, 3, 4, 4, 5, 4, 3, 2, 3, 2, 1, 0];
    const nodes = [];
    const note = (f, t, d, type, vol) => {
        const o = a.createOscillator(); o.type = type; o.frequency.value = f;
        const g = a.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02); nodes.push(o);
    };
    for (let i = 0; i < beats; i++) {
        const t = t0 + i * spb;
        note(i % 2 ? 220 : 146.8, t, spb * 0.45, "triangle", 0.16);                 // oom … pah
        if (i % 2) note(293.7, t, spb * 0.3, "square", 0.04);
        note(S[mel[i % mel.length]] * 2, t, spb * 0.8, "sawtooth", 0.035);          // clarinet-ish
        if (i % 4 === 3) note(S[mel[(i + 1) % mel.length]] * 2, t + spb / 2, spb * 0.4, "sawtooth", 0.03);
    }
    return { spb, t0, ac: a, stop() { for (const o of nodes) { try { o.stop(); } catch (e) { /* already stopped */ } } nodes.length = 0; } };
}
