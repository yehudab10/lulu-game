// features/fuel/dry.js — ⛽ RUNNING DRY (step 3): never a dead end, never a punishment spiral.
//   • Past E there's a hidden RESERVE (DRY.reserveKm of "fumes" — longer than any gap between two pumps): the gauge reads
//     E, the chip says so, Lulu says "E means 'Enough', right?". In a chase the burn stops with DRY.chaseKeepKm left.
//   • Truly dry: no throttle, no nitro (core/driving.js reads ctx.G.fuelDry) — she coasts and steers onto the shoulder.
//     A self-driving Tushla hands the wheel back. No damage, no crash.
//   • Getting going: 📞 Chaverim (a reason in the 📞 app while she's on fumes or dry): a splash in ~RESCUE.chaverim.wait s,
//     free once a real day, then RESCUE.chaverim.fee (on account when she's broke) — an EV gets their portable battery; or
//     ON FOOT at any pump, ✋ 🛢️ a can (RESCUE.can.price), walk it back to her car, ✋ pour it in.
//   • An empty car left on the shoulder isn't towed for DRY.graceMin real minutes (features/cars asks ctx.fuel.dryGrace).
//   • Fair: a 💼 job starting on nearly-empty → one line + the nearest pump pinged (she can go anyway); a self-driving
//     Tushla running low pings the nearest charger once and drives there (dealers/schlep.js + route.js).
import { ctx, on, hook, emit } from "../../core/ctx.js";
import { saveSoon, wallet } from "../../core/save.js";
import * as H from "../../hud.js";
import { SKINS } from "../../car.js";
import { buyExtra } from "../garage/buy.js";
import { X, X_IN, XW } from "../town/exit.js";
import { DRY, RESCUE, PUMPS, L } from "./data.js";

const isEV = k => !!(k && SKINS[k] && SKINS[k].ev);
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export const D = { chav: null, can: false, said: {}, log: [] };
function log(ev, d = {}) { D.log.push(Object.assign({ ev, t: +(ctx.time || 0).toFixed(1) }, d)); if (D.log.length > 40) D.log.shift(); }
let FS = null;
export function initDry(fs) { FS = fs; if (!FS.fumes) FS.fumes = {}; if (!FS.dryAt) FS.dryAt = {}; }

// ── the reserve: called by the drain once the gauge is at 0 → the metres it may still burn ──
/** Burn `m` metres past E for tank k. → true while it still goes (false = dry). */
export function burnFumes(k, m) {
    if (FS.fumes[k] == null) { FS.fumes[k] = DRY.reserveKm * 1000; sayOnce(k, "fumes"); log("fumes", { k }); emit("fuel:empty", { key: k, act: "fumes" }); }
    const keep = ctx.law && ctx.law.chasing ? DRY.chaseKeepKm * 1000 : 0;
    if (FS.fumes[k] > keep) FS.fumes[k] = Math.max(keep, FS.fumes[k] - m);
    if (FS.fumes[k] <= 0 && !FS.dryAt[k]) {
        FS.dryAt[k] = Date.now(); saveSoon();
        H.toast(isEV(k) ? L.dryEV : L.dry, "", { key: "fuel" });
        log("dry", { k }); emit("fuel:empty", { key: k, act: "dry" });
    }
    return FS.fumes[k] > 0;
}
/** Any fill / charge: the reserve's full again, she's not dry. */
export function refilled(k) { if (FS && (FS.fumes[k] != null || FS.dryAt[k])) { delete FS.fumes[k]; delete FS.dryAt[k]; delete D.said[k + ":fumes"]; saveSoon(); } }
export const isDry = k => !!(FS && k && FS.dryAt[k] && FS.fumes[k] != null && FS.fumes[k] <= 0);
export const onFumes = k => !!(FS && k && FS.fumes[k] != null && FS.fumes[k] > 0);
function sayOnce(k, what) { const id = k + ":" + what; if (D.said[id]) return; D.said[id] = true; H.toast(L[what], "", { key: "fuel" }); }
/** Is car k an empty car that features/cars mustn't tow yet? */
export function dryGrace(k) { const t = FS && FS.dryAt[k]; return !!t && Date.now() - t < DRY.graceMin * 60000; }

// ── dry: no throttle (she coasts + steers) ──
hook("controls", ctl => {
    const k = ctx.fuel && ctx.fuel.key();
    const dry = isDry(k);
    if (ctx.G) ctx.G.fuelDry = dry;
    if (!dry) return;
    ctl.throttle = 0;
}, -100);

// ── 📞 Chaverim: a splash (or an EV's portable battery) ──
const chavFree = () => FS.chavDay !== today();
on("boot", () => {
    try {
        if (!ctx.community || !ctx.community.addReason) return;
        ctx.community.addReason("chaverim", () => {
            const k = ctx.fuel && ctx.fuel.key();
            if (!k || D.chav || !(isDry(k) || onFumes(k) || (ctx.fuel.level(k) <= 0.001))) return null;
            return { id: "fuel", icon: isEV(k) ? "🔋" : "⛽", label: L.chavReason(isEV(k)), sub: L.chavSub(chavFree()), run: () => callChaverim() };
        });
    } catch (e) { console.warn("[fuel] chaverim", e); }
});
export function callChaverim() {
    const k = ctx.fuel && ctx.fuel.key();
    if (!k || D.chav) return false;
    D.chav = { k, at: ctx.time + RESCUE.chaverim.wait };
    H.toast(L.chavCall, "", { key: "fuel" });
    log("chaverim", { k }); emit("fuel:rescue", { key: k, by: "chaverim", act: "call" });
    return true;
}
hook("hud", () => {
    const c = D.chav;
    if (!c || ctx.time < c.at) return;
    D.chav = null;
    // the fee: free once a real day; then the fee, or on account when she's broke (never below 0)
    let fee = 0;
    if (chavFree()) FS.chavDay = today();
    else if (wallet.coins >= RESCUE.chaverim.fee && buyExtra("fuel", "chaverim", RESCUE.chaverim.fee).ok) fee = RESCUE.chaverim.fee;
    else FS.iou = (FS.iou || 0) + RESCUE.chaverim.fee;
    saveSoon();
    ctx.fuel.set(c.k, Math.min(1, ctx.fuel.level(c.k) + RESCUE.chaverim.splash));
    H.toast(L.chavHere(isEV(c.k)), "gold", { key: "fuel" });
    log("splash", { k: c.k, fee }); emit("fuel:rescue", { key: c.k, by: "chaverim", act: "done", fee });
});

// ── 🛢️ the can: on foot at a pump → buy one → walk it back → pour it in ──
const _p = {};
function pumpsNear(x, z, max) {
    const hw = ctx.world && (ctx.world.highway || ctx.world.road), out = [];
    if (!hw) return out;
    const add = (s, d) => { hw.point(s, d, _p); if (Math.hypot(_p.x - x, _p.z - z) < max) out.push({ x: _p.x, z: _p.z }); };
    try { for (const s of (ctx.places && ctx.places.at ? ctx.places.at("gas") : [])) add(s, 15.2 - 2.4); } catch (e) { /* none */ }
    try { for (const s of (ctx.places && ctx.places.at ? ctx.places.at("exits_pump") : [])) add(s, 28.6); } catch (e) { /* none */ }
    for (const e of X.exits) add(e.s + X_IN + XW, PUMPS.towns.d);
    return out;
}
const footPos = () => (ctx.state === "footRun" && ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
const myStub = () => { const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F; return F && F.car && F.car.stub ? F.car.stub : null; };
const canSpot = {
    r: 3.2, short: "CAN",
    pos() {
        const me = footPos(), k = ctx.fuel && ctx.fuel.key();
        if (!me || D.can || !k || isEV(k) || ctx.fuel.level(k) > 0.25) return null;
        const p = pumpsNear(me.x, me.z, RESCUE.can.reach)[0];
        return p ? { x: p.x, z: p.z } : null;
    },
    label: () => L.canBuy,
    act: () => {
        if (wallet.coins >= RESCUE.can.price) { if (!buyExtra("fuel", "can", RESCUE.can.price).ok) return; }
        else FS.iou = (FS.iou || 0) + RESCUE.can.price;      // (broke: the attendant fronts it — never below 0)
        D.can = true; saveSoon();
        H.toast(L.canGot, "", { key: "fuel" });
        log("can"); emit("fuel:rescue", { by: "can", act: "buy" });
    },
};
const pourSpot = {
    r: 3.4, short: "POUR",
    pos() { const me = footPos(), st = myStub(); return me && D.can && st ? { x: st.x, z: st.z } : null; },
    label: () => L.canPour,
    act: () => {
        const k = ctx.fuel.key();
        if (!k) return;
        D.can = false;
        ctx.fuel.set(k, Math.min(1, ctx.fuel.level(k) + RESCUE.can.amount));
        H.toast(L.canDone, "gold", { key: "fuel" });
        log("pour", { k }); emit("fuel:rescue", { key: k, by: "can", act: "pour" });
    },
};
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(canSpot); ctx.foot.addSpot(pourSpot); } });

// ── fair: a job starting on nearly-empty → one line + the nearest pump pinged ──
export function nearestPump(ev = false) {
    const P = ctx.pins;
    if (!P || !P.list) return null;
    let best = null, bd = Infinity;
    for (const p of P.list()) {
        const okId = ev ? (/charge|charger/.test(p.id) || /🔋/.test(p.sub || "")) : /^hw:fuel:/.test(p.id);
        if (!okId) continue;
        let t = null; try { t = P.target(p.id); } catch (e) { t = null; }
        if (t && t.d < bd) { bd = t.d; best = p.id; }
    }
    return best;
}
on("hustle:start", () => {
    const k = ctx.fuel && ctx.fuel.key();
    if (!k || ctx.fuel.level(k) >= DRY.warnJob) return;
    const id = nearestPump(isEV(k));
    if (id && ctx.pins && !ctx.pins.current) ctx.pins.ping(id, { from: "fuel" });
    H.toast(L.jobLow, "", { key: "fuel" });
    log("jobWarn", { k, pin: id });
});

export const dryDebug = { D, pumpsNear, nearestPump, callChaverim, canSpot, pourSpot };
