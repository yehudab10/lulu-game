// features/hustle — the 💼 Side Jobs log: lifetime counts and records (3D save,
// store("hustle")), the last few jobs, and its screen in the 📒 Scrapbook group.
// Lifetime stats ALSO go out as emit("stat", …) so meta feeds the shared scrapbook.
import { ctx, emit, addMenuItem } from "../../core/ctx.js";
import { saveSoon, store } from "../../core/save.js";
import { showTitle } from "../../core/screens.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { JOBS } from "./data.js";
import { esc } from "./ui.js";

export const LOG = store("hustle", {
    jobs: 0, passed: 0, failed: 0, earned: 0,
    by: { cab: { n: 0, pass: 0 }, getaway: { n: 0, pass: 0 }, delivery: { n: 0, pass: 0 } },
    best: { fares: 0, streak: 0, take: 0, stars: 0 },
    recent: [],
});

/** Book a finished job (called by jobs.finishJob). */
export function record(sum) {
    if (!sum || !sum.id) return;
    const by = LOG.by[sum.id] || (LOG.by[sum.id] = { n: 0, pass: 0 });
    if (sum.result !== "quit") { LOG.jobs++; by.n++; }
    if (sum.result === "pass") { LOG.passed++; by.pass++; }
    if (sum.result === "fail") LOG.failed++;
    LOG.earned += Math.max(0, sum.pay || 0);
    if (sum.best) for (const [k, v] of Object.entries(sum.best)) {
        if (v > (LOG.best[k] || 0)) LOG.best[k] = v;
        emit("stat", { id: "hustle_" + k, best: v });
    }
    if (sum.pay > 0) emit("stat", { id: "hustleCash", n: sum.pay });
    const d = JOBS[sum.id];
    LOG.recent.unshift({ id: sum.id, r: sum.result, pay: sum.pay || 0, line: sum.logLine || (d ? d.name : sum.id), at: Date.now() });
    if (LOG.recent.length > 8) LOG.recent.length = 8;
    saveSoon();
}

// ── the screen ───────────────────────────────────────────────────────────
function html() {
    const cell = (v, l) => `<div class="cell"><b>${v}</b><span>${l}</span></div>`;
    const jobs = Object.values(JOBS).map(d => {
        const b = LOG.by[d.id] || { n: 0, pass: 0 };
        const best = d.id === "cab" ? `best shift: ${LOG.best.fares || 0} fares · streak ×${LOG.best.streak || 0}`
            : d.id === "getaway" ? `best take: ${LOG.best.take || 0} 💰` : `best review: ${"★".repeat(LOG.best.stars || 0) || "—"}`;
        return `<div class="job" style="--acc:${d.color}"><div class="t">${d.emoji} ${d.name}</div>${b.pass}/${b.n} done<br><small>${best}</small></div>`;
    }).join("");
    const recent = LOG.recent.length ? LOG.recent.map(r => {
        const d = JOBS[r.id] || { emoji: "💼" };
        return `<div>${r.r === "pass" ? "✅" : r.r === "fail" ? "❌" : "↩️"} ${d.emoji} ${esc(r.line)}${r.pay ? ` · <b>+${r.pay} 💰</b>` : ""}</div>`;
    }).join("") : `<div>Nothing yet — in 🛣️ Cruise, look for a ringing ☎️ payphone or a 📋 HELP WANTED board on the shoulder, or wait for a call.</div>`;
    return `<div class="hs-log"><h2>💼 Side Jobs</h2>
        <div class="grid">${cell(LOG.passed, "JOBS DONE")}${cell(LOG.earned.toLocaleString(), "COINS EARNED")}${cell(LOG.failed, "JOBS BOTCHED")}</div>
        <div class="jobs">${jobs}</div>
        <div class="recent">${recent}</div>
        <p class="how">Drive into a glowing marker to take a job · quit one from the pause menu · 📻 ${glyph("radio")} changes the station.</p></div>`;
}
export function openLog(from = "title") {
    const back = () => { if (from === "title" && ctx.state === "title") showTitle(true); else H.hideScreen(); };
    H.showScreen(html(), [{ label: `⬅ Back ${glyph("back")}`, cls: "alt", action: back }], { onBack: back, wide: true, cls: "hs-logcard" });
}

addMenuItem("title", {
    id: "hustleJobs", order: 57, group: "book", short: "Jobs", label: "💼 Side Jobs",
    sub: () => LOG.jobs ? `${LOG.passed} done, ${LOG.earned.toLocaleString()} coins earned` : "Cab rides, getaways and deliveries",
    action: () => openLog("title"),
});
