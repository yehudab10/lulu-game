// features/underworld — 🕶️ THE FIXER's dirty jobs, on hustle's side-job framework (ctx.hustle.register):
//
//   📦 THE PACKAGE    pick it up at a dead drop, deliver it against the clock without shaking it to bits
//                     (crashes squelch it); a cop who gets a good sniff gives a ⚠️ warning. It's always
//                     something absurd (40 lbs of gefilte fish, 300 left socks…) — revealed on the card.
//   🧤 THE WHEELMAN   pick up Fingers Feivel behind Kosher Kingdom → a 2★ chase starts → lose the cops →
//                     drop him at the laundromat. Busted = failed (hustle's framework).
//   🕶️ LOSE THE TAIL  a grey sedan with a goon in sunglasses follows her (the gang car's AI) — get far
//                     enough ahead before the clock runs out.
// Each pays well and adds HEAT (heat.js). Offers: the Fixer texts, then a payphone rings up the road
// (ctx.hustle.offer(id, "marker")) — or pick one in the 💼 Jobs app. Not while she's too hot.
import { ctx } from "../../core/ctx.js";
import { addScore } from "../../core/driving.js";
import * as H from "../../hud.js";
import { SPAWN, TUNE, JOB_DEFS, PAY, PACKAGES, FIXER } from "./data.js";
import { UW, live, chance, rand, pick, need, models, cloneWithColors, person, pt, carDist, lulu, bubble, toast, log, stat, earn,
    chasing, inTown, onFoot, calm, mode, drop, later as gLater } from "./common.js";
import { addHeat, heat } from "./heat.js";
import { spawnBadCar, badTick, dropBad } from "./badguys.js";

const STOP = 7.5, STOP_R = 10;
const slow = () => ctx.car.speed < STOP;

// ── offers ────────────────────────────────────────────────────────────────
/** Can the Fixer offer a job now? → "" or why not. */
export function blocked() {
    if (!live() || !ctx.hustle || !ctx.hustle.register) return "off";
    if (mode() !== "cruise") return "Dirty jobs are a 🛣️ Cruise thing.";
    if (heat() > SPAWN.fixer.maxHeat) return FIXER.tooHot;
    if (chasing() || (ctx.law && ctx.law.wanted >= 2)) return "Lose the cops first 🚓";
    return "";
}
export function fixerTick(dt) {
    if (!live() || ctx.state !== "playing" || inTown() || onFoot() || calm() || mode() !== "cruise") return;
    UW.fixT -= dt;
    if (UW.fixT > 0 || UW.runT < SPAWN.fixer.first) return;
    UW.fixT = rand(SPAWN.fixer.every[0], SPAWN.fixer.every[1]);
    const h = ctx.hustle;
    if (blocked() || !h || h.job || (h.marker && !h.marker.done) || (ctx.phone && ctx.phone.busy && ctx.phone.busy())) return;
    if (!chance(SPAWN.fixer.chance)) return;
    offer();
}
/** The Fixer texts, then a payphone rings up the road. → the job id offered */
export function offer(id = null) {
    id = id || pick(Object.keys(JOB_DEFS).filter(j => j !== UW.lastJob));
    UW.lastJob = id;
    try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: "THE FIXER", emoji: "🕶️", color: "#455A64", msg: pick(FIXER.text), thread: "fixer", dur: 5 }); } catch (e) { /* no phone */ }
    if (ctx.hustle && ctx.hustle.offer) ctx.hustle.offer(id, "marker");
    log("fixer", { offer: id });
    return id;
}
const fixerText = msg => { try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: "THE FIXER", emoji: "🕶️", color: "#455A64", msg, thread: "fixer", dur: 5 }); } catch (e) { /* no phone */ } };

// ── a beacon spot on the shoulder ────────────────────────────────────────
function spot(s, d = 8.4) { const q = pt(s, d); return { x: q.x, z: q.z, s }; }

// ── 📦 THE PACKAGE ───────────────────────────────────────────────────────
function createPackage(opts = {}) {
    const car = ctx.car;
    const job = {
        id: "uw_package", phase: "pickup", t: 0, emoji: "📦", cond: 1, tLeft: PAY.packageTime, at: spot(car.s + (opts.dist || 320)), crate: null, onCar: null, sniffT: 0, sniffed: false,
        contents: pick(PACKAGES), intro: "The Fixer: \"A package. Dead drop up the road. Don't open it. Don't SMELL it.\"",
        line() { return this.phase === "pickup" ? FIXER.pickup.package : FIXER.deliver; },
        timeLeft() { return this.phase === "deliver" ? this.tLeft : null; },
        low() { return this.phase === "deliver" && this.tLeft < 15; },
        target() { return this.at; },
        meters() { return this.phase === "deliver" ? [{ cls: "pkg", label: `📦 ${Math.round(this.cond * 100)}%`, frac: this.cond }] : null; },
        update(dt) { tickPackage(this, dt); },
        onEvent(name, e) {
            if (name === "crash" && this.phase === "deliver" && (e.impact || 0) > 4.5) {
                this.cond = Math.max(0.2, this.cond - 0.18);
                lulu(pick(FIXER.squish), true);
            }
        },
        summary(result, why) { return summaryPackage(this, result, why); },
        dispose() {
            if (this.crate) { drop(this.crate); this.crate = null; }
            if (this.onCar) { ctx.car.attach("passenger", this.prevSeat || null); this.onCar = null; }
        },
    };
    need(["uw_package"]).then(ok => {
        if (!ok || ctx.hustle.job !== job || job.phase !== "pickup") return;
        const crate = cloneWithColors(models.uw_package);
        const q = pt(job.at.s, 10.6);
        crate.position.set(q.x, 0, q.z);
        crate.rotation.y = q.h + 0.4;
        ctx.scene.add(crate);
        job.crate = crate;
    });
    return job;
}
function tickPackage(job, dt) {
    const car = ctx.car;
    if (job.phase === "pickup") {
        const d = carDist(job.at.x, job.at.z);
        if (d < STOP_R && slow()) {
            job.phase = "deliver";
            if (job.crate) { drop(job.crate); job.crate = null; }
            if (models.uw_package) {
                const c = cloneWithColors(models.uw_package);
                c.scale.setScalar(0.85);
                job.prevSeat = car.attached && car.attached.passenger;
                car.attach("passenger", c);
                job.onCar = c;
            }
            job.at = spot(car.s + rand(950, 1250));
            job.tLeft = PAY.packageTime;
            toast("📦 Got it. It's… heavier than it looks. And damp.", "", "uw:job");
            log("job", { id: job.id, phase: "deliver" });
        } else if (job.at.s - car.s < -45) job.at = spot(car.s + 300);    // missed the drop: there's another one
        return;
    }
    job.tLeft -= dt;
    // a cop who gets a good sniff: "…is that FISH?" (a warning, once)
    if (!job.sniffed && ctx.law && ctx.law.copSees) {
        if (ctx.law.copSees(car.pos.x, car.pos.z, 26)) { job.sniffT += dt; if (job.sniffT > 1.4) { job.sniffed = true; ctx.law.notice("TRANSPORTING SUSPICIOUS FISH", { msg: "🚨 WHAT'S THAT SMELL?!", warn: "🚓 “…is that FISH?”" }); } }
        else job.sniffT = Math.max(0, job.sniffT - dt);
    }
    if (carDist(job.at.x, job.at.z) < STOP_R && slow()) { ctx.hustle.end("pass", "delivered"); return; }
    if (job.at.s - car.s < -45) job.at = spot(car.s + 250);
    if (job.tLeft <= 0) ctx.hustle.end("fail", "late");
}
function summaryPackage(job, result, why) {
    if (result !== "pass") {
        const whyText = why === "late" ? FIXER.timeout.package : why === "busted" ? "The package is in an evidence locker now. It's leaking." : "The package is… somewhere. So is the client's patience.";
        return { sub: why === "late" ? "too slow" : "lost it", rows: [], pay: 0, whyText, quote: ["THE FIXER", why === "busted" ? FIXER.bustedText : "Don't call me. I'll call you."], logLine: "THE PACKAGE · " + (why || result), again: false };
    }
    const base = Math.round(rand(PAY.package[0], PAY.package[1]));
    const pay = Math.round(base * (0.45 + 0.55 * job.cond));
    earn(pay, "fixer");
    addScore(900 + pay * 3, "fixer");
    addHeat(TUNE.heat.add.package, "package");
    stat("uwJobs");
    later(() => fixerText(pick(FIXER.doneText)));
    const rows = [["The client's fee", `+${base}`]];
    if (job.cond < 1) rows.push([`📦 Condition ${Math.round(job.cond * 100)}%`, `−${base - pay}`, "neg"]);
    rows.push(["🌡️ Heat", `+${TUNE.heat.add.package}`]);
    return { sub: "delivered", rows, pay, whyText: `What was in it: ${job.contents}`, quote: ["THE FIXER", "I don't want to know. I DO want to know. No I don't."], logLine: "THE PACKAGE · delivered", again: false };
}

// ── 🧤 THE WHEELMAN ──────────────────────────────────────────────────────
function createWheelman(opts = {}) {
    const car = ctx.car;
    const job = {
        id: "uw_wheelman", phase: "pickup", t: 0, emoji: "🧤", at: spot(car.s + (opts.dist || 340)), feivel: null, seated: false, maxHeat: 0, chatT: 5, chased: false,
        intro: "The Fixer: \"Fingers Feivel. Back door of Kosher Kingdom. He'll be in a hurry.\"",
        line() { return this.phase === "pickup" ? FIXER.pickup.wheelman : this.phase === "lose" ? `${FIXER.lose} ${"★".repeat(Math.max(1, this.heat || 1))}` : FIXER.drop; },
        timeLeft() { return null; },
        target() { return this.phase === "lose" ? null : this.at; },
        meters() { return null; },
        update(dt) { tickWheelman(this, dt); },
        onEvent() {},
        summary(result, why) { return summaryWheelman(this, result, why); },
        dispose() {
            if (this.feivel) {
                if (this.seated && ctx.roadevents && ctx.roadevents.unseat) ctx.roadevents.unseat(this.feivel);
                drop(this.feivel.obj);
                this.feivel = null;
            }
        },
    };
    return job;
}
function tickWheelman(job, dt) {
    const car = ctx.car;
    if (ctx.law && ctx.law.chasing) { job.heat = ctx.law.wanted; job.maxHeat = Math.max(job.maxHeat, job.heat); }
    if (job.phase === "pickup") {
        if (carDist(job.at.x, job.at.z) < STOP_R && slow()) {
            job.phase = "lose";
            need(["uw_fixer"]).then(() => {
                if (ctx.hustle.job !== job || job.feivel) return;
                const p = person("npcMan", { Top: "#263238", Bottom: "#212121", Hair: "#212121" });
                if (!p) return;
                job.feivel = p;
                if (ctx.roadevents && ctx.roadevents.seat && ctx.roadevents.seat(p, { bonus: false, keep: true, who: "Feivel" })) job.seated = true;
            });
            bubble("GO GO GO! I only took the MACAROONS!", car.obj, { cls: "angry", y: 2.2 });
            log("job", { id: job.id, phase: "lose" });
            // the alarm: a 2★ chase (no law → straight to the drop-off)
            if (ctx.law && ctx.law.startChase && ctx.law.startChase("AIDING AND ABETTING (MACAROONS)", { heat: 2, msg: "🚨 THE KOSHER KINGDOM ALARM!" })) job.chased = true;
            else { job.phase = "drop"; job.at = spot(car.s + 500); }
        } else if (job.at.s - car.s < -45) job.at = spot(car.s + 300);
        return;
    }
    if (job.phase === "lose") {
        job.chatT -= dt;
        if (job.chatT <= 0) { job.chatT = rand(6, 9); bubble(pick(FIXER.feivel), car.obj, { cls: "angry", y: 2.2 }); }
        if (!(ctx.law && ctx.law.chasing)) {
            job.phase = "drop";
            job.at = spot(car.s + rand(450, 600));
            toast("😎 Lost 'em! Now the laundromat →", "gold", "uw:job");
            log("job", { id: job.id, phase: "drop" });
        }
        return;
    }
    if (ctx.law && ctx.law.chasing) { job.phase = "lose"; return; }        // a patrol picked her up again
    if (carDist(job.at.x, job.at.z) < STOP_R && slow()) { bubble(FIXER.feivelBye, car.obj, { cls: "nice", y: 2.2 }); ctx.hustle.end("pass", "dropped"); return; }
    if (job.at.s - car.s < -45) job.at = spot(car.s + 300);
}
function summaryWheelman(job, result, why) {
    if (result !== "pass") {
        return { sub: why === "busted" ? "BUSTED" : "botched", rows: [], pay: 0, quote: ["FINGERS FEIVEL", why === "busted" ? "I was at shiur! Ask anybody! …don't ask anybody." : "I'll take the BUS next time."],
            whyText: why === "busted" ? "Feivel's 'helping with enquiries'. He's very helpful." : "Feivel walked. With the macaroons.", logLine: "THE WHEELMAN · " + (why || result), again: false };
    }
    const base = Math.round(rand(PAY.wheelman[0], PAY.wheelman[1]));
    const bonus = PAY.wheelStar * Math.max(1, job.maxHeat);
    const pay = base + bonus;
    earn(pay, "fixer");
    addScore(1500 + pay * 3, "fixer");
    addHeat(TUNE.heat.add.wheelman, "wheelman");
    stat("uwJobs");
    later(() => fixerText(pick(FIXER.doneText)));
    return { sub: "clean getaway", rows: [["Feivel's fare", `+${base}`], [`🚨 Heat shaken off (${"★".repeat(Math.max(1, job.maxHeat))})`, `+${bonus}`], ["🌡️ Heat", `+${TUNE.heat.add.wheelman}`]], pay,
        whyText: "The macaroons are safe. Pesach is saved. Don't ask.", quote: ["FINGERS FEIVEL", FIXER.feivelBye], logLine: "THE WHEELMAN · clean", again: false };
}

// ── 🕶️ LOSE THE TAIL ─────────────────────────────────────────────────────
function createTail(opts = {}) {
    const job = {
        id: "uw_tail", phase: "lose", t: 0, emoji: "🕶️", tLeft: opts.time || PAY.tailTime, E: null, spawned: false,
        intro: "The Fixer: \"Somebody's following the client's car. That's your car now. Lose them.\"",
        line() { return this.E && this.E.result ? FIXER.lost : FIXER.pickup.tail; },
        timeLeft() { return this.tLeft; },
        low() { return this.tLeft < 12; },
        target() { return null; },
        meters() { const E = this.E; if (!E || !E.car) return null; const gap = Math.max(0, ctx.car.s - E.car.s); return [{ cls: "tail", label: `🕶️ ${Math.round(gap)} m`, frac: Math.min(1, gap / TUNE.gang.lose) }]; },
        update(dt) { tickTail(this, dt); },
        onEvent() {},
        summary(result, why) { return summaryTail(this, result, why); },
        dispose() { if (this.E) { dropBad(this.E); this.E = null; } },
    };
    spawnBadCar("tail", { behind: 45, job, force: true }).then(E => {
        if (!E) return;
        if (ctx.hustle.job !== job) { dropBad(E); return; }
        job.E = E;
        E.life = 1e9;
    });
    return job;
}
function tickTail(job, dt) {
    const E = job.E;
    if (E) badTick(dt, E);
    if (E && E.result === "escaped") { ctx.hustle.end("pass", "lost"); return; }
    job.tLeft -= dt;
    if (job.tLeft <= 0) ctx.hustle.end("fail", "late");
}
function summaryTail(job, result, why) {
    if (result !== "pass") return { sub: why === "late" ? "still followed" : "botched", rows: [], pay: 0, whyText: why === "late" ? FIXER.timeout.tail : "The client is… disappointed.", quote: ["THE FIXER", "Sloppy, kid."], logLine: "LOSE THE TAIL · " + (why || result), again: false };
    const base = Math.round(rand(PAY.tail[0], PAY.tail[1]));
    const tip = Math.round(Math.max(0, job.tLeft) * 1.5);
    earn(base + tip, "fixer");
    addScore(900 + (base + tip) * 3, "fixer");
    addHeat(TUNE.heat.add.tail, "tail");
    stat("uwJobs");
    later(() => fixerText(pick(FIXER.doneText)));
    return { sub: "lost them", rows: [["The client's fee", `+${base}`], ["⏱ Time to spare", `+${tip}`], ["🌡️ Heat", `+${TUNE.heat.add.tail}`]], pay: base + tip,
        whyText: "The grey sedan is somewhere behind a truck, crying.", quote: ["THE FIXER", "Smooth."], logLine: "LOSE THE TAIL · lost them", again: false };
}

const later = fn => gLater(6, fn);

// ── register with hustle (the Jobs app lists them while the underworld is live) ──
export function registerJobs() {
    const h = ctx.hustle;
    if (!h || !h.register || registerJobs.done) return;
    registerJobs.done = true;
    const listed = () => live() && !blocked();
    h.register("uw_package", createPackage, JOB_DEFS.uw_package, { listed });
    h.register("uw_wheelman", createWheelman, JOB_DEFS.uw_wheelman, { listed: () => listed() && !!ctx.law });
    h.register("uw_tail", createTail, JOB_DEFS.uw_tail, { listed });
}
