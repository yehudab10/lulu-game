// features/moves — 🛹 AIR TRICKS on play's stunt ramps. play already spins the
// car when you steer in the air; on top of that:
//   flick the stick ↑ / ↓ (keyboard W / S, a fresh press) → a FRONT / BACK FLIP
//   hold the handbrake (touch: brake) + steer                → a BARREL ROLL (instead of a spin)
// Each trick is a committed whole turn (~0.5–0.6 s) — chain as many as the airtime
// allows. Land with nothing half-done for a turbo (1–3 tricks → tier 1–3); land
// mid-trick and play's harmless wobble happens (it asks ctx.moves.airBotched()) and
// the combo is lost. Rotation is about the car's middle, not its floor.
import * as THREE from "three";
import { ctx, hook, on, emit } from "../../core/ctx.js";
import { input } from "../../input.js";
import * as A from "../../audio.js";
import { live, clamp, touch, addMove, bestOf, breakCombo, rumble, callout, TIER_CSS } from "./common.js";
import { turbo } from "./drive.js";

export const AIR = { flipT: 0.6, rollT: 0.5, flick: 0.7, neutral: 0.35, clean: 0.6, pivot: 0.7 };
export const X = {
    air: false, flips: 0, rolls: 0, neutral: true,
    flip: { on: false, dir: 0, p: 0 }, roll: { on: false, dir: 0, p: 0 },
    flipA: 0, rollA: 0, rollIn: 0, dirty: false, seen: -1, botched: false, labels: [],
};
const jump = () => (ctx.play && ctx.play.jump) || null;
const ease = p => p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const resid = a => { const t = a / (Math.PI * 2); return Math.abs(t - Math.round(t)) * Math.PI * 2; };

/** Would landing right now botch a trick? (play's touchdown asks — a half-done flip or roll is a wobble) */
export function airBotched() {
    return (X.flip.on && resid(X.flipA) > AIR.clean) || (X.roll.on && resid(X.rollA) > AIR.clean);
}

function takeoff() {
    X.air = true; X.flips = 0; X.rolls = 0; X.botched = false; X.labels.length = 0;
    X.flip.on = false; X.roll.on = false; X.flipA = 0; X.rollA = 0;
    X.neutral = Math.abs(input.moveY) < AIR.neutral;
}

// the inputs, before play turns steering into a spin (play's controls hook is priority 5)
hook("controls", ctl => {
    const J = jump();
    if (!live() || !J || !J.air) { X.rollIn = 0; return; }
    if (!X.air) takeoff();
    const hb = input.handbrake || (touch() && input.brake > 0.5);
    X.rollIn = hb ? ctl.steer : 0;
    if (hb) ctl.steer = 0;                 // a roll, not a spin
    const y = input.moveY;
    if (Math.abs(y) < AIR.neutral) X.neutral = true;
    else if (X.neutral && Math.abs(y) > AIR.flick && !X.flip.on) {
        X.neutral = false;
        startTrick(X.flip, y < 0 ? 1 : -1, y < 0 ? "FRONT FLIP" : "BACKFLIP");     // stick up / W = front flip
    }
    if (!X.roll.on && Math.abs(X.rollIn) > 0.5) startTrick(X.roll, Math.sign(X.rollIn), "BARREL ROLL");
}, 7);
function startTrick(tr, dir, name) {
    tr.on = true; tr.p = 0; tr.dir = dir;
    if (!ctx.skipping) A.sfxCloseCall(3);
    rumble(0.1, 0.35, 80);
    callout(name, "", "gold", 0.9);
}
function done(name, flip) {
    if (flip) X.flips++; else X.rolls++;
    X.labels.push(name);
    if (!ctx.skipping) A.sfxCloseCall(7);
    rumble(0.15, 0.4, 70);
    const n = X.flips + X.rolls;
    callout(name, n > 1 ? `${n} tricks` : "", "gold", 0.9);
}

const _q = new THREE.Quaternion(), _c = new THREE.Vector3(), _o = new THREE.Vector3();
function progress(tr, dur, dt, onDone) {
    if (!tr.on) return 0;
    tr.p += dt / dur;
    if (tr.p >= 1) { tr.on = false; tr.p = 0; onDone(); return 0; }
    return tr.dir * ease(tr.p) * Math.PI * 2;
}
function applyVisual() {
    const car = ctx.car, m = car && car.model;
    const active = X.flipA !== 0 || X.rollA !== 0;
    if (!m || (!active && !X.dirty)) return;
    X.dirty = active;
    if (!active) { m.position.x = 0; m.position.z = 0; return; }
    // play wrote rotation (pitch, spin, roll) + the lift this frame; add the trick angles about the car's middle
    m.rotation.order = "YXZ";
    m.rotation.x += X.flipA;
    m.rotation.z += X.rollA;
    _q.setFromEuler(m.rotation);
    _c.set(0, AIR.pivot, 0);
    _o.copy(_c).applyQuaternion(_q);
    m.position.x = _c.x - _o.x;
    m.position.z = _c.z - _o.z;
    m.position.y += _c.y - _o.y;
}

hook("update", dt => {
    const J = jump();
    if (!J || !ctx.car) return;
    if (J.air && live()) {
        if (!X.air) takeoff();
        X.flipA = progress(X.flip, AIR.flipT, dt, () => done(X.flip.dir > 0 ? "FRONT FLIP" : "BACKFLIP", true));
        X.rollA = progress(X.roll, AIR.rollT, dt, () => {
            done("BARREL ROLL", false);
            if (Math.abs(X.rollIn) > 0.5) startTrick(X.roll, Math.sign(X.rollIn), "BARREL ROLL");     // keep holding: keep rolling
        });
    }
    if (J.jumps !== X.seen) {
        const first = X.seen < 0;
        X.seen = J.jumps;
        if (!first && X.air) land(J);
    }
    if (!J.air && X.air && !J.onRamp && J.jumps === X.seen) X.air = false;
    applyVisual();
}, -10);

function land(J) {
    const botched = X.flip.on || X.roll.on ? airBotched() : false;
    const spins = Math.abs(J.lastSpin || 0);
    const tricks = X.flips + X.rolls + spins;
    // a trick that was 90 % round when the wheels touched counts — the rest snap straight
    if (!botched && X.flip.on && X.flip.p > 0.5) { X.flips++; X.labels.push(X.flip.dir > 0 ? "FRONT FLIP" : "BACKFLIP"); }
    if (!botched && X.roll.on && X.roll.p > 0.5) { X.rolls++; X.labels.push("BARREL ROLL"); }
    const n = X.flips + X.rolls + spins;
    X.flip.on = false; X.roll.on = false; X.flipA = 0; X.rollA = 0; X.air = false;
    if (!live()) return;
    if (botched || J.lastClean === false) {
        if (X.flips + X.rolls + spins > 0 || botched) {
            if (botched && J.lastBotch == null) {     // a play without the airBotched() line: do the wobble ourselves
                ctx.car.spin += (Math.random() < 0.5 ? -1 : 1) * 1.4; ctx.car.vx *= 0.9; ctx.car.vz *= 0.9;
            }
            callout("BAILED!", "land it straight next time", "red", 1.2);
            breakCombo("botch");
            emit("moves:air", { tricks, clean: false });
        }
        return;
    }
    if (n <= 0) return;
    const pts = 600 * X.flips + 500 * X.rolls + 300 * spins + Math.round(200 * (J.lastAir || 0));
    const tier = Math.min(3, n);
    turbo(tier, "air");
    bestOf("air", n);
    emit("stat", { id: "movesAirTricks", n });
    let label = X.labels.slice(0, 3).join(" + ");
    if (spins) label = (label ? label + " + " : "") + `${spins * 360}`;
    if (X.labels.length > 3) label += ` +${X.labels.length - 3}`;
    addMove("air", pts, `🛹 ${label || "TRICK"}!`, { color: TIER_CSS[tier] });
    emit("moves:air", { tricks: n, flips: X.flips, rolls: X.rolls, spins, clean: true });
}
on("state", ({ to }) => { const def = ctx.states[to]; if (!def || !def.driving) { X.flip.on = X.roll.on = false; X.flipA = X.rollA = 0; X.air = false; applyVisual(); } });
hook("runStart", () => { X.flip.on = X.roll.on = false; X.flipA = X.rollA = 0; X.air = false; X.seen = -1; X.dirty = true; applyVisual(); });
