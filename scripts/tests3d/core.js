// Core driving: title → story drive with a fake controller, nitro, cameras,
// a head-on crash, pause/resume, settings, and arriving at Bubbe's house.
module.exports = {
  name: "core",
  async run(t) {
    await t.frames(20);
    t.check("controller detected on the title screen", await t.L(`document.querySelector(".pad-status.on") !== null`));
    await t.shot("title");

    // A on the first title item (Story Trip) → countdown → driving
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "playing"`, "A starts the drive (countdown → playing)")) return;
    t.check("A starts the drive (countdown → playing)", true);
    t.check("story mode", await t.game(`ctx.G.mode`) === "story");

    // hold the right trigger, weave with the left stick
    await t.hold(7, 1);
    const s0 = await t.game(`ctx.car.s`);
    for (let i = 0; i < 30; i++) { await t.stick((Math.sin(i / 4) * 0.5).toFixed(3)); await t.frames(3); }
    await t.stick(0);
    const s1 = await t.game(`ctx.car.s`);
    t.check("RT drives the car down the road", s1 - s0 > 40, `${(s1 - s0).toFixed(0)} m, ${(await t.game(`ctx.car.speed * 2.237`)).toFixed(0)} mph`);
    await t.shot("chase");

    // nitro
    await t.game(`ctx.G.boost = 1`);
    await t.hold(5, 1); await t.frames(4);
    t.check("RB fires the nitro", await t.game(`ctx.G.boosting === true`));
    await t.hold(5, 0);

    // camera cycle with Y → Lulu's eyes
    await t.tap(3); await t.tap(3); await t.frames(8);
    await t.shot("lulus-eyes");
    await t.tap(3);

    // head-on crash costs a heart and rumbles the pad
    const h0 = await t.game(`ctx.G.hearts`);
    await t.game(`(ctx.G.invT = 0, window.__rumbles = [], ctx.traffic.add("sedan", ctx.car.s + 14, ctx.car.d, -1, 22))`);
    await t.frames(40);
    const h1 = await t.game(`ctx.G.hearts`);
    t.check("a head-on crash costs a heart", h1 === h0 - 1, `${h0} → ${h1}`);
    t.check("the crash rumbles the controller", await t.L(`(window.__rumbles || []).some(r => r.s >= 0.9)`));

    // coins go straight into the shared (2D) wallet
    const w0 = await t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`);
    await t.game(`L3.addCoins(7, "test")`);
    await t.frames(40);
    const w1 = await t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`);
    t.check("coins land in the shared 2D wallet", w1 - w0 === 7, `${w0} → ${w1}`);

    // Start pauses (overlay), B resumes; the pause menu has Settings
    await t.tap(9);
    t.check("Start pauses", await t.game(`ctx.paused === true`));
    t.check("pause menu lists Settings", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Settings/.test(b.textContent))`));
    await t.shot("pause");
    await t.tap(1);
    t.check("B resumes", await t.game(`ctx.paused === false && ctx.state === "playing"`));

    // jump ahead to just before Bubbe's and drive under the arch
    await t.game(`(() => { const r = ctx.world.road, p = r.point(4800 - 120, 1.75, {});
      ctx.traffic.clear(); ctx.G.invT = 99; ctx.car.place(p.x, p.z, p.h); ctx.car.s = 4680; ctx.car.vx = Math.sin(p.h) * 25; ctx.car.vz = Math.cos(p.h) * 25; })()`);
    await t.frames(20);
    if (await t.until(`["arriving", "arrivedScreen"].includes(__lulu3d.state)`, "reaches Bubbe's house")) {
      t.check("reaches Bubbe's house", true);
      await t.frames(30);
      await t.shot("arriving");
      if (await t.until(`__lulu3d.state === "arrivedScreen"`, "arrival screen shows")) t.check("arrival screen shows", true);
      await t.hold(7, 0);
      await t.tap(0); // keep cruising
      t.check("A on the arrival screen keeps cruising", await t.game(`ctx.state === "playing"`));
    }

    // settings screen opens from the title and is navigable
    await t.tap(9); await t.frames(2);
    await t.game(`(document.querySelector("#screenCard .btn.purple") || {}).click && [...document.querySelectorAll("#screenCard .btn")].find(b => /Title/.test(b.textContent)).click()`);
    await t.until(`__lulu3d.state === "title"`, "back to the title screen");
    await t.game(`[...document.querySelectorAll("#screenCard .btn")].find(b => /Settings/.test(b.textContent)).click()`);
    t.check("settings screen opens", await t.L(`!!document.querySelector("#set_quality")`));
    await t.tap(13); await t.tap(0);  // D-pad down + A on a setting
    t.check("settings stay open after toggling", await t.L(`!!document.querySelector("#set_quality")`));
    await t.shot("settings");
  },
};
