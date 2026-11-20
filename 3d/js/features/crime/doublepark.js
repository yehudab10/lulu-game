// features/crime — 🅿️ THE DOUBLE-PARKING EMPIRE (in the car, opt-in).
//
// Stop in the outside travel lane of any town street that has a parking lane, mid-block, beside the parked cars → after
// a beat the prompt offers "🅿️ Double-park — 'one second'" (✋ / ✕). Hazards on: a chip counts the seconds and the cars
// stuck behind her (each town driver that queues up = a *HONK* bubble over it). Drive off to cash in: PAY.park.perHonk a
// car held up (≤ maxStop a stop) + the order (PAY.park.order) if she waited ≥ orderAt s ("the counter guy brings the
// pizza out") — ≤ perDay coins a REAL day, one must-see line. The risk: the town's patrol / a law unit that SEES her
// double-parked past the grace — Midwood: "hazards are on, it's legal" for midwoodGrace s, Lakewood only lakewoodGrace —
// is law.notice("DOUBLE PARKING"): the ⚠️ warning first, a second one = a chase (the law's own rules).
import { ctx } from "../../core/ctx.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { minivanHorn } from "../town/sfx.js";
import { PAY, TUNE, LINES, log, stat, pick, fill, lulu, bubble, mustSee, streetAt, copWatching, payCapped, live } from "./common.js";
import { CHARGES } from "./data.js";

const K = TUNE.park;
export const PARK = { stillT: 0, shown: false, on: null, total: 0 };

/** Is the car standing double-parked right now? → the street info | null */
function doubleParked() {
    const car = ctx.car, sa = streetAt(car.pos.x, car.pos.z, car.s);
    if (!sa || !sa.st.parkLane || sa.mid < 14) return null;
    const edge = 3.5 * sa.st.lanes, ad = Math.abs(sa.d);
    return ad > edge - 2.8 && ad < edge + 0.9 ? sa : null;
}

export function parkReset() {
    if (PARK.on) end("reset");
    PARK.stillT = 0;
    if (PARK.shown) { H.prompt(""); PARK.shown = false; }
}

/** Every DRIVING frame (hook "update": P = this frame's presses). */
export function parkTick(dt, P) {
    const car = ctx.car;
    if (PARK.on) { tick(dt, PARK.on); return; }
    const ok = ctx.state === "playing" && live() && !(ctx.law && ctx.law.chasing) && !(ctx.foot && ctx.foot.active);
    // (act on the prompt that was showing BEFORE this press: ✕ is the gas too)
    if (PARK.shown && P && P.interact && ok) { H.prompt(""); PARK.shown = false; start(); return; }
    PARK.stillT = ok && car.speed < 0.5 && doubleParked() ? PARK.stillT + dt : 0;
    const show = PARK.stillT > K.stopFor;
    if (show && !PARK.shown) H.prompt(`${glyph("interact")} ${LINES.park.prompt}`);
    else if (!show && PARK.shown) H.prompt("");
    PARK.shown = show;
}

/** Hazards on. (Tests call it straight.) → bool */
export function start() {
    if (PARK.on || !live() || ctx.state !== "playing") return false;
    const sa = doubleParked();
    if (!sa) return false;
    const midwood = ctx.town && ctx.town.id === "midwood";
    PARK.on = { t: 0, x: ctx.car.pos.x, z: ctx.car.pos.z, st: sa.st.id, d: sa.d, honks: new Set(), honkT: 0, order: false, grace: midwood ? K.midwoodGrace : K.lakewoodGrace, legalSaid: false, warned: false, lookT: 0.5, midwood };
    PARK.total++;
    stat("crimeDoubleParks");
    lulu(pick(LINES.park.start), true);
    log("park", { phase: "start", midwood });
    return true;
}

function tick(dt, S) {
    const car = ctx.car;
    S.t += dt;
    // she drove off (or anything else took her): settle
    if (ctx.foot && ctx.foot.active) { end("out"); return; }
    if (ctx.state !== "playing") { end("left"); return; }
    if (Math.hypot(car.pos.x - S.x, car.pos.z - S.z) > 4) { end("drove"); return; }
    // the cars stuck behind her: each one that queues up = a honk (bubble + horn), counted once
    S.honkT -= dt;
    for (const c of ctx.traffic.cars) {
        if (c.speed > 0.8 || S.honks.has(c)) continue;
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z, dist = Math.hypot(dx, dz);
        if (dist > K.honkR || dist < 3) continue;
        if (-dx * Math.sin(c.h) - dz * Math.cos(c.h) < 0) continue;      // (she's ahead of it, not behind)
        const sa = streetAt(c.x, c.z, c.s);
        if (!sa || sa.st.id !== S.st || Math.sign(sa.d) !== Math.sign(S.d)) continue;
        // (behind her in her lane: the town drivers queue up in the direction of travel)
        S.honks.add(c);
        if (S.honkT <= 0) { S.honkT = K.honkEvery; bubble(pick(LINES.park.honk), c.obj, { y: 2.4, cls: "angry", dur: 1.6 }); try { minivanHorn(0.7); } catch (e) { /* no audio */ } }
        log("park", { phase: "honk", n: S.honks.size });
    }
    if (!S.order && S.t >= K.orderAt) { S.order = true; bubble("🍕", car.obj, { y: 2.6, cls: "nice", dur: 2 }); log("park", { phase: "order" }); }
    H.prompt(`⚠️ <b>ONE SECOND…</b> ${Math.floor(S.t)} s · 🚗 ${S.honks.size} waiting${S.order ? " · 🍕" : ""} — drive off to go`);
    // the law: past the grace, a cop who SEES it
    S.lookT -= dt;
    if (S.lookT > 0) return;
    S.lookT = 1;
    const cop = copWatching(car.pos.x, car.pos.z);
    if (!cop) return;
    if (S.t < S.grace) {
        if (S.midwood && !S.legalSaid) { S.legalSaid = true; bubble(pick(LINES.park.legal).replace(/^🚓 /, ""), cop.patrol ? cop.patrol.obj : car.obj, { y: 2.4, cls: "cop" }); log("park", { phase: "legal" }); }
        return;
    }
    if (ctx.law && ctx.law.notice) {
        const r = ctx.law.notice(CHARGES.park.name, { msg: "🚨 \"ONE SECOND\" WAS A MINUTE AGO!", warn: pick(LINES.warn.park), witness: true, src: S });
        if (r) { log("park", { phase: r }); if (r === "chase") end("cop"); }
    }
}

function end(why) {
    const S = PARK.on;
    if (!S) return;
    PARK.on = null;
    H.prompt("");
    log("park", { phase: "end", why, honks: S.honks.size, t: Math.round(S.t), order: S.order });
    if (why !== "drove") return;
    const C = PAY.park;
    const want = Math.min(C.maxStop, S.honks.size * C.perHonk + (S.order ? C.order : 0));
    if (want <= 0) return;
    const paid = payCapped("park", want, C.perDay);
    mustSee(paid > 0 ? `${fill(LINES.park.done, { name: C.name, n: S.honks.size })}${S.order ? " · 🍕" : ""} · +${paid} 💰` : LINES.park.capped, paid > 0 ? "gold" : "", "crime:park");
}
export { start as parkStart, end as parkEnd };
