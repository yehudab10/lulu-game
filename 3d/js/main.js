// Lulu's Road Trip 3D — main loop, camera, game rules and screens.
import * as THREE from "three";
import { loadModels, models } from "./models.js";
import { World, GOAL, HALF_ROAD, SHOULDER } from "./world.js";
import { PlayerCar, SKINS, skinFrom2D } from "./car.js";
import { Traffic } from "./traffic.js";
import { input, updateInput, bindTouch, rumble, triggerRumble, glyph } from "./input.js";
import * as A from "./audio.js";
import * as H from "./hud.js";

const MPH = 2.23694;
const MAX_HEARTS = 3;
const SPEED_TRAP_MPH = 75;
const TEST = /[?&]test\b/.test(location.search);

// ── save (separate from the 2D save; we only READ the 2D skin) ──────────
const SAVE_KEY = "lulu3dSave";
const save = Object.assign({ best: 0, bestTime: 0, arrivals: 0, totalCoins: 0, cam: 0, music: true, skin: null }, (() => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY) || "{}"); } catch (e) { return {}; }
})());
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }

// ── renderer / scene ────────────────────────────────────────────────────
const canvas = document.getElementById("scene");
const coarse = matchMedia("(pointer: coarse)").matches;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
let pixelRatio = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#d4efff", 160, 640);
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2200);

const hemi = new THREE.HemisphereLight("#cfeaff", "#5f8a45", 1.35);
scene.add(hemi);
const sun = new THREE.DirectionalLight("#fff1dc", 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
const SH = 46;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 220 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);
const SUN_OFF = new THREE.Vector3(-38, 70, -26);

function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ── game objects (created after models load) ────────────────────────────
let world, car, traffic;
let state = "loading";
if (coarse) input.device = "touch";
const G = {
    hearts: MAX_HEARTS, coins: 0, score: 0, closeCalls: 0, combo: 0, comboT: 0, boost: 0.35, boosting: false,
    invT: 0, time: 0, runTime: 0, arrived: false, cruise: false, lastS: 0, shake: 0, stateT: 0, offroadT: 0,
    tickets: 0, crashes: 0, aheadShown: false, wreckSpin: 0, countdown: 0,
};
const camState = { mode: save.cam || 0, yaw: 0, lookYaw: 0, lookPitch: 0, fov: 62, pos: new THREE.Vector3(), target: new THREE.Vector3(), orbit: 0 };
const CAMS = [
    { name: "Chase cam", dist: 7.4, height: 2.7, look: 1.2, fov: 60 },
    { name: "Far chase", dist: 11.5, height: 4.4, look: 1.6, fov: 56 },
    { name: "Lulu's eyes", fp: true, fov: 72 },
];

const QUIPS = ["Oy vey!", "Bubbe's gonna hear about this!", "That's coming out of the gas money!", "Who put that there?!", "My sheitel!!"];

// ── boot ────────────────────────────────────────────────────────────────
async function boot() {
    H.setLoading(0.05, "Loading Lulu's car…");
    try {
        await loadModels(f => H.setLoading(0.05 + f * 0.85, f < 1 ? "Loading the neighbourhood…" : "Paving the road…"));
    } catch (e) {
        H.setLoading(1, "Couldn't load the 3D models — check your connection and refresh.");
        console.error(e);
        return;
    }
    world = new World(scene);
    car = new PlayerCar(scene, save.skin || skinFrom2D());
    traffic = new Traffic(scene, world);
    bindTouch();
    resetRun();
    world.prebuild(0);
    // warm the GPU (compile shaders) before the first visible frame
    renderer.compile(scene, camera);
    H.setLoading(1, "Ready!");
    setTimeout(() => { H.hideLoading(); goTitle(); }, TEST ? 0 : 250);
    input.onPadChange = connected => {
        if (state === "title") goTitle(true);
        H.toast(connected ? "🎮 Controller connected!" : "Controller disconnected", connected ? "pink" : "");
        if (!connected && state === "playing") pause();
    };
    input.onDeviceChange = () => { refreshPrompts(); if (state === "title") goTitle(true); };
    requestAnimationFrame(loop);
}

function resetRun() {
    G.pausedFrom = null;
    Object.assign(G, {
        hearts: MAX_HEARTS, coins: 0, score: 0, closeCalls: 0, combo: 0, comboT: 0, boost: 0.35, boosting: false,
        invT: 0, runTime: 0, arrived: false, cruise: false, lastS: 0, shake: 0, offroadT: 0, tickets: 0, crashes: 0,
        aheadShown: false, wreckSpin: 0,
    });
    traffic.clear();
    const p = world.road.point(12, 1.75, {});
    car.place(p.x, p.z, p.h);
    car.s = 12; car.d = 1.75;
    G.lastS = 12;
    world.prebuild(12);
    world.resetCoins();
    camState.yaw = car.h;
    snapCamera();
    H.setHearts(G.hearts, MAX_HEARTS);
}

// ── screens ─────────────────────────────────────────────────────────────
function controllerLine() {
    if (input.padConnected) return `<div class="pad-status on">🎮 ${input.padName} — ready to drive!</div>`;
    return `<div class="pad-status">🎮 Got a controller? Pair or plug it in, then press any button.</div>`;
}

function controlsHtml() {
    const pad = input.padConnected ? input.padKind : "xbox";
    const g = (a) => `<span class="glyph">${padGlyph(pad, a)}</span>`;
    const k = (a) => glyph(a, "keyboard");
    return `<div class="controls">
        <div class="hdr">🎮 CONTROLLER</div>
        <div>${g("steer")} Steer</div><div>${g("gas")} / ${g("confirm")} Gas</div>
        <div>${g("brake")} / ${g("back")} Brake · reverse</div><div>${g("handbrake")} Handbrake drift</div>
        <div>${g("boost")} Nitro</div><div>${g("honk")} Horn</div>
        <div>${g("camera")} Camera</div><div>${g("look")} Look · ${g("lookBack")} behind</div>
        <div class="hdr">⌨️ KEYBOARD</div>
        <div>${k("steer")} Steer</div><div>${k("gas")} Gas · ${k("brake")} Brake</div>
        <div>${k("handbrake")} Drift · ${k("boost")} Nitro</div><div>${k("honk")} Horn · ${k("camera")} Camera</div>
        <div>${k("pause")} Pause · ${k("music")} Music</div><div>${k("lookBack")} Look behind</div>
    </div>`;
}
const PADG = {
    xbox: { steer: "L-stick", gas: "RT", confirm: "A", brake: "LT", back: "B", handbrake: "X", boost: "RB", honk: "LB", camera: "Y", look: "R-stick", lookBack: "R3" },
    ps: { steer: "L-stick", gas: "R2", confirm: "✕", brake: "L2", back: "○", handbrake: "□", boost: "R1", honk: "L1", camera: "△", look: "R-stick", lookBack: "R3" },
    nintendo: { steer: "L-stick", gas: "ZR", confirm: "B", brake: "ZL", back: "A", handbrake: "Y", boost: "R", honk: "L", camera: "X", look: "R-stick", lookBack: "R3" },
};
function padGlyph(kind, a) { return (PADG[kind] || PADG.xbox)[a] || a; }

function goTitle(refreshOnly) {
    state = "title";
    document.body.classList.add("title-mode");
    H.showHud(false);
    H.showTouch(false);
    H.padHint("");
    A.setMusic(null);
    if (!refreshOnly) {
        traffic.clear();
        G.boosting = car.boosting = false;
        A.sfxHorn(false);
    }
    if (input.padConnected && input.device === "keyboard" && !refreshOnly) input.device = "gamepad";
    const skin = SKINS[car.skinKey];
    const best = save.best ? `<p class="fine">Best score ${save.best.toLocaleString()}${save.bestTime ? ` · fastest to Bubbe's ${fmtTime(save.bestTime)}` : ""}</p>` : "";
    H.showScreen(`
        <div class="logo"><span class="l1">LULU'S</span><span class="l2">ROAD TRIP</span><span class="l3">3D · BETA</span></div>
        <p>Drive Lulu's <b>${skin.name}</b> convertible to <b>Bubbe's house</b> — dodge traffic, grab coins, mind the speed traps.</p>
        ${controllerLine()}
        ${best}`,
        [
            { label: `▶ DRIVE ${glyph("confirm")}`, cls: "", action: startIntro },
            { label: "🎮 Controls", cls: "alt", action: showControls },
            { label: `🚗 Car: ${skin.name}`, cls: "purple", id: "skinBtn", action: cycleSkin },
            { label: "← Back to the 2D game", cls: "pink", action: () => { location.href = "../"; } },
        ], { focus: refreshOnly ? H.currentFocus() : 0 });
}

function cycleSkin() {
    const keys = Object.keys(SKINS);
    const next = keys[(keys.indexOf(car.skinKey) + 1) % keys.length];
    car.setSkin(next);
    save.skin = next;
    writeSave();
    H.relabel("skinBtn", `🚗 Car: ${SKINS[next].name}`);
}

function showControls(back = goTitle) {
    H.showScreen(`<h2>Controls</h2>${controlsHtml()}
        <p class="fine">Works with Xbox, PlayStation, Switch Pro and most Bluetooth/USB controllers in Chrome, Edge, Safari and Firefox.
        On phones: steer with the left thumb, pedals on the right.</p>`,
        [{ label: `Got it ${glyph("confirm")}`, action: () => back() }], { onBack: () => back() });
}

function showPauseMenu() {
    H.showScreen(`<h2>Paused</h2>${controllerLine()}`, [
        { label: `▶ Resume`, action: resume },
        { label: `🎥 Camera: ${CAMS[camState.mode].name}`, id: "camBtn", cls: "alt", action: () => { cycleCam(); H.relabel("camBtn", `🎥 Camera: ${CAMS[camState.mode].name}`); } },
        { label: `🎵 Music: ${A.audio.musicOn ? "ON" : "OFF"}`, id: "musBtn", cls: "alt", action: () => { const on = A.toggleMusic(); save.music = on; writeSave(); H.relabel("musBtn", `🎵 Music: ${on ? "ON" : "OFF"}`); } },
        { label: "🎮 Controls", cls: "alt", action: () => showControls(showPauseMenu) },
        { label: "↺ Restart", cls: "pink", action: () => { H.hideScreen(); resetRun(); startIntro(); } },
        { label: "⌂ Title screen", cls: "purple", action: () => { resetRun(); goTitle(); } },
    ], { onBack: resume });
}

function pause() {
    if (state !== "playing" && state !== "intro") return;
    G.pausedFrom = state;
    state = "paused";
    A.sfxHorn(false);
    A.updateEngine(0, 0, 0, 0, false, false);
    A.duckMusic(0.12);
    showPauseMenu();
}
function resume() {
    H.hideScreen();
    state = G.pausedFrom || "playing";
    A.duckMusic(0.32);
}

function startIntro() {
    document.body.classList.remove("title-mode");
    A.unlockAudio();
    if (save.music !== A.audio.musicOn) A.toggleMusic();
    H.hideScreen();
    if (G.hearts <= 0 || G.arrived || car.s > 60) resetRun();
    state = "intro";
    G.stateT = 0;
    G.countdown = 3;
    H.showHud(true);
    H.showTouch(input.device === "touch" || coarse);
    refreshPrompts();
    A.setMusic("../luludriving.mp3");
    H.banner(`<b>3</b>`, 900);
}

function refreshPrompts() {
    H.setBoost(G.boost, input.device === "touch" ? "" : glyph("boost"));
    if (state === "playing" || state === "intro") H.showTouch(input.device === "touch");
}

function fmtTime(t) {
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
}

function statsHtml(extra = "") {
    const miles = (car.s / 1609).toFixed(2);
    return `<div class="stats">
        <div class="stat"><b>${Math.floor(G.score).toLocaleString()}</b><span>SCORE</span></div>
        <div class="stat"><b>${G.coins}</b><span>COINS</span></div>
        <div class="stat"><b>${miles}</b><span>MILES</span></div>
        <div class="stat"><b>${G.closeCalls}</b><span>CLOSE CALLS</span></div>
        ${extra}
    </div>`;
}

function gameOver() {
    state = "gameover";
    A.setMusic(null);
    A.updateEngine(0, 0, 0, 0, false, false);
    const newBest = G.score > save.best;
    if (newBest) save.best = Math.floor(G.score);
    save.totalCoins += G.coins;
    writeSave();
    H.showHud(false); H.showTouch(false);
    H.showScreen(`<h2>💥 Wrecked!</h2>
        <div class="quote">"Lulu, mamele… are you OK? Call me when you get there!" — Bubbe 📞</div>
        ${statsHtml()}
        ${newBest ? '<p><b>🏆 New best score!</b></p>' : `<p class="fine">Best: ${save.best.toLocaleString()}</p>`}`,
        [
            { label: `↺ Try again ${glyph("confirm")}`, action: () => { resetRun(); startIntro(); } },
            { label: "⌂ Title screen", cls: "alt", action: () => { resetRun(); goTitle(); } },
        ], { onBack: () => { resetRun(); goTitle(); } });
}

function arrive() {
    G.arrived = true;
    state = "arriving";
    G.stateT = 0;
    A.sfxFanfare();
    A.sfxHorn(false);
    rumble(0.4, 0.8, 500, true);
    H.banner(`🏡 <b>BUBBE'S HOUSE!</b>`, 2800);
    const bonus = 500 + G.hearts * 250;
    G.score += bonus;
    G.arriveBonus = bonus;
    for (let i = 0; i < 60; i++) {
        const cols = [[1, 0.25, 0.5], [1, 0.84, 0.25], [0.25, 0.77, 1], [0.7, 0.53, 1], [0.41, 0.94, 0.68]];
        car.fx.emit(car.pos.x + (Math.random() - 0.5) * 6, 3 + Math.random() * 3, car.pos.z + (Math.random() - 0.5) * 6,
            (Math.random() - 0.5) * 6, 4 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.5, 2.2, cols[i % cols.length]);
    }
}

function showArrival() {
    state = "arrivedScreen";
    const t = G.runTime;
    const fastest = !save.bestTime || t < save.bestTime;
    if (fastest) save.bestTime = t;
    save.arrivals++;
    if (G.score > save.best) save.best = Math.floor(G.score);
    writeSave();
    H.showTouch(false);
    H.showScreen(`<h2>🏡 You made it!</h2>
        <div class="quote">"LULULEH! You made it! Come, EAT — the cholent's hot! 🍲"</div>
        ${statsHtml(`<div class="stat"><b>${fmtTime(t)}</b><span>TIME${fastest ? " 🏆" : ""}</span></div>`)}
        <p>Arrival bonus <b>+${G.arriveBonus}</b> (${"❤️".repeat(G.hearts)} left${G.tickets ? `, ${G.tickets} speeding ticket${G.tickets > 1 ? "s" : ""} 🙈` : ""})</p>`,
        [
            { label: `🛣️ Keep cruising ${glyph("confirm")}`, action: () => { H.hideScreen(); G.cruise = true; state = "playing"; H.showTouch(input.device === "touch"); H.toast("Endless cruise — how far can you go?", "pink"); } },
            { label: "↺ Drive it again", cls: "alt", action: () => { resetRun(); startIntro(); } },
            { label: "⌂ Title screen", cls: "purple", action: () => { resetRun(); goTitle(); } },
        ]);
}

function cycleCam() {
    camState.mode = (camState.mode + 1) % CAMS.length;
    save.cam = camState.mode;
    writeSave();
    snapCamera();
}

// ── gameplay ────────────────────────────────────────────────────────────
function damage(power, why) {
    if (G.invT > 0 || state !== "playing") return;
    G.hearts--;
    G.crashes++;
    G.invT = 2.2;
    G.combo = 0;
    G.shake = 0.9;
    H.setHearts(G.hearts, MAX_HEARTS);
    H.flash();
    A.sfxCrash(Math.min(1.2, power));
    rumble(1, 1, 480, true);
    car.fx.burst(car.pos.x, 0.8, car.pos.z, 26, 6, [1, 0.8, 0.4], 0.5, 0.6);
    car.fx.burst(car.pos.x, 0.8, car.pos.z, 14, 2, [0.6, 0.6, 0.62], 1.6, 1.2);
    if (G.hearts <= 0) {
        state = "wrecked";
        G.stateT = 0;
        car.spin += (Math.random() < 0.5 ? -1 : 1) * 5;
        H.banner(`💥 <b>WRECKED!</b><small>${why || "Lulu's car has had enough"}</small>`, 2400);
        A.sfxHorn(false);
    } else {
        H.toast(`💥 ${QUIPS[Math.floor(Math.random() * QUIPS.length)]}`, "red");
    }
}

function closeCall(oncoming, clearance) {
    G.combo = G.comboT > 0 ? G.combo + 1 : 1;
    G.comboT = 3.5;
    G.closeCalls++;
    const pts = (oncoming ? 80 : 50) * G.combo;
    G.score += pts;
    G.boost = Math.min(1, G.boost + 0.14);
    A.sfxCloseCall(G.combo);
    rumble(0.2, 0.5, 90);
    H.toast(`${oncoming ? "😱 HEAD-ON DODGE" : "😎 CLOSE CALL"}${G.combo > 1 ? " ×" + G.combo : ""} +${pts}`, oncoming ? "pink" : "gold");
}

const tmpNear = {};
function updatePlaying(dt, P, controlsOn) {
    G.runTime += controlsOn ? dt : 0;
    const road = world.road;
    const near = road.nearest(car.pos.x, car.pos.z, car.s, tmpNear);
    car.s = near.s; car.d = near.d;
    const absd = Math.abs(near.d);
    const offroad = absd > SHOULDER ? Math.min(1, (absd - SHOULDER) / 1.2) : 0;
    const onShoulder = absd > HALF_ROAD - 0.2 && absd <= SHOULDER;

    // controls
    const ctl = controlsOn ? {
        steer: input.steer, throttle: input.throttle, brake: input.brake, handbrake: input.handbrake,
        analog: input.device !== "keyboard",
    } : { steer: 0, throttle: 0, brake: state === "arriving" ? 1 : 0.25, handbrake: false, analog: true };

    // nitro
    const wantBoost = controlsOn && input.boost;
    if (wantBoost && G.boost > 0.01 && (G.boosting || G.boost > 0.12)) {
        if (!G.boosting) { A.sfxBoost(); H.toast("🔥 NITRO!", "gold"); rumble(0.5, 0.6, 250, true); }
        G.boosting = true;
        G.boost = Math.max(0, G.boost - 0.3 * dt);
    } else {
        G.boosting = false;
        G.boost = Math.min(1, G.boost + 0.012 * dt);
    }
    car.boosting = G.boosting;

    // physics (sub-stepped)
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) car.step(dt / n, ctl, { offroad });
    // invisible fence far out in the fields
    if (absd > 70) {
        const push = (absd - 70) * Math.sign(near.d);
        car.pos.x -= -Math.cos(near.h) * push;
        car.pos.z -= Math.sin(near.h) * push;
    }

    // static obstacles
    for (const ch of world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - car.s) > 220) continue;
        for (const c of ch.colliders) {
            const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
            if (dx * dx + dz * dz > 64) continue;
            const imp = car.collideStatic(c.x, c.z, c.r);
            if (imp > 10) damage(imp / 20, c.kind === "tree" ? "Lulu vs. a tree: the tree won" : "That wasn't on the GPS");
            else if (imp > 2.5) { A.sfxBump(); rumble(0.6, 0.4, 160, true); G.shake = Math.max(G.shake, 0.3); }
        }
        // coins & hearts
        for (const coin of ch.coins) {
            if (coin.taken) continue;
            const dx = coin.x - car.pos.x, dz = coin.z - car.pos.z;
            if (dx * dx + dz * dz < 4.2) {
                coin.taken = true;
                G.coins += coin.value;
                G.score += 10 * coin.value;
                G.boost = Math.min(1, G.boost + 0.045 * coin.value);
                G.coinStreak = (G.coinStreakT > 0 ? (G.coinStreak || 0) + 1 : 0);
                G.coinStreakT = 0.8;
                A.sfxCoin(G.coinStreak);
                rumble(0, 0.25, 40);
                car.fx.burst(coin.x, 1.1, coin.z, 6, 2.5, [1, 0.85, 0.3], 0.35, 0.5);
                if (coin.value > 1) H.toast("+2 RISKY COIN!", "gold");
            }
        }
        for (const ht of ch.hearts) {
            if (ht.taken) continue;
            const dx = ht.x - car.pos.x, dz = ht.z - car.pos.z;
            if (dx * dx + dz * dz < 5) {
                ht.taken = true; ht.obj.visible = false;
                if (G.hearts < MAX_HEARTS) { G.hearts++; H.setHearts(G.hearts, MAX_HEARTS); H.toast("❤️ +1 HEART", "pink"); }
                else { G.score += 100; H.toast("❤️ +100", "pink"); }
                A.sfxCoin(10);
            }
        }
        // speed traps
        for (const t of ch.traps) {
            if (t.triggered || car.s < t.s || car.s > t.s + 40) continue;
            t.triggered = true;
            const mph = car.speed * MPH;
            if (mph > SPEED_TRAP_MPH && controlsOn) {
                G.tickets++;
                const fine = Math.min(G.coins, 25);
                G.coins -= fine;
                A.sfxSiren();
                rumble(0.3, 0.6, 300, true);
                H.toast(`📸 SPEEDING TICKET! ${Math.round(mph)} mph${fine ? ` −${fine} coins` : ""}`, "red");
            } else if (controlsOn) {
                G.score += 150;
                H.toast("👮 Nice and legal! +150", "gold");
            }
        }
    }
    G.coinStreakT = (G.coinStreakT || 0) - dt;

    // traffic
    const difficulty = Math.min(1, car.s / 9000);
    const honk = controlsOn && !!P.honk;
    const events = traffic.update(dt, car, car.s, car.d, difficulty, honk, G.time);
    for (const e of events) {
        if (e.type === "crash") {
            if (e.impact > 6.5) damage(e.impact / 16, e.oncoming ? "Head-on? REALLY, Lulu?" : "Tailgating doesn't pay");
            else if (e.impact > 1.5) { A.sfxBump(); rumble(0.5, 0.5, 150, true); G.shake = Math.max(G.shake, 0.25); }
        } else if (e.type === "nearMiss" && controlsOn && G.invT <= 0) closeCall(e.oncoming, e.clearance);
        else if (e.type === "moved") H.toast("📣 Move it, buddy!", "");
        else if (e.type === "oncomingHonk") { /* the honk you hear is their horn */ honkFromAfar(e.dist); }
    }
    if (honk) rumble(0.1, 0.3, 120);

    // score for distance
    const ds = car.s - G.lastS;
    if (ds > 0 && controlsOn) G.score += ds * (G.boosting ? 1.5 : 1);
    G.lastS = Math.max(G.lastS, car.s);
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
    G.invT = Math.max(0, G.invT - dt);

    // Bubbe's coming up
    if (!G.arrived && !G.aheadShown && GOAL - car.s < 450) {
        G.aheadShown = true;
        H.banner(`🏡 <b>Bubbe's house ahead!</b><small>Pull in under the balloons</small>`, 2600);
    }
    if (!G.arrived && car.s >= GOAL && controlsOn) arrive();

    // feel: rumble strips + grass + nitro
    if (onShoulder && car.speed > 8 && controlsOn) rumble(0.05, 0.35, 110);
    else if (offroad > 0 && car.speed > 4) rumble(0.25 * offroad, 0.45, 120);
    else if (G.boosting) rumble(0.12, 0.3, 120);
    if (controlsOn && ctl.brake > 0.6 && car.vF > 12) triggerRumble(0.5, 0, 90);

    A.updateEngine(car.vF, controlsOn ? ctl.throttle : 0, car.slip, offroad + (onShoulder && car.speed > 8 ? 0.4 : 0), G.boosting, true);
    A.sfxHorn(controlsOn && input.honkHeld);

    car.updateVisual(dt, G.time, ctl, G.invT > 0);
}

let farHonkT = 0;
function honkFromAfar(dist) {
    if (G.time < farHonkT) return;
    farHonkT = G.time + 1.5;
    A.sfxCloseCall(-4);
    H.toast("🚨 WRONG LANE, LULU!", "red");
    rumble(0.2, 0.5, 150);
}

// ── camera ──────────────────────────────────────────────────────────────
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function wrapAngle(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }

function snapCamera() {
    camState.yaw = car ? car.h : 0;
    camState.snap = true;
}

function updateCamera(dt) {
    const cfg = CAMS[camState.mode];
    // right stick look (springs back when released)
    const lx = input.lookX, ly = input.lookY;
    camState.lookYaw += ((lx ? -lx * 2.2 : 0) - camState.lookYaw) * Math.min(1, dt * (lx ? 6 : 3));
    camState.lookPitch += ((ly ? ly * 0.5 : 0) - camState.lookPitch) * Math.min(1, dt * (ly ? 6 : 3));
    const back = input.lookBack && state === "playing" ? Math.PI : 0;

    // portrait screens: pull back a bit so you can see the road
    const portrait = camera.aspect < 1;
    const sp = car.speed;
    const shake = G.shake;
    G.shake = Math.max(0, G.shake - dt * 1.8);

    if (state === "arriving") {
        if (!camState.arrive) {
            const road = world.road;
            // from just before the arch: banner, Bubbe's house on the right, Lulu pulling up
            const p = road.point(GOAL - 20, -7, {});
            const t = road.point(GOAL + 8, 9, {});
            camState.arrive = new THREE.Vector3(p.x, 5.2, p.z);
            camState.arriveLook = new THREE.Vector3(t.x, 2.6, t.z);
        }
        // slow dolly in
        camState.arrive.lerp(camState.arriveLook, dt * 0.06);
        camState.pos.lerp(camState.arrive, Math.min(1, dt * 1.6));
        camera.position.copy(camState.pos);
        camera.lookAt(camState.arriveLook);
        camera.fov += (50 - camera.fov) * Math.min(1, dt * 2);
        camera.updateProjectionMatrix();
        return;
    }
    camState.arrive = null;

    if (state === "title") {
        // slow orbit around the car
        camState.orbit += dt * (state === "title" ? 0.18 : 0.45);
        const a = car.h + Math.PI * 0.75 + camState.orbit;
        const dist = state === "title" ? 8.5 : 9.5;
        _v.set(car.pos.x + Math.sin(a) * dist, 2.3 + Math.sin(camState.orbit * 0.7) * 0.6, car.pos.z + Math.cos(a) * dist);
        camState.pos.lerp(_v, camState.snap ? 1 : Math.min(1, dt * 2));
        camera.position.copy(camState.pos);
        camera.lookAt(car.pos.x, 1.0, car.pos.z);
        // wide screens: the menu sits on the left, so frame the car on the right
        if (camera.aspect > 1.25) camera.rotateY(0.3);
        camera.fov += (55 - camera.fov) * Math.min(1, dt * 2);
        camState.snap = false;
        camera.updateProjectionMatrix();
        return;
    }

    if (cfg.fp) {
        // Lulu's eyes: ride along in the driver's seat, with the car's pitch and roll
        car.tilt.updateMatrixWorld(true);
        _v.set(0.38, 1.68, -0.06);
        car.tilt.localToWorld(_v);
        camera.position.copy(_v);
        const yaw = car.h + camState.lookYaw + back;
        _w.set(Math.sin(yaw), -0.035 - camState.lookPitch * 0.6, Math.cos(yaw));
        _w.applyAxisAngle(new THREE.Vector3(Math.sin(car.h), 0, Math.cos(car.h)), -car.roll * 1.2);
        camera.up.set(-Math.cos(car.h) * car.roll * 1.2, 1, Math.sin(car.h) * car.roll * 1.2).normalize();
        camera.lookAt(_v.add(_w));
        camera.up.set(0, 1, 0);
        const fov = cfg.fov + sp * 0.22 + (G.boosting ? 9 : 0) + (portrait ? 14 : 0);
        camera.fov += (fov - camera.fov) * Math.min(1, dt * 4);
        if (shake > 0) camera.position.add(_w.set((Math.random() - 0.5) * shake * 0.12, (Math.random() - 0.5) * shake * 0.12, 0));
        camera.updateProjectionMatrix();
        camState.yaw = car.h;
        camState.pos.copy(camera.position);
        return;
    }

    // chase: follow the direction of travel when drifting, so slides look great
    let desiredYaw = car.h;
    if (sp > 4 && car.vF > 0) {
        const velYaw = Math.atan2(car.vx, car.vz);
        desiredYaw = car.h + wrapAngle(velYaw - car.h) * 0.55;
    }
    camState.yaw += wrapAngle(desiredYaw - camState.yaw) * Math.min(1, dt * 5);
    const yaw = camState.yaw + camState.lookYaw + back;
    const dist = cfg.dist * (portrait ? 1.25 : 1) + (G.boosting ? 1.2 : 0) + Math.min(sp, 45) * 0.025;
    const height = cfg.height * (portrait ? 1.25 : 1) + camState.lookPitch * 3;
    _v.set(car.pos.x - Math.sin(yaw) * dist, height, car.pos.z - Math.cos(yaw) * dist);
    if (camState.snap) camState.pos.copy(_v); else camState.pos.lerp(_v, Math.min(1, dt * 9));
    camState.snap = false;
    camera.position.copy(camState.pos);
    if (shake > 0) camera.position.add(_w.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.6, (Math.random() - 0.5) * shake));
    // a whisper of road-feel at speed
    camera.position.y += car.bump * 0.6;
    _w.set(car.pos.x + Math.sin(yaw) * 4, cfg.look, car.pos.z + Math.cos(yaw) * 4);
    camera.lookAt(_w);
    const fov = cfg.fov + Math.min(sp, 50) * 0.3 + (G.boosting ? 10 : 0) + (portrait ? 16 : 0);
    camera.fov += (fov - camera.fov) * Math.min(1, dt * 3);
    camera.updateProjectionMatrix();
}

// ── main loop ───────────────────────────────────────────────────────────
let last = performance.now();
let perf = { t: 0, frames: 0, slow: 0 };
const stats = { frames: 0 };

function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;      // below 20 fps the game slows down rather than tunnelling
    if (TEST) dt = 1 / 30;         // smoke test: deterministic game time per frame
    if (dt <= 0) return;
    G.time += dt;
    G.stateT += dt;
    stats.frames++;

    updateInput(dt);
    const P = input.pressed;
    if ((P.confirm || P.start || P.honk) && !A.ready) A.unlockAudio();
    if (P.music) { const on = A.toggleMusic(); save.music = on; writeSave(); H.toast(on ? "🎵 Music on" : "🔇 Music off"); }

    switch (state) {
        case "title": {
            H.menuInput(P);
            // attract mode: Lulu cruises down her lane on autopilot behind the menu
            autopilot(dt);
            break;
        }
        case "intro": {
            if (P.pause) { pause(); break; }
            const prev = G.countdown;
            G.countdown = 3 - Math.floor(G.stateT / 0.8);
            if (G.countdown !== prev && G.countdown > 0) { H.banner(`<b>${G.countdown}</b>`, 700); A.sfxCloseCall(0); rumble(0.1, 0.2, 80); }
            if (G.stateT >= 2.4) {
                state = "playing";
                H.banner(`<b>GO!</b><small>Bubbe's house · 3 miles</small>`, 1200);
                A.sfxCloseCall(6);
                rumble(0.3, 0.6, 200, true);
            }
            updatePlaying(dt, {}, false);
            if (P.camera) cycleCam();
            break;
        }
        case "playing": {
            if (P.pause) { pause(); break; }
            if (P.camera) { cycleCam(); H.toast("🎥 " + CAMS[camState.mode].name); }
            updatePlaying(dt, P, true);
            break;
        }
        case "wrecked": {
            updatePlaying(dt, {}, false);
            if (G.stateT > 2.6) gameOver();
            break;
        }
        case "arriving": {
            updatePlaying(dt, {}, false);
            if (G.stateT > 3.6 || (G.stateT > 1.2 && (P.confirm || P.start))) showArrival();
            break;
        }
        case "paused": case "gameover": case "arrivedScreen": {
            H.menuInput(P);
            break;
        }
    }

    if (state !== "loading") {
        world.update(dt, car.s, camera.position);
        updateCamera(dt);
        sun.position.copy(car.pos).add(SUN_OFF);
        sun.target.position.copy(car.pos);
        animateCops();
        updateHud();
        renderer.render(scene, camera);
        adaptQuality(dt);
    }
}

function autopilot(dt) {
    const road = world.road;
    const near = road.nearest(car.pos.x, car.pos.z, car.s, tmpNear);
    car.s = near.s; car.d = near.d;
    const tgt = road.point(car.s + 16, 1.75, {});
    const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z);
    const diff = wrapAngle(want - car.h);
    const ctl = { steer: THREE.MathUtils.clamp(-diff * 3, -1, 1), throttle: car.speed < 19 ? 0.6 : 0, brake: 0, handbrake: false, analog: true };
    car.boosting = false;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) car.step(dt / n, ctl, { offroad: 0 });
    car.updateVisual(dt, G.time, ctl, false);
    // loop the attract run so it never strays far from the start
    if (car.s > 2600) { resetRun(); }
}

let copMats = null;
function animateCops() {
    if (!copMats) {
        copMats = [];
        models.cop.traverse(o => { if (o.isMesh && /LightRed|LightBlue/.test(o.material.name)) copMats.push(o.material); });
    }
    const on = Math.floor(G.time * 6) % 2;
    for (const m of copMats) m.emissiveIntensity = (m.name === "LightRed") === !!on ? 6 : 0.3;
}

function updateHud() {
    if (state !== "playing" && state !== "intro" && state !== "arriving" && state !== "wrecked") return;
    H.setSpeed(car.speed * MPH);
    H.setCoins(G.coins);
    H.setScore(G.score);
    H.setBoost(G.boost);
    if (G.arrived || G.cruise) {
        H.setTrip(1, `ENDLESS CRUISE · ${(car.s / 1609).toFixed(1)} mi`);
    } else {
        const rem = Math.max(0, GOAL - car.s);
        H.setTrip(car.s / GOAL, `BUBBE'S HOUSE · ${(rem / 1609).toFixed(1)} mi`);
    }
    let hint = "";
    if (state === "playing" && !TEST) {
        // Browsers don't count controller buttons as a "user gesture", so sound
        // can't start until there's one click / tap / key press.
        if (!A.audio.ready && input.device === "gamepad") hint = "🔇 Click or tap the screen once to turn the sound on";
        else if (G.runTime < 9 && input.device === "gamepad") {
            hint = `${glyph("gas")} gas · ${glyph("brake")} brake · ${glyph("handbrake")} drift · ${glyph("boost")} nitro · ${glyph("honk")} horn · ${glyph("camera")} camera`;
        } else if (G.runTime < 9 && input.device === "keyboard") {
            hint = `${glyph("gas")} gas · ${glyph("brake")} brake · ${glyph("steer")} steer · ${glyph("boost")} nitro · ${glyph("honk")} horn · ${glyph("camera")} camera`;
        }
    }
    H.padHint(hint);
}

// Drop the resolution a notch on slow devices so it stays smooth.
function adaptQuality(dt) {
    perf.t += dt; perf.frames++;
    if (perf.t < 2) return;
    const fps = perf.frames / perf.t;
    perf.t = 0; perf.frames = 0;
    if (fps < 40 && pixelRatio > 1) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        resize();
    }
}

document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
document.getElementById("pauseBtn").addEventListener("click", () => { A.unlockAudio(); pause(); });
window.addEventListener("pointerdown", () => A.unlockAudio(), { once: false, passive: true });
window.addEventListener("keydown", () => A.unlockAudio(), { passive: true });

// test hook for scripts/smoke3d.js
window.__lulu3d = {
    get state() { return state; },
    get car() { return car; }, get world() { return world; }, get traffic() { return traffic; },
    get game() { return G; }, get frames() { return stats.frames; },
    start: () => startIntro(),
    renderer,
};

boot();
