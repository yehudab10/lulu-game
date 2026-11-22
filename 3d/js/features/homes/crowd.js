// features/homes — 🏙️ THE LIVING TOWN: sidewalks full of people (families with strollers, kids on scooters,
// bochurim walking fast, ladies chatting, dog walkers, the mail carrier, delivery guys on e-bikes), people on
// porches and lawns (a man reading on his rocker, a kid's lemonade stand, a dad washing the minivan, raking /
// shovelling / watering by the season, kids playing ball), porch lights at night, kids' voices and a distant
// ice-cream truck. They react to Lulu: a wave, a gossip ("is that THE Lulu?" — memory's notoriety), scatter
// from a speeding car, yell at a honk.
//
// PERF: every figure is an instanced rig (rig.js): ~5 draw calls per body type for the whole town, only the
// near ones (≤ NEAR m, ≤ MAX_NEAR of them) get the full rig, the rest are one ~70-triangle LOD figure in ONE
// draw call, far / occluded ones are skipped; far peds simulate every 3rd frame. Props are instanced the same
// way. No shadows (a soft blob under the near ones). A 🎉 Free Roam town: layout + routes from the party seed
// (ctx.openworld.seeded) — reactions stay local (nothing to sync).
import * as THREE from "three";
import { ctx, emit, pick } from "../../core/ctx.js";
import { save3d, wallet } from "../../core/save.js";
import { models, findNodes } from "../../models.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { PL, streetPoint, streetCoords, otherAt, nodeAlong, headingOf as headingLocal, sightBlocked, toWorld, toLocal, wH } from "../town/plan.js";
/** A street direction's WORLD heading (the town can stand turned at its interchange). */
const headingOf = (st, dir) => wH(headingLocal(st, dir));
import { Rig, LodCrowd, crowdMaterial } from "./rig.js";
import { PED, CROWD, TOPS, BOTTOMS, HAIRS, SHEITELS } from "./data.js";

export const CROWD_MODELS = ["npcMan", "npcWoman", "npcKid", "town_bochur", "town_ebike", "homesMail", "homesDelivery", "homesDog", "homesStreet"];
const PERSON = ["Body", "Arm_L", "Arm_R", "Leg_L", "Leg_R"];
const LOOKS = { man: "npcMan", woman: "npcWoman", kid: "npcKid", bochur: "town_bochur", mail: "homesMail", delivery: "homesDelivery" };
const MAXR = { man: 12, woman: 14, kid: 14, bochur: 10, mail: 2, delivery: 6 };
const PROPS = { Stroller: 6, Scooter: 6, Rocker: 8, Newspaper: 8, LemonadeStand: 3, Bucket: 4, Rake: 4, Shovel: 4, Hose: 4, HoseCoil: 4, LeafPile: 4, SnowPile: 4, MailBag: 2, DeliveryBag: 6, Kickball: 4 };
/** Hooks other homes modules set: porch(p, d) → a line (a wave-in / her name) | null. */
export const HOOKS = { porch: null };
export const TUNE = { NEAR: 30, FAR: 96, MAX_NEAR: 26, SCATTER: 8.5, SCATTER_V: 8.5, RECYCLE: 105, BACK: [34, 80] };

export const C = { on: false, peds: [], rigs: {}, props: {}, dog: null, bike: null, lod: null, blobs: null, leash: null, lights: null, group: null,
    frame: 0, stats: { peds: 0, near: 0, far: 0, hidden: 0, ms: 0 }, said: 0, honkT: 0, kidsLoop: null, kidsAnchor: null, jingleT: 30, anchors: [], talk: null };

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _l = {}, _p = {};
const _root = new THREE.Matrix4(), _m = new THREE.Matrix4(), _arm = new THREE.Matrix4(), _body = new THREE.Matrix4(), _dp = new THREE.Vector3();
const q3 = (x, y, z) => _q.setFromEuler(_e.set(x, y, z, "XYZ"));
const col = hex => new THREE.Color(hex);
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.foot.pos);
const luluPos = () => onFoot() ? ctx.foot.pos : ctx.car.pos;
const season = () => { const m = new Date().getMonth(); return m === 11 || m <= 1 ? "winter" : m >= 8 && m <= 10 ? "autumn" : "summer"; };

// ── setup ────────────────────────────────────────────────────────────────
/** Build the crowd for the town she just entered. homes: the door list (index.js), drives: driveway vans. */
export function startCrowd(T, def, homes, opts = {}) {
    stopCrowd();
    if (!models.npcMan || !models.homesStreet) return false;
    const cfg = CROWD[def.id] || CROWD.lakewood;
    const party = !!(ctx.party && ctx.party.active);
    const q = (save3d.settings && save3d.settings.quality) || "auto";
    const scale = (q === "low" ? 0.6 : 1) * (party ? 0.7 : 1) * (opts.density || 1);
    C.group = new THREE.Group(); C.group.name = "HomesCrowd";
    ctx.scene.add(C.group);
    for (const [k, key] of Object.entries(LOOKS)) if (models[key]) { C.rigs[k] = new Rig(models[key], PERSON, MAXR[k], { name: k }); C.group.add(C.rigs[k].group); }
    if (models.homesDog) { C.dog = new Rig(models.homesDog, ["Body", "Leg_FL", "Leg_FR", "Leg_BL", "Leg_BR", "Tail"], 6, { name: "dog" }); C.group.add(C.dog.group); }
    if (models.town_ebike) { C.bike = new Rig(models.town_ebike, ["Wheel_F", "Wheel_R"], 6, { name: "ebike" }); C.group.add(C.bike.group); }
    models.homesStreet.updateMatrixWorld(true);
    for (const [name, n] of Object.entries(PROPS)) {
        const node = findNodes(models.homesStreet, "Prop_" + name)[0];
        if (node) { C.props[name] = new Rig(node, [], n, { name }); C.group.add(C.props[name].group); }
    }
    C.lod = new LodCrowd(140); C.group.add(C.lod.im);
    // soft blobs under the near ones (one draw call)
    const bt = blobTex();
    C.blobMat = new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, color: "#000000", opacity: 0.32 });
    const bg = new THREE.PlaneGeometry(0.9, 0.9); bg.rotateX(-Math.PI / 2);
    C.blobs = new THREE.InstancedMesh(bg, C.blobMat, TUNE.MAX_NEAR + 12); C.blobs.frustumCulled = false; C.blobs.count = 0; C.blobs.renderOrder = 1;
    C.group.add(C.blobs);
    // leashes (one line-segments draw call)
    const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6 * 2 * 3), 3));
    C.leash = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: "#C62828" })); C.leash.frustumCulled = false; C.group.add(C.leash);
    // porch lights (one points draw call, lit at night)
    const lp = new Float32Array(homes.length * 3);
    homes.forEach((h, i) => { lp[i * 3] = h.door.x + h.nx * 0.5; lp[i * 3 + 1] = h.lightY || 2.55; lp[i * 3 + 2] = h.door.z + h.nz * 0.5; });
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    C.lights = new THREE.Points(pg, new THREE.PointsMaterial({ map: bt.glow, size: 1.5, color: "#FFD27A", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    C.lights.frustumCulled = false; C.lights.visible = false; C.group.add(C.lights);
    // bubble anchors
    C.anchors = [0, 1, 2, 3, 4].map(() => { const o = new THREE.Object3D(); C.group.add(o); return { obj: o, ped: null, t: 0 }; });
    Object.assign(C, { on: true, def, T, homes, frame: 0, said: 0, honkT: 0, jingleT: 25 + Math.random() * 20, talk: null });

    const spawn = () => {
        const R = Math.random;
        // walkers on every street, weighted by length
        const streets = PL.STREETS.filter(st => st.walk - st.outer > 1.5);
        const len = streets.map(st => st.a1 - st.a0), total = len.reduce((a, b) => a + b, 0);
        const nW = Math.round(cfg.walkers * scale);
        const mix = Object.entries(cfg.mix), mixW = mix.reduce((a, [, w]) => a + w, 0);
        // every town gets the signature walkers at least (a dice roll once left Lakewood with no dog at all)
        const must = ["dog", "dog", "stroller", "scooter", "mail"].filter(t => cfg.mix[t]);
        for (let i = 0; i < nW; i++) {
            let r = R() * total, st = streets[0];
            for (let k = 0; k < streets.length; k++) { r -= len[k]; if (r <= 0) { st = streets[k]; break; } }
            let w = R() * mixW, type = mix[0][0];
            for (const [t, ww] of mix) { w -= ww; if (w <= 0) { type = t; break; } }
            if (i < must.length) type = must[i];
            addWalker(type, st, st.a0 + 6 + R() * (st.a1 - st.a0 - 12), R() < 0.5 ? 1 : -1, R() < 0.5 ? 1 : -1, R);
        }
        // porches, lawns, driveways
        const pm = Object.entries(cfg.porchMix), pmW = pm.reduce((a, [, w]) => a + w, 0);
        const cap = Math.round(40 * scale);
        let n = 0;
        for (const h of homes) {
            if (n >= cap || R() > cfg.porches * scale) continue;
            let w = R() * pmW, type = pm[0][0];
            for (const [t, ww] of pm) { w -= ww; if (w <= 0) { type = t; break; } }
            if (addPorch(type, h, R, opts.drives || [])) n++;
        }
        // delivery e-bikes (not in a party: they'd ride through the shared traffic)
        if (!party && C.bike && C.rigs.delivery) for (let i = 0; i < Math.round(cfg.bikes * scale); i++) {
            const st = PL.STREETS[Math.floor(R() * PL.STREETS.length)];
            addBike(st, st.a0 + 10 + R() * (st.a1 - st.a0 - 20), R() < 0.5 ? 1 : -1, R);
        }
    };
    if (party && ctx.openworld && ctx.openworld.seeded) ctx.openworld.seeded(def.id + ":crowd", spawn); else spawn();
    C.stats.peds = C.peds.length;
    return true;
}
export function stopCrowd() {
    if (C.kidsLoop) { try { C.kidsLoop.stop(); } catch (e) { /* gone */ } C.kidsLoop = null; }
    for (const r of Object.values(C.rigs)) r.dispose();
    for (const r of Object.values(C.props)) r.dispose();
    for (const r of [C.dog, C.bike, C.lod]) if (r) r.dispose();
    if (C.blobs) { C.blobs.geometry.dispose(); C.blobs.dispose(); C.blobMat.map.glow.dispose(); C.blobMat.map.dispose(); C.blobMat.dispose(); }
    if (C.leash) { C.leash.geometry.dispose(); C.leash.material.dispose(); }
    if (C.lights) { C.lights.geometry.dispose(); C.lights.material.dispose(); }
    if (C.group && C.group.parent) C.group.parent.remove(C.group);
    Object.assign(C, { on: false, peds: [], rigs: {}, props: {}, dog: null, bike: null, lod: null, blobs: null, leash: null, lights: null, group: null, anchors: [], talk: null, kids: [], kidsAnchor: null });
}
function blobTex() {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.glow = new THREE.CanvasTexture(c);
    return t;
}

function colorsFor(type, R) {
    const top = type === "mail" ? "#90CAF9" : type === "delivery" ? "#00C853" : type === "bochur" ? "#FFFFFF" : TOPS[Math.floor(R() * TOPS.length)];
    const bot = type === "bochur" ? "#212121" : type === "mail" ? "#1A237E" : BOTTOMS[Math.floor(R() * BOTTOMS.length)];
    const hair = type === "woman" ? SHEITELS[Math.floor(R() * SHEITELS.length)] : HAIRS[Math.floor(R() * HAIRS.length)];
    return { top: col(top), bot: col(bot), hair: col(hair) };
}
function basePed(o) {
    return Object.assign({ id: C.peds.length, x: 0, z: 0, h: 0, speed: 0, phase: Math.random() * 6, t: Math.random() * 9, acc: 0, waveT: 0, talkT: 0, pointT: 0, jumpT: 0,
        flee: null, sayT: 0, waved: -99, gossiped: false, dist: 1e9, occ: false, lod: 2 }, o);
}

// ── walkers ──────────────────────────────────────────────────────────────
function addWalker(type, st, along, dir, side, R) {
    const look = type === "pair" || type === "stroller" || type === "dog" || type === "shopper" ? "woman" : type === "scooter" ? "kid" : type;
    if (!C.rigs[look === "pair" ? "woman" : look]) return null;
    const sw = (st.outer + st.walk) / 2;
    const p = basePed({ kind: "walker", type, look, colors: colorsFor(look, R), st, along, dir, side, lat: sw + (R() - 0.5) * 0.8, want: sw, rnd: R(), lastNode: null,
        base: type === "bochur" ? 1.75 + R() * 0.3 : type === "scooter" ? 2.8 + R() * 0.8 : type === "stroller" ? 1.0 : type === "mail" ? 1.1 : 1.2 + R() * 0.3 });
    p.speed = p.base;
    if (type === "pair") { p.buddy = { look: R() < 0.7 ? "woman" : "man", colors: colorsFor("woman", R) }; p.base = 1.0; p.speed = 1.0; }
    if (type === "dog" && C.dog) p.dogColors = { top: col(pick(["#C8A27A", "#3E2723", "#F5F5F5", "#E0B070", "#8D6E63"])), bot: col("#6D4C41"), hair: col("#000") };
    if (type === "dog" && R() < 0.5) { p.look = "man"; p.colors = colorsFor("man", R); }
    C.peds.push(p);
    place(p);
    return p;
}
function place(p) {
    const pt = streetPoint(p.st, p.along, p.side * p.lat, _p);
    toWorld(pt.x, pt.z, p);
    if (p.h === 0 && !p.turned) { p.h = headingOf(p.st, p.dir); p.turned = true; }
}
function stepWalker(p, dt) {
    if (p.flee) {                                   // jumping out of a car's way
        p.flee.t -= dt;
        p.x += p.flee.vx * dt; p.z += p.flee.vz * dt;
        toLocal(p.x, p.z, _l);
        const sc = streetCoords(p.st, _l.x, _l.z, _l);
        p.along = sc.along; p.lat = Math.abs(sc.d); p.side = Math.sign(sc.d) || 1;
        if (p.flee.t <= 0) p.flee = null;
        return;
    }
    const st = p.st;
    let along = p.along + p.dir * p.speed * dt;
    // the next crossing ahead: turn the corner, cross over, or turn back (once per node)
    for (const c of st.cross) {
        const cs = otherAt(c.node, st.id), edge = c.a - p.dir * (cs.outer + 1.2);
        if ((p.along - edge) * (along - edge) <= 0 && c.node !== p.lastNode) {
            p.lastNode = c.node;
            const r = Math.random();
            if (r < 0.42 && cs.walk - cs.outer > 1.5) {
                // round the corner: the same point on the cross street's sidewalk, walking away from the node
                const pt = streetPoint(st, edge, p.side * p.lat, _p);
                const sc = streetCoords(cs, pt.x, pt.z, _l), na = nodeAlong(cs, c.node);
                p.st = cs; p.along = sc.along; p.side = Math.sign(sc.d) || 1; p.lat = Math.abs(sc.d);
                p.dir = sc.along >= na ? 1 : -1; p.want = (cs.outer + cs.walk) / 2;
                p.lastNode = c.node;
                place(p); return;
            } else if (r > 0.8) { p.dir = -p.dir; along = p.along; }
            break;
        }
    }
    if (along < st.a0 + 4 || along > st.a1 - 4) { p.dir = -p.dir; along = Math.max(st.a0 + 4, Math.min(st.a1 - 4, along)); }
    p.along = along;
    p.lat += (p.want - p.lat) * Math.min(1, dt * 0.8);
    place(p);
    p.speed += (p.base - p.speed) * Math.min(1, dt * 2);
}

/** Put a far-off walker / bike back on a sidewalk (street) 34–80 m from her, out of the way of the camera's middle. */
function respawnNear(p, lp, _d) {
    toLocalXZ(lp.x, lp.z);
    const cam = ctx.camera.position, fx = ctx.car ? Math.sin(ctx.car.h) : 0, fz = ctx.car ? Math.cos(ctx.car.h) : 1;
    for (let k = 0; k < 8; k++) {
        const st = PL.STREETS[Math.floor(Math.random() * PL.STREETS.length)];
        if (p.kind === "walker" && st.walk - st.outer < 1.5) continue;
        const sc = streetCoords(st, _l.x, _l.z, {});
        if (Math.abs(sc.d) > TUNE.BACK[1]) continue;
        const off = (Math.random() < 0.5 ? -1 : 1) * (TUNE.BACK[0] + Math.random() * (TUNE.BACK[1] - TUNE.BACK[0]));
        const along = Math.max(st.a0 + 8, Math.min(st.a1 - 8, sc.along + off));
        const side = Math.random() < 0.5 ? -1 : 1, lat = p.kind === "walker" ? (st.outer + st.walk) / 2 : 0;
        const pt = streetPoint(st, along, side * lat, _p), pw = toWorld(pt.x, pt.z, {}), wx = pw.x, wz = pw.z;
        const dl = Math.hypot(wx - lp.x, wz - lp.z);
        if (dl < TUNE.BACK[0] - 4 || dl > TUNE.BACK[1] + 12) continue;
        // not popping in right in front of the camera
        const cx = wx - cam.x, cz = wz - cam.z, cd = Math.hypot(cx, cz);
        if (cd < 50 && (cx * fx + cz * fz) / (cd || 1) > 0.5 && !sightBlocked(toLocal(cam.x, cam.z, _cl).x, _cl.z, pt.x, pt.z)) continue;
        p.st = st; p.along = along; p.dir = Math.random() < 0.5 ? 1 : -1; p.lastNode = null;
        if (p.kind === "walker") { p.side = side; p.lat = lat; p.want = lat; place(p); p.h = headingOf(st, p.dir); }
        else { p.h = headingOf(st, p.dir); bikePlace(p); }
        p.gossiped = false;
        return true;
    }
    return false;
}
const toLocalXZ = (x, z) => toLocal(x, z, _l);
const _cl = {}, _pl = {};

// ── porches / lawns / driveways (they stay put) ─────────────────────────
function addPorch(type, h, R, drives) {
    const O = (u, n) => ({ x: h.lot.x + h.ux * u + h.nx * n, z: h.lot.z + h.uz * u + h.nz * n });
    const face = Math.atan2(h.nx, h.nz), back = face + Math.PI;
    const st = (look, at, f, extra) => {
        if (!C.rigs[look]) return null;
        const p = basePed(Object.assign({ kind: "porch", type, look, colors: colorsFor(look, R), x: at.x, z: at.z, h: f, home: h, still: true }, extra));
        C.peds.push(p); return p;
    };
    const side = R() < 0.5 ? -1 : 1, sideU = side * (h.w * 0.32);
    if (type === "reader") return st(R() < 0.5 ? "man" : "woman", O(sideU, -0.6), face, { sit: true, props: [["Rocker", 0, 0, 0], ["Newspaper", "hand"]], read: true });
    if (type === "chatters") { const a = O(sideU - 0.55, 0.6), b = O(sideU + 0.55, 0.6); const p = st("woman", a, Math.atan2(b.x - a.x, b.z - a.z), { chat: true }); st("woman", b, Math.atan2(a.x - b.x, a.z - b.z), { chat: true }); return p; }
    if (type === "family") { st("woman", O(sideU * 0.4, -0.4), face, { chat: true }); return st("kid", O(sideU, 1.2), face, { hop: true }); }
    if (type === "washer") {
        const v = drives.find(d => Math.hypot(d.x - h.lot.x, d.z - h.lot.z) < 10);
        if (!v) return null;
        const vx = Math.sin(v.rot), vz = Math.cos(v.rot), sx = Math.cos(v.rot), sz = -Math.sin(v.rot);
        const at = { x: v.x + sx * 1.45, z: v.z + sz * 1.45 };
        return st("man", at, Math.atan2(-sx, -sz), { scrub: true, props: [["Bucket", 0.5, 0, 0.4], ["Hose", "hand"]] });
    }
    if (type === "lemonade") { const s = O(sideU, 1.3); C.lemon = C.lemon || []; const p = st("kid", O(sideU, 0.7), face, { props: [["LemonadeStand", 0, 0, 0.6]], lemonade: true }); return p; }
    if (type === "yard") {
        const sz = season(), w = ctx.atmos && ctx.atmos.weather === "snow" ? "winter" : sz;
        const tool = w === "winter" ? "Shovel" : w === "autumn" ? "Rake" : "Hose", pile = w === "winter" ? "SnowPile" : w === "autumn" ? "LeafPile" : "HoseCoil";
        return st(R() < 0.6 ? "man" : "bochur", O(sideU, 1.0), face + (R() - 0.5) * 2, { rake: tool !== "Hose", water: tool === "Hose", yard: tool.toLowerCase(), props: [[tool, "hand"], [pile, 0, 0, 1.1]] });
    }
    if (type === "kids") {
        const a = st("kid", O(sideU - 1.4, 1.3), face, { play: 0 }), b = st("kid", O(sideU + 1.4, 1.3), face, { play: 1 });
        if (a && b) { a.mate = b; b.mate = a; a.facing = Math.atan2(b.x - a.x, b.z - a.z); b.facing = a.facing + Math.PI; a.h = a.facing; b.h = b.facing; a.ball = { t: 0 }; C.kids = C.kids || []; C.kids.push(a); }
        return a;
    }
    return null;
}

// ── e-bikes ──────────────────────────────────────────────────────────────
function addBike(st, along, dir, R) {
    const p = basePed({ kind: "bike", type: "delivery", look: "delivery", colors: colorsFor("delivery", R), st, along, dir, base: 7 + R() * 2.5, spin: 0, lastNode: null, ring: 0 });
    p.speed = p.base;
    C.peds.push(p);
    bikePlace(p);
    return p;
}
function bikePlace(p) {
    const lane = p.dir * (3.5 * (p.st.lanes || 1) - 0.9);
    const pt = streetPoint(p.st, p.along, lane, _p);
    toWorld(pt.x, pt.z, p);
    const want = headingOf(p.st, p.dir);
    let d = want - p.h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    p.h += d * Math.min(1, 0.3);
}
function stepBike(p, dt, lp) {
    const st = p.st;
    // slow for her car right ahead
    const car = ctx.car, fx = Math.sin(p.h), fz = Math.cos(p.h);
    const dx = car.pos.x - p.x, dz = car.pos.z - p.z, ahead = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
    const block = !onFoot() && ahead > 0 && ahead < 7 && lat < 2;
    p.speed += ((block ? 0 : p.base) - p.speed) * Math.min(1, dt * 3);
    let along = p.along + p.dir * p.speed * dt;
    for (const c of st.cross) {
        if ((p.along - c.a) * (along - c.a) <= 0 && c.node !== p.lastNode) {
            p.lastNode = c.node;
            if (Math.random() < 0.35) {
                const cs = otherAt(c.node, st.id), na = nodeAlong(cs, c.node);
                p.st = cs; p.dir = Math.random() < 0.5 ? 1 : -1; along = na + p.dir * 0.5;
            }
            break;
        }
    }
    if (along < p.st.a0 + 6 || along > p.st.a1 - 6) { p.dir = -p.dir; along = Math.max(p.st.a0 + 6, Math.min(p.st.a1 - 6, along)); }
    p.along = along;
    p.spin += p.speed * dt / 0.34;
    bikePlace(p);
    if (block && p.ring <= 0) { p.ring = 4; sayAt(p, pick(["DING DING!", "Move it, lady!", "Delivery! DELIVERY!", "*bell*"]), 1.6); }
    p.ring -= dt;
}

// ── per frame ────────────────────────────────────────────────────────────
export function tickCrowd(dt) {
    if (!C.on) return;
    const t0 = performance.now();
    C.frame++;
    const cam = ctx.camera.position, lp = luluPos(), car = ctx.car, foot = onFoot();
    const night = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0;
    const wet = ctx.atmos && (ctx.atmos.weather === "rain" || ctx.atmos.weather === "storm");
    C.honkT -= dt; C.said -= dt;
    const fast = !foot && car.speed > TUNE.SCATTER_V;
    const cfx = Math.sin(car.h), cfz = Math.cos(car.h);
    const nearCap = TUNE.MAX_NEAR;
    let nNear = 0, nFar = 0, nHid = 0;
    for (const r of Object.values(C.rigs)) r.begin();
    for (const r of Object.values(C.props)) r.begin();
    if (C.dog) C.dog.begin(); if (C.bike) C.bike.begin();
    C.lod.begin();
    let blobs = 0, leashes = 0;
    const lpos = C.leash.geometry.attributes.position;
    for (let i = 0; i < C.peds.length; i++) {
        const p = C.peds[i];
        // who's out: kids + yard work go in at night, half the walkers stay in in the rain
        const out = !((night > 0.55 && (p.look === "kid" || p.yard || p.lemonade)) || ((night > 0.55 || wet) && p.kind === "walker" && (p.id % 2 === 0)) || (wet && p.kind === "porch" && !p.sit));
        if (!out) { nHid++; continue; }
        const dx = p.x - cam.x, dz = p.z - cam.z, d = Math.hypot(dx, dz);
        p.dist = d;
        // the town lives where SHE is: a walker / e-bike that's drifted far off comes back round a corner near her
        if ((p.kind === "walker" || p.kind === "bike") && (C.frame + i) % 8 === 0 && Math.hypot(p.x - lp.x, p.z - lp.z) > TUNE.RECYCLE && !p.flee) respawnNear(p, lp, d);
        const near = d < TUNE.NEAR && nNear < nearCap;
        p.acc += dt;
        if (near || (C.frame + i) % 3 === 0) {
            const sdt = Math.min(0.2, p.acc); p.acc = 0;
            if (p.kind === "walker") stepWalker(p, sdt);
            else if (p.kind === "bike") stepBike(p, sdt, lp);
            p.t += sdt;
            react(p, sdt, lp, foot, fast, cfx, cfz);
            if (d > 22 && (C.frame + i) % 6 === 0) { toLocal(cam.x, cam.z, _cl); toLocal(p.x, p.z, _pl); p.occ = sightBlocked(_cl.x, _cl.z, _pl.x, _pl.z); }
            else if (d <= 22) p.occ = false;
        }
        if (d > TUNE.FAR || p.occ) { nHid++; continue; }
        // heading: walkers face where they go (or flee), the still ones face their spot / whoever's talking
        if (p.kind === "walker") { const want = p.flee ? Math.atan2(p.flee.vx, p.flee.vz) : headingOf(p.st, p.dir); let dh = want - p.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; p.h += dh * Math.min(1, dt * 7); }
        else if (p.lookAt && p.lookAtT > 0) { p.lookAtT -= dt; const want = Math.atan2(p.lookAt.x - p.x, p.lookAt.z - p.z); let dh = want - p.h; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2; p.h += dh * Math.min(1, dt * 5); }
        const y = p.jumpT > 0 ? Math.sin(Math.min(1, p.jumpT / 0.45) * Math.PI) * 0.35 : 0;
        if (p.jumpT > 0) p.jumpT -= dt;
        _root.compose(_v.set(p.x, y, p.z), q3(0, p.h, 0), _s.set(1, 1, 1));
        if (!near) {
            nFar++;
            const sc = p.look === "kid" ? 0.72 : 1;
            if (p.kind === "bike") { _m.compose(_v.set(p.x, 0.42, p.z), q3(0, p.h, 0), _s.set(1, 0.8, 1)); C.lod.add(p, p.colors, _m); }
            else { _m.compose(_v.set(p.x, y, p.z), q3(0, p.h, 0), _s.set(sc, sc, sc)); C.lod.add(p, p.colors, _m); }
            if (p.buddy) { _v.set(0.75, 0, 0).applyAxisAngle(UP, p.h); _m.compose(_v.add(_v2.set(p.x, 0, p.z)), q3(0, p.h, 0), _s.set(1, 1, 1)); C.lod.add(p.buddy, p.buddy.colors, _m); }
            continue;
        }
        nNear++;
        drawNear(p, dt);
        if (blobs < C.blobs.count + 999 && blobs < TUNE.MAX_NEAR + 12) { _m.compose(_v.set(p.x, 0.06, p.z), _q.identity(), _s.set(p.look === "kid" ? 0.8 : 1, 1, p.look === "kid" ? 0.8 : 1)); C.blobs.setMatrixAt(blobs++, _m); }
        if (p.dogPos && leashes < 6) {
            lpos.setXYZ(leashes * 2, p.hand.x, p.hand.y, p.hand.z);
            lpos.setXYZ(leashes * 2 + 1, p.dogPos.x, 0.42, p.dogPos.z);
            leashes++;
        }
    }
    for (const r of Object.values(C.rigs)) r.end();
    for (const r of Object.values(C.props)) r.end();
    if (C.dog) C.dog.end(); if (C.bike) C.bike.end();
    C.lod.end();
    C.blobs.count = blobs; C.blobs.visible = blobs > 0; if (blobs) C.blobs.instanceMatrix.needsUpdate = true;
    C.leash.geometry.setDrawRange(0, leashes * 2); C.leash.visible = leashes > 0; if (leashes) lpos.needsUpdate = true;
    // porch lights at night
    C.lights.visible = night > 0.08; C.lights.material.opacity = Math.min(1, night * 1.4);
    tickAnchors(dt);
    tickSound(dt, lp, night, wet);
    Object.assign(C.stats, { near: nNear, far: nFar, hidden: nHid, ms: C.stats.ms * 0.9 + (performance.now() - t0) * 0.1 });
}
const UP = new THREE.Vector3(0, 1, 0), _v2 = new THREE.Vector3();
const HAND = { man: 0.47, woman: 0.45, bochur: 0.47, mail: 0.47, delivery: 0.47, kid: 0.34 };

/** One near figure: the person rig (+ a buddy, a dog, props). */
function drawNear(p, dt) {
    const rig = C.rigs[p.look];
    const walk = p.kind === "walker" ? (p.flee ? 4 : p.speed) : 0;
    p.phase += dt * (walk > 0.05 ? 2.2 + walk * 2.4 : 0);
    const pose = { walk, sit: p.sit, wave: p.waveT > 0, talk: p.talkT > 0 || p.chat, point: p.pointT > 0, cheer: p.hop && Math.sin(p.t * 2) > 0.6,
        push: p.type === "stroller", kick: p.type === "scooter", read: p.read, scrub: p.scrub, rake: p.rake, water: p.water, bike: p.kind === "bike" };
    if (p.kind === "bike") {
        // the bike, the rider on it, the bag on the rack
        const bi = C.bike.add(p, null);
        if (bi >= 0) { _m.copy(_root); C.bike.pose(bi, "_rest", _m); C.bike.pose(bi, "Wheel_F", _m, q3(p.spin, 0, 0)); C.bike.pose(bi, "Wheel_R", _m, q3(p.spin, 0, 0)); }
        _m.compose(_v.set(0, 0.42, 0.18), _q.identity(), _s.set(1, 1, 1)); _body.multiplyMatrices(_root, _m);
        poseRig(rig, p, _body, Object.assign(pose, { sit: true }));
        const bag = C.props.DeliveryBag;
        if (bag) { const k = bag.add(p, null); if (k >= 0) { _m.compose(_v.set(0, 0.66, -0.5), _q.identity(), _s.set(0.8, 0.8, 0.8)); bag.pose(k, "_rest", _m.premultiply(_root)); } }
        return;
    }
    poseRig(rig, p, _root, pose);
    if (p.buddy) {
        const brig = C.rigs[p.buddy.look];
        if (brig) {
            _m.compose(_v.set(0.75, 0, 0), _q.identity(), _s.set(1, 1, 1)); _body.multiplyMatrices(_root, _m);
            poseRig(brig, p.buddy, _body, { walk, talk: true }, p.phase + 1.3, p.t + 2);
        }
    }
    // props: [name, "hand"] in the right hand, or [name, x, y, z] in the ped's frame
    for (const pr of p.props || []) {
        const R = C.props[pr[0]];
        if (!R) continue;
        const k = R.add(p, null);
        if (k < 0) continue;
        if (pr[1] === "hand") { _m.compose(_v.set(0, -(HAND[p.look] || 0.47), 0.04), _q.identity(), _s.set(1, 1, 1)); R.pose(k, "_rest", _m.premultiply(_arm)); }
        else { _m.compose(_v.set(pr[1], pr[2], pr[3]), _q.identity(), _s.set(1, 1, 1)); R.pose(k, "_rest", _m.premultiply(_root)); }
    }
    if (p.type === "stroller" && C.props.Stroller) { const k = C.props.Stroller.add(p, null); if (k >= 0) { _m.compose(_v.set(0, 0, 0.85), _q.identity(), _s.set(1, 1, 1)); C.props.Stroller.pose(k, "_rest", _m.premultiply(_root)); } }
    if (p.type === "scooter" && C.props.Scooter) { const k = C.props.Scooter.add(p, null); if (k >= 0) C.props.Scooter.pose(k, "_rest", _root); }
    if (p.type === "mail" && C.props.MailBag) { const k = C.props.MailBag.add(p, null); if (k >= 0) { _m.compose(_v.set(0.24, 0.92, 0.02), _q.identity(), _s.set(1, 1, 1)); C.props.MailBag.pose(k, "_rest", _m.premultiply(_root)); } }
    if (p.ball && C.props.Kickball) {
        // the ball flies between the two kids
        const b = p.ball, m = p.mate; b.t += dt / 1.3;
        const u = b.t % 2 < 1 ? b.t % 1 : 1 - (b.t % 1);
        const k = C.props.Kickball.add(p, null);
        if (k >= 0) { _m.compose(_v.set(p.x + (m.x - p.x) * u, Math.sin(u * Math.PI) * 1.6, p.z + (m.z - p.z) * u), _q.identity(), _s.set(1, 1, 1)); C.props.Kickball.pose(k, "_rest", _m); }
        p.hopT = u < 0.1 ? 0.3 : 0; m.hopT = u > 0.9 ? 0.3 : 0;
    }
    // the dog trots beside on its leash
    p.dogPos = null;
    if (p.type === "dog" && C.dog) {
        const k = C.dog.add(p, p.dogColors);
        if (k >= 0) {
            _v.set(-0.7, 0, 1.1).applyAxisAngle(UP, p.h);
            const dx = p.x + _v.x, dz = p.z + _v.z;
            _m.compose(_v.set(dx, 0, dz), q3(0, p.h + Math.sin(p.t * 1.7) * 0.25, 0), _s.set(1, 1, 1));
            const s = Math.sin(p.phase * 1.6) * Math.min(0.7, walk * 0.5);
            C.dog.pose(k, "Body", _m); C.dog.pose(k, "Leg_FL", _m, q3(s, 0, 0)); C.dog.pose(k, "Leg_BR", _m, q3(s, 0, 0));
            C.dog.pose(k, "Leg_FR", _m, q3(-s, 0, 0)); C.dog.pose(k, "Leg_BL", _m, q3(-s, 0, 0)); C.dog.pose(k, "Tail", _m, q3(0, Math.sin(p.t * 12) * 0.6, 0));
            p.dogPos = { x: dx + Math.sin(p.h) * 0.25, z: dz + Math.cos(p.h) * 0.25 };
            _v.set(0, -(HAND[p.look] || 0.47), 0).applyMatrix4(_arm);
            p.hand = { x: _v.x, y: _v.y, z: _v.z };
        }
    }
}
/** Pose a person rig like core/people.js's Person.update (same angles), from root matrix `root`. Leaves the right arm's matrix in _arm. */
function poseRig(rig, p, root, o, phase = p.phase, t = p.t) {
    if (!rig) return;
    const i = rig.add(p, p.colors);
    if (i < 0) return;
    const walk = o.walk || 0, swing = walk > 0.05 ? Math.min(0.75, 0.25 + walk * 0.22) : 0, s = Math.sin(phase);
    let legL = s * swing, legR = -s * swing, armL = -s * swing * 0.8, armR = s * swing * 0.8, armLz = 0.06, armRz = -0.06, bodyX = 0, bob = 0;
    if (walk > 0.05) bob = Math.abs(Math.cos(phase)) * 0.035 * Math.min(1, walk);
    bob += Math.sin(t * 2.2) * 0.015;
    if (o.sit) { legL = legR = -1.4; armL = armR = -0.5; }
    if (o.push) { armL = armR = -1.15; armLz = 0.12; armRz = -0.12; }
    if (o.kick) { legL = 0.1; legR = Math.sin(t * 5) > 0 ? 0.55 : -0.25; armL = armR = -1.0; swing && (bob = 0); }
    if (o.read) { armL = armR = -1.25; armLz = 0.32; armRz = -0.32; }
    if (o.scrub) { armR = -1.2 + Math.sin(t * 7) * 0.35; armRz = -0.2 + Math.cos(t * 7) * 0.2; armL = -0.4; bodyX = 0.12; }
    if (o.rake) { armL = armR = -0.75 + Math.sin(t * 2.6) * 0.35; bodyX = 0.15 + Math.sin(t * 2.6) * 0.08; armLz = 0.25; armRz = -0.05; }
    if (o.water) { armR = -0.9 + Math.sin(t * 0.7) * 0.15; armRz = -0.1 + Math.sin(t * 0.5) * 0.3; }
    if (o.bike) { armL = armR = -1.2; armLz = 0.18; armRz = -0.18; }
    if (o.cheer || p.hopT > 0) { armL = armR = -2.7 + Math.sin(t * 10) * 0.15; armLz = 0.25; armRz = -0.25; }
    if (o.wave) { armR = -2.6; armRz = -0.35 + Math.sin(t * 9) * 0.45; }
    if (o.point) { armR = -1.5; armRz = -0.05; }
    const talk = o.talk ? Math.abs(Math.sin(t * 12)) * 0.01 : 0;
    rig.pose(i, "Body", root, q3(bodyX + (o.talk ? Math.sin(t * 6) * 0.03 : 0), 0, 0), _dp.set(0, bob + talk + (o.sit ? -0.35 : 0), 0));
    const sdp = o.sit ? _v2.set(0, -0.35, 0) : null;
    rig.pose(i, "Arm_L", root, q3(armL, 0, armLz), sdp);
    const am = rig.pose(i, "Arm_R", root, q3(armR, 0, armRz), sdp);
    if (am) _arm.copy(am);
    rig.pose(i, "Leg_L", root, q3(legL, 0, 0)); rig.pose(i, "Leg_R", root, q3(legR, 0, 0));
    if (rig.parts._rest) rig.pose(i, "_rest", root);
}

// ── reactions ────────────────────────────────────────────────────────────
function notoriety() {
    let lv = 0;
    try { lv = ctx.memory && ctx.memory.notoriety ? ctx.memory.notoriety().level : 0; } catch (e) { lv = 0; }
    return lv + (C.burgled ? 1 : 0) + ((ctx.law && ctx.law.wanted) ? 1 : 0);
}
function react(p, dt, lp, foot, fast, cfx, cfz) {
    if (p.waveT > 0) p.waveT -= dt; if (p.talkT > 0) p.talkT -= dt; if (p.pointT > 0) p.pointT -= dt; if (p.hopT > 0) p.hopT -= dt;
    const dx = p.x - lp.x, dz = p.z - lp.z, d = Math.hypot(dx, dz);
    if (d > 30) return;
    // a speeding car coming at them: out of the way!
    if (fast && d < TUNE.SCATTER && (dx * cfx + dz * cfz) > -1.5) {
        if (p.kind === "walker" && !p.flee) {
            const side = (dx * -cfz + dz * cfx) >= 0 ? 1 : -1;
            p.flee = { vx: -cfz * side * 4.2 + cfx * 1.2, vz: cfx * side * 4.2 + cfz * 1.2, t: 0.75 };
            p.jumpT = 0.45;
            if (C.said <= 0) { C.said = 1.1; sayAt(p, pick(PED.scatter), 1.6, "angry"); emit("homes:scatter", { id: p.id }); emit("stat", { id: "homesScatters", n: 1 }); }
        } else if (p.kind === "porch" && p.jumpT <= 0 && d < 6) { p.jumpT = 0.45; p.lookAt = { x: lp.x, z: lp.z }; p.lookAtT = 2; p.pointT = 1.5; }
        return;
    }
    const slow = foot || ctx.car.speed < 6;
    if (!slow || C.said > 0 || p.kind === "bike") return;
    // the gossip: is that THE Lulu?
    if (!p.gossiped && d < 10 && notoriety() >= 1 && Math.random() < 0.02) {
        p.gossiped = true; C.said = 5;
        const line = pick(PED.gossip).replace("{fam}", C.burgled ? (/(s|z|x|sh|ch)$/i.test(C.burgled) ? C.burgled + "es" : C.burgled + "s") : "Goldbergs");
        p.lookAt = { x: lp.x, z: lp.z }; p.lookAtT = 3; p.pointT = 1.6;
        sayAt(p, line, 2.6, "nice");
        emit("homes:gossip", { line }); emit("stat", { id: "homesGossip", n: 1 });
        return;
    }
    // a porch she walks past: a family that knows her calls her name / waves her in (index.js → visits.js)
    if (foot && p.kind === "porch" && p.home && HOOKS.porch && d < 6.5 && ctx.time - p.waved > 20) {
        const line = HOOKS.porch(p, d);
        if (line) { p.waved = ctx.time; p.waveT = 2.2; p.lookAt = { x: lp.x, z: lp.z }; p.lookAtT = 2.5; C.said = 2.6; sayAt(p, line, 2.6, "nice"); emit("homes:wave", { id: p.id, porch: p.home.key }); return; }
    }
    // a wave as she passes
    if (d < 5.5 && ctx.time - p.waved > 30 && Math.random() < 0.05) {
        p.waved = ctx.time; p.waveT = 1.6; p.lookAt = { x: lp.x, z: lp.z }; p.lookAtT = 2; C.said = 2.2;
        if (Math.random() < 0.45) sayAt(p, pick(PED.wave), 1.8, "nice");
        emit("homes:wave", { id: p.id });
    }
}
/** She honked: the nearest folks react — a grown-up jumps and points (and yells, or a "Nu?!"), a kid waves back. */
export function crowdHonk() {
    if (!C.on || C.honkT > 0) return 0;
    C.honkT = 2.5;
    const lp = luluPos();
    const near = C.peds.filter(p => p.kind !== "bike" && Math.hypot(p.x - lp.x, p.z - lp.z) < 26).sort((a, b) => Math.hypot(a.x - lp.x, a.z - lp.z) - Math.hypot(b.x - lp.x, b.z - lp.z)).slice(0, 2);
    // (ci/life2: one reaction each instead of the same yell — a kid waves back, a grown-up is startled)
    for (const p of near) { p.lookAt = { x: lp.x, z: lp.z }; p.lookAtT = 2.5; if (p.look === "kid") { p.waveT = 1.8; p.jumpT = 0.3; } else { p.pointT = 1.8; p.jumpT = 0.4; } }
    if (near.length) {
        const p = near[0], kid = p.look === "kid";
        sayAt(p, pick(kid ? PED.honkKid : Math.random() < 0.35 ? PED.honkNu : PED.honk), 2.2, kid ? "nice" : "angry");
        emit("homes:honked", { n: near.length, kid });
    }
    return near.length;
}

// ── speech bubbles: pooled anchors that follow the speaker ───────────────
function sayAt(p, text, dur = 2.2, cls = "nice") {
    if (ctx.skipping) return;
    const a = C.anchors.find(x => x.t <= 0) || C.anchors[0];
    a.ped = p; a.t = dur;
    a.obj.position.set(p.x, (p.look === "kid" ? 1.3 : 1.85) + (p.kind === "bike" ? 0.45 : 0), p.z);
    a.obj.updateMatrixWorld(true);
    try {
        if (onFoot() && ctx.foot.say) ctx.foot.say(a.obj, text, dur);
        else if (ctx.banter && ctx.banter.bubble) ctx.banter.bubble(text, a.obj, { dur, cls });
    } catch (e) { /* no bubbles */ }
    p.talkT = Math.max(p.talkT, Math.min(dur, 1.6));
}
function tickAnchors(dt) {
    for (const a of C.anchors) if (a.t > 0) { a.t -= dt; if (a.ped) { a.obj.position.x = a.ped.x; a.obj.position.z = a.ped.z; a.obj.updateMatrixWorld(true); } }
}

// ── on foot: talk to anyone (a lemonade stand takes tzedakah) ──────────
let nearPed = null;
export const crowdTalkSpot = {
    r: 2.2, short: "TALK",
    pos() {
        nearPed = null;
        if (!C.on || !onFoot()) return null;
        const f = ctx.foot.pos;
        let bd = 2.3;
        for (const p of C.peds) {
            if (p.kind === "bike" || p.dist > TUNE.NEAR) continue;
            const d = Math.hypot(p.x - f.x, p.z - f.z);
            if (d < bd) { bd = d; nearPed = p; }
        }
        return nearPed ? { x: nearPed.x, z: nearPed.z } : null;
    },
    label() { return !nearPed ? null : nearPed.lemonade ? "🍋 BUY LEMONADE (1 💰)" : "💬 SAY HI"; },
    act() {
        const p = nearPed;
        if (!p) return;
        p.lookAt = { x: ctx.foot.pos.x, z: ctx.foot.pos.z }; p.lookAtT = 3;
        if (p.lemonade) {
            if (wallet.spend(1)) { sayAt(p, "THANK you!! It's for TZEDAKAH! 🍋", 2.4); H.toast("🍋 Lemonade! (tzedakah, −1 💰)", "gold"); emit("stat", { id: "homesLemonade", n: 1 }); }
            else sayAt(p, "...you can pay me LATER. My Abba says that's a LOAN.", 2.4);
            return;
        }
        const pool = p.read ? PED.reader : p.scrub ? PED.washer : p.yard === "rake" ? PED.rake : p.yard === "shovel" ? PED.shovel : p.water ? PED.hose : p.ball ? PED.kids : p.type === "mail" ? PED.mail : PED.talk;
        sayAt(p, pick(pool), 2.8);
        p.waveT = 1;
        emit("homes:talk", { type: p.type });
        emit("stat", { id: "homesChats", n: 1 });
    },
};

// ── ambient sound: kids playing, a distant ice-cream truck ──────────────
let defined = false;
function defineSounds() {
    if (defined || !A.spatial || !A.spatial.define) return;
    defined = true;
    // a playground bed: high little voice-ish chirps (formant-swept squares) + a ball's bounce, 3.2 s loop
    A.spatial.define("homesKids", { loop: true, ref: 6, max: 70, gain: 0.22, prio: 1, lift: 1.2, gen(sr) {
        const n = Math.round(3.2 * sr), b = new Float32Array(n);
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        for (let k = 0; k < 9; k++) {
            const t0 = rnd() * 2.9, dur = 0.12 + rnd() * 0.35, f0 = 380 + rnd() * 320, f1 = f0 * (0.8 + rnd() * 0.7);
            const i0 = Math.floor(t0 * sr), m = Math.floor(dur * sr);
            let ph = 0;
            for (let i = 0; i < m && i0 + i < n; i++) {
                const u = i / m, f = f0 + (f1 - f0) * u, env = Math.sin(u * Math.PI) * (0.6 + 0.4 * Math.sin(u * 40));
                ph += 2 * Math.PI * f / sr;
                b[i0 + i] += (Math.sin(ph) * 0.6 + Math.sin(ph * 2.02) * 0.25 + Math.sin(ph * 3.1) * 0.12) * env * 0.5;
            }
        }
        for (const tb of [0.4, 1.7, 2.6]) { const i0 = Math.floor(tb * sr); for (let i = 0; i < sr * 0.08 && i0 + i < n; i++) b[i0 + i] += Math.sin(i / sr * 2 * Math.PI * 110) * Math.exp(-i / sr * 40) * 0.7; }
        for (let i = 0; i < 400; i++) { b[i] *= i / 400; b[n - 1 - i] *= i / 400; }
        return b;
    } });
}
function tickSound(dt, lp, night, wet) {
    if (!A.spatial || !A.spatial.ready || !ctx.enabled("homes")) return;
    defineSounds();
    // the kids on the nearest lawn
    let best = null, bd = 60;
    if (night < 0.5 && !wet) for (const k of C.kids || []) { const d = Math.hypot(k.x - lp.x, k.z - lp.z); if (d < bd) { bd = d; best = k; } }
    if (best) {
        if (!C.kidsAnchor) { C.kidsAnchor = new THREE.Object3D(); C.group.add(C.kidsAnchor); }
        C.kidsAnchor.position.set(best.x, 1, best.z);
        if (!C.kidsLoop || !C.kidsLoop.alive) C.kidsLoop = A.spatial.loop("homesKids", C.kidsAnchor, { gain: 0.9 });
    } else if (C.kidsLoop) { try { C.kidsLoop.stop(); } catch (e) { /* gone */ } C.kidsLoop = null; }
    // now and then, a distant ice-cream truck (somewhere 70–110 m off)
    C.jingleT -= dt;
    if (C.jingleT <= 0) {
        C.jingleT = 45 + Math.random() * 40;
        if (night < 0.5 && !wet && A.spatial.has && A.spatial.has("jingle")) {
            const a = Math.random() * Math.PI * 2, r = 70 + Math.random() * 40;
            A.spatial.play("jingle", { x: lp.x + Math.cos(a) * r, y: 1.5, z: lp.z + Math.sin(a) * r }, { gain: 0.55 });
            emit("homes:jingle", {});
        }
    }
}

/** Debug / tests: counts and the render footprint. */
export function crowdInfo() {
    const rigs = {};
    let tris = 0;
    for (const [k, r] of Object.entries(C.rigs)) { rigs[k] = r.n; tris += r.tris * r.n; }
    return { on: C.on, peds: C.peds.length, walkers: C.peds.filter(p => p.kind === "walker").length, porch: C.peds.filter(p => p.kind === "porch").length,
        bikes: C.peds.filter(p => p.kind === "bike").length, dogs: C.peds.filter(p => p.type === "dog").length, strollers: C.peds.filter(p => p.type === "stroller").length,
        near: C.stats.near, far: C.stats.far, hidden: C.stats.hidden, ms: +C.stats.ms.toFixed(3), rigs, nearTris: Math.round(tris), types: [...new Set(C.peds.map(p => p.type))],
        ...crowdDraw() };
}
/** What the crowd itself puts on the GPU this frame: { calls, tris } (every drawn instanced rig part / the LOD figures /
 *  blobs / leashes / porch lights — independent of the town's own cars driving in and out of view). */
function crowdDraw() {
    let calls = 0, tris = 0;
    if (C.group) C.group.traverse(o => {
        if (!o.visible) return;
        if (o.isInstancedMesh) { if (o.count > 0) { calls++; const g = o.geometry; tris += ((g.index ? g.index.count : g.attributes.position.count) / 3) * o.count; } }
        else if (o.isMesh || o.isPoints || o.isLineSegments) calls++;
    });
    return { calls, tris: Math.round(tris) };
}
