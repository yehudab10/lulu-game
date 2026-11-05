// Garage data: everything the 2D shop sells, with the SAME ids, names, prices
// and copy (src/01-engine-core.js SKINS, src/06-screens.js SHOP_ITEMS,
// src/06d-bling.js HORNS + DECOR), plus the inventory cache that mirrors the
// SHARED 2D save (ownedSkins, missiles, pepperSpray, shields, horn, decor…).
import { emit, on } from "../../core/ctx.js";
import { shared } from "../../core/save.js";
import { SKINS } from "../../car.js";

// ── cars (handling stats live in car.js SKINS; prices + showroom copy from 2D) ──
export const SKIN_SHOP = {
    pink:   { price: 0,    flavor: "The original — sweet, steady, and pretty in pink." },
    purple: { price: 150,  flavor: "Royalty rides easy: a smidge better at everything." },
    orange: { price: 300,  flavor: "Launches like a rocket, corners like a shopping cart." },
    blue:   { price: 450,  flavor: "The family wagon that stops on a dime." },
    green:  { price: 600,  flavor: "Hugs every corner like Bubbe at the front door." },
    red:    { price: 900,  flavor: "Zero to zoom before the light turns green.", stripe: "#FFFFFF" },
    gold:   { price: 1500, flavor: "Heavy, hushed, and unapologetically fancy.", stripe: "#FFFFFF" },
    ninja:  { price: 2500, flavor: "Silent, sleek, and good at absolutely everything.", stripe: "#E91E63" },
};
export const SKIN_KEYS = Object.keys(SKINS);
/** The 4 stats in display order (2D SKIN_STAT_ROWS). */
export const STAT_ROWS = [["TOP SPEED", "top"], ["ACCELERATION", "acc"], ["HANDLING", "grip"], ["BRAKES", "brake"]];
/** 2D statFill: map a 0.7..1.4 multiplier to a 0..1 bar. */
export const statFill = m => Math.max(0, Math.min(1, ((m || 1) - 0.7) / 0.7));
/** 2D skinClass: the one-word chip for a car. */
export function skinClass(sk) {
    const st = [["SPEED", sk.top || 1], ["ACCEL", sk.acc || 1], ["GRIP", sk.grip || 1], ["BRAKES", sk.brake || 1]];
    let best = st[0], mx = -9, mn = 9;
    for (const s of st) { if (s[1] > best[1]) best = s; mx = Math.max(mx, s[1]); mn = Math.min(mn, s[1]); }
    return mx - mn < 0.12 ? "ALL-ROUNDER" : best[0];
}

// ── items (2D Power-Ups + Special; the shield is new in the 3D shop) ──────
export const ITEMS = [
    { id: "missile",    icon: "🚀", title: "Missile",         price: 20,   give: 1, count: "missiles",    model: "Item_missile",
      desc: "Blast the car right ahead of you.", bought: "+1 Missile!" },
    { id: "megapack",   icon: "🎆", title: "Mega 5-Pack",     price: 80,   give: 5, count: "missiles",    model: "Item_megapack", badge: "BEST VALUE",
      desc: "Five missiles — save 20 coins!", bought: "+5 Missiles!" },
    { id: "pepper",     icon: "🌶️", title: "Pepper Spray",    price: 15,   give: 1, count: "pepperSpray", model: "Item_pepper",
      desc: "Zap an animal (or person!) off the road.", bought: "+1 Pepper Spray! 🌶️" },
    { id: "shield",     icon: "🛡️", title: "Bubble Shield",   price: 50,   give: 1, count: "shields",     model: "Item_shield",
      desc: "Pops instead of you: absorbs one crash.", bought: "+1 Shield! 🛡️" },
    { id: "distracted", icon: "📱", title: "Distracted Mode", price: 1000, give: 0, count: null,          model: "Item_phone",
      desc: "On her phone: reversed controls, 2× score.", note: "Solo runs only — disabled in friend rooms.", bought: "Distracted Mode UNLOCKED!" },
];

// ── Bling (src/06d-bling.js) ──────────────────────────────────────────────
export const HORNS = [
    { id: "beep",      icon: "📢", name: "Classic Beep",  price: 0 },
    { id: "duck",      icon: "🦆", name: "Rubber Duck",   price: 120 },
    { id: "clown",     icon: "🤡", name: "Clown Horn",    price: 180 },
    { id: "shofar",    icon: "📯", name: "Shofar",        price: 250 },
    { id: "cucaracha", icon: "🎺", name: "La Cucaracha",  price: 400 },
    { id: "train",     icon: "🚂", name: "Train Horn",    price: 600 },
];
// slot = the car anchor it bolts onto (car.attach); cam = where the showroom looks
export const DECOR = [
    { id: "dice",    icon: "🎲", name: "Fuzzy Dice",       price: 100, slot: "dash",  cam: "cabin", desc: "Hanging off a mirror, swinging with every corner." },
    { id: "bow",     icon: "🎀", name: "Giant Bow",        price: 150, slot: "deck",  cam: "rear",  desc: "Like she just drove it off the lot." },
    { id: "lashes",  icon: "👁️", name: "Headlight Lashes", short: "Car Lashes", price: 200, slot: "front", cam: "front", desc: "Batting her headlights at the traffic." },
    { id: "surf",    icon: "🏄", name: "Surfboard",        price: 300, slot: "deck",  cam: "rear",  desc: "Beach-bound! Strapped to a roof rack." },
    { id: "crown",   icon: "👑", name: "Crown",            price: 450, slot: "head",  cam: "head",  desc: "Queen of the highway. Obviously." },
    { id: "unicorn", icon: "🦄", name: "Unicorn Horn",     price: 650, slot: "hood",  cam: "front", desc: "Magical, pearly, and pointy." },
    { id: "flames",  icon: "🔥", name: "Flame Decals",     price: 900, slot: "hood",  cam: "side",  desc: "A hot-rod flame job down the hood and sides." },
];
export const hornDef = id => HORNS.find(h => h.id === id) || null;
export const decorDef = id => DECOR.find(d => d.id === id) || null;

// ── inventory cache (mirrors the shared 2D save; never read localStorage per frame) ──
export const inv = {
    coins: 0, ownedSkins: ["pink"], selectedSkin: "pink",
    missiles: 0, pepperSpray: 0, shields: 0, distractedUnlocked: false,
    horn: "beep", ownedHorns: ["beep"], decor: "none", ownedDecor: [],
};
export function syncInv(s = shared.get()) {
    inv.coins = Math.max(0, s.totalCoins || 0);
    inv.ownedSkins = Array.isArray(s.ownedSkins) && s.ownedSkins.length ? s.ownedSkins.filter(k => SKINS[k]) : ["pink"];
    if (!inv.ownedSkins.includes("pink")) inv.ownedSkins.unshift("pink");
    inv.selectedSkin = SKINS[s.selectedSkin] ? s.selectedSkin : "pink";
    inv.missiles = Math.max(0, s.missiles | 0);
    inv.pepperSpray = Math.max(0, s.pepperSpray | 0);
    inv.shields = Math.max(0, s.shields | 0);
    inv.distractedUnlocked = !!s.distractedUnlocked;
    inv.horn = hornDef(s.horn) ? s.horn : "beep";
    inv.ownedHorns = Array.isArray(s.ownedHorns) ? s.ownedHorns.slice() : ["beep"];
    if (!inv.ownedHorns.includes("beep")) inv.ownedHorns.unshift("beep");
    inv.decor = decorDef(s.decor) ? s.decor : "none";
    inv.ownedDecor = Array.isArray(s.ownedDecor) ? s.ownedDecor.slice() : [];
    return inv;
}
let lastDecor = null, lastHorn = null;
on("shared:changed", s => {
    syncInv(s);
    if (inv.decor !== lastDecor) { lastDecor = inv.decor; emit("garage:decor", { id: inv.decor }); }
    if (inv.horn !== lastHorn) { lastHorn = inv.horn; emit("garage:horn", { id: inv.horn }); }
});
syncInv();
lastDecor = inv.decor; lastHorn = inv.horn;

/** Read-modify-write the shared save (keeps a 2D tab's other fields) and refresh the cache. */
export function writeShared(fn) { return shared.update(fn); }
