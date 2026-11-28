// features/pins — the 📱 🗺️ Map's places: the picture (in a town: its streets from above with every place an icon where
// it really is; on the highway: the lap ring with each town's places fanned beside its exit, the 📍 ping marked) and the
// list under it, grouped by where it is along the lap in the order she'd reach them, with a filter row
// (🛍️ Shops · 🏛️ Town · 🚑 Help · 🏠 Mine). Tap a place → 📍 Ping (or ✕ Clear ping). Used by phone/apps.js (solo) and
// together/map.js (with friends) — one card, both maps.
import { ctx, css } from "../../core/ctx.js";
import { LAP } from "../../world.js";
import { toL, myPos, fmtDist } from "../together/where.js";
import * as PN from "./index.js";

css("pins-map", `
.lphone .pin-new { color: #E91E63; font-style: normal; font-size: 10px; vertical-align: middle; }
.lphone .pin-filter { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 2px 0 4px; }
.lphone .pin-filter .btn.lp-mini { min-height: 40px; padding: 0 2px; font-size: 12px; width: auto; color: #2b1838; }
.lphone .pin-filter .btn.lp-mini.on { background: #fff; box-shadow: inset 0 0 0 2px var(--pink, #E91E63); }
.lphone .btn.lp-mini.pin-go { background: #7C4DFF; color: #fff; }
.pin-grp { display: flex; justify-content: space-between; align-items: baseline; margin: 8px 2px 3px; font: 700 12px var(--font);
  letter-spacing: .06em; text-transform: uppercase; color: rgba(43,27,46,.62); }
.pin-grp span { letter-spacing: 0; text-transform: none; font-weight: 600; }
.pin-row.on { box-shadow: inset 0 0 0 2px #7C4DFF; }
.lphone .lp-card.pin-now { display: flex; flex-direction: row; gap: 8px; align-items: center; padding: 8px 10px; }
.lphone .pin-now .lp-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.lphone .pin-now .lp-tx small { display: block; opacity: .75; }
.lphone .pin-now .btn.lp-mini { flex: none; width: auto; min-height: 34px; padding: 0 12px; color: #2b1838; }
body.tv .lphone .pin-filter .btn.lp-mini { font-size: 18px; min-height: 52px; } body.tv .pin-grp { font-size: 17px; }
`);

const F = { cat: "", sel: null, pts: [], here: null };
const CATS = [["", "All"], ["shops", "🛍️ Shops"], ["town", "🏛️ Town"], ["help", "🚑 Help"], ["mine", "🏠 Mine"]];
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const inTown = () => (ctx.town && ctx.town.active ? ctx.town.id : "");

/** The list card (HTML). */
export function html() {
    const cur = PN.get(PN.ctxCurrent());
    const groups = PN.groups();
    let out = "";
    if (cur) {
        const t = PN.target(cur.id);
        out += `<div class="lp-card pin-now"><span class="lp-av">📍</span><span class="lp-tx"><b>${esc(cur.name)}</b><small>${t ? esc(t.label || "follow the light") + " · " + fmtDist(t.d) : "pinned"}</small></span>
            <button class="btn lp-mini" id="pinClear">✕ Clear</button></div>`;
    }
    out += `<div class="pin-filter">${CATS.map(([k, l]) => `<button class="btn lp-mini${F.cat === k ? " on" : ""}" data-pcat="${k}">${l}</button>`).join("")}</div>`;
    const here = inTown(), me = myPos();
    for (const g of groups) {
        const ps = g.places.filter(p => PN.shown(p) && (!F.cat || p.cat === F.cat));
        if (!ps.length) continue;
        const far = g.ahead < 0 ? "you're here" : g.ahead < 200 ? "right here" : g.ahead < 1e8 ? `${fmtDist(g.ahead)} up the road` : "";
        out += `<div class="pin-grp">${g.icon} ${esc(g.name)} <span>${far}</span></div>`;
        for (const p of ps) {
            let meta = "";
            if (here && p.town === here) { const t = PN.target(p.id); if (t && t.kind === "at") meta = fmtDist(Math.hypot(t.x - me.x, t.z - me.z)); }
            // (QA 2026-11-27: ONE tap pings — the row used to open a drawer holding only "📍 Ping"; the pinned row says ✕)
            const on = cur && cur.id === p.id, sel = F.sel === p.id;
            out += `<button class="btn lp-row pin-row${on ? " on" : ""}${sel ? " sel" : ""}" data-pin="${esc(p.id)}"><span class="lp-av">${p.icon}</span><span class="lp-tx"><b>${esc(p.name)}${PN.isFresh(p.id) ? ' <i class="pin-new" title="new">●</i>' : ""}</b><small>${esc(p.sub || "")}${on ? " · 📍 pinned — tap to clear" : F.here === p.id ? " · 📍 you're here!" : ""}</small></span><span class="lp-meta">${on ? "✕" : meta || "📍"}</span></button>`;
        }
    }
    out += `<p class="lp-fine">📍 Ping a place: a light over it, a little arrow at the edge of the screen and how far. New places show up here once you've walked past them.</p>`;
    setTimeout(() => PN.seenFresh(), 2500);          // (the "new" dots: seen once the list has been on screen a moment)
    return out;
}
/** Wire the card (after its HTML is in el). */
export function bind(el, api) {
    const q = (s, f) => el.querySelectorAll(s).forEach(b => b.addEventListener("click", () => f(b)));
    q("[data-pcat]", b => { F.cat = b.dataset.pcat; api.refresh(); });
    q("[data-pin]", b => {
        const cur = PN.ctxCurrent(); F.sel = null;
        if (cur === b.dataset.pin) { PN.clear(); api.refresh(); return; }
        // (she's standing at it: a ping would be "arrived" the same moment and the phone just closed on nothing — the row
        //  says so instead and the phone stays open; sweep-health, qa26)
        if (PN.arrivedAt(b.dataset.pin)) { F.here = b.dataset.pin; api.refresh(); return; }
        F.here = null;
        PN.ping(b.dataset.pin, { from: "map" }); api.close();
    });
    q("#pinClear", () => { PN.clear(); F.sel = null; api.refresh(); });
    const cv = el.querySelector("canvas.pin-map");
    if (cv) cv.addEventListener("click", ev => {
        const r = cv.getBoundingClientRect(), k = cv.width / Math.max(1, r.width);
        const x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k;
        let best = null, bd = 30 * (cv.__u || 1);
        for (const p of F.pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
        if (!best) return;
        F.sel = best.id; F.cat = "";
        api.refresh();
        const row = el.querySelector(`[data-pin="${CSS.escape(best.id)}"]`);
        if (row && row.scrollIntoView) row.scrollIntoView({ block: "center" });
    });
}

// ── the picture ──────────────────────────────────────────────────────────
const EMO = `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`;
function icon(g, U, x, y, ic, on, sz = 13) {
    if (on) { g.beginPath(); g.arc(x, y, 11 * U, 0, Math.PI * 2); g.fillStyle = "rgba(124,77,255,.28)"; g.fill(); g.lineWidth = 2 * U; g.strokeStyle = "#7C4DFF"; g.stroke(); }
    else { g.beginPath(); g.arc(x, y, 8.5 * U, 0, Math.PI * 2); g.fillStyle = "rgba(255,255,255,.85)"; g.fill(); }
    g.font = `${sz * U}px ${EMO}`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(ic, x, y + 0.5 * U);
}
/** In a town: its streets from above (north up, like the friends' map), every place of this town where it is, me. → true if drawn. */
export function drawTown(cv) {
    const T = ctx.town, plan = T && T.active && T.plan;
    if (!plan) return false;
    const g = cv.getContext("2d"), W = cv.width, Hh = cv.height, U = cv.__u || 1;
    g.clearRect(0, 0, W, Hh); g.fillStyle = "#E8F0E2"; g.fillRect(0, 0, W, Hh);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    const segs = plan.STREETS.filter(st => st !== plan.APPROACH).map(st => {
        let a, b;
        if (st.axis === "ns") { a = { x: st.c, z: st.a0 }; b = { x: st.c, z: st.a1 }; }
        else if (st.axis === "ew") { a = { x: st.a0, z: st.c }; b = { x: st.a1, z: st.c }; }
        else { a = { x: st.px + st.ux * st.a0, z: st.pz + st.uz * st.a0 }; b = { x: st.px + st.ux * st.a1, z: st.pz + st.uz * st.a1 }; }
        for (const p of [a, b]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
        return [a, b];
    });
    const pad = 20 * U, sc = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (Hh - pad * 2) / Math.max(1, z1 - z0));
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const lpx = x => W / 2 - (x - cx) * sc, lpy = z => Hh / 2 - (z - cz) * sc;
    const px = (x, z) => lpx(toL(plan, x, z).x), py = (x, z) => lpy(toL(plan, x, z).z);
    g.lineCap = "round"; g.strokeStyle = "#fff"; g.lineWidth = Math.max(4 * U, 9 * sc);
    for (const [a, b] of segs) { g.beginPath(); g.moveTo(lpx(a.x), lpy(a.z)); g.lineTo(lpx(b.x), lpy(b.z)); g.stroke(); }
    g.strokeStyle = "rgba(120,110,100,.35)"; g.lineWidth = 1 * U;
    for (const [a, b] of segs) { g.beginPath(); g.moveTo(lpx(a.x), lpy(a.z)); g.lineTo(lpx(b.x), lpy(b.z)); g.stroke(); }
    const cur = PN.ctxCurrent(), cl = v => Math.max(11 * U, Math.min(W - 11 * U, v)), clY = v => Math.max(11 * U, Math.min(Hh - 11 * U, v));
    F.pts = [];
    let pin = null;
    for (const p of PN.list()) {
        if (p.town !== T.id || !PN.shown(p) || (F.cat && p.cat !== F.cat && p.id !== cur)) continue;
        const t = PN.target(p.id);
        if (!t || t.kind !== "at") continue;
        const x = cl(px(t.x, t.z)), y = clY(py(t.x, t.z));
        if (p.id === cur) { pin = { x, y, p }; continue; }
        icon(g, U, x, y, p.icon, false);
        F.pts.push({ id: p.id, x, y });
    }
    if (pin) { icon(g, U, pin.x, pin.y, pin.p.icon, true, 15); F.pts.push({ id: pin.p.id, x: pin.x, y: pin.y }); }
    // me: a pink arrow (the map never spins: a local heading h points it at −h)
    const me = myPos(), h = ctx.foot && ctx.foot.active && ctx.foot.facing != null ? ctx.foot.facing : ctx.car.h;
    g.save(); g.translate(px(me.x, me.z), py(me.x, me.z)); g.rotate(-(h + (plan.ROT || 0))); g.scale(U, U);
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath();
    g.fillStyle = "#E91E63"; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke(); g.restore();
    return true;
}
/** On the highway, over world/lapmap.js's ring: each town's / JFK's places fanned outside its tick, the pinged one ringed. */
export function overlayLap(cv) {
    const g = cv.getContext("2d"), W = cv.width, Hh = cv.height, U = cv.__u || 1;
    const cx = W * 0.5, cy = Hh * 0.5, R = Math.min(W * 0.36, Hh * 0.38);      // (the same ring as drawLap)
    const cur = PN.ctxCurrent();
    F.pts = [];
    for (const gr of PN.groups()) {
        if (gr.id === "highway" || !Number.isFinite(gr.m)) continue;
        const ps = gr.places.filter(p => PN.shown(p) && (!F.cat || p.cat === F.cat || p.id === cur));
        const a = gr.m / LAP * Math.PI * 2 - Math.PI / 2, n = Math.min(ps.length, 16), row = Math.ceil(n / 2);
        // (one or two short arcs of icons just outside the town's own emoji, along the ring)
        ps.slice(0, n).forEach((p, i) => {
            const k = n > 8 ? (i < row ? 0 : 1) : 0, j = n > 8 ? (k ? i - row : i) : i, m = n > 8 ? (k ? n - row : row) : n;
            const rr = R + (40 + k * 17) * U, step = (15 * U) / rr;
            const b = a + (j - (m - 1) / 2) * step;
            const x = Math.max(9 * U, Math.min(W - 9 * U, cx + Math.cos(b) * rr)), y = Math.max(9 * U, Math.min(Hh - 9 * U, cy + Math.sin(b) * rr));
            icon(g, U, x, y, p.icon, p.id === cur, 10);
            F.pts.push({ id: p.id, x, y });
        });
    }
    // a pinned rest area: ringed on the ring itself
    const p = cur && PN.get(cur);
    if (p && p.group === "highway") { const m = PN.lapM(p); if (m != null) { const a = m / LAP * Math.PI * 2 - Math.PI / 2; icon(g, U, cx + Math.cos(a) * (R + 22 * U), cy + Math.sin(a) * (R + 22 * U), p.icon, true, 14); } }
}
export const mapDebug = { F, pts: () => F.pts.map(p => ({ ...p })) };
