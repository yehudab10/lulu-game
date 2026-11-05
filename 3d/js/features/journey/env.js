// features/journey/env.js — the road to Vegas as one continuous world:
//   fall suburbs → pool town → the coast (ocean + palms) → golden-dusk boutique
//   row → desert heat (cacti, mesas) → the neon Strip at night.
// Biomes (world.biomeAt), registered scenery, sky + lights + fog per leg (blended
// by position), sandy ground overlays, the ocean, per-stop set pieces + finish
// gates + their greeters, road signs, street lamps, neon signs and mesas.
import * as THREE from "three";
import { ctx, on, hook, emit } from "../../core/ctx.js";
import { registerModels, ensureModels, models, cloneWithColors, findNodes, instanced } from "../../models.js";
import { registerScenery, ribbon, signTexture, facingRoad, worldMaterials, canvasTex, SHOULDER, STEP } from "../../world.js";
import { spawnPerson } from "../../core/people.js";
import { STOPS, N_STOPS, stopS, legStartS, GATE_BACK } from "./data.js";
import { layoutMult, regionAt, boundaries } from "./state.js";

// ── models (all lazy; scenery is warmed up in the background at boot) ─────
const MODEL_FILES = {};
for (const f of ["palm", "cactus", "shrub", "mesa", "beachhouse", "boutique", "adobe", "casino", "neon_sign", "streetlamp", "umbrella",
    "gate_bubbe", "gate_heshy", "gate_beach", "gate_avigail", "gate_vegas", "cholent", "pool", "beach", "avigail_house", "vegas",
    "seagull", "kite", "beachball", "sunhat", "box", "phone", "floatie", "morgan", "minivan", "icecream", "burry_truck", "avigail_car",
    "burry", "mindy"]) MODEL_FILES["journey_" + f] = "journey_" + f;
registerModels(MODEL_FILES);
export const SCENERY_MODELS = ["journey_palm", "journey_cactus", "journey_shrub", "journey_mesa", "journey_beachhouse", "journey_boutique",
    "journey_adobe", "journey_casino", "journey_neon_sign", "journey_streetlamp", "journey_umbrella"];
const STOP_MODELS = [
    ["journey_gate_bubbe", "journey_cholent"],
    ["journey_gate_heshy", "journey_pool", "journey_floatie", "heshyPerson"],
    ["journey_gate_beach", "journey_beach", "journey_seagull", "journey_morgan"],
    ["journey_gate_avigail", "journey_avigail_house", "avigailPerson"],
    ["journey_gate_vegas", "journey_vegas", "journey_burry_truck", "journey_burry", "journey_mindy", "npcKid", "heshyPerson", "avigailPerson", "imaPerson"],
];
/** Warm up the models a leg (and its neighbours) will need. Never throws. */
export function warmLeg(i) {
    const keys = new Set(SCENERY_MODELS.concat(["journey_phone", "journey_floatie"]));
    for (const k of [i - 1, i, i + 1]) if (STOP_MODELS[k]) for (const m of STOP_MODELS[k]) keys.add(m);
    return ensureModels([...keys]).catch(e => console.warn("[journey] model warm-up", e));
}

// ── scenery types ─────────────────────────────────────────────────────────
registerScenery("autumnOrange", { model: "treeRound", collide: 0.5, scale: [0.85, 1.45], tint: ["Leaves"], colors: { Leaves: "#E8833A" } });
registerScenery("autumnRed", { model: "treeRound", collide: 0.5, scale: [0.85, 1.4], tint: ["Leaves"], colors: { Leaves: "#C6452F" } });
registerScenery("autumnGold", { model: "treeRound", collide: 0.5, scale: [0.8, 1.35], tint: ["Leaves"], colors: { Leaves: "#E9B53A" } });
registerScenery("summerTree", { model: "treeRound", collide: 0.5, scale: [0.9, 1.5], tint: ["Leaves"], colors: { Leaves: "#58B83C" } });
registerScenery("duskTree", { model: "treeRound", collide: 0.5, scale: [0.85, 1.35], tint: ["Leaves"], colors: { Leaves: "#5F9A4A" } });
registerScenery("palm", { model: "journey_palm", collide: 0.35, scale: [0.85, 1.3], tint: ["PalmLeaves"], colors: { PalmLeaves: "#3FA34D" } });
registerScenery("cactus", { model: "journey_cactus", collide: 0.4, scale: [0.75, 1.5], tint: ["Cactus"], colors: { Cactus: "#5E9E4A" } });
registerScenery("desertBrush", { model: "journey_shrub", collide: 0, scale: [0.7, 1.5], tint: ["Brush"], colors: { Brush: "#A3A86B" } });

const PASTELS = ["#FFE0B2", "#FFF3E0", "#E3F2FD", "#F8BBD0", "#DCEDC8", "#FFF9C4", "#E1BEE7", "#B2EBF2"];
const BIOMES = {
    fall: {
        name: "fall", trees: { autumnOrange: 0.26, autumnRed: 0.18, autumnGold: 0.2, treePine: 0.24, bush: 0.12 }, density: 1, houses: 0.7,
        houseModel: "house", walls: ["#FFE0B2", "#FFF3E0", "#E3F2FD", "#F8BBD0", "#FFF9C4", "#D7CCC8"], roofs: ["#C0504D", "#5D6D7E", "#8D6E63", "#A0522D"],
        poles: true, coins: 1, ground: "#FFE9A6",
    },
    pool: {
        name: "pool", trees: { summerTree: 0.5, palm: 0.16, bush: 0.34 }, density: 0.9, houses: 0.8,
        houseModel: "house", walls: PASTELS, roofs: ["#29B6F6", "#C0504D", "#FFFFFF", "#455A8C", "#26A69A"],
        poles: true, coins: 1, ground: "#ffffff",
    },
    coast: {
        name: "coast", trees: { palm: 0.7, bush: 0.3 }, density: 0.7, houses: 0.55,
        houseModel: "journey_beachhouse", walls: ["#80DEEA", "#FFF59D", "#F8BBD0", "#C5E1A5", "#FFFFFF", "#FFCC80"], roofs: ["#FFFFFF", "#0288D1", "#FF8A65"],
        poles: false, coins: 1.1, ground: "#ffffff",
    },
    dusk: {
        name: "dusk", trees: { duskTree: 0.45, palm: 0.15, bush: 0.4 }, density: 0.8, houses: 0.9,
        houseModel: "journey_boutique", walls: ["#F8BBD0", "#E1BEE7", "#FFE0B2", "#D1C4E9", "#FFCDD2", "#B2DFDB"], roofs: ["#AD1457", "#6A1B9A", "#00897B", "#F57C00", "#283593"],
        poles: false, coins: 1, ground: "#E8D6B8",
    },
    desert: {
        name: "desert", trees: { cactus: 0.42, desertBrush: 0.58 }, density: 0.55, houses: 0.22,
        houseModel: "journey_adobe", walls: ["#E8C39E", "#F0D2AE", "#D9A87A", "#EBC9A0"], roofs: ["#C77B4A", "#A1663C", "#8D6E63"],
        poles: true, coins: 0.9, ground: "#ffffff",
    },
    strip: {
        name: "strip", trees: { palm: 0.55, desertBrush: 0.45 }, density: 0.6, houses: 0.95,
        houseModel: "journey_casino", walls: ["#5E35B1", "#283593", "#AD1457", "#00838F", "#4527A0", "#B71C1C"], roofs: ["#FFD54F", "#FFFFFF", "#80DEEA"],
        poles: false, coins: 1.2, ground: "#ffffff",
    },
};
/** Fill in any missing biome fields from the core default (once, at boot). */
function finishBiomes(world) {
    const base = world.defaultBiome();
    for (const k of Object.keys(BIOMES)) BIOMES[k] = Object.assign({}, base, BIOMES[k]);
}

// ── sky / light palettes per region ───────────────────────────────────────
const PAL = {
    fall:   { top: "#4A8FD8", mid: "#A7D0EE", bottom: "#FBE7CC", fog: "#E9E0CD", near: 160, far: 640, hemiSky: "#d9e8ff", hemiGround: "#7d7a45", hemiI: 1.3, sun: "#ffd9a8", sunI: 2.55, sunOff: [-46, 58, -30], night: 0 },
    pool:   { top: "#2F8FE8", mid: "#8ED0FF", bottom: "#E6F7FF", fog: "#d4efff", near: 160, far: 660, hemiSky: "#cfeaff", hemiGround: "#5f8a45", hemiI: 1.4, sun: "#fff6e6", sunI: 2.8, sunOff: [-38, 72, -26], night: 0 },
    coast:  { top: "#2A9DF4", mid: "#9BE1FF", bottom: "#F0FBFF", fog: "#CFEFFF", near: 150, far: 620, hemiSky: "#d6f2ff", hemiGround: "#c9b98a", hemiI: 1.45, sun: "#fffbef", sunI: 2.75, sunOff: [-30, 74, -36], night: 0 },
    dusk:   { top: "#3B2A6B", mid: "#E07A5F", bottom: "#FFC46B", fog: "#E9A57E", near: 120, far: 560, hemiSky: "#ffc7a8", hemiGround: "#5a4a6a", hemiI: 1.15, sun: "#ffad6b", sunI: 2.2, sunOff: [-70, 26, -44], night: 0.25 },
    desert: { top: "#3F86D4", mid: "#F3C98B", bottom: "#FFE7B0", fog: "#F2D7A6", near: 150, far: 640, hemiSky: "#ffe9c4", hemiGround: "#a07040", hemiI: 1.35, sun: "#fff0d0", sunI: 3.0, sunOff: [-34, 78, -22], night: 0 },
    strip:  { top: "#0D0221", mid: "#311B4D", bottom: "#8E3B76", fog: "#2A1638", near: 90, far: 520, hemiSky: "#8a78d8", hemiGround: "#2a1838", hemiI: 0.95, sun: "#b8b0ff", sunI: 0.7, sunOff: [-30, 60, -40], night: 1 },
};
let DEFAULT_PAL = null;
const colorCache = new Map();
const col = hex => { let c = colorCache.get(hex); if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c); } return c; };
function lerpHex(key, a, b, t, out) { return out.copy(col(a[key])).lerp(col(b[key]), t); }

/** Palette blend at road position s: {a, b, t}. */
export function paletteAt(s) {
    const bs = boundaries();
    let key = "fall";
    for (const b of bs) {
        if (s < b.s) return { a: PAL[key], b: PAL[key], t: 0, key };
        if (s < b.s + 520) return { a: PAL[b.from], b: PAL[b.to], t: smooth((s - b.s) / 520), key: b.to };
        key = b.to;
    }
    return { a: PAL[key], b: PAL[key], t: 0, key };
}
function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

export const env = { night: 0, key: "fall", sand: 0, desert: 0 };

function applyPalette(p) {
    const w = ctx.world, L = ctx.lights;
    const u = w.sky.material.uniforms;
    lerpHex("top", p.a, p.b, p.t, u.top.value);
    lerpHex("mid", p.a, p.b, p.t, u.mid.value);
    lerpHex("bottom", p.a, p.b, p.t, u.bottom.value);
    if (ctx.scene.fog) {
        lerpHex("fog", p.a, p.b, p.t, ctx.scene.fog.color);
        ctx.scene.fog.near = p.a.near + (p.b.near - p.a.near) * p.t;
        ctx.scene.fog.far = p.a.far + (p.b.far - p.a.far) * p.t;
    }
    lerpHex("hemiSky", p.a, p.b, p.t, L.hemi.color);
    lerpHex("hemiGround", p.a, p.b, p.t, L.hemi.groundColor);
    L.hemi.intensity = p.a.hemiI + (p.b.hemiI - p.a.hemiI) * p.t;
    lerpHex("sun", p.a, p.b, p.t, L.sun.color);
    L.sun.intensity = p.a.sunI + (p.b.sunI - p.a.sunI) * p.t;
    for (let k = 0; k < 3; k++) L.sunOffset.setComponent(k, p.a.sunOff[k] + (p.b.sunOff[k] - p.a.sunOff[k]) * p.t);
    env.night = p.a.night + (p.b.night - p.a.night) * p.t;
    if (w.clouds) w.clouds.visible = env.night < 0.6;
}

function restoreDefault() {
    if (!DEFAULT_PAL) return;
    applyPalette({ a: DEFAULT_PAL, b: DEFAULT_PAL, t: 0 });
}

// ── sandy ground (beach sand at the coast, desert sand from the desert on) ─
// Blended into the core grass material in its shader (no extra transparent
// plane → no z-fighting far away): diffuse = mix(grass, sand, jSand), etc.
const GU = { jSand: { value: 0 }, jDesert: { value: 0 }, jSandMap: { value: null }, jDesertMap: { value: null } };
function sandTexture(base, dots) {
    return canvasTex(256, 256, (g, w, h) => {
        g.fillStyle = base; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 50; i++) {
            g.fillStyle = i % 2 ? "rgba(255,255,255,0.10)" : "rgba(120,80,30,0.08)";
            g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 12 + Math.random() * 30, 4 + Math.random() * 8, Math.random() * 3, 0, 7); g.fill();
        }
        for (let i = 0; i < 2600; i++) {
            g.fillStyle = dots[i % dots.length];
            const r = Math.random() * 2 + 0.5;
            g.fillRect(Math.random() * w, Math.random() * h, r, r);
        }
    });
}
function makeGroundBlend(world) {
    GU.jSandMap.value = sandTexture("#EFD9A6", ["#F7E7C1", "#E2C68D", "#F2DEB0", "#D9BC85"]);
    GU.jDesertMap.value = sandTexture("#E2AE74", ["#ECC08A", "#D49A5F", "#F0CB97", "#C98A52"]);
    const gm = world.ground && world.ground.material;
    if (!gm) return;
    const prev = gm.onBeforeCompile;
    gm.onBeforeCompile = (shader, r) => {
        if (prev) prev(shader, r);
        Object.assign(shader.uniforms, GU);
        shader.fragmentShader = "uniform float jSand; uniform float jDesert; uniform sampler2D jSandMap; uniform sampler2D jDesertMap;\n" +
            shader.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
            #ifdef USE_MAP
              if (jSand > 0.001) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(jSandMap, vMapUv).rgb, jSand);
              if (jDesert > 0.001) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(jDesertMap, vMapUv).rgb, jDesert);
            #endif`);
    };
    gm.customProgramCacheKey = () => "journeyGround";
    gm.needsUpdate = true;
}
function sandAt(s) {
    // coast: beach sand fades in after the pool-town stop and out after the beach; desert sand from the desert on
    const m = layoutMult();
    const c0 = stopS(1, m) + 100, c1 = stopS(2, m) + 100, d0 = stopS(3, m) + 100;
    const sand = smooth((s - c0) / 450) * (1 - smooth((s - c1) / 450));
    const desert = smooth((s - d0) / 550);
    return { sand, desert };
}

// ── per-frame environment tick (driving + title) ──────────────────────────
let lastRegionKey = "";
const DEFAULT_TRAFFIC = {};
const TRAFFIC = { fall: [5, 3], pool: [5, 3], coast: [4, 3], dusk: [5, 3], desert: [3, 2], strip: [6, 4] };
export function envTick(dt) {
    if (!ctx.world || !ctx.car) return;
    const s = ctx.car.s;
    const p = paletteAt(s);
    applyPalette(p);
    env.key = p.key;
    const o = sandAt(s);
    env.sand = o.sand; env.desert = o.desert;
    GU.jSand.value = o.sand * 0.94;
    GU.jDesert.value = o.desert;
    const r = regionAt(s);
    if (r.key !== lastRegionKey) {
        lastRegionKey = r.key;
        const t = ctx.traffic && ctx.traffic.config;
        if (t && TRAFFIC[r.key]) { t.ours = TRAFFIC[r.key][0]; t.oncoming = TRAFFIC[r.key][1]; }
        emit("journey:region", { key: r.key, leg: r.leg });
    }
    updateHeadlights(dt);
}
export function envReset() {
    lastRegionKey = "";
    restoreDefault();
    GU.jSand.value = GU.jDesert.value = 0;
    const t = ctx.traffic && ctx.traffic.config;
    if (t && DEFAULT_TRAFFIC.ours != null) { t.ours = DEFAULT_TRAFFIC.ours; t.oncoming = DEFAULT_TRAFFIC.oncoming; }
}

// fake headlight beams on the road at dusk / night (additive, no real lights)
let beams = null;
function makeBeams() {
    const tex = canvasTex(128, 256, (g, w, h) => {
        const grd = g.createRadialGradient(w / 2, h, 4, w / 2, h * 0.75, h * 0.8);
        grd.addColorStop(0, "rgba(255,244,214,0.95)");
        grd.addColorStop(0.5, "rgba(255,236,190,0.35)");
        grd.addColorStop(1, "rgba(255,236,190,0)");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    beams = new THREE.Mesh(new THREE.PlaneGeometry(7, 20), m);
    beams.rotation.x = -Math.PI / 2;
    beams.position.set(0, 0.06, 12.0);
    beams.renderOrder = 2;
    beams.visible = false;
    ctx.car.obj.add(beams);
}
function updateHeadlights() {
    if (!beams) return;
    const a = Math.max(0, env.night - 0.15) * 0.55;
    beams.material.opacity = a;
    beams.visible = a > 0.01 && ctx.car.obj.visible;
}

// ── boot: biomes, overlay, palettes, reserved stretches ───────────────────
const reserves = [];
let reserveMult = -1;
export function syncReserves() {
    const m = layoutMult();
    if (m === reserveMult || !reserves.length) return;
    reserveMult = m;
    for (let i = 0; i < N_STOPS; i++) {
        const S = stopS(i, m);
        Object.assign(reserves[i * 2], { s0: S - GATE_BACK - 30, s1: S + 55 });
        Object.assign(reserves[i * 2 + 1], { s0: S - GATE_BACK - 4, s1: S - GATE_BACK + 4 });
    }
    // the ocean side of the coast road
    Object.assign(reserves[N_STOPS * 2], { s0: stopS(1, m) + 120, s1: stopS(2, m) + 300 });
}

on("boot", () => {
    const w = ctx.world;
    finishBiomes(w);
    const u = w.sky.material.uniforms, L = ctx.lights;
    DEFAULT_PAL = {
        top: "#" + u.top.value.getHexString(), mid: "#" + u.mid.value.getHexString(), bottom: "#" + u.bottom.value.getHexString(),
        fog: "#" + ctx.scene.fog.color.getHexString(), near: ctx.scene.fog.near, far: ctx.scene.fog.far,
        hemiSky: "#" + L.hemi.color.getHexString(), hemiGround: "#" + L.hemi.groundColor.getHexString(), hemiI: L.hemi.intensity,
        sun: "#" + L.sun.color.getHexString(), sunI: L.sun.intensity, sunOff: L.sunOffset.toArray(), night: 0,
    };
    Object.assign(DEFAULT_TRAFFIC, { ours: ctx.traffic.config.ours, oncoming: ctx.traffic.config.oncoming });
    w.biomeAt = s => { syncReserves(); return BIOMES[regionAt(s).key] || BIOMES.fall; };
    for (let i = 0; i < N_STOPS; i++) {
        w.reserve(0, 0, 1, 9, 95);       // the property (+ trees, houses, poles, speed traps)
        w.reserve(0, 0, -1, 9, 13);      // the gate's left post
    }
    w.reserve(0, 0, 1, 9.2, 9999);       // the coast: beach + ocean on the right
    reserves.push(...w.reserved.slice(-(N_STOPS * 2 + 1)));
    syncReserves();
    makeGroundBlend(w);
    makeBeams();
    warmLeg(0);
    setTimeout(() => warmLeg(1), ctx.TEST ? 0 : 4000);
});

// ── chunk set pieces ──────────────────────────────────────────────────────
const M = {};
function mats() {
    if (M.water) return M;
    const waves = canvasTex(256, 256, (g, w, h) => {
        const grd = g.createLinearGradient(0, 0, w, 0);
        grd.addColorStop(0, "#2D9CDB"); grd.addColorStop(1, "#1F7FC4");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 3;
        for (let i = 0; i < 26; i++) {
            const y = Math.random() * h, x = Math.random() * w, L = 20 + Math.random() * 50;
            g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + L / 2, y - 4, x + L, y); g.stroke();
        }
    });
    waves.repeat.set(6, 1);
    M.water = new THREE.MeshStandardMaterial({ map: waves, roughness: 0.18, metalness: 0.1, color: "#ffffff",
        polygonOffset: true, polygonOffsetFactor: -0.6, polygonOffsetUnits: -0.6 });
    M.foam = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.7, depthWrite: false });
    M.wet = new THREE.MeshStandardMaterial({ color: "#D8BB82", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -0.55, polygonOffsetUnits: -0.55 });
    M.poolWater = new THREE.MeshStandardMaterial({ color: "#5ED0FA", roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.88 });
    M.coping = new THREE.MeshStandardMaterial({ color: "#FAFAFA", roughness: 0.6 });
    M.poolGeo = new THREE.BoxGeometry(6.6, 0.22, 3.6);
    M.poolWaterGeo = new THREE.PlaneGeometry(6.0, 3.0).rotateX(-Math.PI / 2);
    M.glow = new THREE.MeshBasicMaterial({ map: canvasTex(64, 64, (g, w, h) => {
        const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
        grd.addColorStop(0, "rgba(255,240,180,1)"); grd.addColorStop(1, "rgba(255,240,180,0)");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    return M;
}
/** A road band whose edges vary with s: d0(s) → d1(s). */
function band(road, s0, s1, d0f, d1f, y, vScale = 10, step = STEP * 2) {
    const n = Math.round((s1 - s0) / step) + 1;
    const pos = new Float32Array(n * 6), uv = new Float32Array(n * 4), nor = new Float32Array(n * 6), idx = [];
    const p = {};
    for (let k = 0; k < n; k++) {
        const s = s0 + k * step;
        road.point(s, d0f(s), p); pos.set([p.x, y, p.z], k * 6);
        road.point(s, d1f(s), p); pos.set([p.x, y, p.z], k * 6 + 3);
        uv.set([0, s / vScale, 1, s / vScale], k * 4);
        nor.set([0, 1, 0, 0, 1, 0], k * 6);
        if (k < n - 1) { const a = k * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return g;
}
/** The shoreline (metres to the right of the road) along the coast leg. */
function shoreAt(s) {
    const m = layoutMult();
    const c0 = stopS(1, m) + 120, c1 = stopS(2, m) + 260;
    const inn = smooth((s - c0) / 700), out = smooth((s - c1) / 500);
    const base = 32 + Math.sin(s / 95) * 5 + Math.sin(s / 37) * 1.5;
    const B = stopS(2, m), bay = 12 * Math.exp(-(((s - B) / 45) ** 2));   // room for the beach set
    return base + bay + (1 - inn) * 260 + out * 260;
}
function coastRange() {
    const m = layoutMult();
    return [stopS(1, m) + 120, stopS(2, m) + 820];
}

// live set pieces per stop: { chunk, greeters: {...}, anim }
export const sets = {};
const deadChunks = new WeakSet();
on("chunk:dispose", ({ chunk }) => {
    deadChunks.add(chunk);
    for (const k of Object.keys(sets)) if (sets[k].chunk === chunk) delete sets[k];
});
/** Run fn once the models exist (now, or later if the chunk is still alive). */
function withModels(keys, chunk, fn) {
    if (keys.every(k => models[k])) { try { fn(); } catch (e) { console.error("[journey set]", e); } return; }
    ensureModels(keys).then(() => { if (!deadChunks.has(chunk)) { try { fn(); } catch (e) { console.error("[journey set]", e); } } })
        .catch(e => console.warn("[journey] models", e));
}

function place(obj, road, s, d, side = 1, yaw = 0) {
    const p = road.point(s, d, {});
    obj.position.set(p.x, 0, p.z);
    obj.rotation.y = facingRoad(road.at(s).h, side) + yaw;
    return obj;
}

const GATE_TEXT = {
    bubbe: [["BUBBE'S HOUSE"], ["DRIVE SAFE, LULULEH!"], "#E91E63"],
    heshy: [["HESHY'S POOL"], ["CANNONBALL ZONE!"], "#0288D1"],
    beach: [["THE BEACH"], ["SALT AIR - ZERO TRAFFIC"], "#F57C00"],
    avigail: [["AVIGAIL'S PLACE"], ["NO BUMPING THE CAR"], "#8E24AA"],
    vegas: [["VIVA VEGAS"], ["WHAT HAPPENS HERE, BUBBE HEARS ABOUT"], "#C62828"],
};
function buildGate(i, G, chunk, world) {
    const st = STOPS[i], key = "journey_gate_" + st.id;
    withModels([key], chunk, () => {
        const road = world.road, h = road.at(G).h, ap = road.at(G);
        const gate = cloneWithColors(models[key]);
        gate.position.set(ap.x, 0, ap.z);
        gate.rotation.y = h + Math.PI;
        const [front, back, bg] = GATE_TEXT[st.id];
        const M0 = worldMaterials();
        const board = new THREE.Mesh(chunk.own(new THREE.BoxGeometry(18.8, 2.2, 0.12)), [
            M0.metal, M0.metal, M0.metal, M0.metal,
            new THREE.MeshStandardMaterial({ map: signTexture(front, bg, "#ffffff", 1024, 128), roughness: 0.6, emissive: "#ffffff", emissiveIntensity: 0.08, emissiveMap: null }),
            new THREE.MeshStandardMaterial({ map: signTexture(back, bg, "#ffffff", 1024, 128), roughness: 0.6 }),
        ]);
        board.castShadow = true;
        const anc = findNodes(gate, "Anchor_banner")[0];
        if (anc) anc.add(board); else { board.position.y = 6.6; gate.add(board); }
        chunk.add(gate);
        // bob the balloons / flamingo a touch
        const t0 = Math.random() * 6;
        chunk.onAnimate(t => { gate.position.y = Math.sin(t * 1.3 + t0) * 0.03; });
        for (const s of [-1, 1]) {
            const p = road.point(G, s * 9.6, {});
            chunk.addCollider({ x: p.x, z: p.z, r: 0.4, kind: "pole" });
        }
    });
}

function steamEmitter(obj, chunk, rate = 0.12) {
    let acc = 0, last = 0;
    const v = new THREE.Vector3();
    chunk.onAnimate(t => {
        const dt = Math.min(0.1, t - last); last = t;
        acc += dt;
        if (acc < rate || !ctx.car) return;
        acc = 0;
        obj.getWorldPosition(v);
        if (v.distanceToSquared(ctx.car.pos) > 120 * 120) return;
        ctx.car.fx.emit(v.x + (Math.random() - 0.5) * 0.1, v.y, v.z + (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2, 1.4, (Math.random() - 0.5) * 0.2, 0.35, 1.6, [1, 1, 1]);
    });
}

/** A Person that animates itself in the chunk; `mode()` returns its current pose opts. */
function addPerson(chunk, key, x, z, rotY, scale, modeFn, colors) {
    const per = spawnPerson(key, { scale, colors });
    per.obj.position.set(x, 0, z);
    per.obj.rotation.y = rotY;
    chunk.add(per.obj);
    let last = 0;
    chunk.onAnimate(t => {
        const dt = Math.min(0.1, Math.max(0, t - last)); last = t;
        per.update(dt, modeFn ? modeFn(t, per) : {});
    });
    return per;
}

export const focus = { stop: -1, t: 0, phase: "" };   // the arrival cutscene drives the greeters
const isFocus = i => focus.stop === i;

function buildProperty(i, S, chunk, world) {
    const road = world.road, st = STOPS[i], h = road.at(S).h, M0 = worldMaterials();
    const set = sets[i] = { chunk, i, people: [] };
    // a paved driveway from the shoulder up to the property
    chunk.addMesh(ribbon(road, S - 2.6, S + 2.6, SHOULDER, 15, 0.025, 10), M0.drive);
    const toRoad = facingRoad(h, 1);
    if (st.id === "bubbe") {
        const p = road.point(S, 27, {});
        const house = cloneWithColors(models.bubbeHouse);
        house.position.set(p.x, 0, p.z); house.rotation.y = toRoad;
        chunk.add(house);
        chunk.addCollider({ x: p.x, z: p.z, r: 6.4, kind: "house" });
        const b = cloneWithColors(models.bubbe);
        place(b, road, S + 3.2, 15.6, 1, -0.5);
        b.scale.setScalar(1.6);
        chunk.add(b);
        set.greeter = b;
        const arm = findNodes(b, "Arm_Wave")[0], base = arm ? arm.rotation.z : 0;
        chunk.onAnimate(t => {
            if (!arm) return;
            const sp = isFocus(i) ? 11 : 7;
            arm.rotation.z = base + Math.sin(t * sp) * (isFocus(i) ? 0.6 : 0.45);
            b.position.y = isFocus(i) ? Math.abs(Math.sin(t * 5)) * 0.08 : 0;
        });
        withModels(["journey_cholent"], chunk, () => {
            const tb = cloneWithColors(models.journey_cholent);
            place(tb, road, S - 2.6, 21.2, 1, 0);
            chunk.add(tb);
            const st0 = findNodes(tb, "Anchor_steam")[0];
            if (st0) steamEmitter(st0, chunk, 0.14);
        });
        return set;
    }
    if (st.id === "heshy") {
        withModels(["journey_pool", "heshyPerson", "journey_floatie"], chunk, () => {
            const pool = cloneWithColors(models.journey_pool);
            place(pool, road, S, 24, 1);
            chunk.add(pool);
            const pp = road.point(S, 24, {});
            chunk.addCollider({ x: pp.x, z: pp.z, r: 3.0, kind: "pool" });
            const tube = findNodes(pool, "Tube")[0], fl = findNodes(pool, "Flamingo")[0];
            const tb = tube ? tube.position.clone() : null, fb = fl ? fl.position.clone() : null;
            chunk.onAnimate(t => {
                if (tube) { tube.position.y = tb.y + Math.sin(t * 2.1) * 0.06; tube.rotation.y = t * 0.2; }
                if (fl) { fl.position.y = fb.y + Math.sin(t * 1.7 + 1) * 0.07; fl.rotation.y = Math.sin(t * 0.3) * 0.5; }
            });
            pool.updateMatrixWorld(true);
            const board = findNodes(pool, "Anchor_board")[0], splash = findNodes(pool, "Anchor_splash")[0];
            const A = new THREE.Vector3(), B = new THREE.Vector3();
            if (board) board.getWorldPosition(A); else A.copy(pool.position);
            if (splash) splash.getWorldPosition(B); else B.copy(pool.position);
            const ring = cloneWithColors(models.journey_floatie);
            ring.scale.setScalar(0.34);
            ring.rotation.x = Math.PI / 2;
            ring.position.y = 0.95;
            let splashed = false;
            const heshy = addPerson(chunk, "heshyPerson", A.x, A.z, toRoad, 1.05, (t, per) => {
                // the cannonball: bounce on the board, fly, SPLASH, bob in the water, wave
                if (!isFocus(i)) {
                    per.obj.position.set(A.x, 0.95 + Math.abs(Math.sin(t * 3)) * 0.12, A.z);
                    splashed = false;
                    return { wave: Math.sin(t * 0.7) > 0.2 };
                }
                const u = focus.t;
                if (u < 0.8) { per.obj.position.set(A.x, 0.95 + Math.abs(Math.sin(u * 9)) * 0.35, A.z); return { cheer: true }; }
                if (u < 1.6) {
                    const k = (u - 0.8) / 0.8;
                    per.obj.position.set(A.x + (B.x - A.x) * k, 0.95 + Math.sin(k * Math.PI) * 2.4 - k * 1.4, A.z + (B.z - A.z) * k);
                    per.obj.rotation.x = k * 0.6;
                    return { sit: true };
                }
                if (!splashed) {
                    splashed = true;
                    per.obj.rotation.x = 0;
                    if (ctx.car) {
                        ctx.car.fx.burst(B.x, 0.6, B.z, 40, 6, [0.75, 0.92, 1], 0.9, 1.2);
                        ctx.car.fx.burst(B.x, 0.5, B.z, 20, 3, [1, 1, 1], 0.6, 0.9);
                    }
                    emit("journey:splash", {});
                }
                per.obj.position.set(B.x, -0.75 + Math.sin(u * 3) * 0.06, B.z);
                return { wave: true, talk: focus.phase === "greet" };
            });
            heshy.obj.add(ring);
            set.greeter = heshy.obj;
            set.people.push(heshy);
        });
        return set;
    }
    if (st.id === "beach") {
        withModels(["journey_beach", "journey_seagull", "journey_morgan"], chunk, () => {
            const beach = cloneWithColors(models.journey_beach);
            place(beach, road, S, 22, 1);
            chunk.add(beach);
            beach.updateMatrixWorld(true);
            const ga = findNodes(beach, "Anchor_gull")[0], da = findNodes(beach, "Anchor_dina")[0];
            const gull = cloneWithColors(models.journey_seagull);
            gull.scale.setScalar(2.4);
            if (ga) ga.add(gull);
            gull.scale.setScalar(2.4);
            const wl = findNodes(gull, "Wing_L")[0], wr = findNodes(gull, "Wing_R")[0];
            chunk.onAnimate(t => {
                const flap = isFocus(i) ? Math.sin(t * 14) * 0.8 : (Math.sin(t * 0.6) > 0.7 ? Math.sin(t * 12) * 0.6 : 0.15);
                if (wl) wl.rotation.y = -flap;
                if (wr) wr.rotation.y = flap;
                gull.rotation.z = isFocus(i) ? Math.sin(t * 3) * 0.08 : 0;
                gull.position.y = isFocus(i) ? Math.abs(Math.sin(t * 4)) * 0.12 : 0;
            });
            set.greeter = gull;
            const D = new THREE.Vector3();
            if (da) da.getWorldPosition(D); else D.copy(beach.position);
            const dina = addPerson(chunk, "dinaPerson", D.x, D.z, toRoad, 1, () => isFocus(i) ? { cheer: true } : { wave: Math.sin(ctx.time * 0.8) > 0.4 });
            const morgan = cloneWithColors(models.journey_morgan);
            morgan.position.set(0, 0.62, 0.32);
            morgan.scale.setScalar(1.3);
            dina.obj.add(morgan);
            set.people.push(dina);
        });
        return set;
    }
    if (st.id === "avigail") {
        withModels(["journey_avigail_house", "avigailPerson"], chunk, () => {
            const house = cloneWithColors(models.journey_avigail_house);
            place(house, road, S, 27, 1);
            chunk.add(house);
            const hp = road.point(S, 27, {});
            chunk.addCollider({ x: hp.x, z: hp.z, r: 6.5, kind: "house" });
            house.updateMatrixWorld(true);
            const a = findNodes(house, "Anchor_greeter")[0], P = new THREE.Vector3();
            if (a) a.getWorldPosition(P); else P.copy(house.position);
            const avi = addPerson(chunk, "avigailPerson", P.x, P.z, toRoad, 1, (t, per) => {
                if (isFocus(i)) return { talk: focus.phase === "greet", wave: focus.t < 1.6 || Math.sin(t * 2) > 0.6 };
                return { wave: Math.sin(t * 0.5) > 0.8 };
            });
            set.greeter = avi.obj;
            set.people.push(avi);
            const lights = [];
            house.traverse(o => { if (o.isMesh && /Neon/.test(o.material.name)) { o.material = o.material.clone(); lights.push(o.material); } });
            chunk.onAnimate(t => { for (const m of lights) m.emissiveIntensity = 2 + env.night * 3 + Math.sin(t * 3) * 0.5; });
        });
        return set;
    }
    // Viva Vegas: the sign, Burry + Mindy + the kids, the truck — and the surprise
    withModels(STOP_MODELS[4], chunk, () => {
        const vg = cloneWithColors(models.journey_vegas);
        place(vg, road, S, 24, 1);
        chunk.add(vg);
        const vp = road.point(S + 3, 24, {});
        chunk.addCollider({ x: vp.x, z: vp.z, r: 2.0, kind: "sign" });
        vg.updateMatrixWorld(true);
        const bulbs = [];
        vg.traverse(o => { if (o.isMesh && /Neon/.test(o.material.name)) { o.material = o.material.clone(); bulbs.push(o.material); } });
        chunk.onAnimate(t => { bulbs.forEach((m, k) => { m.emissiveIntensity = 2.5 + Math.sin(t * 8 + k * 2.1) * 1.5 + env.night * 2; }); });
        const ba = findNodes(vg, "Anchor_burry")[0], va = findNodes(vg, "Anchor_van")[0];
        const B = new THREE.Vector3(), V = new THREE.Vector3();
        if (ba) ba.getWorldPosition(B); else B.copy(vg.position);
        if (va) va.getWorldPosition(V); else V.copy(vg.position);
        const truck = cloneWithColors(models.journey_burry_truck);
        truck.position.copy(V); truck.rotation.y = toRoad + Math.PI / 2;
        chunk.add(truck);
        chunk.addCollider({ x: V.x, z: V.z, r: 3.2, kind: "truck" });
        const fwd = new THREE.Vector3(Math.sin(toRoad), 0, Math.cos(toRoad));
        const right = new THREE.Vector3(Math.cos(toRoad), 0, -Math.sin(toRoad));
        const at = (base, r, f) => ({ x: base.x + right.x * r + fwd.x * f, z: base.z + right.z * r + fwd.z * f });
        const mk = (key, off, scale, mode, colors) => { const q = at(B, off[0], off[1]); const pr = addPerson(chunk, key, q.x, q.z, toRoad, scale, mode, colors); set.people.push(pr); return pr; };
        const burry = mk("journey_burry", [0, 0], 1.05, () => isFocus(4) ? { cheer: focus.t > 1.6, talk: focus.phase === "greet", wave: focus.t <= 1.6 } : { wave: Math.sin(ctx.time) > 0.5 });
        set.greeter = burry.obj;
        mk("journey_mindy", [-1.4, -0.3], 1, () => isFocus(4) ? { cheer: true } : { wave: Math.sin(ctx.time * 1.3) > 0.6 });
        mk("npcKid", [1.2, 0.5], 0.95, () => ({ cheer: isFocus(4), dance: !isFocus(4) }), { Top: "#42A5F5" });
        mk("npcKid", [-2.3, 0.6], 0.85, () => ({ cheer: isFocus(4) }), { Top: "#FFB300", Bottom: "#5D4037" });
        mk("npcKid", [2.2, 0.2], 0.8, () => ({ cheer: isFocus(4), wave: !isFocus(4) }), { Top: "#66BB6A", Hair: "#3E2723" });
        // the whole mishpacha hides behind the truck… and jumps out at the finale
        const hide = at(V, 0, -3.8);
        const crew = [["bubbe", -1.8], ["heshyPerson", -0.6], ["avigailPerson", 0.6], ["imaPerson", 1.8], ["dinaPerson", 2.8]];
        crew.forEach(([key, k], n) => {
            const out = at(B, -3.6 + n * 1.15, 1.6);
            const start = { x: hide.x + right.x * k * 0.6, z: hide.z + right.z * k * 0.6 };
            if (key === "bubbe") {
                const b = cloneWithColors(models.bubbe);
                b.scale.setScalar(1.6);
                b.rotation.y = toRoad;
                chunk.add(b);
                chunk.onAnimate(() => {
                    const u = isFocus(4) ? smooth((focus.t - 1.3 - n * 0.12) / 0.8) : 0;
                    b.position.set(start.x + (out.x - start.x) * u, u > 0 && u < 1 ? Math.abs(Math.sin(u * 12)) * 0.2 : 0, start.z + (out.z - start.z) * u);
                    b.visible = isFocus(4);
                });
                return;
            }
            const pr = addPerson(chunk, key, start.x, start.z, toRoad, key === "dinaPerson" ? 1 : 1, () => {
                const u = isFocus(4) ? smooth((focus.t - 1.3 - n * 0.12) / 0.8) : 0;
                pr.obj.position.set(start.x + (out.x - start.x) * u, 0, start.z + (out.z - start.z) * u);
                pr.obj.visible = isFocus(4);
                return u > 0 && u < 1 ? { walk: 4 } : { cheer: isFocus(4) && u >= 1 };
            });
            set.people.push(pr);
        });
    });
    return set;
}

// ── road signs for the trip (positions depend on this run's tour length) ──
function tripSigns() {
    const m = layoutMult(), out = [];
    for (let i = 0; i < N_STOPS; i++) {
        const S = stopS(i, m), L0 = legStartS(i, m), st = STOPS[i];
        const nm = st.name.replace("VIVA ", "");
        if (S - 3200 > L0 + 300) out.push({ s: S - 3200, d: 10.6, lines: [nm, "2 MI"], bg: "#1f7a46" });
        if (S - 1600 > L0 + 200) out.push({ s: S - 1600, d: 10.6, lines: [nm, "1 MI"], bg: "#1f7a46" });
        out.push({ s: S - 600, d: 10.6, lines: [nm, "EXIT NOW!"], bg: "#E91E63" });
    }
    out.push({ s: stopS(0, m) + 900, d: 10.6, lines: ["LAS VEGAS", "2,511 MI"], bg: "#1f7a46" });
    out.push({ s: legStartS(1, m) + 260, d: 10.6, lines: ["POOL TOWN", "POP. 1 HESHY"], bg: "#0288D1" });
    out.push({ s: legStartS(2, m) + 260, d: -10.6, lines: ["COAST ROAD", "GULLS AHEAD"], bg: "#0277BD" });
    out.push({ s: legStartS(3, m) + 260, d: 10.6, lines: ["BOUTIQUE ROW", "NO BUMPING"], bg: "#7B1FA2" });
    out.push({ s: legStartS(4, m) + 260, d: 10.6, lines: ["DESERT HWY", "NEXT KUGEL 80 MI"], bg: "#8D6E63" });
    const b = boundaries(m)[4];
    out.push({ s: b.s - 200, d: 10.6, lines: ["LAS VEGAS", Math.max(1, Math.round((stopS(4, m) - b.s) / 1609)) + " MI"], bg: "#1f7a46" });
    return out;
}

// ── neon text for the Strip ───────────────────────────────────────────────
const NEON = ["LUCKY 7 MOTEL", "ALL-U-CAN-EAT KUGEL", "WEDDING CHAPEL", "SLOTS SLOTS SLOTS", "BUBBE'S BUFFET", "CHEAP GAS & DICE",
    "OPEN 24/7", "ELVIS WAS HERE", "HESHY'S FOUNTAINS", "KOSHER STEAKHOUSE", "JACKPOT!", "VACANCY"];
const neonTex = new Map();
function neonTexture(text, hue) {
    const key = text + hue;
    if (neonTex.has(key)) return neonTex.get(key);
    const t = canvasTex(512, 256, (g, w, h) => {
        g.fillStyle = "#14082A"; g.fillRect(0, 0, w, h);
        g.font = `700 ${text.length > 12 ? 52 : 70}px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
        g.textAlign = "center"; g.textBaseline = "middle";
        const col = `hsl(${hue}, 100%, 62%)`;
        g.shadowColor = col; g.shadowBlur = 26;
        g.fillStyle = col;
        const words = text.split(" ");
        if (text.length > 12 && words.length > 1) {
            const mid = Math.ceil(words.length / 2);
            g.fillText(words.slice(0, mid).join(" "), w / 2, h * 0.36, w - 30);
            g.fillText(words.slice(mid).join(" "), w / 2, h * 0.68, w - 30);
        } else g.fillText(text, w / 2, h / 2, w - 30);
        g.shadowBlur = 0; g.fillStyle = "rgba(255,255,255,0.85)";
    }, false);
    neonTex.set(key, t);
    return t;
}

on("chunk:build", ({ chunk, world, rnd, s0, s1 }) => {
    const m = layoutMult();
    chunk.jMult = m;
    const road = world.road;
    // stops: gates + properties
    for (let i = 0; i < N_STOPS; i++) {
        const S = stopS(i, m), G = S - GATE_BACK;
        if (G >= s0 && G < s1) buildGate(i, G, chunk, world);
        if (S >= s0 && S < s1) { try { buildProperty(i, S, chunk, world); } catch (e) { console.error("[journey stop]", e); } }
    }
    for (const sg of tripSigns()) if (sg.s >= s0 && sg.s < s1) chunk.sign(world, sg);

    const mid = (s0 + s1) / 2, reg = regionAt(mid, m).key;
    // the coast: wet sand, foam and the ocean on the right
    const [c0, c1] = coastRange();
    if (s1 > c0 && s0 < c1) {
        const a = Math.max(s0, c0), b = Math.min(s1, c1);
        const MM = mats();
        chunk.addMesh(band(road, a, b, s => shoreAt(s) - 4.5, s => shoreAt(s), 0.011, 10), MM.wet);
        const foam = chunk.addMesh(band(road, a, b, s => shoreAt(s) - 1.0, s => shoreAt(s) + 1.2, 0.016, 10), MM.foam);
        foam.renderOrder = 1;
        chunk.addMesh(band(road, a, b, s => shoreAt(s), s => shoreAt(s) + 340, 0.013, 40), MM.water);
        const ph = rnd() * 6;
        chunk.onAnimate(t => {
            MM.water.map.offset.y = -t * 0.03;
            MM.foam.opacity = 0.45 + Math.sin(t * 1.3 + ph) * 0.25;
        });
        // umbrellas dotted along the beach
        if (models.journey_umbrella && reg === "coast") {
            const n = 2 + Math.floor(rnd() * 4), list = [];
            for (let k = 0; k < n; k++) {
                const s = s0 + rnd() * (s1 - s0), sh = shoreAt(s);
                if (sh > 80 || Math.abs(s - stopS(2, m)) < 90) continue;
                const d = 13 + rnd() * Math.max(2, sh - 20);
                const p = road.point(s, d, {});
                list.push({ x: p.x, z: p.z, r: rnd() * 6.28, c: ["#EF5350", "#42A5F5", "#FFCA28", "#AB47BC", "#26A69A"][Math.floor(rnd() * 5)] });
            }
            if (list.length) {
                const inst = instanced(models.journey_umbrella, list.length, ["UmbColor", "Towel"]);
                const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
                list.forEach((u, k) => {
                    q.setFromAxisAngle(up, u.r); mtx.compose(v.set(u.x, 0, u.z), q, sc);
                    inst.set(k, mtx); inst.color(k, "UmbColor", col.set(u.c)); inst.color(k, "Towel", col.set(u.c).offsetHSL(0.3, 0, 0.1));
                });
                inst.finish();
                chunk.add(inst.group); chunk.own(inst);
            }
        }
    }
    // pool town: backyard pools behind the houses
    if (reg === "pool" && chunk.houses && chunk.houses.length) {
        const MM = mats();
        for (const hh of chunk.houses) {
            const bx = -8.6 * Math.sin(hh.rot), bz = -8.6 * Math.cos(hh.rot);
            const cop = new THREE.Mesh(MM.poolGeo, MM.coping);
            cop.position.set(hh.x + bx, 0.11, hh.z + bz); cop.rotation.y = hh.rot; cop.receiveShadow = true;
            const wat = new THREE.Mesh(MM.poolWaterGeo, MM.poolWater);
            wat.position.set(hh.x + bx, 0.23, hh.z + bz); wat.rotation.y = hh.rot;
            chunk.add(cop); chunk.add(wat);
        }
    }
    // dusk boutique row + the Strip: street lamps both sides
    if ((reg === "dusk" || reg === "strip") && models.journey_streetlamp) {
        const spots = [];
        for (let s = Math.ceil(s0 / 40) * 40; s < s1; s += 40) for (const side of [-1, 1]) {
            if (world.isReserved(s, side * 10.2, 3)) continue;
            spots.push({ s, side });
        }
        if (spots.length) {
            const inst = instanced(models.journey_streetlamp, spots.length, []);
            const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
            const glows = [];
            spots.forEach((sp, k) => {
                const p = road.point(sp.s, sp.side * 10.2, {});
                q.setFromAxisAngle(up, facingRoad(road.at(sp.s).h, sp.side));
                mtx.compose(v.set(p.x, 0, p.z), q, sc);
                inst.set(k, mtx);
                chunk.addCollider({ x: p.x, z: p.z, r: 0.22, kind: "pole" });
                const gp = road.point(sp.s, sp.side * 8.6, {});
                glows.push(gp);
            });
            inst.finish();
            chunk.add(inst.group); chunk.own(inst);
            // a soft pool of light under each lamp (visible at dusk / night)
            const MM = mats();
            const gm = new THREE.InstancedMesh(chunk.own(new THREE.PlaneGeometry(7, 7).rotateX(-Math.PI / 2)), MM.glow, glows.length);
            glows.forEach((gp, k) => { mtx.compose(v.set(gp.x, 0.05, gp.z), q.identity(), sc); gm.setMatrixAt(k, mtx); });
            gm.computeBoundingSphere();
            gm.renderOrder = 1;
            chunk.add(gm); chunk.own(gm);
            chunk.onAnimate(() => { gm.visible = env.night > 0.15; });
        }
    }
    // the Strip: neon signs (and casino towers on the skyline)
    if (reg === "strip" && models.journey_neon_sign) {
        const n = 1 + Math.floor(rnd() * 2);
        for (let k = 0; k < n; k++) {
            const s = s0 + 30 + rnd() * (s1 - s0 - 60), side = rnd() < 0.5 ? -1 : 1, d = side * (15 + rnd() * 4);
            if (world.isReserved(s, d, 10)) continue;
            const sign = cloneWithColors(models.journey_neon_sign);
            place(sign, road, s, d, side);
            const face = findNodes(sign, "Anchor_face")[0];
            const text = NEON[Math.floor(rnd() * NEON.length)], hue = [320, 185, 50, 280, 140][Math.floor(rnd() * 5)];
            const mat = new THREE.MeshBasicMaterial({ map: neonTexture(text, hue), toneMapped: false });
            const plane = new THREE.Mesh(chunk.own(new THREE.PlaneGeometry(6.1, 3.0)), mat);
            chunk.own(mat);
            plane.position.z = 0.02;
            if (face) face.add(plane); else { plane.position.set(0, 6.6, 0.3); sign.add(plane); }
            chunk.add(sign);
            const p = road.point(s, d, {});
            chunk.addCollider({ x: p.x, z: p.z, r: 0.35, kind: "pole" });
            const blink = rnd() < 0.35, ph = rnd() * 6;
            chunk.onAnimate(t => { mat.color.setScalar(blink && Math.sin(t * 9 + ph) > 0.6 ? 0.35 : 1); });
        }
        if (models.journey_casino && rnd() < 0.7) {
            const side = rnd() < 0.5 ? -1 : 1, s = s0 + rnd() * (s1 - s0);
            const tower = cloneWithColors(models.journey_casino, { Walls: ["#311B92", "#4A148C", "#1A237E", "#880E4F"][Math.floor(rnd() * 4)] });
            place(tower, road, s, side * (110 + rnd() * 80), side);
            tower.scale.set(2.2, 2.4 + rnd() * 1.6, 2.2);
            chunk.add(tower);
        }
    }
    // the desert (and the Strip): mesas on the horizon
    if ((reg === "desert" || reg === "strip") && models.journey_mesa && rnd() < (reg === "desert" ? 0.85 : 0.4)) {
        const side = rnd() < 0.5 ? -1 : 1, s = s0 + rnd() * (s1 - s0);
        const mesa = cloneWithColors(models.journey_mesa);
        place(mesa, road, s, side * (150 + rnd() * 140), side, rnd() * 6.28);
        mesa.scale.setScalar(0.7 + rnd() * 1.0);
        mesa.traverse(o => { if (o.isMesh) { o.castShadow = false; } });
        chunk.add(mesa);
    }
});

/** Any live chunk built for a different tour length gets rebuilt (story ↔ cruise, tour 1 ↔ tour 2). */
export function rebuildStaleChunks() {
    const w = ctx.world, m = layoutMult();
    let stale = false;
    for (const c of w.chunks.values()) if (c.jMult !== m) { stale = true; break; }
    if (!stale) return false;
    for (const [k, c] of w.chunks) { c.dispose(w.scene); w.chunks.delete(k); }
    reserveMult = -1;
    syncReserves();
    w.prebuild(ctx.car.s);
    w.resetCoins();
    return true;
}

// keep the environment ticking: driving states via hooks.update, menus via titleCamera
hook("update", dt => envTick(dt), 5);
hook("titleCamera", dt => { envTick(dt); return false; }, 100);
on("state", ({ to }) => { if (to === "title") { lastRegionKey = ""; } });
