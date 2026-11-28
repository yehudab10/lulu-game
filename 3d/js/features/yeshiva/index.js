// features/yeshiva — 🎓 BEIS MEDRASH GADOL HAMINIVAN (roadmap 45; the owner, 2026-11-27: "a parody of BMG… a huge yeshiva in
// Lakewood with a nice building both inside and out and it's packed with bochrim who are startled when Lulu a girl walks into
// the building… LSD — Lakewood staring disorder… OTD npcs that hang out in certain places").
//
// The campus is Lakewood town DATA (`uses.campus`: a code-built hall + dorm wing + car park, models.js; block "2,3" south face
// on Minivan Way, across from the precinct). Its front door is a walk-in (ci/doors: no ✋, no fade); the room is room.js (the
// reaction wave, the bochurim, the parody shiur, the errand); stare.js is L.S.D. in the streets, otd.js the OTD guys.
// Warm, jokes about PEOPLE; nothing holy is a prop or a punchline; nobody is ever hurt, thrown out or humiliated; no coins.
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import "./models.js";
import { yeshivaDef, plan, force, SAVE } from "./room.js";
import { NAMES, PASS } from "./data.js";
import { ST, talk, contest, nearNpc, scan, wanted } from "./street.js";

const inTown = () => !!(ctx.town && ctx.town.active);
const here = () => inTown() && ctx.town.id === "lakewood";
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
const C = { said: false, t: 0, doorsAt: 0, outAt: null };

/** The campus's front door (world coords) in Lakewood, or null. */
function spot() { return here() && ctx.town.spot ? ctx.town.spot("campus") : null; }
function canWalkIn() {
    if (C.outAt) {                                      // (she just came OUT: a ✕ still being mashed mustn't walk her straight back in)
        const p = herPos();
        if (ctx.time < C.doorsAt && p && Math.hypot(p.x - C.outAt.x, p.z - C.outAt.z) < 4) return false;
        C.outAt = null;
    }
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (!here() || (party && !roam) || !ctx.interiors || !ctx.interiors.yeshiva) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
function doorPos() {
    if (!canWalkIn()) return null;
    const sp = spot(), p = herPos();
    if (!sp || !p) return null;
    if (Math.hypot(sp.x - p.x, sp.z - p.z) < 28) ctx.interiors.yeshiva.warm();      // (walking up to it: the inside loads now → no black screen)
    return sp;
}
function doorRef(sp) {
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    return { id: "yeshiva", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
}
/** Walk in through the campus's front door. → bool */
export function enter() {
    const sp = spot();
    if (!sp || !ctx.interiors || !ctx.interiors.yeshiva) return false;
    yeshivaDef.tagline = NAMES.tagline[plan().key] || NAMES.tagline.weekday;
    const dr = doorRef(sp);
    emit("stat", { id: "yeshivaVisits", n: 1 });
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: dr }); };
    return ctx.interiors.yeshiva.enter({ exit, door: "yeshiva", from: "foot" });
}

on("boot", () => {
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({ pos: doorPos, r: 2.6, door: true, walkIn: { id: "yeshiva" }, label: () => "🎓 ENTER THE YESHIVA", short: "YESHIVA", act: () => enter() });
    // on the 📱 🗺️ Map (ci/hud's ctx.pins: a new place registers itself)
    if (ctx.pins && ctx.pins.add) ctx.pins.add({ id: "campus", name: NAMES.name, icon: "🎓", cat: "town", town: "lakewood", spot: "campus", sub: "the big yeshiva · hats · coffee · a shiur" });
});
on("interior:exit", e => { if (e && e.id === "yeshiva") { const p = herPos(); C.doorsAt = ctx.time + 8; C.outAt = p ? { x: p.x, z: p.z } : null; C.said = true; } });
on("town:enter", () => { C.said = false; });
on("town:leave", () => { C.said = false; });
hook("hud", dt => {                                      // walking past: one light line per visit
    try {
        if ((C.t += dt) < 0.6) return;
        C.t = 0;
        if (C.said || !here() || !(ctx.foot && ctx.foot.active) || ctx.state !== "footRun") return;
        const sp = spot(), p = herPos(), o = ctx.foot.obj;
        if (sp && p && Math.hypot(sp.x - p.x, sp.z - p.z) < 14) {
            C.said = true;
            if (o && ctx.foot.say && Math.random() < 0.6) ctx.foot.say(o, PASS[Math.floor(Math.random() * PASS.length)], 2.8);
        }
    } catch (e) { console.error("[yeshiva] pass", e); }
});

/** ctx.yeshiva — the door, what's on inside right now, and the errand's state (tests). */
ctx.yeshiva = {
    spot, enter, plan,
    get here() { return !!spot(); },
    get staring() { return ST.n; },
    debug: { force, SAVE, C, def: yeshivaDef, ST, talk, contest, nearNpc, scan, wanted },
};
