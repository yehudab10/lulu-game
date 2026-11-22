// features/crime — 🌬️ AUTHENTIC AIR (on foot, opt-in): "Genuine Lakewood air" (Midwood: Brooklyn air) in mason jars, from a
// little stand by the town's welcome sign / the bakery. ✋ SELL → a TUNE.air.shift s shift: a customer walks up every
// buyerEvery s, she picks a pitch, they buy a jar: PAY.air.sale 💰 a jar, ≤ perDay a REAL day.
// The corruption: INSPECTOR PINCHAS (60 %) turns up mid-shift — "a PERMIT for this… air?" →
//   💸 a "donation" (PAY.air.permit) → he didn't see any jars (remembered: next time he just winks — a corrupt act: city hall
//      gets `crime:corrupt`) · 📄 "of course I have a permit" (half the time he believes her) · 🏃‍♀️ grab the jars and run.
// Not believed / ran → the shift's over and he phones it in: law.callIn("SELLING AIR WITHOUT A PERMIT").
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { PAY, TUNE, LINES, log, stat, pick, fill, lulu, bubble, mustSee, bakeBoxes, townSpot, payCapped, live, onFoot, luluPos, paidToday } from "./common.js";
import { CHARGES } from "./data.js";
import { Character, ask, mem, remember } from "./street.js";

const K = TUNE.air, M = LINES.air;
export const AIR = { stand: null, geos: [], at: null, shift: null, buyer: null, inspector: null, spotRm: null, force: {} };
const townName = () => (ctx.town && ctx.town.id === "midwood" ? "Brooklyn" : (ctx.town && ctx.town.name) || "Lakewood");

export function buildAir() {
    clearAir();
    const at = townSpot(["welcome", "bakery", "pizza"], 5, 2.2);
    if (!at) return false;
    AIR.at = at;
    const g = new THREE.Group();
    const parts = [
        { w: 1.2, h: 0.05, d: 0.6, y: 0.74, color: "#A1887F" },
        { w: 1.2, h: 0.7, d: 0.04, y: 0.37, z: 0.28, color: "#81D4FA" },
        { w: 0.05, h: 1.8, d: 0.05, x: -0.58, y: 0.9, z: -0.28, color: "#5D4037" }, { w: 0.05, h: 1.8, d: 0.05, x: 0.58, y: 0.9, z: -0.28, color: "#5D4037" },
        { w: 1.3, h: 0.36, d: 0.04, y: 1.7, z: -0.28, color: "#FFF59D" },
    ];
    for (let i = 0; i < 5; i++) parts.push({ w: 0.12, h: 0.16, d: 0.12, x: -0.4 + i * 0.2, y: 0.85, color: "#E1F5FE" }, { w: 0.13, h: 0.03, d: 0.13, x: -0.4 + i * 0.2, y: 0.945, color: "#FFC107" });
    g.add(bakeBoxes(parts, AIR.geos));
    g.position.set(at.x, 0, at.z);
    g.rotation.y = at.yaw + Math.PI;
    ctx.scene.add(g);
    AIR.stand = g;
    AIR.buyer = new Character({ key: "npcWoman", colors: { Shirt: "#7E57C2" }, name: "a customer" });
    AIR.buyer.place(at.x + at.nx * 2.2 + at.ux * 1.5, at.z + at.nz * 2.2 + at.uz * 1.5, at.yaw + Math.PI);
    AIR.inspector = new Character({ key: "hustle_detective", fallback: "npcMan", colors: { Coat: "#455A64" }, name: M.inspector });
    AIR.inspector.place(at.x + at.ux * 14, at.z + at.uz * 14, at.yaw);
    if (ctx.foot && ctx.foot.addSpot) AIR.spotRm = ctx.foot.addSpot(spot);
    log("air", { phase: "built", key: at.key });
    return true;
}
export function clearAir() {
    if (AIR.spotRm) { AIR.spotRm(); AIR.spotRm = null; }
    if (AIR.buyer) AIR.buyer.clear();
    if (AIR.inspector) AIR.inspector.clear();
    if (AIR.stand) AIR.stand.removeFromParent();
    for (const g of AIR.geos) g.dispose();
    AIR.geos.length = 0;
    Object.assign(AIR, { stand: null, at: null, shift: null, buyer: null, inspector: null });
}
const behind = () => ({ x: AIR.at.x - AIR.at.nx * 0.9, z: AIR.at.z - AIR.at.nz * 0.9 });
const spot = {
    r: 2.2, short: "SELL",
    pos() { return AIR.stand && !AIR.shift && live() ? behind() : null; },
    label() { return fill(M.stand, { town: townName() }); },
    act() { start(); },
};

/** Open the stand. → bool */
export function start() {
    if (!AIR.stand || AIR.shift || !onFoot()) return false;
    if (paidToday("air") >= PAY.air.perDay) { mustSee(M.capped, "", "crime:air"); return false; }
    const insp = AIR.force.inspector != null ? AIR.force.inspector : (mem("pinchas").mood !== "gone" && Math.random() < K.inspectorChance);
    AIR.shift = { t: 0, sales: 0, buyerT: 2, inspT: insp ? K.inspectorAt : 1e9, insp: "none", busy: false };
    lulu(fill(pick(M.open), { town: townName() }), true);
    stat("crimeAirShifts");
    log("air", { phase: "open", inspector: insp });
    return true;
}
async function sale(S) {
    S.busy = true;
    const b = AIR.buyer;
    if (b.p) { b.p.obj.visible = true; bubble("One jar, please!", b.obj, { y: 2.0, cls: "nice", dur: 1.4 }); }
    const pitches = M.pitches[ctx.town && ctx.town.id === "midwood" ? "midwood" : "lakewood"];
    await ask(`🌬️ ${townName()} air`, M.pitch, pitches, "🌬️");
    if (AIR.shift !== S) return;
    S.sales++;
    if (b.obj) bubble(pick(M.bought), b.obj, { y: 2.0, cls: "nice", dur: 1.6 });
    log("air", { phase: "sale", n: S.sales });
    S.busy = false;
}
async function inspect(S) {
    S.busy = true; S.insp = "asking";
    const I = AIR.inspector, m = mem("pinchas");
    if (m.mood === "bribed") {
        if (I.obj) bubble(pick(M.winked), I.obj, { y: 2.1, cls: "nice" });
        S.insp = "winked"; S.busy = false;
        emit("crime:corrupt", { who: "pinchas", act: "wink" });
        log("air", { phase: "inspector", outcome: "winked" });
        return;
    }
    const i = await ask(`🧐 ${M.inspector}`, M.permit, M.permitOpts.map(o => fill(o, { n: PAY.air.permit })), "🧐");
    if (AIR.shift !== S) return;
    if (i === 0 && wallet.coins >= PAY.air.permit && wallet.spend(PAY.air.permit)) {
        S.insp = "bribed";
        remember("pinchas", "bribed", "bribed");
        emit("crime:corrupt", { who: "pinchas", act: "bribe" });
        if (I.obj) bubble(pick(M.winked), I.obj, { y: 2.1 });
        log("air", { phase: "inspector", outcome: "bribed" });
    } else if (i === 1 && (AIR.force.believe != null ? AIR.force.believe : Math.random() < 0.5)) {
        S.insp = "believed";
        if (I.obj) bubble(M.believed, I.obj, { y: 2.1 });
        log("air", { phase: "inspector", outcome: "believed" });
    } else {
        S.insp = i === 2 ? "ran" : "busted";
        if (I.obj) bubble(i === 2 ? "HEY! Come back here with that AIR!" : M.notBelieved, I.obj, { y: 2.1, cls: "angry" });
        log("air", { phase: "inspector", outcome: S.insp });
        end(S.insp);
        try { if (ctx.law && ctx.law.callIn) ctx.law.callIn(CHARGES.air.name, { msg: "📞 The inspector called it in — SELLING AIR!" }); } catch (e) { /* no law */ }
        return;
    }
    S.busy = false;
}
export function airTick(dt) {
    if (!AIR.stand) return;
    const nearB = AIR.buyer.keep();
    AIR.inspector.keep();
    const S = AIR.shift;
    if (AIR.buyer.p) { AIR.buyer.p.obj.visible = !!(S && S.busy && S.insp !== "asking"); AIR.buyer.p.update(dt, {}); }
    const I = AIR.inspector;
    if (I.p) {
        const home = I.home, tgt = S && S.insp === "asking" || (S && S.inspT <= 0 && S.insp === "none") ? { x: AIR.at.x + AIR.at.nx * 1.6, z: AIR.at.z + AIR.at.nz * 1.6 } : home;
        const dx = tgt.x - I.x, dz = tgt.z - I.z, d = Math.hypot(dx, dz);
        if (d > 0.4) { I.x += dx / d * 2.2 * dt; I.z += dz / d * 2.2 * dt; I.sync(); I.p.face(tgt.x, tgt.z, dt, 6); I.p.update(dt, { walk: 2.2 }); }
        else { const lp = luluPos(); I.p.face(lp.x, lp.z, dt, 6); I.p.update(dt, { talk: S && S.insp === "asking" }); }
    }
    if (!S) return;
    const lp = luluPos(), b = behind();
    S.t += dt;
    if (!onFoot() || Math.hypot(lp.x - b.x, lp.z - b.z) > 6) { end("walked"); return; }
    if (S.busy) return;
    S.inspT -= dt;
    if (S.inspT <= 0 && S.insp === "none") {
        if (I.p && Math.hypot(I.x - (AIR.at.x + AIR.at.nx * 1.6), I.z - (AIR.at.z + AIR.at.nz * 1.6)) < 0.6) inspect(S);
        return;
    }
    S.buyerT -= dt;
    if (S.buyerT <= 0) { S.buyerT = K.buyerEvery; sale(S); }
    if (S.t > K.shift) end("done");
    void nearB;
}
function end(why) {
    const S = AIR.shift;
    if (!S) return;
    AIR.shift = null;
    log("air", { phase: "close", why, sales: S.sales });
    if (S.insp === "busted" || S.insp === "ran" || !S.sales) return;
    const paid = payCapped("air", S.sales * PAY.air.sale, PAY.air.perDay);
    mustSee(fill(M.done, { n: S.sales }) + (paid > 0 ? ` · +${paid} 💰` : ""), paid > 0 ? "gold" : "", "crime:air");
}
export { end as airEnd };
