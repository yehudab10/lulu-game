// features/life — 💧 PUDDLES after the rain, in town: they gather in the gutters, a dip in the lane, a sag in the
// sidewalk while it rains (rings rippling on them), mirror the sky, and shrink away slowly once it stops (they
// outlast the wet road by a few minutes). Walk through one → splashy steps + spray; jump in → a big SPLOSH;
// drive through one fast → a sheet of spray off both sides (and a townsperson standing right there gets it).
// The sites come from the town's street plan (ctx.town.plan) + a hash: the same puddles for everyone, every visit.
// One InstancedMesh (≤ 44 drawn, the nearest), one draw call, only while there's water.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { L, hash01, strHash, rand, clamp, stats, footLine, soundsOn } from "./common.js";
import { play } from "./sounds.js";

const MAX = 44, RANGE = 75;
export const P = { key: "", k: { def: null, x: 0, z: 0, rot: 0 }, sites: [], piles: [], level: 0, forced: null, live: [], n: 0, scanT: 0, sx: 1e9, sz: 1e9, mesh: null, mat: null, seedAttr: null,
    lineT: 0, soakT: 0, carHits: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _w = {}, _sp = {};
const SPRAY = [0.86, 0.9, 0.96], DROP = [0.8, 0.86, 0.95];
const dummy = new THREE.Object3D();      // a bubble's anchor over a soaked townsperson (banter's bubbles follow an Object3D)

// ── the sites (puddles + leaf piles: both come off the same street walk) ──
export function streetPt(st, along, d, out) {
    if (st.axis === "ns") { out.x = st.c - d; out.z = along; }
    else if (st.axis === "ew") { out.x = along; out.z = st.c + d; }
    else { out.x = st.px + st.ux * along + st.rx * d; out.z = st.pz + st.uz * along + st.rz * d; }
    return out;
}
/** (Re)build this town's sites when the plan changed (another town, an attached town placed elsewhere). */
export function ensureSites() {
    const plan = ctx.town && ctx.town.plan;
    if (!plan || !plan.def || !plan.STREETS) return false;
    const K = P.k;
    if (K.def === plan.def && K.x === plan.ORIGIN.x && K.z === plan.ORIGIN.z && K.rot === (plan.ROT || 0)) return true;
    K.def = plan.def; K.x = plan.ORIGIN.x; K.z = plan.ORIGIN.z; K.rot = plan.ROT || 0;
    P.key = `${plan.def.id}:${K.x.toFixed(1)}:${K.z.toFixed(1)}:${K.rot.toFixed(3)}`; P.sites = []; P.piles = []; P.live.length = 0; P.n = 0; P.sx = P.sz = 1e9;
    const th = strHash(plan.def.id || "town");
    for (const st of plan.STREETS) {
        const cross = (st.cross || []).map(c => c.a).sort((a, b) => a - b);
        const near = u => cross.some(a => Math.abs(a - u) < 13) || u < st.a0 + 6 || u > st.a1 - 6;
        const edge = 3.5 * (st.lanes || 1), gutter = (st.boulevard ? st.outer : st.curb) - 0.75;
        for (let u = Math.ceil(st.a0 / 7) * 7; u <= st.a1; u += 7) {
            if (near(u)) continue;
            for (const side of [-1, 1]) {
                const r = hash01(th, st.id * 4099 + Math.round(u), side), j = hash01(th + 3, st.id * 4099 + Math.round(u), side);
                let kind = "", d = 0, rad = 1;
                if (r < 0.1) { kind = "gutter"; d = gutter; rad = 0.9 + j * 0.9; }
                else if (r < 0.15) { kind = "lane"; d = 0.9 + j * Math.max(0.2, edge - 1.8); rad = 1.0 + j * 1.2; }
                else if (r < 0.21) { kind = "walk"; d = st.outer + 0.8 + j * Math.max(0.1, st.walk - st.outer - 1.6); rad = 0.55 + j * 0.5; }
                if (kind) {
                    const lp = streetPt(st, u + (j - 0.5) * 3, side * d, _sp), w = plan.world(lp.x, lp.z, {});
                    P.sites.push({ x: w.x, z: w.z, y: kind === "walk" ? 0.068 : 0.048, h: plan.wh(st.h) + (j - 0.5) * 0.5, rx: rad * (kind === "gutter" ? 0.7 : 0.85 + j * 0.2), rz: rad * (kind === "gutter" ? 1.5 : 1), seed: hash01(th, st.id, Math.round(u * 3) + side), kind, hitT: -9, sx: 1, sz: 1, _d: 0 });
                }
                // leaf piles at the sidewalk's kerb edge (raked to the curb for the pickup — very Lakewood in the fall)
                const r2 = hash01(th + 11, st.id * 4099 + Math.round(u), side), j2 = hash01(th + 13, st.id * 4099 + Math.round(u), side);
                if (r2 < 0.12 && !st.boulevard) {
                    const lp = streetPt(st, u + (j2 - 0.5) * 4, side * (st.outer + 0.8), _sp), w = plan.world(lp.x, lp.z, {});
                    P.piles.push({ x: w.x, z: w.z, h: plan.wh(st.h) + (j2 - 0.5) * 0.8, r: 0.9 + j2 * 0.5, seed: j2, kicked: 0, flat: 0, _d: 0 });
                }
            }
        }
    }
    return true;
}
export function clearSites() { P.key = ""; P.k.def = null; P.sites = []; P.piles = []; P.live.length = 0; P.n = 0; if (P.mesh) P.mesh.visible = false; }

// ── the mesh ──────────────────────────────────────────────────────────────
const VS = `
attribute float aSeed;
varying vec2 vUv; varying float vSeed;
#include <common>
#include <fog_pars_vertex>
void main() {
    vUv = uv; vSeed = aSeed;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;
const FS = `
uniform vec3 uSky; uniform vec3 uDeep; uniform float uAlpha; uniform float uRain; uniform float uTime;
varying vec2 vUv; varying float vSeed;
#include <common>
#include <fog_pars_fragment>
void main() {
    vec2 c = vUv - 0.5;
    float a = atan(c.y, c.x), r = length(c) * 2.0;
    float rim = 1.0 + 0.13 * sin(a * 3.0 + vSeed * 31.0) + 0.07 * sin(a * 7.0 + vSeed * 17.0);
    float rr = r * rim;
    float edge = smoothstep(1.0, 0.72, rr);
    if (edge < 0.01) discard;
    vec3 col = mix(uSky, uDeep, 0.25 + 0.45 * rr);
    col += vec3(0.08) * smoothstep(0.98, 0.85, rr) * smoothstep(0.7, 0.9, rr);      // a bright wet lip
    // rain rings: three drops at a time, each ring spreading and fading
    float ring = 0.0;
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float ph = fract(uTime * (0.7 + 0.15 * fk) + vSeed * (3.1 + fk));
        float cell = floor(uTime * (0.7 + 0.15 * fk) + vSeed * (3.1 + fk));
        vec2 ctr = vec2(fract(sin(cell * 12.9 + fk * 7.1 + vSeed * 91.0) * 43758.5), fract(sin(cell * 78.2 + fk * 3.3 + vSeed * 57.0) * 24634.6)) * 0.7 - 0.35;
        float d = length(c - ctr);
        ring += smoothstep(0.022, 0.0, abs(d - ph * 0.3)) * (1.0 - ph);
    }
    col += vec3(0.35) * ring * uRain;
    gl_FragColor = vec4(col, edge * uAlpha);
    #include <fog_fragment>
}`;
function ensureMesh() {
    if (P.mesh) return P.mesh;
    const g = new THREE.PlaneGeometry(2, 2, 1, 1);
    g.rotateX(-Math.PI / 2);
    P.seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aSeed", P.seedAttr);
    P.mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSky: { value: new THREE.Color("#bcd4ea") }, uDeep: { value: new THREE.Color("#2a3540") }, uAlpha: { value: 0 }, uRain: { value: 0 }, uTime: { value: 0 } }]),
        vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    P.mesh = new THREE.InstancedMesh(g, P.mat, MAX);
    P.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    P.mesh.frustumCulled = false;
    P.mesh.count = 0;
    P.mesh.renderOrder = 1;
    P.mesh.name = "lifePuddles";
    P.mesh.visible = false;
    ctx.scene.add(P.mesh);
    return P.mesh;
}

// ── how much water there is ───────────────────────────────────────────────
function tickLevel(dt) {
    if (P.forced != null) { P.level = P.forced; return; }
    const raining = L.rain > 0.25;
    const target = raining ? clamp(L.wet * 1.1) : 0;
    if (target > P.level) P.level = Math.min(target, P.level + dt / 22);          // they fill over ~20 s of rain
    else P.level = Math.max(target, P.level - dt / (L.wet > 0.2 ? 400 : 200));   // and outlast the wet road
}

// ── the nearest ones into the instance buffer ─────────────────────────────
const cand = [];
function pickLive() {
    P.live.length = 0;
    cand.length = 0;
    for (let i = 0; i < P.sites.length && cand.length < 512; i++) {
        const s = P.sites[i], dx = s.x - L.x, dz = s.z - L.z;
        if (dx > RANGE || dx < -RANGE || dz > RANGE || dz < -RANGE) continue;
        s._d = dx * dx + dz * dz;
        cand.push(s);
    }
    if (cand.length > MAX) cand.sort(byDist);
    for (let i = 0; i < cand.length && i < MAX; i++) P.live.push(cand[i]);
}
const byDist = (a, b) => a._d - b._d;
function writeInstances() {
    const m = ensureMesh(), k = 0.35 + 0.65 * P.level;
    let n = 0;
    for (const s of P.live) {
        s.sx = s.rx * k; s.sz = s.rz * k;
        _e.set(0, s.h, 0);
        _m.compose(_p.set(s.x, s.y, s.z), _q.setFromEuler(_e), _s.set(s.sx, 1, s.sz));
        m.setMatrixAt(n, _m);
        P.seedAttr.array[n] = s.seed;
        n++;
    }
    m.count = n; P.n = n;
    m.instanceMatrix.needsUpdate = true;
    P.seedAttr.needsUpdate = true;
}

/** How deep the water is under (x, z): 0 (dry) … 1 (the middle of a full puddle). */
export function puddleAt(x, z, pad = 0) {
    if (!L.town || P.level < 0.06) return 0;
    let best = 0;
    for (const s of P.live) {
        const dx = x - s.x, dz = z - s.z, c = Math.cos(s.h), sn = Math.sin(s.h);
        const lx = dx * c - dz * sn, lz = dx * sn + dz * c;          // into the puddle's frame (its yaw)
        const ex = lx / (s.sx * 0.88 + pad), ez = lz / (s.sz * 0.88 + pad), q = ex * ex + ez * ez;
        if (q < 1) best = Math.max(best, (1 - q) * P.level);
    }
    return best;
}
function siteAt(x, z, pad) {
    for (const s of P.live) {
        const dx = x - s.x, dz = z - s.z, c = Math.cos(s.h), sn = Math.sin(s.h);
        const lx = dx * c - dz * sn, lz = dx * sn + dz * c, ex = lx / (s.sx + pad), ez = lz / (s.sz + pad);
        if (ex * ex + ez * ez < 1) return s;
    }
    return null;
}

// ── splashes ──────────────────────────────────────────────────────────────
const FOOT_LINES = ["My socks!! 🧦", "Brand new shoes. WERE brand new.", "Worth it. 💦", "Ima's going to see these shoes…", "Splish. Splash. Oy."];
const SOAK = ["MY SHEITEL!! 😱", "This hat was NEW!", "LULU! I'm telling your mother!", "*drip* …really?", "My Shabbos shoes!!", "Gevalt — SOAKED!"];
/** A step in a puddle (steps.js calls it on the beat). */
export function footSplash(v) {
    const fx = ctx.car && ctx.car.fx;
    stats.splashes++;
    if (fx) for (let k = 0; k < 5; k++) fx.emit(L.x + rand(-0.2, 0.2), 0.1, L.z + rand(-0.2, 0.2), rand(-1.2, 1.2), rand(1.4, 2.6), rand(-1.2, 1.2), rand(0.18, 0.3), rand(0.35, 0.55), DROP);
}
/** She landed (a jump) — in a puddle: a big splash. */
export function landed() {
    if (!L.foot || puddleAt(L.x, L.z) < 0.15) return false;
    const fx = ctx.car && ctx.car.fx;
    stats.splashes++;
    if (fx) for (let k = 0; k < 18; k++) { const a = Math.random() * 6.283, sp = rand(1.5, 3.5); fx.emit(L.x, 0.12, L.z, Math.cos(a) * sp, rand(2.2, 4.2), Math.sin(a) * sp, rand(0.22, 0.4), rand(0.5, 0.8), DROP); }
    if (soundsOn() && !L.quiet) play("lifeSplashBig", { x: L.x, y: 0.1, z: L.z }, { gain: 0.8 });
    if (ctx.time > P.lineT) { P.lineT = ctx.time + 75; footLine(FOOT_LINES[Math.floor(Math.random() * FOOT_LINES.length)]); }
    return true;
}
const _pt = { x: 0, y: 0, z: 0 };
function carSplash() {
    const car = ctx.car;
    if (!car || L.foot || L.speed < 5.5) return;
    const s = siteAt(car.pos.x, car.pos.z, 0.9);
    if (!s || ctx.time - s.hitT < 1.6 || P.level < 0.15) return;
    s.hitT = ctx.time;
    stats.carSplashes++; P.carHits++;
    const fx = car.fx, h = car.h, fxh = Math.sin(h), fzh = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    const k = clamp(L.speed / 18, 0.4, 1.4) * (0.5 + 0.5 * P.level);
    if (fx) for (let i = 0; i < 30; i++) {
        const side = i & 1 ? 1 : -1, out = rand(2.5, 5.5) * k, back = rand(-0.5, 2) * k;
        fx.emit(car.pos.x + rx * side * 0.9 - fxh * rand(-1, 1), 0.2, car.pos.z + rz * side * 0.9 - fzh * rand(-1, 1),
            rx * side * out - fxh * back, rand(2, 4.5) * k, rz * side * out - fzh * back, rand(0.35, 0.8), rand(0.5, 0.9), SPRAY);
    }
    _pt.x = car.pos.x; _pt.y = 0.2; _pt.z = car.pos.z;
    if (soundsOn() && !L.quiet) play("lifeSplashBig", _pt, { gain: clamp(0.5 + L.speed / 30, 0.5, 1) });
    // somebody standing at the kerb right there?
    if (ctx.time > P.soakT && ctx.town && ctx.town.people && ctx.banter && ctx.banter.bubble) {
        let who = null;
        try { for (const p of ctx.town.people()) if (Math.hypot(p.x - s.x, p.z - s.z) < 5.5) { who = p; break; } } catch (e) { who = null; }
        if (who) {
            P.soakT = ctx.time + 25;
            stats.soaked++;
            dummy.position.set(who.x, 0, who.z); dummy.updateMatrixWorld();
            ctx.banter.bubble(SOAK[stats.soaked % SOAK.length], dummy, { dur: 2.6, cls: "angry" });
            for (let i = 0; i < 10 && fx; i++) fx.emit(who.x + rand(-0.4, 0.4), rand(0.6, 1.6), who.z + rand(-0.4, 0.4), rand(-0.6, 0.6), rand(0.5, 1.5), rand(-0.6, 0.6), rand(0.25, 0.4), 0.6, DROP);
        }
    }
}

// ── per frame ─────────────────────────────────────────────────────────────
export function tickPuddles(dt) {
    tickLevel(dt);
    const show = L.on && L.town && P.level > 0.03 && ensureSites();
    if (!show) { if (P.mesh) P.mesh.visible = false; P.live.length = 0; P.n = 0; return; }
    ensureMesh();
    P.scanT -= dt;
    const moved = Math.abs(L.x - P.sx) + Math.abs(L.z - P.sz);
    if (P.scanT <= 0 || moved > 6) { P.scanT = 0.5; P.sx = L.x; P.sz = L.z; pickLive(); }
    writeInstances();
    const fog = ctx.scene.fog, U = P.mat.uniforms;
    if (fog && fog.color) {
        U.uSky.value.copy(fog.color).multiplyScalar(1.05);
        U.uDeep.value.copy(fog.color).multiplyScalar(0.28);
        U.uDeep.value.b += 0.04;
    }
    U.uAlpha.value = clamp(P.level * 1.6) * 0.82;
    U.uRain.value = clamp(L.rain * 1.5);
    U.uTime.value = L.time;
    P.mesh.visible = P.n > 0;
    carSplash();
}
export function puddleInfo() { return { level: +P.level.toFixed(2), sites: P.sites.length, drawn: P.n, visible: !!(P.mesh && P.mesh.visible), carHits: P.carHits }; }
export function forceLevel(v) { P.forced = v == null ? null : clamp(v); return P.forced; }
/** Tests: the nearest live puddle of a kind ("gutter" | "lane" | "walk" | "" any) → {x, z, h} or null. */
export function nearestPuddle(kind = "") {
    let best = null, bd = 1e9;
    for (const s of P.live) { if (kind && s.kind !== kind) continue; const d = Math.hypot(s.x - L.x, s.z - L.z); if (d < bd) { bd = d; best = s; } }
    return best ? { x: best.x, z: best.z, h: best.h, kind: best.kind, d: +bd.toFixed(1) } : null;
}
