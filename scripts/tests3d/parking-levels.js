// 🅿️ THE PARKING CHALLENGE — EVERY LEVEL, DRIVEN (ci/parkinglot): on a rest area's real lot, the tests' autopilot
// (ctx.parking.debug.autopark: a reverse parallel park with her car's own physics, through the "controls" hook like the
// banter autopilot) parks levels 1 → 10 in one run — the cones, the stray cart, the pedestrian who steps round her, the
// cars cutting through, Sasquatch — pulling out into the lane between levels while the course re-sets round her. The run
// ends with the attendant's board (no card), MASTER PARKER, best level 10 in the shared save, ⭐ for every level, and the
// QA watchdog sees no cut. (A separate file from parking.js so the full suite gives it a machine of its own.)
const W = require("../lib/qawatch.js");
const S = `__lulu3d.ctx.parking._debug`;
module.exports = {
  name: "parking-levels",
  save2d: { totalCoins: 100, parkingUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const g = c => t.game(c);
    await t.frames(10);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "driving")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.exits.debug.restAhead(320))`);
    if (!await t.until(`__lulu3d.ctx.parking.debug.courses().length > 0`, "the rest area's 🅿️ course", 30000)) return;
    await W.install(t);
    await W.pause(t, false); await g(`ctx.parking.debug.toBox()`); await t.frames(4); await W.pause(t, true); await W.moved(t);
    if (!await t.until(`__lulu3d.state === "parking" && ${S}.phase === "drive"`, "level 1 starts in the START box", 30000)) return;
    await g(`(window.__pkRes = [], ctx.parking.debug.autopark(true), true)`);
    // (✕ through each result as it comes, and log what each level scored)
    const t0 = Date.now();
    let last = 0;
    while (Date.now() - t0 < 7200000) {      // (wall clock: a CI machine in software WebGL can be slow)
      const st = await g(`({ st: ctx.state, ph: ctx.parking._debug.phase, lvl: ctx.parking._debug.level, res: ctx.parking._debug.result, stars: ctx.parking._debug.stars, end: ctx.parking._debug.endStats })`);
      if (st.st !== "parking") break;
      if (st.ph === "result") {
        const key = st.lvl * 10 + (st.res === "success" ? 1 : 0);
        if (key !== last) { last = key; await g(`(window.__pkRes.push({ lvl: ${st.lvl}, res: "${st.res}", stars: ${st.stars || 0} }), true)`); }
        await t.tap(0);
      }
      await t.frames(20);
    }
    const res = await g(`window.__pkRes`);
    const es = await g(`ctx.parking._debug.endStats`);
    console.log("   LEVELS", JSON.stringify(res));
    t.check("the autopilot parks all ten levels on the real lot (each one reachable + completable)", !!es && es.victory === true && es.why === "victory", JSON.stringify(es));
    const ok = res.filter(r => r.res === "success");
    t.check("…every level parked, each for ⭐ or more", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].every(l => ok.some(r => r.lvl === l && r.stars >= 1)), JSON.stringify(ok.map(r => r.lvl + ":" + r.stars)));
    t.check("…no card at the end: driving again, the attendant's board up", await g(`ctx.state === "playing" && !!ctx.parking._debug.board`));
    const s2 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2"))`);
    t.check("…best level 10 in the shared save, the stars added up", s2.parkingBestLevel === 10 && s2.parkingTotalStars === ok.reduce((a, r) => a + r.stars, 0), JSON.stringify([s2.parkingBestLevel, s2.parkingTotalStars]));
    await t.shot("all-ten");
    await g(`ctx.parking.debug.autopark(false)`);
    W.check(t, "ten levels on the lot", await W.report(t));
  },
};
