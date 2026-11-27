// features/shops/guide.js — 🛍️ WHERE TO SHOP: the Garage drawer's old 🛒 Shop button is now directions, not a store.
// A card lists every place and what it sells; "📍 Show me" marks it — the same quiet destination the day list and the
// friend finder use (a soft light column + one small HUD line, no pop-up): in the town that has it, over its door; on the
// highway (or leaving home), over the next exit into a town that has it; at home, over her garage door. It clears when
// she gets there. Kept across runs until she arrives or picks another.
import { ctx, on, css, setState } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { startRun } from "../../core/driving.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { shopTabs } from "../garage/shop.js";
import { PLACES } from "./data.js";

const GS = store("shops", { dest: null, marks: 0 });

css("shops-guide", `
.sg { text-align: left; }
.sg h2 { margin: 0 0 4px !important; }
.sg-sub { font-size: 14px; opacity: .75; margin: 0 0 10px; }
.card.sg-card .menu { display: grid; gap: 7px; }
.card.sg-card .menu .btn { text-align: left; display: block; padding: 9px 14px; font-size: 15px; line-height: 1.25; }
.card.sg-card .menu .btn small { display: block; font-weight: 600; opacity: .78; font-size: 12.5px; margin-top: 2px; }
.card.sg-card .menu .btn.sg-on { box-shadow: 0 0 0 3px var(--pink) inset; }
body.tv .card.sg-card .menu .btn { font-size: 24px; padding: 14px 22px; } body.tv .card.sg-card .menu .btn small { font-size: 18px; }
/* (a phone on its side: the left HUD stack is short on room — the 🛍️ line drops its second line) */
@media (max-height: 460px) { .day-chip.shops-dest small { display: none; } .day-chip.shops-dest { padding: 4px 10px; font-size: 13px; } }
`);

/** The places, as rows (what's built today + the old counter for whatever hasn't moved into the world yet). */
export function places() {
    const rows = PLACES.map(p => ({ id: p.id, icon: p.icon, name: p.name, sells: p.sells,
        where: p.home ? "at home — ✋ by the garage door" : Object.entries(p.towns || {}).map(([t, w]) => `${t === "lakewood" ? "Lakewood" : "Midwood"}: ${w}`).join(" · ") }));
    const left = shopTabs();
    // (the old counter is a menu screen of its own: only from the title — opening it mid-run would end the run)
    if (left.length && ctx.state === "title") rows.push({ id: "counter", icon: "🛒", name: "The old shop counter", counter: true,
        sells: left.map(t => (t === "items" ? "🚀 items (missiles, pepper spray, shields, Distracted Mode)" : t === "bling" ? "✨ bling (horns + car decorations)" : "🚗 cars")).join(" · "),
        where: "moving into town soon — still open from here" });
    return rows;
}

/** Open the 🛍️ Where to shop card (from the title's Garage drawer, the pause menu, the phone). back() when it closes. */
export function openGuide(back = null) {
    const rows = places();
    const close = () => { H.hideScreen(); if (back) back(); };
    const buttons = rows.map(r => ({
        label: `${r.icon} <b>${r.name}</b>${GS.dest === r.id ? " · 📍 marked" : ""}<small>${r.sells}<br>📍 ${r.where}</small>`,
        cls: GS.dest === r.id ? "sg-on" : "",
        action: () => {
            if (r.counter) { setState("shop", { tab: shopTabs()[0] }); return; }
            setDest(r.id);
            A.sfxMove && A.sfxMove();
            openGuide(back);
        },
    }));
    if (ctx.state === "title") buttons.push({ label: `▶ <b>PLAY</b><small>${GS.dest ? "follow the light to " + nameOf(GS.dest) : "out into the world"}</small>`, cls: "", action: () => { H.hideScreen(); startRun({ mode: "cruise" }); } });
    buttons.push({ label: `Done ${glyph("back")}`, cls: "secondary", action: close });
    const html = `<div class="sg"><h2>🛍️ Where to shop</h2><p class="sg-sub">Everything's sold somewhere in the world now. ${glyph("confirm")} on a place marks it — follow the light.</p></div>`;
    H.showScreen(html, buttons, { onBack: close, cls: "sg-card", focus: Math.max(0, rows.findIndex(r => r.id === GS.dest)) });
    return true;
}

const nameOf = id => (PLACES.find(p => p.id === id) || {}).name || id;
/** Mark a place (id from PLACES) — or null to clear. (ci/hud, 2026-11-27: the mark IS features/pins' 📍 ping now — one
 *  destination system: the beam, one edge pointer, the objective line's lowest slot; it picks this town's shop of that
 *  kind, else the next town's along the road.) */
export function setDest(id) {
    const P = ctx.pins;
    GS.dest = id && PLACES.some(p => p.id === id) ? id : null;
    if (GS.dest) { GS.marks++; if (!P || !P.pingKind(GS.dest, { from: "shops" })) GS.dest = null; }
    else if (P && P.from === "shops") P.clear();
    saveSoon();
    return GS.dest;
}
export const dest = () => GS.dest;
/** Where the marked place is from here (features/pins › target): { kind, x, z, d, label } | null. */
export function target() { return GS.dest && ctx.pins ? ctx.pins.target() : null; }
// (the mark lives as long as its ping: arrived, cleared or replaced by another ping → done)
on("pins:clear", () => { if (GS.dest) { GS.dest = null; saveSoon(); } });
on("pins:ping", e => { if (GS.dest && e && e.from !== "shops") { GS.dest = null; saveSoon(); } });

export const guideDebug = { GS, target, places, setDest };
