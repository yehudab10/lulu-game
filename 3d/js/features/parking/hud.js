// The parking minigame's own HUD (the driving HUD is hidden in the lot):
// level / timer / lives / stars / coins bar, the "HOLD STILL TO PARK!" prompt,
// the level-intro card, big result text + star rating, the low-time vignette,
// the red bump flash and the white zoom transition. Pure DOM, pointer-events
// off except the pause button.
import { css } from "../../core/ctx.js";
import { pause } from "../../core/screens.js";

css("parking", `
#parkHud { position: fixed; inset: 0; pointer-events: none; z-index: 6; font-family: var(--font); color: #fff; }
#parkHud.hidden { display: none; }
#parkHud .ph-bar { position: absolute; top: max(10px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px; background: rgba(20, 16, 34, 0.62); border-radius: 999px; padding: 6px 10px 6px 16px;
  box-shadow: 0 4px 14px rgba(0,0,0,.25); white-space: nowrap; max-width: calc(100% - 90px); }
#parkHud .ph-title { font-weight: 700; font-size: 17px; color: #FFD700; text-shadow: 0 2px 0 rgba(0,0,0,.4); overflow: hidden; text-overflow: ellipsis; }
#parkHud .ph-chip { font-weight: 700; font-size: 15px; background: rgba(255,255,255,.12); border-radius: 999px; padding: 3px 10px; }
#parkHud .ph-lives { color: #FF80AB; } #parkHud .ph-stars, #parkHud .ph-coins { color: #FFD700; }
#parkHud .ph-time { min-width: 64px; text-align: center; font-variant-numeric: tabular-nums; }
#parkHud .ph-time.low { animation: phBlink .5s steps(2) infinite; color: #FF5252; font-size: 17px; }
@keyframes phBlink { 50% { color: #FFEB3B; } }
#parkHud .ph-pause { position: absolute; top: max(10px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
  pointer-events: auto; width: 46px; height: 46px; border-radius: 50%; border: none; background: rgba(255,255,255,.9); color: var(--ink);
  font: 700 18px var(--font); box-shadow: 0 3px 0 rgba(0,0,0,.2); cursor: pointer; }
#parkHud .ph-hint { position: absolute; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%);
  background: rgba(20,16,34,.7); border-radius: 999px; padding: 8px 18px; font-weight: 700; font-size: 16px; white-space: nowrap; }
#parkHud .ph-hint .glyph { background: #fff; color: var(--ink); }
#parkHud .ph-hint.hold { background: rgba(46,125,50,.92); font-size: 22px; animation: phPulse .5s ease-in-out infinite alternate; }
@keyframes phPulse { from { transform: translateX(-50%) scale(1); } to { transform: translateX(-50%) scale(1.08); } }
body.touch #parkHud .ph-hint { bottom: calc(max(14px, env(safe-area-inset-bottom)) + 160px); }
#parkHud .ph-hold { position: absolute; left: 50%; bottom: calc(max(18px, env(safe-area-inset-bottom)) + 48px); transform: translateX(-50%);
  width: 180px; height: 8px; border-radius: 999px; background: rgba(0,0,0,.35); overflow: hidden; }
body.touch #parkHud .ph-hold { bottom: calc(max(14px, env(safe-area-inset-bottom)) + 206px); }
#parkHud .ph-hold i { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #A5D6A7, #43A047); }
#parkHud .ph-intro { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center;
  background: rgba(0,0,0,.5); padding: 18px 12px; transition: opacity .35s; }
#parkHud .ph-intro b { display: block; font-size: 34px; color: #FFD700; text-shadow: 0 3px 0 rgba(0,0,0,.5); }
#parkHud .ph-intro span { display: block; margin-top: 6px; font-size: 17px; font-weight: 700; }
#parkHud .ph-big { position: absolute; left: 50%; top: 11%; transform: translateX(-50%); text-align: center; width: 100%; }
#parkHud .ph-big h1 { margin: 0; font-size: 54px; line-height: 1; color: #FFEB3B; text-shadow: 0 5px 0 #0D47A1, 0 8px 20px rgba(0,0,0,.35);
  animation: phBounce .5s ease-in-out infinite alternate; }
#parkHud .ph-big.fail h1 { color: #F44336; text-shadow: 0 5px 0 #000, 0 8px 20px rgba(0,0,0,.4); animation: none; }
#parkHud .ph-big .perfect { font-size: 24px; font-weight: 700; color: #80D8FF; text-shadow: 0 3px 0 #01579B; margin-bottom: 8px; }
#parkHud .ph-big .sub { font-size: 26px; font-weight: 700; margin-top: 10px; text-shadow: 0 3px 0 #0D47A1; }
#parkHud .ph-big.fail .sub { text-shadow: 0 2px 0 #000; font-size: 21px; }
#parkHud .ph-big .pay { display: inline-block; margin-top: 10px; font-size: 18px; font-weight: 700; color: #FFD700; background: rgba(0,0,0,.45);
  border-radius: 999px; padding: 4px 14px; }
#parkHud .ph-big .heart { font-size: 24px; font-weight: 700; color: #FFCDD2; margin-top: 8px; text-shadow: 0 2px 0 #000; }
#parkHud .ph-rate { margin-top: 4px; font-size: 44px; letter-spacing: 8px; transition: opacity .4s; }
#parkHud .ph-rate .off { color: #9E9E9E; filter: grayscale(1); opacity: .7; }
@keyframes phBounce { from { transform: scale(1); } to { transform: scale(1.08); } }
#parkHud .ph-skip { position: absolute; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%); font-size: 14px; font-weight: 700; opacity: .8; }
#parkHud .ph-skip .glyph { background: #fff; color: var(--ink); }
#parkHud .ph-vig { position: absolute; inset: 0; opacity: 0;
  background: radial-gradient(ellipse at center, rgba(244,67,54,0) 55%, rgba(244,67,54,.85) 100%); }
#parkHud .ph-flash { position: absolute; inset: 0; background: #f44336; opacity: 0; }
#parkHud .ph-tint { position: absolute; inset: 0; opacity: 0; }
#parkWhite { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 7; }
@media (max-aspect-ratio: 1/1) {
  #parkHud .ph-bar { top: calc(max(10px, env(safe-area-inset-top)) + 52px); gap: 6px; padding: 5px 8px 5px 12px; }
  #parkHud .ph-title { font-size: 14px; } #parkHud .ph-chip { font-size: 13px; padding: 2px 8px; }
  #parkHud .ph-big h1 { font-size: 42px; } #parkHud .ph-big .sub { font-size: 20px; }
  #parkHud .ph-hint { font-size: 13px; white-space: normal; width: calc(100% - 40px); text-align: center; border-radius: 18px; }
}
body.tv #parkHud .ph-bar { top: 4vh; padding: 10px 16px 10px 24px; gap: 16px; }
body.tv #parkHud .ph-title { font-size: 28px; } body.tv #parkHud .ph-chip { font-size: 24px; padding: 4px 16px; }
body.tv #parkHud .ph-hint { font-size: 24px; bottom: 5vh; padding: 12px 28px; } body.tv #parkHud .ph-hint.hold { font-size: 32px; }
body.tv #parkHud .ph-big h1 { font-size: 84px; } body.tv #parkHud .ph-big .sub { font-size: 38px; }
body.tv #parkHud .ph-big .pay { font-size: 28px; } body.tv #parkHud .ph-rate { font-size: 80px; }
body.tv #parkHud .ph-intro b { font-size: 52px; } body.tv #parkHud .ph-intro span { font-size: 26px; }
body.tv #parkHud .ph-pause { display: none; }
`);

const root = document.createElement("div");
root.id = "parkHud";
root.className = "hidden";
root.innerHTML = `
  <div class="ph-tint"></div><div class="ph-vig"></div><div class="ph-flash"></div>
  <div class="ph-bar"><span class="ph-chip ph-lives"></span><span class="ph-title"></span><span class="ph-chip ph-stars"></span><span class="ph-chip ph-coins"></span><span class="ph-chip ph-time"></span></div>
  <button class="ph-pause" aria-label="Pause">❚❚</button>
  <div class="ph-intro" style="opacity:0"><b></b><span></span></div>
  <div class="ph-big" style="display:none"></div>
  <div class="ph-hold" style="display:none"><i></i></div>
  <div class="ph-hint"></div>
  <div class="ph-skip" style="display:none"></div>`;
const white = document.createElement("div");
white.id = "parkWhite";
const mount = () => { document.body.appendChild(root); document.body.appendChild(white); };
if (document.body) mount(); else addEventListener("DOMContentLoaded", mount);
const q = s => root.querySelector(s);
const el = {
    bar: q(".ph-bar"), title: q(".ph-title"), lives: q(".ph-lives"), stars: q(".ph-stars"), coins: q(".ph-coins"), time: q(".ph-time"),
    intro: q(".ph-intro"), big: q(".ph-big"), hold: q(".ph-hold"), holdFill: q(".ph-hold i"), hint: q(".ph-hint"), skip: q(".ph-skip"),
    vig: q(".ph-vig"), flash: q(".ph-flash"), tint: q(".ph-tint"), pause: q(".ph-pause"),
};
el.pause.addEventListener("click", () => pause());

const last = {};
function set(node, key, html) { if (last[key] !== html) { last[key] = html; node.innerHTML = html; } }
function show(node, key, on) { const v = on ? "" : "none"; if (last[key] !== v) { last[key] = v; node.style.display = v; } }

export const PH = {
    show(on) { root.classList.toggle("hidden", !on); },
    /** bar: { title, lives, stars?, coins?, time, low } */
    bar(b) {
        set(el.title, "title", b.title);
        set(el.lives, "lives", `♥ ${b.lives}`);
        show(el.stars, "starsOn", b.stars != null); if (b.stars != null) set(el.stars, "stars", `★ ${b.stars}`);
        show(el.coins, "coinsOn", b.coins != null); if (b.coins != null) set(el.coins, "coins", `$${b.coins}`);
        set(el.time, "time", `⏱ ${Math.max(0, Math.ceil(b.time))}s`);
        el.time.classList.toggle("low", !!b.low);
    },
    showBar(on) { show(el.bar, "barOn", on); },
    hint(html, hold = false) { set(el.hint, "hint", html); el.hint.classList.toggle("hold", hold); show(el.hint, "hintOn", !!html); },
    holdBar(frac) { show(el.hold, "holdOn", frac > 0); if (frac > 0) el.holdFill.style.width = (Math.min(1, frac) * 100).toFixed(0) + "%"; },
    intro(title, details, alpha) { set(el.intro, "intro", `<b>${title}</b>${details ? `<span>${details}</span>` : ""}`); el.intro.style.opacity = alpha; },
    big(html, fail) { show(el.big, "bigOn", !!html); if (html) { set(el.big, "big", html); el.big.classList.toggle("fail", !!fail); } },
    rate(stars, alpha) {
        const r = el.big.querySelector(".ph-rate");
        if (!r) return;
        const h = [0, 1, 2].map(i => i < stars ? "⭐" : `<span class="off">⭐</span>`).join("");
        if (r.dataset.h !== h) { r.dataset.h = h; r.innerHTML = h; }
        r.style.opacity = alpha;
    },
    skip(html) { set(el.skip, "skip", html || ""); show(el.skip, "skipOn", !!html); },
    vignette(a) { el.vig.style.opacity = a.toFixed(3); },
    flash(a) { el.flash.style.opacity = (a * 0.35).toFixed(3); },
    tint(color, a) { el.tint.style.background = color; el.tint.style.opacity = a; },
    white(a) { white.style.transition = ""; white.style.opacity = Math.max(0, Math.min(1, a)).toFixed(3); },
    /** Ease the white transition away (after leaving the lot for the road). */
    fadeWhiteOut() { if (+white.style.opacity > 0) { white.style.transition = "opacity .5s ease-out"; void white.offsetWidth; white.style.opacity = 0; } },
    reset() { for (const k of Object.keys(last)) delete last[k]; PH.big(""); PH.skip(""); PH.holdBar(0); PH.vignette(0); PH.flash(0); PH.intro("", "", 0); PH.tint("transparent", 0); },
};
