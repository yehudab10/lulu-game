// ⛽ FUEL (features/fuel, step 1 — the owner approved the plan 2026-11-27: "a real necessary thing but doesn't become a
// huge burden"):
//   • every car has a tank; an old save / a car never driven yet is FULL; the ranges per class (the Mazelatis drink more)
//   • it drains with distance only (a highway stretch ≈ its km of a 64 km tank), not standing still; nitro burns 3×
//   • the gauge under the speedo, amber + one quiet objective-line badge when low
//   • filling: a pump's visit (Gas 'n' Go / the rest areas) or the pad at a town interchange's gas station → full, paid
//     pro rata; short of coins → what she can pay for; at 0 coins a quarter tank on account (one IOU), paid off next time
//   • the pumps are on the 📱 Map
//   • step 2 — 🔋: a Tushla at a pump gets Yanky's joke (no fill); stopped at a charger it CHARGES (fast to 80 %), paying as
//     it goes, and keeps going with her out of the car; a chime when full. The HOME CHARGER: needs a home she owns; bought
//     → a Tushla parked at that house is full; Ima's extension cord trickles to 30 % once a day; selling the home boxes it
//   • step 3 — running dry: past E a hidden 3 km reserve ("fumes"), a chase can't empty it, then she coasts (no throttle,
//     no nitro); 📞 Chaverim's splash (free once a day, then 10), 🛢️ a can from a pump on foot; an empty car isn't towed
//     for 10 minutes; a job starting near E pings the nearest pump; a self-driving Tushla running low heads for a charger
module.exports = {
  name: "fuel",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world",
  save2d: { totalCoins: 500, cruiseUnlocked: true, ownedSkins: ["pink", "tushla_nu"], selectedSkin: "pink" },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run starts", 60000)) return;
    if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
    if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
    await g(`(ctx.law.hold(99999), ctx.traffic.clear(), true)`);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; m.on("fuel:fill", e => __ev.push(e)); })`);
    const place = (s, d = 5.25, v = 0) => g(`(() => { const s = ${s}, p = ctx.world.road.point(s, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);

    await step("tanks", async () => {
      t.check("ctx.fuel is up; her car (an old save) starts FULL", await g(`!!ctx.fuel && ctx.fuel.key() === "pink" && ctx.fuel.level() === 1`));
      const R = await g(`["pink", "shabbatino", "machatunim", "tushla_nu", "tushla_oy", "tushla_kugel"].map(k => ctx.fuel.range(k))`);
      t.check("ranges: Refael's 64 km · a Mazelati 48 (the Machatunim 44) · Tushlas 72–80 (the Kugeltruck 60)", JSON.stringify(R) === JSON.stringify([64, 48, 44, 72, 80, 60]), JSON.stringify(R));
      t.check("a car she's never driven is full (a new car from a dealer)", await g(`ctx.fuel.level("geltspyder") === 1`));
      await t.frames(12);
      const gz = await g(`ctx.fuel.gauge`);
      t.check("the gauge under the speedo: ⛽, full", gz && gz.icon === "⛽" && gz.w === "100%" && gz.cls === "", JSON.stringify(gz));
    });

    await step("drain", async () => {
      await g(`(ctx.fuel.set("pink", 0.8), true)`);
      await t.frames(40);
      t.check("standing still costs nothing", Math.abs(await g(`ctx.fuel.level()`) - 0.8) < 1e-4);
      const s0 = await g(`ctx.car.s`);
      await place(`ctx.car.s + 50`, 5.25, 28);
      await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => { window.__auto = true; c.hook("controls", (ctl, dt) => { if (window.__auto) Object.assign(ctl, m.autoDrive(dt, 5.25, 28)); }, 999); }))`);
      const a0 = await g(`({ s: ctx.car.s, v: ctx.fuel.level() })`);
      await t.frames(300);
      const a1 = await g(`({ s: ctx.car.s, v: ctx.fuel.level() })`);
      const km = (a1.s - a0.s) / 1000, drop = a0.v - a1.v, want = km / 64;
      t.check("driving drains it by distance: ≈ the km driven of a 64 km tank", km > 0.15 && Math.abs(drop - want) < want * 0.2, `${(km * 1000).toFixed(0)} m → −${(drop * 100).toFixed(3)} % (want −${(want * 100).toFixed(3)} %)`);
      // nitro: 3× while it's lit
      await g(`(ctx.G.boost = 1, true)`);
      const b0 = await g(`({ s: ctx.car.s, v: ctx.fuel.level() })`);
      await t.hold(5, 1); await t.frames(45); await t.hold(5, 0);
      const b1 = await g(`({ s: ctx.car.s, v: ctx.fuel.level() })`);
      const perM0 = drop / (a1.s - a0.s), perM1 = (b0.v - b1.v) / (b1.s - b0.s);
      t.check("🔥 nitro burns more (≈ 3× a metre while it's lit)", perM1 > perM0 * 1.8, `${(perM1 / perM0).toFixed(2)}×`);
      await g(`(window.__auto = false, true)`);
    });

    await step("low", async () => {
      await g(`(ctx.fuel.set("pink", 0.1), true)`);
      await t.frames(20);
      const gz = await g(`ctx.fuel.gauge`);
      const chip = await t.L(`(document.querySelector(".fuel-chip") || {}).textContent || ""`);
      t.check("low: the gauge turns amber + one quiet badge (no toast)", gz.cls === "low" && /Low fuel/.test(chip) && /km left/.test(chip), `${JSON.stringify(gz)} · ${chip}`);
    });

    await step("fill", async () => {
      await g(`(ctx.car.vx = ctx.car.vz = 0, ctx.car.vF = 0, ctx.fuel.set("pink", 0.5), true)`);
      const c0 = await coins();
      const r = await g(`ctx.fuel.fill("test")`);
      t.check("a fill from half: pro rata — 15 of a 30-coin tank", r.ok && r.cost === 15 && c0 - await coins() === 15, JSON.stringify(r));
      await t.frames(150);
      t.check("…the gauge climbs to full in a few seconds", Math.abs(await g(`ctx.fuel.level()`) - 1) < 1e-3);
      t.check("already full: nothing charged", (await g(`ctx.fuel.fill("test")`)).ok === false && await coins() === c0 - 15);
      // the existing drive-up bays fill her up through their visit
      await g(`(ctx.fuel.set("pink", 0.2), true)`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("world:visit", { id: "gas", s: 0 }))`);
      await t.frames(4);
      t.check("Yanky's Gas 'n' Go visit fills the tank", (await t.L(`window.__ev`)).some(e => e.why === "gas" && e.to === 1));
      await g(`(ctx.fuel.set("pink", 0.6), true)`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("world:visit", { id: "exits_pump", s: 0 }))`);
      await t.frames(4);
      t.check("…and so does the rest areas' pump", (await t.L(`window.__ev`)).some(e => e.why === "exits_pump"));
    });

    await step("broke", async () => {
      await t.frames(130);
      await t.L(`import("./js/core/save.js").then(m => m.wallet.spend(m.wallet.coins))`);
      await g(`(ctx.fuel.set("pink", 0.1), true)`);
      const r = await g(`ctx.fuel.fill("test")`);
      t.check("0 coins: a quarter tank on account (never below 0)", r.ok && r.cost === 0 && r.iou === 8 && await coins() === 0, JSON.stringify(r));
      await t.frames(130);
      t.check("…the tank got it", Math.abs(await g(`ctx.fuel.level()`) - 0.35) < 0.01);
      t.check("one IOU at a time: no second tab", (await g(`ctx.fuel.fill("test")`)).ok === false);
      await t.L(`import("./js/core/save.js").then(m => m.wallet.add(7))`); await t.frames(40);
      const r2 = await g(`ctx.fuel.fill("test")`);
      t.check("short of coins: what she can pay for (7 coins ≈ 23 %)", r2.ok && r2.cost === 7 && await coins() === 0 && Math.abs(r2.to - (0.35 + 7 / 30)) < 0.01, JSON.stringify(r2));
      await t.frames(130);
      await t.L(`import("./js/core/save.js").then(m => m.wallet.add(100))`); await t.frames(40);
      const r3 = await g(`ctx.fuel.fill("test")`);
      t.check("next paid fill pays the IOU off too", r3.ok && await g(`ctx.fuel.debug.FS.iou`) === 0 && 100 - await coins() === r3.cost + 8, `${JSON.stringify(r3)} · ${await coins()}`);
    });

    await step("town pump", async () => {
      await t.frames(130);
      await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 0`, "an exit is planned", 15000);
      await g(`(() => { const P = ctx.fuel.debug.pads(-1.85)[0]; ctx.world.prebuild(P.s + 180); ctx.car.place(P.x, P.z, P.h); ctx.car.s = P.hs; ctx.car.d = P.hd; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`);
      await g(`(ctx.fuel.set("pink", 0.3), true)`);
      await t.frames(60);
      t.check("⛽ stopped by the gas station at a town's interchange: it fills", (await t.L(`window.__ev`)).some(e => e.why === "town"),
        JSON.stringify(await g(`({ car: [ctx.car.pos.x, ctx.car.pos.z, ctx.car.s, ctx.car.d], P: ctx.fuel.debug.pads(-1.85)[0], pad: ctx.fuel.debug.townPad(), v: ctx.car.speed, st: L3.state, town: ctx.town.active, key: ctx.fuel.key(), F: { armed: ctx.fuel.debug.F.pad.armed, t: ctx.fuel.debug.F.pad.t }, pads: ctx.fuel.debug.pads().map(p => Math.round(p.s)) })`)));
    });

    await step("charge", async () => {
      await t.L(`import("./js/core/ctx.js").then(m => { window.__ch = []; m.on("fuel:charge", e => __ch.push(e)); })`);
      await g(`(() => { const s = ctx.car.s + 400, p = ctx.world.road.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`);
      await t.L(`import("./js/core/save.js").then(m => m.wallet.add(3000))`); await t.frames(40);
      await t.L(`import("./js/features/garage/buy.js").then(m => m.equipSkin("tushla_nu"))`); await t.frames(10);
      t.check("🔋 in a Tushla the gauge is a battery", await g(`ctx.fuel.key() === "tushla_nu"`) && (await g(`ctx.fuel.gauge`)).icon === "🔋");
      await g(`(ctx.fuel.set("tushla_nu", 0.5), true)`);
      const fr = await g(`ctx.fuel.fill("test")`);
      t.check("a Tushla at a gas pump: Yanky's joke, no fill", fr.why === "ev" && Math.abs(await g(`ctx.fuel.level()`) - 0.5) < 0.002, `${JSON.stringify(fr)} · ${await g(`ctx.fuel.level()`)} · ${await g(`ctx.fuel.key()`)}`);
      const c0 = await coins();
      await g(`(() => { const P = ctx.fuel.debug.pads(-1.85)[0]; ctx.car.place(P.x, P.z, P.h); ctx.car.s = P.hs; ctx.car.d = P.hd; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`);
      await t.frames(100);
      const l1 = await g(`ctx.fuel.level()`), paid = c0 - await coins();
      t.check("stopped at the interchange charger: it CHARGES (fast below 80 %)", l1 > 0.55 && (await t.L(`window.__ch`)).some(e => e.act === "start"), l1.toFixed(3));
      t.check("…paying as it goes (≈ 15 coins a full charge)", paid >= 1 && Math.abs(paid - (l1 - 0.5) * 15) <= 1.5, `${paid} for +${((l1 - 0.5) * 100).toFixed(1)} %`);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      const l2 = await g(`ctx.fuel.level("tushla_nu")`); await t.frames(60);
      t.check("…and keeps charging while she's out of the car", await g(`ctx.fuel.level("tushla_nu")`) > l2 + 0.02,
        JSON.stringify(await g(`({ ev: ctx.fuel.debug.charge.evHere(), sk: ctx.car.skinKey, st: L3.state, stub: !!(ctx.foot.debug.F.car && ctx.foot.debug.F.car.stub), log: ctx.fuel.debug.charge.C.log.slice(-3) })`)));
      await g(`(ctx.fuel.set("tushla_nu", 0.985), true)`); await t.frames(60);
      t.check("full: it stops, with a chime", (await t.L(`window.__ch`)).some(e => e.act === "end" && e.why === "full") && await g(`ctx.fuel.level("tushla_nu")`) >= 0.999);
      await g(`(ctx.foot.end("test"), true)`); await t.frames(3);
      if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
    });

    await step("home charger", async () => {
      t.check("no home of her own: it won't sell one (Ima's wall is off limits)", (await g(`ctx.fuel.buyHome()`)).why === "nohome");
      await g(`ctx.realestate.registry.claim("midwood:120:60", { town: "midwood", address: "1234 E 34th St (test)" })`);
      const c0 = await coins();
      const r = await g(`ctx.fuel.buyHome()`);
      t.check("with a home: 1,500 coins, installed there", r.ok && c0 - await coins() === 1500 && await g(`ctx.fuel.home && ctx.fuel.home.id === "midwood:120:60"`), JSON.stringify(r));
      await g(`(ctx.fuel.set("tushla_nu", 0.2), ctx.cars.leaveAt("tushla_nu", { kind: "left", town: "midwood", lx: 122, lz: 64, h: 0 }), true)`);
      await t.frames(80);
      t.check("a Tushla parked at that house is full next time", await g(`ctx.fuel.level("tushla_nu")`) >= 0.999, String(await g(`ctx.fuel.level("tushla_nu")`)));
      await g(`(ctx.fuel.set("tushla_nu", 0.1), ctx.cars.leaveAt("tushla_nu", { kind: "home" }), ctx.fuel.debug.FS.cord = {}, true)`);
      await t.frames(80);
      t.check("🔌 at Ima's: the extension cord — a trickle to 30 %, once a day", Math.abs(await g(`ctx.fuel.level("tushla_nu")`) - 0.3) < 0.01);
      await g(`(ctx.fuel.set("tushla_nu", 0.1), true)`); await t.frames(80);
      t.check("…only once a real day", Math.abs(await g(`ctx.fuel.level("tushla_nu")`) - 0.1) < 0.01);
      await g(`ctx.realestate.registry.release("midwood:120:60")`); await t.frames(80);
      t.check("the home's sold: the charger comes back in a box", await g(`!ctx.fuel.home && ctx.fuel.debug.FS.boxed === true`));
    });

    await step("dry", async () => {
      await t.L(`import("./js/features/garage/buy.js").then(m => m.equipSkin("pink"))`); await t.frames(6);
      await t.L(`import("./js/core/ctx.js").then(m => { window.__dry = []; for (const n of ["fuel:empty", "fuel:rescue"]) m.on(n, e => __dry.push(n + ":" + JSON.stringify(e))); })`);
      await place(`ctx.car.s + 300`, 5.25, 25);
      await g(`(ctx.pins.clear(), ctx.fuel.set("pink", 0.0002), true)`);
      await g(`(window.__auto = true, true)`);
      await t.frames(30);
      const chip = await t.L(`(document.querySelector(".fuel-chip") || {}).textContent || ""`);
      t.check("past E: the reserve (fumes) — it still drives, the chip says so", await g(`ctx.fuel.fumes() && !ctx.fuel.dry() && ctx.car.speed > 10`) && /fumes/.test(chip), chip);
      await g(`(ctx.law.startChase("SPEEDING"), ctx.fuel.debug.FS.fumes.pink = 1200, true)`); await t.frames(90);
      t.check("🚨 in a chase the reserve can't run out (cops end chases, not the gauge)", await g(`ctx.fuel.debug.FS.fumes.pink`) >= 1000, String(await g(`ctx.fuel.debug.FS.fumes.pink`)));
      await g(`(ctx.law.lose && ctx.law.lose("lost"), ctx.law.hold(99999), ctx.fuel.debug.FS.fumes.pink = 3, true)`); await t.frames(20);
      const v0 = await g(`ctx.car.speed`); await t.frames(60); const v1 = await g(`ctx.car.speed`);
      t.check("dry: no throttle — she coasts (and steers)", await g(`ctx.fuel.dry() && ctx.G.fuelDry === true`) && v1 < v0 - 1, `${v0.toFixed(1)} → ${v1.toFixed(1)}`);
      t.check("…an empty car isn't towed for a while (features/cars asks)", await g(`ctx.fuel.dryGrace("pink")`));
      await g(`(window.__auto = false, ctx.car.vx = ctx.car.vz = 0, ctx.car.vF = 0, true)`); await t.frames(30);
      // 📞 Chaverim
      t.check("📞 Chaverim has a reason: out of gas (for real)", (await g(`ctx.community.reasons("chaverim")`)).includes("fuel"));
      const c0 = await coins();
      await g(`ctx.community.call("chaverim", "fuel")`); await t.frames(4);
      await g(`(ctx.fuel.debug.dry.D.chav && (ctx.fuel.debug.dry.D.chav.at = ctx.time), true)`); await t.frames(6);
      t.check("…a splash (+15 %), free the first time today — and she's going again", Math.abs(await g(`ctx.fuel.level()`) - 0.15) < 0.01 && !await g(`ctx.fuel.dry()`) && await coins() === c0);
      await g(`(ctx.fuel.set("pink", 0), true)`);
      await g(`(ctx.fuel.debug.dry.callChaverim(), ctx.fuel.debug.dry.D.chav.at = ctx.time, true)`); await t.frames(6);
      t.check("…the second time today: 10 coins", c0 - await coins() === 10, `${c0 - await coins()}`);
      // 🛢️ the can, on foot
      await g(`(ctx.fuel.set("pink", 0), true)`);
      await g(`(() => { const P = ctx.fuel.debug.pads(-1.85)[0]; ctx.car.place(P.x, P.z, P.h); ctx.car.s = P.hs; ctx.car.d = P.hd; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`);
      await t.frames(6);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      t.check("🛢️ on foot by a pump: ✋ a can of gas", !!await g(`ctx.fuel.debug.dry.canSpot.pos()`));
      const c1 = await coins();
      await g(`(ctx.fuel.debug.dry.canSpot.act(), true)`);
      t.check("…5 coins, a can in hand → ✋ pour it in at her car", c1 - await coins() === 5 && !!await g(`ctx.fuel.debug.dry.pourSpot.pos()`));
      await g(`(ctx.fuel.debug.dry.pourSpot.act(), true)`);
      t.check("…+15 %", Math.abs(await g(`ctx.fuel.level("pink")`) - 0.15) < 0.01);
      await g(`(ctx.foot.end("test"), true)`); await t.frames(3);
      if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
      // a job starting near E
      await g(`(ctx.pins.clear(), ctx.fuel.set("pink", 0.1), true)`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("hustle:start", { id: "test" }))`); await t.frames(3);
      t.check("💼 a job starting near E: the nearest pump is pinged (she can go anyway)", /^hw:fuel:/.test(await g(`ctx.pins.current || ""`)), await g(`ctx.pins.current`));
      // a self-driving Tushla running low heads for a charger
      await g(`(ctx.pins.clear(), ctx.dealers.schlep.subscribe(), true)`);
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } }
      await t.L(`import("./js/features/garage/buy.js").then(m => m.equipSkin("tushla_nu"))`); await t.frames(6);
      await place(`ctx.car.s + 200`, 5.25, 20);
      await g(`(ctx.fuel.set("tushla_nu", 0.1), true)`);
      const eng = await g(`ctx.dealers.schlep.engage()`);
      t.check("⚡ self-driving on a low battery…", eng, JSON.stringify(await g(`({ why: ctx.dealers.schlep.debug.why, wanted: ctx.law.wanted, chasing: ctx.law.chasing, st: L3.state, sk: ctx.car.skinKey, sub: ctx.dealers.schlep.active() })`)));
      await t.frames(10);
      const pin = await g(`ctx.pins.current || ""`);
      t.check("…it pings the nearest charger and heads there", /charge|charger|hw:fuel:(rest|midwood|lakewood)/.test(pin), pin);
      await g(`(ctx.dealers.schlep.handBack("you"), true)`);
    });

    t.check("⛽ the pumps + 🔋 chargers are on the 📱 Map (help: always shown)", await g(`["hw:fuel:gng0", "hw:fuel:rest0", "hw:fuel:midwood", "hw:charge:tushla", "midwood:charger"].every(id => { const p = ctx.pins.get(id); return p && p.cat === "help"; })`));
  },
};
