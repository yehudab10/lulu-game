// features/feel — the game you can FEEL: sound you can locate + damage you can see.
//
//  1. Positional audio (core js/spatial.js, exposed as A.spatial): this module
//     defines the sound kinds (kinds.js), whooshes the traffic that passes her
//     (trucks louder and longer), muffles the music while she's on foot (the radio
//     is back in the car), and sets the voice budget. Law (sirens, the chopper),
//     banter (honk-backs), roadevents (train horn + crossing bell, ambulances, the
//     ice-cream truck) and atmos (rain on the car vs. open air) call the API.
//  2. Damage on Lulu's own car (damage.js): dents, scratches, a cracked windshield,
//     a smoking hood, a hubcap that rolls away and a sparking bumper — repaired by
//     a new run, Paint & Pray, the ER; a heart pickup undoes a stage.
//
// No new HUD, no settings: it rides on Sound / Music, and everything random is
// either cosmetic or follows the hits the player already took.
//
// Service: ctx.feel = { damage: { k, stage, info(), repair(why), hit(side) }, debug }
import { ctx, on, hook } from "../../core/ctx.js";
import { kindSpec } from "../../traffic.js";
import * as A from "../../audio.js";
import "./kinds.js";
import { tickDamage, addHit, undo, repair, wear, info, D, sideOf } from "./damage.js";

const MUFFLE_ON_FOOT = 0.72;          // lowpass ≈ 1.4 kHz: the radio is in the car, she's out here
const PASS = { n: 0, trucks: 0, last: null };

function coarse() { try { return matchMedia("(pointer: coarse)").matches; } catch (e) { return false; } }
on("boot", () => {
    const p = ctx.platform || {};
    A.spatial.setMaxVoices(p.console || p.tv || coarse() ? 6 : 8);
});

// ── traffic passing her: a whoosh timed so its peak lands as the car goes by ──
function passing(dt) {
    const car = ctx.car, tr = ctx.traffic;
    if (!tr || !car || dt <= 0) return;
    const fx = Math.sin(car.h), fz = Math.cos(car.h);
    const ready = A.spatial.ready;
    for (const c of tr.cars) {
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
        const along = dx * fx + dz * fz, side = dx * fz - dz * fx;
        const prev = c.feelAlong;
        c.feelAlong = along;
        if (prev == null) continue;
        if (Math.abs(along) > 40) { c.feelPassed = false; continue; }
        if (c.feelPassed || Math.abs(side) > 10 || !c.obj) continue;
        const v = (along - prev) / dt;                    // − = it's coming back toward her (she's overtaking), + = it's overtaking her
        if (Math.abs(v) < 5 || Math.abs(v) > 120) continue;
        const truck = c.kind === "truck" || ((kindSpec(c.kind) || {}).len || 0) > 6.2;
        const lead = truck ? 0.85 : 0.6;                  // ≈ the buffer's peak
        const tPass = -along / v;
        if (tPass < 0 || tPass > lead) continue;
        c.feelPassed = true;
        PASS.n++; if (truck) PASS.trucks++;
        if (!ready) continue;
        const g = Math.max(0.2, Math.min(1, (Math.abs(v) - 4) / 28)) * (Math.abs(side) < 4 ? 1 : 0.7);
        A.spatial.play(truck ? "whooshTruck" : "whoosh", c.obj, { gain: g, rate: 0.9 + Math.min(0.25, Math.abs(v) / 160) });
        PASS.last = { kind: c.kind, truck, v: +v.toFixed(1), side: +side.toFixed(1) };
    }
}

// ── the music, muffled on foot ──
function muffleTarget() { return ctx.state === "footRun" && !ctx.view ? MUFFLE_ON_FOOT : 0; }
on("state", e => {
    A.setMusicMuffle(muffleTarget());
    if (e && e.to === "title") A.spatial.stopAll();
});

function tick(dt) {
    if (ctx.paused) return;
    try { passing(dt); } catch (e) { console.error("[feel] passing", e); }
    try { tickDamage(dt); } catch (e) { console.error("[feel] damage", e); }
    A.setMusicMuffle(muffleTarget());
}
hook("hud", dt => tick(dt));
hook("update", dt => { const def = ctx.states[ctx.state]; if (!def || !def.hud) tick(dt); }, -60);
// a new run starts quiet: every emitter from the last one (sirens, the scrape…) is gone
hook("runStart", () => { A.spatial.stopAll(); }, 100);

ctx.feel = {
    damage: {
        get k() { return D.k; },
        get stage() { return D.stage; },
        info,
        /** Fix the car (a garage, a mechanic…). Returns true if there was anything to fix. */
        repair(why = "service") { return repair(why); },
        /** Add a hit on "front" | "rear" | "left" | "right" (cosmetic only — hearts are core's). */
        hit(side = "front") { const car = ctx.car, s = { front: [0, 2], rear: [0, -2], left: [1, 0], right: [-1, 0] }[side] || [0, 2];
            addHit(sideOf(car.pos.x + Math.cos(car.h) * s[0] + Math.sin(car.h) * s[1], car.pos.z - Math.sin(car.h) * s[0] + Math.cos(car.h) * s[1])); return info(); },
        undo,
    },
    debug: {
        wear, info,
        audio: () => A.spatial.stats(),
        emitters: () => A.spatial.list(),
        passes: () => Object.assign({}, PASS),
        muffle: () => A.musicMuffleInfo(),
    },
};
