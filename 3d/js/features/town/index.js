// ─────────────────────────────────────────────────────────────────────────
//  features/town — 🏙️ TOWNS YOU CAN TURN INTO (first one: LAKEWOOD. Nobody likes Lakewood.)
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
//    towns/     the TOWNS as data (lakewood.js + its lines) — a second town is another file
//    build.js   the scene: merged block clusters (kit.js), one sign atlas, lamps, the lake…
//    cars.js    the town's drivers (lane-following, 4-way stops, the circle) + the patrol car
//    life.js    people (talk on foot), geese, e-bikes, speed bumps, stop signs, the group chat
//    cops.js    what law asks: blocksSight / copRoute / copSpawn
//    exit.js    the highway exit: signs, gantry, decel lane, the ramp; triggers the fade in
//    sfx.js     goose honks, minivan horns, the speed-bump THUNK
//
//  ctx.town { active, id, name, street, streets, occluders, enter(), leave(), blocksSight(),
//             copRoute(), copSpawn(), footYaw(), towns, debug }
//  Events: town:enter {town, exitS} · town:leave {town, why} · town:gossip {kind, msg} ·
//          town:talk {id, line} · town:stopSign · town:bump · town:geese · town:bike
//  Random content is gated by ctx.enabled("town") (off in ?test unless enabled, off in a party).
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from "three";
import { ctx, on, hook, emit, css, addActor } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { models, ensureModels, registerModels } from "../../models.js";
import { input } from "../../input.js";
import * as H from "../../hud.js";
import { PL, setPlan, TownRoad, LANE, street, streetOfS, headingOf, toLocal, segmentBlocked } from "./plan.js";
import { buildTown, BUILD_MODELS } from "./build.js";
import { C, spawnDriver, spawnHazard, clearDrivers, randomSpot, tendDrivers } from "./cars.js";
import { LIFE, PEOPLE_MODELS, startLife, stopLife, tickLife, luluSay, gossip, honked, crime, patrolSees, talkSpot } from "./life.js";
import { blocksSight, copRoute, copSpawn } from "./cops.js";
import { X, planExit, clearExits, exitAt, onRamp } from "./exit.js";
import { TOWNS, townFor } from "./towns/index.js";

registerModels(Object.fromEntries([
    "town_duplex", "town_townhouses", "town_shop", "town_pizza", "town_hall", "town_yeshiva", "town_frame", "town_crane", "town_minivan",
    "town_lamp", "town_stop", "town_chair", "town_goose", "town_ebike", "town_welcome", "town_billboard", "town_circle", "town_reeds",
    "town_bochur", "town_local", "town_mom", "town_brooklyn", "town_agent", "roadevents_school_bus", "foot_bus",
].map(k => [k, k])));
const NEEDS = [...new Set([...BUILD_MODELS, ...PEOPLE_MODELS, "cop"])];

// ── state ────────────────────────────────────────────────────────────────
const S = { active: false, def: null, T: null, road: null, chunk: null, exitS: 0, trans: null, ready: null, loaded: false,
    savedTraffic: true, savedTrip: null, savedPullOver: undefined, timers: [], visits: 0, bubbe: false, footYaw: null, tendT: 0, haz: [] };
const TOWN_OK = new Set(["playing", "wrecked", "footRun", "lawBust", "copStop", "playPhoto", "hustleResult"]);
// highway content that has no business in a town (its random parts read the highway's s)
const TOWN_OFF = new Set(["roadevents", "cameos", "foot", "interiors", "journey", "hustle", "play", "banter", "law", "dina"]);
const baseEnabled = ctx.enabled;
ctx.enabled = id => (S.active && TOWN_OFF.has(id)) ? false : baseEnabled(id);

function load() {
    if (!S.ready) S.ready = ensureModels(NEEDS).then(() => { S.loaded = true; }).catch(e => { console.warn("[town] models", e); S.ready = null; });
    return S.ready;
}

// ── the fade (the only "transition": ~1 s, in game time) ─────────────────
css("town", `
#townFade { position: fixed; inset: 0; background: #0c0f16; opacity: 0; pointer-events: none; display: flex; align-items: center; justify-content: center; }
#townFade span { color: #fff; font: 700 clamp(22px, 4vw, 44px) Fredoka, Arial, sans-serif; letter-spacing: .04em; opacity: 0; transition: opacity .2s; text-shadow: 0 2px 12px rgba(0,0,0,.5); }
#townFade span small { display: block; text-align: center; font-size: .45em; font-weight: 600; opacity: .75; letter-spacing: .02em; margin-top: 4px; }
#townFade.label span { opacity: 1; }
.town-kvetch h3 { margin: 0 0 8px; font-size: 1.05em; }
.town-kvetch p { margin: 0 0 8px; line-height: 1.25; }
.town-kvetch small { opacity: .75; }
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
    if (kind === "enter") load();
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
        if (tr.kind === "enter" && !S.loaded) { load(); if (tr.t > 12) { S.trans = null; setFade(0); } return; }
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
    const def = e ? e.town : (opts.town ? TOWNS[opts.town] : townFor());
    if (!def) return false;
    const car = ctx.car, G = ctx.G, world = ctx.world, tr = ctx.traffic;
    setPlan(def);
    S.def = def;
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
    for (const hz of def.hazards || []) { const hs = street(hz.street); if (hs) hazards(spawnHazard(hs.id, hz.along, hz.d)); }
    for (const [kind, n] of Object.entries(def.traffic || {})) for (let i = 0; i < n; i++) {
        const sp = randomSpot(36, kind);
        if (sp) spawnDriver(kind, sp.street, sp.along, sp.dir, { speed: 6 });
    }
    startLife(T, def);
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
    if (!S.bubbe && def.lines.BUBBE) { S.bubbe = true; later(11, () => phoneText(def.lines.BUBBE, 0)); later(26, () => phoneText(def.lines.BUBBE, 1)); }
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
    S.tendT -= dt;
    if (S.tendT <= 0) { S.tendT = 1; tendDrivers(1, Object.assign({}, S.def.traffic, { cop: ctx.law && ctx.law.chasing ? 0 : (S.def.traffic.cop || 0) })); }
    for (const k of T.cranes) k.obj.rotation.y += k.speed * dt * (Math.sin(ctx.time * 0.1 + k.speed * 50) > -0.3 ? 1 : 0);
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
            if ((car.s - st.base - ex.at) * ex.dir > 0) { beginTrans("leave"); break; }
        }
    }
}

// ── hooks ────────────────────────────────────────────────────────────────
function eligible() {
    const G = ctx.G;
    return G.mode === "cruise" && ctx.enabled("town") && !G.tutorial && !(ctx.party && ctx.party.active);
}
hook("runStart", G => {
    if (S.active) leaveTown("reset");
    S.trans = null; setFade(0);
    clearExits();
    S.bubbe = false;
    if (eligible()) {
        const def = townFor();
        planExit((G.startS || 0) + def.highway.first, def);
        load();
    }
}, 20);
on("title", () => { if (S.active) leaveTown("reset"); S.trans = null; setFade(0); clearExits(); });

hook("update", (dt, P, controlsOn) => {
    tickTrans(dt);
    if (S.active || !X.exits.length) return;
    const car = ctx.car;
    // plan the next exit well ahead (before its chunks are built), drop the ones far behind
    const last = X.exits[X.exits.length - 1];
    if (eligible() && car.s > last.s - 1000) planExit(last.s + last.town.highway.every, last.town);
    if (ctx.state !== "playing" || !controlsOn || S.trans) return;
    const e = exitAt(car.s);
    if (e && e.s - car.s < 900) load();
    if (e && onRamp(e, car.s, car.d)) {
        if (ctx.hustle && ctx.hustle.job) { ctx.hustle.end("quit", `You took the ${e.town.name} exit. Nobody gets anywhere on time from there.`); return; }
        beginTrans("enter", e);
    }
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
    if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(talkSpot);
    // the phone (if it has apps): the local news
    if (ctx.phone && ctx.phone.addApp) {
        try {
            ctx.phone.addApp({ id: "town", icon: "🗞️", name: "Kvetch", order: 60, render(el) { el.innerHTML = kvetchHtml(); } });
        } catch (e) { console.warn("[town] phone app", e); }
    }
});
function kvetchHtml() {
    const L = (S.def || townFor()).lines;
    const items = [...LIFE.live.slice(0, 6), ...L.KVETCH];
    return `<div class="town-kvetch"><h3>🗞️ ${L.KVETCH_TITLE || "The Lakewood Kvetch"}</h3>${items.map(i => `<p><b>${i.h}</b><br><small>${i.b}</small></p>`).join("")}</div>`;
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
    get streets() { return (S.def ? PL.STREETS : setPlan(townFor()).STREETS).map(s => s.name); },
    /** The buildings that block a line of sight: world-space rects {x0, z0, x1, z1}. */
    get occluders() { return PL.OCCLUDERS.map(r => ({ x0: r.x0 + PL.ORIGIN.x, x1: r.x1 + PL.ORIGIN.x, z0: r.z0 + PL.ORIGIN.z, z1: r.z1 + PL.ORIGIN.z })); },
    /** Go into town now (no ramp; tests / debug). opts: { town, exitS, speed }. Models must be loaded (await ctx.town.load()). */
    enter(opts = {}) { return S.loaded ? enterTown(null, opts) : false; },
    /** Back to the highway now. why: "highway" (default) | "quiet" | "reset". */
    leave(why = "highway") { return leaveTown(why); },
    load: () => load(),
    get transitioning() { return !!S.trans; },
    blocksSight,
    copRoute: c => copRoute(c),
    copSpawn: (how, fromAhead) => copSpawn(how, () => takePatrol()),
    footYaw,
    towns: TOWNS,
    debug: {
        S, C, LIFE, PL, X, gossip, luluSay, crime,
        /** Plan an exit `ahead` metres in front of her NOW (rebuilds the chunks it touches). */
        exitAhead(ahead = 320) {
            const w = ctx.world, def = townFor();
            const e = planExit(ctx.car.s + ahead, def);
            if (!e) return null;
            for (const [k, c] of [...w.chunks]) if (c.s1 > e.s - 760 && c.s0 < e.s + 220) { c.dispose(w.scene); w.chunks.delete(k); }
            w.prebuild(ctx.car.s);
            load();
            return e.s;
        },
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
