// ─────────────────────────────────────────────────────────────────────────
//  features/hustle — SIDE HUSTLES: GTA-style side jobs + the car radio.
//
//   jobs.js      the framework: one active job, its objective line + distance chip
//                (HUD, only during a job), the beacon, pass / fail / quit, the card
//   cab.js       🚕 LULU CAB — a shift of fares with personalities (the late groom,
//                Gertie the chicken, the influencer, Mr. Katz, "follow that car!")
//   getaway.js   💰 THE GETAWAY — Uncle's crew, the bingo hall, ★★★ via ctx.law,
//                the safehouse (+ the skippable heist-exit cutscene "hustleHeist")
//   delivery.js  🔥 HOT DELIVERY — cholent / kugel / pizza: 🔥 heat + 💦 spill, reviews
//   markers.js   payphones + the HELP WANTED board on the shoulder, phone offers, when
//   radio.js     📻 the car radio: 4 stations + off, DJ chatter / parody ads / call-ins
//   rider.js     getting in and out of the car (ONE eased move each; roadevents' seat)
//   beacon.js    the soft light column + ground ring (pooled, shared materials)
//   log.js       the 💼 Side Jobs log (📒 Scrapbook group) + lifetime records
//   ui.js · sfx.js · util.js · data.js (all the text, payouts and tuning)
//
//  Service: ctx.hustle (see the bottom). Events: hustle:start {id, via},
//  hustle:end {id, result, why, pay}, hustle:heist, hustle:bag {lost},
//  hustle:radio {station}; lifetime stats via emit("stat") (hustleJobs, hustleFares,
//  hustleHeists, hustleDeliveries, hustleCash + best hustle_fares / _streak / _take / _stars).
//  Random offers + radio chatter are gated by ctx.enabled("hustle"). In a 🎉 party: party.js (seeded payphones).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, addMenuItem } from "../../core/ctx.js";
import { resume } from "../../core/screens.js";
import { J, startJob, finishJob, abandonJob, jobsTick, registerJob } from "./jobs.js";
import { M, offersTick, spawnMarker, phoneOffer, clearMarker, offerCooldown } from "./markers.js";
import { radio, radioTick } from "./radio.js";
import { updateBeacons, hideBeacons, beacons } from "./beacon.js";
import { updateOwnSeat, clearOwnSeat } from "./rider.js";
import { cabHold } from "./cab.js";
import "./getaway.js";
import "./delivery.js";
import { LOG, openLog } from "./log.js";
import { jobHud, tickerGone } from "./ui.js";
import { rand } from "./util.js";
import { TUNE, JOBS } from "./data.js";
import { partyDebug } from "./party.js";

// ── per frame ─────────────────────────────────────────────────────────────
hook("update", (dt, P, controlsOn) => {
    try { radioTick(dt, P); } catch (e) { console.error("[hustle] radio", e); }
    updateBeacons(dt);
    updateOwnSeat(dt);
    jobsTick(dt, P);
    if (ctx.state === "playing") offersTick(dt, controlsOn);
}, -5);
hook("controls", ctl => cabHold(ctl), 2);

// ── lifecycle ─────────────────────────────────────────────────────────────
hook("runStart", () => {
    abandonJob();
    clearMarker();
    hideBeacons();
    clearOwnSeat();
    jobHud(null);
    M.offering = false;
    M.t = rand(...TUNE.firstOffer);
});
on("state", ({ to }) => {
    if (to === "title") { clearMarker(); hideBeacons(); clearOwnSeat(); jobHud(null); tickerGone(); M.offering = false; }
    // the job HUD only shows while she's driving (the card / cutscenes / scenes hide it)
    if (to !== "playing" && to !== "intro") jobHud(null);
});

// ── 📻 input: controller View / Create · keyboard T · tap the ticker (radio.js) — and the
// 📻 Radio app on Lulu's 📱 phone (features/phone), which replaced the touch chip and the pause item.
addMenuItem("pause", {
    id: "hustleQuit", order: 78, group: "exit",
    label: () => `💼 Quit job${J.job ? ` (${J.job.def.emoji})` : ""}`,
    visible: () => !!J.job,
    action: () => { resume(); finishJob("quit", "quit"); },
});

// ── the service ───────────────────────────────────────────────────────────
const EXTRA = new Map();      // job id → listed() (register)
ctx.hustle = {
    /** The active job ({ id: "cab" | "getaway" | "delivery", phase, … }) or null. */
    get job() { return J.job; },
    /** Start a job now (Lulu must be driving): opts { via, fares: [ids] (cab), food: id (delivery), dist }. */
    start: (id, opts) => startJob(id, opts),
    /** End the active job: "pass" | "fail" | "quit". */
    end: (result = "quit", why = "") => finishJob(result, why),
    /** Offer a job: kind "marker" (payphone / board up the road) or "phone" (a call). */
    offer(id, kind = "marker", opts = {}) { return kind === "phone" ? phoneOffer(id) : spawnMarker(id, opts); },
    get marker() { const m = M.marker; return m ? { jobId: m.jobId, kind: m.kind, s: m.s, pad: m.pad, done: m.done } : null; },
    /** Hold off random offers for `s` seconds. */
    hold(s = 60) { offerCooldown(s); },
    /**
     * Another feature's job type (features/underworld's fixer): create(opts) → a job (see jobs.js), def = the JOBS row
     * ({ id, emoji, name, color, from, fromEmoji, blurb }). opts.listed() → true while the 💼 Jobs app should list it.
     * Payphones / the HELP WANTED board offer it through offer(id, "marker"); its own feature decides when.
     */
    register(id, create, def, { listed = null } = {}) {
        if (!id || typeof create !== "function" || !def) return false;
        JOBS[id] = Object.assign({ id }, def);
        registerJob(id, create);
        EXTRA.set(id, listed);
        return true;
    },
    /** The registered extra job ids the 💼 Jobs app lists right now. */
    listed() { return [...EXTRA].filter(([, fn]) => { try { return !fn || !!fn(); } catch (e) { return false; } }).map(([id]) => id); },
    radio,
    log: LOG,
    openLog,
    /** Tests / debug: internals. */
    _dbg: { J, M, beacons, get pending() { return J.pending; }, get hist() { return J.hist.slice(); }, party: partyDebug },
};
