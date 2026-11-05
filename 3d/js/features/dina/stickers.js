// Dina's Sticker Book (2D: stickerBook). Spend 💰 on stickers and decorate
// the page. Placements live in the SHARED 2D save (save.stickerBook, entries
// {e, x, y, rot, scale} in the 2D canvas's page rect x 40–440, y 110–490), so
// the 2D game shows exactly the same page.
//
// Controller: D-pad through the tray, ✕ picks a sticker; then steer the
// cursor over the page with the stick / D-pad and ✕ to stick it (○ puts it
// back). Mouse / touch: tap a sticker, then tap the page.
import { ctx, registerState, setState, css, emit } from "../../core/ctx.js";
import { shared, wallet } from "../../core/save.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { room, SPOTS } from "./room.js";
import { Home } from "./home.js";
import { L, sfx, rand, clamp, g, isTouch } from "./common.js";

export const STICKER_KINDS = [   // emoji + 💰 cost (2D STICKER_KINDS)
    { e: "⭐", cost: 1 }, { e: "💖", cost: 1 }, { e: "🌈", cost: 2 },
    { e: "🦄", cost: 3 }, { e: "🌸", cost: 1 }, { e: "🐱", cost: 2 },
    { e: "🍦", cost: 2 }, { e: "🎀", cost: 1 }, { e: "🦋", cost: 2 },
    { e: "🍓", cost: 1 }, { e: "🌟", cost: 1 }, { e: "🐶", cost: 2 },
];
export const PAGE = { x: 40, y: 110, w: 400, h: 380 };   // the 2D page rect (W = 480)

css("dina-stickers", `
#screen .card.dina-stickers { width: min(1000px, 100%); padding: 14px 18px 16px; background: #E8C9A0;
  background-image: repeating-linear-gradient(0deg, rgba(150,110,70,.18) 0 2px, transparent 2px 26px); }
.dina-stickers h2 { margin: 0; font-size: 24px; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,.35); }
.dina-stickers .sb-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; background: rgba(0,0,0,.45);
  border-radius: 16px; padding: 6px 10px; }
.dina-stickers .sb-coins { color: #FFD54F; font-weight: 700; font-size: 20px; white-space: nowrap; }
.dina-stickers .sb-back { background: #A8E6CF; color: #1B5E20; border: none; border-radius: 14px; padding: 7px 12px; font: 700 16px var(--font); cursor: pointer;
  box-shadow: 0 3px 0 #388E3C; display: flex; gap: 6px; align-items: center; }
.dina-stickers .sb-msg { min-height: 24px; margin: 6px 0; font-weight: 700; font-size: 16px; color: #5D4037; }
.dina-stickers .sb-msg.held { color: #7C4DFF; }
.dina-stickers .sb-main { display: flex; gap: 14px; align-items: flex-start; justify-content: center; }
.dina-stickers .sb-pagewrap { position: relative; flex: none; }
.dina-stickers .sb-page { position: absolute; left: 0; top: 0; width: 400px; height: 380px; transform-origin: 0 0; border-radius: 14px;
  background-color: #FFFDF7; border: 3px solid #FF80AB; box-shadow: 4px 5px 0 rgba(0,0,0,.18); overflow: hidden; cursor: crosshair;
  background-image: radial-gradient(circle, rgba(255,180,200,.45) 2px, transparent 2.5px); background-size: 40px 40px; background-position: 10px 10px; }
.dina-stickers .sb-rings { position: absolute; left: 0; top: -9px; width: 400px; height: 18px; pointer-events: none; transform-origin: 0 0;
  background-image: radial-gradient(circle at 50% 0%, transparent 5px, #B07B4F 5px, #B07B4F 7.5px, transparent 8px); background-size: 26px 18px;
  background-position: 7px 0; }
.dina-stickers .sb-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #C9A0B0; font-style: italic; font-size: 17px; pointer-events: none; }
.dina-stickers .sb-st { position: absolute; font-size: 30px; line-height: 1; pointer-events: none;
  filter: drop-shadow(1px 2px 0 rgba(0,0,0,.12)) drop-shadow(0 0 0 #fff); }
.dina-stickers .sb-st::before { content: ""; position: absolute; left: 50%; top: 50%; width: 36px; height: 36px; margin: -17px 0 0 -17px;
  border-radius: 50%; background: rgba(0,0,0,.10); z-index: -1; }
.dina-stickers .sb-cursor { position: absolute; font-size: 30px; line-height: 1; pointer-events: none; transform: translate(-50%, -50%);
  opacity: .78; display: none; }
.dina-stickers .sb-cursor::after { content: ""; position: absolute; left: 50%; top: 50%; width: 46px; height: 46px; margin: -23px 0 0 -23px;
  border-radius: 50%; border: 3px dashed #7C4DFF; animation: sbspin 2.4s linear infinite; }
@keyframes sbspin { to { transform: rotate(360deg); } }
.dina-stickers .sb-spark { position: absolute; width: 7px; height: 7px; margin: -3px; border-radius: 50%; pointer-events: none; animation: sbspark .5s ease-out forwards; }
@keyframes sbspark { to { transform: translate(var(--dx), var(--dy)); opacity: 0; } }
.dina-stickers .sb-side { flex: 1; min-width: 0; max-width: 470px; display: flex; flex-direction: column; gap: 8px; }
.dina-stickers .sb-label { font-weight: 700; font-size: 14px; color: #5D4037; }
.dina-stickers .sb-tray { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.dina-stickers .sb-tile { border: 2px solid #B0A08F; border-radius: 12px; background: #fff; padding: 4px 0 3px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; font: 700 12px var(--font); color: #FF8F00; }
.dina-stickers .sb-tile .em { font-size: 28px; line-height: 1.1; }
.dina-stickers .sb-tile.poor { background: #D7CCC8; color: #9E9E9E; }
.dina-stickers .sb-tile.poor .em { opacity: .45; }
.dina-stickers .sb-tile.held { background: #FFF59D; border: 3px solid #FBC02D; }
.dina-stickers .sb-tile.focus, .dina-stickers .sb-back.focus, .dina-stickers .sb-clear.focus { outline: 4px solid #fff; box-shadow: 0 0 0 7px rgba(233,30,99,.55); transform: scale(1.06); }
.dina-stickers .sb-clear { align-self: flex-end; background: #EF9A9A; color: #fff; border: 2px solid #C62828; border-radius: 12px; padding: 8px 16px;
  font: 700 15px var(--font); cursor: pointer; text-shadow: 0 1px 0 rgba(0,0,0,.3); }
.dina-stickers .sb-clear.armed { background: #E53935; }
.dina-stickers .sb-help { font-size: 13px; color: #5D4037; opacity: .85; }
.dina-stickers.placing .sb-tile:not(.held), .dina-stickers.placing .sb-clear { opacity: .5; }
@media (max-aspect-ratio: 1/1) {
  .dina-stickers .sb-main { flex-direction: column; align-items: center; }
  .dina-stickers .sb-side { max-width: 100%; width: 100%; }
}
body.tv #screen .card.dina-stickers { width: min(1500px, 100%); }
body.tv .dina-stickers .sb-tile .em { font-size: 40px; }
body.tv .dina-stickers h2 { font-size: 34px; }
body.tv .dina-stickers .sb-msg, body.tv .dina-stickers .sb-label { font-size: 22px; }
`);

const SB = { held: null, msg: "", msgT: 0, clearArmT: 0, placing: false, cx: 240, cy: 300, card: null, k: 1 };

function book() { const b = shared.get().stickerBook; return Array.isArray(b) ? b : []; }
function say(msg, t) { SB.msg = msg; SB.msgT = t; renderMsg(); }

function render(focusId) {
    const coins = wallet.coins;
    const tiles = STICKER_KINDS.map((k, i) => {
        const poor = coins < k.cost, held = SB.held === k;
        return `<button class="sb-tile${poor ? " poor" : ""}${held ? " held" : ""}" id="sbt${i}" data-i="${i}"><span class="em">${k.e}</span>💰${k.cost}</button>`;
    }).join("");
    const html = `<div class="sb">
        <div class="sb-head"><button class="sb-back" id="sbBack">◀ ${g("back")}</button><h2>📖 Dina's Sticker Book</h2><div class="sb-coins">💰 ${coins.toLocaleString()}</div></div>
        <div class="sb-msg"></div>
        <div class="sb-main">
            <div class="sb-pagewrap"><div class="sb-page"></div><div class="sb-rings"></div></div>
            <div class="sb-side">
                <div class="sb-label">${isTouch() ? "Tap a sticker (costs 💰), then tap the page" : `Pick a sticker (costs 💰) ${g("confirm")}, then place it on the page ${g("confirm")}`}</div>
                <div class="sb-tray">${tiles}</div>
                <div class="sb-help">${isTouch() ? "" : `${g("move")} move the sticker · ${g("back")} put it back`}</div>
                <button class="sb-clear${SB.clearArmT > 0 ? " armed" : ""}" id="sbClear">${SB.clearArmT > 0 ? "🗑 Sure?" : "🗑 Clear"}</button>
            </div>
        </div></div>`;
    const card = H.showScreen(html, [], { cls: "dina-stickers" + (SB.placing ? " placing" : ""), wide: true, onBack: back, focus: focusId || (SB.held ? "sbt" + STICKER_KINDS.indexOf(SB.held) : "sbt0") });
    SB.card = card;
    card.querySelector("#sbBack").addEventListener("click", back);
    card.querySelector("#sbClear").addEventListener("click", clearPage);
    card.querySelectorAll(".sb-tile").forEach(b => b.addEventListener("click", () => pick(+b.dataset.i)));
    const page = card.querySelector(".sb-page");
    page.addEventListener("pointerdown", e => {
        if (!SB.held) { say(isTouch() ? "Tap a sticker first!" : "Pick a sticker first!", 1.4); return; }
        const p = pagePoint(e);
        SB.cx = p.x; SB.cy = p.y;
        place();
    });
    page.addEventListener("pointermove", e => { if (SB.held && e.pointerType === "mouse") { const p = pagePoint(e); SB.cx = p.x; SB.cy = p.y; drawCursor(); } });
    layout();
    drawPage();
    renderMsg();
}

function layout() {
    const card = SB.card; if (!card) return;
    const wrap = card.querySelector(".sb-pagewrap");
    const portrait = window.innerWidth < window.innerHeight;
    const tv = document.body.classList.contains("tv");
    const availW = portrait ? Math.min(window.innerWidth - 60, 560) : Math.min(window.innerWidth * 0.52, tv ? 760 : 560);
    const availH = portrait ? window.innerHeight * 0.42 : window.innerHeight - 190;
    SB.k = Math.max(0.45, Math.min(availW / 406, availH / 386, tv ? 1.9 : 1.4));
    wrap.style.width = (406 * SB.k).toFixed(0) + "px";
    wrap.style.height = (386 * SB.k).toFixed(0) + "px";
    for (const el of card.querySelectorAll(".sb-page, .sb-rings")) el.style.transform = `scale(${SB.k})`;
}
function pagePoint(e) {
    const r = SB.card.querySelector(".sb-page").getBoundingClientRect();
    return { x: PAGE.x + clamp((e.clientX - r.left) / SB.k, 0, PAGE.w), y: PAGE.y + clamp((e.clientY - r.top) / SB.k, 0, PAGE.h) };
}
function drawPage() {
    const page = SB.card && SB.card.querySelector(".sb-page"); if (!page) return;
    const b = book();
    page.innerHTML = (b.length ? "" : `<div class="sb-empty"><div>Your page is empty —</div><div>decorate it below! 💕</div></div>`) +
        b.map(s => `<span class="sb-st" style="left:${(s.x - PAGE.x).toFixed(1)}px;top:${(s.y - PAGE.y).toFixed(1)}px;transform:translate(-50%,-50%) rotate(${(+s.rot || 0).toFixed(3)}rad) scale(${(+s.scale || 1).toFixed(3)})">${s.e || "⭐"}</span>`).join("") +
        `<span class="sb-cursor"></span>`;
    drawCursor();
}
function drawCursor() {
    const c = SB.card && SB.card.querySelector(".sb-cursor"); if (!c) return;
    c.style.display = SB.held ? "block" : "none";
    if (!SB.held) return;
    c.textContent = SB.held.e;
    c.style.left = (SB.cx - PAGE.x).toFixed(1) + "px";
    c.style.top = (SB.cy - PAGE.y).toFixed(1) + "px";
}
function renderMsg() {
    const m = SB.card && SB.card.querySelector(".sb-msg"); if (!m) return;
    if (SB.held) { m.className = "sb-msg held"; m.textContent = `Holding ${SB.held.e} — ${isTouch() ? "tap the page!" : "place it on the page!"}`; }
    else { m.className = "sb-msg"; m.textContent = SB.msgT > 0 ? SB.msg : ""; }
}

function pick(i) {
    const k = STICKER_KINDS[i];
    if (SB.clearArmT > 0) SB.clearArmT = 0;
    if (wallet.coins >= k.cost) {
        SB.held = k;
        SB.placing = !isTouch();
        say(`Now tap the page to place ${k.e}`, 2.5);
        sfx.click();
    } else {
        SB.held = null; SB.placing = false;
        say(`Need 💰${k.cost} for that one`, 1.8);
        sfx.deny();
    }
    render("sbt" + i);
}
/** Stick the held sticker at the cursor (SB.cx, SB.cy in 2D page coordinates). */
export function place() {
    const k = SB.held;
    if (!k) return false;
    if (!wallet.spend(k.cost)) { SB.held = null; SB.placing = false; say(`Need 💰${k.cost} for that one`, 1.8); sfx.deny(); render(); return false; }
    const st = { e: k.e, x: Math.round(SB.cx * 10) / 10, y: Math.round(SB.cy * 10) / 10, rot: +rand(-0.35, 0.35).toFixed(3), scale: +rand(0.9, 1.25).toFixed(3) };
    shared.update(s => { if (!Array.isArray(s.stickerBook)) s.stickerBook = []; s.stickerBook.push(st); });
    emit("stat", { id: "stickers", n: 1 });
    sfx.tone(700, 0.07, "sine", 0.16); sfx.tone(950, 0.08, "sine", 0.14, 0, 0.06);
    say(`Pretty! 💰${wallet.coins} left`, 1.6);
    // keep the same sticker held if still affordable, else drop it
    if (wallet.coins < k.cost) { SB.held = null; SB.placing = false; }
    const i = STICKER_KINDS.indexOf(k);
    render("sbt" + i);
    sparkle(st.x, st.y);
    return true;
}
function sparkle(x, y) {
    const page = SB.card && SB.card.querySelector(".sb-page"); if (!page) return;
    const cols = ["#FFD700", "#FF80AB", "#7C4DFF", "#4FC3F7"];
    for (let i = 0; i < 10; i++) {
        const a = Math.PI * 2 / 10 * i, r = rand(20, 55);
        const s = document.createElement("span");
        s.className = "sb-spark";
        s.style.cssText = `left:${x - PAGE.x}px;top:${y - PAGE.y}px;background:${cols[i % 4]};--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px`;
        page.appendChild(s);
        setTimeout(() => s.remove(), 520);
    }
}
function clearPage() {
    if (!book().length) return;
    if (SB.clearArmT > 0) {
        shared.update(s => { s.stickerBook = []; });
        SB.clearArmT = 0;
        say("Cleared the page!", 1.6);
        sfx.tone(300, 0.12, "square", 0.14);
    } else {
        SB.clearArmT = 2.5;
        say("Tap 🗑 again to clear EVERYTHING", 2.5);
        sfx.tone(520, 0.08, "triangle", 0.14);
    }
    SB.held = null; SB.placing = false;
    render("sbClear");
}
function back() { sfx.click(); setState("dinaHome", { from: "stickers" }); }

registerState("dinaStickers", {
    hud: false, touch: false, pausable: false, world: false,
    enter() {
        const rm = room();
        rm.set.show();
        Object.assign(SB, { held: null, msg: "Tap a sticker, then tap the page!", msgT: 3, clearArmT: 0, placing: false, cx: 240, cy: 300 });
        if (!Array.isArray(shared.get().stickerBook)) shared.update(s => { s.stickerBook = []; });
        if (Home.dina) Home.dina.obj.visible = false;
        render();
        sfx.tone(880, 0.08, "triangle", 0.15); sfx.tone(1100, 0.1, "triangle", 0.15, 0, 0.08);
        window.addEventListener("resize", layout);
    },
    exit() {
        window.removeEventListener("resize", layout);
        H.hideScreen();
        SB.card = null;
        if (Home.dina) Home.dina.obj.visible = true;
    },
    update(dt, P) {
        const rm = room();
        rm.tick(dt, ctx.stateT);
        const cam = rm.set.camera;
        cam.position.set(SPOTS.sticker.x, 2.6, SPOTS.sticker.z + 1.6);
        cam.lookAt(SPOTS.sticker.x, 0, SPOTS.sticker.z);
        if (SB.msgT > 0) { SB.msgT -= dt; if (SB.msgT <= 0) renderMsg(); }
        if (SB.clearArmT > 0) {
            SB.clearArmT -= dt;
            if (SB.clearArmT <= 0) { const b = SB.card && SB.card.querySelector("#sbClear"); if (b) { b.classList.remove("armed"); b.textContent = "🗑 Clear"; } }
        }
        if (SB.placing && SB.held) {
            // steer the sticker over the page
            const sp = 300 * dt;
            SB.cx = clamp(SB.cx + input.moveX * sp, PAGE.x + 6, PAGE.x + PAGE.w - 6);
            SB.cy = clamp(SB.cy + input.moveY * sp, PAGE.y + 6, PAGE.y + PAGE.h - 6);
            drawCursor();
            if (P.confirm || P.interact) place();
            else if (P.back) { SB.held = null; SB.placing = false; say("Put it back.", 1.0); render(); }
            return;
        }
        H.menuInput(P);
    },
});
