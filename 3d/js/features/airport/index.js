// ─────────────────────────────────────────────────────────────────────────
//  features/airport — ✈️ THE AIRPORT EXIT: JFK (roadmap 12, stage 1: the exit and the kerb).
//
//  Its own interchange off the Cruise highway, signed ✈ JFK (EXIT 12), further out than the towns' exits: advance
//  signs, a taper into a decel lane, the gantry, a painted gore, a ramp, guardrails — and an approach road to a fenced
//  LANDSIDE: a one-way loop (up the west leg, along the kerb road past Terminal 4½ — DEPARTURES, then ARRIVALS — down
//  the east leg), the parking lot inside the loop, taxis + shuttle buses going round and stopping at the kerb, the
//  terminal's outside (its doors: ✋ "opening soon"), the control tower, the gates with parked jets, the runway behind
//  the RUNWAY FENCE (push against it: Officer Segal of airport security rolls up on his Segway), and planes taking off
//  and landing overhead (shadows sweeping the road, the roar). Out the same way: the east leg → the on-ramp → the accel
//  lane. Driven and walked with no cut: it's all in the driving scene, the car's `paved` ground, foot's walking.
//
//  ENGINE: a small one of its own that borrows the town exit's interchange shape (in highway coords) and the rest area's
//  "paved place beside the highway, colliders in the highway's chunks", but the airport itself is RIGID (its own frame,
//  like an attached town's PL.ROT) — an airport isn't a ribbon that bends with the road (ARCHITECTURE › Airport).
//
//    layout.js  the interchange (u, d) + the airport (f, r) as DATA
//    plan.js    WHERE (a pure function of fixed data: every friend's airport is on the same metre) + world geometry
//    build.js   the drawing, in ~3 ms steps from 2.6 km out (its own group; dropped 3.2 km away)
//    planes.js  the planes (instanced, a pure function of the clock — the party clock with friends), shadows, roar
//    life.js    the kerb vehicles, the doors, the runway fence joke
//    lines.js   every line of text (parody airlines only)
//
//  STAGE 1 is OFF by default until the interchange planner is split per town (ci/exits2): it plans only with
//  `?enable=airport` (tests) / `?airport=1` (anyone), or `ctx.airport.debug.placeAt(s)`.
//
//  ctx.airport { on, planned, ready, inside, spans(), next, debug }
//  Events: airport:enter {s} · airport:leave {s} · airport:door {f} · airport:fence {variant} · airport:built {ms, steps, worst}
//  Stats: airportVisits, airportDoors, airportFenceTries
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, hook, emit, addActor, pick } from "../../core/ctx.js";
import { paved } from "../../core/driving.js";
import { store, saveSoon } from "../../core/save.js";
import { models, ensureModels } from "../../models.js";
import * as H from "../../hud.js";
import * as LY from "./layout.js";
import * as L from "./lines.js";
import { AIR, findSpot, searchSteps, geometry, inLand, fits, frameAt } from "./plan.js";
import { buildSteps, BUILD_MODELS, lookMats } from "./build.js";
import { makePlanes, PLANES } from "./planes.js";
import { makeVehicles, doorSpot, makeJoke, nearFence, luluSays, VEH, JOKE } from "./life.js";

// ── the switch (stage 1: off unless asked for) ───────────────────────────
const Q = new URLSearchParams(location.search);
const FLAG = (Q.get("enable") || "").split(",").includes("airport") || Q.get("airport") === "1";
/** How far out the build starts / stops, and the per-frame build budget. */
export const BUILD = { start: 2600, drop: 3200, ms: 3.0, keepBehind: 520 };

const S = {
    on: FLAG, G: null, E: null, res: [], signs: [], group: null, gen: null, ready: false, out: null, planes: null, veh: null,
    inside: false, visited: false, cue: "", cuePull: undefined, ownPull: false, presence: false, ms: 0, steps: 0, worst: 0, t0: 0,
    saved: store("airport", { visits: 0, jokes: 0 }), save: saveSoon, next: 0, keep: false, party: false, search: null,
};
const joke = makeJoke(S);
const doors = doorSpot(S);

function partyRoam() { const A = ctx.party && ctx.party.active && ctx.party.activity; return !!A && A.k === "roam"; }
function eligible() {
    const G = ctx.G;
    if (!S.on || !G) return false;
    // (a 🎉 party: off until the interchange planner hook — ci/exits2 — makes every friend's town exits keep out of it;
    //  the placement itself is already fixed data, the presence + the planes on the party clock are wired)
    if (ctx.party && ctx.party.active) return S.party && G.mode === "party" && partyRoam();
    return G.mode === "cruise" && !G.tutorial;
}

// ── planning ─────────────────────────────────────────────────────────────
function drop() {
    unbuild();
    const w = ctx.world;
    if (w) {
        for (const r of S.res) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
        for (const sg of S.signs) { const i = w.signs.indexOf(sg); if (i >= 0) w.signs.splice(i, 1); }
    }
    S.res = []; S.signs = []; S.G = null; S.E = null;
    S.inside = false; S.visited = false; joke.reset();
    if (S.cue) cue("");
}
/** Plan the airport with its exit at E (exactly: E comes from findSpot or a debug call). */
function plan(E) {
    const w = ctx.world;
    drop();
    S.E = E;
    S.G = geometry(E);
    const reserve = (a, b, side, d0, d1) => { w.reserve(a, b, side, d0, d1); S.res.push(w.reserved[w.reserved.length - 1]); };
    reserve(E + LY.TAPER0 - 30, E + LY.ACC1 + 30, 1, 7.2, 70);             // the ramps: no trees / houses / poles on them
    reserve(E + LY.UA - 640, E + LY.UA + 640, 1, 7.2, 3000);               // the airport itself (and its roads in)
    reserve(E + LY.SPAN.a, E + LY.SPAN.b + AIR.townGap, 1, 9, 22);          // a thin strip the towns' / rest areas' planners see as busy
    const sign = (u, lines, extra = {}) => {
        const sg = Object.assign({ s: E + u, d: 10.6, lines, bg: "#1f7a46", fg: "#fff", w: 4.8, h: 2.6, tw: 512, th: 280, tab: `EXIT ${L.EXIT_NO}` }, extra);
        w.addSign(sg); S.signs.push(sg);
    };
    sign(LY.SIGN_MILE, L.SIGNS.mile);
    sign(LY.SIGN_HALF, L.SIGNS.half);
    sign(LY.SIGN_LAST, L.SIGNS.last, { tab: null, w: 4.4, h: 2.4 });
    ensureModels(BUILD_MODELS.concat(["airport_taxi", "airport_shuttle"])).catch(e => console.warn("[airport] models", e));
    S.next = E + AIR.every;
    return S.G;
}
/** Rebuild the highway chunks over the airport's stretch (a debug placement right ahead: its signs + ramps + colliders). */
function rebuildChunks() {
    const w = ctx.world, E = S.E;
    if (!w || E == null) return;
    for (const [k, c] of [...w.chunks]) if (c.s1 > E + LY.SPAN.a - 20 && c.s0 < E + LY.SPAN.b + 20) { c.dispose(w.scene); w.chunks.delete(k); }
    w.prebuild(ctx.car.s);
}

// the airport's ground: its lanes (3 — nothing stands on them), the landside (2 — the car drives it like road,
// foot walks it with no wilderness)
const _w = {};
paved.push((s, d) => {
    const G = S.G;
    if (!G || d < 6.5) return 0;
    const u = s - G.E;
    if (u < LY.TAPER0 - 2 || u > LY.ACC1 + 80) return 0;
    if (LY.hwLane(u, d)) return 3;
    if (d < 13 && (u < LY.OFF1 - 30 || u > LY.ON0 + 30)) return 0;
    ctx.world.highway.point(s, d, _w);
    if (G.grid.at(_w.x, _w.z)) return 3;
    return inLand(G, _w.x, _w.z) ? 2 : 0;
});

// the colliders ride in the highway's chunks (the car's + foot's collision loops find them there)
on("chunk:build", ({ chunk, world }) => {
    const G = S.G;
    if (!G || (world.district && !world.district.keepHighway)) return;
    const l = G.byChunk.get(chunk.k);
    if (l) for (const c of l) chunk.colliders.push(c);
    if (chunk.k === G.kerbChunk && S.veh) for (const c of S.veh.dyn) chunk.colliders.push(c);
});
function addDynColliders() {
    const w = ctx.world, G = S.G;
    if (!w || !G || !S.veh) return;
    const ch = w.chunks.get(G.kerbChunk);
    if (ch) for (const c of S.veh.dyn) if (!ch.colliders.includes(c)) ch.colliders.push(c);
}

// ── the build (in slices) + the living bits ──────────────────────────────
function unbuild() {
    if (S.planes) { S.planes.dispose(); S.planes = null; }
    if (S.veh) { S.veh.dispose(); S.veh = null; }
    if (S.group) {
        if (S.group.parent) S.group.parent.remove(S.group);
        for (const g of (S.out && S.out.geos) || []) g.dispose();
        // (the atlas material + canvas stay for the next build: the same cells)
    }
    S.group = null; S.gen = null; S.out = null; S.ready = false;
    joke.reset();
}
function startBuild() {
    S.group = new THREE.Group();
    S.group.name = "Airport";
    ctx.scene.add(S.group);
    S.out = { geos: [] };
    S.gen = buildSteps(S.G, S.group, S.out);
    S.ms = 0; S.steps = 0; S.worst = 0; S.stepMs = []; S.t0 = performance.now();
}
function advance(budget) {
    const t0 = performance.now();
    while (S.gen) {
        const a = performance.now();
        const r = S.gen.next();
        const dt = performance.now() - a;
        S.ms += dt; S.steps++; (S.stepMs || (S.stepMs = [])).push(dt);
        if (dt > S.worst) { S.worst = dt; S.worstStep = r.done ? "done" : String(r.value); }
        if (r.done) {
            S.gen = null; S.ready = true;
            S.planes = makePlanes(S.G, ctx.scene);
            S.veh = makeVehicles(S.G, ctx.scene);
            addDynColliders();
            emit("airport:built", { ms: S.ms, steps: S.steps, worst: S.worst });
            break;
        }
        if (performance.now() - t0 > budget) break;
    }
}
const _cam = new THREE.Vector3();
function tick(dt) {
    const G = S.G, car = ctx.car;
    if (!G || !car) return;
    const town = ctx.town && ctx.town.active;
    const ds = car.s - (G.E + LY.UA);
    // build / drop by distance (along the highway); a town visit (another district) leaves it standing
    const near = !town && Math.abs(ds) < BUILD.start;
    if (!S.group && near && BUILD_MODELS.every(k => models[k])) startBuild();
    if (S.gen) advance(BUILD.ms);
    if (S.group && (town ? false : Math.abs(ds) > BUILD.drop)) unbuild();
    // keep the highway's chunks behind her while she's round the airport (its ramps stay drawn from the kerb)
    const keep = !!S.group && ds > LY.TAPER0 - LY.UA - 200 && ds < LY.ACC1 - LY.UA + 400;
    if (keep !== S.keep && ctx.world) { S.keep = keep; ctx.world.keepBehind = keep ? BUILD.keepBehind : 0; }
    if (!S.ready) return;
    const cam = ctx.camera ? ctx.camera.getWorldPosition(_cam) : null;
    // drawn only within the fog (× the tier's draw distance)
    if (cam) {
        const fog = ctx.scene.fog, far = Math.max(300, (fog ? fog.far : 2000) * (ctx.world.drawScale || 1)) + 600;
        const c = G.F.world(0, 200, _w);
        S.group.visible = !town && Math.hypot(c.x - cam.x, c.z - cam.z) < far;
    }
    // the windows + lamps at night
    const night = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0, M = lookMats();
    M.glow.emissiveIntensity = night * 1.6;
    M.lit.emissiveIntensity = 0.25 + night * 3.2;
    if (S.planes) { try { S.planes.update(dt, cam); S.planes.group.visible = !town; } catch (e) { console.error("[airport] planes", e); } }
    const p = (ctx.foot && ctx.foot.active && ctx.foot.pos) || car.pos;
    const inside = !town && inLand(G, p.x, p.z, 4);
    if (S.veh) { try { S.veh.update(dt, !town && Math.abs(ds) < 900); S.veh.group.visible = !town; } catch (e) { console.error("[airport] kerb", e); } }
    try { joke.update(dt); } catch (e) { console.error("[airport] joke", e); }
    arrive(inside);
}

function arrive(inside) {
    const G = ctx.G;
    if (inside && !S.inside) {
        S.inside = true;
        if (G && !G.noPullOver) { G.noPullOver = true; S.ownPull = true; }      // (stop = get out & walk; no parking minigame here)
        if (!S.visited) {
            S.visited = true;
            S.saved.visits++; saveSoon();
            H.banner(`<b>${L.ARRIVE.title}</b><small>${L.ARRIVE.sub}</small>`, 2600, { key: "airport", prio: 1 });
            if (Math.random() < 0.6) luluSays(pick(L.LULU.arrive), 3);
            emit("airport:enter", { s: S.E });
            emit("stat", { id: "airportVisits", n: 1 });
        }
    } else if (!inside && S.inside) {
        S.inside = false;
        if (S.ownPull && G) { G.noPullOver = false; S.ownPull = false; }
        if (S.presence) { S.presence = false; if (ctx.party && ctx.party.presence) ctx.party.presence(null); }
        emit("airport:leave", { s: S.E });
    }
    // a 🎉 party: friends see "✈️ at JFK" over her car / walker
    if (S.inside && ctx.party && ctx.party.active && ctx.party.presence && (ctx.state === "playing" || ctx.state === "footRun")) {
        const pr = ctx.party.presenceOf && ctx.party.presenceOf();
        if (!pr || pr.mode !== "airport") ctx.party.presence({ mode: "airport", icon: "✈️", label: "at JFK" });
        S.presence = true;
    }
}

// the decel-lane / ramp cue (a prompt, never a popup)
function cue(html) {
    if (html === S.cue) return;
    const G = ctx.G;
    if (html && !S.cue && G) { S.cuePull = G.noPullOver; G.noPullOver = true; }
    if (!html && S.cue && G) G.noPullOver = S.cuePull;
    S.cue = html;
    H.prompt(html);
}
function cueTick(controlsOn) {
    const G = S.G, car = ctx.car;
    let html = "";
    if (G && ctx.state === "playing" && controlsOn && car.speed > 3 && !(ctx.town && ctx.town.active)) {
        const u = car.s - G.E, d = car.d;
        if (u >= LY.TAPER0 && u < LY.RAMP0 + 6 && d > 7.35) html = L.CUE.decel;
        else if (u >= LY.RAMP0 && u < LY.OFF1 + 30 && Math.abs(d - LY.offD(Math.min(u, LY.OFF1))) < LY.HALF + 2) html = L.CUE.ramp;
    }
    cue(html);
}

// ── run lifecycle ────────────────────────────────────────────────────────
/** The search for a spot runs a few candidates a frame (fixed data: the same answer on every screen, cached). */
function searchTick(budget = 2.5) {
    if (!S.search) return;
    const t0 = performance.now();
    while (performance.now() - t0 < budget) {
        const r = S.search.next();
        if (r.done) { S.search = null; if (r.value != null) plan(r.value); else S.next += AIR.every; return; }
    }
}
hook("runStart", G => {
    drop();
    S.search = null;
    if (!eligible()) return;
    S.search = searchSteps(Math.max(AIR.first, (G.startS || 0) + 2600));
    searchTick(4);
    addActor({ foot: true, update: dt => { if (ctx.foot && ctx.foot.active) { try { tick(dt); } catch (e) { console.error("[airport] tick", e); } } return true; } });
}, 15);
hook("update", (dt, P, controlsOn) => {
    try { tick(dt); cueTick(controlsOn); } catch (e) { console.error("[airport] update", e); }
    // the next one, far on (a Cruise is endless)
    if (S.search) searchTick();
    else if (S.G && eligible() && ctx.car.s > S.G.E + BUILD.drop + 200 && !(ctx.town && ctx.town.active)) { const nx = S.next; drop(); S.search = searchSteps(nx); }
}, -6);
on("title", () => { drop(); if (ctx.world) ctx.world.keepBehind = 0; S.keep = false; });
on("state", ({ to }) => { if ((to === "title" || to === "gameover") && S.cue) cue(""); });
on("boot", () => {
    // (the sign atlas's first line of text in this font + its first ✈ glyph cost a long frame once a page: pay it while
    //  the game boots, not when the airport builds in the middle of a drive)
    if (S.on) try { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); g.font = `700 24px Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`; g.fillText("✈ JFK ½ ↗ ↖ 🥘 😩 🥯 🤷 🚕 🚌 📱 ⚠", 2, 30); } catch (e) { /* fine */ }
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(doors);
    // no world fence inside the landside: its own fence keeps her in
    if (ctx.foot && ctx.foot.bounds && ctx.foot.bounds.free) ctx.foot.bounds.free.push((x, z) => !!S.G && inLand(S.G, x, z, 2));
});

// ── the service ──────────────────────────────────────────────────────────
ctx.airport = {
    /** Stage 1 is behind a switch (?enable=airport / ?airport=1). */
    get on() { return S.on; },
    /** The planned airport: { s (its exit), no, name } or null. */
    get planned() { return S.G ? { s: S.E, no: L.EXIT_NO, name: "JFK" } : null; },
    /** Built and standing (its group, planes and kerb are live). */
    get ready() { return S.ready; },
    /** She (in the car or on foot) is in the fenced landside. */
    get inside() { return S.inside; },
    /** The stretch it covers along the highway (signs → accel lane) — for other planners to keep out of. */
    spans: () => S.G ? [{ a: S.E + LY.SPAN.a, b: S.E + LY.SPAN.b }] : [],
    /** The kerb: `pickup()` → world {x, z, h} of the ARRIVALS pickup point in the kerb lane (f 24 — short of the taxi
     *  line, which queues from f 70 back), heading along the kerb; null when it isn't planned (stage 3's taxi runs). */
    kerb: {
        pickup() { if (!S.G) return null; const p = S.G.F.world(24, LY.KERB_LANE, {}); p.h = S.G.F.yaw(1, 0); return p; },
        get dep() { return LY.KERBS.dep.slice(); }, get arr() { return LY.KERBS.arr.slice(); },
    },
    debug: {
        S, LY, AIR, BUILD, PLANES, VEH, JOKE, joke,
        /** Switch it on / off for this page (tests use ?enable=airport). */
        enable(v = true) { S.on = !!v; if (!v) drop(); },
        /** Allow it in a 🎉 party's Free Roam (off until ci/exits2's planner hook). */
        party(v = true) { S.party = !!v; },
        /** Plan it with its exit at s (slid on to the first spot that fits unless `force`); rebuilds the chunks there. */
        placeAt(s, { force = false, rebuild = true } = {}) {
            const E = findSpot(Math.round(s), { force });
            if (E == null) return null;
            plan(E);
            if (rebuild) rebuildChunks();
            return E;
        },
        /** Plan it `ahead` metres in front of her (its 1 MI sign first) — the next spot that fits. */
        ahead(ahead = 1700) { return this.placeAt(ctx.car.s + ahead); },
        /** Build it all now (tests / the perf probe). */
        buildNow() { if (!S.G) return false; if (!S.group) startBuild(); advance(Infinity); return S.ready; },
        fits: E => fits(E),
        findSpot: (s, o) => findSpot(s, o),
        frame: E => frameAt(E),
        /** World point of airport-frame (f, r) / its local (f, r) of a world point. */
        world: (f, r) => S.G ? S.G.F.world(f, r, {}) : null,
        local: (x, z) => S.G ? S.G.F.local(x, z, {}) : null,
        /** The roads as world polylines (id → [{x, z, tx, tz, w, v}]), the vehicle loop, the fences. */
        roads: () => S.G ? Object.fromEntries(S.G.roads.map(r => [r.id, r.pts])) : null,
        G: () => S.G,
        planes: () => S.planes ? S.planes.live.map(p => Object.assign({}, p)) : [],
        vehicles: () => S.veh ? S.veh.cars.map(c => ({ kind: c.kind, x: c.x, z: c.z, h: c.h, speed: c.speed, wait: c.wait, atStop: c.atStop || null })) : [],
        kerbStats: () => S.veh ? Object.assign({}, S.veh.stats) : null,
        nearFence: (x, z) => S.G ? nearFence(S.G, x, z, {}) : null,
        fenceJoke: (force = true) => joke.trigger(force),
        jokePhase: () => joke.phase,
        /** Numbers: { steps, ms, worst, tris, calls, meshes } of the static build. */
        perf() {
            if (!S.group) return null;
            let tris = 0, meshes = 0;
            S.group.traverse(o => { if (o.isMesh && o.geometry) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
            const q = (S.stepMs || []).slice().sort((a, b) => a - b), pc = k => q.length ? +q[Math.min(q.length - 1, Math.floor(q.length * k))].toFixed(2) : 0;
            return { steps: S.steps, ms: +S.ms.toFixed(1), p95: pc(0.95), worst: +S.worst.toFixed(2), worstStep: S.worstStep, tris: Math.round(tris), meshes };
        },
    },
};
