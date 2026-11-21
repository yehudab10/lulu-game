// features/airport — 🚕 THE JFK TAXI RUN (stage 3): a side job on hustle's framework (ctx.hustle.register).
//
//   PICKUP  the traveller waits at the ARRIVALS kerb (stage 1's landside; a quiet beacon). Pull up slow beside them →
//           they hop in (roadevents' passenger seat — friends never see it: it's her car).
//   RIDE    to a REAL place in Lakewood or Midwood: on the highway the beacon sits on that town's next interchange;
//           in town it moves to the landmark (ctx.town.spot: the Simcha Palace, the pizza shop, Brooklyn College…).
//           The wrong town → "↩️ wrong town!" (no beacon until she's back on the highway). Lines on the way.
//   DROP    stop by the landmark → pass. A FIXED fare (PAY.taxi), only PAY.taxiPerDay runs a real day pay (the job
//           isn't even offered past that). No meter, no tips, no countdown — and nothing to farm.
// Fails like any side job (a wreck, busted, getting out on foot).
import { ctx, emit } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import { models, ensureModels } from "../../models.js";
import * as H from "../../hud.js";
import { FARES, TAXI, TAXI_DEF, PAY, TUNE } from "./stage3-data.js";
import { kerbPickup, claim, ledger, lifetime } from "./stage3.js";
import { saveSoon } from "../../core/save.js";

export const TAXI_ID = "jfk_taxi";
export const fareById = id => FARES.find(f => f.id === id) || null;
const TOWN_NAME = { lakewood: "Lakewood", midwood: "Midwood" };
const pick = a => a[Math.floor(Math.random() * a.length)];
const rand = (a, b) => a + Math.random() * (b - a);
const LAST = { fare: null };

function bubble(text, obj, cls = "nice") {
    if (!text || ctx.skipping) return false;
    try { if (ctx.banter && ctx.banter.bubble) return ctx.banter.bubble(text, obj || ctx.car.obj, { dur: 3.4, y: 2.3, cls }); } catch (e) { /* no banter */ }
    return false;
}
const luluSay = text => { try { if (ctx.banter && ctx.banter.say) ctx.banter.say(text); } catch (e) { /* no banter */ } };

/** hustle calls this from start(): opts { fare: id, pickup: {x, z} } → the job, or null when there's no airport kerb. */
export function createTaxi(opts = {}) {
    const at = opts.pickup || kerbPickup();
    if (!at) return null;                                   // no airport (stage 1 not in) → no JFK fare
    if (ledger().taxi >= PAY.taxiPerDay && !opts.force) {   // past today's cap: not offered (and never paid)
        H.toast(TAXI.capped, "", { key: "jfkTaxi" });
        return null;
    }
    const fare = fareById(opts.fare) || pick(FARES.filter(f => f.id !== LAST.fare));
    LAST.fare = fare.id;
    const job = {
        id: TAXI_ID, def: TAXI_DEF, phase: "pickup", t: 0, fare, at: { x: at.x, z: at.z },
        person: null, standing: null, seated: false, chatT: rand(4, 6), lines: fare.ride.slice(), wrongT: 0, dest: null, said: {},
        intro: `${TAXI_DEF.from}: "${fare.name} — ${fare.hello.split(/[.!?]/)[0]}…"`,
        get emoji() { return this.fare.emoji; },
        line() { return lineOf(this); },
        timeLeft() { return null; },
        target() { return targetOf(this); },
        meters() { return null; },
        update(dt) { tick(this, dt); },
        onEvent(name, e) {
            if (name === "crash" && this.phase === "ride" && (e.impact || 0) > 4 && !this.said.crash) { this.said.crash = true; bubble(this.fare.crash, ctx.car.obj, "angry"); }
        },
        summary(result, why) { return summary(this, result, why); },
        dispose() { dispose(this); },
    };
    // the traveller waiting at the kerb (a plain person: their suitcase is "in the trunk")
    ensureModels([fare.look]).then(() => {
        if (!ctx.hustle || ctx.hustle.job !== job || job.phase !== "pickup" || !models[fare.look]) return;
        const p = spawnPerson(fare.look, { colors: fare.colors });
        p.obj.position.set(job.at.x, 0, job.at.z);
        ctx.scene.add(p.obj);
        job.standing = p;
    }).catch(() => { });
    emit("airport:taxi", { phase: "start", fare: fare.id, via: opts.via || "" });
    return job;
}

function lineOf(job) {
    const f = job.fare;
    if (job.phase === "pickup") return TAXI.pickupLine(f);
    const town = TOWN_NAME[f.dest[0]] || f.dest[0];
    const T = ctx.town;
    if (T && T.active && T.id !== f.dest[0]) return TAXI.wrongTown(f, town);
    if (T && T.active) return TAXI.toSpot(f);
    return TAXI.toExit(f, town);
}

/** The landmark in the destination town (built spots only exist while she's in it) → {x, z} | null. */
function destSpot(job) {
    const T = ctx.town;
    if (!T || !T.active || T.id !== job.fare.dest[0] || !T.spot) return null;
    for (const k of [job.fare.dest[1]].concat(job.fare.alt || [])) {
        const p = T.spot(k);
        if (p && isFinite(p.x)) return { x: p.x, z: p.z, key: k };
    }
    return null;
}
/** On the highway: the next interchange that offers the destination town (a point on its ramp). */
function exitPoint(job) {
    const T = ctx.town, w = ctx.world, car = ctx.car;
    if (!T || !w || !w.highway) return null;
    const ex = (T.exits || []).filter(e => e.town === job.fare.dest[0] && e.s > car.s - 40).sort((a, b) => a.s - b.s)[0];
    if (!ex) return null;
    const p = w.highway.point(ex.s + 20, 13, {});
    return { x: p.x, z: p.z, s: ex.s };
}
function targetOf(job) {
    if (job.phase === "pickup") return job.at;
    if (job.phase !== "ride") return null;
    const T = ctx.town;
    if (T && T.active) return T.id === job.fare.dest[0] ? destSpot(job) : null;
    return exitPoint(job);
}

const near = (p, r) => { const c = ctx.car.pos; return Math.hypot(p.x - c.x, p.z - c.z) < r; };
const slow = () => Math.abs(ctx.car.speed || 0) < TUNE.stopSpeed;

function tick(job, dt) {
    const f = job.fare;
    if (job.phase === "pickup") {
        if (job.standing) { const o = job.standing.obj, c = ctx.car.pos; o.rotation.y = Math.atan2(c.x - o.position.x, c.z - o.position.z); job.standing.update(dt, { wave: near(job.at, 40) }); }
        if (near(job.at, TUNE.stopR) && slow()) board(job);
        return;
    }
    if (job.phase !== "ride") return;
    // the wrong town: one line (again after a while), no beacon
    const T = ctx.town;
    if (T && T.active && T.id !== f.dest[0]) {
        job.wrongT -= dt;
        if (job.wrongT <= 0) { job.wrongT = 25; bubble(f.wrong, ctx.car.obj, "angry"); emit("airport:taxi", { phase: "wrong", fare: f.id, town: T.id }); }
    } else job.wrongT = Math.min(job.wrongT, 2);
    // chatter on the way
    job.chatT -= dt;
    if (job.chatT <= 0 && !ctx.dialogOpen) {
        job.chatT = rand(TUNE.chat[0], TUNE.chat[1]);
        if (!job.lines.length) job.lines = f.ride.slice();
        const i = Math.floor(Math.random() * job.lines.length);
        bubble(job.lines.splice(i, 1)[0], ctx.car.obj);
    }
    // the drop-off
    const sp = destSpot(job);
    if (sp && near(sp, TUNE.dropR) && slow()) {
        job.phase = "drop";
        bubble(f.bye, ctx.car.obj);
        emit("airport:taxi", { phase: "drop", fare: f.id, spot: sp.key });
        ctx.hustle.end("pass", "dropped");
    }
}

function board(job) {
    const f = job.fare;
    job.phase = "ride";
    if (job.standing) { const o = job.standing.obj; if (o.parent) o.parent.remove(o); job.standing = null; }
    const seat = () => {
        if (!ctx.hustle || ctx.hustle.job !== job || !models[f.look]) return;
        const p = spawnPerson(f.look, { colors: f.colors });
        job.person = p;
        if (ctx.roadevents && ctx.roadevents.seat && ctx.roadevents.seat(p, { bonus: false, keep: true, who: f.name })) job.seated = true;
    };
    if (models[f.look]) seat(); else ensureModels([f.look]).then(seat).catch(() => { });
    bubble(f.hello, ctx.car.obj);
    job.chatT = rand(7, 10);
    emit("airport:taxi", { phase: "pickup", fare: f.id });
    if (ctx.hustle._dbg) { /* hud refresh happens on the next tick */ }
}

function summary(job, result, why) {
    const f = job.fare, town = TOWN_NAME[f.dest[0]] || f.dest[0];
    if (result !== "pass") {
        const whyText = why === "busted" ? `${f.name} took the shuttle. From the precinct.` : why === "foot" ? `${f.name} decided to walk. With the luggage. To ${town}.` : why === "wreck" ? `${f.name} is fine. The car is less fine.` : `${f.name} found another ride.`;
        return { sub: why || result, rows: [], pay: 0, whyText, quote: [f.name, f.crash], logLine: `JFK TAXI · ${why || result}`, again: false };
    }
    const pay = claim("taxi");
    if (pay > 0) addCoins(pay, "jfkTaxi");
    addScore(600, "jfkTaxi");
    lifetime.runs = (lifetime.runs || 0) + 1; saveSoon();
    emit("stat", { id: "airportTaxiRuns", n: 1 });
    const left = Math.max(0, PAY.taxiPerDay - ledger().taxi);
    const rows = [[`🛬 JFK → ${f.dest[2]}, ${town}`, pay > 0 ? `+${pay}` : "—"], ["🚕 Runs left today", String(left)]];
    return { sub: `${f.emoji} ${f.name}`, rows, pay, whyText: pay > 0 ? "" : "Today's fares are done — this one was a mitzvah.", quote: [f.name, f.bye], logLine: `JFK TAXI · ${f.name}`, again: false };
}

function dispose(job) {
    if (job.standing) { const o = job.standing.obj; if (o.parent) o.parent.remove(o); job.standing = null; }
    if (job.person) {
        if (job.seated && ctx.roadevents && ctx.roadevents.unseat) ctx.roadevents.unseat(job.person);
        const o = job.person.obj; if (o.parent) o.parent.remove(o);
        job.person = null;
    }
}
export { luluSay };
