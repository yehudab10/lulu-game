// features/clothes/stage.js — the two moments every change of clothes shares (the shop's fitting room, a closet):
//   changeAnim(rt, apply)  ≈ 1.1 s: a curtain closes (if the room has one), a spin with a sparkle — the clothes change at the
//                          middle of it — and it opens; ✕ / ○ / skipping jumps to the end (the change still happens)
//   mirrorOn(rt, on)       the mirror view: the room's own camera eases in close in front of her (no cut) and back
import * as THREE from "three";
import { ctx, on } from "../../core/ctx.js";
import { sfx } from "../interiors/fx.js";
import { ANIM } from "./data.js";

/** A curtain on the room (rt.data.curtain = { mesh, x0, x1 }): k = how much of the opening it covers (1 = closed). */
export function setCurtain(rt, k) {
    const C = rt.data.curtain;
    if (!C) return;
    C.open = k;
    C.mesh.scale.x = Math.max(0.06, k);
    C.mesh.position.x = C.x0 + (C.x1 - C.x0) * Math.max(0.06, k) / 2;
}

export function changeAnim(rt, apply) {
    const total = ANIM.curtain + ANIM.spin + ANIM.open;
    let t = 0, done = false;
    const o = rt.lulu.obj, y0 = o.rotation.y;
    const fire = r => { done = true; try { apply(); } catch (e) { console.error("[clothes] change", e); } r.burst({ x: o.position.x, y: 1.2, z: o.position.z + 0.3 }, ["#FFFFFF", "#FFD1E8", "#FFE082"], 12, 1.4, 0.04); sfx.hop(); };
    return rt.runMode({
        update(r, dt, P) {
            t += dt;
            if (P.confirm || P.back || P.interact || ctx.skipping) t = total;
            const c = t < ANIM.curtain ? t / ANIM.curtain : t < ANIM.curtain + ANIM.spin ? 1 : Math.max(0, 1 - (t - ANIM.curtain - ANIM.spin) / ANIM.open);
            setCurtain(r, 0.12 + 0.88 * c);
            const sp = Math.min(1, Math.max(0, (t - ANIM.curtain) / ANIM.spin));
            o.rotation.y = y0 + sp * Math.PI * 2;
            if (!done && sp >= 0.5) fire(r);
            if (t >= total) { if (!done) fire(r); o.rotation.y = y0; setCurtain(r, 0.12); return true; }
            return false;
        },
        stop() { if (!done) { done = true; try { apply(); } catch (e) { console.error("[clothes] change", e); } } o.rotation.y = y0; },
    });
}

// the mirror camera: the room def's camera, swapped for a close one in front of her, put back however the room ends
const MIRROR_CAM = { dist: 3.4, height: 1.4, lookY: 0.7, clampX: 0 };
let CAM = null;           // { def, cam } while a mirror view is on
export function mirrorOn(rt, on) {
    if (on) {
        if (CAM && CAM.def === rt.def) return;
        mirrorOff();
        CAM = { def: rt.def, cam: rt.def.cam };
        rt.def.cam = Object.assign({}, CAM.cam, MIRROR_CAM);
    } else mirrorOff();
}
function mirrorOff() { if (CAM) { CAM.def.cam = CAM.cam; CAM = null; } }
on("interior:exit", mirrorOff);
on("state", ({ to }) => { if (to !== "interior") mirrorOff(); });
export const mirrorShown = () => !!CAM;
