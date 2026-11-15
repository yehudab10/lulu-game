// features/atmos/common.js — the shared atmosphere state (S), quality scaling,
// small math helpers and the canvas textures every atmos module draws with.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { canvasTex } from "../../world.js";
import * as H from "../../hud.js";

/** Everything the atmos modules share for this frame. */
export const S = {
    active: false,     // drawing atmosphere this frame (enabled, a run world on screen)
    mode: "off",       // "cruise" (day cycle + weather) | "base" (story etc.: night touches only) | "off"
    dt: 0,             // this tick's step (0 while paused)
    time: 0,           // atmos animation clock (seconds; frozen while paused)
    clock: 0.03,       // time of day 0..1 (cruise): 0 morning · .18 noon · .41 golden · .48 sunset · .6–.83 night · .9 dawn
    w: 0,              // how strongly the day cycle overrides the journey's per-leg palette
    todNight: 0,       // the day cycle's own darkness
    baseNight: 0,      // the journey leg's darkness (the Vegas Strip is night)
    night: 0,          // combined darkness 0..1 (drives lamps, windows, stars)
    lightsOn: 0,       // car headlights 0..1 (night, rain, fog)
    day: 1,            // the sun is up 0..1
    rain: 0, snow: 0, fog: 0,          // current weather amounts (eased)
    wet: 0,            // the road is wet (lags the rain)
    snowCover: 0,      // snow on the grass
    cloud: 0.3,        // cloud cover 0..1
    flash: 0,          // lightning flash 0..1
    rainbow: 0,        // rainbow visibility 0..1
    sunDir: new THREE.Vector3(0, 1, 0),   // the sun's direction (may be below the horizon)
    moonDir: new THREE.Vector3(0, 1, 0),
    lightDir: new THREE.Vector3(0, 1, 0), // where the key light comes from (sun by day, moon by night)
    sunCol: new THREE.Color("#fff1dc"),
    wind: new THREE.Vector3(1.2, 0, 0.4),
    camPos: new THREE.Vector3(),
    fp: false,         // "Lulu's eyes" camera
    biome: "",         // biome name under the car
    q: 1,              // quality multiplier for particle counts (1 high · .6 medium · .3 low)
    quality: "high",
};

export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
/** Move v toward target by at most rate*dt. */
export const approach = (v, target, rate, dt) => v < target ? Math.min(target, v + rate * dt) : Math.max(target, v - rate * dt);
export const DEG = Math.PI / 180;

/** Direction from azimuth (deg, 0 = +Z (down the road), 90 = +X) and elevation (deg). */
export function dirFrom(azDeg, elDeg, out) {
    const a = azDeg * DEG, e = elDeg * DEG;
    return out.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/** The resolved quality setting (mirrors app.js applySettings). */
const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
export function quality() {
    const q = save3d.settings && save3d.settings.quality;
    if (q && q !== "auto") return q;
    const p = ctx.platform || {};
    return p.console || p.tv ? "low" : coarse ? "medium" : "high";
}
export const QMUL = { high: 1, medium: 0.6, low: 0.3 };

// ── canvas textures (made once, on first use) ────────────────────────────
const TEX = {};
function once(key, make) { return TEX[key] || (TEX[key] = make()); }

/** Soft round glow (white; tint it in the shader / material). */
export const glowTex = () => once("glow", () => canvasTex(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grd.addColorStop(0.6, "rgba(255,255,255,0.12)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
}, false));

/** The moon: a pale disc with soft craters (alpha = the disc). */
export const moonTex = () => once("moon", () => canvasTex(128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const grd = g.createRadialGradient(w * 0.42, h * 0.4, 4, w / 2, h / 2, w * 0.48);
    grd.addColorStop(0, "#fffdf2"); grd.addColorStop(0.75, "#f1ecd6"); grd.addColorStop(1, "#d9d2b8");
    g.fillStyle = grd;
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.47, 0, 7); g.fill();
    const craters = [[0.36, 0.34, 0.09], [0.6, 0.3, 0.06], [0.62, 0.6, 0.12], [0.38, 0.66, 0.07], [0.52, 0.47, 0.05], [0.28, 0.5, 0.04], [0.7, 0.45, 0.04]];
    for (const [x, y, r] of craters) {
        g.fillStyle = "rgba(150,140,115,0.28)";
        g.beginPath(); g.arc(x * w, y * h, r * w, 0, 7); g.fill();
        g.fillStyle = "rgba(255,255,245,0.25)";
        g.beginPath(); g.arc(x * w - r * w * 0.25, y * h - r * h * 0.25, r * w * 0.55, 0, 7); g.fill();
    }
}, false));

/** An autumn leaf silhouette (white; per-instance colour tints it). */
export const leafTex = () => once("leaf", () => canvasTex(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    g.beginPath();
    // a little maple-ish leaf: 5 lobes around (32, 34)
    const lobes = [[32, 4], [52, 18], [58, 36], [44, 50], [32, 56], [20, 50], [6, 36], [12, 18]];
    g.moveTo(32, 60);
    for (const [x, y] of lobes) g.quadraticCurveTo((x + 32) / 2 + (x - 32) * 0.35, (y + 34) / 2 + (y - 34) * 0.35, x, y);
    g.closePath(); g.fill();
    g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(32, 60); g.lineTo(32, 12); g.moveTo(32, 36); g.lineTo(50, 22); g.moveTo(32, 36); g.lineTo(14, 22); g.stroke();
}, false));

// ── reusable scratch objects (no per-frame allocations) ──────────────────
export const V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
export const C1 = new THREE.Color(), C2 = new THREE.Color();
export const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
export const P0 = {}, P1 = {};

/** A small, rate-limited toast while driving / walking (never a big centred pop-up). */
let lastSay = -99;
export const said = [];   // (tests read the log)
export function say(text, cls = "", gap = 14) {
    if (ctx.skipping || ctx.paused || (ctx.state !== "playing" && ctx.state !== "footRun")) return false;
    if (ctx.time - lastSay < gap) return false;
    lastSay = ctx.time;
    said.push(text);
    if (said.length > 20) said.shift();
    H.toast(text, cls);
    return true;
}

/** Is a run world on screen right now (not a menu-only scene or an interior set)? */
export function worldVisible() {
    if (!ctx.world || ctx.view) return false;
    const def = ctx.states[ctx.state];
    return !!def && def.world !== false;
}
