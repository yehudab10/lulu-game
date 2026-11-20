// features/together — the 📱 🗺️ MAP with friends (a 🎉 party's Free Roam; solo, the 🗺️ app is still the story map).
// One clean picture + one row per friend:
//   • in a town: the town's streets from above (north up), the ramps out, me (a white arrow) and every friend in
//     town as a small dot in their colour with their name; a friend inside a house sits at its door (🏠)
//   • on the highway: the road as one straight strip (ahead = up), the town exits on it, me, and every friend on
//     the highway or in a town (at that town's exit)
// Tap a dot or a row → a DESTINATION: one soft beam over that friend in the world + their pointer stays on with
// the distance (features/together/index.js). Tap it again → cleared. Plus the 🧭 pointers switch.
import { ctx, css } from "../../core/ctx.js";
import { locateAll, locate, myPos, myZone, zoneOf, townName, friendHex, friends, townExits, fmtDist } from "./where.js";

css("together-map", `
.tg-map { position: relative; border-radius: 16px; overflow: hidden; background: #E8F0E2; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08); margin: 2px 0 8px; }
.tg-map canvas { display: block; width: 100%; height: auto; touch-action: manipulation; cursor: pointer; }
.tg-map .cap { position: absolute; left: 8px; top: 6px; font: 700 11px var(--font); letter-spacing: .1em; color: rgba(43,27,46,.6); text-transform: uppercase; pointer-events: none; }
.tg-row .lp-av i { display: inline-block; width: 14px; height: 14px; border-radius: 50%; box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,.15); }
.tg-row.on { box-shadow: inset 0 0 0 2px var(--c, #E91E63); }
`);

const V = { pts: [], key: "" };

/** A friend's place along the highway (s): on it, or at their town's exit. */
function hwyS(l) {
    const p = ctx.party.peer(l.uid);
    if (!p) return null;
    if (!l.zone) { const sm = p.samples && p.samples.length ? p.samples[p.samples.length - 1] : null; return sm ? sm.s : null; }
    const ex = p.x && +p.x.ex;
    if (ex) return ex;
    const e = (ctx.town && ctx.town.exits ? ctx.town.exits : []).filter(e => e.town === l.zone).sort((a, b) => Math.abs(a.s - ctx.car.s) - Math.abs(b.s - ctx.car.s))[0];
    return e ? e.s : null;
}
/** Size the canvas to its box on screen (sharp on a phone, readable labels). */
function fit(cv) {
    const w = Math.max(200, cv.clientWidth || 300), dpr = Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 1));
    const W = Math.round(w * dpr), Hh = Math.round(w * 0.62 * dpr);
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    cv.__u = dpr;
}

/** Draw the map into the canvas; returns the friends' dots (canvas px) for tapping. */
function draw(cv, list, dest) {
    const g = cv.getContext("2d"), W = cv.width, Hh = cv.height, U = cv.__u || 1;     // U = canvas px per CSS px
    g.clearRect(0, 0, W, Hh);
    const me = myPos(), Z = myZone(), pts = [];
    const dot = (x, y, hex, label, ring, icon) => {
        g.beginPath(); g.arc(x, y, (ring ? 7 : 6) * U, 0, Math.PI * 2);
        g.fillStyle = hex; g.fill(); g.lineWidth = 2 * U; g.strokeStyle = "#fff"; g.stroke();
        if (ring) { g.beginPath(); g.arc(x, y, 10.5 * U, 0, Math.PI * 2); g.lineWidth = 2 * U; g.strokeStyle = hex; g.stroke(); }
        if (icon) { g.font = `${11 * U}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(icon, x - 12 * U, y - 8 * U); }
        if (label) {
            g.font = `700 ${12 * U}px Fredoka, Arial, sans-serif`; g.textAlign = "left"; g.textBaseline = "middle";
            const tw = g.measureText(label).width, lx = Math.min(W - tw - 6 * U, x + 10 * U);
            g.lineWidth = 3 * U; g.strokeStyle = "rgba(255,255,255,.92)"; g.strokeText(label, lx, y + 1);
            g.fillStyle = "#2b1b2e"; g.fillText(label, lx, y + 1);
        }
    };
    const meArrow = (x, y, rot) => {
        g.save(); g.translate(x, y); g.rotate(rot);
        g.scale(U, U);
        g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath();
        g.fillStyle = "#E91E63"; g.fill(); g.lineWidth = 2; g.strokeStyle = "#fff"; g.stroke();
        g.restore();
    };
    const T = ctx.town, plan = Z && T && T.plan;
    if (plan) {
        // ── a town, north up: fit the streets' bounds ──
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        const segs = plan.STREETS.map(st => {
            const a = { x: plan.ORIGIN.x + st.px + st.ux * st.a0, z: plan.ORIGIN.z + st.pz + st.uz * st.a0 };
            const b = { x: plan.ORIGIN.x + st.px + st.ux * st.a1, z: plan.ORIGIN.z + st.pz + st.uz * st.a1 };
            if (st.axis === "ns") { a.x = b.x = plan.ORIGIN.x + st.c; a.z = plan.ORIGIN.z + st.a0; b.z = plan.ORIGIN.z + st.a1; }
            if (st.axis === "ew") { a.z = b.z = plan.ORIGIN.z + st.c; a.x = plan.ORIGIN.x + st.a0; b.x = plan.ORIGIN.x + st.a1; }
            for (const p of [a, b]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
            return [a, b];
        });
        const pad = 18 * U, sc = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (Hh - pad * 2) / Math.max(1, z1 - z0));
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        // a fixed orientation (world +z up, +x left — a heading h points the arrow at −h): the map never spins
        const px = x => W / 2 - (x - cx) * sc, py = z => Hh / 2 - (z - cz) * sc;
        g.lineCap = "round";
        g.strokeStyle = "#FFFFFF"; g.lineWidth = Math.max(4 * U, 9 * sc);
        for (const [a, b] of segs) { g.beginPath(); g.moveTo(px(a.x), py(a.z)); g.lineTo(px(b.x), py(b.z)); g.stroke(); }
        g.strokeStyle = "rgba(120,110,100,.35)"; g.lineWidth = 1 * U;
        for (const [a, b] of segs) { g.beginPath(); g.moveTo(px(a.x), py(a.z)); g.lineTo(px(b.x), py(b.z)); g.stroke(); }
        for (const e of townExits()) {
            const x = px(e.x), y = py(e.z);
            g.font = `${12 * U}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText("🛣️", Math.max(10 * U, Math.min(W - 10 * U, x)), Math.max(10 * U, Math.min(Hh - 10 * U, y)));
        }
        for (const l of list) {
            if (l.zone !== Z || l.kind === "exit") continue;
            const x = Math.max(10 * U, Math.min(W - 10 * U, px(l.x))), y = Math.max(10 * U, Math.min(Hh - 10 * U, py(l.z)));
            dot(x, y, l.hex, l.name, l.uid === dest, l.inside ? "🏠" : l.foot ? "🚶‍♀️" : "");
            pts.push({ uid: l.uid, x, y });
        }
        const h = ctx.foot && ctx.foot.active && ctx.foot.facing != null ? ctx.foot.facing : ctx.car.h;
        meArrow(px(me.x), py(me.z), -h);
        return pts;
    }
    // ── the highway: one straight strip, ahead = up — zoomed to fit the friends (and the next exit) ──
    const s0 = ctx.car.s, cx = W * 0.4;
    let far = 300;
    for (const l of list) { const s1 = hwyS(l); if (s1 != null) far = Math.max(far, Math.abs(s1 - s0) * 1.25); }
    const nx = (ctx.town && ctx.town.exits ? ctx.town.exits : []).filter(e => e.s > s0).sort((a, b) => a.s - b.s)[0];
    if (nx && nx.s - s0 < 4000) far = Math.max(far, (nx.s - s0) * 1.15);
    const span = Math.min(6000, far);
    const py = s => Hh / 2 - (s - s0) / span * (Hh / 2 - 14 * U);
    g.fillStyle = "#9E9E9E"; g.fillRect(cx - 7 * U, 0, 14 * U, Hh);
    g.strokeStyle = "#FFD54F"; g.lineWidth = 1.5 * U; g.setLineDash([6 * U, 8 * U]);
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, Hh); g.stroke(); g.setLineDash([]);
    const exits = ctx.town && ctx.town.exits ? ctx.town.exits : [];
    const seen = new Set();
    g.font = `700 ${11 * U}px Fredoka, Arial, sans-serif`; g.textBaseline = "middle";
    for (const e of exits) {
        const y = py(e.s);
        if (y < -10 || y > Hh + 10) continue;
        const k = Math.round(e.s) + ":" + e.town;
        if (seen.has(k)) continue;
        seen.add(k);
        const off = [...seen].filter(q => q.startsWith(Math.round(e.s) + ":")).length - 1;
        const ly = y + (8 + off * 14) * U;
        g.strokeStyle = "#9E9E9E"; g.lineWidth = 5 * U; g.beginPath(); g.moveTo(cx + 7 * U, y); g.lineTo(cx + 26 * U, ly); g.stroke();
        g.fillStyle = "#2b1b2e"; g.textAlign = "left";
        g.fillText(`${e.emoji || "🏙️"} ${e.name}`, cx + 30 * U, ly);
    }
    for (const l of list) {
        const s1 = hwyS(l);
        if (s1 == null) continue;
        let x = cx;
        if (!l.zone) { const p = ctx.party.peer(l.uid), sm = p && p.samples && p.samples.length ? p.samples[p.samples.length - 1] : null; if (sm) x = cx + Math.max(-6, Math.min(6, sm.d)) * U; }
        else x = cx + 30 * U;
        const y = py(s1), cl = Math.max(12 * U, Math.min(Hh - 12 * U, y));
        dot(x, cl, l.hex, l.name + (y < 0 ? " ↑" : y > Hh ? " ↓" : ""), l.uid === dest, l.inside ? "🏠" : l.foot ? "🚶‍♀️" : "");
        pts.push({ uid: l.uid, x, y: cl });
    }
    meArrow(cx, py(s0), 0);
    return pts;
}

/** The app's screen. tg = the together service (destination + the switch). */
export function render(el, api, tg) {
    const list = locateAll(), dest = tg.dest(), Z = myZone();
    const all = friends();
    const rows = all.map(uid => {
        const l = list.find(q => q.uid === uid);
        const name = ctx.party.displayName(uid), hex = friendHex(uid);
        const sub = l ? (l.label || (l.zone ? `in ${townName(l.zone)}` : "on the highway")) : "can't see where yet";
        return `<button class="btn lp-row tg-row${uid === dest ? " on" : ""}" data-u="${esc(uid)}" style="--c:${hex}"><span class="lp-av"><i style="background:${hex}"></i></span>
            <span class="lp-tx"><b>${esc(name)}</b><small>${esc(sub)}${uid === dest ? " · 📍 your destination" : ""}</small></span><span class="lp-meta">${l ? fmtDist(l.dist) : ""}</span></button>`;
    }).join("");
    el.innerHTML = `<div class="tg-map"><canvas width="600" height="380"></canvas><span class="cap">${Z ? esc(townName(Z)) : "The highway"}</span></div>
        ${all.length ? rows : `<p class="lp-note">No friends here yet — 👯 Friends › 📤 Invite.</p>`}
        ${dest ? `<button class="btn lp-row" id="tgClear"><span class="lp-av">✖</span><span class="lp-tx"><b>Clear the destination</b><small>the beam goes away</small></span></button>` : ""}
        <button class="btn lp-row" id="tgPtr"><span class="lp-av">🧭</span><span class="lp-tx"><b>Friend pointers: ${tg.pointersOn() ? "ON" : "OFF"}</b><small>${tg.pointersOn() ? "a small arrow at the screen's edge for each friend" : "no arrows — the map is still here"}</small></span></button>
        <p class="lp-fine">Tap a friend to head their way: a beam over them + the distance.</p>`;
    const cv = el.querySelector("canvas");
    fit(cv);
    V.pts = draw(cv, list, dest);
    cv.addEventListener("click", ev => {
        const r = cv.getBoundingClientRect(), k = cv.width / Math.max(1, r.width);
        const x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k;
        let best = null, bd = 34;
        for (const p of V.pts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = p; } }
        if (best) pickFriend(best.uid, api, tg);
    });
    el.querySelectorAll("[data-u]").forEach(b => b.addEventListener("click", () => pickFriend(b.dataset.u, api, tg)));
    const c = el.querySelector("#tgClear"); if (c) c.addEventListener("click", () => { tg.setDest(""); api.refresh(); });
    el.querySelector("#tgPtr").addEventListener("click", () => { tg.setPointers(!tg.pointersOn()); api.refresh(); });
}
function pickFriend(uid, api, tg) {
    if (tg.dest() === uid) { tg.setDest(""); api.refresh(); return; }
    if (!locate(uid)) { api.toast("📶 Can't see where they are yet"); return; }
    tg.setDest(uid);
    api.close();
}
/** Redraw just the picture (the phone is open: friends keep moving). */
export function redraw(el, tg) {
    const cv = el && el.querySelector && el.querySelector(".tg-map canvas");
    if (!cv) return;
    fit(cv);
    V.pts = draw(cv, locateAll(), tg.dest());
}
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
export { zoneOf };
export const dots = () => V.pts.map(p => ({ ...p }));
