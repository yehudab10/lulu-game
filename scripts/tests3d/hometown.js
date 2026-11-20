// 🏠 Lulu lives in MIDWOOD (roadmap 14, features/world home.js + depart.js): her house is a house among houses on
// a Midwood street (the town engine's `uses.luluHome` lot — features/town), the title looks at it, ▶ PLAY starts the
// day on her porch IN town, she gets in and drives off through her own neighbourhood, and "back home" brings her there.
//   Until the town engine's API lands (ctx.town.home / spotOf / enter({ at, quiet }) / warp), this test stands in for
//   it: Midwood prebuilt at an exit, and the lot of a real house on E 16th St (its T.homes entry) as the family lot.
module.exports = {
  name: "hometown",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,foot,day,town,decor",
  save2d: { totalCoins: 300 },
  async run(t) {
    const g = t.game;
    const EXIT = 1600;
    const real = await g(`!!(ctx.town.home && typeof ctx.town.spotOf === "function")`);
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
    await t.frames(40);
    await t.shot("title-midwood");
    t.check("the title looks at the house in Midwood", await g(`(() => { const c = ctx.camera.position, h = ctx.home.lot; return Math.hypot(c.x - h.x, c.z - h.z) < 60; })()`));

    // ── ▶ PLAY: the day starts on her porch, in town ──
    await t.click(/PLAY/);
    t.check("▶ PLAY: on foot at home", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "footRun", 3000));
    t.check("…IN Midwood (the town is the district)", await g(`ctx.town.active && ctx.town.id === "midwood"`));
    t.check("…at the bottom of her porch steps", await g(`ctx.home.near(ctx.foot.pos.x, ctx.foot.pos.z, 14)`), await g(`JSON.stringify([ctx.foot.pos.x, ctx.foot.pos.z])`));
    t.check("…her car in the driveway", await g(`(() => { const P = ctx.home.park, c = ctx.foot.parkedCar; return !!c && Math.hypot(c.x - P.x, c.z - P.z) < 1.5; })()`));
    await t.frames(40);
    await t.shot("porch-midwood");
    // get in and pull out onto E 16th St
    await g(`ctx.foot.debug.getIn()`);
    t.check("✋ GET IN → the pull-out", await t.until(`__lulu3d.state === "worldPullOut" || __lulu3d.state === "playing"`, "pull-out", 4000));
    t.check("…still in Midwood (the pull-out plays in town)", await g(`ctx.town.active && ctx.town.id === "midwood"`));
    await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => c.hook("controls", (ctl, dt) => { if (window.__auto) Object.assign(ctl, { throttle: 0.6, steer: window.__steer || 0 }); }, 999)))`);
    await g(`(window.__auto = true, true)`);
    t.check("driving off: playing", await t.until(`__lulu3d.state === "playing"`, "playing", 8000));
    await t.frames(60);
    await t.shot("pulling-out");
    await g(`(window.__auto = false, true)`);
    t.check("…on a Midwood street now", await g(`ctx.town.active && ctx.town.id === "midwood" && !ctx.home.isFamily(ctx.car.pos.x, ctx.car.pos.z)`));
  },
};
