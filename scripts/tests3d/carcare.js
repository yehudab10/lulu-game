// 🧽 features/carcare — THE CAR-CARE ROW (roadmap 43 b), with the QA watchdog on. Midwood: the Coney Island Ave fronts +
// the Minivan Wash are claimed (their ✋ is ours) · dirt builds with distance (× 3 in the rain), shows on the paint, and a
// dirty car makes a cop's look land ~10 % sooner · the wash (8): clean + sparkling, no dirt while it sparkles · a lost
// heart = a dent level (≤ 3, decals on the car) · the body shop: one dent for 25, then 🪠 DIY for 10 (pop them all) ·
// tires: Sport → more grip dry, less wet; worn after 3 real days → all-season grip + the same set half price · mufflers:
// LOUD pops when she lifts off + cops hear her farther, QUIET at night → spotted later · Gas & Gossip: one true thing, the
// same all hour · no car at the shop → they say so · Ima texts about a dirty car at the door, once a day · it's all saved
// with ctx.cars (the 💾 save code) · Lakewood's Minivan Wash too. Money never below 0; nothing breaks.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "carcare",
  viewport: { width: 1280, height: 720 },
  query: "&enable=carcare,cars,town,foot,world,phone,shops,garage,law,atmos",
  save2d: { totalCoins: 500, cruiseUnlocked: true, ownedSkins: ["pink", "purple"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const D = "ctx.carcare.debug";
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); }
      if (process.env.CARCARE_LOG) console.log(`    [${label}]`, JSON.stringify(await g(`${D}.S.log.slice(-8)`))); };
    const setDate = iso => t.L(`import("./js/features/seasons/calendar.js").then(m => (m.setDate(${JSON.stringify(iso)}), true))`);
    const coins = () => g(`(() => { let c = 0; try { c = JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins; } catch (e) {} return c; })()`);
    const cond = () => g(`JSON.parse(JSON.stringify(ctx.carcare.cond("pink")))`);
    const tick = () => g(`(${D}.S.t = 99, true)`).then(() => t.frames(3));
    const card = () => t.L(`import("./js/features/shops/card.js").then(m => m.cardOpen())`);
    const press = id => t.L(`import("./js/features/shops/card.js").then(m => { m.press(${JSON.stringify(id)}); m.press(${JSON.stringify(id)}); return m.cardOpen(); })`);
    const closeCard = () => t.L(`import("./js/features/shops/card.js").then(m => (m.closeCard(), true))`);
    const emitDamage = () => t.L(`import("./js/core/ctx.js").then(m => (m.emit("damage", { power: 1, why: "test", source: "test" }), true))`);
    const town = async id => {
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), true)`); await t.frames(10); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id} loads`, 120000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)} && __lulu3d.ctx.storefronts.fronts().length > 0`, `into ${id}`, 30000);
    };
    const drive = async () => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(4); }
      if (await g(`L3.state !== "playing"`)) { await g(`(L3.setState("playing"), true)`); await t.frames(4); }
    };
    // park her car at a front's kerb (on the street in front of its door), get out, stand at the door
    const front = name => g(`(() => { const f = ${D}.frontsHere().find(f => f.st.named === ${JSON.stringify(name)}); return f ? { id: f.id, x: f.door.x, z: f.door.z, nx: f.nx, nz: f.nz, ux: f.ux, uz: f.uz } : null; })()`);
    const atShop = async (name, carToo = true) => {
      const f = await front(name);
      if (!f) return null;
      await drive();
      if (carToo) {
        await g(`(() => { const c = ctx.car, x = ${f.x + f.nx * 5}, z = ${f.z + f.nz * 5}; c.place(x, z, Math.atan2(${f.ux}, ${f.uz})); const n = ctx.world.road.nearest(x, z, c.s, {}); c.s = n.s; c.d = n.d; return true; })()`);
        await t.frames(3);
      }
      await g(`(ctx.foot.start("parked", { noIntro: true, drivable: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${name}: on foot`, 8000);
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${f.x + f.nx * 0.8}, 0.05, ${f.z + f.nz * 0.8}); F.vel.set(0, 0, 0); return true; })()`);
      await t.frames(4);
      await tick();
      return f;
    };
    const act = id => g(`ctx.storefronts.debug.act(${JSON.stringify(id)})`);

    await W.install(t);
    await t.until(`__lulu3d.state === "title"`, "title", 90000);
    await setDate("2026-11-24T11:00");         // a Tuesday, 11 am: everything's open
    await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
    await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run", 60000);
    // (the shops' hours follow the SKY's hour in a Cruise day — storefronts/hours.js worldNow: keep it late morning)
    await g(`(ctx.atmos.debug.time(0.15), ctx.atmos.debug.freeze(true), true)`);
    await g(`(ctx.cars.debug.S.migrated || ctx.cars.debug.migrate(), true)`);
    if (!await town("midwood")) { t.check("into Midwood", false); return; }
    await drive();
    await tick();
    await W.reset(t);

    // ════ the fronts are ours ════
    await step("claims", async () => {
      const names = await g(`${D}.S.claims.map(f => f.st.named).sort()`);
      t.check("Midwood: the Minivan Wash + the four Coney Island Ave shops are claimed", ["24 HR GAS & GOSSIP", "BUMPER TO BUMPER BODY SHOP", "CONEY ISLAND AVE MUFFLER", "MIDWOOD MINIVAN WASH", "TIRE-D OF IT TIRES"].every(n => names.includes(n)), JSON.stringify(names));
      const f = await front("MIDWOOD MINIVAN WASH");
      const lab = await g(`ctx.storefronts.debug.label(${JSON.stringify(f.id)})`);
      t.check("its ✋ is ours: the wash + its price", /WASH · 8/.test(lab), lab);
      t.check("they're on the 📱 Map's register (shown once she's been by)", await g(`!!ctx.pins.get("carcare:${f.id}")`));
    });

    // ════ dirt ════
    await step("dirt", async () => {
      await g(`(Object.assign(ctx.carcare.cond("pink"), { dirt: 0, shine: 0, dents: 0 }), true)`);
      await drive();
      await t.hold(7, 1); await t.frames(150); await t.hold(7, 0);
      const c = await cond();
      t.check("driving makes her car dirty (a little)", c.dirt > 0 && c.dirt < 0.2, String(c.dirt));
      const dry = await g(`(() => { const c = { dirt: 0, shine: 0 }; return ${D}.addDirt(c, 1000, 0); })()`);
      const wet = await g(`(() => { const c = { dirt: 0, shine: 0 }; return ${D}.addDirt(c, 1000, 1); })()`);
      t.check("rain: 3× the dirt per km", Math.abs(wet / dry - 3) < 0.01 && dry > 0.02 && dry < 0.03, `${dry} / ${wet}`);
      await g(`(ctx.carcare.cond("pink").dirt = 1, true)`);
      await tick();
      const tinted = await g(`(() => { let m = null; ctx.car.model.traverse(o => { if (o.isMesh && o.material.name === "Body" && !m) m = o.material; }); return m ? { tint: m.userData.tint, base: m.userData.base, rough: m.roughness, r0: m.userData.rough } : null; })()`);
      t.check("a dirty car looks dirty (the paint toward grime, a duller finish)", tinted && tinted.tint !== tinted.base && tinted.rough > tinted.r0, JSON.stringify(tinted));
      await g(`${D}.lawMuls()`);
      const law = await t.L(`import("./js/features/law/cops.js").then(m => m.copMul("copLook"))`);
      t.check("a dirty car: a cop's look lands ~10 % sooner", Math.abs(law - 1.1) < 0.001, String(law));
    });

    // ════ the wash ════
    await step("wash", async () => {
      const before = await coins();
      const f = await atShop("MIDWOOD MINIVAN WASH");
      t.check("at the Minivan Wash with her car", !!f && !!(await g(`${D}.carAt(${D}.frontsHere().find(f => f.st.named === "MIDWOOD MINIVAN WASH")).key`)));
      t.check("✋ → the wash card", await act(f.id) && await card());
      await press("wash");
      const c = await cond();
      t.check("8 coins: clean, sparkling for 10 minutes", c.dirt === 0 && c.shine > Date.now() + 9 * 60000 && await coins() === before - 8, `${JSON.stringify(c)} ${before} → ${await coins()}`);
      await press("wash");
      t.check("a second wash while it sparkles: not charged", await coins() === before - 8);
      await closeCard(); await t.frames(4);
      await drive();
      await t.hold(7, 1); await t.frames(90); await t.hold(7, 0);
      t.check("no dirt while it sparkles", (await cond()).dirt === 0);
      await g(`${D}.lawMuls()`);
      t.check("a clean car: no extra look", await g(`ctx.carcare.look`) === 1);
    });

    // ════ dents ════
    await step("dents", async () => {
      await drive();
      for (let i = 0; i < 4; i++) await emitDamage();
      const c = await cond();
      t.check("a lost heart = a dent level, ≤ 3", c.dents === 3, String(c.dents));
      await tick();
      const vis = await g(`(() => { const d = ctx.car.model.userData.careDents; return d ? d.children.filter(m => m.visible).length : -1; })()`);
      t.check("6 dents show on the car", vis === 6, String(vis));
      const before = await coins();
      const f = await atShop("BUMPER TO BUMPER BODY SHOP");
      t.check("✋ → the body shop card", await act(f.id) && await card());
      await press("one");
      t.check("one dent fixed for 25", (await cond()).dents === 2 && await coins() === before - 25);
      const open = await press("diy");
      t.check("🪠 DIY: 10 coins, the card closes, the game starts", !open && await g(`${D}.D.on`) && await coins() === before - 35);
      for (let i = 0; i < 12 && await g(`${D}.D.on`); i++) {
        await g(`(() => { const D = ${D}.D; D.x = (D.zone[0] + D.zone[1]) / 2; D.dir = 0; ${D}.diyTap(); return true; })()`);
        await t.frames(3);
      }
      const c2 = await cond();
      t.check("she popped them all: no dents, the game's over", c2.dents === 0 && !await g(`${D}.D.on`), JSON.stringify(c2));
      await t.frames(4);
      const vis2 = await g(`(() => { const F = ctx.foot.debug.F, d = F.car && F.car.stub && F.car.stub.obj.userData.careDents; return d ? d.children.filter(m => m.visible).length : 0; })()`);
      t.check("…and the parked car shows none", vis2 === 0, String(vis2));
    });

    // ════ tires ════
    await step("tires", async () => {
      const before = await coins();
      const f = await atShop("TIRE-D OF IT TIRES");
      t.check("✋ → the tire card", await act(f.id) && await card());
      await press("sport");
      const c = await cond();
      t.check("Sport tires for 60", c.tire === "sport" && await coins() === before - 60, `${c.tire} ${before} → ${await coins()}`);
      await closeCard(); await t.frames(3);
      await drive(); await tick();
      const dry = await g(`ctx.car.mods && ctx.car.mods.grip`);
      t.check("dry road: more grip", dry > 1.1, String(dry));
      const wet = await g(`${D}.mods("pink")`);
      await g(`(ctx.atmos.debug.weather("rain", 1, true), true)`); await t.frames(30);
      const wetG = await g(`(${D}.mods("pink").grip)`);
      t.check("wet road: a little less", wetG < dry, `${wetG} (wet ${await g(`ctx.atmos.wet`)})`);
      await g(`(ctx.atmos.debug.weather(null), true)`);
      await g(`(ctx.carcare.cond("pink").tireAt = Date.now() - 4 * 864e5, true)`);
      const worn = await g(`${D}.mods("pink")`);
      t.check("4 days later: worn back to all-season grip", Math.abs(worn.grip - 1) < 1e-6 && Math.abs(worn.top - 1) < 1e-6, JSON.stringify(worn || wet));
      const before2 = await coins();
      await atShop("TIRE-D OF IT TIRES");
      await act(f.id);
      await press("sport");
      t.check("the same set again: half price (30)", await coins() === before2 - 30 && (await cond()).tireAt > Date.now() - 60000, `${before2} → ${await coins()}`);
      await closeCard();
    });

    // ════ mufflers ════
    await step("muffler", async () => {
      const before = await coins();
      const f = await atShop("CONEY ISLAND AVE MUFFLER");
      t.check("✋ → the muffler card", await act(f.id) && await card());
      await press("loud");
      t.check("LOUD for 30", (await cond()).muf === "loud" && await coins() === before - 30);
      await closeCard(); await t.frames(3);
      await drive(); await tick();
      t.check("LOUD: the cops hear her 20 % farther", Math.abs(await g(`ctx.carcare.hear`) - 1.2) < 1e-6);
      const pops0 = await g(`${D}.S.popN || 0`);
      await t.hold(7, 1); await t.frames(200); await t.hold(7, 0); await t.frames(60);
      const pops = (await g(`${D}.S.popN || 0`)) - pops0;
      t.check("lifting off at speed: POP POP", pops >= 2, `${pops} pops at ${await g(`ctx.car.speed.toFixed(1)`)} m/s`);
      await g(`(ctx.carcare.muffler("pink", "quiet"), ctx.atmos.debug.time("night"), true)`);
      await t.until(`__lulu3d.ctx.atmos.night > 0.5`, "night falls", 5000);
      await g(`${D}.lawMuls()`);
      t.check("QUIET at night: spotted ~15 % later", Math.abs(await g(`ctx.carcare.look`) - 0.85) < 1e-6, String(await g(`ctx.carcare.look`)));
      await g(`(ctx.atmos.debug.time("noon"), true)`);
    });

    // ════ the gossip ════
    await step("gossip", async () => {
      const before = await coins();
      const f = await atShop("24 HR GAS & GOSSIP", false);
      await act(f.id);
      const g1 = await g(`${D}.S.log.filter(l => l.ev === "gossip").slice(-1)[0]`);
      const facts = await g(`${D}.facts().map(f => f.id)`);
      t.check("Bracha tells one true thing about today (free)", g1 && g1.id && facts.includes(g1.id) && await coins() === before, JSON.stringify({ g1, facts }));
      const again = await g(`ctx.carcare.gossip().text`);
      t.check("the same hour: the same news (\"come back next hour\")", /next hour/.test(again), again);
      t.check("on a Tuesday at 11: the Ballroom wedding + the Parkway camera are among today's facts", facts.includes("wedding") && facts.includes("pkwy"), JSON.stringify(facts));
    });

    // ════ no car at the shop ════
    await step("no car", async () => {
      const f = await front("MIDWOOD MINIVAN WASH");
      await drive();
      await g(`(() => { const c = ctx.car; c.place(c.pos.x + 400, c.pos.z, c.h); return true; })()`).catch(() => null);
      await atShop("MIDWOOD MINIVAN WASH", false);
      const r = await g(`${D}.carAt(${D}.frontsHere().find(f => f.st.named === "MIDWOOD MINIVAN WASH"))`);
      await act(f.id);
      t.check("her car's far off: no card, they tell her to bring it", r && !r.key && !await card(), JSON.stringify(r));
    });

    // ════ Ima's text at the door ════
    await step("ima", async () => {
      await g(`(Object.assign(ctx.carcare.cond("pink"), { dirt: 1, shine: 0 }), ${D}.SAVE.imaDay = "", true)`);
      await t.L(`import("./js/core/ctx.js").then(m => (m.emit("foot:start", { reason: "home" }), true))`);
      const got = await t.until(`__lulu3d.ctx.carcare.debug.S.log.some(l => l.ev === "imaText")`, "Ima's text", 6000);
      const sh = await g(`${D}.S.log.filter(l => l.ev === "imaText").map(l => l.shown)`);
      t.check("a dirty car at the door: Ima says something (once a day)", got, JSON.stringify(sh));
      await t.L(`import("./js/core/ctx.js").then(m => (m.emit("foot:start", { reason: "home" }), true))`);
      await t.frames(200);
      const n = await g(`${D}.S.log.filter(l => l.ev === "imaText").length`);
      t.check("…only once a day", n === 1, String(n));
    });

    // ════ saved with ctx.cars ════
    await step("save", async () => {
      const care = await g(`JSON.stringify(ctx.cars.debug.SAVE.care)`);
      t.check("the condition is in the cars save (the 💾 save code carries it)", /"pink":\{[^}]*"tire":"sport"[^}]*"muf":"quiet"/.test(care), care);
      t.check("money never went below 0", await coins() >= 0);
    });

    // ════ Lakewood ════
    await step("lakewood", async () => {
      if (!await town("lakewood")) { t.check("into Lakewood", false); return; }
      await drive(); await tick();
      const names = await g(`${D}.S.claims.map(f => f.st.named)`);
      t.check("Lakewood's Minivan Wash is claimed too", names.includes("MINIVAN WASH"), JSON.stringify(names));
    });

    const r = await W.report(t); W.log(r);
    W.check(t, "carcare", r, ["nan", "flat", "underground"]);
  },
};
