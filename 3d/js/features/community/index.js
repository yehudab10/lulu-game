// ─────────────────────────────────────────────────────────────────────────
//  features/community — 🚨 THE VOLUNTEER ORGS of a frum town: CHAVERIM (roadside chesed),
//  SHOMRIM (the civilian patrol that really, REALLY wants to be the police) and HATZALAH
//  (volunteer EMS, there before you hang up) — plus Lakewood's BAIS YAAKOV.
//
//    towns.js    which town has which orgs (data, keyed by town id — Midwood opts in with one entry)
//    fleet.js    their vehicles (pooled traffic cars): highway sightings near the exit, town cruisers,
//                responders (go to a kerb · follow Lulu round corners · drive off), light bars, sirens
//    scenes.js   roadside scenes: a flat, a lockout, a dead battery (→ Chaverim), a bochur off his
//                e-bike (→ Hatzalah); Lulu calling it in first is a mitzvah
//    help.js     help for LULU (fix · gas · tow · jump her parked car · patch her up · a Shomrim visit)
//                + the scene runner: state "communityScene" in the car, ctx.foot.script on foot
//    shomrim.js  Shomrim chases: lead (spot → follow → call it in), join a cop chase (radio tips →
//                ctx.law.spot), HOLD (boxed in → talk your way out, or law's arrest flow)
//    by.js       the Bais Yaakov dismissal line + the BLEND IN rhythm minigame (with heat, on foot)
//    calls.js    the 📞 Call phone app (in a town only): Chaverim · Hatzalah · Shomrim · 911
//    lines.js    every line of text · common.js shared helpers + a tiny synth
//
//  ctx.community { active, towns, register(id, cfg), config(id), vehicles, scene, chase, help, by,
//                  startScene(kind), call(org, reason), request(kind), shomrim(reason, opts),
//                  endShomrim(why), blend(opts), reasons(org), stats, debug }
//  Events: community:scene {kind, org, phase, byLulu} · community:help {kind, org, phase} ·
//          community:shomrim {active, reason, lead, join, called, why} · community:hold {result} ·
//          community:by {phase, result} · community:call {org}
//  Stats: communityChesed, communityHelped, communityPatched, communityCalls, communityShomrimChases,
//         communityHolds, communityBlends, communityBlendTries, communitySelfReports, communitySurrenders
//  Random content is gated by ctx.enabled("community") (off in ?test unless enabled, off in a party).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, addActor } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import * as H from "../../hud.js";
import { CM, loadModels, on as live, townCfg, tickTimers, clearTimers, rand, bubble, pick } from "./common.js";
import { COMMUNITY, forTown, register } from "./towns.js";
import { tickFleet, tickHighway, tendCruisers, clearFleet, spawnCruiser, shomrimSees } from "./fleet.js";
import { tickScenes, startScene, endScene, sceneSpot, callFor } from "./scenes.js";
import { tickHelp, request, cancelHelp, sceneActive } from "./help.js";
import { tickShomrim, startShomrim, endShomrim, witness } from "./shomrim.js";
import { tickBY, bySpot, clearLine, bootBY, startBlend, heat } from "./by.js";
import { registerApp, debugCall, reasons } from "./calls.js";

CM.save = store("community", { hints: {}, chesed: 0, blends: 0, holds: 0, calls: 0 });
if (!CM.save.hints) CM.save.hints = {};
CM.saveSoon = saveSoon;
CM.force = {};

const inTown = () => !!(ctx.town && ctx.town.active);

function reset() {
    endScene();
    cancelHelp();
    endShomrim("reset");
    clearLine();
    clearFleet();
    clearTimers();
    CM.seen.clear();
    CM.saidApproach = CM.saidApproach2 = false;
    CM.hwT = rand(3, 6);
    CM.assistCool = 20;
    CM.shCool = 0;
    CM.view = null;
}

// ── one actor (it runs while she drives AND on foot) ─────────────────────
let actor = null;
function ensureActor() {
    if (actor && ctx.actors.includes(actor)) return;
    actor = addActor({ foot: true, update: dt => { try { tick(dt); } catch (e) { console.error("[community] tick", e); } return true; } });
}
function tick(dt) {
    tickTimers();
    tickFleet(dt);
    tickHighway(dt);
    tendCruisers(dt);
    tickScenes(dt);
    tickShomrim(dt);
    tickHelp(dt);
    tickBY(dt);
}
hook("runStart", G => {
    reset();
    actor = null;
    ensureActor();
    if (G.mode === "cruise" && live()) loadModels();
}, 5);
// (a run resumed by law / a scene that skipped runStart: make sure we're ticking)
hook("update", () => { if (!actor || !ctx.actors.includes(actor)) ensureActor(); });

on("title", () => reset());
on("state", ({ to }) => { if (to === "title" || to === "gameover") reset(); });

// ── the town ─────────────────────────────────────────────────────────────
on("town:enter", () => {
    const cfg = townCfg();
    if (!cfg) return;
    loadModels();
    CM.seen.clear();
    CM.sceneT = cfg.scenes.first;
    CM.bySpot = null;
    CM.tendT = 1;
    ensureActor();
});
on("town:leave", () => { endScene(); cancelHelp(); endShomrim("left"); clearLine(); CM.bySpot = null; });

// crimes the Shomrim might see (they're always watching. ALWAYS.)
on("town:stopSign", () => { if (inTown()) witness("RUNNING A STOP SIGN", 50, 0.2); });
on("streets:carjack", () => { if (inTown()) witness("GRAND THEFT MINIVAN", 70, 0.45); });
on("crash", e => {
    if (!inTown() || !e || !e.car || !e.car.data || ctx.state !== "playing") return;
    const V = e.car.data.community;
    if (V && e.impact > 4) {
        if (V.org === "shomrim") { bubble(V.car.obj, "My CROWN VIC! It's a 2009!", 2.4, "cop"); witness("RAMMING A SHOMRIM CAR", 90, 1); }
        else if (V.org === "hatzalah") bubble(V.car.obj, "We're fine! Are YOU fine? Want a granola bar?", 2.6, "nice");
        else bubble(V.car.obj, "Hey! We FIX cars, we don't — okay, we'll fix this one too.", 2.6, "nice");
        return;
    }
    if (e.car.data.town && e.impact > 5) witness("FENDER BENDER (AND DRIVING OFF)", 45, 0.1);
});
// a cop chase in town: the Shomrim join in (they've been waiting their whole lives for this)
on("cop:chase", e => {
    if (!inTown() || !e) return;
    const ch = CM.chase;
    if (e.active) {
        if (ch) { ch.lead = false; return; }
        if (live() && (CM.force.join || Math.random() < 0.85)) startShomrim(e.reason || "EVADING THE POLICE", { join: true });
        return;
    }
    if (ch && !ch.lead) endShomrim(e.result === "escaped" ? "escaped" : e.result === "busted" ? "busted" : "ended");
});
on("foot:end", () => { if (CM.by && CM.by.blend) clearLine(); });

// ── boot: the state may play in town, the ✋ spots, the 📞 app, the 👟 button ──
on("boot", () => {
    if (ctx.town && ctx.town.allowState) ctx.town.allowState("communityScene");
    if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(sceneSpot); ctx.foot.addSpot(bySpot); }
    registerApp();
    bootBY();
});

// ── the service ──────────────────────────────────────────────────────────
ctx.community = {
    /** In a town with volunteer orgs right now? */
    get active() { return !!townCfg(); },
    towns: COMMUNITY,
    /** Opt a town in (or change it): ctx.community.register("midwood", { orgs: {…}, by: null }). */
    register,
    config: id => forTown(id),
    get vehicles() { return CM.vehicles.map(V => ({ org: V.org, mode: V.mode, lights: !!V.lights, x: V.car.x, z: V.car.z, kind: V.car.kind })); },
    get scene() { const s = CM.scene; return s ? { kind: s.kind, org: s.org, phase: s.phase, byLulu: s.byLulu, called: s.called, x: s.at.x, z: s.at.z, street: s.at.street } : null; },
    get chase() { const c = CM.chase; return c ? { reason: c.reason, lead: c.lead, units: c.units.length, charges: c.charges.slice() } : null; },
    get help() { const h = CM.help; return h ? { kind: h.kind, org: h.org, phase: h.phase } : (sceneActive() ? { phase: "scene" } : null); },
    get by() { const b = CM.by; return b ? { girls: b.girls.length, blending: !!b.blend, sus: b.blend ? b.blend.sus : 0, ok: b.blend ? b.blend.ok : 0, looks: b.blend ? b.blend.looks : 0 } : null; },
    get heat() { return heat(); },
    startScene: (kind, opts) => !!startScene(kind, opts),
    /** Place a call as if from the 📞 app: (org, reason id) — see reasons(org). */
    call: (org, id) => debugCall(org, id),
    reasons: org => reasons(org).map(r => r.id),
    request: (kind, opts) => request(kind, opts),
    shomrim: (reason, opts) => startShomrim(reason, opts),
    endShomrim: why => endShomrim(why),
    blend: opts => startBlend(CM.by, opts),
    get stats() { return Object.assign({}, CM.stats, { saved: { chesed: CM.save.chesed || 0, blends: CM.save.blends || 0, calls: CM.save.calls || 0 } }); },
    load: () => loadModels(),
    debug: { CM, spawnCruiser, callFor, witness, shomrimSees, force: CM.force, reset },
};
// TODO(rides): when features/rides (vehicle-specific abilities) lands, register the three org
// vehicles there (guarded: if (ctx.rides) …) so a jacked Shomrim Crown Vic gets its spotlight /
// a Hatzalah van its siren-clears-traffic, instead of a parallel ability system here.
export { H };
