// features/underworld — 🔧 VELVEL'S NO-QUESTIONS AUTO.
//
// Every few minutes of highway driving a corrugated shack turns up on the right shoulder (a pull-in pad
// in front of it). Pull onto the pad and Velvel offers, for cash and no questions:
//   🔧 a cheap fix (hearts, dents, a flat)   🎨 a cheap paint job (a new look: ctx.law.changeLook)
//   💰 he BUYS the "borrowed" car she's in (her own car is brought round; a neighbour may call it in)
// The parts and the paint might be HOT (SPAWN.mechanic.hot): for the rest of the run, a cop who gets a
// good look recognises the stolen bumper → law's notice (a ⚠️ warning, then a chase).
import * as THREE from "three";
import { ctx, addActor } from "../../core/ctx.js";
import { heal } from "../../core/driving.js";
import * as H from "../../hud.js";
import { facingRoad } from "../../world.js";
import { SPAWN, TUNE, MECH } from "./data.js";
import { UW, live, chance, rand, pick, fill, coins, pay, earn, inTown, onFoot, chasing, calm, mode, need, models, cloneWithColors,
    person, pt, carDist, makePad, bubble, toast, banner, log, stat, unbuiltAhead, reserve, drop, lulu } from "./common.js";
import { addHeat } from "./heat.js";
import { startDeal } from "./deal.js";

const SHACK_D = 17.5, PAD_D = 8.6;
const _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);

const damaged = () => {
    const G = ctx.G || {};
    return (G.hearts || 0) < (G.maxHearts || 3) || !!(ctx.feel && ctx.feel.damage && ctx.feel.damage.stage > 0) || !!(ctx.streets && ctx.streets.flat);
};
/** The "borrowed" ride she's in (a jacked / hotwired car): { key, label } | null. */
function rideNow() {
    const v = ctx.foot && ctx.foot.vehicle;
    if (!v || !ctx.foot.borrowed) return null;
    const key = v.kind;
    const label = /van/.test(key) ? "minivan" : /truck/.test(key) ? "box truck" : /sports/.test(key) ? "sports car" : key === "cop" ? "COP CAR" : /ambulance/.test(key) ? "ambulance" : /bus/.test(key) ? "bus" : /dozer/.test(key) ? "steamroller" : "car";
    return { key, label, pay: SPAWN.mechanic.buy[key] || 70 };
}

/** Per frame while driving: count down to the next shack. */
export function mechTick(dt) {
    const O = UW.offer;
    if (O && O.kind === "velvel") { tickShack(O, dt); return; }
    if (!live() || ctx.state !== "playing" || inTown() || onFoot() || calm() || !/^(cruise|story)$/.test(mode())) return;
    UW.mechT -= dt * (damaged() || rideNow() ? 1.6 : 1);
    if (UW.mechT > 0 || UW.offer || chasing() || UW.runT < SPAWN.mechanic.first) return;
    UW.mechT = rand(SPAWN.mechanic.every[0], SPAWN.mechanic.every[1]);
    if (!chance(SPAWN.mechanic.chance)) return;
    placeShack();
}

/** Velvel's shack `ahead` metres up the road (≥ 700: before its chunk is built, so the trees keep out). */
export function placeShack(ahead = 720) {
    if (UW.offer) return null;
    const s = ahead >= 600 ? unbuiltAhead(ahead, 18) : ctx.car.s + ahead;
    const undo = reserve(s - 16, s + 16, 1, 8.5, 28);
    const q = pt(s, PAD_D);
    const O = { kind: "velvel", s, pad: makePad("#FFA000", 3.4), padAt: { x: q.x, z: q.z }, shack: null, p: null, t: 0, done: "", prompted: false, announced: false, undo,
        who() { return O.p ? O.p.obj.position : null; },
        talk(who) { O.talking = who === "velvel"; },
        tick(dt) { animate(O, dt); },
        cleanup() { if (O.actor) { const i = ctx.actors.indexOf(O.actor); if (i >= 0) ctx.actors.splice(i, 1); } if (O.shack) drop(O.shack); O.shack = null; undo(); },
    };
    O.pad.position.set(q.x, 0, q.z);
    ctx.scene.add(O.pad);
    UW.offer = O;
    need(["uw_shack", "uw_velvel"]).then(() => {
        if (UW.offer !== O || O.done === "gone") return;
        if (models.uw_shack) {
            const sh = cloneWithColors(models.uw_shack);
            const w = pt(s, SHACK_D);
            sh.position.set(w.x, 0, w.z);
            sh.rotation.y = facingRoad(w.h, 1);
            ctx.scene.add(sh);
            O.shack = sh;
            // the shack is solid (round colliders across its footprint)
            const pts = [[-2.6, 0], [0, 0], [2.6, 0], [-2.6, 2.4], [2.6, 2.4]].map(([x, back]) => {
                _v.set(x, 0, -back).applyAxisAngle(_up, sh.rotation.y).add(sh.position);
                return { x: _v.x, z: _v.z, r: 2.3 };
            });
            O.actor = addActor({
                update() { return UW.offer === O || ctx.car.s - s < 160; },
                collide(car) {
                    for (const c of pts) {
                        const dx = c.x - car.pos.x, dz = c.z - car.pos.z;
                        if (dx * dx + dz * dz > (c.r + 3) * (c.r + 3)) continue;
                        const imp = car.collideStatic(c.x, c.z, c.r);
                        if (imp) return { impact: imp, why: "Velvel's shack: no refunds", source: "underworld" };
                    }
                    return null;
                },
                dispose() { if (O.shack) drop(O.shack); O.shack = null; },
            });
        }
        const p = person("uw_velvel", null, "npcMan");
        if (p) {
            const w = pt(s + 3.5, 11.6);
            p.obj.position.set(w.x, 0, w.z);
            p.obj.rotation.y = facingRoad(w.h, 1);
            ctx.scene.add(p.obj);
            O.p = p;
        }
    });
    log("offer", { kind: "velvel", s: Math.round(s) });
    return O;
}

function animate(O, dt) {
    O.t += dt;
    if (O.pad && O.pad.userData.tick) O.pad.userData.tick(ctx.time);
    if (O.p) {
        const lp = ctx.car.pos, near = carDist(O.p.obj.position.x, O.p.obj.position.z) < 70;
        if (near) O.p.face(lp.x, lp.z, dt, 4);
        O.p.update(dt, { talk: !!O.talking, wave: near && !O.talking && !O.done });
    }
}

function tickShack(O, dt) {
    if (ctx.state !== "underworldDeal") animate(O, dt);
    const car = ctx.car, rel = O.s - car.s;
    if (O.done) {
        if (rel < -150 || rel > 1000) clearShack(O);
        return;
    }
    if (ctx.state !== "playing") return;
    if (!O.announced && rel < 380) { O.announced = true; banner(MECH.banner, MECH.sub, 3200, "uw:offer"); }
    const near = rel < 170 && rel > -6 && !chasing();
    if (near) { H.prompt(MECH.prompt); O.prompted = true; }
    else if (O.prompted) { O.prompted = false; H.prompt(""); }
    if (!chasing() && carDist(O.padAt.x, O.padAt.z) < TUNE.deal.r && car.speed < TUNE.deal.stop) { deal(O); return; }
    if (rel < -16) { O.done = "passed"; if (O.prompted) { O.prompted = false; H.prompt(""); } log("velvel", { result: "passed" }); }
}
export function clearShack(O = UW.offer) {
    if (!O) return;
    if (UW.offer === O) UW.offer = null;
    O.done = O.done || "gone";
    if (O.prompted) { O.prompted = false; H.prompt(""); }
    if (O.p) { drop(O.p.obj); O.p = null; }
    if (O.pad) { drop(O.pad); O.pad.userData.dispose(); O.pad = null; }
    O.cleanup();
}

function hotRoll() { return UW.force.hot != null ? !!UW.force.hot : Math.random() < SPAWN.mechanic.hot; }
function makeHot(why) { UW.hot = { why, seeT: 0, coolT: 0 }; addHeat(TUNE.heat.add.hotParts, "hot"); }

function deal(O) {
    if (O.prompted) { O.prompted = false; H.prompt(""); }
    O.done = "dealing";
    startDeal(O, async D => {
        await D.say("velvel", pick(MECH.hello));
        const opts = [], acts = [];
        const fixP = SPAWN.mechanic.fix, paintP = SPAWN.mechanic.paint, ride = rideNow();
        if (damaged()) { opts.push(fill(MECH.fix, { price: fixP })); acts.push("fix"); }
        if (ctx.streets && ctx.streets.paint && ctx.streets.paint.repaint) { opts.push(fill(MECH.paint, { price: paintP })); acts.push("paint"); }
        if (ride) { opts.push(fill(MECH.sell, { ride: ride.label, pay: ride.pay })); acts.push("sell"); }
        opts.push(MECH.look); acts.push("look");
        const act = acts[await D.choose(MECH.ask, opts)];
        O.done = "dealt";
        if (act === "fix") {
            if (!pay(fixP, "velvel")) { await D.say("velvel", fill(MECH.broke, { price: fixP })); return; }
            const G = ctx.G;
            if (ctx.feel && ctx.feel.damage && ctx.feel.damage.repair) ctx.feel.damage.repair("velvel");
            if (G.hearts < G.maxHearts) heal(G.maxHearts - G.hearts);
            if (ctx.streets && ctx.streets.repairTyres) ctx.streets.repairTyres("");
            await D.say("velvel", pick(MECH.fixed));
            const hot = hotRoll();
            if (hot) makeHot("parts");
            stat("uwVelvelFixes");
            log("velvel", { result: "fix", hot });
        } else if (act === "paint") {
            if (!pay(paintP, "velvel")) { await D.say("velvel", fill(MECH.broke, { price: paintP })); return; }
            const c = pick(MECH.colors);
            try { ctx.streets.paint.repaint(c); } catch (e) { console.error("[underworld] paint", e); }
            if (ctx.law && ctx.law.changeLook) ctx.law.changeLook("paint");
            await D.say("velvel", fill(pick(MECH.painted), { color: c.name[0].toUpperCase() + c.name.slice(1) }));
            const hot = hotRoll();
            if (hot) makeHot("paint");
            stat("uwVelvelPaints");
            log("velvel", { result: "paint", hot, color: c.name });
        } else if (act === "sell") {
            earn(ride.pay, "velvel");
            await D.say("velvel", pick(MECH.sold));
            // his cousin brings her own car round (a puff of smoke covers the swap — the chop shop's trick)
            const car = ctx.car;
            if (car.fx) car.fx.burst(car.pos.x, 1, car.pos.z, 30, 3, [0.85, 0.85, 0.88], 1.6, 1.2);
            if (ctx.foot && ctx.foot.drive) ctx.foot.drive({ own: true, x: car.pos.x, z: car.pos.z, h: car.h });
            addHeat(TUNE.heat.add.sell, "sell");
            stat("uwVelvelSales");
            const report = UW.force.report != null ? !!UW.force.report : Math.random() < SPAWN.mechanic.report;
            log("velvel", { result: "sell", pay: ride.pay, kind: ride.key, report });
            if (report) D.after(() => { if (ctx.law && ctx.law.callIn) ctx.law.callIn(MECH.sellCharge, { msg: MECH.sellCall }); });
        } else {
            await D.say("velvel", pick(MECH.bye));
            log("velvel", { result: "look" });
        }
    });
}

/** HOT parts / paint: a cop who gets a good look at her car recognises it (law's notice → ⚠️, then a chase). */
export function hotTick(dt) {
    const h = UW.hot;
    if (!h || !ctx.law || !ctx.law.copSees || ctx.state !== "playing" || onFoot()) return;
    if (chasing()) { h.seeT = 0; return; }
    const p = ctx.car.pos;
    if (ctx.time > h.coolT && ctx.law.copSees(p.x, p.z, 40)) {
        h.seeT += dt;
        if (h.seeT > 1.2) {
            h.seeT = 0;
            h.coolT = ctx.time + 25;
            const r = ctx.law.notice(MECH.hotCharge, { msg: MECH.hotMsg, warn: MECH.hotWarn, witness: true });
            log("hot", { result: r || "none", why: h.why });
            if (r === "chase") UW.hot = null;            // (they know the car now)
            else if (r === "warn") lulu("Stolen?! Velvel said it 'fell off a truck'!", true);
        }
    } else h.seeT = Math.max(0, h.seeT - dt);
}
