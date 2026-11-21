// features/world/home.js — LULU'S STREET: the cul-de-sac at the very start of the
// road (s ≈ 0, Lakewood) with her house, the pink car in the driveway, Dina on
// the porch step, Mr. Pinsky watering his lawn across the street, a minivan
// doing a lap of the cul-de-sac now and then — and the title screen's camera on
// all of it. A run starts HERE, on foot (depart.js): Lulu at the bottom of the porch
// steps, Ima in the doorway, the car parked NOSE-OUT in front of the garage so
// driving off is just "go". Coming back to the title brings her home: she drives
// up the street, backs into the driveway and walks back to the porch.
//
// The street is ONE persistent group in the driving scene (it's at the world's
// origin, so a run that starts at s = 12 drives right past it); it hides itself
// once the car is ~900 m away. Colliders live in chunk 0 like any other house.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { save3d, shared } from "../../core/save.js";
import { models, cloneWithColors, findNodes, ensureModels, instanced } from "../../models.js";
import { ribbon, facingRoad, worldMaterials, canvasTex, SHOULDER, paved } from "../../world.js";
import { spawnPerson } from "../../core/people.js";
import { shadowProxy } from "../../lod.js";
import * as A from "../../audio.js";
import { slimMenorah } from "../meta/menorah.js";
import { Path, Ride, ease } from "./path.js";

export const S_HOME = 30;          // the house (centre) along the road
export const D_HOME = 21;          // … and to the right of the centre line
const CUL = { x: 0, z: -4, r: 13, island: 3.2 };   // the cul-de-sac (the road starts at the origin heading +Z)

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** Everything about the home street. */
export const home = {
    ready: false,
    group: null, house: null,
    park: null,        // {x, z, h, s, d} — the car's parked pose (in front of the garage, nose to the street)
    anchors: {},       // world positions: dina, window, table, lulu, door (Ima's spot in the doorway)
    people: {},        // dina, lulu, pinsky, ima (Person)
    ride2: null,       // the homecoming's second leg (backing into the driveway)
    phase: "parked",   // "parked" | "arriving" | "away"
    ride: null, arriveT: 0,
    luluT: 0,          // Lulu's walk from the car door to her spot after parking
    van: null, vanT: 0, vanPath: null,
    deco: {}, decoFor: null,
    camPos: new THREE.Vector3(), camLook: new THREE.Vector3(), camSnap: true,
    titleT: 0,
    site: null,        // "town" (the family house on its Midwood lot) | "highway" (the old cul-de-sac, until the town has a lot)
    town: null, lotSpot: null, exitS: null, pendingTown: null,
};

// ── building the street (once, at boot) ─────────────────────────────────
function roadPt(s, d) { return ctx.world.road.point(s, d, {}); }
function headingAt(s) { return ctx.world.road.at(s).h; }

let MATS = null;
function mats() {
    if (MATS) return MATS;
    const asphalt = new THREE.MeshStandardMaterial({ color: "#5f636b", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const curb = new THREE.MeshStandardMaterial({ color: "#c9c4b8", roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const lawn = new THREE.MeshStandardMaterial({ color: "#6fb64c", roughness: 1 });
    MATS = { asphalt, curb, lawn };
    return MATS;
}

/** The neighbours' houses: one instanced set (a few draw calls for all three). */
function addNeighbours(group, list) {
    const inst = instanced(models.house, list.length, ["Walls", "Roof"]);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), col = new THREE.Color();
    const out = list.map(([s, side, walls, roof], i) => {
        const p = roadPt(s, side * 23);
        q.setFromAxisAngle(up, facingRoad(headingAt(s), side));
        inst.set(i, mtx.compose(v1.set(p.x, 0, p.z), q, one));
        inst.color(i, "Walls", col.set(walls));
        inst.color(i, "Roof", col.set(roof));
        return { x: p.x, z: p.z, s, side };
    });
    inst.finish();
    group.add(inst.group);
    return out;
}
/** Every driveway on the street as ONE mesh (merged ribbons). */
function mergedDriveways(list) {
    const geos = list.map(([s0, s1, d0, d1]) => ribbon(ctx.world.road, s0, s1, d0, d1, 0.025, 10));
    const pos = [], nor = [], uv = [], idx = [];
    let base = 0;
    for (const g of geos) {
        pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
        for (const i of g.index.array) idx.push(i + base);
        base += g.attributes.position.count;
        g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, worldMaterials().drive);
    m.receiveShadow = true;
    return m;
}

/** The house, its anchors, Dina / Lulu / Ima — the part of home that goes wherever the lot is. `lot`: the house's origin
 *  { x, z, rot } (rot: rotation.y — the model's front, +Z, faces the street). → the house. */
function buildHouse(g, lot) {
    const house = cloneWithColors(models.world_home);
    house.position.set(lot.x, 0, lot.z);
    house.rotation.y = lot.rot;
    g.add(house);
    house.updateMatrixWorld(true);
    const A = {};
    for (const n of ["park", "dina", "window", "table", "lulu"]) {
        const node = findNodes(house, "Anchor_" + n)[0];
        A[n] = node ? node.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(lot.x, 0, lot.z);
        if (node) A[n + "Node"] = node;
    }
    home.anchors = A;
    home.house = house;
    home.deco = {};
    for (const k of ["sukkah", "chanukah"]) {
        const d = findNodes(house, "Deco_" + k)[0];
        if (d) { d.visible = false; home.deco[k] = d; }
    }
    // MEDIUM / HIGH: the house casts its shadow in one draw (lod.js) — the title shot + every run's start; the holiday
    // decorations and anything hung on an anchor keep their own
    home.houseShadow = shadowProxy(house, { skip: o => /^(Deco_|Anchor_)/.test(o.name || "") });
    // the parked pose: in front of the garage, NOSE OUT (backed in) — a run starts with her driving straight off
    home.park = { x: A.park.x, z: A.park.z, h: wrap(house.rotation.y), s: 0, d: 0 };
    parkRoad();
    // the front door (Ima's spot, on the porch deck) and the bottom of the porch steps (where a run starts)
    house.localToWorld(A.door = new THREE.Vector3(0.2, 0.4, 5.25));
    house.localToWorld(A.steps = new THREE.Vector3(0.6, 0, 7.75));
    home.hp = { x: lot.x, z: lot.z };
    // people (Dina + Lulu are preloaded by core)
    try {
        const dina = spawnPerson("dinaPerson");
        dina.obj.position.copy(A.dina);
        dina.obj.rotation.y = house.rotation.y;
        g.add(dina.obj);
        home.people.dina = dina;
        // how tall she is above her Body pivot (for the Purim hat)
        dina.obj.updateMatrixWorld(true);
        const body = findNodes(dina.obj, "Body")[0];
        const top = new THREE.Box3().setFromObject(dina.obj).max.y;
        home.dinaHat = { y: body ? top - body.getWorldPosition(v1).y : top - A.dina.y };
    } catch (e) { console.warn("[world] dina", e); }
    home.people.lulu = null; home.luluSig = null;
    makeLulu();
    // Ima in the doorway (only for a run's start: she sees Lulu off)
    ensureModels(["imaPerson"]).then(() => {
        if (home.group !== g) return;
        const p = spawnPerson("imaPerson");
        p.obj.position.copy(A.door);
        p.obj.rotation.y = house.rotation.y;
        p.obj.visible = false;
        g.add(p.obj);
        home.people.ima = p;
    }).catch(() => {});
    return house;
}
/** The parked pose in the road model she's on now (the town's streets inside Midwood, the highway outside). */
export function parkRoad() {
    const P = home.park;
    if (!P || !ctx.world || !ctx.world.road) return P;
    const n = ctx.world.road.nearest(P.x, P.z, ctx.car ? ctx.car.s : 0, {});
    P.s = n.s; P.d = n.d;
    return P;
}

/** THE HIGHWAY SITE (the old cul-de-sac at the start of the road): a FALLBACK only — towns switched off (?test without
 *  "town") or no town engine. With towns on, home is the Midwood lot and nothing of this is built (no ghost driveway). */
function buildStreet() {
    const world = ctx.world, road = world.road;
    const g = new THREE.Group();
    g.name = "WorldHome";
    const M = mats(), M0 = worldMaterials();
    home.site = "highway";

    // the cul-de-sac: an asphalt bulb + curb ring + a grassy island with a tree
    const bulb = new THREE.Mesh(new THREE.CircleGeometry(CUL.r, 40), M.asphalt);
    bulb.rotation.x = -Math.PI / 2; bulb.position.set(CUL.x, 0.026, CUL.z); bulb.receiveShadow = true;
    const ring = new THREE.Mesh(new THREE.RingGeometry(CUL.r, CUL.r + 1.6, 40, 1, Math.PI * 0.08, Math.PI * 1.84), M.curb);
    ring.rotation.x = -Math.PI / 2; ring.rotation.z = Math.PI / 2; ring.position.set(CUL.x, 0.022, CUL.z); ring.receiveShadow = true;
    const island = new THREE.Mesh(new THREE.CylinderGeometry(CUL.island, CUL.island + 0.15, 0.22, 28), M.lawn);
    island.position.set(CUL.x, 0.11, CUL.z); island.receiveShadow = true;
    g.add(bulb, ring, island);
    if (models.treeRound) {
        const tree = cloneWithColors(models.treeRound, { Leaves: "#E07A3A" });
        tree.position.set(CUL.x, 0.2, CUL.z); tree.scale.setScalar(1.05);
        g.add(tree);
    }

    // Lulu's house
    const hp = roadPt(S_HOME, D_HOME), h = headingAt(S_HOME);
    ctx.scene.add(g);
    home.group = g;
    const house = buildHouse(g, { x: hp.x, z: hp.z, rot: facingRoad(h, 1) });
    const A = home.anchors;    const near = road.nearest(A.park.x, A.park.z, S_HOME, {});
    home.park.s = near.s; home.park.d = near.d;
    // the driveway is asphalt for the car (no grass drag pulling out)
    const dS = near.s, dD = near.d;
    paved.push((s, d) => (home.site === "highway" && s > dS - 2.2 && s < dS + 2.2 && d > SHOULDER - 0.2 && d < dD + 3.4) ? 2 : 0);
    // the neighbours: across the street (Mr. Pinsky's) and next door
    home.neighbours = addNeighbours(g, [[S_HOME - 2, -1, "#DCEDC8", "#455A8C"], [S_HOME + 36, 1, "#E3F2FD", "#8D6E63"], [S_HOME + 40, -1, "#FFF9C4", "#C0504D"]]);
    // every driveway (ours up to the garage + the neighbours') in one mesh
    g.add(mergedDriveways([[near.s - 1.9, near.s + 1.9, SHOULDER, near.d + 3.6]].concat(home.neighbours.map(n =>
        [n.s + 4.5, n.s + 7.5, n.side > 0 ? SHOULDER : -19, n.side > 0 ? 19 : -SHOULDER]))));

    // keep random trees off the lots (both sides), from the cul-de-sac to the next-door house
    world.reserve(-30, S_HOME + 52, 0, 8.9, 42);

    // Mr. Pinsky across the street (lazy)
    ensureModels(["npcMan"]).then(() => {
        if (home.group !== g) return;
        const p = spawnPerson("npcMan", { colors: { Top: "#7CB342", Bottom: "#5D4037", Hair: "#9E9E9E" } });
        const pos = roadPt(S_HOME - 6, -14.5);
        p.obj.position.set(pos.x, 0, pos.z);
        p.obj.rotation.y = facingRoad(headingAt(S_HOME), -1);
        g.add(p.obj);
        home.people.pinsky = p;
    }).catch(() => {});
    // the minivan that laps the cul-de-sac (journey's model, lazy)
    ensureModels(["journey_minivan"]).then(() => {
        if (home.group !== g) return;
        const van = cloneWithColors(models.journey_minivan);
        van.visible = false;
        g.add(van);
        home.van = van;
        home.vanWheels = findNodes(van, "Wheel_");
        home.vanShadow = shadowProxy(van);      // (the title's lapping minivan: one shadow draw on MEDIUM / HIGH)
    }).catch(() => {});
    home.vanPath = vanLoop();
    home.ready = true;
}

/** THE TOWN SITE: the family house on its lot in Midwood (features/town: `uses.luluHome`, an empty lot the town
 *  engine reserves — a house among houses on E 16th St). `spot`: the lot in world coords { x, z, nx, nz, ux, uz,
 *  door, drive: { x, z, h }, w, d }. The house goes where its parked car sits just behind the kerb end of the drive. */
function buildTownHome(spot, town) {
    const g = new THREE.Group();
    g.name = "WorldHome";
    home.site = "town";
    home.town = town;
    home.lotSpot = spot;
    ctx.scene.add(g);
    home.group = g;
    // the model's front (+Z) toward the street; place it so its park anchor lands 3.2 m in from the kerb end of the drive
    const rot = Math.atan2(spot.nx, spot.nz);
    const probe = cloneWithColors(models.world_home);
    probe.rotation.y = rot; probe.updateMatrixWorld(true);
    const pn = findNodes(probe, "Anchor_park")[0], pa = pn ? pn.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    const dr = spot.drive || { x: spot.x + spot.nx * (spot.d || 24) / 2, z: spot.z + spot.nz * (spot.d || 24) / 2 };
    const want = { x: dr.x - spot.nx * 3.2, z: dr.z - spot.nz * 3.2 };
    buildHouse(g, { x: want.x - pa.x, z: want.z - pa.z, rot });
    // the driveway: a pale slab from the kerb to the garage door
    const P = home.park, len = Math.hypot(dr.x - P.x, dr.z - P.z) + 3.6;
    const dg = new THREE.PlaneGeometry(3.4, len);
    dg.rotateX(-Math.PI / 2); dg.rotateY(rot);
    const mid = { x: (dr.x + P.x) / 2 - spot.nx * 1.8 * 0.5, z: (dr.z + P.z) / 2 - spot.nz * 1.8 * 0.5 };
    const drive = new THREE.Mesh(dg, mats().drive || (mats().drive = new THREE.MeshStandardMaterial({ color: "#B9B3A8", roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));
    drive.position.set(mid.x, 0.035, mid.z);
    drive.receiveShadow = true;
    g.add(drive);
    home.neighbours = [];
    home.van = null; home.vanPath = null; home.people.pinsky = null;
    home.ready = true;
}

/** The house is solid in its town (the town's block ring is open across the lot's frontage — features/town): the same
 *  three circles as the highway house (two for the house, one for the garage behind the parked car). Once per standing
 *  copy of the town (ctx.town.addCollider: into the district she's in, or `{ town, exitS }` while it only stands). */
const colDone = new Set();
export function houseColliders() {
    const T = ctx.town;
    if (home.site !== "town" || !home.ready || !T || typeof T.addCollider !== "function") return false;
    const key = home.town + ":" + home.exitS + ":" + (T.active && T.id === home.town ? "in" : "out") + ":" + (home.colGen || 0);
    if (colDone.has(key)) return false;
    colDone.add(key);
    const hp = home.hp, P = home.park, r = home.house.rotation.y;
    const fx = Math.sin(r), fz = Math.cos(r), rx = Math.cos(r), rz = -Math.sin(r);
    const gx = P.x - fx * 3.9, gz = P.z - fz * 3.9;
    const list = [{ x: hp.x + rx * 2.4, z: hp.z + rz * 2.4, r: 4.4, kind: "house" }, { x: hp.x - rx * 2.4, z: hp.z - rz * 2.4, r: 4.4, kind: "house" },
        { x: gx - fx * 2.2, z: gz - fz * 2.2, r: 2.9, kind: "house" }];
    const where = T.active && T.id === home.town ? undefined : { town: home.town, exitS: home.exitS };
    try { for (const c of list) T.addCollider(c, where); } catch (e) { console.warn("[world] house colliders", e); }
    return true;
}
on("town:enter", e => { if (e && e.town === home.town) houseColliders(); });

/** Where home should be now: the town engine's lot (features/town › ctx.town.home + spotOf), else the highway site. */
export function wantedSite() {
    const T = ctx.town, H = T && T.home;
    // (the highway cul-de-sac is only a fallback now: no town engine / towns switched off (?test without "town") — the
    //  real game always has Midwood; if its models never load, a day just starts on the road, as before)
    if (!H || typeof T.spotOf !== "function" || !ctx.enabled("town")) return { site: "highway" };
    let sp = null;
    try { sp = T.spotOf(H.town, "luluHome", H.exitS); } catch (e) { sp = null; }
    return sp ? { site: "town", spot: sp, town: H.town, exitS: H.exitS } : { site: "pending", town: H.town, exitS: H.exitS };
}
/** Drop whatever is built (people, house, street) — before building home somewhere else. */
function dropHome() {
    const g = home.group;
    if (!g) return;
    g.removeFromParent();
    for (const k of ["houseShadow", "vanShadow"]) { try { if (home[k] && home[k].dispose) home[k].dispose(); } catch (e) { /* (lod's own) */ } home[k] = null; }
    home.group = null; home.house = null; home.ready = false;
    home.people = {}; home.van = null; home.vanPath = null; home.neighbours = [];
    home.decoFor = null; home.extras = []; home.flames = [];
}
/** (Re)build home where it should be: called at boot and every half second until the town's lot is known. → bool (moved) */
export function relocate(force = false) {
    const W = wantedSite();
    if (W.site === "pending") { home.pendingTown = W; return false; }
    home.pendingTown = null;
    const same = home.ready && home.site === W.site && (W.site !== "town" || (home.lotSpot && Math.hypot(home.lotSpot.x - W.spot.x, home.lotSpot.z - W.spot.z) < 0.5));
    if (same && !force) return false;
    dropHome();
    if (W.site === "town") buildTownHome(W.spot, W.town); else buildStreet();
    home.exitS = W.exitS != null ? W.exitS : null;
    home.colGen = (home.colGen || 0) + 1;
    home.decoFor = null;
    applyHoliday();
    emit("world:homeBuilt", { site: home.site, town: home.town || null });
    return true;
}
/** Lulu on foot (her hairstyle + colour, like foot does). Rebuilt when they change. */
function makeLulu() {
    const s2 = shared.get();
    const key = s2.luluHairStyle && models["luluPerson_" + s2.luluHairStyle] ? "luluPerson_" + s2.luluHairStyle : "luluPerson";
    const sig = key + "|" + (s2.luluHair || "");
    if (home.people.lulu && home.luluSig === sig) return home.people.lulu;
    const old = home.people.lulu;
    try {
        const p = spawnPerson(key, { colors: s2.luluHair ? { Hair: s2.luluHair } : null });
        if (old) { p.obj.position.copy(old.obj.position); p.obj.rotation.copy(old.obj.rotation); p.obj.visible = old.obj.visible; old.obj.removeFromParent(); }
        else p.obj.visible = false;
        home.group.add(p.obj);
        home.people.lulu = p;
        home.luluSig = sig;
    } catch (e) { console.warn("[world] lulu", e); }
    return home.people.lulu;
}

/** The minivan's lap: down the oncoming lane, round the island, back out. */
function vanLoop() {
    const pts = [];
    for (let s = 120; s >= 14; s -= 8) pts.push(roadPt(s, -1.75));
    const c = CUL, r = 7.6;
    // counter-clockwise round the island, entering on the +x side (the left of the road heading +Z)
    for (let k = 0; k <= 12; k++) {
        const a = -0.15 + (k / 12) * (Math.PI + 0.3);
        pts.push({ x: c.x + Math.cos(a) * r, z: c.z - Math.sin(a) * r });
    }
    for (let s = 14; s <= 140; s += 8) pts.push(roadPt(s, 1.75));
    return new Path(pts);
}

// ── where things are ─────────────────────────────────────────────────────
/** Within r m of the house (world distance: the highway site and a town lot alike). */
export function nearHome(x, z, r = 90) { const h = home.hp; return !!(h && home.ready) && Math.hypot(x - h.x, z - h.z) < r; }
/** How far the street's edge is from its centre line where home is (the highway's shoulder · a town street's kerb). */
export const homeEdge = () => home.site === "town" ? 4.6 : SHOULDER;
/** door = beside the car's driver's door (where she climbs out); idle = her spot at the bottom of the porch steps,
 *  chatting with Dina (where the title shows her and where a run starts). */
export function luluSpots(out = {}) {
    const P = home.park, fx = Math.sin(P.h), fz = Math.cos(P.h), lx = Math.cos(P.h), lz = -Math.sin(P.h);
    out.door = { x: P.x + lx * 1.25 + fx * 0.25, z: P.z + lz * 1.25 + fz * 0.25 };
    const st = home.anchors.steps || home.anchors.lulu;
    out.idle = { x: st.x, z: st.z };
    return out;
}
const spots = {};

/** In the town home is in (its district)? */
export const inHomeTown = () => home.site === "town" && !!(ctx.town && ctx.town.active && ctx.town.id === home.town);
/**
 * Make home's town the district she's in (a day starts on her porch in Midwood): the town engine's quiet warp /
 * enter at the driveway (features/town — ctx.town.warp / enter({ at, quiet, home })), or — before that lands — its
 * plain enter({ town, exitS }) and the car moved into the driveway. → true when she's in home's town now.
 */
export function enterHomeTown() {
    if (home.site !== "town") return true;
    if (inHomeTown()) return true;
    const T = ctx.town, P = home.park;
    if (!T || !P) return false;
    const at = { x: P.x, z: P.z, h: P.h };
    const opts = { town: home.town, exitS: home.exitS, at, speed: 0, quiet: true, home: true };
    try {
        if (typeof T.warp === "function") T.warp(opts);
        else {
            if (T.active) T.leave("reset");
            T.enter(opts);
        }
    } catch (e) { console.error("[world] home town", e); }
    return inHomeTown();
}

/** Put the car in the driveway, Lulu beside it. */
export function placeParked() {
    const car = ctx.car, P = home.park;
    car.place(P.x, P.z, P.h);
    if (home.site === "town") parkRoad();
    car.s = P.s; car.d = P.d;
    car.vx = car.vz = car.vF = 0;
    car.updateVisual(0, ctx.time, { steer: 0, throttle: 0, brake: 0, handbrake: false }, false);
    car.showDriver(false);
    home.phase = "parked";
    home.ride = home.ride2 = null;
    const L = makeLulu();
    if (L) { luluSpots(spots); L.obj.position.set(spots.idle.x, 0, spots.idle.z); L.obj.visible = true; home.luluT = 99; }
}

/** Drive home from up the street and back into the driveway (behind the title menu). */
function startArrival() {
    const P = home.park, s = P.s;
    const fx = Math.sin(P.h), fz = Math.cos(P.h);
    // down the street in the far lane, past the driveway, a stop — then back in, swinging round so she's nose-out
    const pts = [roadPt(s + 36, -1.75), roadPt(s + 22, -1.75), roadPt(s + 4, -1.5), roadPt(s - 7, -0.6)];
    const back = [roadPt(s - 7, -0.6), roadPt(s - 3.2, 2.6), roadPt(s - 0.8, 7.2), { x: P.x + fx * 2.4, z: P.z + fz * 2.4 }, { x: P.x, z: P.z }];
    home.ride = new Ride(new Path(pts), { profile: "decel", v0: 11 });
    home.ride2 = new Ride(new Path(back), { reverse: true, profile: "inout", dur: 2.6 });
    home.phase = "arriving";
    home.arriveT = 0;
    const car = ctx.car;
    const p0 = home.ride.path.at(0);
    car.place(p0.x, p0.z, p0.h);
    car.showDriver(true);
    ctx.world.prebuild(s);
    if (home.people.lulu) home.people.lulu.obj.visible = false;
}

// ── holiday dressing (the meta feature reads the device's Hebrew calendar) ──
function glowTexture() {
    if (home.glowTex) return home.glowTex;
    home.glowTex = canvasTex(64, 64, (g, w, h) => {
        const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grd.addColorStop(0, "rgba(255,230,160,1)"); grd.addColorStop(0.3, "rgba(255,190,90,0.5)"); grd.addColorStop(1, "rgba(255,170,60,0)");
        g.fillStyle = grd; g.fillRect(0, 0, w, h);
    }, false);
    return home.glowTex;
}
function clearExtras() {
    for (const o of home.extras || []) { o.removeFromParent(); o.traverse(x => { if (x.isSprite) x.material.dispose(); }); if (o.userData.slim) o.userData.slim.dispose(); }
    home.extras = [];
    home.flames = [];
}
/** Which holiday dressing is up right now ("sukkot", "chanukah", "purim", "pesach", "roshHashana" or ""). */
export function holidayNow() {
    try { const c = ctx.meta && ctx.meta.holiday ? ctx.meta.holiday() : null; return c ? { id: c.h.id, day: c.dayNum || 1 } : null; } catch (e) { return null; }
}
export async function applyHoliday() {
    if (!home.ready) return;
    const c = holidayNow();
    const key = c ? c.id + ":" + c.day : "";
    if (key === home.decoFor) return;
    home.decoFor = key;
    clearExtras();
    const DECO = { sukkot: "sukkah", chanukah: "chanukah" };
    for (const k of Object.keys(home.deco)) home.deco[k].visible = !!c && DECO[c.id] === k;
    if (!c) return emit("world:holiday", { id: null });
    const extra = { chanukah: "metaMenorah", purim: "metaPurimHat", roshHashana: "metaHoney", pesach: "metaMatzah" }[c.id];
    if (extra) {
        try { await ensureModels([extra]); } catch (e) { return; }
        if (home.decoFor !== key || !models[extra]) return;
        const o = models[extra].clone(true);
        o.name = "WorldHoliday_" + c.id;
        if (c.id === "chanukah") {
            // in the front window, tonight's candles lit (+ the shamash) — meta's slim build (~4 draw calls, not ~30)
            const sm = slimMenorah(models[extra], Math.min(8, c.day), glowTexture());
            const m = sm.obj;
            m.name = "WorldHoliday_chanukah";
            m.position.copy(home.anchors.window);
            m.rotation.y = home.house.rotation.y;
            m.scale.setScalar(1.25);
            home.flames = [{ slim: sm }];
            home.group.add(m);
            home.extras.push(m);
            m.userData.slim = sm;
            emit("world:holiday", { id: c.id });
            return;
        } else if (c.id === "purim" && home.people.dina) {
            // Dina's party hat
            const body = findNodes(home.people.dina.obj, "Body")[0] || home.people.dina.obj;
            o.scale.setScalar(0.75);
            o.position.set(0, (home.dinaHat ? home.dinaHat.y : 0.5) - 0.06, 0.02);
            o.rotation.set(-0.1, 0, 0.2);
            body.add(o);
        } else {
            o.position.copy(home.anchors.table);
            o.rotation.y = home.house.rotation.y + 0.4;
            o.scale.setScalar(c.id === "pesach" ? 1.1 : 1.3);
            home.group.add(o);
        }
        home.extras.push(o);
    }
    emit("world:holiday", { id: c.id });
}

// ── per frame on the title ───────────────────────────────────────────────
const CHATTER_QUIET = () => (save3d.settings.chatter || "normal") === "quiet";

/** Title: people, the minivan, the homecoming drive, the street's visibility. */
export function homeTick(dt) {
    if (!home.ready) return;
    home.titleT += dt;
    const car = ctx.car, P = home.park;
    if (home.phase === "arriving" && home.ride) {
        let done = home.ride.step(dt);
        A.updateEngine(Math.abs(car.vF), 0.3, 0, 0, false, true);
        if (done && home.ride2) {      // stopped past the driveway: now back in
            home.arriveT += dt;
            if (home.arriveT > 0.35) { home.ride = home.ride2; home.ride2 = null; }
            done = false;
        }
        if (done) {
            placeParked();
            A.updateEngine(0, 0, 0, 0, false, false);
            // she climbs out and steps over to her spot
            const L = home.people.lulu;
            if (L) { luluSpots(spots); L.obj.position.set(spots.door.x, 0, spots.door.z); home.luluT = 0; }
            emit("world:home", {});
        }
    }
    peopleTick(dt);
    vanTick(dt);
    flameTick();
}

/** Dina, Lulu and Mr. Pinsky (title + the pull-out). */
export function peopleTick(dt, mood = null) {
    const { dina, lulu, pinsky } = home.people, t = ctx.time;
    const arriving = home.phase === "arriving";
    if (dina) {
        if (mood === "bye" || mood === "go") dina.update(dt, { sit: false, wave: true, cheer: mood === "go" });
        else if (arriving && home.ride && home.ride.m > home.ride.path.length * 0.5) dina.update(dt, { cheer: true });
        else dina.update(dt, { sit: true, wave: Math.sin(t * 0.45) > 0.86 });
        dina.obj.position.copy(home.anchors.dina);
        if (mood || arriving) dina.face(car().pos.x, car().pos.z, dt, 4);
        else dina.obj.rotation.y += wrap(home.house.rotation.y - dina.obj.rotation.y) * Math.min(1, dt * 2);
    }
    if (pinsky) {
        const near = home.phase === "arriving" || mood;
        pinsky.update(dt, near ? { wave: true } : { point: true });
        if (near) pinsky.face(car().pos.x, car().pos.z, dt, 3);
    }
    if (lulu && lulu.obj.visible && !mood) {
        luluSpots(spots);
        if (home.luluT < 1) {
            home.luluT += dt * 1.6 / Math.max(1, Math.hypot(spots.idle.x - spots.door.x, spots.idle.z - spots.door.z) * 0.6);
            const k = ease(home.luluT);
            lulu.obj.position.set(spots.door.x + (spots.idle.x - spots.door.x) * k, 0, spots.door.z + (spots.idle.z - spots.door.z) * k);
            lulu.face(spots.idle.x, spots.idle.z, dt, 10);
            lulu.update(dt, { walk: 1.6 });
        } else {
            const d = home.anchors.dina;
            lulu.face(d.x, d.z, dt, 3);
            lulu.update(dt, { talk: Math.sin(t * 0.6) > -0.2, wave: Math.sin(t * 0.37 + 1) > 0.93 });
        }
    }
}
const car = () => ctx.car;

function vanTick(dt) {
    const van = home.van;
    if (!van || !home.vanPath) return;
    home.vanT += dt;
    const PERIOD = 46, SPEED = 9;
    const tt = (home.vanT + 22) % PERIOD;
    const m = tt * SPEED;
    if (m > home.vanPath.length) { van.visible = false; return; }
    const p = home.vanPath.at(m);
    van.visible = true;
    van.position.set(p.x, 0, p.z);
    van.rotation.y = p.h;
    for (const w of home.vanWheels || []) w.rotation.x += SPEED * dt / 0.36;
}

function flameTick() {
    const t = ctx.time;
    for (const fl of home.flames || []) {
        if (fl.slim) { fl.slim.tick(t); continue; }
        const k = 1 + Math.sin(t * 13 + fl.ph) * 0.16 + Math.sin(t * 29 + fl.ph * 2) * 0.06;
        fl.f.scale.set(fl.base.x * (2 - k) * 0.95, fl.base.y * k, fl.base.z * (2 - k) * 0.95);
    }
}

/** Hide the minivan outside the title; hide the whole street far from home. */
export function streetVisibility() {
    if (!home.ready) return;
    const far = ctx.camera.position.distanceToSquared(v1.set(home.hp.x, 0, home.hp.z)) > 810000
        && (home.site !== "highway" || Math.abs(ctx.car.s - S_HOME) > 900);
    home.group.visible = !far;
    if (home.van && ctx.state !== "title") home.van.visible = false;
    if (home.people.ima && (far || ctx.state === "title")) home.people.ima.obj.visible = false;
}

// ── the title camera ─────────────────────────────────────────────────────
/** The shot of the house, car and porch (menu card on the left on wide screens). */
export function titleShot(pos, look, t = ctx.time) {
    const P = home.park, cam = ctx.camera, portrait = cam.aspect < 1;
    const sway = Math.sin(t * 0.07) * 2.5;
    const d = home.anchors.dina;
    look.set((P.x * 0.55 + d.x * 0.45), 1.5, (P.z * 0.55 + d.z * 0.45));
    if (home.site === "town") {
        // from up the street (the house's +X side), over the far lane: the same framing as the old cul-de-sac shot
        const r = home.house.rotation.y, fx = Math.sin(r), fz = Math.cos(r), xx = Math.cos(r), xz = -Math.sin(r);
        const sp = home.lotSpot, dr = sp && sp.drive ? sp.drive : P;
        const out = (dr.x - P.x) * fx + (dr.z - P.z) * fz + (portrait ? 9 : 10.5);     // (across the street: the far kerb)
        const back = (portrait ? 18 : 11) + sway;
        pos.set(P.x + xx * back + fx * out, portrait ? 9.5 + Math.sin(t * 0.05) : 4.1 + Math.sin(t * 0.06) * 0.4, P.z + xz * back + fz * out);
        if (portrait) look.y = 0.4;
        return { pos, look };
    }
    // (from the cul-de-sac side, looking up the street: a run's start then pushes straight in behind Lulu)
    if (portrait) {
        const p = roadPt(P.s - 27 - sway, 3);
        pos.set(p.x, 9.5 + Math.sin(t * 0.05), p.z);
        look.y = 0.4;
    } else {
        const p = roadPt(P.s - 19 - sway, 4.2 + Math.sin(t * 0.05) * 1.2);
        pos.set(p.x, 4.1 + Math.sin(t * 0.06) * 0.4, p.z);
    }
    return { pos, look };
}

/** Where on screen the subject should sit (NDC): the middle of the biggest area the menu card leaves free. */
const free = { t: -1, nx: 0.45, ny: 0, cx: null, cy: 0 };
if (typeof window !== "undefined") window.addEventListener("resize", () => { free.t = -1; free.cx = null; });
export function freeSpot() {
    if (ctx.time - free.t < 0.5 && free.t >= 0) return free;
    free.t = ctx.time;
    const W = window.innerWidth, Hh = window.innerHeight;
    const card = typeof document !== "undefined" && document.getElementById("screenCard");
    const r = card && card.offsetParent !== null ? card.getBoundingClientRect() : null;
    if (!r || r.width < 10) { free.nx = 0; free.ny = 0; return free; }
    const areas = [
        { a: Math.max(0, W - r.right) * Hh, x: (r.right + W) / 2, y: Hh / 2 },
        { a: Math.max(0, r.left) * Hh, x: r.left / 2, y: Hh / 2 },
        { a: Math.max(0, Hh - r.bottom) * W * 1.15, x: W / 2, y: (r.bottom + Hh) / 2 },   // (the ground side reads best)
        { a: Math.max(0, r.top) * W, x: W / 2, y: r.top / 2 },
    ].sort((a, b) => b.a - a.a);
    const best = areas[0];
    if (best.a < W * Hh * 0.06) { free.nx = 0.35; free.ny = 0; return free; }
    free.nx = Math.max(-0.8, Math.min(0.8, best.x / W * 2 - 1));
    free.ny = Math.max(-0.8, Math.min(0.8, 1 - best.y / Hh * 2));
    return free;
}

/** titleCamera hook: owns the title-screen camera while the home street is up. */
export function titleCamera(dt, camera) {
    if (!home.ready || ctx.state !== "title") return false;
    const shot = titleShot(v2, v3);
    const st = ctx.cam && ctx.cam.state;
    const snap = home.camSnap;
    if (snap) { home.camPos.copy(v2); home.camLook.copy(v3); home.camSnap = false; }
    home.camPos.lerp(v2, Math.min(1, dt * 1.6));
    home.camLook.lerp(v3, Math.min(1, dt * 1.8));
    camera.position.copy(home.camPos);
    camera.lookAt(home.camLook);
    // turn the camera so the street sits in the space the menu card leaves free
    const f = freeSpot(), tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    if (f.cx == null || snap) { f.cx = f.nx; f.cy = f.ny; }
    f.cx += (f.nx - f.cx) * Math.min(1, dt * 3); f.cy += (f.ny - f.cy) * Math.min(1, dt * 3);
    camera.rotateY(Math.atan(f.cx * tv * camera.aspect) * 0.92);
    camera.rotateX(-Math.atan(f.cy * tv) * 0.92);
    camera.fov += (50 + (camera.aspect < 1 ? 12 : 0) - camera.fov) * Math.min(1, dt * 2);
    camera.updateProjectionMatrix();
    if (st) { st.pos.copy(camera.position); st.snap = false; }
    return true;
}

// ── lifecycle ────────────────────────────────────────────────────────────
on("boot", () => {
    try { relocate(true); } catch (e) { console.error("[world] home", e); home.ready = false; }
});
// (until the town engine has placed Midwood — prebuilt from boot — keep asking where the lot is)
let relocT = 0;
export function tendSite(dt) {
    if (!home.pendingTown && home.site !== "highway") return;
    if ((relocT -= dt) > 0) return;
    relocT = 0.5;
    if (ctx.state !== "title" && home.ready) return;          // (never mid-run: the next title moves it)
    try { relocate(); } catch (e) { console.error("[world] home", e); }
}
// colliders: the houses + the island, in chunk 0 (like any roadside house)
on("chunk:build", ({ chunk }) => {
    if (chunk.k !== 0 || !home.ready || home.site !== "highway") return;
    const hp = home.hp, P = home.park;
    const fx = Math.sin(home.house.rotation.y), fz = Math.cos(home.house.rotation.y);   // the house's front (to the road)
    const rx = Math.cos(home.house.rotation.y), rz = -Math.sin(home.house.rotation.y);  // its +X (model)
    chunk.addCollider({ x: hp.x + rx * 2.4, z: hp.z + rz * 2.4, r: 4.4, kind: "house" });
    chunk.addCollider({ x: hp.x - rx * 2.4, z: hp.z - rz * 2.4, r: 4.4, kind: "house" });
    const gx = P.x + fx * 3.9 * -1, gz = P.z + fz * 3.9 * -1;   // the garage, behind the parked car
    chunk.addCollider({ x: gx - fx * 2.2, z: gz - fz * 2.2, r: 2.9, kind: "house" });
    for (const n of home.neighbours) chunk.addCollider({ x: n.x, z: n.z, r: 5.2, kind: "house" });
    chunk.addCollider({ x: CUL.x, z: CUL.z, r: CUL.island + 0.2, kind: "tree" });
});

/** Back to the title: home. First boot = already parked; after a run she drives up and parks. */
export function onTitle(from) {
    if (!home.ready) return;
    home.camSnap = from === "loading" || home.camSnap;
    makeLulu();
    applyHoliday();
    const car = ctx.car, P = home.park;
    const dist = Math.hypot(car.pos.x - P.x, car.pos.z - P.z);
    if (from === "loading" || !from) { placeParked(); return; }
    if (dist < 1.5 && home.phase === "parked") { car.showDriver(false); return; }
    if (from === "worldDepart" || home.site !== "highway") { placeParked(); home.camSnap = true; return; }      // (in town: TODO a drive up E 16th)
    home.camSnap = true;          // she was somewhere else: cut to the street, then watch her drive up
    startArrival();
}
