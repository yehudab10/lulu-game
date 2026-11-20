// features/community — THE VOLUNTEER ORGS IN A 🎉 PARTY (🌍 Free Roam, in a town).
//
// Solo, Chaverim / Shomrim / Hatzalah cars cruise the town on its own lane AI and roadside
// scenes start on dice — every friend would see a different town. In a party town:
//   · the org CRUISERS ride openworld's seeded right-turn block loops (ctx.openworld.townLoops),
//     at the vans' speed, on a phase gap the vans leave free: a car's pose is a pure function of
//     (party seed, loop, party clock), the same on every screen, like the minivans. They never
//     leave their loop (no pursuit, no pulling over: those would happen on ONE screen only).
//   · the ROADSIDE SCENES (a flat, a lockout, a dead battery, a bochur off his e-bike) run on the
//     party clock: window w (every 50 s) picks the kind, a landmark to be near and a kerb (seeded
//     dice, parked cars only), and when somebody calls it in — so friends see the same minivan
//     with its hazards on at the same kerb, and the volunteers show up at the same time.
//   · the Bais Yaakov line walks on the party clock (by.js).
// Personal: calling it in first (the mitzvah, the coins), the 📞 Call app and every help visit
// (the responder that comes for ME is a local car, data.partyLocal), and Shomrim chases — only
// when the party has the law on (ctx.enabled("law"), the law side's call), with local cars.
import { ctx, on } from "../../core/ctx.js";
import { CM, townCfg, onFoot, luluPos } from "./common.js";
import { KIND, track, removeVehicle } from "./fleet.js";
import { startScene, endScene } from "./scenes.js";
import { SCENES } from "./lines.js";
import { models } from "../../models.js";

const V_LOOP = 7, FAR = 140, WIN = 50000;
const PC = { cars: new Map(), plan: null, key: "", sceneW: -1, log: [] };

/** In a 🎉 party town right now (🌍 Free Roam), community on? */
export function partyTown() {
    return !!(ctx.enabled("community") && ctx.party && ctx.party.active && ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns()
        && ctx.town && ctx.town.active && townCfg());
}
/** Shomrim pursuits: solo random content, or a party that has the law on. */
export function shomrimParty() { return partyTown() && ctx.enabled("law"); }

function h01(a, b) { let h = Math.imul(a ^ 0x2545F491, 0x9E3779B1) ^ Math.imul(b + 0x6C8E9CF5, 0x85EBCA77); h ^= h >>> 15; h = Math.imul(h, 0xC2B2AE3D); h ^= h >>> 13; return (h >>> 0) / 4294967296; }
const seed = () => (ctx.party.seed >>> 0);

/** The org cars for this town: [{key, org, loop, phase, v}] — pure (seed + the loops). */
export function planCruisers(TL, cfg) {
    const out = [], s = seed();
    // loops without the (slower) school bus; every phase already taken (a van's) per loop
    const free = TL.loops.filter(L => !L.cars.some(c => c.kind === "town_bus"));
    if (!free.length) return out;
    const taken = new Map(free.map(L => [L, L.cars.map(c => ((c.phase % L.len) + L.len) % L.len)]));
    let n = 0;
    for (const org of ["chaverim", "shomrim", "hatzalah"]) {
        if (!cfg.orgs[org]) continue;
        const want = (cfg.cruisers || {})[org] || 0;
        for (let i = 0; i < want; i++, n++) {
            const L = free[Math.floor(h01(s, 7001 + n * 13) * free.length)];
            const ph = taken.get(L);
            // the middle of the biggest gap on that loop (a van, or another org car, never closer than a quarter loop)
            let phase;
            if (!ph.length) phase = h01(s, 7002 + n * 13) * L.len;
            else {
                const sorted = ph.slice().sort((a, b) => a - b);
                let best = 0, at = 0;
                for (let j = 0; j < sorted.length; j++) {
                    const a = sorted[j], b = j + 1 < sorted.length ? sorted[j + 1] : sorted[0] + L.len, gap = b - a;
                    if (gap > best) { best = gap; at = a + gap / 2; }
                }
                if (best < L.len * 0.4) continue;              // (that loop's full: skip this one)
                phase = at % L.len;
            }
            ph.push(phase);
            out.push({ key: `cm:${org}:${i}`, org, loop: L, phase, v: V_LOOP });
        }
    }
    return out;
}

/** Every party org car's world pose at party time T (ms). Pure — the test compares screens with it. */
export function cruisersAt(Tms) {
    const TL = ctx.openworld && ctx.openworld.townLoops && ctx.openworld.townLoops(), cfg = townCfg();
    if (!TL || !cfg) return [];
    const p = {}, out = [];
    for (const c of planCruisers(TL, cfg)) {
        TL.point(c.loop, c.phase + c.v * Tms / 1000, p);
        TL.world(p);
        out.push({ key: c.key, org: c.org, x: p.x, z: p.z, h: p.h });
    }
    return out;
}

const _p = {};
function loopAi(dt, c) {
    const D = c.data, TL = PC.TL;
    if (!TL) return;
    const T = ctx.party.clock();
    TL.point(D.loop, D.phase + D.v * T / 1000, _p);
    TL.world(_p);
    c.x = _p.x; c.z = _p.z; c.h = _p.h; c.speed = D.v;
    D.at = T;
}
function clearCruisers() {
    for (const V of [...PC.cars.values()]) { V.loop = false; removeVehicle(V); }
    PC.cars.clear();
    PC.key = "";
}

function syncCruisers() {
    const TL = ctx.openworld.townLoops(), cfg = townCfg();
    if (!TL || !CM.loaded) return;
    const key = `${TL.town}:${seed()}:${TL.loops.length}`;
    if (key !== PC.key) { clearCruisers(); PC.key = key; PC.TL = TL; PC.plan = planCruisers(TL, cfg); }
    PC.TL = TL;
    const tr = ctx.traffic;
    for (const k of PC.plan) {
        const have = PC.cars.get(k.key);
        if (have && !have.dead && tr.cars.includes(have.car)) continue;
        if (!models[KIND[k.org]]) continue;
        const c = tr.add(KIND[k.org], ctx.car.s, 1.75, 1, k.v, { ai: loopAi, keep: true, immune: true, noNearMiss: true,
            data: { party: k.key, loop: k.loop, phase: k.phase, v: k.v, at: 0 } });
        c.free = true;
        const V = track(c, k.org, "loop");
        V.loop = true;
        V.phase = h01(seed(), 9100 + PC.cars.size);
        c.onCrash = () => false;                       // one screen must never knock a cruiser off its loop
        loopAi(0, c); tr.place(c, 0);
        PC.cars.set(k.key, V);
    }
    // lights by the party clock (a Hatzalah cruiser is ALWAYS responding to something), far ones hidden
    const T = ctx.party.clock() / 1000, cam = ctx.camera.position;
    for (const V of PC.cars.values()) {
        if (V.org === "hatzalah") V.lights = Math.sin(T * 0.11 + V.phase * 6) > 0.35;
        const c = V.car;
        c.obj.visible = Math.abs(c.x - cam.x) < FAR && Math.abs(c.z - cam.z) < FAR;
    }
}

// ── seeded roadside scenes (window w of the party clock) ─────────────────
/** Window w's scene: { w, kind, callT (s after the window opens), anchor } | null — pure. */
export function sceneFor(w) {
    const cfg = townCfg(), sp = ctx.town && ctx.town.spots;
    if (!cfg || !sp || w < 1) return null;
    const s = seed();
    if (h01(s, 8000 + w * 5) > 0.8) return null;
    const kinds = cfg.scenes.kinds.filter(k => SCENES[k] && cfg.orgs[SCENES[k].org] !== false);
    if (!kinds.length) return null;
    const names = Object.keys(sp).filter(n => sp[n] && typeof sp[n].x === "number").sort();
    if (!names.length) return null;
    return { w, kind: kinds[Math.floor(h01(s, 8001 + w * 5) * kinds.length)], callT: 22 + h01(s, 8002 + w * 5) * 12, anchor: names[Math.floor(h01(s, 8003 + w * 5) * names.length)] };
}
const atCache = new Map();
/** Window w's kerb (seeded dice over the town's parking lanes; parked cars only): world {x, z, s, d, h, side, street} | null. */
export function sceneAt(w) {
    const sc = sceneFor(w);
    if (!sc) return null;
    const k = `${ctx.town.id}:${seed()}:${w}`;
    if (atCache.has(k)) return atCache.get(k);
    const a = ctx.town.spot(sc.anchor);
    let at = null;
    if (a) {
        const sp = ctx.party.seeded("cmScene:" + k, () => ctx.town.curbSpot({ len: sc.kind === "hurt" ? 9 : 14, near: { x: a.x, z: a.z }, minD: 8, maxD: 90, still: true }));
        if (sp) at = { x: sp.x, z: sp.z, s: sp.s, d: sp.d, h: sp.h, side: sp.side, street: sp.street };
    }
    if (atCache.size > 40) atCache.clear();
    atCache.set(k, at);
    return at;
}
function tickScenes() {
    const T = ctx.party.clock(), w = Math.floor(T / WIN), into = (T - w * WIN) / 1000;
    if (CM.scene || w === PC.sceneW || !CM.loaded) return;
    const sc = sceneFor(w);
    if (!sc) { PC.sceneW = w; return; }
    if (into > sc.callT - 4) { PC.sceneW = w; return; }      // too late to catch the start: next one
    const at = sceneAt(w);
    if (!at) { PC.sceneW = w; return; }
    const lp = luluPos();
    if (Math.hypot(at.x - lp.x, at.z - lp.z) > 170) return;  // not near it (yet): it's going on without me
    PC.sceneW = w;
    const s = startScene(sc.kind, { at, callT: sc.callT, t0: into });
    PC.log.push({ w, kind: sc.kind, at: at ? [Math.round(at.x * 10) / 10, Math.round(at.z * 10) / 10] : null, started: !!s });
    if (PC.log.length > 20) PC.log.shift();
}

// ── per frame (community's actor calls this; it runs on foot too) ────────
export function tickParty() {
    if (!partyTown()) { if (PC.cars.size) clearCruisers(); return; }
    syncCruisers();
    tickScenes();
}
on("town:leave", () => { clearCruisers(); PC.sceneW = -1; if (CM.scene && ctx.party && ctx.party.active) endScene(); });
on("run:start", () => { PC.cars.clear(); PC.key = ""; PC.sceneW = -1; });

// friends see what I'm up to in a help scene (the other party work's ctx.party.presence — optional)
on("state", ({ from, to }) => {
    if (!(ctx.party && ctx.party.active) || !ctx.party.presence) return;
    if (to === "communityScene") ctx.party.presence({ mode: "scene", label: "getting help from the volunteers", icon: "🚨" });
});

export const partyDebug = {
    PC, cruisersAt, sceneFor, sceneAt, planCruisers,
    /** Live org cruisers: [{key, x, z, at}] (tests compare them with cruisersAt(at)). */
    live: () => [...PC.cars.values()].filter(V => !V.dead).map(V => ({ key: V.car.data.party, org: V.org, x: V.car.x, z: V.car.z, at: V.car.data.at })),
};
export { onFoot };
