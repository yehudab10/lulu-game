// features/shops/bling.js — ✨ REFAEL'S BLING BAY: horns + car decorations, at the dealership (the showroom's other
// door, a pink neon star over it). ✋ there → Yossi pulls a copy of HER car (her paint, what's bolted on now) up to the
// kerb out front and the card opens: every horn (focus = hear it) and every decoration (focus = fitted onto the car in
// front of her — garage/decor.js, the same pieces the old showroom used). Free on what she owns (put it on / take a
// decoration off), ask → buy on the rest — garage/buy.js (ownedHorns + horn / ownedDecor + decor, the shared save: her
// real car wears it at once, the classic 2D game too).
import * as THREE from "three";
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { models, cloneWithColors, findNodes, ensureModels } from "../../models.js";
import { SKINS } from "../../car.js";
import * as H from "../../hud.js";
import { HORNS, DECOR, inv, syncInv } from "../garage/data.js";
import { buyHorn, buyDecor, owns } from "../garage/buy.js";
import { makeDecor, attachToModel, disposeDecor, animateDecor } from "../garage/decor.js";
import * as S from "../garage/sound.js";
import { kerbAt } from "../places/out.js";
import { openCard, cardTick, cardOpen, closeCard, cardFocus } from "./card.js";
import { canShop } from "./dealer.js";
import { BLING } from "./data.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const inTown = () => !!(ctx.town && ctx.town.active);

/** The bay's ✋ spot: its door on the showroom (town data: the dealer's `with` entry, spot "bling"). */
export function baySpot() {
    const sp = inTown() && ctx.town.spot ? ctx.town.spot("bling") : null;
    return sp ? { x: sp.x, z: sp.z, sp } : null;
}
/** Where the display car stands: at the kerb in front of the bay (clear of her own parked car). */
function displayAt(b) {
    const at = { x: b.x, z: b.z, nx: b.sp.nx, nz: b.sp.nz, ux: b.sp.ux, uz: b.sp.uz };
    let k = kerbAt(at, 0);
    const pc = ctx.foot && ctx.foot.parkedCar;
    if (pc && Math.hypot(pc.x - k.x, pc.z - k.z) < 6) k = kerbAt(at, -7);
    return k;
}

const B = { car: null, decor: null, decorId: null, cam: null, at: null, t: 0 };
function showDisplay(decorId) {
    if (!B.car) {
        const sk = SKINS[ctx.car.skinKey] || SKINS.pink;
        B.car = cloneWithColors(models.lulu, { Body: sk.body, BodyLight: sk.light, BodyDark: sk.dark });
        for (const n of [...findNodes(B.car, "Driver"), ...findNodes(B.car, "Hair_")]) n.visible = false;
        B.car.position.set(B.at.x, 0, B.at.z);
        B.car.rotation.y = B.at.h;
        B.car.name = "BlingDisplayCar";
        ctx.scene.add(B.car);
    }
    if (B.decorId === decorId) return;
    if (B.decor) { if (B.decor.parent) B.decor.parent.remove(B.decor); disposeDecor(B.decor); B.decor = null; }
    B.decorId = decorId;
    if (!decorId || decorId === "none") return;
    const d = makeDecor(decorId);
    if (!d) { ensureModels(["garageDecor"]).then(() => { if (B.decorId === decorId) { B.decorId = null; showDisplay(decorId); } }).catch(() => {}); return; }
    B.decor = d;
    attachToModel(B.car, d);
    pop();
}
function pop() { B.t = 0.3; }
function dropDisplay() {
    if (B.decor) { if (B.decor.parent) B.decor.parent.remove(B.decor); disposeDecor(B.decor); }
    if (B.car) ctx.scene.remove(B.car);
    B.car = null; B.decor = null; B.decorId = null;
}

function tiles() {
    syncInv();
    const horns = HORNS.map(h => ({
        id: "horn:" + h.id, icon: h.icon, name: h.name, price: h.price,
        state: () => (owns("horn", h.id) ? (inv.horn === h.id ? "placed" : "owned") : "buy"),
        tag: () => (owns("horn", h.id) ? (inv.horn === h.id ? "✓ On" : "Yours") : ""),
        desc: () => `📯 <b>${h.name}</b> — ${owns("horn", h.id) ? (inv.horn === h.id ? "it's your horn." : "yours: ✕ puts it on.") : "hear it? ✕ to buy."}`,
        act: () => { if (inv.horn !== h.id) { buyHorn(h.id); S.sfxEquip(); H.toast(`📯 ${h.name} — your horn now!`, "gold", { prio: 3, key: "shopsBuy" }); } S.playHorn(h.id, 262); },
        buy: () => done(buyHorn(h.id), `📯 ${h.name} is yours — honk away!`),
    }));
    const decor = DECOR.map(d => ({
        id: "decor:" + d.id, icon: d.icon, name: d.short || d.name, price: d.price,
        state: () => (owns("decor", d.id) ? (inv.decor === d.id ? "placed" : "owned") : "buy"),
        tag: () => (owns("decor", d.id) ? (inv.decor === d.id ? "✓ On" : "Yours") : ""),
        desc: () => `✨ <b>${d.name}</b> — ${d.desc}${owns("decor", d.id) ? (inv.decor === d.id ? " <i>(✕ takes it off)</i>" : " <i>(✕ puts it on)</i>") : ""}`,
        act: () => { const r = buyDecor(d.id); if (r.ok) { S.sfxEquip(); H.toast(r.off ? `✨ ${d.name} off` : `✨ ${d.name} on!`, r.off ? "" : "gold", { prio: 3, key: "shopsBuy" }); } },
        buy: () => done(buyDecor(d.id), `✨ ${d.name} — fitted! It's yours.`),
    }));
    return [...horns, ...decor];
}
function done(r, text) {
    if (r.ok) {
        H.toast(text, "gold", { prio: 3, key: "shopsBuy" });
        if (ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, pick(BLING.lulu), 2.2);
        emit("stat", { id: "shopsBling", n: 1 });
        pop();
    }
    return r;
}
function preview(id) {
    if (!id) return;
    const [kind, x] = id.split(":");
    if (kind === "horn") { S.playHorn(x, 262); showDisplay(inv.decor); pop(); }
    else showDisplay(x);
}

export function openBling() {
    const b = canShop() && baySpot();
    if (!b || cardOpen() || !ctx.foot.script || !models.lulu) return false;
    B.at = displayAt(b);
    syncInv();
    ensureModels(["garageDecor"]).catch(() => {});
    const cam = ctx.camera;
    B.cam = { pos: cam.position.clone(), look: new THREE.Vector3() };
    cam.getWorldDirection(B.cam.look).multiplyScalar(6).add(cam.position);
    const ok = ctx.foot.script({
        update(dt, P, F) {
            if (F.lulu) { F.lulu.face(B.at.x, B.at.z, dt, 6); F.lulu.update(dt, { walk: 0 }); }
            if (B.decor) animateDecor(B.decor, dt);
            if (B.car) { B.t = Math.max(0, B.t - dt); const s = 1 + Math.sin(B.t / 0.3 * Math.PI) * 0.035; B.car.scale.setScalar(s); }
            const open = cardTick(P);
            if (!open) dropDisplay();
            return open;
        },
        camera(dt) {
            const a = B.at, portrait = cam.aspect < 1, back = portrait ? 8.4 : 6.6;
            const n = [b.sp.nx, b.sp.nz], u = [b.sp.ux, b.sp.uz];
            const tgt = new THREE.Vector3(a.x + n[0] * back + u[0] * 2.4, portrait ? 3.6 : 2.9, a.z + n[1] * back + u[1] * 2.4);
            const aim = new THREE.Vector3(a.x, portrait ? -1.3 : -0.9, a.z);
            const k = 1 - Math.exp(-dt * 3.5);
            B.cam.pos.lerp(tgt, k); B.cam.look.lerp(aim, k);
            cam.position.copy(B.cam.pos); cam.lookAt(B.cam.look);
            const fov = portrait ? 66 : 52;
            cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
            if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
            return true;
        },
        abort() { if (cardOpen()) closeCard(true); dropDisplay(); },
    });
    if (!ok) return false;
    showDisplay(inv.decor);
    openCard({ title: "✨ Refael's Bling Bay", tiles: tiles(), focus: "horn:" + inv.horn, onFocus: preview, onClose: () => dropDisplay(),
        head: () => `Yossi pulled your car round. Horns: focus to hear · decorations: focus to try on.` });
    emit("stat", { id: "shopsVisits", n: 1 });
    emit("shops:open", { place: "bling", town: ctx.town.id });
    return true;
}

const spot = {
    r: 2.0, short: "BLING", door: true,
    pos() {
        if (!canShop() || cardOpen()) return null;
        const b = baySpot(), p = ctx.foot.pos;
        return b && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 30 * 30 ? b.sp : null;        // (with its axes: the ✋ reaches across the bay's front — ci/doors)
    },
    label: () => "✨ REFAEL'S BLING BAY — HORNS & DECOR",
    act: () => openBling(),
};
on("boot", () => { if (ctx.foot && ctx.foot.addSpot) ctx.foot.addSpot(spot); });
on("town:leave", () => dropDisplay());
on("title", () => dropDisplay());
void hook; void cardFocus;

export const blingDebug = { B, baySpot, openBling };
