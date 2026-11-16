// features/streets — the CHASE LAB (debug + tests only; nothing here runs in a
// normal game unless a test turns it on).
//
//   bot      a competent getaway driver: flat out, weaves to the lane with the most
//            room (oncoming lanes too when they're clear), nitro when there's room or
//            a cruiser is close, brakes only to avoid rear-ending traffic. mode "stop"
//            just stands on the brakes (the "gives up" driver who should get caught).
//   sim()    runs a whole pursuit synchronously, many game-time steps per call and no
//            rendering, with Math.random seeded — the numbers behind the law tuning
//            (escape time / rate per star level, cop vs. Lulu speeds, PIT / box-in counts).
import { ctx, on, hook, setState, wrapAngle } from "../../core/ctx.js";
import { startRun } from "../../core/driving.js";
import { input } from "../../input.js";

const tmp = {};
export const bot = { on: false, mode: "run", lane: 1.75, laneT: 0, oncoming: true, boost: true, skill: 1, dodge: true };

function laneRoom(lane, car) {
    // free road ahead in `lane` (metres), discounting cars by how fast we close on them
    let room = 260;
    for (const c of ctx.traffic.cars) {
        if (c.data && c.data.law && c.data.law.mode === "chase") continue;     // cruisers on our tail aren't "ahead"
        if (Math.abs(c.d - lane) > 2.1) continue;
        const gap = c.s - car.s;
        if (gap < -3 || gap > 260) continue;
        const vRel = car.speed - (c.hit ? 0 : c.speed * c.dir);
        const eff = gap - Math.max(0, vRel) * 1.4;
        room = Math.min(room, eff);
    }
    // K9 dogs / cop missiles coming down this lane: a lane to get out of
    const L = ctx.law && ctx.law._dbg && ctx.law._dbg.L;
    if (L && L.threats && bot.dodge) for (const t of L.threats) {
        const gap = t.s - car.s;
        if (gap > 4 && gap < 75 && Math.abs(t.d - lane) < 2.4) room = Math.min(room, gap - 60);
    }
    return room;
}

hook("controls", (ctl, dt) => {
    if (!bot.on) return;
    const car = ctx.car, road = ctx.world.road;
    ctl.analog = true; ctl.handbrake = false;
    if (bot.mode === "stop") {
        ctl.steer = 0; ctl.throttle = 0; ctl.brake = car.vF > 0.6 ? 1 : 0; input.boost = false;
        return;
    }
    bot.laneT -= dt;
    const lanes = [1.75, 5.25];
    if (bot.oncoming) lanes.push(-1.75, -5.25);
    let best = bot.lane, bestRoom = laneRoom(bot.lane, car);
    if (bot.laneT <= 0) {
        for (const l of lanes) {
            if (l === bot.lane) continue;
            let r = laneRoom(l, car) - (l < 0 ? 25 : 0) - Math.abs(l - car.d) * 2;   // oncoming lanes only when clearly better
            if (r > bestRoom + 12) { best = l; bestRoom = r; }
        }
        if (best !== bot.lane) bot.lane = best;
        bot.laneT = bot.skill >= 1 ? 0.8 : 0.8 + (1 - bot.skill) * 2.4;     // a sloppier driver reacts later
    }
    const look = Math.max(10, car.speed * 0.75);
    road.point(car.s + look, bot.lane, tmp);
    const diff = wrapAngle(Math.atan2(tmp.x - car.pos.x, tmp.z - car.pos.z) - car.h);
    ctl.steer = Math.max(-1, Math.min(1, -diff * 2.8));
    const room = laneRoom(bot.lane, car);
    const need = (car.speed * 0.9 + 8) * (bot.skill >= 1 ? 1 : 1 + (1 - bot.skill));
    ctl.throttle = room > need ? 1 : room > need * 0.6 ? 0.4 : 0;
    ctl.brake = room < need * 0.45 ? 0.7 : 0;
    // nitro: plenty of road, or a cruiser breathing down her neck
    const L = ctx.law && ctx.law._dbg && ctx.law._dbg.L;
    let copNear = 999;
    if (L) for (const u of L.units) if (u.car && u.mode === "chase") copNear = Math.min(copNear, Math.hypot(u.car.x - car.pos.x, u.car.z - car.pos.z));
    input.boost = bot.boost && ctl.brake === 0 && room > 90 && (copNear < 70 || (room > 160 && bot.skill >= 1)) && ctx.G.boost > 0.13;
}, 300);

/** One game-time step without rendering (a trimmed copy of app.js step()). */
function simStep(dt) {
    ctx.time += dt;
    ctx.stateT += dt;
    const def = ctx.states[ctx.state];
    if (def && def.update) def.update(dt, {});
    const cur = ctx.states[ctx.state];
    if (cur && cur.world !== false && !ctx.view && ctx.world) ctx.world.update(dt, ctx.car.s, ctx.car.pos);
}

function mulberry32(a) {
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let lastChaseEnd = null;
on("cop:chase", e => { if (e && e.active === false) lastChaseEnd = e.result || "ended"; });

/**
 * Run one pursuit to the end. opts: { stars 1–5, mode "cruise" | "story", seed, maxT (s), bot "run" | "stop",
 * s (start distance), warm (s of driving before the chase) }. Returns the outcome + numbers.
 */
export function sim(opts = {}) {
    const { stars = 1, mode = "cruise", seed = 1, maxT = 120, warm = 4 } = opts;
    const realRandom = Math.random;
    Math.random = mulberry32(seed * 7919 + stars * 104729 + (mode === "story" ? 17 : 0));
    const wasPaused = ctx.paused;
    ctx.paused = true;                      // the real main loop stands still while we simulate
    const dt = 1 / 30;
    const out = { stars, mode, seed, outcome: "timeout", t: 0, maxHeat: stars, copTop: 0, luluTop: 0, luluAvg: 0,
        seenT: 0, searchT: 0, pits: 0, copHits: 0, bustPeak: 0, units: 0, copCrashes: 0, startGap: 0, minGap: 999, roadblocks: 0,
        copAvg: 0, gap5: 0, gap15: 0, gap30: 0, err: null };
    try {
        startRun({ mode, s: opts.s != null ? opts.s : undefined });
        setState("playing");
        const car = ctx.car, road = ctx.world.road;
        const p = road.point(car.s, 1.75, {});
        car.place(p.x, p.z, p.h);
        car.vx = Math.sin(p.h) * 30; car.vz = Math.cos(p.h) * 30;
        bot.on = true; bot.mode = "run"; bot.lane = 1.75; bot.laneT = 0; bot.skill = opts.skill != null ? opts.skill : 1;
        bot.oncoming = opts.oncoming != null ? !!opts.oncoming : bot.skill >= 1;     // the "average player" stays on her own side
        bot.dodge = opts.dodge != null ? !!opts.dodge : true;

        ctx.G.boost = 0.35;
        for (let i = 0; i < warm * 30; i++) simStep(dt);
        bot.mode = opts.bot || "run";
        lastChaseEnd = null;
        if (ctx.law) ctx.law.startChase("RECKLESS DRIVING", { heat: stars, msg: "🧪 LAB CHASE" });
        const L = ctx.law._dbg.L;
        if (opts.gap != null) {           // "on her back": put the lead cruiser right behind her, matching her speed
            const u = L.units.find(u => u.mode === "chase" && u.car);
            if (u) {
                const q = road.point(car.s - opts.gap, car.d, {});
                Object.assign(u.car, { free: true, x: q.x, z: q.z, h: q.h, s: car.s - opts.gap, d: car.d, speed: car.speed });
            }
        }
        const seenUnits = new Set();
        let copSum = 0, copN = 0;
        let sumV = 0, n = 0;
        const crashOff = on("crash", e => { if (e && e.car && e.car.data && e.car.data.law) out.copHits++; });
        const rbOff = on("streets:roadblock", () => out.roadblocks++);
        out.dmg = {};
        const dmgOff = on("damage", e => { const k = String(e && e.source || "?"); out.dmg[k] = (out.dmg[k] || 0) + 1; });
        for (let i = 0; i < maxT * 30; i++) {
            simStep(dt);
            out.t += dt;
            const ch = L.chase;
            if (ch) {
                out.maxHeat = Math.max(out.maxHeat, ch.heat);
                out.bustPeak = Math.max(out.bustPeak, ch.bust);
                if (ch.searching) out.searchT += dt; else out.seenT += dt;
            }
            for (const u of L.units) {
                if (!u.car || u.mode !== "chase") continue;
                if (!seenUnits.has(u)) { seenUnits.add(u); out.units++; if (out.units === 1) out.startGap = Math.round(car.s - u.car.s); }
                if (!u.car.hit) { out.copTop = Math.max(out.copTop, u.car.speed); if (out.t > 3) { copSum += u.car.speed; copN++; } }
                if (u.car.hit && !u.__crashed) { u.__crashed = true; out.copCrashes++; }
                if (!u.car.hit) out.minGap = Math.min(out.minGap, Math.hypot(u.car.x - car.pos.x, u.car.z - car.pos.z));
                if (u.slot === "rear" && u.pitT < 0 && u.pitT > -dt * 1.5) out.pits++;
            }
            out.luluTop = Math.max(out.luluTop, car.speed);
            const lead = L.units.filter(u => u.car && u.mode === "chase" && !u.car.hit).map(u => Math.hypot(u.car.x - car.pos.x, u.car.z - car.pos.z)).sort((a, b) => a - b)[0];
            for (const [k, at] of [["gap5", 5], ["gap15", 15], ["gap30", 30]]) if (Math.abs(out.t - at) < dt / 2) out[k] = lead == null ? -1 : Math.round(lead);
            sumV += car.speed; n++;
            if (ctx.state === "lawBust" || ctx.state === "lawArrest" || ctx.state === "wrecked" || ctx.state === "lawJail") { out.outcome = ctx.state === "lawBust" ? "busted" : ctx.state === "wrecked" ? "wrecked" : "arrested"; break; }
            if (!L.chase && lastChaseEnd) { out.outcome = lastChaseEnd; break; }
        }
        crashOff(); rbOff(); dmgOff();
        out.luluAvg = n ? sumV / n : 0;
        out.copAvg = copN ? copSum / copN : 0;
    } catch (e) {
        out.err = String(e && e.stack || e).slice(0, 400);
    } finally {
        bot.on = false; bot.mode = "run";
        input.boost = false;
        Math.random = realRandom;
        ctx.paused = wasPaused;
    }
    for (const k of ["t", "copTop", "copAvg", "luluTop", "luluAvg", "seenT", "searchT", "bustPeak", "minGap"]) out[k] = Math.round(out[k] * 10) / 10;
    return out;
}
