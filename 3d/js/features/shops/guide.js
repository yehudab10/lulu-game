// features/shops/guide.js — 🛍️ WHERE TO SHOP: the Garage drawer's old 🛒 Shop button is now directions, not a store.
// A card lists every place and what it sells; "📍 Show me" marks it — the same quiet destination the day list and the
// friend finder use (a soft light column + one small HUD line, no pop-up): in the town that has it, over its door; on the
// highway (or leaving home), over the next exit into a town that has it; at home, over her garage door. It clears when
// she gets there. Kept across runs until she arrives or picks another.
import { ctx, on, hook, css, setState } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { startRun } from "../../core/driving.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { beacon, hideBeacon } from "../openworld/marks.js";
import { shopTabs } from "../garage/shop.js";
import { PLACES } from "./data.js";
import { counterDebug } from "./counter.js";

const GS = store("shops", { dest: null, marks: 0 });
const MI = 1609;
const G = { chip: null, text: "", arrivedAt: 0 };

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
/** Mark a place (id from PLACES) — or null to clear. */
export function setDest(id) {
    GS.dest = id && PLACES.some(p => p.id === id) ? id : null;
    if (GS.dest) GS.marks++;
    saveSoon();
    G.text = "";
    if (!GS.dest) clear();
    return GS.dest;
}
export const dest = () => GS.dest;

// ── following it ─────────────────────────────────────────────────────────
function clear() { hideBeacon("shopsDest"); chip(""); }
function chip(text) {
    if (!text) { if (G.chip) { G.chip.remove(); G.chip = null; G.text = ""; } return; }
    if (!G.chip) { G.chip = document.createElement("div"); G.chip.className = "day-chip shops-dest"; H.hudSlot("left").appendChild(G.chip); G.text = ""; }
    if (text !== G.text) { G.text = text; G.chip.innerHTML = text; }
}
/** Where the marked place is from here: { x, z, label, here } | null. */
export function target() {
    const id = GS.dest, p = PLACES.find(x => x.id === id);
    if (!p || !ctx.car) return null;
    const me = (ctx.foot && ctx.foot.active && ctx.foot.pos) || ctx.car.pos;
    if (p.home) {
        const H0 = ctx.places && ctx.places.home && ctx.places.home.park;
        if (!H0) return null;
        const fx = Math.sin(H0.h), fz = Math.cos(H0.h), lx = Math.cos(H0.h), lz = -Math.sin(H0.h);
        const x = H0.x - fx * 3.2 - lx * 1.7, z = H0.z - fz * 3.2 - lz * 1.7, d = Math.hypot(x - me.x, z - me.z);
        return { x, z, d, label: `${p.icon} ${p.name}`, arrive: 4, show: d < 600 };
    }
    if (ctx.town && ctx.town.active) {
        // (Shmerel's van isn't a building: it stands at the kerb near a town spot — counter.js knows where)
        const sp = p.id === "black" ? counterDebug.vanSpot() : p.spot && ctx.town.spot(p.spot);
        if (sp) { const d = Math.hypot(sp.x - me.x, sp.z - me.z); return { x: sp.x, z: sp.z, d, label: `${p.icon} ${p.name}`, arrive: 7, show: true }; }
        return { x: null, label: `${p.icon} ${p.name} — head out of town to ${Object.keys(p.towns || {}).map(t => t === "lakewood" ? "Lakewood" : "Midwood").join(" or ")}` };
    }
    // the highway: the next exit into a town that has it
    const ex = (ctx.town && ctx.town.exits || []).filter(e => p.towns && p.towns[e.town] && e.s > ctx.car.s - 40).sort((a, b) => a.s - b.s)[0];
    if (!ex) return { x: null, label: `${p.icon} ${p.name} — in town (take an exit)` };
    const pt = ctx.world.road.point(ex.s - 120, 7, {});
    const far = ex.s - ctx.car.s;
    return { x: pt.x, z: pt.z, d: far, label: `${p.icon} ${p.name} — take the ${ex.label || ex.name} exit${ex.no ? " " + ex.no : ""}`, arrive: -1, show: far < 900, far };
}
function tick() {
    if (!GS.dest) { if (G.chip) clear(); return; }
    const def = ctx.states[ctx.state];
    if (!def || !def.hud || ctx.state === "title") { clear(); return; }
    const t = target();
    if (!t) { clear(); return; }
    if (t.x != null && t.arrive > 0 && t.d < t.arrive) {
        // (she's there: the mark's done its job)
        GS.dest = null; saveSoon(); clear();
        return;
    }
    if (t.x != null && t.show) beacon("shopsDest", t.x, t.z, "#7C4DFF", 2.6, 30); else hideBeacon("shopsDest");
    const dist = t.d == null ? "" : t.d > 300 ? ` · ${(t.d / MI).toFixed(1)} mi` : t.d > 12 ? ` · ${Math.round(t.d)} m` : " · here!";
    chip(`🛍️ Shopping<small>${t.label}${dist}</small>`);
}
hook("hud", () => { try { tick(); } catch (e) { console.error("[shops] guide", e); } });
on("state", ({ to }) => { if (to === "title") clear(); });

export const guideDebug = { GS, target, places, setDest };
