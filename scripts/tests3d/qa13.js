// 🐞 QA sweep, part 13 — HOME IS IN MIDWOOD (ci/hometown), every feature on, the watchdog on: ▶ PLAY → on her porch in
// Midwood (standing there 15 s: no automatic rescue — her lot is open ground); 🆘 at home keeps her by her house; "🏠 back
// home" (ctx.onegame.home) from the highway, from Lakewood and from inside a room → on her feet at her own house in Midwood
// every time, nothing covering the screen, no jump / camera-in-a-wall on the way.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa13",
  query: "&enable=all,unstuck",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds = ["jump", "nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "inside"]) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const atHome = async label => {
      const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, `${label}: on her feet`, 60000);
      if (!ok) return false;
      await t.frames(30);
      const h = await g(`(() => { const sp = ctx.town.spot && ctx.town.spot("luluHome"), F = ctx.foot.debug.F, door = sp && (sp.door || sp); return { town: ctx.town.active ? ctx.town.id : null, home: ctx.town.home ? ctx.town.home.town : null, d: door ? +Math.hypot(F.pos.x - door.x, F.pos.z - door.z).toFixed(1) : null, site: ctx.home && ctx.home.site }; })()`);
      t.check(`${label}: on her feet at her own house in Midwood (≤ 25 m from her door)`, h.town === "midwood" && h.d != null && h.d <= 25, JSON.stringify(h));
      t.check(`${label}: nothing covers the screen`, (await t.L(`window.__qa.covered()`)).length === 0, JSON.stringify(await t.L(`window.__qa.covered()`)));
      return true;
    };
    const goHome = async label => {
      await W.moved(t);       // ("back home" is a soft cut: a declared one)
      await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home() : L3.startRun({ mode: "cruise" }), true)`);
      return atHome(label);
    };

    // ── ▶ PLAY: her porch in Midwood ──
    await t.click(/PLAY/);
    if (!await atHome("▶ PLAY")) return;
    await t.shot("home-porch");
    // standing at home for 15 s (looking round): no automatic rescue
    const n0 = await g(`ctx.unstuck ? ctx.unstuck.debug.U.log.length : 0`);
    await t.L(`(__pad.axes[2] = 0.6, true)`); await t.frames(150); await t.L(`(__pad.axes[2] = 0, true)`);
    await t.frames(300);
    const extra = await g(`ctx.unstuck ? ctx.unstuck.debug.U.log.slice(${n0}) : []`);
    t.check("standing at home 15 s: no automatic rescue (her lot is open ground)", extra.length === 0, JSON.stringify(extra));
    // a short walk round the lot
    for (const [x, y, n] of [[0, -1, 40], [1, 0, 40], [0, 1, 50], [-1, 0, 60]]) { await t.stick(x, y); await t.frames(n); }
    await t.stick(0, 0);
    await seg("home: the porch, looking round, a walk round the lot");
    // 🆘 at home: she stays by her house (the nearest clear spot — never far)
    if (await g(`!!ctx.unstuck`)) {
      const p0 = await g(`({ x: ctx.foot.debug.F.pos.x, z: ctx.foot.debug.F.pos.z })`);
      await g(`(ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.now(), true)`);
      await t.frames(15);
      const p1 = await g(`({ x: ctx.foot.debug.F.pos.x, z: ctx.foot.debug.F.pos.z, town: ctx.town.active ? ctx.town.id : null, why: ctx.unstuck.normal(ctx.foot.debug.F.pos.x, ctx.foot.debug.F.pos.z, "foot") })`);
      const d = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      t.check("🆘 at home: a clear spot by her house, still in Midwood (≤ 30 m)", p1.town === "midwood" && p1.why == null && d <= 30, JSON.stringify(Object.assign(p1, { d: +d.toFixed(1) })));
      await seg("home: 🆘", ["nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "inside"]);
    }

    // ── back home from the highway ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (await t.until(`__lulu3d.state === "playing"`, "a drive on the highway", 15000)) {
      await g(`(ctx.town.active && ctx.town.leave("reset"), true)`);
      await t.frames(30);
      if (await goHome("back home from the highway")) await seg("back home from the highway");
    }

    // ── back home from Lakewood ──
    await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.load("lakewood"), true)`);
    if (await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 90000)) {
      await W.moved(t);
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      if (await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "in Lakewood", 10000)) {
        await t.frames(20);
        if (await goHome("back home from Lakewood")) await seg("back home from Lakewood");
      }
    }

    // ── back home from inside a room (the bar) ──
    await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, window.__exited = 0, ctx.interiors.bar.enter({ exit: () => { window.__exited++; } }), true)`);
    if (await t.until(`window.__interiors && window.__interiors.room && window.__interiors.room.ready`, "inside the bar", 60000)) {
      await t.frames(10);
      if (await goHome("back home from inside a room")) {
        t.check("…the room is gone (no set left on screen)", await g(`!window.__interiors.room && !ctx.view`));
        await seg("back home from a room");
      }
    }
  },
};
