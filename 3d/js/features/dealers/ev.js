// features/dealers/ev.js — ⚡ TUSHLA MOTORS, across the highway from Mazelati (a LEFT pull-off at the same lap metre: she
// crosses the oncoming lanes to reach it, like any left turn — never driving the wrong way along them). White,
// minimalist, NO salesmen: a tablet kiosk by the door (✋ → the card: the cars at a fixed price — "the price is the price",
// two presses to buy — and ⚡ Full Schlep Driving: subscribe / cancel / the days left). The founder, Reb Zev Volt, posts
// too much (a post on the tablet card + a toast now and then when she's there). The cars join the car list like
// Mazelati's (car.js SKINS + garage SKIN_SHOP, kit "tushla") and are paid through garage/buy.js.
import { ctx, on, hook, emit, css } from "../../core/ctx.js";
import { SKINS, KITS } from "../../car.js";
import { LAP, lapS } from "../../world.js";
import { paved } from "../../core/driving.js";
import { models, cloneWithColors, findNodes } from "../../models.js";
import * as H from "../../hud.js";
import { wallet } from "../../core/save.js";
import { SKIN_SHOP, SKIN_KEYS, STAT_ROWS, inv, syncInv } from "../garage/data.js";
import { owns, equipSkin, buyCar } from "../garage/buy.js";
import { addPlace, local } from "../world/places.js";
import { openCard, cardTick, cardOpen, closeCard, cardSay, repaint } from "../shops/card.js";
import { EV, EV_CARS, EV_IDS, LAP_M, ZEV, SUB } from "./data.js";
import { EVSHOW } from "./models.js";
import { schlep } from "./schlep.js";
import { DS } from "./perks.js";

for (const [id, c] of Object.entries(EV_CARS)) {
    SKINS[id] = { name: c.name, body: c.body, light: c.light, dark: c.dark, top: c.top, acc: c.acc, grip: c.grip, brake: c.brake,
        nitro: c.nitro, perks: c.perks, kit: "tushla", marque: "tushla" };
    SKIN_SHOP[id] = { price: c.price, flavor: c.flavor, stripe: c.stripe, where: "Tushla Motors, across the highway from Mazelati (half a mile past the lap line)" };
    if (!SKIN_KEYS.includes(id)) SKIN_KEYS.push(id);
}
const fmt = n => Math.round(n).toLocaleString("en-US");
const pick = a => a[Math.floor(Math.random() * a.length)];
const EV_AT = [];
for (let n = 0; n * LAP < 400000; n++) EV_AT.push(n * LAP + LAP_M);
const E = { spots: [], cars: [], at: null, armed: null, postT: 8 };
const dead = new WeakSet();
on("chunk:dispose", ({ chunk }) => { dead.add(chunk); E.spots = E.spots.filter(s => s.chunk !== chunk); });
const live = sp => sp && sp.obj && sp.chunk && !dead.has(sp.chunk);

paved.push((s, d) => (d < -8.8 && d > -44 && Math.abs(lapS(s) - LAP_M) < 18 ? 2 : 0));
on("boot", () => { const w = ctx.world; if (w && w.reserve) for (const s of EV_AT) w.reserve(s - 30, s + 30, -1, 7.5, 46); });
function walls(spot) {
    const out = [], c = (x, z, r) => { const p = local(spot, x, z, {}); out.push({ x: p.x, z: p.z, r }); };
    const W = EVSHOW.w, zf = EVSHOW.z0, zb = zf - EVSHOW.d;
    for (let x = -W / 2 + 0.9; x <= W / 2 - 0.9 + 1e-6; x += 1.4) { if (Math.abs(x) > 1.6) c(x, zf - 0.9, 1.0); c(x, zb + 0.9, 1.0); }
    for (let z = zb + 0.9; z <= zf - 0.9 + 1e-6; z += 1.4) { c(-W / 2 + 0.9, z, 1.0); c(W / 2 - 0.9, z, 1.0); }
    c(EVSHOW.tablet.x, EVSHOW.tablet.z, 0.4);
    return out;
}
addPlace({
    id: "tushla", kind: "dealer", name: EV.full, icon: EV.emoji, verb: "stop at Tushla",
    where: mode => (mode === "cruise" || mode === "party" ? EV_AT : []),
    model: "dealers_tushla", d: EV.d, side: -1, bay: { half: 16, d0: 9, d1: 26 }, dur: 2.4,
    sign: { d: -10.4, bg: EV.sign.bg, fg: EV.sign.fg, w: 4.6, h: 2.4, tw: 512, th: 260, lines: EV.sign.lines },
    colliders: spot => walls(spot),
    built: spot => { E.spots = E.spots.filter(s => live(s) && s.key !== spot.key); E.spots.push(spot); },
    beats: [{ t: 0.3, run: () => H.toast(`📱 ${ZEV.name}: “${pick(ZEV.posts)}”`, "", { key: "zev" }) }],
});
function nearSpot(max = 110) {
    const me = (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
    if (!me) return null;
    let best = null, bd = max;
    for (const sp of E.spots) { if (!live(sp)) continue; const d = Math.hypot(sp.x - me.x, sp.z - me.z); if (d < bd) { bd = d; best = sp; } }
    return best;
}
const padWorld = (sp, k) => local(sp, EVSHOW.pads[k].x, EVSHOW.pads[k].z, {});
function anchorsOf(obj) { const a = {}; obj.traverse(o => { if (o.name && o.name.startsWith("Anchor_")) a[o.name.slice(7).replace(/\d+$/, "")] = o; }); return a; }
function drop() { for (const c of E.cars) c.obj.removeFromParent(); E.cars = []; E.at = null; }
hook("hud", dt => {
    const sp = nearSpot(150);
    if (!sp || !models.lulu) { if (E.at) drop(); return; }
    if (E.at !== sp) {
        drop(); E.at = sp;
        EV_IDS.forEach((id, k) => {
            const sk = SKINS[id], o = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
            for (const n of findNodes(o, "Driver")) n.visible = false;
            for (const n of findNodes(o, "Hair_")) n.visible = false;
            KITS.tushla(o, anchorsOf(o), sk);
            const p = padWorld(sp, k);
            o.position.set(p.x, 0.1, p.z); o.rotation.y = sp.rot + Math.PI;     // (nose to the glass: the tidy row)
            ctx.scene.add(o);
            E.cars.push({ id, obj: o });
        });
    }
    // the founder posts too much (only while she's here, on foot)
    if (ctx.foot && ctx.foot.active && (E.postT -= dt) <= 0) { E.postT = 35 + Math.random() * 30; H.toast(`📱 ${ZEV.name}: “${pick(ZEV.posts)}”`, "", { key: "zev" }); }
});
on("run:start", () => { drop(); E.spots = []; });

// ── on foot: ✋ the tablet, ✋ a car (→ the same card) ──
const onFootHere = () => ctx.state === "footRun" && ctx.foot && ctx.foot.pos && E.at && !cardOpen();
const tabletSpot = {
    r: 2.2, short: "TABLET",
    pos() { if (!onFootHere()) return null; const w = local(E.at, EVSHOW.tablet.x, EVSHOW.tablet.z + 1.4, {}); return { x: w.x, z: w.z }; },
    label: () => "⚡ TUSHLA TABLET — CARS · FULL SCHLEP DRIVING",
    act: () => openTablet(),
};
const carSpot = k => ({
    r: 2.6, short: "CAR",
    pos() { if (!onFootHere()) return null; const p = EVSHOW.pads[k], w = local(E.at, p.x, p.z + 3.4, {}); return { x: w.x, z: w.z }; },
    label: () => { const id = EV_IDS[k], c = EV_CARS[id]; return owns("car", id) ? `⚡ ${c.name.toUpperCase()} — YOURS` : `⚡ ${c.name.toUpperCase()} — ${fmt(c.price)} 💰`; },
    act: () => openTablet(EV_IDS[k]),
});
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) { ctx.foot.addSpot(tabletSpot); EV_IDS.forEach((_, k) => ctx.foot.addSpot(carSpot(k))); } });

css("dealers-ev", `.dl-ev { font-family: Helvetica, Arial, sans-serif; } .dl-post { font-size: 12px; opacity: .8; margin-top: 6px; }`);
const evBar = m => Math.max(0, Math.min(1, ((m || 1) - 0.7) / 1.2));     // (0.7 → 1.9: acceleration goes off Refael's chart)
function subLine() {
    const s = schlep;
    if (!s.active()) return `Not subscribed · ${SUB.price} 💰 / ${SUB.days} days · cancel any time`;
    const st = DS.sub;
    return st && st.cancelled ? `Cancelled — runs out in ${s.daysLeft()} days (no more charges)` : `✓ Active — renews in ${s.daysLeft()} days (${SUB.price} 💰)`;
}
function headHtml(id) {
    if (id === "schlep") {
        return `<div class="dl-ev"><b>⚡ Full Schlep Driving</b> — <i>it drives. You schlep.</i><br>${subLine()}<br>`
            + Object.values(SUB.modes).map(m => `<b>${m.name}</b>: ${m.desc}`).join("<br>")
            + `<div class="dl-post">In a Tushla on the highway: ❚❚ › ⚡ Let the car drive. It keeps to the limit, earns no bonuses, and hands you the wheel for police, work zones, jobs and town.</div></div>`;
    }
    const sk = SKINS[id], c = EV_CARS[id];
    const rows = STAT_ROWS.map(([lab, key]) => `<div><span class="sp-stat">${lab}</span><span class="sp-bar"><i style="width:${Math.round(evBar(sk[key]) * 100)}%;background:#111"></i></span></div>`).join("");
    return `<div class="dl-ev"><b>${c.name}</b> — <i>${c.flavor}</i><div class="sp-stats">${rows}</div>`
        + `<div class="dl-post">⚡ Full Schlep Driving ready (subscription). No haggling — the price is the price.<br>📱 ${ZEV.name}: “${pick(ZEV.posts)}”</div></div>`;
}
export function openTablet(focus) {
    if (cardOpen() || !ctx.foot || !ctx.foot.script) return false;
    syncInv(); E.armed = null;
    const tiles = EV_IDS.map(k => ({
        id: k, name: EV_CARS[k].name, dot: EV_CARS[k].body, price: EV_CARS[k].price,
        state: () => (owns("car", k) ? (inv.selectedSkin === k ? "placed" : "owned") : "look"),
        tag: () => (owns("car", k) ? (inv.selectedSkin === k ? "✓ Driving it" : "Yours — drive it") : E.armed === k ? "Tap again to buy" : `${fmt(EV_CARS[k].price)} 💰`),
        desc: () => "",
        act: () => buyHere(k),
    }));
    tiles.push({
        id: "schlep", name: "⚡ Full Schlep Driving", dot: "#111111",
        state: () => (schlep.active() ? "owned" : "look"),
        tag: () => (schlep.active() ? (E.armed === "cancel" ? "Tap again to cancel" : `${schlep.daysLeft()} days left`) : E.armed === "schlep" ? "Tap again to subscribe" : `${SUB.price} 💰 / ${SUB.days} days`),
        desc: () => "",
        act: () => subHere(),
    });
    openCard({ title: "⚡ Tushla Motors", head: id => headHtml(id), tiles, focus: focus || EV_IDS.find(k => !owns("car", k)) || "schlep" });
    return ctx.foot.script({ update(dt, P) { return cardTick(P); } });
}
function buyHere(k) {
    const c = EV_CARS[k];
    if (owns("car", k)) { if (equipSkin(k)) { ctx.foot.repaintCar && ctx.foot.repaintCar(); cardSay("It's out front. It'll unlock when it senses you. Eventually."); repaint(); } return; }
    if (wallet.coins < c.price) { cardSay(`The tablet says: <b>insufficient funds</b>. It says it very calmly. (${fmt(c.price - wallet.coins)} 💰 short)`); return; }
    if (E.armed !== k) { E.armed = k; cardSay(`Tap again to buy the ${c.name} for ${fmt(c.price)} 💰.`); repaint(); return; }
    E.armed = null;
    const r = buyCar(k);
    if (!r.ok) { cardSay("The tablet froze. Then unfroze. Try again."); return; }
    ctx.foot.repaintCar && ctx.foot.repaintCar();
    cardSay(`✓ The ${c.name} is yours — it's out front. ${schlep.active() ? "Full Schlep Driving is on your account." : "Add ⚡ Full Schlep Driving any time."}`);
    emit("dealers:ev", { id: k, price: r.price });
    repaint();
}
function subHere() {
    if (schlep.active()) {
        const st = DS.sub;
        if (st.cancelled) { schlep.subscribe(); cardSay("⚡ Welcome back. It never left. (It's software.)"); repaint(); return; }
        if (E.armed !== "cancel") { E.armed = "cancel"; cardSay(`Tap again to cancel. It keeps working for the ${schlep.daysLeft()} days you paid for, then stops — no more charges.`); repaint(); return; }
        E.armed = null; schlep.cancel(); cardSay("Cancelled. 😢 Reb Zev Volt posted about it."); repaint(); return;
    }
    if (wallet.coins < SUB.price) { cardSay(`${SUB.price} 💰 for ${SUB.days} days — come back with the coins.`); return; }
    if (E.armed !== "schlep") { E.armed = "schlep"; cardSay(`Tap again to subscribe: ${SUB.price} 💰 now, ${SUB.days} real days, cancel any time.`); repaint(); return; }
    E.armed = null;
    const r = schlep.subscribe();
    cardSay(r.ok ? `⚡ Subscribed! ${SUB.days} days. In a Tushla on the highway: ❚❚ › ⚡ Let the car drive.` : "The tablet says no. Calmly.");
    repaint();
}

// ── the 📱 Map (ci/hud's ctx.pins) ──
let pinned = false;
hook("hud", () => {
    if (pinned || !ctx.pins || !ctx.pins.add) return;
    pinned = true;
    try { ctx.pins.add({ id: EV.addr, name: EV.full, icon: EV.emoji, cat: "shops", lap: LAP_M, sub: "electric cars · Full Schlep Driving" }); } catch (e) { /* the registry's rules */ }
});

export const evDebug = { E, EV_AT, nearSpot, padWorld, openTablet, buyHere, subHere };
