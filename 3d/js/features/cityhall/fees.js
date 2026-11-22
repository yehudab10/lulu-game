// features/cityhall/fees.js — 🧾 SILLY FEES (stage 2): tiny jokes on the town's ledger (tax.js), at most FEE_CAP coins a
// real day all together, each kind at most once a real day, mailed QUIETLY to the 📱 inbox (no pop-up). Never taken by
// themselves — paid with everything else at the Taxes window / the phone — and an unpaid fee simply expires after
// FEE_TUNE.expire played days. Only in a town, only solo-or-friends out in the world (never Dina's mode).
//   🔊 the loud-honk surcharge — FEE_TUNE.honkN honks inside FEE_TUNE.honkWindow seconds in town
//   🚒 parking near a hydrant (in spirit) — getting out of her car in town, now and then
//   🪑 the porch-sitting licence — on a played day she owns a home, now and then (billed with the day's tax)
//   📣 the complaint filing fee — filing a complaint at the Complaints window
import { ctx, on } from "../../core/ctx.js";
import { FEES, FEE_CAP, FEE_TUNE, TAX_LINES as TL } from "./data.js";
import { S, saveSoon, inTown, stat } from "./state.js";
import { addLine } from "./tax.js";

if (!S.fees || typeof S.fees !== "object") S.fees = { day: "", n: 0, kinds: {} };
const F = S.fees;
export const FE = { honks: [], force: {} };
const realDay = () => { const d = FE.force.day || new Date(); return typeof d === "string" ? d : `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
function roll() { const d = realDay(); if (F.day !== d) { F.day = d; F.n = 0; F.kinds = {}; saveSoon(); } }
const world = () => (ctx.state === "playing" || ctx.state === "footRun" || ctx.state === "interior") && !(ctx.G && ctx.G.mode && !/^(cruise|story)$/.test(ctx.G.mode));

/** Charge fee `kind` (once a real day per kind, FEE_CAP a real day in all). → the bill or null */
export function charge(kind) {
    const f = FEES[kind];
    if (!f) return null;
    roll();
    if (F.kinds[kind]) return null;
    const amount = Math.min(f.amount, FEE_CAP - F.n);
    if (amount <= 0) return null;
    F.kinds[kind] = true; F.n += amount;
    const b = addLine("fee", f.what, amount, { fee: kind });
    try { if (ctx.phone && ctx.phone.inbox && ctx.phone.inbox.post) ctx.phone.inbox.post({ from: TL.from, emoji: TL.emoji, color: TL.color, msg: TL.fee(Object.assign({}, f, { amount })), thread: "cityhall" }); } catch (e) { /* no phone */ }
    stat("cityhallFees");
    saveSoon();
    return b;
}
export const feesToday = () => { roll(); return F.n; };

on("honk", () => {
    if (!inTown() || !world()) return;
    const t = ctx.time;
    FE.honks.push(t);
    while (FE.honks.length && t - FE.honks[0] > FEE_TUNE.honkWindow) FE.honks.shift();
    if (FE.honks.length >= FEE_TUNE.honkN) { FE.honks.length = 0; charge("honk"); }
});
on("foot:start", e => {
    if (!inTown() || !world() || !e || e.reason !== "parked") return;
    if (FE.force.hydrant === true || (FE.force.hydrant !== false && Math.random() < FEE_TUNE.hydrantChance)) charge("hydrant");
});
on("cityhall:complaint", () => charge("complaint"));
/** tax.js's new played day: the porch licence, now and then, when she owns a home. */
on("cityhall:day", e => porchCheck(e ? e.homes : 0));
export function porchCheck(homes) {
    if (homes > 0 && (FE.force.porch === true || (FE.force.porch !== false && Math.random() < FEE_TUNE.porchChance))) charge("porch");
}
