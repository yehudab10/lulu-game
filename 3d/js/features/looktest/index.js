// 🎨 LOOK TEST (ci/looktest) — how far the look can go IN PLACE, before anyone rebuilds the game in another engine.
// Everything here sleeps unless the page is opened with ?look=2 — no flag = today's game, byte for byte the same
// (no models loaded, no hooks, no panel, no settings touched; saves and multiplayer are never written to).
//
//   ?look=2              the improved car, the skinned Lulu (real walk / run / idle cycles), the light — by graphics tier
//   &car=kenney | lite | 0      Kenney's CC0 sedan fitted · the LITE build everywhere · today's car
//   &lulu=0              today's Lulu on foot          &soft=0   today's (sharper) shadow edges
//   &light=0 | lite | full      today's light · LITE SKY (the sky lights cars + people only, + the glow on MEDIUM) ·
//                               FULL SKY (the sky lights everything, + the glow, on MEDIUM too). Default: NEW (by tier, below)
//   &time=noon | golden | dusk | night   pin the time of day (applies while she drives; atmos' clock)
//   &tier=low | medium | high   force the graphics level for this page only (never saved) — the phone / laptop versions
//                               on whatever device; the panel's 🖥️ Level button cycles it live
// With the flag a small 🎨 panel (panel.js) flips each piece live (TODAY ↔ NEW), cycles the light and the time, and
// shows the frames per second (averaged over 2 s) — for the owner to compare on a real phone.
//
// BY GRAPHICS TIER (the owner: "must still be optimized to work well on devices") — the NEW defaults:
//   LOW (weak phones)  the improved car, LITE, for the car she drives only (other copies: today's car), the skinned Lulu
//                      (≤ 3 at once — her + 2 friends; animation updated less often far away, shadow in one draw), truer colours
//   MEDIUM (phones)    ≤ 10 skinned Lulus, + the FULL car for the one she drives (other copies stay lite), softer shadow edges
//   HIGH (laptops)     + the sky lights everything (+ HIGH's existing bloom on windows / lamps)
//
// The pictures, clips and costs: 3d/docs/looktest/README.md (made by scripts/looktest/*.js).
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { models, registerModels, modelClips } from "../../models.js";
import { TIERS, forceTier } from "../../core/quality.js";
import { skyEnvTexture } from "../../core/gfx.js";
import { setPersonFactory, spawnPerson } from "../../core/people.js";
import { shared } from "../../core/save.js";
import { lookPerson } from "./person.js";
import { PlayerCar } from "../../car.js";
import { makePanel } from "./panel.js";

const Q = new URLSearchParams(location.search);
const ON = Q.get("look") === "2";
const want = (k, def = "1") => (Q.get(k) || def) !== "0";
const LIGHTS = ["off", "new", "lite", "full"];
const q0 = Q.get("light");

export const LOOK = { on: ON, car: ON ? (Q.get("car") || "good") : "0", lulu: ON && want("lulu"), soft: ON && want("soft"), lite: ON && Q.get("car") === "lite",
    lightMode: !ON ? "off" : q0 === "0" ? "off" : q0 === "lite" || q0 === "full" ? q0 : "new" };
Object.defineProperty(LOOK, "light", { get: () => LOOK.lightMode !== "off" });
/** What's on right now (the panel flips these live). */
export const LIVE = { car: LOOK.car !== "0", lulu: LOOK.lulu, light: LOOK.lightMode, time: ON ? (Q.get("time") || "") : "",
    tier: ON && TIERS[Q.get("tier")] ? Q.get("tier") : "" };
LOOK.live = LIVE;
ctx.look = LOOK;

if (ON) {
    if (LIVE.tier) forceTier(LIVE.tier);      // (before boot's first applySettings)
    // ── 1. the car: models.lulu hands out the chosen model (the real one stays underneath) ──
    //    By tier: the car she DRIVES is the full model on MEDIUM / HIGH; every other copy of it (her parked cars,
    //    friends' cars, the dealer lots, the crowd test's 12) is the LITE one on LOW / MEDIUM — 14.6k triangles
    //    instead of 26.9k (today's: 9.3k). Twelve full ones on a weak phone more than doubled the frame.
    const CAR = LOOK.car === "kenney" ? "looktest_kenney" : "looktest_car";      // (car=0 still loads it: the panel can flip it on)
    if (CAR) {
        registerModels(LOOK.car !== "kenney" ? { looktestCar: CAR, looktestCarLite: "looktest_car_lite" } : { looktestCar: CAR }, { preload: true });
        let real = null, driving = 0;
        const setSkin = PlayerCar.prototype.setSkin;
        PlayerCar.prototype.setSkin = function () { driving++; try { return setSkin.apply(this, arguments); } finally { driving--; } };
        Object.defineProperty(models, "lulu", {
            configurable: true, enumerable: true,
            get() {
                if (!LIVE.car && real) return real;
                const full = models.looktestCar, lite = models.looktestCarLite || full, tier = ctx.gfx ? ctx.gfx.tier : "high";
                if (tier === "low" && !driving && real) return real;       // (weak phones: other copies stay today's car)
                const wantFull = !LOOK.lite && (tier === "high" || (tier === "medium" && driving > 0));
                return (wantFull ? full : lite) || full || real;
            },
            set(v) { real = v; },
        });
    }
    // ── 2. Lulu on foot: a skinned Lulu for the plain (sheitel) Lulu (lulu=0 still loads it: the panel can flip it on) ──
    {
        on("boot", () => { if (ctx.lights && ctx.lights.sun) ctx.lights.sun.shadow.camera.layers.enable(1); });   // (person.js › shadowCaster)
        registerModels({ looktestLulu: "looktest_lulu" }, { preload: true });
        // a BUDGET of skinned Lulus by tier (her, then friends — whoever is spawned first): the rest are today's
        // stiff Lulu. Skinning is per vertex every frame; on a weak phone 30 skinned people cost +39 % of a frame.
        const CAP = { low: 3, medium: 10, high: 64 }, live = new Set();
        setPersonFactory((key, opts, dresser) => {
            if (!LIVE.lulu || key !== "luluPerson" || !models.looktestLulu) return null;
            for (const o of live) if (!o.parent) live.delete(o);
            if (live.size >= (CAP[ctx.gfx ? ctx.gfx.tier : "high"] || 10)) return null;
            const p = lookPerson(models.looktestLulu, modelClips("looktestLulu"), opts, dresser);
            live.add(p.obj);
            return p;
        });
    }
    // ── 3. the light ──
    on("boot", () => { applyLight(); makePanel(LOOK, LIVE, { car: flipCar, lulu: flipLulu, light: applyLight, time: pinTime, tier: setTier }); });
}

// ── live flips (the panel) ─────────────────────────────────────────────────────────────────────────────────────
function flipCar() {
    const car = ctx.car;
    if (car && car.setSkin) { try { car.setSkin(car.skinKey); } catch (e) { console.error("[looktest] car", e); } }
}
/** Swap the Lulu on foot in place (as foot's own disguise booth does) — only the plain-sheitel Lulu, never in a disguise. */
function flipLulu() {
    const F = ctx.foot && ctx.foot.debug && ctx.foot.debug.F;
    if (!F || !F.lulu || !F.lulu.obj || !F.lulu.obj.parent || F.disguise) return;
    const style = shared.get().luluHairStyle;
    if (style && style !== "sheitel") return;
    const old = F.lulu, colors = {};
    old.obj.traverse(o => { if (o.isMesh && o.material && o.material.name === "Hair" && !colors.Hair) colors.Hair = "#" + o.material.color.getHexString(); });
    const p = spawnPerson("luluPerson", { colors });
    p.obj.rotation.order = "YXZ";
    p.obj.position.copy(old.obj.position);
    p.obj.rotation.copy(old.obj.rotation);
    old.obj.parent.add(p.obj);
    old.obj.parent.remove(old.obj);
    F.lulu = p;
}
/** The graphics level for this page ("" = the player's own setting): the renderer, shadows, draw distance, bloom follow;
 *  her car is rebuilt so the full / lite choice follows too. */
function setTier() {
    forceTier(LIVE.tier || null);
    if (ctx.applySettings) ctx.applySettings();
    flipCar();
}
const TIMES = { noon: "noon", golden: "golden", dusk: "dusk", night: "night" };
function pinTime() {
    const A = ctx.atmos && ctx.atmos.debug;
    if (!A) return;
    if (TIMES[LIVE.time]) { A.time(TIMES[LIVE.time]); A.freeze(true); } else A.freeze(false);
}

// ── the light: TODAY (off) · NEW (by tier) · LITE SKY · FULL SKY — all reversible, live ──────────────────────────
const L = { saved: null, env: null, base: 0, set: -1, sunBase: new THREE.Color(), sunSet: new THREE.Color(-1, -1, -1), scanT: 0, tagged: new Set(), pinT: 0 };
const WARM = new THREE.Color("#ffe2bd");
const PEOPLE = /^(Skin|Hair|Top|Bottom|Shoes|Tights|Shirt|Seat)$/;
function applyLight() {
    const r = ctx.renderer, sc = ctx.scene, li = ctx.lights;
    if (!r || !sc || !li) return;
    if (!L.saved) L.saved = { tone: r.toneMapping, type: r.shadowMap.type, radius: li.sun.shadow.radius, post: TIERS.medium.post };
    const mode = LIVE.light, on = mode !== "off";
    // tone: keep the pinks pink (ACES pushes saturated reds toward orange and flattens the brights)
    r.toneMapping = on ? THREE.NeutralToneMapping : L.saved.tone;
    // softer, wider shadow edges: PCF with a wider radius — the same 9-ish samples a pixel as today's PCFSoft and NO
    // extra draws. (Variance shadow maps were tried first: smoother, but three draws every shadow RECEIVER into the
    // shadow map with them — 36 → 95 shadow draws driving, 28 → 142 on foot — so they're out.)
    const type = on && LOOK.soft ? THREE.PCFShadowMap : L.saved.type;
    if (r.shadowMap.type !== type) {
        r.shadowMap.type = type;
        li.sun.shadow.radius = on && LOOK.soft ? 2.5 : L.saved.radius;
        sc.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    }
    // the glow on MEDIUM (LITE / FULL SKY only; HIGH has it already, LOW never)
    const post = mode === "lite" || mode === "full" ? true : L.saved.post;
    if (TIERS.medium.post !== post) { TIERS.medium.post = post; if (ctx.applySettings) ctx.applySettings(); }
    if (mode !== "lite") untag();
}
function untag() {
    for (const m of L.tagged) { m.envMap = null; m.needsUpdate = true; }
    L.tagged.clear();
}
// every frame, cheaply: which sky light, the hemisphere fill stepping back where the sky lights everything, a warmer
// sun, the pinned time of day
if (ON) hook("prerender", dt => {
    const sc = ctx.scene, li = ctx.lights, mode = LIVE.light;
    if (!sc || !li) return;
    const tier = ctx.gfx ? ctx.gfx.tier : "high", sky = skyEnvTexture();    // (LOW has no sky map at all)
    const env = mode === "full" || (mode === "new" && tier === "high") ? sky : null;
    if (env !== L.env) { sc.environment = env; L.env = env; }
    sc.environmentIntensity = env ? 0.6 : 1;
    if (li.hemi) {
        if (Math.abs(li.hemi.intensity - L.set) > 1e-4) L.base = li.hemi.intensity;   // (atmos / a set changed it)
        L.set = li.hemi.intensity = L.base * (env ? 0.7 : 1);
    }
    if (li.sun) {
        if (!li.sun.color.equals(L.sunSet)) L.sunBase.copy(li.sun.color);
        li.sun.color.copy(L.sunBase);
        if (mode !== "off") li.sun.color.lerp(WARM, 0.35);
        L.sunSet.copy(li.sun.color);
    }
    // LITE SKY: the sky's light on cars + people only (their materials get the sky map, like the car paint already does)
    if (mode === "lite" && sky) {
        L.scanT -= dt || 0;
        if (L.scanT <= 0) {
            L.scanT = 1.5;
            const car = ctx.car && ctx.car.model;
            const tag = m => {
                if (!m || !m.isMeshStandardMaterial) return;
                if (m.envMap && !L.tagged.has(m)) return;                     // (gfx.js already lit the car paint)
                if (!L.tagged.has(m)) { m.envMapIntensity = 0.6; m.needsUpdate = true; L.tagged.add(m); }
                m.envMap = sky;
            };
            if (car) car.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) tag(m); });
            sc.traverse(o => { if (o.isMesh && o.material && !Array.isArray(o.material) && PEOPLE.test(o.material.name || "")) tag(o.material); });
        }
        for (const m of L.tagged) if (m.envMap !== sky) m.envMap = sky;
    }
    if (TIMES[LIVE.time] && (L.pinT -= dt || 0) <= 0) { L.pinT = 1; pinTime(); }
});
