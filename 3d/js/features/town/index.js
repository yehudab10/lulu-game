// ─────────────────────────────────────────────────────────────────────────
//  features/town — 🏙️ TOWNS YOU CAN TURN INTO: LAKEWOOD (nobody likes Lakewood) and MIDWOOD,
//  Brooklyn (nobody can PARK in Midwood). Cruise's exits alternate between them (towns/index.js).
//
//  How a town fits the road model: the highway is one endless Road in road coordinates
//  (s along, d across) and every system — driving, traffic, cops, on foot, carjacking —
//  asks ctx.world.road. A town is a DISTRICT (core: world.setDistrict): while Lulu is in
//  one, world.road IS the town's TownRoad (plan.js — same API, s/d along whichever street
//  she's on), activeChunks() is the town's single "always near" chunk (its colliders and
//  coins), and the highway's chunks wait, hidden, exactly where she left them. So the car
//  drives with the same physics, the traffic cars follow town streets, cops pull her over
//  on the curb, she climbs out and carjacks a minivan… through small, guarded hooks
//  (law: occluders + routing + spawn points; foot: a steady walking frame) instead of forks.
//
//    plan.js    the plan ENGINE: a town definition → streets, crossings, blocks, the graph, TownRoad
//    towns/     the TOWNS as data (lakewood.js, midwood.js + their lines) — INTERCHANGE lists who every exit offers
//    build.js   the scene: merged block clusters (kit.js), one sign atlas, lamps, the lake…
//    rail.js    an embankment railway (Midwood's B/Q): berm, bridges, stations, the trains
//    landmarks.js  boulevard malls, frontage strips, the college quad, the city skyline, barricades
//    cars.js    the town's drivers (lane-following, 4-way stops, the circle) + the patrol car
//    parked.js  the parked cars: solid, shoved when she bumps one, hotwirable on foot (lifted out of the merge)
//    life.js    people (talk on foot), geese, e-bikes, speed bumps, stop signs, the group chat
//    cops.js    what law asks: blocksSight / copRoute / copSpawn
//    exit.js    the highway interchange (the plan): signs, decel lane, one ramp that splits per town, T-junctions, the on-ramp
//    exitbuild.js  …drawn: asphalt, paint, guardrails, the gantry, STOP signs, guide boards, a gas station, the first houses
//    sfx.js     goose honks, minivan horns, the speed-bump THUNK
//
//  ctx.town { active, id, name, street, streets, occluders, enter(), leave(), blocksSight(),
//             copRoute(), copSpawn(), footYaw(), towns, debug }
//  Events: town:exit {town, s, no} (she took a branch) · town:enter {town, exitS, attached, drove, quiet, home} · town:leave {town, why} · town:gossip {kind, msg} ·
//          town:talk {id, line} · town:stopSign · town:bump · town:geese · town:bike
//  Random content is gated by ctx.enabled("town") (off in ?test unless enabled, off in a party).
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, hook, emit, css, addActor } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { models, ensureModels, registerModels } from "../../models.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { PL, setPlan, TownRoad, LANE, street, streetOfS, streetPoint, headingOf, toLocal, toWorld, wH, dirWorld, segmentBlocked, sightBlocked } from "./plan.js";
import { buildTown, buildTownSteps, BUILD_MODELS, lotSpot } from "./build.js";
import { tickRail } from "./rail.js";
import * as SFX from "./sfx.js";
import { C, spawnDriver, spawnHazard, clearDrivers, randomSpot, tendDrivers, lodDrivers } from "./cars.js";
import { LIFE, PEOPLE_MODELS, startLife, stopLife, tickLife, luluSay, gossip, honked, crime, patrolSees, talkSpot } from "./life.js";
import { dissolve } from "../../core/transition.js";
import { blocksSight, copRoute, copSpawn, hideSpot, searchPoint, prowlPoint } from "./cops.js";
import { PK, setupParked, tickParked, clearParked } from "./parked.js";
import { X, FIT, exitClear, exitFitS, planExit, clearExits, exitAt, rampPhase, SPAN, HALF as RAMP_HALF, onRampSpot, rampRoute, laneAt, crossRoads, X_FAR, ACC1 } from "./exit.js";
import { propsOf, railsOf } from "./exitbuild.js";
import { tendAmbient, convertAmbient, disposeAmbient, AMB } from "./ambient.js";
import { TOWNS, townFor, INTERCHANGE, ROUTE, routeAt, routeFrom, attachedDef } from "./towns/index.js";

const NEEDS = [...new Set([...BUILD_MODELS, ...PEOPLE_MODELS, "cop"])];
/** The models a town needs: Lakewood's set, or the town's own list (def.models). */
const needsOf = def => def.models ? [...new Set(def.models)] : NEEDS;
// our own models (key = file name), plus the two we borrow from roadevents / foot (same files, so no double load)
const OWN = new Set(Object.values(TOWNS).flatMap(needsOf).concat(NEEDS).filter(k => /^(town_|roadevents_school_bus$|foot_bus$)/.test(k)));
registerModels(Object.fromEntries([...OWN].map(k => [k, k])));

// ── state ────────────────────────────────────────────────────────────────
const S = { active: false, def: null, lastDef: null, T: null, at: null, att: null, built: [], road: null, chunk: null, exitS: 0, trans: null, ready: null, loaded: false, loads: {}, ok: {},
    savedTraffic: true, readLive: 0, savedTrip: null, savedPullOver: undefined, timers: [], visits: 0, bubbe: new Set(), footYaw: null, tendT: 0, haz: [] };
const TOWN_OK = new Set(["playing", "wrecked", "footRun", "lawBust", "lawStop", "playPhoto", "hustleResult"]);   // (lawStop: her cop car pulling someone over)
// highway content that has no business in a town (its random parts read the highway's s)
const TOWN_OFF = new Set(["roadevents", "cameos", "foot", "interiors", "journey", "hustle", "play", "banter", "law", "dina", "memory", "world", "shabbos"]);
const baseEnabled = ctx.enabled;
ctx.enabled = id => (S.active && TOWN_OFF.has(id)) ? false : baseEnabled(id);

/** A 🎉 party that drives the open world (openworld's 🌍 Free Roam): towns are on, but every friend must
 *  see the same town — no random drivers (openworld runs seeded block-loop traffic), seeded life, no e-bikes. */
const partyTowns = () => !!(ctx.party && ctx.party.active && ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());

/** Load a town's models (lazily, as her car nears its exit). S.loaded / S.ready: the first town's (Lakewood's).
 *  Landmark models other features build (the town's `uses`) are optional — without them the use's fallback stands there. */
function load(def = townFor(0)) {
    const id = def.id;
    const extra = [...new Set(Object.values(def.uses || {}).flatMap(u => [u.key, ...(u.with || []).filter(w => w.dims || w.sign || w.spot).map(w => w.key)]))];
    if (!S.loads[id]) S.loads[id] = Promise.all([ensureModels(needsOf(def)), ...extra.map(k => ensureModels([k]).catch(() => null))])
        .then(() => { S.ok[id] = true; S.failed = false; if (def === townFor(0)) S.loaded = true; })
        .catch(e => { console.warn("[town] models", id, e); S.loads[id] = null; S.failed = true; });
    if (def === townFor(0)) S.ready = S.loads[id];
    return S.loads[id];
}

// ── the fade (the only "transition": ~1 s, in game time) ─────────────────
css("town", `
#townFade { position: fixed; inset: 0; background: #0c0f16; opacity: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
#townFade span { color: #fff; font: 700 clamp(22px, 4vw, 44px) Fredoka, Arial, sans-serif; letter-spacing: .04em; opacity: 0; transition: opacity .2s; text-shadow: 0 2px 12px rgba(0,0,0,.5); }
#townFade span small { display: block; text-align: center; font-size: .45em; font-weight: 600; opacity: .75; letter-spacing: .02em; margin-top: 4px; }
#townFade.label span { opacity: 1; }
`);
const fade = document.createElement("div");
fade.id = "townFade";
fade.innerHTML = "<span></span>";
(document.getElementById("scene") || document.body.firstChild).after(fade);
function setFade(a, label = null) {
    fade.style.opacity = String(Math.max(0, Math.min(1, a)));
    if (label != null) fade.querySelector("span").innerHTML = label;
    fade.classList.toggle("label", a > 0.95 && !!label);
}

function beginTrans(kind, e = null) {
    if (S.trans) return;
    S.trans = { kind, e, t: 0, phase: "out" };
    if (kind === "enter") load(e ? e.town : townFor(0));
}
function tickTrans(dt) {
    const tr = S.trans;
    if (!tr) return;
    tr.t += dt;
    const def = tr.kind === "enter" ? (tr.e ? tr.e.town : townFor()) : S.def;
    const label = tr.kind === "enter" ? `${def.emoji} ${def.name}<small>${def.lines.SIGNS.welcome.slice(1).join(" · ")}</small>` : `🛣️ Back to the highway<small>${def.name} survived</small>`;
    if (tr.phase === "out") {
        // Everything's loaded: a SOFT CUT — the last frame of the ramp melts into the town's street (or the street into
        // the highway). The black + its label are only for when she still has to wait for the download.
        if (!tr.hard && (tr.kind === "leave" || S.ok[def.id])) {
            dissolve(() => {
                try { if (tr.kind === "enter") enterTown(tr.e); else leaveTown("highway"); }
                catch (err) { console.error("[town] transition", err); }
            });
            tr.phase = "in"; tr.soft = true; tr.t = 0;
            return;
        }
        tr.hard = true;
        setFade(tr.t / 0.4, label);
        if (tr.t >= 0.4) { tr.phase = "black"; tr.t = 0; }
    } else if (tr.phase === "black") {
        setFade(1, label);
        if (tr.kind === "enter" && !S.ok[def.id]) {
            // (no connection? don't strand her behind a black screen: the exit's just "closed")
            if (S.failed || tr.t > 8) { S.trans = null; setFade(0); S.failed = false; H.toast(`🚧 ${def.name} is closed today (couldn't load it)`, "red"); return; }
            load(def); return;
        }
        if (tr.t < 0.15) return;
        try { if (tr.kind === "enter") enterTown(tr.e); else leaveTown("highway"); }
        catch (err) { console.error("[town] transition", err); }
        tr.phase = "in"; tr.t = 0;
    } else if (tr.soft) {
        if (tr.t >= 0.3) S.trans = null;         // (the melt is the overlay's own; `transitioning` just covers it)
    } else {
        setFade(1 - tr.t / 0.55, label);
        if (tr.t >= 0.55) { S.trans = null; setFade(0); }
    }
}

// ── the district's single chunk: everything near her, always "in range" ──
function makeChunk(T) {
    const g = new THREE.Group();
    g.name = "TownExtras";
    ctx.scene.add(g);
    S.extras = g;
    // (on foot the colliders + range follow HER, not the car she left on another street: a street's s is its own
    //  base + along, so the car's s says nothing about where she walks — she'd walk through every parked car and wall)
    const foot = () => ctx.foot && ctx.foot.active && ctx.foot.pos ? ctx.foot : null;
    return {
        k: -1, get s0() { const f = foot(); return (f && f.debug && f.debug.F ? f.debug.F.s : ctx.car.s) - 100; },
        get s1() { return this.s0 + 200; },
        get colliders() { const f = foot(), p = f ? f.pos : ctx.car.pos; return T.near(p.x, p.z); },
        coins: T.coins, hearts: [], traps: [], houses: [], anim: [], biome: { name: "town" }, group: g,
        add(o) { g.add(o); return o; }, own(x) { T.own.push(x); return x; }, addCollider(c) { T.colliders.push(c); if (T.indexCollider) T.indexCollider(c); return c; },
        addMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); g.add(m); T.own.push(geo); return m; },
        onAnimate() {}, sign() {}, animate() {}, resetCoins() {},
    };
}

// ── ATTACHED towns: built ahead at the interchange, entered by driving in ──
// A town that has `attach` data stands at each interchange, turned so the cross road off its branch's T-junction runs
// straight on into its first street (placeAt: a pure function of the exit's s and the highway — the same metre on every
// friend's screen). It's built in slices as she approaches (from BUILD_FROM m out), drawn from the highway while she
// drives up, and becomes the district the moment she crosses the line a few metres past the T (the approach street —
// plan.js — is the cross road itself, so position, heading and speed carry straight across: no cut). Driving back out
// past that line hands her to the highway's road again, the town standing where it is until she's left it behind.
const BUILD_FROM = 900, BUILD_MS = 3, DROP_PAST = ACC1 + 600, BOX_PAD = 20;
const D_AFTER_T = 6;           // the approach starts this far out past its T-junction's d (the cross road's own centre line)
/** Where town `def` stands at the interchange at `exitS`, on branch k (its cross road) → { def (attached), at: {x, z, rot}, k, exitS } | null. */
function placeAt(def, exitS, k, two = true) {
    if (!def || !def.attach) return null;
    const c = crossRoads({ two })[k];
    if (!c) return null;
    const d0 = c.t + D_AFTER_T, A = attachedDef(def, d0, X_FAR);
    const P = ctx.world.highway.point(exitS + c.u, d0, {});
    const rot = P.h - Math.PI / 2 - def.attach.dir;
    const [fx, fz] = A.approach.from, co = Math.cos(rot), si = Math.sin(rot);
    return { def: A, at: { x: P.x - (fx * co + fz * si), z: P.z - (-fx * si + fz * co), rot }, k, exitS, cu: c.u, d0 };
}
/** Which branch of the exit at exitS leads to def (ci/exits2: every exit is one town's — branch 0; a debug two-town
 *  interchange still has the second town on the outer branch). */
function branchK(def, exitS) {
    const e = X.exits.find(e => Math.abs(e.s - exitS) < 1);
    const b = e && e.branches.find(b => b.town === def);
    return b ? b.k : 0;
}
/** A standing town's whole-town meshes (asphalt, sidewalks, paint, the sign atlas) and the rest of its root: not drawn
 *  when the camera is far off (> 900 m) — nor its ground when she's inside ANOTHER town and it's more than 60 m off
 *  (behind that town's blocks; the ground is flat, the clusters standing on it are culled on their own). */
function cullStanding(en) {
    const T = en.T, c = ctx.camera.position, p = localIn(en.at, c.x, c.z, {}), b = en.box;
    const dist = Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1));
    T.root.visible = dist < 900;
    T.coinMesh.visible = dist < 400;
    const ground = dist < (S.att ? 60 : 900);
    for (const m of T.ground || []) m.visible = ground;
}
/** A world point in a placement's local frame. */
function localIn(at, x, z, out = {}) { const dx = x - at.x, dz = z - at.z, co = Math.cos(at.rot), si = Math.sin(at.rot); out.x = dx * co - dz * si; out.z = dx * si + dz * co; return out; }
/** A town's footprint (local bbox of everything it builds: streets, woods, water, skyline), cached per def. */
const BOX = new Map();
function boxOf(def) {
    if (BOX.has(def)) return BOX.get(def);
    const b = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9 };
    const add = (x, z, r = 0) => { b.x0 = Math.min(b.x0, x - r); b.x1 = Math.max(b.x1, x + r); b.z0 = Math.min(b.z0, z - r); b.z1 = Math.max(b.z1, z + r); };
    for (const st of def.streets) {
        if (st.axis === "ns") { add(st.c, st.a0, 12); add(st.c, st.a1, 12); }
        else if (st.axis === "ew") { add(st.a0, st.c, 12); add(st.a1, st.c, 12); }
        else { add(st.from[0], st.from[1], 14); add(st.to[0], st.to[1], 14); }
    }
    for (const w of def.woods || []) { add(w[0], w[1], 3); add(w[2], w[3], 3); }
    for (const w of def.skyline || []) { add(w[0], w[1], 12); add(w[2], w[3], 12); }
    for (const W of def.water || []) { add(W.x0, W.z0); add(W.x1 + 8, W.z1); }
    for (const sp of def.strips || []) { const st = def.streets.find(q => q.name === sp.street); if (st && st.axis === "ns") { add(st.c - sp.side * ((sp.depth || 13) + 14), sp.from); add(st.c - sp.side * ((sp.depth || 13) + 14), sp.to); } }
    BOX.set(def, b);
    return b;
}
const inBox = (b, p, pad = 0) => p.x > b.x0 - pad && p.x < b.x1 + pad && p.z > b.z0 - pad && p.z < b.z1 + pad;
/** Along / across the approach (local p): { along (m from its start, the T end), lat }. */
function onApproach(def, p, out = {}) {
    const [fx, fz] = def.approach.from, [tx, tz] = def.approach.to, L = Math.hypot(tx - fx, tz - fz), ux = (tx - fx) / L, uz = (tz - fz) / L;
    out.along = (p.x - fx) * ux + (p.z - fz) * uz; out.lat = Math.abs(-(p.x - fx) * uz + (p.z - fz) * ux); out.len = L;
    return out;
}
/** Would every attachable town this exit offers stand clear of the highway (≥ 100 m from its centre line,
 *  from 3 km back to 4 km on) if the exit were at s? (exit.js planning slides the exit on until it does.) */
FIT.fits = (s, towns) => {
    const hw = ctx.world && ctx.world.highway;
    if (!hw) return true;
    const two = towns.length > 1, q = {}, p = {};
    for (let k = 0; k < Math.min(2, towns.length); k++) {
        const P = placeAt(towns[k], s, k, two);
        if (!P) continue;
        const b = boxOf(P.def);
        for (let t = Math.max(0, s - 3000); t < s + 4000; t += 12) {
            hw.at(t, q); localIn(P.at, q.x, q.z, p);
            if (inBox(b, p, 100)) return false;
        }
    }
    return true;
};
/** The built entry for (exit, branch), if any. */
const entryOf = (exitS, k) => S.built.find(b => Math.abs(b.exitS - exitS) < 1 && b.k === k) || null;
/** Run fn with this entry's plan as the current one (then the active town's back). */
function withPlan(en, fn) {
    const back = S.active ? [S.def, S.at] : null;
    setPlan(en.def, en.at);
    try { return fn(); } finally { if (back) setPlan(back[0], back[1]); }
}
/** Start building the towns exit e offers (each once its models are in). */
function planBuilds(e) {
    for (const b of e.branches) {
        if (!b.town.attach || !S.ok[b.town.id] || entryOf(e.s, b.k)) continue;
        const P = placeAt(b.town, e.s, b.k, e.two);
        if (P) S.built.push(Object.assign(P, { e, T: null, gen: null, ready: false, box: boxOf(P.def), ms: 0, steps: 0, worst: 0 }));
    }
}
/** Advance the first unfinished build by ~ms (all of it when ms is Infinity). */
function advanceBuilds(ms = BUILD_MS, target = null) {
    const en = target && !target.ready ? target : S.built.find(b => !b.ready);
    if (!en) return;
    const t0 = performance.now();
    withPlan(en, () => {
        if (!en.gen) en.gen = buildTownSteps(en.def);
        for (;;) {
            const a = performance.now(), r = en.gen.next(), dtm = performance.now() - a;
            en.steps++; en.ms += dtm; en.worst = Math.max(en.worst, dtm);
            (en.times || (en.times = [])).push(dtm);
            if (S.sliceLog) S.sliceLog.push([en.def.id, en.steps, +dtm.toFixed(2), r.done ? "done" : String(r.value || "")]);
            if (r.done) { finishBuild(en, r.value); break; }
            if (performance.now() - t0 > ms) break;
        }
    });
}
function finishBuild(en, T) {
    en.T = T; en.ready = true; en.gen = null;
    T.root.updateMatrixWorld(true);
    ctx.scene.add(T.root);
    ctx.scene.add(T.coinMesh);
    // (the coins stand still until she's in: tick() spins them)
    T.coins.forEach((c, i) => { _m.compose(_p.set(c.x, 1.05, c.z), _q.identity(), _s.setScalar(c.value > 1 ? 1.25 : 1)); T.coinMesh.setMatrixAt(i, _m); });
    T.coinMesh.instanceMatrix.needsUpdate = true;
    cullClusters(T, true);
    emit("town:built", { town: en.def.id, exitS: en.exitS, ms: +en.ms.toFixed(1), steps: en.steps, worst: +en.worst.toFixed(2) });
}
function dropBuilt(en) {
    const i = S.built.indexOf(en);
    if (i >= 0) S.built.splice(i, 1);
    disposeAmbient(en);
    if (en.T) { en.T.dispose(); en.T = null; }
    en.gen = null;
}
function dropAllBuilt(keepHome = false) { const h = keepHome ? home() : null; for (const en of [...S.built]) if (en !== S.att && !(h && en.def.base === TOWNS[h.town] && Math.abs(en.exitS - h.exitS) < 1)) dropBuilt(en); }
/** HOME (ci/hometown: Lulu lives in Midwood): the route's first exit — Midwood's — at its fixed metre (a pure function of
 *  the road: the same on every run, screen and title). null until the world exists. */
let HOME = null;
function home() {
    if (HOME) return HOME;
    if (!ctx.world || !ctx.world.highway) return null;
    const r = routeAt(0);
    HOME = { town: r.town.id, exitS: exitFitS(r.s, [r.town]) };
    return HOME;
}
/** Per frame on the highway: build what's coming, cull what stands, drop what's behind — and drive in. */
function tendAttached(dt) {
    const s = hwS();
    for (const e of X.exits) if (e.s - s < BUILD_FROM && s - e.s < ACC1) planBuilds(e);
    // (a town someone is prebuilding — the home town on the title, a warp's target — isn't dropped for being far off)
    const now = performance.now();
    for (const en of [...S.built]) if (en !== S.att && !(en.pin && now - en.pin < 3000) && (Math.abs(s - en.exitS) > DROP_PAST + BUILD_FROM || s - en.exitS > DROP_PAST)) dropBuilt(en);
    advanceBuilds();
    if ((S.cullA = (S.cullA || 0) + 1) % 3 === 0) for (const en of S.built) if (en.ready && en !== S.att) withPlan(en, () => { cullClusters(en.T, true); cullStanding(en); });
    // (a few light minivans on its nearest streets, so the town she's driving toward isn't frozen — ambient.js)
    if (!partyTowns()) tendAmbient(S.built, S.att, dt, en => { const P0 = herPos(), p = localIn(en.at, P0.x, P0.z, {}), b = en.box;
        return Math.hypot(Math.max(b.x0 - p.x, 0, p.x - b.x1), Math.max(b.z0 - p.z, 0, p.z - b.z1)); }, withPlan);
}
/** Where she is along the highway (in a town: by the exit she took). */
const hwS = () => S.active ? S.exitS + (S.att ? S.att.cu : 0) : ctx.car.s;
/** Where she is (on foot: her, not the car she left). */
function herPos() { const f = ctx.foot && ctx.foot.active && ctx.foot.pos; return f || ctx.car.pos; }
const footing = () => !!(ctx.foot && ctx.foot.active && ctx.foot.pos && ctx.state === "footRun");
/** Out of an attached town by her own wheels / feet: back past the line by the T (or off cross-country). */
function attachedOut() {
    if (S.trans || !(ctx.state === "playing" && !(ctx.foot && ctx.foot.active) || footing())) return false;
    const P0 = herPos(), p = localIn(S.att.at, P0.x, P0.z, {}), a = onApproach(S.def, p, {});
    // (hysteresis: in at 4 m past the line / 2 m inside the footprint, out at 2 m / 20 m outside it and 25 m off the approach)
    const out = (a.lat < 9 && a.along < 2) || (!inBox(S.att.box, p, BOX_PAD) && !(a.lat < 25 && a.along > -6 && a.along < a.len + 4));
    if (out) leaveTown("highway", { drove: true });
    return out;
}
/** Into an attached town on foot (driving in is the update hook's): an always-on actor, it runs while she walks. */
function attachedFootIn() {
    if (S.active || S.trans || !S.built.length || !footing()) return;
    const P0 = herPos(), en = attachedAt(P0.x, P0.z);
    if (en) enterTown(null, { entry: en, drove: true });
}
/** In an attached town: is a sample point (world) hidden from the camera by this town's own blocks? */
const _ca = {}, _cb = {};
function hiddenByTown(x, z) {
    if (!S.att || !S.occ) return false;
    const c = ctx.camera.position;
    localIn(S.att.at, c.x, c.z, _ca); localIn(S.att.at, x, z, _cb);
    return sightBlocked(_ca.x, _ca.z, _cb.x, _cb.z, S.occ);
}
/** world.cullChunks asks (keepHighway): draw this highway chunk? Not when the town's blocks hide all of it (re-judged
 *  every few frames per chunk). */
const _hp = {};
function seeChunk(c) {
    const now = ctx.frames || 0;
    if (c.townSee && now - c.townSee.f < 6) return c.townSee.v;
    let v = false;
    const hw = ctx.world.highway;
    for (let i = 0; i <= 4 && !v; i++) for (const d of [-30, 0, 30]) {
        hw.point(c.s0 + (c.s1 - c.s0) * i / 4, d, _hp);
        if (!hiddenByTown(_hp.x, _hp.z)) { v = true; break; }
    }
    c.townSee = { f: now, v };
    return v;
}
/** The ready attached town she's in (on its approach past the line, or inside its footprint), or null. */
function attachedAt(x, z, line = 4) {
    const p = {}, a = {};
    for (const en of S.built) {
        if (!en.ready) continue;
        localIn(en.at, x, z, p);
        onApproach(en.def, p, a);
        if ((a.lat < 7 && a.along > line && a.along < a.len + 2) || inBox(en.box, p, -2)) return en;
    }
    return null;
}

// ── in / out ─────────────────────────────────────────────────────────────
function enterTown(e = null, opts = {}) {
    if (S.active) return false;
    const base = opts.entry ? opts.entry.def.base : e ? e.town : (opts.town ? TOWNS[opts.town] : townFor(0));
    if (!base || !S.ok[base.id]) return false;
    const car = ctx.car, G = ctx.G, world = ctx.world, tr = ctx.traffic;
    // ATTACHED (she drove in off the interchange: opts.entry — the town's already built there), or put there by a warp
    // (opts.exitS: the same placement, built now), or the stand-alone town at its own far origin (tests / debug)
    let en = opts.entry || null;
    if (!en && opts.exitS != null && opts.attach !== false && base.attach) {
        const k = branchK(base, opts.exitS);
        en = entryOf(opts.exitS, k);
        if (!en) {
            const P = placeAt(base, opts.exitS, k);
            if (P) { en = Object.assign(P, { e: null, T: null, gen: null, ready: false, box: boxOf(P.def), ms: 0, steps: 0, worst: 0 }); S.built.push(en); }
        }
        if (en && !en.ready) advanceBuilds(Infinity, en);
        if (en && !en.ready) en = null;
        // (a warp lands her by the town: the highway's chunks round the interchange stream in, in slices — district.highwayS)
    }
    const def = en ? en.def : base;
    setPlan(def, en ? en.at : null);
    S.def = S.lastDef = def;
    S.att = en; S.at = en ? en.at : null;
    S.exitS = en ? en.exitS : e ? e.s : (opts.exitS != null ? opts.exitS : car.s);
    const T = S.T = en ? en.T : buildTown(def);
    if (en) { T.root.visible = true; T.coinMesh.visible = true; for (const m of T.ground || []) m.visible = true; }
    setupParked(T);
    if (!en) { ctx.scene.add(T.root); ctx.scene.add(T.coinMesh); }
    S.road = new TownRoad(world.highway);
    S.chunk = makeChunk(T);
    S.occ = PL.OCCLUDERS;
    world.setDistrict({ road: S.road, chunks: [S.chunk], ground: def.ground, keepHighway: !!en, see: en ? seeChunk : null, highwayS: en ? en.exitS + en.cu : null });
    S.active = true;
    S.savedTraffic = tr.config.enabled;
    tr.config.enabled = false;
    if (en && opts.drove) puppetHighway(); else tr.clear();
    if (opts.at) {
        // put down at a spot (a warp / the home start, ci/hometown): standing still there, facing at.h
        const h = opts.at.h != null ? opts.at.h : 0, v = Math.max(0, opts.speed || 0);
        car.place(opts.at.x, opts.at.z, h);
        car.vx = Math.sin(h) * v; car.vz = Math.cos(h) * v; car.vF = v;
        const n = S.road.nearest(opts.at.x, opts.at.z, null, {});
        car.s = n.s; car.d = n.d;
    } else if (en && opts.drove) {
        // she drove in: nothing moves — the road under her is the town's now (the approach is the cross road she's on)
        const n = S.road.nearest(car.pos.x, car.pos.z, null, {});
        car.s = n.s; car.d = n.d;
    } else {
        // she comes off the ramp onto the entry street, carrying her speed
        const st = street(def.entry.street), along = def.entry.along, h = wH(headingOf(st, def.entry.dir || 1));
        const v = Math.max(8, Math.min(19, opts.speed != null ? opts.speed : car.speed));
        const p = S.road.point(st.base + along, def.entry.d, {});
        car.place(p.x, p.z, h);
        car.vx = Math.sin(h) * v; car.vz = Math.cos(h) * v; car.vF = v;
        car.s = st.base + along; car.d = def.entry.d;
    }
    G.lastS = Infinity;                       // no distance score on town streets (it's not a trip, it's a detour)
    // the town's drivers
    C.slow = new Set((def.bumps || []).map(b => street(b.street)).filter(Boolean).map(s => s.id));
    C.routes = {};
    for (const [kind, names] of Object.entries(def.routes || {})) C.routes[kind] = new Set(names.map(n => street(n)).filter(Boolean).map(s => s.id));
    for (const hz of def.hazards || []) {
        const hs = street(hz.street);
        if (!hs) continue;
        hazards(spawnHazard(hs.id, hz.along, hz.d, hz.kind));
        if (!T.spots.hazards) { const p = S.road.point(hs.base + hz.along, hz.d, {}); T.spots.hazards = toLocal(p.x, p.z, {}); }
    }
    const party = partyTowns();
    // (she drove in past the town's ambient minivans: they carry on as real drivers, counted against its traffic)
    const pre = en && opts.drove && !party ? convertAmbient(en) : 0;
    if (en) disposeAmbient(en);
    if (!party) for (const [kind, n] of Object.entries(def.traffic || {})) for (let i = kind === AMB.KIND ? Math.min(pre, n) : 0; i < n; i++) {
        const sp = randomSpot(36, kind, !!(en && opts.drove)) || randomSpot(36, kind);
        if (sp) spawnDriver(kind, sp.street, sp.along, sp.dir, { speed: 6 });
    }
    // (a 🎉 party: seeded townsfolk + geese; the e-bikes start in seeded spots and then ride their own way on each
    // friend's screen — personal, like the geese that charge HER: nothing anyone else's world depends on)
    if (party) ctx.openworld.seeded(def.id, () => startLife(T, def));
    else startLife(T, def);
    addActor({ foot: true, update: dt => { try { tick(dt); } catch (err) { console.error("[town] tick", err); } return S.active; } });
    // the trip bar becomes the street chip
    S.savedTrip = ctx.trip;
    ctx.trip = { progress: () => 1, label: () => { const s = streetOfS(ctx.car.s); return `${def.emoji} ${s ? s.name : def.name} · ${def.name.toUpperCase()}`; } };
    const icon = document.querySelector(".trip-to");
    S.savedIcon = icon ? icon.textContent : null;
    if (icon) icon.textContent = def.emoji;
    S.savedPullOver = G.noPullOver;
    G.noPullOver = true;                      // there's no parking anyway
    S.visits++;
    if (ctx.cam && !(en && opts.drove)) ctx.cam.snap();
    // (quiet: she's simply there — the home start, a warp — no welcome sign, no lines, no visit counted)
    if (!opts.quiet) {
        H.banner(`<b>${def.emoji} ${def.lines.SIGNS.welcome[0]}</b><small>${def.lines.SIGNS.welcome.slice(1).join(" · ")}</small>`, 2800, { key: "town", prio: 2 });
        later(1.4, () => luluSay("enter", true));
        later(5, () => gossip("enter"));
        if (!S.bubbe.has(def.id) && def.lines.BUBBE) { S.bubbe.add(def.id); later(11, () => phoneText(def.lines.BUBBE, 0)); later(26, () => phoneText(def.lines.BUBBE, 1, true)); }
    }
    emit("town:enter", { town: def.id, exitS: S.exitS, attached: !!en, drove: !!(en && opts.drove), quiet: !!opts.quiet, home: !!opts.home });
    if (!opts.quiet) emit("stat", { id: "townVisits", n: 1 });
    return true;
}
function hazards(c) {
    if (!c) return;
    const m = new THREE.MeshStandardMaterial({ color: "#FFB300", emissive: "#FFB300", emissiveIntensity: 2.5 });
    const g = new THREE.SphereGeometry(0.09, 8, 6), grp = new THREE.Group();
    for (const sx of [-0.8, 0.8]) for (const sz of [-2.48, 2.48]) { const b = new THREE.Mesh(g, m); b.position.set(sx, 0.9, sz); grp.add(b); }
    c.obj.add(grp);
    S.haz.push({ c, grp, m, g });
}
function leaveTown(why = "highway", opts = {}) {
    if (!S.active) return false;
    const def = S.def, car = ctx.car, G = ctx.G, world = ctx.world, tr = ctx.traffic;
    stopLife();
    SFX.rumbleStop();
    for (const h of S.haz) { if (h.grp.parent) h.grp.parent.remove(h.grp); h.m.dispose(); h.g.dispose(); }
    S.haz.length = 0;
    clearDrivers();
    clearParked();
    const drove = !!(S.att && why === "highway" && opts.drove);
    // (driving out of a town that stands by the road: the highway puppets carry on, and so does a cruiser on her tail)
    // (her own parked car stays hers — only while she's out walking: foot's live stub, nothing stale)
    const walking = !!(ctx.foot && ctx.foot.active), stub = walking && ctx.foot.debug && ctx.foot.debug.F && ctx.foot.debug.F.car ? ctx.foot.debug.F.car.stub : null;
    for (const c of [...tr.cars]) if (!((stub && c === stub) || (c.data && drove && (c.data.hwPuppet || (c.data.law && !c.hit))))) tr.remove(c);
    for (const c of tr.cars) unpuppet(c);
    tr.config.enabled = S.savedTraffic;
    world.setDistrict(null);
    S.active = false;
    // an attached town stays standing where it is (she can see it — and come back); a stand-alone one goes
    if (S.T && !S.att) S.T.dispose();
    S.T = null;
    const att = S.att;
    S.att = null;
    if (S.extras) { ctx.scene.remove(S.extras); S.extras = null; }
    ctx.trip = S.savedTrip;
    const icon = document.querySelector(".trip-to");
    if (icon && S.savedIcon != null) icon.textContent = S.savedIcon;
    G.noPullOver = S.savedPullOver;
    S.timers.length = 0;
    S.footYaw = null;
    const F = ctx.foot && ctx.foot.active && ctx.foot.debug && ctx.foot.debug.F && ctx.foot.debug.F.pos ? ctx.foot.debug.F : null;
    if (why === "warp") {
        // (a warp out: the caller puts her down somewhere else right away — nothing to place here)
    } else if (!drove && F && att && why !== "reset") {
        // ON FOOT in a town that stands by the road (a scene, a party hand-back…): she stays exactly where she is — only the
        // road under her (and her car) is the highway's again; she walks back in / the scene places her
        const hint = S.exitS + att.cu, n = world.highway.nearest(car.pos.x, car.pos.z, hint, {}), m = world.highway.nearest(F.pos.x, F.pos.z, hint, {});
        car.s = n.s; car.d = n.d; F.s = m.s; F.d = m.d; G.lastS = m.s;
    } else if (drove) {
        // she drove out along the approach: the highway's road under her again, nothing moves (she's on the cross road
        // by its T — the on-ramp is just past it)
        const hint = S.exitS + (att ? att.cu : 0), n = world.highway.nearest(car.pos.x, car.pos.z, hint, {});
        car.s = n.s; car.d = n.d;
        G.lastS = n.s;
        // (the cruisers that followed her out: their road position from the highway too — a town s is 500 km off)
        for (const c of tr.cars) if (c.data && c.data.law) { const m = world.highway.nearest(c.x, c.z, hint, {}); c.s = m.s; c.d = m.d; }
        // (on foot: her own road position too — a town s as a hint would send the highway's search 500 km down the road)
        const F = ctx.foot && ctx.foot.active && ctx.foot.debug && ctx.foot.debug.F;
        if (F && F.pos) { const m = world.highway.nearest(F.pos.x, F.pos.z, hint, {}); F.s = m.s; F.d = m.d; }
    } else if (why !== "reset") {
        // back on the highway: driving out, down the interchange's on-ramp (she merges in from the accel lane);
        // otherwise just past the exit, in the right lane (or on the shoulder after a wreck)
        const on = why === "highway" ? onRampSpot(S.exitS) : null;
        const s = on ? on.s : S.exitS + 190, d = on ? on.d : why === "wreck" ? 7.8 : 5.25;
        const p = world.highway.point(s, d, {});
        if (on) p.h = on.h;
        const v = why === "highway" ? Math.max(11, Math.min(20, car.speed)) : 0;
        car.place(p.x, p.z, p.h);
        car.vx = Math.sin(p.h) * v; car.vz = Math.cos(p.h) * v; car.vF = v;
        car.s = s; car.d = d;
        G.lastS = s;
        if (F) besideCar(F);              // (on foot: with her car — never left standing where the town was)
        if (ctx.cam) ctx.cam.snap();
    } else if (F && ctx.state === "footRun") {
        // a reset while she WALKS in a town. A stand-alone town is far off the road (its own origin): she and her car come to
        // the exit's shoulder. A town standing by the road: she's in a real place — she stays, the road under her is the highway's.
        if (!att) {
            const s = S.exitS + 190, p = world.highway.point(s, 7.8, {});
            car.place(p.x, p.z, p.h); car.vx = car.vz = car.vF = 0; car.s = s; car.d = 7.8;
            besideCar(F);
            if (ctx.cam) ctx.cam.snap();
        } else {
            const hint = S.exitS + att.cu, n = world.highway.nearest(car.pos.x, car.pos.z, hint, {}), m = world.highway.nearest(F.pos.x, F.pos.z, hint, {});
            car.s = n.s; car.d = n.d; F.s = m.s; F.d = m.d;
        }
        G.lastS = car.s;
    }
    // on foot: her parked car (foot's stub in the traffic) goes where her car went, its road position the highway's
    if (F && stub) for (const c of [stub]) {
        if (!att && !drove && Math.hypot(c.x - car.pos.x, c.z - car.pos.z) > 0.5) { c.x = car.pos.x; c.z = car.pos.z; c.h = car.h; }   // (by the road: it stays where she parked it)
        const m = world.highway.nearest(c.x, c.z, car.s, {}); c.s = m.s; c.d = m.d;
        if (tr.place) tr.place(c, 0);
    }
    if (why === "reset") dropAllBuilt();
    if (why === "highway") {
        H.banner(`<b>🛣️ BACK ON THE HIGHWAY</b><small>${def.name} is behind you. For now.</small>`, 2200, { key: "town", prio: 2 });
        luluSay("leave", true);
        gossip("leave", true);
    }
    emit("town:leave", { town: def.id, why, drove });
    return true;
}
/** On foot, leaving a town: put her on the kerb side of her (highway) car, standing still, with her road position from
 *  the highway (her old town s as a hint would send the highway's search 500 km down the road — and foot's "s < 4" rule
 *  then shoves her metres a frame). */
function besideCar(F) {
    const car = ctx.car, hw = ctx.world.highway, side = car.d >= 0 ? 1 : -1;
    const rx = -Math.cos(car.h) * side, rz = Math.sin(car.h) * side;
    F.pos.set(car.pos.x + rx * 2.3, 0.05, car.pos.z + rz * 2.3);
    if (F.vel) F.vel.set(0, 0, 0);
    const m = hw.nearest(F.pos.x, F.pos.z, car.s, {});
    F.s = m.s; F.d = m.d;
}
/** She drove into an attached town: the highway's plain traffic carries on down the highway behind her (its own s,
 *  which the TownRoad still answers with the highway) until it's well out of sight — instead of vanishing. Cops,
 *  party cars and anyone else's scripted cars go as before (they think in the road she's on). */
function puppetHighway() {
    const tr = ctx.traffic;
    for (const c of [...tr.cars]) {
        if (c.data && c.data.footStub) continue;              // (her own car, parked where she got out: it stays put)
        // a cruiser on her tail follows her in: law steers its units off whatever road is under them (in town: round the
        // corners, ctx.town.copRoute) — it used to vanish at the line
        if (c.data && c.data.law && !c.hit) continue;
        if (c.hit || c.ai || c.immune || (c.data && (c.data.law || c.data.party || c.data.local || c.data.partyLocal))) { tr.remove(c); continue; }
        c.data = c.data || {};
        c.data.hwPuppet = { keep: c.keep };
        c.keep = true;
        c.ai = (dt, car) => {
            car.s += car.speed * car.dir * dt;
            const P = ctx.car.pos;
            if (Math.hypot(car.x - P.x, car.z - P.z) > 520) car.data.hwPuppet.gone = true;
        };
    }
}
/** Back on the highway: a puppet that's still about is ordinary traffic again. */
function unpuppet(c) {
    const H0 = c.data && c.data.hwPuppet;
    if (!H0) return;
    c.ai = null; c.keep = H0.keep; c.data.hwPuppet = null;
}
function later(sec, fn) { S.timers.push({ at: ctx.time + sec, fn }); }
function phoneText(who, k, quiet = false) {
    if (!S.active) return;
    const msg = who.lines[k % who.lines.length];
    // (ci/polish, the pop-up budget: Bubbe's SECOND text lands in 💬 Messages only — no bubble — when the phone has an inbox)
    if (quiet && ctx.phone && ctx.phone.inbox && ctx.phone.inbox.post) { try { ctx.phone.inbox.post({ from: who.from, emoji: who.emoji, color: who.color, msg }); return; } catch (e) { /* fall through to the bubble */ } }
    try { if (ctx.phone && ctx.phone.text) ctx.phone.text({ from: who.from, emoji: who.emoji, color: who.color, msg, dur: 4.5 }); else H.toast(`${who.emoji} ${msg}`, "pink"); }
    catch (e) { H.toast(`${who.emoji} ${msg}`, "pink"); }
}

// ── per frame (an actor, so it runs driving AND on foot) ─────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
function tick(dt) {
    if (!S.active) return;
    const T = S.T, car = ctx.car, G = ctx.G;
    G.lastS = Infinity;
    for (let i = S.timers.length - 1; i >= 0; i--) if (ctx.time >= S.timers[i].at) { const t = S.timers.splice(i, 1)[0]; try { t.fn(); } catch (e) { console.error(e); } }
    tickLife(dt);
    lodDrivers(ctx.camera.position);
    tickParked(dt);
    if ((S.cullN = (S.cullN || 0) + 1) % 3 === 1) cullClusters(T);
    S.tendT -= dt;
    if (S.tendT <= 0 && !partyTowns()) { S.tendT = 1; tendDrivers(1, Object.assign({}, S.def.traffic, { cop: ctx.law && ctx.law.chasing ? 0 : (S.def.traffic.cop || 0) })); }
    for (const k of T.cranes) k.obj.rotation.y += k.speed * dt * (Math.sin(ctx.time * 0.1 + k.speed * 50) > -0.3 ? 1 : 0);
    if (T.trains.length) tickRail(T, dt, ctx.camera.position, RAIL_HOOKS);
    // coins
    const t = ctx.time;
    T.coins.forEach((c, i) => {
        _q.setFromAxisAngle(UP, t * 3 + i * 0.7);
        _m.compose(_p.set(c.x, 1.05 + Math.sin(t * 4 + i) * 0.12, c.z), _q, _s.setScalar(c.taken ? 0 : c.value > 1 ? 1.25 : 1));
        T.coinMesh.setMatrixAt(i, _m);
    });
    T.coinMesh.instanceMatrix.needsUpdate = true;
    // night: windows, lamps, pools of light
    const n = ctx.atmos && typeof ctx.atmos.night === "number" ? ctx.atmos.night : 0;
    T.mats.glow.emissiveIntensity = n * 1.7;
    T.mats.lit.emissiveIntensity = 0.2 + n * 3.6;
    T.halos.visible = T.pools.visible = n > 0.04;
    T.halos.material.opacity = Math.min(1, n * 1.3);
    T.pools.material.opacity = n * 0.55;
    for (const w of T.waters || []) w.material.map.offset.x = (t * 0.01) % 1;
    for (const h of S.haz) h.grp.visible = Math.floor(t * 1.6) % 2 === 0;
    // the highway's traffic she left behind: gone once it's well out of sight
    for (const c of [...ctx.traffic.cars]) if (c.data && c.data.hwPuppet && c.data.hwPuppet.gone) ctx.traffic.remove(c);
    // driving out of an ATTACHED town: back along the approach past the line by the T (or off cross-country) — the
    // highway's road takes over where she is
    if (S.att) { attachedOut(); return; }
    // driving out of town: the ramps
    if (ctx.state === "playing" && !S.trans && !(ctx.foot && ctx.foot.active)) {
        const st = streetOfS(car.s);
        for (const ex of S.def.exits) {
            if (!st || st.name !== ex.street) continue;
            // past the ramp's mouth AND driving outward (not just arriving there off the entry ramp)
            const out = (car.vx * Math.sin(wH(st.h)) + car.vz * Math.cos(wH(st.h))) * ex.dir;
            if ((car.s - st.base - ex.at) * ex.dir > 0 && out > 1) { beginTrans("leave"); break; }
        }
    }
}

// the B/Q: Lulu notices the first train, the group chat has opinions, doors chime as it leaves a station near her
const RAIL_HOOKS = {
    onPass(tr) { if (!LIFE.said.has("train")) { LIFE.said.add("train"); luluSay("train", true); later(3, () => gossip("train")); } emit("town:train", { line: tr.cfg.line }); },
    onDepart(tr) {
        const c = ctx.camera.position, w = toWorld(tr.obj.position.x, tr.z, {}), d = Math.hypot(w.x - c.x, w.z - c.z);
        if (d < 90) SFX.chime(Math.max(0.2, 1 - d / 90));
    },
};

// ── culling: a block of houses hides everything behind it ──────────────
// (the frustum alone sees "through" the whole town from any street). Per merged cluster: hidden when
// it's past its look's distance, or when every sample point is behind some other block.
const MAX_D = { flat: 140, solid: 300, glow: 230, lit: 230, glass: 110, far: 700, farglow: 700 };
// (a town STANDING by the road, seen from outside it — the ramp, the highway: its edge rows of woods / parked cars carry
//  further, so it reads as a town ahead; its own outer blocks still hide what's behind them)
const MAX_D_OUT = { flat: 240, solid: 380, glow: 260, lit: 260, glass: 110, far: 700, farglow: 700 };
const SAMPLES = [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]];
/** A cluster's sample points (local): its cell's corners / edges / centre, PLUS every street point inside it (the kerbs,
 *  the parking lanes, the centre line, every 10 m) — what a cluster shows lines the streets, and a cell's own 9 points can
 *  all sit behind blocks while a parked car in it stands in plain sight down a cross street (that hid ~1 in 15 of them). */
function samplesOf(m, T) {
    if (m.userData.samples) return m.userData.samples;
    const c = m.userData.cell, out = SAMPLES.map(([u, v]) => [c.x0 + (c.x1 - c.x0) * u, c.z0 + (c.z1 - c.z0) * v]);
    // (and the parked cars themselves, in the clusters they're baked into)
    if (m.userData.townLook === "flat") for (const pc of T.pcars) if (pc.x >= c.x0 && pc.x < c.x1 && pc.z >= c.z0 && pc.z < c.z1) out.push([pc.x, pc.z]);
    const p = {};
    for (const st of PL.STREETS) {
        const ds = [0, st.park || st.curb || 3, -(st.park || st.curb || 3)];
        if (st.boulevard && st.svcPark) ds.push(st.svcPark, -st.svcPark);
        for (let a = st.a0; a <= st.a1; a += 10) for (const d of ds) {
            streetPoint(st, a, d, p);
            if (p.x >= c.x0 - 1 && p.x <= c.x1 + 1 && p.z >= c.z0 - 1 && p.z <= c.z1 + 1) out.push([p.x, p.z]);
        }
    }
    return (m.userData.samples = out);
}
const _sw = {};
function cullClusters(T, outside = false) {
    const MD = outside ? MAX_D_OUT : MAX_D;
    const cam = toLocal(ctx.camera.position.x, ctx.camera.position.z, {});
    let shown = 0;
    for (const m of T.clusters) {
        const c = m.userData.cell;
        if (!c) continue;
        const nx = Math.max(c.x0, Math.min(c.x1, cam.x)), nz = Math.max(c.z0, Math.min(c.z1, cam.z));
        const d = Math.hypot(nx - cam.x, nz - cam.z);
        let vis = d <= (MD[m.userData.townLook] || 250);
        if (vis && d > 24) {
            vis = false;
            for (const [px, pz] of samplesOf(m, T)) if (!sightBlocked(cam.x, cam.z, px, pz) && !(outside && S.att && hiddenByTown(toWorld(px, pz, _sw).x, _sw.z))) { vis = true; break; }
        }
        m.visible = vis;
        if (vis) shown++;
    }
    T.shown = shown;
}

// ── hooks ────────────────────────────────────────────────────────────────
function eligible() {
    const G = ctx.G;
    if (partyTowns()) return !G.tutorial;
    return G.mode === "cruise" && ctx.enabled("town") && !G.tutorial && !(ctx.party && ctx.party.active);
}
/** Plan the route's exits from s0 to s1 (each once; an exit FIT slides past the next stop's start is skipped). */
const PLAN_AHEAD = 13000;        // (a run starting at the lap line knows both towns' exits — Lakewood at 12 km; and the next exit is always known)
function planRoute(s0, s1) {
    const last = X.exits[X.exits.length - 1];
    let k = last && last.routeK != null ? last.routeK + 1 : routeFrom(s0);
    for (let n = 0; n < 8; n++, k++) {
        const r = routeAt(k);
        if (r.s > s1) break;
        if (last && r.s <= last.s) continue;
        const e = planExit(r.s, [r.town]);
        if (e) e.routeK = k;
    }
}
hook("runStart", G => {
    if (S.active) leaveTown("reset");
    dropAllBuilt(true);          // (home stays standing: the run starts there — ci/hometown)
    // (on foot: the line both ways, and the standing towns still build — the update hook only runs while she drives)
    addActor({ foot: true, update: dt => { try { if (footing() && (S.built.length || X.exits.length)) tendAttached(dt); if (S.active) { if (S.att && footing()) attachedOut(); } else attachedFootIn(); } catch (err) { console.error("[town] foot line", err); } return true; } });
    S.trans = null; setFade(0); S.commit = null;
    clearExits();
    if (S.cue) { S.cue = ""; H.prompt(""); }
    S.bubbe.clear();
    if (eligible()) {
        // the route (towns/index.js ROUTE): each town's own exit, at fixed metres — the same for every run and every friend.
        // Plan from just behind where this run starts (an exit she starts beside still has its ramps) to two exits ahead.
        planRoute(Math.max(0, (G.startS || 0) - 1500), (G.startS || 0) + PLAN_AHEAD);
        for (const e of X.exits) if (e.s > (G.startS || 0) - 200) { load(e.town); break; }
    }
}, 20);
on("title", () => { if (S.active) leaveTown("reset"); dropAllBuilt(true); S.trans = null; S.commit = null; setFade(0); clearExits(); cue(null); });
// (on the title — or any scene where nothing drives — a standing town is still culled for the camera: the title shot looks
//  down E 34th St at Lulu's house in Midwood)
// (no hook runs on the title, so the town keeps a light idle loop of its own — it does nothing while she drives / walks)
function idle() {
    requestAnimationFrame(idle);
    try {
        if (S.active || ctx.state === "playing" || ctx.state === "footRun" || !ctx.world || !ctx.camera) return;
        // HOME is built from boot, in slices, while the title is up (its models load first) — the game opens on Lulu's street
        if (ctx.state === "title" && ctx.enabled("town") && !(ctx.party && ctx.party.active)) { const h = home(); if (h) ctx.town.prebuild(h.town, h.exitS); }
        if (S.built.length && (S.cullT = (S.cullT || 0) + 1) % 3 === 0) for (const en of S.built) if (en.ready) withPlan(en, () => { cullClusters(en.T, true); cullStanding(en); });
    } catch (e) { console.error("[town] idle", e); }
}
requestAnimationFrame(idle);

// ── the ramp cue: a light, in-the-moment prompt (no popup) while she's in the decel lane / on the ramp ──
const RP = {};
function cue(e, ph, text = null) {
    let html = text || "";
    if (!text && e && ph && ph.phase && ctx.state === "playing" && ctx.car.speed > 3) {
        const [a, b] = e.towns, no = t => t.highway.no ? `<b>${t.highway.no}</b> ` : "";
        if (ph.phase === "decel") html = e.two
            ? `🛣️ EXIT ONLY · ${no(a)}${a.highway.short || a.name} · ${no(b)}${b.highway.short || b.name} <small>· steer left to stay on the highway</small>`
            : `🛣️ EXIT ONLY · ${no(a)}${a.highway.short || a.name} <small>· steer left to stay on the highway</small>`;
        else if (ph.phase === "ramp") html = e.two
            ? `↖ ${no(a)}${(a.highway.label || a.name).toUpperCase()} &nbsp;·&nbsp; ${no(b)}${(b.highway.label || b.name).toUpperCase()} ↗`
            : `↗ ${no(a)}${(a.highway.label || a.name).toUpperCase()}`;
    }
    if (html === (S.cue || "")) return;
    const G = ctx.G;
    if (html && !S.cue) { S.cuePull = G.noPullOver; G.noPullOver = true; }      // (no 🅿️ pull-over prompt fighting it on the ramp)
    if (!html && S.cue && G) G.noPullOver = S.cuePull;
    S.cue = html;
    H.prompt(html);
}

// (the driving update only runs while she drives: if the state changes while the black is still lifting — a knock-out
//  on the ramp, a scene — finish lifting it from here, or the screen stays black until she next drives)
hook("hud", dt => { const tr = S.trans; if (tr && tr.phase === "in" && ctx.state !== "playing") tickTrans(dt); });
hook("update", (dt, P, controlsOn) => {
    tickTrans(dt);
    if (S.built.length || X.exits.length) { try { tendAttached(dt); } catch (err) { console.error("[town] attached", err); } }
    if (S.active || !X.exits.length) return;
    const car = ctx.car;
    // driving into an attached town: past the line on its approach (or inside it, however she got there)
    if (ctx.state === "playing" && !S.trans && S.built.length) {
        const en = attachedAt(car.pos.x, car.pos.z);
        if (en) { S.commit = null; cue(null); enterTown(null, { entry: en, drove: true }); return; }
    }
    // plan the next exit well ahead (before its chunks are built), drop the ones far behind
    const last = X.exits[X.exits.length - 1];
    if (eligible() && car.s > last.s - PLAN_AHEAD) planRoute(last.s, car.s + PLAN_AHEAD);
    if (ctx.state !== "playing" || !controlsOn || S.trans) { if (S.cue) cue(null); return; }
    // committed to a branch: she drives on down it to the STOP sign at its T-junction (the gas station, the
    // welcome sign, the first houses) and the town fades in there — or as soon as she leaves the branch / dawdles
    const K = S.commit;
    if (K) {
        const b = K.e.branches[K.k], u = car.s - K.e.s;
        const off = exitAt(car.s) !== K.e || Math.abs(car.d - b.dOf(Math.min(u, b.stop))) > RAMP_HALF + 5;
        // (an attached town is built and standing at the end of this branch: no fade — she drives on in, through the T)
        const en = entryOf(K.e.s, K.k);
        if (en && en.ready) { if (off || u > b.stop + 30) { S.commit = null; cue(null); } return; }
        if (u >= b.stop - 16 || off || ctx.time - K.t > 7) {
            S.commit = null; cue(null);
            if (en && !en.ready) { advanceBuilds(Infinity); if (en.ready) return; }
            beginTrans("enter", { s: K.e.s, town: b.town });
        }
        return;
    }
    const e = exitAt(car.s);
    // (both towns' models: they both stand at the interchange, built ahead — tendAttached)
    for (const x of X.exits) if (x.s - car.s < BUILD_FROM + 600 && car.s - x.s < ACC1) for (const t of x.towns) if (t.attach) load(t);
    if (e && e.s - car.s < 900) load(e.town);
    const ph = e ? rampPhase(e, car.s, car.d, RP) : null;
    cue(e, ph);
    if (!ph || !ph.phase) return;
    for (const t of e.towns) load(t);                 // she's heading for the ramp: every town it offers
    if (ph.phase !== "branch") return;
    const town = e.branches[ph.branch].town;
    cue(null);
    if (ctx.hustle && ctx.hustle.job) { ctx.hustle.end("quit", `You took the ${town.name} exit. Nobody gets anywhere on time from there.`); return; }
    e.used++;
    emit("town:exit", { town: town.id, s: e.s, no: town.highway.no || null });
    S.commit = { e, k: ph.branch, t: ctx.time };
    cue(e, ph, `➡️ <b>${(town.highway.label || town.name).toUpperCase()}</b> <small>· stop sign ahead</small>`);
    for (const t of e.towns) load(t);
});

// Out of hearts in town: NOTHING special — the knock-out stands her up right there, beside her car, on the street she
// crashed on (core's recoverFromWreck → foot's "knockout" start works on a town street like anywhere else). She used to
// be towed to the highway behind a black fade that only cleared once she drove again.
// any scene the town can't host (jail, the ER, a cutscene set…): put her back on the highway first
on("state", ({ to }) => {
    if (!S.active) return;
    if (to === "title" || to === "gameover") { leaveTown("reset"); return; }
    if (!TOWN_OK.has(to)) leaveTown("quiet");
});
on("honk", () => { if (S.active) honked(); });
on("crash", e => {
    if (!S.active || !e || !e.car || !(e.car.data && e.car.data.town)) return;
    if (e.car === C.patrol && e.impact > 3) crime("RAMMING A POLICE CRUISER", "🚨 YOU HIT THE PATROL CAR!", 2);
    else if (e.impact > 4) gossip("crash");
});
on("streets:carjack", e => {
    if (!S.active) return;
    gossip("jack");
    if (patrolSees(48) && !(e && e.witnessed)) crime("GRAND THEFT MINIVAN", "🚨 THE PATROL SAW THAT!", 2);
});
on("cop:chase", e => { if (S.active && e && !e.active && e.result === "escaped") { luluSay("lost", true); emit("stat", { id: "townEscapes", n: 1 }); } });
on("foot:start", () => {
    if (!S.active) return;
    S.footYaw = null;
    // her car stays where she left it, whichever street she walks to
    const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F;
    if (F && F.car && F.car.stub) F.car.stub.keep = true;
});

// a carjackable town minivan (streets' table of rides)
on("boot", () => {
    const R = ctx.streets && ctx.streets.rides;
    if (R && R.van && !R.town_van) R.town_van = Object.assign({}, R.van, { model: "town_minivan" });
    if (R && R.sedan && !R.town_carsvc) R.town_carsvc = Object.assign({}, R.sedan, { model: "sedan", label: "🚕 JACK THE CAR SERVICE" });
    // the big ones too: Lakewood's school bus, Midwood's city bus and the alternate-side sweeper
    const HEAVY = { top: 0.7, acc: 0.5, grip: 0.8, brake: 0.6 };
    if (R && !R.town_bus) R.town_bus = { model: "roadevents_school_bus", label: "🚌 JACK THE SCHOOL BUS", vtype: "bus", feel: "heavy", half: 1.26, fwd: 3.9, len: 1.0, y: [0.6, 2.4], paint: "BusYellow", handling: HEAVY };
    if (R && !R.town_citybus) R.town_citybus = { model: "foot_bus", label: "🚌 JACK THE CITY BUS", vtype: "bus", feel: "heavy", half: 1.26, fwd: 4.3, len: 1.0, y: [0.6, 2.4], paint: "BusWhite", handling: HEAVY };
    if (R && !R.town_sweeper) R.town_sweeper = { model: "town_mw_sweeper", label: "🧹 JACK THE STREET SWEEPER", vtype: "car", feel: "heavy", half: 1.15, fwd: 1.0, len: 1.0, y: [0.6, 2.0], paint: "SweeperBody", handling: { top: 0.55, acc: 0.5, grip: 0.9, brake: 0.7 } };
    const CAM = ctx.streets && ctx.streets.cams;
    if (CAM) { if (!CAM.roadevents_school_bus) CAM.roadevents_school_bus = { d: 4.2, h: 1.9 }; if (!CAM.town_mw_sweeper) CAM.town_mw_sweeper = { d: 1.2, h: 0.8 }; }
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(talkSpot);
    // the phone: the local news — a pinned row in 💬 Messages, not an app of its own (the phone stays one 3 × 3 screen;
    // an older phone without pins gets the app)
    const kvVisible = () => !(ctx.party && ctx.party.active) || !!S.active;      // (🌍 Free Roam: in a town)
    const kvNew = () => (LIFE.live.length - S.readLive > 0 ? LIFE.live.length - S.readLive : null);
    if (ctx.phone && ctx.phone.addPin) {
        try {
            ctx.phone.addPin({ id: "town", order: 70, visible: kvVisible,
                row: () => {
                    const L = (S.def || S.lastDef || townFor(0)).lines, top = LIFE.live[0] || L.KVETCH[0];
                    return { icon: "🗞️", color: "#5E35B1", title: L.KVETCH_TITLE || "The Kvetch", sub: top ? top.h : "local news nobody asked for", badge: kvNew() };
                },
                render(el) { S.readLive = LIFE.live.length; el.innerHTML = kvetchHtml(); } });
        } catch (e) { console.warn("[town] phone pin", e); }
    } else if (ctx.phone && ctx.phone.addApp) {
        try {
            ctx.phone.addApp({ id: "town", icon: "🗞️", name: "Kvetch", order: 70, color: "#5E35B1", color2: "#B39DDB",
                visible: kvVisible, badge: kvNew,
                render(el) { S.readLive = LIFE.live.length; el.innerHTML = kvetchHtml(); } });
        } catch (e) { console.warn("[town] phone app", e); }
    }
});
function kvetchHtml() {
    const L = (S.def || S.lastDef || townFor(0)).lines;
    const items = [...LIFE.live.slice(0, 6), ...L.KVETCH];
    // the phone's row style (.lp-row / .lp-tx): focusable rows, so a controller can scroll the feed
    return `<div class="town-kvetch"><div class="lp-note">🗞️ <b>${L.KVETCH_TITLE || "The Kvetch"}</b> · local news nobody asked for</div>${items.map((i, k) =>
        `<button class="btn lp-row"><span class="lp-av">${k < LIFE.live.length ? "🚨" : "📰"}</span><span class="lp-tx"><b>${i.h}</b><small>${i.b}</small></span></button>`).join("")}</div>`;
}

// ── on foot: a steady walking frame on a grid ────────────────────────────
function footYaw(F, roadH, dt) {
    const fy = S.footYaw || (S.footYaw = { h: snapTo(ctx.car.h, roadH), still: 0 });
    const moving = Math.hypot(input.moveX || 0, input.moveY || 0) > 0.2;
    fy.still = moving ? 0 : fy.still + dt;
    if (fy.still > 0.6 && F.lulu && F.lulu.obj) {
        // stopped for a moment: swing the frame onto this street, the way she's facing
        const want = snapTo(F.lulu.obj.rotation.y, roadH);
        let d = want - fy.h; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
        fy.h += d * Math.min(1, dt * 3);
    }
    return fy.h;
}
function snapTo(h, roadH) {
    let best = roadH, bd = 9;
    for (const c of [roadH, roadH + Math.PI]) { let d = h - c; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; if (Math.abs(d) < bd) { bd = Math.abs(d); best = c; } }
    return best;
}

// ── the service ──────────────────────────────────────────────────────────
ctx.town = {
    get active() { return S.active; },
    get id() { return S.def ? S.def.id : null; },
    get name() { return S.def ? S.def.name : null; },
    /** The street she's on (name) while in town. */
    get street() { const s = S.active && streetOfS(ctx.car.s); return s ? s.name : null; },
    /** Street names of the current (or next) town. */
    /** The highway distance she left at (the town keeps the highway's look and weather from there). */
    get highwayS() { return S.active ? S.exitS : null; },
    get streets() { return (S.def ? PL.STREETS : setPlan(townFor(0)).STREETS).map(s => s.name); },
    /** The buildings that block a line of sight: world-space rects {x0, z0, x1, z1}. */
    get occluders() { return PL.OCCLUDERS.map(r => { const a = toWorld(r.x0, r.z0, {}), b = toWorld(r.x1, r.z1, {}); return { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) }; }); },
    /** The current town's plan (streets, blocks, nodes; local frame + ORIGIN) and its landmark spots (local), or null. */
    get plan() { return S.active ? PL : null; },
    get spots() { return S.active && S.T ? S.T.spots : null; },
    get coins() { return S.active && S.T ? S.T.coins : null; },
    /** The houses people live in (features/homes): [{ key (model), x, z (model origin), rot, ux, uz, nx (toward the street), nz, lotX, lotZ, w, dark, face }]
     *  and the driveway minivans [{ x, z, rot }] — WORLD coords, in build order (stable per town). */
    get homes() { return S.active && S.T && S.T.homes ? S.T.homes.map(h => spotWorld(h)) : []; },
    get drives() { return S.active && S.T && S.T.drives ? S.T.drives.map(d => { const w = toWorld(d.x, d.z, {}); return { x: w.x, z: w.z, rot: wH(d.rot) }; }) : []; },
    /** The townsfolk you can talk to: [{id, name, x, z}] (world). */
    people: () => S.active ? LIFE.people.filter(r => r.lines).map(r => ({ id: r.id, name: r.name, x: r.p.obj.position.x, z: r.p.obj.position.z })) : [],
    /** Go into town now (no ramp; tests / debug). opts: { town: "lakewood" | "midwood", exitS, speed }. Its models must be
     *  loaded (await ctx.town.load(id)). */
    enter(opts = {}) {
        // (already in ANOTHER town — a day starts at home in Midwood now (ci/hometown), so a test / debug jump to Lakewood
        //  comes from inside a town: leave it first, as warp() does; the game's own callers leave first themselves)
        if (S.active && opts.town && S.def && S.def.id !== opts.town) leaveTown("reset");
        return enterTown(null, opts);
    },
    /**
     * Put her in the attached town `town` at the interchange `exitS` now, at `at` ({x, z, h} world; else the entry street),
     * leaving the town she's in first (no cut of its own — wrap it in ctx.dissolve if you want one). opts as enter():
     * { town, exitS (default: the home exit for the home town), at, speed: 0, quiet, home }. The state is the caller's.
     * → true once she's there.
     */
    warp(opts = {}) {
        const def = TOWNS[opts.town];
        if (!def || !def.attach) return false;
        const h = home(), exitS = opts.exitS != null ? opts.exitS : (h && h.town === def.id ? h.exitS : null);
        if (exitS == null || !S.ok[def.id]) return false;
        if (S.active) leaveTown("warp");
        return enterTown(null, Object.assign({ speed: 0 }, opts, { exitS }));
    },
    /** Back to the highway now. why: "highway" (default) | "quiet" | "reset" | "warp" (nothing placed: you put her down next). */
    leave(why = "highway") { return why === "quiet" && S.active ? dissolve(() => leaveTown(why)) : leaveTown(why); },
    load: id => load(id ? TOWNS[id] : townFor(0)),
    /** Is this town's model set loaded? */
    loaded: id => !!S.ok[id || townFor(0).id],
    get transitioning() { return !!S.trans; },
    /** In a town that stands attached to the highway (she drove in off the interchange, or warped to one there). */
    get attached() { return !!(S.active && S.att); },
    /** The attached towns standing (or being built) by the road now: [{ town, exitS, k, ready, at: {x, z, rot}, steps, ms, worst }]. */
    get standing() { return S.built.map(b => { const T = (b.times || []).slice().sort((p, q) => p - q), pc = f => T.length ? +T[Math.min(T.length - 1, Math.floor(T.length * f))].toFixed(2) : 0;
        return { town: b.def.id, exitS: b.exitS, k: b.k, ready: b.ready, at: Object.assign({}, b.at), steps: b.steps, ms: +b.ms.toFixed(1), worst: +b.worst.toFixed(2), p95: pc(0.95), p99: pc(0.99) }; }); },
    blocksSight,
    /** A cruiser's route round the grid to her — or to `to` ({x, z, s} world: a searching cruiser's searchPoint / prowlPoint). */
    copRoute: (c, u, to) => copRoute(c, to || null),
    copSpawn: (how, fromAhead) => copSpawn(how, () => takePatrol()),
    /** For law's hiding: could a car stopped at (x, z) be tucked away here? { ok, spot: kerb | mall | walk | yard | lane | junction, why: lane | empty }. */
    hideSpot: (x, z) => S.active && S.T ? hideSpot(S.T, x, z) : null,
    /** Where searching cruisers drive: on to where she was heading (the last sighting {s, h, v, t}) → {x, z, s}; then crossing to crossing around it. */
    searchPoint: last => S.active ? searchPoint(last) : null,
    prowlPoint: (at, c) => S.active ? prowlPoint(at, c) : null,
    footYaw,
    towns: TOWNS,
    // ── for features that live IN a town (features/community…): small, read-mostly ──
    /** The definition of the town she's in (data; don't mutate) — null on the highway. */
    get def() { return S.active ? S.def : null; },
    /** Let another feature's own state play in town (any other state sends her back to the highway first). */
    allowState(name) { TOWN_OK.add(name); },
    /**
     * Build the attached town `id` at the interchange `exitS` AHEAD of a warp, in slices (~ms per call) — features/places
     * builds the nearest town while she sits in a cell / the ER (a set), so walking out into it is no long frame.
     * Starts the models' load if needed. → true once it's built (ctx.town.enter({ town: id, exitS }) then finds it ready).
     */
    prebuild(id, exitS, ms = BUILD_MS) {
        const def = TOWNS[id];
        if (!def || !def.attach) return false;
        if (!S.ok[id]) { load(def); return false; }
        const k = branchK(def, exitS);
        let en = entryOf(exitS, k);
        if (!en) {
            const P = placeAt(def, exitS, k);
            if (!P) return false;
            en = Object.assign(P, { e: null, T: null, gen: null, ready: false, box: boxOf(P.def), ms: 0, steps: 0, worst: 0 });
            S.built.push(en);
        }
        en.pin = performance.now();
        if (!en.ready) advanceBuilds(ms, en);
        return en.ready;
    },
    /** Where an attached town would stand at the interchange at exitS (world {x, z, rot}) — a pure function, nothing built. */
    placeOf(id, exitS) { const def = TOWNS[id], P = def && def.attach ? placeAt(def, exitS, branchK(def, exitS)) : null; return P ? Object.assign({}, P.at) : null; },
    /** A named spot from the build, in WORLD coords (pizza, hall, chair, yeshiva, a `uses` landmark…): {x, z, rot, ux, uz, nx, nz} | null. */
    spot(name) {
        const p = S.active && S.T && S.T.spots[name];
        return p ? spotWorld(p) : null;
    },
    /** The highway exits planned this run, one row per town an interchange offers: [{ s, id, name, town, emoji, no, label, branch }] (sorted by s). */
    /** The metre of town `id`'s own next exit at or past `from` (default: where she is) — planning the route on to it if
     *  it isn't yet (the same metres the run would plan: a pure function of the road). → s | null. */
    exitOf(id, from = null) {
        if (!TOWNS[id] || !ctx.world || !ctx.world.highway) return null;
        const s0 = from != null ? from : (ctx.car ? hwS() : 0);
        for (let n = 0; n < 4; n++) {
            const e = X.exits.find(e => e.s >= s0 - 60 && e.branches.some(b => b.town.id === id));
            if (e) return e.s;
            const last = X.exits[X.exits.length - 1];
            planRoute(last ? last.s : Math.max(0, s0 - 1500), Math.max(s0, last ? last.s : 0) + ROUTE.period);
        }
        return null;
    },
    /** HOME (ci/hometown): `{ town: "midwood", exitS }` — Midwood's own interchange, the route's first exit, at a fixed metre. */
    get home() { const h = home(); return h ? Object.assign({}, h) : null; },
    /** A named spot of the town standing at exitS, in WORLD coords, whether or not it's built yet: an empty lot's spot
     *  (`luluHome`) is pure data (`built: false` until the town is up); any other spot once the town is built. */
    spotOf(id, name, exitS) {
        const def = TOWNS[id];
        if (!def || !def.attach || !ctx.world || !ctx.world.highway) return null;
        const k = branchK(def, exitS), en = entryOf(exitS, k);
        if (en && en.ready && en.T && en.T.spots[name]) return withPlan(en, () => Object.assign(spotWorld(en.T.spots[name]), { built: true }));
        const P = en || placeAt(def, exitS, k);
        if (!P) return null;
        return withPlan(P, () => { const sp = lotSpot(name); return sp ? Object.assign(spotWorld(sp), { built: false }) : null; });
    },
    /** Add a solid (WORLD {x, z, r, kind}) to the town she's in — or to the one standing at `at` = { town, exitS }
     *  (Lulu's house on its empty lot: ci/hometown). → the collider, or null. */
    addCollider(c, at = null) {
        const en = at ? entryOf(at.exitS, branchK(TOWNS[at.town], at.exitS)) : null;
        const T = en ? en.T : S.T;
        return T && T.addCollider ? T.addCollider(Object.assign({ kind: "house" }, c)) : null;
    },
    /** In an attached town: where its streets hand over to the cross road out to the highway (world) — the way out. */
    wayOut() {
        if (!S.active || !S.att || !S.def.approach) return null;
        const A = S.def.approach, w = toWorld(A.to[0], A.to[1], {}), f = toWorld(A.from[0], A.from[1], {});
        return { x: w.x, z: w.z, tx: f.x, tz: f.z, street: A.name, name: "the highway" };
    },
    get exits() { return X.exits.flatMap(e => e.branches.map(b => ({ s: e.s, id: b.town.id, name: b.town.name, town: b.town.id, emoji: b.town.emoji, no: b.town.highway.no || null, label: b.town.highway.label || b.town.name, branch: b.k }))); },
    /** The stretch an exit's signs → ramps cover, relative to its s (features/exits keeps rest areas out of it). */
    span: SPAN,
    /** Put a lane-following town driver of `kind` on the grid (≥ minD m from her). The town never respawns it: yours to remove. */
    addDriver(kind, { minD = 60, speed = 5, at = null, cruise = 0 } = {}) {
        if (!S.active) return null;
        // (at {x, z, dir?}: start in the lane of the street nearest that point — features/heist's getaway car at the bank)
        let sp = null;
        if (at && S.road) {
            const n = S.road.nearest(at.x, at.z, undefined, {});
            if (n && n.street) sp = { street: n.street.id, along: n.s - n.street.base, dir: at.dir || (n.d >= 0 ? 1 : -1) };
        }
        if (!sp) sp = randomSpot(minD, kind);
        if (!sp) return null;
        const c = spawnDriver(kind, sp.street, sp.along, sp.dir, cruise > 0 ? { speed, cruise } : { speed });
        c.data.town.own = true;
        return c;
    },
    /** A free stretch of kerb in a parking lane (no parked van, jam, chair or hazard on it), between minD and maxD m
     *  from (near || her): { x, z, s, d, h, street, along, side } (world coords; d = the parking lane, h faces traffic's way). */
    curbSpot({ len = 12, near = null, minD = 25, maxD = 140, still = false } = {}) {
        if (!S.active || !S.T) return null;
        const T = S.T, at = toLocal((near || ctx.car.pos).x, (near || ctx.car.pos).z, {}), half = len / 2 + 3;
        const busy = [...T.parked, ...T.jam];
        if (T.spots.chair) busy.push({ x: T.spots.chair.cx, z: T.spots.chair.cz });
        // (still: only cars that are parked — a 🎉 party's seeded pick must not depend on where the traffic happens to be)
        for (const c of ctx.traffic.cars) if (!still || c.speed < 0.3) busy.push(toLocal(c.x, c.z, {}));
        let best = null, bs = -1e9;
        for (const st of PL.STREETS) for (let k = 0; k < st.cross.length - 1; k++) {
            const u0 = st.cross[k].a + 16 + half, u1 = st.cross[k + 1].a - 16 - half;
            if (!st.parkLane) continue;
            for (let u = u0; u <= u1; u += 4) for (const side of [-1, 1]) {
                if ((S.def.clearParking || []).some(c => c.street === st.name && u > c.from - half && u < c.to + half)) continue;
                const p = streetPoint(st, u, side * st.park, {});
                const dist = Math.hypot(p.x - at.x, p.z - at.z);
                if (dist < minD || dist > maxD) continue;
                const hx = Math.sin(st.h), hz = Math.cos(st.h);
                if (busy.some(b => { const dx = b.x - p.x, dz = b.z - p.z, lon = Math.abs(dx * hx + dz * hz), lat = Math.abs(-dx * hz + dz * hx); return lon < half && lat < 3.4; })) continue;
                const sc = Math.random() * 30 - Math.abs(dist - (minD + maxD) / 2) * 0.2;
                if (sc > bs) { bs = sc; const w = toWorld(p.x, p.z, {}); best = { x: w.x, z: w.z, s: st.base + u, d: side * st.park, h: wH(headingOf(st, side)), street: st.name, along: u, side }; }
            }
        }
        return best;
    },
    debug: {
        S, C, LIFE, PL, X, PK, gossip, luluSay, crime,
        /** Start the ramp's transition now ("leave" from inside a town; "enter" needs an exit `e`): tests. */
        trans: (kind, e = null) => { beginTrans(kind, e); return !!S.trans; },
        /** Plan an exit `ahead` metres in front of her NOW (rebuilds the chunks it touches): one town's own exit (`id`,
         *  Lakewood by default — every exit is one town's since ci/exits2), or the old shared interchange with id "both". */
        exitAhead(ahead = 320, id = "lakewood") {
            const w = ctx.world, towns = id === "both" ? INTERCHANGE.towns : [TOWNS[id || "lakewood"]];
            // (the nearest spot to `ahead` where the attached towns fit — either way — so a test isn't sent kilometres on)
            // (clear of the route's own exits too: two interchanges' signs → ramps can't overlap)
            const gap = SPAN.b - SPAN.a + 100, free = a => exitClear(a, towns) && !X.exits.some(e => Math.abs(e.s - a) < gap);
            let s0 = null;
            for (let k = 0; k < 120; k++) {
                const a = ctx.car.s + ahead + k * 25, b = ctx.car.s + ahead - k * 25;
                if (free(a)) { s0 = a; break; }
                if (b > ctx.car.s + 240 && free(b)) { s0 = b; break; }
            }
            // (nowhere free near there: the route's own exit for that town)
            if (s0 == null) { for (const t of towns) load(t); return id === "both" ? null : ctx.town.exitOf(id || "lakewood", ctx.car.s + 240); }
            const e = planExit(s0, towns);
            if (!e) return null;
            for (const [k, c] of [...w.chunks]) if (c.s1 > e.s + SPAN.a - 20 && c.s0 < e.s + SPAN.b) { c.dispose(w.scene); w.chunks.delete(k); }
            w.prebuild(ctx.car.s);
            for (const t of towns) load(t);
            return e.s;
        },
        rampPhase: (s = ctx.car.s, d = ctx.car.d) => { const e = exitAt(s); return e ? Object.assign({ s: e.s }, rampPhase(e, s, d)) : null; },
        /** A driving line [[u, d]…] from the right lane down the decel lane onto branch k (to its stop line), for the exit at E. */
        rampRoute: (E, k = 0, from = -300) => { const e = X.exits.find(x => Math.abs(x.s - E) < 1); return e ? rampRoute(e, k, from) : null; },
        /** Exit E's far end as data: { props: [{key, u, d, r}], rails: [{a, b, pts}], roads, stops } (tests). */
        exitLayout(E) {
            const e = X.exits.find(x => Math.abs(x.s - E) < 1);
            if (!e) return null;
            return { props: propsOf(e).map(p => ({ key: p.key, u: p.at != null ? p.at : p.u, d: p.d, r: p.r, len: p.len || 0 })), roads: crossRoads(e),
                rails: railsOf(e).map(r => ({ a: r.a, b: r.b, pts: Array.from({ length: Math.floor((r.b - r.a) / 4) + 1 }, (_, i) => [r.a + i * 4, r.dOf(r.a + i * 4)]) })),
                stops: e.branches.map(b => ({ k: b.k, stop: b.stop, d: b.dOf(b.stop) })) };
        },
        laneAt: (E, u, d) => { const e = X.exits.find(x => Math.abs(x.s - E) < 1); return !!(e && laneAt(e, u, d)); },
        exits: () => X.exits.map(e => e.s),
        /** Put her on a street: (name, along, d, speed, dir). */
        place(name, along, d = LANE, v = 0, dir = 1) {
            const st = street(name);
            if (!st || !S.active) return false;
            const p = S.road.point(st.base + along, d, {}), h = wH(headingOf(st, dir));
            ctx.car.place(p.x, p.z, h); ctx.car.vx = Math.sin(h) * v; ctx.car.vz = Math.cos(h) * v;
            ctx.car.s = st.base + along; ctx.car.d = d;
            return true;
        },
        /** A street point (LOCAL coords) of the current town: (name, along, d) → {x, z, h}. */
        pt(name, along, d = 0) { const st = street(name); return st ? streetPoint(st, along, d, {}) : null; },
        sees: (ax, az, bx, bz) => !blocksSight(ax, az, bx, bz),
        local: (x, z) => toLocal(x, z, {}),
        segmentBlocked, sightBlocked,
        /** Attached towns: finish every build now (tests), where a town would stand at exit s on branch k, its footprint, the approach. */
        buildNow: () => { for (let i = 0; i < 20 && S.built.some(b => !b.ready); i++) advanceBuilds(Infinity); return S.built.every(b => b.ready); },
        placeAt: (id, exitS, k) => { const P = placeAt(TOWNS[id], exitS, k); return P ? { at: P.at, approach: P.def.approach, box: boxOf(P.def), cu: P.cu, d0: P.d0 } : null; },
        fits: (s, id = null) => FIT.fits(s, id ? [TOWNS[id]] : INTERCHANGE.towns),
        /** A local point of the town she's in (or the standing town `id`) → world. */
        world(lx, lz, id = null) { const en = id ? S.built.filter(b => b.def.id === id).sort((p, q) => Math.abs(p.exitS - hwS()) - Math.abs(q.exitS - hwS()))[0] : null; if (en) { const co = Math.cos(en.at.rot), si = Math.sin(en.at.rot); return { x: en.at.x + lx * co + lz * si, z: en.at.z - lx * si + lz * co }; } return toWorld(lx, lz, {}); },
    },
};
/** A build spot / home (local: x, z, rot, ux uz, nx nz, cx cz, lotX lotZ) → world (lx / lz keep the local point). */
function spotWorld(p) {
    const o = Object.assign({}, p, toWorld(p.x, p.z, {}), { lx: p.x, lz: p.z });
    if (p.rot != null) o.rot = wH(p.rot);
    if (p.ux != null) { const v = dirWorld(p.ux, p.uz, {}); o.ux = v.x; o.uz = v.z; }
    if (p.nx != null) { const v = dirWorld(p.nx, p.nz, {}); o.nx = v.x; o.nz = v.z; }
    if (p.cx != null) { const v = toWorld(p.cx, p.cz, {}); o.cx = v.x; o.cz = v.z; }
    if (p.lotX != null) { const v = toWorld(p.lotX, p.lotZ, {}); o.lotX = v.x; o.lotZ = v.z; }
    // (an empty lot's door / drive / kerb points: world too, headings turned)
    for (const k of ["door", "drive", "kerb"]) if (p[k]) { const v = toWorld(p[k].x, p[k].z, {}); o[k] = Object.assign({}, p[k], v); if (p[k].h != null) o[k].h = wH(p[k].h); }
    return o;
}
function takePatrol() {
    const p = C.patrol;
    if (!LIFE.witness || !p || !ctx.traffic.cars.includes(p)) return null;
    LIFE.witness = false;
    const n = S.road.nearest(p.x, p.z, p.s, {}), st = n.street;
    const dir = Math.sin(p.h) * Math.sin(wH(st.h)) + Math.cos(p.h) * Math.cos(wH(st.h)) >= 0 ? 1 : -1;
    ctx.traffic.remove(p);
    const i = C.cars.indexOf(p); if (i >= 0) C.cars.splice(i, 1);
    C.patrol = null;
    return { s: n.s, d: dir * LANE, dir };
}
export { S };
