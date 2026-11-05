// features/meta — lifetime stats, WEEKLY QUESTS, lifetime-score banking and
// the daily streak. A straight port of src/06b-quests.js + the streak in
// src/04-parking-logic.js, reading/writing the SHARED 2D save so both versions
// keep one set of numbers:
//   save.stats[id] / save.stats.best[id]  lifetime counters (keyed by the quest ids)
//   save.quests = { week, prog, best, claimed, notified }  (same week maths + same
//                  seeded pick, so the same 3 quests are live in 2D and 3D)
//   save.lifetimeScore (200,000 unlocks quests) · save.dayNum / save.streak
//
// Distances are stored in 2D units (px; 11.7 px ≈ 1 m) so a 3D drive and a 2D
// drive compare fairly; the 3D screens show them in miles / metres.
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { shared, wallet, flushShared } from "../../core/save.js";
import * as H from "../../hud.js";
import { input } from "../../input.js";
import { now, PX_PER_M, fmt, note, chime, tone, distStr } from "./util.js";

export const QUEST_UNLOCK = 200000;

// { id, icon, title, desc, target, reward, scope } — ids, targets and rewards exactly as 2D.
//   scope "run"  → the BEST single-run value (questBest)
//   scope "week" → accumulates across every run this week (questAdd)
// desc3d / unit: how the 3D screen words & counts it (distances in mi / m).
export const QUEST_POOL = [
    { id: "chain6",      icon: "😤", title: "Daredevil",           desc: "Hit a 6 close-call chain in one run",    target: 6,     reward: 150, scope: "run" },
    { id: "runCoins250", icon: "🪙", title: "Coin Vacuum",         desc: "Collect 250 coins in a single run",      target: 250,   reward: 150, scope: "run" },
    { id: "dist25k",     icon: "🛣️", title: "Road Warrior",        desc: "Drive 25,000 distance in one run",       target: 25000, reward: 125, scope: "run", unit: "dist",
      desc3d: `Drive ${distStr(25000)} in one run` },
    { id: "escapes2",    icon: "🚓", title: "Catch Me If You Can", desc: "Escape 2 cop chases this week",          target: 2,     reward: 200, scope: "week" },
    { id: "parks3",      icon: "🅿️", title: "Parallel Pro",        desc: "Complete 3 pull-over parks this week",   target: 3,     reward: 150, scope: "week" },
    { id: "uncles3",     icon: "👨", title: "Family Reunion",      desc: "Greet 3 uncles this week",               target: 3,     reward: 175, scope: "week" },
    { id: "missiles8",   icon: "🚀", title: "Demolition Diva",     desc: "Destroy 8 cars with missiles this week", target: 8,     reward: 150, scope: "week" },
    { id: "honks10",     icon: "📣", title: "Make Some Noise",     desc: "Honk-scare 10 cars this week",           target: 10,    reward: 100, scope: "week" },
    { id: "heshy2",      icon: "🏊", title: "Pool Patrol",         desc: "Find Heshy 2 times this week",           target: 2,     reward: 125, scope: "week" },
    { id: "tolls4",      icon: "🎫", title: "Toll Collector",      desc: "Pass 4 toll booths this week",           target: 4,     reward: 100, scope: "week" },
    { id: "avigail3",    icon: "💜", title: "Frenemies",           desc: "Share the road with Avigail 3 times",    target: 3,     reward: 125, scope: "week" },
    { id: "footDist",    icon: "🚶", title: "Stretch Those Legs",  desc: "Walk 3,000 on foot this week",           target: 3000,  reward: 125, scope: "week", unit: "dist",
      desc3d: `Walk ${distStr(3000, false)} on foot this week` },
];
const DEF = Object.fromEntries(QUEST_POOL.map(q => [q.id, q]));
export const questDef = id => DEF[id] || null;

// ── the same deterministic weekly pick as the 2D game (mpHashStr + mpMulberry) ──
function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h >>> 0;
}
export function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** 7-day buckets since the epoch (same as 2D). */
export const questWeek = () => Math.floor(Math.floor(now() / 86400000) / 7);
let activeCache = null, activeWk = -1;
export function questActiveIds() {
    const wk = questWeek();
    if (activeCache && activeWk === wk) return activeCache;
    const rng = mulberry(hashStr("luluQuestsWk" + wk));
    const pool = QUEST_POOL.map(q => q.id), ids = [];
    for (let p = 0; p < 3 && pool.length; p++) ids.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    activeCache = ids; activeWk = wk;
    return ids;
}
export const questIsActive = id => questActiveIds().includes(id);

// ── lifetime score (cached from the shared save; refreshed on every write) ──
let lifeCache = null;
const lifeOf = s => (s.lifetimeScore || 0) || ((s.highScore || 0) > 0 ? s.highScore : 0);
on("shared:changed", s => { if (s) lifeCache = lifeOf(s); });
export function lifetimeScore() { if (lifeCache == null) lifeCache = lifeOf(shared.get()); return lifeCache; }
export const questsUnlocked = () => lifetimeScore() >= QUEST_UNLOCK;
/** Re-read the shared save (a 2D tab may have played meanwhile) — after writing ours. */
export function refreshFromSave() {
    if (qTimer || qDirty) persistQuests();
    lifeCache = lifeOf(shared.get());
    QS = null;
}

// ── the live weekly state, auto-rolled-over (cached; written back batched) ──
let QS = null, qTimer = 0, qDirty = false;
function normQ(q, wk) {
    if (!q || typeof q !== "object" || q.week !== wk) q = { week: wk, prog: {}, best: {}, claimed: {}, notified: {} };
    for (const k of ["prog", "best", "claimed", "notified"]) if (!q[k] || typeof q[k] !== "object") q[k] = {};
    return q;
}
export function questState() {
    const wk = questWeek();
    if (!QS || QS.week !== wk) {
        const s = shared.get();
        const fresh = !s.quests || s.quests.week !== wk;
        QS = normQ(s.quests ? structuredClone(s.quests) : null, wk);
        if (fresh && questsUnlocked()) persistSoon(0);   // a weekly rollover persists (like the 2D menu)
    }
    return QS;
}
function persistSoon(ms = 900) {
    if (qTimer) return;
    qTimer = setTimeout(persistQuests, ms);
}
/** Merge our quest progress into the shared save (max / OR, so a 2D tab never loses progress). */
export function persistQuests() {
    clearTimeout(qTimer); qTimer = 0; qDirty = false;
    const mine = QS;
    if (!mine) return;
    if (mine.week !== questWeek()) { QS = null; return; }
    shared.update(s => {
        const q = normQ(s.quests, mine.week);
        for (const k of ["prog", "best"]) for (const id in mine[k]) q[k][id] = Math.max(q[k][id] || 0, mine[k][id] || 0);
        for (const k of ["claimed", "notified"]) for (const id in mine[k]) if (mine[k][id]) q[k][id] = true;
        s.quests = q;
        QS = structuredClone(q);
    });
}

export function questValue(id) {
    const def = questDef(id);
    if (!def) return 0;
    const q = questState();
    return def.scope === "run" ? (q.best[id] || 0) : (q.prog[id] || 0);
}
export const questComplete = id => { const d = questDef(id); return !!d && questValue(id) >= d.target; };
export const questClaimed = id => !!questState().claimed[id];
export function questAnyClaimable() {
    if (!questsUnlocked()) return false;
    return questActiveIds().some(id => questComplete(id) && !questClaimed(id));
}
/** "Xd Yh" until the next weekly reset. */
export function questCountdown() {
    const ms = Math.max(0, (questWeek() + 1) * 7 * 86400000 - now());
    if (ms < 3600000) return `${Math.max(1, Math.ceil(ms / 60000))}m`;
    return `${Math.floor(ms / 86400000)}d ${Math.floor((ms % 86400000) / 3600000)}h`;
}

// Completion celebration — once per quest per week (the notified flag).
function fireComplete(id) {
    const q = questState();
    if (q.notified[id]) return;
    q.notified[id] = true;
    note("📜 QUEST COMPLETE — claim it in the menu!", "gold");
    chime([659, 880, 1175], 0.11, 0.22);
    emit("quest:complete", { id, def: questDef(id) });
    persistSoon(0);
}

/** WEEK-scope progress + the scrapbook's lifetime counter (ticks even while quests are locked). */
export function questAdd(id, n = 1) {
    if (!id || !(n > 0)) return;
    shared.stat(id, n);
    if (!questIsActive(id) || !questsUnlocked()) return;
    const def = questDef(id);
    if (!def || def.scope !== "week") return;
    const q = questState();
    if (q.claimed[id]) return;
    const before = q.prog[id] || 0;
    if (before >= def.target) return;
    q.prog[id] = before + n;
    if (q.prog[id] >= def.target) fireComplete(id);
    persistSoon();
}
/** RUN-scope best + the scrapbook's all-time best. */
export function questBest(id, v) {
    if (!id || !(v > 0)) return;
    shared.best(id, v);
    if (!questIsActive(id) || !questsUnlocked()) return;
    const def = questDef(id);
    if (!def || def.scope !== "run") return;
    const q = questState();
    const before = q.best[id] || 0;
    if (v <= before) return;
    q.best[id] = v;
    qDirty = true;
    if (v >= def.target && before < def.target) fireComplete(id);
}

/** Claim a finished quest: coins into the shared wallet, marked claimed (one atomic write). */
export function claimQuest(id) {
    const def = questDef(id);
    if (!def || !questsUnlocked() || !questComplete(id) || questClaimed(id)) return false;
    persistQuests();
    flushShared();
    let ok = false;
    const wk = questWeek();
    shared.update(s => {
        const q = normQ(s.quests, wk);
        if (q.claimed[id]) return;
        q.claimed[id] = true;
        s.quests = q;
        s.totalCoins = Math.max(0, s.totalCoins || 0) + def.reward;
        ok = true;
        QS = structuredClone(q);
    });
    if (ok) { emit("wallet", { delta: def.reward }); emit("quest:claim", { id, reward: def.reward }); }
    return ok;
}

// ══ feeding the stats from the game ════════════════════════════════════════
// Every feature reports lifetime things with emit("stat", { id, n }) using the
// 2D ids (escapes2, parks3, uncles3, missiles8, tolls4, heshy2, avigail3,
// footDist, imaCalls, imaDeclines, weddings, salon, dismissed…). Pass
// { id, best: v } for an all-time best instead of a counter. footDist is in
// METRES walked (we convert to 2D units) unless the payload says { px: true }.
let footAcc = 0;
on("stat", e => {
    if (!e || !e.id) return;
    if (e.best != null) { questBest(e.id, +e.best || 0); return; }
    let n = e.n == null ? 1 : +e.n;
    if (!(n > 0)) return;
    if (e.id === "footDist" && !e.px) {
        footAcc += n * PX_PER_M;
        n = Math.floor(footAcc);
        footAcc -= n;
        if (n < 1) return;
    }
    questAdd(e.id, n);
});

// ── core events → the 2D ids ──────────────────────────────────────────────
on("closeCall", e => { if (e && e.combo) questBest("chain6", e.combo); });   // 😤 Daredevil (nearChain)
on("boost", () => questAdd("boosts3d", 1));
on("speedTrap", e => { if (e && !e.ticketed && e.mph > 5) questAdd("legalTraps3d", 1); });
on("heart", e => questAdd("hearts3d", (e && e.n) || 1));

// 📣 honk-scares: core's traffic moves the car ahead out of Lulu's lane on a
// honk (no event for it), so snapshot the lanes at the honk and see who moved
// over by the end of the same frame (honk-moved cars get a 4 s lane cooldown).
let honkSnap = null, honkFrame = -1;
on("honk", () => {
    if (!ctx.traffic) return;
    honkSnap = [];
    for (const c of ctx.traffic.cars) if (c.dir > 0 && !c.ai) honkSnap.push([c, c.dTarget]);
    honkFrame = ctx.frames;
});
hook("update", () => {
    if (!honkSnap) return;
    if (ctx.frames === honkFrame) {
        for (const [c, d] of honkSnap) {
            if (c.dTarget !== d && c.laneCooldown > 3.5 && c.laneCooldown <= 4.001) { questAdd("honks10", 1); break; }
        }
    }
    honkSnap = null;
});

// ── run end: bank lifetime score (unlock progress) + the run-scope quests ──
on("run:end", ({ score = 0, G = ctx.G } = {}) => {
    questBest("runCoins250", G.coins || 0);
    questBest("dist25k", Math.floor(Math.max(0, G.distance || 0) * PX_PER_M));
    const wasLocked = !questsUnlocked();
    shared.update(s => { s.lifetimeScore = lifeOf(s) + Math.max(0, Math.floor(score)); });
    if (questsUnlocked()) persistQuests();
    if (wasLocked && questsUnlocked()) {
        note("📜 WEEKLY QUESTS UNLOCKED! Check the title menu.", "gold");
        chime([523, 659, 784, 1047], 0.12, 0.2);
    }
    emit("meta:banked", { score });
});

// ── daily streak: the FIRST run of each day pays 25 × streak (capped ×7) ──
let streakEl = null, streakUntil = 0;
/** Our HUD stack on touch screens (core's centre slot sits under the touch speed pill / trip bar there). */
export function metaHudBox() {
    let box = document.getElementById("metaTutBox");
    if (!box) { box = document.createElement("div"); box.id = "metaTutBox"; document.getElementById("hud").appendChild(box); }
    return box;
}
function showStreak(streak, pay) {
    const slot = input.device === "touch" ? metaHudBox() : H.hudSlot("center");
    if (streakEl) streakEl.remove();
    streakEl = document.createElement("div");
    streakEl.className = "meta-streak";
    streakEl.innerHTML = `<b>🔥 Day ${streak} streak! +${pay} <span class="coin"></span></b>` +
        (streak >= 2 ? `<small>come back tomorrow for more!</small>` : `<small>play again tomorrow to grow it!</small>`);
    slot.prepend(streakEl);
    streakUntil = ctx.time + 6.5;   // game time: covers the 3-2-1 and the first seconds of driving
}
hook("hud", () => {
    if (!streakEl || ctx.time < streakUntil) return;
    const el = streakEl;
    streakEl = null;
    el.classList.add("out");
    setTimeout(() => el.remove(), 500);
});
on("state", ({ to }) => { if (streakEl && !(ctx.states[to] || {}).hud) { streakEl.remove(); streakEl = null; } });
export function dayNum() { return Math.floor(now() / 86400000); }
on("run:start", () => {
    if (!ctx.enabled("meta")) return;   // a surprise payout: off in scripted test runs
    const day = dayNum();
    if (shared.get().dayNum === day) return;
    let streak = 0, pay = 0;
    shared.update(s => {
        if (s.dayNum === day) return;
        s.streak = s.dayNum === day - 1 ? (s.streak || 0) + 1 : 1;
        s.dayNum = day;
        streak = s.streak;
        pay = 25 * Math.min(streak, 7);
    });
    if (!pay) return;
    wallet.add(pay);
    showStreak(streak, pay);
    tone(784, 0.1, "triangle", 0.16, 0.3); tone(1046, 0.14, "triangle", 0.16, 0.42);
    emit("streak", { streak, pay });
});

export { fmt };
