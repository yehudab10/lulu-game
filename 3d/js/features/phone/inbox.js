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
const V = { thread: null, list: false, house: false };
/** 🏠 My house (features/decor): what she has bought + how close each set is — null with no decor. */
function houseNote() {
    const D = ctx.decor;
    if (!D || !D.summary) return null;
    const s = D.summary();
    return { s, near: s.sets.filter(x => !x.done && x.have > 0 && x.need - x.have <= 1) };
}
/** 📝 Ima's list for today (features/day) as a pinned note at the top of Messages — null when there's no list (a party, Dina). */
function imaNote() {
    const D = ctx.day;
    if (!D || !D.imaLine || D.imaLine() == null) return null;
    const list = D.list();
    if (!list.length) return null;
    const done = list.filter(x => x.done).length, next = list.find(x => !x.done);
    return { list, done, next, home: !!D.home };
}
addApp({
    id: "messages", icon: "💬", name: "Messages", order: 20, color: "#43A047", color2: "#1B5E20",
    badge: () => unread() || null,
    render(el, api, arg) {
        if (arg && arg.thread) { V.thread = keyOf(arg.thread); PH.arg = null; }
        if (V.thread && !INBOX.msgs.some(m => m.k === V.thread)) V.thread = null;
        const note = !V.thread && imaNote(), hn = !V.thread && houseNote();
        if (V.house && V.list) V.list = false;
        if (V.house && !hn) V.house = false;
        if (V.house) {
            // 🏠 what's hers + the sets (never coins: this is only a look)
            const { s, near } = hn;
            const done = s.sets.filter(x => x.done).length;
            el.innerHTML = `<div class="lp-chat-h"><span class="lp-av" style="--c:#8E24AA">🏠</span><b>My house · ${s.bought.length} things</b></div>
                <div class="lp-chat">${s.sets.map(x => `<div class="lp-bub" style="--c:${x.done ? "#43A047" : "#8E24AA"}">${x.icon} <b>${esc(x.name)}</b> ${x.done ? "✅ complete" : x.have + "/" + x.need}${!x.done && x.missing.length && x.need - x.have <= 1 ? `<small>nearly! just ${esc(x.missing.join(", "))}</small>` : ""}</div>`).join("")}
                <div class="lp-bub" style="--c:#8E24AA">${s.bought.length ? s.bought.map(b => `${b.icon} ${esc(b.name)}`).join(" · ") : "Nothing bought yet — ✋ the mailbox, the porch or the front yard (or go inside) to decorate."}</div></div>
                <button class="btn lp-row lp-mini" id="lpHouseBack">‹ All messages</button>`;
            el.querySelector("#lpHouseBack").addEventListener("click", () => { V.house = false; api.refresh(); });
            return;
        }
        if (V.list && !note) V.list = false;
        if (V.list) {
            // 📝 the list: what's done, what's next, how far
            el.innerHTML = `<div class="lp-chat-h"><span class="lp-av" style="--c:#E91E63">📝</span><b>Ima's list · ${note.done}/${note.list.length}</b></div>
                <div class="lp-chat">${note.list.map(x => `<div class="lp-bub" style="--c:${x.done ? "#43A047" : "#E91E63"}">${x.done ? "✅" : x === note.next ? "👉" : "⬜"} ${x.icon || ""} ${esc(x.text || x.id)}${x.n > 1 ? ` <small>${Math.min(x.prog, x.n)}/${x.n}</small>` : ""}</div>`).join("")}
                <div class="lp-bub" style="--c:#E91E63">${note.done >= note.list.length ? "Everything's done? Come HOME for dinner! 🍲" : note.home ? "Dinner's in the fridge 💕" : "Home for dinner! 💕"}</div></div>
                <button class="btn lp-row lp-mini" id="lpListBack">‹ All messages</button>`;
            el.querySelector("#lpListBack").addEventListener("click", () => { V.list = false; api.refresh(); });
            return;
        }
        if (!V.thread) {
            const list = threads();
            const pin = note ? `<button class="btn lp-row lp-ima" id="lpImaList"><span class="lp-av" style="--c:#E91E63">📝</span>
                <span class="lp-tx"><b>Ima's list · ${note.done}/${note.list.length}</b><small>${note.done >= note.list.length ? "All done — home for dinner! 🍲" : "Next: " + esc((note.next.icon || "") + " " + (note.next.text || note.next.id))}</small></span></button>` : "";
            const hpin = hn ? `<button class="btn lp-row lp-hse" id="lpHouse"><span class="lp-av" style="--c:#8E24AA">🏠</span>
                <span class="lp-tx"><b>My house · ${hn.s.bought.length} things</b><small>${hn.near.length ? "So close: " + esc(hn.near[0].icon + " " + hn.near[0].name) + " (" + hn.near[0].have + "/" + hn.near[0].need + ")" : hn.s.sets.filter(x => x.done).length + "/" + hn.s.sets.length + " sets complete"}</small></span></button>` : "";
            const bind = () => {
                const b = el.querySelector("#lpImaList"); if (b) b.addEventListener("click", () => { V.list = true; api.refresh(); });
                const h = el.querySelector("#lpHouse"); if (h) h.addEventListener("click", () => { V.house = true; api.refresh(); });
            };
            if (!list.length) { el.innerHTML = pin + hpin + `<p class="lp-empty">No messages yet.<br><small>The family will text. Oh, they'll text.</small></p>`; bind(); return; }
            el.innerHTML = pin + hpin + list.map(t => `<button class="btn lp-row lp-thr${t.unread ? " new" : ""}" data-k="${esc(t.k)}">
                <span class="lp-av" style="--c:${t.color}">${t.emoji}</span>
                <span class="lp-tx"><b>${esc(t.title)}</b><small>${t.group ? esc(t.last.from) + ": " : ""}${esc(t.last.msg)}</small></span>
                <span class="lp-meta">${ago(t.last.t)}${t.unread ? `<i class="lp-badge">${t.unread}</i>` : ""}</span></button>`).join("");
            el.querySelectorAll(".lp-thr").forEach(b => b.addEventListener("click", () => { V.thread = b.dataset.k; api.refresh(); }));
            bind();
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
    back() { if (V.house) { V.house = false; return refresh(), true; } if (V.list) { V.list = false; return refresh(), true; } if (V.thread) { V.thread = null; return refresh(), true; } return false; },
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
    if (r.reason === "wreck" || r.reason === "gameover" || (r.G && r.G.knockouts)) out.push(["Ima", "Are you hurt?? Call me. CALL ME. 📞"]);
    if (!out.length) out.push(pick([["Ima", "Text me when you get there 💕"], ["Bubbe", "Drive safe, mamele 😘"], ["Heshy", "👍"]]));
    // (the family knows who the mystery singer Dovid Dov is — he's Lulu's brother — and tells NOBODY. Mostly.)
    if (out.length < 3) out.push(pick([["Heshy", "lol"], ["Bubbe", "Who taught her to drive like this? 🙄"], ["Ima", "Love you! Wear a sweater 🧥"],
        ["Heshy", "ur brother's song is stuck in my head AGAIN 🎤🤫"], ["Ima", "They played your brother on the radio. I told NOBODY. (I told Bubbe.) 🤫"],
        ["Bubbe", "The whole shul asks me who is this Dovid Dov. I say nothing. I'm a VAULT 🤐"]]));
    const seen = new Set();
    return out.filter(([who]) => (seen.has(who) && out.length > 2 ? false : (seen.add(who), true))).slice(0, 3);
}
on("run:end", r => {
    if (!ctx.enabled("phone") || !r || (r.G && r.G.mode === "party") || (r.distance || 0) < 250 || r.reason === "map") return;
    for (const [who, msg] of familyLines(r)) post({ thread: "mishpacha", from: who, msg });
});
