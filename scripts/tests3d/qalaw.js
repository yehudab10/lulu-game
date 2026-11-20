// 🐞 QA: caught and knocked out IN A TOWN (Lakewood), with the watchdog (scripts/lib/qawatch.js) on.
//   • arrested ON FOOT in town: the arrest scene plays right there in town (features/places: then the town's precinct) — Lulu used to be cuffed
//     at her old town street coordinates, far from the cruiser, with the camera looking at empty space
//   • arrested in the CAR in town: the same scene, beside her car
//   • knocked out in the car / on foot in town: she gets up right there (no tow, no black screen — ci/kotown)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qalaw",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const intoTown = async () => {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return false;
      await g(`(ctx.town.load("lakewood"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return false;
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return false;
      await g(`(ctx.law._dbg && ctx.law._dbg.FORCE ? (ctx.law._dbg.FORCE.bustOutcome = null) : 0, true)`);
      await t.frames(20);
      await W.reset(t);
      return true;
    };
    // the scene's camera must look at what's happening: Lulu's spot within ~25 m of the camera, and the car's too
    const framing = () => g(`(() => { const c = ctx.camera.position, k = ctx.car.pos; return +Math.hypot(c.x - k.x, c.z - k.z).toFixed(1); })()`);

    // ── arrested on foot in town ──
    if (!await intoTown()) return;
    await g(`(ctx.foot.start("droveOff"), true)`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    await t.stick(0, -1); await t.frames(40); await t.stick(0, 0);
    await g(`(() => { const F = ctx.foot.debug.F, at = { x: F.pos.x, z: F.pos.z, h: F.h }; ctx.foot.end("arrest"); ctx.law.arrest(["JAYWALKING"], Object.assign({ foot: true, onFoot: true }, at)); return true; })()`);
    await t.until(`__lulu3d.state === "lawArrest"`, "the arrest scene", 3000);
    let far = 0;
    for (let i = 0; i < 12; i++) { await t.frames(15); far = Math.max(far, await framing()); }
    await t.shot("arrest-on-foot-in-town");
    t.check("arrested on foot in town: the scene plays beside her (camera ≤ 25 m from the car's spot)", far <= 25, far + " m");
    let r = await W.report(t); W.log(r);
    W.check(t, "arrest on foot in town", r, ["nan", "flat", "underground"]);
    await g(`(L3.setState("title"), true)`);
    await t.frames(10);

    // ── arrested in the car in town ──
    if (!await intoTown()) return;
    await g(`(ctx.law.arrest(["RECKLESS DRIVING"]), true)`);
    await t.until(`__lulu3d.state === "lawArrest"`, "the arrest scene (car)", 3000);
    far = 0;
    for (let i = 0; i < 12; i++) { await t.frames(15); far = Math.max(far, await framing()); }
    t.check("arrested in the car in town: the scene plays beside her car", far <= 25, far + " m");
    r = await W.report(t); W.log(r);
    W.check(t, "arrest in the car in town", r, ["nan", "flat", "underground"]);
    await g(`(L3.setState("title"), true)`);
    await t.frames(10);

    // ── knocked out in the car in town ──
    if (!await intoTown()) return;
    await g(`(ctx.cameos && ctx.cameos.force ? (ctx.cameos.force.scene = false) : 0, ctx.G.invT = 0, ctx.G.invSoft = false, ctx.G.hearts = 1, L3.damage(5, "QA", "qa"), true)`);
    await t.until(`__lulu3d.state === "footRun"`, "back on her feet after the knock-out", 9000);
    await t.until(`__lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "walking", 6000);
    t.check("knocked out in town: she's still in town", await g(`ctx.town.active`));
    await t.stick(1, 0); await t.frames(40); await t.stick(0, 0);
    // ── and knocked out on foot in town ──
    await g(`(ctx.G.hearts = 1, ctx.G.invT = 0, ctx.foot.force.er = false, true)`);
    const c0 = await g(`(() => { const F = ctx.foot.debug.F; return !!ctx.traffic.add("sedan", F.s - 2.6, F.d, 1, 12, { keep: true }); })()`);
    if (c0) await t.until(`__lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "knock"`, "knocked flat by a minivan", 3000);
    await t.until(`__lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "up again", 9000);
    t.check("knocked out on foot in town: she gets up in town", await g(`ctx.town.active && L3.state === "footRun"`));
    await t.shot("ko-on-foot-in-town");
    r = await W.report(t); W.log(r);
    W.check(t, "knock-outs in town", r);
  },
};
