// Street mayhem (features/streets + the law tuning it leans on):
//   • the chase lab: a getaway-driver bot ESCAPES at 1★ and 2★ within a time budget on
//     several seeds, a driver who just stops gets BUSTED, and 3★ throws up a roadblock;
//   • the GTA star row: lit stars, they FLASH while the cops search, "losing them…", escape;
//   • a roadblock + spike strip: flat tyres (wobble, no nitro), cops dive clear;
//   • 🎨 Paint & Pray clears the heat (once watched, once ⏭ skipped);
//   • carjack a sedan on foot (one animation → she drives THAT model, the driver reacts),
//     jack a box truck (heavy handling, camera pulled back), 🤸 bail out (dive + roll, the
//     car coasts on), smash street props (debris settles and is recycled; a cop sees →
//     wanted), the hydrant geyser; the touch ✋ BAIL button; screenshots at TV / phone layouts.
module.exports = {
  name: "streets",
  query: "&enable=streets,law,foot",
  save2d: { totalCoins: 3000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const st = () => g(`ctx.state`);
    const coins = () => t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`);
    const place = (ds, d, v = 0) => g(`(() => { const r = ctx.world.road, s = ctx.car.s + ${ds}, p = r.point(s, ${d}, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; return s; })()`);
    const D = `ctx.law._dbg`;

    t.check("ctx.streets service is registered", await g(`!!(ctx.streets && ctx.streets.carjack && ctx.streets.bail && ctx.streets.roadblock && ctx.streets.paint && ctx.streets.smashNear)`));
    t.check("party module loads (streets are ON in a party — partyplus tests it)", await t.L(`import("./js/features/party/index.js").then(() => true)`));
    t.check("the button guide has carjack + bail out", await t.L(`import("./js/core/screens.js").then(m => /carjack/.test(m.controlsHtml()) && /Bail out/.test(m.controlsHtml()))`));
    // who's jackable in a TOWN: solo, the town's own drivers (lane AI + streetsHold) like any highway car; in a 🎉 party
    // the shared Free Roam loop cars (data.party + owTown) never, a party-local town car still yes
    const rules = await t.L(`import("./js/features/streets/jack.js").then(m => { const ai = () => {};
        const town = (kind, extra = {}) => m.jackable({ kind, speed: 0, ai, free: false, hit: false, data: Object.assign({ town: {}, streetsHold: true }, extra) });
        return { van: town("town_van"), bus: town("town_bus"), citybus: town("town_citybus"), sweeper: town("town_sweeper"), carsvc: town("town_carsvc"),
          moving: m.jackable({ kind: "town_van", speed: 9, ai, free: false, data: { town: {}, streetsHold: true } }),
          turning: m.jackable({ kind: "town_van", speed: 0, ai, free: true, data: { town: {}, streetsHold: true } }),
          loop: m.jackable({ kind: "town_van", speed: 7, ai, free: true, data: { party: "tw:1:0", owTown: true } }),
          local: town("town_van", { partyLocal: true }) }; })`);
    t.check("solo town traffic is jackable (minivans, school + city bus, sweeper, car service) once it's stopped", rules.van && rules.bus && rules.citybus && rules.sweeper && rules.carsvc && !rules.moving && !rules.turning, JSON.stringify(rules));
    t.check("…a party's shared Free Roam loop car isn't; a party-local town car is", !rules.loop && rules.local, JSON.stringify(rules));

    // ── 1. the chase lab (headless sims: seeded traffic + law, a getaway bot) ──
    await t.until(`__lulu3d.ctx.streets.debug.PROPS.ready && !!__lulu3d.ctx.streets.debug.models.streets_spikes`, "the street kit (props, barricades, spikes) loads", 60000);

    const budget = { 1: 45, 2: 60 };
    for (const stars of [1, 2]) {
      const runs = [];
      // (the bot sometimes plows into traffic like a person would: judge the rate over several seeds)
      for (const seed of [1, 2, 3, 4, 5]) runs.push(await g(`ctx.streets.debug.sim({ stars: ${stars}, seed: ${seed}, maxT: 90, gap: 25 })`));
      const ok = runs.filter(r => r.outcome === "escaped" && r.t <= budget[stars]);
      t.check(`lab: the bot escapes ${stars}★ within ${budget[stars]} s (≥ 4 of 5 seeds)`, ok.length >= 4, runs.map(r => `${r.outcome}@${r.t}s`).join(" "));

      t.check(`lab: ${stars}★ cops never out-run her (cop top ≤ Lulu's)`, runs.every(r => r.copTop <= r.luluTop + 0.5), runs.map(r => `${r.copTop}/${r.luluTop}`).join(" "));
    }
    const stop = await g(`ctx.streets.debug.sim({ stars: 1, seed: 4, maxT: 40, bot: "stop" })`);
    t.check("lab: a driver who just stops gets caught", stop.outcome === "busted" || stop.outcome === "arrested", `${stop.outcome}@${stop.t}s`);
    const hot = await g(`ctx.streets.debug.sim({ stars: 3, seed: 2, maxT: 75, gap: 25, tactics: false })`);

    t.check("lab: 3★ produces a roadblock", hot.roadblocks >= 1, JSON.stringify({ outcome: hot.outcome, t: hot.t, roadblocks: hot.roadblocks }));
    await g(`L3.setState("title")`);
    await t.frames(4);

    // ── 2. the star row: pursuit → SEARCHING (flashing) → escape ──
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await place(0, 1.75, 20);
    await g(`ctx.law.startChase("RECKLESS DRIVING", { heat: 2 })`);
    await t.frames(12);
    t.check("the star row shows 2 lit stars of 5", await t.L(`document.querySelectorAll(".law-wanted .stars b.on").length === 2 && document.querySelectorAll(".law-wanted .stars b").length === 5`));
    t.check("in sight: PURSUIT, stars steady", await t.L(`!document.querySelector(".law-wanted .stars.search") && /PURSUIT/.test(document.querySelector(".law-wanted").textContent)`));
    await t.shot("stars-pursuit");
    // break line of sight: every cruiser is suddenly far behind
    await g(`${D}.L.units.forEach(u => { if (u.car) { u.car.x -= Math.sin(u.car.h) * 260; u.car.z -= Math.cos(u.car.h) * 260; u.car.s -= 260; u.car.speed = 0; } })`);
    await t.until(`__lulu3d.ctx.law.searching`, "out of sight → the cops SEARCH", 20000);
    await t.frames(30);
    t.check("searching: the stars flash", await t.L(`!!document.querySelector(".law-wanted .stars.search")`));
    t.check("searching: tag + 'losing them…' meter", await t.L(`/SEARCHING/.test(document.querySelector(".law-wanted").textContent) && /LOSING THEM/.test(document.querySelector(".law-wanted").textContent)`));
    await t.shot("stars-searching");
    await t.until(`!__lulu3d.ctx.law.chasing`, "stay hidden → escaped", 30000);
    t.check("escaped (cop:chase result 'escaped')", await g(`${D}.log.some(e => e.ev === "cop:chase" && e.result === "escaped")`));

    // ── 3. a roadblock with a spike strip ──
    await g(`(${D}.L.grace = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 3 }))`);
    await place(0, 1.75, 0);
    await g(`ctx.streets.debug.loadProps()`);
    await t.until(`__lulu3d.ctx.streets.debug.PROPS.ready`, "props / barricade models load", 30000);
    t.check("a roadblock goes up", await g(`!!ctx.streets.roadblock(70, { gap: 1.75 })`));
    t.check("…cruisers across the other lanes, cops, a spike strip in the gap", await g(`(() => { const b = ctx.streets.debug.HEAT.blocks[0]; return b.units.length === 3 && b.spikes && Math.abs(b.spikes.d - 1.75) < 0.1; })()`));
    await place(28, 1.75, 0);
    await t.frames(8);
    await t.shot("roadblock");
    await place(0, 1.75, 22);
    await t.hold(7, 1);
    await t.until(`__lulu3d.ctx.streets.flat`, "driving over the spikes shreds the tyres", 20000);
    t.check("flat tyres: no nitro", await g(`ctx.G.noBoost === true`));
    await t.frames(6);
    await t.shot("spiked");
    await t.hold(7, 0);
    t.check("a cop at the roadblock dove for cover (nobody gets run over)", await g(`ctx.streets.debug.HEAT.blocks.some(b => b.cops.some(c => c.dive || c.p.obj.rotation.x > 0.3))`));

    // ── 4. Paint & Pray: watched ──
    await g(`${D}.L.units.forEach(u => { if (u.car) { u.car.x -= Math.sin(u.car.h) * 220; u.car.z -= Math.cos(u.car.h) * 220; u.car.s -= 220; u.car.speed = 0; } })`);
    const c0 = await coins();
    const gar = await g(`(() => { const gg = ctx.streets.debug.garageAhead(70); window.__gar = gg; return !!gg.built; })()`);
    t.check("a Paint & Pray booth is built", gar);
    await g(`(() => { const r = ctx.world.road, s = window.__gar.s - 21, p = r.point(s, 10.2, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * 7; ctx.car.vz = Math.cos(p.h) * 7; })()`);
    if (await t.until(`__lulu3d.state === "streetsPaint"`, "rolling onto the apron starts the drive-through", 20000)) {
      await t.frames(40);
      await t.shot("paint-in");
      await t.until(`__lulu3d.ctx.streets.debug.PAINT.jobs >= 1`, "the doors close and the spray starts", 40000);
      await t.frames(20);
      await t.shot("paint-spray");
      await t.until(`__lulu3d.state === "playing"`, "she rolls out the far end", 40000);
      await t.frames(4);
      await t.shot("paint-out");
      t.check("Paint & Pray: the heat's gone", await g(`!ctx.law.chasing && !ctx.law.fugitive`));
      t.check("…new colour on the car", await g(`!!ctx.streets.paint.color`));
      t.check("…the tyres are fixed", await g(`!ctx.streets.flat && !ctx.G.noBoost`));
      t.check("…and it cost coins", (await coins()) < c0, `${c0} → ${await coins()}`);
    }
    // ── 4b. Paint & Pray, ⏭ skipped ──
    await g(`(${D}.L.grace = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 2 }))`);
    await g(`(() => { const gg = ctx.streets.debug.garageAhead(90); window.__gar = gg; const r = ctx.world.road, s = gg.s - 21, p = r.point(s, 10.2, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * 7; ctx.car.vz = Math.cos(p.h) * 7; })()`);
    if (await t.until(`__lulu3d.state === "streetsPaint"`, "second booth: the drive-through starts", 20000)) {
      await t.frames(6);
      t.check("the cutscene offers ⏭ SKIP", await t.L(`document.getElementById("skipBtn").classList.contains("show")`));
      await t.hold(1, 1); await t.frames(30); await t.hold(1, 0);
      await t.until(`__lulu3d.state === "playing"`, "⏭ skip lands back on the road", 60000);
      t.check("skipped Paint & Pray still clears the heat + repaints", await g(`!ctx.law.chasing && ctx.streets.debug.PAINT.jobs >= 2`));
    }

    // ── 5. carjack a sedan on foot ──
    await g(`(ctx.traffic.clear(), ctx.law.hold(60), true)`);
    await g(`ctx.foot.start("droveOff")`);
    if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot")) return;
    await g(`(() => { const F = ctx.foot.debug.F; const c = ctx.traffic.add("sedan", F.s + 9, 5.25, 1, 0); c.want = 0; c.base = 0; window.__victim = c;
      const p = ctx.world.road.point(c.s + 0.1, 5.25 - 1.6, {}); F.pos.set(p.x, 0, p.z); return true; })()`);
    await t.frames(5);
    t.check("next to a stopped car: ✕ CARJACK", await t.L(`/CARJACK/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
    await t.shot("carjack-prompt");
    // (this driver phones it in — the one witness: a call-in later, not a chase now)
    await g(`(ctx.streets.force.reaction = "call", true)`);
    await t.tap(0);
    t.check("✕ starts the jack", await g(`ctx.streets.jacking`));
    await t.frames(24);
    await t.shot("carjack-yank");
    if (await t.until(`__lulu3d.state === "playing"`, "…and she drives off in it", 30000)) {
      t.check("she's driving THAT sedan (shell), handling set", await g(`ctx.foot.vehicle && ctx.foot.vehicle.kind === "sedan" && ctx.streets.ride && ctx.streets.ride.kind === "sedan" && Math.abs(ctx.car.stats.acc - 0.95) < 1e-6`));
      t.check("ONE animation: no foot session, no hop-out left over", await g(`!ctx.foot.active && !ctx.streets.jacking`));
      t.check("the driver is out on the road (dizzy, then angry)", await g(`(() => { const r = ctx.streets.debug.J.lastRide; return !!(r && r.victim && ["down", "up", "react"].includes(r.victim.phase)); })()`));
      t.check("carjack emits the event + stat", await g(`ctx.streets.debug.J.jacks === 1`));
      t.check("no cop saw the carjack → no chase", await g(`!ctx.law.chasing`));
      await t.frames(30);
      await t.shot("carjack-driver-angry");
      // drive off
      await t.hold(7, 1); await t.frames(25); await t.hold(7, 0);
      t.check("the jacked sedan drives", await g(`ctx.car.speed > 4`));
      // the driver gets on the phone: a call-in (📞 REPORTED) — a cruiser will come LOOKING, nobody's on her tail yet
      await t.until(`__lulu3d.ctx.law.reported`, "the yanked driver calls it in", 30000);
      t.check("a driver's call = a call-in (REPORTED), not an instant chase", await g(`ctx.law.reported && !ctx.law.chasing`));
      t.check("the HUD says 📞 REPORTED", await t.L(`/REPORTED|LOOKING/.test((document.querySelector(".law-wanted") || {}).textContent || "")`));
      await t.shot("carjack-reported");
    }
    await g(`(delete ctx.streets.force.reaction, true)`);

    // ── 6. bail out (hold △ / Y while moving) ──
    await place(30, 5.25, 24);
    await t.hold(7, 1);
    await t.hold(3, 1); await t.frames(18); await t.hold(3, 0);
    await t.hold(7, 0);
    if (await t.until(`__lulu3d.state === "footRun"`, "hold △ at speed: she bails out", 20000)) {
      t.check("bail: the dive is a foot 'script' (no foot hop intro)", await g(`ctx.foot.phase === "script"`));
      t.check("ditching the reported car calls off the search", await g(`!ctx.law.reported`));
      const s0 = await g(`ctx.foot.debug.F.car.stub.s`);
      await t.frames(8);
      await t.shot("bail-dive");
      await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "she rolls and gets up", 30000);
      const s1 = await g(`ctx.foot.debug.F.car.stub.s`);
      t.check("the abandoned car coasted on without her", s1 - s0 > 8, `${(s1 - s0).toFixed(1)} m`);
      t.check("the camera came back to her (one dive, no extra anim)", await g(`ctx.foot.phase === "walk" && ctx.foot.obj.visible`));
      await t.shot("bail-up");
    }

    // ── 5b. jack a box truck: heavy handling, camera pulled back ──
    await g(`(() => { const F = ctx.foot.debug.F; ctx.traffic.cars.filter(c => !c.data.footStub).forEach(c => ctx.traffic.remove(c));
      const c = ctx.traffic.add("truck", F.s + 12, 1.75, 1, 0); c.want = 0; c.base = 0;
      const p = ctx.world.road.point(c.s + 2.6, 1.75 - 1.8, {}); F.pos.set(p.x, 0, p.z); window.__truck = c; return true; })()`);
    await t.frames(3);
    t.check("ctx.streets.carjack() jacks the truck", await g(`ctx.streets.carjack(window.__truck)`));
    if (await t.until(`__lulu3d.state === "playing"`, "she drives off in the box truck", 30000)) {
      t.check("the truck is slow + heavy (top 0.72, acc 0.55)", await g(`ctx.foot.vehicle.kind === "truck" && Math.abs(ctx.car.stats.top - 0.72) < 1e-6 && Math.abs(ctx.car.stats.acc - 0.55) < 1e-6`));
      await t.frames(6);
      t.check("the chase cam pulls back for the big truck", await t.L(`import("./js/core/camera.js").then(m => m.CAMS[0].dist > 9)`));
      await t.shot("truck");
    }

    // ── 7. smash props: debris settles + recycles, a cop sees it, the hydrant geyser ──
    await g(`L3.startRun({ mode: "cruise" })`);
    await t.until(`__lulu3d.state === "playing"`, "a fresh run");
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(60), true)`);
    t.check("camera back to normal after the truck", await t.L(`import("./js/core/camera.js").then(m => m.CAMS[0].dist < 8)`));
    t.check("a fresh run: damage tally reset", await g(`ctx.streets.damage === 0`));
    await place(0, 1.75, 15);
    await g(`(() => { const r = ctx.world.road, p = r.point(ctx.car.s + 12, 1.75, {}); window.__mb = ctx.streets.debug.addLooseProp("mailbox", p.x, p.z, p.h + Math.PI);
      const q = r.point(ctx.car.s + 16, 1.0, {}); window.__fs = ctx.streets.debug.addLooseProp("fruitstand", q.x, q.z, q.h + Math.PI); return !!window.__mb && !!window.__fs; })()`);
    await t.hold(7, 1);
    await t.until(`__lulu3d.ctx.streets.damage > 0`, "driving through a mailbox smashes it", 20000);
    await t.frames(10);
    await t.hold(7, 0);
    t.check("smash: damage $ tally + debris", await g(`ctx.streets.damage >= 120 && ctx.streets.debug.debrisCount() > 5`), `${await g(`ctx.streets.damage`)} $, ${await g(`ctx.streets.debug.debrisCount()`)} bits`);
    t.check("the damage chip is a hud-secondary", await t.L(`!!document.querySelector("#slot-left .streets-dmg.hud-secondary")`));
    await t.shot("smash");
    await t.frames(270);
    t.check("debris settles, fades and is recycled", await g(`ctx.streets.debug.debrisCount() === 0`), `${await g(`ctx.streets.debug.debrisCount()`)} left`);
    // the hydrant: a geyser that bounces the car
    await place(0, 1.75, 14);
    await g(`(() => { const r = ctx.world.road, p = r.point(ctx.car.s + 10, 1.75, {}); window.__hy = ctx.streets.debug.addLooseProp("hydrant", p.x, p.z, p.h); return true; })()`);
    await t.until(`__lulu3d.ctx.streets.debug.geysersOn() > 0`, "hitting a hydrant starts a geyser", 20000);
    await t.frames(12);
    await t.shot("geyser");
    // a cop who sees a smash gives chase
    await g(`(${D}.L.grace = 0, ${D}.L.hold = 0, true)`);
    await place(0, 5.25, 14);
    await g(`(() => { ${D}.spawnTrap(30, 1); const r = ctx.world.road, p = r.point(ctx.car.s + 10, 5.25, {}); ctx.streets.debug.addLooseProp("trashcan", p.x, p.z, p.h); return true; })()`);
    await t.until(`__lulu3d.ctx.law.chasing`, "smashing in front of a cop → wanted", 20000);
    t.check("vandalism in view of a cop → a chase", await g(`ctx.law.chasing`));
    // 🔧 Shmuel's Chop Shop: an order comes in on the phone
    const job = await g(`(() => { const w = ctx.streets.chop.request({ instant: true, kind: "van", hex: "#42A5F5" }); return w && w.text; })()`);
    t.check("🔧 Shmuel calls with an order", /blue minivan/.test(job || ""), String(job));
    await t.frames(4);
    t.check("…on the in-car phone card, and the job is on", await t.L(`/Shmuel/.test((document.querySelector(".jphone") || {}).textContent || "")`) && await g(`!!ctx.streets.chop.job`));
    await g(`(ctx.phone.hangUp(true), true)`);


    // ── 8. layouts: the star row + touch ✋ BAIL at TV / phone sizes ──
    const overlaps = () => t.L(`(() => {
      const groups = { pills: ".hud-tl .pill", trip: ".hud-top", pause: "#pauseBtn", speedo: ".hud-br .speedo", stick: "#stickBase",
        pedals: ".pedals .tbtn", extra: "#touchExtra button", stars: "#slot-right .law-wanted > *, #objLine .law-wanted > *", dmg: "#slot-left .streets-dmg" };
      const boxes = [];
      for (const [g, sel] of Object.entries(groups)) for (const e of document.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).opacity !== "0") boxes.push({ g, r, n: (e.id || e.textContent || "").trim().slice(0, 12) });
      }
      const out = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.g === b.g) continue;
        if (![a.g, b.g].some(x => x === "stars" || x === "dmg" || x === "extra")) continue;   // core HUD vs core HUD is the ux test's job
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 2 && oy > 2) out.push(a.g + ":" + a.n + " × " + b.g + ":" + b.n);
      }
      const s = document.querySelector(".law-wanted .stars"), sr = s && s.getBoundingClientRect();
      return { out, inside: !!sr && sr.left >= 0 && sr.right <= innerWidth && sr.top >= 0 };
    })()`);
    await place(0, 1.75, 18);
    await g(`ctx.streets.roadblock(110, { gap: 1.75, spikes: false })`);

    for (const [name, w, h, tv, touch] of [["tv-1080", 1920, 1080, true, false], ["tv-720", 1280, 720, true, false], ["desktop", 1280, 720, false, false], ["phone-landscape", 844, 390, false, true], ["phone-portrait", 390, 844, false, true]]) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
      if (touch) await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
      await g(`(ctx.applySettings(), true)`);
      await t.frames(6);
      const o = await overlaps();
      t.check(`${name}: stars on screen, nothing overlaps`, o.inside && o.out.length === 0, JSON.stringify(o));
      if (touch) t.check(`${name}: the ✋ BAIL touch button shows while wanted`, await t.L(`(() => { const b = document.getElementById("tx_streets_bail"); return !!b && b.style.display !== "none" && b.getBoundingClientRect().width > 30; })()`));
      await t.shot(`layout-${name}`);
    }
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
    await g(`(ctx.applySettings(), true)`);
    if (await t.L(`!!document.getElementById("tx_streets_bail")`)) {
      await t.L(`document.getElementById("tx_streets_bail").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`);
      await t.frames(3);
      await t.L(`document.getElementById("tx_streets_bail").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))`);
      await t.until(`__lulu3d.state === "footRun"`, "touch ✋ BAIL bails out", 20000);
      t.check("touch ✋ BAIL bails out", await st() === "footRun");
    }
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "back on her feet", 30000);

    // ── 9. a carjack a cop actually SEES (close, in plain view): that cop gives chase on the spot ──
    await g(`(${D}.L.hold = 0, ${D}.L.grace = 0, true)`);
    await g(`(() => { const F = ctx.foot.debug.F; ctx.traffic.cars.filter(c => !c.data.footStub).forEach(c => ctx.traffic.remove(c));
      const c = ctx.traffic.add("sedan", F.s + 9, 5.25, 1, 0); c.want = 0; c.base = 0; window.__v2 = c;
      const p = ctx.world.road.point(c.s + 0.1, 5.25 - 1.6, {}); F.pos.set(p.x, 0, p.z);
      const u = ${D}.spawnPatrol({ fast: true, oncoming: false }), q = ctx.world.road.point(c.s + 22, 1.75, {});
      Object.assign(u.car, { free: true, ai: () => {}, x: q.x, z: q.z, h: q.h, speed: 0 }); window.__wit = u; return true; })()`);
    await t.frames(3);
    t.check("a cop in plain view can see the jack (ctx.law.copSees)", await g(`ctx.law.copSees(window.__v2.x, window.__v2.z, 45)`));
    t.check("ctx.streets.carjack() with a patrol watching", await g(`ctx.streets.carjack(window.__v2)`));
    if (await t.until(`__lulu3d.state === "playing"`, "…she drives off in it", 30000)) {
      t.check("a cop SAW it → an instant chase (CARJACKING), led by the cop who saw it",
        await g(`ctx.law.chasing && /CARJACK/.test(${D}.L.chase.reason) && window.__wit.mode === "chase"`), await g(`${D}.L.chase && ${D}.L.chase.reason`));
    }
  },
};
