// 🎯 ONE ACTIVITY AT A TIME (ci/hud, 2026-11-26 — the owner's friend was on a timed kugel delivery, in a chase, and was
// offered a robbery to foil at the same time). core/ctx.js › ctx.engaged(except): while she's IN something (a chase, a side
// job, a heist thing, the 🅿️ challenge, the Shabbos rush, a bad-guy encounter) no new world event is started or offered.
// Checks: free on the open road → the robbery scheduler stages one, and that robbery IS an activity; on a side job the
// robbery scheduler, the Fixer, cameos and the hustle phone stay quiet (engaged() says "job"); a chase outranks it.
module.exports = {
  name: "oneact",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=hustle,heist",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "PLAY: the run starts", 20000)) return;
    await g(`(ctx.law.hold(99999), true)`);
    if (await g(`ctx.state === "footRun"`)) await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`);
    if (!await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "in the car", 20000)) return;
    if (await g(`ctx.town.active`)) { await g(`ctx.town.leave("quiet")`); await t.until(`!__lulu3d.ctx.town.active`, "on the highway", 30000); }
    await g(`(ctx.traffic.config.enabled = false, ctx.roadevents && (ctx.roadevents.auto = false), true)`);
    await t.frames(20);
    t.check("the open road: no activity", await g(`ctx.engaged() === ""`), await g(`ctx.engaged()`));

    // free → the robbery scheduler stages one, and then she's in it
    t.check("free: the robbery scheduler stages a robbery to foil", await g(`ctx.heist.debug.schedRobbery()`));
    t.check("…and a robbery to foil is an activity", await g(`ctx.engaged() === "heist"`), await g(`ctx.engaged()`));
    t.check("…its own scheduler still sees itself (engaged(\"heist\") is free)", await g(`ctx.engaged("heist") === ""`));
    await g(`(ctx.heist.debug.endRobbery && ctx.heist.debug.endRobbery(), ctx.heist.debug.R.ev = null, true)`);
    await t.frames(10);
    t.check("robbery over: free again", await g(`ctx.engaged() === ""`), await g(`ctx.engaged()`));

    // a side job → nothing new is offered
    const job = await g(`!!ctx.hustle.start("delivery", { via: "test", intro: false })`);
    t.check("a side job starts", job);
    t.check("…and it's the activity", await g(`ctx.engaged() === "job"`), await g(`ctx.engaged()`));
    t.check("on a job: no robbery to foil is staged", await g(`!ctx.heist.debug.schedRobbery() && !ctx.heist.robbery`));
    // a minute of driving with cameos on: nothing new pops up while she's on the job
    const cam0 = await g(`ctx.cameos ? ctx.cameos.log.length : 0`);
    await g(`(ctx.cameos && (ctx.cameos.auto = true), ctx.roadevents.autopilot = { d: 1.75, speed: 24 }, true)`);
    await t.frames(30 * 20);
    t.check("on a job: no new robbery, cameo or bad-guy car in 20 s of driving", await g(`!ctx.heist.robbery && !(ctx.underworld && ctx.underworld.enc)`) && await g(`(ctx.cameos ? ctx.cameos.log.length : 0) === ${cam0}`));

    // a chase outranks the job
    await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("SPEEDING", { heat: 1 }), true)`);
    await t.frames(10);
    t.check("a chase on top: the chase is the activity", await g(`ctx.engaged() === "chase"`), await g(`ctx.engaged()`));
    t.check("…and the robbery scheduler still refuses", await g(`!ctx.heist.debug.schedRobbery()`));
    // the HUD: the chase is the one full objective on a phone, the job a badge with its clock
    await t.frames(10);
    const ob = await t.L(`__lulu3d.H.objectives()`);
    t.check("the HUD: the chase is the objective, the job folds to a badge", ob.main[0] === "chase" && ob.badges.includes("job") && ob.full === 1, JSON.stringify(ob));
  },
};
