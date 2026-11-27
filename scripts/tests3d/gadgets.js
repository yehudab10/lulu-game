// 🚀🌶️ Gadgets + "more ways to use everything" (features/houseitems round 2): missiles on foot go straight UP (a firework;
// the impound gate: "nice try"), never indoors, never by a school in school hours (nothing spent), a cop who sees one → a
// ⚠️ look then a chase; a rocket that knocks out a cruiser → law's chase; pepper in rooms (the kiddush cholent, the fitting
// room) spends one; the context table (item × place / person → effect + line) on the street and in rooms. Nothing pays.
module.exports = {
  name: "gadgets",
  viewport: { width: 1280, height: 720 },
  query: `&enable=homes,town,law,foot,atmos,interiors,seasons,houseitems,crime,garage,life,family,cameras`,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", missiles: 4, pepperSpray: 3 },
  async run(t) {
    const g = t.game, I = `ctx.houseitems`, D = `ctx.houseitems.debug`;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    const inv = () => t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2") || "{}"); return { m: s.missiles | 0, p: s.pepperSpray | 0 }; })()`);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.freeze(true), true)`);
    const c0 = await g(`ctx.G.coins`);
    // 🚀 from the car first (a cruiser knocked out → law's chase)
    await step("rocket at a cruiser", async () => {
      await g(`(ctx.law.hold(0), true)`);
      await g(`${D}.copHit({ car: { kind: "cop" } })`);
      t.check("a rocket that knocks out a cruiser → a chase (law's own rule)", await t.until(`!!__lulu3d.ctx.law.chasing`, "the chase", 10000));
      await g(`(ctx.law.debug && ctx.law.debug.endChase ? ctx.law.debug.endChase() : (ctx.law.lose && ctx.law.lose("lost")), ctx.law.hold(9999), true)`);
    });
    await g(`ctx.town.load("midwood")`);
    await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood models", 90000);
    await g(`(ctx.town.enter({ town: "midwood", speed: 0 }), true)`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Midwood", 60000)) return;
    await g(`ctx.foot.start("droveOff", { noIntro: true })`);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000)) return;
    const stand = (x, z) => g(`(() => { if (window.__qa) window.__qa.cutF = ctx.frames + 4; const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.obj.position.copy(f); if (ctx.cam && ctx.cam.snap) ctx.cam.snap(); return true; })()`);
    const at = async (k, n = 4) => { const s = await g(`(() => { const s = ctx.town.spot(${JSON.stringify(k)}); return s && { x: s.x + (s.nx || 0) * ${n}, z: s.z + (s.nz || 0) * ${n} }; })()`); if (s) await stand(s.x, s.z); await t.frames(4); return !!s; };

    await step("missiles on foot", async () => {
      await at("bank", 6);
      const i0 = await inv();
      t.check("🚀 on foot, straight up: a firework (one spent)", (await g(`${I}.fireOnFoot()`)) === "firework" && (await inv()).m === i0.m - 1);
      if (await at("impound", 4)) {
        const i1 = await inv();
        t.check("🚀 at the impound gate: it doesn't open (\"nice try\" — Bruno), one spent", (await g(`${I}.fireOnFoot()`)) === "gate" && (await inv()).m === i1.m - 1);
      }
      if (await at("school", 4)) {
        await g(`(${D}.GADGET.force.school = true, true)`);
        const i2 = await inv();
        t.check("🚀 by a school in school hours: never (nothing spent)", (await g(`${I}.fireOnFoot()`)) === "school" && (await inv()).m === i2.m);
        await g(`(${D}.GADGET.force.school = null, true)`);
      }
    });

    await step("a cop sees the firework", async () => {
      await at("bank", 6);
      await g(`(ctx.crime.debug.CR.force.cop = true, ctx.law.hold(0), true)`);
      await g(`${I}.fireOnFoot()`);
      t.check("…the first: a ⚠️ look", await g(`${D}.GADGET.log.filter(e => e.ev === "firework").pop().law === "warn"`), JSON.stringify(await g(`${D}.GADGET.log.slice(-2)`)));
      await g(`${I}.fireOnFoot()`);
      t.check("…the second: a chase (ILLEGAL FIREWORKS)", await g(`${D}.GADGET.log.filter(e => e.ev === "firework").pop().law === "chase"`) && await t.until(`!!__lulu3d.ctx.foot.chasing`, "the foot chase", 10000));
      await g(`(() => { ctx.crime.debug.CR.force.cop = null; const F = ctx.foot.debug.F; if (F.chase) { ctx.scene.remove(F.chase.p.obj); F.chase = null; } ctx.law.hold(9999); return true; })()`);
    });

    await step("rooms", async () => {
      const room = id => `({ def: { id: ${JSON.stringify(id)} }, bubble() { window.__rb = (window.__rb || 0) + 1; }, lulu: { obj: ctx.foot.obj } })`;
      const i0 = await inv();
      t.check("🚀 indoors: never (a line, nothing spent)", await g(`${I}.inRoom(${room("shul")}, { fire: true })`) && (await inv()).m === i0.m);
      await g(`(${D}.clear(), ${D}.R.force.ctx = { when: true }, true)`);       // (the pepper is the only thing "in hand")
      t.check("🌶️ into the kiddush cholent (\"the best one YET\") — one spent", await g(`${I}.inRoom(${room("shul")}, { item: true })`) && (await inv()).p === i0.p - 1);
      t.check("🌶️ in the fitting room: at herself — one spent", await g(`${I}.inRoom(${room("clothesShop")}, { item: true })`) && (await inv()).p === i0.p - 2);
      await g(`(${I}.add("hat", null, true), true)`);
      t.check("🎩 the black hat on the shul's hat rack (used up)", await g(`${I}.inRoom(${room("shul")}, { item: true })`) && (await g(`${I}.bag`)).length === 0);
      await g(`(${I}.add("trophy", null, true), true)`);
      t.check("🏆 the trophy presented to Pothole Phil at City Hall", await g(`${I}.inRoom(${room("cityhall")}, { item: true })`) && (await g(`${I}.bag`)).length === 0);
      t.check("…a thing with no use in that room: the room's own button (not ours)", !(await g(`(${I}.add("pan", null, true), ${I}.inRoom(${room("bank")}, { item: true }))`)));
      await g(`(${D}.R.force.ctx = null, ${D}.clear(), true)`);
    });

    await step("the street's contexts", async () => {
      await at("bank", 8);
      const tryCtx = async (item, id) => {
        await g(`(${D}.clear(), ${I}.add(${JSON.stringify(item)}, null, false), ${D}.R.force.ctx = { context: ${JSON.stringify(id)}, near: { x: 0, z: 0 }, when: true }, true)`);
        const r = await g(`${I}.use()`);
        await g(`(${D}.R.force.ctx = null, true)`);
        t.check(`${item} × ${id}`, r && r.verb === "CTX:" + id, JSON.stringify(r));
      };
      for (const [item, id] of [["blower", "blowerPigeons"], ["rugelach", "foodPigeons"], ["blower", "blowerPile"], ["rollingpin", "pinPile"], ["blower", "blowerProtest"],
        ["pillow", "pillowAlarm"], ["seltzer", "seltzerBonfire"], ["pan", "panLatke"], ["broom", "broomPesach"], ["chicken", "chickenChani"], ["challah", "challahFriday"], ["spray", "sprayPigeons"]]) await tryCtx(item, id);
      t.check("…nothing matches here: the item's own verb (the pan: WEAR)", (await g(`(${D}.clear(), ${I}.add("pan", null, false), ${I}.use())`)).verb === "WEAR");
    });
    t.check("nothing pays coins", (await g(`ctx.G.coins`)) === c0);
  },
};
