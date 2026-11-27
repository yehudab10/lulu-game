// 🎨 LOOK TEST (ci/looktest) — how far the look can go IN PLACE, before anyone rebuilds the game in another engine.
// Everything here sleeps unless the page is opened with ?look=2 — no flag = today's game, byte for byte the same
// (no models loaded, no hooks, no settings touched; saves and multiplayer are never written to).
//
//   ?look=2              all of it: the improved car, the skinned Lulu (real walk / run / idle cycles), the light
//   ?look=2&car=kenney   the car is Kenney's CC0 sedan fitted to the game instead (car=0: today's car; car=lite: the lite one everywhere)
//   ?look=2&lulu=0       today's Lulu on foot        ?look=2&light=0   today's light        ?look=2&glow=0  no bloom
//   ?look=2&soft=0       today's (sharper) shadows     ?look=2&sky=all  the sky light on MEDIUM too (default: HIGH only)
//   ?look=2&glow=medium  the bloom on MEDIUM too (default: only HIGH, as today)
//
// BY GRAPHICS TIER (the owner: "must still be optimized to work well on devices"):
//   LOW (weak phones)  the improved car, LITE, for the car she drives only (other copies: today's car), the skinned Lulu (≤ 3 at once — her + 2 friends; the
//                      animation updated less often far away, shadow in one draw), truer colours
//   MEDIUM (phones)    ≤ 10 skinned Lulus, + the FULL car for the one she drives (other copies stay lite), softer shadow edges (PCF, no extra draws)
//   HIGH (laptops)     + the sky lights everything (+ HIGH's existing bloom on windows / lamps)
//
// The pictures, clips and costs: 3d/docs/looktest/README.md (made by scripts/looktest/*.js).
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { models, registerModels, modelClips } from "../../models.js";
import { TIERS } from "../../core/quality.js";
import { skyEnvTexture } from "../../core/gfx.js";
import { setPersonFactory } from "../../core/people.js";
import { lookPerson } from "./person.js";
import { PlayerCar } from "../../car.js";

const Q = new URLSearchParams(location.search);
const ON = Q.get("look") === "2";
const want = (k, def = "1") => (Q.get(k) || def) !== "0";

export const LOOK = { on: ON, car: ON ? (Q.get("car") || "good") : "0", lulu: ON && want("lulu"), light: ON && want("light"), glow: ON && Q.get("glow") === "medium",
    soft: ON && want("soft"), skyAll: ON && Q.get("sky") === "all", lite: ON && Q.get("car") === "lite" };
ctx.look = LOOK;

if (ON) {
    // ── 1. the car: models.lulu hands out the chosen model (the real one stays underneath) ──
    //    By tier: the car she DRIVES is the full model on MEDIUM / HIGH; every other copy of it (her parked cars,
    //    friends' cars, the dealer lots, the crowd test's 12) is the LITE one on LOW / MEDIUM — 14.6k triangles
    //    instead of 26.9k (today's: 9.3k). Twelve full ones on a weak phone more than doubled the frame.
    const CAR = { good: "looktest_car", lite: "looktest_car", kenney: "looktest_kenney" }[LOOK.car];
    if (CAR) {
        registerModels(LOOK.car !== "kenney" ? { looktestCar: CAR, looktestCarLite: "looktest_car_lite" } : { looktestCar: CAR }, { preload: true });
        let real = null, driving = 0;
        const setSkin = PlayerCar.prototype.setSkin;
        PlayerCar.prototype.setSkin = function () { driving++; try { return setSkin.apply(this, arguments); } finally { driving--; } };
        Object.defineProperty(models, "lulu", {
            configurable: true, enumerable: true,
            get() {
                const full = models.looktestCar, lite = models.looktestCarLite || full, tier = ctx.gfx ? ctx.gfx.tier : "high";
                if (tier === "low" && !driving && real) return real;       // (weak phones: other copies stay today's car)
                const wantFull = !LOOK.lite && (tier === "high" || (tier === "medium" && driving > 0));
                return (wantFull ? full : lite) || full || real;
            },
            set(v) { real = v; },
        });
    }
    // ── 2. Lulu on foot: a skinned Lulu for the plain (sheitel) Lulu ──
    if (LOOK.lulu) {
        on("boot", () => { if (ctx.lights && ctx.lights.sun) ctx.lights.sun.shadow.camera.layers.enable(1); });   // (person.js › shadowCaster)
        registerModels({ looktestLulu: "looktest_lulu" }, { preload: true });
        // a BUDGET of skinned Lulus by tier (her, then friends — whoever is spawned first): the rest are today's
        // stiff Lulu. Skinning is per vertex every frame; on a weak phone 30 skinned people cost +39 % of a frame.
        const CAP = { low: 3, medium: 10, high: 64 }, live = new Set();
        setPersonFactory((key, opts, dresser) => {
            if (key !== "luluPerson" || !models.looktestLulu) return null;
            for (const o of live) if (!o.parent) live.delete(o);
            if (live.size >= (CAP[ctx.gfx ? ctx.gfx.tier : "high"] || 10)) return null;
            const p = lookPerson(models.looktestLulu, modelClips("looktestLulu"), opts, dresser);
            live.add(p.obj);
            return p;
        });
    }
    // ── 3. the light, by tier (see the top) ──
    if (LOOK.glow) TIERS.medium.post = true;          // (opt-in only: the bloom costs ~30 % of a frame in the software-GL measurements)
    if (LOOK.light) on("boot", lightUp);
}

const L = { env: null, base: 0, set: -1 };
function lightUp() {
    const r = ctx.renderer, sc = ctx.scene, li = ctx.lights;
    if (!r || !sc || !li) return;
    // softer, wider shadow edges (&soft=0: today's). PCF with a wider radius: the same 9-ish samples a pixel as today's
    // PCFSoft and NO extra draws. (Variance shadow maps were tried first: smoother, but three draws every shadow
    // RECEIVER into the shadow map with them — 36 → 95 shadow draws driving, 28 → 142 on foot — so they're out.)
    if (LOOK.soft) {
        r.shadowMap.type = THREE.PCFShadowMap;
        li.sun.shadow.radius = 2.5;
        sc.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    // tone: keep the pinks pink (ACES pushes saturated reds toward orange and flattens the brights)
    r.toneMapping = THREE.NeutralToneMapping;
    li.sun.color.lerp(new THREE.Color("#ffe2bd"), 0.35);      // a warmer sun against the cooler sky fill
}
// every frame, cheaply: the sky's environment map (already made for the car paint on MEDIUM / HIGH) lights the whole
// scene — soft sky fill from above, the ground's bounce from below, the sky in anything glossy
if (LOOK.light) hook("prerender", () => {
    const sc = ctx.scene, li = ctx.lights;
    const tier = ctx.gfx ? ctx.gfx.tier : "high";
    const env = tier === "high" || (LOOK.skyAll && tier === "medium") ? skyEnvTexture() : null;   // (LOW has no sky map at all)
    if (env !== L.env) { sc.environment = env; L.env = env; }
    // the sky's light now comes from the environment: the flat hemisphere fill steps back so nothing is lit twice
    if (li && li.hemi) {
        if (Math.abs(li.hemi.intensity - L.set) > 1e-4) L.base = li.hemi.intensity;   // (atmos / a set changed it)
        L.set = li.hemi.intensity = L.base * (env ? 0.7 : 1);
    }
    sc.environmentIntensity = env ? 0.6 : 1;
});
