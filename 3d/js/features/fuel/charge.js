// features/fuel/charge.js — 🔋 CHARGING (step 2): public chargers + the HOME CHARGER.
//   • A Tushla stopped at a charger CHARGES while it stands there — fast to 80 %, slower after (data.js CHARGE) — whether
//     she sits in it or gets out and does something (the car stays plugged in). Pay as it goes (PRICE.charge a full
//     charge, half the gas price per km); at 0 coins a quarter charge on account (the same one IOU as gas). A soft chime
//     when it's full. Chargers: Tushla's own forecourt (lap metre 800), the rest areas' pump bays, the pad by each town
//     interchange's gas station, and one kerbside charger outside each town's city hall (a slim post, drawn on town:enter).
//   • THE HOME CHARGER: sold at Tushla's tablet (HOME.price, two taps), installed at a home she OWNS (features/realestate);
//     a wall box by its door. A Tushla parked there (features/cars: left at that house, or her parked car by it) is full the
//     next time she takes it. One charger; moving it to another of her homes costs HOME.move. Ima's house: no ("we're NOT
//     drilling into my wall") — the extension-cord joke: a Tushla at Ima's trickles up to HOME.cord once a real day.
import * as THREE from "three";
import { ctx, on, hook, emit } from "../../core/ctx.js";
import { saveSoon, wallet } from "../../core/save.js";
import * as H from "../../hud.js";
import { SKINS } from "../../car.js";
import { buyExtra } from "../garage/buy.js";
import { X, X_IN, XW } from "../town/exit.js";
import { toWorld } from "../town/plan.js";
import { inv } from "../garage/data.js";
import { CHARGE, HOME, PRICE, IOU, PUMPS, L } from "./data.js";

const isEV = k => !!(SKINS[k] && SKINS[k].ev);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const C = { s: null, acc: 0, post: [], box: null, log: [] };
function log(ev, d = {}) { C.log.push(Object.assign({ ev, t: +(ctx.time || 0).toFixed(1) }, d)); if (C.log.length > 40) C.log.shift(); }
let FS = null, F = null;
export function initCharge(fs, f) { FS = fs; F = f; if (!FS.cord) FS.cord = {}; }

// ── where the chargers are (world points, live) ──
const _p = {};
function chargers() {
    const out = [], hw = ctx.world && (ctx.world.highway || ctx.world.road);
    if (!hw) return out;
    // Tushla's forecourt
    try { const E = ctx.dealers && ctx.dealers.debug && ctx.dealers.debug.ev && ctx.dealers.debug.ev.E; if (E) for (const sp of E.spots) out.push({ id: "tushla", x: sp.x, z: sp.z, r: CHARGE.r.tushla }); } catch (e) { /* no showroom */ }
    // the rest areas' pump bays
    try { for (const s of (ctx.places && ctx.places.at ? ctx.places.at("exits_pump") : [])) { hw.point(s, CHARGE.restD, _p); out.push({ id: "rest", x: _p.x, z: _p.z, r: CHARGE.r.bay }); } } catch (e) { /* no rest areas */ }
    // the towns' interchange pads
    for (const e of X.exits) { hw.point(e.s + X_IN + XW, PUMPS.towns.d, _p); out.push({ id: "town", x: _p.x, z: _p.z, r: PUMPS.towns.pad }); }
    // the kerbside chargers outside each city hall (in the town she's in)
    for (const p of C.post) out.push({ id: "kerb", x: p.x, z: p.z, r: CHARGE.r.kerb });
    return out;
}
/** Where her EV stands right now (driving: the car; on foot: the car she got out of) + its key, or null. */
function evHere() {
    const car = ctx.car;
    if (!car || !isEV(car.skinKey) || !ctx.G || ctx.G.mode === "dina") return null;
    const F0 = ctx.foot && ctx.foot.active && ctx.foot.debug && ctx.foot.debug.F;
    if (F0) { const st = F0.car && F0.car.stub; return st ? { k: car.skinKey, x: st.x, z: st.z, still: true } : null; }
    if (ctx.state !== "playing") return null;
    return { k: car.skinKey, x: car.pos.x, z: car.pos.z, still: Math.abs(car.speed) < 0.5 };
}

// ── a charging session ──
hook("hud", dt => {
    if (!FS) return;
    if ((C.acc += dt) < 0.25) return;
    const step = Math.min(1, C.acc); C.acc = 0;
    const ev = evHere();
    let at = null;
    const S = C.s;
    // (a session already going holds on a few metres further: getting out parks the car a step or two off where it stood)
    if (ev && ev.still) for (const c of chargers()) if (Math.hypot(ev.x - c.x, ev.z - c.z) < c.r + (S && S.at === c.id ? CHARGE.hold : 0)) { at = c; break; }
    if (!at || (S && S.k !== ev.k)) { if (S) end("left"); return; }
    const lv = ctx.fuel.level(ev.k);
    if (!S) {
        if (lv >= 0.995) return;
        C.s = { k: ev.k, at: at.id, from: lv, cost: 0, owe: 0, acc: 0, iou: 0, said: false };
        H.toast(L.charging, "", { key: "fuel" });
        log("start", { k: ev.k, at: at.id, from: +lv.toFixed(3) });
        emit("fuel:charge", { key: ev.k, at: at.id, act: "start" });
        return;
    }
    if (lv >= 0.999) { end("full"); return; }
    const rate = lv < CHARGE.fastTo ? CHARGE.fast : CHARGE.slow, add = Math.min(1 - lv, rate * step);
    // pay as it goes: a coin each time a coin's worth has gone in (or the quarter on account at 0 coins)
    S.acc += add * PRICE.charge;
    while (S.acc >= 1) {
        if (wallet.coins >= 1 && wallet.spend(1)) { S.cost++; S.acc -= 1; continue; }
        if (!FS.iou && S.iou < IOU) { S.acc -= 1; S.owe++; break; }
        end("broke"); return;
    }
    if (S.owe) S.iou = S.owe / PRICE.charge;
    ctx.fuel.set(ev.k, lv + add);
});
function end(why) {
    const S = C.s;
    if (!S) return;
    C.s = null;
    const to = ctx.fuel.level(S.k);
    if (S.owe) { FS.iou = Math.max(1, S.owe); saveSoon(); }
    if (S.cost > 0) emit("shops:buy", { kind: "fuel", id: S.k, price: S.cost });
    if (why === "full") { H.toast(L.charged(S.cost), "gold", { key: "fuel" }); import("../parking/sfx.js").then(m => { m.tone(660, 0.08, "sine", 0.1); setTimeout(() => m.tone(990, 0.12, "sine", 0.1), 110); }).catch(() => {}); }
    else if (why === "broke") H.toast(L.chargeBroke, "", { key: "fuel" });
    log("end", { k: S.k, why, from: +S.from.toFixed(3), to: +to.toFixed(3), cost: S.cost, owe: S.owe });
    emit("fuel:charge", { key: S.k, at: S.at, act: "end", why, from: +S.from.toFixed(3), to: +to.toFixed(3), cost: S.cost, owe: S.owe });
}

// ── the kerbside chargers: a slim post outside each town's city hall ──
const postMat = new THREE.MeshStandardMaterial({ color: "#ECEFF1", roughness: 0.5 }), lampMat = new THREE.MeshStandardMaterial({ color: "#29B6F6", emissive: "#29B6F6", emissiveIntensity: 1.2 });
const postGeo = new THREE.BoxGeometry(0.35, 1.5, 0.25), lampGeo = new THREE.BoxGeometry(0.37, 0.18, 0.27);
function dropPosts() { for (const p of C.post) if (p.obj.parent) p.obj.parent.remove(p.obj); C.post.length = 0; if (C.box && C.box.parent) C.box.parent.remove(C.box); C.box = null; }
function buildPosts() {
    dropPosts();
    const T = ctx.town;
    if (!T || !T.active) return;
    const sp = T.spot && T.spot(CHARGE.kerbSpot);
    if (sp) {
        // at the kerb in front of it: out from the door toward the street
        const nx = sp.nx || 0, nz = sp.nz || 0, x = sp.x + nx * CHARGE.kerbOut, z = sp.z + nz * CHARGE.kerbOut;
        const g = new THREE.Group();
        const a = new THREE.Mesh(postGeo, postMat); a.position.y = 0.75; g.add(a);
        const b = new THREE.Mesh(lampGeo, lampMat); b.position.y = 1.4; g.add(b);
        g.position.set(x, 0, z); g.rotation.y = Math.atan2(nx, nz); g.name = "FuelKerbCharger";
        ctx.scene.add(g);
        C.post.push({ obj: g, x: x + nx * 2.2, z: z + nz * 2.2 });
    }
    // her home charger's wall box, if it's in this town
    const h = FS && FS.home;
    if (h && h.town === T.id) {
        const w = toWorld(h.lx, h.lz, {});
        const g = new THREE.Group();
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.18), postMat); a.position.y = 1.2; g.add(a);
        const b = new THREE.Mesh(lampGeo, lampMat); b.scale.set(1.2, 0.6, 0.8); b.position.y = 1.62; g.add(b);
        g.position.set(w.x + HOME.box[0], 0, w.z + HOME.box[1]); g.name = "FuelHomeCharger";
        ctx.scene.add(g);
        C.box = g;
    }
}
on("town:enter", () => setTimeout(buildPosts, 0));
on("town:leave", dropPosts);
on("title", dropPosts);

// ── the home charger ──
const myHomes = () => { try { return ctx.realestate ? ctx.realestate.owned().filter(h => !h.lost) : []; } catch (e) { return []; } };
const homeOf = h => { const [town, lx, lz] = String(h.id).split(":"); return { id: h.id, town, lx: +lx, lz: +lz, address: h.address || h.label || "your home" }; };
/** Buy (or move) the home charger. → { ok, why?, home? } — `to`: a home id (default: the first she owns / the next one). */
export function buyHome(to = null) {
    const homes = myHomes();
    if (!homes.length) return { ok: false, why: "nohome" };
    const cur = FS.home;
    let pick = to ? homes.find(h => h.id === to) : null;
    if (!pick) pick = cur ? homes[(homes.findIndex(h => h.id === cur.id) + 1) % homes.length] : homes[0];
    if (cur && pick.id === cur.id) return { ok: false, why: "same" };
    const price = cur ? HOME.move : HOME.price;
    const r = buyExtra("charger", cur ? "move" : "home", price);
    if (!r.ok) return r;
    FS.home = homeOf(pick); saveSoon();
    emit("fuel:home", { act: cur ? "move" : "buy", id: FS.home.id, price });
    log("home", { act: cur ? "move" : "buy", id: FS.home.id, price });
    if (ctx.town && ctx.town.active) buildPosts();
    return { ok: true, home: FS.home, price };
}
// (a home she no longer owns: the charger comes back in a box — free to re-install)
function homeCheck() {
    const h = FS && FS.home;
    if (!h) return;
    if (!myHomes().some(x => x.id === h.id)) { FS.home = null; FS.boxed = true; saveSoon(); log("boxed", { id: h.id }); }
}
let hT = 0;
hook("hud", dt => {
    if (!FS || (hT -= dt) > 0) return;
    hT = 2;
    homeCheck();
    const h = FS.home, Cr = ctx.cars;
    for (const k of (inv.ownedSkins || [])) {
        if (!isEV(k)) continue;
        // parked at her home charger (left there, or her parked car standing by it right now) → full
        let atHome = false;
        if (h && Cr && Cr.where) { const r = Cr.where(k); if (r && r.kind === "left" && r.town === h.town && Math.hypot((r.lx || 0) - h.lx, (r.lz || 0) - h.lz) < HOME.reach) atHome = true; }
        if (h && !atHome && ctx.car && ctx.car.skinKey === k && ctx.foot && ctx.foot.active && ctx.town && ctx.town.active && ctx.town.id === h.town) {
            const ev = evHere();
            if (ev) { const w = toWorld(h.lx, h.lz, {}); if (Math.hypot(ev.x - w.x, ev.z - w.z) < HOME.reach) atHome = true; }
        }
        if (atHome && ctx.fuel.level(k) < 0.999) { ctx.fuel.set(k, 1); log("homeFull", { k }); emit("fuel:charge", { key: k, at: "home", act: "full" }); }
        // Ima's extension cord: a trickle, once a real day
        if (Cr && Cr.where) { const r = Cr.where(k); if (r && r.kind === "home" && FS.cord[k] !== today()) { FS.cord[k] = today(); if (ctx.fuel.level(k) < HOME.cord) { ctx.fuel.set(k, HOME.cord); log("cord", { k }); } saveSoon(); } }
    }
});

export const chargeDebug = { C, chargers, evHere, buyHome, end, buildPosts, myHomes };
