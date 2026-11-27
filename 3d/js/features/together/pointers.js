// features/together — the on-screen FRIEND POINTERS: at most one small pill per friend at the edge of the
// screen ("➤ Dina 240 m"), in that friend's colour, for the nearest few friends only. Clean by design:
//   • on the TOP edge when they're ahead, down the LEFT / RIGHT sides when they're beside / behind — never the
//     bottom (the car, the road, the pedals), never the middle of the picture
//   • a friend I can SEE (on screen, close: their nametag says it all) fades out
//   • slides along the edge to keep clear of every HUD bit and touch button (measured a few times a second);
//     if there's no room it sits out rather than cover a button
//   • inside a building → it points at the door and says where ("in the Goldbergs' house"); in another town /
//     on the highway → it points the way to drive ("in Lakewood · take the Lakewood exit")
// DOM is written only when something changes; per frame it's a transform + an opacity per pill.
import * as THREE from "three";
import { ctx, css } from "../../core/ctx.js";
import { fmtDist } from "./where.js";
import { clearWindow, phoneHud } from "../../hud.js";

css("together-ptr", `
#tgPtrs { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
.tg-p { position: absolute; left: 0; top: 0; display: flex; align-items: center; gap: 6px; padding: 3px 10px 3px 3px; border-radius: 999px;
  background: rgba(20,16,36,.62); color: #fff; font: 700 12.5px var(--font); line-height: 1.1; white-space: nowrap; opacity: 0;
  transition: opacity .35s ease; will-change: transform, opacity; box-shadow: 0 2px 6px rgba(0,0,0,.2); }
.tg-p .ar { flex: none; width: 20px; height: 20px; border-radius: 50%; background: var(--c, #E91E63); display: flex; align-items: center;
  justify-content: center; box-shadow: 0 0 0 1.5px rgba(255,255,255,.75); }
.tg-p .ar i { display: block; width: 0; height: 0; border-left: 4.5px solid transparent; border-right: 4.5px solid transparent;
  border-bottom: 8px solid #fff; margin-top: -2px; transform-origin: 50% 70%; }
.tg-p .tx { display: flex; flex-direction: column; }
.tg-p .nm { display: flex; gap: 5px; align-items: baseline; }
.tg-p .nm span { opacity: .8; font-weight: 600; font-variant-numeric: tabular-nums; }
.tg-p small { font-size: 10.5px; font-weight: 600; opacity: .72; max-width: 190px; overflow: hidden; text-overflow: ellipsis; }
.tg-p.dest { box-shadow: 0 0 0 2px var(--c, #E91E63), 0 2px 6px rgba(0,0,0,.2); }
body.tv .tg-p { font-size: 19px; padding: 5px 16px 5px 5px; gap: 9px; } body.tv .tg-p .ar { width: 30px; height: 30px; }
body.tv .tg-p small { font-size: 15px; max-width: 320px; }
@media (max-width: 600px), (max-height: 430px) { .tg-p { font-size: 11px; padding: 2px 8px 2px 2px; gap: 5px; } .tg-p .ar { width: 17px; height: 17px; } .tg-p small { font-size: 9.5px; max-width: 130px; } }
`);

/** Every HUD bit / touch control a pointer must never cover. */
const AVOID = ["#hud .hud-tl", "#hud .hud-top", "#hud .hud-tr", "#hud .hud-br", "#slot-center > *", "#hud .hud-slot.left > *", "#hud .hud-slot.right > *",
    "#hud .hud-slot.bottom > *", "#banner", "#toasts > *", "#touch .tbtn", "#stickZone", "#touchExtra > *", "#phoneBtn", "#pauseBtn", "#ptChip", "#owChip", "#owBoard", "#skipBtn", "#padHint", "#objLine:not(.empty)"];
const MAX = 3;                    // the nearest few friends only
const D = { root: null, pills: new Map(), avoid: [], avoidT: 0, W: 0, Hh: 0 };
const _v = new THREE.Vector3(), _dir = new THREE.Vector3();

function root() {
    if (D.root && D.root.isConnected) return D.root;
    D.root = document.createElement("div");
    D.root.id = "tgPtrs";
    (document.getElementById("hud") || document.body).appendChild(D.root);
    return D.root;
}
function pillFor(uid) {
    let p = D.pills.get(uid);
    if (p) return p;
    const el = document.createElement("div");
    el.className = "tg-p";
    el.innerHTML = `<span class="ar"><i></i></span><span class="tx"><span class="nm"><b></b><span></span></span><small></small></span>`;
    root().appendChild(el);
    p = { el, ar: el.querySelector(".ar i"), nm: el.querySelector(".nm b"), di: el.querySelector(".nm span"), sm: el.querySelector("small"),
        key: "", w: 0, h: 0, x: -999, y: -999, op: 0, deg: null, shown: false, seen: 0 };
    D.pills.set(uid, p);
    return p;
}
function setText(p, l, dest) {
    const sub = l.label || "", d = fmtDist(l.dist);
    const key = l.name + "|" + sub + "|" + d + "|" + l.hex + "|" + (dest ? 1 : 0);
    if (key === p.key) return;
    const resize = p.key.split("|").slice(0, 2).join("|") !== l.name + "|" + sub || !p.w;
    p.key = key;
    p.nm.textContent = l.name; p.di.textContent = d; p.sm.textContent = sub;
    p.sm.style.display = sub ? "" : "none";
    p.el.style.setProperty("--c", l.hex);
    p.el.classList.toggle("dest", !!dest);
    if (resize) { p.w = 0; }
}
function measureAvoid() {
    D.avoid.length = 0;
    for (const sel of AVOID) for (const e of document.querySelectorAll(sel)) {
        if (!e || e.offsetParent === null && getComputedStyle(e).position !== "fixed") continue;
        const r = e.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const cs = getComputedStyle(e);
        if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
        D.avoid.push({ l: r.left - 6, t: r.top - 6, r: r.right + 6, b: r.bottom + 6 });
    }
    // (ci/hud: on a phone the CLEAR WINDOW around her car stays empty — hud.js › the layout contract)
    if (phoneHud()) { const c = clearWindow(), W = innerWidth, Hh = innerHeight; D.avoid.push({ l: c.x0 * W, t: c.y0 * Hh, r: c.x1 * W, b: c.y1 * Hh }); }
}
const hits = (a, list) => list.some(q => a.l < q.r && a.r > q.l && a.t < q.b && a.b > q.t);

/**
 * The edge path, parameter u in [−1, 1]: u = 0 straight ahead (top centre), ±0.28 the top corners, then down the
 * sides to ±1 (behind me: ~70 % of the way down — the bottom stays clear for the road, the car, the pedals).
 * → the pill's top-left corner for a pill w × h.
 */
function edgeAt(u, w, h, out) {
    const W = D.W, Hh = D.Hh, m = 10;
    const top = Math.max(m, Math.round(Hh * 0.17)), bottom = Math.round(Hh * 0.70) - h;
    const TU = 0.28, au = Math.abs(u);
    if (au <= TU) {
        const span = W / 2 - m - w / 2 - 4;
        out.x = W / 2 + (u / TU) * span - w / 2; out.y = top;
    } else {
        const k = (au - TU) / (1 - TU);
        out.x = u > 0 ? W - m - w : m; out.y = top + k * Math.max(0, bottom - top);
    }
    return out;
}

/**
 * Per frame. list = locate() results (nearest first), dest = the destination friend's uid (or ""), on = show at all.
 */
export function tick(dt, list, dest, on) {
    // (features/pins: the one 📍 ping is a pointer too — first, always styled as a destination)
    for (const f of EXTRA) { let l = null; try { l = f(); } catch (e) { l = null; } if (l) list = [l].concat(list); }
    if (!on || !list.length) { hideAll(); return; }
    const W = innerWidth, Hh = innerHeight;
    if (W !== D.W || Hh !== D.Hh) { D.W = W; D.Hh = Hh; D.avoidT = 0; for (const p of D.pills.values()) p.w = 0; }
    D.avoidT -= dt;
    if (D.avoidT <= 0) { D.avoidT = 0.3; measureAvoid(); }
    const cam = ctx.camera;
    cam.getWorldDirection(_dir);
    const yaw = Math.atan2(_dir.x, _dir.z), cp = cam.position;
    const want = new Set();
    // the destination friend always gets a pill; then the nearest others up to MAX
    const isD = l => l.uid === dest || !!l.dest;
    const pickd = list.filter(isD).concat(list.filter(l => !isD(l))).slice(0, MAX);
    const placed = [];
    for (const l of pickd) {
        const p = pillFor(l.uid);
        want.add(l.uid);
        setText(p, l, isD(l));
        if (!p.w) { const r = p.el.getBoundingClientRect(); p.w = Math.ceil(r.width) || 90; p.h = Math.ceil(r.height) || 24; }
        // where is it, relative to where the camera looks?
        const dx = l.x - cp.x, dz = l.z - cp.z;
        let a = Math.atan2(dx, dz) - yaw;
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        // on screen + close + drawn (their nametag shows) → fade out
        _v.set(l.x, 1.4, l.z).project(cam);
        const onScreen = _v.z < 1 && Math.abs(_v.x) < 0.86 && Math.abs(_v.y) < 0.86;
        const seen = l.kind === "here" || l.kind === "door";
        const fade = seen && onScreen && l.dist < 140 && !isD(l);
        if (fade || (l.dist < 9 && seen)) { p.op = 0; apply(p); continue; }
        // screen-right is −a (a bearing to the left is positive in three.js's yaw)
        let u = Math.max(-1, Math.min(1, -a / Math.PI * (1 / 0.62)));          // (±112° and beyond: down the sides as far as they go)
        // in front and inside the picture's width: the top edge right above where they really are
        if (_v.z < 1 && Math.abs(a) < Math.PI / 2 && Math.abs(_v.x) < 0.95) u = 0.28 * Math.max(-1, Math.min(1, (_v.x * W / 2) / Math.max(1, W / 2 - 14 - p.w / 2)));
        const pos = { x: 0, y: 0 };
        let ok = false;
        for (let k = 0; k <= 24 && !ok; k++) {
            for (const sg of k ? [1, -1] : [1]) {
                const uu = u + sg * k * 0.04;
                if (uu < -1 || uu > 1) continue;
                edgeAt(uu, p.w, p.h, pos);
                const box = { l: pos.x, t: pos.y, r: pos.x + p.w, b: pos.y + p.h };
                if (box.l < 0 || box.r > W || box.t < 0 || box.b > Hh) continue;
                if (hits(box, D.avoid) || hits(box, placed)) continue;
                placed.push({ l: box.l - 4, t: box.t - 4, r: box.r + 4, b: box.b + 4 });
                ok = true; break;
            }
        }
        if (!ok) { p.op = 0; apply(p); continue; }
        // the arrow: straight at the target in screen terms (up = ahead)
        const deg = Math.round(-a * 180 / Math.PI / 5) * 5;
        if (deg !== p.deg) { p.deg = deg; p.ar.style.transform = `rotate(${deg}deg)`; }
        if (Math.abs(pos.x - p.x) > 0.5 || Math.abs(pos.y - p.y) > 0.5) {
            // glide (no jumps when it slides past a button), unless it was hidden
            const k = p.op > 0.05 ? Math.min(1, dt * 10) : 1;
            p.x += (pos.x - p.x) * k; p.y += (pos.y - p.y) * k;
            p.el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
        }
        p.op = 0.93;
        apply(p);
    }
    for (const [uid, p] of D.pills) if (!want.has(uid)) { p.op = 0; apply(p); }
}
function apply(p) {
    const s = p.op > 0.05;
    if (s !== p.shown) { p.shown = s; p.el.style.opacity = s ? String(p.op) : "0"; }
}
/** Other pointers (features/pins' 📍 ping): fn() → one locate()-shaped item { uid, name, hex, x, z, dist, label, kind, dest } | null. */
const EXTRA = [];
export function extra(fn) { EXTRA.push(fn); }
export function hideAll() { for (const p of D.pills.values()) { p.op = 0; apply(p); } }
export function clear() { for (const p of D.pills.values()) p.el.remove(); D.pills.clear(); }
/** Tests: what each pill shows + where (screen px). */
export function debug() {
    const out = [];
    for (const [uid, p] of D.pills) {
        const r = p.el.getBoundingClientRect();
        out.push({ uid, shown: p.shown, text: p.el.textContent, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), deg: p.deg });
    }
    return out;
}
export function avoidRects() { measureAvoid(); return D.avoid.map(q => ({ ...q })); }
