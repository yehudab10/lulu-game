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
