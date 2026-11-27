// Loads the Blender-made .glb models (3d/assets, built by 3d/blender/make_assets.py)
// and turns them into ready-to-use templates: shadows on, glass made see-through,
// per-car recolouring, wheel lookup, and cheap instancing for scenery.
//
// Features register their own models:
//     registerModels({ heshyPool: "heshy_pool", heshy: "heshy" });             // lazy
//     registerModels({ palm: "palm_tree" }, { preload: true });                // loaded at boot
//     await ensureModels(["heshyPool", "heshy"]);  models.heshyPool …
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ctx, on } from "./core/ctx.js";

const FILES = {};
const PRELOAD = new Set();

// The core set — always loaded at boot.
registerModels({
    lulu: "lulu_car", sedan: "sedan", cop: "cop_car", van: "van", truck: "truck",
    treeRound: "tree_round", treePine: "tree_pine", bush: "bush", house: "house",
    luluPerson: "lulu_person", dinaPerson: "dina_person",
}, { preload: true });
// The recurring cast + townsfolk (lazy: await ensureModels([...]) before spawning).
registerModels({
    npcWoman: "npc_woman", npcMan: "npc_man", npcKid: "npc_kid",
    avigailPerson: "avigail_person", heshyPerson: "heshy_person", imaPerson: "ima_person",
    copPerson: "cop_person", hillelPerson: "hillel_person",
});
// Used by the journey's first stop.
registerModels({ bubbeHouse: "bubbe_house", bubbe: "bubbe" }, { preload: true });

export const models = {};
const pending = new Map();
const loader = new GLTFLoader();

/** Map model keys → asset file names (without .glb). */
export function registerModels(map, { preload = false } = {}) {
    for (const [k, f] of Object.entries(map)) {
        FILES[k] = f;
        if (preload) PRELOAD.add(k);
    }
}

/** Every registered model key → its asset path (tests: the iOS bundle must hold them all). */
export function modelFiles() { return Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, `assets/${f}.glb`])); }

function loadOne(key, pri = null) {
    learn(key);
    if (models[key]) return Promise.resolve(models[key]);
    if (pending.has(key)) { if (!preRun()) bump(key); else if (pri === "first") promote(key); return pending.get(key); }
    const file = FILES[key];
    if (!file) return Promise.reject(new Error(`unknown model "${key}" (registerModels first)`));
    const p = download(key, `assets/${file}.glb`, pri).then(gltf => {
        models[key] = prepare(gltf.scene);
        pending.delete(key);
        warmShaders(models[key]);
        return models[key];
    });
    pending.set(key, p);
    return p;
}

/** three's renderer.compileAsync compiles, then polls every material's program from a setTimeout until it's ready —
 *  and a material DISPOSED meanwhile (a set torn down, a stranger's car leaving) has no program any more: the poll threw
 *  "reading 'isReady'" as an uncaught page error (no .catch can reach a timer). Same work, same promise; a material
 *  whose program is gone simply counts as done. Installed once on the renderer, so every caller gets it (this file's
 *  warmShaders, party's warm-up). */
export function safeCompileAsync(r) {
    if (!r || r.__safeCompileAsync || typeof r.compile !== "function" || !r.properties) return;
    r.__safeCompileAsync = true;
    r.compileAsync = function (scene, camera, targetScene = null) {
        const mats = this.compile(scene, camera, targetScene);
        return new Promise(resolve => {
            const poll = () => {
                for (const m of mats) {
                    let p = null;
                    try { p = this.properties.get(m).currentProgram; } catch (e) { p = null; }
                    if (!p || typeof p.isReady !== "function" || p.isReady()) mats.delete(m);
                }
                if (mats.size) setTimeout(poll, 10); else resolve(scene);
            };
            setTimeout(poll, 10);
        });
    };
}

/** A model that just loaded: get its shaders compiled BEFORE it is first drawn (the first sight of a new car, person
 *  or building used to be a hitch while the GPU built its program mid-frame). A program depends on the scene's lights
 *  and fog, so it is compiled as if the model stood in the driving scene; the browser does it off the main thread
 *  where it can (three's compileAsync). Best effort: a set with its own lights still compiles on first show. */
function warmShaders(root) {
    const r = ctx.renderer;
    if (!r || !r.compileAsync || !ctx.scene || !ctx.camera) return;
    safeCompileAsync(r);
    try { r.compileAsync(root, ctx.camera, ctx.scene).catch(() => { /* best effort */ }); } catch (e) { /* best effort */ }
}

/** Load models by key (cached). */
/** opts.first: needed for what the title shows / ▶ PLAY starts in (the home street, its town) — the front of the line. */
export function ensureModels(keys, opts = null) { const pri = opts && opts.first ? "first" : null; return Promise.all(keys.map(k => loadOne(k, pri))); }

// ── 📥 the download line (roadmap 37e — measured first: scripts/perfstart.js) ───────────────────────
// On a slow phone network the title used to start ~150 model downloads at once; the few files ▶ PLAY's home start
// needs then queued behind all of them (minutes on slow 4G, cold). Now:
//   • on a SLOW connection only (the browser says so, or this page measured < 500 KB/s on its first downloads), before
//     a run starts a model that isn't boot-critical (PRELOAD) waits in ONE line, 3 at a time (1 on Save-Data);
//     ensureModels(keys, { first: true }) (the home street, its town) goes to the front; for 8 s after ▶ PLAY the line
//     holds. On a fast connection — and in the iOS app (local files) — everything goes out together, as before;
//   • anything asked for once she's playing goes straight out, and the line holds while it downloads; a model still
//     waiting in the line that she now needs jumps out of it;
//   • once the title is up and the browser is idle, the HOME START's models go to the front of the line: the ones the
//     last ▶ PLAY on this device asked for in its first 20 s (localStorage "lulu3dStartSet", ≤ 40), else the measured set.
// Nothing changes on a fast connection except the order; on Save-Data / 2G–3G the line is narrower.
const QS0 = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const NOLINE = QS0.has("noline"), NOPRELOAD = QS0.has("nopreload");      // (perfstart.js before / after switches)
const DL = { line: [], jobs: new Map(), out: 0, now: 0, runAt: 0, holdUntil: 0, titleAt: 0, kickedAt: 0, warmed: 0, learning: null, kicked: false };
const START_KEY = "lulu3dStartSet", START_MAX = 40;
// (measured 2026-11-27: what ▶ PLAY → walking at home fetched)
const START_FILES = ["town_bochur", "homes_mail", "homes_delivery", "homes_dog", "homes_street", "homes_mom", "homes_baby", "homes_dad",
    "avigail_person", "foot_booth", "foot_dozer", "foot_duck", "foot_raccoon", "foot_ostrich", "foot_fence", "foot_trespass", "foot_grass", "foot_mud", "foot_goose"];
function lineSlots() {
    const c = typeof navigator !== "undefined" && navigator.connection;
    if (c && c.saveData) return 1;
    return 3;
}
// is the connection slow? what the browser says (Save-Data, 2G / 3G, < 2 Mbit/s) — or, where it says nothing (Safari),
// what this page measured on its own first downloads (≥ 300 KB that didn't come from the cache, under 500 KB/s)
const NET = { bytes: 0, t0: Infinity, t1: 0, files: 0 };
function measure(url) {
    try {
        const e = performance.getEntriesByName(new URL(url, location.href).href).pop();
        if (!e || !e.transferSize || e.transferSize < 1000) return;          // (cache / local file: says nothing about the network)
        NET.bytes += e.transferSize; NET.files++;
        NET.t0 = Math.min(NET.t0, e.startTime); NET.t1 = Math.max(NET.t1, e.responseEnd);
    } catch (err) { /* no resource timing */ }
}
function slowNet() {
    const c = typeof navigator !== "undefined" && navigator.connection;
    if (c && (c.saveData || /(^|-)(2g|3g)$/.test(c.effectiveType || "") || (c.downlink && c.downlink < 2))) return true;
    return NET.bytes >= 300 * 1024 && NET.t1 > NET.t0 && NET.bytes / (NET.t1 - NET.t0) < 500;        // (bytes per ms ≈ KB/s)
}
function preRun() { const s = ctx.state; return !s || s === "boot" || s === "loading" || s === "title"; }
function go(j, now) {
    j.started = true; DL.out++; if (now) DL.now++;
    loader.loadAsync(j.url).then(j.res, j.rej).finally(() => { measure(j.url); DL.out--; if (now) DL.now--; DL.jobs.delete(j.key); pump(); });
}
function pump() {
    if (performance.now() < DL.holdUntil) return;
    // (a fast connection again — or it never was slow: the rest goes out together, as it always did)
    while (DL.line.length && DL.now === 0 && (DL.out < lineSlots() || !slowNet())) go(DL.line.shift(), false);
}
function download(key, url, pri) {
    return new Promise((res, rej) => {
        const j = { key, url, res, rej, started: false, first: pri === "first" };
        DL.jobs.set(key, j);
        if (NOLINE || !preRun() || PRELOAD.has(key)) { go(j, true); return; }
        if (!slowNet() && !DL.line.length) { go(j, false); return; }        // (a fast connection: straight out, as always)
        if (j.first) { let i = 0; while (i < DL.line.length && DL.line[i].first) i++; DL.line.splice(i, 0, j); }
        else DL.line.push(j);
        pump();
    });
}
/** A model waiting in the line that's needed first: to the front (behind the other firsts). */
function promote(key) {
    const j = DL.jobs.get(key);
    if (!j || j.started || j.first) return;
    const i = DL.line.indexOf(j);
    if (i < 0) return;
    DL.line.splice(i, 1); j.first = true;
    let k = 0; while (k < DL.line.length && DL.line[k].first) k++;
    DL.line.splice(k, 0, j);
}
/** A model still waiting in the line that she needs now: out it goes. */
function bump(key) {
    const j = DL.jobs.get(key);
    if (!j || j.started) return;
    const i = DL.line.indexOf(j);
    if (i >= 0) DL.line.splice(i, 1);
    go(j, true);
}
/** The home start's models: what the last ▶ PLAY here asked for, else the measured set (keys registered by now). */
function startKeys() {
    let keys = null;
    try { const v = JSON.parse(localStorage.getItem(START_KEY) || "null"); if (Array.isArray(v) && v.length) keys = v; } catch (e) { /* none yet */ }
    if (!keys) { const want = new Set(START_FILES); keys = Object.keys(FILES).filter(k => want.has(FILES[k])); }
    return keys.filter(k => FILES[k] && !models[k]).slice(0, START_MAX);
}
/** Behind the title: the home start's models to the front of the line (never before the title has painted). */
function warmStart() {
    if (DL.kicked) return;
    DL.kicked = true; DL.kickedAt = performance.now();
    const keys = startKeys();
    DL.warmed = keys.length;
    for (const k of keys) if (!models[k]) {
        if (pending.has(k)) promote(k);
        else loadOne(k, "first").catch(() => { /* a later ensureModels retries */ });
    }
    pump();
}
/** Drop the home start's models that haven't started downloading (she went somewhere else: Dina's mode, a party…). */
export function cancelStartPreload() {
    for (let i = DL.line.length - 1; i >= 0; i--) if (DL.line[i].first) {
        const j = DL.line.splice(i, 1)[0];
        DL.jobs.delete(j.key); pending.delete(j.key);
        j.rej(new Error("preload cancelled"));
    }
}
// learn: the models a ▶ PLAY (an open-world start from the title) asks for in its first 20 s
function learn(key) { if (DL.learning && !PRELOAD.has(key) && DL.learning.size < START_MAX && performance.now() - DL.runAt < 20000) DL.learning.add(key); }
on("title", () => {
    if (!DL.titleAt) DL.titleAt = performance.now();
    if (DL.kicked || NOPRELOAD || (ctx.party && ctx.party.active) || !ctx.enabled("preload")) return;      // (a ?test page opts in: &enable=preload)
    // after the title has painted and the browser is idle (two frames, then an idle slot)
    const idle = window.requestIdleCallback ? f => window.requestIdleCallback(f, { timeout: 1500 }) : f => setTimeout(f, 200);
    requestAnimationFrame(() => requestAnimationFrame(() => idle(() => { if (ctx.state === "title") warmStart(); })));
});
on("run:start", ({ mode } = {}) => {
    DL.runAt = performance.now();
    const home = mode === "cruise" && !(ctx.party && ctx.party.active) && !ctx.TEST;
    if (!home) { cancelStartPreload(); DL.learning = null; return; }
    DL.learning = new Set();
    // on a slow connection the rest of the line waits a few seconds: the home start's own files + first frames go first
    if (DL.line.length && slowNet()) { DL.holdUntil = performance.now() + 8000; setTimeout(pump, 8100); }
    setTimeout(() => {
        const L = DL.learning; DL.learning = null;
        if (!L || !L.size) return;
        try { localStorage.setItem(START_KEY, JSON.stringify([...L].slice(0, START_MAX))); } catch (e) { /* storage full / private mode */ }
    }, 20500);
    pump();
});
/** Tests / the perf harness: the line's state. */
export function downloadInfo(detail = false) { return { slow: slowNet(), kbps: NET.t1 > NET.t0 ? Math.round(NET.bytes / (NET.t1 - NET.t0)) : null, keys: detail ? DL.line.slice(0, 40).map(j => FILES[j.key] + (j.first ? "*" : "")) : undefined, line: DL.line.length, first: DL.line.filter(j => j.first).length, titleAt: Math.round(DL.titleAt), kickedAt: Math.round(DL.kickedAt), warmed: DL.warmed, max: START_MAX, out: DL.out, now: DL.now, slots: lineSlots(), kicked: DL.kicked }; }

/** Boot: load everything registered with preload: true. */
export async function loadModels(onProgress) {
    const keys = [...PRELOAD];
    let done = 0;
    await Promise.all(keys.map(k => loadOne(k).then(() => { done++; if (onProgress) onProgress(done / keys.length); })));
    return models;
}

function prepare(root) {
    root.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material;
        if (m.name === "Glass") {
            m.transparent = true; m.opacity = 0.32; m.depthWrite = false;
            o.castShadow = false;
        } else if (m.name === "GlassTint") {
            m.metalness = 0.3; m.roughness = 0.12;
        } else if (/^Water/.test(m.name)) {
            m.transparent = true; m.opacity = 0.82; o.castShadow = false;
        }
        if (/Headlight|Taillight|LightRed|LightBlue|Window|Neon/.test(m.name)) o.castShadow = false;
        // (a face's eyes / cheeks / mouth are 1–7 cm patches ON the head: their shadow is always inside the head's, and
        //  smaller than a shadow-map texel — 7.4 cm on MEDIUM, 4.5 on HIGH — but each was a draw in the shadow pass:
        //  ~4 per person on screen)
        if (/^(Eye|EyeShine|Cheek|Mouth)$/.test(m.name)) o.castShadow = false;
    });
    return root;
}

/** Find a node by (sanitized) name prefix: "Wheel_FL" matches "Wheel_FL001". */
export function findNodes(root, prefix) {
    const out = [];
    root.traverse(o => { if (o.name && o.name.startsWith(prefix)) out.push(o); });
    // keep only the top-most match of each branch (a Group and its child Meshes share names)
    return out.filter(o => !out.includes(o.parent));
}

const matCache = new Map();
/** Clone a template, recolouring materials by name: {Paint: "#ff0000"}. */
export function cloneWithColors(template, colors) {
    const c = template.clone(true);
    if (!colors) return c;
    c.traverse(o => {
        if (!o.isMesh) return;
        const name = o.material.name;
        const hex = colors[name];
        if (!hex) return;
        const key = o.material.uuid + hex;
        let m = matCache.get(key);
        if (!m) {
            m = o.material.clone();
            m.color.set(hex);
            matCache.set(key, m);
        }
        o.material = m;
    });
    return c;
}

/** Collect each mesh of a template with its transform relative to the template root. */
function partsOf(template) {
    if (template.userData.parts) return template.userData.parts;
    template.updateMatrixWorld(true);
    const inv = template.matrixWorld.clone().invert();
    const parts = [];
    template.traverse(o => {
        if (o.isMesh) parts.push({ geometry: o.geometry, material: o.material, local: inv.clone().multiply(o.matrixWorld), cast: o.castShadow });
    });
    template.userData.parts = parts;
    return parts;
}

const whiteMats = new Map();
/**
 * Instanced copies of a (multi-material) template: one InstancedMesh per part,
 * so a whole forest is a couple of draw calls. `tint` lists material names whose
 * colour varies per instance (set with .color()). `filter(part)` keeps only some parts
 * ({ geometry, material, local, cast }) — merge.js instances the parts it can't bake.
 */
export function instanced(template, count, tint = [], filter = null) {
    const parts = filter ? partsOf(template).filter(filter) : partsOf(template);
    const group = new THREE.Group();
    const meshes = parts.map(p => {
        let mat = p.material;
        const tinted = tint.includes(mat.name);
        if (tinted) {
            let w = whiteMats.get(mat.uuid);
            if (!w) { w = mat.clone(); w.color.set(0xffffff); whiteMats.set(mat.uuid, w); }
            mat = w;
        }
        const im = new THREE.InstancedMesh(p.geometry, mat, count);
        im.castShadow = p.cast;
        im.receiveShadow = true;
        im.userData.local = p.local;
        im.userData.tinted = tinted;
        im.userData.base = p.material.color.clone();
        im.userData.matName = p.material.name;
        group.add(im);
        return im;
    });
    const tmp = new THREE.Matrix4();
    return {
        group,
        set(i, matrix) {
            for (const im of meshes) im.setMatrixAt(i, tmp.multiplyMatrices(matrix, im.userData.local));
        },
        color(i, matName, color) {
            for (const im of meshes) if (im.userData.tinted && im.userData.matName === matName) im.setColorAt(i, color);
        },
        finish() {
            for (const im of meshes) {
                if (im.userData.tinted && !im.instanceColor) for (let i = 0; i < count; i++) im.setColorAt(i, im.userData.base);
                im.instanceMatrix.needsUpdate = true;
                if (im.instanceColor) im.instanceColor.needsUpdate = true;
                im.computeBoundingSphere();
            }
        },
        dispose() { for (const im of meshes) im.dispose(); },
    };
}
