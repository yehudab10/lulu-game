// features/yeshiva — 🎓 the inside of Beis Medrash Gadol HaMinivan (the interiors engine; walk-in, no ✋).
//
// One long room, entered from the street (z +10) and walked straight in (−z):
//   THE LOBBY (z 10 → −6): the coat-and-hat wall (a hundred black hats), the notice board, the mashgiach's desk; on the left
//     the COFFEE ROOM (the real centre of power), on the right the STAIRCASE to the dorms (a rail she can't pass — the noise
//     from upstairs explains everything);
//   an archway at z −6, then THE BEIS MEDRASH (z −6 → −50): 44 long tables with shtenders, ~150 bochurim (instanced), ten
//     pillars, a platform + a blackboard at the far end (the shiur), the aron kodesh behind its parochet on the back wall
//     (never interactive).
// LULU WALKING IN IS THE JOKE (a girl in the building, and nobody knows what to do): a wave of reactions in FIVE BEATS by
// how far in she goes — 1 the doorway: the nearest few stop mid-word · 2 heads snap to their Gemaras · 3 a bochur walks into a
// pillar, one hides behind a shtender · 4 "mashgiach!" — he appears with a clipboard and a very polite question · 5 he settles
// it and the room hums back. Gentle, at the bochurim's expense, never at the Torah's; she's never thrown out. A new visit starts fresh.
// Cost: the shell is ONE merged mesh (under rt.root: the camera clips to it), furniture one more, tables / the crowd /
// the hats are InstancedMeshes; ≤ 10 people rigs, hidden beyond 36 m.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, emit } from "../../core/ctx.js";
import { worldNow } from "../storefronts/hours.js";
import { store, saveSoon } from "../../core/save.js";
import { textPlane } from "../../core/sets.js";
import { defineInterior, pick, pool } from "../interiors/engine.js";
import * as D from "./data.js";

export const X0 = -14, X1 = 14, ZF = 10, ZB = -50, CEIL = 6.2, ZARCH = -6, PLAT = { x: 0, z: -46.4 };
export const SAVE = store("yeshiva", { visits: 0, waves: 0, shiurs: 0, lunches: 0, hats: 0, stared: 0, lunch: "" });
export const force = {};                              // tests: { kind, hour }

/** What's on right now — the clock + the calendar (ctx.seasons), like the shul's. */
export function plan() {
    const d = ctx.seasons && ctx.seasons.day ? ctx.seasons.day() : null;
    const now = worldNow(), h = force.hour != null ? force.hour : now.getHours() + now.getMinutes() / 60;      // (the hour the sky / the 📱 show — ci/sweep-logic2)
    let kind = "weekday";
    if (d) {
        const fast = d.ids.some(id => ["tzomGedaliah", "asaraBTeves", "taanisEsther", "tamuz17", "tishaBav", "yomKippur"].includes(id));
        if (fast) kind = "fast";
        else if (d.ids.includes("simchasTorah")) kind = "simchas";
        else if (d.shabbos || d.yomtov) kind = "shabbos";
        else if (d.ids.includes("purim")) kind = "purim";
        else if (d.erev) kind = "friday";
    }
    const shiurOn = (kind === "weekday" || kind === "purim") && ((h >= 10 && h < 11.5) || (h >= 15 && h < 16.5));
    if (force.kind) kind = force.kind;
    const shiur = force.kind ? force.kind === "shiur" : shiurOn;
    if (force.kind === "shiur") kind = "weekday";
    return { kind, shiur, key: shiur ? "shiur" : kind, quiet: kind === "shabbos" || kind === "fast", fast: kind === "fast", party: kind === "purim" || kind === "simchas",
        fill: shiur ? 0.82 : kind === "shabbos" ? 0.62 : kind === "friday" ? 0.3 : kind === "fast" ? 0.5 : kind === "purim" || kind === "simchas" ? 0.75 : 0.55 };
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
class Pile {
    constructor() { this.g = []; }
    box(w, h, d, x, y, z, hex, ry = 0, rx = 0) { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); g.translate(x, y, z); this.g.push(paint(g, hex)); return this; }
    cyl(r, h, x, y, z, hex, seg = 8, rt = r) { const g = new THREE.CylinderGeometry(rt, r, h, seg); g.translate(x, y, z); this.g.push(paint(g, hex)); return this; }
    ball(r, x, y, z, hex, det = 0) { const g = new THREE.IcosahedronGeometry(r, det); g.translate(x, y, z); this.g.push(paint(g, hex)); return this; }
    geo() { const m = mergeGeometries(this.g.map(g => (g.index ? g.toNonIndexed() : g)), false); for (const g of this.g) g.dispose(); return m; }
}
const VC = () => new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.85 });
const WOOD = "#6B4A2B", WOOD2 = "#9A6B3F", CREAM = "#F1E7D2", BRICK = "#B0694B";

// ── the table (long, a bench either side, four shtenders) ─────────────────
const TBL_L = 5.0;
function tableGeo() {
    const P = new Pile();
    P.box(TBL_L, 0.07, 0.9, 0, 0.78, 0, WOOD2);
    P.box(0.1, 0.75, 0.8, -TBL_L / 2 + 0.3, 0.38, 0, WOOD); P.box(0.1, 0.75, 0.8, TBL_L / 2 - 0.3, 0.38, 0, WOOD);
    for (const s of [-1, 1]) P.box(TBL_L - 0.2, 0.07, 0.34, 0, 0.45, s * 0.85, WOOD2);
    for (const s of [-1, 1]) for (const x of [-1.95, 1.95]) P.box(0.5, 0.28, 0.3, x, 0.99, s * 0.18, WOOD, 0, s * 0.3);        // (the shtenders)
    return P.geo();
}
const SEATX = [-1.95, -0.65, 0.65, 1.95];

// ── build ────────────────────────────────────────────────────────────────
function build(rt) {
    const P = rt.data.P = plan();
    const V = rt.data.V = { P, t: 0, beat: 0, beats: {}, front: 0, in: false, settled: false, mem: [], walkers: [], vape: 0, nod: 0, stats: { staring: 0, buried: 0 }, lunch: !!SAVE.lunch, pop: [], said: pool(["Whoa. It's… a lot of hats.", "Okay. Big building. Very… brown. Everyone's very busy.", "Walk in like you belong. Walk in like you belong."]) };
    rt.root.visible = false;
    rt.cols.length = 0;
    rt.bounds = { x0: X0 + 0.45, x1: X1 - 0.45, z0: ZB + 0.9, z1: ZF - 0.5 };
    const own = rt.own.bind(rt), add = o => rt.add(o);
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });
    const set = rt.set;
    set.sun.castShadow = false;
    set.hemi.color.set(P.quiet ? "#E8E4F2" : "#FFF3DC"); set.hemi.intensity = P.quiet ? 1.05 : 1.45;
    set.sun.color.set("#FFF1D6"); set.sun.intensity = 0.6;
    for (const [n, x, z, I] of [["l1", 0, 4, 6], ["l2", 0, -24, 8], ["l3", 0, -42, 6]]) { const l = rt.pointLight(n, "#FFE9C4", I, 26, 1.4, n !== "l1"); l.position.set(x, CEIL - 1.0, z); }

    // ── the shell (walls, floor, ceiling): ONE mesh under rt.root, so the camera clips to it ──
    const S = new Pile();
    S.box(X1 - X0, 0.1, ZF - ZB, 0, -0.05, (ZF + ZB) / 2, "#C9A878");                                   // the floor
    S.box(X1 - X0, 0.1, 16, 0, -0.04, 2, "#B8946A");                                                      // (the lobby: darker boards)
    S.box(X1 - X0, 0.2, ZF - ZB, 0, CEIL + 0.1, (ZF + ZB) / 2, "#EFE6D2");                                // the ceiling
    S.box(X1 - X0, CEIL, 0.3, 0, CEIL / 2, ZB - 0.15, CREAM);                                             // the back wall
    for (const x of [X0 - 0.15, X1 + 0.15]) S.box(0.3, CEIL, ZF - ZB, x, CEIL / 2, (ZF + ZB) / 2, x < 0 ? "#EADFC4" : "#EADFC4");
    // the front wall with the doorway (x ±1.7)
    S.box(X1 - 1.7, CEIL, 0.3, (X1 + 1.7) / 2, CEIL / 2, ZF + 0.15, BRICK); S.box(1.7 - X0, CEIL, 0.3, (X0 - 1.7) / 2, CEIL / 2, ZF + 0.15, BRICK);
    S.box(3.4, CEIL - 3.6, 0.3, 0, 3.6 + (CEIL - 3.6) / 2, ZF + 0.15, BRICK);
    S.box(0.25, 3.6, 0.4, -1.75, 1.8, ZF + 0.1, "#EFE8D8").box(0.25, 3.6, 0.4, 1.75, 1.8, ZF + 0.1, "#EFE8D8").box(3.75, 0.3, 0.4, 0, 3.75, ZF + 0.1, "#EFE8D8");
    // the archway into the beis (x ±3.3, z −6) + the wall either side
    S.box(X1 - 3.3, CEIL, 0.4, (X1 + 3.3) / 2, CEIL / 2, ZARCH, CREAM); S.box(3.3 - X0, CEIL, 0.4, (X0 - 3.3) / 2, CEIL / 2, ZARCH, CREAM);
    S.box(6.6, CEIL - 4.2, 0.4, 0, 4.2 + (CEIL - 4.2) / 2, ZARCH, CREAM);
    col("archL", X0, -3.3, ZARCH - 0.2, ZARCH + 0.2); col("archR", 3.3, X1, ZARCH - 0.2, ZARCH + 0.2);
    // the coffee room (left): walls at x −7 (a doorway z −3.2 … −0.2) and z 1
    S.box(0.3, CEIL, 2.8, -7, CEIL / 2, -4.6, CREAM).box(0.3, CEIL, 1.2, -7, CEIL / 2, 0.4, CREAM).box(0.3, CEIL - 2.8, 3.0, -7, 2.8 + (CEIL - 2.8) / 2, -1.7, CREAM);
    S.box(7, CEIL, 0.3, -10.5, CEIL / 2, 1, CREAM);
    col("cofE1", -7.2, -6.8, ZARCH, -3.2); col("cofE2", -7.2, -6.8, -0.2, 1.2); col("cofS", X0, -7, 0.85, 1.15);
    // the stair bay (right): a rail along x 7.2, the stairs rising to a landing + the dorm door
    S.box(0.1, 0.95, 7, 7.2, 0.48, -2.5, WOOD2); col("rail", 7.05, 7.35, ZARCH, 1.1);
    for (let i = 0; i < 10; i++) S.box(6.4, 0.32 * (i + 1), 0.62, 10.6, 0.16 * (i + 1), 0.5 - i * 0.65, i % 2 ? "#BDB09A" : "#CFC4AE");
    col("stairs", 7.35, X1, ZARCH, 1.4);
    S.box(1.4, 2.4, 0.12, 12.4, 3.2 + 1.2, ZARCH + 0.5, "#4A3322");                                       // the dorm door (on the landing, 3.2 m up)
    // windows on the side walls (light) + tall windows on the back wall
    for (const z of [-12, -20, -28, -36, -44]) for (const x of [X0 + 0.02, X1 - 0.02]) S.box(0.06, 2.8, 1.5, x, 3.2, z, "#B9DCF2");
    for (const x of [-10, -6, 6, 10]) S.box(1.5, 2.8, 0.06, x, 3.4, ZB + 0.02, "#B9DCF2");
    const shell = new THREE.Mesh(own(S.geo()), own(VC()));
    shell.receiveShadow = false;
    // (the engine raycasts rt.root for the camera: the shell IS the root)
    rt.root.removeFromParent(); rt.root = new THREE.Group(); rt.root.add(shell); add(rt.root);

    // ── furniture (one merged mesh, not raycast) ──
    const F = new Pile();
    // pillars in the row gaps (x ±8.25, z between rows)
    const PIL = [];
    for (const x of [-8.25, 8.25]) for (let i = 0; i < 10; i += 2) { const z = -10 - 3.4 * i - 1.7; PIL.push([x, z]); F.box(0.7, CEIL, 0.7, x, CEIL / 2, z, "#EFE8D8").box(0.9, 0.3, 0.9, x, 0.15, z, "#CFC8B8"); col("pil" + PIL.length, x - 0.4, x + 0.4, z - 0.4, z + 0.4); }
    V.pillars = PIL;
    // the aron kodesh: never interactive (a cabinet behind its parochet; white on a fast day)
    F.box(5.0, 0.3, 1.8, 0, 0.15, ZB + 1.2, WOOD2).box(4.2, 4.4, 0.8, 0, 2.5, ZB + 0.55, WOOD).box(3.4, 3.4, 0.06, 0, 2.2, ZB + 1.0, P.fast ? "#F4F1EA" : "#7B1E3A");
    F.box(0.3, 4.5, 0.4, -2.2, 2.5, ZB + 0.9, WOOD2).box(0.3, 4.5, 0.4, 2.2, 2.5, ZB + 0.9, WOOD2).box(4.9, 0.4, 0.5, 0, 4.9, ZB + 0.9, WOOD2).box(2.4, 0.07, 0.07, 0, 3.4, ZB + 1.05, "#D4AF37");
    col("aron", -2.6, 2.6, ZB, ZB + 2.0);
    // the shiur platform + the rosh yeshiva's chair + a table (just in front of the aron, off to the side)
    F.box(5.2, 0.4, 2.6, PLAT.x + 6.0, 0.2, PLAT.z, WOOD2).box(0.9, 1.2, 0.8, PLAT.x + 6.0, 1.0, PLAT.z - 0.3, WOOD).box(0.6, 0.08, 0.6, PLAT.x + 6.0, 0.8, PLAT.z + 0.25, WOOD2);
    F.box(1.0, 0.1, 1.0, PLAT.x + 4.8, 0.85, PLAT.z + 0.1, "#3E2A1B").box(0.1, 0.9, 0.1, PLAT.x + 4.5, 0.4, PLAT.z, WOOD);
    col("plat", PLAT.x + 3.3, PLAT.x + 8.6, PLAT.z - 1.4, PLAT.z + 1.4);
    // the blackboard (a frame; the chalk is a canvas plane below)
    F.box(5.4, 2.4, 0.12, 10.6, 2.4, ZB + 0.12, "#2E3B33"); F.box(5.6, 2.6, 0.08, 10.6, 2.4, ZB + 0.06, WOOD);
    // the coat-and-hat wall (left, lobby front) — a rail + the hooks (the hats are instanced below)
    F.box(0.2, 2.6, 6.4, X0 + 0.1, 1.6, 5.4, WOOD).box(0.4, 0.1, 6.2, X0 + 0.3, 2.4, 5.4, WOOD2).box(0.4, 0.1, 6.2, X0 + 0.3, 1.6, 5.4, WOOD2).box(0.4, 0.1, 6.2, X0 + 0.3, 0.8, 5.4, WOOD2);
    // the notice board (right, lobby front)
    F.box(0.12, 2.4, 5.6, X1 - 0.08, 1.9, 5.4, "#8D6E4F");
    // the mashgiach's desk + a stool (the lobby's middle)
    F.box(2.6, 0.12, 1.0, 3.4, 0.95, 0.9, WOOD2).box(2.4, 0.9, 0.9, 3.4, 0.45, 0.9, WOOD).box(0.5, 0.06, 0.5, 4.2, 0.55, 2.0, WOOD2).box(0.08, 0.55, 0.08, 4.2, 0.27, 2.0, WOOD);
    col("desk", 2.0, 4.8, 0.3, 1.5);
    // the coffee room: a counter, the urn, cups, a sign
    F.box(5.4, 0.95, 0.9, -10.4, 0.48, -5.3, "#9AA4AD").box(5.5, 0.07, 1.0, -10.4, 0.98, -5.3, "#CFD8DC").cyl(0.28, 0.7, -11.6, 1.38, -5.3, "#B0BEC5", 10).cyl(0.2, 0.3, -9.0, 1.2, -5.3, "#E0E0E0", 8);
    for (let i = 0; i < 8; i++) F.cyl(0.07, 0.12, -10.0 + i * 0.22, 1.08, -5.0, i % 2 ? "#FFFFFF" : "#E53935", 6);
    col("coffee", -13.3, -7.4, -5.9, -4.7);
    // the dorm-pizza stack, a fridge of forty lunches
    F.box(1.1, 2.0, 0.8, -12.6, 1.0, 0.4, "#E8E8EA"); col("fridge", -13.3, -12.0, -0.1, 0.9);
    // the corner table (a vort): a sponge cake, a bottle, plastic cups
    F.box(1.6, 0.08, 1.0, 11.8, 0.78, -10.2, "#F7F3EA").box(1.5, 0.76, 0.9, 11.8, 0.38, -10.2, "#EFEADD").box(0.4, 0.14, 0.3, 11.4, 0.89, -10.2, "#E8C97A").cyl(0.06, 0.3, 12.2, 0.98, -10.2, "#2E7D32", 6);
    col("vort", 10.9, 12.8, -10.8, -9.6);
    // the lobby's own bench by the window + a rubber plant
    F.box(2.4, 0.1, 0.5, -5.2, 0.45, 8.8, WOOD2).box(0.12, 0.4, 0.4, -6.2, 0.2, 8.8, WOOD).box(0.12, 0.4, 0.4, -4.2, 0.2, 8.8, WOOD);
    const furn = new THREE.Mesh(own(F.geo()), own(VC())); add(furn);

    // the chalk on the blackboard + the notice board's notes (canvas planes)
    const bb = textPlane(D.BOARD, { w: 5.0, h: 2.0, bg: "#2E3B33", fg: "#F5F5EF", font: 46 }); bb.position.set(10.6, 2.4, ZB + 0.2); own(bb.material, bb.material.map); add(bb);
    const nb = textPlane(["LOST: one chavrusa", "FOUND: 99 hats", "FREE: mini-fridge", "(works. sometimes.)"], { w: 4.6, h: 1.8, bg: "#EFE6C8", fg: "#4E342E", font: 40 });
    nb.rotation.y = -Math.PI / 2; nb.position.set(X1 - 0.16, 1.9, 5.4); own(nb.material, nb.material.map); add(nb);

    // ── instanced: the tables + the crowd + the hats ──
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), SC = new THREE.Vector3(1, 1, 1), PV = new THREE.Vector3(), UP = THREE.Object3D.DEFAULT_UP;
    const tables = [];
    for (const x of [-11.0, -5.5, 5.5, 11.0]) for (let i = 0; i < 11; i++) if (!(x === 11.0 && i === 0)) tables.push([x, -10 - 3.4 * i]);      // (the corner's the vort's)
    const it = new THREE.InstancedMesh(own(tableGeo()), own(VC()), tables.length);
    tables.forEach(([x, z], i) => { M4.compose(PV.set(x, 0, z), Q.identity(), SC); it.setMatrixAt(i, M4); col("tbl" + i, x - TBL_L / 2, x + TBL_L / 2, z - 1.15, z + 1.15); });
    add(it);
    // a hundred black hats on the hook wall (rows of 20 along z)
    const hg = new Pile().cyl(0.15, 0.04, 0, 0, 0, "#111114", 8).cyl(0.1, 0.16, 0, 0.1, 0, "#111114", 8, 0.095).geo();
    const ih = new THREE.InstancedMesh(own(hg), own(VC()), 101);
    for (let i = 0; i < 100; i++) { M4.compose(PV.set(X0 + 0.45, 0.95 + Math.floor(i / 20) * 0.4, 2.5 + (i % 20) * 0.3), Q.setFromAxisAngle(UP, Math.PI / 2), SC); ih.setMatrixAt(i, M4); }
    M4.makeScale(0, 0, 0); ih.setMatrixAt(100, M4);                                                       // (the empty hook's hat: the one she returns)
    add(ih); V.hats = ih;
    // the crowd: bodies (static), heads + hats (animated: the reaction wave, the shiur's nods)
    const seats = [];
    tables.forEach(([x, z], ti) => { for (const s of [-1, 1]) for (const dx of SEATX) seats.push({ x: x + dx, z: z + s * 0.9, ry: s > 0 ? Math.PI : 0, ti, row: Math.round((-10 - z) / 3.4) }); });
    let rs = 11; const rnd = () => (rs = (rs * 16807) % 2147483647) / 2147483647;
    const keep = seats.filter(s => !(Math.abs(s.x - 3.85) < 0.3 && Math.abs(s.z + 36.3) < 0.3) && !(Math.abs(s.x + 3.85) < 0.3 && Math.abs(s.z + 20.2) < 0.9) && rnd() < P.fill);
    V.mem = keep.map(s => ({ x: s.x, z: s.z, ry: s.ry, st: 0, t: 0, calm: 0, yaw: s.ry, pit: 0, ph: rnd() * 6.28, hat: rnd() < 0.72, row: s.row, dz: 0 }));
    const bodyG = new Pile().box(0.46, 0.55, 0.3, 0, 0.82, 0, "#F4F4F6").box(0.5, 0.3, 0.32, 0, 0.7, 0.01, "#1D1D22").box(0.34, 0.3, 0.14, 0, 0.62, 0.3, "#1D1D22").box(0.5, 0.16, 0.5, 0, 0.5, 0.2, "#16161A").geo();
    const headG = new Pile().ball(0.13, 0, 0, 0, "#E9B98F", 0).geo(), hatG = new Pile().cyl(0.2, 0.03, 0, 0.1, 0, "#0E0E11", 8).cyl(0.13, 0.12, 0, 0.17, 0, "#0E0E11", 8, 0.125).geo();
    const nM = V.mem.length;
    V.ib = new THREE.InstancedMesh(own(bodyG), own(VC()), nM); V.ih = new THREE.InstancedMesh(own(headG), own(VC()), nM); V.ihat = new THREE.InstancedMesh(own(hatG), own(VC()), nM);
    V.ih.instanceMatrix.setUsage(THREE.DynamicDrawUsage); V.ihat.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const tints = ["#ffffff", "#e9eef5", "#f1ece0", "#dfe7f0"], C = new THREE.Color();
    V.mem.forEach((m, i) => { M4.compose(PV.set(m.x, 0, m.z), Q.setFromAxisAngle(UP, m.ry), SC); V.ib.setMatrixAt(i, M4); V.ib.setColorAt(i, C.set(tints[i % 4])); });
    V.ib.frustumCulled = V.ih.frustumCulled = V.ihat.frustumCulled = false;
    add(V.ib); add(V.ih); add(V.ihat);
    headsUpdate(rt, V, 0, true);
    // the corner vort: four friends round a table; on Purim / Simchas Torah the whole room is in a better mood
    V.vortN = P.party ? 8 : 4;
    // ── the cast ──
    cast(rt, V, P);
    hotspots(rt, V, P);
    rt.spots.door = { x: 0, z: ZF - 0.7, ry: Math.PI };
    emit("yeshiva:enter", { kind: P.key });
    SAVE.visits++; saveSoon();
    rt.wait(1.2).then(() => { if (!rt.disposed) rt.bubble(V.said(), rt.lulu.obj, 3.2); });
}

// ── people ───────────────────────────────────────────────────────────────
const BLK = { Top: "#1D1D22", Bottom: "#1D1D22", Shoes: "#111111", Kippah: "#111111" };
function cast(rt, V, P) {
    const mk = (id, key, x, z, ry, o = {}) => { const r = rt.person(id, key, { x, z, ry }, Object.assign({ faceLulu: false, colors: BLK, collide: false }, o)); r.far = true; return r; };
    const shirt = c => ({ Top: c, Bottom: "#1D1D22", Shoes: "#111111", Kippah: "#111111" });
    const mash = mk("mash", "hillelPerson", 10.5, -3.0, Math.PI, { name: "The mashgiach", colors: { Top: "#26262B", Bottom: "#26262B", Tie: "#4E342E" } });
    mash.p.obj.visible = false; rt.hold(mash.p, "Clipboard", { y: -0.45, z: 0.1 });
    mk("carguy", "npcMan", -5.2, 8.0, 0, { name: "A bochur at the window", colors: shirt("#F4F4F6") });
    mk("shid", "npcMan", 12.4, 5.2, Math.PI / 2, { name: "The shidduch-list guy", colors: shirt("#E3EAF3") });
    if (!P.quiet) mk("pizza", "npcMan", 6.6, 5.6, -Math.PI / 2, { name: "The pizza guy", colors: { Top: "#C62828", Bottom: "#37474F" } });
    mk("vape", "npcMan", 11.2, -1.4, -Math.PI / 2, { name: "A bochur on the stairs", colors: shirt("#E3EAF3"), pose: { sit: true }, y: 0.7 });
    mk("cA", "npcMan", -3.85, -19.35, Math.PI, { name: "A chavrusa", colors: shirt("#F4F4F6"), pose: { sit: true, talk: true }, y: 0.12 });
    mk("cB", "npcMan", -3.85, -21.05, 0, { name: "His chavrusa", colors: shirt("#E9EEF5"), pose: { sit: true, talk: true }, y: 0.12 });
    const sl = mk("sleep", "npcMan", 3.85, -36.3, Math.PI, { name: "Yossi (asleep)", colors: shirt("#F1ECE0"), pose: { sit: true }, y: 0.12 });
    sl.post = (p) => { if (p.limbs.Body) p.limbs.Body.rotateX(0.75); };
    mk("pillar", "npcMan", -4.2, -11.7, -Math.PI / 2, { name: "A bochur", colors: shirt("#F4F4F6") });
    const hid = mk("hider", "npcMan", 3.0, -16.5, Math.PI, { name: "A bochur (a shtender)", colors: shirt("#E3EAF3") }); hid.p.obj.visible = false;
    if (P.shiur) { const rosh = mk("rosh", "hillelPerson", PLAT.x + 4.8, PLAT.z + 0.55, Math.PI, { name: "The rosh yeshiva", colors: { Top: "#202024", Bottom: "#202024", Tie: "#202024" }, pose: { sit: true, talk: true }, y: 0.4 }); rosh.p.obj.rotation.y = Math.PI; }
    V.cast = true;
}

// ── the crowd: heads + hats follow the wave ──────────────────────────────
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), PV = new THREE.Vector3(), SV = new THREE.Vector3(1, 1, 1);
function headsUpdate(rt, V, dt, force) {
    const L = rt.lulu.obj.position, P = V.P, t = V.t;
    let stare = 0, buried = 0;
    for (let i = 0; i < V.mem.length; i++) {
        const m = V.mem[i], d = Math.hypot(L.x - m.x, L.z - m.z);
        if (dt > 0) {
            if (m.st === 0) { if (V.in && d < Math.min(V.front, 16)) { m.st = 1; m.t = 0.5 + Math.random() * 1.0 + d * 0.025; } }
            else if (m.st === 1) { m.t -= dt; if (m.t <= 0) m.st = 2; }
            else if (m.st === 2) { if (d > (V.settled ? 9 : 19) || !V.in) { m.calm += dt; if (m.calm > (V.settled ? 1.5 : 4)) { m.st = 0; m.calm = 0; } } else m.calm = 0; }
        }
        if (m.st === 1) stare++; else if (m.st === 2) buried++;
        // targets
        let ty = m.ry, tp = 0, th = 0;
        if (P.shiur) { ty = Math.atan2(PLAT.x + 5 - m.x, PLAT.z - m.z); tp = Math.sin(t * (0.7 + (m.ph % 1.7)) + m.ph) * 0.13; }
        if (P.party) tp = Math.abs(Math.sin(t * 5 + m.ph)) * 0.18 - 0.05;
        if (m.st === 1) { ty = Math.atan2(L.x - m.x, L.z - m.z); tp = -0.18; th = 0.02; }              // heads up, turned to her: the stare
        else if (m.st === 2) { ty = m.ry; tp = 0.95 + Math.sin(t * 3 + m.ph) * 0.05; th = -0.1; }       // snapped back to the Gemara
        const k = 1 - Math.exp(-(m.st === 2 ? 14 : 6) * (dt || 1));
        let dy = ty - m.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        m.yaw += dy * k; m.pit += (tp - m.pit) * k; m.dz += (th - m.dz) * k;
        E.set(m.pit, m.yaw, 0, "YXZ"); Q.setFromEuler(E);
        PV.set(m.x, 1.25 + m.dz, m.z); M.compose(PV, Q, SV); V.ih.setMatrixAt(i, M);
        if (m.hat) V.ihat.setMatrixAt(i, M.compose(PV, Q, SV)); else { M.makeScale(0, 0, 0); V.ihat.setMatrixAt(i, M); }
    }
    V.ih.instanceMatrix.needsUpdate = true; V.ihat.instanceMatrix.needsUpdate = true;
    V.stats.staring = stare; V.stats.buried = buried;
}

// ── the five beats ───────────────────────────────────────────────────────
function say(rt, id, text, secs = 2.6) { const r = rt.byId[id]; if (r && r.p.obj.visible) rt.bubble(text, r.p.obj, secs); }
function waveTick(rt, V, dt) {
    const L = rt.lulu.obj.position, P = V.P;
    const inBeis = L.z < ZARCH + 0.3;
    if (inBeis && !V.in) { V.in = true; V.front = 0; }
    if (V.in) V.front += dt * 11;
    // beat 1 — the doorway: the nearest few stop mid-word (once she's a few steps in)
    if (V.beat < 1 && L.z < 6.5) {
        V.beat = 1; V.beats[1] = V.t;
        ["carguy", "shid", "pizza"].forEach((id, i) => { const r = rt.byId[id]; if (r) { r.stop = 2.6; rt.bubble(D.BEAT.lobby[i % 3], r.p.obj, 2.6); r.p.obj.rotation.y += 0; } });
    }
    // beat 2 — heads snap to their Gemaras (the instanced crowd does it as the front reaches them)
    if (V.beat < 2 && inBeis) { V.beat = 2; V.beats[2] = V.t; rt.bubble(D.BEAT.snap, rt.byId.cA ? rt.byId.cA.p.obj : rt.lulu.obj, 3.4); if (rt.byId.cA) rt.byId.cA.pose = { sit: true }; if (rt.byId.cB) rt.byId.cB.pose = { sit: true }; }
    // beat 3 — a bochur walks into a pillar; one hides behind a shtender
    if (V.beat < 3 && L.z < -12) {
        V.beat = 3; V.beats[3] = V.t;
        const pr = rt.byId.pillar; if (pr) pr.go = { x: -7.7, z: -11.7, t: 0, then: "bonk" };
        const h = rt.byId.hider; if (h) { h.p.obj.visible = true; h.p.obj.scale.y = 0.68; rt.bubble(pick(D.BEAT.hider), h.p.obj, 3.2); }
    }
    // beat 4 — "mashgiach!": he appears with a clipboard and walks over
    if (V.beat < 4 && (L.z < -24 || (V.beats[3] != null && V.t - V.beats[3] > 9))) {
        V.beat = 4; V.beats[4] = V.t;
        const mg = rt.byId.mash;
        if (mg) { mg.p.obj.visible = true; mg.p.obj.position.set(2.8, 0, ZARCH + 0.4); mg.go = { x: 0, z: 0, t: 0, then: "ask", follow: true }; }
        const c = rt.byId.cB; if (c) rt.bubble(pick(D.BEAT.psst), c.p.obj, 2.6);
    }
    // the mashgiach walks to her (a polite 2.6 m/s), then asks
    const mg = rt.byId.mash;
    if (mg && mg.go && mg.go.follow && !rt.busy && !ctx.dialogOpen) {
        const o = mg.p.obj, dx = L.x - o.position.x, dz = L.z - o.position.z, d = Math.hypot(dx, dz);
        if (d > 2.2) { const s = Math.min(2.6 * dt, d - 2.0); o.position.x += dx / d * s; o.position.z += dz / d * s; o.rotation.y = Math.atan2(dx, dz); mg.pose = { walk: 2.4 }; }
        else { mg.pose = {}; o.rotation.y = Math.atan2(dx, dz); mg.go = null; mashgiachAsks(rt, V); }
    }
}
async function mashgiachAsks(rt, V) {
    const mg = rt.byId.mash, P = V.P, carrying = !!SAVE.lunch;
    rt.busy = true;
    try {
        const asked = rt.choose("The mashgiach", D.MASHGIACH.hello, D.MASHGIACH.options, { person: mg, emoji: "📋", color: "#4E342E" });
        const i = force.answer != null ? force.answer : await asked;        // (force.answer: tests pick an option)
        if (i === 0) { await rt.say("The mashgiach", carrying ? D.MASHGIACH.lunch : D.MASHGIACH.noLunch, { person: mg, emoji: "📋" }); }
        else if (i === 1) await rt.say("The mashgiach", D.MASHGIACH.look, { person: mg, emoji: "📋" });
        else if (i === 2) await rt.say("The mashgiach", D.MASHGIACH.entrance, { person: mg, emoji: "📋" });
        else {
            await rt.say("The mashgiach", D.MASHGIACH.leave, { person: mg, emoji: "📋" });
            V.settled = true; emit("stat", { id: "yeshivaWaves", n: 1 }); SAVE.waves++; saveSoon();
            rt.busy = false;
            await rt.walkTo(0, ZF - 1.2, 14);
            if (!rt.disposed) { rt.bubble(D.MASHGIACH.goodbye, mg.p.obj, 3.0); rt.leave(); }
            return;
        }
        // beat 5 — he's settled it: the room hums back
        V.beat = 5; V.settled = true; V.beats[5] = V.t; SAVE.waves++; saveSoon();
        emit("stat", { id: "yeshivaWaves", n: 1 });
        rt.bubble(D.MASHGIACH.clip, mg.p.obj, 3.2);
        rt.wait(2.2).then(() => { if (!rt.disposed) rt.bubble(pick(D.BEAT.settle), rt.lulu.obj, 4.0); });
        mg.stay = { x: L2(rt).x - 3, z: L2(rt).z + 1.5 };
    } finally { rt.busy = false; }
}
const L2 = rt => rt.lulu.obj.position;

// ── hot-spots (✋ lines) ─────────────────────────────────────────────────
const pools = {};
const line = (key, arr) => (pools[key] || (pools[key] = pool(arr)))();

function hotspots(rt, V, P) {
    const has = id => !!rt.byId[id];
    const who = (id, nm, arr, key, emoji, extra = {}) => Object.assign({ id, who: id, track: true, r: 1.5, label: `${emoji} ${nm}`, action: rt => rt.say(rt.byId[id].name, line(key, arr), Object.assign({ person: rt.byId[id], emoji }, extra)) }, extra.at || {});
    rt.hot({ id: "notice", x: X1 - 1.2, z: 5.4, r: 1.7, label: "📋 The notice board", action: rt => rt.say("The notice board", line("notice", D.NOTICE), { emoji: "📋", color: "#6D4C41" }) });
    rt.hot({ id: "hats", x: X0 + 1.2, z: 5.4, r: 1.9, label: "🎩 The coat-and-hat wall", action: hatsAction });
    rt.hot({ id: "coffee", x: -9.6, z: -3.8, r: 1.7, label: "☕ The coffee room", action: rt => rt.say("Lulu", line("coffee", P.fast ? D.COFFEE.closed : D.COFFEE.open), { emoji: "☕", color: "#6D4C41" }) });
    rt.hot({ id: "dorm", x: 6.2, z: -1.5, r: 1.8, label: "🪜 The dorm stairs", action: rt => rt.say("Lulu", line("dorm", D.DORM), { emoji: "🪜", color: "#4E342E" }) });
    rt.hot({ id: "fridge", x: -11.5, z: 1.8, r: 1.4, label: "🥪 The lunch fridge", action: rt => rt.say("Lulu", D.FRIDGE[0], { emoji: "🥪" }) });
    rt.hot({ id: "vort", x: 11.0, z: -8.3, r: 1.9, label: "🥂 A little l'chaim", action: rt => rt.say("Lulu", line("lchaim", D.LCHAIM[P.kind === "purim" ? "purim" : P.kind === "simchas" ? "simchas" : "plain"]), { emoji: "🥂" }) });
    if (has("carguy")) rt.hot(who("carguy", "The guy who knows every car", D.CARS, "cars", "🚐"));
    if (has("shid")) rt.hot(who("shid", "The shidduch-list guy", D.SHIDDUCH, "shid", "📑"));
    if (has("pizza")) rt.hot({ id: "pizza", who: "pizza", track: true, r: 1.5, label: "🍕 The pizza guy", action: async rt => {
        const i = await rt.choose("The pizza guy", line("pizza", D.PIZZA), ["🍕 How's business?", "🧭 Directions to… somewhere"], { person: rt.byId.pizza, emoji: "🍕" });
        if (i === 1) await rt.say("The pizza guy", line("dirs", D.DIRECTIONS), { person: rt.byId.pizza, emoji: "🧭" });
    } });
    if (has("vape")) rt.hot(Object.assign(who("vape", "A bochur on the stairs", D.VAPER, "vape", "☁️"), { track: false, x: 6.2, z: -0.4, r: 1.7 }));
    if (has("cA")) rt.hot({ id: "chav", who: "cA", r: 1.8, x: -2.5, z: -20.2, label: "📖 The chavrusa", action: rt => rt.say("A chavrusa", line("chav", D.CHAVRUSA), { person: rt.byId.cA, emoji: "📖" }) });
    if (has("sleep")) rt.hot({ id: "sleep", who: "sleep", r: 1.7, x: 2.5, z: -36.3, label: "😴 Row nine", action: sleepAction });
    if (has("pillar")) rt.hot({ id: "pillar", who: "pillar", track: true, r: 1.5, label: "🧱 A bochur (and a pillar)", enabled: () => !!rt.data.V.beats[3], action: rt => rt.say("A bochur", line("pil", D.BEAT.pillar), { person: rt.byId.pillar, emoji: "🧱" }) });
    // the shiur (on its hours) / the empty chair
    if (P.shiur) {
        rt.hot({ id: "shiur", who: "rosh", x: 2.4, z: -46.2, r: 2.9, label: "🎓 Listen to the shiur", action: shiurAction });
    } else rt.hot({ id: "chair", x: 2.4, z: -46.2, r: 2.9, label: "🪑 The rosh yeshiva's chair", action: rt => rt.say("Lulu", line("chair", D.SHIUR_NO), { emoji: "🪑" }) });
}
async function hatsAction(rt) {
    const S = store("homes", { fam: {}, souvenirs: [] }), V = rt.data.V;
    const i = (S.souvenirs || []).findIndex(x => x.id === "hat");
    if (i >= 0) {                                              // the black hat she took from someone's house: it goes back on its hook
        S.souvenirs.splice(i, 1); saveSoon(); SAVE.hats++;
        const M4 = new THREE.Matrix4(); M4.compose(new THREE.Vector3(X0 + 0.45, 0.95 + 4 * 0.4, 2.5 + 19 * 0.3 + 0.3), new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP, Math.PI / 2), new THREE.Vector3(1, 1, 1));
        V.hats.setMatrixAt(100, M4); V.hats.instanceMatrix.needsUpdate = true;
        emit("stat", { id: "yeshivaHats", n: 1 });
        return rt.say("Lulu", line("hatback", D.HAT_BACK), { emoji: "🎩" });
    }
    return rt.say("Lulu", line("hats", D.HATS), { emoji: "🎩" });
}
async function sleepAction(rt) {
    if (SAVE.lunch) {                                          // the forgotten lunch → Yossi
        SAVE.lunch = ""; SAVE.lunches++; saveSoon();
        emit("stat", { id: "yeshivaLunches", n: 1 }); emit("yeshiva:lunch", {});
        const r = rt.byId.sleep; if (r) { r.pose = { sit: true, talk: true }; r.post = null; }
        rt.data.V.lunch = false;
        return rt.say("Yossi", line("lunchgive", D.LUNCH_GIVE), { person: r, emoji: "🥪" });
    }
    return rt.say("Yossi (asleep)", line("sleep", D.SLEEPER), { person: rt.byId.sleep, emoji: "😴" });
}
async function shiurAction(rt) {
    const V = rt.data.V, topic = V.topic || (V.topic = pick(D.SHIUR)), n = V.step = Math.min(topic.steps.length, (V.step || 0));
    await rt.say(`🎓 ${topic.title}`, topic.steps[n], { person: rt.byId.rosh, emoji: "🎓", color: "#37474F" });
    V.step = n + 1;
    if (V.step >= topic.steps.length) { V.step = 0; V.topic = null; SAVE.shiurs++; saveSoon(); emit("stat", { id: "yeshivaShiurs", n: 1 }); }
}

// ── per frame ────────────────────────────────────────────────────────────
function tick(rt, dt) {
    const V = rt.data.V;
    V.t += dt;
    const L = rt.lulu.obj.position, free = !ctx.dialogOpen;
    if (free || true) waveTick(rt, V, dt);
    if (V.in && L.z > ZARCH + 2.2 && !V.settled) { V.in = false; V.front = 0; }                         // (she stepped back out: it calms)
    // rigs: freeze on beat 1, walk-ons, LOD
    for (const r of rt.people) {
        const o = r.p.obj, d = Math.hypot(o.position.x - L.x, o.position.z - L.z);
        if (r.far) o.visible = r.id === "mash" ? o.visible : r.id === "hider" ? (o.visible && true) : d < 36;
        if (r.stop > 0) { r.stop -= dt; }
        if (r.go && !r.go.follow) {
            const g = r.go, dx = g.x - o.position.x, dz = g.z - o.position.z, dd = Math.hypot(dx, dz);
            if (dd > 0.25) { o.position.x += dx / dd * 1.5 * dt; o.position.z += dz / dd * 1.5 * dt; o.rotation.y = Math.atan2(dx, dz); r.pose = { walk: 1.6 }; }
            else {
                r.pose = {}; r.go = null;
                if (g.then === "bonk") { rt.bubble(pick(D.BEAT.pillar), o, 3.0); rt.burst(new THREE.Vector3(o.position.x, 1.7, o.position.z), ["#FFD740", "#FFFFFF"], 8, 1.2, 0.05); o.position.x += 0.35; emit("stat", { id: "yeshivaBonks", n: 1 }); }
            }
        }
        if (r.id === "mash" && r.stay && !r.go) { const dx = r.stay.x - o.position.x, dz = r.stay.z - o.position.z; if (Math.hypot(dx, dz) > 0.4) { o.position.x += dx * 0.6 * dt; o.position.z += dz * 0.6 * dt; r.pose = { walk: 0.8 }; } else r.pose = {}; }
        if (r.stop > 0 && !r.go) r.pose = Object.assign({}, r.pose, { talk: false, walk: 0 });
    }
    // the chavrusas argue (a bubble each, a few seconds apart) until the wave hushes them
    V.argueT = (V.argueT || 3) - dt;
    if (V.argueT <= 0 && !V.settled && V.beat < 2 && !rt.busy && !V.P.quiet) {
        V.argueT = 5.5 + Math.random() * 4; const a = Math.random() < 0.5 ? "cA" : "cB", r = rt.byId[a];
        const d = r ? Math.hypot(r.p.obj.position.x - L.x, r.p.obj.position.z - L.z) : 99;
        if (r && d < 14) rt.bubble(pick(["It's YOUR turn!", "A SMALL one doesn't count!", "I bought LAST time!", "…no, read it again."]), r.p.obj, 2.4);
    }
    // the stair-vaper's humidifier (a thin cloud off the stairs)
    V.vape -= dt;
    if (V.vape <= 0) { V.vape = 3.2 + Math.random() * 2.5; const r = rt.byId.vape; if (r && r.p.obj.visible) rt.particles.emit(r.p.obj.position.x - 0.3, 1.5, r.p.obj.position.z, 0.1, 0.5, 0, 0.16, 1.8, "#F4F4F8", -0.2); }
    // the crowd (heads + hats) — every frame while anything's moving, else at a gentle rate
    V.hu = (V.hu || 0) + dt;
    if (V.in || V.P.shiur || V.P.party || V.stats.staring + V.stats.buried > 0 || V.hu > 0.5) { headsUpdate(rt, V, V.hu, false); V.hu = 0; }
    // pillar guy: stand idle (a quiet bochur at a pillar) until beat 3
}

export function dispose(rt) { /* (the engine frees the set; the instanced meshes + textures were rt.own'd) */ }

export const yeshivaDef = defineInterior({
    id: "yeshiva", name: D.NAMES.name, short: D.NAMES.short, emoji: "🎓", title: D.NAMES.title, tagline: "",
    model: "homesKit", models: ["npcMan", "hillelPerson"],
    music: "../story-relax.mp3", light: "indoor", sky: "#d9cbb0", ceil: CEIL, walkSpeed: 3.5,
    bounds: { x0: X0 + 0.45, x1: X1 - 0.45, z0: ZB + 0.9, z1: ZF - 0.5 },
    cam: { dist: 8.4, height: 6.0, orbitDist: 5.2 },
    build, tick, dispose,
});
