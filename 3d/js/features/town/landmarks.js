// features/town — LANDMARKS that aren't a block face (all data-driven; each is a no-op for a town
// that doesn't ask for it):
//   • boulevards — a street with `boulevard: { mall, service }` (Ocean Parkway): tree malls with a
//     bike path / paver walk and benches, and the service roads beside them (asphalt from build.js's
//     lists; parked cars come from the street-furniture pass)
//   • strips — def.strips: a row of buildings along one side of a street, outside the blocks (the
//     town's edges); use "college" lays out a whole quad (Brooklyn Kollege of Knowledge)
//   • skyline — def.skyline: rows of cheap apartment-house boxes past every edge (a city town has no
//     woods), their window bands glowing at night, water towers on some roofs
//   • barricades — def.barricades: NYPD sawhorses across a street's dead end, with a sign
// They get the build's toolkit B (place / sign / col / merge / the ground lists …) from build.js.
import * as THREE from "three";
import { PL, streetPoint, cutAt, otherAt } from "./plan.js";

export const LANDMARK_MODELS = ["town_mw_bench", "town_mw_library", "town_mw_hall", "town_mw_barricade"];
const GREENS = ["#4E8F3A", "#5E9E44", "#3F7F35", "#6AA84F", "#57943F"];

// ── boulevards ───────────────────────────────────────────────────────────
export function buildBoulevards(B) {
    const { R, T, strip, asphalt, marks, merge, place, col, atlas, addColored } = B;
    let bikeUV = null;
    for (const st of PL.STREETS) {
        if (!st.boulevard) continue;
        for (const side of [-1, 1]) strip(asphalt, st, st.a0, st.a1, side * st.svcIn, side * st.svcOut, 0.031);
        const cr = st.cross;
        for (let k = 0; k <= cr.length; k++) {
            const c0 = k > 0 ? cr[k - 1] : null, c1 = k < cr.length ? cr[k] : null;
            for (const side of [-1, 1]) {
                const dIn = side * st.mallIn, dOut = side * st.mallOut, mid = (st.mallIn + st.mallOut) / 2, pw = 1.25;
                const end = (c, toward, d) => c ? cutAt(st, c.node, toward, d, otherAt(c.node, st.id).walk + 1.2) : null;
                const u0 = c0 ? end(c0, -1, side * mid) : st.a0 + 2, u1 = c1 ? end(c1, 1, side * mid) : st.a1 - 2;
                if (u1 - u0 < 6) continue;
                // grass | path | grass (side by side, so nothing z-fights)
                const bike = side > 0;           // the west mall (d > 0 on a northbound street) carries the 1894 bike path
                strip(marks, st, u0, u1, dIn, side * (mid - pw), 0.05, "#6E9E4A");
                strip(marks, st, u0, u1, side * (mid - pw), side * (mid + pw), 0.05, bike ? "#5B6068" : "#B9B1A3");
                strip(marks, st, u0, u1, side * (mid + pw), dOut, 0.05, "#6E9E4A");
                for (const dd of [dIn, dOut]) {
                    const cp = streetPoint(st, (u0 + u1) / 2, dd, {});
                    const g = new THREE.BoxGeometry(0.2, 0.16, u1 - u0); g.rotateY(st.h); g.translate(cp.x, 0.08, cp.z);
                    addColored(merge, g, "#B8B4AC", cp.x, cp.z, "flat");
                }
                // two rows of big canopy trees (the tunnel of green), benches facing the path
                for (const [dd, ph] of [[st.mallIn + 1.0, 0], [st.mallOut - 1.0, 5.5]]) {
                    for (let u = u0 + 4 + ph; u < u1 - 3; u += 11) {
                        const p = streetPoint(st, u, side * dd, {});
                        place("treeRound", p.x, p.z, R() * 6.28, { Leaves: GREENS[Math.floor(R() * GREENS.length)] }, { scale: 1.15 + R() * 0.3 });
                        col(p.x, p.z, 0.45, "tree");
                    }
                }
                for (let u = u0 + 9; u < u1 - 6; u += 26) {
                    const bs = (Math.floor(u / 26) % 2) ? 1 : -1;               // which side of the path
                    const dd = side * (mid + bs * (pw + 0.75)), p = streetPoint(st, u, dd, {});
                    const face = Math.atan2(-Math.sign(dd - side * mid) * st.rx, -Math.sign(dd - side * mid) * st.rz);   // toward the path
                    place("town_mw_bench", p.x, p.z, face);
                    col(p.x, p.z, 0.7, "bench");
                    if (!T.spots.bench && side < 0 && u > -170 && u < -40) T.spots.bench = { x: p.x, z: p.z, rot: face, bench: true };
                    (T.benches || (T.benches = [])).push({ x: p.x, z: p.z, rot: face });
                }
                if (bike) {
                    bikeUV = bikeUV || atlas.sign({ key: "BIKE", w: 256, h: 256, draw: bikeGlyph });
                    for (let u = u0 + 14; u < u1 - 8; u += 40) {
                        const p = streetPoint(st, u, side * mid, {});
                        atlas.quad(bikeUV, p.x, 0.056, p.z, st.h + Math.PI, 1.6, 1.6, -Math.PI / 2);
                    }
                }
            }
        }
    }
}
function bikeGlyph(g, w, h) {
    g.strokeStyle = "#FFFFFF"; g.lineWidth = 10; g.lineCap = "round";
    for (const cx of [w * 0.28, w * 0.72]) { g.beginPath(); g.arc(cx, h * 0.62, w * 0.17, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(w * 0.28, h * 0.62); g.lineTo(w * 0.45, h * 0.36); g.lineTo(w * 0.66, h * 0.36); g.lineTo(w * 0.72, h * 0.62);
    g.moveTo(w * 0.45, h * 0.36); g.lineTo(w * 0.52, h * 0.62); g.lineTo(w * 0.66, h * 0.36); g.moveTo(w * 0.4, h * 0.28); g.lineTo(w * 0.5, h * 0.28);
    g.moveTo(w * 0.66, h * 0.36); g.lineTo(w * 0.64, h * 0.24); g.lineTo(w * 0.74, h * 0.24); g.stroke();
}

// ── frontage strips ──────────────────────────────────────────────────────
export function buildStrip(B, sp, counters) {
    const st = sp.st, o = streetPoint(st, sp.from, sp.side * st.front, {});
    const nx = -sp.side * st.rx, nz = -sp.side * st.rz;          // out toward the street
    const fr = { ox: o.x, oz: o.z, ux: st.ux, uz: st.uz, nx, nz, len: sp.to - sp.from, rot: Math.atan2(nx, nz) };
    if (sp.use === "college") { college(B, fr, sp.depth || 70); return; }
    B.placeFace(B, sp.use, fr, counters);
    for (let u = 0; u <= fr.len; u += 2.1) {
        const p = streetPoint(st, sp.from + u, sp.side * (st.front + 1.4), {});
        B.col(p.x, p.z, 1.25, "house");
    }
}

// ── the college quad ─────────────────────────────────────────────────────
function college(B, fr, depth) {
    const { T, S, R, merge, place, sign, col, marks, anchorAt, addColored } = B;
    const at = (u, back) => ({ x: fr.ox + fr.ux * u - fr.nx * back, z: fr.oz + fr.uz * u - fr.nz * back });
    const quadOf = (u0, u1, b0, b1, color, y = 0.035) => {
        const p = [at(u0, b0), at(u1, b0), at(u1, b1), at(u0, b1)];
        marks.push({ pts: p.map(q => [q.x, q.z]), y, color });
    };
    const L = fr.len, mid = L / 2;
    // the lawn, a walk from the gate to the library, and the diagonal paths across the quad
    quadOf(0, L, 0, depth, "#6DAE4A", 0.034);
    quadOf(mid - 1.8, mid + 1.8, 0, depth - 16, "#D8CFBD", 0.036);
    for (const [ua, ub] of [[6, L - 6], [L - 6, 6]]) {
        const a = at(ua, 8), b = at(ub, depth - 18), len = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len, w = 1.4;
        marks.push({ pts: [[a.x - uz * w, a.z + ux * w], [b.x - uz * w, b.z + ux * w], [b.x + uz * w, b.z - ux * w], [a.x + uz * w, a.z - ux * w]], y: 0.0365, color: "#D8CFBD" });
    }
    // the library with its white clock tower, at the head of the quad; a Georgian wing down each side
    const lib = at(mid, depth - 9);
    place("town_mw_library", lib.x, lib.z, fr.rot);
    rectCol(col, lib.x, lib.z, fr, 26, 15);
    const clock = anchorAt("town_mw_library", lib.x, lib.z, fr.rot, "Anchor_clock");
    if (clock) {
        const cell = B.atlas.sign({ key: "CLOCK", w: 256, h: 256, draw: clockFace });
        B.atlas.quad(cell, clock.x + fr.nx * 0.03, clock.y, clock.z + fr.nz * 0.03, fr.rot, 2.4, 2.4);
    }
    for (const [u, rot] of [[11, fr.rot - Math.PI / 2], [L - 11, fr.rot + Math.PI / 2]]) {
        const p = at(u, depth * 0.45);
        place("town_mw_hall", p.x, p.z, rot);
        const f2 = { nx: Math.sin(rot), nz: Math.cos(rot) };
        rectCol(col, p.x, p.z, f2, 30, 12);
    }
    // the gate on the avenue: brick piers, an iron arch, the sign; a low brick wall + railings round the rest
    const gate = at(mid, 0.6);
    for (const s of [-1, 1]) {
        const p = at(mid + s * 4.4, 0.6);
        const g = new THREE.BoxGeometry(1.2, 3.4, 1.2); g.translate(p.x, 1.7, p.z); addColored(merge, g, "#8E3F33", p.x, p.z);
        const c = new THREE.BoxGeometry(1.45, 0.3, 1.45); c.translate(p.x, 3.55, p.z); addColored(merge, c, "#E8E2D4", p.x, p.z);
        col(p.x, p.z, 0.9, "wall");
    }
    const arch = new THREE.BoxGeometry(9.6, 0.25, 0.2); arch.rotateY(fr.rot); arch.translate(gate.x, 4.5, gate.z); addColored(merge, arch, "#1E1E1E", gate.x, gate.z);
    sign({ lines: S.college, bg: "#5D1A1A", fg: ["#F3D98B", "#F5EBD0"], w: 1024, h: 180, radius: 6 }, gate.x + fr.nx * 0.12, 5.2, gate.z + fr.nz * 0.12, fr.rot, 8.6, 1.5, true);
    const wall = (ua, ub, back0, back1) => {
        const a = at(ua, back0), b = at(ub, back1), len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 0.5) return;
        const g = new THREE.BoxGeometry(0.5, 0.9, len); g.rotateY(Math.atan2(b.x - a.x, b.z - a.z)); g.translate((a.x + b.x) / 2, 0.45, (a.z + b.z) / 2);
        addColored(merge, g, "#8E3F33", (a.x + b.x) / 2, (a.z + b.z) / 2);
        for (let t = 0; t <= len; t += 1.8) col(a.x + (b.x - a.x) * t / len, a.z + (b.z - a.z) * t / len, 0.5, "wall");
    };
    wall(0, mid - 5, 0.6, 0.6); wall(mid + 5, L, 0.6, 0.6);
    wall(0, 0, 0.6, depth); wall(L, L, 0.6, depth); wall(0, L, depth, depth);
    // trees round the lawn
    for (let k = 0; k < 10; k++) {
        const u = k < 5 ? 5 + k * (mid - 9) / 4 : mid + 4 + (k - 5) * (mid - 9) / 4, p = at(u, 5 + (k % 2) * 3);
        if (Math.abs(u - mid) < 6) continue;
        place("treeRound", p.x, p.z, R() * 6.28, { Leaves: GREENS[k % GREENS.length] }, { scale: 1.2 + R() * 0.3 });
        col(p.x, p.z, 0.45, "tree");
    }
    T.spots.college = { x: at(mid, 6).x, z: at(mid, 6).z, rot: fr.rot, ux: fr.ux, uz: fr.uz, nx: fr.nx, nz: fr.nz };
}
function rectCol(col, x, z, fr, w, d) {
    // a building's footprint (w along its face, d deep), centred at (x, z), facing (fr.nx, fr.nz)
    const ux = -fr.nz, uz = fr.nx;
    for (let a = -w / 2; a <= w / 2; a += 2.2) for (const b of [-d / 2, d / 2]) col(x + ux * a + fr.nx * b, z + uz * a + fr.nz * b, 1.2, "house");
    for (let b = -d / 2; b <= d / 2; b += 2.2) for (const a of [-w / 2, w / 2]) col(x + ux * a + fr.nx * b, z + uz * a + fr.nz * b, 1.2, "house");
}
function clockFace(g, w, h) {
    // Midwood Time: it's always 4:07 (seven minutes fast, since forever)
    g.fillStyle = "#FBF8EF"; g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#1B1B1B"; g.lineWidth = 8; g.stroke();
    g.fillStyle = "#1B1B1B";
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.fillRect(w / 2 + Math.sin(a) * w * 0.38 - 4, h / 2 - Math.cos(a) * h * 0.38 - 4, 8, 8); }
    const hand = (a, len, wd) => { g.lineWidth = wd; g.lineCap = "round"; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.sin(a) * len, h / 2 - Math.cos(a) * len); g.stroke(); };
    hand((4 + 7 / 60) / 12 * Math.PI * 2, w * 0.22, 12);
    hand(7 / 60 * Math.PI * 2, w * 0.34, 7);
}

// ── the skyline ──────────────────────────────────────────────────────────
export function buildSkyline(B) {
    const { def, R, merge, addColored, col, BRICK, STUCCO } = B;
    if (!def.skyline) return;
    const WALLS = [...BRICK, ...STUCCO, "#9E9E9E", "#A1887F", "#BCAAA4"];
    for (const [x0, z0, x1, z1] of def.skyline) {
        const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, rot = Math.atan2(ux, uz);
        // the side away from the town's middle (the buildings stand back from the line)
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        let nx = uz, nz = -ux;
        const mid = PL.STREETS.length ? PL.STREETS.reduce((a, s) => ({ x: a.x + s.px + s.ux * (s.a0 + s.a1) / 2, z: a.z + s.pz + s.uz * (s.a0 + s.a1) / 2 }), { x: 0, z: 0 }) : { x: 0, z: 0 };
        mid.x /= PL.STREETS.length || 1; mid.z /= PL.STREETS.length || 1;
        if ((cx - mid.x) * nx + (cz - mid.z) * nz < 0) { nx = -nx; nz = -nz; }
        let u = 0;
        while (u < len) {
            const w = 16 + R() * 12, d = 14 + R() * 8, h = 13 + Math.floor(R() * 5) * 3.2 + (R() < 0.15 ? 12 : 0);
            const off = 6 + d / 2 + R() * 6;
            const x = x0 + ux * (u + w / 2) + nx * off, z = z0 + uz * (u + w / 2) + nz * off;
            const body = new THREE.BoxGeometry(d, h, w); body.rotateY(rot); body.translate(x, h / 2, z);
            addColored(merge, body, WALLS[Math.floor(R() * WALLS.length)], x, z, "flat");
            const cap = new THREE.BoxGeometry(d + 0.6, 0.6, w + 0.6); cap.rotateY(rot); cap.translate(x, h + 0.3, z);
            addColored(merge, cap, "#D7CFC2", x, z, "flat");
            // floors of windows (some lit at night, some not)
            for (let y = 3.4; y < h - 1.6; y += 3.2) {
                const band = new THREE.BoxGeometry(d + 0.12, 1.15, w - 2.4); band.rotateY(rot); band.translate(x, y, z);
                addColored(merge, band, "#33414F", x, z, R() < 0.7 ? "glow" : "flat");
            }
            if (R() < 0.35) {       // a water tower on the roof (very New York)
                const tx = x + (R() - 0.5) * d * 0.4, tz = z + (R() - 0.5) * w * 0.4;
                const tank = new THREE.CylinderGeometry(1.7, 1.7, 3.2, 10); tank.translate(tx, h + 3.3, tz);
                addColored(merge, tank, "#6D4C41", tx, tz, "flat");
                const cone = new THREE.ConeGeometry(1.9, 1.3, 10); cone.translate(tx, h + 5.55, tz);
                addColored(merge, cone, "#4E342E", tx, tz, "flat");
                for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                    const leg = new THREE.BoxGeometry(0.16, 1.7, 0.16); leg.translate(tx + a * 1.2, h + 0.85, tz + b * 1.2);
                    addColored(merge, leg, "#3E2723", tx, tz, "flat");
                }
            }
            u += w + 1.5 + R() * 3;
        }
        for (let t = 0; t <= len; t += 2.4) col(x0 + ux * t + nx * 3, z0 + uz * t + nz * 3, 1.5, "wall");
    }
}

// ── barricades ───────────────────────────────────────────────────────────
export function buildBarricades(B) {
    const { def, place, col, sign } = B;
    for (const b of def.barricades || []) {
        const st = PL.byName[b.street];
        if (!st) continue;
        const w = st.outer;
        for (let d = -w + 1.2; d <= w - 1.2; d += 2.7) {
            const p = streetPoint(st, b.along, d, {});
            place("town_mw_barricade", p.x, p.z, st.h + Math.PI);
            col(p.x - st.rx * 0.9, p.z - st.rz * 0.9, 0.9, "barrier"); col(p.x + st.rx * 0.9, p.z + st.rz * 0.9, 0.9, "barrier");
        }
        if (b.lines) {
            const p = streetPoint(st, b.along - 0.4, 0, {});
            sign({ lines: b.lines, bg: "#FFFFFF", fg: ["#0D47A1", "#C62828", "#37474F"], w: 768, h: 300, border: "#0D47A1" }, p.x, 1.9, p.z, st.h + Math.PI, 3.6, 1.4, true);
        }
    }
}

/** A whole block given over to one landmark (none yet: the college is a strip). */
export function wholeBlock() { return false; }
