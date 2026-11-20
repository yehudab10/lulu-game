// 🐞 QA sweep, part 5 (every feature on, the watchdog in scripts/lib/qawatch.js on): the LONG ways back — arrested in a
// town and all the way through the scenes (jail, court…) back to the road, skipping and picking like a player in a hurry
// (hold ○ to skip, ✕ for the first choice); and knocked out on foot on the highway with the ER forced. Nothing may be left
// covering the screen afterwards, no state may hang, and she must end up in control.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa5",
  query: "&enable=all",
  save2d: { totalCoins: 600, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    // a player in a hurry: hold ○ through scenes, ✕ on any choice / card, until she has control again (or `max` frames)
    const hurry = async (max, label) => {
      const seen = new Set();
      for (let f = 0; f < max; f += 26) {
        if (await t.L(`window.__qa.control()`)) { console.log(`   ${label}: through`, [...seen].join(" → ")); return true; }
        const st = await g(`L3.state + (ctx.dialogOpen ? "+dialog" : "") + (ctx.paused ? "+paused" : "")`);
        if (!seen.has(st)) { seen.add(st); console.log(`   ${label}: f+${f} ${st}`); }
        // (only a VISIBLE choice / card button — a closed card keeps its old buttons in the page)
        const clicked = await t.L(`(() => { const vis = e => !!(e && e.offsetParent && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden");
          const b = [...document.querySelectorAll("#dialog .opt, #screenCard button")].find(vis); if (b) { b.click(); return b.textContent.trim().slice(0, 30); } return null; })()`);
        if (clicked) { if (!seen.has("click:" + clicked)) { seen.add("click:" + clicked); console.log(`   ${label}: f+${f} clicked "${clicked}"`); } await t.frames(4); }
        await t.hold(1, 1); await t.frames(18); await t.hold(1, 0); await t.tap(0);       // (⏭ skip = hold ○ 0.45 s)
      }
      console.log(`   ${label}: stuck in`, [...seen].join(" → "), "now", await g(`L3.state`));
      return false;
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await W.moved(t);
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000);
    await t.frames(10);
    await W.reset(t);

    // ── arrested in town, all the way back ──
    await g(`(ctx.law.arrest(["RECKLESS DRIVING", "GRAND THEFT MINIVAN"]), true)`);
    await t.until(`__lulu3d.state === "lawArrest"`, "the arrest scene", 3000);
    const back = await hurry(2400, "arrested in town");
    t.check("arrested in town: she comes back to the road and drives / walks on", back, await g(`L3.state`));
    await t.frames(40);
    t.check("…nothing left covering the screen", (await t.L(`window.__qa.covered()`)).length === 0, JSON.stringify(await t.L(`window.__qa.covered()`)));
    await t.shot("after-jail");
    await seg("arrested in town → back on the road", ["jump", "nan", "overlay", "flat", "underground", "stuck", "hidden"]);

    // ── knocked out on foot on the highway, the ER forced ──
    // (a fresh drive on the highway — taking the town away from under her while she stands in it on foot leaves her in
    //  empty space: ctx.town.leave() moves only the car; see AGENTS §7 › QA sweep)
    await W.moved(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.town.active`, "a fresh cruise", 9000);
    await t.frames(5);
    if (await g(`L3.state === "playing"`)) { await g(`(ctx.foot.start("droveOff"), true)`); await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on foot on the highway", 6000); }
    await W.moved(t);
    await g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, p = r.point(F.s, 1.75, {}); F.pos.set(p.x, 0, p.z); ctx.G.invT = 0; ctx.G.invSoft = false; ctx.G.hearts = 1; ctx.foot.force.er = true; ctx.traffic.clear(); ctx.traffic.add("sedan", F.s - 2.6, 1.75, 1, 14, { keep: true }); return true; })()`);
    await t.frames(1);
    await g(`(ctx.G.invT = 0, ctx.G.invSoft = false, true)`);
    await t.until(`__lulu3d.state !== "footRun" || (__lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "knock")`, "knocked out on foot", 3000);
    const back2 = await hurry(1800, "the ER");
    await g(`(ctx.foot.force.er = null, true)`);
    t.check("after the ER: back in control", back2, await g(`L3.state`));
    await t.frames(40);
    t.check("…nothing left covering the screen", (await t.L(`window.__qa.covered()`)).length === 0, JSON.stringify(await t.L(`window.__qa.covered()`)));
    await t.shot("after-er");
    await seg("knocked out on foot → the ER → back", ["jump", "nan", "overlay", "flat", "underground", "stuck", "hidden"]);
  },
};
