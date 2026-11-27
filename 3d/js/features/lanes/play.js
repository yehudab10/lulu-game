// features/lanes/play.js — 🎳 HER GAME: start one / join one, and the bowling itself.
//
// AT THE LANE (a mode on the interiors engine — ○ / Esc / Back steps away, the game waits for her):
//   📱 touch     swipe UP from the ball: the swipe's direction = the aim, its speed = the power, bending it at the end =
//                the curve. A sideways drag (no swipe up) steps her left / right first.
//   🎮 pad       left stick: step left / right · right stick (or R1 + stick): turn the arrow · HOLD ✕: the power swings
//                up and down — let go to bowl; the stick while holding = the curve.
//   ⌨️ keyboard  ← → step · Shift + ← → turn the arrow · HOLD Space (or E) — let go to bowl; ← → while holding = curve.
// The dotted line on the lane shows where it's going (with the curve). The thrower's screen rolls it (pins.js) and
// publishes the ball (game.js); the lane plays it out the same on every screen (room.js).
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { input, glyph } from "../../input.js";
import { pick } from "../interiors/engine.js";
import { tone } from "../interiors/fx.js";
import { LANE, roll, lineAt, encodeThrow, decodeThrow, botThrow, rng, countOf } from "./pins.js";
import { order, sheetOf, newGid, BOT, MAX_BOWLERS } from "./game.js";
import { V, showGame, laneIdle, laneX, APPROACH_Z } from "./room.js";
import { TUNE, LINES } from "./data.js";

/** Her game (null = not bowling) + what the controls hold. */
export const G = {
    game: null, me: "", joining: false, knish: 0, mode: null,
    x0: 0, aimOff: 0, spin: 0, hold: -1, power: 0, release: -1,
    swipe: null, cam: null, aiming: false, stepAway: false,
    force: null,            // tests: the next throws, scripted ([{x, aim, p, s}…])
};
export const myId = () => (ctx.party && ctx.party.active && ctx.party.uid ? ctx.party.uid : "me");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** A new game on lane k (she owns it). opts: { frames: 10 | 3, vsShimmy } */
export function startGame(k, opts = {}) {
    const me = myId();
    const roster = [me];
    if (opts.vsShimmy) roster.push(BOT);
    const balls = {}; for (const u of roster) balls[u] = [];
    G.game = { lane: k, gid: newGid(), frames: opts.frames === 3 ? 3 : 10, owner: me, roster, balls, startedAt: Date.now() };
    G.me = me; G.joining = false;
    G.botR = rng(Math.floor(Math.random() * 1e9));
    showGame(k, G.game, "mine", { color: "#E91E63" });
    emit("lanes:start", { lane: k, frames: G.game.frames, vs: opts.vsShimmy ? "shimmy" : "" });
    return G.game;
}
/** Join a player's game here (their published one — net.js reads it). */
export function joinGame(w, ownerUid) {
    const me = myId();
    G.game = { lane: w.lane, gid: w.gid, frames: w.frames, owner: ownerUid, roster: (w.roster || [ownerUid]).slice(), balls: { [ownerUid]: w.balls.slice() }, joinedAt: Date.now() };
    G.game.balls[me] = [];
    G.me = me; G.joining = true;
    emit("lanes:join", { lane: w.lane, owner: ownerUid });
    return G.game;
}
export function endGame(why = "") {
    if (!G.game) return;
    const k = G.game.lane;
    emit("lanes:end", { lane: k, why });
    G.game = null; G.joining = false;
    showGame(k, null, "");
}

/** My throw (from the controls / a test) → into my list; the lane plays it. → the ball */
export function bowl(t) {
    const g = G.game, me = G.me;
    if (!g || !g.balls[me]) return null;
    const o = order(g);
    if (o.next !== me) return null;
    const st = o.sheets[me].standing;
    const r = roll(st, t);
    const b = { x: t.x, aim: t.aim, p: t.p, s: t.s, down: r.down & st };
    g.balls[me].push(b);
    G.knish = Math.max(0, G.knish - 1);
    emit("lanes:ball", { lane: g.lane, down: countOf(b.down), gutter: r.gutter >= 0, frame: o.sheets[me].frame + 1 });
    return b;
}
/** Is it my ball right now (my turn and the lane has played everything out)? */
export function myTurn() {
    const g = G.game;
    if (!g || G.joining) return false;
    return order(g).next === G.me && laneIdle(g.lane);
}

// ── Shimmy (the house bowler, solo games): he takes his ball when it's his turn ──
export function tickBot(rt, dt) {
    const g = G.game;
    if (!g || !g.roster.includes(BOT) || !laneIdle(g.lane)) { G.botT = TUNE.botWait; return; }
    const o = order(g);
    if (o.next !== BOT) { G.botT = TUNE.botWait; return; }
    G.botT = (G.botT == null ? TUNE.botWait : G.botT) - dt;
    const sh = rt.byId.shimmy;
    if (sh) { sh.p.obj.position.x += (laneX(g.lane) - sh.p.obj.position.x) * Math.min(1, dt * 4); sh.p.obj.position.z += (APPROACH_Z - sh.p.obj.position.z) * Math.min(1, dt * 4); sh.p.obj.rotation.y = Math.PI; }
    if (G.botT > 0) return;
    G.botT = TUNE.botWait;
    const st = o.sheets[BOT].standing, t = botThrow(G.botR || rng(5), TUNE.botSkill, st), r = roll(st, t);
    g.balls[BOT].push(Object.assign(t, { down: r.down & st }));
}

// ── the camera at the lane: behind the foul line, down the lane; it follows the ball toward the pins ──
const CP = new THREE.Vector3(), CL = new THREE.Vector3();
export function laneCamera(rt, dt, snap) {
    const k = G.game ? G.game.lane : 1, x = laneX(k), L = V.lanes[k], cam = rt.set.camera;
    let pz = 4.3, py = 2.15, lz = -9, ly = 0, px = 0.5;      // (over her right shoulder: the ball's side)
    const A = L && L.anim;
    if (A) {
        const y = Math.min(LANE.L, A.r.D.v * A.t);
        const u = clamp(y / LANE.L, 0, 1);
        pz = 4.3 - u * (LANE.L - 3.5); py = 2.15 - u * 0.9; px = 0.5 * (1 - u); lz = -LANE.L - 0.3; ly = 0.15;
    }
    CP.set(x + px, py, pz); CL.set(x, ly, lz);
    const k1 = snap ? 1 : 1 - Math.exp(-dt * 3.5);
    cam.position.lerp(CP, k1);
    rt.camLook.lerp(CL, snap ? 1 : 1 - Math.exp(-dt * 4));
    cam.lookAt(rt.camLook);
}

// ── the aiming visuals: a dotted line on the lane + a power bar by her ──
const DOTS = 16;
function aimKit(rt) {
    if (rt.data.aim) return rt.data.aim;
    const dots = new THREE.InstancedMesh(rt.own(new THREE.CircleGeometry(0.055, 12)), rt.own(new THREE.MeshBasicMaterial({ color: "#FF1F7A", transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })), DOTS);
    dots.frustumCulled = false; dots.renderOrder = 2;
    rt.add(dots);
    const frame = new THREE.Mesh(rt.own(new THREE.BoxGeometry(0.08, 0.7, 0.04)), rt.own(new THREE.MeshBasicMaterial({ color: "#1A1033", toneMapped: false })));
    const fill = new THREE.Mesh(rt.own(new THREE.BoxGeometry(0.06, 0.68, 0.05)), rt.own(new THREE.MeshBasicMaterial({ color: "#FF4F9A", toneMapped: false })));
    fill.geometry.translate(0, 0.34, 0);
    rt.add(frame); rt.add(fill);
    const held = new THREE.Mesh(rt.own(new THREE.SphereGeometry(LANE.ballR, 16, 10)), rt.own(new THREE.MeshStandardMaterial({ color: "#E91E63", roughness: 0.2 })));
    rt.add(held);
    return (rt.data.aim = { dots, frame, fill, held });
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)), P3 = new THREE.Vector3(), S3 = new THREE.Vector3();
function showAim(rt, on, D) {
    const A = aimKit(rt), x = laneX(G.game ? G.game.lane : 1);
    A.dots.visible = A.frame.visible = A.fill.visible = A.held.visible = !!on;
    if (!on) return;
    for (let i = 0; i < DOTS; i++) {
        const y = 0.5 + i * (LANE.L - 0.7) / (DOTS - 1), p = lineAt(D, y);
        const gone = Math.abs(p.x) > LANE.half;
        M4.compose(P3.set(x + p.x, 0.02, -y), Q, S3.setScalar(gone ? 0 : 1 - i / (DOTS * 1.25)));
        A.dots.setMatrixAt(i, M4);
    }
    A.dots.instanceMatrix.needsUpdate = true;
    const o = rt.lulu.obj.position;
    A.frame.position.set(o.x - 0.42, 1.0, o.z); A.fill.position.set(o.x - 0.42, 0.66, o.z + 0.01);
    A.fill.scale.y = Math.max(0.02, G.hold >= 0 ? G.power : 0);
    A.held.position.set(o.x + 0.22, 0.5, o.z - 0.1);
}

// ── touch: a swipe on the picture ──
function bindSwipe(rt) {
    const cv = document.getElementById("scene");
    if (!cv || G.swipe) return;
    const S = G.swipe = { pts: null, x00: 0, cv };
    S.down = e => {
        if (!G.aiming) return;
        S.pts = [{ x: e.clientX, y: e.clientY, t: performance.now() }]; S.x00 = G.x0; S.id = e.pointerId;
        e.stopImmediatePropagation();
    };
    S.move = e => {
        if (!S.pts || e.pointerId !== S.id) return;
        S.pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (S.pts.length > 90) S.pts.splice(1, 1);
        const p0 = S.pts[0], dx = e.clientX - p0.x, dy = p0.y - e.clientY;
        if (dy < 24 && Math.abs(dx) > 8) G.x0 = clamp(S.x00 + dx / window.innerWidth * 1.4, -0.45, 0.45);      // (sideways first: she steps)
        e.stopImmediatePropagation();
    };
    S.up = e => {
        if (!S.pts || e.pointerId !== S.id) return;
        const pts = S.pts; S.pts = null;
        e.stopImmediatePropagation();
        const t = fromSwipe(pts);
        if (t && G.aiming) throwNow(rt, t);
    };
    cv.addEventListener("pointerdown", S.down, { capture: true });
    cv.addEventListener("pointermove", S.move, { capture: true });
    window.addEventListener("pointerup", S.up, { capture: true });
    window.addEventListener("pointercancel", S.up, { capture: true });
}
function unbindSwipe() {
    const S = G.swipe;
    if (!S) return;
    S.cv.removeEventListener("pointerdown", S.down, { capture: true });
    S.cv.removeEventListener("pointermove", S.move, { capture: true });
    window.removeEventListener("pointerup", S.up, { capture: true });
    window.removeEventListener("pointercancel", S.up, { capture: true });
    G.swipe = null;
}
/** A swipe (screen points) → a throw, or null (not an upward swipe). */
export function fromSwipe(pts, Wd = window.innerWidth, Hd = window.innerHeight) {
    if (!pts || pts.length < 2) return null;
    // from its lowest point (a little drag down first is fine)
    let lo = 0; for (let i = 1; i < pts.length; i++) if (pts[i].y > pts[lo].y) lo = i;
    const P = pts.slice(lo), a = P[0], b = P[P.length - 1];
    const up = a.y - b.y;
    if (up < Hd * 0.08 || P.length < 2) return null;
    const at = f => P[Math.min(P.length - 1, Math.max(0, Math.round((P.length - 1) * f)))];
    const ang = (p, q) => Math.atan2(q.x - p.x, p.y - q.y);
    const a1 = ang(a, at(0.6)), a2 = ang(at(0.6), b);
    // the speed over its last ~120 ms (screens per second)
    let k = P.length - 1; while (k > 0 && b.t - P[k].t < 120) k--;
    const dt = Math.max(16, b.t - P[k].t), sp = Math.hypot(b.x - P[k].x, b.y - P[k].y) / dt * 1000 / Hd;
    const pw = clamp((sp - 0.8) / 3.2, 0, 1);
    const spin = clamp(-(a2 - a1) * 1.4, -1, 1);
    const aim = baseAim() + clamp(a1 * 0.06, -0.03, 0.03);
    return encodeThrow(G.x0, clamp(aim, -0.034, 0.034), 5.5 + pw * 4.5, spin);
}
const baseAim = () => Math.atan(-G.x0 / LANE.L) + G.aimOff;

function throwNow(rt, t) {
    if (!myTurn()) return false;
    if (G.force && G.force.length) t = G.force.shift();
    const b = bowl(t);
    if (!b) return false;
    G.aiming = false; G.hold = -1; G.release = 0; G.armed = false;
    tone(140, 0.18, "triangle", 0.07, 90);
    return true;
}

/** The lane mode: she stays at her lane while her game is on (○ steps away; the game waits). */
export function atLane(rt) {
    if (!G.game || rt.mode) return Promise.resolve();
    const k = G.game.lane;
    G.stepAway = false; G.aiming = false; G.hold = -1; G.release = -1; G.armed = false;
    G.x0 = 0.15; G.aimOff = 0; G.spin = 0;
    rt.orbiting = false;
    if (ctx.cam && ctx.cam.free) ctx.cam.free.release();
    G.cam = true;
    bindSwipe(rt);
    return rt.runMode({
        start() { },
        update(r, dt, P) {
            const g = G.game;
            if (!g || g.lane !== k || r.disposed) return true;
            if (P.back) { G.stepAway = true; return true; }
            const o = order(g), mine = myTurn();
            const lulu = r.lulu.obj, x = laneX(k);
            if (o.next == null && laneIdle(k)) return true;        // (the game is over — index.js says so)
            if (mine) {
                if (!G.aiming) { G.aiming = true; G.hold = -1; G.aimOff = 0; }
                // step + aim
                const step = input.boost ? 0 : input.moveX;
                if (G.hold < 0) {
                    G.x0 = clamp(G.x0 + step * dt * 0.6, -0.45, 0.45);
                    const turn = (input.boost ? input.moveX : 0) + (input.lookX || 0);
                    G.aimOff = clamp(G.aimOff + turn * dt * 0.02, -0.025, 0.025);
                }
                const holding = !!(input.interactHeld || input.handbrake);
                if (!holding) G.armed = true;                                    // (the press that brought her here doesn't count)
                if (holding && G.hold < 0 && G.armed) { G.hold = 0; G.spin = 0; }
                if (G.hold >= 0) {
                    G.hold += dt;
                    const per = G.knish > 0 ? 2.4 : 1.5;
                    G.power = 0.5 - 0.5 * Math.cos(G.hold / per * Math.PI * 2);
                    G.spin += (clamp(-input.moveX, -1, 1) - G.spin) * Math.min(1, dt * 6);
                    if (!holding) { const a = clamp(baseAim(), -0.034, 0.034); throwNow(r, encodeThrow(G.x0, a, 5.5 + G.power * 4.5, G.spin)); }
                }
                lulu.position.x += (x + G.x0 - 0.22 - lulu.position.x) * Math.min(1, dt * 10);      // (the ball in her right hand is ON the line)
                lulu.position.z += (APPROACH_Z - lulu.position.z) * Math.min(1, dt * 8);
                lulu.rotation.y = Math.PI;
                const D = decodeThrow(encodeThrow(G.x0, clamp(baseAim(), -0.034, 0.034), 5.5 + (G.hold >= 0 ? G.power : 0.6) * 4.5, G.hold >= 0 ? G.spin : 0));
                if (G.aiming) showAim(r, true, D);
                r.lulu.update(dt, { walk: 0 });
                hint(r, g, o);
            } else {
                showAim(r, false);
                // her slide after the release, then off to the side to watch
                if (G.release >= 0 && G.release < 0.5) { G.release += dt; lulu.position.z = APPROACH_Z - Math.sin(Math.min(1, G.release / 0.5) * Math.PI) * 0.8; }
                else {
                    G.release = -1;
                    const wx = x + (k % 2 ? -0.55 : 0.55), wz = 3.0;
                    const dx = wx - lulu.position.x, dz = wz - lulu.position.z, d = Math.hypot(dx, dz);
                    if (d > 0.05) { lulu.position.x += dx * Math.min(1, dt * 3); lulu.position.z += dz * Math.min(1, dt * 3); lulu.rotation.y = Math.atan2(dx, dz); }
                    else lulu.rotation.y = Math.PI;
                    r.lulu.update(dt, { walk: d > 0.05 ? 1.2 : 0 });
                }
                hint(r, g, o);
            }
            return false;
        },
        stop(r) { showAim(r, false); G.aiming = false; G.cam = null; unbindSwipe(); if (r.extraEl) { r.extraEl.textContent = ""; r.extraEl.dataset.k = ""; } },
    });
}

function hint(rt, g, o) {
    if (!rt.extraEl) return;
    const me = G.me, s = o.sheets[me];
    const fr = s ? `Frame ${s.frame + 1}${g.frames === 3 ? " of 3" : ""}${s.ball ? ` · ball ${s.ball + 1}` : ""}` : "";
    const esc = v => String(v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    let line = "";
    if (G.joining) line = "Joining the lane…";
    else if (myTurn()) line = input.device === "touch" ? `${fr} — swipe up to bowl` : input.device === "gamepad" ? `${fr} — hold ${glyph("confirm")}, let go to bowl` : `${fr} — hold Space, let go to bowl`;
    else if (o.next === me) line = `${fr} — you're up`;
    else if (o.next) line = `${fr} — ${esc(o.next === BOT ? "Shimmy" : (ctx.party && ctx.party.displayName ? ctx.party.displayName(o.next) : "a friend"))} is up`;
    if (rt.extraEl.dataset.k !== line) { rt.extraEl.dataset.k = line; rt.extraEl.innerHTML = line; }
}

export const playDebug = { G, startGame, joinGame, bowl, myTurn, fromSwipe, atLane, endGame };
