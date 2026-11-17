// features/rides — 🚨 the siren (cop car, ambulance) and the 📯 air horn (truck, bus).
//
// Siren ON: the light bar strobes (law's rig on the ride's own LightRed/LightBlue
// materials), a positional siren loop rides on her car, and traffic MAKES WAY: cars
// ahead in her direction ease onto the right shoulder and crawl, oncoming cars hug
// their shoulder and slow; once she's past they merge back. Scripted cars (cops,
// Avigail, events — anything with its own `ai`) are never touched. Nothing allocates
// per frame: the yielding cars sit in one Set.
import { ctx, emit } from "../../core/ctx.js";
import * as A from "../../audio.js";
import { LANES_OURS } from "../../world.js";

const yielding = new Set();
const SHOULDER_D = 7.35;

export function setSiren(R, on) {
    on = !!on;
    if (!R || R.siren === on) return;
    R.siren = on;
    if (on) {
        if (!R.bar && ctx.law && ctx.law.lightBar && R.obj) {
            R.bar = ctx.law.lightBar(R.obj);
            // law's glow sprites sit on a sedan's roof: lift them onto a taller light bar
            const rig = R.obj.userData.lawRig, lb = R.def.lightBar;
            if (rig && lb && rig.sr && rig.sb) { rig.sr.position.set(-lb[0], lb[1], lb[2]); rig.sb.position.set(lb[0], lb[1], lb[2]); }
        }
        R.snd = A.spatial && A.spatial.ready ? A.spatial.loop(R.def.siren || "siren", ctx.car.obj, { gain: 0.6, prio: 4 }) : null;
    } else {
        if (R.bar) R.bar.set(false);
        if (R.snd) { try { R.snd.stop(); } catch (e) { /* gone */ } }
        R.snd = null;
        releaseAll();
    }
    emit("rides:siren", { id: R.id, on });
}

/** Per frame while the siren is on (driving). */
export function sirenTick(dt, R) {
    if (!R.siren) return;
    if (R.bar) R.bar.set(true, ctx.time);
    if (R.snd && !R.snd.alive) R.snd = null;
    if (!R.snd && A.spatial && A.spatial.ready && !ctx.skipping) R.snd = A.spatial.loop(R.def.siren || "siren", ctx.car.obj, { gain: 0.6, prio: 4 });
    if (ctx.state === "playing") yieldTraffic();
}

function yieldTraffic() {
    const car = ctx.car;
    for (const c of ctx.traffic.cars) {
        if (c.hit || c.ai || c.free) { if (yielding.has(c)) yielding.delete(c); continue; }
        const rel = c.s - car.s;
        const ahead = c.dir > 0 ? rel > -4 && rel < 110 : rel > -6 && rel < 140;
        if (ahead) {
            if (!yielding.has(c)) { yielding.add(c); R_stats.yielded++; }
            c.dTarget = c.dir * SHOULDER_D;
            c.want = c.dir > 0 ? 3.5 : 5;
            c.laneCooldown = 1.5;
        } else if (yielding.has(c) && rel < -8) release(c);
    }
    // cars that left the road (recycled) drop out on their own
    if (yielding.size > 24) for (const c of yielding) if (!ctx.traffic.cars.includes(c)) yielding.delete(c);
}
function release(c) {
    yielding.delete(c);
    if (c.hit || c.ai) return;
    c.dTarget = c.dir * LANES_OURS[1];
    c.want = c.base;
}
export function releaseAll() { for (const c of yielding) release(c); yielding.clear(); }
export const R_stats = { yielded: 0 };
export function yieldingCount() { let n = 0; for (const c of yielding) if (ctx.traffic.cars.includes(c)) n++; return n; }

/** The air horn / megaphone: the cars just ahead get out of her way NOW (a stronger honk). */
export function nudgeAhead(range = 70) {
    const car = ctx.car, T = ctx.traffic;
    let n = 0;
    for (const c of T.cars) {
        if (c.hit || c.ai || c.dir < 0) continue;
        const gap = c.s - car.s;
        if (gap < 2 || gap > range || Math.abs(c.d - car.d) > 4.2) continue;
        const other = LANES_OURS.find(l => Math.abs(l - c.dTarget) > 1);
        if (Math.abs(c.d - car.d) < 2.2 && other !== undefined && T.laneFree(c.s, other, 1, 12)) { c.dTarget = other; c.laneCooldown = 4; }
        else c.want = Math.min(Math.max(c.want, c.speed) + 7, 32);
        n++;
    }
    return n;
}
