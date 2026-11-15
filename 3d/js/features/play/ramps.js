// features/play — 🛹 stunt ramps. Physics stays 2D on the road: the jump is a
// purely VISUAL height (Lulu's car model + nitro flames lift off the car's
// ground-level root, so her real shadow stays on the road). Steering in the air
// spins her for a trick bonus, the camera swoops, there's a short slow-mo at
// the top of a big jump, and a springy landing. A bad landing is a harmless
// wobble. While she's high enough, traffic passes UNDER her (🐸 LEAPFROG!) and
// roadside obstacles lower than her are ignored.
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { models } from "../../models.js";
import { LANES_OURS } from "../../world.js";
import { input, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { SAVE, saveSoon, sfx, stat, lift, clamp, radialTexture } from "./common.js";
import { confetti, updateConfetti, clearConfetti } from "./fx.js";

// Must match 3d/blender/assets_play.py (RAMP_L/W/H/EXP).
export const RAMP = { L: 5.0, W: 3.0, H: 1.15, EXP: 1.6 };
export const GRAV = 16;                 // arcade gravity (snappier than 9.8)
const SPIN_RATE = 9.5;                  // rad/s at full stick
const SLOWMO = 0.42, SLOW_SCALE = 0.4;  // seconds (real) of slow-mo at the apex of a big jump
const CLEAN = 0.62;                     // landing within ±35° of a whole turn is clean

export const rampHeight = u => RAMP.H * Math.pow(clamp(u, 0, 1), RAMP.EXP);
export const rampSlope = u => RAMP.H * RAMP.EXP * Math.pow(clamp(u, 0, 1), RAMP.EXP - 1) / RAMP.L;
/** Height of a nominal 28 m/s jump x metres past the lip (sky dreidels follow it). */
export function arcY(x, v = 28) {
    const vy = rampSlope(1) * v, t = x / v;
    return RAMP.H + vy * t - GRAV / 2 * t * t;
}

/** Ramps on the road: { s, d, k, obj, lane } */
export const ramps = [];
export function addRamp(chunk, s, d, k) {
    if (!models.play_ramp) return null;
    const obj = models.play_ramp.clone();
    const p = ctx.world.road.point(s, d, {});
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = p.h;
    if (chunk) chunk.add(obj); else ctx.scene.add(obj);
    const r = { s, d, k, obj, chunk, lane: Math.abs(d) < 7,
        other: LANES_OURS.reduce((a, l) => Math.abs(l - d) > Math.abs(a - d) ? l : a, LANES_OURS[0]) };   // the lane traffic moves over to
    ramps.push(r);
    return r;
}
export function removeChunk(k) {
    for (let i = ramps.length - 1; i >= 0; i--) if (ramps[i].k === k) ramps.splice(i, 1);
}
function removeLoose() {
    for (let i = ramps.length - 1; i >= 0; i--) {
        if (ramps[i].chunk) continue;
        if (ramps[i].obj.parent) ramps[i].obj.parent.remove(ramps[i].obj);
        ramps.splice(i, 1);
    }
}

// ── the jump state ────────────────────────────────────────────────────────
export const J = {
    y: 0, vy: 0, air: false, onRamp: false, airT: 0, airPred: 0, apex: false, id: 0,
    spin: 0, spinV: 0, steerIn: 0, pitch: 0, roll: 0, vx: 0, vz: 0, bumped: false,
    leaps: 0, land: 0, landPow: 0, slow: 0, ts: 1, k: 0, dirty: false, lastU: 0, ramp: null,
    jumps: 0, lastAir: 0, lastSpin: 0, lastClean: true,
};

const hit = { r: null, u: 0 };
function groundAt(s, d) {
    let g = 0;
    hit.r = null;
    for (const r of ramps) {
        const u = (s - (r.s - RAMP.L / 2)) / RAMP.L;
        if (u < 0 || u > 1 || Math.abs(d - r.d) > RAMP.W / 2 + 0.3) continue;
        const h = rampHeight(u);
        if (h >= g) { g = h; hit.r = r; hit.u = u; }
    }
    return g;
}
function nearRamp(s) {
    for (const r of ramps) if (s > r.s - RAMP.L / 2 - 3 && s < r.s + RAMP.L / 2 + 3) return true;
    return false;
}

/** Land instantly and put the car model back (state changes, new runs). */
export function resetJump() {
    restoreColliders();
    Object.assign(J, { y: 0, vy: 0, air: false, onRamp: false, airT: 0, apex: false, spin: 0, spinV: 0, steerIn: 0,
        pitch: 0, roll: 0, bumped: false, leaps: 0, land: 0, slow: 0, ts: 1, k: 0, ramp: null });
    J.dirty = true;
    applyVisual();
}

// ── per-frame (inside the driving sim, after physics, before the car's visuals) ──
const near = {};
hook("update", (dt, P, controlsOn) => {
    updateConfetti(dt);
    const car = ctx.car;
    if (!car) return;
    steerTrafficAroundRamps(dt);
    if (J.air || J.onRamp || nearRamp(car.s)) {
        ctx.world.road.nearest(car.pos.x, car.pos.z, car.s, near);
        const g = groundAt(near.s, near.d);
        const vAlong = car.vx * Math.sin(near.h) + car.vz * Math.cos(near.h);
        if (J.air) {
            // ballistic: keep the take-off velocity (no grip in the air), unless something hit her
            if (J.bumped) { J.vx = car.vx; J.vz = car.vz; J.bumped = false; }
            else { car.vx = J.vx; car.vz = J.vz; }
            J.vy -= GRAV * dt;
            J.y += J.vy * dt;
            J.airT += dt;
            const want = controlsOn ? -J.steerIn * SPIN_RATE : 0;
            J.spinV += (want - J.spinV) * Math.min(1, dt * 6);
            J.spin += J.spinV * dt;
            if (!J.apex && J.vy < 0) { J.apex = true; if (J.airPred > 0.85) J.slow = SLOWMO; }
            if (J.y <= g && J.vy < 0) touchdown(g);
        } else if (g > 0) {
            // riding up the kicker
            if (!J.onRamp) { J.onRamp = true; J.ramp = hit.r; }
            J.y = g; J.lastU = hit.u; J.ramp = hit.r;
            J.vy = rampSlope(hit.u) * Math.max(0, vAlong);
        } else if (J.onRamp) {
            takeoff(near, vAlong);
        } else J.y = 0;
    } else if (J.y !== 0) J.y = 0;
    if (!J.air) settle(dt);
    applyVisual(dt);
});

function takeoff(nr, vAlong) {
    const car = ctx.car, r = J.ramp;
    J.onRamp = false;
    // came off the lip end → full lip slope; overshoot this frame along the arc
    if (r && J.lastU > 0.55 && nr.s > r.s + RAMP.L / 2 - 0.05 && Math.abs(nr.d - r.d) <= RAMP.W / 2 + 0.3) {
        const v = Math.max(0, vAlong);
        J.vy = Math.min(13.5, rampSlope(1) * v);
        const over = v > 0.5 ? clamp((nr.s - (r.s + RAMP.L / 2)) / v, 0, 0.1) : 0;
        J.y = RAMP.H + J.vy * over - GRAV / 2 * over * over;
        J.vy -= GRAV * over;
    }
    J.air = true; J.airT = 0; J.apex = false; J.spin = 0; J.spinV = 0; J.leaps = 0; J.id++;
    J.vx = car.vx; J.vz = car.vz;
    J.airPred = (J.vy + Math.sqrt(Math.max(0, J.vy * J.vy + 2 * GRAV * J.y))) / GRAV;
    if (J.airPred > 0.45) {
        sfx.whoosh(clamp(J.airPred, 0.5, 1.3));
        rumble(0.25, 0.55, 170, true);
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        car.fx.burst(car.pos.x - fx * 1.6, RAMP.H, car.pos.z - fz * 1.6, 10, 2.2, [0.85, 0.7, 0.5], 0.9, 0.6);
    }
}

function touchdown(g) {
    const G = ctx.G, car = ctx.car;
    const impactV = -J.vy;
    J.air = false; J.y = g; J.vy = 0; J.onRamp = g > 0;
    restoreColliders();
    const airT = J.airT;
    const turns = J.spin / (Math.PI * 2);
    const full = Math.round(turns);
    const resid = (turns - full) * Math.PI * 2;
    const clean = Math.abs(resid) < CLEAN;
    // whole turns are invisible: keep only the leftover angle and spring it back to straight
    J.spin = resid; J.spinV = 0;
    J.land = 1; J.landPow = clamp(impactV / 10, 0.25, 1.4);
    J.jumps++; J.lastAir = airT; J.lastSpin = full; J.lastClean = clean;
    // springy touchdown: dust, thump, rumble
    const rx = -Math.cos(car.h), rz = Math.sin(car.h);
    for (const s of [-1, 1]) car.fx.burst(car.pos.x + rx * s * 0.9, 0.25, car.pos.z + rz * s * 0.9, 9, 2.6 * J.landPow + 1, [0.8, 0.68, 0.5], 1.1, 0.8);
    sfx.land(J.landPow);
    rumble(0.35 + 0.45 * Math.min(1, J.landPow), 0.8, 230, true);
    G.shake = Math.max(G.shake || 0, 0.25 * J.landPow);
    if (airT < 0.4 && !full) return;                       // just a hop
    SAVE.jumps++;
    stat("stuntJumps", 1);
    let pts = Math.round(airT * 450);
    if (!clean) {
        // harmless wobble: a fishtail + a little speed lost, no damage
        car.spin += clamp(resid, -1.2, 1.2) * 1.4;
        car.vx *= 0.88; car.vz *= 0.88;
        pts = Math.round(pts / 2);
        H.toast(`😵 WOBBLY LANDING · AIR ${airT.toFixed(1)}s +${pts}`, "");
        sfx.wobble();
    } else {
        H.toast(`🛹 +AIR ${airT.toFixed(1)}s! +${pts}`, "gold");
        if (full) {
            const n = Math.abs(full), bonus = 500 * n;
            pts += bonus;
            SAVE.spins += n;
            stat("stuntSpins", n);
            H.toast(`🌀 ${n * 360} SPIN! +${bonus}`, "pink");
            sfx.trick(3 + n);
            if (n >= 2) confetti(car.pos.x, 2, car.pos.z, 60, car.vx, car.vz, 5);
        } else sfx.trick(2);
        G.boost = Math.min(1, (G.boost || 0) + 0.1 + Math.min(0.2, airT * 0.08));
    }
    G.score += pts;
    if (airT > SAVE.bestAir + 0.01) {
        const first = SAVE.bestAir === 0;
        SAVE.bestAir = Math.round(airT * 100) / 100;
        if (!first) H.toast(`🏆 Best air ever: ${airT.toFixed(2)}s`, "gold");
    }
    saveSoon();
}

/** After landing: spring the leftover spin back to straight, squash & stretch. */
function settle(dt) {
    if (J.spin !== 0 || J.spinV !== 0) {
        J.spinV += (-70 * J.spin - 8 * J.spinV) * dt;
        J.spin += J.spinV * dt;
        if (Math.abs(J.spin) < 0.002 && Math.abs(J.spinV) < 0.02) { J.spin = 0; J.spinV = 0; }
    }
    J.steerIn = 0;
}

// ── visuals: the car MODEL (and the nitro flames) ride the jump ──────────
const SQ = { y: 1, xz: 1 };
function applyVisual(dt = 0) {
    const car = ctx.car, m = car && car.model;
    if (!m) return;
    // pitch: nose up on the kicker, follows the arc in the air, levels near the ground
    let want = 0;
    if (J.onRamp && J.ramp) want = -Math.atan(rampSlope(J.lastU));
    else if (J.air) want = clamp(-J.vy * 0.035, -0.4, 0.38);
    const maxP = Math.asin(Math.min(1, (J.y + 0.03) / 1.5));      // never dig a bumper into the road
    J.pitch += (want - J.pitch) * Math.min(1, dt * (J.onRamp ? 18 : 6));
    J.pitch = clamp(J.pitch, -maxP, maxP);
    J.roll += ((J.air ? clamp(J.spinV * 0.025, -0.25, 0.25) : 0) - J.roll) * Math.min(1, dt * 6);
    SQ.y = 1; SQ.xz = 1;
    if (J.land > 0) {
        J.land = Math.max(0, J.land - dt / 0.75);
        const t = (1 - J.land) * 0.75;
        const sq = J.landPow * 0.2 * Math.exp(-6 * t) * Math.cos(17 * t);
        SQ.y = 1 - sq; SQ.xz = 1 + sq * 0.45;
    }
    lift.y = J.y;
    const active = J.y > 0.0005 || J.spin !== 0 || Math.abs(J.pitch) > 0.0005 || Math.abs(J.roll) > 0.0005 || J.land > 0;
    if (!active && !J.dirty) return;
    J.dirty = active;
    if (!active) { J.y = 0; J.pitch = 0; J.roll = 0; lift.y = 0; }   // settle on exactly zero
    m.position.y = J.y;
    m.rotation.order = "YXZ";
    m.rotation.set(J.pitch, J.spin, J.roll);
    m.scale.set(SQ.xz, SQ.y, SQ.xz);
    if (car.flames) { car.flames.position.y = J.y; car.flames.rotation.y = J.spin; }
    updateShadow();
}

// a soft blob shadow while airborne when real shadows are off (low quality)
let blob = null;
function updateShadow() {
    const car = ctx.car;
    const want = J.y > 0.05 && ctx.renderer && !ctx.renderer.shadowMap.enabled;
    if (!want) { if (blob) blob.visible = false; return; }
    if (!blob) {
        blob = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.4), new THREE.MeshBasicMaterial({
            map: radialTexture("rgba(0,0,0,0.6)"), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
        blob.rotation.x = -Math.PI / 2;
        blob.renderOrder = 1;
        ctx.scene.add(blob);
    }
    blob.visible = true;
    blob.position.set(car.pos.x, 0.06, car.pos.z);
    blob.rotation.z = car.h;
    const k = clamp(1 - J.y / 7, 0.25, 1);
    blob.material.opacity = k;
    blob.scale.setScalar(1.25 - k * 0.25);
}

// ── controls in the air: the wheel spins her instead of steering ─────────
hook("controls", ctl => {
    if (!J.air) return;
    J.steerIn = ctl.steer;
    ctl.steer = 0; ctl.brake = 0; ctl.handbrake = false;
    suppressColliders();
}, 5);

// roadside obstacles lower than she is flying don't count (restored on landing)
const TOPS = { tree: 6.5, house: 7, pole: 8.2, sign: 4.4, cop: 1.6, playTruck: 3.4 };
const offList = [];
const topOf = c => (c.top != null ? c.top : TOPS[c.kind] != null ? TOPS[c.kind] : 1.3);
function suppressColliders() {
    const car = ctx.car;
    for (let i = offList.length - 1; i >= 0; i--) {
        if (J.y < topOf(offList[i]) - 0.05) { offList[i].off = false; offList.splice(i, 1); }
    }
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - car.s) > 220) continue;
        for (const c of ch.colliders) {
            if (c.off) continue;
            const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
            if (dx * dx + dz * dz > 144) continue;
            if (J.y > topOf(c)) { c.off = true; offList.push(c); }
        }
    }
}
function restoreColliders() { for (const c of offList) c.off = false; offList.length = 0; }

// traffic: high enough → she sails over (leapfrog!), otherwise it's a normal crash
function vehicleTop(c) {
    const sp = c.spec || {};
    if (c.kind === "truck" || (sp.len || 0) > 6.2) return 3.1;
    if (c.kind === "van" || (sp.halfW || 0) > 0.95) return 1.8;
    return 1.3;
}
function leapfrog(c, dx, dz) {
    if (!J.air || (c.data && c.data.playLeap === J.id)) return;
    const fx = Math.sin(c.h), fz = Math.cos(c.h);
    const lon = dx * fx + dz * fz, lat = dx * -fz + dz * fx;
    const sp = c.spec || { len: 4.4, halfW: 0.9 };
    if (Math.abs(lon) > sp.len / 2 + 1 || Math.abs(lat) > sp.halfW + 0.8) return;
    if (c.data) c.data.playLeap = J.id;
    J.leaps++;
    SAVE.leapfrogs++;
    const G = ctx.G, pts = 400 * J.leaps;
    G.score += pts;
    H.toast(`🐸 LEAPFROG${J.leaps > 1 ? " ×" + J.leaps : ""}! +${pts}`, "pink");
    sfx.trick(2 + Math.min(3, J.leaps));
    rumble(0.1, 0.4, 90);
    stat("leapfrogs", 1);
}
on("boot", () => {
    const T = ctx.traffic, orig = T.collide;
    T.collide = function (c, player) {
        if (J.y > 0.4 && player === ctx.car) {
            const dx = c.x - player.pos.x, dz = c.z - player.pos.z;
            if (dx * dx + dz * dz > 100) return null;
            if (J.y > vehicleTop(c)) { leapfrog(c, dx, dz); return null; }
        }
        return orig.call(this, c, player);
    };
    // ⏱ slow-mo: the driving sim runs on scaled time for a moment at the top of a big jump
    const pdef = ctx.states.playing, origUpdate = pdef && pdef.update;
    if (origUpdate) pdef.update = function (dt, P) { return origUpdate.call(this, dt * timeScale(dt), P); };
});
function timeScale(rdt) {
    if (J.slow > 0) { J.slow -= rdt; J.ts += (SLOW_SCALE - J.ts) * Math.min(1, rdt * 14); }
    else if (J.ts !== 1) { J.ts += (1 - J.ts) * Math.min(1, rdt * 7); if (J.ts > 0.995) J.ts = 1; }
    return J.ts;
}
// something hit her mid-air: take the new velocity instead of the stored one
on("crash", () => { if (J.air) J.bumped = true; });
// flying high: nothing down there can hurt her
hook("damage", () => (J.air && J.y > 1.3 ? false : undefined), 5);

// ── the camera follows her up and swoops out to the side ─────────────────
const _dir = new THREE.Vector3(), _look = new THREE.Vector3(), _tgt = new THREE.Vector3();
hook("hud", dt => {
    const st = ctx.state;
    if (st !== "playing" && st !== "wrecked") { J.k = 0; return; }
    const want = J.air || J.onRamp ? 1 : 0;
    if (!ctx.paused) J.k += (want - J.k) * Math.min(1, dt * (want ? 6 : 2.4));   // (the hud hook runs while paused too: hold still)
    if (J.k < 0.003 && J.y < 0.003) { J.k = 0; return; }
    const camera = ctx.camera, car = ctx.car;
    if (ctx.cam && ctx.cam.mode === 2) {
        // Lulu's eyes: ride the car model itself (lift, pitch and the spin) — level if "calm screen" is on
        if (save3d.settings.calm || !car.model || (!J.air && !J.onRamp && J.spin === 0 && J.y < 0.001)) { camera.position.y += J.y; return; }
        car.obj.updateMatrixWorld(true);
        camera.position.set(0.38, 1.68, -0.06).applyMatrix4(car.model.matrixWorld);
        _look.set(0.38, 1.6, 6).applyMatrix4(car.model.matrixWorld);
        camera.up.set(0, 1, 0);
        camera.lookAt(_look);
        return;
    }
    const e = J.air ? Math.sin(clamp(J.airT / Math.max(0.35, J.airPred), 0, 1) * Math.PI) : 0;
    const sw = save3d.settings.calm ? 0 : e * clamp(J.airPred, 0, 1.3);
    camera.getWorldDirection(_dir);
    _look.copy(camera.position).addScaledVector(_dir, 9);
    const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
    const K = J.k;
    camera.position.x += (rx * 3.4 * sw - fx * 1.6 * sw) * K;
    camera.position.z += (rz * 3.4 * sw - fz * 1.6 * sw) * K;
    camera.position.y += (J.y * 0.85 + 0.9 * sw) * K;
    _tgt.set(car.pos.x, J.y + 0.9, car.pos.z);
    _look.lerp(_tgt, K * 0.8);
    camera.lookAt(_look);
});

// ── lane ramps: traffic changes lanes (or waits) instead of driving through ──
function steerTrafficAroundRamps() {
    const T = ctx.traffic;
    if (!T || !ramps.length) return;
    const cs = ctx.car.s;
    for (const r of ramps) {
        if (!r.lane || Math.abs(r.s - cs) > 600) continue;
        const other = r.other;
        for (const c of T.cars) {
            if (c.hit || c.ai || c.free || c.dir < 0) continue;
            const gap = r.s - c.s;
            if (gap < -RAMP.L || gap > 80) continue;
            if (Math.abs(c.dTarget - r.d) > 1.7 && Math.abs(c.d - r.d) > 2.4) continue;
            if (T.laneFree(c.s, other, 1, 12)) { c.dTarget = other; c.laneCooldown = 4; }
            else if (gap < 16) c.want = 0;
            else c.want = Math.min(c.want, 8);
        }
    }
}

// ── lifecycle ─────────────────────────────────────────────────────────────
hook("runStart", () => { removeLoose(); resetJump(); clearConfetti(); });
on("title", () => { removeLoose(); resetJump(); });
on("state", ({ to }) => {
    const def = ctx.states[to];
    if (!def || !def.driving) { if (J.air || J.onRamp || J.y) resetJump(); }
});
