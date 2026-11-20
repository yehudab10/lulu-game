// features/realestate/rent.js — 🧑 TENANTS + RENT, and 🪧 SELLING (stage 3).
//
// RENT (golden rule 5: no repeatable free coins — it's CAPPED): a home with a tenant earns RENT.share (1 %) of its value
// per real day she PLAYS, into that home's mailbox (✋ 📬 to collect; it piles up to RENT.pileDays days' worth); ALL her
// homes together earn at most RENT.dayCap (150) a played day — ten homes are a hobby, never a money printer. Days she
// doesn't play earn nothing. The tenant moves in the day after the realtor finds them; a home with a tenant can't be
// redecorated (it's their home now); she can ask them to leave any time.
//
// SELLING: through the realtor, at today's value − SALE.fee (10 %). The value only drifts ±3.5 % over the real days, so
// buying and selling again always loses at least ~3 % (no arbitrage). A home with a mortgage: the sale pays the bank off
// first (the early pay-off price, half the remaining fee off) and she gets the rest — never below zero (if the sale
// doesn't cover it, the bank calls it even).
import { ctx, emit } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { RENT, SALE, TENANTS } from "./data.js";
import { registry, S } from "./registry.js";
import { valueOf, today } from "./market.js";
import { payoff } from "./mortgage.js";
import { log } from "./deal.js";

const fmt = n => Math.round(n).toLocaleString("en-US");
const valueOfOwned = (id, h) => valueOf({ id, price: (h && h.price) || 0 });

// ── tenants ──────────────────────────────────────────────────────────────
export const tenantOf = id => { const r = S.rent[id]; return r && r.tenant != null ? TENANTS[r.tenant % TENANTS.length] : null; };
/** Find a tenant for one of her homes: they move in tomorrow (the next played day). → the tenant | null */
export function findTenant(id) {
    if (!registry.mine(id) || tenantOf(id)) return null;
    const k = Math.floor(Math.random() * TENANTS.length);
    S.rent[id] = { tenant: k, since: today() + 1, pile: 0 };
    saveSoon();
    emit("realestate:tenant", { id, phase: "in", who: TENANTS[k].name });
    emit("stat", { id: "reTenants", n: 1 });
    return TENANTS[k];
}
/** The tenant leaves (rent already in the mailbox stays hers). */
export function tenantOut(id) {
    const r = S.rent[id];
    if (!r || r.tenant == null) return false;
    r.tenant = null;
    if (!r.pile) delete S.rent[id];
    saveSoon();
    emit("realestate:tenant", { id, phase: "out" });
    return true;
}
/** Today's rent for each tenanted home (a tenant only pays from the day after they moved in), scaled so the total is ≤ the cap. */
export function rentToday(d = today()) {
    const rows = [];
    for (const h of registry.listFor(null)) {
        const r = S.rent[h.id];
        if (!r || r.tenant == null || d < r.since) continue;
        rows.push({ id: h.id, n: Math.round(valueOfOwned(h.id, h) * RENT.share) });
    }
    const sum = rows.reduce((a, r) => a + r.n, 0), f = sum > RENT.dayCap ? RENT.dayCap / sum : 1;
    for (const r of rows) r.n = Math.floor(r.n * f);
    return rows;
}
/** A new PLAYED day: each tenant pays into their mailbox (capped across every home + a pile limit per home). */
export function tick() {
    const d = today();
    if (S.days.rent == null) { S.days.rent = d; return; }
    if (d <= S.days.rent) return;
    S.days.rent = d;
    let total = 0;
    for (const row of rentToday(d)) {
        const r = S.rent[row.id];
        r.pile = Math.min((r.pile || 0) + row.n, row.n * RENT.pileDays);
        total += row.n;
    }
    if (total) emit("realestate:rent", { day: d, total });
    saveSoon();
}
/** ✋ the mailbox: collect what's piled up there. → coins (0 = nothing yet) */
export function collect(id) {
    const r = S.rent[id];
    const n = r ? Math.max(0, Math.round(r.pile || 0)) : 0;
    if (!n) return 0;
    r.pile = 0;
    if (r.tenant == null) delete S.rent[id];
    S.earned += n;
    saveSoon();
    if (ctx.G && ctx.state !== "title") { import("../../core/driving.js").then(m => m.addCoins(n, "rent")).catch(() => wallet.add(n)); }
    else wallet.add(n);
    log({ ev: "rent", id, n });
    emit("stat", { id: "reRent", n });
    return n;
}

// ── selling ──────────────────────────────────────────────────────────────
/** What selling a home gets her today: { value, fee, bank (paid to the bank), net }. */
export function quote(id) {
    const h = registry.get(id);
    if (!h) return null;
    const value = valueOfOwned(id, h), fee = Math.round(value * SALE.fee);
    const m = S.mortgage[id], bank = m ? payoff(m) : 0;
    return { value, fee, bank, net: Math.max(0, value - fee - bank) };
}
/** Sell it: the house goes back on the market, the coins to her. → the quote | null */
export function sell(id) {
    const q = quote(id), h = registry.get(id);
    if (!q || !h) return null;
    delete S.mortgage[id];
    const r = S.rent[id];
    const pile = r ? Math.max(0, Math.round(r.pile || 0)) : 0;      // (uncollected rent comes with the sale)
    delete S.rent[id];
    delete S.decor[id];
    registry.release(id, "sold");
    const n = q.net + pile;
    if (n) wallet.add(n);
    S.sold.push({ id, address: h.address, n: q.net, day: today() }); if (S.sold.length > 30) S.sold.shift();
    S.earned += q.net;
    log({ ev: "sold", id, n: q.net });
    saveSoon();
    emit("realestate:owner", { id, from: "lulu", to: null, price: q.net, why: "sold", address: h.address, town: h.town });
    emit("stat", { id: "reSold", n: 1 });
    return Object.assign({ pile }, q);
}
export { fmt };
