// features/places/roadside.js — 🚔🚑 JAIL, COURT AND THE ER ON THE HIGHWAY (ci/roadside; the owner, 2026-11-27: "add more
// hospitals and different prisons/jails/courts to the highway so people don't end up back in the city if they drove a bit").
//
// Three short pull-offs, each ONCE a lap at a fixed lap metre (world.js LAP — the same place every lap, every friend's
// screen), with a fixed address ("hw:…", like the rest areas'):
//   🚔 TROOPER POST 7     6.8 km  hw:trooper · hw:court  the barracks (two-bunk holding cell, a first-aid room) + its
//                                                       impound yard + the HIGHWAY TRAFFIC COURT in a double-wide next door
//   🚑 HATZALAH STATION  10.7 km  hw:hatzalah           a two-bay garage, an ambulance, Yossi the very calm medic
//   ⚖️ THE WEIGH STATION 15.7 km  hw:weigh · hw:clinic   a scale house with a one-bunk lock-up + a judge on a video screen,
//                                                       an impound corner, and DOC-IN-A-BOX (a mint-green clinic) next door
// They halve the lap's gaps (the coordinator, 2026-11-27): the worst a jail / court is from anywhere is ~2.6 km (inside
// JFK's zone), a hospital / clinic ~2.0 km.
// ONE rule (`nearest(kind)`): an arrest / a knock-out takes her to the nearest place of that kind ALONG THE LAP from where
// it happened, either way round, the towns' buildings included (Midwood 3.6 km, Lakewood 12 km) — places/out.js claim().
// The scenes are law's / the ER's as always (same fines, bail, bills); only the door she walks out of is here.
// Everything is code-built boxes (one model per place, shared materials: cheap on phones).
import * as THREE from "three";
import { ctx, on, emit, setState } from "../../core/ctx.js";
import { models } from "../../models.js";
import { LAP, lapS, facingRoad } from "../../world.js";
import { addPlace, sayAt } from "../world/places.js";

const pick = a => a[Math.floor(Math.random() * a.length)];

// ── the data ────────────────────────────────────────────────────────────
/** Doors are model-local (+Z toward the road): the door itself; `spot` (what ctx.civic.spot gives) is 2.5 m out from it. */
export const ROADSIDE = [
    {
        id: "trooper", addr: "hw:trooper", court: "hw:court", m: 6800, kinds: ["law", "er"], emoji: "🚔", name: "Trooper Post 7", short: "Trooper Post",
        sign: { bg: "#263238", lines: ["★ STATE TROOPERS", "POST 7 · TRAFFIC COURT", "NEXT RIGHT"] },
        doors: { precinct: { x: -14, z: -5 }, court: { x: 9, z: -6 }, impound: { x: 24, z: -2 }, hospital: { x: -25, z: -5 } }, park: { x: -2, z: 4 }, car: { x: 24, z: -8 },
        names: {
            precinct: { name: "Trooper Post 7", title: "🚔 TROOPER POST 7 — STATE POLICE", tagline: "Sunflower seeds · patience · paperwork" },
            court: { name: "the Highway Traffic Court", title: "⚖️ HIGHWAY TRAFFIC COURT — (IT'S A TRAILER)", tagline: "Judge Kessler presiding · tee time at 2" },
            hospital: { name: "the Trooper Post's first-aid room", title: "🩹 TROOPER POST 7 — FIRST AID", tagline: "a cot, a kit, Trooper Ruthie" },
        },
        hello: ["Sgt. Feldman, from the porch: 'Slow down, kiddo. The road's not going anywhere. It's a LOOP.'", "*crunch* *crunch* — Sgt. Feldman, eating sunflower seeds, nods at you."],
    },
    {
        id: "hatzalah", addr: "hw:hatzalah", m: 10700, kinds: ["er"], emoji: "🚑", name: "Hatzalah Highway Station", short: "Hatzalah",
        sign: { bg: "#1565C0", lines: ["H  HATZALAH", "HIGHWAY STATION", "NEXT RIGHT"] },
        doors: { hospital: { x: 10.5, z: -3 } }, park: { x: 0, z: 4 },
        names: { hospital: { name: "Hatzalah Highway Station", title: "🚑 HATZALAH HIGHWAY STATION", tagline: "open 24/6 · calm since 1979" } },
        hello: ["Yossi waves from the garage: 'You look fine. Have a rugelach.'", "*the ambulance radio crackles* '…and that's why you don't eat gas-station sushi. Over.'"],
    },
    {
        id: "weigh", addr: "hw:weigh", court: "hw:weigh", clinic: "hw:clinic", m: 15700, kinds: ["law", "er"], emoji: "⚖️", name: "the Weigh Station", short: "Weigh Station",
        sign: { bg: "#455A64", lines: ["WEIGH STATION · OPEN", "LOCK-UP · URGENT CARE", "NEXT RIGHT"] },
        doors: { precinct: { x: -10, z: -4 }, court: { x: -6, z: -4 }, impound: { x: -19.5, z: -3 }, hospital: { x: 10, z: -3 } }, park: { x: 2, z: 4 }, car: { x: -19.5, z: -8 },
        names: {
            precinct: { name: "the Weigh Station", title: "⚖️ THE WEIGH STATION — LOCK-UP", tagline: "trucks weighed · drivers judged · one bunk" },
            court: { name: "the Weigh Station's video court", title: "📺 THE WEIGH STATION — VIDEO COURT", tagline: "Judge Pfeffer, live (mostly) from Boca" },
            hospital: { name: "Doc-in-a-Box", title: "🩹 DOC-IN-A-BOX — URGENT CARE", tagline: "no appointment · no idea · no problem" },
        },
        hello: ["Officer Dot, from the scale house: 'You're not a truck, hon. But you can still say hi.'", "The scale's display flickers: 'YOUR CAR: 1 MINIVAN. ACCEPTABLE.'"],
    },
];
export const BY_ID = Object.fromEntries(ROADSIDE.map(R => [R.id, R]));
/** Which civic kind a door is: precinct / court / impound → law; hospital → er. */
const KIND_OF = { precinct: "law", court: "law", impound: "law", hospital: "er" };
const PLACE_D = 30;               // (the model's origin: 30 m off the road's centre, right side)

// ── where each one stands on THIS lap ───────────────────────────────────
const hw = () => ctx.world && (ctx.world.highway || ctx.world.road);
/** The copy of R nearest highway metre s (either way round — the same place every lap). */
export function copyS(R, s) {
    const k = Math.round((s - R.m) / LAP);
    return k * LAP + R.m;
}
/** Model-local → world for the copy at s. */
function frame(s) {
    const road = hw(), p = road.point(s, PLACE_D, {}), h = road.at(s).h, rot = facingRoad(h, 1);
    return { s, x: p.x, z: p.z, h, rot, c: Math.cos(rot), sn: Math.sin(rot) };
}
const toW = (F, x, z) => ({ x: F.x + x * F.c + z * F.sn, z: F.z - x * F.sn + z * F.c });
/** The door spot of `door` at the copy of R at s, the civic spot shape (x, z on the sidewalk line; n out toward the road). */
export function doorSpot(R, door, s) {
    const D = R.doors[door];
    if (!D) return null;
    const F = frame(s), dw = toW(F, D.x, D.z), at = toW(F, D.x, D.z + 2.5);
    const nx = F.sn, nz = F.c, ux = F.c, uz = -F.sn;
    const addr = door === "court" && R.court ? R.court : door === "hospital" && R.clinic ? R.clinic : R.addr;
    const sp = { x: at.x, z: at.z, nx, nz, ux, uz, rot: F.rot, door: dw, hw: R.id, addr, s };
    if (door === "impound" && R.car) { const c = toW(F, R.car.x, R.car.z); sp.car = { x: c.x, z: c.z, h: F.rot + Math.PI }; sp.cx = c.x; sp.cz = c.z; }
    // the parking stalls out front, nose-in toward the building (partners' cars side by side)
    sp.kerbAt = ahead => { const k = toW(F, R.park.x + ahead * 0.6, R.park.z), n = road().nearest(k.x, k.z, s, {}); return { x: k.x, z: k.z, h: F.rot + Math.PI, s: n.s, d: n.d }; };
    return sp;
}
const road = () => hw();

/** Her lap metre now (in a town: its exit's). */
function lapNow() {
    const T = ctx.town;
    if (T && T.active && T.highwayS != null) return lapS(T.highwayS);
    return lapS(ctx.car ? ctx.car.s : 0);
}
const around = (a, b) => { const d = Math.abs(((a - b) % LAP + LAP) % LAP); return Math.min(d, LAP - d); };
/**
 * THE rule: the nearest place of `kind` (law | er) along the lap from lap metre `m`, either way round — the towns' civic
 * buildings (their exits' lap metres) and the roadside ones. → { town: id } | { hw: R } with its distance, or null.
 */
export function nearest(kind, m = lapNow()) {
    const out = [];
    const T = ctx.town;
    if (T && T.towns && T.exitOf) for (const id of Object.keys(T.towns)) {
        const def = T.towns[id];
        if (!def.attach || !def.uses || !def.uses.civic || !def.uses.hospital) continue;
        let s = null;
        try { s = T.exitOf(id, 0); } catch (e) { s = null; }
        if (s != null) out.push({ town: id, m: lapS(s), d: around(m, lapS(s)) });
    }
    for (const R of ROADSIDE) if (R.kinds.includes(kind)) out.push({ hw: R, m: R.m, d: around(m, R.m) });
    out.sort((a, b) => a.d - b.d);
    return out[0] || null;
}

// ── the models: code-built, one per place (shared materials) ───────────
const MAT = {};
const mat = (c, o = {}) => MAT[c + JSON.stringify(o)] || (MAT[c + JSON.stringify(o)] = new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.9 }, o)));
function textMat(lines, bg, fg = "#fff", w = 512, h = 160) {
    const key = "t:" + lines.join("|") + bg;
    if (MAT[key]) return MAT[key];
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
    lines.forEach((t, i) => { const fs = i === 0 ? h * 0.36 : h * 0.2; g.font = `800 ${fs}px Fredoka, Arial, sans-serif`; g.fillText(t, w / 2, h * (lines.length === 1 ? 0.5 : 0.34 + i * 0.3)); });
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    return (MAT[key] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
}
const GEO = {};
const boxG = () => GEO.box || (GEO.box = new THREE.BoxGeometry(1, 1, 1));
const planeG = () => GEO.plane || (GEO.plane = new THREE.PlaneGeometry(1, 1));
function box(g, m, x0, x1, y0, y1, z0, z1) {
    const o = new THREE.Mesh(boxG(), m);
    o.scale.set(x1 - x0, y1 - y0, z1 - z0); o.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    o.castShadow = y1 - y0 > 1; o.receiveShadow = true;
    g.add(o); return o;
}
function sign(g, lines, bg, x, y, z, w, h, fg) {
    const o = new THREE.Mesh(planeG(), textMat(lines, bg, fg)); o.scale.set(w, h, 1); o.position.set(x, y, z); g.add(o); return o;
}
/** The apron every pull-off has: asphalt from the shoulder to behind the buildings + white stall lines. */
function apron(g, x0, x1) {
    box(g, mat("#5b5f63"), x0, x1, 0, 0.06, -15, 22.5);
    for (let x = x0 + 3; x < x1 - 2; x += 3.2) box(g, mat("#f4f4f4"), x - 0.06, x + 0.06, 0.06, 0.075, 1.5, 6.5);
}
function door(g, x, z, c = "#4e342e") { box(g, mat(c), x - 0.6, x + 0.6, 0, 2.2, z, z + 0.08); box(g, mat("#ffd54f", { emissive: "#ffb300", emissiveIntensity: 0.6 }), x - 0.15, x + 0.15, 2.4, 2.6, z, z + 0.1); }
function windows(g, x0, x1, z, y = 1.3) { for (let x = x0; x <= x1; x += 2.4) box(g, mat("#90caf9", { roughness: 0.2, metalness: 0.3 }), x - 0.7, x + 0.7, y, y + 1.0, z, z + 0.06); }

function buildHatzalah() {
    const g = new THREE.Group(); g.name = "RoadsideHatzalah";
    apron(g, -14, 16);
    box(g, mat("#eceff1"), -8, 8, 0, 5, -12, -3);                                   // the garage
    box(g, mat("#1565c0"), -8.2, 8.2, 5, 5.5, -12.2, -2.8);                          // blue roof band
    box(g, mat("#ff8f00"), -8, 8, 3.8, 4.3, -3, -2.9);                               // orange stripe
    box(g, mat("#37474f"), -7, -1, 0, 3.6, -3.05, -2.95);                            // bay 1 (shut)
    box(g, mat("#263238"), 1, 7, 0, 3.6, -3.1, -3.0);                                // bay 2 (open: dark inside)
    box(g, mat("#cfd8dc"), 8, 13, 0, 3.4, -10, -3);                                  // the office
    door(g, 10.5, -3); windows(g, 12.2, 12.2, -3);
    sign(g, ["HATZALAH", "HIGHWAY STATION"], "#1565c0", 0, 6.6, -2.7, 9, 2.0);
    // the ambulance, nose out of bay 2
    box(g, mat("#ffffff"), 2.2, 5.8, 0.5, 3.0, -2, 4.5); box(g, mat("#ff8f00"), 2.15, 5.85, 1.6, 2.0, -2, 4.5);
    box(g, mat("#e53935", { emissive: "#e53935", emissiveIntensity: 0.8 }), 2.6, 5.4, 3.0, 3.25, 3.6, 4.2);
    for (const [x, z] of [[2.4, -1], [5.6, -1], [2.4, 3.4], [5.6, 3.4]]) box(g, mat("#212121"), x - 0.25, x + 0.25, 0, 0.8, z - 0.4, z + 0.4);
    // the blue H on a pole
    box(g, mat("#9e9e9e"), -11.1, -10.9, 0, 4.2, 1, 1.2); sign(g, ["H"], "#1565c0", -11, 4.6, 1.25, 1.6, 1.6);
    return g;
}
function buildTrooper() {
    const g = new THREE.Group(); g.name = "RoadsideTrooper";
    apron(g, -30, 31);
    // the barracks: brick, a grey roof, the flag
    box(g, mat("#8d4b3a"), -22, -6, 0, 4.2, -14, -5);
    box(g, mat("#546e7a"), -22.4, -5.6, 4.2, 4.7, -14.4, -4.6);
    door(g, -14, -5, "#37474f"); windows(g, -20, -17, -5); windows(g, -11, -8, -5);
    sign(g, ["STATE TROOPERS", "POST 7"], "#263238", -14, 5.6, -4.55, 8, 1.6, "#ffd54f");
    box(g, mat("#eceff1"), -27.5, -22.5, 0, 3.2, -12, -5);                          // the first-aid room (a white annex)
    door(g, -25, -5, "#b71c1c"); box(g, mat("#e53935"), -25.5, -24.5, 3.4, 3.7, -5, -4.9); box(g, mat("#e53935"), -25.15, -24.85, 3.05, 4.05, -5, -4.9);
    box(g, mat("#bdbdbd"), -4.1, -3.9, 0, 7, -6, -5.8);
    box(g, mat("#1565c0"), -3.9, -2.2, 6.0, 6.9, -5.92, -5.88); box(g, mat("#e53935"), -3.9, -2.2, 5.4, 6.0, -5.92, -5.88);
    // the Highway Traffic Court: a double-wide on cinder blocks, a porch, a flag, a golf bag by the steps
    for (const x of [3, 7, 11, 15]) box(g, mat("#9e9e9e"), x - 0.4, x + 0.4, 0, 0.6, -11.6, -11);
    box(g, mat("#f5f0e1"), 2, 16, 0.6, 3.6, -12, -6);
    box(g, mat("#8d6e63"), 1.8, 16.2, 3.6, 3.8, -12.2, -5.8);
    box(g, mat("#a1887f"), 7, 11, 0, 0.6, -6, -4.2);                                 // the porch + steps
    box(g, mat("#a1887f"), 8, 10, 0, 0.3, -4.2, -3.4);
    door(g, 9, -6, "#6d4c41"); windows(g, 3.5, 5.9, -6, 1.6); windows(g, 12.5, 14.9, -6, 1.6);
    sign(g, ["HIGHWAY", "TRAFFIC COURT"], "#4e342e", 9, 4.8, -5.9, 7, 1.6, "#ffe082");
    box(g, mat("#1b5e20"), 11.4, 11.8, 0.6, 1.6, -4.8, -4.4);                         // (the judge's golf bag)
    // the impound yard: a chain-link fence, a gate sign
    const fence = mat("#b0bec5", { transparent: true, opacity: 0.45 });
    box(g, fence, 19, 29, 0, 2.6, -14, -13.9); box(g, fence, 19, 19.1, 0, 2.6, -14, -2); box(g, fence, 28.9, 29, 0, 2.6, -14, -2);
    box(g, fence, 19, 22.6, 0, 2.6, -2.1, -2); box(g, fence, 25.4, 29, 0, 2.6, -2.1, -2);
    for (const x of [19, 22.6, 25.4, 29]) box(g, mat("#78909c"), x - 0.06, x + 0.06, 0, 2.7, -2.1, -2);
    sign(g, ["IMPOUND"], "#f9a825", 24, 3.1, -2.0, 3.2, 0.8, "#212121");
    return g;
}
function buildWeigh() {
    const g = new THREE.Group(); g.name = "RoadsideWeigh";
    apron(g, -27, 38);
    // the scale house: a squat grey box, two doors (OFFICE · HEARINGS), a satellite dish for the judge's video
    box(g, mat("#90a4ae"), -13, -3, 0, 3.4, -11, -4);
    box(g, mat("#37474f"), -13.3, -2.7, 3.4, 3.8, -11.3, -3.7);
    door(g, -10, -4, "#263238"); door(g, -6, -4, "#263238");
    sign(g, ["WEIGH STATION", "OPEN"], "#455a64", -8, 4.6, -3.65, 7, 1.5, "#ffeb3b");
    box(g, mat("#bdbdbd"), -4.4, -4.2, 3.8, 5.0, -8, -7.8); box(g, mat("#eeeeee"), -5.0, -3.6, 4.9, 5.2, -8.4, -7.4);
    // the scale itself: a long steel plate in the lane, yellow edges
    box(g, mat("#78909c", { metalness: 0.5, roughness: 0.4 }), 20, 34, 0.06, 0.12, 0, 5);
    box(g, mat("#fdd835"), 20, 34, 0.06, 0.14, -0.2, 0); box(g, mat("#fdd835"), 20, 34, 0.06, 0.14, 5, 5.2);
    // the impound corner
    const fence = mat("#b0bec5", { transparent: true, opacity: 0.45 });
    box(g, fence, -25, -15, 0, 2.4, -12, -11.9); box(g, fence, -25, -24.9, 0, 2.4, -12, -3); box(g, fence, -15.1, -15, 0, 2.4, -12, -3);
    box(g, fence, -25, -21, 0, 2.4, -3.1, -3); box(g, fence, -18, -15, 0, 2.4, -3.1, -3);
    sign(g, ["IMPOUND"], "#f9a825", -19.5, 2.9, -3.0, 3.0, 0.7, "#212121");
    // DOC-IN-A-BOX next door
    box(g, mat("#a5d6a7"), 4, 16, 0, 4.0, -10, -3);
    box(g, mat("#ffffff"), 3.7, 16.3, 4.0, 4.4, -10.3, -2.7);
    door(g, 10, -3, "#ffffff"); windows(g, 5.5, 7.5, -3); windows(g, 12.5, 14.5, -3);
    sign(g, ["DOC-IN-A-BOX", "URGENT CARE · WALK-INS"], "#00897b", 10, 5.3, -2.65, 9, 1.7);
    box(g, mat("#9e9e9e"), 17.9, 18.1, 0, 4.2, 1, 1.2); sign(g, ["H"], "#1565c0", 18, 4.6, 1.25, 1.6, 1.6);
    return g;
}
const BUILD = { hatzalah: buildHatzalah, trooper: buildTrooper, weigh: buildWeigh };
for (const R of ROADSIDE) { const k = "roadside_" + R.id; if (!models[k]) models[k] = BUILD[R.id](); }

/** Colliders (world circles) for the copy's buildings: their footprints, filled with ~1.6 m circles. */
const FOOT = {
    hatzalah: [[-8, 13, -12, -3]],
    trooper: [[-22, -6, -14, -5], [-27.5, -22.5, -12, -5], [2, 16, -12, -6], [19, 29, -14, -13.6], [19, 19.4, -14, -2], [28.6, 29, -14, -2], [19, 22.6, -2.3, -2], [25.4, 29, -2.3, -2]],
    weigh: [[-13, -3, -11, -4], [4, 16, -10, -3], [-25, -15, -12, -11.6], [-25, -24.6, -12, -3], [-15.4, -15, -12, -3], [-25, -21, -3.3, -3], [-18, -15, -3.3, -3]],
};
function colliders(R, F) {
    const out = [];
    for (const [x0, x1, z0, z1] of FOOT[R.id]) {
        const r = 0.8, nx = Math.max(1, Math.round((x1 - x0) / (r * 2))), nz = Math.max(1, Math.round((z1 - z0) / (r * 2)));
        for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
            const w = toW(F, x0 + (i + 0.5) * (x1 - x0) / nx, z0 + (j + 0.5) * (z1 - z0) / nz);
            out.push({ x: w.x, z: w.z, r: Math.max(r, Math.min(x1 - x0, z1 - z0) / 2 * 0.9), kind: "building" });
        }
    }
    return out;
}

// ── on the road: a pull-off with its model, a sign 190 m before, a short hello if she stops in the bay ──
const AT = {};
for (const R of ROADSIDE) { AT[R.id] = []; for (let n = 0; n * LAP < 400000; n++) AT[R.id].push(n * LAP + R.m); }
for (const R of ROADSIDE) {
    addPlace({
        id: "roadside_" + R.id, kind: "roadside", name: R.name, icon: R.emoji, verb: `stop at ${R.short}`,
        where: mode => (mode === "cruise" || mode === "party" ? AT[R.id] : []),
        model: "roadside_" + R.id, d: PLACE_D, side: 1, bay: { half: 14, d0: 9, d1: 22 }, dur: 2.6,
        sign: { d: 10.4, bg: R.sign.bg, w: 5.0, h: 2.8, tw: 512, th: 300, lines: R.sign.lines },
        colliders: sp => colliders(R, frame(sp.s)),
        host: sp => { const F = frame(sp.s), d = Object.values(R.doors)[0], w = toW(F, d.x, d.z + 1.5); return { x: w.x, y: 1.7, z: w.z }; },
        beats: [{ t: 0.4, run: sp => {
            // (a bubble over the door — never a pop-up: ci/hud's contract)
            if (!sp.hostDummy) { const h = toW(frame(sp.s), Object.values(R.doors)[0].x, Object.values(R.doors)[0].z + 1.5); sp.hostDummy = new THREE.Object3D(); sp.hostDummy.position.set(h.x, 0, h.z); sp.chunk.add(sp.hostDummy); }
            sayAt(pick(R.hello), sp.hostDummy, { who: R.short });
            emit("stat", { id: "roadsideStops", n: 1 });
        } }],
    });
}
/** Keep the trees / houses off the pull-offs (every lap's copy). */
on("boot", () => {
    const w = ctx.world;
    if (!w || !w.reserve) return;
    for (const R of ROADSIDE) for (const s of AT[R.id]) w.reserve(s - 34, s + 34, 1, 7.5, 50);
});

// ── ctx.civic's side: a door spot near her on the highway, walking in ───
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
const onHighway = () => !!ctx.world && !(ctx.town && ctx.town.active);
/** The door spot of `door` at the roadside place she's at / taken to (`P`: places' STAY.place; else within 400 m of her). */
export function hwSpot(door, P = null) {
    if (!onHighway() || !ctx.car) return null;
    if (P && P.hw) { const R = BY_ID[P.hw]; return R && R.doors[door] ? doorSpot(R, door, P.s) : null; }
    const p = herPos(), s = ctx.car.s;
    let best = null, bd = 400;
    for (const R of ROADSIDE) {
        if (!R.doors[door]) continue;
        const cs = copyS(R, (ctx.foot && ctx.foot.active && ctx.foot.debug && ctx.foot.debug.F && ctx.foot.debug.F.s) || s);
        const sp = doorSpot(R, door, cs), d = p ? Math.hypot(sp.x - p.x, sp.z - p.z) : Math.abs(cs - s);
        if (d < bd) { bd = d; best = sp; }
    }
    return best;
}
/** Names for the interiors / the lobby (the roadside place's, by door). */
export function hwNames(id) { const R = BY_ID[id]; return R ? R.names : null; }
export { KIND_OF };
