// features/impound — 🔩 BREAKING INTO THE IMPOUND LOT (on foot, opt-in; cartoon). Her own car is behind the fence:
//   ✋ at the LOOSE FENCE PANEL (the front fence, left of the gate) → she squeezes through (foot.script: she sneaks around
//   inside the 12 × 12 lot under her own steam — the stick, camera-relative; the run button = faster + louder) ·
//   BRUNO the night guard paces the back of the lot with a flashlight (a view cone that turns now and then toward his
//   sandwich) and a CAMERA sweeps from the front corner (a cone) — both drawn on the ground, so she can see them ·
//   being in a cone fills the "?" meter; full = SPOTTED: the first time Bruno's ⚠️ look ("…must've been a raccoon"),
//   spotted again while that's live = "STOP!" → she's out of the gate with him after her (ctx.foot.startChase with
//   GRAND THEFT AUTO (HER OWN CAR)) · at her car ✋ HOTWIRE (a couple of seconds unseen) → the gate crashes open and the
//   car rolls out to the kerb (index.js release): a clean getaway, no fee · ✋ at the panel again = sneak back out.
//   One try a REAL day: after it Bruno is EXTRA AWAKE (wider, longer light; he never turns to his sandwich).
import * as THREE from "three";
import { ctx, emit } from "../../core/ctx.js";
import { input } from "../../input.js";
import { saveSoon } from "../../core/save.js";
import { ensureModels, models } from "../../models.js";
import { spawnPerson } from "../../core/people.js";
import * as H from "../../hud.js";
import { TUNE, CHARGE, L } from "./data.js";

const K = TUNE;
export const BR = { built: false, town: "", F: null, guard: null, gT: 0, gU: 0, gDir: 1, gYaw: 0, look: 0, meter: 0, camYaw: 0, camT: 0,
    run: null, rm: null, fanG: null, fanC: null, geos: [], mats: [], force: {} };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const pick = a => a[Math.floor(Math.random() * a.length)];

/** The lot's frame: centre, f (toward the street), u (along the face), from ctx.civic's impound spot. */
function frame() {
    const sp = ctx.civic && ctx.civic.spot("impound");
    if (!sp || sp.cx == null) return null;
    let fx = sp.x - sp.cx, fz = sp.z - sp.cz; const l = Math.hypot(fx, fz) || 1; fx /= l; fz /= l;
    return { cx: sp.cx, cz: sp.cz, fx, fz, ux: fz, uz: -fx, gx: sp.x, gz: sp.z, rot: sp.rot };
}
const at = (Fr, f, u) => ({ x: Fr.cx + Fr.fx * f + Fr.ux * u, z: Fr.cz + Fr.fz * f + Fr.uz * u });
const local = (Fr, x, z) => ({ f: (x - Fr.cx) * Fr.fx + (z - Fr.cz) * Fr.fz, u: (x - Fr.cx) * Fr.ux + (z - Fr.cz) * Fr.uz });
export function panelSpot() { const Fr = frame(); return Fr ? at(Fr, K.lot.half + 1.0, -4.3) : null; }
const SV = () => (ctx.impound && ctx.impound.debug ? ctx.impound.debug.SAVE : null);
const awake = () => { const S = SV(); return !!(S && S.breakDay === today()); };

// ── the props: Bruno, two light fans on the ground ───────────────────────
function fan(r, deg, color) {
    const g = new THREE.CircleGeometry(r, 20, Math.PI / 2 - (deg * Math.PI / 180) / 2, deg * Math.PI / 180);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false });
    BR.geos.push(g); BR.mats.push(m);
    const o = new THREE.Mesh(g, m); o.position.y = 0.05; o.renderOrder = 2;
    return o;
}
function build() {
    clearProps();
    const Fr = frame();
    if (!Fr) return;
    BR.built = true; BR.town = ctx.town.id; BR.Fr = Fr;
    const aw = awake();
    BR.fanG = fan(aw ? K.guard.awakeR : K.guard.r, aw ? K.guard.awakeDeg : K.guard.deg, "#FFF59D");
    BR.fanC = fan(K.cam.r, K.cam.deg, "#EF9A9A");
    ctx.scene.add(BR.fanG, BR.fanC);
    BR.gU = 0; BR.gDir = 1; BR.gT = K.guard.turn[0]; BR.look = 0; BR.meter = 0;
    ensureModels(["heistGuard", "npcMan"]).then(() => {
        if (!BR.built || BR.guard) return;
        const key = models.heistGuard ? "heistGuard" : models.npcMan ? "npcMan" : null;
        if (!key) return;
        BR.guard = spawnPerson(key, {});
        ctx.scene.add(BR.guard.obj);
    }).catch(() => {});
    if (ctx.foot && ctx.foot.addSpot) BR.rm = ctx.foot.addSpot(panel);
}
function clearProps() {
    if (BR.run) endRun("reset");
    if (BR.rm) { BR.rm(); BR.rm = null; }
    for (const o of [BR.fanG, BR.fanC, BR.guard && BR.guard.obj]) if (o && o.parent) o.parent.remove(o);
    for (const g of BR.geos) g.dispose(); for (const m of BR.mats) m.dispose();
    BR.geos.length = BR.mats.length = 0;
    Object.assign(BR, { built: false, town: "", guard: null, fanG: null, fanC: null, Fr: null });
}
export function breakReset() { clearProps(); }

const panel = {
    r: 1.8, short: L.panelShort,
    pos() { return BR.built && !BR.run && ctx.impound && ctx.impound.held && !ctx.impound.released ? panelSpot() : null; },
    label() { return awake() ? `${L.panel} · ${L.panelAwake}` : L.panel; },
    act() { startBreakIn(); },
};

// ── the guard + the camera (always, while the lot is built) ──────────────
const guardPos = () => (BR.Fr ? at(BR.Fr, -1.2, BR.gU) : null);
function guardTick(dt) {
    const Fr = BR.Fr, g = BR.guard, aw = awake();
    // he paces the back of the lot between the bays, stops, turns his light
    BR.gT -= dt;
    if (BR.gT <= 0) { BR.gT = K.guard.turn[0] + Math.random() * (K.guard.turn[1] - K.guard.turn[0]); BR.gDir = -BR.gDir; }
    BR.gU = Math.max(-4.2, Math.min(4.2, BR.gU + BR.gDir * K.guard.walk * dt * (BR.gT > 1.2 ? 1 : 0)));
    const p = guardPos();
    // where his light points: along his walk, toward the front when he stops; (a ⚠️ look: at her last spot)
    let ty;
    if (BR.lookAt && BR.look > ctx.time) ty = Math.atan2(BR.lookAt.x - p.x, BR.lookAt.z - p.z);
    else if (BR.gT <= 1.2 || aw) ty = Math.atan2(Fr.fx, Fr.fz) + (aw ? Math.sin(ctx.time * 0.8) * 0.9 : 0);      // (stopped: the front; awake: sweeping)
    else ty = Math.atan2(Fr.ux * BR.gDir, Fr.uz * BR.gDir);
    BR.gYaw += Math.atan2(Math.sin(ty - BR.gYaw), Math.cos(ty - BR.gYaw)) * Math.min(1, dt * 4);
    if (g) { g.obj.position.set(p.x, 0, p.z); g.obj.rotation.y = BR.gYaw; g.update(dt, { walk: BR.gT > 1.2 ? K.guard.walk : 0 }); }
    BR.fanG.position.set(p.x, 0.05, p.z); BR.fanG.rotation.y = BR.gYaw;
    // the camera on the front-right corner post, sweeping across the lot
    const c = at(Fr, K.lot.half, K.lot.half);
    BR.camT += dt;
    BR.camYaw = Math.atan2(-Fr.fx - Fr.ux * 0.6, -Fr.fz - Fr.uz * 0.6) + Math.sin(BR.camT * K.cam.sweep) * K.cam.arc;
    BR.fanC.position.set(c.x, 0.06, c.z); BR.fanC.rotation.y = BR.camYaw;
    BR.cam = c;
}
function inCone(ox, oz, yaw, r, deg, x, z) {
    const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz);
    if (d > r) return false;
    if (d < 0.9) return true;
    const a = Math.atan2(dx, dz) - yaw, w = Math.atan2(Math.sin(a), Math.cos(a));
    return Math.abs(w) < (deg * Math.PI / 180) / 2;
}
/** Is (x, z) seen right now (by Bruno's light or the camera)? */
export function seen(x, z) {
    if (BR.force.seen != null) return BR.force.seen;
    const g = guardPos(), aw = awake();
    if (g && inCone(g.x, g.z, BR.gYaw, aw ? K.guard.awakeR : K.guard.r, aw ? K.guard.awakeDeg : K.guard.deg, x, z)) return "guard";
    if (BR.cam && inCone(BR.cam.x, BR.cam.z, BR.camYaw, K.cam.r, K.cam.deg, x, z)) return "camera";
    return false;
}

export function breakTick(dt, on) {
    if (!on) { if (BR.built && !BR.run) clearProps(); return; }
    if (!BR.built || BR.town !== ctx.town.id) build();
    if (BR.built) guardTick(dt);
}

// ── inside: her own little sneak (foot.script) ───────────────────────────
const _d = new THREE.Vector3();
export function startBreakIn() {
    if (BR.run || !BR.built || !ctx.foot || !ctx.foot.active || ctx.state !== "footRun") return false;
    const Fr = BR.Fr, start = at(Fr, K.lot.half - 0.6, -4.3);
    const R = BR.run = { t: 0, x: start.x, z: start.z, wire: 0, spots: 0 };
    const ok = ctx.foot.script({ update: (dt, P, F) => runTick(dt, P, F, R), abort: why => endRun(why || "abort") });
    if (!ok) { BR.run = null; return false; }
    const S = SV(); if (S) { S.breakDay = today(); S.breaks = (S.breaks || 0) + 1; saveSoon(); }
    BR.meter = 0;
    const F = ctx.foot.debug && ctx.foot.debug.F;
    if (F) { F.pos.x = R.x; F.pos.z = R.z; F.lulu.obj.position.set(R.x, 0, R.z); }
    sayLulu(pick(L.in));
    logIt("in", { awake: awake() });
    emitStat("impoundBreakIns");
    return true;
}
function sayLulu(t) { try { if (ctx.foot && ctx.foot.say && ctx.foot.obj) ctx.foot.say(ctx.foot.obj, t, 2.2); } catch (e) { /* none */ } }
function guardSay(t, cls = "cop") { try { if (BR.guard && ctx.foot.say) ctx.foot.say(BR.guard.obj, t, 2.6, { cls }); } catch (e) { /* none */ } }
function logIt(phase, d = {}) { try { const I = ctx.impound.debug.IM; I.log.push(Object.assign({ ev: "breakin", t: +ctx.time.toFixed(2), phase }, d)); } catch (e) { /* none */ } emit("impound:breakin", Object.assign({ phase }, d)); }

function runTick(dt, P, F, R) {
    if (BR.run !== R || !BR.Fr) return false;
    const Fr = BR.Fr;
    R.t += dt;
    // move: the stick, camera-relative (up = away from the camera)
    const mx = ctx.dialogOpen ? 0 : input.moveX, my = ctx.dialogOpen ? 0 : input.moveY;
    const fast = !!input.boost, sp = fast ? K.run : K.sneak;
    ctx.camera.getWorldDirection(_d); _d.y = 0; _d.normalize();
    const rx = -_d.z, rz = _d.x;
    let vx = _d.x * -my + rx * mx, vz = _d.z * -my + rz * mx;
    const vl = Math.hypot(vx, vz); if (vl > 1) { vx /= vl; vz /= vl; }
    let nx = R.x + vx * sp * dt, nz = R.z + vz * sp * dt;
    // the fence + her car + the two cruisers are solid
    const lc = local(Fr, nx, nz), h = K.lot.half;
    lc.f = Math.max(-h, Math.min(h, lc.f)); lc.u = Math.max(-h, Math.min(h, lc.u));
    let q = at(Fr, lc.f, lc.u); nx = q.x; nz = q.z;
    const car = ctx.civic.impound.car();
    const blocks = [];
    if (car) { const cp = car.position, mxx = Math.cos(Fr.rot || 0), mxz = -Math.sin(Fr.rot || 0); blocks.push(cp, { x: cp.x + mxx * 3, z: cp.z + mxz * 3 }, { x: cp.x + mxx * 6, z: cp.z + mxz * 6 }); }
    for (const b of blocks) { const dx = nx - b.x, dz = nz - b.z, d = Math.hypot(dx, dz); if (d < 1.5 && d > 1e-3) { nx = b.x + dx / d * 1.5; nz = b.z + dz / d * 1.5; } }
    const moved = Math.hypot(nx - R.x, nz - R.z) > 1e-3;
    R.x = nx; R.z = nz;
    F.pos.x = R.x; F.pos.z = R.z;
    const L1 = F.lulu;
    if (moved) L1.obj.rotation.y = Math.atan2(vx, vz);
    L1.obj.position.set(R.x, 0, R.z);
    L1.update(dt, { walk: moved ? sp : 0 });
    // seen? the "?" meter (running doubles it)
    const who = seen(R.x, R.z);
    BR.meter = who ? Math.min(1, BR.meter + dt / K.seeFill * (fast ? 2 : 1)) : Math.max(0, BR.meter - dt * K.seeDrain);
    if (BR.meter >= 1) { spotted(R, who); if (BR.run !== R) return false; }
    // at her car: ✋ HOTWIRE (held while unseen) · at the panel: ✋ back out
    const nearCar = car && Math.hypot(car.position.x - R.x, car.position.z - R.z) < 2.0;
    const pn = at(Fr, h - 0.6, -4.3), nearPanel = Math.hypot(pn.x - R.x, pn.z - R.z) < 1.4;
    if (nearCar) {
        if (P.interact || R.wire > 0 || BR.force.wire) R.wire += dt;
        H.prompt(`✋ ${L.car}${R.wire > 0 ? ` · ${Math.min(100, Math.round(R.wire / K.hotwire * 100))}%` : ""}`);
        if (R.wire > 0 && R.wire - dt <= 0.05) sayLulu(pick(L.wiring));
        if (R.wire >= K.hotwire) { H.prompt(""); getaway(R); return false; }
    } else {
        R.wire = 0;
        H.prompt(nearPanel ? "✋ 🔩 sneak back out" : BR.meter > 0.05 ? `👀 ${"?".repeat(1 + Math.floor(BR.meter * 3))}` : "");
        if (nearPanel && P.interact && R.t > 0.6) { endRun("out"); putOutside(); return false; }
    }
    return true;
}
function spotted(R, who) {
    BR.meter = 0;
    if (BR.look > ctx.time) {
        // the second time: the chase
        guardSay(L.caught, "cop");
        logIt("chase", { who });
        endRun("chase");
        putOutside();
        try { ctx.foot.startChase({ x: BR.Fr.gx, z: BR.Fr.gz }, { charges: [CHARGE.name] }); } catch (e) { console.error("[impound] chase", e); }
        H.banner(`<b>🚨 ${L.caught}</b>`, 2400, { key: "impound", prio: 3 });
        emitStat("impoundBreakBusts");
        return;
    }
    BR.look = ctx.time + K.lookLife;
    BR.lookAt = { x: R.x, z: R.z };
    guardSay(pick(L.look));
    logIt("look", { who });
    H.banner(`<b>🔦 ${pick(L.look)}</b><small>break-in · seen once more and he chases</small>`, 2400, { key: "impound", prio: 2 });
}
function getaway(R) {
    logIt("clean");
    endRun("clean");
    const S = SV(); if (S) { S.clean = (S.clean || 0) + 1; saveSoon(); }
    emitStat("impoundBreakClean");
    ctx.impound.release("breakin");
    H.toast(L.clean, "gold", { prio: 3, key: "impound" });
}
function putOutside() {
    const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F, Fr = BR.Fr;
    if (!F || !Fr) return;
    const p = at(Fr, K.lot.half + 1.6, -3.4);
    F.pos.x = p.x; F.pos.z = p.z; F.lulu.obj.position.set(p.x, 0, p.z);
}
function endRun(why) {
    if (!BR.run) return;
    BR.run = null;
    H.prompt("");
    logIt("end", { why });
}
function emitStat(id) { emit("stat", { id, n: 1 }); }
