// features/atmos/weather.js — WEATHER for Cruise (and gentle Chanukah snow):
//   🌧️ rain: GPU-animated streaks around the camera (one draw call, no per-frame
//      CPU), splash rings on the ground, a wet dark road, spray behind cars, the
//      sky greys over; heavy rain brings lightning + thunder (+ a controller rumble)
//   🌫️ fog banks that swallow the horizon for half a minute
//   ❄️ snow (around Chanukah, or rarely), settling on the grass
//   🌈 a rainbow after the rain, when the sun is behind you
//   🪟 in "Lulu's eyes": drops on the windscreen and a pair of wipers
// Everything eases in and out; nothing switches instantly (except a forced test).
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { worldMaterials } from "../../world.js";
import { rumble } from "../../input.js";
import { S, clamp, lerp, smooth, rand, pick, approach, say, V1, C1 } from "./common.js";
import { rainbowPossible } from "./sky.js";
import * as sfx from "./sfx.js";

// ── precipitation: N quads animated entirely in the vertex shader ────────
const PRECIP_VS_HEAD = `
    attribute vec4 seed;
    uniform float uTime; uniform float uAmount; uniform vec3 uBox; uniform vec2 uDrift; uniform float uFall;
    varying float vA; varying vec2 vC;
    vec3 dropCentre(out vec2 rel) {
        vec3 p = seed.xyz * uBox;
        p.y = mod(p.y - uTime * uFall * (0.75 + 0.5 * seed.w), uBox.y);
        rel = mod(p.xz + uDrift - cameraPosition.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5;
        return vec3(cameraPosition.x + rel.x, p.y - 0.4, cameraPosition.z + rel.y);
    }
    float edgeFade(vec2 rel) { vec2 e = abs(rel) / (uBox.xz * 0.5); return 1.0 - smoothstep(0.62, 1.0, max(e.x, e.y)); }`;
const RAIN_VS = PRECIP_VS_HEAD + `
    uniform vec3 uStreak; uniform float uLen; uniform float uWidth;
    uniform vec3 uBeamPos; uniform vec3 uBeamDir; uniform float uBeam;
    varying float vLit;
    void main() {
        vec2 rel; vec3 c = dropCentre(rel);
        vec3 toCam = cameraPosition - c;
        float dist = length(toCam);
        vec3 side = normalize(cross(uStreak, toCam) + vec3(1e-4, 0.0, 0.0)) * uWidth * (1.0 + dist * 0.02);
        vec3 wp = c + uStreak * (position.y * uLen) + side * position.x;
        vA = step(seed.w, uAmount) * edgeFade(rel) * smoothstep(0.9, 3.2, dist) * (0.45 + 0.55 * fract(seed.w * 7.13));
        vec3 bv = c - uBeamPos; float along = dot(bv, uBeamDir);
        float lat = length(bv - uBeamDir * along);
        vLit = uBeam * step(0.5, along) * smoothstep(0.9 + along * 0.32, 0.4 + along * 0.12, lat) * smoothstep(34.0, 6.0, along) * smoothstep(3.2, 0.6, c.y);
        vC = position.xy;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
    }`;
const SNOW_VS = PRECIP_VS_HEAD + `
    uniform float uSize;
    void main() {
        vec2 rel; vec3 c = dropCentre(rel);
        c.x += sin(uTime * 1.3 + seed.x * 40.0) * 0.55; c.z += cos(uTime * 1.1 + seed.z * 37.0) * 0.55;
        vec4 mv = viewMatrix * vec4(c, 1.0);
        mv.xy += vec2(position.x, position.y * 2.0 - 1.0) * uSize * (0.55 + 0.9 * fract(seed.w * 13.7));
        vA = step(seed.w, uAmount) * edgeFade(rel) * smoothstep(0.4, 1.6, -mv.z);
        vC = vec2(position.x, position.y * 2.0 - 1.0);
        gl_Position = projectionMatrix * mv;
    }`;
const RAIN_FS = `uniform vec3 uColor; uniform float uOpacity; varying float vA; varying vec2 vC; varying float vLit;
    void main() { float a = (1.0 - abs(vC.x)) * smoothstep(0.0, 0.3, vC.y) * smoothstep(1.0, 0.55, vC.y) * vA * uOpacity * (1.0 + vLit * 1.4);
        if (a < 0.004) discard; gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.95, 0.82), vLit), min(1.0, a)); }`;
const SNOW_FS = `uniform vec3 uColor; uniform float uOpacity; varying float vA; varying vec2 vC;
    void main() { float a = smoothstep(1.0, 0.25, length(vC)) * vA * uOpacity; if (a < 0.004) discard; gl_FragColor = vec4(uColor, a); }`;

function quadField(n, seedFn) {
    const pos = new Float32Array(n * 12), seed = new Float32Array(n * 16), idx = new Uint16Array(n * 6);
    const C = [-1, 0, 1, 0, 1, 1, -1, 1];
    for (let i = 0; i < n; i++) {
        const s = seedFn(i);
        for (let k = 0; k < 4; k++) {
            pos.set([C[k * 2], C[k * 2 + 1], 0], (i * 4 + k) * 3);
            seed.set(s, (i * 4 + k) * 4);
        }
        idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.BufferAttribute(seed, 4));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
}
const R01 = () => [Math.random(), Math.random(), Math.random(), Math.random()];

export const MAX_RAIN = 2600, MAX_SNOW = 2200, MAX_SPLASH = 170;
let rainMesh = null, snowMesh = null, splashMesh = null, screen = null, bolt = null, ground = null;
const drift = new THREE.Vector2();

export function makeRain() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(34, 18, 34) }, uDrift: { value: drift }, uFall: { value: 15 },
            uStreak: { value: new THREE.Vector3(0, 1, 0) }, uLen: { value: 0.7 }, uWidth: { value: 0.016 },
            uBeamPos: { value: new THREE.Vector3() }, uBeamDir: { value: new THREE.Vector3(0, 0, 1) }, uBeam: { value: 0 }, uColor: { value: new THREE.Color("#c9d6e6") }, uOpacity: { value: 0.55 } },
        vertexShader: RAIN_VS, fragmentShader: RAIN_FS,
    });
    const m = new THREE.Mesh(quadField(MAX_RAIN, R01), mat);
    m.frustumCulled = false; m.renderOrder = 8; m.visible = false;
    return m;
}
export function makeSnow() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(40, 20, 40) }, uDrift: { value: drift }, uFall: { value: 1.6 },
            uSize: { value: 0.075 }, uColor: { value: new THREE.Color("#ffffff") }, uOpacity: { value: 0.9 } },
        vertexShader: SNOW_VS, fragmentShader: SNOW_FS,
    });
    const m = new THREE.Mesh(quadField(MAX_SNOW, R01), mat);
    m.frustumCulled = false; m.renderOrder = 8; m.visible = false;
    return m;
}
function makeSplashes() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(26, 1, 26) }, uColor: { value: new THREE.Color("#e3ecf6") } },
        vertexShader: `attribute vec4 seed; uniform float uTime; uniform float uAmount; uniform vec3 uBox; varying vec2 vC; varying float vPh; varying float vA;
            void main() {
                vec2 rel = mod(seed.xz * uBox.xz - cameraPosition.xz + uBox.xz * 0.5, uBox.xz) - uBox.xz * 0.5;
                vPh = fract(uTime * (1.2 + seed.y) + seed.w * 7.0);
                vec3 c = vec3(cameraPosition.x + rel.x, 0.065, cameraPosition.z + rel.y);
                vec2 q = vec2(position.x, position.y * 2.0 - 1.0) * 0.32;
                vC = vec2(position.x, position.y * 2.0 - 1.0);
                vec2 e = abs(rel) / (uBox.xz * 0.5);
                vA = step(seed.w, uAmount) * (1.0 - smoothstep(0.6, 1.0, max(e.x, e.y)));
                gl_Position = projectionMatrix * viewMatrix * vec4(c.x + q.x, c.y, c.z + q.y, 1.0);
            }`,
        fragmentShader: `uniform vec3 uColor; varying vec2 vC; varying float vPh; varying float vA;
            void main() { float r = length(vC); float ring = smoothstep(0.14, 0.0, abs(r - vPh)) * (1.0 - vPh);
                float a = ring * vA * 0.75; if (a < 0.004) discard; gl_FragColor = vec4(uColor, a); }`,
    });
    const m = new THREE.Mesh(quadField(MAX_SPLASH, R01), mat);
    m.frustumCulled = false; m.renderOrder = 3; m.visible = false;
    return m;
}

// ── the windscreen in "Lulu's eyes": drops that land, get wiped, land again ──
function makeScreen() {
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, fog: false,
        uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uSnow: { value: 0 }, uAspect: { value: 16 / 9 }, uPeriod: { value: 1.5 }, uCell: { value: 0.05 }, uWipers: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
        fragmentShader: `
            uniform float uTime; uniform float uRain; uniform float uSnow; uniform float uAspect; uniform float uPeriod; uniform float uCell; uniform float uWipers;
            varying vec2 vUv;
            const float TH0 = 0.12; const float TH1 = 2.75; const float REACH = 0.74;
            float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
            vec2 piv(int i) { return i == 0 ? vec2(uAspect * 0.2, -0.06) : vec2(uAspect * 0.58, -0.06); }
            float bladeAngle() { float c = fract(uTime / uPeriod); return TH0 + (TH1 - TH0) * (1.0 - abs(2.0 * c - 1.0)); }
            float since(vec2 p, vec2 pv) {
                vec2 d = p - pv; if (length(d) > REACH || uWipers < 0.5) return 1e3;
                float u = (atan(d.y, d.x) - TH0) / (TH1 - TH0);
                if (u < 0.0 || u > 1.0) return 1e3;
                float c = fract(uTime / uPeriod);
                return min(fract(c - u * 0.5), fract(c - (1.0 - u * 0.5))) * uPeriod;
            }
            float blade(vec2 p, vec2 pv, float th) {
                vec2 dir = vec2(cos(th), sin(th));
                float t = clamp(dot(p - pv, dir), 0.0, REACH);
                float d = length(p - pv - dir * t);
                float w = t < 0.1 ? 0.007 : 0.0105;              // the arm, then the rubber blade
                return smoothstep(w, w * 0.55, d);
            }
            void main() {
                vec2 p = vec2(vUv.x * uAspect, vUv.y);
                float amt = max(uRain, uSnow);
                vec2 g = p / uCell, id = floor(g), f = fract(g) - 0.5;
                vec2 o = (vec2(h21(id), h21(id + 3.1)) - 0.5) * 0.36;
                float r = mix(0.08, 0.27, pow(h21(id + 7.7), 1.6));
                vec2 cpos = (id + 0.5 + o) * uCell;
                float s = min(since(cpos, piv(0)), since(cpos, piv(1)));
                float delay = h21(id + 5.3) * uPeriod * 2.6 / (0.35 + amt);
                float on = step(h21(id + 1.9), amt * 0.75) * smoothstep(delay, delay + 0.12, s);
                if (s > 100.0) on *= step(fract((uTime * 0.13 + h21(id + 9.1))), 0.82);   // out of the wipers' reach: drops run off now and then
                vec2 q = (f - o) / r;
                q.y *= 1.0 + 0.25 * h21(id + 2.2);              // slightly squashed, not perfect bubbles
                float d = length(q);
                float body = smoothstep(1.0, 0.82, d) * on;
                // a drop is a little lens: the bright sky shows in its lower half, a dark rim on top
                float lens = smoothstep(0.7, -0.8, q.y);
                float rim = smoothstep(0.55, 1.0, d) * body;
                float hl = smoothstep(0.32, 0.0, length(q - vec2(-0.3, 0.38))) * body;
                vec3 col = mix(vec3(0.42, 0.48, 0.56), vec3(0.88, 0.93, 1.0), lens);
                col = mix(col, vec3(1.0), hl);
                float a = body * (0.16 + 0.22 * rim + 0.22 * lens + 0.5 * hl) * smoothstep(1.0, 0.86, vUv.y);
                if (uSnow > uRain) { col = vec3(1.0); a = smoothstep(1.0, 0.25, d) * on * 0.8; }
                if (uWipers > 0.5) {
                    float th = bladeAngle();
                    float b = max(blade(p, piv(0), th), blade(p, piv(1), th));
                    col = mix(col, vec3(0.07, 0.07, 0.09), b); a = max(a, b * 0.93);
                }
                gl_FragColor = vec4(col, a);
            }`,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    m.frustumCulled = false; m.renderOrder = 999; m.visible = false;
    return m;
}

// ── lightning ────────────────────────────────────────────────────────────
const BOLT_SEG = 26;
function makeBolt() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BOLT_SEG * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: "#eef2ff", transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    m.frustumCulled = false; m.visible = false;
    return m;
}
function shapeBolt(x, z) {
    const pos = bolt.geometry.attributes.position.array, cam = S.camPos;
    const pts = [];
    let px = x, py = 175, pz = z;
    pts.push([px, py, pz]);
    const main = 16;
    for (let i = 0; i < main; i++) {
        px += rand(-9, 9); pz += rand(-9, 9); py -= 175 / main;
        pts.push([px, Math.max(0, py), pz]);
    }
    let n = 0;
    const seg = (a, b, w) => {
        if (n >= BOLT_SEG) return;
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        V1.set(dy * (cam.z - a[2]) - dz * (cam.y - a[1]), dz * (cam.x - a[0]) - dx * (cam.z - a[2]), dx * (cam.y - a[1]) - dy * (cam.x - a[0])).normalize().multiplyScalar(w);
        const q = [a[0] - V1.x, a[1] - V1.y, a[2] - V1.z, a[0] + V1.x, a[1] + V1.y, a[2] + V1.z, b[0] + V1.x, b[1] + V1.y, b[2] + V1.z, b[0] - V1.x, b[1] - V1.y, b[2] - V1.z];
        pos.set([q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7], q[8], q[0], q[1], q[2], q[6], q[7], q[8], q[9], q[10], q[11]], n * 18);
        n++;
    };
    for (let i = 0; i < pts.length - 1; i++) seg(pts[i], pts[i + 1], 1.3);
    // a couple of forks
    for (let f = 0; f < 2; f++) {
        let a = pts[3 + Math.floor(Math.random() * 7)];
        for (let k = 0; k < 4; k++) { const b = [a[0] + rand(-12, 12), a[1] - rand(8, 16), a[2] + rand(-12, 12)]; seg(a, b, 0.7); a = b; }
    }
    bolt.geometry.setDrawRange(0, n * 6);
    bolt.geometry.attributes.position.needsUpdate = true;
}

// ── ground: wet grass darkens, snow settles (chained into the world ground shader) ──
const GU = { uAtmosWet: { value: 0 }, uAtmosSnow: { value: 0 } };
export function weatherBoot() {
    const gm = ctx.world.ground && ctx.world.ground.material;
    if (!gm) return;
    const prev = gm.onBeforeCompile, prevKey = gm.customProgramCacheKey;
    gm.onBeforeCompile = (sh, r) => {
        if (prev) prev(sh, r);
        Object.assign(sh.uniforms, GU);
        sh.fragmentShader = "uniform float uAtmosWet; uniform float uAtmosSnow;\n" + sh.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
            diffuseColor.rgb *= 1.0 - uAtmosWet * 0.22;
            #ifdef USE_MAP
              float atmosPatch = 0.72 + 0.28 * sin(vMapUv.x * 0.9 + sin(vMapUv.y * 0.7) * 2.0) * sin(vMapUv.y * 1.1);
            #else
              float atmosPatch = 1.0;
            #endif
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 1.0), clamp(uAtmosSnow * atmosPatch * 1.15, 0.0, 0.96));`);
    };
    gm.customProgramCacheKey = () => (prevKey ? prevKey.call(gm) : "") + "|atmos";
    gm.needsUpdate = true;
    ground = gm;
}

// ── road + shoulder look (shared world materials) ────────────────────────
let roadOrig = null, lastWet = -1, lastCover = -1;
const SNOWY = new THREE.Color("#eef2f8");
function setSurfaces(wet, cover) {
    if (Math.abs(wet - lastWet) < 0.003 && Math.abs(cover - lastCover) < 0.003) return;
    lastWet = wet; lastCover = cover;
    const M = worldMaterials();
    if (!roadOrig) roadOrig = { c: M.road.color.clone(), r: M.road.roughness, sc: M.shoulder.color.clone() };
    M.road.color.copy(roadOrig.c).multiplyScalar(1 - 0.38 * wet);
    M.road.roughness = lerp(roadOrig.r, 0.3, wet);
    M.shoulder.color.copy(roadOrig.sc).multiplyScalar(1 - 0.3 * wet).lerp(SNOWY, cover * 0.75);
    GU.uAtmosWet.value = wet; GU.uAtmosSnow.value = cover;
}

// ── the scheduler ─────────────────────────────────────────────────────────
export const W = { kind: "clear", t: 60, strength: 1, fairCloud: 0.3, rainT: 0, snowT: 0, fogT: 0, rainbowT: 0, strikeT: -99, nextStrike: 9, thunderAt: -1, thunderNear: 0.5, forced: false, fp: false };
let holT = -99, holV = null;
/** Today's holiday id from the meta feature (checked every few seconds, not every frame). */
const holiday = () => {
    if (Math.abs(S.time - holT) < 4) return holV;
    holT = S.time;
    try { const h = ctx.meta && ctx.meta.holiday && ctx.meta.holiday(); holV = h && h.h ? h.h.id : null; } catch (e) { holV = null; }
    return holV;
};

export function weatherReset() {
    Object.assign(W, { kind: "clear", t: rand(55, 95), rainT: 0, snowT: 0, fogT: 0, rainbowT: 0, strikeT: -99, thunderAt: -1, forced: false });
    S.rain = S.snow = S.fog = S.wet = S.snowCover = S.flash = S.rainbow = 0;
    S.cloud = W.fairCloud = rand(0.12, 0.42);
    S.wind.set(rand(-1.5, 1.5), 0, rand(-1.5, 1.5));
    if (holiday() === "chanukah" && Math.random() < 0.5) W.t = rand(15, 30);   // Chanukah: snow comes sooner
}

function weightsFor(biome) {
    const chan = holiday() === "chanukah";
    const w = { rain: 0.38, fog: 0.18, snow: chan ? 0.6 : 0.035, clear: 0.34 };
    if (biome === "desert") Object.assign(w, { rain: 0.1, fog: 0, snow: 0, clear: 0.6 });
    else if (biome === "strip") Object.assign(w, { rain: 0.22, fog: 0.04, snow: chan ? 0.3 : 0 });
    else if (biome === "coast") Object.assign(w, { rain: 0.26, fog: 0.36, snow: chan ? 0.3 : 0 });
    else if (biome === "dusk") w.fog = 0.12;
    return w;
}

/** Start a weather (tests: instant = true jumps straight to full strength). */
export function startWeather(kind, strength = 1, instant = false, dur = 0) {
    W.kind = kind; W.strength = strength;
    W.rainT = kind === "rain" ? strength : 0;
    W.snowT = kind === "snow" ? strength : 0;
    W.fogT = kind === "fog" ? strength : 0;
    W.t = dur || (kind === "rain" ? rand(55, 110) : kind === "snow" ? rand(70, 130) : kind === "fog" ? rand(28, 48) : rand(70, 150));
    if (kind !== "clear") W.rainbowT = 0;
    if (kind === "rain") { S.cloud = Math.max(S.cloud, 0.5); W.nextStrike = rand(4, 9); }
    if (instant) {
        S.rain = W.rainT; S.snow = W.snowT; S.fog = W.fogT;
        if (kind !== "clear") S.rainbow = 0;
        if (kind === "clear") { S.wet = 0; S.snowCover = 0; S.cloud = W.fairCloud || 0.3; }
        if (kind === "rain") S.wet = strength;
        if (kind === "snow") S.snowCover = Math.max(S.snowCover, strength * 0.8);
        if (kind !== "clear") S.cloud = kind === "fog" ? 0.6 : 0.95;
    }
    announce(kind, strength);
}

function announce(kind, strength) {
    const fp = S.fp;
    // (on foot the car's lines — "hold the wheel", "headlights on", "use your low beams" — are wrong: her own words)
    const foot = ctx.state === "footRun" || !!(ctx.foot && ctx.foot.active);
    if (foot && kind !== "snow") return say(kind === "fog" ? pick(["🌫️ Fog bank — I can't see my own flats!", "🌫️ Pea soup! Stay on the sidewalk, Lululeh"])
        : strength > 0.75 ? pick(["⛈️ Thunderstorm! Find a porch, mamele!", "⛈️ Storm's here — and me without an umbrella!"])
        : pick(["🌧️ Rain! And me in suede", "🌧️ Rain! Where's an umbrella gemach when you need one?"]), "", 8);
    if (kind === "rain") say(strength > 0.75 ? pick(["⛈️ Thunderstorm! Bubbe says pull over. (You don't have to.)", "⛈️ Storm's here — hold the wheel, mamele!"])
        : fp ? "🌧️ Rain! Wipers on" : pick(["🌧️ Rain! Headlights on, Lululeh", "🌧️ Rain! Good thing it's a convertible…"]), "", 8);
    else if (kind === "fog") say(pick(["🌫️ Fog bank — slow down, Lululeh!", "🌫️ Pea soup! Ima says use your low beams"]), "", 8);
    else if (kind === "snow") say(holiday() === "chanukah" ? pick(["❄️ Snow! A Chanukah miracle!", "❄️ Let it snow — happy Chanukah!"]) : "❄️ Snow?! In THIS economy?", "pink", 8);
}

function schedule(dt) {
    W.t -= dt;
    if (W.t > 0) return;
    if (W.kind !== "clear") {
        const wasRain = W.kind === "rain";
        startWeather("clear");
        if (wasRain && Math.random() < 0.75 && rainbowPossible()) W.rainbowT = rand(35, 50);
        return;
    }
    const w = weightsFor(S.biome);
    let r = Math.random() * (w.rain + w.fog + w.snow + w.clear);
    for (const k of ["rain", "fog", "snow"]) {
        if ((r -= w[k]) < 0) { startWeather(k, k === "rain" ? (Math.random() < 0.4 ? rand(0.85, 1) : rand(0.5, 0.8)) : k === "snow" ? rand(0.6, 1) : 1); return; }
    }
    W.t = rand(60, 130);
}

// ── per-frame ─────────────────────────────────────────────────────────────
let sprayAcc = 0, rainbowSaid = false;
export function weatherTick(dt) {
    const cruise = S.mode === "cruise";
    // Story: gentle Chanukah flurries in the leafy legs only (no lighting changes there)
    if (!cruise) {
        const flurry = S.mode === "base" && ctx.enabled("atmos") && holiday() === "chanukah" && /^(fall|pool|suburbs)$/.test(S.biome) && S.baseNight < 0.5;
        W.rainT = W.fogT = 0; W.snowT = flurry ? 0.45 : 0; W.rainbowT = 0;
    } else if (!W.forced && ctx.enabled("atmos") && (ctx.state === "playing" || ctx.state === "footRun")) schedule(dt);

    S.rain = approach(S.rain, W.rainT, W.rainT > S.rain ? 0.09 : 0.075, dt);
    S.snow = approach(S.snow, W.snowT, 0.07, dt);
    S.fog = approach(S.fog, W.fogT, W.fogT > S.fog ? 0.12 : 0.09, dt);
    S.wet = approach(S.wet, S.rain > 0.08 ? Math.max(S.wet, Math.min(1, S.rain * 1.4)) : 0, S.rain > 0.08 ? 0.12 : 0.022, dt);
    S.snowCover = approach(S.snowCover, S.snow > 0.15 ? Math.min(1, S.snow * 1.2) : 0, S.snow > 0.15 ? 0.022 : 0.015, dt);
    const cloudWant = Math.max(S.rain > 0.02 || W.rainT > 0 ? 0.98 : 0, S.snow > 0.02 ? 0.9 : 0, S.fog * 0.6);
    if (cloudWant > S.cloud) S.cloud = approach(S.cloud, cloudWant, 0.06, dt);
    else if (W.kind === "clear" && S.rain < 0.05 && S.snow < 0.05) S.cloud = approach(S.cloud, W.fairCloud || 0.3, 0.02, dt);
    W.rainbowT = Math.max(0, W.rainbowT - dt);
    S.rainbow = approach(S.rainbow, W.rainbowT > 0 ? 1 : 0, W.rainbowT > 0 ? 0.08 : 0.12, dt);
    if (S.rainbow > 0.3 && !rainbowSaid) rainbowSaid = say(pick(["🌈 A rainbow! Make a bracha!", "🌈 Rainbow! Dina's gonna want a picture"]), "gold", 4);
    if (S.rainbow < 0.05) rainbowSaid = false;
    // the wind picks up in a storm
    const ws = 1.2 + S.rain * 3 + S.snow * 1.5;
    const wl = Math.hypot(S.wind.x, S.wind.z) || 1;
    S.wind.x = S.wind.x / wl * ws; S.wind.z = S.wind.z / wl * ws;
    drift.x += S.wind.x * dt; drift.y += S.wind.z * dt;

    lightning(dt);
}

function lightning(dt) {
    if (S.mode === "cruise" && W.kind === "rain" && W.strength > 0.75 && S.rain > 0.6) {
        W.nextStrike -= dt;
        if (W.nextStrike <= 0) strike();
    }
    const k = S.time - W.strikeT;
    S.flash = k < 0 ? 0 : k < 0.06 ? 1 : k < 0.13 ? 0.28 : k < 0.21 ? 0.85 : 0.85 * Math.exp(-(k - 0.21) * 8);
    if (S.flash < 0.002) S.flash = 0;
    if (bolt) bolt.visible = k >= 0 && k < 0.32 && (k < 0.06 || k > 0.13);
    if (W.thunderAt > 0 && S.time >= W.thunderAt) {
        W.thunderAt = -1;
        if (!ctx.skipping && !ctx.paused) {
            sfx.thunder(W.thunderNear);
            rumble(0.25 + W.thunderNear * 0.4, 0.5, 500 + W.thunderNear * 500);
            emit("atmos:thunder", { near: W.thunderNear });       // (features/life: the town reacts)
        }
    }
}
/** Lightning somewhere ahead (tests can force one). */
export function strike() {
    ensureMeshes();
    W.nextStrike = rand(6, 15);
    W.strikeT = S.time;
    const cam = S.camPos, h = ctx.car ? ctx.car.h : 0;
    const a = h + rand(-0.8, 0.8), dist = rand(260, 620);
    shapeBolt(cam.x + Math.sin(a) * dist, cam.z + Math.cos(a) * dist);
    W.thunderNear = clamp(1 - (dist - 260) / 360);
    W.thunderAt = S.time + 0.4 + dist / 400;
}

function ensureMeshes() {
    if (rainMesh) return;
    rainMesh = makeRain(); snowMesh = makeSnow(); splashMesh = makeSplashes(); screen = makeScreen(); bolt = makeBolt();
    ctx.scene.add(rainMesh, snowMesh, splashMesh, screen, bolt);
    // keep the precipitation moving even in a cutscene that skips our ticks
    rainMesh.onBeforeRender = () => { rainMesh.material.uniforms.uTime.value = S.time; };
}

const RAIN_DAY = new THREE.Color("#e4ecf5"), RAIN_NIGHT = new THREE.Color("#9fb0d0"), SNOW_DAY = new THREE.Color("#ffffff"), SNOW_NIGHT = new THREE.Color("#c8d2ee");
/** Visuals + sound (after weatherTick). */
export function weatherVisuals(dt) {
    ensureMeshes();
    const q = S.q, car = ctx.car;
    // rain streaks: slanted by the wind and by the car's own speed
    const ru = rainMesh.material.uniforms;
    rainMesh.visible = S.rain > 0.004;
    if (rainMesh.visible) {
        const cvx = car.vx || 0, cvz = car.vz || 0;
        V1.set(S.wind.x - cvx * 0.55, -ru.uFall.value, S.wind.z - cvz * 0.55).normalize().negate();
        ru.uStreak.value.copy(V1);
        ru.uLen.value = 0.55 + Math.min(1.2, car.speed * 0.022);
        ru.uTime.value = S.time;
        ru.uAmount.value = S.rain;                                   // (the draw range already scales with quality)
        ru.uColor.value.copy(RAIN_DAY).lerp(RAIN_NIGHT, S.night);
        ru.uOpacity.value = lerp(0.62, 0.5, S.night) + S.flash * 0.4;
        rainMesh.geometry.setDrawRange(0, Math.ceil(MAX_RAIN * q) * 6);
        const onFoot = !!(ctx.foot && ctx.foot.active);
        ru.uBeamPos.value.set(car.pos.x + Math.sin(car.h) * 2, 0.8, car.pos.z + Math.cos(car.h) * 2);
        ru.uBeamDir.value.set(Math.sin(car.h), -0.02, Math.cos(car.h)).normalize();
        ru.uBeam.value = onFoot || !car.obj.visible ? 0 : S.lightsOn * smooth(0.2, 0.7, S.night);
    }
    const su = snowMesh.material.uniforms;
    snowMesh.visible = S.snow > 0.004;
    if (snowMesh.visible) {
        su.uTime.value = S.time; su.uAmount.value = S.snow;
        snowMesh.geometry.setDrawRange(0, Math.ceil(MAX_SNOW * Math.max(0.45, q)) * 6);
        su.uColor.value.copy(SNOW_DAY).lerp(SNOW_NIGHT, S.night);
    }
    const pu = splashMesh.material.uniforms;
    splashMesh.visible = S.rain > 0.05;
    if (splashMesh.visible) { pu.uTime.value = S.time; pu.uAmount.value = S.rain * Math.max(0.5, q); }
    setSurfaces(S.wet, S.snowCover);

    // the windscreen (Lulu's eyes, in the car)
    const sc = screen.material.uniforms;
    const glass = S.fp ? Math.max(S.rain, S.snow) : 0;
    screen.visible = glass > 0.02;
    if (screen.visible) {
        sc.uTime.value = S.time; sc.uRain.value = S.rain; sc.uSnow.value = S.snow;
        sc.uAspect.value = window.innerWidth / Math.max(1, window.innerHeight);
        sc.uCell.value = q < 0.5 ? 0.07 : 0.05;
        sc.uPeriod.value = S.rain > 0.75 ? 1.15 : 1.6;
    }

    // spray behind the wheels on a wet / snowy road
    spray(dt);
    // in the car: a drum on the bodywork + a duller hiss; on foot: the open-air hiss
    sfx.rainLoop(S.rain * (S.fp ? 1.15 : 0.85), ctx.state === "footRun" || (ctx.foot && ctx.foot.active) ? "foot" : "car");
}

// ── spray: our own soft mist sprites (pulled toward the camera so the road can't slice them) ──
class Mist {
    constructor(max) {
        this.max = max; this.i = 0;
        this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
        this.life = new Float32Array(max); this.max0 = new Float32Array(max);
        this.size = new Float32Array(max); this.a = new Float32Array(max); this.col = new Float32Array(max * 3);
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(this.p, 3).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("aA", new THREE.BufferAttribute(this.a, 1).setUsage(THREE.DynamicDrawUsage));
        g.setAttribute("aCol", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
        this.geo = g;
        this.mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, fog: false,
            uniforms: { uHalfH: { value: 300 } },
            vertexShader: `attribute float aSize; attribute float aA; attribute vec3 aCol; uniform float uHalfH; varying float vA; varying vec3 vC;
                void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = max(0.3, -mv.z);
                    gl_PointSize = aSize * projectionMatrix[1][1] * uHalfH / d;
                    mv.z = min(mv.z + min(1.8, d * 0.45), -0.25);
                    vA = aA; vC = aCol; gl_Position = projectionMatrix * mv; }`,
            fragmentShader: `varying float vA; varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0;
                float a = smoothstep(1.0, 0.0, r); a *= a * vA; if (a < 0.003) discard; gl_FragColor = vec4(vC, a); }`,
        });
        this.points = new THREE.Points(g, this.mat);
        this.points.frustumCulled = false;
        this.points.renderOrder = 7;
        this.live = 0;
    }
    emit(x, y, z, vx, vy, vz, size, life, c) {
        const i = this.i++ % this.max;
        this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
        this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
        this.life[i] = this.max0[i] = life; this.size[i] = size;
        this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
    }
    update(dt) {
        let live = 0;
        const drag = Math.exp(-2.2 * dt);
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) { this.a[i] = 0; continue; }
            live++;
            this.life[i] -= dt;
            const t = Math.max(0, this.life[i] / this.max0[i]);
            for (let k = 0; k < 3; k++) { this.p[i * 3 + k] += this.v[i * 3 + k] * dt; this.v[i * 3 + k] *= drag; }
            this.v[i * 3 + 1] -= 1.2 * dt;
            if (this.p[i * 3 + 1] < 0.15) this.p[i * 3 + 1] = 0.15;
            this.size[i] += dt * 1.6;
            this.a[i] = Math.sin(t * Math.PI) * 0.32;
        }
        this.live = live;
        const a = this.geo.attributes;
        a.position.needsUpdate = a.aSize.needsUpdate = a.aA.needsUpdate = a.aCol.needsUpdate = true;
        this.points.visible = live > 0;
        if (ctx.renderer) this.mat.uniforms.uHalfH.value = ctx.renderer.domElement.height / 2;
    }
}
let mist = null;
const SPRAY_RAIN = [0.84, 0.88, 0.93], SPRAY_SNOW = [0.97, 0.98, 1];
function spray(dt) {
    if (!mist) { mist = new Mist(260); ctx.scene.add(mist.points); }
    const amt = Math.max(S.wet * 0.9, S.snowCover * 0.7);
    if (amt >= 0.06 && S.dt) {
        const car = ctx.car, col = S.snowCover > S.wet ? SPRAY_SNOW : SPRAY_RAIN;
        const night = 1 - S.night * 0.55, c = [col[0] * night, col[1] * night, col[2] * night];
        const onFoot = !!(ctx.foot && ctx.foot.active);
        if (!onFoot && car.obj.visible && car.speed > 7) {
            sprayAcc += amt * Math.min(1, car.speed / 28) * 40 * Math.max(0.4, S.q) * dt;
            const fx = Math.sin(car.h), fz = Math.cos(car.h), rx = -Math.cos(car.h), rz = Math.sin(car.h);
            while (sprayAcc >= 1) {
                sprayAcc -= 1;
                const side = Math.random() < 0.5 ? -1 : 1;
                const x = car.pos.x - fx * 1.6 + rx * side * 0.85, z = car.pos.z - fz * 1.6 + rz * side * 0.85;
                mist.emit(x, 0.35, z, car.vx * 0.4 + rx * side * rand(0.5, 1.8), rand(1.0, 2.2), car.vz * 0.4 + rz * side * rand(0.5, 1.8), rand(0.45, 0.8), rand(0.5, 0.8), c);
            }
        }
        // a little from traffic near the camera
        if (ctx.traffic) {
            let n = 0;
            for (const tc of ctx.traffic.cars) {
                if (n >= 5 || !tc.obj.parent || tc.hit || (tc.speed || 0) < 8) continue;
                const o = tc.obj.position, dx = o.x - S.camPos.x, dz = o.z - S.camPos.z;
                if (dx * dx + dz * dz > 80 * 80 || Math.random() > amt * 14 * dt * S.q) continue;
                n++;
                const h = tc.obj.rotation.y, back = (tc.spec && tc.spec.len ? tc.spec.len / 2 : 2.2) + 0.2;
                const fx = Math.sin(h), fz = Math.cos(h), side = Math.random() < 0.5 ? -1 : 1;
                mist.emit(o.x - fx * back - Math.cos(h) * side * 0.8, 0.4, o.z - fz * back + Math.sin(h) * side * 0.8,
                    fx * tc.speed * 0.35 + rand(-0.6, 0.6), rand(0.8, 1.6), fz * tc.speed * 0.35 + rand(-0.6, 0.6), rand(0.5, 0.9), 0.7, c);
            }
        }
    }
    mist.update(S.dt);
}

export function weatherHide() {
    if (rainMesh) rainMesh.visible = snowMesh.visible = splashMesh.visible = screen.visible = bolt.visible = false;
    if (mist) { mist.life.fill(0); mist.points.visible = false; }
    setSurfaces(0, 0);
    S.flash = 0;
    sfx.rainLoop(0);
}

export function weatherInfo() {
    return { kind: W.kind, rain: S.rain, snow: S.snow, fog: S.fog, wet: S.wet, snowCover: S.snowCover, rainbow: S.rainbow, flash: S.flash,
        rainVisible: !!(rainMesh && rainMesh.visible), drops: rainMesh && rainMesh.visible ? Math.round(Math.min(MAX_RAIN, rainMesh.geometry.drawRange.count / 6) * rainMesh.material.uniforms.uAmount.value) : 0,
        snowVisible: !!(snowMesh && snowMesh.visible), screen: !!(screen && screen.visible), splashes: !!(splashMesh && splashMesh.visible),
        roadRough: worldMaterials().road.roughness, timer: W.t, snowTarget: W.snowT, holiday: holiday() };
}

on("run:start", () => weatherReset());
