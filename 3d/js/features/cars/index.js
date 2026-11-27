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
// The highway / a rest area: today it goes home (stage 3: Tuvia tows it).
//
// ctx.cars { list(), where(key), atHome(key), leaveAt(key, rec), getIn(key), debug }
// events cars:change { key, kind }
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { findNodes } from "../../models.js";
import { registerKind, kindSpec } from "../../traffic.js";
import { inv, syncInv } from "../garage/data.js";
import { equipSkin } from "../garage/buy.js";
import { MAP_EXTRAS } from "../phone/apps.js";
import { lapPlaces, myLapM, ahead, miles } from "../world/lapmap.js";
import { ID, TUNE, L } from "./data.js";

export const SAVE = store(ID, { v: 1, cars: {}, pend: null, slots: null });
const S = { t: 0, last: null, props: {}, swapping: false, migrated: false, log: [] };
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
    if (p && p.key && SAVE.cars[p.key] && SAVE.cars[p.key].kind === "with" && p.town) {
        SAVE.cars[p.key] = { kind: "left", town: p.town, lx: p.lx, lz: p.lz, h: p.h, day: p.day || today() };
        log("reload", { key: p.key, town: p.town });
    }
    SAVE.pend = null;
    S.migrated = true;
    saveSoon();
}

// ── town frame ──
function plan() { const Tn = ctx.town; return Tn && Tn.active ? Tn.plan : null; }
function poseOf(c) {
    const P = plan();
    if (!P) return { town: null, x: c.x, z: c.z };
    const dx = c.x - P.ORIGIN.x, dz = c.z - P.ORIGIN.z;
    return { town: ctx.town.id, lx: dx * P.COS - dz * P.SIN, lz: dx * P.SIN + dz * P.COS, h: c.h - P.ROT, x: c.x, z: c.z };
}
function worldOf(r) {
    const P = plan();
    if (!P || ctx.town.id !== r.town) return null;
    return { x: P.ORIGIN.x + r.lx * P.COS + r.lz * P.SIN, z: P.ORIGIN.z - r.lx * P.SIN + r.lz * P.COS, h: r.h + P.ROT };
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
    if (last.wrecked || !p.town) setRec(k, { kind: "home" });                       // (stage 3: the highway / a wreck → Tuvia's tow)
    else if (atFamily(p)) setRec(k, { kind: "home", town: p.town, lx: +p.lx.toFixed(2), lz: +p.lz.toFixed(2), h: +p.h.toFixed(3) });   // on Ima's lot: it stays where she put it
    else setRec(k, { kind: "left", town: p.town, lx: +p.lx.toFixed(2), lz: +p.lz.toFixed(2), h: +p.h.toFixed(3), day: today() });
    log("left", { key: k, why, town: p.town || null });
    // foot let go of it (she's in a borrowed ride): our parked car takes its place
    const F = footF();
    if (last.obj && T().cars.includes(last.obj) && !(F && F.car && F.car.stub === last.obj)) T().remove(last.obj);
    S.last = null;
    if (SAVE.pend) { SAVE.pend = null; saveSoon(); }
}

function track() {
    const k = sel(), r = rec(k);
    const fc = ownStub();
    if (fc && T().cars.includes(fc.stub)) {
        // on foot, her own car parked where she got out: it's with her, whatever the record said
        if (r.kind !== "with") setRec(k, { kind: "with" });
        const pose = poseOf(fc.stub);
        S.last = { obj: fc.stub, pose, wrecked: !fc.drivable, key: k };
        const pd = SAVE.pend;
        if (pose.town && !atFamily(pose) && fc.drivable) {
            if (!pd || pd.key !== k || pd.town !== pose.town || Math.hypot(pd.lx - pose.lx, pd.lz - pose.lz) > TUNE.moved)
                { SAVE.pend = { key: k, town: pose.town, lx: +pose.lx.toFixed(2), lz: +pose.lz.toFixed(2), h: +pose.h.toFixed(3), day: today() }; saveSoon(); }
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
    if (F && !F.car) { S.last = null; return; }                              // a carless start (the ER, a jailbreak): stage 3
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
    if (me && plan()) {
        for (const k of owned()) {
            const r = rec(k);
            if (r.kind !== "left") continue;
            const w = worldOf(r);
            if (!w) continue;
            const d = Math.hypot(w.x - me.x, w.z - me.z);
            if (d < (S.props[k] ? TUNE.far : TUNE.near)) want[k] = w;
        }
        homeWants(me, want);
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
            if (fc && T().cars.includes(fc.stub)) leaveIt(cur, { obj: null, pose: poseOf(fc.stub), wrecked: !fc.drivable, key: cur }, "swap");
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
        syncProps();
    } catch (e) { console.error("[cars]", e); }
});
// another car picked some other way (the 🔑 garage picker, a car just bought): the one she had stays — at home for now
on("skin", ({ key }) => {
    if (S.swapping || !live() || !S.migrated) return;
    try { syncInv(); } catch (e) { /* keep the cache */ }
    for (const k of Object.keys(SAVE.cars)) if (k !== key && SAVE.cars[k].kind === "with") setRec(k, { kind: "home" });
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
        // (stage 1: the impound's own rule — a new run, the car's home again; stage 3 keeps it there)
        for (const x of owned()) if (rec(x).kind === "impound") setRec(x, { kind: "home" });
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
        // (stage 1: no other car at home — hers comes home with her, as before; stage 3: Ima's minivan)
        setRec(k, { kind: "with" });
        log("fallback", { key: k });
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
    if (r.kind === "impound") return fill(L.impound, { town: townName(r.town) });
    if (r.kind === "left") return fill(L.left, { town: townName(r.town) });
    return "";
}
function distLine(k) {
    const r = rec(k);
    if (r.kind !== "left" && r.kind !== "impound") return "";
    const w = r.kind === "left" ? worldOf(r) : null, me = herPos();
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
    /** Someone else decides where a car is (features/shops' dealer: the old car waits on the lot). rec { kind, town, lx, lz, h, … }. */
    leaveAt(k, r) { if (!SKINS[k] || !r || !r.kind) return false; setRec(k, Object.assign({ day: today() }, r)); return true; },
    getIn,
    debug: { S, SAVE, rec, migrate, track, resolve, syncProps, worldOf, poseOf, kerbSlots, startHome },
};
