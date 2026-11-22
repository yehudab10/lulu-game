// 🛍️ Shops (features/shops): the shop moved into the world.
//   • 🚗 Uncle Refael's Pre-Loved Cars stands in both towns (town data `uses.dealer`): the showroom + every car for sale on
//     the lot with a price board; ✋ at a car → the card (stats, price) → ask → buy; buying writes the SHARED save exactly
//     like the old Shop (ownedSkins + selectedSkin), can't overspend; the test drive puts her in it and gives it back
//   • 🔑 her garage at home: the cars she owns are picked in the driveway (✋ MY CARS)
//   • 🛍️ Where to shop (the Garage drawer's old 🛒 Shop) lists the places and marks one (a light + a line, no pop-up)
//   • every catalogue entry is buyable somewhere; the card fits phone portrait / landscape and a TV; the watchdog is quiet
const W = require("../lib/qawatch.js");
module.exports = {
  name: "shops",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,world,day",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", missiles: 0, pepperSpray: 0, shields: 0, distractedUnlocked: false },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    // (SHOPS_PART=home,lot,… runs only those parts — for working on one)
    const PART = process.env.SHOPS_PART || "", want = k => !PART || PART.split(",").includes(k);
    const step = async (label, fn) => { if (!want(label.split(" ")[0])) return; try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const save = () => t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    // (a debug warp into a town: the watchdog looks away while the test moves her — a declared cut, not gameplay)
    const town = async (id = "lakewood") => {
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      await W.pause(t, false);
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
      await t.frames(30); await W.pause(t, true); await W.moved(t);
      return ok;
    };
    // on foot on the sidewalk in front of a town spot (lot_<skin> / dealer)
    const onFootAt = async (name, out = 0.6) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
      // (a test's warp: the watchdog looks away while she's moved and the camera catches up)
      await W.pause(t, false);
      await g(`(() => { const sp = ctx.town.spot(${JSON.stringify(name)}); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${out}, 0.05, sp.z + sp.nz * ${out}); F.phase = "walk"; return true; })()`);
      await t.frames(2); await g(`(ctx.cam && ctx.cam.snap && ctx.cam.snap(), true)`);
      await t.frames(6); await W.pause(t, true); await W.moved(t);
    };
    const view = async (name, label, side = 8, up = 6, out = 16) => {
      await W.pause(t, false);     // (a still from across the street: the test's camera, not the game's)
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } })()`);
      await g(`(() => { const sp = ctx.town.spot(${JSON.stringify(name)}); window.__camAt = [sp.x + sp.nx * ${out} + sp.ux * ${side}, ${up}, sp.z + sp.nz * ${out} + sp.uz * ${side}, sp.cx != null ? sp.cx : sp.x, 2, sp.cz != null ? sp.cz : sp.z]; return true; })()`);
      await t.frames(4);
      await t.shot(label);
      await t.L(`window.__camAt = null`);
      await t.frames(2); await W.pause(t, true); await W.moved(t);
    };
    const promptText = () => t.L(`(() => { const e = document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);

    const cardUp = () => t.L(`!!document.querySelector("#screenCard .sp") && !document.getElementById("screen").classList.contains("hidden")`);
    const tagOf = id => t.L(`(() => { const b = document.querySelector('#screenCard .dp-opt[data-opt="${id}"] em'); return b ? b.textContent : null; })()`);
    const focusOf = () => t.L(`(() => { const b = document.querySelector("#screenCard .dp-opt.focus"); return b ? b.dataset.opt : null; })()`);
    const label = () => g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    const D = `__lulu3d.ctx.shops.debug.dealer`;      // (works in t.game and in t.until)
    await W.install(t);

    // ════ 1. the title: 🛍️ Where to shop (directions, not a store) ════
    await step("guide", async () => {
      const items = await t.titleItems();
      t.check("the Garage drawer has 🛍️ Where to shop (not a 🛒 Shop)", items.some(s => /Where to shop/.test(s)) && !items.some(s => /🛒 Shop/.test(s)), items.filter(s => /shop/i.test(s)).join(" | "));
      await t.click(/Where to shop/);
      const txt = await t.L(`document.getElementById("screenCard").textContent`);
      t.check("…lists Uncle Refael's lot with what it sells + where", /Uncle Refael/.test(txt) && /Cars/.test(txt) && /Lakewood/.test(txt) && /Midwood/.test(txt), txt.slice(0, 200));
      t.check("…and the garage at home", /garage at home/i.test(txt));
      t.check("…the makolet + Shmerel's van for the items", /makolet/i.test(txt) && /Shmerel/.test(txt) && /Pepper spray/i.test(txt) && /Missiles/.test(txt));
      t.check("…Refael's Bling Bay for horns + decorations", /Bling Bay/.test(txt) && /horns/.test(txt) && /decorations/.test(txt));
      t.check("…and no menu counter any more: everything is sold somewhere in the world", !/old shop counter/i.test(txt), txt.slice(0, 400));
      await t.click(/Uncle Refael/);
      t.check("✕ on it marks it (the destination)", await g(`ctx.shops.dest() === "dealer"`));
      t.check("…no pop-up for it (no toast)", !await t.L(`[...document.querySelectorAll(".toast")].some(e => /Refael/.test(e.textContent))`));
      await t.shot("guide");
      await t.click(/Done/);
      // the old counter no longer sells cars
      t.check("the old Shop counter has no 🚗 Cars tab", await t.L(`import("./js/features/garage/shop.js").then(m => !m.shopTabs().includes("cars"))`));
    });

    // ════ 2. home: the garage door ════
    let home = null;
    await step("home", async () => {
      await t.click(/PLAY/);
      t.check("PLAY starts on foot at home", await t.until(`__lulu3d.state === "footRun"`, "footRun", 5000));
      await t.frames(20);
      home = await g(`(() => { const a = ctx.shops.debug.garage.garageAt(); return a && { x: a.x, z: a.z }; })()`);
      t.check("her garage door is a spot", !!home);
      await W.moved(t);
      await g(`(ctx.foot.pos.set(${home.x}, 0.05, ${home.z}), ctx.foot.obj.position.copy(ctx.foot.pos), ctx.cam && ctx.cam.free && (ctx.cam.free.yaw = ctx.places.home.park.h + Math.PI), true)`); await W.moved(t);
      await t.frames(4);
      const l = await label();
      t.check("at the garage door: ✋ 🔑 MY CARS", /MY CARS/.test(l), l);
      await t.tap(0);
      await t.frames(6);
      t.check("✋ opens the garage card", await cardUp());
      t.check("…the pink car is in the driveway, the rest are at Uncle Refael's", /driveway/i.test(await tagOf("pink")) && /💰/.test(await tagOf("ninja")));
      const shot = await g(`L3.ctx.car.skinKey`);
      await t.L(`document.querySelector('#screenCard .dp-opt[data-opt="gold"]').click()`);
      await t.frames(3);
      t.check("…a car she doesn't own can't be picked (says where to get it)", await g(`ctx.car.skinKey`) === shot && /Refael/.test(await t.L(`document.querySelector("#screenCard .dp-desc").textContent`)));
      await t.shot("garage-home");
      await t.tap(1);
      await t.frames(6);
      t.check("○ closes it, back to walking", !await cardUp() && await st() === "footRun");
      // Where to shop's mark: at home it points at the next exit into a town (the guide part marks it; run alone, mark it here)
      await g(`(ctx.shops.dest() || ctx.shops.setDest("dealer"), true)`);
      const tg = await g(`ctx.shops.debug.guide.target()`);
      // (home is in Midwood now — roadmap 14: from home the mark is the lot in her own town; from the highway, an exit into town)
      t.check("the mark points the way to a car lot from home (her own town's lot, or an exit into town)", !!tg && (/exit|town/i.test(tg.label || "") || await g(`!!(ctx.town && ctx.town.active)`)), JSON.stringify(tg));
      t.check("…as one small line on the HUD", await t.until(`!!document.querySelector(".shops-dest")`, "dest chip", 3000));
    });

    // ════ 3. Lakewood: the lot ════
    const look = async (k) => {
      await onFootAt("lot_" + k);
      const l = await label();
      t.check(`✋ at the ${k} car offers it (${l})`, new RegExp(k === "purple" ? "ROYAL PURPLE" : ".", "i").test(l) && /🚗/.test(l));
      await t.tap(0);
      await t.frames(6);
      return cardUp();
    };
    await step("lot", async () => {
      if (!await town("lakewood")) return;
      const spots = await g(`(() => { const S = ctx.town.spots; return Object.keys(S).filter(k => k === "dealer" || k.startsWith("lot_")); })()`);
      t.check("Lakewood has Uncle Refael's + 7 cars on the lot", spots.includes("dealer") && spots.filter(k => k.startsWith("lot_")).length === 7, spots.join(","));
      await view("dealer", "lot-lakewood", 10, 7, 20);
      t.check("the mark is over Uncle Refael's door in town", await g(`(() => { const tg = ctx.shops.debug.guide.target(), sp = ctx.town.spot("dealer"); return !!(tg && tg.x != null && Math.hypot(tg.x - sp.x, tg.z - sp.z) < 1); })()`));
      // the ✋ is up wherever she'd naturally stand — not only on the one spot in front of a price board (the owner
      // walked up to the cars and to the man himself and found nothing to press)
      const labelAt = async (name, du, dn) => {
        await W.pause(t, false);
        await g(`(() => { const sp = ctx.town.spot(${JSON.stringify(name)}); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${dn} + sp.ux * ${du}, 0.05, sp.z + sp.nz * ${dn} + sp.uz * ${du}); F.phase = "walk"; return true; })()`);
        await t.frames(8);
        return label();
      };
      await onFootAt("lot_purple");
      const reach = { kerb: await labelAt("lot_purple", 1.2, 2.8), midWalk: await labelAt("lot_purple", -1.2, 1.5), onLot: await labelAt("lot_purple", 0.4, -4), nextCar: await labelAt("lot_orange", 0, -3) };
      t.check("✋ at a car from the kerb, the middle of the sidewalk and standing on the lot beside it", /ROYAL PURPLE/.test(reach.kerb) && /ROYAL PURPLE/.test(reach.midWalk) && /ROYAL PURPLE/.test(reach.onLot), JSON.stringify(reach));
      t.check("…and each bay is its own car's (the next one along)", /SUNSET GLOW/.test(reach.nextCar), reach.nextCar);
      const man = await g(`(() => { const o = ctx.scene.getObjectByName("UncleRefael"), sp = ctx.town.spot("dealer"); return o ? [(o.position.x - sp.x) * sp.ux + (o.position.z - sp.z) * sp.uz, (o.position.x - sp.x) * sp.nx + (o.position.z - sp.z) * sp.nz] : null; })()`);
      const byMan = man ? await labelAt("dealer", man[0], man[1] + 1.1) : "";
      t.check("✋ standing in front of the dealer himself (not only at his door)", /BROWSE/.test(byMan), JSON.stringify({ man, byMan }));
      await labelAt("lot_purple", 0.4, -4); await g(`(ctx.cam && ctx.cam.snap && ctx.cam.snap(), true)`); await t.frames(20); await t.shot("lot-standing-on-it");
      // ON the lot (open ground inside the block): the camera never goes into the showroom — whichever way she faces —
      // and the watchdog looks on (the lot isn't "inside a block")
      t.check("the lot is open ground (ctx.shops.onLot)", await g(`ctx.shops.onLot(ctx.foot.pos.x, ctx.foot.pos.z)`));
      const camIn = [];
      for (const [du, dn] of [[0.4, -4], [1.6, -5.5], [0.4, -1.4]]) for (const turn of [0, 1, 2, 3]) {
        // (the test turns her + the camera: the watchdog looks away for the turn, then watches it settle there)
        await W.pause(t, false);
        await g(`(() => { const sp = ctx.town.spot("lot_purple"), F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${dn} + sp.ux * ${du}, 0.05, sp.z + sp.nz * ${dn} + sp.uz * ${du}); F.phase = "walk";
          if (ctx.cam && ctx.cam.free) ctx.cam.free.yaw = Math.atan2(sp.ux, sp.uz) + ${turn} * Math.PI / 2; return true; })()`);
        await t.frames(12); await W.pause(t, true); await W.moved(t);
        await t.frames(20);
        const inside = await g(`(() => { const sp = ctx.town.spot("dealer"), c = ctx.camera.position, cs = Math.cos(sp.rot), sn = Math.sin(sp.rot), dx = c.x - sp.cx, dz = c.z - sp.cz;
          const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs; return Math.abs(lx) < 7.4 && Math.abs(lz) < 4.9 && c.y < 5.2; })()`);
        if (inside) camIn.push(`${du},${dn},turn${turn}`);
      }
      t.check("standing on the lot by the showroom: the camera never goes inside it", camIn.length === 0, camIn.join(" | "));
      await t.shot("lot-on-it-camera");
      // driving up to the lot: one quiet line says what to do (the ✋ needs her on her feet)
      await W.pause(t, false);
      await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 8000);
      await g(`(() => { const sp = ctx.town.spot("lot_orange"); ctx.car.place(sp.x + sp.nx * 4.2, sp.z + sp.nz * 4.2, Math.atan2(sp.ux, sp.uz)); ctx.car.vx = ctx.car.vz = 0; return true; })()`);
      await t.frames(10);
      const driveLine = await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
      t.check("in the car, stopped at the lot: one line says to get out and walk up to a car", /get out and walk up/.test(driveLine), driveLine);
      t.check("…a prompt line, not a toast", !await t.L(`[...document.querySelectorAll(".toast")].some(e => /walk up to a car/.test(e.textContent))`));
      await onFootAt("lot_purple");      // (back on the sidewalk; the watchdog looks again from here)
      // the card
      t.check("✋ opens the car card", await look("purple"));
      await t.frames(4);
      const W0 = await coins();       // (after: Ima's list may tick "say hi to Uncle Refael" as the card opens — once a day)
      t.check("…the real car stands on the lot while she looks", await g(`${D}.D.lifted && ${D}.D.lifted.k === "purple" && !!${D}.D.lifted.obj.parent`));
      t.check("…stats bars + flavour line", await t.L(`document.querySelectorAll("#screenCard .sp-bar").length === 4 && /Royalty/.test(document.querySelector("#screenCard .sp-head").textContent)`));
      t.check("…all 7 cars on the lot as tiles", await t.L(`document.querySelectorAll("#screenCard .dp-opt").length`) === 7);
      await t.shot("lot-card");
      await t.tap(15); await t.frames(4);
      t.check("D-pad → walks down the row (the next car is lifted)", await focusOf() === "orange" && await g(`${D}.D.lifted.k === "orange"`));
      await t.tap(14); await t.frames(4);
      await t.tap(0); await t.frames(3);
      t.check("first ✕ on a car for sale asks (Buy · 150 💰?) and spends nothing", /Buy/.test(await tagOf("purple")) && await coins() === W0, await tagOf("purple"));
      await t.tap(0); await t.frames(4);
      const S1 = await save();
      t.check("second ✕ buys it: −150 coins", await coins() === W0 - 150, `${W0} → ${await coins()}`);
      t.check("…the shared save is what the old Shop wrote (ownedSkins + selectedSkin)", S1.ownedSkins.includes("purple") && S1.selectedSkin === "purple" && S1.totalCoins === W0 - 150, JSON.stringify({ o: S1.ownedSkins, s: S1.selectedSkin, c: S1.totalCoins }));
      t.check("…and she drives it off the lot", await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.car.skinKey === "purple"`, "driving the new car", 8000));
      t.check("…still in town, at the kerb by the lot", await g(`(() => { const sp = ctx.town.spot("lot_purple"); return ctx.town.active && Math.hypot(ctx.car.pos.x - sp.x, ctx.car.pos.z - sp.z) < 9; })()`));
      t.check("…the mark cleared (she got there)", await g(`ctx.shops.dest() === null`));
      await t.frames(30);
    });

    // ════ 4. can't overspend · the test drive ════
    await step("lot overspend", async () => {
      if (!await town("lakewood")) return;
      await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 100; }); })`);
      await t.frames(2);
      if (!await look("gold")) { t.check("card for gold", false); return; }
      await t.tap(0); await t.frames(2); await t.tap(0); await t.frames(3);
      const S2 = await save();
      t.check("can't go below zero: 100 coins, a 1,500 car — nothing bought", await coins() === 100 && !S2.ownedSkins.includes("gold"), `${await coins()} ${S2.ownedSkins}`);
      t.check("…the card says how much more", /more/.test(await t.L(`document.querySelector("#screenCard .dp-desc").textContent`)));
      await t.tap(1); await t.frames(6);
    });
    await step("test", async () => {
      if (!await town("lakewood")) return;
      await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 2000; }); })`);
      if (!await look("red")) { t.check("card for red", false); return; }
      const W0 = await coins(), sel0 = (await save()).selectedSkin;
      t.check("…a 🔑 Test drive button for a car she doesn't own", await t.click(/Test drive/));
      t.check("the test drive puts her in it", await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.car.skinKey === "red" && ${D}.TD.on`, "test driving", 8000));
      t.check("…nothing bought, nothing paid, her saved car unchanged", await coins() === W0 && !(await save()).ownedSkins.includes("red") && (await save()).selectedSkin === sel0);
      t.check("…a countdown line on the HUD", await t.until(`!!document.querySelector(".shops-chip")`, "test chip", 3000));
      await t.shot("test-drive");
      await g(`(${D}.TD.t = ${D}.TEST.secs + 1, true)`);
      t.check("time's up: she's back on her feet at the lot", await t.until(`__lulu3d.state === "footRun" && !${D}.TD.on`, "test over", 10000));
      t.check("…the test car went back (her own car again)", await g(`ctx.car.skinKey === "purple"`));
      t.check("…her own car is at the kerb, drivable", await g(`!!(ctx.foot.debug.F.car && ctx.foot.debug.F.car.drivable && Math.hypot(ctx.foot.debug.F.car.stub.x - ctx.town.spot("lot_red").x, ctx.foot.debug.F.car.stub.z - ctx.town.spot("lot_red").z) < 16)`));
      t.check("…no coins changed hands", await coins() === W0);
      await t.frames(30);
    });

    // ════ 5. the card fits phones + a TV ════
    await step("layouts", async () => {
      if (!await town("lakewood")) return;
      if (!await look("green")) { t.check("card for green", false); return; }
      for (const [name, w, h, tv] of [["phone-portrait", 390, 844, false], ["phone-landscape", 844, 390, false], ["tv-1080", 1920, 1080, true], ["desktop", 1280, 720, false]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
        await g(`(ctx.applySettings(), true)`);
        await t.frames(4);
        const f = await t.L(`(() => { const c = document.getElementById("screenCard"), r = c.getBoundingClientRect(), opts = [...c.querySelectorAll(".dp-opt")];
          const small = opts.filter(b => { const q = b.getBoundingClientRect(); return q.width < 44 || q.height < 44; }).length;
          return { ok: r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= -1 && c.scrollWidth <= c.clientWidth + 2, top: Math.round(r.top), h: innerHeight, small, n: opts.length, scroll: c.scrollHeight > c.clientHeight + 2 }; })()`);
        t.check(`the car card fits ${name} (${w}×${h}), no scrolling`, f.ok && f.small === 0 && f.n === 7 && !f.scroll, JSON.stringify(f));
        t.check(`…and leaves the top of the screen for the car (${name})`, f.top > h * 0.3, `card top ${f.top} of ${h}`);
        await t.shot(`card-${name}`);
      }
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
      await g(`(ctx.applySettings(), true)`);
      await t.tap(1); await t.frames(6);
      t.check("○ closes the card; the real car goes back into the lot", !await cardUp() && await g(`!${D}.D.lifted`));
    });
    { const r = await W.report(t); W.log(r); W.check(t, "the lot (walking up, the card, buying, a test drive)", r); await W.reset(t); }

    // ════ 6. Midwood has the Brooklyn branch ════
    await step("midwood", async () => {
      if (!await town("midwood")) return;
      const spots = await g(`Object.keys(ctx.town.spots).filter(k => k === "dealer" || k.startsWith("lot_"))`);
      t.check("Midwood has Uncle Refael's Brooklyn lot + 7 cars", spots.includes("dealer") && spots.filter(k => k.startsWith("lot_")).length === 7, spots.join(","));
      await view("dealer", "lot-midwood", 10, 7, 20);
      t.check("✋ at a car there opens the card too", await look("ninja"));
      await t.tap(1); await t.frames(4);
    });

    // ════ 7. every catalogue car is buyable somewhere a solo player reaches ════
    await step("catalogue", async () => {
      const r = await t.L(`Promise.all([import("./js/features/garage/data.js"), import("./js/features/shops/lot.js")]).then(([d, l]) => ({ cars: d.SKIN_KEYS.filter(k => d.SKIN_SHOP[k].price > 0 && !l.LOT.includes(k)) }))`);
      t.check("every car for sale stands on Uncle Refael's lot", r.cars.length === 0, JSON.stringify(r));
    });

    // ════ 7b. the makolet + Shmerel's van (items) ════
    const C = `__lulu3d.ctx.shops.debug.counter`;
    const atCounter = async (id) => {
      if (await st() !== "footRun") { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000); }
      // (a test's warp — unwatched while the camera catches up; Shmerel's van spawns as she comes near: from 12 m first)
      const warp = async (k) => {
        await W.pause(t, false);
        await g(`(() => { const f = ${C}.COUNTERS[${JSON.stringify(id)}].frame(); const F = ctx.foot.debug.F; F.pos.set(f.me.x + f.n[0] * ${k}, 0.05, f.me.z + f.n[1] * ${k}); F.phase = "walk"; return true; })()`);
        await t.frames(2); await g(`(ctx.cam && ctx.cam.snap && ctx.cam.snap(), true)`);
        await t.frames(6); await W.pause(t, true); await W.moved(t);
      };
      await warp(12);
      await t.until(`!!${C}.K[${JSON.stringify(id)}]`, `${id}: the keeper is there`, 20000);
      await warp(0);
    };
    const items = async (townId) => {
      if (!await town(townId)) return;
      t.check(`${townId}: the makolet stands in town (town data)`, await g(`!!ctx.town.spot("makolet")`));
      await atCounter("makolet");
      const l1 = await label();
      t.check(`${townId}: ✋ at the makolet door (${l1})`, /MAKOLET/.test(l1));
      await t.tap(0); await t.frames(6);
      t.check(`${townId}: ✋ opens the makolet's card (pepper spray · bubble wrap · the phone plan)`, await cardUp() && await t.L(`[...document.querySelectorAll("#screenCard .dp-opt")].map(b => b.dataset.opt).join()`) === "pepper,shield,distracted");
      const W0 = await coins(), P0 = (await save()).pepperSpray | 0;
      await t.tap(0); await t.frames(2);
      t.check(`${townId}: first ✕ asks, nothing spent`, await coins() === W0 && /Buy/.test(await tagOf("pepper")));
      await t.tap(0); await t.frames(4);
      const S1 = await save();
      t.check(`${townId}: second ✕ buys a pepper spray: −15, pepperSpray +1 (the shared save, like the old Shop)`, await coins() === W0 - 15 && (S1.pepperSpray | 0) === P0 + 1, `${W0}→${await coins()} ${P0}→${S1.pepperSpray}`);
      t.check(`${townId}: …the item turns on its stand by the door`, await t.until(`!!${C}.S.item`, "item on the stand", 15000));
      await t.shot(`makolet-${townId}`);
      await t.tap(1); await t.frames(6);
      t.check(`${townId}: ○ closes it, the stand is put away`, !await cardUp() && await g(`!${C}.S.stand`));
      // the van
      t.check(`${townId}: Shmerel's van has a place by the kerb`, await g(`!!${C}.vanSpot()`));
      await atCounter("black");
      t.check(`${townId}: the van is there (only while she's near)`, await g(`!!(${C}.K.black && ${C}.K.black.van && ${C}.K.black.van.parent)`));
      const l2 = await label();
      t.check(`${townId}: ✋ at the van (${l2})`, /SHMEREL/.test(l2));
      await t.tap(0); await t.frames(6);
      t.check(`${townId}: the van's card: missile · Mega 5-Pack · pepper spray`, await cardUp() && await t.L(`[...document.querySelectorAll("#screenCard .dp-opt")].map(b => b.dataset.opt).join()`) === "missile,megapack,pepper");
      const W1 = await coins(), M0 = (await save()).missiles | 0;
      await t.tap(15); await t.frames(3);
      await t.tap(0); await t.frames(2); await t.tap(0); await t.frames(4);
      t.check(`${townId}: the Mega 5-Pack: −80, missiles +5`, await coins() === W1 - 80 && ((await save()).missiles | 0) === M0 + 5, `${W1}→${await coins()} ${M0}→${(await save()).missiles}`);
      await t.shot(`van-${townId}`);
      await t.tap(1); await t.frames(6);
    };
    await step("items", async () => {
      await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 3000; }); })`);
      await items("lakewood");
      // Distracted Mode (1,000) at the makolet: unlocks for good
      await atCounter("makolet");
      await t.tap(0); await t.frames(6);
      await t.L(`document.querySelector('#screenCard .dp-opt[data-opt="distracted"]').click()`); await t.frames(2);
      await t.L(`document.querySelector('#screenCard .dp-opt[data-opt="distracted"]').click()`); await t.frames(4);
      t.check("Distracted Mode (the phone plan) unlocks: distractedUnlocked, −1,000", (await save()).distractedUnlocked === true);
      t.check("…and then it's ✓ Yours (can't buy it twice)", /Yours/.test(await tagOf("distracted")));
      await t.tap(1); await t.frames(6);
      await items("midwood");
      { const r = await W.report(t); W.log(r); W.check(t, "the makolet + the van", r); await W.reset(t); }
      const r = await t.L(`Promise.all([import("./js/features/garage/data.js"), import("./js/features/shops/data.js"), import("./js/features/garage/shop.js")]).then(([d, sd, sh]) => ({
        missing: d.ITEMS.map(i => i.id).filter(id => !sd.MAKOLET.stock.includes(id) && !sd.BLACK.stock.includes(id)), tabs: sh.shopTabs() }))`);
      t.check("every item in the catalogue is sold at the makolet or Shmerel's van", r.missing.length === 0, JSON.stringify(r));
      t.check("…and the old counter no longer sells items", !r.tabs.includes("items"), JSON.stringify(r.tabs));
    });

    // ════ 7c. ✨ the Bling Bay (horns + decorations) at Uncle Refael's ════
    await step("bling", async () => {
      if (!await town("lakewood")) return;
      await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 3000; }); })`);
      t.check("the Bling Bay's door stands on the showroom (town data, spot \"bling\")", await g(`!!ctx.town.spot("bling")`));
      await onFootAt("bling");
      const l = await label();
      t.check(`✋ at the Bling Bay (${l})`, /BLING/.test(l));
      await t.tap(0); await t.frames(8);
      const ids = await t.L(`[...document.querySelectorAll("#screenCard .dp-opt")].map(b => b.dataset.opt)`);
      t.check("its card: all 6 horns + all 7 decorations", ids.filter(i => i.startsWith("horn:")).length === 6 && ids.filter(i => i.startsWith("decor:")).length === 7, ids.join());
      t.check("…a copy of HER car pulled up at the kerb", await g(`!!(ctx.shops.debug.bling.B.car && ctx.shops.debug.bling.B.car.parent)`));
      // (13 tiles: the busiest card — it must fit a phone without scrolling, both ways)
      for (const [name, w, h] of [["phone-portrait", 390, 844], ["phone-landscape", 844, 390]]) {
        await t.page.setViewportSize({ width: w, height: h }); await t.frames(6);
        const f = await t.L(`(() => { const c = document.getElementById("screenCard"), r = c.getBoundingClientRect(); return { ok: r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1, scroll: c.scrollHeight > c.clientHeight + 2, top: Math.round(r.top) }; })()`);
        t.check(`the Bling Bay card (13 tiles) fits ${name} without scrolling`, f.ok && !f.scroll, JSON.stringify(f));
        await t.shot("bling-" + name);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 }); await t.frames(6);
      const click = id => t.L(`(document.querySelector('#screenCard .dp-opt[data-opt="${id}"]').click(), true)`);
      const W0 = await coins();
      await click("decor:crown"); await t.frames(3);
      t.check("focusing a decoration fits it on the car in front of her", await t.until(`__lulu3d.ctx.shops.debug.bling.B.decorId === "crown" && !!__lulu3d.ctx.shops.debug.bling.B.decor`, "crown on", 15000));
      t.check("…the first tap asks (nothing spent)", await coins() === W0 && /Buy/.test(await tagOf("decor:crown")));
      await click("decor:crown"); await t.frames(4);
      let S = await save();
      t.check("…the second buys it: −450, ownedDecor + decor (the shared save, like the old Shop)", await coins() === W0 - 450 && S.ownedDecor.includes("crown") && S.decor === "crown", JSON.stringify({ c: await coins(), o: S.ownedDecor, d: S.decor }));
      t.check("…her real car wears it", await g(`ctx.garage.items().decor === "crown"`));
      await t.shot("bling-crown");
      await click("horn:duck"); await t.frames(2); await click("horn:duck"); await t.frames(4);
      S = await save();
      t.check("a horn: −120, ownedHorns + horn", await coins() === W0 - 570 && S.ownedHorns.includes("duck") && S.horn === "duck", JSON.stringify({ c: await coins(), o: S.ownedHorns, h: S.horn }));
      await click("horn:beep"); await t.frames(4);
      t.check("…a horn she owns goes back on for free", (await save()).horn === "beep" && await coins() === W0 - 570);
      await click("decor:crown"); await t.frames(4);
      t.check("…a decoration she owns comes off for free", (await save()).decor === "none" && await coins() === W0 - 570);
      await t.tap(1); await t.frames(6);
      t.check("○ closes it; the display car drives off", !await cardUp() && await g(`!ctx.shops.debug.bling.B.car`));
      const r = await t.L(`import("./js/features/garage/shop.js").then(m => m.shopTabs())`);
      t.check("the old Shop counter is empty now (every tab moved into the world)", r.length === 0, JSON.stringify(r));
    });

    // ════ 7d. 🍕 walk-in shops: the pizza shop (both towns) + Midwood's bakery ════
    const room = (id) => `window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === ${JSON.stringify(id)}`;
    const walkIn = async (spotName, id, re) => {
      await onFootAt(spotName, 0.3);
      const l = await label();
      t.check(`✋ at the ${spotName} door (${l})`, re.test(l));
      await W.pause(t, false);      // (the soft cut into a room: a set, not the street)
      await t.tap(0);
      const ok = await t.until(`__lulu3d.state === "interior" && ${room(id)}`, `inside ${id}`, 60000);
      await t.frames(10); await W.pause(t, true); await W.moved(t);
      return ok;
    };
    const snackAt = async (name, price) => {
      await g(`(ctx.G.hearts = 1, ctx.G.shopsSnack = false, true)`);
      const W0 = await coins(), h0 = await g(`ctx.G.hearts`);
      await g(`(() => { const rt = __interiors.room, h = rt.hots.find(x => x.id === "counter"); h.action(rt, h); return true; })()`);
      await t.frames(4);
      t.check(`${name}: buying it costs ${price} and heals one heart`, await coins() === W0 - price && await g(`ctx.G.hearts`) === h0 + 1, `${W0}→${await coins()} ❤️ ${h0}→${await g(`ctx.G.hearts`)}`);
      await g(`(() => { const rt = __interiors.room, h = rt.hots.find(x => x.id === "counter"); h.action(rt, h); return true; })()`);
      await t.frames(4);
      t.check(`${name}: …only once a run (the second: "you're full", no charge, no heart)`, await coins() === W0 - price && await g(`ctx.G.hearts`) === h0 + 1);
    };
    const walkOut = async (spotName) => {
      await W.pause(t, false);
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, `out of the ${spotName}`, 30000);
      await t.frames(10); await W.pause(t, true); await W.moved(t);
      const d = await g(`(() => { const sp = ctx.town.spot(${JSON.stringify(spotName)}), p = ctx.foot.pos; return +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1); })()`);
      t.check(`…she walks out of the ${spotName}'s own door (${d} m), still in town`, d < 7 && await g(`ctx.town.active`));
    };
    await step("rooms", async () => {
      await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 500; }); })`);
      if (!await town("lakewood")) return;
      t.check("Lakewood: the pizza shop is a walk-in room (soft cut in)", await walkIn("pizza", "shopsPizza", /PIZZA SHMIZZA/));
      t.check("…a counter, a line, someone at a table", await g(`["server", "line0", "line1", "eater"].every(id => !!__interiors.room.byId[id])`));
      await t.shot("pizza-lakewood");
      await snackAt("a slice", 6);
      t.check("the pizza shop is a shared room with friends (together SHARED)", await t.L(`import("./js/features/together/rooms.js").then(m => !!m.SHARED.shopsPizza && !!m.SHARED.shopsBakery)`));
      await walkOut("pizza");
      if (!await town("midwood")) return;
      t.check("Midwood: SLICE OF SINAI is walk-in too", await walkIn("pizza", "shopsPizza", /SLICE OF SINAI/));
      await walkOut("pizza");
      t.check("Midwood: the CHALLAH-DAY INN bakery is walk-in", await walkIn("bakery", "shopsBakery", /CHALLAH/));
      await t.shot("bakery-midwood");
      await g(`(ctx.G.shopsSnack = true, true)`);
      const W0 = await coins();
      await g(`(() => { const rt = __interiors.room, h = rt.hots.find(x => x.id === "counter"); h.action(rt, h); return true; })()`);
      t.check("…the snack cap is across every shop (had a slice: no rugelach this run)", await coins() === W0);
      await walkOut("bakery");
      { const r = await W.report(t); W.log(r); W.check(t, "walk-in shops", r); await W.reset(t); }
    });

    // ════ 8. home again: the cars she owns wait in her garage ════
    await step("swap", async () => {
      await W.pause(t, false);     // (the test takes her home through the title: not gameplay)
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); }
      await g(`(L3.setState("title"), true)`);
      await t.frames(20);
      await t.click(/PLAY/);
      await t.until(`__lulu3d.state === "footRun"`, "footRun", 5000);
      await t.frames(10);
      await W.pause(t, true); await W.moved(t);
      const a = await g(`ctx.shops.debug.garage.garageAt()`);
      await W.moved(t);
      await g(`(ctx.foot.pos.set(${a.x}, 0.05, ${a.z}), ctx.foot.obj.position.copy(ctx.foot.pos), ctx.cam && ctx.cam.free && (ctx.cam.free.yaw = ctx.places.home.park.h + Math.PI), true)`); await W.moved(t);
      await t.frames(4);
      t.check("the garage counts her cars (🔑 MY CARS (2))", /MY CARS \(2\)/.test(await label()), await label());
      t.check("…the purple one is in the driveway (she drove it last)", await g(`ctx.car.skinKey === "purple"`));
      await t.tap(0); await t.frames(6);
      await t.L(`document.querySelector('#screenCard .dp-opt[data-opt="pink"]').click()`);
      await t.frames(4);
      t.check("picking the pink one: it's the car in the driveway now", await g(`ctx.car.skinKey === "pink"`) && (await save()).selectedSkin === "pink");
      t.check("…the parked car is repainted on the spot", await g(`(() => { let c = null; ctx.foot.debug.F.car.stub.obj.traverse(o => { if (o.isMesh && o.material.name === "Body") c = "#" + o.material.color.getHexString(); }); return c; })()`) === "#e91e63");
      await t.tap(1); await t.frames(6);
    });
    { const r = await W.report(t); W.log(r); W.check(t, "home + Midwood", r); }
  },
};
