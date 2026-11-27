// features/playershops/room.js — 🏪 INSIDE HER SHOP (the interiors engine; realestate's dollhouse rooms): the shop floor
// with four shelf units (24 slots, 3 × 2 each), the counter by the door (OPENING SOON — only real players will buy, stage
// 2), and the back room: her boxes (the stockroom), the oven when it's a baking kind, the desk with the keys.
//   ✋ a shelf unit → a slot → a box from the back room → a price inside the band  (by hand, slot by slot)
//   ✋ the oven    → an ingredients box → the baking game (3 beats; ⭐ per beat hit) → 4 baked, 1–3 ⭐
//   ✋ the keys    → hand them back (a lease: the deposit back) / sell the building (two presses)
// A friend in a party walks in to LOOK (her shelves as she stocked them; nothing to buy yet).
import * as THREE from "three";
import { ctx, css, setState, emit } from "../../core/ctx.js";
import { wallet, saveSoon } from "../../core/save.js";
import { input } from "../../input.js";
import { defineInterior, pick } from "../interiors/engine.js";
import { rooms, W, D } from "../realestate/rooms.js";
import { SHARED } from "../together/rooms.js";
import { GOODS, KINDS, SHELF, BAKE, LEASE, SELL_FEE } from "./data.js";

let API = null;
export function bindRoom(api) { API = api; }
const fmt = n => Math.round(n).toLocaleString("en-US");
/** What's inside right now: { f (the front), id, mode: "owner" | "visit", friend } */
export const ROOM = { cur: null, bakeAuto: null, last: null };

export const SHOP_DEF = defineInterior({
    id: "playershop", name: "her shop", short: "the shop", emoji: "🏪",
    title: "🏪 HER SHOP", tagline: "opening soon",
    model: "homesKit", models: ["npcWoman", "npcMan"], music: "../story-relax.mp3",
    light: "indoor", cam: { dist: 6.4, height: 5.0, lookY: 0.8, clampX: 2.2 }, walkSpeed: 3.5,
    build, tick,
});
SHARED.playershop = () => (ROOM.cur ? ROOM.cur.id : null);      // (features/together: the owner + friends looking round share the room)

/** In through her (or a friend's) shop door. */
export function enterShop(f, mode, friend = null) {
    if (!ctx.interiors || !ctx.interiors.playershop || !ctx.foot) return false;
    const sh = mode === "owner" ? API.S.shops[f.id] : null;
    const k = KINDS[(sh || friend || {}).kind] || KINDS.kugel;
    SHOP_DEF.name = mode === "owner" ? sh.name : (friend.shopName || `${friend.name}'s ${k.name}`);
    SHOP_DEF.title = `${k.emoji} ${SHOP_DEF.name.toUpperCase()}`;
    ROOM.cur = { f, id: f.id, mode, friend };
    const n = ctx.world.road.nearest(f.ap.x, f.ap.z, ctx.car.s, {});
    const door = { id: "playershop", s: n.s, d: n.d, side: Math.sign(n.d) || 1 };
    const exit = () => {
        if (ROOM.cur && ROOM.cur.mode === "owner" && API && API.SVR && API.SVR.SV.on) API.SVR.counter(ROOM.cur.id, true);
        ROOM.cur = null;
        if (ctx.foot && ctx.foot.active !== undefined) setState("footRun", { resume: "interior", door });
        backOut(f);
    };
    return ctx.interiors.playershop.enter({ exit, door: "playershop", from: "foot" });
}
function backOut(f) {
    const p = ctx.foot && ctx.foot.pos;
    if (!p) return;
    setTimeout(() => {
        try {
            p.set(f.ap.x, 0.05, f.ap.z);
            if (ctx.foot.obj) { ctx.foot.obj.position.copy(p); ctx.foot.obj.rotation.set(0, Math.atan2(f.nx, f.nz), 0); }
            if (ctx.cam && ctx.cam.snap) ctx.cam.snap();
        } catch (e) { /* */ }
    }, 0);
}
const shelfOf = () => {
    const c = ROOM.cur;
    if (!c) return [];
    if (c.mode === "owner") { const sh = API.S.shops[c.id]; return sh ? sh.shelf : []; }
    return (c.friend && c.friend.shelf) || [];
};

// ── the room ─────────────────────────────────────────────────────────────────────────────────────────────────────
// four shelf units on the shop floor: [x, z, ry] (room 0's centre is cx[0]); each holds 3 columns × 2 shelves
const UNITS = [[-2.0, -D / 2 + 0.35, 0], [0.0, -D / 2 + 0.35, 0], [-W / 2 + 0.35, -0.3, Math.PI / 2], [-W / 2 + 0.35, 1.5, Math.PI / 2]];
const LEVELS = [0.62, 1.22];
function build(rt) {
    const c = ROOM.cur, owner = c && c.mode === "owner";
    ROOM.bought = 0;
    const sh = owner ? API.S.shops[c.id] : null;
    const kind = KINDS[(sh || (c && c.friend) || {}).kind] || KINDS.kugel;
    const V = rt.data.V = { slots: [], unitAt: [], stockObjs: [], key: "" };
    rt.root.visible = false;            // (the kit's own default room: hidden — the dollhouse rooms below are the shop)
    const B = rooms(rt, 2, { floors: ["#D7C4A3", "#A1887F"], walls: [lighten(kind.color), "#E0D6C8"], door: 0, doorDx: 1.6 });
    const [SF, BR] = B.cx;
    V.B = B; V.SF = SF;
    // the shelf units (a frame + two boards each)
    UNITS.forEach(([ux, uz, ry], k) => {
        const x = SF + ux, z = uz;
        const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; rt.add(g);
        const wood = B.mat("#8D6E63");
        for (const sx of [-0.68, 0.68]) { const m = new THREE.Mesh(rt.own(new THREE.BoxGeometry(0.05, 1.8, 0.42)), wood); m.position.set(sx, 0.9, 0); g.add(m); }
        for (const y of [0.05, ...LEVELS, 1.78]) { const m = new THREE.Mesh(rt.own(new THREE.BoxGeometry(1.4, 0.04, 0.42)), wood); m.position.set(0, y, 0); g.add(m); }
        const back = new THREE.Mesh(rt.own(new THREE.BoxGeometry(1.4, 1.8, 0.02)), B.mat("#BCAAA4")); back.position.set(0, 0.9, -0.2); g.add(back);
        V.unitAt.push(g);
        const sw = Math.abs(Math.cos(ry)) > 0.5;
        B.col("unit" + k, x - (sw ? 0.72 : 0.24), x + (sw ? 0.72 : 0.24), z - (sw ? 0.24 : 0.72), z + (sw ? 0.24 : 0.72));
        const hx = x + Math.sin(ry) * 0.9, hz = z + Math.cos(ry) * 0.9;
        const shop = c && c.mode === "shop";
        rt.hot({ id: "shelf:" + k, x: hx, z: hz, r: 1.1, label: () => (owner ? `🧺 Shelf ${k + 1} — stock it` : shop ? `🛍️ Shelf ${k + 1}` : `👀 Shelf ${k + 1}`), action: r => (owner ? shelfMenu(r, k) : shop ? buyMenu(r, k) : lookShelf(r, k)) });
    });
    // the counter by the door + the OPENING SOON card
    B.box(1.6, 0.95, 0.6, "#6D4C41", SF + 1.6, 0.475, 0.2);
    B.col("counter", SF + 0.8, SF + 2.4, -0.1, 0.5);
    const live = !!(API && API.SVR && API.SVR.SV.on);
    const card = new THREE.Mesh(rt.own(new THREE.PlaneGeometry(0.9, 0.42)), rt.own(new THREE.MeshBasicMaterial({ map: rt.own(cardTex(live ? ["OPEN", "real players only"] : ["OPENING SOON", "only real players buy"], kind.color)), toneMapped: false })));
    card.position.set(SF + 1.6, 1.18, 0.51); rt.add(card);
    rt.hot({ id: "counter", x: SF + 1.6, z: 1.1, r: 1.1, label: c && c.mode === "shop" ? "🛎️ The counter — 👍 / 🚩" : "🛎️ The counter", action: r => (c && c.mode === "shop" ? counterMenu(r) : r.say("Lulu", owner
        ? (live ? pick(["Open for business! Only REAL players buy here. While I'm out, what sells goes into the till — it comes to my phone.", "The till's ready. Real customers only. No pretend ones."])
            : pick(["Opening soon! Only REAL players can buy here — no pretend customers. When the shop opens for real, they'll pay at this counter.", "The till is empty. Tidy. Ready. Like me."]))
        : `${c.friend ? c.friend.name : "Your friend"}'s shop isn't open yet. Only real players will buy here, once it opens. Looking is free!`, { emoji: "💁‍♀️" })) });
    // the back room: her boxes, the oven (baking kinds), the desk + keys
    rt.hot({ id: "stock", x: BR - 1.6, z: -0.8, r: 1.3, label: () => `📦 The back room (${owner && sh ? sh.stock.length : 0} boxes)`, action: r => (owner ? stockList(r) : r.say("Lulu", "The back room's private. Even friends don't see the back room. Especially friends.", { emoji: "💁‍♀️" })) });
    if (kind.bake) {
        B.box(0.9, 1.0, 0.7, "#37474F", BR + 1.9, 0.5, -D / 2 + 0.45);
        B.box(0.6, 0.38, 0.03, "#111111", BR + 1.9, 0.62, -D / 2 + 0.81);
        B.col("oven", BR + 1.4, BR + 2.4, -D / 2, -D / 2 + 0.85);
        rt.hot({ id: "oven", x: BR + 1.9, z: -D / 2 + 1.5, r: 1.1, label: "🔥 The oven — bake", action: r => (owner ? bakeMenu(r) : r.say("Lulu", "Don't touch the oven. It's her oven. It has feelings.", { emoji: "💁‍♀️" })) });
    }
    B.put("Desk", BR + 0.6, 1.4, Math.PI, 1.6, 0.8);
    if (owner) rt.hot({ id: "keys", x: BR + 0.6, z: 0.4, r: 1.1, label: "🔑 The keys", action: keysMenu });
    refreshShelves(rt, true);
    refreshStock(rt, true);
    rt.lulu.obj.position.set(B.doorX, 0, D / 2 - 0.9);
    rt.lulu.obj.rotation.y = Math.PI;
}
function lighten(hex) { const c = new THREE.Color(hex); c.lerp(new THREE.Color("#FFFFFF"), 0.72); return "#" + c.getHexString(); }
function cardTex(lines, color) {
    const c = document.createElement("canvas"); c.width = 512; c.height = 240;
    const g = c.getContext("2d");
    g.fillStyle = "#FFFDF7"; g.fillRect(0, 0, 512, 240); g.strokeStyle = color; g.lineWidth = 12; g.strokeRect(6, 6, 500, 228);
    g.fillStyle = color; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 62px sans-serif"; g.fillText(lines[0], 256, 96);
    g.fillStyle = "#555"; g.font = "bold 30px sans-serif"; g.fillText(lines[1], 256, 176);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// goods on the shelves: per filled slot, n little boxes in the good's colour + its emoji on a tag
const EMO = new Map();
function emojiTex(e) {
    if (EMO.has(e)) return EMO.get(e);
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    const g = c.getContext("2d"); g.font = "52px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(e, 32, 36);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; EMO.set(e, t); return t;
}
const GCOL = { kugel: "#D4A04C", kugelSweet: "#E8C97A", cake: "#8D5524", rugelach: "#C68642", sushi: "#FAFAFA", pan: "#424242", seltzer: "#4FC3F7", pillow: "#F5F5F5",
    blower: "#FB8C00", balloon: "#E91E63", chicken: "#FDD835", giftbox: "#AB47BC", washToken: "#29B6F6", airFresh: "#66BB6A" };
function refreshShelves(rt, force = false) {
    const V = rt.data.V, shelf = shelfOf();
    const key = shelf.map(x => (x ? x.g + x.n : "-")).join(",");
    if (!force && key === V.key) return;
    V.key = key;
    for (const o of V.slots) o.removeFromParent();
    V.slots = [];
    const geo = rt.data.goodGeo || (rt.data.goodGeo = rt.own(new THREE.BoxGeometry(0.16, 0.16, 0.16)));
    const tagGeo = rt.data.tagGeo || (rt.data.tagGeo = rt.own(new THREE.PlaneGeometry(0.2, 0.2)));
    shelf.forEach((x, i) => {
        if (!x || !GOODS[x.g]) return;
        const u = Math.floor(i / 6), j = i % 6, col = j % 3, lev = Math.floor(j / 3);
        const unit = V.unitAt[u];
        if (!unit) return;
        const grp = new THREE.Group(); grp.position.set(-0.44 + col * 0.44, LEVELS[lev] + 0.1, 0.02);
        const mat = rt.data["m_" + x.g] || (rt.data["m_" + x.g] = rt.own(new THREE.MeshStandardMaterial({ color: GCOL[x.g] || "#BDBDBD", roughness: 0.6 })));
        for (let n = 0; n < Math.min(SHELF.perSlot, x.n); n++) { const m = new THREE.Mesh(geo, mat); m.position.set((n % 2) * 0.18 - 0.09, Math.floor(n / 2) * 0.17, ((n % 2) ? 0.05 : -0.04)); grp.add(m); }
        const tag = new THREE.Mesh(tagGeo, rt.data["t_" + x.g] || (rt.data["t_" + x.g] = rt.own(new THREE.MeshBasicMaterial({ map: emojiTex(GOODS[x.g].emoji), transparent: true, toneMapped: false }))));
        tag.position.set(0, -0.02, 0.22); grp.add(tag);
        unit.add(grp); V.slots.push(grp);
    });
}
function refreshStock(rt, force = false) {
    const V = rt.data.V, c = ROOM.cur, sh = c && c.mode === "owner" ? API.S.shops[c.id] : null;
    const n = sh ? Math.min(12, sh.stock.length) : 0;
    if (!force && V.stockN === n) return;
    V.stockN = n;
    for (const o of V.stockObjs) o.removeFromParent();
    V.stockObjs = [];
    const BR = V.B.cx[1];
    for (let k = 0; k < n; k++) {
        const o = V.B.box(0.55, 0.42, 0.45, ["#C8A165", "#BF9A5E", "#D1AB70"][k % 3], BR - 2.3 + (k % 3) * 0.6, 0.21 + Math.floor(k / 3) % 3 * 0.43, -D / 2 + 0.4 + Math.floor(k / 9) * 0.5);
        o.rotation.y = (k % 4) * 0.12; V.stockObjs.push(o);
    }
}
function tick(rt, dt) {
    refreshShelves(rt); refreshStock(rt);
    // (she's in her own shop: she's at the counter — a visitor can tip her; the relay's mark lasts 90 s, pinged every 60)
    const c = ROOM.cur;
    if (c && c.mode === "owner" && API && API.SVR && API.SVR.SV.on && (rt.data.V.ping = (rt.data.V.ping || 60) + (dt || 0)) >= 60) { rt.data.V.ping = 0; API.SVR.counter(c.id); }
}

// ── owner: shelving by hand ──────────────────────────────────────────────────────────────────────────────────────
const say = (rt, t) => rt.say("Lulu", t, { emoji: "💁‍♀️" });
const slotLine = (x, i) => (x ? `${i + 1}. ${GOODS[x.g].emoji} ${GOODS[x.g].name} ×${x.n} · ${fmt(x.price)} 💰${x.stars ? " " + "⭐".repeat(x.stars) : ""}` : `${i + 1}. (empty)`);
async function shelfMenu(rt, k) {
    const c = ROOM.cur, sh = API.S.shops[c.id];
    if (!sh) return;
    const idx = [0, 1, 2, 3, 4, 5].map(j => k * 6 + j);
    const i = await rt.choose("Shelf " + (k + 1), "Which spot?", idx.map(s => slotLine(sh.shelf[s], s - k * 6)).concat(["‹ Back"]));
    if (i < 0 || i >= 6) return;
    const slot = idx[i], cur = sh.shelf[slot];
    if (cur) {
        const j = await rt.choose("Shelf " + (k + 1), slotLine(cur, i), ["➕ Add more from the back", "💲 Change the price", "↩️ Take it off the shelf", "‹ Back"]);
        if (j === 0) return addTo(rt, slot, cur);
        if (j === 1) return pricePick(rt, slot, cur.g, cur.stars).then(p => { if (p) { cur.price = p; API.S.shops[c.id].shelf[slot] = cur; } });
        if (j === 2) { if (!API.unshelve(c.id, slot)) await say(rt, "The back room's full. No room to put it back."); }
        return;
    }
    return addTo(rt, slot, null);
}
async function addTo(rt, slot, cur) {
    const c = ROOM.cur, sh = API.S.shops[c.id];
    const opts = sh.stock.map((x, k) => ({ x, k })).filter(({ x }) => !x.ing && (!cur || (x.g === cur.g && (x.stars || 0) === (cur.stars || 0))));
    if (!opts.length) { await say(rt, sh.stock.some(x => x.ing) ? "Only ingredients back there. Bake first — the oven's in the back." : cur ? "No more of that in the back room." : "The back room's empty. The 📦 Wholesale Depot at any rest area sells boxes. Bring the car round and I'll carry them in."); return; }
    const i = await rt.choose("The back room", "What goes on the shelf?", opts.map(({ x }) => `${GOODS[x.g].emoji} ${GOODS[x.g].name} ×${x.n}${x.stars ? " " + "⭐".repeat(x.stars) : ""}`).concat(["‹ Back"]));
    if (i < 0 || i >= opts.length) return;
    const it = opts[i].x;
    const p = cur ? cur.price : await pricePick(rt, slot, it.g, it.stars);
    if (!p) return;
    if (!API.shelve(c.id, opts[i].k, slot, p)) await say(rt, "It won't fit. Four to a spot — I'm not running a jenga shop.");
}
async function pricePick(rt, slot, g, stars) {
    const [lo, hi] = API.band(g, stars);
    const steps = [...new Set([lo, Math.round(lo + (hi - lo) / 3), Math.round(lo + 2 * (hi - lo) / 3), hi])];
    const i = await rt.choose("The price tag", `${GOODS[g].emoji} ${GOODS[g].name}: the town allows ${lo}–${hi} coins each.`, steps.map(p => `🏷️ ${p} 💰`).concat(["‹ Back"]));
    return i >= 0 && i < steps.length ? steps[i] : 0;
}
async function lookShelf(rt, k) {
    const shelf = shelfOf(), idx = [0, 1, 2, 3, 4, 5].map(j => k * 6 + j);
    const rows = idx.map((s, i) => shelf[s] ? `${i + 1}. ${GOODS[shelf[s].g].emoji} ${GOODS[shelf[s].g].name} ×${shelf[s].n}` : null).filter(Boolean);
    await rt.say("Shelf " + (k + 1), rows.length ? rows.join(" · ") + ". Nothing's for sale yet — opening soon." : "Empty. She hasn't stocked this one yet.", { emoji: "🧺" });
}
async function stockList(rt) {
    const sh = API.S.shops[ROOM.cur.id];
    const rows = sh.stock.map(x => `${GOODS[x.g].emoji} ${x.ing ? "ingredients: " : ""}${GOODS[x.g].name}${x.ing ? "" : " ×" + x.n}${x.stars ? " " + "⭐".repeat(x.stars) : ""}`);
    await rt.say("The back room", rows.length ? `${rows.length} box${rows.length === 1 ? "" : "es"}: ${rows.slice(0, 8).join(", ")}${rows.length > 8 ? "…" : ""}` : "Empty. Feldman's Wholesale Depot at any rest area. Bring the car.", { emoji: "📦" });
}
async function keysMenu(rt) {
    const c = ROOM.cur, sh = API.S.shops[c.id];
    if (!sh) return;
    const lease = sh.how === "lease";
    const line = lease ? `Leased from Mr. Gelbfish. ${LEASE.perDay} a day you play.${sh.due ? " Today's is due." : ""} The permit: ${API.permitted(c.id) ? "stamped ✅" : "not yet — City Hall's Permits window"}.`
        : `Yours. The whole building. The permit: ${API.permitted(c.id) ? "stamped ✅" : "not yet — City Hall's Permits window"}.`;
    const back = lease ? sh.deposit || 0 : Math.round((sh.price || 0) * (1 - SELL_FEE));
    const live = !!(API.SVR && API.SVR.SV.on);
    const clerkRow = live ? (sh.clerk ? "🧑‍💼 Let Mrs. Zissel go (the shop closes when you're away)" : "🧑‍💼 Hire Mrs. Zissel, the clerk (10 % of what she sells)") : null;
    const opts = [lease ? `🔑 Hand the keys back — ${fmt(back)} deposit back` : `💰 Sell the building — about ${fmt(back)} back`].concat(clerkRow ? [clerkRow] : [], ["‹ Keep it"]);
    const i = await rt.choose("🔑 The keys", line + (live ? (sh.clerk ? " Mrs. Zissel minds the shop while you're out." : " Nobody minds the shop while you're out — it's closed then.") : ""), opts);
    if (clerkRow && i === 1) {
        const r = await API.SVR.clerk(c.id, !sh.clerk);
        if (r && r.ok) { sh.clerk = !!r.c; saveSoon(); await rt.say("Mrs. Zissel", sh.clerk ? "I'll mind it. I take ten percent. I don't do discounts. I don't do 'just looking'. I do RECEIPTS." : "Fine. FINE. Call me when you need me. You'll need me.", { emoji: "🧑‍💼" }); }
        else await say(rt, "The town's computer is thinking. Try again in a moment.");
        return;
    }
    if (i !== 0) return;
    const j = await rt.choose("🔑 The keys", lease ? "Close the shop? What's in it goes home in boxes." : "Sell it? What the bank's still owed comes off. What's in it goes home in boxes.", ["✅ Yes, close it", "✖ No"]);
    if (j !== 0) return;
    const got = API.release(c.id, lease ? "keys" : "sold");
    await say(rt, `Done. ${fmt(got)} coins back. Goodbye, little shop.`);
    rt.leave();
}

// ── buying in another player's shop (stage 2: the relay says yes first, then her coins move) ──
const GIFT_LINES = { cake: "Honey cake. Still warm-ish. A heart's worth of happy.", rugelach: "Rugelach! Flaky. Dangerous.", sushi: "Sushi from Lakewood. Brave. Delicious. Brave.",
    giftbox: "A gift box! For a friend. Or for her. She's a friend.", washToken: "A car-wash token. The car will be SO clean (once the car wash opens).", airFresh: "Pine-scented. The car smells like a forest now. A forest that drives." };
async function buyMenu(rt, k) {
    const c = ROOM.cur, shelf = shelfOf(), idx = [0, 1, 2, 3, 4, 5].map(j => k * 6 + j).filter(s => shelf[s]);
    if (!idx.length) { await rt.say("Shelf " + (k + 1), "Empty. She'll restock. Probably.", { emoji: "🧺" }); return; }
    const rows = idx.map(s => { const x = shelf[s]; return `${GOODS[x.g].emoji} ${GOODS[x.g].name}${x.stars ? " " + "⭐".repeat(x.stars) : ""} — ${fmt(x.price)} 💰${x.so ? " (sold out today)" : ` (${x.n} left)`}`; });
    const i = await rt.choose("Shelf " + (k + 1), `${c.friend.name}'s shelf. You have ${fmt(wallet.coins)} coins.`, rows.concat(["‹ Back"]));
    if (i < 0 || i >= idx.length) return;
    const slot = idx[i], x = shelf[slot];
    if (x.so) { await rt.say("The shelf", "Sold out for today. Come back tomorrow!", { emoji: "🧺" }); return; }
    if (wallet.coins < x.price) { await say(rt, `It's ${fmt(x.price)}. I have ${fmt(wallet.coins)}. Next time.`); return; }
    const j = await rt.choose("The shelf", `${GOODS[x.g].emoji} ${GOODS[x.g].name} for ${fmt(x.price)} coins?`, [`✅ Buy it — ${fmt(x.price)} 💰`, "‹ Not now"]);
    if (j !== 0) return;
    let tip = 0;
    if (c.friend.at) {     // (the owner's at her counter: a tip goes straight to her — from HER coins, inside the day's caps)
        const opts = [0, 5, 10].filter(n => wallet.coins >= x.price + n);
        const k = await rt.choose(`🛎️ ${c.friend.name}`, `${c.friend.name} wraps it herself. A tip?`, opts.map(n => (n ? `💝 Tip ${n} 💰` : "No tip, thanks")));
        tip = k > 0 ? opts[k] : 0;
    }
    const r = await API.SVR.buy(c.id, slot, x.price, tip);
    if (!r || !r.ok) {
        const why = r && r.why;
        if (why === "price" && r.p) { x.price = r.p; await say(rt, `The price changed to ${fmt(r.p)}. Shops!`); return; }
        await say(rt, why === "new" ? "Shops only sell to players who've been around a few days. Come back soon!"
            : why === "spent" ? "That's all I can spend at her shops today. Tomorrow!"
            : why === "buys" ? "Three from one shop a day. That's the town's rule. (Fairness. Apparently.)"
            : why === "soldout" ? "Sold out for today!"
            : why === "gone" ? "Somebody just bought the last one. Shopping is a contact sport."
            : why === "unminded" ? "Nobody's minding the shop right now. Come back when she's around."
            : "The till's stuck. Try again in a moment.");
        if (why === "soldout") x.so = true;
        if (why === "gone") { x.n = 0; shelf[slot] = null; }
        return;
    }
    if (!wallet.spend(r.p)) return;
    x.n = r.left; if (x.n <= 0) shelf[slot] = null;
    ROOM.bought = (ROOM.bought || 0) + 1;
    const item = GOODS[r.g] && GOODS[r.g].item;
    if (item && ctx.houseitems && ctx.houseitems.add) ctx.houseitems.add(item, "shop:" + c.friend.name, false);
    emit("playershops:bought", { id: c.id, g: r.g, p: r.p });
    emit("stat", { id: "shopBuys", n: 1 });
    saveSoon();
    await say(rt, item ? `${GOODS[r.g].emoji} Mine! It's in my bag.` : GIFT_LINES[r.g] || "Bought!");
}
async function counterMenu(rt) {
    const c = ROOM.cur;
    const opts = [ROOM.bought ? "👍 Leave a thumbs up" : "👍 (buy something first)", "🚩 Report this shop's name", "‹ Never mind"];
    const who = c.friend.at ? `${c.friend.name} is at the counter herself!` : c.friend.clerk ? "Mrs. Zissel, the clerk, minds the counter. She does not smile. It's not personal." : `A bell, a note: "ring for service (I'm out)".`;
    const i = await rt.choose("🛎️ The counter", `${c.friend.name}'s shop. ${c.friend.thumbs || 0} 👍 so far. ${who}`, opts);
    if (i === 0 && ROOM.bought) { const ok = await API.SVR.thumb(c.id); await say(rt, ok ? "👍 Done. She'll see it." : "Already did that today."); }
    else if (i === 1) { await API.SVR.report(c.id); await say(rt, "Reported. If enough people agree, the name goes back to plain."); }
}

// ── the oven: the baking game ────────────────────────────────────────────────────────────────────────────────────
css("playershops-bake", `
.ps-bake { position: fixed; left: 50%; bottom: 20%; transform: translateX(-50%); width: min(440px, 88vw); background: rgba(43,27,46,.86); color: #fff;
  border-radius: 18px; padding: 14px 16px 16px; font: 700 17px var(--font, sans-serif); text-align: center; z-index: 60; touch-action: none; }
.ps-bake .bar { position: relative; height: 26px; margin: 12px 0 6px; background: #5D4037; border-radius: 13px; overflow: hidden; }
.ps-bake .zone { position: absolute; top: 0; bottom: 0; background: #43A047; }
.ps-bake .mark { position: absolute; top: -2px; width: 6px; height: 30px; background: #FFE082; border-radius: 3px; }
.ps-bake .beats { letter-spacing: 6px; font-size: 22px; }
`);
const STEPS = ["Mix it", "Into the oven", "Out — golden"];
/** One bake: 3 beats; press when the marker is in the green. → stars 1–3 */
function bakeGame() {
    if (ROOM.bakeAuto != null) return Promise.resolve(ROOM.bakeAuto);
    return new Promise(res => {
        const el = document.createElement("div"); el.className = "ps-bake";
        el.innerHTML = `<div class="t"></div><div class="bar"><div class="zone"></div><div class="mark"></div></div><div class="beats"></div><small>Tap / ✕ when it's in the green</small>`;
        document.body.appendChild(el);
        let step = 0, hits = 0, t = 0, last = performance.now(), done = false, zone = [0.4, 0.6];
        const T0 = performance.now();
        const setStep = () => { const w = 0.22 - step * 0.04, c = 0.2 + Math.random() * (0.6 - w); zone = [c, c + w]; el.querySelector(".zone").style.cssText = `left:${zone[0] * 100}%;width:${w * 100}%`; el.querySelector(".t").textContent = `🔥 ${STEPS[step]}`; el.querySelector(".beats").textContent = "⭐".repeat(hits) + "·".repeat(BAKE.steps - step); };
        setStep();
        const press = () => {
            if (done) return;
            const x = (Math.sin(t) + 1) / 2;
            if (x >= zone[0] && x <= zone[1]) hits++;
            step++;
            if (step >= BAKE.steps) finish(); else setStep();
        };
        const finish = () => { done = true; el.removeEventListener("pointerdown", press); el.remove(); res(Math.max(1, hits)); };
        el.addEventListener("pointerdown", press);
        const loop = now => {
            if (done) return;
            const dt = Math.min(0.05, (now - last) / 1000); last = now;
            t += dt * (2.2 + step * 0.7);
            el.querySelector(".mark").style.left = `calc(${((Math.sin(t) + 1) / 2) * 100}% - 3px)`;
            const pr = input.pressed || {};
            if (pr.confirm || pr.interact || pr.jump) press();
            if ((now - T0) / 1000 > BAKE.secs) { while (!done && step < BAKE.steps) { step++; } finish(); }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    });
}
async function bakeMenu(rt) {
    const c = ROOM.cur, sh = API.S.shops[c.id];
    const ing = sh.stock.map((x, k) => ({ x, k })).filter(({ x }) => x.ing);
    if (!ing.length) { await say(rt, "No ingredients. Feldman's Wholesale Depot sells them — one box bakes four."); return; }
    const i = await rt.choose("🔥 The oven", "Bake what?", ing.map(({ x }) => `${GOODS[x.g].emoji} ${GOODS[x.g].name} (makes ${BAKE.perBatch})`).concat(["‹ Back"]));
    if (i < 0 || i >= ing.length) return;
    const stars = await bakeGame();
    API.bakeDone(c.id, ing[i].k, stars);
    ROOM.last = { stars };
    await say(rt, ["Edible. Technically. ⭐", "Not bad at all! ⭐⭐", "PERFECT. Bubbe would weep. ⭐⭐⭐"][Math.max(0, Math.min(2, stars - 1))]);
}
export { W, D };
