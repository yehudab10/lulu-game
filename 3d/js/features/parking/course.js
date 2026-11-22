// features/parking — THE COURSE: where the 🅿️ Parking Challenge is played, on a REAL lot in the world (owner,
// 2026-11-22: "I want one main world and that's it… parking challenge should move to a lot").
//
// One course per rest area (features/exits), in the open corner of the truck lot beside Mendel's garage: the kerb
// runs along the garage's side (u ≈ 150), the bay row in front of it, a 14 m lane out to the semis, the closed end at
// the lot's edge (d 66, a row of bollards) and the open end — the entrance — by the lamp at d 40, where the attendant
// stands with his clipboard next to his booth and a painted START box.
//
// COORDINATES. A course has its own flat frame: local X along the kerb, local Z away from it, laid out in the 2D
// game's lot pixels exactly like the old roadside lot (lot.js: X = (x − 240) / 17, Z = (y − 150) / 17 — so the
// challenge's bay, its parked cars and every level's numbers are the 2D ones). The frame sits at `O` turned by `phi`
// (an Object3D with rotation.y = phi: local (X, Z) → world (O.x + X cos φ + Z sin φ, O.z − X sin φ + Z cos φ), a local
// heading h → world h + φ). φ is the highway's heading there, so local Z points along the highway (+u) and local X
// points LEFT of it (−d): the course's X runs from the entrance (d ≈ 41.6, X +12.2) to the closed end (d 66, X −12.2).
//
// The static course (kerb, sidewalk, paint, the booth, bollards, the edge cones, carts, the sign) is built into the
// highway chunk that holds its middle (merged by material: a handful of draw calls) and goes with that chunk. The
// attendant is a person spawned while she's within 150 m. The LEVEL's props (parked cars, cones, cameras, the
// pedestrian, the lot traffic, Sasquatch) are index.js's.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on, hook } from "../../core/ctx.js";
import { canvasTex } from "../../world.js";
import { models, ensureModels } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { lotZ } from "./lot.js";

/** The course in its rest area: u0 / dC = where local (0, 0) sits (rest-area road coords). */
export const COURSE = {
    u0: 148.65, dC: 53.8,
    x0: -12.2, x1: 12.2,          // the kerb's ends (closed end · entrance)
    curbZ: lotZ(178),             // the challenge's kerb line (2D row y 168 + 10)
    farZ: 19.4,                   // the lane's far edge (the edge cones; the semis start at Z ≈ 20.9)
    start: { x: 9.6, z: 12.4, r: 2.4 },            // the painted START box (she faces −X: along the row, kerb on her right)
    att: { x: 12.5, z: 10.4 },                     // the attendant, by the box
    booth: { x: 14.7, z: 6.6 },
    sign: { x: 13.6, z: 16.6 },
    // leaving: past these (local) she has driven out of the course
    out: { x: 13.6, zFar: 21.2, zNear: -2.5 },
    near: 150,                    // the attendant + the course's people exist within this (m)
};
export const START_H = -Math.PI / 2;                // the START box's heading (local): −X

// ── the frame ────────────────────────────────────────────────────────────
const road = () => (ctx.world && (ctx.world.highway || ctx.world.road)) || null;
/** The course record for the rest area at s (built on demand, cached by s). */
const CACHE = new Map();
export function courseAt(s) {
    let c = CACHE.get(s);
    if (c) return c;
    const r = road();
    if (!r) return null;
    const p = r.point(s + COURSE.u0, COURSE.dC, {}), h = r.at(s + COURSE.u0 + 8, {}).h;
    c = { s, O: { x: p.x, z: p.z }, phi: h, cos: Math.cos(h), sin: Math.sin(h), chunk: null, statics: null, person: null, board: null };
    CACHE.set(s, c);
    return c;
}
/** local (X, Z) → world {x, z} */
export function toWorld(c, X, Z, out = {}) {
    out.x = c.O.x + X * c.cos + Z * c.sin;
    out.z = c.O.z - X * c.sin + Z * c.cos;
    return out;
}
/** world (x, z) → local {x, z} */
export function toLocal(c, x, z, out = {}) {
    const dx = x - c.O.x, dz = z - c.O.z;
    out.x = dx * c.cos - dz * c.sin;
    out.z = dx * c.sin + dz * c.cos;
    return out;
}
/** A world vector (vx, vz) in the course's axes. */
export function vecLocal(c, vx, vz, out = {}) { out.x = vx * c.cos - vz * c.sin; out.z = vx * c.sin + vz * c.cos; return out; }
/** A local vector in world axes. */
export function vecWorld(c, X, Z, out = {}) { out.x = X * c.cos + Z * c.sin; out.z = -X * c.sin + Z * c.cos; return out; }
export const hWorld = (c, hl) => hl + c.phi;
export const hLocal = (c, hw) => hw - c.phi;

/** The courses of this run's rest areas (the ones whose rest area is still planned). */
export function courses() {
    const out = [];
    for (const R of (ctx.exits && ctx.exits.rests) || []) { const c = courseAt(R.s); if (c) out.push(c); }
    return out;
}
/** The course nearest to (x, z) within `max` metres of its middle, or null. */
export function nearestCourse(x, z, max = 1e9) {
    let best = null, bd = max;
    for (const c of courses()) {
        const m = toWorld(c, 0, 9, {}), d = Math.hypot(m.x - x, m.z - z);
        if (d < bd) { bd = d; best = c; }
    }
    return best;
}
/** Is local (X, Z) inside the course (the lane + the bay row, kerb to far edge, closed end to entrance)? */
export const insideLocal = (X, Z, m = 0) => X > COURSE.x0 - 1 - m && X < COURSE.out.x + m && Z > COURSE.out.zNear - m && Z < COURSE.out.zFar + m;

// ── materials + shared geometry (made once) ──────────────────────────────
let M = null;
function mats() {
    if (M) return M;
    const signTex = canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = "#1565C0"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#fff"; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = "bold 120px sans-serif"; g.fillText("P", 80, h / 2 + 6);
        g.font = "bold 46px sans-serif"; g.fillText("PARKING", 320, 82); g.fillText("CHALLENGE", 320, 136);
        g.font = "bold 30px sans-serif"; g.fillText("pull up to the attendant ➜", 300, 200);
    }, false);
    const startTex = canvasTex(256, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "rgba(255,255,255,0.92)"; g.font = "bold 78px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("START", w / 2, h / 2 + 4);
    }, false);
    const pTex = canvasTex(128, 128, (g, w, h) => {
        g.fillStyle = "#1565C0"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#fff"; g.lineWidth = 8; g.strokeRect(6, 6, w - 12, h - 12);
        g.fillStyle = "#fff"; g.font = "bold 96px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("P", w / 2, h / 2 + 6);
    }, false);
    M = {
        concrete: new THREE.MeshStandardMaterial({ color: "#CFC8BC", roughness: 0.9 }),
        kerb: new THREE.MeshStandardMaterial({ color: "#d9d3c7", roughness: 0.85 }),
        yellow: new THREE.MeshStandardMaterial({ color: "#FBC02D", roughness: 0.6 }),
        white: new THREE.MeshStandardMaterial({ color: "#F5F5EE", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2 }),
        orange: new THREE.MeshStandardMaterial({ color: "#FF6D00", roughness: 0.7 }),
        wall: new THREE.MeshStandardMaterial({ color: "#ECEFF1", roughness: 0.8 }),
        trim: new THREE.MeshStandardMaterial({ color: "#1565C0", roughness: 0.6 }),
        glass: new THREE.MeshStandardMaterial({ color: "#B3E5FC", roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.6 }),
        steel: new THREE.MeshStandardMaterial({ color: "#B0BEC5", roughness: 0.4, metalness: 0.6 }),
        red: new THREE.MeshStandardMaterial({ color: "#E53935", roughness: 0.6 }),
        sign: new THREE.MeshBasicMaterial({ map: signTex }),
        start: new THREE.MeshBasicMaterial({ map: startTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }),
        p: new THREE.MeshBasicMaterial({ map: pTex }),
    };
    return M;
}
/** A box geometry already moved to (x, y, z) in the course frame (rotated ry about Y). */
function box(w, h, d, x, y, z, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
}
function cyl(rt, rb, h, x, y, z, seg = 8) { const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); return g; }
function cone(r, h, x, y, z) { const g = new THREE.ConeGeometry(r, h, 10); g.translate(x, y, z); return g; }
/** A painted strip on the ground (a flat box, 1 cm). */
const stripe = (w, d, x, z) => box(w, 0.012, d, x, 0.016, z);

/** A shopping cart's parts at (x, z) facing ry, into the per-material lists. */
function cart(L, x, z, ry) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    // the basket (a wire cage read as a light open box: four thin walls + a floor)
    const B = (w, h, d, lx, y, lz) => { const [px, pz] = at(lx, lz); L.steel.push(box(w, h, d, px, y, pz, ry)); };
    B(0.56, 0.42, 0.03, 0, 0.78, 0.44); B(0.56, 0.42, 0.03, 0, 0.78, -0.44);
    B(0.03, 0.42, 0.88, 0.28, 0.78, 0); B(0.03, 0.42, 0.88, -0.28, 0.78, 0);
    B(0.56, 0.03, 0.88, 0, 0.58, 0);
    B(0.04, 0.5, 0.04, 0.24, 0.3, -0.38); B(0.04, 0.5, 0.04, -0.24, 0.3, -0.38); B(0.04, 0.5, 0.04, 0.24, 0.3, 0.38); B(0.04, 0.5, 0.04, -0.24, 0.3, 0.38);
    const [hx, hz] = at(0, -0.52); L.red.push(box(0.6, 0.06, 0.06, hx, 1.02, hz, ry));       // the handle
    for (const [wx, wz] of [[0.22, 0.38], [-0.22, 0.38], [0.22, -0.38], [-0.22, -0.38]]) { const [px, pz] = at(wx, wz); L.kerb.push(box(0.05, 0.12, 0.12, px, 0.06, pz, ry)); }
}

/** Build the static course into `chunk` (the highway chunk that holds its middle). */
function buildStatic(c, chunk) {
    const Mt = mats(), C = COURSE;
    const L = { concrete: [], kerb: [], yellow: [], white: [], orange: [], wall: [], trim: [], glass: [], steel: [], red: [], sign: [], start: [], p: [] };
    const len = C.x1 - C.x0, mid = (C.x0 + C.x1) / 2;
    // the kerb (yellow-topped) + the sidewalk behind it
    L.kerb.push(box(len, 0.18, 0.3, mid, 0.09, C.curbZ - 0.15));
    L.yellow.push(box(len, 0.02, 0.12, mid, 0.19, C.curbZ - 0.08));
    L.concrete.push(box(len, 0.15, 1.5, mid, 0.075, C.curbZ - 0.3 - 0.75));
    // the bay row's edge line (the lane starts past it) + the far edge's dashes
    const zz1 = lotZ(168 + 62);
    L.white.push(stripe(len, 0.12, mid, zz1 + 0.06));
    for (let x = C.x0 + 0.5; x < 7.5; x += 1.6) L.white.push(stripe(0.9, 0.12, x, C.farZ - 0.4));
    // the START box: an outline + the word, by the attendant
    const S = C.start, bl = 5.2, bw = 2.7;
    L.white.push(stripe(bl, 0.14, S.x, S.z - bw / 2), stripe(bl, 0.14, S.x, S.z + bw / 2), stripe(0.14, bw, S.x - bl / 2, S.z), stripe(0.14, bw, S.x + bl / 2, S.z));
    { const g = new THREE.PlaneGeometry(2.2, 1.1); g.rotateX(-Math.PI / 2); g.rotateY(-Math.PI / 2); g.translate(S.x + bl / 2 - 0.9, 0.02, S.z); L.start.push(g); }
    // the closed end: bollards along the lot's edge (solid) + two planter-ish blocks at the corners
    const cols = [];
    for (let z = -0.6; z <= C.farZ + 0.6; z += 1.45) { L.yellow.push(cyl(0.12, 0.14, 0.9, C.x0 - 0.5, 0.45, z)); cols.push([C.x0 - 0.5, z, 0.2]); }
    for (const z of [-0.9, C.farZ + 1.2]) { L.concrete.push(box(1.1, 0.55, 1.1, C.x0 - 0.5, 0.275, z)); cols.push([C.x0 - 0.5, z, 0.6]); }
    // the far edge's cones (a soft line toward the trucks: no colliders, she can see where the course ends)
    for (let x = C.x0 + 0.6; x <= 9.4; x += 2.4) { L.orange.push(cone(0.18, 0.55, x, 0.275, C.farZ + 0.35)); L.white.push(cyl(0.2, 0.2, 0.06, x, 0.03, C.farZ + 0.35, 10)); }
    // the booth (the old onegame booth: white box, blue roof, a window, a 🅿️ cube on a post)
    const Bt = C.booth;
    L.wall.push(box(1.6, 2.2, 1.6, Bt.x, 1.1, Bt.z));
    L.trim.push(box(2.0, 0.18, 2.0, Bt.x, 2.29, Bt.z), cyl(0.05, 0.05, 1.2, Bt.x, 2.9, Bt.z));
    L.glass.push(box(0.05, 0.8, 1.2, Bt.x - 0.81, 1.45, Bt.z));
    L.p.push(box(0.72, 0.72, 0.72, Bt.x, 3.5, Bt.z));
    cols.push([Bt.x, Bt.z, 1.15]);
    // the sign by the entrance (faces the way she comes in: +X)
    const Sg = C.sign;
    L.steel.push(cyl(0.05, 0.05, 2.1, Sg.x, 1.05, Sg.z - 0.9), cyl(0.05, 0.05, 2.1, Sg.x, 1.05, Sg.z + 0.9));
    { const g = new THREE.PlaneGeometry(2.4, 1.2); g.rotateY(Math.PI / 2); g.translate(Sg.x + 0.03, 2.0, Sg.z); L.sign.push(g); L.trim.push(box(0.05, 1.28, 2.48, Sg.x - 0.01, 2.0, Sg.z)); }
    cols.push([Sg.x, Sg.z - 0.9, 0.15], [Sg.x, Sg.z + 0.9, 0.15]);
    // two shopping carts left on the sidewalk by the booth
    cart(L, 11.6, 0.35, 0.2); cart(L, 10.7, 0.4, -0.15);
    const g = new THREE.Group();
    g.name = "ParkingCourse";
    for (const [k, list] of Object.entries(L)) {
        if (!list.length) continue;
        const geo = mergeGeometries(list, false);
        for (const x of list) x.dispose();
        const m = new THREE.Mesh(geo, Mt[k]);
        m.castShadow = !["white", "start", "yellow"].includes(k) || k === "yellow";
        m.receiveShadow = true;
        g.add(m);
    }
    g.position.set(c.O.x, 0, c.O.z);
    g.rotation.y = c.phi;
    chunk.group.add(g);
    if (chunk.addCollider) for (const [x, z, r] of cols) { const p = toWorld(c, x, z, {}); chunk.addCollider({ x: p.x, z: p.z, r, kind: "prop" }); }
    c.chunk = chunk;
    c.statics = g;
    g.updateMatrixWorld(true);
}
on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (world.district && !world.district.keepHighway) return;
    for (const R of (ctx.exits && ctx.exits.rests) || []) {
        const s = R.s + COURSE.u0 + 9;
        if (s < s0 || s >= s1) continue;
        try { const c = courseAt(R.s); if (c) buildStatic(c, chunk); } catch (e) { console.error("[parking] course", e); }
    }
});
on("chunk:dispose", ({ chunk }) => {
    for (const c of CACHE.values()) if (c.chunk === chunk) { c.chunk = null; c.statics = null; dropAttendant(c); }
});
on("run:start", () => { for (const c of CACHE.values()) dropAttendant(c); CACHE.clear(); });
/** Courses standing right now (their chunk is alive). */
export function liveCourses() { return courses().filter(c => c.chunk && !c.chunk.dead); }

// ── the attendant (+ his clipboard; the result board he holds up is index.js's) ──
function dropAttendant(c) { if (c.person) { c.person.obj.removeFromParent(); c.person = null; } }
let clipGeo = null;
function clipboard() {
    clipGeo = clipGeo || new THREE.BoxGeometry(0.26, 0.34, 0.03);
    const m = new THREE.Mesh(clipGeo, mats().wall);
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.035), mats().steel);
    clip.position.y = 0.17; m.add(clip);
    return m;
}
export const ATT_COLORS = { Top: "#1565C0", Bottom: "#37474F", Hair: "#5D4037" };
function spawnAttendant(c) {
    if (!models.npcMan) return;
    try {
        const p = spawnPerson("npcMan", { colors: ATT_COLORS });
        const at = toWorld(c, COURSE.att.x, COURSE.att.z, {});
        p.obj.position.set(at.x, 0, at.z);
        p.obj.rotation.y = hWorld(c, -Math.PI * 0.75);
        ctx.scene.add(p.obj);
        // the clipboard in his left hand (or at his chest when the rig has no arm to hold it)
        const arm = p.limbs && (p.limbs.Arm_L || p.limbs.Arm_R);
        const cb = clipboard();
        if (arm) { p.obj.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(arm); const tip = arm.worldToLocal(new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y + 0.12, (b.min.z + b.max.z) / 2)); cb.position.copy(tip); cb.position.z += 0.08; arm.add(cb); }
        else { cb.position.set(0.15, 1.1, 0.3); p.obj.add(cb); }
        c.person = p;
        c.clip = cb;
    } catch (e) { c.person = null; }
}
const ATT = { busy: null };
/** Each frame: spawn / drop the attendant with distance; idle him (index.js drives him during a level via `ATT.busy`). */
hook("hud", dt => {
    const car = ctx.car;
    if (!car || !CACHE.size) return;
    const me = (ctx.foot && ctx.foot.active && ctx.foot.pos) || car.pos;
    for (const c of CACHE.values()) {
        const live = c.chunk && !c.chunk.dead;
        const at = live ? toWorld(c, COURSE.att.x, COURSE.att.z, {}) : null;
        const near = live && Math.hypot(at.x - me.x, at.z - me.z) < COURSE.near;
        if (near && !c.person) spawnAttendant(c);
        else if (!near && c.person) dropAttendant(c);
        if (!c.person || ATT.busy === c) continue;
        // idle: face whoever's coming, a wave now and then
        c.person.face(me.x, me.z, dt, 2);
        c.person.update(dt, { wave: Math.sin(ctx.time * 0.7 + c.s) > 0.93 });
    }
});
on("boot", () => { ensureModels(["npcMan"]).catch(() => {}); });
export { ATT as attendantCtl };

/** The world point of a course's START box / attendant / booth spot (for marks, tests, foot's ✋). */
export const startPoint = c => toWorld(c, COURSE.start.x, COURSE.start.z, {});
export const attendantPoint = c => toWorld(c, COURSE.att.x, COURSE.att.z, {});
export const boothPoint = c => toWorld(c, COURSE.booth.x - 1.3, COURSE.booth.z + 1.4, {});
