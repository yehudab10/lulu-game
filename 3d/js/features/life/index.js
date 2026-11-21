// features/life — 🍃 A WORLD THAT FEELS ALIVE: small ambient things you notice, no menus, no pop-ups.
//
//   👣 footsteps that change with the ground (steps.js): sidewalk, asphalt, grass, gravel, wet, a puddle, snow, a car's
//      roof, a bench — timed to her walk cycle
//   💧 puddles after the rain in town (puddles.js): they fill while it rains (rings on them), mirror the sky, outlast the
//      wet road; splashy steps, a SPLOSH when she jumps in, spray off the car (a townsperson at the kerb gets it)
//   🍂 the wind (wind.js): gusts you hear coming, leaves / blossom petals / a paper flyer blowing past (walk into a flyer
//      and Lulu reads it: "LOST CAT: KUGEL…"), leaves drifting down in the fall, raked LEAF PILES at the kerb that burst
//   🏘️ the neighbourhood (ambience.js): birds, a dog (and the one next door), a screen door, a basketball, someone
//      hammering (a sukkah before Sukkos — never on Shabbos), wind chimes when it's gusty, crickets on warm nights, an owl
// Round 2 (ci/life2):
//   🐦 pigeons (pigeons.js) on roof ridges + pecking on the pavement (the bakery, the pizza shop): honk, run at them or
//      drive past fast and they clatter up, circle the block, and glide back once she's gone
//   💨 smoke + steam (puffs.js): chimney smoke on cold days, Midwood's steaming manholes (the car swirls through), a warm
//      puff off the bakery's / pizza shop's oven vent (and now and then Lulu smells it)
//   🚨 car alarms (alarm.js): a bumped parked car blinks its hazards, the alarm carries on, the owner yells (a bubble)
//   👣 friends' footsteps (friends.js): a friend walking near her in a party is heard too
//
// Everything is local + cosmetic (fine in a 🎉 party; the sites are hashed from the town's plan, so friends see the
// same puddles and piles). The seasons follow the device's date (`?lifeSeason=autumn|spring|summer|winter` to preview).
// ⚙️ 🐦 Street sounds turns the sounds off (footsteps + the neighbourhood); the visuals have no switch — they're quiet.
// Gated by ctx.enabled("life") (tests opt in with &enable=life). Off in Dina's mode, in sets / interiors, on the title.
//
// Service: ctx.life = { info(), sounds (get/set), debug: { rain(level), season(s), gust(opts), flyer(i), happen(kind),
//          puddle(kind), pile(), probe(kind), stats } }
import { ctx, on, hook, addMenuItem, emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { L, SAVE, seasonNow, setSeasonPin, stats, soundsOn, setColdPin, LINE } from "./common.js";
import { probe, SOUND_KINDS } from "./sounds.js";
import { tickSteps, stepInfo } from "./steps.js";
import { tickPuddles, puddleInfo, forceLevel, landed, clearSites, nearestPuddle, P as PUD } from "./puddles.js";
import { tickWind, windHide, windClear, windInfo, gust, spawnFlyer, nearestPile, WS, WIND } from "./wind.js";
import { tickAmbience, ambienceStop, ambienceInfo, happen } from "./ambience.js";
import { tickPuffs, puffsHide, puffsClear, puffInfo, nearestPuff, PUFF, PU } from "./puffs.js";
import { tickPigeons, pigeonsHide, pigeonsClear, pigeonInfo, nearestFlock, scatterNearest, PIG, PG } from "./pigeons.js";
import { tickAlarm, alarmClear, alarmInfo, ALARM } from "./alarm.js";
import { tickFriendSteps, friendStepInfo, fakeParty } from "./friends.js";

let lastT = -1, seasonT = 0, wasOn = false, off = false;
const dinaMode = () => /^dina/.test(ctx.state || "") || !!(ctx.G && ctx.G.mode === "dina");
function placeOK() {
    if (!ctx.world || !ctx.car || ctx.view) return false;
    const st = ctx.state, def = ctx.states[st];
    if (!def || def.world === false || st === "title" || st === "loading" || dinaMode()) return false;
    return st === "footRun" || !!def.driving || st === "playing";
}

function tick(dt) {
    if (ctx.time === lastT) return;             // once per game step, whichever hook gets here first
    lastT = ctx.time;
    if (!ctx.enabled("life")) return;
    const on = !off && placeOK();
    L.on = on;
    if (!on) {
        if (wasOn) { wasOn = false; hideAll(); }
        return;
    }
    wasOn = true;
    L.dt = ctx.paused ? 0 : Math.min(dt, 0.1);
    L.time += L.dt;
    L.quiet = !!(ctx.paused || ctx.skipping || ctx.dialogOpen);
    const F = ctx.foot;
    L.foot = !!(F && F.active && F.pos && ctx.state === "footRun");
    L.town = !!(ctx.town && ctx.town.active);
    L.townId = L.town ? ctx.town.id || "" : "";
    if (L.foot) { L.x = F.pos.x; L.z = F.pos.z; L.speed = F.vel ? Math.hypot(F.vel.x, F.vel.z) : 0; }
    else { L.x = ctx.car.pos.x; L.z = ctx.car.pos.z; L.speed = Math.abs(ctx.car.speed || 0); }
    const A = ctx.atmos;
    L.night = A ? A.night || 0 : 0;
    L.wet = A ? A.wet || 0 : 0;
    L.weather = A ? A.weather || "clear" : "clear";
    L.snow = L.weather === "snow";
    L.rain += ((L.weather === "rain" ? 1 : 0) - L.rain) * Math.min(1, L.dt / 3);
    seasonT -= L.dt;
    if (seasonT <= 0) { seasonT = 30; L.season = seasonNow(); try { L.biome = (ctx.world.biomeAt(ctx.car.s) || {}).name || ""; } catch (e) { L.biome = ""; } }
    if (!L.dt) return;
    const t0 = performance.now();
    try { tickSteps(L.dt); } catch (e) { console.error("[life] steps", e); }
    try { tickPuddles(L.dt); } catch (e) { console.error("[life] puddles", e); }
    try { tickWind(L.dt); } catch (e) { console.error("[life] wind", e); }
    try { tickAmbience(L.dt); } catch (e) { console.error("[life] ambience", e); }
    try { tickPigeons(L.dt); } catch (e) { console.error("[life] pigeons", e); }
    try { tickAlarm(L.dt); } catch (e) { console.error("[life] alarm", e); }        // (before the puffs: its glows ride their mesh)
    try { tickPuffs(L.dt); } catch (e) { console.error("[life] puffs", e); }
    try { tickFriendSteps(L.dt); } catch (e) { console.error("[life] friends", e); }
    const ms = performance.now() - t0;
    stats.ms = stats.ms * 0.95 + ms * 0.05; stats.maxMs = Math.max(stats.maxMs, ms); stats.ticks++;
}
function hideAll() { windHide(); ambienceStop(); if (PUD.mesh) PUD.mesh.visible = false; puffsHide(); pigeonsHide(); alarmClear(); }
hook("hud", dt => tick(dt));
hook("update", dt => { const def = ctx.states[ctx.state]; if (!def || !def.hud) tick(dt); }, -62);

on("foot:land", () => { if (ctx.enabled("life") && L.on) try { landed(); } catch (e) { /* cosmetic */ } });
on("run:start", () => { windClear(); ambienceStop(); WS.said.clear(); alarmClear(); PU.smelled.clear(); });
on("town:leave", () => { windClear(); clearSites(); puffsClear(); pigeonsClear(); alarmClear(); });
on("town:enter", () => { windClear(); WS.gustT = Math.min(WS.gustT, 10); });
on("state", ({ to } = {}) => {
    if (to === "title") { windClear(); ambienceStop(); clearSites(); puffsClear(); pigeonsClear(); alarmClear(); }
    // (the title / a set / Dina's world tick none of our hooks: switch off now, not on the next world frame)
    if (!placeOK() && L.on) { L.on = false; wasOn = false; hideAll(); }
});
on("settings", e => { if (e && e.id === "lifeSounds" && !soundsOn()) { ambienceStop(); puffsHide(); } });

// ── ⚙️ the switch (only the sounds can get on anyone's nerves) ──────────────
addMenuItem("settings", {
    id: "lifeSounds", order: 64,
    // in a run only (⏸ → ⚙️ Settings): the sounds live out in the world, and the title's Settings card is already at
    // its 720p limit (the ux test's "settings fit 720p" — one more row there scrolls)
    visible: () => ctx.state !== "title" && ctx.state !== "loading",
    // (the core rows' own shape — name left, value right, one line: the settings card has to fit 720p)
    label: () => `<span>🐦 Street sounds</span><b>${soundsOn() ? "ON" : "OFF"}</b>`,
    action: () => { SAVE.sounds = !soundsOn(); saveSoon(); if (!SAVE.sounds) { ambienceStop(); puffsHide(); } emit("settings", { id: "lifeSounds" }); },
});

// ── the service ──────────────────────────────────────────────────────────
ctx.life = {
    get sounds() { return soundsOn(); },
    set sounds(v) { SAVE.sounds = !!v; saveSoon(); if (!v) { ambienceStop(); puffsHide(); } },
    info() {
        return { on: L.on, foot: L.foot, town: L.town, townId: L.townId, season: L.season, night: +L.night.toFixed(2), wet: +L.wet.toFixed(2), rain: +L.rain.toFixed(2),
            sounds: soundsOn(), steps: Object.assign({ n: stats.steps, kinds: Object.assign({}, stats.stepKinds) }, stepInfo()),
            puddles: puddleInfo(), wind: windInfo(), ambience: ambienceInfo(),
            splashes: stats.splashes, carSplashes: stats.carSplashes, soaked: stats.soaked, flyersRead: stats.read, pilesKicked: stats.kicked,
            puffs: puffInfo(), pigeons: pigeonInfo(), alarm: alarmInfo(), friends: friendStepInfo(), lines: LINE.said };
    },
    debug: {
        stats, L, WIND, SOUND_KINDS, PUFF, PIG, PG, ALARM, LINE,
        /** Pin the puddles' water level 0..1 (null = follow the weather again). */
        rain(level = 1) { return forceLevel(level); },
        /** Pin the season ("autumn" | "spring" | "summer" | "winter"; null = the device's date). */
        season(s) { setSeasonPin(s); L.season = seasonNow(); seasonT = 30; return L.season; },
        gust(opts) { const g = gust(opts || {}); return !!g; },
        flyer(i = 0, dir = 0, lat = null) { return !!spawnFlyer(Math.sin(dir), Math.cos(dir), i, lat); },
        happen(kind = "") { return happen(kind); },
        puddle(kind = "") { return nearestPuddle(kind); },
        pile() { return nearestPile(); },
        probe(kind) { return probe(kind); },
        /** Pin a cold day (chimney smoke) on / off (null = the device's date). */
        cold(v = true) { setColdPin(v); return v; },
        /** The nearest smoking chimney / steaming manhole ("chimney" | "manhole" | "bakery" | "pizza") → {x, y, z} | null. */
        puff(kind = "chimney") { return nearestPuff(kind); },
        /** The nearest pigeon flock ("roof" | "ground" | "") → {x, y, z, n, away} | null; scatter(kind) sends the nearest up. */
        flock(kind = "") { return nearestFlock(kind); },
        scatter(kind = "") { return scatterNearest(kind); },
        /** Let the next life line through now (tests: the shared line budget otherwise holds lines ≥ 40 s apart). */
        lineReady() { LINE.at = -1e9; return true; },
        /** Tests: friends' footsteps from a stand-in party ({ active, uid, members(), remoteCar(uid) }; null = the real one). */
        fakeParty(p) { return fakeParty(p); },
        /** Tests / perf: everything off (hidden, quiet) as if the feature weren't there. */
        off(v = true) { off = !!v; if (off) hideAll(); return off; },
    },
};
