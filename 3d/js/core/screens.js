// Title screen, pause overlay, controls + settings screens.
//
// Features add buttons with addMenuItem("title" | "pause", {...}) and extra
// lines on the title card with addMenuItem("titleInfo", { id, label: () => html }).
import { ctx, registerState, setState, addMenuItem, menuItems, emit } from "./ctx.js";
import { save3d, saveSoon, shared, wallet } from "./save.js";
import { cam } from "./camera.js";
import { startRun, autopilot } from "./driving.js";
import { SKINS } from "../car.js";
import { input, glyph, glyphSet } from "../input.js";
import * as A from "../audio.js";
import * as H from "../hud.js";

// ── title ────────────────────────────────────────────────────────────────
export function controllerLine() {
    if (input.padConnected) {
        const ps = input.padKind === "ps";
        return `<div class="pad-status on">🎮 ${input.padName}${ps ? " (PlayStation layout)" : ""} — ready to drive!</div>`;
    }
    return `<div class="pad-status">🎮 Got a controller? Pair or plug it in, then press any button.</div>`;
}

function titleHtml() {
    const skin = SKINS[ctx.car.skinKey];
    const extra = menuItems("titleInfo").map(i => i.label).join("");
    const coins = wallet.coins;
    return `
        <div class="logo"><span class="l1">LULU'S</span><span class="l2">ROAD TRIP</span><span class="l3">3D</span></div>
        <p class="tagline">Lulu's <b>${skin.name}</b> convertible · <span class="coin"></span> <b>${coins.toLocaleString()}</b> coins (shared with the 2D game)</p>
        ${controllerLine()}
        ${extra}
        ${save3d.best ? `<p class="fine">Best score ${save3d.best.toLocaleString()}</p>` : ""}`;
}

export function showTitle(refresh = false) {
    H.showScreen(titleHtml(), menuItems("title"), { focus: refresh ? H.currentFocus() : 0 });
}

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
    exit() { document.body.classList.remove("title-mode"); H.hideScreen(); },
    update(dt, P) {
        H.menuInput(P);
        autopilot(dt);
    },
});

// core title items (features add Story Trip, Shop, Scrapbook, Dina…)
addMenuItem("title", { id: "cruise", order: 20, cls: "", label: "🛣️ Cruise (endless)", action: () => startRun({ mode: "cruise" }) });
addMenuItem("title", { id: "skin", order: 70, cls: "purple", label: () => `🚗 Car: ${SKINS[ctx.car.skinKey].name}`, action: cycleSkin });
addMenuItem("title", { id: "controls", order: 80, label: "🎮 Controls", action: () => showControls(() => showTitle(true)) });
addMenuItem("title", { id: "settings", order: 85, label: "⚙️ Settings", action: () => showSettings(() => showTitle(true)) });
addMenuItem("title", { id: "back2d", order: 99, cls: "pink", label: "← The 2D game", action: () => { location.href = "../"; } });

/** Cycle through the skins you OWN (shared with the 2D shop). */
function cycleSkin(btn) {
    const owned = (shared.get().ownedSkins || ["pink"]).filter(k => SKINS[k]);
    const list = owned.length ? owned : ["pink"];
    const next = list[(list.indexOf(ctx.car.skinKey) + 1) % list.length];
    ctx.car.setSkin(next);
    shared.update(s => { s.selectedSkin = next; });
    if (btn) btn.innerHTML = `🚗 Car: ${SKINS[next].name}`;
    emit("skin", { key: next });
}

// ── controls ─────────────────────────────────────────────────────────────
const ROWS = [
    ["steer", "Steer"], ["gas", "Gas"], ["brake", "Brake · reverse"], ["handbrake", "Handbrake drift"],
    ["boost", "Nitro"], ["honk", "Horn"], ["camera", "Camera"], ["fire", "Fire missile"],
    ["item", "Use item"], ["interact", "Interact (on foot)"], ["map", "Map / scrapbook"], ["pause", "Pause"],
];
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
    H.showScreen(`<h2>Controls</h2>${controlsHtml()}
        <p class="fine">Works with PS5 DualSense, PS4, Xbox, Switch Pro and most Bluetooth/USB controllers in Chrome, Edge, Safari and Firefox.
        In menus: D-pad to move, ${glyph("confirm", "gamepad")} to pick, ${glyph("back", "gamepad")} to go back, ${glyph("tabPrev", "gamepad")}/${glyph("tabNext", "gamepad")} to switch tabs.</p>`,
        [{ label: `Got it ${glyph("confirm")}`, action: () => back() }], { onBack: () => back(), wide: true });
}

// ── settings ─────────────────────────────────────────────────────────────
const QUALITY = ["auto", "high", "medium", "low"];
const TV = ["auto", "on", "off"];
export function showSettings(back) {
    const S = save3d.settings;
    const row = (id, label, value) => `<button class="btn alt setting nav" id="set_${id}"><span>${label}</span><b>${value}</b></button>`;
    const html = `<h2>⚙️ Settings</h2><div class="settings">
        ${row("quality", "🖼️ Graphics", S.quality.toUpperCase())}
        ${row("tv", "📺 TV / console mode", S.tv.toUpperCase())}
        ${row("vibration", "📳 Controller rumble", S.vibration ? "ON" : "OFF")}
        ${row("steer", "🛞 Steering sensitivity", Math.round(S.steerSens * 100) + "%")}
        ${row("invert", "🔃 Invert look (right stick)", S.invertLook ? "ON" : "OFF")}
        ${row("calm", "🫶 Calm screen (no shake)", S.calm ? "ON" : "OFF")}
        ${row("music", "🎵 Music", A.audio.musicOn ? "ON" : "OFF")}
        ${row("sound", "🔊 Sound", save3d.sound ? "ON" : "OFF")}
        ${row("hud", "🔠 HUD size", Math.round(S.hud * 100) + "%")}
        ${menuItems("settings").map(i => `<button class="btn alt setting nav" id="set_x_${i.id}">${i.label}</button>`).join("")}
    </div>`;
    const card = H.showScreen(html, [{ label: `Done ${glyph("back")}`, action: () => back() }], { onBack: () => back(), focus: H.screenOpen() ? H.currentFocus() : 0 });
    const on = (id, fn) => { const b = card.querySelector("#set_" + id); if (b) b.addEventListener("click", () => { fn(); saveSoon(); if (ctx.applySettings) ctx.applySettings(); showSettings(back); }); };
    on("quality", () => { S.quality = QUALITY[(QUALITY.indexOf(S.quality) + 1) % QUALITY.length]; });
    on("tv", () => { S.tv = TV[(TV.indexOf(S.tv) + 1) % TV.length]; });
    on("vibration", () => { S.vibration = !S.vibration; });
    on("steer", () => { const v = [0.6, 0.8, 1, 1.2, 1.4]; S.steerSens = v[(v.indexOf(S.steerSens) + 1) % v.length] || 1; });
    on("invert", () => { S.invertLook = !S.invertLook; });
    on("calm", () => { S.calm = !S.calm; });
    on("music", () => { save3d.music = A.toggleMusic(); });
    on("sound", () => { save3d.sound = !save3d.sound; A.setMuted(!save3d.sound); });
    on("hud", () => { const v = [0.85, 1, 1.15, 1.3]; S.hud = v[(v.indexOf(S.hud) + 1) % v.length] || 1; });
    for (const i of menuItems("settings")) {
        const b = card.querySelector("#set_x_" + i.id);
        if (b) b.addEventListener("click", () => { i.action(b); saveSoon(); showSettings(back); });
    }
}

// ── pause overlay ────────────────────────────────────────────────────────
export function pause() {
    const def = ctx.states[ctx.state];
    if (ctx.paused || !def || !def.pausable) return;
    ctx.paused = true;
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
    A.duckMusic(0.32);
    emit("pause", { paused: false });
}
export function showPauseMenu() {
    H.showScreen(`<h2>Paused</h2>${controllerLine()}`, menuItems("pause"), { onBack: resume });
}

addMenuItem("pause", { id: "resume", order: 0, cls: "", label: "▶ Resume", action: resume });
addMenuItem("pause", { id: "camera", order: 10, label: () => `🎥 Camera: ${cam.name}`, action: b => { cam.cycle(); b.innerHTML = `🎥 Camera: ${cam.name}`; } });
addMenuItem("pause", { id: "controls", order: 30, label: "🎮 Controls", action: () => showControls(showPauseMenu) });
addMenuItem("pause", { id: "settings", order: 35, label: "⚙️ Settings", action: () => showSettings(showPauseMenu) });
addMenuItem("pause", { id: "restart", order: 80, cls: "pink", label: "↺ Restart", visible: () => ctx.states[ctx.state] && ctx.states[ctx.state].driving,
    action: () => { resume(); startRun({ mode: ctx.G.mode }); } });
addMenuItem("pause", { id: "title", order: 90, cls: "purple", label: "⌂ Title screen", action: () => { resume(); emit("quit", {}); setState("title"); } });
