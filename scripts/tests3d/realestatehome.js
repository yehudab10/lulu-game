// 🏘️ + 🏠 Real estate × the home start (features/realestate × features/world, ci/hometown): "🏠 Start my days here" in a
// house she owns in ANOTHER town (Lakewood — the family lives in Midwood) → a new day starts on foot at THAT door with her
// car at a kerb nearby; dinner is still at Ima's (the family house); selling the house sends her mornings back to Ima's.
// (Its own file: the home start is features/world, which features/realestate's main test leaves switched off.)
module.exports = {
  name: "realestatehome",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,foot,day,town,decor",
  save2d: { totalCoins: 40000 },
  async run(t) {
    const g = t.game;
    if (!(await g(`!!(ctx.home && ctx.home.setStartAt && ctx.town.home)`))) { t.check("(no home start on this build — nothing to test)", true); return; }
    await g(`L3.setState("title")`);
    await t.frames(10);
    await t.click(/PLAY/);
    t.check("▶ PLAY: on foot at home (Midwood)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "midwood"`, "home", 60000));
    // into Lakewood, buy a listed house
    await g(`(ctx.foot.end("test"), L3.setState("playing"), ctx.town.load("lakewood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 120000);
    await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood" && __lulu3d.ctx.realestate.listings().length > 0`, "in Lakewood with listings", 20000)) return;
    const rec = await g(`(() => { for (const r of ctx.realestate.listings()) if (ctx.realestate.debug.buyNow(r.id)) return { id: r.id, x: r.ap.x, z: r.ap.z, nx: r.nx, nz: r.nz, address: r.address }; return null; })()`);
    t.check("she buys a house in Lakewood", !!rec && (await g(`ctx.realestate.owns(${JSON.stringify(rec && rec.id)})`)), JSON.stringify(rec));
    if (!rec) return;
    // what house.js's "🏠 Start my days here" stores (tested there): the door, facing the street
    await g(`(ctx.home.setStartAt({ town: "lakewood", key: ${JSON.stringify(rec.id)}, door: { x: ${rec.x}, z: ${rec.z} }, face: Math.atan2(${rec.nx}, ${rec.nz}), label: ${JSON.stringify(rec.address)} }), true)`);
    await g(`ctx.onegame.home({ via: "test" })`);
    t.check("a new day starts at HER house's door in Lakewood (not the family porch)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "lakewood" && Math.hypot(__lulu3d.ctx.foot.pos.x - ${rec.x}, __lulu3d.ctx.foot.pos.z - ${rec.z}) < 4`, "her day starts at her house", 30000),
      await g(`JSON.stringify({ st: L3.state, town: ctx.town.active && ctx.town.id, pos: ctx.foot.pos && [+ctx.foot.pos.x.toFixed(1), +ctx.foot.pos.z.toFixed(1)], want: [${rec.x.toFixed(1)}, ${rec.z.toFixed(1)}] })`));
    t.check("…her car at a kerb nearby", await g(`(() => { const c = ctx.foot.parkedCar; return !!c && Math.hypot(c.x - ${rec.x}, c.z - ${rec.z}) < 45; })()`));
    await t.shot("start-at-her-house");
    // dinner is always at Ima's
    await g(`ctx.onegame.home({ via: "dinner" })`);
    t.check("dinner still brings her home to the family (Midwood)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "midwood"`, "dinner at Ima's", 30000));
    // selling it → mornings back at Ima's
    const sold = await g(`(() => { const r = ctx.realestate.sell(${JSON.stringify(rec.id)}); return !!(r && (r.ok || r.net)); })()`);
    t.check("she sells the house…", sold && !(await g(`ctx.realestate.owns(${JSON.stringify(rec.id)})`)));
    t.check("…and her days start at Ima's again", !(await g(`ctx.home.startAt`)));
  },
};
