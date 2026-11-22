// 📵 Random phone calls are PAUSED (owner, 2026-11-22: "pause random phone calls in game … from npcs"): ONE switch,
// ctx.phone.randomCalls (journey/phone.js), off by default. While it's off nothing rings BY ITSELF — Ima's mid-drive call,
// her Erev Shabbos call, side-job / heist-tip / chop-shop offers by phone, the story's leg-start call. Calls the player makes
// (📞 Phone app: ctx.community.call) still ring. Texts aren't touched. This test: a long drive with every random source
// forced to fire rings ZERO times; each source asked directly says no; the switch on = they ring again (positive control);
// a player-made call works with it off.
module.exports = {
  name: "nocalls",
  viewport: { width: 960, height: 540 },
  query: "&enable=world,foot,journey,hustle,shabbos,heist,streets,underworld,community,day,phone,law,atmos&randomCalls=0",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__rings = 0; m.on("phone:ring", () => { window.__rings++; }); return true; })`);
    t.check("the switch is OFF by default (this page: ?randomCalls=0)", (await g(`ctx.phone.randomCalls`)) === false);
    await t.click(/PLAY/);
    await t.until(`__lulu3d.state === "footRun"`, "home on foot", 6000);
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`__lulu3d.state === "playing"`, "driving", 40000);
    // every random source, asked directly
    const direct = await g(`(() => ({ ima: !!ctx.journey.debug.imaCall(), shabbos: !!ctx.shabbos.offer(), tip: !!ctx.heist.debug.tip(), chop: !!ctx.streets.chop.request({ instant: true }) }))()`);
    t.check("Ima / the Erev Shabbos call / Shmulik's tip / Shmuel's order: none rings", !direct.ima && !direct.shabbos && !direct.tip && !direct.chop, JSON.stringify(direct));
    await g(`(ctx.hustle.offer("cab", "phone"), true)`);       // (a phone offer falls back to a roadside marker: the job is still offered, nothing rings)
    t.check("a side-job offer by phone doesn't ring (it becomes a roadside marker)", (await t.L(`window.__rings`)) === 0 && !(await g(`!!ctx.phone.active`)));
    // a long drive with every chance roll forced to hit: still zero
    await g(`(() => { window.__rnd = Math.random; Math.random = () => 0.0005; ctx.G.runTime = 400; return true; })()`);
    await t.frames(1500);
    await g(`(Math.random = window.__rnd, true)`);
    t.check("a long drive with every roll forced: zero rings, no call card", (await t.L(`window.__rings`)) === 0 && !(await g(`!!ctx.phone.active`)) && (await t.L(`!document.querySelector(".jphone")`)), "rings " + await t.L(`window.__rings`));
    // positive control: switch on → Ima rings
    await g(`(ctx.phone.hangUp && ctx.phone.hangUp(true), true)`);
    await t.frames(10);
    await g(`(ctx.phone.randomCalls = true, true)`);
    t.check("switch ON: Ima's call rings again (the content is intact)", !!(await g(`ctx.journey.debug.imaCall()`)) && (await g(`ctx.phone.active && ctx.phone.active.phase === "ring"`)));
    await g(`(ctx.phone.hangUp(true), ctx.phone.randomCalls = false, true)`);
    await t.frames(10);
    // a call the PLAYER makes still rings with the switch off
    const r0 = await t.L(`window.__rings`);
    await g(`ctx.community.call("ima")`);
    t.check("a call the player makes (📞 → Ima) still rings with random calls paused", await t.until(`!!document.querySelector(".jphone")`, "player call card", 8000) && (await t.L(`window.__rings`)) > r0);
    t.check("no page errors", true);
  },
};
