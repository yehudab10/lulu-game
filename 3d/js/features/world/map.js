// features/world/map.js — 🏡 THE FAMILY & PLACES card (small and optional): where
// everyone lives along the road, who you've dropped in on, a line of family lore
// each, and the roadside places. A contact in the 📞 Phone app when the phone + community
// features are there (ctx.community.addContact), else its own 📱 app (ctx.phone.addApp, guarded);
// otherwise a row inside the 📒 Scrapbook drawer (never a home tile).
import { ctx, on, css, addMenuItem } from "../../core/ctx.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { showTitle } from "../../core/screens.js";
import { saved } from "./places.js";

const LORE = {
    home: ["🏡", "Home", "Lakewood · the cul-de-sac", "The pink door was Dina's idea. The pink car was also Dina's idea."],
    family_bubbe: ["👵", "Bubbe's house", "4.8 km up the road", "Nobody has ever left Bubbe's hungry. Several have tried."],
    family_heshy: ["🏊", "Heshy's pool", "pool town", "Heshy has been 'researching fountains' since 2019."],
    family_beach: ["🏖️", "The beach", "the coast", "Morgan the plushie was lost here once. Dina still won't talk about it."],
    family_avigail: ["💅", "Avigail's porch", "boutique row", "Bestie or nemesis depends on the day. And the nails."],
    family_vegas: ["😎", "Uncle Burry's", "Viva Vegas", "Burry left Lakewood with one suitcase and eleven opinions."],
    gas: ["⛽", "Gas 'n' Go", "every few km in Cruise", "Yanky's rugelach: two dollars, worth four."],
    lookout: ["🌄", "The Lookout", "over the lake", "Lakewood looks so small from up here. And so quiet. For once."],
};

css("world-map", `
.wmap { display: grid; gap: 6px; text-align: left; max-height: 60vh; overflow: auto; }
.wmap .wp { display: grid; grid-template-columns: 34px 1fr auto; gap: 2px 10px; align-items: center; padding: 7px 10px; border-radius: 12px; background: rgba(255,255,255,.55); }
.wmap .wp .i { font-size: 24px; grid-row: span 2; text-align: center; }
.wmap .wp b { font-size: 15px; } .wmap .wp small { opacity: .7; font-size: 12px; }
.wmap .wp .n { grid-row: span 2; font-weight: 700; font-size: 13px; color: var(--pink-dark, #c2185b); }
.wmap .wp .l { grid-column: 2 / 4; font-size: 12.5px; opacity: .85; }
body.tv .wmap .wp b { font-size: 22px; } body.tv .wmap .wp .l { font-size: 18px; }
`);

function html(phone = false) {
    const rows = Object.entries(LORE).map(([id, [icon, name, where, lore]]) => {
        const n = id === "home" ? 0 : saved.visits[id] || 0;
        const badge = id === "home" ? "" : n ? `✓ ×${n}` : "not yet";
        return `<div class="wp"><span class="i">${icon}</span><span><b>${name}</b> <small>· ${where}</small></span><span class="n">${badge}</span><span class="l">${lore}</span></div>`;
    }).join("");
    return `${phone ? "" : "<h2>🏡 Family &amp; places</h2>"}<div class="wmap">${rows}</div><p class="fine">In Cruise, pull off into a driveway or a bay and stop to drop in.</p>`;
}

/** Open the card. `back` runs when it closes. */
export function openFamilyMap(back) {
    const done = () => { H.hideScreen(); if (back) back(); else if (ctx.state === "title") showTitle(true); };
    H.showScreen(html(), [{ label: `Close ${glyph("back")}`, action: done }], { onBack: done, cls: "world-map-card" });
    return true;
}

const phoneApps = () => !!(ctx.phone && typeof ctx.phone.addApp === "function");
on("boot", () => {
    if (!phoneApps()) return;
    // a contact in the 📞 Phone app (features/community) — the phone stays one 3 × 3 screen; its own app only without that
    if (ctx.community && ctx.community.addContact) {
        ctx.community.addContact({ id: "family", icon: "🏡", name: "Family & places", tag: "who lives where · who you've visited", color: "#FF8A65", render(el) { el.innerHTML = html(true); } });
        return;
    }
    try { ctx.phone.addApp({ id: "family", icon: "🏡", name: "Family", order: 45, color: "#FF8A65", color2: "#C2185B", render(el) { el.innerHTML = html(true); } }); } catch (e) { console.warn("[world] phone app", e); }
});
addMenuItem("title", { id: "worldFamily", order: 58, group: "book", short: "Family", label: "🏡 Family & places", sub: "Who lives where, and who you've visited",
    visible: () => !phoneApps(), action: () => openFamilyMap() });
