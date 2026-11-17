// features/moves — the 🏁 MOVES page: a tab in 📒 Lulu's Scrapbook (no new home
// tile). Every move with a glyph-aware how-to for the device in hand (PlayStation /
// Xbox / Switch / keyboard / touch), three mastery stars, personal bests, and the
// ON/OFF switch. The info panel follows the D-pad cursor (like the badges tab).
import { ctx, on, css } from "../../core/ctx.js";
import { input, glyph, glyphSet } from "../../input.js";
import { setControlRow } from "../../core/screens.js";
import { S, MOVES, MOVE, starsOf, saveSoon, fmtMult, reset, hideCallout } from "./common.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => Math.round(n || 0).toLocaleString();
let sel = "drift";

/** The how-to line for the device in hand ({action} → that device's glyph). */
export function howTo(m, device = input.device) {
    const h = m.how || {};
    if (device === "touch") return esc(h.touch || h.pad || "");
    if (device === "keyboard") return esc(h.key || h.pad || "");
    return esc(h.pad || "").replace(/\{(\w+)\}/g, (_, a) => glyph(a, "gamepad"));
}
function bestLine(m) {
    const b = S.best, q = S.q, n = S.n;
    switch (m.id) {
        case "drift": return `${fmt(n.drift)} turbos · ${fmt(q.drift3)} purple`;
        case "rocket": return `${fmt(n.rocket)} launches · ${fmt(q.perfect)} perfect`;
        case "slingshot": return `${fmt(n.slingshot)} slingshots · best ${fmt(b.slingCombo)} in a combo`;
        case "nearmiss": return `${fmt((n.nearmiss || 0) + (n.headon || 0))} shaves · wrong way ${(b.wrongway || 0).toFixed(1)} s`;
        case "air": return `${fmt(n.air)} landed · best ${fmt(b.air)} tricks in one jump`;
        case "bootleg": return `${fmt(n.bootleg)} bootleggers`;
        case "pit": return `${fmt(n.pit)} cruisers spun`;
        case "roll": return `${fmt(n.roll)} rolls · ${fmt(q.matador)} matadors`;
        case "slide": return `${fmt(n.slide)} slides`;
        case "vault": return `${fmt(n.vault)} vaults`;
        case "combo": return b.comboMult ? `best ×${fmtMult(b.comboMult)} · ${fmt(b.comboScore)} pts · ${fmt(b.comboLen)} moves` : "no combo banked yet";
        default: return "";
    }
}
const starHtml = n => `<span class="mv-st">${"★".repeat(n)}<i>${"★".repeat(3 - n)}</i></span>`;
function info(m) {
    const st = starsOf(m);
    const goals = m.stars.map((g, i) => {
        const [c, t, label] = g(S);
        const done = c >= t;
        const pct = Math.max(0, Math.min(1, c / t)) * 100;
        return `<div class="mv-goal${done ? " done" : ""}"><span>${done ? "★" : "☆"} ${esc(label)}</span><span class="mv-bar"><i style="width:${pct.toFixed(0)}%"></i><b>${done ? "✓" : `${fmt(Math.min(c, t))} / ${fmt(t)}`}</b></span></div>`;
    }).join("");
    return `<div class="mv-i-top"><span class="mv-i-ic">${m.icon}</span><div><div class="mv-i-nm">${esc(m.name)} ${starHtml(st)}</div>
        <div class="mv-i-how">${howTo(m)}</div></div></div>
        <div class="mv-i-ds">${esc(m.blurb)}</div>${goals}`;
}
function render() {
    const total = MOVES.reduce((a, m) => a + starsOf(m), 0);
    const b = S.best;
    const rows = MOVES.map(m => `<button class="nav mv-row${m.id === sel ? " sel" : ""}" id="mvRow_${m.id}" data-id="${m.id}">
        <span class="mv-ic">${m.icon}</span><span class="mv-tx"><b>${esc(m.name)}</b><small>${howTo(m)}</small></span>
        <span class="mv-r">${starHtml(starsOf(m))}<small>${esc(bestLine(m))}</small></span></button>`).join("");
    return `<div class="mb-paper mv-info" id="mvInfo">${info(MOVE[sel] || MOVES[0])}</div>
      <div class="mv-sum">⭐ ${total} / ${MOVES.length * 3} mastery stars${b.comboMult ? ` · 🔗 best combo ×${fmtMult(b.comboMult)} (${fmt(b.comboScore)})` : ""}</div>
      <div class="mv-list">${rows}</div>
      <div class="mv-foot"><button class="btn alt mv-toggle" id="mvToggle">🏁 Moves &amp; tricks: <b>${S.on !== false ? "ON" : "OFF"}</b></button>
      <p class="mb-foot">Everything here is optional. Off = the classic handbrake slide and no tricks.</p></div>`;
}
let mo = null;
function wire(card, rerender) {
    if (mo) mo.disconnect();
    const panel = card.querySelector("#mvInfo");
    const show = id => {
        if (!MOVE[id] || id === sel && panel.dataset.id === id) return;
        sel = id; panel.dataset.id = id;
        panel.innerHTML = info(MOVE[id]);
        card.querySelectorAll(".mv-row.sel").forEach(r => r.classList.remove("sel"));
        const r = card.querySelector("#mvRow_" + id); if (r) r.classList.add("sel");
    };
    panel.dataset.id = sel;
    mo = new MutationObserver(() => { const f = card.querySelector(".mv-row.focus"); if (f) show(f.dataset.id); });
    card.querySelectorAll(".mv-row").forEach(r => {
        mo.observe(r, { attributes: true, attributeFilter: ["class"] });
        r.addEventListener("click", () => show(r.dataset.id));
    });
    const t = card.querySelector("#mvToggle");
    if (t) t.addEventListener("click", () => {
        S.on = S.on === false;
        saveSoon();
        if (!S.on) { reset(); hideCallout(); }
        rerender("mvToggle");
    });
}

on("boot", () => {
    if (ctx.meta && ctx.meta.addScrapbookTab) ctx.meta.addScrapbookTab({ id: "moves", icon: "🏁", name: "Moves", render, wire });
    // the button guide (Settings › 🎮 Button guide): the handbrake does more now, and the on-foot move button
    for (const k of ["xbox", "ps", "nintendo", "keyboard", "touch"]) {
        const g = glyphSet(k);
        if (g && !g.footMove) g.footMove = k === "touch" ? "tap the road" : g.handbrake;
    }
    setControlRow("handbrake", "Handbrake · drift boost (hold through a turn, release)");
    setControlRow("footMove", "On foot: roll · slide · vault", "interact");
});

css("moves-page", `
.meta-book .mv-info { display: block; padding: 12px 14px; margin-bottom: 8px; color: #3E2723; }
.mv-i-top { display: flex; gap: 12px; align-items: center; }
.mv-i-ic { flex: none; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; font-size: 30px; background: #FFE0B2; box-shadow: inset 0 0 0 2px #8D6E63; }
.mv-i-nm { font-weight: 800; font-size: 19px; }
.mv-i-how { font-size: 14px; margin-top: 2px; color: #5D4037; }
.mv-i-ds { font-size: 14px; margin: 8px 0 6px; line-height: 1.35; }
.mv-goal { display: flex; align-items: center; gap: 10px; font-size: 13px; margin-top: 4px; }
.mv-goal > span:first-child { flex: 1; min-width: 0; }
.mv-goal.done > span:first-child { color: #E65100; font-weight: 700; }
.mv-bar { position: relative; flex: none; width: 38%; height: 16px; border-radius: 8px; background: rgba(78,52,46,.18); overflow: hidden; }
.mv-bar i { position: absolute; inset: 0 auto 0 0; background: linear-gradient(90deg, #FFD54F, #FFB300); border-radius: 8px; }
.mv-bar b { position: relative; display: block; text-align: center; font-size: 11px; line-height: 16px; color: #3E2723; }
.mv-st { color: #FFB300; letter-spacing: 1px; white-space: nowrap; } .mv-st i { font-style: normal; color: rgba(120,90,60,.35); }
.mv-sum { margin: 6px 4px; font-weight: 700; color: #FFF8E1; text-shadow: 0 2px 0 #4E342E; }
.mv-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 6px; }
.mv-row { display: flex; align-items: center; gap: 10px; text-align: left; border: none; border-radius: 12px; padding: 8px 10px; cursor: pointer;
  background: #FFFDF5; color: #3E2723; font: inherit; box-shadow: inset 0 0 0 1.5px rgba(120,90,60,.35); min-width: 0; }
.mv-row.sel { box-shadow: inset 0 0 0 2px #8D6E63; }
.mv-row.focus { outline: 3px solid #FF4081; outline-offset: 1px; }
.mv-ic { flex: none; font-size: 24px; width: 34px; text-align: center; }
.mv-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.mv-tx b { font-size: 15px; } .mv-tx small { font-size: 12px; opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mv-tx small .glyph, .mv-i-how .glyph { font-size: 11px; padding: 0 5px; }
.mv-r { flex: none; display: flex; flex-direction: column; align-items: flex-end; max-width: 42%; }
.mv-r small { font-size: 11px; opacity: .75; text-align: right; }
.mv-foot { text-align: center; margin-top: 10px; }
.mv-toggle b { margin-left: 6px; }
@media (max-width: 600px) { .mv-list { grid-template-columns: 1fr; } .mv-r small { display: none; } .mv-bar { width: 44%; } .mv-i-ic { width: 44px; height: 44px; font-size: 24px; } }
body.tv .mv-i-nm { font-size: 28px; } body.tv .mv-i-how, body.tv .mv-i-ds { font-size: 20px; } body.tv .mv-goal { font-size: 18px; }
body.tv .mv-list { grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); } body.tv .mv-tx b { font-size: 21px; } body.tv .mv-tx small, body.tv .mv-r small { font-size: 16px; }
body.tv .mv-ic { font-size: 34px; width: 46px; } body.tv .mv-sum { font-size: 22px; }
`);
