// 🏡 Her own home's five extra decor spots (features/realestate/yard.js + house.js, roadmap 23 d2): the couch inside, and
// the front door's paint, the porch, the mailbox and the front yard OUTSIDE — features/decor's own catalogue, placed on
// the real town house (every house model), free for anything she already owns (moveout's boxes), the pink LULU mailbox
// steps aside for a decor mailbox. A friend's screen shows them too (realestatefriends covers the inside).
module.exports = {
  name: "realestateyard",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town",
  save2d: { totalCoins: 90000 },
  async run(t) {
    const g = t.game;
    const D = { door: "mint", porch: "rockers", mailbox: "fish", lawn: "flamingo", couch: "velvet" };
    for (const town of ["lakewood", "midwood"]) {
      await g(`(ctx.foot.active && ctx.foot.end("test"), L3.setState("playing"), ctx.town.load(${JSON.stringify(town)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(town)})`, `${town}'s models`, 120000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(town)}, exitS: ctx.town.exitOf(${JSON.stringify(town)}, 0), speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.id === ${JSON.stringify(town)} && __lulu3d.ctx.realestate.listings().length > 0`, `in ${town}`, 20000)) return;
      // one house of each model listed today
      const got = await g(`(() => { const seen = new Set(), out = []; for (const r of ctx.realestate.listings()) { if (seen.has(r.model)) continue; if (ctx.realestate.debug.buyNow(r.id)) { seen.add(r.model); out.push({ id: r.id, model: r.model, x: r.ap.x, z: r.ap.z, nx: r.nx, nz: r.nz }); } } return out; })()`);
      t.check(`${town}: she owns a house of each kind listed today`, got.length >= 1, JSON.stringify(got.map(x => x.model)));
      // the five things bought the usual way (features/decor: coins → owned), then placed at each of her houses
      await g(`(() => { for (const [s, o] of Object.entries(${JSON.stringify(D)})) if (!ctx.decor.owns(s, o)) ctx.decor.buy(s, o); return true; })()`);
      t.check(`${town}: decor owns all five`, await g(`Object.entries(${JSON.stringify(D)}).every(([s, o]) => ctx.decor.owns(s, o))`));
      const c0 = await g(`ctx.realestate.debug.counts().mailboxes`);
      await g(`(() => { for (const h of ${JSON.stringify(got)}) ctx.realestate.debug.S.decor[h.id] = Object.assign({}, ${JSON.stringify(D)}); ctx.realestate.debug.refresh(); return true; })()`);
      await t.frames(10);
      const n = await g(`ctx.realestate.debug.yardCount()`), c1 = await g(`ctx.realestate.debug.counts().mailboxes`);
      t.check(`${town}: the door, porch, mailbox and yard stand at every house of hers`, n === got.length * 4, `${n} pieces for ${got.length} houses`);
      t.check(`${town}: …her own mailbox replaces the pink LULU one`, c1 === c0 - got.length, `${c0} → ${c1}`);
      // a look at each (screenshots: the pieces sit on HER lot, on the ground)
      for (const h of got) {
        await g(`(() => { const L3 = window.__lulu3d; if (!ctx.foot.active) ctx.foot.start("parked", { noIntro: true }); return true; })()`);
        await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 10000);
        await g(`(() => { const F = ctx.foot.debug.F, x = ${h.x} + ${h.nx} * 5, z = ${h.z} + ${h.nz} * 5; F.pos.set(x, 0.05, z); ctx.foot.obj.position.copy(F.pos); ctx.foot.obj.rotation.y = Math.atan2(-(${h.nx}), -(${h.nz})); F.h = ctx.foot.obj.rotation.y; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
        // (the shot: a camera looking straight at her house front from the street)
        await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } window.__camAt = [${h.x} + (${h.nx}) * 9, 3.2, ${h.z} + (${h.nz}) * 9, ${h.x} - (${h.nx}) * 2, 1.0, ${h.z} - (${h.nz}) * 2]; return true; })()`);
        await t.frames(20);
        await t.shot(`yard-${town}-${h.model}`);
        await t.L(`(window.__camAt = null, true)`);
      }
      // inside: the couch is there in her colours, + the ✋ to decorate the outside
      const h0 = got[0];
      await g(`ctx.realestate.goIn(${JSON.stringify(h0.id)}, "owner")`);
      if (await t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "inside", 30000)) {
        const R = await g(`(() => { const r = window.__interiors.room, V = r.data.V; return { couch: !!(V.couch && V.couch.visible), hots: r.hots.map(h => h.id) }; })()`);
        t.check(`${town}: inside — her couch, and ✋ spots for the couch + the outside`, R.couch && R.hots.includes("slot:couch") && R.hots.includes("slot:outside"), JSON.stringify(R));
        await t.frames(10);
        await t.shot(`yard-${town}-inside`);
        await g(`(window.__interiors.room.leave(), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out", 15000);
      }
      if (town === "lakewood") { await g(`(ctx.foot.end("test"), ctx.town.leave("reset"), true)`); await t.frames(10); }
    }
    t.check("nothing went below zero", (await g(`L3.wallet.coins`)) >= 0);
  },
};
