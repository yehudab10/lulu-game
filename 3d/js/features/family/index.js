// ─────────────────────────────────────────────────────────────────────────
//  features/family — 👨‍👩‍👧 MORE OF LULU'S FAMILY (roadmap 32, the owner 2026-11-27).
//
//   fayge.js   Fayge (her older married sister), Ash + Chani (2): a basement apartment on East 15th St in Midwood (a
//              household on features/homes' life engine — ctx.homes.addHousehold), Fayge's day out in the town
//              (Morah Leah's playgroup on Avenue L in the mornings; errands with the stroller in the afternoons; Ima's),
//              sister banter tied to features/decor's move-out days, Chani's whole vocabulary, two tiny capped jobs.
//   data.js    every name, hour, line and number.
//
//  ctx.family { where() → { where, scene, ash }, isFamily(x, z), visit(), debug }
//  Events: family:place {where} · family:knock · family:talk · family:chani · family:circle {paid} · family:bags {paid}
//  Stats: familyVisits, familyCircle
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on } from "../../core/ctx.js";
import { F, SAVE, init, now, isFamily, placeOf, talk, live } from "./fayge.js";
import { FAYGE, dayOf } from "./data.js";

ctx.family = {
    /** Where Fayge is right now: { where: "home" | "playgroup" | "makolet" | "bakery" | "clothes" | "ima" | "walk" | "away", scene, ash } */
    where: () => { const d = now(); return { where: d.where, scene: d.scene, ash: d.ash }; },
    /** Fayge's house (the landlords' front door or her own side door) — features/realestate never lists it. */
    isFamily,
    get fayge() { return F.fay ? { x: F.fay.obj.position.x, z: F.fay.obj.position.z, where: F.where } : null; },
    debug: { F, SAVE, FAYGE, dayOf, placeOf, talk, live, force: F.force, home: () => F.home && { key: F.home.key, ap: Object.assign({}, F.home.ap), door: Object.assign({}, F.home.door) } },
};
on("boot", () => init());
