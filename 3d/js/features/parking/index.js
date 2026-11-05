// features/parking — THE PARKING MINIGAME (port of src/03-art-parking-hud.js,
// src/04-parking-logic.js and the pull-over in src/05-driving-loop.js).
//
//  • In-drive PULL-OVER (pullover.js): crawl in a side lane for 1.6 s → "🅿️ Pull
//    over" → Lulu eases onto the shoulder → the roadside lot. Park (or fail),
//    then she climbs out and walks off: ctx.foot.start("droveOff").
//  • 🅿️ PARKING CHALLENGE (title, order 40): 10 levels, 3 lives, unlock once for
//    1,000 coins (shared `parkingUnlocked`). Spots tighten, cameras multiply,
//    dusk then night, a cone in the bay (4+), a pedestrian (5+), traffic (7+),
//    and Sasquatch watching the Boss Level.
//  • Scoring exactly like 2D: ★★★ no contact at all · ★★ no car touched ·
//    ★ dinged something. Pull-over pays 50 + 15/★ coins and +500 score; the
//    challenge pays level × 25 + 15/★. Hit a car hard, bump a pedestrian or run
//    out the clock → CRASH! −1 ♥ (and the angry grandpa).
//
// Service: ctx.parking = { start(opts), active, pose() }  ·  emits parking:result {stars, coins}
//   opts: { challenge: true, level } | { from: "pullover" | "foot" | <other>, onDone({ok, stars, coins}) }
import * as THREE from "three";
import { ctx, on, emit, registerState, setState, addMenuItem, wrapAngle } from "../../core/ctx.js";
import { save3d, saveSoon, store, shared, wallet } from "../../core/save.js";
import { addCoins, addScore } from "../../core/driving.js";
import { input, glyph, rumble } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { showTitle, resume } from "../../core/screens.js";
import { spawnPerson } from "../../core/people.js";
import { models } from "../../models.js";
import * as LOT from "./lot.js";
import { PH } from "./hud.js";
import { tone, notes, wompWomp, crunch } from "./sfx.js";
import { pullover } from "./pullover.js";

export const UNLOCK_COST = 1000;          // PARKING_UNLOCK_COST in src/01-engine-core.js
const MAXF = 4.0, MAXR = 2.5;             // lot speed governor (2D: 60 / 42 px/s)
const SLOW = 8 / LOT.PXM;                 // "slow" = under 8 px/s in 2D
const HOLD = 0.8;                         // seconds in the bay to count as parked
const TRANSITION = 0.9;                   // parkingTransitionDuration
const P3 = store("parking", { parks: 0, fails: 0, challengeRuns: 0, cam: 0 });
const CAM_NAMES = ["Overhead", "Chase cam", "Bird's eye"];
const FAIL_MSGS = { timeout: "Out of time!", pedestrian: "You bumped a pedestrian!", parked: "You dinged the other car!", traffic: "You drove into traffic!" };

const S = { active: false, phase: "idle", t: 0, lot: null, L: null, opts: {}, camPos: new THREE.Vector3(), camLook: new THREE.Vector3() };
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ── the service ──────────────────────────────────────────────────────────
ctx.parking = {
    /** Pull over into the parking minigame. See the header for opts. */
    start(opts = {}) { start(opts); },
    get active() { return S.active; },
    /** Lulu's car in the lot in 2D lot pixels {x, y, r} (Shared Road party parking), or null. */
    pose() {
        if (!S.active || S.phase !== "drive" || !S.lot) return null;
        const c = S.lot.car;
        return { x: Math.round(LOT.toX2(c.pos.x)), y: Math.round(LOT.toY2(c.pos.z)), r: Math.round(LOT.hToRot(c.h) * 100) / 100 };
    },
};

function start(opts) {
    if (S.active && ctx.state === "parking") return;
    S.opts = opts || {};
    S.challenge = !!S.opts.challenge;
    S.from = S.opts.from || (S.challenge ? "title" : "pullover");
    S.kidsInCar = false;
    if (S.challenge) {
        S.level = S.opts.level || 1;
        S.lives = 3; S.chStars = 0; S.chCoins = 0;
        P3.challengeRuns++; saveSoon();
    } else S.level = 0;
    setState("parking", { from: S.from });
}

function themeFromWorld() {
    const sun = ctx.lights && ctx.lights.sun ? ctx.lights.sun.intensity : 2.6;
    return sun > 1.6 ? "day" : sun > 0.8 ? "dusk" : "night";
}

function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── level setup ──────────────────────────────────────────────────────────
function beginLevel() {
    const lot = S.lot;
    let cfg, layout;
    if (S.challenge) {
        cfg = LOT.levelConfig(S.level);
        layout = LOT.challengeLayout(cfg.spotWidth);
    } else {
        cfg = LOT.casualConfig(themeFromWorld());
        // Shared Road party parking: a friend room seeds the lot from its code and
        // hands every member a different bay (same as the 2D game's mpParkingRng).
        const mp = ctx.mp;
        const rng = (mp && mp.parkingRng && mp.parkingRng()) || mulberry((Math.random() * 4294967296) >>> 0);
        const idx = (mp && mp.parkingSpotIndex && mp.parkingSpotIndex()) || 0;
        layout = LOT.roadsideLayout(rng, idx, cfg.spotWidth);
    }
    S.cfg = cfg; S.layout = layout;
    S.L = LOT.buildLevel(lot, { cfg, layout });
    const car = LOT.syncLotCar(lot);
    car.place(LOT.lotX(W2_START.x), LOT.lotZ(W2_START.y), LOT.rotToH(-Math.PI));
    car.skids.clear();
    const kids = LOT.makeKids(lot);
    for (const k of kids) k.obj.visible = S.kidsInCar;
    S.timeLeft = cfg.timeLimit;
    S.inZoneT = 0; S.touched = false; S.perfect = true; S.failHit = null; S.result = null; S.stars = 0; S.bonus = 0;
    S.hitCd = 0; S.flashT = 0; S.shake = 0; S.inZone = false; S.lastSec = Math.ceil(S.timeLeft);
    S.angry = null; S.walker = null;
    removeBubble();
    if (S.challenge) {
        S.introTitle = `Level ${S.level} · ${LOT.LEVEL_NAMES[Math.min(S.level - 1, 9)]}`;
        let d = `${cfg.numCameras} 📹 · ${Math.floor(cfg.timeLimit)}s · ${cfg.theme.toUpperCase()}`;
        if (cfg.coneInSpot) d += " · 🚧";
        if (cfg.pedestrian) d += " · 🚶";
        if (cfg.traffic) d += " · 🚗";
        if (cfg.sasquatchWatcher) d += " · 🦍";
        S.introDetails = d;
    } else {
        S.introTitle = "🅿️ PARALLEL PARKING";
        S.introDetails = "Park between the two cars — gently!";
    }
    lot.set.show();
    snapCam("intro");
    S.phase = "intro"; S.t = 0;
    tone(880, 0.08, "sine", 0.18);
    tone(1175, 0.12, "sine", 0.18, 0, 0.08);
}
const W2_START = { x: LOT.W2 - 50, y: Math.round(LOT.H2 * 0.55) };   // where the 2D car starts

// ── the state ────────────────────────────────────────────────────────────
registerState("parking", {
    hud: false, touch: true, pausable: true, world: false,
    enter(data, prev) {
        S.active = true;
        S.t = 0;
        PH.reset();
        PH.show(true);
        PH.showBar(false);
        PH.hint("");
        input.stick2d = false;
        A.setMusic("../parking.mp3");
        A.sfxHorn(false);
        // From the road: zoom in on Lulu's car + white flash (2D parkingIntro), while the lot loads.
        S.phase = S.from === "title" ? "loading" : "zoomIn";
        S.zoomFrom = ctx.camera.position.clone();
        S.lotPromise = LOT.ensureLot().then(l => { S.lot = l; }).catch(e => { console.error("[parking] lot failed to load", e); S.loadFailed = true; });
        P3.cam = P3.cam || 0;
    },
    exit(next) {
        if (next === "parkingEnd") return;
        leaveLot();
    },
    update(dt, P) {
        S.t += dt;
        if (S.loadFailed) { S.loadFailed = false; bailOut(); return; }
        switch (S.phase) {
            case "zoomIn":
                PH.white(S.t / 0.45);
                A.updateEngine(0, 0, 0, 0, false, false);
                if (S.t >= 0.45 && S.lot) beginLevel();
                break;
            case "loading":
                PH.white(1);
                if (S.lot) beginLevel();
                break;
            case "intro": updateIntro(dt, P); break;
            case "drive": updateDrive(dt, P); break;
            case "result": updateResult(dt, P); break;
            case "outro":
                animateLot(dt);
                PH.white(S.t / 0.45);
                if (S.t >= 0.45) route();
                break;
            case "walkout": updateWalkout(dt); break;
            case "handoff":
                // the foot feature normally switches state right away; if it hasn't after
                // a few seconds, don't leave Lulu stranded on a frozen road
                if (S.t > 4) returnToDriving("");
                break;
            default: break;
        }
        if (S.phase !== "zoomIn" && S.phase !== "loading" && S.phase !== "handoff" && S.lot) updateCam(dt);
    },
    camera(dt) {
        // driving scene (before the lot is up): push in on Lulu's car
        if (S.phase !== "zoomIn" || !ctx.car) return false;
        const car = ctx.car;
        v1.set(car.pos.x, 1.0, car.pos.z);
        ctx.camera.position.lerp(v1, Math.min(1, dt * 2.2));
        ctx.camera.lookAt(v1);
        return true;
    },
});

function leaveLot() {
    if (!S.active) return;
    S.active = false;
    S.phase = "idle";
    removeBubble();
    if (S.walker) { S.walker.person.obj.removeFromParent(); S.walker = null; }
    if (S.angry) { S.angry.person.obj.removeFromParent(); S.angry = null; }
    if (S.lot) {
        S.lot.set.hide();
        LOT.clearLot(S.lot);
        if (S.lot.kids) for (const k of S.lot.kids) k.obj.visible = false;
    }
    PH.show(false);
    PH.fadeWhiteOut();
    A.updateEngine(0, 0, 0, 0, false, false);
    if (ctx.view && S.lot && ctx.view === S.lot.set.view) ctx.view = null;
    if (ctx.cam) ctx.cam.snap();
}

function bailOut() {
    // the lot couldn't load (offline + uncached models): carry on driving
    if (S.challenge) { leaveLot(); setState("title"); H.toast("🅿️ The parking lot didn't load — check your connection", "red"); }
    else returnToDriving("🅿️ No parking here — keep driving!");
}

// ── intro: white fade + camera swoop + level card ──────────────────────────
function updateIntro(dt) {
    PH.white(1 - S.t / 0.6);
    PH.intro(S.introTitle, S.introDetails, clamp(S.t / 0.25, 0, 1));
    PH.showBar(true);
    updateBar();
    PH.hint("");
    animateLot(dt);
    idleCar(dt);
    if (S.t >= 1.0) {
        S.phase = "drive"; S.t = 0;
        tone(523, 0.08, "triangle", 0.2);
    }
}

function updateBar() {
    const low = S.timeLeft <= 10 && S.phase === "drive";
    if (S.challenge) PH.bar({ title: `LVL ${S.level} · ${LOT.LEVEL_NAMES[Math.min(S.level - 1, 9)]}`, lives: S.lives, stars: S.chStars, coins: S.chCoins, time: S.timeLeft, low });
    else PH.bar({ title: "PARALLEL PARKING", lives: Math.max(0, ctx.G.hearts || 0), time: S.timeLeft, low });
}

function idleCar(dt) {
    const car = S.lot.car;
    car.updateVisual(dt, ctx.time, { steer: 0, throttle: 0, brake: 0, handbrake: false }, false);
    A.updateEngine(Math.abs(car.vF), 0, 0, 0, false, true);
}

// ── driving in the lot ─────────────────────────────────────────────────────
function updateDrive(dt, P) {
    const lot = S.lot, L = S.L, car = lot.car;
    // the level card lingers for a moment
    PH.intro(S.introTitle, S.introDetails, clamp(1 - (S.t - 0.6) / 0.5, 0, 1));
    if (P.camera) { P3.cam = (P3.cam + 1) % 3; saveSoon(); S.camToast = 1.6; snapCam(); }

    // controls → the same PlayerCar physics, with a lot speed governor
    const thr = input.throttle, brk = input.brake;
    const vF = car.vF;
    const ctl = {
        steer: clamp(input.steer * (save3d.settings.steerSens || 1), -1, 1),
        throttle: thr * 0.5 * clamp((MAXF - vF) / 1.2, 0, 1),
        brake: vF > 0.6 ? brk : brk * 0.65 * clamp((MAXR + vF) / 1.0, 0, 1),
        handbrake: false, analog: input.device !== "keyboard",
    };
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) car.step(dt / n, ctl, { offroad: 0 });
    // gas while rolling backwards brakes (PlayerCar would just coast)
    if (car.vF < -0.2 && thr > 0.05) slowAlong(car, 9 * thr * dt);
    if (Math.abs(car.vF) < 0.05 && thr < 0.05 && brk < 0.05) { car.vx *= 0.8; car.vz *= 0.8; }

    S.hitCd = Math.max(0, S.hitCd - dt);
    collideParked();
    if (S.phase !== "drive") return;
    collideCurbs();
    updateCones(dt, true);
    updatePed(dt, true);
    if (S.phase !== "drive") return;
    LOT.updateTraffic(lot, L, dt);
    collideTraffic();
    if (S.phase !== "drive") return;

    car.updateVisual(dt, ctx.time, ctl, false);
    A.updateEngine(Math.abs(car.vF) * 1.5, ctl.throttle * 2, car.slip, 0, false, true);
    animateLot(dt);
    partyGhosts();

    // in the bay + slow + roughly lined up with the curb → hold for 0.8 s
    const zone = S.layout.zone;
    const x2 = LOT.toX2(car.pos.x), y2 = LOT.toY2(car.pos.z);
    const rotMod = ((LOT.hToRot(car.h) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const horizontalOK = rotMod < 0.35 || rotMod > Math.PI * 2 - 0.35 || Math.abs(rotMod - Math.PI) < 0.35;
    S.inZone = LOT.centreInZone(zone, x2, y2) && cornersInBay(car, L);
    const slow = Math.abs(car.vF) < SLOW;
    L.outlineMat.color.set(S.inZone ? "#4CAF50" : "#FFEB3B");
    L.outlineMat.emissive.set(S.inZone ? "#4CAF50" : "#FFEB3B");
    if (S.inZone && slow && horizontalOK) {
        S.inZoneT += dt;
        if (S.inZoneT > HOLD) { success(); return; }
    } else S.inZoneT = 0;
    PH.holdBar(S.inZone ? S.inZoneT / HOLD : 0);
    if (S.inZone) PH.hint("HOLD STILL TO PARK!", true);
    else if (S.camToast > 0) { S.camToast -= dt; PH.hint(`🎥 ${CAM_NAMES[P3.cam]} · ${glyph("camera")} to switch`); }
    else PH.hint(hintText());

    // the clock (urgent beep each second under 10, higher under 5)
    const prev = S.timeLeft;
    S.timeLeft -= dt;
    if (S.timeLeft <= 10 && S.timeLeft > 0 && Math.ceil(S.timeLeft) !== Math.ceil(prev)) {
        tone(Math.ceil(S.timeLeft) <= 5 ? 880 : 660, 0.09, "square", 0.14);
        rumble(0.1, 0.3, 60);
    }
    if (S.timeLeft <= 10 && S.timeLeft > 0) {
        const urg = (10 - S.timeLeft) / 10;
        PH.vignette((0.25 + urg * 0.5) * (0.5 + 0.5 * Math.sin(ctx.time * (6 + urg * 8))));
    } else PH.vignette(0);
    updateBar();
    if (S.timeLeft <= 0) { S.failHit = { who: "timeout" }; fail(); }
}

function hintText() {
    if (input.device === "touch") return "Park between the two cars · STEER with the stick · GAS / BRAKE to move";
    return `Park between the two cars · ${glyph("steer")} steer · ${glyph("gas")} forward · ${glyph("brake")} reverse`;
}

function slowAlong(car, dv) {
    const sp = Math.hypot(car.vx, car.vz);
    if (sp < 1e-4) return;
    const k = Math.max(0, sp - dv) / sp;
    car.vx *= k; car.vz *= k;
}

function corners(car, out) {
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    let i = 0;
    for (const a of [2.05, -2.05]) for (const b of [0.9, -0.9]) {
        out[i] = out[i] || { x: 0, z: 0 };
        out[i].x = car.pos.x + fx * a + rx * b; out[i].z = car.pos.z + fz * a + rz * b; i++;
    }
    return out;
}
const CORN = [];
function cornersInBay(car, L) {
    corners(car, CORN);
    for (const c of CORN) {
        if (c.x < L.zx0 - 0.45 || c.x > L.zx1 + 0.45 || c.z < L.curbZ - 0.1 || c.z > L.zz1 + 0.45) return false;
    }
    return true;
}

function collideParked() {
    const car = S.lot.car, L = S.L;
    let best = 0, pc = null, cx = 0, cz = 0;
    for (const p of L.parked) for (const c of p.circles) {
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
        if (dx * dx + dz * dz > 20) continue;
        const imp = car.collideStatic(c.x, c.z, c.r);
        if (imp > best) {
            best = imp; pc = p;
            const d = Math.hypot(car.pos.x - c.x, car.pos.z - c.z) || 1;
            cx = c.x + (car.pos.x - c.x) / d * c.r; cz = c.z + (car.pos.z - c.z) / d * c.r;
        }
    }
    if (best < 0.05 || S.hitCd > 0) return;
    S.hitCd = 0.35;
    const sev = clamp(best / MAXF, 0, 1);
    v1.set(cx, 0.7, cz);
    LOT.addDent(car.tilt, v1, sev);
    LOT.addDent(pc.obj, v1, sev, { hx: 0.9, hz: 2.2, y: 0.7 });
    S.touched = true; S.perfect = false;
    S.flashT = 0.2;
    S.shake = 0.2 + sev * 0.3;
    car.fx.burst(cx, 0.7, cz, sev > 0.35 ? 24 : 10, 3, [1, 0.8, 0.4], 0.4, 0.5);
    if (sev > 0.35) car.fx.burst(cx, 0.9, cz, 12, 1.5, [0.6, 0.6, 0.62], 1.2, 1.0);
    crunch(0.6 + sev);
    A.sfxBump();
    rumble(0.5 + sev * 0.5, 0.6, 160 + sev * 200, true);
    if (sev > 0.4) { S.failHit = { who: "parked", car: pc, severity: sev }; fail(); }
}

function collideCurbs() {
    const car = S.lot.car, L = S.L;
    corners(car, CORN);
    let minZ = 1e9, maxZ = -1e9, minX = 1e9, maxX = -1e9;
    for (const c of CORN) { minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z); minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); }
    if (minZ < L.curbZ) {
        car.pos.z += L.curbZ - minZ;
        if (car.vz < 0) {
            const imp = -car.vz;
            car.vz *= -0.3;
            if (imp > 0.25) {
                S.perfect = false;
                S.shake = Math.max(S.shake, 0.15);
                tone(150, 0.1, "square", 0.12);
                A.sfxBump();
                rumble(0.3, 0.4, 120, true);
            }
        }
    }
    const lim = 13.25, far = 30.1;
    if (maxX > lim) { car.pos.x -= maxX - lim; if (car.vx > 0) car.vx *= -0.3; }
    if (minX < -lim) { car.pos.x += -lim - minX; if (car.vx < 0) car.vx *= -0.3; }
    if (maxZ > far) { car.pos.z -= maxZ - far; if (car.vz > 0) car.vz *= -0.3; }
}

function updateCones(dt, live) {
    const car = S.lot.car;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    for (const c of S.L.cones) {
        const o = c.obj;
        if (!c.knocked && live) {
            for (const off of [1.15, -1.15]) {
                const px = car.pos.x + fx * off, pz = car.pos.z + fz * off;
                const dx = o.position.x - px, dz = o.position.z - pz;
                if (dx * dx + dz * dz < (c.r + 0.93) ** 2) {
                    // Boop! the cone goes flying (no damage, but no perfect park either)
                    c.knocked = true;
                    const d = Math.hypot(dx, dz) || 1, sp = car.speed * 1.5 + 2;
                    c.v.set(dx / d * sp, 2.6 + car.speed * 0.4, dz / d * sp);
                    c.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14);
                    S.perfect = false;
                    tone(220, 0.1, "square", 0.15);
                    car.fx.burst(o.position.x, 0.4, o.position.z, 8, 3, [1, 0.34, 0.13], 0.25, 0.5);
                    rumble(0.2, 0.4, 80);
                    break;
                }
            }
        }
        if (c.knocked && !c.rest) {
            c.v.y -= 9.8 * dt;
            o.position.addScaledVector(c.v, dt);
            o.rotation.x += c.spin.x * dt; o.rotation.y += c.spin.y * dt; o.rotation.z += c.spin.z * dt;
            if (o.position.y <= 0.13 && c.v.y < 0) {
                o.position.y = 0.13;
                c.v.y *= -0.35; c.v.x *= 0.6; c.v.z *= 0.6; c.spin.multiplyScalar(0.6);
                if (Math.abs(c.v.y) < 0.6 && Math.hypot(c.v.x, c.v.z) < 0.5) {
                    // settle lying on its side
                    c.rest = true;
                    o.rotation.set(Math.PI / 2, o.rotation.y, 0);
                }
            }
        }
    }
}

function updatePed(dt, live) {
    const ped = S.L.ped;
    if (!ped) return;
    const p = ped.person, o = p.obj, car = S.lot.car;
    if (ped.delay > 0) { ped.delay -= dt; if (ped.delay <= 0) o.visible = true; return; }
    if (ped.state === "fallen") {
        ped.fallT = Math.min(1, ped.fallT + dt * 3);
        o.rotation.x = -ped.fallT * Math.PI / 2;
        o.position.y = 0.2 * ped.fallT;
        p.update(dt, { walk: 0 });
        return;
    }
    // wait politely if the car is blocking the way
    const ahead = (car.pos.x - o.position.x) * ped.dir;
    const blocked = live && ahead > 0 && ahead < 2.9 && Math.abs(car.pos.z - o.position.z) < 1.9;
    const sp = blocked ? 0 : ped.speed;
    o.position.x += ped.dir * sp * dt;
    p.update(dt, { walk: sp, talk: blocked });
    if (blocked && !ped.ahem) { ped.ahem = true; showBubble(o, "Ahem!", 2.3, 1.2); }
    if (!blocked) ped.ahem = false;
    if (Math.abs(o.position.x) > 18) { o.visible = false; S.L.ped = null; return; }
    if (!live) return;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    for (const off of [1.15, -1.15]) {
        const px = car.pos.x + fx * off, pz = car.pos.z + fz * off;
        const dx = o.position.x - px, dz = o.position.z - pz;
        const d = Math.hypot(dx, dz);
        if (d < 0.93 + 0.32) {
            if (Math.abs(car.vF) > SLOW) {
                // rolling INTO them is a fail; a passer-by bumping a parked car isn't
                ped.state = "fallen";
                S.failHit = { who: "pedestrian" };
                fail();
                return;
            }
            const k = (0.93 + 0.32 - d) / (d || 1);
            o.position.x += dx * k; o.position.z += dz * k;
            if (!ped.hey) { ped.hey = true; showBubble(o, "Hey!", 2.3, 1.0); }
        }
    }
}

function collideTraffic() {
    const car = S.lot.car;
    for (const t of S.L.traffic) {
        for (const off of [-t.len, 0, t.len]) {
            const x = t.obj.position.x + off * t.dir, z = t.obj.position.z;
            const dx = x - car.pos.x, dz = z - car.pos.z;
            if (dx * dx + dz * dz > 9) continue;
            const imp = car.collideStatic(x, z, 0.95);
            if (imp > 0 || dx * dx + dz * dz < 3.4) {
                t.speed = 0;
                car.applyImpulse(t.dir * 3, 0, (Math.random() - 0.5) * 2);
                v1.set((x + car.pos.x) / 2, 0.7, (z + car.pos.z) / 2);
                LOT.addDent(car.tilt, v1, 0.8);
                A.sfxCrash(0.8);
                S.failHit = { who: "traffic" };
                fail();
                return;
            }
        }
    }
}

// cameras track Lulu · LEDs blink · the bay chevron bobs · the sasquatch watches
function animateLot(dt) {
    const L = S.L, car = S.lot.car;
    if (!L) return;
    LOT.blinkLeds(ctx.time);
    const tgt = v2.set(car.pos.x, 0.8, car.pos.z);
    for (const c of L.cams) {
        if (!c.head) continue;
        c.head.getWorldPosition(v1);
        const dx = tgt.x - v1.x, dz = tgt.z - v1.z;
        const yaw = Math.atan2(dx, dz), pitch = Math.atan2(v1.y - tgt.y, Math.hypot(dx, dz));
        c.yaw += wrapAngle(yaw - c.yaw) * Math.min(1, dt * 6);
        c.pitch += (pitch - c.pitch) * Math.min(1, dt * 6);
        c.head.rotation.y = c.yaw;
        c.head.rotation.x = c.pitch;
        const dist = v1.distanceTo(tgt);
        c.beam.scale.z = Math.max(0.5, dist - 1.4);
        c.beamMat.map.repeat.y = c.beam.scale.z / 0.7;
        c.beamMat.map.offset.y -= dt * 1.8;
        c.beamMat.opacity = S.phase === "drive" ? 0.7 : 0.35;
    }
    if (L.chevron) {
        L.chevron.visible = S.phase === "drive" || S.phase === "intro";
        L.chevron.position.y = 2.4 + Math.sin(ctx.time * 3) * 0.25;
        L.chevron.rotation.y += dt * 1.5;
    }
    if (L.sasquatch) {
        L.sasquatch.face(car.pos.x, car.pos.z, dt, 3);
        L.sasquatch.update(dt, { cheer: S.result === "success", talk: S.result === "fail" });
    }
    if (S.flashT > 0) { S.flashT -= dt; PH.flash(S.flashT / 0.2); } else PH.flash(0);
    if (S.lot.kids) for (const k of S.lot.kids) if (k.obj.visible) k.update(dt, { cheer: true });
    if (S.bubble) S.bubble.sprite.position.y = S.bubble.baseY + Math.sin(ctx.time * 4) * 0.08;
    if (S.bubble && (S.bubble.life -= dt) <= 0 && S.bubble.temp) removeBubble();
}

function partyGhosts() {
    const mp = ctx.mp;
    const list = mp && mp.parkingGhosts ? mp.parkingGhosts() : null;
    if (list || (S.lot.ghosts && Object.keys(S.lot.ghosts).length)) LOT.updateLotGhosts(S.lot, list || [], ctx.time);
}

// ── success / fail (triggerParkingSuccess / triggerParkingFail) ────────────
function calcStars() {
    if (S.perfect && !S.touched) return 3;
    if (!S.touched) return 2;
    return 1;
}

function success() {
    S.result = "success";
    S.phase = "result"; S.t = 0;
    S.resultT = 3.0;
    S.kidsInCar = true;
    for (const k of LOT.makeKids(S.lot)) k.obj.visible = true;
    notes([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.18, "triangle", 0.22]], 0.1);
    rumble(0.3, 0.7, 300, true);
    const stars = calcStars();
    const levelBonus = S.challenge ? S.level * 25 : 50;
    const bonus = levelBonus + stars * 15;
    S.stars = stars; S.bonus = bonus;
    addCoins(bonus, "parking");
    if (S.challenge) {
        S.chCoins += bonus;
        S.chStars += stars;
        const lvl = S.level;
        shared.update(s => {
            s.parkingTotalStars = (s.parkingTotalStars || 0) + stars;
            if (stars === 3) s.parkingPerfectRuns = (s.parkingPerfectRuns || 0) + 1;
            if (lvl > (s.parkingBestLevel || 0)) s.parkingBestLevel = lvl;
        });
    } else {
        addScore(500, "parking");
    }
    P3.parks++; saveSoon();
    emit("stat", { id: "parks", n: 1 });
    if (stars === 3) emit("stat", { id: "perfectParks", n: 1 });
    emit("parking:result", { stars, coins: bonus, level: S.level, mode: S.challenge ? "challenge" : "casual", ok: true });
    showBubble(S.lot.car.obj, "YAY ICE CREAM!", 2.5, 99, false, -2.2);
    PH.hint("");
    PH.holdBar(0);
    PH.vignette(0);
    const perfect = stars >= 3 ? `<div class="perfect">✨ PERFECT PARK! ✨</div>` : "";
    const pay = `${stars > 0 ? "⭐".repeat(stars) + " · " : ""}+${bonus} coins${S.challenge ? "" : " · +500 score"}`;
    PH.big(`${perfect}<h1>PARKED! 🎉</h1><div class="sub">ICE CREAM TIME!</div><div class="pay">${pay}</div><div class="ph-rate" style="opacity:0"></div>`);
    PH.rate(stars, 0);
    PH.tint("radial-gradient(ellipse at center, rgba(76,175,80,0) 45%, rgba(76,175,80,0.35) 100%)", 1);
    PH.intro("", "", 0);
    updateBar();
}

function fail() {
    if (S.phase !== "drive") return;
    S.result = "fail";
    S.phase = "result"; S.t = 0;
    S.resultT = 4.0;
    A.sfxCrash(0.9);
    setTimeout(wompWomp, 300);
    rumble(1, 1, 450, true);
    if (S.challenge) S.lives--;
    else {
        const G = ctx.G;
        G.hearts = Math.max(0, (G.hearts || 0) - 1);
        H.setHearts(G.hearts, G.maxHearts || 3);
        emit("damage", { power: 0.8, why: "Dinged a car parking", source: "parking" });
    }
    P3.fails++; saveSoon();
    emit("parking:result", { stars: 0, coins: 0, level: S.level, mode: S.challenge ? "challenge" : "casual", ok: false, fail: S.failHit && S.failHit.who });
    PH.hint(""); PH.holdBar(0); PH.vignette(0);
    const who = S.failHit && S.failHit.who;
    PH.big(`<h1>CRASH!</h1><div class="sub">${FAIL_MSGS[who] || FAIL_MSGS.parked}</div><div class="heart">-1 ♥</div>`, true);
    PH.tint("rgba(0,0,0,0.32)", 1);
    PH.intro("", "", 0);
    updateBar();
    // the angry grandpa climbs out of the car she dinged (or storms over from the sidewalk)
    const car = S.lot.car;
    const ang = spawnPerson("parking_angryman");
    const fromCar = S.failHit && S.failHit.car;
    if (fromCar) ang.obj.position.set(fromCar.obj.position.x, 0, fromCar.obj.position.z + 1.7);
    else ang.obj.position.set(car.pos.x - 4, 0.16, S.L.curbZ - 1.2);
    S.lot.content.add(ang.obj);
    S.angry = { person: ang, t: 0 };
}

function updateResult(dt, P) {
    const lot = S.lot, car = lot.car;
    S.resultT -= dt;
    car.vx *= Math.exp(-4 * dt); car.vz *= Math.exp(-4 * dt);
    car.step(dt, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true }, { offroad: 0 });
    car.updateVisual(dt, ctx.time, { steer: 0, throttle: 0, brake: 1 }, false);
    A.updateEngine(0, 0, 0, 0, false, true);
    updateCones(dt, false);
    updatePed(dt, false);
    LOT.updateTraffic(lot, S.L, dt);
    animateLot(dt);
    if (S.resultT > 0.3 && S.t > 0.3) PH.skip(`${glyph("confirm")} continue`); else PH.skip("");
    if ((P.confirm || P.start) && S.resultT > 0.3 && S.t > 0.3) S.resultT = 0.1;   // skip like the 2D click
    if (S.result === "success") {
        // confetti + the star rating fading in
        for (let i = 0; i < 2; i++) {
            const c = [[1, 0.5, 0.67], [1, 0.84, 0], [0.31, 0.76, 0.97], [0.5, 0.78, 0.52], [1, 0.72, 0.3]][Math.floor(Math.random() * 5)];
            car.fx.emit(car.pos.x + (Math.random() - 0.5) * 12, 7 + Math.random() * 2, car.pos.z + (Math.random() - 0.5) * 9,
                (Math.random() - 0.5) * 1.5, -1.5 - Math.random() * 2, (Math.random() - 0.5) * 1.5, 0.28, 2.2, c);
        }
        PH.rate(S.stars, clamp((2.5 - S.resultT) * 2, 0, 1));
    } else {
        // Lulu cries; grandpa storms over and yells
        if (Math.random() > 0.6) {
            const fx = Math.sin(car.h), fz = Math.cos(car.h), lx = Math.cos(car.h), lz = -Math.sin(car.h);
            car.fx.emit(car.pos.x + lx * 0.38 - fx * 0.38, 1.6, car.pos.z + lz * 0.38 - fz * 0.38, (Math.random() - 0.5) * 0.5, 0.6, (Math.random() - 0.5) * 0.5, 0.12, 0.6, [0.31, 0.76, 0.97]);
        }
        const a = S.angry;
        if (a) {
            a.t += dt;
            const o = a.person.obj;
            const lx = Math.cos(car.h), lz = -Math.sin(car.h);
            const side = (o.position.x - car.pos.x) * lx + (o.position.z - car.pos.z) * lz >= 0 ? 1 : -1;
            v1.set(car.pos.x + lx * 2.0 * side, 0, car.pos.z + lz * 2.0 * side);
            const d = Math.hypot(v1.x - o.position.x, v1.z - o.position.z);
            if (d > 0.15) {
                const sp = Math.min(d, 2.2 * dt);
                o.position.x += (v1.x - o.position.x) / d * sp;
                o.position.z += (v1.z - o.position.z) / d * sp;
                if (o.position.z > S.L.curbZ) o.position.y = 0;
                a.person.face(v1.x, v1.z, dt, 10);
                a.person.update(dt, { walk: 2.2 });
            } else {
                a.person.face(car.pos.x, car.pos.z, dt, 8);
                a.person.update(dt, { talk: true, wave: true });
                if (!a.yelled) { a.yelled = true; showBubble(o, "WHO TAUGHT YOU\nTO DRIVE!?", 2.4, 99, false); tone(200, 0.15, "sawtooth", 0.08); }
            }
        }
    }
    if (S.resultT <= 0) { S.phase = "outro"; S.t = 0; PH.skip(""); }
}

// ── routing after the result (updateParkingResult) ───────────────────────
function route() {
    const ok = S.result === "success";
    PH.big(""); PH.tint("transparent", 0);
    removeBubble();
    if (S.angry) { S.angry.person.obj.removeFromParent(); S.angry = null; }
    if (typeof S.opts.onDone === "function") {
        const cb = S.opts.onDone, res = { ok, stars: S.stars, coins: S.bonus };
        leaveLot();
        try { cb(res); } catch (e) { console.error("[parking] onDone", e); setState("title"); }
        return;
    }
    if (S.from === "pullover") {
        // Pulled over → she steps out + walks off, THEN the foot world (park or no park)
        if (ok) emit("stat", { id: "parks3", n: 1 });   // weekly quest: pull-over park completed
        if (ctx.foot && ctx.foot.start) beginWalkout();
        else if (!ok && (ctx.G.hearts || 0) <= 0) toGameOver();
        else returnToDriving(ok ? `🍦 ICE CREAM TIME! +${S.bonus} coins` : "Better luck next time!");
        return;
    }
    if (S.challenge) {
        if (ok) {
            S.level++;
            if (S.level > 10) finishChallenge(true);
            else beginLevel();
        } else if (S.lives <= 0) finishChallenge(false);
        else beginLevel();       // retry the same level
        return;
    }
    if (S.from === "foot") {
        leaveLot();
        if (ctx.foot && ctx.foot.start) ctx.foot.start("parked"); else setState("title");
        return;
    }
    if (!ok && (ctx.G.hearts || 0) <= 0) {
        // out of hearts → the car's wrecked, Lulu sets off on foot
        leaveLot();
        if (ctx.foot && ctx.foot.start) ctx.foot.start("carWreck", { from: "parkingCrash" }); else toGameOver();
        return;
    }
    returnToDriving(ok ? "🍦 ICE CREAM TIME! +50 coins" : "Better luck next time!");
}

function toGameOver() {
    leaveLot();
    setState("gameover", { why: "parking", source: "parking", quote: `"Who taught you to PARK?!" — the man whose car you dinged 🚗💢` });
}

/** Back onto the road where she pulled over (returnToDriving in 2D). */
function returnToDriving(msg) {
    leaveLot();
    const G = ctx.G, car = ctx.car, road = ctx.world.road;
    G.hearts = Math.max(1, G.hearts || 0);   // never resume driving with 0 hearts
    H.setHearts(G.hearts, G.maxHearts || 3);
    const near = road.nearest(car.pos.x, car.pos.z, car.s, {});
    const p = road.point(near.s + 3, 5.25, {});        // back into the outer lane of OUR side
    car.place(p.x, p.z, p.h);
    car.s = near.s + 3; car.d = 5.25;
    const sp = 8;
    car.vx = Math.sin(car.h) * sp; car.vz = Math.cos(car.h) * sp;
    car.showDriver(true);
    car.obj.visible = true;
    G.invT = Math.max(G.invT || 0, 2.0);
    for (const c of ctx.traffic.cars.slice()) if (Math.abs(c.s - car.s) < 30 && !c.keep) ctx.traffic.remove(c);
    if (ctx.cam) ctx.cam.snap();
    A.setMusic("../luludriving.mp3");
    setState("playing");
    if (msg) H.toast(msg, "gold");
}

// ── the walk-out: Lulu steps out of the parked car and walks off ───────────
function beginWalkout() {
    const lot = S.lot, car = lot.car;
    car.showDriver(false);
    for (const k of lot.kids || []) k.obj.visible = false;
    const style = ctx.car && ctx.car.hairStyle;
    const key = style && models["luluPerson_" + style] ? "luluPerson_" + style : "luluPerson";
    const lulu = spawnPerson(key, ctx.car && ctx.car.hairColor ? { colors: { Hair: ctx.car.hairColor } } : {});
    const lx = Math.cos(car.h), lz = -Math.sin(car.h);   // the driver's side (her left)
    let side = 1;
    if (car.pos.z + lz * 1.3 < S.L.curbZ + 0.3) side = -1;   // curb side? climb out the other way
    const from = new THREE.Vector3(car.pos.x + lx * 1.25 * side, 0, car.pos.z + lz * 1.25 * side);
    const dx = car.pos.x < 0 ? 1 : -1;                       // toward the middle of the lot
    const to = new THREE.Vector3(from.x + dx * 2.0, 0, from.z + 1.3);
    lulu.obj.position.copy(from);
    lulu.obj.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    lot.content.add(lulu.obj);
    S.walker = { person: lulu, from, to };
    S.phase = "walkout"; S.t = 0;
    A.updateEngine(0, 0, 0, 0, false, false);
    tone(330, 0.08, "triangle", 0.12);
    tone(392, 0.1, "triangle", 0.12, 0, 0.1);
}

function updateWalkout(dt) {
    const w = S.walker;
    animateLot(dt);
    S.lot.car.updateVisual(dt, ctx.time, { steer: 0, throttle: 0, brake: 0 }, false);
    const pr = clamp(S.t / 1.1, 0, 1);
    w.person.obj.position.lerpVectors(w.from, w.to, pr);
    w.person.update(dt, { walk: pr < 1 ? 1.4 : 0, wave: pr >= 1 });
    PH.white(clamp((S.t - 1.25) / 0.4, 0, 1));
    if (S.t >= 1.65) handOffToFoot();
}

function handOffToFoot() {
    leaveLot();
    const car = ctx.car;
    car.vx = car.vz = 0; car.spin = 0;
    car.showDriver(false);
    S.phase = "handoff"; S.t = 0;
    try {
        ctx.foot.start("droveOff", { from: "parking", parked: true });
    } catch (e) {
        console.error("[parking] foot.start failed", e);
        returnToDriving("");
    }
}

// ── Parking Challenge end screen (drawParkingEnd) ──────────────────────────
function finishChallenge(victory) {
    S.endStats = { level: Math.min(S.level, 10), stars: S.chStars, coins: S.chCoins, victory };
    emit("stat", { id: "parkingChallenges", n: 1 });
    if (victory) emit("stat", { id: "parkingMaster", n: 1 });
    setState("parkingEnd");
}

registerState("parkingEnd", {
    hud: false, touch: false, pausable: false, world: false,
    enter() {
        PH.show(false);
        if (S.lot) { S.lot.set.show(); S.orbit = 0; }
        const st = S.endStats || { level: 1, stars: 0, coins: 0, victory: false };
        const s2 = shared.get();
        if (st.victory) { A.sfxFanfare(); rumble(0.4, 0.8, 500, true); }
        H.showScreen(`
            <h2>${st.victory ? "🏆 MASTER PARKER!" : "🅿️ PARKING OVER"}</h2>
            <p><b>${st.victory ? "You beat ALL 10 levels!" : `You reached Level ${st.level}`}</b></p>
            <p class="fine" style="margin-top:10px">THIS RUN</p>
            <div class="stats">
                <div class="stat"><b>${st.level}</b><span>LEVEL REACHED</span></div>
                <div class="stat"><b>★ ${st.stars}</b><span>STARS EARNED</span></div>
                <div class="stat"><b>$ ${st.coins}</b><span>COINS EARNED</span></div>
            </div>
            <p class="fine">ALL-TIME</p>
            <div class="stats">
                <div class="stat"><b>${s2.parkingBestLevel || 0}</b><span>BEST LEVEL</span></div>
                <div class="stat"><b>${(wallet.coins).toLocaleString()}</b><span>💰 COINS</span></div>
                <div class="stat"><b>${s2.parkingPerfectRuns || 0}</b><span>PERFECT PARKS</span></div>
            </div>`,
            [
                { label: `🅿️ Play again ${glyph("confirm")}`, action: () => { H.hideScreen(); start({ challenge: true }); } },
                { label: "⌂ Title screen", cls: "purple", action: () => { H.hideScreen(); setState("title"); } },
            ], { onBack: () => { H.hideScreen(); setState("title"); } });
    },
    exit(next) {
        H.hideScreen();
        if (next !== "parking") leaveLot();
        else { S.active = false; if (S.lot) LOT.clearLot(S.lot); }
    },
    update(dt, P) {
        H.menuInput(P);
        if (!S.lot) return;
        S.orbit = (S.orbit || 0) + dt * 0.2;
        const c = S.lot.set.camera, car = S.lot.car;
        c.position.set(car.pos.x + Math.sin(S.orbit) * 11, 6.5, car.pos.z + Math.cos(S.orbit) * 11);
        c.lookAt(car.pos.x, 0.8, car.pos.z);
        animateLot(dt);
        if (S.lot.kids) for (const k of S.lot.kids) if (k.obj.visible) k.update(dt, { cheer: true });
    },
});

// ── speech bubbles ─────────────────────────────────────────────────────────
function showBubble(obj, text, y = 2.4, life = 2, temp = true, side = 0) {
    removeBubble();
    const sp = LOT.bubbleSprite(text, { w: text.length > 12 ? 3.4 : 2.6 });
    sp.position.set(side, y, 0);
    sp.scale.multiplyScalar(1 / (obj.scale.x || 1));
    obj.add(sp);
    S.bubble = { sprite: sp, baseY: y, life, temp };
}
function removeBubble() {
    if (!S.bubble) return;
    S.bubble.sprite.removeFromParent();
    S.bubble.sprite.userData.dispose();
    S.bubble = null;
}

// ── the lot camera: overhead (2D-like), chase, bird's eye; swoops + orbits ──
function camTarget(out) {
    const car = S.lot.car, L = S.L;
    const bx = (L.zx0 + L.zx1) / 2, bz = (Math.max(L.curbZ, L.zz0) + L.zz1) / 2;
    return out.set(car.pos.x * 0.55 + bx * 0.45, 0.4, car.pos.z * 0.55 + bz * 0.45 - 0.8);
}
function camWanted(mode, posOut, lookOut) {
    const car = S.lot.car, cam = S.lot.set.camera;
    const portrait = cam.aspect < 1;
    if (S.phase === "result" || S.phase === "outro") {
        S.orbit = (S.orbit || 0) + 0.004;
        const a = -0.45 + Math.sin(ctx.time * 0.35) * 0.45;
        const R = (S.result === "fail" ? 10.5 : 11) * (portrait ? 1.35 : 1);
        posOut.set(car.pos.x + Math.sin(a) * R, S.result === "fail" ? 5.4 : 6.6, car.pos.z + Math.cos(a) * R);
        lookOut.set(car.pos.x, 2.4, car.pos.z);
        return portrait ? 62 : 48;
    }
    if (S.phase === "walkout" && S.walker) {
        const p = S.walker.person.obj.position;
        posOut.set(p.x + 1.5, 4.8, p.z + 7.5);
        lookOut.set(p.x, 1.0, p.z);
        return portrait ? 62 : 48;
    }
    if (mode === 1) {   // chase
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        posOut.set(car.pos.x - fx * 6.6, 2.9, car.pos.z - fz * 6.6);
        lookOut.set(car.pos.x + fx * 3, 0.8, car.pos.z + fz * 3);
        return portrait ? 72 : 60;
    }
    // overhead: frame Lulu AND her bay, zooming in as she closes on it (curb at the top, like 2D)
    camTarget(lookOut);
    const L = S.L, bx = (L.zx0 + L.zx1) / 2, bz = (Math.max(L.curbZ, L.zz0) + L.zz1) / 2;
    const sep = Math.hypot(car.pos.x - bx, car.pos.z - bz);
    const hgt = clamp(9.5 + sep * 0.6, 11, 21) * (portrait ? 1.45 : 1);
    if (mode === 2) { posOut.set(lookOut.x, hgt * 1.5, lookOut.z + 0.6); return portrait ? 56 : 50; }
    posOut.set(lookOut.x, hgt, lookOut.z + hgt * 0.78);
    return portrait ? 62 : 50;
}
function snapCam(kind) {
    if (!S.lot) return;
    const cam = S.lot.set.camera;
    camWanted(P3.cam, S.camPos, S.camLook);
    if (kind === "intro") S.camPos.add(v3.set(0, 26, 20));
    cam.position.copy(S.camPos);
    cam.lookAt(S.camLook);
}
function updateCam(dt) {
    const cam = S.lot.set.camera;
    const fov = camWanted(P3.cam, v1, v2);
    const rate = S.phase === "intro" ? 3.2 : S.phase === "drive" ? 4.5 : 2.2;
    S.camPos.lerp(v1, Math.min(1, dt * rate));
    S.camLook.lerp(v2, Math.min(1, dt * rate * 1.4));
    cam.position.copy(S.camPos);
    if (S.shake > 0 && !save3d.settings.calm) {
        const k = S.shake * 0.35;
        cam.position.x += (Math.random() - 0.5) * k; cam.position.y += (Math.random() - 0.5) * k; cam.position.z += (Math.random() - 0.5) * k;
    }
    S.shake = Math.max(0, S.shake - dt * 1.5);
    cam.lookAt(S.camLook);
    cam.fov += (fov - cam.fov) * Math.min(1, dt * 3);
    cam.updateProjectionMatrix();
}

// ── title menu: 🅿️ Parking Challenge (order 40, unlock 1,000 coins) ────────
function unlocked() { return !!shared.get().parkingUnlocked; }
addMenuItem("title", {
    id: "parking", order: 40, cls: "alt",
    label: () => unlocked() ? "🅿️ Parking Challenge" : `🅿️ Parking Challenge 🔒 ${UNLOCK_COST.toLocaleString()}`,
    action: () => { if (unlocked()) start({ challenge: true }); else showUnlock(); },
});
addMenuItem("titleInfo", {
    id: "parkingBest",
    visible: () => (shared.get().parkingBestLevel || 0) > 0,
    label: () => `<p class="fine" style="color:#1565C0;opacity:.85">🅿 Best Level: ${shared.get().parkingBestLevel}</p>`,
});

function showUnlock() {
    const have = wallet.coins;
    const back = () => showTitle(true);
    if (have < UNLOCK_COST) {
        H.showScreen(`<h2>🅿️ Parking Challenge</h2>
            <div class="quote">"Ten levels of parallel parking. Tighter spots, nosy cameras, cones, pedestrians… and Sasquatch."</div>
            <p>🔒 Unlock it once for <b>${UNLOCK_COST.toLocaleString()} coins</b> — you have <b>${have.toLocaleString()}</b>.</p>
            <p class="fine">Coins are shared with the 2D game. Pull over on the road (slow down in a side lane) to practise parking and earn some!</p>`,
            [{ label: `OK ${glyph("back")}`, cls: "alt", action: back }], { onBack: back });
        return;
    }
    H.showScreen(`<h2>🅿️ Parking Challenge</h2>
        <div class="quote">"Ten levels of parallel parking. Tighter spots, nosy cameras, cones, pedestrians… and Sasquatch."</div>
        <p>Unlock it forever for <b>${UNLOCK_COST.toLocaleString()} coins</b>? You have <b>${have.toLocaleString()}</b>.</p>`,
        [
            { label: `🔓 Unlock — ${UNLOCK_COST.toLocaleString()} coins ${glyph("confirm")}`, action: () => {
                if (!wallet.spend(UNLOCK_COST)) { H.toast("🔒 Not enough coins!", "red"); back(); return; }
                shared.update(s => { s.parkingUnlocked = true; });
                A.sfxFanfare();
                H.showScreen(`<h2>🅿️ Unlocked!</h2><p>The Parking Challenge is yours — in both the 2D and 3D games.</p>`,
                    [{ label: `▶ Start Level 1 ${glyph("confirm")}`, action: () => { H.hideScreen(); start({ challenge: true }); } },
                     { label: "⌂ Back", cls: "alt", action: back }], { onBack: back });
            } },
            { label: "⌂ Not now", cls: "alt", action: back },
        ], { onBack: back });
}

// a pause-menu shortcut while parking: retry the level
addMenuItem("pause", { id: "parkRetry", order: 75, cls: "pink", label: "↺ Retry this park",
    visible: () => ctx.state === "parking" && S.challenge && S.phase === "drive",
    action: () => { resume(); beginLevel(); } });

// keep the 3D parking stats on the scrapbook-ish title info for the curious
on("title", () => { if (S.active) leaveLot(); });

// test / debug hook
ctx.parking._debug = S;
export { S as parkingSession, pullover };
