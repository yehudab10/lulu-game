// ⚡📍 Full Schlep Driving TO THE PING (features/dealers/route.js — the coordinator 2026-11-27: "with a destination
// pinged, Full Schlep Driving takes the right exit, follows the streets to the place and pulls up at the kerb by the door
// ('You have arrived. Probably.'); in town it obeys the limits (speed cameras are live: Ocean Pkwy 25 → flash above 35;
// school blocks 15 in school hours — it must never get a ticket), stops for people … and hands back for anything it
// can't do. Still earns nothing.")
//   • in a town without a ping it won't drive (it hands back, nothing changes)
//   • Midwood (school hours forced ON, so every school camera is live): ping a shop → it drives there on the streets —
//     ≤ 24 mph, a full stop at every stop sign (the town never says she ran one), no camera flash, no crash, no score for
//     the stops, no coins — and stops beside the door: "You have arrived. Probably."
//   • from the highway: ping a shop in Lakewood → it moves right, takes the exit, stops at the T, turns onto the cross
//     road, drives into the attached town and on to the door
module.exports = {
  name: "schlepnav",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,world,cameras",
  save2d: { totalCoins: 5000, cruiseUnlocked: true, ownedSkins: ["pink", "tushla_nu"], selectedSkin: "tushla_nu", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const SL = `__lulu3d.ctx.dealers.schlep`;
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts (at home, on foot)", 60000)) return;
    if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
    if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
    await g(`(ctx.law.hold(99999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    // what to watch: the self-drive's events, camera flashes, stop signs run, crashes, the score, the fastest it went
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["dealers:selfdrive", "cameras:flash", "town:stopSign", "crash", "town:enter", "town:exit"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e && typeof e === "object" ? Object.fromEntries(Object.entries(e).filter(([k, v]) => typeof v !== "object")) : e || {})));
      window.__mx = 0; window.__mxT = 0; m.hook("hud", () => { const c = m.ctx; if (c.G && c.G.selfDriving && c.car) { const v = Math.abs(c.car.speed) * m.MPH; if (c.town && c.town.active) window.__mxT = Math.max(window.__mxT, v); window.__mx = Math.max(window.__mx, v); } }); })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    t.check("a Tushla under her + the ⚡ subscription", await g(`ctx.car.skinKey === "tushla_nu"`) && (await g(`ctx.dealers.schlep.subscribe().ok`)) === true);
    const c0 = await coins();

    // ── in town without a ping: it won't drive ──
    await step("noping", async () => {
      await g(`(ctx.town.load("midwood"), true)`);
      await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 90000);
      await g(`(ctx.pins.clear(), ctx.town.active && ctx.town.id === "midwood" ? true : ctx.town.enter({ town: "midwood", speed: 0 }))`);
      if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "into Midwood (her day starts at home there)", 15000)) return;
      // onto Ocean Pkwy, the town's own entry lane — first turned ACROSS it (a car nosed into a driveway): it won't go
      const put = h => g(`(() => { const st = ctx.town.plan.byName["Ocean Pkwy"], s = st.base + Math.max(st.a0 + 20, -300), p = ctx.world.road.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h + ${h}); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
      await put(Math.PI / 2); await t.frames(5);
      await g(`(ctx.pins.ping("midwood:clothes"), ctx.dealers.schlep.engage(), true)`);
      await t.frames(5);
      t.check("pinged, but nosed across the street: it won't take the wheel (\"point it down a street first\")", await g(`!ctx.dealers.schlep.on && ctx.dealers.schlep.debug.last === "street"`), await g(`ctx.dealers.schlep.debug.last`));
      await g(`(ctx.pins.clear(), true)`);
      await put(0);
      await t.frames(30);
      t.check("in town with no 📍 ping: it won't take the wheel (a toast says why)", await g(`ctx.dealers.schlep.engage() === false && !ctx.dealers.schlep.on`));
    });

    // ── Midwood: to a shop's door, by the rules ──
    let arrived = false;
    await step("town", async () => {
      await g(`(ctx.cameras.debug.CM.force.school = 1, true)`);
      t.check("Midwood's speed cameras stand (school zones live: school hours forced on)", await g(`ctx.cameras.debug.CM.cams.length >= 2 && ctx.cameras.schoolHours()`), String(await g(`ctx.cameras.debug.CM.cams.map(c => c.kind).join()`)));
      const sc0 = await g(`ctx.G.score`);
      await g(`ctx.pins.ping("midwood:clothes")`);
      const door = await g(`(() => { const t = ctx.pins.target("midwood:clothes"); return t && { x: t.x, z: t.z, kind: t.kind }; })()`);
      t.check("📍 pinged Avenue J'adore (in this town: the door)", door && door.kind === "at", JSON.stringify(door));
      t.check("⚡ engage: it takes the wheel", await g(`ctx.dealers.schlep.engage() === true`));
      await t.frames(4);
      const plan = await g(`(() => { const R = ctx.dealers.schlep.debug.route; return R && { kind: R.kind, m: Math.round(R.cum[R.cum.length - 1]), pts: R.pts.length, stops: R.pts.filter(p => p.stop).length, street: R.street }; })()`);
      t.check("…and plans the way on the streets (a town route to the door's block)", plan && plan.kind === "town" && plan.m > 30, JSON.stringify(plan));
      arrived = await t.until(`!${SL}.on`, "it drives there and hands back", 240000);
      const last = await g(`ctx.dealers.schlep.debug.last`);
      t.check("📍 \"You have arrived. Probably.\" — it hands back on arrival", last === "arrived", `${last} · ${JSON.stringify(await g(`ctx.dealers.schlep.debug.log.slice(-4)`))}`);
      const at = await g(`(() => { const c = ctx.car.pos; return { d: Math.hypot(c.x - ${door.x}, c.z - ${door.z}), v: ctx.car.speed, street: ctx.town.street }; })()`);
      t.check("…stopped beside the door (within 22 m, standing still)", at.d < 22 && Math.abs(at.v) < 1, JSON.stringify(at));
      await t.shot("arrived");
      const mx = await t.L(`window.__mxT`);
      t.check("never over 24 mph in town (Ocean Pkwy 25, the cameras fire above 35)", mx > 8 && mx <= 24.6, mx.toFixed(1));
      t.check("📸 no speed-camera flash (school zones live)", (await evs(/cameras:flash/)).length === 0);
      const ran = await evs(/town:stopSign/), stops = await g(`(ctx.dealers.schlep.debug.log.find(l => l.ev === "arrived") || {}).stops`);
      t.check("🛑 a full stop at every stop sign (the town never says it ran one)", ran.length === 0, `ran ${ran.length} · stopped at ${stops}`);
      t.check("💥 no crash on the way", (await evs(/^crash/)).length === 0, (await evs(/^crash/)).join(" ").slice(0, 200));
      t.check("…and it earned nothing: no score for the stops", await g(`ctx.G.score`) - sc0 < 1, `${sc0} → ${await g(`ctx.G.score`)}`);
    });

    // ── from the highway: the exit, the T, the cross road, into Lakewood, to the door ──
    await step("exit", async () => {
      await g(`(ctx.town.leave("reset"), true)`); await t.frames(10);
      if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
      await g(`(ctx.town.load("lakewood"), true)`);
      await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000);
      await g(`(ctx.traffic.clear(), true)`);
      const E = await g(`ctx.town.debug.exitAhead(1200)`);
      t.check("a Lakewood exit is planned ahead", typeof E === "number", String(E));
      await g(`(() => { const r = ctx.world.road, s = ${E} - 900, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vx = Math.sin(p.h) * 24; ctx.car.vz = Math.cos(p.h) * 24; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.frames(10);
      await g(`ctx.pins.ping("lakewood:clothes")`);
      t.check("📍 a shop in Lakewood pinged from the highway; ⚡ engage", await g(`ctx.dealers.schlep.engage() === true`));
      const took = await t.until(`${SL}.debug.route && ${SL}.debug.route.kind === "exit" || !${SL}.on`, "it plans the exit ~700 m out", 60000);
      t.check("…it plans the exit (the right lane, the ramp, the STOP, the cross road)", took && await g(`!!(ctx.dealers.schlep.debug.route && ctx.dealers.schlep.debug.route.kind === "exit" && Math.abs(ctx.dealers.schlep.debug.route.exitS - ${E}) < 1)`), JSON.stringify(await g(`ctx.dealers.schlep.debug.log.slice(-3)`)));
      await t.until(`__lulu3d.ctx.car.s > ${E} + 20 || !${SL}.on`, "down the decel lane onto the ramp", 60000);
      await t.shot("ramp");
      const inT = await t.until(`__lulu3d.ctx.town.active || !${SL}.on`, "the stop at the T, right onto the cross road, into town", 90000);
      t.check("…into Lakewood by its own wheels (town:exit, then town:enter)", inT && await g(`ctx.town.active && ctx.town.id === "lakewood"`) && (await evs(/town:exit/)).length >= 1,
        `${await g(`ctx.town.id`)} · ${await g(`ctx.dealers.schlep.debug.last`)} · ${JSON.stringify(await g(`ctx.dealers.schlep.debug.log.slice(-3)`))}`);
      // (the town's route is planned on the NEXT controls frame after town:enter — the fast test clock stops exactly on the
      //  frame the town turns active, so give it a moment; it was never a hand-back: ci/sweep-road checked)
      await t.until(`!${SL}.on || (${SL}.debug.route && ${SL}.debug.route.kind === "town")`, "the town's route is planned", 10000);
      t.check("…still self-driving in town (it plans the streets from the approach)", await g(`ctx.dealers.schlep.on && ctx.dealers.schlep.debug.route && ctx.dealers.schlep.debug.route.kind === "town"`));
      // a new ping on the way (the nearest Lakewood place): it re-plans from where it is and goes there instead
      const near = await g(`(() => { let b = null, bd = 1e9; for (const p of ctx.pins.list()) { if (p.town !== "lakewood" || p.id === "lakewood:clothes") continue; const t = ctx.pins.target(p.id); if (t && t.kind === "at" && t.d > 60 && t.d < bd) { bd = t.d; b = p.id; } } return b; })()`);
      await g(`ctx.pins.ping(${JSON.stringify(near)})`);
      await t.frames(6);
      t.check(`📍 a new ping on the way (${near}): it re-plans and goes there instead`, await g(`ctx.dealers.schlep.on && !!ctx.dealers.schlep.debug.route && ctx.dealers.schlep.debug.log.filter(l => l.ev === "town").pop().to === ${JSON.stringify(near)}`), JSON.stringify(await g(`ctx.dealers.schlep.debug.log.slice(-2)`)));
      await t.until(`!${SL}.on`, "on to the door", 180000);
      const last = await g(`ctx.dealers.schlep.debug.last`);
      t.check("📍 arrived at the Lakewood shop", last === "arrived", `${last} · ${JSON.stringify(await g(`ctx.dealers.schlep.debug.log.slice(-4)`))}`);
      await t.shot("arrived-lakewood");
      t.check("📸 no flash, 🛑 no stop sign run, 💥 no crash all the way", (await evs(/cameras:flash|town:stopSign|^crash/)).length === 0, (await evs(/cameras:flash|town:stopSign|^crash/)).join(" ").slice(0, 200));
      const mx = await t.L(`window.__mx`);
      t.check("never over the limit on the highway either (≤ 70 mph)", mx <= 70.5, mx.toFixed(1));
    });
    t.check("no coins from any of it (just the subscription)", c0 - await coins() === 0, `${c0} → ${await coins()}`);
  },
};
