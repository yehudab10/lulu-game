// features/law — DOM overlay for the law scenes: the pulsing "UNDER ARREST"
// header, big captions, a progress bar, world-anchored speech bubbles, the
// jury-mood meter, the lockpick bar, fades, scene toasts — plus the driving
// HUD bits (wanted stars, the SPOTTED / BUSTED / EVADING meters).
// Everything here is display only; input goes through showScreen / say / choose.
import * as THREE from "three";
import { css } from "../../core/ctx.js";
import * as H from "../../hud.js";

css("law", `
#lawUI { position: fixed; inset: 0; pointer-events: none; z-index: 30; font-family: var(--font); }
#lawUI .law-head { position: absolute; top: max(12px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  background: rgba(150,20,20,.9); color: #fff; border: 2px solid #FFD250; border-radius: 12px; padding: 6px 22px; text-align: center;
  font-weight: 700; font-size: 20px; letter-spacing: .06em; box-shadow: 0 4px 18px rgba(0,0,0,.35); animation: lawPulse 0.9s ease-in-out infinite alternate; }
#lawUI .law-head small { display: block; font-size: 13px; letter-spacing: .02em; color: #FFCDD2; font-weight: 600; }
#lawUI .law-cap { position: absolute; left: 50%; top: 17%; transform: translateX(-50%); width: min(92vw, 760px); text-align: center;
  color: #FFD54F; font-weight: 700; font-size: 30px; text-shadow: 0 3px 0 #000, 0 0 18px rgba(0,0,0,.6); }
#lawUI .law-cap small { display: block; color: #fff; font-size: 17px; margin-top: 6px; text-shadow: 0 2px 0 #000; }
#lawUI .law-cap.pop { animation: lawPop .4s cubic-bezier(.2,1.6,.4,1); }
#lawUI .law-bar { position: absolute; left: 50%; top: calc(17% + 74px); transform: translateX(-50%); width: min(70vw, 420px); text-align: center; }
#lawUI .law-bar .track { height: 12px; border-radius: 6px; background: rgba(0,0,0,.5); overflow: hidden; border: 2px solid rgba(255,255,255,.4); }
#lawUI .law-bar .fill { height: 100%; width: 0%; background: linear-gradient(90deg, #FF5252, #FFB300); }
#lawUI .law-bar .lbl { color: #fff; font-weight: 700; font-size: 14px; margin-top: 4px; text-shadow: 0 2px 0 #000; }
#lawUI .law-bubble { position: absolute; transform: translate(-50%, -100%); background: #fff; color: var(--ink); border-radius: 16px;
  padding: 8px 14px; font-weight: 700; font-size: 16px; max-width: 280px; text-align: center; box-shadow: 0 4px 0 rgba(0,0,0,.2);
  white-space: normal; animation: lawPop .3s cubic-bezier(.2,1.6,.4,1); }
#lawUI .law-bubble::after { content: ""; position: absolute; left: 50%; bottom: -9px; transform: translateX(-50%);
  border: 10px solid transparent; border-top-color: #fff; border-bottom: 0; }
#lawUI .law-bubble b { display: block; font-size: 11px; letter-spacing: .1em; opacity: .6; }
#lawUI .law-toasts { position: absolute; left: 50%; top: 32%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px; }
#lawUI .law-toast { font-weight: 700; font-size: 24px; color: #fff; text-shadow: 0 3px 0 rgba(0,0,0,.6); animation: toast 1.9s ease-out forwards; white-space: nowrap; }
#lawUI .law-toast.gold { color: #FFE082; } #lawUI .law-toast.red { color: #FF8A80; } #lawUI .law-toast.green { color: #B9F6CA; } #lawUI .law-toast.pink { color: #FFC1E0; }
#lawUI .law-meter { position: absolute; left: max(14px, env(safe-area-inset-left)); top: max(14px, env(safe-area-inset-top));
  background: rgba(16,10,30,.78); border-radius: 12px; padding: 8px 12px; width: 210px; color: #fff; }
#lawUI .law-meter .t { font-size: 11px; letter-spacing: .14em; font-weight: 700; color: #B39DDB; }
#lawUI .law-meter .g { position: relative; height: 10px; border-radius: 5px; margin: 6px 0; background: linear-gradient(90deg, #E53935, #FFB300 50%, #66BB6A); }
#lawUI .law-meter .n { position: absolute; top: 50%; width: 14px; height: 14px; border-radius: 50%; background: #fff; border: 2px solid #1A1230;
  transform: translate(-50%, -50%); transition: left .5s cubic-bezier(.2,1.4,.4,1); }
#lawUI .law-meter .f { font-size: 12px; font-weight: 700; line-height: 1.35; }
#lawUI .law-meter .f.p { color: #A5D6A7; } #lawUI .law-meter .f.m { color: #EF9A9A; }
#lawUI .law-meter.blip { animation: lawPop .4s; }
#lawUI .law-pick { position: absolute; left: 50%; bottom: 26%; transform: translateX(-50%); width: min(92vw, 520px);
  background: rgba(0,0,0,.82); border: 3px solid #FFD54F; border-radius: 18px; padding: 14px 20px; text-align: center; color: #fff; }
#lawUI .law-pick.missed { border-color: #FF1744; animation: shake .3s; }
#lawUI .law-pick h3 { margin: 0; color: #FFD54F; font-size: 22px; }
#lawUI .law-pick .hint { font-size: 14px; opacity: .85; margin: 2px 0 10px; }
#lawUI .law-pick .track { position: relative; height: 30px; border-radius: 8px; background: #263238; overflow: hidden; }
#lawUI .law-pick .zone { position: absolute; top: 0; bottom: 0; background: #66BB6A; border-radius: 4px; }
#lawUI .law-pick .needle { position: absolute; top: -4px; bottom: -4px; width: 5px; margin-left: -2px; background: #FFEB3B; box-shadow: 0 0 8px #FFEB3B; }
#lawUI .law-pick .row { display: flex; justify-content: center; gap: 10px; margin-top: 10px; font-size: 22px; }
#lawUI .law-pick .row span { opacity: .35; } #lawUI .law-pick .row span.on { opacity: 1; }
#lawFade { position: fixed; inset: 0; background: #08061a; opacity: 0; pointer-events: none; z-index: 35; transition: opacity .6s; }
#lawFade.on { opacity: 1; }
#lawFade.flash { background: #fff; transition: none; }
.law-wanted { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.law-wanted .stars { font-size: 24px; letter-spacing: 2px; color: #FFD54F; text-shadow: 0 2px 0 rgba(0,0,0,.5), 0 0 10px rgba(0,0,0,.4); }
.law-wanted .stars.hot { color: #FF5252; }
.law-wanted .stars i { font-style: normal; opacity: .35; }
.law-wanted .tag { background: rgba(150,20,20,.88); color: #fff; border-radius: 999px; padding: 3px 12px; font-weight: 700; font-size: 13px; letter-spacing: .06em; }
.law-wanted .tag.fug { background: #E65100; }
.law-wanted .tag.blink { animation: lawPulse .5s ease-in-out infinite alternate; }
.law-wanted .mtr { width: 150px; }
.law-wanted .mtr .track { height: 8px; border-radius: 4px; background: rgba(0,0,0,.45); overflow: hidden; }
.law-wanted .mtr .fill { height: 100%; width: 0%; }
.law-wanted .mtr .lbl { font-size: 11px; font-weight: 700; color: #fff; text-shadow: 0 1px 0 #000; text-align: right; letter-spacing: .08em; }
body.tv #lawUI .law-head { font-size: 30px; } body.tv #lawUI .law-cap { font-size: 46px; } body.tv #lawUI .law-cap small { font-size: 26px; }
body.tv #lawUI .law-bubble { font-size: 24px; max-width: 420px; } body.tv #lawUI .law-toast { font-size: 36px; }
body.tv #lawUI .law-meter { width: 320px; } body.tv #lawUI .law-meter .f { font-size: 18px; }
body.tv .law-wanted .stars { font-size: 36px; } body.tv .law-wanted .tag { font-size: 20px; }
@media (max-aspect-ratio: 1/1) { #lawUI .law-cap { font-size: 24px; top: 12%; } #lawUI .law-bar { top: calc(12% + 66px); }
  #lawUI .law-meter { width: 170px; } #lawUI .law-bubble { font-size: 14px; max-width: 200px; } }
@keyframes lawPulse { from { filter: brightness(1); } to { filter: brightness(1.35); } }
@keyframes lawPop { from { transform: translate(-50%, -100%) scale(.7); opacity: 0; } to { opacity: 1; } }
/* law scenes: the menu card sits off to the side so the 3D set stays visible */
body.law-scene #screen { background: linear-gradient(90deg, rgba(10,6,20,0) 40%, rgba(10,6,20,.55)); justify-content: flex-end; align-items: center; padding-right: max(3vw, 14px); }
body.law-scene #screenCard { width: min(430px, 100%); }
body.law-scene #screenCard h2 { font-size: 24px; }
body.law-scene #screenCard .btn { width: 100%; font-size: 17px; padding: 11px 14px; }
body.law-scene #screenCard .btn small { display: block; font-size: 12px; opacity: .85; font-weight: 600; }
body.law-scene #screenCard .btn .lbl { display: flex; flex-direction: column; align-items: center; }
body.law-scene .law-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
body.law-scene .law-grid .btn { min-height: 64px; }
body.law-scene .btn.locked { background: #757575; }
body.law-scene .btn.gold { background: #F9A825; } body.law-scene .btn.teal { background: #00897B; } body.law-scene .btn.blue { background: #1E88E5; }
body.law-scene .sheet { background: #F3EBD3; border: 2px solid #9E8A5A; border-radius: 8px; padding: 8px 12px; font: 700 13px "Courier New", monospace;
  color: #3E2723; text-align: left; margin: 6px 0; }
body.law-scene .sheet b { display: block; text-align: center; color: #7A1F1A; letter-spacing: .1em; margin-bottom: 2px; }
body.law-scene .fine2 { font-size: 13px; opacity: .7; margin: 4px 0; }
@media (max-aspect-ratio: 1/1) {
  body.law-scene #screen { justify-content: center; align-items: flex-end; padding: 0 10px max(10px, env(safe-area-inset-bottom)); background: linear-gradient(180deg, rgba(10,6,20,0) 45%, rgba(10,6,20,.6)); }
  body.law-scene #screenCard { max-height: 58vh; padding: 14px 16px; }
  body.law-scene .law-grid .btn { min-height: 54px; font-size: 15px; }
}
body.tv.law-scene #screenCard { width: min(640px, 100%); } body.tv.law-scene #screenCard .btn { font-size: 24px; }
`);

const root = document.createElement("div");
root.id = "lawUI";
root.innerHTML = `<div class="law-head hidden"></div><div class="law-cap hidden"></div>
    <div class="law-bar hidden"><div class="track"><div class="fill"></div></div><div class="lbl"></div></div>
    <div class="law-toasts"></div><div class="law-meter hidden"></div><div class="law-pick hidden"></div><div class="law-bubbles"></div>`;
document.body.appendChild(root);
const fade = document.createElement("div");
fade.id = "lawFade";
document.body.appendChild(fade);
const $ = s => root.querySelector(s);
const head = $(".law-head"), cap = $(".law-cap"), bar = $(".law-bar"), toasts = $(".law-toasts"), meter = $(".law-meter"), pickEl = $(".law-pick"), bubbles = $(".law-bubbles");

export function header(html) { if (!html) head.classList.add("hidden"); else { head.innerHTML = html; head.classList.remove("hidden"); } }
export function caption(html, sub = "") {
    if (!html) { cap.classList.add("hidden"); cap.dataset.k = ""; return; }
    const k = html + "|" + sub;
    if (cap.dataset.k === k) return;
    cap.dataset.k = k;
    cap.innerHTML = html + (sub ? `<small>${sub}</small>` : "");
    cap.classList.remove("hidden", "pop"); void cap.offsetWidth; cap.classList.add("pop");
}
export function progress(frac, label) {
    if (frac == null) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    bar.querySelector(".fill").style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + "%";
    const l = bar.querySelector(".lbl");
    if (l.innerHTML !== label) l.innerHTML = label || "";
}
export function toast(text, cls = "") {
    const t = document.createElement("div");
    t.className = "law-toast " + cls;
    t.textContent = text;
    toasts.appendChild(t);
    while (toasts.children.length > 3) toasts.firstChild.remove();
    setTimeout(() => t.remove(), 1900);
}
/** Toast that shows whether or not the driving HUD is up. */
export function say(text, cls = "") { if (document.getElementById("hud").classList.contains("hidden")) toast(text, cls); else H.toast(text, cls); }

export function fadeTo(on, ms = 600) {
    fade.classList.remove("flash");
    fade.style.transitionDuration = ms + "ms";
    fade.classList.toggle("on", !!on);
}
export function flashWhite() {
    fade.classList.add("flash"); fade.classList.add("on");
    fade.style.opacity = "0.85";
    requestAnimationFrame(() => { fade.classList.remove("flash"); fade.style.transitionDuration = "380ms"; fade.style.opacity = ""; fade.classList.remove("on"); });
}

// ── world-anchored speech bubbles ────────────────────────────────────────
const _v = new THREE.Vector3();
const live = new Map();   // key → { el, obj, y, until }
/** Show `text` over a 3D object (or Vector3) for `sec` seconds. */
export function bubble(key, obj, text, { who = "", y = 2.1, sec = 3 } = {}) {
    let b = live.get(key);
    if (!b) { const el = document.createElement("div"); el.className = "law-bubble"; bubbles.appendChild(el); b = { el }; live.set(key, b); }
    b.obj = obj; b.y = y; b.until = performance.now() + sec * 1000;
    b.el.innerHTML = (who ? `<b>${who}</b>` : "") + text;
    b.el.style.display = "";
}
export function clearBubbles() { for (const b of live.values()) b.el.remove(); live.clear(); }
/** Call every frame from the scene that owns the bubbles. */
export function updateBubbles(camera) {
    const now = performance.now(), W = window.innerWidth, Hh = window.innerHeight;
    for (const [k, b] of live) {
        if (now > b.until) { b.el.remove(); live.delete(k); continue; }
        if (b.obj.isObject3D) { b.obj.getWorldPosition(_v); _v.y += b.y; } else _v.set(b.obj.x, b.obj.y + b.y, b.obj.z);
        _v.project(camera);
        if (_v.z > 1 || _v.z < -1) { b.el.style.display = "none"; continue; }
        b.el.style.display = "";
        b.el.style.left = Math.max(90, Math.min(W - 90, (_v.x + 1) / 2 * W)) + "px";
        b.el.style.top = Math.max(60, Math.min(Hh - 20, (1 - _v.y) / 2 * Hh)) + "px";
    }
}

// ── the jury-mood meter ──────────────────────────────────────────────────
export function juryMeter(court) {
    if (!court || !court.factors.length) { meter.classList.add("hidden"); return; }
    const lp = Math.max(0.04, Math.min(0.96, 0.5 + (court.lean || 0) * 0.22));
    meter.innerHTML = `<div class="t">⚖️ JURY MOOD</div><div class="g"><div class="n" style="left:${(lp * 100).toFixed(1)}%"></div></div>` +
        court.factors.slice(-3).map(f => `<div class="f ${f.a >= 0 ? "p" : "m"}">${f.a >= 0 ? "▲" : "▼"} ${f.t}</div>`).join("");
    meter.classList.remove("hidden", "blip"); void meter.offsetWidth; meter.classList.add("blip");
}

// ── the lockpick bar ─────────────────────────────────────────────────────
export function lockpick(lk, hintHtml) {
    if (!lk) { pickEl.classList.add("hidden"); return; }
    if (pickEl.classList.contains("hidden") || !pickEl.querySelector(".track")) {
        pickEl.innerHTML = `<h3>🔓 PICK THE LOCK</h3><div class="hint"></div><div class="track"><div class="zone"></div><div class="needle"></div></div>
            <div class="row pins"></div><div class="row strikes"></div>`;
        pickEl.classList.remove("hidden");
    }
    pickEl.querySelector(".hint").innerHTML = lk.result === "win" ? "🔓 CLICK! You're out!" : lk.result === "lose" ? "🚨 CAUGHT! Back to your cell." : hintHtml;
    const z = pickEl.querySelector(".zone");
    z.style.left = ((lk.zoneC - lk.zoneW / 2) * 100).toFixed(2) + "%";
    z.style.width = (lk.zoneW * 100).toFixed(2) + "%";
    pickEl.querySelector(".needle").style.left = (lk.pos * 100).toFixed(2) + "%";
    pickEl.querySelector(".pins").innerHTML = Array.from({ length: lk.pins }, (_, i) => `<span class="${i < lk.done ? "on" : ""}">${i < lk.done ? "🟢" : "⚪"}</span>`).join("");
    pickEl.querySelector(".strikes").innerHTML = "STRIKES " + Array.from({ length: lk.maxMiss }, (_, i) => `<span class="${i < lk.misses ? "on" : ""}">✖️</span>`).join("");
    pickEl.classList.toggle("missed", (lk.missFx || 0) > 0);
}

export function hideAll() {
    header(""); caption(""); progress(null); juryMeter(null); lockpick(null); clearBubbles();
}

// ── driving HUD: wanted stars + meters ───────────────────────────────────
let hudEl = null;
export function wantedHud(info) {
    if (!info) { if (hudEl) { hudEl.remove(); hudEl = null; } return; }
    if (!hudEl || !hudEl.isConnected) {
        hudEl = document.createElement("div");
        hudEl.className = "law-wanted";
        H.hudSlot("right").appendChild(hudEl);
    }
    const stars = "★".repeat(info.stars) + `<i>${"★".repeat(5 - info.stars)}</i>`;
    const m = (frac, label, color) => frac > 0.02 ? `<div class="mtr"><div class="track"><div class="fill" style="width:${(frac * 100).toFixed(0)}%;background:${color}"></div></div><div class="lbl">${label}</div></div>` : "";
    const html = `${info.tag ? `<div class="tag ${info.fug ? "fug" : ""} ${info.blink ? "blink" : ""}">${info.tag}</div>` : ""}
        ${info.stars ? `<div class="stars ${info.stars >= 4 ? "hot" : ""}">${stars}</div>` : ""}
        ${m(info.bust || 0, "BUSTED", "#FF1744")}${m(info.evade || 0, "EVADING", "#69F0AE")}${m(info.spot || 0, "👀 SPOTTED", "#FF8A80")}${m(info.radar || 0, "📡 RADAR", "#FFD740")}`;
    if (hudEl.dataset.h !== html) { hudEl.dataset.h = html; hudEl.innerHTML = html; }
}
