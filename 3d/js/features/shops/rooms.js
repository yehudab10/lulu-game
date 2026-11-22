// features/shops/rooms.js — 🍕 WALK-IN SHOPS: the town's pizza shop (Lakewood: PIZZA SHMIZZA · Midwood: SLICE OF SINAI)
// and Midwood's bakery (the CHALLAH-DAY INN) are real rooms now — ✋ at the door (warmed as she walks up: a soft cut)
// → the interiors engine: a counter with the oven / the display case, a menu board, a few tables, townsfolk in a line
// and at a table, the guy behind the counter. Something small to buy at the counter: a slice / a rugelach — it costs
// coins (never free) and heals ONE heart, once a run across every shop (`G.shopsSnack`); after that she's "full".
// The rooms are SHARED with friends in a party (features/together/rooms.js SHARED: one per town) — purchases personal.
// Built from boxes (no Blender set): the engine's model is `shops_roomkit` (two empties: the door + where she starts).
import * as THREE from "three";
import { ctx, on, emit, setState } from "../../core/ctx.js";
import { models } from "../../models.js";
import { heal } from "../../core/driving.js";
import * as H from "../../hud.js";
import { defineInterior, pool, pick } from "../interiors/engine.js";
import { canvasPlane, drawLines, sfx } from "../interiors/fx.js";
import { ROOMS } from "./data.js";

// ── the "set": two empties (the room is built in build()) ───────────────
const DOOR = { x: 3.2, z: 3.0 };
function roomKit() {
    const g = new THREE.Group();
    g.name = "ShopsRoomKit";
    const d = new THREE.Object3D(); d.name = "Spot_door"; d.position.set(DOOR.x, 0, DOOR.z); d.rotation.y = Math.PI; g.add(d);
    const l = new THREE.Object3D(); l.name = "Spot_lulu"; l.position.set(DOOR.x, 0, DOOR.z - 0.9); l.rotation.y = Math.PI; g.add(l);
    return g;
}
models.shops_roomkit = models.shops_roomkit || roomKit();

const inTown = () => !!(ctx.town && ctx.town.active);
const townId = () => (inTown() && ctx.town.id) || "lakewood";
const W = 10, D = 7.2, WALL = 3.0;

/** What she can buy at a counter: one snack a run, across every shop (a heart, never free coins). */
function snack(rt, R) {
    const G = ctx.G || {};
    const o = rt.byId.server ? rt.byId.server.p.obj : null;
    if (G.shopsSnack) { rt.bubble(pick(R.full), rt.lulu.obj, 2.4); return; }
    if (!rt.pay(R.snack.price)) { rt.bubble(pick(R.poor), o || rt.lulu.obj, 2.6); sfx.deny(); return; }
    G.shopsSnack = true;
    const hurt = G.hearts != null && G.hearts < (G.maxHearts || 3);
    if (hurt) heal(1);
    H.toast(`${R.snack.icon} ${R.snack.name}${hurt ? " · +1 ❤️" : " — delicious"}`, "gold", { prio: 3, key: "shopsSnack" });
    rt.luluPose = { sit: false };
    rt.burst({ x: rt.lulu.obj.position.x, y: 1.4, z: rt.lulu.obj.position.z }, ["#FFD54F", "#FF7043", "#FFFFFF"], 12, 1.6, 0.05);
    if (o) rt.bubble(pick(R.served), o, 2.6);
    setTimeout(() => { if (!rt.disposed) rt.bubble(pick(R.yum), rt.lulu.obj, 2.4); }, 900);
    emit("stat", { id: "shopsSnacks", n: 1 });
    emit("shops:snack", { place: rt.def.id, healed: hurt });
}

function build(rt, kind) {
    const R = ROOMS[kind][townId()] || ROOMS[kind].lakewood || ROOMS[kind].midwood;
    if (ctx.G) ctx.G.hint = null;          // (the street's "find a car to borrow" hint isn't for in here)
    const M = (c, o = {}) => rt.own(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85 }, o)));
    const box = (w, h, d, mat, x, y, z) => { const g = rt.own(new THREE.BoxGeometry(w, h, d)); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.receiveShadow = true; rt.add(m); return m; };
    const cyl = (r0, r1, h, mat, x, y, z, seg = 16) => { const g = rt.own(new THREE.CylinderGeometry(r0, r1, h, seg)); const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); rt.add(m); return m; };
    rt.bounds = { x0: -W / 2 + 0.35, x1: W / 2 - 0.35, z0: -D / 2 + 0.4, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });

    // floor (checkerboard), walls, the cut-away front with the door
    const tile = canvasPlane(rt.set, 2, 2, (g, w, h) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? R.floor[0] : R.floor[1]; g.fillRect(i * s, j * s, s, s); } }, { px: 256 });
    const ftex = tile.mesh.material.map;
    ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(W / 2, D / 2);
    box(W, 0.06, D, M("#ffffff", { map: ftex }), 0, -0.03, 0);
    const wallM = M(R.wall), trim = M(R.trim);
    box(W, WALL, 0.14, wallM, 0, WALL / 2, -D / 2 - 0.07);
    box(0.14, WALL, D, wallM, -W / 2, WALL / 2, 0);
    box(0.14, WALL, D, wallM, W / 2, WALL / 2, 0);
    box(W, 0.35, 0.16, trim, 0, WALL - 0.2, -D / 2 + 0.02);
    box(DOOR.x - 0.7 + W / 2, 0.55, 0.12, trim, (-W / 2 + DOOR.x - 0.7) / 2, 0.27, D / 2);
    box(W / 2 - DOOR.x - 0.7, 0.55, 0.12, trim, (DOOR.x + 0.7 + W / 2) / 2, 0.27, D / 2);
    col("back", -W, W, -D / 2 - 0.5, -D / 2 + 0.1);
    col("f1", -W, DOOR.x - 0.7, D / 2 - 0.12, D / 2 + 1); col("f2", DOOR.x + 0.7, W, D / 2 - 0.12, D / 2 + 1);

    // the counter (+ the oven / the display case) along the back
    const cx = -1.2, cz = -D / 2 + 1.5;
    box(5.6, 1.0, 0.8, M(R.counter), cx, 0.5, cz);
    box(5.8, 0.08, 0.95, M("#ECEFF1", { roughness: 0.4 }), cx, 1.04, cz);
    col("counter", cx - 2.9, cx + 2.9, cz - 0.5, cz + 0.45);
    if (kind === "pizza") {
        // the brick oven (a glowing mouth) + pies on the counter
        cyl(1.05, 1.25, 1.5, M("#B5654F"), -4.0, 0.75, -D / 2 + 0.9, 14);
        const mouth = box(0.8, 0.45, 0.1, M("#FF7043", { emissive: "#FF5722", emissiveIntensity: 1.4 }), -4.0, 0.75, -D / 2 + 2.0);
        rt.data.mouth = mouth;
        col("oven", -5, -2.9, -D / 2, -D / 2 + 2.1);
        for (const [x, c] of [[-2.6, "#FFB74D"], [-1.4, "#FFA726"], [-0.2, "#FFCC80"]]) {
            cyl(0.36, 0.36, 0.04, M("#D7B98E"), x, 1.1, cz, 20);
            cyl(0.32, 0.32, 0.03, M(c), x, 1.13, cz, 20);
        }
    } else {
        // the glass display case of challahs + rugelach
        box(2.2, 0.6, 0.7, M("#BFE3F2", { transparent: true, opacity: 0.45, roughness: 0.1 }), cx + 1.4, 1.38, cz);
        for (let i = 0; i < 4; i++) { const ch = cyl(0.11, 0.11, 0.5, M("#C68B3E"), cx + 0.6 + i * 0.5, 1.2, cz, 8); ch.rotation.z = Math.PI / 2; }
        for (let i = 0; i < 6; i++) box(0.12, 0.08, 0.12, M("#8D5524"), cx - 1.6 + (i % 3) * 0.2, 1.12, cz - 0.15 + Math.floor(i / 3) * 0.25);
        box(1.6, 1.8, 0.5, M("#8D6E63"), -4.0, 0.9, -D / 2 + 0.4);   // bread racks
        col("racks", -5, -3.1, -D / 2, -D / 2 + 0.8);
    }
    // the menu board on the back wall (+ the "now serving" gag)
    const menu = canvasPlane(rt.set, 3.6, 1.3, (g, w, h) => {
        g.fillStyle = "#1B1B1B"; g.fillRect(0, 0, w, h);
        drawLines(g, R.menu.join("\n"), w / 2, h / 2, Math.round(h / (R.menu.length + 1.2)), "#FFE082", { maxW: w * 0.94 });
    }, { px: 512 });
    rt.add(menu.mesh); menu.mesh.position.set(cx, 2.25, -D / 2 + 0.02);

    // tables + chairs
    const wood = M("#8D6E63"), seat = M(R.chair);
    for (const [x, z] of [[-3.4, 1.2], [-0.8, 1.9], [1.6, 0.9]]) {
        cyl(0.55, 0.55, 0.06, wood, x, 0.76, z, 18); cyl(0.06, 0.06, 0.74, wood, x, 0.37, z, 8);
        for (const a of [0, Math.PI]) box(0.42, 0.45, 0.42, seat, x + Math.cos(a) * 0.85, 0.23, z + Math.sin(a) * 0.15);
        col("t" + x, x - 0.6, x + 0.6, z - 0.6, z + 0.6);
    }

    // people: the server behind the counter, a line, someone eating at a table
    rt.person("server", R.server.key, { x: cx - 0.2, z: cz - 0.75, ry: 0 }, { name: R.server.name, colors: R.server.colors });
    const line = R.line.map((p, i) => rt.person("line" + i, p.key, { x: cx + 1.1 + i * 0.85, z: cz + 1.05 + i * 0.25, ry: Math.PI + 0.2 }, { name: p.name, colors: p.colors, faceLulu: false }));
    rt.person("eater", R.eater.key, { x: -3.4 + 0.85, z: 1.2 + 0.15, ry: -Math.PI / 2 }, { name: R.eater.name, colors: R.eater.colors, pose: { sit: true }, faceLulu: false, collide: false, y: 0.05 });
    const LINE = pool(R.lineLines), EATER = pool(R.eaterLines), SERVER = pool(R.serverLines);
    rt.hot({ id: "counter", x: cx - 0.2, z: cz + 0.95, who: "server", r: 1.3, label: () => (ctx.G && ctx.G.shopsSnack ? `${R.snack.icon} ${R.snack.name} — you're full` : `${R.snack.icon} ${R.snack.name} · ${R.snack.price} 💰`),
        action: () => snack(rt, R) });
    rt.hot({ id: "line", x: line[0].home.x + 0.3, z: line[0].home.z + 0.8, who: "line0", r: 1.2, label: "💬 Ask the line how long",
        action: () => rt.bubble(LINE(), line[0].p.obj, 3) });
    rt.hot({ id: "eater", x: -3.4 + 0.2, z: 2.3, who: "eater", r: 1.2, label: `💬 Talk to the ${R.eater.name.toLowerCase()}`,
        action: () => rt.bubble(EATER(), rt.byId.eater.p.obj, 3) });
    rt.hot({ id: "wall", x: 4.0, z: -2.4, r: 1.1, label: R.wall2.label, action: () => rt.bubble(pick(R.wall2.lines), rt.lulu.obj, 3) });
    // (the wall of fame / the tzedakah box)
    const fame = canvasPlane(rt.set, 1.4, 1.0, (g, w, h) => { g.fillStyle = "#FFF8E1"; g.fillRect(0, 0, w, h); g.strokeStyle = "#6D4C41"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); drawLines(g, R.wall2.sign, w / 2, h / 2, Math.round(h / 5), "#4E342E"); }, { px: 256 });
    rt.add(fame.mesh); fame.mesh.position.set(W / 2 - 0.08, 1.7, -2.4); fame.mesh.rotation.y = -Math.PI / 2;
    rt.every(6, 11, () => { const s = rt.byId.server; if (s && !rt.busy) rt.bubble(SERVER(), s.p.obj, 2.6); });
}
function tick(rt, dt) {
    const m = rt.data.mouth;
    if (m) m.material.emissiveIntensity = 1.2 + Math.sin(rt.t * 7) * 0.25 + Math.sin(rt.t * 13) * 0.15;
}

export const pizzaDef = defineInterior({
    id: "shopsPizza", name: "the pizza shop", short: "the pizza shop", emoji: "🍕", title: "🍕 PIZZA SHMIZZA", model: "shops_roomkit",
    tagline: "the line is the experience", models: ["npcMan", "npcWoman", "npcKid"], light: "indoor",
    cam: { dist: 7.6, height: 5.6, lookY: 0.8, clampX: 2.6 }, walkSpeed: 3.5,
    build: rt => build(rt, "pizza"), tick,
});
export const bakeryDef = defineInterior({
    id: "shopsBakery", name: "the bakery", short: "the bakery", emoji: "🥖", title: "🥖 CHALLAH-DAY INN", model: "shops_roomkit",
    tagline: "braided fresh since whenever", models: ["npcMan", "npcWoman", "town_mom"], light: "indoor",
    cam: { dist: 7.6, height: 5.6, lookY: 0.8, clampX: 2.6 }, walkSpeed: 3.5,
    build: rt => build(rt, "bakery"),
});

// ── the doors in town (✋, warmed on the way up: a soft cut) ─────────────
const DOORS = { pizza: { def: pizzaDef, spot: "pizza" }, bakery: { def: bakeryDef, spot: "bakery" } };
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
function canWalkIn() {
    if (!inTown() || ctx.state !== "footRun" || !ctx.interiors) return false;
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (party && !roam) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
const OUT = { at: null, t: 0 };
function doorPos(kind) {
    if (!canWalkIn()) return null;
    const sp = ctx.town.spot(DOORS[kind].spot), p = herPos();
    if (!sp || !p) return null;
    if (kind === "bakery" && !(ROOMS.bakery[ctx.town.id])) return null;
    // (she just walked out: a ✕ still being mashed mustn't send her straight back in)
    if (OUT.at && ctx.time < OUT.t && Math.hypot(p.x - OUT.at.x, p.z - OUT.at.z) < 4) return null;
    const d = Math.hypot(sp.x - p.x, sp.z - p.z);
    if (d < 24) { const I = ctx.interiors[DOORS[kind].def.id]; if (I && I.warm) I.warm(); }
    return d < 30 ? { x: sp.x, z: sp.z } : null;
}
export function enterShop(kind) {
    const D0 = DOORS[kind], sp = inTown() && ctx.town.spot(D0.spot);
    if (!sp || !ctx.interiors[D0.def.id]) return false;
    // (this town's name on the door: the room's title chip + welcome banner)
    const R = ROOMS[kind][townId()];
    if (R) { D0.def.title = R.title; D0.def.name = R.name; ctx.interiors[D0.def.id].name = R.name; }
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    const dr = { id: kind, s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
    emit("stat", { id: "footInteriors", n: 1 });       // (Ima's "pop into a shop on foot")
    emit("shops:open", { place: kind, town: townId() });
    const exit = () => { setState("footRun", { resume: "interior", door: dr }); OUT.at = { x: sp.x, z: sp.z }; OUT.t = ctx.time + 8; };
    return ctx.interiors[D0.def.id].enter({ exit, door: kind, from: "foot" });
}
on("boot", () => {
    if (!ctx.foot || !ctx.foot.addSpot) return;
    ctx.foot.addSpot({ pos: () => doorPos("pizza"), r: 2.4, short: "PIZZA", label: () => `🍕 GO INTO ${((ROOMS.pizza[townId()] || ROOMS.pizza.lakewood).name).toUpperCase()}`, act: () => enterShop("pizza") });
    ctx.foot.addSpot({ pos: () => doorPos("bakery"), r: 2.4, short: "BAKERY", label: () => `🥖 GO INTO ${((ROOMS.bakery[townId()] || {}).name || "THE BAKERY").toUpperCase()}`, act: () => enterShop("bakery") });
});
on("run:start", () => { if (ctx.G) ctx.G.shopsSnack = false; });

export const roomsDebug = { DOORS, enterShop, canWalkIn, doorPos };
