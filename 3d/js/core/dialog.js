// Visual-novel style dialogue box (courtroom, Avigail, the bar, Ima's call…).
//
//   await say("Bubbe", "Lululeh! Come, eat!", { emoji: "👵", color: "#8E5CC2" });
//   const i = await choose("Judge", "How do you plead?", ["Guilty 😇", "Not guilty 😤"]);
//   await script([ ["Cop", "License and registration."], ["Lulu", "Is this about the duck?"] ], { emoji: {...} });
//
// Works with the controller (A/✕ advances, D-pad picks), keyboard (Enter /
// arrows) and touch (tap). While a line is open the game loop routes input
// here, so pressing A doesn't also floor the gas.
import { ctx, css } from "./ctx.js";
import { sfxMove, sfxSelect } from "../audio.js";

css("dialog", `
#dialog { position: fixed; left: 50%; bottom: max(18px, env(safe-area-inset-bottom)); transform: translateX(-50%);
  width: min(760px, calc(100% - 24px)); z-index: 40; display: none; pointer-events: auto; }
#dialog.open { display: block; animation: dlgIn .22s ease-out; }
#dialog .box { background: rgba(255,248,238,.96); border-radius: 22px; padding: 14px 18px 14px 14px; display: flex; gap: 14px;
  box-shadow: 0 6px 0 rgba(0,0,0,.18), 0 10px 30px rgba(0,0,0,.25); align-items: flex-start; }
#dialog .who { flex: none; width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center;
  font-size: 38px; background: #fff; box-shadow: inset 0 0 0 3px rgba(0,0,0,.06); }
#dialog .body { flex: 1; min-width: 0; }
#dialog .name { font-weight: 700; font-size: 15px; letter-spacing: .06em; text-transform: uppercase; }
#dialog .text { font-size: 19px; font-weight: 600; line-height: 1.35; margin-top: 2px; min-height: 2.6em; }
#dialog .more { text-align: right; font-size: 13px; opacity: .55; font-weight: 700; margin-top: 2px; }
#dialog .opts { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
#dialog .opt { border: none; border-radius: 14px; padding: 10px 14px; font: 700 17px var(--font); text-align: left; cursor: pointer;
  background: #fff; color: var(--ink); box-shadow: 0 3px 0 rgba(0,0,0,.15); }
#dialog .opt.focus { background: var(--pink); color: #fff; transform: scale(1.02); }
@keyframes dlgIn { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
body.tv #dialog { width: min(1100px, calc(100% - 10vw)); bottom: 6vh; }
body.dialog-open #padHint, body.dialog-open .hud-slot.bottom { visibility: hidden; }
body.tv #dialog .text { font-size: 28px; } body.tv #dialog .opt { font-size: 24px; } body.tv #dialog .who { width: 88px; height: 88px; font-size: 54px; }
`);

const el = document.createElement("div");
el.id = "dialog";
el.innerHTML = `<div class="box"><div class="who"></div><div class="body"><div class="name"></div><div class="text"></div><div class="opts"></div><div class="more"></div></div></div>`;
document.body.appendChild(el);
const $who = el.querySelector(".who"), $name = el.querySelector(".name"), $text = el.querySelector(".text");
const $opts = el.querySelector(".opts"), $more = el.querySelector(".more");

let cur = null;        // { resolve, options, focus, full, shown, typing }
let glyphFn = () => "▶";
export function setDialogGlyph(fn) { glyphFn = fn; }

function open(name, text, opts = {}) {
    el.classList.add("open");
    ctx.dialogOpen = true;
    document.body.classList.add("dialog-open");      // bottom-of-screen HUD bits step aside
    $who.textContent = opts.emoji || "💬";
    $who.style.background = opts.bg || "#fff";
    $name.textContent = name || "";
    $name.style.color = opts.color || "var(--pink-dark)";
    $text.textContent = "";
    $opts.innerHTML = "";
    $more.innerHTML = "";
}

function close() {
    el.classList.remove("open");
    ctx.dialogOpen = false;
    document.body.classList.remove("dialog-open");
    cur = null;
}

/** Another feature's line / question opens over one still waiting (two things at once — ci/sweep-logic2): the one it
 *  replaces answers -1 ("closed", as closeDialog does) instead of waiting forever — its feature's `busy` flag / await
 *  used to stay stuck for the rest of the run. */
function supersede() {
    if (!cur) return;
    const r = cur.resolve;
    cur = null;
    S.superseded++;
    try { if (r) r(-1); } catch (e) { console.error("[dialog] superseded", e); }
}
export const S = { superseded: 0 };

/** Show one line; resolves when the player advances. */
export function say(name, text, opts = {}) {
    supersede();
    return new Promise(resolve => {
        open(name, text, opts);
        cur = { resolve, options: null, focus: 0, full: text, shown: 0, typing: true, keep: !!opts.keep, auto: opts.auto || 0, t: 0 };
        $more.innerHTML = glyphFn("confirm");
    });
}

/** Ask a question; resolves with the chosen option index. */
export function choose(name, text, options, opts = {}) {
    supersede();
    return new Promise(resolve => {
        open(name, text, opts);
        cur = { resolve, options, focus: opts.focus || 0, full: text, shown: 0, typing: true, keep: !!opts.keep, t: 0 };
        options.forEach((o, i) => {
            const b = document.createElement("button");
            b.className = "opt";
            b.innerHTML = o;
            b.style.visibility = "hidden";
            b.addEventListener("click", ev => { ev.stopPropagation(); pickOption(i); });
            b.addEventListener("pointerenter", () => setFocus(i, false));
            $opts.appendChild(b);
        });
    });
}

/** Play a list of [speaker, text, opts?] lines in order. `emoji` maps speaker → emoji. */
export async function script(lines, { emoji = {}, color = {} } = {}) {
    for (const [who, text, o] of lines) {
        // (-1: closed, or another feature's line covered this one — the rest of this script stops; it isn't read anymore)
        if (await say(who, text, Object.assign({ emoji: emoji[who], color: color[who] }, o || {})) === -1) return -1;
    }
}

export function isOpen() { return !!cur; }
/** Is a CHOICE waiting for the player? */
export function isChoiceOpen() { return !!(cur && cur.options); }
/** ⏭ Skip: finish the open LINE at once (no sound). Returns false for a choice — the player must pick. */
export function dialogFastForward() {
    if (!cur) return true;
    if (cur.options) return false;
    const r = cur.resolve, keep = cur.keep;
    if (!keep) close(); else cur = null;
    r(0);
    return true;
}
export function closeDialog() { const r = cur && cur.resolve; close(); if (r) r(-1); }

function setFocus(i, sound = true) {
    if (!cur || !cur.options) return;
    cur.focus = (i + cur.options.length) % cur.options.length;
    [...$opts.children].forEach((b, k) => b.classList.toggle("focus", k === cur.focus));
    if (sound) sfxMove();
}

function finishTyping() {
    cur.typing = false;
    cur.shown = cur.full.length;
    $text.textContent = cur.full;
    if (cur.options) {
        [...$opts.children].forEach(b => { b.style.visibility = "visible"; });
        setFocus(cur.focus, false);
    }
}

function pickOption(i) {
    if (!cur) return;
    if (cur.typing) { finishTyping(); return; }
    sfxSelect();
    const r = cur.resolve, keep = cur.keep;
    if (!keep) close(); else cur = null;
    r(i);
}

function advance() {
    if (!cur) return;
    if (cur.typing) { finishTyping(); return; }
    if (cur.options) { pickOption(cur.focus); return; }
    sfxSelect();
    const r = cur.resolve, keep = cur.keep;
    if (!keep) close(); else cur = null;
    r(0);
}

el.addEventListener("click", () => { if (cur && !cur.options) advance(); else if (cur && cur.typing) finishTyping(); });

/** Called by the main loop every frame while a dialogue is open. */
export function dialogUpdate(dt, P) {
    if (!cur) return;
    cur.t += dt;
    if (cur.typing) {
        cur.shown = Math.min(cur.full.length, cur.shown + dt * 55);
        $text.textContent = cur.full.slice(0, Math.floor(cur.shown));
        if (cur.shown >= cur.full.length) finishTyping();
    }
    if (cur.options && !cur.typing) {
        if (P.up || P.navLeft) setFocus(cur.focus - 1);
        else if (P.down || P.navRight) setFocus(cur.focus + 1);
    }
    if (P.pause) return;            // (☰ / Options / Esc pause the game — app.js — never answer the question)
    if (P.confirm || P.interact || P.start) advance();
    else if (P.back && !P.pause && cur && cur.options && !cur.typing) { const i = cancelIndex(cur.options); if (i >= 0) pickOption(i); }
    else if (cur && cur.auto && !cur.typing && cur.t > cur.auto) advance();
}
/** ○ / B on a question = its "never mind" answer, when it has one (the last option that reads like one) — a controller
 *  player's back button does what it says instead of nothing. A question with no such answer still waits for a pick. */
const CANCEL = /^[^\p{L}]*(not now|not today|never ?mind|maybe later|no,? thanks|just looking|stay a bit|leave it|cancel|nah\b|no$|back$)/iu;
function cancelIndex(options) {
    for (let i = options.length - 1; i >= 0; i--) { const o = String(options[i]).replace(/<[^>]*>/g, "").trim(); if (/^(✖|‹|❌)/u.test(o) || CANCEL.test(o)) return i; }
    return -1;
}
