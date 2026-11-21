// features/airport — LIFE at the kerb: the taxis + shuttles going round, the terminal's doors (✋: opening soon), and
// the RUNWAY FENCE JOKE (Officer Segal of airport security rolls up on his Segway; sometimes a jet honks first).
// Everything here is personal (only her screen runs it): the vehicles are plain props on their own loop (never in the
// traffic), the guard and the lines are hers. Nothing pays coins. Pop-ups: none — speech bubbles only, and only as the
// answer to something she did (pushed the fence, tried a door).
import * as THREE from "three";
import { ctx, emit, pick } from "../../core/ctx.js";
import { models, ensureModels } from "../../models.js";
import { bakedInstanced } from "./bake.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { CAR_CIRCLES, CAR_RADIUS } from "../../car.js";
import * as LY from "./layout.js";
import * as L from "./lines.js";

export const VEH = { taxis: 5, shuttles: 2, speed: 8, kerbSpeed: 6, dwellTaxi: 34, dwellShuttle: 7, yieldLon: 11, yieldLat: 2.7 };
/** Her car vs. the kerb vehicles (traffic.js's numbers: a town minivan is mass 1.5, a school bus 5): circles along each
 *  one, its mass, the impact (m/s) that knocks it spinning, how long it slides before its driver eases back in. */
export const KERB_HIT = {
    taxi: { circles: [1.3, -1.3], r: 1.05, mass: 1.2, knock: 3.5, spinMax: 6 },
    shuttle: { circles: [-3.1, -1.05, 1.05, 3.1], r: 1.3, mass: 5, knock: 9, spinMax: 2 },
    settle: 2.2, back: 1.6, sayGap: 5,
};
export const JOKE = { near: 1.6, nearCar: 3.6, hold: 0.7, cool: 25, maxVisit: 2, againGap: 10 };
const GUARD_MODELS = ["airport_guard", "airport_segway"];

// ── helpers ──────────────────────────────────────────────────────────────
const onFoot = () => !!(ctx.foot && ctx.foot.active);
/** Lulu says something (over her on foot, banter's line at the wheel). */
export function luluSays(text, sec = 2.8) {
    if (!text) return;
    if (onFoot() && ctx.foot.say && ctx.foot.obj) { ctx.foot.say(ctx.foot.obj, text, sec); return; }
    if (ctx.banter && ctx.banter.say) { try { ctx.banter.say(text); return; } catch (e) { /* below */ } }
    if (ctx.banter && ctx.banter.bubble && ctx.car && ctx.car.model) { try { ctx.banter.bubble(text, ctx.car.model, { dur: sec, y: 2.2 }); } catch (e) { /* none */ } }
}
export function sayOver(obj, text, sec = 3) {
    if (!text || !obj) return;
    if (onFoot() && ctx.foot.say) { ctx.foot.say(obj, text, sec); return; }
    if (ctx.banter && ctx.banter.bubble) { try { ctx.banter.bubble(text, obj, { dur: sec, y: 2.2 }); } catch (e) { /* none */ } }
}
/** Where Lulu is (her car follows her on foot). */
const luluPos = () => (onFoot() && ctx.foot.pos) || (ctx.car && ctx.car.pos) || null;

// ── the kerb vehicles ────────────────────────────────────────────────────
/** Point + tangent on the vehicle loop at distance v (wraps). */
function loopAt(VL, v, out) {
    const Lv = VL.len, P = VL.pts;
    v = ((v % Lv) + Lv) % Lv;
    let lo = 0, hi = P.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].v <= v) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], t = (v - a.v) / Math.max(1e-6, b.v - a.v);
    out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t; out.tx = a.tx + (b.tx - a.tx) * t; out.tz = a.tz + (b.tz - a.tz) * t;
    const l = Math.hypot(out.tx, out.tz) || 1; out.tx /= l; out.tz /= l;
    return out;
}
const _a = {}, _b = {}, _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _v3 = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);

export function makeVehicles(G, scene) {
    if (!models.airport_taxi || !models.airport_shuttle) return null;
    const group = new THREE.Group();
    group.name = "AirportKerb";
    // (each kind ONE draw call: the model baked into one vertex-coloured geometry, instanced)
    const wrap = im => ({ im, set(i, m) { im.setMatrixAt(i, m); }, finish() { im.instanceMatrix.needsUpdate = true; }, dispose() { im.dispose(); } });
    const taxi = wrap(bakedInstanced(models.airport_taxi, VEH.taxis, {}, null, 0.4)), bus = wrap(bakedInstanced(models.airport_shuttle, VEH.shuttles, { Stripe: "#1E5AA8" }, null, 0.45));
    group.add(taxi.im, bus.im);
    scene.add(group);
    const VL = G.vloop, Lv = VL.len, cars = [];
    // spread round the loop: the taxis queued at the stand, the shuttles across the far side
    for (let i = 0; i < VEH.taxis; i++) cars.push({ kind: "taxi", i, v: VL.stops.taxiHead - i * (LY.STOPS.taxiGap + 0.5), speed: 0, wait: i ? 0 : VEH.dwellTaxi * 0.6, len: 4.8 });
    for (let i = 0; i < VEH.shuttles; i++) cars.push({ kind: "shuttle", i, v: VL.stops.shuttle + Lv * (0.35 + i * 0.4), speed: 0, wait: 0, len: 9.3, served: false });
    // their colliders (ride in the kerb's highway chunk: index.js adds them when that chunk is built)
    const dyn = [];
    for (const c of cars) {
        c.col = (c.kind === "taxi" ? [-1.3, 1.3] : [-3.1, 0, 3.1]).map(o => ({ x: 0, z: 0, r: c.kind === "taxi" ? 1.05 : 1.3, kind: c.kind === "taxi" ? "car" : "prop", o, airport: true }));
        dyn.push(...c.col);
    }
    // the shuttles pull out to the middle lane after their stop (the taxis queue in the kerb lane)
    const vS = VL.stops.shuttle, vEnd = VL.stops.taxiHead + 50;
    const lat0 = (c, v) => c.kind !== "shuttle" ? 0 : -3.5 * Math.min(smooth01((v - vS - 6) / 14), smooth01((vEnd - v) / 14));
    // (+ c.side: pulling round her parked car — a lane to the left while they pass it)
    const lat = (c, v) => Math.max(-3.5, lat0(c, v) + (c.side || 0));
    const V = { group, cars, dyn, taxi, bus, stats: { stops: 0, taxisOut: 0, bumps: 0, knocked: 0 }, anchor: new THREE.Object3D() };
    group.add(V.anchor);
    V.update = (dt, active) => {
        if (!active) return;
        const lp = luluPos();
        cars.sort((a, b) => ((a.v % Lv) + Lv) % Lv - ((b.v % Lv) + Lv) % Lv);
        for (let k = 0; k < cars.length; k++) {
            const c = cars[k], vv = ((c.v % Lv) + Lv) % Lv;
            // knocked by her car: it slides + spins like a traffic car, then the driver collects himself and eases back
            // into his lane (its place round the loop waits for it; the ones behind queue)
            if (c.hit) { tickHit(c, dt); continue; }
            let want = Math.abs(vv - VL.stops.taxiHead) < 140 || Math.abs(vv - vS) < 120 ? VEH.kerbSpeed : VEH.speed;
            // the vehicle ahead in the same lane
            let gap = 1e9;
            for (const o of cars) {
                if (o === c) continue;
                let d = (((o.v - c.v) % Lv) + Lv) % Lv;
                if (d <= 0 || d > 60) continue;
                if (Math.abs(lat(o, ((o.v % Lv) + Lv) % Lv) - lat(c, vv)) > 2) continue;
                gap = Math.min(gap, d - (o.len + c.len) / 2);
            }
            if (gap < 9) want = Math.min(want, Math.max(0, (gap - 2.2) * 1.2));
            // stops: the shuttle at its stand (once a lap), a taxi at the head of the line
            const stopAt = (sv, dwell, tag) => {
                const d = sv - vv;
                if (d > -0.5 && d < 18) {
                    if (c.lastStop === tag) return;
                    want = Math.min(want, Math.max(0, d * 0.7));
                    if (d < 0.6 && c.speed < 0.4) { if (c.wait <= 0) c.wait = dwell; c.atStop = tag; }
                }
            };
            if (c.kind === "shuttle") stopAt(vS, VEH.dwellShuttle, "shuttle"); else stopAt(VL.stops.taxiHead, VEH.dwellTaxi, "taxi");
            if (c.atStop) {
                c.wait -= dt;
                want = 0;
                if (c.wait <= 0) { c.lastStop = c.atStop; c.atStop = null; V.stats.stops++; if (c.kind === "taxi") V.stats.taxisOut++; }
            }
            if (c.lastStop && Math.abs(vv - (c.lastStop === "shuttle" ? vS : VL.stops.taxiHead)) > 40) c.lastStop = null;
            // yield to Lulu (in her car or on foot) and to her parked car
            loopAt(VL, c.v, _a);
            const l0 = lat(c, vv), px = _a.x - _a.tz * l0, pz = _a.z + _a.tx * l0;
            const block = (x, z, far = 0) => { const dx = x - px, dz = z - pz, lon = dx * _a.tx + dz * _a.tz, la = -dx * _a.tz + dz * _a.tx; return lon > 0 && lon < VEH.yieldLon + c.len / 2 + far && Math.abs(la) < VEH.yieldLat; };
            // her car standing still (or left parked while she walks): pull round it a lane to the left; her on foot: stop
            const still = ctx.car && !onFoot() && ctx.car.speed < 0.6 ? ctx.car.pos : null;
            let parked = false;
            if (still && block(still.x, still.z, 22)) parked = true;
            for (const t of ctx.traffic ? ctx.traffic.cars : []) if (t.data && t.data.footStub && block(t.x, t.z, 22)) parked = true;
            if (parked || (c.side && c.passT > 0)) { if (parked) c.passT = 2.5; want = Math.min(want, 4); }
            c.passT = Math.max(0, (c.passT || 0) - dt);
            c.side = (c.side || 0) + Math.max(-2.2 * dt, Math.min(2.2 * dt, (c.passT > 0 ? -3.5 : 0) - (c.side || 0)));
            if (!parked && lp && block(lp.x, lp.z)) want = 0;
            // …and for a cruiser (law's, following her round the loop) or a knocked-about kerb vehicle in front
            for (const t of ctx.traffic ? ctx.traffic.cars : []) if (t.data && t.data.law && block(t.x, t.z)) want = 0;
            for (const o of cars) if (o.hit && o !== c && block(o.x, o.z, 4)) want = 0;
            c.speed += Math.max(-6 * dt, Math.min(2.2 * dt, want - c.speed));
            if (c.speed < 0) c.speed = 0;
            c.v += c.speed * dt;
            // place it (+ its colliders)
            loopAt(VL, c.v, _a);
            const vn = ((c.v % Lv) + Lv) % Lv, la = lat(c, vn);
            const x = _a.x - _a.tz * la, z = _a.z + _a.tx * la, yaw = Math.atan2(_a.tx, _a.tz);
            c.x = x; c.z = z; c.h = yaw;
            place(c);
        }
        taxi.finish(); bus.finish();
        // (her car meets them through V.collide — an actor, like a traffic car; the circles in the chunk are foot's only)
        const walking = onFoot();
        for (const d of dyn) d.off = !walking;
    };
    function place(c) {
        _m4.compose(_v3.set(c.x, 0, c.z), _q.setFromAxisAngle(_up, c.h), _one);
        (c.kind === "taxi" ? taxi : bus).set(c.i, _m4);
        const fx = Math.sin(c.h), fz = Math.cos(c.h);
        for (const cc of c.col) { cc.x = c.x + fx * cc.o; cc.z = c.z + fz * cc.o; }
    }
    function tickHit(c, dt) {
        const H = c.hit;
        H.t += dt;
        if (H.rec == null) {
            c.x += H.vx * dt; c.z += H.vz * dt;
            const damp = Math.exp(-(c.kind === "taxi" ? 1.6 : 2.6) * dt);
            H.vx *= damp; H.vz *= damp; H.spin *= Math.exp(-2.2 * dt);
            c.h += H.spin * dt;
            if (H.t > KERB_HIT.settle && Math.hypot(H.vx, H.vz) < 0.6) { H.rec = 0; H.x = c.x; H.z = c.z; H.h = c.h; }
        } else {
            // ease back onto its loop pose (it's stopped: its place round the loop hasn't moved)
            H.rec = Math.min(1, H.rec + dt / KERB_HIT.back);
            loopAt(VL, c.v, _b);
            const la = lat(c, ((c.v % Lv) + Lv) % Lv), tx = _b.x - _b.tz * la, tz = _b.z + _b.tx * la, th = Math.atan2(_b.tx, _b.tz);
            const k = smooth01(H.rec);
            let dh = th - H.h; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
            c.x = H.x + (tx - H.x) * k; c.z = H.z + (tz - H.z) * k; c.h = H.h + dh * k;
            if (H.rec >= 1) c.hit = null;
        }
        c.speed = 0;
        place(c);
    }
    /** Her car against the kerb vehicles: traffic.js's collide (the same circles-and-impulse feel as town traffic):
     *  push apart by mass, bounce her, and a hard enough hit knocks a taxi spinning (a shuttle only from a real smash).
     *  → a crash for core's actor loop ({ impact, why, source }: > 6.5 m/s costs a heart, like traffic) or null. */
    V.collide = (player) => {
        if (!player || !player.pos) return null;
        const ph = player.h, pfx = Math.sin(ph), pfz = Math.cos(ph);
        let best = null;
        for (const c of cars) {
            const dx0 = c.x - player.pos.x, dz0 = c.z - player.pos.z;
            if (dx0 * dx0 + dz0 * dz0 > 144) continue;
            const spec = KERB_HIT[c.kind], cfx = Math.sin(c.h), cfz = Math.cos(c.h);
            for (const po of CAR_CIRCLES) {
                const px = player.pos.x + pfx * po, pz = player.pos.z + pfz * po;
                for (const co of spec.circles) {
                    const dx = px - (c.x + cfx * co), dz = pz - (c.z + cfz * co), rr = CAR_RADIUS + spec.r, d2 = dx * dx + dz * dz;
                    if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); if (!best || rr - d > best.pen) best = { c, spec, nx: dx / d, nz: dz / d, pen: rr - d, po }; }
                }
            }
        }
        if (!best) return null;
        const { c, spec, nx, nz, pen } = best;
        const cvx = c.hit ? c.hit.vx : Math.sin(c.h) * c.speed, cvz = c.hit ? c.hit.vz : Math.cos(c.h) * c.speed;
        const mP = player.mass || 1, mC = spec.mass, share = mC / (mP + mC);
        player.pos.x += nx * pen * share; player.pos.z += nz * pen * share;
        const vn = (player.vx - cvx) * nx + (player.vz - cvz) * nz;
        if (vn >= 0) return null;
        const j = -1.3 * vn / (1 / mP + 1 / mC), impact = -vn;
        player.applyImpulse(nx * j / mP, nz * j / mP, (best.po > 0 ? 1 : -1) * (nx * -Math.cos(ph) + nz * Math.sin(ph)) * j * 0.05);
        if (impact > spec.knock) {
            if (!c.hit) { c.hit = { t: 0, vx: cvx, vz: cvz, spin: 0 }; c.atStop = null; c.wait = 0; V.stats.knocked++; }
            c.hit.t = 0; c.hit.rec = undefined;
            c.hit.vx -= nx * j / mC; c.hit.vz -= nz * j / mC;
            c.hit.spin += (Math.random() < 0.5 ? -1 : 1) * Math.min(spec.spinMax, impact * 0.25);
        } else if (!c.hit) c.speed = Math.max(0, c.speed - impact);
        V.stats.bumps++;
        // the driver has something to say (one line per vehicle every few seconds) — and so does Lulu, sometimes
        if (impact > 2 && ctx.time - (c.saidT || -99) > KERB_HIT.sayGap) {
            c.saidT = ctx.time;
            V.anchor.position.set(c.x, c.kind === "taxi" ? 0 : 1.2, c.z);
            sayOver(V.anchor, pick(L.KERB[c.kind]), 2.6);
            if (Math.random() < 0.45) setTimeout(() => luluSays(pick(L.KERB.lulu), 2.4), 900);
        }
        emit("airport:bump", { kind: c.kind, impact: +impact.toFixed(1) });
        emit("stat", { id: "airportKerbBumps", n: 1 });
        return { impact, why: c.kind === "taxi" ? "A JFK taxi? They ALWAYS win." : "The shuttle bus won. Shuttle buses always win.", source: "car", kind: c.kind };
    };
    V.dispose = () => { scene.remove(group); taxi.dispose(); bus.dispose(); for (const d of dyn) d.off = true; };
    return V;
}
function smooth01(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

// ── the doors (✋): "opening soon" — or, once stage 2's hall is in (ctx.airport.terminal), in through them ──
const term = () => { const T = ctx.airport && ctx.airport.terminal; return T && T.enter ? T : null; };
const canIn = T => !!T && (!T.canEnter || T.canEnter());
export function doorSpot(S) {
    const sp = {
        r: 2.6, short: "🚪",
        pos() {
            const G = S.G, p = ctx.foot && ctx.foot.pos;
            if (!G || !S.ready || !p) return null;
            let best = null, bd = 1e9;
            for (const f of LY.DOORS) { const w = G.F.world(f, LY.TERM.r0 - 1.0, {}); const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd) { bd = d; best = w; best.f = f; } }
            // (the hall loads ahead: a soft cut in when she gets there)
            const T = term();
            if (T && T.warm && bd < 22 && !S.warmed) { S.warmed = true; try { T.warm(); } catch (e) { /* later */ } }
            if (bd > 40) S.warmed = false;
            sp.door = bd < 4 ? best : null;
            return sp.door;
        },
        label() { return sp.door ? (canIn(term()) ? "🚪 TERMINAL 4½ · GO INSIDE" : "🚪 TERMINAL 4½ · opening soon") : null; },
        act() {
            const T = term(), dr = sp.door;
            if (dr && canIn(T)) {
                // (foot resumes on the sidewalk in front of the door she used: highway coords)
                const n = ctx.world.highway.nearest(dr.x, dr.z, S.E + LY.UA + dr.f, {});
                try { T.enter({ door: { s: n.s, d: n.d, side: Math.sign(n.d) || 1, x: dr.x, z: dr.z } }); emit("airport:door", { f: dr.f, in: true }); return; } catch (e) { console.error("[airport] terminal", e); }
            }
            const t = ctx.time;
            if (S.doorT && t - S.doorT < 2.5) return;
            S.doorT = t;
            S.doors = (S.doors || 0) + 1;
            luluSays(L.LULU.door[(S.doors - 1) % L.LULU.door.length], 3);
            emit("airport:door", { f: sp.door ? sp.door.f : 0 });
            emit("stat", { id: "airportDoors", n: 1 });
        },
    };
    return sp;
}

// ── the runway fence joke ────────────────────────────────────────────────
/** Distance from (x, z) to the nearest RUNWAY fence segment → { d, x, z (closest point), tx, tz (along it) }. */
export function nearFence(G, x, z, out = {}) {
    out.d = 1e9;
    for (const fc of G.fences) {
        if (!fc.runway) continue;
        for (let i = 0; i < fc.pts.length - 1; i++) {
            const a = fc.pts[i], b = fc.pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, L2 = ex * ex + ez * ez || 1;
            const t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / L2)), px = a.x + ex * t, pz = a.z + ez * t, d = Math.hypot(px - x, pz - z);
            if (d < out.d) { const l = Math.sqrt(L2); out.d = d; out.x = px; out.z = pz; out.tx = ex / l; out.tz = ez / l; }
        }
    }
    return out;
}

let hornDefined = false;
function horn(at) {
    if (!A.spatial || !A.spatial.ready || ctx.skipping) return;
    if (!hornDefined) {
        hornDefined = true;
        A.spatial.define("airportHorn", { ref: 60, max: 900, gain: 1.0, prio: 3, gen(sr) {
            const n = Math.round(1.7 * sr), b = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                const t = i / sr, env = Math.min(1, t * 12) * Math.min(1, (1.7 - t) * 5);
                let s = 0; for (const f of [92, 116, 138]) s += ((t * f) % 1) * 2 - 1;      // a low saw chord: BWAAAMP
                b[i] = s * 0.28 * env;
            }
            return b;
        } });
    }
    A.spatial.play("airportHorn", at, { gain: 1 });
}

export function makeJoke(S) {
    const J = { phase: null, t: 0, hold: 0, guard: null, seg: null, n: 0, visitN: 0, coolT: -1e9, againT: -1e9, v: 0 };
    const _f = {};
    J.reset = () => { despawn(J); J.phase = null; J.hold = 0; J.visitN = 0; };
    J.update = (dt) => {
        const G = S.G, p = luluPos();
        if (!G || !S.ready || !p) return;
        // pressed against the runway fence (on foot ~1 m from it, in the car a bumper's length)?
        if (!J.phase) {
            const lim = onFoot() ? JOKE.near : JOKE.nearCar;
            nearFence(G, p.x, p.z, _f);
            const pushing = _f.d < lim && (onFoot() || (ctx.car && ctx.car.speed < 3)) && ["playing", "footRun"].includes(ctx.state);
            J.hold = pushing ? J.hold + dt : Math.max(0, J.hold - dt * 2);
            if (J.hold >= JOKE.hold) { J.hold = 0; J.trigger(); }
        }
        if (J.phase) tickScene(J, G, dt);
    };
    J.trigger = (force = false) => {
        const t = ctx.time;
        emit("stat", { id: "airportFenceTries", n: 1 });
        if (!force && (t - J.coolT < JOKE.cool || J.visitN >= JOKE.maxVisit)) {
            if (t - J.againT > JOKE.againGap) { J.againT = t; luluSays(pick(L.LULU.again), 2.4); }
            emit("airport:fence", { variant: -1 });
            return false;
        }
        if (!GUARD_MODELS.every(k => models[k])) { ensureModels(GUARD_MODELS).catch(() => {}); luluSays(pick(L.LULU.again), 2.4); return false; }
        J.coolT = t; J.visitN++;
        J.v = (S.saved.jokes || 0) % L.SEGAL.length;
        S.saved.jokes = (S.saved.jokes || 0) + 1;
        if (S.save) S.save();
        startScene(J, S.G);
        emit("airport:fence", { variant: J.v });
        return true;
    };
    return J;
}
function despawn(J) {
    for (const o of [J.guard && J.guard.obj, J.seg]) if (o && o.parent) o.parent.remove(o);
    J.guard = null; J.seg = null;
}
const _n = {};
function startScene(J, G) {
    const p = luluPos();
    nearFence(G, p.x, p.z, _n);
    // he rolls in along the fence, on the landside (2.8 m in from it), from 26 m away
    const inX = p.x - _n.x, inZ = p.z - _n.z, il = Math.hypot(inX, inZ) || 1;
    J.nx = inX / il; J.nz = inZ / il;
    const side = Math.random() < 0.5 ? -1 : 1;
    J.from = { x: _n.x + J.nx * 2.8 + _n.tx * 26 * side, z: _n.z + J.nz * 2.8 + _n.tz * 26 * side };
    J.to = { x: p.x + _n.tx * 3.2 * side + J.nx * 0.6, z: p.z + _n.tz * 3.2 * side + J.nz * 0.6 };
    J.guard = spawnPerson("airport_guard", {});
    J.seg = models.airport_segway.clone(true);
    J.guard.obj.position.set(J.from.x, 0.26, J.from.z);
    J.seg.position.set(J.from.x, 0, J.from.z);
    ctx.scene.add(J.seg); ctx.scene.add(J.guard.obj);
    J.guard.obj.traverse(m => { if (m.isMesh) m.castShadow = false; });
    J.phase = "in"; J.t = 0; J.line = 0;
    const V = L.SEGAL[J.v];
    if (V.horn) {
        // the nearest parked jet at the gates honks (BWAAAMP)
        const w = G.F.world(0, 278, {});
        horn({ x: w.x, y: 6, z: w.z });
        luluSays("WHOA.", 1.4);
    }
}
function tickScene(J, G, dt) {
    const V = L.SEGAL[J.v], g = J.guard, p = luluPos();
    if (!g || !p) { despawn(J); J.phase = null; return; }
    J.t += dt;
    const o = g.obj;
    const move = (to, speed) => { const dx = to.x - o.position.x, dz = to.z - o.position.z, d = Math.hypot(dx, dz); if (d > 0.05) { const k = Math.min(1, speed * dt / d); o.position.x += dx * k; o.position.z += dz * k; o.rotation.y = Math.atan2(dx, dz); } return d; };
    if (J.phase === "in") {
        const d = move(J.to, 5.5);
        if (d < 0.3 || J.t > 7) { J.phase = "talk"; J.t = 0; }
    } else if (J.phase === "talk") {
        o.rotation.y = Math.atan2(p.x - o.position.x, p.z - o.position.z);
        const beats = V.guard.length;
        if (J.line < beats && J.t > J.line * 2.7) { sayOver(o, V.guard[J.line], 2.6); J.line++; }
        else if (J.line === beats && J.t > beats * 2.7) { luluSays(V.lulu, 2.6); J.line++; }
        else if (J.line > beats && J.t > beats * 2.7 + 2.4) { J.phase = "out"; J.t = 0; }
    } else if (J.phase === "out") {
        const d = move(J.from, 6);
        if (d < 0.5 || J.t > 8) { despawn(J); J.phase = null; return; }
    }
    J.seg.position.set(o.position.x, 0, o.position.z);
    J.seg.rotation.y = o.rotation.y;
    g.update(dt, { talk: J.phase === "talk" });
}
