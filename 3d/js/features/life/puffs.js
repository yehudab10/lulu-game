// features/life — 💨 SMOKE AND STEAM (round 2): the town breathes.
//   🏠 chimney smoke on cold days (the device's date: Nov–Mar, winter, snow — `?lifeCold=1|0`): about half the houses
//      with a chimney (Lakewood's duplexes, Midwood's detached houses; more of them at night) send up a lazy grey
//      plume that leans with the wind (wind.js' gusts push it over)
//   🕳️ Midwood's manholes: iron covers in the lanes, and most of them steam (a NYC street in every weather — thicker
//      when it's cold); her car punches through the cloud and swirls it; walk into one and Lulu has a word about it
//   🍞 a warm puff off the bakery's oven vent (Midwood's CHALLAH-DAY INN) and the pizza shop's — walk past and,
//      now and then, Lulu smells it ("Is that KUGEL? It's not even Friday!")
//   🚨 (alarm.js borrows the same mesh for a bumped car's blinking hazard lights: `glow()`)
// One InstancedMesh of soft camera-facing puffs (one draw call; premultiplied blending, so the alarm's glows are
// additive in the same pass) + one of manhole covers (Midwood only). Puffs are typed arrays: nothing allocated per frame.
// Everything is hashed from the town's plan / build: the same chimneys, manholes and vents for friends in a party.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { canvasTex } from "../../world.js";
import { L, hash01, strHash, rand, clamp, stats, soundsOn, coldNow, homeWorld, luluLine } from "./common.js";
import { loop } from "./sounds.js";
import { P as PS, ensureSites, streetPt } from "./puddles.js";
import { WS } from "./wind.js";

// ── tuning ────────────────────────────────────────────────────────────────
export const PUFF = {
    chimneyLit: 0.5, chimneyLitNight: 0.75,     // the share of chimneys smoking (by day / at night)
    chimneyR: 150, chimneyN: 10,                // drawn within (m), at most
    steamR: 95, steamN: 5, steamShare: 0.7,     // manholes that steam
    manholeR: 90, manholeN: 16,
    ventR: 80,
};
const MAX = 220, MAXG = 16;
/** Chimney tops per house model (three.js model frame: x = model +X, y up, z out of the front) — from the Blender
 *  builders (assets_town.py › build_duplex: chim at (−w·0.3, d·0.2, wh + 1.9) ± 0.7; assets_midwood.py › build_house). */
const CHIMNEY = { town_duplex: [-3.3, 8.75, -2.0], town_mw_house: [-5.25, 8.95, 0.5] };
/** Oven vents on the roof of a shop with a spot (model frame; the spot is 2.6 m out from its lot line). */
const VENTS = { bakery: { at: [3.4, 7.7, -3.0], back: 10.6, lines: "bakery" }, pizza: { at: [-4.0, 5.35, -3.2], back: 10.6, lines: "pizza" } };
const LINES = {
    bakery: ["Is that KUGEL? It's not even Friday! 🤤", "Fresh challah. I'm not hungry. I'm NOT hungry.", "Smells like Bubbe's kitchen in there.", "Rugelach. I can SMELL the rugelach."],
    bakeryFri: ["Fresh challah… it must be Erev Shabbos! 🍞", "The challah line is already around the block. Classic Friday."],
    pizza: ["Pizza Shmizza… my diet starts Sunday. 🍕", "Smells like a slice with extra cheese. And regret."],
    steam: ["Ew — warm sewer fog. 🤢", "It's like the subway sneezed on me.", "Very mysterious. Very smelly.", "My hair! The FRIZZ! 😩"],
};

export const PF = {
    n: 0, x: new Float32Array(MAX), y: new Float32Array(MAX), z: new Float32Array(MAX), vx: new Float32Array(MAX), vy: new Float32Array(MAX), vz: new Float32Array(MAX),
    age: new Float32Array(MAX), life: new Float32Array(MAX), s0: new Float32Array(MAX), s1: new Float32Array(MAX), a0: new Float32Array(MAX),
    r: new Float32Array(MAX), g: new Float32Array(MAX), b: new Float32Array(MAX), spin: new Float32Array(MAX), kind: new Uint8Array(MAX),
};
/** This frame's glows (alarm.js writes them, the mesh draws them after the puffs). */
export const GLOW = { n: 0, d: new Float32Array(MAXG * 7) };
export function glow(x, y, z, r, g, b, size) {
    if (GLOW.n >= MAXG) return false;
    const o = GLOW.n++ * 7, d = GLOW.d;
    d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r; d[o + 4] = g; d[o + 5] = b; d[o + 6] = size;
    return true;
}
const K = { CHIM: 1, STEAM: 2, VENT: 3 };
export const PU = { key: "", homesKey: "", chimneys: [], manholes: [], vents: [], live: [], liveMh: [], scanT: 0, sx: 1e9, sz: 1e9, mesh: null, mhMesh: null,
    dataAttr: null, drawn: 0, mhDrawn: 0, hiss: null, hissPt: { x: 0, y: 0.1, z: 0 }, smelled: new Set(), steamed: 0, emitted: 0 };

// ── the sites ─────────────────────────────────────────────────────────────
function buildSites() {
    const plan = ctx.town && ctx.town.plan;
    if (!plan || !ensureSites()) return false;
    // (ctx.town.homes maps every house to the world: read it only when the town changed — or every 2 s while it's empty)
    if (PU.key === PS.key && (PU.nHomes > 0 || L.time < PU.retry)) return true;
    const homes = ctx.town.homes || [];
    PU.key = PS.key; PU.nHomes = homes.length; PU.retry = L.time + 2;
    PU.chimneys = []; PU.manholes = []; PU.vents = []; PU.live.length = 0; PU.liveMh.length = 0; PU.sx = PU.sz = 1e9; PU.smelled.clear();
    const th = strHash(plan.def.id || "town"), w = {};
    homes.forEach((h, i) => {
        const c = CHIMNEY[h.key];
        if (!c) return;
        homeWorld(h, c[0], c[2], w);
        PU.chimneys.push({ x: w.x, y: c[1], z: w.z, lit: hash01(th + 21, i, 7), seed: hash01(th + 23, i, 3), t: hash01(th, i, 5), _d: 0 });
    });
    // Midwood's manholes: in the lanes, ~4 % per 7 m, never at a crossing (the same walk as the puddles)
    if (plan.def.id === "midwood") {
        for (const st of plan.STREETS) {
            const cross = (st.cross || []).map(c => c.a);
            const near = u => cross.some(a => Math.abs(a - u) < 11) || u < st.a0 + 8 || u > st.a1 - 8;
            for (let u = Math.ceil(st.a0 / 7) * 7 + 3; u <= st.a1; u += 7) {
                if (near(u)) continue;
                const r = hash01(th + 31, st.id * 4099 + Math.round(u), 1);
                if (r > 0.045) continue;
                const j = hash01(th + 33, st.id * 4099 + Math.round(u), 2), side = j < 0.5 ? -1 : 1;
                const lp = streetPt(st, u, side * (1.5 + j * 0.6), {}), p = plan.world(lp.x, lp.z, {});
                PU.manholes.push({ x: p.x, z: p.z, h: plan.wh(st.h), steam: hash01(th + 35, st.id, Math.round(u)) < PUFF.steamShare, seed: j, t: j * 2, hot: 0, _d: 0 });
            }
        }
    }
    for (const id in VENTS) {
        const sp = ctx.town.spot && ctx.town.spot(id);
        if (!sp) continue;
        const V = VENTS[id], cx = sp.x - sp.nx * V.back, cz = sp.z - sp.nz * V.back;
        const h = { x: cx, z: cz, ux: sp.ux, uz: sp.uz, nx: sp.nx, nz: sp.nz };
        homeWorld(h, V.at[0], V.at[2], w);
        PU.vents.push({ id, x: w.x, y: V.at[1], z: w.z, fx: sp.x, fz: sp.z, t: 0, _d: 0 });
    }
    return true;
}

// ── the meshes ────────────────────────────────────────────────────────────
const VS = `
attribute vec3 aData;
varying vec2 vUv; varying float vA; varying float vSpin; varying float vGlow; varying vec3 vCol;
#include <common>
#include <fog_pars_vertex>
void main() {
    vUv = uv; vA = aData.x; vSpin = aData.y; vGlow = aData.z;
#ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
#else
    vCol = vec3(1.0);
#endif
    vec4 c = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float s = length(instanceMatrix[0].xyz);
    vec4 mvPosition = modelViewMatrix * c;
    float cs = cos(aData.y), sn = sin(aData.y);
    mvPosition.xy += vec2(position.x * cs - position.y * sn, position.x * sn + position.y * cs) * s;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`;
const FS = `
varying vec2 vUv; varying float vA; varying float vSpin; varying float vGlow; varying vec3 vCol;
#include <common>
#include <fog_pars_fragment>
void main() {
    vec2 c = vUv - 0.5;
    float r = length(c) * 2.0, a;
    vec3 col = vCol;
    if (vGlow > 0.5) {
        a = smoothstep(1.0, 0.0, r); a *= a;
        col *= 1.0 + 1.6 * smoothstep(0.45, 0.0, r);
    } else {
        float ang = atan(c.y, c.x);
        float lump = 1.0 + 0.13 * sin(ang * 3.0 + vSpin * 5.0) + 0.08 * sin(ang * 5.0 - vSpin * 3.0);
        a = smoothstep(1.0, 0.3, r * lump);
        col *= 0.86 + 0.22 * (c.y + 0.5);              // lit from above
    }
    a *= vA;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * a, a * (1.0 - vGlow));     // premultiplied: smoke blends, a glow adds
}`;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
function ensureMesh() {
    if (PU.mesh) return PU.mesh;
    const g = new THREE.PlaneGeometry(1, 1);
    PU.dataAttr = new THREE.InstancedBufferAttribute(new Float32Array((MAX + MAXG) * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aData", PU.dataAttr);
    const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
        vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    PU.mesh = new THREE.InstancedMesh(g, mat, MAX + MAXG);
    PU.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    PU.mesh.setColorAt(0, _c.set("#ffffff"));
    PU.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    PU.mesh.frustumCulled = false; PU.mesh.castShadow = false;
    PU.mesh.count = 0; PU.mesh.renderOrder = 2; PU.mesh.visible = false;
    PU.mesh.name = "lifePuffs";
    ctx.scene.add(PU.mesh);
    return PU.mesh;
}
const coverTex = () => canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#3b3a38"; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 1, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#5a5853"; g.lineWidth = 5; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    for (let k = -3; k <= 3; k++) {           // the waffle pattern
        g.beginPath(); g.moveTo(w / 2 + k * 13, 14); g.lineTo(w / 2 + k * 13, h - 14); g.stroke();
        g.beginPath(); g.moveTo(14, h / 2 + k * 13); g.lineTo(w - 14, h / 2 + k * 13); g.stroke();
    }
    g.fillStyle = "#4a4844"; g.fillRect(w / 2 - 30, h / 2 - 10, 60, 20);
    g.fillStyle = "#77736b"; g.font = "bold 13px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("CON ED", w / 2, h / 2 + 1);
}, false);
function ensureMh() {
    if (PU.mhMesh) return PU.mhMesh;
    const g = new THREE.CircleGeometry(0.45, 18);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ map: coverTex(), transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    PU.mhMesh = new THREE.InstancedMesh(g, mat, PUFF.manholeN);
    PU.mhMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    PU.mhMesh.frustumCulled = false; PU.mhMesh.castShadow = false; PU.mhMesh.receiveShadow = true;
    PU.mhMesh.count = 0; PU.mhMesh.visible = false; PU.mhMesh.name = "lifeManholes";
    ctx.scene.add(PU.mhMesh);
    return PU.mhMesh;
}

// ── puffs ─────────────────────────────────────────────────────────────────
function addPuff(kind, x, y, z, vx, vy, vz, life, s0, s1, a0, r, g, b) {
    if (PF.n >= MAX) return false;
    const i = PF.n++;
    PF.kind[i] = kind; PF.x[i] = x; PF.y[i] = y; PF.z[i] = z; PF.vx[i] = vx; PF.vy[i] = vy; PF.vz[i] = vz;
    PF.age[i] = 0; PF.life[i] = life; PF.s0[i] = s0; PF.s1[i] = s1; PF.a0[i] = a0; PF.r[i] = r; PF.g[i] = g; PF.b[i] = b; PF.spin[i] = Math.random() * 6.28;
    PU.emitted++;
    return true;
}
const PKEYS = ["kind", "x", "y", "z", "vx", "vy", "vz", "age", "life", "s0", "s1", "a0", "r", "g", "b", "spin"];
function killPuff(i) {
    const j = --PF.n;
    if (i === j) return;
    for (let k = 0; k < PKEYS.length; k++) { const a = PF[PKEYS[k]]; a[i] = a[j]; }
}

// ── which emitters are live (the nearest, re-picked every 0.5 s or 8 m) ───
const byD = (a, b) => a._d - b._d;
const tmp = [];
function nearest(list, R, n, out, filter) {
    tmp.length = 0;
    for (let i = 0; i < list.length; i++) {
        const s = list[i], dx = s.x - L.x, dz = s.z - L.z;
        if (dx > R || dx < -R || dz > R || dz < -R || (filter && !filter(s))) continue;
        s._d = dx * dx + dz * dz;
        tmp.push(s);
    }
    tmp.sort(byD);
    for (let i = 0; i < tmp.length && out.length < n; i++) out.push(tmp[i]);
}
let wantChim = false, litShare = 0;
const chimOK = s => s.lit < litShare;
function pickLive() {
    PU.live.length = 0; PU.liveMh.length = 0;
    if (wantChim) nearest(PU.chimneys, PUFF.chimneyR, PUFF.chimneyN, PU.live, chimOK);
    nearest(PU.manholes, PUFF.manholeR, PUFF.manholeN, PU.liveMh, null);
    for (const v of PU.vents) { const dx = v.x - L.x, dz = v.z - L.z; if (dx * dx + dz * dz < PUFF.ventR * PUFF.ventR) PU.live.push(v); }
    let k = 0;
    for (const m of PU.liveMh) if (m.steam && k < PUFF.steamN) { PU.live.push(m); k++; }
}

// ── per frame ─────────────────────────────────────────────────────────────
const SMOKE = [0.78, 0.77, 0.76], STEAM = [0.95, 0.96, 0.97], WARM = [0.98, 0.95, 0.9];
function emit(dt, cold, night) {
    const wx = WS.wx * 0.35, wz = WS.wz * 0.35;
    const dim = 1 - night * 0.55;
    for (const s of PU.live) {
        s.t -= dt;
        if (s.t > 0) continue;
        if (s.lit !== undefined) {               // a chimney
            s.t = rand(0.45, 0.7);
            addPuff(K.CHIM, s.x + rand(-0.1, 0.1), s.y, s.z + rand(-0.1, 0.1), wx + rand(-0.15, 0.15), rand(0.7, 1.0), wz + rand(-0.15, 0.15),
                rand(4.2, 5.6), rand(0.45, 0.6), rand(2.2, 3.0), 0.55, SMOKE[0] * dim, SMOKE[1] * dim, SMOKE[2] * dim);
        } else if (s.steam !== undefined) {      // a manhole
            s.t = rand(0.14, 0.22) / (cold ? 1.25 : 1);
            const a = (cold ? 0.5 : 0.36) + (L.wet > 0.3 ? 0.08 : 0);
            addPuff(K.STEAM, s.x + rand(-0.25, 0.25), 0.15, s.z + rand(-0.25, 0.25), wx + rand(-0.25, 0.25), rand(1.0, 1.5), wz + rand(-0.25, 0.25),
                rand(1.8, 2.6), rand(0.5, 0.7), rand(1.9, 2.6), a, STEAM[0] * dim, STEAM[1] * dim, STEAM[2] * dim);
        } else {                                 // an oven vent
            s.t = rand(0.5, 0.8);
            addPuff(K.VENT, s.x, s.y, s.z, wx * 0.5, rand(0.6, 0.9), wz * 0.5, rand(2.6, 3.4), rand(0.35, 0.45), rand(1.4, 1.9), 0.45, WARM[0] * dim, WARM[1] * dim, WARM[2] * dim);
        }
    }
}
function simulate(dt) {
    const car = ctx.car, carOn = !L.foot && car && L.speed > 3;
    const cx = carOn ? car.pos.x : 0, cz = carOn ? car.pos.z : 0, cvx = carOn ? car.vx || 0 : 0, cvz = carOn ? car.vz || 0 : 0;
    const wx = WS.wx, wz = WS.wz, gust = Math.hypot(wx, wz);
    for (let i = PF.n - 1; i >= 0; i--) {
        PF.age[i] += dt;
        if (PF.age[i] >= PF.life[i]) { killPuff(i); continue; }
        const drag = Math.exp(-0.6 * dt);
        PF.vx[i] = PF.vx[i] * drag + wx * 0.25 * dt * (gust > 1 ? 1 : 0.3);
        PF.vz[i] = PF.vz[i] * drag + wz * 0.25 * dt * (gust > 1 ? 1 : 0.3);
        PF.vy[i] *= Math.exp(-0.25 * dt);
        // her car punches through a cloud: it's dragged along + pushed aside
        if (carOn && PF.y[i] < 3.2) {
            const dx = PF.x[i] - cx, dz = PF.z[i] - cz, d2 = dx * dx + dz * dz;
            if (d2 < 9) {
                const d = Math.sqrt(d2) || 1, k = (1 - d / 3) * dt * 4;
                PF.vx[i] += (cvx * 0.5 + dx / d * 3) * k; PF.vz[i] += (cvz * 0.5 + dz / d * 3) * k; PF.vy[i] += 0.6 * k;
            }
        }
        PF.x[i] += PF.vx[i] * dt; PF.y[i] += PF.vy[i] * dt; PF.z[i] += PF.vz[i] * dt;
        PF.spin[i] += dt * 0.25;
    }
}
function draw() {
    const m = ensureMesh(), da = PU.dataAttr.array;
    let n = 0;
    for (let i = 0; i < PF.n; i++) {
        const u = PF.age[i] / PF.life[i];
        const size = PF.s0[i] + (PF.s1[i] - PF.s0[i]) * Math.sqrt(u);
        const a = PF.a0[i] * Math.min(1, u * 6) * (1 - u) * (1 - u);
        _m.makeScale(size, size, size); _m.setPosition(PF.x[i], PF.y[i], PF.z[i]);
        m.setMatrixAt(n, _m);
        m.setColorAt(n, _c.setRGB(PF.r[i], PF.g[i], PF.b[i]));
        da[n * 3] = a; da[n * 3 + 1] = PF.spin[i]; da[n * 3 + 2] = 0;
        n++;
    }
    const d = GLOW.d;
    for (let k = 0; k < GLOW.n; k++) {
        const o = k * 7, s = d[o + 6];
        _m.makeScale(s, s, s); _m.setPosition(d[o], d[o + 1], d[o + 2]);
        m.setMatrixAt(n, _m);
        m.setColorAt(n, _c.setRGB(d[o + 3], d[o + 4], d[o + 5]));
        da[n * 3] = 1; da[n * 3 + 1] = 0; da[n * 3 + 2] = 1;
        n++;
    }
    GLOW.n = 0;
    m.count = n; PU.drawn = n;
    m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
    m.instanceColor.needsUpdate = true;
    PU.dataAttr.needsUpdate = true;
}
function drawManholes() {
    if (!PU.liveMh.length) { if (PU.mhMesh) PU.mhMesh.visible = false; PU.mhDrawn = 0; return; }
    const m = ensureMh();
    let n = 0;
    for (const s of PU.liveMh) {
        _e.set(0, s.h + s.seed * 3, 0);
        _m.compose(_p.set(s.x, 0.045, s.z), _q.setFromEuler(_e), _s.set(1, 1, 1));
        m.setMatrixAt(n++, _m);
    }
    m.count = n; PU.mhDrawn = n;
    m.visible = n > 0;
    m.instanceMatrix.needsUpdate = true;
}
/** Lulu notices: walking into the steam, past the bakery's / the pizza shop's vent (shared line budget). */
function notice() {
    if (!L.foot) return;
    for (const s of PU.liveMh) {
        if (!s.steam) continue;
        const d = Math.hypot(s.x - L.x, s.z - L.z);
        if (d < 1.1) { PU.steamed++; if (!PU.smelled.has("steam")) { const l = LINES.steam; if (luluLine(l[Math.floor(Math.random() * l.length)])) PU.smelled.add("steam"); } }
        break;
    }
    for (const v of PU.vents) {
        if (PU.smelled.has(v.id) || Math.hypot(v.fx - L.x, v.fz - L.z) > 7) continue;
        const fri = v.id === "bakery" && new Date().getDay() === 5;
        const l = LINES[fri ? "bakeryFri" : VENTS[v.id].lines];
        if (luluLine(l[Math.floor(Math.random() * l.length)], 2.8)) PU.smelled.add(v.id);
    }
}
function hissFor() {
    let best = null, bd = 12;
    for (const s of PU.liveMh) { if (!s.steam) continue; const d = Math.hypot(s.x - L.x, s.z - L.z); if (d < bd) { bd = d; best = s; } }
    const want = best && soundsOn() && !L.quiet;
    if (want) {
        PU.hissPt.x = best.x; PU.hissPt.z = best.z;
        if (!PU.hiss || !PU.hiss.alive) PU.hiss = loop("lifeHiss", PU.hissPt, { gain: 1 });
    } else if (PU.hiss) PU.hiss = PU.hiss.stop(0.5) || null;
}
export function tickPuffs(dt) {
    const want = L.on && L.town && buildSites();
    if (!want) { puffsHide(); return; }
    const cold = coldNow(), night = L.night;
    wantChim = cold && L.rain < 0.6;
    litShare = night > 0.5 ? PUFF.chimneyLitNight : PUFF.chimneyLit;
    PU.scanT -= dt;
    if (PU.scanT <= 0 || Math.abs(L.x - PU.sx) + Math.abs(L.z - PU.sz) > 8) { PU.scanT = 0.5; PU.sx = L.x; PU.sz = L.z; pickLive(); }
    emit(dt, cold, night);
    simulate(dt);
    draw();
    drawManholes();
    notice();
    hissFor();
    stats.puffs = PF.n;
}
/** Off the stage: no puffs left hanging, the hiss stops (the sites stay for the same town). */
export function puffsHide() {
    PF.n = 0; GLOW.n = 0;
    if (PU.mesh) { PU.mesh.visible = false; PU.mesh.count = 0; }
    if (PU.mhMesh) PU.mhMesh.visible = false;
    PU.live.length = 0; PU.liveMh.length = 0; PU.drawn = 0; PU.mhDrawn = 0; PU.sx = PU.sz = 1e9;
    if (PU.hiss) PU.hiss = PU.hiss.stop(0.3) || null;
}
/** A glow-only frame (alarm.js away from town — none today: alarms are a town thing) */
export function puffsClear() { puffsHide(); PU.key = ""; PU.chimneys = []; PU.manholes = []; PU.vents = []; }
export function puffInfo() {
    let chim = 0, steam = 0, vent = 0, lo = 99, hi = 0;
    for (let i = 0; i < PF.n; i++) { const k = PF.kind[i]; if (k === K.CHIM) { chim++; lo = Math.min(lo, PF.y[i]); hi = Math.max(hi, PF.y[i]); } else if (k === K.STEAM) steam++; else if (k === K.VENT) vent++; }
    return { puffs: PF.n, chim, steam, vent, chimLo: +lo.toFixed(2), chimHi: +hi.toFixed(2), drawn: PU.drawn, visible: !!(PU.mesh && PU.mesh.visible), chimneys: PU.chimneys.length, smoking: PU.live.filter(s => s.lit !== undefined).length,
        manholes: PU.manholes.length, manholesDrawn: PU.mhDrawn, steaming: PU.live.filter(s => s.steam !== undefined).length, vents: PU.vents.map(v => v.id), cold: L.on ? coldNow() : null,
        hiss: !!(PU.hiss && PU.hiss.alive), steamed: PU.steamed, smelled: [...PU.smelled] };
}
/** Tests: the nearest chimney that's smoking / a steaming manhole / a vent (id) → {x, y, z} or null. */
export function nearestPuff(kind = "chimney") {
    let best = null, bd = 1e9;
    const list = kind === "chimney" ? PU.live.filter(s => s.lit !== undefined) : kind === "manhole" ? PU.liveMh.filter(s => s.steam) : PU.vents.filter(v => v.id === kind);
    for (const s of list) { const d = Math.hypot(s.x - L.x, s.z - L.z); if (d < bd) { bd = d; best = s; } }
    return best ? { x: best.x, y: best.y || 0, z: best.z, fx: best.fx, fz: best.fz, h: best.h, d: +bd.toFixed(1) } : null;
}
