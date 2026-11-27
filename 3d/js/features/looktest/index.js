// 🎨 LOOK TEST (ci/looktest) — how far the look can go IN PLACE, before anyone rebuilds the game in another engine.
// Everything here sleeps unless the page is opened with ?look=2 — no flag = today's game, byte for byte the same
// (no models loaded, no hooks, no settings touched; saves and multiplayer are never written to).
//
//   ?look=2              all of it: the improved car, the skinned Lulu (real walk / run / idle cycles), the light
//   ?look=2&car=kenney   the car is Kenney's CC0 sedan fitted to the game instead (car=0: today's car)
//   ?look=2&lulu=0       today's Lulu on foot        ?look=2&light=0   today's light        ?look=2&glow=0  no bloom
//
// The pictures, clips and costs: 3d/docs/looktest/README.md (made by scripts/looktest/*.js).
import * as THREE from "three";
import { ctx, on, hook } from "../../core/ctx.js";
import { models, registerModels, modelClips } from "../../models.js";
import { TIERS } from "../../core/quality.js";
import { skyEnvTexture } from "../../core/gfx.js";
import { setPersonFactory } from "../../core/people.js";
import { lookPerson } from "./person.js";

const Q = new URLSearchParams(location.search);
const ON = Q.get("look") === "2";
const want = (k, def = "1") => (Q.get(k) || def) !== "0";

export const LOOK = { on: ON, car: ON ? (Q.get("car") || "good") : "0", lulu: ON && want("lulu"), light: ON && want("light"), glow: ON && want("glow") };
ctx.look = LOOK;

if (ON) {
    // ── 1. the car: models.lulu hands out the chosen model (the real one stays underneath) ──
    const CAR = { good: "looktest_car", kenney: "looktest_kenney" }[LOOK.car];
    if (CAR) {
        registerModels({ looktestCar: CAR }, { preload: true });
        let real = null;
        Object.defineProperty(models, "lulu", {
            configurable: true, enumerable: true,
            get() { return models.looktestCar || real; },
            set(v) { real = v; },
        });
    }
    // ── 2. Lulu on foot: a skinned Lulu for the plain (sheitel) Lulu ──
    if (LOOK.lulu) {
        registerModels({ looktestLulu: "looktest_lulu" }, { preload: true });
        setPersonFactory((key, opts, dresser) => (key === "luluPerson" && models.looktestLulu ? lookPerson(models.looktestLulu, modelClips("looktestLulu"), opts, dresser) : null));
    }
    // ── 3. the light: the sky lights everything (not just the car paint), softer shadows, a little glow on MEDIUM ──
    if (LOOK.glow) TIERS.medium.post = true;          // (HIGH already has it; LOW stays as it is: no post on the weakest phones)
    if (LOOK.light) on("boot", lightUp);
}

const L = { env: null, base: 0, set: -1 };
function lightUp() {
    const r = ctx.renderer, sc = ctx.scene, li = ctx.lights;
    if (!r || !sc || !li) return;
    // softer, wider shadow edges (variance shadow maps blur the edge; PCF only dithers it)
    r.shadowMap.type = THREE.VSMShadowMap;
    li.sun.shadow.radius = 5;
    li.sun.shadow.blurSamples = 10;
    li.sun.shadow.bias = -0.0006;
    sc.traverse(o => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; });
    // tone: keep the pinks pink (ACES pushes saturated reds toward orange and flattens the brights)
    r.toneMapping = THREE.NeutralToneMapping;
    li.sun.color.lerp(new THREE.Color("#ffe2bd"), 0.35);      // a warmer sun against the cooler sky fill
}
// every frame, cheaply: the sky's environment map (already made for the car paint on MEDIUM / HIGH) lights the whole
// scene — soft sky fill from above, the ground's bounce from below, the sky in anything glossy
if (LOOK.light) hook("prerender", () => {
    const sc = ctx.scene, li = ctx.lights;
    const env = skyEnvTexture();
    if (env !== L.env) { sc.environment = env; L.env = env; }
    // the sky's light now comes from the environment: the flat hemisphere fill steps back so nothing is lit twice
    if (li && li.hemi) {
        if (Math.abs(li.hemi.intensity - L.set) > 1e-4) L.base = li.hemi.intensity;   // (atmos / a set changed it)
        L.set = li.hemi.intensity = L.base * (env ? 0.7 : 1);
    }
    sc.environmentIntensity = 0.6;
});
