// features/crime — CRIME THAT ISN'T HERS (stage 2): the people who make a street feel alive, each one something she can
// report (in person or from the 📞 Phone), foil, ignore — or join:
//   🥄 monte.js    Yanky's "find the kugel" table (folds when a cop turns the corner) — play (rigged) · report · be his shill
//   ⌚ watches.js  Shmuly "Rolecks" and his coat — buy one (a sink) · report · no thanks
//   📦 porch.js    the porch pirate — tackle → return it to the family (they remember) · 📞 Shomrim · let it go · keep it
// Built on town:enter (the people spawn only within ~90 m of her), gone on town:leave.
import { ctx, on } from "../../core/ctx.js";
import { live } from "./common.js";
import { MONTE, buildMonte, clearMonte, monteTick, monteReason, report as reportMonte } from "./monte.js";
import { WATCH, buildWatch, clearWatch, watchTick, watchReason, report as reportWatch } from "./watches.js";
import { PORCH, porchTick, porchReset, dropPorch, porchReason, spawn as spawnPorch, tackle as tacklePorch, shomrim as porchShomrim, famMem } from "./porch.js";
import { COPS, copsTick, clearCops } from "./street.js";

export function othersEnter() { buildMonte(); buildWatch(); }
export function othersLeave() { clearMonte(); clearWatch(); dropPorch(); clearCops(); }
export function othersRun() { porchReset(); }
export function othersTick(dt) {
    const on = live();
    monteTick(dt);
    watchTick(dt);
    porchTick(dt, on);
    copsTick(dt);
}

// the 📞 Phone: report what's going on right now (911 for the table + the watches, Shomrim for the porch pirate)
let wired = false;
export function wirePhone() {
    const cm = ctx.community;
    if (wired || !cm || !cm.addReason) return;
    wired = true;
    cm.addReason("police", monteReason);
    cm.addReason("police", watchReason);
    cm.addReason("shomrim", porchReason);
}
on("boot", wirePhone);

export const othersDebug = { MONTE, WATCH, PORCH, COPS, reportMonte, reportWatch, spawnPorch, tacklePorch, porchShomrim, famMem };
