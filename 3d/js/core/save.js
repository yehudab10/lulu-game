// Saves.
//
//  • `save3d` (localStorage "lulu3dSave") holds 3D-only progress and settings.
//    Each feature keeps its data in its own namespace: store("journey", {...}).
//  • The 2D game's save (localStorage "luluSaveV2") is SHARED for the things
//    that should carry across both versions: the coin wallet, owned/selected car
//    skins, items, horns/decorations, hair, Avigail friendship, lifetime stats…
//    Use shared.get() to read it and shared.update(fn) to change it. Every write
//    is a fresh read-modify-write, so a 2D tab open at the same time keeps its
//    other fields. The 2D game fills any missing keys with its defaults on load,
//    so writing a partial object is safe.
import { emit } from "./ctx.js";

const KEY3D = "lulu3dSave";
const KEY2D = "luluSaveV2";

function readJSON(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const o = JSON.parse(raw);
        return o && typeof o === "object" && !Array.isArray(o) ? o : null;
    } catch (e) { return null; }
}
function writeJSON(key, obj) {
    try { localStorage.setItem(key, JSON.stringify(obj)); return true; } catch (e) { return false; }
}

// ── 3D save ───────────────────────────────────────────────────────────────
export const save3d = Object.assign({
    best: 0, bestTime: 0, arrivals: 0, cam: 0, music: true, sound: true,
    settings: { quality: "auto", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "auto", hud: 1 },
    f: {},            // per-feature namespaces (see store())
}, readJSON(KEY3D) || {});
save3d.settings = Object.assign({ quality: "auto", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "auto", hud: 1 }, save3d.settings || {});
save3d.f = save3d.f || {};

let dirty = false;
export function saveNow() { dirty = false; writeJSON(KEY3D, save3d); }
/** Coalesce frequent writes (called every frame is fine). */
export function saveSoon() { dirty = true; }
setInterval(() => { if (dirty) saveNow(); }, 1000);

/** A feature's private save namespace, created with defaults on first use. */
export function store(id, defaults = {}) {
    const cur = save3d.f[id] || {};
    for (const k of Object.keys(defaults)) if (!(k in cur)) cur[k] = structuredClone(defaults[k]);
    save3d.f[id] = cur;
    return cur;
}

// ── the shared 2D save ────────────────────────────────────────────────────
export const shared = {
    /** A fresh copy of the 2D save (or {} if there is none yet). Don't hold on to it. */
    get() { return readJSON(KEY2D) || {}; },
    /** Read-modify-write: fn(save2d) mutates it; returns the written object. */
    update(fn) {
        const s = readJSON(KEY2D) || {};
        fn(s);
        if (typeof s.totalCoins === "number" && s.totalCoins < 0) s.totalCoins = 0;
        writeJSON(KEY2D, s);
        emit("shared:changed", s);
        return s;
    },
    /** Lifetime stat counter shared with the 2D scrapbook (save.stats[id] += n). */
    stat(id, n = 1) {
        pendingStats[id] = (pendingStats[id] || 0) + n;
        scheduleFlush();
    },
    /** All-time best shared with the 2D scrapbook (save.stats.best[id] = max). */
    best(id, v) {
        pendingBest[id] = Math.max(pendingBest[id] || 0, v);
        scheduleFlush();
    },
};

// ── the wallet (= the 2D game's totalCoins) ──────────────────────────────
let pendingCoins = 0;
const pendingStats = {};
const pendingBest = {};
let flushTimer = 0;
function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(flushShared, 800);
}
export function flushShared() {
    clearTimeout(flushTimer);
    flushTimer = 0;
    const statKeys = Object.keys(pendingStats), bestKeys = Object.keys(pendingBest);
    if (!pendingCoins && !statKeys.length && !bestKeys.length) return;
    const delta = pendingCoins;
    pendingCoins = 0;
    shared.update(s => {
        s.totalCoins = Math.max(0, (s.totalCoins || 0) + delta);
        if (statKeys.length || bestKeys.length) {
            s.stats = s.stats || {};
            for (const k of statKeys) { s.stats[k] = (s.stats[k] || 0) + pendingStats[k]; delete pendingStats[k]; }
            if (bestKeys.length) {
                s.stats.best = s.stats.best || {};
                for (const k of bestKeys) { s.stats.best[k] = Math.max(s.stats.best[k] || 0, pendingBest[k]); delete pendingBest[k]; }
            }
        }
    });
}

export const wallet = {
    /** Current balance (shared with the 2D game), including not-yet-written coins. */
    get coins() { return Math.max(0, (shared.get().totalCoins || 0) + pendingCoins); },
    /** Add (or remove, with a negative n) coins. Batched; flushed within a second. */
    add(n) {
        if (!n) return;
        pendingCoins += n;
        scheduleFlush();
        emit("wallet", { delta: n });
    },
    /** Spend if affordable. Returns true on success. Writes immediately. */
    spend(n) {
        flushShared();
        let ok = false;
        shared.update(s => {
            const have = s.totalCoins || 0;
            if (have >= n) { s.totalCoins = have - n; ok = true; }
        });
        if (ok) emit("wallet", { delta: -n });
        return ok;
    },
};

window.addEventListener("pagehide", () => { flushShared(); saveNow(); });
document.addEventListener("visibilitychange", () => { if (document.hidden) { flushShared(); saveNow(); } });
