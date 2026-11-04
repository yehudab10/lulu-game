// Lulu's Road Trip 3D — boot + main loop. Game rules live in core/ (driving,
// screens, camera…) and features/ (journey, law, garage, on foot, Dina…).
import * as THREE from "three";
import { ctx, emit, setState, setChromeHandler, trackCamera, syncAllCameras, runHooks } from "./core/ctx.js";
import { save3d, shared } from "./core/save.js";
import { loadModels } from "./models.js";
import { World } from "./world.js";
import { PlayerCar, SKINS } from "./car.js";
import { Traffic } from "./traffic.js";
import { input, updateInput, bindTouch, refreshTouchButtons, glyph } from "./input.js";
import * as A from "./audio.js";
import * as H from "./hud.js";
import { cam } from "./core/camera.js";
import { dialogUpdate, setDialogGlyph } from "./core/dialog.js";
import { pause } from "./core/screens.js";
import { resetRun, startRun, endRun, damage, addCoins } from "./core/driving.js";
import { applyTvMode, detectPlatform } from "./core/platform.js";
import "./features/index.js";

const MPH = 2.23694;

// ── renderer / scene ────────────────────────────────────────────────────
const canvas = document.getElementById("scene");
const platform = detectPlatform();
const coarse = matchMedia("(pointer: coarse)").matches;
let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !platform.console, powerPreference: "high-performance" });
} catch (e) {
    noWebGL(e);
    throw e;
}
ctx.renderer = renderer;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#d4efff", 160, 640);
const camera = trackCamera(new THREE.PerspectiveCamera(62, 1, 0.1, 2200));
ctx.scene = scene;
ctx.camera = camera;

const hemi = new THREE.HemisphereLight("#cfeaff", "#5f8a45", 1.35);
const sun = new THREE.DirectionalLight("#fff1dc", 2.6);
sun.castShadow = true;
const SH = 46;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(hemi, sun, sun.target);
ctx.lights = { hemi, sun, sunOffset: new THREE.Vector3(-38, 70, -26) };

let pixelRatio = 1, autoQuality = true;
function applySettings() {
    const S = save3d.settings;
    const q = S.quality === "auto" ? (platform.console || platform.tv ? "low" : coarse ? "medium" : "high") : S.quality;
    autoQuality = S.quality === "auto";
    const dpr = window.devicePixelRatio || 1;
    pixelRatio = q === "high" ? Math.min(dpr, 2) : q === "medium" ? Math.min(dpr, 1.5) : 1;
    renderer.setPixelRatio(pixelRatio);
    renderer.shadowMap.enabled = q !== "low";
    const size = q === "high" ? 2048 : 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    input.rumbleOn = S.vibration !== false;
    applyTvMode(S.tv === "on" || (S.tv === "auto" && (platform.tv || platform.console)));
    document.documentElement.style.setProperty("--hud-scale", S.hud || 1);
    A.setMuted(save3d.sound === false);
    resize();
}
ctx.applySettings = applySettings;
ctx.platform = platform;

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    syncAllCameras();
}
window.addEventListener("resize", resize);

// HUD + touch controls follow the current state
setChromeHandler(def => {
    H.showHud(!!def.hud);
    H.showTouch(!!def.touch && input.device === "touch");
    if (!def.hud) H.padHint("");
});

// ── boot ────────────────────────────────────────────────────────────────
async function boot() {
    applySettings();
    H.setLoading(0.05, "Loading Lulu's car…");
    try {
        await loadModels(f => H.setLoading(0.05 + f * 0.85, f < 1 ? "Loading the neighbourhood…" : "Paving the road…"));
    } catch (e) {
        H.setLoading(1, "Couldn't load the 3D models — check your connection and refresh.");
        console.error(e);
        return;
    }
    const s2 = shared.get();
    ctx.world = new World(scene);
    ctx.car = new PlayerCar(scene, SKINS[s2.selectedSkin] ? s2.selectedSkin : "pink");
    if (s2.luluHair) ctx.car.setHair(s2.luluHair, s2.luluHairStyle);
    ctx.traffic = new Traffic(scene, ctx.world);
    bindTouch();
    setDialogGlyph(a => glyph(a));
    emit("boot", ctx);          // features finish their setup here (they can see world/car/traffic now)
    resetRun();
    renderer.compile(scene, camera);
    H.setLoading(1, "Ready!");
    setTimeout(() => { H.hideLoading(); setState("title"); }, ctx.TEST ? 0 : 250);
    input.onPadChange = connected => {
        if (ctx.state === "title") setState("title");
        H.toast(connected ? `🎮 ${input.padKind === "ps" ? "PlayStation controller" : "Controller"} connected!` : "Controller disconnected", connected ? "pink" : "");
        if (!connected) pause();
        emit("pad", { connected });
    };
    input.onDeviceChange = d => {
        H.setBoost(ctx.G.boost || 0, d === "touch" ? "" : glyph("boost"));
        const def = ctx.states[ctx.state];
        if (def) H.showTouch(!!def.touch && d === "touch");
        emit("device", { device: d });
    };
    requestAnimationFrame(loop);
}

// ── main loop ───────────────────────────────────────────────────────────
let last = performance.now();
const perf = { t: 0, frames: 0 };

function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;           // below 20 fps the game slows down rather than tunnelling
    if (ctx.TEST) dt = 1 / 30;          // smoke test: deterministic game time per frame
    if (dt <= 0) return;
    ctx.time += dt;
    ctx.stateT += dt;
    ctx.frames++;

    updateInput(dt);
    let P = input.pressed;
    if ((P.confirm || P.start || P.honk) && !A.audio.ready) A.unlockAudio();
    if (P.music) { save3d.music = A.toggleMusic(); H.toast(save3d.music ? "🎵 Music on" : "🔇 Music off"); }

    const def = ctx.states[ctx.state];
    try {
        if (ctx.dialogOpen) { dialogUpdate(dt, P); P = {}; }
        if (ctx.paused) {
            H.menuInput(P);
        } else if (def) {
            if (P.pause && def.pausable) pause();
            else {
                if (P.camera && def.driving) H.toast("🎥 " + cam.cycle());
                if (def.update) def.update(dt, P);
            }
        }
    } catch (e) {
        console.error("Lulu3D frame error", e);
    }

    const cur = ctx.states[ctx.state] || def;
    if (!ctx.view && ctx.world) {
        if (cur && cur.world !== false) ctx.world.update(dt, ctx.car.s, camera.position);
        try { cam.update(dt); } catch (e) { console.error("Lulu3D camera error", e); }
        sun.position.copy(ctx.car.pos).add(ctx.lights.sunOffset);
        sun.target.position.copy(ctx.car.pos);
    }
    if (cur && cur.hud) updateHud(dt);
    refreshTouchButtons();
    const v = ctx.view;
    renderer.render(v ? v.scene : scene, v ? v.camera : camera);
    adaptQuality(dt);
}

function updateHud(dt) {
    const G = ctx.G, car = ctx.car;
    H.setSpeed(car.speed * MPH);
    H.setCoins(G.coins);
    H.setScore(G.score);
    H.setBoost(G.boost);
    if (ctx.trip) H.setTrip(ctx.trip.progress(), ctx.trip.label());
    else H.setTrip(1, `CRUISE · ${((car.s - (G.startS || 0)) / 1609).toFixed(1)} mi`);
    let hint = "";
    if (ctx.state === "playing" && !ctx.TEST) {
        // Browsers don't count controller buttons as a "user gesture", so sound
        // can't start until there's one click / tap / key press.
        if (!A.audio.ready && input.device === "gamepad") hint = "🔇 Click or tap the screen once to turn the sound on";
        else if (G.runTime < 9 && input.device === "gamepad") {
            hint = `${glyph("gas")} gas · ${glyph("brake")} brake · ${glyph("handbrake")} drift · ${glyph("boost")} nitro · ${glyph("honk")} horn · ${glyph("camera")} camera`;
        } else if (G.runTime < 9 && input.device === "keyboard") {
            hint = `${glyph("gas")} gas · ${glyph("brake")} brake · ${glyph("steer")} steer · ${glyph("boost")} nitro · ${glyph("honk")} horn · ${glyph("camera")} camera`;
        }
    }
    if (G.hint) hint = G.hint;
    H.padHint(hint);
    runHooks("hud", dt);
}

// Drop the resolution a notch on slow devices so it stays smooth.
function adaptQuality(dt) {
    if (!autoQuality || ctx.TEST) return;
    perf.t += dt; perf.frames++;
    if (perf.t < 2) return;
    const fps = perf.frames / perf.t;
    perf.t = 0; perf.frames = 0;
    if (fps < 40 && pixelRatio > 0.75) {
        pixelRatio = Math.max(0.75, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        if (pixelRatio <= 1 && renderer.shadowMap.enabled && fps < 30) renderer.shadowMap.enabled = false;
        resize();
    }
}

function noWebGL(err) {
    document.getElementById("loading").innerHTML = `<div class="card loading-card">
        <div class="logo"><span class="l1">LULU'S</span><span class="l2">ROAD TRIP</span><span class="l3">3D</span></div>
        <p><b>This browser can't show 3D graphics (WebGL is off or missing).</b></p>
        <p>${platform.console ? "The PlayStation's built-in browser doesn't support WebGL games yet." : "Try Chrome, Edge, Safari or Firefox, or turn on hardware acceleration."}</p>
        <div class="menu"><a class="btn pink" href="../">▶ Play the 2D game instead</a></div></div>`;
    console.error(err);
}

document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
document.getElementById("pauseBtn").addEventListener("click", () => { A.unlockAudio(); pause(); });
window.addEventListener("pointerdown", () => A.unlockAudio(), { passive: true });
window.addEventListener("keydown", () => A.unlockAudio(), { passive: true });

// test hook for scripts/smoke3d.js
window.__lulu3d = {
    ctx, setState, startRun, resetRun, endRun, damage, addCoins, emit, input,
    get state() { return ctx.state; },
    get car() { return ctx.car; }, get world() { return ctx.world; }, get traffic() { return ctx.traffic; },
    get game() { return ctx.G; }, get frames() { return ctx.frames; },
    start: (mode = "story") => startRun({ mode }),
    renderer,
};

boot();
