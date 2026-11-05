// features/dina — shared bits: models, the shared-save fields, little synth
// SFX (ported from the 2D game's playTone family), Dina's own DOM layer (HUD
// bar, speech bubbles, floaters, prompts), posing helpers and pointer picking.
import * as THREE from "three";
import { ctx, css, on } from "../../core/ctx.js";
import { save3d, shared, wallet } from "../../core/save.js";
import { registerModels, ensureModels, models, cloneWithColors } from "../../models.js";
import { input, glyph } from "../../input.js";

// ── models (all lazy: nothing of Dina's world loads until she's picked) ──
registerModels({
    dinaBus: "dina_bus", dinaSchool: "dina_school", dinaHouse: "dina_home", dinaProps: "dina_props",
    dinaGreenblatt: "dina_greenblatt", dinaGirlPony: "dina_girl_pony", dinaGirlBun: "dina_girl_bun", dinaGirlLong: "dina_girl_long",
    dinaMorgan: "dina_morgan", dinaRoom: "dina_room", dinaKitchen: "dina_kitchen", dinaTreats: "dina_treats",
});
export const STREET_MODELS = ["dinaBus", "dinaSchool", "dinaHouse", "dinaProps", "dinaGreenblatt", "dinaGirlPony", "dinaGirlBun",
    "dinaGirlLong", "imaPerson", "house", "treeRound", "bush", "sedan", "van"];
export const ROOM_MODELS = ["dinaRoom", "dinaMorgan", "dinaProps", "imaPerson", "dinaKitchen", "dinaTreats"];
export { ensureModels, models };

/** A prop's own sub-tree from a multi-prop asset (dinaProps / dinaRoom / dinaTreats), cloned. */
export function prop(key, name, colors = null) {
    const src = models[key] && models[key].getObjectByName(name);
    if (!src) throw new Error(`dina: no "${name}" in ${key}`);
    const tmp = new THREE.Group();
    tmp.add(src.clone(true));
    const c = cloneWithColors(tmp, colors).children[0];
    c.position.set(0, 0, 0);
    return c;
}
/** Exact-name child lookup (getObjectByName with the glTF-sanitized fallback). */
export function node(root, name) {
    return root.getObjectByName(name) || null;
}
/** Give a clone its own copies of the named materials (so animating one doesn't touch the template). */
export function ownMaterials(root, names) {
    const out = {};
    root.traverse(o => {
        if (!o.isMesh) return;
        const n = o.material.name;
        if (!names.includes(n)) return;
        if (!out[n]) out[n] = o.material.clone();
        o.material = out[n];
    });
    return out;
}

// ── the shared (2D) save: Dina's fields ──────────────────────────────────
export const S2 = {
    get() { return shared.get(); },
    runsPlayed() { return shared.get().dinaRunsPlayed || 0; },
    medals() {
        const m = shared.get().dinaMedals;
        return m && typeof m === "object" ? Object.assign({ gold: 0, silver: 0, bronze: 0 }, m) : { gold: 0, silver: 0, bronze: 0 };
    },
    coins() { return wallet.coins; },
};

/** The 💰 balance for HUDs (wallet.coins re-reads the 2D save; cache it between changes). */
let coinCache = null, coinT = 0;
on("wallet", () => { coinCache = null; });
on("shared:changed", () => { coinCache = null; });
export function coinsNow() {
    if (coinCache === null || ctx.time - coinT > 1) { coinCache = wallet.coins; coinT = ctx.time; }
    return coinCache;
}

// ── RNG: real randomness in the game, seeded in ?test runs (deterministic) ─
let seed = 1234567;
function seeded() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
export const rnd = () => (ctx.TEST ? seeded() : Math.random());
export const rand = (a, b) => a + rnd() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const randPick = arr => arr[Math.floor(rnd() * arr.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function easeOutBack(t) { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }

// ── SFX: the 2D game's synth helpers (playTone, playDogBark, playSchoolBell…) ─
let ac = null, out = null;
function audioCtx() {
    if (save3d.sound === false) return null;
    if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ac = new AC(); out = ac.createGain(); out.gain.value = 0.75; out.connect(ac.destination); } catch (e) { ac = null; return null; }
    }
    if (ac.state === "suspended") ac.resume().catch(() => {});
    return ac.state === "running" ? ac : null;
}
/** playTone(freq, duration, type, volume, sweepTo) — same signature as the 2D game. */
export function tone(freq, dur, type = "sine", vol = 0.2, sweepTo = 0, when = 0) {
    const a = audioCtx(); if (!a) return;
    const t = a.currentTime + when;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, filter, freq, vol, when = 0) {
    const a = audioCtx(); if (!a) return;
    const len = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
    const n = a.createBufferSource(); n.buffer = buf;
    const f = a.createBiquadFilter(); f.type = filter; f.frequency.value = freq;
    const g = a.createGain(); const t = a.currentTime + when;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + dur + 0.02);
}
export const sfx = {
    tone,
    click() { tone(700, 0.04, "square", 0.08); },
    deny() { tone(180, 0.15, "square", 0.15); },
    charSelect() { tone(660, 0.07, "triangle", 0.18, 990); tone(990, 0.1, "triangle", 0.18, 1320, 0.07); },
    schoolBell() { tone(1320, 0.5, "sine", 0.14); tone(1980, 0.5, "sine", 0.06); tone(1320, 0.5, "sine", 0.12, 0, 0.28); tone(1980, 0.5, "sine", 0.05, 0, 0.28); },
    doorHiss() { noise(0.4, "highpass", 3000, 0.12); },
    dogBark() { tone(280, 0.1, "sawtooth", 0.18, 180); tone(320, 0.12, "sawtooth", 0.18, 200, 0.14); },
    hop() { tone(440, 0.18, "triangle", 0.16, 880); },
    thud() { tone(180, 0.1, "square", 0.15); },
    step() { noise(0.05, "lowpass", 600, 0.05); },
    explosion() { noise(0.6, "lowpass", 900, 0.4); tone(80, 0.4, "sine", 0.3, 40); },
    womp() { [392, 349, 311, 261].forEach((f, i) => tone(f, 0.17, "sawtooth", 0.12, f * 0.6, i * 0.18)); },
    win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? 0.16 : 0.1, "triangle", 0.2 + i * 0.01, 0, [0, 0.1, 0.2, 0.32][i])); },
    yay() { [523, 659, 784, 1046].forEach((f, i) => tone(f, i === 3 ? 0.18 : 0.1, "triangle", 0.2, 0, i * 0.1)); },
    sparkle() { tone(1760, 0.08, "sine", 0.12, 2640); tone(2640, 0.08, "sine", 0.1, 3520, 0.06); tone(3520, 0.12, "sine", 0.08, 4400, 0.12); },
    chime() { tone(660, 0.08, "triangle", 0.18); tone(880, 0.1, "triangle", 0.18, 0, 0.08); },
    hug() { tone(784, 0.08, "triangle", 0.16); tone(988, 0.1, "triangle", 0.16, 0, 0.09); },
};

// ── Dina's DOM layer: HUD bar, bubbles, floaters, prompt, screen tint ─────
css("dina", `
#dinaLayer { position: fixed; inset: 0; pointer-events: none; font-family: var(--font); color: var(--ink); overflow: hidden; }
#dinaLayer.off { display: none; }
#dinaLayer .dl-hud { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  width: min(760px, calc(100% - 132px)); display: flex; gap: 10px; align-items: center; justify-content: space-between;
  background: rgba(43, 27, 46, .66); color: #fff; border-radius: 18px; padding: 7px 14px; font-weight: 700; font-size: 16px;
  box-shadow: 0 4px 0 rgba(0,0,0,.18); }
#dinaLayer .dl-hud:empty { display: none; }
#dinaLayer .dl-hud .t { font-size: 17px; letter-spacing: .02em; white-space: nowrap; }
#dinaLayer .dl-hud .chip { background: rgba(255,255,255,.16); border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
#dinaLayer .dl-hud .gold { color: #FFD54F; }
#dinaLayer .dl-bar { position: relative; flex: 1; min-width: 80px; height: 14px; border-radius: 999px; background: rgba(255,255,255,.22); }
#dinaLayer .dl-bar i { position: absolute; inset: 0 auto 0 0; border-radius: 999px; background: linear-gradient(90deg, #F48FB1, #FF4FA3); }
#dinaLayer .dl-bar b { position: absolute; top: 50%; transform: translate(-50%, -50%); font-size: 18px; line-height: 1; }
#dinaLayer .dl-bubble { position: absolute; left: 0; top: 0; transform: translate(-50%, -100%); background: #fff; border-radius: 16px;
  padding: 6px 12px; font-weight: 700; font-size: 16px; line-height: 1.2; white-space: pre-line; text-align: center;
  box-shadow: 0 3px 0 rgba(0,0,0,.16), 0 6px 16px rgba(0,0,0,.12); max-width: 260px; }
#dinaLayer .dl-bubble::after { content: ""; position: absolute; left: 50%; bottom: -9px; margin-left: -9px; border: 9px solid transparent;
  border-bottom: 0; border-top-color: #fff; }
#dinaLayer .dl-bubble.think { border-radius: 22px; }
#dinaLayer .dl-bubble.alert { background: #FFC107; padding: 2px 10px; font-size: 20px; }
#dinaLayer .dl-bubble.alert::after { border-top-color: #FFC107; }
#dinaLayer .dl-bubble.label { background: rgba(255,248,238,.97); }
#dinaLayer .dl-bubble.label::after { border-top-color: rgba(255,248,238,.97); }
#dinaLayer .dl-bubble .glyph { margin-left: 6px; }
#dinaLayer .dl-float { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); font-weight: 700; font-size: 22px; white-space: nowrap;
  text-shadow: 0 2px 0 rgba(0,0,0,.45), 0 0 6px rgba(0,0,0,.25); }
#dinaLayer .dl-prompt { position: absolute; left: 50%; bottom: calc(max(14px, env(safe-area-inset-bottom)) + 26px); transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; }
#dinaLayer .dl-prompt > div { background: rgba(43, 27, 46, .8); color: #fff; border-radius: 999px; padding: 8px 18px; font-weight: 700;
  font-size: 17px; white-space: nowrap; }
#dinaLayer .dl-prompt .big { font-size: 22px; background: rgba(43, 27, 46, .86); }
#dinaLayer .dl-prompt .gold { color: #FFD54F; }
#dinaLayer .dl-prompt .glyph { background: #fff; color: var(--ink); }
#dinaLayer .dl-tint { position: absolute; inset: 0; opacity: 0; transition: opacity .25s; }
#dinaLayer .dl-msg { position: absolute; left: 50%; top: calc(max(10px, env(safe-area-inset-top)) + 58px); transform: translateX(-50%);
  background: rgba(0,0,0,.66); color: #FFD54F; font-weight: 700; font-size: 18px; border-radius: 14px; padding: 7px 16px; white-space: nowrap; }
#dinaLayer .dl-msg:empty { display: none; }
#dinaLayer .dl-sprint { position: absolute; left: 0; top: 0; width: 64px; height: 9px; margin-left: -32px; border-radius: 6px; background: rgba(0,0,0,.4); }
#dinaLayer .dl-sprint i { position: absolute; left: 1px; top: 1px; bottom: 1px; border-radius: 5px; }
#dinaLayer .dl-sprint b { position: absolute; left: 50%; top: -20px; transform: translateX(-50%); font-size: 15px; }
#dinaLayer .dl-btn { pointer-events: auto; position: absolute; border: none; border-radius: 16px; font: 700 16px var(--font); color: #fff; cursor: pointer;
  background: #43A047; box-shadow: 0 4px 0 rgba(0,0,0,.22); padding: 9px 14px; display: flex; align-items: center; gap: 6px; }
#dinaLayer .dl-btn .glyph { background: rgba(255,255,255,.92); color: var(--ink); }
body.touch #dinaLayer .dl-prompt { bottom: calc(max(14px, env(safe-area-inset-bottom)) + 178px); }
body.tv #dinaLayer .dl-hud { font-size: 24px; width: min(1200px, 84vw); padding: 12px 24px; top: 4vh; }
body.tv #dinaLayer .dl-hud .t { font-size: 26px; }
body.tv #dinaLayer .dl-bubble { font-size: 24px; max-width: 420px; padding: 10px 18px; }
body.tv #dinaLayer .dl-float { font-size: 32px; }
body.tv #dinaLayer .dl-prompt > div { font-size: 24px; padding: 10px 24px; }
body.tv #dinaLayer .dl-prompt { bottom: 6vh; }
body.tv #dinaLayer .dl-msg { font-size: 26px; top: calc(4vh + 80px); }
@media (max-width: 600px) {
  #dinaLayer .dl-hud { width: calc(100% - 76px); left: 12px; transform: none; font-size: 13px; padding: 6px 10px; gap: 6px; flex-wrap: wrap; }
  #dinaLayer .dl-hud .t { font-size: 14px; }
  #dinaLayer .dl-bubble { font-size: 14px; max-width: 200px; }
  #dinaLayer .dl-prompt > div { font-size: 15px; white-space: normal; }
}
/* the driving touch pedals double as SPRINT / SLOW on Dina's run; hidden indoors */
body.dina-run #tBoost, body.dina-run #tHonk, body.dina-run #tCam, body.dina-room .pedals, body.dina-run #touchExtra { display: none !important; }
body.dina-run #tGas, body.dina-run #tBrake { font-size: 0; }
body.dina-run #tGas::after { content: "⚡ SPRINT"; font-size: 15px; }
body.dina-run #tBrake::after { content: "🐢 SLOW"; font-size: 15px; }
body.dina-run #stickZone span, body.dina-room #stickZone span { font-size: 0; }
body.dina-run #stickZone span::after, body.dina-room #stickZone span::after { content: "MOVE"; font-size: 12px; }
`);

export const layer = document.createElement("div");
layer.id = "dinaLayer";
layer.className = "off";
layer.innerHTML = `<div class="dl-tint"></div><div class="dl-world"></div><div class="dl-hud"></div><div class="dl-msg"></div><div class="dl-prompt"></div>`;
document.body.insertBefore(layer, document.getElementById("screen"));   // under menus, over the 3D + touch pad
const $tint = layer.querySelector(".dl-tint"), $world = layer.querySelector(".dl-world");
const $hud = layer.querySelector(".dl-hud"), $msg = layer.querySelector(".dl-msg"), $prompt = layer.querySelector(".dl-prompt");

let lastHud = null, lastPrompt = null, lastMsg = null;
export const L = {
    show(on = true) { layer.classList.toggle("off", !on); if (!on) L.clear(); },
    hud(html) { if (html !== lastHud) { lastHud = html; $hud.innerHTML = html || ""; } },
    msg(text) { text = text || ""; if (text !== lastMsg) { lastMsg = text; $msg.textContent = text; } },
    prompt(html) { if (html !== lastPrompt) { lastPrompt = html; $prompt.innerHTML = html || ""; } },
    tint(color, alpha) { $tint.style.background = color; $tint.style.opacity = String(alpha); },
    clear() {
        L.hud(""); L.msg(""); L.prompt(""); L.tint("transparent", 0);
        for (const b of bubbles.values()) b.el.remove();
        bubbles.clear();
        for (const f of floats) f.el.remove();
        floats.length = 0;
        for (const e of extras) e.remove();
        extras.length = 0;
    },
    /** A round ❚❚ button (touch / mouse) — the driving HUD's pause button is hidden in Dina's scenes. */
    pauseButton() {
        const b = L.add("❚❚", "dl-btn dl-pause");
        b.addEventListener("click", () => { if (pauseFn) pauseFn(); });
        return b;
    },
    /** A DOM element on the layer that L.clear() removes (buttons, bars…). */
    add(html, cls = "") {
        const e = document.createElement("div");
        e.className = cls;
        e.innerHTML = html;
        $world.appendChild(e);
        extras.push(e);
        return e;
    },
};
const extras = [];
let pauseFn = null;
export function setPauseFn(fn) { pauseFn = fn; }

// speech bubbles anchored to 3D points (call bubble() every frame it should show)
const bubbles = new Map();
const _v = new THREE.Vector3();
export function toScreen(pos, camera, outp = {}) {
    _v.copy(pos).project(camera);
    outp.x = (_v.x * 0.5 + 0.5) * window.innerWidth;
    outp.y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
    outp.visible = _v.z < 1 && _v.z > -1;
    return outp;
}
const _s = {};
/** fallback: {x, y} screen fractions to park the bubble at when the point is off-screen / behind the camera. */
export function bubble(key, text, pos, camera, cls = "", fallback = null) {
    let b = bubbles.get(key);
    if (!b) {
        const el = document.createElement("div");
        $world.appendChild(el);
        b = { el, text: null, cls: null };
        bubbles.set(key, b);
    }
    b.seen = frameNo;
    if (b.text !== text) { b.text = text; b.el.innerHTML = text; }
    if (b.cls !== cls) { b.cls = cls; b.el.className = "dl-bubble " + cls; }
    toScreen(pos, camera, _s);
    const W = window.innerWidth, H = window.innerHeight;
    if (fallback && (!_s.visible || _s.y > H * 0.92)) {
        _s.x = fallback.x * W; _s.y = fallback.y * H; _s.visible = true;
    }
    b.el.style.display = _s.visible ? "" : "none";
    b.el.style.left = Math.max(70, Math.min(W - 70, _s.x)).toFixed(1) + "px";
    b.el.style.top = Math.max(60, _s.y).toFixed(1) + "px";
}
let frameNo = 0;
/** Call once per frame after drawing bubbles: hides the ones not refreshed this frame. */
export function bubblesDone() {
    for (const [k, b] of bubbles) if (b.seen !== frameNo) { b.el.remove(); bubbles.delete(k); }
    frameNo++;
}

// floaters: "+2 🐕" rising from a 3D point
const floats = [];
export function floater(text, pos, color = "#FFD54F", life = 1.1) {
    const el = document.createElement("div");
    el.className = "dl-float";
    el.textContent = text;
    el.style.color = color;
    $world.appendChild(el);
    floats.push({ el, pos: pos.clone(), t: 0, life });
}
export function updateFloaters(dt, camera) {
    for (let i = floats.length - 1; i >= 0; i--) {
        const f = floats[i];
        f.t += dt;
        if (f.t >= f.life) { f.el.remove(); floats.splice(i, 1); continue; }
        toScreen(f.pos, camera, _s);
        const k = f.t / f.life;
        f.el.style.left = _s.x.toFixed(1) + "px";
        f.el.style.top = (_s.y - k * 60).toFixed(1) + "px";
        f.el.style.opacity = String(Math.min(1, (1 - k) * 2.2));
        f.el.style.transform = `translate(-50%, -50%) scale(${(1 + Math.min(0.25, f.t * 2) - Math.max(0, k - 0.6) * 0.3).toFixed(3)})`;
    }
}

// ── people posing on top of core/people.js ───────────────────────────────
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
/** Override a limb's rotation after person.update() (x forward/back swing, z sideways). */
export function poseLimb(person, limb, x, z = 0, y = 0) {
    const n = person.limbs[limb];
    if (!n) return;
    n.quaternion.copy(n.userData.base).multiply(_q.setFromEuler(_e.set(x, y, z, "XYZ")));
}
/** Both arms forward (holding a plate / hugging Morgan). */
export function holdPose(person, forward = -1.2, inward = 0.35) {
    poseLimb(person, "Arm_L", forward, -inward);
    poseLimb(person, "Arm_R", forward, inward);
}
/** Attach a prop to a person's limb/body node at a local offset. */
export function attach(person, limb, obj, x = 0, y = 0, z = 0) {
    const n = person.limbs[limb] || person.obj;
    obj.position.set(x, y, z);
    n.add(obj);
    return obj;
}
/** Hand position (local to the arm pivot) for a person of height h. */
export const handY = h => -(0.42 + 0.03) * h / 1.62;

// ── pointer picking on the 3D canvas (touch / mouse) ─────────────────────
const canvas = document.getElementById("scene");
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let ptrHandlers = null;
/** Route canvas pointer events to {down(e), move(e), up(e)} until unbindPointer(). */
export function bindPointer(h) {
    unbindPointer();
    const wrap = fn => e => { try { fn && fn(e); } catch (err) { console.error("[dina pointer]", err); } };
    ptrHandlers = { down: wrap(h.down), move: wrap(h.move), up: wrap(h.up) };
    canvas.addEventListener("pointerdown", ptrHandlers.down);
    window.addEventListener("pointermove", ptrHandlers.move);
    window.addEventListener("pointerup", ptrHandlers.up);
}
export function unbindPointer() {
    if (!ptrHandlers) return;
    canvas.removeEventListener("pointerdown", ptrHandlers.down);
    window.removeEventListener("pointermove", ptrHandlers.move);
    window.removeEventListener("pointerup", ptrHandlers.up);
    ptrHandlers = null;
}
/** Raycast a pointer event against objects (recursive). */
export function pickAt(e, camera, objects) {
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(objects, true);
}
/** Where a pointer ray hits the plane z = z0 (or y = y0 with axis "y"). */
export function pointerPlane(e, camera, value, axis = "z") {
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction;
    const k = axis === "z" ? (value - o.z) / d.z : (value - o.y) / d.y;
    if (!isFinite(k) || k < 0) return null;
    return new THREE.Vector3(o.x + d.x * k, o.y + d.y * k, o.z + d.z * k);
}

// ── prompts with the right button glyph ──────────────────────────────────
export const isTouch = () => input.device === "touch";
export function g(action) { return glyph(action); }

// ── confetti / sparkles that live in a set ───────────────────────────────
const _dotTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d");
    const grd = x.createRadialGradient(32, 32, 0, 32, 32, 30);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.5, "rgba(255,255,255,0.8)"); grd.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grd; x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
/**
 * Simple CPU particles (sparkles, dust puffs, confetti, splashes) as one Points
 * object: fx.burst(pos, n, {speed, color(s), size, life, gravity, up}).
 */
export class Fx {
    constructor(scene, max = 400) {
        this.max = max; this.n = 0;
        this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3); this.c = new Float32Array(max * 3);
        this.life = new Float32Array(max); this.maxLife = new Float32Array(max); this.grav = new Float32Array(max);
        this.size = new Float32Array(max); this.a = new Float32Array(max);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(this.p, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(this.c, 3));
        geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
        geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.a, 1));
        this.geo = geo;
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: { map: { value: _dotTex }, scale: { value: window.innerHeight * 0.9 } },
            vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float scale;
                void main() { vA = aAlpha; vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `uniform sampler2D map; varying float vA; varying vec3 vC;
                void main() { vec4 t = texture2D(map, gl_PointCoord); if (t.a * vA < 0.02) discard; gl_FragColor = vec4(vC, t.a * vA); }`,
        });
        this.points = new THREE.Points(geo, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 5;
        scene.add(this.points);
        this.i = 0;
    }
    emit(x, y, z, vx, vy, vz, size, life, col, gravity = 4) {
        const i = this.i++ % this.max;
        this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
        this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
        const c = new THREE.Color(col);
        this.c[i * 3] = c.r; this.c[i * 3 + 1] = c.g; this.c[i * 3 + 2] = c.b;
        this.size[i] = size; this.life[i] = this.maxLife[i] = life; this.grav[i] = gravity;
    }
    burst(pos, n, { speed = 2, colors = ["#FFD700"], size = 0.12, life = 0.8, gravity = 4, up = 1 } = {}) {
        for (let k = 0; k < n; k++) {
            const a = Math.random() * Math.PI * 2, u = 0.3 + Math.random() * 0.7;
            this.emit(pos.x, pos.y, pos.z, Math.cos(a) * speed * u, speed * up * (0.3 + Math.random()), Math.sin(a) * speed * u,
                size * (0.7 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), colors[k % colors.length], gravity);
        }
    }
    update(dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) { this.a[i] = 0; continue; }
            this.life[i] -= dt;
            this.v[i * 3 + 1] -= this.grav[i] * dt;
            this.p[i * 3] += this.v[i * 3] * dt; this.p[i * 3 + 1] += this.v[i * 3 + 1] * dt; this.p[i * 3 + 2] += this.v[i * 3 + 2] * dt;
            this.a[i] = Math.min(1, this.life[i] / this.maxLife[i] * 1.6);
        }
        this.mat.uniforms.scale.value = window.innerHeight * 0.9;
        const at = this.geo.attributes;
        at.position.needsUpdate = at.aAlpha.needsUpdate = at.color.needsUpdate = at.aSize.needsUpdate = true;
    }
    dispose() { this.geo.dispose(); this.mat.dispose(); if (this.points.parent) this.points.parent.remove(this.points); }
}

/** A little canvas texture helper for posters, drawings and window views. */
export function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}
/** An emoji/text sprite (hearts, Z's, stickers in 3D). */
export function emojiSprite(text, size = 0.3, color = "#fff") {
    const tex = canvasTexture(128, 128, (x) => {
        x.font = `700 96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",Fredoka,Arial`;
        x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = color;
        x.fillText(text, 64, 70);
    });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.setScalar(size);
    s.userData.tex = tex;
    return s;
}
export function disposeSprite(s) { if (s.userData.tex) s.userData.tex.dispose(); s.material.dispose(); }
