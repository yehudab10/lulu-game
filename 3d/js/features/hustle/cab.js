// features/hustle — 🚕 LULU CAB: a shift of three fares with personalities.
//
// Each fare waits on the right shoulder (beacon). Slow down next to them → they
// stride over and hop in (one eased animation). Then: get them to the drop-off
// beacon before the meter runs out. Tips: seconds left, near misses, ramp jumps
// (the influencer LOVES those; Gertie the chicken does not), minus crashes; Mr.
// Katz tips for staying under the limit. "Follow that car!" swaps the drop-off
// for a blue sedan to tail. On-time fares chain a streak bonus. Late? 15 s of
// grace (no tip, streak broken), then they hop out at the next light.
import * as THREE from "three";
import { ctx, emit, MPH } from "../../core/ctx.js";
import { addCoins, addScore } from "../../core/driving.js";
import { registerKind } from "../../traffic.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { FARES, CAB, PAY, TUNE, JOBS } from "./data.js";
import { registerJob, finishJob } from "./jobs.js";
import { boardRider, unboardRider, unseat, seatWorld } from "./rider.js";
import { need, models, cloneWithColors, findNodes, pt, rand, pick, clamp, carDist, bubble, burst } from "./util.js";
import * as SFX from "./sfx.js";

registerKind("hustle_mark", { len: 4.4, halfW: 0.9, circles: [1.3, -1.3], r: 0.95, mass: 1.2, model: "sedan", colors: { Paint: "#1E66D0" } });

const GRACE = 15, FOLLOW_NEED = 18;
const PROP = { chicken: "hustle_chicken", selfie: "hustle_selfie" };

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

registerJob("cab", (opts = {}) => {
    const order = opts.fares ? opts.fares.map(id => FARES.find(f => f.id === id)).filter(Boolean) : shuffle(FARES.slice()).slice(0, TUNE.cabFares);
    const job = {
        id: "cab", def: JOBS.cab, phase: "pickup", t: 0,
        fares: order, i: -1, paid: 0, lost: 0, streak: 0, bestStreak: 0,
        sums: { fares: 0, tips: 0, streak: 0 }, names: [], hold: 0, cur: null,
        intro: `DVORAH (dispatch): "${pick(CAB.dispatch)}"`,
        line() {
            const c = this.cur;
            if (!c) return "Waiting for dispatch…";
            if (this.phase === "pickup" || this.phase === "board") return `${CAB.pickupLine(c.fare)} — ${c.fare.who}`;
            if (c.fare.kind === "follow" && !c.revealed) return `${CAB.toLine(c.fare)} ${"●".repeat(Math.min(5, Math.floor(c.followT / FOLLOW_NEED * 5)))}${"○".repeat(5 - Math.min(5, Math.floor(c.followT / FOLLOW_NEED * 5)))}`;
            return CAB.toLine(c.fare) + (c.late ? " (LATE!)" : "");
        },
        get emoji() { return this.cur ? this.cur.fare.emoji : "🚕"; },
        timeLeft() {
            const c = this.cur;
            if (!c || this.phase !== "ride" && this.phase !== "drop") return null;
            return c.late ? Math.max(0, GRACE - (c.rideT - c.T)) : Math.max(0, c.T - c.rideT);
        },
        target() {
            const c = this.cur;
            if (!c) return null;
            if (this.phase === "pickup") return c.stand;
            if (this.phase === "ride") {
                if (c.fare.kind === "follow" && !c.revealed) return c.mark || null;     // a traffic car: has x / z
                return c.drop;
            }
            return null;
        },
        get follow() { const c = this.cur; return c && c.mark && !c.revealed && this.phase === "ride" ? c.mark.obj : null; },
        meters() {
            const c = this.cur;
            if (!c || this.phase !== "ride") return null;
            const tip = Math.max(0, Math.round(c.tip));
            return [{ cls: "tip", label: `💵 tip ${tip}`, frac: clamp(tip / 30, 0, 1) }, ...(this.streak > 0 ? [{ cls: "streak", label: `🔥 ×${this.streak + 1}`, frac: 1 }] : [])];
        },
        update(dt) { tick(this, dt); },
        onEvent(name, e) { onEvent(this, name, e); },
        summary(result, why) { return summary(this, result, why); },
        dispose() { dispose(this); },
    };
    nextFare(job);
    return job;
});

// ── fares ─────────────────────────────────────────────────────────────────
function nextFare(job) {
    job.i++;
    if (job.cur) cleanupFare(job.cur, false);
    job.cur = null;
    if (job.i >= job.fares.length) { finishJob(job.paid > 0 ? "pass" : "fail", job.paid > 0 ? "shift" : "nofares"); return; }
    const fare = job.fares[job.i];
    const car = ctx.car;
    const s = car.s + (job.i === 0 ? rand(230, 300) : rand(260, 360));
    const c = { fare, s, stand: { x: 0, z: 0 }, drop: null, person: null, prop: null, wings: null, T: 0, rideT: 0, late: false,
        tip: 0, cd: 1.5, talkT: 0, slowT: 0, fastT: 0, smoothT: 0, legalT: 0, flap: 0, cheer: 0, followT: 0, lostT: 0, revealed: false, mark: null, ready: false };
    const p = pt(s, 9.4);
    c.stand.x = p.x; c.stand.z = p.z;
    job.cur = c;
    job.phase = "pickup";
    const keys = [fare.model].concat(fare.prop ? [PROP[fare.prop]] : []);
    need(keys).then(ok => {
        if (job.cur !== c || !ok || !ctx.world) return;
        const person = spawnPerson(fare.model);
        person.obj.position.set(c.stand.x, 0, c.stand.z);
        person.obj.rotation.y = Math.atan2(ctx.car.pos.x - c.stand.x, ctx.car.pos.z - c.stand.z);
        ctx.scene.add(person.obj);
        c.person = person;
        if (fare.prop === "chicken") {
            const ch = cloneWithColors(models.hustle_chicken);
            const body = findNodes(person.obj, "Body")[0] || person.obj;
            body.add(ch);
            ch.position.set(0, 0.92, 0.27);
            ch.rotation.y = 0;
            c.prop = ch;
            c.wings = findNodes(ch, "Wing_");
        } else if (fare.prop === "selfie") {
            const st = cloneWithColors(models.hustle_selfie);
            const arm = findNodes(person.obj, "Arm_R")[0] || person.obj;
            arm.add(st);
            st.position.set(0, -0.44, 0.03);
            st.rotation.set(Math.PI / 2 - 0.35, 0, 0);
            c.prop = st;
        }
        c.ready = true;
    });
    if (job.i > 0) H.toast(pick(CAB.next), "gold");
}

function cleanupFare(c, quiet) {
    if (c.mark) { const m = c.mark; c.mark = null; if (ctx.traffic.cars.includes(m)) ctx.traffic.remove(m); }
    if (c.person && quiet) { unseat(c.person); if (c.person.obj.parent) c.person.obj.parent.remove(c.person.obj); }
}

function pose(c) {
    return () => {
        const o = { sit: true, talk: c.talkT > 0 };
        if (c.cheer > 0 && c.fare.kind !== "careful") o.cheer = true;
        if (c.fare.prop === "selfie") o.point = true;
        if (c.fare.kind === "follow" && !c.revealed && Math.sin(ctx.time * 1.7) > 0.4) o.point = true;
        if (c.fare.kind === "careful" && c.talkT > 0) o.point = true;
        return o;
    };
}

function speak(job, cat, force = false) {
    const c = job.cur;
    if (!c || !c.person) return;
    if (!force && c.cd > 0) return;
    const list = c.fare.lines[cat];
    if (!list || !list.length) return;
    c.cd = 4.2;
    c.talkT = 1.6;
    bubble(pick(list), c.person.obj, { dur: 2.8, y: 1.3, cls: cat === "crash" || cat === "late" || cat === "far" || cat === "slow" && c.fare.kind === "stunts" ? "angry" : "nice" });
}
function tipDelta(job, v, label) {
    const c = job.cur;
    if (!c || !v) return;
    c.tip += v;
    if (Math.abs(v) >= 3) H.toast(`${v > 0 ? "💵" : "💸"} ${label} ${v > 0 ? "+" : "−"}${Math.abs(Math.round(v))} tip`, v > 0 ? "gold" : "red", { key: "hs-tip" + (v > 0 ? "+" : "-") });
}

// ── per frame ─────────────────────────────────────────────────────────────
function tick(job, dt) {
    const c = job.cur;
    const car = ctx.car;
    if (!c) return;
    c.cd -= dt; c.talkT -= dt; c.cheer -= dt; c.flap = Math.max(0, c.flap - dt);
    if (c.wings) { const f = c.flap > 0 ? Math.sin(ctx.time * 42) * 0.9 : Math.sin(ctx.time * 3) * 0.05; c.wings.forEach((w, k) => { w.rotation.z = (k ? -1 : 1) * (0.1 + Math.abs(f)); }); }
    if (job.hold > 0) job.hold -= dt;

    if (job.phase === "pickup") {
        if (!c.ready) return;
        const d = carDist(c.stand.x, c.stand.z);
        const ahead = c.s - car.s;
        const p = c.person;
        p.face(car.pos.x, car.pos.z, dt, 3);
        p.update(dt, { wave: ahead < 140 && ahead > -10 });
        if (d < 55 && car.speed > TUNE.stopSpeed) H.prompt(`🚕 Slow down next to ${c.fare.name} to pick up`);
        else if (d >= 55) H.prompt("");
        if (d < TUNE.stopR && car.speed < TUNE.stopSpeed) { H.prompt(""); board(job); return; }
        if (ahead < -30) {
            // drove right past them: they'll wait further up (a little grumpy)
            bubble(pick(CAB.missed), p.obj, { dur: 2.2, y: 2.0, cls: "angry" });
            const s = car.s + rand(200, 260), q = pt(s, 9.4);
            c.s = s; c.stand.x = q.x; c.stand.z = q.z;
            p.obj.position.set(q.x, 0, q.z);
            c.tip -= 4;
            H.toast(`📟 They'll wait up the road… (−4 tip)`, "red", { key: "hs-missed" });
            H.prompt("");
        }
        return;
    }
    if (job.phase === "board") return;
    if (job.phase !== "ride") return;

    // ── the ride ──
    c.rideT += dt;
    const mph = car.speed * MPH;
    const k = c.fare.kind;
    // personalities
    if (k === "stunts") {
        if (car.speed < 15) { c.slowT += dt; if (c.slowT > 5) { c.slowT = 0; tipDelta(job, -2, "boring!"); speak(job, "slow"); } } else c.slowT = Math.max(0, c.slowT - dt);
        if (ctx.G.boosting) { c.fastT += dt; if (c.fastT > 2) { c.fastT = 0; tipDelta(job, 1, "speed run"); speak(job, "fast"); } }
    } else if (k === "careful") {
        if (mph > 70) { c.fastT += dt; if (c.fastT > 2.2) { c.fastT = 0; tipDelta(job, -2, "speeding"); speak(job, "fast"); } } else { c.fastT = 0; c.legalT += dt; if (c.legalT > 9 && car.speed > 12) { c.legalT = 0; tipDelta(job, 3, "nice and legal"); speak(job, "careful"); } }
    } else if (k === "smooth") {
        c.smoothT += dt;
        if (c.smoothT > 11) { c.smoothT = 0; tipDelta(job, 3, "smooth ride"); speak(job, "smooth"); }
        if (ctx.G.boosting && c.cd < 0) speak(job, "fast");
    } else if (k === "rush") {
        if (ctx.G.boosting) { c.fastT += dt; if (c.fastT > 2.5) { c.fastT = 0; speak(job, "fast"); } }
        if (car.speed < 13) { c.slowT += dt; if (c.slowT > 4) { c.slowT = 0; speak(job, "slow"); } } else c.slowT = 0;
    }
    if (k === "follow" && !c.revealed) { followTick(job, c, dt); return; }
    // the meter
    if (!c.late && c.rideT >= c.T) { c.late = true; job.streak = 0; speak(job, "late", true); H.toast("⏱ LATE! No tip now — just get there!", "red"); }
    if (c.late && c.rideT - c.T >= GRACE) { bail(job); return; }
    // the drop-off
    const d = carDist(c.drop.x, c.drop.z);
    if (d < 55 && car.speed > TUNE.stopSpeed) H.prompt(`🛑 Slow down to drop off ${c.fare.name}`);
    else if (d >= 55) H.prompt("");
    if (d < TUNE.stopR + 2 && car.speed < TUNE.stopSpeed + 1) { H.prompt(""); dropOff(job); return; }
    if (c.dropS - car.s < -40) {           // overshot: they direct you to a spot a bit further on
        const s = car.s + rand(90, 140), q = pt(s, 8.6);
        c.dropS = s; c.drop.x = q.x; c.drop.z = q.z;
        speak(job, "slow", true);
        H.toast("↩️ Missed the stop — there's another spot just ahead", "", { key: "hs-overshoot" });
    }
}

function board(job) {
    const c = job.cur;
    job.phase = "board";
    job.hold = 1.0;
    boardRider(c.person, { who: c.fare.name, pose: pose(c), onDone: ok => {
        if (job.cur !== c) return;
        if (!ok) { finishJob(job.paid > 0 ? "pass" : "fail", "seat"); return; }
        startRide(job);
    } });
}
function startRide(job) {
    const c = job.cur, car = ctx.car;
    job.phase = "ride";
    c.rideT = 0;
    const D = c.fare.kind === "follow" ? 0 : rand(620, 900) + job.i * 60;
    c.T = c.fare.kind === "follow" ? FOLLOW_NEED + 42 : D / 23 * c.fare.time + 7;
    if (c.fare.kind === "follow") {
        const s = car.s + 75;
        c.mark = ctx.traffic.add("hustle_mark", s, 5.25, 1, 25, { keep: true, data: { hustleMark: true }, ai: (dt, m) => markAi(c, dt, m) });
        c.mark.want = 25;
    } else {
        c.dropS = car.s + D;
        const q = pt(c.dropS, 8.6);
        c.drop = { x: q.x, z: q.z };
    }
    speak(job, "board", true);
    SFX.pickUp();
}

// "Follow that car!": a blue sedan weaving a little, at a pace you can keep up with
function markAi(c, dt, m) {
    const car = ctx.car;
    if (c.revealed) {
        m.dTarget = 9.6;
        m.speed = Math.max(0, m.speed - 9 * dt);
    } else {
        const gap = m.s - car.s;
        const want = gap > 120 ? 20 : gap < 25 ? 30 : 25.5;          // it never quite loses you on purpose
        m.speed += clamp(want - m.speed, -6 * dt, 4 * dt);
        m.laneT = (m.laneT || rand(5, 9)) - dt;
        if (m.laneT <= 0) { m.laneT = rand(6, 11); m.dTarget = m.dTarget > 3 ? 1.75 : 5.25; }
    }
    const dd = m.dTarget - m.d;
    m.d += Math.sign(dd) * Math.min(Math.abs(dd), 1.8 * dt);
    m.s += m.speed * dt;
}
function followTick(job, c, dt) {
    const m = c.mark, car = ctx.car;
    if (!m || !ctx.traffic.cars.includes(m)) { c.revealed = true; revealAt(job, c, car.s + 60); return; }
    const gap = m.s - car.s;
    if (gap > 10 && gap < 80) { c.followT += dt; c.lostT = Math.max(0, c.lostT - dt); if (c.cd < 0 && Math.random() < dt * 0.15) speak(job, "close"); }
    else if (gap <= 10) { if (c.cd < 0) speak(job, "close"); }
    else { c.lostT += dt; if (c.cd < 0) speak(job, "far"); }
    if (c.lostT > 14 || gap > 280) { c.followT = 0; c.lostT = 0; m.s = car.s + 90; m.d = 5.25; m.dTarget = 5.25; H.toast("🕵️‍♀️ There he is again — don't lose him!", ""); }
    if (c.followT >= FOLLOW_NEED) revealAt(job, c, m.s + 30);
    if (c.rideT >= c.T) { bail(job); }
}
function revealAt(job, c, s) {
    c.revealed = true;
    c.dropS = s;
    const q = pt(s, 8.6);
    c.drop = { x: q.x, z: q.z };
    c.T = c.rideT + 20;            // a fresh, generous meter to pull in after him
    speak(job, "reveal", true);
    H.toast("🕵️‍♀️ Case cracked! Pull over behind him", "gold");
}

function dropOff(job) {
    const c = job.cur, car = ctx.car;
    job.phase = "drop";
    job.hold = 0.9;
    const onTime = !c.late;
    const left = onTime ? Math.max(0, c.T - c.rideT) : 0;
    const base = Math.round(rand(PAY.fare[0], PAY.fare[1]));
    const tip = onTime ? Math.max(0, Math.round(c.tip + left * PAY.secTip * (c.fare.kind === "rush" ? 2 : 1))) : 0;
    if (onTime) { job.streak++; job.bestStreak = Math.max(job.bestStreak, job.streak); }
    const bonus = onTime && job.streak > 1 ? PAY.streak * (job.streak - 1) : 0;
    const pay = base + tip + bonus;
    addCoins(pay, "hustle");
    addScore(150 + pay * 4, "hustle");
    job.sums.fares += base; job.sums.tips += tip; job.sums.streak += bonus;
    job.paid++;
    job.names.push(c.fare.emoji);
    H.toast(`🚕 +${pay} 💰${tip ? ` (tip ${tip})` : ""}${bonus ? ` 🔥×${job.streak}` : ""}`, "gold", { merge: false });
    SFX.kaching();
    const cat = onTime ? "arrive" : "lateArrive";
    const line = pick(c.fare.lines[cat] || c.fare.lines.arrive);
    const q = pt(car.s + 1, 10.4);
    const person = c.person;
    c.lastLine = line;
    job.lastQuote = [c.fare.name.toUpperCase(), line];
    unboardRider(person, q.x, q.z, { mood: onTime ? "cheer" : "wave", linger: 3.6, walkAway: 1.2, onLand: () => bubble(line, person.obj, { dur: 3, y: 2.0, cls: "nice" }) });
    c.person = null;
    emit("stat", { id: "hustleFares", n: 1 });
    nextFare(job);
}
/** Out of time, out of patience: they hop out at the next light (no pay, streak gone). */
function bail(job) {
    const c = job.cur, car = ctx.car;
    job.streak = 0;
    job.lost++;
    const q = pt(car.s + 2, 10.4);
    const person = c.person;
    if (person) unboardRider(person, q.x, q.z, { mood: "storm", linger: 2.4, walkAway: 1.6, onLand: () => bubble(pick(CAB.walkOff), person.obj, { dur: 2.4, y: 2.0, cls: "angry" }) });
    c.person = null;
    H.toast(`😤 ${c.fare.name} bailed — no fare`, "red");
    job.lastQuote = [c.fare.name.toUpperCase(), pick(CAB.walkOff)];
    nextFare(job);
}

// ── events ────────────────────────────────────────────────────────────────
function onEvent(job, name, e) {
    const c = job.cur;
    if (!c || job.phase !== "ride") return;
    const k = c.fare.kind;
    if (name === "closeCall") {
        const v = k === "stunts" ? 8 : k === "careful" ? -3 : k === "smooth" ? -1 : PAY.nearMiss;
        tipDelta(job, v, k === "stunts" ? "CONTENT!" : k === "careful" ? "near miss" : "near miss");
        speak(job, "nearMiss");
        if (k === "smooth") c.flap = 0.8;
    } else if (name === "jump") {
        const v = k === "stunts" ? 14 : k === "smooth" ? -7 : k === "careful" ? -5 : PAY.jump;
        tipDelta(job, v, k === "stunts" ? "VIRAL!" : "airtime");
        speak(job, "jump", true);
        c.cheer = 1.2;
        c.smoothT = 0;
        if (k === "smooth") { c.flap = 1.6; feathers(c); }
    } else if (name === "crash") {
        const imp = e.impact || 0;
        if (imp < 3) return;
        const v = k === "stunts" ? -2 : k === "smooth" ? -9 : PAY.crash;
        tipDelta(job, v, "crash");
        speak(job, "crash", true);
        c.smoothT = 0;
        if (k === "smooth") { c.flap = 1.6; feathers(c); }
        if (e.car && e.car === c.mark) tipDelta(job, -5, "rammed the mark");
    } else if (name === "chase" && e.active) {
        if (c.person) bubble(k === "stunts" ? "A POLICE CHASE?! This is the best day of my LIFE!" : k === "careful" ? "I KNEW this would happen." : "Are those sirens for US?!", c.person.obj, { dur: 2.8, y: 1.3, cls: "angry" });
    }
}
function feathers(c) {
    SFX.feathers();
    if (!c.person) return;
    seatWorld(_tmp);
    burst(_tmp.x, _tmp.y + 1.1, _tmp.z, 14, 2.6, [1, 1, 1], 0.32, 1.1);
}
const _tmp = new THREE.Vector3();

// ── end ───────────────────────────────────────────────────────────────────
function summary(job, result, why) {
    const rows = [];
    if (job.paid) rows.push([`Fares (${job.paid}${job.lost ? ` · ${job.lost} bailed` : ""})`, `+${job.sums.fares}`]);
    if (job.sums.tips) rows.push(["💵 Tips", `+${job.sums.tips}`]);
    if (job.sums.streak) rows.push([`🔥 On-time streak ×${job.bestStreak}`, `+${job.sums.streak}`]);
    const pay = job.sums.fares + job.sums.tips + job.sums.streak;
    const whyText = result === "pass" ? (job.lost ? "Shift's over. Not every fare made it, but the meter doesn't lie." : "Shift's over. Dvorah says you're 'not the worst'.")
        : why === "wreck" ? "You wrecked the cab. Dvorah is 'taking you off the board'."
        : why === "busted" ? "A cab, pulled over. The fare walked. Dvorah is NOT calling your lawyer."
        : why === "foot" ? "No car, no cab. That's the whole business model."
        : "Not one fare paid. Dvorah wants to 'talk about your future'.";
    const quote = job.lastQuote || ["DVORAH (dispatch)", result === "pass" ? "Same time tomorrow, hon. Bring gum." : "Hon. HON. What happened?"];
    return { sub: result === "pass" ? "shift over" : "fired", rows, pay, whyText, quote, logLine: `LULU CAB · ${job.paid}/${job.fares.length} fares ${job.names.join("")}`,
        best: { fares: job.paid, streak: job.bestStreak } };
}
function dispose(job) {
    const c = job.cur;
    if (c) cleanupFare(c, true);
    job.cur = null;
    H.prompt("");
}

/** The car stops while someone climbs in / out (hooked in index.js). */
export function cabHold(ctl) {
    const job = ctx.hustle && ctx.hustle.job;
    if (!job || job.id !== "cab" || !(job.hold > 0)) return;
    ctl.throttle = 0;
    ctl.brake = Math.max(ctl.brake, 0.8);
}
