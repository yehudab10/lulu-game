// ▶ PLAY always starts at home (roadmap 37e follow-up). Measured (scripts/perfstart.js): on a slow phone connection the
// home town's models arrive long after the title is up, and a ▶ PLAY pressed before that silently started a plain
// drive (world/depart.js: no home ready → the plain countdown). Now, when the home start isn't ready yet, ▶ PLAY waits
// on the title and says so on its own tile — "Getting your street ready… 62%" (the home town's models that are in, out
// of the ones it needs; the last step is building the street) — and starts the moment it's ready. Tap it again to stop
// waiting. If a download fails (offline), it says so and the next tap tries again. Nothing waits when no home start
// applies (a party, the world switched off in a test).
//
//   ctx.playGate(start)    core/screens.js' ▶ PLAY calls it: start() now, or once the home start is ready
import { ctx, on } from "../../core/ctx.js";
import { models } from "../../models.js";
import { home } from "../world/home.js";

const PG = { waiting: false, start: null, failed: false, pct: 0, lastPct: -1, lastMove: 0, raf: 0 };
const STALL_MS = 60000;            // no progress for this long while waiting → treat it as failed (offline, a stuck fetch)

/** The home town's id (where her house is), or null when home isn't in a town. */
function homeTown() { const h = ctx.town && ctx.town.home; return h && h.town ? h.town : null; }

/** Would ▶ PLAY start her at home right now? (world/depart.js wantsDeparture + enterHomeTown's needs) */
export function homeStartReady() {
    if (!ctx.enabled("world") || (ctx.party && ctx.party.active)) return true;        // (no home start applies: go)
    if (!home.ready) return false;
    if (home.site !== "town") return true;
    return !!(ctx.town && ctx.town.loaded && ctx.town.loaded(home.town));
}
/** Does a home start apply at all? (no town engine in this page → the street home builds on its own) */
function gateApplies() { return ctx.enabled("world") && !(ctx.party && ctx.party.active) && !!ctx.town && ctx.enabled("town") && !!homeTown(); }

/** 0–100: the home town's models that are in (≤ 90), then the street being built (100 when ready). */
function progress() {
    const id = homeTown(), T = ctx.town;
    const needs = id && T && T.needs ? T.needs(id) : [];
    const got = needs.filter(k => models[k]).length;
    const m = needs.length ? got / needs.length : 1;
    return homeStartReady() ? 100 : Math.min(99, Math.round(m * 90 + (m >= 1 ? 5 : 0)));
}
function failed() { const S = ctx.town && ctx.town.debug && ctx.town.debug.S; return !!(S && S.failed); }

function line(html) {
    const sub = document.querySelector("#screenCard #play .t-s");
    if (sub) sub.innerHTML = html;
}
function stop(msg = null) {
    PG.waiting = false; PG.start = null;
    cancelAnimationFrame(PG.raf);
    document.body.classList.remove("play-wait");
    if (msg != null) line(msg);
}
function tick() {
    if (!PG.waiting) return;
    if (ctx.state !== "title") { stop(); return; }
    PG.raf = requestAnimationFrame(tick);
    if (homeStartReady()) { const go = PG.start; stop(); if (go) go(); return; }
    const now = performance.now();
    PG.pct = progress();
    if (PG.pct !== PG.lastPct) { PG.lastPct = PG.pct; PG.lastMove = now; }
    if (failed() || now - PG.lastMove > STALL_MS) {
        PG.failed = true;
        stop("Couldn't load your street. Check your connection, then tap ▶ PLAY to try again.");
        return;
    }
    line(`⏳ Getting your street ready… ${PG.pct}% · tap again to stop`);
}

ctx.playGate = start => {
    if (PG.waiting) { stop("Stopped. Tap ▶ PLAY when you're ready."); return; }          // (a second tap: stop waiting)
    if (!gateApplies() || homeStartReady()) { start(); return; }
    // (a retry after a failed download: ask the town again — its last load gave up)
    if (PG.failed || failed()) { PG.failed = false; const id = homeTown(); if (id && ctx.town.load) ctx.town.load(id); }
    PG.waiting = true; PG.start = start; PG.lastPct = -1; PG.lastMove = performance.now();
    document.body.classList.add("play-wait");
    tick();
};
ctx.playGateInfo = () => ({ waiting: PG.waiting, pct: PG.pct, failed: PG.failed, ready: homeStartReady(), applies: gateApplies() });
on("run:start", () => { if (PG.waiting) stop(); });
