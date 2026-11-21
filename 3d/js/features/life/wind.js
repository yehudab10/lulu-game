// features/life — 🍂 THE WIND: now and then a gust (you hear it come) blows a handful of leaves across the street —
// autumn colours in the fall, blossom petals in the spring, a few dry ones otherwise — and sometimes a paper flyer
// off a lamppost comes tumbling past (walk into one and Lulu reads it out: "LOST CAT: KUGEL…"). In the fall a few
// leaves drift down all the time, and the town has raked LEAF PILES at the kerb: walk or drive through one and it
// bursts. Three instanced meshes (leaves, piles, flyers): three draw calls, nothing allocated per frame.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { canvasTex } from "../../world.js";
import { L, rand, clamp, stats, footLine, soundsOn } from "./common.js";
import { play } from "./sounds.js";
import { point } from "./steps.js";
import { P as PS, ensureSites } from "./puddles.js";

// ── tuning ────────────────────────────────────────────────────────────────
export const WIND = {
    gap: [26, 60], gapAutumn: [16, 40],     // s between gusts
    dur: 4.2,                               // a gust's length (s)
    speed: [4.5, 7.5],                      // m/s at its peak
    leaves: { autumn: 30, spring: 22, summer: 5, winter: 0 },
    flyerChance: 0.45,                      // per gust, in town, when it's dry
    drift: 0.9,                             // fall: leaves drifting down per second around her
};
const MAX_LEAVES = 120, MAX_PILES = 36, MAX_FLYERS = 3;
export const WS = { gustT: 12, g: null, prevail: Math.random() * Math.PI * 2, wx: 0, wz: 0, drift: 0, flyers: [], lineT: 0, readT: 0, said: new Set(), pileLine: false, gusts: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

// ── leaves ────────────────────────────────────────────────────────────────
const PAL = {
    autumn: ["#E8833A", "#C6452F", "#E9B53A", "#D9622B", "#B5651D", "#F2A541", "#8D5A2B"],
    spring: ["#F8BBD0", "#FFFFFF", "#F48FB1", "#FCE4EC", "#FFF8E1"],
    dry: ["#A1887F", "#8D6E63", "#BCAAA4", "#C8A165"],
};
const COLS = {}; for (const k in PAL) COLS[k] = PAL[k].map(c => new THREE.Color(c));
let leafMesh = null;
const LV = { n: 0, x: new Float32Array(MAX_LEAVES), y: new Float32Array(MAX_LEAVES), z: new Float32Array(MAX_LEAVES), vx: new Float32Array(MAX_LEAVES), vy: new Float32Array(MAX_LEAVES),
    vz: new Float32Array(MAX_LEAVES), rx: new Float32Array(MAX_LEAVES), ry: new Float32Array(MAX_LEAVES), rz: new Float32Array(MAX_LEAVES), sx: new Float32Array(MAX_LEAVES),
    sy: new Float32Array(MAX_LEAVES), sz: new Float32Array(MAX_LEAVES), ph: new Float32Array(MAX_LEAVES), life: new Float32Array(MAX_LEAVES), size: new Float32Array(MAX_LEAVES), col: new Array(MAX_LEAVES).fill(null) };
const leafTex = () => canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.beginPath(); g.moveTo(w / 2, 3); g.quadraticCurveTo(w - 4, h * 0.35, w / 2, h - 10); g.quadraticCurveTo(4, h * 0.35, w / 2, 3); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 4); g.stroke();
}, false);
function ensureLeaves() {
    if (leafMesh) return leafMesh;
    const mat = new THREE.MeshLambertMaterial({ map: leafTex(), alphaTest: 0.5, side: THREE.DoubleSide });
    leafMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.3, 0.3), mat, MAX_LEAVES);
    leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    leafMesh.frustumCulled = false; leafMesh.castShadow = false;
    leafMesh.count = 0; leafMesh.name = "lifeLeaves";
    leafMesh.setColorAt(0, COLS.autumn[0]);
    ctx.scene.add(leafMesh);
    return leafMesh;
}
function palette() { return L.season === "spring" ? COLS.spring : L.season === "autumn" ? COLS.autumn : COLS.dry; }
/** One leaf (dropped quietly when the pool is full — the oldest are already on the ground fading). */
export function addLeaf(x, y, z, vx, vy, vz, life = rand(5, 8), cols = palette()) {
    if (LV.n >= MAX_LEAVES) return false;
    const i = LV.n++;
    LV.x[i] = x; LV.y[i] = y; LV.z[i] = z; LV.vx[i] = vx; LV.vy[i] = vy; LV.vz[i] = vz;
    LV.rx[i] = Math.random() * 6; LV.ry[i] = Math.random() * 6; LV.rz[i] = Math.random() * 6;
    LV.sx[i] = rand(-5, 5); LV.sy[i] = rand(-3, 3); LV.sz[i] = rand(-5, 5);
    LV.ph[i] = Math.random() * 6.28; LV.life[i] = life; LV.size[i] = L.season === "spring" ? rand(0.6, 0.9) : rand(1.0, 1.5);
    LV.col[i] = cols[Math.floor(Math.random() * cols.length)];
    return true;
}
const LKEYS = ["x", "y", "z", "vx", "vy", "vz", "rx", "ry", "rz", "sx", "sy", "sz", "ph", "life", "size", "col"];
function killLeaf(i) {
    const j = --LV.n;
    if (i === j) return;
    for (let k = 0; k < LKEYS.length; k++) { const a = LV[LKEYS[k]]; a[i] = a[j]; }
}
function tickLeaves(dt) {
    if (!leafMesh) return;
    const wx = WS.wx, wz = WS.wz, gustK = Math.hypot(wx, wz);
    let n = 0;
    for (let i = LV.n - 1; i >= 0; i--) {
        LV.life[i] -= dt;
        if (LV.life[i] <= 0) { killLeaf(i); continue; }
        if (LV.y[i] > 0.05) {
            const drag = Math.exp(-1.5 * dt), t = L.time;
            LV.vx[i] = LV.vx[i] * drag + (wx * 1.4 + Math.sin(t * 2.3 + LV.ph[i]) * 1.3) * dt;
            LV.vz[i] = LV.vz[i] * drag + (wz * 1.4 + Math.cos(t * 1.9 + LV.ph[i]) * 1.3) * dt;
            LV.vy[i] = Math.max(-1.0, LV.vy[i] * drag - 2.0 * dt + gustK * 0.12 * dt * Math.sin(t * 3 + LV.ph[i]));
            LV.rx[i] += LV.sx[i] * dt; LV.ry[i] += LV.sy[i] * dt; LV.rz[i] += LV.sz[i] * dt;
            if (LV.y[i] + LV.vy[i] * dt <= 0.05) { LV.y[i] = 0.05; LV.vy[i] = 0; LV.rx[i] = -Math.PI / 2; LV.rz[i] = 0; LV.life[i] = Math.min(LV.life[i], 5); }
        } else if (gustK > 1.5) {
            // on the ground: a gust skitters it along (a little hop now and then)
            LV.vx[i] += (wx * 0.9 - LV.vx[i]) * Math.min(1, dt * 2); LV.vz[i] += (wz * 0.9 - LV.vz[i]) * Math.min(1, dt * 2);
            LV.ry[i] += LV.sy[i] * dt * 2;
            if (Math.random() < dt * 0.6) { LV.vy[i] = rand(0.8, 1.8); LV.y[i] = 0.06; }
        } else { LV.vx[i] *= Math.exp(-6 * dt); LV.vz[i] *= Math.exp(-6 * dt); }
        LV.x[i] += LV.vx[i] * dt; LV.y[i] += LV.vy[i] * dt; LV.z[i] += LV.vz[i] * dt;
        if (LV.y[i] < 0.05) LV.y[i] = 0.05;
    }
    for (let i = 0; i < LV.n; i++) {
        _e.set(LV.rx[i], LV.ry[i], LV.rz[i]);
        _m.compose(_p.set(LV.x[i], LV.y[i], LV.z[i]), _q.setFromEuler(_e), _s.setScalar(LV.size[i] * Math.min(1, LV.life[i] * 0.8)));
        leafMesh.setMatrixAt(n, _m);
        leafMesh.setColorAt(n, LV.col[i]);
        n++;
    }
    leafMesh.count = n;
    leafMesh.visible = n > 0 && L.on;
    leafMesh.instanceMatrix.needsUpdate = true;
    if (leafMesh.instanceColor) leafMesh.instanceColor.needsUpdate = true;
}

// ── leaf piles (autumn, in town) ──────────────────────────────────────────
let pileMesh = null;
const livePiles = [];
function pileGeometry() {
    const g = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = g.attributes.position, cols = [], c = new THREE.Color(), pal = COLS.autumn;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), k = 1 + (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.16;
        if (y > 0.02) pos.setXYZ(i, pos.getX(i) * k, y * k, pos.getZ(i) * k);
        c.copy(pal[(i * 7) % pal.length]);
        cols.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
}
function ensurePiles() {
    if (pileMesh) return pileMesh;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    pileMesh = new THREE.InstancedMesh(pileGeometry(), mat, MAX_PILES);
    pileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    pileMesh.frustumCulled = false; pileMesh.castShadow = false; pileMesh.receiveShadow = true;
    pileMesh.count = 0; pileMesh.name = "lifePiles";
    ctx.scene.add(pileMesh);
    return pileMesh;
}
let pileScanT = 0;
const byD = (a, b) => a._d - b._d;
function tickPiles(dt) {
    const want = L.on && L.town && L.season === "autumn" && !L.snow && ensureSites() && PS.piles.length > 0;
    if (!want) { if (pileMesh) pileMesh.visible = false; livePiles.length = 0; return; }
    const m = ensurePiles();
    pileScanT -= dt;
    if (pileScanT <= 0) {
        pileScanT = 0.6;
        livePiles.length = 0;
        for (const p of PS.piles) { const dx = p.x - L.x, dz = p.z - L.z; if (Math.abs(dx) > 90 || Math.abs(dz) > 90) continue; p._d = dx * dx + dz * dz; livePiles.push(p); }
        if (livePiles.length > MAX_PILES) { livePiles.sort(byD); livePiles.length = MAX_PILES; }
    }
    // walk / drive into one: it bursts
    const car = ctx.car, carR = L.foot ? 0 : 1.3;
    for (const p of livePiles) {
        if (p.kicked) { if (p.flat < 1) p.flat = Math.min(1, p.flat + dt * 3); continue; }
        const dx = L.x - p.x, dz = L.z - p.z, d = Math.hypot(dx, dz);
        const hit = L.foot ? d < p.r * 0.95 && (L.speed > 1.2 || ctx.foot.airborne) : d < p.r + carR && L.speed > 2.5;
        if (hit) kickPile(p, L.foot ? null : car);
    }
    let n = 0;
    for (const p of livePiles) {
        const f = p.flat, r = p.r * (1 + f * 0.3), hgt = p.r * 0.62 * (1 - f * 0.75);
        _e.set(0, p.h, 0);
        _m.compose(_p.set(p.x, 0.04, p.z), _q.setFromEuler(_e), _s.set(r, hgt, r * 0.8));
        m.setMatrixAt(n++, _m);
    }
    m.count = n;
    m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
}
const PILE_LINES = ["Couldn't resist. 🍂", "Sorry, Mr. Rosenberg!", "Who raked this? …oops."];
function kickPile(p, car) {
    p.kicked = 1; stats.kicked++;
    const cols = COLS.autumn, n = car ? 30 : 18;
    const bx = car ? car.vx * 0.35 : 0, bz = car ? car.vz * 0.35 : 0;
    for (let k = 0; k < n; k++) {
        const a = Math.random() * 6.283, sp = rand(0.8, car ? 3.5 : 2.4);
        addLeaf(p.x + Math.cos(a) * p.r * 0.5, rand(0.2, 0.6), p.z + Math.sin(a) * p.r * 0.5, Math.cos(a) * sp + bx, rand(2.5, car ? 6 : 4.5), Math.sin(a) * sp + bz, rand(5, 8), cols);
    }
    if (soundsOn() && !L.quiet) play("lifeCrunch", point(p.x, 0.3, p.z), { gain: car ? 1 : 0.8, rate: rand(0.9, 1.1) });
    emit("stat", { id: "leafPiles", n: 1 });
    emit("life:pile", { x: p.x, z: p.z, car: !!car });
    if (!car && !WS.pileLine && Math.random() < 0.5) { WS.pileLine = true; footLine(PILE_LINES[stats.kicked % PILE_LINES.length]); }
}

// ── flyers ────────────────────────────────────────────────────────────────
export const FLYERS = [
    { title: "LOST: BLACK HAT", sub: "answers to “the hat”", bg: "#FFFDE7", band: "#212121" },
    { title: "LOST CAT: KUGEL", sub: "orange · loves noodles", bg: "#FFF3E0", band: "#EF6C00" },
    { title: "CHOLENT COOK-OFF", sub: "shul basement · Thurs", bg: "#FFF8E1", band: "#795548" },
    { title: "UMBRELLA GEMACH", sub: "14 umbrellas — all black", bg: "#E3F2FD", band: "#1565C0" },
    { title: "TUTOR WANTED", sub: "must love Gemara + dogs", bg: "#F1F8E9", band: "#2E7D32" },
    { title: "YARD SALE", sub: "gently used shtreimel box", bg: "#FCE4EC", band: "#AD1457" },
    { title: "CARPOOL NEEDED", sub: "8:05 sharp (so 8:20)", bg: "#EDE7F6", band: "#4527A0" },
    { title: "FOUND: ONE SOCK", sub: "call Shloimy", bg: "#E0F7FA", band: "#00838F" },
];
let flyerMesh = null, cellAttr = null;
function flyerTex() {
    const CW = 128, CH = 170;
    return canvasTex(CW * 4, CH * 2, g => {
        FLYERS.forEach((f, i) => {
            const x = (i % 4) * CW, y = Math.floor(i / 4) * CH;
            g.fillStyle = f.bg; g.fillRect(x + 2, y + 2, CW - 4, CH - 4);
            g.fillStyle = f.band; g.fillRect(x + 2, y + 2, CW - 4, 26);
            g.fillStyle = "#ffffff"; g.font = "bold 13px Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText("★ NOTICE ★", x + CW / 2, y + 15);
            g.fillStyle = "#222222";
            const words = f.title.split(" ");
            const lines = []; let cur = "";
            g.font = "bold 18px Arial, sans-serif";
            for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > CW - 16 && cur) { lines.push(cur); cur = w; } else cur = t; }
            if (cur) lines.push(cur);
            lines.forEach((ln, k) => g.fillText(ln, x + CW / 2, y + 50 + k * 21));
            g.font = "12px Arial, sans-serif"; g.fillStyle = "#555555";
            g.fillText(f.sub, x + CW / 2, y + 58 + lines.length * 21, CW - 12);
            g.strokeStyle = "#999999"; g.setLineDash([3, 3]);
            for (let k = 0; k < 6; k++) { const tx = x + 8 + k * ((CW - 16) / 6); g.beginPath(); g.moveTo(tx, y + CH - 36); g.lineTo(tx, y + CH - 4); g.stroke(); }
            g.setLineDash([]);
        });
    }, false);
}
function ensureFlyers() {
    if (flyerMesh) return flyerMesh;
    const g = new THREE.PlaneGeometry(0.46, 0.6);
    cellAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_FLYERS * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aCell", cellAttr);
    const mat = new THREE.MeshLambertMaterial({ map: flyerTex(), side: THREE.DoubleSide });
    mat.onBeforeCompile = sh => {
        sh.vertexShader = "attribute vec2 aCell;\n" + sh.vertexShader.replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (vMapUv + aCell) * vec2(0.25, 0.5);\n#endif");
    };
    mat.customProgramCacheKey = () => "lifeFlyer";
    flyerMesh = new THREE.InstancedMesh(g, mat, MAX_FLYERS);
    flyerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    flyerMesh.frustumCulled = false; flyerMesh.castShadow = false;
    flyerMesh.count = 0; flyerMesh.name = "lifeFlyers";
    ctx.scene.add(flyerMesh);
    return flyerMesh;
}
let flyerNext = 0;
export function spawnFlyer(dirX, dirZ, idx = -1, latIn = null) {
    if (WS.flyers.length >= MAX_FLYERS) return null;
    ensureFlyers();
    const i = idx >= 0 ? idx % FLYERS.length : (flyerNext++ + Math.floor(Math.random() * 3)) % FLYERS.length;
    const px = -dirZ, pz = dirX, lat = latIn != null ? latIn : rand(-1.6, 1.6);
    const f = { i, x: L.x - dirX * 13 + px * lat, y: rand(1.2, 2.4), z: L.z - dirZ * 13 + pz * lat, vx: dirX * 5, vy: 0, vz: dirZ * 5, t: 0, ground: 0, life: 16,
        rx: rand(0, 6), ry: rand(0, 6), rz: rand(0, 6), ph: rand(0, 6), read: false };
    WS.flyers.push(f);
    stats.flyers++;
    return f;
}
function tickFlyers(dt) {
    if (!flyerMesh) return;
    const wx = WS.wx, wz = WS.wz;
    for (let k = WS.flyers.length - 1; k >= 0; k--) {
        const f = WS.flyers[k];
        f.t += dt; f.life -= dt;
        if (f.life <= 0) { WS.flyers.splice(k, 1); continue; }
        if (!f.ground) {
            const gk = Math.hypot(wx, wz), drag = Math.exp(-1.2 * dt);
            f.vx = f.vx * drag + wx * 1.3 * dt; f.vz = f.vz * drag + wz * 1.3 * dt;
            f.vy = f.vy * drag + (Math.sin(f.t * 3.1 + f.ph) * 2.2 + (gk > 2 ? 0.9 : -1.6)) * dt;
            f.rx += (2.5 + gk * 0.5) * dt; f.rz += Math.sin(f.t * 1.7) * 3 * dt; f.ry += dt * 1.2;
            f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
            if (f.y < 0.04 || (gk < 0.5 && f.t > 3 && f.y < 0.4)) { f.ground = 1; f.y = 0.04; f.rx = -Math.PI / 2; f.rz = 0; f.life = Math.min(f.life, 7); }
        } else if (Math.hypot(wx, wz) > 2.5 && Math.random() < dt * 0.5) { f.ground = 0; f.vy = 2; f.vx = wx; f.vz = wz; }
        // walk into it → she reads it (once per notice per drive)
        if (L.foot && !f.read && f.y < 2.8 && Math.hypot(f.x - L.x, f.z - L.z) < 1.4) {
            f.read = true;
            if (!WS.said.has(f.i) && ctx.time > WS.readT) {
                WS.said.add(f.i); WS.readT = ctx.time + 30; stats.read++;
                const F = FLYERS[f.i];
                footLine(`📄 “${F.title} — ${F.sub}”`, 3.2);
                emit("life:flyer", { i: f.i, title: F.title });
            }
        }
    }
    let n = 0;
    for (const f of WS.flyers) {
        _e.set(f.rx, f.ry, f.rz);
        _m.compose(_p.set(f.x, f.y, f.z), _q.setFromEuler(_e), _s.setScalar(Math.min(1, f.life)));
        flyerMesh.setMatrixAt(n, _m);
        cellAttr.array[n * 2] = f.i % 4; cellAttr.array[n * 2 + 1] = 1 - Math.floor(f.i / 4);
        n++;
    }
    flyerMesh.count = n;
    flyerMesh.visible = n > 0 && L.on;
    flyerMesh.instanceMatrix.needsUpdate = true;
    cellAttr.needsUpdate = true;
}

// ── gusts ─────────────────────────────────────────────────────────────────
const where = () => L.on && (L.town || L.foot) && !/desert/.test(L.biome);
/** Start a gust now (tests / debug): its wind turns up over ~1 s, holds, dies away. */
export function gust(opts = {}) {
    const a = opts.dir != null ? opts.dir : WS.prevail + rand(-0.6, 0.6);
    const g = WS.g = { t: 0, dur: WIND.dur, dx: Math.sin(a), dz: Math.cos(a), peak: rand(WIND.speed[0], WIND.speed[1]) };
    WS.gusts++; stats.gusts++;
    ensureLeaves();
    const n = opts.leaves != null ? opts.leaves : WIND.leaves[L.season] || 0;
    const px = -g.dz, pz = g.dx;
    if (!L.snow && L.rain < 0.5) for (let k = 0; k < n; k++) {
        const lat = rand(-12, 12), back = rand(3, 14), y = Math.random() < 0.4 ? rand(2.5, 6) : rand(0.06, 0.6);
        addLeaf(L.x - g.dx * back + px * lat, y, L.z - g.dz * back + pz * lat, g.dx * rand(2, 4), y < 1 ? rand(0.5, 1.8) : 0, g.dz * rand(2, 4), rand(7, 11));
    }
    if (opts.flyer || (opts.flyer == null && L.town && L.rain < 0.15 && !L.snow && Math.random() < WIND.flyerChance)) { ensureFlyers(); spawnFlyer(g.dx, g.dz, opts.flyerIdx != null ? opts.flyerIdx : -1); }
    if (soundsOn() && !L.quiet) play("lifeGust", point(L.x - g.dx * 9, 2, L.z - g.dz * 9), { gain: rand(0.7, 1), rate: rand(0.85, 1.1) });
    emit("life:gust", { dir: a });
    return g;
}
export function tickWind(dt) {
    // the gust's wind vector
    const g = WS.g;
    if (g) {
        g.t += dt;
        const u = g.t / g.dur, env = u < 0.25 ? u / 0.25 : u > 0.7 ? Math.max(0, (1 - u) / 0.3) : 1;
        WS.wx = g.dx * g.peak * env; WS.wz = g.dz * g.peak * env;
        if (u >= 1) { WS.g = null; WS.wx = WS.wz = 0; }
    }
    if (where()) {
        WS.gustT -= dt;
        if (WS.gustT <= 0) {
            const gap = L.season === "autumn" ? WIND.gapAutumn : WIND.gap;
            WS.gustT = rand(gap[0], gap[1]);
            if (!WS.g) gust();
        }
        // the fall: a few leaves always drifting down from the street trees around her
        if (L.season === "autumn" && L.town && !L.snow && L.rain < 0.6) {
            WS.drift += WIND.drift * dt;
            while (WS.drift >= 1) {
                WS.drift -= 1;
                const a = Math.random() * 6.283, r = rand(4, 18);
                ensureLeaves();
                addLeaf(L.x + Math.cos(a) * r, rand(4.5, 7.5), L.z + Math.sin(a) * r, rand(-0.4, 0.4), -0.3, rand(-0.4, 0.4), rand(9, 13));
            }
        }
    }
    tickLeaves(dt);
    tickPiles(dt);
    tickFlyers(dt);
}
export function windHide() {
    if (leafMesh) leafMesh.visible = false;
    if (pileMesh) pileMesh.visible = false;
    if (flyerMesh) flyerMesh.visible = false;
}
export function windClear() {
    LV.n = 0; WS.flyers.length = 0; WS.g = null; WS.wx = WS.wz = 0; WS.pileLine = false; livePiles.length = 0;
    if (leafMesh) leafMesh.count = 0;
    if (pileMesh) pileMesh.count = 0;
    if (flyerMesh) flyerMesh.count = 0;
    windHide();
}
export function gustNow() { return WS.g ? Math.hypot(WS.wx, WS.wz) : 0; }
export function windInfo() {
    return { gusts: WS.gusts, gust: !!WS.g, wind: +gustNow().toFixed(1), leaves: LV.n, leavesDrawn: leafMesh ? leafMesh.count : 0, flyers: WS.flyers.length,
        piles: livePiles.length, pilesKicked: PS.piles.filter(p => p.kicked).length, pilesVisible: !!(pileMesh && pileMesh.visible), nextGust: +WS.gustT.toFixed(1) };
}
/** Tests: the nearest live pile → {x, z, r, kicked} or null. */
export function nearestPile() {
    let best = null, bd = 1e9;
    for (const p of livePiles) { const d = Math.hypot(p.x - L.x, p.z - L.z); if (d < bd && !p.kicked) { bd = d; best = p; } }
    return best ? { x: best.x, z: best.z, r: best.r, d: +bd.toFixed(1) } : null;
}
