// features/journey/phone.js — the in-car phone (ctx.phone) and IMA IS CALLING.
//
//   ctx.phone.call({ from, emoji, color, lines, ring, talk, flip, declinable,
//                    ringText, ringSub, talkSub, doneText(result), donePay(result),
//                    onAnswer(), onDecline(), onHangUp(), onDone(result) }) → call | null
//   ctx.phone.text({ from, emoji, color, msg, dur })   a text message bubble (no input)
//   ctx.phone.active / .talking / .busy() / .hangUp()
//
// A call rings (📣 HONK declines), then Lulu picks up and the lines play; with
// flip: true the steering is FLIPPED while she talks (honk hangs up). The card
// sits in the HUD's left slot; Lulu holds a 3D phone to her ear in the car.
// Ima's calls (src/05b-ima-call.js): decline → +10, hang up → +10, full chat → +30.
import { ctx, on, hook, emit, css, rand } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { models, ensureModels, cloneWithColors } from "../../models.js";
import { glyph, rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as SFX from "./sfx.js";
import { IMA_CALL_LINES, IMA_RING_DUR, IMA_TALK_DUR, IMA_DONE_DUR, IMA_SPAWN } from "./data.js";
import { hasHeat } from "./state.js";

css("journey-phone", `
.jphone { width: min(360px, 78vw); background: rgba(18,24,36,.94); color: #FFF5E6; border-radius: 18px; padding: 10px 14px 10px 10px;
  display: flex; gap: 12px; align-items: center; box-shadow: 0 6px 18px rgba(0,0,0,.3); border: 2.5px solid var(--acc, #FF80AB);
  animation: jphIn .35s cubic-bezier(.2,1.5,.4,1); cursor: pointer; pointer-events: auto; }
.jphone.ring { animation: jphIn .35s cubic-bezier(.2,1.5,.4,1), jphBuzz .8s infinite .35s; }
.jphone.out { animation: jphOut .35s ease-in forwards; }
.jphone .av { flex: none; width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-size: 30px; background: var(--acc, #F06292); position: relative; }
.jphone.ring .av::after { content: ""; position: absolute; inset: -4px; border-radius: 50%; border: 3px solid var(--acc, #FF80AB); animation: jphWave 1s infinite; }
.jphone .tx { flex: 1; min-width: 0; text-align: left; }
.jphone .nm { font-weight: 700; font-size: 15px; color: var(--acc, #FF80AB); letter-spacing: .04em; }
.jphone .ln { font-weight: 700; font-size: 15px; line-height: 1.25; margin-top: 2px; }
.jphone .sub { font-size: 12.5px; opacity: .85; margin-top: 3px; color: #FFD54F; }
.jphone .sub .glyph { min-width: 20px; height: 20px; font-size: 11px; background: #fff; color: var(--ink); }
.jphone .bar { height: 5px; border-radius: 3px; background: rgba(255,255,255,.15); margin-top: 6px; overflow: hidden; }
.jphone .bar i { display: block; height: 100%; width: 0%; background: var(--acc, #FF80AB); }
.jphone .pay { font-weight: 700; color: #FFD700; font-size: 16px; margin-top: 2px; }
.jtext { background: rgba(255,255,255,.95); color: var(--ink); border-radius: 16px 16px 16px 4px; padding: 8px 12px; max-width: min(300px, 70vw);
  font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,.2); animation: jphIn .3s ease-out; text-align: left; }
.jtext b { display: block; font-size: 12px; color: var(--acc, #E91E63); letter-spacing: .05em; }
@keyframes jphIn { from { transform: translateX(-120%); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes jphOut { to { transform: translateX(-120%); opacity: 0; } }
@keyframes jphBuzz { 0%, 60%, 100% { transform: none; } 65% { transform: translateX(-3px) rotate(-1deg); } 75% { transform: translateX(3px) rotate(1deg); } 85% { transform: translateX(-2px); } }
@keyframes jphWave { from { transform: scale(1); opacity: 1; } to { transform: scale(1.45); opacity: 0; } }
body.tv .jphone { width: min(560px, 40vw); padding: 14px 18px; } body.tv .jphone .av { width: 76px; height: 76px; font-size: 44px; }
body.tv .jphone .nm { font-size: 22px; } body.tv .jphone .ln { font-size: 24px; } body.tv .jphone .sub { font-size: 18px; } body.tv .jtext { font-size: 22px; max-width: 520px; }
`);

// ── the 3D phone in Lulu's hand ───────────────────────────────────────────
let phoneObj = null;
function showPhoneProp(on) {
    const car = ctx.car;
    if (!car || !car.anchors || !car.anchors.head) return;
    if (on && !phoneObj) {
        if (!models.journey_phone) { ensureModels(["journey_phone"]).catch(() => {}); return; }
        phoneObj = cloneWithColors(models.journey_phone);
        phoneObj.scale.setScalar(1.6);
        phoneObj.position.set(0.25, -0.3, 0.02);
        phoneObj.rotation.set(0, 0.25, -0.2);
    }
    if (!phoneObj) return;
    if (on && phoneObj.parent !== car.anchors.head) car.anchors.head.add(phoneObj);
    if (!on && phoneObj.parent) phoneObj.parent.remove(phoneObj);
}

// ── the card ──────────────────────────────────────────────────────────────
let card = null, cur = null;
function render() {
    const slot = H.hudSlot("left");
    if (!cur) { if (card) { const c = card; card = null; c.classList.add("out"); setTimeout(() => c.remove(), 360); } return; }
    if (!card) {
        card = document.createElement("div");
        card.className = "jphone";
        card.addEventListener("click", () => { if (cur) honked(); });
        slot.prepend(card);
    }
    card.style.setProperty("--acc", cur.color || "#FF80AB");
    card.classList.toggle("ring", cur.phase === "ring");
    const h = glyph("honk");
    let html = `<div class="av">${cur.phase === "talk" ? (cur.talkEmoji || "🗣️") : cur.emoji || "📞"}</div><div class="tx">`;
    if (cur.phase === "ring") {
        html += `<div class="nm">📞 ${cur.from} is calling…</div>`;
        html += `<div class="ln">${cur.ringText || (cur.declinable ? `📣 ${h} HONK = decline` : "")}</div>`;
        if (cur.ringSub) html += `<div class="sub">${cur.ringSub}</div>`;
    } else if (cur.phase === "talk") {
        const li = Math.min(cur.lines.length - 1, Math.floor(cur.t / (cur.talk / cur.lines.length)));
        html += `<div class="nm">${cur.flip ? cur.from + " (on the phone)" : "📞 " + cur.from}</div><div class="ln">${cur.lines[li] || ""}</div>`;
        if (cur.talkSub) html += `<div class="sub">${cur.talkSub.replace("{honk}", h)}</div>`;
        html += `<div class="bar"><i style="width:${Math.min(100, cur.t / cur.talk * 100).toFixed(0)}%"></i></div>`;
    } else {
        html += `<div class="nm">${cur.from}</div><div class="ln">${cur.doneMsg || ""}</div>${cur.pay ? `<div class="pay">+${cur.pay} 💰</div>` : ""}`;
    }
    html += "</div>";
    if (card.dataset.h !== html) { card.dataset.h = html; card.innerHTML = html; }
}

function finish(result) {
    const c = cur;
    if (!c || c.phase === "done") return;
    c.result = result;
    c.phase = "done";
    c.t = 0;
    showPhoneProp(false);
    if (result === "declined") { try { c.onDecline && c.onDecline(); } catch (e) { console.error(e); } }
    if (result === "hungup") { try { c.onHangUp && c.onHangUp(); } catch (e) { console.error(e); } }
    c.doneMsg = c.doneText ? c.doneText(result) : "";
    c.pay = c.donePay ? c.donePay(result) : 0;
    try { c.onDone && c.onDone(result); } catch (e) { console.error(e); }
    emit("phone:end", { from: c.from, result });
    if (result !== "full") SFX.hangUp();
    if (!c.doneMsg && !c.pay) c.doneDur = 0.01;
    render();
}

function honked() {
    if (!cur) return;
    if (cur.phase === "ring") { if (cur.declinable) finish("declined"); else answer(); }
    else if (cur.phase === "talk") finish(cur.declinable ? "hungup" : "dismissed");
}
function answer() {
    cur.phase = "talk";
    cur.t = 0;
    SFX.pickUp();
    showPhoneProp(true);
    try { cur.onAnswer && cur.onAnswer(); } catch (e) { console.error(e); }
    emit("phone:answer", { from: cur.from });
    render();
}

function tick(dt, P) {
    if (!cur) return;
    cur.t += dt;
    if (cur.phase === "ring") {
        cur.beat -= dt;
        if (cur.beat <= 0) { cur.beat = 0.8; SFX.ring(); rumble(0.05, 0.25, 90); }
        if (P && P.honk) { honked(); return; }
        if (cur.t >= cur.ring) answer();
    } else if (cur.phase === "talk") {
        if (P && P.honk) { honked(); return; }
        if (cur.t >= cur.talk) finish("full");
        else render();
    } else if (cur.t >= cur.doneDur) {
        cur = null;
        render();
    }
}

export const phone = {
    /** Start a call. Returns the call object, or null if the line is busy. */
    call(opts = {}) {
        if (cur) return null;
        cur = Object.assign({
            from: "UNKNOWN", emoji: "📞", color: "#FF80AB", lines: ["…"], ring: IMA_RING_DUR, talk: IMA_TALK_DUR,
            flip: false, declinable: true, doneDur: IMA_DONE_DUR,
        }, opts, { phase: "ring", t: 0, beat: 0 });
        if (!(cur.ring > 0)) { cur.phase = "ring"; cur.ring = 0.0001; }
        emit("phone:ring", { from: cur.from });
        render();
        return cur;
    },
    /** A text message bubble under the phone card (4 s, no input). */
    text({ from = "IMA", emoji = "💬", color = "#E91E63", msg = "", dur = 4 } = {}) {
        const slot = H.hudSlot("left");
        const el = document.createElement("div");
        el.className = "jtext";
        el.style.setProperty("--acc", color);
        el.innerHTML = `<b>${emoji} ${from}</b>${msg.replace(/\n/g, "<br>")}`;
        slot.appendChild(el);
        SFX.chime(988, 1319);
        setTimeout(() => { el.classList.add("out"); el.style.animation = "jphOut .35s ease-in forwards"; setTimeout(() => el.remove(), 360); }, dur * 1000);
        return el;
    },
    get active() { return cur; },
    get talking() { return !!(cur && cur.phase === "talk"); },
    get flipped() { return !!(cur && cur.phase === "talk" && cur.flip); },
    busy() { return !!cur; },
    /** End the current call now (no callbacks except onDone("interrupted")). */
    hangUp(silent = true) {
        if (!cur) return;
        if (cur.phase !== "done") { const c = cur; c.phase = "done"; try { c.onDone && c.onDone("interrupted"); } catch (e) { console.error(e); } }
        cur = null;
        showPhoneProp(false);
        render();
        if (!silent) SFX.hangUp();
    },
};
ctx.phone = phone;

// the phone works while DRIVING; anything else (arrival, wreck, a scene) hangs up
hook("update", (dt, P, controlsOn) => {
    if (ctx.state !== "playing") return;
    tick(dt, P);
    imaTick(dt);
}, 20);
hook("controls", ctl => { if (phone.flipped) ctl.steer = -ctl.steer; }, 10);
on("state", ({ to }) => { if (to !== "playing" && cur) phone.hangUp(true); });
on("run:start", () => { phone.hangUp(true); imaTimer = rand(IMA_SPAWN.first[0], IMA_SPAWN.first[1]); });
on("run:end", () => phone.hangUp(true));

// ── IMA IS CALLING ────────────────────────────────────────────────────────
let imaTimer = rand(IMA_SPAWN.first[0], IMA_SPAWN.first[1]);
/** Extra "can she call now?" checks other modules add (story call up, leg banner showing…). */
export const phoneGuards = [];
function imaCanStart() {
    const G = ctx.G;
    if (cur || ctx.state !== "playing") return false;
    if (ctx.foot && ctx.foot.active) return false;
    if (hasHeat()) return false;
    if (ctx.multiplayer && ctx.multiplayer.inRace) return false;   // flipped steering would be unfair in a race
    for (const g of phoneGuards) { try { if (g() === false) return false; } catch (e) { /* ignore */ } }
    return (G.runTime || 0) > 30;
}
function imaTick(dt) {
    if (!ctx.enabled("journey")) return;
    imaTimer -= dt;
    if (imaTimer > 0) return;
    imaTimer = rand(IMA_SPAWN.every[0], IMA_SPAWN.every[1]);
    const bias = ctx.journey && ctx.journey.spawnBias ? ctx.journey.spawnBias("imaCall") : 1;
    if (Math.random() < Math.min(0.95, IMA_SPAWN.chance * bias) && imaCanStart()) imaCall();
}

/** Ring Lulu right now (also used by tests). */
export function imaCall() {
    const pool = IMA_CALL_LINES.slice(), lines = [];
    for (let i = 0; i < 3; i++) lines.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return phone.call({
        from: "IMA", emoji: "📞", talkEmoji: "🗣️", color: "#FF80AB", lines, ring: IMA_RING_DUR, talk: IMA_TALK_DUR, flip: true, declinable: true,
        ringText: `📣 ${glyph("honk")} HONK = "I'm DRIVING, Ima!"`, ringSub: "…or let it ring to pick up",
        talkSub: "🔄 steering's flipped! · 📣 {honk} to hang up",
        doneText: r => r === "full" ? "Love you! Gas money's on the way 💸" : r === "declined" ? "Good girl — eyes on the road! 👀" : "Hung up on your MOTHER?! …drive safe. 💋",
        donePay: r => r === "full" ? 30 : 10,
        onDone(r) {
            if (r === "interrupted") return;
            const pay = r === "full" ? 30 : 10;
            addCoins(pay, "ima");
            emit("stat", { id: r === "full" ? "imaCalls" : "imaDeclines", n: 1 });
            H.toast(`+${pay} 💰 from Ima`, "pink");
        },
    });
}
