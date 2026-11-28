// features/dealers/config.js — ⚡ THE TUSHLA CONFIGURATOR (the owner, 2026-11-27: "The tushla dealership should also be
// more of a Tesla experience" — a parody, as it is). No salesmen, ever: everything happens on one big white screen.
//   • pick the MODEL (the cars on the floor), then PAINT · WHEELS · INTERIOR · HORN (data.js EV_CONFIG) — the car on its
//     plinth wears the choice right away (a live preview), the PRICE updates live; ⚡ Full Schlep Driving is an add-on
//     on the same screen; 🏠 the home charger too (features/fuel, when it's there).
//   • ORDER — a fixed price, no haggling, two taps (garage/buy.js: buyCar + one buyExtra per option); then the DELIVERY:
//     the car rolls out of the showroom by itself ("Nobody was in it. This is normal.") and a software-update joke.
//   • 🔑 TEST DRIVE from the screen: she's seated in it on the forecourt for EV_CONFIG.testSecs s of driving; then an
//     "over-the-air update" turns it back into her own car, wherever she is.
//   • An owned Tushla: the same screen re-configures it (only new options cost anything) or puts her in it.
//   Every number + name in data.js; a screen card (H.showScreen): a phone (portrait / landscape), the TV, a controller.
import * as THREE from "three";
import { ctx, on, hook, emit, css } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { SKINS } from "../../car.js";
import { inv, syncInv, STAT_ROWS } from "../garage/data.js";
import { owns, equipSkin, buyCar, buyExtra, carAway } from "../garage/buy.js";
import { EV_CARS, EV_IDS, EV_CONFIG, SUB, ZEV, EV } from "./data.js";
import { DS } from "./perks.js";
import { schlep } from "./schlep.js";
import { score10 } from "./lux.js";

const fmt = n => Math.round(n).toLocaleString("en-US");
const pick = a => a[Math.floor(Math.random() * a.length)];
const GROUPS = ["paint", "wheels", "interior", "horn"];
const NAMES = { paint: "Paint", wheels: "Wheels", interior: "Interior", horn: "Horn" };
export const CF = { open: false, id: null, cfg: null, schlep: false, armed: false, msg: "", E: null, roll: null, td: null, log: [] };
if (!DS.evCfg) DS.evCfg = {};
if (!DS.evPaid) DS.evPaid = {};
const opt = (g, id) => EV_CONFIG[g].find(o => o.id === id) || EV_CONFIG[g][0];
const cfgOf = id => Object.assign({ paint: "stock", wheels: "bagel", interior: "black", horn: "chime" }, DS.evCfg[id] || {});
const paid = (id, g, o) => !o.price || (DS.evPaid[id] || []).includes(g + ":" + o.id);

// ── what a car wears (the real car + the preview on the plinth) ──
const _c = new THREE.Color();
export function applyCfg(model, cfg) {
    if (!model || !cfg) return;
    const P = opt("paint", cfg.paint), W = opt("wheels", cfg.wheels), I = opt("interior", cfg.interior);
    model.traverse(o => {
        if (!o.isMesh || !o.material || !o.material.name) return;
        const n = o.material.name;
        const own = () => { if (!o.material.userData.cfgOwn) { o.material = o.material.clone(); o.material.userData.cfgOwn = true; } };
        if (P.hex && /^Body(Light|Dark)?$/.test(n)) { own(); _c.set(P.hex); if (n === "BodyLight") _c.offsetHSL(0, 0, 0.12); if (n === "BodyDark") _c.offsetHSL(0, 0, -0.14); o.material.color.copy(_c); }
        if (/Seat|Interior|Upholst/i.test(n)) { own(); o.material.color.set(I.hex); }
    });
    model.traverse(o => { if (o.name && /^Wheel_/.test(o.name)) o.traverse(m => { if (m.isMesh && m.material && !/Tire|Tyre|Rubber/i.test(m.material.name || "")) { if (!m.material.userData.cfgOwn) { m.material = m.material.clone(); m.material.userData.cfgOwn = true; } m.material.color.set(W.hex); } }); });
}
// her own Tushlas wear their configuration (car.js runs the kit on every setSkin)
export function wrapKit(KITS) {
    const base = KITS.tushla;
    KITS.tushla = (model, anchors, sk) => { base(model, anchors, sk); if (sk && sk.evKey && DS.evCfg[sk.evKey]) applyCfg(model, cfgOf(sk.evKey)); };
}
// 💨 Whoopee Mode: her own horn in a Tushla that has it (a short, PG raspberry; the world reacts as to any honk)
on("honk", () => {
    const k = ctx.car && ctx.car.skinKey;
    if (!k || !EV_IDS.includes(k) || cfgOf(k).horn !== "whoopee" || !owns("car", k)) return;
    import("../parking/sfx.js").then(m => { m.tone(140, 0.22, "sawtooth", 0.07); setTimeout(() => m.tone(95, 0.18, "sawtooth", 0.06), 140); }).catch(() => {});
});

// ── the price ──
function lines(id = CF.id, cfg = CF.cfg) {
    const out = [];
    if (!owns("car", id)) out.push({ what: EV_CARS[id].name, price: EV_CARS[id].price });
    for (const g of GROUPS) { const o = opt(g, cfg[g]); if (o.price && !paid(id, g, o)) out.push({ what: `${NAMES[g]}: ${o.name}`, price: o.price, g, o }); }
    if (CF.schlep && !schlep.active()) out.push({ what: "⚡ Full Schlep Driving (30 days)", price: SUB.price, sub: true });
    return out;
}
export const total = (id, cfg) => lines(id, cfg).reduce((a, l) => a + l.price, 0);

// ── the screen ──
css("dealers-config", `
#screenCard.card.tsl-card { width: min(900px, calc(100vw - 24px)); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); overflow-y: auto; padding: 18px 22px 14px;
  background: #FFFFFF; color: #171A20; border-radius: 14px; border: 1px solid #E4E6EA; box-shadow: 0 18px 50px rgba(0,0,0,.25); font-family: Helvetica, Arial, sans-serif; }
.tsl-brand { letter-spacing: .5em; font-size: 12px; font-weight: 700; color: #171A20; text-align: center; }
.tsl-model { font-size: 32px; font-weight: 500; text-align: center; margin: 4px 0 2px; }
.tsl-sub { text-align: center; font-size: 13px; color: #5C5E62; margin-bottom: 10px; }
.tsl-specs { display: flex; justify-content: center; gap: 22px; margin: 4px 0 12px; flex-wrap: wrap; }
.tsl-specs div { text-align: center; } .tsl-specs b { display: block; font-size: 22px; font-weight: 500; } .tsl-specs small { font-size: 11px; color: #5C5E62; }
.tsl-g { text-align: left; margin: 10px 0 2px; font-size: 12px; font-weight: 700; color: #5C5E62; letter-spacing: .08em; text-transform: uppercase; }
.tsl-g span { font-weight: 400; text-transform: none; letter-spacing: 0; color: #171A20; margin-left: 6px; }
.tsl-opts { display: flex; flex-wrap: wrap; gap: 8px; }
#screenCard.tsl-card .tsl-opts .btn { width: auto; flex: 0 0 auto; margin: 0; display: inline-flex; align-items: center; }
.tsl-opts .btn { min-height: 0; padding: 7px 12px; font-size: 13px; background: #F4F4F4; color: #171A20; border: 2px solid transparent; border-radius: 8px; box-shadow: none; font-weight: 500; }
.tsl-opts .btn.on { border-color: #3E6AE1; background: #FFFFFF; }
.tsl-opts .btn.focus { outline: 3px solid #3E6AE1; outline-offset: 2px; }
.tsl-opts .btn i { display: inline-block; width: 18px; height: 18px; border-radius: 50%; vertical-align: -4px; margin-right: 6px; border: 1px solid rgba(0,0,0,.15); }
.tsl-opts .btn em { font-style: normal; color: #5C5E62; margin-left: 6px; font-size: 12px; }
.tsl-sum { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-top: 14px; border-top: 1px solid #E4E6EA; padding-top: 10px; }
.tsl-sum span { font-size: 13px; color: #5C5E62; } .tsl-sum b { font-size: 26px; font-weight: 500; }
.tsl-msg { font-size: 13px; color: #3E6AE1; min-height: 18px; margin-top: 4px; text-align: center; }
.tsl-post { font-size: 12px; color: #5C5E62; text-align: center; margin-top: 4px; }
#screenCard.tsl-card .menu { flex-direction: row; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
#screenCard.tsl-card .menu .btn { border-radius: 6px; box-shadow: none; }
#screenCard.tsl-card .menu .btn.tsl-order { background: #3E6AE1; color: #FFFFFF; font-weight: 700; }
#screenCard.tsl-card .menu .btn.secondary { background: #F4F4F4; color: #171A20; }
@media (max-width: 560px) { .tsl-model { font-size: 26px; } #screenCard.card.tsl-card { padding: 14px 12px 10px; } .tsl-specs { gap: 14px; } .tsl-specs b { font-size: 18px; } }
@media (max-height: 480px) { #screenCard.card.tsl-card { padding: 8px 14px 6px; } .tsl-model { font-size: 22px; margin: 0; } .tsl-sub { margin-bottom: 2px; font-size: 12px; } .tsl-specs { margin: 2px 0 4px; }
  .tsl-specs b { font-size: 16px; } .tsl-g { margin: 4px 0 1px; } .tsl-opts .btn { padding: 4px 9px; font-size: 12px; } .tsl-sum { margin-top: 6px; padding-top: 5px; } .tsl-sum b { font-size: 20px; } .tsl-post { display: none; } }
body.tv #screenCard.card.tsl-card { width: min(1200px, calc(100vw - 80px)); } body.tv .tsl-model { font-size: 48px; } body.tv .tsl-opts .btn { font-size: 18px; padding: 10px 16px; } body.tv .tsl-sum b { font-size: 36px; }
`);
function html() {
    const id = CF.id, c = EV_CARS[id], sk = SKINS[id], cfg = CF.cfg, own = owns("car", id), L = lines(), tot = L.reduce((a, l) => a + l.price, 0);
    const specs = STAT_ROWS.map(([lab, key]) => `<div><b>${score10(sk[key]).toFixed(1)}</b><small>${lab.toLowerCase()}</small></div>`).join("");
    const models = EV_IDS.map(k => `<button class="btn nav${k === id ? " on" : ""}" id="tsl-m-${k}" data-tm="${k}">${EV_CARS[k].name}<em>${owns("car", k) ? "✓ yours" : fmt(EV_CARS[k].price) + " 💰"}</em></button>`).join("");
    const group = g => `<div class="tsl-g">${NAMES[g]}<span>${opt(g, cfg[g]).name}</span></div><div class="tsl-opts">${EV_CONFIG[g].map(o => {
        const sw = o.hex ? `<i style="background:${o.hex}"></i>` : g === "paint" ? `<i style="background:${sk.body}"></i>` : "";
        const pr = !o.price || paid(id, g, o) ? (o.price ? "✓" : "") : `+${fmt(o.price)}`;
        return `<button class="btn nav${cfg[g] === o.id ? " on" : ""}" id="tsl-${g}-${o.id}" data-tg="${g}" data-to="${o.id}">${sw}${o.name}${pr ? `<em>${pr}</em>` : ""}</button>`;
    }).join("")}</div>`;
    const sub = schlep.active() ? `<button class="btn nav on" id="tsl-sub" data-tsub="1">⚡ Full Schlep Driving<em>✓ active · renews in ${schlep.daysLeft()} days</em></button>`
        : `<button class="btn nav${CF.schlep ? " on" : ""}" id="tsl-sub" data-tsub="1">⚡ Full Schlep Driving<em>${CF.schlep ? "✓ added" : `+${SUB.price} / ${SUB.days} days`}</em></button>`;
    const FU = ctx.fuel, homeBtn = FU && FU.buyHome && FU.HOME ? `<button class="btn nav${FU.home ? " on" : ""}" id="tsl-home" data-thome="1">🏠 Home charger<em>${FU.home ? "✓ installed" : `+${fmt(FU.HOME.price)}`}</em></button>` : "";
    return `<div class="tsl">
      <div class="tsl-brand">${(EV.full || "TUSHLA").toUpperCase().includes("TUSHLA") ? "T U S H L A" : EV.full}</div>
      <div class="tsl-model">${c.name}</div>
      <div class="tsl-sub">${own ? "Yours. Configure it, or just drive it." : "Order online. No salesmen. No haggling. Delivery: today (it drives itself over)."}</div>
      <div class="tsl-specs">${specs}</div>
      <div class="tsl-g">Model</div><div class="tsl-opts">${models}</div>
      ${GROUPS.map(group).join("")}
      <div class="tsl-g">Add-ons</div><div class="tsl-opts">${sub}${homeBtn}</div>
      <div class="tsl-sum"><span>${L.length ? L.map(l => l.what).join(" · ") : own ? "Nothing new to pay for" : ""}</span><b>${tot ? fmt(tot) + " 💰" : own ? "✓" : "0 💰"}</b></div>
      <div class="tsl-msg">${CF.msg || ""}</div>
      <div class="tsl-post">📱 ${ZEV.name}: “${CF.post}”</div>
    </div>`;
}
/** Open the screen on model `id` (✋ the tablet / a car on the floor). */
export function openConfig(id) {
    if (H.screenOpen() || !ctx.foot || !ctx.foot.script) return false;
    syncInv();
    id = EV_IDS.includes(id) ? id : EV_IDS.find(k => !owns("car", k)) || EV_IDS[0];
    Object.assign(CF, { open: true, id, cfg: cfgOf(id), schlep: false, armed: false, msg: "", post: pick(ZEV.posts) });
    paint("tsl-m-" + id);
    CF.log.push({ ev: "open", id });
    return ctx.foot.script({ update(dt, P) { if (!CF.open) return false; if (!H.screenOpen() || !H.screenCard().querySelector(".tsl")) { CF.open = false; preview(null); return false; } H.menuInput(P); return CF.open; } });
}
function paint(focus = null) {
    const id = CF.id, own = owns("car", id), tot = total(id, CF.cfg);
    const keep = focus || (H.screenCard().querySelector(".focus") || {}).id || null;
    const orderLabel = own ? (tot ? (CF.armed ? `Tap again — ${fmt(tot)} 💰` : `Update — ${fmt(tot)} 💰`) : (inv.selectedSkin === id ? "✓ Driving it" : "🔑 Drive this one"))
        : (CF.armed ? `Tap again to order — ${fmt(tot)} 💰` : `Order — ${fmt(tot)} 💰`);
    const btns = [];
    if (!own) btns.push({ label: `🔑 Test drive (${EV_CONFIG.testSecs} s)`, id: "tslTest", cls: "secondary", action: () => testDrive(id) });
    btns.push({ label: orderLabel, id: "tslOrder", cls: "tsl-order", action: () => order() });
    btns.push({ label: `Close ${glyph("back")}`, id: "tslClose", cls: "secondary", action: () => close() });
    const card = H.showScreen(html(), btns, { onBack: () => close(), onTab: d => model(d), focus: keep || 0, cls: "tsl-card" });
    for (const b of card.querySelectorAll("[data-tm]")) b.addEventListener("click", () => setModel(b.dataset.tm));
    for (const b of card.querySelectorAll("[data-tg]")) b.addEventListener("click", () => choose(b.dataset.tg, b.dataset.to));
    for (const b of card.querySelectorAll("[data-tsub]")) b.addEventListener("click", () => { if (!schlep.active()) { CF.schlep = !CF.schlep; CF.armed = false; paint(); } });
    for (const b of card.querySelectorAll("[data-thome]")) b.addEventListener("click", () => homeCharger());
    preview(CF.cfg);
}
function setModel(k) { if (!EV_IDS.includes(k)) return; preview(null); Object.assign(CF, { id: k, cfg: cfgOf(k), armed: false, msg: "" }); CF.log.push({ ev: "model", id: k }); paint("tsl-m-" + k); }
function model(d) { const i = EV_IDS.indexOf(CF.id); setModel(EV_IDS[(i + d + EV_IDS.length) % EV_IDS.length]); }
/** Pick an option (the price + the plinth update at once). */
export function choose(g, o) {
    if (!CF.open || !EV_CONFIG[g] || !EV_CONFIG[g].some(x => x.id === o)) return false;
    CF.cfg = Object.assign({}, CF.cfg, { [g]: o }); CF.armed = false; CF.msg = "";
    CF.log.push({ ev: "choose", g, o });
    paint(`tsl-${g}-${o}`);
    return true;
}
// the car on its plinth wears the configuration being built (put back on close / another model)
function preview(cfg) {
    const E = CF.E && CF.E();
    if (!E) return;
    for (const c of E.cars) {
        if (cfg && c.id === CF.id) { resetPaint(c); applyCfg(c.obj, cfg); c.previewed = true; }
        else if (c.previewed) { resetPaint(c); applyCfg(c.obj, cfgOf(c.id)); c.previewed = false; }
    }
}
function resetPaint(c) {
    const sk = SKINS[c.id];
    c.obj.traverse(o => { if (o.isMesh && o.material && o.material.userData.cfgOwn && /^Body(Light|Dark)?$/.test(o.material.name)) o.material.color.set(o.material.name === "Body" ? sk.body : o.material.name === "BodyLight" ? sk.light : sk.dark); });
}
function homeCharger() {
    const FU = ctx.fuel;
    if (!FU || !FU.buyHome) return;
    const homes = (() => { try { return ctx.realestate ? ctx.realestate.owned().filter(h => !h.lost) : []; } catch (e) { return []; } })();
    if (!homes.length) { CF.msg = `It installs at a home you OWN. Ima: "You're NOT drilling into MY wall."`; paint("tsl-home"); return; }
    if (FU.home && homes.length < 2) { CF.msg = `Installed at ${FU.home.address}. Park a Tushla there — it's full next time.`; paint("tsl-home"); return; }
    if (CF.homeArmed !== true) { CF.homeArmed = true; CF.msg = `Tap again: ${FU.home ? `move it for ${fmt(FU.HOME.move)}` : `install it at ${homes[0].address || "your home"} for ${fmt(FU.HOME.price)}`} 💰.`; paint("tsl-home"); return; }
    CF.homeArmed = false;
    const r = FU.buyHome();
    CF.msg = r.ok ? `🏠🔋 Installed at ${r.home.address}.` : r.why === "poor" ? "Not enough coins." : "The screen says no. Calmly.";
    paint("tsl-home");
}

// ── order → delivery ──
export function order() {
    const id = CF.id, own = owns("car", id), L = lines(), tot = L.reduce((a, l) => a + l.price, 0);
    if (own && !tot && inv.selectedSkin !== id && carAway(id)) { CF.msg = `Yours — but it's ${carAway(id)}. Go get it.`; paint("tslOrder"); return { ok: false, why: "away" }; }
    if (own && !tot) { if (inv.selectedSkin !== id && equipSkin(id)) { ctx.foot.repaintCar && ctx.foot.repaintCar(); CF.msg = "It's out front. It unlocked when it sensed you. Probably."; } paint("tslOrder"); return { ok: true, price: 0 }; }
    if (wallet.coins < tot) { CF.msg = `Insufficient funds — ${fmt(tot - wallet.coins)} 💰 short. The screen says it very calmly.`; CF.armed = false; paint("tslOrder"); return { ok: false, why: "poor" }; }
    if (!CF.armed) { CF.armed = true; CF.msg = "One more tap. (That's the whole sales process.)"; paint("tslOrder"); return { ok: false, why: "armed" }; }
    CF.armed = false;
    let spent = 0;
    if (!own) { const r = buyCar(id); if (!r.ok) { CF.msg = "The screen froze. Then unfroze. Try again."; paint("tslOrder"); return r; } spent += r.price; }
    for (const l of L) {
        if (l.sub) { if (schlep.subscribe().ok) spent += l.price; continue; }
        if (!l.g) continue;
        if (buyExtra("carOption", `${id}:${l.g}:${l.o.id}`, l.o.price).ok) { (DS.evPaid[id] = DS.evPaid[id] || []).push(l.g + ":" + l.o.id); spent += l.o.price; }
    }
    DS.evCfg[id] = Object.assign({}, CF.cfg); saveSoon();
    // (buyCar already put her in it — before the configuration was saved: re-skin so it wears it)
    if (!own) equipSkin(id);
    if (ctx.car && ctx.car.skinKey === id) ctx.car.setSkin(id);
    emit("dealers:ev", { id, price: spent, cfg: DS.evCfg[id], act: own ? "update" : "order" });
    CF.log.push({ ev: "order", id, spent });
    close();
    deliver(id, own);
    return { ok: true, price: spent };
}
function deliver(id, own) {
    const E = CF.E && CF.E(), c = E && E.cars.find(x => x.id === id);
    if (c) CF.roll = { c, t: 0, from: c.obj.position.clone(), h: c.obj.rotation.y, id };
    H.toast(own ? `⚡ Updated — the ${EV_CARS[id].name} has its new look.` : `🚗 Delivery! The ${EV_CARS[id].name} rolls out of the showroom by itself. Nobody's in it. This is normal.`, "gold", { prio: 2, key: "tslOrder" });
    setTimeout(() => { H.toast(pick(EV_CONFIG.updates), "", { key: "tslUpdate" }); if (ctx.foot && ctx.foot.repaintCar) ctx.foot.repaintCar(); }, 3200);
}
hook("hud", dt => {
    const R = CF.roll;
    if (!R) return;
    R.t += dt;
    const k = Math.min(1, R.t / 3), e = k * k * (3 - 2 * k), fx = Math.sin(R.h), fz = Math.cos(R.h);
    R.c.obj.position.set(R.from.x + fx * 9 * e, R.from.y, R.from.z + fz * 9 * e);
    if (R.t > 4.5) { R.c.obj.visible = false; CF.roll = null; }        // (out of the door and off to her: the plinth's empty)
});

// ── 🔑 the test drive from the screen ──
export function testDrive(id) {
    const E = CF.E && CF.E(), sp = E && E.at;
    if (!sp || owns("car", id) || CF.td || !ctx.foot || !ctx.foot.drive) return false;
    close();
    const road = ctx.world.road.at(sp.s, {});
    CF.td = { id, orig: ctx.car.skinKey, t: 0 };
    const swap = () => { ctx.car.setSkin(id); ctx.foot.drive({ own: true, x: sp.x + Math.sin(road.h) * 0, z: sp.z, h: road.h, how: "testDrive" }); if (ctx.car.showDriver) ctx.car.showDriver(true); };
    if (ctx.dissolve && !ctx.skipping) ctx.dissolve(swap); else swap();
    H.toast(`🔑 Test drive: the ${EV_CARS[id].name} for ${EV_CONFIG.testSecs} seconds. (It's already watching you.)`, "", { key: "tslTest" });
    emit("dealers:ev", { id, act: "test" });
    CF.log.push({ ev: "test", id });
    return true;
}
hook("hud", dt => {
    const T = CF.td;
    if (!T) return;
    if (ctx.state === "playing" && !ctx.paused) T.t += dt;
    const over = T.t >= EV_CONFIG.testSecs || (ctx.foot && ctx.foot.active) || ctx.state === "title";
    if (!over) return;
    CF.td = null;
    if (ctx.car && ctx.car.skinKey === T.id) ctx.car.setSkin(T.orig || inv.selectedSkin || "pink");
    if (ctx.foot && ctx.foot.active && ctx.foot.repaintCar) ctx.foot.repaintCar();
    H.toast("⬇️ Over-the-air update: your test drive has ended. The car is now… your car again.", "", { key: "tslTest" });
    emit("dealers:ev", { id: T.id, act: "testEnd" });
});

export function close() {
    if (!CF.open) return;
    CF.open = false; CF.armed = false;
    preview(null);
    H.hideScreen();
    if (ctx.state === "footRun" && ctx.cam && ctx.cam.blend) ctx.cam.blend(0.8);
}
export const configDebug = { CF, choose, order, testDrive, total, close, applyCfg, cfgOf, setModel };
