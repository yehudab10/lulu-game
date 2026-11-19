// features/heist — shared plumbing: models, small maths, the ONE objective chip + the ONE
// target beacon (pooled), who-says-what (banter's bubble while driving, foot's on foot), props
// in hands, stats, and a tiny WebAudio synth (alarm bell, confetti pop, net zap, moped buzz).
import * as THREE from "three";
import { ctx, emit, css, hook, on } from "../../core/ctx.js";
import { registerModels, ensureModels, models, cloneWithColors, findNodes } from "../../models.js";
import { save3d } from "../../core/save.js";
import { glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { ID } from "./data.js";

// every heist model is lazy (only the bank rides in with a town's models — see town data `uses`)
export const KEYS = {
    heist_bank: "heist_bank", heistBankInt: "heist_bankint", heistProps: "heist_props", heistRobber: "heist_robber",
    heistGuard: "heist_guard", heistTeller: "heist_teller", heistGetaway: "heist_getaway", heistMoped: "heist_moped",
    heistNet: "heist_net", heistSpikes: "heist_spikes", heistStore: "heist_store",
};
registerModels(KEYS);
export { models, cloneWithColors, findNodes };
/** Load models; resolves false (never throws). */
export async function need(keys) {
    try { await ensureModels(keys); return true; } catch (e) { console.warn("[heist] models", e); return false; }
}
export const ready = keys => keys.every(k => !!models[k]);

/** In a 🎉 party only heist's PERSONAL bits run — the cops' stun net / spike strip in her own chase (law is personal
 *  in a party), the moped snatcher (a scene prop, never in the traffic) and the thief at her own parked car (foot's
 *  local stub) — and only on a 🏡 Road Trip / 🌍 Free Roam run, never while a party game (a race / dash / tag / a
 *  Free Roam game she's in) is on. Robberies (a getaway car + a store building on one screen) and Lulu's own heist
 *  stay solo: ARCHITECTURE › the party parity table says what they'd need. */
export const PARTY_OK = new Set(["gear", "snatch"]);
export const inParty = () => !!(ctx.party && ctx.party.active);
export function partyFree() {
    const pt = ctx.party, G = ctx.G;
    if (!pt || !pt.active || !G || G.mode !== "party") return false;
    const k = pt.activity && pt.activity.k;
    if (k !== "trip" && k !== "roam") return false;
    const ow = ctx.openworld, g = ow && ow.debug && ow.debug.getG ? ow.debug.getG() : null;
    return !(g && g.ph === "go" && Array.isArray(g.ps) && g.ps.includes(pt.uid));
}
/** Random / surprise content gate: on in the game, off in ?test unless enabled; in a 🎉 party only `what` ∈ PARTY_OK. */
export const live = (what = "") => ctx.enabled(ID) && (!inParty() || (PARTY_OK.has(what) && partyFree()));
/** Free driving for `what`: solo Cruise, or (PARTY_OK bits) a party's Road Trip / Free Roam. */
export const freeMode = (what = "") => !!ctx.G && (ctx.G.mode === "cruise" || (PARTY_OK.has(what) && partyFree()));

export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = l => l[Math.floor(Math.random() * l.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const _p = {};
export function pt(s, d, out = _p) { return ctx.world.road.point(s, d, out); }
export const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
/** Where Lulu is (her car, or her on foot). */
export function luluPos() { return onFoot() && ctx.foot.pos ? ctx.foot.pos : ctx.car.pos; }
export function distTo(x, z) { const p = luluPos(); return Math.hypot(x - p.x, z - p.z); }
export function stat(id, n = 1) { emit("stat", { id, n }); }
export function best(id, v) { try { if (ctx.meta && ctx.meta.best) ctx.meta.best(id, v); } catch (e) { /* meta missing */ } }
export function inTown() { return !!(ctx.town && ctx.town.active); }

// ── who says what ───────────────────────────────────────────────────────
const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";
/** Lulu says something: foot's bubble on foot, banter's line while driving. big = a story beat (always). */
export function luluSays(text, big = false) {
    if (!text || ctx.skipping) return false;
    if (!big && chatter() === "quiet") return false;
    try {
        if (onFoot() && ctx.foot.obj) return !!ctx.foot.say(ctx.foot.obj, text, 2.4);
        if (ctx.banter && ctx.banter.say) return !!ctx.banter.say(text);
    } catch (e) { console.error("[heist] say", e); }
    return false;
}
/** A speech bubble over someone (foot's bubbles on foot, banter's pooled ones while driving). */
export function npcSays(obj, text, sec = 2.4, cls = "") {
    if (!obj || !text || ctx.skipping) return;
    try {
        if (onFoot() && ctx.foot.say) { ctx.foot.say(obj, text, sec, { cls }); return; }
        if (ctx.banter && ctx.banter.bubble && ctx.banter.bubble(text, obj, { dur: sec, y: 2.0, cls: cls || "nice" })) return;
    } catch (e) { console.error("[heist] bubble", e); }
}
/** A line remembered across runs (memory's capped log) — never on the HUD. */
export function remember(kind, data) { try { if (ctx.memory && ctx.memory.remember) ctx.memory.remember("heist:" + kind, data); } catch (e) { /* no memory */ } }

// ── props in hands ──────────────────────────────────────────────────────
/** A clone of Prop_<name> from heist_props (an empty group if it isn't loaded). */
export function prop(name) {
    const src = models.heistProps && findNodes(models.heistProps, "Prop_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true);
    c.position.set(0, 0, 0);
    return c;
}
/** Put a prop in a person's hand (the arm pivot is the shoulder; the hand is ~0.45 m down). */
export function hold(person, name, { arm = "Arm_R", y = -0.47, z = 0.06, rx = -1.4 } = {}) {
    const a = person.limbs && person.limbs[arm];
    const p = typeof name === "string" ? prop(name) : name;
    p.position.set(0, y, z);
    p.rotation.x = rx;
    if (a) a.add(p);
    return p;
}

// ── the objective chip + the target beacon (pooled: one of each) ─────────
css(ID, `
.heist-chip { display: none; flex-direction: column; align-items: center; gap: 3px; pointer-events: none; margin-top: 6px; }
.heist-chip.on { display: flex; }
.heist-chip b { background: rgba(33,18,46,.84); color: #FFE082; border-radius: 999px; padding: 5px 16px; font-weight: 700; font-size: 15px;
  letter-spacing: .03em; white-space: nowrap; box-shadow: 0 3px 0 rgba(0,0,0,.22); border: 2px solid var(--hacc, #FF4081); }
.heist-chip small { background: rgba(255,248,238,.9); color: var(--ink, #2b1b2e); border-radius: 999px; padding: 2px 12px; font-weight: 600; font-size: 12px; white-space: nowrap; }
.heist-chip .heist-meter { width: 150px; height: 7px; border-radius: 99px; background: rgba(255,255,255,.25); overflow: hidden; }
.heist-chip .heist-meter i { display: block; height: 100%; background: linear-gradient(90deg, #FFD740, #FF4081); }
@media (max-width: 560px) { .heist-chip b { font-size: 12px; padding: 4px 10px; } .heist-chip small { font-size: 10px; } }
body.tv .heist-chip b { font-size: 24px; padding: 8px 24px; } body.tv .heist-chip small { font-size: 18px; }
#heistFlash { position: fixed; inset: 0; pointer-events: none; opacity: 0; background: radial-gradient(circle at 50% 55%, rgba(64,196,255,0) 30%, rgba(64,196,255,.55) 100%); }
`);
let chipEl = null;
function chip() {
    if (chipEl && chipEl.isConnected) return chipEl;
    chipEl = document.createElement("div");
    chipEl.className = "heist-chip";
    chipEl.innerHTML = `<b></b><small class="hud-secondary"></small><div class="heist-meter hud-secondary"><i></i></div>`;
    const slot = H.hudSlot("center");
    if (slot) slot.appendChild(chipEl);
    return chipEl;
}
const chipState = { text: null, sub: null, frac: null, color: null };
/** Show the objective: text, a sub line ("" hides it), a 0–1 meter (null hides it), the accent colour. null text hides it. */
export function setChip(text, sub = "", frac = null, color = "#FF4081") {
    const el = chip();
    if (!text) { if (chipState.text !== null) { el.classList.remove("on"); chipState.text = null; } return; }
    if (chipState.text !== text) { el.querySelector("b").innerHTML = text; chipState.text = text; }
    if (chipState.sub !== sub) { const s = el.querySelector("small"); s.innerHTML = sub; s.style.display = sub ? "" : "none"; chipState.sub = sub; }
    const fr = frac == null ? null : Math.round(clamp(frac, 0, 1) * 50) / 50;
    if (chipState.frac !== fr) { const m = el.querySelector(".heist-meter"); m.style.display = fr == null ? "none" : ""; if (fr != null) m.firstChild.style.width = (fr * 100) + "%"; chipState.frac = fr; }
    if (chipState.color !== color) { el.style.setProperty("--hacc", color); chipState.color = color; }
    el.classList.add("on");
    chipState.f = ctx.frames;
}
export const fmtM = m => `${Math.max(0, Math.round(m))} m`;
export const g = a => glyph(a);

let beacon = null;
/** A bobbing arrow over the target (a getaway car, a moped, her stolen car, the bank's door). null hides it. */
export function setBeacon(target, color = "#FF4081") {
    if (!beacon) {
        const geo = new THREE.ConeGeometry(0.45, 0.9, 4);
        geo.rotateX(Math.PI);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.88, depthWrite: false });
        beacon = new THREE.Mesh(geo, mat);
        beacon.renderOrder = 3;
        beacon.userData.heist = true;
    }
    if (!target) { if (beacon.parent) beacon.parent.remove(beacon); return; }
    if (!beacon.parent) ctx.scene.add(beacon);
    beacon.material.color.set(color);
    const p = target.isObject3D ? target.position : target;
    beacon.position.set(p.x, (p.y || 0) + (target.lift || 2.9) + Math.sin(ctx.time * 4) * 0.18, p.z);
    beacon.rotation.y += 0.04;
    beacon.userData.f = ctx.frames;
}
// The chip and the beacon live only while someone keeps setting them: whatever isn't refreshed this frame goes away
// (no stale objective after an event ends some unexpected way), and a state change clears both.
hook("hud", () => {
    if (chipState.text !== null && chipState.f !== ctx.frames && chipState.f !== ctx.frames - 1) setChip(null);
    if (beacon && beacon.parent && beacon.userData.f !== ctx.frames && beacon.userData.f !== ctx.frames - 1) setBeacon(null);
}, -50);
on("state", () => { if (chipState.text !== null) setChip(null); if (beacon && beacon.parent) setBeacon(null); });

// ── a tiny synth (its own context, like streets'; Sound off = silent) ──
let ac = null, out = null;
function actx() {
    if (save3d.sound === false || ctx.skipping || !A.audio.ready) return null;
    try {
        if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); out = ac.createGain(); out.gain.value = 0.45; out.connect(ac.destination); }
        if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { return null; }
    return ac;
}
function tone(freq, dur, type = "square", vol = 0.08, slide = 0, delay = 0) {
    const c = actx();
    if (!c) return;
    try {
        const t0 = c.currentTime + delay;
        const o = c.createOscillator(), gn = c.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t0);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
        gn.gain.setValueAtTime(vol, t0); gn.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
        o.connect(gn); gn.connect(out);
        o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) { /* no audio */ }
}
export const sfx = {
    bell(n = 6) { for (let i = 0; i < n; i++) { tone(1320, 0.09, "square", 0.05, 0, i * 0.12); tone(1100, 0.09, "square", 0.04, 0, i * 0.12 + 0.06); } },
    pop() { tone(180, 0.18, "sawtooth", 0.09, 600); tone(900, 0.25, "triangle", 0.05, 900, 0.05); },
    zap() { tone(1800, 0.25, "sawtooth", 0.05, -1500); tone(60, 0.3, "square", 0.05, 40); },
    rip() { tone(300, 0.2, "sawtooth", 0.06, -200); },
    buzz() { tone(140, 0.4, "sawtooth", 0.03, 30); },
    yay() { tone(523, 0.12, "triangle", 0.08); tone(659, 0.12, "triangle", 0.08, 0, 0.1); tone(784, 0.2, "triangle", 0.08, 0, 0.2); },
    womp() { tone(330, 0.25, "triangle", 0.08, -120); tone(220, 0.4, "triangle", 0.08, -80, 0.22); },
    coin() { try { A.sfxCoin(); } catch (e) { /* */ } },
    siren(sec = 1.5) { try { A.sfxSiren(sec); } catch (e) { /* */ } },
};
/** Particles from Lulu's car's emitter (skipped while skipping). */
export function burst(x, y, z, n, spd, rgb, size, life) {
    if (ctx.car && ctx.car.fx && !ctx.skipping) ctx.car.fx.burst(x, y, z, n, spd, rgb, size, life);
}
export const CONFETTI = [[1, 0.25, 0.5], [0.25, 0.77, 1], [1, 0.84, 0.25], [0.49, 0.3, 1], [0.41, 0.94, 0.68]];
export function confetti(x, y, z, n = 30) { for (let i = 0; i < 5; i++) burst(x, y, z, Math.ceil(n / 5), 3.2, CONFETTI[i], 0.16, 1.1); }
