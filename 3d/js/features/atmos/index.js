// features/atmos — ATMOSPHERE: time of day, weather and ambient life.
//
//   🌅 Cruise has a day: morning → noon → golden hour → sunset → night → dawn, one
//      cycle ≈ 9 minutes (the clock is saved, so the next drive picks up where you
//      left off). Sun angle + colour, hemi light, sky and fog all follow it, blended
//      OVER the journey's per-leg palette (noon = the leg's own look). At night:
//      headlights (a real spot light on medium/high + a fake beam on the road),
//      glowing head/tail lights on traffic, street lamps with light pools, lit
//      windows, stars and the moon.
//   🌧️ Weather (Cruise): rain with streaks, splashes, spray and a wet road, storms
//      with lightning + thunder, fog banks, snow (around Chanukah, or rarely), a
//      rainbow after the rain; drops + wipers on the windscreen in "Lulu's eyes".
//   🐦 Ambient life (any run): bird flocks that scatter when you honk, a banner
//      plane with family messages, hot-air balloons, autumn leaves behind the car.
//   📖 Story mode keeps the journey's lighting: we only add night touches (stars,
//      moon, car lights, windows) where the leg itself is dark (the Vegas Strip).
//
// Files: common.js (state S, helpers) · sky.js (time of day, sky shell, stars,
// clouds, rainbow) · lights.js (glows, pools, headlights, lamps, windows) ·
// weather.js (rain/snow/fog/lightning, windscreen) · life.js (birds, plane,
// balloons, leaves) · sfx.js (synth sounds).
//
// Everything is gated by ctx.enabled("atmos"): tests opt in with ?test&enable=atmos.
// Service: ctx.atmos { info(), night, debug: { time(nameOrT), freeze(on), weather(kind, strength, instant), strike(), flock(kind), plane(text), balloon(), leaves() } }
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { autoDrive } from "../../core/driving.js";
import { S, quality, QMUL, worldVisible, say, said, smooth, clamp } from "./common.js";
import { skyTick, skyVisuals, skyHide, skyRestore, skyInfo, TIMES, phaseName } from "./sky.js";
import { lightsBoot, lightsTick, lightsHide, lightsInfo, syncLamps } from "./lights.js";
import { weatherBoot, weatherTick, weatherVisuals, weatherHide, weatherInfo, weatherReset, startWeather, strike, W } from "./weather.js";
import { lifeTick, lifeClear, lifeHide, lifeShow, lifeInfo, spawnFlock, spawnPlane, spawnBalloon } from "./life.js";
import * as sfx from "./sfx.js";

const DAY_SECONDS = 540;
const saved = store("atmos", { clock: TIMES.morning });
S.clock = typeof saved.clock === "number" ? ((saved.clock % 1) + 1) % 1 : TIMES.morning;

let lastT = -1, shown = false, offDone = true, frozen = false, phase = "", saveT = 0, lightsSaid = false, ownClock = null;

function hideAll() {
    skyRestore();
    if (!shown) return;
    shown = false;
    skyHide(); lightsHide(); weatherHide(); lifeHide();
    sfx.hush();
}

function tick(dt) {
    if (!ctx.world || !ctx.car || !ctx.camera) return;
    if (ctx.time === lastT) return;            // once per game step, whichever hook gets here first
    lastT = ctx.time;
    if (!ctx.enabled("atmos")) return;
    const st = ctx.state;
    // a party (features/party) gets the Cruise day + weather too, but driven by the shared
    // party clock + seed so every friend sees the same sky (see ctx.party.atmos*)
    const party = !!(ctx.party && ctx.party.active && ctx.G.mode === "party" && ctx.party.atmosClock);
    // the world feature's live home street keeps the day + weather on the title (on the device's clock)
    let titleClock = null;
    if (st === "title" && typeof ctx.atmos.titleClock === "function") { try { titleClock = ctx.atmos.titleClock(); } catch (e) { titleClock = null; } }
    // a feature may drive the Cruise-style day itself: G.atmosClock() → 0..1 (shabbos: the sunset IS
    // the deadline); G.atmosClear keeps the sky clear. The Cruise clock is put back afterwards.
    const own = typeof ctx.G.atmosClock === "function" && st !== "title" && st !== "loading";
    if (own) {
        if (ownClock === null) ownClock = S.clock;
        try { S.clock = ((ctx.G.atmosClock() % 1) + 1) % 1; } catch (e) { /* keep the last clock */ }
    } else if (ownClock !== null) { S.clock = ownClock; ownClock = null; }
    const mode = st === "loading" || (st === "title" && titleClock == null) ? "off" : ctx.G.mode === "cruise" || party || own || titleClock != null ? "cruise" : "base";
    if (titleClock != null) S.clock = ((titleClock % 1) + 1) % 1;
    S.mode = mode;
    if (mode === "off") {
        if (!offDone) {
            offDone = true;
            hideAll();
            lifeClear();
            weatherReset();
            S.night = S.lightsOn = 0;
        }
        S.active = false;
        return;
    }
    offDone = false;
    S.dt = ctx.paused ? 0 : Math.min(dt, 0.1);
    S.time += S.dt;
    S.quality = quality();
    S.q = QMUL[S.quality] || 1;
    S.camPos.copy(ctx.camera.position);
    const def = ctx.states[st] || {};
    S.fp = !!(ctx.cam && ctx.cam.mode === 2 && def.driving && !def.camera && !(ctx.foot && ctx.foot.active));
    try { S.biome = (ctx.world.biomeAt(ctx.car.s) || {}).name || ""; } catch (e) { S.biome = ""; }

    // the clock runs while you drive (or walk) in Cruise
    if (party) {
        S.clock = ctx.party.atmosClock();
        const pw = ctx.party.atmosWeather();
        if (pw && (pw.kind !== W.kind || !W.forced)) { W.forced = true; W.party = true; startWeather(pw.kind, pw.strength, false, 9999); }
    } else if (W.party) { W.party = false; W.forced = false; }
    if (own && ctx.G.atmosClear) { if (W.kind !== "clear" && !W.forced) startWeather("clear"); W.t = Math.max(W.t, 30); }
    if (!party && !own && mode === "cruise" && S.dt && !frozen && (st === "playing" || st === "footRun" || st === "intro" || st === "wrecked")) {
        S.clock = (S.clock + S.dt / DAY_SECONDS) % 1;
        saveT += S.dt;
        if (saveT > 5) { saveT = 0; saved.clock = S.clock; saveSoon(); }
    }

    const vis = worldVisible();
    S.active = vis;
    if (!vis) { hideAll(); return; }     // an interior set / a menu-only scene: freeze, keep quiet
    weatherTick(S.dt);
    skyTick();
    S.lightsOn = clamp(Math.max(smooth(0.18, 0.55, S.night), S.rain * 0.8, S.fog * 0.9, S.snow * 0.55));
    if (!shown) { shown = true; lifeShow(); }
    skyVisuals(S.dt);
    lightsTick(S.dt);
    weatherVisuals(S.dt);
    lifeTick(S.dt);
    if (mode === "cruise" && !own) announcePhase();
}

function announcePhase() {
    const p = phaseName(S.clock);
    if (p === phase) return;
    const prev = phase;
    phase = p;
    if (!prev) return;
    if (p === "golden") say("🌇 Golden hour — Avigail would want a selfie", "gold");
    else if (p === "night" && !lightsSaid) lightsSaid = say("🌙 Night falls — headlights on!", "", 6);
    else if (p === "morning" && prev === "dawn") say("🌅 Good morning, Lulu! Ima says eat breakfast", "pink");
    if (p !== "night") lightsSaid = false;
}

// ── tick sources: HUD states (after the world + camera moved), driving cutscenes,
//    menus over the road (game over), and — for anything else that still shows the
//    road — right before the scene renders.
hook("hud", dt => tick(dt));
hook("update", dt => { const def = ctx.states[ctx.state]; if (!def || !def.hud) tick(dt); }, -50);
hook("titleCamera", dt => { tick(dt); return false; }, 40);
const driver = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
driver.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
driver.geometry.setDrawRange(0, 0);
driver.frustumCulled = false;
driver.onBeforeRender = () => { if (lastT !== ctx.time && lastT >= 0) tick(Math.max(0, Math.min(0.05, ctx.time - lastT))); };

// test-only cruise control (ctx.atmos.debug.cruise): keeps screenshots on the road
let autoSpeed = 0;
hook("controls", (ctl, dt) => { if (autoSpeed > 0 && ctx.TEST) Object.assign(ctl, autoDrive(dt, 1.75, autoSpeed)); }, -100);

on("boot", () => {
    if (!ctx.enabled("atmos")) return;
    lightsBoot();
    weatherBoot();
    ctx.scene.add(driver);
});
on("run:start", () => {
    if (!ctx.enabled("atmos")) return;
    lifeClear();
    syncLamps();
    phase = ""; lightsSaid = false;
});
on("run:end", () => { saved.clock = ownClock !== null ? ownClock : S.clock; saveSoon(); });

// ── the service (+ test / debug hooks) ────────────────────────────────────
ctx.atmos = {
    get night() { return S.night; },
    get clock() { return S.clock; },
    get weather() { return W.kind; },
    info() {
        return Object.assign({ mode: S.mode, active: S.active, clock: S.clock, phase: phaseName(S.clock), w: S.w, night: S.night, lightsOn: S.lightsOn,
            day: S.day, baseNight: S.baseNight, quality: S.quality, fp: S.fp, biome: S.biome, cloud: S.cloud, said: said.slice() },
        { sky: skyInfo(), lights: lightsInfo(), weather: weatherInfo(), life: lifeInfo() });
    },
    debug: {
        /** Jump the clock: a name (morning, noon, afternoon, golden, sunset, dusk, night, dawn) or 0..1. */
        time(t) { S.clock = typeof t === "string" ? TIMES[t] : ((t % 1) + 1) % 1; phase = phaseName(S.clock); return S.clock; },
        freeze(on = true) { frozen = !!on; return frozen; },
        /** weather("rain" | "fog" | "snow" | "clear", strength, instant) — pins it until weather(null). */
        weather(kind, strength = 1, instant = true) {
            if (kind == null) { W.forced = false; return "auto"; }
            W.forced = true;
            startWeather(kind, strength, instant, 9999);
            return kind;
        },
        rainbow(sec = 40, instant = true) { W.rainbowT = sec; if (instant) S.rainbow = 1; return true; },
        strike() { strike(); return true; },
        flock(kind = "ground", opts) { const f = spawnFlock(kind, opts || {}); return f ? f.birds.length : 0; },
        plane(text) { const p = spawnPlane(text); return p ? p.text : ""; },
        balloon(opts) { spawnBalloon(opts || {}); return true; },
        /** Tests: hold Lulu in the inside lane at `speed` m/s (0 / null = hands back to the player). */
        cruise(speed) { autoSpeed = speed || 0; return autoSpeed; },
    },
};
