// DOM HUD + menu screens. Menus work with a controller (D-pad / stick + A),
// the keyboard (arrows + Enter) and mouse / touch.
import { sfxMove, sfxSelect } from "./audio.js";

const $ = id => document.getElementById(id);
const el = {};
for (const id of ["hud", "hearts", "coins", "score", "mph", "boostFill", "boostKey", "tripFill", "tripCar", "tripLabel",
    "toasts", "banner", "padHint", "flash", "screen", "screenCard", "loading", "loadFill", "loadText", "touch"]) el[id] = $(id);

export function showHud(on) { el.hud.classList.toggle("hidden", !on); }
export function showTouch(on) { el.touch.classList.toggle("hidden", !on); document.body.classList.toggle("touch", on); }

let lastHearts = -1;
export function setHearts(n, max) {
    if (n === lastHearts) return;
    if (lastHearts > n) { el.hearts.classList.remove("hurt"); void el.hearts.offsetWidth; el.hearts.classList.add("hurt"); }
    lastHearts = n;
    el.hearts.textContent = "❤️".repeat(Math.max(0, n)) + "🤍".repeat(Math.max(0, max - n));
}
let lastCoins = -1, lastScore = -1, lastMph = -1;
export function setCoins(n) { if (n !== lastCoins) { lastCoins = n; el.coins.textContent = n; } }
export function setScore(n) { n = Math.floor(n); if (n !== lastScore) { lastScore = n; el.score.textContent = n.toLocaleString(); } }
export function setSpeed(mph) { mph = Math.round(mph); if (mph !== lastMph) { lastMph = mph; el.mph.textContent = mph; } }
export function setBoost(frac, key) {
    el.boostFill.style.width = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + "%";
    el.boostFill.classList.toggle("full", frac >= 0.999);
    if (key !== undefined && el.boostKey.dataset.k !== key) { el.boostKey.dataset.k = key; el.boostKey.innerHTML = key; }
}
export function setTrip(frac, label) {
    const f = Math.max(0, Math.min(1, frac)) * 100;
    el.tripFill.style.width = f + "%";
    el.tripCar.style.left = f + "%";
    if (el.tripLabel.textContent !== label) el.tripLabel.textContent = label;
}

export function toast(text, cls = "") {
    const t = document.createElement("div");
    t.className = "toast " + cls;
    t.textContent = text;
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 3) el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 1700);
}

let bannerTimer = 0;
export function banner(html, ms = 2200) {
    el.banner.innerHTML = html;
    el.banner.classList.remove("hidden");
    el.banner.style.animation = "none"; void el.banner.offsetWidth; el.banner.style.animation = "";
    clearTimeout(bannerTimer);
    if (ms > 0) bannerTimer = setTimeout(() => el.banner.classList.add("hidden"), ms);
}
export function hideBanner() { el.banner.classList.add("hidden"); }

let lastHint = null;
export function padHint(html) {
    if (html === lastHint) return;
    lastHint = html;
    if (!html) { el.padHint.classList.add("hidden"); return; }
    el.padHint.innerHTML = html;
    el.padHint.classList.remove("hidden");
}

export function flash() {
    el.flash.style.transition = "none";
    el.flash.style.opacity = "0.35";
    void el.flash.offsetWidth;
    el.flash.style.transition = "opacity 0.5s";
    el.flash.style.opacity = "0";
}

export function setLoading(frac, text) {
    el.loadFill.style.width = (frac * 100).toFixed(0) + "%";
    if (text) el.loadText.textContent = text;
}
export function hideLoading() { el.loading.classList.add("hidden"); }

// ── menus ──────────────────────────────────────────────────────────────
let menu = null;

/**
 * Show a centered card. `buttons`: [{label, cls, action, id}] — navigable with
 * controller / keyboard / mouse. `onBack` runs on B / Esc.
 */
export function showScreen(html, buttons = [], { onBack = null, focus = 0 } = {}) {
    el.screenCard.innerHTML = html + (buttons.length ? '<div class="menu"></div>' : "");
    const box = el.screenCard.querySelector(".menu");
    const btns = buttons.map((b, i) => {
        const e = document.createElement("button");
        e.className = "btn " + (b.cls || "");
        e.innerHTML = b.label;
        if (b.id) e.id = b.id;
        e.addEventListener("click", () => { sfxSelect(); b.action(e); });
        e.addEventListener("pointerenter", () => setFocus(i, false));
        box.appendChild(e);
        return e;
    });
    menu = { buttons: btns, defs: buttons, focus: Math.min(focus, btns.length - 1), onBack };
    setFocus(menu.focus, false);
    el.screen.classList.remove("hidden");
    // restart the pop animation
    el.screenCard.style.animation = "none"; void el.screenCard.offsetWidth; el.screenCard.style.animation = "";
}

export function hideScreen() {
    el.screen.classList.add("hidden");
    menu = null;
}

export function screenOpen() { return !!menu; }
export function currentFocus() { return menu ? menu.focus : 0; }

function setFocus(i, sound = true) {
    if (!menu || !menu.buttons.length) return;
    menu.focus = (i + menu.buttons.length) % menu.buttons.length;
    menu.buttons.forEach((b, k) => b.classList.toggle("focus", k === menu.focus));
    if (sound) sfxMove();
}

/** Feed edge-triggered input to the open menu. Returns true if it consumed it. */
export function menuInput(P) {
    if (!menu) return false;
    if (P.up || P.navLeft) setFocus(menu.focus - 1);
    else if (P.down || P.navRight) setFocus(menu.focus + 1);
    else if (P.confirm || P.start) {
        const b = menu.buttons[menu.focus];
        if (b) b.click();
    } else if (P.back && menu.onBack) { sfxMove(); menu.onBack(); }
    return true;
}

/** Update a button label in place (e.g. "Music: ON"). */
export function relabel(id, html) {
    const b = document.getElementById(id);
    if (b) b.innerHTML = html;
}
