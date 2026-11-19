// features/heist — 🏦 BANKS, CARTOON HEISTS & ROBBERIES ON THE ROAD (cartoon only: water pistols,
// banana "guns", confetti blasters, a baguette; nobody is ever shot; the cops bring stun nets and spike strips).
//
//   bank.js     the bank in each town (town DATA places the building: towns/*.js `uses.bank`); on foot ✋ ENTER →
//               the interiors engine's "bank" (teller line, napping guard, vault door, lollipops) → 🔍 case the vault
//   robbery.js  🦸‍♀️ foil a robbery: at a town's bank / shop or the highway's KOSHER QUIK-MART — ram / PIT / box in
//               the getaway car, or ✋ tackle the robber on foot. Cops collar him; they never chase HER for helping
//   job.js      💰 Lulu's own heist (opt-in): case it (inside, or Shmulik's payphone tip) → a plan → the ⏭ job
//               cutscene ("a stick-up… of RUGELACH!") → a law chase with the heist charge → paid + a warrant,
//               or caught → law's jail + court. One a run, HEIST.cooldownMin minutes apart
//   snatch.js   🛵 the moped snatcher (capped, recoverable) + 🚗 the car thief (foot's parked car; always recovered)
//   gear.js     🕸️ the cops' stun net + 🚓 the cartoon spike strip (high-star chases)
//   data.js     every number + line (the coin-economy notes are at its top)
//
// ctx.heist = { job, plan, busy(except), planHeist(town, plan), robbery(opts), snatch(mode), carTheft(), gear, store, debug }
// Events: heist:robbery {phase: staged|start|foiled|escaped, where, how, pay} · heist:job {phase: tip|plan|start|escaped|busted|failed}
//         heist:snatch {phase: approach|dodged|grab|caught|lost, n} · heist:theft {phase: warn|stopped|stolen|recovered|ditched}
//         heist:gear {kind: net|spikes, phase}
// Stats: heistFoils heistTackles heistJobs heistJobsClean heistBusted heistCased heistBankVisits heistLollipops
//        heistSnatched heistSnatchDodged heistSnatchCaught heistCarStolen heistCarsRecovered heistTheftStopped
//        heistNetted heistSpiked · best heistBestPay
// Random content is gated by ctx.enabled("heist") + common.js live(what). In a 🎉 party only the PERSONAL bits run
// (the cops' net / spikes in her own chase, the moped snatcher, the thief at her parked car) on a Road Trip / Free
// Roam run; robberies and Lulu's own heist stay solo (ARCHITECTURE › the party parity table).
import { ctx, on } from "../../core/ctx.js";
import { live } from "./common.js";
import { R, stage, schedNow, cleanup as endRobbery } from "./robbery.js";
import { J, S, setPlan, dropPlan, startJob, offerTip, cooldownLeft } from "./job.js";
import { SN, CT, snatch, carTheft, endSnatch, endTheft } from "./snatch.js";
import { GEAR, fireNet, laySpikes, ripNet, flatTyres, isFlat } from "./gear.js";
import { enterBank, bankDef } from "./bank.js";
import { TUNE, PAY, HEIST, PLANS } from "./data.js";

ctx.heist = {
    /** Lulu's heist in progress ({ town, plan, bags, lost, phase: inside | getaway | pulled, stars }) or null. */
    get job() { return J.job; },
    /** The cased bank / tip waiting to be pulled ({ town, plan, via }) or null. */
    get plan() { return J.plan; },
    /** A robbery Lulu can foil right now ({ where, phase, … }) or null. */
    get robbery() { return R.ev; },
    get snatcher() { return SN.ev; },
    get thief() { return CT.ev; },
    /** Is any heist thing going on (other than `except`: "robbery" | "snatch" | "job")? Schedulers stand down. */
    busy(except = "") {
        return (except !== "robbery" && !!R.ev) || (except !== "snatch" && !!(SN.ev || CT.ev)) || (except !== "job" && !!(J.job || J.plan));
    },
    /** Plan a heist (the bank interior / the tip do this): town id or null (either), plan id → bool. */
    planHeist: (town, plan = "classic", via = "debug") => setPlan(town, plan, via),
    cooldownLeft,
    gear: { fireNet, laySpikes, ripNet, flatTyres, get netted() { return !!GEAR.netted; }, get flat() { return isFlat(); }, get flying() { return !!GEAR.flight; }, state: GEAR },
    store: S,
    tune: TUNE, pay: PAY, heist: HEIST, plans: PLANS,
    debug: {
        R, J, SN, CT, GEAR,
        robbery: opts => stage(Object.assign({ now: true }, opts || {})),
        endRobbery,
        /** The robbery scheduler's next tick, now (true when one was staged). */
        schedRobbery: schedNow,
        job: () => startJob(),
        dropPlan,
        tip: () => offerTip(),
        snatch: mode => snatch(mode),
        endSnatch,
        carTheft: () => carTheft(),
        endTheft,
        enterBank,
        bankDef,
        /** The random-content gate for one kind ("robbery" | "job" | "snatch" | "gear"): in a 🎉 party only the personal ones. */
        live: what => live(what),
        /** Lift the one-a-run rule and the cooldown (tests). */
        bypass(on = true) { J.bypass = !!on; if (on) J.done = false; },
    },
};

// the 3D badges (meta's scrapbook)
on("boot", () => {
    if (!ctx.meta || !ctx.meta.addBadge) return;
    const st = (s, id) => (s.stats && s.stats[id]) || 0;
    ctx.meta.addBadge({ id: "heistHero", icon: "🦸‍♀️", name: "Neighbourhood Hero", desc: "Foil 3 robberies in 3D (ram, PIT, box in or tackle)", prog: s => [st(s, "heistFoils"), 3] });
    ctx.meta.addBadge({ id: "heistBanana", icon: "🍌", name: "Banana Republic", desc: "Pull off a clean cartoon heist in 3D", prog: s => [st(s, "heistJobsClean"), 1] });
    ctx.meta.addBadge({ id: "heistZippy", icon: "🛵", name: "Not Today, Zippy", desc: "Get your coins back from 3 moped snatchers", prog: s => [st(s, "heistSnatchCaught"), 3] });
});
