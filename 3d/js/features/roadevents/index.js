// features/roadevents — ROADSIDE EVENTS & HAZARDS (the 2D game's SPAWN_CONFIG
// events and everything else that happens on the road that isn't a cop, a
// cameo, a story stop, parking or an item):
//
//   🚶 pedestrians → passengers (2× coins)   🙋 hitchhikers (honk!)      🍦 ice-cream stand + truck
//   🎫 toll-booth gauntlet                    🚂 railroad crossing        🍔 drive-thru
//   🎉 parade / marathon                      🦆🦝🦤 animals + duck parade 🚧 cones, puddles, potholes
//   🏗️ construction zones + the STEAMROLLER   🚌 school buses / stops / crossing guards
//   🍺 drunk & 📱 texting drivers, breakdowns, road rage, fender benders   🚑 ambulances
//   ⛽ gas zones + NITRO fuel cans, 🍺 courage   🪧 billboards + roadside stories   🗺️ road zones
//
// Service (ctx.roadevents) — see the bottom of this file. Random spawning is gated
// with ctx.enabled("roadevents"); tests force any event with ctx.roadevents.spawn(name, opts).
import { ctx, on, hook, css } from "../../core/ctx.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { SPAWN_CONFIG, OWN_SPAWNS, MIN_TIME, RATES, PAY } from "./config.js";
import { EVENTS, R, live, tally, canSpawn } from "./state.js";
import { ID, loadAll, need, rnd, clamp, governTraffic, updateBubbles, resetCommon } from "./common.js";
import { seat, seatRider, ridersBonus, resetPassengers, honkHitch, honkScarePeds } from "./passengers.js";
import "./toll.js";
import "./train.js";
import "./treats.js";
import "./parade.js";
import { honkScareAnimals } from "./animals.js";
import { updateCones, clearCones, wet } from "./construction.js";
import { D, updateDozer, endDozer, commandeer } from "./dozer.js";
import { busChatter } from "./school.js";
import { updateDrivers, checkHonkMoves, politeDodges, tickFenderBenders, resetDrivers } from "./drivers.js";
import "./roadside.js";
import { resetZones, updateZones, scheduleZone, buffs, nitro, courage, updateBuffs, resetBuffs } from "./zones.js";

// ── SPAWN_CONFIG timers (2D initSpawnTimers / tickSpawn) ────────────────────
const spawnTimers = {};
function initSpawnTimers() { for (const k in SPAWN_CONFIG) spawnTimers[k] = rnd(SPAWN_CONFIG[k].first[0], SPAWN_CONFIG[k].first[1]); }
/** Count down `name`'s timer; when it elapses, reset it and roll the (story-biased) chance. */
export function tickSpawn(name, dt) {
    const c = SPAWN_CONFIG[name];
    if (!c) return false;
    if (spawnTimers[name] === undefined) spawnTimers[name] = rnd(c.first[0], c.first[1]);
    spawnTimers[name] -= dt;
    if (spawnTimers[name] > 0) return false;
    spawnTimers[name] = rnd(c.every[0], c.every[1]);
    let eff = c.chance * ((ctx.journey && ctx.journey.spawnBias ? ctx.journey.spawnBias(name) : 1) ?? 1);
    if (eff > 0.95) eff = 0.95;
    return Math.random() < eff;
}

// ── spawning ─────────────────────────────────────────────────────────────────
const pending = {};
let runId = 0;
const busy = name => live(name) > 0 || (pending[name] || 0) > 0;
/** Spawn a road event by name (see ctx.roadevents.events). Resolves with its handle (or null). */
export async function spawn(name, opts = {}) {
    const ev = EVENTS[name];
    if (!ev) throw new Error(`roadevents: unknown event "${name}"`);
    const myRun = runId;
    pending[name] = (pending[name] || 0) + 1;
    try {
        await need(ev.models);
        if (myRun !== runId || !ctx.world) return null;   // the run restarted while loading
        return await ev.spawn(opts);
    } catch (e) {
        console.error("[roadevents]", name, e);
        return null;
    } finally {
        pending[name]--;
    }
}

const T = {};
function resetTimers() {
    initSpawnTimers();
    T.cone = rnd(...RATES.cone); T.puddle = rnd(...RATES.puddle); T.animal = rnd(...RATES.animal); T.hitch = rnd(...RATES.hitch);
    T.dozer = 8; T.convoy = 0; T.convoyNext = 0;
}

function scheduler(dt) {
    const G = ctx.G, t = G.runTime, car = ctx.car, zone = R.zone;
    for (const name of OWN_SPAWNS) {
        if (!tickSpawn(name, dt) || t <= MIN_TIME[name]) continue;
        if (name !== "pedestrian" && busy(name)) continue;
        spawn(name);
    }
    const speedFactor = 1 - clamp((car.speed - 18) / 35, 0, 1) * 0.4;
    if ((T.cone -= dt) <= 0) { T.cone = rnd(...RATES.cone) * speedFactor; if (car.speed > 6) spawn("cone"); }
    if ((T.puddle -= dt) <= 0) { T.puddle = rnd(...RATES.puddle) * speedFactor; if (car.speed > 6) spawn(Math.random() < (zone === "construction" ? 0.6 : 0.15) ? "pothole" : "puddle"); }
    if ((T.animal -= dt) <= 0) {
        T.animal = rnd(...RATES.animal);
        if (t > 45 && Math.random() < RATES.duckParade && !busy("duckParade")) spawn("duckParade");
        else if (t >= 30) spawn("animal");
    }
    if ((T.hitch -= dt) <= 0 && t > 20 && !busy("hitchhiker")) { T.hitch = rnd(...RATES.hitch); spawn("hitchhiker"); }
    const school = zone === "school", market = zone === "market";
    if (t > 18 && !busy("iceTruck") && Math.random() < dt * RATES.iceTruck * (school || market ? 4.17 : 1)) spawn("iceTruck");
    if (t > 25 && !busy("busStop") && Math.random() < dt * (school ? 0.10 : RATES.busStop)) spawn("busStop");
    if (t > 25 && !busy("crossingGuard") && Math.random() < dt * (school ? 0.09 : RATES.guard)) spawn("crossingGuard");
    const busN = ctx.traffic.cars.filter(c => c.kind === "roadevents_bus").length;
    if (t > 15 && busN < 1 && T.convoy <= 0 && !busy("schoolBus") && Math.random() < dt * (school ? 0.22 : RATES.schoolBus)) spawn("schoolBus");
    if (T.convoy <= 0 && busN === 0 && t > 40 && Math.random() < dt * (school ? 0.05 : RATES.convoy)) { T.convoy = 6; T.convoyNext = 0; H.toast("🚌 Field-trip convoy!", "gold"); }
    if (T.convoy > 0) { T.convoy -= dt; T.convoyNext -= dt; if (T.convoyNext <= 0 && busN < 4) { T.convoyNext = rnd(0.9, 1.4); spawn("schoolBus"); } }
    if (!busy("ambulance") && !ctx.traffic.cars.some(c => c.kind === "roadevents_ambulance") && Math.random() < dt * (zone === "hospital" ? 0.5 : RATES.ambulance)) spawn("ambulance");
    if (t > 12) tickFenderBenders(dt);
    // steamrollers trundling by (common in construction, rare elsewhere)
    if ((T.dozer -= dt) <= 0) {
        const inC = zone === "construction";
        if (inC && Math.random() < 0.5) { spawn("rollerNpc", { d: 1.75 }); T.dozer = rnd(7, 13); }
        else if (!inC && Math.random() < RATES.dozerNpc) { spawn("rollerNpc"); T.dozer = rnd(45, 85); }
        else T.dozer = inC ? rnd(3, 6) : rnd(10, 18);
    }
    // zone crowds: road workers, kids crossing, tipsy patrons; nitro cans at the gas station
    if (zone === "construction" && t > 8 && Math.random() < dt * 0.5) spawn("pedestrian", { kind: "worker", cross: true });
    if (zone === "construction" && Math.random() < dt * 0.4) spawn("cone");
    if (school && t > 5 && Math.random() < dt * 0.35) spawn("pedestrian", { kind: "kid", cross: true });
    if (zone === "bars" && t > 5 && Math.random() < dt * 0.5) spawn("pedestrian", { kind: "drunk" });
    if (zone === "gas" && live("fuelCan") + (pending.fuelCan || 0) < 2 && Math.random() < dt * RATES.fuel) spawn("fuelCan");
}

// ── run lifecycle ───────────────────────────────────────────────────────────
hook("runStart", G => {
    runId++;
    endDozer(null);
    resetCommon();
    resetPassengers();
    resetDrivers();
    resetBuffs();
    clearCones();
    resetTimers();
    resetZones();
    wet.t = 0;
    R.live = {};
    R.honkChain = 0; R.honkT = 0;
    for (const k of Object.keys(tally)) delete tally[k];
    G.roadevents = tally;
});

hook("update", (dt, P, controlsOn) => {
    if (!ctx.world) return;
    governTraffic();
    checkHonkMoves();
    updateDrivers(dt);
    updateCones(dt, controlsOn && ctx.state === "playing");
    updateDozer(dt, controlsOn);
    updateBuffs(dt, controlsOn);
    if (wet.t > 0) wet.t = Math.max(0, wet.t - dt);
    if (R.honkT > 0) { R.honkT -= dt; if (R.honkT <= 0) R.honkChain = 0; }
    if (controlsOn && ctx.enabled(ID)) { busChatter(dt); politeDodges(); }
    const auto = canSpawn() && svc.auto && controlsOn;
    updateZones(dt, auto);
    if (auto) scheduler(dt);
});

// the horn: hitchhikers hop in; walkers and animals scatter (2D honkScare chance climbs with the chain)
on("honk", () => {
    if (ctx.state !== "playing") return;
    R.honkChain = Math.min(R.honkChain + 1, 7);
    R.honkT = 1.5;
    honkHitch();
    const chance = Math.min(0.16 + R.honkChain * 0.10, 0.9);
    honkScarePeds(chance);
    honkScareAnimals(chance);
});

// buffs that change how the car drives
hook("controls", ctl => {
    if (buffs.nitro > 0) input.boost = true;        // the turbo holds the nitro down for you
    if (wet.t > 0) ctl.throttle *= 0.6;              // 2D: a splash slows you for 0.7 s
}, 4);
hook("damage", info => ((buffs.nitro > 0 || buffs.courage > 0) && info.source !== "train" ? false : undefined), 55);
on("crash", e => {
    // nitro plows through traffic for bonus points (2D +30)
    if (buffs.nitro > 0 && e.car && !D.active && ctx.traffic.cars.includes(e.car) && !e.car.data.rePlowed) {
        e.car.data.rePlowed = true;
        e.car.onCrash = () => false;
        ctx.G.score += 30;
        H.toast("💥 +30", "gold");
    }
});

// ── HUD badges (passenger 2× window, nitro, courage, crush-mode diesel) ─────
css(ID + "-hud", `#re-badges { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }`);
let badges = null;
const shown = {};
function badge(id, html, frac, low) {
    let el = badges.querySelector(`[data-b="${id}"]`);
    if (html == null) { if (el) el.remove(); shown[id] = null; return; }
    if (!el) { el = document.createElement("div"); el.className = "re-badge"; el.dataset.b = id; el.innerHTML = `<span></span><div class="bar"><i></i></div>`; badges.appendChild(el); }
    if (shown[id] !== html) { el.firstChild.innerHTML = html; shown[id] = html; }
    el.querySelector("i").style.width = (clamp(frac, 0, 1) * 100).toFixed(0) + "%";
    el.classList.toggle("low", !!low);
}
hook("hud", dt => {
    updateBubbles(dt);
    if (!badges) { badges = document.createElement("div"); badges.id = "re-badges"; H.hudSlot("left").appendChild(badges); }
    badge("pass", seat.t > 0 ? `👥 2× COINS · ${Math.ceil(seat.t)}s` : null, seat.t / PAY.passengerSecs);
    badge("nitro", buffs.nitro > 0 ? "🔥 NITRO TURBO" : null, buffs.nitro / PAY.nitroMax);
    badge("courage", buffs.courage > 0 ? "🍺 COURAGE ×2" : null, buffs.courage / PAY.courageSecs);
    badge("dozer", D.active ? `🚜 CRUSH MODE${D.t / D.max < 0.25 ? " — ⛽ LOW!" : ""}` : null, D.t / D.max, D.t / D.max < 0.25);
});
on("state", ({ to }) => { if (badges && !(ctx.states[to] && ctx.states[to].hud)) for (const id of Object.keys(shown)) badge(id, null); });

// ── boot: register + background-load the models once the game is up ────────
on("boot", () => {
    if (ctx.enabled(ID)) setTimeout(() => loadAll().catch(e => console.warn("[roadevents] models", e)), ctx.TEST ? 0 : 1500);
});

// ── the service other features (and tests) use ──────────────────────────────
const svc = {
    /** false = no random spawning (tests force events with spawn()). */
    auto: true,
    /** Spawn any event now: ctx.roadevents.spawn("train", { s: ctx.car.s + 300 }). */
    spawn,
    /** Names of every event that can be spawned. */
    get events() { return Object.keys(EVENTS); },
    describe: () => Object.fromEntries(Object.entries(EVENTS).map(([k, v]) => [k, `${v.emoji} ${v.label}`])),
    /** The 2D SPAWN_CONFIG (shared timers: cameos / law / journey may call tickSpawn for their own entries). */
    SPAWN_CONFIG, tickSpawn, timers: spawnTimers,
    /** Current road zone (construction, school, gas, market, bars, downtown, hospital) or null. */
    get zone() { return R.zone; },
    get zonePlan() { return R.zoneSched; },
    setZone: (kind, opts) => scheduleZone(kind, opts),
    /** Buffs: NITRO turbo (fuel cans; journey's ice-cream task) and the bar's liquid courage. */
    nitro, courage, get buffs() { return { nitro: buffs.nitro, courage: buffs.courage }; },
    /** "steamroller" while Lulu is crushing cars in one, else null. */
    vehicle: null,
    commandeer, endSteamroller: () => endDozer(),
    /** Passengers in Lulu's car (and the 2× coin window). seat(person, {bonus, secs, who}) seats a core Person. */
    get passengers() { return seat.riders.length; },
    get passengerTime() { return seat.t; },
    seat: seatRider, ridersBonus,
    /** Per-run counters (also on ctx.G.roadevents). */
    tally,
    loadModels: loadAll,
};
ctx.roadevents = svc;
