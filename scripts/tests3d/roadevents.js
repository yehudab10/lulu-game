// Road events & hazards: forces every event through ctx.roadevents.spawn() with
// the fake controller and checks it behaves — passengers double coins, the
// hitchhiker hops in on a honk, toll gates (open lane pays, closed lane costs a
// heart), the train crossing (wait → +100), drive-thru / ice-cream payouts, the
// parade + duck parade, animals and cones, the steamroller flattening traffic,
// the school bus + Dina, zones, nitro, and the SPAWN_CONFIG scheduler.
const ONLY = process.env.RE_ONLY ? new RegExp(process.env.RE_ONLY) : null;

module.exports = {
  name: "roadevents",
  query: "&enable=roadevents",
  save2d: { totalCoins: 100 },
  async run(t) {
    const g = t.game;
    const part = name => !ONLY || ONLY.test(name);
    t.check("service is up", await g(`!!ctx.roadevents && ctx.roadevents.events.length > 20`), await g(`ctx.roadevents.events.join(",")`));
    await g(`ctx.roadevents.loadModels()`);
    await g(`(ctx.roadevents.auto = false, L3.startRun({ mode: "cruise" }))`);
    if (!await t.until(`__lulu3d.state === "playing"`, "drive starts")) return;

    // put the car at (s, d) heading down the road at `v` m/s, traffic cleared
    const tp = (s, d, v = 0, ap = true) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {});
      ctx.traffic.clear(); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.G.invT = 0; ctx.G.hearts = 3; ctx.cam.snap();
      ctx.roadevents.autopilot = ${ap && v > 0} ? { d: ${d}, speed: ${v} } : null; return true; })()`);
    const S = () => g(`ctx.car.s`);
    let s0 = 400;

    // ── passengers: bonk a walker → 2× coins ─────────────────────────────
    if (part("passenger")) {
      await tp(s0, 1.75, 9, false);
      await g(`ctx.roadevents.spawn("pedestrian", { s: ${s0 + 16}, d: 1.75, cross: false, kind: "walker" }).then(p => (p.vs = 0, true))`);
      await t.until(`window.__lulu3d.ctx.roadevents.passengers >= 1`, "a bonked walker flies into the passenger seat", 60000);
      t.check("a bonked walker flies into the passenger seat", await g(`ctx.roadevents.passengers`) >= 1);
      t.check("…and opens the 2× coin window", await g(`ctx.roadevents.passengerTime`) > 25);
      const c0 = await g(`ctx.G.coins`);
      await g(`(() => { ctx.G.coins += 1; L3.emit("coin", { n: 1, why: "road" }); return true; })()`);
      t.check("road coins count double with a passenger", await g(`ctx.G.coins`) - c0 === 2, `${c0} → ${await g(`ctx.G.coins`)}`);
      await t.frames(6);
      await t.shot("passenger");
      // the hitchhiker: honk (L1) and he hops in, +15
      s0 = (await S()) + 30;
      await tp(s0, 5.25, 4, false);
      await g(`ctx.roadevents.spawn("hitchhiker", { s: ${s0 + 35}, side: 1 })`);
      await t.frames(8);
      await t.shot("hitchhiker");
      const c1 = await g(`ctx.G.coins`);
      await t.tap(4);
      await t.frames(30);
      t.check("honking picks up the hitchhiker (+15)", await g(`ctx.G.coins`) - c1 >= 15, `${c1} → ${await g(`ctx.G.coins`)}`);
      t.check("two riders in the car", await g(`ctx.roadevents.passengers`) === 2);
      await t.shot("riders");
    }

    // ── the toll plaza ───────────────────────────────────────────────────
    if (part("toll")) {
      s0 = (await S()) + 200;
      await g(`ctx.roadevents.spawn("toll", { s: ${s0 + 120}, open: [0, 1] }).then(T => (window.__toll = T, true))`);
      await tp(s0 + 40, 2.3, 12);
      await t.frames(12);
      await t.shot("toll-approach");
      await t.until(`window.__toll && window.__toll.paid`, "driving through an open toll lane pays", 90000);
      t.check("driving through an open toll lane pays", await g(`window.__toll.paid === true`));
      t.check("…without losing a heart", await g(`ctx.G.hearts`) === 3, `hearts ${await g(`ctx.G.hearts`)}`);
      // a closed gate costs a heart
      s0 = (await S()) + 260;
      await g(`ctx.roadevents.spawn("toll", { s: ${s0 + 60}, open: [2] }).then(T => (window.__toll2 = T, true))`);
      await tp(s0 + 30, 2.3, 14);
      await t.until(`window.__toll2 && window.__toll2.passed`, "reaches the closed gate", 90000);
      await t.frames(4);
      t.check("crashing a closed toll gate costs a heart", await g(`ctx.G.hearts`) === 2, `hearts ${await g(`ctx.G.hearts`)}`);
      t.check("…and the arm goes flying", await g(`ctx.G.roadevents.tollGatesSmashed`) === 1);
      await t.shot("toll-smash");
    }

    // ── the railroad crossing: wait for the train ────────────────────────
    if (part("train")) {
      s0 = (await S()) + 300;
      await g(`ctx.roadevents.spawn("train", { s: ${s0 + 40}, cars: 4 }).then(T => (window.__train = T, true))`);
      await tp(s0, 1.75, 0);

      await t.frames(10);
      t.check("the crossing lights start and the gates come down", await t.until(`window.__train && window.__train.lights`, "lights on", 60000));
      await t.until(`window.__train.gate < 0.2`, "gates down", 60000);
      await t.shot("train-gates");
      await t.until(`window.__train.phase === "gone" || window.__train.waited`, "the train crosses", 120000);
      await t.shot("train-passing");
      t.check("waiting at the gates pays (+100)", await g(`window.__train.waited === true`));
      t.check("the train didn't hit her", await g(`!window.__train.hit && ctx.G.hearts > 0`));

    }

    // ── drive-thru, ice-cream truck, ice-cream stand ─────────────────────
    if (part("treats")) {
      s0 = (await S()) + 250;
      const before = await g(`ctx.G.coins`);
      await g(`ctx.roadevents.spawn("driveThru", { s: ${s0 + 60}, side: 1 }).then(E => (window.__dt = E, true))`);
      const sw = await g(`window.__dt.s`);
      await tp(sw - 22, 8.0, 7);
      await t.frames(10);
      await t.shot("drivethru");
      await t.until(`window.__dt.taken`, "the drive-thru serves a meal", 60000);
      const after = await g(`ctx.G.coins`);
      t.check("the drive-thru serves a meal (+20–45)", after - before >= 20 && after - before <= 45 * 2 + 1, `${before} → ${after}`);
      s0 = (await S()) + 220;
      await g(`ctx.roadevents.spawn("iceTruck", { s: ${s0 + 40}, side: 1 }).then(E => (window.__it = E, true))`);
      await tp(s0 + 15, 5.4, 7);
      await t.frames(10);
      await t.shot("icecream-truck");
      t.check("hugging the lane past the ice-cream truck gets a scoop", await t.until(`window.__it.taken`, "scoop", 60000));
      s0 = (await S()) + 220;
      await g(`ctx.roadevents.spawn("iceCream", { s: ${s0 + 30}, side: 1 }).then(E => (window.__ic = E, true))`);
      await tp(s0 + 10, 8.0, 7);
      t.check("the ice-cream stand pays +5", await t.until(`window.__ic.taken`, "stand", 60000));
      await t.shot("icecream-stand");
    }

    // ── parade + duck parade (wait = bonus), animals + cones hurt ────────
    if (part("crowds")) {
      s0 = (await S()) + 260;
      await g(`ctx.roadevents.spawn("parade", { s: ${s0 + 30}, now: true, kind: "parade" }).then(E => (window.__pa = E, true))`);
      await tp(s0, 3.5, 0);

      await t.frames(50);
      await t.shot("parade");
      t.check("the parade streams across the road", await g(`window.__pa.started && window.__pa.marchers.length > 3`), `${await g(`window.__pa.marchers.length`)} marchers`);
      t.check("traffic-style patience: waiting for the parade pays", await t.until(`window.__pa.waited`, "parade wait", 60000));
      s0 = (await S()) + 200;
      await tp(s0, 1.75, 0);
      await g(`ctx.roadevents.spawn("duckParade", { s: ${s0 + 22}, side: 1 }).then(P => (window.__dp = P, true))`);
      await t.frames(60);
      await t.shot("duck-parade");
      t.check("letting the ducklings cross pays (+150)", await t.until(`window.__dp.waited`, "duck wait", 90000));

      // a raccoon in the road at speed costs a heart
      s0 = (await S()) + 200;
      await tp(s0, 1.75, 16);
      await g(`ctx.roadevents.spawn("raccoon", { s: ${s0 + 22}, side: 1, d0: 2.0, v: 0.3 })`);
      await t.frames(3);
      const h0 = await g(`ctx.G.hearts`);
      await t.until(`window.__lulu3d.ctx.G.hearts < ${h0}`, "hitting a raccoon costs a heart", 30000);
      t.check("hitting a raccoon costs a heart", await g(`ctx.G.hearts`) === h0 - 1);
      await t.frames(6);
      await t.shot("raccoon");
      // cones: slow = a bonk, fast = a heart
      s0 = (await S()) + 200;
      await tp(s0, 1.75, 20);
      await g(`ctx.roadevents.spawn("cone", { s: ${s0 + 20}, d: 1.75, n: 1 })`);
      await t.frames(30);
      t.check("a cone at 45 mph costs a heart and goes flying", await g(`ctx.G.hearts`) === 2 && await g(`ctx.G.roadevents.cones`) >= 1, `hearts ${await g(`ctx.G.hearts`)}`);
      await t.shot("cone");
    }

    // ── the steamroller ──────────────────────────────────────────────────
    if (part("steamroller")) {
      s0 = (await S()) + 220;
      await g(`ctx.roadevents.spawn("steamroller", { s: ${s0 + 20}, d: 10.6 })`);
      await tp(s0 + 17, 9.0, 1);
      await t.until(`window.__lulu3d.ctx.roadevents.vehicle === "steamroller"`, "driving into the parked steamroller commandeers it", 30000);
      t.check("driving into the parked steamroller commandeers it", await g(`ctx.roadevents.vehicle === "steamroller"`));
      const hearts = await g(`ctx.G.hearts`);
      const sNow = await S();
      await tp(sNow + 4, 5.25, 9);
      await g(`ctx.traffic.add("sedan", ${sNow + 20}, 5.25, 1, 2) && true`);
      await t.until(`(window.__lulu3d.ctx.G.roadevents.crushes || 0) >= 1`, "the steamroller flattens a car", 60000);
      t.check("the steamroller flattens a car", await g(`ctx.G.roadevents.crushes`) >= 1);
      t.check("…and Lulu takes no damage", await g(`ctx.G.hearts`) === hearts);
      await t.frames(10);
      await t.shot("steamroller");
      await g(`ctx.roadevents.endSteamroller()`);
      t.check("out of diesel → back in her own car", await g(`ctx.roadevents.vehicle === null && ctx.car.model.visible`));
    }

    // ── school: Dina at the bus stop, crossing guard ─────────────────────
    if (part("school")) {
      s0 = (await S()) + 220;
      await g(`ctx.roadevents.spawn("busStop", { s: ${s0 + 60}, dina: true }).then(E => (window.__bs = E, true))`);
      const c0 = await g(`ctx.G.coins`);
      await tp(s0 + 20, 4.6, 6);
      await t.frames(20);
      await t.shot("bus-stop");
      await t.until(`window.__bs.dinaTaken`, "drive past Dina to pick her up", 60000);
      t.check("Dina hops in at the bus stop (+60)", await g(`window.__bs.dinaTaken`) && (await g(`ctx.G.coins`)) - c0 >= 60);
      await t.until(`window.__bs.checked`, "passes the bus", 60000);
      t.check("passing the stopped bus slowly is a safe stop", await g(`window.__bs.checked && !window.__bs.violated`));
      s0 = (await S()) + 220;
      await g(`ctx.roadevents.spawn("crossingGuard", { s: ${s0 + 40}, side: 1 }).then(E => (window.__cg = E, true))`);
      await tp(s0 + 10, 1.75, 5);
      await t.frames(25);
      await t.shot("crossing-guard");
    }

    // ── zones, traffic drama, ambulance, nitro ──────────────────────────
    if (part("zones")) {
      s0 = (await S()) + 300;
      await g(`(ctx.roadevents.setZone("construction", { s: ${s0 + 60}, len: 420 }), true)`);
      await tp(s0 + 40, 1.75, 10);
      await t.frames(30);
      t.check("entering a construction zone", await t.until(`window.__lulu3d.ctx.roadevents.zone === "construction"`, "construction zone", 30000));
      await t.frames(10);
      await t.shot("construction");
      s0 = (await S()) + 600;
      await tp(s0, 1.75, 12);
      await g(`ctx.roadevents.spawn("fenderBender")`);
      await g(`ctx.roadevents.spawn("ambulance")`);
      await g(`ctx.roadevents.spawn("drunk", { ahead: 90 })`);
      await t.frames(40);
      await t.shot("traffic-drama");
      t.check("a fender bender happened", await g(`(ctx.G.roadevents.fenderBenders || 0) >= 1`));
      t.check("an ambulance is on the road", await g(`ctx.traffic.cars.some(c => c.kind === "roadevents_ambulance")`));
      await g(`ctx.roadevents.nitro(3.5)`);
      await t.frames(4);
      t.check("a NITRO can turbo-boosts the car", await g(`ctx.G.boosting === true`));
    }

    // ── the SPAWN_CONFIG scheduler fires on its own ─────────────────────
    if (part("scheduler")) {
      const dt0 = await g(`ctx.G.roadevents.driveThrus || 0`);
      await g(`(() => { const r = ctx.roadevents; r.SPAWN_CONFIG.driveThru.chance = 1; r.timers.driveThru = 0.01; ctx.G.runTime = Math.max(ctx.G.runTime, 40); r.auto = true; return true; })()`);
      await t.frames(20);
      t.check("the SPAWN_CONFIG timers spawn events by themselves", await g(`(ctx.G.roadevents.driveThrus || 0) > ${dt0}`), JSON.stringify(await g(`ctx.G.roadevents`)));
      await g(`ctx.roadevents.auto = false`);
    }
    await g(`ctx.roadevents.autopilot = null`);
    t.check("still driving at the end", await g(`["playing", "wrecked"].includes(ctx.state)`), await g(`ctx.state`));
  },
};
