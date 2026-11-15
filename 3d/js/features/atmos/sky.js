// features/atmos/sky.js — TIME OF DAY + the sky.
//
// The journey (features/journey/env.js) writes its per-leg palette (sky, fog,
// hemi + sun light) every driving frame. We never fight it: each tick we read
// what's there as the BASE (or keep the last base if nobody rewrote it since our
// own write), then — in Cruise only — blend the day cycle on top with a weight
// (noon = 0 → the leg's own look; golden hour, sunset, night, dawn → ours), and
// weather (rain greys it out, a fog bank swallows the horizon, lightning flashes).
// In Story mode the base is left alone; only "night touches" (stars, moon) are
// added when the leg itself is dark (the Vegas Strip).
//
// Visuals: one additive sky shell (sun disc + halo + sunset band + the moon +
// lightning), a star field, a tint for the world's clouds plus our own drifting
// cloud layer (more + darker in a storm), and a rainbow after rain.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { S, clamp, lerp, smooth, dirFrom, moonTex, C1, C2, V1, V2, V3, M4, Q4, DEG } from "./common.js";

// ── the day: keyframes (t = 0..1 of one cycle) ───────────────────────────
// w: how much the day cycle overrides the leg's palette · el/az: the SUN (deg;
// az 0 = straight down the road, +90 = left, ±180 = behind) · night: darkness ·
// cl/ce/cei: cloud colour / emissive / emissive intensity.
const NOON = { top: "#3f9be6", mid: "#9fd4fa", bottom: "#dff3ff", fog: "#d4efff", near: 160, far: 640, hs: "#cfeaff", hg: "#5f8a45", hi: 1.35, sc: "#fff1dc", si: 2.6, cl: "#ffffff", ce: "#ffffff", cei: 0.35 };
const NIGHT = { top: "#070b24", mid: "#111c44", bottom: "#26345e", fog: "#162040", near: 75, far: 440, hs: "#5c6cb0", hg: "#1a1a2c", hi: 0.72, sc: "#a9b9ff", si: 0.55, cl: "#56608a", ce: "#2c3660", cei: 0.32 };
const MORNING = { w: 0.55, top: "#4f8fd6", mid: "#b9d6ef", bottom: "#ffd9b8", fog: "#eadbc8", near: 140, far: 600, hs: "#ffe6cc", hg: "#6b7a4a", hi: 1.2, sc: "#ffcf96", si: 2.2, el: 14, az: -150, night: 0, cl: "#fff3ea", ce: "#ffd8bf", cei: 0.4 };
const RAW = [
    Object.assign({ t: 0 }, MORNING),
    { t: 0.09, w: 0.2, top: "#4a95e0", mid: "#a8d4f5", bottom: "#e9f4ff", fog: "#dcecf6", near: 155, far: 630, hs: "#d9ecff", hg: "#628a47", hi: 1.3, sc: "#fff0d8", si: 2.5, el: 36, az: -140, night: 0, cl: "#ffffff", ce: "#ffffff", cei: 0.35 },
    Object.assign({ t: 0.18, w: 0, el: 58, az: -120, night: 0 }, NOON),
    Object.assign({ t: 0.31, w: 0.08, el: 40, az: -70, night: 0 }, NOON),
    { t: 0.41, w: 0.7, top: "#3d6ec4", mid: "#f0b878", bottom: "#ffd394", fog: "#f2c897", near: 135, far: 580, hs: "#ffd9ad", hg: "#6d5a3a", hi: 1.15, sc: "#ffb866", si: 2.45, el: 8.5, az: 24, night: 0, cl: "#ffe4c4", ce: "#ffb070", cei: 0.45 },
    { t: 0.48, w: 0.92, top: "#29306e", mid: "#e2715d", bottom: "#ffae5e", fog: "#d98b6c", near: 115, far: 520, hs: "#ffa587", hg: "#4c3b4f", hi: 0.95, sc: "#ff7b3d", si: 1.7, el: 2.5, az: 26, night: 0.15, cl: "#ffb59a", ce: "#ff7a5c", cei: 0.5 },
    { t: 0.535, w: 1, top: "#141c48", mid: "#3d3b7c", bottom: "#9a5c86", fog: "#3c365f", near: 90, far: 470, hs: "#7270b8", hg: "#2a2440", hi: 0.85, sc: "#9098ff", si: 0.55, el: -6, az: 22, night: 0.7, cl: "#6a5a8a", ce: "#4a3a6a", cei: 0.35 },
    Object.assign({ t: 0.6, w: 1, el: -30, az: 0, night: 1 }, NIGHT),
    Object.assign({ t: 0.83, w: 1, el: -25, az: -140, night: 1 }, NIGHT),
    { t: 0.9, w: 0.95, top: "#2a3876", mid: "#c98aa6", bottom: "#ffbf96", fog: "#c4a0ae", near: 105, far: 510, hs: "#c0a6d8", hg: "#4a4650", hi: 0.95, sc: "#ff9e72", si: 1.3, el: -1, az: -145, night: 0.35, cl: "#f0b8c0", ce: "#d08098", cei: 0.45 },
    { t: 0.95, w: 0.8, top: "#3f6fc0", mid: "#e8b0a0", bottom: "#ffd2a8", fog: "#e6c4b0", near: 125, far: 560, hs: "#ffd0b8", hg: "#5a5a48", hi: 1.05, sc: "#ffb27a", si: 1.8, el: 6, az: -148, night: 0.05, cl: "#ffe0d0", ce: "#ffb8a0", cei: 0.45 },
    Object.assign({ t: 1 }, MORNING),
];
const COLS = ["top", "mid", "bottom", "fog", "hs", "hg", "sc", "cl", "ce"];
const KEYS = RAW.map(k => { const o = Object.assign({}, k); for (const c of COLS) o[c] = new THREE.Color(k[c]); return o; });

/** Named times for the debug hooks + tests. */
export const TIMES = { morning: 0.03, noon: 0.18, afternoon: 0.3, golden: 0.41, sunset: 0.48, dusk: 0.535, night: 0.7, dawn: 0.9 };
export function phaseName(t) {
    if (t < 0.12) return "morning";
    if (t < 0.36) return "day";
    if (t < 0.455) return "golden";
    if (t < 0.515) return "sunset";
    if (t < 0.57) return "dusk";
    if (t < 0.87) return "night";
    return "dawn";
}

function makePal() {
    return { top: new THREE.Color(), mid: new THREE.Color(), bottom: new THREE.Color(), fog: new THREE.Color(), near: 160, far: 640,
        hs: new THREE.Color(), hg: new THREE.Color(), hi: 1.35, sc: new THREE.Color(), si: 2.6, off: new THREE.Vector3(-38, 70, -26),
        cl: new THREE.Color(1, 1, 1), ce: new THREE.Color(1, 1, 1), cei: 0.35, w: 0, night: 0, el: 50, az: -120 };
}
const base = makePal(), tod = makePal(), out = makePal();
const SIG = [0, 0, 0, 0, 0, 0];
const NUMS = ["near", "far", "hi", "si", "cei", "w", "night", "el"], PAL7 = ["top", "mid", "bottom", "fog", "hs", "hg", "sc"], PAL5 = ["top", "mid", "bottom", "fog", "hs"], SKY3 = ["top", "mid", "bottom"];
let sig = null;          // the numbers we wrote last tick (to tell whether the journey rewrote its base since)

function readBase() {
    const u = ctx.world.sky.material.uniforms, L = ctx.lights, F = ctx.scene.fog;
    if (sig && L.hemi.intensity === sig[0] && L.sun.intensity === sig[1] && (!F || F.far === sig[2]) &&
        u.top.value.r === sig[3] && L.sunOffset.x === sig[4] && u.bottom.value.g === sig[5]) return;   // still ours → keep the base
    base.top.copy(u.top.value); base.mid.copy(u.mid.value); base.bottom.copy(u.bottom.value);
    if (F) { base.fog.copy(F.color); base.near = F.near; base.far = F.far; }
    base.hs.copy(L.hemi.color); base.hg.copy(L.hemi.groundColor); base.hi = L.hemi.intensity;
    base.sc.copy(L.sun.color); base.si = L.sun.intensity; base.off.copy(L.sunOffset);
}
function write(p) {
    const u = ctx.world.sky.material.uniforms, L = ctx.lights, F = ctx.scene.fog;
    u.top.value.copy(p.top); u.mid.value.copy(p.mid); u.bottom.value.copy(p.bottom);
    if (F) { F.color.copy(p.fog); F.near = p.near; F.far = p.far; }
    L.hemi.color.copy(p.hs); L.hemi.groundColor.copy(p.hg); L.hemi.intensity = p.hi;
    L.sun.color.copy(p.sc); L.sun.intensity = p.si; L.sunOffset.copy(p.off);
    SIG[0] = L.hemi.intensity; SIG[1] = L.sun.intensity; SIG[2] = F ? F.far : 0; SIG[3] = u.top.value.r; SIG[4] = L.sunOffset.x; SIG[5] = u.bottom.value.g;
    sig = SIG;
}

function evalDay(t, p) {
    t = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
    const a = KEYS[i], b = KEYS[i + 1], f = clamp((t - a.t) / Math.max(1e-6, b.t - a.t));
    for (const c of COLS) p[c].copy(a[c]).lerp(b[c], f);
    for (const n of NUMS) p[n] = lerp(a[n], b[n], f);
    let da = b.az - a.az;
    if (da > 180) da -= 360; else if (da < -180) da += 360;
    p.az = a.az + da * f;
}

function greyify(c, amt, mul) {
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    c.lerp(C1.setRGB(l * 0.95, l, l * 1.07), amt).multiplyScalar(mul);
}
const MIST_DAY = new THREE.Color("#cfd5db"), MIST_NIGHT = new THREE.Color("#272d40"), FLASH = new THREE.Color("#c9d2ff");

/**
 * One tick of the sky: read the base, work out the day cycle, write the blend.
 * Sets S.w, S.todNight, S.baseNight, S.night, S.day, S.sunDir, S.moonDir, S.lightDir.
 */
export function skyTick() {
    readBase();
    S.baseNight = clamp((1.75 - base.si) / 1.0);
    const cruise = S.mode === "cruise";
    if (cruise) {
        evalDay(S.clock, tod);
        S.w = tod.w; S.todNight = tod.night;
    } else { S.w = 0; S.todNight = 0; tod.el = 50; tod.az = -120; }
    // the sun, the moon and where the key light comes from
    dirFrom(tod.az, tod.el, S.sunDir);
    const nightP = cruise ? clamp((S.clock - 0.52) / 0.38) : 0.5;   // 0 at dusk → 1 at dawn
    dirFrom(-26 + nightP * 22, 11 + Math.sin(nightP * Math.PI) * 7, S.moonDir);
    S.day = cruise ? smooth(-4, 5, tod.el) : 1 - S.baseNight;
    dirFrom(tod.az, Math.max(tod.el, 13), V1);                       // sun light (never grazing)
    V2.copy(S.moonDir); if (V2.y < 0.45) { V2.y = 0.45; V2.normalize(); }
    S.lightDir.copy(V2).lerp(V1, S.day).normalize();
    S.night = Math.max(S.w * S.todNight + (1 - S.w) * S.baseNight, S.baseNight);
    if (!cruise) return;       // Story & co.: the journey owns the light — we only read it

    // blend: base → day cycle (w) → weather → lightning
    const w = S.w;
    for (const c of PAL7) out[c].copy(base[c]).lerp(tod[c], w);
    out.near = lerp(base.near, tod.near, w); out.far = lerp(base.far, tod.far, w);
    out.hi = lerp(base.hi, tod.hi, w); out.si = lerp(base.si, tod.si, w);
    const len = base.off.length() || 85;
    out.off.copy(base.off).normalize().lerp(V3.copy(S.lightDir), w).normalize().multiplyScalar(len);
    const over = Math.max(S.rain, S.snow * 0.75);
    if (over > 0.001) {
        for (const c of PAL5) greyify(out[c], over * 0.8, 1 - over * 0.3);
        out.near *= 1 - 0.6 * S.rain - 0.35 * S.snow; out.far *= 1 - 0.42 * S.rain - 0.3 * S.snow;
        out.hi *= 1 - 0.2 * over; out.si *= 1 - 0.72 * over;
    }
    if (S.fog > 0.001) {
        const f = S.fog;
        C2.copy(MIST_DAY).lerp(MIST_NIGHT, S.night);
        out.fog.lerp(C2, 0.8 * f);
        out.bottom.lerp(out.fog, 0.95 * f); out.mid.lerp(out.fog, 0.75 * f); out.top.lerp(out.fog, 0.4 * f);
        out.near = lerp(out.near, 3, f); out.far = lerp(out.far, 100, f);
        out.si *= 1 - 0.55 * f;
    }
    if (S.flash > 0.001) {
        out.hi += S.flash * 2.6;
        for (const c of SKY3) out[c].lerp(FLASH, S.flash * 0.45);
        out.fog.lerp(FLASH, S.flash * 0.25);
    }
    write(out);
}

/** Put the base palette back (once) when we stop writing. */
export function skyRestore() {
    if (!sig || !ctx.world) return;
    readBase();
    write(base);
    sig = null;
}

// ── visuals: sky shell (sun, halo, sunset band, moon, lightning) ─────────
let shell = null, stars = null, clouds = null, bow = null, worldCloudMat = null, cloudOrig = null;

function makeShell() {
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
        uniforms: {
            uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uSun: { value: 0 },
            uGlowCol: { value: new THREE.Color() }, uGlow: { value: 0 },
            uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonR: { value: new THREE.Vector3(1, 0, 0) }, uMoonU: { value: new THREE.Vector3(0, 0, 1) },
            uMoon: { value: 0 }, uMoonTex: { value: moonTex() },
            uFlash: { value: 0 }, uFlashCol: { value: new THREE.Color("#8f9cff") },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `
            uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSun;
            uniform vec3 uGlowCol; uniform float uGlow;
            uniform vec3 uMoonDir; uniform vec3 uMoonR; uniform vec3 uMoonU; uniform float uMoon; uniform sampler2D uMoonTex;
            uniform float uFlash; uniform vec3 uFlashCol;
            varying vec3 vDir;
            void main() {
                vec3 d = normalize(vDir);
                vec3 col = vec3(0.0);
                float above = smoothstep(-0.035, 0.015, d.y);
                float cs = dot(d, uSunDir);
                float disc = smoothstep(0.99905, 0.99942, cs);
                float halo = pow(max(cs, 0.0), 420.0) * 0.8 + pow(max(cs, 0.0), 26.0) * 0.26;
                col += uSunCol * (disc * 1.5 + halo) * uSun * above;
                vec2 hd = normalize(d.xz + 1e-5), hs = normalize(uSunDir.xz + 1e-5);
                float band = exp(-max(d.y, 0.0) * 6.5) * smoothstep(-0.07, 0.0, d.y);
                float toward = pow(max(dot(hd, hs), 0.0), 2.5);
                col += uGlowCol * band * (0.18 + 0.82 * toward) * uGlow;
                if (uMoon > 0.001) {
                    float cm = dot(d, uMoonDir);
                    if (cm > 0.995) {
                        vec2 uv = vec2(dot(d, uMoonR), dot(d, uMoonU)) / 0.04 * 0.5 + 0.5;
                        vec4 m = texture2D(uMoonTex, clamp(uv, 0.0, 1.0));
                        col += m.rgb * m.a * uMoon * 1.05 * above;
                    }
                    col += vec3(0.55, 0.62, 0.9) * (pow(max(cm, 0.0), 900.0) * 0.5 + pow(max(cm, 0.0), 60.0) * 0.12) * uMoon * above;
                }
                col += uFlashCol * uFlash * (0.25 + 0.75 * smoothstep(-0.05, 0.55, d.y));
                gl_FragColor = vec4(col, 1.0);
                #include <colorspace_fragment>
            }`,
    });
    const m = new THREE.Mesh(new THREE.SphereGeometry(900, 40, 20), mat);
    m.frustumCulled = false;
    m.renderOrder = -1;
    m.visible = false;
    return m;
}

function makeStars() {
    const n = 1100, pos = new Float32Array(n * 3), size = new Float32Array(n), ph = new Float32Array(n);
    let seed = 1234567;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
        const az = r() * Math.PI * 2, el = Math.asin(0.06 + r() * 0.94);
        const R = 880;
        pos[i * 3] = Math.cos(el) * Math.sin(az) * R; pos[i * 3 + 1] = Math.sin(el) * R; pos[i * 3 + 2] = Math.cos(el) * Math.cos(az) * R;
        const big = r();
        size[i] = big > 0.97 ? 4.2 : big > 0.85 ? 3.0 : 1.8 + r() * 0.8;
        ph[i] = r();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPh", new THREE.BufferAttribute(ph, 1));
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 }, uScale: { value: 1 } },
        vertexShader: `attribute float aSize; attribute float aPh; uniform float uTime; uniform float uAlpha; uniform float uScale; varying float vA;
            void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
              gl_PointSize = aSize * uScale;
              float tw = 0.62 + 0.38 * sin(uTime * (1.3 + aPh * 2.2) + aPh * 40.0);
              vA = uAlpha * tw * smoothstep(0.04, 0.2, normalize(position).y); }`,
        fragmentShader: `varying float vA; void main() { vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.05, length(c));
              gl_FragColor = vec4(vec3(1.0, 0.96, 0.88) * a * vA, 1.0); }`,
    });
    const p = new THREE.Points(g, mat);
    p.frustumCulled = false;
    p.renderOrder = -1;
    p.visible = false;
    return p;
}

// our own cloud layer: chunky low-poly puffs (like the world's) that drift, multiply and darken in a storm
const CLOUDS = 22, PUFFS = 6;
function makeClouds() {
    const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, fog: false, emissive: "#ffffff", emissiveIntensity: 0.35, flatShading: true });
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), mat, CLOUDS * PUFFS);
    im.frustumCulled = false;
    im.castShadow = false; im.receiveShadow = false;
    let seed = 777;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const list = [];
    for (let i = 0; i < CLOUDS; i++) {
        const a = (i / CLOUDS) * Math.PI * 2 + r() * 0.25, dist = 380 + r() * 330;
        const puffs = [];
        const size = 16 + r() * 14;
        for (let j = 0; j < PUFFS; j++) {
            const k = j - (PUFFS - 1) / 2;
            puffs.push({ x: k * size * 1.05 + r() * 8, y: (1 - Math.abs(k) / PUFFS) * size * 0.45 + r() * 4, z: r() * 14 - 7, s: size * (1.05 - Math.abs(k) * 0.12) * (0.8 + r() * 0.4) });
        }
        list.push({ a, dist, h: 95 + r() * 80, rot: r() * 6.28, thr: i / CLOUDS, puffs });
    }
    im.userData.list = list;
    im.userData.cover = -1;
    im.count = CLOUDS * PUFFS;
    for (let i = 0; i < im.count; i++) im.setMatrixAt(i, M4.makeScale(0, 0, 0));
    return im;
}
function layoutClouds(im, cover) {
    const list = im.userData.list;
    let n = 0;
    for (const c of list) {
        // a cloud "grows" in as the cover passes its threshold (and storm clouds sit lower and bigger)
        const g = smooth(c.thr - 0.04, c.thr + 0.12, cover);
        const cx = Math.sin(c.a) * c.dist, cz = Math.cos(c.a) * c.dist, cy = c.h - cover * 30;
        const big = 1 + cover * 0.35;
        Q4.setFromAxisAngle(V1.set(0, 1, 0), c.rot);
        for (const p of c.puffs) {
            V2.set(p.x * big, p.y * big, p.z).applyQuaternion(Q4);
            const s = p.s * g * big;
            M4.compose(V3.set(cx + V2.x, cy + V2.y, cz + V2.z), Q4, V2.set(s * 1.35, s * 0.62, s));
            im.setMatrixAt(n++, M4);
        }
    }
    im.instanceMatrix.needsUpdate = true;
    im.userData.cover = cover;
}

// the rainbow: one big camera-facing quad, a spectral arc drawn in its shader
function makeRainbow() {
    const D = 620, R = D * Math.tan(32 * DEG), B = D * Math.tan(3.2 * DEG);
    const W = (R + 40) * 2, Hh = R + 120;
    const geo = new THREE.PlaneGeometry(W, Hh).translate(0, Hh / 2 - 80, 0);
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uCenterY: { value: -100 }, uR: { value: R }, uB: { value: B }, uAlpha: { value: 0 } },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uCenterY; uniform float uR; uniform float uB; uniform float uAlpha; varying vec2 vP;
            vec3 hsv(float h){ vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); return k; }
            void main(){
                float r = length(vP - vec2(0.0, uCenterY));
                float t = (r - (uR - uB)) / uB;
                float band = smoothstep(0.0, 0.18, t) * smoothstep(1.0, 0.8, t);
                vec3 c = hsv(mix(0.76, 0.0, clamp(t, 0.0, 1.0)));
                float inner = smoothstep(uR - uB, uR - uB - 160.0, r) * 0.05;
                float ends = smoothstep(-40.0, 60.0, vP.y);
                gl_FragColor = vec4(c * band + vec3(inner), (band * 0.5 + inner) * uAlpha * ends);
                #include <colorspace_fragment>
            }`,
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.visible = false;
    m.userData.D = D;
    return m;
}

function ensure() {
    if (shell) return;
    shell = makeShell(); stars = makeStars(); clouds = makeClouds(); bow = makeRainbow();
    ctx.scene.add(shell, stars, clouds, bow);
    const wc = ctx.world.clouds;
    wc.traverse(o => { if (!worldCloudMat && o.isMesh) worldCloudMat = o.material; });
    if (worldCloudMat) cloudOrig = { c: worldCloudMat.color.clone(), e: worldCloudMat.emissive.clone(), ei: worldCloudMat.emissiveIntensity };
}

const FLASH_CLOUD = new THREE.Color("#d6dcff"), WHITE = new THREE.Color("#ffffff");
const STORM = new THREE.Color("#7a828c"), STORM_E = new THREE.Color("#4a5058"), STORM_N = new THREE.Color("#262b38");
let cloudSpin = 0;
/** Per-frame sky visuals (call after skyTick). */
export function skyVisuals(dt) {
    ensure();
    const cam = S.camPos, cruise = S.mode === "cruise";
    shell.position.copy(cam); stars.position.copy(cam); clouds.position.set(cam.x, 0, cam.z);

    // sun disc + halo + sunset band (cruise: the day cycle's sun; the journey's legs keep their own sky)
    const u = shell.material.uniforms;
    const sunUp = cruise ? smooth(-3, 2, tod.el) * (1 - S.rain * 0.85) * (1 - S.fog * 0.9) * (1 - S.snow * 0.7) : 0;
    u.uSunDir.value.copy(S.sunDir);
    u.uSunCol.value.copy(tod.sc).lerp(WHITE, smooth(25, 60, tod.el) * 0.6);
    u.uSun.value = sunUp * (0.55 + 0.45 * smooth(30, 5, tod.el));
    const glowAmt = cruise ? smooth(30, 4, tod.el) * smooth(-9, 0, tod.el) * (1 - S.rain * 0.8) * (1 - S.fog) * S.w : 0;
    u.uGlowCol.value.copy(tod.sc).multiplyScalar(0.55);
    u.uGlow.value = glowAmt;
    // the moon: cruise nights, or a leg that's already night (the Strip)
    const moon = smooth(0.35, 0.8, S.night) * (1 - S.rain) * (1 - S.fog * 0.9) * (1 - S.snow * 0.8) * (1 - smooth(0.6, 1, S.cloud) * 0.7);
    u.uMoon.value = moon;
    u.uMoonDir.value.copy(S.moonDir);
    u.uMoonR.value.crossVectors(S.moonDir, V1.set(0, 1, 0)).normalize();
    u.uMoonU.value.crossVectors(u.uMoonR.value, S.moonDir).normalize();
    u.uFlash.value = S.flash;
    shell.visible = sunUp > 0.001 || glowAmt > 0.001 || moon > 0.001 || S.flash > 0.001;

    // stars
    const sa = smooth(0.45, 0.95, S.night) * (1 - S.cloud * 0.55) * (1 - S.rain) * (1 - S.fog * 0.95) * (1 - S.snow * 0.8);
    stars.material.uniforms.uAlpha.value = sa;
    stars.material.uniforms.uTime.value = S.time;
    stars.material.uniforms.uScale.value = ctx.renderer ? ctx.renderer.getPixelRatio() : 1;
    stars.visible = sa > 0.01;

    // cloud colour: the day cycle tints (pink sunsets, moonlit nights), storms darken
    const over = Math.max(S.rain, S.snow * 0.6, S.fog * 0.5);
    if (worldCloudMat && cloudOrig) {
        const m = worldCloudMat;
        if (cruise) {
            m.color.copy(cloudOrig.c).lerp(tod.cl, S.w).lerp(C1.copy(STORM).lerp(STORM_N, S.night), over * 0.85);
            m.emissive.copy(cloudOrig.e).lerp(tod.ce, S.w).lerp(C1.copy(STORM_E).lerp(STORM_N, S.night), over * 0.85);
            m.emissiveIntensity = lerp(cloudOrig.ei, tod.cei, S.w) * (1 - over * 0.4) + S.flash * 1.6;
            if (S.flash > 0.001) m.emissive.lerp(FLASH_CLOUD, Math.min(1, S.flash * 1.2));
        } else restoreCloudMat();
    }
    clouds.material.color.copy(worldCloudMat ? worldCloudMat.color : WHITE);
    clouds.material.emissive.copy(worldCloudMat ? worldCloudMat.emissive : WHITE);
    clouds.material.emissiveIntensity = worldCloudMat ? worldCloudMat.emissiveIntensity : 0.35;
    // drift: the world's cloud ring turns a little faster, ours follows the wind
    const wind = Math.hypot(S.wind.x, S.wind.z);
    if (ctx.world.clouds) ctx.world.clouds.rotation.y += dt * (0.006 + wind * 0.0025);
    cloudSpin += dt * (0.009 + wind * 0.003);
    clouds.rotation.y = cloudSpin;
    // fewer clouds on a clear night (so the stars show) and around the setting sun
    const sunsetGap = cruise ? smooth(-2, 4, tod.el) * smooth(16, 6, tod.el) * 0.35 : 0;
    const cover = S.baseNight > 0.6 ? 0 : S.cloud * (1 - (0.45 * S.night + sunsetGap) * (1 - Math.max(S.rain, S.snow, S.fog)));
    if (Math.abs(cover - clouds.userData.cover) > 0.003) layoutClouds(clouds, cover);
    clouds.visible = cover > 0.01;

    // rainbow: opposite the sun when that's ahead of you, otherwise (artistic licence) up the
    // road a little to the side — picked once when it appears, then fixed in the sky
    const ra = S.rainbow * smooth(0.4, 0.9, S.day) * (1 - S.rain) * (1 - S.fog) * (1 - S.snow);
    bow.visible = cruise && ra > 0.005;
    if (!bow.visible) bowAz = null;
    else {
        const D = bow.userData.D;
        if (bowAz === null) {
            const h = ctx.car ? ctx.car.h : 0, anti = Math.atan2(-S.sunDir.x, -S.sunDir.z);
            let off = anti - h;
            while (off > Math.PI) off -= Math.PI * 2;
            while (off < -Math.PI) off += Math.PI * 2;
            bowAz = Math.abs(off) < 0.25 ? anti : h + Math.sign(off || 1) * 0.1;
        }
        V1.set(Math.sin(bowAz), 0, Math.cos(bowAz));
        bow.position.set(cam.x + V1.x * D, cam.y, cam.z + V1.z * D);
        bow.rotation.set(0, Math.atan2(-V1.x, -V1.z), 0);
        bow.material.uniforms.uCenterY.value = -D * Math.tan(Math.min(20, Math.max(13, tod.el)) * DEG) - cam.y;
        bow.material.uniforms.uAlpha.value = ra;
    }
}
let bowAz = null;

/** Can a rainbow show right now (the sun is up)? */
export function rainbowPossible() {
    return S.mode === "cruise" && tod.el > 5 && S.night < 0.2;
}

function restoreCloudMat() {
    if (!worldCloudMat || !cloudOrig) return;
    worldCloudMat.color.copy(cloudOrig.c); worldCloudMat.emissive.copy(cloudOrig.e); worldCloudMat.emissiveIntensity = cloudOrig.ei;
}

export function skyHide() {
    skyRestore();
    restoreCloudMat();
    if (!shell) return;
    shell.visible = stars.visible = clouds.visible = bow.visible = false;
}

/** For tests: what the sky is showing. */
export function skyInfo() {
    return { sun: shell ? shell.material.uniforms.uSun.value : 0, moon: shell ? shell.material.uniforms.uMoon.value : 0,
        stars: stars && stars.visible ? stars.material.uniforms.uAlpha.value : 0, rainbow: bow && bow.visible ? bow.material.uniforms.uAlpha.value : 0,
        clouds: clouds && clouds.visible ? clouds.userData.cover : 0, sunEl: tod.el, writing: !!sig,
        objects: shell ? [shell, stars, clouds, bow].filter(o => o.parent).length : 0 };
}
export { tod as todPalette, base as basePalette };
