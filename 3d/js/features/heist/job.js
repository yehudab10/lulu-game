// features/heist — 💰 LULU'S OWN CARTOON HEIST (optional, opt-in, every step readable).
//
//   1. CASE IT: walk into a town's bank and look over the vault (bank.js — the interiors engine), or let
//      Shmulik's payphone TIP ring through (Cruise, a ctx.phone.call; honk = "not now").
//   2. PICK A PLAN (casing inside: 🤫 quiet ★★ 0.75× · 🏎️ classic ★★★ 1× · 🚀 loud ★★★★ + nitro 1.35×; the tip is the classic).
//   3. THE JOB: pull up out front of the bank → state "heistJob" (⏭ skippable): Lulu walks in with a confetti
//      blaster and a box of rugelach — "This is a stick-up… of RUGELACH!" — the alarm (Bubbe's hearing aid),
//      the confetti, out with the bags.
//   4. THE GETAWAY: ctx.law.startChase(HEIST.warrant, { heat }) — law's own escalation (reinforcements, K9s,
//      the chopper), streets' roadblocks + spike strips on the highway, our stun nets (gear.js) — and law's
//      escape tools: break line of sight, hide, take an exit, change the look. A hard crash bounces a money
//      bag out (the take shrinks).
//   5. CLEAN ESCAPE (cop:chase ended "escaped" / "disguise" / talked out of a pull-over): the take, + 30/★ — and
//      the warrant goes on file (ctx.law.addWarrant). CAUGHT (law:arrest): law's arrest → jail → court, with the
//      heist charge (law/data.js CHARGE_* + court lines). One heist a run; HEIST.cooldownMin minutes between.
import * as THREE from "three";
import { ctx, on, hook, emit, registerState, setState, css } from "../../core/ctx.js";
import { addCoins, updateDriving } from "../../core/driving.js";
import { store, saveSoon, shared } from "../../core/save.js";
import { spawnPerson } from "../../core/people.js";
import { glyph } from "../../input.js";
import * as H from "../../hud.js";
import { HEIST, PLANS, JOB, TUNE, BANK } from "./data.js";
import { models, need, live, rand, pick, inTown, onFoot, distTo, stat, best, remember, luluSays, hold,
    setChip, setBeacon, fmtM, sfx, confetti, burst } from "./common.js";

export const S = store("heist", { lastJob: 0, jobs: 0, clean: 0, busted: 0, best: 0, cased: 0 });
export const J = { plan: null, job: null, done: false, tipT: 0, tipping: false, bypass: false };

export const planById = id => PLANS.find(p => p.id === id) || PLANS[1];
/** Minutes until the next heist is allowed (0 = now). */
export function cooldownLeft() {
    if (J.bypass) return 0;
    const ms = (S.lastJob || 0) + HEIST.cooldownMin * 60000 - Date.now();
    return ms > 0 ? Math.ceil(ms / 60000) : 0;
}
/** Why a heist can't be planned right now ("" = it can). */
export function blocked() {
    if (J.done && !J.bypass) return JOB.oneRun;
    const m = cooldownLeft();
    if (m > 0) return JOB.cooldown(m);
    if (J.job) return "A job's already on!";
    return "";
}

/** The plan is set: town (null = whichever bank she reaches first), plan id, via "inside" | "tip" | "debug". */
export function setPlan(town, planId = "classic", via = "inside") {
    if (blocked()) return false;
    J.plan = { town: town || null, plan: planById(planId), via, t: 0 };
    need(["heistProps", "luluPerson"]);        // the confetti blaster, the rugelach, the money bags
    S.cased++; saveSoon();
    stat("heistCased", 1);
    emit("heist:job", { phase: "plan", town: town || "", plan: J.plan.plan.id, via });
    H.banner(JOB.onBanner, 2600, { key: "heist:job", prio: 3 });
    return true;
}
export function dropPlan() { J.plan = null; setChip(null); setBeacon(null); }

// ── the arrival: pull up out front ──────────────────────────────────────
function bankSpot() { return inTown() ? ctx.town.spot("bank") : null; }
function arrivalCheck() {
    const p = J.plan;
    if (!p || J.job || ctx.state !== "playing" || onFoot()) return;
    if (ctx.law && ctx.law.chasing) return;
    const sp = bankSpot();
    if (!sp) return;
    if (p.town && ctx.town.id !== p.town) return;
    const car = ctx.car;
    if (Math.hypot(car.pos.x - sp.x, car.pos.z - sp.z) < HEIST.arriveR && car.speed < HEIST.arriveV) startJob();
}
export function startJob() {
    const p = J.plan, sp = bankSpot();
    if (!p || !sp || J.job) return false;
    const town = ctx.town.id;
    J.job = { town, plan: p.plan, bags: HEIST.bags, lost: 0, t: 0, phase: "inside", stars: 0, maxStars: 0, door: sp, pulledT: 0 };
    J.plan = null;
    setChip(null); setBeacon(null);
    setState("heistJob", { job: J.job });
    return true;
}

// ── the cutscene ────────────────────────────────────────────────────────
css("heistcap", `
.heist-cap { position: fixed; left: 50%; bottom: 13%; transform: translateX(-50%); max-width: min(720px, 90vw); text-align: center; pointer-events: none;
  background: rgba(33,18,46,.88); color: #FFF3E0; border-radius: 18px; padding: 10px 20px; font: 600 18px var(--font, Fredoka, Arial); opacity: 0; transition: opacity .2s; z-index: 5; }
.heist-cap.on { opacity: 1; } .heist-cap b { color: #FFD740; margin-right: 6px; }
@media (max-width: 560px) { .heist-cap { font-size: 14px; bottom: 18%; } }
body.tv .heist-cap { font-size: 28px; }
`);
let capEl = null;
function caption(who, text) {
    if (!capEl) { capEl = document.createElement("div"); capEl.className = "heist-cap"; document.body.appendChild(capEl); }
    if (!text) { capEl.classList.remove("on"); return; }
    capEl.innerHTML = `<b>${who}</b>${text}`;
    capEl.classList.add("on");
}
const CUT = { job: null, t: 0, lulu: null, phase: "walk", line: -1, done: false, door: new THREE.Vector3(), inside: new THREE.Vector3() };
const LINES = [[2.4, 0], [4.4, 1], [6.3, 2], [8.0, 3]];
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function luluSide() {   // her door: the car's LEFT (+X of the model)
    const c = ctx.car;
    return { x: c.pos.x + Math.cos(c.h) * 1.4, z: c.pos.z - Math.sin(c.h) * 1.4 };
}
registerState("heistJob", {
    hud: false, touch: false, pausable: true, world: true,
    skip: () => !!CUT.job && !CUT.done,
    enter({ job }) {
        Object.assign(CUT, { job, t: 0, phase: "walk", line: -1, done: false });
        job.phase = "inside";
        if (ctx.law && ctx.law.hold) ctx.law.hold(14);
        const d = job.door;
        CUT.door.set(d.x, 0, d.z);
        CUT.inside.set(d.x - (d.nx || 0) * 4, 0, d.z - (d.nz || 0) * 4);
        const s2 = shared.get();
        const p = models.luluPerson ? spawnPerson("luluPerson", { colors: s2.luluHair ? { Hair: s2.luluHair } : null }) : null;
        if (p) {
            const at = luluSide();
            p.obj.position.set(at.x, 0, at.z);
            ctx.scene.add(p.obj);
            CUT.blaster = hold(p, "Confetti", { arm: "Arm_R", y: -0.47, z: 0.08, rx: -1.3 });
            CUT.box = hold(p, "Rugelach", { arm: "Arm_L", y: -0.48, z: 0.1, rx: -0.2 });
        }
        CUT.lulu = p;
        ctx.car.showDriver(false);
        ctx.cam.snap();
        emit("heist:job", { phase: "start", town: job.town, plan: job.plan.id });
    },
    update(dt) {
        const job = CUT.job;
        if (!job) { setState("playing"); return; }
        CUT.t += dt;
        updateDriving(dt, {}, false, { steer: 0, throttle: 0, brake: 1, handbrake: false, analog: true });
        const p = CUT.lulu, t = CUT.t;
        if (p) {
            if (CUT.phase === "walk") {
                walkTo(p, CUT.door, 3.6, dt) || t > 2.2 ? (CUT.phase = "in") : 0;
            } else if (CUT.phase === "in") {
                if (walkTo(p, CUT.inside, 3.6, dt) || t > 3.2) { p.obj.visible = false; CUT.phase = "wait"; }
            } else if (CUT.phase === "wait" && t > 8.4) {
                // out she bursts: confetti everywhere, a money bag in each hand
                p.obj.visible = true;
                p.obj.position.copy(CUT.door);
                if (CUT.box && CUT.box.parent) CUT.box.parent.remove(CUT.box);
                hold(p, "MoneyBag", { arm: "Arm_L", y: -0.5, z: 0.05, rx: 0 });
                confetti(CUT.door.x, 2.2, CUT.door.z, 40);
                sfx.pop();
                CUT.phase = "run";
            } else if (CUT.phase === "run") {
                const at = luluSide();
                _v.set(at.x, 0, at.z);
                if (walkTo(p, _v, 6.2, dt) || t > 11.5) finish(job);
            }
        } else if (t > 8.5) finish(job);
        if (t > 3.0 && t < 3.1 && !CUT.belled) { CUT.belled = true; sfx.bell(10); }
        for (const [at, i] of LINES) if (t >= at && CUT.line < i) { CUT.line = i; const [who, text] = JOB.cut[i]; caption(who, text); }
    },
    camera(dt) {
        if (!CUT.job) return false;
        const d = CUT.job.door, nx = d.nx || 0, nz = d.nz || 0, ux = d.ux || 1, uz = d.uz || 0;
        if (CUT.phase === "run" || CUT.t > 9.5) {
            const car = ctx.car, a = car.h + Math.PI + 0.6;
            _v.set(car.pos.x + Math.sin(a) * 8, 3.2, car.pos.z + Math.cos(a) * 8);
            ctx.cam.cinematic(_v, _w.set(car.pos.x, 1.0, car.pos.z), dt, 2.2, 52);
        } else {
            _v.set(d.x + nx * 15 + ux * 7, 4.2, d.z + nz * 15 + uz * 7);
            ctx.cam.cinematic(_v, _w.set(d.x - nx * 2, 3.0, d.z - nz * 2), dt, 2.4, 50);
        }
        return true;
    },
    exit() {
        caption("", "");
        if (CUT.lulu && CUT.lulu.obj.parent) CUT.lulu.obj.parent.remove(CUT.lulu.obj);
        CUT.lulu = null;
        ctx.car.showDriver(true);
        if (CUT.job && !CUT.done) { CUT.done = true; }
        CUT.job = null; CUT.belled = false;
    },
});
function walkTo(p, tgt, v, dt) {
    const o = p.obj.position, dx = tgt.x - o.x, dz = tgt.z - o.z, d = Math.hypot(dx, dz);
    if (d < 0.25) { p.update(dt, {}); return true; }
    const k = Math.min(d, v * dt) / d;
    o.x += dx * k; o.z += dz * k;
    p.face(tgt.x, tgt.z, dt, 10);
    p.update(dt, { walk: v });
    return false;
}
function finish(job) {
    if (CUT.done) return;
    CUT.done = true;
    caption("", "");
    job.phase = "getaway";
    setState("playing");
    const plan = job.plan;
    if (ctx.law && ctx.law.startChase) {
        ctx.law.startChase(HEIST.warrant, { heat: plan.stars, msg: `🚨 ${"★".repeat(plan.stars)} BANK ROBBERY!`, charges: [HEIST.warrant] });
        job.stars = job.maxStars = ctx.law.wanted || plan.stars;
    }
    if (plan.nitro && ctx.G) ctx.G.boost = 1;
    H.banner(JOB.go, 2600, { key: "heist:job", prio: 3 });
    setTimeout(() => { if (J.job === job) luluSays(pick(JOB.lulu), true); }, 1800);
    stat("heistJobs", 1);
    S.jobs++; S.lastJob = Date.now(); saveSoon();
    J.done = true;
}

// ── the getaway ─────────────────────────────────────────────────────────
function getawayTick(dt) {
    const job = J.job;
    if (!job || job.phase === "inside") return;
    job.t += dt;
    if (ctx.law && ctx.law.chasing) { job.stars = ctx.law.wanted; job.maxStars = Math.max(job.maxStars, job.stars); job.phase = "getaway"; }
    if (job.phase === "pulled") {
        // pulled over and NOT arrested: she talked her way out (or floored it — that's a new chase)
        if (ctx.state === "playing" && !(ctx.law && ctx.law.chasing)) { job.pulledT += dt; if (job.pulledT > 1.5) paid(job, "talked"); }
        return;
    }
    const left = job.bags - job.lost;
    setChip("💰 THE GETAWAY · lose the cops", `💰 bags ${left}/${job.bags} · ${"★".repeat(Math.max(1, job.stars || 1))}${ctx.law && ctx.law.searching ? " · 👀 they lost sight of you!" : ""}`,
        ctx.law && ctx.law.chasing ? ctx.law.searchProgress : null, "#66BB6A");
}
function take(job) {
    const base = HEIST.base[job.town] || HEIST.base.lakewood;
    const kept = 1 - HEIST.bagLost * job.lost;
    return Math.round((base * job.plan.mul * kept + HEIST.heatBonus * Math.max(1, job.maxStars)) / 5) * 5;
}
function paid(job, how) {
    if (J.job !== job) return;
    J.job = null;
    setChip(null);
    const n = take(job);
    addCoins(n, "heist:job");
    if (ctx.law && ctx.law.addWarrant) ctx.law.addWarrant([HEIST.warrant]);
    S.clean++; S.best = Math.max(S.best || 0, n); saveSoon();
    stat("heistJobsClean", 1); best("heistBestPay", n);
    sfx.yay();
    H.banner(JOB.paid(n, Math.max(1, job.maxStars)), 3400, { key: "heist:job", prio: 3 });
    remember("job", { town: job.town, plan: job.plan.id, pay: n, how, stars: job.maxStars });
    emit("heist:job", { phase: "escaped", town: job.town, plan: job.plan.id, pay: n, how, lost: job.lost, stars: job.maxStars });
}
function failed(job, why) {
    if (J.job !== job) return;
    J.job = null;
    setChip(null);
    if (why === "busted") { S.busted++; saveSoon(); stat("heistBusted", 1); H.banner(JOB.busted, 2600, { key: "heist:job", prio: 3 }); }
    else H.banner(JOB.failed, 2400, { key: "heist:job", prio: 2 });
    remember("job", { town: job.town, plan: job.plan.id, pay: 0, how: why });
    emit("heist:job", { phase: why === "busted" ? "busted" : "failed", town: job.town, plan: job.plan.id, why });
}
on("cop:chase", e => {
    const job = J.job;
    if (!job || !e || e.active !== false || job.phase === "inside") return;
    const r = e.result;
    if (r === "busted") { job.phase = "pulled"; job.pulledT = 0; return; }
    if (r === "arrest") return;                           // (law:arrest follows)
    if (r === "quit") return failed(job, "quit");
    // escaped · disguise (a quick change on foot) · left (she walked off with the bags) · safe · standDown · ended
    paid(job, r || "escaped");
});
on("law:arrest", () => { if (J.job) failed(J.job, "busted"); });
on("wreck", () => { if (J.job && J.job.phase !== "inside") setTimeout(() => { if (J.job && !(ctx.law && ctx.law.chasing)) failed(J.job, "wreck"); }, 50); });
on("crash", e => {
    const job = J.job;
    if (!job || job.phase !== "getaway" || !e || (e.impact || 0) < HEIST.bagImpact || job.lost >= HEIST.bags - 1) return;
    if (job.bagT > ctx.time) return;
    job.bagT = ctx.time + 1.2;
    job.lost++;
    const c = ctx.car.pos;
    burst(c.x, 1.4, c.z, 18, 3.5, [0.3, 0.75, 0.35], 0.35, 1.0);
    H.toast(`💰 A money bag bounced out! (${job.bags - job.lost}/${job.bags})`, "red", { key: "heist:bag" });
});

// ── the payphone tip (Cruise, on the highway, rarely) ───────────────────
function tipTick(dt) {
    const G = ctx.G;
    if (J.plan || J.job || J.done || J.tipping || !live() || G.mode !== "cruise" || inTown() || G.tutorial) return;
    if (ctx.state !== "playing" || (ctx.law && (ctx.law.chasing || ctx.law.reported)) || (ctx.hustle && ctx.hustle.job)) return;
    if ((G.runTime || 0) < TUNE.tip.after) return;
    J.tipT -= dt;
    if (J.tipT > 0) return;
    J.tipT = rand(TUNE.tip.every[0], TUNE.tip.every[1]);
    if (cooldownLeft() > 0 || Math.random() > TUNE.tip.chance) return;
    offerTip();
}
export function offerTip() {
    if (!ctx.phone || !ctx.phone.call || ctx.phone.busy()) return false;
    const o = JOB.tip;
    J.tipping = true;
    const call = ctx.phone.call({
        from: o.from, emoji: o.emoji, talkEmoji: o.emoji, color: o.color, lines: o.lines, ring: 6, talk: 7.5, flip: false, declinable: true,
        ringText: `📣 ${glyph("honk")} HONK = "Not now!"`, ringSub: "…or let it ring to take the tip (💰 a cartoon heist)",
        talkSub: "📣 {honk} hangs up",
        doneText: r => r === "full" ? "💰 Tip's yours — take the next exit to a bank" : r === "declined" ? "\"Suit yourself, sweetheart.\"" : "\"Rude!\"",
        onDone(r) { J.tipping = false; if (r === "full") setPlan(null, "classic", "tip"); },
    });
    if (!call) { J.tipping = false; return false; }
    emit("heist:job", { phase: "tip" });
    return true;
}

// ── HUD while a plan is pending ─────────────────────────────────────────
function planHud() {
    const p = J.plan;
    if (!p || J.job) return;
    p.t += 1 / 30;
    const sp = bankSpot();
    const name = inTown() ? (BANK[ctx.town.id] || BANK.lakewood).name : "";
    if (sp && (!p.town || p.town === ctx.town.id)) {
        const d = distTo(sp.x, sp.z);
        setChip(`💰 THE JOB · ${p.plan.emoji} ${p.plan.name}`, `pull up out front of ${name} · ${fmtM(d)}`, null, "#66BB6A");
        setBeacon({ x: sp.x, y: 0, z: sp.z, lift: 5.5 }, "#66BB6A");
    } else {
        setChip(`💰 THE JOB · ${p.plan.emoji} ${p.plan.name}`, inTown() ? `the bank's in ${p.town ? p.town[0].toUpperCase() + p.town.slice(1) : "town"}` : "take the next exit — Lakewood or Midwood (a bank in each)", null, "#66BB6A");
        setBeacon(null);
    }
}

hook("update", (dt, P, controlsOn) => {
    if (!controlsOn) return;
    try { arrivalCheck(); tipTick(dt); } catch (e) { console.error("[heist job]", e); }
});
hook("hud", dt => {
    if (ctx.paused || (ctx.state !== "playing" && ctx.state !== "footRun")) return;
    try { getawayTick(dt); planHud(); } catch (e) { console.error("[heist job hud]", e); }
});
hook("runStart", () => { J.plan = null; J.job = null; J.done = false; J.tipT = rand(30, 60); J.tipping = false; caption("", ""); });
on("run:end", () => { if (J.job) failed(J.job, "quit"); J.plan = null; });
on("title", () => { J.plan = null; J.job = null; setChip(null); setBeacon(null); caption("", ""); });
// the town lets our cutscene play in it (else it would send her back to the highway)
on("boot", () => { if (ctx.town && ctx.town.allowState) ctx.town.allowState("heistJob"); });
