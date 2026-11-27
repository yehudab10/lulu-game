// features/dealers/haggle.js — SAL MAZEL: the haggle, then the F&I office. One dialog card at a time (core/dialog), every
// line skippable. The rules (data.js HAGGLE):
//   • he quotes the sticker; she can take it, counter −5 % / −10 %, say "final offer" (the floor, −15 %), or walk;
//   • each counter costs him patience (a "final offer" twice as much); run out and the price goes BACK to the sticker
//     ("you lost the deal, not your coins") — from then on it's take it or leave it;
//   • a counter meets her halfway; walking toward the door with a counter on the table brings out "let me talk to my
//     manager" (once): 5 % more off, never below the floor (sticker × 0.85);
//   • the deal is paid through garage/buy.js (never below 0 coins — can't afford it: he says so, nothing is taken);
//   • then the F&I office: the real options her car can take (they work: perks.js) + the nonsense (they don't — a joke
//     line, and Sal remembers she fell for it).
import { ctx, emit } from "../../core/ctx.js";
import { saveSoon, wallet } from "../../core/save.js";
import { say, choose } from "../../core/dialog.js";
import { SKINS } from "../../car.js";
import { SKIN_SHOP } from "../garage/data.js";
import { buyCar, buyExtra, owns } from "../garage/buy.js";
import { SAL, HAGGLE, OPTIONS, NONSENSE, LUX_CARS } from "./data.js";
import { DS } from "./perks.js";

const fmt = n => Math.round(n).toLocaleString("en-US");
const pick = a => a[Math.floor(Math.random() * a.length)];
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] != null ? o[k] : "");
const O = { emoji: SAL.emoji, color: SAL.color };
const sal = (text, o = {}) => say(SAL.name, text, Object.assign({}, O, o));
const ask = (text, opts) => choose(SAL.name, text, opts, O);

/** The haggle for car `id`. → { ok, price } (bought) | { ok: false, why: "walked" | "poor" | "owned" } */
export async function haggle(id) {
    const sk = SKINS[id], shop = SKIN_SHOP[id];
    if (!sk || !shop) return { ok: false, why: "unknown" };
    if (owns("car", id)) { await sal("That one's already yours, my friend. I remember. I cried."); return { ok: false, why: "owned" }; }
    const sticker = shop.price, floor = Math.round(sticker * HAGGLE.floor);
    const H = { offer: sticker, patience: HAGGLE.patience, countered: false, manager: false, lost: false, log: [] };
    DS.last = H;
    emit("dealers:haggle", { id, phase: "start", sticker });
    await sal(fill(pick(SAL.sticker), { p: fmt(sticker) + " 💰" }));
    for (let round = 0; round < 12; round++) {
        const opts = [], acts = [];
        opts.push(`✅ Deal — ${fmt(H.offer)} 💰`); acts.push("deal");
        if (!H.lost) {
            for (const k of HAGGLE.steps) { const c = Math.round(sticker * k); if (c < H.offer) { opts.push(`🤏 How about ${fmt(c)}?`); acts.push(k); } }
            if (floor < H.offer) { opts.push(`💪 ${fmt(floor)}. Final offer.`); acts.push("final"); }
        }
        opts.push(H.manager || H.lost || !H.countered ? "🚪 Leave" : "🚪 Walk toward the door…"); acts.push("walk");
        const i = await ask(`On the table: ${fmt(H.offer)} 💰${H.lost ? " (he's done haggling)" : ` · his patience: ${"🙂".repeat(Math.max(0, H.patience))}`}`, opts);
        const a = acts[i] == null ? "walk" : acts[i];
        H.log.push(a);
        if (a === "deal") {
            if (wallet.coins < H.offer) { await sal(SAL.poor); emit("dealers:haggle", { id, phase: "poor", price: H.offer }); return { ok: false, why: "poor" }; }
            const r = buyCar(id, { price: H.offer });
            if (!r.ok) { await sal(SAL.poor); return { ok: false, why: r.why }; }
            DS.deals++; DS.saved = (DS.saved || 0) + (sticker - r.price); saveSoon();
            emit("dealers:haggle", { id, phase: "deal", price: r.price, sticker });
            await sal(pick(SAL.deal));
            await fni(id);
            return { ok: true, price: r.price };
        }
        if (a === "walk") {
            if (!H.manager && !H.lost && H.countered) {
                H.manager = true;
                for (const l of SAL.manager.slice(0, 2)) await sal(l);
                H.offer = Math.max(floor, Math.round(H.offer - sticker * HAGGLE.managerBonus));
                await sal(fill(SAL.manager[2], { n: fmt(H.offer) + " 💰" }));
                continue;
            }
            DS.walked++; saveSoon();
            emit("dealers:haggle", { id, phase: "walked", price: H.offer });
            await sal(pick(SAL.bye));
            return { ok: false, why: "walked" };
        }
        // a counter / the final offer
        H.countered = true;
        H.patience -= a === "final" ? 2 : 1;
        if (H.patience < 0) {
            H.lost = true; H.offer = sticker;
            await sal(fill(pick(SAL.lost), { p: fmt(sticker) + " 💰" }));
            continue;
        }
        if (a === "final") {
            H.offer = Math.max(floor, Math.round(sticker * 0.88));
            await sal(fill(SAL.firm[0], { n: fmt(H.offer) + " 💰" }));
        } else {
            const c = Math.round(sticker * a);
            H.offer = Math.max(floor, Math.round((H.offer + c) / 2));
            await sal(fill(pick(SAL.counter), { c: fmt(c), n: fmt(H.offer) + " 💰" }));
        }
    }
    return { ok: false, why: "walked" };
}

/** The F&I office: the options this car can take (they work) + the nonsense (they don't). One card each. */
export async function fni(id) {
    const car = LUX_CARS[id];
    if (!car) return;
    await sal(SAL.fni);
    const have = new Set([...(car.perks || []), ...(DS.opts[id] || [])]);
    for (const [k, o] of Object.entries(OPTIONS)) {
        if (have.has(k)) continue;
        const i = await ask(`${o.name} — ${fmt(o.price)} 💰\n${o.desc}`, [`✅ Add it — ${fmt(o.price)} 💰`, "❌ No thanks", "⏭ Skip the rest"]);
        if (i === 2 || i < 0) return;
        if (i === 0) {
            const r = buyExtra("carOption", id + ":" + k, o.price);
            if (!r.ok) { await sal(SAL.poor); continue; }
            (DS.opts[id] = DS.opts[id] || []).push(k); saveSoon();
            emit("dealers:option", { id, opt: k, price: o.price });
            await sal(pick(SAL.fniYes));
        } else await sal(pick(SAL.fniNo));
    }
    for (const [k, n] of Object.entries(NONSENSE)) {
        const i = await ask(`${n.name} — ${fmt(n.price)} 💰\n“${n.pitch}”`, [`✅ Sure — ${fmt(n.price)} 💰`, "❌ No thanks", "⏭ Skip the rest"]);
        if (i === 2 || i < 0) return;
        if (i === 0) {
            const r = buyExtra("nonsense", k, n.price);
            if (!r.ok) { await sal(SAL.poor); continue; }
            DS.fell[k] = (DS.fell[k] || 0) + 1; saveSoon();
            emit("dealers:nonsense", { id: k, price: n.price });
            emit("stat", { id: "dealersNonsense", n: 1 });
            await sal(pick(SAL.fniYes));
        } else await sal(pick(SAL.fniNo));
    }
}

/** What Sal says when she walks in again: a nonsense package she fell for, remembered. */
export function remembered() {
    const ks = Object.keys(DS.fell || {}).filter(k => NONSENSE[k]);
    return ks.length ? NONSENSE[pick(ks)].after : "";
}
