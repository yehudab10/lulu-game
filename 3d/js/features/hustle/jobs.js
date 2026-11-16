// features/hustle — the side-job framework: one active job at a time, its HUD
// (objective line + distance chip + beacon), events fed to it, pass / fail /
// quit, the payouts' bookkeeping and the result card (state "hustleResult").
//
// A job module exports create(opts) → job:
//   { id, def, phase, t, update(dt, P), line() → string, emoji, timeLeft() → s | null, low() → bool,
//     target() → {x, z} | null, follow (Object3D | null), meters() → [{cls, label, frac}] | null,
//     onEvent(name, e), summary(result, why) → card data, dispose() }
import * as THREE from "three";
import { ctx, on, emit, registerState, setState, wrapAngle } from "../../core/ctx.js";
import { updateDriving } from "../../core/driving.js";
import { glyph } from "../../input.js";
import * as A from "../../audio.js";
import * as H from "../../hud.js";
import { JOBS, RESULT } from "./data.js";
import { jobHud, esc } from "./ui.js";
import { beacons } from "./beacon.js";
import { fmt, pick } from "./util.js";
import { record } from "./log.js";
import * as SFX from "./sfx.js";

export const J = { job: null, pending: null, again: null, makers: {}, last: null, hist: [] };
/** Job modules register themselves: registerJob("cab", create). */
export function registerJob(id, create) { J.makers[id] = create; }

/** Start a side job now (Lulu must be driving). Returns the job or null. */
export function startJob(id, opts = {}) {
    if (J.job || !J.makers[id]) return null;
    if (ctx.state !== "playing" && !opts.force) return null;
    let job = null;
    try { job = J.makers[id](opts); } catch (e) { console.error("[hustle] start", id, e); return null; }
    if (!job) return null;
    job.t = 0;
    job.def = job.def || JOBS[id];
    J.job = job;
    hudNow();
    J.last = id;
    emit("hustle:start", { id, via: opts.via || "" });
    const d = job.def;
    if (opts.intro !== false) H.banner(`<b>${d.emoji} ${d.name}</b><small>${esc(job.intro || d.blurb)}</small>`, 3200, { key: "hustle" });
    return job;
}

/**
 * End the active job. result: "pass" | "fail" | "quit". why: a short reason ("busted", "wreck", "cold"…).
 * The card shows at once if Lulu's driving, else the next time she is (same run).
 */
export function finishJob(result, why = "") {
    const job = J.job;
    if (!job) return null;
    J.job = null;
    let sum = null;
    try { sum = job.summary(result, why) || {}; } catch (e) { console.error("[hustle] summary", e); sum = {}; }
    sum = Object.assign({ id: job.id, result, why, rows: [], pay: 0 }, sum);
    try { job.dispose(); } catch (e) { console.error("[hustle] dispose", e); }
    beacons.target.hide();
    jobHud(null);
    H.prompt("");
    record(sum);
    J.hist.push({ id: sum.id, result, why, pay: sum.pay });
    if (J.hist.length > 12) J.hist.shift();
    emit("hustle:end", { id: sum.id, result, why, pay: sum.pay });
    if (result === "pass") { emit("stat", { id: "hustleJobs", n: 1 }); SFX.kaching(); }
    if (result === "fail") SFX.sadTrombone();
    if (result === "quit") { H.toast(RESULT.quitToast, ""); return sum; }
    J.pending = sum;
    return sum;
}
/** Drop the job without a card (a new run, the title). */
export function abandonJob() {
    const job = J.job;
    J.job = null;
    J.pending = null;
    if (job) { try { job.dispose(); } catch (e) { console.error("[hustle] dispose", e); } }
    beacons.target.hide();
    jobHud(null);
}

// ── per frame (playing) ───────────────────────────────────────────────────
let lastJumps = -1;
export function jobsTick(dt, P) {
    const job = J.job;
    // stunt jumps (play) → a "jump" event when she lands
    const jp = ctx.play && ctx.play.jump;
    const jumped = !!jp && lastJumps >= 0 && (jp.jumps || 0) > lastJumps;
    if (jp) lastJumps = jp.jumps || 0;
    // a finished job's card: as soon as she's (back) behind the wheel
    if (!job) {
        // (never mid-pursuit: the card is its own state, and a chase doesn't follow her into one)
        if (J.pending && ctx.state === "playing" && ctx.stateT > 0.25 && !(ctx.law && ctx.law.chasing)) setState("hustleResult", J.pending);
        else if (J.again && ctx.state === "playing") { const id = J.again; J.again = null; startJob(id, { via: "again" }); }
        return;
    }
    if (ctx.state !== "playing") return;
    job.t += dt;
    if (jumped) event("jump", { air: jp.lastAir || 0.5, pow: jp.landPow || 0.5 });
    try { job.update(dt, P); } catch (e) { console.error("[hustle] job update", e); }
    if (J.job === job) hud(job, dt);
}
// the beacon follows its target every frame; the DOM line / chips refresh ~12× a second (no per-frame churn)
const HUD = { t: 0, info: { emoji: "", line: "", color: "", time: null, timeText: "", low: false, dist: null, rot: null, meters: null } };
function hud(job, dt) {
    const tg = job.target ? job.target() : null;
    if (tg) {
        const follow = job.follow || null;
        if (!beacons.target.on || beacons.target.hex !== job.def.color || beacons.target.follow !== follow) beacons.target.show(tg.x, tg.z, job.def.color, { follow });
        else if (!follow) { beacons.target.group.position.x = tg.x; beacons.target.group.position.z = tg.z; }
    } else if (beacons.target.on) beacons.target.hide();
    HUD.t -= dt;
    if (HUD.t > 0) return;
    HUD.t = 0.08;
    const I = HUD.info, c = ctx.car;
    I.dist = I.rot = null;
    if (tg) {
        const dx = tg.x - c.pos.x, dz = tg.z - c.pos.z;
        I.dist = Math.sqrt(dx * dx + dz * dz);
        I.rot = -wrapAngle(Math.atan2(dx, dz) - c.h);
    }
    const left = job.timeLeft ? job.timeLeft() : null;
    I.emoji = job.emoji || job.def.emoji; I.line = job.line(); I.color = job.def.color;
    I.time = left; I.timeText = left == null ? "" : `⏱ ${fmt(left)}`; I.low = left != null && left < 8;
    I.meters = job.meters ? job.meters() : null;
    jobHud(I);
}
/** Refresh the job HUD on the next frame (after a big change). */
export function hudNow() { HUD.t = 0; }
/** Feed an event to the active job (playing only). */
export function event(name, e) {
    const job = J.job;
    if (!job || !job.onEvent) return;
    try { job.onEvent(name, e || {}); } catch (err) { console.error("[hustle] event", name, err); }
}

on("crash", e => { if (ctx.state === "playing") event("crash", e); });
on("closeCall", e => { if (ctx.state === "playing") event("closeCall", e); });
on("stat", e => { if (e && e.id === "potholes" && ctx.state === "playing") event("pothole", e); });
on("cop:chase", e => event("chase", e));
on("honk", () => event("honk", {}));
on("wreck", () => { if (J.job) { event("wreck", {}); if (J.job) finishJob("fail", "wreck"); } });
on("foot:start", () => { if (J.job) finishJob("fail", "foot"); });
on("state", ({ to }) => {
    if (to === "title") { abandonJob(); J.again = null; return; }
    if (/^law(Bust|Arrest|Jail|Stop)$/.test(to) && J.job) { event("busted", {}); if (J.job) finishJob("fail", "busted"); }
});
on("run:start", () => { abandonJob(); J.again = null; lastJumps = -1; });
on("run:end", () => { if (J.job) abandonJob(); });

// ── the pass / fail card ─────────────────────────────────────────────────
function cardHtml(s) {
    const d = JOBS[s.id] || { emoji: "💼", name: "SIDE JOB", color: "#FFC107" };
    const pass = s.result === "pass";
    const rows = (s.rows || []).map(([k, v, cls]) => `<div class="row ${cls || ""}"><span>${k}</span><b>${v}</b></div>`).join("");
    const total = s.pay > 0 ? `<div class="row tot"><span>TOTAL</span><b>+${s.pay.toLocaleString()} 💰</b></div>` : "";
    const q = s.quote ? `<div class="quote">${esc(s.quote[1])}<small>— ${esc(s.quote[0])}</small></div>` : "";
    return `<div class="hs-res ${pass ? "pass" : "fail"}" style="--acc:${d.color}">
        <div class="top">${pass ? RESULT.pass : RESULT.fail}</div>
        <div class="nm">${d.emoji} ${d.name}${s.sub ? ` · ${esc(s.sub)}` : ""}</div>
        ${s.whyText ? `<p class="why">${esc(s.whyText)}</p>` : ""}
        ${s.stars ? `<div class="stars">${"★".repeat(s.stars)}${"☆".repeat(5 - s.stars)}</div>` : ""}
        ${rows || total ? `<div class="rows">${rows}${total}</div>` : ""}
        ${q}
        ${pass ? `<div class="chz">${RESULT.chutzpah}</div>` : ""}
    </div>`;
}
const _from = new THREE.Vector3(), _look = new THREE.Vector3();
let card = { t: 0, sum: null };
registerState("hustleResult", {
    hud: false, touch: false, pausable: false, world: true,
    enter(sum) {
        card = { t: 0, sum };
        J.pending = null;
        ctx.cam.snap();
        A.sfxHorn(false);
        const again = sum.again !== false && sum.id !== "getaway";
        const d = JOBS[sum.id] || {};
        const btns = [{ label: `▶ Keep driving ${glyph("confirm")}`, id: "hsKeep", action: keep }];
        if (again) btns.push({ label: sum.result === "pass" ? `${d.emoji} Another one` : "↺ Try again", id: "hsAgain", cls: "alt", action: () => { J.again = sum.id; keep(); } });
        H.showScreen(cardHtml(sum), btns, { onBack: keep, cls: "hs-card" });
        if (sum.result === "pass") A.sfxFanfare();
    },
    exit() { H.hideScreen(); },
    update(dt, P) {
        card.t += dt;
        H.menuInput(P);
        updateDriving(dt, {}, false);
    },
    camera(dt) {
        // a slow swing around the car (the card sits on the left on wide screens)
        const c = ctx.car, a = c.h + Math.PI * 0.82 - card.t * 0.22;
        _from.set(c.pos.x + Math.sin(a) * 8.2, 2.6, c.pos.z + Math.cos(a) * 8.2);
        _look.set(c.pos.x, 1.0, c.pos.z);
        ctx.cam.cinematic(_from, _look, dt, 1.6, 52);
        if (ctx.camera.aspect > 1.25 && window.innerWidth >= 820) ctx.camera.rotateY(0.3);
        return true;
    },
});
function keep() {
    if (ctx.state !== "hustleResult") return;
    H.hideScreen();
    ctx.G.invT = Math.max(ctx.G.invT || 0, 1.5);
    ctx.cam.snap();
    setState("playing");
}

export { pick };
