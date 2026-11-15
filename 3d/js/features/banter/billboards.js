// features/banter — funny roadside billboards, streamed with the road.
//
// A planner walks ahead of the built road and books a spot every ~400–700 m
// (world.reserve keeps trees, houses and power poles out of it; spots sit
// between the poles, and dodge every other feature's set pieces). When the
// chunk with a booked spot is built, a pooled billboard (board + trim + steel
// posts + catwalk + lamps) is hung there; when the chunk is recycled the
// billboard goes back to the pool. Faces are canvas textures painted once per
// design and kept in a small LRU. At dusk / night the board and its lamps glow.
//
// The ads follow the Story Trip leg (ctx.journey) — kugel on the way to
// Bubbe's, seagulls at the beach, Vegas buffets — and are generic in Cruise.
// Random content: only when ctx.enabled("banter") (tests force them).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, on } from "../../core/ctx.js";
import { ADS, resolve, adTexture, adById } from "./ads.js";
import { draw, nightness, chance } from "./util.js";
import { say } from "./lulu.js";
import { lookAt } from "./rig.js";

const W = 9.6, HB = 4.8, BOTTOM = 3.4;    // board size + clearance (metres)
const D_OFF = 17.5;                         // distance from the centre line
const SLANT = 0.42;                         // turned this much from "facing back down the road" toward the road
const POST_X = W * 0.3, POST_Z = -0.32;
const GAP = [420, 720];                     // metres between billboards
const POLE = 46;                            // world.js power-pole spacing (right side)

// ── shared geometry + materials ─────────────────────────────────────────────
let G = null;
function kit() {
    if (G) return G;
    const yC = BOTTOM + HB / 2;
    const board = new THREE.BoxGeometry(W, HB, 0.24);
    board.translate(0, yC, 0);
    const t = 0.17;
    const top = new THREE.BoxGeometry(W + 2 * t, t, 0.34); top.translate(0, yC + HB / 2 + t / 2, 0);
    const bot = new THREE.BoxGeometry(W + 2 * t, t, 0.34); bot.translate(0, yC - HB / 2 - t / 2, 0);
    const lft = new THREE.BoxGeometry(t, HB, 0.34); lft.translate(-W / 2 - t / 2, yC, 0);
    const rgt = new THREE.BoxGeometry(t, HB, 0.34); rgt.translate(W / 2 + t / 2, yC, 0);
    const trim = mergeGeometries([top, bot, lft, rgt]);
    const steelParts = [];
    for (const x of [-POST_X, POST_X]) {
        const post = new THREE.CylinderGeometry(0.16, 0.2, yC + 0.4, 10); post.translate(x, (yC + 0.4) / 2, POST_Z); steelParts.push(post);
        const foot = new THREE.CylinderGeometry(0.34, 0.4, 0.3, 10); foot.translate(x, 0.15, POST_Z); steelParts.push(foot);
    }
    const brace = new THREE.BoxGeometry(POST_X * 2, 0.14, 0.14); brace.translate(0, BOTTOM - 0.7, POST_Z); steelParts.push(brace);
    const walk = new THREE.BoxGeometry(W * 0.9, 0.08, 0.72); walk.translate(0, BOTTOM - 0.2, 0.3); steelParts.push(walk);
    const lampParts = [];
    for (const x of [-W * 0.32, 0, W * 0.32]) {
        const arm = new THREE.BoxGeometry(0.06, 0.06, 0.95); arm.rotateX(-0.42); arm.translate(x, yC + HB / 2 + 0.28, 0.42); steelParts.push(arm);
        const head = new THREE.BoxGeometry(0.46, 0.13, 0.26); head.rotateX(0.55); head.translate(x, yC + HB / 2 + 0.47, 0.86); lampParts.push(head);
    }
    const steel = mergeGeometries(steelParts);
    const lamps = mergeGeometries(lampParts);
    for (const gg of [top, bot, lft, rgt, ...steelParts, ...lampParts]) gg.dispose();
    G = {
        board, trim, steel, lamps,
        back: new THREE.MeshStandardMaterial({ color: "#3d4650", roughness: 0.8, metalness: 0.2 }),
        frame: new THREE.MeshStandardMaterial({ color: "#f7f3ea", roughness: 0.55 }),
        steelMat: new THREE.MeshStandardMaterial({ color: "#8b949c", roughness: 0.45, metalness: 0.6 }),
        lampMat: new THREE.MeshStandardMaterial({ color: "#fff6d8", emissive: "#ffe9a8", emissiveIntensity: 0.3, roughness: 0.4 }),
    };
    return G;
}

// ── faces: one material per design, a small LRU (each is a 1024×512 canvas) ──
const MAX_FACES = 7;
const faces = new Map();      // design key → { mat, arr, users }
let lit = -1;
function faceFor(d) {
    const K = kit();
    let e = faces.get(d.key);
    if (e) { faces.delete(d.key); faces.set(d.key, e); return e; }
    const tex = adTexture(d);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: "#ffffff", emissiveIntensity: litLevel(), roughness: 0.7 });
    e = { mat, arr: [K.back, K.back, K.back, K.back, mat, K.back], users: 0 };
    faces.set(d.key, e);
    if (faces.size > MAX_FACES) {
        for (const [k, v] of faces) {
            if (v.users > 0 || v === e) continue;
            v.mat.map.dispose(); v.mat.dispose(); faces.delete(k);
            if (faces.size <= MAX_FACES) break;
        }
    }
    return e;
}
const litLevel = () => 0.07 + Math.max(0, lit) * 0.62;

// ── the pool ───────────────────────────────────────────────────────────────
const pool = [], active = [];
export const bbState = { placed: 0, released: 0, planned: 0, get active() { return active.length; }, get pooled() { return pool.length; }, get queued() { return plan.length; }, get booked() { return mine.size; } };

function make() {
    const K = kit();
    const group = new THREE.Group();
    group.name = "BanterBillboard";
    const board = new THREE.Mesh(K.board, [K.back, K.back, K.back, K.back, K.back, K.back]);
    board.castShadow = true;
    const trim = new THREE.Mesh(K.trim, K.frame);
    const steel = new THREE.Mesh(K.steel, K.steelMat);
    steel.castShadow = true;
    const lamps = new THREE.Mesh(K.lamps, K.lampMat);
    group.add(board, trim, steel, lamps);
    return { group, board, design: null, face: null, chunk: null, s: 0, side: 1, seen: false };
}

const _p = {};
function place(chunk, s, side, design) {
    const b = pool.pop() || make();
    const d = resolve(design);
    const face = faceFor(d);
    face.users++;
    Object.assign(b, { design: d, face, chunk, s, side, seen: false });
    b.board.material = face.arr;
    const road = ctx.world.road;
    road.point(s, side * D_OFF, _p);
    const h = road.at(s).h;
    const fx = Math.sin(h), fz = Math.cos(h), tx = side * Math.cos(h), tz = -side * Math.sin(h);   // toward the road = −side × right
    const ry = Math.atan2(-fx * Math.cos(SLANT) + tx * Math.sin(SLANT), -fz * Math.cos(SLANT) + tz * Math.sin(SLANT));
    b.group.position.set(_p.x, 0, _p.z);
    b.group.rotation.set(0, ry, 0);
    chunk.add(b.group);
    b.group.updateMatrixWorld(true);
    const c = Math.cos(ry), sn = Math.sin(ry);
    for (const x of [-POST_X, POST_X]) chunk.addCollider({ x: _p.x + x * c + POST_Z * sn, z: _p.z - x * sn + POST_Z * c, r: 0.32, kind: "sign" });
    active.push(b);
    bbState.placed++;
    return b;
}
function release(b) {
    if (b.group.parent) b.group.parent.remove(b.group);
    if (b.face) b.face.users--;
    b.face = null; b.chunk = null; b.design = null;
    const i = active.indexOf(b);
    if (i >= 0) active.splice(i, 1);
    pool.push(b);
    bbState.released++;
}

// ── which ad? (the leg's theme, some generic filler, nothing seen recently) ──
const recent = [];
function pickDesign() {
    const story = ctx.G.mode === "story" && ctx.journey;
    const leg = story ? ctx.journey.stopIndex : -1;
    let list = leg >= 0 && Math.random() < 0.65 ? ADS.filter(a => a.legs && a.legs.includes(leg)) : [];
    if (!list.length) list = ADS.filter(a => a.generic);
    const fresh = list.filter(a => !recent.includes(a.id));
    const ad = draw("ads:" + leg + ":" + fresh.length, fresh.length ? fresh : list);
    recent.push(ad.id);
    while (recent.length > 8) recent.shift();
    return ad;
}

// ── the planner: book spots beyond the built road ─────────────────────────
const plan = [];              // { s, side, design, res }
const mine = new Set();       // our world.reserved entries
let nextS = 0;
function builtEnd() { let m = 0; for (const ch of ctx.world.activeChunks()) m = Math.max(m, ch.s1); return m; }
function othersReserve(s, side) {
    const w = ctx.world;
    for (const r of w.reserved) {
        if (mine.has(r)) continue;
        if (r.side && r.side !== side) continue;
        if (r.s1 < s - 14 || r.s0 > s + 14) continue;
        if (r.dMax < 9.5 || r.dMin > 28) continue;
        return true;
    }
    return false;
}
function unreserve(r) {
    mine.delete(r);
    const a = ctx.world.reserved, i = a.indexOf(r);
    if (i >= 0) a.splice(i, 1);
}
function nearTrap(s) {
    // the core's parked speed-trap cops (right side): chunks k ≡ 4 (mod 6), at s0 + 120, sign 170 m before
    const m = ((s - 920) % 1200 + 1200) % 1200;
    return m < 45 || m > 1155 || Math.abs(m - (1200 - 170)) < 30;
}
function book(s) {
    const sides = Math.random() < 0.4 ? [1, -1] : [-1, 1];   // the left has no power poles in the way
    for (const side of sides) {
        let ss = s;
        if (side > 0) {   // sit between two power poles so none goes missing
            const m = ((ss % POLE) + POLE) % POLE;
            if (m < 17) ss += 17 - m; else if (m > 29) ss += POLE - m + 17;
            if (nearTrap(ss)) continue;
        }
        if (othersReserve(ss, side)) continue;
        const w = ctx.world;
        w.reserve(ss - 10, ss + 10, side, 12.4, 27);
        const res = w.reserved[w.reserved.length - 1];
        mine.add(res);
        plan.push({ s: ss, side, design: pickDesign(), res });
        bbState.planned++;
        return true;
    }
    return false;
}
function planAhead() {
    const end = builtEnd();
    if (nextS < end + 25) nextS = end + 25 + Math.random() * 120;
    let guard = 0;
    while (nextS < end + 420 && guard++ < 4) {
        book(nextS);
        nextS += GAP[0] + Math.random() * (GAP[1] - GAP[0]);
    }
}

on("chunk:build", ({ chunk, s0, s1 }) => {
    for (let i = plan.length - 1; i >= 0; i--) {
        const p = plan[i];
        if (p.s < s0 || p.s >= s1) continue;
        plan.splice(i, 1);
        unreserve(p.res);
        if (othersReserve(p.s, p.side)) continue;      // a set piece moved in after we booked
        try { place(chunk, p.s, p.side, p.design); } catch (e) { console.error("[banter] billboard", e); }
    }
});
on("chunk:dispose", ({ chunk }) => {
    for (let i = active.length - 1; i >= 0; i--) if (active[i].chunk === chunk) release(active[i]);
});
function resetPlan() {
    for (const p of plan) unreserve(p.res);
    plan.length = 0;
    for (const r of [...mine]) unreserve(r);
    nextS = 0;
}
on("run:start", resetPlan);

// ── per frame ─────────────────────────────────────────────────────────────
/** Every driving frame (hud hook). */
export function tickBillboards(dt) {
    const n = nightness();
    if (Math.abs(n - lit) > 0.02) {
        lit = n;
        for (const e of faces.values()) e.mat.emissiveIntensity = litLevel();
        if (G) G.lampMat.emissiveIntensity = 0.3 + n * 3.4;
    }
    if (!ctx.enabled("banter") || (ctx.state !== "playing" && ctx.state !== "intro")) return;
    planAhead();
    // Lulu reads them as she goes by
    const car = ctx.car;
    for (const b of active) {
        if (b.seen) continue;
        const rel = b.s - car.s;
        if (rel > 12 && rel < 62) {
            b.seen = true;
            lookAt(b.group, 1.5);
            const r = b.design.react;
            say("billboard", {}, { line: r && r.length && chance(0.75) ? draw("react:" + b.design.key, r) : null });
        }
    }
}

/** Debug / tests: hang billboard `id` (or a random one) `ahead` metres in front of Lulu, now. */
export function forceBillboard(id = null, ahead = 60, side = 1) {
    const s = ctx.car.s + ahead;
    for (const ch of ctx.world.activeChunks()) {
        if (s >= ch.s0 && s < ch.s1) return place(ch, s, side, (id && adById(id)) || pickDesign());
    }
    return null;
}
export function billboards() { return active; }
