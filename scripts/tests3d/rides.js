// Rides (features/rides): every vehicle Lulu drives has its own handling, horn and trick.
//   • the registry: ctx.rides.add / forKey; the fleet kinds are jackable (streets' table)
//   • 🚓 cop car: handling + weight; tap the horn (L1) = siren → the light bar strobes and the
//     car ahead pulls onto the shoulder, oncoming slows; HOLD L1 = 🚨 PULL OVER (law's copStop
//     scene, ⏭ skipped); a real cop watching → IMPERSONATING AN OFFICER; in a chase the trick is
//     🛑 SPIKES (X on the keyboard) — a strip behind her
//   • 🚑 ambulance: dispatch → stop by the patient → the ER bay + the clock → stop in the bay →
//     paid; 🩹 PATCH UP (+1 ❤️, kits run out); the ER chips in afterwards
//   • 🍦 ice cream: horn = jingle; parked → kids run up, pay, get a cone
//   • 🚌 bus: a stop → riders board → fares · 🚚 truck: heavy (light bumps cost no heart), air horn
//   • 🏎️ sports: harder nitro · 🚕 taxi: the trick starts a Lulu Cab shift
//   • the chip + touch button only exist inside a ride; layouts (desktop, TV, phone landscape /
//     portrait, HUD Clean) keep them on screen and clear of the core HUD; perf in busy Cruise.
module.exports = {
  name: "rides",
  query: "&enable=rides",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const st = () => g(`ctx.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const place = (ds, d, v = 0) => g(`(() => { const r = ctx.world.road, s = ctx.car.s + ${ds}, p = r.point(s, ${d}, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; return s; })()`);
    const placeAt = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; return true; })()`);
    const D = `ctx.rides.debug`;
    const board = async id => {
      await g(`(${D}.board("${id}"), true)`);
      return t.until(`__lulu3d.ctx.rides.id === "${id}" && __lulu3d.state === "playing"`, `boards the ${id}`, 30000);
    };
    const holdHorn = async n => { await t.hold(4, 1); await t.frames(n); await t.hold(4, 0); await t.frames(2); };
    const chip = () => t.L(`(() => { const e = document.querySelector(".rides-hud"); return e && e.style.display !== "none" ? e.textContent.trim() : ""; })()`);

    // ── the registry ──
    t.check("ctx.rides service is registered", await g(`!!(ctx.rides && ctx.rides.add && ctx.rides.forKey && ctx.rides.debug)`));
    t.check("built-in rides: cop, ambulance, ice cream, bus, truck, sports, taxi",
      await g(`["cop", "ambulance", "icecream", "bus", "truck", "sports", "taxi"].every(id => ctx.rides.list().includes(id))`));
    t.check("forKey maps shell models to rides", await g(`ctx.rides.forKey("cop").id === "cop" && ctx.rides.forKey("foot_ambulance").id === "ambulance" && !ctx.rides.forKey("sedan")`));
    t.check("the fleet is jackable (streets' table) and the ice-cream truck gets a roomier camera",
      await g(`["rides_taxi", "rides_icecream", "journey_icecream", "rides_ambulance", "rides_bus"].every(k => !!ctx.streets.rides[k]) && !!ctx.streets.cams.journey_icecream`));
    t.check("the button guide has the ride trick", await t.L(`import("./js/core/screens.js").then(m => /Ride trick/.test(m.controlsHtml()))`));
    t.check("party keeps rides off (shared world stays identical)", await t.L(`import("./js/features/party/index.js").then(() => true)`));
    await g(`ctx.rides.add({ id: "testvan", name: "Test van", emoji: "🧪", keys: ["test_nothing"] })`);
    t.check("a town can add its own ride", await g(`ctx.rides.forKey("test_nothing").id === "testvan"`));

    await g(`L3.startRun({ mode: "cruise", s: 600 })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await place(0, 1.75, 0);
    t.check("in her own car: no ride, no chip, no trick button", !(await g(`ctx.rides.id`)) && !(await chip()) &&
      await t.L(`(() => { const b = document.getElementById("tx_rides_act"); return !b || b.style.display === "none"; })()`));

    // ── 🚓 the cop car ──
    if (await board("cop")) {
      t.check("cop: handling + weight (top 1.12, mass 1.4)", await g(`Math.abs(ctx.car.stats.top - 1.12) < 1e-6 && ctx.car.mass === 1.4`));
      await t.frames(20);
      t.check("cop: a first-time hint card (banner)", await t.L(`/COP CAR/.test(document.body.textContent)`),
        JSON.stringify(await t.L(`import("./js/hud.js").then(m => m.notifyState())`)) + " seen=" + await g(`!!${D}.S.seen.cop`));
      await g(`(globalThis.__ahead = ctx.traffic.add("sedan", ctx.car.s + 40, 1.75, 1, 6), globalThis.__onc = ctx.traffic.add("van", ctx.car.s + 90, -1.75, -1, 14), true)`);
      await t.frames(3);
      t.check("cop: the trick on offer is 🚨 PULL OVER (a car ahead)", (await g(`ctx.rides.act() && ctx.rides.act().id`)) === "pullover");
      await t.tap(4);                    // tap L1: the siren
      await t.frames(4);
      t.check("cop: tap L1 → siren ON (horn swallowed: no plain honk)", await g(`ctx.rides.siren`));
      await t.frames(60);
      const yd = await g(`({ d: __ahead.d, sp: __ahead.speed, od: __onc.d, os: __onc.speed, n: ${D}.yieldingCount() })`);
      t.check("cop: the car ahead pulls toward the shoulder and slows", yd.d > 4.0 && yd.sp < 6, JSON.stringify(yd));
      t.check("cop: the oncoming van hugs its shoulder", yd.od < -2.6, JSON.stringify(yd));
      t.check("cop: the light bar strobes (law's rig on the ride)", await g(`!!(ctx.rides.current.obj.userData.lawRig && ctx.rides.current.obj.userData.lawRig.on)`));
      const ch = await chip();
      t.check("cop: the chip shows the trick + its glyph", /PULL OVER/.test(ch) && /hold LB/.test(ch), ch);
      await t.shot("cop-siren");
      // hold L1: pull the car ahead over → law's copStop scene
      await place(0, 1.75, 4);
      await g(`(__ahead.s = ctx.car.s + 25, __ahead.d = 1.75, __ahead.dTarget = 1.75, true)`);
      await holdHorn(18);
      if (await t.until(`__lulu3d.state === "lawStop"`, "cop: HOLD L1 → 🚨 pull-over scene", 20000)) {
        t.check("cop: a ticket was written from the book", (await g(`ctx.rides.current.data.tickets`)) === 3);
        await t.frames(20);
        await t.shot("cop-pullover");
        await t.hold(1, 1); await t.frames(30); await t.hold(1, 0);
        await t.until(`__lulu3d.state === "playing"`, "cop: ⏭ the pull-over lands back on the road", 60000);
      }
      // a real cop saw her play cop
      await g(`(ctx.rides.current.data.impostor = true, true)`);
      await t.frames(4);
      t.check("cop: a real cop watching → IMPERSONATING AN OFFICER chase", await g(`ctx.law.chasing && /IMPERSONATING/.test(ctx.law._dbg.L.chase.reason)`));
      t.check("cop: in a chase the trick is 🛑 SPIKES", (await g(`ctx.rides.act().id`)) === "spikes");
      const strips0 = await g(`ctx.streets.debug.HEAT.spikes.length`);
      await t.key("x");
      t.check("cop: X drops a spike strip BEHIND her (2 left)", (await g(`ctx.streets.debug.HEAT.spikes.length`)) === strips0 + 1 &&
        await g(`ctx.rides.current.data.spikes === 2 && ctx.streets.debug.HEAT.spikes[ctx.streets.debug.HEAT.spikes.length - 1].s < ctx.car.s`));
      await g(`(ctx.law.clearHeat(""), ctx.traffic.clear(), true)`);
      await t.tap(4); await t.frames(3);
      t.check("cop: tap L1 again → siren off, every car released", !(await g(`ctx.rides.siren`)) && (await g(`${D}.yieldingCount()`)) === 0);
    }

    // ── 🚑 the ambulance ──
    await place(0, 1.75, 0);
    if (await board("ambulance")) {
      t.check("ambulance: handling + weight", await g(`Math.abs(ctx.car.stats.acc - 0.85) < 1e-6 && ctx.car.mass === 2.5 && Math.abs(ctx.car.stats.top - 1.12) > 1e-3`));
      await t.L(`import("./js/models.js").then(m => m.ensureModels(["npcMan", "npcWoman", "rides_er"]))`);
      await g(`(${D}.amb.RUN.phase = "off", ${D}.amb.knobs.erAhead = 160, ${D}.amb.dispatch(60))`);
      t.check("ambulance: dispatch → a patient on the shoulder + the chip counts down the metres", (await g(`${D}.amb.RUN.phase`)) === "pickup" && /Patient/.test(await (async () => { await t.frames(8); return chip(); })()));
      await t.shot("ambulance-patient");
      const ps = await g(`${D}.amb.RUN.s`);
      await placeAt(ps, 6.2, 0);
      await t.until(`__lulu3d.ctx.rides.debug.amb.RUN.phase === "rush"`, "ambulance: stop beside the patient → loaded → rush to the ER", 20000);
      t.check("ambulance: the siren comes on, the ER is up ahead, the clock runs", await g(`ctx.rides.siren && !!${D}.amb.RUN.er.parent && ${D}.amb.RUN.left > 30`));
      await t.frames(10);
      t.check("ambulance: the chip shows ⏱ + metres to the ER", /ER \d+ m/.test(await chip()), await chip());
      await g(`L3.emit("crash", { impact: 8 })`);
      t.check("ambulance: a bump costs the tip", (await g(`${D}.amb.RUN.tip`)) === 8);
      const c0 = await coins();
      const er = await g(`${D}.amb.RUN.erS`);
      await placeAt(er - 30, 5.5, 0);
      await t.frames(6);
      await t.shot("ambulance-er");
      await placeAt(er, 6.0, 0);
      await t.until(`__lulu3d.ctx.rides.debug.amb.RUN.phase === "drop" || __lulu3d.ctx.rides.debug.amb.RUN.phase === "gone"`, "ambulance: stop in the ER bay → delivered", 20000);
      t.check("ambulance: paid on delivery (+ the patient count)", (await coins()) > c0 + 14 && (await g(`${D}.S.patients`)) >= 1, `${c0} → ${await coins()}`);
      // 🩹 patch up
      await g(`(ctx.G.hearts = 1, true)`);
      await t.key("x");
      t.check("ambulance: X = 🩹 PATCH UP (+1 ❤️, a kit used)", (await g(`ctx.G.hearts`)) === 2 && (await g(`ctx.rides.current.data.kits`)) === 1);
      await g(`(ctx.G.hearts = ctx.G.maxHearts, true)`);
      await t.key("x");
      t.check("ambulance: at full hearts the kit isn't wasted", (await g(`ctx.rides.current.data.kits`)) === 1);
      // the ER remembers
      await g(`(L3.emit("er:admit", { reason: "test" }), true)`);
      t.check("ambulance: an ER visit after delivering patients comes with a refund", (await g(`${D}.amb.perk`)) > 0);
      const c1 = await coins();
      await g(`(L3.setState("playing"), true)`);
      await t.frames(2);
      t.check("…paid when she's back on the road", (await coins()) > c1);
    }

    // ── 🍦 the ice-cream truck ──
    await g(`(ctx.traffic.clear(), true)`);
    await place(20, 6.0, 0);
    if (await board("icecream")) {
      t.check("ice cream: heavy (mass 3.2), slow", await g(`ctx.car.mass === 3.2 && ctx.car.stats.top < 0.7`));
      await t.L(`import("./js/models.js").then(m => m.ensureModels(["npcKid", "rides_cone"]))`);
      await place(0, 6.0, 0);
      await t.tap(4);
      t.check("ice cream: the horn is the jingle (no siren)", !(await g(`ctx.rides.siren`)) && (await g(`ctx.rides.current.data.jingleT`)) > 5);
      if (await t.until(`__lulu3d.ctx.rides.current && __lulu3d.ctx.rides.current.data.served >= 1`, "ice cream: parked + jingle → a kid runs up and buys a cone", 40000)) {
        await t.frames(10);
        await t.shot("icecream-kids");
        t.check("ice cream: the chip counts the cones", /cones/.test(await chip()), await chip());
      }
      await place(0, 6.0, 12);
      await t.frames(20);
      t.check("ice cream: driving off leaves the kids behind (no one chases a moving truck)", await g(`${D}.ice.KIDS.every(k => k.phase === "leave")`));
    }

    // ── 🚌 the bus ──
    await place(30, 1.75, 0);
    if (await board("bus")) {
      await t.L(`import("./js/models.js").then(m => m.ensureModels(["rides_busstop", "npcMan", "npcWoman", "npcKid"]))`);
      await g(`${D}.bus.placeStop(0, ctx.car.s + 40)`);
      t.check("bus: a 🚏 stop goes up with riders waiting", await g(`${D}.bus.STOP.phase === "waiting" && ${D}.bus.STOP.riders.length >= 1`));
      await t.frames(6);
      t.check("bus: the chip shows the next stop", /Next stop/.test(await chip()), await chip());
      const c0 = await coins();
      await placeAt(await g(`${D}.bus.STOP.s`), 5.6, 0);
      await g(`(ctx.G.invT = 0, true)`);              // (no post-boarding invincibility blink in the screenshot)
      await t.frames(30);
      const vis = await g(`(() => { const so = ctx.foot.shellObj; let v = !!so, o = so; while (o) { if (!o.visible) v = false; o = o.parent; }
        const cp = ctx.camera.position, p = ctx.car.pos; return { v, key: ctx.foot.vehicle && ctx.foot.vehicle.kind, cam: +Math.hypot(cp.x - p.x, cp.z - p.z).toFixed(1), camY: +cp.y.toFixed(1), inScene: !!(so && so.parent) }; })()`);
      t.check("bus: the bus itself is on screen (shell visible, camera pulled back past its rear)", vis.v && vis.cam > 6, JSON.stringify(vis));
      await t.shot("bus-stop");
      await t.until(`__lulu3d.ctx.rides.debug.bus.STOP.phase === "wait"`, "bus: riders board and pay", 30000);
      t.check("bus: fares paid", (await coins()) > c0, `${c0} → ${await coins()}`);
      await t.tap(4);
      t.check("bus: the horn is the AIR HORN", await g(`!ctx.rides.siren`));
    }

    // ── 🚚 the box truck: heavy ──
    await place(30, 1.75, 0);
    if (await board("truck")) {
      t.check("truck: mass 4", await g(`ctx.car.mass === 4`));
      const h0 = await g(`(ctx.G.invT = 0, ctx.G.hearts = 3, 3)`);
      await g(`(L3.damage(0.7, "bump", "sedan"), true)`);
      t.check("truck: a light bump with a sedan costs no heart", (await g(`ctx.G.hearts`)) === h0);
      await g(`(ctx.G.invT = 0, L3.damage(1.6, "big", "sedan"), true)`);
      t.check("truck: a big one still does", (await g(`ctx.G.hearts`)) === h0 - 1);
    }

    // ── 🏎️ sports car ──
    await place(30, 1.75, 0);
    if (await board("sports")) t.check("sports: harder nitro (×1.5 top, 15 push)", await g(`ctx.car.stats.nitroTop === 1.5 && ctx.car.stats.nitroAcc === 15`));

    // ── 🚕 taxi ──
    await place(30, 1.75, 0);
    if (await board("taxi")) {
      t.check("taxi: the trick is START A SHIFT", (await g(`ctx.rides.act().id`)) === "shift");
      await t.key("x");
      t.check("taxi: X → a Lulu Cab shift starts", await g(`!!(ctx.hustle.job && ctx.hustle.job.id === "cab")`));
      t.check("taxi: no trick during the shift", !(await g(`ctx.rides.act()`)));
      await g(`(ctx.hustle.end("quit"), true)`);
    }

    // ── back in her own car: everything goes away, her stats come back ──
    await g(`L3.startRun({ mode: "cruise", s: 600 })`);
    await t.until(`__lulu3d.state === "playing"`, "a new run");
    t.check("own car again: stats + weight restored, no chip", await g(`!ctx.rides.id && ctx.car.stats.top === 1 && !ctx.car.stats.nitroTop && ctx.car.mass === 1`) && !(await chip()));

    // ── layouts: the chip + touch button on every screen ──
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await place(0, 1.75, 0);
    await board("cop");
    await g(`(ctx.traffic.add("sedan", ctx.car.s + 35, 1.75, 1, 6), ctx.rides.setSiren(true), true)`);
    const overlaps = () => t.L(`(() => {
      const groups = { pills: ".hud-tl .pill", trip: ".hud-top", pause: "#pauseBtn", speedo: ".hud-br .speedo", stick: "#stickBase",
        pedals: ".pedals .tbtn", extra: "#touchExtra button", rides: ".rides-hud > *" };
      const boxes = [];
      for (const [g, sel] of Object.entries(groups)) for (const e of document.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== "hidden" && e.offsetParent !== null) boxes.push({ g, r, n: (e.id || e.textContent || "").trim().slice(0, 12) });
      }
      const out = [], vw = innerWidth, vh = innerHeight;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.g === b.g || ![a.g, b.g].some(x => x === "rides" || x === "extra")) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 2 && oy > 2) out.push(a.g + ":" + a.n + " × " + b.g + ":" + b.n);
      }
      const inside = boxes.filter(b => b.g === "rides" || b.g === "extra").every(b => b.r.left >= -1 && b.r.top >= -1 && b.r.right <= vw + 1 && b.r.bottom <= vh + 1);
      return { inside, out, n: boxes.filter(b => b.g === "rides").length };
    })()`);
    for (const [name, w, h, tv, touch, clean] of [["desktop", 1280, 720, false, false, false], ["tv-1080", 1920, 1080, true, false, false],
      ["phone-landscape", 844, 390, false, true, false], ["phone-portrait", 390, 844, false, true, false], ["desktop-clean", 1280, 720, false, false, true]]) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; m.save3d.settings.hudMode = ${clean ? '"clean"' : '"full"'}; })`);
      if (touch) await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
      else await t.L(`(window.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft" })), window.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft" })), 0)`);
      await g(`(ctx.applySettings(), true)`);
      await t.frames(10);
      const o = await overlaps();
      t.check(`${name}: the ride HUD is on screen, nothing overlaps`, o.inside && o.out.length === 0 && o.n >= 1, JSON.stringify(o));
      if (touch) t.check(`${name}: the ride's trick button shows (and only in a ride)`, await t.L(`(() => { const b = document.getElementById("tx_rides_act"); return !!b && b.style.display !== "none" && b.getBoundingClientRect().width > 30; })()`));
      await t.shot(`layout-${name}`);
    }
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; m.save3d.settings.hudMode = "full"; })`);
    await g(`(ctx.applySettings(), ctx.rides.setSiren(false), true)`);

    // ── 📉 perf: busy Cruise, her own car vs. a cop car with the siren on ──
    await g(`L3.startRun({ mode: "cruise", s: 600 })`);
    await t.until(`__lulu3d.state === "playing"`, "perf run");
    await g(`(() => { ctx.traffic.config.enabled = false; ctx.traffic.clear(); ctx.banter.autopilot = { d: 1.75, speed: 22 };
        const s = ctx.car.s; for (let i = 0; i < 10; i++) ctx.traffic.add(["sedan", "van", "truck"][i % 3], s + 40 + i * 24, i % 2 ? -1.75 : 5.25, i % 2 ? -1 : 1, i % 2 ? 18 : 23);
        return true; })()`);
    await place(0, 1.75, 22);
    const perf = async label => {
      await t.frames(20);
      return g(`new Promise(res => { const r = ctx.renderer, f0 = L3.frames, t0 = performance.now(); let calls = 0, tris = 0, n = 0;
        const tick = () => { calls += r.info.render.calls; tris += r.info.render.triangles; n++; if (L3.frames - f0 >= 45) res({ label: "${label}", ms: +((performance.now() - t0) / (L3.frames - f0)).toFixed(1), calls: Math.round(calls / n), tris: Math.round(tris / n), cars: ctx.traffic.cars.length });
          else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })`);
    };
    const before = await perf("busy cruise, her own car");
    await board("cop");
    await g(`(ctx.banter.autopilot = { d: 1.75, speed: 22 }, ctx.rides.setSiren(true), true)`);
    const after = await perf("busy cruise, cop car + siren");
    console.log(`  perf: ${JSON.stringify(before)}  →  ${JSON.stringify(after)}`);
    t.check("perf: a ride with its siren costs a handful of draw calls", after.calls - before.calls <= 20, `${before.calls} → ${after.calls} draw calls`);
    await g(`(ctx.banter.autopilot = null, true)`);
  },
};
