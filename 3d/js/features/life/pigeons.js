// features/life — 🐦 PIGEONS (round 2): the town's own birds. A row of them on a roof ridge here and there, a little
// gang pecking at crumbs on the pavement (always a few outside the bakery and the pizza shop), cooing now and then.
// HONK (within ~35 m), run at them, or drive past fast and they burst up in a clatter of wings, circle the block and,
// once she's moved on, glide back down to exactly where they were. One InstancedMesh (the wing flap runs in the vertex
// shader), ≤ 72 birds drawn — only the flocks within 75 m are simulated. The perches are hashed from the town's build
// (ctx.town.homes / spots / plan): the same pigeons on the same roofs for friends in a party; the scatter is local.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { L, hash01, strHash, rand, clamp, stats, soundsOn, homeWorld, countSound } from "./common.js";
import { play } from "./sounds.js";
import { P as PS, ensureSites, streetPt } from "./puddles.js";

export const PIG = {
    roofShare: 0.2,         // houses with a row on the roof
    walkShare: 0.035,       // pavement flocks per 7 m of street side
    R: 75,                  // simulated + drawn within (m)
    honkR: 35, runR: 3.6, carR: 8, carFastR: 13,
    cooGap: [7, 15],
};
const MAX = 72;
/** Perches per house model (three.js model frame: x = model +X, y, z = out of the front): [x0, x1, y, z]. */
const PERCH = {
    town_duplex: [-4.2, 4.2, 8.72, 0],              // the gable's ridge
    town_townhouses: [1.6, 4.0, 9.22, 5.35],        // the front parapet between two roof hats
    town_mw_house: [-5.6, 2.2, 8.62, 5.5],          // the hip roof's flat top, front edge
    town_mw_rowhouse: [-7.2, 7.2, 7.37, 5.65],      // the cornice
};
const GREYS = ["#8a8fa0", "#9aa0b0", "#7c8090", "#6f7383", "#a3a7b4", "#5d606b", "#b9b3a8", "#4a4c55"].map(c => new THREE.Color(c));

export const PG = { key: "", flocks: [], live: [], scanT: 0, sx: 1e9, sz: 1e9, mesh: null, flap: null, uTime: { value: 0 }, cooT: 6, scattered: 0, drawn: 0, honks: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

// ── the mesh: a plump low-poly pigeon, wings flap in the vertex shader ────
function pigeonGeometry() {
    const P = [], W = [];
    const tri = (a, b, c, wa = 0, wb = 0, wc = 0) => { P.push(...a, ...b, ...c); W.push(wa, wb, wc); };
    // body: a fat diamond (nose / tail / top / belly / sides)
    const nose = [0, 0.13, 0.17], tail = [0, 0.1, -0.2], top = [0, 0.2, 0.0], bot = [0, 0.0, 0.02], l = [-0.085, 0.1, 0.0], r = [0.085, 0.1, 0.0];
    for (const [a, b] of [[top, l], [l, bot], [bot, r], [r, top]]) { tri(nose, a, b); tri(tail, b, a); }
    // head: a little pyramid up front with a beak
    const h0 = [0, 0.27, 0.15], hl = [-0.04, 0.18, 0.13], hr = [0.04, 0.18, 0.13], hf = [0, 0.2, 0.22], beak = [0, 0.215, 0.27];
    tri(h0, hl, hf); tri(h0, hf, hr); tri(h0, hr, hl); tri(hf, hl, beak); tri(hf, beak, hr);
    tri([0, 0.11, -0.16], [-0.07, 0.1, -0.3], [0.07, 0.1, -0.3]);                    // tail fan
    for (const s of [-1, 1]) {                                                       // wings (aWing: 0 at the root → 1 at the tip)
        const root0 = [s * 0.06, 0.15, 0.07], root1 = [s * 0.06, 0.15, -0.1], mid0 = [s * 0.22, 0.16, 0.04], mid1 = [s * 0.22, 0.16, -0.12], tip = [s * 0.36, 0.16, -0.1];
        tri(root0, mid0, root1, 0.05, 0.55, 0.05); tri(root1, mid0, mid1, 0.05, 0.55, 0.55); tri(mid0, tip, mid1, 0.55, 1, 0.55);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute("aWing", new THREE.Float32BufferAttribute(W, 1));
    g.computeVertexNormals();
    return g;
}
function ensureMesh() {
    if (PG.mesh) return PG.mesh;
    const g = pigeonGeometry();
    PG.flap = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("iFlap", PG.flap);
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff", side: THREE.DoubleSide, flatShading: true });
    mat.onBeforeCompile = sh => {
        sh.uniforms.uTime = PG.uTime;
        sh.vertexShader = "attribute float aWing; attribute vec3 iFlap; uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
            float wing = step(0.02, aWing);
            transformed.x *= mix(1.0, 0.3, iFlap.z * wing);
            transformed.y += aWing * (sin(uTime * 24.0 + iFlap.y) * 0.3 * iFlap.x - iFlap.z * 0.03);`);
    };
    mat.customProgramCacheKey = () => "lifePigeon";
    PG.mesh = new THREE.InstancedMesh(g, mat, MAX);
    PG.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    PG.mesh.frustumCulled = false; PG.mesh.castShadow = false;
    PG.mesh.count = 0; PG.mesh.visible = false; PG.mesh.name = "lifePigeons";
    PG.mesh.setColorAt(0, GREYS[0]);
    ctx.scene.add(PG.mesh);
    return PG.mesh;
}

// ── the flocks (built once per town placement) ───────────────────────────
function bird(f, x, y, z, yaw, k) {
    return { f, hx: x, hy: y, hz: z, hyaw: yaw, x, y, z, yaw, pitch: 0, px: x, py: y, pz: z, mode: 0, t: 0, ph: k * 1.7, col: GREYS[(k * 5 + (f.seed * 97 | 0)) % GREYS.length],
        peck: 0.5 + (k % 5) * 0.4, hop: 0, amp: 0, fold: 1, scale: 1.25 + ((k * 37) % 10) / 40, orbA: 0, orbR: 0, orbY: 0, orbW: 0, ox: 0, oy: 0, oz: 0, lift: 0 };
}
function buildFlocks() {
    const plan = ctx.town && ctx.town.plan;
    if (!plan || !ensureSites()) return false;
    // (ctx.town.homes maps every house to the world: read it only when the town changed — or every 2 s while it's empty)
    if (PG.key === PS.key && (PG.nHomes > 0 || L.time < PG.retry)) return true;
    const homes = ctx.town.homes || [];
    PG.key = PS.key; PG.nHomes = homes.length; PG.retry = L.time + 2;
    PG.flocks = []; PG.live.length = 0; PG.sx = PG.sz = 1e9;
    const th = strHash((plan.def.id || "town") + ":pigeons"), w = {};
    // rows on the roofs
    homes.forEach((h, i) => {
        const P = PERCH[h.key];
        if (!P || hash01(th, i, 1) > PIG.roofShare) return;
        const seed = hash01(th, i, 2), n = 3 + Math.floor(seed * 4);
        const f = { kind: "roof", x: 0, z: 0, seed, birds: [], away: 0, cool: 0 };
        const span = P[1] - P[0], start = P[0] + hash01(th, i, 3) * Math.max(0, span - n * 0.45);
        const face = Math.atan2(h.nx, h.nz);
        for (let k = 0; k < n; k++) {
            homeWorld(h, Math.min(P[1], start + k * (0.38 + hash01(th, i, 10 + k) * 0.2)), P[3], w);
            f.birds.push(bird(f, w.x, P[2], w.z, face + (hash01(th, i, 20 + k) < 0.7 ? 0 : Math.PI) + (hash01(th, i, 30 + k) - 0.5) * 0.8, k));
        }
        homeWorld(h, (P[0] + P[1]) / 2, P[3], w); f.x = w.x; f.z = w.z; f.y = P[2];
        PG.flocks.push(f);
    });
    // gangs on the pavement: always one outside the bakery / the pizza shop, a few more along the streets
    const ground = (x, z, seed, n) => {
        const f = { kind: "ground", x, z, y: 0, seed, birds: [], away: 0, cool: 0 };
        for (let k = 0; k < n; k++) {
            const a = hash01(th + 5, seed * 1e6 | 0, k) * 6.283, r = Math.sqrt(hash01(th + 6, seed * 1e6 | 0, k)) * 1.5;
            f.birds.push(bird(f, x + Math.cos(a) * r, 0.04, z + Math.sin(a) * r, hash01(th + 7, seed * 1e6 | 0, k) * 6.283, k));
        }
        PG.flocks.push(f);
    };
    for (const id of ["bakery", "pizza"]) {
        const sp = ctx.town.spot && ctx.town.spot(id);
        if (sp) ground(sp.x + sp.ux * 3.2, sp.z + sp.uz * 3.2, hash01(th, id.length, 9), 6);
    }
    for (const st of plan.STREETS) {
        if (st.boulevard || !st.walk) continue;
        const cross = (st.cross || []).map(c => c.a);
        for (let u = Math.ceil(st.a0 / 7) * 7 + 2; u <= st.a1; u += 7) {
            if (cross.some(a => Math.abs(a - u) < 9)) continue;
            for (const side of [-1, 1]) {
                const r = hash01(th + 1, st.id * 4099 + Math.round(u), side);
                if (r > PIG.walkShare) continue;
                const lp = streetPt(st, u, side * (st.outer + st.walk) / 2, {}), p = plan.world(lp.x, lp.z, {});
                ground(p.x, p.z, hash01(th + 2, st.id * 4099 + Math.round(u), side), 3 + Math.floor(r / PIG.walkShare * 4));
            }
        }
    }
    return true;
}

// ── scatter + come back ──────────────────────────────────────────────────
/** Up they go (away from x, z). */
export function scatter(f, x, z, why = "") {
    if (f.away > 0 || f.cool > 0) return false;
    f.away = 1; f.cool = 3;
    PG.scattered++; stats.pigeons = (stats.pigeons || 0) + 1;
    for (const b of f.birds) {
        let dx = b.x - x, dz = b.z - z;
        const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        b.mode = 1; b.t = -Math.random() * 0.25; b.amp = 1; b.fold = 0;
        b.ox = dx * rand(2.5, 5) + rand(-1, 1); b.oz = dz * rand(2.5, 5) + rand(-1, 1); b.oy = rand(3.5, 6);
        // the circle they'll hold over the block until she's gone
        b.orbR = rand(9, 15); b.orbY = f.y + rand(6, 10); b.orbW = (f.seed < 0.5 ? 1 : -1) * rand(0.45, 0.65); b.orbA = Math.atan2(dz, dx);
    }
    if (soundsOn() && !L.quiet) { const pt = { x: f.x, y: (f.y || 0) + 0.5, z: f.z }; if (play("lifeFlutter", pt, { gain: f.kind === "roof" ? 0.8 : 1, rate: rand(0.92, 1.1) })) countSound("lifeFlutter"); }
    emit("life:pigeons", { x: f.x, z: f.z, why, kind: f.kind, n: f.birds.length });
    return true;
}
on("honk", () => {
    if (!ctx.enabled("life") || !L.on || !L.town) return;
    PG.honks++;
    const R2 = PIG.honkR * PIG.honkR;
    for (const f of PG.live) { const dx = f.x - L.x, dz = f.z - L.z; if (dx * dx + dz * dz < R2) scatter(f, L.x, L.z, "honk"); }
});
function triggers() {
    for (const f of PG.live) {
        if (f.away > 0 || f.cool > 0 || f.kind !== "ground") continue;
        const d = Math.hypot(f.x - L.x, f.z - L.z);
        if (L.foot ? (d < PIG.runR && L.speed > 4.2) || d < 1.2 : (d < PIG.carR && L.speed > 8) || (d < PIG.carFastR && L.speed > 15)) scatter(f, L.x, L.z, L.foot ? "run" : "car");
    }
}

// ── per frame ─────────────────────────────────────────────────────────────
const byD = (a, b) => a._d - b._d;
function pickLive() {
    for (const f of PG.live) f.live = false;
    PG.live.length = 0;
    const R = PIG.R;
    for (const f of PG.flocks) {
        const dx = f.x - L.x, dz = f.z - L.z;
        if (dx > R || dx < -R || dz > R || dz < -R) continue;
        f._d = dx * dx + dz * dz;
        PG.live.push(f);
    }
    PG.live.sort(byD);
    let n = 0, k = 0;
    for (; k < PG.live.length && n + PG.live[k].birds.length <= MAX; k++) n += PG.live[k].birds.length;
    // flocks that drop out land home at once (they're far away: nobody sees them settle)
    for (let i = k; i < PG.live.length; i++) home(PG.live[i]);
    PG.live.length = k;
    for (const f of PG.live) f.live = true;
    for (const f of PG.flocks) if (!f.live && f.away) home(f);
}
function home(f) {
    f.away = 0;
    for (const b of f.birds) { b.mode = 0; b.x = b.hx; b.y = b.hy; b.z = b.hz; b.yaw = b.hyaw; b.amp = 0; b.fold = 1; b.pitch = 0; }
}
function stepBird(b, f, dt, back) {
    b.t += dt;
    b.px = b.x; b.py = b.y; b.pz = b.z;
    if (b.mode === 0) {                          // sitting / pecking about
        b.peck -= dt;
        if (b.peck < 0) {
            b.peck = rand(0.5, 2.6);
            if (f.kind === "ground") { b.pitch = 0.8; if (Math.random() < 0.35) { b.hop = 0.22; b.yaw += rand(-1.2, 1.2); } }
            else if (Math.random() < 0.25) b.yaw += rand(-0.6, 0.6);
        }
        b.pitch = Math.max(0, b.pitch - dt * 3);
        b.hop = Math.max(0, b.hop - dt);
        // a ground pigeon wanders a step, never far from its crumbs
        if (f.kind === "ground" && b.hop > 0) { b.x += Math.sin(b.yaw) * dt * 0.9; b.z += Math.cos(b.yaw) * dt * 0.9; if (Math.hypot(b.x - b.hx, b.z - b.hz) > 1.8) b.yaw = Math.atan2(b.hx - b.x, b.hz - b.z); }
        return;
    }
    if (b.t < 0) return;
    if (b.mode === 1) {                          // the burst up and out
        const u = Math.min(1, b.t / 1.4), e = 1 - (1 - u) * (1 - u);
        b.x = b.hx + b.ox * e * 2; b.z = b.hz + b.oz * e * 2; b.y = b.hy + b.oy * e;
        if (u >= 1) { b.mode = 2; b.t = 0; b.lift = b.y; }
    } else if (b.mode === 2) {                   // circling the block
        b.orbA += b.orbW * dt;
        const tx = f.x + Math.cos(b.orbA) * b.orbR, tz = f.z + Math.sin(b.orbA) * b.orbR, ty = b.orbY + Math.sin(b.t * 1.3 + b.ph) * 0.6;
        const k = Math.min(1, dt * 1.6);
        b.x += (tx - b.x) * k; b.z += (tz - b.z) * k; b.y += (ty - b.y) * k;
        if (back && b.t > 4 + (b.ph % 3)) { b.mode = 3; b.t = 0; b.ox = b.x; b.oy = b.y; b.oz = b.z; }
    } else if (b.mode === 3) {                   // the glide home
        const u = Math.min(1, b.t / 2.6), e = u * u * (3 - 2 * u);
        b.x = b.ox + (b.hx - b.ox) * e; b.z = b.oz + (b.hz - b.oz) * e; b.y = b.oy + (b.hy - b.oy) * e + Math.sin(u * Math.PI) * 1.2;
        b.amp = u > 0.85 ? 1 : 0.12;
        if (u >= 1) { b.mode = 0; b.x = b.hx; b.y = b.hy; b.z = b.hz; b.yaw = b.hyaw + rand(-0.4, 0.4); b.amp = 0; b.fold = 1; b.pitch = 0; b.peck = rand(0.3, 1.5); }
        else b.fold = 0;
    }
    if (b.mode !== 0) {
        const vx = b.x - b.px, vz = b.z - b.pz, vy = b.y - b.py, sp = Math.hypot(vx, vz);
        if (sp > 1e-4) b.yaw = Math.atan2(vx, vz);
        b.pitch = -Math.atan2(vy, Math.max(1e-3, sp)) * 0.5;
        if (b.mode === 2) b.amp = Math.sin(b.t * 0.9 + b.ph) > -0.2 ? 1 : 0.15;
    }
}
function coo(dt) {
    PG.cooT -= dt;
    if (PG.cooT > 0) return;
    PG.cooT = rand(PIG.cooGap[0], PIG.cooGap[1]) * (L.foot ? 1 : 1.6);
    if (!soundsOn() || L.quiet || L.night > 0.55 || L.rain > 0.4) return;
    for (const f of PG.live) {
        if (f.away || f._d > 18 * 18) continue;
        const b = f.birds[0];
        b.pitch = 0.5;
        if (play("lifeCoo", { x: b.x, y: b.y + 0.2, z: b.z }, { gain: rand(0.8, 1), rate: rand(0.9, 1.1) })) countSound("lifeCoo");
        return;
    }
}
export function tickPigeons(dt) {
    const want = L.on && L.town && buildFlocks();
    if (!want) { pigeonsHide(); return; }
    PG.scanT -= dt;
    if (PG.scanT <= 0 || Math.abs(L.x - PG.sx) + Math.abs(L.z - PG.sz) > 8) { PG.scanT = 0.5; PG.sx = L.x; PG.sz = L.z; pickLive(); }
    triggers();
    const m = ensureMesh(), fa = PG.flap.array;
    let n = 0;
    for (const f of PG.live) {
        f.cool = Math.max(0, f.cool - dt);
        // they come back once she's moved on (≥ 14 m from a pavement flock, or 12 s for a roof)
        const d = Math.sqrt(f._d || 0);
        const back = f.away > 0 && (f.kind === "roof" ? d > 10 : Math.hypot(f.x - L.x, f.z - L.z) > 14);
        let all = true;
        for (const b of f.birds) {
            stepBird(b, f, dt, back);
            if (b.mode !== 0) all = false;
            _e.set(b.pitch, b.yaw, 0, "YXZ");
            _m.compose(_p.set(b.x, b.y + (b.hop > 0 ? Math.sin(b.hop / 0.22 * Math.PI) * 0.1 : 0), b.z), _q.setFromEuler(_e), _s.setScalar(b.scale));
            m.setMatrixAt(n, _m);
            m.setColorAt(n, b.col);
            fa[n * 3] = b.amp; fa[n * 3 + 1] = b.ph; fa[n * 3 + 2] = b.fold;
            n++;
        }
        if (all && f.away) f.away = 0;
    }
    coo(dt);
    m.count = n; PG.drawn = n;
    m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    PG.flap.needsUpdate = true;
    PG.uTime.value = L.time;
}
export function pigeonsHide() {
    if (PG.mesh) { PG.mesh.visible = false; PG.mesh.count = 0; }
    for (const f of PG.live) { f.live = false; if (f.away) home(f); }
    PG.live.length = 0; PG.drawn = 0; PG.sx = PG.sz = 1e9;
}
export function pigeonsClear() { pigeonsHide(); PG.key = ""; PG.flocks = []; }
export function pigeonInfo() {
    let flying = 0, roof = 0, ground = 0;
    for (const f of PG.live) { if (f.kind === "roof") roof++; else ground++; for (const b of f.birds) if (b.mode) flying++; }
    return { flocks: PG.flocks.length, live: PG.live.length, roof, ground, drawn: PG.drawn, flying, scattered: PG.scattered, visible: !!(PG.mesh && PG.mesh.visible) };
}
/** Tests: the nearest live flock ("roof" | "ground" | "") → {x, y, z, n, away} or null. */
export function nearestFlock(kind = "") {
    let best = null, bd = 1e9;
    for (const f of PG.flocks) { if (kind && f.kind !== kind) continue; const d = Math.hypot(f.x - L.x, f.z - L.z); if (d < bd) { bd = d; best = f; } }
    return best ? { x: best.x, y: best.y || 0, z: best.z, n: best.birds.length, away: best.away, kind: best.kind, d: +bd.toFixed(1) } : null;
}
/** Tests: scatter the nearest flock of a kind. */
export function scatterNearest(kind = "") {
    let best = null, bd = 1e9;
    for (const f of PG.live) { if (kind && f.kind !== kind) continue; const d = Math.hypot(f.x - L.x, f.z - L.z); if (d < bd) { bd = d; best = f; } }
    return best ? scatter(best, L.x, L.z, "test") : false;
}
