// features/cityhall/models.js — the city hall building, built from primitives in code (like features/shops' showroom):
// one THREE.Group with NAMED materials registered straight into `models[key]`, so the town engine (build.js ›
// layoutFace, a town's `uses`) merges it into its vertex-coloured clusters — ~0 extra draw calls, ~1.5k triangles.
// Tints work by material name (Walls / Trim / Roof / Accent).
//
//   cityhall_hall   a two-storey civic box with a columned portico + pediment, wide steps, a clock tower with a little
//                   dome (the clock always says ten to five), two flagpoles, two benches, planters and — on the plaza —
//                   the mayor's statue of himself. Anchor_sign (the frieze), Anchor_door. Front = +Z (the street).
import * as THREE from "three";
import { models } from "../../models.js";

const MATS = new Map();
function mat(name, color, o = {}) {
    const k = name + color;
    if (MATS.has(k)) return MATS.get(k);
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75 }, o));
    m.name = name;
    MATS.set(k, m);
    return m;
}
function box(g, m, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    g.add(o);
    return o;
}
function cyl(g, m, r0, r1, h, x, y, z, seg = 10, rx = 0, rz = 0) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m);
    o.position.set(x, y, z); o.rotation.set(rx, 0, rz);
    g.add(o);
    return o;
}
function prism(g, m, w, h, d, x, y, z) {
    // a triangular pediment: base w at y, apex h above, depth d (along z)
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
    geo.translate(0, 0, -d / 2);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    g.add(o);
    return o;
}
function anchor(g, name, x, y, z) { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); g.add(o); return o; }

// local: x along the street, z toward the street; the footprint w 28 × d 14 round the origin, the steps + plaza out to +9.6
export const HALL_DIMS = { w: 28, d: 14, prot: 2.6 };
export const HALL_KEY = "cityhall_hall";
function buildHall() {
    const g = new THREE.Group();
    g.name = "CityHall";
    const walls = mat("Walls", "#E9DFC9"), trim = mat("Trim", "#FBF8F0"), roof = mat("Roof", "#5D6B78"), accent = mat("Accent", "#1F2D63");
    const win = mat("HallWindow", "#9FC3D6", { roughness: 0.25 }), door = mat("Door", "#4E342E"), stone = mat("Stone", "#BDB6A8", { roughness: 0.95 });
    const pole = mat("Pole", "#B0B6BC", { metalness: 0.4 }), green = mat("Hedge", "#4C7A3A", { roughness: 1 }), bronze = mat("Bronze", "#7A6A3A", { metalness: 0.3 });
    const W = 20, D = 10.5, H = 7.6, zb = -1.75;           // the main block: z −7 … +3.5
    const zf = zb + D / 2;                                   // its front wall (+3.5)
    // the plaza pad out to the lot line + a little past (the sidewalk meets it)
    box(g, stone, 28, 0.06, 6.2, 0, 0.03, 6.5);
    // the main block, a cornice, the roof
    box(g, walls, W, H, D, 0, H / 2, zb);
    box(g, trim, W + 0.5, 0.45, D + 0.5, 0, H + 0.22, zb);
    box(g, roof, W - 0.4, 0.5, D - 0.4, 0, H + 0.7, zb);
    box(g, trim, W + 0.1, 0.35, D + 0.1, 0, 0.18, zb);      // a plinth band
    box(g, trim, W + 0.1, 0.2, 0.15, 0, H / 2, zf + 0.03);  // a storey band across the front
    // windows: two rows of five either side of the portico (the front), three on each side wall
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
        const x = sx * (6.6 + i * 2.2);
        for (const y of [2.0, 5.5]) { box(g, win, 1.2, 1.8, 0.08, x, y, zf + 0.04); box(g, trim, 1.5, 0.18, 0.18, x, y + 1.0, zf + 0.06); }
    }
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) box(g, win, 0.08, 1.8, 1.2, sx * (W / 2 + 0.04), 3.6, zb - 3 + i * 3);
    // the portico: steps, four columns, an entablature (the sign's frieze) and the pediment
    const PW = 11, pz0 = zf, pz1 = zf + 3.0;
    for (let i = 0; i < 3; i++) box(g, stone, PW + 2 - i * 0.6, 0.2, 2.0 - i * 0.45, 0, 0.1 + i * 0.2, pz1 + 0.9 - i * 0.22);
    box(g, trim, PW + 0.6, 0.6, 3.4, 0, 0.3, (pz0 + pz1) / 2 + 0.1);
    for (let i = 0; i < 4; i++) {
        const x = -PW / 2 + 0.9 + i * (PW - 1.8) / 3;
        cyl(g, trim, 0.36, 0.42, 5.6, x, 3.4, pz1 - 0.4, 10);
        box(g, trim, 1.0, 0.25, 1.0, x, 0.72, pz1 - 0.4); box(g, trim, 1.0, 0.25, 1.0, x, 6.28, pz1 - 0.4);
    }
    box(g, trim, PW + 0.6, 1.2, 3.4, 0, 7.0, (pz0 + pz1) / 2 + 0.1);          // the entablature — the town's sign goes on it
    box(g, accent, PW + 0.62, 0.14, 3.42, 0, 6.45, (pz0 + pz1) / 2 + 0.1);
    prism(g, trim, PW + 0.8, 2.0, 3.5, 0, 7.6, (pz0 + pz1) / 2 + 0.1);
    prism(g, accent, PW - 1.4, 1.35, 0.1, 0, 7.85, pz1 + 1.86);               // the pediment's tympanum, in the accent colour
    // the big front door (double) under the portico, a fanlight over it
    box(g, door, 2.6, 3.4, 0.12, 0, 1.7 + 0.6, zf + 0.07);
    box(g, mat("Brass", "#C9A646", { metalness: 0.5 }), 0.08, 0.5, 0.06, 0, 2.3, zf + 0.15);
    cyl(g, win, 1.3, 1.3, 0.08, 0, 4.2, zf + 0.06, 12, Math.PI / 2);
    // the clock tower: a square drum on the roof, the clock (always ten to five), a lantern + a little dome
    const tz = zb + 0.5;
    box(g, walls, 4.2, 3.6, 4.2, 0, H + 2.7, tz);
    box(g, trim, 4.6, 0.3, 4.6, 0, H + 4.6, tz);
    const face = mat("ClockFace", "#FFFDF5", { roughness: 0.5 }), hand = mat("ClockHand", "#1B1B1B");
    cyl(g, face, 1.25, 1.25, 0.1, 0, H + 2.6, tz + 2.12, 16, Math.PI / 2);
    cyl(g, trim, 1.42, 1.42, 0.06, 0, H + 2.6, tz + 2.09, 16, Math.PI / 2);
    // (hands: the hour hand near 5, the minute hand on 10 — 4:50, forever)
    box(g, hand, 0.12, 0.7, 0.04, 0.17, H + 2.3, tz + 2.2, 0, 0, Math.PI * (1 - 4.83 / 6));
    box(g, hand, 0.08, 1.0, 0.04, -0.42, H + 2.85, tz + 2.21, 0, 0, Math.PI / 3);
    for (const sx of [-1, 1]) cyl(g, face, 1.0, 1.0, 0.1, sx * 2.12, H + 2.6, tz, 16, 0, Math.PI / 2);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; box(g, trim, 0.3, 1.6, 0.3, Math.sin(a) * 1.35, H + 5.6, tz + Math.cos(a) * 1.35); }
    box(g, trim, 3.4, 0.25, 3.4, 0, H + 6.5, tz);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), roof);
    dome.position.set(0, H + 6.6, tz); g.add(dome);
    cyl(g, mat("Gold", "#D4AF37", { metalness: 0.6, roughness: 0.3 }), 0.06, 0.12, 1.2, 0, H + 8.7, tz, 6);
    // two flagpoles on the plaza, each with a flag (a plain town flag: a pennant in the accent colour + a gold one)
    for (const [sx, fc] of [[-1, "#C62828"], [1, "#1565C0"]]) {
        const x = sx * 8.2, z = 7.0;
        cyl(g, pole, 0.07, 0.1, 9, x, 4.5, z, 6);
        cyl(g, mat("Gold", "#D4AF37", { metalness: 0.6, roughness: 0.3 }), 0.14, 0.14, 0.2, x, 9.05, z, 6);
        box(g, mat("Flag" + fc, fc, { side: THREE.DoubleSide }), 0.04, 1.1, 1.7, x, 8.2, z + 0.9);
    }
    // the plaza: two benches, two planters with hedges, and THE STATUE (the mayor, on a plinth, pointing at nothing)
    for (const sx of [-1, 1]) {
        const x = sx * 5.6;
        box(g, mat("Bench", "#6D4C41"), 2.0, 0.12, 0.5, x, 0.5, 8.2); box(g, mat("Bench", "#6D4C41"), 2.0, 0.5, 0.1, x, 0.8, 7.95);
        box(g, pole, 0.08, 0.45, 0.45, x - 0.85, 0.24, 8.2); box(g, pole, 0.08, 0.45, 0.45, x + 0.85, 0.24, 8.2);
        box(g, stone, 2.2, 0.6, 1.0, sx * 11.6, 0.3, 5.2); box(g, green, 2.0, 0.6, 0.8, sx * 11.6, 0.9, 5.2);
    }
    const sx0 = 12.2, sz0 = 8.4;
    box(g, stone, 1.4, 1.5, 1.4, sx0, 0.75, sz0);
    cyl(g, bronze, 0.32, 0.38, 1.3, sx0, 2.15, sz0, 8);                         // the coat
    cyl(g, bronze, 0.16, 0.16, 0.6, sx0, 2.15, sz0, 6);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), bronze); head.position.set(sx0, 3.05, sz0); g.add(head);
    cyl(g, bronze, 0.3, 0.3, 0.05, sx0, 3.25, sz0, 8); cyl(g, bronze, 0.17, 0.19, 0.28, sx0, 3.4, sz0, 8);   // the hat
    box(g, bronze, 0.1, 0.1, 0.8, sx0 - 0.2, 2.55, sz0 + 0.4, -0.5);           // the pointing arm
    box(g, mat("Plaque", "#C9A646", { metalness: 0.5 }), 0.7, 0.35, 0.04, sx0, 0.95, sz0 + 0.72);
    anchor(g, "Anchor_sign", 0, 7.0, pz1 + 0.13);
    anchor(g, "Anchor_door", 0, 0, zf);
    return g;
}

let made = false;
/** Register the code-built model (idempotent; cheap — about a hundred primitives). */
export function makeModels() {
    if (made) return;
    made = true;
    models[HALL_KEY] = buildHall();
}
makeModels();
