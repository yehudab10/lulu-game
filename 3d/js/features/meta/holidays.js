// features/meta — JEWISH HOLIDAYS, read live from the device's Hebrew calendar
// (Intl), exactly like src/06e-holidays.js — no date table to keep updating.
// During a holiday:
//   · a greeting pill on the title card + a once-a-day gift (shared holidayGiftKey,
//     so 2D and 3D don't both pay out the same day),
//   · a real 3D decoration on Lulu's car (Blender, assets_meta.py):
//       Rosh Hashana 🍎 apple & honey on the dash · Sukkot 🌿 lulav & etrog on the seat ·
//       Chanukah 🕎 a car-top menorah with TONIGHT's candles lit (+ the shamash) ·
//       Purim 🎭 a party hat on Lulu + a giant grogger; the stock horn becomes a GROGGER ·
//       Pesach 🫓 a box of matzah and Elijah's cup on the passenger seat.
// Tests / previews: ?holiday=chanukah&holidayDay=3 (or ?metaDate=2026-12-07 for the real path).
import * as THREE from "three";
import { ctx, on, hook, emit, addMenuItem } from "../../core/ctx.js";
import { shared, wallet } from "../../core/save.js";
import { registerModels, ensureModels, models, findNodes } from "../../models.js";
import { input } from "../../input.js";
import { Q, now, chime, grogger, metaToast } from "./util.js";
import { questAdd } from "./progress.js";

export const HOLIDAYS = [
    { id: "roshHashana", month: ["Tishri"], day: 1, days: 2, emoji: "🍎", greeting: "Shana Tova!", gift: 18, from: "Bubbe's honey-cake money",
      model: "metaHoney", slots: ["deck", "dash"], scale: { deck: 2.1, dash: 1.2 } },
    { id: "sukkot", month: ["Tishri"], day: 15, days: 9, emoji: "🌿", greeting: "Chag Sameach!", gift: 18, from: "Gelt from the sukkah",
      model: "metaLulav", slots: ["passenger", "deck"], scale: { passenger: 1.25, deck: 1.1 } },
    { id: "chanukah", month: ["Kislev"], day: 25, days: 8, emoji: "🕎", greeting: "Happy Chanukah!", gift: 18, from: "Chanukah gelt from Bubbe",
      model: "metaMenorah", slots: ["deck", "hood"], scale: { deck: 1.3, hood: 1.15 } },
    { id: "purim", month: ["Adar", "Adar II"], day: 14, days: 2, emoji: "🎭", greeting: "Freilichen Purim!", gift: 36, from: "Mishloach manot from Avigail",
      model: "metaPurimHat", slots: ["head", "deck"], scale: { head: 1, deck: 1.6 },
      extra: { model: "metaGrogger", slots: ["passenger", "dash"], scale: { passenger: 1.5, dash: 0.8 } } },
    { id: "pesach", month: ["Nisan"], day: 15, days: 8, emoji: "🫓", greeting: "Chag Pesach Sameach!", gift: 36, from: "You found the afikoman",
      model: "metaMatzah", slots: ["passenger", "dash"], scale: { passenger: 1.4, dash: 0.9 } },
];
registerModels({
    metaMenorah: "meta_menorah", metaPurimHat: "meta_purim_hat", metaGrogger: "meta_grogger",
    metaHoney: "meta_honey", metaLulav: "meta_lulav", metaMatzah: "meta_matzah",
});

// ── which holiday is it? ───────────────────────────────────────────────────
let hebFmt = null;
function hebrewMD(d) {
    try {
        if (!hebFmt) hebFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", { month: "long", day: "numeric" });
        let m = null, day = null;
        for (const p of hebFmt.formatToParts(d)) {
            if (p.type === "month") m = p.value;
            if (p.type === "day") day = parseInt(p.value, 10);
        }
        return m && day ? { m, d: day } : null;
    } catch (e) { return null; }
}
const FORCED = Q.get("holiday");
const FORCED_DAY = Math.max(1, parseInt(Q.get("holidayDay") || "1", 10) || 1);
let cache = null, cacheKey = "";
/** The holiday running today (local date) → { h, dayNum (1-based), key } or null. */
export function currentHoliday() {
    const d = new Date(now());
    const key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    if (FORCED) {
        const h = HOLIDAYS.find(x => x.id === FORCED);
        return h ? { h, dayNum: Math.min(FORCED_DAY, h.days), key: h.id + ":" + key } : null;
    }
    if (!ctx.enabled("meta")) return null;   // dated surprises stay off in scripted tests
    if (key === cacheKey) return cache;
    cacheKey = key; cache = null;
    // walk back up to 8 days looking for a holiday's first day
    for (let back = 0; back < 9 && !cache; back++) {
        const md = hebrewMD(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back, 12));
        if (!md) return null;   // no Hebrew calendar on this device
        for (const h of HOLIDAYS) {
            if (h.day === md.d && h.month.includes(md.m) && back < h.days) { cache = { h, dayNum: back + 1, key: h.id + ":" + key }; break; }
        }
    }
    return cache;
}
export const holidayIs = id => { const c = currentHoliday(); return !!(c && c.h.id === id); };

// ── title greeting + the once-a-day gift ─────────────────────────────────
addMenuItem("titleInfo", {
    id: "metaHoliday", order: 5,
    visible: () => !!currentHoliday(),
    label: () => {
        const c = currentHoliday();
        return `<div class="meta-holiday">${c.h.emoji} ${c.h.greeting}${c.h.id === "chanukah" ? ` · Night ${c.dayNum}` : ""}</div>`;
    },
});
export function holidayGiftTick() {
    const c = currentHoliday();
    if (!c) return false;
    if (shared.get().holidayGiftKey === c.key) return false;
    let paid = false;
    shared.update(s => { if (s.holidayGiftKey !== c.key) { s.holidayGiftKey = c.key; paid = true; } });
    if (!paid) return false;
    wallet.add(c.h.gift);
    questAdd("holidayGifts", 1);
    metaToast(`${c.h.emoji} ${c.h.from}! +${c.h.gift} 💰`, "", 3.2);
    chime([659, 784, 1046], 0.11, 0.2);
    emit("holiday:gift", { id: c.h.id, gift: c.h.gift });
    return true;
}

// ── the car decorations ──────────────────────────────────────────────────
// Added straight under the car's anchor (not car.attach, which would replace
// whatever another feature put there): each item takes the first of its slots
// that nobody has car.attach()ed into, and re-homes itself after skin changes.
const decor = [];   // { obj, slots, kind, flames?, glows?, spin? }
let decorFor = "";
let glowTex = null;
function glowTexture() {
    if (glowTex) return glowTex;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,236,150,1)"); gr.addColorStop(0.35, "rgba(255,190,60,.55)"); gr.addColorStop(1, "rgba(255,150,0,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
    glowTex.colorSpace = THREE.SRGBColorSpace;
    return glowTex;
}
function clearDecor() {
    for (const d of decor) {
        if (d.obj.parent) d.obj.parent.remove(d.obj);
        for (const s of d.glows || []) s.material.dispose();
    }
    decor.length = 0;
}
function makeItem(key, slots, kind, c, scale) {
    const obj = models[key].clone(true);
    obj.name = "MetaHoliday_" + kind;
    const d = { obj, slots, kind, scale: scale || null };
    if (kind === "menorah") {
        const lit = Math.min(8, c.dayNum);
        d.flames = [];
        d.glows = [];
        const flames = [...findNodes(obj, "Flame_")];
        for (const f of flames) {
            const n = f.name.startsWith("Flame_S") ? 0 : parseInt(f.name.slice(6), 10);
            f.visible = n === 0 || n <= lit;
            if (!f.visible) continue;
            const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
            glow.scale.setScalar(0.16);
            glow.position.y = 0.045;
            f.add(glow);
            d.glows.push(glow);
            d.flames.push({ f, ph: n * 1.7 + 0.3, base: f.scale.clone() });
        }
        d.lit = lit;
        obj.position.y = 0.05;         // clear of the rear-deck humps
    } else if (kind === "hat") {
        obj.rotation.set(-0.12, 0, 0.22);
    } else if (kind === "grogger") {
        d.spin = findNodes(obj, "Grogger_Spin")[0] || null;
        d.spinV = 0;
        obj.rotation.set(0, 0.6, -0.12);   // a giant novelty grogger (see the slot scales)
    } else if (kind === "lulav") {
        obj.rotation.y = 0.25;
    }
    decor.push(d);
    return d;
}
async function applyDecor() {
    const c = currentHoliday();
    const want = c ? c.key + ":" + c.dayNum : "";
    if (want === decorFor) return;
    decorFor = want;
    clearDecor();
    if (!c || !ctx.car) return;
    const keys = [c.h.model].concat(c.h.extra ? [c.h.extra.model] : []);
    try { await ensureModels(keys); } catch (e) { console.error("[meta] holiday models", e); return; }
    if (decorFor !== want) return;
    const kind = { metaMenorah: "menorah", metaPurimHat: "hat", metaHoney: "honey", metaLulav: "lulav", metaMatzah: "matzah" }[c.h.model];
    makeItem(c.h.model, c.h.slots, kind, c, c.h.scale);
    if (c.h.extra) makeItem(c.h.extra.model, c.h.extra.slots, "grogger", c, c.h.extra.scale);
    placeDecor();
}
function placeDecor() {
    const car = ctx.car;
    if (!car || !car.anchors) return;
    const taken = new Set();
    for (const d of decor) {
        const slot = d.slots.find(s => car.anchors[s] && !(car.attached && car.attached[s]) && !taken.has(s));
        const a = slot ? car.anchors[slot] : null;
        if (slot) taken.add(slot);
        if (a && d.obj.parent !== a) a.add(d.obj);
        else if (!a && d.obj.parent) d.obj.parent.remove(d.obj);
        if (slot !== d.slot && d.scale) d.obj.scale.setScalar(d.scale[slot] || 1);   // bigger where it must read from the chase cam
        d.slot = slot || null;
        // the hat (and anything else on Lulu's head) leaves with her when she's on foot
        if (slot === "head") d.obj.visible = !car.driver || car.driver.visible;
        else d.obj.visible = true;
    }
}
let lastFrame = -1;
function tick(dt) {
    if (ctx.frames === lastFrame) return;
    lastFrame = ctx.frames;
    if (!decor.length) return;
    placeDecor();
    const t = ctx.time;
    for (const d of decor) {
        if (d.flames) for (const fl of d.flames) {
            const k = 1 + Math.sin(t * 13 + fl.ph) * 0.16 + Math.sin(t * 29 + fl.ph * 2) * 0.06;
            fl.f.scale.set(fl.base.x * (2 - k) * 0.95, fl.base.y * k, fl.base.z * (2 - k) * 0.95);
            fl.f.rotation.z = Math.sin(t * 7 + fl.ph) * 0.12;
        }
        if (d.spin) {
            d.spinV = Math.max(0, d.spinV - dt * 18);
            d.spin.rotation.y += d.spinV * dt;
        }
    }
}
hook("hud", dt => tick(dt));
hook("titleCamera", dt => { tick(dt); return false; }, 1000);

// 🎭 Purim: the stock horn ("beep") is a grogger. Runs after the garage (priority -10)
// so a custom Bling horn still plays its own sound.
hook("runStart", G => {
    if (holidayIs("purim") && ((shared.get().horn || "beep") === "beep") && !G.customHorn) { G.customHorn = true; G.metaGrogger = true; }
}, -10);
let groggerT = 0;
function spinGrogger() { for (const d of decor) if (d.spin) d.spinV = 34; }
on("honk", () => {
    if (!ctx.G.metaGrogger) return;
    grogger(); spinGrogger();
    groggerT = 0.42;
});
hook("update", (dt, P, controlsOn) => {
    if (!ctx.G.metaGrogger || !controlsOn) return;
    // lean on the horn → keep ratcheting
    if (input.honkHeld) { groggerT -= dt; if (groggerT <= 0) { grogger(); spinGrogger(); groggerT = 0.42; } }
});

on("boot", () => { applyDecor(); });
on("title", () => { applyDecor(); });
on("run:start", () => { applyDecor(); });

/** For other features (e.g. on-foot Lulu): a fresh clone of today's hat, or null. */
export async function holidayHat() {
    if (!holidayIs("purim")) return null;
    await ensureModels(["metaPurimHat"]);
    return models.metaPurimHat.clone(true);
}
export { decor as holidayDecor };
