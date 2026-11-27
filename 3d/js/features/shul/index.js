// features/shul — 🕍 A SHUL YOU CAN WALK INTO (roadmap 18; the owner, 2026-11-20: "More immersion overall through the cities… A shul?").
//
// One walk-in shul per town, on the Places pattern: the building is the town's OWN (Lakewood's yeshiva on Carpool Ln,
// Midwood's Young Israel on E 15½ St — nothing was added to the town), its front door is a ✋ ENTER spot (warmed as she
// walks up, then a soft cut: the street melts into the room, never a black loading screen), and the room (room.js) is
// built from kit pieces on the interiors engine, only when she walks in. What's going on follows the clock and the
// calendar through ctx.seasons: a weekday (mincha, a few learning, "we need a tenth"), Friday afternoon (setting up),
// Shabbos (full + quiet while they daven → kiddush after), a fast day (subdued), Yom Kippur (everyone in white),
// Chanukah (the menorah by the door).
// Tone: warm and affectionate. The jokes are about PEOPLE. Nothing holy is touched or used for a gag; no coins change
// hands inside (the candy man's lollipop — once a real day — does nothing but make her happy).
// Friends: `shul` is in together/rooms.js SHARED (a party sees each other inside). Dina's mode: untouched.
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import { shulDef, plan, poppedToday, force, SAVE } from "./room.js";
import { TOWNS, PASS, } from "./data.js";

const inTown = () => !!(ctx.town && ctx.town.active);
const townId = () => (inTown() && ctx.town.id) || "lakewood";
const cfg = () => TOWNS[townId()] || null;
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
const C = { said: false, t: 0, doorsAt: 0, outAt: null };

/** The shul's front door in the town she's in (world coords) or null. */
function spot() {
    const c = cfg();
    return c && inTown() && ctx.town.spot ? ctx.town.spot(c.spot) : null;
}
/** Is walking in possible right now (not mid-chase, not in a party outside Free Roam, nothing more urgent on ✋)? */
function canWalkIn() {
    if (C.outAt) {                                      // (she just came OUT: a ✕ still being mashed mustn't walk her straight back in)
        const p = herPos();
        if (ctx.time < C.doorsAt && p && Math.hypot(p.x - C.outAt.x, p.z - C.outAt.z) < 4) return false;
        C.outAt = null;
    }
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (!inTown() || (party && !roam) || !ctx.interiors || !ctx.interiors.shul) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
function doorPos() {
    if (!canWalkIn()) return null;
    const sp = spot(), p = herPos();
    if (!sp || !p) return null;
    if (Math.hypot(sp.x - p.x, sp.z - p.z) < 24) ctx.interiors.shul.warm();      // (walking up to it: the inside loads now → a soft cut)
    return sp;          // (with its axes: the ✋ reaches across the doorway — ci/doors)
}
function doorRef(sp) {
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    return { id: "shul", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
}
/** Walk in through the shul's front door. → bool */
export function enter() {
    const sp = spot(), c = cfg();
    if (!sp || !c || !ctx.interiors || !ctx.interiors.shul) return false;
    shulDef.name = c.name; shulDef.short = c.short; shulDef.title = c.title;
    shulDef.tagline = c.tagline[plan().kind] || "";
    ctx.interiors.shul.name = c.name;
    const dr = doorRef(sp);
    emit("stat", { id: "shulVisits", n: 1 });
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: dr }); };
    return ctx.interiors.shul.enter({ exit, door: "shul", from: "foot" });
}

// ── wiring ───────────────────────────────────────────────────────────────
on("boot", () => {
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("interior");
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot({ pos: doorPos, r: 2.6, door: true, label: () => "🕍 ENTER THE SHUL", short: "SHUL", act: () => enter() });
});
on("interior:exit", e => { if (e && e.id === "shul") { const p = herPos(); C.doorsAt = ctx.time + 8; C.outAt = p ? { x: p.x, z: p.z } : null; C.said = true; } });
on("town:enter", () => { C.said = false; });
on("town:leave", () => { C.said = false; });
// walking past: one light line per visit (nothing else outside — the building is the town's own)
hook("hud", dt => {
    try {
        if ((C.t += dt) < 0.6) return;
        C.t = 0;
        if (C.said || !inTown() || !(ctx.foot && ctx.foot.active) || ctx.state !== "footRun") return;
        const sp = spot(), p = herPos(), o = ctx.foot.obj;
        if (sp && p && Math.hypot(sp.x - p.x, sp.z - p.z) < 12) {
            C.said = true;
            if (o && ctx.foot.say && Math.random() < 0.6) ctx.foot.say(o, PASS[Math.floor(Math.random() * PASS.length)], 2.8);
        }
    } catch (e) { console.error("[shul] pass", e); }
});

/** ctx.shul — where the door is, what's going on inside right now, and the lollipop's state (tests). */
ctx.shul = {
    spot, enter, plan,
    get here() { return !!spot(); },
    get poppedToday() { return poppedToday(); },
    debug: { force, SAVE, C, def: shulDef },
};
