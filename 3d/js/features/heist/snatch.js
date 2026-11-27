// features/heist — 🛵 ROBBERIES ON THE ROAD (small, capped, always recoverable).
//
//   THE MOPED SNATCH  she's stopped (a stop sign / a jam / the rest-area lot / parked) or walking: a moped
//                     creeps up — a readable WARNING beat (TUNE.snatch.warn s): HONK or drive off (on foot:
//                     ✋ clutch the purse) and he wobbles away empty-handed. Too slow and he grabs a CAPPED
//                     share (≤ 12 % of the wallet, ≤ 45 coins) and zooms off; clip the moped (or grab him on
//                     foot — it sputters) and she gets it ALL back + a bonus. Lose him → it's gone (capped).
//   THE CAR THIEF     she's walked away from her parked car (highway, on foot): a robber tries the door — run
//                     back in time and he bolts; too late and he drives off in it (foot's parked-car stub, its
//                     `ai` swapped for a lurching, stalling learner driver). Catch up → ✋ YANK HIM OUT (a bonus);
//                     lose him → he ditches it on the shoulder up the road. She NEVER loses her car for good.
import { ctx, on, hook, emit } from "../../core/ctx.js";
import { addCoins } from "../../core/driving.js";
import { wallet } from "../../core/save.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { TUNE, PAY, SNATCH, THEFT } from "./data.js";
import { models, cloneWithColors, findNodes, need, live, rand, pick, clamp, pt, onFoot, luluPos, distTo, stat, remember,
    luluSays, npcSays, setChip, setBeacon, fmtM, sfx, burst, inTown, g, freeMode } from "./common.js";

const TS = TUNE.snatch, TT = TUNE.theft;
const MODELS = ["heistMoped", "heistRobber", "heistProps"];
export const SN = { nextT: rand(TS.first[0], TS.first[1]), still: 0, ev: null };
export const CT = { awayT: 0, want: rand(TT.away[0], TT.away[1]), ev: null, tried: false };
const _n = {};

// ════════════════════════════════ the moped snatch ═════════════════════
/** Start a snatch now (debug / the scheduler). mode: "car" | "foot". */
export function snatch(mode = onFoot() ? "foot" : "car") {
    if (SN.ev || !ctx.car) return false;
    if (wallet.coins < TS.minWallet) return false;
    if (!ready()) { need(MODELS); return false; }
    const rd = ctx.world.road, me = luluPos();
    const near = rd.nearest(me.x, me.z, ctx.car.s, _n);
    const st = near.street || null;
    const town = inTown();
    // which side he comes up on: her right (the kerb / the shoulder)
    let d = mode === "foot" ? near.d - 0.9 : (town ? near.d + 2.0 : (near.d > 3.5 ? 7.4 : near.d + 2.6));
    if (town && st) d = clamp(d, -(st.walk || 9) + 0.6, (st.walk || 9) - 0.6);
    const s = near.s - 32;
    const obj = cloneWithColors(models.heistMoped, { Paint: pick(["#26C6DA", "#AB47BC", "#FFCA28"]) });
    const rider = spawnPerson("heistRobber");
    const seat = findNodes(obj, "Anchor_seat")[0];
    (seat || obj).add(rider.obj);
    rider.obj.position.set(0, seat ? -0.42 : 0.42, 0.05);
    const wheels = findNodes(obj, "Wheel_");
    ctx.scene.add(obj);
    SN.ev = { mode, phase: "approach", t: 0, s, d, v: 9, obj, rider, wheels, take: 0, st, sputT: 0, spotRm: null };
    place(SN.ev);
    sfx.buzz();
    emit("heist:snatch", { phase: "approach", mode });
    return true;
}
const ready = () => !!(models.heistMoped && models.heistRobber);
function place(ev) {
    const p = pt(ev.s, ev.d);
    ev.obj.position.set(p.x, 0, p.z);
    ev.obj.rotation.set(0, p.h, ev.tip || 0);
    ev.x = p.x; ev.z = p.z;
    for (const w of ev.wheels) w.rotation.x += ev.v * (1 / 30) / 0.22;
}
/** Keep the moped on its street in a town (the district's s jumps between streets past the ends). */
function clampS(ev) {
    const st = ev.st;
    if (!st || st.base == null) return false;
    const lo = st.base + st.a0 + 4, hi = st.base + st.a1 - 4;
    if (ev.s > hi) { ev.s = hi; return true; }
    if (ev.s < lo) ev.s = lo;
    return false;
}
function warnHtml(ev) { return (ev.mode === "foot" ? SNATCH.warnFoot : SNATCH.warn).replace("{honk}", g("honk")).replace("{interact}", g("interact")); }
function snatchTick(dt) {
    const ev = SN.ev;
    if (!ev) return;
    ev.t += dt;
    const me = luluPos(), car = ctx.car;
    const near = ctx.world.road.nearest(me.x, me.z, car.s, _n);
    const lulS = near.s;
    if (ev.mode === "car" && onFoot()) ev.mode = "foot";
    if (ev.mode === "foot" && !onFoot() && ctx.state === "playing") ev.mode = "car";
    if (ev.phase === "approach") {
        ev.v = 9;
        ev.s += ev.v * dt;
        if (ev.s > lulS - 1.2 || ev.t > 8) {
            ev.phase = "warn"; ev.t = 0;
            H.banner(warnHtml(ev), Math.round(TS.warn * 1000) + 300, { key: "heist:snatch", prio: 3 });
            npcSays(ev.rider.obj, pick(SNATCH.creep), TS.warn);
            if (ctx.foot && ctx.foot.addSpot) ev.spotRm = ctx.foot.addSpot({ pos: () => (SN.ev === ev && ev.phase === "warn" ? { x: ev.x, z: ev.z } : null), r: 6, first: true,
                label: "🫷 CLUTCH YOUR PURSE!", short: "PURSE", act: () => dodge(ev, "purse") });
        }
    } else if (ev.phase === "warn") {
        ev.v = 0;
        ev.s += (lulS - 0.6 - ev.s) * Math.min(1, dt * 3);
        if (ev.mode === "car" && car.speed > 7) return dodge(ev, "drove");
        if (ev.t >= TS.warn) grab(ev);
    } else if (ev.phase === "flee") {
        const top = ev.mode === "foot" ? TS.speedFoot : inTown() ? TS.speedTown : TS.speedCar;
        // on foot it sputters (he never did fix that carburettor)
        ev.sputT -= dt;
        if (ev.sputT < -2.4) ev.sputT = 0.8;
        const want = ev.mode === "foot" && ev.sputT > 0 ? 1.2 : top;
        ev.v += clamp(want - ev.v, -8 * dt, 6 * dt);
        ev.s += ev.v * dt;
        const end = clampS(ev);
        const gap = distTo(ev.x, ev.z);
        const r = ev.mode === "foot" ? TS.catchFoot : TS.catchCar;
        if (gap < r && (ev.mode === "foot" || car.speed > 2)) return caught(ev);
        if (ev.t > TS.maxT || gap > TS.lostR || (end && gap > 60)) return lost(ev);
        setChip("🛵 GET YOUR COINS BACK", `${ev.mode === "foot" ? "run him down" : "clip the moped"} · −${ev.take} 💰 · ${fmtM(gap)}`, 1 - ev.t / TS.maxT, "#26C6DA");
        setBeacon({ x: ev.x, y: 0, z: ev.z, lift: 2.4 }, "#26C6DA");
        if (Math.random() < 0.08) sfx.buzz();
    } else if (ev.phase === "out") {
        ev.v = Math.max(0, ev.v - 6 * dt);
        if (!ev.tip) { ev.s += 7 * dt; ev.d += dt * 1.5; }
        if (ev.t > 3.5) return endSnatch();
    }
    place(ev);
    if (ev.rider) ev.rider.update(dt, { sit: true, cheer: ev.phase === "flee" && Math.sin(ctx.time * 3) > 0.6 });
}
function dodge(ev, how) {
    if (ev.phase !== "warn") return;
    ev.phase = "out"; ev.t = 0; ev.v = 6;
    if (ev.spotRm) { ev.spotRm(); ev.spotRm = null; }
    H.toast("😤 Not today! He wobbles off empty-handed", "gold", { key: "heist:snatch" });
    luluSays(pick(SNATCH.dodged), true);
    npcSays(ev.rider.obj, "Eh, worth a shot!", 1.6);
    stat("heistSnatchDodged", 1);
    emit("heist:snatch", { phase: "dodged", how, mode: ev.mode });
}
function grab(ev) {
    if (ev.spotRm) { ev.spotRm(); ev.spotRm = null; }
    const have = wallet.coins;
    const take = Math.max(1, Math.min(TS.cap, Math.ceil(have * TS.capFrac), have));
    if (!wallet.spend(take)) { ev.phase = "out"; ev.t = 0; return; }
    ev.take = take;
    const G = ctx.G;
    G.coins = Math.max(0, (G.coins || 0) - take);
    ev.phase = "flee"; ev.t = 0; ev.v = 4;
    H.banner(SNATCH.grab(take), 2600, { key: "heist:snatch", prio: 3 });
    sfx.womp();
    burst(ev.x, 1.2, ev.z, 10, 2.5, [1, 0.84, 0.25], 0.3, 0.7);
    setTimeout(() => { if (SN.ev === ev) luluSays(pick(SNATCH.lulu), true); }, 600);
    stat("heistSnatched", 1);
    emit("heist:snatch", { phase: "grab", n: take, mode: ev.mode });
}
function caught(ev) {
    ev.phase = "out"; ev.t = 0; ev.tip = 1.25;
    if (ev.rider) { ev.rider.obj.rotation.z = 0.8; }
    const back = ev.take, bonus = PAY.snatchBonus;
    // the wallet gets back exactly what he took (+ a bonus as ordinary coins)
    wallet.add(back);
    ctx.G.coins = (ctx.G.coins || 0) + back;
    addCoins(bonus, "heist:snatch");
    sfx.coin(); sfx.yay();
    burst(ev.x, 1.0, ev.z, 20, 3.5, [1, 0.84, 0.25], 0.35, 0.9);
    H.banner(`<b>🛵 GOT IT BACK! +${back} 💰 (+${bonus} bonus)</b><small>${pick(SNATCH.caught)}</small>`, 2600, { key: "heist:snatch", prio: 3 });
    npcSays(ev.rider.obj, pick(SNATCH.caught), 2.2);
    setChip(null); setBeacon(null);
    stat("heistSnatchCaught", 1);
    remember("snatch", { got: true, n: back });
    emit("heist:snatch", { phase: "caught", n: back, bonus, mode: ev.mode });
}
function lost(ev) {
    ev.phase = "out"; ev.t = 0;
    H.banner(SNATCH.lost(ev.take), 2600, { key: "heist:snatch", prio: 2 });
    setChip(null); setBeacon(null);
    remember("snatch", { got: false, n: ev.take });
    emit("heist:snatch", { phase: "lost", n: ev.take, mode: ev.mode });
    endSnatch();
}
export function endSnatch() {
    const ev = SN.ev;
    SN.ev = null;
    SN.nextT = rand(TS.every[0], TS.every[1]);
    if (!ev) return;
    if (ev.spotRm) ev.spotRm();
    if (ev.obj.parent) ev.obj.parent.remove(ev.obj);
    if (ev.phase === "flee") { setChip(null); setBeacon(null); }
}
on("honk", () => { const ev = SN.ev; if (ev && ev.phase === "warn") dodge(ev, "honk"); });

// ════════════════════════════════ the car thief ════════════════════════
function stub() {
    const f = ctx.foot;
    if (!f || !f.active || f.ownCar !== "parked") return null;
    const pc = f.parkedCar;
    if (!pc || pc.wrecked || pc.key !== "lulu") return null;
    return ctx.traffic.cars.find(c => c.data && c.data.footStub && Math.abs(c.x - pc.x) < 0.01 && Math.abs(c.z - pc.z) < 0.01) || null;
}
/** A thief tries her parked car (debug / the scheduler). */
export function carTheft() {
    if (CT.ev || !onFoot() || inTown()) return false;
    const c = stub();
    if (!c) return false;
    if (!models.heistRobber) { need(MODELS); return false; }
    const p = spawnPerson("heistRobber");
    const fx = Math.sin(c.h), fz = Math.cos(c.h), lx = Math.cos(c.h), lz = -Math.sin(c.h);
    p.obj.position.set(c.x - fx * 9 + lx * 2.2, 0, c.z - fz * 9 + lz * 2.2);
    ctx.scene.add(p.obj);
    const ai0 = c.ai;
    CT.ev = { phase: "sneak", t: 0, car: c, ai0, p, s: c.s, d: c.d, v: 0, stallT: rand(TT.stallEvery[0], TT.stallEvery[1]), stall: 0, spotRm: null };
    H.banner(THEFT.warn, 2800, { key: "heist:theft", prio: 3 });
    npcSays(p.obj, pick(THEFT.thief), 2.4);
    sfx.siren(0.4);
    emit("heist:theft", { phase: "warn" });
    return true;
}
function theftTick(dt) {
    const ev = CT.ev;
    if (!ev) return;
    ev.t += dt;
    const c = ev.car;
    if (!ctx.traffic.cars.includes(c)) return endTheft();
    const me = luluPos(), gap = Math.hypot(c.x - me.x, c.z - me.z);
    if (ev.phase === "sneak") {
        const lx = Math.cos(c.h), lz = -Math.sin(c.h);
        const tx = c.x + lx * 1.4, tz = c.z + lz * 1.4;
        const o = ev.p.obj.position, dx = tx - o.x, dz = tz - o.z, d = Math.hypot(dx, dz);
        if (d > 0.3) { const k = Math.min(d, 3.1 * dt) / d; o.x += dx * k; o.z += dz * k; ev.p.face(tx, tz, dt, 8); ev.p.update(dt, { walk: 3.1 }); }
        if (gap < TT.saveR) {        // she made it back in time
            ev.phase = "bolt"; ev.t = 0;
            npcSays(ev.p.obj, pick(THEFT.bolt), 1.8);
            H.toast("😤 He legged it — your car's fine!", "gold", { key: "heist:theft" });
            stat("heistTheftStopped", 1);
            emit("heist:theft", { phase: "stopped" });
        } else if (ev.t >= TT.warn) drive(ev);
        setChip("🚨 GET BACK TO YOUR CAR", `${fmtM(gap)} · quick!`, 1 - ev.t / TT.warn, "#FF7043");
        setBeacon({ x: c.x, y: 0, z: c.z, lift: 2.6 }, "#FF7043");
    } else if (ev.phase === "bolt") {
        const o = ev.p.obj.position, fx = Math.sin(c.h), fz = Math.cos(c.h);
        o.x -= fx * 6 * dt; o.z -= fz * 6 * dt;
        ev.p.obj.rotation.y = c.h + Math.PI;
        ev.p.update(dt, { walk: 6 });
        setChip(null); setBeacon(null);
        if (ev.t > 3) endTheft();
    } else if (ev.phase === "drive") {
        if (ev.t > TT.maxT) return ditch(ev);
        setChip("🚗 GET YOUR CAR BACK", `${g("interact")} yank him out · ${fmtM(gap)}`, 1 - ev.t / TT.maxT, "#FF7043");
        setBeacon({ x: c.x, y: 0, z: c.z, lift: 2.6 }, "#FF7043");
        if (ev.p) ev.p.update(dt, { sit: true, cheer: ev.stall > 0 });
    } else if (ev.phase === "out") {
        if (ev.p) {
            const o = ev.p.obj.position, lx = Math.cos(c.h), lz = -Math.sin(c.h);
            o.x += lx * 5 * dt; o.z += lz * 5 * dt;
            ev.p.obj.rotation.y = Math.atan2(lx, lz);
            ev.p.update(dt, { walk: 5 });
        }
        if (ev.t > 3) endTheft();
    }
}
function drive(ev) {
    const c = ev.car;
    ev.phase = "drive"; ev.t = 0;
    // in he hops: seated, at the wheel of her pink convertible
    ctx.scene.remove(ev.p.obj);
    c.obj.add(ev.p.obj);
    ev.p.obj.position.set(0.38, 0.12, -0.15);
    ev.p.obj.rotation.set(0, 0, 0);
    c.onCrash = () => { if (CT.ev === ev && ev.phase === "drive") yank(ev, "ram"); return false; };
    c.ai = (dt, cc) => thiefAi(dt, cc, ev);
    H.banner(THEFT.gone, 3200, { key: "heist:theft", prio: 3 });
    luluSays(pick(["MY CAR!", "Hey! That's MINE!", "Oh you did NOT."]), true);
    ev.spotRm = ctx.foot && ctx.foot.addSpot ? ctx.foot.addSpot({ pos: () => (CT.ev === ev && ev.phase === "drive" ? { x: c.x, z: c.z } : null), r: TT.yankR, first: true,
        label: "✋ YANK HIM OUT!", short: "YANK", act: () => yank(ev, "yank") }) : null;
    stat("heistCarStolen", 1);
    emit("heist:theft", { phase: "stolen" });
}
/** A learner in her car: lurches up the road, stalls, brakes hard when she's right there (never runs her down). */
function thiefAi(dt, c, ev) {
    const rd = ctx.world.road;
    ev.stallT -= dt;
    if (ev.stallT <= 0 && ev.stall <= 0) { ev.stall = rand(TT.stallFor[0], TT.stallFor[1]); ev.stallT = rand(TT.stallEvery[0], TT.stallEvery[1]); if (Math.random() < 0.5) npcSays(ev.p.obj, pick(["Which one's the CLUTCH?!", "Stalled AGAIN?!", "Why is it PINK inside?!"]), 1.4); }
    if (ev.stall > 0) ev.stall -= dt;
    const me = luluPos(), close = Math.hypot(c.x - me.x, c.z - me.z) < 5;
    const want = ev.stall > 0 || close ? 0 : TT.drive;
    ev.v += clamp(want - ev.v, -14 * dt, 4 * dt);
    if (close) ev.v = Math.min(ev.v, 2.5);
    ev.s += ev.v * dt;
    ev.d += (Math.min(ev.d, 7.4) - ev.d) * Math.min(1, dt);
    rd.point(ev.s, ev.d, _n);
    c.x = _n.x; c.z = _n.z; c.h = _n.h; c.s = ev.s; c.d = ev.d; c.speed = ev.v;
    c.free = true;
}
function yank(ev, how) {
    if (ev.phase !== "drive") return;
    const c = ev.car;
    ev.phase = "out"; ev.t = 0;
    restoreCar(ev);
    // out he tumbles (and runs for it)
    c.obj.remove(ev.p.obj);
    const lx = Math.cos(c.h), lz = -Math.sin(c.h);
    ev.p.obj.position.set(c.x + lx * 1.5, 0, c.z + lz * 1.5);
    ctx.scene.add(ev.p.obj);
    npcSays(ev.p.obj, pick(THEFT.thiefOut), 1.8);
    if (ctx.foot && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(THEFT.yank), 2);
    addCoins(PAY.carBonus, "heist:theft");
    sfx.yay();
    burst(c.x, 1.0, c.z, 16, 3, [1, 0.5, 0.75], 0.3, 0.8);
    H.banner(`<b>🚗 CAR'S BACK! +${PAY.carBonus} 💰</b><small>✋ GET BACK IN — and maybe lock it this time</small>`, 2600, { key: "heist:theft", prio: 3 });
    setChip(null); setBeacon(null);
    stat("heistCarsRecovered", 1);
    remember("theft", { got: true, how });
    emit("heist:theft", { phase: "recovered", how });
}
function ditch(ev) {
    const c = ev.car;
    ev.phase = "out"; ev.t = 0;
    // he pulls onto the shoulder, gets out and walks off whistling
    ev.d = 8.0;
    ctx.world.road.point(ev.s, ev.d, _n);
    c.x = _n.x; c.z = _n.z; c.h = _n.h;
    restoreCar(ev);
    c.obj.remove(ev.p.obj);
    ev.p.obj.position.set(c.x + Math.cos(c.h) * 1.5, 0, c.z - Math.sin(c.h) * 1.5);
    ctx.scene.add(ev.p.obj);
    H.banner(THEFT.ditched, 3000, { key: "heist:theft", prio: 2 });
    setChip(null); setBeacon(null);
    remember("theft", { got: false });
    emit("heist:theft", { phase: "ditched" });
}
function restoreCar(ev) {
    const c = ev.car;
    if (ev.spotRm) { ev.spotRm(); ev.spotRm = null; }
    c.ai = ev.ai0 || ((dt, cc) => { cc.speed = 0; });
    c.speed = 0; c.onCrash = undefined;
    ctx.traffic.place(c, 0);
}
export function endTheft() {
    const ev = CT.ev;
    CT.ev = null;
    CT.awayT = 0; CT.want = rand(TT.away[0], TT.away[1]);
    if (!ev) return;
    if (ev.phase === "drive" || ev.phase === "sneak") { setChip(null); setBeacon(null); }
    if (ev.phase === "drive" && ctx.traffic.cars.includes(ev.car)) restoreCar(ev);
    if (ev.spotRm) ev.spotRm();
    if (ev.p && ev.p.obj.parent) ev.p.obj.parent.remove(ev.p.obj);
}

// ════════════════════════════════ the scheduler ════════════════════════
function canStart() {
    const G = ctx.G;
    if (!live("snatch") || !freeMode("snatch") || G.tutorial) return false;
    if (ctx.law && (ctx.law.chasing || (ctx.law.fugitive))) return false;
    if (ctx.heist && ctx.heist.busy && ctx.heist.busy("snatch")) return false;
    if (ctx.engaged("heist")) return false;      // (ci/hud: one activity at a time)
    return true;
}
hook("hud", dt => {
    if (ctx.paused || (ctx.state !== "playing" && ctx.state !== "footRun")) { if (SN.ev && ctx.state !== "playPhoto" && !ctx.paused) endSnatch(); return; }
    try {
        snatchTick(dt);
        theftTick(dt);
        if (!canStart()) return;
        // the moped: she's stopped (driving) or walking
        if (!SN.ev && !CT.ev) {
            SN.nextT -= dt;
            const stopped = ctx.state === "playing" && ctx.car.speed < 0.8;
            SN.still = stopped ? SN.still + dt : 0;
            if (SN.nextT <= 0 && (onFoot() || SN.still > TS.still)) { SN.nextT = rand(25, 45); need(MODELS); snatch(); }
        }
        // the car thief: she's out walking, far from her parked car
        if (!CT.ev && !SN.ev && onFoot() && !inTown()) {
            const c = stub();
            if (c && distTo(c.x, c.z) > TT.far) { CT.awayT += dt; if (CT.awayT > CT.want) { CT.awayT = 0; CT.want = rand(TT.away[0], TT.away[1]) * 1.6; need(MODELS); if (!CT.tried && Math.random() < TT.chance) { CT.tried = true; carTheft(); } } }
            else CT.awayT = 0;
        }
    } catch (e) { console.error("[heist snatch]", e); }
});
on("foot:end", () => { if (CT.ev) { const ev = CT.ev; if (ev.phase === "drive") ditchQuiet(ev); endTheft(); } });
function ditchQuiet(ev) { try { restoreCar(ev); if (ev.p.obj.parent) ev.p.obj.parent.remove(ev.p.obj); } catch (e) { /* */ } }
hook("runStart", () => { endSnatch(); endTheft(); SN.nextT = rand(TS.first[0], TS.first[1]); SN.still = 0; CT.tried = false; });
on("title", () => { endSnatch(); endTheft(); });
on("town:enter", () => endSnatch());
on("town:leave", () => endSnatch());
