// 🐞 QA sweep, part 8 — THE SHOPS (ci/shops), with the watchdog (scripts/lib/qawatch.js) on: a test drive at Uncle
// Refael's interrupted at odd moments — paused on its last second (the clock must stop under the pause menu), 🆘 mid-drive
// (still a test drive), knocked out in it (the car goes back, she's on her feet), time running out far down the street
// (back at the lot, no jump), climbing out mid-drive; a monkey run in the pizza room; the "Where to shop" mark re-aims at
// an exit once she's out of town.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa8",
  query: "&enable=all",
  save2d: { totalCoins: 2000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game, D = "ctx.shops.debug.dealer";
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.law.hold && ctx.law.hold(1e6), ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await W.moved(t);
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.frames(30);
    if (!await t.check("the dealership stands here", await g(`!!ctx.town.spot("lot_red")`))) return;
    // on foot on the lot's sidewalk, then a test drive of the red one (as the card's 🔑 Test drive does)
    const startTest = async label => {
      await W.moved(t);
      if (await g(`L3.state !== "footRun"`)) { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000); }
      await g(`(() => { const sp = ctx.town.spot("lot_red"), F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 0.6, 0.05, sp.z + sp.nz * 0.6); F.phase = "walk"; ctx.cam.snap(); return true; })()`);
      await t.frames(6);
      const ok = await g(`${D}.startTest("red")`);
      const on = ok && await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.car.skinKey === "red" && __lulu3d.ctx.shops.debug.dealer.TD.on`, `${label}: test driving`, 8000);
      t.check(`${label}: a test drive starts`, !!on);
      await t.frames(10);
      await W.reset(t);
      return on;
    };
    const own = () => g(`ctx.car.skinKey`);

    // 1 · paused on the very last second: the clock stops under the pause menu
    if (await startTest("paused")) {
      // (away from the lot first: parked at its kerb after 6 s counts as "brought it back")
      await t.hold(7, 0.6); await t.frames(90); await t.hold(7, 0); await t.hold(6, 1); await t.frames(30); await t.hold(6, 0);
      await g(`(${D}.TD.t = ${D}.TEST.secs - 1, true)`);
      await t.tap(9);
      await t.until(`__lulu3d.ctx.paused`, "paused", 3000);
      await t.frames(90);                    // (3 s of game time with the menu up)
      t.check("paused on its last second: still a test drive under the pause menu", await g(`${D}.TD.on && L3.state === "playing" && ctx.car.skinKey === "red"`), JSON.stringify(await g(`({ on: ${D}.TD.on, state: L3.state, t: ${D}.TD.t })`)));
      await t.tap(1); await t.frames(6);
      // 2 · 🆘 mid-drive: still a test drive, still the red car
      if (await g(`!!ctx.unstuck`)) {
        await g(`(${D}.TD.t = 10, ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.now(), true)`);
        await t.frames(12);
        t.check("🆘 mid test drive: still a test drive, in the red car", await g(`${D}.TD.on && ctx.car.skinKey === "red"`));
      }
      // 3 · time runs out far down the street: back on her feet at the lot, her own car at the kerb, no jump
      await t.hold(7, 0.6); await t.frames(120); await t.hold(7, 0);
      await g(`(${D}.TD.t = ${D}.TEST.secs + 1, true)`);
      t.check("time's up far from the lot: back on her feet at the lot", await t.until(`__lulu3d.state === "footRun" && !__lulu3d.ctx.shops.debug.dealer.TD.on`, "test over", 10000));
      t.check("…in her own car's colours again", await own() === "pink" || await own() !== "red", await own());
      await t.frames(30);
      await seg("a test drive: paused / 🆘 / time's up down the street", ["nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "inside", "jump"]);
    }

    // 4 · knocked out in the test car: it goes back, she's on her feet
    if (await startTest("knocked out")) {
      await g(`(ctx.cameos && ctx.cameos.force ? (ctx.cameos.force.scene = false) : 0, ctx.G.invT = 0, ctx.G.invSoft = false, ctx.G.hearts = 1, L3.damage(5, "QA", "qa"), true)`);
      await t.until(`!__lulu3d.ctx.shops.debug.dealer.TD.on`, "the test drive ends with the wreck", 6000);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on her feet after the knock-out", 15000);
      t.check("knocked out in the test car: the drive ended, the red car isn't hers", await g(`!${D}.TD.on && ctx.car.skinKey !== "red"`), await own());
      await t.frames(30);
      await seg("a test drive: knocked out in it", ["nan", "overlay", "flat", "underground", "hidden", "stuck", "inside"]);
    }

    // 5 · climbing out mid-drive
    if (await startTest("out")) {
      await t.hold(7, 0.5); await t.frames(60); await t.hold(7, 0); await t.hold(6, 1); await t.frames(40); await t.hold(6, 0);
      await g(`(ctx.foot.start("droveOff"), true)`);
      await t.until(`!__lulu3d.ctx.shops.debug.dealer.TD.on`, "the test drive ends when she gets out", 8000);
      await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000);
      t.check("climbing out of the test car: the drive ends, she's on foot, her own car is hers", await g(`!${D}.TD.on && ctx.car.skinKey !== "red" && L3.state === "footRun"`), await own());
      await t.frames(30);
      await seg("a test drive: climbing out mid-drive", ["nan", "overlay", "flat", "underground", "hidden", "stuck", "inside", "jump"]);
    }

    // 6 · the pizza room: in through its door, a monkey run, out
    if (await g(`L3.state === "footRun" && !!ctx.shops.enterShop`)) {
      await W.moved(t);
      const inside = await g(`ctx.shops.enterShop("pizza")`) && await t.until(`__lulu3d.state === "interior" && window.__interiors && window.__interiors.room && window.__interiors.room.ready`, "inside the pizza shop", 60000);
      if (inside) {
        await t.frames(20);
        let r = 23;
        const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
        for (let k = 0; k < 600; k += 6) {
          await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1).toFixed(2)}, true)`);
          await t.frames(6);
          if (await g(`L3.state !== "interior"`)) break;
        }
        await t.L(`(__pad.axes[0] = __pad.axes[1] = 0, true)`);
        const p = await g(`(() => { const r = window.__interiors.room; if (!r || !r.lulu) return null; const q = r.lulu.obj.position, b = r.bounds; return { x: q.x, z: q.z, inB: q.x >= b.x0 - 0.6 && q.x <= b.x1 + 0.6 && q.z >= b.z0 - 0.6 && q.z <= b.z1 + 0.6 }; })()`);
        t.check("the pizza shop: 600 frames of mashing — she's still inside its walls", !p || p.inB, JSON.stringify(p));
        await t.shot("pizza-monkey");
        if (await g(`L3.state === "interior"`)) { await g(`(window.__interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out of the pizza shop", 15000); }
        await t.frames(20);
        await seg("the pizza shop: in, a monkey run, out", ["nan", "overlay", "stuck"]);
      }
    }

    // 7 · "Where to shop": a beam to the dealership — gone when she leaves town
    if (await g(`!!ctx.shops.setDest`)) {
      await g(`(ctx.shops.setDest("dealer"), true)`);
      await t.frames(20);
      const lit = await g(`!!ctx.shops.dest()`);
      t.check("Where to shop: the dealership is marked", lit);
      await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`);
      await t.frames(40);
      const chipT = await t.L(`(() => { const e = [...document.querySelectorAll(".day-chip, .shops-chip, [class*=chip]")].find(e => /Shopping/.test(e.textContent)); return e ? e.textContent : ""; })()`);
      t.check("…out of town, the mark points at an exit (not at the town that's gone)", !chipT || /exit|in town/i.test(chipT), chipT);
      await g(`(ctx.shops.setDest && ctx.shops.setDest(null), true)`);
    }
  },
};
