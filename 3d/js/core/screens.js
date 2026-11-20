// Title (home screen + grouped sub-menus), pause overlay, controls + settings screens.
//
// Features add buttons with addMenuItem("title" | "pause", {...}) and extra
// lines on the title card with addMenuItem("titleInfo", { id, label: () => html }).
//
// ── Menu groups ──────────────────────────────────────────────────────────
// ONE GAME, NOT A MENU OF MODES (roadmap 10): the HOME screen shows a compact top bar (coins,
// streak…), the logo, ONE big ▶ PLAY (the open world — she starts at home on foot; never locked)
// and two small play tiles under it (👯 Friends · 👧 Dina), then one tile per other group, each
// opening a sub-menu. The Story Trip, the Parking Challenge and the Erev Shabbos Rush are NOT
// title modes any more — they start from inside the world (features/onegame).
//     group: "play"   → the hero (the first by order: ▶ PLAY) + up to PLAY_TILES small tiles
//                       (TILE_FIRST ids first, then by order); any extra play item is listed
//                       under ⚙️ More instead (there is no "More to play" overflow)
//            "garage" → 🚗 Garage   (shop, car, toggles, photo mode…)
//            "book"   → 📒 Scrapbook (scrapbook, quests, story map…)
//            "more"   → ⚙️ More      (controls, settings, the 2D game…)
// No `group` → picked from `order` (see menuGroup() in ctx.js): < 70 play,
// 70–79 garage, ≥ 80 more. Unknown groups land in "more". `sub` adds a small
// subtitle line; `short` names the item in its group tile's summary.
// Sub-menus are tabbed (L1/R1 · Q/R · tap the tabs), ○/B / Esc goes back,
// and focus is remembered per view. The layout picks the button styles, so an
// item's `cls` is ignored on the title and pause menus.
//
// The PAUSE menu: group "main" (full width: Resume, skip, retry…), "tools"
// (a compact 2-column grid: camera, photo, scrapbook, settings…) and "exit"
// (quiet buttons at the bottom: restart, title). Default from `order` again.
//
// Tests (and anything else) can reach a tucked-away item with
// openMenuItem("title", id) / revealMenuItem(menu, re) — both on window.__lulu3d.
import { ctx, registerState, setState, addMenuItem, menuItems, emit, on } from "./ctx.js";
import { save3d, saveSoon, shared, wallet } from "./save.js";
import { cam } from "./camera.js";
import { canSkip, skipNow } from "./skip.js";
import { startRun, autopilot } from "./driving.js";
import { SKINS } from "../car.js";
import { input, glyph, glyphSet } from "../input.js";
import * as A from "../audio.js";
import * as H from "../hud.js";

// no new pop-ups (toasts / banners) while a dialogue line is open (menu screens: hud.js knows)
H.setPopupGate(() => ctx.dialogOpen);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ── controller status ────────────────────────────────────────────────────
/** A small chip when a pad is connected, else the "got a controller?" footer line. */
export function controllerLine() {
    if (input.padConnected) {
        const kind = input.padKind === "ps" ? "PlayStation" : input.padKind === "nintendo" ? "Switch" : "Xbox";
        return `<span class="pad-status on" title="${esc(input.padName)} — ${kind} layout">🎮 ${kind === "Xbox" ? "Controller" : kind} ✓</span>`;
    }
    return `<div class="pad-status">🎮 Got a controller? Pair or plug it in, then press any button.</div>`;
}

// ── title: groups, views, focus memory ───────────────────────────────────
export const TITLE_GROUPS = {
    garage: { icon: "🚗", name: "Garage" },
    book: { icon: "📒", name: "Scrapbook" },
    more: { icon: "⚙️", name: "More" },
};
const GROUP_ORDER = ["garage", "book", "more"];
/** The small play tiles under ▶ PLAY. Friends first (ci/everyone owns that item — "friends", or the older "party"),
 *  then Dina; anything else in "play" goes to ⚙️ More. */
export const PLAY_TILES = 2;
export const TILE_FIRST = ["friends", "party", "dina"];
const T = { view: "home", focus: {}, seq: 0, overflow: [] };

/** The home screen's play items: { hero, tiles, extra } (extra = play items that don't fit → ⚙️ More). */
function playSplit(items) {
    const play = items.filter(i => i.group === "play");
    const hero = play[0] || null;
    const rest = play.slice(1).map((i, k) => ({ i, k, p: TILE_FIRST.indexOf(i.id) }))
        .sort((a, b) => (a.p < 0 ? 99 : a.p) - (b.p < 0 ? 99 : b.p) || a.k - b.k).map(x => x.i);
    return { hero, tiles: rest.slice(0, PLAY_TILES), extra: rest.slice(PLAY_TILES).map(i => i.id) };
}
const groupOf = i => i.group === "play" ? (T.overflow.includes(i.id) ? "more" : "play") : TITLE_GROUPS[i.group] ? i.group : "more";
const scratch = document.createElement("div");
/** Plain text of a label (no glyphs / chips / dots). */
function plain(html) {
    scratch.innerHTML = html;
    scratch.querySelectorAll(".glyph, .meta-chip, .meta-dot, .jnew, .coin, .tg-dot").forEach(e => e.remove());
    return scratch.textContent.replace(/\s+/g, " ").trim();
}
function shortName(i) {
    if (i.short) return i.short;
    return plain(i.label).replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s*\(.*?\)\s*/g, " ").split(":")[0].trim();
}
const ICON = /^\s*((?:\p{Extended_Pictographic}|\p{Regional_Indicator}{2})(?:\uFE0F|\u20E3|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic}\uFE0F?)*)\s*/u;
/** "🛣️ Cruise (endless)" → ["🛣️", "Cruise (endless)"] (no leading emoji → ["", label]). */
function splitIcon(label) {
    const m = ICON.exec(label);
    return m ? [m[1], label.slice(m[0].length)] : ["", label];
}
const attention = html => /meta-dot|jnew|tg-dot/.test(html);

function itemSub(i, info) {
    const extra = info.filter(x => x.for === i.id).map(x => x.label).filter(Boolean).join("");
    const s = (i.sub || "") + extra;
    return s ? `<span class="t-s">${s}</span>` : "";
}
function tileHtml(i, info, cls) {
    const [ic, text] = splitIcon(i.label);
    return `<button class="btn tile ${cls}" id="${esc(i.id)}" data-ti="${esc(i.id)}">${ic ? `<span class="t-ic">${ic}</span>` : ""}<span class="t-tx"><span class="t-l">${text}</span>${itemSub(i, info)}</span></button>`;
}
function groupTileHtml(g, items) {
    const G = TITLE_GROUPS[g], list = items.filter(i => groupOf(i) === g);
    const names = list.map(shortName).filter(Boolean);
    const sub = names.slice(0, 2).join(" · ");
    const dot = list.some(i => attention(i.label)) ? '<span class="tg-dot"></span>' : "";
    return `<button class="btn tile grp" id="tg_${g}" data-tg="${g}" data-group-tile="${g}"><span class="t-ic">${G.icon}</span><span class="t-tx"><span class="t-l">${G.name}${dot}</span><span class="t-s">${esc(sub)}</span></span></button>`;
}

function homeHtml(items, info) {
    const { hero, tiles } = playSplit(items);
    const groups = GROUP_ORDER.filter(g => items.some(i => groupOf(i) === g));
    const bar = info.filter(x => x.bar).map(x => x.label).filter(Boolean).join("");
    const notes = info.filter(x => !x.bar && !x.for && !x.group).map(x => x.label).filter(Boolean).join("");
    return `<div class="home" data-title-seq="${T.seq}">
        <div class="home-bar"><span class="hb coins" title="Coins (shared with the 2D game)"><span class="coin"></span><b>${wallet.coins.toLocaleString()}</b></span>${bar}<span class="hb-sp"></span>${input.padConnected ? controllerLine() : ""}</div>
        <div class="logo"><span class="l1">LULU'S</span><span class="l2">ROAD TRIP</span><span class="l3">2.0</span></div>
        ${hero ? `<div class="home-hero">${tileHtml(hero, info, "hero")}</div>` : ""}
        ${tiles.length ? `<div class="home-tiles" data-n="${tiles.length}">${tiles.map(i => tileHtml(i, info, "")).join("")}</div>` : ""}
        ${groups.length ? `<div class="home-groups" data-n="${groups.length}">${groups.map(g => groupTileHtml(g, items)).join("")}</div>` : ""}
        ${notes ? `<div class="home-notes">${notes}</div>` : ""}
        ${input.padConnected ? "" : `<div class="home-foot">${controllerLine()}</div>`}
    </div>`;
}

function subTabs(items) {
    return GROUP_ORDER.filter(g => items.some(i => groupOf(i) === g));
}
function groupHtml(g, items, info) {
    const G = TITLE_GROUPS[g];
    const list = items.filter(i => groupOf(i) === g);
    const tabs = subTabs(items);
    const head = info.filter(x => x.group === g).map(x => x.label).filter(Boolean).join("");
    const rows = list.map(i => {
        const [ic, text] = splitIcon(i.label);
        return `<button class="btn row" id="${esc(i.id)}" data-ti="${esc(i.id)}">${ic ? `<span class="t-ic">${ic}</span>` : ""}<span class="t-tx"><span class="t-l">${text}</span>${itemSub(i, info)}</span><span class="r-ch">›</span></button>`;
    }).join("");
    return `<div class="tsub" data-title-seq="${T.seq}">
        <div class="tsub-head">${tabs.length > 1 ? `<span class="tsub-g">${glyph("tabPrev")}</span>` : ""}<div class="tsub-tabs">${tabs.map(t =>
            `<button class="tsub-tab nonav${t === g ? " on" : ""}" id="tt_${t}" data-tt="${t}" data-group-tile="${t}">${TITLE_GROUPS[t].icon} <span>${TITLE_GROUPS[t].name}</span></button>`).join("")}</div>${tabs.length > 1 ? `<span class="tsub-g">${glyph("tabNext")}</span>` : ""}</div>
        ${head ? `<div class="tsub-info">${head}</div>` : ""}
        <div class="tsub-list">${rows}</div>
        <div class="tsub-foot"><button class="btn ghost" id="tBack">‹ Back ${glyph("back")}</button></div>
    </div>`;
}

/** Re-render the current title view (keeps the focus on the same element when it still exists). */
function renderTitle(focusId) {
    const items = menuItems("title"), info = menuItems("titleInfo");
    T.overflow = playSplit(items).extra;
    if (T.view !== "home" && !subTabs(items).includes(T.view)) T.view = "home";
    T.seq++;
    const html = T.view === "home" ? homeHtml(items, info) : groupHtml(T.view, items, info);
    const home = T.view === "home";
    const card = H.showScreen(html, [], {
        focus: focusId || 0,
        onBack: home ? null : () => openView("home", "tg_" + T.view),
        onTab: home ? null : d => { const tabs = subTabs(items); const k = tabs.indexOf(T.view); openView(tabs[(k + d + tabs.length) % tabs.length]); },
        cls: home ? "title-card home-card" : "title-card tsub-card",
    });
    const seq = T.seq;
    const byId = new Map(items.map(i => [i.id, i]));
    card.querySelectorAll("[data-ti]").forEach(b => b.addEventListener("click", () => {
        const it = byId.get(b.dataset.ti);
        if (!it) return;
        A.sfxSelect();
        T.focus[T.view] = it.id;
        try { it.action(b); } catch (e) { console.error(`[title] ${it.id}`, e); }
        // the action changed something in place (a toggle, the car) → refresh the labels
        if (ctx.state === "title" && card.querySelector(`[data-title-seq="${seq}"]`)) renderTitle(it.id);
    }));
    card.querySelectorAll("[data-tg]").forEach(b => b.addEventListener("click", () => { A.sfxSelect(); openView(b.dataset.tg); }));
    card.querySelectorAll("[data-tt]").forEach(b => b.addEventListener("click", () => { if (b.dataset.tt !== T.view) { A.sfxMove(); openView(b.dataset.tt); } }));
    const back = card.querySelector("#tBack");
    if (back) back.addEventListener("click", () => { A.sfxMove(); openView("home", "tg_" + T.view); });
    return card;
}
function rememberFocus() {
    const f = H.screenCard().querySelector(".focus");
    if (f && f.id) T.focus[T.view] = f.id;
}
/** Switch the title to "home" or a group's sub-menu. */
export function openView(view, focusId) {
    if (ctx.state !== "title") return false;
    rememberFocus();
    T.view = view;
    renderTitle(focusId || T.focus[view]);
    return true;
}
export function titleView() { return T.view; }

/** (Re)draw the title. refresh = keep the current view + focus (e.g. coming back from a screen). */
export function showTitle(refresh = false) {
    if (!refresh) T.view = "home";
    const cur = refresh && H.screenOpen() ? H.screenCard().querySelector(".focus") : null;
    renderTitle(cur && cur.id && cur.closest("[data-title-seq]") ? cur.id : T.focus[T.view]);
}

/** Run a menu item's action wherever it lives (opens its sub-menu first on the title). */
export function openMenuItem(menu, id) {
    if (menu === "title" && ctx.state === "title") {
        const items = menuItems("title"), it = items.find(i => i.id === id);
        if (!it) return false;
        T.overflow = playSplit(items).extra;
        const g = groupOf(it);
        if (g !== "play") openView(g, id);
        else if (T.view !== "home") openView("home", id);
        const b = document.getElementById(id);
        if (b) { b.click(); return true; }
        return false;
    }
    if (menu === "pause" && ctx.paused) {
        const b = H.screenCard().querySelector(`#${CSS.escape(id)}`);
        if (b) { b.click(); return true; }
    }
    return false;
}
/** Bring a title item whose label matches `re` on screen (its sub-menu); returns its id or null. */
export function revealMenuItem(menu, re) {
    if (menu !== "title" || ctx.state !== "title") return null;
    const items = menuItems("title"), it = items.find(i => re.test(plain(i.label)) || re.test(i.label));
    if (!it) return null;
    T.overflow = playSplit(items).extra;
    const g = groupOf(it);
    if (g === "play") { if (T.view !== "home") openView("home", it.id); }
    else if (T.view !== g) openView(g, it.id);
    return it.id;
}
/** Every visible title item (all groups) — labels as plain text, in order. */
export function titleLabels() { const items = menuItems("title"); T.overflow = playSplit(items).extra; return items.map(i => ({ id: i.id, group: groupOf(i), label: plain(i.label) })); }

registerState("title", {
    hud: false, touch: false, world: true, driving: false,
    enter() {
        document.body.classList.add("title-mode");
        A.setMusic(null);
        A.sfxHorn(false);
        A.updateEngine(0, 0, 0, 0, false, false);
        ctx.traffic.clear();
        ctx.car.showDriver(true);
        ctx.car.obj.visible = true;
        ctx.G.boosting = ctx.car.boosting = false;
        if (input.padConnected && input.device === "keyboard") input.device = "gamepad";
        showTitle();
        emit("title", {});
    },
    exit() { rememberFocus(); document.body.classList.remove("title-mode"); H.hideScreen(); },
    update(dt, P) {
        H.menuInput(P);
        autopilot(dt);
    },
});

// core title items (features add Shop, Scrapbook, 👯 Friends, 👧 Dina…)
// ▶ PLAY — the open world (a "cruise" run under the hood): she starts at home on foot, Ima at the door. Never locked.
// Features add to its subtitle with addMenuItem("titleInfo", { for: "play", label }) (or a `playSub` hook: (parts) => void).
const playSubs = [];
/** A feature's live line under ▶ PLAY: fn() → html | "" (first non-empty wins, by priority — higher first). */
export function addPlaySub(fn, priority = 0) { playSubs.push({ fn, priority }); playSubs.sort((a, b) => b.priority - a.priority); }
function playSub() {
    for (const p of playSubs) { try { const s = p.fn(); if (s) return s; } catch (e) { console.error("[title] play sub", e); } }
    return save3d.best ? `home · the highway · the towns — best ${save3d.best.toLocaleString()}` : "Lulu's world: home, the highway, the towns";
}
addMenuItem("title", { id: "play", order: 5, group: "play", label: () => `▶️ PLAY ${glyph("confirm")}`, sub: playSub, action: () => startRun({ mode: "cruise" }) });
addMenuItem("title", { id: "skin", order: 32, group: "garage", short: "Car", label: () => `🚗 Car: ${SKINS[ctx.car.skinKey].name}`,
    sub: () => { const n = ownedSkins().length; return n > 1 ? `${n} cars in the garage · ${glyph("confirm")} to switch` : "buy more cars in the shop"; }, action: cycleSkin });
addMenuItem("title", { id: "controls", order: 86, group: "more", label: "🎮 Controls", action: () => showControls(() => showTitle(true)) });
addMenuItem("title", { id: "settings", order: 80, group: "more", label: "⚙️ Settings", sub: "graphics · HUD · sound · chatter", action: () => showSettings(() => showTitle(true)) });
addMenuItem("title", { id: "back2d", order: 99, group: "more", short: "Classic 2D", label: "🕹️ Classic 2D (legacy)", sub: "the original · same coins, same cars", action: () => { location.href = "../classic.html"; } });

function ownedSkins() {
    const owned = (shared.get().ownedSkins || ["pink"]).filter(k => SKINS[k]);
    return owned.length ? owned : ["pink"];
}
/** Cycle through the skins you OWN (shared with the 2D shop). */
function cycleSkin() {
    const list = ownedSkins();
    const next = list[(list.indexOf(ctx.car.skinKey) + 1) % list.length];
    ctx.car.setSkin(next);
    shared.update(s => { s.selectedSkin = next; });
    emit("skin", { key: next });
}

// ── controls ─────────────────────────────────────────────────────────────
const ROWS = [
    ["steer", "Steer"], ["gas", "Gas"], ["brake", "Brake · reverse"], ["handbrake", "Handbrake drift"],
    ["boost", "Nitro"], ["honk", "Horn"], ["camera", "Camera"], ["fire", "Fire missile"],
    ["item", "Pepper spray"], ["interact", "Interact (on foot)"], ["jump", "Jump (on foot · hold = higher)"], ["freeLook", "Look around (it stays put)"],
    ["recentre", "On foot: camera behind her"], ["lookBack", "Look behind"], ["map", "Map / scrapbook"], ["radio", "Car radio (next station)"], ["pause", "Pause"],
];
/** Features add / relabel a row of the button guide: setControlRow("bail", "Bail out", "interact") (glyphs: input.js glyphSet). */
export function setControlRow(action, label, after = null) {
    const i = ROWS.findIndex(r => r[0] === action);
    if (i >= 0) { ROWS[i][1] = label; return; }
    const j = after ? ROWS.findIndex(r => r[0] === after) : -1;
    ROWS.splice(j >= 0 ? j + 1 : ROWS.length, 0, [action, label]);
}
export function controlsHtml() {
    const pad = input.padConnected ? input.padKind : "ps";
    const G1 = glyphSet(pad), K = glyphSet("keyboard");
    const g = a => `<span class="glyph">${G1[a] || "—"}</span>`, k = a => `<span class="glyph k">${K[a] || "—"}</span>`;
    return `<div class="controls ctl3">
        <div class="hdr">ACTION</div><div class="hdr">🎮 ${pad === "ps" ? "PLAYSTATION" : pad === "nintendo" ? "SWITCH" : "XBOX"}</div><div class="hdr">⌨️ KEYBOARD</div>
        ${ROWS.map(([a, t]) => `<div>${t}</div><div>${g(a)}</div><div>${k(a)}</div>`).join("")}
    </div>`;
}
export function showControls(back) {
    H.showScreen(`<h2>🎮 Controls</h2>${controlsHtml()}
        <p class="fine">PS5 DualSense, PS4, Xbox, Switch Pro and most Bluetooth/USB controllers work in Chrome, Edge, Safari and Firefox.
        Menus: D-pad to move, ${glyph("confirm", "gamepad")} pick, ${glyph("back", "gamepad")} back, ${glyph("tabPrev", "gamepad")} ${glyph("tabNext", "gamepad")} tabs.</p>`,
        [{ label: `Got it ${glyph("confirm")}`, action: () => back() }], { onBack: () => back(), wide: true, cls: "controls-card" });
}

// ── settings ─────────────────────────────────────────────────────────────
const QUALITY = ["auto", "high", "medium", "low"];
const TV = ["auto", "on", "off"];
const CHATTER = ["chatty", "normal", "quiet"];
const cap = s => s[0].toUpperCase() + s.slice(1);
export function showSettings(back, focusId = null) {
    const S = save3d.settings;
    const row = (id, label, value) => `<button class="btn alt setting nav" id="set_${id}"><span>${label}</span><b>${value}</b></button>`;
    const sect = t => `<div class="set-h">${t}</div>`;
    const html = `<h2>⚙️ Settings</h2><div class="settings">
        ${sect("🖼️ Screen")}
        ${row("quality", "🖼️ Graphics", S.quality === "auto" && ctx.gfx ? `AUTO · ${ctx.gfx.tier.toUpperCase()}` : S.quality.toUpperCase())}
        ${row("tv", "📺 TV / console mode", S.tv.toUpperCase())}
        ${row("hud", "🔠 HUD size", Math.round(S.hud * 100) + "%")}
        ${row("hudMode", "🧹 HUD style", S.hudMode === "clean" ? "CLEAN" : "FULL")}
        ${sect("🔊 Sound & comfort")}
        ${row("music", "🎵 Music", A.audio.musicOn ? "ON" : "OFF")}
        ${row("sound", "🔊 Sound", save3d.sound ? "ON" : "OFF")}
        ${row("chatter", "💬 Lulu's chatter", cap(S.chatter || "normal").toUpperCase())}
        ${row("calm", "🫶 Calm screen (no shake)", S.calm ? "ON" : "OFF")}
        ${sect("🎮 Controls")}
        ${row("vibration", "📳 Rumble &amp; haptics", S.vibration ? "ON" : "OFF")}
        ${row("steer", "🛞 Steering", Math.round(S.steerSens * 100) + "%")}
        ${row("invert", "🔃 Invert look", S.invertLook ? "ON" : "OFF")}
        ${row("lookSens", "🎥 Look speed", Math.round((S.lookSens || 1) * 100) + "%")}
        ${menuItems("settings").map(i => `<button class="btn alt setting nav" id="set_x_${i.id}">${i.label}</button>`).join("")}
        <button class="btn alt setting nav" id="set_controls"><span>🎮 Button guide</span><b>›</b></button>
    </div>`;
    const card = H.showScreen(html, [{ label: `Done ${glyph("back")}`, action: () => back() }], { onBack: () => back(), focus: focusId || (H.screenOpen() && H.screenCard().querySelector(".settings") ? H.currentFocus() : 0), wide: true, cls: "settings-card" });
    const on = (id, fn) => { const b = card.querySelector("#set_" + id); if (b) b.addEventListener("click", () => { A.sfxSelect(); fn(); saveSoon(); if (ctx.applySettings) ctx.applySettings(); emit("settings", { id }); showSettings(back); }); };
    on("quality", () => { S.quality = QUALITY[(QUALITY.indexOf(S.quality) + 1) % QUALITY.length]; });
    on("tv", () => { S.tv = TV[(TV.indexOf(S.tv) + 1) % TV.length]; });
    on("vibration", () => { S.vibration = !S.vibration; });
    on("steer", () => { const v = [0.6, 0.8, 1, 1.2, 1.4]; S.steerSens = v[(v.indexOf(S.steerSens) + 1) % v.length] || 1; });
    on("invert", () => { S.invertLook = !S.invertLook; });
    on("lookSens", () => { const v = [0.6, 0.8, 1, 1.25, 1.6]; S.lookSens = v[(v.indexOf(S.lookSens || 1) + 1) % v.length] || 1; });
    on("calm", () => { S.calm = !S.calm; });
    on("music", () => { save3d.music = A.toggleMusic(); });
    on("sound", () => { save3d.sound = !save3d.sound; A.setMuted(!save3d.sound); });
    on("hud", () => { const v = [0.85, 1, 1.15, 1.3]; S.hud = v[(v.indexOf(S.hud) + 1) % v.length] || 1; });
    on("hudMode", () => { S.hudMode = S.hudMode === "clean" ? "full" : "clean"; });
    on("chatter", () => { S.chatter = CHATTER[(CHATTER.indexOf(S.chatter) + 1) % CHATTER.length] || "normal"; });
    const ctl = card.querySelector("#set_controls");
    if (ctl) ctl.addEventListener("click", () => { A.sfxSelect(); showControls(() => showSettings(back, "set_controls")); });
    for (const i of menuItems("settings")) {
        const b = card.querySelector("#set_x_" + i.id);
        if (b) b.addEventListener("click", () => { i.action(b); saveSoon(); showSettings(back); });
    }
}
/** Body classes that follow the settings (called from ctx.applySettings). */
export function applyUiSettings() {
    const S = save3d.settings;
    document.body.classList.toggle("hud-clean", S.hudMode === "clean");
}

// ── pause overlay ────────────────────────────────────────────────────────
let pauseFocus = null, padLost = false;
export function pause() {
    const def = ctx.states[ctx.state];
    if (ctx.paused || !def || !def.pausable) return;
    ctx.paused = true;
    pauseFocus = null;
    A.sfxHorn(false);
    A.updateEngine(0, 0, 0, 0, false, false);
    A.duckMusic(0.12);
    showPauseMenu();
    emit("pause", { paused: true });
}
export function resume() {
    if (!ctx.paused) return;
    H.hideScreen();
    ctx.paused = false;
    padLost = false;
    A.duckMusic(0.32);
    emit("pause", { paused: false });
}
// a controller that drops mid-drive pauses the game (app.js) → say why on the card
on("pad", ({ connected }) => {
    padLost = !connected;
    if (ctx.paused && H.screenOpen() && H.screenCard().querySelector(".pause-menu")) showPauseMenu();
});
export function showPauseMenu() {
    const items = menuItems("pause");
    const by = g => items.filter(i => (["main", "tools", "exit"].includes(i.group) ? i.group : "main") === g);
    const btn = (i, cls) => `<button class="btn ${cls}" id="${esc(i.id)}" data-pi="${esc(i.id)}">${i.label}</button>`;
    const main = by("main"), tools = by("tools"), exit = by("exit");
    const html = `<div class="pause-menu"><h2>Paused</h2>
        ${padLost && !input.padConnected ? `<div class="pad-status">🎮 Controller disconnected — reconnect it and press any button.</div>` : ""}
        <div class="pm-main">${main.map((i, k) => btn(i, k === 0 ? "" : "alt")).join("")}</div>
        ${tools.length ? `<div class="pm-tools">${tools.map(i => btn(i, "alt sm")).join("")}</div>` : ""}
        ${exit.length ? `<div class="pm-exit">${exit.map(i => btn(i, "ghost sm")).join("")}</div>` : ""}</div>`;
    const card = H.showScreen(html, [], { onBack: resume, focus: pauseFocus || 0, cls: "pause-card" });
    const byId = new Map(items.map(i => [i.id, i]));
    card.querySelectorAll("[data-pi]").forEach(b => b.addEventListener("click", () => {
        const it = byId.get(b.dataset.pi);
        if (!it) return;
        A.sfxSelect();
        pauseFocus = it.id;
        try { it.action(b); } catch (e) { console.error(`[pause] ${it.id}`, e); }
    }));
    return card;
}

addMenuItem("pause", { id: "resume", order: 0, group: "main", label: "▶ Resume", action: resume });
// (only where the chase / far / Lulu's-eyes cams apply: a driving state that doesn't run its own camera — not on foot, a set, a cutscene)
addMenuItem("pause", { id: "camera", order: 10, group: "tools", label: () => `🎥 Camera: ${cam.name}`, visible: () => { const d = ctx.states[ctx.state]; return !!(d && d.driving && !d.camera && !ctx.view); }, action: b => { cam.cycle(); b.innerHTML = `🎥 Camera: ${cam.name}`; } });
addMenuItem("pause", { id: "skip", order: 5, group: "main", label: "⏭ Skip this scene", visible: () => canSkip(true), action: () => { resume(); skipNow(); } });
addMenuItem("pause", { id: "settings", order: 35, group: "tools", label: "⚙️ Settings", action: () => showSettings(showPauseMenu) });
// (not mid-cutscene: restarting during the arrest cinematic walked her out of the booking)
addMenuItem("pause", { id: "restart", order: 80, group: "exit", label: "↺ Restart", visible: () => { const d = ctx.states[ctx.state]; return !!(d && d.driving && !d.camera); },
    action: () => { resume(); startRun({ mode: ctx.G.mode, restart: true }); } });     // (restart: a fresh run starts at home on foot, like Play)
addMenuItem("pause", { id: "title", order: 90, group: "exit", label: "⌂ Title screen", action: () => { resume(); emit("quit", {}); setState("title"); } });
