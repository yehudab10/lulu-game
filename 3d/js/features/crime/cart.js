// features/crime — 🛒 THE SHOPPING-CART JOYRIDE (on foot, opt-in).
//
// A runaway shopping cart stands on the sidewalk outside the pizza shop / the bakery (whichever the town has). Walk up →
// ✋ RIDE: Lulu hops in and it rolls off down the street (foot.script: she sits in it, the stick steers a little, it
// picks up speed, then slows by itself). Townsfolk she rolls past scatter ("My challah!"). It ends when it stops, hits a
// building front or a car (she tumbles out — nobody is hurt). Pays PAY.cart (base + distance + scatters, ≤ maxRide a ride,
// only the first ridesPerDay rides of a REAL day pay). The risk: a cop who sees the cart in the street gives a ⚠️ look,
// a second look = a foot chase for GRAND THEFT SHOPPING CART. The cart rolls itself home when she's walked off.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { input } from "../../input.js";
import { CR, SAVE, PAY, TUNE, LINES, dirty, log, stat, pick, fill, lulu, bubble, mustSee, bakeBoxes, townSpot, streetAt,
    footCrime, payCapped, walking, onFoot, live, paidToday } from "./common.js";
import { CHARGES } from "./data.js";

const K = TUNE.cart;
export const CART = { obj: null, home: null, geos: [], ride: null, spotRm: null, awayT: 0, rides: 0 };

function makeCart() {
    const wire = "#B0BEC5", red = "#E53935", dark = "#37474F";
    const parts = [
        // the basket (a hollow box from 5 slabs) + the child seat flap
        { w: 0.62, h: 0.04, d: 0.9, x: 0, y: 0.42, z: 0, color: wire },
        { w: 0.04, h: 0.5, d: 0.9, x: -0.31, y: 0.67, z: 0, color: wire },
        { w: 0.04, h: 0.5, d: 0.9, x: 0.31, y: 0.67, z: 0, color: wire },
        { w: 0.62, h: 0.5, d: 0.04, x: 0, y: 0.67, z: 0.45, color: wire },
        { w: 0.62, h: 0.5, d: 0.04, x: 0, y: 0.67, z: -0.45, color: wire },
        // the handle (red plastic) + its posts
        { w: 0.66, h: 0.06, d: 0.06, x: 0, y: 1.02, z: -0.58, color: red },
        { w: 0.04, h: 0.2, d: 0.14, x: -0.3, y: 0.94, z: -0.51, color: wire },
        { w: 0.04, h: 0.2, d: 0.14, x: 0.3, y: 0.94, z: -0.51, color: wire },
        // the frame + four wheels (one of them wobbly, obviously)
        { w: 0.5, h: 0.04, d: 0.8, x: 0, y: 0.16, z: 0, color: wire },
        { w: 0.05, h: 0.26, d: 0.05, x: -0.24, y: 0.28, z: 0.36, color: wire },
        { w: 0.05, h: 0.26, d: 0.05, x: 0.24, y: 0.28, z: 0.36, color: wire },
        { w: 0.05, h: 0.26, d: 0.05, x: -0.24, y: 0.28, z: -0.36, color: wire },
        { w: 0.05, h: 0.26, d: 0.05, x: 0.24, y: 0.28, z: -0.36, color: wire },
        { w: 0.05, h: 0.12, d: 0.12, x: -0.24, y: 0.06, z: 0.36, color: dark },
        { w: 0.05, h: 0.12, d: 0.12, x: 0.24, y: 0.06, z: 0.36, color: dark },
        { w: 0.05, h: 0.12, d: 0.12, x: -0.24, y: 0.06, z: -0.36, color: dark },
        { w: 0.05, h: 0.12, d: 0.12, x: 0.24, y: 0.06, z: -0.36, color: dark, rz: 0.4 },
        // a sign hanging off it
        { w: 0.4, h: 0.16, d: 0.02, x: 0, y: 0.74, z: 0.475, color: "#FFEB3B" },
    ];
    const g = new THREE.Group();
    g.add(bakeBoxes(parts, CART.geos));
    g.name = "crimeCart";
    return g;
}

/** Build the cart for this town (town:enter). */
export function buildCart() {
    clearCart();
    const at = townSpot(["pizza", "bakery", "bank"], 7.5, 1.1);
    if (!at) return false;
    CART.home = { x: at.x, z: at.z, yaw: at.yaw + Math.PI / 2 };
    CART.obj = makeCart();
    ctx.scene.add(CART.obj);
    home();
    if (ctx.foot && ctx.foot.addSpot) CART.spotRm = ctx.foot.addSpot(rideSpot);
    log("cart", { phase: "built", key: at.key });
    return true;
}
export function clearCart() {
    if (CART.ride) endRide("gone");
    if (CART.spotRm) { CART.spotRm(); CART.spotRm = null; }
    if (CART.obj) CART.obj.removeFromParent();
    for (const g of CART.geos) g.dispose();
    CART.geos.length = 0;
    CART.obj = null; CART.home = null; CART.awayT = 0;
}
function home() {
    const o = CART.obj, h = CART.home;
    if (!o || !h) return;
    o.position.set(h.x, 0, h.z); o.rotation.set(0, h.yaw, 0);
    CART.parked = { x: h.x, z: h.z };
}

const rideSpot = {
    r: K.r, short: LINES.cart.short,
    pos() { return CART.obj && !CART.ride && live() ? { x: CART.obj.position.x, z: CART.obj.position.z } : null; },
    label() { return LINES.cart.spot; },
    act() { startRide(); },
};

/** Hop in and roll. → bool */
export function startRide() {
    if (!CART.obj || CART.ride || !walking()) return false;
    const o = CART.obj, F = ctx.foot.debug && ctx.foot.debug.F;
    // roll the way the street runs, whichever end she's facing more
    const sa = streetAt(o.position.x, o.position.z);
    let yaw = o.rotation.y;
    if (sa) {
        const h = sa.h, fy = ctx.foot.facing != null ? ctx.foot.facing : yaw;
        yaw = Math.cos(fy - h) >= 0 ? h : h + Math.PI;
    }
    const R = CART.ride = { t: 0, yaw, v: 2.4, x: o.position.x, z: o.position.z, x0: o.position.x, z0: o.position.z, dist: 0, scattered: new Set(), n: 0, lookT: 0.6, why: "" };
    const ok = ctx.foot.script({
        update(dt, P, Fs) { return rideTick(dt, R, Fs); },
        abort(why) { endRide(why || "abort"); },
    });
    if (!ok) { CART.ride = null; return false; }
    CART.rides++;
    stat("crimeCartRides");
    lulu(pick(LINES.cart.on), true);
    bubble(pick(LINES.cart.owner), o, { y: 1.6, cls: "angry", dur: 2.2 });
    log("cart", { phase: "start", yaw: +yaw.toFixed(2) });
    if (F) F.vel.set(0, 0, 0);
    return true;
}

function rideTick(dt, R, F) {
    if (CART.ride !== R || !CART.obj) return false;
    R.t += dt;
    // downhill (cartoon physics): it picks up speed for a few seconds, then drag wins
    const push = R.t < 4.5 ? K.accel : 0;
    R.v = Math.max(0, Math.min(K.top, R.v + (push - K.drag * R.v * (R.t < 4.5 ? 0.25 : 1)) * dt));
    R.yaw -= (ctx.dialogOpen ? 0 : input.moveX) * K.steer * dt * Math.min(1, R.v / 3);
    const nx = R.x + Math.sin(R.yaw) * R.v * dt, nz = R.z + Math.cos(R.yaw) * R.v * dt;
    R.dist += Math.hypot(nx - R.x, nz - R.z);
    R.x = nx; R.z = nz;
    const o = CART.obj;
    o.position.set(R.x, 0, R.z);
    o.rotation.set(0, R.yaw, Math.sin(R.t * 18) * 0.02 * Math.min(1, R.v / 4));
    // Lulu sits in it
    if (F && F.lulu) {
        F.pos.x = R.x; F.pos.z = R.z;
        const L = F.lulu.obj;
        L.position.set(R.x - Math.sin(R.yaw) * 0.05, 0.42, R.z - Math.cos(R.yaw) * 0.05);
        L.rotation.y = R.yaw;
        F.lulu.update(dt, { sit: true, cheer: R.v > 6 });
    }
    // townsfolk scatter
    try {
        for (const p of (ctx.town.people ? ctx.town.people() : [])) {
            if (R.scattered.has(p.id) || Math.hypot(p.x - R.x, p.z - R.z) > K.scatterR) continue;
            R.scattered.add(p.id); R.n++;
            bubble(pick(LINES.cart.scatter), o, { y: 1.9, dur: 1.4 });
            log("cart", { phase: "scatter", n: R.n });
        }
    } catch (e) { /* no town people */ }
    // the law: a cop who sees a CART in the street
    R.lookT -= dt;
    if (R.lookT <= 0) { R.lookT = 1.2; if (footCrime("cart", CHARGES.cart.name, { x: R.x, z: R.z }) === "chase") { endRide("cop"); return false; } }
    // the end: a building front, a car, the town's edge, or it just stops
    const sa = streetAt(R.x, R.z);
    if (!sa || Math.abs(sa.d) > sa.walk + 0.4) { endRide("wall"); return false; }
    for (const c of ctx.traffic.cars) if (Math.hypot(c.x - R.x, c.z - R.z) < 2.4) { endRide("car"); return false; }
    if ((R.t > 1.5 && R.v < 0.5) || R.t > K.life) { endRide("stopped"); return false; }
    return true;
}

function endRide(why) {
    const R = CART.ride;
    if (!R) return;
    CART.ride = null;
    R.why = why;
    const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F;
    if (F && F.lulu) {
        F.lulu.obj.position.y = 0;
        // she steps out beside it (to the kerb side)
        F.pos.x = R.x + Math.cos(R.yaw) * 0.9; F.pos.z = R.z - Math.sin(R.yaw) * 0.9;
        F.lulu.obj.position.x = F.pos.x; F.lulu.obj.position.z = F.pos.z;
    }
    if (CART.obj) { CART.obj.rotation.z = why === "wall" || why === "car" ? 0.35 : 0; CART.parked = { x: R.x, z: R.z }; }
    CART.awayT = 0;
    if (why === "wall" || why === "car") lulu(pick(LINES.cart.crash), true);
    log("cart", { phase: "end", why, dist: Math.round(R.dist), n: R.n });
    if (why === "gone" || why === "abort" || why === "cop") return;
    if (R.dist < K.minRide) return;
    // pay: only the first ridesPerDay rides of a real day
    const C = PAY.cart;
    const want = Math.min(C.maxRide, C.base + R.dist * C.perM + R.n * C.perScatter);
    let paid = 0;
    if (SAVE.rides < C.ridesPerDay) { paid = payCapped("cart", want, C.maxRide * C.ridesPerDay); if (paid > 0) { SAVE.rides++; dirty(); } }
    stat("crimeCartMeters", Math.round(R.dist));
    if (paid > 0) mustSee(`${fill(LINES.cart.done, { name: C.name, m: Math.round(R.dist), n: R.n })} · +${paid} 💰`, "gold", "crime:cart");
    else mustSee(LINES.cart.capped, "", "crime:cart");
}

/** Every frame: the parked cart rolls itself home once she's walked off (or got back in a car). */
export function cartTick(dt) {
    if (!CART.obj || CART.ride) return;
    const p = CART.parked, h = CART.home;
    if (!p || !h || (Math.abs(p.x - h.x) < 0.05 && Math.abs(p.z - h.z) < 0.05)) return;
    const lp = onFoot() ? ctx.foot.pos : ctx.car.pos;
    const far = !lp || Math.hypot(lp.x - p.x, lp.z - p.z) > 28;
    CART.awayT = far ? CART.awayT + dt : 0;
    if (CART.awayT > 12) { home(); CART.awayT = 0; log("cart", { phase: "home" }); }
}
export const cartPaidToday = () => paidToday("cart");
export { CR };
