// 🐞 QA sweep, part 2 (every feature on, the watchdog in scripts/lib/qawatch.js on): Midwood on foot (+ a monkey run),
// in and out of a house, a rest area on foot (+ a monkey run), and home for dinner.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa2",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const monkey = async (frames, seed) => {
      let r = seed;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let f = 0; f < frames; f += 6) {
        await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1.2).toFixed(2)}, __pad.axes[2] = ${rnd() < 0.3 ? (rnd() * 2 - 1).toFixed(2) : 0}, __pad.axes[3] = ${rnd() < 0.15 ? (rnd() * 2 - 1).toFixed(2) : 0}, true)`);
        const b = [0, 1, 2, 3, 7, 6, null, null][Math.floor(rnd() * 8)];
        if (b != null) await t.L(`__btn(${b}, 1)`);
        await t.frames(3);
        if (b != null) await t.L(`__btn(${b}, 0)`);
        await t.frames(3);
      }
      await t.L(`(__pad.axes[0] = __pad.axes[1] = __pad.axes[2] = __pad.axes[3] = 0, true)`);
    };
    const onFoot = async () => {
      await g(`(ctx.foot.start("droveOff"), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;

    // ── Midwood: get out, walk about, a monkey run ──
    await g(`(ctx.town.load("midwood"), true)`);
    if (await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 90000)) {
      await g(`ctx.town.enter({ town: "midwood", speed: 0 })`);
      await t.until(`__lulu3d.ctx.town.active`, "in Midwood", 8000);
      await t.hold(7, 1); await t.frames(50); await t.hold(7, 0); await t.hold(6, 1); await t.frames(40); await t.hold(6, 0);
      await W.reset(t);
      if (await onFoot()) {
        for (const [x, y, n] of [[1, 0, 40], [1, -1, 60], [0, 1, 40], [-1, 0, 80], [0, -1, 60]]) { await t.stick(x, y); await t.frames(n); }
        await t.stick(0, 0);
        await monkey(600, 11);
        await t.shot("midwood-monkey");
        await seg("Midwood on foot + monkey");
      }
      // ── in and out of a house (a knock / a sneak) ──
      if (await g(`L3.state !== "footRun"`)) { await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, true)`); await onFoot(); }
      await t.until(`__lulu3d.ctx.homes && __lulu3d.ctx.homes.homes().length > 0`, "front doors", 30000);
      await g(`(() => { const h = ctx.homes.homes()[3], f = ctx.foot.pos; f.set(h.ap.x, 0.05, h.ap.z); ctx.foot.obj.position.copy(f); return true; })()`);
      await t.frames(4);
      await W.reset(t);
      await g(`ctx.homes.enter(3, "sneak", "door")`);
      if (await t.until(`__lulu3d.state === "interior"`, "inside a house", 60000)) {
        await t.frames(60);
        await g(`(() => { const c = ctx.homes.debug.VISIT.cur; if (c) { c.V.exit = "door"; c.rt.leave(); } return true; })()`);
        await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000);
        await t.frames(40);
        t.check("out of the house: still in Midwood, on foot", await g(`ctx.town.active && L3.state === "footRun"`));
        await seg("in and out of a house");
      }
      await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`);
      await t.frames(5);
    }

    // ── a rest area on foot ──
    await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 1800, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    const RS = await g(`ctx.exits.debug.restAhead(500)`);
    if (typeof RS === "number" && await t.until(`__lulu3d.ctx.exits.debug.modelsReady()`, "rest-area models", 60000)) {
      await g(`(() => { const r = ctx.world.road, s = ${RS} + 150, p = r.point(s, 28, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 28; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.frames(20);
      await W.reset(t);
      if (await onFoot()) {
        for (const [x, y, n] of [[0, -1, 60], [1, 0, 60], [0, 1, 60], [-1, 0, 120]]) { await t.stick(x, y); await t.frames(n); }
        await t.stick(0, 0);
        await monkey(600, 23);
        await t.shot("rest-monkey");
        await seg("rest area on foot + monkey");
      }
    } else t.check("a rest area to walk", false, String(RS));

    // ── home for dinner ──
    await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`);
    if (await g(`!!(ctx.places && ctx.places.home && ctx.places.home.comeHome)`)) {
      await W.reset(t);
      await g(`(ctx.places.home.comeHome({ line: "QA: home!" }), true)`);
      // (it ends back at home: the title before ci/onegame, on her feet at the porch since — ctx.onegame.home())
      await t.until(`__lulu3d.state === "title" || (__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.reason === "home")`, "home for dinner → home", 30000);
      await t.frames(30);
      await seg("home for dinner", ["jump", "nan", "overlay", "stuck"]);
    }
  },
};
