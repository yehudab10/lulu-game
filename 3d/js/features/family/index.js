// ─────────────────────────────────────────────────────────────────────────
//  features/family — 👨‍👩‍👧 MORE OF LULU'S FAMILY (roadmap 32, the owner 2026-11-27).
//
//   fayge.js   Fayge (her older married sister), Ash + Chani (2): a basement apartment on East 15th St in Midwood (a
//              household on features/homes' life engine — ctx.homes.addHousehold), Fayge's day out in the town
//              (Morah Leah's playgroup on Avenue L in the mornings; errands with the stroller in the afternoons; Ima's),
//              sister banter tied to features/decor's move-out days, Chani's whole vocabulary, two tiny capped jobs.
//   data.js    every name, hour, line and number.
//
//  avigail.js — 💜 Avigail at home (East 34th St, L → K: the porch visit at her door, a ride once a run) + the Avenue M
//              Ballroom (her wedding on the hall's evenings; the bouquet pays once a real day).
//  couple.js / couple-data.js — 🤫 Shloime + Toby, the secret couple: six beats out in the world, one a real day.
//
//  ctx.family { where() → { where, scene, ash }, isFamily(x, z), fayge, secret, debug }
//  Events: family:place {where} · family:knock · family:talk · family:chani · family:circle {paid} · family:bags {paid}
//  Stats: familyVisits, familyCircle
// ─────────────────────────────────────────────────────────────────────────
import { ctx, on } from "../../core/ctx.js";
import { F, SAVE, init, now, isFamily, placeOf, talk, live } from "./fayge.js";
import { FAYGE, dayOf } from "./data.js";
import { stroller } from "./fayge.js";
import { CP, COUPLE, COUPLE_SPOT, beatNow, play, initCouple, setStroller } from "./couple.js";
import { BEATS } from "./couple-data.js";
import { A as AVA, initAvigail, isAvigails, avDay, hallNow, porch as avPorch, hall as avHall } from "./avigail.js";

ctx.family = {
    /** Where Fayge is right now: { where: "home" | "playgroup" | "makolet" | "bakery" | "clothes" | "ima" | "walk" | "away", scene, ash } */
    where: () => { const d = now(); return { where: d.where, scene: d.scene, ash: d.ash }; },
    /** Fayge's house (the landlords' front door or her own side door) — features/realestate never lists it. */
    isFamily: (x, z) => isFamily(x, z) || isAvigails(x, z),
    /** 💜 Avigail: where she is now ("home" | "salon" | "shopping" | "hall" | "asleep" | "parents" | "busy") + what's on at the hall. */
    avigail: () => ({ where: avDay(), hall: hallNow(), door: AVA.home ? Object.assign({}, AVA.home.ap) : null, rode: AVA.ride.rode, pending: AVA.ride.pending }),
    get fayge() { return F.fay ? { x: F.fay.obj.position.x, z: F.fay.obj.position.z, where: F.where } : null; },
    /** 🤫 Shloime + Toby: how far the secret has got ({ n: beats done of BEATS.length, day }). */
    get secret() { return { n: COUPLE.n, of: BEATS.length, day: COUPLE.day }; },
    debug: {
        couple: {
            C: COUPLE, CP, force: CP.force, play, beat: () => (CP.beat ? CP.beat.id : null), now: () => { const b = beatNow(); return b ? b.id : null; },
            at: () => CP.at && { x: CP.at.x, z: CP.at.z, nx: CP.at.nx, nz: CP.at.nz }, extra: () => (CP.extra ? CP.extra.key : null),
            spot: () => !!COUPLE_SPOT.pos(), who: () => { const o = Object.values(CP.ppl)[0]; return o ? { x: o.obj.position.x, z: o.obj.position.z } : null; }, label: () => (CP.beat ? CP.beat.label : null),
            reset() { COUPLE.n = 0; COUPLE.day = ""; COUPLE.cover = []; COUPLE.picks = []; CP.ride = null; return true; },
            nextDay() { COUPLE.day = ""; return true; },
        },
        avigail: { A: AVA, force: AVA.force, porch: avPorch, hall: avHall },
        F, SAVE, FAYGE, dayOf, placeOf, talk, live, force: F.force, home: () => F.home && { key: F.home.key, ap: Object.assign({}, F.home.ap), door: Object.assign({}, F.home.door) } },
};
on("boot", () => { init(); initCouple(); setStroller(stroller); initAvigail(); });
