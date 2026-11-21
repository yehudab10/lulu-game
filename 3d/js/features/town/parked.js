// features/town — the PARKED CARS, made real. Every kerbside / driveway / jammed car is baked into the
// merged clusters (kit.js: cheap) with two collider circles (build.js › parkedCar), and TAGGED, so one of
// them can be lifted out of the merge into a real model when it matters:
//   • she bumps one (driving): it lifts out, gets shoved (a slide + a spin + a rock on its springs) and its
//     alarm whoops — the colliders move with it;
//   • she walks up to one (on foot): it lifts out and joins foot's parked cars (ctx.foot.addParked), so the
//     ✋ offers 🚗 HOTWIRE CAR exactly like a car on the highway's shoulder — win the minigame and she drives
//     off in it (it's gone from the kerb for the rest of the visit), fumble it and the alarm goes off.
// An untouched car goes back into the merge once she's walked on (a shoved one stays a real car).
import { ctx, emit } from "../../core/ctx.js";
import { models, cloneWithColors } from "../../models.js";
import { hideTagged } from "./kit.js";
import { PL, toLocal, toWorld, wH } from "./plan.js";
import * as SFX from "./sfx.js";

export const PK = { T: null, live: new Set(), footT: 0, hits: 0, taken: 0 };
/** The model she drives off in (the parked one is a light LOD). */
const SHELL = { town_minivan_lod: "town_minivan", town_mw_sedan_lod: "sedan" };
const shellKey = k => SHELL[k] || (models[k.replace(/_lod$/, "")] ? k.replace(/_lod$/, "") : "sedan");
const NEAR = 10, FAR = 24, SHOW = 140;
const _l = {};

export function setupParked(T) {
    PK.T = T; PK.live.clear(); PK.footT = 0;
    for (const pc of T.pcars) for (const c of pc.cols) c.onHit = imp => { bump(pc, imp); };
}
export function clearParked() {
    for (const pc of PK.live) { if (pc.rm) pc.rm(); pc.rm = null; pc.fp = null; }
    PK.live.clear(); PK.T = null;
}

/** Lift a parked car out of the merge: a real model in its place. */
function lift(pc) {
    if (pc.live) return pc.live;
    const tpl = models[pc.key];
    if (!tpl || !PK.T) return null;
    hideTagged(pc.tag, true);
    const obj = cloneWithColors(tpl, { Paint: pc.paint });
    obj.rotation.order = "YXZ";
    obj.position.set(pc.x, 0, pc.z);
    obj.rotation.y = pc.rot;
    obj.traverse(o => { if (o.isMesh) o.castShadow = false; });
    PK.T.root.add(obj);
    pc.live = { obj, vx: 0, vz: 0, spin: 0, rock: 0, moved: false };
    PK.live.add(pc);
    return pc.live;
}
/** Back into the merge (only an untouched one that foot isn't using). */
function settle(pc) {
    if (!pc.live || pc.live.moved || pc.fp) return;
    if (pc.live.obj.parent) pc.live.obj.parent.remove(pc.live.obj);
    hideTagged(pc.tag, false);
    pc.live = null;
    PK.live.delete(pc);
}
function syncCols(pc) {
    const fx = Math.sin(pc.rot), fz = Math.cos(pc.rot);
    pc.cols.forEach((c, i) => { const k = i ? -1 : 1; toWorld(pc.x + fx * pc.off * k, pc.z + fz * pc.off * k, c); });
    if (pc.fp) { toWorld(pc.x, pc.z, pc.fp); pc.fp.h = wH(pc.rot); }
}

/** Her car hit it (a static collider's onHit, impact in m/s): shove it, rock it, set off the alarm. */
export function bump(pc, imp) {
    if (pc.gone || imp < 1.2 || !ctx.car) return;
    const L = lift(pc);
    if (!L) return;
    // (all in the town's local frame: pc.x / pc.z / rot are local)
    const car = ctx.car, cl = toLocal(car.pos.x, car.pos.z, {}), wx = pc.x, wz = pc.z;
    let nx = wx - cl.x, nz = wz - cl.z;
    const n = Math.hypot(nx, nz) || 1; nx /= n; nz /= n;
    const k = Math.min(3.6, imp * 0.24) / (pc.sedan ? 1.2 : 1.5);
    L.vx += nx * k; L.vz += nz * k;
    // a hit off its middle swings it round (the contact's lever arm about the car's centre)
    const rx = cl.x - wx, rz = cl.z - wz;
    L.spin = Math.max(-0.9, Math.min(0.9, L.spin + (rx * nz - rz * nx) * k * 0.09));
    L.rock = Math.min(0.12, L.rock + imp * 0.012);
    L.moved = true;
    PK.hits++;
    if (!(pc.alarmAt > ctx.time - 3)) { pc.alarmAt = ctx.time; SFX.alarm(Math.min(1, imp / 8)); }
    emit("town:parkedHit", { impact: imp, key: pc.key, obj: L.obj, alarm: pc.alarmAt === ctx.time });     // (obj, alarm: features/life blinks its lights)
}

function footPc(pc) {
    const w = toWorld(pc.x, pc.z, {});
    return {
        vtype: "car", key: shellKey(pc.key), colors: { Paint: pc.paint }, obj: pc.live.obj,
        x: w.x, z: w.z, h: wH(pc.rot), circles: [pc.off, -pc.off], r: pc.sedan ? 0.95 : 1.0,
        ext: {
            taken: () => {        // she drove off in it: gone from the kerb for the rest of the visit
                pc.gone = true; pc.fp = null; pc.rm = null;
                for (const c of pc.cols) c.off = true;
                if (pc.live && pc.live.obj.parent) pc.live.obj.parent.remove(pc.live.obj);
                pc.live = null; PK.live.delete(pc);
                PK.taken++;
                emit("town:borrow", { key: pc.key });
            },
            drop: () => { pc.fp = null; pc.rm = null; },
        },
    };
}

/** Per frame (town tick): shoved cars slide to a stop, the ones by her on foot are hotwirable. */
export function tickParked(dt) {
    const T = PK.T;
    if (!T) return;
    const cam = toLocal(ctx.camera.position.x, ctx.camera.position.z, {});
    for (const pc of PK.live) {
        const L = pc.live;
        if (L.moved && (Math.abs(L.vx) + Math.abs(L.vz) + Math.abs(L.spin) > 0.004)) {
            pc.x += L.vx * dt; pc.z += L.vz * dt; pc.rot += L.spin * dt;
            const damp = Math.exp(-2.4 * dt);
            L.vx *= damp; L.vz *= damp; L.spin *= damp;
            L.obj.position.x = pc.x; L.obj.position.z = pc.z; L.obj.rotation.y = pc.rot;
            syncCols(pc);
        }
        if (L.rock > 0.002) { L.rock *= Math.exp(-3 * dt); L.obj.rotation.z = Math.sin(ctx.time * 17) * L.rock; }
        L.obj.visible = Math.abs(pc.x - cam.x) < SHOW && Math.abs(pc.z - cam.z) < SHOW;
    }
    // on foot: the cars right by her join foot's parked cars (🚗 HOTWIRE CAR); the ones she's left go back
    PK.footT -= dt;
    if (PK.footT > 0) return;
    PK.footT = 0.2;
    const F = ctx.foot && ctx.foot.active && ctx.foot.addParked && ctx.foot.pos;
    const ph = ctx.foot && ctx.foot.phase;
    const p = F ? toLocal(F.x, F.z, _l) : null;
    if (p) for (const pc of T.pcars) {
        if (pc.gone || pc.fp) continue;
        if (Math.abs(pc.x - p.x) > NEAR || Math.abs(pc.z - p.z) > NEAR) continue;
        if (!lift(pc)) continue;
        pc.fp = footPc(pc);
        pc.rm = ctx.foot.addParked(pc.fp);
        if (!pc.rm) pc.fp = null;
    }
    for (const pc of [...PK.live]) {
        const far = !p || Math.hypot(pc.x - p.x, pc.z - p.z) > FAR;
        if (pc.fp && far && ph !== "hotwire" && ph !== "approach") { if (pc.rm) pc.rm(); pc.rm = null; pc.fp = null; }
        if (!pc.fp && far) settle(pc);
    }
}
