// features/garage/buy.js — BUYING, one place for every shop in the world (features/shops: the dealership, the
// makolet, the black market, the bling counter). Every function writes the SHARED 2D save exactly the way the old
// 🛒 Shop menu did (shop.js — same fields, same values, same order), so the classic 2D game reads the same thing:
//   car      ownedSkins += id, selectedSkin = id                 (+ stat skinsBought)
//   item     missiles / pepperSpray / shields += give; distracted → distractedUnlocked = true
//   horn     ownedHorns += id, horn = id
//   decor    ownedDecor += id, decor = id
//   clothes  (3D only) features/clothes' own save — buyClothes(def, { owned, give })
// Coins: wallet.spend(price) — never below zero (a buy that can't be paid changes nothing).
// → { ok: true } | { ok: false, why: "poor" | "owned" | "unknown" }
import { ctx, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { SKIN_SHOP, ITEMS, HORNS, DECOR, inv, syncInv, writeShared } from "./data.js";

const itemDef = id => ITEMS.find(i => i.id === id) || null;
const hornById = id => HORNS.find(h => h.id === id) || null;
const decorById = id => DECOR.find(d => d.id === id) || null;

/** What a thing costs: kind "car" | "item" | "horn" | "decor". */
export function priceOf(kind, id) {
    if (kind === "car") return SKIN_SHOP[id] ? SKIN_SHOP[id].price : null;
    const d = kind === "item" ? itemDef(id) : kind === "horn" ? hornById(id) : kind === "decor" ? decorById(id) : null;
    return d ? d.price : null;
}
/** Does she own it (cars / horns / decorations / Distracted Mode)? Consumable items are never "owned". */
export function owns(kind, id) {
    syncInv();
    if (kind === "car") return inv.ownedSkins.includes(id);
    if (kind === "horn") return inv.ownedHorns.includes(id);
    if (kind === "decor") return inv.ownedDecor.includes(id);
    if (kind === "item") return id === "distracted" ? inv.distractedUnlocked : false;
    return false;
}
/** How many she carries of a consumable (missiles / pepper / shields). */
export function countOf(id) {
    syncInv();
    const it = itemDef(id);
    return it && it.count ? inv[it.count] | 0 : 0;
}

function pay(price) {
    if (price == null) return { ok: false, why: "unknown" };
    if (wallet.coins < price || !wallet.spend(price)) return { ok: false, why: "poor" };
    return { ok: true };
}

/** Put a car she owns in the driveway / under her (the shared save's selectedSkin + the 3D car). */
/** features/cars: where car `id` is when it ISN'T at home or with her ("impounded in Midwood", "parked in Lakewood") —
 *  "" when it's at hand. A showroom / a menu can't "bring round" a car that's away (an impounded one came out free, a parked
 *  one jumped across the map). */
export function carAway(id) {
    const C = ctx.cars;
    if (!C || !C.atHome || !ctx.enabled("cars") || C.atHome(id)) return "";
    const w = C.list().find(c => c.key === id);
    return w ? w.where : "somewhere else";
}
export function equipSkin(id) {
    if (!SKINS[id]) return false;
    writeShared(s => { s.selectedSkin = id; });
    if (ctx.car && ctx.car.skinKey !== id) ctx.car.setSkin(id);
    emit("skin", { key: id });
    return true;
}

/** Buy a car (and drive it: like the old Shop, a new car is selected at once — opts.equip false = just own it). */
export function buyCar(id, opts = {}) {
    if (!SKIN_SHOP[id] || !SKINS[id]) return { ok: false, why: "unknown" };
    if (owns("car", id)) return { ok: false, why: "owned" };
    // (opts.price: a negotiated price — features/dealers' haggle; never more than the sticker, never below 85 % of it)
    const sticker = SKIN_SHOP[id].price, price = opts.price != null ? Math.round(Math.max(sticker * 0.85, Math.min(sticker, opts.price))) : sticker;
    const r = pay(price);
    if (!r.ok) return r;
    writeShared(s => {
        s.ownedSkins = Array.isArray(s.ownedSkins) ? s.ownedSkins : ["pink"];
        if (!s.ownedSkins.includes(id)) s.ownedSkins.push(id);
        s.selectedSkin = id;
    });
    if (opts.equip !== false) equipSkin(id);
    emit("stat", { id: "skinsBought", n: 1 });
    emit("shops:buy", { kind: "car", id, price });
    return { ok: true, price };
}

/** Pay for an extra a feature keeps itself (features/dealers: a car's option, the F&I office's packages, a subscription):
 *  `price` coins or nothing — never below 0. The feature records what was bought. → { ok, why? } */
export function buyExtra(kind, id, price) {
    if (!(price >= 0)) return { ok: false, why: "unknown" };
    const r = pay(Math.round(price));
    if (!r.ok) return r;
    emit("shops:buy", { kind, id, price: Math.round(price) });
    return { ok: true };
}

/** Buy an item (a missile, the 5-pack, pepper spray, a shield — or unlock Distracted Mode). */
export function buyItem(id) {
    const it = itemDef(id);
    if (!it) return { ok: false, why: "unknown" };
    if (id === "distracted" && owns("item", id)) return { ok: false, why: "owned" };
    const r = pay(it.price);
    if (!r.ok) return r;
    if (id === "distracted") writeShared(s => { s.distractedUnlocked = true; });
    else writeShared(s => { s[it.count] = Math.max(0, (s[it.count] | 0)) + it.give; });
    emit("shops:buy", { kind: "item", id, price: it.price });
    return { ok: true };
}

/** Buy a horn (it goes on at once) — or put on one she owns (free). */
export function buyHorn(id) {
    const def = hornById(id);
    if (!def) return { ok: false, why: "unknown" };
    if (owns("horn", id)) { writeShared(s => { s.horn = id; }); return { ok: true, equipped: true }; }
    const r = pay(def.price);
    if (!r.ok) return r;
    writeShared(s => {
        s.ownedHorns = Array.isArray(s.ownedHorns) ? s.ownedHorns : ["beep"];
        if (!s.ownedHorns.includes(id)) s.ownedHorns.push(id);
        s.horn = id;
    });
    emit("shops:buy", { kind: "horn", id, price: def.price });
    return { ok: true };
}

/** Buy a decoration (it goes on at once) — or toggle one she owns on / off (free). */
export function buyDecor(id) {
    const def = decorById(id);
    if (!def) return { ok: false, why: "unknown" };
    if (owns("decor", id)) {
        syncInv();
        const on = inv.decor !== id;
        writeShared(s => { s.decor = on ? id : "none"; });
        return { ok: true, equipped: on, off: !on };
    }
    const r = pay(def.price);
    if (!r.ok) return r;
    writeShared(s => {
        s.ownedDecor = Array.isArray(s.ownedDecor) ? s.ownedDecor : [];
        if (!s.ownedDecor.includes(id)) s.ownedDecor.push(id);
        s.decor = id;
    });
    emit("shops:buy", { kind: "decor", id, price: def.price });
    return { ok: true };
}

/** Buy a piece of clothing (features/clothes — 3D-only, kept in the clothes save): def = the piece, has(id) → owned?,
 *  give(id) adds it. Never below zero; nothing is ever sold back. */
export function buyClothes(def, { owned: has, give }) {
    if (!def || def.price == null || typeof give !== "function") return { ok: false, why: "unknown" };
    if (has && has(def.id)) return { ok: false, why: "owned" };
    const r = pay(def.price);
    if (!r.ok) return r;
    give(def.id);
    emit("stat", { id: "clothesBought", n: 1 });
    emit("shops:buy", { kind: "clothes", id: def.id, price: def.price });
    return { ok: true };
}

/** One entry point: buy(kind, id). */
export function buy(kind, id, opts) {
    if (kind === "car") return buyCar(id, opts);
    if (kind === "item") return buyItem(id);
    if (kind === "horn") return buyHorn(id);
    if (kind === "decor") return buyDecor(id);
    return { ok: false, why: "unknown" };
}
