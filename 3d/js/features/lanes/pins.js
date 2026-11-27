// features/lanes/pins.js — 🎳 THE ROLL + THE SCORE, pure code (no three.js, no DOM: node can run it).
//
// A throw is four small whole numbers (0…35 each — what goes over the wire, see game.js):
//   x  where she lets go across the lane      aim  the angle down the lane
//   p  power (the ball's speed)                s    spin (the hook at the back end; 17.5 = straight)
// roll(standing, t) plays it out in 2D on the lane (x across, y down from the foul line): the ball's line (straight,
// then hooking over the last third), the gutter, and the pin deck — the ball knocks pins it touches, a knocked pin flies
// off and knocks what's on its way (energy fading), pins bounce back off the side boards. It's cheap and scripted, but
// it's the ball's line, speed and spin that decide it, so it LOOKS physical. The result (a 10-bit mask of the pins
// down) is decided ON THE THROWER'S SCREEN and travels with the throw, so every screen shows the same pins + score
// even if two browsers' floating point ever disagreed in the last digit.
//
// Scoring: 10-pin rules — a strike = 10 + the next two balls, a spare = 10 + the next ball, the last frame gets the
// extra ball(s); a game is 10 frames (or a quick 3).

export const LANE = {
    L: 13.0,            // foul line → the head pin (m; a real lane is 18.3 — a game lane reads better a bit shorter)
    half: 0.53,         // half the lane's width (the gutters are past it)
    ballR: 0.109, pinR: 0.06,
    row: 0.264, gap: 0.305,       // the triangle: rows behind each other, pins across a row
    deck: 1.0,          // past the head pin: the pit
};
// pins 1…10 (index 0…9): 1 at the front, then 2 3, 4 5 6, 7 8 9 10 (left → right, as she sees them)
export const PINS = [];
for (let r = 0, n = 0; r < 4; r++) for (let i = 0; i <= r; i++, n++) PINS.push({ n: n + 1, x: (i - r / 2) * LANE.gap, y: LANE.L + r * LANE.row });
export const ALL = 1023;

const Q = 35;
/** The four numbers → the ball's start, angle, speed, spin. */
export function decodeThrow(t) {
    const c = v => Math.max(0, Math.min(Q, v | 0));
    return {
        x0: (c(t.x) - Q / 2) / (Q / 2) * 0.45,
        a: (c(t.aim) - Q / 2) / (Q / 2) * 0.034,
        v: 5.5 + c(t.p) / Q * 4.5,
        s: (c(t.s) - Q / 2) / (Q / 2),
    };
}
/** The other way (the controls → the wire): numbers in the same units → 0…35. */
export function encodeThrow(x0, a, v, s) {
    const q = (k, lo, hi) => Math.max(0, Math.min(Q, Math.round((k - lo) / (hi - lo) * Q)));
    return { x: q(x0, -0.45, 0.45), aim: q(a, -0.034, 0.034), p: q(v, 5.5, 10), s: q(s, -1, 1) };
}

const HOOK0 = 0.62;      // the hook starts this far down the lane (as a fraction of L)
/** Where the ball is across the lane at y (m), and its slope there. */
export function lineAt(D, y) {
    const L = LANE.L, yh = L * HOOK0, H = 0.42 * D.s * (7.5 / D.v);
    let x = D.x0 + Math.tan(D.a) * y, k = Math.tan(D.a);
    if (y > yh) { const u = (y - yh) / (L - yh); x -= H * u * u; k -= 2 * H * u / (L - yh); }
    return { x, k };
}

/**
 * Play one ball against the pins standing (mask: bit i = pin i+1 up). →
 *   { down: mask of the pins knocked by THIS ball, gutter: y | -1 (where it dropped in), ballX(y), deckT,
 *     hits: [{ i, t, dx, dy, d }] — each knocked pin: when (s after release), which way it flies, how far }
 */
export function roll(standing, t) {
    const D = decodeThrow(t), L = LANE.L;
    const out = { D, down: 0, gutter: -1, hits: [], speed: D.v, endX: 0 };
    // the run down the lane: in the gutter if the ball's centre crosses the edge
    for (let y = 0; y <= L - 0.3; y += 0.05) {
        const { x } = lineAt(D, y);
        if (Math.abs(x) > LANE.half) { out.gutter = y; out.endX = Math.sign(x) * (LANE.half + 0.07); return out; }
    }
    const up = [];
    for (let i = 0; i < 10; i++) up.push({ i, x: PINS[i].x, y: PINS[i].y, on: !!(standing & (1 << i)) });
    const q = [];
    const knock = (pin, t0, dx, dy, e) => {
        if (!pin.on) return;
        pin.on = false;
        const n = Math.hypot(dx, dy) || 1;
        const d = Math.min(1.5, 0.22 + e * 0.11);
        const h = { i: pin.i, t: +t0.toFixed(3), dx: dx / n, dy: dy / n, d: +d.toFixed(3), e };
        out.hits.push(h); out.down |= 1 << pin.i;
        q.push(h);
    };
    // the ball through the deck
    let { x: bx, k } = lineAt(D, L - 0.3), by = L - 0.3, v = D.v, tt = (L - 0.3) / D.v;
    const RB = LANE.ballR + LANE.pinR;
    while (by < L + LANE.deck && Math.abs(bx) < LANE.half + 0.1) {
        const dy = 0.01;
        by += dy; bx += k * dy; tt += dy / v;
        for (const p of up) {
            if (!p.on) continue;
            const ex = p.x - bx, ey = p.y - by, d = Math.hypot(ex, ey);
            if (d >= RB) continue;
            // the pin flies away from the ball's centre, pushed along the ball's way
            knock(p, tt, ex / d * 0.75 + k * 0.25, ey / d * 0.75 + 0.25, v * (0.55 + 0.45 * Math.max(0, ey / d)) * (1 + 0.3 * Math.abs(D.s)));
            // the ball is pushed off the other way (more when it's slow; a spinning ball drives through more) and slows a little
            k -= (ex / d) * 0.16 * (7.5 / v) * (1 - 0.6 * Math.abs(D.s));
            v *= 0.94;
        }
    }
    out.endX = bx;
    // knocked pins fly and knock others (energy fades; off the side boards they come back — the kickbacks)
    for (let n = 0; n < q.length && n < 60; n++) {
        const h = q[n];
        let px = PINS[h.i].x, py = PINS[h.i].y, dx = h.dx, dy = h.dy, rem = h.d, e = h.e, t0 = h.t;
        for (let step = 0; step < 3 && rem > 0.05 && e > 0.8; step++) {
            // the nearest standing pin along this flight
            let best = null, bt = rem;
            for (const p of up) {
                if (!p.on) continue;
                const rx = p.x - px, ry = p.y - py, along = rx * dx + ry * dy;
                if (along <= 0 || along > bt) continue;
                const side = Math.abs(rx * dy - ry * dx);
                if (side < LANE.pinR * 2.1) { best = p; bt = along; }
            }
            // …or the side board first
            const wallX = dx > 0 ? LANE.half + 0.12 : -LANE.half - 0.12;
            const tw = Math.abs(dx) > 1e-3 ? (wallX - px) / dx : 1e9;
            if (best && bt <= tw) {
                const cx = px + dx * bt, cy = py + dy * bt;
                const ex = best.x - cx, ey = best.y - cy, d = Math.hypot(ex, ey) || 1;
                const tHit = t0 + bt / Math.max(1, e);
                knock(best, tHit, dx * 0.55 + ex / d * 0.45, dy * 0.55 + ey / d * 0.45, e * 0.72);
                // the flying pin carries on, slower, nudged off
                px = cx; py = cy; rem = (rem - bt) * 0.55; e *= 0.6; t0 = tHit;
                dx -= ex / d * 0.3; dy -= ey / d * 0.3; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
            } else if (tw < rem && py + dy * tw < L + LANE.deck - 0.1) {
                px += dx * tw; py += dy * tw; rem = (rem - tw) * 0.6; e *= 0.65; t0 += tw / Math.max(1, e);
                dx = -dx * 0.8; dy = dy * 0.9 + 0.05; const m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
            } else break;
        }
    }
    return out;
}

// ── the score ──────────────────────────────────────────────────────────
const bits = m => { let n = 0; for (let i = 0; i < 10; i++) if (m & (1 << i)) n++; return n; };
export const countOf = bits;

/**
 * A bowler's balls (each = the mask of pins it knocked down) → the frames:
 *   { frames: [{ rolls: [n…], marks: ["X" | "/" | "-" | "9"…], score: cumulative | null }], total, done,
 *     standing (the pins up for the NEXT ball), frame (the frame the next ball is in, 0-based), ball (its index in it),
 *     complete: frames finished }
 */
export function framesOf(downs, nFrames = 10) {
    const frames = [];
    let standing = ALL, f = 0, ball = 0, cur = null;
    const rolls = [];
    for (const m of downs) {
        if (f >= nFrames) break;
        const n = bits(m & standing);
        if (!cur) { cur = { rolls: [], marks: [], first: rolls.length }; frames.push(cur); }
        const last = f === nFrames - 1;
        const before = bits(standing);
        cur.rolls.push(n); rolls.push(n);
        const mark = n === 10 && before === 10 ? "X" : n === before && before > 0 ? "/" : n === 0 ? "-" : String(n);
        cur.marks.push(mark);
        standing &= ~m;
        ball++;
        if (!last) {
            if (standing === 0 || ball >= 2) { f++; ball = 0; standing = ALL; cur = null; }
        } else {
            const tot = cur.rolls.reduce((a, b) => a + b, 0);
            if (standing === 0 && ball < 3) standing = ALL;                     // a strike / a spare in the last frame: a fresh rack
            if (ball >= 3 || (ball === 2 && tot < 10)) { f++; ball = 0; cur = null; }
        }
    }
    // the score, frame by frame
    let total = 0, ok = true;
    for (let i = 0; i < frames.length; i++) {
        const fr = frames[i], r0 = fr.first, last = i === nFrames - 1;
        const done = last ? (fr.rolls.length === 3 || (fr.rolls.length === 2 && fr.rolls[0] + fr.rolls[1] < 10)) : (fr.rolls[0] === 10 || fr.rolls.length === 2);
        let s = null;
        if (done && ok) {
            if (last) s = fr.rolls.reduce((a, b) => a + b, 0);
            else if (fr.rolls[0] === 10) { if (rolls.length > r0 + 2) s = 10 + rolls[r0 + 1] + rolls[r0 + 2]; }
            else if (fr.rolls[0] + fr.rolls[1] === 10) { if (rolls.length > r0 + 2) s = 10 + rolls[r0 + 2]; }
            else s = fr.rolls[0] + fr.rolls[1];
        }
        if (s == null) ok = false; else { total += s; fr.score = total; }
        if (fr.score == null) fr.score = null;
    }
    const complete = Math.min(f, nFrames);
    return { frames, total, done: f >= nFrames, standing, frame: Math.min(f, nFrames - 1), ball, complete };
}

/** A small seeded random (the house bowlers' throws) — mulberry32. */
export function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A house bowler's throw: `skill` 0…1 (how close to the pocket). For the second ball he aims at what's left. */
export function botThrow(R, skill, standing) {
    let tx = 0.07;                                  // the 1-3 pocket
    if (standing !== ALL) { let sx = 0, n = 0; for (let i = 0; i < 10; i++) if (standing & (1 << i)) { sx += PINS[i].x; n++; } tx = n ? sx / n : 0; }
    const wob = (1 - skill) * 0.9 + 0.12;
    const s = standing === ALL ? 0.35 + (R() - 0.5) * wob : (R() - 0.5) * wob * 0.6;
    const v = 7.6 + (R() - 0.5) * 1.6;
    const x0 = 0.18 + (R() - 0.5) * 0.3 * wob;
    // solve the angle so the line ends at tx (+ an error)
    const D = { x0, a: 0, v, s };
    const end0 = lineAt(D, LANE.L).x;
    const a = Math.atan((tx - end0 + (R() - 0.5) * 0.22 * wob) / LANE.L);
    return encodeThrow(x0, Math.max(-0.034, Math.min(0.034, a)), v, s);
}
