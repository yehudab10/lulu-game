// features/friends — what you see: the 👯 FRIENDS app (outside a party's Free Roam; inside one, openworld's 👯 app
// has a "My friends" row that opens the same views), 📍 Nearby's driver view (➕ ask a driver out in the world), the
// rows in a party friend's page, ONE quiet chip ("🙋 Kugel Kid #37 wants to join you"), and two ⚙️ Settings lines.
// Phone views are plain rows (D-pad + ✕/○, keyboard, touch). Nothing here pops up for a stranger: their ask shows
// only as a line on their row in 📍 Nearby.
import { ctx, on, css, hook } from "../../core/ctx.js";
import * as H from "../../hud.js";
import * as ST from "./store.js";
import * as HS from "./handshake.js";
import * as BL from "./bell.js";
import * as VOTE from "./vote.js";
import * as MIS from "./missions.js";
import * as SV from "./server.js";
import { roomPath } from "../multiplayer/net.js";

let X = null;                                   // index.js's code / join helpers
const V = { api: null, app: "friends", arg: null, lastCheck: -1e9, wait: "" };
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const row = (id, av, title, sub, meta = "", data = "", dis = false) =>
    `<button class="btn lp-row" id="${id}"${data}${dis ? " disabled" : ""}><span class="lp-av">${av}</span><span class="lp-tx"><b>${title}</b><small>${sub}</small></span>${meta ? `<span class="lp-meta">${meta}</span>` : ""}</button>`;
const onc = (el, sel, fn) => el.querySelectorAll(sel).forEach(b => b.addEventListener("click", () => fn(b)));
const JOIN_TXT = { always: "Always", ask: "Ask me", nobody: "Nobody" };
const WHO_TXT = { everyone: "Everyone", fof: "Friends of friends", nobody: "Nobody" };
const WHO_SUB = { everyone: "Anyone who knows your name can ask", fof: "Only people who share a friend with you", nobody: "No one can send you a request" };
const ASK_TXT = { sent: "Sent! They'll see it next time they play.", friends: "You're friends now!", none: "No one has that name. Check the spelling.",
    self: "That's you!", closed: "They aren't taking friend requests.", full: "Your friends list is full.", outfull: "You've asked a lot of people. Wait for some answers first.",
    busy: "They can't take more requests right now.", slow: "That's a lot of requests. Try again later.", offline: "Can't send right now. Try again in a bit." };
const JOIN_SUB = { always: "Friends can join you any time", ask: "You get a little note and say yes or no", nobody: "No one can join. Friends still see you're playing." };
const partyRoam = () => !!(ctx.party && ctx.party.active && ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());

css("friends", `
.fr-code { font: 700 34px/1.1 var(--font); letter-spacing: .18em; text-align: center; padding: 6px 0 2px; color: #FFE082; }
.fr-in { width: 100%; box-sizing: border-box; font: 700 22px var(--font); letter-spacing: .14em; text-transform: uppercase; text-align: center;
  border-radius: 12px; border: 2px solid rgba(255,255,255,.35); background: rgba(0,0,0,.25); color: #fff; padding: 6px; margin: 4px 0; }
.lp-row .fr-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
.lp-row.fr-off { opacity: .62; }
#frChip { display: none; align-items: center; gap: 8px; margin: 4px auto 0; width: max-content; max-width: min(92vw, 560px); border-radius: 999px;
  padding: 5px 14px; font: 700 14px var(--font); color: #fff; background: rgba(123,31,162,.9); box-shadow: 0 0 0 2px #CE93D8, 0 3px 8px rgba(0,0,0,.22);
  pointer-events: auto; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
body.tv #frChip { font-size: 20px; padding: 7px 18px; }
@media (max-width: 600px) { #frChip { font-size: 12.5px; padding: 4px 11px; } }
`);

// ── the 👯 app ────────────────────────────────────────────────────────────
function render(el, api, arg, app) {
    V.api = api; V.app = app || "friends"; V.arg = arg || null;
    const a = arg || {};
    if (a.code) return codeView(el, api);
    if (a.add) return addView(el, api);
    if (a.req) return reqView(el, api, a.req);
    if (a.pick) return pickView(el, api);
    if (a.friend) return friendView(el, api, a.friend);
    if (a.blocked) return blockedView(el, api);
    if (a.edit) return editView(el, api);
    home(el, api);
}
const go = (api, arg) => api.open(V.app, V.app === "friends" ? arg : { fl: arg || {} });
const dot = sk => `<i class="fr-dot" style="background:${skinHex(sk)}"></i>`;
function skinHex(sk) { const S = ctx.skins || null; const s = S && S[sk]; return (s && (s.hex || s.color)) || "#EC407A"; }

function home(el, api) {
    const L = ST.S.list, live = X.live();
    if (live && Date.now() - V.lastCheck > 20000 && L.length) { V.lastCheck = Date.now(); BL.checkAll(); }
    const on = L.filter(f => (BL.seen.get(f.f) || {}).on), off = L.filter(f => !(BL.seen.get(f.f) || {}).on);
    let html = `<div class="lp-card ow-head"><span class="lp-av">👯</span><span class="lp-tx"><b>Friends</b><small>${L.length ? `${on.length} of ${L.length} playing now${BL.checkingNow() ? " (checking…)" : ""}` : "No friends yet. Add one below."}${ST.S.hidden ? " · 🙈 you appear offline" : ""}</small></span></div>`;
    if (!live) html += `<p class="lp-note">${ctx.friends && !ctx.friends.ok ? "Friends need a secure connection." : "Friends need an internet connection."}</p>`;
    if (V.wait) html += `<p class="lp-note">⏳ ${esc(V.wait)}</p>`;
    for (const q of BL.joinAsks()) {
        const f = ST.friend(q.f); if (!f) continue;
        html += row("frJy_" + f.f, "🙋", `${esc(ST.labelOf(f))} wants to join you`, "They'll show up next to you.", "✓", ` data-jy="${f.f}"`);
        html += row("frJn_" + f.f, "✋", "Not right now", "They'll get a friendly no.", "", ` data-jn="${f.f}"`);
    }
    // (ci/accounts) requests that waited for her on the server — no pop-up, just this list + the badge on 👯
    const RQ = SV.requests(), inReq = RQ.inReq.filter(r => !ST.isBlocked(r.f));
    if (inReq.length) html += `<div class="ow-sec">Friend requests</div>`;
    for (const r of inReq) html += row("frRq_" + r.f, "🙋", `${esc(r.n || "A player")} wants to be friends`, "Tap to say yes or no", "", ` data-rq="${r.f}"`);
    if (on.length) html += `<div class="ow-sec">Playing now</div>`;
    for (const f of on) {
        const s = BL.seen.get(f.f) || {};
        const can = s.j !== "nobody" && !together(f.f);
        html += row("frF_" + f.f, esc(s.i || "🚗"), dot(f.sk) + esc(ST.labelOf(f)), esc(s.w || "playing"), together(f.f) ? "with you" : can ? "▶ Join" : "", ` data-join="${f.f}"`);
    }
    if (off.length) html += `<div class="ow-sec">Not playing</div>`;
    for (const f of off) html += row("frF_" + f.f, "💤", dot(f.sk) + esc(ST.labelOf(f)), "not playing right now", "", ` data-fv="${f.f}"`).replace("lp-row", "lp-row fr-off");
    html += `<div class="ow-sec">Add a friend</div>`;
    const myName = ctx.player && ctx.player.name ? ctx.player.name() : null;
    if (SV.serverOn()) html += myName ? row("frAdd", "➕", "Add a friend by name", `Your name is ${esc(myName)}. Tell your friends!`)
        : row("frPick", "🪪", "Pick your name", "Then friends can find you by name");
    html += row("frCode", "➕", "Add by code", "Show your code, or type a friend's", "", "", !live);
    if (nearbyOn()) html += row("frNear", "📍", "Players near you", "Tap one to ask them to be friends");      // (ci/hud: 📍 Nearby lives here now, not on the home screen)
    for (const r of RQ.outReq) html += row("frOq_" + r.f, "⏳", `Asked ${esc(r.n || "a player")}`, "Waiting for them to say yes. Tap to cancel.", "", ` data-oq="${r.f}"`);
    html += `<div class="ow-sec">Settings</div>`;
    html += row("frJoinSet", "🚪", `Who can join me: ${JOIN_TXT[ST.S.join]}`, JOIN_SUB[ST.S.join]);
    if (SV.serverOn()) html += row("frWho", "📨", `Friend requests from: ${WHO_TXT[SV.who()]}`, WHO_SUB[SV.who()]);
    html += row("frHide", "🙈", `Appear offline: ${ST.S.hidden ? "ON" : "OFF"}`, ST.S.hidden ? "Friends see you as not playing" : "Friends can see you're playing, and roughly where");
    if (L.length) html += row("frEdit", "✏️", "Remove or block a friend", `${L.length} of ${ST.CAP} friends`);
    if (ST.S.blocked.length) html += row("frBlocked", "🚫", `Blocked players (${ST.S.blocked.length})`, "Tap to unblock");
    html += `<p class="lp-fine">To add someone you meet, tap them in Nearby. You both have to say yes. Only friends can see you're playing or join you.</p>`;
    el.innerHTML = html;
    onc(el, "#frNear", () => api.open("nearby"));
    onc(el, "[data-join]", b => joinTap(api, b.dataset.join));
    onc(el, "[data-fv]", b => go(api, { friend: b.dataset.fv }));
    onc(el, "[data-jy]", b => { BL.answerJoin(b.dataset.jy, true); api.close(); });
    onc(el, "[data-jn]", b => { BL.answerJoin(b.dataset.jn, false); api.refresh(); });
    onc(el, "#frCode", () => go(api, { code: 1 }));
    onc(el, "#frAdd", () => go(api, { add: 1 }));
    onc(el, "#frPick", () => go(api, { pick: 1 }));
    onc(el, "[data-rq]", b => go(api, { req: b.dataset.rq }));
    onc(el, "[data-oq]", async b => { await SV.cancel(b.dataset.oq); api.refresh(); });
    onc(el, "#frWho", async () => { await SV.setWho(SV.WHO[(SV.WHO.indexOf(SV.who()) + 1) % 3]); api.refresh(); });
    onc(el, "#frJoinSet", () => { ST.setJoin(ST.JOIN[(ST.JOIN.indexOf(ST.S.join) + 1) % 3]); api.refresh(); });
    onc(el, "#frHide", () => { ST.setHidden(!ST.S.hidden); api.refresh(); });
    onc(el, "#frEdit", () => go(api, { edit: 1 }));
    onc(el, "#frBlocked", () => go(api, { blocked: 1 }));
}
/** Already in the same party as that friend? */
function together(fid) { const P = ctx.party; return !!(P && P.active && P.players.some(p => !p.me && (P.peer(p.uid) || {}).x && P.peer(p.uid).x.fid === fid)); }
async function joinTap(api, fid) {
    const f = ST.friend(fid); if (!f) return;
    if (together(fid)) { api.close(); const P = ctx.party, p = P.players.find(q => !q.me && (P.peer(q.uid) || {}).x && P.peer(q.uid).x.fid === fid); if (p && ctx.openworld && ctx.openworld.warpTo) ctx.openworld.warpTo(p.uid); return; }
    V.wait = `Knocking at ${ST.labelOf(f)}'s door…`; api.refresh();
    const msg = await X.join(fid, () => { V.wait = `Waiting for ${ST.labelOf(f)} to say yes…`; refresh(); });
    V.wait = "";
    if (/^🚀/.test(msg)) { if (ctx.phone && ctx.phone.isOpen) ctx.phone.closePhone(); H.toast(msg, "pink", { prio: 2 }); return; }
    if (ctx.phone && ctx.phone.isOpen) { refresh(); if (msg && V.api) V.api.toast(msg); }
    else if (msg) H.toast(msg, "", { prio: 2 });
}

// ── (ci/accounts) ➕ add by name · a request · pick a name ─────────────
function addView(el, api) {
    const me = ctx.player.name();
    let html = `<div class="lp-card"><span class="lp-tx"><b>Add a friend by name</b><small>Type their name. They say yes next time they play.</small></span></div>`;
    html += `<input class="fr-in nav" id="frName" maxlength="16" placeholder="Their name" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="text-transform:none;letter-spacing:.04em">`;
    html += row("frSendName", "📨", "Send a friend request", me ? `Your name is ${esc(me)}` : "");
    if (V.addMsg) html += `<p class="lp-note" id="frAddMsg">${esc(V.addMsg)}</p>`;
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    const inp = el.querySelector("#frName");
    if (V.addVal) inp.value = V.addVal;
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") send(); if (e.key === "Escape") inp.blur(); });
    inp.addEventListener("click", () => inp.focus());
    const send = async () => {
        const v = inp.value.trim(); V.addVal = v;
        if (!v) { V.addMsg = "Type their name first."; api.refresh(); return; }
        V.addMsg = "Sending…"; api.refresh();
        const r = await SV.ask({ to: v });
        V.addMsg = ASK_TXT[r] || ASK_TXT.offline;
        if (r === "sent" || r === "friends") V.addVal = "";
        refresh();
    };
    onc(el, "#frSendName", send);
    onc(el, "#frBack", () => { V.addMsg = ""; V.addVal = ""; go(api, null); });
}
function reqView(el, api, fid) {
    const r = SV.requests().inReq.find(x => x.f === fid);
    if (!r) { home(el, api); return; }
    let html = `<div class="lp-card ow-head"><span class="lp-av">🙋</span><span class="lp-tx"><b>${esc(r.n || "A player")}</b><small>wants to be friends</small></span></div>`;
    html += row("frRy", "🤝", "Be friends", "You can see when each other is playing, and join", "✓");
    html += row("frRn", "✋", "No thanks", "They won't be told");
    html += row("frRb", "🚫", "Block", "They can't ask you again");
    if (r.n) html += row("frRr", "🚩", "Report this name", "If it's rude or mean");
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    onc(el, "#frRy", async () => { const w = await SV.answer(fid, true); api.toast(w === "friends" ? `🤝 You and ${r.n || "they"} are friends!` : ASK_TXT[w] || ASK_TXT.offline); go(api, null); });
    onc(el, "#frRn", async () => { await SV.answer(fid, false); go(api, null); });
    onc(el, "#frRb", async () => { await SV.answer(fid, false); ctx.friends.block(fid, ""); go(api, null); });
    onc(el, "#frRr", async () => { await ctx.accounts.report({ f: fid }); await SV.answer(fid, false); api.toast("🚩 Thanks for telling us."); go(api, null); });
    onc(el, "#frBack", () => go(api, null));
}
function pickView(el, api) {
    const A = ctx.accounts;
    let html = `<div class="lp-card"><span class="lp-tx"><b>Pick your name</b><small>Other players and your friends will see it. Don't use your real name.</small></span></div>`;
    for (const [i, n] of (V.ideas || []).entries()) html += row("frIdea" + i, "✨", esc(n), "Tap to take this name", "", ` data-idea="${esc(n)}"`);
    html += `<input class="fr-in nav" id="frMyName" maxlength="16" placeholder="Or type your own" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" style="text-transform:none;letter-spacing:.04em">`;
    html += row("frTake", "✓", "Use this name", "");
    if (V.pickMsg) html += `<p class="lp-note">${esc(V.pickMsg)}</p>`;
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    if (!V.ideas) A.ideas("").then(l => { V.ideas = l; refresh(); });
    const inp = el.querySelector("#frMyName");
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") take(inp.value.trim()); if (e.key === "Escape") inp.blur(); });
    inp.addEventListener("click", () => inp.focus());
    const take = async n => {
        if (!n) { V.pickMsg = "Type a name, or tap one of the ideas."; api.refresh(); return; }
        const r = await A.setName(n);
        if (r.ok) { V.pickMsg = ""; V.ideas = null; api.toast(`🪪 Hi, ${n}!`); go(api, null); return; }
        V.pickMsg = r.why === "taken" && r.sugg && r.sugg.length ? `Someone already has that name. Try ${r.sugg.slice(0, 2).join(", ")}…` : (A.rules.WHY[r.why] || A.rules.WHY.offline);
        if (r.sugg && r.sugg.length) V.ideas = r.sugg.slice(0, 3);
        refresh();
    };
    onc(el, "[data-idea]", b => take(b.dataset.idea));
    onc(el, "#frTake", () => take(inp.value.trim()));
    onc(el, "#frBack", () => { V.pickMsg = ""; go(api, null); });
}

function codeView(el, api) {
    const code = X.showCode();
    let html = `<div class="lp-card"><span class="lp-tx"><b>Your friend code</b><small>It works while this screen is open. A friend types it or opens your link, then you say yes.</small></span></div>`;
    html += code ? `<div class="fr-code">${esc(code)}</div>` : `<p class="lp-note">Friends need an internet connection.</p>`;
    if (code) html += row("frShare", "📤", "Share my link", "When they tap it, their ask shows up here");
    for (const q of HS.incoming("code")) {
        html += row("frCy_" + esc(q.peer), "🤝", "Someone used your code", "Say yes to be friends", "✓", ` data-cy="${esc(q.peer)}"`);
        html += row("frCn_" + esc(q.peer), "✋", "No thanks", "", "", ` data-cn="${esc(q.peer)}"`);
    }
    html += `<div class="ow-sec">A friend's code</div><input class="fr-in nav" id="frIn" maxlength="6" placeholder="ABC123" autocomplete="off" autocapitalize="characters" spellcheck="false">`;
    html += row("frSend", "🤝", "Ask to be friends", "They say yes on their screen");
    el.innerHTML = html;
    const inp = el.querySelector("#frIn");
    inp.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Enter") send(); if (e.key === "Escape") inp.blur(); });
    const send = async () => {
        const r = await X.useCode(inp.value);
        api.toast(r === "asked" ? "🤝 Asked! They say yes on their screen." : r === "full" ? `Your list is full (${ST.CAP})` : r === "bad" ? "That isn't a friend code" : r === "offline" ? "You're offline" : "That code isn't open right now");
    };
    onc(el, "#frSend", send);
    onc(el, "#frShare", async () => api.toast(await share(code)));
    onc(el, "[data-cy]", async b => {
        const r = await HS.accept("code", b.dataset.cy);
        if (r === "full") api.toast(`Your list is full (${ST.CAP})`);
        else if (r === "expired" || r == null) api.toast("That request expired. Ask your friend to send it again.");
        else if (r === "accepted") api.toast("Connecting…");
        api.refresh();
    });
    onc(el, "[data-cn]", b => { HS.decline("code", b.dataset.cn); api.refresh(); });
}
async function share(code) {
    const url = X.codeLink(code), text = `Be my friend in Lulu's Road Trip! Code ${code}`;
    try { if (navigator.share && !ctx.TEST) { await navigator.share({ title: "Lulu's Road Trip", text, url }); return "📤 Shared"; } } catch (e) { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); return "📋 Link copied"; } catch (e) { return `Your code: ${code}`; }
}

function friendView(el, api, fid) {
    const f = ST.friend(fid);
    if (!f) { home(el, api); return; }
    const s = BL.seen.get(fid) || {};
    let html = `<div class="lp-card ow-head"><span class="lp-av">${s.on ? esc(s.i || "🚗") : "💤"}</span><span class="lp-tx"><b>${dot(f.sk)}${esc(ST.labelOf(f))}</b><small>${s.on ? esc(s.w || "playing") : "not playing right now"} · friends since ${new Date(f.at || Date.now()).toLocaleDateString()}</small></span></div>`;
    if (s.on && s.j !== "nobody") html += row("frJ", "▶", together(fid) ? `Warp to ${esc(f.n)}` : `Join ${esc(f.n)}`, "Show up right next to them");
    html += row("frRm", "👋", "Remove friend", "You can add each other again later");
    html += row("frBl", "🚫", "Block", "Removes them, and hides their asks for good");
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    onc(el, "#frJ", () => joinTap(api, fid));
    onc(el, "#frRm", () => { ctx.friends.remove(fid); go(api, null); });
    onc(el, "#frBl", () => { ctx.friends.block(fid, f.n); go(api, null); });
    onc(el, "#frBack", () => go(api, null));
}
function editView(el, api) {
    let html = `<p class="lp-note">Pick a friend to remove or block.</p>`;
    for (const f of ST.S.list) html += row("frE_" + f.f, "👤", dot(f.sk) + esc(ST.labelOf(f)), (BL.seen.get(f.f) || {}).on ? "playing now" : "not playing", "", ` data-fv="${f.f}"`);
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    onc(el, "[data-fv]", b => go(api, { friend: b.dataset.fv }));
    onc(el, "#frBack", () => go(api, null));
}
function blockedView(el, api) {
    let html = `<p class="lp-note">Blocked players can't ask you again. Unblocking doesn't make you friends.</p>`;
    for (const b of ST.S.blocked) html += row("frU_" + b.f, "🚫", esc(b.n ? ST.labelOf(b) : "A player"), "Tap to unblock", "", ` data-ub="${b.f}"`);
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    onc(el, "[data-ub]", b => { ctx.friends.unblock(b.dataset.ub); api.refresh(); });
    onc(el, "#frBack", () => go(api, null));
}

const nearbyOn = () => { try { return !!(ctx.phone && ctx.phone._dbg && ctx.phone._dbg.APPS.some(a => a.id === "nearby" && (!a.visible || a.visible()))); } catch (e) { return false; } };
// ── 📍 Nearby: a driver out in the world ──────────────────────────────────
/** A line for a driver's row in 📍 Nearby ("" = nothing). */
export function driverNote(peerId) {
    if (!X || !X.live()) return "";
    if (HS.incoming("mp").some(q => q.peer === peerId)) return "🤝 wants to be friends";
    const o = HS.outgoing("mp", peerId);
    return o === "ask" ? "➕ asked" : o === "done" ? "🤝 friends!" : "";
}
/** The driver's page: ➕ ask / ✓ accept / ✗ no thanks. */
export function driverView(el, api, peerId, name, back) {
    const inc = HS.incoming("mp").some(q => q.peer === peerId), out = HS.outgoing("mp", peerId);
    // 🚩 (features/accounts) only for a name the server vouched for — a colour + number has nothing to report
    const gp = ctx.mp && ctx.mp._debug && ctx.mp._debug.peers ? ctx.mp._debug.peers[peerId] : null;
    const rep = gp && gp.un && ctx.accounts && ctx.accounts.ghostName(roomPath(), peerId, gp.un, { always: true }) ? { t: gp.un, room: roomPath(), rid: peerId } : null;

    let html = `<div class="lp-card ow-head"><span class="lp-av">👻</span><span class="lp-tx"><b>${esc(name)}</b><small>Another player out in the world</small></span></div>`;
    if (!X.live()) html += `<p class="lp-note">Friends need an internet connection.</p>`;
    else if (out === "done") html += `<p class="lp-note">🤝 You're friends! They're in 👯 Friends now.</p>`;
    else if (inc) html += row("frDy", "🤝", "Be friends", "They asked you. Say yes and you're friends.", "✓") + row("frDn", "✋", "No thanks", "They won't be told");
    else if (out) html += `<p class="lp-note">➕ Asked! When they say yes, you're friends.</p>`;
    else if (V.sent && V.sent[peerId]) html += `<p class="lp-note">📨 ${esc(V.sent[peerId])}</p>`;
    else html += row("frDa", "➕", "Ask to be friends", ST.full() ? `Your list is full (${ST.CAP})` : "They'll see it next to your name in their Nearby", "", "", ST.full());
    if (rep) html += row("frRep", "🚩", "Report this name", "If it's rude or mean. You won't see it again.");
    html += row("frBack", "‹", "Back", "");
    el.innerHTML = html;
    onc(el, "#frRep", async () => { await ctx.accounts.report(rep); api.toast("🚩 Thanks for telling us."); back(); });
    onc(el, "#frDa", async () => {
        // (ci/accounts) a driver with a name the server vouched for: a request on the server — it waits if they drive off
        if (rep && SV.serverOn() && ctx.player.name()) { const w = await SV.ask({ t: rep.t, room: rep.room, rid: rep.rid }); (V.sent = V.sent || {})[peerId] = ASK_TXT[w] || ASK_TXT.offline; api.refresh(); return; }
        await HS.ask("mp", peerId); api.refresh();
    });
    onc(el, "#frDy", async () => { await HS.accept("mp", peerId); api.refresh(); });
    onc(el, "#frDn", () => { HS.decline("mp", peerId); back(); });
    onc(el, "#frBack", () => back());
}
// ── a party friend's page (openworld's 👯): ➕ / ✓ / ⭐ ─────────────────────
export function partyRow(uid) {
    if (!X || !X.live()) return "";
    const P = ctx.party, q = P && P.peer(uid), fid = q && q.x && q.x.fid;
    if (fid && ST.friend(fid)) return row("frPx", "⭐", "On your friends list", "They stay in Friends after today, too", "", "", true);
    if (HS.incoming("party").some(a => a.peer === uid)) return row("frPy", "🤝", "Be friends", "They asked you", "✓", ` data-fpy="${esc(uid)}"`);
    const o = HS.outgoing("party", uid);
    if (o === "ask") return row("frPa", "➕", "Asked to be friends", "Waiting for them to say yes", "", "", true);
    return row("frPa", "➕", "Add as a friend", ST.full() ? `Your list is full (${ST.CAP})` : "You both say yes, then you can join each other any time", "", ` data-fpa="${esc(uid)}"`, ST.full());
}
export function wirePartyRow(el, api) {
    onc(el, "[data-fpa]", async b => { await HS.ask("party", b.dataset.fpa); api.refresh(); });
    onc(el, "[data-fpy]", async b => { await HS.accept("party", b.dataset.fpy); api.refresh(); });
}

// ── 👯 › Games: the old lobby games as a vote (everyone says yes) ─────────
export function missionRows() {
    const o = MIS.offerNow();
    let h = "";
    if (o) {
        const who = ctx.party.players.find(m => m.uid === o.by);
        h += `<div class="lp-card"><span class="lp-av">${o.def.icon}</span><span class="lp-tx"><b>${esc(o.def.title)} · ${o.ins.length} in</b><small>${esc(who ? who.name : "A friend")} offered it · ${o.left} s · ${esc(o.def.blurb || "")}</small></span></div>`;
        if (!o.iAmIn) h += row("msJoin", "✅", "Join in", "Play it together");
        if (o.mine && o.ins.length >= 2) h += row("msGo", "▶", "Go now", `${o.ins.length} playing`);
        if (o.mine) h += row("msOff", "✖", "Call it off", "Nobody minds");
        return `<div class="ow-sec">Missions</div>` + h;
    }
    const L = MIS.list();
    if (!L.length) return "";
    return `<div class="ow-sec">Missions</div>` + L.map(d => row("msO_" + d.id.replace(/[^a-z0-9]/g, "_"), d.icon, esc(d.title), esc(d.blurb || "Friends can join in"), "Offer", ` data-ms="${esc(d.id)}"`)).join("");
}
export function wireMissions(el, api) {
    onc(el, "[data-ms]", b => { const why = MIS.offer(b.dataset.ms); if (why) api.toast(why); else api.refresh(); });
    onc(el, "#msJoin", () => { MIS.joinOffer(); api.refresh(); });
    onc(el, "#msGo", () => { MIS.goNow(); api.close(); });
    onc(el, "#msOff", () => { MIS.callOffOffer(); api.refresh(); });
}
on("group:offer", () => refresh());
export function voteRows() {
    const v = VOTE.current();
    if (v) {
        const G = VOTE.LOBBY[v.k], who = ctx.party.players.find(m => m.uid === v.by);
        let h = `<div class="lp-card"><span class="lp-av">${G.emoji}</span><span class="lp-tx"><b>${esc(G.name)}? ${v.yes.length} of ${v.need} in</b><small>${esc(who ? who.name : "A friend")} asked. It starts when everyone's in (${v.left} s left).</small></span></div>`;
        if (!v.iAmIn) h += row("grYes", "✅", `I'm in`, `Play ${esc(G.name)} with everyone, then carry on`);
        if (v.mine) h += row("grOff", "✖", "Call it off", "Nobody minds");
        return h;
    }
    return Object.entries(VOTE.LOBBY).map(([k, G]) => row("grV_" + k, G.emoji, esc(G.name) + " (everyone)", esc(G.blurb) + ". Starts when every friend says yes.", "Ask", ` data-gv="${k}"`)).join("");
}
export function wireVote(el, api) {
    onc(el, "[data-gv]", b => { const why = VOTE.propose(b.dataset.gv); if (why) api.toast(why); else api.refresh(); });
    onc(el, "#grYes", () => { VOTE.voteYes(); api.refresh(); });
    onc(el, "#grOff", () => { VOTE.callOff(); api.refresh(); });
}
on("group:vote", () => refresh());

// ── the one quiet chip: a friend waiting to join me (or, in a party, asking to be friends) ──
let chipEl = null, chipKey = "";
function chipTick() {
    const asks = BL.joinAsks(), pAsk = HS.incoming("party")[0];
    let html = "", tap = null;
    if (asks.length) { const f = ST.friend(asks[0].f); if (f) { html = `🙋 ${esc(ST.labelOf(f))} wants to join you (📱 Friends)`; tap = "join"; } }
    else if (pAsk) { const p = ctx.party && ctx.party.players.find(x => x.uid === pAsk.peer); html = `🤝 ${esc(p ? p.name : "A friend")} wants to be friends (📱 Friends)`; tap = "party"; }
    else if (VOTE.chipLine()) { html = esc(VOTE.chipLine()); tap = "party"; }               // (stage 2: a lobby game vote)
    else if (MIS.chipLine()) { html = esc(MIS.chipLine()); tap = "party"; }                 // (stage 2: a mission to join)
    else if (ctx.group && ctx.group.away) { html = esc(ctx.group.away); tap = "party"; }      // (stage 2: friends went another way)
    if (H.popupsBlocked() || (ctx.phone && ctx.phone.isOpen)) html = "";
    if (html === chipKey) return;
    chipKey = html;
    if (!chipEl) {
        chipEl = document.createElement("div"); chipEl.id = "frChip";
        chipEl.addEventListener("click", () => openApp(chipEl.dataset.tap === "party" ? { party: 1 } : null));
        H.hudSlot("center").appendChild(chipEl);
        H.objective(chipEl, { prio: H.OBJ.mission + 5, id: "friendask" });      // (ci/hud: a friend waiting for her answer outranks a mission / Ima's list)
    }
    chipEl.dataset.tap = tap || "";
    chipEl.innerHTML = html;
    chipEl.style.display = html ? "flex" : "none";
}
/** Open the friends views on the phone (the 👯 app, or in a party's Free Roam openworld's 👯 at "My friends"). */
export function openApp(arg) {
    if (!ctx.phone || !ctx.phone.openPhone) return;
    if (partyRoam()) ctx.phone.openPhone("owparty", arg && arg.party ? null : { fl: arg || {} });
    else ctx.phone.openPhone("friends", arg);
}
export function refresh() {
    chipKey = "\u0000";
    try { if (ctx.phone && ctx.phone.isOpen && V.api && ctx.phone._dbg && ctx.phone._dbg.PH.app && /^(friends|owparty|nearby)$/.test(ctx.phone._dbg.PH.app.id)) V.api.refresh(); } catch (e) { /* closed */ }
}

export function install(helpers) {
    X = helpers;
    const tryAdd = () => {
        if (!ctx.phone || !ctx.phone.addApp) return false;
        ctx.phone.addApp({
            // (order 5: first — a multiplayer game; ci/hud landing 3)
            id: "friends", icon: "👯", name: "Friends", order: 5, color: "#7E57C2", color2: "#E91E63",
            visible: () => !partyRoam(),
            badge: () => (BL.joinAsks().length || HS.incoming("party").length ? "!" : SV.badge() ? String(SV.badge()) : null),
            render(el, api, arg) { render(el, api, arg, "friends"); },
            back(api) { if (V.arg) { if (V.arg.code) X.closeCode(); V.arg = null; api.open("friends", null); return true; } return false; },
        });
        return true;
    };
    if (!tryAdd()) on("boot", tryAdd);
    for (const ev of ["friends:presence", "friends:checked", "friends:asks", "friends:joinAsk", "friends:server"]) on(ev, refresh);
    // opening 👯 asks the server what's new (requests that waited) — at most every 20 s
    on("phone:app", e => { if (e && (e.app === "friends" || e.app === "owparty") && ctx.accounts) ctx.accounts.hello(); });
    on("phone:close", () => { if (X.C.mine) X.closeCode(); });              // (a code lives only while its screen is up)
    on("phone:app", e => { if (e && e.app !== "friends" && !(e.app === "owparty" && V.app === "owparty")) { if (X.C.mine) X.closeCode(); } });
    setInterval(() => { try { chipTick(); } catch (e) { /* hud not ready */ } }, 400);
    hook("update", () => {
        // my random friend id in my party snapshot (members see who's already a friend)
        if (ctx.party && ctx.party.active && ctx.party.setX && !V.fidSet) { ctx.party.setX("fid", ST.me().fid); V.fidSet = true; }
        if (!(ctx.party && ctx.party.active)) V.fidSet = false;
    });
    // (who can join me + appear offline live in 👯 itself — ⚙️ Settings must still fit 720p)
}
export { render };
