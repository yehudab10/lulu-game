// TEMP debug (not committed)
module.exports = {
  name: "uwdebug", query: "&enable=underworld", save2d: { totalCoins: 600 },
  async run(t) {
    const g = t.game, D = "ctx.underworld.debug";
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "plays", 90000);
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.banter.autopilot = { d: 1.75, speed: 20 }, ${D}.UW.runT = 200, ${D}.UW.nextT = 1e9, true)`);
    await g(`ctx.underworld.spawn("gang", { behind: 40, tail: 120 })`);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.phase === "tail"; })()`, "tail", 40000);
    console.log("reasons", await g(`ctx.community.reasons("shomrim")`));
    console.log("call", await g(`ctx.community.call("shomrim", "uwBadGuy")`));
    for (let i = 0; i < 12; i++) {
      await t.frames(45);
      console.log(i, JSON.stringify(await g(`({ st: __lulu3d.state, ph: ctx.phone.active ? [ctx.phone.active.phase, ctx.phone.active.t.toFixed(1), ctx.phone.active.talk] : null,
        sh: ${D}.E && ${D}.E.shomrim ? { pending: ${D}.E.shomrim.pending, car: !!${D}.E.shomrim.car, gap: ${D}.E.shomrim.gapNow, caught: ${D}.E.shomrim.caught } : null,
        res: ${D}.E && ${D}.E.result, log: ${D}.log.slice(-3).map(e => e.ev + ":" + (e.phase || e.result || "")) })`)));
    }
  },
};
