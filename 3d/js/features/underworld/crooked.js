// features/underworld — 🍩 OFFICER KRUPNIK and the Policeman's Kugel Fund.
//
//  • a ⚠️ WARNING (law's notice → law:warning): sometimes his cruiser waits on the shoulder up ahead
//    with its lights going and a glowing pad behind it. Pull in → the "donation" (a deal): pay and
//    the warning gets lost (ctx.law.clearWarning) — or it's an Internal Affairs STING: the coins
//    are evidence and it's a 2★ chase for BRIBING AN OFFICER (KUGEL FUND). Drive past = no thanks.
//  • a pull-over (law's lawBust, only from a 1–2★ chase): bust.js asks ctx.underworld.bustOffer()
//    before her usual tactics — pay → let off; a sting → booked for bribery (court has lines for it);
//    no thanks → the normal pull-over.
// Refusing is always safe: nothing changes.
import { ctx } from "../../core/ctx.js";
import { findNodes } from "../../models.js";
import * as H from "../../hud.js";
import { facingRoad } from "../../world.js";
import { SPAWN, TUNE, COP, CAST } from "./data.js";
import { UW, live, chance, rand, pick, fill, coins, pay, inTown, onFoot, chasing, calm, mode, need, models, cloneWithColors,
    person, pt, carDist, makePad, bubble, toast, banner, log, stat, removeCar, drop } from "./common.js";
import { addHeat, heat } from "./heat.js";
import { startDeal } from "./deal.js";

const priceNow = () => Math.round(rand(SPAWN.crooked.price[0], SPAWN.crooked.price[1]) / 5) * 5;
const stingRoll = () => (UW.force.sting != null ? !!UW.force.sting : Math.random() < SPAWN.crooked.sting + 0.15 * heat() / TUNE.heat.max);

/** Is a "donation" possible right now? (Krupnik's cooldown, a petty chase, coins enough.) */
function canCrook() {
    if (!live() || !ctx.law || calm()) return false;
    if (ctx.time < UW.crookCool && !UW.force.offer) return false;
    if (ctx.law.fugitive) return false;
    return true;
}

// ── a ⚠️ warning → his cruiser on the shoulder ahead ─────────────────────
export function onWarning() {
    if (!canCrook() || UW.offer || chasing() || inTown() || onFoot() || ctx.state !== "playing") return false;
    if (!/^(cruise|story)$/.test(mode()) || (ctx.hustle && ctx.hustle.job)) return false;
    if (UW.runT < SPAWN.firstAfter && !UW.force.offer) return false;
    const price = priceNow();
    if (coins() < price) return false;
    if (!(UW.force.offer || chance(SPAWN.crooked.warn))) return false;
    UW.crookCool = ctx.time + SPAWN.crooked.cool;
    shoulderCop(price);
    return true;
}

export function shoulderCop(price = priceNow(), ahead = 230) {
    const car = ctx.car, s = car.s + ahead;
    const c = ctx.traffic.add("cop", s, 9.4, 1, 0, { keep: true, noNearMiss: true, data: { underworld: "krupnik", local: true },
        ai: (dt, cc) => offerCarAi(O, dt, cc), onRemove: () => { O.car = null; } });
    c.onCrash = () => false;
    const O = { kind: "cop", s, price, car: c, bar: ctx.law.lightBar ? ctx.law.lightBar(c.obj) : null, p: null, can: null, pad: makePad("#FFD54F", 3.0), t: 0, done: "", prompted: false,
        who() { return O.p ? O.p.obj.position : null; },
        talk(who) { O.talking = who === "cop" || who === "feldman"; },
        tick(dt) { tickOffer(O, dt); },
    };
    const q = pt(s - 13, 8.3);
    O.pad.position.set(q.x, 0, q.z);
    O.padAt = { x: q.x, z: q.z };
    ctx.scene.add(O.pad);
    UW.offer = O;
    need(["uw_krupnik", "uw_kugelcan"]).then(() => {
        if (UW.offer !== O || O.done === "gone") return;
        const p = person("uw_krupnik", null, "copPerson");
        if (!p) return;
        const w = pt(s - 3.2, 11.0);
        p.obj.position.set(w.x, 0, w.z);
        p.obj.rotation.y = facingRoad(w.h, 1);
        ctx.scene.add(p.obj);
        O.p = p;
        if (models.uw_kugelcan) {
            const can = cloneWithColors(models.uw_kugelcan);
            const arm = findNodes(p.obj, "Arm_R")[0];
            if (arm) { can.position.set(0, -0.5, 0.08); arm.add(can); O.can = can; }
        }
    });
    banner(COP.warnBanner, COP.warnSub, 3200, "uw:offer");
    log("offer", { kind: "cop", price });
    return O;
}
// the cruiser just sits there with its lights going; after the deal it pulls out and drives off
function offerCarAi(O, dt, c) {
    if (O.leaving) {
        c.speed = Math.min(26, c.speed + 6 * dt);
        c.dTarget = 5.25;
        c.d += Math.sign(5.25 - c.d) * Math.min(Math.abs(5.25 - c.d), 1.5 * dt);
        c.s += c.speed * dt;
    } else c.speed = 0;
}
function tickOffer(O, dt) {
    O.t += dt;
    if (O.pad && O.pad.userData.tick) O.pad.userData.tick(ctx.time);
    if (O.bar) O.bar.set(!O.leaving || O.t < O.leaveAt + 3, ctx.time);
    if (O.p) {
        const lp = ctx.car.pos;
        if (!O.leaving) O.p.face(lp.x, lp.z, dt, 4);
        O.p.update(dt, { talk: !!O.talking, wave: !O.done && carDist(O.p.obj.position.x, O.p.obj.position.z) < 60 && !O.talking });
    }
}

/** Every frame while she drives (and on foot: the props clean up). */
export function offersTick(dt) {
    const O = UW.offer;
    if (!O || O.kind !== "cop") return;
    if (ctx.state !== "underworldDeal") tickOffer(O, dt);
    const car = ctx.car, rel = O.s - car.s;
    if (O.done) {
        if (O.done === "dealt" && !O.leaving && O.t > (O.dealtAt || 0) + 1.5) { O.leaving = true; O.leaveAt = O.t; if (O.p) { drop(O.p.obj); O.p = null; } }
        if (rel < -140 || rel > 600) clearOffer(O);
        return;
    }
    if (chasing() && ctx.state === "playing") { clearOffer(O); return; }          // (no deals mid-chase: he's gone)
    if (ctx.state !== "playing") return;
    const near = rel < 170 && rel > -6;
    if (near) { H.prompt(COP.prompt); O.prompted = true; }
    else if (O.prompted) { O.prompted = false; H.prompt(""); }
    if (carDist(O.padAt.x, O.padAt.z) < TUNE.deal.r && car.speed < TUNE.deal.stop) { deal(O); return; }
    if (rel < -14) {           // drove past: no thanks
        O.done = "passed";
        if (O.prompted) { O.prompted = false; H.prompt(""); }
        if (O.p) bubble(pick(COP.passed), O.p.obj, { cls: "cop", y: 2.1 });
        log("bribe", { via: "warn", result: "passed" });
    }
}
export function clearOffer(O = UW.offer) {
    if (!O) return;
    if (UW.offer === O) UW.offer = null;
    O.done = O.done || "gone";
    if (O.prompted) { O.prompted = false; H.prompt(""); }
    if (O.p) { drop(O.p.obj); O.p = null; }
    if (O.pad) { drop(O.pad); O.pad.userData.dispose(); O.pad = null; }
    if (O.car) removeCar(O.car);
    if (O.cleanup) O.cleanup();
}

function deal(O) {
    if (O.prompted) { O.prompted = false; H.prompt(""); }
    O.done = "dealing";
    startDeal(O, async D => {
        const price = O.price;
        for (const [who, text] of pick(COP.pitch)) await D.say(who, fill(text, { price }));
        const can = coins() >= price;
        const i = await D.choose(COP.ask, [can ? fill(COP.pay, { price }) : fill(COP.broke, { coins: coins() }), COP.refuse]);
        O.done = "dealt"; O.dealtAt = O.t;
        if (i !== 0 || !can) {
            for (const [who, text] of pick(COP.refused)) await D.say(who, text);
            log("bribe", { via: "warn", result: "refused" });
            return;
        }
        const sting = stingRoll();
        pay(price, "kugelFund");
        if (!sting) {
            for (const [who, text] of pick(COP.paid)) await D.say(who, text);
            const had = ctx.law.clearWarning ? ctx.law.clearWarning() : false;
            toast(COP.paidToast, "gold", "uw:bribe");
            addHeat(TUNE.heat.add.bribe, "bribe");
            stat("uwBribes");
            log("bribe", { via: "warn", result: "paid", price, cleared: had });
            return;
        }
        for (const [who, text] of pick(COP.sting)) await D.say(who, text);
        addHeat(TUNE.heat.add.sting, "sting");
        stat("uwStings");
        log("bribe", { via: "warn", result: "sting", price });
        // (on the road: Internal Affairs lights her up — 2★ for the bribe)
        D.after(() => { if (ctx.law) ctx.law.startChase(COP.charge, { heat: 2, msg: COP.stingBanner }); });
    });
}

// ── a pull-over: law/bust.js asks before her usual tactics ───────────────
/** → null, or the offer bust.js plays (see bust.js). */
export function bustOffer({ reason } = {}) {
    if (!canCrook() || UW.lastHeat > SPAWN.crooked.maxStars) return null;
    const price = priceNow();
    if (coins() < price) return null;
    if (!(UW.force.offer || chance(SPAWN.crooked.bust))) return null;
    UW.crookCool = ctx.time + SPAWN.crooked.cool;
    log("offer", { kind: "bust", price, reason });
    return {
        name: CAST.krupnik.name,
        names: { cop: { name: CAST.krupnik.name, emoji: CAST.krupnik.emoji }, feldman: { name: CAST.feldman.name, emoji: CAST.feldman.emoji } },
        pitch: [["cop", fill(pick(COP.bustPitch)[1], { price })]],
        ask: COP.ask,
        options: [fill(COP.pay, { price }), COP.refuse],
        answer(i) {
            if (i !== 0 || coins() < price) { log("bribe", { via: "bust", result: "refused" }); return { outcome: "refuse", lines: pick(COP.refused) }; }
            const sting = stingRoll();
            pay(price, "kugelFund");
            if (!sting) {
                addHeat(TUNE.heat.add.bribe, "bribe");
                stat("uwBribes");
                log("bribe", { via: "bust", result: "paid", price });
                return { outcome: "free", lines: pick(COP.paidBust), title: "🍩 THE KUGEL FUND THANKS YOU", sub: "“Never saw you.” Back on the road! 🚗" };
            }
            addHeat(TUNE.heat.add.sting, "sting");
            stat("uwStings");
            log("bribe", { via: "bust", result: "sting", price });
            const ch = [COP.charge];
            if (reason && reason !== COP.charge) ch.push(reason);
            return { outcome: "sting", lines: pick(COP.sting), title: COP.stingBanner, sub: COP.stingSub, charges: ch };
        },
    };
}

/** The bribery charge gets its own arrest lines, a lawyer's argument and a courtroom scene (law.addCharge). */
export function registerCharge() {
    if (!ctx.law || !ctx.law.addCharge || registerCharge.done) return;
    registerCharge.done = true;
    ctx.law.addCharge({ key: COP.chargeKey, name: COP.charge, weight: 2, cop: COP.arrestCop, lulu: COP.arrestLulu, defense: COP.defense, court: COP.court, nudge: "help" });
}
