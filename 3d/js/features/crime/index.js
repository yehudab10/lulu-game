// ─────────────────────────────────────────────────────────────────────────
//  features/crime — 🦹 MORE CARTOON CRIME IN TOWN (roadmap 18, ci/crime). The owner (2026-11-20): "More crime. More
//  corruption. More immersion… I want more to do in cities and stuff."
//
//  Small, complete loops the law already understands — each one opt-in or self-inflicted, funny, 12+, nobody hurt:
//  a spot / a moment in the world → a risk (a cop who SEES it: a ⚠️ look, then a chase — the law's own rules) → a
//  small CAPPED reward (per REAL day, data.js PAY) → caught = the charge in court (law.addCharge: arrest lines, the
//  lawyer's argument, a courtroom moment that always plays).
//
//    cart.js        🛒 the shopping-cart joyride (on foot): ✋ RIDE the runaway cart outside the pizza shop / bakery
//    jaywalk.js     🚶‍♀️ the jaywalking spree (on foot): mid-block crossings in a row → a combo; close ones count
//    doublepark.js  🅿️ the double-parking empire (in the car): "one second" in the outside lane, the honks pay
//    common.js      the save (per-day caps), who's watching (law units + the town's patrol, line of sight),
//                   footCrime() (on foot: ⚠️ look → foot chase), payCapped(), bubbles, cheap baked props
//    data.js        every knob (PAY, TUNE), the charges, every line
//
//  Gating: ctx.enabled("crime") (?test opt-in), solo only (friends have features/partners), a Cruise / Story run, IN A
//  TOWN, not in the tutorial; never in Dina's mode (no town there). The pop-up budget: one must-see toast per crime
//  (its payout / its bust), everything else is bubbles. Nothing always-on: the props are built on town:enter and
//  disposed on town:leave; the per-frame work is a street lookup while she walks / stands.
//
//  ctx.crime { active, PAY, TUNE, start(kind), debug } — events crime:<ev> (pay, warn, chase, cart, jaywalk, park);
//  stats crime*.
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, addActor } from "../../core/ctx.js";
import { ID, PAY, TUNE, CHARGES } from "./data.js";
import { CR, SAVE, live, inTown, onFoot, log, today, paidToday } from "./common.js";
import { CART, buildCart, clearCart, cartTick, startRide } from "./cart.js";
import { JAY, jayTick, resetJay, settleJay } from "./jaywalk.js";
import { PARK, parkTick, parkReset, parkStart, parkEnd } from "./doublepark.js";
import { othersEnter, othersLeave, othersRun, othersTick, othersDebug } from "./others.js";
import { TAGS, maybeTip, rip, tagsTick, clearTags } from "./tags.js";
import { HER, buildHerring, clearHerring, herringTick, swipe, getzelSees } from "./herring.js";
import { AIR, buildAir, clearAir, airTick, start as airStart, airEnd } from "./air.js";
import { CO, corruptTick, corruptReset, spawnScene, snap, handIn, ticket, corruption } from "./corrupt.js";

// ── the charges (once the law is there) ──────────────────────────────────
function registerCharges() {
    if (registerCharges.done || !ctx.law || !ctx.law.addCharge) return;
    registerCharges.done = true;
    for (const c of Object.values(CHARGES)) ctx.law.addCharge({ key: c.key, name: c.name, weight: c.weight, cop: c.cop, lulu: c.lulu, defense: c.defense, court: c.court, nudge: c.nudge });
}
on("boot", registerCharges);

// ── the town's street pieces: built on the way in, gone on the way out ───
function enterTown(e) {
    if (!ctx.enabled(ID)) return;
    CR.town = ctx.town && ctx.town.id || "";
    buildCart();
    othersEnter();
    buildHerring();
    buildAir();
    // (the Fixer's tip comes when she DRIVES into a town — never on a day's start at home, a warp or a reload: a fresh
    //  player's phone starts with nothing unread — qa18)
    if (live() && e && !e.home && !e.quiet) maybeTip();
    ensureActor();
}
function leaveTown() {
    clearCart();
    parkReset();
    resetJay();
    othersLeave();
    clearTags();
    clearHerring();
    clearAir();
    corruptReset();
    CR.town = "";
}
on("town:enter", enterTown);
on("town:leave", leaveTown);
on("run:start", () => { CR.sus = {}; parkReset(); resetJay(); othersRun(); corruptReset(); ensureActor(); if (inTown() && !CART.obj) enterTown(null); });
on("state", ({ to }) => { if (to === "title") leaveTown(); });

// ── per frame ─────────────────────────────────────────────────────────────
let actor = null;
function ensureActor() {
    if (actor && ctx.actors.includes(actor)) return;
    actor = addActor({ foot: true, update: dt => { try { tick(dt); } catch (e) { console.error("[crime] tick", e); } return true; } });
}
function tick(dt) {
    if (!CR.town) return;
    if (!inTown()) { leaveTown(); return; }
    const on = live();
    cartTick(dt);
    jayTick(dt, on && onFoot());
    othersTick(dt);
    tagsTick(dt);
    herringTick(dt);
    airTick(dt);
    corruptTick(dt);
}
hook("update", (dt, P) => {
    if (!actor || !ctx.actors.includes(actor)) ensureActor();
    if (CR.town) { try { parkTick(dt, P); } catch (e) { console.error("[crime] park", e); } }
});

// ── the service ──────────────────────────────────────────────────────────
ctx.crime = {
    /** Crime's town pieces are up (she's in a town with the feature on). */
    get active() { return !!CR.town && live(); },
    PAY, TUNE,
    /** Coins paid today for a crime (its per-real-day cap is in PAY). */
    paidToday,
    /** Start one now (tests / a phone tip): "cart" (she must be walking by it) · "park" (stopped double-parked). → bool */
    start(kind) { return kind === "cart" ? startRide() : kind === "park" ? parkStart() : kind === "air" ? airStart() : kind === "herring" ? swipe() : false; },
    /** Street-level corruption for city hall (ci/cityhall): who(id) · list() · evidence. Event crime:corrupt {who, act}. */
    corruption,
    debug: { CR, SAVE, CART, JAY, PARK, settleJay, parkEnd, today, day: null, others: othersDebug,
        s3: { TAGS, maybeTip, rip, clearTags, HER, swipe, getzelSees, AIR, airEnd, CO, spawnScene, snap, handIn, ticket },
        rebuild() { if (CR.town) { leaveTown(); enterTown(); } return !!CR.town; }, get log() { return CR.log; }, get force() { return CR.force; } },
};
