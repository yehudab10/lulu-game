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

/** Where the last change of clothes started (tests: it must be inside the fitting room / at the closet). */
export const lastChange = { x: 0, z: 0, at: 0 };

/**
 * Walk her to (x, z) AROUND what's in the way (the room's colliders + people): a small grid search (0.2 m cells,
 * everything grown by her radius), then the corners of that path one after another (the engine's own walkTo).
 * → true when she got there (≤ 0.35 m). (A straight walkTo stops at the first rack and times out.)
 */
export async function walkPath(rt, x, z, maxT = 6) {
    const o = rt.lulu.obj.position, B = rt.bounds || { x0: -6, x1: 6, z0: -5, z1: 5 }, C = 0.2, R = 0.36;
    const nx = Math.max(1, Math.ceil((B.x1 - B.x0) / C) + 1), nz = Math.max(1, Math.ceil((B.z1 - B.z0) / C) + 1);
    const cols = rt.cols.filter(c => c.on !== false), ppl = rt.people.filter(q => q.collide);
    const free = (px, pz) => {
        if (px < B.x0 || px > B.x1 || pz < B.z0 || pz > B.z1) return false;
        for (const c of cols) if (px > c.x0 - R && px < c.x1 + R && pz > c.z0 - R && pz < c.z1 + R) return false;
        for (const q of ppl) { const p = q.p.obj.position; if (Math.hypot(px - p.x, pz - p.z) < q.r + R) return false; }
        return true;
    };
    const cx = i => B.x0 + i * C, cz = j => B.z0 + j * C;
    const cell = (px, pz) => [Math.max(0, Math.min(nx - 1, Math.round((px - B.x0) / C))), Math.max(0, Math.min(nz - 1, Math.round((pz - B.z0) / C)))];
    const ok = new Uint8Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) ok[j * nx + i] = free(cx(i), cz(j)) ? 1 : 0;
    const nearestFree = ([i0, j0]) => {
        if (ok[j0 * nx + i0]) return [i0, j0];
        for (let rr = 1; rr < 12; rr++) for (let dj = -rr; dj <= rr; dj++) for (let di = -rr; di <= rr; di++) {
            const i = i0 + di, j = j0 + dj;
            if (i >= 0 && j >= 0 && i < nx && j < nz && ok[j * nx + i]) return [i, j];
        }
        return [i0, j0];
    };
    const s = nearestFree(cell(o.x, o.z)), g = nearestFree(cell(x, z));
    const prev = new Int32Array(nx * nz).fill(-1), q = [s[1] * nx + s[0]];
    prev[q[0]] = q[0];
    const goal = g[1] * nx + g[0];
    for (let h = 0; h < q.length && prev[goal] < 0; h++) {
        const k = q[h], i = k % nx, j = (k / nx) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const a = i + di, b = j + dj, kk = b * nx + a;
            if (a < 0 || b < 0 || a >= nx || b >= nz || prev[kk] >= 0 || !ok[kk]) continue;
            if (di && dj && !(ok[j * nx + a] && ok[b * nx + i])) continue;       // (no squeezing past a corner)
            prev[kk] = k; q.push(kk);
        }
    }
    let pts = [];
    if (prev[goal] >= 0) { for (let k = goal; k !== prev[k]; k = prev[k]) pts.push([cx(k % nx), cz((k / nx) | 0)]); pts.reverse(); }
    // keep only the corners she needs (a straight walk from one to the next is clear)
    const clear = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 0.08); for (let k = 1; k < n; k++) { const t = k / n; if (!free(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return false; } return true; };
    const way = [];
    let from = [o.x, o.z], k = 0;
    while (k < pts.length) {
        let far = k;
        for (let m = pts.length - 1; m > k; m--) if (clear(from, pts[m])) { far = m; break; }
        way.push(pts[far]); from = pts[far]; k = far + 1;
    }
    way.push([x, z]);
    const t0 = performance.now();
    for (const [wx, wz] of way) {
        if (rt.disposed) return false;
        const left = maxT - (performance.now() - t0) / 1000;
        if (left <= 0) break;
        await rt.walkTo(wx, wz, Math.min(left, Math.hypot(wx - o.x, wz - o.z) / 2.2 + 1.2));
    }
    return Math.hypot(o.x - x, o.z - z) <= 0.35;
}

export function changeAnim(rt, apply) {
    const total = ANIM.curtain + ANIM.spin + ANIM.open;
    let t = 0, done = false;
    const o = rt.lulu.obj, y0 = o.rotation.y;
    lastChange.x = o.position.x; lastChange.z = o.position.z; lastChange.at = performance.now();
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
