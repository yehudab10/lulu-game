// The graphics tiers — ⚙️ Settings → 🖼️ Graphics: AUTO / HIGH / MEDIUM / LOW (save3d.settings.quality).
//
//   LOW     no real shadows (soft blob shadows under the cars instead), chunks drawn to 65 % of the
//           fog distance (the fog comes in to match), far-LOD cars from 40 m, a third of the
//           particles, no headlight spot light, no wind sway, no post FX, pixel ratio 1.
//   MEDIUM  a 1024 shadow map over a tighter box, 85 % draw distance, LOD from 55 m, 60 % particles,
//           the headlight spot, wind sway; no post FX; pixel ratio ≤ 1.5 (≤ 2 on a phone).
//   HIGH    everything: a 2048 shadow map, full draw distance, LOD from 70 m, all the particles,
//           wind sway, the bloom on lights / neon / nitro; pixel ratio ≤ 2.
//   AUTO    picks a tier from the GPU (software renderers, integrated GPUs, phones, consoles / TVs)
//           and then watches the frame rate: the resolution slides between the tier's floor and
//           cap to hold 60 fps, and when the floor still can't, it steps down a tier (for this
//           session). A display capped at 30 fps (iOS Low Power Mode) is not mistaken for a slow GPU.
//
// ctx.gfx = { setting, tier, T (the tier's numbers), pixelRatio, gpu, reason, info() }. Features read
// ctx.gfx.tier (atmos particles, interiors' optional lights…) instead of the raw setting.
import { ctx, emit } from "./ctx.js";
import { save3d } from "./save.js";

export const TIERS = {
    low: { pr: 1, prMin: 0.6, shadows: false, shadowSize: 0, shadowBox: 0, draw: 0.65, lod: 40, particles: 0.3, spot: false, sway: false, post: false, blob: 0.55 },
    medium: { pr: 1.5, prMin: 0.7, shadows: true, shadowSize: 1024, shadowBox: 38, draw: 0.85, lod: 55, particles: 0.6, spot: true, sway: true, post: false, blob: 0.3 },
    high: { pr: 2, prMin: 0.8, shadows: true, shadowSize: 2048, shadowBox: 46, draw: 1, lod: 70, particles: 1, spot: true, sway: true, post: true, blob: 0.3 },
};
const ORDER = ["low", "medium", "high"];

const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const phone = coarse && Math.min(screen.width || 9999, screen.height || 9999) <= 900;

export const gfx = {
    setting: "auto",
    tier: "high",
    T: TIERS.high,
    pixelRatio: 1,
    prCap: 1,
    gpu: "",
    reason: "",
    demoted: null,          // AUTO stepped down from this tier this session
    capped30: false,
    info() { return { setting: this.setting, tier: this.tier, pixelRatio: +this.pixelRatio.toFixed(2), prCap: this.prCap, gpu: this.gpu, reason: this.reason, demoted: this.demoted, capped30: this.capped30, fps: +A.fps.toFixed(1) }; },
};
ctx.gfx = gfx;

/** The GPU's name (WEBGL_debug_renderer_info where the browser still gives it). */
export function gpuName(renderer) {
    try {
        const gl = renderer.getContext();
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || "";
    } catch (e) { return ""; }
}

/** AUTO's first guess: { tier, reason }. */
export function guessTier(gpu, platform = {}) {
    if (platform.console || platform.tv) return { tier: "low", reason: "console / TV" };
    // (?test runs in software WebGL on purpose: they keep the desktop's tier, so every feature test sees the whole game)
    if (ctx.TEST) gpu = "";
    if (/SwiftShader|llvmpipe|Software|Microsoft Basic Render/i.test(gpu)) return { tier: "low", reason: "software renderer" };
    if (/Mali-[GT]?[1-7]\d\b|Adreno \(TM\) [1-5]\d\d|PowerVR|Intel\(R\) (HD|UHD) Graphics [1-5]\d\d\b|GMA/i.test(gpu)) return { tier: "low", reason: "older GPU" };
    if (coarse) return { tier: "medium", reason: phone ? "phone" : "tablet / touch" };
    if (/Intel|Iris|UHD|HD Graphics|Mali|Adreno/i.test(gpu)) return { tier: "medium", reason: "integrated GPU" };
    return { tier: "high", reason: gpu ? "desktop GPU" : "desktop" };
}

/** Resolve the setting (+ AUTO's guess / demotion) into gfx.tier / gfx.T and the pixel-ratio range. */
export function resolveTier(renderer, platform) {
    const S = save3d.settings;
    gfx.setting = S.quality || "auto";
    if (!gfx.gpu) gfx.gpu = gpuName(renderer);
    let tier;
    if (gfx.setting !== "auto" && TIERS[gfx.setting]) { tier = gfx.setting; gfx.reason = "chosen"; gfx.demoted = null; }
    else {
        const g = guessTier(gfx.gpu, platform);
        tier = g.tier; gfx.reason = g.reason;
        if (gfx.demoted && ORDER.indexOf(gfx.demoted) < ORDER.indexOf(tier)) { tier = gfx.demoted; gfx.reason += " · stepped down (frame rate)"; }
    }
    gfx.tier = tier;
    gfx.T = TIERS[tier];
    const dpr = window.devicePixelRatio || 1;
    // a phone's small screen keeps its sharpness (≤ 2: the pixel count is still a laptop's); low stays at 1
    const cap = tier === "low" ? 1 : phone ? 2 : gfx.T.pr;
    gfx.prCap = Math.min(dpr, cap);
    if (gfx.setting !== "auto" || !gfx.pixelRatio || gfx.pixelRatio > gfx.prCap || gfx.pixelRatio < gfx.T.prMin) gfx.pixelRatio = gfx.prCap;
    return gfx;
}

// ── AUTO: hold 60 fps (resolution first, then the tier) ──────────────────
const A = { t: 0, n: 0, sum: 0, near30: 0, slow: 0, fast: 0, low: 0, ceiling: 9, ceilT: 0, fps: 60, cool: 0 };
/**
 * Called once a frame (app.js) with the wall-clock interval and the JS work of that frame (ms).
 * Returns "res" when the pixel ratio changed, "tier" when AUTO stepped down a tier, else null.
 */
export function adaptFrame(intervalMs, workMs) {
    if (gfx.setting !== "auto") return null;
    if (!(intervalMs > 0) || intervalMs > 120) return null;          // a hitch (loading, a tab switch): not a trend
    A.t += intervalMs; A.n++; A.sum += workMs || 0;
    if (intervalMs > 31.5 && intervalMs < 35.5) A.near30++;
    A.ceilT = Math.max(0, A.ceilT - intervalMs / 1000);
    if (A.ceilT <= 0) A.ceiling = 9;
    if (A.cool > 0) A.cool -= intervalMs / 1000;
    if (A.t < 1000) return null;
    const avg = A.t / A.n, work = A.sum / A.n, near30 = A.near30 / A.n;
    A.fps = 1000 / avg;
    A.t = 0; A.n = 0; A.sum = 0; A.near30 = 0;
    // a display / power mode that caps rAF at 30: steady 33 ms with little work per frame → leave it be
    gfx.capped30 = near30 > 0.85 && work < 9;
    if (gfx.capped30 || A.cool > 0) return null;
    const step = 0.1, floor = gfx.T.prMin, cap = Math.min(gfx.prCap, A.ceiling);
    if (avg > 19) { A.slow++; A.fast = 0; } else if (avg < 17.6) { A.fast++; A.slow = 0; } else { A.slow = 0; A.fast = 0; }
    if (A.slow >= 2) {
        A.slow = 0;
        if (gfx.pixelRatio > floor + 0.01) {
            A.ceiling = gfx.pixelRatio - step; A.ceilT = 60;            // don't climb straight back up for a minute
            gfx.pixelRatio = Math.max(floor, gfx.pixelRatio - (avg > 28 ? 2 * step : step));
            A.cool = 1.5;
            return "res";
        }
        // at the floor and still slow → one tier down (this session)
        if (avg > 22 && ++A.low >= 3 && gfx.tier !== "low") {
            A.low = 0;
            gfx.demoted = ORDER[ORDER.indexOf(gfx.tier) - 1];
            gfx.pixelRatio = 0;      // (resolveTier picks the new tier's cap)
            A.cool = 3;
            emit("gfx", { tier: gfx.demoted, why: "frame rate" });
            return "tier";
        }
    } else if (A.fast >= 4 && gfx.pixelRatio < cap - 0.01) {
        A.fast = 0; A.low = 0;
        gfx.pixelRatio = Math.min(cap, gfx.pixelRatio + step);
        A.cool = 2;
        return "res";
    }
    return null;
}
export function adaptReset() { Object.assign(A, { t: 0, n: 0, sum: 0, near30: 0, slow: 0, fast: 0, low: 0, cool: 1 }); }
