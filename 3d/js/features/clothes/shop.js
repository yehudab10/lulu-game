// features/clothes/shop.js — 👗 THE CLOTHING SHOP, one per town (a room on the interiors engine, built from boxes):
// racks you walk up to (✋ → one small card: the pieces, a colour dot, the price, one line) · a mannequin in the window
// outfit · the FITTING ROOM (try it on — free: the curtain, a little spin, ~1 s, skippable — then the mirror view) ·
// the COUNTER (buy: the saleswoman hands over a bag, the coins tick down; never below 0). Changing clothes happens
// here (the fitting room) or at a closet — never from a menu. A coin sink only: no resale, nothing pays.
// MIDWOOD: Avenue J'adore (Shayna: everything is "SO you") · LAKEWOOD: Simcha's Classic Clothing (Mrs. Rosenbaum asks
// who her mother is). The JFK luxury house reuses this room with its own stock (stage 3).
import * as THREE from "three";
import { ctx, emit, on, setState } from "../../core/ctx.js";
import { models } from "../../models.js";
import { wallet } from "../../core/save.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { defineInterior, pool, pick } from "../interiors/engine.js";
import { canvasPlane, drawLines, sfx } from "../interiors/fx.js";
import { openCard, cardTick, closeCard, cardOpen, cardSay, repaint } from "../shops/card.js";
import { buyClothes } from "../garage/buy.js";
import { SHOPS, PIECES, LULU, ANIM, pieceById, SLOTS } from "./data.js";
import { S, current, owns, wear, addOwned, dress, clean } from "./wear.js";
import { changeAnim, mirrorOn, setCurtain, walkPath, lastChange } from "./stage.js";
import { isLimited, tagOf as limitedTag, buyLimited, hasAccount, refresh as refreshStock } from "./limited.js";

const fmt = n => Math.round(n).toLocaleString("en-US");
const W = 10, D = 7.2, WALL = 3.0;
const DOOR = { x: 3.2, z: 3.0 };
const FIT = { x: 3.5, z: -2.55 };                 // where she stands in the fitting room (faces +z: the camera = the mirror)
const COUNTER = { x: -2.6, z: -D / 2 + 1.25 };

function roomKit() {
    const g = new THREE.Group();
    g.name = "ClothesRoomKit";
    const d = new THREE.Object3D(); d.name = "Spot_door"; d.position.set(DOOR.x, 0, DOOR.z); d.rotation.y = Math.PI; g.add(d);
    const l = new THREE.Object3D(); l.name = "Spot_lulu"; l.position.set(DOOR.x, 0, DOOR.z - 0.9); l.rotation.y = Math.PI; g.add(l);
    return g;
}
models.clothes_roomkit = models.clothes_roomkit || roomKit();

/** The counter's lines for a numbered piece (limited.js answers). */
const LIMITED_LINES = {
    account: "The numbered pieces need your username, sweetheart. Pick one on the title screen — then come back.",
    checking: "One moment… I'm checking the world. Paris is slow today.",
    offline: "I can't reach Paris right now. Come back when you're online — everything else, I can sell you now.",
    soldout: "Sold out. All of them. They're out there, somewhere, on somebody's arm.",
    expired: "Ach, your number ran out before it went through. Your coins are back. Try again?",
    busy: "One at a time, darling. Even here.",
    owned: "You have one already! One per person. Even for you.",
};

// which shop the room is dressing as (the door sets it: a town, or "jfk")
let SHOP = "lakewood";
export const shopOf = id => SHOPS[id] || SHOPS.lakewood;
export const stockOf = id => PIECES.filter(p => p.shop === id);

// ── the room ─────────────────────────────────────────────────────────────
function build(rt) {
    const R = shopOf(SHOP), stock = stockOf(SHOP);
    rt.data.shop = SHOP;
    if (ctx.G) ctx.G.hint = null;
    const M = (c, o = {}) => rt.own(new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.8 }, o)));
    const geo = g => rt.own(g);
    const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(geo(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.receiveShadow = true; rt.add(m); return m; };
    const cyl = (r0, r1, h, mat, x, y, z, seg = 14) => { const m = new THREE.Mesh(geo(new THREE.CylinderGeometry(r0, r1, h, seg)), mat); m.position.set(x, y, z); rt.add(m); return m; };
    rt.bounds = { x0: -W / 2 + 0.35, x1: W / 2 - 0.35, z0: -D / 2 + 0.4, z1: D / 2 - 0.35 };
    rt.cols.length = 0;
    const col = (id, x0, x1, z0, z1) => rt.cols.push({ id, x0, x1, z0, z1, on: true });

    // floor, walls, the cut-away front with the door
    const tile = canvasPlane(rt.set, 2, 2, (g, w) => { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? R.floor[0] : R.floor[1]; g.fillRect(i * s, j * s, s, s); } }, { px: 256 });
    const ftex = tile.mesh.material.map;
    ftex.wrapS = ftex.wrapT = THREE.RepeatWrapping; ftex.repeat.set(W / 2, D / 2);
    box(W, 0.06, D, M("#ffffff", { map: ftex }), 0, -0.03, 0);
    const wallM = M(R.wall), trim = M(R.trim, { roughness: 0.5, metalness: SHOP === "lakewood" ? 0 : 0.4 });
    box(W, WALL, 0.14, wallM, 0, WALL / 2, -D / 2 - 0.07);
    box(0.14, WALL, D, wallM, -W / 2, WALL / 2, 0);
    box(0.14, WALL, D, wallM, W / 2, WALL / 2, 0);
    box(W, 0.18, 0.16, trim, 0, WALL - 0.12, -D / 2 + 0.02);
    box(DOOR.x - 0.7 + W / 2, 0.55, 0.12, trim, (-W / 2 + DOOR.x - 0.7) / 2, 0.27, D / 2);
    box(W / 2 - DOOR.x - 0.7, 0.55, 0.12, trim, (DOOR.x + 0.7 + W / 2) / 2, 0.27, D / 2);
    col("back", -W, W, -D / 2 - 0.5, -D / 2 + 0.1);
    col("f1", -W, DOOR.x - 0.7, D / 2 - 0.12, D / 2 + 1); col("f2", DOOR.x + 0.7, W, D / 2 - 0.12, D / 2 + 1);

    // the counter (back left) + the saleswoman behind it + the till
    const cx = COUNTER.x, cz = -D / 2 + 0.6;
    box(2.8, 1.0, 0.7, M(R.counter), cx, 0.5, cz);
    box(2.95, 0.07, 0.82, trim, cx, 1.03, cz);
    box(0.4, 0.26, 0.32, M("#37474F"), cx + 0.8, 1.2, cz);
    col("counter", cx - 1.45, cx + 1.45, -D / 2, cz + 0.4);
    const sign = canvasPlane(rt.set, 2.6, 1.0, (g, w, h) => {
        g.fillStyle = R.wall; g.fillRect(0, 0, w, h);
        drawLines(g, R.counter.sign, w / 2, h / 2, Math.round(h / 4.4), SHOP === "lakewood" ? "#1D2A5C" : "#B5838D", { maxW: w * 0.94 });
    }, { px: 512 });
    rt.add(sign.mesh); sign.mesh.position.set(cx, 2.05, -D / 2 + 0.02);
    const clerk = rt.person("clerk", R.clerk.key, { x: cx - 0.3, z: -D / 2 + 0.2 + 0.05, ry: 0 }, { name: R.clerk.name, colors: R.clerk.colors });
    clerk.home.z = -D / 2 + 0.25; clerk.p.obj.position.z = -D / 2 + 0.25;

    // the fitting room (back right): two side walls, a back mirror strip, the curtain (it slides)
    const fx0 = FIT.x - 1.05, fx1 = FIT.x + 1.05, fz = -1.6;
    box(0.08, 2.3, D / 2 + fz, M(R.trim), fx0, 1.15, (-D / 2 + fz) / 2);
    col("fitL", fx0 - 0.1, fx0 + 0.1, -D / 2, fz);
    box(2.1, 0.08, 0.08, trim, FIT.x, 2.3, fz);
    const curtain = box(2.1, 2.2, 0.04, M(R.curtain, { roughness: 0.95 }), FIT.x, 1.17, fz);
    rt.data.curtain = { mesh: curtain, x0: fx0, x1: fx1, open: 0.12 };
    setCurtain(rt, 0.12);
    const mirror = box(0.9, 1.8, 0.03, M("#CFE6EE", { roughness: 0.08, metalness: 0.7 }), FIT.x, 1.1, -D / 2 + 0.03);
    mirror.receiveShadow = false;

    // the racks: tops + coats · skirts, tights + shoes · the accessories table
    const groups = [
        { id: "rackA", label: "👚 Tops + coats", slots: ["top", "outer"], x: -3.4, z: 0.7 },
        { id: "rackB", label: "👗 Skirts, tights + shoes", slots: ["skirt", "tights", "shoes"], x: -0.9, z: 1.3 },
        { id: "table", label: "👜 The extras", slots: ["acc"], x: 1.1, z: -0.4, table: true },
    ];
    const rackM = M(R.rack, { roughness: 0.45, metalness: 0.5 });
    for (const gr of groups) {
        const items = stock.filter(p => gr.slots.includes(p.slot));
        if (!items.length) continue;
        if (gr.table) {
            box(1.7, 0.08, 0.9, M(R.counter), gr.x, 0.82, gr.z);
            box(1.5, 0.78, 0.7, M(R.trim), gr.x, 0.39, gr.z);
            items.forEach((p, i) => {
                const x = gr.x - 0.6 + (i % 4) * 0.4, z = gr.z - 0.2 + Math.floor(i / 4) * 0.4;
                box(0.26, 0.18, 0.18, M(p.color), x, 0.95, z);
                // (a SOLD OUT numbered piece stays on display, behind glass — "all 25 are out there")
                if ((limitedTag(p.id) || {}).sold && !owns(p.id)) box(0.34, 0.3, 0.26, M("#CFE8F2", { transparent: true, opacity: 0.35, roughness: 0.05 }), x, 1.0, z);
            });
            col(gr.id, gr.x - 0.9, gr.x + 0.9, gr.z - 0.5, gr.z + 0.5);
        } else {
            for (const s of [-1, 1]) cyl(0.025, 0.025, 1.6, rackM, gr.x + s * 0.8, 0.8, gr.z, 8);
            const bar = cyl(0.02, 0.02, 1.7, rackM, gr.x, 1.58, gr.z, 8); bar.rotation.z = Math.PI / 2;
            items.forEach((p, i) => {
                const long = p.slot === "outer" || p.slot === "skirt";
                const g = box(0.08, long ? 0.95 : 0.6, 0.46, M(p.color, { roughness: 0.9 }), gr.x - 0.66 + i * (1.32 / Math.max(1, items.length - 1)), long ? 1.05 : 1.26, gr.z);
                g.castShadow = false;
            });
            col(gr.id, gr.x - 0.9, gr.x + 0.9, gr.z - 0.3, gr.z + 0.3);
        }
        rt.hot({ id: gr.id, x: gr.x, z: gr.z + (gr.table ? 0.95 : 0.7), r: 1.25, label: `${gr.label} · ${items.length}`, action: () => browse(rt, items, gr.label) });
    }

    // the mannequin in the window outfit (a Lulu-shaped dummy in the shop's best look)
    const look = {};
    for (const p of stock) if (!look[p.slot] || p.price > pieceById(look[p.slot]).price) look[p.slot] = p.id;
    if (models.luluPerson) {
        const man = spawnPerson("luluPerson", { colors: { Skin: "#ECE6DF", Hair: "#ECE6DF", Eye: "#ECE6DF", Cheek: "#ECE6DF", Mouth: "#ECE6DF", EyeShine: "#ECE6DF", Shades: "#ECE6DF" }, outfit: look });
        man.obj.position.set(-3.9, 0.12, 2.4); man.obj.rotation.y = 0.5;
        rt.add(man.obj);
        cyl(0.32, 0.36, 0.12, trim, -3.9, 0.06, 2.4, 18);
        col("mannequin", -4.25, -3.55, 2.05, 2.75);
        rt.data.mannequin = man;
        const items = Object.values(look).map(pieceById);
        rt.hot({ id: "mannequin", x: -3.4, z: 1.8, r: 1.15, label: "🧍‍♀️ The window outfit", action: () => browse(rt, items, "🧍‍♀️ The window outfit") });
    }

    // somebody else shopping + the clerk's patter
    const o = R.other[0];
    rt.person("shopper", o.key, { x: 0.4, z: 2.0, ry: -2.3 }, { name: o.name, colors: o.colors, faceLulu: false });
    const OTHER = pool(R.other_lines), HELLO = pool(R.hello);
    rt.hot({ id: "shopper", x: 0.4, z: 2.0, who: "shopper", r: 1.1, label: `💬 Talk to ${o.name}`, action: () => rt.bubble(OTHER(), rt.byId.shopper.p.obj, 3) });
    rt.hot({ id: "counter", x: cx, z: cz + 0.95, who: "clerk", r: 1.25, label: R.counter.label, action: () => counterTalk(rt) });
    rt.hot({ id: "fitting", x: FIT.x, z: fz + 0.75, r: 1.1, label: "🚪 The fitting room", action: () => fittingRoom(rt) });
    rt.hot({ id: "wall", x: -4.2, z: -1.3, r: 1.0, label: R.wall2.label, action: () => rt.bubble(pick(R.wall2.lines), rt.lulu.obj, 3.4) });
    rt.every(9, 15, () => { const s = rt.byId.clerk; if (s && !rt.busy) rt.bubble(pick(R.look), s.p.obj, 2.4); });
    setTimeout(() => { if (!rt.disposed) rt.bubble(HELLO(), clerk.p.obj, 3.2); }, 700);
}

function tick(rt, dt) {
    const m = rt.data.mannequin;
    if (m) m.update(0, {});
}

// ── the card at a rack ───────────────────────────────────────────────────
const wearingNow = () => current();
function stateTag(p) {
    const lt = limitedTag(p.id);
    if (wearingNow()[p.slot] === p.id) return lt && owns(p.id) ? lt.tag : "Wearing";
    if (lt) return lt.tag;
    if (owns(p.id)) return "Yours";
    return "";
}
async function browse(rt, items, title) {
    let next = null;
    const desc = p => { const lt = limitedTag(p.id); return `<b>${p.brand}</b> · ${p.name}<br>${lt ? `<b>${lt.line}</b> ` : ""}${p.line}`; };
    await rt.runMode({
        start() {
            openCard({
                title,
                tiles: items.map(p => ({ id: p.id, dot: p.color, name: p.name, price: p.price, desc: () => desc(p),
                    state: () => (owns(p.id) ? "owned" : (limitedTag(p.id) || {}).sold ? "na" : "buy"), tag: () => stateTag(p),
                    act: () => { if (!owns(p.id) && (limitedTag(p.id) || {}).sold) { cardSay(limitedTag(p.id).line); return; } next = { kind: "try", p }; closeCard(true); },
                    buy: () => { next = { kind: "buy", p }; closeCard(true); return { ok: true }; } })),
                focus: items[0].id,
                buttons: [{ id: "try", label: "👗 Try it on", action: id => { next = { kind: "try", p: pieceById(id) }; closeCard(true); } }],
            });
        },
        update(r, dt, P) { return !cardTick(P); },
        stop() { if (cardOpen()) closeCard(true); },
    });
    if (rt.disposed || !next) return;
    if (next.kind === "try") return tryOn(rt, next.p);
    return buyAtCounter(rt, next.p, true);
}

/** The cubicle (room metres): between the divider and the right wall, behind the curtain line. */
export const CUBICLE = { x0: FIT.x - 1.05 + 0.15, x1: W / 2 - 0.2, z0: -D / 2 + 0.2, z1: -1.6 - 0.15 };
export const inCubicle = p => p.x > CUBICLE.x0 && p.x < CUBICLE.x1 && p.z > CUBICLE.z0 && p.z < CUBICLE.z1;
async function intoFitting(rt) {
    // around the racks / the table / the mannequin / people — not a straight line that stops at the first one
    await walkPath(rt, FIT.x, FIT.z + 0.2, 6);
    if (rt.disposed) return false;
    const o = rt.lulu.obj.position;
    if (!inCubicle(o)) {
        // (something was truly in the way: behind the curtain first, THEN the change — never out on the shop floor)
        setCurtain(rt, 1);
        o.set(FIT.x, o.y, FIT.z + 0.2);
        rt.vel && rt.vel.set(0, 0, 0);
    }
    rt.faceTo = { x: FIT.x, z: FIT.z + 5 };
    rt.lulu.obj.rotation.y = 0;
    return true;
}
async function outOfFitting(rt) {
    mirrorOn(rt, false);
    rt.faceTo = null;
    if (!rt.disposed) await walkPath(rt, FIT.x, -0.6, 3);
}

/** Try a piece on (free): into the fitting room → change → the mirror → buy it / wear it / take it off. */
async function tryOn(rt, p) {
    if (!p || rt.disposed) return;
    const R = shopOf(rt.data.shop), before = current(), trial = Object.assign({}, before, { [p.slot]: p.id });
    if (!await intoFitting(rt)) return;
    await changeAnim(rt, () => dress(rt.lulu.obj, trial));
    if (rt.disposed) return;
    mirrorOn(rt, true);
    emit("clothes:try", { id: p.id, shop: rt.data.shop });
    rt.bubble(pick(LULU.tried), rt.lulu.obj, 2.2);
    const clerk = rt.byId.clerk;
    if (clerk) setTimeout(() => { if (!rt.disposed) rt.bubble(pick(R.look), clerk.p.obj, 2.4); }, 900);
    const mine = owns(p.id);
    const opts = [mine ? "👗 Keep it on" : `💳 Buy it · ${fmt(p.price)} 💰`, "Take it off"];
    const i = await rt.choose("Lulu", `${p.name}${mine ? " — it's mine already." : ` · ${p.brand}`}`, opts, { emoji: "🪞" });
    if (rt.disposed) return;
    if (i === 0 && mine) { wear(trial, "fitting"); rt.bubble(pick(LULU.changed), rt.lulu.obj, 2); await outOfFitting(rt); return; }
    // take it off (back into what she wore) — then, for a buy, off to the counter with it on the hanger
    await changeAnim(rt, () => dress(rt.lulu.obj, before));
    await outOfFitting(rt);
    if (i === 0 && !mine) return buyAtCounter(rt, p, false, trial);
}

/** Buy at the counter: walk up, the saleswoman rings it up (the coins tick down), hands over the bag. */
async function buyAtCounter(rt, p, offerWear = true, putOn = null) {
    if (!p || rt.disposed) return;
    const R = shopOf(rt.data.shop), clerk = rt.byId.clerk;
    await walkPath(rt, COUNTER.x + 0.3, COUNTER.z + 0.15, 6);
    if (rt.disposed) return;
    rt.faceTo = { x: COUNTER.x, z: COUNTER.z - 2 };
    if (owns(p.id)) { if (clerk) rt.bubble(pick(R.owned), clerk.p.obj, 2.6); return; }
    let r;
    if (isLimited(p.id)) {
        // 👜 a numbered piece: the server holds her number → the coins → confirmed (limited.js)
        if (!hasAccount()) { if (clerk) rt.bubble(LIMITED_LINES.account, clerk.p.obj, 3.4); return; }
        if (clerk) rt.bubble(LIMITED_LINES.checking, clerk.p.obj, 1.6);
        r = await buyLimited(p);
        if (rt.disposed) return;
        if (!r.ok && r.why !== "poor") {
            sfx.deny();
            if (clerk) rt.bubble(LIMITED_LINES[r.why] || LIMITED_LINES.offline, clerk.p.obj, 3.2);
            return;
        }
    } else r = buyClothes(p, { owned: owns, give: addOwned });
    if (!r.ok) {
        sfx.deny();
        if (clerk) rt.bubble(pick(R.poor), clerk.p.obj, 3);
        setTimeout(() => { if (!rt.disposed) rt.bubble(pick(LULU.poor), rt.lulu.obj, 2.4); }, 1200);
        return;
    }
    S.spent = (S.spent | 0) + p.price; S.bought = (S.bought | 0) + 1;
    await handOver(rt, p);
    if (rt.disposed) return;
    if (r.n && clerk) { rt.bubble(`No. ${r.n} of ${r.total || (limitedTag(p.id) || {}).total || ""}. It's yours. Forever. Don't lose it.`.replace(" of .", "."), clerk.p.obj, 3); await rt.wait(1.6); if (rt.disposed) return; }
    if (clerk) rt.bubble(pick(R.bought), clerk.p.obj, 2.8);
    rt.bubble(pick(LULU.bought), rt.lulu.obj, 2.2);
    const want = putOn || (offerWear ? Object.assign({}, current(), { [p.slot]: p.id }) : null);
    if (!want) return;
    const i = await rt.choose("Lulu", "Put it on now?", ["👗 Put it on", "👜 Keep it in the bag"], { emoji: "🛍️" });
    if (i !== 0 || rt.disposed) return;
    if (!await intoFitting(rt)) return;
    rt.luluHold(null);
    await changeAnim(rt, () => wear(want, "fitting"));
    if (rt.disposed) return;
    mirrorOn(rt, true);
    rt.bubble(pick(LULU.changed), rt.lulu.obj, 2);
    await rt.wait(1.1);
    await outOfFitting(rt);
}

/** The bag crosses the counter (0.6 s) and the coins count down above the till. */
function handOver(rt, p) {
    const bagM = rt.own(new THREE.MeshStandardMaterial({ color: shopOf(rt.data.shop).trim, roughness: 0.7 }));
    const bag = new THREE.Group();
    const body = new THREE.Mesh(rt.own(new THREE.BoxGeometry(0.28, 0.32, 0.12)), bagM);
    const tissue = new THREE.Mesh(rt.own(new THREE.BoxGeometry(0.22, 0.08, 0.08)), rt.own(new THREE.MeshStandardMaterial({ color: p.color })));
    tissue.position.y = 0.19; bag.add(body, tissue);
    const clerk = rt.byId.clerk, L = rt.lulu.obj;
    const from = clerk ? clerk.p.obj.position.clone().add(new THREE.Vector3(0.25, 1.05, 0.35)) : new THREE.Vector3(COUNTER.x, 1.1, COUNTER.z - 0.5);
    bag.position.copy(from);
    rt.add(bag);
    if (clerk) clerk.pose = { point: true };
    const till = new THREE.Vector3(COUNTER.x + 0.8, 1.6, -D / 2 + 0.6);
    let t = 0, shown = p.price, last = -1;
    sfx.coin();
    return rt.runMode({
        update(r, dt, P) {
            t += dt;
            if (P.confirm || P.back || ctx.skipping) t = Math.max(t, 0.9);
            const k = Math.min(1, t / 0.9), e = k * k * (3 - 2 * k);
            const to = new THREE.Vector3(L.position.x + 0.2, 0.95, L.position.z + 0.15);
            bag.position.lerpVectors(from, to, e);
            bag.position.y += Math.sin(e * Math.PI) * 0.25;
            // the price ticks down over the till (a bubble that counts: 150 → 0)
            const left = Math.max(0, Math.round(p.price * (1 - Math.min(1, t / 0.7))));
            if (left !== last && (left === 0 || Math.abs(left - shown) >= Math.max(1, p.price / 6))) {
                shown = left; last = left;
                r.bubble(left ? `−${fmt(p.price - left)} 💰` : `−${fmt(p.price)} 💰 ✓`, till, left ? 0.3 : 1.4, { yOff: 0 });
                if (left) sfx.click();
            }
            if (t >= 0.9) {
                bag.removeFromParent();
                const held = r.luluHold(bag.clone(), { y: -0.62, z: 0.06 });
                if (held) held.rotation.set(0, 0, 0);
                if (clerk) clerk.pose = {};
                r.burst({ x: L.position.x, y: 1.3, z: L.position.z }, ["#FFD54F", "#FF80AB", "#FFFFFF"], 10, 1.4, 0.04);
                sfx.coin();
                return true;
            }
            return false;
        },
    });
}

async function counterTalk(rt) {
    const R = shopOf(rt.data.shop), clerk = rt.byId.clerk;
    if (clerk) rt.bubble(pick(R.hello), clerk.p.obj, 3.2);
}
/** The fitting room on its own: a twirl in what she has on (and the mirror). */
async function fittingRoom(rt) {
    if (!await intoFitting(rt)) return;
    mirrorOn(rt, true);
    await changeAnim(rt, () => {});
    rt.bubble(pick(LULU.tried), rt.lulu.obj, 2);
    await rt.wait(1.2);
    await outOfFitting(rt);
}

export const SHOP_DEF = defineInterior({
    id: "clothesShop", name: "the clothing shop", short: "the shop", emoji: "👗", title: "👗 THE CLOTHING SHOP", model: "clothes_roomkit",
    tagline: "", models: ["npcWoman", "npcMan", "luluPerson"], light: "indoor",
    cam: { dist: 7.6, height: 5.6, lookY: 0.8, clampX: 2.6 }, walkSpeed: 3.5,
    build, tick,
    dispose(rt) { if (cardOpen()) closeCard(true); if (rt) mirrorOn(rt, false); },
});

// ── the doors in town (✋ — warmed on the way up: a soft cut) ─────────────
const inTown = () => !!(ctx.town && ctx.town.active);
const herPos = () => (ctx.foot && ctx.foot.active && ctx.foot.pos) || null;
function canWalkIn() {
    if (!inTown() || ctx.state !== "footRun" || !ctx.interiors) return false;
    if (!SHOPS[ctx.town.id]) return false;
    const party = !!(ctx.party && ctx.party.active), roam = party && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());
    if (party && !roam) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || (ctx.foot && ctx.foot.chasing)) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}
const OUT = { at: null, t: 0 };
function doorPos() {
    if (!canWalkIn()) return null;
    const sp = ctx.town.spot("clothes"), p = herPos();
    if (!sp || !p) return null;
    if (OUT.at && ctx.time < OUT.t && Math.hypot(p.x - OUT.at.x, p.z - OUT.at.z) < 4) return null;
    const d = Math.hypot(sp.x - p.x, sp.z - p.z);
    if (d < 24 && ctx.interiors.clothesShop && ctx.interiors.clothesShop.warm) ctx.interiors.clothesShop.warm();
    return d < 30 ? sp : null;      // (with its axes: the ✋ reaches across the shopfront — ci/doors)
}
/** Dress the room as one shop (a town id or "jfk"). */
export function nameShop(id) {
    SHOP = SHOPS[id] ? id : "lakewood";
    const R = shopOf(SHOP);
    SHOP_DEF.title = R.title; SHOP_DEF.name = R.name; SHOP_DEF.tagline = R.tagline;
    if (ctx.interiors.clothesShop) ctx.interiors.clothesShop.name = R.name;
}
/** Walk in through a town's door (✋ at the shopfront). */
export function enterShop() {
    const sp = inTown() && ctx.town.spot("clothes");
    if (!sp || !ctx.interiors.clothesShop) return false;
    nameShop(ctx.town.id);
    const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {});
    const dr = { id: "clothes", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
    emit("stat", { id: "footInteriors", n: 1 });
    emit("shops:open", { place: "clothes", town: ctx.town.id });
    const exit = () => { setState("footRun", { resume: "interior", door: dr }); OUT.at = { x: sp.x, z: sp.z }; OUT.t = ctx.time + 8; };
    return ctx.interiors.clothesShop.enter({ exit, door: "clothes", from: "foot" });
}
/** Straight in (tests / a door another feature owns — the JFK store asks for one): opts.exit() when she leaves. */
export function enterAs(id, opts = {}) {
    if (!ctx.interiors.clothesShop) return false;
    nameShop(id);
    if (PIECES.some(p => p.shop === id && isLimited(p.id))) refreshStock().catch(() => { });     // (the shelf's numbers)
    return ctx.interiors.clothesShop.enter(Object.assign({ from: "foot" }, opts));
}
export function addDoors() {
    if (!ctx.foot || !ctx.foot.addSpot) return;
    ctx.foot.addSpot({ pos: () => doorPos(), r: 2.4, door: true, walkIn: { id: "clothesShop" }, short: "CLOTHES", label: () => `👗 GO INTO ${shopOf(inTown() ? ctx.town.id : "lakewood").name.toUpperCase()}`, act: () => enterShop() });
}

on("clothes:stock", () => { if (cardOpen()) repaint(); });     // (the world's numbers arrived while the card is up)

export const shopDebug = { shopNow: () => SHOP, lastChange, inCubicle, CUBICLE, browse, tryOn, buyAtCounter, fittingRoom, FIT, COUNTER, doorPos, canWalkIn, setCurtain, SLOTS, clean };
