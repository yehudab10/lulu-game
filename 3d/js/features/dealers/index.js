// ─────────────────────────────────────────────────────────────────────────
//  features/dealers — 🏎️ THE LUXURY CAR DEALERSHIP (+ stage 2: the EV dealership across the highway).
//  The owner (2026-11-27): "a car dealership for real good luxury cars somewhere near the highway… better cars than what
//  uncle Refael sells… a sales man and with real negotiating and upselling packages. And real luxuries for certain cars."
//
//   MAZELATI OF MONSEY ("hand-built in Monsey, Italy") — a pull-off on the right at lap metre LAP_M (data.js), once a lap,
//   address "hw:mazelati": a glass showroom (models.js, code-built), four cars on white pedestals out front (real car
//   clones with the marque's body kit, spawned only when she's near), SAL MAZEL at the door.
//     ✋ at a car → the card (every model: stats on a longer scale than Refael's, the perks, the sticker) → "🤝 Talk to Sal"
//     → the HAGGLE (haggle.js) → the F&I office (real options that work — perks.js — and nonsense that doesn't) → the car
//     is hers: her car out front takes the new paint + kit (no teleport; ci/cars will decide where the old one waits).
//   The cars are new car ids (car.js SKINS + garage/data.js SKIN_SHOP, registered at import, before the car is made):
//   real stat steps over Refael's (0.9–1.30) and a bigger nitro tank — a long-term coin SINK (6,000–38,000).
//   Every purchase goes through garage/buy.js (buyCar with the haggled price; buyExtra for options / packages).
//
//  ctx.dealers = { open(id), haggle(id), perks(id), has(k), debug }
//  Events: dealers:haggle {id, phase: start|deal|walked|poor, price, sticker} · dealers:option {id, opt, price} ·
//          dealers:nonsense {id, price} · dealers:perk {k}
//  Stats: dealersNonsense. 3D save: "dealers" (perks.js DS).
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on, hook, emit, css } from "../../core/ctx.js";
import { SKINS, KITS } from "../../car.js";
import { LAP, lapS } from "../../world.js";
import { paved } from "../../core/driving.js";
import { models, ensureModels, cloneWithColors, findNodes } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { say } from "../../core/dialog.js";
import * as H from "../../hud.js";
import { SKIN_SHOP, SKIN_KEYS, STAT_ROWS, inv, syncInv } from "../garage/data.js";
import { owns, equipSkin } from "../garage/buy.js";
import { addPlace, local, sayAt } from "../world/places.js";
import { openCard, cardTick, cardOpen, closeCard, cardSay } from "../shops/card.js";
import { LUX, LUX_CARS, LUX_IDS, LAP_M, SAL, OPTIONS, BUILT_IN } from "./data.js";
import { SHOW } from "./models.js";
import { haggle, remembered } from "./haggle.js";
import { DS, perksOf, hasPerk, perksDebug } from "./perks.js";
import { openTablet, evDebug } from "./ev.js";
import { schlep } from "./schlep.js";

// ── the cars join the game's car list (before the car is made: app.js imports features first) ──
for (const [id, c] of Object.entries(LUX_CARS)) {
    SKINS[id] = { name: c.name, body: c.body, light: c.light, dark: c.dark, top: c.top, acc: c.acc, grip: c.grip, brake: c.brake,
        nitro: c.nitro, perks: c.perks, kit: "mazelati", marque: "mazelati" };
    SKIN_SHOP[id] = { price: c.price, flavor: c.flavor, stripe: c.stripe, where: "Mazelati of Monsey, off the highway (half a mile past the lap line)" };
    if (!SKIN_KEYS.includes(id)) SKIN_KEYS.push(id);
}

const fmt = n => Math.round(n).toLocaleString("en-US");
const pick = a => a[Math.floor(Math.random() * a.length)];
const LUX_AT = [];
for (let n = 0; n * LAP < 400000; n++) LUX_AT.push(n * LAP + LAP_M);
const D = { spots: [], cars: [], sal: null, saidHi: false, busy: false };
const dead = new WeakSet();
on("chunk:dispose", ({ chunk }) => { dead.add(chunk); D.spots = D.spots.filter(s => s.chunk !== chunk); });
const live = sp => sp && sp.obj && sp.chunk && !dead.has(sp.chunk);

// ── the pull-off: asphalt for the car, trees kept off, a sign before it ──
paved.push((s, d) => (d > 8.8 && d < 46 && Math.abs(lapS(s) - LAP_M) < 20 ? 2 : 0));
on("boot", () => { const w = ctx.world; if (w && w.reserve) for (const s of LUX_AT) w.reserve(s - 34, s + 34, 1, 7.5, 50); });
function walls(spot) {
    const out = [], c = (x, z, r) => { const p = local(spot, x, z, {}); out.push({ x: p.x, z: p.z, r }); };
    const W = SHOW.w, zf = SHOW.z0, zb = zf - SHOW.d;
    for (let x = -W / 2 + 0.9; x <= W / 2 - 0.9 + 1e-6; x += 1.4) { if (Math.abs(x) > 1.6) c(x, zf - 0.9, 1.0); c(x, zb + 0.9, 1.0); }
    for (let z = zb + 0.9; z <= zf - 0.9 + 1e-6; z += 1.4) { c(-W / 2 + 0.9, z, 1.0); c(W / 2 - 0.9, z, 1.0); }
    return out;
}
addPlace({
    id: "mazelati", kind: "dealer", name: LUX.full, icon: LUX.emoji, verb: "stop at Mazelati",
    where: mode => (mode === "cruise" || mode === "party" ? LUX_AT : []),
    model: "dealers_mazelati", d: LUX.d, side: 1, bay: { half: 18, d0: 9, d1: 28 }, dur: 2.4,
    sign: { d: 10.4, bg: LUX.sign.bg, w: 5.0, h: 2.8, tw: 512, th: 300, lines: LUX.sign.lines },
    colliders: spot => walls(spot),
    built: spot => { D.spots = D.spots.filter(s => live(s) && s.key !== spot.key); D.spots.push(spot); },
    host: spot => { const p = local(spot, SHOW.sal.x, SHOW.sal.z, {}); return { x: p.x, y: 1.8, z: p.z }; },
    beats: [{ t: 0.3, run: spot => { if (D.sal) sayAt(pick(SAL.hello), D.sal.obj, { who: SAL.name }); } }],
});

// ── her nearest live showroom (its chunk still standing) ──
function nearSpot(max = 120) {
    const me = (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
    if (!me) return null;
    let best = null, bd = max;
    for (const sp of D.spots) {
        if (!live(sp)) continue;
        const d = Math.hypot(sp.x - me.x, sp.z - me.z);
        if (d < bd) { bd = d; best = sp; }
    }
    return best;
}
function padWorld(sp, k) { const p = SHOW.pads[k]; const w = local(sp, p.x, p.z, {}); return { x: w.x, z: w.z }; }

// ── the cars on show + Sal: spawned near her, dropped far away (nothing loaded on the open road) ──
function anchorsOf(obj) { const a = {}; obj.traverse(o => { if (o.name && o.name.startsWith("Anchor_")) a[o.name.slice(7).replace(/\d+$/, "")] = o; }); return a; }
function showCar(id) {
    const sk = SKINS[id];
    const o = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
    for (const n of findNodes(o, "Driver")) n.visible = false;
    for (const n of findNodes(o, "Hair_")) n.visible = false;
    if (sk.kit && KITS[sk.kit]) KITS[sk.kit](o, anchorsOf(o), sk);
    return o;
}
function dropShow() {
    for (const c of D.cars) c.obj.removeFromParent();
    D.cars = [];
    if (D.sal) { D.sal.obj.removeFromParent(); D.sal = null; }
    D.at = null;
}
hook("hud", dt => {
    const sp = nearSpot(150);
    if (!sp || !models.lulu) { if (D.at) dropShow(); return; }
    if (D.at !== sp) {
        dropShow();
        D.at = sp;
        LUX_IDS.forEach((id, k) => {
            const p = padWorld(sp, k), obj = showCar(id);
            obj.position.set(p.x, 0.2, p.z);
            obj.rotation.y = sp.rot + (k < 2 ? 0.55 : -0.55);
            ctx.scene.add(obj);
            D.cars.push({ id, obj, k });
        });
        if (models.npcMan) {
            D.sal = spawnPerson("npcMan", { colors: SAL.colors });
            D.sal.obj.name = "SalMazel";
            const p = local(sp, SHOW.sal.x, SHOW.sal.z, {});
            D.sal.obj.position.set(p.x, 0, p.z); D.sal.obj.rotation.y = sp.rot;
            ctx.scene.add(D.sal.obj);
        }
    }
    for (const c of D.cars) c.obj.rotation.y += dt * 0.12 * (c.k % 2 ? 1 : -1);     // (turntables)
    if (D.sal) {
        const me = (ctx.foot && ctx.foot.active && ctx.foot.pos) || ctx.car.pos;
        D.sal.face(me.x, me.z, dt, 3);
        D.sal.update(dt, { talk: D.busy, wave: !D.busy && Math.sin(ctx.time * 0.9) > 0.95 });
    }
});
on("run:start", () => { dropShow(); D.spots = []; });
on("boot", () => { ensureModels(["npcMan"]).catch(() => {}); });

// ── on foot: ✋ at a car on show, ✋ at Sal ──
const onFootHere = () => ctx.state === "footRun" && ctx.foot && ctx.foot.pos && !D.busy && !cardOpen() && !(ctx.party && ctx.party.active && !(ctx.group && ctx.group.roaming));
function carSpot(k) {
    return {
        r: 2.6, short: "CAR",
        pos() { if (!onFootHere() || !D.at) return null; const sp = D.at, p = SHOW.pads[k], w = local(sp, p.x, p.z + 3.2, {}); return { x: w.x, z: w.z }; },
        label: () => { const id = LUX_IDS[k], c = LUX_CARS[id]; return owns("car", id) ? `🏎️ ${c.name.toUpperCase()} — YOURS` : `🏎️ ${c.name.toUpperCase()} — ${fmt(c.price)} 💰`; },
        act: () => openShowroom(LUX_IDS[k]),
    };
}
const salSpot = {
    r: 2.4, short: "SAL",
    pos() { if (!onFootHere() || !D.sal) return null; const p = D.sal.obj.position; return { x: p.x, z: p.z }; },
    label: () => "🤵 SAL MAZEL — TALK",
    act: async () => {
        D.busy = true;
        try {
            const r = remembered();
            await say(SAL.name, r || pick(SAL.hello), { emoji: SAL.emoji, color: SAL.color });
        } finally { D.busy = false; }
        openShowroom(LUX_IDS.find(id => !owns("car", id)) || LUX_IDS[0]);
    },
};
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) { LUX_IDS.forEach((_, k) => ctx.foot.addSpot(carSpot(k))); ctx.foot.addSpot(salSpot); } });

// ── the card: every model, its stats on the luxury scale, the perks, the sticker ──
css("dealers", `
.dl-perks { margin: 6px 0 0; font-size: 13px; line-height: 1.35; }
.dl-perks b { color: #C9A227; }
.dl-ref { font-size: 12px; opacity: .75; margin-top: 4px; }
`);
const lux = m => Math.max(0, Math.min(1, ((m || 1) - 0.7) / 0.9));      // (0.7 → 1.6: Refael's best is ~half way)
function headHtml(id) {
    const sk = SKINS[id], c = LUX_CARS[id];
    const rows = STAT_ROWS.map(([lab, key]) => `<div><span class="sp-stat">${lab}</span><span class="sp-bar"><i style="width:${Math.round(lux(sk[key]) * 100)}%;background:linear-gradient(90deg, ${sk.dark}, ${c.stripe || sk.body})"></i></span></div>`).join("");
    const p = perksOf(id), perks = [...p].map(k => OPTIONS[k] ? OPTIONS[k].name : BUILT_IN[k] || k);
    const tank = sk.nitro > 1 ? `🔋 Nitro tank +${Math.round((sk.nitro - 1) * 100)} %` : "";
    return `<b>${c.name}</b> — <i>${c.flavor}</i><div class="sp-stats">${rows}</div>`
        + `<div class="dl-perks">${[tank, ...perks].filter(Boolean).map(t => `<b>·</b> ${t}`).join("<br>") || "<i>Options in the F&amp;I office.</i>"}</div>`
        + `<div class="dl-ref">(Uncle Refael's best, the Black Ninja, sits about halfway up each bar.)</div>`;
}
export function openShowroom(id) {
    if (cardOpen() || !ctx.foot || !ctx.foot.script) return false;
    syncInv();
    const tiles = LUX_IDS.map(k => ({
        id: k, name: LUX_CARS[k].name, dot: LUX_CARS[k].body, price: LUX_CARS[k].price,
        state: () => (owns("car", k) ? (inv.selectedSkin === k ? "placed" : "owned") : "look"),
        tag: () => (owns("car", k) ? (inv.selectedSkin === k ? "✓ Driving it" : "Yours") : `${fmt(LUX_CARS[k].price)} 💰 · 🤝 talk to Sal`),
        desc: () => "",
        act: () => {
            if (owns("car", k)) { if (equipSkin(k)) { ctx.foot.repaintCar && ctx.foot.repaintCar(); cardSay(`Out front, ready. Drive it away whenever you like.`); } return; }
            closeCard(true);
            setTimeout(() => talk(k), 60);
        },
    }));
    openCard({ title: "🏎️ Mazelati of Monsey", head: id => headHtml(id), tiles, focus: id });
    return ctx.foot.script({ update(dt, P) { return cardTick(P); } });
}
async function talk(id) {
    if (D.busy) return;
    D.busy = true;
    try {
        const r = await haggle(id);
        if (r.ok) {
            // she drives it away from right here: the car she parked out front takes the new paint + kit
            if (ctx.foot && ctx.foot.repaintCar) ctx.foot.repaintCar();
            H.toast(`🏎️ The ${LUX_CARS[id].name} is yours! ${fmt(r.price)} 💰${r.price < LUX_CARS[id].price ? ` (saved ${fmt(LUX_CARS[id].price - r.price)})` : ""}`, "gold", { prio: 3, key: "dealersBuy" });
        }
    } finally { D.busy = false; }
}

// ── the 📱 Map (ci/hud's ctx.pins, when it's on main) ──
let pinned = false;
hook("hud", () => {
    if (pinned || !ctx.pins || !ctx.pins.add) return;
    pinned = true;
    try { ctx.pins.add({ id: LUX.addr, name: LUX.full, icon: LUX.emoji, cat: "shops", lap: LAP_M, sub: "luxury cars · 6,000–38,000 💰" }); } catch (e) { /* the registry's own rules */ }
});

ctx.dealers = {
    open: openShowroom, haggle, perks: perksOf, has: hasPerk,
    /** ⚡ Tushla's tablet (stage 2) + Full Schlep Driving (the subscription + the self-driving). */
    tablet: openTablet, schlep,
    debug: { D, DS, LUX_AT, nearSpot, padWorld, talk, perks: perksDebug, ev: evDebug },
};
