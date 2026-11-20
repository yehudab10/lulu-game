// features/town/ambient.js — a town that STANDS by the road looks alive from the ramp.
//
// A town's real drivers (cars.js) only run while she's in it (they live on its TownRoad). From the ramp / the cross
// road the town used to look frozen — so while she's within FROM m of a standing town (index.js S.built, outside it),
// a few light minivans (the parked cars' LOD model, ONE instanced draw call per town, no shadows) drive up and down
// the streets nearest the cross road's join. When she drives in, each one becomes a real town driver at the same
// spot, heading the same way (convertAmbient) — nothing pops at the line.
//
// Every street call runs under the entry's own plan (index.js withPlan): an attached town is placed + turned per
// interchange, so local street points go through toWorld / wH like everything else in the town.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx } from "../../core/ctx.js";
import { models } from "../../models.js";
import { PL, LANE, streetPoint, toWorld, wH } from "./plan.js";
import { spawnDriver } from "./cars.js";

export const AMB = { N: 5, FROM: 520, STREETS: 3, NEAR: 230, SPEED: [7, 10.5], KIND: "town_van", PAINT: "#BEC3C9" };

let geo = null, mat = null;
/** The LOD minivan as ONE vertex-coloured geometry (its paint silver, like the town's minivans). */
function bodyGeo() {
    if (geo) return geo;
    const src = models.town_minivan_lod;
    if (!src) return null;
    src.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(src.matrixWorld).invert(), parts = [];
    src.traverse(o => {
        if (!o.isMesh) return;
        const g = new THREE.BufferGeometry();
        const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
        const base = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
        g.setAttribute("position", base.attributes.position.clone());
        if (base.attributes.normal) g.setAttribute("normal", base.attributes.normal.clone());
        g.applyMatrix4(m);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        const c = new THREE.Color(/paint/i.test(o.material.name || "") ? AMB.PAINT : (o.material.color ? o.material.color.getHex() : 0x888888));
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        if (!g.attributes.normal) g.computeVertexNormals();
        parts.push(g);
        if (base !== o.geometry) base.dispose();
    });
    geo = parts.length ? mergeGeometries(parts, false) : null;
    for (const g of parts) g.dispose();
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
    return geo;
}

const rnd = (a, b) => a + Math.random() * (b - a);
/** Start an entry's ambient cars (call under its plan): the streets nearest the join, cars spread along their near ends. */
function start(en) {
    const g = bodyGeo();
    if (!g) return null;
    const J = en.def.attach && en.def.attach.join;
    if (!J) return null;
    const near = [];
    for (const st of PL.STREETS) {
        if (st.approach || st.oneway || (st.data && st.data.grid === false)) continue;   // (one-ways: no U-turns)
        // distance from the join to this street's centre line (clamped to its span)
        let d, at;
        if (st.axis === "ns") { at = Math.max(st.a0, Math.min(st.a1, J[1])); d = Math.hypot(st.c - J[0], at - J[1]); }
        else if (st.axis === "ew") { at = Math.max(st.a0, Math.min(st.a1, J[0])); d = Math.hypot(at - J[0], st.c - J[1]); }
        else { const t = (J[0] - st.px) * st.ux + (J[1] - st.pz) * st.uz; at = Math.max(st.a0, Math.min(st.a1, t)); d = Math.hypot(st.px + st.ux * at - J[0], st.pz + st.uz * at - J[1]); }
        near.push({ st, d, at });
    }
    near.sort((a, b) => a.d - b.d);
    const use = near.slice(0, AMB.STREETS).filter(n => n.d < AMB.NEAR);
    if (!use.length) return null;
    const im = new THREE.InstancedMesh(g, mat, AMB.N);
    im.frustumCulled = false; im.castShadow = false; im.receiveShadow = true; im.name = "townAmbient";
    const cars = [];
    for (let i = 0; i < AMB.N; i++) {
        const n = use[i % use.length], st = n.st;
        const lo = Math.max(st.a0 + 8, n.at - 120), hi = Math.min(st.a1 - 8, n.at + 120);
        if (hi <= lo) continue;
        cars.push({ street: st.id, lo, hi, along: rnd(lo, hi), dir: Math.random() < 0.5 ? -1 : 1, v: rnd(...AMB.SPEED) });
    }
    im.count = cars.length;
    ctx.scene.add(im);
    return { im, cars };
}
const _p = {}, _w = {}, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
/** Move + draw an entry's ambient cars (call under its plan). */
function step(A, dt) {
    A.cars.forEach((c, i) => {
        const st = PL.STREETS[c.street];
        c.along += c.dir * c.v * dt;
        if (c.along > c.hi) { c.along = c.hi; c.dir = -1; } else if (c.along < c.lo) { c.along = c.lo; c.dir = 1; }   // (a U-turn at the end of its stretch — far away)
        streetPoint(st, c.along, c.dir * LANE, _p);
        toWorld(_p.x, _p.z, _w);
        _e.set(0, wH(st.h + (c.dir < 0 ? Math.PI : 0)), 0);
        _m.compose(_v.set(_w.x, 0, _w.z), _q.setFromEuler(_e), ONE);
        A.im.setMatrixAt(i, _m);
    });
    A.im.instanceMatrix.needsUpdate = true;
}
export function disposeAmbient(en) {
    if (!en.amb) return;
    en.amb.im.removeFromParent();
    en.amb.im.dispose();
    en.amb = null;
}
/**
 * Per frame (index.js tendAttached): for each standing, ready entry she's NOT in — near enough (and its town drawn):
 * keep its ambient cars moving; otherwise drop them. `dist(en)` = her distance (m) to its footprint, `under(en, fn)`
 * runs fn under the entry's plan.
 */
export function tendAmbient(entries, active, dt, dist, under) {
    for (const en of entries) {
        const want = en.ready && en !== active && en.T && en.T.root.visible && dist(en) < AMB.FROM;
        if (!want) { disposeAmbient(en); continue; }
        under(en, () => { if (!en.amb) en.amb = start(en); if (en.amb) step(en.amb, dt); });
    }
}
/** She drove into en (its plan is the current one): every ambient car becomes a real driver right where it is. Returns how many (of AMB.KIND). */
export function convertAmbient(en) {
    const A = en.amb;
    if (!A) return 0;
    let n = 0;
    for (const c of A.cars) {
        try { spawnDriver(AMB.KIND, c.street, c.along, c.dir, { speed: c.v * 0.8 }); n++; } catch (e) { console.error("[town] ambient → driver", e); }
    }
    disposeAmbient(en);
    return n;
}
