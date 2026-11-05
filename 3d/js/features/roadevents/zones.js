// features/roadevents — road ZONES (the road-event side of the 2D city zones),
// the GAS STATION + NITRO fuel cans, and the "liquid courage" buff.
//
// Every ~940 m of open road a themed stretch of 600–940 m: Construction (work
// zone, steamrollers), School Zone (crossing guards, stopped buses, kids), Gas
// Station (nitro fuel cans), Farmers Market (ice-cream trucks), Bar District
// (drunk drivers, tipsy patrons), Downtown (texting drivers), Hospital
// (ambulances). The journey can steer it with ctx.journey.zoneBias?.() →
// { cityKind, ruralGapMul } or force one with ctx.roadevents.setZone(kind).
import * as THREE from "three";
import { ctx, emit, addActor } from "../../core/ctx.js";
import { facingRoad, worldMaterials, LANES_OURS } from "../../world.js";
import { rumble } from "../../input.js";
import * as H from "../../hud.js";
import * as A from "../../audio.js";
import { PAY, ZONES, ZONE_WEIGHT, ZONE_GAP, ZONE_LEN, ZONE_NAMES, ZONE_SIGNS, COURAGE_DONE } from "./config.js";
import { defineEvent, R, count, inc } from "./state.js";
import { K, need, pt, place, rnd, pick, clamp, claimSlot, reserve, makePiece, builtEnd, sfx, stat, solid, carTouches, models, cloneWithColors } from "./common.js";
import { varRibbon } from "./toll.js";
import { startWorkZone } from "./construction.js";
import { spawnParkedRoller } from "./dozer.js";

// ── zones ──────────────────────────────────────────────────────────────────
const Z = { next: 0, signs: [] };
export function resetZones() {
    R.zone = null; R.zoneS0 = R.zoneS1 = 0; R.zoneSched = null;
    Z.next = (ctx.car ? ctx.car.s : 0) + rnd(ZONE_GAP[0], ZONE_GAP[1]);
    for (const sg of Z.signs) { const i = ctx.world.signs.indexOf(sg); if (i >= 0) ctx.world.signs.splice(i, 1); }
    Z.signs.length = 0;
}
function pickZone() {
    const bias = ctx.journey && ctx.journey.zoneBias ? ctx.journey.zoneBias() : null;
    if (bias && bias.cityKind && ZONES.includes(bias.cityKind) && Math.random() < 0.7) return bias.cityKind;
    let total = 0;
    for (const z of ZONES) total += ZONE_WEIGHT[z] || 1;
    let r = Math.random() * total;
    for (const z of ZONES) { r -= ZONE_WEIGHT[z] || 1; if (r < 0) return z; }
    return ZONES[0];
}
/** Plan the next zone (beyond the built world so its signs and set pieces fit). */
export function scheduleZone(kind, opts = {}) {
    kind = kind || pickZone();
    const len = opts.len || rnd(ZONE_LEN[0], ZONE_LEN[1]);
    const s0 = opts.s != null ? opts.s : Math.max(Z.next, builtEnd() + 160);
    const s1 = s0 + len;
    R.zoneSched = { kind, s0, s1 };
    const sign = ZONE_SIGNS[kind];
    if (sign && builtEnd() < s0 - 140) {
        const def = Object.assign({ s: s0 - 130, d: 10.6, w: 4.4, h: 2.2 }, sign);
        ctx.world.addSign(def);
        Z.signs.push(def);
    }
    if (kind === "construction") {
        reserve(s0, s1, 1, 8.8, 14);
        startWorkZone(s0, s1).catch(e => console.error(e));
        spawnParkedRoller({ s: s0 + rnd(110, 190) }).catch(e => console.error(e));
    } else if (kind === "gas") {
        spawnGasStation({ s: s0 + rnd(90, 160) }).catch(e => console.error(e));
    }
    count("zone_" + kind);
    emit("roadevents:zone", { kind, s0, s1, planned: true });
    return R.zoneSched;
}
export function updateZones(dt, allowNew) {
    const car = ctx.car;
    const sc = R.zoneSched;
    if (!sc && allowNew && car.s > Z.next - 900) scheduleZone();
    if (sc && !R.zone && car.s >= sc.s0 && car.s < sc.s1) {
        R.zone = sc.kind; R.zoneS0 = sc.s0; R.zoneS1 = sc.s1;
        if (ctx.state === "playing") H.banner(`<b>${ZONE_NAMES[sc.kind]}</b><small>${zoneTip(sc.kind)}</small>`, 2400);
        emit("roadevents:zone", { kind: sc.kind, s0: sc.s0, s1: sc.s1 });
    }
    if (sc && car.s >= sc.s1) {
        R.zone = null; R.zoneSched = null;
        const bias = ctx.journey && ctx.journey.zoneBias ? ctx.journey.zoneBias() : null;
        Z.next = sc.s1 + rnd(ZONE_GAP[0], ZONE_GAP[1]) * (bias && bias.ruralGapMul || 1);
        emit("roadevents:zone", { kind: null });
    }
}
function zoneTip(k) {
    return { construction: "Merge — and mind the crew!", school: "Slow down for the kids", gas: "Grab a can of NITRO ⛽", market: "Listen for the ice-cream truck 🍦",
        bars: "Watch out for the weavers 🍸", downtown: "Everyone's texting… 📱", hospital: "Make way for ambulances 🚑" }[k] || "";
}

// ── the gas station + nitro fuel cans ──────────────────────────────────────
export async function spawnGasStation(opts = {}) {
    await need(["gas_station", "fuel_can"]);
    const slot = claimSlot(40, 40, opts);
    const s = slot.s, side = opts.side || (Math.random() < 0.5 ? -1 : 1);
    const P = makePiece("gas");
    P.later(slot.release);
    reserve(s - 35, s + 35, side, 8.8, 34);
    const st = cloneWithColors(models[K("gas_station")]);
    const p = pt(s, side * 19);
    st.position.set(p.x, 0, p.z);
    st.rotation.y = facingRoad(p.h, side);
    P.add(st);
    const lot = new THREE.Mesh(P.own(varRibbon(s - 12, s + 12, () => side > 0 ? 8.8 : -22, () => side > 0 ? 22 : -8.8, 0.025)), worldMaterials().drive);
    lot.receiveShadow = true;
    P.add(lot);
    const solids = [];
    for (const a of [-3.8, 3.8]) solids.push({ ...pt(s + a * side * -1, side * 19), r: 0.4 });
    solids.push({ ...pt(s, side * 19), r: 1.2 }, { ...pt(s, side * 25), r: 3 });
    inc("gas");
    addActor({
        foot: true,
        update() { return ctx.car.s < s + 160; },
        collide(car) {
            if (Math.abs(s - car.s) > 12) return null;
            let w = 0;
            for (const c of solids) w = Math.max(w, solid(c.x, c.z, c.r));
            return w > 2 ? { impact: w * 0.8, why: "Lulu vs. the gas pump: nobody wins", source: "gas" } : null;
        },
        dispose() { P.disposePiece(); inc("gas", -1); },
    });
    return { s, side };
}
defineEvent("gasStation", { label: "Gas station", emoji: "⛽", models: ["gas_station", "fuel_can"], spawn: spawnGasStation, setPiece: true });

/** A floating NITRO fuel can in a lane ahead (2D gas zone). */
export async function spawnFuelCan(opts = {}) {
    await need(["fuel_can"]);
    const car = ctx.car;
    const s = opts.s != null ? opts.s : car.s + rnd(150, 250);
    const d = opts.d != null ? opts.d : pick(LANES_OURS) + rnd(-1, 1);
    const obj = cloneWithColors(models[K("fuel_can")]);
    obj.scale.setScalar(1.6);
    place(obj, s, d, 0, 0.9);
    ctx.scene.add(obj);
    const E = { s, d, taken: false, t: 0 };
    inc("fuelCan");
    addActor({
        foot: true,
        update(dt) {
            E.t += dt;
            obj.rotation.y = E.t * 2.5;
            obj.position.y = 0.9 + Math.sin(E.t * 3) * 0.15;
            if (!E.taken && ctx.state === "playing" && Math.abs(E.s - ctx.car.s) < 4 && carTouches(obj.position.x, obj.position.z, 0.6)) {
                E.taken = true;
                nitro(PAY.nitroSecs);
                return false;
            }
            return ctx.car.s < E.s + 40 && E.s - ctx.car.s < 900;
        },
        dispose() { if (obj.parent) obj.parent.remove(obj); inc("fuelCan", -1); },
    });
    return E;
}
defineEvent("fuelCan", { label: "Nitro fuel can", emoji: "🛢️", models: ["fuel_can"], spawn: spawnFuelCan });

// ── buffs: NITRO turbo (fuel cans, the journey's ice-cream task) & liquid courage (the bar) ──
export const buffs = { nitro: 0, courage: 0, lastDist: 0 };
/** Turbo for `secs` (stacks to 9 s): forced boost, shielded, plows through traffic for +30 each. */
export function nitro(secs = PAY.nitroSecs) {
    buffs.nitro = Math.min(buffs.nitro + secs, PAY.nitroMax);
    H.toast("NITRO! 🔥", "gold");
    A.sfxBoost();
    sfx.engine(110);
    rumble(0.6, 0.6, 300, true);
    stat("nitroCans", 1);
    count("nitro");
}
/** Liquid courage from the bar: shielded + double distance points while driving. */
export function courage(secs = PAY.courageSecs) {
    buffs.courage = Math.max(buffs.courage, secs);
    buffs.lastDist = ctx.G.distance || 0;
    H.toast("🍺 COURAGE ×2", "gold");
    count("courage");
}
export function updateBuffs(dt, controlsOn) {
    const G = ctx.G;
    if (buffs.nitro > 0 && controlsOn) {
        buffs.nitro = Math.max(0, buffs.nitro - dt);
        G.boost = Math.max(G.boost, 0.3);
        G.score += Math.max(0, ctx.car.vF) * dt * 0.06;
    }
    if (buffs.courage > 0 && controlsOn) {
        const dd = (G.distance || 0) - buffs.lastDist;
        if (dd > 0) G.score += dd * (G.boosting ? 1.5 : 1);
        buffs.courage = Math.max(0, buffs.courage - dt);
        if (buffs.courage <= 0) H.toast(COURAGE_DONE, "pink");
    }
    buffs.lastDist = G.distance || 0;
}
export function resetBuffs() { buffs.nitro = 0; buffs.courage = 0; buffs.lastDist = 0; }
