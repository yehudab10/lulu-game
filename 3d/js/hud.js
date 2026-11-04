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
// One screen at a time (title, pause, shop, scrapbook…). Navigation is SPATIAL:
// every visible <button> / .nav element inside the card is focusable, and the
// D-pad / stick / arrow keys move to the nearest one in that direction — so a
// grid of shop cards is just as controller-friendly as a vertical list.
let menu = null;

/**
 * showScreen(html, buttons, opts)
 *   buttons: [{label, cls, action, id}] — appended as a vertical menu under html
 *   opts.onBack: B / Esc handler · opts.focus: initial focus index (or element id)
 *   opts.onTab(dir): LB/RB (Q/R) pressed — for tabbed screens · opts.wide: wider card
 *   opts.cls: extra class on the card
 * Any other <button>/.nav inside `html` is focusable too; give it a click handler
 * (or use onClick in the returned card: card.querySelector(...)).
 * Returns the card element.
 */
export function showScreen(html, buttons = [], { onBack = null, focus = 0, onTab = null, wide = false, cls = "" } = {}) {
    el.screenCard.className = "card" + (wide ? " wide" : "") + (cls ? " " + cls : "");
    el.screenCard.innerHTML = html + (buttons.length ? '<div class="menu"></div>' : "");
    const box = el.screenCard.querySelector(".menu");
    buttons.forEach(b => {
        const e = document.createElement("button");
        e.className = "btn " + (b.cls || "");
        e.innerHTML = b.label;
        if (b.id) e.id = b.id;
        e.addEventListener("click", () => { sfxSelect(); b.action(e); });
        box.appendChild(e);
    });
    menu = { onBack, onTab, focusEl: null };
    el.screen.classList.remove("hidden");
    el.screenCard.style.animation = "none"; void el.screenCard.offsetWidth; el.screenCard.style.animation = "";
    const list = focusables();
    const f = typeof focus === "string" ? document.getElementById(focus) : list[Math.min(focus, list.length - 1)];
    setFocusEl(f || list[0], false);
    return el.screenCard;
}

export function hideScreen() {
    el.screen.classList.add("hidden");
    menu = null;
}

export function screenOpen() { return !!menu; }
export function currentFocus() {
    if (!menu || !menu.focusEl) return 0;
    return Math.max(0, focusables().indexOf(menu.focusEl));
}
export function screenCard() { return el.screenCard; }

function focusables() {
    return [...el.screenCard.querySelectorAll("button, .nav")].filter(b => !b.disabled && b.offsetParent !== null && !b.classList.contains("nonav"));
}

function setFocusEl(b, sound = true) {
    if (!menu) return;
    if (menu.focusEl) menu.focusEl.classList.remove("focus");
    menu.focusEl = b || null;
    if (b) {
        b.classList.add("focus");
        b.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    if (sound) sfxMove();
}

/** Re-attach hover → focus for elements added after showScreen (e.g. a tab re-render). */
export function refreshFocus(keep = true) {
    if (!menu) return;
    const list = focusables();
    for (const b of list) {
        if (!b.dataset.hov) { b.dataset.hov = 1; b.addEventListener("pointerenter", () => setFocusEl(b, false)); }
    }
    if (!keep || !menu.focusEl || !list.includes(menu.focusEl)) setFocusEl(list[0], false);
}

function move(dx, dy) {
    const list = focusables();
    if (!list.length) return;
    const cur = menu.focusEl && list.includes(menu.focusEl) ? menu.focusEl : null;
    if (!cur) { setFocusEl(list[0]); return; }
    const r0 = cur.getBoundingClientRect();
    const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bestScore = Infinity;
    for (const b of list) {
        if (b === cur) continue;
        const r = b.getBoundingClientRect();
        const x = r.left + r.width / 2 - cx, y = r.top + r.height / 2 - cy;
        const along = x * dx + y * dy;               // distance in the pressed direction
        if (along <= 4) continue;
        const across = Math.abs(x * dy - y * dx);    // sideways offset
        const score = along + across * 2.2;
        if (score < bestScore) { bestScore = score; best = b; }
    }
    if (!best) {
        // wrap vertically through the list so long menus loop
        const i = list.indexOf(cur);
        if (dy) best = list[(i + (dy > 0 ? 1 : -1) + list.length) % list.length];
    }
    if (best) setFocusEl(best);
}

/** Feed edge-triggered input to the open menu. Returns true if a menu is open. */
export function menuInput(P) {
    if (!menu) return false;
    refreshFocus(true);
    if (P.up) move(0, -1);
    else if (P.down) move(0, 1);
    else if (P.navLeft) move(-1, 0);
    else if (P.navRight) move(1, 0);
    else if (P.confirm || P.start) {
        const b = menu.focusEl;
        if (b) b.click();
    } else if (P.back && menu.onBack) { sfxMove(); menu.onBack(); }
    else if ((P.tabPrev || P.tabNext) && menu.onTab) { sfxMove(); menu.onTab(P.tabNext ? 1 : -1); }
    return true;
}

/** Update a button label in place (e.g. "Music: ON"). */
export function relabel(id, html) {
    const b = document.getElementById(id);
    if (b) b.innerHTML = html;
}

// ── feature HUD slots ──────────────────────────────────────────────────
// Features put their own HUD bits (wanted stars, missile count, chapter task,
// phone call…) into one of these stacks instead of positioning things ad hoc:
//   "left"   – under the hearts / coins / score pills
//   "center" – under the trip bar
//   "right"  – under the pause button
//   "bottom" – above the bottom edge, centred (prompts like "✋ Talk")
export function hudSlot(name) {
    let s = document.getElementById("slot-" + name);
    if (!s) {
        s = document.createElement("div");
        s.id = "slot-" + name;
        s.className = "hud-slot " + name;
        el.hud.appendChild(s);
    }
    return s;
}

/** A small prompt above the bottom edge: "✋ ✕ Talk to Heshy". Pass "" to clear. */
let lastPrompt = null;
export function prompt(html) {
    if (html === lastPrompt) return;
    lastPrompt = html;
    const s = hudSlot("bottom");
    s.innerHTML = html ? `<div class="prompt">${html}</div>` : "";
}
