// 📱 The phone sweep, part 4 — THE FIRSTS after the first drive, on a phone held upright (390 × 844, touch): the first
// time she's wanted (the stars, a chase, the bust → the cell / court), the first knock-out (→ the ER), and coming home.
// At each: what's on the screen (logged), no controller words, no `undefined`, nothing off the sides, and the HUD pieces
// clear of each other. Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweepphone/.
const { make, W } = require("../lib/sweepphone.js");

module.exports = {
  name: "sweepphone4",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 120, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, best: 900, f: { meta: { tutorialDone: true } } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t), g = t.game;
    await W.install(t);
    const touch = () => t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await touch();
    const look = async (label, n = 3, every = 45) => {
      for (let i = 0; i < n; i++) {
        await t.frames(every);
        await touch();
        await S.shot(`${label}-${i}`);
        await S.dump(`${label} ${i}`);
      }
      await S.badText(label, { touch: true, w: 390 });
    };
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`); await t.until(`__lulu3d.state === "playing"`, "in the car", 30000); }
    await g(`(ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    // the first time wanted: a cop sees her run a light (a 1-star charge) → the HUD's stars + the chase
    await g(`(ctx.law.addWanted(["RECKLESS DRIVING"]), true)`);
    await look("20-wanted", 3, 40);
    // busted → whatever the law does next (a cell, court): every screen readable on a phone
    await g(`(ctx.law.arrest(["RECKLESS DRIVING"]), true)`);
    const seen = [];
    for (let k = 0; k < 40; k++) {
      await t.frames(30);
      await touch();
      const st = await g(`L3.state`);
      if (!seen.includes(st)) { seen.push(st); await S.shot(`21-law-${st}`); await S.dump(`law ${st}`); await S.badText(`law: ${st}`, { touch: true, w: 390 }); }
      if (st === "playing" || st === "footRun") break;
      // answer whatever's asked (the first option), tap through lines
      await t.L(`(() => { const o = document.querySelector("#dialog .opt"); if (o) { o.click(); o.click(); return 1; } const b = document.querySelector("#screenCard button"); if (b) { b.click(); return 2; } const d = document.getElementById("dialog"); if (d && d.classList.contains("open")) d.click(); return 0; })()`);
    }
    S.log("law states: " + seen.join(" → "));
    // the first knock-out → the ER
    if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`); await t.frames(20); }
    if (await g(`L3.state !== "playing"`)) { await g(`(L3.setState("playing"), true)`); await t.frames(5); }
    await g(`(ctx.law.clearHeat && ctx.law.clearHeat(), ctx.cameos && ctx.cameos.force ? (ctx.cameos.force.scene = false) : 0, ctx.G.invT = 0, ctx.G.invSoft = false, ctx.G.hearts = 1, L3.damage(5, "QA", "qa"), true)`);
    const seen2 = [];
    for (let k = 0; k < 40; k++) {
      await t.frames(30);
      await touch();
      const st = await g(`L3.state`);
      if (!seen2.includes(st)) { seen2.push(st); await S.shot(`22-ko-${st}`); await S.dump(`KO ${st}`); await S.badText(`KO: ${st}`, { touch: true, w: 390 }); }
      if (seen2.length > 1 && (st === "playing" || st === "footRun")) break;
      await t.L(`(() => { const o = document.querySelector("#dialog .opt"); if (o) { o.click(); o.click(); return 1; } const b = document.querySelector("#screenCard button"); if (b) { b.click(); return 2; } const d = document.getElementById("dialog"); if (d && d.classList.contains("open")) d.click(); return 0; })()`);
    }
    S.log("KO states: " + seen2.join(" → "));
    // home: ctx.onegame.home()
    await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home({ via: "test" }) : 0, true)`);
    await t.until(`__lulu3d.state === "footRun"`, "home on foot", 30000);
    await look("23-home", 2, 60);
  },
};
