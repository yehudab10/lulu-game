// features/realestate/mortgage.js — 🏦 THE MORTGAGE DESK in each town's bank lobby (features/heist's "bank" interior —
// added from here, on interior:enter, so heist's file stays the bank's: a desk, a banker, one ✋ hotspot) and the
// mortgages themselves.
//
// THE RULES (every number in data.js › MORTGAGE):
//   • at least 20 % down; pay the rest back over 10 / 20 / 30 PLAYED days with the bank's flat fee of 5 / 10 / 15 % of the
//     loan (no compounding). Signing is two presses (pick the plan → ✍️ Sign) and says plainly how the payments work.
//   • ONE payment per real day she PLAYS, taken by the bank by itself the first moment she has enough coins that day (she
//     agreed to it when signing; each one is a 🏦 text). A day she doesn't play: nothing happens, nothing is owed.
//   • a day she played without paying = a MISSED day (no extra fee): 1 in a row → a stern letter, 2 → the realtor's "we
//     should talk", 3 → a friendly foreclosure: the house goes back and she gets back whichever is MORE — what the house
//     sells for after the bank is paid (today's value − the 10 % sale fee − what she still owes), or HALF of everything she
//     paid in. Never below zero: nothing here takes coins she doesn't have.
//   • pay it all off early any time (two presses) and skip half of the bank's remaining fee.
import * as THREE from "three";
import { ctx, on, emit } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { current } from "../interiors/engine.js";
import { MORTGAGE, SALE, BANKERS, BANK_LINES, BANK_TEXTS, CAP } from "./data.js";
import { registry, S } from "./registry.js";
import { valueOf, today, listings, isListed } from "./market.js";
import { finalize, log } from "./deal.js";
import { pickPaged } from "./pager.js";
import { Kit } from "../decor/props.js";
import { claim as svClaim, release as svRelease } from "./server.js";
import { COUNCIL } from "./data.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString("en-US");
const townId = () => (ctx.town && ctx.town.active && ctx.town.id) || "lakewood";
import { roam } from "./party.js";
const party = () => (!!(ctx.party && ctx.party.active) || !!(ctx.G && ctx.G.mode === "party")) && !roam();     // (with friends: 🌍 Free Roam only)
const banker = town => BANKERS[town] || BANKERS.lakewood;

// ── the numbers ──────────────────────────────────────────────────────────
/** A plan for a home worth `price`: { down, loan, fee, total, days, perDay }. */
export function plan(price, downShare, term) {
    const down = Math.ceil(price * Math.max(MORTGAGE.minDown, downShare) / 50) * 50;
    const loan = Math.max(0, price - down), fee = Math.round(loan * term.fee), total = loan + fee;
    return { price, down, loan, fee, total, days: term.days, perDay: Math.ceil(total / term.days) };
}
/** What she still owes on mortgage m. */
export const owed = m => Math.max(0, m.total - m.paid);
/** Paying it all off today: what's owed minus half of the bank's fee still in it. */
export function payoff(m) {
    const left = owed(m), feeLeft = m.total ? m.fee * left / m.total : 0;
    return Math.max(0, Math.round(left - feeLeft * MORTGAGE.earlyDiscount));
}
/** The next payment (the last one is whatever's left). */
const nextPay = m => Math.min(m.perDay, owed(m));
/** Her mortgages: [{ id, …m }] */
export const mortgages = () => Object.entries(S.mortgage).map(([id, m]) => Object.assign({ id }, m));
const text = (msg, from) => { try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: from || `🏦 ${banker(townId()).bank}`, emoji: "🏦", color: "#00695C", msg, thread: "bank", dur: 4.2 }); } catch (e) { /* no phone */ } };
const mail = (id, what) => { const L = (S.bills[id] = S.bills[id] || []); L.push({ at: Date.now(), what, amount: 0, paid: true, from: "bank" }); if (L.length > 20) L.shift(); };

/** Take out a mortgage on `rec` (it must be listed today): the down payment now. → { ok, why } */
export function take(rec, p, extra = null) {
    if (party()) return { ok: false, why: "party" };
    if (!isListed(rec)) return { ok: false, why: "gone" };
    if (registry.count() >= CAP) return { ok: false, why: "cap" };
    if (wallet.coins < p.down) return { ok: false, why: "coins" };
    if (!wallet.spend(p.down)) return { ok: false, why: "coins" };
    const r = finalize(rec, p.down, "mortgage", extra);
    if (!r.ok) { wallet.add(p.down); return r; }
    const d = today();
    S.mortgage[rec.id] = { address: rec.address, town: rec.town, price: p.price, down: p.down, loan: p.loan, fee: p.fee, total: p.total, days: p.days, perDay: p.perDay,
        paid: 0, n: 0, missed: 0, start: d, last: d, due: false, paidIn: p.down };
    saveSoon();
    emit("realestate:mortgage", { id: rec.id, phase: "start", plan: p });
    emit("stat", { id: "reMortgages", n: 1 });
    return { ok: true };
}
/** Pay today's payment now (the bank does it by itself too). → coins paid (0 = couldn't / nothing due) */
export function payToday(id) {
    const m = S.mortgage[id];
    if (!m || !m.due) return 0;
    const amt = nextPay(m);
    if (!amt || !wallet.spend(amt)) return 0;
    m.paid += amt; m.paidIn += amt; m.n++; m.due = false; m.missed = 0;
    log({ ev: "payment", id, n: amt });
    emit("realestate:mortgage", { id, phase: "payment", n: amt });
    if (owed(m) <= 0) { done(id, "paid"); return amt; }
    text(BANK_TEXTS.paid(m.n, Math.ceil(m.total / m.perDay), amt, Math.ceil(owed(m) / m.perDay)));
    saveSoon();
    return amt;
}
/** Pay the whole thing off now (half the remaining fee off). → coins paid (0 = couldn't) */
export function payOff(id) {
    const m = S.mortgage[id];
    if (!m) return 0;
    const amt = payoff(m);
    if (amt > 0 && !wallet.spend(amt)) return 0;
    m.paid = m.total; m.paidIn += amt;
    log({ ev: "payoff", id, n: amt });
    done(id, "early");
    return amt;
}
function done(id, how) {
    const m = S.mortgage[id];
    delete S.mortgage[id];
    saveSoon();
    emit("realestate:mortgage", { id, phase: "paidOff", how });
    emit("stat", { id: "reMortgagesPaid", n: 1 });
    if (m) { text(BANK_TEXTS.paidOff(m.address)); mail(id, "🎉 PAID IN FULL — a framed letter from the bank"); }
}
/** The friendly foreclosure: the house goes back; she gets back the larger of the sale's leftovers or half she paid in. */
export function foreclose(id) {
    const m = S.mortgage[id], h = registry.get(id);
    if (!m) return 0;
    const value = valueOf({ id, price: (h && h.price) || m.price });
    const equity = Math.round(value * (1 - SALE.fee)) - owed(m);
    const back = Math.max(0, equity, Math.round(m.paidIn * MORTGAGE.forecloseRefund));
    delete S.mortgage[id];
    registry.release(id, "foreclosed");
    if (back) wallet.add(back);
    log({ ev: "foreclosed", id, n: back });
    saveSoon();
    emit("realestate:owner", { id, from: "lulu", to: null, price: back, why: "foreclosed", address: m.address, town: m.town });
    emit("realestate:mortgage", { id, phase: "foreclosed", back });
    emit("stat", { id: "reForeclosed", n: 1 });
    text(BANK_TEXTS.foreclose(m.address, fmt(back)));
    return back;
}

// ── the days (only the days she plays) ────────────────────────────────────
/** Called every second or so while she's in the world: a new PLAYED day settles yesterday and bills today; a bill due
 *  is paid the moment she has the coins. */
export function tick() {
    const ids = Object.keys(S.mortgage);
    if (!ids.length) return;
    const d = today();
    let changed = false;
    for (const id of ids) {
        const m = S.mortgage[id];
        if (!m) continue;
        if (!registry.mine(id)) { delete S.mortgage[id]; changed = true; continue; }   // (sold / gone some other way)
        const hh = S.owned[id];
        if (hh && (hh.seized || hh.lost)) { if (d > m.last) { m.last = d; m.due = false; changed = true; } continue; }   // (the government holds it: nothing billed)
        if (d > m.last) {
            changed = true;
            if (m.due) {
                m.missed++;
                log({ ev: "missed", id, n: m.missed });
                emit("realestate:mortgage", { id, phase: "missed", n: m.missed });
                if (m.missed >= MORTGAGE.missForeclose) { foreclose(id); continue; }
                if (m.missed === MORTGAGE.missTalk) { text(BANK_TEXTS.talk(m.address), "👩‍💼 Your realtor"); mail(id, "☕ A note from your realtor: 'we should talk'"); }
                else if (m.missed === MORTGAGE.missLetter) { text(BANK_TEXTS.letter(m.address, fmt(nextPay(m)))); mail(id, "📄 A STERN letter from the bank"); }
            }
            m.last = d; m.due = owed(m) > 0;
        }
        if (m.due && wallet.coins >= nextPay(m)) { payToday(id); changed = true; }
    }
    if (changed) saveSoon();
}

// ── the desk in the bank lobby ────────────────────────────────────────────
const DESK = { x: 4.6, z: 0.55 };
on("interior:enter", ({ id }) => {
    if (id !== "bank") return;
    const rt = current();
    if (!rt || rt.def.id !== "bank") return;
    try { buildDesk(rt); } catch (e) { console.error("[realestate] desk", e); }
});
function buildDesk(rt) {
    const B = banker(townId());
    // (every box in ONE vertex-coloured mesh — decor's Kit: the bank lobby has a draw-call budget, heist test)
    const K = new Kit();
    const box = (w, h, d, c, x, y, z, ry = 0) => K.box(w, h, d, c, x, y, z, ry ? { ry } : undefined);
    const { x, z } = DESK;
    box(1.7, 0.08, 0.8, "#6D4C41", x, 0.76, z);                     // the desk top
    box(1.6, 0.72, 0.06, "#5D4037", x, 0.37, z + 0.36);              // its front
    box(0.06, 0.72, 0.74, "#5D4037", x - 0.8, 0.37, z); box(0.06, 0.72, 0.74, "#5D4037", x + 0.8, 0.37, z);
    // THE paperwork (a tower of it), a pen cup, a rubber stamp
    for (let k = 0; k < 9; k++) box(0.34, 0.05, 0.26, k % 2 ? "#FAFAFA" : "#F5F5F5", x + 0.45 + (k % 3) * 0.01, 0.83 + k * 0.05, z - 0.08, k * 0.07);
    box(0.08, 0.14, 0.08, "#263238", x - 0.55, 0.87, z - 0.1);
    box(0.1, 0.1, 0.1, "#B71C1C", x - 0.2, 0.85, z - 0.15);
    box(0.04, 1.2, 0.04, "#455A64", x - 0.62, 1.4, z - 0.35); box(0.04, 1.2, 0.04, "#455A64", x + 0.62, 1.4, z - 0.35);
    const desk = K.build("MortgageDesk");
    desk.traverse(o => { if (o.isMesh) rt.own(o.geometry); });
    rt.add(desk);
    // the sign on a stand: MORTGAGES
    const c = document.createElement("canvas"); c.width = 512; c.height = 128; const g = c.getContext("2d");
    g.fillStyle = "#004D40"; g.fillRect(0, 0, 512, 128); g.fillStyle = "#FFD54F"; g.font = "bold 54px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("🏦 MORTGAGES", 256, 50);
    g.fillStyle = "#E0F2F1"; g.font = "bold 24px sans-serif"; g.fillText(B.name + " · bring 40 pens", 256, 102);
    const t = rt.own(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(1.3, 0.33)), rt.own(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, side: THREE.DoubleSide })));
    sign.position.set(x, 1.95, z - 0.35); rt.add(sign);
    rt.cols.push({ id: "mortgageDesk", x0: x - 0.9, x1: x + 0.9, z0: z - 0.45, z1: z + 0.42, on: true });
    // the banker, behind it
    // (the banker is one of the three people already queuing in the lobby, moved behind the desk — a person is ~16
    //  draw calls and the lobby is at its budget; the bank keeps two in line)
    const from = B.key === "npcMan" ? "line1" : "line2", q = rt.byId[from];
    if (q) {
        q.p.obj.position.set(x, 0, z - 0.75); q.p.obj.rotation.y = 0;
        q.home = { x, z: z - 0.75, ry: 0 }; q.name = B.name; q.faceLulu = true; q.id = "banker";
        rt.byId.banker = q;          // (rt.byId[from] stays: the bank's "chat with the line" still looks him up — he grumbles about the queue too)
    } else rt.person("banker", B.key, { x, z: z - 0.75, ry: 0 }, { name: B.name, colors: B.colors, pose: {}, collide: false });
    rt.hot({ id: "mortgage", x, z: z + 1.0, r: 1.3, who: "banker", label: () => `🏦 ${B.name} — mortgages`, action: desk });
}

async function desk(rt) {
    const town = townId(), B = banker(town), who = rt.byId.banker;
    const sayB = l => rt.say(B.name, l, { emoji: B.emoji, person: who });
    const chooseB = (q, opts) => rt.choose(B.name, q, opts, { emoji: B.emoji, person: who });
    if (party()) { await sayB(BANK_LINES.party); return; }
    await sayB(pick(BANK_LINES.hello));
    for (;;) {
        const mine = mortgages();
        const opts = ["🏠 Buy a home with a mortgage"];
        if (mine.length) opts.push(`💳 My mortgages (${mine.length})`);
        opts.push("💬 Just asking");
        const i = await chooseB(mine.length ? `You owe us on ${mine.length} home${mine.length === 1 ? "" : "s"}. What can I do?` : "What can I do for you?", opts);
        if (rt.disposed || i < 0 || opts[i] === "💬 Just asking") { if (i >= 0 && !mine.length) await sayB(BANK_LINES.nothing); return; }
        if (i === 0) { if (await buyWith(rt, sayB, chooseB)) return; continue; }
        await manage(rt, sayB, chooseB, mine);
    }
}

/** 🏠 the listings → one → the down payment → the term → the paperwork → ✍️ sign. → true when bought */
async function buyWith(rt, sayB, chooseB) {
    const list = listings();
    if (!list.length) { await sayB(BANK_LINES.noList); return false; }
    if (registry.count() >= CAP) { await sayB("TEN homes? The bank is impressed. The town clerk is not. That's the limit, dear."); return false; }
    const i = await pickPaged(chooseB, "Which one? (Today's listings in town.)", list.map(r => `🏠 ${r.address} — ${fmt(valueOf(r))} 💰`));
    const rec = i >= 0 ? list[i] : null;
    if (!rec || rt.disposed) return false;
    const price = valueOf(rec);
    const downs = [0.2, 0.35, 0.5].map(sh => Math.ceil(price * sh / 50) * 50);
    const j = await chooseB(`${rec.address}: ${fmt(price)}. How much down? (You've got ${fmt(wallet.coins)}.)`, downs.map((d, k) => `💰 ${fmt(d)} down (${[20, 35, 50][k]} %)`).concat(["‹ Back"]));
    if (j < 0 || j >= 3 || rt.disposed) return false;
    const share = [0.2, 0.35, 0.5][j];
    if (wallet.coins < downs[j]) { await sayB(BANK_LINES.broke); return false; }
    const plans = MORTGAGE.terms.map(tm => plan(price, share, tm));
    const k = await chooseB("And how fast do you want to pay it back? Only days you PLAY count.", plans.map(p => `📅 ${p.days} days · ${fmt(p.perDay)} a day (fee ${fmt(p.fee)})`).concat(["‹ Back"]));
    if (k < 0 || k >= plans.length || rt.disposed) return false;
    const p = plans[k];
    await sayB(pick(BANK_LINES.paper));
    await sayB(BANK_LINES.terms);
    if (rt.disposed) return false;
    const s = await chooseB(`${fmt(p.down)} down now, then ${fmt(p.perDay)} a day you play, for ${p.days} days. Total ${fmt(p.down + p.total)}.`, [`✍️ Sign (all forty times) — ${fmt(p.down)} 💰`, "✖ Wait, let me think"]);
    if (s !== 0 || rt.disposed) return false;
    const c = await svClaim(rec.id);           // (the world-wide registry first, when the server has it)
    if (!c.ok) { await sayB(c.why === "seized" ? COUNCIL.held : c.why === "cap" ? "That's ten homes, dear. The limit." : COUNCIL.taken(c.by)); return false; }
    const r = take(rec, p, { reg: !!c.server });
    if (!r.ok && c.server) svRelease(rec.id);
    if (!r.ok) { await sayB(r.why === "coins" ? BANK_LINES.broke : r.why === "cap" ? "That's ten homes, dear. The limit." : "Oy — that one just sold! Pick another."); return false; }
    await sayB(pick(BANK_LINES.done));
    return true;
}

/** 💳 her mortgages: pay today's / pay it all off (two presses). */
async function manage(rt, sayB, chooseB, mine) {
    const i = mine.length === 1 ? 0 : await pickPaged(chooseB, "Which one?", mine.map(m => `🏠 ${m.address} — ${fmt(owed(m))} left`));
    const m = i >= 0 ? mine[i] : null;
    if (!m || rt.disposed) return;
    const opts = [];
    if (m.due) opts.push(`💸 Pay today's payment — ${fmt(nextPay(m))} 💰`);
    opts.push(`🏁 Pay it all off — ${fmt(payoff(m))} 💰 (half the fee off)`, "‹ Back");
    const info = `${m.address}: ${fmt(owed(m))} left · ${fmt(m.perDay)} a day you play · ${m.due ? "today's payment is DUE" : "today's is paid"}${m.missed ? ` · ${m.missed} missed in a row` : ""}.`;
    const j = await chooseB(info, opts);
    if (j < 0 || rt.disposed) return;
    const pick1 = opts[j];
    if (/today's payment/.test(pick1)) {
        const n = payToday(m.id);
        await sayB(n ? `Received, ${fmt(n)}. *STAMP*. Lovely.` : BANK_LINES.broke);
    } else if (/all off/.test(pick1)) {
        const amt = payoff(m);
        const c = await chooseB(`Pay ${fmt(amt)} coins and own ${m.address} free and clear?`, [`✍️ Pay it off — ${fmt(amt)} 💰`, "✖ Not yet"]);
        if (c !== 0 || rt.disposed) return;
        if (wallet.coins < amt) { await sayB(BANK_LINES.broke); return; }
        const n = payOff(m.id);
        await sayB(n || amt === 0 ? pick(BANK_LINES.paidOff) : BANK_LINES.broke);
    }
}
export { DESK };
