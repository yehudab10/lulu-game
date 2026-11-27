// features/cityhall — 🏛️ A TOWN THAT GOVERNS (BADLY) (roadmap 17; the owner: "Taxes. Banks. Annoying government
// regulation. Mayor. Protests… more corruption. More immersion.").
//
// Stage 1: CITY HALL as a real place in each town + a MAYOR in each town.
//   • the building is town DATA (`uses.cityhall` — place.js): Lakewood City Hall on Minivan Way next to the precinct +
//     court, Midwood Borough Hall on Avenue K across from them. A code-built model (models.js, merged by the town engine:
//     ~0 draw calls): a columned portico, a clock tower stuck at ten to five, flags, the mayor's statue of himself.
//   • its front door is a ✋ spot (the Places pattern: warmed from 24 m → a soft cut into the room, out by the same door);
//     the room (lobby.js, the interiors engine): the take-a-number machine (NOW SERVING 37, forever), three windows —
//     Permits · Taxes · Complaints, one always BACK IN 5 MINUTES — the notice board, the mayor's office.
//   • the mayors (fictional, no party, no real-world politics): Lakewood's Mayor Fishel Kugelman (ribbon-cutter-in-chief)
//     and Midwood's Mayor Hershel Pickleman (nobody else ran) — in their offices, on posters, and out in town cutting
//     ribbons for absurd things (ribbon.js).
//   Friends: the room is SHARED (together/rooms.js SHARED.cityhall — friends inside see each other); the ribbon cuttings
//   are local + cosmetic (each screen its own). Nothing in stage 1 pays or costs a coin.
//
// Stage 2: PROPERTY TAX + SILLY FEES + THE LIEN — tax.js (the ledger: tax on her homes per PLAYED day, a stern letter, a
//   lien), fees.js (tiny joke fees, ≤ 10 a real day), pay.js (the Taxes window + 📞 Phone › City Hall: two presses, never
//   below 0, never taken by itself), court.js (fight the lien in Courtroom 2B). Never touches who owns a home.
//
// Stage 3: PERMITS + INSPECTORS — permits.js (a tenant / a change outside → a quiet note; the errand: a form at PERMITS,
//   a stamp at TAXES, back to PERMITS — granted; nothing ever waits for one), inspect.js (crime's Inspector Pinchas — or
//   Inspector Pnina — at her homes once a real day now and then, and at the shops).
// Stage 4: PROTESTS — protest.js (a picket line about an absurd LOCAL issue in protest hours: join in with a rhythm chant).
// Stage 5: THE CORRUPTION THREAD — story.js (the expediter, the paving contract with one bid, the brother-in-law's crew;
//   expose it or take a cut; payouts once per town, capped per real day).
//
//   data.js    every word + number      models.js  the building (code-built)     place.js  the town's `uses` entry
//   state.js   the save + shared bits    lobby.js   inside (interiors engine)      ribbon.js the mayor's ribbon cuttings
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import "./models.js";
import { LOBBY_DEF, nameLobby, WIN_HOOKS } from "./lobby.js";
import { ribbonTick, ribbonReset, startRibbon, endRibbon, RB } from "./ribbon.js";
import { S, RUN, force, inTown, townId, mayorIn, closedWindow, stat } from "./state.js";
import { TOWNS, PASS } from "./data.js";
import { SHARED } from "../together/rooms.js";
import * as TAXES from "./tax.js";
import * as FEESM from "./fees.js";
import { CT } from "./court.js";
import { contactRender } from "./pay.js";
import * as PERMITS from "./permits.js";
import * as INSPECT from "./inspect.js";
import * as PROTEST from "./protest.js";
import * as STORYM from "./story.js";
import * as MAYORM from "./mayor.js";
import * as WRONG from "./wrongaddress.js";
import * as COMMENT from "./comment.js";
import * as PDAY from "./parodyday.js";

const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
const C = { said: false, t: 0, doorsAt: 0, outAt: null };

/** City hall's front door in the town she's in (world coords) or null. */
function spot() { return inTown() && ctx.town.spot ? ctx.town.spot("cityhall") : null; }
/** Can she walk in right now (not mid-chase, not in a party outside Free Roam, not just walked out)? */
function canWalkIn() {
    if (C.outAt) {                                    // (she just came OUT: a ✕ still being mashed mustn't walk her straight back in)
        const p = herPos();
        if (ctx.time < C.doorsAt && p && Math.hypot(p.x - C.outAt.x, p.z - C.outAt.z) < 4) return false;
        C.outAt = null;
    }
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (!inTown() || (party && !roam) || !ctx.interiors || !ctx.interiors.cityhall) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
function doorPos() {
    if (!canWalkIn()) return null;
    const sp = spot(), p = herPos();
    if (!sp || !p) return null;
    if (Math.hypot(sp.x - p.x, sp.z - p.z) < 24) ctx.interiors.cityhall.warm();      // (walking up: the inside loads now → a soft cut)
    return sp;          // (with its axes: the ✋ reaches across the doorway — ci/doors)
}
function doorRef(sp) {
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    return { id: "cityhall", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
}
/** Walk in through the front door. → bool */
export function enter() {
    const sp = spot();
    if (!sp || !ctx.interiors || !ctx.interiors.cityhall) return false;
    nameLobby(townId());
    const dr = doorRef(sp);
    stat("cityhallVisits");
    emit("cityhall:enter", { town: townId() });
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: dr }); };
    return ctx.interiors.cityhall.enter({ exit, door: "cityhall", from: "foot" });
}

// ── wiring ───────────────────────────────────────────────────────────────
on("boot", () => {
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({ pos: doorPos, r: 2.6, door: true, walkIn: { id: "cityhall" }, label: () => `🏛️ ENTER ${(TOWNS[townId()] || TOWNS.lakewood).short.toUpperCase()}`, short: "CITY HALL", act: () => enter() });
});
on("interior:exit", e => { if (e && e.id === "cityhall") { const p = herPos(); C.doorsAt = ctx.time + 8; C.outAt = p ? { x: p.x, z: p.z } : null; C.said = true; } });
on("town:enter", () => { C.said = false; nameLobby(townId()); });
on("town:leave", () => { C.said = false; endRibbon("town"); });
on("run:start", () => { ribbonReset(); INSPECT.inspectReset(); });
on("title", () => endRibbon("title"));
// walking past: one light line per visit; the ribbon cuttings tick here too
const TT = { t: 0 };
hook("hud", dt => {
    try { ribbonTick(dt); } catch (e) { console.error("[cityhall] ribbon", e); }
    try { if ((TT.t += dt) >= 0.5) { TT.t = 0; TAXES.taxTick(); } } catch (e) { console.error("[cityhall] tax", e); }
    try { INSPECT.inspectTick(dt); } catch (e) { console.error("[cityhall] inspect", e); }
    try { PROTEST.protestTick(dt); } catch (e) { console.error("[cityhall] protest", e); }
    try { WRONG.waTick(dt); } catch (e) { console.error("[cityhall] wrong address", e); }
    try { STORYM.storyTick(dt); } catch (e) { console.error("[cityhall] story", e); }
    try { MAYORM.mayorTick(dt); } catch (e) { console.error("[cityhall] mayor", e); }
    try {
        if ((C.t += dt) < 0.6) return;
        C.t = 0;
        if (C.said || !inTown() || !(ctx.foot && ctx.foot.active) || ctx.state !== "footRun") return;
        const sp = spot(), p = herPos(), o = ctx.foot.obj;
        if (sp && p && Math.hypot(sp.x - p.x, sp.z - p.z) < 14) {
            C.said = true;
            if (o && ctx.foot.say && Math.random() < 0.6) ctx.foot.say(o, PASS[Math.floor(Math.random() * PASS.length)], 2.8);
        }
    } catch (e) { console.error("[cityhall] pass", e); }
});
// (features/together: friends in the same town's city hall see each other inside)
SHARED.cityhall = () => (ctx.town && ctx.town.active ? ctx.town.id || "" : null);

/** ctx.cityhall — the door, walking in, the mayor, and (for later stages / tests) the window hooks. */
ctx.cityhall = {
    spot, enter, mayorIn, closedWindow,
    get here() { return !!spot(); },
    mayor: town => (TOWNS[town || townId()] || TOWNS.lakewood).mayor,
    /** A ribbon cutting is on right now: { what, town, phase, x, z } | null */
    get ribbon() { const R = RUN.ribbon; return R ? { what: R.what, town: R.town, phase: R.phase, x: R.x, z: R.z, snipped: R.snipped } : null; },
    windows: WIN_HOOKS,
    /** Stage 2 — the town's ledger: property tax, fees, the lien (tax.js / fees.js / court.js / pay.js). */
    tax: { tick: TAXES.taxTick, owed: TAXES.owed, quote: TAXES.quote, payNow: TAXES.payNow, taxToday: TAXES.taxToday, lienOn: TAXES.lienOn,
        ruleLien: TAXES.ruleLien, newDay: TAXES.newDay, addLine: TAXES.addLine, get ledger() { return TAXES.ledger; }, TX: TAXES.TX, CT },
    fees: { charge: FEESM.charge, feesToday: FEESM.feesToday, FE: FEESM.FE },
    contactRender,
    /** Stage 3 — permits (permits.js) + the inspector (inspect.js). */
    permits: { need: PERMITS.needPermit, has: PERMITS.hasPermit, open: PERMITS.openPermits, stampWindow: PERMITS.stampWindow, PM: PERMITS.PM },
    inspect: { start: INSPECT.startInspection, end: INSPECT.endInspection, inspector: INSPECT.inspector, homesHere: INSPECT.homesHere, IN: INSPECT.IN, reset: INSPECT.inspectReset },
    /** Stage 4 — protests (protest.js). */
    protest: { start: PROTEST.protestStart, stop: PROTEST.protestStop, hours: PROTEST.protestHours, topic: PROTEST.topicToday, chant: PROTEST.startChant, PR: PROTEST.PR },
    /** Roadmap 31 — Midwood's mayor (mayor.js): today's edict, striking one down, Pickleman's recount stand. */
    mayor31: { struck: id => !!MAYORM.isStruck(id), today: MAYORM.todayEdict, topic: MAYORM.edictTopic, strike: MAYORM.strike, addCase: MAYORM.addEdictCase, standStart: MAYORM.standStart, standStop: MAYORM.standStop, MY: MAYORM.MY },
    /** Roadmap 38 — the owner's two parodies (guardrails in data.js): 🪧 the wrong address (Midwood, lunchtime) + 🎤 public
     *  comment night (Lakewood City Hall, evenings). Pure day rules in parodyday.js (PD.force for tests). */
    parody: { waPlan: WRONG.waPlan, waStart: WRONG.waStart, waStop: WRONG.waStop, leaveOne: WRONG.leaveOne, buy: WRONG.buy, chant: WRONG.startChant, talk: WRONG.talk, WAS: WRONG.WAS, fill: WRONG.fill,
        pcnPlan: COMMENT.pcnPlan, mic: COMMENT.mic, CNS: COMMENT.CNS, dayOn: PDAY.dayOn, onNow: PDAY.onNow, quietDay: PDAY.quietDay, fromQuery: PDAY.fromQuery, PD: PDAY.PD },
    /** Stage 5 — the corruption thread (story.js). */
    story: { state: STORYM.story, crewStart: STORYM.crewStart, crewStop: STORYM.crewStop, usePhoto: STORYM.usePhoto, pay: STORYM.payStory, ST: STORYM.ST },
    debug: { S, RUN, force, C, RB, def: LOBBY_DEF, startRibbon, endRibbon },
};
