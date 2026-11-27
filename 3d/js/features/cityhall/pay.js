// features/cityhall/pay.js — paying the town (stage 2): the TAXES window in city hall (lobby.js `addWindowHook("taxes", …)`) and
// 📞 Phone › 🏛️ City Hall (a community contact — the phone stays 9 apps). Both: what she owes, then TWO presses to pay
// (whole bills oldest first, only what the wallet has — never below 0). Nothing is ever taken without her pressing.
import { ctx, on } from "../../core/ctx.js";
import { wallet } from "../../core/save.js";
import { TAX_WINDOW as TW, CONTACT, TAX_LINES as TL } from "./data.js";
import { addWindowHook } from "./lobby.js";
import { owed, quote, payNow, ledger, lienOn } from "./tax.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const unpaid = () => ledger.bills.filter(b => !b.paid);

/** The Taxes window: true = handled (the clerk's own small talk is skipped). */
addWindowHook("taxes", async (rt, who, name) => {
    const o = { emoji: "💰", person: who, color: "#2E7D32" };
    const total = owed();
    if (!total) return false;                                   // (nothing owed: the clerk's usual line)
    const list = unpaid();
    for (;;) {
        const q = quote(wallet.coins);
        const opts = [];
        if (q.n) opts.push(q.all ? TW.payAll(q.n) : TW.payPart(q.n));
        opts.push(TW.list, TW.later);
        const i = await rt.choose(name, TW.owe(owed(), list.length) + (lienOn() ? " (There's a lien on your mailbox flag.)" : ""), opts, o);
        if (rt.disposed || i < 0) return true;
        const pick0 = q.n ? opts[i] : null;
        if (pick0 && /^💰/.test(pick0)) {
            const c = await rt.choose(name, `${q.n} coins for ${q.bills.length} ${q.bills.length === 1 ? "bill" : "bills"}. Sure?`, [TW.confirm(q.n), "✖ Not yet"], o);
            if (rt.disposed) return true;
            if (c === 0) {
                const n = payNow("window");
                if (n) { await rt.say(name, pick(TW.done), o); try { ctx.phone.inbox.post({ from: TL.from, emoji: TL.emoji, color: TL.color, msg: TL.paid(n), thread: "City Hall" }); } catch (e) { /* no phone */ } }
            }
            return true;
        }
        if (opts[i] === TW.list) {
            const lines = unpaid().slice(0, 6).map(b => `${b.what}: ${b.amount}`).join(" · ");
            await rt.say(name, lines + (unpaid().length > 6 ? " · …and more." : ""), o);
            if (rt.disposed) return true;
            continue;
        }
        return true;
    }
}, 0);

// ── 📞 Phone › 🏛️ City Hall ──
const PH = { armed: 0 };
/** More rows for the contact from later stages: CONTACT_EXTRAS.push({ html() → string, bind(el, rerender) }). */
export const CONTACT_EXTRAS = [];
function contactRender(el) {
    const list = unpaid(), total = owed(), q = quote(wallet.coins);
    let h = `<div class="lp-note">🏛️ <b>${esc(CONTACT.name)}</b>. ${total ? `You owe <b>${total} coins</b>.` : "You owe nothing. Nice!"}${lienOn() ? " 📬 There's a lien notice on your mailbox." : ""}</div>`;
    h += list.length ? list.slice(0, 8).map(b => `<div class="lp-row btn nonav" style="pointer-events:none"><span class="lp-av">${b.kind === "tax" ? "🏠" : b.kind === "lien" ? "📬" : "🧾"}</span><span class="lp-tx"><b>${esc(b.what)}</b></span><span class="lp-meta">${b.amount} 💰</span></div>`).join("")
        : `<p class="lp-empty">No bills. The town has nothing on you.</p>`;
    if (q.n) h += `<button class="btn lp-row" id="chPay"><span class="lp-av">✍️</span><span class="lp-tx"><b>${PH.armed === q.n ? `Tap again to pay ${q.n} coins` : (q.all ? `Pay it all (${q.n} coins)` : `Pay what I can (${q.n} coins)`)}</b><small>${PH.armed === q.n ? "This pays the town" : "Tap twice to pay"}</small></span></button>`;
    else if (total) h += `<p class="lp-fine">${esc(TW.broke)}</p>`;
    for (const x of CONTACT_EXTRAS) { try { h += x.html() || ""; } catch (e) { /* none */ } }
    h += `<p class="lp-fine">Tax is only billed on days you play. It never takes your home.</p>`;
    el.innerHTML = h;
    for (const x of CONTACT_EXTRAS) { try { x.bind(el, () => contactRender(el)); } catch (e) { /* none */ } }
    const b = el.querySelector("#chPay");
    if (b) b.addEventListener("click", () => {
        const q2 = quote(wallet.coins);
        if (PH.armed !== q2.n) { PH.armed = q2.n; contactRender(el); const nb = el.querySelector("#chPay"); if (nb) nb.focus(); return; }
        PH.armed = 0;
        const n = payNow("phone");
        if (n) try { ctx.phone.inbox.post({ from: TL.from, emoji: TL.emoji, color: TL.color, msg: TL.paid(n), thread: "City Hall" }); } catch (e) { /* no phone */ }
        contactRender(el);
    });
}
on("phone:close", () => { PH.armed = 0; });
on("boot", () => {
    if (ctx.community && ctx.community.addContact) ctx.community.addContact({ id: "cityhall", icon: "🏛️", name: CONTACT.name, tag: CONTACT.tag, color: "#455A64", render: contactRender });
});
export { contactRender };
