// features/shops — 🛍️ THE SHOP MOVES INTO THE WORLD (the owner, 2026-11-20: "the shop button … seems pretty hidden …
// move the shop to places in game. A car dealer for some cars? Pepper spray at a grocery or the black market?").
//
//   models.js   the town pieces, built in code (merged by the town engine: ~0 draw calls)
//   lot.js      the dealership as town DATA (`uses.dealer`: the showroom + a `with` entry per car, price boards)
//   card.js     the buy card every place uses (decor's picker, generalised): walk up, ✋, tiles, ask → buy
//   dealer.js   🚗 Uncle Moishe's Pre-Loved Cars (Lakewood: Route 9 · Midwood: Coney Island Ave) — look, test drive, buy
//   counter.js  🛒 the makolet (pepper spray, the bubble shield, Distracted Mode) + 😈 Shmerel's van (missiles, the 5-pack)
//   bling.js    ✨ Moishe's Bling Bay at the dealership: horns (hear them) + car decorations (fitted on her car out front)
//   rooms.js    🍕 walk-in shops: the pizza shop (both towns) + Midwood's bakery — rooms on the interiors engine,
//               a snack that heals one heart once a run; shared with friends (together/rooms.js SHARED)
//   home.js     🔑 her garage at home — pick which car she drives (cars she owns wait at home)
//   guide.js    🛍️ Where to shop (the Garage drawer's old 🛒 Shop button): the places + a "show me" destination
// Buying goes through garage/buy.js — the SAME shared-save fields the old Shop wrote (the classic 2D game reads them).
//
// Service: ctx.shops { guide(back), places(), dest(), setDest(id), openLot(k), openGarage(), debug }
// Events: shops:open {place, town}, shops:buy {kind, id, price} (garage/buy.js), shops:car {id, how}, shops:test {id, phase}
// Stats: shopsVisits, shopsTestDrives (+ the old skinsBought)
import { ctx, on, addMenuItem } from "../../core/ctx.js";
import { showPauseMenu } from "../../core/screens.js";
import "./models.js";
import { retireTab } from "../garage/shop.js";
import { openLot, dealerDebug } from "./dealer.js";
import { openGarage, garageDebug } from "./home.js";
import { openGuide, places, dest, setDest, guideDebug } from "./guide.js";
import { openCounter, counterDebug } from "./counter.js";
import { openBling, blingDebug } from "./bling.js";
import { enterShop, roomsDebug } from "./rooms.js";
import * as card from "./card.js";

// the old Shop counter no longer sells what a place in the world does
retireTab("cars");
retireTab("items");      // 🛒 the makolet + 😈 Shmerel's van (counter.js)
retireTab("bling");      // ✨ Moishe's Bling Bay (bling.js) — the old counter is empty now: nothing is sold from a menu

// the pause menu: the same directions mid-run (it closes back to the pause menu)
addMenuItem("pause", { id: "whereShop", order: 37, group: "tools", label: "🛍️ Where to shop", action: () => openGuide(showPauseMenu) });

// Ima's list can send a new player to the lot (once a day, like every list item — features/day)
on("boot", () => {
    if (ctx.day && ctx.day.addItem) ctx.day.addItem("errand", { id: "moishe", kind: "event", ev: "shops:open", icon: "🚗",
        text: "Say hi to Uncle Moishe (his car lot in town)", ima: "stop by Uncle Moishe's car lot in town — he says you never visit" });
    if (ctx.day && ctx.day.addItem) ctx.day.addItem("errand", { id: "makolet", kind: "event", ev: "shops:makolet", icon: "🥛", place: "makolet",
        text: "Milk from the makolet in town (Zissy's / Yanky's)", ima: "pick up milk at the makolet in town — and NOTHING else, I know you" });
});

ctx.shops = {
    guide: openGuide, places, dest, setDest, openLot, openGarage, openCounter, openBling, enterShop,
    debug: { dealer: dealerDebug, garage: garageDebug, guide: guideDebug, counter: counterDebug, bling: blingDebug, rooms: roomsDebug, card },
};
