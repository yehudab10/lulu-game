// features/clothes/closet.js — 🚪 HER CLOSET: the one place at home where she changes (the owner: "a closet in lulus
// homes that she needs to be in to change her clothes"). A wardrobe in her room at Ima's (changing only — Ima's house
// stays undecorated, features/decor/moveout.js) and in every home she owns (features/realestate). ✋ → the mirror view
// + one small card: what she owns, slot by slot (a tile = put it in the look; her plain piece = take it out), a preview
// on her as she picks, 👗 Put it on (the same spin as the fitting room) and up to 3 saved looks.
// placeCloset(rt, { x, z, ry, col, where }) — the rooms call it (one line each); `ry` = which way the doors face.
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { saveSoon } from "../../core/save.js";
import { pick } from "../interiors/engine.js";
import { openCard, cardTick, closeCard, cardOpen, cardSay } from "../shops/card.js";
import { SLOTS, LULU, pieceById, BASE } from "./data.js";
import { S, current, owns, wear, dress, clean } from "./wear.js";
import { changeAnim, mirrorOn } from "./stage.js";
import { tagOf as limitedTag } from "./limited.js";

export const MAX_LOOKS = 3;
const W = 1.05, D = 0.55, H = 2.05;

/** Build the wardrobe at (x, z) facing ry (0 = doors toward +z) + its collider + the ✋ spot in front of it. */
export function placeCloset(rt, { x, z, ry = 0, col = null, where = "home" } = {}) {
    const g = new THREE.Group();
    const M = c => rt.own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
    const add = (w, h, d, m, px, py, pz) => { const o = new THREE.Mesh(rt.own(new THREE.BoxGeometry(w, h, d)), m); o.position.set(px, py, pz); o.castShadow = false; o.receiveShadow = true; g.add(o); return o; };
    const wood = M(where === "ima" ? "#F3E9DC" : "#EFE7F1"), trim = M("#C9A0B4"), knob = M("#C9A227");
    add(W, H, D, wood, 0, H / 2, 0);
    add(W + 0.06, 0.06, D + 0.04, trim, 0, H + 0.03, 0);
    const doors = [];
    for (const s of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(s * W / 2, 0, D / 2 + 0.01); g.add(pivot);
        const d = new THREE.Mesh(rt.own(new THREE.BoxGeometry(W / 2 - 0.02, H - 0.12, 0.03)), wood);
        d.position.set(-s * (W / 4), H / 2, 0.015); pivot.add(d);
        const k = new THREE.Mesh(rt.own(new THREE.SphereGeometry(0.025, 8, 6)), knob); k.position.set(-s * (W / 2 - 0.08), H / 2, 0.04); pivot.add(k);
        doors.push({ pivot, s });
    }
    // a few things hanging inside (her colours, seen when the doors open)
    const owned = S.owned.map(pieceById).filter(p => p && (p.slot === "top" || p.slot === "outer" || p.slot === "skirt")).slice(0, 5);
    const hang = owned.length ? owned.map(p => p.color) : [BASE.top, BASE.skirt, "#F8BBD0"];
    hang.forEach((c, i) => add(0.07, 0.75, 0.38, M(c), -0.36 + i * (0.72 / Math.max(1, hang.length - 1)), H - 0.62, 0));
    g.position.set(x, 0, z); g.rotation.y = ry;
    rt.add(g);
    const fx = Math.sin(ry), fz = Math.cos(ry);
    if (col) {
        const hw = Math.abs(fz) > 0.5 ? W / 2 : D / 2, hd = Math.abs(fz) > 0.5 ? D / 2 : W / 2;
        col("closet", x - hw - 0.02, x + hw + 0.02, z - hd - 0.02, z + hd + 0.02);
    }
    const spot = { x: x + fx * 0.95, z: z + fz * 0.95 };
    rt.data.closet = { g, doors, spot, x, z, ry, open: 0, want: 0, last: performance.now() };
    rt.every(0, 0, r => { const C = r.data.closet, t = performance.now(); if (C) { closetTick(r, Math.min(0.1, (t - C.last) / 1000)); C.last = t; } }, { gate: false, first: 0 });   // (the doors: every frame)
    rt.hot({ id: "closet", x: spot.x, z: spot.z, r: 1.05, label: "👗 Closet — change clothes", action: r => openCloset(r) });
    return rt.data.closet;
}
/** The doors swing toward `want` (run every frame by the room's timer above). */
export function closetTick(rt, dt) {
    const C = rt && rt.data && rt.data.closet;
    if (!C) return;
    C.open += (C.want - C.open) * Math.min(1, dt * 8);
    for (const d of C.doors) d.pivot.rotation.y = d.s * C.open * 1.7;
}

/** The card: tiles = the saved looks, then her pieces slot by slot (+ her own plain piece to take one off). */
async function openCloset(rt) {
    const C = rt.data.closet;
    if (!C || rt.disposed) return;
    await rt.walkTo(C.spot.x, C.spot.z, 2.5);
    if (rt.disposed) return;
    C.want = 1;
    // she turns to the camera (the room's front: the mirror), the open closet beside her
    rt.faceTo = { x: C.spot.x, z: C.spot.z + 5 };
    mirrorOn(rt, true);
    const before = current();
    let look = Object.assign({}, before), apply = false;
    const preview = () => dress(rt.lulu.obj, look);
    const tiles = [];
    S.saved.slice(0, MAX_LOOKS).forEach((o, i) => tiles.push({ id: "look" + i, icon: "⭐", name: `Look ${i + 1}`, desc: () => describe(clean(o)),
        tag: () => (sameLook(look, clean(o)) ? "On" : ""), state: () => "owned", act: () => { look = keepOwned(clean(o)); preview(); } }));
    for (const sl of SLOTS) {
        const mine = S.owned.map(pieceById).filter(p => p && p.slot === sl.id);
        if (!mine.length) continue;
        tiles.push({ id: "plain:" + sl.id, icon: sl.icon, name: sl.id === "outer" ? "No coat" : sl.id === "acc" ? "No extra" : `My old ${sl.name.toLowerCase()}`,
            dot: BASE[sl.id] || null, desc: () => (sl.id === "outer" ? "Nothing over it." : sl.id === "acc" ? "Nothing extra." : `Her own ${sl.name.toLowerCase()} — the one she always wears.`), state: () => "owned", tag: () => (!look[sl.id] ? "On" : ""),
            act: () => { delete look[sl.id]; preview(); } });
        for (const p of mine) {
            const lt = () => limitedTag(p.id);          // (👜 a numbered piece: "No. 17 of 50")
            tiles.push({ id: p.id, dot: p.color, name: p.name, desc: () => `<b>${p.brand}</b> · ${lt() ? `<b>${lt().line}</b> ` : ""}${p.line}`, state: () => "owned",
                tag: () => (look[sl.id] === p.id ? "On" : lt() ? lt().tag : ""), act: () => { look[sl.id] = p.id; preview(); } });
        }
    }
    if (!tiles.length) {
        mirrorOn(rt, false); C.want = 0; rt.faceTo = null;
        return rt.say("Lulu", "Just my usual stuff in here. The clothing shops are in town — Main St in Lakewood, Avenue J in Midwood.", { emoji: "👗" });
    }
    await rt.runMode({
        start() {
            openCard({
                title: "👗 My closet", tiles, focus: tiles[0].id,
                buttons: [
                    { id: "on", label: "👗 Put it on", action: () => { apply = true; closeCard(true); } },
                    { id: "save", label: () => (S.saved.length >= MAX_LOOKS ? "💾 Save look (replaces Look 1)" : "💾 Save this look"),
                        visible: () => Object.keys(look).length > 0, action: () => { saveLook(look); cardSay(`Saved as a look. ⭐`); } },
                ],
            });
        },
        update(r, dt, P) { return !cardTick(P); },
        stop() { if (cardOpen()) closeCard(true); },
    });
    if (rt.disposed) return;
    if (apply && !sameLook(look, before)) {
        dress(rt.lulu.obj, before);
        await changeAnim(rt, () => wear(look, "closet"));
        if (rt.disposed) return;
        rt.bubble(pick(LULU.changed), rt.lulu.obj, 2);
        await rt.wait(0.9);
    } else dress(rt.lulu.obj, before);          // (a preview she didn't keep: back to what she has on)
    C.want = 0;
    mirrorOn(rt, false);
    rt.faceTo = null;
}

const keepOwned = o => { for (const k of Object.keys(o)) if (!owns(o[k])) delete o[k]; return o; };
const sameLook = (a, b) => SLOTS.every(s => (a[s.id] || "") === (b[s.id] || ""));
function describe(o) {
    const names = Object.values(o).map(id => (pieceById(id) || {}).name).filter(Boolean);
    return names.length ? names.join(" · ") : "Her usual look.";
}
/** Keep a look (≤ 3: a fourth replaces the oldest). */
export function saveLook(o) {
    const c = clean(o);
    if (!Object.keys(c).length) return false;
    if (S.saved.some(s => sameLook(clean(s), c))) return true;
    S.saved.push(c);
    while (S.saved.length > MAX_LOOKS) S.saved.shift();
    saveSoon();
    emit("clothes:saved", { n: S.saved.length });
    return true;
}

export const closetDebug = { openCloset, saveLook, MAX_LOOKS };
