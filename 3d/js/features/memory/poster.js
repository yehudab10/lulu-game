// features/memory — 🪧 "WANTED: LULU" on the roadside.
//
// After a 4–5★ chase, a chase she escaped or a jailbreak, the next two runs each
// get ONE billboard with her face on a WANTED poster (banter's pooled billboard —
// same board, posts and lamps as every other ad; only the face is ours, a canvas
// painted once and cached by banter). It evolves with her notoriety:
//   wanted  "WANTED: LULU · REWARD: 36 COINS AND A KUGEL" (+ MUGSHOTS ON FILE: n)
//   honk    "SEEN HER? DON'T HONK. SHE HONKS BACK."              (notoriety ≥ 2)
//   free    the fan-made pink "FREE LULU!"                       (3+ arrests / escapes, or a jailbreak)
// The spot is booked past the built road (world.reserve keeps trees and houses
// out) and hung when that chunk is built, like banter's own planner.
import { ctx, emit } from "../../core/ctx.js";
import { shared } from "../../core/save.js";
import { M, dirty, live, knobs, pick, rand, fill, notoriety } from "./data.js";
import * as T from "./lines.js";

export const AD_ID = "memWanted";
export const PS = { want: false, why: null, variant: null, booked: null, placed: null, chaseMax: 0, last: null };

// ── remembering a hot chase ───────────────────────────────────────────────
/** Every driving frame: track the hottest the current chase got. */
export function chaseTick() {
    if (ctx.law && ctx.law.chasing) PS.chaseMax = Math.max(PS.chaseMax, ctx.law.wanted || 0);
}
/** cop:chase {active:false, result}: owe her a poster? */
export function chaseEnded(e = {}) {
    if (e.active) { PS.chaseMax = Math.max(PS.chaseMax, (ctx.law && ctx.law.wanted) || 1); return; }
    const heat = Math.max(PS.chaseMax, (ctx.law && ctx.law.wanted) || 0);
    PS.chaseMax = 0;
    if (ctx.party && ctx.party.active) return;
    if (heat > (M.maxStars || 0)) M.maxStars = Math.min(5, heat);
    const escaped = e.result === "escaped";
    if (escaped) M.escapes = (M.escapes || 0) + 1;
    if (heat >= 4 || escaped) owe({ heat, why: escaped ? "escape" : "stars" });
    dirty();
}
/** law:release {how}: a jailbreak earns a poster too. */
export function released(e = {}) {
    if (e.how === "escape" && !(ctx.party && ctx.party.active)) owe({ heat: Math.max(3, M.maxStars || 0), why: "jail" });
}
export function owe({ heat = 4, why = "stars" } = {}) {
    M.poster = { heat, why, run: M.runs, left: 2 };
    dirty();
}

// ── this run ──────────────────────────────────────────────────────────────
export function posterRunStart() {
    unbook();
    PS.want = false; PS.placed = null; PS.variant = null; PS.why = null;
    const p = M.poster;
    if (!p || p.run >= M.runs || !live()) return;
    PS.want = true;
    PS.why = p.why;
    PS.variant = pickVariant();
    p.left = (p.left || 1) - 1;
    if (p.left <= 0) M.poster = null;
    dirty();
}
export function variants(n = notoriety()) {
    const v = ["wanted"];
    if (n.level >= 2) v.push("honk");
    if (n.arrests >= 3 || n.escapes >= 3 || PS.why === "jail") v.push("free");
    return v;
}
function pickVariant() {
    if (knobs.variant) return knobs.variant;
    const v = variants();
    const fresh = v.filter(x => x !== PS.last);
    return pick(fresh.length ? fresh : v);
}

function builtEnd() { let m = 0; for (const ch of ctx.world.activeChunks()) m = Math.max(m, ch.s1); return m; }
function othersReserve(s, side) {
    for (const r of ctx.world.reserved) {
        if (PS.booked && r === PS.booked.res) continue;
        if (r.side && r.side !== side) continue;
        if (r.s1 < s - 14 || r.s0 > s + 14) continue;
        if (r.dMax < 9.5 || r.dMin > 28) continue;
        return true;
    }
    return false;
}
function unbook() {
    if (PS.booked) {
        const a = ctx.world ? ctx.world.reserved : null, i = a ? a.indexOf(PS.booked.res) : -1;
        if (i >= 0) a.splice(i, 1);
    }
    PS.booked = null;
}
/** Every driving frame: book the spot once the run is under way. */
export function posterTick() {
    if (!PS.want || PS.booked || PS.placed || ctx.state !== "playing" || !ctx.banter || !ctx.banter.billboardAt) return;
    let s = builtEnd() + 30 + rand(0, 60);
    for (let k = 0; k < 6 && !PS.booked; k++, s += 45) {
        for (const side of [-1, 1]) {
            if (othersReserve(s, side)) continue;
            ctx.world.reserve(s - 10, s + 10, side, 12.4, 27);
            PS.booked = { s, side, res: ctx.world.reserved[ctx.world.reserved.length - 1] };
            break;
        }
    }
    if (!PS.booked) PS.want = false;    // the road ahead is all set pieces: maybe next run
}
/** chunk:build — hang the board if it's ours. */
export function posterChunk({ chunk, s0, s1 }) {
    const b = PS.booked;
    if (!b || b.s < s0 || b.s >= s1) return;
    unbook();
    PS.want = false;
    hang(chunk, b.s, b.side);
}
function hang(chunk, s, side) {
    if (!ctx.banter || !ctx.banter.billboardAt) return null;
    let key = null;
    try { key = ctx.banter.billboardAt(chunk, s, side, AD_ID); } catch (e) { console.error("[memory] billboard", e); }
    if (!key) return null;
    PS.placed = { s, side, key, variant: PS.variant || "wanted" };
    PS.last = PS.placed.variant;
    emit("memory:billboard", { variant: PS.placed.variant, key, s, side });
    return PS.placed;
}
/** Debug / tests / the town: hang the poster `ahead` metres in front of her right now. */
export function posterNow(ahead = 70, side = -1, variant = null) {
    if (!ctx.banter || !ctx.banter.billboard) return null;
    PS.variant = variant || PS.variant || pickVariant();
    const key = ctx.banter.billboard(AD_ID, ahead, side);
    if (!key) return null;
    PS.placed = { s: ctx.car.s + ahead, side, key, variant: PS.variant };
    PS.last = PS.variant;
    emit("memory:billboard", { variant: PS.variant, key, s: PS.placed.s, side });
    return PS.placed;
}

// ── the design (banter's ad format; resolved when the board is hung) ─────
export function posterDesign() {
    const n = notoriety();
    const v = PS.variant || "wanted";
    const hair = shared.get().luluHair || "#8B5A2B";
    if (v === "free") {
        return { key: `memFree-${n.arrests}`, bg: ["#FFF0F6", "#F8BBD0"], ink: "#AD1457", accent: "#EC407A", art: portrait, hair, fan: true,
            head: T.POSTER.free.head, sub: T.POSTER.free.sub, small: T.POSTER.free.small, strip: `${n.arrests} ARREST${n.arrests === 1 ? "" : "S"} · 0 REGRETS`,
            react: T.POSTER.free.react };
    }
    if (v === "honk") {
        return { key: `memHonk-${n.maxStars}`, bg: ["#FFF8E1", "#FFE082"], ink: "#3E2723", accent: "#C62828", art: portrait, hair, mug: n.mugshots,
            head: T.POSTER.honk.head, sub: T.POSTER.honk.sub, small: T.POSTER.honk.small, strip: `WANTED: LULU ${"★".repeat(Math.max(1, n.maxStars))}`,
            react: T.POSTER.honk.react };
    }
    const why = PS.why;
    const S = T.POSTER.wanted.small;
    // (the two-line head + sub fill the board: the "last seen" line only fits without the mugshot strip)
    const small = n.mugshots ? null : why === "jail" ? S.jail : why === "escape" ? S.escape : n.maxStars >= 4 ? fill(S.stars, { n: n.maxStars }) : S.plain;
    return { key: `memWanted-${n.mugshots}-${why || "x"}`, bg: ["#EFD9A8", "#D9B97A"], ink: "#3B2410", accent: "#8D1F1F", art: portrait, hair, mug: n.mugshots,
        head: T.POSTER.wanted.head, sub: T.POSTER.wanted.sub, small, strip: n.mugshots ? `MUGSHOTS ON FILE: ${n.mugshots}` : null,
        react: T.POSTER.wanted.react };
}

// ── the portrait (drawn around 0,0 in banter's ~±150 badge) ───────────────
const FONT = `Fredoka, "Arial Rounded MT Bold", Arial, sans-serif`;
export function portrait(g, d) {
    const fan = !!d.fan;
    // backdrop: the height chart (mugshot) or crayon hearts (fan club)
    g.fillStyle = fan ? "#FFE4EF" : "#CFD8DC"; g.fillRect(-160, -160, 320, 320);
    if (fan) {
        g.fillStyle = "#F48FB1";
        for (const [x, y, r] of [[-110, -95, 18], [105, -100, 14], [-120, 40, 12], [118, 30, 16], [90, -40, 9]]) heart(g, x, y, r);
    } else {
        g.strokeStyle = "rgba(38,50,56,0.55)"; g.lineWidth = 3; g.fillStyle = "rgba(38,50,56,0.6)";
        g.font = `700 14px ${FONT}`; g.textAlign = "left"; g.textBaseline = "middle";
        for (let y = -130, k = 6; y <= 60; y += 38, k--) { g.beginPath(); g.moveTo(-150, y); g.lineTo(150, y); g.stroke(); g.fillText(`${k}'`, -146, y - 10); }
    }
    // hair (behind), shoulders, neck, face
    g.fillStyle = d.hair || "#8B5A2B";
    g.beginPath(); g.ellipse(0, -18, 78, 92, 0, 0, 7); g.fill();
    g.beginPath(); g.ellipse(-52, 40, 34, 60, 0.2, 0, 7); g.ellipse(52, 40, 34, 60, -0.2, 0, 7); g.fill();
    g.fillStyle = "#E91E63";
    g.beginPath(); g.ellipse(0, 150, 120, 70, 0, 0, 7); g.fill();
    g.fillStyle = "#F2C4A0"; g.fillRect(-18, 40, 36, 40);
    g.beginPath(); g.ellipse(0, -6, 56, 66, 0, 0, 7); g.fill();
    // bangs
    g.fillStyle = d.hair || "#8B5A2B";
    g.beginPath(); g.moveTo(-60, -20); g.quadraticCurveTo(-50, -86, 0, -78); g.quadraticCurveTo(52, -86, 60, -18);
    g.quadraticCurveTo(30, -58, -8, -50); g.quadraticCurveTo(-34, -46, -60, -20); g.fill();
    // eyes (one eyebrow up: the attitude), lashes, blush, the smirk
    g.fillStyle = "#3E2723";
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 22, -4, 8, 10, 0, 0, 7); g.fill(); }
    g.fillStyle = "#FFFFFF"; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 22 + 3, -7, 3, 0, 7); g.fill(); }
    g.strokeStyle = "#3E2723"; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(-34, -26); g.lineTo(-12, -24); g.stroke();
    g.beginPath(); g.moveTo(12, -30); g.quadraticCurveTo(24, -38, 36, -30); g.stroke();
    g.fillStyle = "rgba(240,98,146,0.35)"; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 34, 16, 11, 7, 0, 0, 7); g.fill(); }
    g.strokeStyle = "#C2185B"; g.lineWidth = 5;
    g.beginPath(); if (fan) g.arc(0, 18, 18, 0.2, Math.PI - 0.2); else { g.moveTo(-14, 30); g.quadraticCurveTo(4, 36, 18, 24); } g.stroke();
    // sunglasses perched on her head
    g.fillStyle = "#263238";
    g.beginPath(); g.roundRect(-46, -74, 38, 18, 8); g.roundRect(8, -74, 38, 18, 8); g.fill(); g.fillRect(-10, -68, 20, 5);
    if (fan) {
        // a crayon crown
        g.fillStyle = "#FFD54F"; g.beginPath(); g.moveTo(-40, -92); g.lineTo(-30, -124); g.lineTo(-12, -100); g.lineTo(0, -132); g.lineTo(12, -100); g.lineTo(30, -124); g.lineTo(40, -92); g.closePath(); g.fill();
    } else {
        // the placard
        g.fillStyle = "#212121"; g.beginPath(); g.roundRect(-74, 78, 148, 58, 6); g.fill();
        g.fillStyle = "#FFFFFF"; g.textAlign = "center"; g.textBaseline = "middle";
        g.font = `700 22px ${FONT}`; g.fillText("LULU", 0, 94);
        g.font = `700 16px ${FONT}`; g.fillText(`#${String(36 + (d.mug || 0)).padStart(4, "0")}`, 0, 118);
    }
}
function heart(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y + r);
    g.bezierCurveTo(x - r * 1.6, y, x - r, y - r * 1.3, x, y - r * 0.45);
    g.bezierCurveTo(x + r, y - r * 1.3, x + r * 1.6, y, x, y + r); g.fill();
}
