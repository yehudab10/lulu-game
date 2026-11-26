// features/hustle — the DOM bits: the job's objective line + distance chip (under
// the trip bar, ONLY during a job), the delivery meters, the radio ticker (top
// right, under the pause button — over the sky, never the road), the cutscene
// captions and the pass / fail card. Everything updates in place (no churn).
import { ctx, css } from "../../core/ctx.js";
import { input, glyph } from "../../input.js";
import * as H from "../../hud.js";

css("hustle", `
.hs-job { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; max-width: min(560px, 72vw); pointer-events: none !important; }
.hs-obj { display: flex; align-items: center; gap: 7px; max-width: 100%; min-width: 0; background: rgba(18,24,36,.82); color: #FFF5E6; border: 2px solid var(--acc, #FFC107);
  border-radius: 999px; padding: 4px 6px 4px 11px; font-weight: 700; font-size: 14px; box-shadow: 0 3px 10px rgba(0,0,0,.22); white-space: nowrap; animation: hsIn .35s cubic-bezier(.2,1.5,.4,1); }
.hs-obj .ic { flex: none; font-size: 16px; }
.hs-obj .tx { overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.hs-obj .tm { flex: none; background: var(--acc, #FFC107); color: #2B1B2E; border-radius: 999px; padding: 1px 8px; font-variant-numeric: tabular-nums; font-size: 13px; }
.hs-obj .tm:empty { display: none; }
.hs-obj .tm.low { background: #FF5252; color: #fff; animation: hsBlink .55s infinite alternate; }
.hs-obj.flash { animation: hsFlash .5s ease-out; }
.hs-dist { flex: none; display: flex; align-items: center; gap: 5px; background: rgba(255,250,244,.9); color: var(--ink); border-radius: 999px; padding: 3px 10px 3px 7px;
  font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; box-shadow: 0 2px 8px rgba(0,0,0,.18); }
.hs-dist .ar { display: inline-block; width: 16px; text-align: center; color: var(--acc2, #E65100); transition: transform .12s linear; }
.hs-dist:empty, .hs-dist.off { display: none; }
.hs-meters { flex-basis: 100%; display: flex; justify-content: center; gap: 8px; }
.hs-meters:empty { display: none; }
.hs-m { display: flex; align-items: center; gap: 5px; background: rgba(18,24,36,.78); color: #fff; border-radius: 999px; padding: 2px 9px 2px 6px; font-size: 12px; font-weight: 700; }
.hs-m .bar { width: 64px; height: 7px; border-radius: 4px; background: rgba(255,255,255,.18); overflow: hidden; }
.hs-m .bar i { display: block; height: 100%; width: 0%; border-radius: 4px; transition: width .2s linear; }
.hs-m.heat .bar i { background: linear-gradient(90deg, #4FC3F7, #FFB300 55%, #FF5722); }
.hs-m.spill .bar i { background: linear-gradient(90deg, #A5D6A7, #FFB74D 60%, #E53935); }
.hs-m.tip .bar i { background: linear-gradient(90deg, #AED581, #43A047); }
.hs-m.streak { background: linear-gradient(90deg, #FF7043, #E91E63); } .hs-m.streak .bar { display: none; }
.hs-m.bags .bar i { background: linear-gradient(90deg, #E53935, #FFD54F 45%, #66BB6A); }
.hs-m.hit { animation: hsShake .35s; }
@keyframes hsIn { from { transform: translateY(-8px) scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes hsBlink { from { filter: brightness(1); } to { filter: brightness(1.45); } }
@keyframes hsFlash { 0% { box-shadow: 0 0 0 0 var(--acc); } 100% { box-shadow: 0 0 0 14px rgba(0,0,0,0); } }
@keyframes hsShake { 0%,100% { transform: none; } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
body.tv .hs-obj { font-size: 22px; padding: 7px 10px 7px 16px; } body.tv .hs-obj .ic { font-size: 24px; } body.tv .hs-obj .tm { font-size: 20px; padding: 2px 12px; }
body.tv .hs-dist { font-size: 20px; padding: 5px 14px 5px 10px; } body.tv .hs-dist .ar { width: 22px; }
body.tv .hs-m { font-size: 18px; } body.tv .hs-m .bar { width: 110px; height: 10px; }
body.tv .hs-job { margin-top: calc(3vh + 8px); }     /* TV: the trip bar sits lower (3vh margins) — stay clear of its label */
@media (max-width: 600px) { .hs-obj { font-size: 12.5px; } .hs-dist { font-size: 12px; } .hs-m .bar { width: 48px; } }
/* a phone on its side: ONE compact row (objective · distance · meters), so it stays above the horizon */
@media (max-height: 480px) and (min-aspect-ratio: 1/1) {
  .hs-job { flex-wrap: nowrap; max-width: min(620px, 76vw); gap: 4px; }
  .hs-meters { flex-basis: auto; gap: 4px; }
  .hs-obj { font-size: 12px; padding: 3px 5px 3px 9px; gap: 5px; } .hs-obj .ic { font-size: 13px; } .hs-obj .tm { font-size: 11.5px; padding: 0 6px; }
  .hs-dist { font-size: 11.5px; padding: 2px 8px 2px 5px; }
  .hs-m { font-size: 11px; padding: 2px 7px 2px 5px; } .hs-m .bar { width: 38px; height: 6px; }
}

/* 📻 the radio ticker: a small card under the pause button, short-lived */
.hs-radio { max-width: min(320px, 34vw); background: rgba(20,16,32,.74); color: #fff; border-radius: 14px; padding: 6px 11px 7px; text-align: left;
  font-weight: 600; font-size: 12.5px; line-height: 1.28; box-shadow: 0 3px 12px rgba(0,0,0,.25); cursor: pointer; border-left: 3px solid var(--acc, #FF80AB);
  transition: opacity .3s ease, transform .3s ease; -webkit-tap-highlight-color: transparent; }
.hs-radio.off { opacity: 0; transform: translateX(18px); pointer-events: none !important; }
.hs-radio.gone { display: none; }
.hs-radio .st { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 11px; letter-spacing: .08em; color: var(--acc, #FF80AB); text-transform: uppercase; }
.hs-radio .st .eq { display: inline-flex; gap: 2px; align-items: flex-end; height: 10px; }
.hs-radio .st .eq i { width: 3px; background: var(--acc, #FF80AB); border-radius: 1px; animation: hsEq .9s infinite ease-in-out; }
.hs-radio .st .eq i:nth-child(2) { animation-delay: -.3s; } .hs-radio .st .eq i:nth-child(3) { animation-delay: -.6s; }
.hs-radio .st .k { margin-left: auto; opacity: .7; font-size: 10px; letter-spacing: 0; text-transform: none; }
.hs-radio .st .k .glyph { min-width: 18px; height: 16px; font-size: 9px; padding: 0 4px; }
.hs-radio .tx { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-top: 1px; }
.hs-radio .tx:empty { display: none; }
.hs-radio .tx b { color: #FFE082; font-weight: 700; }
@keyframes hsEq { 0%, 100% { height: 3px; } 50% { height: 10px; } }
/* TV: the right slot already carries the 3vw TV margin (no second one here), and ≤ 32vw keeps the card in the
   right column at 720p, where it steps down under the centre job stack instead of being squeezed out */
body.tv .hs-radio { max-width: min(520px, 32vw); font-size: 20px; padding: 10px 16px 11px; border-radius: 18px; }
body.tv .hs-radio .st { font-size: 16px; } body.tv .hs-radio .st .eq { height: 14px; } body.tv .hs-radio .st .eq i { width: 4px; }
.hs-radio.squeezed { display: none; }
@media (max-width: 600px) { .hs-radio { max-width: 52vw; font-size: 11.5px; padding: 5px 9px 6px; } }
/* short landscape (a phone on its side): one line, kept to the right third (clear of the speedo pill) */
@media (max-height: 480px) { .hs-radio { max-width: min(34vw, 300px); font-size: 11.5px; padding: 4px 9px 5px; }
  .hs-radio .tx { -webkit-line-clamp: 1; } body.touch #slot-right .hs-radio { flex-basis: 100%; order: 9; } }

/* cutscene captions (the heist): a lower third, never a modal */
#hsCap { position: fixed; left: 50%; bottom: calc(max(18px, env(safe-area-inset-bottom)) + 3vh); transform: translateX(-50%); z-index: 30; pointer-events: none;
  max-width: min(680px, 90vw); background: rgba(16,12,26,.82); color: #fff; border-radius: 16px; padding: 9px 18px 10px; text-align: center;
  font-weight: 700; font-size: 18px; box-shadow: 0 6px 22px rgba(0,0,0,.3); transition: opacity .25s; }
#hsCap.off { opacity: 0; }
#hsCap b { display: block; font-size: 12px; letter-spacing: .14em; color: #A5D6A7; }
body.tv #hsCap { font-size: 30px; padding: 14px 28px; } body.tv #hsCap b { font-size: 18px; }

/* the pass / fail card (its own state; the car rolls to a stop behind it) */
.card.hs-card { width: min(500px, 100%); padding: 14px 18px 16px; }
@media (min-aspect-ratio: 5/4) and (min-width: 820px) {
  .screen:has(.card.hs-card) { justify-content: flex-start; padding-left: max(3vw, 18px); background: linear-gradient(90deg, rgba(20,12,30,.45), rgba(20,12,30,0) 62%); }
  .card.hs-card { width: min(470px, 46vw); }
}
.hs-res .top { font-size: 34px; font-weight: 700; line-height: 1; margin-top: 2px; letter-spacing: .02em; color: #2E7D32; text-shadow: 0 3px 0 rgba(0,0,0,.1); }
.hs-res.fail .top { color: #C62828; }
.hs-res .nm { display: inline-block; margin: 6px 0 2px; background: var(--acc, #FFC107); color: #2B1B2E; border-radius: 999px; padding: 3px 14px; font-weight: 700; font-size: 15px; letter-spacing: .06em; }
.hs-res .why { font-size: 15px; font-weight: 600; opacity: .75; margin: 4px 0 0; }
.hs-res .rows { margin: 10px auto 4px; max-width: 380px; text-align: left; }
.hs-res .row { display: flex; justify-content: space-between; gap: 12px; font-size: 15px; font-weight: 600; padding: 3px 4px; border-bottom: 1px dashed rgba(0,0,0,.12); }
.hs-res .row b { font-variant-numeric: tabular-nums; }
.hs-res .row.neg b { color: #C62828; }
.hs-res .row.tot { border-bottom: none; font-size: 19px; font-weight: 700; margin-top: 2px; }
.hs-res .row.tot b { color: #E6A700; }
.hs-res .stars { font-size: 26px; letter-spacing: 3px; color: #FFB300; margin: 4px 0 0; }
.hs-res .quote { text-align: left; border: 2.5px solid var(--acc, #FFC107); font-size: 16px; padding: 8px 12px; margin: 8px 0 6px; }
.hs-res .quote small { display: block; font-size: 12.5px; opacity: .6; margin-top: 2px; }
.hs-res .chz { display: inline-block; font-weight: 700; font-size: 14px; color: #6A1B9A; background: #F3E5F5; border-radius: 999px; padding: 3px 12px; margin-top: 2px; animation: hsPulse 1s infinite alternate; }
@keyframes hsPulse { from { transform: scale(.97); } to { transform: scale(1.04); } }
.card.hs-card .menu { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 10px; }
.card.hs-card .menu .btn { width: auto; padding: 9px 16px; font-size: 16px; }
.card.hs-card .menu .btn:first-child { flex-basis: 100%; font-size: 18px; padding: 11px 16px; }
body.tv .hs-res .top { font-size: 50px; } body.tv .hs-res .nm { font-size: 22px; } body.tv .hs-res .row { font-size: 22px; } body.tv .hs-res .row.tot { font-size: 28px; }
body.tv .hs-res .quote { font-size: 24px; } body.tv .hs-res .why { font-size: 20px; } body.tv .hs-res .chz { font-size: 20px; } body.tv .hs-res .stars { font-size: 36px; }
@media (max-height: 520px) { .card.hs-card { padding: 10px 14px 12px; } .hs-res .top { font-size: 26px; } .hs-res .rows { margin: 6px auto 2px; } .hs-res .row { font-size: 13.5px; padding: 1px 4px; } .hs-res .quote { font-size: 14px; margin: 5px 0 4px; padding: 6px 10px; } .card.hs-card .menu { margin-top: 6px; } }

/* the 💼 Side Jobs log (Scrapbook group) */
.hs-log h2 { margin-bottom: 4px; }
.hs-log .grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 8px 0; }
.hs-log .cell { background: #fff; border-radius: 14px; padding: 8px 6px; box-shadow: 0 2px 0 rgba(0,0,0,.06); }
.hs-log .cell b { display: block; font-size: 22px; } .hs-log .cell span { font-size: 12px; font-weight: 600; opacity: .65; }
.hs-log .jobs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.hs-log .job { background: #fff8e8; border-radius: 14px; padding: 8px; font-size: 13px; text-align: left; border-top: 4px solid var(--acc); }
.hs-log .job .t { font-weight: 700; font-size: 15px; }
.hs-log .recent { text-align: left; font-size: 13.5px; margin-top: 8px; max-height: 120px; overflow: auto; }
.hs-log .recent div { padding: 2px 0; border-bottom: 1px dashed rgba(0,0,0,.1); }
.hs-log .how { font-size: 13px; opacity: .75; margin-top: 8px; }
@media (max-width: 600px) { .hs-log .jobs { grid-template-columns: 1fr; } }
body.tv .hs-log .job, body.tv .hs-log .recent { font-size: 20px; } body.tv .hs-log .cell b { font-size: 34px; } body.tv .hs-log .cell span { font-size: 17px; }
`);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export { esc };

// ── the job HUD ───────────────────────────────────────────────────────────
let box = null;
const el = {};
const last = { obj: "", tm: "", low: null, dist: "", rot: "", meters: "" };
function ensureBox() {
    if (box && box.isConnected) return box;
    box = document.createElement("div");
    box.className = "hs-job";
    box.innerHTML = `<div class="hs-obj"><span class="ic"></span><span class="tx"></span><span class="tm"></span></div>` +
        `<div class="hs-dist hud-secondary"><span class="ar">▲</span><span class="dv"></span></div><div class="hs-meters"></div>`;
    H.hudSlot("center").appendChild(box);
    H.objective(box, { prio: H.OBJ.timed, id: "job", badge: ".tm" });      // (ci/hud: the play HUD's objective line)
    el.obj = box.querySelector(".hs-obj"); el.ic = box.querySelector(".ic"); el.tx = box.querySelector(".tx"); el.tm = box.querySelector(".tm");
    el.dist = box.querySelector(".hs-dist"); el.ar = box.querySelector(".ar"); el.dv = box.querySelector(".dv"); el.meters = box.querySelector(".hs-meters");
    for (const k of Object.keys(last)) last[k] = k === "low" ? null : "";
    return box;
}
/**
 * info: { emoji, line, time (s left | null), low (bool), color, dist (m | null), rot (rad, screen-relative), meters: [{cls, label, frac}] }
 * null hides it.
 */
export function jobHud(info) {
    if (!info) { if (box) { box.remove(); box = null; } return; }
    ensureBox();
    box.style.setProperty("--acc", info.color || "#FFC107");
    const objKey = info.emoji + "|" + info.line;
    if (last.obj !== objKey) {
        last.obj = objKey;
        el.ic.textContent = info.emoji;
        el.tx.textContent = info.line;
        el.obj.classList.remove("flash"); void el.obj.offsetWidth; el.obj.classList.add("flash");
    }
    const tm = info.time == null ? "" : info.timeText;
    if (last.tm !== tm) { last.tm = tm; el.tm.textContent = tm; }
    const low = !!info.low;
    if (last.low !== low) { last.low = low; el.tm.classList.toggle("low", low); }
    const dist = info.dist == null ? "" : info.dist >= 1000 ? (info.dist / 1000).toFixed(1) + " km" : Math.round(info.dist / 5) * 5 + " m";
    if (last.dist !== dist) { last.dist = dist; el.dv.textContent = dist; el.dist.classList.toggle("off", !dist); }
    const rot = info.rot == null ? "" : (Math.round(info.rot * 18 / Math.PI) * 10) + "deg";     // 10° steps: no style churn
    if (last.rot !== rot) { last.rot = rot; el.ar.style.transform = rot ? `rotate(${rot})` : ""; }
    const mk = info.meters ? info.meters.map(m => `${m.cls}:${m.label}:${Math.round(m.frac * 50)}`).join(",") : "";
    if (last.meters !== mk) {
        last.meters = mk;
        if (!info.meters || !info.meters.length) el.meters.innerHTML = "";
        else {
            const kinds = info.meters.map(m => m.cls).join(" ");
            if (el.meters.dataset.k !== kinds) {
                el.meters.dataset.k = kinds;
                el.meters.innerHTML = info.meters.map(m => `<div class="hs-m ${m.cls}"><span></span><div class="bar"><i></i></div></div>`).join("");
            }
            info.meters.forEach((m, i) => {
                const b = el.meters.children[i];
                if (!b) return;
                const sp = b.firstChild;
                if (sp.textContent !== m.label) sp.textContent = m.label;
                b.querySelector("i").style.width = (Math.max(0, Math.min(1, m.frac)) * 100).toFixed(0) + "%";
            });
        }
    }
}
/** Shake a meter (a spill). */
export function meterHit(cls) {
    const m = box && box.querySelector(".hs-m." + cls);
    if (!m) return;
    m.classList.remove("hit"); void m.offsetWidth; m.classList.add("hit");
}
export function jobHudEl() { return box; }

// ── the radio ticker ──────────────────────────────────────────────────────
let tick = null;
const tk = { st: "", tx: "", acc: "", k: "" };
export function ticker() {
    if (tick && tick.isConnected) return tick;
    tick = document.createElement("div");
    tick.className = "hs-radio hud-secondary off gone";
    tick.dataset.fit = "self";        // on a wide screen it keeps clear of the centre stack itself (tickerLayout); upright, the centre ducks under it
    tick.setAttribute("role", "status");
    tick.innerHTML = `<div class="st"><span class="eq"><i></i><i></i><i></i></span><span class="nm"></span><span class="k"></span></div><div class="tx"></div>`;
    H.hudSlot("right").appendChild(tick);
    for (const k of Object.keys(tk)) tk[k] = "";
    return tick;
}
export function tickerShow(station, html, acc) {
    const t = ticker();
    const st = `${station.emoji} ${station.name}`;
    if (tk.st !== st) { tk.st = st; t.querySelector(".nm").textContent = st; }
    if (tk.tx !== html) { tk.tx = html; t.querySelector(".tx").innerHTML = html; }
    if (tk.acc !== acc) { tk.acc = acc; t.style.setProperty("--acc", acc); }
    const k = input.device === "touch" ? "tap: next" : `${glyph("radio")} next`;
    if (tk.k !== k) { tk.k = k; t.querySelector(".k").innerHTML = k; }
    t.classList.toggle("noeq", !station.tracks || !station.tracks.length);
    t.querySelector(".eq").style.display = station.tracks && station.tracks.length ? "" : "none";
    t.classList.remove("gone", "squeezed");
    t.style.marginTop = ""; lay.off = 0; lay.t = 0;
    void t.offsetWidth;
    t.classList.remove("off");
}
/**
 * Keep the ticker clear of the other HUD bits near it (the centre stack — banner, job line —,
 * the pause button, the touch speedo pill, the trip bar): if its natural spot overlaps one, it
 * steps down below it; if that would put it over the road, it sits this one out. Measured a few
 * times a second while it's up, never per frame.
 */
const AVOID = ["#slot-center", "#pauseBtn", ".hud-top", ".hud-br .speedo"];
const NEVER = ["#touch .pedals", "#touchExtra", "#stickZone"];        // touch controls: sit it out rather than cover them
const lay = { t: 0, off: 0 };
export function tickerLayout(dt) {
    if (!tick || tick.classList.contains("off")) return;
    lay.t -= dt;
    if (lay.t > 0) return;
    lay.t = 0.25;
    const r = tick.getBoundingClientRect();
    if (r.width < 2) return;
    const top0 = r.top - lay.off;
    let off = 0;
    for (let pass = 0; pass < 2; pass++) {
        for (const sel of AVOID) {
            const e = document.querySelector(sel);
            if (!e || e.offsetParent === null) continue;
            if (sel === "#slot-center" && (!e.childElementCount || H.PORTRAIT.matches)) continue;   // upright: the centre ducks under the ticker (hud.js › fitHud)
            const q = e.getBoundingClientRect();
            if (q.width < 2 || q.height < 2) continue;
            const t = top0 + off, b = t + r.height;
            if (r.left < q.right + 2 && r.right > q.left - 2 && t < q.bottom + 2 && b > q.top - 2) off = q.bottom + 6 - top0;
        }
    }
    const W = innerWidth, Hh = innerHeight;
    let ok = top0 + off + r.height < Hh * 0.42 || r.left > W * 0.62;
    if (ok && document.body.classList.contains("touch")) {
        const t = top0 + off, b = t + r.height;
        for (const sel of NEVER) {
            const e = document.querySelector(sel);
            if (!e || e.offsetParent === null) continue;
            for (const q of e.children.length && sel !== "#stickZone" ? [...e.children].filter(c => c.offsetParent !== null).map(c => c.getBoundingClientRect()) : [e.getBoundingClientRect()]) {
                if (q.width > 1 && r.left < q.right && r.right > q.left && t < q.bottom && b > q.top) { ok = false; break; }
            }
            if (!ok) break;
        }
    }
    if (Math.abs(off - lay.off) > 0.5) { lay.off = off; tick.style.marginTop = off ? off.toFixed(0) + "px" : ""; }
    tick.classList.toggle("squeezed", !ok);
}
export function tickerHide(now = false) {
    if (!tick) return;
    tick.classList.add("off");
    if (now) tick.classList.add("gone");
}
export function tickerGone() { if (tick) tick.classList.add("off", "gone"); }

// ── cutscene captions ─────────────────────────────────────────────────────
let cap = null;
export function caption(who, text) {
    if (!cap) { cap = document.createElement("div"); cap.id = "hsCap"; cap.className = "off"; document.body.appendChild(cap); }
    if (!text) { cap.classList.add("off"); return; }
    cap.innerHTML = `${who ? `<b>${esc(who)}</b>` : ""}${esc(text)}`;
    cap.classList.remove("off");
}
