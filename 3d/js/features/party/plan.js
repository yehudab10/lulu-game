// features/party — the seeded ROAD PLAN: what happens WHERE on a party's highway.
//
// Roadside content in a party (roadevents' ice-cream stands, cameos' Avigail / Heshy /
// the salon, hustle's ringing payphones…) can't come from each screen's own dice and
// timers — two friends would drive past different worlds. Instead every 200 m chunk k
// of the highway gets at most ONE "big" thing, picked from the features that registered
// a weight here, by a pure hash of (the activity's seed, k). Every friend's screen asks
// the same question and gets the same answer, so the same event shows up at the same s
// for everyone (each screen builds its own copy as it gets near; what happens INSIDE it
// — a porch visit, a ride, a reward — is personal to whoever pulls in).
//
//   ctx.party.rng(key)           → () => 0..1  (mulberry32 from the activity seed + key)
//   ctx.party.seeded(key, fn)    → fn() with Math.random seeded the same way (sync code only)
//   ctx.party.h01(key, k)        → one stable float for (seed, key, k)
//   ctx.party.road.claim(id, kinds)   kinds: { kindName: weight | (A) => weight }   (call at import)
//   ctx.party.road.slot(k)       → { id, kind, k, s, side, key } | null — chunk k's big thing (cached)
//   ctx.party.road.span          → { s0, s1 }: where the plan may put things this activity
//
// Small stuff (roadevents' cones / puddles / animals…) hashes its own sub-slots with h01.
import { ctx, on } from "../../core/ctx.js";
import { N, worldSeed } from "./net.js";

const CHUNK = 200;
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** The seed every friend agrees on: the activity's (a new one each game), else the party's. */
export function planSeed() { const A = N.A; return ((A && A.seed) || worldSeed()) >>> 0; }
export function rng(key) { return mulberry(hashStr(String(key)) ^ planSeed()); }
export function h01(key, k = 0) { return rng(key + "#" + k)(); }
/** Run fn with Math.random seeded from the party (only for SYNCHRONOUS code — an await escapes it). */
export function seeded(key, fn) {
    const orig = Math.random;
    Math.random = rng(key);
    try { return fn(); } finally { Math.random = orig; }
}

// ── the big-slot allocator ───────────────────────────────────────────────
const REG = [];                       // [{ id, kind, w: number | (A) => number }]
const cache = new Map();              // "seed:k" → slot | null
let cacheSeed = -1, cacheAct = -1;

function claim(id, kinds) {
    for (const [kind, w] of Object.entries(kinds || {})) REG.push({ id, kind, w });
    cache.clear();
}
const tripEnd = () => { try { if (ctx.journey && ctx.journey.stopS) return ctx.journey.stopS(0); } catch (e) { /* fall back */ } return 4800; };
/** Where the plan may put things: past the grid's first stretch, short of Bubbe's on a road trip. */
function span() {
    const A = N.A || {};
    return { s0: 560, s1: A.k === "trip" ? tripEnd() - 650 : 1e9 };
}
/** Something fixed is already there (a pull-in place, a town exit's ramp)? */
function busyAt(s0, s1) {
    if (ctx.town && ctx.town.exits) for (const e of ctx.town.exits) if (e.s > s0 - 520 && e.s < s1 + 260) return true;
    if (ctx.places && ctx.places.list) {
        for (const p of ctx.places.list()) for (const s of ctx.places.at(p.id)) if (s > s0 - 160 && s < s1 + 160) return true;
    }
    return false;
}
const DENSITY = 0.42;                 // share of chunks with something big in them
function slot(k) {
    const A = N.A || {};
    const seed = planSeed();
    if (seed !== cacheSeed || A.id !== cacheAct) { cache.clear(); cacheSeed = seed; cacheAct = A.id; }
    const key = k | 0;
    if (cache.has(key)) return cache.get(key);
    let out = null;
    const r = rng("slot:" + key);
    const s = key * CHUNK + 55 + r() * 90, sp = span();
    if (r() < DENSITY && s > sp.s0 && s < sp.s1 && !busyAt(key * CHUNK, key * CHUNK + CHUNK)) {
        const ws = REG.map(e => { let w = 0; try { w = typeof e.w === "function" ? +e.w(A) || 0 : +e.w || 0; } catch (err) { w = 0; } return Math.max(0, w); });
        const tot = ws.reduce((a, b) => a + b, 0);
        if (tot > 0) {
            let x = r() * tot;
            for (let i = 0; i < REG.length; i++) {
                x -= ws[i];
                if (x < 0 || i === REG.length - 1) { out = { id: REG[i].id, kind: REG[i].kind, k: key, s, side: r() < 0.5 ? -1 : 1, key: `${REG[i].id}:${REG[i].kind}:${key}` }; break; }
            }
        }
    }
    cache.set(key, out);
    return out;
}

// a new run re-plans the exits (town) the slots steer clear of: ask again
on("run:start", () => cache.clear());

/** Install on the party service (index.js calls this once). */
export function install(svc) {
    svc.rng = rng;
    svc.seeded = seeded;
    svc.h01 = h01;
    svc.road = {
        claim, slot,
        get span() { return span(); },
        /** Who registered what ("id:kind" in registration order — the same on every screen). */
        get kinds() { return REG.map(e => e.id + ":" + e.kind); },
        /** Every planned slot whose s is in [s0, s1] (tests compare screens with it). */
        list(s0, s1) { const out = []; for (let k = Math.floor(s0 / CHUNK); k <= Math.floor(s1 / CHUNK); k++) { const sl = slot(k); if (sl && sl.s >= s0 && sl.s <= s1) out.push(sl); } return out; },
        CHUNK,
    };
}
