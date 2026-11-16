// features/memory — 📱 TEXTS: people Lulu met text her afterwards.
//
// A small persistent queue (≤ 6). Each text is due in a run (this one after N s
// of driving, or the next one) and goes out through ctx.phone.text (journey's
// phone; the phone feature also files every text in 💬 Messages, one thread per sender:
// `from` is the thread title, so it is a readable name. A `thread` makes a GROUP chat).
// Never during a call, a chase, a job, on foot or the tutorial; ≥ 40 s apart,
// at most 3 a run.
//   • after a 🚕 cab shift: one or two of the fares (the groom's wedding photo,
//     Gertie's emotional state, @LuxeLeah's tag, Mr. Katz's grade, the P.I.)
//   • after a 🔥 delivery: the customer follows up on the review
//   • after a 💰 getaway: Uncle Moishe
//   • 💜 Avigail, when Lulu's notoriety has grown since she last said something
import { ctx } from "../../core/ctx.js";
import { M, CAP, dirty, live, knobs, chance, pick, rand, clamp, fill, notoriety, oncePerRun } from "./data.js";
import * as T from "./lines.js";

export const TX = { cool: 0, sent: 0, perRun: 0, lastSent: null, log: [] };
const GAP = 40, PER_RUN = 3;

/** Queue a text: { from, emoji, color, msg, thread }, due { next: bool, after: s of driving }. */
export function queueText(t, { next = false, after = null } = {}) {
    if (!t || !t.msg) return null;
    const runT = (ctx.G && ctx.G.runTime) || 0;
    const item = { from: t.from || "UNKNOWN", emoji: t.emoji || "💬", color: t.color || "#E91E63", msg: String(t.msg), thread: t.thread || null,
        run: M.runs + (next ? 1 : 0), after: next ? (after ?? rand(25, 70)) : runT + (after ?? rand(45, 110)) };
    M.texts.push(item);
    while (M.texts.length > CAP.texts) M.texts.shift();
    dirty();
    return item;
}

function canText() {
    const G = ctx.G || {};
    if (!live() || ctx.state !== "playing" || ctx.paused || ctx.dialogOpen || ctx.skipping) return false;
    if (!ctx.phone || !ctx.phone.text || (ctx.phone.busy && ctx.phone.busy())) return false;
    if (G.tutorial || (ctx.foot && ctx.foot.active)) return false;
    if (ctx.law && ctx.law.chasing) return false;
    if (ctx.hustle && ctx.hustle.job) return false;
    if (ctx.multiplayer && ctx.multiplayer.inRace) return false;
    return true;
}

/** Every driving frame: send the next text that's due (rate-limited). */
export function textsTick(dt) {
    TX.cool -= dt;
    if (!M.texts.length || TX.cool > 0 || TX.perRun >= PER_RUN || !canText()) return;
    const runT = (ctx.G && ctx.G.runTime) || 0;
    // stale ones (3+ runs old) are forgotten
    const before = M.texts.length;
    M.texts = M.texts.filter(x => x.run >= M.runs - 3);
    if (M.texts.length !== before) dirty();
    const i = M.texts.findIndex(x => x.run < M.runs ? runT >= 20 : x.run === M.runs && runT >= x.after);
    if (i < 0) return;
    const [x] = M.texts.splice(i, 1);
    dirty();
    send(x);
}
function send(x) {
    try {
        ctx.phone.text({ from: x.from, emoji: x.emoji, color: x.color, msg: x.msg, dur: 6.5, thread: x.thread || undefined });
    } catch (e) { console.error("[memory] text", e); return; }
    TX.cool = GAP; TX.sent++; TX.perRun++;
    TX.lastSent = x;
    TX.log.push(x);
    if (TX.log.length > 12) TX.log.shift();
}
export function textsRunStart() { TX.perRun = 0; TX.cool = 15; }

// ── 💼 side jobs → follow-ups ─────────────────────────────────────────────
let curJob = null;
export function onJobStart() { curJob = ctx.hustle && ctx.hustle.job; }
export function onJobEnd(e = {}) {
    const job = curJob && curJob.id === e.id ? curJob : null;
    curJob = null;
    if (!live() || !job || e.result === "quit") return;
    try {
        if (e.id === "cab") cabTexts(job);
        else if (e.id === "delivery") deliveryText(job, e);
        else if (e.id === "getaway") getawayText(job, e);
    } catch (err) { console.error("[memory] job texts", err); }
}

/** The fares she actually had in the cab this shift: [{ fare, ok }]. */
export function faresMet(job) {
    const fares = job.fares || [], n = Math.min(job.i ?? 0, fares.length);
    const paid = (job.names || []).slice();
    const out = [];
    for (let i = 0; i < n; i++) {
        const f = fares[i];
        const k = paid.indexOf(f.emoji);
        if (k >= 0) paid.splice(k, 1);
        out.push({ fare: f, ok: k >= 0 });
    }
    const cur = job.cur;
    if (cur && cur.fare && job.phase !== "pickup" && n < fares.length && fares[n] === cur.fare) out.push({ fare: cur.fare, ok: false });
    return out;
}
function cabTexts(job) {
    const met = faresMet(job).filter(m => T.FARE_TEXTS[m.fare.id]);
    if (!met.length) return;
    for (let i = met.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [met[i], met[j]] = [met[j], met[i]]; }
    const n = met.length >= 2 && chance(0.5) ? 2 : 1;
    met.slice(0, n).forEach((m, k) => {
        const L = T.FARE_TEXTS[m.fare.id];
        const msg = pick(m.ok ? L.ok : L.bad);
        queueText({ from: L.from, emoji: L.emoji, color: L.color, msg }, { next: k > 0 || !chance(0.6) });
    });
}
/** The same star formula hustle's delivery uses (1★ when it never arrived). */
export function deliveryStars(job, result) {
    if (result !== "pass") return 1;
    return clamp(Math.round(((job.heat ?? 1) * 0.45 + (1 - (job.spill ?? 0)) * 0.55) * 5 + 0.2), 1, 5);
}
function deliveryText(job, e) {
    const food = job.food || {};
    const L = T.DELIVERY_TEXTS[food.id];
    if (!L) return;
    const st = deliveryStars(job, e.result);
    if (st <= 2 && chance(0.85)) queueText({ from: L.from, emoji: L.emoji, color: L.color, msg: pick(L.bad) }, { next: !chance(0.5) });
    else if (st >= 5 && chance(0.4)) queueText({ from: L.from, emoji: L.emoji, color: L.color, msg: pick(L.good) }, { next: true });
}
function getawayText(job, e) {
    if (!chance(0.75)) return;
    const lost = job.lost || 0;
    const msg = e.result !== "pass" ? pick(T.MOISHE_TEXTS.fail) : lost ? fill(pick(T.MOISHE_TEXTS.lost), { n: lost }) : pick(T.MOISHE_TEXTS.clean);
    queueText({ from: "Uncle Moishe", emoji: "🕶️", color: "#37474F", msg }, { next: !chance(0.4) });
}

// ── 💜 Avigail ────────────────────────────────────────────────────────────
const AVI_KEYS = ["arrests", "maxStars", "escapes", "carjacks", "er"];
/** What's new since Avigail last commented: { key, n } | null. */
export function aviNews(n = notoriety()) {
    for (const k of AVI_KEYS) if ((n[k] || 0) > (M.avi[k] || 0)) return { key: k === "maxStars" ? "stars" : k, n: n[k], raw: k };
    return null;
}
export function aviSeen(n = notoriety()) {
    for (const k of AVI_KEYS) M.avi[k] = n[k] || 0;
    dirty();
}
/** Run start: ~30 % of runs, if something new happened, Avigail texts about it. */
export function aviRunStart() {
    if (!live()) return;
    const n = notoriety(), news = aviNews(n);
    if (!news || !chance(0.3) || !oncePerRun("aviText")) return;
    const msg = fill(pick(T.AVI_TEXT[news.key]), { n: news.n });
    queueText({ from: "Avigail", emoji: "💅", color: "#8E24AA", msg }, { after: rand(50, 140) });
    aviSeen(n);
}
