// features/dealers/lux.js — 🏎️ THE MAZELATI CARD (the owner, 2026-11-27: "the player isn't able to switch between
// vehicles to compare stats since it brings up the sales person right away … make the ui look better and more luxury").
//   BROWSE FIRST, SALESMAN SECOND: ✋ at any car on the floor opens this card at that car; ◀ ▶ (the buttons, LB / RB,
//   a swipe) flip through every car on the floor — no Sal. He comes in only on the "🤵 Talk to Sal — make an offer"
//   button (or ✋ at Sal himself). Each stat is a big bar with its number out of 10 and a marker for the car she drives
//   now (the compare), the perks spelled out, the sticker in gold. A dark showroom look — cream + gold type, a serif
//   name. Fits a phone (portrait + landscape), the TV layout and a controller; it's a screen card (H.showScreen), so the
//   HUD's own rules keep it off everything else.
import { ctx, css } from "../../core/ctx.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { SKINS } from "../../car.js";
import { inv, syncInv, STAT_ROWS } from "../garage/data.js";
import { owns, equipSkin } from "../garage/buy.js";
import { LUX_CARS, LUX_IDS, OPTIONS, BUILT_IN, LUX } from "./data.js";
import { perksOf } from "./perks.js";

const fmt = n => Math.round(n).toLocaleString("en-US");
/** A stat multiplier → 0..10 (0.7 → 0, 1.6 → 10: Refael's best sits about halfway). */
export const score10 = m => Math.max(0, Math.min(10, ((m || 1) - 0.7) / 0.9 * 10));
const NAMES = { top: "Top speed", acc: "Acceleration", grip: "Handling", brake: "Brakes" };
export const V = { open: false, i: 0, ids: LUX_IDS, talk: null, sx: null, log: [] };

css("dealers-lux", `
#screenCard.card.lux-card { width: min(760px, calc(100vw - 24px)); max-height: calc(100vh - 24px); max-height: calc(100dvh - 24px); overflow-y: auto; padding: 18px 22px 14px;
  background: radial-gradient(120% 90% at 50% 0%, #2A2418 0%, #14110C 60%, #0B0907 100%); color: #F3E9D2; border: 1px solid #6B5A2E;
  box-shadow: 0 18px 60px rgba(0,0,0,.55), inset 0 0 0 1px rgba(201,162,39,.25); }
.lux { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; }
.lux-top { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; letter-spacing: .22em; font-size: 11px; color: #C9A227; text-transform: uppercase; }
.lux-top .lux-n { letter-spacing: .1em; opacity: .8; }
.lux-name { font-family: Georgia, "Times New Roman", serif; font-size: 36px; line-height: 1.05; margin: 6px 0 2px; color: #FFF6DE; letter-spacing: .01em; }
.lux-flavor { font-style: italic; font-size: 14px; opacity: .78; margin-bottom: 12px; }
.lux-row { display: grid; grid-template-columns: 112px 1fr 54px; align-items: center; gap: 10px; margin: 8px 0; }
.lux-row b { font-size: 13px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: #E8D9B5; }
.lux-bar { position: relative; height: 12px; border-radius: 999px; background: rgba(243,233,210,.12); overflow: visible; }
.lux-bar i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #8C6D1A, #E9C75A); }
.lux-bar u { position: absolute; top: -4px; width: 3px; height: 20px; border-radius: 2px; background: #F3E9D2; opacity: .85; text-decoration: none; }
.lux-row em { font-style: normal; font-size: 20px; font-weight: 700; text-align: right; color: #FFF6DE; font-variant-numeric: tabular-nums; }
.lux-row em small { display: block; font-size: 10px; font-weight: 600; color: #BFAE86; letter-spacing: .02em; }
.lux-cmp { font-size: 12px; color: #BFAE86; margin: 2px 0 10px; }
.lux-cmp u { display: inline-block; width: 3px; height: 12px; background: #F3E9D2; vertical-align: -2px; margin: 0 4px 0 2px; }
.lux-perks { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px 14px; margin: 10px 0 12px; font-size: 14px; }
.lux-perks div::before { content: "◆ "; color: #C9A227; }
.lux-price { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; border-top: 1px solid rgba(201,162,39,.35); padding-top: 10px; }
.lux-price span { font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #C9A227; }
.lux-price b { font-family: Georgia, serif; font-size: 30px; color: #E9C75A; }
.lux-price b.own { font-size: 20px; color: #9FD8A4; }
.lux-dots { text-align: center; margin: 10px 0 0; letter-spacing: 6px; color: #6B5A2E; font-size: 12px; }
.lux-dots b { color: #E9C75A; }
#screenCard.lux-card .menu { flex-direction: row; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
#screenCard.lux-card .menu .btn { background: rgba(243,233,210,.08); color: #F3E9D2; border: 1px solid rgba(201,162,39,.5); box-shadow: none; }
#screenCard.lux-card .menu .btn.lux-go { background: linear-gradient(180deg, #E9C75A, #B8901F); color: #1A1408; border-color: #E9C75A; font-weight: 800; }
#screenCard.lux-card .menu .btn.focus { outline: 3px solid #FFF6DE; outline-offset: 2px; }
#screenCard.lux-card .menu .btn.lux-arrow { min-width: 64px; font-size: 20px; width: auto; flex: 1 1 64px; max-width: 160px; }
#screenCard.lux-card .menu .btn.lux-go { flex: 1 1 100%; }
.lux-perks { text-align: left; }
@media (max-width: 560px) { .lux-name { font-size: 28px; } .lux-row { grid-template-columns: 92px 1fr 46px; gap: 8px; } .lux-row b { font-size: 11.5px; } .lux-row em { font-size: 17px; }
  .lux-perks { grid-template-columns: 1fr; font-size: 13px; } #screenCard.card.lux-card { padding: 14px 14px 10px; } }
@media (max-height: 480px) { #screenCard.card.lux-card { padding: 10px 16px 8px; } .lux-name { font-size: 24px; margin: 2px 0 0; } .lux-flavor { margin-bottom: 4px; font-size: 12px; }
  .lux-row { margin: 3px 0; } .lux-perks { margin: 4px 0 6px; font-size: 12px; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); } .lux-price b { font-size: 22px; } .lux-dots { margin-top: 4px; }
  #screenCard.lux-card .menu { margin-top: 4px; } #screenCard.lux-card .menu .btn { padding: 5px 12px; font-size: 14px; } }
body.tv #screenCard.card.lux-card { width: min(1100px, calc(100vw - 80px)); } body.tv .lux-name { font-size: 54px; } body.tv .lux-row { grid-template-columns: 180px 1fr 80px; }
body.tv .lux-row b { font-size: 18px; } body.tv .lux-row em { font-size: 28px; } body.tv .lux-bar { height: 16px; } body.tv .lux-perks { font-size: 19px; } body.tv .lux-price b { font-size: 42px; }
`);

const mine = () => (ctx.car && SKINS[ctx.car.skinKey] ? ctx.car.skinKey : inv.selectedSkin || "pink");
function html(id) {
    const sk = SKINS[id], c = LUX_CARS[id], me = SKINS[mine()] || SKINS.pink, meName = (me && me.name) || "your car";
    const rows = STAT_ROWS.map(([, key]) => {
        const v = score10(sk[key]), m = score10(me[key]);
        return `<div class="lux-row"><b>${NAMES[key] || key}</b><span class="lux-bar"><i style="width:${v * 10}%"></i><u style="left:calc(${m * 10}% - 1px)"></u></span><em>${v.toFixed(1)}<small>${v >= m ? "+" : "−"}${Math.abs(v - m).toFixed(1)}</small></em></div>`;
    }).join("");
    const perks = [...perksOf(id)].map(k => OPTIONS[k] ? `${OPTIONS[k].name} — ${OPTIONS[k].desc}` : BUILT_IN[k] || k);
    if (sk.nitro > 1) perks.unshift(`🔋 A bigger nitro tank — ${Math.round((sk.nitro - 1) * 100)} % more`);
    const own = owns("car", id), drv = own && inv.selectedSkin === id;
    const n = V.ids.length;
    return `<div class="lux" data-lux="${id}">
      <div class="lux-top"><span>${LUX.full || "Mazelati of Monsey"}</span><span class="lux-n">${V.i + 1} / ${n}</span></div>
      <div class="lux-name">${c.name}</div><div class="lux-flavor">${c.flavor}</div>
      ${rows}
      <div class="lux-cmp"><u></u>= ${meName} (what you drive now) · the small number is the difference</div>
      <div class="lux-perks">${perks.length ? perks.map(p => `<div>${p}</div>`).join("") : "<div>Options in the F&amp;I office — ask Sal.</div>"}</div>
      <div class="lux-price"><span>${own ? "In your garage" : "Sticker"}</span>${own ? `<b class="own">${drv ? "✓ You're driving it" : "✓ Yours"}</b>` : `<b>${fmt(c.price)} 💰</b>`}</div>
      <div class="lux-dots">${V.ids.map((_, k) => (k === V.i ? "<b>●</b>" : "●")).join("")}</div>
    </div>`;
}
/** Open the card at car `id` (✋ at a car on the floor). onTalk(id): Sal's haggle — only from its button. */
export function openLux(id, onTalk) {
    if (H.screenOpen() || !ctx.foot || !ctx.foot.script) return false;
    syncInv();
    Object.assign(V, { open: true, i: Math.max(0, V.ids.indexOf(id)), talk: onTalk });
    paint(2);
    V.log.push({ ev: "open", id });
    return ctx.foot.script({ update(dt, P) { if (!V.open) return false; if (!H.screenOpen() || !H.screenCard().querySelector(".lux")) { V.open = false; return false; } H.menuInput(P); return V.open; } });
}
function paint(focus = null) {
    const id = V.ids[V.i], own = owns("car", id);
    const keep = focus != null ? focus : H.currentFocus();
    const card = H.showScreen(html(id), [
        { label: "◀", cls: "lux-arrow", id: "luxPrev", action: () => flip(-1) },
        { label: "▶", cls: "lux-arrow", id: "luxNext", action: () => flip(1) },
        own ? { label: inv.selectedSkin === id ? "✓ Driving it" : "🔑 Drive this one", cls: "lux-go", id: "luxAct", action: () => { if (equipSkin(id)) { ctx.foot.repaintCar && ctx.foot.repaintCar(); paint(); } } }
            : { label: "🤵 Talk to Sal — make an offer", cls: "lux-go", id: "luxAct", action: () => talk(id) },
        { label: `Close ${glyph("back")}`, cls: "secondary", id: "luxClose", action: () => close() },
    ], { onBack: () => close(), onTab: d => flip(d), focus: keep, cls: "lux-card" });
    // a swipe on the card flips too (phones)
    const el = card.querySelector(".lux");
    if (el) {
        el.addEventListener("pointerdown", e => { V.sx = e.clientX; });
        el.addEventListener("pointerup", e => { if (V.sx != null && Math.abs(e.clientX - V.sx) > 48) flip(e.clientX < V.sx ? 1 : -1); V.sx = null; });
    }
}
/** Next / previous car on the floor (never Sal). */
export function flip(d) {
    if (!V.open) return;
    const n = V.ids.length;
    V.i = (V.i + d + n) % n;
    V.log.push({ ev: "flip", id: V.ids[V.i] });
    paint();
}
export function close() {
    if (!V.open) return;
    V.open = false;
    H.hideScreen();
    if (ctx.state === "footRun" && ctx.cam && ctx.cam.blend) ctx.cam.blend(0.8);
}
function talk(id) {
    V.log.push({ ev: "talk", id });
    close();
    if (V.talk) setTimeout(() => V.talk(id), 60);
}
export const luxDebug = { V, flip, close, html, score10 };
