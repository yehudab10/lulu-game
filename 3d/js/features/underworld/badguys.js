// features/underworld — BAD GUYS ON THE ROAD (highway only; their AI is in road coords).
//
//  😡 the ROAD-RAGER: a lifted pickup comes up behind her, tailgates (brights flashing, horn, a
//     baguette shaken out of the window), pulls alongside and swerves into her (a shove — light bumps
//     never cost a heart), sometimes clipping a tyre (a flat → call Chaverim). Outrun him (he tops out
//     just under her top speed) or wait him out, or lead him past a cop.
//  😎 the GANG CAR: a lowrider with a plush kugel on the roof tails her ~24 m back for half a minute
//     (bubbles out of the window, a water pistol, a banana). Lose it (get far enough ahead), or lead it
//     past a cop. They give up after a while either way ("wrong pink convertible").
//  🚓 LED PAST A COP: any law unit / speed trap that sees a bad guy pulls HIM over (a cruiser slides in
//     behind him on the shoulder — ours, lights going).
//  🔦 SHOMRIM: from the 📞 Call app, a Shomrim Crown Vic comes up fast and pulls him over.
// Whatever happens, the bad guy remembers (heat.js rivals). A chase on HER ends any encounter at once.
import { ctx } from "../../core/ctx.js";
import { kindSpec } from "../../traffic.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { TUNE, RAGER, GANG, COPBUST, COMM, GANG_PAINT, TAIL_PAINT } from "./data.js";
import { UW, rand, pick, fill, clamp, need, models, person, seatIn, paintCar, luluTop, lulu, bubble, banner, toast, log, stat,
    earn, removeCar, later, chasing, inTown } from "./common.js";
import { rivalFor, rivalResult } from "./heat.js";

const laneOf = d => (d > 3.5 ? 5.25 : 1.75);
const other = d => (laneOf(d) > 3.5 ? 1.75 : 5.25);
const tmpN = {};

// ── spawning ─────────────────────────────────────────────────────────────
/**
 * A bad-guy car now. kind "rager" | "gang" | "tail" (the Fixer's job: a grey gang car).
 * opts { behind (m back), rival, paint, tail (s), job }. → Promise<encounter | null>
 */
export async function spawnBadCar(kind, opts = {}) {
    if (!ctx.car || inTown()) return null;
    const carKind = kind === "rager" ? "underworld_rager" : "underworld_gangcar";
    const driverKey = kind === "rager" ? "npcMan" : "uw_goon";
    const tok = UW.loading = {};
    const ok = await need([kindSpec(carKind).model, driverKey, "npcMan"]);
    if (UW.loading !== tok) return null;
    UW.loading = null;
    if (!ok && !models[kindSpec(carKind).model]) return null;
    if (ctx.state !== "playing" && !opts.force) return null;
    if (kind !== "tail" && UW.enc) return null;
    const car = ctx.car;
    const rival = opts.rival || (kind === "tail" ? null : rivalFor(kind));
    const T = kind === "rager" ? TUNE.rager : TUNE.gang;
    const lane = other(car.d);
    const E = { kind, rival, phase: "approach", t: 0, pt: 0, said: {}, car: null, person: null, undo: null, lane,
        life: kind === "rager" ? T.life : opts.tail || rand(T.tail[0], T.tail[1]), outT: 0, copSee: 0, bumps: 0, nextBump: rand(...TUNE.rager.bumpEvery),
        chatT: rand(4, 7), result: "", job: opts.job || null, paint: null };
    const c = ctx.traffic.add(carKind, car.s - (opts.behind ?? T.startBehind), lane, 1, Math.max(car.speed, 12) + 6, {
        ai: (dt, cc) => drive(E, dt, cc), keep: true, noNearMiss: true, data: { underworld: kind, local: true },
        onRemove: () => cleanup(E),
    });
    E.car = c;
    // a shove from a bad guy is slapstick, not a heart (a real smash still counts)
    c.onCrash = e => { E.bumped = true; return e.impact > 9.5 ? undefined : false; };
    if (kind === "gang" || kind === "tail") {
        const p = kind === "tail" ? [TAIL_PAINT, "grey"] : pick(GANG_PAINT);
        E.paint = p[1];
        E.undo = paintCar(c, opts.paint || p[0]);
    }
    try {
        const p = person(driverKey, kind === "rager" ? { Top: "#D32F2F", Skin: "#FFB199" } : null);
        if (p) { seatIn(c, p); E.person = p; }
    } catch (e) { /* the car alone still honks */ }
    if (kind !== "tail") {
        UW.enc = E;
        const again = rival && !rival.fresh;
        if (kind === "rager") banner(RAGER.banner, again ? `${rival.name} is BACK · ${RAGER.sub}` : RAGER.sub, 2800, "uw:enc");
        else banner(fill(GANG.banner, { color: E.paint }), again ? `${rival.name} again · ${GANG.sub}` : GANG.sub, 2800, "uw:enc");
        // a cop up the road makes "lead him past a cop" a real option (not every time)
        if (ctx.law && ctx.law.trap && (UW.force.trap || Math.random() < 0.55)) ctx.law.trap(UW.force.trapAhead || rand(520, 700), 1);
        stat(kind === "rager" ? "uwRagers" : "uwGangs");
        log("encounter", { kind, rival: rival && rival.name, again: !!again });
    }
    return E;
}

// ── the AI (a traffic ai in road coords) ─────────────────────────────────
function go(E, phase) { E.phase = phase; E.pt = 0; }
function say(E, text, cls = "angry") { if (E.car) bubble(text, E.car.obj, { cls, y: E.kind === "rager" ? 2.9 : 2.4, dur: 2.8 }); E.lastLine = text; }
function flash(E, on) {
    const c = E.car;
    if (!c || !c.heads) return;
    for (const m of c.heads) m.emissiveIntensity = on ? (Math.sin(ctx.time * 26) > 0 ? 12 : 2) : 2;
}
function drive(E, dt, c) {
    const car = ctx.car;
    E.t += dt; E.pt += dt;
    const her = laneOf(car.d);
    let wantS = car.s - 9, wantD = her, top = luluTop() * (E.kind === "rager" ? TUNE.rager.top : TUNE.gang.top), brake = false, hard = false;
    switch (E.phase) {
        case "approach":
            wantS = car.s - (E.kind === "rager" ? 9 : TUNE.gang.gap);
            wantD = c.s < car.s - 14 ? her : E.lane;
            if (Math.abs(c.s - wantS) < 4 && Math.abs(c.d - her) < 0.6) go(E, E.kind === "rager" ? "tailgate" : "tail");
            else if (E.pt > 30) go(E, "leave");
            break;
        // 😡
        case "tailgate":
            wantS = car.s - 8;
            flash(E, true);
            if (!E.said.tg) { E.said.tg = true; say(E, E.rival && !E.rival.fresh && !E.said.again ? pick(RAGER.again) : pick(RAGER.honk)); E.said.again = true; honk(E); later(1.6, () => lulu(pick(RAGER.lulu))); }
            if (E.pt > 4.5) { flash(E, false); go(E, "alongside"); }
            break;
        case "alongside":
            wantD = other(car.d); wantS = car.s - 0.3;
            if (Math.abs(c.s - car.s) < 2.2 && Math.abs(c.d - wantD) < 0.5) E.side = (E.side || 0) + dt; else E.side = 0;
            if (E.side > 0.45) { go(E, "bump"); E.bumped = false; say(E, pick(RAGER.bump)); }
            else if (E.pt > 9) go(E, "tailgate");
            break;
        case "bump":
            wantS = car.s; wantD = car.d; hard = true;
            if (E.bumped || E.pt > 1.1) {
                if (E.bumped) onBump(E);
                go(E, "recover");
            }
            break;
        case "recover":
            wantS = car.s - 6; wantD = other(car.d);
            if (E.pt > 1.6) { E.nextBump = rand(...TUNE.rager.bumpEvery); go(E, E.t > E.life ? "giveup" : "tailgate"); }
            break;
        // 😎
        case "tail":
            wantS = car.s - TUNE.gang.gap;
            E.chatT -= dt;
            if (E.chatT <= 0) {
                E.chatT = rand(6, 9);
                if (!E.said.first) { E.said.first = true; say(E, E.rival && !E.rival.fresh ? pick(GANG.again) : pick(GANG.lines), "angry"); later(1.4, () => lulu(fill(pick(GANG.lulu), { color: E.paint || "purple" }))); }
                else if (E.kind !== "tail") say(E, pick(GANG.lines));
                else lulu(pick(["They're still back there…", "Grey sedan. Sunglasses. Subtle.", "Lose them, Lulu!"]));
            }
            if (E.t > E.life && E.kind !== "tail") go(E, "giveup");
            break;
        // endings
        case "giveup":
            if (!E.said.gu) { E.said.gu = true; say(E, pick(E.kind === "rager" ? RAGER.giveUp : GANG.giveUp), E.kind === "rager" ? "angry" : "nice"); honk(E); end(E, "escaped", "giveup"); }
            wantS = car.s + 400; wantD = other(car.d); top = 34;
            if (c.s < car.s + 8) wantD = c.d;
            break;
        case "pulled":        // pulled over by a cop / the Shomrim: onto the shoulder, stop
            wantD = 8.6; c.dTarget = 8.6;
            c.speed = Math.max(0, c.speed - 7 * dt);
            c.d += Math.sign(8.6 - c.d) * Math.min(Math.abs(8.6 - c.d), 2.2 * dt);
            c.s += c.speed * dt;
            if (E.person) E.person.update(dt, { sit: true, talk: E.pt % 4 < 2 });
            return;
        case "fallback":      // she lost them: they ease off and drop back
            c.speed = Math.max(0, c.speed - 5 * dt);
            c.s += c.speed * dt;
            return;
        case "leave":
        default:
            wantS = car.s + 400; wantD = other(car.d); top = 34;
            if (c.s < car.s + 8) wantD = c.d;
            break;
    }
    // escaping: she simply drove away from him
    const gap = car.s - c.s;
    const loseAt = E.kind === "rager" ? TUNE.rager.outrun : TUNE.gang.lose;
    const loseFor = E.kind === "rager" ? TUNE.rager.outrunFor : TUNE.gang.loseFor;
    if (!E.result && E.phase !== "approach" && gap > loseAt) { E.outT += dt; if (E.outT > loseFor) lost(E); } else E.outT = 0;
    // speed: chase the wanted slot (position control), capped at his top speed
    if (brake) c.speed = Math.max(0, c.speed - 9 * dt);
    else {
        const err = wantS - c.s;
        const v = Math.max(0, car.speed) + clamp(err * 0.9, -10, 13);
        c.speed += clamp(v - c.speed, -11 * dt, 8 * dt);
    }
    // never drive INTO her from behind (bumps come from the side, on purpose)
    if (!hard && Math.abs(c.d - car.d) < 2.3) {
        const g = c.s - car.s;
        if (g < 0 && g > -6.5) c.speed = Math.min(c.speed, Math.max(0, car.speed - 1));
        if (g > 0 && g < 6.5) c.speed = Math.max(c.speed, car.speed + 0.5);
    }
    c.speed = clamp(c.speed, 0, top);
    c.dTarget = wantD;
    const ds = wantD - c.d;
    c.d += Math.sign(ds) * Math.min(Math.abs(ds), (hard ? 3.6 : 2.4) * dt);
    c.s += c.speed * dt;
    if (E.person) E.person.update(dt, { sit: true, talk: E.phase === "tailgate" || E.phase === "bump" || E.phase === "tail", point: E.phase === "alongside" });
}
function honk(E) {
    try { if (A.spatial && A.spatial.ready && !ctx.skipping && E.car) A.spatial.play(E.kind === "rager" ? "hornTruck" : "horn", E.car.obj, { gain: 0.95 }); } catch (e) { /* no horn */ }
}

function onBump(E) {
    E.bumps++;
    stat("uwBumps");
    ctx.G.shake = Math.max(ctx.G.shake || 0, 0.45);
    log("bump", { n: E.bumps });
    // sometimes he clips a tyre: a flat (streets' puncture) → Chaverim can help (📞 Call)
    if (!E.flat && E.kind === "rager" && ctx.streets && ctx.streets.puncture && !ctx.streets.flat && (UW.force.flat != null ? UW.force.flat : Math.random() < TUNE.rager.flat)) {
        E.flat = true;
        ctx.streets.puncture(30);
        UW.flatBy = E.rival || { name: "the road-rager" };
        H.banner(`<b>${RAGER.flat}</b><small>${RAGER.flatSub}</small>`, 3000, { key: "streets:flat", prio: 3 });
        later(1.2, () => lulu(RAGER.luluFlat, true));
        log("flat", {});
    }
}

/** She got far enough ahead of him. */
function lost(E) {
    if (E.result) return;
    if (E.kind === "rager") { lulu(pick(RAGER.outrun)); toast(RAGER.escaped, "gold", "uw:enc"); }
    else if (E.kind === "gang") toast(fill(GANG.lost, { name: E.rival ? E.rival.name : "gang" }), "gold", "uw:enc");
    if (E.kind !== "tail") earn(TUNE.reward.escape, "underworld");
    end(E, "escaped", "outran");
    go(E, "fallback");
}

/** The encounter's over (the car stays until it's out of sight). */
function end(E, result, how) {
    if (E.result) return;
    E.result = result;
    E.how = how;
    if (E.kind !== "tail") {
        rivalResult(E.rival, result);
        stat(result === "busted" ? "uwBadBusts" : "uwBadEscapes");
    }
    log("end", { kind: E.kind, result, how });
}

// ── every frame (outside traffic's loop) ─────────────────────────────────
export function badTick(dt, E) {
    const c = E.car;
    if (!c) return;
    if (!ctx.traffic.cars.includes(c)) { cleanup(E); return; }
    // she rammed him: he spins, then gives up ("my TRUCK!")
    if (c.hit) {
        if (c.hitT > 2.5) {
            ctx.world.road.nearest(c.x, c.z, c.s, tmpN);
            c.hit = false; c.speed = 0; c.s = tmpN.s; c.d = tmpN.d; c.dTarget = c.d;
            if (!E.result) { say(E, E.kind === "rager" ? "My TRUCK! Forget it!" : "The KUGEL! You hurt the kugel!"); go(E, "giveup"); }
        }
        return;
    }
    // a chase on HER: the bad guys scram (no stacking on top of a cop chase)
    if (chasing() && !E.result && E.kind !== "tail") { say(E, "Cops?! I'm OUTTA here!", "angry"); end(E, "escaped", "cops"); go(E, "leave"); }
    // led past a cop: he gets pulled over
    if (!E.result && ctx.law && ctx.law.copSees && E.phase !== "approach") {
        if (ctx.law.copSees(c.x, c.z, TUNE.copBust.sees)) { E.copSee += dt; if (E.copSee > TUNE.copBust.seeFor) copBust(E); }
        else E.copSee = Math.max(0, E.copSee - dt);
    }
    if (E.shomrim) shomrimTick(dt, E);
    if (E.cop) copTick(dt, E);
    // gone: far enough away (or the pulled-over scene is well behind her)
    const rel = c.s - ctx.car.s;
    if ((E.result && (rel > 320 || rel < -170)) || E.t > 140) removeCar(c);
}

function cleanup(E) {
    if (E.gone) return;
    E.gone = true;
    if (E.undo) { E.undo(); E.undo = null; }
    if (E.person && E.person.obj.parent) E.person.obj.parent.remove(E.person.obj);
    E.person = null;
    if (E.car && E.car.heads) for (const m of E.car.heads) m.emissiveIntensity = 2;
    if (E.cop && E.cop.car) removeCar(E.cop.car);
    if (E.shomrim && E.shomrim.car) removeCar(E.shomrim.car);
    if (!E.result && E.kind !== "tail") end(E, "escaped", "gone");
    if (UW.enc === E) UW.enc = null;
}
/** Drop the encounter now (a new run, the title, a test). */
export function dropBad(E) {
    if (!E) return;
    if (E.car && ctx.traffic.cars.includes(E.car)) ctx.traffic.remove(E.car); else cleanup(E);
}

// ── 🚓 a cop pulls HIM over ──────────────────────────────────────────────
function copBust(E) {
    const c = E.car;
    end(E, "busted", "cop");
    go(E, "pulled");
    flash(E, false);
    // our cruiser slides in behind him, lights going
    const u = ctx.traffic.add("cop", c.s - 26, laneOf(c.d), 1, c.speed + 4, { keep: true, noNearMiss: true, data: { underworld: "cop", local: true },
        ai: (dt, cc) => responderAi(E.cop, dt, cc), onRemove: () => { if (E.cop) E.cop.car = null; } });
    u.onCrash = () => false;
    E.cop = { car: u, bar: ctx.law.lightBar ? ctx.law.lightBar(u.obj) : null, target: E, gap: 8, t: 0, said: false };
    H.banner(`<b>${COPBUST.banner}</b><small>${COPBUST.sub}</small>`, 2600, { key: "uw:enc", prio: 2 });
    later(0.6, () => say(E, pick(COPBUST.bad), "angry"));
    later(2.4, () => lulu(pick(COPBUST.lulu), true));
    earn(TUNE.reward.bust, "underworld");
    if (ctx.G) ctx.G.score = (ctx.G.score || 0) + 400;
    stat("uwCopBusts");
}
function copTick(dt, E) {
    const K = E.cop;
    if (!K.car) return;
    K.t += dt;
    if (K.bar) K.bar.set(true, ctx.time);
    if (!K.said && K.t > 3) { K.said = true; bubble(pick(COPBUST.cop), K.car.obj, { cls: "cop", y: 2.3 }); }
}
/** A responder (our cruiser / the Shomrim): catch up to `gap` m behind its target, then pull onto the shoulder with it. */
function responderAi(K, dt, c) {
    if (!K) { c.speed = Math.max(0, c.speed - 8 * dt); c.s += c.speed * dt; return; }
    const T = K.target.car;
    if (!T) { c.speed = Math.max(0, c.speed - 8 * dt); c.s += c.speed * dt; return; }
    const wantS = T.s - K.gap;
    const caught = K.target.phase === "pulled";
    const err = wantS - c.s;
    const v = Math.max(0, T.speed) + clamp(err * 0.8, -12, K.fast ? 20 : 14);
    c.speed += clamp(v - c.speed, -12 * dt, (K.fast ? 10 : 7) * dt);
    c.speed = clamp(c.speed, 0, K.fast ? luluTop() * 1.25 : 40);
    const wantD = caught && Math.abs(err) < 14 ? 8.6 : Math.abs(err) < 18 ? T.d : (laneOf(T.d) > 3.5 ? 1.75 : 5.25);
    c.dTarget = wantD;
    c.d += Math.sign(wantD - c.d) * Math.min(Math.abs(wantD - c.d), 2.4 * dt);
    c.s += c.speed * dt;
    K.gapNow = T.s - c.s;
}

// ── 🔦 the Shomrim (a call from the 📞 app) ──────────────────────────────
/** Send a Shomrim Crown Vic after the bad guy. → bool */
export async function callShomrim(E = UW.enc) {
    if (!E || !E.car || E.result || E.shomrim) return false;
    E.shomrim = { pending: true };
    const kind = "community_shomrim";
    const spec = kindSpec(kind);
    const useKind = spec && await need([spec.model]) ? kind : "cop";
    if (!E.car || E.result) { E.shomrim = null; return false; }
    const c = E.car;
    const u = ctx.traffic.add(useKind, c.s - 90, other(c.d), 1, Math.max(c.speed, 15) + 10, { keep: true, noNearMiss: true, data: { underworld: "shomrim", local: true },
        ai: (dt, cc) => responderAi(E.shomrim, dt, cc), onRemove: () => { if (E.shomrim) E.shomrim.car = null; } });
    u.onCrash = () => false;
    E.shomrim = { car: u, bar: ctx.law && ctx.law.lightBar ? ctx.law.lightBar(u.obj) : null, target: E, gap: 9, t: 0, fast: true, caught: false };
    toast("🔦 Shomrim are on their way — lights ON!", "", "uw:shomrim");
    stat("uwShomrimCalls");
    log("shomrim", { phase: "coming", kind: E.kind });
    return true;
}
function shomrimTick(dt, E) {
    const K = E.shomrim;
    if (!K || !K.car) return;
    K.t += dt;
    if (K.bar) K.bar.set(true, ctx.time);
    const c = E.car, u = K.car;
    if (!K.caught && !E.result && Math.hypot(c.x - u.x, c.z - u.z) < TUNE.shomrim.catchR) {
        K.caught = true;
        end(E, "busted", "shomrim");
        go(E, "pulled");
        bubble(pick(COMM.caught), u.obj, { cls: "cop", y: 2.4, dur: 3.2 });
        later(1.8, () => say(E, pick(COMM.badCaught), "angry"));
        H.banner(`<b>${COMM.done}</b><small>${E.rival ? E.rival.name : "he"} is “helping with enquiries”</small>`, 2600, { key: "uw:enc", prio: 2 });
        earn(TUNE.reward.shomrim, "underworld");
        stat("uwShomrimBusts");
        log("shomrim", { phase: "caught", kind: E.kind });
        if (ctx.community && ctx.community.debug) { /* (community's own stats stay theirs) */ }
    } else if (!K.caught && (K.t > TUNE.shomrim.arrive || E.result)) {
        if (!E.result) toast(COMM.late, "", "uw:shomrim");
        K.caught = true;
        K.target = { car: null };
        log("shomrim", { phase: "late" });
    }
}

// ── the 📞 Call app: reasons (community.addReason) ───────────────────────
export function registerCalls() {
    const cm = ctx.community;
    if (!cm || !cm.addReason || registerCalls.done) return;
    registerCalls.done = true;
    cm.addReason("shomrim", () => {
        const E = UW.enc;
        if (!E || E.result || E.shomrim || (E.kind !== "rager" && E.kind !== "gang") || !E.car || E.phase === "approach") return null;
        const r = COMM[E.kind];
        return { id: "uwBadGuy", icon: r.icon, label: r.label, sub: r.sub, run: () => cm.callOut("shomrim", COMM.lines.car, () => callShomrim(E)) };
    });
    cm.addReason("shomrim", () => {
        const E = UW.enc;
        if (!E || E.kind !== "pickpocket" || E.phase !== "run" || E.shomer || !E.stolen) return null;
        const r = COMM.pickpocket;
        return { id: "uwPickpocket", icon: r.icon, label: r.label, sub: r.sub, run: () => cm.callOut("shomrim", COMM.lines.foot, () => { if (UW.shomerAfter) UW.shomerAfter(E); }) };
    });
    cm.addReason("chaverim", () => {
        if (!UW.flatBy || !(ctx.streets && ctx.streets.flat) || ctx.state !== "playing") return null;
        const r = COMM.flat;
        return { id: "uwFlat", icon: r.icon, label: r.label, sub: r.sub, run: () => cm.callOut("chaverim", COMM.lines.flat, () => chaverimFlat()) };
    });
}
/** Chaverim fix the flat (their own visit when community can send one, else a quick swap). */
export function chaverimFlat() {
    UW.flatBy = null;
    stat("uwChaverim");
    log("chaverim", {});
    let ok = false;
    try { ok = !!(ctx.community && ctx.community.request && ctx.community.request("fix", { byCall: true })); } catch (e) { ok = false; }
    if (!ok) later(4, () => { if (ctx.streets && ctx.streets.repairTyres) ctx.streets.repairTyres("🔧 Chaverim swapped the tyre! A bracha on your wheels."); });
    return ok;
}
