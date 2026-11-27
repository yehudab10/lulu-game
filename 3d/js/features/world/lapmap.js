// features/world/lapmap.js — 🌍 ONE WORLD (ci/onemap stage 3): the ONE map of the whole world.
//
// The highway is a 16 km lap (world.js LAP) and every place on it stands once, at a fixed lap metre — so the map is a
// ring: the lap line at the top, the road clockwise, every place a tick with its name, "you are here" (an arrow on the
// ring, or at your town's exit when you're in town) and friends as dots in their colours.
//   lapPlaces()            → [{ addr, name, emoji, m (lap metre), kind }] sorted by m — the same list on every screen
//   ahead(m, from)         → metres from lap metre `from` on to `m` (the road only goes one way)
//   miles(m)               → "3.1 mi"
//   drawLap(cv, { me, dots }) draws into a canvas; me / dots: { m (lap metre), hex?, name?, here? } → the dots (canvas px)
// Used by the 📱 🗺️ Map (solo, phone/apps.js) and the 👯 friends' map on the highway (together/map.js).
import { ctx } from "../../core/ctx.js";
import { LAP, lapS } from "../../world.js";
import { REST } from "../exits/index.js";
import { NAMES } from "../exits/lines.js";
import { GAS_LAP, LOOK_LAP } from "./places.js";
import { ROADSIDE } from "../places/roadside.js";

let CACHE = null;
/** Every place on the lap, from fixed data (the towns' + JFK's lap metres are planned once, the same everywhere). */
export function lapPlaces() {
    if (CACHE) return CACHE;
    const out = [];
    const T = ctx.town;
    if (T && T.towns && T.exitOf) for (const id of Object.keys(T.towns)) {
        let s = null;
        try { s = T.exitOf(id, 0); } catch (e) { s = null; }
        if (s == null) continue;
        const d = T.towns[id];
        out.push({ addr: "hw:exit:" + id, name: d.name, emoji: d.emoji || "🏙️", m: lapS(s), kind: "town" });
    }
    try { const z = ctx.airport && ctx.airport.zones ? ctx.airport.zones(0, LAP) : []; if (z.length) out.push({ addr: "hw:jfk", name: "JFK", emoji: "✈️", m: lapS(z[0].s), kind: "airport" }); } catch (e) { /* off */ }
    REST.lap.forEach((m, i) => out.push({ addr: "hw:rest:" + i, name: NAMES[i % NAMES.length].short, emoji: "🅿️", m, kind: "rest" }));
    GAS_LAP.forEach((m, i) => out.push({ addr: "hw:gas:" + i, name: "Gas 'n' Go", emoji: "⛽", m, kind: "gas" }));
    LOOK_LAP.forEach((m, i) => out.push({ addr: "hw:lookout:" + i, name: "the Lookout", emoji: "🌄", m, kind: "lookout" }));
    // 🚔🚑 the roadside trooper post + traffic court, Hatzalah, Doc-in-a-Box (features/places/roadside.js — ci/roadside)
    for (const R of ROADSIDE) out.push({ addr: R.addr, name: R.id === "trooper" ? "Trooper Post 13 + Traffic Court" : R.name, emoji: R.emoji, m: R.m, kind: "roadside" });
    out.sort((a, b) => a.m - b.m);
    // (only cache once the towns' exits could be planned — a world exists)
    if (ctx.world && ctx.world.highway) CACHE = out;
    return out;
}
export const ahead = (m, from) => ((m - from) % LAP + LAP) % LAP;
export const miles = m => `${(Math.max(0, m) / 1609).toFixed(1)} mi`;

/** Where she is on the lap: on the highway her lap metre; in a town its exit's. */
export function myLapM() {
    const T = ctx.town;
    if (T && T.active && T.highwayS != null) return lapS(T.highwayS);
    return lapS(ctx.car ? ctx.car.s : 0);
}

/** Draw the ring into a canvas (sized by the caller). → [{ uid?, x, y }] for the dots drawn. */
export function drawLap(cv, { me = null, dots = [] } = {}) {
    const g = cv.getContext("2d"), W = cv.width, H = cv.height, U = cv.__u || 1;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#E8F0E2"; g.fillRect(0, 0, W, H);
    const cx = W * 0.5, cy = H * 0.5, R = Math.min(W * 0.36, H * 0.38);
    const at = (m, r = R) => { const a = m / LAP * Math.PI * 2 - Math.PI / 2; return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a }; };
    // the road
    g.strokeStyle = "#9E9E9E"; g.lineWidth = 12 * U; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = "#FFD54F"; g.lineWidth = 1.5 * U; g.setLineDash([5 * U, 7 * U]); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    // the lap line
    const l0 = at(0, R - 9 * U), l1 = at(0, R + 9 * U);
    g.strokeStyle = "#2b1b2e"; g.lineWidth = 2 * U; g.beginPath(); g.moveTo(l0.x, l0.y); g.lineTo(l1.x, l1.y); g.stroke();
    // the places: big ones (towns, JFK, rest areas) named outside the ring; the pull-ins small ticks
    g.textBaseline = "middle";
    for (const p of lapPlaces()) {
        const big = p.kind === "town" || p.kind === "airport" || p.kind === "rest";
        const a = at(p.m), o = at(p.m, R + (big ? 22 : 12) * U);
        g.font = `${big ? 15 : 10}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; g.textAlign = "center";
        g.fillText(p.emoji, o.x, o.y);
        if (big) {
            // (the names INSIDE the ring — on a phone the canvas is narrow and the sides clip)
            const t = at(p.m, R - 16 * U), left = Math.cos(a.a) > 0.2, right = Math.cos(a.a) < -0.2;
            g.font = `700 ${10 * U}px Fredoka, Arial, sans-serif`; g.fillStyle = "#2b1b2e";
            g.textAlign = left ? "right" : right ? "left" : "center";
            g.fillText(p.kind === "rest" ? "Rest area" : p.name, t.x, t.y + (left || right ? 0 : (Math.sin(a.a) < 0 ? 6 : -6) * U));
        }
    }
    const pts = [];
    for (const d of dots) {
        if (d.m == null) continue;
        const p = at(d.m, R + (d.here ? 0 : -16 * U));
        g.fillStyle = d.hex || "#E91E63"; g.strokeStyle = "#fff"; g.lineWidth = 2 * U;
        g.beginPath(); g.arc(p.x, p.y, 6 * U, 0, Math.PI * 2); g.fill(); g.stroke();
        if (d.name) { g.font = `700 ${10 * U}px Fredoka, Arial, sans-serif`; g.fillStyle = "#2b1b2e"; g.textAlign = "center"; g.fillText(d.name, p.x, p.y - 12 * U); }
        pts.push({ uid: d.uid, x: p.x, y: p.y });
    }
    if (me && me.m != null) {
        // "you are here": a white arrow on the ring, pointing along the road (clockwise)
        const p = at(me.m), h = p.a + Math.PI / 2, s = 8 * U;
        g.save(); g.translate(p.x, p.y); g.rotate(h);
        g.fillStyle = "#fff"; g.strokeStyle = "#E91E63"; g.lineWidth = 2.5 * U;
        g.beginPath(); g.moveTo(s * 1.3, 0); g.lineTo(-s, s * 0.85); g.lineTo(-s * 0.4, 0); g.lineTo(-s, -s * 0.85); g.closePath(); g.fill(); g.stroke();
        g.restore();
    }
    return pts;
}
