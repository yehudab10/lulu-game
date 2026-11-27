// features/together — the 📱 🗺️ MAP with friends (a 🎉 party's Free Roam; solo, the 🗺️ app is still the story map).
// One clean picture + one row per friend:
//   • in a town: the town's streets from above (north up), the ramps out, me (a white arrow) and every friend in
//     town as a small dot in their colour with their name; a friend inside a house sits at its door (🏠)
//   • on the highway: the ONE map — the whole 16 km lap as a ring (world/lapmap.js, ci/onemap): every place once, me,
//     and every friend on the highway or in a town (at that town's exit)
// Tap a dot or a row → a DESTINATION: one soft beam over that friend in the world + their pointer stays on with
// the distance (features/together/index.js). Tap it again → cleared. Plus the 🧭 pointers switch.
import { ctx, css } from "../../core/ctx.js";
import { lapS } from "../../world.js";
import { drawLap } from "../world/lapmap.js";
import * as PINS from "../pins/map.js";
import { locateAll, locate, myPos, myZone, zoneOf, townName, friendHex, friends, townExits, fmtDist, toL } from "./where.js";

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
        // ── a town from above, in its OWN frame (its streets square to the card): fit the streets' bounds ──
        let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        const segs = plan.STREETS.filter(st => st !== plan.APPROACH).map(st => {
            let a, b;
            if (st.axis === "ns") { a = { x: st.c, z: st.a0 }; b = { x: st.c, z: st.a1 }; }
            else if (st.axis === "ew") { a = { x: st.a0, z: st.c }; b = { x: st.a1, z: st.c }; }
            else { a = { x: st.px + st.ux * st.a0, z: st.pz + st.uz * st.a0 }; b = { x: st.px + st.ux * st.a1, z: st.pz + st.uz * st.a1 }; }
            for (const p of [a, b]) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
            return [a, b];
        });
        const pad = 18 * U, sc = Math.min((W - pad * 2) / Math.max(1, x1 - x0), (Hh - pad * 2) / Math.max(1, z1 - z0));
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        // local +z up, +x left (a local heading h points the arrow at −h): the map never spins
        const lpx = x => W / 2 - (x - cx) * sc, lpy = z => Hh / 2 - (z - cz) * sc;
        const px = (x, z) => lpx(toL(plan, x, z).x), py = (x, z) => lpy(toL(plan, x, z).z);
        g.lineCap = "round";
        g.strokeStyle = "#FFFFFF"; g.lineWidth = Math.max(4 * U, 9 * sc);
        for (const [a, b] of segs) { g.beginPath(); g.moveTo(lpx(a.x), lpy(a.z)); g.lineTo(lpx(b.x), lpy(b.z)); g.stroke(); }
        g.strokeStyle = "rgba(120,110,100,.35)"; g.lineWidth = 1 * U;
        for (const [a, b] of segs) { g.beginPath(); g.moveTo(lpx(a.x), lpy(a.z)); g.lineTo(lpx(b.x), lpy(b.z)); g.stroke(); }
        for (const e of townExits()) {
            const x = px(e.x, e.z), y = py(e.x, e.z);
            g.font = `${12 * U}px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
            g.fillText("🛣️", Math.max(10 * U, Math.min(W - 10 * U, x)), Math.max(10 * U, Math.min(Hh - 10 * U, y)));
        }
        for (const l of list) {
            if (l.zone !== Z || l.kind === "exit") continue;
            const x = Math.max(10 * U, Math.min(W - 10 * U, px(l.x, l.z))), y = Math.max(10 * U, Math.min(Hh - 10 * U, py(l.x, l.z)));
            dot(x, y, l.hex, l.name, l.uid === dest, l.inside ? "🏠" : l.foot ? "🚶‍♀️" : "");
            pts.push({ uid: l.uid, x, y });
        }
        const h = ctx.foot && ctx.foot.active && ctx.foot.facing != null ? ctx.foot.facing : ctx.car.h;
        meArrow(px(me.x, me.z), py(me.x, me.z), -(h + (plan.ROT || 0)));
        return pts;
    }
    // ── the highway: the ONE map (ci/onemap stage 3) — the whole 16 km lap as a ring, every place once (world/lapmap.js),
    //    me on it, every friend on the highway at their lap metre (in a town: at its exit) ──
    const dots = [];
    for (const l of list) {
        const s1 = hwyS(l);
        if (s1 == null) continue;
        dots.push({ uid: l.uid, m: lapS(s1), hex: l.hex, name: l.name + (l.inside ? " 🏠" : l.foot ? " 🚶‍♀️" : ""), here: !l.zone });
    }
    return drawLap(cv, { me: { m: lapS(ctx.car.s) }, dots });
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
        ${all.length ? rows : `<p class="lp-note">No friends here yet. Tap Play with a friend in Nearby.</p>`}
        ${dest ? `<button class="btn lp-row" id="tgClear"><span class="lp-av">✖</span><span class="lp-tx"><b>Clear the destination</b><small>the beam goes away</small></span></button>` : ""}
        <button class="btn lp-row" id="tgPtr"><span class="lp-av">🧭</span><span class="lp-tx"><b>Friend pointers: ${tg.pointersOn() ? "ON" : "OFF"}</b><small>${tg.pointersOn() ? "a small arrow at the screen's edge for each friend" : "no arrows — the map is still here"}</small></span></button>
        <p class="lp-fine">Tap a friend to head their way: a beam over them + the distance.</p>
        ${PINS.html()}`;
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
    PINS.bind(el, api);      // (features/pins: the places + 📍 ping, the same card as the solo map)
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
