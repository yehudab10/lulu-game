// features/moves — ON FOOT. One button (□ / X · C · the ROLL button; touch: also a tap on the road) does the
// right thing for the moment (the stick's direction is relative to the camera, like her walking):
//   at a parked / stopped car, moving toward it → 🧗‍♀️ VAULT over the hood
//   sprinting                                  → 🏃‍♀️ SPRINT SLIDE (fast, low)
//   otherwise                                  → 🤸 DODGE ROLL (in the stick's direction)
// Each one is a short foot script (ctx.foot.script): while it runs, cars can't touch
// her (foot skips its car checks during a script) — the i-frames. Slip right past a
// moving car's bumper during one for a MATADOR!
// With the JUMP (features/foot/jump.js): the roll button pressed in the air rolls out of the landing (a chain);
// the jump button mid-slide is a 🦘 LONG JUMP (foot scores it on landing); mid-roll it hops out of the roll.
import * as THREE from "three";
import { ctx, hook, on } from "../../core/ctx.js";
import { input, lookDragged } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { live, clamp, touch, addMove, quality, rumble, callout, firstTime } from "./common.js";

export const FOOT = {
    roll: { dur: 0.5, speed: 7.8 },
    slide: { dur: 0.75, speed: 11, end: 0.55 },
    vault: { dur: 0.55, h: 1.25, reach: 2.6 },
    matador: 2.3, runV: 6.0,
};
const R = 0.32;
const M = { F: null, on: false, kind: "", t: 0, dur: 0, dx: 0, dz: 1, v: 0, x0: 0, z0: 0, x1: 0, z1: 0, yaw: 0, ole: false, baseScale: 1, prevHb: false, tap: false, n: 0, pend: 0, landRoll: false };
const _v = new THREE.Vector3();

// touch: a quick tap on the road (the canvas — buttons and the stick are their own elements)
let tapStart = null;
function bindTouch() {
    const cv = document.getElementById("scene");
    if (!cv) return;
    cv.addEventListener("pointerdown", e => { if (e.pointerType === "touch" && ctx.state === "footRun") tapStart = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId }; }, { passive: true });
    cv.addEventListener("pointerup", e => {
        if (!tapStart || e.pointerId !== tapStart.id) return;
        const ok = performance.now() - tapStart.t < 320 && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 24;
        tapStart = null;
        if (ok && ctx.state === "footRun" && !lookDragged()) M.tap = true;
    }, { passive: true });
}
on("boot", bindTouch);

/** A vaultable thing straight ahead: her parked car stub, a parked ride, a stopped traffic car. */
function vaultTarget(F, dx, dz) {
    const p = F.pos, reach = FOOT.vault.reach;
    let best = null, bestA = 1e9;
    const consider = (x, z, h, circles, r) => {
        const fx = Math.sin(h), fz = Math.cos(h);
        for (const co of circles) {
            const qx = x + fx * co, qz = z + fz * co;
            const ox = qx - p.x, oz = qz - p.z;
            const along = ox * dx + oz * dz, across = Math.abs(ox * -dz + oz * dx);
            if (along < 0.2 || along > reach + r || across > r + 0.25) continue;
            if (along < bestA) { bestA = along; best = { x, z, h, circles, r }; }
        }
    };
    for (const pc of F.parked || []) if (pc && pc.circles) consider(pc.x, pc.z, pc.h, pc.circles, pc.r || 1);
    const tr = ctx.traffic;
    if (tr) for (const c of tr.cars) {
        const sp = c.hit ? Math.hypot(c.vx, c.vz) : c.speed;
        if (sp > 1.2 || !c.spec) continue;
        if (c.kind === "truck" || (c.spec.len || 0) > 6.2) continue;     // too tall to hop
        const ox = c.x - p.x, oz = c.z - p.z;
        if (ox * ox + oz * oz > 64) continue;
        consider(c.x, c.z, c.h, c.spec.circles, c.spec.r);
    }
    return best;
}
/** Where she comes down: walk along the line until she's clear of the car (+ a step). */
function landPoint(F, t, dx, dz, out) {
    const fx = Math.sin(t.h), fz = Math.cos(t.h);
    let d = 0.5;
    for (; d < 7; d += 0.25) {
        const x = F.pos.x + dx * d, z = F.pos.z + dz * d;
        let inside = false;
        for (const co of t.circles) { const qx = t.x + fx * co, qz = t.z + fz * co; if ((x - qx) ** 2 + (z - qz) ** 2 < (t.r + R + 0.1) ** 2) { inside = true; break; } }
        // (…and clear of everything solid: a big tree right behind the car took her landing INSIDE its trunk — the camera
        //  then sat in the tree; ci/qa at the rest area)
        if (!inside && d > 1.2) break;
    }
    out.set(F.pos.x + dx * (d + 0.4), 0, F.pos.z + dz * (d + 0.4));
    // (the landing spot inside something solid — a big tree right behind the car took her INTO its trunk and the camera
    //  sat in the tree, ci/qa at the rest area — or anything solid on the way over: no vault, a roll / slide instead)
    if (solidAt(F, out.x, out.z)) return false;
    for (let k = 0.5; k < d + 0.4; k += 0.5) if (solidAt(F, F.pos.x + dx * k, F.pos.z + dz * k, true)) return false;
    return true;
}

function begin(F) {
    // direction: the stick, else where she's moving, else where she faces
    const fy = ctx.foot && ctx.foot.frameYaw;
    const h = fy != null ? fy : F.h, fx = Math.sin(h), fz = Math.cos(h), rx = -Math.cos(h), rz = Math.sin(h);
    let dx = fx * -input.moveY + rx * input.moveX, dz = fz * -input.moveY + rz * input.moveX;
    let l = Math.hypot(dx, dz);
    const sp = Math.hypot(F.vel.x, F.vel.z);
    if (l < 0.3) { if (sp > 0.5) { dx = F.vel.x; dz = F.vel.z; } else { const y = F.lulu.obj.rotation.y; dx = Math.sin(y); dz = Math.cos(y); } l = Math.hypot(dx, dz); }
    dx /= l; dz /= l;
    M.F = F;
    M.dx = dx; M.dz = dz; M.t = 0; M.ole = false; M.yaw = Math.atan2(dx, dz);
    const o = F.lulu.obj;
    M.baseScale = o.scale.y;
    const running = sp > FOOT.runV || input.boost || (input.device === "gamepad" && input.throttle > 0.5) || (touch() && Math.hypot(input.moveX, input.moveY) > 0.9);
    const vt = vaultTarget(F, dx, dz);
    if (vt && landPoint(F, vt, dx, dz, _v)) {
        M.kind = "vault"; M.dur = FOOT.vault.dur;
        M.x0 = F.pos.x; M.z0 = F.pos.z;
        M.x1 = _v.x; M.z1 = _v.z;
    } else if (running) { M.kind = "slide"; M.dur = FOOT.slide.dur; M.v = Math.max(FOOT.slide.speed, sp * 1.3); }
    else { M.kind = "roll"; M.dur = FOOT.roll.dur; M.v = FOOT.roll.speed; }
    o.rotation.order = "YXZ";
    o.rotation.y = M.yaw;
    if (!ctx.skipping) A.sfxCloseCall(M.kind === "vault" ? 5 : 2);
    rumble(0.15, 0.35, 90);
}

/** Is (x, z) inside a solid that stands higher than she can step (a trunk, a post, a wall's circle)? */
function solidAt(F, x, z, tallOnly = false) {
    const s = F && F.s != null ? F.s : ctx.car.s;
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - s) > 220) continue;
        for (const c of ch.colliders) {
            if (c.off || c.kind === "car" || (tallOnly && c.kind !== "tree" && c.r < 0.8)) continue;     // (over: only trunks / big solids)
            const dx = x - c.x, dz = z - c.z, rr = c.r + R;
            if (dx * dx + dz * dz < rr * rr) return true;
        }
    }
    return false;
}
function pushStatic(p) {
    // (her own road position, not the car's: on foot far from the car the trees around her were skipped — ci/doors)
    const s = ctx.foot && ctx.foot.debug && ctx.foot.debug.F && ctx.foot.debug.F.s != null ? ctx.foot.debug.F.s : ctx.car.s;
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - s) > 220) continue;
        for (const c of ch.colliders) {
            if (c.off) continue;
            const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + R;
            const d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr || d2 < 1e-8) continue;
            const d = Math.sqrt(d2);
            p.x = c.x + dx / d * rr; p.z = c.z + dz / d * rr;
        }
    }
}

/** A car whooshing right past her during the move → MATADOR. */
function checkOle(F) {
    if (M.ole || !ctx.traffic) return;
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.speed < 6) continue;
        const ox = c.x - F.pos.x, oz = c.z - F.pos.z;
        if (ox * ox + oz * oz > 64) continue;
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        const lon = ox * fx + oz * fz, lat = Math.abs(ox * -fz + oz * fx);
        const half = (c.spec && c.spec.len ? c.spec.len / 2 : 2.2) + 0.5;
        if (Math.abs(lon) < half && lat < FOOT.matador) { M.ole = true; return; }
    }
}

function step(dt, P, F) {
    const o = F.lulu.obj;
    M.t += dt;
    const k = clamp(M.t / M.dur, 0, 1);
    // the jump button mid-move: out of a slide = a LONG JUMP, out of the back half of a roll = a hop
    if (P && P.jump && M.kind !== "vault" && ctx.foot && ctx.foot.jump && (M.kind === "slide" ? k < 0.92 : k > 0.4)) {
        const v = M.kind === "slide" ? M.v * (1 - (1 - FOOT.slide.end) * k) : M.v * (1 - 0.35 * k);
        finish(F);
        ctx.foot.jump({ long: M.kind === "slide", vx: M.dx * Math.max(v, FOOT.runV), vz: M.dz * Math.max(v, FOOT.runV) });
        return false;
    }
    if (M.kind === "vault") {
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        F.pos.x = M.x0 + (M.x1 - M.x0) * e;
        F.pos.z = M.z0 + (M.z1 - M.z0) * e;
        o.position.set(F.pos.x, 0.05 + Math.sin(k * Math.PI) * FOOT.vault.h, F.pos.z);
        o.rotation.x = Math.sin(k * Math.PI) * 0.5;
        o.rotation.z = -Math.sin(k * Math.PI) * 0.35;
        F.lulu.update(dt, { walk: 0, cheer: k > 0.2 && k < 0.8 });
    } else {
        const v = M.kind === "slide" ? M.v * (1 - (1 - FOOT.slide.end) * k) : M.v * (1 - 0.35 * k);
        F.pos.x += M.dx * v * dt;
        F.pos.z += M.dz * v * dt;
        pushStatic(F.pos);
        if (M.kind === "roll") {
            // a forward roll about her middle (crouched)
            const a = k * Math.PI * 2;
            const c = 0.45;
            o.rotation.x = a;
            o.scale.y = M.baseScale * (1 - 0.25 * Math.sin(k * Math.PI));
            o.position.set(F.pos.x - M.dx * c * Math.sin(a), 0.05 + c * (1 - Math.cos(a)), F.pos.z - M.dz * c * Math.sin(a));
            F.lulu.update(dt, { walk: 0 });
        } else {
            // feet-first slide: leaning right back, low
            const lean = Math.sin(Math.min(1, k * 4) * Math.PI / 2) * (1 - Math.max(0, k - 0.8) * 5);
            o.rotation.x = -1.05 * lean;
            o.position.set(F.pos.x, 0.05 + 0.12 * lean, F.pos.z);
            F.lulu.update(dt, { walk: 0 });
            if (!ctx.skipping && Math.random() < 0.6 && ctx.car && ctx.car.fx)
                ctx.car.fx.emit(F.pos.x, 0.15, F.pos.z, -M.dx * 1.5, 0.6, -M.dz * 1.5, 0.7, 0.6, [0.75, 0.68, 0.55]);
        }
    }
    o.rotation.y = M.yaw;
    checkOle(F);
    if (k < 1) return true;
    finish(F);
    return false;
}
function finish(F) {
    const o = F.lulu.obj;
    o.rotation.x = 0; o.rotation.z = 0; o.rotation.order = "XYZ"; o.rotation.y = M.yaw;
    o.scale.y = M.baseScale;
    o.position.set(F.pos.x, 0.05, F.pos.z);
    M.on = false; M.F = null;
    const G = ctx.G;
    G.invT = Math.max(G.invT || 0, 0.25);       // a breath to get clear of a bumper
    const name = M.kind === "vault" ? "🧗‍♀️ VAULT!" : M.kind === "slide" ? "🏃‍♀️ SLIDE!" : M.landRoll ? "🛬 LANDING ROLL!" : "🤸 ROLL!";
    M.landRoll = false;
    addMove(M.kind, M.kind === "vault" ? 250 : M.kind === "slide" ? 150 : 100, name, { foot: true, color: "#80DEEA" });
    if (M.ole) {
        quality("matador");
        addMove("matador", 400, "🐂 MATADOR!", { foot: true, color: "pink" });
    }
}
function abort() {
    const F = M.F;
    M.on = false; M.F = null;
    if (F && F.lulu) { const o = F.lulu.obj; o.rotation.x = 0; o.rotation.z = 0; o.rotation.order = "XYZ"; o.scale.y = M.baseScale; }
}

/** Start a move right now (the button, a touch tap, or a test). → bool (in the air: remembered, it rolls out of the landing) */
export function footMove() {
    const foot = ctx.foot;
    if (!live() || !foot || ctx.state !== "footRun" || foot.phase !== "walk" || ctx.dialogOpen || ctx.paused || M.on) return false;
    if (foot.airborne) { M.pend = 0.4; return false; }
    let started = false;
    const def = {
        update(dt, P, F) { if (!started) { started = true; begin(F); } return step(dt, P, F); },
        abort,
    };
    if (!foot.script(def)) return false;
    M.on = true;
    M.n++;
    return true;
}

// the button: P.roll (□ / X · C · the ROLL touch button — input.js) or a tap on the road
hook("hud", dt => {
    const edge = !!(input.pressed && input.pressed.roll);
    const tap = M.tap;
    M.tap = false;
    if (ctx.paused || ctx.state !== "footRun") { M.pend = 0; return; }
    if (edge || tap) footMove();
    // pressed in the air: roll the moment her feet touch down (a chain: jump → landing roll)
    if (M.pend > 0) {
        M.pend -= dt;
        const foot = ctx.foot;
        if (foot && !foot.airborne && foot.phase === "walk" && !M.on) { M.pend = 0; M.landRoll = true; if (!footMove()) M.landRoll = false; }
    }
});
on("state", ({ to }) => { if (to !== "footRun") { M.on = false; M.tap = false; } });

export const footInfo = () => ({ on: M.on, kind: M.kind, n: M.n });
