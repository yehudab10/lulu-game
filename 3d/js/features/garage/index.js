// features/garage — THE SHOP, BLING & ITEMS (port of the 2D game's shop:
// src/06-screens.js, src/06d-bling.js, the item code in src/05-driving-loop.js).
//
//   🛒 Shop (title, order 30) → state "shop": Cars / Items / Bling tabs over a
//      3D showroom (shop.js). Everything bought is written to the SHARED 2D save
//      (ownedSkins, selectedSkin, missiles, pepperSpray, shields,
//      distractedUnlocked, horn, ownedHorns, decor, ownedDecor) with the
//      shared wallet, so the 2D and 3D games stay in sync.
//   In the drive (items.js): the equipped horn + Honk Symphony, missiles
//      (D-pad ↑ / M), pepper spray (D-pad ↓ / G), the bubble shield (vetoes a
//      lost heart), Distracted Mode, decorations on the car (decor.js).
//
// Service: ctx.garage { items(), use(id), give(id, n), open(tab), playHorn(id, note),
//                       distracted, setDistracted(on) }
// Events out: item:use {id: "missile"|"pepper"|"shield", x, z, …}, missile:hit {car, x, z},
//             stat {id: "missiles8"|"honks10"|…}, skin {key}, garage:decor {id}, garage:horn {id}
import { ctx, addMenuItem, setState, css } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { SKINS } from "../../car.js";
import { glyph } from "../../input.js";
import { inv, syncInv, writeShared, SKIN_SHOP, SKIN_KEYS } from "./data.js";
import * as S from "./sound.js";
import { fireMissile, usePepper, useShieldNow, setDistracted, distracted, garageDebug } from "./items.js";
import { shopDebug } from "./shop.js";

// ── title menu ───────────────────────────────────────────────────────────
addMenuItem("title", { id: "shop", order: 30, cls: "gx-gold", label: "🛒 Shop", action: () => setState("shop", { tab: "cars" }) });
addMenuItem("title", {
    id: "distracted", order: 31, cls: "purple",
    visible: () => inv.distractedUnlocked,
    label: () => `📱 Distracted: ${distracted() ? "ON" : "OFF"}`,
    action: btn => { setDistracted(!distracted()); S.sfxPhone(); if (btn) btn.innerHTML = `📱 Distracted: ${distracted() ? "ON" : "OFF"}`; },
});
// "next ride" progress toward the cheapest car you don't own yet (2D game-over nudge)
addMenuItem("titleInfo", {
    id: "garage_next",
    label: () => {
        syncInv();
        const next = SKIN_KEYS.filter(k => !inv.ownedSkins.includes(k)).sort((a, b) => SKIN_SHOP[a].price - SKIN_SHOP[b].price)[0];
        if (!next) return "";
        const sk = SKINS[next], price = SKIN_SHOP[next].price, have = wallet.coins;
        const f = Math.max(0, Math.min(1, have / price));
        return `<div class="gx-next"><span>next ride: <b>${sk.name}</b></span>
            <div class="gx-nbar"><i style="width:${(f * 100).toFixed(0)}%;background:linear-gradient(90deg, ${sk.dark}, ${sk.body})"></i></div>
            <span>${f >= 1 ? `💰 ${price.toLocaleString()} — it's waiting in the shop!` : `${have.toLocaleString()} / ${price.toLocaleString()} 💰`}</span></div>`;
    },
});

// ── the service other features use ───────────────────────────────────────
const FIELD = { missile: "missiles", missiles: "missiles", pepper: "pepperSpray", pepperSpray: "pepperSpray", shield: "shields", shields: "shields" };
ctx.garage = {
    /** Item counts (cached from the shared save — cheap to call every frame). */
    items() {
        return { missiles: inv.missiles, pepper: inv.pepperSpray, pepperSpray: inv.pepperSpray, shields: inv.shields,
            distractedUnlocked: inv.distractedUnlocked, distracted: distracted(), horn: inv.horn, decor: inv.decor };
    },
    /** Use an item now: "missile" | "pepper" | "shield" (4 s bubble) | "distracted" (toggle). Returns true if it worked. */
    use(id) {
        if (id === "missile" || id === "missiles") return fireMissile();
        if (id === "pepper" || id === "pepperSpray") return usePepper();
        if (id === "shield" || id === "shields") return useShieldNow();
        if (id === "distracted") return setDistracted(!distracted());
        return false;
    },
    /** Award items (a cameo's gift, a quest reward): give("shield"), give("missile", 5). */
    give(id, n = 1) {
        const f = FIELD[id];
        if (!f) return false;
        writeShared(s => { s[f] = Math.max(0, (s[f] | 0) + n); });
        return true;
    },
    open(tab = "cars") { setState("shop", { tab }); },
    playHorn(id, note) { return S.playHorn(id || inv.horn, note); },
    get distracted() { return distracted(); },
    setDistracted,
    debug: garageDebug,
    shop: shopDebug,
};

css("garage", `
.btn.gx-gold { background: linear-gradient(#FFC107, #FF8F00); color: #2b1b00; }
.btn.gx-gold .glyph { background: rgba(0,0,0,.75); color: #fff; }
.gx-next { margin: 8px auto 2px; width: min(320px, 100%); font-size: 13px; font-weight: 600; opacity: .85; display: flex; flex-direction: column; gap: 3px; align-items: center; }
.gx-nbar { width: 100%; height: 9px; border-radius: 999px; background: rgba(0,0,0,.12); overflow: hidden; }
.gx-nbar i { display: block; height: 100%; border-radius: 999px; }
.gx-hud { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.gx-chip { display: inline-flex; align-items: center; gap: 5px; font-size: 15px; }
.gx-chip .glyph { min-width: 20px; height: 20px; font-size: 10px; }
.gx-chip.pink { background: rgba(255,128,171,.92); color: #fff; }
.gx-chip.dim { opacity: .5; }
.gx-chip.honk { background: conic-gradient(rgba(124,77,255,.92) calc(var(--p) * 360deg), rgba(124,77,255,.45) 0); color: #fff; }
.gx-chip.honk.hot { background: conic-gradient(rgba(255,79,163,.95) calc(var(--p) * 360deg), rgba(255,79,163,.45) 0); }
body.tv .gx-chip { font-size: 22px; } body.tv .gx-next { font-size: 18px; width: min(520px, 100%); }
`);

export { garageDebug };
