// Shared Road — UI: the 🌐 Shared Road screen (curated rider names, EVERYONE /
// FRIEND CODE rooms with a letter wheel, connect / switch / race / tag /
// disconnect, today's top riders), the driving-HUD chips (riders · convoy ·
// slipstream · tag) and race standings, the always-on overlay (race countdown,
// winner banner, tag banner + results card, party record toasts) and the
// EMOTE WHEEL (hold L1 / H, or tap 😀).
//
// Every screen is spatially navigable: D-pad + ✕/○ on a DualSense, arrows +
// Enter/Esc on a keyboard, taps on a phone. Prompts use glyph().
import { ctx, css, emit } from "../../core/ctx.js";
import { glyph, input } from "../../input.js";
import { sfxSelect } from "../../audio.js";
import * as H from "../../hud.js";
import { showTitle, showPauseMenu } from "../../core/screens.js";
import {
    MP, CURATED_NAMES, EMOTES, RACE_GOAL, allowed, myName, setName, peerCount, riderCount, roomLabel, targetRoom,
    friendRoom, rerollCode, connect, disconnect, switchRoom, raceStart, tagStart, tagItName, tagRows, scoresList, sendEmote,
} from "./net.js";
import { shared } from "../../core/save.js";
import { SKINS } from "../../car.js";

css("multiplayer", `
.mp-card h2 { margin-bottom: 2px; }
.mp-names { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 8px 0 4px; }
.mp-names .btn { width: 100%; font-size: 15px; padding: 9px 6px; border-radius: 14px; background: #5E548E; }
.mp-names .btn.sel { background: #7E57C2; box-shadow: 0 0 0 3px #FFD54F, 0 4px 0 rgba(0,0,0,.22); }
.mp-row { display: flex; gap: 10px; justify-content: center; margin: 10px 0 4px; flex-wrap: wrap; }
.mp-row .btn { width: auto; min-width: 150px; flex: 1 1 0; font-size: 16px; padding: 10px 12px; }
.mp-row .btn.on-every { background: #26A69A; } .mp-row .btn.on-friend { background: #FF7043; } .mp-row .btn.off { background: #78909C; }
.mp-code { display: flex; gap: 10px; justify-content: center; margin: 8px 0 2px; }
.mp-slot { display: flex; flex-direction: column; gap: 4px; align-items: center; }
.mp-slot .btn { width: 58px; padding: 4px 0; font-size: 14px; border-radius: 10px; background: #4A4270; }
.mp-slot .btn.letter { font-size: 28px; padding: 6px 0; background: #1F1A30; color: #FFD54F; box-shadow: inset 0 0 0 2px #7E57C2, 0 4px 0 rgba(0,0,0,.2); }
.mp-status { font-size: 22px; font-weight: 700; margin: 6px 0 2px; }
.mp-status.ok { color: #2E7D32; } .mp-status.wait { color: #E65100; }
.mp-peers { font-size: 14px; opacity: .8; margin: 2px 0; }
.mp-board { background: #2B2540; color: #E1D5F5; border-radius: 16px; padding: 8px 12px; margin: 10px auto 2px; max-width: 360px; text-align: left; font-size: 14px; }
.mp-board b { color: #FFD54F; display: block; text-align: center; letter-spacing: .06em; font-size: 13px; margin-bottom: 4px; }
.mp-board div { display: flex; justify-content: space-between; padding: 2px 6px; border-radius: 8px; }
.mp-board div.me { background: rgba(126,87,194,.55); color: #fff; }
.mp-crew { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; margin: 6px 0 2px; font-size: 13px; font-weight: 700; }
.mp-crew span { background: rgba(43,37,64,.85); color: #fff; border-radius: 999px; padding: 3px 10px 3px 6px; white-space: nowrap; }
.mp-crew i { font-style: normal; display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 5px; vertical-align: -1px; box-shadow: 0 0 0 2px rgba(255,255,255,.6); }
.mp-titlebox { font-size: 13px; color: #6A5AA0; font-weight: 700; margin-top: 4px; }
#mpChips { display: flex; flex-direction: column; align-items: center; gap: 4px; }
#mpChips .mpc { border-radius: 999px; padding: 3px 12px; font-weight: 700; font-size: 13px; color: #fff; box-shadow: 0 3px 8px rgba(0,0,0,.2); white-space: nowrap; }
#mpChips .mpc.riders { background: rgba(38,166,154,.9); transition: transform .3s; }
#mpChips .mpc.riders.pulse { transform: scale(1.18); box-shadow: 0 0 0 3px #FFECB3; }
#mpChips .mpc.convoy { background: rgba(46,125,50,.92); } #mpChips .mpc.draft { background: rgba(2,119,189,.92); }
#mpChips .mpc.tagme { background: rgba(198,40,40,.94); animation: mpPulse .6s infinite alternate; } #mpChips .mpc.tag { background: rgba(84,110,122,.92); }
@keyframes mpPulse { to { transform: scale(1.07); } }
#mpRace { background: rgba(10,8,24,.66); color: #fff; border-radius: 14px; padding: 6px 10px; min-width: 170px; font-size: 12px; font-weight: 700; }
#mpRace .t { color: #FFD54F; font-size: 11px; letter-spacing: .1em; }
#mpRace .r { display: flex; justify-content: space-between; margin-top: 4px; } #mpRace .r.me { color: #FFE082; }
#mpRace .bar { height: 6px; border-radius: 3px; background: rgba(0,0,0,.5); margin-top: 2px; overflow: hidden; }
#mpRace .bar i { display: block; height: 100%; background: #B39DDB; } #mpRace .r.me + .bar i { background: #7CFC4F; }
#mpOverlay { position: fixed; inset: 0; pointer-events: none; z-index: 8; font-family: var(--font); color: #fff; }
#mpOverlay .count { position: absolute; inset: 0; background: rgba(10,8,24,.42); display: flex; flex-direction: column; align-items: center; justify-content: center; }
#mpOverlay .count b { font-size: 30px; color: #FFD54F; text-shadow: 0 3px 0 #000; }
#mpOverlay .count .n { font-size: 110px; font-weight: 700; line-height: 1.1; text-shadow: 0 6px 0 #7E57C2; }
#mpOverlay .count small { font-size: 15px; font-weight: 700; color: #E1D5F5; text-shadow: 0 2px 0 #000; }
#mpOverlay .ban { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 34px; font-weight: 700; text-shadow: 0 4px 0 #000; transition: opacity .3s; }
#mpOverlay .ban small { display: block; font-size: 17px; color: #FFE0B2; margin-top: 4px; text-shadow: 0 2px 0 #000; }
#mpOverlay .ban.tag { color: #FF5252; top: 36%; }
#mpOverlay .toasts { position: absolute; left: 50%; top: calc(max(12px, env(safe-area-inset-top)) + 96px); transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; }
#mpOverlay .toasts div { background: rgba(24,18,40,.9); border: 1.5px solid rgba(255,213,79,.6); color: #FFD54F; border-radius: 999px; padding: 4px 14px; font-weight: 700; font-size: 14px; white-space: nowrap; }
#mpOverlay .results { position: absolute; left: 50%; top: 20%; transform: translateX(-50%); background: rgba(20,16,40,.94); border: 3px solid #FF5252; border-radius: 18px; padding: 12px 18px; min-width: 260px; }
#mpOverlay .results b { display: block; text-align: center; color: #FFD54F; font-size: 20px; }
#mpOverlay .results small { display: block; text-align: center; color: #B0A8C8; margin-bottom: 6px; }
#mpOverlay .results div { display: flex; justify-content: space-between; gap: 20px; font-weight: 700; padding: 2px 0; }
#mpOverlay .results div.win { color: #FFE082; }
#mpWheel { position: fixed; left: 50%; top: 50%; width: 0; height: 0; z-index: 9; pointer-events: none; }
#mpWheel.open { pointer-events: auto; }
#mpWheel .disc { position: absolute; width: 64px; height: 64px; margin: -32px 0 0 -32px; border-radius: 50%; border: none; font-size: 32px; line-height: 64px; padding: 0;
  background: rgba(43,37,64,.95); box-shadow: 0 0 0 3px #7E57C2, 0 6px 14px rgba(0,0,0,.35); cursor: pointer; transition: transform .12s; }
#mpWheel .disc.hot { transform: scale(1.25); box-shadow: 0 0 0 4px #FFD54F, 0 6px 14px rgba(0,0,0,.35); }
#mpWheel .disc small { position: absolute; right: -2px; bottom: -2px; font-size: 11px; line-height: 16px; background: #fff; color: var(--ink); border-radius: 6px; padding: 0 4px; font-weight: 700; }
#mpWheel .hub { position: absolute; width: 96px; margin-left: -48px; top: -14px; text-align: center; font-size: 12px; font-weight: 700; text-shadow: 0 2px 0 #000; color: #fff; }
#mpWheel .scrim { position: fixed; inset: 0; background: rgba(0,0,0,.22); }
@media (max-width: 600px) { .mp-names { grid-template-columns: repeat(2, 1fr); } #mpOverlay .count .n { font-size: 84px; } }
body.tv .mp-names .btn { font-size: 22px; padding: 12px 8px; } body.tv .mp-row .btn { font-size: 24px; }
body.tv .mp-slot .btn { width: 80px; font-size: 20px; } body.tv .mp-slot .btn.letter { font-size: 40px; }
body.tv #mpChips .mpc { font-size: 20px; padding: 5px 16px; } body.tv #mpRace { font-size: 18px; min-width: 260px; }
body.tv #mpOverlay .toasts div { font-size: 22px; } body.tv #mpOverlay .ban { font-size: 50px; }
body.tv #mpWheel .disc { width: 96px; height: 96px; margin: -48px 0 0 -48px; font-size: 48px; line-height: 96px; }
`);

// ── the Shared Road screen ───────────────────────────────────────────────
const UI = { open: false, back: null, lastRender: 0 };
export function screenOpen() { return UI.open && H.screenOpen(); }

export function openSharedRoad(from = "title") {
    UI.back = from === "pause" ? () => { UI.open = false; showPauseMenu(); } : () => { UI.open = false; showTitle(true); };
    UI.open = true;
    render("mp_go");
}

function btn(id, label, cls = "") { return `<button class="btn ${cls}" id="${id}">${label}</button>`; }
function codeSlots() {
    return `<div class="mp-code">${MP.codeSlots.map((c, i) => `<div class="mp-slot">${btn("mp_up" + i, "▲")}${btn("mp_l" + i, String.fromCharCode(65 + c), "letter")}${btn("mp_dn" + i, "▼")}</div>`).join("")}</div>
        <div class="mp-row" style="margin-top:4px">${btn("mp_reroll", "🎲 new code", "alt")}</div>
        <p class="fine">Share this code with friends — or dial in theirs (2D or 3D).</p>`;
}
function modeRow() {
    return `<div class="mp-row">${btn("mp_every", "🌍 EVERYONE", MP.roomKind === "everyone" ? "on-every" : "off")}${btn("mp_friend", "🔑 FRIEND CODE", MP.roomKind === "friend" ? "on-friend" : "off")}</div>`;
}
function boardHtml() {
    const list = scoresList();
    if (!list || !list.length) return "";
    const me = shared.get().mpName;
    return `<div class="mp-board"><b>🏁 TODAY'S TOP RIDERS</b>${list.slice(0, 5).map((e, i) =>
        `<div class="${e.name === me ? "me" : ""}"><span>${i + 1}. ${esc(e.name || "Rider")}</span><span>${(e.score || 0).toLocaleString()}</span></div>`).join("")}</div>`;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

function render(focusId) {
    if (!UI.open) return;
    const focus = focusId || (H.screenOpen() && document.activeElement && document.querySelector("#screenCard .focus") ? document.querySelector("#screenCard .focus").id : "mp_go");
    UI.lastRender = MP.clock;
    let html = `<h2>🌐 Shared Road</h2>`;
    const buttons = [];
    if (!allowed()) {
        html += `<p>Shared Road isn't available here.</p>`;
        buttons.push({ id: "mp_close", label: `Back ${glyph("back")}`, cls: "alt", action: UI.back });
    } else if (!MP.want) {
        const cur = shared.get().mpName;
        html += `<p class="fine">Ride alongside 2D and 3D players as see-through ghosts. Honks and emotes only — no chat, no crashes.</p>
            <p><b>Pick your rider name</b></p>
            <div class="mp-names">${CURATED_NAMES.map((n, i) => btn("mp_n" + i, esc(n), n === cur ? "sel" : "")).join("")}</div>
            ${modeRow()}${MP.roomKind === "friend" ? codeSlots() : ""}${boardHtml()}`;
        buttons.push({ id: "mp_go", label: `🌐 Connect ${glyph("confirm")}`, action: () => {
            if (!shared.get().mpName) setName(CURATED_NAMES[0]);
            shared.update(s => { s.mpAutoOff = false; });     // opting IN re-enables cruise auto-join
            connect(targetRoom(), MP.roomKind);
            render("mp_go");
        } });
        buttons.push({ id: "mp_close", label: `Cancel ${glyph("back")}`, cls: "alt", action: UI.back });
    } else {
        const connecting = !MP.connected, switching = connecting && !!MP.switchTo;
        html += `<div class="mp-status ${connecting ? "wait" : "ok"}">${switching ? "🔀 Switching…" : connecting ? "… Connecting" : "✅ Connected"}</div>`;
        if (switching) html += `<p><b>→ ${MP.switchTo}</b></p>`;
        else if (connecting && MP.clock - MP.wantSince > 5) html += `<p class="fine">Can't reach the road — still retrying.</p>`;
        html += `<p>Room: <b>${roomLabel(MP.room)}</b> · Riding as <b>${esc(myName())}</b></p>`;
        if (MP.connected) {
            const names = Object.values(MP.peers).map(p => esc(p.name));
            html += `<p><b>🌐 ${riderCount()} rider${riderCount() === 1 ? "" : "s"} on the road</b></p>${names.length ? `<div class="mp-peers">${names.slice(0, 6).map(n => "• " + n).join("  ")}</div>` : ""}`;
        }
        html += `<p class="fine" style="margin-top:10px">— Switch room —</p>${modeRow()}${MP.roomKind === "friend" ? codeSlots() : ""}`;
        const target = targetRoom();
        if (target !== MP.room) buttons.push({ id: "mp_go", label: `🔀 Switch to ${roomLabel(target)}`, action: () => { switchRoom(target, MP.roomKind); render("mp_go"); } });
        else if (friendRoom() && !MP.race) buttons.push({ id: "mp_go", label: `🏁 Start race — first to ${RACE_GOAL / 1000}k!`, action: () => { raceStart(); UI.back(); } });
        if (friendRoom() && target === MP.room) {
            if (MP.tag) html += `<p><b>🏷 TAG in progress…</b></p>`;
            else if (peerCount() >= 1) buttons.push({ id: "mp_tag", label: "🏷 Tag — 90s, don't be IT!", cls: "pink", action: () => { tagStart(); UI.back(); } });
            else html += `<p class="fine">🏷 TAG needs another rider in the room</p>`;
        }
        html += boardHtml();
        buttons.push({ id: "mp_off", label: "Disconnect", cls: "purple", action: () => { disconnect(true); render("mp_go"); } });
        buttons.push({ id: "mp_close", label: `Close ${glyph("back")}`, cls: "alt", action: UI.back });
    }
    const card = H.showScreen(html, buttons, { onBack: UI.back, focus: focus || 0, wide: true, cls: "mp-card" });
    const on = (id, fn) => { const b = card.querySelector("#" + id); if (b) b.addEventListener("click", () => { sfxSelect(); fn(); }); };
    CURATED_NAMES.forEach((n, i) => on("mp_n" + i, () => { setName(n); render("mp_n" + i); }));
    on("mp_every", () => { MP.roomKind = "everyone"; render("mp_every"); });
    on("mp_friend", () => { MP.roomKind = "friend"; render("mp_friend"); });
    for (let i = 0; i < 4; i++) {
        on("mp_up" + i, () => { MP.codeSlots[i] = (MP.codeSlots[i] + 1) % 26; render("mp_up" + i); });
        on("mp_l" + i, () => { MP.codeSlots[i] = (MP.codeSlots[i] + 1) % 26; render("mp_l" + i); });
        on("mp_dn" + i, () => { MP.codeSlots[i] = (MP.codeSlots[i] + 25) % 26; render("mp_dn" + i); });
    }
    on("mp_reroll", () => { rerollCode(); render("mp_reroll"); });
    H.refreshFocus(true);
}
/** Called every frame: keep the screen live (status, riders) while it's open. */
export function uiTick() {
    if (!UI.open) return;
    if (!H.screenOpen() || !document.querySelector("#screenCard.mp-card")) { UI.open = false; return; }
    if (MP.clock - UI.lastRender > 1.0 && (MP.want || UI.dirty)) { UI.dirty = false; const f = document.querySelector("#screenCard .focus"); render(f && f.id); }
}
export function uiDirty() { UI.dirty = true; if (UI.open) UI.lastRender = -1; }

// ── title extras: the crew strip + top riders ────────────────────────────
export function titleCrewHtml() {
    if (!MP.connected) return "";
    const me = { name: myName() + " (you)", sk: ctx.car ? ctx.car.skinKey : "pink" };
    const crew = [me, ...Object.values(MP.peers).slice(0, 7)];
    return `<div class="mp-titlebox">👥 YOUR CREW${MP.room !== "lobby" ? " · ROOM " + MP.room.toUpperCase() : ""}</div>
        <div class="mp-crew">${crew.map(p => `<span><i style="background:${(SKINS[p.sk] || SKINS.pink).body}"></i>${esc(p.name)}</span>`).join("")}</div>`;
}
export function titleBoardHtml() {
    const list = scoresList();
    if (!list || !list.length) return "";
    return `<div class="mp-titlebox">🏁 TODAY'S TOP RIDERS: ${list.slice(0, 3).map((e, i) => `${i + 1}. ${esc(e.name)} ${(e.score || 0).toLocaleString()}`).join(" · ")}</div>`;
}

// ── driving HUD: chips + race standings ──────────────────────────────────
let chips = null, racePanel = null;
const lastHtml = {};
function setHtml(el, key, html) { if (lastHtml[key] !== html) { lastHtml[key] = html; el.innerHTML = html; } }
export function hudTick() {
    if (!chips) { chips = document.createElement("div"); chips.id = "mpChips"; H.hudSlot("center").appendChild(chips); }
    if (!racePanel) { racePanel = document.createElement("div"); racePanel.id = "mpRace"; H.hudSlot("left").appendChild(racePanel); }
    let h = "";
    if (MP.connected) {
        const n = riderCount();
        h += `<div class="mpc riders${MP.chipPulse > 0.3 ? " pulse" : ""}">🌐 ${n} ${n === 1 ? "rider" : "riders"}</div>`;
        if (MP.convoy.active) h += `<div class="mpc convoy">🚗🚗 ×1.5</div>`;
        if (MP.draft.active) h += `<div class="mpc draft">💨 SLIPSTREAM</div>`;
        const T = MP.tag;
        if (T && !T.over) {
            const left = Math.max(0, Math.ceil((T.dur || 90) - T.t));
            h += T.itIsMe ? `<div class="mpc tagme">🏷 TAG — you're IT! ${left}s</div>` : `<div class="mpc tag">🏷 TAG — avoid ${esc(tagItName())}! ${left}s</div>`;
        }
    }
    setHtml(chips, "chips", h);
    const R = MP.race;
    let r = "";
    if (R && R.state === "go") {
        const rows = [{ name: myName() + " (you)", prog: R.prog, me: true }];
        for (const id in MP.peers) if (typeof MP.peers[id].raceProg === "number") rows.push({ name: MP.peers[id].name, prog: MP.peers[id].raceProg });
        rows.sort((a, b) => b.prog - a.prog);
        r = `<div class="t">🏁 RACE · first to ${RACE_GOAL / 1000}k</div>` + rows.slice(0, 5).map(x => {
            const pp = Math.max(0, Math.min(1, x.prog / RACE_GOAL));
            return `<div class="r${x.me ? " me" : ""}"><span>${esc(x.name)}</span><span>${Math.floor(pp * 100)}%</span></div><div class="bar"><i style="width:${(pp * 100).toFixed(1)}%"></i></div>`;
        }).join("");
    }
    racePanel.style.display = r ? "" : "none";
    setHtml(racePanel, "race", r);
}

// ── the always-on overlay (title, driving, on foot) ──────────────────────
const ov = document.createElement("div");
ov.id = "mpOverlay";
ov.innerHTML = `<div class="count" style="display:none"></div><div class="ban race" style="display:none"></div><div class="ban tag" style="display:none"></div><div class="results" style="display:none"></div><div class="toasts"></div>`;
document.body.appendChild(ov);
const O = { count: ov.querySelector(".count"), race: ov.querySelector(".ban.race"), tag: ov.querySelector(".ban.tag"), results: ov.querySelector(".results"), toasts: ov.querySelector(".toasts") };
function vis(el, key, on) { const v = on ? "" : "none"; if (lastHtml["v" + key] !== v) { lastHtml["v" + key] = v; el.style.display = v; } }
export function overlayTick() {
    const R = MP.race;
    // race countdown / GO / winner
    if (R && R.state === "count") {
        const n = Math.max(1, Math.ceil(3 - R.t));
        setHtml(O.count, "count", `<b>🏁 FRIEND RACE!</b><div class="n">${n}</div><small>First to ${RACE_GOAL / 1000}k road — crashes cost TIME, not progress!</small>`);
        vis(O.count, "count", true);
    } else vis(O.count, "count", false);
    if (R && (R.state === "done" || (R.state === "go" && R.t < 1.2))) {
        const txt = R.state === "go" ? "🏁 GO!" : R.winner === "me" ? "🏆 YOU WIN THE RACE!" : `🏆 ${esc(R.winName)} WINS!`;
        setHtml(O.race, "race", txt);
        O.race.style.color = R.state === "go" ? "#7CFC4F" : R.winner === "me" ? "#FFD54F" : "#B39DDB";
        O.race.style.opacity = R.state === "done" && R.t > 4 ? Math.max(0, 1 - (R.t - 4) / 2) : 1;
        vis(O.race, "race", true);
    } else vis(O.race, "race", false);
    // tag banner + results
    const B = MP.tagBanner;
    if (B) {
        setHtml(O.tag, "tag", `${B.text}<small>${B.sub}</small>`);
        O.tag.style.opacity = B.t < 0.2 ? B.t / 0.2 : Math.max(0, Math.min(1, 1 - (B.t - 1.8) / 0.6));
        vis(O.tag, "tag", true);
    } else vis(O.tag, "tag", false);
    const T = MP.tag;
    if (T && T.over) {
        const rows = tagRows().slice(0, 6);
        setHtml(O.results, "results", `<b>🏷 TAG — FINAL</b><small>least time as IT wins</small>` + rows.map((r, i) =>
            `<div class="${i === 0 && r.secs !== null ? "win" : ""}"><span>${i === 0 && r.secs !== null ? "🏆 " : (i + 1) + ". "}${esc(r.name)}</span><span>${r.secs === null ? "?" : r.secs + "s"}</span></div>`).join(""));
        O.results.style.opacity = Math.min(1, T.resultsT / 0.3);
        vis(O.results, "results", true);
    } else vis(O.results, "results", false);
    // party record toasts
    setHtml(O.toasts, "toasts", MP.toasts.slice(0, 2).map(t => `<div style="opacity:${t.t < 0.25 ? t.t / 0.25 : t.t > 2.5 ? Math.max(0, 1 - (t.t - 2.5) / 0.5) : 1}">🎉 ${esc(t.name)} set a record: ${t.score.toLocaleString()}!</div>`).join(""));
}

// ── the EMOTE WHEEL ──────────────────────────────────────────────────────
// 0–5 = the 2D game's six emotes (relayed as d.em) · 6 = 👋 wave (the "wave" event)
const WHEEL = [...EMOTES, "👋"];
const W = { open: false, t: 0, hot: -1, byHold: false, holdT: 0, savedHorn: undefined };
const wheel = document.createElement("div");
wheel.id = "mpWheel";
document.body.appendChild(wheel);
function wheelHtml() {
    const R = window.innerWidth < 600 ? 92 : 118;
    return `<div class="scrim"></div>` + WHEEL.map((e, i) => {
        const a = -Math.PI / 2 + i * Math.PI * 2 / WHEEL.length;
        return `<button class="disc nav" data-i="${i}" style="left:${Math.cos(a) * R}px;top:${Math.sin(a) * R}px">${e}<small>${i + 1}</small></button>`;
    }).join("") + `<div class="hub">${input.device === "gamepad" ? `R-stick + release ${glyph("honk")}` : input.device === "touch" ? "tap an emote" : "1–7 or click"}</div>`;
}
wheel.addEventListener("click", e => {
    const b = e.target.closest(".disc");
    if (b) { fire(+b.dataset.i); return; }
    if (e.target.classList.contains("scrim")) closeWheel();
});
export function openWheel(byHold) {
    if (W.open || !MP.connected) return;
    W.open = true; W.t = 0; W.hot = -1; W.byHold = !!byHold;
    wheel.innerHTML = wheelHtml();
    wheel.classList.add("open");
    if (byHold && ctx.G) { W.savedHorn = ctx.G.customHorn; ctx.G.customHorn = true; }   // hush the horn while choosing
}
export function closeWheel() {
    if (!W.open) return;
    W.open = false;
    wheel.classList.remove("open");
    wheel.innerHTML = "";
    if (W.byHold && ctx.G) ctx.G.customHorn = W.savedHorn;
    W.byHold = false;
}
function fire(i) { sendEmote(i); emit("stat", { id: "mpEmotes", n: 1 }); closeWheel(); }
export function wheelOpen() { return W.open; }
/** Per frame while a run is on screen: hold-to-open, right-stick aim, release-to-send, timeout. */
export function wheelTick(dt, inRun) {
    if (!inRun || !MP.connected) { W.holdT = 0; closeWheel(); return; }
    if (input.honkHeld) {
        W.holdT += dt;
        if (W.holdT > 0.35 && !W.open && input.device !== "touch") openWheel(true);
    } else {
        if (W.open && W.byHold) { if (W.hot >= 0) fire(W.hot); else closeWheel(); }
        W.holdT = 0;
    }
    if (!W.open) return;
    W.t += dt;
    const lx = input.lookX, ly = input.lookY;
    if (Math.hypot(lx, ly) > 0.45) {
        const a = Math.atan2(ly, lx);
        let best = 0, bd = 9;
        WHEEL.forEach((_, i) => { const sa = -Math.PI / 2 + i * Math.PI * 2 / WHEEL.length; let d = Math.abs(((a - sa + Math.PI * 3) % (Math.PI * 2)) - Math.PI); if (d < bd) { bd = d; best = i; } });
        W.hot = best;
    }
    wheel.querySelectorAll(".disc").forEach((b, i) => b.classList.toggle("hot", i === W.hot));
    if (!W.byHold && W.t > 3) closeWheel();
}
// number keys 1–7 fire emotes directly while connected and in a run
let keyInRun = false;
export function setKeyInRun(v) { keyInRun = v; }
window.addEventListener("keydown", e => {
    if (!keyInRun || !MP.connected || e.repeat) return;
    const m = /^Digit([1-7])$/.exec(e.code);
    if (m) { fire(+m[1] - 1); e.preventDefault(); }
});
