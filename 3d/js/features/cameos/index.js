// features/cameos — AVIGAIL (her coupe, the porch visit, the friendship meter),
// THE SALON (Chez Fabio + Lulu's hairstyles), the SASQUATCH, HESHY's pool, the
// UNCLES, THE CRASH AFTERMATH (every non-cop wreck) and THE ER.
//
// Services:  ctx.avigail { rel(), bump(d), label() }   ctx.er { admit(reason), visits() }
//            ctx.interiors.salon { name, emoji, enter({ exit }) }   (the foot feature's doors)
//            ctx.cameos { trigger(name, opts), auto, force }      (debug / tests)
// Events:    avigail:rel {rel, d} · stat {id: avigail3 | heshy2 | uncles3 | salon} · er:admit {reason, visits}
//            cameos:hair {color, style} · cameos:reprieve {kind} · cameos:crashEnd {how, cause} · cameos:resume
// Hooks:     wreck (priority 10) · update · runStart
// Random cameos follow the 2D SPAWN_CONFIG timings and are gated by ctx.enabled("cameos").
import { ctx, hook } from "../../core/ctx.js";
import { damage } from "../../core/driving.js";
import { SpawnTimers, SPAWN_CONFIG } from "./common.js";
import * as AV from "./avigail.js";
import * as SL from "./salon.js";
import * as RS from "./roadside.js";
import * as CR from "./crash.js";
import * as ER from "./er.js";

const T = new SpawnTimers(SPAWN_CONFIG);
hook("runStart", () => T.reset());
hook("update", (dt, P, controlsOn) => {
    if (!controlsOn || ctx.state !== "playing") return;
    if (!ctx.enabled("cameos") || ctx.cameos.auto === false) return;
    const t = ctx.G.runTime;
    if (T.tick("heshyPool", dt) && t > 12 && !RS.heshyOut()) RS.spawnHeshy();
    if (T.tick("avigailCar", dt) && t > 15 && !AV.avigailOut()) AV.spawnAvigailCar();
    if (T.tick("avigail", dt) && t > 18 && !AV.avigailOut() && !AV.rideActive()) AV.spawnAvigailWalker();
    if (T.tick("uncle", dt) && t > 15 && !RS.uncleOut()) RS.spawnUncle();
    if (T.tick("salon", dt) && t > 30 && !SL.salonShopOut()) SL.spawnSalonShop();
    if (T.tick("sasquatch", dt) && t > 35 && !RS.sasquatchOut()) RS.spawnSasquatch();
});

/** Make the next wreck happen for real (a car / an animal / a tree), for tests and debugging. */
function forceWreck(kind = "car") {
    const G = ctx.G;
    G.hearts = 1; G.invT = 0;
    if (kind === "car") {
        const car = ctx.car;
        for (const c of ctx.traffic.cars.slice()) ctx.traffic.remove(c);
        return ctx.traffic.add("sedan", car.s + 16, car.d, -1, 22);
    }
    const dmg = damage;
    if (dmg) return dmg(1, kind === "animal" ? "Justice for Gerald!" : "Lulu vs. a tree: the tree won", kind === "animal" ? "duck" : "tree");
    return null;
}

ctx.cameos = {
    auto: true,          // random roadside cameos (set false in tests to drive them by hand)
    log: [],             // stat ids this feature emitted (tests read it)
    force: {},           // test overrides: { reprieve: "insurance"|…|false, er: bool, mood, fault, tammy, visitor, intro, caught, escape, caughtGag, options }
    trigger(name, opts = {}) {
        switch (name) {
            case "avigailCar": return AV.spawnAvigailCar(Object.assign({ pulled: false, force: true }, opts));
            case "avigailPulled": return AV.spawnAvigailCar(Object.assign({ pulled: true, force: true }, opts));
            case "avigailWalker": return AV.spawnAvigailWalker(Object.assign({ force: true }, opts));
            case "porch": return AV.startPorch(opts);
            case "ride": return AV.startRide(opts.secs);
            case "salonShop": return SL.spawnSalonShop(Object.assign({ force: true }, opts));
            case "salon": return SL.startSalon(Object.assign({ from: "drive" }, opts));
            case "sasquatch": return RS.spawnSasquatch(Object.assign({ force: true }, opts));
            case "heshy": return RS.spawnHeshy(Object.assign({ force: true }, opts));
            case "uncle": return RS.spawnUncle(Object.assign({ force: true }, opts));
            case "er": return ER.admit(opts.reason || "crash", opts);
            case "wreck": return forceWreck(opts.kind);
            default: console.warn("[cameos] unknown trigger", name); return null;
        }
    },
    avigail: AV, salon: SL, roadside: RS, crash: CR, er: ER,
};
