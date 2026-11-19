// features/hustle — 💰 THE GETAWAY: Uncle Moishe's comedically incompetent crew
// "liberates" the jackpot from the LUCKY 7 BINGO HALL.
//
//   1. drive to the bingo hall (beacon) and pull up
//   2. the heist exit — a short cutscene (state "hustleHeist", ⏭ skippable): the alarm,
//      the crew piling out with money bags and hopping in (one eased move each)
//   3. ★★★ — ctx.law.startChase(…, { heat: 3 }); lose the cops (law's EVADING meter).
//      Hard crashes knock a money bag out of the car (your cut shrinks)
//   4. reach the safehouse (Uncle's "storage unit"): the door rolls up, the crew
//      hops out, you get your cut. Busted / wrecked = job failed.
import * as THREE from "three";
import { ctx, emit, addActor, registerState, setState } from "../../core/ctx.js";
import { addCoins, addScore, updateDriving } from "../../core/driving.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { CREW, GETAWAY, PAY, TUNE, JOBS } from "./data.js";
import { registerJob, finishJob, J } from "./jobs.js";
import { boardRider, unboardRider, seat, unseat, seatWorld, ease } from "./rider.js";
import { need, models, cloneWithColors, findNodes, pt, placeFacing, rand, pick, carDist, bubble, burst, reserve, solid, unbuiltAhead } from "./util.js";
import { caption } from "./ui.js";
import * as SFX from "./sfx.js";

const HALL_D = 18, SAFE_D = 17.5, PICK_D = 8.4;
const MODELS = ["hustle_bingo", "hustle_safehouse", "hustle_crew", "hustle_moneybag"];
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

/** A set piece that stays on the roadside until Lulu is well past it (then it's dropped). */
function setPiece(key, s, d, why, circles) {
    const obj = cloneWithColors(models[key]);
    placeFacing(obj, s, d, 1);
    ctx.scene.add(obj);
    const undo = reserve(s - 18, s + 18, 1, 9, d + 16);
    // round colliders across the building's footprint (local x along the front, depth behind it)
    const pts = circles.map(([x, back, r]) => {
        _v.set(x, 0, -back).applyAxisAngle(_w.set(0, 1, 0), obj.rotation.y).add(obj.position);
        return { x: _v.x, z: _v.z, r };
    });
    const piece = { obj, s, alive: true, door: findNodes(obj, "Door")[0] || null, anchor: findNodes(obj, "Anchor_door")[0] || null };
    piece.actor = addActor({
        update() { return piece.alive && ctx.car.s - s < 170; },
        collide: solid(pts, why),
        dispose() { piece.alive = false; if (obj.parent) obj.parent.remove(obj); undo(); },
    });
    return piece;
}
function dropPiece(p) { if (p && p.alive) { p.alive = false; } }   // its actor removes it next frame

registerJob("getaway", (opts = {}) => {
    const job = {
        id: "getaway", def: JOBS.getaway, phase: "toHall", t: 0,
        intro: opts.via === "payphone" ? GETAWAY.payphone : "Uncle Moishe: \"Bingo hall, up the road. Bring the convertible. Don't tell your mother.\"",
        hall: null, safe: null, hallS: 0, safeS: 0, pick: null, safeAt: null, crew: [], bags: 3, lost: 0, heat: 0, maxHeat: 0,
        heisted: false, ready: false, chatT: 6, splitT: 0, escapedAt: 0,
        line() {
            if (this.phase === "toHall") return GETAWAY.toHall;
            if (this.phase === "escape") return `${GETAWAY.loseCops} ${"★".repeat(Math.max(1, this.heat))}`;
            if (this.phase === "toSafe") return ctx.law && ctx.law.chasing ? GETAWAY.noCopsYet : GETAWAY.toSafe;
            if (this.phase === "split") return "Splitting the take…";
            return "…";
        },
        emoji: "💰",
        timeLeft() { return null; },
        target() {
            if (this.phase === "toHall") return this.pick;
            if (this.phase === "toSafe" && !(ctx.law && ctx.law.chasing)) return this.safeAt;
            return null;
        },
        meters() {
            if (this.phase === "toHall") return null;
            return [{ cls: "bags", label: `💰 bags ${this.bags - this.lost}/${this.bags}`, frac: (this.bags - this.lost) / this.bags }];
        },
        update(dt) { tick(this, dt); },
        onEvent(name, e) { onEvent(this, name, e); },
        summary(result, why) { return summary(this, result, why); },
        dispose() { dispose(this); },
    };
    placeHall(job, unbuiltAhead(TUNE.setAhead));
    need(MODELS).then(ok => { job.ready = ok; if (ok && job.hall === null && J.job === job) placeHall(job, Math.max(job.hallS, ctx.car.s + 260)); });
    return job;
});

function placeHall(job, s) {
    job.hallS = s;
    const q = pt(s, PICK_D);
    job.pick = { x: q.x, z: q.z };
    if (!models.hustle_bingo) { job.hall = null; return; }
    if (job.hall) dropPiece(job.hall);
    job.hall = setPiece("hustle_bingo", s, HALL_D, "The bingo hall has a strict no-cars policy", [[-5, 5, 4.2], [0, 5, 4.2], [5, 5, 4.2]]);
}
function placeSafe(job, s) {
    job.safeS = s;
    const q = pt(s, PICK_D);
    job.safeAt = { x: q.x, z: q.z };
    if (job.safe) dropPiece(job.safe);
    job.safe = models.hustle_safehouse ? setPiece("hustle_safehouse", s, SAFE_D, "That's a storage unit, not a drive-thru", [[-2.6, 3.8, 3.4], [2.6, 3.8, 3.4]]) : null;
}

function tick(job, dt) {
    const car = ctx.car;
    if (job.phase === "toHall") {
        if (!job.ready) return;
        const d = carDist(job.pick.x, job.pick.z);
        if (d < 60 && car.speed > TUNE.stopSpeed + 1.5) H.prompt("💰 Pull up at the bingo hall's door");
        else if (d >= 60) H.prompt("");
        if (d < TUNE.stopR + 1 && car.speed < TUNE.stopSpeed + 1.5) { H.prompt(""); setState("hustleHeist", { job }); return; }
        if (job.hallS - car.s < -45) {
            H.toast("🕶️ Uncle: \"You MISSED it?! …there's another branch up the road.\"", "", { key: "hs-miss" });
            placeHall(job, car.s + TUNE.setAhead);
        }
        return;
    }
    // crew chatter on the way
    job.chatT -= dt;
    if (job.chatT <= 0 && job.crew.length) {
        job.chatT = rand(6, 9);
        const who = pick(job.crew);
        if (who && who.person && (job.phase === "escape" || Math.random() < 0.4)) bubble(pick(GETAWAY.chase), who.person.obj, { dur: 2.8, y: 1.3, cls: "angry" });
    }
    if (ctx.law && ctx.law.chasing) { job.heat = ctx.law.wanted; job.maxHeat = Math.max(job.maxHeat, job.heat); }
    if (job.phase === "escape") {
        if (!ctx.law) { job.phase = "toSafe"; placeSafe(job, car.s + TUNE.setAhead); }
        else if (!ctx.law.chasing && job.t - job.escapedAt > 1 && job.escapedAt > 0) { job.phase = "toSafe"; placeSafe(job, car.s + TUNE.setAhead); }
        return;
    }
    if (job.phase === "toSafe") {
        if (ctx.law && ctx.law.chasing) { job.phase = "escape"; job.escapedAt = 0; return; }
        const d = carDist(job.safeAt.x, job.safeAt.z);
        if (d < 60 && car.speed > TUNE.stopSpeed + 1) H.prompt("🏚️ Pull in at the safehouse");
        else if (d >= 60) H.prompt("");
        if (d < TUNE.stopR + 1 && car.speed < TUNE.stopSpeed + 1) { H.prompt(""); split(job); return; }
        if (job.safeS - car.s < -45) { H.toast("🕶️ \"The OTHER storage unit, Lulu.\"", "", { key: "hs-miss" }); placeSafe(job, car.s + TUNE.setAhead); }
        return;
    }
    if (job.phase === "split") {
        job.splitT += dt;
        if (job.safe && job.safe.door) job.safe.door.position.y = Math.min(1, ease(Math.min(1, job.splitT / 1.2))) * 2.9;
        if (job.splitT > 2.4) finishJob("pass", "split");
    }
}

function split(job) {
    job.phase = "split";
    job.splitT = 0;
    SFX.door();
    const car = ctx.car;
    // the crew hops out and shuffles into the lock-up
    job.crew.forEach((m, k) => {
        if (!m.person || !m.seated) return;
        const q = pt(job.safeS + (k - 1) * 1.6, SAFE_D - 1.5);
        m.seated = false;
        unboardRider(m.person, q.x, q.z, { mood: "cheer", linger: 2.6 + k * 0.2, walkAway: 0, dur: 0.9 + k * 0.15 });
    });
    job.crew = [];
    bubble(pick(GETAWAY.arrive), car.obj, { dur: 3, y: 2.4, cls: "nice" });
}

function onEvent(job, name, e) {
    if (name === "chase") {
        if (e.active) { if (job.phase === "toSafe") job.phase = "escape"; return; }
        if (e.result === "busted") { finishJob("fail", "busted"); return; }
        if (job.phase === "escape") {
            job.escapedAt = job.t;
            const who = pick(job.crew);
            if (who && who.person) bubble(pick(GETAWAY.escaped), who.person.obj, { dur: 3, y: 1.3, cls: "nice" });
        }
        return;
    }
    if (name === "crash" && (e.impact || 0) > 7 && (job.phase === "escape" || job.phase === "toSafe") && job.lost < job.bags) {
        loseBag(job);
    }
}
function loseBag(job) {
    job.lost++;
    const m = job.crew.find(c => c.bag && c.bag.parent);
    if (m) { m.bag.parent.remove(m.bag); m.bag = null; }
    // a bag bounces out of the car in a long arc and bursts into green confetti
    const car = ctx.car;
    seatWorld(_v);
    const bag = cloneWithColors(models.hustle_moneybag);
    bag.position.copy(_v);
    ctx.scene.add(bag);
    const from = _v.clone(), to = new THREE.Vector3(car.pos.x - Math.sin(car.h) * 9 + Math.cos(car.h) * 3, 0, car.pos.z - Math.cos(car.h) * 9 - Math.sin(car.h) * 3);
    let t = 0;
    addActor({
        update(dt) {
            t += dt;
            const k = Math.min(1, t / 0.9);
            bag.position.lerpVectors(from, to, k);
            bag.position.y = from.y * (1 - k) + Math.sin(Math.PI * k) * 2.4;
            bag.rotation.x += dt * 9;
            if (k >= 1) { burst(to.x, 0.4, to.z, 18, 4, [0.35, 0.8, 0.4], 0.4, 1.2); return false; }
            return true;
        },
        dispose() { if (bag.parent) bag.parent.remove(bag); },
    });
    SFX.splosh();
    H.toast(`💸 ${pick(GETAWAY.bagLost)}`, "red", { key: "hs-bag" });
    emit("hustle:bag", { lost: job.lost });
}

function summary(job, result, why) {
    if (result !== "pass") {
        const q = why === "busted" ? pick(GETAWAY.busted) : why === "wreck" ? GETAWAY.wrecked[0] : GETAWAY.quit[0];
        return { sub: why === "busted" ? "BUSTED" : "it all went wrong", rows: [], pay: 0, quote: q,
            whyText: why === "busted" ? "The cops caught the getaway car. The crew is 'helping with enquiries'." : why === "wreck" ? "The getaway car got wrecked. So did the getaway." : "The crew scattered.",
            logLine: "THE GETAWAY · " + (why === "busted" ? "busted" : "botched") };
    }
    const base = Math.round(rand(PAY.getaway[0], PAY.getaway[1]));
    const kept = Math.round(base * Math.max(0.25, 1 - job.lost * PAY.bagLost));
    const heat = PAY.heatBonus * Math.max(job.maxHeat, ctx.law ? 1 : 0);
    const pay = kept + heat;
    addCoins(pay, "hustle");
    addScore(1500 + pay * 3, "hustle");
    emit("stat", { id: "hustleHeists", n: 1 });
    const rows = [["Your cut of the jackpot", `+${base}`]];
    if (job.lost) rows.push([`💸 Bags lost (${job.lost}/${job.bags})`, `−${base - kept}`, "neg"]);
    if (heat) rows.push([`🚨 Heat shaken off (${"★".repeat(Math.max(1, job.maxHeat))})`, `+${heat}`]);
    return { sub: "clean getaway", rows, pay, quote: pick(GETAWAY.pass), whyText: "The bingo hall's 'refund' has been processed.",
        logLine: `THE GETAWAY · ${job.bags - job.lost}/${job.bags} bags`, best: { take: pay }, again: false };
}

function dispose(job) {
    for (const m of job.crew) {
        if (!m.person) continue;
        if (m.seated) {
            // the crew bails out at the next light and legs it
            const q = pt(ctx.car.s + 2, 10.5);
            m.seated = false;
            unboardRider(m.person, q.x, q.z, { mood: "storm", linger: 2.2, walkAway: 3 });
        } else { unseat(m.person); if (m.person.obj.parent) m.person.obj.parent.remove(m.person.obj); }
    }
    job.crew = [];
    H.prompt("");
    caption("", "");
    // the set pieces stay as scenery until she's well past them (their actors drop them)
}

// ── the heist exit (a skippable cutscene) ────────────────────────────────
const CUT = { job: null, t: 0, crew: [], line: -1, done: false, chased: false };
const BEATS = [0.7, 1.45, 2.2];        // when each crew member bursts out of the door
const LINES = [[0.5, 0], [1.9, 1], [3.1, 2], [4.3, 3]];
registerState("hustleHeist", {
    hud: false, touch: false, pausable: true, world: true,
    skip: () => !!CUT.job && !CUT.done,
    enter({ job }) {
        Object.assign(CUT, { job, t: 0, crew: [], line: -1, done: false, chased: false });
        job.phase = "heist";
        job.heisted = true;
        ctx.cam.blend(0.6);
        if (ctx.law && ctx.law.hold) ctx.law.hold(8);
        SFX.alarm(3.4);
        const hall = job.hall;
        const door = new THREE.Vector3();
        if (hall && hall.anchor) hall.anchor.getWorldPosition(door);
        else { const q = pt(job.hallS, HALL_D - 0.6); door.set(q.x, 0, q.z); }
        CUT.door = door;
        CREW.forEach((c, k) => {
            const p = spawnPerson("hustle_crew", { colors: c.colors });
            p.obj.position.copy(door);
            p.obj.visible = false;
            const bag = cloneWithColors(models.hustle_moneybag);
            const arm = findNodes(p.obj, "Arm_L")[0] || p.obj;
            arm.add(bag);
            bag.position.set(0.05, -0.62, 0.05);
            bag.scale.setScalar(0.85);
            ctx.scene.add(p.obj);
            CUT.crew.push({ person: p, bag, name: c.name, out: false, boarding: false, seated: false, at: BEATS[k] });
        });
        job.crew = CUT.crew;
        emit("hustle:heist", {});
    },
    update(dt) {
        const job = CUT.job;
        if (!job) { setState("playing"); return; }
        CUT.t += dt;
        updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true });
        const car = ctx.car;
        seatWorld(_w);
        for (const m of CUT.crew) {
            const p = m.person;
            if (!m.out) { if (CUT.t >= m.at) { m.out = true; p.obj.visible = true; burst(CUT.door.x, 1.2, CUT.door.z, 8, 2.4, [1, 0.9, 0.4], 0.35, 0.6); } continue; }
            if (m.boarding || m.seated) continue;
            // sprint for the car (Little Yossi trips over his bag halfway — he's fine)
            const dx = _w.x - p.obj.position.x, dz = _w.z - p.obj.position.z, d = Math.hypot(dx, dz);
            const trip = m.name === "Little Yossi" && d < 6.5 && d > 4.2 && !m.tripped;
            if (trip) { m.tripped = 0.5; }
            if (m.tripped > 0) { m.tripped -= dt; p.update(dt, { cheer: true }); if (m.tripped <= 0) m.tripped = -1; continue; }
            if (d > 2.6) {
                const sp = 6.2 * dt;
                p.obj.position.x += dx / d * sp; p.obj.position.z += dz / d * sp;
                p.obj.rotation.y = Math.atan2(dx, dz);
                p.update(dt, { walk: 5.5 });
            } else {
                m.boarding = true;
                boardRider(p, { dur: 0.75, who: m.name, arc: 1.1, pose: () => ({ sit: true, cheer: ctx.law && ctx.law.chasing && Math.sin(ctx.time * 2 + p.t) > 0.7 }),
                    onDone: () => { m.boarding = false; m.seated = true; } });
            }
        }
        for (const [at, i] of LINES) if (CUT.t >= at && CUT.line < i) { CUT.line = i; const [who, text] = GETAWAY.exit[i]; caption(who, text); }
        const all = CUT.crew.every(m => m.seated);
        if ((all && CUT.t > 5.2) || CUT.t > 9) {
            CUT.done = true;
            caption("", "");
            for (const m of CUT.crew) if (!m.seated) { m.person.obj.visible = true; m.boarding = false; m.seated = true; unseat(m.person); boardSnap(m); }
            go(job);
        }
    },
    camera(dt) {
        const job = CUT.job;
        if (!job) return false;
        const car = ctx.car;
        if (CUT.t < 2.9) {
            const q = pt(job.hallS - 13, -1.5);
            _v.set(q.x, 2.4, q.z);
            ctx.cam.cinematic(_v, _w.set(CUT.door.x, 1.6, CUT.door.z), dt, 2.4, 48);
        } else {
            const a = car.h + Math.PI + 0.55;
            _v.set(car.pos.x + Math.sin(a) * 7.5, 3.0, car.pos.z + Math.cos(a) * 7.5);
            ctx.cam.cinematic(_v, _w.set(car.pos.x, 1.0, car.pos.z), dt, 2.0, 52);
        }
        return true;
    },
    exit() { caption("", ""); if (!CUT.done && CUT.job && J.job === CUT.job) { CUT.done = true; } CUT.job = null; },
});
function boardSnap(m) {
    // fell behind while skipping / a timeout: straight into the seat
    seat(m.person, { who: m.name, pose: () => ({ sit: true }) });
}
function go(job) {
    setState("playing");
    job.phase = "escape";
    caption("", "");
    if (ctx.law && ctx.law.startChase) {
        ctx.law.startChase("GRAND THEFT BINGO", { heat: 3, msg: "🚨 ★★★ BINGO HALL ROBBERY!", charges: ["GRAND THEFT BINGO", "FLEEING THE SCENE"] });
        job.heat = ctx.law.wanted;
        job.maxHeat = Math.max(job.maxHeat, job.heat);
    }
    H.banner(`<b>🚨 GO GO GO!</b><small>Lose the cops, then get to the safehouse</small>`, 2200, { prio: 2, key: "hustle" });
}
