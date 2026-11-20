// features/seasons — PEOPLE OF THE DAY: small groups of townsfolk doing what the day is for.
//
//   🌿 Sukkos      men + boys walking to and from shul with a lulav (right hand) and an esrog (left) — never on Shabbos
//   🕊️ Yom Kippur  families in white walking slowly to shul, a machzor in hand (quiet: no sound, no stall, no jokes)
//   📖 Tashlich    Rosh Hashana afternoon: a group standing at the water's edge with their siddurim (not on Shabbos)
//   📜 Simchas Torah  men + boys dancing in a ring round a Torah in front of the shul, kids waving their flags
//   🎭 Purim       costumed bochurim with a pushke at a few front doors (collecting tzedakah)
//   🔥 erev Pesach a firefighter beside the chametz-burning barrel, neighbours bringing their last bag of bread
//
// Cheap like the parade: homes' instanced rigs (features/homes/rig.js — ~5 draw calls per body type for everyone),
// one instanced mesh per held prop, a group is only drawn within ~110 m of the camera. Every position is a pure
// function of the place (+ time for the walkers and dancers) — the same on every screen of a 🎉 party (the animation
// clock is each screen's own, like the parade's).
//
// groupsAdd(key, specs) / groupsDrop(key) — a set of groups (the town's, a road chunk's). A spec:
//   { mode: "walk", route: {x, z, ux, uz, len, speed, phase}, members: [M…] }       there and back along a sidewalk
//   { mode: "stand", members: [M + {x, z, face}] }                                 standing (facing `face`)
//   { mode: "ring", center: {x, z}, radius, spin, members: [M…], middle: M + {x, z} } dancing round, one in the middle
//   M = { look: "man" | "woman" | "kid", top, bot, hair (hex), R: prop in the right hand, L: left hand, chest: held to
//         the chest, hat: on the head, pose: "hold" | "book" | "wave" | "dance" | "torah" | "idle" }
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models, ensureModels } from "../../models.js";
import { Rig, crowdMaterial } from "../homes/rig.js";
import { propNode } from "./dress.js";

const PERSON = ["Body", "Arm_L", "Arm_R", "Leg_L", "Leg_R"];
const LOOKS = { man: "npcMan", woman: "npcWoman", kid: "npcKid" };
export const GROUP_MODELS = Object.values(LOOKS);
const HAND = { man: 0.47, woman: 0.45, kid: 0.34 };
const MAXR = { man: 26, woman: 14, kid: 18 };
const R_DRAW = 110;

const G = { group: null, rigs: {}, props: {}, sets: new Map(), hatY: {}, loading: false, t: 0, stats: { people: 0, drawn: 0, calls: 0 } };
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _a = new THREE.Matrix4(), _l = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _dp = new THREE.Vector3();
const q3 = (x, y, z) => _q.setFromEuler(_e.set(x, y, z, "XYZ"));
const col = h => new THREE.Color(h);

function build() {
    if (G.group) return true;
    if (!GROUP_MODELS.every(k => models[k]) || !models.seasonsProps) return false;
    G.group = new THREE.Group(); G.group.name = "SeasonsGroups";
    ctx.scene.add(G.group);
    for (const [k, key] of Object.entries(LOOKS)) {
        G.rigs[k] = new Rig(models[key], PERSON, MAXR[k], { name: "seasons-" + k });
        G.group.add(G.rigs[k].group);
        G.hatY[k] = new THREE.Box3().setFromObject(models[key]).max.y;
    }
    return true;
}
function prop(name) {
    if (G.props[name]) return G.props[name];
    const node = propNode(name);
    if (!node) return null;
    const r = new Rig(node, [], 24, { name: "seasons-prop-" + name });
    G.group.add(r.group);
    return (G.props[name] = r);
}
/** Load what the groups need (the townsfolk models). */
export function groupsLoad() {
    if (GROUP_MODELS.every(k => models[k])) return Promise.resolve(true);
    return ensureModels(GROUP_MODELS).then(() => true);
}

export function groupsAdd(key, specs, opts = {}) {
    groupsDrop(key);
    if (!specs || !specs.length) return;
    const set = { key, specs: specs.map(s => Object.assign({}, s)), vis: opts.vis || null };
    for (const s of set.specs) {
        s.members = (s.members || []).map((m, i) => Object.assign({ i, ph: (i * 1.37 + (s.route ? s.route.phase || 0 : 0)) % 6.28, colors: { top: col(m.top || "#FFFFFF"), bot: col(m.bot || "#212121"), hair: col(m.hair || "#3E2723") } }, m));
        if (s.middle) s.middle = Object.assign({ ph: 0, colors: { top: col(s.middle.top || "#FFFFFF"), bot: col(s.middle.bot || "#212121"), hair: col(s.middle.hair || "#3E2723") } }, s.middle);
        // its anchor (for the draw distance)
        s.ax = s.route ? s.route.x : s.center ? s.center.x : s.members.length ? s.members[0].x : 0;
        s.az = s.route ? s.route.z : s.center ? s.center.z : s.members.length ? s.members[0].z : 0;
    }
    G.sets.set(key, set);
}
export function groupsDrop(key) { G.sets.delete(key); }
export function groupsClear() { G.sets.clear(); }
export function groupsDispose() {
    G.sets.clear();
    for (const r of Object.values(G.rigs)) r.dispose();
    for (const r of Object.values(G.props)) r.dispose();
    if (G.group && G.group.parent) G.group.parent.remove(G.group);
    Object.assign(G, { group: null, rigs: {}, props: {} });
}
export const groupsInfo = () => ({ sets: [...G.sets.keys()], groups: [...G.sets.values()].reduce((a, s) => a + s.specs.length, 0), people: G.stats.people, drawn: G.stats.drawn, calls: G.stats.calls,
    modes: [...G.sets.values()].flatMap(s => s.specs.map(x => x.mode + ":" + (x.tag || ""))) });
export const groupsList = () => [...G.sets.values()].flatMap(set => set.specs.map(s => ({ set: set.key, mode: s.mode, tag: s.tag || "", x: s.px != null ? s.px : s.ax, z: s.pz != null ? s.pz : s.az,
    members: s.members.map(m => ({ look: m.look, R: m.R || null, L: m.L || null, chest: m.chest || null, hat: m.hat || null, top: m.top || null, pose: m.pose || null })), middle: s.middle ? { chest: s.middle.chest || null } : null })));

/** Pose one person (+ what they hold) at root matrix `root`. */
function person(m, root, t, walk) {
    const rig = G.rigs[m.look];
    if (!rig) return;
    const i = rig.add(m, m.colors);
    if (i < 0) return;
    const ph = t * (walk ? 5.2 : 0) + m.ph, s = Math.sin(ph), sw = walk ? 0.5 : 0;
    let legL = s * sw, legR = -s * sw, armL = -s * sw * 0.8, armR = s * sw * 0.8, armLz = 0.08, armRz = -0.08, bob = walk ? Math.abs(Math.cos(ph)) * 0.035 : Math.sin(t * 1.6 + m.ph) * 0.008;
    const pose = m.pose || (m.chest ? "torah" : m.R || m.L ? "hold" : "idle");
    if (pose === "hold") { if (m.R) armR = -0.55 + s * 0.08; if (m.L) armL = -0.55 - s * 0.08; }
    else if (pose === "book") { armR = -1.05; armL = -0.95; armRz = -0.25; armLz = 0.3; }
    else if (pose === "wave") { armR = -2.5 + Math.sin(t * 6 + m.ph) * 0.45; armRz = -0.3; }
    else if (pose === "dance") {
        const k = t * 7 + m.ph;
        legL = Math.sin(k) * 0.55; legR = -Math.sin(k) * 0.55; bob = Math.abs(Math.sin(k)) * 0.12;
        armL = armR = -2.55 + Math.sin(k * 0.5) * 0.25; armLz = 0.45; armRz = -0.45;
    } else if (pose === "torah") { armR = armL = -1.2; armRz = -0.35; armLz = 0.35; bob = Math.sin(t * 3) * 0.03; }
    rig.pose(i, "Body", root, null, _dp.set(0, bob, 0));
    const aL = rig.pose(i, "Arm_L", root, q3(armL, 0, armLz)); if (aL) _l.copy(aL);
    const aR = rig.pose(i, "Arm_R", root, q3(armR, 0, armRz)); if (aR) _a.copy(aR);
    rig.pose(i, "Leg_L", root, q3(legL, 0, 0)); rig.pose(i, "Leg_R", root, q3(legR, 0, 0));
    if (rig.parts._rest) rig.pose(i, "_rest", root);
    const hand = HAND[m.look] || 0.45;
    const held = (name, arm) => { const r = prop(name); if (!r) return; const k = r.add(m, null); if (k < 0) return; _m.compose(_v.set(0, -hand, 0.04), _q.identity(), _s.set(1, 1, 1)); r.pose(k, "_rest", _m.premultiply(arm)); };
    if (m.R && aR) held(m.R, _a);
    if (m.L && aL) held(m.L, _l);
    if (m.chest) { const r = prop(m.chest); if (r) { const k = r.add(m, null); if (k >= 0) { _m.compose(_v.set(0, (m.look === "kid" ? 0.85 : 1.18) + bob, 0.24), _q.identity(), _s.set(1, 1, 1)); r.pose(k, "_rest", _m.premultiply(root)); } } }
    if (m.hat) { const r = prop(m.hat); if (r) { const k = r.add(m, null); if (k >= 0) { _m.compose(_v.set(0, (G.hatY[m.look] || 1.7) - 0.03 + bob, 0), _q.identity(), _s.set(1, 1, 1)); r.pose(k, "_rest", _m.premultiply(root)); } } }
}
const at = (x, z, rot) => _r.compose(_v.set(x, 0, z), q3(0, rot, 0), _s.set(1, 1, 1));

/** Every frame (seasons/index.js). */
export function groupsTick(dt, cam) {
    if (!G.sets.size) { if (G.group) { for (const r of Object.values(G.rigs)) { r.begin(); r.end(); } for (const r of Object.values(G.props)) { r.begin(); r.end(); } } return; }
    if (!build()) {
        if (!G.loading) { G.loading = true; groupsLoad().then(() => { G.loading = false; }).catch(() => { G.loading = false; }); }
        return;
    }
    G.t += dt;
    const t = G.t;
    for (const r of Object.values(G.rigs)) r.begin();
    for (const r of Object.values(G.props)) r.begin();
    let people = 0, drawn = 0;
    for (const set of G.sets.values()) {
        const vis = !set.vis || set.vis();
        for (const s of set.specs) {
            people += s.members.length + (s.middle ? 1 : 0);
            if (!vis || Math.hypot(s.ax - cam.x, s.az - cam.z) > R_DRAW) continue;
            drawn += s.members.length + (s.middle ? 1 : 0);
            if (s.mode === "walk") {
                // there and back along the route at walking pace, the members in a little cluster
                const R = s.route, L = R.len, sp = R.speed || 1.1, period = 2 * L / sp;
                const k = (((t + (R.phase || 0) * period) % period) + period) % period * sp;
                const a = k < L ? k - L / 2 : L / 2 - (k - L), dir = k < L ? 1 : -1;
                const rot = Math.atan2(R.ux * dir, R.uz * dir);
                s.members.forEach((m, j) => {
                    const back = (j % 2 ? 0.9 : 0) + Math.floor(j / 2) * 1.2, side = (j % 2 ? 0.45 : -0.45);
                    const aa = Math.max(-L / 2, Math.min(L / 2, a - dir * back));
                    const px = R.x + R.ux * aa + R.nx * side, pz = R.z + R.uz * aa + R.nz * side;
                    if (!j) { s.px = px; s.pz = pz; }
                    person(m, at(px, pz, rot), t, true);
                });
            } else if (s.mode === "stand") {
                for (const m of s.members) person(m, at(m.x, m.z, m.face || 0), t, false);
            } else if (s.mode === "ring") {
                const n = s.members.length, w = s.spin || 0.45;
                s.members.forEach((m, j) => {
                    const a = j / n * Math.PI * 2 + t * w, x = s.center.x + Math.cos(a) * s.radius, z = s.center.z + Math.sin(a) * s.radius;
                    // facing along the circle (they dance round, hands up)
                    person(Object.assign(m, { pose: m.pose || "dance" }), at(x, z, Math.atan2(-Math.sin(a), Math.cos(a)) * (w >= 0 ? 1 : -1)), t, false);
                });
                if (s.middle) person(s.middle, at(s.middle.x, s.middle.z, t * 0.4), t, false);
            }
        }
    }
    let calls = 0;
    for (const r of Object.values(G.rigs)) { r.end(); if (r.n) calls += r.list.length; }
    for (const r of Object.values(G.props)) { r.end(); if (r.n) calls += r.list.length; }
    Object.assign(G.stats, { people, drawn, calls });
}
