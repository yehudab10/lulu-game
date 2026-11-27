// features/homes — 🏠 A HOUSE, from the inside: a procedural dollhouse on the interiors engine (Room).
//
// Rooms in a row (living room with the front door, a kitchen with THE cholent, a dining room with the
// Shabbos table, the kids' room) from the kit (homes_kit.glb); walls + floors are boxes sized here. The
// residents are interiors people with an AI on top: a routine, a view cone on the floor (sneak mode) and a
// "?"→"!" meter over their heads; once they SEE her, each kind reacts its own way (Bubbe's rolling pin, the
// kid's foam blaster, Dad clutching his towel, the girl screaming the house awake, the dog barking it awake…)
// and an adult heads for the wall phone to call it in. Lulu grabs household items off the furniture (or uses
// her own: pepper spray, the horn, a disguise) and uses them on people — every item × resident has its own
// cartoon reaction (data.js REACT). Crouch (D-pad ↓ / G / 🤫) to sneak: smaller cones, slower, and the couch
// hides her. Loot is capped (couch coins once per house per run). Out the door, or out a window.
import * as THREE from "three";
import { ctx, emit, on } from "../../core/ctx.js";
import { shared, store, saveSoon } from "../../core/save.js";
import { models, findNodes } from "../../models.js";
import { input, glyph, addTouchButton, rumble } from "../../input.js";
import * as H from "../../hud.js";
import { heal } from "../../core/driving.js";
import { defineInterior } from "../interiors/engine.js";
import { tone, sfx } from "../interiors/fx.js";
import { KINDS, ITEMS, PICKUP_ORDER, REACT, SPOTTED, SPOTTED_AGAIN, SUSPICIOUS, FIGHT, LULU_HIT, TALK, COUCH, COUCH_LINES, COUCH_EMPTY, COUCH_CAPPED,
    SOUVENIRS, CHOLENT, CHOLENT_SEEN, CHOLENT_FULL, CHOLENT_NOT_YET, CHOLENT_CAP, CALL_LINES, WINDOW_IN, WINDOW_OUT, DOOR_OUT, WET_FLOOR, dressLine } from "./data.js";
import { anchors, stageScene, buildProps, heldProp, catchFor, CATCH, ANIMALS } from "./stage.js";
import { linesFor } from "./scenes.js";
import { setupJob, jobHud } from "./jobs.js";
import { payJob } from "./visits.js";
import { doorZones, fit, roomLim } from "../interiors/clear.js";

const W = 6.2, D = 5.6, WALL = 2.7;
/** "Goldberg" → "Goldbergs", "Schwartz" → "Schwartzes". */
export const plural = n => /(s|z|x|sh|ch)$/i.test(n) ? n + "es" : n + "s";
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** Per-run loot memory (couch coins / souvenir / cholent: once per house per run) — index.js resets it at run:start. */
export const RUN = { couch: new Set(), souvenir: new Set(), cholent: new Set(), coins: 0, hearts: 0 };
/** What happened on this visit (index.js reads it when she's back outside). */
export const VISIT = { cur: null };
let HM = null;            // the house being entered (index.js sets it: { home, fam, mode, via, recognized })
export function prepare(h) { HM = h; }

// ── the interior def ─────────────────────────────────────────────────────
const DEF = defineInterior({
    id: "home", name: "a house", short: "the house", emoji: "🏠", title: "🏠 A HOUSE", model: "homesKit",
    models: ["homesItems", "homesBubbe", "homesDad", "homesMom", "homesBoy", "homesGirl", "homesBaby", "homesCat", "homesDog"],
    light: "indoor", cam: { dist: 7.6, height: 6.2, lookY: 0.8, clampX: 2.4 }, walkSpeed: 3.4,
    build, tick, beforeLeave, dispose,
    luluPost(rt) {
        const V = rt.data.V;
        if (!V) return;
        const o = rt.lulu.obj;
        o.scale.y += ((V.crouch ? 0.74 : 1) - o.scale.y) * 0.3;
        o.rotation.x = V.crouch ? 0.12 : 0;
        if (V.dizzyT > 0) o.rotation.z = Math.sin(rt.t * 9) * 0.12; else o.rotation.z = 0;
    },
});
addTouchButton({ id: "homesSneak", emoji: "🤫", label: "SNEAK", action: "item", visible: () => !!(VISIT.cur && VISIT.cur.rt && VISIT.cur.rt.ready && ctx.state === "interior" && VISIT.cur.mode !== "guest") });

function kit(name) {
    const src = findNodes(models.homesKit, "Kit_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
    return c;
}
export function itemProp(name) {
    const src = models.homesItems && findNodes(models.homesItems, "Prop_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true); c.position.set(0, 0, 0);
    return c;
}

// ── build ────────────────────────────────────────────────────────────────
function build(rt) {
    const hm = HM || { home: { name: "Goldberg", key: "test:0", cast: ["bubbe", "dad", "boy"], seed: 1 }, fam: null, mode: "sneak", via: "door" };
    HM = null;
    const home = hm.home, seed = home.seed || 1;
    let s = seed >>> 0;
    const R = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    rt.root.visible = false;          // (the kit: we clone pieces out of it)
    const scene = hm.scene || null, sd = scene && scene.def || {};
    const V = rt.data.V = { hm, home, mode: hm.mode, crouch: hm.via === "window", res: [], items: {}, held: null, heldUses: 0, dizzyT: 0, darts: [], fx: [], spotted: false,
        alarm: false, reported: false, callT: 0, caller: null, used: [], looted: [], charges: [], exit: "door", t: 0, recognized: !!hm.recognized, ate: false, hudKey: "",
        scene, noCatch: !!hm.noCatch, noPhone: !!sd.noPhone, hush: sd.hush || 1, zones: [], catchRoll: R(), treated: false };
    VISIT.cur = { rt, mode: hm.mode, home, V };
    // the rooms (who's home: the scene's — work, school, shul, the mountains)
    const cast = hm.cast || home.cast;
    const allCast = home.cast;
    const types = ["living", "kitchen"];
    if (allCast.includes("boy") || allCast.includes("girl") || (allCast.includes("baby") && R() < 0.5)) types.unshift("kids");
    if (R() < 0.65 || (sd.rooms && sd.rooms.dining)) types.splice(types.indexOf("kitchen"), 0, "dining");
    const n = types.length, x0 = -n * W / 2;
    const rooms = types.map((type, i) => ({ type, x0: x0 + i * W, x1: x0 + (i + 1) * W, cx: x0 + (i + 0.5) * W }));
    V.rooms = rooms;
    const room = t => rooms.find(r => r.type === t);
    rt.bounds = { x0: x0 + 0.3, x1: -x0 - 0.3, z0: -D / 2 + 0.3, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    V.walls = [];
    // materials (owned by the set)
    const pal = [["#F3E5D0", "#E3D5F0"], ["#E8F1E4", "#FFF1D6"], ["#FCE4EC", "#E0F2F1"], ["#EDE7F6", "#FFF8E1"]][seed % 4];
    const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o)); rt.own(m); return m; };
    const box = (w, h, d, mat, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); rt.own(g); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = h > 1; rt.add(m); return m; };
    const wallM = [M(pal[0]), M(pal[1])], trim = M("#FFFFFF"), woodFloor = M("#B58457", { roughness: 0.7 });
    const tileTex = checker(), tileM = M("#ffffff", { map: tileTex }); rt.own(tileTex);
    const carpet = M("#7FA7C9", { roughness: 1 });
    rooms.forEach((r, i) => {
        box(W, 0.06, D, r.type === "kitchen" ? tileM : r.type === "kids" ? carpet : woodFloor, r.cx, -0.03, 0);
        box(W, WALL, 0.14, wallM[i % 2], r.cx, WALL / 2, -D / 2 - 0.07);
        box(W, 0.12, 0.05, trim, r.cx, 0.06, -D / 2 + 0.03);
    });
    rt.cols.push({ id: "back", x0: x0 - 1, x1: -x0 + 1, z0: -D / 2 - 0.4, z1: -D / 2 + 0.12, on: true });
    for (const ex of [x0, -x0]) { box(0.14, WALL, D, wallM[0], ex, WALL / 2, 0); V.walls.push([ex, -D / 2, ex, D / 2]); }
    // partitions with a doorway (gap at z ∈ [0, 1.4])
    for (let i = 1; i < n; i++) {
        const x = x0 + i * W, g0 = -0.1, g1 = 1.3;
        box(0.12, WALL, g0 + D / 2, wallM[i % 2], x, WALL / 2, (-D / 2 + g0) / 2);
        box(0.12, WALL, D / 2 - g1, wallM[i % 2], x, WALL / 2, (g1 + D / 2) / 2);
        box(0.14, 0.3, g1 - g0, wallM[i % 2], x, WALL - 0.15, (g0 + g1) / 2);
        rt.cols.push({ id: "p" + i, x0: x - 0.1, x1: x + 0.1, z0: -D / 2, z1: g0, on: true }, { id: "q" + i, x0: x - 0.1, x1: x + 0.1, z0: g1, z1: D / 2, on: true });
        V.walls.push([x, -D / 2, x, g0], [x, g1, x, D / 2]);
    }
    // the front: a low cut-away wall (dollhouse) with the front door in the living room
    const L = room("living"), doorX = L.cx + 1.4;
    box(doorX - 0.62 - x0, 0.5, 0.12, trim, (x0 + doorX - 0.62) / 2, 0.25, D / 2);
    box(-x0 - doorX - 0.62, 0.5, 0.12, trim, (doorX + 0.62 - x0) / 2, 0.25, D / 2);
    rt.cols.push({ id: "f1", x0: x0 - 1, x1: doorX - 0.62, z0: D / 2 - 0.12, z1: D / 2 + 1, on: true }, { id: "f2", x0: doorX + 0.62, x1: -x0 + 1, z0: D / 2 - 0.12, z1: D / 2 + 1, on: true });
    const door = kit("Door"); door.position.set(doorX, 0, D / 2); rt.add(door);
    rt.spots.door = { x: doorX, z: D / 2 - 0.8, ry: Math.PI };
    // windows: one on the back wall of every room (night outside → dark glass)
    V.windows = [];
    const night = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0;
    for (const r of rooms) {
        const wx = r.cx + (r.type === "kitchen" ? -1.6 : r.type === "living" ? 0.9 : 0);
        const w = kit("Window"); w.position.set(wx, 1.55, -D / 2); rt.add(w);
        if (night > 0.4) w.traverse(o => { if (o.isMesh && /Glass/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set("#1B2440"); o.material.opacity = 0.9; rt.own(o.material); } });
        V.windows.push({ x: wx, z: -D / 2 + 0.75, room: r.type });
    }
    // ── furniture (+ colliders: tall pieces block a resident's view; low ones only hide her while she crouches) ──
    // (nothing solid in a doorway / the strip inside the front door — interiors/clear.js; the owner: "a tv blocks some
    //  of the entrances")
    const zones = doorZones({ xs: rooms.slice(1).map(r => r.x0), doorX, D });
    V.clearZones = zones;
    const put = (name, x, z, ry = 0, colW = 0, colD = 0, view = "") => {
        let hw = 0, hd = 0;
        if (colW) {
            const sw = Math.abs(Math.cos(ry)) > 0.5;
            hw = (sw ? colW : colD) / 2; hd = (sw ? colD : colW) / 2;
            const f = fit(zones, x, z, hw, hd, roomLim(x, x0, W, n, D));
            if (!f) return null;
            if (f.moved) { V.moved = V.moved || []; V.moved.push(name); }
            x = f.x; z = f.z;
        }
        const o = kit(name); o.position.set(x, 0, z); o.rotation.y = ry; rt.add(o);
        o.traverse(m => { if (m.isMesh) { m.castShadow = false; } });
        if (colW) rt.cols.push({ id: name, x0: x - hw, x1: x + hw, z0: z - hd, z1: z + hd, on: true, view });
        return o;
    };
    const onWall = (name, x, y) => { const o = kit(name); o.position.set(x, y, -D / 2); rt.add(o); return o; };
    const surf = {};
    for (const r of rooms) {
        const cx = r.cx, bz = -D / 2;
        if (r.type === "living") {
            put("Rug", cx - 0.8, 0.2);
            put("Couch", cx - 0.8, bz + 0.75, 0, 2.2, 0.9, "low");
            put("CoffeeTable", cx - 0.8, 0.45, 0, 1.1, 0.6);
            put("Armchair", cx + 1.0, bz + 0.85, -0.5, 0.95, 0.85, "low");
            put("Bookcase", cx + 2.3, bz + 0.25, 0, 1.6, 0.4, "tall");
            put("FloorLamp", cx - 2.6, bz + 0.45, 0, 0.3, 0.3);
            put("CoatRack", doorX + 1.0, D / 2 - 0.55, 0, 0.4, 0.4);
            put("TV", cx - 2.7, 0.9, Math.PI / 2, 1.4, 0.45, "low");
            put("Plant", cx + 2.75, 1.9, 0, 0.4, 0.4);
            onWall("Picture", cx - 0.8, 1.75);
            surf.couch = { x: cx - 0.8, z: bz + 1.45, y: 0.62 };
            surf.coat = { x: doorX + 1.0, z: D / 2 - 1.05, y: 0.05 };
            surf.souvenir = { x: cx + 2.3, z: bz + 0.9, kind: "shelf" };
        } else if (r.type === "kitchen") {
            put("Counter", cx - 0.35, bz + 0.35, 0, 2.6, 0.66, "low");
            put("Stove", cx + 1.4, bz + 0.38, 0, 0.8, 0.7, "low");
            put("Fridge", cx + 2.5, bz + 0.4, 0, 0.82, 0.74, "tall");
            put("KitchenTable", cx - 1.3, 0.9, 0, 1.2, 1.2);
            put("Chair", cx - 1.3, 1.75, Math.PI, 0, 0); put("Chair", cx - 2.15, 0.9, Math.PI / 2, 0, 0);
            if (cast.includes("baby")) put("HighChair", cx - 0.2, 1.1, Math.PI, 0.5, 0.5);
            const ph = onWall("WallPhone", cx - 2.55, 1.45);
            V.phone = { x: cx - 2.55, z: bz + 0.65 };
            surf.stove = { x: cx + 1.4, z: bz + 0.4, y: 0.95 };
            surf.counter = { x: cx - 1.1, z: bz + 0.35, y: 0.92 };
            surf.sink = { x: cx + 0.45, z: bz + 0.35, y: 0.92 };
            surf.ktable = { x: cx - 1.3, z: 0.9, y: 0.78 };
            surf.fridge = { x: cx + 2.5, z: bz + 1.0, kind: "fridge" };
        } else if (r.type === "dining") {
            put("ShabbosTable", cx, -0.2, 0, 2.5, 1.1, "low");
            for (const sx of [-0.65, 0.05, 0.75]) { put("Chair", cx + sx, -0.2 - 0.82, 0, 0, 0); put("Chair", cx + sx, -0.2 + 0.82, Math.PI, 0, 0); }
            put("Chair", cx - 1.55, -0.2, -Math.PI / 2, 0, 0);
            put("Bookcase", cx + 2.2, bz + 0.25, 0, 1.6, 0.4, "tall");
            put("Plant", cx - 2.7, bz + 0.5, 0, 0.4, 0.4);
            onWall("Picture", cx - 1.2, 1.8);
            surf.table = { x: cx + 0.6, z: -0.2, y: 0.8 };
            surf.dsouvenir = { x: cx + 2.2, z: bz + 0.9, kind: "shelf" };
        } else if (r.type === "kids") {
            put("BunkBed", cx - 1.65, bz + 0.6, 0, 2.0, 0.95, "tall");
            put("ToyBox", cx + 0.7, bz + 0.45, 0, 0.8, 0.5, "low");
            const desk = put("Desk", cx + 2.3, 0.6, -Math.PI / 2, 1.0, 0.55, "low");
            put("BeanBag", cx + 0.3, 1.2, 0, 0.7, 0.7);
            if (cast.includes("baby") && !room("kitchen")) put("Crib", cx - 2.2, 1.4, Math.PI / 2, 0.65, 1.2, "low");
            onWall("Poster", cx + 1.9, 1.6);
            surf.toybox = { x: cx + 0.7, z: bz + 0.45, y: 0.55 };
            surf.bunk = { x: cx - 1.65, z: bz + 0.6, y: 0.62 };
            if (desk) surf.desk = { x: desk.position.x, z: desk.position.z, y: 0.72 };      // (where the desk really went)
        }
    }
    V.surf = surf;
    // ── the items to grab ──
    const where = { pan: surf.stove, seltzer: surf.counter || surf.table, chicken: surf.toybox || surf.couch, pillow: surf.couch || surf.bunk,
        kugel: surf.table || surf.ktable, blower: surf.coat, balloon: surf.desk || surf.sink };
    for (const id of PICKUP_ORDER) {
        const at = where[id];
        if (!at) continue;
        const it = ITEMS[id], obj = itemProp(it.prop);
        obj.position.set(at.x + (id === "seltzer" ? 0.4 : id === "chicken" && !surf.toybox ? 0.5 : 0), (at.y || 0) + 0.04, at.z + 0.05);
        obj.rotation.x = id === "blower" ? 0 : -Math.PI / 2;
        if (id === "kugel" || id === "blower") obj.rotation.x = 0;
        if (id === "kugel") obj.position.y += 0.02;
        rt.add(obj);
        V.items[id] = { id, obj, home: obj.position.clone(), rot: obj.rotation.clone(), taken: false, used: false };
        rt.hot({ id: "grab_" + id, x: obj.position.x, z: at.z + 0.5, r: 1.35, label: `${it.emoji} Grab the ${it.name}`, enabled: () => !V.items[id].taken, action: r2 => grab(r2, id) });
    }
    // ── loot ──
    if (surf.couch) rt.hot({ id: "couch", x: surf.couch.x - 0.6, z: surf.couch.z, r: 1.2, label: "🛋️ Dig in the couch cushions", action: r2 => couch(r2) });
    const cho = sd.cholent || "ready";
    if (surf.stove && cho !== "none") rt.hot({ id: "cholent", x: surf.stove.x + 0.2, z: surf.stove.z + 0.75, r: 1.0,
        label: () => cho === "notYet" ? "🍲 The cholent (it's not ready…)" : V.mode === "guest" ? "🍲 Have some cholent" : "🍲 Eat the cholent", enabled: () => !RUN.cholent.has(home.key), action: r2 => cholent(r2) });
    const sv = surf.fridge || surf.souvenir || surf.dsouvenir;
    if (sv) rt.hot({ id: "souvenir", x: sv.x, z: sv.z, r: 1.1, label: "🎁 Pocket a souvenir", enabled: () => !RUN.souvenir.has(home.key), action: r2 => souvenir(r2) });
    for (const w of V.windows) rt.hot({ id: "win_" + w.room, x: w.x, z: w.z, r: 1.15, label: "🪟 Jump out the window", action: r2 => jumpOut(r2, w) });
    rt.hot({ id: "door", x: doorX, z: D / 2 - 0.6, r: 1.3, label: "🚪 Walk out the front door", action: r2 => { V.exit = "door"; r2.leave(); } });
    // ── the residents ──
    const spotsFor = {
        bubbe: [room("kitchen") && { x: room("kitchen").cx + 1.4, z: -D / 2 + 1.15, ry: Math.PI, path: [[room("kitchen").cx + 1.4, -D / 2 + 1.15], [room("kitchen").cx - 1.0, -D / 2 + 1.05]] }],
        dad: [{ x: (room("kids") || L).cx, z: 1.6, ry: 0, path: [[(room("kids") || L).cx, 1.6], [L.cx - 0.5, 1.7], [(room("dining") || L).cx, 1.7]] }],
        mom: [room("dining") ? { x: room("dining").cx - 0.6, z: 0.95, ry: Math.PI, path: [[room("dining").cx - 0.8, 0.95], [room("dining").cx + 1.0, 0.95], [room("dining").cx + 1.4, -1.4]] }
            : { x: room("kitchen").cx - 0.6, z: 0, ry: Math.PI, path: [[room("kitchen").cx - 0.6, 0], [room("kitchen").cx + 1.0, -1.2]] }],
        boy: [room("kids") ? { x: room("kids").cx + 0.9, z: 0.4, ry: Math.PI, path: [[room("kids").cx + 0.9, 0.3], [room("kids").cx - 0.6, 0.9]] } : { x: L.cx - 0.8, z: 1.3, ry: Math.PI }],
        girl: [room("kids") ? { x: room("kids").cx + 0.3, z: 1.25, ry: Math.PI, sit: true } : { x: L.cx - 1.6, z: 1.5, ry: Math.PI }],
        baby: [cast.includes("baby") && room("kitchen") ? { x: room("kitchen").cx - 0.2, z: 1.1, ry: Math.PI, y: 0.5, sit: true } : { x: (room("kids") || L).cx - 2.2, z: 1.4, ry: Math.PI / 2, y: 0.42, sit: true }],
        cat: [{ x: L.cx + 0.6, z: 0.9, ry: 0, roam: true }],
        dog: [{ x: L.cx - 0.2, z: 1.2, ry: 2.2, sleep: true }],
    };
    // the zeidy (a household extra, life.js) stands where a dad would when the scene doesn't say
    spotsFor.zeidy = [{ x: L.cx + 1.0, z: -D / 2 + 0.85, ry: -0.5, sit: true }];
    // ── the scene: who's where, the props, the zones (stage.js) ──
    const A = V.A = anchors(V, rt, cast);
    const ST = stageScene(sd, cast, A, rt, (scene && scene.w) || {});
    const dadLook = sd.dad || "dressed";
    const addRes = (id, kind, sp, opts = {}) => {
        const K = KINDS[kind];
        if (!K || !sp || !models[K.key]) return null;
        const colors = opts.colors || (kind === "dad" ? (DAD_LOOK[dadLook] || null) : K.colors || null);
        const rec = rt.person(id, K.key, sp, { faceLulu: false, collide: !K.animal, r: K.animal ? 0.25 : 0.33, pose: sp.sit || sp.sleep ? { sit: true } : {}, name: opts.name || kind, colors });
        const res = { id, kind, K, rec, p: rec.p, name: opts.name || kind, meter: 0, state: "routine", t: 0, path: sp.path || null, pi: 0, wait: 1 + R() * 2,
            stun: 0, fx: null, friendly: hm.mode === "guest" || (hm.mode === "kid" && (kind === "boy" || kind === "girl")) || !!K.crowd || !!(sd.crowd && opts.extra),
            sit: !!sp.sit, sleep: !!sp.sleep && !sp.awake, roam: !!sp.roam, lie: !!sp.lie, pose0: sp.pose || null, fast: !!sp.fast, dressed: kind === "dad" ? dadLook !== "towel" : true,
            fooled: 0, y0: sp.y || 0, seen: null, said: {}, fight: null, cool: 0, home0: { x: sp.x, z: sp.z }, ind: null, cone: null, eat: 0, prop: null };
        if (res.sleep || res.sit) rec.pose = { sit: true };
        if (res.pose0) rec.pose = Object.assign({ sit: res.sit }, res.pose0);
        if (sp.prop) { const hp = heldProp(rt, sp.prop); if (hp) { res.held = hp; rt.hold(rec.p, hp, { y: -0.42, z: 0.02 }); } }
        res.cone = makeCone(rt, K);
        res.ind = makeIndicator(rt);
        V.res.push(res);
        rt.hot({ id: "res_" + id, who: id, track: true, r: K.animal ? 1.3 : 1.55, label: () => resLabel(V, res), action: r2 => useOn(r2, res) });
        return res;
    };
    for (const kind of cast) {
        const P0 = ST.place[kind];
        const sp = P0 ? { x: P0.x, z: P0.z, ry: P0.ry, y: P0.y, path: P0.path, sit: P0.sit, sleep: P0.sleep, lie: P0.lie, prop: P0.prop, pose: P0.pose, awake: P0.awake, fast: P0.fast }
            : (spotsFor[kind] || [])[0];
        // Purim: everyone's in costume (the same costumes on every screen — the house's seed)
        const costume = sd.costumes && !KINDS[kind].animal && kind !== "baby" ? COSTUMES[(seed + kind.length * 7 + kind.charCodeAt(0)) % COSTUMES.length] : null;
        addRes(kind, kind, sp, { name: home.names && home.names[kind] || kind, colors: (P0 && P0.colors) || costume || null });
    }
    ST.extras.forEach((e, i) => addRes(`x${i}_${e.kind}`, e.kind, e, { name: e.name || e.kind, colors: e.colors || null, extra: true }));
    V.props = buildProps(rt, ST.props);
    if (hm.job) { try { setupJob(rt, V, hm.job, {}); } catch (e) { console.error("[homes] job", e); } }
    V.zones = ST.zones;
    // the scene's chatter (bubbles, not toasts), and the violin
    if (sd.ambient) rt.every(3.8, 6.5, r2 => ambient(r2), { gate: false, first: 1.6 });
    if (sd.ambient && sd.ambient.yard) { V.yard = new THREE.Object3D(); V.yard.position.set(L.cx + 0.9, 1.2, -D / 2 - 0.4); rt.add(V.yard); }
    if (sd.task) setupTask(rt, V, sd.task);
    // where she comes in
    let start = rt.spots.door;
    if (hm.via === "window") { const w = pick(V.windows.filter(x => x.room !== "kids")) || V.windows[0]; start = { x: w.x, z: w.z, ry: 0 }; }
    rt.lulu.obj.position.set(start.x, 0, start.z);
    rt.lulu.obj.rotation.y = start.ry;
    // the title + presence (friends in a 🎉 party see "🏠 in the Goldbergs' house")
    const pl = plural(home.name), label = `the ${pl}' house`;
    DEF.name = `The ${pl}' house`; DEF.title = `🏠 THE ${pl.toUpperCase()}`;
    if (ctx.interiors.home) ctx.interiors.home.name = DEF.name;
    rt.chip.querySelector(".int-title").textContent = DEF.title;
    try { if (ctx.party && ctx.party.active && ctx.party.presence) ctx.party.presence({ mode: "in", icon: "🏠", label: `in ${label}` }); } catch (e) { /* no party */ }
    // a warm lamp (the 3 a.m. kitchen: just the fridge light)
    const dim = sd.lights === "dim";
    const lamp = new THREE.PointLight(dim ? "#9FB4FF" : "#FFE0B0", dim ? 1.6 : 5, dim ? 9 : 14, 1.6); lamp.position.set(dim ? (room("kitchen").cx + 1.5) : 0, 2.4, 0.5); rt.add(lamp);
    V.lamp = lamp;
    // the opening beat
    rt.timers.push({ once: true, t: 0.35, gate: false, fn: () => {
        if (hm.via === "window") rt.bubble(pick(WINDOW_IN), rt.lulu.obj, 2.6);
        else if (hm.mode === "sneak") rt.bubble("*tiptoes in* ...hello? 🤫", rt.lulu.obj, 2.2);
        else if (hm.mode === "kid") rt.bubble("*whispers* Thanks, kiddo. 🤫", rt.lulu.obj, 2.2);
        if (hm.mode !== "guest") H.toast(`🤫 ${glyph("item").replace(/<[^>]+>/g, "")} crouch to sneak · grab things · use them on people`, "pink", { key: "homes:hint" });
        else treat(rt);
    } });
    rt.extraEl.innerHTML = "";
    if (ctx.G) { V.hint = ctx.G.hint; ctx.G.hint = ""; }        // (foot's "find a car" hint doesn't belong in a living room)
    emit("homes:enter", { key: home.key, name: home.name, mode: hm.mode, via: hm.via, scene: sd.id || null });
}
/** What a dad wears in a scene (homes_dad is modelled in a towel — the break-in classic). */
const DAD_LOOK = { dressed: { Top: "#FFFFFF", Bottom: "#212121", Shoes: "#212121" }, pyjamas: { Top: "#90CAF9", Bottom: "#5C6BC0", Shoes: "#5C6BC0" }, towel: null };
/** A line of the scene's chatter from someone who's home and calm. */
const COSTUMES = [{ Top: "#E53935", Bottom: "#212121" }, { Top: "#FDD835", Bottom: "#1E88E5" }, { Top: "#8E24AA", Bottom: "#FFD54F" }, { Top: "#43A047", Bottom: "#43A047" },
    { Top: "#FB8C00", Bottom: "#5D4037" }, { Top: "#FFFFFF", Bottom: "#E91E63" }, { Top: "#00ACC1", Bottom: "#FFFFFF" }];
/** A scene's own little task: 🪥 scrub the chametz (Pesach cleaning) · 🍪 find the afikoman (the seder — no money on Yom Tov). */
function setupTask(rt, V, task) {
    const T = V.task = { type: task, done: false, n: 0 };
    const S = V.surf;
    if (task === "scrub") {
        const at = [S.fridge, S.couch, S.coat, S.ktable || S.table].filter(Boolean).slice(0, 3);
        T.need = at.length;
        at.forEach((p, i) => rt.hot({ id: "task_scrub" + i, x: p.x + (i === 2 ? -0.4 : 0.3), z: p.z + 0.5, r: 1.2, label: "🪥 Scrub out the chametz", enabled: () => !T.done && !(T.got && T.got[i]) && V.mode === "guest",
            action: r2 => {
                (T.got = T.got || {})[i] = 1; T.n++;
                tone(1600, 0.05, "sawtooth", 0.02, 2200); tone(1500, 0.05, "sawtooth", 0.02, 2100, 0.1);
                r2.bubble(pick(["*scrub scrub* ...a Cheerio. From 2023.", "*scrub* A PRETZEL. In the grout. How?!", "*scrub scrub scrub* ...that was a crumb. Probably. It's gone now."]), r2.lulu.obj, 2.2);
                if (T.n >= T.need) {
                    T.done = true; V.favour = true;
                    const paid = payJob("chametz");
                    const hr = V.res.find(q => q.K.adult);
                    if (hr) rt.bubble("Chametz-FREE! You can come back for Pesach. As a GUEST. No toothbrush.", hr.p.obj, 3);
                    if (paid) H.toast(`🪥 +${paid} 💰 — a Pesach-clean corner`, "gold", { key: "homes:job" });
                    emit("homes:task", { type: task, paid });
                }
            } }));
    } else if (task === "afikoman") {
        const spots = [S.couch, S.coat, S.bunk || S.toybox, S.desk || S.counter].filter(Boolean);
        const right = (V.home.seed >>> 3) % spots.length;
        T.need = 1;
        spots.forEach((p, i) => rt.hot({ id: "task_afi" + i, x: p.x, z: p.z + 0.5, r: 1.2, label: "🔍 Look for the afikoman", enabled: () => !T.done && !(T.got && T.got[i]) && V.mode === "guest",
            action: r2 => {
                (T.got = T.got || {})[i] = 1;
                if (i !== right) { r2.bubble(pick(["Not here. ...a kid giggles somewhere. You're COLD.", "Nope. Just a hat. Somebody's Shabbos hat.", "Not here. \"WARMER!\" a kid yells. \"No, COLDER!\""]), r2.lulu.obj, 2.2); return; }
                T.done = true; V.favour = true;
                r2.bubble("THE AFIKOMAN! ...the kids want it back. They have DEMANDS.", r2.lulu.obj, 2.6);
                const hr = V.res.find(q => q.K.adult);
                if (hr) rt.timers.push({ once: true, t: 2.4, gate: false, fn: () => { if (!rt.disposed) rt.bubble("You found it! A present — AFTER Yom Tov. That's the deal.", hr.p.obj, 3); } });
                emit("homes:task", { type: task, paid: 0 });
                emit("stat", { id: "homesAfikoman", n: 1 });
            } }));
    }
}
function ambient(rt) {
    const V = rt.data.V, sd = V.scene && V.scene.def;
    if (!sd || !sd.ambient || ctx.dialogOpen) return;
    if (V.yard && (Math.random() < 0.5 || !V.res.length)) { rt.bubble(pick(sd.ambient.yard), V.yard, 2.6); return; }
    const who = V.res.filter(r => r.state === "routine" && !(r.stun > 0) && !(r.sleep && r.kind !== "zeidy") && !r.mischief && linesFor(sd.ambient, r.kind));
    if (!who.length) return;
    const r = who[Math.floor(Math.random() * who.length)];
    rt.bubble(dressLine(r, pick(linesFor(sd.ambient, r.kind))), r.p.obj, 2.6);
    if (sd.squeak && (r.kind === "boy" || r.kind === "girl")) { tone(1480, 0.35, "sawtooth", 0.035, 1700); tone(1210, 0.3, "sawtooth", 0.03, 980, 0.3); }
}
/** A guest is served something (once a visit): a host says so — warmth, not coins. */
function treat(rt) {
    const V = rt.data.V, sd = V.scene && V.scene.def;
    if (V.treated) return;
    V.treated = true;
    const host = V.res.find(r => r.K.adult && !r.K.crowd) || V.res.find(r => !r.K.animal && r.kind !== "baby");
    if (!host) return;
    const what = sd && sd.treat ? `Here — ${sd.treat}. Eat!` : pick(["Sit! You'll have something. Coffee? Cake? BOTH.", "You'll eat something. You're too THIN."]);
    rt.bubble(what, host.p.obj, 3);
    const g = sd && sd.guest;
    if (g && g.length) rt.timers.push({ once: true, t: 3.4, gate: false, fn: () => { if (!rt.disposed) rt.bubble(pick(g), host.p.obj, 3); } });
    emit("homes:treat", { key: V.home.key, scene: sd && sd.id });
}

function checker() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#E8E2D6" : "#FFFFFF"; g.fillRect(i * 32, j * 32, 32, 32); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 5); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
// a resident's view cone on the floor (a fan, forward = +Z)
function makeCone(rt, K) {
    if (K.cone >= 3) return null;
    const segs = 16, pos = [0, 0.03, 0];
    for (let i = 0; i <= segs; i++) { const a = -K.cone + (2 * K.cone) * i / segs; pos.push(Math.sin(a), 0.03, Math.cos(a)); }
    const idx = []; for (let i = 1; i <= segs; i++) idx.push(0, i, i + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.MeshBasicMaterial({ color: "#FFE082", transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
    rt.own(g, m);
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 3; mesh.scale.setScalar(K.see);
    rt.add(mesh);
    return mesh;
}
// "?" / "!" over a head + its meter ring (a canvas sprite, redrawn only when what it shows changes)
function makeIndicator(rt) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
    const sp = new THREE.Sprite(mat); sp.scale.set(0.62, 0.62, 1); sp.renderOrder = 11; sp.visible = false;
    rt.add(sp); rt.own(tex, mat);
    return { sp, c, tex, key: "" };
}
function drawIndicator(ind, mode, v) {
    const key = mode + Math.round(v * 12);
    if (ind.key === key) return;
    ind.key = key;
    const g = ind.c.getContext("2d");
    g.clearRect(0, 0, 128, 128);
    if (!mode) { ind.sp.visible = false; return; }
    ind.sp.visible = true;
    const col = mode === "!" ? "#FF1744" : mode === "📞" ? "#FF6D00" : mode === "💤" || mode === "😋" || mode === "💫" ? "#7E57C2" : "#FFC400";
    g.fillStyle = "rgba(30,20,40,0.78)"; g.beginPath(); g.arc(64, 64, 50, 0, Math.PI * 2); g.fill();
    g.lineWidth = 10; g.strokeStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.arc(64, 64, 52, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = col; g.beginPath(); g.arc(64, 64, 52, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(v, 0, 1)); g.stroke();
    g.fillStyle = col; g.font = `800 ${mode.length > 1 ? 54 : 74}px Fredoka, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(mode, 64, 68);
    ind.tex.needsUpdate = true;
}

// ── the hotspots' actions ────────────────────────────────────────────────
function resLabel(V, r) {
    const nm = r.name;
    if (V.jobLabel) { const l = V.jobLabel(r); if (l) return l; }
    if (V.held) { const it = ITEMS[V.held]; return `${it.emoji} ${it.verb} ${nm}`; }
    if (r.friendly || V.mode === "guest") return `💬 Talk to ${nm} · 🎒 items`;
    if (r.kind === "baby" || r.K.animal) return `💬 ${nm} · 🎒 items`;
    return r.state === "routine" && r.meter < 0.3 ? `🤫 Shh, ${nm}! · 🎒 items` : `💬 ${nm} · 🎒 items`;
}
function grab(rt, id) {
    const V = rt.data.V, it = V.items[id];
    if (!it || it.taken) return;
    if (V.held && V.items[V.held]) putBack(rt, V.held);
    it.taken = true;
    it.obj.removeFromParent();
    it.obj.position.set(0, 0, 0); it.obj.rotation.set(0, 0, 0);
    rt.luluHold(it.obj, { y: -0.45, z: 0.05 });
    V.held = id; V.heldUses = ITEMS[id].uses || 0;
    sfx.hop();
    H.toast(`${ITEMS[id].emoji} Got the ${ITEMS[id].name}! Use it on someone (✋)`, "gold", { key: "homes:grab" });
    emit("homes:grab", { item: id });
    makeNoise(rt, 1.6);
}
function putBack(rt, id) {
    const V = rt.data.V, it = V.items[id];
    rt.luluHold(null);
    if (it) { it.taken = false; it.obj.position.copy(it.home); it.obj.rotation.copy(it.rot); rt.add(it.obj); }
    V.held = null;
}
function useOn(rt, r) {
    const V = rt.data.V;
    if (V.jobUse && V.jobUse(rt, r)) return;
    if (V.held) return applyItem(rt, r, V.held);
    return chat(rt, r);
}
async function chat(rt, r) {
    const V = rt.data.V;
    const sh = shared.get(), pepper = sh.pepperSpray | 0;
    const opts = [r.friendly || V.mode === "guest" ? "💬 Talk" : r.K.animal || r.kind === "baby" ? "💬 Say hi" : "🤫 \"Shhh!\"",
        `🌶️ Pepper spray (${pepper})`, "📯 Honk your horn", "🥸 Put on a disguise", "✖ Never mind"];
    const i = await rt.choose(`${r.K.emoji} ${r.name}`, r.state === "alarm" ? "They're staring at you." : "What now?", opts, { emoji: r.K.emoji, person: r.rec });
    if (rt.disposed) return;
    if (i === 0) {
        if (r.friendly || V.mode === "guest" || r.K.animal || r.kind === "baby") {
            const sd = V.scene && V.scene.def;
            const g = V.mode === "guest" && sd && sd.guest && r.K.adult && Math.random() < 0.6 ? sd.guest : (TALK[r.kind] || TALK[r.K.like] || ["..."]);
            rt.bubble(dressLine(r, pick(g)), r.p.obj, 2.8); emit("stat", { id: "homesTalks", n: 1 }); return;
        }
        // "Shhh!" — a kid makes a pact; an adult… sees her, obviously
        if (r.kind === "boy" || r.kind === "girl") { r.friendly = true; r.meter = 0; rt.bubble(r.kind === "boy" ? "...okay. But I want to SEE the car." : "I won't tell. ...for a BRACELET.", r.p.obj, 2.8); return; }
        r.meter = 1; spot(rt, r);
        return;
    }
    if (i === 1) {
        if (pepper <= 0) { H.toast("🌶️ No pepper spray! The makolet in town has it", "red"); return; }
        shared.update(s => { s.pepperSpray = Math.max(0, (s.pepperSpray | 0) - 1); });
        return applyItem(rt, r, "pepper");
    }
    if (i === 2) return applyItem(rt, r, "horn");
    if (i === 3) {
        if (V.disguised) { rt.bubble("I'm ALREADY in disguise. ...can't you tell? 🥸", rt.lulu.obj, 2); return; }
        V.disguised = true;
        const g = itemProp("Disguise"); const head = rt.lulu.limbs && rt.lulu.limbs.Body;
        if (head) { g.position.set(0, 1.47, 0.19); head.add(g); }
        return applyItem(rt, r, "disguise");
    }
}
/** Lulu uses `id` on resident r: the reaction from the table, the effect, the consequences. */
export function applyItem(rt, r, id) {
    const V = rt.data.V, it = ITEMS[id];
    const tab0 = (REACT[id] && (REACT[id][r.kind] || REACT[id][r.K.like])) || { line: "...?!", lulu: "Oops." };
    const tab = Object.assign({}, tab0, { line: dressLine(r, tab0.line) });
    const fx = tab.fx || it.fx;
    rt.luluPose = { point: true };
    rt.timers.push({ once: true, t: 0.45, gate: false, fn: () => { rt.luluPose = null; } });
    rt.faceTo = { x: r.p.obj.position.x, z: r.p.obj.position.z };
    playItem(it.sfx);
    rumble(0.3, 0.5, 120);
    // the effect
    r.fx = fx; r.stun = it.stun * (fx === "eat" ? 1 : fx === "fooled" ? 1 : 1); r.fxT = 0;
    if (r.state === "calling") { rt.bubble("*drops the phone*", r.p.obj, 1.6); r.state = "alarm"; V.callT = 0; V.caller = null; if (r.prop) { r.prop.removeFromParent(); r.prop = null; } }
    const pos = r.p.obj.position, head = new THREE.Vector3(pos.x, (r.K.h || 1.5) + 0.2, pos.z);
    if (fx === "dizzy") stars(rt, r);
    if (fx === "wet") rt.burst(head, ["#4FC3F7", "#B3E5FC", "#FFFFFF"], 22, 2.6, 0.05);
    if (fx === "feathers") rt.burst(head, ["#FFFFFF", "#F5F5F5", "#EDE7F6"], 30, 2.2, 0.07);
    if (fx === "sneeze") rt.burst(head, ["#9CCC65", "#C5E1A5", "#DCE775"], 26, 1.6, 0.09);
    if (fx === "laugh" || fx === "fooled") rt.burst(head, ["#FFD740", "#FF4081", "#40C4FF"], 14, 2, 0.05);
    if (fx === "blown") {
        const L = rt.lulu.obj.position, dx = pos.x - L.x, dz = pos.z - L.z, d = Math.hypot(dx, dz) || 1;
        r.push = { vx: dx / d * 3.2, vz: dz / d * 3.2, t: 0.7 };
        rt.burst(head, ["#E65100", "#F9A825", "#8D6E63"], 22, 3, 0.06);
    }
    if (fx === "startle") r.jump = 0.5;
    if (fx === "eat") { r.eat = it.stun; if (!r.K.animal) { r.prop = itemProp("Kugel"); rt.hold(r.p, r.prop, { y: -0.45, z: 0.05 }); } if (r.kind === "dog") r.friendly = true; }
    if (fx === "fooled") { r.fooled = it.stun; r.meter = 0; }
    rt.bubble(tab.line, r.p.obj, 3.2);
    if (tab.lulu) rt.timers.push({ once: true, t: 1.1, gate: false, fn: () => { if (!rt.disposed) rt.bubble(tab.lulu, rt.lulu.obj, 2.4); } });
    // fight back (the kid with a pillow, a water war)
    if (tab.fight) r.fight = { kind: id === "balloon" ? "nerf" : "pillow", t: 6 };
    // after it wears off they KNOW someone's here (except a kugel / a disguise / the friendly ones)
    if (V.mode !== "guest" && !r.friendly && fx !== "eat" && fx !== "fooled" && !r.K.animal && r.kind !== "baby") r.after = "alarm";
    if (V.mode === "guest" && !r.K.animal && r.kind !== "baby" && fx !== "eat" && fx !== "fooled" && fx !== "laugh") { V.mode = "sneak"; VISIT.cur.mode = "angry"; r.after = "alarm"; for (const o of V.res) o.friendly = false; }
    // uses
    if (!it.own) {
        V.heldUses = it.uses ? V.heldUses - 1 : 0;
        if (it.uses && V.heldUses <= 0) { const item = V.items[id]; rt.luluHold(null); V.held = null; if (item) item.used = true; if (id === "balloon") rt.burst(head, ["#29B6F6"], 12, 2, 0.06); }
    }
    if (!V.used.includes(id)) V.used.push(id);
    V.lastUse = { item: id, who: r.kind, fx };
    emit("homes:use", { item: id, who: r.kind, fx, line: tab.line });
    emit("stat", { id: "homesItemUses", n: 1 });
    return { item: id, who: r.kind, fx, line: tab.line };
}
function stars(rt, r) {
    const g = new THREE.Group(), geo = new THREE.OctahedronGeometry(0.07, 0), m = new THREE.MeshBasicMaterial({ color: "#FFD740" });
    rt.own(geo, m);
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(geo, m); s.position.set(Math.cos(i / 5 * Math.PI * 2) * 0.28, 0, Math.sin(i / 5 * Math.PI * 2) * 0.28); g.add(s); }
    g.position.y = (r.K ? r.K.h : 1.62) + 0.12;
    r.p.obj.add(g);
    r.starsObj = g;
    return g;
}
function playItem(kind) {
    if (kind === "bonk") { tone(180, 0.25, "triangle", 0.2, 90); tone(1200, 0.4, "sine", 0.06, 900, 0.02); }
    else if (kind === "spray") { tone(2200, 0.4, "sawtooth", 0.025, 1200); }
    else if (kind === "squeak") { tone(900, 0.18, "square", 0.08, 1600); tone(1500, 0.2, "square", 0.06, 700, 0.18); }
    else if (kind === "poof") { tone(140, 0.2, "sine", 0.14, 70); }
    else if (kind === "nom") { for (let i = 0; i < 3; i++) tone(240 + i * 30, 0.08, "triangle", 0.1, 0, i * 0.15); }
    else if (kind === "blower") { tone(110, 0.9, "sawtooth", 0.05, 160); tone(2400, 0.9, "sawtooth", 0.012, 2600); }
    else if (kind === "splash") sfx.splash();
    else if (kind === "horn") { tone(415, 0.6, "sawtooth", 0.1); tone(523, 0.6, "sawtooth", 0.08); }
}
function couch(rt) {
    const V = rt.data.V, key = V.home.key;
    rt.luluPose = { sit: false, cheer: false };
    if (RUN.couch.has(key)) { rt.bubble(pick(COUCH_EMPTY), rt.lulu.obj, 2.6); return; }
    RUN.couch.add(key);
    const left = COUCH.runCap - RUN.coins;
    if (left <= 0) { rt.bubble(pick(COUCH_CAPPED), rt.lulu.obj, 2.8); emit("homes:couch", { coins: 0, capped: true }); return; }
    const n = Math.min(left, COUCH.min + Math.floor(Math.random() * (COUCH.max - COUCH.min + 1)));
    RUN.coins += n;
    rt.coins(n, `🛋️ +${n} 💰 couch coins`, { x: V.surf.couch.x, y: 0.8, z: V.surf.couch.z });
    rt.bubble(pick(COUCH_LINES), rt.lulu.obj, 2.6);
    V.looted.push("coins");
    makeNoise(rt, 2.2);
    emit("homes:couch", { coins: n, capped: false });
    emit("stat", { id: "homesCouchCoins", n });
}
function cholent(rt) {
    const V = rt.data.V, sd = V.scene && V.scene.def;
    if (sd && sd.cholent === "notYet") {
        rt.bubble(pick(CHOLENT_NOT_YET), rt.lulu.obj, 2.8);
        for (const r of V.res) if ((r.kind === "bubbe" || r.kind === "mom") && sees(rt, r, 1.3)) { rt.bubble("NOT YET!! It has to go ALL NIGHT!", r.p.obj, 2.4); if (V.mode !== "guest") { r.meter = Math.max(r.meter, 0.8); } break; }
        return;
    }
    RUN.cholent.add(V.home.key);
    const full = RUN.hearts >= CHOLENT_CAP;
    rt.bubble(pick(full ? CHOLENT_FULL : CHOLENT), rt.lulu.obj, 2.6);
    const sp = itemProp("Spoon"); rt.luluHold(sp, { y: -0.45 });
    rt.timers.push({ once: true, t: 1.4, gate: false, fn: () => { if (!rt.disposed && !V.held) rt.luluHold(null); else if (!rt.disposed && V.held) rt.luluHold(V.items[V.held] && V.items[V.held].obj, { y: -0.45, z: 0.05 }); } });
    tone(240, 0.08, "triangle", 0.1); tone(300, 0.1, "triangle", 0.1, 0, 0.15);
    // (+1 heart — at most CHOLENT_CAP a run across every house in every town: ~200 doors aren't ~200 hearts)
    if (!full) try { if (ctx.G && ctx.G.hearts < ctx.G.maxHearts) { heal(1); RUN.hearts++; } } catch (e) { /* no run */ }
    V.ate = true; V.looted.push("cholent");
    // anyone watching takes it personally
    if (V.mode !== "guest") for (const r of V.res) if (r.kind === "bubbe" || r.kind === "mom") if (sees(rt, r, 1.2)) { rt.bubble(pick(CHOLENT_SEEN), r.p.obj, 2.4); r.meter = 1; spot(rt, r); if (V.mode !== "guest") V.charges.push("cholent"); break; }
    emit("homes:cholent", {});
    emit("stat", { id: "homesCholent", n: 1 });
}
function souvenir(rt) {
    const V = rt.data.V;
    RUN.souvenir.add(V.home.key);
    const sv = pick(SOUVENIRS);
    const S = store("homes", { fam: {}, souvenirs: [] });
    S.souvenirs = (S.souvenirs || []).concat([{ id: sv.id, from: V.home.name, at: Date.now() }]).slice(-20);
    saveSoon();
    V.looted.push("souvenir:" + sv.id);
    H.toast(`${sv.emoji} Pocketed ${sv.name}`, "gold");
    rt.bubble("*pockets it* ...for the scrapbook. 📒", rt.lulu.obj, 2.2);
    makeNoise(rt, 1.4);
    emit("homes:souvenir", { id: sv.id });
    emit("stat", { id: "homesSouvenirs", n: 1 });
}
function jumpOut(rt, w) {
    const V = rt.data.V;
    V.exit = "window";
    rt.busy = true;
    rt.walkTo(w.x, w.z - 0.2, 1.2).then(() => {
        if (rt.disposed) return;
        rt.bubble(pick(WINDOW_OUT), rt.lulu.obj, 1.6);
        tone(500, 0.3, "triangle", 0.1, 900);
        let t = 0;
        rt.runMode({ update(r2, dt) { t += dt; const o = r2.lulu.obj; o.position.y = Math.sin(Math.min(1, t / 0.6) * Math.PI) * 0.9; o.position.z -= dt * 1.4; o.rotation.x = -t * 2; return t > 0.6; } })
            .then(() => { rt.busy = false; rt.leave(); });
    });
}
function makeNoise(rt, r = 2) {
    const V = rt.data.V;
    if (V.mode === "guest") return;
    const L = rt.lulu.obj.position;
    for (const q of V.res) if (!q.friendly && !q.stun && Math.hypot(q.p.obj.position.x - L.x, q.p.obj.position.z - L.z) < r * (V.crouch ? 0.7 : 1.3)) q.meter = Math.max(q.meter, 0.45);
}

// ── seeing ───────────────────────────────────────────────────────────────
function segHitsBox(ax, az, bx, bz, c, pad = 0) {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    for (const [p, d, lo, hi] of [[ax, dx, c.x0 - pad, c.x1 + pad], [az, dz, c.z0 - pad, c.z1 + pad]]) {
        if (Math.abs(d) < 1e-9) { if (p < lo || p > hi) return false; continue; }
        let u0 = (lo - p) / d, u1 = (hi - p) / d;
        if (u0 > u1) [u0, u1] = [u1, u0];
        t0 = Math.max(t0, u0); t1 = Math.min(t1, u1);
        if (t0 > t1) return false;
    }
    return t1 > 0.04 && t0 < 0.96;
}
function blocked(rt, ax, az, bx, bz) {
    const V = rt.data.V;
    for (const c of rt.cols) {
        if (!c.view && !/^[pq]\d/.test(c.id)) continue;
        if (c.view === "low" && !V.crouch) continue;
        if (segHitsBox(ax, az, bx, bz, c)) return true;
    }
    return false;
}
/** Can resident r see Lulu right now? (range × k) */
function sees(rt, r, k = 1) {
    const V = rt.data.V, L = rt.lulu.obj.position, o = r.p.obj;
    const dx = L.x - o.position.x, dz = L.z - o.position.z, d = Math.hypot(dx, dz);
    const range = r.K.see * k * (V.crouch ? 0.6 : 1);
    if (d > range) return false;
    if (r.K.cone < 3) { const a = Math.abs(wrap(Math.atan2(dx, dz) - o.rotation.y)); if (a > r.K.cone && d > 0.9) return false; }
    return !blocked(rt, o.position.x, o.position.z, L.x, L.z);
}

/** 🔔 Someone rang the doorbell (a friend covering for her — features/partners): everyone who can come to the door does,
 *  for `sec` seconds — the "fooled" pose, no view cones. → how many were distracted. */
export function distract(rt, sec = 12, line = "🔔 Who's at the DOOR?!") {
    const V = rt && rt.data && rt.data.V;
    if (!V) return 0;
    let n = 0;
    for (const r of V.res) {
        if (r.K.animal || r.kind === "baby") continue;
        r.fx = "fooled"; r.stun = Math.max(r.stun || 0, sec); r.fooled = sec; r.meter = 0;
        if (!n) rt.bubble(line, r.p.obj, 2.4);
        n++;
    }
    return n;
}

// ── per frame ────────────────────────────────────────────────────────────
function tick(rt, dt) {
    const V = rt.data.V;
    if (!V) return;
    V.t += dt;
    const P = input.pressed || {};
    if (P.item && V.mode !== "guest" && !ctx.dialogOpen) { V.crouch = !V.crouch; tone(V.crouch ? 300 : 420, 0.06, "triangle", 0.05); }
    rt.def.walkSpeed = V.dizzyT > 0 ? 0 : V.crouch ? 1.7 : 3.4;
    if (V.dizzyT > 0) { V.dizzyT -= dt; if (V.dizzyT <= 0) { rt.lock = false; if (V.luluStars) { V.luluStars.removeFromParent(); V.luluStars = null; } } }
    const frozen = ctx.dialogOpen || rt.leaving;
    const L = rt.lulu.obj.position;
    const moving = Math.hypot(rt.vel.x, rt.vel.z) > 0.6;
    let maxM = 0, anySpot = false;
    for (const r of V.res) {
        const o = r.p.obj, K = r.K;
        r.t += dt; r.cool -= dt;
        // stars spin, the effect wears off
        if (r.starsObj) r.starsObj.rotation.y += dt * 6;
        if (r.jump > 0) { r.jump -= dt; o.position.y = r.y0 + Math.sin(clamp(r.jump / 0.5, 0, 1) * Math.PI) * 0.45; } else o.position.y = r.y0;
        if (r.push && r.push.t > 0) { r.push.t -= dt; o.position.x += r.push.vx * dt; o.position.z += r.push.vz * dt; const B = rt.bounds; o.position.x = clamp(o.position.x, B.x0, B.x1); o.position.z = clamp(o.position.z, B.z0, B.z1); o.rotation.z = Math.sin(r.t * 30) * 0.15; } else o.rotation.z = 0;
        if (r.stun > 0) {
            r.stun -= dt;
            const pose = r.fx === "eat" ? { sit: !K.animal && r.kind !== "baby", talk: true } : r.fx === "laugh" || r.fx === "fooled" ? { cheer: r.fx === "laugh", talk: true }
                : r.fx === "dizzy" ? { talk: true } : r.fx === "sneeze" ? { talk: Math.sin(r.t * 5) > 0.3 } : { talk: true };
            r.rec.pose = Object.assign({ sit: r.sit }, pose);
            if (r.fx === "dizzy") o.rotation.y += dt * 2.2;
            if (r.fx === "wet" && Math.random() < dt * 8) rt.particles.emit(o.position.x + (Math.random() - 0.5) * 0.3, (K.h || 1.5) * 0.9, o.position.z + (Math.random() - 0.5) * 0.3, 0, -0.5, 0, 0.04, 0.5, [0.5, 0.8, 1]);
            if (r.fx === "sneeze" && Math.random() < dt * 1.2) rt.bubble("ACHOO!", o, 0.8);
            drawIndicator(r.ind, r.fx === "eat" ? "😋" : r.fx === "dizzy" ? "💫" : "", 1 - r.stun / 4);
            placeInd(r);
            if (r.cone) r.cone.visible = false;
            if (r.stun <= 0) {
                r.rec.pose = r.sit ? { sit: true } : {};
                if (r.starsObj) { r.starsObj.removeFromParent(); r.starsObj = null; }
                if (r.prop && r.fx === "eat") { r.prop.removeFromParent(); r.prop = null; }
                if (r.fx === "fooled") r.meter = 0.5;
                if (r.after === "alarm") { r.after = null; r.meter = 1; if (r.state !== "alarm") spot(rt, r, true); }
                r.fx = null;
            }
            continue;
        }
        // see her? (sneak mode only; a friendly resident / a guest visit never "spots" her)
        let seeing = false;
        if (!frozen && !r.friendly && V.mode !== "guest" && !V.catching) {
            seeing = sees(rt, r) || (!V.crouch && moving && !K.animal && !r.sleep && Math.hypot(L.x - o.position.x, L.z - o.position.z) < 1.9);
            if (K.nose && Math.hypot(L.x - o.position.x, L.z - o.position.z) < K.see) seeing = true;
            if (seeing) {
                const d = Math.hypot(L.x - o.position.x, L.z - o.position.z);
                const rate = K.gain * (0.55 + 1.2 * (1 - d / K.see)) * (V.crouch ? 0.5 : 1) * (moving && !V.crouch ? 1.25 : 1) * (V.recognized ? 1.6 : 1) * (r.sleep ? 0.35 : 1) * V.hush;
                r.meter = Math.min(1, r.meter + rate * dt * 0.85);
                r.seen = { x: L.x, z: L.z };
            } else if (r.state !== "alarm") r.meter = Math.max(0, r.meter - dt * 0.28);
        }
        if (r.state === "routine" && r.meter >= 0.4) { r.state = "suspicious"; r.t = 0; if (!r.said.q) { r.said.q = 1; rt.bubble(dressLine(r, pick(SUSPICIOUS[r.kind] || SUSPICIOUS[r.K.like])), o, 2.2); } }
        if (r.state === "suspicious" && r.meter <= 0.05) { r.state = "routine"; r.said.q = 0; }
        if (r.state !== "alarm" && r.meter >= 1) spot(rt, r);
        // move / act
        if (r.state === "routine") routine(rt, r, dt);
        if (r.lie && r.state === "routine") { o.rotation.z = Math.PI / 2; r.rec.pose = {}; }
        else if (r.state === "suspicious") { faceTo(o, r.seen || L, dt, 4); r.rec.pose = r.sit ? { sit: true } : {}; if (r.sleep && r.meter > 0.6) { r.sleep = false; r.sit = false; } }
        else if (r.state === "alarm" || r.state === "calling") alarmAct(rt, r, dt);
        if (r.fight) fightAct(rt, r, dt);
        // the cone + the indicator
        if (r.cone) {
            const show = V.mode !== "guest" && !r.friendly && r.state !== "alarm" && r.state !== "calling";
            r.cone.visible = show;
            if (show) {
                r.cone.position.set(o.position.x, 0.02, o.position.z); r.cone.rotation.y = o.rotation.y;
                r.cone.scale.setScalar(K.see * (V.crouch ? 0.6 : 1) * (r.sleep ? 0.45 : 1));
                r.cone.material.color.set(r.meter > 0.66 ? "#FF5252" : r.meter > 0.3 ? "#FFAB40" : "#FFE082");
                r.cone.material.opacity = 0.16 + r.meter * 0.22;
            }
        }
        const mode = r.state === "calling" ? "📞" : r.state === "alarm" ? "!" : r.meter > 0.08 && !r.friendly ? "?" : r.sleep ? "💤" : "";
        drawIndicator(r.ind, mode, r.state === "calling" ? V.callT / 5 : r.state === "alarm" ? 1 : r.meter);
        placeInd(r);
        if (!r.friendly && V.mode !== "guest") maxM = Math.max(maxM, r.meter);
        if (r.state === "alarm") anySpot = true;
    }
    tickDarts(rt, dt);
    tickZones(rt, dt, moving);
    if (V.job && V.job.tick) { try { V.job.tick(rt, dt); } catch (e) { console.error("[homes] job tick", e); V.job.tick = null; } }
    hud(rt, maxM, anySpot);
}
/** The scene's zones: erev Shabbos' just-washed kitchen floor (squeaky footprints; they hear it). */
function tickZones(rt, dt, moving) {
    const V = rt.data.V;
    if (!V.zones.length) return;
    const L = rt.lulu.obj.position;
    V.zoneT = Math.max(0, (V.zoneT || 0) - dt);
    for (const z of V.zones) {
        if (z.kind !== "wet" || !moving || L.x < z.x0 || L.x > z.x1 || L.z < z.z0 || L.z > z.z1) continue;
        if (V.zoneT > 0) continue;
        V.zoneT = 1.6;
        tone(1900, 0.06, "sine", 0.05, 2400); tone(2100, 0.06, "sine", 0.05, 2600, 0.12);
        V.wetSteps = (V.wetSteps || 0) + 1;
        const yeller = V.res.find(r => (r.kind === "mom" || r.kind === "bubbe") && r.state !== "alarm" && !(r.stun > 0));
        if (yeller) {
            rt.bubble(pick(WET_FLOOR), yeller.p.obj, 2.4);
            if (V.mode !== "guest" && !yeller.friendly) { yeller.meter = Math.max(yeller.meter, Math.min(0.95, yeller.meter + 0.4)); yeller.seen = { x: L.x, z: L.z }; }
        } else rt.bubble("*squeak* *squeak* ...footprints. On a WET floor. Oops.", rt.lulu.obj, 2);
        emit("homes:wet", { key: V.home.key, n: V.wetSteps });
    }
}
function placeInd(r) { const o = r.p.obj; r.ind.sp.position.set(o.position.x, (r.K.h || 1.5) + 0.55 + (r.sit ? -0.35 : 0) + o.position.y, o.position.z); }
function faceTo(o, at, dt, rate = 6) { const want = Math.atan2(at.x - o.position.x, at.z - o.position.z); o.rotation.y += wrap(want - o.rotation.y) * Math.min(1, dt * rate); }
function moveTo(rt, r, x, z, sp, dt) {
    const o = r.p.obj, dx = x - o.position.x, dz = z - o.position.z, d = Math.hypot(dx, dz);
    if (d < 0.15 || sp <= 0) { r.rec.pose = r.sit ? { sit: true } : {}; return true; }
    o.position.x += dx / d * Math.min(d, sp * dt); o.position.z += dz / d * Math.min(d, sp * dt);
    // don't walk through walls: the same colliders she has
    const p = o.position, B = rt.bounds;
    for (const c of rt.cols) if (/^[pq]\d|back|f\d/.test(c.id)) {
        const cx = clamp(p.x, c.x0, c.x1), cz = clamp(p.z, c.z0, c.z1), ex = p.x - cx, ez = p.z - cz, e = Math.hypot(ex, ez);
        if (e < 0.3 && e > 1e-4) { p.x = cx + ex / e * 0.3; p.z = cz + ez / e * 0.3; }
    }
    p.x = clamp(p.x, B.x0, B.x1); p.z = clamp(p.z, B.z0, B.z1);
    faceTo(o, { x, z }, dt, 7);
    r.rec.pose = { walk: sp };
    if (r.K.animal) animalLegs(r, sp);
    return false;
}
function animalLegs(r, sp) {
    const L = r.legs || (r.legs = ["Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR", "Tail"].map(n => findNodes(r.p.obj, n)[0]));
    const s = Math.sin(r.t * 12) * Math.min(0.7, sp * 0.3);
    if (L[0]) L[0].rotation.x = s; if (L[3]) L[3].rotation.x = s; if (L[1]) L[1].rotation.x = -s; if (L[2]) L[2].rotation.x = -s;
    if (L[4]) L[4].rotation.y = Math.sin(r.t * (r.kind === "dog" ? 14 : 3)) * 0.5;
}
// doorway waypoints so a walk from one room to another goes through the gap, not the wall
function route(rt, r, x, z) {
    const V = rt.data.V, o = r.p.obj;
    const ri = V.rooms.findIndex(q => o.position.x >= q.x0 && o.position.x < q.x1), ti = V.rooms.findIndex(q => x >= q.x0 && x < q.x1);
    if (ri < 0 || ti < 0 || ri === ti) return { x, z };
    const dir = ti > ri ? 1 : -1, bx = dir > 0 ? V.rooms[ri].x1 : V.rooms[ri].x0;
    // first to the doorway (in this room), then straight through it
    if (Math.abs(o.position.z - 0.6) > 0.45 || Math.abs(o.position.x - bx) > 0.75) return { x: bx - dir * 0.55, z: 0.6 };
    return { x: bx + dir * 0.9, z: 0.6 };
}
function routine(rt, r, dt) {
    const o = r.p.obj;
    if (r.sleep || (r.sit && !r.path)) { r.rec.pose = r.pose0 && !r.sleep ? Object.assign({ sit: true }, r.pose0) : { sit: !r.lie }; if (r.K.animal) animalLegs(r, 0); return; }
    if (r.pose0 && !r.path) { r.rec.pose = Object.assign({}, r.pose0); return; }
    if (r.kind === "bubbe" && r.wait > 0) { r.rec.pose = { talk: true }; }       // stirring the pot
    if (r.roam && !r.path) { const V = rt.data.V, q = V.rooms[Math.floor(Math.random() * V.rooms.length)]; r.path = [[q.cx + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2.5]]; r.pi = 0; }
    if (!r.path) { if (r.K.animal) animalLegs(r, 0); return; }
    if (r.wait > 0) { r.wait -= dt; if (r.K.animal) animalLegs(r, 0); return; }
    const [x, z] = r.path[r.pi], via = route(rt, r, x, z);
    if (moveTo(rt, r, via.x, via.z, (r.K.speed || 1.5) * (r.fast ? 1.0 : 0.55), dt) && via.x === x && via.z === z) {
        r.wait = 1.5 + Math.random() * 3;
        r.pi = (r.pi + 1) % r.path.length;
        if (r.roam && Math.random() < 0.5) r.path = null;
    }
}
/** First sight: the shocked line, and what this kind of person does about it. */
function spot(rt, r, quiet = false) {
    const V = rt.data.V;
    if (r.state === "alarm" || r.state === "calling") return;
    // who caught her decides what happens (stage.js CATCH): a kid wants to play, Zeidy wants the floor mopped…
    if (!quiet && !V.catching) {
        const c = catchFor(V, r);
        if (c) {
            V.catching = c; r.meter = 0.99; r.state = "suspicious";
            emit("homes:caught", { key: V.home.key, who: r.kind, how: c });
            CATCH[c](rt, r, V.scene && V.scene.def).then(ok => {
                V.catching = null;
                if (rt.disposed) return;
                if (ok) { V.caughtBy = V.caughtBy || []; V.caughtBy.push({ who: r.kind, how: c }); if (V.mode === "guest") treat(rt); if (r.meter > 0.5 && !r.friendly) r.meter = 0.2; if (r.state === "suspicious") r.state = "routine"; r.said.q = 0; }
                else { r.meter = 1; r.state = "routine"; spotNow(rt, r, quiet); }
            }).catch(e => { V.catching = null; console.error("[homes] catch", e); });
            return;
        }
    }
    spotNow(rt, r, quiet);
}
function spotNow(rt, r, quiet = false) {
    const V = rt.data.V;
    if (r.state === "alarm" || r.state === "calling") return;
    r.state = "alarm"; r.meter = 1; r.t = 0; r.sleep = false;
    if (r.lie) { r.lie = false; r.y0 = 0; r.p.obj.rotation.z = 0; }
    if (!(r.kind === "baby" || r.K.animal)) r.sit = false;
    V.spotted = true;
    const lines = (V.recognized ? SPOTTED_AGAIN : SPOTTED)[r.kind] || (V.recognized ? SPOTTED_AGAIN : SPOTTED)[r.K.like];
    if (!quiet || !r.said.spot) rt.bubble(dressLine(r, pick(lines)), r.p.obj, 2.8);
    r.said.spot = 1;
    tone(r.K.adult ? 880 : 1200, 0.25, "square", 0.08, r.K.adult ? 1300 : 1700);
    rumble(0.25, 0.4, 120);
    if (r.K.fights === "pin") { r.fight = { kind: "pin", t: 9 }; r.prop = itemProp("RollingPin"); rt.hold(r.p, r.prop, { y: -0.45 }); }
    if (r.K.fights === "nerf") { r.fight = { kind: "nerf", t: 14 }; r.prop = itemProp("Nerf"); rt.hold(r.p, r.prop, { y: -0.45, z: 0.06 }); }
    // the alarm spreads: a scream / a bark wakes the house
    const loud = r.kind === "girl" || r.kind === "dog" || r.kind === "bubbe";
    for (const q of V.res) if (q !== r && !q.friendly && q.stun <= 0) {
        q.meter = Math.max(q.meter, loud ? 0.75 : 0.45);
        q.seen = { x: rt.lulu.obj.position.x, z: rt.lulu.obj.position.z };
        if (q.state === "routine") q.state = "suspicious";
    }
    if (!V.alarm) { V.alarm = true; emit("homes:spotted", { who: r.kind, key: V.home.key }); emit("stat", { id: "homesSpotted", n: 1 }); }
}
function alarmAct(rt, r, dt) {
    const V = rt.data.V, o = r.p.obj, L = rt.lulu.obj.position, K = r.K;
    // the caller: an adult heads for the wall phone (the first one who can)
    if (K.adult && !K.nocall && !V.noPhone && !V.reported && V.phone && (!V.caller || V.caller === r) && !r.fight) {
        const better = V.res.find(q => q !== r && q.K.adult && !q.K.nocall && q.state === "alarm" && q.stun <= 0 && !q.fight && q.K.caller < K.caller);
        if (!better) {
            V.caller = r;
            if (r.state !== "calling") {
                const via = route(rt, r, V.phone.x, V.phone.z);
                if (moveTo(rt, r, via.x, via.z, K.speed, dt) && via.x === V.phone.x) { r.state = "calling"; V.callT = 0; r.prop = itemProp("Phone"); rt.hold(r.p, r.prop, { y: -0.42 }); r.rec.pose = { talk: true }; rt.bubble(pick(CALL_LINES), o, 3); }
                return;
            }
            V.callT += dt;
            r.rec.pose = { talk: true, point: Math.sin(r.t * 2) > 0.5 };
            faceTo(o, L, dt, 3);
            if (V.callT >= 5) {
                V.reported = true; r.state = "alarm"; V.caller = null;
                if (r.prop) { r.prop.removeFromParent(); r.prop = null; }
                rt.bubble("They're ON THEIR WAY! You hear me?! ON THEIR WAY!", o, 2.8);
                H.toast(`📞 The ${plural(V.home.name)} called it in!`, "red", { key: "homes:call" });
                emit("homes:called", { key: V.home.key, name: V.home.name });
            }
            return;
        }
    }
    if (r.fight) return;
    // everyone else: kids point / hide, the baby giggles, the cat flees, the dog follows wagging, adults shoo
    if (r.kind === "baby") { r.rec.pose = { sit: true, cheer: Math.sin(r.t * 3) > 0.4 }; faceTo(o, L, dt, 3); return; }
    if (r.kind === "cat") { const far = { x: rt.bounds.x0 + 0.5, z: rt.bounds.z1 - 0.5 }; if (moveTo(rt, r, far.x, far.z, K.speed, dt)) { r.rec.pose = { sit: true }; animalLegs(r, 0); } return; }
    const d = Math.hypot(L.x - o.position.x, L.z - o.position.z);
    if (r.kind === "dog") { if (d > 1.4) moveTo(rt, r, L.x, L.z, K.speed, dt); else { faceTo(o, L, dt); animalLegs(r, 0); } if (r.cool <= 0 && !r.friendly) { r.cool = 2.5; rt.bubble("WOOF!", o, 0.9); tone(220, 0.12, "square", 0.08, 160); } return; }
    if (K.adult) { if (d > 2.2) moveTo(rt, r, L.x, L.z, K.speed * 0.8, dt); else { faceTo(o, L, dt); r.rec.pose = { point: true, talk: true }; } if (r.cool <= 0) { r.cool = 4; rt.bubble(pick(["OUT! OUT!", "Shoo! SHOO!", "I have a SHOFAR and I'll USE it!"]), o, 1.6); } return; }
    faceTo(o, L, dt); r.rec.pose = { point: true };
}
function fightAct(rt, r, dt) {
    const V = rt.data.V, o = r.p.obj, L = rt.lulu.obj.position, f = r.fight;
    f.t -= dt;
    if (f.t <= 0) { r.fight = null; if (r.prop && r.kind !== "boy") { r.prop.removeFromParent(); r.prop = null; } if (r.kind === "bubbe") { r.fx = "eat"; r.stun = 3; rt.bubble("Oy, my BACK. ...sit, I'm sitting.", o, 2.2); } return; }
    const d = Math.hypot(L.x - o.position.x, L.z - o.position.z);
    if (f.kind === "pin" || f.kind === "pillow") {
        if (d > 0.85) moveTo(rt, r, L.x, L.z, f.kind === "pin" ? 1.9 : 2.3, dt);
        else { faceTo(o, L, dt); r.rec.pose = { point: true }; }
        if (d < 0.95 && r.cool <= 0) {
            r.cool = 1.8;
            rt.bubble(pick(FIGHT[f.kind]), o, 1.6);
            luluHit(rt, f.kind, o);
        }
    } else if (f.kind === "nerf") {
        if (d < 2.6) moveTo(rt, r, o.position.x - (L.x - o.position.x) / (d || 1), o.position.z - (L.z - o.position.z) / (d || 1), 2, dt);
        else if (d > 4.5) moveTo(rt, r, L.x, L.z, 2.2, dt);
        else { faceTo(o, L, dt, 8); r.rec.pose = { point: true }; }
        if (r.cool <= 0 && d < 6) { r.cool = 1.1; shootDart(rt, o, L); if (Math.random() < 0.3) rt.bubble(pick(FIGHT.nerf), o, 1.2); }
    }
}
function luluHit(rt, kind, from) {
    const V = rt.data.V;
    tone(kind === "pin" ? 200 : 600, 0.2, "triangle", 0.14, kind === "pin" ? 100 : 300);
    rumble(0.5, 0.6, 160);
    rt.bubble(pick(LULU_HIT[kind] || LULU_HIT.pin), rt.lulu.obj, 1.6);
    if (kind === "pillow") rt.burst(new THREE.Vector3(rt.lulu.obj.position.x, 1.6, rt.lulu.obj.position.z), ["#FFFFFF", "#F5F5F5"], 20, 2, 0.06);
    if (kind === "pin") {
        V.dizzyT = 1.3; rt.lock = true;
        if (!V.luluStars) V.luluStars = stars(rt, { p: rt.lulu, K: { h: 1.62 } });
        // a shove toward the door
        const o = rt.lulu.obj.position, dx = o.x - from.position.x, dz = o.z - from.position.z, d = Math.hypot(dx, dz) || 1;
        o.x += dx / d * 0.6; o.z += dz / d * 0.6;
    }
    emit("homes:hit", { kind });
}
// stars() stores on r.starsObj; for Lulu we pass a fake r whose p is rt.lulu
function shootDart(rt, from, at) {
    const V = rt.data.V, d = itemProp("Dart");
    const p = from.position.clone(); p.y = 0.9;
    d.position.copy(p);
    const dx = at.x - p.x, dz = at.z - p.z, len = Math.hypot(dx, dz) || 1;
    d.rotation.y = Math.atan2(dx, dz) + Math.PI;
    rt.add(d);
    V.darts.push({ obj: d, vx: dx / len * 9, vz: dz / len * 9, t: 0.9 });
    tone(900, 0.06, "square", 0.05, 500);
}
function tickDarts(rt, dt) {
    const V = rt.data.V, L = rt.lulu.obj.position;
    for (let i = V.darts.length - 1; i >= 0; i--) {
        const d = V.darts[i];
        d.t -= dt; d.obj.position.x += d.vx * dt; d.obj.position.z += d.vz * dt;
        const hit = Math.hypot(d.obj.position.x - L.x, d.obj.position.z - L.z) < 0.4;
        if (hit) { if (Math.random() < 0.5) luluHit(rt, "nerf", d.obj); else tone(700, 0.05, "square", 0.05); }
        if (hit || d.t <= 0) { d.obj.removeFromParent(); V.darts.splice(i, 1); }
    }
}
function hud(rt, maxM, spotted) {
    const V = rt.data.V;
    let html;
    if (V.mode === "guest") html = `<div class="int-meter">${V.job ? "🤝 HELPING" : "🍽️ A GUEST of"} the ${plural(V.home.name)}${V.job ? jobHud(V) : `<small style="display:block;font-weight:600;opacity:.8">${V.scene && V.scene.def && V.scene.def.id !== "ordinary" ? `${V.scene.def.emoji} ${V.scene.def.name}` : "behave… or don't"}</small>`}</div>`;
    else if (V.caller && V.caller.state === "calling") html = `<div class="int-meter">📞 THE ${plural(V.home.name).toUpperCase()} ARE CALLING IT IN!<div class="bar"><i style="width:${Math.round(V.callT / 5 * 100)}%;background:#FF6D00"></i></div><small style="display:block;font-weight:600">stop the caller — or get OUT</small></div>`;
    else if (V.reported) html = `<div class="int-meter">🚨 REPORTED — get out!</div>`;
    else if (spotted) html = `<div class="int-meter">😱 SPOTTED!<small style="display:block;font-weight:600">${glyph("interact")} use something on them · or run</small></div>`;
    else html = `<div class="int-meter">${V.crouch ? "🤫 SNEAKING" : "🧍 STANDING"} <small style="font-weight:600;opacity:.85">· ${glyph("item")} ${V.crouch ? "stand" : "crouch"}</small><div class="bar"><i style="width:${Math.round(maxM * 100)}%;background:${maxM > 0.66 ? "#FF5252" : maxM > 0.3 ? "#FFAB40" : "#FFE082"}"></i></div><small style="display:block;font-weight:600;opacity:.8">👁 noticed</small></div>`;
    const key = html + ":" + Math.round(maxM * 20) + V.mode + spotted + V.reported + Math.round(V.callT * 4);
    if (key !== V.hudKey) { V.hudKey = key; rt.extraEl.innerHTML = html; }
}

function beforeLeave(rt) {
    const V = rt.data.V;
    if (V && V.exit === "door" && !rt.leavingQuip) { rt.leavingQuip = true; rt.bubble(pick(DOOR_OUT), rt.lulu.obj, 1.2); }
    return Promise.resolve();
}
function dispose(rt) {
    const V = rt.data.V;
    if (!V) return;
    VISIT.last = { key: V.home.key, name: V.home.name, home: V.home, mode: V.mode, startMode: V.hm.mode, via: V.hm.via, exit: V.exit, spotted: V.spotted, reported: V.reported,
        used: V.used.slice(), looted: V.looted.slice(), charges: V.charges.slice(), ate: V.ate, recognized: V.recognized, crouch: V.crouch,
        scene: V.scene && V.scene.def ? V.scene.def.id : null, converted: V.converted || null, caughtBy: (V.caughtBy || []).slice(), wet: V.wetSteps | 0,
        favour: !!V.favour, job: V.job ? { type: V.job.type, done: V.job.done, paid: V.job.paid } : null };
    if (ctx.G && V.hint) ctx.G.hint = V.hint;
    VISIT.cur = null;
    DEF.name = "a house"; DEF.title = "🏠 A HOUSE";
    if (ctx.interiors.home) ctx.interiors.home.name = DEF.name;
    try { if (ctx.party && ctx.party.active && ctx.party.presence) ctx.party.presence(null); } catch (e) { /* no party */ }
}

/** Tests: resident `kind` notices her right now (the full "!" — or whatever that person does instead: stage.js CATCH). */
export function debugSpot(kind) { const c = VISIT.cur; const r = c && c.V.res.find(q => q.kind === kind); if (!r) return false; r.meter = 1; spot(c.rt, r); return true; }
/** Tests / debug: the live room's state. */
export function roomInfo() {
    const c = VISIT.cur;
    if (!c || !c.rt || !c.rt.ready) return null;
    const V = c.V;
    return { name: V.home.name, mode: V.mode, crouch: V.crouch, rooms: V.rooms.map(r => r.type), held: V.held, spotted: V.spotted, reported: V.reported, callT: V.callT,
        scene: V.scene && V.scene.def ? V.scene.def.id : null, converted: V.converted || null, noPhone: V.noPhone, catching: V.catching || null,
        job: V.job ? { type: V.job.type, done: V.job.done, paid: V.job.paid, left: V.job.left, chaos: V.job.chaos } : null,
        cols: c.rt.cols.map(q => ({ id: q.id, x0: q.x0, x1: q.x1, z0: q.z0, z1: q.z1 })), bounds: Object.assign({}, c.rt.bounds),
        res: V.res.map(r => ({ id: r.id, kind: r.kind, state: r.state, sit: !!r.sit, sleep: !!r.sleep, lie: !!r.lie, y: +r.p.obj.position.y.toFixed(2), meter: +r.meter.toFixed(2), stun: +Math.max(0, r.stun).toFixed(2), fx: r.fx, friendly: r.friendly, x: +r.p.obj.position.x.toFixed(2), z: +r.p.obj.position.z.toFixed(2),
            cone: !!(r.cone && r.cone.visible), ind: r.ind.sp.visible ? r.ind.key.replace(/\d+$/, "") : "" })),
        items: Object.keys(V.items), lulu: { x: c.rt.lulu.obj.position.x, z: c.rt.lulu.obj.position.z }, windows: V.windows, phone: V.phone, used: V.used.slice(), looted: V.looted.slice() };
}
export { DEF };
