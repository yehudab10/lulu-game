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
// (one formatter, made once: Number#toLocaleString builds a new one on every call — ~0.3 ms a frame while the score ticks)
const scoreFmt = (() => { try { return new Intl.NumberFormat(); } catch (e) { return null; } })();
export function setScore(n) { n = Math.floor(n); if (n !== lastScore) { lastScore = n; el.score.textContent = scoreFmt ? scoreFmt.format(n) : n.toLocaleString(); } }
export function setSpeed(mph) { mph = Math.round(mph); if (mph !== lastMph) { lastMph = mph; el.mph.textContent = mph; } }
let lastBoostW = "", lastBoostFull = null, lastTripF = -1;
export function setBoost(frac, key) {
    const w = (Math.max(0, Math.min(1, frac)) * 100).toFixed(1) + "%", full = frac >= 0.999;
    if (w !== lastBoostW) { lastBoostW = w; el.boostFill.style.width = w; }     // (only real changes touch the DOM)
    if (full !== lastBoostFull) { lastBoostFull = full; el.boostFill.classList.toggle("full", full); }
    if (key !== undefined && el.boostKey.dataset.k !== key) { el.boostKey.dataset.k = key; el.boostKey.innerHTML = key; }
}
export function setTrip(frac, label) {
    const f = Math.round(Math.max(0, Math.min(1, frac)) * 1000) / 10;
    if (f !== lastTripF) { lastTripF = f; el.tripFill.style.width = f + "%"; el.tripCar.style.left = f + "%"; }
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
//  • THE BUDGET (ci/calm — the owner: "lesser pop ups, especially in party mode"): every toast has a
//    priority — 3 must-see (opts.prio 3, a "big" toast, money SPENT), 2 normal (red: something went wrong,
//    money earned), 1 flavour (everything else: close calls, NITRO, a quip, a greeting, gossip…). A feature
//    can say so with opts.prio. On a phone-sized screen only ONE toast shows at a time (two elsewhere). A
//    flavour toast is DROPPED, never queued, when another toast is up or waiting, when she's busy (a chase,
//    a scene, a dialogue) or when the last flavour toast was too recent — and much more so while it's
//    "quiet" (with friends, or strangers around): see setCalmGate. The same toast again still merges (×3).
// Timing runs on GAME time (notifyTick from the main loop), so it pauses / skips with the game.
const TOAST_LIFE = 1.9, TOAST_LIFE_LO = 1.4, TOAST_STALE = 2.6, MIN_SHOW = 0.8;
const GAP = { normal: 7, quiet: 15 };              // seconds between two flavour toasts
const NT = { toasts: [], waiting: [], cur: null, bq: [], gate: () => false, calm: () => null, loT: -99, now: 0, dropped: 0, shown: 0 };
/** The calm gate: () → { quiet (with friends / strangers around), busy (a chase, a scene…), acted (she pressed a button ≤ 1 s
 *  ago: a toast now is the answer to it, so it isn't flavour), call (a phone call's card is up: flavour toasts drop, and on a
 *  phone flavour banners wait — the call is the one thing on screen), line (Lulu said a line ≤ 1.2 s ago: her line is the
 *  moment's pop-up, a flavour toast drops) } — features/calm sets it. */
export function setCalmGate(fn) { NT.calm = fn; }
const compact = () => document.body.classList.contains("touch") || Math.min(innerWidth, innerHeight) < 520;
const toastMax = () => compact() ? 1 : 2;
const SPENT = /[−\-]\s?\$?\d[\d,]*\s*(💰|🪙|coins?\b)|💸|\bfine\b|\bbill\b/i;
const EARNED = /\+\s?\$?\d[\d,]*\s*(💰|🪙|coins?\b)/i;
/** Speech bubbles over other people's heads (townsfolk, hitchhikers, other drivers): flavour too. A bubble may show if
 *  she isn't in a chase, at most one at a time on a phone (two elsewhere, one when it's quiet), not too close to the last
 *  one — unless it answers something she just did. → true: show it (callers hide the bubble otherwise: nothing breaks). */
const BUB = { until: [], t: -99, shown: 0, dropped: 0 };
export function bubbleOk(dur = 2.4) {
    const c = NT.calm() || {};
    BUB.until = BUB.until.filter(u => u > NT.now);
    if (!c.acted) {
        const max = c.quiet ? 1 : compact() ? 1 : 2;
        if (c.chase || BUB.until.length >= max || NT.now - BUB.t < (c.quiet ? 10 : 5)) { BUB.dropped++; return false; }
    }
    BUB.t = NT.now; BUB.until.push(NT.now + Math.min(4, dur)); BUB.shown++;
    return true;
}
export const bubbleStats = () => ({ shown: BUB.shown, dropped: BUB.dropped });
/** A toast's priority (see THE BUDGET above). */
function prioOf(text, cls, opts) {
    if (opts.prio) return opts.prio;
    if (/\bbig\b/.test(cls) || SPENT.test(text)) return 3;
    if (/\bred\b/.test(cls) || EARNED.test(text)) return 2;
    return 1;
}
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

/** A small toast on the right edge. opts: { key (merge id), merge: false (never merge), prio: 1 flavour | 2 | 3 must-see }. */
export function toast(text, cls = "", opts = {}) {
    text = String(text);
    cls = cls || "";
    const key = opts.key || toastKey(text, cls);
    let prio = prioOf(text, cls, opts);
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
    const c = prio === 1 ? NT.calm() || {} : null;
    if (prio === 1 && c.acted) prio = 2;                  // the answer to a button she just pressed (🎥 camera, "not here") — always shows
    if (prio === 1) {
        // flavour: now or never — and not too often (much less with friends / strangers around)
        const up = NT.toasts.some(t => !t.out) || NT.waiting.length > 0;
        if (c.busy || c.call || c.line || up || popupsBlocked() || NT.now - NT.loT < (c.quiet ? GAP.quiet : GAP.normal)) { NT.dropped++; return; }
        NT.loT = NT.now;
    }
    NT.waiting.push({ text, cls, key, n: 1, age: 0, summed: false, prio });
    pumpToasts();
}
/** Take a toast down early (its words stopped being true — e.g. the cops' "you're not hidden" once she IS hidden). */
export function dropToast(key) {
    for (let i = NT.waiting.length - 1; i >= 0; i--) if (NT.waiting[i].key === key) NT.waiting.splice(i, 1);
    for (const t of NT.toasts) if (t.key === key && !t.out) t.t = Math.max(t.t, t.life || TOAST_LIFE);
}
function pumpToasts() {
    if (popupsBlocked()) return;
    const max = toastMax();
    while (NT.waiting.length && NT.toasts.filter(t => !t.out).length < max) {
        NT.waiting.sort((a, b) => b.prio - a.prio);
        const w = NT.waiting.shift();
        if (w.age > TOAST_STALE && w.prio < 3) continue;      // stale: the moment has passed
        const lo = w.prio === 1;
        const t = { el: document.createElement("div"), key: w.key, text: w.text, cls: w.cls + (lo ? " lo" : ""), n: w.n, summed: w.summed, t: 0, out: false, life: lo ? TOAST_LIFE_LO : TOAST_LIFE, prio: w.prio };
        NT.shown++;
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
    if (el.banner.classList.contains("compact")) fitHud();      // (ducks under the chips from its first frame)
}
function pumpBanners() {
    const blocked = popupsBlocked();
    el.banner.classList.toggle("held", blocked && !!NT.cur);
    if (blocked) return;
    while (NT.bq.length) {
        const nx = NT.bq[0];
        if (nx.age > (nx.prio >= 2 ? 6 : 3)) { NT.bq.shift(); continue; }        // stale
        if (nx.prio === 1 && compact() && (NT.calm() || {}).call) break;      // a phone call is up: flavour waits (or goes stale)
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
        toasts: NT.toasts.filter(t => !t.out).map(t => ({ text: t.text, n: t.n, cls: t.cls, prio: t.prio })), waiting: NT.waiting.map(w => w.text),
        dropped: NT.dropped, shown: NT.shown,
        banner: NT.cur ? { text: el.banner.textContent, prio: NT.cur.prio, key: NT.cur.key, held: el.banner.classList.contains("held") } : null,
        queued: NT.bq.map(b => ({ html: b.html, prio: b.prio, key: b.key })),
    };
}

/** Every game step (app.js): ages toasts and banners and lets queued ones through. */
export function notifyTick(dt) {
    NT.now += dt;
    for (const t of NT.toasts) {
        t.t += dt;
        if (!t.out && t.t >= (t.life || TOAST_LIFE)) { t.out = true; t.el.classList.add("out"); }
    }
    for (let i = NT.toasts.length - 1; i >= 0; i--) {
        const t = NT.toasts[i];
        if (t.out && t.t >= (t.life || TOAST_LIFE) + 0.35) { t.el.remove(); NT.toasts.splice(i, 1); }
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
    if ((FIT.t -= dt) <= 0) { FIT.t = 0.2; fitHud(); }
}

// ── keep clear (ci/hudfit) ───────────────────────────────────────────────
// A few HUD pieces have no fixed room: what sits around them depends on the screen and on what else is up (the
// pills wrap, 📝 Ima's list grows a line, a phone text arrives). ~5× a second each is nudged — only as far as it
// must — off the pieces it would sit on: the feature stacks under the pills, the "center" stack (the WELCOME
// banner, task chips) under the trip bar + the left / right chips, the ✋ prompt and the controller's hint up
// off the speedo / the touch buttons / each other. The nudge is the CSS `translate` property (`data-fit-dy`), so it
// never fights a piece's own transform / animation. ⏭ SKIP does the same (core/skip.js).
const FIT = { t: 0 };
const shownEl = e => { if (!e.offsetParent && getComputedStyle(e).position !== "fixed") return false;
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || e.classList.contains("hidden")) return false;
    const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2; };
/** Nudge `e` down (dir 1) / up (dir -1) just far enough to clear every shown piece matching `avoid`. */
export function keepClear(e, avoid, dir = 1, gap = 6) {
    if (!e) return 0;
    const cur = +e.dataset.fitDy || 0;
    let r = e.getBoundingClientRect();
    if (e.classList.contains("hud-slot")) {          // a stack: what's IN it (it may be wider than its pieces)
        let u = null;
        for (const c of e.children) { if (!shownEl(c)) continue; const q = c.getBoundingClientRect();
            u = u ? { left: Math.min(u.left, q.left), right: Math.max(u.right, q.right), top: Math.min(u.top, q.top), bottom: Math.max(u.bottom, q.bottom) } : q; }
        r = u ? { left: u.left, right: u.right, top: u.top, bottom: u.bottom, width: u.right - u.left, height: u.bottom - u.top } : { width: 0, height: 0 };
    }
    let dy = 0;
    if (r.width > 2 && r.height > 2 && !el.hud.classList.contains("hidden")) {
        const top = r.top - cur, bot = r.bottom - cur, obs = [];
        for (const sel of avoid) for (const o of document.querySelectorAll(sel)) if (!e.contains(o) && !o.contains(e) && shownEl(o)) obs.push(o.getBoundingClientRect());
        for (let k = 0; k < 8; k++) {
            let moved = false;
            for (const o of obs) {
                if (Math.min(r.right, o.right) - Math.max(r.left, o.left) <= 2) continue;
                if (Math.min(bot + dy, o.bottom + gap) - Math.max(top + dy, o.top - gap) <= 0) continue;
                const n = dir > 0 ? o.bottom + gap - top : o.top - gap - bot;
                if (dir > 0 ? n > dy : n < dy) { dy = n; moved = true; }
            }
            if (!moved) break;
        }
        dy = Math.max(-top, Math.min(innerHeight - bot, dy));      // never off the screen
    }
    dy = Math.round(dy);
    if (dy !== cur) { e.dataset.fitDy = dy; e.style.translate = dy ? `0 ${dy}px` : ""; }
    return dy;
}
const TOPS = ["#hud .hud-tl .pill", "#hud .hud-top", "#pauseBtn", "#phoneBtn", "#objLine.phone:not(.empty)"];
// (a piece marked data-fit="self" keeps clear of the centre stack on its own on a wide screen — hustle's 📻 ticker
// steps down the right column — so there the centre doesn't also duck under it: two pieces each dodging the other
// would chase each other down the screen. On a screen held upright the centre stack carries on under BOTH columns
// and such pieces stay put — PORTRAIT, the same test they make.)
const SIDES = ["#slot-left > *", "#slot-right > *"];
const SIDES_WIDE = ["#slot-left > *:not([data-fit=self])", "#slot-right > *:not([data-fit=self])"];
export const PORTRAIT = matchMedia("(max-aspect-ratio: 1/1)");
const BOTTOM = ["#hud .hud-br .speedo", "#touch .tbtn", "#stickBase", "#touchExtra > *"];
// ── THE PLAY HUD'S LAYOUT CONTRACT (ci/hud, 2026-11-26) ─────────────────────────────────────────────────────────
// The owner's friend's Android, upright, on the highway: a 2× coins pill + Ima's list + a chase + a robbery to foil + a
// timed delivery + their meters, each a full-size chip of its own — the road and Lulu's car under them. So:
//   • a TOP BAND (hearts, coins, the 📱 phone) and a BOTTOM BAND (the touch controls), as before;
//   • ONE OBJECTIVE LINE right under the top band: what matters most right now, by a fixed priority (OBJ: a chase >
//     a timed job > a mission / a robbery to foil > an errand > Ima's list > a bonus > info). Everything else that's on
//     folds into a small icon BADGE on that same line (a tap shows it for a few seconds; the 📱 has the detail).
//     Its meters live inside its line. On a phone that is the only full chip (a tablet 2, a big screen / TV 3, one
//     compact line each, at the top of the centre stack);
//   • on a phone the trip bar IS the line's quiet default: it shows only while nothing else is the objective;
//   • a CLEAR WINDOW around the car and the road ahead (clearWindow(), screen fractions) where no persistent HUD sits;
//   • no piece on another or on a touch button, no text cut off with "…" (a long line shrinks a little, then wraps).
// A feature keeps building its own chip and registers it ONCE, after putting it in its slot:
//   H.objective(el, { prio: H.OBJ.timed, icon: "🥔", badge: ".tm" })      (badge: a selector / fn → a short text;
//                                                                          false = no badge when folded)
// Test: scripts/tests3d/hudworst.js (every chip at once, 12 screen sizes) + hudfit.js; calm counts the full chips.
export const OBJ = { chase: 50, timed: 40, mission: 30, errand: 20, list: 10, bonus: 5, info: 2 };
const OB = { list: [], seq: 0, line: null, main: null, badges: null, pin: null, pinT: 0, phone: false, full: 0, dirty: false, tripP: 0, tripWins: false };
/** How much the trip bar matters now (app.js, from ctx.trip.prio): 0 on the open road (just where the next exit is), 9 a town's
 *  street name, a story leg / the Shabbos countdown more. On a phone it's shown when nothing outranks it. */
export function tripPrio(p) { OB.tripP = p || 0; }
/** Phones (either way up): one objective; a tablet two; a big screen / TV three. */
export const phoneHud = () => innerWidth <= 600 || innerHeight <= 520;
const maxFull = () => phoneHud() ? 1 : innerWidth * innerHeight >= 1280 * 700 ? 3 : 2;
/** The clear window around the car and the road ahead, as screen fractions — no persistent HUD in it, ever. */
export function clearWindow() {
    return innerWidth > innerHeight ? { x0: 0.3, x1: 0.7, y0: 0.4, y1: 1 } : { x0: 0.26, x1: 0.74, y0: 0.36, y1: 0.68 };
}
/** Is the screen point (px) inside the clear window? */
export function inClearWindow(x, y) { const c = clearWindow(); return x > c.x0 * innerWidth && x < c.x1 * innerWidth && y > c.y0 * innerHeight && y < c.y1 * innerHeight; }
/** A phone's spot for Lulu's speech bubble (w × h px), OUTSIDE the clear window: the left column, under the top band,
 *  the objective line and the left stack. → { x, y } (top-left), null = no room right now (don't show it), undefined =
 *  not a phone (place it as you like). banter's bubbles ask it. */
export function dockSpot(w, h) {
    if (!phoneHud() || el.hud.classList.contains("hidden")) return undefined;
    const W = innerWidth, Hh = innerHeight, x = Math.max(12, Math.min(W - w - 12, 12)), c = clearWindow();
    let top = 12;
    for (const sel of ["#hud .hud-tl .pill", "#pauseBtn", "#phoneBtn", "#objLine.phone:not(.empty)", "#hud .hud-top", "#slot-left > *", "#slot-right > *", "#slot-center > *:not(#banner)"])
        for (const o of document.querySelectorAll(sel)) { if (!shownEl(o)) continue; const r = o.getBoundingClientRect(); if (r.left < x + w + 6 && r.right > x - 6) top = Math.max(top, r.bottom + 8); }
    let bottom = W > Hh ? Hh : c.y0 * Hh;                       // upright: above the window; on its side: the left column
    for (const sel of ["#stickBase", "#touchExtra > *", "#touch .tbtn"]) for (const o of document.querySelectorAll(sel)) {
        if (!shownEl(o)) continue; const r = o.getBoundingClientRect(); if (r.left < x + w + 6 && r.right > x - 6 && r.top > top) bottom = Math.min(bottom, r.top - 6); }
    if (W > Hh && x + w > c.x0 * W) return null;                 // (too wide for the left column)
    return top + h <= bottom ? { x, y: Math.round(top) } : null;
}
/** Register a chip as an objective (call once, after it's in its slot; a re-created chip registers again). */
export function objective(e, opts = {}) {
    if (!e) return e;
    let o = OB.list.find(x => x.el === e);
    if (!o) { o = { el: e, seq: OB.seq++, badge: null }; OB.list.push(o); }
    o.prio = opts.prio != null ? opts.prio : OBJ.mission;
    o.icon = opts.icon || "";
    o.short = opts.badge !== undefined ? opts.badge : null;
    o.home = opts.home ? hudSlot(opts.home) : e.parentElement && e.parentElement !== OB.main ? e.parentElement : o.home || hudSlot("center");
    e.dataset.obj = opts.id || String(e.className || "chip").split(" ")[0];
    OB.dirty = true;
    // (a chip that turns on / changes between two layout passes is placed at once — never a moment full-size in its slot)
    if (!OB.mo && typeof MutationObserver === "function") OB.mo = new MutationObserver(() => { if (!OB.q) { OB.q = true; queueMicrotask(() => { OB.q = false; if (!el.hud.classList.contains("hidden")) layoutObjectives(); }); } });
    if (OB.mo) OB.mo.observe(e, { childList: true, attributes: true, attributeFilter: ["class", "hidden"] });
    return e;
}
/** What the line shows now: { main: [ids], badges: [ids], phone } (tests, calm). */
export function objectives() {
    const ids = l => l.map(o => o.el.dataset.obj);
    const act = OB.list.filter(o => o.el.isConnected && !o.el.classList.contains("obj-folded") && objActive(o.el));
    return { main: ids(act), badges: ids(OB.list.filter(o => o.el.isConnected && o.el.classList.contains("obj-folded"))), phone: OB.phone, full: OB.full };
}
function objLine() {
    if (OB.line) return OB.line;
    const l = OB.line = document.createElement("div");
    l.id = "objLine";
    l.className = "empty";
    l.innerHTML = `<div class="obj-main"></div><div class="obj-badges"></div>`;
    OB.main = l.firstChild; OB.badges = l.lastChild;
    el.hud.appendChild(l);
    return l;
}
function objActive(e) {
    if (!e.isConnected || e.classList.contains("hidden")) return false;
    for (let n = e; n && n !== el.hud; n = n.parentElement) if (getComputedStyle(n).display === "none") return false;
    return !!e.textContent.trim();
}
const EMOJI = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u;
function badgeHtml(o, words) {
    const ic = o.icon || ((o.el.textContent.match(EMOJI) || [""])[0]) || "•";
    let t = "";
    if (words) try { t = typeof o.short === "function" ? o.short(o.el) : o.short ? (o.el.querySelector(o.short) || {}).textContent || "" : ""; } catch (err) { t = ""; }
    t = String(t || "").replace(/[^\p{L}\p{N}:/×.]/gu, "").slice(0, 6);
    return `${ic}${t ? `<small>${t.replace(/[&<]/g, c => c === "&" ? "&amp;" : "&lt;")}</small>` : ""}`;
}
/** Place the objectives: the top one(s) full, the rest folded to badges; on a phone, the line under the top band. */
function layoutObjectives() {
    const line = objLine();
    OB.list = OB.list.filter(o => o.el.isConnected || o.el.parentElement === OB.main);
    for (const o of OB.list) if (!o.el.isConnected) o.dead = true;
    OB.list = OB.list.filter(o => !o.dead);
    const phone = OB.phone = phoneHud();
    for (const o of OB.list) o.el.classList.remove("obj-folded");
    // (a chip that went quiet goes home first, so its own "hidden" rules are the ones that count)
    for (const o of OB.list) if (o.el.parentElement === OB.main && !objActive(o.el) && o.home && o.home.isConnected) o.home.appendChild(o.el);
    const act = OB.list.filter(o => objActive(o.el)).sort((a, b) => b.prio - a.prio || a.seq - b.seq);
    if (OB.pin && (!act.includes(OB.pin) || NT.now > OB.pinT)) OB.pin = null;
    if (OB.pin) { act.splice(act.indexOf(OB.pin), 1); act.unshift(OB.pin); }
    const tripWins = OB.tripWins = phone && !OB.pin && act.length > 0 && act[0].prio <= OB.tripP;
    const n = tripWins ? 0 : maxFull(), full = act.slice(0, n), folded = act.slice(n);
    OB.full = full.length;
    for (const o of act) {
        const want = full.includes(o) ? OB.main : o.home;
        if (want && want.isConnected && o.el.parentElement !== want) want.appendChild(o.el);
        if (folded.includes(o)) o.el.classList.add("obj-folded");
    }
    // the badges: one small button each, in priority order (a tap shows that chip for a few seconds)
    const keep = new Set();
    for (const o of folded) {
        if (o.short === false) continue;      // (info that's only worth a full line: no badge)
        if (!o.badge) { const b = o.badge = document.createElement("button"); b.className = "obj-badge"; b.type = "button";
            b.addEventListener("pointerdown", ev => { ev.preventDefault(); ev.stopPropagation(); OB.pin = o; OB.pinT = NT.now + 5; OB.dirty = true; layoutObjectives(); }); }
        const h = badgeHtml(o, folded.indexOf(o) < (OB.phone && innerWidth < 500 ? 2 : 4));      // (a number on the first few: the rest just their icon)
        if (o.badge.dataset.h !== h) { o.badge.dataset.h = h; o.badge.innerHTML = h; }
        OB.badges.appendChild(o.badge);
        keep.add(o.badge);
    }
    for (const b of [...OB.badges.children]) if (!keep.has(b)) b.remove();
    for (const o of OB.list) if (o.badge && !keep.has(o.badge)) o.badge = null;
    // where the line lives: on a phone its own spot under the top band; elsewhere the top of the centre stack
    const home = phone ? el.hud : hudSlot("center");
    if (line.parentElement !== home) { if (phone) home.appendChild(line); else home.prepend(line); }
    line.classList.toggle("phone", phone);
    line.classList.toggle("empty", !full.length && !keep.size);
    line.classList.toggle("only-badges", !full.length);
    // (the line's chips in priority order)
    full.forEach((o, i) => { if (OB.main.children[i] !== o.el) OB.main.insertBefore(o.el, OB.main.children[i] || null); });
    // on a phone the trip bar is the line's quiet default
    const trip = document.querySelector("#hud .hud-top");
    if (trip) trip.classList.toggle("obj-folded", phone && full.length > 0);
    line.classList.toggle("under-trip", tripWins);
    if (phone) placeLine(line, trip);
    if (OB.mo) OB.mo.takeRecords();       // (its own class changes are not news)
    else { line.style.top = line.style.left = line.style.right = ""; if (trip) trip.style.top = ""; }
    fitMain();
    if (OB.mo) OB.mo.takeRecords();
    OB.dirty = false;
}
/** The phone's line: under the top band upright; between the pills and the 📱 on its side. The trip bar shares the spot. */
function placeLine(line, trip) {
    const W = innerWidth, H = innerHeight, rs = [];
    for (const sel of ["#hud .hud-tl .pill", "#pauseBtn", "#phoneBtn"]) for (const o of document.querySelectorAll(sel)) if (shownEl(o)) rs.push(o.getBoundingClientRect());
    const pills = rs.filter((r, i) => i < rs.length), corner = rs.filter(r => r.left > W * 0.6);
    let top, left, right;
    if (W > H) {
        const pr = Math.max(12, ...pills.filter(r => r.left < W * 0.5).map(r => r.right)), cl = Math.min(W - 12, ...corner.map(r => r.left));
        top = Math.max(12, ...rs.map(r => r.top)); top = Math.min(...rs.map(r => r.top).concat(top));
        left = pr + 10; right = W - cl + 10;
    } else {
        top = Math.max(0, ...rs.map(r => r.bottom)) + 8;
        left = 12; right = 12;
    }
    line.style.top = Math.round(top) + "px"; line.style.left = Math.round(left) + "px"; line.style.right = Math.round(right) + "px";
    if (trip) trip.style.top = W > H ? "" : Math.round(top) + "px";
    // (the trip bar outranks everything that's on — the Shabbos countdown, a story leg: the badges go right under it)
    if (OB.tripWins && trip && shownEl(trip)) { const r = trip.getBoundingClientRect(); line.style.top = Math.round(r.bottom + 6) + "px"; }
}
/** A long objective shrinks a little (to 78 %), then wraps — never cut off with "…". */
function fitMain() {
    const m = OB.main;
    for (const c of m.children) {
        const over = () => { if (c.scrollWidth > m.clientWidth + 1) return true;
            for (const d of c.querySelectorAll("*")) if (d.clientWidth && d.scrollWidth > d.clientWidth + 1 && getComputedStyle(d).overflow !== "visible") return true; return false; };
        c.classList.remove("obj-wrap");
        let ok = false;
        for (const z of [1, 0.92, 0.85, 0.78]) { c.style.zoom = z === 1 ? "" : z; if (!over()) { ok = true; break; } }
        if (!ok) c.classList.add("obj-wrap");
    }
    for (const o of OB.list) if (o.el.parentElement !== m && o.el.style.zoom) { o.el.style.zoom = ""; o.el.classList.remove("obj-wrap"); }
}

/** One keep-clear pass over the HUD (every 0.2 s of game time, and when a banner / prompt shows). */
export function fitHud() {
    if (el.hud.classList.contains("hidden")) return;
    layoutObjectives();
    const s = id => document.getElementById("slot-" + id);
    if (OB.phone && innerWidth > innerHeight) keepClear(document.querySelector("#hud .hud-br"), ["#objLine:not(.empty)"]);
    else { const br = document.querySelector("#hud .hud-br"); if (br && br.dataset.fitDy) { br.dataset.fitDy = 0; br.style.translate = ""; } }
    keepClear(s("left"), TOPS);
    keepClear(s("right"), TOPS.concat("#slot-left > *"));
    keepClear(s("center"), TOPS.concat(PORTRAIT.matches ? SIDES : SIDES_WIDE, "#hud .hud-br .speedo"));
    keepClear(el.padHint, BOTTOM, -1);
    keepClear(s("bottom"), BOTTOM.concat("#padHint"), -1);
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
    if (html) fitHud();
}
