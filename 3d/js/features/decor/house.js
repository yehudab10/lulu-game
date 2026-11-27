// features/decor/house.js — 🏠 LULU'S OWN HOUSE, from the inside (the interiors engine, like a town house).
//
// Three rooms in a row, dollhouse-style (the front wall cut away): the KITCHEN (Ima at the stove), the LIVING
// ROOM (the front door, the family couch, the TV, the family photos) and LULU'S ROOM (the bed, a shelf, the
// nightstand lamp, a rug, wall art — and a sign for Dina). Roadmap 23 (ci/moveout): it's IMA'S house — nothing here is
// decorated (every slot shows Ima's own first option); her bought things sit in boxes in her room and the hints that
// she should get her own place grow with the days she's played — both from moveout.js (`ctx.moveout.build(rt, B)`).
// The furniture is homes' kit (homes_kit.glb) + boxes; the decorations are props.js. Built in ONE frame behind
// the soft cut (the door warmed it — interiors engine › Flow).
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import { save3d } from "../../core/save.js";
import { textPlane } from "../../core/sets.js";
import * as H from "../../hud.js";
import { defineInterior, pick } from "../interiors/engine.js";
import { sfx } from "../interiors/fx.js";
import { SLOTS, slotById, optOf, LINES } from "./data.js";
import { buildOption, disposeObj, wallTex, couchCover, Kit, animate } from "./props.js";
import { dissolve } from "../../core/transition.js";

const W = 6.2, D = 5.6, WALL = 2.7;
const KCX = -W, LCX = 0, RCX = W;          // kitchen · living room · Lulu's room (centres)
const X0 = -1.5 * W, X1 = 1.5 * W;
const DOOR_X = LCX + 1.4;
const DINA_DOOR_Z = -1.1;                  // the door to Dina's room: the far (+x) wall of Lulu's room

/** Where each inside slot's hotspot is (room metres) + what the camera leans toward while picking. */
const SPOTS = {
    bed: { x: RCX - 1.7, z: 0.15, r: 1.35, look: [RCX - 1.7, 0.6, -1.7] },
    lamp: { x: RCX - 0.6, z: -1.55, r: 1.05, look: [RCX - 0.4, 1.2, -1.6] },
    art: { x: RCX + 0.8, z: -1.6, r: 1.05, look: [RCX + 0.5, 1.6, -2.6] },
    shelf: { x: RCX + 2.4, z: -1.55, r: 1.05, look: [RCX + 2.3, 0.9, -2.4] },
    rug: { x: RCX + 0.4, z: 0.75, r: 1.2, look: [RCX + 0.4, 0, 0.4] },
    wallpaper: { x: RCX + 2.75, z: 1.0, r: 1.1, look: [RCX + 1.2, 1.4, -1.4] },
    couch: { x: LCX - 0.8, z: -1.25, r: 1.35, look: [LCX - 0.8, 0.5, -2.0] },
    door: { x: DOOR_X, z: D / 2 - 0.75, r: 1.3, look: [DOOR_X, 1.0, D / 2] },
};

let API = null;            // index.js hands us the decor service (owns / placed / buy / place / preview hooks)
export function bindHouse(api) { API = api; }
let RT = null;             // the room while she's inside
export const houseRoom = () => RT;

const DEF = defineInterior({
    id: "luluHome", name: "Home", short: "home", emoji: "🏠", title: "🏠 HOME SWEET HOME", model: "homesKit",
    tagline: "Ima's house — dinner's at seven", models: ["imaPerson", "dinaPerson"], music: "../story-relax.mp3",
    light: "indoor", cam: { dist: 7.4, height: 5.8, lookY: 0.8, clampX: 2.6 }, walkSpeed: 3.5,
    build, tick, dispose,
});
export const HOUSE_ID = DEF.id;

function kit(name) {
    const src = models.homesKit && findNodes(models.homesKit, "Kit_" + name)[0];
    if (!src) return new THREE.Group();
    const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
    return c;
}
/** Give a cloned kit piece its own copies of the named materials (so recolouring it never touches the shared kit). */
function ownMats(rt, obj, names) {
    const out = {};
    obj.traverse(o => {
        if (!o.isMesh || !names.includes(o.material.name)) return;
        if (!out[o.material.name]) { out[o.material.name] = o.material.clone(); rt.own(out[o.material.name]); }
        o.material = out[o.material.name];
    });
    return out;
}

// ── build ────────────────────────────────────────────────────────────────
function build(rt) {
    RT = rt;
    if (ctx.G) ctx.G.hint = null;           // (the home start's "walk to your car" hint isn't for in here)
    rt.root.visible = false;            // (the kit: pieces are cloned out of it)
    const V = rt.data.V = { objs: {}, cache: {}, pick: null, said: 0, buzz: null, light: null, discoT: 0 };
    const M = (c, o = {}) => rt.own(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o)));
    const box = (w, h, d, mat, x, y, z) => { const g = rt.own(new THREE.BoxGeometry(w, h, d)); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = h > 1; rt.add(m); return m; };
    rt.bounds = { x0: X0 + 0.3, x1: X1 - 0.3, z0: -D / 2 + 0.3, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });

    // floors + walls
    const kitchenWall = M("#FFF1D6"), livingWall = M("#F3E5D0"), trim = M("#FFFFFF");
    const wood = M("#B58457", { roughness: 0.7 }), wood2 = M("#C79A6A", { roughness: 0.7 });
    const tiles = M("#ffffff", { map: rt.own(tileTex()) });
    V.wallM = M("#ffffff", { map: wallTex(curOpt("wallpaper").wall), roughness: 0.9 });
    box(W, 0.06, D, tiles, KCX, -0.03, 0);
    box(W, 0.06, D, wood, LCX, -0.03, 0);
    box(W, 0.06, D, wood2, RCX, -0.03, 0);
    box(W, WALL, 0.14, kitchenWall, KCX, WALL / 2, -D / 2 - 0.07);
    box(W, WALL, 0.14, livingWall, LCX, WALL / 2, -D / 2 - 0.07);
    box(W, WALL, 0.14, V.wallM, RCX, WALL / 2, -D / 2 - 0.07);
    for (const cx of [KCX, LCX, RCX]) box(W, 0.12, 0.05, trim, cx, 0.06, -D / 2 + 0.03);
    col("back", X0 - 1, X1 + 1, -D / 2 - 0.4, -D / 2 + 0.12);
    box(0.14, WALL, D, kitchenWall, X0, WALL / 2, 0);
    box(0.14, WALL, D, V.wallM, X1, WALL / 2, 0);
    // partitions with a doorway (gap at z ∈ [g0, g1])
    const g0 = -0.1, g1 = 1.3;
    [[X0 + W, kitchenWall, livingWall], [X0 + 2 * W, livingWall, V.wallM]].forEach(([x, mL, mR], i) => {
        for (const [za, zb] of [[-D / 2, g0], [g1, D / 2]]) {
            box(0.06, WALL, zb - za, mL, x - 0.03, WALL / 2, (za + zb) / 2);
            box(0.06, WALL, zb - za, mR, x + 0.03, WALL / 2, (za + zb) / 2);
            col("p" + i + za, x - 0.1, x + 0.1, za, zb);
        }
        box(0.12, 0.3, g1 - g0, trim, x, WALL - 0.15, (g0 + g1) / 2);
    });
    // the front: a low cut-away wall with the front door in the living room
    box(DOOR_X - 0.62 - X0, 0.5, 0.12, trim, (X0 + DOOR_X - 0.62) / 2, 0.25, D / 2);
    box(X1 - DOOR_X - 0.62, 0.5, 0.12, trim, (DOOR_X + 0.62 + X1) / 2, 0.25, D / 2);
    col("f1", X0 - 1, DOOR_X - 0.62, D / 2 - 0.12, D / 2 + 1);
    col("f2", DOOR_X + 0.62, X1 + 1, D / 2 - 0.12, D / 2 + 1);
    const door = kit("Door"); door.position.set(DOOR_X, 0, D / 2); rt.add(door);
    V.doorM = ownMats(rt, door, ["DoorWood"]).DoorWood || null;
    rt.spots.door = { x: DOOR_X, z: D / 2 - 0.8, ry: Math.PI };
    // windows (kitchen + living room: dark glass at night)
    const night = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0;
    for (const wx of [KCX - 1.6, LCX + 0.9]) {
        const w = kit("Window"); w.position.set(wx, 1.55, -D / 2); rt.add(w);
        if (night > 0.4) w.traverse(o => { if (o.isMesh && /Glass/.test(o.material.name)) { o.material = o.material.clone(); o.material.color.set("#1B2440"); rt.own(o.material); } });
    }

    // ── furniture ──
    const put = (name, x, z, ry = 0, cw = 0, cd = 0) => {
        const o = kit(name); o.position.set(x, 0, z); o.rotation.y = ry; rt.add(o);
        o.traverse(m => { if (m.isMesh) m.castShadow = false; });
        if (cw) { const sw = Math.abs(Math.cos(ry)) > 0.5, hw = (sw ? cw : cd) / 2, hd = (sw ? cd : cw) / 2; col(name, x - hw, x + hw, z - hd, z + hd); }
        return o;
    };
    const bz = -D / 2;
    // kitchen
    put("Counter", KCX - 0.35, bz + 0.35, 0, 2.6, 0.66);
    put("Stove", KCX + 1.4, bz + 0.38, 0, 0.8, 0.7);
    put("Fridge", KCX + 2.5, bz + 0.4, 0, 0.82, 0.74);
    put("KitchenTable", KCX - 1.3, 0.9, 0, 1.2, 1.2);
    put("Chair", KCX - 1.3, 1.75, Math.PI); put("Chair", KCX - 2.15, 0.9, Math.PI / 2);
    // the kugel on the table (there is ALWAYS kugel)
    const kg = new Kit();
    kg.box(0.36, 0.1, 0.28, "#E6B055", KCX - 1.3, 0.83, 0.9); kg.box(0.37, 0.025, 0.29, "#B8742E", KCX - 1.3, 0.885, 0.9);
    kg.box(0.44, 0.03, 0.34, "#ECEFF1", KCX - 1.3, 0.775, 0.9);
    rt.add(kg.build("Kugel"));
    // living room
    put("Rug", LCX - 0.8, 0.2);
    V.couch = put("Couch", LCX - 0.8, bz + 0.75, 0, 2.2, 0.9);
    V.couchM = ownMats(rt, V.couch, ["Fabric", "Cushion"]);
    V.couchPos = V.couch.position.clone();
    put("CoffeeTable", LCX - 0.8, 0.45, 0, 1.1, 0.6);
    put("TV", LCX - 2.7, 0.9, Math.PI / 2, 1.4, 0.45);
    put("FloorLamp", LCX + 0.75, bz + 0.45, 0, 0.3, 0.3);
    put("Plant", LCX + 2.75, bz + 0.5, 0, 0.4, 0.4);
    put("CoatRack", DOOR_X + 1.0, D / 2 - 0.55, 0, 0.4, 0.4);
    const ph = kit("Picture"); ph.position.set(LCX - 0.8, 1.75, -D / 2); rt.add(ph);
    const ph2 = kit("Picture"); ph2.position.set(LCX + 2.2, 1.6, -D / 2); ph2.scale.setScalar(0.8); rt.add(ph2);
    // Lulu's room: the nightstand, the shelf unit, the sign
    const fur = new Kit();
    fur.box(0.5, 0.5, 0.4, "#FAFAFA", RCX - 0.6, 0.27, -2.45);
    fur.box(0.18, 0.02, 0.01, "#FFB3D6", RCX - 0.6, 0.36, -2.24);
    fur.box(0.95, 1.65, 0.04, "#FAFAFA", RCX + 2.4, 0.83, -2.74);
    for (const s of [-1, 1]) fur.box(0.04, 1.65, 0.38, "#FAFAFA", RCX + 2.4 + s * 0.455, 0.83, -2.57);
    for (const y of [0.05, 0.55, 1.05, 1.55, 1.65]) fur.box(0.95, 0.04, 0.38, "#FAFAFA", RCX + 2.4, y, -2.57);
    fur.box(0.16, 0.1, 0.1, "#FF4F9A", RCX - 0.75, 0.57, -2.4);
    fur.box(0.12, 0.07, 0.02, "#212121", RCX - 0.75, 0.58, -2.34);
    rt.add(fur.build("LuluFurniture"));
    col("night", RCX - 0.85, RCX - 0.35, -2.8, -2.25);
    col("shelf", RCX + 1.92, RCX + 2.88, -2.8, -2.36);
    col("bed", RCX - 2.32, RCX - 1.08, -2.8, -0.62);
    const sign = textPlane(["LULU'S ROOM 💖", "DINA: KNOCK FIRST!!"], { w: 1.5, h: 0.42, bg: "#FFE3EF", fg: "#AD1457", font: 58 });
    sign.position.set(RCX - 0.4, 2.35, -D / 2 + 0.01);
    rt.own(sign.material, sign.material.map);
    rt.add(sign);
    // the door to DINA'S ROOM (her mode's way in while its title tile is hidden — the owner, 2026-11-22): on the far
    // wall of Lulu's room, with her sign on it. ✋ → her bedroom (features/dina), and back out = home (onegame).
    const dd = kit("Door"); dd.position.set(X1 - 0.04, 0, DINA_DOOR_Z); dd.rotation.y = -Math.PI / 2; rt.add(dd);
    const dm = ownMats(rt, dd, ["DoorWood"]).DoorWood;
    if (dm) dm.color.set("#F8BBD0");
    const ds = textPlane(["DINA'S ROOM 🦄", "(LULU MAY ENTER)"], { w: 1.05, h: 0.34, bg: "#FFFDE7", fg: "#6A1B9A", font: 52 });
    ds.position.set(X1 - 0.09, 2.38, DINA_DOOR_Z); ds.rotation.y = -Math.PI / 2;
    rt.own(ds.material, ds.material.map);
    rt.add(ds);
    rt.hot({ id: "dinaRoom", x: X1 - 0.75, z: DINA_DOOR_Z, r: 1.05, label: "👧 Dina's room — play as Dina", enabled: () => dinaRoomOpen(), action: dinaRoom });
    // one warm ceiling light in her room (the disco ball / neon tint it); off on LOW graphics
    const low = ctx.gfx ? ctx.gfx.tier === "low" : save3d.settings.quality === "low";
    if (!low) { V.light = new THREE.PointLight("#FFE6C7", 4, 7, 1.6); V.light.position.set(RCX + 0.4, 2.3, 0.2); rt.add(V.light); rt.lightsList.push(V.light); }

    // ── the way Ima keeps it (every slot's own first option — nobody decorates Ima's house) ──
    for (const s of SLOTS) if (s.where === "inside" || s.id === "door") show(s.id, s.opts[0].id);
    // ── her boxes + the move-out hints (moveout.js) ──
    let said = null;
    try { said = ctx.moveout && ctx.moveout.build ? ctx.moveout.build(rt, { col, put, box, M, kit, RCX, LCX, KCX, D, W, WALL, X1, DOOR_X, bz: -D / 2 }) : null; } catch (e) { console.error("[decor] moveout", e); }

    // ── her closet (features/clothes): changing only — nothing here is decorated (on the far wall, front of Dina's door) ──
    try { if (ctx.clothes && ctx.clothes.placeCloset) ctx.clothes.placeCloset(rt, { x: X1 - 0.33, z: 0.62, ry: -Math.PI / 2, col, where: "ima" }); } catch (e) { console.error("[decor] closet", e); }

    // ── people: Ima at the stove ──
    try {
        rt.person("ima", "imaPerson", { x: KCX + 1.2, z: -1.05, ry: 0.3 }, { name: "Ima", pose: {} });
        rt.hot({ id: "ima", who: "ima", track: true, r: 1.6, label: "💬 Talk to Ima", action: talkIma });
    } catch (e) { console.warn("[decor] ima", e); }
    // …and Dina in the living room, watching TV from the floor (two or three lines, no rewards)
    try {
        rt.person("dina", "dinaPerson", { x: LCX - 1.9, z: 1.15, ry: -Math.PI / 2 }, { name: "Dina", pose: {} });
        rt.hot({ id: "dina", who: "dina", track: true, r: 1.5, label: "💬 Talk to Dina", action: talkDina });
    } catch (e) { console.warn("[decor] dina", e); }

    // ── the front door (no redecorate spots — roadmap 23) ──
    rt.hot({ id: "door", x: SPOTS.door.x, z: SPOTS.door.z, r: SPOTS.door.r, label: "🚪 Front door", action: frontDoor });
    // Lulu: in through the front door
    rt.lulu.obj.position.set(DOOR_X, 0, D / 2 - 0.9);
    rt.lulu.obj.rotation.y = Math.PI;
    V.first = !API || !API.visits();
    if (API) API.visited();
    rt.wait(0.9).then(() => {
        if (rt.disposed) return;
        const ima = rt.byId.ima;
        // (one line from Ima per visit: the move-out stage's, else her usual)
        if (ima) rt.bubble(said || pick(LINES.ima), ima.p.obj, 3.2);
    });
}

function curOpt(slot) { const s = slotById(slot); return optOf(s, API ? API.placed(slot) : s.opts[0].id) || s.opts[0]; }

/** Show an option in its slot (a preview or the real thing). Cached per open picker; the old one is hidden. */
function show(slot, optId) {
    const rt = RT, V = rt && rt.data.V;
    if (!V) return;
    const s = slotById(slot), o = optOf(s, optId) || s.opts[0];
    if (slot === "wallpaper") { V.wallM.map = wallTex(o.wall); V.wallM.color.set("#ffffff"); return; }
    if (slot === "door") {
        if (V.doorM) { V.doorM.color.set(o.color); V.doorM.metalness = o.metal || 0; V.doorM.roughness = o.metal ? 0.3 : 0.6; }
        return;
    }
    if (slot === "couch") {
        const c = o.couch || {};
        if (V.couchM.Fabric) V.couchM.Fabric.color.set(c.fab || "#7E57C2");
        if (V.couchM.Cushion) V.couchM.Cushion.color.set(c.cush || "#9575CD");
        if (c.cover && !V.cover) { const k = new Kit(); couchCover(k, V.couchPos.x, V.couchPos.z); V.cover = rt.add(k.build("CouchCover")); }
        if (V.cover) V.cover.visible = !!c.cover;
        V.buzz = c.buzz ? 1 : 0;
        if (!c.buzz) V.couch.position.copy(V.couchPos);
        return;
    }
    const cache = V.cache[slot] || (V.cache[slot] = {});
    if (!(o.id in cache)) {
        const obj = buildOption("inside", slot, o.id);
        if (obj) { obj.position.x = RCX; rt.add(obj); }
        cache[o.id] = obj;
    }
    for (const k of Object.keys(cache)) if (cache[k]) cache[k].visible = k === o.id;
    V.objs[slot] = cache[o.id];
    if (slot === "lamp") V.lampMode = o.id;
}
async function frontDoor(rt) {
    const i = await rt.choose("🚪 Front door", "Heading out?", ["🚪 Head outside", "💬 Stay in"], { emoji: "🏠" });
    if (i === 0) rt.leave();
}
async function talkIma(rt) {
    const V = rt.data.V;
    const extra = ctx.moveout && ctx.moveout.imaLines ? ctx.moveout.imaLines() : [];
    const lines = extra.length && V.said % 2 === 0 ? extra : LINES.ima;
    V.said++;
    await rt.say("Ima", pick(lines), { emoji: "👩", person: rt.byId.ima });
}

/** Dina's room is open: solo (not a visit with friends) and her mode is in this build. */
const dinaRoomOpen = () => (!API || API.allowed()) && !!(ctx.dina && ctx.dina.start && ctx.onegame && ctx.onegame.dina);
async function dinaRoom(rt) {
    if (!dinaRoomOpen()) return;
    const i = await rt.choose("👧 Dina's room", "\"KNOCK FIRST!!\" …it's open. Dina's stuff is everywhere.", ["👧 Play as Dina", "💬 Not now"], { emoji: "🦄" });
    if (i !== 0 || rt.disposed) return;
    rt.busy = true;
    dissolve(() => { if (!ctx.onegame.dina({ via: "room", room: true })) rt.busy = false; }, { ms: 500 });
    setTimeout(() => { if (!rt.disposed) rt.busy = false; }, 5000);      // (her room didn't load: carry on inside)
}
async function talkDina(rt) {
    const V = rt.data.V;
    V.dinaSaid = (V.dinaSaid || 0) + 1;
    const lines = V.dinaSaid === 1 ? ["Shhh! This is the part where the dog finds the cat. 📺", ...LINES.dina] : LINES.dina;
    await rt.say("Dina", pick(lines), { emoji: "👧", person: rt.byId.dina });
}

function tick(rt, dt) {
    const V = rt.data.V;
    if (!V) return;
    for (const k of ["lamp"]) animate(V.objs[k], rt.t, dt);
    if (V.buzz && V.couch) {
        V.couch.position.set(V.couchPos.x + Math.sin(rt.t * 61) * 0.006, 0, V.couchPos.z + Math.cos(rt.t * 47) * 0.006);
    }
    if (V.light) {
        if (V.lampMode === "disco") { V.discoT += dt; V.light.color.setHSL((V.discoT * 0.25) % 1, 0.9, 0.6); V.light.intensity = 7; }
        else if (V.lampMode === "neon") { V.light.color.set("#FFB3E0"); V.light.intensity = 5; }
        else if (V.lampMode === "lava") { V.light.color.set("#FFC9A8"); V.light.intensity = 4.5; }
        else { V.light.color.set("#FFE6C7"); V.light.intensity = 4; }
    }
}
function dispose(rt) {
    // (the set frees geometries; the pictures' own materials are ours to free)
    const V = rt && rt.data.V;
    if (V) for (const c of Object.values(V.cache)) for (const o of Object.values(c)) if (o) o.traverse(m => { if (m.isMesh && m.userData.ownMaterial) m.material.dispose(); });
    RT = null;
}

// ── tiles for the kitchen floor ──
function tileTex() {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d");
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? "#F4C6D6" : "#FFFFFF"; g.fillRect(i * 32, j * 32, 32, 32); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 5); t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

// (tests) the room's slot spots
export const HOUSE_SPOTS = SPOTS;
on("interior:exit", ({ id }) => { if (id === DEF.id) RT = null; });
