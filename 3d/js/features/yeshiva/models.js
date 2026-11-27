// features/yeshiva/models.js — the campus's town pieces, built from primitives in code (the shops/models.js pattern): a few
// dozen boxes / cylinders each, one THREE.Group per piece with NAMED materials, registered straight into `models[key]`, so
// the town engine (build.js › layoutFace, a town's `uses`) merges them into its clusters like any Blender model — ~0 extra
// draw calls. Tints work by material name (Walls / Trim / Roof). Front = +Z (the street). Nothing here is a real building:
// a parody campus of the owner's invention.
//
//   yeshiva_hall   the main building: brick, a columned portico with a pediment, a clock tower, two rows of tall windows,
//                  big double doors (Anchor_door), the fascia for the sign (Anchor_sign). The door stands ~1.2 m inside the
//                  lot line (prot) so a walk-in reaches it from the sidewalk (foot › walkIn).
//   yeshiva_wing   the dorm: four floors of windows, a fire escape, AC units — and a laundry line (Anchor_sign: its board).
//   yeshiva_lot    the car park: asphalt, painted bays and 26 minivans nose-in (merged boxes: ~1k triangles), a sign post.
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
function cyl(g, m, r0, r1, h, x, y, z, seg = 10, rx = 0, ry = 0) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m);
    o.position.set(x, y, z); o.rotation.set(rx, ry, 0);
    g.add(o);
    return o;
}
function tri(g, m, a, b, c) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, m));
}
function anchor(g, name, x, y, z) { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); g.add(o); return o; }

// ── the main hall ────────────────────────────────────────────────────────
export const HALL_DIMS = { w: 28, d: 18, prot: 1.2 };
function buildHall() {
    const g = new THREE.Group(); g.name = "YeshivaHall";
    const W = HALL_DIMS.w, D = HALL_DIMS.d, H = 8.4;
    const walls = mat("Walls", "#A5593E"), trim = mat("Trim", "#EFE8D8"), roof = mat("Roof", "#5C6168"), glass = mat("Glass", "#8EC3E6", { roughness: 0.2 });
    const stone = mat("Stone", "#CFC8B8"), door = mat("Door", "#3B2417"), lawn = mat("Lawn", "#5FA55A"), copper = mat("Copper", "#4F9A86"), brass = mat("Brass", "#D4AF37");
    box(g, lawn, W + 3, 0.05, 2.5, 0, 0.025, D / 2 + 1.25);                       // the strip of lawn out front (to the lot line + a bit)
    box(g, stone, 3.2, 0.06, 2.5, 0, 0.04, D / 2 + 1.25);                          // the path
    box(g, walls, W, H, D - 1, 0, H / 2, -0.5);                                    // the box
    box(g, stone, W + 0.2, 0.9, D - 0.8, 0, 0.45, -0.5);                           // the plinth
    box(g, trim, W + 0.3, 0.35, D, 0, H * 0.58, -0.5 + 0.1);                       // a string course between the floors
    // two rows of tall windows either side of the portico
    for (const row of [2.5, 5.7]) for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const x = s * (7.6 + k * 2.75);
        box(g, trim, 1.6, 2.5, 0.1, x, row, D / 2 - 0.45);
        box(g, glass, 1.2, 2.1, 0.1, x, row, D / 2 - 0.4);
    }
    // the portico: four columns, an entablature (the sign goes on it), a pediment
    const zf = D / 2 + 2.0;
    box(g, stone, 9.4, 0.3, 3.0, 0, 0.15, D / 2 + 1.0); box(g, stone, 8.4, 0.3, 0.7, 0, 0.45, D / 2 + 2.2);        // the steps
    for (const x of [-3.6, -1.2, 1.2, 3.6]) cyl(g, trim, 0.36, 0.4, 6.0, x, 3.6, zf, 10);
    box(g, trim, 10.2, 1.0, 3.2, 0, 6.9, D / 2 + 1.3);                             // the entablature
    const pz = D / 2 + 2.9, py = 7.4;
    tri(g, trim, [-5.1, py, pz], [5.1, py, pz], [0, py + 1.9, pz]);
    tri(g, trim, [-5.1, py, pz - 3.1], [5.1, py, pz - 3.1], [0, py + 1.9, pz - 3.1]);
    for (const s of [-1, 1]) box(g, roof, 5.6, 0.12, 3.2, s * 2.55, py + 0.95, pz - 1.55, 0, 0, -s * Math.atan2(1.9, 5.1));
    box(g, door, 2.9, 3.6, 0.16, 0, 2.2, D / 2 - 0.4);                             // the big double doors
    box(g, trim, 3.5, 0.35, 0.3, 0, 4.15, D / 2 - 0.3);
    box(g, brass, 0.08, 0.5, 0.1, -0.2, 2.3, D / 2 - 0.28); box(g, brass, 0.08, 0.5, 0.1, 0.2, 2.3, D / 2 - 0.28);
    // the clock tower
    box(g, walls, 6.4, 4.6, 6.4, 0, H + 2.3, -1.2);
    box(g, trim, 6.7, 0.3, 6.7, 0, H + 4.7, -1.2);
    const cone = cyl(g, copper, 0.1, 5.0, 3.6, 0, H + 6.6, -1.2, 4); cone.rotation.y = Math.PI / 4;
    cyl(g, mat("ClockFace", "#FFFDF4"), 1.45, 1.45, 0.16, 0, H + 2.7, 2.06, 20, Math.PI / 2);
    box(g, mat("ClockHand", "#222222"), 0.1, 1.0, 0.06, 0, H + 3.0, 2.16); box(g, mat("ClockHand", "#222222"), 0.7, 0.1, 0.06, 0.3, H + 2.7, 2.16);
    // the roof: a parapet, air-conditioners
    box(g, roof, W - 0.2, 0.25, D - 1.2, 0, H + 0.12, -0.5);
    box(g, walls, W, 0.55, 0.3, 0, H + 0.4, D / 2 - 0.3);
    for (const x of [-10, -6, 9]) box(g, mat("AC", "#B0B7BD"), 2.0, 1.0, 1.4, x, H + 0.75, -3.5);
    anchor(g, "Anchor_sign", 0, 6.9, D / 2 + 2.92);
    anchor(g, "Anchor_door", 0, 0, D / 2);
    return g;
}

// ── the dorm wing ────────────────────────────────────────────────────────
export const WING_DIMS = { w: 12, d: 14, prot: 1.5 };
function buildWing() {
    const g = new THREE.Group(); g.name = "YeshivaWing";
    const W = WING_DIMS.w, D = WING_DIMS.d, H = 11.2;
    const walls = mat("Walls", "#A5593E"), trim = mat("Trim", "#EFE8D8"), roof = mat("Roof", "#5C6168"), glass = mat("Glass", "#8EC3E6", { roughness: 0.2 });
    const lit = mat("Lit", "#FFE9A8"), rail = mat("Rail", "#2F3A40"), lawn = mat("Lawn", "#5FA55A");
    box(g, lawn, W + 1, 0.05, 2.0, 0, 0.025, D / 2 + 1.0);
    box(g, walls, W, H, D, 0, H / 2, 0);
    box(g, trim, W + 0.3, 0.5, D + 0.3, 0, 0.25, 0);
    for (let f = 0; f < 4; f++) for (let k = 0; k < 3; k++) {
        const x = -3.6 + k * 3.6, y = 2.2 + f * 2.45;
        box(g, trim, 1.7, 1.7, 0.1, x, y, D / 2 + 0.02);
        box(g, (f * 3 + k) % 5 === 1 ? lit : glass, 1.3, 1.3, 0.1, x, y, D / 2 + 0.08);
    }
    box(g, mat("Door", "#37474F"), 1.7, 2.2, 0.12, 4.3, 1.1, D / 2 + 0.06);
    box(g, roof, W + 0.2, 0.25, D + 0.2, 0, H + 0.12, 0);
    box(g, walls, W + 0.2, 0.5, 0.25, 0, H + 0.45, D / 2);
    for (const x of [-3, 2]) box(g, mat("AC", "#B0B7BD"), 1.8, 0.9, 1.2, x, H + 0.7, -1);
    // a fire escape zig-zagging down the front, and a laundry line out a window
    for (let f = 0; f < 3; f++) {
        const y = 4.4 + f * 2.45;
        box(g, rail, 2.2, 0.08, 1.0, -5.0, y, D / 2 + 0.55); box(g, rail, 2.2, 0.8, 0.05, -5.0, y + 0.45, D / 2 + 1.05);
        box(g, rail, 0.06, 2.45, 0.06, -6.0 + (f % 2) * 2.0, y - 1.2, D / 2 + 0.9, 0, 0, 0.5);
    }
    const shirts = ["#E57373", "#FFFFFF", "#64B5F6", "#FFFFFF", "#FFD54F"];
    box(g, rail, 4.6, 0.03, 0.03, 0.4, 7.4, D / 2 + 1.2);
    shirts.forEach((c, i) => box(g, mat("Shirt" + i, c), 0.5, 0.65, 0.04, -1.6 + i * 0.95, 7.0, D / 2 + 1.2));
    anchor(g, "Anchor_sign", 0, 9.9, D / 2 + 0.2);
    anchor(g, "Anchor_door", 4.3, 0, D / 2);
    return g;
}

// ── the car park: 26 minivans, nose-in, around a drive lane ────────────────
export const LOT_DIMS = { w: 12, d: 34, prot: 0.4 };
function buildLot() {
    const g = new THREE.Group(); g.name = "YeshivaLot";
    const W = LOT_DIMS.w, D = LOT_DIMS.d;
    const asph = mat("Asphalt", "#4A4D52", { roughness: 1 }), line = mat("Line", "#F5F5F0"), pole = mat("Pole", "#9EA4AA", { metalness: 0.4 });
    box(g, asph, W, 0.06, D, 0, 0.03, 0);
    const paints = ["#E8E8EC", "#B8BCC4", "#2E3138", "#8D949C", "#F3F1EA", "#46506B", "#6E2B2B"];
    const gl = mat("VanGlass", "#2A3A4A", { roughness: 0.3 }), tire = mat("Tire", "#1B1B1B");
    let n = 0;
    for (const s of [-1, 1]) for (let r = 0; r < 13; r++) {
        const z = -D / 2 + 1.6 + r * 2.5;
        box(g, line, 4.9, 0.02, 0.07, s * 3.55, 0.07, z - 1.25);                    // the bay lines
        if ((r * 5 + (s > 0 ? 3 : 0)) % 9 === 4) continue;                          // (a gap here and there)
        const c = mat("Van" + (n % paints.length), paints[(n * 3 + (s > 0 ? 1 : 0)) % paints.length]);
        n++;
        const x = s * 3.65;
        box(g, c, 4.5, 1.15, 1.85, x, 0.8, z);                                       // the body
        box(g, c, 3.2, 0.7, 1.75, x - s * 0.2, 1.7, z);                              // the cabin
        box(g, gl, 3.3, 0.45, 1.8, x - s * 0.2, 1.72, z);                            // the windows
        box(g, tire, 3.2, 0.5, 1.9, x, 0.3, z);                                      // (wheels, as one dark strip)
    }
    box(g, pole, 0.12, 2.6, 0.12, W / 2 - 0.4, 1.3, D / 2 - 0.6);
    anchor(g, "Anchor_sign", W / 2 - 0.4, 2.2, D / 2 - 0.52);
    return g;
}

models.yeshiva_hall = buildHall();
models.yeshiva_wing = buildWing();
models.yeshiva_lot = buildLot();
