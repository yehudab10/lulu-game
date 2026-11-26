// 🙈 Hidden for now (the owner, 2026-11-22 — features/onegame/switches.js): Dina's mode has no title tile and no porch ✋,
// the Story Trip is gone from view. Dina's ways in are hidden ones, and both must work and bring Lulu back HOME:
//   • 🚌 her school bus now and then at the home start (features/onegame/bus.js): pulls in at the kerb in front of the
//     house, door open → ✋ "Hop on with Dina" → her bus intro + the race home; ignored → it drives off; once a real day.
//   • 🦄 the door to DINA'S ROOM inside the house (features/decor/house.js): ✋ → Play as Dina → her bedroom.
// Home is the family house on its Midwood lot (roadmap 14); until the town engine's lot is on main, this test stands in
// for it the same way hometown.js does.
module.exports = {
  name: "hidden",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,foot,town,decor,dina,dinabus",
  save2d: { totalCoins: 300 },
  async run(t) {
    const g = t.game;
    const EXIT = 1600;
    const label = () => g(`((ctx.foot.debug.interactables() || {}).label || "")`);
    const putFoot = (x, z) => g(`(ctx.foot.pos.set(${x}, 0.05, ${z}), ctx.foot.obj.position.copy(ctx.foot.pos), ctx.foot.debug.F.vel.set(0, 0, 0), true)`);
    const atPorch = (lbl, ms = 8000) => t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.active && __lulu3d.ctx.home.near(__lulu3d.ctx.foot.pos.x, __lulu3d.ctx.foot.pos.z, 16)`, lbl, ms);
    if (!await g(`!!(ctx.town.home && typeof ctx.town.spotOf === "function")`)) {
      // (the stand-in: Midwood built at EXIT, a lot on E 16th St — scripts/tests3d/hometown.js)
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
        ctx.town.home = { town: "midwood", exitS: ${EXIT}, standIn: true };
        ctx.town.spotOf = (id, name) => id === "midwood" && name === "luluHome" ? Object.assign({}, spot) : null;
        return "ok";
      })()`);
      t.check("(stand-in for the town engine: Midwood built + a lot on E 16th St)", ok === "ok", ok);
    }
    await g(`ctx.home.debug.relocate(true)`);
    await g(`L3.setState("title")`);
    // (the town engine builds the home town behind the title — only with its real API; the stand-in built it above)
    if (await g(`!ctx.town.home || !ctx.town.home.standIn`)) await t.until(`(__lulu3d.ctx.town.standing || []).some(s => s.town === "midwood" && s.ready) || !Array.isArray(__lulu3d.ctx.town.standing)`, "Midwood built", 120000);
    await t.frames(10);

    // ── hidden: no Dina tile, no Story Trip on the title; no porch ✋ ──
    const tiles = await t.L(`[...document.querySelectorAll("#screenCard .home-tiles .tile")].map(b => b.id)`);
    t.check("title: no 👧 Dina tile", !tiles.includes("dina"), tiles.join(","));
    t.check("title: no Story Trip / Road to Vegas anywhere", !/Road to Vegas|Story Trip/.test((await t.titleItems()).join(" | ")));
    await t.click(/PLAY/);
    t.check("▶ PLAY: on foot at home in Midwood", await atPorch("home start"));
    await t.frames(20);
    t.check("…no ✋ PLAY AS DINA on the porch", await g(`ctx.onegame.debug.dinaSpot.pos() === null`));
    t.check("…no bus on a player's FIRST day (even when it's due)", (await g(`(ctx.onegame.bus.force(), ctx.onegame.bus.state().phase)`)) === "off");

    // ── 🚌 the school bus: a later home start, forced ──
    await g(`ctx.onegame.home({ via: "test" })`);
    await atPorch("second home start");
    t.check("the bus is due a few seconds in", (await g(`ctx.onegame.bus.state().phase`)) === "due");
    t.check("…it pulls in and opens its door", await t.until(`__lulu3d.ctx.onegame.bus.state().phase === "open" && __lulu3d.ctx.onegame.bus.state().open > 0.9`, "bus open", 40000), JSON.stringify(await g(`ctx.onegame.bus.state()`)));
    const B = await g(`(() => { const s = ctx.onegame.bus.state(), L = ctx.home.lot; return { s, dLot: Math.hypot(s.at.x - L.x, s.at.z - L.z), family: ctx.home.isFamily(s.at.x, s.at.z), park: ctx.home.park }; })()`);
    t.check("…at the kerb in front of the house (not on the lot)", B.s.at && Math.hypot(B.s.at.x - B.s.stop.x, B.s.at.z - B.s.stop.z) < 0.3 && B.dLot < 30 && !B.family, JSON.stringify(B));
    t.check("…nothing on the HUD for it (no toast / banner)", !(await t.L(`/bus/i.test((document.getElementById("toasts") || {}).textContent || "") || /bus/i.test((document.getElementById("banner") || {}).textContent || "")`)));
    await t.shot("bus-at-the-door");
    const door = await g(`(() => { const K = ctx.onegame.bus.K; K.obj.updateMatrixWorld(true); const v = K.step ? K.step.getWorldPosition(K.doorAt) : K.doorAt.copy(K.stop); return { x: v.x, z: v.z }; })()`);
    const L = await g(`ctx.home.lot`);
    // (stand by the door, on the house's side of it)
    await putFoot(door.x - L.nx * 0.9, door.z - L.nz * 0.9);
    await t.frames(4);
    const lb = await label();
    t.check("by the bus door: ✋ Hop on with Dina", /Hop on with Dina/.test(lb), lb);
    await t.tap(0);
    t.check("✋ → Dina's bus ride (her mode, straight in — no picker)", await t.until(`__lulu3d.state === "dinaBus"`, "dinaBus", 20000), await g(`ctx.state`));
    t.check("…the street bus is gone", await t.until(`__lulu3d.ctx.onegame.bus.state().phase === "off"`, "bus cleared", 2000));
    t.check("…and on to the race home", await t.until(`__lulu3d.state === "dinaRun"`, "dinaRun", 20000));
    // her mode stays completable — leave it from her picker (as her bedroom door does) → back home, in Midwood
    await g(`L3.setState("dinaSelect")`);
    await t.frames(4);
    await t.L(`document.getElementById("dsLulu").click()`);
    t.check("Dina's picker → pick Lulu → back on her porch in Midwood (not the title)", await atPorch("home from Dina"));

    // ── the bus comes once a real day; ignored, it drives off ──
    await g(`(ctx.onegame.bus.BUS.chance = 1, true)`);
    await g(`ctx.onegame.home({ via: "test" })`);
    await atPorch("third home start");
    t.check("once a real day: no second bus today (even at chance 1)", (await g(`ctx.onegame.bus.state().phase`)) === "off");
    await g(`(ctx.onegame.bus.BUS.chance = 0.12, ctx.onegame.bus.BUS.wait = 1.5, ctx.onegame.bus.force(), ctx.onegame.home({ via: "test" }))`);
    await atPorch("fourth home start");
    await t.until(`__lulu3d.ctx.onegame.bus.state().phase === "open"`, "bus again", 40000);
    t.check("ignored: the door closes and it drives off", await t.until(`__lulu3d.ctx.onegame.bus.state().phase === "out"`, "bus leaves", 8000));
    t.check("…and it's gone", await t.until(`__lulu3d.ctx.onegame.bus.state().phase === "off"`, "bus gone", 20000));
    await g(`(ctx.onegame.bus.BUS.wait = 24, true)`);

    // ── 🦄 the door to Dina's room, inside the house ──
    const fd = await g(`ctx.decor.debug.spotAt("door")`);
    await putFoot(fd.x, fd.z);
    await t.frames(3);
    t.check("at the front door: ✋ GO INSIDE", /GO INSIDE/.test(await label()), await label());
    await t.until(`__lulu3d.ctx.interiors.luluHome.ready()`, "house warmed", 60000);
    await t.tap(0);
    t.check("✋ → inside the house", await t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "inside", 8000));
    const hot = await g(`(() => { const h = window.__interiors.room.hots.find(x => x.id === "dinaRoom"); return h && { x: h.x, z: h.z }; })()`);
    t.check("a door to Dina's room (✋ spot)", !!hot);
    await g(`(() => { const L = window.__interiors.room.lulu.obj; L.position.set(${hot ? hot.x : 0} - 0.4, 0, ${hot ? hot.z : 0}); L.rotation.y = Math.PI / 2; return true; })()`);
    await t.frames(4);
    t.check("…next to it: 👧 Dina's room — play as Dina", (await g(`(() => { const n = window.__interiors.room.near; return n ? n.id : ""; })()`)) === "dinaRoom");
    await t.shot("dina-door");
    await t.tap(0);
    t.check("…the door asks: 👧 Play as Dina?", await t.until(`!!document.querySelector("#dialog .opt") && /Play as Dina/.test(document.querySelector("#dialog .opt").textContent)`, "the door asks", 30000));
    // (a click while the line is still typing only finishes the line — wait for the options, slow on a CI runner)
    await t.until(`!!document.querySelector("#dialog .opt") && document.querySelector("#dialog .opt").style.visibility === "visible"`, "the options show", 30000);
    await t.L(`(document.querySelector("#dialog .opt") || { click() { } }).click()`);          // 👧 Play as Dina
    // (her bedroom's models load first — slow on a CI runner)
    t.check("✋ → Dina's bedroom (her mode)", await t.until(`__lulu3d.state === "dinaHome"`, "dinaHome", 90000), await g(`ctx.state`));
    await t.frames(20);
    await t.shot("dina-room");
    await g(`L3.setState("dinaSelect")`);
    await t.frames(4);
    await t.L(`document.getElementById("dsLulu").click()`);
    t.check("…out of her room → back on Lulu's porch in Midwood", await atPorch("home from her room"));
  },
};
