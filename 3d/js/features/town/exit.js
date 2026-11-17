// features/town — the EXIT on the Cruise highway: green signs ("LAKEWOOD · NEXT EXIT"),
// an overhead gantry, a deceleration lane that tapers out and an off-ramp that peels away
// to the right. Steer onto the ramp and the town takes over (index.js fades across).
// Exits sit at fixed distances into a Cruise run (the town's `highway: { first, every }`),
// planned ≥ 900 m ahead so world.reserve() keeps the trees, houses and poles off the ramp,
// and built in chunk:build like every other set piece (same chunk → same ramp).
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { models, registerModels, ensureModels, findNodes } from "../../models.js";
import { canvasTex, signTexture, worldMaterials } from "../../world.js";

registerModels({ town_gantry: "town_gantry" });

export const X = { exits: [], town: null };
const TAPER0 = -180, RAMP0 = -60, RAMP1 = 170;
/** The ramp's centre line (metres right of the highway's centre) at s − E. */
export const rampD = u => 8.75 + 0.0011 * Math.max(0, u - RAMP0) ** 2;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** Slide an exit forward until its signs, decel lane and ramp keep clear of every pull-in place
 *  (features/world's ctx.places: Gas 'n' Go, the Lookout, the family's driveways…). */
function clearOfPlaces(s) {
    const P = ctx.places;
    if (!P || !P.list || !P.at) return s;
    let busy = [];
    try { for (const p of P.list()) busy = busy.concat(P.at(p.id) || []); } catch (e) { return s; }
    for (let k = 0; k < 30; k++) {
        if (!busy.some(b => b > s - 760 && b < s + RAMP1 + 220)) return s;
        s += 250;
    }
    return s;
}

/** Plan exit k of this run (+ its reservations and roadside signs). */
export function planExit(s, town) {
    const w = ctx.world;
    s = clearOfPlaces(s);
    if (!w || X.exits.some(e => Math.abs(e.s - s) < 50)) return null;
    const res = [];
    const reserve = (a, b, side, d0, d1) => { w.reserve(a, b, side, d0, d1); res.push(w.reserved[w.reserved.length - 1]); };
    reserve(s + TAPER0 - 30, s + RAMP1 + 30, 1, 7.2, 95);
    reserve(s - 720, s - 680, 1, 9, 13);
    reserve(s - 340, s - 300, 1, 8, 14);
    const S = town.lines.SIGNS;
    const signs = [
        { s: s - 700, d: 10.6, lines: S.advance, bg: "#1f7a46", w: 4.6, h: 2.5, tw: 512, th: 280 },
        { s: s - 470, d: 10.6, lines: S.lastChance, bg: "#1f7a46", w: 4.2, h: 2.3, tw: 512, th: 280 },
        { s: s + RAMP0 + 4, d: 13.4, lines: S.gore, bg: "#1f7a46", w: 2.6, h: 1.4 },
    ];
    reserve(s - 490, s - 450, 1, 9, 13);
    for (const sg of signs) w.addSign(sg);
    const e = { s, town, res, signs, used: 0 };
    X.exits.push(e);
    return e;
}
export function clearExits() {
    const w = ctx.world;
    for (const e of X.exits) {
        for (const r of e.res) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
        for (const sg of e.signs) { const i = w.signs.indexOf(sg); if (i >= 0) w.signs.splice(i, 1); }
    }
    X.exits.length = 0;
}
/** The exit whose ramp is at highway distance s (or null). */
export function exitAt(s) { return X.exits.find(e => s > e.s + TAPER0 - 20 && s < e.s + RAMP1 + 40) || null; }
/** Is the car on the ramp, far enough along to commit? */
export function onRamp(e, s, d) {
    const u = s - e.s;
    if (u < -25 || u > RAMP1) return false;
    return d > 11.2 && d > rampD(u) - 2.8;
}

// ── geometry ─────────────────────────────────────────────────────────────
let rampMat = null, goreMat = null;
function mats() {
    if (rampMat) return rampMat;
    const tex = canvasTex(128, 256, (g, w, h) => {
        g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1600; i++) { g.fillStyle = ["#676b73", "#53575e", "#70747c"][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); }
        g.fillStyle = "#f4f4f0"; g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h);
    });
    rampMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    goreMat = new THREE.MeshStandardMaterial({ color: "#f4f4f0", roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    return rampMat;
}
/** A strip between d0(s) and d1(s) along the highway, s ∈ [a, b]. */
function strip(road, a, b, d0, d1, y, vScale = 12) {
    const n = Math.max(2, Math.round((b - a) / 2) + 1), p = {};
    const pos = [], uv = [], nor = [], idx = [];
    for (let k = 0; k < n; k++) {
        const s = a + (b - a) * k / (n - 1);
        road.point(s, d0(s), p); pos.push(p.x, y, p.z);
        road.point(s, d1(s), p); pos.push(p.x, y, p.z);
        uv.push(0, s / vScale, 1, s / vScale);
        nor.push(0, 1, 0, 0, 1, 0);
        if (k < n - 1) { const i = k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}

on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (world.district) return;
    for (const e of X.exits) {
        const a = Math.max(s0, e.s + TAPER0), b = Math.min(s1, e.s + RAMP1);
        const road = world.highway;
        mats();
        if (a < b) {
            // the deceleration lane widens, then the ramp peels off
            const ta = Math.max(a, e.s + TAPER0), tb = Math.min(b, e.s + RAMP0);
            if (ta < tb) chunk.addMesh(strip(road, ta, tb, () => 6.9, s => 7 + 4.05 * smooth((s - e.s - TAPER0) / (RAMP0 - TAPER0)), 0.033, 12), rampMat);
            const ra = Math.max(a, e.s + RAMP0);
            if (ra < b) {
                chunk.addMesh(strip(road, ra, b, s => rampD(s - e.s) - 2.3, s => rampD(s - e.s) + 2.3, 0.034, 12), rampMat);
                // the painted gore between the highway's edge line and the ramp
                const ga = Math.max(ra, e.s + RAMP0 + 8), gb = Math.min(b, e.s + RAMP0 + 70);
                if (ga < gb) chunk.addMesh(strip(road, ga, gb, () => 7.0, s => Math.max(7.05, rampD(s - e.s) - 2.3), 0.036), goreMat);
            }
        }
        // the overhead gantry: EXIT 91 · LAKEWOOD
        const gs = e.s - 320;
        if (gs >= s0 && gs < s1 && models.town_gantry) {
            const p = road.point(gs, 9.6, {});
            const g = models.town_gantry.clone(true);
            g.position.set(p.x, 0, p.z);
            g.rotation.y = p.h + Math.PI;          // the board faces us…
            g.scale.x = -1;                        // …and the arm (model +X) reaches LEFT, over our lanes
            g.updateMatrixWorld(true);
            const anchor = findNodes(g, "Anchor_sign")[0];
            if (anchor) {
                const S = e.town.lines.SIGNS;
                const mat = new THREE.MeshStandardMaterial({ map: signTexture(S.gantry, "#1f7a46", "#ffffff", 768, 340), roughness: 0.6 });
                const q = new THREE.Mesh(new THREE.PlaneGeometry(6.9, 3.1), mat);
                anchor.getWorldPosition(q.position);
                q.position.x -= Math.sin(p.h) * 0.02; q.position.z -= Math.cos(p.h) * 0.02;
                q.rotation.y = p.h + Math.PI;
                chunk.add(q);
                chunk.own(q.geometry); chunk.own(mat);
            }
            chunk.add(g);
            chunk.addCollider({ x: p.x, z: p.z, r: 0.45, kind: "sign" });
        }
    }
});

// load the gantry early (it's tiny), so the first exit has it
on("boot", () => { ensureModels(["town_gantry"]).catch(() => {}); });
export { worldMaterials };
