// features/hustle — small shared helpers: road placement, dice, particles,
// speech bubbles (banter's pooled bubbles when it's there), models.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { facingRoad, CHUNK } from "../../world.js";
import { registerModels, ensureModels, models, cloneWithColors, findNodes } from "../../models.js";
import * as H from "../../hud.js";

// Every hustle model is lazy: loaded when a job (or a marker) first needs it.
registerModels({
    hustle_payphone: "hustle_payphone", hustle_jobboard: "hustle_jobboard", hustle_bingo: "hustle_bingo",
    hustle_safehouse: "hustle_safehouse", hustle_moneybag: "hustle_moneybag", hustle_chicken: "hustle_chicken",
    hustle_selfie: "hustle_selfie", hustle_food: "hustle_food",
    hustle_groom: "hustle_groom", hustle_chickenguy: "hustle_chickenguy", hustle_influencer: "hustle_influencer",
    hustle_instructor: "hustle_instructor", hustle_detective: "hustle_detective", hustle_crew: "hustle_crew",
});
export { models, cloneWithColors, findNodes };
/** Load models; resolves false (never throws) when one can't load. */
export async function need(keys) {
    try { await ensureModels(keys); return true; } catch (e) { console.warn("[hustle] models", e); return false; }
}

export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = list => list[Math.floor(Math.random() * list.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const fmt = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const _p = {};
/** World point at road (s, d) → {x, z, h}. (Reuses one object: copy what you need.) */
export function pt(s, d) { return ctx.world.road.point(s, d, _p); }
/** Put an Object3D at road (s, d), its FRONT facing the road from `side` (±1). */
export function placeFacing(obj, s, d, side = 1) {
    const p = pt(s, d);
    obj.position.set(p.x, 0, p.z);
    obj.rotation.set(0, facingRoad(p.h, side), 0);
    return obj;
}
/** Distance (m, ground plane) from Lulu's car to (x, z). */
export function carDist(x, z) { const c = ctx.car.pos; return Math.hypot(x - c.x, z - c.z); }

export function burst(x, y, z, n, spd, rgb, size, life) {
    if (ctx.car && ctx.car.fx && !ctx.skipping) ctx.car.fx.burst(x, y, z, n, spd, rgb, size, life);
}

/**
 * A banter-style speech bubble over someone (a fare in the seat, the crew…).
 * Uses banter's pooled bubbles (they only show in free driving); a toast otherwise.
 */
export function bubble(text, target, { dur = 2.6, y = 1.55, cls = "nice" } = {}) {
    if (!text || !target) return;
    if (ctx.banter && ctx.banter.bubble) { if (ctx.banter.bubble(text, target, { dur, y, cls })) return; }
    H.toast(`💬 ${text}`, "");
}

/**
 * The first spot >= `min` metres ahead whose road chunks (+-half) aren't built yet, so a
 * reserve() there still keeps the trees and houses out of the way.
 */
export function unbuiltAhead(min, half = 20) {
    const w = ctx.world, C = CHUNK;
    let s = ctx.car.s + min;
    for (let i = 0; i < 12 && w && w.chunks && (w.chunks.has(Math.floor((s - half) / C)) || w.chunks.has(Math.floor((s + half) / C))); i++) s += 40;
    return s;
}
/** Keep a stretch of roadside clear (before its chunk is built). Returns an undo function. */
export function reserve(s0, s1, side, dMin, dMax) {
    const w = ctx.world;
    if (!w || !w.reserve) return () => {};
    w.reserve(s0, s1, side, dMin, dMax);
    const r = w.reserved[w.reserved.length - 1];
    return () => { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); };
}

/** A static round collider as an actor-collision helper: hit → {impact, why}. */
export function solid(points, why) {
    return car => {
        for (const c of points) {
            const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
            if (dx * dx + dz * dz > (c.r + 3) * (c.r + 3)) continue;
            const imp = car.collideStatic(c.x, c.z, c.r);
            if (imp) return { impact: imp, why, source: "hustle" };
        }
        return null;
    };
}

/** Dispose an Object3D we own (cloned geometry/material are shared with the template: just detach). */
export function drop(obj) { if (obj && obj.parent) obj.parent.remove(obj); }

export const V3 = () => new THREE.Vector3();
