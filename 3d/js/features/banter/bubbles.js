// features/banter — speech bubbles. DOM (crisp, emoji-friendly), pooled (one
// for Lulu, a handful for everybody else), positioned every frame by
// projecting a point in the 3D world through the driving camera.
//
// Lulu's bubble sits up and to the LEFT of her head with its tail pointing
// down-right at her, so it never covers the middle of the road. In "Lulu's
// eyes" (first person) her head is the camera, so the bubble parks low on the
// left of the screen instead.
import * as THREE from "three";
import { ctx, css } from "../../core/ctx.js";
import { bubbleOk } from "../../hud.js";
import { CAMS } from "../../core/camera.js";
import { clamp } from "./util.js";

css("banter-bubbles", `
#banterBubbles { position: fixed; inset: 0; pointer-events: none; z-index: 6; overflow: hidden; }
#banterBubbles.off { display: none; }
.bn-b { position: absolute; left: 0; top: 0; will-change: transform; }
.bn-b.hide { display: none; }
.bn-in { position: relative; display: block; width: max-content; max-width: 230px; text-align: center; white-space: normal;
  background: #fff; color: var(--ink); font: 700 15px/1.18 var(--font); padding: 6px 11px 7px; border-radius: 14px;
  box-shadow: 0 2px 0 rgba(0,0,0,.14), 0 5px 14px rgba(0,0,0,.2);
  animation: bnPop .34s cubic-bezier(.2,1.65,.4,1) both; transition: opacity .2s ease-in, transform .2s ease-in; }
.bn-b.out .bn-in { opacity: 0; transform: translateY(-7px) scale(.88); }
.bn-in::before, .bn-in::after { content: ""; position: absolute; top: 100%; border: solid transparent; border-bottom: 0; }
.bn-in::after { left: 50%; margin-left: -7px; border-width: 8px 7px 0; border-top-color: #fff; }
.bn-in::before { display: none; }
/* Lulu: pink-rimmed, tail at the lower right (pointing at her head) */
.bn-lulu .bn-in { border: 2px solid #F06292; color: #AD1457; transform-origin: 86% 120%; }
.bn-lulu .bn-in::before { display: block; left: 86%; margin-left: -10px; border-width: 11px 9px 0; border-top-color: #F06292; }
.bn-lulu .bn-in::after { left: 86%; margin-left: -7px; margin-top: -1px; border-width: 8px 6px 0; }
.bn-lulu.big .bn-in { font-size: 17px; }
/* everybody else: smaller, tinted by mood, tail in the middle */
.bn-npc .bn-in { font-size: 13px; padding: 4px 9px 5px; max-width: 190px; transform-origin: 50% 120%; }
.bn-npc.angry .bn-in { background: #FFEBEE; color: #B71C1C; } .bn-npc.angry .bn-in::after { border-top-color: #FFEBEE; }
.bn-npc.nice .bn-in { background: #E8F5E9; color: #1B5E20; } .bn-npc.nice .bn-in::after { border-top-color: #E8F5E9; }
.bn-npc.cop .bn-in { background: #E3F2FD; color: #0D47A1; } .bn-npc.cop .bn-in::after { border-top-color: #E3F2FD; }
.bn-npc.kid .bn-in { background: #FFF8E1; color: #E65100; } .bn-npc.kid .bn-in::after { border-top-color: #FFF8E1; }
.bn-npc.truck .bn-in { background: #FFF3E0; color: #4E342E; } .bn-npc.truck .bn-in::after { border-top-color: #FFF3E0; }
@keyframes bnPop { 0% { transform: scale(.35) rotate(-4deg); opacity: 0; } 60% { opacity: 1; } 100% { transform: none; opacity: 1; } }
body.tv .bn-in { font-size: 22px; max-width: 380px; padding: 8px 16px 9px; border-radius: 18px; }
body.tv .bn-npc .bn-in { font-size: 19px; max-width: 320px; padding: 6px 13px 7px; }
body.tv .bn-lulu.big .bn-in { font-size: 25px; }
@media (max-width: 600px), (max-height: 420px) {
  .bn-in { font-size: 13px; max-width: 42vw; padding: 5px 9px 6px; }
  .bn-npc .bn-in { font-size: 11.5px; max-width: 36vw; padding: 3px 8px 4px; }
  .bn-lulu.big .bn-in { font-size: 14px; }
}
`);

const layer = document.createElement("div");
layer.id = "banterBubbles";
layer.className = "off";
document.body.appendChild(layer);

function makeEl(cls) {
    const el = document.createElement("div");
    el.className = "bn-b hide " + cls;
    const inner = document.createElement("span");
    inner.className = "bn-in";
    el.appendChild(inner);
    layer.appendChild(el);
    return { el, inner };
}
/** Restart the pop-in animation (cheap: only when a bubble opens). */
function pop(inner) { inner.style.animation = "none"; void inner.offsetWidth; inner.style.animation = ""; }

const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// The HUD stacks Lulu's bubble must not cover (re-measured a few times a second, not every frame).
const hudAvoid = { t: -1, rects: [] };
function hudRects() {
    const now = performance.now();
    if (now - hudAvoid.t < 300) return hudAvoid.rects;
    hudAvoid.t = now;
    hudAvoid.rects.length = 0;
    for (const id of ["slot-center", "slot-left"]) {
        const el = document.getElementById(id);
        if (!el || !el.childElementCount) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 1 && r.height > 1) hudAvoid.rects.push({ id, l: r.left, r: r.right, t: r.top, b: r.bottom });
    }
    return hudAvoid.rects;
}
/** Is the driving banner (leg card, "GO!") up right now? Lines wait for it. */
export function bannerUp() {
    const b = document.getElementById("banner");
    return !!b && !b.classList.contains("hidden") && b.offsetParent !== null;
}

// ── Lulu's bubble ───────────────────────────────────────────────────────────
const L = Object.assign(makeEl("bn-lulu"), { on: false, t: 0, dur: 0, w: 0, h: 0, text: "", cat: "", x: -1, y: -1, n: 0 });
let headFn = null;     // (out Vector3) → Lulu's head in world space (the rig provides it)
export function setHeadSource(fn) { headFn = fn; }

/** Show a line over Lulu's head for `dur` seconds (replaces what she was saying). */
export function showLulu(text, dur, { big = false, cat = "" } = {}) {
    L.inner.textContent = text;
    L.el.className = "bn-b bn-lulu" + (big ? " big" : "");
    L.on = true; L.t = 0; L.dur = dur; L.text = text; L.cat = cat; L.n++;
    L.x = L.y = -1;
    L.w = L.h = 0;           // measured once per line, on its first visible frame
    pop(L.inner);
}
export function hideLulu() { if (L.on) { L.on = false; L.el.classList.add("hide"); } }
export function luluBubble() { return L; }

function placeLulu(W, Hh) {
    const cam = ctx.camera, car = ctx.car;
    if (!L.w) { L.w = L.inner.offsetWidth; L.h = L.inner.offsetHeight; }
    const fp = !!(CAMS[ctx.cam ? ctx.cam.mode : 0] || {}).fp;
    let x, y;
    if (!fp && headFn && headFn(_v)) {
        // up and to the left of her head, in the car's frame
        _v.x += Math.cos(car.h) * 0.62; _v.z -= Math.sin(car.h) * 0.62;
        _v.y += 0.66;
        _w.copy(_v).project(cam);
        if (_w.z < 1 && Math.abs(_w.x) < 1.3 && Math.abs(_w.y) < 1.3) { x = (_w.x + 1) / 2 * W; y = (1 - _w.y) / 2 * Hh; }
    }
    if (x === undefined) { x = W * 0.3; y = Hh * 0.66; }          // first person (or off-screen): low on the left
    // the tail (86% across) sits on the anchor; keep the card on screen and wholly LEFT of the road's centre line
    const tailX = L.w * 0.86;
    x = clamp(x, tailX + 10, W * 0.46 - (L.w - tailX));
    y = clamp(y, L.h + 74, Hh - 40);
    // step around the HUD stacks: left of the centre one if there's room, else below it
    for (const r of hudRects()) {
        const bl = x - tailX, bt = y - L.h - 11;
        if (bl > r.r + 6 || bl + L.w < r.l - 6 || bt > r.b + 6 || bt + L.h < r.t - 6) continue;
        if (r.id === "slot-center" && r.l - 8 - L.w >= 8) x = r.l - 8 - L.w + tailX;
        else y = Math.min(Hh - 40, r.b + 8 + L.h + 11);
    }
    if (Math.abs(x - L.x) < 0.4 && Math.abs(y - L.y) < 0.4) return;
    L.x = x; L.y = y;
    L.el.style.transform = `translate(${(x - tailX).toFixed(1)}px, ${(y - L.h - 11).toFixed(1)}px)`;
}

// ── everybody else (pooled) ────────────────────────────────────────────────
const POOL = 5;
const npc = [];
for (let i = 0; i < POOL; i++) npc.push(Object.assign(makeEl("bn-npc"), { on: false, t: 0, dur: 0, target: null, y: 2.3, text: "" }));

/**
 * A bubble over another driver / a pedestrian. target: Object3D (followed).
 * opts: dur (s), y (metres above the target's origin), cls ("angry" | "nice" | "cop" | "kid" | "truck").
 */
export function npcBubble(text, target, { dur = 2.4, y = 2.3, cls = "" } = {}) {
    if (!target) return null;
    let b = npc.find(n => n.on && n.target === target);
    if (!b) b = npc.find(n => !n.on);
    if (!b) { b = npc[0]; for (const n of npc) if (n.t / n.dur > b.t / b.dur) b = n; }   // oldest goes
    b.inner.textContent = text;
    b.el.className = "bn-b bn-npc " + cls + (bubbleOk(dur) ? "" : " calm-off");     // (the pop-up budget, hud.js)
    b.on = true; b.t = 0; b.dur = dur; b.target = target; b.y = y; b.text = text;
    pop(b.inner);
    return b;
}
export function npcBubbles() { return npc; }
export function dropTarget(target) { for (const b of npc) if (b.on && b.target === target) { b.on = false; b.el.classList.add("hide"); } }

function placeNpc(b, W, Hh) {
    const cam = ctx.camera;
    b.target.getWorldPosition(_v);
    _v.y += b.y;
    const dist = _v.distanceTo(cam.position);
    _v.project(cam);
    if (!(_v.z < 1 && dist < 110 && Math.abs(_v.x) < 1.15 && Math.abs(_v.y) < 1.15)) { b.el.style.opacity = "0"; return; }
    b.el.style.opacity = "";
    const x = (_v.x + 1) / 2 * W, y = (1 - _v.y) / 2 * Hh;
    const sc = clamp(24 / dist, 0.72, 1);
    b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${sc.toFixed(2)})`;
}

// ── per frame ───────────────────────────────────────────────────────────────
/** show = may bubbles be on screen right now (free driving, no dialog/pause/cutscene). */
export function updateBubbles(dt, show) {
    if (!show) { clearBubbles(); layer.classList.add("off"); return; }
    layer.classList.remove("off");
    const W = innerWidth, Hh = innerHeight;
    if (L.on) {
        L.t += dt;
        if (L.t >= L.dur) hideLulu();
        else {
            if (L.t > L.dur - 0.22) L.el.classList.add("out");
            placeLulu(W, Hh);
        }
    }
    for (const b of npc) {
        if (!b.on) continue;
        b.t += dt;
        if (b.t >= b.dur || !b.target || !b.target.parent) { b.on = false; b.el.classList.add("hide"); continue; }
        if (b.t > b.dur - 0.22) b.el.classList.add("out");
        placeNpc(b, W, Hh);
    }
}
export function clearBubbles() {
    hideLulu();
    for (const b of npc) if (b.on) { b.on = false; b.el.classList.add("hide"); }
}
/** Screen rectangles of the visible bubbles (tests: small, off the road centre). */
export function bubbleRects() {
    const out = [];
    if (L.on) { const r = L.inner.getBoundingClientRect(); out.push({ who: "lulu", text: L.text, x: r.left, y: r.top, w: r.width, h: r.height }); }
    for (const b of npc) if (b.on) { const r = b.inner.getBoundingClientRect(); out.push({ who: "npc", text: b.text, x: r.left, y: r.top, w: r.width, h: r.height }); }
    return out;
}
