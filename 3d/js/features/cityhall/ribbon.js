// features/cityhall/ribbon.js — ✂️ THE MAYOR'S RIBBON CUTTINGS. Now and then while she walks in a town, the mayor is
// opening something absurd a little way up her sidewalk (a pothole, a bench, a speed bump, a trash can…): two posts and
// a red ribbon, the thing itself, the mayor with the giant scissors, three people politely clapping. He makes his speech,
// SNIP, the ribbon falls, everyone claps a bit. ✋ at the ribbon (before the snip): 🎀 hold the other end · 📸 a photo ·
// keep walking. While it's on, the mayor's office chair is empty ("out cutting"). Local + cosmetic; nothing pays.
// ≤ RIBBON_TUNE.perRun a run, one every gap s, gated like other random town content (ctx.enabled("cityhall")).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ctx, emit } from "../../core/ctx.js";
import { choose } from "../../core/dialog.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { ID, TOWNS, RIBBONS, RIBBON_CROWD, RIBBON_LULU, RIBBON_HELP, RIBBON_TUNE as K } from "./data.js";
import { S, saveSoon, RUN, force, inTown, townId, stat } from "./state.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const C = { next: K.firstAfter, n: 0, log: [] };
export const RB = C;
function log(ev, d = {}) { C.log.push(Object.assign({ ev, t: +ctx.time.toFixed(2) }, d)); if (C.log.length > 60) C.log.shift(); }

const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
const say = (obj, text, sec = 2.4) => { try { if (obj && ctx.foot && ctx.foot.say && !ctx.skipping) ctx.foot.say(obj, text, sec); } catch (e) { /* none */ } };

// ── props: the posts, the thing being opened (baked into one vertex-coloured mesh) + the ribbon (two halves) ──
let bakedMat = null;
function bake(parts) {
    const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), c = new THREE.Color();
    for (const b of parts) {
        const g = b.cyl ? new THREE.CylinderGeometry(b.w / 2, b.w / 2, b.h, 10) : new THREE.BoxGeometry(b.w, b.h, b.d);
        e.set(b.rx || 0, b.ry || 0, b.rz || 0); q.setFromEuler(e); p.set(b.x || 0, b.y || 0, b.z || 0);
        g.applyMatrix4(m.compose(p, q, s));
        c.set(b.color);
        const n = g.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        geos.push(g.index ? g.toNonIndexed() : g);
    }
    const geo = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    if (!bakedMat) bakedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, bakedMat);
    mesh.castShadow = false;
    return mesh;
}
/** The thing being opened, in the scene's local frame (x along the sidewalk, z toward the street; it stands at z ≈ 0). */
function thingParts(what) {
    if (/pothole/.test(what)) return [{ cyl: true, w: 1.4, h: 0.03, x: 0, y: 0.03, z: 0.9, color: "#262626" }, { cyl: true, w: 1.6, h: 0.02, x: 0, y: 0.02, z: 0.9, color: "#6D6D6D" }];
    if (/bench/.test(what)) return [{ w: 1.8, h: 0.1, d: 0.45, x: 0, y: 0.45, z: 0.6, color: "#6D4C41" }, { w: 1.8, h: 0.45, d: 0.08, x: 0, y: 0.75, z: 0.4, color: "#6D4C41" }, { w: 0.08, h: 0.45, d: 0.4, x: -0.8, y: 0.22, z: 0.6, color: "#424242" }, { w: 0.08, h: 0.45, d: 0.4, x: 0.8, y: 0.22, z: 0.6, color: "#424242" }];
    if (/speed bump/.test(what)) return [{ w: 2.4, h: 0.12, d: 0.5, x: 0, y: 0.06, z: 0.9, color: "#FBC02D" }, { w: 0.4, h: 0.13, d: 0.52, x: -0.6, y: 0.06, z: 0.9, color: "#212121" }, { w: 0.4, h: 0.13, d: 0.52, x: 0.6, y: 0.06, z: 0.9, color: "#212121" }];
    if (/meter/.test(what)) return [{ w: 0.08, h: 1.1, d: 0.08, x: 0, y: 0.55, z: 0.7, color: "#607D8B" }, { w: 0.28, h: 0.36, d: 0.2, x: 0, y: 1.25, z: 0.7, color: "#455A64" }, { w: 0.16, h: 0.1, d: 0.02, x: 0, y: 1.3, z: 0.81, color: "#C8E6C9" }];
    if (/trash/.test(what)) return [{ cyl: true, w: 0.6, h: 0.9, x: 0, y: 0.45, z: 0.7, color: "#2E7D32" }, { cyl: true, w: 0.66, h: 0.06, x: 0, y: 0.92, z: 0.7, color: "#1B5E20" }];
    if (/hydrant/.test(what)) return [{ cyl: true, w: 0.34, h: 0.7, x: 0, y: 0.35, z: 0.7, color: "#D32F2F" }, { cyl: true, w: 0.4, h: 0.1, x: 0, y: 0.72, z: 0.7, color: "#B71C1C" }, { w: 0.5, h: 0.1, d: 0.1, x: 0, y: 0.45, z: 0.7, color: "#D32F2F" }];
    if (/crosswalk/.test(what)) return [0, 1, 2, 3].map(i => ({ w: 0.5, h: 0.02, d: 2.2, x: -1.2 + i * 0.8, y: 0.02, z: 1.6, color: "#FAFAFA" }));
    return [{ w: 0.06, h: 0.7, d: 0.06, x: -0.6, y: 0.35, z: 0.7, color: "#9E9E9E" }, { w: 0.06, h: 0.7, d: 0.06, x: 0.6, y: 0.35, z: 0.7, color: "#9E9E9E" }, { w: 1.26, h: 0.06, d: 0.06, x: 0, y: 0.7, z: 0.7, color: "#9E9E9E" }];   // a bike rack
}

/** Start a ribbon cutting near her now (tests: force). → bool */
export function startRibbon() {
    if (RUN.ribbon || !inTown()) return false;
    const lp = herPos(), road = ctx.world && ctx.world.road;
    if (!lp || !road || !road.town) return false;
    const n = road.nearest(lp.x, lp.z, undefined, {}), st = n.street;
    if (!st) return false;
    const town = townId(), list = RIBBONS[town] || RIBBONS.lakewood, it = list[(S.ribbons + C.n) % list.length];
    // up the sidewalk she's walking, near–far m ahead (whichever way along is longer); in the middle of a block
    const along = n.s - st.base, dir = (st.a1 - along) > (along - st.a0) ? 1 : -1;
    const sd = Math.sign(n.d) || 1, s = n.s + dir * rand(K.near[0], K.near[1]);
    const P = road.point(s, sd * (st.curb + 1.4), {}), Q = road.point(s + 2, sd * (st.curb + 1.4), {});
    if (!P || !Q || !isFinite(P.x)) return false;
    const yaw = Math.atan2(Q.x - P.x, Q.z - P.z);            // along the sidewalk
    const ux = Math.sin(yaw), uz = Math.cos(yaw);            // along
    const Sx = road.point(s, sd * st.curb, {});
    const nx = Sx.x - P.x, nz = Sx.z - P.z, nl = Math.hypot(nx, nz) || 1;      // toward the street
    const R = RUN.ribbon = { town, what: it.what, speech: it.speech, x: P.x, z: P.z, ux, uz, nx: nx / nl, nz: nz / nl, t: 0, phase: "wait", seen: false,
        snipped: false, held: false, group: null, halves: [], people: [], mayor: null, rm: null, cheerT: 0 };
    const g = R.group = new THREE.Group();
    g.position.set(P.x, 0, P.z);
    g.rotation.y = Math.atan2(R.ux, R.uz) - Math.PI / 2;     // local +x along the sidewalk, +z toward the street
    // (check the local +z really points at the street; if not, flip)
    const lz = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), g.rotation.y);
    if (lz.x * R.nx + lz.z * R.nz < 0) g.rotation.y += Math.PI;
    const parts = thingParts(it.what).concat([
        { w: 0.1, h: 1.0, d: 0.1, x: -1.5, y: 0.5, z: 0, color: "#C9A646" }, { w: 0.1, h: 1.0, d: 0.1, x: 1.5, y: 0.5, z: 0, color: "#C9A646" },
        { w: 0.3, h: 0.05, d: 0.3, x: -1.5, y: 0.02, z: 0, color: "#5D4037" }, { w: 0.3, h: 0.05, d: 0.3, x: 1.5, y: 0.02, z: 0, color: "#5D4037" },
    ]);
    g.add(bake(parts));
    const rMat = new THREE.MeshStandardMaterial({ color: "#E53935", roughness: 0.5 });
    R.rMat = rMat;
    for (const sx of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(sx * 1.5, 0.92, 0);
        const half = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.02), rMat); half.position.set(-sx * 0.75, 0, 0);
        pivot.add(half); g.add(pivot); R.halves.push(pivot);
    }
    const bow = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.05), rMat); bow.position.set(0, 0.92, 0.01); bow.rotation.z = Math.PI / 4;
    R.halves[0].add(bow); bow.position.set(-1.5, 0, 0.01);
    ctx.scene.add(g);
    // people: the mayor (behind the ribbon, scissors ready) + three onlookers
    ensureModels(["npcMan", "npcWoman"]).then(() => {
        if (RUN.ribbon !== R || !models.npcMan) return;
        const T = TOWNS[town] || TOWNS.lakewood;
        const add = (key, colors, lx, lz, scale = 1) => {
            const p = spawnPerson(models[key] ? key : "npcMan", { colors, scale });
            const w = g.localToWorld(new THREE.Vector3(lx, 0, lz));
            p.obj.position.set(w.x, 0, w.z);
            p.obj.lookAt(g.localToWorld(new THREE.Vector3(0, 0, 0.6)).setY(0));
            ctx.scene.add(p.obj);
            R.people.push(p);
            return p;
        };
        R.mayor = add("npcMan", T.mayor.colors, 0.4, -0.9, 1.04);
        // the giant scissors in his hand (two gold blades)
        const sc = new THREE.Group();
        for (const a of [0.3, -0.3]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.02), new THREE.MeshStandardMaterial({ color: "#D4AF37", metalness: 0.6, roughness: 0.3 })); b.rotation.z = a; b.position.y = 0.3; sc.add(b); }
        sc.position.set(0.35, 1.05, 0.35); R.mayor.obj.add(sc); R.scissors = sc;
        add("npcWoman", { Top: "#F48FB1" }, -2.4, 0.9);
        add("npcMan", { Top: "#81C784" }, 2.3, 1.1);
        add("npcWoman", { Top: "#90CAF9" }, -1.0, 1.7);
    }).catch(() => {});
    if (ctx.foot && ctx.foot.addSpot) R.rm = ctx.foot.addSpot(spot);
    C.n++;
    log("start", { what: it.what, town });
    emit("cityhall:ribbon", { phase: "start", what: it.what, town });
    return true;
}
const spot = {
    r: 2.6, short: "RIBBON",
    pos() { const R = RUN.ribbon; return R && !R.snipped && onFoot() ? { x: R.x + R.nx * 1.2, z: R.z + R.nz * 1.2 } : null; },
    label() { return "🎀 THE RIBBON CUTTING"; },
    act() { help(); },
};
async function help() {
    const R = RUN.ribbon;
    if (!R || R.snipped || ctx.dialogOpen) return;
    R.asking = true;
    const T = TOWNS[R.town] || TOWNS.lakewood;
    const i = await choose(T.mayor.short, RIBBON_HELP.ask, RIBBON_HELP.opts, { emoji: "✂️" });
    R.asking = false;
    if (RUN.ribbon !== R) return;
    if (i === 0) { R.held = true; stat("cityhallRibbonsHeld"); log("help", { how: "hold" }); snip(R); say(ctx.foot.obj, RIBBON_HELP.held, 2.6); }
    else if (i === 1) { stat("cityhallRibbonPhotos"); log("help", { how: "photo" }); say(ctx.foot.obj, RIBBON_HELP.photo, 2.6); }
    else { log("help", { how: "walk" }); }
}
function snip(R) {
    if (R.snipped) return;
    R.snipped = true; R.phase = "cut"; R.t = Math.max(R.t, 0); R.cutT = 0;
    S.ribbons = (S.ribbons || 0) + 1; saveSoon();
    if (R.mayor) say(R.mayor.obj, "*SNIP!*", 1.6);
    emit("cityhall:ribbon", { phase: "snip", what: R.what, town: R.town, held: R.held });
    log("snip", { held: R.held });
}
export function endRibbon(why = "") {
    const R = RUN.ribbon;
    if (!R) return;
    RUN.ribbon = null;
    if (R.rm) R.rm();
    for (const p of R.people) if (p.obj.parent) p.obj.parent.remove(p.obj);
    if (R.group) {
        ctx.scene.remove(R.group);
        R.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material !== bakedMat && o.material !== R.rMat && o.material.dispose) o.material.dispose(); } });
        R.rMat.dispose();
    }
    log("end", { why });
}

/** Called from index.js every frame (hud hook). */
export function ribbonTick(dt) {
    const R = RUN.ribbon;
    if (!R) {
        if (!inTown() || !onFoot() || !ctx.enabled(ID) || (ctx.party && ctx.party.active && !(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns()))) return;
        if (ctx.dialogOpen || (ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return;
        if (C.n >= K.perRun && !force.ribbonNow) return;
        C.next -= dt;
        if (C.next > 0 && !force.ribbonNow) return;
        force.ribbonNow = false;
        C.next = rand(K.gap[0], K.gap[1]);
        startRibbon();
        return;
    }
    const lp = herPos();
    const d = lp ? Math.hypot(lp.x - R.x, lp.z - R.z) : 1e9;
    if (!inTown() || d > 90 || R.t > K.life + 30 || (!onFoot() && ctx.state !== "interior")) { endRibbon(!inTown() ? "town" : "gone"); return; }
    if (ctx.state !== "footRun" || ctx.paused) return;
    if (!R.asking) R.t += dt;
    // the people: the mayor talks / waves the scissors, the crowd idles then claps after the snip
    R.cheerT = Math.max(0, R.cheerT - dt);
    R.people.forEach((p, i) => {
        if (i === 0) p.update(dt, { talk: R.phase === "speech", wave: R.phase === "cut" && R.cutT < 1.5 });
        else p.update(dt, { cheer: R.cheerT > 0 && (i % 2 === 0), wave: R.cheerT > 0 && i % 2 === 1 });
    });
    if (!R.seen && d < 26) { R.seen = true; if (Math.random() < 0.7) say(ctx.foot.obj, pick(RIBBON_LULU), 2.6); }
    if (R.phase === "wait" && (d < 16 || R.t > 6)) {
        R.phase = "speech"; R.speechT = 0;
        const T = TOWNS[R.town] || TOWNS.lakewood;
        if (R.mayor) say(R.mayor.obj, `${T.mayor.short} opens ${R.what}! ${R.speech}`, 3.6);
    } else if (R.phase === "speech") {
        R.speechT += dt;
        if (R.speechT > 1.8 && !R.crowdSaid && R.people[2]) { R.crowdSaid = true; say(R.people[2].obj, pick(RIBBON_CROWD), 1.8); }
        if (R.speechT > 7 && !R.asking) snip(R);
    } else if (R.phase === "cut") {
        R.cutT += dt;
        if (R.cutT < 0.1) R.cheerT = 3.2;
        // the two halves fall to the posts
        const k = Math.min(1, R.cutT / 0.6);
        R.halves[0].rotation.z = -k * 1.35; R.halves[1].rotation.z = k * 1.35;
        if (R.cutT > 0.6 && !R.clapSaid && R.people[1]) { R.clapSaid = true; say(R.people[1].obj, pick(RIBBON_CROWD), 1.8); }
        if (R.cutT > 14) R.phase = "done";
    } else if (R.phase === "done" && d > 30) endRibbon("done");
}
export function ribbonReset() { endRibbon("reset"); C.next = K.firstAfter; C.n = 0; }
