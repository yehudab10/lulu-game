// Lulu's Road Trip 3D — the game: renderer, boot + main loop. Loaded by
// main.js once WebGL is known to work. Game rules live in core/ (driving,
// screens, camera…) and features/ (journey, law, garage, on foot, Dina…).
import * as THREE from "three";
import { ctx, emit, on, setState, setChromeHandler, trackCamera, syncAllCameras, runHooks } from "./core/ctx.js";
import { save3d, shared, wallet } from "./core/save.js";
import { loadModels, safeCompileAsync } from "./models.js";
import { World } from "./world.js";
import { PlayerCar, SKINS } from "./car.js";
import { Traffic } from "./traffic.js";
import { input, updateInput, bindTouch, refreshTouchButtons, glyph } from "./input.js";
import * as A from "./audio.js";
import * as H from "./hud.js";
import { cam } from "./core/camera.js";
import { dialogUpdate, setDialogGlyph } from "./core/dialog.js";
import { skipInput, skipping, skipBefore, skipAfter, FF_DT, FF_STEPS } from "./core/skip.js";
import { pause, applyUiSettings, openMenuItem, revealMenuItem, titleLabels, openView, titleView } from "./core/screens.js";
import { resetRun, startRun, endRun, damage, addCoins, KO } from "./core/driving.js";
import { applyTvMode, detectPlatform } from "./core/platform.js";
import { gfx, resolveTier, adaptFrame } from "./core/quality.js";
import { updateLods, LOD, installShadowProxies } from "./lod.js";
import { gfxFrame } from "./core/gfx.js";
import { Post } from "./core/post.js";
import { TC, mode as testMode, afterStep as testAfterStep, beforeStep as testBeforeStep, timers as testTimers, idle as testIdle, realNow as testRealNow, runAdd, setGate, gateHit, clearGate } from "./core/testclock.js";
import "./core/player.js";            // ONE player identity (ctx.player): friends + the property registry
import "./features/index.js";

const _rh = {};          // (scratch: the road heading under her, for the world's streaming direction)
let _backT = 0;          // (s of steady travel down the lap)
const MPH = 2.23694;

// ── renderer / scene ────────────────────────────────────────────────────
const canvas = document.getElementById("scene");
const platform = detectPlatform();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !platform.console, powerPreference: "high-performance" });
ctx.renderer = renderer;
// the renderer's own render, before anything wraps it: helper passes (bloom, the reflection map) use it so
// whatever counts renderer.render calls (tests, the perf harness) sees only the game's scene renders
const rawRender = renderer.render;
ctx.rawRender = (s, c) => rawRender.call(renderer, s, c);
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
installShadowProxies(renderer);      // (MEDIUM / HIGH: a car casts its shadow in one draw — lod.js › shadow proxies)
safeCompileAsync(renderer);          // (compileAsync that survives a material disposed while it polls — models.js)
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

/** The graphics tier (core/quality.js) → renderer, shadows, LOD distance, draw distance. */
let post = null;
function applyGraphics() {
    const T = resolveTier(renderer, platform).T;
    renderer.setPixelRatio(gfx.pixelRatio * TC.scale);     // (TC.scale: 1, or a test's smaller canvas — core/testclock.js)
    if (renderer.shadowMap.enabled !== T.shadows) {
        renderer.shadowMap.enabled = T.shadows;
        scene.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });   // (shadow code in / out of the shaders)
    }
    const size = T.shadowSize || 1024;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    const box = T.shadowBox || SH;
    if (sun.shadow.camera.right !== box) { Object.assign(sun.shadow.camera, { left: -box, right: box, top: box, bottom: -box }); sun.shadow.camera.updateProjectionMatrix(); }
    LOD.dist = T.lod;
    if (ctx.world) ctx.world.drawScale = T.draw;
    // HIGH: the bloom (core/post.js). A ?test run opts in with &enable=bloom (gfx, perf): in software WebGL it
    // nearly doubles the frame time, which only slows every other test down
    const wantPost = T.post && Post.supported(renderer) && ctx.enabled("bloom");
    if (wantPost && !post) post = new Post(renderer, rawRender);
    else if (!wantPost && post) { post.dispose(); post = null; }
    gfx.bloom = !!post;
    emit("gfx", { tier: gfx.tier });
}
function applySettings() {
    const S = save3d.settings;
    applyGraphics();
    input.rumbleOn = S.vibration !== false;
    applyTvMode(S.tv === "on" || (S.tv === "auto" && (platform.tv || platform.console)));
    document.documentElement.style.setProperty("--hud-scale", S.hud || 1);
    applyUiSettings();
    A.setMuted(save3d.sound === false);
    resize();
}
ctx.applySettings = applySettings;
ctx.platform = platform;

function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    syncAllCameras();
}
// (a rotation / window resize empties the canvas too: draw it again at once rather than show it blank until the next frame)
window.addEventListener("resize", () => { resize(); try { if (ctx.world && ctx.car) present(0); } catch (e) { /* next frame draws */ } });

// HUD + touch controls follow the current state
const IN_PLAY = new Set(["playing", "footRun", "arriving", "parking"]);   // free driving / walking (the 🅿️ challenge too: driving on a lot): pop-ups stay off the road
setChromeHandler(def => {
    document.body.classList.toggle("in-play", IN_PLAY.has(ctx.state));
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
    ctx.world.drawScale = gfx.T.draw;
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
    document.body.classList.toggle("dev-touch", input.device === "touch");
    input.onDeviceChange = d => {
        document.body.classList.toggle("dev-touch", d === "touch");      // menus drop the button-glyph pills for fingers
        H.setBoost(ctx.G.boost || 0, d === "touch" ? "" : glyph("boost"));
        const def = ctx.states[ctx.state];
        if (def) H.showTouch(!!def.touch && d === "touch");
        emit("device", { device: d });
    };
    requestAnimationFrame(loop);
}

// ── main loop ───────────────────────────────────────────────────────────
let last = performance.now();

function loop(now) {
    requestAnimationFrame(loop);
    const t0 = performance.now(), interval = now - last;
    let dt = interval / 1000;
    last = now;
    // An AD is on screen (iOS app — features/native/ads.js sets ctx.hold): the whole game stands still — no game time,
    // no state update (scripts waiting on game time wait), no traffic, no world, no render — and picks up exactly here.
    if (ctx.hold) { if (TC.on) testIdle(); return; }
    if (dt > 0.05) dt = 0.05;           // below 20 fps the game slows down rather than tunnelling
    if (ctx.TEST) dt = 1 / 30;          // smoke test: deterministic game time per frame
    if (dt <= 0) return;
    if (TC.on) { testFrame(dt); return; }   // (?test + the harness's fast clock only — core/testclock.js)

    const P = frameInput(dt);
    if (skipping()) { fastForward(P); return; }
    applyGfxPending();                  // (AUTO graphics: a new resolution / tier, right before this frame is drawn)
    step(dt, P);
    present(dt);
    if (!ctx.TEST && !ctx.paused && !document.hidden) adaptQuality(interval, performance.now() - t0);
}

/** The start of every frame: count it, read the controls, the 🎵 key, the ⏭ pill. */
function frameInput(dt) {
    ctx.frames++;
    updateInput(dt);
    const P = input.pressed;
    if ((P.confirm || P.start || P.honk) && !A.audio.ready) A.unlockAudio();
    if (P.music) { save3d.music = A.toggleMusic(); H.toast(save3d.music ? "🎵 Music on" : "🔇 Music off"); }
    skipInput(dt);                      // the ⏭ pill (hold ○/B, Backspace, or click it)
    return P;
}

/** ?test's FAST TEST CLOCK (core/testclock.js). Still ONE fixed 1/30 s step per browser frame (so every rAF, timer and
 *  microtask lands where it always did), but: the picture is drawn only every TC.every-th frame (on a small canvas),
 *  between the harness's waits the game keeps the old clock's pace (one step per TC.idleMs of real time), and a
 *  harness gate that has been hit holds the game still until the harness lets go. */
let stepping = false;
async function testFrame(dt) {
    if (stepping) return;
    const m = testMode();
    if (m === "hold") return;
    if (m === "idle") { const r = testRealNow(); if (r - TC.idleAt < TC.idleMs) return; TC.idleAt = r; }
    stepping = true;
    try {
        if (TC.restore) TC.restore();   // (a full-size picture drawn for a check / a screenshot: back to the small canvas)
        testBeforeStep();               // (the page's clock: one frame later)
        const P = frameInput(dt);
        if (skipping()) { await fastForward(P); TC.drawn = ctx.frames; }
        else {
            applyGfxPending();
            step(dt, P);
            const draw = ++TC.k >= TC.every;
            if (draw) { TC.k = 0; TC.drawn = ctx.frames; TC.renders++; }
            present(dt, draw);
        }
        for (let k = 0; k < 8; k++) await null;
        await testTimers();             // (the page's timers that came due this frame)
        testAfterStep();                // (after the scripts' microtasks: the same settled state a poll between frames saw)
    } catch (e) {
        console.error("Lulu3D frame error", e);
    } finally {
        stepping = false;
    }
}
/** Tests: one full-size picture right now (screenshots / visual checks under the fast clock), then back. */
function realFrame() {
    if (!ctx.world || !ctx.car) return false;
    const sc = TC.scale;
    if (sc !== 1) renderer.setPixelRatio(gfx.pixelRatio);
    present(0);
    if (sc !== 1) TC.restore = () => { renderer.setPixelRatio(gfx.pixelRatio * TC.scale); TC.restore = null; };
    return true;
}

/** One step of game time: input → the current state → world + camera → HUD. */
function step(dt, P) {
    ctx.time += dt;
    ctx.stateT += dt;
    const def = ctx.states[ctx.state];
    try {
        if (ctx.dialogOpen) { dialogUpdate(dt, P); P = {}; }
        if (ctx.paused) {
            H.menuInput(P);
        } else if (def) {
            if (P.pause && (def.pausable || ctx.pauseHatch)) pause();     // (pauseHatch: a scene that has hung — features/unstuck)
            else {
                if (P.camera && def.driving && !def.camera) H.toast("🎥 " + cam.cycle());   // (a cutscene runs its own camera)
                if (def.update) def.update(dt, P);
            }
        }
    } catch (e) {
        console.error("Lulu3D frame error", e);
    }
    runHooks("tick", dt);               // (cheap per-frame accumulators: features/unstuck checks every 0.5 s)

    const cur = ctx.states[ctx.state] || def;
    if (!ctx.view && ctx.world) {
        if (cur && cur.world !== false) {
            // (which way she's travelling along the road — the world streams its chunks that way: ci/twoway, the far
            //  carriageway is drivable both ways; a moment's stop keeps the last direction)
            const w = ctx.world, c = ctx.car;
            // (down the lap only after 2 s of steady travel that way — reversing in a bay, a ramp's bend or a drift never
            //  flips it; any real speed up the lap flips it straight back)
            if (w.road && w.road.at && c && !w.district) {
                const rh = w.road.at(c.s, _rh).h, v = (c.vx || 0) * Math.sin(rh) + (c.vz || 0) * Math.cos(rh);
                const facingDown = Math.sin(c.h) * Math.sin(rh) + Math.cos(c.h) * Math.cos(rh) < -0.3;      // (reversing never counts)
                if (v > 3) { _backT = 0; w.dir = 1; }
                else if (v < -6 && facingDown) { _backT += dt; if (_backT > 2) w.dir = -1; }
                else _backT = 0;
            }
            w.update(dt, ctx.car.s, camera.position);
        }
        try { cam.update(dt); } catch (e) { console.error("Lulu3D camera error", e); }
        placeSun(ctx.car.pos);
    }
    if (cur && cur.hud) updateHud(dt);
    H.notifyTick(dt);
}

/** The sun's shadow box follows Lulu, snapped to whole shadow-map texels (no shimmering edges as she drives). */
const _ld = new THREE.Vector3(), _lr = new THREE.Vector3(), _lu = new THREE.Vector3(), _sp = new THREE.Vector3(), _UPV = new THREE.Vector3(0, 1, 0);
function placeSun(p) {
    const off = ctx.lights.sunOffset;
    _ld.copy(off).normalize();
    _lr.crossVectors(_ld, _UPV);
    if (_lr.lengthSq() < 1e-6) _lr.set(1, 0, 0);
    _lr.normalize();
    _lu.crossVectors(_lr, _ld).normalize();
    const texel = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
    const a = p.dot(_lr), b = p.dot(_lu);
    _sp.copy(p).addScaledVector(_lr, Math.round(a / texel) * texel - a).addScaledVector(_lu, Math.round(b / texel) * texel - b);
    sun.position.copy(_sp).add(off);
    sun.target.position.copy(_sp);
}

/** Draw the frame. `draw` false (only ?test's fast clock, core/testclock.js): everything a frame does but the draw
 *  call itself — the LODs, the prerender hooks, gfx, audio, the touch buttons. */
function present(dt, draw = true) {
    refreshTouchButtons();
    const v = ctx.view;
    if (v) { if (draw) (post || renderer).render(v.scene, v.camera); }
    else {
        updateLods(camera);
        runHooks("prerender", dt, camera);   // (features that pack what's in view right before the draw: atmos' street lamps)
        gfxFrame(dt, camera);           // contact shadows, wind, reflections, exposure (core/gfx.js)
        // LOW pulls the fog in to match its shorter draw distance (whoever set the fog this frame keeps their numbers)
        const fog = scene.fog, k = gfx.T.draw;
        let fn = 0, ff = 0;
        if (draw) {
            if (fog && k < 1) { fn = fog.near; ff = fog.far; fog.near = fn * k; fog.far = ff * k; }
            (post || renderer).render(scene, camera);
            if (fog && k < 1) { fog.near = fn; fog.far = ff; }
        }
    }
    // positional audio follows the camera that just rendered (silent behind a set, paused or skipping)
    A.spatial.update(dt, camera, ctx.car ? ctx.car.pos : null, !v && !ctx.paused && !ctx.skipping);
}

/** ⏭ Skipping a cutscene: many game-time steps this frame, letting the scene's async
 *  scripts take their next beat between steps (they continue on microtasks). */
async function fastForward(P) {
    const t0 = performance.now();
    try {
        for (let i = 0; i < FF_STEPS; i++) {
            if (!skipBefore()) break;
            step(FF_DT, i ? {} : P);
            for (let k = 0; k < 8; k++) await null;
            if (!skipAfter(FF_DT)) break;
            if (!ctx.TEST && performance.now() - t0 > 14) break;
        }
    } catch (e) {
        console.error("Lulu3D skip error", e);
    }
    present(FF_DT);
}

// The trip bar on the open highway (no story / town trip): the next place on the lap and how far — in plain words
// (ci/hud: it said "CRUISE · 0.0 mi" on a full bar). The bar fills from the last place to the next one.
const NP = { t: -1, v: null };
function nextPlace(s) {
    if (NP.v && Math.abs(ctx.time - NP.t) < 0.25) return NP.v;
    const LAP = 16000, mod = x => ((x % LAP) + LAP) % LAP, here = mod(s), pts = [];
    try { const T = ctx.town; if (T && T.exits) for (const e of T.exits) { const k = mod(e.s); const p = pts.find(q => Math.abs(q.s - k) < 5);
        if (p) { if (!p.names.includes(e.name)) p.names.push(e.name); } else pts.push({ s: k, names: [e.name], kind: "exit" }); } } catch (e) { /* no towns */ }
    try { if (ctx.exits && ctx.exits.rests) for (const r of ctx.exits.rests) pts.push({ s: mod(r.s), kind: "rest" }); } catch (e) { /* no rest areas */ }
    // ✈ the JFK exit (features/airport — its own EXIT 12 boards count down to it: the trip bar used to skip it)
    try { const ap = ctx.airport && ctx.airport.on && ctx.airport.planned; if (ap) pts.push({ s: mod(ap.s), names: [ap.name], kind: "exit" }); } catch (e) { /* no airport */ }
    let v;
    if (!pts.length) v = { frac: here / LAP, label: "On the highway" };
    else {
        // (heading DOWN the lap — the far carriageway, ci/twoway: the next place is the one behind in lap terms, and its
        //  exit is on the other side of the road for now)
        const down = ctx.world && ctx.world.dir === -1;
        const fwd = p => (down ? mod(here - p.s) : mod(p.s - here)), bwd = p => (down ? mod(p.s - here) : mod(here - p.s));
        const ahead = p => { const a = fwd(p); return a < 60 ? a + LAP : a; };      // (one she's passing now: the next lap's)
        pts.sort((a, b) => ahead(a) - ahead(b));
        const nx = pts[0], a = ahead(nx), back = pts.reduce((m, p) => Math.min(m, bwd(p)), LAP), gap = Math.max(1, a + back);
        const mi = a / 1609, far = mi < 0.1 ? "now" : `in ${mi.toFixed(1)} mi`;
        const name = nx.kind === "rest" ? "Rest area" : nx.names.join(" & ");
        v = { frac: Math.max(0, Math.min(1, 1 - a / gap)), label: down ? `${nx.kind === "rest" ? "🅿️" : "🛣️"} ${name} ${far} · exit on the other side`
            : nx.kind === "rest" ? `🅿️ Rest area ${far}` : `🛣️ ${name} exit ${far}` };
    }
    NP.t = ctx.time; NP.v = v;
    return v;
}

// The coin counter on screen is her WALLET — every coin she has, the same number the shops and the title show — not
// "coins picked up this drive" (G.coins, which restarts at 0 and made a player think the game forgot her coins).
// Reading the wallet parses the save, so it's cached and re-read only when it changes (+ once a second as a net).
let walletShown = -1, walletAt = -1e9;
on("wallet", () => { walletShown = -1; });
on("shared:changed", () => { walletShown = -1; });
function walletCoins() {
    const now = performance.now();
    if (walletShown < 0 || now - walletAt > 1000) { walletShown = Math.floor(wallet.coins); walletAt = now; }
    return walletShown;
}

function updateHud(dt) {
    const G = ctx.G, car = ctx.car;
    H.setSpeed(car.speed * MPH);
    H.setCoins(walletCoins());
    H.setScore(G.score);
    H.setBoost(G.boost);
    // (a trip label of null = the open road: the next exit + how far; ctx.trip.prio = how much it matters on a phone's
    // objective line — a town's street name a little less than Ima's list, a story leg / the Shabbos countdown more)
    const tl = ctx.trip ? ctx.trip.label() : null;
    if (tl == null) { const n = nextPlace(car.s); H.tripPrio(0); H.setTrip(n.frac, n.label); }
    else { H.tripPrio(ctx.trip.prio != null ? ctx.trip.prio : H.OBJ.list - 1); H.setTrip(ctx.trip.progress(), tl); }
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

// AUTO graphics: slide the resolution to hold 60 fps, and step down a tier if that isn't enough (core/quality.js).
// The change itself waits for the START of the next frame, so the frame is drawn right after it, in the same task:
// resizing a WebGL canvas empties it, and a canvas resized AFTER its frame was drawn is shown empty until the next
// one — on an iPhone that is a white flash, every time AUTO slid the resolution.
let gfxPending = null;
function adaptQuality(intervalMs, workMs) {
    if (ctx.skipping) return;
    const r = adaptFrame(intervalMs, workMs);
    if (r) gfxPending = r === "tier" || gfxPending === "tier" ? "tier" : "res";
}
function applyGfxPending() {
    const r = gfxPending;
    if (!r) return;
    gfxPending = null;
    if (r === "res") { renderer.setPixelRatio(gfx.pixelRatio * TC.scale); resize(); }
    else applySettings();
}
/** Tests: AUTO asked for a change ("res" / "tier") — it lands at the top of the next frame. */
ctx.gfxDebug = { queue(r) { gfxPending = r; return true; }, get pending() { return gfxPending; } };

document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
document.getElementById("pauseBtn").addEventListener("click", () => { A.unlockAudio(); pause(); });
window.addEventListener("pointerdown", () => A.unlockAudio(), { passive: true });
window.addEventListener("keydown", () => A.unlockAudio(), { passive: true });
// iOS (Safari + the app's WKWebView) only counts touchend / click as the gesture that may
// start audio — and after a phone call, an ad or the app going to the background its
// AudioContext comes back "interrupted": the next touch resumes it.
window.addEventListener("touchend", () => A.unlockAudio(), { passive: true });
window.addEventListener("click", () => A.unlockAudio(), { passive: true });
document.addEventListener("visibilitychange", () => { if (!document.hidden && A.audio.started) A.unlockAudio(); });

// test hook for scripts/smoke3d.js
window.__lulu3d = {
    ctx, setState, startRun, resetRun, endRun, damage, addCoins, emit, on, input, wallet, KO,
    get state() { return ctx.state; },
    get car() { return ctx.car; }, get world() { return ctx.world; }, get traffic() { return ctx.traffic; },
    get game() { return ctx.G; }, get frames() { return ctx.frames; },
    start: (mode = "story") => startRun({ mode }),
    // menus: reach any title / pause item, even one tucked into a sub-menu
    openMenuItem, revealMenuItem, titleLabels, openView, get titleView() { return titleView(); }, H,
    renderer, gfx,
    // the fast test clock (core/testclock.js): is it on · gates · one real frame for a screenshot (then restore)
    get fast() { return TC.on; }, TC, setGate, gateHit, clearGate, runAdd, realFrame,
    /** fast clock: draw the frame now, for a check that reads the picture right after (always: a frame drawn in an
     *  earlier browser frame has been shown, and a shown WebGL picture is gone from the canvas's buffer) */
    drawNow() {
        if (!ctx.world || !ctx.car) return true;
        // (at FULL size: on the small canvas a close wall loses its texture and reads as one flat colour — qa7's flat
        //  check. Back to the small canvas on the next frame)
        if (TC.scale !== 1 && !TC.restore) { renderer.setPixelRatio(gfx.pixelRatio); TC.restore = () => { renderer.setPixelRatio(gfx.pixelRatio * TC.scale); TC.restore = null; }; }
        present(0, true); TC.drawn = ctx.frames;
        return true;
    },
    get drawnFrame() { return TC.drawn; },
    afterShot() { if (TC.restore) TC.restore(); return true; },
};

boot();
