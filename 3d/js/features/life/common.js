// features/life — shared state + small helpers (no three.js objects here).
import { ctx } from "../../core/ctx.js";
import { store, save3d } from "../../core/save.js";

/** Saved: `sounds` (⚙️ 🐦 Street sounds — footsteps + the neighbourhood). Visual details have no switch: they're quiet. */
export const SAVE = store("life", { sounds: true });

/** Live state shared by the parts (written by index.js once a frame). */
export const L = {
    on: false,          // the world is on screen and this is a place we dress (a run in the world, not Dina, not a set)
    foot: false,        // she's walking (ctx.foot.active and in footRun)
    town: false,        // in a town (ctx.town.active)
    townId: "",
    x: 0, z: 0,         // the focus: Lulu on foot, else her car
    speed: 0,           // m/s (her walking speed, or the car's)
    dt: 0, time: 0,
    night: 0, wet: 0, rain: 0, weather: "clear", snow: false,
    season: "",         // "autumn" | "spring" | "summer" | "winter" (the device's date, or a test's pin)
    biome: "",
    quiet: false,       // skipping / paused / a dialog: keep sounds down
};

export const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
export const rand = (a, b) => a + Math.random() * (b - a);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic 0..1 from a few integers (the same puddles / leaf piles for everyone, every visit). */
export function hash01(a, b = 0, c = 0) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
/** A string → int (town ids into the hash). */
export function strHash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = Math.imul(h, 31) + s.charCodeAt(i) | 0; return h; }

/** The season from the device's date (northern hemisphere: Lakewood + Midwood). `pin` = a test's override. */
let pin = null;
export function setSeasonPin(s) { pin = s || null; }
export function seasonNow() {
    if (pin) return pin;
    try {
        const q = new URLSearchParams(location.search).get("lifeSeason");
        if (q) return q;
    } catch (e) { /* no location */ }
    const d = new Date(), m = d.getMonth() + 1, day = d.getDate(), md = m * 100 + day;
    if (md >= 920 && md <= 1212) return "autumn";       // the leaves come down (Sukkos → Chanukah-ish)
    if (md >= 325 && md <= 515) return "spring";        // blossom petals
    if (md >= 516 && md < 920) return "summer";
    return "winter";
}

/** The player's chatter setting (Quiet = Lulu keeps her one-liners to herself). */
export const chatter = () => (save3d.settings && save3d.settings.chatter) || "normal";
export const soundsOn = () => SAVE.sounds !== false;

/** Lulu says one short line in her speech bubble on foot (never a toast — no pop-ups). Rate-limited by the caller. */
export function footLine(text, sec = 2.4) {
    if (!text || chatter() === "quiet" || ctx.skipping) return false;
    try { if (ctx.foot && ctx.foot.active && ctx.foot.say && ctx.foot.obj) return !!ctx.foot.say(ctx.foot.obj, text, sec); } catch (e) { /* no foot */ }
    return false;
}

/** Counters for tests / the perf report. */
export const stats = { ms: 0, maxMs: 0, ticks: 0, steps: 0, stepKinds: {}, splashes: 0, carSplashes: 0, soaked: 0, sounds: 0, soundKinds: {}, gusts: 0, flyers: 0, read: 0, piles: 0, kicked: 0 };
export function countSound(kind) { stats.sounds++; stats.soundKinds[kind] = (stats.soundKinds[kind] || 0) + 1; }

// ── round 2 ──────────────────────────────────────────────────────────────
/** One budget for every line the round-2 details say (Lulu's, a neighbour's): ≤ 1 per LINE.gap s between them, so the
 *  calm screen stays calm (the `calm` test counts speech bubbles too). */
export const LINE = { gap: 40, at: -1e9, said: 0 };
export function lineFree(gap = LINE.gap) { return L.time - LINE.at >= gap && !ctx.skipping && chatter() !== "quiet"; }
function used() { LINE.at = L.time; LINE.said++; }
/** A neighbour / townsperson line: a speech bubble over `anchor` (an Object3D) — never a toast. */
export function npcLine(text, anchor, opts = {}) {
    if (!text || !anchor || !lineFree()) return false;
    let ok = false;
    try {
        if (ctx.foot && ctx.foot.active && ctx.foot.say) ok = !!ctx.foot.say(anchor, text, opts.dur || 2.4);
        else if (ctx.banter && ctx.banter.bubble) ok = !!ctx.banter.bubble(text, anchor, Object.assign({ dur: 2.4 }, opts));
    } catch (e) { ok = false; }
    if (ok) used();
    return ok;
}
/** Lulu's own line (on foot), through the same budget. */
export function luluLine(text, sec = 2.4) {
    if (!lineFree() || !footLine(text, sec)) return false;
    used();
    return true;
}
/** A cold day: snow, winter, or late autumn / early spring by the device's date (`?lifeCold=1|0`, or a test's pin). */
let coldPin = null;
export function setColdPin(v) { coldPin = v == null ? null : !!v; }
export function coldNow() {
    if (coldPin != null) return coldPin;
    try { const q = new URLSearchParams(location.search).get("lifeCold"); if (q === "1" || q === "0") return q === "1"; } catch (e) { /* no location */ }
    if (L.snow || L.season === "winter") return true;
    const m = new Date().getMonth();          // Nov (10) … Mar (2)
    return m >= 10 || m <= 2;
}
/** A model-local point (lx along the model's +X, lz out of its front) → the world, for a house from ctx.town.homes
 *  ({x, z, ux, uz, nx, nz}: the model's +X is −u, its front is n — features/homes' DOORS maths). */
export function homeWorld(h, lx, lz, out) { out.x = h.x - h.ux * lx + h.nx * lz; out.z = h.z - h.uz * lx + h.nz * lz; return out; }
