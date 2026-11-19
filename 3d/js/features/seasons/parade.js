// features/seasons — 🎭 THE PURIM COSTUME PARADE: a dozen townsfolk in costume (crowns, Haman's three-cornered hat,
// clown wigs, fire helmets, a chef, a kid dressed as a walking hamantash) marching up and down the sidewalk of the
// town's main street behind a "FREILICHEN PURIM!" banner, cheering and spinning groggers you hear as you pass.
//
// Cheap: the marchers are homes' instanced rigs (features/homes/rig.js — ~5 draw calls per body type for all of
// them), the hats one more instanced mesh per hat, the banner a dress.js item. The route is a straight stretch of
// sidewalk through the town's landmark spot (ctx.town.spot), there and back: the same on every friend's screen in a
// 🎉 party (its timing is a function of the town clock + nothing random; the colours are hashes of the marcher).
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, ensureModels } from "../../models.js";
import * as A from "../../audio.js";
import { Rig, crowdMaterial } from "../homes/rig.js";
import { baked, addSet, dropSet, D } from "./dress.js";
import { COSTUMES, PARADE } from "./data.js";
import { h01 } from "./places.js";

const PERSON = ["Body", "Arm_L", "Arm_R", "Leg_L", "Leg_R"];
const LOOKS = { man: "npcMan", woman: "npcWoman", kid: "npcKid" };
const TOPS = ["#E53935", "#8E24AA", "#1E88E5", "#43A047", "#FDD835", "#FB8C00", "#00ACC1", "#F06292"];
const P = { on: false, group: null, rigs: {}, hats: {}, marchers: [], route: null, t: 0, hatY: {}, grogT: 2, voice: false, ready: false };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _dp = new THREE.Vector3();
const q3 = (x, y, z) => _q.setFromEuler(_e.set(x, y, z, "XYZ"));

/** Start the parade in the town she's in (Purim). */
export function paradeStart(day) {
    paradeStop();
    const T = ctx.town;
    if (!T || !T.active || !T.spot) return false;
    const sp = T.spot("pizza") || T.spot("bakery") || T.spot("hall") || T.spot("shul");
    if (!sp) return false;
    // the sidewalk's middle (spot = its inner edge; n points to the street)
    const mid = { x: sp.x + sp.nx * 1.4, z: sp.z + sp.nz * 1.4 };
    P.route = { x: mid.x, z: mid.z, ux: sp.ux, uz: sp.uz, nx: sp.nx, nz: sp.nz, len: 70 };
    P.on = true; P.ready = false; P.t = 0; P.town = T.id;
    const id = T.id;
    ensureModels(Object.values(LOOKS)).then(() => {
        if (!P.on || !ctx.town || ctx.town.id !== id) return;
        build();
    }).catch(e => console.warn("[seasons] parade models", e));
    return true;
}
function build() {
    P.group = new THREE.Group(); P.group.name = "SeasonsParade";
    ctx.scene.add(P.group);
    for (const [k, key] of Object.entries(LOOKS)) {
        if (!models[key]) continue;
        P.rigs[k] = new Rig(models[key], PERSON, PARADE.marchers, { name: "parade-" + k });
        P.group.add(P.rigs[k].group);
        const box = new THREE.Box3().setFromObject(models[key]);
        P.hatY[k] = box.max.y - (models[key].position ? models[key].position.y : 0);
    }
    for (const name of [...new Set(COSTUMES), "Hamantash"]) {
        const b = baked(name);
        if (!b || !b.geo) continue;
        const im = new THREE.InstancedMesh(b.geo, crowdMaterial(), PARADE.marchers);
        // (the crowd material swaps colours by a vertex "slot" — our hats have none, so give them the attributes it reads)
        for (const nm of ["slot"]) if (!b.geo.attributes[nm]) b.geo.setAttribute(nm, new THREE.BufferAttribute(new Float32Array(b.geo.attributes.position.count), 1));
        for (const nm of ["iTop", "iBot", "iHair"]) if (!b.geo.attributes[nm]) b.geo.setAttribute(nm, new THREE.InstancedBufferAttribute(new Float32Array(PARADE.marchers * 3), 3));
        im.frustumCulled = false; im.count = 0; im.castShadow = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.name = "SeasonsHat:" + name;
        P.group.add(im);
        P.hats[name] = im;
    }
    // the marchers: two banner carriers up front, then costumes, a walking hamantash among the kids
    P.marchers = [];
    for (let i = 0; i < PARADE.marchers; i++) {
        const r = h01(P.town, "m", i);
        const look = i < 2 ? "man" : r < 0.4 ? "kid" : r < 0.72 ? "woman" : "man";
        const hat = i < 2 ? null : look === "kid" && h01(P.town, "hm", i) < 0.3 ? "Hamantash" : COSTUMES[Math.floor(h01(P.town, "c", i) * COSTUMES.length)];
        const c = n => new THREE.Color(TOPS[Math.floor(h01(P.town, n, i) * TOPS.length)]);
        P.marchers.push({ i, look, hat, colors: { top: c("t"), bot: new THREE.Color(look === "woman" ? "#263238" : "#212121"), hair: new THREE.Color(look === "woman" ? "#5D4037" : "#3E2723") },
            gap: i < 2 ? 0 : 3.2 + (i - 2) * 1.55, side: i < 2 ? (i === 0 ? -1.2 : 1.2) : ((i % 2) ? 0.55 : -0.55), phase: h01(P.town, "p", i) * 6, cheer: h01(P.town, "ch", i) });
    }
    // the banner rides between the first two
    addSet("parade", [{ kind: "banner", x: P.route.x, y: 0, z: P.route.z, rot: 0, sign: { lines: ["FREILICHEN PURIM!"], bg: "#6A1B9A", fg: "#FFF3C4" } }]);
    P.ready = true;
    try {
        if (A.spatial && A.spatial.define && !(A.spatial.has && A.spatial.has("seasonsGrogger"))) A.spatial.define("seasonsGrogger", { gen: grogBuffer, ref: 6, gain: 0.5, max: 2 });
        P.voice = true;
    } catch (e) { P.voice = false; }
}
// a wooden ratchet: square-wave clicks
function grogBuffer(sr) {
    const n = Math.floor(sr * 0.5), out = new Float32Array(n);
    for (let k = 0; k < 11; k++) {
        const t0 = Math.floor(k * 0.045 * sr), len = Math.floor(0.03 * sr), f = 150 + (k % 2) * 45;
        for (let i = 0; i < len && t0 + i < n; i++) out[t0 + i] = (Math.sin(2 * Math.PI * f * i / sr) > 0 ? 1 : -1) * Math.exp(-i / (len * 0.35)) * 0.5;
    }
    return out;
}
export function paradeStop() {
    P.on = false; P.ready = false;
    for (const r of Object.values(P.rigs)) r.dispose();
    for (const im of Object.values(P.hats)) { if (im.parent) im.parent.remove(im); im.dispose(); }
    if (P.group && P.group.parent) P.group.parent.remove(P.group);
    P.rigs = {}; P.hats = {}; P.group = null; P.marchers = [];
    dropSet("parade");
}

/** Where along the route the head of the parade is: there and back at walking pace (a pure f(town clock)). */
function headAt(t) {
    const L = P.route.len, period = (2 * L) / PARADE.speed, k = ((t % period) + period) % period * PARADE.speed;
    return k < L ? { a: k - L / 2, dir: 1 } : { a: L / 2 - (k - L), dir: -1 };
}
export function paradeTick(dt) {
    if (!P.on || !P.ready) return;
    P.t += dt;
    const R = P.route, head = headAt(P.t);
    for (const r of Object.values(P.rigs)) r.begin();
    const hatN = {};
    for (const k of Object.keys(P.hats)) hatN[k] = 0;
    const bx = { x: 0, z: 0, n: 0 };
    let near = 1e9, nearP = null;
    for (const m of P.marchers) {
        const a = Math.max(-R.len / 2, Math.min(R.len / 2, head.a - head.dir * m.gap));
        const x = R.x + R.ux * a + R.nx * m.side * 0.9, z = R.z + R.uz * a + R.nz * m.side * 0.9;
        const rot = Math.atan2(R.ux * head.dir, R.uz * head.dir);
        const ph = P.t * 5.2 + m.phase, bob = Math.abs(Math.cos(ph)) * 0.04;
        _m.compose(_v.set(x, bob, z), q3(0, rot, 0), _s.set(1, 1, 1));
        if (m.i < 2) { bx.x += x; bx.z += z; bx.n++; }
        const d = ctx.camera ? Math.hypot(ctx.camera.position.x - x, ctx.camera.position.z - z) : 0;
        if (d < near) { near = d; nearP = { x, y: 1.4, z }; }
        if (m.hat === "Hamantash") {
            const im = P.hats.Hamantash;
            if (im) { _m.compose(_v.set(x, bob * 2, z), q3(0, rot, Math.sin(ph) * 0.06), _s.set(1, 1, 1)); im.setMatrixAt(hatN.Hamantash++, _m); }
            continue;
        }
        const rig = P.rigs[m.look];
        if (!rig) continue;
        const i = rig.add(m, m.colors);
        if (i < 0) continue;
        const s = Math.sin(ph), sw = 0.55;
        const cheer = m.cheer > 0.55 && Math.sin(P.t * 1.3 + m.phase) > 0.4;
        const carry = m.i < 2;
        rig.pose(i, "Body", _m, null, _dp.set(0, 0, 0));
        rig.pose(i, "Arm_L", _m, q3(carry ? -2.6 : cheer ? -2.7 + Math.sin(P.t * 10) * 0.15 : -s * sw * 0.8, 0, 0.12));
        rig.pose(i, "Arm_R", _m, q3(carry ? -2.6 : cheer ? -2.2 + Math.sin(P.t * 14) * 0.4 : s * sw * 0.8, 0, -0.12));
        rig.pose(i, "Leg_L", _m, q3(s * sw, 0, 0)); rig.pose(i, "Leg_R", _m, q3(-s * sw, 0, 0));
        if (rig.parts._rest) rig.pose(i, "_rest", _m);
        if (m.hat && P.hats[m.hat]) {
            _m.compose(_v.set(x, bob + (P.hatY[m.look] || 1.7) - 0.03, z), q3(0, rot, 0), _s.set(1, 1, 1));
            P.hats[m.hat].setMatrixAt(hatN[m.hat]++, _m);
        }
    }
    for (const r of Object.values(P.rigs)) r.end();
    for (const [k, im] of Object.entries(P.hats)) { im.count = hatN[k]; im.visible = hatN[k] > 0; if (hatN[k]) im.instanceMatrix.needsUpdate = true; }
    // the banner between the two carriers
    if (bx.n) {
        const set = D.sets.get("parade"), rot = Math.atan2(R.ux * head.dir, R.uz * head.dir);
        if (set) for (const it of set.items) { it.x = bx.x / bx.n; it.z = bx.z / bx.n; it.rot = rot; }
        if (set) for (const s of set.signs) { s.position.x = bx.x / bx.n + Math.sin(rot) * 0.03; s.position.z = bx.z / bx.n + Math.cos(rot) * 0.03; s.rotation.y = rot; }
    }
    // the groggers: a ratchet now and then, from the marcher nearest the camera
    if ((P.grogT -= dt) <= 0) {
        P.grogT = PARADE.groggerEvery * (0.7 + 0.6 * ((P.t * 7.3) % 1));
        if (P.voice && nearP && near < 45 && A.spatial && A.spatial.ready && !ctx.skipping) { try { A.spatial.play("seasonsGrogger", nearP, { gain: 0.7 }); } catch (e) { /* no voice */ } }
    }
}
export const paradeInfo = () => ({ on: P.on, ready: P.ready, marchers: P.marchers.length, hats: Object.fromEntries(Object.entries(P.hats).map(([k, im]) => [k, im.count])), t: +P.t.toFixed(1) });
