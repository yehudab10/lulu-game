// features/life — 👣 FOOTSTEPS that change with the ground under her: a crisp tap on the sidewalk, a duller one on
// the asphalt, a swish through grass, crunchy gravel on the verge, splashy steps once it's rained (and a real
// splash in a puddle), a crunch in the snow, a metal clonk up on a car's hood / roof, a hollow knock on a bench.
// Timed like her walk cycle (core/people.js: the legs swing at 2.2 + 2.4·speed rad/s, a step every half turn).
import { ctx } from "../../core/ctx.js";
import { L, stats, soundsOn } from "./common.js";
import { play } from "./sounds.js";
import { puddleAt, footSplash } from "./puddles.js";

const S = { phase: 0, surf: "concrete", surfT: 0, last: "", wasAir: false };
const PTS = Array.from({ length: 12 }, () => ({ x: 0, y: 0, z: 0 }));
let pi = 0;
/** A pooled point (a one-shot's target is read every frame: each sound gets its own). */
export function point(x, y, z) { const p = PTS[pi++ % PTS.length]; p.x = x; p.y = y; p.z = z; return p; }

export const KIND = { concrete: "lifeStep", asphalt: "lifeStep", grass: "lifeStepGrass", gravel: "lifeStepGravel", mud: "lifeStepGrass",
    wet: "lifeStepWet", puddle: "lifeSplash", snow: "lifeStepSnow", metal: "lifeStepMetal", wood: "lifeStepWood" };
export const RATE = { concrete: 1.08, asphalt: 0.9, grass: 1, gravel: 1, mud: 0.7, wet: 1, puddle: 1.15, snow: 1, metal: 1, wood: 1 };

/** What's under her right now (cached a few times a second: a town's street lookup isn't free). */
function ground() {
    const F = ctx.foot;
    const h = F.ground || 0;
    if (h > 0.3) return h > 0.85 ? "metal" : "wood";          // a parked car's hood / roof · a bench, a lawn chair
    if (puddleAt(L.x, L.z) > 0.25) return "puddle";
    let s = "asphalt";
    if (L.town && ctx.town.hideSpot) {
        const r = ctx.town.hideSpot(L.x, L.z);
        const k = r && r.spot;
        s = k === "walk" ? "concrete" : k === "yard" || k === "mall" ? "grass" : "asphalt";
    } else {
        const z = F.bounds && F.bounds.zone;
        s = z === "grass" ? "grass" : z === "mud" ? "mud" : z === "verge" ? "gravel" : z === "grounds" ? "concrete" : "asphalt";
        if (/desert/.test(L.biome) && (s === "grass" || s === "mud")) s = "gravel";
    }
    if (L.snow && s !== "metal") return "snow";
    if ((s === "concrete" || s === "asphalt") && L.wet > 0.35) return "wet";
    return s;
}

export function tickSteps(dt) {
    const F = ctx.foot;
    if (!L.foot || !F || !F.pos) { S.phase = 0; return; }
    const air = !!F.airborne;
    S.surfT -= dt;
    if (S.surfT <= 0) { S.surfT = 0.22; try { S.surf = ground(); } catch (e) { S.surf = "asphalt"; } }
    if (air) { S.wasAir = true; return; }
    if (S.wasAir) { S.wasAir = false; S.phase = 0; return; }      // (the landing has its own thud — foot's)
    const v = L.speed;
    if (v < 0.4) { S.phase = 0; return; }
    const before = S.phase;
    S.phase += dt * (2.2 + v * 2.4);
    if (Math.floor(before / Math.PI) === Math.floor(S.phase / Math.PI)) return;
    // a step
    stats.steps++;
    stats.stepKinds[S.surf] = (stats.stepKinds[S.surf] || 0) + 1;
    S.last = S.surf;
    if (S.surf === "puddle") footSplash(v);
    if (!soundsOn() || L.quiet) return;
    const run = v > 5.5;
    play(KIND[S.surf] || "lifeStep", point(L.x, 0.05, L.z), { gain: (run ? 1.15 : 0.85) * (0.85 + Math.random() * 0.3), rate: RATE[S.surf] * (0.92 + Math.random() * 0.16) });
}
export function stepInfo() { return { surf: S.surf, last: S.last }; }
