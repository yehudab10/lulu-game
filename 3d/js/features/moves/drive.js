// features/moves — the DRIVING moves:
//   🌀 drift boost   hold the handbrake (touch: brake) + steer at speed → sparks charge
//                    BLUE → ORANGE → PURPLE → release for a mini-turbo. While drifting the
//                    wheel sets the ARC (into the drift = tight, counter-steer = straight /
//                    slightly out) and the body hangs out at a drift angle (kart-style: the
//                    path stays controllable on a highway).
//   🚀 rocket start  gas in the last ~0.45 s before GO (3-2-1 or the driveway pull-out);
//                    too early on the countdown = wheelspin
//   💨 slipstream    tuck in behind a car/truck to charge the draft, pull out → slingshot
//   😎 close shaves  near misses (core closeCall) + the wrong side of the road as a link
//   ↩️ bootlegger    reverse fast, steer + handbrake → a 180° and away
//   🚓 PIT           nudge a cruiser's rear quarter at an angle → it spins out
// Everything goes through the controls / update hooks (no core edits): turbos add
// forward acceleration after the physics step and light the car's own nitro flames.
import * as THREE from "three";
import { ctx, on, hook, emit, wrapAngle } from "../../core/ctx.js";
import { input } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import {
    S, C, live, clamp, lerp, touch, addMove, keepAlive, quality, bestOf, breakCombo, bank, reset,
    rumble, triggerTick, flashPad, spark, callout, meter, TIER_RGB, TIER_CSS, TIER_NAME, firstTime, PERF,
} from "./common.js";

const WB = 2.56;                         // car.js WHEELBASE
export const TUNE = {
    drift: { minV: 13, keepV: 8.5, minSteer: 0.3, tiers: [0.8, 1.8, 3.0], yawOut: -0.08, yawIn: 0.45, angle: [0.3, 0.52] },
    turbo: { dur: [0, 0.55, 0.95, 1.5], acc: [0, 7, 9.5, 12], pts: [0, 150, 350, 700] },
    rocket: { perfect: 0.45, early: 0.9, late: 0.3 },
    draft: { minV: 15, tail: [0.2, 11], lat: 1.15, charge: 1.3, out: 1.9 },
    wrong: { minV: 15, d: -0.6, min: 1.5 },
    boot: { rev: 5.5, steer: 0.5, max: 2.4, fast: 8.3 },
    pit: { imp: [0.8, 8], lon: [-4.8, -0.2], lat: 0.55, align: 0.5 },
};

// ── state ─────────────────────────────────────────────────────────────────
export const D = { on: false, dir: 0, charge: 0, tier: 0, t: 0, u: 0, vis: 0, visSet: false, touchHb: false };
export const T = { left: 0, acc: 0, tier: 0, src: "" };
export const R = { pressT: -1, held: false, lastT: 0, src: "", spin: 0, late: 0, gasPrev: false };
export const DR = { car: null, charge: 0, grace: 0, k: 1 };
export const W = { t: 0, shown: -1 };
export const B = { on: false, t: 0, acc: 0, lastH: 0, dir: 0, rev: 0, done: false };

const jump = () => (ctx.play && ctx.play.jump) || null;
const inAir = () => { const J = jump(); return !!(J && (J.air || J.onRamp)); };
const driving = () => ctx.state === "playing";
function handling() {
    const st = (ctx.car && ctx.car.stats) || {};
    let k = 1;
    try { if (ctx.rides && typeof ctx.rides.moveScale === "function") k = ctx.rides.moveScale() || 1; } catch (e) { k = 1; }
    return { grip: st.grip || 1, acc: st.acc || 1, k };
}

/** A mini-turbo: tier 1–3 (strength + length), from any move. */
export function turbo(tier, src = "") {
    if (!tier || (ctx.G && ctx.G.noBoost)) return;
    const h = handling();
    T.tier = tier;
    T.left = Math.max(T.left, TUNE.turbo.dur[tier]);
    T.acc = TUNE.turbo.acc[tier] * Math.sqrt(h.acc) * h.k;
    T.src = src;
    if (!ctx.skipping) A.sfxBoost();
    rumble(0.25 + 0.15 * tier, 0.55, 160 + 60 * tier, true);
    triggerTick(0, 0.25 + 0.2 * tier, 140);
    const c = TIER_RGB[tier];
    flashPad([c[0] * 255 | 0, c[1] * 255 | 0, c[2] * 255 | 0], 0.25 + 0.1 * tier);
    emit("moves:turbo", { tier, src });
}

// ── drift ─────────────────────────────────────────────────────────────────
function startDrift(dir) {
    D.on = true; D.dir = dir; D.charge = 0; D.tier = 0; D.t = 0; D.u = 0;
    emit("moves:drift", { on: true, dir });
}
function endDrift(release) {
    if (!D.on) return;
    const tier = D.tier;
    D.on = false;
    emit("moves:drift", { on: false, tier: release ? tier : 0 });
    if (!release || tier < 1) return;
    turbo(tier, "drift");
    if (tier >= 2) quality("drift2");
    if (tier >= 3) quality("drift3");
    emit("stat", { id: "movesTurbo" + tier, n: 1 });
    addMove("drift", TUNE.turbo.pts[tier], `${TIER_NAME[tier]} TURBO!`, { color: TIER_CSS[tier] });
}
function driftControls(ctl, dt) {
    const car = ctx.car, vF = car.vF;
    const tDrift = touch() && ctl.brake > 0.5 && Math.abs(ctl.steer) > 0.45;
    const hb = !!ctl.handbrake || tDrift || (D.on && D.touchHb && touch() && ctl.brake > 0.5);
    if (!D.on) {
        if (!hb || vF < TUNE.drift.minV || Math.abs(ctl.steer) < TUNE.drift.minSteer || B.on) return;
        startDrift(Math.sign(ctl.steer));
        D.touchHb = tDrift && !ctl.handbrake;
    }
    if (!hb || vF < TUNE.drift.keepV) { endDrift(true); return; }
    // the wheel sets the arc: into the drift = tight, counter-steer = straighten (or drift out a little)
    const u = clamp(ctl.steer * D.dir, -1, 1), k = (u + 1) / 2;
    D.u = u;
    const w = D.dir * lerp(TUNE.drift.yawOut, TUNE.drift.yawIn, k);
    const maxAngle = 0.62 / (1 + vF / 13);
    ctl.steer = clamp(Math.atan(w * WB / Math.max(vF, 1)) / maxAngle, -1, 1);
    ctl.analog = true;
    ctl.handbrake = false;                 // the kart drift replaces the wild handbrake slide at speed
    if (D.touchHb || tDrift) ctl.brake = 0;
    // charge: tighter + faster = quicker; slidey cars (low grip) charge a touch faster
    const h = handling();
    const rate = (0.6 + 0.45 * k) * clamp(vF / 24, 0.6, 1.2) * clamp(1.25 - 0.25 * h.grip, 0.85, 1.15) * h.k;
    D.charge += rate * dt;
    D.t += dt;
    const ts = TUNE.drift.tiers;
    const tier = D.charge >= ts[2] ? 3 : D.charge >= ts[1] ? 2 : D.charge >= ts[0] ? 1 : 0;
    if (tier > D.tier) {
        D.tier = tier;
        if (!ctx.skipping) A.sfxCloseCall(2 + tier * 3);
        rumble(0.12 + 0.1 * tier, 0.45, 90, true);
        triggerTick(0, 0.2 + 0.15 * tier, 70);
        const c = TIER_RGB[tier];
        flashPad([c[0] * 255 | 0, c[1] * 255 | 0, c[2] * 255 | 0], 0.2);
    }
}
const _q = new THREE.Quaternion();
function driftVisual(dt) {
    const car = ctx.car, J = jump();
    const want = D.on ? D.dir * lerp(TUNE.drift.angle[0], TUNE.drift.angle[1], (D.u + 1) / 2) : 0;
    D.vis += (want - D.vis) * Math.min(1, dt * (D.on ? 7 : 9));
    if (!D.on && Math.abs(D.vis) < 0.003) D.vis = 0;
    if (D.vis === 0 && !D.visSet) return;
    D.visSet = D.vis !== 0;
    // the body hangs out at the drift angle (car.h is the travel direction; play owns rotation.y in the air)
    const spin = J ? J.spin : 0;
    if (car.model) car.model.rotation.y = spin - D.vis;
    const shell = ctx.foot && ctx.foot.shellObj;
    if (shell) shell.rotation.y = -D.vis;
}
function driftFx(dt) {
    if (!D.on) return;
    const car = ctx.car;
    keepAlive(0.9);
    const ts = TUNE.drift.tiers;
    const next = D.tier >= 3 ? 1 : (D.charge - (D.tier ? ts[D.tier - 1] : 0)) / (ts[D.tier] - (D.tier ? ts[D.tier - 1] : 0));
    meter(next, TIER_CSS[Math.min(3, D.tier + (D.tier >= 3 ? 0 : 1))], D.tier ? `DRIFT · ${TIER_NAME[D.tier]}` : "DRIFT");
    car.slip = Math.max(car.slip, 0.42);        // skid marks + tyre smoke from car.js
    if (D.tier < 1 || ctx.skipping) return;
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    const col = TIER_RGB[D.tier], n = D.tier >= 3 ? 2 : 1;
    for (let side = -1; side <= 1; side += 2) {
        const wx = car.pos.x - fx * 1.28 + rx * side * 0.8, wz = car.pos.z - fz * 1.28 + rz * side * 0.8;
        for (let i = 0; i < n; i++) {
            spark(wx, 0.18, wz, -fx * 3 + (Math.random() - 0.5) * 4 + car.vx * 0.6, 1.2 + Math.random() * 2.2, -fz * 3 + (Math.random() - 0.5) * 4 + car.vz * 0.6,
                0.16 + Math.random() * 0.14 + D.tier * 0.03, 0.22 + Math.random() * 0.16, col);
        }
    }
}

// ── turbo (after physics) ─────────────────────────────────────────────────
function turboTick(dt) {
    if (T.left <= 0) return;
    const car = ctx.car;
    T.left -= dt;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    if (car.vF > -1) { car.vx += fx * T.acc * dt; car.vz += fz * T.acc * dt; }
    car.boosting = true;                       // the car's own nitro flames (visual only; G.boosting stays the nitro's)
    if (!ctx.skipping && Math.random() < 0.6) {
        const c = TIER_RGB[T.tier];
        spark(car.pos.x - fx * 2.3, 0.45, car.pos.z - fz * 2.3, -fx * 4 + car.vx * 0.5, 0.6, -fz * 4 + car.vz * 0.5, 0.35, 0.25, c);
    }
    if (T.left <= 0) { T.left = 0; T.tier = 0; }
}

// ── rocket start: sampled inside the countdown / pull-out states ──────────
function sampleLaunch(id) {
    const g = input.throttle > 0.5;
    if (g && !R.held) R.pressT = ctx.stateT;
    if (!g) R.pressT = -1;
    R.held = g; R.lastT = ctx.stateT; R.src = id;
}
on("boot", () => {
    for (const id of ["intro", "worldDepart"]) {
        const def = ctx.states[id];
        if (!def || !def.update || def.update.__moves) continue;
        const orig = def.update;
        const wrapped = function (dt, P) { try { sampleLaunch(id); } catch (e) { console.error("[moves] launch", e); } return orig.call(this, dt, P); };
        wrapped.__moves = true;
        def.update = wrapped;
    }
});
function launch(kind) {
    const car = ctx.car, fx = Math.sin(car.h), fz = Math.cos(car.h);
    if (kind === "perfect") {
        car.vx += fx * 6; car.vz += fz * 6;
        turbo(3, "rocket");
        quality("perfect");
        emit("stat", { id: "movesPerfectStart", n: 1 });
        addMove("rocket", 400, "🚀 PERFECT START!", { color: TIER_CSS[3] });
    } else {
        car.vx += fx * 2.5; car.vz += fz * 2.5;
        turbo(1, "rocket");
        addMove("rocket", 150, "QUICK START!", { color: TIER_CSS[1] });
    }
}
function judgeLaunch(from) {
    R.late = 0;
    if (!live()) return;
    if (R.held && R.pressT >= 0) {
        const lead = R.lastT - R.pressT;
        if (lead <= TUNE.rocket.perfect) launch("perfect");
        else if (from === "intro" && lead > TUNE.rocket.early) {
            R.spin = 0.9;
            callout("WHEELSPIN!", "a hair too early", "red", 1.2);
            rumble(0.4, 0.3, 300, true);
        } else launch("good");
    } else R.late = TUNE.rocket.late;           // not on the gas yet: a quick reaction still counts
    R.pressT = -1; R.held = false;
}
function launchTick(dt) {
    const car = ctx.car;
    if (R.late > 0) {
        R.late -= dt;
        if (input.throttle > 0.5 && !R.gasPrev) { R.late = 0; launch("good"); }
    }
    R.gasPrev = input.throttle > 0.5;
    if (R.spin > 0) {
        R.spin -= dt;
        car.slip = Math.max(car.slip, 0.5);
        if (!ctx.skipping && Math.random() < 0.7) {
            const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h), s = Math.random() < 0.5 ? -1 : 1;
            car.fx.emit(car.pos.x - fx * 1.3 + rx * s * 0.8, 0.3, car.pos.z - fz * 1.3 + rz * s * 0.8, (Math.random() - 0.5) * 2, 1.2, (Math.random() - 0.5) * 2, 1.4, 0.9, TIER_RGB[0]);
        }
    }
}

// ── slipstream ────────────────────────────────────────────────────────────
function draftTick(dt) {
    const car = ctx.car, tr = ctx.traffic;
    let best = null, bestTail = 1e9;
    if (car.vF > TUNE.draft.minV && tr) {
        for (const c of tr.cars) {
            if (c.hit || c.dir < 0) continue;
            const gap = c.s - car.s;
            if (gap < 1 || gap > 20) continue;
            if (Math.abs(c.d - car.d) > TUNE.draft.lat) continue;
            const tail = gap - ((c.spec && c.spec.len) || 4.4) / 2 - 2.2;
            if (tail < TUNE.draft.tail[0] || tail > TUNE.draft.tail[1]) continue;
            if (tail < bestTail) { best = c; bestTail = tail; }
        }
    }
    if (best) {
        if (best !== DR.car) { DR.car = best; DR.k = best.kind === "truck" || ((best.spec && best.spec.len) || 0) > 6.2 ? 1.6 : best.kind === "van" ? 1.25 : 1; }
        DR.grace = 0.6;
        DR.charge = Math.min(1, DR.charge + dt / TUNE.draft.charge * DR.k * handling().k);
        if (DR.charge > 0.25) keepAlive(0.9);
        if (!D.on) meter(DR.charge, DR.charge >= 1 ? "#FFFFFF" : "#B3E5FC", DR.charge >= 1 ? "DRAFT READY — PULL OUT!" : "DRAFTING");
        if (!ctx.skipping && Math.random() < 0.5) {
            const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h), side = Math.random() < 0.5 ? -1 : 1;
            spark(car.pos.x + fx * 2.5 + rx * side * 1.1, 0.9 + Math.random() * 0.6, car.pos.z + fz * 2.5 + rz * side * 1.1, -fx * 9 + car.vx, 0, -fz * 9 + car.vz, 0.12, 0.3, TIER_RGB[0]);
        }
        return;
    }
    const c = DR.car;
    if (c) {
        const gap = c.s - car.s;
        if (DR.charge >= 0.999 && !c.hit && Math.abs(car.d - c.d) > TUNE.draft.out && gap > -3 && gap < 20) {
            const big = DR.k > 1.5;
            DR.car = null; DR.charge = 0;
            turbo(big ? 3 : 2, "slingshot");
            emit("stat", { id: "movesSlingshot", n: 1 });
            addMove("slingshot", big ? 450 : 300, big ? "💨 TRUCK SLINGSHOT!" : "💨 SLINGSHOT!", { color: "#B3E5FC" });
            return;
        }
        DR.grace -= dt;                         // a moment to swing out with the charge intact
        if (DR.grace <= 0 || c.hit || gap < -6) DR.car = null;
        else return;
    }
    DR.charge = Math.max(0, DR.charge - dt * 0.8);
}

// ── the wrong side of the road ────────────────────────────────────────────
function wrongTick(dt) {
    const car = ctx.car;
    const on = car.d < TUNE.wrong.d && car.vF > TUNE.wrong.minV && Math.abs(car.d) < 7.2;
    if (on) {
        W.t += dt;
        keepAlive(0.9);
        const whole = Math.floor(W.t);
        if (W.t > 1 && whole !== W.shown && !D.on) { W.shown = whole; callout("WRONG WAY", `${whole} s`, "pink", 1.1); }
        return;
    }
    if (W.t >= TUNE.wrong.min) {
        const t = W.t;
        bestOf("wrongway", t);
        addMove("wrongway", Math.round(t * 110), `WRONG WAY · ${t.toFixed(1)} s`, { color: "pink" });
    }
    W.t = 0; W.shown = -1;
}

// ── bootlegger ────────────────────────────────────────────────────────────
function bootControls(ctl, dt) {
    const car = ctx.car;
    if (!B.on) {
        const pull = !!ctl.handbrake || (touch() && ctl.throttle > 0.5);
        if (!pull || car.vF > -TUNE.boot.rev || Math.abs(ctl.steer) < TUNE.boot.steer) return;
        B.on = true; B.t = 0; B.acc = 0; B.lastH = car.h; B.dir = -Math.sign(ctl.steer); B.rev = -car.vF; B.done = false;
        rumble(0.3, 0.5, 200, true);
    }
    B.t += dt;
    if (!B.done) {
        const rem = Math.PI - Math.abs(B.acc);
        ctl.handbrake = true; ctl.throttle = 0; ctl.brake = 0;
        car.spin = B.dir * clamp(rem * 7, 2.5, 9);
        if (rem < 0.28) { B.done = true; car.spin *= 0.25; }
    } else ctl.handbrake = false;
}
function bootTick() {
    if (!B.on) return;
    const car = ctx.car;
    B.acc += wrapAngle(car.h - B.lastH);
    B.lastH = car.h;
    if (B.done && car.vF > 2) {
        B.on = false;
        const pro = B.rev >= TUNE.boot.fast;
        if (pro) quality("bootlegFast");
        turbo(pro ? 2 : 1, "bootleg");
        emit("stat", { id: "movesBootleg", n: 1 });
        addMove("bootleg", 800 + Math.round(B.rev * 40), "↩️ BOOTLEGGER!", { color: "gold" });
    } else if (B.t > TUNE.boot.max) B.on = false;
}

// ── PIT maneuver (on a cruiser's crash with Lulu) ─────────────────────────
const isCop = c => !!c && ((c.data && c.data.law) || c.kind === "cop" || c.kind === "lawK9car");
function tryPit(e) {
    const c = e.car, car = ctx.car, P = TUNE.pit;
    const imp = e.impact || 0;
    if (imp < P.imp[0] || imp > P.imp[1] || car.speed < 6) return false;
    if (c.data && c.data.movesPitT > ctx.time) return false;
    const cfx = Math.sin(c.h), cfz = Math.cos(c.h);
    const dx = car.pos.x - c.x, dz = car.pos.z - c.z;
    const lon = dx * cfx + dz * cfz, lat = dx * -cfz + dz * cfx;
    const align = Math.cos(wrapAngle(car.h - c.h));
    if (lon > P.lon[1] || lon < P.lon[0] || Math.abs(lat) < P.lat || align < P.align) return false;
    // spin it out: a clean directed spin and a few seconds out of the pursuit (law shakes it off at hitT > 2.8)
    const sp = c.hit ? Math.hypot(c.vx, c.vz) : c.speed;
    c.hit = true; c.hitT = -2.5;
    c.vx = cfx * sp * 0.8; c.vz = cfz * sp * 0.8;
    c.spinV = -Math.sign(lat || 1) * 6.5;
    if (c.data) c.data.movesPitT = ctx.time + 3;
    emit("moves:pit", { car: c });
    emit("stat", { id: "movesPit", n: 1 });
    addMove("pit", 1000, "🚓 PIT MANEUVER!", { color: "pink" });
    rumble(0.6, 0.7, 260, true);
    return true;
}

// ── wiring ────────────────────────────────────────────────────────────────
hook("controls", (ctl, dt) => {
    if (!live() || !driving()) { if (D.on) endDrift(false); B.on = false; return; }
    if (R.spin > 0) ctl.throttle *= 0.3;
    if (inAir()) { if (D.on) endDrift(false); return; }
    bootControls(ctl, dt);
    if (B.on) { if (D.on) endDrift(false); return; }
    driftControls(ctl, dt);
}, 6);

hook("update", (dt, P, controlsOn) => {
    if (!ctx.car) return;
    const t0 = performance.now();
    tick(dt, controlsOn);
    const ms = performance.now() - t0;
    PERF.ms += ms; PERF.n++; if (ms > PERF.max) PERF.max = ms;
}, -10);
function tick(dt, controlsOn) {
    driftVisual(dt);
    if (!live()) { T.left = 0; return; }
    if (!driving()) { if (ctx.state !== "intro") T.left = 0; return; }
    turboTick(dt);
    launchTick(dt);
    if (!controlsOn) return;
    driftFx(dt);
    if (ctx.foot && ctx.foot.active) return;
    draftTick(dt);
    wrongTick(dt);
    bootTick();
}

on("state", ({ from, to }) => {
    if (to === "playing" && (from === "intro" || from === "worldDepart")) judgeLaunch(from);
    if (to !== "playing") {
        if (D.on) endDrift(false);
        B.on = false; R.spin = 0; R.late = 0; DR.car = null; DR.charge = 0; W.t = 0;
    }
});
on("closeCall", e => {
    if (!live() || !driving()) return;
    addMove(e && e.oncoming ? "headon" : "nearmiss", e && e.oncoming ? 220 : 120, e && e.oncoming ? "😱 HEAD-ON DODGE" : "😎 CLOSE SHAVE", { color: e && e.oncoming ? "pink" : "" });
});
on("crash", e => {
    if (!live() || !e) return;
    if (driving() && isCop(e.car) && tryPit(e)) return;
    if ((e.impact || 0) >= 6.5) {
        if (D.on) endDrift(false);
        breakCombo("crash");
    }
});
on("damage", () => { if (D.on) endDrift(false); T.left = 0; breakCombo("crash"); });
on("wreck", () => { if (D.on) endDrift(false); T.left = 0; breakCombo("wreck"); });
hook("runStart", () => {
    D.on = false; D.charge = 0; D.tier = 0; T.left = 0; R.spin = 0; R.late = 0; DR.car = null; DR.charge = 0; W.t = 0; B.on = false;
    reset();
});
