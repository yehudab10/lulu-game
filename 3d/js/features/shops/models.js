// features/shops/models.js — the shop places' town pieces, built from primitives in code (like features/decor's props):
// a handful of boxes / cylinders per piece, one THREE.Group each with NAMED materials, registered straight into
// `models[key]`, so the town engine (build.js › layoutFace, a town's `uses`) merges them into its vertex-coloured
// clusters like any Blender model — ~0 extra draw calls, a few hundred triangles each. Tints work by material name
// (Walls / Trim / Roof / Awning / Body / BodyLight / BodyDark…).
//
//   shops_dealer    Uncle Refael's showroom: a glass-fronted box, a flat roof with a parapet, bunting strung out over the
//                   lot, a resting wacky waving tube guy. Anchor_sign (the fascia), Anchor_door. Front = +Z (the street).
//   shops_lotcar    one car on the lot: a LOW-POLY stand-in for Lulu's convertible (~330 triangles — the real one is
//                   ~9k), its asphalt pad, a price board on a post (Anchor_sign). The car the card is about is swapped
//                   for the real model while she looks at it (dealer.js).
import * as THREE from "three";
import { models } from "../../models.js";

const MATS = new Map();
function mat(name, color, o = {}) {
    const k = name + color;
    if (MATS.has(k)) return MATS.get(k);
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o));
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
function tri(g, m, a, b, c) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...b], 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, m));
}
function anchor(g, name, x, y, z) { const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z); g.add(o); return o; }

// ── the showroom ─────────────────────────────────────────────────────────
// local: x along the street (−x = toward the lot), z toward the street; footprint w 15 × d 10 around the origin
export const DEALER_DIMS = { w: 15, d: 10, prot: 1.2 };
function buildDealer() {
    const g = new THREE.Group();
    g.name = "ShopsDealer";
    const walls = mat("Walls", "#F3EFE6"), trim = mat("Trim", "#C62828"), roof = mat("Roof", "#5B5F66"), win = mat("ShopWindow", "#9FD3E6", { roughness: 0.2 });
    const pole = mat("Pole", "#9EA4AA", { metalness: 0.4 }), ground = mat("Asphalt", "#55585E", { roughness: 1 });
    const W = 15, D = 10, H = 5.2;
    box(g, ground, W + 0.4, 0.06, D + 1.2, 0, 0.03, 0.6);                 // forecourt pad (out to the lot line, z +6.2)
    box(g, walls, W, H, D - 0.4, 0, H / 2, -0.2);                         // the box
    box(g, win, W - 2.2, 3.0, 0.08, 0, 1.75, D / 2 - 0.36);               // the big showroom window
    box(g, trim, W + 0.3, 1.25, 0.3, 0, H - 0.45, D / 2 - 0.2);           // the fascia band (the town's sign goes on it)
    box(g, trim, 0.35, H, 0.35, -W / 2 + 0.17, H / 2, D / 2 - 0.2);       // corner posts
    box(g, trim, 0.35, H, 0.35, W / 2 - 0.17, H / 2, D / 2 - 0.2);
    box(g, roof, W + 0.2, 0.25, D - 0.2, 0, H + 0.12, -0.2);              // flat roof
    box(g, walls, W + 0.3, 0.5, 0.2, 0, H + 0.45, D / 2 - 0.2);           // parapet
    box(g, mat("Door", "#37474F"), 1.9, 2.4, 0.12, 4.2, 1.2, D / 2 - 0.3);
    // a little canopy over the door + a sale banner on the side wall
    box(g, trim, 2.8, 0.14, 1.4, 4.2, 2.75, D / 2 + 0.3);
    box(g, mat("Banner", "#FFD54F"), 0.06, 1.1, 5.5, W / 2 + 0.04, 3.1, 0.6);
    // bunting: a line from the showroom's lot-side corner (+x: the town lays the cars out that way) out over the lot to
    // a pole 30 m away, pennants every 1.2 m
    const L = 30, x0 = W / 2, x1 = x0 + L, zf = D / 2 + 0.8, y0 = H + 0.2, y1 = 4.3;
    cyl(g, pole, 0.08, 0.1, y1 + 0.2, x1, (y1 + 0.2) / 2, zf, 6);
    cyl(g, pole, 0.08, 0.1, y1 + 0.2, (x0 + x1) / 2, (y1 + 0.2) / 2, zf, 6);
    const cols = ["#E53935", "#FFEB3B", "#1E88E5", "#43A047", "#FB8C00", "#E91E63"].map((c, i) => mat("Flag" + i, c, { side: THREE.DoubleSide }));
    for (let i = 0; i < 25; i++) {
        const t = i / 24, x = x0 + (x1 - x0) * t, sag = Math.sin(t * Math.PI * 2) * 0.45;
        const y = y0 + (y1 - y0) * t - Math.abs(sag);
        tri(g, cols[i % cols.length], [x - 0.42, y, zf], [x + 0.42, y, zf], [x, y - 0.7, zf]);
    }
    // the wacky waving inflatable tube guy (resting — it's a Tuesday)
    const tube = mat("Tube", "#FF3D00");
    const tx = W / 2 + 1.1, tz = D / 2 + 0.6;
    cyl(g, mat("Fan", "#263238"), 0.45, 0.5, 0.5, tx, 0.25, tz, 8);
    cyl(g, tube, 0.28, 0.32, 3.4, tx, 2.2, tz, 8);
    cyl(g, tube, 0.11, 0.11, 1.5, tx - 0.7, 3.2, tz, 6, 0, 1.0);
    cyl(g, tube, 0.11, 0.11, 1.5, tx + 0.7, 3.5, tz, 6, 0, -0.7);
    cyl(g, mat("TubeFace", "#FFEB3B"), 0.3, 0.3, 0.5, tx, 4.1, tz, 8);
    anchor(g, "Anchor_sign", 0, H - 0.45, D / 2 - 0.02);
    anchor(g, "Anchor_door", 4.2, 0, D / 2);
    return g;
}

// ── one car on the lot ───────────────────────────────────────────────────
// the car stands at the origin, nose to the street (+Z); the pad runs from behind it out to the lot line (+4.2)
export const LOTCAR_DIMS = { w: 3.7, d: 5.0, prot: 1.7 };
function buildLotCar() {
    const g = new THREE.Group();
    g.name = "ShopsLotCar";
    const body = mat("Body", "#E91E63", { roughness: 0.35 }), light = mat("BodyLight", "#F48FB1", { roughness: 0.35 }), dark = mat("BodyDark", "#AD1457", { roughness: 0.4 });
    const tire = mat("Tire", "#222326", { roughness: 0.9 }), chrome = mat("Chrome", "#D6DADF", { metalness: 0.6, roughness: 0.25 });
    const seat = mat("Seat", "#F5E6D3"), glass = mat("Glass", "#BFE3F2"), lamp = mat("Lamp", "#FFF59D"), tail = mat("Tail", "#E53935");
    // (Fixed_*: what stays on the lot when the car is lifted out — the pad, the bay line, the price board)
    box(g, mat("Asphalt", "#55585E", { roughness: 1 }), 3.7, 0.05, 7.6, 0, 0.025, 0.4).name = "Fixed_pad";
    box(g, mat("Stripe", "#F5F5F5"), 0.12, 0.06, 5.6, -1.78, 0.03, 0.2).name = "Fixed_line";       // a painted bay line
    // body
    box(g, body, 1.78, 0.5, 4.1, 0, 0.62, 0);
    box(g, body, 1.7, 0.2, 1.35, 0, 0.94, 1.32, -0.08);            // hood
    box(g, body, 1.72, 0.22, 1.1, 0, 0.96, -1.45, 0.05);           // rear deck
    box(g, dark, 1.84, 0.1, 3.6, 0, 0.66, 0);                       // the side stripe
    box(g, light, 1.6, 0.06, 0.5, 0, 1.06, 1.85, -0.08);            // a light panel on the nose
    box(g, chrome, 1.84, 0.16, 0.18, 0, 0.44, 2.06);                // bumpers
    box(g, chrome, 1.84, 0.16, 0.18, 0, 0.44, -2.06);
    box(g, lamp, 0.34, 0.14, 0.08, -0.6, 0.72, 2.07); box(g, lamp, 0.34, 0.14, 0.08, 0.6, 0.72, 2.07);
    box(g, tail, 0.34, 0.12, 0.08, -0.6, 0.76, -2.07); box(g, tail, 0.34, 0.12, 0.08, 0.6, 0.76, -2.07);
    // the cabin: two seats + backs, a windshield in its frame
    box(g, seat, 0.62, 0.22, 0.6, -0.38, 0.95, -0.25); box(g, seat, 0.62, 0.22, 0.6, 0.38, 0.95, -0.25);
    box(g, seat, 0.62, 0.55, 0.16, -0.38, 1.25, -0.6, -0.15); box(g, seat, 0.62, 0.55, 0.16, 0.38, 1.25, -0.6, -0.15);
    box(g, glass, 1.56, 0.5, 0.05, 0, 1.3, 0.62, -0.45);
    box(g, chrome, 1.62, 0.06, 0.08, 0, 1.53, 0.52, -0.45);
    // wheels
    for (const [x, z] of [[-0.86, 1.3], [0.86, 1.3], [-0.86, -1.3], [0.86, -1.3]]) {
        cyl(g, tire, 0.34, 0.34, 0.26, x, 0.34, z, 10, 0, Math.PI / 2);
        cyl(g, chrome, 0.17, 0.17, 0.28, x, 0.34, z, 6, 0, Math.PI / 2);
    }
    // the price board on its post, at the front corner (the town draws the text — a sign in its atlas — on the anchor)
    cyl(g, mat("Pole", "#9EA4AA", { metalness: 0.4 }), 0.05, 0.05, 1.0, 1.3, 0.5, 3.4, 6).name = "Fixed_post";
    box(g, mat("Board", "#FFFFFF"), 1.36, 0.66, 0.06, 1.3, 1.28, 3.36).name = "Fixed_board";
    anchor(g, "Anchor_sign", 1.3, 1.28, 3.4);
    return g;
}

// ── the Bling Bay's door sign (a `with` entry of the dealership: the showroom's second door, away from the lot) ──
export const BLINGSIGN_DIMS = { w: 3.2, d: 0.3, prot: 1.45 };   // (its origin on the showroom's glass front: 1.6 m in from the lot line)
function buildBlingSign() {
    const g = new THREE.Group();
    g.name = "ShopsBlingSign";
    const neon = mat("NeonPink", "#FF4FA3", { emissive: "#FF4FA3", emissiveIntensity: 1.2 });
    box(g, mat("Door", "#37474F"), 1.9, 2.4, 0.12, 0, 1.2, 0.1);
    box(g, neon, 2.9, 0.08, 0.08, 0, 4.05, 0.2); box(g, neon, 2.9, 0.08, 0.08, 0, 2.95, 0.2);
    box(g, neon, 0.08, 1.1, 0.08, -1.45, 3.5, 0.2); box(g, neon, 0.08, 1.1, 0.08, 1.45, 3.5, 0.2);
    // a star on top
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; box(g, neon, 0.1, 0.5, 0.06, Math.sin(a) * 0.18, 4.45 + Math.cos(a) * 0.18, 0.22, 0, 0, -a); }
    anchor(g, "Anchor_sign", 0, 3.5, 0.18);
    anchor(g, "Anchor_door", 0, 0, 0.15);
    return g;
}

let made = false;
/** Register the code-built models (idempotent; cheap — a few dozen boxes). */
export function makeModels() {
    if (made) return;
    made = true;
    models.shops_dealer = buildDealer();
    models.shops_lotcar = buildLotCar();
    models.shops_blingsign = buildBlingSign();
}
makeModels();
