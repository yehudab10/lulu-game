// features/seasons — WHERE THINGS GO. Pure planning: a list of items for dress.js (kind, x, y, z, rot…), all from
// public data (a road chunk's `houses`, `ctx.town.homes` / `spot()`, `ctx.homes.homes()` doors, the house models'
// own window geometry). Every dice roll is a hash of the place (chunk index + world seed, town + house index), never
// Math.random: the same street looks the same on every visit and on every friend's screen in a 🎉 party.
import * as THREE from "three";
import { ctx } from "../../core/ctx.js";
import { models } from "../../models.js";
import { facingRoad, offLanes, SHOULDER } from "../../world.js";
import { RECIPES, TUNE } from "./data.js";

// ── tiny deterministic dice ──────────────────────────────────────────────
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const h01 = (...k) => (hash(k.join(":")) % 100000) / 100000;

// ── the front windows of a house model (from its own geometry: front-facing "Window" faces) ──
const WIN = new Map();
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();
/** [{x, y0, y1, z, w, low}] in the model's own frame (three.js: +Z = out the front), low = on the lowest row. */
export function frontWindows(key) {
    if (WIN.has(key)) return WIN.get(key);
    const t = models[key];
    if (!t) return [];
    t.updateMatrixWorld(true);
    const inv = t.matrixWorld.clone().invert();
    const boxes = [];
    t.traverse(o => {
        if (!o.isMesh) return;
        const mats = [].concat(o.material);
        if (!mats.some(m => m && /^(Window)$/.test(m.name || ""))) return;
        const m = inv.clone().multiply(o.matrixWorld), g = o.geometry, pos = g.attributes.position, idx = g.index;
        const groups = g.groups.length ? g.groups : [{ start: 0, count: idx ? idx.count : pos.count, materialIndex: 0 }];
        for (const gr of groups) {
            const mat = mats[gr.materialIndex] || mats[0];
            if (!mat || mat.name !== "Window") continue;
            for (let i = gr.start; i < gr.start + gr.count; i += 3) {
                const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
                _a.fromBufferAttribute(pos, ia).applyMatrix4(m); _b.fromBufferAttribute(pos, ib).applyMatrix4(m); _c.fromBufferAttribute(pos, ic).applyMatrix4(m);
                _n.subVectors(_b, _a).cross(_v.subVectors(_c, _a)).normalize();
                if (_n.z < 0.8) continue;                 // only the faces looking out the front
                const bx = { x0: Math.min(_a.x, _b.x, _c.x), x1: Math.max(_a.x, _b.x, _c.x), y0: Math.min(_a.y, _b.y, _c.y), y1: Math.max(_a.y, _b.y, _c.y), z: Math.max(_a.z, _b.z, _c.z) };
                const hit = boxes.find(o2 => bx.x0 <= o2.x1 + 0.02 && bx.x1 >= o2.x0 - 0.02 && bx.y0 <= o2.y1 + 0.02 && bx.y1 >= o2.y0 - 0.02 && Math.abs(bx.z - o2.z) < 0.05);
                if (hit) { hit.x0 = Math.min(hit.x0, bx.x0); hit.x1 = Math.max(hit.x1, bx.x1); hit.y0 = Math.min(hit.y0, bx.y0); hit.y1 = Math.max(hit.y1, bx.y1); hit.z = Math.max(hit.z, bx.z); }
                else boxes.push(bx);
            }
        }
    });
    // keep window-sized panes on the main front (the frontmost plane ± 1.5 m: porch roofs, balconies don't count)
    const panes = boxes.filter(b => b.x1 - b.x0 > 0.5 && b.y1 - b.y0 > 0.5);
    const yMin = panes.length ? Math.min(...panes.map(b => b.y0)) : 0;
    const out = panes.map(b => ({ x: (b.x0 + b.x1) / 2, y0: b.y0, y1: b.y1, z: b.z, w: b.x1 - b.x0, low: b.y0 < yMin + 0.6 }))
        .sort((p, q) => p.y0 - q.y0 || p.x - q.x);
    WIN.set(key, out);
    return out;
}

// a house in the world: its origin, rotation and how to turn a model-local point into a world one
function houseFrame(x, z, rot) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return { rot, at: (lx, lz) => ({ x: x + lx * c + lz * s, z: z - lx * s + lz * c }) };
}
// (a town house: model +X is −u in the world, +Z is n — homes/index.js uses the same frame)
function townFrame(h) {
    return { rot: Math.atan2(h.nx, h.nz), at: (lx, lz) => ({ x: h.x - h.ux * lx + h.nx * lz, z: h.z - h.uz * lx + h.nz * lz }) };
}

/** What stands in a house's front windows. */
function windowItems(out, key, F, recipe, day, seed) {
    if (!recipe.windows) return;
    const wins = frontWindows(key);
    const menorah = recipe.windows === "menorah";
    let candlesDone = 0;
    wins.forEach((w, i) => {
        const r = h01(seed, "w", i);
        if (menorah) {
            if (!w.low && r > (recipe.upper || 0)) return;
        } else {
            // Shabbos / Yom Tov candles: one pair per house (two for a big one), in a ground-floor window
            if (!w.low || candlesDone >= (wins.length > 6 ? 2 : 1) || r > 0.6) return;
            candlesDone++;
        }
        const s = menorah ? Math.min(1.45, Math.max(1.05, w.w * 1.15)) : 1.5;
        const lx = w.x + (menorah ? 0 : (h01(seed, "cx", i) - 0.5) * Math.max(0, w.w - 0.5));
        const p = F.at(lx, w.z + 0.04);
        out.push({ kind: menorah ? "menorah" : "candles", x: p.x, y: w.y0 + 0.02, z: p.z, rot: F.rot, s, lit: "candle", lights: menorah ? day.chanukah : 2 });
    });
}

// ── the highway: one road chunk ──────────────────────────────────────────
/** Items for a freshly built road chunk (its houses are known; it's not visible yet — a step of the sliced build). */
export function planChunk(chunk, world, day, recipes) {
    const out = [], colliders = [];
    const k = chunk.k, seed = "c" + k + ":" + world.seed;
    const road = world.highway || world.road;
    for (const rc of recipes) {
        const R = rc.recipe, id = rc.id;
        // houses: windows, a sukkah in the yard, a planter by the door, the kerb pile
        (chunk.houses || []).forEach((hh, i) => {
            const hs = seed + ":h" + i;
            const F = houseFrame(hh.x, hh.z, hh.rot);
            windowItems(out, chunk.biome && chunk.biome.houseModel || "house", F, R, day, hs + id);
            if (R.sukkah) {
                const side = h01(hs, "sk") < 0.5 ? -1 : 1;
                const up = R.sukkah === "done" || h01(hs, "up", day.heb && day.heb.d) < sukkahDone(day);
                if (h01(hs, "has") < 0.7) {
                    const p = F.at(side * 6.4, 0.6);
                    out.push({ kind: up ? "sukkah" : "sukkahFrame", x: p.x, y: 0, z: p.z, rot: F.rot, lit: up ? "lamp" : null });
                    colliders.push({ x: p.x, z: p.z, r: 1.7, kind: "sukkah" });
                }
            }
            if (R.planters && h01(hs, "pl") < R.planters + 0.25) {
                for (const sx of [-1.3, 1.3]) { const p = F.at(sx, 3.85); out.push({ kind: "planter", x: p.x, y: 0, z: p.z, rot: F.rot, s: 0.8 }); }
            }
            if (R.baskets && h01(hs, "bk") < R.baskets) { const p = F.at(0.7, 3.95); out.push({ kind: "basket", x: p.x, y: 0, z: p.z, rot: F.rot + 0.3, s: 1.2 }); }
            if (R.kerb && h01(hs, "kb") < R.kerb + 0.2) {
                const side = Math.sign(hh.d) || 1, s = hh.s + 3.4, d = side * (SHOULDER + 1.9);
                if (offLanes(s, d, 1.1, 1.1)) {
                    const p = road.point(s, d, {});
                    out.push({ kind: "kerb", x: p.x, y: 0, z: p.z, rot: facingRoad(p.h, side) });
                    colliders.push({ x: p.x, z: p.z, r: 1.0, kind: "kerbPile" });
                }
            }
        });
        // a roadside stall now and then
        if (R.stand && h01(seed, id, "stand") < 1 / TUNE.standEveryChunks && chunk.s0 > 150) {
            const s = chunk.s0 + 70 + h01(seed, "ss") * 60;
            for (const side of [1, -1]) {
                const d = side * TUNE.standD;
                // (off any lane, off reserved ground, clear of the power poles' line every 46 m and of houses)
                if (!offLanes(s, d, 1.6, 1.6) || world.isReserved(s, d, 4)) continue;
                if (side > 0 && Math.abs(((s % 46) + 46) % 46 - 23) > 19) continue;
                const p = road.point(s, d, {});
                if ((chunk.houses || []).some(hh => Math.hypot(hh.x - p.x, hh.z - p.z) < 9)) continue;
                const rot = facingRoad(p.h, side);
                out.push(standItem(R.stand, p.x, p.z, rot, id, { s, d }));
                colliders.push({ x: p.x, z: p.z, r: 1.4, kind: "stand" });
                break;
            }
        }
        // Lag BaOmer: a bonfire out in a field (well away from the road, the houses and anything reserved)
        if (R.bonfire && h01(seed, "bf") < R.bonfire) {
            const side = h01(seed, "bfs") < 0.5 ? -1 : 1, s = chunk.s0 + 60 + h01(seed, "bfx") * 80, d = side * (44 + h01(seed, "bfd") * 14);
            const p = road.point(s, d, {});
            if (!world.isReserved(s, d, 14) && !(chunk.houses || []).some(hh => Math.hypot(hh.x - p.x, hh.z - p.z) < 16)) {
                out.push({ kind: "bonfire", x: p.x, y: 0, z: p.z, rot: h01(seed, "bfr") * 6.28, lit: "fire" });
                colliders.push({ x: p.x, z: p.z, r: 1.4, kind: "bonfire" });
                for (const a of [0.6, 2.4]) {
                    const r = 2.6, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
                    out.push({ kind: "logBench", x, y: 0, z, rot: -a + Math.PI / 2 });
                }
            }
        }
    }
    return { items: out, colliders };
}
// before Sukkos the share of sukkahs already finished grows day by day (11 Tishri → ~20 %, 14 → ~90 %)
function sukkahDone(day) { const d = day.heb ? day.heb.d : 12; return Math.min(0.92, Math.max(0.15, (d - 10) * 0.24)); }

function standItem(st, x, z, rot, id, extra = {}) {
    return Object.assign({ kind: "stand", x, y: 0, z, rot, lit: "lamp", goods: st.goods, sign: { lines: st.sign, bg: st.bg, fg: st.fg }, stand: id }, extra);
}

// ── a town ───────────────────────────────────────────────────────────────
const STOOP = { town_duplex: 0.35, town_townhouses: 0.1, town_mw_house: 0.7, town_mw_rowhouse: 0.95 };
/** Items for the town she's in (ctx.town.homes + its landmark spots + homes' front doors). */
export function planTown(day, recipes) {
    const T = ctx.town, out = [], spots = [];
    if (!T || !T.active) return { items: out, stands: spots };
    const id0 = T.id || "town";
    const houses = T.homes || [];
    const doors = ctx.homes && ctx.homes.homes ? ctx.homes.homes() : [];
    for (const rc of recipes) {
        const R = rc.recipe, id = rc.id;
        houses.forEach((h, i) => {
            const hs = id0 + ":" + i;
            const F = townFrame(h);
            windowItems(out, h.key, F, R, day, hs + id);
            if (R.sukkah) {
                const up = R.sukkah === "done" || h01(hs, "up", day.heb && day.heb.d) < sukkahDone(day);
                let p = null, y = 0;
                if (h.key === "town_duplex" && h01(hs, "sk") < 0.85) { p = F.at(7.0, -0.6); y = 3.12; }        // the duplex's sukkah deck
                else if (h.key === "town_mw_house" && h01(hs, "sk") < 0.5) {                                      // a Midwood front yard
                    p = { x: h.lotX + h.nx * 1.25 - h.ux * 3.2, z: h.lotZ + h.nz * 1.25 - h.uz * 3.2 };
                }
                if (p) out.push({ kind: up ? "sukkah" : "sukkahFrame", x: p.x, y, z: p.z, rot: F.rot, s: y > 0 ? 0.98 : 0.92, lit: up ? "lamp" : null });
            }
        });
        doors.forEach((d, j) => {
            const hs = id0 + ":d" + j, n = { x: Math.sin(Math.atan2(d.ap.x - d.door.x, d.ap.z - d.door.z)), z: Math.cos(Math.atan2(d.ap.x - d.door.x, d.ap.z - d.door.z)) };
            const u = { x: n.z, z: -n.x }, rot = Math.atan2(n.x, n.z), y = STOOP[d.model] != null ? STOOP[d.model] : 0.3;
            if (R.baskets && h01(hs, "bk") < R.baskets) out.push({ kind: "basket", x: d.door.x + n.x * 0.5 + u.x * 0.45, y, z: d.door.z + n.z * 0.5 + u.z * 0.45, rot: rot + 0.3, s: 1.2 });
            if (R.planters && h01(hs, "pl") < R.planters) out.push({ kind: "planter", x: d.door.x + n.x * 0.45 - u.x * 1.05, y, z: d.door.z + n.z * 0.45 - u.z * 1.05, rot, s: 0.75 });
            if (R.kerb && h01(hs, "kb") < R.kerb) {
                // on the strip between the sidewalk and the lot, beside (not in front of) the door
                const side = h01(hs, "kbs") < 0.5 ? -1 : 1;
                out.push({ kind: "kerb", x: d.ap.x + n.x * 1.3 + u.x * side * 1.9, y: 0, z: d.ap.z + n.z * 1.3 + u.z * side * 1.9, rot: rot + (h01(hs, "kbr") - 0.5) * 0.6, s: 0.9 });
            }
        });
        // the big menorah on the lawn in front of the town hall / the shul / the yeshiva
        if (R.big) {
            for (const [name, back, along] of [["hall", 2.2, 11], ["shul", 1.25, 6.2], ["yeshiva", 0.8, 9], ["school", 0.8, 9]]) {
                const sp = T.spot && T.spot(name);
                if (!sp) continue;
                const lot = { x: sp.x - sp.nx * 2.6, z: sp.z - sp.nz * 2.6 };
                const x = lot.x - sp.nx * back + sp.ux * along, z = lot.z - sp.nz * back + sp.uz * along;
                out.push({ kind: "bigMenorah", x, y: 0, z, rot: Math.atan2(sp.nx, sp.nz), lit: "lamp", lights: day.chanukah, big: true });
                break;
            }
        }
        // the market stall: on the strip beside the bakery / the pizza shop (whichever this town has)
        if (R.stand) {
            for (const [name, along] of [["bakery", 7.5], ["pizza", 9.5], ["hall", -21], ["shul", -11]]) {
                const sp = T.spot && T.spot(name);
                if (!sp) continue;
                const x = sp.x - sp.nx * 1.45 + sp.ux * along, z = sp.z - sp.nz * 1.45 + sp.uz * along;
                const it = standItem(R.stand, x, z, Math.atan2(sp.nx, sp.nz), id);
                out.push(it);
                spots.push(it);
                break;
            }
        }
    }
    return { items: out, stands: spots };
}

/** The recipes in force today (most important first): [{id, recipe}]. Quiet days dress nothing. */
export function recipesFor(day) {
    const out = [];
    if (!day) return out;
    for (const id of day.ids || []) if (RECIPES[id]) out.push({ id, recipe: RECIPES[id] });
    // every week: the Friday bustle; Shabbos (and Yom Tov) candles after dark — unless a holiday already fills the windows
    if (day.erev && !day.quiet) out.push({ id: "friday", recipe: RECIPES.friday });
    if (day.candles && !out.some(r => r.recipe.windows)) out.push({ id: "shabbos", recipe: { windows: "candles" } });
    // on a fast day / in the Three Weeks: nothing festive (the stall stays home; candles are still candles)
    if (day.quiet) return out.filter(r => !r.recipe.stand || r.id === "shabbos").map(r => ({ id: r.id, recipe: { windows: r.recipe.windows === "candles" ? "candles" : undefined, ima: r.recipe.ima } }));
    // one stall at a time (the first recipe that has one)
    let stall = false;
    return out.map(r => { if (!r.recipe.stand) return r; if (stall) return { id: r.id, recipe: Object.assign({}, r.recipe, { stand: null }) }; stall = true; return r; });
}
