// features/cityhall/wrongaddress.js — 🪧 "THE WRONG ADDRESS" (roadmap 38, the owner's request, guardrails in data.js +
// ARCHITECTURE › City hall). Midwood, lunchtime, on WRONG_ADDRESS.rate of the eligible real days (parodyday.js): a small,
// confused crowd stands on the sidewalk in front of a neighbourhood shop — Slice of Sinai, the bakery or Yanky's makolet,
// rotating by the day — because their own photocopied flyer says it "sells land in Israel". It sells pizza. The joke is
// ONLY that: confused, performative, badly organised people who picked a pickle shop. Archetypes (the clipboard, the man at
// every protest, a lady who thought it was the lunch line, a livestreamer with no viewers…), never an ethnicity, a
// nationality or a religion; no flags; no real slogans; nothing about any war. Ironic signs. The shopkeeper hands out
// samples; one by one they give up and buy lunch (WRONG_ADDRESS.leaveEvery while she's near) — when the last one goes the
// sidewalk is clear. Some days a COUNTER-PROTEST (a folding table: WE BROUGHT SNACKS) and somebody's Bubbe handing rugelach
// to both sides.
//   ✋ 🪧 THE… PROTEST?: 📢 her own rhythm chant ("WHAT DO WE WANT? / A SLICE!") · 💬 a line from someone · 📢 what's it
//   about · 🛒 buy the shop's thing (its price; she never earns) · 📸 a picture (a scrapbook stat) · walk on.
//   ✋ 🥨 the counter-protest. Honking → an eye-roll. Never blocks the shop's door; no pop-ups (bubbles near her only).
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { choose, say } from "../../core/dialog.js";
import { wallet } from "../../core/save.js";
import { models, ensureModels } from "../../models.js";
import { Rig } from "../homes/rig.js";
import * as H from "../../hud.js";
import { ID, WRONG_ADDRESS as WA, PROTEST_TUNE as K } from "./data.js";
import { inTown, stat } from "./state.js";
import { signTexture } from "./rooms.js";
import { now, dayKey, onNow, rng, shuffled } from "./parodyday.js";
import { PR } from "./protest.js";

const PERSON = ["Body", "Arm_L", "Arm_R", "Leg_L", "Leg_R"];
const LOOKS = { man: "npcMan", woman: "npcWoman" };
const pick = a => a[Math.floor(Math.random() * a.length)];
export const WAS = { on: null, log: [], said: "", honkT: 0, done: "" };
function log(ev, d = {}) { WAS.log.push(Object.assign({ ev }, d)); if (WAS.log.length > 40) WAS.log.shift(); }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler(), _dp = new THREE.Vector3();
const q3 = (x, y, z) => _q.setFromEuler(_e.set(x, y, z, "XYZ"));
const onFoot = () => !!(ctx.foot && ctx.foot.active && ctx.state === "footRun");
const herPos = () => (onFoot() ? ctx.foot.pos : ctx.state === "playing" && ctx.car ? ctx.car.pos : null);
const bubble = (anchor, text, sec = 2.4) => { try { if (anchor && ctx.foot && ctx.foot.say && !ctx.skipping) ctx.foot.say(anchor, text, sec); } catch (e) { /* none */ } };

/** Fill a line's {SLOTS} for a shop. */
export function fill(s, shop) {
    const S = WA.shops[shop] || WA.shops.pizza;
    return String(s).replace(/\{KIND\}/g, S.kind).replace(/\{KINDLOW\}/g, S.kind.toLowerCase()).replace(/\{AFTER\}/g, S.after).replace(/\{GOODS\}/g, S.goods)
        .replace(/\{SHOP\}/g, S.name).replace(/\{ITEMBARE\}/g, S.item.replace(/^an? /, "")).replace(/\{ITEM\}/g, S.item).replace(/\{SAMPLE\}/g, S.sample)
        .replace(/\{CHANT\}/g, S.chant).replace(/\{PRICE\}/g, String(S.price));
}
/** The day's line-up (a pure function of the date: the shop, who's there, which signs, a counter-protest?). */
export function waPlan(date = now()) {
    const key = dayKey(date), r = rng(key + ":wa-plan");
    const shops = Object.keys(WA.shops);
    const shop = shops[Math.floor(r() * shops.length)];
    const ids = shuffled(Object.keys(WA.people), r).slice(0, 4 + (r() < 0.5 ? 1 : 0));
    const signs = shuffled(WA.signs, r).slice(0, ids.length - 1);
    const flyer = WA.flyer[r() < 0.75 ? 0 : 1];
    const counter = r() < 0.5, bubbe = counter && r() < 0.75;
    return { key, shop, ids, signs, flyer, counter, bubbe, li: Math.floor(r() * 3) };
}

/** Start it in Midwood (tests: PD.force). → bool */
export function waStart() {
    waStop();
    const T = ctx.town;
    if (!T || !T.active || !T.spot || T.id !== WA.town) return false;
    const plan = waPlan();
    // (the town's own protest standing at the same shop today → the next shop along)
    const shops = Object.keys(WA.shops);
    let shop = plan.shop;
    if (PR.on && PR.on.topic && PR.on.topic.at === WA.shops[shop].spot) shop = shops[(shops.indexOf(shop) + 1) % shops.length];
    const sp = T.spot(WA.shops[shop].spot);
    if (!sp || sp.nx == null) return false;
    const SH = WA.shops[shop];
    const W = WAS.on = { plan, shop, SH, town: T.id, sp, ux: sp.ux, uz: sp.uz, nx: sp.nx, nz: sp.nz, t: 0, ready: false, group: null, rigs: {}, own: [],
        people: [], counter: [], bubbe: null, table: null, leaveT: WA.leaveEvery, ownerT: 6, crowdT: 4, rm: [], chant: null };
    W.door = { x: sp.x + sp.nx * 0.6, z: sp.z + sp.nz * 0.6 };
    W.mid = at(W, SH.crowd, 1.5);
    W.cmid = at(W, SH.counter, 1.5);
    W.owner = new THREE.Object3D(); W.owner.position.set(W.door.x, 0, W.door.z);
    const id = T.id;
    ensureModels(Object.values(LOOKS)).then(() => { if (WAS.on === W && ctx.town && ctx.town.id === id) build(W); }).catch(e => console.warn("[cityhall] wrong address models", e));
    if (ctx.foot && ctx.foot.addSpot) { W.rm.push(ctx.foot.addSpot(crowdSpot)); W.rm.push(ctx.foot.addSpot(counterSpot)); }
    emit("cityhall:parody", { kind: "wa", phase: "start", shop });
    log("start", { shop, ids: plan.ids, counter: plan.counter });
    return true;
}
const at = (W, a, n) => ({ x: W.sp.x + W.ux * a + W.nx * n, z: W.sp.z + W.uz * a + W.nz * n });
function signMesh(W, lines, i) {
    const tex = signTexture(lines, 0.9, 0.6, { bg: ["#FFFDE7", "#FFFFFF", "#FFF3E0", "#E3F2FD"][i % 4], fg: ["#C62828", "#1A237E", "#1B5E20", "#4A148C"][i % 4], font: 64 });
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), plain = W.plainMat;
    W.own.push(front, tex);
    const m = new THREE.Mesh(W.board, [plain, plain, plain, plain, front, plain]);       // (the back of every sign is blank — "see other side")
    m.castShadow = false;
    W.group.add(m);
    return m;
}
function build(W) {
    W.group = new THREE.Group(); W.group.name = "CityhallWrongAddress";
    ctx.scene.add(W.group);
    for (const [k, key] of Object.entries(LOOKS)) {
        if (!models[key]) continue;
        W.rigs[k] = new Rig(models[key], PERSON, 10, { name: "wa-" + k });
        W.group.add(W.rigs[k].group);
    }
    W.board = new THREE.BoxGeometry(0.9, 0.6, 0.03);
    W.plainMat = new THREE.MeshStandardMaterial({ color: "#F5F5F5", roughness: 0.9 });
    W.own.push(W.board, W.plainMat);
    const face = Math.atan2(W.nx, W.nz), P = W.plan, n = P.ids.length;
    P.ids.forEach((id, i) => {
        const A = WA.people[id];
        const a = W.SH.crowd + (i - (n - 1) / 2) * 1.05, nn = 1.0 + (i % 2) * 0.95;
        const pos = at(W, a, nn);
        const anchor = new THREE.Object3D(); anchor.position.set(pos.x, 0, pos.z); W.group.add(anchor);
        const lines = i === 0 ? P.flyer : P.signs[i - 1].map(s => fill(s, W.shop));
        W.people.push({ id, A, anchor, x: pos.x, z: pos.z, rot: face + (i - (n - 1) / 2) * 0.12, look: A.look, phase: i * 1.7, sign: signMesh(W, lines, i), signText: lines.join(" "),
            colors: cols(A.colors), state: "stand" });
    });
    if (P.counter) {
        const g = new THREE.Group(); g.position.set(W.cmid.x, 0, W.cmid.z); g.rotation.y = face; W.group.add(g);
        const wood = new THREE.MeshStandardMaterial({ color: "#8D6E63", roughness: 0.8 }); W.own.push(wood);
        const top = new THREE.BoxGeometry(1.7, 0.05, 0.7), leg = new THREE.BoxGeometry(0.05, 0.72, 0.05); W.own.push(top, leg);
        const t = new THREE.Mesh(top, wood); t.position.set(0, 0.74, 0); g.add(t);
        for (const [lx, lz] of [[-0.78, -0.3], [0.78, -0.3], [-0.78, 0.3], [0.78, 0.3]]) { const l = new THREE.Mesh(leg, wood); l.position.set(lx, 0.36, lz); g.add(l); }
        const btex = signTexture(WA.counter.banner, 1.6, 0.5, { bg: "#1565C0", fg: ["#FFFFFF", "#FFE082"], font: 64 });
        const bm = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.8 }); W.own.push(btex, bm);
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5), bm); W.own.push(banner.geometry);
        banner.position.set(0, 0.45, 0.37); g.add(banner);
        W.table = g;
        WA.counter.people.forEach((c, i) => {
            const lx = (i ? 0.45 : -0.45), lz = -0.75;
            const x = W.cmid.x + Math.cos(face) * lx + Math.sin(face) * lz, z = W.cmid.z - Math.sin(face) * lx + Math.cos(face) * lz;
            const anchor = new THREE.Object3D(); anchor.position.set(x, 0, z); W.group.add(anchor);
            W.counter.push({ id: "counter" + i, A: c, anchor, x, z, rot: face, look: c.look, phase: 2 + i, colors: cols(c.colors), state: "stand" });
        });
        if (P.bubbe) {
            const anchor = new THREE.Object3D(); W.group.add(anchor);
            W.bubbe = { id: "bubbe", anchor, x: W.cmid.x, z: W.cmid.z, rot: 0, look: "woman", phase: 0, colors: cols({ Top: "#6D4C41", Bottom: "#4E342E", Hair: "#ECEFF1" }), state: "walk", f: 0 };
        }
    }
    W.ready = true;
    log("built", { people: W.people.length, counter: W.counter.length, bubbe: !!W.bubbe });
}
const cols = c => ({ top: new THREE.Color(c.Top), bot: new THREE.Color(c.Bottom), hair: new THREE.Color(c.Hair) });
export function waStop() {
    const W = WAS.on;
    if (!W) return;
    WAS.on = null;
    for (const r of W.rm) try { r && r(); } catch (e) { /* none */ }
    if (W.chant && W.chant.el) W.chant.el.remove();
    for (const r of Object.values(W.rigs)) r.dispose();
    for (const o of W.own) try { o.dispose(); } catch (e) { /* none */ }
    if (W.group && W.group.parent) W.group.parent.remove(W.group);
    log("stop");
}

// ── drawing (instanced bodies; the signs follow the left hand) ──
function drawOne(W, rig, m, walking) {
    const ph = W.t * (walking ? 7 : 1.4) + m.phase, bob = walking ? Math.abs(Math.cos(ph)) * 0.04 : Math.sin(ph) * 0.01;
    _m.compose(_v.set(m.x, bob, m.z), q3(0, m.rot + (walking ? 0 : Math.sin(W.t * 0.6 + m.phase) * 0.08), 0), _s);
    const i = rig.add(m, m.colors);
    if (i < 0) return;
    const s = walking ? Math.sin(ph) * 0.45 : 0;
    rig.pose(i, "Body", _m, null, _dp.set(0, 0, 0));
    rig.pose(i, "Arm_L", _m, q3(m.sign && !walking ? -2.5 : s * 0.8, 0, 0.1));
    rig.pose(i, "Arm_R", _m, q3(walking ? -s * 0.8 : -0.15, 0, -0.12));
    rig.pose(i, "Leg_L", _m, q3(s, 0, 0)); rig.pose(i, "Leg_R", _m, q3(-s, 0, 0));
    if (rig.parts._rest) rig.pose(i, "_rest", _m);
    if (m.sign) {
        const fx = Math.sin(m.rot), fz = Math.cos(m.rot), lx = Math.cos(m.rot), lz = -Math.sin(m.rot);
        m.sign.visible = !walking;
        m.sign.position.set(m.x + lx * 0.28 + fx * 0.12, 2.05 + bob, m.z + lz * 0.28 + fz * 0.12);
        m.sign.rotation.set(0, Math.atan2(W.nx, W.nz) + Math.sin(W.t * 1.3 + m.phase) * 0.1, 0);
    }
}
function draw(W) {
    for (const r of Object.values(W.rigs)) r.begin();
    for (const m of W.people.concat(W.counter)) { if (m.state === "gone") continue; const rig = W.rigs[m.look]; if (rig) drawOne(W, rig, m, m.state === "leave"); }
    if (W.bubbe && W.rigs.woman) drawOne(W, W.rigs.woman, W.bubbe, true);
    for (const r of Object.values(W.rigs)) r.end();
}

// ── the clock: start / stop, people giving up for lunch, the walk-by lines ──
export function waTick(dt) {
    const want = inTown() && ctx.town.id === WA.town && ctx.enabled(ID) && onNow("wa") && ctx.state !== "interior" && !(ctx.G && ctx.G.mode === "dina")
        && WAS.done !== dayKey(now());
    const W = WAS.on;
    if (!want) { if (W) waStop(); return; }
    if (!W || W.town !== ctx.town.id) { waStart(); return; }
    if (ctx.paused || !W.ready) return;
    W.t += dt;
    const p = herPos(), d = p ? Math.hypot(p.x - W.mid.x, p.z - W.mid.z) : 1e9;
    // one by one they give up and go in for lunch (only while she's around to see it)
    if (d < 60 && !W.chant && (W.leaveT -= dt) <= 0) { W.leaveT = WA.leaveEvery; leaveOne(W); }
    for (const m of W.people) if (m.state === "leave") {
        const dx = W.door.x - m.x, dz = W.door.z - m.z, L = Math.hypot(dx, dz);
        if (L < 0.4) { m.state = "gone"; if (m.sign) m.sign.visible = false; continue; }
        m.rot = Math.atan2(dx, dz); m.x += dx / L * dt * 1.3; m.z += dz / L * dt * 1.3; m.anchor.position.set(m.x, 0, m.z);
    }
    if (W.people.every(m => m.state === "gone")) { packUp(W); return; }
    // Bubbe walks between the two groups with a tray
    if (W.bubbe) {
        const B = W.bubbe; B.f += dt * 0.12;
        const k = (Math.sin(B.f * Math.PI * 2) + 1) / 2, a = at(W, W.SH.counter + (W.SH.crowd - W.SH.counter) * k, 2.2);
        B.rot = Math.cos(B.f * Math.PI * 2) > 0 === (W.SH.crowd > W.SH.counter) ? Math.atan2(W.ux, W.uz) : Math.atan2(-W.ux, -W.uz);
        B.x = a.x; B.z = a.z; B.anchor.position.set(a.x, 0, a.z);
    }
    // a line now and then — only near her, and only when a bubble fits (no pop-ups)
    if (d < 30 && !W.chant && (W.crowdT -= dt) <= 0) {
        W.crowdT = 5.5;
        if (H.bubbleOk && H.bubbleOk(2.4)) {
            const r = Math.random(), here = W.people.filter(m => m.state === "stand");
            if (r < 0.3) bubble(W.owner, fill(pick(WA.owner), W.shop), 2.6);
            else if (r < 0.5 && W.counter.length) bubble(pick(W.counter).anchor, pick(WA.counter.lines), 2.4);
            else if (r < 0.62 && W.bubbe) bubble(W.bubbe.anchor, pick(WA.counter.bubbe.lines), 2.6);
            else if (here.length) { const m = pick(here); bubble(m.anchor, fill(m.A.lines[(W.plan.li + Math.floor(W.t / 20)) % m.A.lines.length], W.shop), 2.6); }
        }
    }
    if (WAS.said !== W.plan.key && d < 22 && onFoot()) { WAS.said = W.plan.key; try { if (ctx.foot.obj) ctx.foot.say(ctx.foot.obj, fill(pick(WA.lulu.walkBy), W.shop), 2.6); } catch (e) { /* none */ } }
    if (d < 150) draw(W);
}
export function leaveOne(W = WAS.on) {
    const m = W && W.people.find(x => x.state === "stand");
    if (!m) return false;
    m.state = "leave";
    bubble(m.anchor, fill(pick(WA.leave), W.shop), 2.2);
    log("leave", { id: m.id });
    return true;
}
function packUp(W) {
    WAS.done = W.plan.key;
    log("packed");
    const p = herPos();
    if (p && Math.hypot(p.x - W.mid.x, p.z - W.mid.z) < 30 && onFoot()) try { ctx.foot.say(ctx.foot.obj, W.bubbe ? WA.counter.end : WA.lulu.packed, 3); } catch (e) { /* none */ }
    emit("cityhall:parody", { kind: "wa", phase: "packed" });
    waStop();
}

// ── ✋ ──
const crowdSpot = {
    r: 3.2, short: "PROTEST?",
    pos() { const W = WAS.on; return W && W.ready && onFoot() && !W.chant && W.people.some(m => m.state === "stand") ? W.mid : null; },
    label() { return WA.spot; },
    act() { talk(); },
};
const counterSpot = {
    r: 2.4, short: "SNACKS",
    pos() { const W = WAS.on; return W && W.ready && onFoot() && W.table ? W.cmid : null; },
    label() { return WA.counterSpot; },
    act() { const W = WAS.on; if (!W) return; say(WA.counter.people[0].name, pick(WA.counter.lines), { emoji: "🥨" }).then(() => W.bubbe && WAS.on === W ? say(WA.counter.bubbe.name, pick(WA.counter.bubbe.lines), { emoji: "👵" }) : null); },
};
export async function talk() {
    const W = WAS.on;
    if (!W || ctx.dialogOpen) return;
    const opts = WA.opts.map(o => fill(o, W.shop));
    const i = await choose("🪧 The protest", fill(W.plan.flyer.join(" "), W.shop), opts, { emoji: "🪧" });
    if (WAS.on !== W) return;
    if (i === 0) startChant(W);
    else if (i === 1) { const here = W.people.filter(m => m.state === "stand"); const m = here.length ? pick(here) : null; if (m) await say(m.A.name, fill(pick(m.A.lines), W.shop), { emoji: "🪧" }); }
    else if (i === 2) {
        const c = W.people.find(m => m.id === "clipboard") || W.people[0];
        await say(c.A.name, WA.lulu.explain, { emoji: "📄" });
        if (WAS.on === W) await say(W.SH.owner, fill(WA.lulu.ownerAnswer, W.shop), { emoji: W.SH.emoji });
        if (WAS.on === W) await say("Lulu", fill(WA.lulu.explainLulu, W.shop), { emoji: "🤔" });
    } else if (i === 3) await buy(W);
    else if (i === 4) { stat("parodyPhotos"); log("photo"); await say("Lulu", fill(WA.lulu.photo, W.shop), { emoji: "📸" }); }
}
/** Buy the shop's thing: its price, never below 0; she never earns anything here. → bool */
export async function buy(W = WAS.on) {
    if (!W) return false;
    const ok = wallet.coins >= W.SH.price && wallet.spend(W.SH.price);
    log("buy", { ok });
    if (ok) { stat("parodyBuys"); await say(W.SH.owner, fill(WA.lulu.buyOk, W.shop), { emoji: W.SH.emoji }); const m = W.people.find(x => x.state === "stand"); if (m) leaveOne(W); }
    else await say("Lulu", fill(WA.lulu.buyNo, W.shop), { emoji: "🪙" });
    return ok;
}
// her own rhythm chant (protest.js's chant bar): "WHAT DO WE WANT? / A SLICE! / WHEN DO WE WANT IT? / LUNCH!"
export function startChant(W = WAS.on) {
    if (!W || W.chant || !ctx.foot || !ctx.foot.script) return false;
    const words = WA.chant.map(w => fill(w, W.shop));
    const el = document.createElement("div");
    el.className = "ch-chant";
    el.innerHTML = words.map((w, i) => `<span data-i="${i}">${w}</span>`).join("");
    document.body.appendChild(el);
    const C = W.chant = { t: -0.6, beat: -1, hits: 0, pressed: {}, el, done: false };
    const ok = ctx.foot.script({
        update(dt, P) {
            if (WAS.on !== W) return false;
            C.t += dt;
            const b = Math.floor(C.t / K.beat), into = C.t - b * K.beat;
            if (b !== C.beat && b >= 0 && b < words.length) {
                C.beat = b;
                el.querySelectorAll("span").forEach((s, k) => s.classList.toggle("on", k === b));
                if (ctx.foot.obj) bubble(ctx.foot.obj, words[b], K.beat * 0.9);
            }
            if (P && P.interact && b >= 0 && b < words.length && !C.pressed[b]) {
                C.pressed[b] = true;
                if (into < K.window || into > K.beat - K.window * 0.5) { C.hits++; const s = el.querySelector(`span[data-i="${b}"]`); if (s) s.classList.add("hit"); }
                P.interact = false;
            }
            if (C.t > words.length * K.beat + 0.4) { endChant(W); return false; }
            return true;
        },
        abort() { endChant(W, true); },
    });
    if (!ok) { el.remove(); W.chant = null; return false; }
    log("chant", { phase: "start" });
    return true;
}
function endChant(W, aborted = false) {
    const C = W.chant;
    if (!C || C.done) return;
    C.done = true; C.el.remove(); W.chant = null;
    if (aborted) return;
    stat("parodyChants");
    WAS.lastHits = C.hits;
    log("chant", { phase: "done", hits: C.hits });
    const E = WA.chantEnd, line = fill(pick(C.hits >= 3 ? E.great : C.hits >= 2 ? E.ok : E.bad), W.shop);
    const m = W.people.find(x => x.state === "stand");
    if (m) bubble(m.anchor, line, 3);
}
on("honk", () => {
    const W = WAS.on, p = herPos();
    if (!W || !W.ready || !p || Math.hypot(p.x - W.mid.x, p.z - W.mid.z) > 30 || ctx.time < WAS.honkT) return;
    WAS.honkT = ctx.time + 5;
    const m = W.people.find(x => x.state === "stand");
    if (m) bubble(m.anchor, pick(WA.honk), 2);
    log("honk");
});
on("town:leave", () => waStop());
on("title", () => waStop());
