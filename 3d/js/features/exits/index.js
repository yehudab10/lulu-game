// ─────────────────────────────────────────────────────────────────────────
//  features/exits — 🛣️ HIGHWAY EXITS & 🅿️ REST AREAS.
//
//  The towns' interchanges are features/town's (exit.js: both towns at every exit, one ramp
//  that splits per town). This feature adds what's around them:
//
//   • REST AREAS: a service plaza right off the highway every ~7 km (Cruise and Story), signed
//     ahead (REST AREA 1 MI · FOOD · GAS · RESTROOMS · REGRET), with its own decel lane +
//     off-ramp and on-ramp + accel lane. Seamless (no fade, no district): the lot is drawn
//     into the highway's own chunks, its asphalt is paved for the car (core's `paved`
//     registry) and "grounds" for foot (no tall grass / mud / fence there), so stopping,
//     climbing out and walking round works like anywhere on the road. Entirely optional:
//     staying in lane passes it.
//     In the lot: ⛽ the pumps + 🔧 Mendel's garage are drive-up bays (ctx.places: stop in the
//     bay), and on foot (✋, foot's spot system) the food court (hearts for coins), the
//     restrooms (a gag), the vending machines (a snack = nitro, and sometimes it sticks:
//     KICK IT), the souvenir stand (a deal of the day: a missile / shield / pepper spray),
//     the picnic tables (sit: a heart once a visit), Kugel the dog, and travellers to talk to.
//   • A subtle "next exit" chip under the trip bar (.hud-secondary → hidden in HUD Clean),
//     only while an interchange / rest area is ≤ 1 mi ahead.
//
//    layout.js  the rest area as DATA in road coords (u along, d across): ramps, lot, props, people, spots
//    build.js   chunk:build → asphalt, stall lines, gores, the merged props (town's kit), the sign atlas
//    life.js    the cast, the dog, the ✋ spots + what they do, the two drive-up bays
//    lines.js   every line of text
//
//  ctx.exits { rests, spans(), inside, next, restAhead(), debug }
//  Events: exits:rest {phase: "enter" | "leave", s, name} · exits:talk {id} · exits:food {id, cost} ·
//          exits:restroom {gag} · exits:vending {result} · exits:souvenir {id} · exits:picnic · exits:dog ·
//          exits:pump {result} · exits:mechanic {result}
//  Stats: restStops, restMeals, restRestrooms, restSnacks, restKicks, restSouvenirs, restPicnics,
//         restDogPets, restTalks, restFills, restRepairs
//  Random content is gated by ctx.enabled("exits") (off in ?test unless enabled, OFF in a 🎉 party,
//  where the party feature lists it).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, emit, css, addActor, pick } from "../../core/ctx.js";
import { paved } from "../../core/driving.js";
import { models, ensureModels } from "../../models.js";
import * as H from "../../hud.js";
import * as LY from "./layout.js";
import * as L from "./lines.js";
import { buildChunk, MODELS, lookMats } from "./build.js";
import { LIFE, PEOPLE_MODELS, saved, spawnCast, despawnCast, tickLife, restSpot, registerBays, luluSays, actAt, dealOfDay } from "./life.js";

/** Where the rest areas go: the first this far into a run, then about every `every` metres. */
export const REST = { first: 3900, every: 7300 };
const RS = { list: [], inside: null, was: null, cue: "", cuePull: undefined, ownPull: false, savedPull: undefined, chipT: 0, k: 0 };

const mode = () => (ctx.G && ctx.G.mode) || "cruise";
function eligible() {
    const G = ctx.G;
    return !!G && (G.mode === "cruise" || G.mode === "story") && ctx.enabled("exits") && !G.tutorial && !(ctx.party && ctx.party.active);
}
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ── planning ─────────────────────────────────────────────────────────────
/** Is a rest area at s clear of the town's interchanges, pull-in places, reserved stretches, the story's stops? */
function clearAt(s) {
    const a = s + LY.SPAN.a, b = s + LY.SPAN.b;
    const T = ctx.town;
    if (T && T.exits) {
        const sp = T.span || { a: -1500, b: 260 };
        for (const e of T.exits) if (e.s + sp.b > a && e.s + sp.a < b) return false;
    }
    const P = ctx.places;
    if (P && P.list && P.at) {
        try { for (const p of P.list()) { if (/^exits_/.test(p.id)) continue; for (const x of P.at(p.id) || []) if (x > s - 320 && x < s + LY.ACC1 + 80) return false; } } catch (e) { /* none */ }
    }
    const w = ctx.world;
    if (w && w.reserved && w.reserved.some(r => r.side !== -1 && r.s1 > s + LY.TAPER0 - 40 && r.s0 < s + LY.ACC1 + 40 && r.dMax > 9 && r.dMin < 72 && r.dMax - r.dMin > 12)) return false;
    if (mode() === "story" && ctx.journey && ctx.journey.stopS) {
        for (let i = 0; i < 5; i++) { let st; try { st = ctx.journey.stopS(i); } catch (e) { st = null; } if (st != null && st > s - 600 && st < s + 1700) return false; }
    }
    return true;
}
const signBusy = s => { const w = ctx.world; return !!w && (w.isReserved(s, 10.6, 6) || w.isReserved(s, 14, 6)); };
/** Plan a rest area at (or slid forward from) s. */
export function planRest(s, force = false) {
    const w = ctx.world;
    if (!w) return null;
    if (!force) { let k = 0; while (k < 80 && !clearAt(s)) { s += 250; k++; } if (k >= 80) return null; }
    if (RS.list.some(R => Math.abs(R.s - s) < 600)) return null;
    const k = RS.k++, rnd = mulberry(Math.round(s) * 31 + 7);
    const R = { s, k, name: L.NAMES[k % L.NAMES.length], res: [], signs: [], alive: true, colliders: LY.colliderList(), cars: [], visited: false };
    const reserve = (a, b, side, d0, d1) => { w.reserve(a, b, side, d0, d1); R.res.push(w.reserved[w.reserved.length - 1]); };
    reserve(s + LY.TAPER0 - 30, s + LY.ACC1 + 30, 1, 7.2, 74);
    const sign = (u, def) => {
        let at = s + u;
        for (let i = 0; i < 4 && signBusy(at); i++) at += 70;
        reserve(at - 20, at + 20, 1, 9, 13);
        const sg = Object.assign({ s: at, d: 10.6, bg: "#1565C0", w: 4.8, h: 2.6, tw: 512, th: 280 }, def);
        w.addSign(sg); R.signs.push(sg);
    };
    sign(LY.SIGN_MILE, { lines: L.SIGNS.mile });
    sign(LY.SIGN_HALF, { lines: L.SIGNS.half });
    sign(LY.SIGN_NEXT, { lines: [L.SIGNS.next[0], L.SIGNS.next[1], R.name.short.toUpperCase()] });
    for (const sg of [{ s: s + LY.RAMP0 + 6, d: 13.0, lines: L.SIGNS.gore, w: 2.6, h: 1.3, tw: 512, th: 256 },
        { s: s + LY.ON0 - 18, d: LY.AISLE + 4.2, lines: L.SIGNS.back, w: 3.0, h: 1.5, tw: 512, th: 256 },
        { s: s + 156, d: 31.5, lines: L.SIGNS.trucks, w: 2.8, h: 1.4, tw: 512, th: 256 }]) {
        const def = Object.assign({ bg: "#1565C0" }, sg);
        w.addSign(def); R.signs.push(def);
    }
    // the parked cars (seeded: the same rest area always has the same cars)
    const PAINTS = ["#E53935", "#42A5F5", "#FFFFFF", "#FFCA28", "#9E9E9E", "#263238", "#8D6E63", "#66BB6A", "#BA68C8", "#B0BEC5"];
    LY.STALLS.forEach((row, ri) => {
        for (let i = 0, u = row.u0 + LY.STALL_W / 2; u < row.u1; i++, u += LY.STALL_W) {
            const fam = ri === LY.FAMILY_STALL.row && i === LY.FAMILY_STALL.i;
            if (!fam && rnd() > 0.42) continue;
            const key = fam ? "van" : rnd() < 0.68 ? "sedan" : "van";
            R.cars.push({ u, d: row.d, key, color: fam ? "#D7CCC8" : PAINTS[Math.floor(rnd() * PAINTS.length)] });
            R.colliders.push([u, row.d - 1.25, 1.2], [u, row.d + 1.25, 1.2]);
        }
    });
    RS.list.push(R);
    RS.list.sort((a, b) => a.s - b.s);
    ensureModels(MODELS).catch(() => {});
    return R;
}
function dropRest(R) {
    const w = ctx.world;
    R.alive = false;
    if (w) {
        for (const r of R.res) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
        for (const sg of R.signs) { const i = w.signs.indexOf(sg); if (i >= 0) w.signs.splice(i, 1); }
    }
    const i = RS.list.indexOf(R);
    if (i >= 0) RS.list.splice(i, 1);
}
function clearRests() {
    for (const R of [...RS.list]) dropRest(R);
    RS.k = 0;
}
const restAt = s => RS.list.find(R => s > R.s + LY.TAPER0 - 20 && s < R.s + LY.ACC1 + 20) || null;

// the lot + ramps are paved for the car; the lot's lawn + verges are "grounds" for foot
paved.push((s, d) => {
    if (d < 6.5 || !RS.list.length) return 0;
    const R = restAt(s);
    return R ? LY.groundAt(s - R.s, d) : 0;
});

on("chunk:build", ({ chunk, world, s0, s1 }) => {
    if (world.district) return;
    for (const R of RS.list) {
        if (R.s + LY.TAPER0 >= s1 || R.s + LY.ACC1 + 5 < s0) continue;
        try { buildChunk(R, chunk, world, s0, s1); } catch (e) { console.error("[exits] build", e); }
    }
});

// ── run lifecycle ────────────────────────────────────────────────────────
function resetState() {
    despawnCast();
    clearRests();
    if (RS.cue) { RS.cue = ""; H.prompt(""); }
    RS.inside = null; RS.was = null; RS.ownPull = false; RS.retryS = 0;
    chip(null);
}
hook("runStart", G => {
    resetState();
    if (!eligible()) return;
    planRest((G.startS || 0) + REST.first);
    addActor({ foot: true, update: dt => { try { tick(dt); } catch (e) { console.error("[exits] tick", e); } return true; } });
}, 10);
on("title", resetState);

hook("update", (dt, P, controlsOn) => {
    if (!RS.list.length || (ctx.town && ctx.town.active)) { if (RS.cue) cue(""); return; }
    const car = ctx.car, last = RS.list[RS.list.length - 1];
    if (eligible() && car.s > last.s - 1200 && car.s > (RS.retryS || 0)) { if (!planRest(Math.max(last.s + REST.every, car.s + 2000))) RS.retryS = car.s + 400; }
    // the decel-lane cue (a prompt, not a popup)
    const R = restAt(car.s);
    let html = "";
    if (R && ctx.state === "playing" && controlsOn && car.speed > 3) {
        const u = car.s - R.s, d = car.d;
        if (u >= LY.TAPER0 && u < LY.RAMP0 + 6 && d > 7.35) html = `🅿️ REST AREA · ${R.name.short} <small>· steer left to stay on the highway</small>`;
        else if (u >= LY.RAMP0 && u < LY.RAMP1 && Math.abs(d - LY.offD(u)) < LY.HALF + 1) html = `🅿️ ${R.name.short} · ⛽ 🍔 🚻 🛍️`;
    }
    cue(html);
}, -5);
function cue(html) {
    if (html === RS.cue) return;
    const G = ctx.G;
    if (html && !RS.cue && G) { RS.cuePull = G.noPullOver; G.noPullOver = true; }
    if (!html && RS.cue && G) G.noPullOver = RS.cuePull;
    RS.cue = html;
    H.prompt(html);
}

// per frame (driving + on foot): the cast near her, inside / leaving, the chip
function tick(dt) {
    const car = ctx.car, G = ctx.G;
    const onFoot = !!(ctx.foot && ctx.foot.active);
    const R = !(ctx.town && ctx.town.active) && RS.list.find(r => car.s > r.s - 260 && car.s < r.s + LY.ON1 + 40) || null;
    if (R) spawnCast(R); else if (LIFE.R) despawnCast();
    tickLife(dt);
    // night: the windows + lamps
    const n = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0, M = lookMats();
    M.glow.emissiveIntensity = n * 1.6;
    M.lit.emissiveIntensity = 0.25 + n * 3.2;
    // in the lot?
    const inside = R && LY.inLot(car.s - R.s, car.d) ? R : null;
    if (inside && inside !== RS.inside) {
        RS.inside = inside; RS.was = inside;
        if (G && !G.noPullOver) { G.noPullOver = true; RS.ownPull = true; }    // (stop = get out & walk; no parking minigame here)
        if (!inside.visited) {
            inside.visited = true;
            saved.visits++;
            H.banner(`<b>🅿️ ${inside.name.name}</b><small>${inside.name.sub} · food · gas · restrooms · regret</small>`, 2600, { key: "exits", prio: 1 });
            luluSays(pick(L.LULU.arrive), 3);
            emit("exits:rest", { phase: "enter", s: inside.s, name: inside.name.short });
            emit("stat", { id: "restStops", n: 1 });
        }
    } else if (!inside && RS.inside) {
        RS.inside = null;
        if (RS.ownPull && G) { G.noPullOver = false; RS.ownPull = false; }
    }
    // back on the highway (driving, past the merge)
    if (RS.was && !onFoot && ctx.state === "playing" && car.s > RS.was.s + LY.ON1 - 10 && car.d < 9) {
        const W = RS.was; RS.was = null;
        H.toast("🛣️ Back on the highway", "gold");
        luluSays(pick(L.LULU.leave), 2.6);
        emit("exits:rest", { phase: "leave", s: W.s, name: W.name.short });
    } else if (RS.was && (car.s < RS.was.s + LY.TAPER0 - 50 || car.s > RS.was.s + LY.ACC1 + 300)) RS.was = null;
    RS.chipT -= dt;
    if (RS.chipT <= 0) { RS.chipT = 0.25; chip(nextAhead()); }
}

// ── the next-exit chip (subtle; only ≤ 1 mi ahead; hidden in HUD Clean) ──
css("exits", `
.exits-chip { display: inline-flex; align-items: center; gap: 6px; margin: 4px auto 0; padding: 3px 11px; border-radius: 10px;
  font: 700 12px var(--font); letter-spacing: .02em; color: #fff; background: rgba(31,122,70,.82); box-shadow: 0 2px 0 rgba(0,0,0,.18);
  white-space: nowrap; max-width: 92vw; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
.exits-chip.rest { background: rgba(21,101,192,.85); }
.exits-chip small { font-weight: 600; opacity: .85; }
.hud-slot.center .exits-wrap { text-align: center; }
body.tv .exits-chip { font-size: 20px; padding: 5px 16px; border-radius: 14px; }
@media (max-width: 600px) { .exits-chip { font-size: 11px; padding: 2px 9px; } }
`);
let chipEl = null, chipHtml = null;
function nextAhead() {
    const car = ctx.car;
    if (!car || ctx.state !== "playing" || (ctx.town && ctx.town.active) || (ctx.foot && ctx.foot.active) || !eligibleHud()) return null;
    let best = null;
    const T = ctx.town;
    if (T && T.exits) {
        const seen = new Map();
        for (const e of T.exits) { const a = e.s - car.s; if (a > -120 && a < 1609) { if (!seen.has(e.s)) seen.set(e.s, []); seen.get(e.s).push(e); } }
        for (const [s, list] of seen) { const a = s - car.s; if (!best || a < best.a) best = { kind: "exit", a, list }; }
    }
    for (const R of RS.list) { const a = R.s - car.s; if (a > -60 && a < 1609 && (!best || a < best.a)) best = { kind: "rest", a, R }; }
    return best;
}
const eligibleHud = () => !!ctx.G && (ctx.G.mode === "cruise" || ctx.G.mode === "story");
const miles = a => a < 160 ? "NOW" : `${(a / 1609).toFixed(1)} mi`;
function chip(n) {
    let html = "";
    if (n && n.kind === "exit") html = `<span class="exits-chip hud-secondary">🛣️ EXIT ${n.list.map(e => `${e.no || ""} ${e.label}`).join(" · ")} <small>· ${miles(n.a)} ↗</small></span>`;
    else if (n && n.kind === "rest") html = `<span class="exits-chip rest hud-secondary">🅿️ REST AREA <small>· ${miles(n.a)} · ⛽🍔🚻</small></span>`;
    if (html === chipHtml) return;
    chipHtml = html;
    if (!chipEl) { chipEl = document.createElement("div"); chipEl.className = "exits-wrap"; H.hudSlot("center").appendChild(chipEl); }
    chipEl.innerHTML = html;
}

// ── wiring ───────────────────────────────────────────────────────────────
on("boot", () => {
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(restSpot);
    registerBays(m => (m === "cruise" || m === "story") && ctx.enabled("exits") ? RS.list.map(R => R.s) : []);
});
on("state", ({ to }) => { if (to === "title" || to === "gameover") { if (RS.cue) cue(""); chip(null); } });

// ── the service ──────────────────────────────────────────────────────────
ctx.exits = {
    /** The rest areas planned this run: [{ s, k, name }]. */
    get rests() { return RS.list.map(R => ({ s: R.s, k: R.k, name: R.name.short })); },
    /** The stretches they cover (first sign → end of the accel lane), for the town's exit planner. */
    spans: () => RS.list.map(R => ({ a: R.s + LY.SPAN.a, b: R.s + LY.SPAN.b })),
    /** The rest area she's in (its name) or null. */
    get inside() { return RS.inside ? RS.inside.name.short : null; },
    /** What the chip shows: the next interchange / rest area ≤ 1 mi ahead, or null. */
    get next() { const n = nextAhead(); return n ? (n.kind === "exit" ? { kind: "exit", s: n.list[0].s, ids: n.list.map(e => e.id) } : { kind: "rest", s: n.R.s }) : null; },
    get dealOfDay() { return dealOfDay().id; },
    debug: {
        RS, LY, LIFE,
        /** Plan a rest area `ahead` metres in front of her NOW (rebuilds the chunks it touches). */
        restAhead(ahead = 900) {
            const w = ctx.world;
            for (const o of RS.list.filter(o => Math.abs(o.s - (ctx.car.s + ahead)) < 2400)) dropRest(o);
            const R = planRest(ctx.car.s + ahead, true);
            if (!R) return null;
            for (const [k, c] of [...w.chunks]) if (c.s1 > R.s + LY.SPAN.a - 20 && c.s0 < R.s + LY.SPAN.b) { c.dispose(w.scene); w.chunks.delete(k); }
            w.prebuild(ctx.car.s);
            return R.s;
        },
        /** World point of (u, d) at rest area i. */
        pt(i, u, d) { const R = RS.list[i]; if (!R) return null; const p = ctx.world.highway.point(R.s + u, d, {}); return { x: p.x, z: p.z, h: p.h, s: R.s + u }; },
        actAt,
        modelsReady: () => MODELS.every(k => models[k]) && PEOPLE_MODELS.every(k => models[k]),
    },
};
