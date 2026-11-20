// 🐞 QA: the town's real buildings (ci/places — the precinct, the courthouse, the hospital) in the ATTACHED towns, with the
// watchdog (scripts/lib/qawatch.js) on: walking into each with the real ✋ and back out of its door; arrested in the car in
// town all the way through (skipping / picking like a player in a hurry) and walking out; the ER after a knock-out in town
// and out of the hospital's door. Nothing left covering the screen, no state that hangs, no jumps, she ends in control.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qaplaces",
  query: "&enable=all",
  save2d: { totalCoins: 900, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const prompt = () => t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);
    // a player in a hurry: hold ○ through scenes, a visible choice / card button, ✕ — until she has control again
    const hurry = async (max, label) => {
      const seen = [];
      for (let f = 0; f < max; f += 26) {
        if (await t.L(`window.__qa.control()`)) { console.log(`   ${label}: through`, seen.join(" → ")); return true; }
        const st = await g(`L3.state`);
        if (seen[seen.length - 1] !== st) seen.push(st);
        await t.L(`(() => { const vis = e => !!(e && e.offsetParent && e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== "hidden");
          const b = [...document.querySelectorAll("#dialog .opt, #screenCard button, #lawBail")].find(vis); if (b) b.click(); return true; })()`);
        await t.hold(1, 1); await t.frames(18); await t.hold(1, 0); await t.tap(0);
      }
      console.log(`   ${label}: stuck in`, seen.join(" → "));
      return false;
    };
    const town = async id => {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.town.exits.length > 0`, "a cruise with its interchanges", 9000)) return false;
      await g(`(ctx.law.hold && ctx.law.hold(900), ctx.town.load("${id}"), ctx.civic.load(), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("${id}")`, `${id}'s models`, 90000)) return false;
      await W.moved(t);
      await g(`ctx.town.enter({ town: "${id}", exitS: ctx.town.exits[0].s, speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.civic.here`, `in ${id} with its buildings`, 20000)) return false;
      // (a clean record: by design a FUGITIVE — say she slipped out of the ER in the last town — can't walk into these)
      await g(`(ctx.law.fugitive && ctx.law.clearHeat ? ctx.law.clearHeat("") : 0, true)`);
      await t.frames(10);
      await W.reset(t);
      return true;
    };
    const carAt = async (kind, dist) => {
      await W.moved(t);
      return g(`(() => { const sp = ctx.civic.spot("${kind}"); if (!sp) return false; const car = ctx.car, p = { x: sp.x + sp.nx * ${dist}, z: sp.z + sp.nz * ${dist} }, n = ctx.world.road.nearest(p.x, p.z, car.s, {});
        car.place(p.x, p.z, n.h); car.s = n.s; car.d = n.d; car.vx = car.vz = car.vF = 0; ctx.cam.snap(); return true; })()`);
    };

    for (const id of ["lakewood", "midwood"]) {
      if (!await town(id)) continue;

      // ── walk into each with the ✋, and back out of its door ──
      await carAt("hospital", 12);
      await g(`(ctx.foot.start("droveOff"), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on foot", 6000);
      for (const kind of ["precinct", "court", "hospital"]) {
        await W.moved(t);
        await g(`(() => { const sp = ctx.civic.spot("${kind}"), F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); F.vel.set(0, 0, 0); return true; })()`);
        await t.frames(6);
        await W.reset(t);
        const p = await prompt();
        t.check(`${id}: at the ${kind}'s door the ✋ offers it`, /ENTER|COURT|POLICE|PRECINCT|HOSPITAL|ER\b/i.test(p), p);
        await t.tap(0);
        if (!await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready`, `${id}: inside the ${kind}`, 60000)) continue;
        await t.frames(30);
        await t.shot(`${id}-${kind}-in`);
        await g(`(window.__interiors.room.leave(), true)`);
        await t.until(`__lulu3d.state === "footRun"`, `${id}: out of the ${kind}`, 20000);
        await t.frames(30);
        const d = await g(`(() => { const sp = ctx.civic.spot("${kind}"), p = ctx.foot.pos; return +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1); })()`);
        t.check(`${id}: out of the ${kind}'s own door, still in town (${d} m)`, d < 7 && await g(`ctx.town.active`));
        await seg(`${id}: in and out of the ${kind}`);
      }

      // ── arrested in the car in town → the precinct → … → walking out ──
      if (await g(`L3.state === "footRun"`)) { await g(`ctx.foot.debug.getIn()`); await t.until(`__lulu3d.state === "playing"`, "back in", 4000); }
      await carAt("precinct", 40);
      await t.frames(4);
      await W.reset(t);
      await g(`ctx.law.arrest(["DOUBLE PARKING (TRIPLE, ACTUALLY)"])`);
      await t.until(`__lulu3d.state === "lawArrest"`, `${id}: arrested in town`, 10000);
      const out = await hurry(3600, `${id}: arrested`);
      t.check(`${id}: arrested in town → she ends up back in control`, out, await g(`L3.state`));
      await t.frames(40);
      t.check(`${id}: …still in town, nothing covering the screen`, await g(`ctx.town.active`) && (await t.L(`window.__qa.covered()`)).length === 0, JSON.stringify(await t.L(`window.__qa.covered()`)));
      await t.shot(`${id}-after-arrest`);
      await seg(`${id}: arrested in town → out`, ["jump", "nan", "overlay", "flat", "underground", "stuck", "hidden"]);

      // ── the ER after a knock-out in town → out of the hospital's door ──
      if (await g(`L3.state === "footRun"`)) {
        await W.reset(t);
        await g(`ctx.er.admit("knockout", { force: { intro: false, visitor: false } })`);
        const back = await hurry(2400, `${id}: the ER`);
        t.check(`${id}: the ER in town → back in control`, back, await g(`L3.state`));
        await t.frames(40);
        const d = await g(`(() => { const sp = ctx.civic.spot("hospital"), p = ctx.foot.active ? ctx.foot.pos : ctx.car.pos; return sp ? +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1) : -1; })()`);
        console.log(`   ${id}: after the ER, ${d} m from the hospital door, town ${await g(`ctx.town.active`)}`);
        t.check(`${id}: …nothing covering the screen`, (await t.L(`window.__qa.covered()`)).length === 0, JSON.stringify(await t.L(`window.__qa.covered()`)));
        await t.shot(`${id}-after-er`);
        await seg(`${id}: the ER in town → out`, ["jump", "nan", "overlay", "flat", "underground", "stuck", "hidden"]);
      }
    }
  },
};
