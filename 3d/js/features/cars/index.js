// features/cars — 🚗 every car she owns is SOMEWHERE (roadmap 35, ci/cars).
//
// One record per owned car (the 3D save, so the 💾 save code carries it):
//   with     — the car ctx.car is right now: she's driving it, or it's her own car parked where she got out (foot's stub)
//   home     — at Ima's house
//   left     — parked in a town where she left it: { town, lx, lz, h } in that town's LOCAL frame, so it's the same
//              spot in every lap's copy of the town; it survives leaving the area, other towns, a reload, a new day
//   impound  — the law has it ({ town }; features/impound gets it out)
// A left car in the town she's in (within TUNE.near) is a real parked car — solid, the other drivers steer round it,
// she can stand on it — and ✋ "🔑 GET IN" swaps: the car she was using stays parked where it is, she drives off in this one.
// Nothing is checked per frame: a look every TUNE.tick s; far cars cost nothing.
//
// What decides "she left it": she was on foot by her own parked car, and then that car stopped being foot's —
// she drove off in something else (a borrowed / stolen ride, a taxi), the run ended (title / a new day) or the
// town was torn down round it. Anything that puts her back in her own car means the car is with her again.
// Off a town (the highway, a rest area, JFK) the spot is in the highway's frame ({ hw: { ls, d, dh } } — its lap metre,
// the offset off the centre line, the heading off the road's): the same on every lap.
// TOWS (Tuvia's Towing → the nearest impound, TOW_FEE at the gate, one `need: true` text): the highway's lanes / shoulder
// once she's been > TUNE.hwNear away for TUNE.hwAway s (or left the highway); a town's travel lane / no-parking stretch the
// same, closer in (or she left the town); anywhere else after TUNE.days real days — never at Ima's, a house she owns, a lot.
// Never in front of her. A wreck: Chaverim tows it home, free. 📞 Contacts › Tuvia's Towing brings a LEFT car home
// (TUNE.deliver). Impounded = stays until paid / broken out (features/impound asks ctx.cars). No car at home at the start of a
// day → Ima's family minivan in the driveway (a borrowed shell: slow, not hers to sell or mod) — nobody is ever stuck.
//
// ctx.cars { list(), where(key), atHome(key), leaveAt(key, rec), getIn(key), held(town), impounded(town), fromImpound(key),
//            deliver(key), tow(key, why), frameOf(x, z, h), debug }
// events cars:change { key, kind } · cars:getin { key } · cars:tow { key, why, town }
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { findNodes, models } from "../../models.js";
import { LAP, lapS } from "../../world.js";
import { registerKind, kindSpec } from "../../traffic.js";
import { inv, syncInv } from "../garage/data.js";
import { equipSkin } from "../garage/buy.js";
import { MAP_EXTRAS } from "../phone/apps.js";
import { lapPlaces, myLapM, ahead, miles } from "../world/lapmap.js";
import { ID, TUNE, L, TOW_FEE, MINIVAN } from "./data.js";

export const SAVE = store(ID, { v: 1, cars: {}, pend: null, slots: null });
const S = { t: 0, last: null, props: {}, swapping: false, migrated: false, log: [], away: {}, minivan: false, tv: { arm: null, msg: "" } };
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));
const pick = a => a[Math.floor(Math.random() * a.length)];
const log = (ev, d = {}) => { S.log.push(Object.assign({ ev, t: +(ctx.time || 0).toFixed(2) }, d)); if (S.log.length > 60) S.log.shift(); };
const live = () => ctx.enabled(ID) && !!ctx.G && ctx.G.mode !== "dina" && ctx.G.mode !== "party" && !(ctx.party && ctx.party.active);
const T = () => ctx.traffic;
const footF = () => (ctx.foot && ctx.foot.debug ? ctx.foot.debug.F : null);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const nameOf = k => (SKINS[k] ? SKINS[k].name : k);
const townName = id => { const d = ctx.town && ctx.town.towns && ctx.town.towns[id]; return d ? d.name : id; };
const sel = () => (ctx.car && SKINS[ctx.car.skinKey] ? ctx.car.skinKey : inv.selectedSkin);
const owned = () => (inv.ownedSkins || ["pink"]).filter(k => SKINS[k]);

// ── the records ──
function rec(k) {
    let r = SAVE.cars[k];
    if (!r || !r.kind) r = SAVE.cars[k] = { kind: k === sel() ? "with" : "home" };
    return r;
}
function setRec(k, r) {
    const was = SAVE.cars[k] && SAVE.cars[k].kind;
    SAVE.cars[k] = r;
    saveSoon();
    if (was !== r.kind || r.kind === "left") { log("set", { key: k, kind: r.kind, town: r.town || null }); emit("cars:change", { key: k, kind: r.kind }); }
}
/** Every owned car gets a record (a car bought / won → at home); the selected one is with her. Old records of cars she no longer owns go. */
function migrate() {
    try { syncInv(); } catch (e) { /* no save yet */ }
    const have = owned();
    for (const k of Object.keys(SAVE.cars)) if (!have.includes(k)) delete SAVE.cars[k];
    for (const k of have) rec(k);
    // a walk that never finished (the page closed with her car parked out in a town): it's still there
    const p = SAVE.pend;
    if (p && p.key && SAVE.cars[p.key] && SAVE.cars[p.key].kind === "with" && p.at) {
        SAVE.cars[p.key] = Object.assign({ kind: "left", legal: p.legal !== false, day: p.day || today() }, p.at);
        log("reload", { key: p.key, town: p.at.town || null });
    }
    SAVE.pend = null;
    S.migrated = true;
    saveSoon();
}

// ── town frame ──
function plan() { const Tn = ctx.town; return Tn && Tn.active ? Tn.plan : null; }
function poseOf(c) {
    const P = plan();
    if (!P) {
        const hw = ctx.world && ctx.world.highway;
        if (!hw) return { town: null, x: c.x, z: c.z };
        const n = hw.nearest(c.x, c.z, ctx.car ? ctx.car.s : 0, {});
        return { town: null, hw: { ls: +lapS(n.s).toFixed(1), d: +n.d.toFixed(2), dh: +(c.h - hw.at(n.s).h).toFixed(3) }, x: c.x, z: c.z };
    }
    const dx = c.x - P.ORIGIN.x, dz = c.z - P.ORIGIN.z;
    return { town: ctx.town.id, lx: dx * P.COS - dz * P.SIN, lz: dx * P.SIN + dz * P.COS, h: c.h - P.ROT, x: c.x, z: c.z };
}
function worldOf(r) {
    if (r.hw) return worldOfHw(r);
    const P = plan();
    if (!P || ctx.town.id !== r.town) return null;
    return { x: P.ORIGIN.x + r.lx * P.COS + r.lz * P.SIN, z: P.ORIGIN.z - r.lx * P.SIN + r.lz * P.COS, h: r.h + P.ROT };
}
/** A highway-frame spot on the copy of the road she's on (the nearest lap) — null in a town or kilometres off. */
function worldOfHw(r) {
    const hw = ctx.world && ctx.world.highway;
    if (plan() || !hw || !ctx.car) return null;
    const s0 = ctx.car.s, s = r.hw.ls + LAP * Math.round((s0 - r.hw.ls) / LAP);
    if (Math.abs(s - s0) > 2000) return null;
    const p = hw.point(s, r.hw.d, {});
    return { x: p.x, z: p.z, h: hw.at(s).h + r.hw.dh, s };
}
/** The saved frame of a pose: { hw } or { town, lx, lz, h }. */
function frame(p) { return p.hw ? { hw: Object.assign({}, p.hw) } : { town: p.town, lx: +p.lx.toFixed(2), lz: +p.lz.toFixed(2), h: +p.h.toFixed(3) }; }
/** Legal parking? The highway: only off it (a lot — past TUNE.hwLot). A town: the parking lane or off the street; a travel lane is not. */
function legalHere(p) {
    if (p.hw) return Math.abs(p.hw.d) > TUNE.hwLot;
    if (!p.town || !plan() || ctx.town.id !== p.town) return true;
    try {
        const n = ctx.world.road.nearest(p.x, p.z, null, {}), st = n.street;
        if (!st || st.park == null) return true;
        const ad = Math.abs(n.d);
        if (ad > st.park + 2.5) return true;
        // (a travel lane is not; the kerb is — even the POLICE / AMBULANCE ONLY stretch in front of a precinct / hospital:
        //  that's where the game itself puts her car when she walks out)
        return !(!st.parkLane || ad < st.park - 1.4);
    } catch (e) { return true; }
}
/** On Ima's lot / in her driveway (that's "home", not "left"). */
function atFamily(pose) {
    const Hm = ctx.home;
    if (!Hm || !pose.town || Hm.town !== pose.town) return false;
    try { if (Hm.isFamily && Hm.isFamily(pose.x, pose.z)) return true; } catch (e) { /* no lot yet */ }
    const p = Hm.park;
    return !!p && Math.hypot(pose.x - p.x, pose.z - p.z) < TUNE.familyR;
}

// ── where's the car she's using ──
/** Foot's record of her OWN car (not a borrowed ride's shell) while she walks. */
function ownStub() { const F = footF(); return F && F.car && F.car.key === "lulu" && F.car.stub ? F.car : null; }
function riding() { return !!((ctx.G && ctx.G.borrowed) || (ctx.foot && ctx.foot.vehicle)); }
function inOwnCar() {
    if (!ctx.car || (ctx.foot && ctx.foot.active) || riding()) return false;
    return ctx.state === "playing" || ctx.state === "worldPullOut";
}

/** She left car k at `last` (foot's stub pose): parked there, or home if that IS home. */
function leaveIt(k, last, why) {
    const p = last.pose;
    if (last.wrecked) { setRec(k, { kind: "home" }); post(fill(L.wreck, { name: nameOf(k) }), false, "Chaverim"); }   // (Chaverim tows a wreck home — free)
    else if (p.town && atFamily(p)) setRec(k, Object.assign({ kind: "home" }, frame(p)));                             // on Ima's lot: it stays where she put it
    else if (p.town || p.hw) setRec(k, Object.assign({ kind: "left", legal: last.legal !== false, day: today() }, frame(p)));
    else setRec(k, { kind: "home" });
    log("left", { key: k, why, town: p.town || null });
    // foot let go of it (she's in a borrowed ride): our parked car takes its place
    const F = footF();
    if (last.obj && T().cars.includes(last.obj) && !(F && F.car && F.car.stub === last.obj)) T().remove(last.obj);
    S.last = null;
    if (SAVE.pend) { SAVE.pend = null; saveSoon(); }
}

function track() {
    const k = sel();
    if (!owned().includes(k)) return;            // (a test drive off a dealer's lot: not one of hers — nothing to track)
    const r = rec(k);
    const fc = ownStub();
    if (fc && T().cars.includes(fc.stub)) {
        // on foot, her own car parked where she got out: it's with her, whatever the record said
        if (r.kind !== "with") setRec(k, { kind: "with" });
        const pose = poseOf(fc.stub);
        S.last = { obj: fc.stub, pose, wrecked: !fc.drivable, key: k, legal: legalHere(pose) };
        const pd = SAVE.pend;
        if ((pose.town || pose.hw) && !atFamily(pose) && fc.drivable) {
            if (!pd || pd.key !== k || !pd.at || Math.hypot(pd.x - pose.x, pd.z - pose.z) > TUNE.moved)
                { SAVE.pend = { key: k, at: frame(pose), x: +pose.x.toFixed(1), z: +pose.z.toFixed(1), legal: S.last.legal, day: today() }; saveSoon(); }
        } else if (pd) { SAVE.pend = null; saveSoon(); }
        return;
    }
    if (inOwnCar()) {
        if (r.kind !== "with") setRec(k, { kind: "with" });
        S.last = null;
        if (SAVE.pend) { SAVE.pend = null; saveSoon(); }
        return;
    }
    resolve("tick");
}
/** Foot's stub of her car is gone: decide what happened to the car (or wait for it to be clear). */
function resolve(why) {
    const last = S.last;
    if (!last) return;
    const k = last.key, r = rec(k), F = footF();
    if (k !== sel() || r.kind !== "with") { S.last = null; return; }
    const footHas = F && F.car && F.car.stub === last.obj;
    if (footHas && T().cars.includes(last.obj)) return;                     // still hers on foot
    if (ctx.impound && ctx.impound.held) { S.last = null; return; }           // the law has it (features/impound)
    if (riding()) return leaveIt(k, last, "ride");                           // she drove off in something else
    if (footHas) return leaveIt(k, last, "cleared");                         // the town was torn down round it while she walks
    if (F && !F.car) { S.last = null; return; }                              // a carless start: the law has it / the ER (it's at the hospital's kerb when it's hers)
    if (why === "title" || why === "run" || ctx.state === "title") return leaveIt(k, last, why === "run" ? "run" : "title");
    // (anything else — a cutscene, an interior — waits for the picture to settle)
}

// ── parked cars in the town she's in ──
const KIND = "cars_lulu";
function hold(dt, c) { const P = c.data.carsPose; c.speed = 0; if (P) { c.x = P.x; c.z = P.z; c.h = P.h; } }
function paint(c, k) {
    const sk = SKINS[k] || SKINS.pink, colors = { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark };
    c.obj.traverse(o => {
        if (!o.isMesh || !colors[o.material.name]) return;
        if (!o.userData.carsOwn) { o.material = o.material.clone(); o.userData.carsOwn = true; }
        o.material.color.set(colors[o.material.name]);
    });
    for (const n of [...findNodes(c.obj, "Driver"), ...findNodes(c.obj, "Hair_")]) n.visible = false;
}
function spawn(k, w) {
    if (!kindSpec(KIND)) registerKind(KIND, { len: 4.4, halfW: 0.95, circles: [1.15, -1.15], r: 0.95, mass: 3, model: "lulu" });
    const rd = ctx.world && ctx.world.road;
    if (!rd) return null;
    const near = rd.nearest(w.x, w.z, ctx.car ? ctx.car.s : 0, {});
    const c = T().add(KIND, near.s, near.d, near.d >= 0 ? 1 : -1, 0, { ai: hold, data: { carsKey: k, carsPose: { x: w.x, z: w.z, h: w.h } }, noNearMiss: true, immune: true, keep: true });
    c.free = true; c.x = w.x; c.z = w.z; c.h = w.h;
    T().place(c, 0);
    paint(c, k);
    const p = { c, key: k };
    p.rm = ctx.foot && ctx.foot.addSpot ? ctx.foot.addSpot({
        pos: () => (T().cars.includes(c) ? { x: c.x, z: c.z } : null), r: TUNE.getIn,
        label: () => fill(L.getIn, { name: nameOf(k) }), short: L.short, act: () => getIn(k),
    }) : null;
    log("spawn", { key: k });
    return p;
}
function drop(k) {
    const p = S.props[k];
    if (!p) return;
    delete S.props[k];
    if (p.rm) p.rm();
    if (T().cars.includes(p.c)) T().remove(p.c);
}
function dropAll() { for (const k of Object.keys(S.props)) drop(k); }
function herPos() { const o = ctx.foot && ctx.foot.active && ctx.foot.obj; return o ? o.position : ctx.car ? ctx.car.pos : null; }
// ── home: the cars at Ima's stand in the driveway / along her kerb ──
function homeTown() { const Hm = ctx.home; return Hm && Hm.site === "town" && Hm.ready && Hm.park ? Hm.town : null; }
/** Ima's kerb spaces (her street, by the lot): picked once with the town's own kerb finder, saved in the town's local frame. */
function kerbSlots(n) {
    const town = homeTown();
    if (!town || !plan() || ctx.town.id !== town || !ctx.town.curbSpot) return [];
    if (!SAVE.slots || SAVE.slots.town !== town || !Array.isArray(SAVE.slots.list)) SAVE.slots = { town, list: [] };
    const sl = SAVE.slots.list, park = ctx.home.park;
    for (let i = 0; sl.length < Math.min(n, TUNE.slots) && i < 30; i++) {
        const k = ctx.town.curbSpot({ near: park, minD: 5, maxD: 40 + i * 2, len: 6, still: true });
        if (!k) break;
        const l = poseOf(k);
        if (Math.hypot(k.x - park.x, k.z - park.z) < 6 || sl.some(q => Math.hypot(q.lx - l.lx, q.lz - l.lz) < 6.5)) continue;
        sl.push({ lx: +l.lx.toFixed(2), lz: +l.lz.toFixed(2), h: +l.h.toFixed(3) });
        saveSoon();
    }
    return sl;
}
/** Her own car (the one she's using) stands in Ima's driveway right now. */
function drivewayTaken() {
    const park = ctx.home.park, fc = ownStub();
    const at = fc && T().cars.includes(fc.stub) ? fc.stub : inOwnCar() ? ctx.car.pos : null;
    return !!at && Math.hypot(at.x - park.x, at.z - park.z) < 3.5;
}
function homeWants(me, want) {
    const town = homeTown();
    if (!town || ctx.town.id !== town || (ctx.state !== "footRun" && ctx.state !== "playing")) return;
    const ks = owned().filter(k => rec(k).kind === "home");
    if (!ks.length) return;
    const park = ctx.home.park, busy = drivewayTaken(), slots = kerbSlots(ks.length);
    let i = 0;
    for (const k of ks) {
        const r = rec(k);
        let w = r.town === town && r.lx != null ? worldOf(r) : null;
        if (w && busy && Math.hypot(w.x - park.x, w.z - park.z) < 3.5) w = null;     // (the car she's using has the driveway)
        if (!w && i < slots.length) w = worldOf(Object.assign({ town }, slots[i++]));
        if (w && Math.hypot(w.x - me.x, w.z - me.z) < (S.props[k] ? TUNE.far : TUNE.near)) want[k] = w;
    }
}
function syncProps() {
    const me = herPos();
    const want = {};
    if (me && ctx.world) {
        for (const k of owned()) {
            const r = rec(k);
            if (r.kind !== "left" && r.kind !== "dealer") continue;
            const w = worldOf(r);
            if (!w) continue;
            const d = Math.hypot(w.x - me.x, w.z - me.z);
            if (d < (S.props[k] ? TUNE.far : TUNE.near)) want[k] = w;
        }
        if (plan()) homeWants(me, want);
    }
    for (const k of Object.keys(S.props)) {
        const p = S.props[k], P = p.c.data.carsPose, w = want[k];
        // (out of range, moved to another spot, or a town warp cleared the road: built again below)
        if (!w || !T().cars.includes(p.c) || !P || Math.hypot(P.x - w.x, P.z - w.z) > 0.5) drop(k);
    }
    for (const k of Object.keys(want)) if (!S.props[k]) { const p = spawn(k, want[k]); if (p) S.props[k] = p; }
}

/** ✋ at a parked car of hers: the car she's using stays where it is, she drives off in this one. */
function getIn(k) {
    const p = S.props[k], F = footF();
    if (!p || !F || ctx.state !== "footRun" || !T().cars.includes(p.c)) return false;
    const cur = sel();
    if (cur !== k) {
        const cr = rec(cur), fc = ownStub();
        if (cr.kind === "with") {
            if (fc && T().cars.includes(fc.stub)) { const pose = poseOf(fc.stub); leaveIt(cur, { obj: null, pose, legal: legalHere(pose), wrecked: !fc.drivable, key: cur }, "swap"); }
            else if (ctx.impound && ctx.impound.held) setRec(cur, { kind: "impound", town: ctx.impound.held.town });
            else setRec(cur, { kind: "home" });
        }
    }
    // a borrowed ride she got out of stays a car on the street (it isn't hers to take away)
    if (F.car && F.car.key !== "lulu" && F.car.stub) { F.car.stub.keep = false; F.car = null; }
    const x = p.c.x, z = p.c.z, h = p.c.h;
    drop(k);
    setRec(k, { kind: "with" });
    S.swapping = true;
    try { equipSkin(k); } finally { S.swapping = false; }
    S.last = null;
    log("getIn", { key: k });
    emit("cars:getin", { key: k });
    if (ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(L.swap), 2.0);
    ctx.foot.hopInto({ own: true, x, z, h });
    return true;
}

// ── the hooks ──
hook("hud", dt => {
    if (!live()) { if (Object.keys(S.props).length) dropAll(); return; }
    S.t -= dt;
    if (S.t > 0) return;
    S.t = TUNE.tick;
    try {
        if (!S.migrated) migrate();
        track();
        towTick(TUNE.tick);
        syncProps();
    } catch (e) { console.error("[cars]", e); }
});

// ── Tuvia's Towing ──
function post(msg, need, from = L.tuvia) {
    try { if (ctx.phone && ctx.phone.inbox) ctx.phone.inbox.post({ from, emoji: from === L.tuvia ? L.tuviaEmoji : "🔧", color: from === L.tuvia ? "#F9A825" : "#1565C0", msg, thread: from, need: !!need }); } catch (e) { /* no phone */ }
}
const daysSince = d => { const m = /^(\d+)-(\d+)-(\d+)$/.exec(d || ""); if (!m) return 0; const t0 = new Date(+m[1], +m[2] - 1, +m[3]), n = new Date(); return Math.floor((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - t0) / 864e5); };
/** Parked by a house she owns (its door id "town:lx:lz"). */
function byOwnedHome(r) {
    if (!r.town || !ctx.realestate || !ctx.realestate.owned) return false;
    try {
        return ctx.realestate.owned().some(h => { const m = typeof h.id === "string" && /^([a-z]+):(-?[\d.]+):(-?[\d.]+)$/.exec(h.id); return !!m && m[1] === r.town && Math.hypot(+m[2] - r.lx, +m[3] - r.lz) < TUNE.atHouse; });
    } catch (e) { return false; }
}
/** The impound a tow goes to: the town's own; off a town, the town whose exit is nearest on the loop. */
function impoundTown(r) {
    if (r.town) return r.town;
    let best = null, bd = 1e12;
    for (const p of lapPlaces()) if (p.kind === "town") { const d = Math.min(ahead(p.m, r.hw.ls), ahead(r.hw.ls, p.m)); if (d < bd) { bd = d; best = p.addr.slice(8); } }
    return best || "lakewood";
}
function tow(k, why) {
    const r = rec(k);
    if (r.kind !== "left") return false;
    const town = impoundTown(r);
    drop(k); delete S.away[k];
    setRec(k, { kind: "impound", town, why: "tow", day: today() });
    log("tow", { key: k, why, town });
    emit("cars:tow", { key: k, why, town });
    emit("stat", { id: "carsTowed", n: 1 });
    const line = why === "days" ? L.towed.days : r.hw ? L.towed.highway : L.towed.zone;
    post(fill(line, { name: nameOf(k), town: townName(town), fee: TOW_FEE, from: r.town ? townName(r.town) : "the highway", days: TUNE.days }), true);
    return true;
}
/** Silly places get towed — never in front of her. */
function towTick(dt) {
    const me = herPos();
    for (const k of owned()) {
        const r = rec(k);
        if (r.kind !== "left") continue;
        if (daysSince(r.day) >= TUNE.days && !byOwnedHome(r)) { tow(k, "days"); continue; }
        if (r.legal !== false) continue;
        const here = r.hw ? !plan() : !!(plan() && ctx.town.id === r.town);
        if (!here) { tow(k, "away"); continue; }                   // she left the highway / the town
        const w = worldOf(r), near = r.hw ? TUNE.hwNear : TUNE.zoneNear, wait = r.hw ? TUNE.hwAway : TUNE.zoneAway;
        if (!w || !me) continue;
        if (Math.hypot(w.x - me.x, w.z - me.z) < near) { S.away[k] = 0; continue; }
        S.away[k] = (S.away[k] || 0) + dt;
        if (S.away[k] >= wait) tow(k, "away");
    }
}
/** 📞 Tuvia brings a LEFT car home (to Ima's kerb) → "done" | "broke" | "none". */
function deliver(k) {
    const r = SKINS[k] ? rec(k) : null;
    if (!r || r.kind !== "left") return "none";
    if (wallet.coins < TUNE.deliver || !wallet.spend(TUNE.deliver)) { S.tv.msg = fill(L.rowBroke, { fee: TUNE.deliver, have: wallet.coins }); log("broke", { key: k }); return "broke"; }
    drop(k); delete S.away[k];
    setRec(k, { kind: "home" });
    S.tv.msg = "";
    post(fill(L.delivered, { name: nameOf(k) }), true);
    emit("stat", { id: "carsDelivered", n: 1 });
    log("delivered", { key: k });
    return "done";
}
function tuviaRender(el) {
    const fee = TUNE.deliver, out = owned().filter(k => rec(k).kind === "left"), imp = owned().filter(k => rec(k).kind === "impound");
    let h = `<div class="lp-note">${L.tuviaEmoji} <b>${L.tuvia}</b> · ${fill(L.tuviaTag, { fee })}</div>`;
    if (S.tv.msg) h += `<p class="lp-note cars-tv-msg">${S.tv.msg}</p>`;
    h += out.length ? `<div class="lp-note">${L.rowHead}</div>` + out.map(k => `<button class="btn lp-row cars-tow" data-tow="${k}"><span class="lp-av">🚛</span><span class="lp-tx"><b>${S.tv.arm === k ? fill(L.rowArm, { fee }) : fill(L.rowBring, { name: nameOf(k), fee })}</b><small>${whereLine(k)}</small></span></button>`).join("")
        : `<p class="lp-empty">${L.rowNone}</p>`;
    h += imp.map(k => `<p class="lp-note">${fill(L.rowImp, { name: nameOf(k), town: townName(rec(k).town) })}</p>`).join("");
    el.innerHTML = h;
    el.querySelectorAll("[data-tow]").forEach(b => b.addEventListener("click", () => {
        const k = b.dataset.tow;
        if (S.tv.arm !== k) { S.tv.arm = k; S.tv.msg = ""; } else { S.tv.arm = null; deliver(k); }
        tuviaRender(el);
    }));
}
on("boot", () => {
    if (!ctx.enabled(ID) || !ctx.community || !ctx.community.addContact) return;
    ctx.community.addContact({ id: "towing", icon: L.tuviaEmoji, name: L.tuvia, tag: fill(L.tuviaTag, { fee: TUNE.deliver }), color: "#F9A825", render: el => { S.tv.arm = null; tuviaRender(el); } });
});

// ── Ima's minivan: no car of hers at home at the start of a day ──
on("foot:start", e => {
    if (!S.minivan || !e || e.reason !== "home" || !live()) return;
    S.minivan = false;
    try { minivan(); } catch (err) { console.error("[cars] minivan", err); }
});
function minivan() {
    const F = footF();
    if (!F || !F.car || !F.car.stub || !models[MINIVAN.key]) { log("minivanMissing"); return false; }
    const old = F.car.stub, x = old.x, z = old.z, h = old.h, kind = "cars_minivan";
    if (!kindSpec(kind)) registerKind(kind, { len: 5.0, halfW: 1.0, circles: [1.3, -1.3], r: 1.0, mass: 3.5, model: MINIVAN.key });
    if (T().cars.includes(old)) T().remove(old);
    const near = ctx.world.road.nearest(x, z, ctx.car.s, {});
    const c = T().add(kind, near.s, near.d, 1, 0, { ai: hold, data: { footStub: true, carsMinivan: true, carsPose: { x, z, h } }, noNearMiss: true, immune: true, keep: true });
    c.free = true; c.x = x; c.z = z; c.h = h;
    T().place(c, 0);
    F.car = { stub: c, drivable: true, wrecked: false, key: MINIVAN.key, colors: null, vtype: "car", handling: MINIVAN.handling };
    log("minivanOut");
    if (ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(L.minivan), 3.0);
    emit("cars:minivan", {});
    return true;
}

// ── the impound (features/impound asks) ──
/** The law walked her out of a precinct without her car: the car she was using is behind that town's fence. → its key. */
function impounded(town) {
    const k = sel(), r = rec(k);
    if (r.kind !== "with" && r.kind !== "impound") return null;
    drop(k); S.last = null;
    setRec(k, { kind: "impound", town, why: "arrest", day: today() });
    if (SAVE.pend) { SAVE.pend = null; saveSoon(); }
    return k;
}
/** A car held at an impound: the first one in `town` (else anywhere) → { key, town, why } | null. */
function held(town = null) {
    const ks = owned().filter(k => rec(k).kind === "impound");
    const k = (town && ks.find(x => rec(x).town === town)) || (town ? null : ks[0]);
    return k ? { key: k, town: rec(k).town, why: rec(k).why || "arrest" } : null;
}
/** Released at the gate: that car becomes the one she uses (the one she came in stays parked where it is). */
function fromImpound(k) {
    if (!SKINS[k]) return false;
    const cur = sel(), F = footF();
    if (cur !== k) {
        const cr = rec(cur), fc = ownStub();
        if (cr.kind === "with") {
            if (fc && T().cars.includes(fc.stub)) { const pose = poseOf(fc.stub); leaveIt(cur, { obj: null, pose, legal: legalHere(pose), wrecked: !fc.drivable, key: cur }, "impound"); }
            else setRec(cur, { kind: "home" });
        }
        S.swapping = true;
        try { equipSkin(k); } finally { S.swapping = false; }
    }
    if (F && F.car && F.car.key !== "lulu" && F.car.stub) { F.car.stub.keep = false; F.car = null; }
    setRec(k, { kind: "with" });
    S.last = null;
    log("released", { key: k });
    return true;
}
// another car picked some other way (a car just bought and driven off the lot): the one she had stays where it stands —
// parked where she got out of it (at home if that's home)
on("skin", ({ key }) => {
    if (S.swapping || !live() || !S.migrated) return;
    try { syncInv(); } catch (e) { /* keep the cache */ }
    const fc = ownStub(), stub = fc && T().cars.includes(fc.stub) ? fc.stub : null;
    for (const k of Object.keys(SAVE.cars)) {
        if (k === key || SAVE.cars[k].kind !== "with") continue;
        if (stub) { const pose = poseOf(stub); leaveIt(k, { obj: null, pose, legal: legalHere(pose), wrecked: !fc.drivable, key: k }, "skin"); }
        else setRec(k, { kind: "home" });
    }
    setRec(key, { kind: "with" });
    S.last = null;
});
// the run ended with her car parked out in a town (the title, a new day): it stays there
on("title", () => { if (live()) { try { resolve("title"); } catch (e) { console.error("[cars] title", e); } } dropAll(); });
// a new run: the car she uses comes from where her cars ARE — the one she left out there stays out there
hook("runStart", (G, opts) => {
    if (!ctx.enabled(ID) || (G && (G.mode === "dina" || G.mode === "party")) || (ctx.party && ctx.party.active)) return;
    try {
        if (!S.migrated) migrate();
        resolve("run");
        dropAll();
        S.minivan = false;
        const k = sel(), r = rec(k);
        if (r.kind === "with") return;
        // a day that starts at a house she owns (features/realestate): a car she left there
        const there = startHome();
        const atIt = there && owned().find(x => { const q = rec(x); return q.kind === "left" && q.town === there.town && Math.hypot(q.lx - there.lx, q.lz - there.lz) < TUNE.atHouse; });
        if (atIt) {
            if (atIt !== k) { S.swapping = true; try { equipSkin(atIt); } finally { S.swapping = false; } }
            setRec(atIt, { kind: "with" });
            log("pick", { key: atIt, instead: k, at: "owned" });
            return;
        }
        if (r.kind === "home") { setRec(k, { kind: "with" }); return; }
        const alt = owned().find(x => rec(x).kind === "home");
        if (alt) {
            S.swapping = true;
            try { equipSkin(alt); } finally { S.swapping = false; }
            setRec(alt, { kind: "with" });
            log("pick", { key: alt, instead: k });
            return;
        }
        // none of her cars is at home: Ima's family minivan waits in the driveway (her own stay where they are)
        S.minivan = true;
        log("minivan", { key: k, kind: r.kind });
    } catch (e) { console.error("[cars] runStart", e); }
}, 50);

/** The house a day starts at when it isn't Ima's (ctx.home.startAt, its door id "town:lx:lz") → { town, lx, lz } | null. */
function startHome() {
    const a = ctx.home && ctx.home.startAt, m = a && typeof a.key === "string" && /^([a-z]+):(-?[\d.]+):(-?[\d.]+)$/.exec(a.key);
    return m ? { town: m[1], lx: +m[2], lz: +m[3] } : null;
}

// ── 📱 🗺️ the Map: where each car is ──
function whereLine(k) {
    const r = rec(k);
    if (r.kind === "with") return ownStub() && sel() === k ? L.withFoot : L.with;
    if (r.kind === "home") return L.home;
    if (r.kind === "impound") return r.why === "tow" ? fill(L.towedAt, { town: townName(r.town), fee: TOW_FEE }) : fill(L.impound, { town: townName(r.town) });
    if (r.kind === "dealer") return fill(L.dealer, { name: r.name || "the dealer's lot" });
    if (r.kind === "left") return r.hw ? (Math.abs(r.hw.d) > TUNE.hwLot ? L.hwLot : L.hwLeft) : fill(L.left, { town: townName(r.town) });
    return "";
}
function distLine(k) {
    const r = rec(k);
    if (r.kind !== "left" && r.kind !== "impound" && r.kind !== "dealer") return "";
    const w = r.kind !== "impound" ? worldOf(r) : null, me = herPos();
    if (r.hw && !w) return miles(ahead(r.hw.ls, myLapM()));
    if (w && me) { const m = Math.hypot(w.x - me.x, w.z - me.z); return m < 1000 ? fill(L.here, { m: Math.round(m / 10) * 10 }) : `${(m / 1000).toFixed(1)} km`; }
    if (ctx.town && ctx.town.active && ctx.town.id === r.town) return "";
    const t = lapPlaces().find(p => p.addr === "hw:exit:" + r.town);
    return t ? miles(ahead(t.m, myLapM())) : L.up;
}
MAP_EXTRAS.push({
    id: "cars",
    html() {
        if (!ctx.enabled(ID) || !S.migrated) return "";
        const ks = owned();
        if (ks.length < 2 && ks.every(k => rec(k).kind === "with")) return "";
        return `<div class="lp-note"><b>${L.head}</b></div>` + ks.map(k => {
            const sk = SKINS[k];
            return `<div class="lp-row cars-row" data-car="${k}"><span class="lp-av" style="color:${sk.body}">🚗</span><span class="lp-tx"><b>${nameOf(k)}</b><small>${whereLine(k)}</small></span><span class="lp-meta">${distLine(k)}</span></div>`;
        }).join("");
    },
});

ctx.cars = {
    /** [{ key, name, kind, town?, where }] for every car she owns. */
    list() { return owned().map(k => Object.assign({ key: k, name: nameOf(k), where: whereLine(k) }, rec(k))); },
    where(k) { return SKINS[k] ? Object.assign({}, rec(k)) : null; },
    /** Ima's kerb spaces (local frame) — features/shops' old picker steps aside while cars stand there. */
    get slots() { return SAVE.slots ? SAVE.slots.list.slice() : []; },
    atHome(k) { const r = SKINS[k] ? rec(k) : null; return !!r && (r.kind === "home" || r.kind === "with"); },
    /** Someone else decides where a car is (ci/dealers: the old car waits on the lot). rec { kind: "left" | "home" | "dealer" |
     *  "impound", name?, … } + where: { x, z, h } in WORLD coords where it stands now (turned into the right frame here), or a
     *  frame already ({ town, lx, lz, h } / { hw }). */
    leaveAt(k, r) {
        if (!SKINS[k] || !r || !r.kind) return false;
        const o = Object.assign({ day: today() }, r);
        if (o.x != null && o.lx == null && !o.hw) { Object.assign(o, frame(poseOf({ x: o.x, z: o.z, h: o.h || 0 }))); delete o.x; delete o.z; }
        if (k === sel() && o.kind !== "with") S.last = null;
        setRec(k, o);
        return true;
    },
    /** The frame a world spot would be saved in ({ town, lx, lz, h } | { hw }). */
    frameOf: (x, z, h = 0) => frame(poseOf({ x, z, h })),
    getIn, held, impounded, fromImpound, deliver, tow,
    get minivan() { return S.minivan; },
    debug: { S, SAVE, rec, migrate, track, resolve, syncProps, towTick, worldOf, poseOf, kerbSlots, startHome, legalHere, daysSince },
};
