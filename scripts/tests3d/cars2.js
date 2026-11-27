// 🚗 features/cars stage 3 — tows, Tuvia, no auto-return, Ima's minivan (with the QA watchdog on).
//   the highway: left on the shoulder → never towed while she's near; > 300 m away for 2 min → Tuvia tows it to the nearest
//   impound, one `need: true` text, a tow's fee (60) · a lot off the highway is legal · Lakewood: a travel lane is not (towed,
//   2 min away), the kerb is · 3 real days anywhere → towed · 📞 Tuvia brings a LEFT car home: the fee exactly once, never an
//   impounded one · the impound gate releases THAT car (the one she came in stays parked), at the tow price · an arrest →
//   the impound, still there the next day (no auto-return) · no car at home + no coins → Ima's minivan in the driveway, she
//   drives it (a borrowed ride, not hers).
const W = require("../lib/qawatch.js");

module.exports = {
  name: "cars2",
  query: "&enable=cars,town,foot,world,day,phone,shops,garage,impound,places,cityhall,law,community",
  save2d: { totalCoins: 400, cruiseUnlocked: true, ownedSkins: ["pink", "purple", "orange"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const D = "ctx.cars.debug";
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      await t.L(`import("./js/core/dialog.js").then(m => { if (m.isOpen()) m.closeDialog(); })`);
      if (process.env.CARS_LOG) console.log(`    [${label}]`, JSON.stringify(await g(`${D}.S.log.slice(-8)`))); };
    const recs = () => g(`JSON.stringify(${D}.SAVE.cars)`);
    const kind = k => g(`${D}.rec("${k}").kind`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const setCoins = n => t.L(`import("./js/core/save.js").then(m => { m.wallet.add(${n} - m.wallet.coins); return m.wallet.coins; })`);
    const tuviaTexts = () => g(`(ctx.phone && ctx.phone.inbox ? ctx.phone.inbox.msgs : []).filter(m => /Tuvia/.test(m.from || "")).length`);
    const towLog = () => g(`${D}.S.log.filter(e => e.ev === "tow").length`);
    const walkOut = async label => {
      await g(`(ctx.foot.start("droveOff", { noIntro: true, drivable: true }), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${label}: on foot`, 8000);
    };
    const footAt = (x, z) => g(`(() => { const F = ctx.foot.debug.F; F.pos.x = ${x}; F.pos.z = ${z}; F.vel.set(0, 0, 0); F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
    const press = async (code, n = 8) => { for (let i = 0; i < n && !await g(code); i++) { await t.tap(0); await t.frames(4); } return g(code); };

    await W.install(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run starts", 9000);
    await g(`(${D}.S.migrated || ${D}.migrate(), true)`);
    await g(`(ctx.town.load("lakewood"), ctx.town.load("midwood"), ctx.civic.load(), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood") && __lulu3d.ctx.town.loaded("midwood")`, "the towns load", 120000)) return;
    if (await g(`ctx.foot.active`)) await g(`(ctx.foot.end("test"), true)`);
    if (await g(`ctx.town.active`)) await g(`(ctx.town.leave("reset"), true)`);
    // out on the highway, a few km from any town's exit
    await g(`(() => { const s = (ctx.town.exitOf("lakewood", 0) || 4000) + 1600, p = ctx.world.road.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; L3.setState("playing"); ctx.world.prebuild && ctx.world.prebuild(s); return true; })()`);
    await t.frames(10);
    await W.reset(t);

    // ════ the highway shoulder ════
    await step("highway", async () => {
      const s = await g(`ctx.car.s`);
      await g(`(() => { const p = ctx.world.road.point(${s} + 30, 8, {}); ctx.cars.leaveAt("purple", { kind: "left", legal: false, x: p.x, z: p.z, h: p.h }); return true; })()`);
      t.check("purple parked on the shoulder: in the highway's frame, not legal parking", await g(`(r => !!r.hw && r.legal === false && Math.abs(r.hw.d - 8) < 0.5)(${D}.rec("purple"))`), await recs());
      t.check("…(the frame's rule agrees: the shoulder isn't legal, a lot 25 m off is)", await g(`!${D}.legalHere({ hw: { d: 8 } }) && ${D}.legalHere({ hw: { d: 25 } })`));
      const n0 = await tuviaTexts();
      await g(`(${D}.towTick(600), true)`);
      t.check("she's right by it: never towed in front of her (10 min of her standing there)", await kind("purple") === "left");
      await g(`(() => { const p = ctx.world.road.point(${s} + 30 + 420, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s} + 450; return true; })()`);
      await g(`(${D}.towTick(60), true)`);
      t.check("420 m off for a minute: still there", await kind("purple") === "left");
      await g(`(${D}.towTick(65), true)`);
      const r = await g(`JSON.stringify(${D}.rec("purple"))`);
      t.check("…over 2 minutes away: Tuvia towed it to the nearest impound (a tow, not an arrest)", await kind("purple") === "impound" && /"why":"tow"/.test(r) && /lakewood|midwood/.test(r), r);
      t.check("…one text from Tuvia that needs her (where it is, the 60)", (await tuviaTexts()) === n0 + 1 && await g(`(() => { const m = ctx.phone.inbox.msgs.filter(x => /Tuvia/.test(x.from || "")).pop(); return !!m && /60/.test(m.msg) && /impound/.test(m.msg); })()`));
      // a lot off the highway (a rest stop, JFK's parking): legal — only the days rule
      await g(`(() => { const p = ctx.world.road.point(${s} + 470, 28, {}); ctx.cars.leaveAt("orange", { kind: "left", x: p.x, z: p.z, h: 0 }); ctx.cars.debug.rec("orange").legal = true; return true; })()`);
      await g(`(() => { const p = ctx.world.road.point(${s} + 3000, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s} + 3000; return true; })()`);
      await g(`(${D}.towTick(600), true)`);
      t.check("a car on a lot off the highway: left alone (legal parking)", await kind("orange") === "left");
      await g(`(${D}.rec("orange").day = "2000-1-1", ${D}.towTick(1), true)`);
      t.check("…but 3 real days anywhere → towed too", await kind("orange") === "impound" && await g(`${D}.rec("orange").why`) === "tow");
    });

    // ════ Lakewood: a travel lane vs the kerb ════
    await step("zone", async () => {
      await g(`ctx.town.warp({ town: "lakewood", exitS: ctx.town.exitOf("lakewood", 0), quiet: true })`);
      await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "in Lakewood", 8000);
      await g(`(L3.setState("playing"), true)`); await t.frames(6);
      const lane = await g(`(() => { const n = ctx.world.road.nearest(ctx.car.pos.x, ctx.car.pos.z, null, {}), p = ctx.world.road.point(n.s + 25, n.d >= 0 ? 1.75 : -1.75, {}); return { x: p.x, z: p.z, h: p.h }; })()`);
      const kerb = await g(`(() => { const k = ctx.town.curbSpot({ near: { x: ctx.car.pos.x, z: ctx.car.pos.z }, minD: 10, maxD: 160, len: 6 }); return k ? { x: k.x, z: k.z, h: k.h } : null; })()`);
      t.check("the travel lane isn't legal parking, the kerb is", !(await g(`${D}.legalHere(${D}.poseOf(${JSON.stringify(lane)}))`)) && !!kerb && await g(`${D}.legalHere(${D}.poseOf(${JSON.stringify(kerb)}))`));
      await g(`(() => { const p = ${D}.poseOf(${JSON.stringify(lane)}); ctx.cars.leaveAt("purple", { kind: "left", legal: false, town: p.town, lx: p.lx, lz: p.lz, h: p.h }); return true; })()`);
      await g(`(${D}.towTick(500), true)`);
      t.check("purple in the lane, her right there: not towed", await kind("purple") === "left");
      await g(`(() => { const P = ctx.town.plan; let best = null, bd = 0; for (const n of P.NODES) { const x = P.ORIGIN.x + n.x * P.COS + n.z * P.SIN, z = P.ORIGIN.z - n.x * P.SIN + n.z * P.COS, d = Math.hypot(x - ${lane.x}, z - ${lane.z}); if (d > bd) { bd = d; best = { x, z }; } } ctx.car.place(best.x, best.z, 0); return true; })()`);
      await g(`(${D}.towTick(125), true)`);
      t.check("across town for 2 minutes: towed to the Lakewood impound", await kind("purple") === "impound" && await g(`${D}.rec("purple").town`) === "lakewood");
    });

    // ════ 📞 Tuvia brings a LEFT car home: the fee once, never an impounded one ════
    await step("tuvia", async () => {
      const kerb = await g(`(() => { const k = ctx.town.curbSpot({ near: { x: ctx.car.pos.x, z: ctx.car.pos.z }, minD: 10, maxD: 200, len: 6 }); return k ? { x: k.x, z: k.z, h: k.h } : null; })()`);
      await g(`ctx.cars.leaveAt("orange", { kind: "left", x: ${kerb.x}, z: ${kerb.z}, h: ${kerb.h} })`);
      await setCoins(100);
      t.check("an impounded car: Tuvia can't (that's the police)", await g(`ctx.cars.deliver("purple")`) === "none" && await coins() === 100);
      t.check("📞 Tuvia: bring orange home → done", await g(`ctx.cars.deliver("orange")`) === "done");
      t.check("…40 coins, once", await coins() === 60 && await g(`ctx.cars.deliver("orange")`) === "none" && await coins() === 60);
      t.check("…orange is at home now", await kind("orange") === "home");
      // the contact's rows (📞 Contacts › Tuvia's Towing)
      await g(`ctx.cars.leaveAt("orange", { kind: "left", x: ${kerb.x}, z: ${kerb.z}, h: ${kerb.h} })`);
      const html = await t.L(`(() => { const el = document.createElement("div"); const c = (__lulu3d.ctx.community && __lulu3d.ctx.community.contacts ? __lulu3d.ctx.community.contacts : null); return import("./js/features/community/calls.js").then(m => { const d = m.CONTACTS.find(x => x.id === "towing"); if (!d) return ""; d.render(el); return el.textContent; }); })()`);
      t.check("📞 Contacts › Tuvia's Towing lists orange (bring it home · 40) and purple at the impound", /Tuvia/.test(html) && /Sunset Glow/.test(html) && /40/.test(html) && /Royal Purple[^]*impound/.test(html), html.slice(0, 300));
      await g(`ctx.cars.leaveAt("orange", { kind: "home" })`);
    });

    // ════ the impound gate: THAT car, the tow's price; the one she came in stays parked ════
    await step("gate", async () => {
      await setCoins(200);
      // she drives pink to the Lakewood impound for purple
      await g(`(() => { if (ctx.foot.active) ctx.foot.end("test"); return true; })()`);
      await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
      await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run", 9000);
      await g(`ctx.town.warp({ town: "lakewood", exitS: ctx.town.exitOf("lakewood", 0), quiet: true })`);
      await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood" && !!__lulu3d.ctx.civic.spot("impound")`, "in Lakewood (impound)", 10000);
      await g(`(L3.setState("playing"), true)`); await t.frames(6);
      const drv = await g(`ctx.car.skinKey`);
      t.check(`she's driving pink, purple is held in Lakewood`, drv === "pink" && await kind("purple") === "impound");
      await g(`(() => { const sp = ctx.civic.spot("impound"), c = ctx.car; c.place(sp.x + sp.nx * 14, sp.z + sp.nz * 14, Math.atan2(sp.nx, sp.nz)); c.vx = c.vz = 0; const n = ctx.world.road.nearest(c.pos.x, c.pos.z, c.s, {}); c.s = n.s; c.d = n.d; return true; })()`);
      t.check("out of her car by the impound", await walkOut("impound"));
      await t.frames(4);
      const came = await g(`(() => { const c = ctx.foot.parkedCar; return c ? { x: c.x, z: c.z } : null; })()`);
      t.check("the impound holds purple (a tow): the fee is 60", await g(`ctx.impound.held && ctx.impound.held.key === "purple" && ctx.impound.fee() === 60`), await g(`JSON.stringify(ctx.impound.held)`));
      const c0 = await coins();
      t.check("pay → released", await g(`ctx.impound.pay("gate")`) === "paid" && await g(`ctx.impound.release("gate")`));
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "out at the kerb", 8000);
      await g(`(${D}.track(), ${D}.syncProps(), true)`);
      t.check("…60 coins, purple at the kerb by the gate, the car she came in (pink) parked where she left it",
        c0 - await coins() === 60 && await g(`ctx.car.skinKey`) === "purple" && await kind("purple") === "with" && await kind(drv) === "left"
        && await g(`(p => !!p && Math.hypot(p.c.x - ${came.x}, p.c.z - ${came.z}) < 0.4)(${D}.S.props["${drv}"])`), await recs());
    });

    // ════ an arrest → the impound; a new day doesn't bring it home ════
    await step("arrest", async () => {
      await g(`(() => { const sp = ctx.civic.spot("impound"), c = ctx.car; if (ctx.foot.active) ctx.foot.end("test"); c.place(sp.x + sp.nx * 6, sp.z + sp.nz * 6, Math.atan2(sp.nx, sp.nz)); c.vx = c.vz = 0; const n = ctx.world.road.nearest(c.pos.x, c.pos.z, c.s, {}); c.s = n.s; c.d = n.d; return true; })()`);
      await g(`(ctx.foot.start("copWalk", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 8000);
      await g(`(ctx.civic.impound.show(true), true)`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("places:out", { kind: "law", door: "precinct", town: "lakewood", car: false, here: true }))`);
      await t.frames(3);
      t.check("arrested: purple is impounded in Lakewood (the police fee — not the tow's)", await kind("purple") === "impound" && await g(`${D}.rec("purple").why`) === "arrest" && await g(`ctx.impound.held && ctx.impound.held.key === "purple" && ctx.impound.held.why === "arrest"`));
      t.check("…and the car she came in (pink, at the precinct's kerb) is legal parking there — no tow", await kind("pink") === "left" && await g(`${D}.rec("pink").legal`) === true, await recs());
      await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home({ via: "test" }) : L3.startRun({ home: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "a new day", 30000);
      await t.frames(8);
      t.check("a new day: purple is STILL at the impound (no auto-return), she starts with the car at home (orange)", await kind("purple") === "impound" && await g(`(h => !!h && h.key === "purple")(ctx.cars.held("lakewood"))`) && await g(`ctx.car.skinKey`) === "orange", await recs());
    });

    // ════ no car at home, no coins: Ima's minivan ════
    await step("minivan", async () => {
      await setCoins(0);
      // (in one go: her walk ends, every car of hers is out at an impound, the next day starts)
      await g(`(() => { if (ctx.foot.active) ctx.foot.end("test"); for (const k of ["pink", "orange"]) ctx.cars.leaveAt(k, { kind: "impound", town: "lakewood", why: "tow" }); ctx.onegame && ctx.onegame.home ? ctx.onegame.home({ via: "test" }) : L3.startRun({ home: true }); return true; })()`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "home, on foot", 30000);
      await t.frames(6);
      const mv = await g(`(() => { const F = ctx.foot.debug.F, P = ctx.home.park; return F.car ? { key: F.car.key, d: +Math.hypot(F.car.stub.x - P.x, F.car.stub.z - P.z).toFixed(2), n: ctx.traffic.cars.filter(c => c.kind === "cars_lulu" && Math.hypot(c.x - P.x, c.z - P.z) < 3).length } : null; })()`);
      t.check("none of her cars at home, no coins: Ima's minivan in the driveway (not one of hers)", !!mv && mv.key === "town_minivan" && mv.d < 1 && mv.n === 0, JSON.stringify(mv));
      await footAt(await g(`ctx.foot.debug.F.car.stub.x + 2`), await g(`ctx.foot.debug.F.car.stub.z`));
      await t.frames(4);
      t.check("✋ → she drives off in the minivan (a borrowed ride — her own cars stay where they are)", await press(`L3.state === "playing" && !!(ctx.foot.vehicle || ctx.G.borrowed)`), await g(`JSON.stringify({ st: L3.state, v: ctx.foot.vehicle, b: ctx.G.borrowed })`));
      await g(`(${D}.track(), true)`);
      t.check("…and nothing of hers moved", await kind("purple") === "impound" && await kind("orange") === "impound" && await kind("pink") === "impound", await recs());
    });

    const r = await W.report(t); W.log(r);
    W.check(t, "cars2", r, ["nan", "flat", "underground"]);
  },
};
