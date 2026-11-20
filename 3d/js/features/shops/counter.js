// features/shops/counter.js — the shops you buy over a COUNTER (or out of a van): the same walk-up → ✋ → card →
// ask → buy as the dealership, for the garage catalogue's ITEMS.
//   🛒 the MAKOLET (grocery + pharmacy, one per town — town data `uses.makolet`): pepper spray, the bubble shield
//      ("bubble wrap for cars"), Distracted Mode ("the phone plan"); its keeper in the doorway
//   😈 SHMEREL'S VAN (the black market — Velvel's cousin): missiles, the Mega 5-Pack, pepper spray ("the label's in
//      Russian"); a dark van at the kerb by the construction site (Lakewood) / the car service (Midwood), the side door
//      open, Shmerel leaning on it. Cartoon: they're "fireworks". Spawned only while she's near.
// The focused item sits on a little stand by the door / on the van's tailgate (garage's item models, loaded when she
// walks up), turning. Buying = garage/buy.js (the shared save's missiles / pepperSpray / shields / distractedUnlocked —
// exactly what the old Shop wrote).
import * as THREE from "three";
import { ctx, on, emit, hook } from "../../core/ctx.js";
import { models, ensureModels, cloneWithColors } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { ITEMS } from "../garage/data.js";
import { buyItem, owns, countOf } from "../garage/buy.js";
import { cloneNode } from "../garage/decor.js";
import { kerbAt } from "../places/out.js";
import { openCard, cardTick, cardOpen, closeCard, cardFocus } from "./card.js";
import { MAKOLET, BLACK } from "./data.js";

const pick = a => a[Math.floor(Math.random() * a.length)];
const inTown = () => !!(ctx.town && ctx.town.active);
const townId = () => (inTown() && ctx.town.id) || "lakewood";
const itemDef = id => ITEMS.find(i => i.id === id);
const party = () => !!(ctx.party && ctx.party.active);
const roam = () => party() && !!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.partyTowns());

/** On foot in a town, nothing urgent: counters are open. */
function canShop() {
    if (!inTown() || ctx.state !== "footRun" || !ctx.foot || !ctx.foot.pos) return false;
    if (party() && !roam()) return false;
    if ((ctx.law && (ctx.law.chasing || ctx.law.fugitive)) || ctx.foot.chasing) return false;
    if (ctx.heist && (ctx.heist.robbery || ctx.heist.snatcher || ctx.heist.thief)) return false;
    return true;
}

// ── where each counter stands (world coords, in the town she's in) ──────
/** The makolet's door spot (town data) | null. */
function makoletSpot() { return inTown() && ctx.town.spot ? ctx.town.spot("makolet") : null; }
/** Shmerel's van: at the kerb `ahead` m along from a town spot; → { x, z, h, sx, sz (where she stands), nx, nz, ux, uz } | null. */
const VAN = { at: null, town: null };
function vanSpot() {
    if (!inTown()) return null;
    const id = ctx.town.id;
    if (VAN.at && VAN.town === id) return VAN.at;
    const cfg = BLACK.spot[id], sp = cfg && ctx.town.spot(cfg.spot);
    if (!sp) return null;
    const kb = kerbAt(sp, cfg.ahead);
    VAN.at = { x: kb.x, z: kb.z, h: kb.h, nx: sp.nx, nz: sp.nz, ux: sp.ux, uz: sp.uz, sp };
    VAN.town = id;
    return VAN.at;
}

// ── the counters ─────────────────────────────────────────────────────────
const COUNTERS = {
    makolet: {
        place: "makolet", stock: MAKOLET.stock, names: MAKOLET.names,
        title: () => `🛒 ${(MAKOLET[townId()] || MAKOLET.lakewood).name}`,
        keeper: () => MAKOLET.keeper[townId()] || MAKOLET.keeper.lakewood,
        lines: MAKOLET,
        // where she stands (✋) · where the keeper stands · where the item stand is · what the camera frames
        frame() {
            const sp = makoletSpot();
            if (!sp) return null;
            return { me: { x: sp.x, z: sp.z }, keeper: { x: sp.x - sp.nx * 1.3 + sp.ux * 1.4, z: sp.z - sp.nz * 1.3 + sp.uz * 1.4, h: Math.atan2(sp.nx, sp.nz) },
                stand: { x: sp.x - sp.nx * 0.9 - sp.ux * 1.2, y: 1.05, z: sp.z - sp.nz * 0.9 - sp.uz * 1.2 }, n: [sp.nx, sp.nz], u: [sp.ux, sp.uz], look: { x: sp.x - sp.nx * 1.5, z: sp.z - sp.nz * 1.5 } };
        },
        label: () => `🛒 ${(MAKOLET[townId()] || MAKOLET.lakewood).name.toUpperCase()}`,
    },
    black: {
        place: "black", stock: BLACK.stock, names: BLACK.names,
        title: () => `😈 ${BLACK.name}`,
        keeper: () => BLACK.keeper,
        lines: BLACK,
        frame() {
            const v = vanSpot();
            if (!v) return null;
            const fx = Math.sin(v.h), fz = Math.cos(v.h);
            // the van's kerb-side door faces the sidewalk (toward the lot line: −n from the street)
            const door = { x: v.x + v.nx * 1.4, z: v.z + v.nz * 1.4 };
            return { me: { x: v.x + v.nx * 2.6, z: v.z + v.nz * 2.6 }, keeper: { x: door.x + fx * 1.9, z: door.z + fz * 1.9, h: Math.atan2(v.nx, v.nz) },
                stand: { x: door.x - fx * 0.2 + v.nx * 0.2, y: 1.1, z: door.z - fz * 0.2 + v.nz * 0.2 }, n: [v.nx, v.nz], u: [fx, fz], look: { x: v.x, z: v.z } };
        },
        label: () => "😈 SHMEREL'S VAN — PSST…",
    },
};

// ── the keepers (+ Shmerel's van): spawned when she's near ──────────────
const K = {};
function keeperTick(id, dt) {
    const C = COUNTERS[id], f = inTown() ? C.frame() : null;
    const p = (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
    const want = !!(f && p && (f.me.x - p.x) ** 2 + (f.me.z - p.z) ** 2 < 70 * 70);
    let k = K[id];
    if (!want) { if (k) dropKeeper(id); return; }
    const kd = C.keeper();
    if (!k) {
        const need = [kd.key, ...(id === "black" ? ["town_minivan"] : [])];
        if (need.some(n => !models[n])) { ensureModels(need).catch(() => {}); return; }
        k = K[id] = { p: spawnPerson(kd.key, { colors: kd.colors }), said: false, van: null };
        k.p.obj.name = "ShopKeeper_" + id;
        ctx.scene.add(k.p.obj);
        if (id === "black") {
            const v = vanSpot();
            k.van = cloneWithColors(models.town_minivan, { Paint: "#2B2D31" });
            k.van.position.set(v.x, 0, v.z); k.van.rotation.y = v.h;
            k.van.name = "ShmerelsVan";
            ctx.scene.add(k.van);
        }
        k.p.obj.position.set(f.keeper.x, 0, f.keeper.z);
        k.p.obj.rotation.y = f.keeper.h;
    }
    const fp = ctx.foot && ctx.foot.active ? ctx.foot.pos : null;
    const close = fp && (fp.x - k.p.obj.position.x) ** 2 + (fp.z - k.p.obj.position.z) ** 2 < 10 * 10;
    if (close) k.p.face(fp.x, fp.z, dt, 4);
    k.p.update(dt, { wave: close && !k.said && id !== "black", talk: cardOpen() && S.id === id });
    if (close && !k.said && ctx.state === "footRun") { k.said = true; keeperSay(id, pick(C.lines.hello), 3.2); }
}
function dropKeeper(id) {
    const k = K[id];
    if (!k) return;
    ctx.scene.remove(k.p.obj);
    if (k.van) ctx.scene.remove(k.van);
    delete K[id];
}
function keeperSay(id, text, sec = 2.8) { const k = K[id]; if (k && ctx.foot && ctx.foot.say) ctx.foot.say(k.p.obj, text, sec); }

// ── the item on its stand ────────────────────────────────────────────────
const S = { id: null, cam: null, stand: null, item: null, itemId: null, spin: 0 };
const ITEM_MODELS = ["garageItems", "garageProps"];
function showItem(itemId) {
    const C = COUNTERS[S.id], f = C && C.frame();
    if (!f) return;
    if (!S.stand) {
        const g = new THREE.Group();
        const m = new THREE.MeshStandardMaterial({ color: S.id === "black" ? "#5D4037" : "#ECEFF1", roughness: 0.6 });
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.6), m);
        crate.position.y = 0.4;
        g.add(crate);
        g.position.set(f.stand.x, 0, f.stand.z);
        g.name = "ShopsStand";
        ctx.scene.add(g);
        S.stand = g;
    }
    if (S.itemId === itemId) return;
    if (S.item) { S.stand.remove(S.item); S.item = null; }
    S.itemId = itemId;
    const it = itemDef(itemId);
    const src = it && (it.model === "Item_missile" || it.model === "Item_phone" ? models.garageProps : models.garageItems);
    const obj = src && cloneNode(src, it.model);
    if (!obj) { ensureModels(ITEM_MODELS).then(() => { if (S.itemId === itemId) { S.itemId = null; showItem(itemId); } }).catch(() => {}); return; }
    // (fit it to ~0.5 m, sitting on the crate)
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
    const k = 0.5 / Math.max(0.05, size.x, size.y, size.z);
    const holder = new THREE.Group();
    obj.scale.multiplyScalar(k);
    obj.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
    holder.add(obj);
    holder.position.y = 0.82;
    S.stand.add(holder);
    S.item = holder;
}
function dropStand() {
    if (S.stand) { ctx.scene.remove(S.stand); S.stand = null; }
    S.item = null; S.itemId = null;
}

// ── the card ─────────────────────────────────────────────────────────────
function tiles(id) {
    const C = COUNTERS[id];
    return C.stock.map(itId => {
        const it = itemDef(itId), nm = C.names[itId] || {};
        return {
            id: itId, icon: it.icon, name: nm.name || it.title, price: it.price,
            state: () => (itId === "distracted" && owns("item", "distracted") ? "placed" : "buy"),
            tag: () => (itId === "distracted" && owns("item", "distracted") ? "✓ Yours" : ""),
            desc: () => `${nm.desc || it.desc}${it.count ? ` <b>· You have ${countOf(itId)}</b>` : ""}`,
            act: () => { if (itId === "distracted") keeperSay(id, pick(MAKOLET.owned)); },
            buy: () => {
                const r = buyItem(itId);
                if (r.ok) {
                    H.toast(it.bought, "gold", { prio: 3, key: "shopsBuy" });
                    keeperSay(id, pick(C.lines.bought), 2.8);
                    if (S.item) S.item.scale.setScalar(1.35);
                    emit("stat", { id: "shopsItems", n: 1 });
                } else if (r.why === "poor") keeperSay(id, pick(C.lines.poor), 2.6);
                return r;
            },
        };
    });
}
export function openCounter(id) {
    const C = COUNTERS[id], f = C && canShop() && C.frame();
    if (!f || cardOpen() || !ctx.foot.script) return false;
    S.id = id;
    ensureModels(ITEM_MODELS).catch(() => {});
    const cam = ctx.camera;
    S.cam = { pos: cam.position.clone(), look: new THREE.Vector3() };
    cam.getWorldDirection(S.cam.look).multiplyScalar(6).add(cam.position);
    const ok = ctx.foot.script({
        update(dt, P, F) {
            if (F.lulu) { F.lulu.face(f.look.x, f.look.z, dt, 6); F.lulu.update(dt, { walk: 0 }); }
            if (S.item) { S.item.rotation.y += dt * 1.2; const s = S.item.scale.x; if (s > 1) S.item.scale.setScalar(Math.max(1, s - dt * 1.5)); }
            const open = cardTick(P);
            if (!open) { dropStand(); S.id = null; }
            return open;
        },
        camera(dt) {
            const portrait = cam.aspect < 1, back = portrait ? 6.4 : 4.6;
            const st = f.stand;
            const tgt = new THREE.Vector3(st.x + f.n[0] * back + f.u[0] * 1.6, portrait ? 2.6 : 2.0, st.z + f.n[1] * back + f.u[1] * 1.6);
            const aim = new THREE.Vector3(st.x, portrait ? 0.3 : 0.8, st.z);
            const k = 1 - Math.exp(-dt * 3.5);
            S.cam.pos.lerp(tgt, k); S.cam.look.lerp(aim, k);
            cam.position.copy(S.cam.pos); cam.lookAt(S.cam.look);
            const fov = portrait ? 66 : 52;
            cam.fov += (fov - cam.fov) * k; cam.updateProjectionMatrix();
            if (ctx.cam && ctx.cam.state) ctx.cam.state.pos.copy(cam.position);
            return true;
        },
        abort() { if (cardOpen()) closeCard(true); dropStand(); S.id = null; },
    });
    if (!ok) return false;
    openCard({ title: C.title(), tiles: tiles(id), focus: C.stock[0], onFocus: itId => showItem(itId), onClose: () => dropStand() });
    emit("stat", { id: "shopsVisits", n: 1 });
    emit("shops:open", { place: id, town: townId() });
    if (id === "makolet") emit("shops:makolet", { town: townId() });
    return true;
}

// ── the ✋ spots ──────────────────────────────────────────────────────────
function counterSpot(id) {
    const C = COUNTERS[id];
    return {
        r: id === "black" ? 2.2 : 2.0, short: id === "black" ? "PSST" : "SHOP",
        pos() {
            if (!canShop() || cardOpen()) return null;
            const f = C.frame();
            if (!f) return null;
            const p = ctx.foot.pos;
            return (f.me.x - p.x) ** 2 + (f.me.z - p.z) ** 2 < 30 * 30 ? f.me : null;
        },
        label: C.label,
        act: () => openCounter(id),
    };
}

on("boot", () => {
    if (!ctx.foot || !ctx.foot.addSpot) return;
    for (const id of Object.keys(COUNTERS)) ctx.foot.addSpot(counterSpot(id));
});
hook("hud", dt => { try { for (const id of Object.keys(COUNTERS)) keeperTick(id, dt); } catch (e) { console.error("[shops] counter", e); } });
const reset = () => { for (const id of Object.keys(K)) dropKeeper(id); dropStand(); VAN.at = null; VAN.town = null; };
on("town:leave", reset);
on("town:enter", () => { VAN.at = null; VAN.town = null; });
on("title", reset);

export const counterDebug = { COUNTERS, K, S, VAN, openCounter, vanSpot, makoletSpot };
