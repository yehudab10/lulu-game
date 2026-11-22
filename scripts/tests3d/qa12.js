// 🐞 QA sweep, part 12 — ARRESTED ON FOOT, AWAY FROM HER CAR, IN A TOWN (features/law × features/places), the watchdog on:
// the cruiser pulls up by HER (it used to pull up behind the car she'd left down the street — she walked toward it for 5 s,
// vanished, and the haul shot whipped the camera across: a "camera swoop" on a friend's screen in bankfriends), and the
// scene's camera never swoops.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa12",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.law.hold && ctx.law.hold(1e6), ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await W.moved(t);
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.frames(20);
    await g(`(ctx.foot.start("droveOff"), true)`);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 8000)) return;
    // 45 m down the sidewalk from her car
    await W.moved(t);
    const her = await g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, n = r.nearest(F.pos.x, F.pos.z, F.s, {}), st = n.street, mid = st ? (st.outer + st.walk) / 2 : 7;
      const s = Math.max(st.base + st.a0 + 6, Math.min(st.base + st.a1 - 6, n.s + 45)); const p = r.point(s, (n.d >= 0 ? 1 : -1) * mid, {}); F.pos.set(p.x, 0.05, p.z); F.lulu.obj.position.copy(F.pos); ctx.cam.snap();
      return { x: p.x, z: p.z, h: p.h, car: Math.hypot(p.x - ctx.car.pos.x, p.z - ctx.car.pos.z) }; })()`);
    t.check("she's well away from her car (> 25 m)", her.car > 25, JSON.stringify(her));
    await t.frames(6);
    await W.reset(t);
    await g(`(() => { const F = ctx.foot.debug.F, a = { x: F.pos.x, z: F.pos.z, h: F.h }; ctx.law.hold(0); ctx.foot.end("arrest"); ctx.law.arrest(["JAYWALKING"], Object.assign({ foot: true, onFoot: true }, a)); return true; })()`);
    if (!await t.until(`__lulu3d.state === "lawArrest"`, "the arrest on foot", 4000)) return;
    // during the pull-up: how close does the cruiser stop to HER?
    let best = 1e9;
    for (let i = 0; i < 16; i++) {
      await t.frames(10);
      const d = await g(`(() => { const u = ctx.traffic.cars.filter(c => /cop/.test(c.kind)); if (!u.length) return null; return Math.min(...u.map(c => Math.hypot(c.x - ${her.x}, c.z - ${her.z}))); })()`);
      if (d != null) best = Math.min(best, d);
      if (await g(`L3.state !== "lawArrest"`)) break;
    }
    t.check("the cruiser pulls up by HER (≤ 15 m), not by the car she left down the street", best <= 15, best.toFixed(1));
    await t.shot("arrest-away-from-car");
    // to the end of the scene (it's skippable, but let it play: the haul shot is the one that swooped)
    await t.until(`__lulu3d.state !== "lawArrest"`, "the arrest scene ends", 40000);
    const r = await W.report(t); W.log(r);
    W.check(t, "arrested on foot away from her car: the scene's camera never swoops", r, ["jump", "nan", "overlay", "flat", "underground"]);
  },
};
