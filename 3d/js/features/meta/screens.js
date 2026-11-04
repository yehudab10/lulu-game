// features/meta — the screens: 📒 LULU'S SCRAPBOOK (tabs: 🏆 Badges · 🚔 Record ·
// 💜 Crew · 📊 Stats + the save-code backup) and 📜 WEEKLY QUESTS.
// DOM cards via H.showScreen, so the D-pad / stick move between everything,
// ✕/A picks, ○/B goes back, L1/R1 flip the scrapbook's tabs; touch + mouse work too.
import { ctx, emit } from "../../core/ctx.js";
import { shared, save3d, saveNow, flushShared, wallet } from "../../core/save.js";
import { showTitle, showPauseMenu } from "../../core/screens.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { fmt, esc, distStr, clamp01, metaToast, chime, tone, PX_PER_M } from "./util.js";
import {
    BADGES, badgeEarned, badgeProg, visibleBadges, badgeTotals, markScrapSeen, badgeSync,
    stat, statB, avigailRel, bestScore, SKIN_COUNT,
} from "./badges.js";
import {
    QUEST_UNLOCK, questActiveIds, questDef, questValue, questComplete, questClaimed, questCountdown,
    questsUnlocked, lifetimeScore, claimQuest, refreshFromSave, questState,
} from "./progress.js";
import { fillPortraits } from "./portraits.js";
import { models } from "../../models.js";

const TABS = [["🏆", "Badges"], ["🚔", "Record"], ["💜", "Crew"], ["📊", "Stats"]];
let from = "title";          // where Back returns: "title" | "pause"
let tab = 0;
let selBadge = null;

function goBack() {
    document.body.classList.remove("meta-open");
    if (from === "pause" && ctx.paused) showPauseMenu();
    else if (ctx.state === "title") showTitle(true);
    else H.hideScreen();
    focusItem(from === "pause" ? "metaPauseScrap" : null);
}
// After returning to a menu, put the cursor back on the button we came from.
let backFocus = null;
function focusItem(fallback) {
    const id = backFocus || fallback;
    backFocus = null;
    if (!id) return;
    const b = document.getElementById(id);
    if (!b) return;
    H.refreshFocus(true);
    b.dispatchEvent(new Event("pointerenter"));
}
function open(html, buttons, opts) {
    document.body.classList.add("meta-open");
    const card = H.showScreen(html, buttons, opts);
    // #screenCard is reused: start every page at the top, then keep the cursor in view
    card.scrollTop = 0;
    const f = card.querySelector(".focus");
    if (f) f.scrollIntoView({ block: "nearest", inline: "nearest" });
    return card;
}

// ── portraits of the real 3D cast ────────────────────────────────────────
function portraitSpecs(S) {
    const style = S.luluHairStyle && models_has("luluPerson_" + S.luluHairStyle) ? "luluPerson_" + S.luluHairStyle : "luluPerson";
    return {
        lulu: { key: style, colors: S.luluHair ? { Hair: S.luluHair } : null },
        avigail: { key: "avigailPerson" },
        bubbe: { key: "bubbe", frame: 0.3 },
        heshy: { key: "heshyPerson" },
        uncle: { key: "npcMan", colors: { Top: "#6D4C41", Bottom: "#3E2723", Hair: "#4E342E" } },
        ima: { key: "imaPerson" },
        doctor: { key: "npcMan", colors: { Top: "#F5F5F5", Bottom: "#78909C", Hair: "#9E9E9E" }, yaw: -0.3 },
        dina: { key: "dinaPerson", frame: 0.3 },
    };
}
const models_has = k => !!models[k];
const pic = (id, emoji, cls = "") => `<div class="mb-pic ${cls}" data-portrait="${id}"><span>${emoji}</span></div>`;

// ══ SCRAPBOOK ══════════════════════════════════════════════════════════════
export function openScrapbook(where = "title", which = tab) {
    from = where;
    backFocus = where === "title" ? "metaScrapbook" : "metaPauseScrap";
    badgeSync();
    markScrapSeen();
    tab = which;
    selBadge = null;
    renderScrapbook(`mbTab${tab}`, false);
}

function renderScrapbook(focus, nopop = true) {
    const S = shared.get();
    const tots = badgeTotals(S);
    const html = `
      <div class="mb-head"><h2>📒 LULU'S SCRAPBOOK</h2><div class="mb-sub">🏆 ${tots.got} / ${tots.tot} badges</div></div>
      <div class="mb-tabs"><span class="mb-g">${glyph("tabPrev")}</span>${TABS.map((t, i) =>
        `<button class="mb-tab${i === tab ? " on" : ""}" id="mbTab${i}" data-tab="${i}">${t[0]} <span>${t[1]}</span></button>`).join("")}<span class="mb-g">${glyph("tabNext")}</span></div>
      <div class="mb-body">${[badgesTab, recordTab, crewTab, statsTab][tab](S)}</div>`;
    const card = open(html, [{ label: `⬅ Back ${glyph("back")}`, cls: "alt", id: "mbBack", action: goBack }],
        { onBack: goBack, onTab: d => switchTab(d), focus, cls: "meta-book" + (nopop ? " nopop" : ""), wide: true });
    card.querySelectorAll(".mb-tab").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.tab; if (i !== tab) { tab = i; selBadge = null; tone(520, 0.04, "square", 0.05); renderScrapbook(`mbTab${tab}`); } }));
    if (tab === 0) wireBadges(card, S);
    if (tab === 3) wireStats(card);
    fillPortraits(card, portraitSpecs(S));
    emit("scrapbook:open", { tab });
    return card;
}
function switchTab(d) {
    tab = (tab + d + TABS.length) % TABS.length;
    selBadge = null;
    renderScrapbook(`mbTab${tab}`);
}

// ── 🏆 badges ─────────────────────────────────────────────────────────────
function badgeCell(b, S) {
    const got = badgeEarned(b, S);
    return `<button class="mb-badge${got ? " got" : ""}${b.secret ? " secret" : ""}" id="mbB_${b.id}" data-id="${b.id}">
        <span class="medal"><span>${b.icon}</span></span><span class="nm">${esc(b.name)}</span></button>`;
}
function badgeInfo(b, S) {
    const got = badgeEarned(b, S);
    const p = badgeProg(b, S);
    let bar = "";
    if (!got && p) {
        const dist = b.unit === "dist";
        const cur = dist ? distStr(Math.min(p[0], p[1]), false) : fmt(Math.min(p[0], p[1]));
        const tgt = dist ? distStr(p[1], false) : fmt(p[1]);
        bar = `<div class="mb-bar"><i style="width:${(clamp01(p[0] / p[1]) * 100).toFixed(1)}%"></i><b>${cur} / ${tgt}</b></div>`;
    } else if (!got) bar = `<div class="mb-hint">pick a badge to see what it takes</div>`;
    else bar = `<div class="mb-got">✓ EARNED${b.secret ? " · 🤫 secret badge!" : ""}</div>`;
    const desc = b.unit === "dist" ? b.desc.replace("10,000", distStr(10000, false)) : b.desc;
    return `<div class="mb-info-ic${got ? " got" : ""}">${b.icon}</div><div class="mb-info-tx"><div class="mb-info-nm">${esc(b.name)}${got ? " ✓" : ""}</div>
        <div class="mb-info-ds">${esc(desc)}</div>${bar}</div>`;
}
function badgesTab(S) {
    const list = visibleBadges(S);
    const two = list.filter(b => !b.three), three = list.filter(b => b.three);
    const pickB = list.find(b => b.id === selBadge) || list.find(b => !badgeEarned(b, S)) || list[0];
    return `<div class="mb-paper mb-info" id="mbInfo">${badgeInfo(pickB, S)}</div>
      <div class="mb-grid">${two.map(b => badgeCell(b, S)).join("")}</div>
      <div class="mb-sect">🧊 Road Trip 3D badges</div>
      <div class="mb-grid">${three.map(b => badgeCell(b, S)).join("")}</div>
      <p class="mb-foot">Badges are shared with the 2D game — earn them in either one.</p>`;
}
let badgeMO = null;
function wireBadges(card, S) {
    if (badgeMO) badgeMO.disconnect();
    const info = card.querySelector("#mbInfo");
    let shown = null;
    const show = id => {
        if (!id || id === shown) return;
        const b = BADGES.find(x => x.id === id);
        if (!b) return;
        shown = id;
        info.innerHTML = badgeInfo(b, S);
    };
    card.querySelectorAll(".mb-badge").forEach(el => {
        el.addEventListener("click", () => { selBadge = el.dataset.id; card.querySelectorAll(".mb-badge.sel").forEach(x => x.classList.remove("sel")); el.classList.add("sel"); show(el.dataset.id); });
    });
    // the D-pad cursor previews whatever badge it's on
    const mo = new MutationObserver(() => {
        if (!card.isConnected || !card.classList.contains("meta-book")) { mo.disconnect(); return; }
        const f = card.querySelector(".mb-badge.focus");
        if (f) show(f.dataset.id);
    });
    mo.observe(card.querySelector(".mb-body"), { attributes: true, attributeFilter: ["class"], subtree: true });
    badgeMO = mo;
}

// ── 🚔 record: rap sheet + ER punch card ──────────────────────────────────
function statusLine(S) {
    const c = S.convictions || 0;
    if (c === 0 && !(S.offenses || 0)) return ["MODEL CITIZEN", "#2E7D32"];
    if (c === 0) return ["KNOWN TO POLICE", "#EF6C00"];
    if (c < 3) return ["REPEAT OFFENDER", "#D84315"];
    return ["PUBLIC ENEMY #1", "#B71C1C"];
}
function recordTab(S) {
    const rows = [
        ["Times booked", S.offenses || 0],
        ["Convictions", S.convictions || 0],
        ["Cases dismissed", stat(S, "dismissed")],
        ["Jailbreaks", S.escapes || 0],
        ["Cop chases escaped", stat(S, "escapes2")],
        ["Speeding tickets (3D)", stat(S, "tickets")],
    ];
    const st = statusLine(S);
    const w8 = Array.isArray(S.wanted) ? S.wanted : [];
    const er = S.erVisits || 0, punched = er % 10, lolli = Math.floor(er / 10);
    let holes = "";
    for (let p = 0; p < 10; p++) holes += `<i class="${p < punched ? "on" : ""}">${p >= punched && p === 9 ? "🍭" : ""}</i>`;
    return `<div class="mb-paper mb-rap nav" id="mbRap">
        <div class="mb-rap-h">CITY POLICE · RAP SHEET</div>
        <div class="mb-rap-row">
          <div class="mb-mug">${pic("lulu", "🙋‍♀️", "mug")}<div class="mb-plate">BRUCK, L.</div></div>
          <div class="mb-file">${rows.map(r => `<div class="mb-line"><span>${r[0]}</span><b>${fmt(r[1])}</b></div>`).join("")}
            <div class="mb-stamp" style="color:${st[1]};border-color:${st[1]}">${st[0]}</div></div>
        </div>
        <div class="mb-warrants${w8.length ? " hot" : ""}">${w8.length ? `⚠ OPEN WARRANTS: ${esc(w8.slice(0, 2).join(", "))}${w8.length > 2 ? " +" + (w8.length - 2) : ""}` : "No open warrants. For now. 😇"}</div>
      </div>
      <div class="mb-paper mb-er nav" id="mbEr">
        <div class="mb-er-row">${pic("doctor", "🧑‍⚕️")}
          <div class="mb-er-tx"><div class="mb-er-h">🏥 ER FREQUENT FLYER CARD</div><div class="mb-punch">${holes}</div></div></div>
        <div class="mb-er-ft">${er} visit${er === 1 ? "" : "s"} · every 10th earns a lollipop${lolli ? " · 🍭×" + lolli : ""}</div>
      </div>`;
}

// ── 💜 crew: the Avigail meter + family run-ins ────────────────────────────
function crewTab(S) {
    const rel = avigailRel(S);
    const lbl = rel <= 20 ? "😈 Sworn Nemesis" : rel <= 40 ? "😒 Rivals" : rel <= 60 ? "😏 Frenemies" : rel <= 80 ? "😊 Friends" : "💜 Besties";
    const tours = S.storyCycle || 0;
    const fam = [
        ["bubbe", "👵", "Bubbe", `${(S.postcards || []).length} / 5 postcards`],
        ["uncle", "👨", "The uncles", `${fmt(stat(S, "uncles3"))} run-ins`],
        ["heshy", "🏊", "Heshy", `${fmt(stat(S, "heshy2"))} pool finds`],
        ["ima", "📞", "Ima", `${fmt(stat(S, "imaCalls"))} calls taken · ${fmt(stat(S, "imaDeclines"))} declined`],
    ];
    if ((S.dinaRunsPlayed || 0) > 0) fam.push(["dina", "🎒", "Dina", `${fmt(S.dinaRunsPlayed)} runs home${S.dinaMedals && S.dinaMedals.gold ? ` · 🥇×${S.dinaMedals.gold}` : ""}`]);
    return `<div class="mb-paper mb-avi nav" id="mbAvi">
        <div class="mb-avi-row">${pic("avigail", "💅", "avi")}
          <div class="mb-avi-tx"><div class="mb-avi-nm">AVIGAIL</div><div class="mb-avi-lbl">${lbl}</div>
            <div class="mb-meter"><i style="left:${clamp01(rel / 100) * 100}%">${Math.round(rel)}</i></div>
            <div class="mb-meter-ends"><span>nemesis</span><span>bestie</span></div>
            <div class="mb-avi-l">Road trips together: <b>${fmt(stat(S, "avigail3"))}</b></div>
            <div class="mb-avi-l">Weddings danced at: <b>${fmt(stat(S, "weddings"))}</b></div></div></div>
      </div>
      <div class="mb-paper mb-fam nav" id="mbFam">
        <div class="mb-fam-h">👪 FAMILY RUN-INS</div>
        <div class="mb-fam-row">${fam.map(f => `<div class="mb-fam-c">${pic(f[0], f[1])}<b>${f[2]}</b><span>${f[3]}</span></div>`).join("")}</div>
        <div class="mb-fam-ft">${tours ? `🎲 Road to Vegas finished ${tours}×` : "🎲 Vegas is still out there…"}</div>
      </div>`;
}

// ── 📊 stats + the save-code backup ───────────────────────────────────────
function statsTab(S) {
    const rows = [
        ["🏁 Best run", fmt(bestScore(S)), `2D ${fmt(S.highScore || 0)} · 3D ${fmt(Math.max(statB(S, "best3d"), save3d.best || 0))}`],
        ["🧮 Lifetime score", fmt(lifetimeScore())],
        ["🛣️ Longest drive", distStr(statB(S, "dist25k"))],
        ["🪙 Most coins in a run", fmt(statB(S, "runCoins250"))],
        ["😤 Longest close-call chain", fmt(statB(S, "chain6"))],
        ["📅 Day streak", fmt(S.streak || 0)],
        ["🗺️ Most stops in one trip", fmt(S.tripBest || 0)],
        ["🏎️ Cars owned", `${(S.ownedSkins || ["pink"]).length} / ${SKIN_COUNT}`],
        ["📣 Honk scares", fmt(stat(S, "honks10"))],
        ["🚀 Cars missiled", fmt(stat(S, "missiles8"))],
        ["🅿️ Pull-over parks", fmt(stat(S, "parks3"))],
        ["🎫 Toll booths", fmt(stat(S, "tolls4"))],
        ["🚶 Distance walked", distStr(stat(S, "footDist"))],
        ["🧊 3D drives", fmt(stat(S, "runs3d"))],
        ["🛞 3D miles", (stat(S, "miles3d") || 0).toFixed(1)],
        ["😎 Close calls (3D)", fmt(stat(S, "closeCalls"))],
        ["💨 Nitro blasts (3D)", fmt(stat(S, "boosts3d"))],
        ["💥 Crashes (3D)", fmt(stat(S, "crashes"))],
        ["👮 Speed traps passed legally (3D)", fmt(stat(S, "legalTraps3d"))],
    ];
    return `<div class="mb-paper mb-stats nav" id="mbStats">${rows.map(r => `<div class="mb-line"><span>${r[0]}${r[2] ? `<small>${r[2]}</small>` : ""}</span><b>${r[1]}</b></div>`).join("")}</div>
      <div class="mb-backup">💾 Moving to a new phone? Back up your progress (works in the 2D game too):</div>
      <div class="mb-bk-row"><button class="btn mb-copy" id="mbCopy">📋 Copy save code</button><button class="btn alt mb-load" id="mbLoad">📥 Load save code</button></div>`;
}
function wireStats(card) {
    card.querySelector("#mbCopy").addEventListener("click", () => showCopyCode());
    card.querySelector("#mbLoad").addEventListener("click", () => showLoadCode());
}

// ── save code backup / restore: "LULU1:" + base64(UTF-8 JSON) — the 2D format ──
// The 2D save object, with the 3D progress riding along as `lulu3d` (the 2D game
// keeps unknown keys, so a code round-trips through either version).
export const SAVE_CODE_PREFIX = "LULU1:";
export function saveToCode() {
    flushShared();
    saveNow();
    const s = shared.get();
    if (typeof s.totalCoins !== "number") s.totalCoins = 0;
    const three = structuredClone(save3d);
    delete three.settings;          // graphics / TV mode are per-device
    s.lulu3d = three;
    return SAVE_CODE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(s))));
}
export function codeToSave(code) {
    code = String(code || "").replace(/\s+/g, "");
    if (code.indexOf(SAVE_CODE_PREFIX) !== 0) return null;
    try {
        const obj = JSON.parse(decodeURIComponent(escape(atob(code.slice(SAVE_CODE_PREFIX.length)))));
        return obj && typeof obj === "object" && !Array.isArray(obj) && typeof obj.totalCoins === "number" ? obj : null;
    } catch (e) { return null; }
}
/** Replace this device's progress with a save object (2D save + optional lulu3d), then reload. */
export function applySave(obj) {
    flushShared();
    const three = obj.lulu3d && typeof obj.lulu3d === "object" && !Array.isArray(obj.lulu3d) ? obj.lulu3d : null;
    const two = Object.assign({}, obj);
    delete two.lulu3d;
    try { localStorage.setItem("luluSaveV2_bak", localStorage.getItem("luluSaveV2") || JSON.stringify(shared.get())); } catch (e) { /* full */ }
    try { localStorage.setItem("luluSaveV2", JSON.stringify(two)); } catch (e) { /* full */ }
    if (three) {
        try { localStorage.setItem("lulu3dSave_bak", JSON.stringify(save3d)); } catch (e) { /* full */ }
        const settings = save3d.settings;
        for (const k of Object.keys(save3d)) delete save3d[k];
        Object.assign(save3d, three, { settings });
    }
    saveNow();
    emit("meta:restored", { three: !!three });
    setTimeout(() => location.reload(), ctx.TEST ? 50 : 350);
}

function codeBox(id, value, readonly) {
    return `<textarea class="mb-code nav" id="${id}" spellcheck="false" autocomplete="off" autocapitalize="off" ${readonly ? "readonly" : `placeholder="${SAVE_CODE_PREFIX}…"`}>${esc(value)}</textarea>`;
}
function wireCodeBox(card, id) {
    const ta = card.querySelector("#" + id);
    // typing must not drive the game (Backspace = back, Enter = confirm, WASD…)
    ta.addEventListener("keydown", e => { e.stopPropagation(); if (e.key === "Escape") ta.blur(); });
    ta.addEventListener("click", () => { ta.focus(); if (ta.readOnly) ta.select(); });
    return ta;
}
async function copyText(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* denied */ }
    try {
        const ta = document.querySelector("#mbCodeOut");
        if (ta) { ta.focus(); ta.select(); return document.execCommand("copy"); }
    } catch (e) { /* no */ }
    return false;
}
function showCopyCode() {
    const code = saveToCode();
    const back = () => { tab = 3; renderScrapbook("mbCopy"); };
    const card = open(`<h2>💾 Your save code</h2><p>Copy it and keep it somewhere safe. Paste it into <b>📥 Load save code</b> — here or in the 2D game — to get everything back.</p>
        ${codeBox("mbCodeOut", code, true)}<p class="fine">${fmt(code.length)} characters · coins, cars, badges, quests, story and your 3D progress</p>`,
        [{ label: `📋 Copy to clipboard ${glyph("confirm")}`, id: "mbDoCopy", action: async () => {
            const ok = await copyText(code);
            metaToast(ok ? "📋 Save code copied! Paste it somewhere safe." : "Select the code and copy it by hand 🙂", ok ? "green" : "");
        } }, { label: `⬅ Back ${glyph("back")}`, cls: "alt", action: back }],
        { onBack: back, cls: "meta-book meta-code nopop", wide: true });
    wireCodeBox(card, "mbCodeOut");
}
function showLoadCode(prefill = "") {
    const back = () => { tab = 3; renderScrapbook("mbLoad"); };
    const card = open(`<h2>📥 Load a save code</h2><p>Paste a code that starts with <b>${SAVE_CODE_PREFIX}</b> (from the 2D or 3D game). It <b>replaces</b> the progress on this device.</p>
        ${codeBox("mbCodeIn", prefill, false)}<div class="mb-err" id="mbErr"></div>`,
        [{ label: "📋 Paste from clipboard", id: "mbPaste", action: async () => {
            try { const t = await navigator.clipboard.readText(); if (t) { ta.value = t.trim(); } } catch (e) { metaToast("Long-press the box and paste the code there 🙂"); }
        } }, { label: `📥 Load this save ${glyph("confirm")}`, id: "mbDoLoad", cls: "pink", action: () => tryLoad(ta.value) },
        { label: `⬅ Cancel ${glyph("back")}`, cls: "alt", action: back }],
        { onBack: back, cls: "meta-book meta-code nopop", wide: true, focus: prefill ? "mbDoLoad" : 0 });
    const ta = wireCodeBox(card, "mbCodeIn");
}
function tryLoad(text) {
    const obj = codeToSave(text);
    if (!obj) {
        const e = document.getElementById("mbErr");
        if (e) e.textContent = "🤔 That doesn't look like a save code.";
        tone(220, 0.18, "square", 0.08);
        return;
    }
    const cur = wallet.coins;
    const back = () => showLoadCode(text);
    open(`<h2>Load this save?</h2><div class="quote">It REPLACES the progress on this device<br><b>${fmt(cur)} coins → ${fmt(obj.totalCoins)} coins</b>${obj.lulu3d ? "<br>(including 3D progress)" : ""}</div>`,
        [{ label: `✔ Yes, load it ${glyph("confirm")}`, id: "mbYes", cls: "pink", action: () => { H.hideScreen(); document.body.classList.remove("meta-open"); metaToast("💾 Loading your save…", "green"); applySave(obj); } },
         { label: `✖ No, keep mine ${glyph("back")}`, cls: "alt", action: back }],
        { onBack: back, cls: "meta-book meta-code nopop", focus: 1 });
}

// ══ WEEKLY QUESTS ══════════════════════════════════════════════════════════
export function openQuests(where = "title") {
    from = where;
    backFocus = where === "title" ? "metaQuests" : "metaPauseQuests";
    refreshFromSave();
    renderQuests(null, false);
}
function questCard(id) {
    const def = questDef(id);
    const done = questComplete(id), claimed = questClaimed(id), val = questValue(id);
    const dist = def.unit === "dist";
    const show = v => dist ? distStr(v, def.id !== "dist25k") : fmt(v);
    let foot;
    if (claimed) foot = `<div class="mq-claimed">✓ CLAIMED</div>`;
    else if (done) foot = `<div class="mq-foot"><div class="mq-bar full"><i style="width:100%"></i><b>${show(def.target)} / ${show(def.target)}</b></div>
        <button class="mq-claim" id="mqClaim_${id}" data-id="${id}">CLAIM <span class="coin"></span> ${glyph("confirm")}</button></div>`;
    else foot = `<div class="mq-bar"><i style="width:${(clamp01(val / def.target) * 100).toFixed(1)}%"></i><b>${show(Math.min(val, def.target))} / ${show(def.target)}</b></div>`;
    return `<div class="mq-card${claimed ? " claimed" : done ? " done" : ""}${claimed || !done ? " nav" : ""}" id="mqCard_${id}">
        <div class="mq-ic">${def.icon}</div>
        <div class="mq-tx"><div class="mq-top"><b class="mq-nm">${esc(def.title)}</b><span class="mq-rw">+${def.reward} <span class="coin"></span></span></div>
          <div class="mq-ds">${esc(def.desc3d || def.desc)}</div>${foot}</div></div>`;
}
function renderQuests(focus, nopop = true) {
    const unlocked = questsUnlocked();
    const ids = questActiveIds();
    const life = lifetimeScore();
    let body;
    if (!unlocked) {
        const pct = Math.floor(clamp01(life / QUEST_UNLOCK) * 100);
        body = `<div class="mq-lock nav" id="mqLock"><div class="mq-lock-ic">🔒</div>
            <div><b>Weekly quests unlock at ${fmt(QUEST_UNLOCK)} lifetime score</b>
            <div class="mq-bar"><i style="width:${pct}%"></i><b>${fmt(life)} / ${fmt(QUEST_UNLOCK)} · ${pct}%</b></div>
            <small>Every finished run counts — in the 2D game too.</small></div></div>
          <div class="mq-preview"><div class="mq-pv-h">This week's quests</div>${ids.map(id => { const d = questDef(id); return `<div class="mq-pv">${d.icon} <b>${esc(d.title)}</b> · ${esc(d.desc3d || d.desc)} · +${d.reward} <span class="coin"></span></div>`; }).join("")}</div>`;
    } else {
        questState();
        const allClaimed = ids.every(questClaimed);
        body = ids.map(questCard).join("") + (allClaimed ? `<div class="mq-done">all done — new quests in ${questCountdown()} 🎉</div>` : "");
    }
    const html = `<div class="mq-head"><h2>📜 WEEKLY QUESTS</h2><div class="mq-coins"><span class="coin"></span> <b id="mqCoins">${fmt(wallet.coins)}</b></div></div>
        <div class="mq-sub">new quests in ${questCountdown()} · the same three in the 2D game</div>${body}`;
    const firstClaim = unlocked && ids.find(id => questComplete(id) && !questClaimed(id));
    const card = open(html, [{ label: `⬅ Back ${glyph("back")}`, cls: "alt", id: "mqBack", action: goBack }],
        { onBack: goBack, focus: focus || (firstClaim ? `mqClaim_${firstClaim}` : 0), cls: "meta-quests" + (nopop ? " nopop" : ""), wide: true });
    card.querySelectorAll(".mq-claim").forEach(b => b.addEventListener("click", () => doClaim(b.dataset.id, b)));
    return card;
}
function doClaim(id, btn) {
    const def = questDef(id);
    if (!claimQuest(id)) return;
    chime([784, 988, 1319], 0.09, 0.2);
    const r = btn.getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
    metaToast(`+${def.reward} 💰 claimed!`, "", 2);
    renderQuests(`mqCard_${id}`);
}
function confetti(x, y) {
    const box = document.createElement("div");
    box.className = "meta-confetti";
    const cols = ["#FF4081", "#FFD740", "#40C4FF", "#B388FF", "#69F0AE", "#FF6E40"];
    for (let i = 0; i < 46; i++) {
        const p = document.createElement("i");
        const a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 220;
        p.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % cols.length]};--dx:${Math.cos(a) * v}px;--dy:${Math.sin(a) * v - 120}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 0.08}s`;
        box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1500);
}
