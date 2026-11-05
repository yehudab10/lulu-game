// Main Street: little blocks of storefronts along the road (the 2D game's
// city zones) — THE THIRSTY SCHOLAR bar, the cheder, the clinic, PRECINCT 18½
// and, near the coast, the beach boardwalk gate. Each has a real 3D door Lulu
// can walk up to on foot; the interiors feature builds the insides
// (ctx.interiors[id].enter). A paved sidewalk, street lamps, benches and
// planters make the block read as "town" while you drive past too.
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { models, registerModels, ensureModels, findNodes, instanced } from "../../models.js";
import { ribbon, facingRoad, canvasTex, mulberry32 } from "../../world.js";

export const SHOP_MODELS = { foot_bar: "foot_bar", foot_school: "foot_school", foot_hospital: "foot_hospital",
    foot_police: "foot_police", foot_beach: "foot_beach", foot_lamp: "foot_lamp", foot_bench: "foot_bench", foot_planter: "foot_planter" };
registerModels(SHOP_MODELS);

// footprint along the road (w) and depth from the facade (d), metres
export const SHOPS = {
    bar:      { model: "foot_bar", w: 9.0, d: 7.0, sign: ["THE THIRSTY SCHOLAR"], bg: "#13361A", fg: "#F2C94C", sw: 7.8, sh: 0.62, closed: [-0.68, 1.5] },
    school:   { model: "foot_school", w: 12.0, d: 8.0, sign: ["CHEDER"], bg: "#1E5AA8", fg: "#FFFFFF", sw: 2.8, sh: 0.44, closed: [-1.62, 1.9] },
    hospital: { model: "foot_hospital", w: 11.0, d: 8.0, sign: ["CLINIC  ·  ER"], bg: "#00897B", fg: "#FFFFFF", sw: 4.3, sh: 0.44, closed: [-0.8, 1.4] },
    police:   { model: "foot_police", w: 11.0, d: 8.0, sign: ["PRECINCT 18½"], bg: "#1A237E", fg: "#FFFFFF", sw: 3.4, sh: 0.48, closed: [-2.0, 2.06] },
    beach:    { model: "foot_beach", w: 8.0, d: 4.0, sign: ["PUBLIC BEACH"], bg: "#0097A7", fg: "#FFFFFF", sw: 3.0, sh: 0.6, closed: [-0.9, 2.2] },
};
const KINDS = ["bar", "school", "hospital", "police"];
const FACADE = 12.3;        // |d| of the shop fronts (sidewalk runs 8.85 → 12.3)
const WALK0 = 8.85;

let modelsReady = false;
let blocks = [];
const mine = new Set();     // our world.reserve() entries (so we only dodge OTHER features' set pieces)
const doorsByChunk = new Map();

export function streetReady() { return modelsReady; }

/** Every door currently built in the world: {id, x, z, s, d, side, h, obj, closed}. */
export function allDoors() {
    const out = [];
    for (const list of doorsByChunk.values()) out.push(...list);
    return out;
}

function nearBeach(s, world) {
    const b = world.biomeAt(s);
    if (b && /beach|coast|shore|sea|ocean|boardwalk/i.test(b.name || "")) return true;
    return s > 7600 && s < 10600;   // the 2D beach stop is 103,000 px ≈ 8,800 m
}

on("boot", () => {
    const world = ctx.world;
    // Load the storefront models right away (not blocking boot): the first block
    // is far enough down the road that they're ready long before it's built.
    ensureModels(Object.keys(SHOP_MODELS)).then(() => { modelsReady = true; }).catch(e => console.error("[foot] shop models", e));
    const rnd = mulberry32(5150);
    let s = 1050;
    for (let k = 0; k < 140 && s < 120000; k++) {
        const side = rnd() < 0.55 ? 1 : -1;
        const kinds = [];
        const n = 2 + (rnd() < 0.5 ? 1 : 0);
        for (let i = 0; i < n; i++) kinds.push(KINDS[(k + i) % KINDS.length]);
        if (nearBeach(s, world) || (s > 6000 && k % 3 === 0)) kinds[n - 1] = "beach";
        const shops = [];
        let cur = s + 6;
        for (const kind of kinds) {
            const def = SHOPS[kind];
            shops.push({ kind, s: cur + def.w / 2, def });
            cur += def.w + 3.5;
        }
        const b = { k, s0: s - 8, s1: cur + 6, side, shops, ok: null };
        world.reserve(b.s0 - 4, b.s1 + 4, side, WALK0 - 0.2, 34);
        mine.add(world.reserved[world.reserved.length - 1]);
        blocks.push(b);
        s = cur + 420 + rnd() * 380;
    }
});

/** Does another feature reserve this stretch (a journey stop, a toll plaza…)? Then skip the block. */
function blockFree(b, world) {
    if (b.ok !== null) return b.ok;
    b.ok = true;
    for (const r of world.reserved) {
        if (mine.has(r)) continue;
        if (r.s1 < b.s0 - 10 || r.s0 > b.s1 + 10) continue;
        if (r.side && r.side !== b.side) continue;
        if (r.dMax < WALK0 - 1 || r.dMin > 36) continue;
        b.ok = false;
        break;
    }
    return b.ok;
}

// ── shared materials / textures ─────────────────────────────────────────
let MATS = null;
function mats() {
    if (MATS) return MATS;
    const paving = canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#c9c4b8"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
            const v = 196 + ((i * 7 + j * 13) % 5) * 6;
            g.fillStyle = `rgb(${v},${v - 4},${v - 14})`;
            g.fillRect(i * 128 + 3, j * 128 + 3, 122, 122);
        }
        g.fillStyle = "rgba(0,0,0,0.05)";
        for (let n = 0; n < 220; n++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    });
    const walk = new THREE.MeshStandardMaterial({ map: paving, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const curb = new THREE.MeshStandardMaterial({ color: "#e4e0d6", roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    MATS = { walk, curb };
    return MATS;
}

const signCache = new Map();
function signMaterial(lines, bg, fg) {
    const key = lines.join("|") + bg + fg;
    if (signCache.has(key)) return signCache.get(key);
    const tex = canvasTex(1024, 128, (g, w, h) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.strokeStyle = fg; g.globalAlpha = 0.5; g.lineWidth = 5; g.strokeRect(10, 10, w - 20, h - 20); g.globalAlpha = 1;
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 ${Math.round(h * 0.56)}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        g.fillText(lines[0], w / 2, h * 0.54, w - 60);
    }, false);
    const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    signCache.set(key, m);
    return m;
}
const closedMat = () => signMaterial(["CLOSED — BACK SOON"], "#B71C1C", "#FFFFFF");
const _p = {}, _v = new THREE.Vector3();

// ── building the blocks into the road chunks ────────────────────────────
on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (!modelsReady) return;
    const road = world.road;
    const doors = [];
    for (const b of blocks) {
        if (b.s1 < s0 || b.s0 >= s1) continue;
        if (!blockFree(b, world)) continue;
        const side = b.side;
        const a = Math.max(b.s0, s0), z = Math.min(b.s1, s1);
        if (z - a > 2) {
            const M = mats();
            const d0 = side > 0 ? WALK0 : -FACADE - 0.6, d1 = side > 0 ? FACADE + 0.6 : -WALK0;
            chunk.addMesh(ribbon(road, a, z, d0, d1, 0.05, 2.6), M.walk);
            const c0 = side > 0 ? WALK0 - 0.05 : -WALK0 - 0.3, c1 = side > 0 ? WALK0 + 0.3 : -WALK0 + 0.05;
            chunk.addMesh(ribbon(road, a, z, c0, c1, 0.08, 4), M.curb);
        }
        // lamps / benches / planters along the curb (instanced per chunk)
        const furniture = { foot_lamp: [], foot_bench: [], foot_planter: [] };
        let i = 0;
        for (let s = b.s0 + 3; s < b.s1; s += 9, i++) {
            if (s < s0 || s >= s1) continue;
            const key = i % 2 === 0 ? "foot_lamp" : (i % 4 === 1 ? "foot_bench" : "foot_planter");
            const d = side * (key === "foot_lamp" ? 9.35 : key === "foot_bench" ? 11.2 : 9.7);
            road.point(s, d, _p);
            const h = road.at(s).h;
            furniture[key].push({ x: _p.x, z: _p.z, rot: key === "foot_bench" ? facingRoad(h, side) : (key === "foot_lamp" ? facingRoad(h, -side) + Math.PI : facingRoad(h, side) + Math.PI / 2) });
            chunk.addCollider({ x: _p.x, z: _p.z, r: key === "foot_lamp" ? 0.18 : 0.55, kind: key === "foot_lamp" ? "pole" : "bench" });
        }
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
        for (const [key, list] of Object.entries(furniture)) {
            if (!list.length || !models[key]) continue;
            const inst = instanced(models[key], list.length);
            list.forEach((f, j) => { q.setFromAxisAngle(up, f.rot); mtx.compose(_v.set(f.x, 0, f.z), q, sc); inst.set(j, mtx); });
            inst.finish();
            chunk.add(inst.group);
            chunk.own(inst);
        }
        // the storefronts themselves
        for (const shop of b.shops) {
            if (shop.s < s0 || shop.s >= s1) continue;
            const def = shop.def;
            const tpl = models[def.model];
            if (!tpl) continue;
            const obj = tpl.clone(true);
            const dc = side * (FACADE + def.d / 2);
            road.point(shop.s, dc, _p);
            const h = road.at(shop.s).h;
            obj.position.set(_p.x, 0, _p.z);
            obj.rotation.y = facingRoad(h, side);
            chunk.add(obj);
            obj.updateMatrixWorld(true);
            // name board, painted at the Anchor_sign (or "CLOSED" if nobody built the inside)
            const reg = ctx.interiors && ctx.interiors[shop.kind];
            const signNode = findNodes(obj, "Anchor_sign")[0];
            if (signNode) {
                const label = (reg && reg.sign) || def.sign;
                const plane = new THREE.Mesh(new THREE.PlaneGeometry(def.sw, def.sh), signMaterial(label, def.bg, def.fg));
                plane.position.copy(signNode.position);
                plane.position.z += 0.012;
                signNode.parent.add(plane);
                chunk.own(plane.geometry);
            }
            const doorNode = findNodes(obj, "Anchor_door")[0];
            const dp = new THREE.Vector3();
            if (doorNode) doorNode.getWorldPosition(dp); else dp.set(_p.x, 0, _p.z);
            let closedSign = null;
            if (!reg && doorNode) {
                closedSign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.19), closedMat());
                closedSign.position.set(doorNode.position.x, def.closed[1], doorNode.position.z + def.closed[0]);
                doorNode.parent.add(closedSign);
                chunk.own(closedSign.geometry);
            }
            const nd = road.nearest(dp.x, dp.z, shop.s, {});
            doors.push({ id: shop.kind, x: dp.x, z: dp.z, s: nd.s, d: nd.d, side, h, obj, closedSign, chunkK: chunk.k });
            // keep cars (and Lulu) out of the walls: circles along the building's depth line
            const r = Math.min(def.d / 2, 3.6);
            const n = Math.max(1, Math.round(def.w / (r * 1.4)));
            for (let k = 0; k < n; k++) {
                const ss = shop.s - def.w / 2 + r * 0.8 + (def.w - r * 1.6) * (n === 1 ? 0.5 : k / (n - 1));
                road.point(ss, side * (FACADE + r), _p);
                chunk.addCollider({ x: _p.x, z: _p.z, r, kind: "house" });
            }
        }
    }
    if (doors.length) doorsByChunk.set(chunk.k, doors);
});

on("chunk:dispose", ({ chunk }) => { doorsByChunk.delete(chunk.k); });

/** Light the "CLOSED" plaque off if an interior registers after the block was built. */
export function refreshDoors() {
    for (const d of allDoors()) {
        if (d.closedSign && ctx.interiors && ctx.interiors[d.id]) { d.closedSign.visible = false; }
    }
}

/** Test helper: the nearest block's first door at or after distance s (built or not). */
export function nextDoorAt(s, kind) {
    for (const b of blocks) for (const shop of b.shops) {
        if (shop.s >= s && (!kind || shop.kind === kind) && b.ok !== false) return { s: shop.s, side: b.side, kind: shop.kind };
    }
    return null;
}
