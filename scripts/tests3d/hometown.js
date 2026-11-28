// 🏠 Lulu lives in MIDWOOD (roadmap 14, features/world home.js + depart.js): her house is a house among houses on
// a Midwood street (the town engine's `uses.luluHome` lot — features/town), the title looks at it, ▶ PLAY starts the
// day on her porch IN town, she gets in and drives off through her own neighbourhood, and "back home" brings her there.
//   Until the town engine's API lands (ctx.town.home / spotOf / enter({ at, quiet }) / warp), this test stands in for
//   it: Midwood prebuilt at an exit, and the lot of a real house on E 16th St (its T.homes entry) as the family lot.
module.exports = {
  name: "hometown",
  fast: false,     // (its "out on the highway" step races the town re-entering under her feet; on the fast clock that race
                   //  is lost ~2 in 3 — the old clock until the step is made deterministic)
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,foot,day,town,decor",
  save2d: { totalCoins: 300 },
  async run(t) {
    const g = t.game;
    const EXIT = 1600;
    const real = await g(`!!(ctx.town.home && typeof ctx.town.spotOf === "function")`);
    if (!real && !/[?&]standIn=1/.test(await t.L(`location.search`))) {
      // (no town lot on this build — the town engine's ci/exits2 isn't in: home stays the old highway house, unchanged.
      //  The stand-in below fakes a lot on top of a generated house, so driving off it is blocked — run it with ?standIn=1)
      t.check("no town lot yet: home is the highway house (the fallback — nothing changes)", await g(`ctx.home.site === "highway" && ctx.home.ready`), await g(`String(ctx.home.site)`));
      await g(`L3.setState("title")`);
      await t.frames(10);
      await t.click(/PLAY/);
      t.check("…▶ PLAY: on foot at home", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "footRun", 3000));
      t.check("…not in a town", await g(`!ctx.town.active`));
      return;
    }
    if (!real) {
      // ── the stand-in: Midwood built at EXIT, a lot on E 16th St (the house nearest local (100, 95), facing −x) ──
      await g(`(ctx.town.load("midwood"), true)`);
      await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 60000);
      for (let i = 0; i < 400 && !(await g(`ctx.town.prebuild("midwood", ${EXIT}, 50)`)); i++) await t.frames(1);
      const ok = await g(`(() => {
        const en = ctx.town.debug.S.built.find(b => b.def.id === "midwood" && b.exitS === ${EXIT});
        if (!en || !en.ready) return "not built";
        const H = en.T.homes.filter(h => h.nx < -0.9).sort((a, b) => Math.hypot(a.lotX - 100, a.lotZ - 95) - Math.hypot(b.lotX - 100, b.lotZ - 95))[0];
        if (!H) return "no house";
        const at = en.at, co = Math.cos(at.rot), si = Math.sin(at.rot);
        const W = (lx, lz) => ({ x: at.x + lx * co + lz * si, z: at.z - lx * si + lz * co });
        const D = (dx, dz) => ({ x: dx * co + dz * si, z: -dx * si + dz * co });
        const n = D(H.nx, H.nz), u = D(H.ux, H.uz), c = W(H.lotX - H.nx * 12, H.lotZ - H.nz * 12), dr = W(H.lotX + H.ux * 3.5, H.lotZ + H.uz * 3.5);
        const spot = { x: c.x, z: c.z, nx: n.x, nz: n.z, ux: u.x, uz: u.z, w: 14, d: 24, door: W(H.lotX - H.ux * 2, H.lotZ - H.uz * 2), drive: { x: dr.x, z: dr.z, h: Math.atan2(n.x, n.z) }, standIn: true };
        ctx.town.home = { town: "midwood", exitS: ${EXIT} };
        ctx.town.spotOf = (id, name) => id === "midwood" && name === "luluHome" ? Object.assign({}, spot) : null;
        return "ok";
      })()`);
      t.check("(stand-in for the town engine: Midwood built + a lot on E 16th St)", ok === "ok", ok);
    }
    await g(`ctx.home.debug.relocate(true)`);
    t.check("home is a house on its Midwood lot (ctx.home.site = town)", await g(`ctx.home.site === "town" && ctx.home.town === "midwood" && ctx.home.ready`), await g(`ctx.home.site + "/" + ctx.home.town`));
    t.check("ctx.home.isFamily: the lot yes, the street no", await g(`(() => { const L = ctx.home.lot; return ctx.home.isFamily(L.x, L.z) && !ctx.home.isFamily(L.x + L.nx * 30, L.z + L.nz * 30); })()`));
    t.check("…the car sits in the driveway, nose to the street", await g(`(() => { const P = ctx.home.park, L = ctx.home.lot; return Math.abs(Math.sin(P.h) - L.nx) < 0.05 && Math.abs(Math.cos(P.h) - L.nz) < 0.05 && ctx.home.isFamily(P.x, P.z); })()`));
    await g(`L3.setState("title")`);
    // (the town engine builds the home town in slices on the title: wait for it, and say how long it took)
    const tb = Date.now(), f0 = await g(`ctx.frames`);
    t.check("Midwood gets built behind the title", await t.until(`(__lulu3d.ctx.town.standing || []).some(s => s.town === "midwood" && s.ready)`, "Midwood built", 120000));
    console.log("   PERF title build", JSON.stringify({ ms: Date.now() - tb, frames: (await g(`ctx.frames`)) - f0, standing: await g(`ctx.town.standing.filter(s => s.town === "midwood")`) }));
    await t.frames(20);
    await t.shot("title-midwood");
    t.check("the title looks at the house in Midwood", await g(`(() => { const c = ctx.camera.position, h = ctx.home.lot; return Math.hypot(c.x - h.x, c.z - h.z) < 60; })()`));

    // ── ▶ PLAY: the day starts on her porch, in town ──
    await t.click(/PLAY/);
    t.check("▶ PLAY: on foot at home", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "footRun", 3000));
    t.check("…IN Midwood (the town is the district)", await g(`ctx.town.active && ctx.town.id === "midwood"`));
    t.check("…at the bottom of her porch steps", await g(`ctx.home.near(ctx.foot.pos.x, ctx.foot.pos.z, 14)`), await g(`JSON.stringify([ctx.foot.pos.x, ctx.foot.pos.z])`));
    t.check("…her car in the driveway", await g(`(() => { const P = ctx.home.park, c = ctx.foot.parkedCar; return !!c && Math.hypot(c.x - P.x, c.z - P.z) < 1.5; })()`));
    // the lot is closed on its sides + back (a hedge with colliders): no walking from her yard into the neighbours' walls
    if (real) {
      const H = await g(`(() => { const L = ctx.home.lot, T = ctx.town.debug.S.T, out = {};
        const fx = L.x + L.nx * L.d / 2, fz = L.z + L.nz * L.d / 2, at = (a, i) => ({ x: fx + L.ux * a - L.nx * i, z: fz + L.uz * a - L.nz * i });
        const hit = p => T.colliders.some(c => Math.hypot(c.x - p.x, c.z - p.z) < (c.r || 0) + 0.05);
        out.left = [4, 12, 20].every(i => hit(at(-L.w / 2 + 0.35, i)));
        out.right = [4, 12, 20].every(i => hit(at(L.w / 2 - 0.35, i)));
        out.back = [-5, 0, 5].every(a => hit(at(a, L.d - 0.35)));
        out.front = !hit(at(-3.5, -0.5)) && !hit(at(4.6, 0.5));
        out.hedges = ctx.home.debug.home.group.children.filter(m => m.isMesh && m.geometry && m.geometry.type === "BoxGeometry").length;
        return out; })()`);
      t.check("the lot is closed: hedge colliders on both sides + the back, the street front open", H.left && H.right && H.back && H.front, JSON.stringify(H));
    }
    // ✋ GO INSIDE her house and back out: the house's inside plays IN the town (Midwood stays — friends in there see each other)
    if (real) {
      const door = await g(`ctx.decor.debug.spotAt("door")`);
      await g(`(ctx.foot.pos.set(${door.x}, 0.05, ${door.z}), ctx.foot.obj.position.copy(ctx.foot.pos), true)`);
      await t.until(`__lulu3d.ctx.interiors.luluHome.ready()`, "house warmed", 60000);
      await g(`ctx.decor.enter()`);
      t.check("into her house: still in Midwood (the town stands outside)", await t.until(`__lulu3d.state === "interior"`, "inside", 10000) && await g(`ctx.town.active && ctx.town.id === "midwood"`), await g(`String(ctx.town.active && ctx.town.id)`));
      await t.frames(10);
      await g(`(window.__interiors.room.leave(), true)`);
      t.check("…and back out on her porch, in Midwood", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.town.active && __lulu3d.ctx.home.near(__lulu3d.ctx.foot.pos.x, __lulu3d.ctx.foot.pos.z, 14)`, "out", 15000));
      await t.frames(10);
    }
    await t.frames(40);
    await t.shot("porch-midwood");
    // get in and pull out onto E 16th St
    await g(`ctx.foot.debug.getIn()`);
    t.check("✋ GET IN → the pull-out", await t.until(`__lulu3d.state === "worldPullOut" || __lulu3d.state === "playing"`, "pull-out", 4000));
    t.check("…still in Midwood (the pull-out plays in town)", await g(`ctx.town.active && ctx.town.id === "midwood"`));
    await t.shot("pull-out-cam");
    await t.hold(7, 0.7);                 // (RT: the gas)
    t.check("driving off: playing", await t.until(`__lulu3d.state === "playing"`, "playing", 12000), await g(`JSON.stringify({ st: L3.state, v: +ctx.car.speed.toFixed(2), vF: +ctx.car.vF.toFixed(2), d: +ctx.car.d.toFixed(2) })`));
    await t.frames(30);
    await t.shot("pulling-out");
    await t.hold(7, 0);
    t.check("…on a Midwood street now", await g(`ctx.town.active && ctx.town.id === "midwood" && !ctx.home.isFamily(ctx.car.pos.x, ctx.car.pos.z)`));

    // ── "back home" from anywhere (features/onegame home(): a fresh day at her porch, in Midwood) ──
    const atPorch = async label => {
      const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood" && __lulu3d.ctx.home.near(__lulu3d.ctx.foot.pos.x, __lulu3d.ctx.foot.pos.z, 14)`, label, 6000);
      t.check(`back home from ${label}: on her porch in Midwood`, ok, await g(`JSON.stringify({ st: L3.state, town: ctx.town.active && ctx.town.id, pos: ctx.foot.pos && [+ctx.foot.pos.x.toFixed(1), +ctx.foot.pos.z.toFixed(1)] })`));
      return ok;
    };
    await g(`ctx.onegame.home({ via: "test" })`);
    await atPorch("her own street");
    // …from the highway
    await g(`(ctx.town.leave("reset"), true)`);
    await t.frames(4);
    await g(`(() => { const s = ctx.town.home.exitS + 900, p = ctx.world.road.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; L3.setState("playing"); ctx.world.prebuild(s); return true; })()`);
    await t.frames(10);
    t.check("(out on the highway)", await g(`!ctx.town.active && L3.state === "playing"`));
    await g(`ctx.onegame.home({ via: "test" })`);
    await atPorch("the highway");
    // …from Lakewood
    await g(`(ctx.town.load("lakewood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 60000);
    await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), ctx.town.enter({ town: "lakewood", speed: 0 }))`);
    if (await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "into Lakewood", 6000)) {
      await g(`ctx.onegame.home({ via: "test" })`);
      await atPorch("Lakewood");
    }
    await t.shot("home-again");

    // ── a house she owns as where her day starts (ctx.home.startAt — features/realestate's "🏠 Start my day here") ──
    const other = await g(`(() => { const L = ctx.home.lot, H = ctx.town.homes.filter(h => h.lotX != null && Math.hypot(h.lotX - L.x, h.lotZ - L.z) > 40).sort((a, b) => Math.hypot(a.lotX - L.x, a.lotZ - L.z) - Math.hypot(b.lotX - L.x, b.lotZ - L.z))[0];
      return H ? { x: H.lotX + H.nx * 1.5, z: H.lotZ + H.nz * 1.5, face: Math.atan2(H.nx, H.nz) } : null; })()`);
    if (other) {
      await g(`(ctx.home.setStartAt({ town: "midwood", key: "test", door: { x: ${other.x}, z: ${other.z} }, face: ${other.face}, label: "a test house" }), true)`);
      await g(`ctx.onegame.home({ via: "test" })`);
      t.check("startAt: the day starts at THAT house's door (not the family porch)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && Math.hypot(__lulu3d.ctx.foot.pos.x - ${other.x}, __lulu3d.ctx.foot.pos.z - ${other.z}) < 4`, "start at", 6000),
        await g(`JSON.stringify({ st: L3.state, pos: ctx.foot.pos && [+ctx.foot.pos.x.toFixed(1), +ctx.foot.pos.z.toFixed(1)], want: [${other.x.toFixed(1)}, ${other.z.toFixed(1)}] })`));
      t.check("…her car at a kerb nearby", await g(`(() => { const c = ctx.foot.parkedCar; return !!c && Math.hypot(c.x - ${other.x}, c.z - ${other.z}) < 45; })()`));
      await g(`ctx.onegame.home({ via: "dinner" })`);
      await atPorch("dinner (always the FAMILY house)");
      await g(`(ctx.home.setStartAt(null), true)`);
    } else t.check("(a neighbour's house for startAt)", false);

    // ── the road trip from the suitcase: leg 1 starts at home, in Midwood ──
    await g(`(ctx.onegame.switches.story = true, ctx.onegame.roadTrip("test", 0))`);     // (hidden for now — onegame/switches.js)
    t.check("🧳 the road trip's first leg starts at home in Midwood", await t.until(`__lulu3d.ctx.G.mode === "story" && __lulu3d.state === "footRun" && __lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "story at home", 6000),
      await g(`JSON.stringify({ mode: ctx.G.mode, st: L3.state, town: ctx.town.active && ctx.town.id })`));
  },
};
