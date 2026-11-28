// features/foot — JUMPING on foot, and the LOW OBSTACLES she can hop over or stand on.
//
// On-foot collision is 2-D (circles from the chunks' colliders, parked cars, people). The jump adds just
// enough height to be fun without a 3-D physics engine:
//   • every collider may have a TOP (m). Below it (feet + a 0.32 m step) it's solid as before; with her feet
//     above it she passes over. No top = solid at any height (houses, trees, poles, signs, lamps, walls).
//   • a few kinds are STANDABLE: she lands on them and walks about up there — benches + planters (Main Street,
//     `bench` 0.55 m), the lawn chair saving a spot (`chair` 0.5 m). Guardrails (`rail` 0.8 m) are hop-over only.
//   • parked / stopped CARS are two boxes: the hood + trunk (~0.95 m, a minivan 1.05) and the roof (1.45 m, a
//     minivan 1.9): a running jump lands on the hood, another one gets her up on the roof. Her own convertible is
//     all "hood". Buses, trucks, ambulances and the steamroller stay solid (the □ vault is for those).
//   • kerbs are painted, not raised (the road is flat), so she just walks over them.
// Feel: ~1.25 m with the button held (a tap = a ~0.55 m hop), snappy gravity (heavier coming down), a little air
// control, coyote time (a jump just after stepping off something still counts) and a jump buffer (pressed just
// before landing = jumps on landing). A landing: a dip, a puff of dust, a thud, a tick of rumble.
// Style combo (features/moves, when it's on): 🦘 HOP over something · 🧍‍♀️ UP TOP onto a bench / car ·
// 🦘 LONG JUMP out of a slide · a roll pressed in the air rolls out of the landing.
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { input, rumble } from "../../input.js";
import * as A from "../../audio.js";

export const JUMP = {
    h: 1.25,            // m, the button held to the top
    cut: 0.35,          // let go while rising: the climb is cut to this share (a tap = a small hop)
    g: 25, fallG: 36,   // m/s² up / coming down (heavier on the way down: snappy, not floaty)
    maxFall: 22,
    coyote: 0.14,       // s after stepping off a ledge that a jump still counts
    buffer: 0.18,       // s a press before landing is remembered
    airCtl: 2.6,        // how fast the stick bends her flight (on the ground it's 9)
    step: 0.32,         // m she steps up without jumping
    hard: 8.5,          // m/s down = a hard landing (a short stagger)
    long: { vy: 0.8, speed: 1.08 },   // out of a slide: flatter, faster
    R: 0.32,
    feet: 0.16,         // m past her middle her feet still stand on an edge (generous: no slipping off a bench)
    stick: 0.35,        // landing ON something keeps this share of her run (she stops on it instead of sliding off)
};
/** Collider kinds with a height: top (m), stand (she can land + walk on it). Anything not here is solid. */
export const LOW = {
    bench: { top: 0.55, stand: true },          // features/foot/street.js: benches + planters along Main Street
    chair: { top: 0.5, stand: true },           // the town's lawn chair saving THE parking spot
    rail: { top: 0.8 },                         // the exit ramps' guardrails
    car: { top: 0.95, stand: true },            // a town kerbside car's two circles (the real box below wins near her)
};
/** Car boxes by model key: half length, half width, hood/trunk top, roof top + its span along the car (local z). */
const CARS = [
    [/lulu|convert/, { len: 2.1, w: 0.9, hood: 0.85, roof: 0, r0: 0, r1: 0 }],
    [/minivan|van/, { len: 2.45, w: 0.97, hood: 1.05, roof: 1.9, r0: -2.0, r1: 1.0 }],
    [/sedan|cop|taxi|coupe|car/, { len: 2.2, w: 0.9, hood: 0.95, roof: 1.45, r0: -1.0, r1: 0.6 }],
];
const carDims = key => { if (!key) return null; for (const [re, d] of CARS) if (re.test(key)) return d; return null; };
export { carDims };

const topOf = c => {
    if (c._lowT === undefined) {
        // (a "car" circle wider than a car's — a bus's chain, the car-service sedans' big rings — stays solid)
        const l = c.kind === "car" && c.r > 1.1 ? null : LOW[c.kind];
        c._lowT = l ? l.top : null; c._lowS = !!(l && l.stand);
    }
    return c._lowT;
};

/** Per-session vertical state on F (foot's session). */
export function initAir(F) {
    Object.assign(F, { y: 0, vy: 0, air: false, ground: 0, coyote: 0, jumpBuf: 0, airT: 0, cut: false, landT: 0, landP: 0,
        over: 0, overKind: "", from: 0, launch: null, jumps: 0, longJump: false, camY: 0, peak: 0 });
}

// ── the height-aware push-out (replaces foot's flat collideStatic) ──────────────────────────
const _g = { ground: 0, over: 0, kind: "" };
function pushC(p, x, z, r) {
    const dx = p.x - x, dz = p.z - z, rr = r + JUMP.R, d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr || d2 < 1e-8) return false;
    const d = Math.sqrt(d2);
    p.x = x + dx / d * rr; p.z = z + dz / d * rr;
    return true;
}
/** A circle with a height: push her out unless she's above it; note it as ground if she's over a standable one. */
function lowCircle(p, x, z, r, top, stand, reach, kind) {
    const dx = p.x - x, dz = p.z - z, rr = r + JUMP.R, d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) return;
    if (top == null || top > reach) { pushC(p, x, z, r); return; }
    if (top > _g.over) { _g.over = top; _g.kind = kind; }
    if (stand && d2 < (r + JUMP.feet) * (r + JUMP.feet) && top > _g.ground) _g.ground = top;     // (her feet reach a bit past her middle)
}
/** A car as two boxes (hood + roof): solid below each top, ground on top of it. */
function carBox(p, x, z, h, D, reach) {
    const fx = Math.sin(h), fz = Math.cos(h);
    const ox = p.x - x, oz = p.z - z;
    let al = ox * fx + oz * fz, ac = ox * -fz + oz * fx;
    const R = JUMP.R;
    if (Math.abs(al) > D.len + R || Math.abs(ac) > D.w + R) return;
    const box = (a0, a1, w, top) => {
        const mid = (a0 + a1) / 2, half = (a1 - a0) / 2;
        const pa = half + R - Math.abs(al - mid), pc = w + R - Math.abs(ac);
        if (pa <= 0 || pc <= 0) return;
        if (top > reach) {
            // out along the shallower side
            if (pa < pc) al += Math.sign(al - mid || 1) * pa; else ac += Math.sign(ac || 1) * pc;
            return;
        }
        if (top > _g.over) { _g.over = top; _g.kind = "car"; }
        if (Math.abs(al - mid) < half + JUMP.feet * 0.6 && Math.abs(ac) < w + JUMP.feet * 0.6 && top > _g.ground) _g.ground = top;
    };
    box(-D.len, D.len, D.w, D.hood);
    if (D.roof > 0) box(D.r0, D.r1, D.w - 0.1, D.roof);
    p.x = x + fx * al - fz * ac;
    p.z = z + fz * al + fx * ac;
}

/**
 * Push Lulu out of everything solid at her height and find the ground under her.
 * foot passes its world: chunks' colliders, F.parked, the booth, people and stopped cars (stub + traffic).
 * → { ground, over, kind } (over = the tallest low thing she's above right now — for HOP scoring)
 */
export function collideAll(F, extra) {
    const p = F.pos, reach = F.y + JUMP.step;
    _g.ground = 0; _g.over = 0; _g.kind = "";
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - F.s) > 220) continue;
        for (const c of ch.colliders) {
            if (c.off) continue;
            const dx = p.x - c.x, dz = p.z - c.z, rr = c.r + JUMP.R;
            if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;
            const top = topOf(c);
            lowCircle(p, c.x, c.z, c.r, top, c._lowS, reach, c.kind);
        }
    }
    for (const pc of F.parked) {
        const D = (pc.vtype === "car" || pc.vtype === "cop") && carDims(pc.key);
        if (D) carBox(p, pc.x, pc.z, pc.h, D, reach);
        else { const fx = Math.sin(pc.h), fz = Math.cos(pc.h); for (const co of pc.circles) pushC(p, pc.x + fx * co, pc.z + fz * co, pc.r); }
    }
    if (extra) extra(p, reach);
    return _g;
}
export { carBox, pushC };

/**
 * The free camera's walls (ctx.cam.orbit's `clip`): how far from the pivot `tgt` the camera may sit along (dx, dy, dz)
 * before it would be inside something solid she can't walk through either — the houses, a town block, a big tree, a
 * sign gantry (low things: a bench, a rail, a parked car's ring — and anything the camera is above — don't count).
 * Cheap: the same nearby circles collideAll walks, + a town's block rectangles.
 */
const CAM_PAD = 0.25, CAM_PAD_BIG = 0.95, CAM_FRONT = 2.4, CAM_MIN = 0.05, _cl = {}, _cl2 = {};
/** An open lot inside a town block (features/shops' car lot): walkable, the camera may stand over it. */
const openLot = (x, z) => !!(ctx.shops && ctx.shops.onLot && ctx.shops.onLot(x, z))
    || !!(ctx.home && ctx.home.isFamily && ctx.home.isFamily(x, z))
    || !!(ctx.town && ctx.town.onDrive && ctx.town.onDrive(x, z));      // (a house's driveway: its minivan stands on it — sweep-health)      // (and her own lot on E 34th St: the camera stops at its hedge, not in the neighbours' houses)     // (pad < her radius: walking ALONG a wall the camera behind her stays out; closer than ~1.5 m it rises over her head — core/camera.js orbit)
export function camClip(F, tgt, dx, dy, dz, D) {
    const h2 = dx * dx + dz * dz;
    if (h2 < 1e-4) return D;
    let best = D, under = false, outOf = 0, hard = D;      // (hard: the nearest house / wall / block — never gone through)
    const T = ctx.town, pl = T && T.active && T.plan;
    // (in a town the BLOCK outlines below are the houses' real front line — the ring of circles round a block stands
    //  ~1 m out in front of it, and hugging a wall the camera behind her kept catching those)
    const blocks = !!(pl && pl.OCCLUDERS);
    for (const ch of ctx.world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - F.s) > 220) continue;
        for (const c of ch.colliders) {
            if (c.off) continue;
            if (c.kind === "tree") {
                // a BIG trunk (the woods' and parks' trees, r ≥ 0.8) is a wall too — the car backed up against one
                // put the chase cam inside it; thin street-tree trunks don't pull it in (it would pop past each one)
                if (c.r >= 0.8) {
                    const ox = tgt.x - c.x, oz = tgt.z - c.z, R = c.r + 0.15, cc = ox * ox + oz * oz - R * R, b = ox * dx + oz * dz;
                    if (cc > 0 && b < 0) { const disc = b * b - h2 * cc; if (disc > 0) best = Math.min(best, (-b - Math.sqrt(disc)) / h2); }
                    // (the pivot INSIDE the trunk — shouldn't happen, she's pushed out every frame; if it does, the camera goes
                    //  out along its line to where it leaves the trunk, never sits in it — ci/qa's "camera in a tree")
                    else if (cc <= 0) outOf = Math.max(outOf, (-b + Math.sqrt(Math.max(0, b * b - h2 * cc))) / h2 + 0.1);
                }
                // a tree's LEAVES (its collider is just the trunk): only when the camera's own spot would be inside the
                // canopy does it come in to its near edge — inside, the screen goes dark green / black for a moment
                // (a trunk merely between them doesn't pull it in: it would pop in and out past every street tree)
                const R = canopyR(c), ex = tgt.x + dx * best - c.x, ez = tgt.z + dz * best - c.z, ey = tgt.y + dy * best;
                const ox = tgt.x - c.x, oz = tgt.z - c.z, cc = ox * ox + oz * oz - R * R;
                if (cc <= 0) { under = true; continue; }      // (she's under it herself: the camera stays back, out past the leaves)
                if (ey < 1.5 || ey > 8.5 || ex * ex + ez * ez > R * R) continue;
                const b = ox * dx + oz * dz, disc = b * b - h2 * cc;
                if (disc > 0) best = Math.min(best, (-b - Math.sqrt(disc)) / h2);
                continue;
            }
            if (c.r < 0.8 || topOf(c) != null || (blocks && c.kind === "house" && !c.camWall)) continue;
            const ox = tgt.x - c.x, oz = tgt.z - c.z;
            // (the traffic circle's island is a 6 m lawn — only its statue in the middle stands tall)
            const cr = c.kind === "island" ? Math.min(c.r, 2.8) : c.r;
            // (a big circle is one of a row standing in for a BOX — a rest area's 40 × 12 m building is two rows of r 3.4: its
            //  corners + the wall between two circles stand up to ~0.6 m outside them; backed up to it the chase cam sat
            //  inside the wall, one dark flat screen — so the lens keeps a wider berth of those; ci/sweep-camera)
            let R = cr + (cr >= 3 ? CAM_PAD_BIG : CAM_PAD), cc = ox * ox + oz * oz - R * R;
            // (she's right up against it — the pivot is inside its pad: the wall itself still counts)
            if (cc <= 0) { R = cr + 0.05; cc = ox * ox + oz * oz - R * R; if (cc <= 0) continue; }
            const b = ox * dx + oz * dz;
            if (b >= 0) continue;                        // pointing away from it
            const disc = b * b - h2 * cc;
            if (disc <= 0) continue;
            const t = (-b - Math.sqrt(disc)) / h2;
            if (t < best && tgt.y + dy * t < (c.kind === "house" ? 7.5 : 4.5)) { best = t; hard = Math.min(hard, t); }
        }
    }
    if (blocks) {
        // (the blocks are in the town's LOCAL frame — an attached town is turned to its interchange: PL.local / ROT)
        const L = pl.local(tgt.x, tgt.z, _cl), ax = L.x, az = L.z, wx = dx, wz = dz;
        dx = wx * pl.COS - wz * pl.SIN; dz = wx * pl.SIN + wz * pl.COS;
        for (const r of pl.OCCLUDERS) {
            // (a block's outline sits ~2 m BEHIND its houses' front walls — FRONT + 1.2 — and a landmark like Lakewood's
            //  yeshiva protrudes past the front line: padded by only CAM_PAD, the camera behind her as she came out of a
            //  front door sat inside the house — one flat colour, her out of the picture. The lens stops at the walls.)
            let p = CAM_PAD + CAM_FRONT;
            if (ax > r.x0 - p && ax < r.x1 + p && az > r.z0 - p && az < r.z1 + p) p = 0.05;     // (right up against it)
            const x0 = r.x0 - p, x1 = r.x1 + p, z0 = r.z0 - p, z1 = r.z1 + p;
            if (ax > x0 && ax < x1 && az > z0 && az < z1) {
                // (she's INSIDE the block: an open lot in it — features/shops' car lot. The camera stays over the lot: it stops
                //  where the lot ends and the block goes on — the backyards behind it)
                if (openLot(tgt.x, tgt.z)) for (let t = 0.3; t < best; t += 0.3) {
                    const px = tgt.x + wx * t, pz = tgt.z + wz * t, Lp = pl.local(px, pz, _cl2);
                    if (Lp.x > r.x0 && Lp.x < r.x1 && Lp.z > r.z0 && Lp.z < r.z1 && !openLot(px, pz)) { best = Math.max(CAM_MIN, t - 0.3); hard = Math.min(hard, best); break; }
                }
                continue;
            }
            let t0 = 0, t1 = best;
            if (Math.abs(dx) < 1e-9) { if (ax < x0 || ax > x1) continue; }
            else { let ta = (x0 - ax) / dx, tb = (x1 - ax) / dx; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) continue; }
            if (Math.abs(dz) < 1e-9) { if (az < z0 || az > z1) continue; }
            else { let ta = (z0 - az) / dz, tb = (z1 - az) / dz; if (ta > tb) [ta, tb] = [tb, ta]; t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) continue; }
            if (tgt.y + dy * t0 < 8) { best = t0; hard = Math.min(hard, t0); }
        }
    }
    if (outOf > 0 && best < outOf) best = Math.min(D, outOf, hard);      // (out of the trunk she's inside — never through a house / wall)
    const d = best >= D ? D : Math.max(CAM_MIN, best);
    // (under a tree, a camera pulled in close must not rise over her head — that's up into the leaves)
    return under ? { d, noLift: true } : d;
}
/** How far a tree's leaves reach from its trunk (tree_round's canopy is ~2.2 m × its scale; the colliders don't carry the
 *  scale: the highway's are 0.48 × scale, a town's street trees (0.4) stay ≤ ~1.05×, its boulevard / park ones go to ~1.5×). */
const canopyR = c => Math.min(3.8, Math.max(c.r * 4.6 + 0.2, c.r < 0.42 ? 2.4 : 3.4));

// ── the jump itself ─────────────────────────────────────────────────────────────────────────
/** Launch now: opts.long (out of a slide: { vx, vz } her slide velocity). */
export function launch(F, opts = {}) {
    const v0 = Math.sqrt(2 * JUMP.g * JUMP.h) + JUMP.g * 0.012;     // (+ a frame step's worth: the stepped arc peaks a bit low)
    F.vy = opts.long ? v0 * JUMP.long.vy : v0;
    if (opts.vx != null) { F.vel.x = opts.vx * (opts.long ? JUMP.long.speed : 1); F.vel.z = opts.vz * (opts.long ? JUMP.long.speed : 1); }
    F.air = true; F.airT = 0; F.coyote = 0; F.jumpBuf = 0; F.cut = false; F.from = F.ground; F.over = 0; F.overKind = ""; F.peak = F.y;
    F.longJump = !!opts.long; F.jumps++;
    if (!ctx.skipping) A.sfxJump(opts.long ? 1 : 0.6);
    if (save3d.settings.vibration !== false) rumble(0.05, 0.18, 50);
}

/**
 * One vertical step (foot's walk() calls it after the horizontal move + collideAll).
 * P.jump (edge) / input.jumpHeld drive it. → "land" (with F.landP 0–1) | "jump" | null
 */
export function airStep(F, dt, P, g, canJump) {
    if (P && P.jump && canJump) F.jumpBuf = JUMP.buffer;
    else if (F.jumpBuf > 0) F.jumpBuf -= dt;
    if (F.launch) { const L = F.launch; F.launch = null; launch(F, L); return "jump"; }
    F.ground = g.ground;
    if (!F.air) {
        if (F.y < F.ground) F.y = F.ground;                       // stepped up (≤ step: anything taller pushed her out)
        else if (F.y > F.ground + 0.02) { F.air = true; F.vy = 0; F.coyote = JUMP.coyote; F.airT = 0; F.from = F.y; F.over = 0; F.peak = F.y; F.longJump = false; }  // walked off a ledge
        if (!F.air && F.jumpBuf > 0 && canJump) { launch(F); return "jump"; }
        if (!F.air) { F.y = F.ground; return null; }
    }
    // airborne
    F.airT += dt;
    if (F.coyote > 0) {
        F.coyote -= dt;
        if (F.jumpBuf > 0 && canJump && F.vy <= 0) { launch(F); return "jump"; }
    }
    if (F.vy > 0 && !F.cut && !input.jumpHeld && !F.longJump && F.airT > 0.04) { F.vy *= JUMP.cut; F.cut = true; }
    F.vy -= (F.vy > 0 ? JUMP.g : JUMP.fallG) * dt;
    if (F.vy < -JUMP.maxFall) F.vy = -JUMP.maxFall;
    F.y += F.vy * dt;
    if (F.y > F.peak) F.peak = F.y;
    if (g.over > F.over && F.y > g.over) { F.over = g.over; F.overKind = g.kind; }
    if (F.y <= F.ground && F.vy <= 0) {
        const vImp = -F.vy;
        F.y = F.ground; F.vy = 0; F.air = false;
        F.landP = Math.min(1, vImp / 12);
        F.landT = vImp > JUMP.hard ? 0.26 : 0.16;
        F.landHard = vImp > JUMP.hard;
        if (F.ground > 0.2) { F.vel.x *= JUMP.stick; F.vel.z *= JUMP.stick; }
        return "land";
    }
    return null;
}

/** The landing's feedback: a thud, dust, a tick of rumble (the dip + crouch are foot's pose). */
export function landFx(F) {
    const p = F.landP || 0.3;
    if (!ctx.skipping) A.sfxLand(p);
    if (save3d.settings.vibration !== false) rumble(0.12 + p * 0.4, 0.2 + p * 0.3, 60 + p * 80, true);
    const fx = ctx.car && ctx.car.fx;
    if (fx && !ctx.skipping) {
        const n = 3 + Math.round(p * 5);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
            fx.emit(F.pos.x + Math.sin(a) * 0.25, 0.08 + F.y, F.pos.z + Math.cos(a) * 0.25, Math.sin(a) * (1.2 + p), 0.5 + p * 0.6, Math.cos(a) * (1.2 + p), 0.45 + p * 0.3, 0.45, [0.8, 0.74, 0.62]);
        }
    }
}
