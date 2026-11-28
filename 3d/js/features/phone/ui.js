// features/phone — the 📱 phone itself: the app registry, opening / closing (it PAUSES the
// game, like the pause menu), the home grid, an app's screen, the corner button.
//
// The phone is a `showScreen` card (class "lphone") restyled as a portrait handset that
// slides up from the bottom-right (TV / desktop / phone landscape) or the bottom (phone
// portrait), so spatial controller navigation, ○ back and the pop-up gate come for free.
// Nothing runs per frame while it's closed except one cheap input check (index.js).
import { ctx, emit } from "../../core/ctx.js";
import { input, glyph } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { resume, showPauseMenu } from "../../core/screens.js";
import { current as roomNow } from "../interiors/engine.js";

/** The registered apps, by order. */
export const APPS = [];
/** Phone state (tests read it through ctx.phone._dbg). */
export const PH = { open: false, app: null, arg: null, fromPause: false, focus: null, openMs: 0, toastT: null, widget: null };
/** The home screen's notification cards (inbox.js): () => html with [data-open="<app>"][data-thread] buttons. */
export function setHomeWidget(fn) { PH.widget = fn; }

/** States the phone opens in (free driving / walking — and inside a room: ci/doors made the doors walk-through, so a 📱
 *  that turned into ❚❚ at every doorway was a seam; the coordinator for the owner, 2026-11-27). Elsewhere the corner is ❚❚. */
export const PHONE_STATES = new Set(["playing", "footRun", "interior"]);
/** In a room: the room, when it's one she's just standing / walking in (not loading, leaving, mid-chat or a mini-game). */
export function roomFree() {
    const r = roomNow();
    return !!(r && r.ready && !r.disposed && !r.leaving && !r.busy && !r.lock && !r.active && !r.mode);
}
/** The room she's in → { name } | null (the apps say where she is). */
export function roomHere() {
    if (ctx.state !== "interior") return null;
    const r = roomNow();
    if (!r || !r.def) return null;
    const nm = r.def.name || r.def.short || (r.def.title || "").replace(/^\S+\s/, "");
    return { name: nm || "a room" };
}
export const partyOn = () => !!(ctx.party && ctx.party.active);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export { esc };

/** Register an app (see ARCHITECTURE.md › ctx.phone.addApp). Re-registering an id replaces it. */
export function addApp(def) {
    if (!def || !def.id) return null;
    const app = Object.assign({ order: 50, icon: "📱", name: def.id }, def);
    const i = APPS.findIndex(a => a.id === app.id);
    if (i >= 0) APPS[i] = app; else APPS.push(app);
    APPS.sort((a, b) => (a.order || 0) - (b.order || 0));
    if (PH.open && !PH.app) renderHome();
    return app;
}
const shown = a => { try { return !a.visible || !!a.visible(); } catch (e) { return false; } };
// (an app with home: false is not on the home screen — another app opens it: 📍 Nearby from 👯 Friends, 🎨 from 💼 Jobs)
export const visibleApps = () => APPS.filter(a => a.home !== false && shown(a));
function badgeOf(a) {
    if (!a.badge) return null;
    try { const b = a.badge(); return b === 0 || b == null || b === "" || b === false ? null : b; } catch (e) { return null; }
}

/** Could the phone open right now (from driving / walking, not from the pause menu)? */
export function canOpen() {
    if (PH.open || ctx.paused || !PHONE_STATES.has(ctx.state)) return false;
    const def = ctx.states[ctx.state];
    // (ctx.view: another scene on screen — a room IS one (its own set): fine there, roomFree() below decides)
    if (!def || !def.pausable || ctx.dialogOpen || ctx.skipping || (ctx.view && ctx.state !== "interior") || H.screenOpen()) return false;
    if (ctx.cutscene && ctx.cutscene.active()) return false;
    if (ctx.streets && ctx.streets.jacking) return false;
    if (ctx.state === "interior" && !roomFree()) return false;        // (a chat, a mini-game, the doorway: not now)
    return true;
}
const pauseMenuUp = () => ctx.paused && H.screenOpen() && !!H.screenCard().querySelector(".pause-menu");

// ── open / close ──────────────────────────────────────────────────────────
/** Open the phone (optionally straight into an app: openPhone("messages", { thread })). → bool */
export function openPhone(appId = null, arg = null) {
    if (PH.open) { if (appId) openApp(appId, arg); return true; }
    const fromPause = pauseMenuUp() && PHONE_STATES.has(ctx.state);
    if (!fromPause && !canOpen()) return false;
    const app = appId ? APPS.find(a => a.id === appId && shown(a)) : null;
    if (app && app.open && !app.render) {                 // a hand-off app: no need to show the phone at all
        if (fromPause) resume();
        handOff(app, arg);
        return true;
    }
    const t0 = performance.now();
    if (!ctx.paused) {                                    // the same pause as the pause menu, minus its card
        ctx.paused = true;
        A.sfxHorn(false);
        A.updateEngine(0, 0, 0, 0, false, false);
        A.duckMusic(0.12);
        emit("pause", { paused: true });
    }
    PH.open = true;
    PH.fromPause = fromPause;
    PH.app = null;
    document.body.classList.add("phone-open");
    shell();
    if (app) openApp(app.id, arg); else renderHome();
    if (ctx.phone && ctx.phone.prop && ctx.state === "playing" && !(ctx.foot && ctx.foot.active)) ctx.phone.prop(true, "hold");
    A.sfxSelect();
    PH.openMs = performance.now() - t0;
    emit("phone:open", { app: app ? app.id : null });
    return true;
}

/** Close the phone: back to the game (or to the pause menu it was opened from). */
export function closePhone(how = "close") {
    if (!PH.open) return false;
    PH.open = false;
    PH.app = null;
    document.body.classList.remove("phone-open");
    if (ctx.phone && ctx.phone.prop) ctx.phone.prop(false);
    if (how === "pause") showPauseMenu();                          // OPTIONS / Esc: the full pause menu
    else if (PH.fromPause && how !== "handoff") showPauseMenu();  // ○ from the pause menu's 📱 → back there
    else resume();
    emit("phone:close", { how });
    refreshCorner();
    return true;
}
function handOff(app, arg) {
    if (PH.open) closePhone("handoff");
    try { app.open(arg); } catch (e) { console.error(`[phone] ${app.id}.open`, e); }
}

/** ○ / ‹: an app's own back (a thread → the inbox), then the home grid, then close. */
export function back() {
    if (!PH.open) return;
    const app = PH.app;
    if (app) {
        if (app.back) { let done = false; try { done = app.back(api) === true; } catch (e) { console.error(e); } if (done) return; }
        PH.app = null;
        renderHome(app.id);
        return;
    }
    closePhone();
}

// ── the handset ───────────────────────────────────────────────────────────
function clock() {
    let h, m;
    // (the sky's hour: a Cruise day — and a 🎉 party's shared sky too, which shop doors already follow: storefronts/hours.js
    //  worldNow — ci/sweep-logic2; the 📱 showed the device's time there)
    if (ctx.atmos && ctx.G && (ctx.G.mode === "cruise" || (ctx.atmos.mode === "cruise" && ctx.state !== "title")) && typeof ctx.atmos.clock === "number") {
        const hrs = (7.3 + ctx.atmos.clock * 24) % 24;        // atmos: 0.03 ≈ 8 am, sunset ≈ 7 pm, night ≈ midnight
        h = Math.floor(hrs); m = Math.floor((hrs - h) * 60);
    } else { const d = new Date(); h = d.getHours(); m = d.getMinutes(); }
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")}`;
}
function bars() {
    const w = ctx.law ? ctx.law.wanted || 0 : 0;
    if (w > 0) return `<span class="lp-want">${"★".repeat(Math.min(5, w))}</span>`;
    return `<span class="lp-sig"><i></i><i></i><i></i><i></i></span>`;
}
function battery() {
    const G = ctx.G, n = Math.max(0, G.hearts || 0), max = Math.max(1, G.maxHearts || 3);
    return `<span class="lp-bat" title="hearts"><i style="width:${Math.round(n / max * 100)}%"></i></span>`;
}
function shell() {
    const html = `<div class="lp-frame"><div class="lp-scr">
        <div class="lp-status"><b class="lp-time">${clock()}</b><span class="lp-notch"></span><span class="lp-st">${bars()}${battery()}</span></div>
        <div class="lp-body" id="lpBody"></div>
        <div class="lp-toast" id="lpToast"></div>
        <div class="lp-foot">
            <button class="lp-fb nonav" id="lpBackBtn" aria-label="Back">‹ <span>Back</span>${glyph("back")}</button>
            <span class="lp-hb"></span>
            <button class="lp-fb nonav" id="lpMenuBtn" aria-label="Pause menu">☰ <span>Menu</span>${input.device === "gamepad" ? glyph("pause") : ""}</button>
        </div>
    </div></div>`;
    const card = H.showScreen(html, [], { onBack: back, onPause: () => closePhone("pause"), cls: "lphone" });
    card.querySelector("#lpBackBtn").addEventListener("click", () => { A.sfxMove(); back(); });
    card.querySelector("#lpMenuBtn").addEventListener("click", () => { A.sfxSelect(); closePhone("pause"); });
    return card;
}
const body = () => document.getElementById("lpBody");

/** Re-draw what's on screen (the grid or the current app). */
export function refresh() {
    if (!PH.open) return;
    if (PH.app) renderApp(true); else renderHome();
}

function safe(fn) { try { return fn() || ""; } catch (e) { console.error("[phone] widget", e); return ""; } }
function homeHello() {
    const G = ctx.G;
    const rm = roomHere();
    if (rm) return `🚪 inside ${esc(rm.name)}`;
    if (ctx.foot && ctx.foot.active) return "🚶‍♀️ on foot";
    if (ctx.hustle && ctx.hustle.job) { const d = ctx.hustle.job.def || {}; return `💼 on the clock · ${d.emoji || ""} ${esc(d.name || "")}`; }
    if (G.mode === "story" && ctx.trip && ctx.trip.label && ctx.trip.label()) return `📖 ${esc(ctx.trip.label())}`;
    if (G.mode === "cruise") return `🛣️ cruising · ${Math.max(0, (ctx.car.s - (G.startS || 0)) / 1609).toFixed(1)} mi`;
    return "";
}
export function renderHome(focusId = null) {
    const el = body();
    if (!el) return;
    const apps = visibleApps();
    el.innerHTML = `<div class="lp-home">
        <div class="lp-big">${clock()}</div><div class="lp-hello">${homeHello()}</div>
        <div class="lp-notes">${PH.widget ? safe(PH.widget) : ""}</div>
        <div class="lp-grid" data-n="${apps.length}">${apps.map(a => {
            const b = badgeOf(a);
            return `<button class="lp-app" id="lpa_${esc(a.id)}" data-app="${esc(a.id)}"><span class="lp-ic" style="--a:${a.color || "#EC407A"};--b:${a.color2 || a.color || "#AD1457"}">${a.icon}${b != null ? `<i class="lp-badge">${esc(b)}</i>` : ""}</span><span class="lp-nm">${esc(a.name)}</span></button>`;
        }).join("")}</div></div>`;
    el.querySelectorAll(".lp-app").forEach(b => b.addEventListener("click", () => { A.sfxSelect(); PH.focus = b.dataset.app; openApp(b.dataset.app); }));
    el.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => { A.sfxSelect(); PH.focus = b.dataset.open; openApp(b.dataset.open, b.dataset.thread ? { thread: b.dataset.thread } : null); }));
    fitHome(el);
    H.refreshFocus(false);
    const want = document.getElementById("lpa_" + (focusId || PH.focus)) || el.querySelector(".lp-app");
    if (want) H.setFocus(want);
}
/** Every app icon on ONE screen, above the Back / Menu bar: on a short screen (an iPhone SE, a 720p TV) the notification
 *  cards give way first (the newest stays; the rest are in 💬 Messages), then the clock shrinks ("tight"). */
function fitHome(el) {
    const home = el.querySelector(".lp-home"), grid = el.querySelector(".lp-grid");
    if (!home || !grid || !grid.offsetParent) return;
    const over = () => grid.scrollHeight > grid.clientHeight + 2 || home.scrollHeight > home.clientHeight + 2;
    const cards = [...el.querySelectorAll(".lp-notes .lp-notif")];
    for (let i = cards.length - 1; i >= 0 && over(); i--) cards[i].style.display = "none";
    if (over()) home.classList.add("tight");
}

/** Open an app on the phone (a hand-off app closes the phone first). */
export function openApp(id, arg = null) {
    const app = APPS.find(a => a.id === id && shown(a));
    if (!app || !PH.open) return false;
    if (app.open && !app.render) { handOff(app, arg); return true; }
    if (!app.render) return false;
    PH.app = app;
    PH.arg = arg;
    PH.focus = id;
    const el = body();
    el.innerHTML = `<div class="lp-appv" style="--a:${app.color || "#EC407A"};--b:${app.color2 || app.color || "#AD1457"}">
        <div class="lp-head"><span class="lp-hic">${app.icon}</span><b>${esc(app.name)}</b></div>
        <div class="lp-appbody" id="lpApp"></div></div>`;
    renderApp(false);
    emit("phone:app", { app: id });
    return true;
}
function renderApp(keep) {
    const app = PH.app, el = document.getElementById("lpApp");
    if (!app || !el) return;
    let idx = 0;
    if (keep) { const f = el.querySelector(".focus"); idx = f ? [...el.querySelectorAll("button, .nav")].indexOf(f) : 0; }
    el.innerHTML = "";
    try { app.render(el, api, PH.arg); } catch (e) { console.error(`[phone] ${app.id}.render`, e); el.innerHTML = `<p class="lp-empty">😵 This app crashed.</p>`; }
    el.querySelectorAll(".btn:not(button):not(.nonav)").forEach(b => b.classList.add("nav"));      // (.nonav: a look-only line — a City Hall bill)
    H.refreshFocus(false);
    const list = [...el.querySelectorAll("button, .nav")].filter(b => !b.disabled && !b.classList.contains("nonav") && b.offsetParent !== null);
    const f = list[Math.min(Math.max(0, idx), list.length - 1)];
    if (f) H.setFocus(f);
    // (QA 2026-11-27: with fingers a new page starts at its TOP — the focus ring scrolled it to the first usable button,
    //  so 💼 Jobs on foot opened at the bottom on a phone on its side, the reason why off the screen)
    if (!keep && input.device === "touch") { const sc = el.closest(".lp-appbody") || el; sc.scrollTop = 0; }
}

/** A little notice inside the phone (H.toast waits while a menu is open). */
export function phoneToast(text) {
    const t = document.getElementById("lpToast");
    if (!t) return;
    t.textContent = String(text);
    t.classList.remove("on"); void t.offsetWidth; t.classList.add("on");
    clearTimeout(PH.toastT);
    PH.toastT = setTimeout(() => t.classList.remove("on"), 1800);
}

/** What render(el, api) gets. */
export const api = {
    close: () => closePhone(),
    back: () => back(),
    /** Re-draw the app. Focus stays on the same slot — a new page inside the app ({ top: true }) starts at its first
     *  control instead (QA 2026-11-27: a contact opened from far down the list put a controller on its ‹ Back). */
    refresh: (o) => renderApp(!(o && o.top)),
    /** Put the focus on `sel` inside the app (back to the row she came from). → bool */
    focus: sel => { const b = sel && document.querySelector("#lpApp " + sel); if (b && b.offsetParent !== null && !b.disabled) { H.setFocus(b); return true; } return false; },
    toast: text => phoneToast(text),
    /** (extra) open another app: api.open("messages", { thread }) */
    open: (id, arg) => openApp(id, arg),
};

// ── the corner button: 📱 where the phone opens, ❚❚ everywhere else ──────────
let corner = null, cornerKey = null;
export function buildCorner(onClick) {
    const pb = document.getElementById("pauseBtn");
    if (!pb || corner) return;
    corner = document.createElement("button");
    corner.id = "phoneBtn";
    corner.className = "round-btn";
    corner.setAttribute("aria-label", "Lulu's phone");
    corner.innerHTML = `📱<i class="lp-dot"></i><small class="lp-key"></small>`;
    corner.addEventListener("click", e => { e.stopPropagation(); A.unlockAudio(); onClick(); });
    pb.parentNode.insertBefore(corner, pb);
    cornerKey = corner.querySelector(".lp-key");
}
let lastDot = null, lastKey = null;
/** Unread dot + the "Tab / TOUCHPAD" hint under the button (only touched when they change). */
export function refreshCorner(unread = null, showKey = null) {
    if (!corner) return;
    if (unread != null) {
        const v = unread > 0 ? String(Math.min(99, unread)) : "";
        if (v !== lastDot) { lastDot = v; const d = corner.firstElementChild; d.textContent = v; d.classList.toggle("on", !!v); }
    }
    if (showKey != null) {
        const k = showKey ? glyph("phone") : "";
        if (k !== lastKey) { lastKey = k; cornerKey.innerHTML = k; cornerKey.classList.toggle("on", !!k); }
    }
}
