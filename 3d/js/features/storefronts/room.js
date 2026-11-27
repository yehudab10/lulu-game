// features/storefronts/room.js — THE one-joke shop: ONE small room on the interiors engine, built from boxes (no Blender
// set — like places/roadrooms.js), dressed from the shop's data row (data.js › SHOPS) as she walks in: its colours, the
// sign over the counter, one person behind it with a few lines, and her ONE thing to do (a taste, a browse, a seat — or a
// 5-coin thing, a coin sink through features/garage/buy.js). Every shop uses this same room: nearly free on a phone.
import * as THREE from "three";
import { models } from "../../models.js";
import { ctx, emit } from "../../core/ctx.js";
import { defineInterior, pool } from "../interiors/engine.js";
import { canvasPlane, drawLines, tone } from "../interiors/fx.js";
import { buyExtra } from "../garage/buy.js";

const DOOR = { x: 0, z: 2.9 };
function roomKit() {
    const g = new THREE.Group(); g.name = "StorefrontRoomKit";
    const d = new THREE.Object3D(); d.name = "Spot_door"; d.position.set(DOOR.x, 0, DOOR.z); d.rotation.y = Math.PI; g.add(d);
    const l = new THREE.Object3D(); l.name = "Spot_lulu"; l.position.set(DOOR.x, 0, DOOR.z - 0.9); l.rotation.y = Math.PI; g.add(l);
    return g;
}
models.storefront_roomkit = models.storefront_roomkit || roomKit();
const W = 8, D = 6, WALL = 3.0;

/** The shop she's walking into (index.js sets it just before the door opens): { id, row } */
export const CUR = { id: null, row: null, said: 0 };

// a tiny deterministic hash → 0..1 (the goods on the shelves differ per shop, the same every visit)
function rnd(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; }
function shade(hex, f) { const c = new THREE.Color(hex); c.offsetHSL(0, 0, f); return "#" + c.getHexString(); }

function build(rt) {
    const id = CUR.id, R = CUR.row;
    if (!R) return;
    const [wallC, shelfC, accent] = R.pal || ["#efe6d2", "#8d6e63", "#1a237e"];
    const mats = new Map();
    const M = c => mats.get(c) || (mats.set(c, rt.own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }))), mats.get(c));
    const box = (c, x0, x1, y0, y1, z0, z1) => { const g = rt.own(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)); const m = new THREE.Mesh(g, typeof c === "string" ? M(c) : c); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); m.receiveShadow = true; rt.add(m); return m; };
    rt.bounds = { x0: -W / 2 + 0.35, x1: W / 2 - 0.35, z0: -D / 2 + 0.4, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    const col = (cid, x0, x1, z0, z1) => rt.cols.push({ id: cid, x0, x1, z0, z1, on: true });
    // floor, three walls, the shop window's low wall with the door, a trim line
    const f0 = shade(shelfC, 0.25), f1 = shade(shelfC, 0.18);
    const tile = canvasPlane(rt.set, 2, 2, (g, w) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? f0 : f1; g.fillRect(i * s, j * s, s, s); } }, { px: 128 });
    const ft = tile.mesh.material.map; ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(W / 2, D / 2);
    box(rt.own(new THREE.MeshStandardMaterial({ color: "#ffffff", map: ft, roughness: 0.9 })), -W / 2, W / 2, -0.06, 0, -D / 2, D / 2);
    box(wallC, -W / 2, W / 2, 0, WALL, -D / 2 - 0.14, -D / 2);
    box(wallC, -W / 2 - 0.14, -W / 2, 0, WALL, -D / 2, D / 2);
    box(wallC, W / 2, W / 2 + 0.14, 0, WALL, -D / 2, D / 2);
    box(accent, -W / 2, W / 2, WALL - 0.3, WALL, -D / 2 + 0.02, -D / 2 + 0.1);
    box(accent, -W / 2, DOOR.x - 0.75, 0, 0.6, D / 2 - 0.06, D / 2 + 0.06);
    box(accent, DOOR.x + 0.75, W / 2, 0, 0.6, D / 2 - 0.06, D / 2 + 0.06);
    col("back", -W, W, -D / 2 - 0.5, -D / 2 + 0.1);
    col("f1", -W, DOOR.x - 0.75, D / 2 - 0.12, D / 2 + 1); col("f2", DOOR.x + 0.75, W, D / 2 - 0.12, D / 2 + 1);
    // the back shelves + their goods (colours from the shop's palette, a different pattern per shop)
    const r = rnd(id || "shop");
    for (const [x0, x1] of [[-3.7, -1.2], [1.2, 3.7]]) {
        box(shelfC, x0, x1, 0, 2.3, -D / 2 + 0.02, -D / 2 + 0.5);
        for (const y of [0.55, 1.15, 1.75]) {
            box(shade(shelfC, -0.12), x0, x1, y - 0.04, y, -D / 2 + 0.02, -D / 2 + 0.52);
            for (let x = x0 + 0.12; x < x1 - 0.2; x += 0.22 + r() * 0.18) {
                const h = 0.18 + r() * 0.28, c = r() < 0.5 ? accent : shade(accent, (r() - 0.5) * 0.5);
                box(c, x, x + 0.14 + r() * 0.1, y, y + h, -D / 2 + 0.12, -D / 2 + 0.4);
            }
        }
    }
    col("shelvesL", -3.8, -1.1, -D / 2, -D / 2 + 0.6); col("shelvesR", 1.1, 3.8, -D / 2, -D / 2 + 0.6);
    // the counter (the person stands behind it) + a display table on the left (her ONE thing)
    box(shade(shelfC, -0.05), -1.1, 1.1, 0, 1.0, -1.65, -1.15); box(shade(accent, 0.35), -1.15, 1.15, 1.0, 1.05, -1.7, -1.1);
    col("counter", -1.15, 1.15, -1.75, -1.05);
    box(shade(shelfC, 0.05), -3.6, -2.2, 0, 0.8, -0.2, 0.7); box(accent, -3.65, -2.15, 0.8, 0.84, -0.25, 0.75);
    for (let i = 0; i < 5; i++) box(shade(accent, (r() - 0.5) * 0.6), -3.45 + i * 0.25, -3.3 + i * 0.25, 0.84, 0.95 + r() * 0.18, 0.05 + r() * 0.3, 0.2 + r() * 0.3);
    col("table", -3.7, -2.1, -0.3, 0.8);
    // the shop's own sign over the counter
    const sign = (R.sign || [id]).slice(0, 2);
    const p = canvasPlane(rt.set, 3.0, 0.75, (g, w, h) => { g.fillStyle = shade(wallC, -0.05); g.fillRect(0, 0, w, h); g.fillStyle = accent; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); drawLines(g, `${R.emoji || ""} ${sign[0]}\n${sign[1] || ""}`, w / 2, h / 2, h * 0.26, [accent, shade(accent, 0.1)]); }, { px: 512 });
    p.mesh.position.set(0, 2.45, -D / 2 + 0.06); rt.add(p.mesh);
    rt.pointLight("shop", "#fff4e0", 6, 10).position.set(0, 2.7, 0);
    // the person + the two things to do
    const who = R.who || { key: "npcMan", name: "the owner" };
    rt.person("owner", who.key, { x: 0, z: -2.1, ry: 0 }, { name: who.name, colors: who.colors });
    const hi = pool(R.hi || ["Hello!"]);
    rt.hot({ id: "owner", x: 0, z: -0.6, who: "owner", r: 1.3, label: `${R.emoji || "💬"} Talk to ${who.name}`,
        action: rt => { tone(520, 0.06, "sine", 0.08); CUR.said++; return rt.say(who.name, hi(), { emoji: R.emoji, color: accent, person: rt.byId.owner }); } });
    if (R.act) {
        const A = R.act, next = pool(A.lines);
        rt.hot({ id: "act", x: -2.9, z: 1.3, r: 1.3, label: A.label,
            action: async rt => {
                if (A.cost) {
                    const res = buyExtra("storefront", id, A.cost);
                    if (!res.ok) return rt.say(who.name, res.why === "poor" ? "Five coins, sweetie. Come back when you've got five coins. I'll be here. I'm always here." : "Hm. Not today.", { emoji: R.emoji, color: accent, person: rt.byId.owner });
                }
                tone(660, 0.07, "triangle", 0.08);
                emit("storefronts:act", { id, cost: A.cost || 0 });
                emit("stat", { id: "storefrontActs", n: 1 });
                return rt.say("", next(), { emoji: R.emoji, color: accent });
            } });
    }
}

export const ROOM_ID = "storefront";
const DEF = defineInterior({
    id: ROOM_ID, name: "a shop", short: "the shop", emoji: "🏪", title: "🏪 A SHOP", tagline: "",
    model: "storefront_roomkit", models: ["npcMan", "npcWoman", "npcKid"], music: "../story-relax.mp3",
    light: "indoor", sky: "#e8e2d4",
    bounds: { x0: -W / 2 + 0.35, x1: W / 2 - 0.35, z0: -D / 2 + 0.4, z1: D / 2 - 0.35 },
    cam: { dist: 6.4, height: 4.2 },
    build(rt) { build(rt); },
});
/** Dress the one room as shop `id` (before she walks in): its row + the lines on its sign outside. */
export function dress(id, row, lines = null) {
    CUR.id = id; CUR.row = Object.assign({}, row, { sign: row.sign || lines || [id] });
    const name = CUR.row.sign[0];
    const title = name.split(" ").map(w => (w.length > 2 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())).join(" ").replace(/^./, c => c.toUpperCase());
    DEF.name = title; DEF.short = title; DEF.emoji = row.emoji || "🏪"; DEF.title = `${row.emoji || "🏪"} ${name}`; DEF.tagline = CUR.row.sign[1] || "";
    const reg = ctx.interiors && ctx.interiors[ROOM_ID];
    if (reg) { reg.name = title; reg.emoji = DEF.emoji; }
}
