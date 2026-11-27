// features/dealers/models.js — code-built models, registered straight into models[key] (like features/shops):
//   dealers_mazelati   the Mazelati showroom + its forecourt (model-local metres, +Z toward the road): a black-framed
//                      glass box with a gold fascia, a chandelier you can see through the glass, velvet ropes, four
//                      white pedestals out front for the cars on show (the cars themselves are real car clones, spawned
//                      near her — index.js), a red carpet to the door. Merged by material: ~4 draw calls.
// + the marques' body KITS (car.js KITS): a few small parts on the one convertible.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { models } from "../../models.js";
import { KITS } from "../../car.js";
import { canvasTex } from "../../world.js";

/** The showroom's layout (model-local): the building, the door, the four pedestals. */
export const SHOW = {
    w: 26, d: 12, h: 6.2, z0: -3,                 // the building: x ±13, z −3 (glass front) → −15
    door: { x: 0, z: -2.2 },
    pads: [{ x: -9.5, z: 4.5 }, { x: -3.2, z: 5.5 }, { x: 3.2, z: 5.5 }, { x: 9.5, z: 4.5 }],
    sal: { x: 2.6, z: -1.4 },
};

const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cyl = (r, h, x, y, z, seg = 16) => { const g = new THREE.CylinderGeometry(r, r, h, seg); g.translate(x, y, z); return g; };
function paint(g, hex) {
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    return g;
}
function merged(parts, mat, name) {
    const geo = mergeGeometries(parts.map(([g, hex]) => paint(g, hex)), false);
    for (const [g] of parts) g.dispose();
    const m = new THREE.Mesh(geo, mat);
    m.name = name; m.castShadow = true; m.receiveShadow = true;
    return m;
}

function buildMazelati() {
    const g = new THREE.Group();
    g.name = "dealers_mazelati";
    const S = SHOW, W = S.w, D = S.d, H = S.h, zf = S.z0, zc = zf - D / 2;
    const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
    const BLACK = "#141414", GOLD = "#C9A227", MARBLE = "#ECE8E1", RED = "#8E0F1E", WHITE = "#F7F5F0", ASPH = "#2E2E33";
    const P = [];
    // the forecourt (dark, polished) + a red carpet to the door
    P.push([box(36, 0.06, 20, 0, 0.03, 6), ASPH]);
    P.push([box(2.2, 0.03, 8.6, 0, 0.075, 2.1), RED]);
    // the building: marble floor, back + side walls, a black roof slab with a gold edge, black glazing bars
    P.push([box(W, 0.12, D, 0, 0.06, zc), MARBLE]);
    P.push([box(W, H, 0.4, 0, H / 2, zf - D + 0.2), WHITE]);
    for (const sx of [-1, 1]) P.push([box(0.4, H, D, sx * (W / 2 - 0.2), H / 2, zc), WHITE]);
    P.push([box(W + 0.8, 0.6, D + 0.8, 0, H + 0.3, zc), BLACK], [box(W + 0.9, 0.12, D + 0.9, 0, H + 0.02, zc), GOLD]);
    for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 6) P.push([box(0.22, H, 0.22, x, H / 2, zf), BLACK]);
    P.push([box(W, 0.22, 0.22, 0, 0.11, zf), BLACK]);
    // the door frame (gold) + a canopy over it
    P.push([box(0.16, 3.0, 0.3, -1.3, 1.5, zf + 0.05), GOLD], [box(0.16, 3.0, 0.3, 1.3, 1.5, zf + 0.05), GOLD], [box(2.76, 0.16, 0.3, 0, 3.0, zf + 0.05), GOLD]);
    P.push([box(4.2, 0.18, 2.4, 0, 3.4, zf + 1.1), BLACK]);
    // the chandelier inside (a gold ring + crystal drops — seen through the glass)
    P.push([cyl(1.2, 0.12, 0, H - 1.5, zc, 20), GOLD], [cyl(0.04, 1.4, 0, H - 0.75, zc, 6), GOLD]);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; P.push([box(0.12, 0.45, 0.12, Math.cos(a) * 1.1, H - 1.85, zc + Math.sin(a) * 1.1), WHITE]); }
    // velvet ropes along the forecourt edge (gold posts, red ropes)
    for (let k = 0; k < 9; k++) { const x = -16 + k * 4; P.push([cyl(0.07, 1.0, x, 0.5, 14.5, 8), GOLD]); if (k < 8) P.push([box(4, 0.1, 0.1, x + 2, 0.82, 14.5), RED]); }
    // the pedestals (white discs with a gold rim)
    for (const p of S.pads) P.push([cyl(2.9, 0.18, p.x, 0.09, p.z, 28), WHITE], [cyl(2.95, 0.06, p.x, 0.2, p.z, 28), GOLD]);
    g.add(merged(P, solid, "Solid"));
    // the glass front (one transparent pane)
    const glass = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.08), new THREE.MeshStandardMaterial({ color: "#A9C6D9", roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.32, depthWrite: false }));
    glass.position.set(0, H / 2, zf);
    glass.name = "Glass";
    g.add(glass);
    // the gold fascia sign
    const tex = canvasTex(1024, 128, (c, w, h) => {
        c.fillStyle = "#141414"; c.fillRect(0, 0, w, h);
        c.fillStyle = "#C9A227"; c.font = "bold 84px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
        c.fillText("M A Z E L A T I", w / 2, h / 2 + 4);
    }, false);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.75), new THREE.MeshBasicMaterial({ map: tex }));
    sign.position.set(0, H + 0.3, zf + 0.42);
    sign.name = "Fascia";
    g.add(sign);
    for (const [k, p] of S.pads.entries()) { const a = new THREE.Object3D(); a.name = "Anchor_pad" + k; a.position.set(p.x, 0.2, p.z); g.add(a); }
    const door = new THREE.Object3D(); door.name = "Anchor_door"; door.position.set(S.door.x, 0, S.door.z + 2.2); g.add(door);
    return g;
}

// ── the marques' body kits (car.js KITS): small parts hung on the convertible's anchors ──
const kitMats = {};
const km = (k, opts) => kitMats[k] || (kitMats[k] = new THREE.MeshStandardMaterial(opts));
KITS.mazelati = (model, anchors, sk) => {
    const chrome = km("chrome", { color: "#E8E8E8", metalness: 0.9, roughness: 0.2 });
    const gold = km("gold", { color: sk.stripe || "#C9A227", metalness: 0.7, roughness: 0.3 });
    const g = new THREE.Group(); g.name = "Kit_mazelati";
    // a hood ornament (a little gold wing), a chrome grille bar, a long chrome strip down each side, a rear lip
    const orn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 4), gold); orn.rotation.x = -0.5; orn.position.set(0, 0.88, 1.75);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.06), chrome); grille.position.set(0, 0.55, 2.12);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.24), chrome); lip.position.set(0, 0.86, -1.95);
    g.add(orn, grille, lip);
    for (const sx of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 3.2), chrome); st.position.set(sx * 0.93, 0.62, 0); g.add(st); }
    model.add(g);
};

if (!models.dealers_mazelati) models.dealers_mazelati = buildMazelati();
