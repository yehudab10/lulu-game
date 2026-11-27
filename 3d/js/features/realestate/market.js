// features/realestate/market.js — the houses of a town as HOMES FOR SALE: every front door is one home with an
// address, a size, a price (street × size × the neighbours) and today's value (a small drift over the real days);
// which of them are listed today is a pure function of the date (the same list all day, a listing stays ~4 days).
//
// House ids are POSITION-BASED ("midwood:-212:131" = the town + the door's local x / z, rounded to a metre), not the
// index in ctx.town.homes: other features replace houses with landmarks (the index shifts), and an owned house is
// saved forever. A house that's gone from the map later is reported by `lookup()` as missing (index.js refunds it).
import { ctx } from "../../core/ctx.js";
import { BASE, STREETS, NEAR_TRAIN, NEAR_COPS, NEIGHBOURS, ROUND, MARKET, STARTER } from "./data.js";
import { registry } from "./registry.js";

// door offsets per house model (three.js: x = model +X, z = out the front) — the same as features/homes' DOORS
export const DOORS = {
    town_duplex: [[-2.8, 5.04], [2.8, 5.04]],
    town_townhouses: [[-3.9, 5.74], [1.6, 5.74], [7.1, 5.74]],
    town_mw_house: [[-2.15, 7.55]],
    town_mw_rowhouse: [[-3.6, 5.55], [1.6, 5.55], [6.8, 5.55]],
};

export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const unit = str => hash(str) / 4294967296;

// ── the real day (device-local date) — a test clock can override it ────────
export const CLOCK = { offset: 0, fixed: null };
/** Days since 1970 in the device's local time zone (+ the test clock). */
export function today() {
    if (CLOCK.fixed != null) return CLOCK.fixed;
    const d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000) + CLOCK.offset;
}

// ── the catalogue of the town she's in ────────────────────────────────────
const CAT = { town: null, n: -1, list: [], byId: new Map() };
/** The nearest street to a LOCAL point: { st, along, dist, side }. */
function nearestStreet(plan, lx, lz) {
    let best = null;
    for (const st of plan.STREETS) {
        const dx = lx - st.px, dz = lz - st.pz;
        const a = Math.max(st.a0, Math.min(st.a1, dx * st.ux + dz * st.uz));
        const px = st.px + st.ux * a, pz = st.pz + st.uz * a;
        const d = Math.hypot(lx - px, lz - pz);
        if (!best || d < best.dist) best = { st, along: a, dist: d, side: Math.sign(dx * st.rx + dz * st.rz) || 1 };
    }
    return best;
}
/** A street address for a local point of the town she's in ("12 Avenue J"), the way the homes are numbered. */
export function addressAt(lx, lz) {
    const plan = ctx.town && ctx.town.plan, ns = plan && nearestStreet(plan, lx, lz), st = ns && ns.st;
    if (!st) return "";
    return `${100 + 2 * Math.max(0, Math.round((ns.along - st.a0) / 6)) + (ns.side > 0 ? 1 : 0)} ${st.name}`;
}
const round = v => Math.max(ROUND, Math.round(v / ROUND) * ROUND);

/** Is this the family's own house (never for sale)? — ci/hometown's home in Midwood (the `luluHome` lot), by position. */
function isFamily(x, z) {
    try { if (ctx.home && typeof ctx.home.isFamily === "function" && ctx.home.isFamily(x, z)) return true; } catch (e) { /* */ }
    try { if (ctx.family && typeof ctx.family.isFamily === "function" && ctx.family.isFamily(x, z)) return true; } catch (e) { /* */ }     // (Fayge's house: features/family)
    const sp = ctx.town && ctx.town.spot ? (ctx.town.spot("home") || ctx.town.spot("luluHome")) : null;
    return !!(sp && Math.hypot(sp.x - x, sp.z - z) < 14);
}

/** Every home of the town she's in (built on demand, cached while the town stands). */
export function catalogue() {
    const T = ctx.town;
    if (!T || !T.active || !T.def || !T.plan) { CAT.town = null; CAT.list = []; CAT.byId.clear(); return CAT.list; }
    const homes = T.homes || [];
    // (keyed by WHERE the town stands too: every lap of the road has its own copy of each town — the same addresses,
    //  other world coords; a list from lap 1 put lap 2's signs / doors / mailboxes back on lap 1's spots)
    const at = homes.length ? `${T.def.id}@${Math.round(homes[0].x)},${Math.round(homes[0].z)}` : T.def.id;
    if (CAT.town === at && CAT.n === homes.length && CAT.list.length) return CAT.list;
    CAT.town = at; CAT.n = homes.length; CAT.list = []; CAT.byId.clear();
    const def = T.def, plan = T.plan, town = def.id;
    const cops = ["precinct", "court"].map(k => T.spot && T.spot(k)).filter(Boolean);
    homes.forEach((h, hi) => {
        const D = DOORS[h.key], B = BASE[h.key];
        if (!D || !B || h.face === "shtiebel") return;
        const mx = -h.ux, mz = -h.uz;            // the model's +X in the world is −u
        D.forEach(([lx, lz], j) => {
            const door = { x: h.x + mx * lx + h.nx * lz, z: h.z + mz * lx + h.nz * lz };
            const t2 = (door.x - h.lotX) * h.ux + (door.z - h.lotZ) * h.uz;
            const lot = { x: h.lotX + h.ux * t2, z: h.lotZ + h.uz * t2 };
            const ap = { x: lot.x + h.nx * 0.7, z: lot.z + h.nz * 0.7 };
            const L = plan.local(door.x, door.z, {});
            const id = `${town}:${Math.round(L.x)}:${Math.round(L.z)}`;
            if (CAT.byId.has(id)) return;
            const ns = nearestStreet(plan, L.x, L.z);
            const st = ns && ns.st;
            const number = 100 + 2 * Math.max(0, Math.round((ns.along - st.a0) / 6)) + (ns.side > 0 ? 1 : 0);
            // price: size × street × train / cops × the neighbours
            const why = [];
            let f = 1;
            const S = st && STREETS[st.name];
            if (S) { f *= S.f; why.push(S.spin); }
            if (def.rail && Math.abs(L.x - def.rail.x) < 40) { f *= NEAR_TRAIN.f; why.push(NEAR_TRAIN.spin); }
            if (cops.some(c => Math.hypot(c.x - door.x, c.z - door.z) < 45)) { f *= NEAR_COPS.f; why.push(NEAR_COPS.spin); }
            const nb = unit(id + ":nb") < 0.34 ? NEIGHBOURS[Math.floor(unit(id + ":nbk") * NEIGHBOURS.length)] : null;
            if (nb) f *= nb.f;
            // the sign: on the lawn just inside the lot, beside the front walk (toward the open side of the unit)
            const sideU = lx >= 0 ? -1 : 1;          // (model +X is −u)
            const sign = { x: lot.x - h.nx * 0.7 + h.ux * sideU * 1.9, z: lot.z - h.nz * 0.7 + h.uz * sideU * 1.9 };
            const rec = {
                id, town, house: hi, j, model: h.key, kind: B.kind, label: B.label, rooms: B.rooms, blurb: B.blurb,
                street: st ? st.name : "", number, address: `${number} ${st ? st.name : ""}`.trim(),
                price: round(B.price * f), nb: nb ? nb.id : null, nbLine: nb ? nb.line : null, why,
                door, lot, ap, sign, ux: h.ux, uz: h.uz, nx: h.nx, nz: h.nz, lx: Math.round(L.x), lz: Math.round(L.z),
                family: isFamily(door.x, door.z),          // (ci/hometown's lot `luluHome`, Midwood block 4,2 w: by its spot)
            };
            CAT.list.push(rec); CAT.byId.set(id, rec);
        });
    });
    return CAT.list;
}
/** A home of the town she's in, by id (null when it isn't standing here). */
export function lookup(id) { catalogue(); return CAT.byId.get(id) || null; }

/** Today's value of a home (its price × a small drift over the real days: never more than ±MARKET.drift). */
export function valueOf(rec, day = today()) {
    const ph = unit(rec.id + ":ph");
    return round(rec.price * (1 + MARKET.drift * Math.sin(2 * Math.PI * (day / MARKET.period + ph))));
}

/** The starter homes of the town she's in: its STARTER.perTown cheapest homes nobody owns (always on the market). */
const ST = { at: -1, key: "", ids: new Set() };
export function starters() {
    const t = Math.floor(performance.now() / 1000), key = `${CAT.town}:${CAT.n}`;
    if (ST.at === t && ST.key === key) return ST.ids;
    ST.at = t; ST.key = key;
    ST.ids = new Set(catalogue().filter(r => !r.family && !registry.ownerOf(r.id)).sort((a, b) => a.price - b.price || (a.id < b.id ? -1 : 1)).slice(0, STARTER.perTown).map(r => r.id));
    return ST.ids;
}
export const isStarter = rec => !!rec && starters().has(rec.id);
/** Is this home on the market today? (deterministic: the date + the house; never hers / anybody's / the family's;
 *  a starter home always is) */
export function isListed(rec, day = today()) {
    if (!rec || rec.family) return false;
    if (registry.ownerOf(rec.id)) return false;
    if (isStarter(rec)) return true;
    const n = CAT.town && CAT.town.split("@")[0] === rec.town ? Math.max(1, CAT.list.length) : 200;
    const ph = Math.floor(unit(rec.id + ":w") * MARKET.listDays);
    const win = Math.floor((day + ph) / MARKET.listDays);
    return unit(`${rec.id}:${win}`) < MARKET.perTown / n;
}
/** Today's listings in the town she's in: [rec…] (by price, cheapest first). */
export function listings(day = today()) {
    return catalogue().filter(r => isListed(r, day)).sort((a, b) => valueOf(a, day) - valueOf(b, day));
}
export { CAT };
