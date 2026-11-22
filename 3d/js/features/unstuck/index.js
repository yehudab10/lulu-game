// unstuck/index.js — 🆘 "I'M STUCK": a way out of any glitch in the map, that always works.
//
// The owner (2026-11-20): "a respawn button that respawns the player to the closest for sure normal point … in case
// someone ever gets stuck to a glitch in the map."
//
//   ❚❚ › 🆘 I'm stuck → a confirm → a soft cut, and she's at the NEAREST spot that is SURELY normal:
//     in the car  — upright on the nearest lane, heading the lane's way (a town: the nearest street's lane; a ramp: the
//                   ramp; a rest area's lot: the lot), velocity zero, the couple of cars that would hit her cleared;
//     on foot     — the nearest sidewalk (town) / shoulder (highway) / free bit of a lot; her own parked car stays hers
//                   (if the CAR is what's stuck — in a wall, under the map — "🚗 bring my car here" too);
//     in a room   — the room's own entry spot; a room that never finished loading / hung → out of its front door;
//     a passenger — out, beside the friend's car (the driver isn't moved);
//     a scene that has hung — ended the way its ⏭ skip ends it (or back on the road when it can't be skipped).
//   A spot is "surely normal" (normal()) when it's on a drivable lane / a sidewalk / a shoulder / a lot by construction,
//   finite, and clear: no collider of the world within reach, no town block, no water, no car on it.
//   A stuck full-screen fade (#townFade, #footWash, #intFade, #cameosFade, #lawFade, #softCut) is cleared.
//
// No cheating: a wanted level, a chase, a job's timer, coins and hearts are never touched; she lands as near as can be
// (capped: her nearest street / stretch of road, ±64 m along it — never "home"); 10 s between presses; refused in a party game / race (the auto-rescue below still saves a
// truly broken one — the nearest spot gains nobody anything); hidden while an ad holds the game or a cutscene plays
// normally (offered in one only once it has run for HUNG s).
//
// AUTOMATIC rescue (a check every 0.5 s of game time, from app.js's "tick" hook — nothing per frame): a NaN position,
// under the ground / falling for > 1 s, off the world's edge, inside a solid for > 2 s without moving → the same
// placement, with one quiet line ("🆘 back on the road").
//
// The pause menu is reachable in EVERY world state: a non-pausable state that has run for HUNG s (or a stuck fade)
// opens the "pause hatch" (ctx.pauseHatch: Esc / Options / ❚❚ pause it after all), and when the HUD is hidden a small
// ❚❚ appears top-right for touch. While paused the menu sits above every fade.
//
// ctx.unstuck = { now(opts), offer(), get cooldown, spot(kind), normal(x, z, kind), debug }
import { ctx, on, emit, hook, addMenuItem, css, setState } from "../../core/ctx.js";
import { pause, resume, showPauseMenu } from "../../core/screens.js";
import { canSkip, skipNow } from "../../core/skip.js";
import { pavedAt, LANE, HALF_ROAD, STEP } from "../../world.js";
import { PL, toLocal } from "../town/plan.js";
import { LOW } from "../foot/jump.js";
import { current as roomNow } from "../interiors/engine.js";
import * as H from "../../hud.js";

const U = {
    COOLDOWN: 10,          // s between two presses
    HUNG: 12,              // s a non-pausable / cutscene state may run before it's offered a way out
    STEP: 0.5,             // s of game time between two automatic checks
    good: null,            // her last finite place {x, z, s} (a NaN one searches from here)
    last: -1e9, acc: 0, bad: null, badT: 0, autoLast: -1e9, pendingSkip: false, overT: {}, n: 0, log: [],
    // (tests teleport her into odd spots on purpose: in ?test the automatic rescue runs only with &enable=…,unstuck — not "all")
    autoOff: !!ctx.TEST && !/[?&]enable=[^&]*\bunstuck\b/.test(location.search),
};
const fin = v => typeof v === "number" && isFinite(v);
const townOn = () => !!(ctx.town && ctx.town.active && PL.STREETS.length);
const footF = () => (ctx.foot && ctx.foot.debug ? ctx.foot.debug.F : null);
const _l = {}, _n = {}, _p = {};

// ── open lots inside a block (Lulu's own lot on Midwood's E 34th St: no house from the town — she walks it, her porch is
//    on it): never "inside a block" there ──
const LOT = { town: null, r: null };
function onLot(x, z) {
    const T = ctx.town;
    if (!T || !T.active) return false;
    if (LOT.town !== T.def) {
        LOT.town = T.def; LOT.r = null;
        const sp = T.spot && T.spot("luluHome");
        // (the spot: (x, z) the back of the lot, (lotX, lotZ) a point 12 m toward the street; u along the street, n toward it)
        if (sp && fin(sp.lotX) && fin(sp.ux) && fin(sp.nx)) LOT.r = { cx: (sp.x + sp.lotX) / 2, cz: (sp.z + sp.lotZ) / 2, ux: sp.ux, uz: sp.uz, nx: sp.nx, nz: sp.nz, hw: (sp.w || 14) / 2 + 1, hd: (sp.d || 24) / 2 + 1 };
    }
    const r = LOT.r;
    if (!r) return false;
    const dx = x - r.cx, dz = z - r.cz;
    return Math.abs(dx * r.ux + dz * r.uz) < r.hw && Math.abs(dx * r.nx + dz * r.nz) < r.hd;
}
on("town:leave", () => { LOT.town = null; LOT.r = null; });

// ── "surely normal" ────────────────────────────────────────────────────────
/** Why (x, z) is NOT a normal spot for a `kind` ("car" | "foot") — or null when it is. opts.ignore: a traffic car to skip. */
export function normal(x, z, kind = "car", opts = {}) {
    if (!fin(x) || !fin(z)) return "nan";
    const car = kind === "car", pad = car ? 1.9 : 0.55;
    // the world's colliders (houses, trees, signs, rails, a town's parked cars…) — a car fits nowhere near one; she can stand
    // beside a low one (a bench, a rail) but not in it
    for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders || []) {
        if (c.off) continue;
        // (a car: a body's width from anything tall, less from a rail / a kerb / another parked car's ring)
        const rr = c.r + (car ? (c.kind === "car" ? 1.3 : LOW[c.kind] ? 1.1 : pad) : LOW[c.kind] || c.kind === "car" ? 0.3 : pad);
        const dx = x - c.x, dz = z - c.z;
        if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
        if (dx * dx + dz * dz < rr * rr) return "collider:" + (c.kind || "?");
    }
    if (townOn()) {
        toLocal(x, z, _l);
        const p = car ? 1.2 : 0.4;
        if (!onLot(x, z)) for (const r of PL.OCCLUDERS) if (_l.x > r.x0 - p && _l.x < r.x1 + p && _l.z > r.z0 - p && _l.z < r.z1 + p) return "block";
        const def = ctx.town.def;
        for (const W of (def && def.water) || []) if (_l.x > W.x0 + 1 - p && _l.x < W.x1 + 4 + p && _l.z > W.z0 - p && _l.z < W.z1 + p) return "water";
    }
    // cars: on foot she mustn't land IN one; the car's own spot is cleared of traffic when she lands (clearTraffic)
    const ign = opts.ignore || null, F = footF();
    for (const c of ctx.traffic.cars) {
        if (c === ign || (car && !c.keep && !(c.data && c.data.footStub) && c.speed > 0.5)) continue;
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < 2.4 * 2.4) return "car";
    }
    if (F && F.parked) for (const pc of F.parked) { const dx = x - pc.x, dz = z - pc.z; if (dx * dx + dz * dz < 2.4 * 2.4) return "parked"; }
    return null;
}

// ── where she could go (by construction ON a lane / a sidewalk / a shoulder / a lot), nearest first ─────────────────
const OFFS = [0]; for (let k = 4; k <= 64; k += 4) OFFS.push(k, -k);
function townStreet(x, z, hint) {
    const n = ctx.world.road.nearest(x, z, hint, _n);
    // (along clamped to the street's real extent: from past its end — the middle of the lake — the lookup runs off it)
    if (!n || !n.street) return null;
    const a = n.s - n.street.base, along = Math.max(n.street.a0 + 4, Math.min(n.street.a1 - 4, a));
    return { st: n.street, along, d: n.d, h: n.h, over: a - along };
}
/**
 * The highway point nearest (x, z). highway.nearest only searches ±120 m round its hint: a stale hint (her car's s while
 * she walks, a lot far off the road) lands on the wrong stretch — then a coarse scan of the whole road built so far.
 */
function hwNearest(x, z, hint) {
    const hw = ctx.world.highway || ctx.world.road, n = hw.nearest(x, z, fin(hint) ? hint : 0, {});
    // (a wrong hint can give a sane-looking d with a garbage s: check the answer by going back to a world point)
    const ok = m => { const p = hw.point(m.s, m.d, _p); return fin(p.x) && Math.hypot(p.x - x, p.z - z) < 4; };
    if ((Math.abs(n.d) < 50 && ok(n)) || !hw.x || !hw.x.length) return n;
    let best = 1e18, bi = 0;
    for (let i = 0; i < hw.x.length; i += 10) { const dx = x - hw.x[i], dz = z - hw.z[i], e = dx * dx + dz * dz; if (e < best) { best = e; bi = i; } }
    const m = hw.nearest(x, z, bi * STEP, {});
    return ok(m) || !ok(n) ? m : n;
}
/** Which way the paved road at (x, z) runs (an airport loop, a lot's aisle): of 24 directions the longest paved run,
 *  the one nearest h0 of each opposite pair. */
function roadHeading(x, z, s, h0) {
    const hw = ctx.world.highway || ctx.world.road, q = {};
    let best = h0, bl = -1;
    for (let k = 0; k < 24; k++) {
        const a = k * Math.PI / 12;
        let L = 0;
        for (let r = 2; r <= 16; r += 2) { const n = hw.nearest(x + Math.sin(a) * r, z + Math.cos(a) * r, s, q); if (pavedAt(n.s, n.d) >= 3) L = r; else break; }
        const sc = L + (fin(h0) && Math.cos(a - h0) > 0 ? 1 : 0);
        if (sc > bl) { bl = sc; best = a; }
    }
    return best;
}
/** A town's nearest k streets to world (x, z): [{ st, along (clamped to the street), d, dist }] nearest first. */
function townStreets(x, z, k) {
    toLocal(x, z, _l);
    const all = [];
    for (const st of PL.APPROACH ? [...PL.STREETS, PL.APPROACH] : PL.STREETS) {
        const dx = _l.x - st.px, dz = _l.z - st.pz;
        const al = st.axis === "ns" ? _l.z : st.axis === "ew" ? _l.x : dx * st.ux + dz * st.uz;
        const d = st.axis === "ns" ? st.c - _l.x : st.axis === "ew" ? _l.z - st.c : dx * st.rx + dz * st.rz;
        const a = Math.max(st.a0 + 4, Math.min(st.a1 - 4, al));
        all.push({ st, along: a, d, dist: Math.hypot(al - a, d) });
    }
    return all.sort((p, q) => p.dist - q.dist).slice(0, k);
}
/** Car spots: [{ x, z, h, s, d }] nearest first. */
/** Where to search from: (x, z) and a road hint s — her last finite place when she's gone NaN. */
function anchor(x, z, s) {
    if (fin(x) && fin(z)) return { x, z, s: fin(s) ? s : U.good && fin(U.good.s) ? U.good.s : 0 };
    return U.good ? Object.assign({}, U.good) : { x: 0, z: 0, s: 0 };
}
function carSpots() {
    const out = [], car = ctx.car, A = anchor(car.pos.x, car.pos.z, car.s), x = A.x, z = A.z;
    const hx = fin(car.h) ? Math.sin(car.h) : 0, hz = fin(car.h) ? Math.cos(car.h) : 1;
    const rd = ctx.world.road;
    if (townOn()) {
        // the nearest three streets, both lanes: her side of the nearest first (pen: the other way +8 m, as if further) —
        // a lane can be full (Route 9's forever-jam): then the other lane / the next street
        const near = townStreets(x, z, 3);
        if (near.length) out.off = near[0].dist;
        for (const n of near) {
            const st = n.st, h = st.h + PL.ROT, mine = st.oneway ? Math.sign(st.oneway) : (hx * Math.sin(h) + hz * Math.cos(h) >= 0 ? 1 : -1);
            const lanes = st.oneway ? [[mine, LANE / 2], [mine, -LANE / 2]] : [[mine, mine * LANE / 2], [-mine, -mine * LANE / 2]];
            for (const [dir, lane] of lanes) for (const o of OFFS) {
                const a = n.along + o;
                if (a < st.a0 + 3 || a > st.a1 - 3) continue;
                const p = rd.point(st.base + a, lane, {});
                out.push({ x: p.x, z: p.z, h: dir > 0 ? p.h : p.h + Math.PI, s: st.base + a, d: lane, pen: dir === mine ? 0 : 8 });
            }
        }
    } else {
        const hw = ctx.world.highway || rd, near = hwNearest(x, z, A.s);
        out.off = Math.abs(near.d);
        const fwd = hx * Math.sin(near.h) + hz * Math.cos(near.h) >= 0;
        const ad = Math.abs(near.d), off = ad > HALF_ROAD + 0.5 ? pavedAt(near.s, near.d) : 0;
        const air = !!(ctx.airport && ctx.airport.inside);       // (the JFK landside: its roads loop every which way)
        if (off >= 2) {
            // a ramp / a cross road / a rest area's lot: the nearest paved spot of the same kind, off the lanes
            // (at JFK: only its roads — the kerb loop, the ramps — never the plaza; its frame is turned to the highway's: wider)
            const DD = air ? [0, 2, -2, 4, -4, 6, -6, 9, -9, 12, -12, 16, -16, 20, -20] : [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 8, -8];
            for (const o of [0, 4, -4, 8, -8, 12, -12, 18, -18, 26, -26, 36, -36]) for (const dd of DD) {
                const s = near.s + o, d = near.d + dd, pv = pavedAt(s, d);
                if (Math.abs(d) <= HALF_ROAD + 0.3 || pv < 2 || (air ? pv < 3 : (off >= 3) !== (pv >= 3))) continue;
                const p = hw.point(s, d, {});
                // (a ramp runs with the road on her side of it; a lot keeps the way she faced)
                const h = off >= 3 ? (d >= 0 ? p.h : p.h + Math.PI) : (fin(car.h) ? car.h : p.h);
                out.push({ x: p.x, z: p.z, h, s, d, probe: air });
            }
        }
        // the lanes: the nearest one, heading its way (our side forward; the oncoming side only if she faces that way on it)
        // (in JFK's landside she stays in it: the highway only if none of its roads is near)
        if (air && out.length) return sortNear(out, x, z);
        const lanes = near.d < -0.2 && !fwd ? [-LANE / 2, -LANE * 1.5] : [LANE / 2, LANE * 1.5];
        const lane = lanes.reduce((b, l) => Math.abs(l - near.d) < Math.abs(b - near.d) ? l : b, lanes[0]);
        for (const o of OFFS) {
            const s = near.s + o, p = hw.point(s, lane, {});
            out.push({ x: p.x, z: p.z, h: lane > 0 ? p.h : p.h + Math.PI, s, d: lane });
        }
    }
    return sortNear(out, x, z);
}
/** Foot spots: [{ x, z, h, s, d }] nearest first — a sidewalk (town), a shoulder or a free bit of a lot (highway). */
function footSpots(F) {
    const A = anchor(F.pos.x, F.pos.z, F.s), out = [], x = A.x, z = A.z, rd = ctx.world.road;
    if (townOn()) {
        const n = townStreet(x, z, A.s);
        if (n) {
            out.off = Math.hypot(n.d, n.over);
            const st = n.st, mid = (st.outer + st.walk) / 2, side = n.d >= 0 ? 1 : -1;
            for (const o of OFFS) for (const sd of [side, -side]) {
                const a = n.along + o;
                if (a < st.a0 + 2 || a > st.a1 - 2) continue;
                const p = rd.point(st.base + a, sd * mid, {});
                out.push({ x: p.x, z: p.z, h: p.h, s: st.base + a, d: sd * mid });
            }
        }
    } else {
        const hw = ctx.world.highway || rd, near = hwNearest(x, z, A.s);
        out.off = Math.abs(near.d);
        if (Math.abs(near.d) > HALF_ROAD + 1 && pavedAt(near.s, near.d) >= 1) {
            for (const o of [0, 3, -3, 6, -6, 9, -9, 12, -12, 16, -16]) for (const dd of [0, 2, -2, 4, -4, 6, -6, 9, -9]) {
                const s = near.s + o, d = near.d + dd;
                if (Math.abs(d) <= HALF_ROAD + 0.6 || pavedAt(s, d) < 1) continue;
                const p = hw.point(s, d, {});
                out.push({ x: p.x, z: p.z, h: p.h, s, d });
            }
        }
        const side = near.d >= 0 ? 1 : -1, sh = HALF_ROAD + 0.9;
        for (const o of OFFS) for (const sd of [side, -side]) {
            const s = near.s + o, p = hw.point(s, sd * sh, {});
            out.push({ x: p.x, z: p.z, h: sd > 0 ? p.h : p.h + Math.PI, s, d: sd * sh });
        }
    }
    return sortNear(out, x, z);
}
/** Where her own car can wait for her: the parking lane (town) / the shoulder (highway) by her. */
function kerbSpots(F) {
    const A = anchor(F.pos.x, F.pos.z, F.s), out = [], x = A.x, z = A.z, rd = ctx.world.road;
    if (townOn()) {
        const n = townStreet(x, z, A.s);
        if (n) {
            const st = n.st, side = n.d >= 0 ? 1 : -1, d = st.parkLane ? st.park : LANE / 2;
            for (const o of OFFS) for (const sd of [side, -side]) {
                const a = n.along + o;
                if (a < st.a0 + 4 || a > st.a1 - 4) continue;
                const p = rd.point(st.base + a, sd * d, {});
                out.push({ x: p.x, z: p.z, h: sd > 0 ? p.h : p.h + Math.PI, s: st.base + a, d: sd * d });
            }
        }
    } else {
        const hw = ctx.world.highway || rd, near = hwNearest(x, z, A.s);
        const side = near.d >= 0 ? 1 : -1, sh = HALF_ROAD + 1.0;
        for (const o of OFFS) for (const sd of [side, -side]) {
            const s = near.s + o, p = hw.point(s, sd * sh, {});
            out.push({ x: p.x, z: p.z, h: sd > 0 ? p.h : p.h + Math.PI, s, d: sd * sh });
        }
    }
    return sortNear(out, x, z);
}
function sortNear(list, x, z) {
    const ok = fin(x) && fin(z);
    for (const c of list) c.dist = ok ? Math.hypot(c.x - x, c.z - z) : 0;
    const out = list.filter(c => fin(c.x) && fin(c.z)).sort((a, b) => a.dist + (a.pen || 0) - b.dist - (b.pen || 0));
    out.off = fin(list.off) ? list.off : 0;
    return out;
}
/** The nearest surely-normal spot for "car" | "foot" | "kerb" (her parked car) — or null. */
function pick(kind, F, ignore = null, avoid = null) {
    let list = kind === "car" ? carSpots() : kind === "foot" ? footSpots(F) : kerbSpots(F);
    if (avoid) list = list.filter(c => Math.hypot(c.x - avoid.x, c.z - avoid.z) > 4.5);     // (her car never on top of her)
    // (the candidates are capped by construction: her nearest street / stretch of road, ±64 m along it — never "home".
    //  With nothing clear at all, the nearest of them anyway: it's still on a lane / a sidewalk)
    let c = list.find(c => !normal(c.x, c.z, kind === "foot" ? "foot" : "car", { ignore })) || list[0] || null;
    if (c && c.probe) { c = Object.assign({}, c); c.h = roadHeading(c.x, c.z, c.s, ctx.car.h); }
    if (c) c.off = list.off;
    return c;
}

// ── putting her there ──────────────────────────────────────────────────────
function clearTraffic(s, d, keep = null) {
    const T = ctx.traffic;
    for (const c of T.cars.slice()) if (c !== keep && !c.keep && !(c.data && (c.data.footStub || c.data.town && c.data.town.own)) && Math.abs(c.s - s) < 40 && Math.abs(c.d - d) < 2.6) T.remove(c);
}
function shield() { const G = ctx.G; if (G) { G.invT = Math.max(G.invT || 0, 2.5); G.invSoft = true; } }
function placeCar(sp) {
    const car = ctx.car;
    car.place(sp.x, sp.z, sp.h);
    car.s = sp.s; car.d = sp.d;
    car.pitch = 0; car.roll = 0; car.bump = 0;
    car.obj.visible = true;
    car.syncObject();
    clearTraffic(sp.s, sp.d);
    if (ctx.cam) ctx.cam.snap();
}
function placeFoot(F, sp) {
    F.pos.set(sp.x, 0.05, sp.z);
    F.s = sp.s; F.d = sp.d;
    F.vel.set(0, 0, 0);
    F.y = 0; F.vy = 0; F.air = false; F.launch = null;
    if (F.lulu) { F.lulu.obj.position.copy(F.pos); F.lulu.obj.rotation.x = 0; F.lulu.obj.rotation.y = sp.h; F.lulu.obj.visible = true; }
    if (ctx.cam) { ctx.cam.snap(); if (ctx.cam.free) ctx.cam.free.yaw = sp.h; }
}
function placeStub(c, sp) {
    c.x = sp.x; c.z = sp.z; c.h = sp.h; c.s = sp.s; c.d = sp.d; c.speed = 0; c.vx = 0; c.vz = 0;
    ctx.traffic.place(c, 0);
}
/** Is her parked car (on foot) itself stuck — inside something, under the map, gone NaN? */
function carBad(F) {
    const c = F && F.car && F.car.stub;
    if (!c || !ctx.traffic.cars.includes(c)) return false;
    if (!fin(c.x) || !fin(c.z) || (c.obj && c.obj.position.y < -1)) return true;
    const why = normal(c.x, c.z, "car", { ignore: c });
    return !!why && why !== "car" && why !== "parked";
}

// ── stuck full-screen fades ────────────────────────────────────────────────
const FADES = ["townFade", "footWash", "intFade", "cameosFade", "lawFade", "softCut"];
function fadeUp(el) {
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && +cs.opacity > 0.5;
}
function clearFade(el) {
    el.style.transition = "none";
    if (el.id === "softCut") { el.style.opacity = "0"; el.style.display = "none"; return; }
    el.classList.remove("on", "flash", "label");
    // (class-driven fades keep no inline opacity — the next fade must still work)
    el.style.opacity = el.id === "lawFade" ? "" : "0";
    if (el.id === "intFade") el.textContent = "";
}
/** Clear every stuck fade → how many were up. */
function clearFades() {
    let n = 0;
    for (const id of FADES) { const el = document.getElementById(id); if (fadeUp(el)) { clearFade(el); n++; } }
    return n;
}
const anyFadeUp = () => FADES.some(id => fadeUp(document.getElementById(id)));

// ── the rescue ─────────────────────────────────────────────────────────────
const say = (line, auto) => H.toast(line, "", { prio: auto ? 1 : 2, key: "unstuck" });
function done(how, auto, dist = 0, at = null) {
    U.n++;
    if (auto) U.autoLast = ctx.time; else U.last = ctx.time;
    // (an automatic rescue that didn't move her means the check was wrong about this place: back off, never loop)
    if (auto && auto !== "nan" && dist < 1 && how !== "hop" && how !== "room" && how !== "door") U.autoLast = ctx.time + 30;
    U.log.push({ how, auto: auto || null, dist: +dist.toFixed(1), state: ctx.state, t: +ctx.time.toFixed(2), d: at && fin(at.d) ? +at.d.toFixed(2) : null });
    if (U.log.length > 30) U.log.shift();
    shield();
    if (ctx.party && ctx.party.respawned) { try { ctx.party.respawned(); } catch (e) { /* not in a party */ } }
    emit("unstuck", { how, auto: auto || null, dist });
    emit("stat", { id: "unstucks", n: 1 });
}
/**
 * Put her at the nearest surely-normal spot now. opts: { auto: why (the automatic rescue — quiet), car: true (on foot:
 * bring her parked car too) }. → what it did ("car" | "foot" | "room" | "door" | "hop" | "skip" | "scene" | null).
 */
function rescue(opts = {}) {
    const auto = opts.auto || null;
    const fades = clearFades();
    const st = ctx.state;
    // a passenger: out, beside the friend's car (the driver isn't moved)
    if (ctx.openworld && ctx.openworld.riding) {
        try { ctx.openworld.hopOut({ moving: false }); } catch (e) { console.error("[unstuck] hop out", e); }
        done("hop", auto);
        return "hop";
    }
    if (st === "interior") return roomRescue(auto);
    if (st === "footRun") return footRescue(opts);
    if (st === "playing") return carRescue(auto);
    // a scene that has hung: end it the way ⏭ does, then put her right if she still isn't
    if (!auto && canSkip()) {
        U.pendingSkip = true;
        if (skipNow()) { done("skip", auto); return "skip"; }
        U.pendingSkip = false;
    }
    if (!auto && forceable()) {
        // (nothing to skip and it never ends: back on the road — her car on the nearest lane, as a knock-out's rolling
        //  recovery does. Never a jail / court / arrest scene: that would be a way out of the law.)
        try { setState("playing"); } catch (e) { console.error("[unstuck] scene", e); }
        if (ctx.state === "playing") { carRescue(null, true); return "scene"; }
    }
    if (fades) done("fade", auto);
    return fades ? "fade" : null;
}
/** A scene that can't be skipped and has run for FORCE s may be ended by force — unless it's the law's (or a party's). */
const FORCE = 30;
function forceable() {
    const st = ctx.state, def = ctx.states[st];
    return !!def && ctx.stateT > FORCE && def.world !== false && !/^(law|party|dina|heist|hustleHeist|interior)/.test(st);
}
/** Never a long trip: an automatic rescue further than (her distance from the road + 100 m) means a check or a lookup
 *  went wrong — it backs off for 30 s instead (a press: + 200 m). */
function tooFar(sp, auto) {
    const lim = Math.min((sp.off || 0) + (auto ? 100 : 200), auto ? 400 : 600);
    if (!(sp.dist > lim)) return false;
    console.warn("[unstuck] refused a far rescue", Math.round(sp.dist), "m (limit", Math.round(lim), ")");
    if (auto) U.autoLast = ctx.time + 30;
    return true;
}
function carRescue(auto, quietDone = false) {
    const car = ctx.car, from = { x: car.pos.x, z: car.pos.z };
    const sp = pick("car");
    if (!sp || tooFar(sp, auto)) return null;
    const go = () => placeCar(sp);
    if (ctx.dissolve) ctx.dissolve(go); else go();
    say(auto ? "🆘 back on the road" : "🆘 Back on the road", auto);
    done("car", auto, fin(from.x) ? Math.hypot(sp.x - from.x, sp.z - from.z) : 0, sp);
    return quietDone ? "scene" : "car";
}
function footRescue(opts) {
    const F = footF(), auto = opts.auto || null;
    if (!F) return null;
    // a little scene of her own that has hung (approaching a door, a hot-wire, a hail, a script): end it, as ⏭ would.
    // (an arrest / a knock-out / the climb-out intro play out — never cut short — unless they've hung for HUNG s)
    const soft = ["script", "approach", "hail"];
    if (F.phase !== "walk" && F.phase !== "hotwire" && F.phase !== "arrest" && (soft.includes(F.phase) || (F.phaseT || 0) > U.HUNG)) {
        // ("abort": the reason every feature already treats as cut short — no reward; the cart's joyride paid for "unstuck")
        if (F.script && F.script.abort) { try { F.script.abort("abort"); } catch (e) { console.error("[unstuck] script", e); } }
        F.script = null; F.approach = null; F.hail = null;
        F.phase = "walk"; F.phaseT = 0;
        H.prompt("");
    }
    if (F.phase !== "walk") {        // (a knock-out / the climb-out / an arrest / a hot-wire playing normally)
        if (!auto) say("🆘 One moment — let this finish first", false);
        return null;
    }
    const from = { x: F.pos.x, z: F.pos.z };
    const sp = pick("foot", F);
    if (sp && tooFar(sp, auto)) return null;
    const bring = (opts.car || carBad(F)) && F.car && F.car.stub && ctx.traffic.cars.includes(F.car.stub);
    const go = () => {
        if (sp) placeFoot(F, sp);
        // (searched from where she now stands, never on her)
        const k = bring ? pick("kerb", F, F.car.stub, F.pos) : null;
        if (k) placeStub(F.car.stub, k);
        return !!k;
    };
    const kerb = ctx.dissolve ? ctx.dissolve(go) : go();
    say(kerb ? (auto ? "🆘 back on your feet — the car's here too" : "🆘 Back on your feet — 🚗 your car's right here") : (auto ? "🆘 back on your feet" : "🆘 Back on your feet"), auto);
    done(kerb ? "foot+car" : "foot", auto, sp && fin(from.x) ? Math.hypot(sp.x - from.x, sp.z - from.z) : 0, sp);
    return "foot";
}
function roomRescue(auto) {
    const r = roomNow();
    if (!r || r.disposed) { clearFades(); return null; }
    // a room that never finished loading / is stuck leaving / has lost her: out of its front door
    const broken = !r.ready || !r.lulu || r.leaving || !fin(r.lulu.obj.position.x);
    if (broken || r.busy && !auto) {
        try { r.finishLeave(); } catch (e) { console.error("[unstuck] room", e); }
        say("🆘 Out of the front door", auto);
        done("door", auto);
        return "door";
    }
    const sp = r.spots.lulu || r.spots.door || { x: 0, z: 0, ry: 0 };
    const go = () => {
        if (r.auto) { const a = r.auto; r.auto = null; try { a.res && a.res(); } catch (e) { /* the awaiting script carries on */ } }
        r.lulu.obj.position.set(sp.x, r.groundAt(sp.x, sp.z), sp.z);
        r.lulu.obj.rotation.y = sp.ry || 0;
        r.vel.set(0, 0, 0);
        if (r.updateCamera) r.updateCamera(0, true);
    };
    if (ctx.dissolve) ctx.dissolve(go); else go();
    say("🆘 Back by the door", auto);
    done("room", auto);
    return "room";
}
// after a ⏭ ended a hung scene: is she somewhere normal? if not, put her right (quietly)
on("skip:end", () => {
    if (!U.pendingSkip) return;
    U.pendingSkip = false;
    setTimeout(() => { const why = badNow(); if (why) rescue({ auto: why }); }, 0);
});

// ── no cheating ────────────────────────────────────────────────────────────
/** Why the button can't be used right now (a line for the card) — or null. */
function refusal() {
    const g = ctx.openworld && ctx.openworld.game;
    const me = ctx.party && ctx.party.active ? ctx.party.uid : "me";
    if (g && g.ph === "go" && (!Array.isArray(g.ps) || g.ps.includes(me))) return "🎮 Not in the middle of a party game — the game's rules decide. (❚❚ › leave it if you're really stuck.)";
    const a = ctx.party && ctx.party.active && ctx.party.activity;
    if (a && a.k === "race") return "🏁 Not mid-race — a reset would be a free shortcut. (If she's truly broken, it fixes itself.)";
    if (ctx.state === "parking" || ctx.state === "parkingEnd") return "🅿️ The parking challenge has its own ↺ Retry.";
    return null;
}
const cooldown = () => Math.max(0, Math.ceil(U.COOLDOWN - (ctx.time - U.last)));
const WALKABLE = new Set(["playing", "footRun", "interior"]);
/** Is the button offered in this state? (a free-roaming one; a scene only once it has run for HUNG s) */
function offer() {
    if (!ctx.car || !ctx.world || (ctx.ads && ctx.ads.holding)) return false;
    const st = ctx.state, def = ctx.states[st];
    if (!def || st === "title" || st === "loading") return false;
    if (WALKABLE.has(st)) return true;
    if (def.world === false || /^(dina|party|playPhoto|shop|parking)/.test(st)) return false;
    return ctx.stateT > U.HUNG || anyFadeUp();
}
function openCard() {
    const no = refusal();
    const F = footF();
    const where = ctx.openworld && ctx.openworld.riding ? "out of your friend's car, right beside it"
        : ctx.state === "interior" ? "back by this room's door"
        : ctx.state === "footRun" ? (townOn() ? "on the nearest sidewalk" : "on the nearest shoulder")
        : ctx.state === "playing" ? (townOn() ? "on the nearest street, in her lane" : "on the nearest lane")
        : "out of this scene and back on the road";
    const cd = cooldown();
    const btns = [];
    if (!no && !cd) {
        btns.push({ id: "unstuckGo", label: "🆘 Yes — get me out", cls: "pink", action: () => { resume(); rescue({}); } });
        if (ctx.state === "footRun" && F && F.car && F.car.stub && ctx.traffic.cars.includes(F.car.stub) && carBad(F)) {
            btns.push({ id: "unstuckCar", label: "🚗 Bring my car here too", cls: "alt", action: () => { resume(); rescue({ car: true }); } });
        }
    }
    btns.push({ id: "unstuckBack", label: "↩ Back", cls: "ghost", action: () => showPauseMenu() });
    const body = no ? no : cd ? `One moment — you can use it again in ${cd} s.`
        : `Lulu goes ${where} — the nearest spot that's surely clear. Nothing else changes: coins, hearts, a wanted level or a job's clock stay just as they are.`;
    H.showScreen(`<div class="pause-menu unstuck-card"><h2>🆘 Stuck?</h2><p>${body}</p></div>`, btns, { onBack: () => showPauseMenu(), cls: "pause-card" });
}
addMenuItem("pause", {
    id: "unstuck", order: 8, group: "main",
    label: () => { const cd = cooldown(); return `🆘 I'm stuck${cd ? ` <small>(${cd} s)</small>` : ""}`; },
    visible: offer,
    action: () => openCard(),
});

// ── the automatic rescue ───────────────────────────────────────────────────
const LOWK = k => !!LOW[k] || k === "car";
/** What's wrong with where she is right now (for the automatic rescue) — or null. */
function badNow() {
    const st = ctx.state, car = ctx.car;
    if (!car || !ctx.world) return null;
    if (st === "playing") {
        if (ctx.openworld && ctx.openworld.riding) return null;
        const p = car.pos;
        if (!fin(p.x) || !fin(p.z) || !fin(p.y) || !fin(car.h)) return "nan";
        if (p.y < -1.5) return "under";
        if (car.speed < 1 && insideCar(p.x, p.z)) return "inside";
        if (edge(p.x, p.z, false, car.s)) return "edge";
        return null;
    }
    if (st === "footRun") {
        const F = footF();
        if (!F || F.phase !== "walk" || !F.pos) return null;
        const p = F.pos;
        if (!fin(p.x) || !fin(p.z) || !fin(p.y) || !fin(F.y || 0)) return "nan";
        if (p.y < -1.5 || (F.y || 0) < -1.5) return "under";
        if (Math.hypot(F.vel.x, F.vel.z) < 0.6 && insideFoot(F)) return "inside";
        if (edge(p.x, p.z, true, F.s)) return "edge";
        return null;
    }
    return null;
}
/** Off the world's edge: far beyond any street (a town) / far past the fences (the highway). */
function edge(x, z, foot, hint) {
    if (townOn()) {
        toLocal(x, z, _l);
        let best = 1e18;
        for (const st of PL.APPROACH ? [...PL.STREETS, PL.APPROACH] : PL.STREETS) {
            const dx = _l.x - st.px, dz = _l.z - st.pz;
            const al = st.axis === "ns" ? _l.z : st.axis === "ew" ? _l.x : dx * st.ux + dz * st.uz;
            const d = st.axis === "ns" ? st.c - _l.x : st.axis === "ew" ? _l.z - st.c : dx * st.rx + dz * st.rz;
            const a = Math.max(st.a0, Math.min(st.a1, al));
            best = Math.min(best, (al - a) * (al - a) + d * d);
        }
        return best > (foot ? 120 : 90) * (foot ? 120 : 90);
    }
    // (her OWN road hint: on foot the car's s is where she left it — a lookup from there can land on the wrong stretch)
    const n = hwNearest(x, z, fin(hint) ? hint : ctx.car.s), ad = Math.abs(n.d);
    return ad > (foot ? 240 : 90) && pavedAt(n.s, n.d) === 0;
}
function insideCar(x, z) {
    if (townOn()) {
        toLocal(x, z, _l);
        if (!onLot(x, z)) for (const r of PL.OCCLUDERS) if (_l.x > r.x0 + 0.5 && _l.x < r.x1 - 0.5 && _l.z > r.z0 + 0.5 && _l.z < r.z1 - 0.5) return true;
        const def = ctx.town.def;
        for (const W of (def && def.water) || []) if (_l.x > W.x0 + 5 && _l.x < W.x1 + 3 && _l.z > W.z0 + 2 && _l.z < W.z1 - 2) return true;
    }
    for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders || []) {
        if (c.off || c.r < 1 || LOWK(c.kind)) continue;
        const dx = x - c.x, dz = z - c.z, rr = c.r - 0.3;
        if (dx * dx + dz * dz < rr * rr) return true;
    }
    return false;
}
function insideFoot(F) {
    const x = F.pos.x, z = F.pos.z, y = F.y || 0;
    if (townOn()) {
        toLocal(x, z, _l);
        if (!onLot(x, z)) for (const r of PL.OCCLUDERS) if (_l.x > r.x0 + 0.3 && _l.x < r.x1 - 0.3 && _l.z > r.z0 + 0.3 && _l.z < r.z1 - 0.3) return true;
        const def = ctx.town.def;
        for (const W of (def && def.water) || []) if (_l.x > W.x0 + 5 && _l.x < W.x1 + 3 && _l.z > W.z0 + 2 && _l.z < W.z1 - 2) return true;
    }
    if (y > 0.3) return false;      // (up on a bench / a car roof: standing on something isn't being in it)
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - F.s) > 260) continue;
        for (const c of ch.colliders || []) {
            if (c.off || c.r < 0.6 || LOWK(c.kind)) continue;
            const dx = x - c.x, dz = z - c.z, rr = c.r - 0.25;
            if (dx * dx + dz * dz < rr * rr) return true;
        }
    }
    return false;
}
/** Note her place while it's finite (the anchor a NaN rescue searches from). */
function remember() {
    const st = ctx.state, F = footF();
    const p = st === "footRun" && F && F.pos ? F.pos : st === "playing" ? ctx.car.pos : null, s = st === "footRun" && F ? F.s : ctx.car.s;
    if (p && fin(p.x) && fin(p.z)) U.good = { x: p.x, z: p.z, s: fin(s) ? s : U.good ? U.good.s : 0 };
}
const WAIT = { nan: 0, under: 1, edge: 1, inside: 2 };
function autoTick() {
    if (U.autoOff || ctx.paused || ctx.skipping || ctx.view) { U.bad = null; U.badT = 0; return; }
    if (ctx.time - U.autoLast < 3 || ctx.time - U.last < 1) return;    // (it just did one: let it settle)
    const why = badNow();
    if (why !== U.bad) { U.bad = why; U.badT = 0; } else if (why) U.badT += U.STEP;
    if (why && U.badT >= WAIT[why]) { U.bad = null; U.badT = 0; rescue({ auto: why }); }
}

// ── the pause hatch: the pause menu is reachable in every world state ─────
css("unstuck", `
#unstuckPause { position: fixed; top: max(10px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right)); z-index: 45; display: none; }
#unstuckPause.on { display: flex; }
body.unstuck-paused #screen { z-index: 60; }
.unstuck-card p { margin: 6px 0 12px; line-height: 1.4; }
`);
const pBtn = document.createElement("button");
pBtn.id = "unstuckPause"; pBtn.className = "round-btn"; pBtn.setAttribute("aria-label", "Pause"); pBtn.textContent = "❚❚";
pBtn.addEventListener("click", ev => { ev.stopPropagation(); pause(); });
document.body.appendChild(pBtn);
function hatchTick() {
    const st = ctx.state, def = ctx.states[st], stuck = fadeStuck();
    let open = false;
    if (def && !def.pausable && st !== "title" && st !== "loading" && !ctx.paused && !ctx.skipping && !ctx.dialogOpen && !H.screenOpen()
        && def.world !== false && !/^(dina|party|playPhoto|shop|parking)/.test(st)) {
        open = ctx.stateT > U.HUNG || stuck;
    }
    ctx.pauseHatch = open;
    // a touch ❚❚ where the HUD's is hidden (a cutscene that has run long, a stuck fade)
    const hudHidden = document.getElementById("hud").classList.contains("hidden");
    const show = !ctx.paused && !H.screenOpen() && st !== "title" && st !== "loading" && def && def.world !== false
        && (open || (def.pausable && (hudHidden || stuck) && (ctx.stateT > U.HUNG || stuck)));
    pBtn.classList.toggle("on", !!show);
}
// a fade that's been fully up for more than 4 s
function fadeStuck() {
    let any = false;
    for (const id of FADES) {
        const up = fadeUp(document.getElementById(id));
        if (up) { U.overT[id] = (U.overT[id] || 0) + U.STEP; if (U.overT[id] > 4) any = true; } else U.overT[id] = 0;
    }
    return any;
}
on("pause", ({ paused }) => document.body.classList.toggle("unstuck-paused", !!paused));
on("state", () => { U.bad = null; U.badT = 0; });

// every 0.5 s of game time (app.js runs the "tick" hook once a frame: an add and a compare)
hook("tick", dt => {
    U.acc += dt;
    if (U.acc < U.STEP) return;
    U.acc = 0;
    try { remember(); hatchTick(); } catch (e) { console.error("[unstuck] hatch", e); }
    try { autoTick(); } catch (e) { console.error("[unstuck] auto", e); }
});

// ── the service ────────────────────────────────────────────────────────────
ctx.unstuck = {
    /** Rescue her now (the button's "yes" — no confirm, no cooldown check): opts { car: true } on foot brings her car too. */
    now: (opts = {}) => rescue(opts),
    /** Is 🆘 offered in the pause menu right now? */
    offer,
    /** Why it'd be refused (a party game, a race…) — or null. */
    refusal,
    get cooldown() { return cooldown(); },
    /** The nearest surely-normal spot for "car" | "foot" | "kerb" (her parked car, on foot) — or null. */
    spot: kind => pick(kind, footF(), kind === "kerb" && footF() && footF().car ? footF().car.stub : null),
    /** Why (x, z) isn't a normal spot ("collider:tree" | "block" | "water" | "car" | "nan"…) — or null. */
    normal,
    debug: { U, badNow, onLot, clearFades, anyFadeUp, carBad: () => carBad(footF()), openCard, get hatch() { return !!ctx.pauseHatch; }, get button() { return pBtn.classList.contains("on"); } },
};
