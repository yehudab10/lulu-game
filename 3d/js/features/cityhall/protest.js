// features/cityhall/protest.js — 🪧 PROTESTS ABOUT ABSURD LOCAL ISSUES (stage 4). During a town's protest hours
// (PROTEST_HOURS, the device clock), a small picket line walks a loop on the sidewalk in front of the topic's spot (city
// hall, or the pizza shop for the sauce): ~9 neighbours on homes' instanced rigs (~5 draw calls per body type), each with a
// hand-written sign (one InstancedMesh per slogan + one for the sticks), a chant passed down the line in bubbles. The topic
// follows the real day (PROTESTS); if she got the loud-honk surcharge today, the protest is about HER honking.
//   ✋ 🪧 THE PROTEST: 🪧 join in → a short rhythm chant (foot's script: press ✕ when each word lights up; 4 beats) → the
//   crowd's verdict · 📢 what's it about? · 🚶‍♀️ walk on. Honking near it: "HONK IF YOU AGREE!" — the crowd cheers.
// Local + cosmetic (each screen its own; nothing pays, nothing is remembered but a stat). Never real-world politics.
import * as THREE from "three";
import { ctx, on, emit, css } from "../../core/ctx.js";
import { choose, say } from "../../core/dialog.js";
import { models, ensureModels } from "../../models.js";
import { Rig, crowdMaterial } from "../homes/rig.js";
import * as H from "../../hud.js";
import { ID, PROTESTS, PROTEST_HONK, PROTEST_HOURS, PROTEST_LINES as PL, PROTEST_TUNE as K } from "./data.js";
import { S, saveSoon, inTown, townId, stat, hour, force } from "./state.js";
import { signTexture } from "./rooms.js";

const PERSON = ["Body", "Arm_L", "Arm_R", "Leg_L", "Leg_R"];
const LOOKS = { man: "npcMan", woman: "npcWoman" };
const TOPS = ["#E53935", "#8E24AA", "#1E88E5", "#43A047", "#FDD835", "#FB8C00", "#00ACC1", "#F06292", "#6D4C41"];
const pick = a => a[Math.floor(Math.random() * a.length)];
const h01 = (s, i) => { let h = 2166136261; const str = s + ":" + i; for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
css("cityhall-chant", `
.ch-chant { position: fixed; left: 50%; bottom: 22%; transform: translateX(-50%); display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
  max-width: 92vw; pointer-events: none; z-index: 30; }
.ch-chant span { background: rgba(43,27,46,.72); color: #FFE082; border-radius: 999px; padding: 6px 14px; font: 700 18px var(--font); opacity: .55;
  transition: transform .12s, opacity .12s, background .12s; }
.ch-chant span.on { opacity: 1; transform: scale(1.18); background: #E91E63; color: #fff; }
.ch-chant span.hit { background: #43A047; color: #fff; opacity: 1; }
`);
export const PR = { on: null, log: [], said: false, honkT: 0 };
function log(ev, d = {}) { PR.log.push(Object.assign({ ev }, d)); if (PR.log.length > 40) PR.log.shift(); }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _dp = new THREE.Vector3();
const q3 = (x, y, z) => _q.setFromEuler(_e.set(x, y, z, "XYZ"));
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos) || null;
const bubble = (m, text, sec = 2.2) => { try { if (ctx.foot && ctx.foot.say && !ctx.skipping && m && m.anchor) ctx.foot.say(m.anchor, text, sec); } catch (e) { /* none */ } };

/** Is it protest time in this town right now? */
export function protestHours(town = townId()) {
    if (force.protest != null) return !!force.protest;
    const h = hour();
    return (PROTEST_HOURS[town] || []).some(([a, b]) => h >= a && h < b);
}
/** Today's topic in this town (the real day; her honking takes over the day she got the surcharge). */
export function topicToday(town = townId()) {
    if (force.topic) return force.topic === "honk" ? PROTEST_HONK : PROTESTS.find(p => p.id === force.topic) || PROTESTS[0];
    const fees = S.fees || {};
    const d = new Date(), day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (fees.day === day && fees.kinds && fees.kinds.honk) return PROTEST_HONK;
    const n = Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000) + (town === "midwood" ? 2 : 0);
    return PROTESTS[n % PROTESTS.length];
}

/** Start the protest in the town she's in (tests: force). → bool */
export function protestStart() {
    protestStop();
    const T = ctx.town;
    if (!T || !T.active || !T.spot) return false;
    const topic = topicToday();
    const sp = (topic.at && T.spot(topic.at)) || T.spot("cityhall");
    if (!sp || sp.nx == null) return false;
    // the loop: two lines along the sidewalk's middle, LEN m long, GAP apart (n points to the street)
    const mid = { x: sp.x + sp.nx * 1.3 - sp.ux * 6, z: sp.z + sp.nz * 1.3 - sp.uz * 6 };      // (the other side of the door from the paving crew)
    const W = PR.on = { topic, town: T.id, x: mid.x, z: mid.z, ux: sp.ux, uz: sp.uz, nx: sp.nx, nz: sp.nz, len: 7, gap: 1.3, t: 0, ready: false,
        group: null, rigs: {}, signs: [], sticks: null, marchers: [], chantI: 0, chantT: 1.5, cheerT: 0, rm: null, joined: false };
    const id = T.id;
    ensureModels(Object.values(LOOKS)).then(() => { if (PR.on === W && ctx.town && ctx.town.id === id) build(W); }).catch(e => console.warn("[cityhall] protest models", e));
    if (ctx.foot && ctx.foot.addSpot) W.rm = ctx.foot.addSpot(spot);
    emit("cityhall:protest", { phase: "start", topic: topic.id, town: T.id });
    log("start", { topic: topic.id });
    return true;
}
function build(W) {
    W.group = new THREE.Group(); W.group.name = "CityhallProtest";
    ctx.scene.add(W.group);
    for (const [k, key] of Object.entries(LOOKS)) {
        if (!models[key]) continue;
        W.rigs[k] = new Rig(models[key], PERSON, K.marchers, { name: "protest-" + k });
        W.group.add(W.rigs[k].group);
    }
    // the signs: one InstancedMesh per slogan (its own canvas) + one for the sticks
    const board = new THREE.BoxGeometry(0.9, 0.6, 0.03);
    W.ownGeo = [board];
    W.ownMat = [];
    W.topic.signs.forEach((txt, i) => {
        const tex = signTexture([txt], 0.9, 0.6, { bg: ["#FFFDE7", "#FFFFFF", "#FFF3E0"][i % 3], fg: ["#C62828", "#1A237E", "#1B5E20"][i % 3], font: 76 });
        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
        W.ownMat.push(mat, tex);
        const im = new THREE.InstancedMesh(board, mat, K.marchers);
        im.count = 0; im.frustumCulled = false; im.castShadow = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        W.group.add(im); W.signs.push(im);
    });
    const stick = new THREE.BoxGeometry(0.04, 0.9, 0.04); W.ownGeo.push(stick);
    const sm = new THREE.MeshStandardMaterial({ color: "#A1887F", roughness: 0.9 }); W.ownMat.push(sm);
    W.sticks = new THREE.InstancedMesh(stick, sm, K.marchers);
    W.sticks.count = 0; W.sticks.frustumCulled = false; W.sticks.castShadow = false; W.sticks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    W.group.add(W.sticks);
    for (let i = 0; i < K.marchers; i++) {
        const r = h01(W.town + W.topic.id, i);
        const look = r < 0.5 ? "woman" : "man";
        const anchor = new THREE.Object3D(); W.group.add(anchor);
        W.marchers.push({ anchor, i, look, sign: i % W.topic.signs.length, phase: h01("p" + W.town, i) * 6, at: i / K.marchers,
            colors: { top: new THREE.Color(TOPS[Math.floor(h01("t" + W.town, i) * TOPS.length)]), bot: new THREE.Color(look === "woman" ? "#263238" : "#212121"), hair: new THREE.Color(look === "woman" ? "#5D4037" : "#3E2723") } });
    }
    W.ready = true;
}
export function protestStop() {
    const W = PR.on;
    if (!W) return;
    PR.on = null;
    if (W.rm) W.rm();
    for (const r of Object.values(W.rigs)) r.dispose();
    for (const im of W.signs) { if (im.parent) im.parent.remove(im); im.dispose(); }
    if (W.sticks) { if (W.sticks.parent) W.sticks.parent.remove(W.sticks); W.sticks.dispose(); }
    for (const g of W.ownGeo || []) g.dispose();
    for (const m of W.ownMat || []) m.dispose();
    if (W.group && W.group.parent) W.group.parent.remove(W.group);
    log("stop");
}
/** A marcher's place on the loop at loop-fraction f → { x, z, rot } */
function loopAt(W, f) {
    const L = W.len, G = W.gap, per = 2 * L + Math.PI * G, k = ((f % 1) + 1) % 1 * per;
    let a, n, dir;
    if (k < L) { a = k - L / 2; n = -G / 2; dir = 1; }
    else if (k < L + Math.PI * G / 2) { const th = (k - L) / (G / 2); a = L / 2 + Math.sin(th) * G / 2; n = -Math.cos(th) * G / 2; dir = Math.cos(th) > 0 ? 1 : -1; }
    else if (k < 2 * L + Math.PI * G / 2) { a = L / 2 - (k - L - Math.PI * G / 2); n = G / 2; dir = -1; }
    else { const th = (k - 2 * L - Math.PI * G / 2) / (G / 2); a = -L / 2 - Math.sin(th) * G / 2; n = Math.cos(th) * G / 2; dir = Math.cos(th) > 0 ? -1 : 1; }
    const x = W.x + W.ux * a + W.nx * n, z = W.z + W.uz * a + W.nz * n;
    return { x, z, rot: Math.atan2(W.ux * dir, W.uz * dir) };
}
function draw(W, dt) {
    for (const r of Object.values(W.rigs)) r.begin();
    const signN = W.signs.map(() => 0);
    let sn = 0;
    const speed = 0.9 / (2 * W.len + Math.PI * W.gap);
    for (const m of W.marchers) {
        const P = loopAt(W, m.at + W.t * speed);
        m.x = P.x; m.z = P.z; m.anchor.position.set(P.x, 0, P.z);
        const ph = W.t * 5 + m.phase, bob = Math.abs(Math.cos(ph)) * 0.035;
        const cheer = W.cheerT > 0 && (m.i % 2 === 0);
        _m.compose(_v.set(P.x, bob + (cheer ? Math.abs(Math.sin(W.t * 9)) * 0.12 : 0), P.z), q3(0, P.rot, 0), _s);
        const rig = W.rigs[m.look];
        if (!rig) continue;
        const i = rig.add(m, m.colors);
        if (i < 0) continue;
        const s = Math.sin(ph), sw = 0.45;
        rig.pose(i, "Body", _m, null, _dp.set(0, 0, 0));
        rig.pose(i, "Arm_L", _m, q3(-2.5 + (cheer ? Math.sin(W.t * 12) * 0.3 : 0), 0, 0.1));
        rig.pose(i, "Arm_R", _m, q3(cheer ? -2.6 : s * sw * 0.8, 0, -0.12));
        rig.pose(i, "Leg_L", _m, q3(s * sw, 0, 0)); rig.pose(i, "Leg_R", _m, q3(-s * sw, 0, 0));
        if (rig.parts._rest) rig.pose(i, "_rest", _m);
        // the sign above the left hand, facing out from the line (toward the street side + along)
        const fx = Math.sin(P.rot), fz = Math.cos(P.rot), lx = Math.cos(P.rot), lz = -Math.sin(P.rot);
        const hx = P.x + lx * 0.28 + fx * 0.12, hz = P.z + lz * 0.28 + fz * 0.12;
        const y = 2.05 + bob + (cheer ? Math.abs(Math.sin(W.t * 9)) * 0.12 : 0);
        _m.compose(_v.set(hx, y, hz), q3(0, P.rot, 0), _s);
        W.signs[m.sign].setMatrixAt(signN[m.sign]++, _m);
        _m.compose(_v.set(hx, y - 0.6, hz), q3(0, P.rot, 0), _s);
        W.sticks.setMatrixAt(sn++, _m);
    }
    for (const r of Object.values(W.rigs)) r.end();
    W.signs.forEach((im, k) => { im.count = signN[k]; im.instanceMatrix.needsUpdate = true; });
    W.sticks.count = sn; W.sticks.instanceMatrix.needsUpdate = true;
}

// ── ✋ the protest ──
const spot = {
    r: 3.6, short: "PROTEST",
    pos() { const W = PR.on; return W && W.ready && onFoot() && !W.chant ? { x: W.x, z: W.z } : null; },
    label() { return PL.spot; },
    act() { talk(); },
};
async function talk() {
    const W = PR.on;
    if (!W || ctx.dialogOpen) return;
    const i = await choose("🪧 The protest", W.topic.signs[0] + "!", PL.opts, { emoji: "🪧" });
    if (PR.on !== W) return;
    if (i === 0) { await say("🪧 The protest", PL.join, { emoji: "📢" }); if (PR.on === W) startChant(W); }
    else if (i === 1) await say("🪧 The protest", W.topic.about, { emoji: "📢" });
}
/** The rhythm chant: 4 beats; press ✕ while the beat's word is lit (± PROTEST_TUNE.window s). foot's script holds her. */
export function startChant(W = PR.on) {
    if (!W || W.chant || !ctx.foot || !ctx.foot.script) return false;
    const words = W.topic.chant;
    const el = document.createElement("div");
    el.className = "ch-chant";
    el.innerHTML = words.map((w, i) => `<span data-i="${i}">${w}</span>`).join("");
    document.body.appendChild(el);
    const C = W.chant = { t: -0.6, beat: -1, hits: 0, pressed: {}, el, done: false };
    const ok = ctx.foot.script({
        update(dt, P) {
            if (PR.on !== W) return false;
            C.t += dt;
            const b = Math.floor(C.t / K.beat);
            const into = C.t - b * K.beat;
            if (b !== C.beat && b >= 0 && b < words.length) {
                C.beat = b;
                const sp = el.querySelectorAll("span");
                sp.forEach((s, k) => s.classList.toggle("on", k === b));
                const m = W.marchers[(b * 2) % Math.max(1, W.marchers.length)];
                if (m && m.x != null) bubble(m, words[b], K.beat * 0.9);
            }
            if (P && P.interact && b >= 0 && b < words.length && !C.pressed[b]) {
                C.pressed[b] = true;
                const hit = into < K.window || into > K.beat - K.window * 0.5;
                if (hit) { C.hits++; const s = el.querySelector(`span[data-i="${b}"]`); if (s) s.classList.add("hit"); }
                P.interact = false;
            }
            if (C.t > words.length * K.beat + 0.4) { finishChant(W); return false; }
            return true;
        },
        abort() { finishChant(W, true); },
    });
    if (!ok) { el.remove(); W.chant = null; return false; }
    log("chant", { phase: "start" });
    return true;
}
function finishChant(W, aborted = false) {
    const C = W.chant;
    if (!C || C.done) return;
    C.done = true;
    if (C.el) C.el.remove();
    W.chant = null;
    if (aborted) return;
    W.joined = true;
    W.cheerT = C.hits >= 3 ? 3.5 : 1.5;
    stat("cityhallProtests");
    S.protests = (S.protests || 0) + 1; saveSoon();
    emit("cityhall:protest", { phase: "chant", topic: W.topic.id, hits: C.hits });
    log("chant", { phase: "done", hits: C.hits });
    const line = C.hits >= 3 ? pick(PL.great) : C.hits >= 2 ? pick(PL.ok) : pick(PL.bad);
    const m = W.marchers[0];
    if (m && m.x != null) bubble(m, line, 3.2);
    PR.lastHits = C.hits;
}

on("honk", () => {
    const W = PR.on, p = herPos();
    if (!W || !W.ready || !p || Math.hypot(p.x - W.x, p.z - W.z) > 30 || ctx.time < PR.honkT) return;
    PR.honkT = ctx.time + 4;
    W.cheerT = 2.5;
    const m = W.marchers[Math.floor(Math.random() * W.marchers.length)];
    if (m && m.x != null) bubble(m, W.topic.id === "honk" ? PL.pointHonk : pick(PL.honk), 2.0);
    log("honk");
});

/** ~every frame from index.js: start / stop by the clock and the town; animate; the walk-by line. */
export function protestTick(dt) {
    const want = inTown() && ctx.enabled(ID) && protestHours() && !(ctx.state === "interior");
    const W = PR.on;
    if (!want) { if (W && (!inTown() || !protestHours())) protestStop(); return; }
    if (!W || W.town !== townId()) { protestStart(); return; }
    if (ctx.paused || !W.ready) return;
    W.t += dt;
    W.cheerT = Math.max(0, W.cheerT - dt);
    // the chant passes down the line every few seconds (only while she's near: a bubble nobody sees isn't spent)
    const p = herPos(), d = p ? Math.hypot(p.x - W.x, p.z - W.z) : 1e9;
    if (!W.chant && d < 35 && (W.chantT -= dt) <= 0) {
        W.chantT = 3.2;
        const m = W.marchers[(W.chantI * 3) % W.marchers.length];
        if (m && m.x != null && H.bubbleOk && H.bubbleOk(2)) bubble(m, W.topic.chant[W.chantI % W.topic.chant.length], 2.0);
        W.chantI++;
    }
    if (!PR.said && d < 22 && onFoot()) { PR.said = true; if (Math.random() < 0.6 && ctx.foot.obj) try { ctx.foot.say(ctx.foot.obj, W.topic.id === "honk" ? "…are they looking at me?" : pick(PL.lulu), 2.6); } catch (e) { /* none */ } }
    if (d < 140) draw(W, dt);
}
on("town:leave", () => { protestStop(); PR.said = false; });
on("town:enter", () => { PR.said = false; });
on("title", () => protestStop());
