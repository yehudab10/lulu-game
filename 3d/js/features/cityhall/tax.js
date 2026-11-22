// features/cityhall/tax.js — 💰 PROPERTY TAX + the town's LEDGER (stage 2).
//
// The ledger (S.ledger) holds everything she owes the town: property tax (per home, per PLAYED day — a new device day
// counts only once she's out in the world: `tick()` runs in playing / footRun), silly fees (fees.js) and the lien fee.
// Every tax bill is mirrored on real estate's per-home bill list (`ctx.realestate.addBill` / `payBill`, ref-matched).
// The rules (all numbers in data.js › TAX):
//   • tax = rate × the home's value, summed over her homes (not seized / lost), at most dayCap a played day (scaled down);
//     the unpaid tax stops growing at owedCapDays days' worth
//   • NOTHING is ever taken by itself: she pays at the Taxes window (lobby.js hook) or from 📞 Phone › 🏛️ City Hall —
//     always two presses, whole bills oldest first, only what the wallet has (never below 0)
//   • a tax bill unpaid letterAt played days → a stern letter (📱 Messages); lienAt → the LIEN notice + the lien fee + a
//     case in Courtroom 2B (court.js); everything paid → the lien is lifted
//   • it never touches ownership (real estate's server-side Abandoned Kugel Ordinance is the only thing that does)
import { ctx, emit } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { TAX, TAX_LINES as TL, FEE_TUNE } from "./data.js";
import { S, saveSoon, stat } from "./state.js";

if (!S.ledger || typeof S.ledger !== "object") S.ledger = {};
const L = S.ledger;
if (!Array.isArray(L.bills)) L.bills = [];
if (typeof L.played !== "number") L.played = 0;          // played days counted so far (the ledger's own clock)
if (L.day === undefined) L.day = null;                    // the device day of the last played day
if (typeof L.seq !== "number") L.seq = 0;
if (typeof L.paidTotal !== "number") L.paidTotal = 0;

export const TX = { force: {}, log: [] };
function log(ev, d = {}) { TX.log.push(Object.assign({ ev, t: +ctx.time.toFixed(2) }, d)); if (TX.log.length > 80) TX.log.shift(); }

const RE = () => ctx.realestate || null;
/** The device day (real estate's clock, so a test clock moves both). */
export const today = () => (RE() && RE().today ? RE().today() : Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000));
const unpaid = () => L.bills.filter(b => !b.paid);
export const owed = () => unpaid().reduce((a, b) => a + b.amount, 0);
const taxOwed = () => unpaid().filter(b => b.kind === "tax").reduce((a, b) => a + b.amount, 0);
/** Her homes that are taxed: hers, not held / lost by the Council. */
function taxedHomes() {
    const R = RE();
    if (!R || !R.owned) return [];
    return R.owned().filter(h => h && !h.seized && !h.lost);
}
function valueOf(h) {
    const R = RE();
    let v = 0;
    try { v = R && R.valueOf ? R.valueOf(h.id) || 0 : 0; } catch (e) { v = 0; }
    return Math.max(0, Math.round(v || h.paid || h.price || 0));
}
/** Today's tax per home: [{ id, address, amount }] (already scaled to the day cap). */
export function taxToday() {
    const homes = taxedHomes();
    let rows = homes.map(h => ({ id: h.id, address: h.address || "your home", amount: Math.max(1, Math.round(valueOf(h) * TAX.rate)) }));
    const total = rows.reduce((a, r) => a + r.amount, 0);
    if (total > TAX.dayCap) {
        const k = TAX.dayCap / total;
        rows = rows.map(r => Object.assign(r, { amount: Math.max(1, Math.floor(r.amount * k)) }));
        let sum = rows.reduce((a, r) => a + r.amount, 0);
        for (let i = 0; sum > TAX.dayCap && i < rows.length * 4; i++) { const r = rows[i % rows.length]; if (r.amount > 1) { r.amount--; sum--; } }
    }
    return rows;
}

/** Add a line to the ledger. kind: "tax" | "fee" | "lien". → the bill */
export function addLine(kind, what, amount, extra = {}) {
    const b = Object.assign({ ref: "ch" + (++L.seq), kind, what, amount: Math.max(0, Math.round(amount)), day: L.day, at: L.played, paid: false }, extra);
    L.bills.push(b);
    // (keep the ledger small: drop the oldest PAID lines first)
    while (L.bills.length > 60) { const i = L.bills.findIndex(x => x.paid); if (i < 0) break; L.bills.splice(i, 1); }
    saveSoon();
    emit("cityhall:bill", { kind, what, amount: b.amount, home: b.home || null });
    return b;
}

function text(msg, quiet = false) {
    const o = { from: TL.from, emoji: TL.emoji, color: TL.color, msg, thread: "City Hall", dur: 5 };
    try {
        if (quiet && ctx.phone && ctx.phone.inbox && ctx.phone.inbox.post) ctx.phone.inbox.post(o);
        else if (ctx.phone && ctx.phone.text) ctx.phone.text(o);
    } catch (e) { /* no phone */ }
    log("text", { quiet, msg: msg.slice(0, 40) });
}

/** A NEW played day: bill today's tax, expire old fees, the letter / the lien. (tick() calls it; tests too.) */
export function newDay(d) {
    L.day = d; L.played++;
    // fees unpaid for FEE_TUNE.expire played days are forgiven ("the city lost the paperwork")
    let expired = 0;
    for (const b of L.bills) if (!b.paid && b.kind === "fee" && L.played - b.at >= FEE_TUNE.expire) { b.paid = true; b.expired = true; expired++; }
    if (expired) text(TL.expired, true);
    // today's tax (only while what's unpaid is under the cap)
    const rows = taxToday();
    const daily = rows.reduce((a, r) => a + r.amount, 0);
    let room = Math.max(0, TAX.owedCapDays * daily - taxOwed()), billed = 0;
    for (const r of rows) {
        const n = Math.min(r.amount, room);
        if (n <= 0) break;
        room -= n; billed += n;
        const b = addLine("tax", `🏠 Property tax — ${r.address}`, n, { home: r.id });
        try { if (RE() && RE().addBill) RE().addBill(r.id, { what: `🏛️ Property tax: ${n} coins`, amount: n, from: "cityhall", ref: b.ref }); } catch (e) { /* none */ }
    }
    if (billed) { text(TL.bill(billed, rows.length), true); stat("cityhallTaxBilled", billed); }
    emit("cityhall:day", { d, homes: rows.length, billed });          // (fees.js: the porch licence)
    log("day", { d, played: L.played, billed, owed: owed() });
    lateCheck();
    saveSoon();
}
/** The letter + the lien, from the oldest unpaid TAX bill. */
export function lateCheck() {
    const tax = unpaid().filter(b => b.kind === "tax");
    if (!tax.length) {
        if (L.lien && !L.lien.lifted) { L.lien.lifted = L.played; text(TL.lifted); emit("cityhall:lien", { phase: "lifted" }); log("lien", { phase: "lifted" }); }
        L.letter = false;
        return;
    }
    const late = L.played - Math.min(...tax.map(b => b.at));
    if (late >= TAX.letterAt && !L.letter) { L.letter = true; text(TL.letter(owed())); stat("cityhallLetters"); emit("cityhall:letter", { owed: owed() }); log("letter", { owed: owed() }); }
    if (late >= TAX.lienAt && (!L.lien || L.lien.lifted)) {
        const fee = addLine("lien", "📬 Lien processing fee", TAX.lienFee);
        L.lien = { at: L.played, fee: fee.ref, n: (L.lien ? L.lien.n || 0 : 0) + 1, ruled: false };
        text(TL.lien(owed(), TAX.lienFee));
        stat("cityhallLiens");
        emit("cityhall:lien", { phase: "filed", owed: owed() });
        log("lien", { phase: "filed", owed: owed() });
    }
}
/** Is there a lien standing right now (filed, not lifted)? */
export const lienOn = () => !!(L.lien && !L.lien.lifted);

/** Mark a bill paid (+ real estate's mirror line). */
function settle(b) {
    b.paid = true; b.paidAt = L.played;
    if (b.kind === "tax" && b.home && RE() && RE().bills && RE().payBill) {
        try { const i = RE().bills(b.home).findIndex(x => x.ref === b.ref && !x.paid); if (i >= 0) RE().payBill(b.home, i); } catch (e) { /* none */ }
    }
}
/** What paying now would cover: whole bills, oldest first, as many as the wallet has. → { n, bills: [...], all } */
export function quote(max = wallet.coins) {
    const list = unpaid().slice().sort((a, b) => a.at - b.at || a.kind.localeCompare(b.kind));
    let n = 0; const take = [];
    for (const b of list) { if (n + b.amount > max) break; n += b.amount; take.push(b); }
    return { n, bills: take, all: take.length === list.length && list.length > 0, total: owed(), count: list.length };
}
/** Pay what `quote()` covers. Never below 0 (the wallet refuses). → coins paid */
export function payNow(reason = "window") {
    const q = quote();
    if (!q.n || !q.bills.length) return 0;
    if (!wallet.spend(q.n)) return 0;
    for (const b of q.bills) settle(b);
    L.paidTotal += q.n;
    stat("cityhallPaid", q.n);
    emit("cityhall:paid", { n: q.n, bills: q.bills.length, reason });
    log("paid", { n: q.n, k: q.bills.length, reason });
    lateCheck();
    saveSoon();
    return q.n;
}
/** The court's ruling on the lien: won → the lien fee waived + the lien lifted; lost → pay what she can now. */
export function ruleLien(won) {
    if (!lienOn()) return { none: true };
    L.lien.ruled = true;
    if (won) {
        const fee = L.bills.find(b => b.ref === L.lien.fee);
        if (fee && !fee.paid) { fee.paid = true; fee.waived = true; }
        L.lien.lifted = L.played;
        emit("cityhall:lien", { phase: "won" });
        log("lien", { phase: "won" });
        saveSoon();
        return { won: true };
    }
    const n = payNow("court");
    emit("cityhall:lien", { phase: "lost", n });
    log("lien", { phase: "lost", n });
    saveSoon();
    return { won: false, n, all: owed() === 0 };
}

/** ~2 Hz from index.js: a new device day becomes a played day once she's out in the world. */
export function taxTick() {
    if (!(ctx.state === "playing" || ctx.state === "footRun") || ctx.dialogOpen || ctx.paused) return;
    if (ctx.G && ctx.G.mode && !/^(cruise|story)$/.test(ctx.G.mode) && !TX.force.anyMode) return;      // (not in Dina's mode / a minigame run)
    const d = today();
    if (L.day === d) return;
    if (L.day == null) { L.day = d; saveSoon(); log("first", { d }); return; }        // (the first day she plays: no back-billing)
    newDay(d);
}
export const ledger = L;
