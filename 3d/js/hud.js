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

// ── notifications: toasts + banners ────────────────────────────────────
// A tiny manager so pop-ups never pile up:
//  • toasts: bursts MERGE — the same toast again restarts it (×2, ×3…), and a toast
//    whose only number is signed (+5 💰, −10 coins, ❤️ +100) adds up ("+15 💰");
//    at most TOAST_MAX on screen, the rest wait a moment (dropped when stale).
//  • banners: ONE at a time from a priority queue — opts.prio (1 normal, 2 important:
//    wrecked / busted, 3 urgent) preempts lower ones; an equal one takes over once the
//    current has had MIN_SHOW seconds; the same opts.key replaces in place (3-2-1-GO);
//    queued banners that waited too long are dropped.
//  • nothing new pops up while a dialogue line or a menu screen is open: pop-ups wait
//    (the current banner is held out of sight) and come back if still fresh.
// Timing runs on GAME time (notifyTick from the main loop), so it pauses / skips with the game.
const TOAST_MAX = 3, TOAST_LIFE = 1.9, TOAST_STALE = 2.6, MIN_SHOW = 0.8;
const NT = { toasts: [], waiting: [], cur: null, bq: [], gate: () => false };
/** Who else blocks pop-ups besides our own menu screens (core: the dialogue box). */
export function setPopupGate(fn) { NT.gate = fn; }
export function popupsBlocked() { return !!menu || !!NT.gate(); }

const NUMS = /\d[\d,]*(?:\.\d+)?/g;
const toastKey = (text, cls) => cls + "|" + text.replace(NUMS, "#");
/** The single, signed number in a toast ("+5 💰" → {sign: "+", n: 5, …}), else null. */
function signedNum(text) {
    if ((text.match(NUMS) || []).length !== 1) return null;
    const m = /([+\-−])\s?(\d[\d,]*)(?![\d.])/.exec(text);
    return m ? { sign: m[1], n: parseInt(m[2].replace(/,/g, ""), 10), at: m.index, len: m[0].length } : null;
}
function mergeText(oldT, newT) {
    const a = signedNum(oldT), b = signedNum(newT);
    if (!a || !b || (a.sign === "+") !== (b.sign === "+")) return null;
    return newT.slice(0, b.at) + b.sign + (a.n + b.n).toLocaleString() + newT.slice(b.at + b.len);
}
function paintToast(t) {
    t.el.className = "toast " + t.cls;
    t.el.textContent = t.text;
    if (t.n > 1 && !t.summed) { const c = document.createElement("span"); c.className = "ct"; c.textContent = "×" + t.n; t.el.appendChild(c); }
}

/** A small toast on the right edge. opts: { key (merge id), merge: false (never merge) }. */
export function toast(text, cls = "", opts = {}) {
    text = String(text);
    cls = cls || "";
    const key = opts.key || toastKey(text, cls);
    if (opts.merge !== false) {
        const live = NT.toasts.find(t => t.key === key && !t.out);
        if (live) {
            const sum = mergeText(live.text, text);
            live.summed = live.summed || !!sum;
            live.text = sum || text;
            live.n++;
            live.t = 0;
            paintToast(live);
            live.el.style.animation = "none"; void live.el.offsetWidth; live.el.style.animation = "";
            live.el.classList.add("bump");
            return;
        }
        const w = NT.waiting.find(t => t.key === key);
        if (w) { const sum = mergeText(w.text, text); w.summed = w.summed || !!sum; w.text = sum || text; w.age = 0; w.n++; return; }
    }
    NT.waiting.push({ text, cls, key, n: 1, age: 0, summed: false });
    pumpToasts();
}
function pumpToasts() {
    if (popupsBlocked()) return;
    while (NT.waiting.length && NT.toasts.filter(t => !t.out).length < TOAST_MAX) {
        const w = NT.waiting.shift();
        if (w.age > TOAST_STALE && !/\bbig\b/.test(w.cls)) continue;      // stale: the moment has passed
        const t = { el: document.createElement("div"), key: w.key, text: w.text, cls: w.cls, n: w.n, summed: w.summed, t: 0, out: false };
        paintToast(t);
        el.toasts.appendChild(t.el);
        NT.toasts.push(t);
    }
}

/** A banner: compact under the trip bar while driving / walking, centre stage elsewhere.
 *  ms ≤ 0 → stays until hideBanner(). opts: { prio: 1 | 2 | 3, key }. */
export function banner(html, ms = 2200, opts = {}) {
    const b = { html, ms, prio: opts.prio || 1, key: opts.key || "", age: 0, t: 0 };
    if (NT.cur && b.key && NT.cur.key === b.key && !popupsBlocked()) { showBanner(b); return; }
    const qi = b.key ? NT.bq.findIndex(x => x.key === b.key) : -1;
    if (qi >= 0) NT.bq.splice(qi, 1);
    NT.bq.push(b);
    NT.bq.sort((x, y) => y.prio - x.prio);       // stable sort: FIFO within a priority
    if (NT.bq.length > 4) NT.bq.length = 4;
    pumpBanners();
}
function placeBanner() {
    // While driving / walking it tucks under the trip bar (top of the "center" slot) so it
    // never covers the road; elsewhere (countdown, wrecked, interiors…) it stays centre stage.
    const compact = document.body.classList.contains("in-play");
    const home = compact ? hudSlot("center") : el.hud;
    if (el.banner.parentNode !== home) { if (compact) home.prepend(el.banner); else home.insertBefore(el.banner, el.padHint); }
    el.banner.classList.toggle("compact", compact);
}
function showBanner(b) {
    b.t = 0;
    NT.cur = b;
    placeBanner();
    el.banner.innerHTML = b.html;
    el.banner.classList.remove("hidden", "held");
    el.banner.style.animation = "none"; void el.banner.offsetWidth; el.banner.style.animation = "";
}
function pumpBanners() {
    const blocked = popupsBlocked();
    el.banner.classList.toggle("held", blocked && !!NT.cur);
    if (blocked) return;
    while (NT.bq.length) {
        const nx = NT.bq[0];
        if (nx.age > (nx.prio >= 2 ? 6 : 3)) { NT.bq.shift(); continue; }        // stale
        const cur = NT.cur;
        if (!cur || nx.prio > cur.prio || (nx.prio === cur.prio && cur.t >= MIN_SHOW)) { NT.bq.shift(); showBanner(nx); }
        break;
    }
}
export function hideBanner() {
    NT.cur = null;
    el.banner.classList.add("hidden");
    pumpBanners();
}
/** A fresh start (new run): forget queued banners / waiting toasts and the current banner. */
export function clearNotices() {
    NT.bq.length = 0;
    NT.waiting.length = 0;
    NT.cur = null;
    el.banner.classList.add("hidden");
}
/** What's on screen / waiting (tests, features). */
export function notifyState() {
    return {
        toasts: NT.toasts.filter(t => !t.out).map(t => ({ text: t.text, n: t.n, cls: t.cls })), waiting: NT.waiting.map(w => w.text),
        banner: NT.cur ? { text: el.banner.textContent, prio: NT.cur.prio, key: NT.cur.key, held: el.banner.classList.contains("held") } : null,
        queued: NT.bq.map(b => ({ html: b.html, prio: b.prio, key: b.key })),
    };
}

/** Every game step (app.js): ages toasts and banners and lets queued ones through. */
export function notifyTick(dt) {
    for (const t of NT.toasts) {
        t.t += dt;
        if (!t.out && t.t >= TOAST_LIFE) { t.out = true; t.el.classList.add("out"); }
    }
    for (let i = NT.toasts.length - 1; i >= 0; i--) {
        const t = NT.toasts[i];
        if (t.out && t.t >= TOAST_LIFE + 0.35) { t.el.remove(); NT.toasts.splice(i, 1); }
    }
    for (const w of NT.waiting) w.age += dt;
    pumpToasts();
    const cur = NT.cur;
    if (cur) {
        cur.t += dt;
        if (cur.ms > 0 && cur.t >= cur.ms / 1000) { NT.cur = null; el.banner.classList.add("hidden"); }
        // driving started / stopped under a banner (GO!) → move it to the right place
        else if (el.banner.classList.contains("compact") !== document.body.classList.contains("in-play")) placeBanner();
    }
    for (const b of NT.bq) b.age += dt;
    pumpBanners();
}

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
 *   opts.cls: extra class on the card · opts.onPause: a pad's Start / OPTIONS pressed (else it acts as ✕; keyboard Esc / P stay ○ back)
 * Any other <button>/.nav inside `html` is focusable too; give it a click handler
 * (or use onClick in the returned card: card.querySelector(...)).
 * Returns the card element.
 */
export function showScreen(html, buttons = [], { onBack = null, focus = 0, onTab = null, wide = false, cls = "", onPause = null } = {}) {
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
    menu = { onBack, onTab, onPause, focusEl: null };
    el.screen.classList.remove("hidden");
    el.screenCard.style.animation = "none"; void el.screenCard.offsetWidth; el.screenCard.style.animation = "";
    const list = focusables();
    const f = typeof focus === "string" ? findIn(focus, list) : list[Math.min(focus, list.length - 1)];
    setFocusEl(f || list[0], false);
    pumpBanners();                                     // hold the banner out of sight while the card is up
    return el.screenCard;
}
/** The focusable element with this id INSIDE the card (ids may repeat elsewhere in the page). */
function findIn(id, list) {
    let e = null;
    try { e = el.screenCard.querySelector("#" + CSS.escape(id)); } catch (err) { e = null; }
    return e && list.includes(e) ? e : null;
}

export function hideScreen() {
    el.screen.classList.add("hidden");
    menu = null;
    pumpToasts();
    pumpBanners();
}

/** Move the menu cursor to an element (or the id of one) on the open card. */
export function setFocus(target) {
    if (!menu) return false;
    const list = focusables();
    const b = typeof target === "string" ? findIn(target, list) : target;
    if (!b || !list.includes(b)) return false;
    refreshFocus(true);
    setFocusEl(b, false);
    return true;
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
    if (P.pause && !P.back && menu.onPause) { sfxMove(); menu.onPause(); }
    else if (P.up) move(0, -1);
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
