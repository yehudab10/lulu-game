// The core driving game: run lifecycle, the per-frame driving sim, damage,
// wrecks, coins, close calls, speed traps, actors — and the states
// "intro" (3-2-1 countdown), "playing", "wrecked" and "gameover".
//
// NO GAME OVER (roadmap step 3): out of hearts is a KNOCK-OUT, not the end of the run.
// "wrecked" is a ~1 s spin-out; then a feature may claim it (law: a cop's wreck = an
// arrest; cameos: now and then the crash comedy / the ER) and otherwise she is back on
// her feet beside her patched-up car (foot "knockout") — the world keeps running. What a
// knock-out costs (KO below): the score streak is banked (best + lifetime) and starts over,
// a small capped tow fee, hearts back to full. The run itself only ends when she quits to
// the title / restarts (or a mode ends it: Story's trip end, the Shabbos Rush, a party).
//
// Features extend it through ctx hooks/events (see 3d/ARCHITECTURE.md):
//   hooks.controls(ctl, dt)   hooks.update(dt, P)   hooks.damage(info) → false cancels
//   hooks.wreck(info) → true takes over   hooks.runStart(G)
//   events: run:start, run:end, coin, closeCall, crash, damage, wreck, heart,
//           speedTrap, honk, boost, stat
import * as THREE from "three";
import { ctx, on, emit, hook, runHooks, claimHooks, vetoHooks, registerState, setState, MPH, wrapAngle, pick, clearActors } from "./ctx.js";
import { save3d, saveSoon, wallet, shared, flushShared } from "./save.js";
import { HALF_ROAD, SHOULDER, paved, pavedAt } from "../world.js";
import { input, rumble, triggerRumble, glyph, setBrakePedal } from "../input.js";
import * as A from "../audio.js";
import * as H from "../hud.js";

export const MAX_HEARTS = 3;
const SPEED_TRAP_MPH = 75;
const QUIPS = ["Oy vey!", "Bubbe's gonna hear about this!", "That's coming out of the gas money!", "Who put that there?!", "My sheitel!!"];
let lineAt = -99;                       // (when Lulu last said a line — banter: her own reaction beats a quip toast)
on("banter:line", () => { lineAt = ctx.time; });

// ── run lifecycle ─────────────────────────────────────────────────────────
/** Fresh run state. Features may add their own fields in hooks.runStart. */
export function resetRun(opts = {}) {
    const G = ctx.G;
    for (const k of Object.keys(G)) delete G[k];
    Object.assign(G, {
        mode: opts.mode || G.mode || "cruise",   // "cruise" | "story" | anything a feature defines
        hearts: MAX_HEARTS, maxHearts: MAX_HEARTS, coins: 0, score: 0, closeCalls: 0, combo: 0, comboT: 0,
        boost: 0.35, boosting: false, invT: 0, runTime: 0, lastS: 12, startS: 12, shake: 0,
        tickets: 0, crashes: 0, coinStreak: 0, coinStreakT: 0, distance: 0, ended: false,
    });
    const { traffic, world, car } = ctx;
    traffic.clear();
    clearActors();
    const s0 = opts.s != null ? opts.s : 12;
    const p = world.road.point(s0, 1.75, {});
    car.place(p.x, p.z, p.h);
    car.s = s0; car.d = 1.75;
    car.boosting = false;
    car.showDriver(true);
    car.obj.visible = true;
    G.lastS = G.startS = s0;
    world.prebuild(s0);
    world.resetCoins();
    if (ctx.cam) ctx.cam.snap();
    H.setHearts(G.hearts, G.maxHearts);
    runHooks("runStart", G, opts);
}

/** Reset and start the 3-2-1 countdown. opts.mode = "cruise" | "story" | … */
export function startRun(opts = {}) {
    // (the run before this one ends here: Restart / a jail release bank it like quitting does)
    if (ctx.G.started && !ctx.G.ended) endRun("restart");
    resetRun(opts);
    ctx.G.started = true;
    emit("run:start", { mode: ctx.G.mode, opts });
    // a runStart hook may swap the 3-2-1 countdown for its own start: G.introStart(opts) (world: on foot at
    // home — it sets the state itself; false = it couldn't, count down) or G.introState (a departure state)
    if (typeof ctx.G.introStart === "function") {
        let ok = false;
        try { ok = ctx.G.introStart(opts) !== false; } catch (e) { console.error("[run] introStart", e); }
        if (ok) return;
    }
    const intro = ctx.G.introState;
    setState(intro && ctx.states[intro] ? intro : "intro", opts);
}
// quitting to the title ends the run (there's no game-over card to do it any more)
on("state", ({ to }) => { if (to === "title" && ctx.G.started && !ctx.G.ended) endRun("quit"); });

/** Close out a run (banks the best score, flushes the wallet). Safe to call twice. */
export function endRun(reason = "end") {
    const G = ctx.G;
    if (G.ended) return;
    G.ended = true;
    const score = Math.floor(G.score);
    G.newBest = score > save3d.best;
    if (G.newBest) save3d.best = score;
    saveSoon();
    shared.best("best3d", score);
    shared.stat("runs3d", 1);
    shared.stat("miles3d", Math.max(0, Math.round((ctx.car.s - G.startS) / 160.9) / 10));
    flushShared();
    emit("run:end", { reason, score, bestStreak: Math.max(score, G.bestStreak || 0), banked: G.banked || 0, coins: G.coins, distance: ctx.car.s - G.startS, G });
}

// ── scoring / pickups ─────────────────────────────────────────────────────
/** Run coins: counted on the HUD AND added to the shared wallet right away (like the 2D game). */
export function addCoins(n, why) {
    if (!Number.isFinite(n)) return;           // (a bad sum must not turn the HUD's coins into NaN for the rest of the run)
    const G = ctx.G;
    G.coins += n;
    wallet.add(n);
    emit("coin", { n, why });
    if (n > 0) emit("stat", { id: "coins", n });
}
export function addScore(n, why) { ctx.G.score += n; emit("score", { n, why }); }

/** Bank the score so far (best score + lifetime, via "score:bank") and start the score over. Returns what was banked. */
export function bankScore(reason = "knockout") {
    const G = ctx.G;
    const score = Math.max(0, Math.floor(G.score || 0));
    G.score = 0; G.combo = 0; G.comboT = 0; G.coinStreak = 0;
    if (!score) return 0;
    const best = score > save3d.best;
    if (best) { save3d.best = score; G.newBest = true; }
    saveSoon();
    shared.best("best3d", score);
    G.banked = (G.banked || 0) + score;
    G.bestStreak = Math.max(G.bestStreak || 0, score);
    emit("score:bank", { reason, score, best, G });
    return score;
}

// ── knocked out (out of hearts) — what it costs ───────────────────────────
/** THE KNOCK-OUT RULE (tune here): the score streak is banked and starts over, hearts go back to full, and a tow &
 *  patch-up fee of feeBase + feeStep per earlier knock-out this run, capped at feeMax and never more than she has. */
export const KO = { feeBase: 10, feeStep: 5, feeMax: 30, spin: 1.1 };
/**
 * Apply the knock-out cost and announce it. opts: { fee: false (the ER's bill / an insurance reprieve instead),
 * hearts: false (the ER sets them), where: "car" | "foot" | "scene" }. → { n, banked, fee }
 */
export function knockout(info = {}, { fee = true, hearts = true, where = "car" } = {}) {
    const G = ctx.G;
    G.knockouts = (G.knockouts || 0) + 1;
    const banked = bankScore("knockout");
    let paid = 0;
    if (fee) {
        const want = Math.min(KO.feeMax, KO.feeBase + KO.feeStep * (G.knockouts - 1));
        paid = Math.max(0, Math.min(want, Math.floor(wallet.coins)));
        if (paid) { wallet.add(-paid); G.coins = Math.max(0, (G.coins || 0) - paid); }
    }
    if (hearts) G.hearts = G.maxHearts || MAX_HEARTS;
    G.hint = null;
    G.invT = Math.max(G.invT || 0, 2); G.invSoft = true;
    H.setHearts(Math.max(0, G.hearts), G.maxHearts);
    const bits = [];
    if (banked) bits.push(`score banked: ${banked.toLocaleString()}${G.newBest && banked >= save3d.best ? " 🏆" : ""}`);
    if (paid) bits.push(`🚛 tow &amp; patch-up −${paid} 💰`);
    H.banner(`💫 <b>BACK ON YOUR FEET</b>${bits.length ? `<small>${bits.join(" · ")}</small>` : ""}`, 2600, { prio: 2 });
    const out = { n: G.knockouts, banked, fee: paid, where, why: info.why || null, source: info.source || null };
    emit("knockout", out);
    emit("stat", { id: "knockouts", n: 1 });
    if (paid) emit("stat", { id: "towFees", n: paid });
    return out;
}

/** No feature to stand her up (no foot feature): back in her lane, rolling, hearts full. */
function rollingRecover() {
    const { car, world, traffic } = ctx, G = ctx.G;
    const near = world.road.nearest(car.pos.x, car.pos.z, car.s, {});
    const p = world.road.point(near.s, 1.75, {});
    car.place(p.x, p.z, p.h);
    car.s = near.s; car.d = 1.75;
    car.vx = Math.sin(p.h) * 10; car.vz = Math.cos(p.h) * 10;
    car.showDriver(true); car.obj.visible = true;
    for (const c of traffic.cars.slice()) if (!c.keep && Math.abs(c.s - near.s) < 40 && Math.abs(c.d - 1.75) < 2.5) traffic.remove(c);
    G.invT = Math.max(G.invT || 0, 2.5); G.invSoft = true;
    if (ctx.cam) { if (ctx.cam.blend) ctx.cam.blend(0.6); else ctx.cam.snap(); }
    setState("playing");
}
/** The default recovery after a knock-out in the car: on her feet beside it (foot; the picture glides from the spin-out), else rolling in her lane. */
export function recoverFromWreck(info = {}) {
    const ko = knockout(info, { where: "car" });
    let ok = false;
    if (ctx.foot && typeof ctx.foot.start === "function") {
        try { ok = ctx.foot.start("knockout", { drivable: true, camBlend: 0.7 }) !== false; } catch (e) { console.error("[run] knockout → foot", e); }
    }
    if (!ok) rollingRecover();
    return ko;
}

// ── damage & wrecks ───────────────────────────────────────────────────────
/**
 * Lose a heart. info: power (0..1.2 → crash sound), why (banner text), source (string)
 * Respects invincibility; hooks.damage can veto (shield).
 */
export function damage(power, why, source = "crash") {
    const G = ctx.G;
    if (G.invT > 0 || ctx.state !== "playing") return false;
    const info = { power, why, source };
    if (vetoHooks("damage", info)) return false;
    const { car } = ctx;
    G.hearts--;
    G.crashes++;
    G.invT = 2.2; G.invSoft = false;       // (a real hit: the shield blinks)
    G.combo = 0;
    G.shake = 0.9;
    H.setHearts(G.hearts, G.maxHearts);
    H.flash();
    A.sfxCrash(Math.min(1.2, power));
    rumble(1, 1, 480, true);
    car.fx.burst(car.pos.x, 0.8, car.pos.z, 26, 6, [1, 0.8, 0.4], 0.5, 0.6);
    car.fx.burst(car.pos.x, 0.8, car.pos.z, 14, 2, [0.6, 0.6, 0.62], 1.6, 1.2);
    emit("damage", info);
    emit("stat", { id: "crashes", n: 1 });
    if (G.hearts <= 0) wreck(why, source);
    else if (ctx.time - lineAt > 0.25) H.toast(`💥 ${pick(QUIPS)}`, "red", { prio: 1 });    // flavour: the hearts, flash + crash already say it
    return true;
}

/** Out of hearts: spin out, then (after KO.spin s) let a feature claim it (arrest, the crash comedy…) or knock-out. */
export function wreck(why, source = "crash") {
    const G = ctx.G;
    G.wreckInfo = { why, source };
    ctx.car.spin += (Math.random() < 0.5 ? -1 : 1) * 5;
    H.banner(`💥 <b>WRECKED!</b><small>${why || "Lulu's car has had enough"}</small>`, 1300, { prio: 2 });
    A.sfxHorn(false);
    emit("wreck", G.wreckInfo);
    setState("wrecked", G.wreckInfo);
}

export function heal(n = 1) {
    const G = ctx.G;
    G.hearts = Math.min(G.maxHearts, G.hearts + n);
    H.setHearts(G.hearts, G.maxHearts);
    emit("heart", { n });
}

function closeCall(oncoming) {
    const G = ctx.G;
    G.combo = G.comboT > 0 ? G.combo + 1 : 1;
    G.comboT = 3.5;
    G.closeCalls++;
    const pts = (oncoming ? 80 : 50) * G.combo;
    G.score += pts;
    G.boost = Math.min(1, G.boost + 0.14);
    A.sfxCloseCall(G.combo);
    rumble(0.2, 0.5, 90);
    H.toast(`${oncoming ? "😱 HEAD-ON DODGE" : "😎 CLOSE CALL"}${G.combo > 1 ? " ×" + G.combo : ""} +${pts}`, oncoming ? "pink" : "gold");
    emit("closeCall", { oncoming, combo: G.combo });
    emit("stat", { id: "closeCalls", n: 1 });
}

let farHonkT = 0;
function honkFromAfar() {
    if (ctx.time < farHonkT) return;
    farHonkT = ctx.time + 1.5;
    A.sfxCloseCall(-4);
    H.toast("🚨 WRONG LANE, LULU!", "red");
    rumble(0.2, 0.5, 150);
}

// ── the per-frame driving sim ─────────────────────────────────────────────
// Paved ground off the highway (exit ramps, a rest area's lot…): the registry lives in world.js (chunks keep
// signs off the lanes with it); re-exported here, where features have always imported it from.
export { paved, pavedAt, offLanes } from "../world.js";
const tmpNear = {};
/** Where the car is on the road: {s, d, h, absd, offroad 0..1, onShoulder}. */
export function roadPos() {
    const { car, world } = ctx;
    const near = world.road.nearest(car.pos.x, car.pos.z, car.s, tmpNear);
    car.s = near.s; car.d = near.d;
    const absd = Math.abs(near.d);
    const onPaved = paved.length && absd > HALF_ROAD - 0.2 && !world.district && pavedAt(near.s, near.d) >= 2;
    return {
        s: near.s, d: near.d, h: near.h, absd,
        offroad: absd > SHOULDER && !onPaved ? Math.min(1, (absd - SHOULDER) / 1.2) : 0,
        onShoulder: absd > HALF_ROAD - 0.2 && absd <= SHOULDER && !onPaved,
        paved: !!onPaved,
    };
}

/**
 * One frame of driving. controlsOn = the player has the wheel (false during the
 * countdown, wrecks and cutscenes; ctlOverride lets a state drive the car).
 */
export function updateDriving(dt, P, controlsOn, ctlOverride = null) {
    const G = ctx.G, { car, world, traffic } = ctx;
    if (controlsOn) G.runTime += dt;
    const rp = roadPos();
    const { offroad, onShoulder, absd } = rp;

    const ctl = ctlOverride || (controlsOn ? {
        steer: input.steer * (save3d.settings.steerSens || 1), throttle: input.throttle, brake: input.brake, handbrake: input.handbrake,
        analog: input.device !== "keyboard",
    } : { steer: 0, throttle: 0, brake: 0.25, handbrake: false, analog: true });
    ctl.steer = Math.max(-1, Math.min(1, ctl.steer));
    if (controlsOn) { runHooks("controls", ctl, dt); setBrakePedal(car.vF); }

    // nitro
    const wantBoost = controlsOn && input.boost && !G.noBoost && !G.evCar && !G.fuelDry;   // (no nitro in an electric car — features/dealers — or an empty tank — features/fuel)
    if (wantBoost && G.boost > 0.01 && (G.boosting || G.boost > 0.12)) {
        if (!G.boosting) { A.sfxBoost(); H.toast("🔥 NITRO!", "gold"); rumble(0.5, 0.6, 250, true); emit("boost", {}); }
        G.boosting = true;
        G.boost = Math.max(0, G.boost - 0.3 * dt / (G.nitroTank || 1));      // (a bigger tank — features/dealers — lasts longer)
    } else {
        G.boosting = false;
        G.boost = Math.min(1, G.boost + 0.012 * dt);
    }
    car.boosting = G.boosting;

    // physics (sub-stepped)
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) car.step(dt / n, ctl, { offroad });
    if (absd > 70 && !rp.paved) {   // invisible fence far out in the fields (not on a road out there: an interchange's cross road)
        const push = (absd - 70) * Math.sign(rp.d);
        car.pos.x -= -Math.cos(rp.h) * push;
        car.pos.z -= Math.sin(rp.h) * push;
    }

    // static obstacles, coins, hearts, speed traps
    for (const ch of world.activeChunks()) {
        if (Math.abs(ch.s0 + 100 - car.s) > 220) continue;
        for (const c of ch.colliders) {
            const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
            if (dx * dx + dz * dz > 64 || c.off) continue;
            const imp = car.collideStatic(c.x, c.z, c.r);
            if (!imp) continue;
            emit("crash", { impact: imp, kind: c.kind, collider: c });
            if (c.onHit && c.onHit(imp) === false) continue;
            if (imp > 10) damage(imp / 20, c.kind === "tree" ? "Lulu vs. a tree: the tree won" : "That wasn't on the GPS", c.kind);
            else if (imp > 2.5) { A.sfxBump(); rumble(0.6, 0.4, 160, true); G.shake = Math.max(G.shake, 0.3); }
        }
        for (const coin of ch.coins) {
            if (coin.taken || G.selfDriving) continue;      // (a self-driving car doesn't collect: no AFK coins — features/dealers)
            const dx = coin.x - car.pos.x, dz = coin.z - car.pos.z;
            if (dx * dx + dz * dz < (G.magnet ? 30 : 4.2)) {
                coin.taken = true;
                addCoins(coin.value, "road");
                G.score += 10 * coin.value;
                G.boost = Math.min(1, G.boost + 0.045 * coin.value);
                G.coinStreak = G.coinStreakT > 0 ? G.coinStreak + 1 : 0;
                G.coinStreakT = 0.8;
                A.sfxCoin(G.coinStreak);
                rumble(0, 0.25, 40);
                car.fx.burst(coin.x, 1.1, coin.z, 6, 2.5, [1, 0.85, 0.3], 0.35, 0.5);
                if (coin.value > 1) H.toast("+2 RISKY COIN!", "gold");
            }
        }
        for (const ht of ch.hearts) {
            if (ht.taken) continue;
            const dx = ht.x - car.pos.x, dz = ht.z - car.pos.z;
            if (dx * dx + dz * dz < 5) {
                ht.taken = true; ht.obj.visible = false;
                if (G.hearts < G.maxHearts) { heal(1); H.toast("❤️ +1 HEART", "pink"); }
                else { G.score += 100; H.toast("❤️ +100", "pink"); }
                A.sfxCoin(10);
            }
        }
        for (const t of ch.traps) {
            if (t.triggered || car.s < t.s || car.s > t.s + 40) continue;
            t.triggered = true;
            const mph = car.speed * MPH;
            const ticketed = mph > SPEED_TRAP_MPH && controlsOn;
            const info = { mph, ticketed, trap: t, handled: false };
            emit("speedTrap", info);   // the law feature may turn this into a chase
            if (info.handled || !controlsOn) continue;
            if (ticketed) {
                G.tickets++;
                const fine = Math.min(G.coins, 25);
                if (fine) { G.coins -= fine; wallet.add(-fine); }
                A.sfxSiren();
                rumble(0.3, 0.6, 300, true);
                H.toast(`📸 SPEEDING TICKET! ${Math.round(mph)} mph${fine ? ` −${fine} coins` : ""}`, "red");
                emit("stat", { id: "tickets", n: 1 });
            } else {
                G.score += 150;
                H.toast("👮 Nice and legal! +150", "gold");
            }
        }
    }
    G.coinStreakT -= dt;

    // traffic
    const difficulty = Math.min(1, (car.s - G.startS) / 9000);
    const honk = controlsOn && !!P.honk;
    if (honk) { emit("honk", {}); rumble(0.1, 0.3, 120); }
    const events = traffic.update(dt, car, car.s, car.d, difficulty, honk, ctx.time);
    for (const e of events) {
        if (e.type === "crash") {
            emit("crash", e);
            if (e.car && e.car.onCrash && e.car.onCrash(e) === false) continue;
            if (e.impact > 6.5) damage(e.impact / 16, e.oncoming ? "Head-on? REALLY, Lulu?" : "Tailgating doesn't pay", e.kind);
            else if (e.impact > 1.5) { A.sfxBump(); rumble(0.5, 0.5, 150, true); G.shake = Math.max(G.shake, 0.25); }
        } else if (e.type === "nearMiss" && controlsOn && G.invT <= 0 && !G.selfDriving) closeCall(e.oncoming);   // (self-driving: no bonus)
        else if (e.type === "moved") H.toast("📣 Move it, buddy!", "");
        else if (e.type === "oncomingHonk") honkFromAfar();
    }

    // actors (features' road things)
    updateActors(dt, false);

    // distance score
    const ds = car.s - G.lastS;
    if (ds > 0 && controlsOn) { G.score += ds * (G.boosting ? 1.5 : 1); G.distance += ds; }
    G.lastS = Math.max(G.lastS, car.s);
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
    G.invT = Math.max(0, G.invT - dt);
    if (G.invT <= 0) G.invSoft = false;

    runHooks("update", dt, P, controlsOn);

    // feel: rumble strips + grass + nitro
    if (onShoulder && car.speed > 8 && controlsOn) rumble(0.05, 0.35, 110);
    else if (offroad > 0 && car.speed > 4) rumble(0.25 * offroad, 0.45, 120);
    else if (G.boosting) rumble(0.12, 0.3, 120);
    if (controlsOn && ctl.brake > 0.6 && car.vF > 12) triggerRumble(0.5, 0, 90);

    A.updateEngine(car.vF, controlsOn ? ctl.throttle : 0, car.slip, offroad + (onShoulder && car.speed > 8 ? 0.4 : 0), G.boosting, true);
    A.sfxHorn(controlsOn && input.honkHeld && !G.customHorn);
    // (no i-frame blink once she's wrecked: the fatal hit's invT would flicker the car + Lulu all through the spin-out)
    // (…and none for a COURTESY shield — G.invSoft: she just hopped into a car — a blinking car there reads as a glitch)
    car.updateVisual(dt, ctx.time, ctl, G.invT > 0 && !G.invSoft && ctx.state !== "wrecked");
    return rp;
}

/** Update actors; collisions with Lulu's car become crashes/damage. */
export function updateActors(dt, onFoot) {
    const { car } = ctx;
    for (let i = ctx.actors.length - 1; i >= 0; i--) {
        const a = ctx.actors[i];
        if (onFoot && !a.foot) continue;
        let keep = true;
        try { keep = a.update(dt) !== false; } catch (e) { console.error("[actor]", e); keep = false; }
        if (!keep) { ctx.actors.splice(i, 1); try { if (a.dispose) a.dispose(); } catch (e) { console.error(e); } continue; }
        if (!onFoot && a.collide) {
            let hit = null;
            try { hit = a.collide(car); } catch (e) { console.error("[actor collide]", e); }
            if (hit) {
                emit("crash", Object.assign({ actor: a }, hit));
                if (hit.impact > 6.5 && !hit.harmless) damage(hit.impact / 16, hit.why || "Watch the road, Lulu!", hit.source || "actor");
                else if (hit.impact > 1.5) { A.sfxBump(); rumble(0.5, 0.5, 150, true); ctx.G.shake = Math.max(ctx.G.shake, 0.25); }
            }
        }
    }
}

// ── attract mode (title screen): Lulu cruises down her lane on autopilot ──
export function autopilot(dt) {
    const { car, world } = ctx;
    const near = world.road.nearest(car.pos.x, car.pos.z, car.s, tmpNear);
    car.s = near.s; car.d = near.d;
    const tgt = world.road.point(car.s + 16, 1.75, {});
    const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z);
    const diff = wrapAngle(want - car.h);
    const ctl = { steer: THREE.MathUtils.clamp(-diff * 3, -1, 1), throttle: car.speed < 19 ? 0.6 : 0, brake: 0, handbrake: false, analog: true };
    car.boosting = false;
    const n = Math.max(1, Math.ceil(dt / (1 / 120)));
    for (let i = 0; i < n; i++) car.step(dt / n, ctl, { offroad: 0 });
    car.updateVisual(dt, ctx.time, ctl, false);
    if (car.s > 2600) resetRun();
}

/** Drive the car along the road toward lane d at a target speed (cutscenes, arrivals). */
export function autoDrive(dt, d = 1.75, speed = 12) {
    const { car, world } = ctx;
    const tgt = world.road.point(car.s + 14, d, {});
    const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z);
    const diff = wrapAngle(want - car.h);
    return { steer: THREE.MathUtils.clamp(-diff * 3, -1, 1), throttle: car.speed < speed ? 0.5 : 0, brake: car.speed > speed + 3 ? 0.4 : 0, handbrake: false, analog: true };
}

// ── states ────────────────────────────────────────────────────────────────
registerState("intro", {
    hud: true, touch: true, pausable: true, driving: true,
    enter() {
        ctx.G.countdown = 3;
        H.setBoost(ctx.G.boost, input.device === "touch" ? "" : glyph("boost"));
        H.clearNotices();
        H.banner(`<b>3</b>`, 900, { key: "countdown" });
        if (!ctx.G.musicSet) A.setMusic("../luludriving.mp3");
    },
    update(dt, P) {
        const G = ctx.G;
        const prev = G.countdown;
        G.countdown = 3 - Math.floor(ctx.stateT / 0.8);
        if (G.countdown !== prev && G.countdown > 0) { H.banner(`<b>${G.countdown}</b>`, 700, { key: "countdown" }); A.sfxCloseCall(0); rumble(0.1, 0.2, 80); }
        updateDriving(dt, {}, false);
        if (ctx.stateT >= 2.4) {
            H.banner(`<b>GO!</b>${G.goText ? `<small>${G.goText}</small>` : ""}`, 1200, { key: "countdown" });
            A.sfxCloseCall(6);
            rumble(0.3, 0.6, 200, true);
            setState("playing");
        }
    },
});

registerState("playing", {
    hud: true, touch: true, pausable: true, driving: true,
    update(dt, P) { updateDriving(dt, P, true); },
});

// the touch BRAKE / REVERSE pedal goes back to BRAKE outside the driving states (Dina's run, menus…)
on("state", ({ to }) => { const d = ctx.states[to]; if (to !== "parking" && !(d && d.driving)) setBrakePedal(0, "brake"); });

registerState("wrecked", {
    hud: true, touch: false, pausable: false, driving: true,
    update(dt) {
        updateDriving(dt, {}, false);
        if (ctx.stateT > KO.spin) {
            const info = Object.assign({ G: ctx.G }, ctx.G.wreckInfo || {});
            if (!claimHooks("wreck", info) && ctx.state === "wrecked") recoverFromWreck(info);
        }
    },
});

// (no longer reached by running out of hearts — see the knock-out above; kept for minigames that still end a run:
//  parking's challenge, and anything a feature may want to close with a card)
registerState("gameover", {
    hud: false, touch: false, world: true,
    enter(info) {
        endRun("wrecked");
        const G = ctx.G;
        A.setMusic(null);
        A.updateEngine(0, 0, 0, 0, false, false);
        H.showScreen(`<h2>💥 Wrecked!</h2>
            <div class="quote">${info.quote || `"Lulu, mamele… are you OK? Call me when you get there!" — Bubbe 📞`}</div>
            ${statsHtml()}
            ${G.newBest ? '<p><b>🏆 New best score!</b></p>' : `<p class="fine">Best: ${save3d.best.toLocaleString()}</p>`}`,
            [
                { label: `↺ Try again ${glyph("confirm")}`, action: () => { H.hideScreen(); startRun({ mode: G.mode }); } },
                { label: "⌂ Title screen", cls: "alt", action: () => { H.hideScreen(); setState("title"); } },
            ], { onBack: () => { H.hideScreen(); setState("title"); } });
    },
    exit() { H.hideScreen(); },
    update(dt, P) { H.menuInput(P); },
});

export function statsHtml(extra = "") {
    const G = ctx.G;
    const miles = ((ctx.car.s - (G.startS || 0)) / 1609).toFixed(2);
    return `<div class="stats">
        <div class="stat"><b>${Math.floor(G.score).toLocaleString()}</b><span>SCORE</span></div>
        <div class="stat"><b>${G.coins}</b><span>COINS</span></div>
        <div class="stat"><b>${miles}</b><span>MILES</span></div>
        <div class="stat"><b>${G.closeCalls}</b><span>CLOSE CALLS</span></div>
        ${extra}
    </div>`;
}

// re-export for features
export { hook };
