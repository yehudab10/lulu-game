// features/life — 🪟 WINDOWS AT DUSK (round 3): the town comes home for the evening.
// The town engine warms EVERY house window at once as the sun goes down (one shared material — cheap, and right far
// away). Up close that reads like a switch. So, over the houses near her, life lays its own pane on each front window:
//   · a house's rooms light up ONE BY ONE as it gets dark (each house has its own moment, each room a beat after the
//     last) — until then its glass stays dusky, the sky's last light in it
//   · a lit room is a warm lamp-in-the-middle glow, some with the curtains half drawn
//   · in ~1 house in 9 a ground-floor room is lit by the TV instead: a cool blue flicker
//   · late at night some of them go dark again (bedtime), and at dawn the rest switch off one by one
// Houses the town left dark (nobody home — town/build.js `dark`) stay dark. Beyond ~110 m the town's own glow takes
// over (a soft hand-over, no line). ONE InstancedMesh (≤ 360 panes, the houses nearest first), a tiny shader; the panes'
// matrices are written only when the set changes (every 0.5 s or 8 m), per frame just a vec4 each. The pane layout comes
// from each house model's own geometry (its front-facing "Window" faces), measured once per model.
// Hashed from the town's build: the same houses light up in the same order for friends in a party (each on their own sky).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models } from "../../models.js";
import { L, hash01, strHash, clamp } from "./common.js";

export const WIN = {
    from: 0.1, to: 0.68,        // the night level (atmos 0..1) the first / the last house lights up at
    litShare: 0.84,             // the share of panes that light up at all (the rest: an empty room)
    tvShare: 0.11,              // houses with the TV on (a ground-floor pane)
    bedShare: 0.34, bed: [15, 110],   // panes that go dark after this long at full night (s)
    R: 110, fadeR: 30,          // drawn within (m); faded out over the last fadeR
    max: 360,
};
const MAX = 360;

// ── the panes of a house model: front-facing Window faces, merged into rectangles (model frame) ──
const PANES = new Map();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _v = new THREE.Vector3();
export function panesOf(key) {
    if (PANES.has(key)) return PANES.get(key);
    const t = models[key];
    if (!t) return null;                         // (not loaded yet: ask again later)
    t.updateMatrixWorld(true);
    const inv = t.matrixWorld.clone().invert();
    const boxes = [];
    t.traverse(o => {
        if (!o.isMesh || !o.geometry) return;
        const mats = [].concat(o.material);
        if (!mats.some(m => m && m.name === "Window")) return;
        const m = inv.clone().multiply(o.matrixWorld), g = o.geometry, pos = g.attributes.position, idx = g.index;
        const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
        for (const gr of groups) {
            const mat = mats[gr.materialIndex] || mats[0];
            if (!mat || mat.name !== "Window") continue;
            for (let i = gr.start; i < gr.start + gr.count; i += 3) {
                const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
                _a.fromBufferAttribute(pos, ia).applyMatrix4(m); _b.fromBufferAttribute(pos, ib).applyMatrix4(m); _c.fromBufferAttribute(pos, ic).applyMatrix4(m);
                _n.subVectors(_b, _a).cross(_v.subVectors(_c, _a)).normalize();
                if (_n.z < 0.8) continue;
                const bx = { x0: Math.min(_a.x, _b.x, _c.x), x1: Math.max(_a.x, _b.x, _c.x), y0: Math.min(_a.y, _b.y, _c.y), y1: Math.max(_a.y, _b.y, _c.y), z: Math.max(_a.z, _b.z, _c.z) };
                const hit = boxes.find(q => bx.x0 <= q.x1 + 0.02 && bx.x1 >= q.x0 - 0.02 && bx.y0 <= q.y1 + 0.02 && bx.y1 >= q.y0 - 0.02 && Math.abs(bx.z - q.z) < 0.05);
                if (hit) { hit.x0 = Math.min(hit.x0, bx.x0); hit.x1 = Math.max(hit.x1, bx.x1); hit.y0 = Math.min(hit.y0, bx.y0); hit.y1 = Math.max(hit.y1, bx.y1); hit.z = Math.max(hit.z, bx.z); }
                else boxes.push(bx);
            }
        }
    });
    const panes = boxes.filter(b => b.x1 - b.x0 > 0.45 && b.y1 - b.y0 > 0.45);
    const yMin = panes.length ? Math.min(...panes.map(b => b.y0)) : 0;
    const out = panes.map(b => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, z: b.z, w: b.x1 - b.x0, h: b.y1 - b.y0, low: b.y0 < yMin + 0.6 }))
        .sort((p, q) => p.y - q.y || p.x - q.x);
    PANES.set(key, out);
    return out;
}

// ── the town's panes ──────────────────────────────────────────────────────
export const WN = { key: "", homesN: 0, retry: 0, houses: [], live: [], liveN: 0, scanT: 0, sx: 1e9, sz: 1e9, mesh: null, data: null, uTime: { value: 0 },
    fullT: 0, drawn: 0, lit: 0, tv: 0, dark: 0, panes: 0, flips: 0, missing: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();

function buildHouses() {
    const T = ctx.town;
    const id = (T && T.id) || "";
    const homes = T.homes || [];
    if (WN.key === id && (WN.homesN > 0 && !WN.missing || L.time < WN.retry)) return WN.houses.length > 0;
    WN.key = id; WN.homesN = homes.length; WN.retry = L.time + 2; WN.missing = 0;
    WN.houses = []; WN.live.length = 0; WN.liveN = 0; WN.sx = WN.sz = 1e9; WN.panes = 0;
    const th = strHash(id + ":windows");
    homes.forEach((h, i) => {
        if (h.dark) return;                       // nobody home (the town's own choice)
        const P = panesOf(h.key);
        if (!P) { WN.missing++; return; }
        if (!P.length) return;
        const rot = typeof h.rot === "number" ? h.rot : Math.atan2(h.nx, h.nz);
        const c = Math.cos(rot), s = Math.sin(rot);
        const base = WIN.from + hash01(th, i, 1) * (WIN.to - WIN.from - 0.06);
        const tvAt = hash01(th, i, 2) < WIN.tvShare ? Math.floor(hash01(th, i, 3) * P.filter(p => p.low).length) : -1;
        let lowK = 0;
        const panes = P.map((p, j) => {
            const lz = p.z + 0.014;
            const pane = {
                x: h.x + p.x * c + lz * s, y: p.y, z: h.z - p.x * s + lz * c, w: p.w, hgt: p.h, rot,
                on: base + hash01(th + 1, i, j) * 0.07,
                lit: hash01(th + 2, i, j) < WIN.litShare,
                tv: false,
                bed: hash01(th + 3, i, j) < WIN.bedShare ? WIN.bed[0] + hash01(th + 4, i, j) * (WIN.bed[1] - WIN.bed[0]) : 1e9,
                seed: hash01(th + 5, i, j), k: 0,
            };
            if (p.low) { if (lowK === tvAt) { pane.tv = true; pane.lit = true; pane.bed = 1e9; } lowK++; }
            return pane;
        });
        WN.houses.push({ x: h.lotX != null ? h.lotX : h.x, z: h.lotZ != null ? h.lotZ : h.z, nx: h.nx, nz: h.nz, cx: h.x, cz: h.z, panes, _d: 0 });
        WN.panes += panes.length;
    });
    return WN.houses.length > 0;
}

// ── the mesh ──────────────────────────────────────────────────────────────
const VS = `
attribute vec4 aData;
varying vec2 vUv; varying vec4 vD; varying float vDepth;
void main() {
    vUv = uv; vD = aData;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
}`;
const FS = `
uniform float uTime;
varying vec2 vUv; varying vec4 vD; varying float vDepth;
#include <common>
#include <fog_pars_fragment>
void main() {
    float cover = vD.x, lit = vD.y, seed = fract(vD.w), tv = step(1.0, vD.w);
    vec2 c = vUv - 0.5;
    // a lit room: a lamp's warm pool in the middle, the curtains half drawn on some
    float curt = step(0.55, fract(seed * 7.31)) * smoothstep(0.30, 0.46, abs(c.x));
    float lamp = clamp(1.0 - 1.1 * length(c * vec2(1.2, 1.0) - vec2(0.0, -0.08)), 0.0, 1.0);
    vec3 room = mix(vec3(0.95, 0.42, 0.12), vec3(1.0, 0.78, 0.42), lamp) * (1.0 - curt * 0.6);
    // the TV: a cool blue, flickering with the cuts
    float f = 0.55 + 0.25 * sin(uTime * 9.0 + seed * 40.0) + 0.2 * step(0.5, fract(uTime * 0.7 + seed * 3.0));
    vec3 tvc = vec3(0.25, 0.42, 1.0) * f * (0.6 + 0.4 * lamp);
    room = mix(room, tvc, tv);
    // an unlit pane at dusk: deep blue glass with the sky's last light in its top
    vec3 dusk = mix(vec3(0.015, 0.02, 0.04), vec3(0.06, 0.07, 0.12), smoothstep(-0.5, 0.5, c.y));
    float fogF = 0.0;
#ifdef USE_FOG
  #ifdef FOG_EXP2
    fogF = 1.0 - exp(-fogDensity * fogDensity * vDepth * vDepth);
  #else
    fogF = smoothstep(fogNear, fogFar, vDepth);
  #endif
#endif
    float k = 1.0 - fogF;
    gl_FragColor = vec4(dusk * cover + room * lit * 1.25, 1.0);
    #include <colorspace_fragment>
    gl_FragColor = vec4(gl_FragColor.rgb * k, cover * k);     // premultiplied: a dark pane covers, a lit one adds
}`;
function ensureMesh() {
    if (WN.mesh) return WN.mesh;
    const g = new THREE.PlaneGeometry(1, 1);
    WN.data = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aData", WN.data);
    const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
        vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    WN.uTime = mat.uniforms.uTime;
    WN.mesh = new THREE.InstancedMesh(g, mat, MAX);
    WN.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    WN.mesh.frustumCulled = false; WN.mesh.castShadow = false; WN.mesh.receiveShadow = false;
    WN.mesh.count = 0; WN.mesh.visible = false; WN.mesh.renderOrder = 1;
    WN.mesh.name = "lifeWindows";
    ctx.scene.add(WN.mesh);
    return WN.mesh;
}

const byD = (a, b) => a._d - b._d;
const tmp = [];
/** The houses within reach, nearest first → the live panes (matrices written here, once per pick). */
function pick() {
    tmp.length = 0;
    const R = WIN.R;
    for (const h of WN.houses) {
        const dx = h.x - L.x, dz = h.z - L.z;
        if (dx > R || dx < -R || dz > R || dz < -R) continue;
        h._d = dx * dx + dz * dz;
        if (h._d > R * R) continue;
        tmp.push(h);
    }
    tmp.sort(byD);
    const m = ensureMesh();
    let n = 0;
    WN.live.length = 0;
    for (const h of tmp) {
        if (n + h.panes.length > Math.min(MAX, WIN.max)) break;
        const fade = 1 - clamp((Math.sqrt(h._d) - (R - WIN.fadeR)) / WIN.fadeR);
        for (const p of h.panes) {
            p.fade = fade;
            _e.set(0, p.rot, 0);
            _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(p.w, p.hgt, 1));
            m.setMatrixAt(n++, _m);
            WN.live.push(p);
        }
    }
    WN.liveN = n;
    m.instanceMatrix.needsUpdate = true;
}

export function tickWindows(dt) {
    const night = L.night;
    const want = L.on && L.town && night > 0.03 && buildHouses();
    if (!want) { windowsHide(); return; }
    WN.fullT = night > 0.97 ? WN.fullT + dt : night < 0.6 ? 0 : WN.fullT;
    WN.scanT -= dt;
    if (WN.scanT <= 0 || Math.abs(L.x - WN.sx) + Math.abs(L.z - WN.sz) > 8) { WN.scanT = 0.5; WN.sx = L.x; WN.sz = L.z; pick(); }
    const m = ensureMesh(), d = WN.data.array;
    const dusk = clamp((night - 0.03) / 0.25);         // the dark panes cover the town's glow as it comes up
    let lit = 0, tv = 0, dark = 0;
    for (let i = 0; i < WN.liveN; i++) {
        const p = WN.live[i];
        const on = p.lit && night >= p.on && WN.fullT < p.bed;
        const before = p.k;
        p.k += ((on ? 1 : 0) - p.k) * Math.min(1, dt * (on ? 9 : 3));
        if ((before < 0.5) !== (p.k < 0.5)) WN.flips++;
        const o = i * 4;
        d[o] = dusk * (1 - p.k) * 0.88 * p.fade;
        d[o + 1] = p.k * p.fade;
        d[o + 2] = 0;
        d[o + 3] = p.seed + (p.tv ? 1 : 0);
        if (p.k > 0.5) { lit++; if (p.tv) tv++; } else dark++;
    }
    WN.uTime.value = L.time;
    m.count = WN.liveN; m.visible = WN.liveN > 0;
    WN.data.needsUpdate = true;
    WN.drawn = WN.liveN; WN.lit = lit; WN.tv = tv; WN.dark = dark;
}
export function windowsHide() {
    if (WN.mesh && WN.mesh.visible) { WN.mesh.visible = false; WN.mesh.count = 0; }
    WN.drawn = 0; WN.sx = WN.sz = 1e9;
}
export function windowsClear() {
    windowsHide();
    WN.key = ""; WN.houses = []; WN.live.length = 0; WN.liveN = 0; WN.fullT = 0; WN.panes = 0;
}
export function windowInfo() {
    return { houses: WN.houses.length, panes: WN.panes, drawn: WN.drawn, lit: WN.lit, tv: WN.tv, dark: WN.dark, flips: WN.flips, fullT: +WN.fullT.toFixed(1),
        visible: !!(WN.mesh && WN.mesh.visible), models: [...PANES.entries()].map(([k, v]) => k + ":" + (v ? v.length : "?")) };
}
/** Tests: the nearest house with panes → {x, z (its lot line), nx, nz (out to the street), cx, cz (the model), n} | null. */
export function nearestHouse() {
    let best = null, bd = 1e9;
    for (const h of WN.houses) { const d = (h.x - L.x) ** 2 + (h.z - L.z) ** 2; if (d < bd) { bd = d; best = h; } }
    return best ? { x: best.x, z: best.z, nx: best.nx, nz: best.nz, cx: best.cx, cz: best.cz, n: best.panes.length } : null;
}
/** Tests: the nearest drawn pane of a lit / dark / tv kind → {x, y, z, rot, k, tv} | null. */
export function nearestPane(kind = "lit") {
    let best = null, bd = 1e9;
    for (let i = 0; i < WN.liveN; i++) {
        const p = WN.live[i];
        if (kind === "tv" ? !p.tv || p.k < 0.5 : kind === "lit" ? p.k < 0.5 : p.k >= 0.5) continue;
        const dd = (p.x - L.x) ** 2 + (p.z - L.z) ** 2;
        if (dd < bd) { bd = dd; best = p; }
    }
    return best ? { x: best.x, y: best.y, z: best.z, rot: best.rot, k: +best.k.toFixed(2), tv: best.tv, d: +Math.sqrt(bd).toFixed(1) } : null;
}
