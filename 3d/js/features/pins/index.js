// ─────────────────────────────────────────────────────────────────────────
//  features/pins — 📍 PLACES ON THE MAP + PING (owner, 2026-11-27: "We need an easier way for players to see where
//  each store is maybe on the map - so they know where they wanna go - like maybe they should be able to ping it.")
//
//  A REGISTRY of the places a player might want (the shops, the realtor, the bank, city hall, the shul, the precinct /
//  courthouse / hospital, the rest areas, JFK, Ima's house, her own homes) — the 📱 🗺️ Map lists them (map.js) — and ONE
//  PING: tap a place → 📍 Ping → a tall beam at it (openworld's beacon), one quiet edge pointer with the distance
//  (together's pointers, the same pill friends get), and the objective line's lowest slot ("📍 Avenue J'adore · 0.4 mi",
//  hud.js › H.OBJ.info: it folds under anything that matters more). It points at the right exit when the place is in
//  another town and at the door once she's in its town. Arriving clears it; a new ping replaces it; ✕ Clear in the map.
//  No toast, no text, no new HUD element type. 🛍️ Where to shop (features/shops/guide.js) marks places through this.
//
//  With friends: my ping rides the state the group already sends (ctx.party.setX("pg", id)); a friend's ping shows as
//  the same beam in their colour + one quiet line on the objective line for a few seconds. No relay change.
//
//  ctx.pins = {
//    add({ id, name, icon, cat: "shops"|"town"|"help"|"mine", town?, spot?, local?: [lx, lz], lap?: m | "jfk", group?, sub?,
//          arrive?: "rest"|"jfk" }) → the place          (new places register themselves — e.g. ci/roadside's)
//    list() · get(id) · ping(id, { from }) · pingKind(key) · clear() · current · target(id?) · groups() · debug
//  }
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, emit, hook, css } from "../../core/ctx.js";
import { store, saveSoon } from "../../core/save.js";
import * as H from "../../hud.js";
import { LAP, lapS } from "../../world.js";
import { beacon, hideBeacon, hideBeacons } from "../openworld/marks.js";
import { townExits, myPos, fmtDist, friendHex, townName } from "../together/where.js";
import * as PTR from "../together/pointers.js";
import { lapPlaces, ahead } from "../world/lapmap.js";
import { seed } from "./data.js";

const PS = store("pins", { ping: null, from: "", kind: "", n: 0, arrived: 0 });
const REG = new Map();
const HEX = "#7C4DFF";
const P = { t: null, tT: 0, chip: null, text: "", fchip: null, ftext: "", fT: 0, seen: {}, fl: [] };

css("pins", `
.pin-chip { font-weight: 700; }
.pin-chip small { font-weight: 600; opacity: .8; }
`);

// ── the registry ─────────────────────────────────────────────────────────
export function add(def) {
    if (!def || !def.id || !def.name) return null;
    const p = Object.assign({ icon: "📍", cat: "town", sub: "" }, def);
    p.group = p.group || p.town || "highway";
    REG.set(p.id, p);
    return p;
}
let seeded = false;
function ensureSeed() { if (seeded) return; seeded = true; for (const p of seed()) if (!REG.has(p.id)) add(p); }
/** Her own homes (features/realestate), live. */
function myHomes() {
    try {
        const R = ctx.realestate && ctx.realestate.registry;
        if (!R || !R.listFor) return [];
        return R.listFor(null).filter(h => !h.lost).map(h => {
            const [town, lx, lz] = String(h.id).split(":");
            return { id: "mine:" + h.id, town, local: [+lx, +lz], cat: "mine", icon: "🔑", name: h.address || "Your home", sub: h.label || "your home", group: town };
        });
    } catch (e) { return []; }
}
export function list() { ensureSeed(); return [...REG.values()].filter(p => !p.hidden || !p.hidden()).concat(myHomes()); }
export function get(id) { ensureSeed(); return REG.get(id) || myHomes().find(p => p.id === id) || null; }

/** A place's lap metre (where it is along the one road): its town's exit, JFK's, or its own. */
export function lapM(p) {
    const L = lapPlaces();
    if (p.town) { const t = L.find(q => q.addr === "hw:exit:" + p.town); return t ? t.m : null; }
    if (p.lap === "jfk") { const j = L.find(q => q.addr === "hw:jfk"); return j ? j.m : null; }
    return typeof p.lap === "number" ? p.lap : null;
}
/** The map's groups, in the order she'd reach them driving on from here: [{ id, name, icon, m, ahead, places }]. */
export function groups() {
    const here = ctx.town && ctx.town.active ? ctx.town.id : "", me = lapS(ctx.town && ctx.town.active && ctx.town.highwayS != null ? ctx.town.highwayS : (ctx.car ? ctx.car.s : 0));
    const by = new Map();
    for (const p of list()) {
        const m = lapM(p);
        const g = by.get(p.group) || { id: p.group, name: p.group === "highway" ? "The highway" : p.group === "jfk" ? "JFK" : townName(p.group),
            icon: p.group === "highway" ? "🛣️" : p.group === "jfk" ? "✈️" : "🏙️", m: Infinity, places: [] };
        g.places.push(p);
        if (m != null) g.m = Math.min(g.m, m);
        by.set(p.group, g);
    }
    const out = [...by.values()];
    for (const g of out) g.ahead = g.id === here ? -1 : Number.isFinite(g.m) ? ahead(g.m, me) : 1e9;
    return out.sort((a, b) => a.ahead - b.ahead);
}

// ── where a place is, from here ──────────────────────────────────────────
const _pt = {};
const RC = new Map();
/** A town spot is its building's front: the first point out toward the street she can really stand on (unstuck's own
 *  test: not in a block, a solid, water) — so the beam stands where she can get to it. Cached per spot per town copy. */
function reach(id, w) {
    const k = `${id}@${Math.round(w.x)},${Math.round(w.z)}`;
    let r = RC.get(k);
    if (r) return r;
    r = { x: w.x, z: w.z };
    const N = ctx.unstuck && ctx.unstuck.normal, nx = w.nx || 0, nz = w.nz || 0;
    if (N) for (const o of [0.6, 2, 3.5, 5, 7, 9, 12]) {
        let why = null;
        try { why = N(w.x + nx * o, w.z + nz * o, "foot"); } catch (e) { why = null; }
        if (!why) { r = { x: w.x + nx * o, z: w.z + nz * o }; break; }
    }
    if (RC.size > 200) RC.clear();
    RC.set(k, r);
    return r;
}
/** → { kind: "at" (the place itself) | "exit" (the way there), x, z, d, label, arrived? } | null */
export function target(id = PS.ping) {
    const p = typeof id === "string" ? get(id) : id;
    if (!p || !ctx.car || !ctx.world) return null;
    const me = myPos(), T = ctx.town, inTown = T && T.active ? T.id : "";
    const out = (kind, x, z, d, label) => ({ kind, x, z, d: d == null ? Math.hypot(x - me.x, z - me.z) : d, label, id: p.id });
    // in a town that isn't the place's: the way out
    if (inTown && p.town !== inTown) {
        let best = null, bd = 1e9;
        for (const e of townExits()) { const d = Math.hypot(e.x - me.x, e.z - me.z); if (d < bd) { bd = d; best = e; } }
        const where = p.town ? `in ${townName(p.town)}` : p.group === "jfk" ? "at JFK" : "on the highway";
        return best ? out("exit", best.x, best.z, null, `${where} · head out of town`) : null;
    }
    if (p.town) {
        if (inTown === p.town) {
            let w = null;
            if (p.local && T.plan && T.plan.world) w = T.plan.world(p.local[0], p.local[1], {});
            else if (p.spot) { w = T.spot(p.spot); if (w) w = reach(p.id, w); }
            if (p.at) { try { w = p.at() || w; } catch (e) { /* keep the spot */ } }
            return w ? out("at", w.x, w.z, null, "") : null;
        }
        // on the highway: its town's next exit
        const s = T && T.exitOf ? T.exitOf(p.town) : null;
        if (s == null || !ctx.world.road) return null;
        const ex = (T.exits || []).find(e => e.town === p.town) || {};
        ctx.world.road.point(s - 60, 7, _pt);
        return out("exit", _pt.x, _pt.z, Math.max(0, s - ctx.car.s), `take the ${ex.label || townName(p.town)} exit${ex.no ? " " + ex.no : ""}`);
    }
    // a place on the highway (a rest area, JFK)
    const m = lapM(p);
    if (m == null || !ctx.world.road) return null;
    if (p.arrive === "jfk" && ctx.airport && ctx.airport.inside) return Object.assign(out("at", me.x, me.z, 0, ""), { arrived: true });
    const far = ahead(m, lapS(ctx.car.s));
    if (p.arrive === "rest" && ctx.exits && ctx.exits.inside && (far < 400 || far > LAP - 400)) return Object.assign(out("at", me.x, me.z, 0, ""), { arrived: true });
    ctx.world.road.point(ctx.car.s + far, 12, _pt);
    return out(far < 250 ? "at" : "road", _pt.x, _pt.z, far, far < 250 ? "" : "up the road");
}

/** The pinged place's id (or null). */
export const ctxCurrent = () => PS.ping;

// ── the ping ─────────────────────────────────────────────────────────────
export function ping(id, opts = {}) {
    const p = get(id);
    if (!p) return false;
    PS.ping = p.id; PS.from = opts.from || ""; PS.kind = opts.kind || ""; PS.n++;
    saveSoon();
    P.tT = 0;
    share();
    emit("pins:ping", { id: p.id, from: PS.from });
    return true;
}
export function clear(why = "clear") {
    const was = PS.ping;
    PS.ping = null; PS.from = ""; PS.kind = "";
    saveSoon();
    hideBeacon("pin"); chip("");
    P.t = null;
    share();
    if (was) emit("pins:clear", { id: was, why });
    return true;
}
/** 🛍️ Where to shop's kinds → the nearest place of that kind (this town's, else the next town's along the road). */
const KIND = { dealer: "dealer", makolet: "makolet", black: "van", bling: "bling", clothes: "clothes", pizza: "pizza", bakery: "bakery" };
export function pingKind(kind, opts = {}) {
    if (kind === "garage") return ping("home:ima", opts);
    const key = KIND[kind] || kind;
    opts = Object.assign({}, opts, { kind: key });
    const here = ctx.town && ctx.town.active ? ctx.town.id : "";
    if (here && get(`${here}:${key}`)) return ping(`${here}:${key}`, opts);
    const cands = list().filter(p => p.town && p.id === `${p.town}:${key}`);
    if (!cands.length) return false;
    const me = lapS(here && ctx.town.highwayS != null ? ctx.town.highwayS : ctx.car ? ctx.car.s : 0);
    cands.sort((a, b) => ahead(lapM(a) ?? 0, me) - ahead(lapM(b) ?? 0, me));
    return ping(cands[0].id, opts);
}
// (a ping by KIND — "a car lot" from 🛍️ Where to shop — follows her: into a town that has one, it's that town's)
on("town:enter", e => { const id = e && e.town && PS.kind ? `${e.town}:${PS.kind}` : ""; if (id && PS.ping !== id && get(id)) { PS.ping = id; saveSoon(); P.tT = 0; share(); } });
function share() { try { if (ctx.party && ctx.party.active && ctx.party.setX) ctx.party.setX("pg", PS.ping || null); } catch (e) { /* offline */ } }
on("party:status", () => share());

// ── the objective line: my ping (the lowest slot) + a friend's, for a few seconds ──
function chip(text) {
    if (!text) { if (P.chip && P.text) { P.chip.innerHTML = ""; P.chip.style.display = "none"; P.text = ""; } return; }
    if (!P.chip) {
        P.chip = document.createElement("div"); P.chip.className = "day-chip pin-chip";
        H.hudSlot("left").appendChild(P.chip);
        H.objective(P.chip, { prio: H.OBJ.info, id: "ping", icon: "📍" });
    }
    P.chip.classList.toggle("shops-dest", PS.from === "shops");
    if (text !== P.text) { P.text = text; P.chip.innerHTML = text; P.chip.style.display = ""; }
}
function fchip(text) {
    if (!P.fchip) {
        if (!text) return;
        P.fchip = document.createElement("div"); P.fchip.className = "day-chip pin-chip pin-friend";
        H.hudSlot("left").appendChild(P.fchip);
        H.objective(P.fchip, { prio: H.OBJ.info, id: "pingfriend", icon: "📍", badge: false });
    }
    if (text !== P.ftext) { P.ftext = text; P.fchip.innerHTML = text; P.fchip.style.display = text ? "" : "none"; }
}
const short = n => String(n).replace(/^The /, "the ");
const live = () => (ctx.state === "playing" || ctx.state === "footRun") && !ctx.view;

function tick(dt) {
    // my ping (10× a second)
    P.tT -= dt;
    if (P.tT <= 0) {
        P.tT = 0.1;
        P.t = PS.ping ? target(PS.ping) : null;
        if (PS.ping && P.t && (P.t.arrived || (P.t.kind === "at" && P.t.d < (get(PS.ping).home ? 9 : 12)))) {
            PS.arrived++; clear("arrived");
        }
        friendsTick();
    }
    const p = PS.ping && get(PS.ping), t = P.t;
    if (!p || !live()) { hideBeacon("pin"); chip(p && live() ? `📍 ${short(p.name)}` : ""); return; }
    if (t && (t.kind === "at" || t.d < 1200)) beacon("pin", t.x, t.z, HEX, 2.6, 34); else hideBeacon("pin");
    chip(`📍 ${short(p.name)}${t ? ` · ${fmtDist(t.d)}` : ""}`);
}
hook("hud", dt => { try { tick(dt || 1 / 60); } catch (e) { console.error("[pins]", e); } });
on("state", ({ to }) => { if (to === "title") { hideBeacons("pin"); chip(""); fchip(""); } });

/** The edge pointer (together/pointers.js asks every frame): my ping only, never in an activity. */
PTR.extra(() => {
    const p = PS.ping && get(PS.ping), t = P.t;
    if (!p || !t || t.arrived || (ctx.engaged && ctx.engaged())) return null;
    return { uid: "pin", name: `${p.icon} ${short(p.name)}`, hex: HEX, x: t.x, z: t.z, dist: t.d, label: t.label, kind: "ping", dest: true };
});

// ── friends' pings: their beam in their colour + one quiet line for a few seconds ──
function friendsTick() {
    const party = ctx.party && ctx.party.active && ctx.party.members ? ctx.party : null;
    const seen = new Set();
    if (party) for (const uid of party.members()) {
        if (uid === party.uid) continue;
        const peer = party.peer(uid), id = peer && peer.x && typeof peer.x.pg === "string" ? peer.x.pg : "";
        if (!id) { delete P.seen[uid]; continue; }
        const pl = get(id);
        if (!pl) continue;
        seen.add(uid);
        if (P.seen[uid] !== id) {
            P.seen[uid] = id;
            P.fT = 8;
            fchip(`📍 ${esc(party.displayName ? party.displayName(uid) : "A friend")} pinged ${esc(short(pl.name))}`);
        }
        const t = live() ? target(pl) : null;
        if (t && t.kind === "at" && !t.arrived) beacon("pin:f:" + uid, t.x, t.z, friendHex(uid), 2.2, 30); else hideBeacon("pin:f:" + uid);
    }
    for (const uid of Object.keys(P.seen)) if (!seen.has(uid)) { delete P.seen[uid]; hideBeacon("pin:f:" + uid); }
    if (P.fT > 0) { P.fT -= 0.1; if (P.fT <= 0) fchip(""); }
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

ctx.pins = {
    add, list, get, ping, pingKind, clear, target, groups, lapM,
    get current() { return PS.ping; },
    get from() { return PS.from; },
    debug: { PS, P, tick: dt => tick(dt || 0.2) },
};
