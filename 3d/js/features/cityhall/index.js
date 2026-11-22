// features/cityhall — 🏛️ A TOWN THAT GOVERNS (BADLY) (roadmap 17; the owner: "Taxes. Banks. Annoying government
// regulation. Mayor. Protests… more corruption. More immersion.").
//
// Stage 1 (this): CITY HALL as a real place in each town + a MAYOR in each town.
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
//   data.js    every word + number      models.js  the building (code-built)     place.js  the town's `uses` entry
//   state.js   the save + shared bits    lobby.js   inside (interiors engine)      ribbon.js the mayor's ribbon cuttings
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import "./models.js";
import { LOBBY_DEF, nameLobby, WIN_HOOKS } from "./lobby.js";
import { ribbonTick, ribbonReset, startRibbon, endRibbon, RB } from "./ribbon.js";
import { S, RUN, force, inTown, townId, mayorIn, closedWindow, stat } from "./state.js";
import { TOWNS, PASS } from "./data.js";
import { SHARED } from "../together/rooms.js";

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
    return { x: sp.x, z: sp.z };
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
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({ pos: doorPos, r: 2.6, label: () => `🏛️ ENTER ${(TOWNS[townId()] || TOWNS.lakewood).short.toUpperCase()}`, short: "CITY HALL", act: () => enter() });
});
on("interior:exit", e => { if (e && e.id === "cityhall") { const p = herPos(); C.doorsAt = ctx.time + 8; C.outAt = p ? { x: p.x, z: p.z } : null; C.said = true; } });
on("town:enter", () => { C.said = false; nameLobby(townId()); });
on("town:leave", () => { C.said = false; endRibbon("town"); });
on("run:start", () => ribbonReset());
on("title", () => endRibbon("title"));
// walking past: one light line per visit; the ribbon cuttings tick here too
hook("hud", dt => {
    try { ribbonTick(dt); } catch (e) { console.error("[cityhall] ribbon", e); }
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
    debug: { S, RUN, force, C, RB, def: LOBBY_DEF, startRibbon, endRibbon },
};
