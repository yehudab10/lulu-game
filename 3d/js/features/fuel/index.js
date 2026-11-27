// ─────────────────────────────────────────────────────────────────────────
//  features/fuel — ⛽ GAS (+ 🔋 charging, step 2). The owner, 2026-11-27: "maybe we should even add real gas station
//  filling for cars and electric charging … clever enough in a way where it's a real necessary thing but doesn't become a
//  huge burden to players". The approved plan: a gauge you glance at once or twice a session — a tank lasts about an
//  hour of normal play, every stop is a few seconds with no menu, running dry is a short detour, never a fail.
//
//  STEP 1 (this file):
//  • every car she owns has its own tank (the 3D save, `fuel.cars[skinKey]`, 0..1; a car never seen yet = FULL, so old
//    saves and a new car from any dealer start full). A borrowed / hotwired ride gets a random level (data.js BORROWED),
//    kept for that ride. Dina's mode, the minigames, Ima's minivan: no gauge.
//  • it drains with DISTANCE only (data.js RANGE: km a tank per car class — the Mazelatis drink more); idling, parked,
//    walking, cutscenes cost nothing; nitro burns NITRO_BURN × while it's lit.
//  • the gauge: a thin bar under the speedo (⛽, 🔋 in an EV), amber below LOW + one quiet objective-line badge.
//  • filling: drive into a pump's bay and stop — Yanky's Gas 'n' Go, the rest areas' pumps (their visits already exist:
//    world:visit) or the gas station at each town's interchange (a pad by its canopy) → full in TIME.fill s, paid pro
//    rata (PRICE); short of coins → what she can pay for; at 0 coins → a quarter tank on account (one IOU at a time,
//    paid off at the next paid fill). Never below 0 (garage/buy.js buyExtra).
//  • the pumps are on the 📱 🗺️ Map (ctx.pins, "help").
//  Later steps: 🔋 chargers + the home charger (2); the reserve, coasting dry, the jerrycan, Chaverim / Tuvia, the job
//  warnings, self-drive to a pump (3).
//
//  ctx.fuel { level(key?), set(key, v), range(key?), key(), fill(why), gauge, debug }   events fuel:fill {key, from, to, cost, iou}
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, emit, css } from "../../core/ctx.js";
import { store, saveSoon, wallet } from "../../core/save.js";
import * as H from "../../hud.js";
import { SKINS } from "../../car.js";
import { buyExtra } from "../garage/buy.js";
import { X, X_IN, XW } from "../town/exit.js";
import { RANGE, NITRO_BURN, PRICE, IOU, TIME, LOW, BORROWED, PUMPS, PINS, NO_GAUGE, L } from "./data.js";

export const FS = store("fuel", { cars: {}, iou: 0, fills: 0, km: 0 });
const F = { ride: new Map(), anim: null, pad: { armed: true, t: 0 }, ui: null, fill: null, chip: null, chipTxt: "", log: [] };
function log(ev, d = {}) { F.log.push(Object.assign({ ev, t: +(ctx.time || 0).toFixed(1) }, d)); if (F.log.length > 40) F.log.shift(); }

// ── which tank, how big ──
/** The tank she's using now: her car's skin key, "ride:<kind>" for a borrowed ride, or "" (no gauge here). */
export function key() {
    const G = ctx.G, car = ctx.car;
    if (!G || !car || G.mode === "dina") return "";
    const r = ctx.streets && ctx.streets.ride;
    if (r) return NO_GAUGE.has(r.kind) ? "" : "ride:" + r.kind;
    const k = car.skinKey || "pink";
    return NO_GAUGE.has(k) ? "" : k;
}
const isEV = k => !!(SKINS[k] && SKINS[k].ev);
/** km a full tank goes for car k. */
export function range(k = key()) {
    if (!k) return Infinity;
    if (RANGE[k]) return RANGE[k];
    const sk = SKINS[k] || {};
    if (sk.ev) return RANGE.ev;
    if (sk.marque === "mazelati") return RANGE.lux;
    return RANGE.base;
}
/** A full tank's price for car k (pro rata below). */
function price(k) {
    if (isEV(k)) return PRICE.charge;
    if (PRICE[k]) return PRICE[k];
    return (SKINS[k] || {}).marque === "mazelati" ? PRICE.lux : PRICE.gas;
}
export function level(k = key()) {
    if (!k) return 1;
    if (k.startsWith("ride:")) {
        if (!F.ride.has(k)) F.ride.set(k, BORROWED[0] + Math.random() * (BORROWED[1] - BORROWED[0]));
        return F.ride.get(k);
    }
    const v = FS.cars[k];
    return typeof v === "number" && v >= 0 ? Math.min(1, v) : 1;
}
export function set(k, v) {
    if (!k) return;
    v = Math.max(0, Math.min(1, v));
    if (k.startsWith("ride:")) F.ride.set(k, v); else { FS.cars[k] = +v.toFixed(5); saveSoon(); }
}
// a borrowed ride is a new tank each time (another car, another level)
on("streets:carjack", () => F.ride.clear());
on("foot:start", () => { F.pad.armed = true; });

// ── the drain: distance only ──
let saveT = 0;
hook("update", (dt, P, controlsOn) => {
    if (!controlsOn || ctx.state !== "playing" || !ctx.car) return;
    const k = key();
    if (!k) return;
    const m = Math.abs(ctx.car.speed || 0) * dt;
    if (m <= 0.001) return;
    const burn = m / 1000 / range(k) * (ctx.G.boosting ? NITRO_BURN : 1);
    const v = level(k);
    if (v <= 0) return;
    if (k.startsWith("ride:")) F.ride.set(k, Math.max(0, v - burn));
    else { FS.cars[k] = Math.max(0, v - burn); if ((saveT += dt) > 5) { saveT = 0; saveSoon(); } }
    FS.km += m / 1000;
});

// ── filling up ──
/** Fill her current tank (a pump's visit / the town pad). → { ok, to, cost, iou } */
export function fill(why = "pump") {
    const k = key();
    if (!k) return { ok: false, why: "none" };
    const from = level(k), need = 1 - from;
    if (need < 0.01) { H.toast(L.full, "", { key: "fuel" }); return { ok: false, why: "full" }; }
    const full = price(k);
    let cost = Math.max(1, Math.ceil(need * full)), to = 1, iou = 0;
    if (wallet.coins < cost) {
        if (wallet.coins > 0) { cost = wallet.coins; to = Math.min(1, from + cost / full); }
        else if (!FS.iou) { cost = 0; to = Math.min(1, from + IOU); iou = Math.max(1, Math.ceil(IOU * full)); }
        else { cost = 0; to = from; }
    }
    if (cost > 0) { const r = buyExtra("fuel", k, cost); if (!r.ok) { cost = 0; to = from; } }
    if (iou) FS.iou = iou;
    // last time's IOU, paid off now if she can
    let paidIou = 0;
    if (!iou && cost > 0 && FS.iou && wallet.coins >= FS.iou && buyExtra("fuel", "iou", FS.iou).ok) { paidIou = FS.iou; FS.iou = 0; }
    if (to <= from + 1e-4) { H.toast(L.owed, "", { key: "fuel" }); return { ok: false, why: "owed" }; }
    // the gauge climbs over TIME.fill s (the money's already gone: no take-backs)
    F.anim = { k, from, to, t: 0 };
    FS.fills++;
    saveSoon();
    H.toast(iou ? L.iou : L.filled(to, cost) + (paidIou ? " " + L.iouPaid(paidIou) : ""), "gold", { key: "fuel" });
    emit("fuel:fill", { key: k, from: +from.toFixed(3), to: +to.toFixed(3), cost, iou, why });
    log("fill", { k, from: +from.toFixed(3), to: +to.toFixed(3), cost, iou, why });
    return { ok: true, to, cost, iou };
}
hook("hud", dt => {
    const a = F.anim;
    if (!a) return;
    a.t += dt;
    const f = Math.min(1, a.t / TIME.fill);
    set(a.k, a.from + (a.to - a.from) * f);
    if (f >= 1) F.anim = null;
});
// the existing drive-up bays: Yanky's Gas 'n' Go (world) + the rest areas' pumps (exits)
on("world:visit", e => { if (e && PUMPS.bays.includes(e.id)) fill(e.id); });
// the gas station at each town's interchange T (exitbuild.js: its canopy at u = X_IN + XW + 15, d = 64): stop on the cross
// road alongside it (data.js PUMPS.towns)
const _w = {};
function townPad() {
    const hw = ctx.world && (ctx.world.highway || ctx.world.road), car = ctx.car;
    if (!hw || !car || !X.exits.length) return null;
    for (const e of X.exits) {
        hw.point(e.s + X_IN + XW, PUMPS.towns.d, _w);
        const d = Math.hypot(car.pos.x - _w.x, car.pos.z - _w.z);
        if (d < 40) return { e, d, x: _w.x, z: _w.z };
    }
    return null;
}
hook("hud", dt => {
    if (ctx.state !== "playing" || !ctx.car || !key()) return;
    if ((F.padT = (F.padT || 0) - dt) > 0) return;
    F.padT = 0.2;
    const p = townPad();
    if (!p || p.d > PUMPS.towns.pad) { F.pad.armed = true; F.pad.t = 0; return; }
    if (Math.abs(ctx.car.speed) > 0.6) { F.pad.t = 0; return; }
    if (!F.pad.armed) return;
    if ((F.pad.t += 0.2) >= 0.6) { F.pad.armed = false; fill("town"); }
});

// ── the gauge (under the speedo) + the low badge ──
css("fuel", `
.speedo .fuel-row { display: flex; align-items: center; gap: 4px; margin-top: 3px; }
.speedo .fuel-row b { font-size: 11px; line-height: 1; }
.speedo .fuel { flex: 1; height: 5px; border-radius: 3px; background: rgba(0,0,0,.18); overflow: hidden; }
.speedo .fuel i { display: block; height: 100%; width: 100%; background: #43A047; border-radius: 3px; transition: width .25s linear; }
.speedo .fuel-row.low .fuel i { background: #FFA000; }
.speedo .fuel-row.empty .fuel i { background: #E53935; }
.speedo .fuel-row.hidden { display: none; }
`);
function ui() {
    if (F.ui && F.ui.row.isConnected) return F.ui;
    const sp = document.querySelector("#hud .speedo");
    if (!sp) return null;
    const row = document.createElement("div");
    row.className = "fuel-row hidden";
    row.innerHTML = `<b>⛽</b><div class="fuel"><i></i></div>`;
    sp.appendChild(row);
    F.ui = { row, ic: row.querySelector("b"), bar: row.querySelector("i"), w: "", cls: "", icon: "" };
    return F.ui;
}
let uiT = 0;
hook("hud", dt => {
    if ((uiT -= dt) > 0) return;
    uiT = 0.25;
    const u = ui();
    if (!u) return;
    const k = (ctx.state === "playing" || ctx.state === "parking") ? key() : "";
    const v = k ? level(k) : 1;
    const cls = !k ? "hidden" : v <= 0.001 ? "empty" : v < LOW ? "low" : "";
    if (cls !== u.cls) { u.cls = cls; u.row.className = "fuel-row " + cls; }
    const w = (v * 100).toFixed(0) + "%";
    if (w !== u.w) { u.w = w; u.bar.style.width = w; }
    const icon = k && isEV(k) ? "🔋" : "⛽";
    if (icon !== u.icon) { u.icon = icon; u.ic.textContent = icon; }
    // the badge: one quiet line on the objective line while she's low
    const txt = k && v < LOW ? `${v <= 0.001 ? L.empty.replace(/^⛽ /, "") : L.low.replace(/^⛽ /, "")} · ${Math.round(v * range(k))} km left` : "";
    if (!F.chip && txt) {
        F.chip = document.createElement("div");
        F.chip.className = "fuel-chip";
        H.hudSlot("left").appendChild(F.chip);
        H.objective(F.chip, { prio: H.OBJ.info, id: "fuel", icon });
    }
    if (F.chip && F.chipTxt !== txt) { F.chipTxt = txt; F.chip.innerHTML = txt; F.chip.classList.toggle("hidden", !txt); }
});

// ── the ⛽ places on the 📱 Map ──
on("boot", () => {
    try { if (ctx.pins && ctx.pins.add) for (const p of PINS) ctx.pins.add({ id: p.id, lap: p.lap, cat: "help", icon: "⛽", name: p.name, sub: p.sub, group: "highway" }); } catch (e) { /* no pins */ }
});

ctx.fuel = {
    level, set, range, key, fill,
    get gauge() { return F.ui ? { w: F.ui.w, cls: F.ui.cls, icon: F.ui.icon } : null; },
    debug: { FS, F, townPad, price, pads: (dd = 0) => { const hw = ctx.world.highway || ctx.world.road; return X.exits.map(e => { const u = X_IN + XW + dd, p = hw.point(e.s + u, PUMPS.towns.d, {}); return { s: e.s, hs: e.s + u, hd: PUMPS.towns.d, x: p.x, z: p.z, h: p.h }; }); } },
};
