// features/cameos — CAMEOS IN A 🎉 PARTY.
//
// The solo timers (index.js) stay off with friends — instead the party's seeded road plan
// (ctx.party.road, shared with roadevents + hustle) says which cameo waits WHERE, and its
// spot on the verge is found with Math.random seeded from the party, so every friend drives
// past the same Avigail / Heshy's pool / uncle / sasquatch / Chez Fabio at the same s.
//
// What happens next is PERSONAL: pull up next to Avigail and the porch scene is yours (the
// world doesn't stop for anyone else — a party has no pause; your friends just see a
// "💅 at Avigail's" tag over your parked car via ctx.party.presence), the salon is yours,
// the uncle's quip, Heshy's splash shield and the sasquatch hitching a ride are yours. Two
// friends at the same cameo each get their own copy (no arbitration needed: nothing in a
// cameo is one-of-a-kind for the party). Rewards (coins, the 💜 meter, 2× points while
// Avigail rides) go to whoever earned them. Avigail's coupe stays out: it DRIVES, and
// party traffic is a pure function of the clock.
import { ctx, hook, on } from "../../core/ctx.js";
import { findSpot, stripClear } from "./common.js";
import { SHOULDER } from "../../world.js";
import * as AV from "./avigail.js";
import * as SL from "./salon.js";
import * as RS from "./roadside.js";

const CH = 200;
const P = { done: new Set(), log: [] };
const partyRun = () => !!(ctx.party && ctx.party.active && ctx.G.mode === "party");
const full = A => !!A && (A.k === "trip" || A.k === "roam");

// how far ahead each one is set up (the solo spawners' own distances)
const KINDS = {
    avigail: { w: 0.8, ahead: 260 },
    salon: { w: 0.6, ahead: 330 },
    heshy: { w: 0.7, ahead: 300 },
    uncle: { w: 0.6, ahead: 220 },
    sasquatch: { w: 0.45, ahead: 170 },
};
on("boot", () => {
    if (!ctx.party || !ctx.party.road) return;
    const kinds = {};
    for (const [k, def] of Object.entries(KINDS)) kinds[k] = A => (full(A) ? def.w : 0);
    ctx.party.road.claim("cameos", kinds);
});
on("run:start", () => { P.done.clear(); P.log.length = 0; });

/** The spot for slot sl, the same on every screen (seeded dice over the same chunks). */
function spotFor(sl) {
    const seeded = fn => ctx.party.seeded("cameo:" + sl.key, fn);
    switch (sl.kind) {
        case "salon": return seeded(() => {
            for (let k = 0; k < 8; k++) {
                const sp = findSpot(sl.s, sl.s + 140, 1, 21.5, 23, 8.5);
                if (sp && stripClear(sp.s - 7.5, sp.s + 7.5, SHOULDER + 0.6, sp.d - 4.5)) return sp;
            }
            return null;
        });
        case "heshy": return seeded(() => findSpot(sl.s, sl.s + 120, sl.side, 14, 16.5, 5.2));
        case "uncle": return seeded(() => findSpot(sl.s, sl.s + 60, sl.side, 10.6, 11.8, 2.2));
        case "sasquatch": return seeded(() => findSpot(sl.s, sl.s + 60, sl.side, 15, 20, 2.5));
        default: return null;
    }
}

function fire(sl) {
    P.done.add(sl.key);
    let p = null;
    if (sl.kind === "avigail") {
        if (AV.avigailOut() || AV.rideActive()) return;          // she's already with me (personal)
        p = AV.spawnAvigailWalker({ s: sl.s });
    } else {
        const spot = spotFor(sl);
        P.log.push({ key: sl.key, kind: sl.kind, s: Math.round(sl.s * 10) / 10, spot: spot ? [Math.round(spot.s * 10) / 10, Math.round(spot.d * 10) / 10] : null });
        if (!spot) return;
        if (sl.kind === "salon" && !SL.salonShopOut()) p = SL.spawnSalonShop({ spot });
        else if (sl.kind === "heshy" && !RS.heshyOut()) p = RS.spawnHeshy({ spot });
        else if (sl.kind === "uncle" && !RS.uncleOut()) p = RS.spawnUncle({ spot, id: RS.UNCLES[Math.floor(ctx.party.h01("uncle", sl.k) * RS.UNCLES.length)].id });
        else if (sl.kind === "sasquatch" && !RS.sasquatchOut()) p = RS.spawnSasquatch({ spot });
    }
    if (sl.kind === "avigail") P.log.push({ key: sl.key, kind: sl.kind, s: Math.round(sl.s * 10) / 10, spot: null });
    if (P.log.length > 60) P.log.shift();
    if (p && p.catch) p.catch(e => console.error("[cameos] party", sl.kind, e));
}

hook("update", (dt, _P, controlsOn) => {
    if (!partyRun() || !controlsOn || ctx.state !== "playing" || !ctx.enabled("cameos") || !ctx.party.road) return;
    if (ctx.cameos && ctx.cameos.auto === false) return;
    const car = ctx.car;
    for (let k = Math.floor((car.s - 40) / CH); k <= Math.floor((car.s + 400) / CH); k++) {
        const sl = ctx.party.road.slot(k);
        if (!sl || sl.id !== "cameos" || P.done.has(sl.key)) continue;
        const ahead = (KINDS[sl.kind] || {}).ahead || 250;
        if (sl.s - car.s < 40) { P.done.add(sl.key); continue; }      // too close to set up now: missed
        if (sl.s - car.s > ahead) continue;
        fire(sl);
    }
}, 3);

// a scene put me back on the road (porch, salon): friends see a hop, not a slide
on("cameos:resume", () => { if (partyRun() && ctx.party.respawned) ctx.party.respawned(); });

// friends see what I'm up to while a scene has me (other agent's ctx.party.presence — optional)
const SCENES = { cameosPorch: { mode: "scene", label: "on Avigail's porch", icon: "💅" }, cameosSalon: { mode: "scene", label: "at Chez Fabio's salon", icon: "💇" } };
on("state", ({ from, to }) => {
    if (!(ctx.party && ctx.party.active) || !ctx.party.presence) return;
    if (SCENES[to]) ctx.party.presence(SCENES[to]);      // (it lapses by itself when the state changes)
});

export const partyDebug = { log: P.log, done: P.done, spotFor };
