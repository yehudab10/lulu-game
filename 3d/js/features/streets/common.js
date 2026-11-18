// features/streets — shared plumbing: models, small maths, who-says-what (through
// banter while driving, foot's bubbles on foot, respecting Settings › Lulu's chatter),
// "did a cop see that?", and a tiny WebAudio synth for our sounds.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { registerModels, ensureModels, models } from "../../models.js";
import { save3d } from "../../core/save.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";

export const ID = "streets";
/** Random / surprise content gate (off in ?test unless enabled, off in a party). */
export const live = () => ctx.enabled(ID);
/** In a 🎉 party: the random content stays off, but the mechanics (carjack, bail out) work — a jacked shared
 *  traffic car leaves the traffic for everyone (ctx.party.claimTraffic). */
export const partyOn = () => !!(ctx.party && ctx.party.active && ctx.G && ctx.G.mode === "party");

// ── models (lazy) ───────────────────────────────────────────────────────
export const PROP_KINDS = ["hydrant", "mailbox", "fruitstand", "trashcan", "newsbox", "fence", "phonebooth"];
const FILES = ["sports", "paint", "owner", "barrier", "spikes", ...PROP_KINDS];
registerModels(Object.fromEntries(FILES.map(f => ["streets_" + f, "streets_" + f])));
export const K = n => "streets_" + n;
/** Load models: our own by short name ("paint" → streets_paint), anything else by its key ("npcMan"). */
export function need(keys) { return ensureModels(keys.map(k => FILES.includes(k) ? K(k) : k)); }
export { models };

// ── maths ───────────────────────────────────────────────────────────────
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = t => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t) * (1 - t); };
export const easeIn = t => { t = clamp(t, 0, 1); return t * t * t; };
export const backOut = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const road = () => ctx.world.road;
const _p = {};
export function pt(s, d, out = _p) { return ctx.world.road.point(s, d, out); }
export const fwd = h => ({ x: Math.sin(h), z: Math.cos(h) });
/** The vehicle's LEFT (the driver's side, +X of the model). */
export const left = h => ({ x: Math.cos(h), z: -Math.sin(h) });

// ── who says what ───────────────────────────────────────────────────────
const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";
/** Should an optional line play? big = a story moment (always unless chatter's quiet AND it's minor). */
export function talkOk(big = false) {
    const c = chatter();
    if (c === "quiet") return big && Math.random() < 0.5;
    if (c === "chatty") return true;
    return big || Math.random() < 0.65;
}
const driving = () => ctx.state === "playing" || ctx.state === "intro";
/** Lulu says something: banter's bubble while driving, foot's bubble on foot. */
export function luluSays(text, big = false) {
    if (!text || ctx.skipping || !talkOk(big)) return false;
    try {
        if (ctx.foot && ctx.foot.active && ctx.state === "footRun" && ctx.foot.obj) return !!ctx.foot.say(ctx.foot.obj, text, 2.4);
        if (driving() && ctx.banter && ctx.banter.say) return !!ctx.banter.say(text);
    } catch (e) { console.error("[streets] say", e); }
    return false;
}
/** Someone else says something over a 3D object (a person, a car). cls: "angry" style by default. */
export function npcSays(obj, text, { cls = "angry", always = false } = {}) {
    if (!obj || !text || ctx.skipping || (!always && !talkOk(false))) return false;
    try {
        if (ctx.state === "footRun" && ctx.foot && ctx.foot.say) return !!ctx.foot.say(obj, text, 2.4, { cls: cls === "angry" ? "" : cls });
        if (driving() && ctx.banter && ctx.banter.npcSay) return !!ctx.banter.npcSay(text, { obj });
    } catch (e) { console.error("[streets] npc say", e); }
    return false;
}

// ── the law ─────────────────────────────────────────────────────────────
/** A crime at (x, z): if a cop is close enough to SEE it, they give chase (or turn up the heat). */
export function crime(charge, x, z, { msg = "🚨 A COP SAW THAT!", r = 60, force = false } = {}) {
    const law = ctx.law;
    if (!law) return false;
    if (!force && !(law.copNear && law.copNear(x, z, r))) return false;
    if (ctx.state === "playing" || ctx.state === "intro") law.startChase(charge, { msg });
    else pendingCrimes.push({ charge, msg });
    emit("streets:crime", { charge, seen: true });
    return true;
}
/** Crimes seen while she was on foot / in a cutscene: reported the moment she's driving again. */
export const pendingCrimes = [];
export function flushCrimes() {
    if (!pendingCrimes.length || ctx.state !== "playing" || !ctx.law) return;
    const list = pendingCrimes.splice(0);
    for (const c of list) ctx.law.startChase(c.charge, { msg: c.msg });
}

// ── HUD helpers ─────────────────────────────────────────────────────────
export function toast(text, cls = "", key = null) { H.toast(text, cls, key ? { key } : {}); }
export function stat(id, n = 1) { emit("stat", { id, n }); }

// ── a tiny synth (smashes, sprays, roll-up doors, tyre pops) ────────────
let ac = null, out = null, noiseBuf = null;
function actx() {
    if (save3d.sound === false || ctx.skipping || !A.audio.ready) return null;
    try {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            ac = new AC();
            out = ac.createGain(); out.gain.value = 0.5; out.connect(ac.destination);
            const len = ac.sampleRate * 2;
            noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { return null; }
    return ac;
}
function tone(freq, dur, type = "sine", vol = 0.15, when = 0, slideTo = 0) {
    const c = actx(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, freq = 800, vol = 0.2, type = "bandpass", when = 0, q = 1) {
    const c = actx(); if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + dur + 0.05);
}
/** A loop whose level you set every frame (spray hiss, geyser). */
function loop(freq, type = "bandpass", q = 0.7) {
    const c = actx(); if (!c) return { set() {}, stop() {} };
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(out); s.start();
    return {
        set(v) { if (!ctx.skipping) g.gain.setTargetAtTime(v, c.currentTime, 0.08); },
        stop() { try { g.gain.setTargetAtTime(0, c.currentTime, 0.08); s.stop(c.currentTime + 0.4); } catch (e) { /* stopped */ } },
    };
}
export const sfx = {
    yank() { noise(0.25, 900, 0.18, "bandpass", 0, 0.6); tone(300, 0.2, "triangle", 0.08, 0, 160); },
    door() { tone(140, 0.08, "square", 0.08); noise(0.06, 2400, 0.1, "highpass"); },
    slam() { tone(90, 0.12, "square", 0.12); noise(0.1, 500, 0.2, "lowpass"); },
    thud() { A.sfxBump(); noise(0.14, 260, 0.22, "lowpass"); },
    whoosh() { noise(0.4, 600, 0.16, "bandpass", 0, 0.4); },
    boing() { tone(220, 0.35, "sine", 0.16, 0, 520); tone(330, 0.2, "triangle", 0.06, 0.05, 660); },
    pop() { noise(0.08, 1800, 0.35, "highpass"); tone(160, 0.1, "square", 0.1, 0, 60); noise(0.08, 1800, 0.3, "highpass", 0.16); tone(150, 0.1, "square", 0.09, 0.16, 60); },
    glass() { for (let i = 0; i < 5; i++) tone(2400 + Math.random() * 2400, 0.12, "triangle", 0.05, i * 0.03); noise(0.25, 5000, 0.18, "highpass"); },
    wood() { noise(0.18, 700, 0.3, "bandpass", 0, 1.2); tone(180, 0.12, "triangle", 0.1); noise(0.12, 900, 0.18, "bandpass", 0.07, 1.4); },
    metal() { tone(620, 0.3, "square", 0.05, 0, 410); tone(910, 0.25, "triangle", 0.05, 0.02, 700); noise(0.2, 1500, 0.2, "bandpass", 0, 0.8); },
    splat() { noise(0.25, 500, 0.25, "lowpass"); tone(120, 0.12, "sine", 0.12, 0, 60); },
    rattle(dur = 0.9) { for (let i = 0; i < Math.floor(dur / 0.05); i++) noise(0.04, 1100 + (i % 3) * 300, 0.07, "bandpass", i * 0.05, 3); },
    chaChing() { [988, 1319].forEach((f, i) => tone(f, 0.18, "triangle", 0.12, i * 0.09)); noise(0.12, 6000, 0.08, "highpass", 0.02); },
    sparkle() { [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.16, "sine", 0.06, i * 0.06)); },
    hiss: () => loop(5200, "highpass", 0.5),
    geyser: () => loop(1400, "bandpass", 0.5),
    scrape: () => loop(2600, "bandpass", 2.5),
};

// ── a shared soft sprite texture (stars over a dizzy head, sparkles) ───
let starTex = null;
export function starTexture() {
    if (starTex) return starTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    g.fillStyle = "#FFE082"; g.strokeStyle = "#E65100"; g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 12 : 28;
        g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath(); g.fill(); g.stroke();
    starTex = new THREE.CanvasTexture(c);
    starTex.colorSpace = THREE.SRGBColorSpace;
    return starTex;
}
let starMat = null;
/** Five little stars circling over a knocked-over head (shared material; dispose the group only). */
export function dizzyStars() {
    if (!starMat) starMat = new THREE.SpriteMaterial({ map: starTexture(), transparent: true, depthWrite: false });
    const g = new THREE.Group();
    for (let i = 0; i < 5; i++) { const s = new THREE.Sprite(starMat); s.scale.setScalar(0.24); g.add(s); }
    g.userData.spin = 0;
    return g;
}
export function spinStars(g, dt, y = 1.0) {
    g.userData.spin += dt * 5;
    g.children.forEach((s, i) => {
        const a = g.userData.spin + i * Math.PI * 2 / 5;
        s.position.set(Math.cos(a) * 0.32, y + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.32);
    });
}
