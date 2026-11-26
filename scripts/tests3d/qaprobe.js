// 🔬 QA probe (not a sweep test — a one-off look): on foot in the rest area ahead on the one world's lap, a monkey run
// with the watchdog's flat-picture check every 12 frames; a screenshot + where she / the camera are when it goes flat.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qaprobe",
  query: "&enable=all,unstuck",
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
    await g(`(ctx.law.hold(1e6), ctx.G.hearts = 99, ctx.G.maxHearts = 99, true)`);
    // as unstuck.js: 1,200 + 1,800 m on, then the rest area ahead
    const S0 = +(process.env.QAPROBE_S || 13600);
    for (const k of [S0]) await g(`(() => { const r = ctx.world.road, s = ${k}, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    const RS = await g(`ctx.exits && ctx.exits.debug.restAhead(500)`);
    console.log("   rest area at", RS, "lap metre", RS % 16000);
    if (typeof RS !== "number" || !await t.until(`__lulu3d.ctx.exits.debug.modelsReady()`, "rest-area models", 60000)) return;
    await W.moved(t);
    await g(`(() => { const r = ctx.world.road, s = ${RS} + 150, p = r.point(s, 28, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 28; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    await t.frames(20);
    await g(`(ctx.foot.start("droveOff"), true)`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on foot in the rest area", 8000);
    await W.reset(t);
    let r = 31, shots = 0;
    const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let f = 0; f < 2400; f += 12) {
      await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1.2).toFixed(2)}, __pad.axes[2] = ${rnd() < 0.3 ? (rnd() * 2 - 1).toFixed(2) : 0}, true)`);
      await t.frames(12);
      const fl = await g(`(() => { const fl = window.__qa.Q ? null : null; const F = ctx.foot.debug.F, k = ctx.camera.position, d = ctx.camera.getWorldDirection(new k.constructor());
        const ff = window.__qaFlat ? window.__qaFlat() : null; return { ff, lulu: F ? [+F.pos.x.toFixed(1), +F.pos.z.toFixed(1), +(F.y || 0).toFixed(1)] : null, cam: [+k.x.toFixed(1), +k.y.toFixed(1), +k.z.toFixed(1)], look: [+d.x.toFixed(2), +d.y.toFixed(2), +d.z.toFixed(2)], state: L3.state, s: F ? Math.round(F.s) : null, d: F ? +(+F.d).toFixed(1) : null }; })()`);
      const iss = await t.L(`window.__qa.issues.filter(i => i.kind === "flat").length`);
      if (iss > shots && shots < 4) { shots++; console.log("   FLAT:", JSON.stringify(fl)); await t.shot("flat-" + shots); }
    }
    await t.L(`(__pad.axes[0] = __pad.axes[1] = __pad.axes[2] = 0, true)`);
    const rep = await W.report(t); W.log(rep); W.check(t, "rest area on foot", rep, ["flat", "inwall", "inside", "underground"]);
  },
};
