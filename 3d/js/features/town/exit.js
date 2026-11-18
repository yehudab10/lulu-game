// features/town — the EXITS on the Cruise highway. Each Cruise exit is an INTERCHANGE that offers
// every town (towns/index.js › INTERCHANGE): advance signs (1 MI, ½ MI), an overhead gantry with an
// EXIT ONLY board over the deceleration lane and a "↑ THRU TRAFFIC" board over the through lanes, a
// dashed line that keeps the right lane going straight, the decel lane, ONE off-ramp that splits
// after the gore (the inner branch → the first town, the outer → the second, a split sign at the
// fork). Staying in lane always passes it; only a branch, well clear of the highway, takes her into
// a town (index.js fades across), so a drift onto the shoulder or the decel lane never does: she can
// steer back across the painted gore until the split. The ramps are paved (core's `paved` registry:
// no grass drag on them). A one-town exit (tests / debug: `exitAhead(ahead, id)`) is the same with a
// single ramp and that town's own signs.
// Exits sit at fixed distances into a Cruise run (`highway: { first, every }`), planned ≥ 900 m ahead
// so world.reserve() keeps the trees, houses and poles off the ramps, slid clear of pull-in places,
// rest areas (features/exits) and reserved stretches (the coast's ocean, a family's house), and built
// in chunk:build like every other set piece (same chunk → same ramps).
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { models, registerModels, ensureModels, findNodes } from "../../models.js";
import { canvasTex, signTexture, worldMaterials } from "../../world.js";
import { paved } from "../../core/driving.js";
import { INTERCHANGE, fillLine } from "./towns/index.js";

// the interchange gantry (features/exits' Blender module builds it; the old one-board gantry is the fallback)
registerModels({ town_gantry: "town_gantry", exits_gantry: "exits_gantry" });

export const X = { exits: [] };
export const TAPER0 = -180, RAMP0 = -60, RAMP1 = 170;
/** Where the ramp's branches part (u = s − exit.s), and where a branch commits her to its town. */
export const PART = 55, COMMIT = 55, OUTER1 = 104, GANTRY = -110;
const SPREAD = 0.0025;
/** The (inner) ramp's centre line (metres right of the highway's centre) at s − E. */
export const rampD = u => 8.75 + 0.0011 * Math.max(0, u - RAMP0) ** 2;
/** The outer branch (the second town) peels further right after the split at u = 0. */
export const outerD = u => rampD(u) + SPREAD * Math.max(0, u) ** 2;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
/** The decel lane's outer edge (it tapers out from the highway's edge line). */
export const taperEdge = u => 7 + 4.05 * smooth((u - TAPER0) / (RAMP0 - TAPER0));
const HALF = 2.3;

/** The advance signs (u = s − exit.s, metres) — before the gantry and the decel lane. */
const SIGN_MILE = -1450, SIGN_HALF = -880, SIGN_LAST = -470;
/** The stretch an exit's signs → ramps cover (for other planners: rest areas keep out of it). */
export const SPAN = { a: SIGN_MILE - 40, b: RAMP1 + 60 };

/** Is a stretch [a, b] on the right side reserved by something big (the coast's ocean, a family's yard, a rest area)? */
export function reservedRight(a, b, dMin = 9, dMax = 60) {
    const w = ctx.world;
    if (!w || !w.reserved) return false;
    return w.reserved.some(r => r.side !== -1 && r.s1 > a && r.s0 < b && r.dMax > dMin && r.dMin < dMax && r.dMax - r.dMin > 12);
}
/** Is a sign spot taken (another set piece's reserve right there)? */
function signBusy(s) { const w = ctx.world; return !(ctx.party && ctx.party.active) && !!w && w.isReserved && (w.isReserved(s, 10.6, 6) || w.isReserved(s, 14, 6)); }

/** Slide an exit forward until its signs, decel lane and ramps keep clear of every pull-in place
 *  (features/world's ctx.places: Gas 'n' Go, the Lookout, the family's driveways…), every rest area
 *  (features/exits) and big reserved stretches (the coast's ocean). */
function clearOfPlaces(s) {
    const P = ctx.places;
    let busy = [];
    try { if (P && P.list && P.at) for (const p of P.list()) busy = busy.concat(P.at(p.id) || []); } catch (e) { busy = []; }
    const spans = () => { try { return ctx.exits && ctx.exits.spans ? ctx.exits.spans() : []; } catch (e) { return []; } };
    // (a 🎉 party plans from fixed data only — the places — so every friend's exits land on the same metre)
    const party = !!(ctx.party && ctx.party.active);
    for (let k = 0; k < 60; k++) {
        const a = s + SPAN.a, b = s + SPAN.b;
        const clash = busy.some(x => x > s - 760 && x < s + RAMP1 + 220) ||
            (!party && spans().some(o => o.b > a && o.a < b)) ||
            (!party && reservedRight(s + TAPER0 - 30, s + RAMP1 + 30));
        if (!clash) return s;
        s += 250;
    }
    return s;
}

/**
 * Plan an exit at s (slid clear first) for these towns: one → a plain exit with its own signs;
 * two → the interchange (the inner branch is towns[0]). Returns the exit or null.
 */
export function planExit(s, towns) {
    const w = ctx.world;
    towns = (Array.isArray(towns) ? towns : [towns]).filter(Boolean);
    if (!w || !towns.length) return null;
    s = clearOfPlaces(s);
    if (X.exits.some(e => Math.abs(e.s - s) < 50)) return null;
    const res = [];
    const reserve = (a, b, side, d0, d1) => { w.reserve(a, b, side, d0, d1); res.push(w.reserved[w.reserved.length - 1]); };
    const two = towns.length > 1;
    reserve(s + TAPER0 - 30, s + RAMP1 + 30, 1, 7.2, two ? 100 : 95);
    reserve(s + GANTRY - 12, s + GANTRY + 12, 1, 7.2, 16);
    const T0 = towns[0], S0 = T0.lines.SIGNS, IS = INTERCHANGE.signs;
    const fill = lines => lines.map(l => fillLine(l, towns));
    const signs = [];
    const add = (u, def) => {
        let at = s + u;
        for (let k = 0; k < 4 && signBusy(at); k++) at += 70;
        reserve(at - 20, at + 20, 1, 9, 13);
        signs.push(Object.assign({ s: at, d: 10.6, bg: "#1f7a46" }, def));
    };
    if (two) {
        add(SIGN_MILE, { lines: fill(IS.mile), w: 4.8, h: 2.6, tw: 512, th: 280 });
        add(SIGN_HALF, { lines: fill(IS.half), w: 4.8, h: 2.6, tw: 512, th: 280 });
        add(SIGN_LAST, { lines: IS.lastChance, w: 4.4, h: 2.4, tw: 512, th: 280 });
        signs.push({ s: s + RAMP0 + 4, d: 13.4, lines: fill(IS.gore), bg: "#1f7a46", w: 2.6, h: 1.4 });
        // the split: one board at the fork, then each town's own funny copy beside its branch
        signs.push({ s: s + 16, d: outerD(16) + HALF + 3.2, lines: fill(IS.split), bg: "#1f7a46", w: 3.6, h: 1.8, tw: 512, th: 256 });
        signs.push({ s: s + 62, d: rampD(62) - HALF - 2.6, lines: S0.lastChance, bg: "#1f7a46", w: 3.0, h: 1.7, tw: 512, th: 280 });
        const S1 = towns[1].lines.SIGNS;
        signs.push({ s: s + 62, d: outerD(62) + HALF + 2.6, lines: S1.lastChance, bg: "#1f7a46", w: 3.0, h: 1.7, tw: 512, th: 280 });
    } else {
        add(-700, { lines: S0.advance, w: 4.6, h: 2.5, tw: 512, th: 280 });
        add(SIGN_LAST, { lines: S0.lastChance, w: 4.2, h: 2.3, tw: 512, th: 280 });
        signs.push({ s: s + RAMP0 + 4, d: 13.4, lines: S0.gore, bg: "#1f7a46", w: 2.6, h: 1.4 });
    }
    for (const sg of signs) w.addSign(sg);
    const branches = towns.slice(0, 2).map((town, k) => ({ town, k, dOf: k ? outerD : rampD, end: k ? OUTER1 : RAMP1 }));
    const e = { s, town: T0, towns, branches, two, res, signs, used: 0 };
    X.exits.push(e);
    X.exits.sort((a, b) => a.s - b.s);
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
/** The exit whose ramps are at highway distance s (or null). */
export function exitAt(s) { return X.exits.find(e => s > e.s + TAPER0 - 20 && s < e.s + RAMP1 + 40) || null; }

/**
 * Where the car is relative to exit e: { phase: null | "decel" | "ramp" | "branch", branch: k | null, u }.
 *   decel  — in the deceleration lane (she can still drift back into the right lane)
 *   ramp   — on the shared ramp before the split (back across the painted gore is still possible)
 *   branch — clearly on branch k past COMMIT: that town it is
 */
export function rampPhase(e, s, d, out = {}) {
    const u = s - e.s;
    out.u = u; out.phase = null; out.branch = null;
    if (u < TAPER0 || u > RAMP1 + 10 || d < 6.6) return out;
    if (u >= COMMIT) {
        for (const b of e.branches) {
            if (u > b.end) continue;
            if (Math.abs(d - b.dOf(u)) < HALF + 0.9) { out.phase = "branch"; out.branch = b.k; return out; }
        }
        return out;
    }
    if (u < RAMP0 + 6) { if (d > 7.35 && d < taperEdge(u) + 1.2) out.phase = "decel"; return out; }
    const lo = rampD(u) - HALF - 0.6, hi = (e.two ? outerD(u) : rampD(u)) + HALF + 0.6;
    if (d > lo && d < hi) out.phase = "ramp";
    else if (d > 7.35 && d < lo && u < RAMP0 + 70) out.phase = "decel";      // on the painted gore: still deciding
    return out;
}
/** Is the car on a branch, far enough along to commit? → the branch index, or −1. */
export function onRamp(e, s, d) { const r = rampPhase(e, s, d); return r.phase === "branch" ? r.branch : -1; }

// the ramps are road, not grass (core's paved registry: no grass drag, no shoulder rumble)
paved.push((s, d) => {
    if (d < 6.5 || !X.exits.length || (ctx.town && ctx.town.active)) return 0;
    const e = exitAt(s);
    if (!e) return 0;
    const u = s - e.s;
    if (u >= TAPER0 && u <= RAMP0 + 2 && d <= taperEdge(u) + 0.3) return 2;
    if (u < RAMP0 - 2) return 0;
    if (u <= RAMP0 + 72 && d <= rampD(u) - HALF + 0.2) return 2;                 // the painted gore
    for (const b of e.branches) if (u <= b.end && Math.abs(d - b.dOf(u)) <= HALF + 0.3) return 2;
    if (e.two && u <= PART && d >= rampD(u) && d <= outerD(u)) return 2;         // the shared ramp, widening to the split
    return 0;
});

// ── geometry ─────────────────────────────────────────────────────────────
let rampMat = null, goreMat = null, dashMat = null;
function mats() {
    if (rampMat) return rampMat;
    const tex = canvasTex(128, 256, (g, w, h) => {
        g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 1600; i++) { g.fillStyle = ["#676b73", "#53575e", "#70747c"][i % 3]; g.fillRect(Math.random() * w, Math.random() * h, 1.6, 1.6); }
        g.fillStyle = "#f4f4f0"; g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h);
    });
    rampMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    goreMat = new THREE.MeshStandardMaterial({ map: goreTex(), roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    // the wide dashed "exit only" line between the right lane and the decel lane (2 m dash / 4 m gap)
    const dt = canvasTex(8, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, w, h / 3); });
    dashMat = new THREE.MeshStandardMaterial({ map: dt, roughness: 0.7, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
    return rampMat;
}
/** The gore: white with chevrons, so "not a lane" reads at speed. */
function goreTex() {
    return canvasTex(64, 128, (g, w, h) => {
        g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#f4f4f0"; g.lineWidth = 7;
        g.beginPath(); g.moveTo(0, h * 0.75); g.lineTo(w / 2, h * 0.25); g.lineTo(w, h * 0.75); g.stroke();
        g.fillStyle = "#f4f4f0"; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
    });
}
/** A strip between d0(s) and d1(s) along the highway, s ∈ [a, b]. */
export function strip(road, a, b, d0, d1, y, vScale = 12, uAcross = true) {
    const n = Math.max(2, Math.round((b - a) / 2) + 1), p = {};
    const pos = [], uv = [], nor = [], idx = [];
    for (let k = 0; k < n; k++) {
        const s = a + (b - a) * k / (n - 1);
        road.point(s, d0(s), p); pos.push(p.x, y, p.z);
        road.point(s, d1(s), p); pos.push(p.x, y, p.z);
        if (uAcross) uv.push(0, s / vScale, 1, s / vScale);
        else { const wd = Math.abs(d1(s) - d0(s)); uv.push(0, s / vScale, wd / vScale, s / vScale); }
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

/** A board's face: green, a white border, the lines; `yellow` = a yellow EXIT ONLY strip along the bottom. */
function boardTex(lines, w, h, yellow = null) {
    return canvasTex(w, h, g => {
        g.fillStyle = "#1f7a46"; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 22); g.fill();
        g.strokeStyle = "#fff"; g.lineWidth = 7; g.beginPath(); g.roundRect(14, 14, w - 28, h - 28, 16); g.stroke();
        let body = h - 36;
        if (yellow) {
            const yh = h * 0.24;
            g.fillStyle = "#FFD600"; g.fillRect(20, h - 20 - yh, w - 40, yh);
            g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle";
            g.font = `800 ${Math.round(yh * 0.66)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(yellow, w / 2, h - 20 - yh / 2, w - 70);
            body -= yh + 4;
        }
        g.fillStyle = "#fff"; g.textAlign = "center"; g.textBaseline = "middle";
        const n = lines.length;
        lines.forEach((line, i) => {
            const size = (i === 0 ? 0.36 : 0.27) * body / Math.max(1.4, n * 0.72);
            g.font = `700 ${Math.round(size)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(line, w / 2, 22 + body * (i + 0.5) / n + 4, w - 60);
        });
    }, false);
}

function addGantry(chunk, world, e) {
    const road = world.highway, gs = e.s + GANTRY;
    const nu = models.exits_gantry;
    if (nu) {
        // the interchange gantry: post beyond the decel lane, an arm across the whole carriageway;
        // the EXIT ONLY board over the decel lane, ↑ THRU TRAFFIC over the through lanes
        const p = road.point(gs, 13.4, {});
        const g = nu.clone(true);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.h + Math.PI;              // the boards face us; the arm (model −X) reaches LEFT over our lanes
        g.updateMatrixWorld(true);
        const IS = INTERCHANGE.signs, S0 = e.town.lines.SIGNS;
        const ex = e.two ? IS.exitOnly.slice(0, 2).map(l => fillLine(l, e.towns)) : [`EXIT ${e.town.highway.no || ""} ↘`, e.town.highway.label || e.town.name.toUpperCase()];
        const faces = [["Anchor_exit", boardTex(ex, 512, 300, "EXIT ONLY"), 4.1, 2.4], ["Anchor_thru", boardTex(e.two ? IS.thru : [IS.thru[0], IS.thru[1], (S0.gantry && S0.gantry[1]) || IS.thru[2]], 640, 300), 6.0, 2.8]];
        for (const [name, tex, w, h] of faces) {
            const a = findNodes(g, name)[0];
            if (!a) continue;
            const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.08 });
            const q = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
            a.getWorldPosition(q.position);
            q.position.x -= Math.sin(p.h) * 0.02; q.position.z -= Math.cos(p.h) * 0.02;
            q.rotation.y = p.h + Math.PI;
            chunk.add(q);
            chunk.own(q.geometry); chunk.own(mat); chunk.own(tex);
        }
        chunk.add(g);
        chunk.addCollider({ x: p.x, z: p.z, r: 0.45, kind: "sign" });
        return;
    }
    if (!models.town_gantry) return;
    const p = road.point(gs, 9.6, {});
    const g = models.town_gantry.clone(true);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.h + Math.PI;
    g.scale.x = -1;
    g.updateMatrixWorld(true);
    const anchor = findNodes(g, "Anchor_sign")[0];
    if (anchor) {
        const lines = e.two ? INTERCHANGE.signs.exitOnly.map(l => fillLine(l, e.towns)) : e.town.lines.SIGNS.gantry;
        const mat = new THREE.MeshStandardMaterial({ map: signTexture(lines, "#1f7a46", "#ffffff", 768, 340), roughness: 0.6 });
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

on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (world.district) return;
    for (const e of X.exits) {
        const a = Math.max(s0, e.s + TAPER0), b = Math.min(s1, e.s + RAMP1);
        const road = world.highway;
        mats();
        if (a < b) {
            const E = e.s;
            // the deceleration lane widens out of the right lane (a dashed line keeps the lane going straight)
            const ta = Math.max(a, E + TAPER0), tb = Math.min(b, E + RAMP0);
            if (ta < tb) chunk.addMesh(strip(road, ta, tb, () => 6.9, s => taperEdge(s - E), 0.033, 12), rampMat);
            const la = Math.max(a, E + TAPER0 + 30), lb = Math.min(b, E + RAMP0 + 8);
            if (la < lb) chunk.addMesh(strip(road, la, lb, () => 6.84, () => 7.16, 0.037, 6), dashMat);
            const ra = Math.max(a, E + RAMP0);
            if (ra < b) {
                // the ramp (inner branch) — and, at an interchange, the shared stretch widening to the split + the outer branch
                chunk.addMesh(strip(road, ra, b, s => rampD(s - E) - HALF, s => rampD(s - E) + HALF, 0.034, 12), rampMat);
                if (e.two) {
                    const wa = Math.max(ra, E), wb = Math.min(b, E + PART);
                    if (wa < wb) chunk.addMesh(strip(road, wa, wb, s => rampD(s - E) + HALF - 0.3, s => outerD(s - E) + HALF, 0.0345, 12), rampMat);
                    const oa = Math.max(ra, E + PART - 2), ob = Math.min(b, E + OUTER1);
                    if (oa < ob) chunk.addMesh(strip(road, oa, ob, s => outerD(s - E) - HALF, s => outerD(s - E) + HALF, 0.034, 12), rampMat);
                    // the second gore, between the branches
                    const sa = Math.max(ra, E + 44), sb = Math.min(b, E + 82);
                    if (sa < sb) chunk.addMesh(strip(road, sa, sb, s => rampD(s - E) + HALF, s => Math.max(rampD(s - E) + HALF + 0.05, outerD(s - E) - HALF), 0.036, 5), goreMat);
                }
                // the painted gore between the highway's edge line and the ramp
                const ga = Math.max(ra, E + RAMP0 + 8), gb = Math.min(b, E + RAMP0 + 70);
                if (ga < gb) chunk.addMesh(strip(road, ga, gb, () => 7.0, s => Math.max(7.05, rampD(s - E) - HALF), 0.036, 5), goreMat);
            }
        }
        const gs = e.s + GANTRY;
        if (gs >= s0 && gs < s1) addGantry(chunk, world, e);
    }
});

// load the gantries early (they're tiny), so the first exit has one
on("boot", () => { ensureModels(["exits_gantry"]).catch(() => ensureModels(["town_gantry"]).catch(() => {})); });
export { worldMaterials };
