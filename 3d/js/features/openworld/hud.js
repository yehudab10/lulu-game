// features/openworld — the HUD while a game / pin is live: ONE compact objective chip
// (top centre, under the trip bar: "🚓 You're the COP — bump the robbers · 1:12 ▲ 80 m")
// with a direction arrow to the target, a small score list (left, .hud-secondary — gone in
// HUD Clean) and the 3-2-1 count. Nothing shows outside a game or a pin. DOM is written
// only when the text changes (the caller refreshes ~5×/s; the arrow every frame).
import * as THREE from "three";
import { ctx, css } from "../../core/ctx.js";
import * as H from "../../hud.js";

css("openworld", `
#owChip { display: none; align-items: center; gap: 8px; margin: 4px auto 0; width: max-content; max-width: min(92vw, 640px);
  border-radius: 999px; padding: 5px 14px; font: 700 15px var(--font); color: #fff; background: rgba(20,16,36,.72);
  box-shadow: 0 3px 8px rgba(0,0,0,.22); pointer-events: none; white-space: nowrap; }
#owChip .tx { overflow: hidden; text-overflow: ellipsis; }
#owChip.tap { pointer-events: auto; cursor: pointer; box-shadow: 0 0 0 2.5px #FFD54F, 0 3px 8px rgba(0,0,0,.22); }
#owChip.cop { background: linear-gradient(90deg, rgba(198,40,40,.92), rgba(21,101,192,.92)); }
#owChip.hot { background: rgba(230,81,0,.94); } #owChip.gold { background: rgba(255,160,0,.94); color: #2b1b00; }
#owChip.green { background: rgba(46,125,50,.92); } #owChip.pink { background: rgba(233,30,99,.92); }
#owChip .ar { display: inline-flex; align-items: center; gap: 4px; padding-left: 8px; border-left: 1.5px solid rgba(255,255,255,.35); font-variant-numeric: tabular-nums; }
#owChip .ar i { display: inline-block; font-style: normal; transition: transform .12s linear; }
#owBoard { display: none; background: rgba(20,16,36,.62); color: #fff; border-radius: 14px; padding: 6px 10px 7px; min-width: 140px; font: 700 13px var(--font); pointer-events: none; margin-top: 6px; }
#owBoard .t { color: #FFD54F; font-size: 11px; letter-spacing: .12em; margin-bottom: 2px; }
#owBoard .r { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
#owBoard .r.me { color: #FFE082; } #owBoard .r.out { opacity: .5; }
#owBoard .r i { width: 9px; height: 9px; border-radius: 50%; flex: none; box-shadow: 0 0 0 1.5px rgba(255,255,255,.7); }
#owBoard .r .n { flex: 1; overflow: hidden; text-overflow: ellipsis; max-width: 120px; }
#owBoard .r .v { opacity: .85; font-size: 12px; font-variant-numeric: tabular-nums; }
#owCount { position: fixed; inset: 0; pointer-events: none; z-index: 8; display: none; flex-direction: column; align-items: center; justify-content: center; color: #fff; font-family: var(--font); }
#owCount b { font-size: 24px; color: #FFD54F; text-shadow: 0 3px 0 rgba(0,0,0,.6); letter-spacing: .05em; }
#owCount .n { font-size: 110px; font-weight: 700; line-height: 1.05; text-shadow: 0 6px 0 #7E57C2, 0 10px 24px rgba(0,0,0,.35); }
#owCount small { font-size: 16px; font-weight: 700; text-shadow: 0 2px 0 rgba(0,0,0,.6); max-width: 90vw; text-align: center; }
body.tv #owChip { font-size: 22px; padding: 7px 20px; } body.tv #owBoard { font-size: 19px; min-width: 220px; } body.tv #owCount .n { font-size: 160px; }
@media (max-width: 600px) { #owChip { font-size: 13px; padding: 4px 11px; max-width: 94vw; } #owBoard { font-size: 12px; min-width: 0; } #owBoard .r .n { max-width: 80px; } #owCount .n { font-size: 84px; } }
@media (max-height: 430px) { #owBoard { display: none !important; } #owCount .n { font-size: 72px; } }
/* the phone apps */
.ow-head { display: flex; align-items: center; gap: 10px; }
.ow-res .lp-row.me { box-shadow: inset 0 0 0 2px #E91E63; }
.ow-res .rk { font-size: 20px; width: 30px; text-align: center; }
.lp-row .lp-meta.ow-d { font-variant-numeric: tabular-nums; opacity: .75; }
.lp-row[disabled] { opacity: .5; }
.ow-crew { display: flex; flex-wrap: wrap; gap: 6px 12px; justify-content: center; margin: 4px 0 8px; font: 700 14px var(--font); }
.ow-who { display: inline-flex; align-items: center; gap: 5px; } .ow-who i { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.ow-who small { opacity: .7; font-weight: 600; }
.ow-sec { font-size: 11px; font-weight: 700; letter-spacing: .12em; opacity: .55; margin: 10px 2px 4px; text-transform: uppercase; }
`);

const D = { chip: null, tx: null, ar: null, arI: null, arD: null, board: null, count: null, chipKey: "", boardKey: "", countKey: "", arrowTo: null };
function els() {
    if (D.chip) return;
    D.chip = document.createElement("div"); D.chip.id = "owChip";
    D.chip.innerHTML = `<span class="tx"></span><span class="ar"><i>▲</i><span></span></span>`;
    D.chip.addEventListener("click", () => { if (tapFn) { try { tapFn(); } catch (e) { console.error("[openworld] chip", e); } } });
    D.tx = D.chip.querySelector(".tx"); D.ar = D.chip.querySelector(".ar"); D.arI = D.ar.querySelector("i"); D.arD = D.ar.querySelector("span");
    H.hudSlot("center").appendChild(D.chip);
    D.board = document.createElement("div"); D.board.id = "owBoard"; D.board.className = "hud-secondary";
    H.hudSlot("left").appendChild(D.board);
    D.count = document.createElement("div"); D.count.id = "owCount";
    document.body.appendChild(D.count);
}

/** The objective chip. to = {x, z} → an arrow + distance; null → none. tap = a click / touch on the chip (an
 *  invitation's "join") — the chip takes pointer events only while it has one. */
let tapFn = null;
export function chip(html, cls = "", to = null, tap = null) {
    els();
    tapFn = html ? tap : null;
    if (tapFn) cls = (cls ? cls + " " : "") + "tap";
    const key = html + "|" + cls;
    if (key !== D.chipKey) {
        D.chipKey = key;
        D.tx.innerHTML = html;
        D.chip.className = cls;
        D.chip.style.display = html ? "flex" : "none";
    }
    const was = D.arrowTo;
    D.arrowTo = html && to ? to : null;
    if (D.arrowTo && !was) lastArrow = "";             // a fresh target: write the distance on the next tick
    D.ar.style.display = D.arrowTo ? "" : "none";
}
export function board(html) {
    els();
    if (html === D.boardKey) return;
    D.boardKey = html;
    D.board.innerHTML = html;
    D.board.style.display = html ? "block" : "none";
}
export function count(title, n, sub) {
    els();
    const key = title == null ? "" : `${title}|${n}|${sub}`;
    if (key === D.countKey) return;
    D.countKey = key;
    if (!key) { D.count.style.display = "none"; return; }
    D.count.innerHTML = `<b>${title}</b><div class="n">${n}</div><small>${sub || ""}</small>`;
    D.count.style.display = "flex";
}
export function hideAll() { chip(""); board(""); count(null); }

const _dir = new THREE.Vector3();
let lastArrow = "";
/** Per frame: point the chip's arrow at its target (relative to where the camera looks) + the distance. */
export function arrowTick(from) {
    if (!D.arrowTo || !D.chip || !from) return;
    const to = D.arrowTo, dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz);
    ctx.camera.getWorldDirection(_dir);
    const yaw = Math.atan2(_dir.x, _dir.z), bearing = Math.atan2(dx, dz);
    let a = bearing - yaw; while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2;
    const deg = Math.round(-a * 180 / Math.PI / 5) * 5;
    const txt = dist >= 1000 ? (dist / 1609).toFixed(1) + " mi" : Math.round(dist / 5) * 5 + " m";
    const key = deg + "|" + txt;
    if (key === lastArrow) return;
    lastArrow = key;
    D.arI.style.transform = `rotate(${deg}deg)`;
    D.arD.textContent = txt;
}
export const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export const fmtT = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000); return `${m}:${String(s).padStart(2, "0")}`; };
export const fmtRace = ms => { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000; return `${m}:${s.toFixed(1).padStart(4, "0")}`; };
