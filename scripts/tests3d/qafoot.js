// 🐞 QA on foot on the highway — the focused repros the play-test sweep found, each with the watchdog
// (scripts/lib/qawatch.js) on:
//   • the car can drive out into the fields to 70 m, but on foot the fence is at 52 m: getting out of a car parked out
//     there yanked her ~15 m back toward the road in ONE frame (a teleport). Now she can walk round her car, and the
//     fence only ever pushes her back as a quick glide.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qafoot",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    const g = t.game;
    await W.install(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await t.frames(10);

    // ── parked far out in the field (64 m from the road's centre), get out ──
    await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 120, p = r.point(s, 64, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 64;
      ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    await t.frames(10);
    await W.reset(t);
    await g(`(ctx.foot.start("droveOff"), true)`);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car in the field", 6000)) return;
    await t.frames(20);
    const d0 = await g(`Math.abs(ctx.foot.debug.F.d)`);
    t.check("out of a car parked 64 m out, she stands beside it (not yanked to the fence)", d0 > 58, d0.toFixed(1));
    // wander: out, along, back toward the road and back out to the car
    for (const [x, y, n] of [[1, 0, 30], [0, -1, 30], [-1, 0, 60], [1, 0, 50]]) { await t.stick(x, y); await t.frames(n); }
    await t.stick(0, 0);
    await t.frames(10);
    const r = await W.report(t); W.log(r);
    W.check(t, "on foot out in the field", r, ["jump", "nan", "overlay", "flat", "underground", "hidden"]);
    t.check("…and she never strays far past her car", await g(`Math.abs(ctx.foot.debug.F.d) < 76`));
    await t.shot("field");
    t.check("✋ she can get back in", await g(`ctx.foot.debug.getIn()`));
    await t.until(`__lulu3d.state === "playing"`, "driving again", 3000);
  },
};
