// features/life — 🌬️ COLD AIR (round 3): what a cold evening looks like.
//   😮‍💨 breath: on a cold night / a cold dawn (`breathNow()`: a cold day by the device's date — Nov–Mar, winter, snow,
//      `?lifeCold=1|0` — and dark or snowing) Lulu's breath clouds in front of her face, quicker + bigger when she's been
//      running; the townsfolk near her (ctx.town.people()) and friends walking near her in a 🎉 party breathe too
//   🚗 the tailpipe: on any cold day in town her car huffs a little white cloud out of the back while it idles or
//      crawls — it thins out as she speeds up
//   🌫️ dawn mist: in town at dawn (atmos' clock 0.86 → 0.06), more after rain, low banks of mist lie over the lawns and
//      the streets around her, drift with the wind and burn off as the sun comes up; her car stirs them (puffs.js)
// All of it is puffs.js' mesh (no extra draw call; typed arrays, nothing allocated per frame). Local + cosmetic.
// Lulu says something about the cold now and then (one line a visit, the shared line budget, never a toast).
import { ctx } from "../../core/ctx.js";
import { L, rand, clamp, coldNow, luluLine } from "./common.js";
import { addPuff, K, PF } from "./puffs.js";
import { WS } from "./wind.js";
import { FR } from "./friends.js";

export const BREATH = {
    nightFrom: 0.35,            // dark enough to see it (L.night) — or snowing, or a winter's day
    gap: [2.5, 3.4], gapRun: [1.1, 1.5], huff: 6,       // seconds between breaths (walking / running); s of huffing after a run
    mouthY: 1.42, ahead: 0.42,  // her mouth (m), in front of her face (m)
    peopleR: 22, peopleN: 6,    // townsfolk breathing within (m), at most
    friendsR: 26,
    exhaustMax: 9,              // the tailpipe steams below this speed (m/s)
    mistR: 34, mistN: 26,       // dawn mist: banks around her within (m), at most
};
const LINES = ["Brrr! I can see my BREATH. 🥶", "Should've listened to Ima about the coat.", "It's freezing! Where's my hat?!", "I'm a dragon. Rawr. 🐉 …a COLD dragon."];
export const BR = { t: 0.6, run: 0, huffT: 0, n: 0, people: 0, peopleT: 0, ph: new Float32Array(16), carT: 0, exhaust: 0, mist: 0, mistOn: false, mistT: 0, mistLive: 0, said: false, on: false };

/** Cold enough + dark enough to see breath. */
export function breathNow() { return coldNow() && (L.night > BREATH.nightFrom || L.snow || L.season === "winter"); }
/** Dawn on atmos' clock (morning = 0.03, dawn = 0.9). */
function dawn() { const c = ctx.atmos && typeof ctx.atmos.clock === "number" ? ctx.atmos.clock : 0.3; return c > 0.86 || c < 0.06; }
function mistPin() { try { const q = new URLSearchParams(location.search).get("lifeMist"); return q === "1" ? true : q === "0" ? false : null; } catch (e) { return null; } }
let pinMist = null;
export function setMistPin(v) { pinMist = v == null ? null : !!v; }

const WHITE = 0.93;
/** One breath: two or three small puffs out of a mouth at (x, y, z), heading (fx, fz), carried by (vx, vz). */
function breathe(x, y, z, fx, fz, vx, vz, big) {
    const n = big ? 3 : 2, s = big ? 1.25 : 1;
    for (let i = 0; i < n; i++) {
        const f = 0.55 + i * 0.25;
        addPuff(K.BREATH, x + fx * (0.02 + i * 0.05), y - i * 0.015, z + fz * (0.02 + i * 0.05),
            fx * f + vx * 0.85 + WS.wx * 0.05, rand(0.05, 0.16), fz * f + vz * 0.85 + WS.wz * 0.05,
            rand(0.9, 1.25) * s, 0.1, rand(0.42, 0.55) * s, big ? 0.5 : 0.42, WHITE, WHITE, WHITE + 0.03);
    }
    BR.n++;
}

function lulu(dt) {
    const F = ctx.foot;
    if (!L.foot || !F.pos) return;
    const v = L.speed;
    BR.run = v > 4.2 ? BR.run + dt : Math.max(0, BR.run - dt * 2);
    if (BR.run > 2.5) BR.huffT = BREATH.huff;
    if (BR.huffT > 0) BR.huffT -= dt;
    BR.t -= dt;
    if (BR.t > 0) return;
    const huff = BR.huffT > 0 || v > 4.2;
    BR.t = rand(...(huff ? BREATH.gapRun : BREATH.gap));
    const yaw = typeof F.facing === "number" ? F.facing : Math.atan2(F.vel ? F.vel.x : 0, F.vel ? F.vel.z : 1);
    const fx = Math.sin(yaw), fz = Math.cos(yaw), vel = F.vel || { x: 0, z: 0 };
    breathe(F.pos.x + fx * BREATH.ahead, BREATH.mouthY + (F.height || 0), F.pos.z + fz * BREATH.ahead, fx, fz, vel.x, vel.z, huff);
    if (!BR.said && BR.n > 4 && !L.quiet && luluLine(LINES[Math.floor(Math.random() * LINES.length)])) BR.said = true;
}

function townsfolk(dt) {
    BR.people = 0;
    if (!L.town || !ctx.town.people) return;
    BR.peopleT -= dt;
    let list;
    try { list = ctx.town.people(); } catch (e) { return; }
    let k = 0;
    const R2 = BREATH.peopleR * BREATH.peopleR;
    for (let i = 0; i < list.length && k < BREATH.peopleN; i++) {
        const p = list[i], dx = p.x - L.x, dz = p.z - L.z;
        if (dx * dx + dz * dz > R2) continue;
        const before = BR.ph[k], ph = before + dt / 3.1;
        BR.ph[k] = ph;
        k++;
        if (Math.floor(before + i * 0.37) === Math.floor(ph + i * 0.37)) continue;
        const a = (i * 2.399) % 6.283;          // (people() has no facing: any way is fine for a soft cloud)
        breathe(p.x + Math.sin(a) * 0.2, 1.55, p.z + Math.cos(a) * 0.2, Math.sin(a) * 0.6, Math.cos(a) * 0.6, 0, 0, false);
    }
    BR.people = k;
}

function friends(dt) {
    const P = FR.fake || ctx.party;
    if (!P || !P.active || !P.remoteCar || !FR.uids.length) return;
    const R2 = BREATH.friendsR * BREATH.friendsR;
    let k = 8;                                   // (phases 8..15: the townsfolk use 0..7)
    for (const uid of FR.uids) {
        if (k >= 16) break;
        const rc = P.remoteCar(uid);
        if (!rc || !rc.shown || !rc.foot) continue;
        const dx = rc.x - L.x, dz = rc.z - L.z;
        if (dx * dx + dz * dz > R2) continue;
        const v = Math.hypot(rc.vx || 0, rc.vz || 0), before = BR.ph[k], ph = before + dt / (v > 4.2 ? 1.3 : 2.9);
        BR.ph[k] = ph;
        if (Math.floor(before + k * 0.29) !== Math.floor(ph + k * 0.29)) {
            const yaw = v > 0.3 ? Math.atan2(rc.vx, rc.vz) : (rc.h || 0), fx = Math.sin(yaw), fz = Math.cos(yaw);
            breathe(rc.x + fx * BREATH.ahead, BREATH.mouthY + (rc.footY || 0), rc.z + fz * BREATH.ahead, fx, fz, rc.vx || 0, rc.vz || 0, v > 4.2);
        }
        k++;
    }
}

/** Her car's tailpipe on a cold day: a little white huff while it idles / crawls. */
function exhaust(dt) {
    const car = ctx.car;
    if (L.foot || !L.town || !car || !car.pos || ctx.state !== "playing") return;      // (in town: waiting at a corner, pulling out)
    const v = Math.abs(car.speed || 0);
    if (v > BREATH.exhaustMax) return;
    BR.carT -= dt;
    if (BR.carT > 0) return;
    BR.carT = v < 1 ? rand(0.18, 0.26) : rand(0.1, 0.16);
    const h = car.h || 0, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
    const back = 2.25, side = 0.55;
    const k = 1 - v / BREATH.exhaustMax;
    addPuff(K.EXHAUST, car.pos.x - fx * back + rx * side, 0.32, car.pos.z - fz * back + rz * side,
        -fx * rand(0.6, 1.0) + (car.vx || 0) * 0.7 + rand(-0.1, 0.1), rand(0.25, 0.45), -fz * rand(0.6, 1.0) + (car.vz || 0) * 0.7 + rand(-0.1, 0.1),
        rand(1.2, 1.7), 0.12, rand(0.7, 1.0), 0.3 * k + 0.08, 0.9, 0.9, 0.92);
    BR.exhaust++;
}

/** 🌫️ dawn mist in town: low banks that drift with the wind and burn off with the sun. */
function mist(dt) {
    const pin = pinMist != null ? pinMist : mistPin();
    const want = pin != null ? pin : (L.town && dawn() && !L.snow && L.rain < 0.3);
    BR.mistOn = !!want && L.town;
    if (!BR.mistOn) return;
    BR.mistT -= dt;
    if (BR.mistT > 0) return;
    BR.mistT = 0.35;
    const thick = clamp(0.55 + L.wet * 0.6, 0, 1);
    let live = 0;
    for (let i = 0; i < PF.n; i++) if (PF.kind[i] === K.MIST) live++;
    BR.mistLive = live;
    if (live > BREATH.mistN) return;
    const a = Math.random() * 6.283, r = rand(5, BREATH.mistR);
    const x = L.x + Math.sin(a) * r + (ctx.car && !L.foot ? (ctx.car.vx || 0) * 1.5 : 0), z = L.z + Math.cos(a) * r + (ctx.car && !L.foot ? (ctx.car.vz || 0) * 1.5 : 0);
    const s = rand(5, 9);
    addPuff(K.MIST, x, rand(0.5, 1.1), z, WS.wx * 0.12 + rand(-0.25, 0.25), 0, WS.wz * 0.12 + rand(-0.25, 0.25),
        rand(9, 14), s * 0.7, s, 0.5 * thick, 0.86, 0.88, 0.92);
    BR.mist++;
}

export function tickBreath(dt) {
    BR.on = false;
    if (!L.on) return;
    if (breathNow()) {
        BR.on = true;
        lulu(dt);
        townsfolk(dt);
        friends(dt);
    }
    if (coldNow()) exhaust(dt);
    mist(dt);
}
export function breathClear() { BR.said = false; BR.run = 0; BR.huffT = 0; }
export function breathInfo() { return { on: BR.on, breaths: BR.n, people: BR.people, exhaust: BR.exhaust, mist: BR.mist, mistOn: BR.mistOn, said: BR.said, huff: BR.huffT > 0 }; }
