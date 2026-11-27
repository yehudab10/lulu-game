// features/clothes — 👗 CLOTHING SHOPS + A CLOSET (roadmap 24; the owner, 2026-11-27: "different clothing shops in
// midwood and Lakewood… Midwood more japy stuff and Lakewood more yeshivish… Smooth animations for purchasing the
// clothes and putting them on… a closet in lulus homes that she needs to be in to change her clothes Or in the store").
//
//   data.js   every piece, price, shop and line (tune here) + the shopfront as town data (`uses.clothes`)
//   wear.js   what she wears, on HER model: recolours (free) + one merged shape per limb for a coat / an accessory;
//             core/people.js dresses every Lulu it spawns (hers by default; a friend's by passing theirs)
//   shop.js   the walk-in shop (interiors engine): racks → a small card → TRY ON in the fitting room (curtain + spin,
//             the mirror view) → BUY at the counter (the bag, the coins counting down) — via garage/buy.js
//
// Service: ctx.clothes { current(), owns(id), wear(outfit), encode / decode (the compact form for other players),
//   pieces, enterShop(), debug }
// Events: clothes:changed {outfit, why}, clothes:try {id, shop}, shops:buy {kind: "clothes"} (buy.js), shops:open {place: "clothes"}
// Save: store("clothes") { owned, wear, saved, spent, bought, changes } — in the 💾 save code with the rest of the 3D save.
// Stats: clothesBought. Dina's mode: never touched (no Lulu there).
import { ctx, on } from "../../core/ctx.js";
import { PIECES, SLOTS, SHOPS } from "./data.js";
import { S, current, owns, wear, encode, decode, dress, addOwned, wearDebug } from "./wear.js";
import { enterShop, enterAs, addDoors, shopDebug } from "./shop.js";
import { placeCloset, closetDebug } from "./closet.js";
import { airDebug } from "./airdoor.js";
import { stockOf, refresh as refreshStock, buyLimited, restore, limitedDebug } from "./limited.js";

on("boot", () => addDoors());

// 👯 friends see what she wears: the compact form rides in the party state she already sends (d.x.ot — old clients
// ignore an unknown extra). Strangers in the EVERYONE room stay plain see-through ghosts (no outfits on crowds).
let sentOt = null;
function publish() {
    const P = ctx.party;
    if (!P || !P.active || !P.setX) { sentOt = null; return; }
    const ot = encode(current()), v = /[^,]/.test(ot) ? ot : null;
    if (v === sentOt) return;
    sentOt = v;
    try { P.setX("ot", v); } catch (e) { /* not connected */ }
}
on("clothes:changed", publish);
setInterval(publish, 2000);
/** A friend's outfit from her party record (p.x.ot) — {} when she sends none (an old client: the default look). */
const outfitOf = p => decode(p && p.x && typeof p.x.ot === "string" ? p.x.ot : "");

ctx.clothes = {
    current, owns, wear, encode, decode, dress,
    pieces: PIECES, slots: SLOTS, shops: SHOPS,
    enterShop, enterAs, outfitOf, placeCloset,
    /** 👜 a limited piece's world stock: { limited, total, left, online, n } — the ONE place the shelf asks */
    stockOf, refreshStock, restore,
    /** Which shop the room is dressed as right now (a town id / "jfk") — friends in the same one share it. */
    shopNow: () => shopDebug.shopNow(),
    get owned() { return S.owned.slice(); },
    /** A piece she EARNS (never bought — e.g. features/lanes' bowling shirt): into her closet → true if it's new. */
    give: id => addOwned(id),
    debug: { S, wear: wearDebug, shop: shopDebug, closet: closetDebug, limited: limitedDebug, air: airDebug, buyLimited },
};
