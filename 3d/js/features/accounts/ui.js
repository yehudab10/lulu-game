// features/accounts — what she sees: the NAME CARD (first time on the title with the server up; also ⚙️ › Change my
// name) and ⚙️ › 🪪 Your name (change it · other players' names on / off · delete my online account).
// Interface text follows docs/words.md. Touch, keyboard and controller: the ideas are buttons (a young player never has
// to type), the box is a normal text field (the phone's / console's own keyboard), everything is in the card's focus list.
import { ctx, on, css, addMenuItem } from "../../core/ctx.js";
import * as H from "../../hud.js";
import { glyph } from "../../input.js";
import { showTitle } from "../../core/screens.js";
import { saveSoon } from "../../core/save.js";
import * as R from "./rules.js";
import { A, S, hello, check, ideas, setName, nextChange, needsName, deleteAccount, setHide } from "./index.js";

const QS = new URLSearchParams(location.search);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const LATER_MS = 3 * 86400000;
const U = { asked: false, open: false, seq: 0 };

css("accounts", `
.acct-card h2 { margin-bottom: 4px; }
.acct-card .acct-sub { margin: 0 0 8px; }
.acct-ideas { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 4px 0 8px; }
.acct-ideas .btn { flex: 1 1 140px; max-width: 220px; margin: 0; padding: 8px 10px; font-size: 17px; }
.acct-in { width: 100%; box-sizing: border-box; font: 700 21px var(--font); text-align: center; border-radius: 12px;
  border: 2px solid #F8BBD0; background: #fff; color: #2b1838; padding: 7px; margin: 2px 0; }
.acct-in::placeholder { color: #9e8aa8; }
.acct-in.focus, .acct-in:focus { border-color: #E91E63; box-shadow: 0 0 0 3px rgba(233,30,99,.25); outline: none; }
.acct-why { min-height: 1.3em; margin: 4px 0 2px; font-weight: 700; }
.acct-why.ok { color: #A5D6A7; } .acct-why.no { color: #FFCC80; }
.acct-card .fine { opacity: .8; margin: 2px 0 6px; }
body.tv .acct-ideas .btn { font-size: 22px; } body.tv .acct-in { font-size: 26px; }
@media (max-width: 420px) { .acct-ideas .btn { flex-basis: 100%; max-width: none; font-size: 16px; padding: 7px; } .acct-in { font-size: 19px; } }
`);

const whyText = (w, sugg) => {
    if (!w) return "";
    if (w === "taken" && sugg && sugg.length) return `Someone already has that name. Try ${sugg.slice(0, 2).join(", ")}…`;
    return R.WHY[w] || R.WHY.offline;
};
const dateOf = ms => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/**
 * The name card. opts: { first (the first-time ask on the title), replaced (the server replaced her name),
 * done(name|null) — called when it closes (a name was taken, or Later / Back) }.
 */
export function nameCard(opts = {}) {
    const seq = ++U.seq;
    U.open = true; U.first = !!opts.first;
    const cur = ctx.player.name();
    const title = opts.first || !cur ? "🪪 Pick your name" : "🪪 Change your name";
    const sub = opts.replaced ? "Other players reported your name, so it was changed. Pick a new one."
        : opts.first || !cur ? "Other players and your friends will see it." : `Right now you're <b>${esc(cur)}</b>.`;
    const close = name => { if (seq !== U.seq) return; U.open = false; (opts.done || (() => showTitle(true)))(name || null); };
    const card = H.showScreen(`<h2>${title}</h2><p class="acct-sub">${sub}</p>
        <div class="acct-ideas" id="acctIdeas"></div>
        <input class="acct-in nav" id="acctIn" maxlength="${R.MAX}" placeholder="Or type your own" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
        <p class="acct-why" id="acctWhy"></p>
        <p class="fine">🙈 Don't use your real name.</p>`,
        [{ label: "✓ Use this name", id: "acctUse", action: () => use() },
         { label: "🎲 More ideas", id: "acctMore", action: () => fill() },
         { label: opts.first ? `Later ${glyph("back")}` : `Back ${glyph("back")}`, id: "acctLater", cls: "alt", action: () => later() }],
        { onBack: () => later(), cls: "acct-card", focus: 0 });
    const box = card.querySelector("#acctIdeas"), inp = card.querySelector("#acctIn"), why = card.querySelector("#acctWhy");
    const say = (t, ok) => { why.textContent = t || ""; why.className = "acct-why" + (t ? ok ? " ok" : " no" : ""); };
    let busy = false;
    function showIdeas(list) {
        if (seq !== U.seq) return;
        box.innerHTML = list.slice(0, 3).map((n, i) => `<button class="btn nav acct-idea" id="acctIdea${i}" data-n="${esc(n)}">${esc(n)}</button>`).join("");
        box.querySelectorAll("[data-n]").forEach(b => b.addEventListener("click", () => take(b.dataset.n)));
        const f = H.screenCard().querySelector(".focus");
        if (!f || !f.isConnected) H.setFocus(box.querySelector("button") ? "acctIdea0" : "acctIn");
    }
    async function fill(baseName) {
        if (busy) return;
        say("");
        showIdeas(R.ideas(baseName || "", 3));               // something right away, swapped for checked ones
        const l = await ideas(baseName || "");
        if (seq === U.seq) showIdeas(l);
    }
    async function take(name) {
        if (busy || seq !== U.seq) return;
        busy = true; say("Checking…", true);
        const r = await setName(name);
        busy = false;
        if (seq !== U.seq) return;
        if (r.ok) { H.toast(`🪪 Hi, ${name}! That's your name now.`, "pink", { prio: 2 }); close(name); return; }
        if (r.why === "wait") { say(`${R.WHY.wait} You can change it again on ${dateOf(r.next)}.`); return; }
        say(whyText(r.why, r.sugg));
        if (r.sugg && r.sugg.length) showIdeas(r.sugg);
    }
    function use() {
        const v = inp.value.trim();
        if (!v) { say("Type a name, or tap one of the ideas."); H.setFocus("acctIn"); return; }
        take(v);
    }
    function later() {
        if (opts.first) { S.later = Date.now(); saveSoon(); }
        close(null);
    }
    // typing: instant rules here, then the server (taken?) a moment after she stops
    let tm = 0;
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); use(); } if (e.key === "Escape") inp.blur(); });
    inp.addEventListener("click", () => inp.focus());
    inp.addEventListener("input", () => {
        clearTimeout(tm);
        const v = inp.value.trim();
        if (!v) { say(""); return; }
        const local = R.check(v);
        if (local) { say(R.WHY[local]); return; }
        say("");
        tm = setTimeout(async () => {
            const r = await check(v);
            if (seq !== U.seq || inp.value.trim() !== v) return;
            if (r.ok) say("✓ That one's free!", true);
            else { say(whyText(r.why, r.sugg)); if (r.sugg && r.sugg.length) showIdeas(r.sugg); }
        }, 350);
    });
    fill();
    return card;
}

// ── the first-time ask: on the title, once the server is up, never in a test unless it asks (&acctname=1) ──
async function maybeAsk() {
    if (U.asked || U.open) return;
    if (ctx.TEST && !QS.get("acctname")) return;
    await hello();
    if (U.asked || U.open || ctx.state !== "title" || !needsName()) return;
    const replaced = !!(A.view && A.view.me.ask);
    if (!replaced && Date.now() - (S.later || 0) < LATER_MS) return;
    if (!document.querySelector("#screenCard [data-title-seq]")) return;   // (only over the title's own card, never another screen)
    U.asked = true;
    nameCard({ first: true, replaced, done: () => { if (ctx.state === "title") showTitle(true); } });
}
on("title", () => { setTimeout(maybeAsk, ctx.TEST ? 100 : 600); });
// the first-time card belongs to the title: if a run starts underneath it (a link, a test), it goes away — asked later
on("state", e => { if (U.open && U.first && e && e.to !== "title") { U.seq++; U.open = false; U.asked = false; if (H.screenOpen() && document.getElementById("acctIdeas")) H.hideScreen(); } });
on("accounts:view", () => { if (ctx.state === "title" && !U.asked) setTimeout(maybeAsk, 50); });

// ── ⚙️ › 🪪 Your name ──
export function accountCard(back) {
    const name = ctx.player.name(), nx = nextChange(), wait = nx > Date.now();
    const again = () => accountCard(back);
    const rows = [];
    if (S.off) {
        rows.push({ label: "🪪 Pick a name", id: "acctPick", action: () => nameCard({ done: again }) });
    } else {
        rows.push({ label: name ? `✏️ Change my name${wait ? ` <small>Again on ${dateOf(nx)}</small>` : ""}` : "🪪 Pick a name", id: "acctPick", action: () => {
            if (wait) { H.toast(`${R.WHY.wait} You can change it again on ${dateOf(nx)}.`, "", { prio: 2 }); return; }
            if (!A.on) { H.toast(R.WHY.offline, "", { prio: 2 }); return; }
            nameCard({ done: again });
        } });
    }
    rows.push({ label: `👀 Other players' names <b>${S.hide ? "Off" : "On"}</b>`, id: "acctHide", action: () => { setHide(!S.hide); accountCard(back); } });
    if (ctx.meta && ctx.meta.openTransfer) rows.push({ label: "📲 Move to another phone", id: "acctMove", action: () => ctx.meta.openTransfer(again) });
    if (!S.off && (name || A.on)) rows.push({ label: "🗑️ Delete my online account", id: "acctDel", action: () => deleteCard(back) });
    rows.push({ label: `Back ${glyph("back")}`, id: "acctBack", cls: "alt", action: () => back() });
    const sub = S.off ? "You deleted your online account. Pick a name to make a new one."
        : name ? `Other players see you as <b>${esc(name)}</b>.` : A.on ? "You don't have a name yet." : "You don't have a name yet. You can pick one when you're online.";
    return H.showScreen(`<h2>🪪 Your name</h2><p>${sub}</p><p class="fine">${S.hide ? "Other players show as a colour and a number." : "Names are checked, and you can report one from a player's page."}</p>`,
        rows, { onBack: () => back(), cls: "acct-card" });
}
function deleteCard(back) {
    H.showScreen(`<h2>🗑️ Delete your online account?</h2><p>Your name, your friends list and your friend requests are deleted from the game's server.</p><p class="fine">Your coins, cars, homes and progress stay on this device.</p>`,
        [{ label: "🗑️ Yes, delete it", id: "acctDelYes", action: async () => {
            const ok = await deleteAccount();
            H.toast(ok ? "🗑️ Your online account is deleted." : R.WHY.offline, "", { prio: 2 });
            accountCard(back);
        } },
         { label: `Keep it ${glyph("back")}`, id: "acctDelNo", cls: "alt", action: () => accountCard(back) }],
        { onBack: () => accountCard(back), cls: "acct-card", focus: 1 });
}
addMenuItem("settings", {
    id: "account", order: 57,
    visible: () => A.on || !!ctx.player.name() || !!S.off,
    label: () => `🪪 Your name <b>${esc(ctx.player.name() || (S.off ? "Off" : "None yet"))}</b>`,
    action: (b, back) => { setTimeout(() => accountCard(back || (() => H.hideScreen())), 0); return "card"; },
});
