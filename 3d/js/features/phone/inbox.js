// features/phone — 💬 MESSAGES: every ctx.phone.text(...) also lands here (the driving
// bubble stays the transient notice), grouped into threads by `thread` or `from`, with
// unread counts, the last MAX kept in the 3D save. Plus the family group chat,
// "Mishpacha 💕🙄": Ima, Bubbe and Heshy react to Lulu's run when it ends.
import { ctx, on, emit, pick } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import { addApp, esc, PH, refresh, setHomeWidget } from "./ui.js";

const MAX = 50;
export const INBOX = store("phone", { msgs: [], seq: 0 });
if (!Array.isArray(INBOX.msgs)) INBOX.msgs = [];

/** Known thread titles (a `thread` key that isn't here is shown as given). */
const TITLES = { mishpacha: "Mishpacha 💕🙄" };
const PEOPLE = {   // a face + colour for the regulars, whatever case they're sent in
    ima: { emoji: "👩", color: "#E91E63", name: "Ima" }, bubbe: { emoji: "👵", color: "#8E24AA", name: "Bubbe" },
    heshy: { emoji: "🏊", color: "#1E88E5", name: "Heshy" }, avigail: { emoji: "💅", color: "#F06292", name: "Avigail" },
    dina: { emoji: "👧", color: "#FF7043", name: "Dina" },
};
const keyOf = s => String(s || "").trim().toLowerCase();

let listeners = [];
/** Called after every change (index.js: the corner dot). */
export function onInbox(fn) { listeners.push(fn); }
function changed() { saveSoon(); for (const f of listeners) { try { f(); } catch (e) { console.error(e); } } if (PH.open) refresh(); }

/** Store a message (no bubble). opts: { from, emoji, color, msg, thread?, read? } → the stored message. */
export function post(opts = {}) {
    const from = String(opts.from || "IMA");
    const thread = opts.thread ? String(opts.thread) : from;
    const k = keyOf(thread), who = PEOPLE[keyOf(from)];
    const m = {
        id: ++INBOX.seq, k, title: TITLES[k] || (opts.thread ? thread : (who ? who.name : from)),
        from: who && !opts.thread ? who.name : from, emoji: opts.emoji || (who && who.emoji) || "💬",
        color: opts.color || (who && who.color) || "#E91E63", msg: String(opts.msg || ""), t: Date.now(), r: !!opts.read,
        g: !!opts.thread,
    };
    INBOX.msgs.push(m);
    while (INBOX.msgs.length > MAX) INBOX.msgs.shift();
    emit("phone:text", { from: m.from, thread: k, msg: m.msg });
    changed();
    return m;
}
export const unread = (k = null) => INBOX.msgs.reduce((n, m) => n + (!m.r && (k == null || m.k === k) ? 1 : 0), 0);
/** Threads, newest first: [{ k, title, emoji, color, last, unread, n, group }] */
export function threads() {
    const by = new Map();
    for (const m of INBOX.msgs) {
        let t = by.get(m.k);
        if (!t) { t = { k: m.k, title: m.title, emoji: m.emoji, color: m.color, n: 0, unread: 0, group: m.g }; by.set(m.k, t); }
        t.last = m; t.n++; if (!m.r) t.unread++;
        if (!m.g) { t.emoji = m.emoji; t.color = m.color; }
        if (m.g) { t.emoji = m.k === "mishpacha" ? "👨‍👩‍👧" : "👥"; t.group = true; }
    }
    return [...by.values()].sort((a, b) => b.last.id - a.last.id);
}
export function markRead(k) {
    let n = 0;
    for (const m of INBOX.msgs) if (m.k === k && !m.r) { m.r = true; n++; }
    if (n) changed();
    return n;
}
export function clearInbox() { INBOX.msgs.length = 0; changed(); }

function ago(t) {
    const s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "now";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(t).getDay()];
}

// ── the app ───────────────────────────────────────────────────────────────
const V = { thread: null };
addApp({
    id: "messages", icon: "💬", name: "Messages", order: 20, color: "#43A047", color2: "#1B5E20",
    badge: () => unread() || null,
    render(el, api, arg) {
        if (arg && arg.thread) { V.thread = keyOf(arg.thread); PH.arg = null; }
        if (V.thread && !INBOX.msgs.some(m => m.k === V.thread)) V.thread = null;
        if (!V.thread) {
            const list = threads();
            if (!list.length) { el.innerHTML = `<p class="lp-empty">No messages yet.<br><small>The family will text. Oh, they'll text.</small></p>`; return; }
            el.innerHTML = list.map(t => `<button class="btn lp-row lp-thr${t.unread ? " new" : ""}" data-k="${esc(t.k)}">
                <span class="lp-av" style="--c:${t.color}">${t.emoji}</span>
                <span class="lp-tx"><b>${esc(t.title)}</b><small>${t.group ? esc(t.last.from) + ": " : ""}${esc(t.last.msg)}</small></span>
                <span class="lp-meta">${ago(t.last.t)}${t.unread ? `<i class="lp-badge">${t.unread}</i>` : ""}</span></button>`).join("");
            el.querySelectorAll(".lp-thr").forEach(b => b.addEventListener("click", () => { V.thread = b.dataset.k; api.refresh(); }));
            return;
        }
        const msgs = INBOX.msgs.filter(m => m.k === V.thread);
        const t = threads().find(x => x.k === V.thread);
        el.innerHTML = `<div class="lp-chat-h"><span class="lp-av" style="--c:${t.color}">${t.emoji}</span><b>${esc(t.title)}</b></div>
            <div class="lp-chat">${msgs.map(m => `<div class="lp-bub" style="--c:${m.color}">${m.g ? `<b>${m.emoji} ${esc(m.from)}</b>` : ""}${esc(m.msg).replace(/\n/g, "<br>")}<small>${ago(m.t)}</small></div>`).join("")}</div>
            <button class="btn lp-row lp-mini" id="lpThrBack">‹ All messages</button>`;
        el.querySelector("#lpThrBack").addEventListener("click", () => { V.thread = null; api.refresh(); });
        // read on sight (no refresh loop: changed() re-renders only once nothing's new)
        if (msgs.some(m => !m.r)) { for (const m of msgs) m.r = true; saveSoon(); for (const f of listeners) { try { f(); } catch (e) { /* ignore */ } } }
        const chat = el.querySelector(".lp-chat");
        chat.scrollTop = chat.scrollHeight;
    },
    back() { if (V.thread) { V.thread = null; return refresh(), true; } return false; },
});
// the home screen's notification cards: the latest unread threads (hidden on short screens)
setHomeWidget(() => threads().filter(t => t.unread).slice(0, 2).map(t => `<button class="lp-notif" data-open="messages" data-thread="${esc(t.k)}">
    <span class="lp-av" style="--c:${t.color}">${t.emoji}</span><span class="lp-tx"><b>${esc(t.title)}${t.unread > 1 ? ` · ${t.unread}` : ""}</b><small>${t.group ? esc(t.last.from) + ": " : ""}${esc(t.last.msg)}</small></span></button>`).join(""));
/** Tests / other features: which thread the Messages app shows (null = the list). */
export const view = V;

// ── 👨‍👩‍👧 Mishpacha: the family group chat reacts to the run ───────────────────
const fmt = n => Math.round(n).toLocaleString();
export function familyLines(r) {
    const G = r.G || {}, mi = Math.max(0, (r.distance || 0) / 1609), out = [];
    const tickets = G.tickets || 0, crashes = G.crashes || 0, close = G.closeCalls || 0, coins = r.coins || 0;
    if (tickets > 0) out.push(["Ima", `${tickets} ticket${tickets > 1 ? "s" : ""}?! Who raised you?? …don't answer that 🙄`]);
    if (crashes >= 3) out.push(["Bubbe", `${crashes} crashes. I lit a candle for the car 🕯️`]);
    if (close >= 8) out.push(["Ima", `${close} close calls. My heart. MY HEART 💔`]);
    if (G.newBest && r.score > 0) out.push(["Heshy", `NEW RECORD ${fmt(r.score)}!! legend 🏆`]);
    if (coins >= 150) out.push(["Heshy", `${fmt(coins)} coins?? venmo me 😎`]);
    if (mi >= 2) out.push(["Bubbe", `${mi.toFixed(1)} miles!! Did you EAT something? 🍲`]);
    if (r.reason === "wreck" || r.reason === "gameover") out.push(["Ima", "Are you hurt?? Call me. CALL ME. 📞"]);
    if (!out.length) out.push(pick([["Ima", "Text me when you get there 💕"], ["Bubbe", "Drive safe, mamele 😘"], ["Heshy", "👍"]]));
    if (out.length < 3) out.push(pick([["Heshy", "lol"], ["Bubbe", "Who taught her to drive like this? 🙄"], ["Ima", "Love you! Wear a sweater 🧥"]]));
    const seen = new Set();
    return out.filter(([who]) => (seen.has(who) && out.length > 2 ? false : (seen.add(who), true))).slice(0, 3);
}
on("run:end", r => {
    if (!ctx.enabled("phone") || !r || (r.G && r.G.mode === "party") || (r.distance || 0) < 250 || r.reason === "map") return;
    for (const [who, msg] of familyLines(r)) post({ thread: "mishpacha", from: who, msg });
});
