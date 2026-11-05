// features/meta — SCRAPBOOK, BADGES, WEEKLY QUESTS, DAILY STREAK, HOLIDAYS & the
// FIRST-DRIVE TUTORIAL (ports of src/06c-scrapbook.js, 06b-quests.js,
// 06e-holidays.js, 10g-tutorial.js + the streak / lifetime-score banking).
//
//   progress.js  lifetime stats (shared save.stats), weekly quests, run banking, streak
//   badges.js    BADGES + sync (shared save.badges / scrapSeen)
//   holidays.js  Hebrew-calendar holidays: title greeting, daily gift, 3D car decor, grogger
//   tutorial.js  learn-by-doing first drive (HUD card, non-modal, skippable)
//   screens.js   📒 scrapbook (tabbed) + 📜 quest board + save-code backup
//   portraits.js 3D Polaroids of the cast for the scrapbook pages
//
// Service for other features (always null-check: `if (ctx.meta) …`):
//   ctx.meta.stat(id, n) / best(id, v)   same as emit("stat", {id, n}) / {id, best}
//   ctx.meta.holiday() → {h, dayNum, key} | null · isHoliday(id) · holidayHat() → Promise<Object3D|null>
//   ctx.meta.calm()   → true while the first-drive tutorial runs (keep ambient cop heat off)
//   ctx.meta.openScrapbook(from) / openQuests(from)   ("title" | "pause")
// Events emitted: quest:complete {id} · quest:claim {id, reward} · streak {streak, pay} ·
//   holiday:gift {id, gift} · tutorial:done {skipped} · meta:banked {score}
import { ctx, on, hook, addMenuItem } from "../../core/ctx.js";
import { input } from "../../input.js";
import { shared, save3d, saveNow } from "../../core/save.js";
import { showTitle } from "../../core/screens.js";
import "./style.js";
import { fmt, metaToast, chime } from "./util.js";
import {
    questAdd, questBest, questsUnlocked, questAnyClaimable, lifetimeScore, QUEST_UNLOCK, dayNum, refreshFromSave,
} from "./progress.js";
import { badgeSync, badgeTotals, scrapHasNew } from "./badges.js";
import { currentHoliday, holidayIs, holidayHat, holidayGiftTick } from "./holidays.js";
import { tutorialCalm, tutorialActive, tutState } from "./tutorial.js";
import { openScrapbook, openQuests } from "./screens.js";

ctx.meta = {
    stat: (id, n = 1) => questAdd(id, n),
    best: (id, v) => questBest(id, v),
    holiday: () => currentHoliday(),
    isHoliday: id => holidayIs(id),
    holidayHat,
    calm: () => tutorialCalm(),
    get tutorial() { return tutorialActive(); },
    openScrapbook, openQuests,
    _tut: () => tutState(),
};

// ── 3D progress that arrived inside a save code restored in the 2D game ────
// (a fresh device that has never run 3D: adopt it once, then reload)
try {
    if (ctx.enabled("meta") && !localStorage.getItem("lulu3dSave") && !sessionStorage.getItem("metaAdopted")) {
        const s = shared.get();
        if (s.lulu3d && typeof s.lulu3d === "object" && !Array.isArray(s.lulu3d)) {
            sessionStorage.setItem("metaAdopted", "1");
            const settings = save3d.settings;
            for (const k of Object.keys(save3d)) delete save3d[k];
            Object.assign(save3d, s.lulu3d, { settings });
            saveNow();
            location.reload();
        }
    }
} catch (e) { console.warn("[meta] adopt 3D save", e); }

// ── title screen ─────────────────────────────────────────────────────────
addMenuItem("title", {
    id: "metaScrapbook", order: 50, cls: "alt",
    label: () => {
        const S = shared.get(), t = badgeTotals(S);
        return `📒 Scrapbook <span class="meta-chip">🏆 ${t.got}/${t.tot}</span>${scrapHasNew(S) ? '<span class="meta-dot">!</span>' : ""}`;
    },
    action: () => openScrapbook("title"),
});
addMenuItem("title", {
    id: "metaQuests", order: 55, cls: "purple",
    label: () => {
        if (!questsUnlocked()) return `📜 Quests <span class="meta-chip">🔒 ${Math.floor(Math.min(1, lifetimeScore() / QUEST_UNLOCK) * 100)}%</span>`;
        return `📜 Weekly Quests${questAnyClaimable() ? '<span class="meta-dot gold">!</span>' : ""}`;
    },
    action: () => openQuests("title"),
});
// the streak nudge on the title card
addMenuItem("titleInfo", {
    id: "metaStreak", order: 6,
    visible: () => { const S = shared.get(); return (S.streak || 0) > 0 && (S.dayNum === dayNum() || S.dayNum === dayNum() - 1); },
    label: () => {
        const S = shared.get(), today = S.dayNum === dayNum();
        return `<div class="meta-line">🔥 ${S.streak}-day streak${today ? "!" : ` — drive today for +${25 * Math.min((S.streak || 0) + 1, 7)} 💰`}</div>`;
    },
});

// ── pause menu ───────────────────────────────────────────────────────────
addMenuItem("pause", { id: "metaPauseScrap", order: 40, label: "📒 Scrapbook", action: () => openScrapbook("pause") });
addMenuItem("pause", { id: "metaPauseQuests", order: 45, cls: "purple",
    label: () => `📜 Quests${questAnyClaimable() ? '<span class="meta-dot gold">!</span>' : ""}`, action: () => openQuests("pause") });

// ── badge toasts (title + run end) and the holiday gift ──────────────────
function toastBadges() {
    const fresh = badgeSync();
    if (!fresh.length || !ctx.enabled("meta")) return false;   // record always; toast only for real players / our tests
    metaToast(`🏆 New badge: ${fresh[0].icon} ${fresh[0].name}${fresh.length > 1 ? ` +${fresh.length - 1} more` : ""}!`, "", 3);
    chime([784, 1046], 0.11, 0.2);
    return true;
}
on("title", () => {
    refreshFromSave();
    const got = toastBadges();
    const gift = holidayGiftTick();
    if ((got || gift) && ctx.state === "title") showTitle(true);   // refresh the 📒 dot / coin count
});
on("run:end", () => { setTimeout(toastBadges, 400); });

// the touchpad / View / Tab ("map · scrapbook") opens the scrapbook from the title and the pause menu
function mapButton() {
    if (!input.pressed.map || ctx.dialogOpen) return;
    const ours = document.body.classList.contains("meta-open");
    if (ctx.state === "title" && !ours) openScrapbook("title");
    else if (ctx.paused && !ours) openScrapbook("pause");
}
hook("titleCamera", () => { mapButton(); return false; }, 999);
hook("hud", () => { if (ctx.paused) mapButton(); });

// keep the centred-scrapbook layout class only while one of our cards is up
{
    const card = document.getElementById("screenCard"), screen = document.getElementById("screen");
    if (card && screen) {
        const sync = () => {
            const mine = !screen.classList.contains("hidden") && (card.classList.contains("meta-book") || card.classList.contains("meta-quests"));
            document.body.classList.toggle("meta-open", mine);
        };
        const mo = new MutationObserver(sync);
        mo.observe(card, { attributes: true, attributeFilter: ["class"] });
        mo.observe(screen, { attributes: true, attributeFilter: ["class"] });
    }
}

export { fmt };
