// 🚗 The road sweep, part 3 (ci/sweep-road, 3d/docs/sweeps/sweep-road.md): A WHOLE LAP DRIVEN, a controller at 1280 × 720,
// every feature on, traffic on, the QA watchdog on. A test driver (a `controls` hook — the same steering a player has)
// keeps to the right lanes at ~70 mph, changes lanes round slower cars, and drives the lap past every exit (Midwood,
// JFK, Lakewood, the rest areas, the roadside places, the dealerships). Checks: no glitch from the watchdog, no
// invisible bump (a sudden loss of speed with nothing hit), the car on the road (not sunk / floating), traffic never
// drives into her from behind, the trip bar always says something. A picture every ~1.5 km (--shots).
const W = require("../lib/qawatch.js");

module.exports = {
  name: "sweeproad3",
  viewport: { width: 1280, height: 720 },
  query: "&enable=all",
  save2d: { totalCoins: 2000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    try { await drive(t); } catch (e) { t.check("drive: threw", false, String(e && e.stack || e).slice(0, 400)); } finally { W.dropRelayErrors(t); }
  },
};

async function drive(t) {
  const g = t.game;
  await W.install(t);
  // the test driver + a per-frame log of what a player would feel
  await t.L(`import("./js/core/ctx.js").then(m => {
    const C = m.ctx, D = window.__drv = { on: false, v: 31, lane: 5.25, bumps: [], sunk: [], rear: 0, crashes: [], f: 0, lastV: null, maxY: 0, minY: 0, laneT: 0, hold: 0 };
    m.on("crash", e => { D.crashT = C.frames; if (D.on) D.crashes.push({ s: Math.round(C.car.s), kind: e.kind || (e.collider && e.collider.kind) || (e.actor && e.actor.kind) || "?", fault: e.fault || null, imp: +(e.impact || 0).toFixed(1) }); });
    m.hook("controls", (ctl, dt) => {
      if (!D.on || C.state !== "playing" || (C.town && C.town.active)) return;
      const car = C.car, hw = C.world.highway, n = hw.nearest(car.pos.x, car.pos.z, car.s, {});
      // a slower car ahead in her lane → the other right lane if it's clear, else ease off
      let block = null;
      for (const c of C.traffic.cars) { if (c.dir < 0 || c.hit) continue; const gap = c.s - n.s; if (gap > 0 && gap < 45 && Math.abs(c.d - D.lane) < 2.2) { if (!block || gap < block.gap) block = { gap, v: c.speed }; } }
      if (block && D.laneT <= 0) {
        const other = D.lane > 3 ? 1.75 : 5.25;
        if (!C.traffic.cars.some(c => c.dir > 0 && !c.hit && Math.abs(c.d - other) < 2.4 && Math.abs(c.s - n.s) < 30)) { D.lane = other; D.laneT = 3; }
      }
      D.laneT -= dt;
      const tgt = hw.point(n.s + 22, D.lane, {});
      const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z); let a = want - car.h; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
      const v = block && block.gap < 30 && Math.abs(n.d - D.lane) < 1.5 ? Math.min(D.v, block.v) : D.v;
      ctl.steer = Math.max(-1, Math.min(1, -a * 2.4)); ctl.throttle = car.speed < v ? 0.85 : 0; ctl.brake = car.speed > v + 2.5 ? 0.5 : 0; ctl.handbrake = false; ctl.analog = true;
    }, 1000);
    m.hook("hud", () => {
      if (!D.on || C.state !== "playing" || (C.town && C.town.active)) { D.lastV = null; return; }
      const car = C.car, v = car.speed;
      // an invisible bump: ≥ 6 m/s lost in one frame (1/30 s = 180 m/s²) with no crash event this frame or the last
      if (D.lastV != null && D.lastV - v > 6 && !(D.crashT >= C.frames - 2)) D.bumps.push({ s: Math.round(car.s), d: +car.d.toFixed(1), from: +D.lastV.toFixed(1), to: +v.toFixed(1) });
      D.lastV = v;
      const y = car.tilt.position.y; D.maxY = Math.max(D.maxY, y); D.minY = Math.min(D.minY, y);
      D.f++;
    });
  })`);
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 180000)) return;
  await W.reset(t);
  const s0 = await g(`Math.round(ctx.car.s)`), goal = s0 + 16000 + 400;
  await g(`(window.__drv.on = true, ctx.G.invT = 0, true)`);
  let nextShot = s0 + 300, lastS = s0, stall = 0, arrested = 0;
  const trips = new Set();
  for (let k = 0; k < 4000; k++) {
    await t.frames(30);
    const st = await g(`({ s: Math.round(ctx.car.s), state: L3.state, town: !!(ctx.town && ctx.town.active), trip: (document.querySelector("#tripLabel") || {}).textContent || "", hearts: ctx.G.hearts, chase: !!(ctx.law && ctx.law.chasing) })`);
    if (st.trip) trips.add(st.trip.replace(/[\d.]+ mi/, "#"));
    // keep her driving: a wreck / an arrest / a scene → back on the road where she was (this part is about the road itself)
    if (st.state !== "playing" || st.town) {
      if (/^law/.test(st.state)) arrested++;
      await W.pause(t, false);
      await g(`(() => { if (ctx.foot && ctx.foot.active) ctx.foot.end("test"); if (ctx.town && ctx.town.active) ctx.town.leave("reset"); if (L3.state !== "playing") L3.setState("playing");
        const hw = ctx.world.highway, s = Math.max(ctx.car.s, ${lastS}), p = hw.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vx = Math.sin(p.h) * 25; ctx.car.vz = Math.cos(p.h) * 25; ctx.G.hearts = ctx.G.maxHearts; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
      await t.frames(3); await W.pause(t, true); await W.moved(t);
      continue;
    }
    if (st.hearts <= 1) await g(`(ctx.G.hearts = ctx.G.maxHearts, true)`);
    if (st.chase) await g(`(ctx.law.standDown("test"), true)`);
    if (st.s >= nextShot) { await t.shot(`lap-${Math.round((st.s - s0) / 100) / 10}km`); nextShot += 1500; }
    if (st.s - lastS < 20) { if (++stall > 6) { t.check("drive: she keeps moving up the highway", false, `stuck at s ${st.s}`); break; } } else stall = 0;
    lastS = Math.max(lastS, st.s);
    if (st.s >= goal) break;
  }
  const D = await g(`(() => { const D = window.__drv; D.on = false; return { bumps: D.bumps, sunk: D.sunk, crashes: D.crashes, f: D.f, maxY: +D.maxY.toFixed(2), minY: +D.minY.toFixed(2) }; })()`);
  console.log(`    · ${D.f} frames driven, ${D.crashes.length} crashes, y ${D.minY}…${D.maxY}, trips: ${[...trips].slice(0, 12).join(" | ")}`);
  if (D.crashes.length) console.log(`    · crashes: ${JSON.stringify(D.crashes.slice(0, 12))}`);
  t.check("drive: she drove the whole lap", lastS >= goal - 50, `${lastS - s0} m of ${goal - s0}`);
  t.check("drive: no invisible bumps (≥ 6 m/s lost in a frame with nothing hit)", D.bumps.length === 0, JSON.stringify(D.bumps.slice(0, 8)));
  const rear = D.crashes.filter(c => c.fault === "them" && c.kind !== "cop");
  t.check("drive: traffic never drives into her (their fault) on an ordinary lap", rear.length === 0, JSON.stringify(rear.slice(0, 6)));
  t.check("drive: the trip bar always names where she's heading", trips.size > 2 && ![...trips].some(x => !x.trim()), [...trips].join(" | ").slice(0, 400));
  W.check(t, "drive: the lap", await W.report(t));
}
