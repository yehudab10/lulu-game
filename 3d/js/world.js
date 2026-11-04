// The world: an endless, gently winding 4-lane country road generated in
// 200 m chunks just ahead of the car (and recycled behind it), lined with
// Blender-made trees and houses, power lines, coin trails, speed traps, road
// signs — and Bubbe's house at the end of the first leg.
import * as THREE from "three";
import { models, instanced, cloneWithColors, findNodes } from "./models.js";

export const STEP = 2;            // metres between road centre-line samples
export const LANE = 3.5;
export const HALF_ROAD = 7;       // 4 lanes
export const SHOULDER = 8.8;      // edge of the gravel shoulder
export const CHUNK = 200;         // metres per scenery chunk
const AHEAD = 640, BEHIND = 160;
export const GOAL = 4800;         // Bubbe's house (≈3 miles)

// Our lanes are on the RIGHT (positive d); oncoming traffic on the left.
export const LANES_OURS = [LANE / 2, LANE * 1.5];
export const LANES_ONCOMING = [-LANE / 2, -LANE * 1.5];

function mulberry32(a) {
    return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// ── road centre-line ───────────────────────────────────────────────────
export class Road {
    constructor(seed) {
        const r = mulberry32(seed);
        this.ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
        this.x = [0]; this.z = [0]; this.h = [0];
    }

    // The heading itself is a bounded wiggle (never more than ~65° off north),
    // so the road can never loop back over itself.
    headingFn(s) {
        const e = Math.min(1, Math.max(0, (s - 80) / 260));
        const env = e * e * (3 - 2 * e); // a straight start, then ease into the curves
        const amp = 0.62 + 0.38 * Math.sin(s / 900 + this.ph[3]);
        const p = this.ph;
        const w = 0.62 * Math.sin(s / 270 + p[0]) + 0.30 * Math.sin(s / 105 + p[1]) + 0.1 * Math.sin(s / 48 + p[2]);
        return env * amp * w;
    }

    ensure(sMax) {
        let i = this.x.length - 1;
        while (i * STEP < sMax) {
            const s = i * STEP;
            const h0 = this.h[i], h1 = this.headingFn(s + STEP);
            const hm = (h0 + h1) / 2;
            this.x.push(this.x[i] + Math.sin(hm) * STEP);
            this.z.push(this.z[i] + Math.cos(hm) * STEP);
            this.h.push(h1);
            i++;
        }
    }

    /** Centre point + heading at distance s (linear between samples). */
    at(s, out = {}) {
        this.ensure(s + STEP * 2);
        const f = Math.max(0, s / STEP);
        const i = Math.floor(f), t = f - i;
        out.x = this.x[i] + (this.x[i + 1] - this.x[i]) * t;
        out.z = this.z[i] + (this.z[i + 1] - this.z[i]) * t;
        out.h = this.h[i] + (this.h[i + 1] - this.h[i]) * t;
        return out;
    }

    /** World point at distance s, lateral offset d (positive = right of travel). */
    point(s, d, out = {}) {
        this.at(s, out);
        out.x += -Math.cos(out.h) * d;
        out.z += Math.sin(out.h) * d;
        return out;
    }

    /** Closest road position to (x, z): {s, d, h}. `hint` is a previous s. */
    nearest(x, z, hint, out = {}) {
        let i0 = Math.max(0, Math.floor(hint / STEP));
        this.ensure((i0 + 200) * STEP);
        let best = 1e18, bi = i0;
        const span = 60;
        for (let i = Math.max(0, i0 - span); i <= i0 + span; i++) {
            const dx = x - this.x[i], dz = z - this.z[i];
            const d2 = dx * dx + dz * dz;
            if (d2 < best) { best = d2; bi = i; }
        }
        const h = this.h[bi];
        const fx = Math.sin(h), fz = Math.cos(h);
        const dx = x - this.x[bi], dz = z - this.z[bi];
        const lon = dx * fx + dz * fz;
        out.s = Math.max(0, bi * STEP + lon);
        out.d = dx * -Math.cos(h) + dz * Math.sin(h);
        out.h = h;
        return out;
    }
}

// ── textures ───────────────────────────────────────────────────────────
function canvasTex(w, h, draw, repeat = true) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
}

function speckle(g, w, h, n, colors, rMax) {
    for (let i = 0; i < n; i++) {
        g.fillStyle = colors[i % colors.length];
        const r = Math.random() * rMax + 0.5;
        g.fillRect(Math.random() * w, Math.random() * h, r, r);
    }
}

const ROAD_TEX_LEN = 24; // metres of road per texture repeat
function roadTexture() {
    return canvasTex(512, 512, (g, w, h) => {
        g.fillStyle = "#5d6169"; g.fillRect(0, 0, w, h);
        speckle(g, w, h, 9000, ["#676b73", "#53575e", "#70747c", "#4c5057"], 2.2);
        // tire wear: slightly darker strips in each lane
        g.fillStyle = "rgba(40,42,48,0.10)";
        for (const u of [0.09, 0.19, 0.31, 0.43, 0.57, 0.69, 0.81, 0.91]) g.fillRect(u * w - 10, 0, 20, h);
        const px = d => (d + HALF_ROAD) / (HALF_ROAD * 2) * w;
        g.fillStyle = "#f4f4f0";
        g.fillRect(px(-6.75) - 4, 0, 8, h);       // solid white edge lines
        g.fillRect(px(6.75) - 4, 0, 8, h);
        g.fillStyle = "#ffcf33";                  // double yellow centre line
        g.fillRect(px(0) - 9, 0, 6, h);
        g.fillRect(px(0) + 3, 0, 6, h);
        g.fillStyle = "#f4f4f0";                  // dashed lane lines (3 m dash / 9 m gap)
        const dash = 3 / ROAD_TEX_LEN * h;
        for (const d of [-LANE, LANE]) {
            g.fillRect(px(d) - 3, 0, 6, dash);
            g.fillRect(px(d) - 3, h / 2, 6, dash);
        }
    });
}

function grassTexture() {
    return canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = "#79c258"; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 60; i++) {
            g.fillStyle = i % 2 ? "rgba(98,170,70,0.35)" : "rgba(150,210,110,0.3)";
            g.beginPath();
            g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 26, 0, 7);
            g.fill();
        }
        speckle(g, w, h, 2600, ["#6bb34c", "#8ad06a", "#5fa344", "#97d877"], 2.5);
    });
}

const signTexCache = new Map();
function signTexture(lines, bg = "#1f7a46", fg = "#ffffff", w = 512, h = 256) {
    const key = lines.join("|") + bg + fg + w + h;
    if (signTexCache.has(key)) return signTexCache.get(key);
    const t = canvasTex(w, h, (g) => {
        g.fillStyle = bg;
        g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill();
        g.strokeStyle = fg; g.lineWidth = 8;
        g.beginPath(); g.roundRect(16, 16, w - 32, h - 32, 18); g.stroke();
        g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        const n = lines.length;
        lines.forEach((line, i) => {
            const size = i === 0 && n > 1 ? h * 0.26 : h * (n > 1 ? 0.22 : 0.36);
            g.font = `700 ${size}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
            g.fillText(line, w / 2, h * (n === 1 ? 0.52 : 0.34 + i * (0.36 / Math.max(1, n - 1)) * (n > 2 ? 1 : 0.95)), w - 50);
        });
    }, false);
    signTexCache.set(key, t);
    return t;
}

// ── shared materials / geometry ────────────────────────────────────────
let MAT = null;
function materials() {
    if (MAT) return MAT;
    const road = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.92 });
    road.polygonOffset = true; road.polygonOffsetFactor = -2; road.polygonOffsetUnits = -2;
    const shoulder = new THREE.MeshStandardMaterial({ color: "#c4b394", roughness: 1 });
    shoulder.polygonOffset = true; shoulder.polygonOffsetFactor = -1; shoulder.polygonOffsetUnits = -1;
    MAT = {
        road, shoulder,
        drive: new THREE.MeshStandardMaterial({ color: "#a9a49a", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
        pole: new THREE.MeshStandardMaterial({ color: "#8a6a4a", roughness: 0.9 }),
        metal: new THREE.MeshStandardMaterial({ color: "#9aa3ab", roughness: 0.5, metalness: 0.6 }),
        wire: new THREE.LineBasicMaterial({ color: "#3a3a3a", transparent: true, opacity: 0.55 }),
        coin: new THREE.MeshStandardMaterial({ color: "#ffc61a", emissive: "#b8860b", emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.75 }),
        heart: new THREE.MeshStandardMaterial({ color: "#ff3d7f", emissive: "#c2185b", emissiveIntensity: 0.6, roughness: 0.35 }),
    };
    return MAT;
}

let GEO = null;
function geometry() {
    if (GEO) return GEO;
    const coin = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 20);
    coin.rotateX(Math.PI / 2); // face along Z, so spinning about Y shows its face
    const pole = new THREE.CylinderGeometry(0.13, 0.17, 8.2, 7);
    pole.translate(0, 4.1, 0);
    const bar = new THREE.BoxGeometry(2.4, 0.14, 0.14);
    bar.translate(0, 7.6, 0);
    // a puffy heart (two spheres + a cone)
    const heartParts = [new THREE.SphereGeometry(0.33, 14, 10), new THREE.SphereGeometry(0.33, 14, 10), new THREE.ConeGeometry(0.47, 0.75, 14)];
    heartParts[0].translate(-0.24, 0.16, 0); heartParts[1].translate(0.24, 0.16, 0);
    heartParts[2].rotateZ(Math.PI); heartParts[2].translate(0, -0.3, 0);
    GEO = { coin, pole, bar, heartParts, post: new THREE.CylinderGeometry(0.09, 0.09, 1, 8) };
    return GEO;
}

// ── chunk building ─────────────────────────────────────────────────────
function ribbon(road, s0, s1, d0, d1, y, vScale) {
    const n = Math.round((s1 - s0) / STEP) + 1;
    const pos = new Float32Array(n * 2 * 3), uv = new Float32Array(n * 2 * 2), nor = new Float32Array(n * 2 * 3);
    const idx = [];
    const p = {};
    for (let k = 0; k < n; k++) {
        const s = s0 + k * STEP;
        road.point(s, d0, p);
        pos.set([p.x, y, p.z], k * 6);
        road.point(s, d1, p);
        pos.set([p.x, y, p.z], k * 6 + 3);
        uv.set([0, s / vScale, 1, s / vScale], k * 4);
        nor.set([0, 1, 0, 0, 1, 0], k * 6);
        if (k < n - 1) {
            const a = k * 2, b = a + 1, c = a + 2, d = a + 3;
            idx.push(a, b, c, b, d, c);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}

function facingRoad(h, side) {
    // rotation.y so a model whose front is +Z faces the road from `side`
    return side > 0 ? Math.atan2(Math.cos(h), -Math.sin(h)) : Math.atan2(-Math.cos(h), Math.sin(h));
}

const WALLS = ["#FFE0B2", "#FFF3E0", "#E3F2FD", "#F8BBD0", "#DCEDC8", "#FFF9C4", "#E1BEE7", "#D7CCC8"];
const ROOFS = ["#C0504D", "#5D6D7E", "#8D6E63", "#3E6B4F", "#455A8C", "#A0522D"];

class Chunk {
    constructor(world, k) {
        this.k = k;
        this.s0 = k * CHUNK;
        this.s1 = this.s0 + CHUNK;
        this.group = new THREE.Group();
        this.colliders = [];
        this.coins = [];
        this.hearts = [];
        this.traps = [];
        this.disposables = [];
        this.anim = [];
        this.build(world);
        world.scene.add(this.group);
    }

    addMesh(geo, mat, { cast = false, receive = true } = {}) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = cast; m.receiveShadow = receive;
        this.group.add(m);
        this.disposables.push(geo);
        return m;
    }

    tooCloseToRoad(road, x, z, s, minD) {
        const tmp = {};
        for (let ss = Math.max(0, s - 140); ss <= s + 140; ss += 10) {
            road.at(ss, tmp);
            const dx = x - tmp.x, dz = z - tmp.z;
            if (dx * dx + dz * dz < minD * minD) return true;
        }
        return false;
    }

    build(world) {
        const { road } = world;
        const M = materials(), G = geometry();
        const rnd = mulberry32(this.k * 7919 + world.seed);
        const p = {};

        // road + shoulders
        this.addMesh(ribbon(road, this.s0, this.s1, -HALF_ROAD, HALF_ROAD, 0.03, ROAD_TEX_LEN), M.road);
        this.addMesh(ribbon(road, this.s0, this.s1, HALF_ROAD - 0.05, SHOULDER, 0.02, 10), M.shoulder);
        this.addMesh(ribbon(road, this.s0, this.s1, -SHOULDER, -HALF_ROAD + 0.05, 0.02, 10), M.shoulder);

        const nearGoal = Math.abs(this.s0 + CHUNK / 2 - GOAL) < 260;
        const nearStart = this.s0 < 120;

        // trees & bushes
        const spots = { treeRound: [], treePine: [], bush: [] };
        const dense = rnd() < 0.35;
        const count = dense ? 54 : 34;
        for (let i = 0; i < count; i++) {
            const s = this.s0 + rnd() * CHUNK;
            const side = rnd() < 0.5 ? -1 : 1;
            const d = side * (13.5 + Math.pow(rnd(), 1.5) * 80);
            road.point(s, d, p);
            if (nearGoal && side > 0 && Math.abs(s - GOAL) < 60) continue; // keep Bubbe's yard clear
            if (this.tooCloseToRoad(road, p.x, p.z, s, 12.5)) continue;
            const r = rnd();
            const type = r < 0.48 ? "treeRound" : r < 0.82 ? "treePine" : "bush";
            const scale = (type === "bush" ? 0.8 : 0.85) + rnd() * 0.6;
            spots[type].push({ x: p.x, z: p.z, rot: rnd() * 6.28, scale });
            if (type !== "bush") this.colliders.push({ x: p.x, z: p.z, r: 0.5 * scale, kind: "tree" });
        }
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        for (const type of Object.keys(spots)) {
            const list = spots[type];
            if (!list.length) continue;
            const inst = instanced(models[type], list.length, ["Leaves", "PineLeaves"]);
            const col = new THREE.Color();
            list.forEach((t, i) => {
                q.setFromAxisAngle(up, t.rot);
                mtx.compose(v.set(t.x, 0, t.z), q, sc.setScalar(t.scale));
                inst.set(i, mtx);
                const base = type === "treePine" ? "#2F8F46" : "#6CC24A";
                col.set(base).offsetHSL((rnd() - 0.5) * 0.05, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.08);
                inst.color(i, type === "treePine" ? "PineLeaves" : "Leaves", col);
            });
            inst.finish();
            this.group.add(inst.group);
            this.disposables.push(inst);
        }

        // houses (not at the very start, not in Bubbe's block)
        if (!nearStart && !nearGoal) {
            const nh = rnd() < 0.55 ? 1 + Math.floor(rnd() * 3) : 0;
            const list = [];
            for (let i = 0; i < nh; i++) {
                const s = this.s0 + 20 + rnd() * (CHUNK - 40);
                const side = rnd() < 0.5 ? -1 : 1;
                const d = side * (23 + rnd() * 10);
                road.point(s, d, p);
                if (this.tooCloseToRoad(road, p.x, p.z, s, 20)) continue;
                const tooNear = this.colliders.some(c => c.kind === "house" && Math.hypot(c.x - p.x, c.z - p.z) < 14);
                if (tooNear) continue;
                const h = road.at(s).h;
                list.push({ x: p.x, z: p.z, rot: facingRoad(h, side), walls: WALLS[Math.floor(rnd() * WALLS.length)], roof: ROOFS[Math.floor(rnd() * ROOFS.length)] });
                this.colliders.push({ x: p.x, z: p.z, r: 5.2, kind: "house" });
                // a driveway out to the road
                const drive = ribbon(road, s - 1.6, s + 1.6, side > 0 ? SHOULDER : -Math.abs(d) + 3, side > 0 ? Math.abs(d) - 3 : -SHOULDER, 0.025, 10);
                this.addMesh(drive, M.drive);
            }
            // drop trees that ended up inside a house
            if (list.length) {
                const houses = this.colliders.filter(c => c.kind === "house");
                this.colliders = this.colliders.filter(c => c.kind !== "tree" || !houses.some(hh => Math.hypot(hh.x - c.x, hh.z - c.z) < 7));
                const inst = instanced(models.house, list.length, ["Walls", "Roof"]);
                const col = new THREE.Color();
                list.forEach((hh, i) => {
                    q.setFromAxisAngle(up, hh.rot);
                    mtx.compose(v.set(hh.x, 0, hh.z), q, sc.setScalar(1));
                    inst.set(i, mtx);
                    inst.color(i, "Walls", col.set(hh.walls));
                    inst.color(i, "Roof", col.set(hh.roof));
                });
                inst.finish();
                this.group.add(inst.group);
                this.disposables.push(inst);
            }
        }

        // power poles + wires on the right
        const POLE_GAP = 46;
        const poles = [];
        for (let s = Math.ceil(this.s0 / POLE_GAP) * POLE_GAP; s < this.s1; s += POLE_GAP) {
            if (nearGoal && Math.abs(s - GOAL) < 40) continue;
            poles.push(s);
        }
        if (poles.length) {
            const pm = new THREE.InstancedMesh(G.pole, M.pole, poles.length);
            const bm = new THREE.InstancedMesh(G.bar, M.pole, poles.length);
            pm.castShadow = bm.castShadow = true;
            const wirePts = [];
            poles.forEach((s, i) => {
                const a = road.point(s, 11.5, {});
                q.setFromAxisAngle(up, a.h);
                mtx.compose(v.set(a.x, 0, a.z), q, sc.setScalar(1));
                pm.setMatrixAt(i, mtx); bm.setMatrixAt(i, mtx);
                this.colliders.push({ x: a.x, z: a.z, r: 0.25, kind: "pole" });
                // wires to the next pole (sagging)
                const b = road.point(s + POLE_GAP, 11.5, {});
                for (const off of [-1.1, 0, 1.1]) {
                    const ax = a.x - Math.cos(a.h) * off, az = a.z + Math.sin(a.h) * off;
                    const bx = b.x - Math.cos(b.h) * off, bz = b.z + Math.sin(b.h) * off;
                    const SEG = 6;
                    for (let k = 0; k < SEG; k++) {
                        const t0 = k / SEG, t1 = (k + 1) / SEG;
                        const sag = t => 7.7 - Math.sin(t * Math.PI) * 0.9;
                        wirePts.push(ax + (bx - ax) * t0, sag(t0), az + (bz - az) * t0, ax + (bx - ax) * t1, sag(t1), az + (bz - az) * t1);
                    }
                }
            });
            pm.computeBoundingSphere(); bm.computeBoundingSphere();
            this.group.add(pm, bm);
            this.disposables.push(pm, bm);
            const wg = new THREE.BufferGeometry();
            wg.setAttribute("position", new THREE.Float32BufferAttribute(wirePts, 3));
            const wires = new THREE.LineSegments(wg, M.wire);
            this.group.add(wires);
            this.disposables.push(wg);
        }

        // coin trails
        if (!nearStart) {
            const trails = 1 + (rnd() < 0.6 ? 1 : 0);
            for (let t = 0; t < trails; t++) {
                const start = this.s0 + 15 + rnd() * (CHUNK - 90);
                const risky = rnd() < 0.22;
                const lanes = risky ? LANES_ONCOMING : LANES_OURS;
                const pattern = rnd();
                const lane = lanes[Math.floor(rnd() * 2)];
                for (let i = 0; i < 8; i++) {
                    const s = start + i * 8;
                    let d = lane;
                    if (pattern < 0.3) d = (risky ? -1 : 1) * (LANE + Math.sin(i / 7 * Math.PI * 2) * LANE * 0.9); // slalom
                    road.point(s, d, p);
                    this.coins.push({ x: p.x, z: p.z, s, d, taken: false, value: risky ? 2 : 1 });
                }
            }
            // rare heart pickup (only matters if you've lost one)
            if (rnd() < 0.12) {
                const s = this.s0 + 40 + rnd() * 120;
                const d = LANES_OURS[Math.floor(rnd() * 2)];
                road.point(s, d, p);
                this.hearts.push({ x: p.x, z: p.z, s, taken: false });
            }
        }
        if (this.coins.length) {
            this.coinMesh = new THREE.InstancedMesh(G.coin, M.coin, this.coins.length);
            this.coinMesh.castShadow = true;
            this.group.add(this.coinMesh);
            this.disposables.push(this.coinMesh);
            this.updateCoins(0);
            this.coinMesh.computeBoundingSphere();
        }
        for (const ht of this.hearts) {
            const g = new THREE.Group();
            for (const part of G.heartParts) {
                const m = new THREE.Mesh(part, M.heart);
                m.castShadow = true;
                g.add(m);
            }
            g.position.set(ht.x, 1.3, ht.z);
            ht.obj = g;
            this.group.add(g);
        }

        // road signs at fixed distances
        for (const sign of world.signs) {
            if (sign.s >= this.s0 && sign.s < this.s1) this.addSign(world, sign);
        }

        // speed trap: a parked cop with a speed-limit sign 170 m before it
        if (this.k % 6 === 4 && !nearGoal) {
            const s = this.s0 + 120;
            this.addSign(world, { s: s - 170, d: 10.2, lines: ["SPEED", "LIMIT", "70"], bg: "#ffffff", fg: "#111111", w: 1.6, h: 2.0, tw: 256, th: 320 });
            road.point(s, 10.4, p);
            const cop = cloneWithColors(models.cop);
            cop.position.set(p.x, 0, p.z);
            cop.rotation.y = road.at(s).h + 0.12;
            this.group.add(cop);
            this.colliders.push({ x: p.x, z: p.z, r: 1.4, kind: "cop" });
            this.traps.push({ s, triggered: false, obj: cop });
        }

        // Bubbe's house + finish arch
        if (GOAL >= this.s0 && GOAL < this.s1) this.buildBubbe(world);
    }

    addSign(world, sign) {
        const M = materials(), G = geometry();
        const p = world.road.point(sign.s, sign.d, {});
        const h = world.road.at(sign.s).h;
        const w = sign.w || 4.2, ht = sign.h || 2.1;
        const g = new THREE.Group();
        g.position.set(p.x, 0, p.z);
        g.rotation.y = h + Math.PI; // board faces oncoming drivers (us)
        const tex = signTexture(sign.lines, sign.bg, sign.fg, sign.tw, sign.th);
        const board = new THREE.Mesh(new THREE.BoxGeometry(w, ht, 0.08), [
            M.metal, M.metal, M.metal, M.metal,
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), M.metal,
        ]);
        board.position.y = 2.2 + ht / 2;
        board.castShadow = true;
        g.add(board);
        for (const off of (w > 2.5 ? [-w * 0.32, w * 0.32] : [0])) {
            const post = new THREE.Mesh(G.post, M.metal);
            post.scale.y = 2.2 + ht * 0.6;
            post.position.set(off, post.scale.y / 2, 0.06);
            post.castShadow = true;
            g.add(post);
        }
        this.group.add(g);
        this.disposables.push(board.geometry);
        this.colliders.push({ x: p.x, z: p.z, r: 0.3, kind: "sign" });
    }

    buildBubbe(world) {
        const { road } = world;
        const M = materials(), G = geometry();
        const p = {};
        const h = road.at(GOAL).h;
        road.point(GOAL, 27, p);
        const house = cloneWithColors(models.bubbeHouse);
        house.position.set(p.x, 0, p.z);
        house.rotation.y = facingRoad(h, 1);
        this.group.add(house);
        this.colliders.push({ x: p.x, z: p.z, r: 6.4, kind: "house" });
        this.addMesh(ribbon(road, GOAL - 2, GOAL + 2, SHOULDER, 17, 0.025, 10), M.drive);

        // Bubbe herself, waving by the gate
        road.point(GOAL, 15.6, p);
        const bubbe = cloneWithColors(models.bubbe);
        bubbe.position.set(p.x, 0, p.z);
        bubbe.rotation.y = facingRoad(h, 1) - 0.5;
        bubbe.scale.setScalar(1.6);
        this.group.add(bubbe);
        const arm = findNodes(bubbe, "Arm_Wave")[0];
        world.bubbe = { obj: bubbe, arm, base: arm ? arm.rotation.clone() : null };

        // finish arch over the road with balloons
        const arch = new THREE.Group();
        const ap = road.at(GOAL);
        arch.position.set(ap.x, 0, ap.z);
        arch.rotation.y = h + Math.PI;
        const postGeo = new THREE.CylinderGeometry(0.22, 0.22, 7.6, 10);
        for (const s of [-1, 1]) {
            const post = new THREE.Mesh(postGeo, new THREE.MeshStandardMaterial({ color: s > 0 ? "#E91E63" : "#FFC107", roughness: 0.5 }));
            post.position.set(s * 9.6, 3.8, 0);
            post.castShadow = true;
            arch.add(post);
            const cols = ["#FF4081", "#FFD740", "#40C4FF", "#B388FF", "#69F0AE"];
            for (let b = 0; b < 5; b++) {
                const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10),
                    new THREE.MeshStandardMaterial({ color: cols[b], roughness: 0.3, emissive: cols[b], emissiveIntensity: 0.15 }));
                ball.scale.y = 1.2;
                ball.position.set(s * 9.6 + Math.cos(b * 1.3) * 0.9, 7.9 + b * 0.35, Math.sin(b * 1.3) * 0.9);
                ball.castShadow = true;
                arch.add(ball);
                this.anim.push({ obj: ball, base: ball.position.y, ph: b + s });
            }
        }
        this.disposables.push(postGeo);
        const banner = new THREE.Mesh(new THREE.BoxGeometry(18.8, 2.2, 0.12), [
            materials().metal, materials().metal, materials().metal, materials().metal,
            new THREE.MeshStandardMaterial({ map: signTexture(["🏡 BUBBE'S HOUSE 🏡"], "#E91E63", "#ffffff", 1024, 128), roughness: 0.6 }),
            new THREE.MeshStandardMaterial({ map: signTexture(["DRIVE SAFE, LULULEH!"], "#E91E63", "#ffffff", 1024, 128), roughness: 0.6 }),
        ]);
        banner.position.y = 6.6;
        banner.castShadow = true;
        arch.add(banner);
        this.disposables.push(banner.geometry);
        this.group.add(arch);
        this.colliders.push({ x: ap.x - Math.cos(h) * 9.6, z: ap.z + Math.sin(h) * 9.6, r: 0.35, kind: "pole" });
        this.colliders.push({ x: ap.x + Math.cos(h) * 9.6, z: ap.z - Math.sin(h) * 9.6, r: 0.35, kind: "pole" });
    }

    updateCoins(time) {
        if (!this.coinMesh) return;
        const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);
        this.coins.forEach((c, i) => {
            q.setFromAxisAngle(up, time * 3 + c.s * 0.1);
            const y = 1.05 + Math.sin(time * 4 + c.s) * 0.12;
            mtx.compose(v.set(c.x, y, c.z), q, sc.setScalar(c.taken ? 0 : c.value > 1 ? 1.25 : 1));
            this.coinMesh.setMatrixAt(i, mtx);
        });
        this.coinMesh.instanceMatrix.needsUpdate = true;
    }

    animate(time) {
        this.updateCoins(time);
        for (const ht of this.hearts) {
            if (ht.taken) continue;
            ht.obj.rotation.y = time * 2.2;
            ht.obj.position.y = 1.3 + Math.sin(time * 3) * 0.15;
        }
        for (const a of this.anim) a.obj.position.y = a.base + Math.sin(time * 1.6 + a.ph) * 0.18;
    }

    dispose(scene) {
        scene.remove(this.group);
        for (const d of this.disposables) d.dispose();
    }
}

// ── the world ──────────────────────────────────────────────────────────
export class World {
    constructor(scene, seed = 20261104) {
        this.scene = scene;
        this.seed = seed;
        this.road = new Road(seed);
        this.chunks = new Map();
        this.bubbe = null;
        this.signs = [
            { s: 50, d: 10.6, lines: ["LEAVING", "LAKEWOOD"], bg: "#1f7a46" },
            { s: 70, d: -10.6, lines: ["WELCOME TO", "LAKEWOOD"], bg: "#1f7a46" },
            { s: GOAL - 3200, d: 10.6, lines: ["BUBBE'S HOUSE", "2 MI"], bg: "#1f7a46" },
            { s: GOAL - 1600, d: 10.6, lines: ["BUBBE'S HOUSE", "1 MI"], bg: "#1f7a46" },
            { s: GOAL - 600, d: 10.6, lines: ["BUBBE'S HOUSE", "EXIT NOW!"], bg: "#E91E63" },
            { s: GOAL + 900, d: 10.6, lines: ["LAS VEGAS", "2,511 MI"], bg: "#1f7a46" },
            { s: 2300, d: 10.6, lines: ["HESHY'S POOL", "8 MI"], bg: "#1f7a46" },
        ];
        this.buildGround();
        this.buildSky();
        this.time = 0;
    }

    buildGround() {
        const tex = grassTexture();
        const SIZE = 1800, PERIOD = 9;
        tex.repeat.set(SIZE / PERIOD, SIZE / PERIOD);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 1, color: "#ffffff" }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.ground = ground;
        this.groundPeriod = PERIOD;
        this.scene.add(ground);
    }

    buildSky() {
        const geo = new THREE.SphereGeometry(950, 32, 16);
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide, depthWrite: false, fog: false,
            uniforms: { top: { value: new THREE.Color("#3f9be6") }, mid: { value: new THREE.Color("#9fd4fa") }, bottom: { value: new THREE.Color("#dff3ff") } },
            vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
            fragmentShader: "uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.15 ? mix(mid, top, smoothstep(0.15, 0.7, h)) : mix(bottom, mid, smoothstep(-0.02, 0.15, h)); gl_FragColor = vec4(c, 1.0);\n#include <colorspace_fragment>\n}",
        });
        this.sky = new THREE.Mesh(geo, mat);
        this.sky.renderOrder = -1;
        this.scene.add(this.sky);

        // puffy low-poly clouds
        this.clouds = new THREE.Group();
        const cm = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, fog: false, emissive: "#ffffff", emissiveIntensity: 0.35, flatShading: true });
        const cg = new THREE.IcosahedronGeometry(1, 1);
        const rnd = mulberry32(99);
        for (let i = 0; i < 16; i++) {
            const c = new THREE.Group();
            for (let j = 0; j < 5; j++) {
                const m = new THREE.Mesh(cg, cm);
                const r = 14 + rnd() * 14;
                m.scale.set(r * 1.4, r * 0.7, r);
                m.position.set((j - 2) * 18 + rnd() * 8, rnd() * 6, rnd() * 10);
                c.add(m);
            }
            const a = rnd() * Math.PI * 2, dist = 450 + rnd() * 300;
            c.position.set(Math.cos(a) * dist, 120 + rnd() * 90, Math.sin(a) * dist);
            c.rotation.y = rnd() * 6;
            this.clouds.add(c);
        }
        this.scene.add(this.clouds);
    }

    /** Stream chunks around the player; animate coins etc. */
    update(dt, playerS, camPos, buildBudget = 1) {
        this.time += dt;
        const kMin = Math.max(0, Math.floor((playerS - BEHIND) / CHUNK));
        const kMax = Math.floor((playerS + AHEAD) / CHUNK);
        for (const [k, c] of this.chunks) {
            if (k < kMin || k > kMax) { c.dispose(this.scene); this.chunks.delete(k); }
        }
        let built = 0;
        for (let k = kMin; k <= kMax && built < buildBudget; k++) {
            if (!this.chunks.has(k)) { this.chunks.set(k, new Chunk(this, k)); built++; }
        }
        for (const c of this.chunks.values()) c.animate(this.time);

        const P = this.groundPeriod;
        this.ground.position.set(Math.round(camPos.x / P) * P, 0, Math.round(camPos.z / P) * P);
        this.sky.position.copy(camPos);
        this.clouds.position.set(camPos.x, 0, camPos.z);
        this.clouds.rotation.y += dt * 0.004;

        if (this.bubbe && this.bubbe.arm && this.bubbe.base) {
            this.bubbe.arm.rotation.z = this.bubbe.base.z + Math.sin(this.time * 7) * 0.45;
        }
    }

    /** Build everything near the start before the first frame. */
    prebuild(playerS) {
        this.update(0, playerS, new THREE.Vector3(), 99);
    }

    *activeChunks() { yield* this.chunks.values(); }

    resetCoins() {
        for (const c of this.chunks.values()) {
            for (const coin of c.coins) coin.taken = false;
            for (const t of c.traps) t.triggered = false;
            for (const ht of c.hearts) { ht.taken = false; ht.obj.visible = true; }
        }
    }
}
