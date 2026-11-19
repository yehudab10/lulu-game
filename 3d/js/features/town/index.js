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
//    life.js    people (talk on foot), geese, e-bikes, speed bumps, stop signs, the group chat
//    cops.js    what law asks: blocksSight / copRoute / copSpawn
//    exit.js    the highway interchange: signs, gantry, decel lane, one ramp that splits per town; triggers the fade in
//    sfx.js     goose honks, minivan horns, the speed-bump THUNK
//
//  ctx.town { active, id, name, street, streets, occluders, enter(), leave(), blocksSight(),
//             copRoute(), copSpawn(), footYaw(), towns, debug }
//  Events: town:exit {town, s, no} (she took a branch) · town:enter {town, exitS} · town:leave {town, why} · town:gossip {kind, msg} ·
//          town:talk {id, line} · town:stopSign · town:bump · town:geese · town:bike
//  Random content is gated by ctx.enabled("town") (off in ?test unless enabled, off in a party).
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, hook, emit, css, addActor } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { models, ensureModels, registerModels } from "../../models.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { PL, setPlan, TownRoad, LANE, street, streetOfS, streetPoint, headingOf, toLocal, segmentBlocked, sightBlocked } from "./plan.js";
import { buildTown, BUILD_MODELS } from "./build.js";
import { tickRail } from "./rail.js";
import * as SFX from "./sfx.js";
import { C, spawnDriver, spawnHazard, clearDrivers, randomSpot, tendDrivers, lodDrivers } from "./cars.js";
import { LIFE, PEOPLE_MODELS, startLife, stopLife, tickLife, luluSay, gossip, honked, crime, patrolSees, talkSpot } from "./life.js";
import { blocksSight, copRoute, copSpawn, hideSpot, searchPoint, prowlPoint } from "./cops.js";
import { X, planExit, clearExits, exitAt, rampPhase, SPAN } from "./exit.js";
import { TOWNS, townFor, INTERCHANGE } from "./towns/index.js";

const NEEDS = [...new Set([...BUILD_MODELS, ...PEOPLE_MODELS, "cop"])];
/** The models a town needs: Lakewood's set, or the town's own list (def.models). */
const needsOf = def => def.models ? [...new Set(def.models)] : NEEDS;
// our own models (key = file name), plus the two we borrow from roadevents / foot (same files, so no double load)
const OWN = new Set(Object.values(TOWNS).flatMap(needsOf).concat(NEEDS).filter(k => /^(town_|roadevents_school_bus$|foot_bus$)/.test(k)));
registerModels(Object.fromEntries([...OWN].map(k => [k, k])));

// ── state ────────────────────────────────────────────────────────────────
const S = { active: false, def: null, lastDef: null, T: null, road: null, chunk: null, exitS: 0, trans: null, ready: null, loaded: false, loads: {}, ok: {},
    savedTraffic: true, readLive: 0, savedTrip: null, savedPullOver: undefined, timers: [], visits: 0, bubbe: new Set(), footYaw: null, tendT: 0, haz: [] };
const TOWN_OK = new Set(["playing", "wrecked", "footRun", "lawBust", "copStop", "playPhoto", "hustleResult"]);
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
    const extra = [...new Set(Object.values(def.uses || {}).map(u => u.key))];
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
    return {
        k: -1, get s0() { return ctx.car.s - 100; }, get s1() { return ctx.car.s + 100; },
        get colliders() { return T.near(ctx.car.pos.x, ctx.car.pos.z); },
        coins: T.coins, hearts: [], traps: [], houses: [], anim: [], biome: { name: "town" }, group: g,
        add(o) { g.add(o); return o; }, own(x) { T.own.push(x); return x; }, addCollider(c) { T.colliders.push(c); return c; },
        addMesh(geo, mat) { const m = new THREE.Mesh(geo, mat); g.add(m); T.own.push(geo); return m; },
        onAnimate() {}, sign() {}, animate() {}, resetCoins() {},
    };
}

// ── in / out ─────────────────────────────────────────────────────────────
function enterTown(e = null, opts = {}) {
    if (S.active) return false;
    const def = e ? e.town : (opts.town ? TOWNS[opts.town] : townFor(0));
    if (!def || !S.ok[def.id]) return false;
    const car = ctx.car, G = ctx.G, world = ctx.world, tr = ctx.traffic;
    setPlan(def);
    S.def = S.lastDef = def;
    S.exitS = e ? e.s : (opts.exitS != null ? opts.exitS : car.s);
    const T = S.T = buildTown(def);
    ctx.scene.add(T.root);
    ctx.scene.add(T.coinMesh);
    S.road = new TownRoad(world.highway);
    S.chunk = makeChunk(T);
    world.setDistrict({ road: S.road, chunks: [S.chunk], ground: def.ground });
    S.active = true;
    S.savedTraffic = tr.config.enabled;
    tr.config.enabled = false;
    tr.clear();
    // she comes off the ramp onto the entry street, carrying her speed
    const st = street(def.entry.street), along = def.entry.along, h = headingOf(st, def.entry.dir || 1);
    const v = Math.max(8, Math.min(19, opts.speed != null ? opts.speed : car.speed));
    const p = S.road.point(st.base + along, def.entry.d, {});
    car.place(p.x, p.z, h);
    car.vx = Math.sin(h) * v; car.vz = Math.cos(h) * v; car.vF = v;
    car.s = st.base + along; car.d = def.entry.d;
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
    if (!party) for (const [kind, n] of Object.entries(def.traffic || {})) for (let i = 0; i < n; i++) {
        const sp = randomSpot(36, kind);
        if (sp) spawnDriver(kind, sp.street, sp.along, sp.dir, { speed: 6 });
    }
    if (party) ctx.openworld.seeded(def.id, () => startLife(T, Object.assign({}, def, { bikes: 0 })));
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
    if (ctx.cam) ctx.cam.snap();
    H.banner(`<b>${def.emoji} ${def.lines.SIGNS.welcome[0]}</b><small>${def.lines.SIGNS.welcome.slice(1).join(" · ")}</small>`, 2800, { key: "town", prio: 2 });
    later(1.4, () => luluSay("enter", true));
    later(5, () => gossip("enter"));
    if (!S.bubbe.has(def.id) && def.lines.BUBBE) { S.bubbe.add(def.id); later(11, () => phoneText(def.lines.BUBBE, 0)); later(26, () => phoneText(def.lines.BUBBE, 1)); }
    emit("town:enter", { town: def.id, exitS: S.exitS });
    emit("stat", { id: "townVisits", n: 1 });
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
function leaveTown(why = "highway") {
    if (!S.active) return false;
    const def = S.def, car = ctx.car, G = ctx.G, world = ctx.world, tr = ctx.traffic;
    stopLife();
    SFX.rumbleStop();
    for (const h of S.haz) { if (h.grp.parent) h.grp.parent.remove(h.grp); h.m.dispose(); h.g.dispose(); }
    S.haz.length = 0;
    clearDrivers();
    tr.clear();
    tr.config.enabled = S.savedTraffic;
    world.setDistrict(null);
    S.active = false;
    if (S.T) { S.T.dispose(); S.T = null; }
    if (S.extras) { ctx.scene.remove(S.extras); S.extras = null; }
    ctx.trip = S.savedTrip;
    const icon = document.querySelector(".trip-to");
    if (icon && S.savedIcon != null) icon.textContent = S.savedIcon;
    G.noPullOver = S.savedPullOver;
    S.timers.length = 0;
    S.footYaw = null;
    if (why !== "reset") {
        // back on the highway just past the exit, in the right lane (or on the shoulder after a wreck)
        const s = S.exitS + 190, d = why === "wreck" ? 7.8 : 5.25;
        const p = world.highway.point(s, d, {});
        const v = why === "highway" ? Math.max(12, Math.min(28, car.speed)) : 0;
        car.place(p.x, p.z, p.h);
        car.vx = Math.sin(p.h) * v; car.vz = Math.cos(p.h) * v; car.vF = v;
        car.s = s; car.d = d;
        G.lastS = s;
        if (ctx.cam) ctx.cam.snap();
    }
    if (why === "highway") {
        H.banner(`<b>🛣️ BACK ON THE HIGHWAY</b><small>${def.name} is behind you. For now.</small>`, 2200, { key: "town", prio: 2 });
        luluSay("leave", true);
        gossip("leave", true);
    }
    emit("town:leave", { town: def.id, why });
    return true;
}
function later(sec, fn) { S.timers.push({ at: ctx.time + sec, fn }); }
function phoneText(who, k) {
    if (!S.active) return;
    const msg = who.lines[k % who.lines.length];
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
    // driving out of town: the ramps
    if (ctx.state === "playing" && !S.trans && !(ctx.foot && ctx.foot.active)) {
        const st = streetOfS(car.s);
        for (const ex of S.def.exits) {
            if (!st || st.name !== ex.street) continue;
            // past the ramp's mouth AND driving outward (not just arriving there off the entry ramp)
            const out = (car.vx * Math.sin(st.h) + car.vz * Math.cos(st.h)) * ex.dir;
            if ((car.s - st.base - ex.at) * ex.dir > 0 && out > 1) { beginTrans("leave"); break; }
        }
    }
}

// the B/Q: Lulu notices the first train, the group chat has opinions, doors chime as it leaves a station near her
const RAIL_HOOKS = {
    onPass(tr) { if (!LIFE.said.has("train")) { LIFE.said.add("train"); luluSay("train", true); later(3, () => gossip("train")); } emit("town:train", { line: tr.cfg.line }); },
    onDepart(tr) {
        const c = ctx.camera.position, d = Math.hypot(PL.ORIGIN.x + tr.obj.position.x - c.x, PL.ORIGIN.z + tr.z - c.z);
        if (d < 90) SFX.chime(Math.max(0.2, 1 - d / 90));
    },
};

// ── culling: a block of houses hides everything behind it ──────────────
// (the frustum alone sees "through" the whole town from any street). Per merged cluster: hidden when
// it's past its look's distance, or when every sample point is behind some other block.
const MAX_D = { flat: 140, solid: 300, glow: 230, lit: 230, glass: 110, far: 700, farglow: 700 };
const SAMPLES = [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]];
function cullClusters(T) {
    const cam = toLocal(ctx.camera.position.x, ctx.camera.position.z, {});
    let shown = 0;
    for (const m of T.clusters) {
        const c = m.userData.cell;
        if (!c) continue;
        const nx = Math.max(c.x0, Math.min(c.x1, cam.x)), nz = Math.max(c.z0, Math.min(c.z1, cam.z));
        const d = Math.hypot(nx - cam.x, nz - cam.z);
        let vis = d <= (MAX_D[m.userData.townLook] || 250);
        if (vis && d > 24) {
            vis = false;
            for (const [u, v] of SAMPLES) {
                const px = c.x0 + (c.x1 - c.x0) * u, pz = c.z0 + (c.z1 - c.z0) * v;
                if (!sightBlocked(cam.x, cam.z, px, pz)) { vis = true; break; }
            }
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
hook("runStart", G => {
    if (S.active) leaveTown("reset");
    S.trans = null; setFade(0);
    clearExits();
    if (S.cue) { S.cue = ""; H.prompt(""); }
    S.bubbe.clear();
    if (eligible()) {
        const def = INTERCHANGE.towns[0];
        if (partyTowns()) {
            // a party: the same interchanges for every friend (from the start of the road, not this run's start), all planned
            // up to well past where this run starts so a late joiner's first chunks already have their ramps
            let e = planExit(def.highway.first, INTERCHANGE.towns);
            while (e && e.s < (G.startS || 0) + 1800) e = planExit(e.s + e.town.highway.every, INTERCHANGE.towns);
        } else planExit((G.startS || 0) + def.highway.first, INTERCHANGE.towns);
        load(def);
    }
}, 20);
on("title", () => { if (S.active) leaveTown("reset"); S.trans = null; setFade(0); clearExits(); cue(null); });

// ── the ramp cue: a light, in-the-moment prompt (no popup) while she's in the decel lane / on the ramp ──
const RP = {};
function cue(e, ph) {
    let html = "";
    if (e && ph && ph.phase && ctx.state === "playing" && ctx.car.speed > 3) {
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

hook("update", (dt, P, controlsOn) => {
    tickTrans(dt);
    if (S.active || !X.exits.length) return;
    const car = ctx.car;
    // plan the next exit well ahead (before its chunks are built), drop the ones far behind
    const last = X.exits[X.exits.length - 1];
    if (eligible() && car.s > last.s - 1000) planExit(last.s + last.town.highway.every, INTERCHANGE.towns);
    if (ctx.state !== "playing" || !controlsOn || S.trans) { if (S.cue) cue(null); return; }
    const e = exitAt(car.s);
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
    beginTrans("enter", { s: e.s, town });
});

// out of hearts in town: she's towed back to the highway's shoulder, and the usual aftermath plays there
hook("wreck", () => {
    if (!S.active) return false;
    leaveTown("wreck");
    setFade(1); S.trans = { kind: "leave", t: 0, phase: "in" };
    H.toast(`🚛 Towed out of ${S.def ? S.def.name : "town"}`, "red");
    return false;
}, 40);
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
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(talkSpot);
    // the phone (if it has apps): the local news
    if (ctx.phone && ctx.phone.addApp) {
        try {
            ctx.phone.addApp({ id: "town", icon: "🗞️", name: "Kvetch", order: 70, color: "#5E35B1", color2: "#B39DDB",
                visible: () => !(ctx.party && ctx.party.active),
                badge: () => LIFE.live.length - S.readLive > 0 ? LIFE.live.length - S.readLive : null,
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
    get occluders() { return PL.OCCLUDERS.map(r => ({ x0: r.x0 + PL.ORIGIN.x, x1: r.x1 + PL.ORIGIN.x, z0: r.z0 + PL.ORIGIN.z, z1: r.z1 + PL.ORIGIN.z })); },
    /** The current town's plan (streets, blocks, nodes; local frame + ORIGIN) and its landmark spots (local), or null. */
    get plan() { return S.active ? PL : null; },
    get spots() { return S.active && S.T ? S.T.spots : null; },
    get coins() { return S.active && S.T ? S.T.coins : null; },
    /** The houses people live in (features/homes): [{ key (model), x, z (model origin), rot, ux, uz, nx (toward the street), nz, lotX, lotZ, w, dark, face }]
     *  and the driveway minivans [{ x, z, rot }] — WORLD coords, in build order (stable per town). */
    get homes() { return S.active && S.T && S.T.homes ? S.T.homes.map(h => Object.assign({}, h, { x: h.x + PL.ORIGIN.x, z: h.z + PL.ORIGIN.z, lotX: h.lotX + PL.ORIGIN.x, lotZ: h.lotZ + PL.ORIGIN.z })) : []; },
    get drives() { return S.active && S.T && S.T.drives ? S.T.drives.map(d => ({ x: d.x + PL.ORIGIN.x, z: d.z + PL.ORIGIN.z, rot: d.rot })) : []; },
    /** The townsfolk you can talk to: [{id, name, x, z}] (world). */
    people: () => S.active ? LIFE.people.filter(r => r.lines).map(r => ({ id: r.id, name: r.name, x: r.p.obj.position.x, z: r.p.obj.position.z })) : [],
    /** Go into town now (no ramp; tests / debug). opts: { town: "lakewood" | "midwood", exitS, speed }. Its models must be
     *  loaded (await ctx.town.load(id)). */
    enter(opts = {}) { return enterTown(null, opts); },
    /** Back to the highway now. why: "highway" (default) | "quiet" | "reset". */
    leave(why = "highway") { return leaveTown(why); },
    load: id => load(id ? TOWNS[id] : townFor(0)),
    /** Is this town's model set loaded? */
    loaded: id => !!S.ok[id || townFor(0).id],
    get transitioning() { return !!S.trans; },
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
    /** A named spot from the build, in WORLD coords (pizza, hall, chair, yeshiva, a `uses` landmark…): {x, z, rot, ux, uz, nx, nz} | null. */
    spot(name) {
        const p = S.active && S.T && S.T.spots[name];
        return p ? Object.assign({}, p, { x: p.x + PL.ORIGIN.x, z: p.z + PL.ORIGIN.z, lx: p.x, lz: p.z }) : null;
    },
    /** The highway exits planned this run, one row per town an interchange offers: [{ s, id, name, town, emoji, no, label, branch }] (sorted by s). */
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
        const T = S.T, O = PL.ORIGIN, at = near || ctx.car.pos, half = len / 2 + 3;
        const busy = [...T.parked, ...T.jam];
        if (T.spots.chair) busy.push({ x: T.spots.chair.cx, z: T.spots.chair.cz });
        // (still: only cars that are parked — a 🎉 party's seeded pick must not depend on where the traffic happens to be)
        for (const c of ctx.traffic.cars) if (!still || c.speed < 0.3) busy.push({ x: c.x - O.x, z: c.z - O.z });
        let best = null, bs = -1e9;
        for (const st of PL.STREETS) for (let k = 0; k < st.cross.length - 1; k++) {
            const u0 = st.cross[k].a + 16 + half, u1 = st.cross[k + 1].a - 16 - half;
            if (!st.parkLane) continue;
            for (let u = u0; u <= u1; u += 4) for (const side of [-1, 1]) {
                if ((S.def.clearParking || []).some(c => c.street === st.name && u > c.from - half && u < c.to + half)) continue;
                const p = streetPoint(st, u, side * st.park, {});
                const dist = Math.hypot(O.x + p.x - at.x, O.z + p.z - at.z);
                if (dist < minD || dist > maxD) continue;
                const hx = Math.sin(st.h), hz = Math.cos(st.h);
                if (busy.some(b => { const dx = b.x - p.x, dz = b.z - p.z, lon = Math.abs(dx * hx + dz * hz), lat = Math.abs(-dx * hz + dz * hx); return lon < half && lat < 3.4; })) continue;
                const sc = Math.random() * 30 - Math.abs(dist - (minD + maxD) / 2) * 0.2;
                if (sc > bs) { bs = sc; best = { x: O.x + p.x, z: O.z + p.z, s: st.base + u, d: side * st.park, h: headingOf(st, side), street: st.name, along: u, side }; }
            }
        }
        return best;
    },
    debug: {
        S, C, LIFE, PL, X, gossip, luluSay, crime,
        /** Plan an exit `ahead` metres in front of her NOW (rebuilds the chunks it touches): the full interchange
         *  (every town), or a one-town exit with its own signs when `id` names a town. */
        exitAhead(ahead = 320, id = null) {
            const w = ctx.world, towns = id ? [TOWNS[id]] : INTERCHANGE.towns;
            const e = planExit(ctx.car.s + ahead, towns);
            if (!e) return null;
            for (const [k, c] of [...w.chunks]) if (c.s1 > e.s + SPAN.a - 20 && c.s0 < e.s + SPAN.b) { c.dispose(w.scene); w.chunks.delete(k); }
            w.prebuild(ctx.car.s);
            for (const t of towns) load(t);
            return e.s;
        },
        rampPhase: (s = ctx.car.s, d = ctx.car.d) => { const e = exitAt(s); return e ? Object.assign({ s: e.s }, rampPhase(e, s, d)) : null; },
        exits: () => X.exits.map(e => e.s),
        /** Put her on a street: (name, along, d, speed, dir). */
        place(name, along, d = LANE, v = 0, dir = 1) {
            const st = street(name);
            if (!st || !S.active) return false;
            const p = S.road.point(st.base + along, d, {}), h = headingOf(st, dir);
            ctx.car.place(p.x, p.z, h); ctx.car.vx = Math.sin(h) * v; ctx.car.vz = Math.cos(h) * v;
            ctx.car.s = st.base + along; ctx.car.d = d;
            return true;
        },
        /** A street point (LOCAL coords) of the current town: (name, along, d) → {x, z, h}. */
        pt(name, along, d = 0) { const st = street(name); return st ? streetPoint(st, along, d, {}) : null; },
        sees: (ax, az, bx, bz) => !blocksSight(ax, az, bx, bz),
        local: (x, z) => toLocal(x, z, {}),
        segmentBlocked,
    },
};
function takePatrol() {
    const p = C.patrol;
    if (!LIFE.witness || !p || !ctx.traffic.cars.includes(p)) return null;
    LIFE.witness = false;
    const n = S.road.nearest(p.x, p.z, p.s, {}), st = n.street;
    const dir = Math.sin(p.h) * Math.sin(st.h) + Math.cos(p.h) * Math.cos(st.h) >= 0 ? 1 : -1;
    ctx.traffic.remove(p);
    const i = C.cars.indexOf(p); if (i >= 0) C.cars.splice(i, 1);
    C.patrol = null;
    return { s: n.s, d: dir * LANE, dir };
}
export { S };
