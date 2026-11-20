// features/decor/picker.js — the little "what goes here?" card for ONE spot.
//
// A compact strip of tiles at the bottom of the screen (the room / the porch stays visible above it — the camera
// frames the spot). Moving over a tile (D-pad, keys, the mouse) PREVIEWS it in place at once; ✕ / A / Enter / a tap
// on something she owns puts it there (free); on something new, the first press asks "Buy · 120 💰?" and the
// second one buys it — no accidental buys on a phone. ○ / B / Esc / Done closes the card (the preview goes back to
// what's placed). The host calls pickerTick(P) every frame while it's open (inside a Room mode or a foot script).
import { css } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { SETS } from "./data.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";

css("decor-picker", `
body.decor-picking .screen { align-items: flex-end; background: linear-gradient(180deg, rgba(43,27,46,0) 45%, rgba(43,27,46,.28)); padding-bottom: max(10px, env(safe-area-inset-bottom)); }
.card.decor-card { width: min(780px, 100%); max-height: 52vh; padding: 12px 14px 10px; text-align: left; }
.dp-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 0 2px 8px; }
.dp-title { font-weight: 700; font-size: 19px; color: var(--ink); }
.dp-coins { font-weight: 700; font-size: 16px; background: #FFF3C4; color: #7A5A00; border-radius: 999px; padding: 3px 12px; white-space: nowrap; }
.dp-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 8px; }
.dp-opt { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 6px 7px; border-radius: 16px; border: 3px solid transparent;
  background: #fff; color: var(--ink); font: inherit; cursor: pointer; box-shadow: 0 3px 0 rgba(0,0,0,.1); min-height: 92px; }
.dp-opt i { font-style: normal; font-size: 28px; line-height: 1.1; }
.dp-opt b { font-size: 13px; line-height: 1.15; text-align: center; }
.dp-opt em { font-style: normal; font-size: 12px; font-weight: 700; border-radius: 999px; padding: 1px 9px; margin-top: auto; background: #FFF3C4; color: #7A5A00; }
.dp-opt.owned em { background: #E3F2FD; color: #1565C0; }
.dp-opt.placed em { background: #E8F5E9; color: #2E7D32; }
.dp-opt.poor em { background: #F5F5F5; color: #9E9E9E; }
.dp-opt.confirm em { background: var(--pink); color: #fff; }
.dp-opt.focus { border-color: var(--pink); transform: translateY(-2px); }
.dp-opt.placed { background: #F3FFF4; }
.dp-opt.shake { animation: dpShake .35s; }
@keyframes dpShake { 25% { transform: translateX(-5px); } 50% { transform: translateX(5px); } 75% { transform: translateX(-3px); } }
.dp-set { white-space: nowrap; font-weight: 700; color: #AD1457; }
.dp-desc { min-height: 1.3em; margin: 8px 2px 4px; font-size: 14px; color: #5d4a60; }
.decor-card .menu { margin-top: 4px; }
.decor-card .menu .btn { padding: 8px 14px; font-size: 15px; }
@media (max-width: 560px), (max-height: 460px) {
  .card.decor-card { padding: 8px 10px 8px; max-height: 58vh; }
  .dp-row { grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
  .dp-opt { min-height: 74px; padding: 5px 4px; } .dp-opt i { font-size: 22px; } .dp-opt b { font-size: 11px; } .dp-opt em { font-size: 11px; }
  .dp-title { font-size: 16px; } .dp-desc { font-size: 12px; margin: 5px 2px 2px; }
}
body.tv .card.decor-card { width: min(1100px, 100%); padding: 18px 24px; }
body.tv .dp-row { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
body.tv .dp-opt { min-height: 130px; } body.tv .dp-opt i { font-size: 40px; } body.tv .dp-opt b { font-size: 19px; } body.tv .dp-opt em { font-size: 17px; }
body.tv .decor-card .menu .btn { font-size: 24px; padding: 12px 22px; }
body.tv .dp-title { font-size: 28px; } body.tv .dp-coins { font-size: 22px; } body.tv .dp-desc { font-size: 20px; }
`);

const PK = { open: false, slot: null, api: null, focusId: null, confirm: null, onClose: null, card: null };
const fmt = n => Math.round(n).toLocaleString("en-US");

/** Is the picker up? */
export const pickerOpen = () => PK.open;
export const pickerSlot = () => (PK.open ? PK.slot.id : null);

function tag(o) {
    const api = PK.api, s = PK.slot.id;
    if (api.placed(s) === o.id) return "✓ In place";
    if (api.owns(s, o.id)) return "Yours";
    if (PK.confirm === o.id) return `Buy · ${fmt(o.price)} 💰?`;
    return `${fmt(o.price)} 💰`;
}
function paint() {
    const card = PK.card;
    if (!card) return;
    const api = PK.api, s = PK.slot.id;
    card.querySelector(".dp-coins").innerHTML = `💰 <b>${fmt(wallet.coins)}</b>`;
    for (const b of card.querySelectorAll(".dp-opt")) {
        const o = PK.slot.opts.find(x => x.id === b.dataset.opt);
        b.classList.toggle("placed", api.placed(s) === o.id);
        b.classList.toggle("owned", api.owns(s, o.id) && api.placed(s) !== o.id);
        b.classList.toggle("poor", !api.owns(s, o.id) && wallet.coins < o.price && PK.confirm !== o.id);
        b.classList.toggle("confirm", PK.confirm === o.id);
        b.querySelector("em").textContent = tag(o);
    }
    const f = PK.slot.opts.find(x => x.id === PK.focusId);
    const d = card.querySelector(".dp-desc");
    const st = f && f.set ? SETS.find(x => x.id === f.set) : null;
    if (d) d.innerHTML = f ? `${f.desc}${st ? ` <span class="dp-set">· ${st.icon} ${st.name} set</span>` : ""}` : "";
}

/**
 * Open the picker for a slot. api = { owns(slot, opt), placed(slot), buy(slot, opt) → {ok, why}, place(slot, opt),
 * preview(slot, opt | null) }. onClose() when it's put away.
 */
export function openPicker(slot, api, onClose) {
    if (PK.open) closePicker(true);
    Object.assign(PK, { open: true, slot, api, focusId: null, confirm: null, onClose });
    const tiles = slot.opts.map(o => `<button class="dp-opt" data-opt="${o.id}"><i>${o.icon}</i><b>${o.name}</b><em></em></button>`).join("");
    const html = `<div class="dp"><div class="dp-head"><span class="dp-title">${slot.icon} ${slot.verb}</span><span class="dp-coins"></span></div>
      <div class="dp-row">${tiles}</div><div class="dp-desc"></div></div>`;
    const cur = Math.max(0, slot.opts.findIndex(o => o.id === api.placed(slot.id)));
    document.body.classList.add("decor-picking");
    PK.card = H.showScreen(html, [{ label: `Done ${glyph("back")}`, cls: "secondary", action: () => closePicker() }],
        { onBack: () => closePicker(), focus: cur, cls: "decor-card" });
    for (const b of PK.card.querySelectorAll(".dp-opt")) b.addEventListener("click", () => choose(b.dataset.opt, b));
    PK.focusId = slot.opts[cur].id;
    paint();
    return true;
}

function choose(id, btn) {
    if (!PK.open) return;
    const api = PK.api, s = PK.slot.id, o = PK.slot.opts.find(x => x.id === id);
    if (!o) return;
    if (PK.focusId !== id) { PK.focusId = id; api.preview(s, id); }
    if (api.placed(s) === id) { shake(btn); PK.confirm = null; paint(); return; }
    if (api.owns(s, id)) { api.place(s, id); PK.confirm = null; paint(); return; }
    if (PK.confirm !== id) { PK.confirm = id; A.sfxMove(); paint(); return; }
    const r = api.buy(s, id);
    PK.confirm = null;
    if (!r.ok) shake(btn);
    paint();
}
function shake(b) { if (!b) return; b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); }

/** Put the card away (the preview goes back to what's placed). */
export function closePicker(silent = false) {
    if (!PK.open) return;
    const { api, slot, onClose } = PK;
    PK.open = false; PK.card = null; PK.confirm = null;
    document.body.classList.remove("decor-picking");
    try { api.preview(slot.id, null); } catch (e) { console.error("[decor] preview", e); }
    if (H.screenOpen() && H.screenCard().querySelector(".dp")) H.hideScreen();
    if (!silent && typeof onClose === "function") { try { onClose(); } catch (e) { console.error("[decor] close", e); } }
}

/** Every frame while it's open: menu input + preview what's under the cursor. → still open? */
export function pickerTick(P) {
    if (!PK.open) return false;
    // (the pause menu — or anything else — took the screen: put ours away)
    if (!H.screenOpen() || !H.screenCard().querySelector(".dp")) { closePicker(); return false; }
    H.menuInput(P);
    if (!PK.open) return false;
    const f = H.screenCard().querySelector(".dp-opt.focus");
    const id = f ? f.dataset.opt : null;
    if (id && id !== PK.focusId) {
        PK.focusId = id;
        if (PK.confirm && PK.confirm !== id) PK.confirm = null;
        try { PK.api.preview(PK.slot.id, id); } catch (e) { console.error("[decor] preview", e); }
        paint();
    }
    return true;
}
