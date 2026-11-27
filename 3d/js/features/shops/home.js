// features/shops/home.js — 🔑 HER GARAGE AT HOME: the cars she owns wait at home, and choosing which one to drive
// happens in her driveway, not in a menu. On foot by the garage door (a run starts at home: the car's in the
// driveway, nose out): ✋ 🔑 MY CARS → a card with every car — hers to pick (free: the car in the driveway is repainted
// on the spot, the shared save's selectedSkin follows, like the title's old 🚗 Car switch), the ones she doesn't own
// shown dimmed with where to get them (Uncle Refael's lot). Never sells anything here.
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { SKINS } from "../../car.js";
import { home } from "../world/home.js";
import { SKIN_SHOP, inv, syncInv } from "../garage/data.js";
import { equipSkin, owns } from "../garage/buy.js";
import { openCard, cardTick, cardOpen, closeCard, cardSay } from "./card.js";
import { GARAGE_LINES } from "./data.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const ORDER = ["pink", "purple", "orange", "blue", "green", "red", "gold", "ninja"];

/** The ✋ spot: beside the rear corner of the parked car, at the garage door (world coords) — null when not home. */
/** features/cars: where a car she owns is, when it ISN'T at home ("Parked in Lakewood") — or "". */
function away(k) {
    const C = ctx.cars;
    if (!C || C.atHome(k)) return "";
    const w = C.list().find(c => c.key === k);
    return w ? w.where.charAt(0).toUpperCase() + w.where.slice(1) : "";
}
function garageAt() {
    if (!home.ready || !home.park || !home.group || !home.group.visible) return null;
    const P = home.park, fx = Math.sin(P.h), fz = Math.cos(P.h), lx = Math.cos(P.h), lz = -Math.sin(P.h);
    return { x: P.x - fx * 3.2 - lx * 1.7, z: P.z - fz * 3.2 - lz * 1.7, P };
}
function nearHome() {
    if (ctx.state !== "footRun" || !ctx.foot || !ctx.foot.pos || ctx.foot.chasing) return false;
    if (ctx.party && ctx.party.active) return false;
    if (ctx.cars && ctx.enabled("cars")) return false;        // (features/cars: her cars stand in the driveway + along the kerb — she walks up to one)
    const g = garageAt();
    if (!g) return false;
    const p = ctx.foot.pos;
    // (only while her own car is the one standing in the driveway)
    const P = g.P;
    if (ctx.foot.ownCar !== "parked" && ctx.foot.ownCar !== "ok") return false;
    const pc = ctx.foot.parkedCar;
    if (!pc || !pc.drivable || Math.hypot(pc.x - P.x, pc.z - P.z) > 3) return false;
    return (p.x - g.x) ** 2 + (p.z - g.z) ** 2 < 25 * 25;
}
const spot = {
    r: 2.4, short: "MY CARS",          // (ci/doors: was 1.7 — the whole garage side of the driveway)
    pos() { if (!nearHome()) return null; const g = garageAt(); return { x: g.x, z: g.z }; },
    label: () => { syncInv(); const n = inv.ownedSkins.length; return n > 1 ? `🔑 MY CARS (${n})` : "🔑 MY CARS"; },
    act: () => openGarage(),
};

const G = { cam: null };
export function openGarage() {
    if (!nearHome() || !ctx.foot.script || cardOpen()) return false;
    syncInv();
    const g = garageAt(), P = g.P;
    const fx = Math.sin(P.h), fz = Math.cos(P.h), lx = Math.cos(P.h), lz = -Math.sin(P.h);
    const cam = ctx.camera;
    G.cam = { pos: cam.position.clone(), look: new THREE.Vector3() };
    cam.getWorldDirection(G.cam.look).multiplyScalar(6).add(cam.position);
    const ok = ctx.foot.script({
        update(dt, Pi, F) {
            if (F.lulu) { F.lulu.face(P.x, P.z, dt, 6); F.lulu.update(dt, { walk: 0 }); }
            return cardTick(Pi);
        },
        camera(dt) {
            const portrait = cam.aspect < 1, back = portrait ? 8.6 : 6.6;
            const tgt = new THREE.Vector3(P.x + fx * back + lx * 2.4, portrait ? 3.8 : 3.0, P.z + fz * back + lz * 2.4);
            const aim = new THREE.Vector3(P.x, portrait ? -1.3 : -0.9, P.z);
            const k = 1 - Math.exp(-dt * 3.5);
            G.cam.pos.lerp(tgt, k); G.cam.look.lerp(aim, k);
            cam.position.copy(G.cam.pos); cam.lookAt(G.cam.look);
            const fov = portrait ? 66 : 52;
            cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
            if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
            return true;
        },
        abort() { if (cardOpen()) closeCard(true); },
    });
    if (!ok) return false;
    const n = inv.ownedSkins.length;
    openCard({
        title: "🔑 My cars",
        head: () => n > 1 ? `Which one today? <small>(${n} in the garage)</small>` : GARAGE_LINES.one,
        tiles: ORDER.concat(Object.keys(SKIN_SHOP).filter(k => !ORDER.includes(k) && SKINS[k] && owns("car", k))).map(k => ({
            id: k, name: SKINS[k].name, dot: SKINS[k].body,
            state: () => (owns("car", k) ? (ctx.car.skinKey === k ? "placed" : "owned") : "na"),
            tag: () => (owns("car", k) ? (ctx.car.skinKey === k ? "✓ In the driveway" : away(k) ? `📍 ${away(k)}` : "Yours") : `🚗 ${SKIN_SHOP[k].price.toLocaleString("en-US")} 💰`),
            desc: () => (owns("car", k) ? `<i>${SKIN_SHOP[k].flavor}</i>` : SKIN_SHOP[k].where ? `At <b>${SKIN_SHOP[k].where}</b>.` : `At <b>Uncle Refael's Pre-Loved Cars</b> — Lakewood (Route 9) or Midwood (Coney Island Ave).`),
            act: () => {
                if (!owns("car", k)) { cardSay(`Not yours (yet!) — <b>Uncle Refael's</b> lot has it: ${SKIN_SHOP[k].price.toLocaleString("en-US")} 💰.`); return; }
                if (ctx.car.skinKey === k) return;
                if (away(k)) { cardSay(`Your <b>${SKINS[k].name}</b> isn't here — it's ${away(k).toLowerCase()}. Go get it! <small>(📱 🗺️ Map)</small>`); return; }
                equipSkin(k);
                if (ctx.foot.repaintCar) ctx.foot.repaintCar();
                if (ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(GARAGE_LINES.swap), 2.2);
                burst(P);
            },
        })),
        focus: ctx.car.skinKey,
    });
    return true;
}
function burst(P) {
    const fx = ctx.car && ctx.car.fx;
    if (!fx) return;
    const cols = [[1, 0.31, 0.6], [1, 0.84, 0.31], [0.5, 0.87, 0.92], [1, 1, 1]];
    for (let i = 0; i < 26; i++) fx.emit(P.x + (Math.random() - 0.5) * 2, 1.2, P.z + (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4, 0.3, 0.9, cols[i % 4]);
}

on("boot", () => { if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(spot); });

export const garageDebug = { garageAt, nearHome, openGarage };
