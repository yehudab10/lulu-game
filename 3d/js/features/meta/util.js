// features/meta — small shared helpers: the (test-overridable) clock, number
// formatting, a tiny WebAudio chime/grogger synth, and a toast that works on
// screens where the driving HUD (and its toasts) is hidden.
import { ctx, css } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import * as H from "../../hud.js";

export const Q = new URLSearchParams(location.search);
/** 2D pixels per 3D metre (Bubbe's house: 56,000 px in 2D ≈ 4,800 m in 3D). */
export const PX_PER_M = 11.7;

// ── the clock: ?metaDate=YYYY-MM-DD pins "today" (tests, holiday previews) ──
let offset = 0;
{
    const d = Q.get("metaDate");
    const m = d && /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(d);
    if (m) offset = new Date(+m[1], +m[2] - 1, +m[3], 12).getTime() - Date.now();
}
export const now = () => Date.now() + offset;

export const fmt = n => Math.floor(n || 0).toLocaleString("en-US");
export const clamp01 = v => Math.max(0, Math.min(1, v));
/** 2D distance units → a friendly 3D distance ("0.8 mi", "420 m"). */
export function distStr(units2d, preferMiles = true) {
    const m = (units2d || 0) / PX_PER_M;
    if (preferMiles && m >= 400) return (m / 1609.34).toFixed(m >= 16093 ? 0 : 1) + " mi";
    return fmt(m) + " m";
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ── sound: our own little synth (core's audio context isn't exported) ──────
let ac = null, out = null;
function unlock() {
    try {
        if (!ac) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            ac = new AC();
            out = ac.createGain();
            out.gain.value = 0.75;
            out.connect(ac.destination);
        }
        if (ac.state === "suspended") ac.resume().catch(() => {});
    } catch (e) { /* no audio */ }
}
for (const ev of ["pointerdown", "keydown", "touchend"]) window.addEventListener(ev, unlock, { passive: true });
function audio() {
    if (save3d.sound === false || !ac || ac.state !== "running") return null;
    return ac;
}
export function tone(freq, dur = 0.1, type = "triangle", vol = 0.2, delay = 0, slideTo = 0) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.03);
}
/** A rising arpeggio (quest complete, badge, holiday gift). */
export function chime(notes = [659, 880, 1175], step = 0.11, vol = 0.2) {
    notes.forEach((f, i) => tone(f, i === notes.length - 1 ? 0.16 : 0.1, "triangle", vol, i * step));
}
/** 🎭 Purim: the stock horn is a grogger (a quick wooden ratchet) — same voicing as 2D. */
export function grogger() {
    const a = audio();
    if (!a) return;
    const t = a.currentTime;
    for (let i = 0; i < 9; i++) {
        const o = a.createOscillator(), g = a.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(140 + (i % 2) * 40, t + i * 0.045);
        g.gain.setValueAtTime(0.0001, t + i * 0.045);
        g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.045 + 0.005);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.045 + 0.035);
        o.connect(g).connect(out);
        o.start(t + i * 0.045);
        o.stop(t + i * 0.045 + 0.04);
    }
}

// ── toasts that work everywhere (the core toasts live inside the driving HUD) ──
css("meta-toast", `
#metaToast { position: fixed; left: 50%; top: calc(max(14px, env(safe-area-inset-top)) + 4px); transform: translateX(-50%);
  z-index: 70; pointer-events: none; display: flex; flex-direction: column; align-items: center; gap: 8px; width: min(92vw, 640px); }
#metaToast .mt { background: rgba(43,27,46,.9); color: #FFE082; font-weight: 700; font-size: 17px; border-radius: 999px;
  padding: 9px 20px; box-shadow: 0 4px 0 rgba(0,0,0,.2), 0 8px 24px rgba(0,0,0,.25); text-align: center;
  animation: metaToastIn .35s cubic-bezier(.2,1.6,.4,1), metaToastOut .4s ease-in forwards; animation-delay: 0s, var(--life, 2.6s); }
#metaToast .mt.pink { color: #FFC1E0; } #metaToast .mt.green { color: #B9F6CA; }
@keyframes metaToastIn { from { transform: translateY(-14px) scale(.85); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes metaToastOut { to { transform: translateY(-10px); opacity: 0; } }
body.tv #metaToast .mt { font-size: 26px; padding: 12px 28px; }
`);
let toastBox = null;
const queue = [];
let showing = 0;
function pump() {
    if (showing || !queue.length) return;
    if (!toastBox) { toastBox = document.createElement("div"); toastBox.id = "metaToast"; document.body.appendChild(toastBox); }
    const { text, cls, life } = queue.shift();
    const t = document.createElement("div");
    t.className = "mt " + (cls || "");
    t.style.setProperty("--life", life + "s");
    t.textContent = text;
    toastBox.appendChild(t);
    showing = 1;
    setTimeout(() => { showing = 0; pump(); }, Math.max(700, life * 1000 - 600));
    setTimeout(() => t.remove(), life * 1000 + 450);
}
/** A queued toast at the top of the screen, visible on menus too. */
export function metaToast(text, cls = "", life = 2.6) {
    queue.push({ text, cls, life });
    if (queue.length > 4) queue.shift();
    pump();
}
/** Toast through the driving HUD when it's up, else through ours. */
export function note(text, cls = "gold") {
    const def = ctx.states[ctx.state];
    if (def && def.hud && !ctx.paused && !H.screenOpen()) H.toast(text, cls);
    else metaToast(text, cls === "gold" ? "" : cls);
}
