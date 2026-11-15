// features/party — UI pieces: the CSS, the hub ("🎉 Party with friends"),
// the code-entry keyboard, the driving HUD (one standings panel + one chip),
// the synced countdown, and the QUICK-CHAT wheel (curated phrases + emotes,
// no free text). Every screen is a showScreen card → D-pad + ✕/○ work,
// prompts use glyph(); one big primary button per screen.
import { ctx, css } from "../../core/ctx.js";
import { glyph, input } from "../../input.js";
import * as H from "../../hud.js";
import { CODE_ABC, CODE_LEN } from "./net.js";

css("party", `
.pt-card { text-align: center; }
.pt-card h2 { margin: 2px 0 6px; }
.pt-sub { font-size: 15px; opacity: .75; margin: 0 0 10px; font-weight: 600; }
.pt-big { width: min(380px, 100%) !important; font-size: 22px !important; padding: 16px 18px !important; }
.pt-hub .btn { width: min(380px, 100%); }
.pt-hub .btn small, .pt-card .btn small.d { display: block; font-size: 12px; font-weight: 600; opacity: .85; letter-spacing: .02em; }
.pt-hub .btn { flex-direction: column; gap: 2px; }
.pt-hub .btn > span, .pt-lobby .btn > span { display: inline-flex; align-items: center; gap: 10px; }
.pt-code { display: flex; gap: 8px; justify-content: center; margin: 6px 0 4px; }
.pt-code span { width: 50px; height: 60px; border-radius: 12px; background: #2b1b2e; color: #FFD54F; font: 700 38px/60px var(--font);
  box-shadow: inset 0 0 0 3px #7E57C2, 0 4px 0 rgba(0,0,0,.2); }
.pt-code span.empty { color: rgba(255,213,79,.25); }
.pt-code span.cur { box-shadow: inset 0 0 0 3px #FFD54F, 0 4px 0 rgba(0,0,0,.2); }
.pt-keys { display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; width: min(380px, 100%); margin: 10px auto 0; }
.pt-keys .btn { width: 100%; padding: 10px 0; font-size: 22px; border-radius: 12px; background: #5E548E; }
.pt-keys .btn.del { background: #8D6E63; font-size: 17px; }
.pt-msg { font-weight: 700; margin: 8px 0 0; min-height: 22px; }
.pt-msg.bad { color: #C62828; } .pt-msg.ok { color: #2E7D32; }
/* lobby */
.pt-lobby { width: min(520px, 100%) !important; padding: 16px 20px !important; }
.pt-row { display: flex; gap: 8px; justify-content: center; align-items: center; flex-wrap: wrap; }
.pt-code.sm span { width: 38px; height: 46px; font-size: 28px; line-height: 46px; border-radius: 10px; }
.pt-invite { width: auto !important; padding: 9px 14px !important; font-size: 15px !important; background: #26A69A !important; }
.pt-link { font-size: 12px; opacity: .6; margin-top: 2px; word-break: break-all; }
.pt-crew { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 10px 0 2px; }
.pt-crew span { background: #fff; border-radius: 999px; padding: 3px 11px 3px 6px; font-size: 14px; font-weight: 700; box-shadow: 0 2px 0 rgba(0,0,0,.08); white-space: nowrap; }
.pt-crew span.me { background: #FCE4EC; }
.pt-crew span.dim { opacity: .5; }
.pt-crew i { display: inline-block; width: 13px; height: 13px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; box-shadow: 0 0 0 2px rgba(0,0,0,.12); }
.pt-h { font-size: 12px; font-weight: 700; letter-spacing: .12em; opacity: .55; margin: 12px 0 6px; text-transform: uppercase; }
.pt-opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; }
.pt-opts .btn { width: 100%; font-size: 14px; padding: 9px 6px; border-radius: 14px; background: #7E57C2; flex-direction: column; gap: 0; }
.pt-opts .btn small { font-size: 10px; opacity: .75; letter-spacing: .1em; }
.pt-acts { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px; }
.pt-acts .btn { width: 100%; font-size: 16px; padding: 10px 6px; border-radius: 14px; background: #fff; color: var(--ink); flex-direction: column; gap: 1px;
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.08), 0 3px 0 rgba(0,0,0,.12); }
.pt-acts .btn small { font-size: 11px; font-weight: 600; opacity: .65; }
.pt-acts .btn.sel { background: #FFF3C4; box-shadow: inset 0 0 0 3px #FFB300, 0 3px 0 rgba(0,0,0,.12); }
.pt-next { background: #fff; border-radius: 16px; padding: 10px 12px; font-weight: 700; font-size: 17px; }
.pt-next small { display: block; font-size: 13px; font-weight: 600; opacity: .65; }
.pt-leave { width: auto !important; font-size: 14px !important; padding: 8px 16px !important; background: #A1887F !important; margin-top: 4px; }
.pt-status { font-size: 14px; font-weight: 700; margin-top: 8px; opacity: .8; }
@media (min-aspect-ratio: 5/4) and (min-width: 820px) {
  body.party-stage .screen { justify-content: flex-start; padding-left: max(4vw, 20px); background: linear-gradient(90deg, rgba(43,27,46,.4), rgba(43,27,46,0) 55%); }
  body.party-stage .card { width: min(500px, 44vw); }
}
@media (max-aspect-ratio: 1/1) {
  body.party-stage .screen { align-items: flex-end; background: linear-gradient(0deg, rgba(43,27,46,.35), rgba(43,27,46,0) 60%); }
  body.party-stage .card { max-height: 60%; }
}
/* results */
.pt-res { background: #fff; border-radius: 16px; padding: 6px 10px; margin: 8px 0; text-align: left; }
.pt-res div { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 5px 6px; border-radius: 10px; font-weight: 700; font-size: 16px; }
.pt-res div.me { background: #FCE4EC; }
.pt-res div b { font-size: 20px; width: 34px; text-align: center; }
.pt-res div span.n { flex: 1; }
.pt-res div span.t { opacity: .7; font-variant-numeric: tabular-nums; }
.pt-res i { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 6px; }
/* HUD */
body.party-drive #hearts, body.party-drive .hud-tl .pill.score { display: none !important; }
#ptBoard { background: rgba(20,16,36,.62); color: #fff; border-radius: 14px; padding: 6px 10px 7px; min-width: 150px; font-size: 13px; font-weight: 700; pointer-events: none; }
#ptBoard .t { color: #FFD54F; font-size: 11px; letter-spacing: .12em; margin-bottom: 2px; }
#ptBoard .r { display: flex; align-items: center; gap: 6px; padding: 1px 0; white-space: nowrap; }
#ptBoard .r.me { color: #FFE082; }
#ptBoard .r.dim { opacity: .45; }
#ptBoard .r i { width: 9px; height: 9px; border-radius: 50%; flex: none; box-shadow: 0 0 0 1.5px rgba(255,255,255,.7); }
#ptBoard .r .n { flex: 1; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
#ptBoard .r .v { opacity: .8; font-variant-numeric: tabular-nums; font-size: 12px; }
#ptChip { display: none; border-radius: 999px; padding: 4px 14px; font-weight: 700; font-size: 15px; color: #fff; background: rgba(20,16,36,.66); box-shadow: 0 3px 8px rgba(0,0,0,.2); white-space: nowrap; }
#ptChip.gold { background: rgba(255,160,0,.92); color: #2b1b00; } #ptChip.green { background: rgba(46,125,50,.92); } #ptChip.pink { background: rgba(233,30,99,.92); }
#ptChip.place b { font-size: 22px; vertical-align: -2px; margin-right: 2px; }
#ptCount { position: fixed; inset: 0; pointer-events: none; z-index: 8; display: none; flex-direction: column; align-items: center; justify-content: center; font-family: var(--font); color: #fff; }
#ptCount b { font-size: 26px; color: #FFD54F; text-shadow: 0 3px 0 rgba(0,0,0,.6); letter-spacing: .06em; }
#ptCount .n { font-size: 120px; font-weight: 700; line-height: 1.05; text-shadow: 0 6px 0 #E91E63, 0 10px 24px rgba(0,0,0,.35); animation: ptPop .35s cubic-bezier(.2,1.6,.4,1); }
#ptCount small { font-size: 16px; font-weight: 700; text-shadow: 0 2px 0 rgba(0,0,0,.6); opacity: .9; }
@keyframes ptPop { from { transform: scale(1.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
#ptWheel { position: fixed; left: 50%; top: 52%; width: 0; height: 0; z-index: 9; pointer-events: none; }
#ptWheel.open { pointer-events: auto; }
#ptWheel .disc { position: absolute; transform: translate(-50%, -50%); min-width: 66px; height: 54px; padding: 0 12px; border-radius: 999px; border: none; cursor: pointer;
  background: rgba(30,24,48,.94); color: #fff; font: 700 16px var(--font); box-shadow: 0 0 0 3px #7E57C2, 0 6px 14px rgba(0,0,0,.35); white-space: nowrap; }
#ptWheel .disc.e { font-size: 30px; min-width: 58px; padding: 0; }
#ptWheel .disc.hot { transform: translate(-50%, -50%) scale(1.18); box-shadow: 0 0 0 4px #FFD54F, 0 6px 14px rgba(0,0,0,.35); }
#ptWheel .disc small { position: absolute; right: -4px; bottom: -6px; font-size: 11px; line-height: 16px; background: #fff; color: var(--ink); border-radius: 6px; padding: 0 4px; }
#ptWheel .hub { position: absolute; transform: translate(-50%, -50%); text-align: center; font-size: 13px; font-weight: 700; color: #fff; text-shadow: 0 2px 0 #000; width: 120px; }
#ptWheel .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.18); }
.pt-hint { font-size: 13px; }
body.tv .pt-code span { width: 74px; height: 88px; font-size: 56px; line-height: 88px; }
body.tv .pt-keys { width: min(620px, 100%); } body.tv .pt-keys .btn { font-size: 34px; padding: 14px 0; }
body.tv .pt-lobby { width: min(760px, 100%) !important; } body.tv .pt-opts .btn, body.tv .pt-acts .btn { font-size: 22px; } body.tv .pt-crew span { font-size: 20px; }
body.tv #ptBoard { font-size: 20px; min-width: 240px; } body.tv #ptBoard .t { font-size: 16px; } body.tv #ptChip { font-size: 22px; }
body.tv #ptWheel .disc { font-size: 24px; height: 76px; min-width: 96px; } body.tv #ptWheel .disc.e { font-size: 44px; }
@media (max-width: 600px) { #ptChip.place { display: none !important; } #ptBoard { min-width: 0; font-size: 12px; } #ptBoard .r .n { max-width: 84px; } #ptCount .n { font-size: 92px; } .pt-code span { width: 44px; height: 54px; font-size: 32px; line-height: 54px; } }
`);

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// ── the code keyboard (controller-first: a 5×4 letter grid + ⌫) ─────────
/** opts: { code, msg, msgCls, onDone(code), onBack } */
export function showCodeEntry(opts) {
    let code = opts.code || "";
    const render = focusId => {
        const slots = Array.from({ length: CODE_LEN }, (_, i) => `<span class="${code[i] ? "" : "empty"}${i === code.length ? " cur" : ""}">${code[i] || "·"}</span>`).join("");
        const keys = [...CODE_ABC].map(ch => `<button class="btn pt-k" id="ptk_${ch}">${ch}</button>`).join("") + "";
        const html = `<h2>🔑 Join a party</h2><p class="pt-sub">Type the code your friend sees on their screen.</p>
            <div class="pt-code">${slots}</div>
            <div class="pt-keys">${keys}</div>
            <div class="pt-msg ${opts.msgCls || ""}">${opts.msg || ""}</div>`;
        const ready = code.length === CODE_LEN;
        const card = H.showScreen(html, [
            { id: "ptk_go", label: ready ? `🎉 Join ${code} ${glyph("confirm")}` : `Join (${CODE_LEN - code.length} more)`, cls: ready ? "pt-big" : "pt-big alt", action: () => { if (code.length === CODE_LEN) opts.onDone(code); } },
            { id: "ptk_del", label: `⌫ Delete`, cls: "alt", action: () => { code = code.slice(0, -1); opts.msg = ""; render("ptk_del"); } },
            { id: "ptk_back", label: `Back ${glyph("back")}`, cls: "alt", action: opts.onBack },
        ], { onBack: () => { if (code.length) { code = code.slice(0, -1); render(); } else opts.onBack(); }, focus: focusId || (ready ? "ptk_go" : "ptk_" + CODE_ABC[0]), wide: false, cls: "pt-card pt-join" });
        for (const ch of CODE_ABC) {
            const b = card.querySelector("#ptk_" + ch);
            if (b) b.addEventListener("click", () => { if (code.length < CODE_LEN) { code += ch; opts.msg = ""; render(code.length === CODE_LEN ? "ptk_go" : "ptk_" + ch); } });
        }
        H.refreshFocus(true);
    };
    // physical keyboards: just type it
    const onKey = e => {
        if (!document.querySelector("#screenCard.pt-join")) { window.removeEventListener("keydown", onKey, true); return; }
        const k = (e.key || "").toUpperCase();
        if (k.length === 1 && CODE_ABC.includes(k) && code.length < CODE_LEN) { code += k; render(code.length === CODE_LEN ? "ptk_go" : null); e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("keydown", onKey, true);
    render();
}

// ── HUD: the standings panel (left) + one chip (centre) ──────────────────
let board = null, chip = null;
const last = {};
function setHtml(el, key, html) { if (last[key] !== html) { last[key] = html; el.innerHTML = html; } }
export function hud(boardHtml, chipHtml, chipCls) {
    if (!board) { board = document.createElement("div"); board.id = "ptBoard"; H.hudSlot("left").appendChild(board); }
    if (!chip) { chip = document.createElement("div"); chip.id = "ptChip"; H.hudSlot("center").appendChild(chip); }
    setHtml(board, "b", boardHtml || "");
    board.style.display = boardHtml ? "" : "none";
    setHtml(chip, "c", chipHtml || "");
    const cls = chipCls || "";
    if (last.cc !== cls) { last.cc = cls; chip.className = cls; }
    chip.style.display = chipHtml ? "inline-block" : "none";
}
export function hideHud() { if (board) board.style.display = "none"; if (chip) chip.style.display = "none"; }

// ── the synced countdown ─────────────────────────────────────────────────
const cnt = document.createElement("div");
cnt.id = "ptCount";
document.body.appendChild(cnt);
let cntKey = "";
export function countdown(title, n, sub) {
    const key = n == null ? "" : title + n + sub;
    if (key === cntKey) return;
    cntKey = key;
    if (n == null) { cnt.style.display = "none"; cnt.innerHTML = ""; return; }
    cnt.innerHTML = `<b>${title}</b><div class="n">${n}</div><small>${sub || ""}</small>`;
    cnt.style.display = "flex";
}

// ── QUICK CHAT wheel: hold ${glyph("fire")} (D-pad ↑) / F, aim, release ──────
export const PHRASES = ["Follow me!", "Wait up!", "Race you!", "GG!"];
export const EMOJIS = ["😂", "❤️", "😱", "🔥"];
export const ITEMS = [PHRASES[0], EMOJIS[0], PHRASES[1], EMOJIS[1], PHRASES[2], EMOJIS[2], PHRASES[3], EMOJIS[3]];
const W = { open: false, t: 0, hot: -1, byHold: false, holdT: 0, onPick: null };
const wheel = document.createElement("div");
wheel.id = "ptWheel";
document.body.appendChild(wheel);
wheel.addEventListener("click", e => {
    const b = e.target.closest(".disc");
    if (b) { pick(+b.dataset.i); return; }
    if (e.target.classList.contains("scrim")) closeWheel();
});
export function setChatHandler(fn) { W.onPick = fn; }
function pick(i) { const txt = ITEMS[i]; closeWheel(); if (W.onPick && txt) W.onPick(txt, i); }
export function openWheel(byHold) {
    if (W.open) return;
    W.open = true; W.t = 0; W.hot = -1; W.byHold = !!byHold;
    const R = window.innerWidth < 600 ? 112 : 150;
    wheel.innerHTML = `<div class="scrim"></div>` + ITEMS.map((txt, i) => {
        const a = -Math.PI / 2 + i * Math.PI * 2 / ITEMS.length;
        const e = [...txt].length <= 2;
        return `<button class="disc nav${e ? " e" : ""}" data-i="${i}" style="left:${(Math.cos(a) * R * 1.35).toFixed(0)}px;top:${(Math.sin(a) * R).toFixed(0)}px">${txt}<small>${i + 1}</small></button>`;
    }).join("") + `<div class="hub">${input.device === "gamepad" ? `R-stick, let go of ${glyph("fire")}` : input.device === "touch" ? "tap one" : "1–8 or click"}</div>`;
    wheel.classList.add("open");
}
export function closeWheel() { if (!W.open) return; W.open = false; wheel.classList.remove("open"); wheel.innerHTML = ""; W.byHold = false; }
export const wheelOpen = () => W.open;
/** Per frame while driving with friends. */
export function wheelTick(dt, on) {
    if (!on) { W.holdT = 0; closeWheel(); return; }
    if (input.fireHeld) {
        W.holdT += dt;
        if (W.holdT > 0.18 && !W.open && input.device !== "touch") openWheel(true);
    } else {
        if (W.open && W.byHold) { if (W.hot >= 0) pick(W.hot); else closeWheel(); }
        W.holdT = 0;
    }
    if (!W.open) return;
    W.t += dt;
    const lx = input.lookX, ly = input.lookY;
    if (Math.hypot(lx, ly) > 0.45) {
        const a = Math.atan2(ly, lx);
        let best = 0, bd = 9;
        ITEMS.forEach((_, i) => { const sa = -Math.PI / 2 + i * Math.PI * 2 / ITEMS.length; const d = Math.abs(((a - sa + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = i; } });
        W.hot = best;
    }
    wheel.querySelectorAll(".disc").forEach((b, i) => b.classList.toggle("hot", i === W.hot));
    if (!W.byHold && W.t > 4) closeWheel();
}
let keysOn = false;
export function setChatKeys(on) { keysOn = on; }
window.addEventListener("keydown", e => {
    if (!keysOn || e.repeat || ctx.paused) return;
    const m = /^Digit([1-8])$/.exec(e.code);
    if (m && W.onPick) { const i = +m[1] - 1; W.onPick(ITEMS[i], i); e.preventDefault(); }
});

/** Copy / share the invite link. Returns a promise of the message to show. */
export async function shareInvite(code) {
    const url = inviteUrl(code);
    const text = `Join my Lulu's Road Trip party! Code ${code}`;
    try {
        if (navigator.share && matchMedia("(pointer: coarse)").matches) { await navigator.share({ title: "Lulu's Road Trip 3D", text, url }); return "📤 Invite sent!"; }
    } catch (e) { if (e && e.name === "AbortError") return ""; }
    try { await navigator.clipboard.writeText(url); return "📋 Link copied — paste it to your friends!"; }
    catch (e) { return `Share this link: ${url}`; }
}
export function inviteUrl(code) { return `${location.origin}${location.pathname.replace(/index\.html$/, "")}?party=${code}`; }
