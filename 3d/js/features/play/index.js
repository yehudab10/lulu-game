// ─────────────────────────────────────────────────────────────────────────
//  features/play — the playground: "more interactive, more beauty, more fun".
//
//   📸 photo.js     Photo mode (pause menu + title): free orbit camera, filters,
//                   frames (postcard / hearts / polaroid / WANTED), Lulu poses,
//                   save a PNG, a little album of the last 6 shots
//   ✨ dreidels.js  Golden Dreidels on the road: run counter chip, lifetime
//                   total, a CHAI! reward every 18 (coins, confetti, golden trail)
//   🛹 ramps.js     Stunt ramps: visual jump arc, swooping camera, slow-mo,
//                   mid-air spins, LEAPFROG over traffic, springy landings
//   spots.js        where dreidels / ramps / parked trucks go in each road chunk
//   poses.js        Lulu's photo poses · frames.js the photo looks · fx.js confetti + sparkles
//
//  Random roadside content is gated by ctx.enabled("play") (tests opt in with
//  ?test&enable=play). Service for tests / other features: ctx.play.
// ─────────────────────────────────────────────────────────────────────────
import { ctx, hook } from "../../core/ctx.js";
import { LANES_OURS } from "../../world.js";
import { SAVE } from "./common.js";
import { list as dreidels, addDreidelAt, collect } from "./dreidels.js";
import { J, ramps, RAMP } from "./ramps.js";
import { placeRamp, placeTruck, chunkAt } from "./spots.js";
import { photo, openPhoto } from "./photo.js";
import { poseDebug } from "./poses.js";

const lane = d => LANES_OURS.reduce((a, l) => Math.abs(l - d) < Math.abs(a - d) ? l : a, LANES_OURS[0]);
const kAt = s => { const ch = chunkAt(s); return ch ? ch.k : -1; };

ctx.play = {
    /** Lifetime golden dreidels. */
    get dreidels() { return SAVE.dreidels; },
    get save() { return SAVE; },
    /** The jump: { y, air, airT, spin, leaps, jumps, lastAir, lastSpin, lastClean, … } */
    jump: J,
    photo,
    openPhoto,
    debug: {
        /** n golden dreidels in a line `ahead` metres in front of the car (lane d, default: her lane). */
        spawnDreidels(ahead = 30, d = null, n = 5, gap = 6, kind = "line", y = 0.35) {
            const car = ctx.car, dd = d == null ? lane(car.d) : d;
            for (let i = 0; i < n; i++) { const s = car.s + ahead + i * gap; addDreidelAt(s, dd, kAt(s), kind, y); }
            return dreidels.length;
        },
        /** A stunt ramp `ahead` metres in front (centre), lane d (default: her lane). */
        spawnRamp(ahead = 50, d = null) {
            const s = ctx.car.s + ahead, ch = chunkAt(s);
            return !!placeRamp(ch, ctx.world, s, d == null ? lane(ctx.car.d) : d, ch ? ch.k : -1);
        },
        /** A parked truck on the right shoulder with its tucked-away dreidels. */
        spawnTruck(ahead = 60) {
            const s = ctx.car.s + ahead, ch = chunkAt(s);
            if (ch) placeTruck(ch, ctx.world, s, ch.k);
            return !!ch;
        },
        collectNext() { const d = dreidels.find(x => !x.taken); if (d) collect(d); return !!d; },
        pose: poseDebug,
        get dreidels() { return dreidels; },
        get ramps() { return ramps; },
        RAMP,
    },
};

// debug-spawned things that aren't tied to a built chunk go away with a new run
hook("runStart", () => { for (let i = dreidels.length - 1; i >= 0; i--) if (dreidels[i].k === -1) dreidels.splice(i, 1); });
