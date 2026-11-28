// features/shul — 🕍 the room: ONE shul interior on the interiors engine (the courthouse lobby / Lulu's house pattern).
//
// Layout, left → right, seen dollhouse-style (the front wall cut away; the camera looks in from the street):
//   THE MEN'S HALL (aron kodesh on the far wall, the bimah, benches + shtenders, seforim shelves)  ┃ mechitza (a wooden
//   lattice, her side of it is hers) ┃ THE WOMEN'S SECTION (her own front door — she comes in HERE — chairs, a seforim
//   shelf, the lattice to look through) ▸ the LOBBY (the coat rack with a hundred identical black hats, the memorial
//   board with its little lights, the candy man's seat) ▸ the KIDDUSH ROOM (a long table, herring, kichel, a suspicious
//   kugel). She walks the women's section, the lobby and the kiddush room; the men's hall is seen through the lattice.
//
// What it costs: the whole room's walls / floors / benches-less furniture is ONE merged mesh (vertex colours) + a
// translucent lattice; the benches, shtenders, chairs, hats and the crowd are InstancedMeshes; ≤ 8 people rigs.
// Built in ONE frame behind the soft cut (the door warmed it). Nothing holy is interactive; nothing pays coins.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, emit } from "../../core/ctx.js";
import { models, findNodes } from "../../models.js";
import { store, saveSoon } from "../../core/save.js";
import { defineInterior, pick, pool } from "../interiors/engine.js";
import * as D from "./data.js";

// ── the room's measurements (metres) ─────────────────────────────────────
export const X0 = -9.4, X1 = 9.8, Z0 = -4.5, Z1 = 4.5, MECH = -1.6, WP = 3.4, LP = 6.4, WALL = 3.6;
export const GAP = [0.6, 3.2];                       // the archways between the women's section, the lobby and the kiddush room (z)
const PW = 1.5;                                      // the partitions' height
const DOOR = { x: 0.5, z: 3.75 };                    // her way in: the women's entrance
const ARON = { x: -5.5, z: -4.5 }, BIMAH = { x: -5.5, z: -0.6 };

/** Her own little save: the lollipop's once-a-day. */
export const SAVE = store("shul", { lastPop: "", pops: 0, visits: 0 });
export const force = {};                             // tests: { kind, dayKey }
const dayKey = () => force.dayKey || (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();
export const poppedToday = () => SAVE.lastPop === dayKey();

/** What is happening in the shul right now — from the clock and the calendar (features/seasons). */
export function plan() {
    const d = ctx.seasons && ctx.seasons.day ? ctx.seasons.day() : null;
    const now = new Date(), h = force.hour != null ? force.hour : now.getHours() + now.getMinutes() / 60;
    let kind = "weekday";
    if (d) {
        const fast = d.ids.some(id => ["tzomGedaliah", "asaraBTeves", "taanisEsther", "tamuz17", "tishaBav"].includes(id));
        if (d.ids.includes("yomKippur")) kind = "yk";
        else if (fast) kind = "fast";
        else if (d.shabbos || d.yomtov) kind = h < 12 ? "davening" : h < 15 ? "kiddush" : h < 17 ? "afternoon" : "davening";
        else if (d.erev) kind = "friday";
    }
    const ch = d && d.chanukah ? d.chanukah : 0;
    if (force.kind) kind = force.kind;
    const mourning = !!(d && d.ids.some(id => id === "threeWeeks" || id === "nineDays"));
    return {
        kind, chanukah: force.chanukah != null ? force.chanukah : ch,
        quiet: kind === "davening" || kind === "yk",                       // people are davening: only quiet things to do
        fast: kind === "fast" || kind === "yk",
        food: kind === "kiddush" ? "full" : kind === "friday" ? "some" : kind === "weekday" || kind === "afternoon" ? "tray" : "none",
        dim: kind === "fast" || kind === "yk" || mourning,
    };
}

const MEN = { Top: "#222226", Bottom: "#222226", Shoes: "#111111", Kippah: "#111111" };
const SUIT_GREY = { Top: "#4A4A52", Bottom: "#4A4A52", Hair: "#EDEDED", Shoes: "#222222" };
const WHITE = { Top: "#F3F3F3", Bottom: "#F3F3F3" };

/** The cast per kind: [id, model, spot, opts]. Spots are room metres; ry = facing (0 → +z (the street), π → −z (the aron)). */
function cast(P) {
    const k = P.kind, c = [];
    const man = (id, x, z, ry, o = {}) => c.push([id, o.model || "npcMan", { x, z, ry }, Object.assign({ colors: MEN, faceLulu: false }, o)]);
    const candy = () => c.push(["candy", "npcMan", { x: 4.35, z: -1.5, ry: 0 }, { name: "The candy man", colors: SUIT_GREY, pose: { sit: true }, faceLulu: false, collide: false }]);
    const rebb = (x, z, ry = Math.PI / 2, o = {}) => c.push(["rebb", "npcWoman", { x, z, ry }, Object.assign({ name: "The rebbetzin", colors: { Top: "#7B4A8A", Bottom: "#5E3A6B", Hair: "#3B2A22" }, faceLulu: true }, o)]);
    const kid = (o = {}) => c.push(["kid", "npcKid", { x: -5.5, z: 1.6, ry: 0 }, Object.assign({ name: "A kid", scale: 0.82, colors: { Top: "#E57373", Bottom: "#37474F" }, faceLulu: false, collide: false }, o)]);
    if (k === "weekday") {
        man("gabbai", -2.4, 1.7, 0, { name: "The gabbai", model: "hillelPerson", colors: { Top: "#2B2B30", Bottom: "#2B2B30", Tie: "#1B5E20" }, walker: { x0: -2.5, z0: 0.6, x1: -2.5, z1: 2.8, T: 11 }, collide: false });
        man("l1", -7.9, -0.55, Math.PI, { name: "A man learning", pose: { sit: true }, y: 0.1, collide: false });
        kid({ loop: { cx: BIMAH.x, cz: BIMAH.z, rx: 2.5, rz: 1.9, w: 1.05 } });
        candy(); rebb(2.15, 2.2);
    } else if (k === "friday") {
        man("gabbai", 7.6, 0.5, 0, { name: "The gabbai", model: "hillelPerson", colors: { Top: "#2B2B30", Bottom: "#2B2B30", Tie: "#1B5E20" }, walker: { x0: 6.95, z0: -2.6, x1: 6.95, z1: 1.9, T: 13 }, collide: false });
        man("set1", 9.1, -1.4, -Math.PI / 2, { name: "Someone setting up", pose: { talk: true } });
        // (round the kiddush table: its far end runs down the MIDDLE of the 0.35 m gap between the table (z -3.45) and the
        //  counter (z -3.8) — at rz 2.9 it brushed the table's end: shul "nobody stands inside a wall (kid)" — sweep-health)
        kid({ loop: { cx: 8.0, cz: -0.65, rx: 1.45, rz: 2.975, w: 1.1, sq: 0.5 } });
        candy(); rebb(7.1, 2.3, 0, { walker: null });
    } else if (k === "davening") {
        man("gabbai", -3.55, -1.3, Math.PI, { name: "The gabbai", model: "hillelPerson", colors: { Top: "#2B2B30", Bottom: "#2B2B30", Tie: "#1B5E20" } });
        man("saver", -3.0, 0.3, Math.PI, { name: "A man guarding six seats", pose: { sit: true }, y: 0.1, collide: false });
        candy(); rebb(2.15, 2.3);
    } else if (k === "kiddush") {
        man("reg1", 9.05, -2.2, -Math.PI / 2, { name: "A kiddush regular", colors: { Top: "#2A2A30", Bottom: "#2A2A30" }, pose: { talk: true }, collide: false });
        man("reg2", 9.05, -1.2, -Math.PI / 2, { name: "A kiddush regular", colors: { Top: "#34344A", Bottom: "#222226" }, collide: false });
        man("saver", -3.0, 0.3, Math.PI, { name: "A man guarding six seats", pose: { sit: true }, y: 0.1, collide: false });
        candy(); rebb(7.2, 2.5, 0, {});
    } else if (k === "afternoon") {
        man("gabbai", -2.4, 1.7, 0, { name: "The gabbai", model: "hillelPerson", colors: { Top: "#2B2B30", Bottom: "#2B2B30", Tie: "#1B5E20" }, pose: { sit: true }, y: 0.1, collide: false });
        man("l1", -7.9, -0.55, Math.PI, { name: "A man learning", pose: { sit: true }, y: 0.1, collide: false });
        candy(); rebb(2.15, 2.2);
    } else if (k === "fast") {
        man("gabbai", -2.4, 1.7, 0, { name: "The gabbai", model: "hillelPerson", colors: { Top: "#2B2B30", Bottom: "#2B2B30", Tie: "#1B5E20" }, walker: { x0: -2.5, z0: 1.2, x1: -2.5, z1: 2.2, T: 22 }, collide: false });
        man("l1", -7.9, -0.55, Math.PI, { name: "A man learning", pose: { sit: true }, y: 0.1, collide: false });
        candy(); rebb(2.15, 2.2);
    }                                                    // (yk: nobody to talk to — the whole room is at prayer)
    return c;
}

// ── geometry helpers ─────────────────────────────────────────────────────
const _c = new THREE.Color();
function paint(g, hex) {
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    _c.set(hex);
    for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
    return g;
}
/** A pile of coloured boxes / cylinders, merged into ONE geometry (one draw call). */
class Pile {
    constructor() { this.g = []; }
    box(w, h, d, x, y, z, hex, ry = 0, rx = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); this.g.push(paint(g, hex)); return this; }
    cyl(r, h, x, y, z, hex, seg = 10, rt = r) { const g = new THREE.CylinderGeometry(rt, r, h, seg); g.translate(x, y, z); this.g.push(paint(g, hex)); return this; }
    ball(r, x, y, z, hex) { const g = new THREE.SphereGeometry(r, 8, 6); g.translate(x, y, z); this.g.push(paint(g, hex)); return this; }
    geo() { const m = mergeGeometries(this.g, false); for (const g of this.g) g.dispose(); return m; }
}
const VC = hex => new THREE.MeshStandardMaterial({ color: hex || 0xffffff, vertexColors: true, roughness: 0.85 });

const WOOD = "#6B4A2B", WOOD2 = "#9A6B3F", CREAM = "#F1E7D2", CREAM2 = "#E6D9BC";

// ── build ────────────────────────────────────────────────────────────────
function build(rt) {
    const P = rt.data.P = plan();
    const V = rt.data.V = { P, t: 0, flames: [], walkers: [], loops: [], pulse: [], kugel: null, wob: 0, said: pool(D.ENTER[P.kind] || D.ENTER.weekday) };
    rt.root.visible = false;                              // (homes' kit: only the door + a couple of pieces are cloned out)
    rt.cols.length = 0;
    rt.bounds = { x0: MECH + 0.3, x1: X1 - 0.35, z0: Z0 + 0.5, z1: Z1 - 0.5 };
    const own = rt.own.bind(rt), add = o => rt.add(o);
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });
    const S = new Pile();

    // lights
    const set = rt.set;
    set.sun.castShadow = false;                            // (a room of boxes + a few people: shadows would double the draw calls)
    set.hemi.color.set(P.dim ? "#E8E4F2" : "#FFF3DC"); set.hemi.intensity = P.dim ? 0.95 : 1.35;
    set.sun.color.set("#FFF1D6"); set.sun.intensity = P.dim ? 0.55 : 0.9;
    const l1 = rt.pointLight("hall", "#FFE2B0", P.dim ? 4 : 7, 14); l1.position.set(-5.5, 3.2, 0.5);
    const l2 = rt.pointLight("kiddush", "#FFF1D6", P.dim ? 3 : 5, 10, 1.6, true); l2.position.set(8, 3.0, -0.5);

    // floors: hall wood · women's section a quiet blue carpet · lobby tile · kiddush room linoleum
    S.box(MECH - X0, 0.06, Z1 - Z0, (X0 + MECH) / 2, -0.03, 0, "#A87348");
    S.box(WP - MECH, 0.06, Z1 - Z0, (MECH + WP) / 2, -0.03, 0, "#566F8F");
    S.box(LP - WP, 0.06, Z1 - Z0, (WP + LP) / 2, -0.03, 0, "#D9D2C0");
    S.box(X1 - LP, 0.06, Z1 - Z0, (LP + X1) / 2, -0.03, 0, "#E9E4D4");
    // walls: the back, the two ends, the partitions (archways between the women's section / lobby / kiddush room)
    S.box(X1 - X0, WALL, 0.16, (X0 + X1) / 2, WALL / 2, Z0 - 0.08, CREAM);
    S.box(0.16, WALL, Z1 - Z0, X0 - 0.08, WALL / 2, 0, CREAM2);
    S.box(0.16, WALL, Z1 - Z0, X1 + 0.08, WALL / 2, 0, CREAM2);
    col("back", X0 - 1, X1 + 1, Z0 - 0.6, Z0 + 0.3);
    col("endL", X0 - 1, X0 + 0.15, Z0, Z1); col("endR", X1 - 0.15, X1 + 1, Z0, Z1);
    for (const [x, id] of [[WP, "p1"], [LP, "p2"]]) {
        // (dwarf walls: a tall one between the camera and the next room would hide it — the archway is just a gap)
        S.box(0.2, PW, GAP[0] - Z0, x, PW / 2, (Z0 + GAP[0]) / 2, CREAM2);
        S.box(0.2, PW, Z1 - GAP[1], x, PW / 2, (GAP[1] + Z1) / 2, CREAM2);
        S.box(0.3, PW + 0.1, 0.14, x, (PW + 0.1) / 2, GAP[0], WOOD2); S.box(0.3, PW + 0.1, 0.14, x, (PW + 0.1) / 2, GAP[1], WOOD2);
        col(id + "a", x - 0.12, x + 0.12, Z0 - 1, GAP[0]); col(id + "b", x - 0.12, x + 0.12, GAP[1], Z1 + 1);
    }
    // the low front (the cut-away wall) with the women's entrance + the men's door (closed)
    S.box(X1 - X0, 0.5, 0.14, (X0 + X1) / 2, 0.25, Z1, CREAM2);
    col("front", X0 - 1, X1 + 1, Z1 - 0.25, Z1 + 1);
    // back-wall windows (tall, blue glass) — the sky through them dims at night
    const night = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0;
    const glass = night > 0.4 ? "#1B2440" : "#A9D0F0";
    for (const wx of [-8.0, -2.9, 0.9, 2.5, 4.9, 8.0]) S.box(0.8, 1.7, 0.06, wx, 2.0, Z0 + 0.02, glass).box(0.96, 0.08, 0.1, wx, 2.9, Z0 + 0.03, WOOD2).box(0.96, 0.08, 0.1, wx, 1.1, Z0 + 0.03, WOOD2);

    // ── the men's hall (seen through the lattice) ──
    // aron kodesh: a tall cabinet behind a parochet (burgundy; white for Yom Kippur) — never interactive
    S.box(3.0, 0.22, 1.2, ARON.x, 0.11, ARON.z + 0.65, WOOD);                                                              // its step
    S.box(2.9, 3.0, 0.7, ARON.x, 1.72, ARON.z + 0.35, WOOD);
    S.box(0.22, 3.1, 0.26, ARON.x - 1.5, 1.7, ARON.z + 0.7, WOOD2).box(0.22, 3.1, 0.26, ARON.x + 1.5, 1.7, ARON.z + 0.7, WOOD2);
    S.box(3.2, 0.26, 0.4, ARON.x, 3.3, ARON.z + 0.7, WOOD2);
    S.box(2.3, 2.3, 0.05, ARON.x, 1.4, ARON.z + 0.74, P.kind === "yk" ? "#F4F1EA" : "#7B1E3A");                          // the parochet
    S.box(2.0, 0.07, 0.07, ARON.x, 2.2, ARON.z + 0.78, "#D4AF37").box(2.0, 0.07, 0.07, ARON.x, 0.7, ARON.z + 0.78, "#D4AF37");
    S.box(0.07, 1.5, 0.07, ARON.x - 1.0, 1.45, ARON.z + 0.78, "#D4AF37").box(0.07, 1.5, 0.07, ARON.x + 1.0, 1.45, ARON.z + 0.78, "#D4AF37");
    S.cyl(0.07, 0.16, ARON.x, 3.0, ARON.z + 1.0, "#FFD27A", 8);                                                              // the ner tamid's glow
    // the bimah: a platform, a railing, a table under a cloth
    S.box(2.4, 0.26, 1.8, BIMAH.x, 0.13, BIMAH.z, WOOD2);
    for (const [bx, bz, w, d] of [[0, -0.9, 2.4, 0.06], [-1.2, 0, 0.06, 1.8], [1.2, 0, 0.06, 1.8]]) S.box(w, 0.7, d, BIMAH.x + bx, 0.6, BIMAH.z + bz, WOOD);
    S.box(1.4, 0.08, 0.8, BIMAH.x, 1.0, BIMAH.z - 0.1, "#F4F0E6").box(1.3, 0.7, 0.7, BIMAH.x, 0.62, BIMAH.z - 0.1, "#F4F0E6");
    // seforim shelves along the left wall + the back wall (a row of colourful spines)
    for (const [sx, sz, along] of [[X0 + 0.28, -2.4, "z"], [X0 + 0.28, 1.2, "z"], [-8.4, Z0 + 0.3, "x"], [-1.5 - 1.3, Z0 + 0.3, "x"]]) shelves(S, sx, sz, along);
    // the mechitza: a wooden lattice (posts + rails here; its translucent panels are a second mesh)
    for (let z = Z0; z <= Z1 + 0.01; z += 0.9) S.box(0.1, 2.2, 0.1, MECH, 1.1, z, WOOD);
    for (const y of [0.55, 1.2, 2.2]) S.box(0.1, 0.08, Z1 - Z0, MECH, y, 0, WOOD2);
    col("mech", MECH - 0.15, MECH + 0.15, Z0 - 1, Z1 + 1);

    // ── the women's section: a few chairs (instanced), a seforim shelf, the entrance door ──
    shelves(S, 0.0, Z0 + 0.3, "x");
    col("wshelf", -0.9, 0.9, Z0, Z0 + 0.55);
    // the entrance: her door
    const door = kit(rt, "Door"); if (door) { door.position.set(DOOR.x, 0, Z1); add(door); }
    const mdoor = kit(rt, "Door"); if (mdoor) { mdoor.position.set(-5.5, 0, Z1); add(mdoor); }
    rt.spots.door = { x: DOOR.x, z: DOOR.z, ry: Math.PI };

    // ── the lobby: the coat rack with a hundred identical black hats, the memorial board, the candy man's seat ──
    S.box(2.9, 0.1, 0.5, 4.9, 1.05, Z0 + 0.3, WOOD).box(2.9, 0.1, 0.5, 4.9, 1.55, Z0 + 0.3, WOOD).box(2.9, 0.1, 0.5, 4.9, 2.05, Z0 + 0.3, WOOD)
        .box(2.9, 0.1, 0.5, 4.9, 2.55, Z0 + 0.3, WOOD).box(2.9, 2.3, 0.05, 4.9, 1.7, Z0 + 0.03, "#8C6A45");
    // the memorial board: a dark wooden panel on the partition, rows of small plaques, each with a little light
    S.box(0.08, 2.1, 3.3, LP - 0.14, 1.55, -2.25, "#4A3322");
    const plaques = [], lights = [];
    for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) {
        const z = -3.55 + q * 0.54, y = 0.85 + r * 0.45;
        S.box(0.04, 0.2, 0.4, LP - 0.2, y, z, "#C9B27A");
        lights.push([LP - 0.24, y + 0.2, z + 0.12]);
    }
    // the candy man's seat: a chair + a small table with a jar
    S.box(0.5, 0.08, 0.5, 4.35, 0.45, -1.45, WOOD2).box(0.5, 0.55, 0.06, 4.35, 0.75, -1.7, WOOD2).box(0.06, 0.45, 0.06, 4.15, 0.22, -1.25, WOOD).box(0.06, 0.45, 0.06, 4.55, 0.22, -1.25, WOOD);
    S.box(0.7, 0.06, 0.6, 5.15, 0.7, -1.5, WOOD2).box(0.08, 0.7, 0.08, 5.15, 0.35, -1.5, WOOD);
    S.cyl(0.13, 0.22, 5.15, 0.84, -1.5, "#E8F4FA", 10);                                                                       // the jar
    S.ball(0.045, 5.1, 0.99, -1.5, "#E53935").ball(0.045, 5.2, 0.99, -1.52, "#8E24AA").ball(0.045, 5.15, 0.99, -1.42, "#FDD835");
    col("candytable", 4.8, 5.5, -1.85, -1.15);
    // the announcements board on the lobby partition's women's side
    S.box(0.06, 0.9, 1.4, WP + 0.14, 1.7, -2.0, "#8D6E4F"); S.box(0.04, 0.7, 1.2, WP + 0.18, 1.7, -2.0, "#EFE6C8");

    // ── the kiddush room: a long table under a white cloth, a kitchen counter at the back ──
    S.box(1.3, 0.1, 5.2, 8.0, 0.82, -0.8, "#F7F3EA"); S.box(1.2, 0.8, 5.1, 8.0, 0.4, -0.8, "#EFEADD");
    S.box(0.4, 0.9, 3.2, 9.0, 0.45, -3.2, "#9AA4AD").box(2.2, 0.9, 0.6, 7.7, 0.45, Z0 + 0.3, "#9AA4AD").box(2.2, 0.06, 0.62, 7.7, 0.93, Z0 + 0.3, "#CFD8DC");
    S.cyl(0.2, 0.5, 9.0, 1.15, -3.9, "#B0BEC5", 10);                                                                          // the urn
    col("ktable", 7.3, 8.7, -3.45, 1.85); col("kcounter", 6.8, 9.9, Z0, Z0 + 0.7);
    const food = P.food;
    if (food !== "none") {
        const n = food === "full" ? 8 : food === "some" ? 3 : 1;
        for (let i = 0; i < n; i++) {                                     // herring on plates, kichel, rolls of challah-ish
            const z = -3.0 + i * 0.58, x = 7.75 + (i % 2) * 0.5;
            if (food === "tray") { S.box(0.5, 0.06, 0.35, 8.0, 0.9, -1.0, "#E8D4A2"); break; }
            S.cyl(0.17, 0.02, x, 0.88, z, "#FFFFFF", 12).box(0.18, 0.05, 0.1, x, 0.92, z, i % 3 ? "#C9D4DC" : "#F0B8B0");
            S.box(0.34, 0.1, 0.24, x + 0.1 + (i % 2 ? -0.2 : 0.2), 0.92, z + 0.28, "#EBCB8B");
        }
    }
    // the kugel (food === "full" or "some": a separate mesh — it wobbles. The note says DO NOT ASK.)
    if (food === "full" || food === "some") {
        const k = new THREE.Group();
        const kg = new Pile().box(0.55, 0.14, 0.38, 0, 0.07, 0, "#B97A2E").box(0.5, 0.03, 0.34, 0, 0.155, 0, "#8A5416").box(0.15, 0.1, 0.01, 0.0, 0.2, 0.2, "#FFF59D", 0, -0.25).geo();
        const km = new THREE.Mesh(own(kg), own(VC()));
        k.add(km); k.position.set(8.0, 0.87, 1.25); add(k); V.kugel = k;
    }

    // ── the chanukah menorah by the door (just a menorah: nobody uses it, she walks past) ──
    if (P.chanukah > 0) menorah(rt, V, P.chanukah);

    // ── the merged statics + the lattice's panels ──
    const mesh = new THREE.Mesh(own(S.geo()), own(VC()));
    mesh.castShadow = false; mesh.receiveShadow = true; add(mesh);
    const latt = new THREE.Mesh(own(new THREE.BoxGeometry(0.04, 1.6, Z1 - Z0)), own(new THREE.MeshStandardMaterial({ color: "#F4E6C6", transparent: true, opacity: 0.42, roughness: 0.6, depthWrite: false })));
    latt.position.set(MECH, 1.4, 0); add(latt);

    // ── instanced: benches + shtenders (hall), chairs (women's section), hats (rack), memorial lights ──
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(1, 1, 1), PV = new THREE.Vector3();
    const place = (im, i, x, y, z, ry = 0) => { M4.compose(PV.set(x, y, z), Q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, ry), SC); im.setMatrixAt(i, M4); };
    const benches = [], stands = [];
    for (const bx of [-8.0, -3.0]) for (let r = 0; r < 7; r++) benches.push([bx, -2.4 + r * 0.9]);
    for (const bx of [-6.45, -4.55]) for (let r = 0; r < 3; r++) benches.push([bx, 1.6 + r * 0.9]);
    const bg = new Pile().box(1.8, 0.1, 0.5, 0, 0.45, 0, WOOD2).box(0.08, 0.45, 0.45, -0.8, 0.22, 0, WOOD).box(0.08, 0.45, 0.45, 0.8, 0.22, 0, WOOD).box(1.8, 0.5, 0.06, 0, 0.78, 0.26, WOOD).geo();
    const sg = new Pile().box(0.55, 0.95, 0.36, 0, 0.47, 0, WOOD).box(0.55, 0.05, 0.42, 0, 1.0, -0.02, WOOD2, 0, -0.35).geo();
    const ib = new THREE.InstancedMesh(own(bg), own(VC()), benches.length), is = new THREE.InstancedMesh(own(sg), own(VC()), benches.length);
    benches.forEach(([x, z], i) => { place(ib, i, x, 0, z); place(is, i, x, 0, z - 0.62); });
    ib.receiveShadow = true; add(ib); add(is);
    // women's chairs: 4 rows × 4
    const chairs = [];
    for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) chairs.push([1.35 + q * 0.62, -3.5 + r * 0.9]);
    const cg = new Pile().box(0.46, 0.06, 0.44, 0, 0.45, 0, "#2F4F6F").box(0.46, 0.5, 0.05, 0, 0.72, 0.21, "#2F4F6F").box(0.05, 0.45, 0.05, -0.2, 0.22, -0.18, "#444").box(0.05, 0.45, 0.05, 0.2, 0.22, -0.18, "#444").box(0.05, 0.45, 0.05, -0.2, 0.22, 0.18, "#444").box(0.05, 0.45, 0.05, 0.2, 0.22, 0.18, "#444").geo();
    const ic = new THREE.InstancedMesh(own(cg), own(VC()), chairs.length);
    chairs.forEach(([x, z], i) => place(ic, i, x, 0, z));
    add(ic);
    for (let r = 0; r < 4; r++) col("chairs" + r, 1.05, 3.2, -3.5 + r * 0.9 - 0.3, -3.5 + r * 0.9 + 0.3);
    // a hundred identical black hats: 5 shelves-worth on the rack (20 a row)
    const hg = new Pile().cyl(0.095, 0.03, 0, 0, 0, "#111114", 10).cyl(0.062, 0.1, 0, 0.065, 0, "#111114", 10, 0.058).geo();
    const ih = new THREE.InstancedMesh(own(hg), own(VC()), 100);
    for (let i = 0; i < 100; i++) place(ih, i, 3.62 + (i % 20) * 0.142 + (i % 3 === 0 ? 0.01 : 0), 1.1 + Math.floor(i / 20) * 0.5 - (i >= 80 ? 0.0 : 0), Z0 + 0.32);
    add(ih); V.hats = ih;
    // the memorial's little lights (they glow quietly)
    const lg = own(new THREE.BoxGeometry(0.05, 0.05, 0.05)), lm = own(new THREE.MeshBasicMaterial({ color: "#FFC56B" }));
    const il = new THREE.InstancedMesh(lg, lm, lights.length);
    lights.forEach(([x, y, z], i) => place(il, i, x, y, z));
    add(il); V.pulse.push(lm);

    // ── the crowd (cheap: instanced seated figures — a body mesh + the heads) ──
    crowd(rt, V, P, { place, benches, chairs });

    // ── the cast (people rigs) ──
    for (const [id, key, sp, o] of cast(P)) {
        const rec = rt.person(id, key, sp, Object.assign({ faceLulu: true }, o));
        if (o.walker) V.walkers.push({ rec, w: o.walker, t: Math.random() * 30 });
        if (o.loop) V.loops.push({ rec, l: o.loop, t: Math.random() * 6 });
    }
    hotspots(rt, V);
    // first sight
    rt.every(18, 34, ambient, { gate: true, first: 6 });
    rt.wait(1.1).then(() => { if (!rt.disposed) rt.bubble(V.said(), rt.lulu.obj, 3.2); });
    emit("shul:enter", { kind: P.kind, chanukah: P.chanukah });
    SAVE.visits++; saveSoon();
}

function kit(rt, name) {
    const src = models.homesKit && findNodes(models.homesKit, "Kit_" + name)[0];
    if (!src) return null;
    const c = src.clone(true); c.position.set(0, 0, 0); c.rotation.set(0, 0, 0);
    return c;
}
/** A shelf of seforim: a tall dark case and rows of coloured spines. */
function shelves(S, x, z, along) {
    const w = 2.6, cols = ["#7B1E3A", "#1A237E", "#2E5E4E", "#5D4037", "#8D6E63", "#263238", "#9E7B2E", "#4E342E"];
    for (let i = 0; i < 3; i++) {
        const y = 0.95 + i * 0.7;
        if (along === "x") { S.box(w, 0.05, 0.4, x, y - 0.32, z, WOOD); } else { S.box(0.4, 0.05, w, x, y - 0.32, z, WOOD); }
        for (let k = 0; k < 13; k++) {
            const o = -w / 2 + 0.12 + k * 0.19, h = 0.4 + ((k * 7 + i * 3) % 4) * 0.04, c = cols[(k + i * 3) % cols.length];
            if (along === "x") S.box(0.13, h, 0.28, x + o, y - 0.3 + h / 2, z, c); else S.box(0.28, h, 0.13, x, y - 0.3 + h / 2, z + o, c);
        }
    }
    if (along === "x") { S.box(w + 0.1, 2.5, 0.06, x, 1.25, z - 0.2, WOOD).box(0.06, 2.5, 0.4, x - w / 2 - 0.03, 1.25, z, WOOD).box(0.06, 2.5, 0.4, x + w / 2 + 0.03, 1.25, z, WOOD); }
    else { S.box(0.06, 2.5, w + 0.1, x - 0.2, 1.25, z, WOOD).box(0.4, 2.5, 0.06, x, 1.25, z - w / 2 - 0.03, WOOD).box(0.4, 2.5, 0.06, x, 1.25, z + w / 2 + 0.03, WOOD); }
}
/** A chanukah menorah on a little stand by the door: n + 1 candles lit. */
function menorah(rt, V, n) {
    const m = new Pile();
    const x = 2.55, z = 3.55;
    m.box(0.9, 0.6, 0.5, x, 0.3, z, WOOD2).box(0.9, 0.06, 0.5, x, 0.63, z, "#8C6A45");
    m.box(0.5, 0.05, 0.16, x, 0.7, z, "#D4AF37").box(0.04, 0.2, 0.04, x, 0.82, z, "#D4AF37");
    const flames = [];
    for (let i = 0; i < 9; i++) {
        const cx = x - 0.44 + i * 0.11, tall = i === 4;
        m.box(0.05, tall ? 0.32 : 0.22, 0.05, cx, tall ? 0.88 : 0.83, z, "#D4AF37");
        m.box(0.04, 0.1, 0.04, cx, tall ? 1.08 : 0.99, z, "#FFFDE7");
        flames.push([cx, tall ? 1.17 : 1.08, z, i]);
    }
    const mesh = new THREE.Mesh(rt.own(m.geo()), rt.own(VC())); rt.add(mesh);
    const fm = rt.own(new THREE.MeshBasicMaterial({ color: "#FFC83D" }));
    const ORDER = [8, 7, 6, 5, 3, 2, 1, 0], lit = flames.filter(f => f[3] === 4 || ORDER.indexOf(f[3]) < n);       // the helper + n lit, newest first
    const im = new THREE.InstancedMesh(rt.own(new THREE.SphereGeometry(0.045, 6, 5)), fm, lit.length);
    const M = new THREE.Matrix4();
    lit.forEach(([fx, fy, fz], i) => { M.makeTranslation(fx, fy, fz); im.setMatrixAt(i, M); });
    rt.add(im); V.flames.push(fm); V.menorahLit = lit.length;
}

/** The crowd: seated figures as instanced meshes — men in the hall, women in their section, in the kiddush room after. */
function crowd(rt, V, P, { place, benches, chairs }) {
    const k = P.kind, own = rt.own.bind(rt);
    const men = [], women = [], standingM = [], standingW = [];
    const seats = [];
    benches.forEach(([bx, bz]) => { for (const o of [-0.55, 0, 0.55]) seats.push([bx + o, bz]); });
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const fill = (list, f, skip = () => false) => { for (const s of list) if (!skip(s) && rnd() < f) men.push(s); };
    const reserved = s => (Math.abs(s[0] + 3.0) < 0.9 && Math.abs(s[1] - 0.3) < 0.1);       // the seat-saver's six seats stay empty
    if (k === "davening" || k === "yk") {
        fill(seats, k === "yk" ? 0.85 : 0.72, reserved);
        for (const c of chairs) if (rnd() < (k === "yk" ? 0.8 : 0.55)) women.push(c);
    } else if (k === "weekday" || k === "afternoon") {
        for (const i of k === "weekday" ? [3, 4, 5, 20, 21, 33] : [4]) if (seats[i]) men.push(seats[i]);
    } else if (k === "fast") { for (const i of [4, 22]) if (seats[i]) men.push(seats[i]); }
    else if (k === "kiddush") {
        for (let i = 0; i < 46; i++) standingM.push([6.85 + rnd() * 2.7, -3.0 + rnd() * 5]);
        for (let i = 0; i < 5; i++) standingM.push([4.0 + rnd() * 2, 1.0 + rnd() * 1.8]);
        for (let i = 0; i < 22; i++) standingW.push([6.85 + rnd() * 2.7, -3.0 + rnd() * 5]);
        for (const i of [4, 25]) if (seats[i]) men.push(seats[i]);
    }
    // keep the standing figures off the table + the walkway (the kiddush table's footprint x 7.3–8.7)
    const offTable = ([x, z]) => !(x > 7.1 && x < 8.9 && z > -3.6 && z < 2.0) || false;
    const sm = standingM.filter(offTable), sw = standingW.filter(offTable);
    const bodyM = new Pile().box(0.42, 0.52, 0.28, 0, 0.76, 0.06, k === "yk" ? "#F2F2F2" : "#202026").box(0.4, 0.14, 0.46, 0, 0.5, -0.12, k === "yk" ? "#EAEAEA" : "#1A1A1F")
        .ball(0.125, 0, 1.13, 0.06, "#E9B98F").cyl(0.2, 0.03, 0, 1.24, 0.06, k === "yk" ? "#EEEEEE" : "#0E0E11", 10).cyl(0.125, 0.12, 0, 1.31, 0.06, k === "yk" ? "#EEEEEE" : "#0E0E11", 10, 0.12).geo();
    const bodyS = new Pile().box(0.42, 0.62, 0.28, 0, 1.0, 0, "#202026").box(0.36, 0.7, 0.24, 0, 0.35, 0, "#1A1A1F").ball(0.125, 0, 1.45, 0, "#E9B98F").cyl(0.2, 0.03, 0, 1.56, 0, "#0E0E11", 10).cyl(0.125, 0.12, 0, 1.63, 0, "#0E0E11", 10, 0.12).geo();
    const bodyW = new Pile().box(0.4, 0.5, 0.26, 0, 0.74, 0.04, "#FFFFFF").box(0.42, 0.14, 0.42, 0, 0.5, -0.1, "#EDEDED").ball(0.12, 0, 1.1, 0.04, "#EBC09A").ball(0.14, 0, 1.15, 0.02, "#7A5A44").geo();
    const bodyWS = new Pile().box(0.4, 0.55, 0.26, 0, 1.0, 0, "#FFFFFF").box(0.42, 0.75, 0.3, 0, 0.37, 0, "#EDEDED").ball(0.12, 0, 1.4, 0, "#EBC09A").ball(0.14, 0, 1.45, 0, "#7A5A44").geo();
    const tints = ["#ffffff", "#f3d3de", "#d3e4f3", "#e3f3d3", "#f3e9cc", "#d9cdf0", "#c9d6e0"];
    const mk = (geo, list, ry, tinted) => {
        if (!list.length) return null;
        const im = new THREE.InstancedMesh(own(geo), own(VC()), list.length);
        const M = new THREE.Matrix4(), Q2 = new THREE.Quaternion(), P2 = new THREE.Vector3(), S2 = new THREE.Vector3(1, 1, 1), C = new THREE.Color();
        list.forEach(([x, z], i) => {
            const r = ry === "face" ? Math.atan2(7.9 - x, -0.8 - z) * 0 + Math.PI + (((x * 7 + z * 13) % 1) - 0.5) * 2.2 : ry;
            M.compose(P2.set(x, 0, z), Q2.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r), S2.set(1, 1 + (((x * 3 + z * 5) % 1) - 0.5) * 0.08, 1));
            im.setMatrixAt(i, M);
            C.set(tinted ? tints[i % tints.length] : "#ffffff"); if (!tinted) C.multiplyScalar(0.82 + ((i * 37) % 10) * 0.02);
            im.setColorAt(i, C);
        });
        rt.add(im); return im;
    };
    V.crowd = { men: men.length, women: women.length, standing: sm.length + sw.length };
    mk(bodyM, men, Math.PI, false); mk(bodyW, women, Math.PI, true);
    mk(bodyS, sm, "face", false); mk(bodyWS, sw, "face", true);
}

// ── the hotspots ─────────────────────────────────────────────────────────
const pools = {};
const line = (key, arr) => (pools[key] || (pools[key] = pool(arr)))();

function hotspots(rt, V) {
    const P = V.P, quiet = P.quiet;
    const talk = (id, name, text, extra = {}) => rt.say(name, text, Object.assign({ person: rt.byId[id] }, extra));
    const has = id => !!rt.byId[id];
    const lat = (z) => ({ x: MECH + 0.45, z });                      // a spot on her side of the lattice

    // people through the lattice
    if (has("gabbai") && (P.kind === "weekday" || P.kind === "afternoon" || P.kind === "fast"))
        rt.hot(Object.assign({ id: "gabbai", who: "gabbai", r: 1.35, label: "🧑‍💼 The gabbai (through the lattice)",
            action: rt => talk("gabbai", "The gabbai", line("g" + P.kind, D.GABBAI[P.kind]), { emoji: "🧑‍💼", color: "#1B5E20" }) }, lat(1.7)));
    if (has("gabbai") && P.kind === "friday")
        rt.hot({ id: "gabbai", who: "gabbai", track: true, r: 1.6, label: "🧑‍💼 The gabbai", action: rt => talk("gabbai", "The gabbai", line("g" + P.kind, D.GABBAI[P.kind]), { emoji: "🧑‍💼", color: "#1B5E20" }) });
    if (has("kid") && !quiet)
        rt.hot(Object.assign({ id: "kid", r: 1.3, label: "🏃 The kid on lap 40", action: rt => rt.say("Lulu", line("kid", D.KID), { emoji: "🏃", color: "#E57373" }), enabled: () => true },
            P.kind === "friday" || P.kind === "kiddush" ? { track: true, who: "kid" } : lat(0.5)));
    if (has("saver") && P.kind === "kiddush")
        rt.hot(Object.assign({ id: "saver", who: "saver", r: 1.3, label: "🎒 The man with the tallis bag", action: rt => talk("saver", "A man guarding six seats", line("saver", D.SAVER), { emoji: "🎒", color: "#37474F" }) }, lat(0.3)));
    if (has("saver") && P.kind === "davening")
        rt.hot(Object.assign({ id: "saver", r: 1.3, label: "🎒 Six seats, one bag", action: rt => rt.say("Lulu", line("saverL", D.SAVER_LULU), { emoji: "🎒", color: "#37474F" }) }, lat(0.3)));
    if (!quiet && P.kind !== "fast")
        rt.hot(Object.assign({ id: "pa", r: 1.2, label: "📢 The announcements", action: rt => rt.say("📢 The PA system", line("pa", D.ANNOUNCE), { emoji: "📢", color: "#5D4037" }) }, lat(-2.4)));
    // she stands quietly at the back while they daven
    if (quiet)
        rt.hot(Object.assign({ id: "quiet", r: 1.3, label: "🤫 Stand quietly", action: async rt => { rt.bubble(line("quiet", D.QUIET), rt.lulu.obj, 3.6); await rt.wait(0.6); } }, lat(0.9)));

    // the women's section's own people + things
    if (has("rebb")) rt.hot(Object.assign({ id: "rebb", who: "rebb", r: 1.5, label: "💜 The rebbetzin",
        action: rt => quiet ? whisper(rt, "rebb", D.REBBETZIN.quiet) : talk("rebb", "The rebbetzin", line("r" + P.kind, D.REBBETZIN[P.kind] || D.REBBETZIN.weekday), { emoji: "💜", color: "#7B4A8A" }) },
        P.kind === "friday" || P.kind === "kiddush" ? { track: true } : {}));
    rt.hot({ id: "shelf", x: 0.0, z: Z0 + 0.95, r: 1.25, label: "📚 The seforim shelf", action: rt => rt.say("Lulu", line("shelf", D.SHELF), { emoji: "📚" }) });
    if (P.chanukah > 0) rt.hot({ id: "menorah", x: 2.1, z: 3.3, r: 1.0, label: "🕎 By the door", action: rt => rt.say("Lulu", D.MENORAH(P.chanukah), { emoji: "🕎" }) });

    // the lobby
    rt.hot({ id: "hats", x: 4.9, z: Z0 + 1.0, r: 1.5, label: "🎩 The coat rack", action: rt => rt.say("Lulu", line("hats", D.HATS), { emoji: "🎩" }) });
    rt.hot({ id: "memorial", x: LP - 0.85, z: -2.2, r: 1.5, label: "🕯️ The memorial board", action: rt => rt.say("Lulu", line("mem", D.MEMORIAL), { emoji: "🕯️", color: "#6D4C41" }) });
    if (has("candy")) rt.hot({ id: "candy", who: "candy", x: 4.35, z: -0.75, r: 1.4, label: "🍭 The candy man", action: candyAction });

    // the kiddush room
    rt.hot({ id: "table", x: 6.95, z: -0.8, r: 1.6, label: "🍽️ The kiddush table",
        action: rt => rt.say("Lulu", line("tbl" + P.kind, P.kind === "kiddush" ? D.TABLE.kiddush : P.kind === "friday" ? D.TABLE.setup : P.fast ? D.TABLE.bare : D.TABLE.plain), { emoji: "🥣", color: "#8D6E63" }) });
    if (has("reg1")) rt.hot({ id: "regs", who: "reg2", x: 9.2, z: -1.7, r: 1.4, label: "🥃 The kiddush regulars", action: rt => talk("reg2", "A kiddush regular", line("regs", D.KIDDUSH_CLUB), { emoji: "🥃", color: "#37474F" }) });
    if (has("set1")) rt.hot({ id: "setup", who: "set1", track: true, r: 1.5, label: "📋 Someone setting up", action: rt => talk("set1", "Someone setting up", line("qc", D.KIDDUSH_QC), { emoji: "📋" }) });
}

async function whisper(rt, id, text) {
    rt.bubble(text.replace(/^💕 …/, "💕 "), rt.byId[id].p.obj, 3.4);
    await rt.wait(0.6);
}

/** The candy man: ONE lollipop a real day. It does nothing but make her happy — no coins, no hearts, nothing. */
async function candyAction(rt) {
    const P = rt.data.P, c = rt.byId.candy;
    if (P.fast) return rt.say("The candy man", pick(D.CANDY.fast), { person: c, emoji: "🍭", color: "#C62828" });
    if (poppedToday()) {
        if (P.quiet) { rt.bubble(D.CANDY.quietAgain, c.p.obj, 3.4); await rt.wait(0.6); return; }
        return rt.say("The candy man", line("candyAgain", D.CANDY.again), { person: c, emoji: "🍭", color: "#C62828" });
    }
    SAVE.lastPop = dayKey(); SAVE.pops++; saveSoon();                       // (counted FIRST: a skipped line can't be re-run for a second one)
    emit("stat", { id: "shulLollipops", n: 1 });
    holdPop(rt);
    if (P.quiet) { rt.bubble(D.CANDY.quiet, c.p.obj, 3.4); await rt.wait(0.5); rt.bubble(pick(D.CANDY.thanksQuiet), rt.lulu.obj, 2.6); return; }
    await rt.say("The candy man", pick(D.CANDY.first), { person: c, emoji: "🍭", color: "#C62828" });
    rt.bubble(pick(D.CANDY.thanks), rt.lulu.obj, 3.0);
    rt.burst(rt.lulu.obj.position.clone().setY(1.5), ["#FF4081", "#FFD740", "#FFFFFF"], 8, 1.4, 0.05);
}
function holdPop(rt) {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(rt.own(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6)), rt.own(new THREE.MeshStandardMaterial({ color: "#FFFFFF" })));
    const ball = new THREE.Mesh(rt.own(new THREE.SphereGeometry(0.075, 10, 8)), rt.own(new THREE.MeshStandardMaterial({ color: "#E53935", roughness: 0.35 })));
    ball.position.y = 0.2; g.add(stick, ball);
    rt.data.pop = rt.hold(rt.lulu, g, { y: -0.4, z: 0.07 });
}

function ambient(rt) {
    const P = rt.data.P;
    if (rt.busy || ctx.dialogOpen || P.quiet) return;
    const say = (id, arr) => { const r = rt.byId[id]; if (r) rt.bubble(pick(arr), r.p.obj, 2.8); };
    const opts = [];
    if (D.GABBAI_AMBIENT[P.kind] && rt.byId.gabbai) opts.push(() => say("gabbai", D.GABBAI_AMBIENT[P.kind]));
    if (rt.byId.rebb && !P.fast) opts.push(() => say("rebb", D.REBBETZIN_AMBIENT));
    if (!P.fast && rt.byId.kid) opts.push(() => rt.bubble("🏃💨", rt.byId.kid.p.obj, 1.4));
    if (opts.length) pick(opts)();
}

// ── per frame ────────────────────────────────────────────────────────────
function tick(rt, dt) {
    const V = rt.data.V;
    V.t += dt;
    const frozen = rt.busy || ctx.dialogOpen;
    for (const w of V.walkers) {
        const r = w.rec, o = r.p.obj, W = w.w;
        if (frozen && rt.active && rt.active.who === r.id) { r.pose = { walk: 0 }; continue; }
        w.t += dt;
        const s = 0.5 + 0.5 * Math.sin(w.t * Math.PI * 2 / W.T), ds = 0.5 * Math.cos(w.t * Math.PI * 2 / W.T) * Math.PI * 2 / W.T;
        const dx = W.x1 - W.x0, dz = W.z1 - W.z0, len = Math.hypot(dx, dz);
        o.position.x = W.x0 + dx * s; o.position.z = W.z0 + dz * s;
        const sp = Math.abs(ds) * len;
        r.pose = { walk: sp > 0.12 ? sp : 0 };
        if (sp > 0.12) o.rotation.y = Math.atan2(dx * Math.sign(ds), dz * Math.sign(ds));
    }
    for (const l of V.loops) {
        const r = l.rec, o = r.p.obj, L = l.l;
        l.t += dt * L.w;
        const a = l.t;
        const c = Math.cos(a), sn = Math.sin(a), e = L.sq || 1, pw = (v) => Math.sign(v) * Math.pow(Math.abs(v), e);
        o.position.set(L.cx + pw(c) * L.rx, 0, L.cz + pw(sn) * L.rz);
        const a2 = a + 0.05, c2 = Math.cos(a2), s2 = Math.sin(a2);
        o.rotation.y = Math.atan2((Math.sign(c2) * Math.pow(Math.abs(c2), e) - pw(c)) * L.rx, (Math.sign(s2) * Math.pow(Math.abs(s2), e) - pw(sn)) * L.rz);
        r.pose = { walk: 2.6 };
    }
    for (const m of V.pulse) m.color.set("#FFC56B").multiplyScalar(0.78 + 0.22 * Math.sin(V.t * 1.7));
    for (const m of V.flames) m.color.set("#FFC83D").multiplyScalar(0.85 + 0.15 * Math.sin(V.t * 9));
    if (V.kugel) { V.wob += dt; const w = Math.max(0, Math.sin(V.wob * 0.9) - 0.82) * 5.5; V.kugel.scale.set(1 + w * 0.05, 1 - w * 0.08, 1 + w * 0.05); }
}

export function dispose(rt) { rt.data.pop = null; }

export const shulDef = defineInterior({
    id: "shul", name: "the shul", short: "the shul", emoji: "🕍", title: "🕍 THE SHUL", tagline: "",
    model: "homesKit", models: ["npcMan", "npcWoman", "npcKid", "hillelPerson"],
    music: "../story-relax.mp3", light: "indoor", sky: "#d9cbb0",
    bounds: { x0: MECH + 0.3, x1: X1 - 0.35, z0: Z0 + 0.5, z1: Z1 - 0.5 },
    cam: { dist: 9.4, height: 8.0, lookY: 0.4, clampX: 2.2, centerZ: -0.4, centerK: 0.55 }, walkSpeed: 3.3,
    build, tick, dispose,
});
