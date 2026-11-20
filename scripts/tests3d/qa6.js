// 🐞 QA sweep, part 6 (every feature on, the watchdog in scripts/lib/qawatch.js on): the owner's own path — the REAL
// exit ramp (driven by a test driver, not a debug teleport): stop on the ramp, get out and walk about the interchange
// (the gore, the ramp's edge, the T-junction), back in, on down the ramp into the town (the soft cut), out at the kerb,
// and the town's way back to the highway. For both towns.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa6",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    // a test driver (as exits.js): steer through waypoints at a speed; stop = brake to a halt at the end
    await t.L(`import("./js/core/ctx.js").then(m => {
      m.hook("controls", (ctl, dt) => { const R = window.__route, car = m.ctx.car; if (!R) return;
        if (!R.pts.length) { if (R.stop) { ctl.steer = 0; ctl.throttle = 0; ctl.brake = car.vF > 0.3 ? 1 : 0; ctl.handbrake = car.vF <= 0.3; } return; }
        const p0 = R.pts[0]; if (Math.hypot(p0.x - car.pos.x, p0.z - car.pos.z) < (R.r || 5)) { R.pts.shift(); if (!R.pts.length) return; }
        const q = R.pts[0], want = Math.atan2(q.x - car.pos.x, q.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const v = R.pts.length <= 2 && R.stop ? Math.min(R.v, 5) : R.v;
        ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < v ? 0.7 : 0; ctl.brake = car.speed > v + 3 ? 0.5 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000); })`);
    const route = (E, pairs, v, stop) => g(`(() => { const r = ctx.world.road, pts = ${JSON.stringify(pairs)}.map(([u, d]) => { const p = r.point(${E} + u, d, {}); return { x: p.x, z: p.z }; }); window.__route = { pts, v: ${v}, r: 6, stop: ${!!stop} }; return true; })()`);
    const place = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.car.vF = ${v}; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.law.hold && ctx.law.hold(900), true)`);

    for (const [id, outer] of [["lakewood", false], ["midwood", true]]) {
      if (await g(`ctx.town.active`)) { await g(`L3.startRun({ mode: "cruise", quick: true })`); await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.town.active`, "a fresh cruise", 9000); await g(`(ctx.law.hold && ctx.law.hold(900), true)`); }
      await W.moved(t);
      const s0 = await g(`ctx.car.s`);
      await place(s0 + 1200, 5.25, 15);
      const E = await g(`ctx.town.debug.exitAhead(600)`);
      await g(`ctx.town.load("${id}")`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("${id}")`, `${id}'s models load`, 90000)) continue;
      await W.moved(t);
      await place(E - 240, 5.25, 15);
      await t.frames(4);
      await W.reset(t);
      // down the decel lane onto the ramp; stop part-way down it
      const full = await g(`ctx.town.debug.rampRoute(${E}, ${outer ? 1 : 0}, -240)`);
      if (!full || !full.length) { t.check(`${id}: a ramp route`, false); continue; }
      const mid = full.filter(([u]) => u <= 20);
      await route(E, mid, 13, true);
      await t.until(`!window.__route.pts.length && __lulu3d.ctx.car.speed < 0.5 || __lulu3d.ctx.town.active`, `${id}: stopped on the ramp`, 40000);
      const onRamp = await g(`({ town: ctx.town.active, u: +(ctx.car.s - ${E}).toFixed(1), d: +ctx.car.d.toFixed(1), ph: (ctx.town.debug.rampPhase() || {}).phase || null })`);
      console.log(`   ${id}: stopped on the ramp`, JSON.stringify(onRamp));
      await g(`(window.__route = null, true)`);
      if (!onRamp.town) {
        // out on the ramp, walk about: across the gore toward the highway, along the ramp, out toward the fields, back
        await g(`(ctx.foot.start("droveOff"), true)`);
        if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, `${id}: out on the ramp`, 6000)) {
          for (const [x, y, n] of [[-1, 0, 60], [0, -1, 60], [1, 0, 90], [0, 1, 40], [1, -1, 60]]) { await t.stick(x, y); await t.frames(n); }
          await t.stick(0, 0);
          await t.shot(`${id}-ramp-on-foot`);
          await g(`ctx.foot.debug.getIn()`);
          await t.until(`__lulu3d.state === "playing"`, `${id}: back in the car on the ramp`, 4000);
          await t.frames(10);
        }
        await seg(`${id}: out on the exit ramp, walking the interchange`);
        // on down the ramp: the town comes in by the soft cut
        const rest = await g(`ctx.town.debug.rampRoute(${E}, ${outer ? 1 : 0}, -240).filter(([u, d]) => u > ctx.car.s - ${E} + 4)`);
        await route(E, rest, 12, false);
        if (!await t.until(`__lulu3d.ctx.town.active`, `${id}: down the ramp into town`, 60000)) { await g(`(window.__route = null, true)`); continue; }
        await g(`(window.__route = null, true)`);
        await t.until(`!__lulu3d.ctx.town.transitioning`, `${id}: the cut clears`, 10000);
      }
      // in town: stop at the kerb, out, a short walk, back in
      await t.hold(6, 1); await t.frames(40); await t.hold(6, 0);
      await g(`(ctx.foot.start("droveOff"), true)`);
      if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, `${id}: out in town`, 6000)) {
        for (const [x, y, n] of [[1, 0, 40], [0, -1, 50], [-1, 0, 60]]) { await t.stick(x, y); await t.frames(n); }
        await t.stick(0, 0);
        await g(`ctx.foot.debug.getIn()`);
        await t.until(`__lulu3d.state === "playing"`, `${id}: back in the car in town`, 4000);
      }
      await t.shot(`${id}-in-town`);
      // the town's way back out (the ramp's transition, as the flow test does)
      await g(`ctx.town.debug.trans("leave")`);
      await t.until(`!__lulu3d.ctx.town.active && !__lulu3d.ctx.town.transitioning`, `${id}: back on the highway`, 10000);
      await t.frames(30);
      await seg(`${id}: down the ramp, in town, back out`);
    }
  },
};
