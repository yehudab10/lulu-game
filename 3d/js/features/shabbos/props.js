// features/shabbos — the 3D things of the rush (all lazy-loaded, pooled, shared materials):
//   · Bubbe's porch: her door swings open on a warm hallway, the candle table (two flames +
//     glow sprites), Ima at the table — dropped on BUBBE'S HOUSE's own transform (the journey
//     builds the house at stop 0 in every mode; we only add the door / table / Ima).
//   · storefronts whose roll-down gates come down as Shabbos gets close (2 pooled, planned
//     slots reserved in the world so no tree grows through them)
//   · the flashing LED trailer: "SHABBOS IN 2 MIN" (1 pooled, a canvas screen)
//   · people rushing home on the sidewalks (challah, a cholent-pot jogger, a bekishe man
//     running for the mikvah) — at most TUNE.pedMax at once, one pooled clone per type
// Nothing here exists outside a rush: reset() takes it all out of the scene.
import * as THREE from "three";
import { ctx, pick, rand } from "../../core/ctx.js";
import { save3d } from "../../core/save.js";
import { registerModels, ensureModels, models, findNodes, cloneWithColors } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import { facingRoad, canvasTex } from "../../world.js";
import { TUNE, SHOP_NAMES, PED_SAYS } from "./data.js";
import * as SFX from "./sfx.js";

registerModels({
    shabbos_porch: "shabbos_porch", shabbos_shop: "shabbos_shop", shabbos_sign: "shabbos_sign",
    shabbos_challah: "shabbos_challah", shabbos_cholent: "shabbos_cholent", shabbos_bekishe: "shabbos_bekishe",
});
const KEYS = ["shabbos_porch", "shabbos_shop", "shabbos_sign", "shabbos_challah", "shabbos_cholent", "shabbos_bekishe", "imaPerson"];
let loading = null;
/** Load every model the rush uses (once). */
export function loadProps() {
    if (!loading) loading = ensureModels(KEYS).catch(e => { console.error("[shabbos] models", e); loading = null; throw e; });
    return loading;
}
export const ready = () => KEYS.every(k => models[k]);

// ── shared bits ─────────────────────────────────────────────────────────────
let glowMat = null;
function glowSprite(scale) {
    if (!glowMat) {
        const tex = canvasTex(64, 64, (g, w, h) => {
            const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            gr.addColorStop(0, "rgba(255,236,160,1)"); gr.addColorStop(0.35, "rgba(255,190,70,.5)"); gr.addColorStop(1, "rgba(255,150,0,0)");
            g.fillStyle = gr; g.fillRect(0, 0, w, h);
        }, false);
        glowMat = new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    }
    const s = new THREE.Sprite(glowMat);
    s.scale.setScalar(scale);
    return s;
}
const E = new THREE.Euler(), Qa = new THREE.Quaternion();
function poseLimb(node, x, z = 0, y = 0) {
    if (!node || !node.userData.base) return;
    node.quaternion.copy(node.userData.base).multiply(Qa.setFromEuler(E.set(x, y, z, "XYZ")));
}
const V = new THREE.Vector3();

// ═══ Bubbe's porch ═══════════════════════════════════════════════════════════
export const porch = { group: null, door: null, glow: null, flames: [], ima: null, S: 0, open: 0, lit: 0, t: 0, fallback: null };
function buildPorch() {
    const g = new THREE.Group();
    g.name = "ShabbosPorchSet";
    const m = models.shabbos_porch.clone(true);
    g.add(m);
    porch.door = findNodes(m, "Door")[0] || null;
    porch.glow = findNodes(m, "DoorGlow")[0] || null;
    porch.flames = findNodes(m, "Flame_").map((f, i) => {
        const glow = glowSprite(0.55);
        glow.position.y = 0.07;
        f.add(glow);
        return { f, glow, base: f.scale.clone(), ph: i * 1.9 };
    });
    porch.ima = spawnPerson("imaPerson", { scale: 1 });
    porch.ima.obj.position.set(-1.72, 0.245, 4.62);      // behind the candle table, facing the road
    g.add(porch.ima.obj);
    porch.group = g;
}
/** Put the porch set on Bubbe's house at road distance S (closed door, unlit candles). */
export function placePorch(S) {
    if (!ready()) return false;
    if (!porch.group) buildPorch();
    const road = ctx.world.road, p = road.point(S, 27, {});
    porch.S = S;
    porch.group.position.set(p.x, 0, p.z);
    porch.group.rotation.y = facingRoad(road.at(S).h, 1);
    // no journey feature → no house at stop 0: bring our own
    if (!ctx.journey && models.bubbeHouse) {
        if (!porch.fallback) porch.fallback = models.bubbeHouse.clone(true);
        porch.group.add(porch.fallback);
    }
    setPorch(0, 0);
    porch.group.visible = Math.abs(S - ctx.car.s) < 650;
    if (!porch.group.parent) ctx.scene.add(porch.group);
    porch.group.updateMatrixWorld(true);
    return true;
}
/** open 0..1 (the door), lit 0..2 (candles burning). */
export function setPorch(open, lit) {
    porch.open = open; porch.lit = lit;
    if (porch.group) porch.group.visible = true;
    if (porch.door) porch.door.rotation.y = -1.75 * (1 - Math.pow(1 - Math.min(1, open), 3));
    if (porch.glow) porch.glow.visible = open > 0.02;
    porch.flames.forEach((fl, i) => { fl.f.visible = lit > i; });
}
export function tickPorch(dt, pose = {}) {
    if (!porch.group || !porch.group.parent) return;
    porch.t += dt;
    const t = porch.t;
    for (const fl of porch.flames) {
        if (!fl.f.visible) continue;
        const k = 1 + Math.sin(t * 13 + fl.ph) * 0.16 + Math.sin(t * 29 + fl.ph * 2) * 0.06;
        fl.f.scale.set(fl.base.x * (2 - k), fl.base.y * k, fl.base.z * (2 - k));
        fl.glow.material.opacity = 0.8 + Math.sin(t * 17 + fl.ph) * 0.15;
    }
    if (porch.ima) {
        porch.ima.update(dt, { talk: !!pose.talk, cheer: !!pose.cheer });
        if (pose.bless) {   // hands circling over the candles, then covering her eyes
            const c = Math.sin(t * 4.5);
            poseLimb(porch.ima.limbs.Arm_L, -1.5 + c * 0.25, 0.35);
            poseLimb(porch.ima.limbs.Arm_R, -1.5 - c * 0.25, -0.35);
        }
    }
}
/** World positions for the arrival camera: (local x, y, z) in the house's frame. */
export function porchPoint(x, y, z, out) { return porch.group.localToWorld(out.set(x, y, z)); }

// ═══ storefronts ═════════════════════════════════════════════════════════════
const signMats = [];
function shopSignMat(i) {
    if (signMats[i]) return signMats[i];
    const d = SHOP_NAMES[i];
    const tex = canvasTex(512, 64, (g, w, h) => {
        g.fillStyle = d.bg; g.fillRect(0, 0, w, h);
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8);
        g.fillStyle = d.fg; g.font = "bold 38px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(d.name, w / 2, h / 2 + 2, w - 30);
    }, false);
    return (signMats[i] = new THREE.MeshLambertMaterial({ map: tex }));
}
let signGeo = null;
const shopPool = [];
function makeShop() {
    const obj = models.shabbos_shop.clone(true);
    const gate = findNodes(obj, "Gate")[0] || null;
    const anchor = findNodes(obj, "Anchor_sign")[0] || null;
    if (!signGeo) signGeo = new THREE.PlaneGeometry(6.2, 0.78);
    const sign = new THREE.Mesh(signGeo, shopSignMat(0));
    sign.position.z = 0.07;
    if (anchor) anchor.add(sign); else { sign.position.set(0, 3.85, 2.15); obj.add(sign); }
    return { obj, gate, sign, slot: null };
}
export const shops = { plan: [], reserved: [] };
/** Plan the storefront slots for this rush (reserve the ones far enough ahead). */
export function planShops(s0, dest) {
    clearShops();
    const w = ctx.world, from = s0 + Math.max(650, (dest - s0) * TUNE.shopsFrom);
    let side = Math.random() < 0.5 ? 1 : -1, k = Math.floor(Math.random() * SHOP_NAMES.length);
    for (let s = from; s < dest - 360; s += TUNE.shopEvery + rand(-60, 60)) {
        const slot = { s, side, name: k++ % SHOP_NAMES.length, gate: 0, slammed: false };
        side = -side;
        if (s < ctx.car.s + 650) continue;          // that bit of road is already built
        const r = { s0: s - 7, s1: s + 7, side, dMin: 8.8, dMax: 24 };
        r.side = slot.side;
        w.reserve(r.s0, r.s1, r.side, r.dMin, r.dMax);
        shops.reserved.push(w.reserved[w.reserved.length - 1]);
        shops.plan.push(slot);
    }
}
function clearShops() {
    const w = ctx.world;
    if (w && w.reserved) for (const r of shops.reserved) { const i = w.reserved.indexOf(r); if (i >= 0) w.reserved.splice(i, 1); }
    shops.reserved.length = 0;
    shops.plan.length = 0;
    for (const p of shopPool) { if (p.obj.parent) p.obj.parent.remove(p.obj); p.slot = null; }
}
/** Storefronts near the car: `closing` 0..1 = how far Shabbos has crept in. */
function tickShops(dt, closing) {
    const car = ctx.car, road = ctx.world.road;
    const near = shops.plan.filter(sl => sl.s > car.s - 60 && sl.s < car.s + 330);
    for (const p of shopPool) if (p.slot && !near.includes(p.slot)) { p.obj.parent && p.obj.parent.remove(p.obj); p.slot = null; }
    for (const sl of near) {
        let p = shopPool.find(x => x.slot === sl);
        if (!p) {
            p = shopPool.find(x => !x.slot) || (shopPool.length < 2 ? (shopPool.push(makeShop()), shopPool[shopPool.length - 1]) : null);
            if (!p) continue;
            p.slot = sl;
            const pt = road.point(sl.s, sl.side * 15, {});
            p.obj.position.set(pt.x, 0, pt.z);
            p.obj.rotation.y = facingRoad(pt.h, sl.side);
            p.sign.material = shopSignMat(sl.name);
            ctx.scene.add(p.obj);
            sl.seen = true;
        }
        // the gate: creeping down with the sun, SLAMMED when she drives past late in the day
        const dist = sl.s - car.s;
        let want = Math.min(0.85, Math.max(0, (closing - 0.15) * 1.2));
        if (!sl.started) { sl.started = true; sl.gate = Math.max(sl.gate, want * 0.7); }   // they've been closing up for a while
        if (closing > 0.45 && dist < 45) want = 1;
        if (want > sl.gate) {
            const was = sl.gate;
            sl.gate = Math.min(want, sl.gate + dt * (want >= 1 ? 1.4 : 0.25));
            if (want >= 1 && was < 0.95 && sl.gate >= 0.95 && dist > -20 && dist < 60) SFX.gate();
        }
        if (p.gate) p.gate.scale.y = Math.max(0.02, sl.gate);
    }
}
/** For the props actor: storefront + sign colliders near (x, z). */
function shopHit(car) {
    for (const p of shopPool) {
        if (!p.slot) continue;
        const dx = p.obj.position.x - car.pos.x, dz = p.obj.position.z - car.pos.z;
        if (dx * dx + dz * dz > 100) continue;
        const imp = car.collideStatic(p.obj.position.x, p.obj.position.z, 4.2);
        if (imp) return { impact: imp, why: "That shop is CLOSED, Lulu", source: "shabbosShop" };
    }
    return null;
}

// ═══ the LED message trailer ═════════════════════════════════════════════════
export const sign = { obj: null, screen: null, tex: null, canvas: null, s: 0, on: false, text: "", t: 0 };
function makeSign() {
    const obj = models.shabbos_sign.clone(true);
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.62, 1.34), mat);
    const a = findNodes(obj, "Anchor_screen")[0];
    screen.position.z = 0.03;
    if (a) a.add(screen); else { screen.position.set(0, 2.75, 0.06); obj.add(screen); }
    Object.assign(sign, { obj, screen, tex, canvas: c });
}
function paintSign(lines) {
    const key = lines.join("|");
    if (key === sign.text) return;
    sign.text = key;
    const g = sign.canvas.getContext("2d"), w = sign.canvas.width, h = sign.canvas.height;
    g.fillStyle = "#050505"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FFB300"; g.textAlign = "center"; g.textBaseline = "middle";
    g.font = "bold 78px 'Courier New', monospace";
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * 96, w - 24));
    // the LED dot grid
    g.fillStyle = "rgba(0,0,0,.55)";
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h);
    for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 2);
    sign.tex.needsUpdate = true;
}
/** Park the trailer `ahead` metres up the road on the right shoulder, clear of trees. */
export function placeSign(ahead = 220) {
    if (!ready()) return false;
    if (!sign.obj) makeSign();
    const road = ctx.world.road;
    let s = ctx.car.s + ahead;
    for (let k = 0; k < 12 && treeNear(s, 10.1); k++) s += 9;
    const p = road.point(s, 10.1, {});
    sign.s = s; sign.on = true; sign.t = 0; sign.text = "";
    sign.obj.position.set(p.x, 0, p.z);
    sign.obj.rotation.y = p.h + Math.PI + 0.32;     // facing the oncoming Lulu, angled to the road
    if (!sign.obj.parent) ctx.scene.add(sign.obj);
    return true;
}
function treeNear(s, d) {
    const p = ctx.world.road.point(s, d, {});
    for (const ch of ctx.world.activeChunks()) {
        if (s < ch.s0 - 10 || s > ch.s0 + 210) continue;
        for (const c of ch.colliders) if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 9) return true;
    }
    return false;
}
function tickSign(dt, left) {
    if (!sign.on) return;
    if (sign.s < ctx.car.s - 80) { sign.on = false; if (sign.obj.parent) sign.obj.parent.remove(sign.obj); return; }
    sign.t += dt;
    const page = Math.floor(sign.t / 1.6) % 3;
    const mins = Math.ceil(Math.max(0, left) / 60);
    paintSign(page === 2 ? ["GOOD", "SHABBOS!"] : page === 1 ? ["CANDLES", "AT SUNSET"] : ["SHABBOS IN", left > 60 ? `${mins} MIN` : "<1 MIN!!"]);
    const on = page !== 0 || Math.floor(sign.t * 3) % 2 === 0;      // the first page FLASHES
    sign.screen.material.color.setScalar(on ? 1 : 0.18);
}
function signHit(car) {
    if (!sign.on) return null;
    const imp = car.collideStatic(sign.obj.position.x, sign.obj.position.z, 1.3);
    return imp ? { impact: imp, why: "You hit the SHABBOS sign. The irony.", source: "shabbosSign" } : null;
}

// ═══ people rushing home ═════════════════════════════════════════════════════
const PED_TYPES = {
    challah: { key: "shabbos_challah", speed: [1.7, 2.1], pose: "carry" },
    cholent: { key: "shabbos_cholent", speed: [3.0, 3.6], pose: "carry" },
    bekishe: { key: "shabbos_bekishe", speed: [4.2, 5.0], pose: "hat" },
};
const pedPool = {};
export const peds = [];
/** A person hurrying along the sidewalk, `ahead` metres up the road. */
export function spawnPed(type, ahead = rand(110, 190)) {
    if (!ready() || peds.length >= TUNE.pedMax) return null;
    const T = PED_TYPES[type];
    if (!T || peds.some(p => p.type === type)) return null;
    const per = pedPool[type] || (pedPool[type] = spawnPerson(T.key, { scale: 1 }));
    const side = Math.random() < 0.6 ? 1 : -1;
    const p = { type, per, s: ctx.car.s + ahead, d: side * rand(10, 11.2), dir: Math.random() < 0.5 ? 1 : -1, v: rand(T.speed[0], T.speed[1]),
        pose: T.pose, said: false, hop: 0, dodged: false };
    ctx.scene.add(per.obj);
    peds.push(p);
    placePed(p, 0);
    return p;
}
function placePed(p, dt) {
    const pt = ctx.world.road.point(p.s, p.d, {});
    p.per.obj.position.set(pt.x, p.hop > 0 ? Math.sin(p.hop / 0.5 * Math.PI) * 0.5 : 0, pt.z);
    p.per.obj.rotation.y = p.dir > 0 ? pt.h : pt.h + Math.PI;
}
function tickPeds(dt) {
    const car = ctx.car, quiet = (save3d.settings && save3d.settings.chatter) === "quiet";
    for (let i = peds.length - 1; i >= 0; i--) {
        const p = peds[i];
        p.s += p.dir * p.v * dt;
        if (p.hop > 0) { p.hop = Math.max(0, p.hop - dt); p.d += Math.sign(p.d) * dt * 3; }
        placePed(p, dt);
        const per = p.per, L = per.limbs;
        per.update(dt, { walk: p.v });
        if (p.pose === "carry") { poseLimb(L.Arm_L, -1.15, 0.32); poseLimb(L.Arm_R, -1.15, -0.32); }
        else if (p.pose === "hat") poseLimb(L.Arm_R, -2.75, -0.15);     // holding his hat on
        const gap = p.s - car.s;
        // a word as she passes (an NPC bubble; Quiet chatter keeps the road quiet)
        if (!p.said && gap > 0 && gap < 26 && ctx.banter && ctx.banter.bubble && !quiet) {
            p.said = true;
            ctx.banter.bubble(pick(PED_SAYS[p.type]), per.obj, { dur: 2.4, y: 2.2, cls: "nice" });
        }
        // nearly run over → a hop out of the way
        const dx = per.obj.position.x - car.pos.x, dz = per.obj.position.z - car.pos.z;
        if (dx * dx + dz * dz < 9 && p.hop <= 0 && car.speed > 3) { p.hop = 0.5; if (!p.dodged) { p.dodged = true; SFX.yelp(); } }
        if (gap < -60 || gap > 420) { if (per.obj.parent) per.obj.parent.remove(per.obj); peds.splice(i, 1); }
    }
}

// ═══ the per-frame tick + the colliders ═════════════════════════════════════
/** closing: 0..1 how close Shabbos is · left: seconds to candles. */
export function tickProps(dt, closing, left) {
    if (!ready() || !ctx.car) return;
    if (porch.group) porch.group.visible = Math.abs(porch.S - ctx.car.s) < 650;     // no draw calls until she's close
    tickShops(dt, closing);
    tickSign(dt, left);
    tickPeds(dt);
}
/** An actor that bumps Lulu off the storefronts + the trailer (core turns big hits into hearts). */
export function propsActor() {
    return {
        update() { return true; },
        collide(car) { return shopHit(car) || signHit(car); },
    };
}

/** Out of the scene, reservations released (pooled clones are kept for next time). */
export function resetProps() {
    clearShops();
    for (const p of peds) if (p.per.obj.parent) p.per.obj.parent.remove(p.per.obj);
    peds.length = 0;
    sign.on = false;
    if (sign.obj && sign.obj.parent) sign.obj.parent.remove(sign.obj);
    if (porch.group && porch.group.parent) porch.group.parent.remove(porch.group);
    porch.t = 0;
}
/** Debug / tests: what's out there. */
export function propsInfo() {
    return {
        porch: !!(porch.group && porch.group.parent), open: porch.open, lit: porch.lit,
        shops: shopPool.filter(p => p.slot).map(p => ({ s: Math.round(p.slot.s), gate: +p.slot.gate.toFixed(2), name: SHOP_NAMES[p.slot.name].name })),
        planned: shops.plan.length, reserved: shops.reserved.length,
        sign: sign.on ? { s: Math.round(sign.s), text: sign.text } : null,
        peds: peds.map(p => ({ type: p.type, gap: Math.round(p.s - ctx.car.s) })),
    };
}
