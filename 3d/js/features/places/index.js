// features/places — 🏛️ JAIL, COURT AND THE ER ARE REAL PLACES IN TOWN (roadmap step 4).
//
// The buildings are TOWN DATA: each town's `uses.civic` (the police precinct, its impound lot and the courthouse next
// door, sharing one block face) and `uses.hospital` place the places_* models (assets_places.py), merged by kit.js like
// any building, with their signs in the town's atlas; T.spots.precinct / .court / .hospital / .impound are their doors.
// This feature is what you DO there:
//   • walking in freely (on foot, in a town): ✋ at a door → the interiors engine, warmed as she walks up (a soft cut):
//     the precinct = interiors' "police" (Officer Pomerantz, the holding cell, the MOST WANTED board, the fines window),
//     the hospital = interiors' "hospital" (the waiting room), the courthouse = this feature's lobby (lobby.js).
//     The town keeps them (heist/bank.js TOWN_INTERIORS). Lines only — no coins from here.
//   • the impound lot's gate: her own car behind the fence while it's impounded (it's never just gone).
//   • ctx.civic — where the buildings are, for law (arrests → the precinct, court, walking out) and the ER (the hospital).
import { ctx, on, emit, hook, setState } from "../../core/ctx.js";
import { registerModels, ensureModels } from "../../models.js";
import police from "../interiors/police.js";
import hospital from "../interiors/hospital.js";
import { lobbyDef, nameLobby } from "./lobby.js";
import { NAMES, PASS, IMPOUND_GATE, IMPOUND_MINE } from "./data.js";
import { STAY, claim, clear, tick, ready, walkOut, arrive, impoundedCar, showImpounded } from "./out.js";
import { dissolving } from "../../core/transition.js";
import { counsel, courtsDebug, hearingToday, caseDone, addCase, caseById, caseIn, progress } from "./courts.js";
import { ROADSIDE, BY_ID, hwSpot, hwNames, nearest as nearestPlace } from "./roadside.js";
import { roomFor } from "./roadrooms.js";

const MODELS = ["places_precinct", "places_court", "places_hospital", "places_impound"];
registerModels(Object.fromEntries(MODELS.map(k => [k, k])));

const pick = a => a[Math.floor(Math.random() * a.length)];
const JUDGE_HW = ["I've got a tee time at two. Let's make this quick. QUICK. *bangs a putter*",
    "Welcome to the Highway Traffic Court. Yes, it's a trailer. No, the gavel's not a putter. …It's a putter.",
    "Order! In this trailer! I'm the judge, the bailiff's at lunch, and the clock says 1:40."];
const JUDGE_VIDEO = ["*on a video screen, from Boca* Can you hear me? You're on mute. No — I'M on mute. Order!",
    "*the screen freezes, then* …and that's why I'm in Boca. Now: YOUR case. Dot, which one is she?",
    "*a visor, a palm tree behind him* The Weigh Station Court is in session. Make it quick, the pool closes at five."];
const inTown = () => !!(ctx.town && ctx.town.active);
const townId = () => (inTown() && ctx.town.id) || "lakewood";
/** The names of the buildings she's at / taken to: a roadside place's (roadside.js) or the town's. */
function names() {
    const P = STAY.place, R = P && P.hw ? BY_ID[P.hw] : null;
    if (R) return Object.assign({}, NAMES.lakewood, R.names);
    return NAMES[townId()] || NAMES.lakewood;
}
/** What a door is called right where she stands (on the highway: the roadside place's own name). */
function nameAt(kind) {
    if (!inTown()) { const sp = hwSpot(kind), n = sp && hwNames(sp.hw); if (n && n[kind]) return n[kind].name; }
    return (names()[kind] || {}).name || "";
}
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);

/** A building's door (world coords) in the town she's in — or, on the highway, at the roadside place she's taken to / near
 *  (roadside.js): { x, z, rot, nx, nz, ux, uz, cx, cz, … } | null. */
function spot(kind) {
    if (inTown()) return ctx.town.spot ? ctx.town.spot(kind) : null;
    return hwSpot(kind, STAY.place && STAY.place.hw ? STAY.place : null);
}

// ── walking in: one ✋ spot per door ─────────────────────────────────────
const DOORS = {
    precinct: { id: "police", icon: "🚓", label: () => `🚓 ENTER ${nameAt("precinct").toUpperCase()}`, short: "POLICE" },
    court: { id: "courthouse", icon: "⚖️", label: () => inTown() ? "⚖️ ENTER THE COURTHOUSE" : `⚖️ ENTER ${nameAt("court").toUpperCase()}`, short: "COURT" },
    hospital: { id: "hospital", icon: "🏥", label: () => `🏥 ENTER ${nameAt("hospital").toUpperCase()}`, short: "HOSPITAL" },
};
/** Is walking in possible right now (not mid-chase, not in a party outside Free Roam, nothing more urgent on ✋)? */
function canWalkIn() {
    // (she just came OUT of one: a ✕ still being mashed from the scene mustn't walk her straight back in — the doors wake up
    //  once she's stepped 4 m away, or after 8 s)
    if (C.outAt) {
        const p = herPos();
        if (ctx.time < C.doorsAt && p && Math.hypot(p.x - C.outAt.x, p.z - C.outAt.z) < 4) return false;
        C.outAt = null;
    }
    // (with friends: only in 🌍 Free Roam — walking in is a visit, and friends inside see each other: features/together)
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    // (in a town; or on the highway at a roadside place — roadside.js — in a Cruise / Free Roam)
    const hwOk = !inTown() && !!ctx.G && (ctx.G.mode === "cruise" || roam);
    if (!(inTown() || hwOk) || (party && !roam) || !ctx.interiors) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
/** The interior a door opens here: the town's (DOORS) or the roadside place's own room (roadrooms.js). */
const roomId = (kind, sp) => (sp && sp.hw ? roomFor(sp.hw, kind) : DOORS[kind].id);
function doorPos(kind) {
    if (!canWalkIn()) return null;
    const sp = spot(kind), p = herPos(), id = roomId(kind, sp);
    if (!sp || !p || !id || !ctx.interiors[id]) return null;
    // (walking up to it: the inside starts loading now, so the step in is a soft cut)
    if (ctx.interiors[id].warm && Math.hypot(sp.x - p.x, sp.z - p.z) < 24) ctx.interiors[id].warm();
    return sp;          // (with its axes: foot stretches the ✋ across the doorway — ci/doors)
}
/** Dress the interiors for this town (their names / titles). */
function nameInteriors() {
    const n = names();
    police.name = n.precinct.name; police.title = n.precinct.title; police.tagline = n.precinct.tagline;
    if (ctx.interiors.police) ctx.interiors.police.name = n.precinct.name;
    hospital.name = n.hospital.name; hospital.title = n.hospital.title; hospital.tagline = n.hospital.tagline;
    if (ctx.interiors.hospital) ctx.interiors.hospital.name = n.hospital.name;
    nameLobby(n.court);
}
/** The road position of a door (foot's resume puts her back out on the sidewalk in front of it). */
function doorRef(kind, sp) {
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    return { id: kind, s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
}
/** Walk in through `kind`'s front door (precinct | court | hospital). → bool */
export function enter(kind) {
    const D = DOORS[kind], sp = spot(kind), id = roomId(kind, sp);
    if (!D || !sp || !id || !ctx.interiors || !ctx.interiors[id]) return false;
    if (inTown()) nameInteriors();
    const dr = doorRef(kind, sp);
    emit("stat", { id: "placesVisits", n: 1 });
    emit("places:enter", { kind, town: inTown() ? townId() : null, hw: sp.hw || null });
    const exit = () => { if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door: dr }); };
    return ctx.interiors[id].enter({ exit, door: id, from: "foot" });
}

// ── the impound gate ─────────────────────────────────────────────────────
/** Her own car is in the impound right now (law impounded it / it was towed): shown behind the fence. */
const impounded = () => !!(ctx.foot && ctx.foot.active && ctx.foot.ownCar === "gone" && impoundedCar());
function gatePos() {
    if (!inTown() && !(ctx.G && ctx.G.mode === "cruise")) return null;
    const sp = spot("impound");
    return sp || null;
}
async function gate() {
    // (features/impound: pay the release / show the slip → the car rolls out)
    if (ctx.impound && ctx.impound.gate) { try { if (await ctx.impound.gate()) return true; } catch (e) { console.error("[places] impound gate", e); } }
    const o = ctx.foot && ctx.foot.obj;
    if (o && ctx.foot.say) ctx.foot.say(o, impounded() ? pick(IMPOUND_MINE) : pick(IMPOUND_GATE), 3.2);
    return true;
}

// ── walking past: Lulu's one-liner, once per building per visit ─────────
const C = { said: new Set(), t: 0, doorsAt: 0, outAt: null };
function passBy(dt) {
    if ((C.t += dt) < 0.5) return;
    C.t = 0;
    if (!inTown() || !(ctx.foot && ctx.foot.active) || ctx.state !== "footRun") return;
    const p = herPos(), o = ctx.foot.obj;
    for (const kind of ["precinct", "court", "hospital", "impound"]) {
        if (C.said.has(kind)) continue;
        const sp = spot(kind);
        if (sp && Math.hypot(sp.x - p.x, sp.z - p.z) < 14) {
            C.said.add(kind);
            if (o && ctx.foot.say && Math.random() < 0.7) ctx.foot.say(o, pick(PASS[kind]), 2.8);
            break;
        }
    }
}

// ── wiring ───────────────────────────────────────────────────────────────
// the states the town now hosts (they used to send her back to the highway first): law's arrest → booking → cell →
// court → the walk out, the arrival at the precinct, the ER
const HOSTED = ["interior", "lawArrest", "lawJail", "lawCourt", "lawExit", "placesArrive", "cameosER", "placesHearing"];
on("boot", () => {
    if (ctx.town && ctx.town.allowState) for (const s of HOSTED) ctx.town.allowState(s);
    if (ctx.foot && ctx.foot.addSpot) {
        for (const kind of Object.keys(DOORS)) {
            const D = DOORS[kind];
            // (a roadside place's colliders follow its walls — roadside.js colliders(): the town's walk-in push works there too)
            ctx.foot.addSpot({ pos: () => doorPos(kind), r: 2.6, door: true, walkIn: { id: () => roomId(kind, spot(kind)) }, label: D.label, short: D.short, act: () => enter(kind) });
        }
        ctx.foot.addSpot({ pos: gatePos, r: 2.4, door: { w: 2.4 }, label: () => (ctx.impound && ctx.impound.gateLabel && ctx.impound.gateLabel()) || (impounded() ? "🚗 YOUR CAR (IMPOUNDED)" : "🚧 THE IMPOUND LOT"), short: "IMPOUND", act: gate });
    }
});
on("town:enter", () => { C.said.clear(); nameInteriors(); });
on("title", () => clear());
on("places:out", () => { const p = herPos(); C.doorsAt = ctx.time + 8; C.outAt = p ? { x: p.x, z: p.z } : null; for (const k of Object.keys(PASS)) C.said.add(k); });   // (her own walk-out line, not a walk-by quip)
on("places:enter", e => { if (e && e.kind) C.said.add(e.kind); });
on("run:start", () => clear());
on("town:leave", () => C.said.clear());
// (a light per-frame walk-by check, on foot in a town only)
hook("hud", dt => { try { passBy(dt); } catch (e) { console.error("[places] pass", e); } });

/** The service other features ask (law's arrests, the ER): where the buildings are. */
ctx.civic = {
    /** The door spot of precinct | court | hospital | impound in the town she's in (world coords) or null. */
    spot,
    /** Are the buildings standing in the town she's in? */
    get here() { return !!(spot("precinct") && spot("hospital")); },
    names: () => names(),
    enter,
    /** Fetch the models a town's buildings need (towns load them with their own; this is for tests). */
    load: () => ensureModels(MODELS),
    // ── being taken there + walking out (out.js) ──
    /** Where she's being taken right now (law's arrest / the ER): { kind, id, exitS, here } (a town) or
     *  { kind, id, hw, s } (a roadside place on the highway, roadside.js) | null. */
    get place() { return STAY.place; },
    claim, clear, tick, ready, walkOut, arrive,
    // ── the courthouses' own stories (courts.js) ──
    /** law/court.js: who is her counsel in the court she's tried in (Midwood: Abba) — null = the usual lawyer. */
    counsel,
    /** Courtroom 2B's cases (data — `addCase(def)`, see courts.js) + Shloime's: `hearingToday(c?)`, `caseDone(c?)` (default Shloime's). */
    courts: { addCase, caseById, caseIn, progress, hearingToday, caseDone, debug: courtsDebug },
    dissolving,
    /** 🚔🚑 the roadside places (roadside.js): their data, and THE rule — nearest(kind = law | er, lapMetre?) →
     *  { town } | { hw } along the lap, either way round. */
    roadside: ROADSIDE, nearest: (kind, m) => nearestPlace(kind, m),
    /** Judge Kessler's opener in the Highway Traffic Court (law/court.js), else null. */
    judgeLine: () => (STAY.place && STAY.place.hw === "trooper" ? pick(JUDGE_HW) : STAY.place && STAY.place.hw === "weigh" ? pick(JUDGE_VIDEO) : null),
    /** Her impounded car behind the lot's fence (features/impound): show(on) puts it there in the town she's in · car() the Object3D or null. */
    impound: { show: showImpounded, car: impoundedCar },
    debug: { C, DOORS, lobbyDef, STAY, impoundedCar },
};
