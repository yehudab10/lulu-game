// features/shops/card.js — THE BUY CARD every shop place uses (features/decor's picker, generalised): a compact strip
// of tiles at the bottom of the screen — the shelf / the car / the counter stays visible above it (the caller's camera
// frames it). Moving over a tile focuses it (onFocus: preview it in the world); a press on something free (yours, an
// action) does it; on something for sale the FIRST press asks "Buy · 120 💰?" and the SECOND buys — no accidental buys
// on a phone. Can't go below zero (the buy fails, the tile shakes, the line says how much more). One must-see toast per
// buy. ○ / B / Esc / Done closes it. Controller, keyboard, touch (portrait + landscape) and TV: decor's card styles
// (`decor-card` / `dp-*`) + a few of our own.
//
// openCard(spec): spec = {
//   title (html), head?() → html above the tiles (repainted on every focus / buy — the stats of a car),
//   tiles: [{ id, icon, name, desc?() | desc, price?, state?() → "placed" | "owned" | "buy" | "none",
//             tag?() → string (instead of the price / state chip), act?() (free press), buy?() → { ok, why } }],
//   focus: tile id, onFocus?(id), buttons?: [{ id, label() | label, visible?() , action() }], onClose?() }
import { ctx, css } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import * as S from "../garage/sound.js";

css("shops-card", `
.card.decor-card.shops-card { width: min(820px, 100%); max-height: 66vh; overflow-y: auto; padding: 10px 14px 8px; }
.shops-card .dp-row { grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 6px; }
.shops-card .dp-opt { min-height: 74px; padding: 6px 4px 5px; }
.shops-card .dp-opt i { font-size: 24px; }
.shops-card .dp-desc { margin: 6px 2px 2px; }
.card.decor-card.shops-card .menu { flex-direction: row; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.sp-head { margin: 0 2px 8px; color: #3b2140; font-size: 14px; }
.sp-head:empty { display: none; }
.sp-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px 10px; margin-top: 4px; }
.sp-stat { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: #6d5a70; }
.sp-bar { display: block; height: 7px; border-radius: 999px; background: #EDE4EF; overflow: hidden; margin-top: 2px; }
.sp-bar i { display: block; height: 100%; border-radius: 999px; }
.sp-chip { display: inline-block; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; background: #3b2140; color: #fff; margin-left: 6px; vertical-align: 2px; }
.shops-card .dp-opt i.sp-dot { width: 30px; height: 30px; border-radius: 50%; display: block; box-shadow: inset 0 -4px 0 rgba(0,0,0,.18); }
.shops-card .dp-opt.na { opacity: .62; }
@media (max-width: 560px) { .shops-card .dp-row { grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 5px; }
  .shops-card .dp-opt { padding: 4px 2px; } .shops-card .dp-opt b { font-size: 10.5px; } .shops-card .dp-opt em { font-size: 10px; padding: 0 5px; } }
@media (max-width: 560px), (max-height: 460px) { .shops-card .dp-opt { min-height: 58px; } .shops-card .dp-opt i { font-size: 20px; } .card.decor-card.shops-card { max-height: 64vh; } .sp-head { font-size: 12px; margin-bottom: 5px; } .sp-stats { gap: 2px 6px; } .shops-card .dp-opt i.sp-dot { width: 22px; height: 22px; } }
body.tv .shops-card .dp-row { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } body.tv .shops-card .dp-opt { min-height: 110px; }
body.tv .sp-head { font-size: 20px; } body.tv .sp-stat { font-size: 15px; } body.tv .sp-bar { height: 11px; }
body.tv .shops-card .dp-opt i.sp-dot { width: 44px; height: 44px; }
`);

const C = { open: false, spec: null, focusId: null, confirm: null, card: null, msg: "" };
const fmt = n => Math.round(n).toLocaleString("en-US");
const call = (f, d = "") => (typeof f === "function" ? f() : f != null ? f : d);

export const cardOpen = () => C.open;
export const cardFocus = () => (C.open ? C.focusId : null);
export const cardSpec = () => (C.open ? C.spec : null);

function tileOf(id) { return C.spec && C.spec.tiles.find(t => t.id === id); }
function stateOf(t) { return t.state ? t.state() : t.price != null ? "buy" : "none"; }
function tagOf(t) {
    if (t.tag) { const s = t.tag(); if (s) return s; }
    const st = stateOf(t);
    if (st === "placed") return "✓ Yours";
    if (st === "owned") return "Yours";
    if (t.price == null) return "";
    if (C.confirm === t.id) return `Buy · ${fmt(t.price)} 💰?`;
    return t.price ? `${fmt(t.price)} 💰` : "Free";
}
function paint() {
    const card = C.card;
    if (!card || !C.open) return;
    const coins = card.querySelector(".dp-coins");
    if (coins) coins.innerHTML = `💰 <b>${fmt(wallet.coins)}</b>`;
    const head = card.querySelector(".sp-head");
    if (head && C.spec.head) head.innerHTML = C.spec.head(C.focusId) || "";
    for (const b of card.querySelectorAll(".dp-opt")) {
        const t = tileOf(b.dataset.opt);
        if (!t) continue;
        const st = stateOf(t);
        b.classList.toggle("placed", st === "placed");
        b.classList.toggle("owned", st === "owned");
        b.classList.toggle("na", st === "na");
        b.classList.toggle("poor", st === "buy" && t.price != null && wallet.coins < t.price && C.confirm !== t.id);
        b.classList.toggle("confirm", C.confirm === t.id);
        const em = b.querySelector("em");
        const tg = tagOf(t);
        em.textContent = tg;
        em.style.display = tg ? "" : "none";
    }
    const f = tileOf(C.focusId), d = card.querySelector(".dp-desc");
    if (d) d.innerHTML = C.msg || (f ? call(f.desc, "") : "");
    for (const bt of C.spec.buttons || []) {
        const el = card.querySelector(`[data-spbtn="${bt.id}"]`);
        if (!el) continue;
        const vis = bt.visible ? !!bt.visible(C.focusId) : true;
        el.style.display = vis ? "" : "none";
        const lab = typeof bt.label === "function" ? bt.label(C.focusId) : bt.label;
        if (el.dataset.lab !== lab) { el.dataset.lab = lab; el.innerHTML = lab; }
    }
}

/** Open the card (closes any other first). → the card element */
export function openCard(spec) {
    if (C.open) closeCard(true);
    Object.assign(C, { open: true, spec, focusId: null, confirm: null, msg: "" });
    const tiles = spec.tiles.map(t => `<button class="dp-opt" data-opt="${t.id}">${t.dot ? `<i class="sp-dot" style="background:${t.dot}"></i>` : `<i>${t.icon || ""}</i>`}<b>${t.name}</b><em></em></button>`).join("");
    const html = `<div class="dp sp"><div class="dp-head"><span class="dp-title">${spec.title}</span><span class="dp-coins"></span></div>
      <div class="sp-head"></div><div class="dp-row">${tiles}</div><div class="dp-desc"></div></div>`;
    const cur = Math.max(0, spec.tiles.findIndex(t => t.id === spec.focus));
    const buttons = (spec.buttons || []).map(b => ({ label: typeof b.label === "function" ? b.label(spec.tiles[cur].id) : b.label, cls: b.cls || "", action: () => { if (C.open) { b.action(C.focusId); paint(); } } }));
    buttons.push({ label: `Done ${glyph("back")}`, cls: "secondary", action: () => closeCard() });
    document.body.classList.add("decor-picking");
    C.card = H.showScreen(html, buttons, { onBack: () => closeCard(), focus: cur, cls: "decor-card shops-card" });
    const btnEls = C.card.querySelectorAll(".menu .btn");
    (spec.buttons || []).forEach((b, i) => { if (btnEls[i]) btnEls[i].dataset.spbtn = b.id; });
    for (const b of C.card.querySelectorAll(".dp-opt")) b.addEventListener("click", () => press(b.dataset.opt, b));
    C.focusId = spec.tiles[cur].id;
    if (spec.onFocus) { try { spec.onFocus(C.focusId); } catch (e) { console.error("[shops] focus", e); } }
    paint();
    return C.card;
}

/** A tile was pressed (✕ / A / Enter / a tap). */
export function press(id, btn = null) {
    if (!C.open) return;
    const t = tileOf(id);
    if (!t) return;
    C.msg = "";
    if (C.focusId !== id) { C.focusId = id; if (C.spec.onFocus) C.spec.onFocus(id); }
    btn = btn || (C.card && C.card.querySelector(`.dp-opt[data-opt="${id}"]`));
    // (a tap / click on a tile that isn't the menu's focus yet: move the focus there, so the next frame's focus check
    //  doesn't snap back to the old tile)
    if (btn && !btn.classList.contains("focus")) H.setFocus(btn);
    const st = stateOf(t);
    if (st !== "buy" || !t.buy) {
        C.confirm = null;
        if (t.act) t.act(); else shake(btn);
        paint();
        return;
    }
    if (wallet.coins < t.price) {
        C.confirm = null;
        S.sfxDeny(); shake(btn);
        C.msg = `Need <b>${fmt(t.price - wallet.coins)}</b> more coins.`;
        paint();
        return;
    }
    if (C.confirm !== id) { C.confirm = id; A.sfxMove(); paint(); return; }
    C.confirm = null;
    const r = t.buy() || { ok: false };
    if (r.ok) { S.sfxBuy(); rumble(0.3, 0.6, 200, true); }
    else { S.sfxDeny(); shake(btn); }
    paint();
}
function shake(b) { if (!b) return; b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); }

/** A line in the card's description row (cleared by the next press / focus). */
export function cardSay(html) { C.msg = html; paint(); }
export function repaint() { paint(); }

/** Put it away. */
export function closeCard(silent = false) {
    if (!C.open) return;
    const spec = C.spec;
    C.open = false; C.card = null; C.confirm = null; C.msg = "";
    document.body.classList.remove("decor-picking");
    if (H.screenOpen() && H.screenCard().querySelector(".sp")) H.hideScreen();
    // (the caller's camera framed the shelf / the car: glide back to her, never a swoop — the watchdog's > 5 m a frame)
    if (ctx.state === "footRun" && ctx.cam && ctx.cam.blend) ctx.cam.blend(0.8);
    if (!silent && spec && spec.onClose) { try { spec.onClose(); } catch (e) { console.error("[shops] close", e); } }
}

/** Every frame while it's open (the host's update): menu input + focus changes. → still open? */
export function cardTick(P) {
    if (!C.open) return false;
    if (!H.screenOpen() || !H.screenCard().querySelector(".sp")) { closeCard(); return false; }
    H.menuInput(P);
    if (!C.open) return false;
    const f = H.screenCard().querySelector(".dp-opt.focus");
    const id = f ? f.dataset.opt : null;
    if (id && id !== C.focusId) {
        C.focusId = id; C.msg = "";
        if (C.confirm && C.confirm !== id) C.confirm = null;
        if (C.spec.onFocus) { try { C.spec.onFocus(id); } catch (e) { console.error("[shops] focus", e); } }
        paint();
    }
    return true;
}
