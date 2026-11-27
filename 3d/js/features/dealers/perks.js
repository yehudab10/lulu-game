// features/dealers/perks.js — the luxuries that DO something. A car's perks = its built-in ones (data.js LUX_CARS.perks)
// + the options bought for it in the F&I office (DS.opts[carId]). Each is small, capped and never a coin source:
//   🚀 launch     from a stop (≥ 0.6 s), floor it → an easy rocket start (a push + flames), every stop
//   🔋 tank       nitro lasts 30 % longer (core/driving.js reads ctx.G.nitroTank); a car's own `nitro` multiplies too
//   💆 massage    stopped 20 s with a heart missing → +1 ♥ (once a run)
//   🥂 fridge     stopped 8 s → a fizzy line + a small nitro top-up (once a run)
//   🛎️ concierge  a honk → a classy line over the car (at most every 8 s)
//   🅿️ selfpark   the Parking Challenge's "park it for me" (features/parking: once a level, scores ★, no level bonus)
import { ctx, on, hook, emit } from "../../core/ctx.js";
import { store } from "../../core/save.js";
import { heal } from "../../core/driving.js";
import { SKINS } from "../../car.js";
import { input } from "../../input.js";
import * as A from "../../audio.js";
import { OPTIONS } from "./data.js";

/** 3D save: options bought per car, the nonsense she fell for, deals done / walked out of. */
export const DS = store("dealers", { opts: {}, fell: {}, deals: 0, walked: 0, saved: 0 });
const R = { stopT: 0, armed: false, launched: false, massage: false, fridge: false, conciergeT: 0 };

export function perksOf(id) {
    const sk = SKINS[id];
    return new Set([...((sk && sk.perks) || []), ...(DS.opts[id] || [])]);
}
export const hasPerk = k => !!(ctx.car && perksOf(ctx.car.skinKey).has(k));
const LINES = {
    massage: ["💆 Ahh. The seats are doing the thing.", "💆 Okay. I could live in this car."],
    fridge: ["🥂 Champagne! …It's seltzer. Lime. Fancy seltzer.", "🥂 *pssht* Fizzy. Elegant. Slightly flat."],
    concierge: ["“Your table is ready.”", "“Madam's motorcade, coming through.”", "“Pardon us. Thank you ever so much.”", "“The valet has been informed.”"],
};
const pick = a => a[Math.floor(Math.random() * a.length)];
function line(text) {
    try { if (ctx.banter && ctx.banter.say) { ctx.banter.say(text); return; } } catch (e) { /* none */ }
}

// the nitro tank (every frame: cheap; the car can change under her at any time)
hook("hud", () => {
    const G = ctx.G, car = ctx.car;
    if (!G || !car) return;
    const sk = SKINS[car.skinKey] || {};
    G.nitroTank = (sk.nitro || 1) * (hasPerk("tank") ? 1.3 : 1);
});

// launch control + the at-rest perks
hook("update", (dt, P, controlsOn) => {
    const car = ctx.car, G = ctx.G;
    if (!controlsOn || ctx.state !== "playing" || !car) { R.stopT = 0; return; }
    const stopped = car.speed < 0.5;
    R.stopT = stopped ? R.stopT + dt : 0;
    if (R.stopT > 0.6) R.armed = true;                 // (armed by a real stop; the pedal can come in over a few frames)
    if (car.speed > 4) { R.armed = false; R.launched = false; }
    if (hasPerk("launch") && R.armed && !R.launched && input.throttle > 0.8) {
        R.launched = true; R.armed = false; R.stopT = 0;
        const fx = Math.sin(car.h), fz = Math.cos(car.h);
        car.vx += fx * 5.5; car.vz += fz * 5.5;
        car.fx.burst(car.pos.x - fx * 2.1, 0.4, car.pos.z - fz * 2.1, 14, 3, [1, 0.6, 0.2], 0.35, 0.5);
        A.sfxBoost();
        emit("dealers:perk", { k: "launch" });
    }
    if (hasPerk("massage") && !R.massage && R.stopT > 20 && (G.hearts || 0) < (G.maxHearts || 3)) {
        R.massage = true; heal(1); line(pick(LINES.massage)); emit("dealers:perk", { k: "massage" });
    }
    if (hasPerk("fridge") && !R.fridge && R.stopT > 8) {
        R.fridge = true; G.boost = Math.min(1, (G.boost || 0) + 0.15); line(pick(LINES.fridge)); emit("dealers:perk", { k: "fridge" });
    }
}, -5);
on("honk", () => {
    if (!hasPerk("concierge") || ctx.time < R.conciergeT) return;
    R.conciergeT = ctx.time + 8;
    line(pick(LINES.concierge));
    emit("dealers:perk", { k: "concierge" });
});
on("run:start", () => { R.massage = false; R.fridge = false; R.launched = false; R.stopT = 0; });

/** The options a car can still take in the F&I office (not built in, not bought). */
export function openOptions(id) {
    const p = perksOf(id);
    return Object.keys(OPTIONS).filter(k => !p.has(k));
}
export const perksDebug = { R, DS, perksOf };
