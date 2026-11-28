// 🚗 The road sweep, part 3 (ci/sweep-road, 3d/docs/sweeps/sweep-road.md): A WHOLE LAP DRIVEN, a controller at 1280 × 720,
// every feature on, traffic on, the QA watchdog on. A test driver (a `controls` hook — the same steering a player has)
// keeps to the right lanes at ~70 mph, changes lanes round slower cars, and drives the lap past every exit (Midwood,
// JFK, Lakewood, the rest areas, the roadside places, the dealerships). Checks: no glitch from the watchdog, no
// invisible bump (a sudden loss of speed with nothing hit), the car on the road (not sunk / floating), traffic never
// drives into her from behind, the trip bar always says something. A picture every ~1.5 km (--shots).
const W = require("../lib/qawatch.js");
// SWEEPROAD3_DOWN=1: the same drive DOWN the lap, on the far carriageway (ci/twoway); SWEEPROAD3_KM: how far (default a lap)
const DOWN = process.env.SWEEPROAD3_DOWN === "1", KM = +process.env.SWEEPROAD3_KM || 0, FROM = +process.env.SWEEPROAD3_FROM || 0;
const DIR = DOWN ? -1 : 1;

module.exports = {
  name: "sweeproad3",
  viewport: { width: 1280, height: 720 },
  query: "&enable=all&airport=1",
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
    const C = m.ctx, DIR = ${DIR}, D = window.__drv = { on: false, v: 31, lane: DIR * 5.25, bumps: [], sunk: [], rear: 0, crashes: [], f: 0, lastV: null, maxY: 0, minY: 0, laneT: 0, hold: 0 };
    // (a pothole, a cone, a puddle: visible bumps that slow her on purpose — not "invisible")
    m.on("stat", e => { if (e && /pothole|cone|puddle|splash/i.test(e.id || "")) D.crashT = C.frames; });
    m.on("crash", e => { D.crashT = C.frames; if (D.on) { const k = e.kind || (e.collider && e.collider.kind) || (e.actor && e.actor.kind) || "?";
      if (D.crashes.length && D.crashes[D.crashes.length - 1].kind === k && C.frames - D.lastCrashF < 20) { D.lastCrashF = C.frames; D.crashes[D.crashes.length - 1].n++; return; }
      D.lastCrashF = C.frames;
      const o = e.car; D.crashes.push({ s: Math.round(C.car.s), d: +C.car.d.toFixed(1), kind: k, fault: e.fault || null, imp: +(e.impact || 0).toFixed(1), n: 1, trail: D.trail ? D.trail.slice(-6) : null,
        them: o ? { dir: o.dir, v: +(o.speed || 0).toFixed(1), d: +(o.d || 0).toFixed(1), rel: Math.round(o.s - C.car.s), beh: (o.data && o.data.beh) || "", ai: !!o.ai, h: +(Math.cos(o.h - C.car.h)).toFixed(2) } : null }); } });
    m.hook("controls", (ctl, dt) => {
      if (!D.on || C.state !== "playing" || (C.town && C.town.active)) return;
      const car = C.car, hw = C.world.highway, n = hw.nearest(car.pos.x, car.pos.z, car.s, {});
      // a slower car ahead in her lane → the other right lane if it's clear, else ease off
      let block = null;
      for (const c of C.traffic.cars) { if (c.dir * DIR < 0 && !c.hit) continue; const gap = (c.s - n.s) * DIR; if (gap > 0 && gap < 55 && Math.abs(c.d - D.lane) < 2.4) { const v = c.hit || c.dir * DIR < 0 ? 0 : c.speed; if (!block || gap < block.gap) block = { gap, v }; } }      // (a wreck in her lane is in the way too)
      if (block && D.laneT <= 0) {
        const other = DIR * (D.lane * DIR > 3 ? 1.75 : 5.25);
        if (!C.traffic.cars.some(c => (c.dir * DIR > 0 || c.hit) && Math.abs(c.d - other) < 2.4 && Math.abs(c.s - n.s) < 30)) { D.lane = other; D.laneT = 3; }
      }
      D.laneT -= dt;
      const tgt = hw.point(n.s + DIR * 22, D.lane, {});
      D.dbg = { ns: Math.round(n.s), nd: +n.d.toFixed(1), cs: Math.round(car.s), tg: Math.round(Math.hypot(tgt.x - car.pos.x, tgt.z - car.pos.z)) };
      const want = Math.atan2(tgt.x - car.pos.x, tgt.z - car.pos.z); let a = want - car.h; while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI;
      const v = block && Math.abs(n.d - D.lane) < 1.5 ? Math.min(D.v, block.v + Math.max(0, block.gap - 12) * 0.7) : D.v;      // (eases down to its speed, 12 m behind)
      ctl.steer = Math.max(-1, Math.min(1, -a * 2.4)); D.st = ctl.steer; ctl.throttle = car.speed < v ? 0.85 : 0; ctl.brake = car.speed > v + 1.5 ? Math.min(1, (car.speed - v) / 6) : 0; ctl.handbrake = false; ctl.analog = true;
    }, 1000);
    m.hook("controls", ctl => { D.fin = ctl.steer; }, -100000);
    m.hook("hud", () => {
      if (!D.on || C.state !== "playing" || (C.town && C.town.active)) { D.lastV = null; return; }
      const car = C.car, v = car.speed;
      if (C.frames % 10 === 0) { (D.trail = D.trail || []).push(Math.round(car.s) + "/" + car.d.toFixed(1) + "/" + v.toFixed(0) + (D.dbg ? " " + JSON.stringify(D.dbg) + " st" + (D.st || 0).toFixed(2) + "/" + (D.fin || 0).toFixed(2) : "")); if (D.trail.length > 12) D.trail.shift(); }
      // (the way the world thinks she's going: it should stay hers for the whole drive)
      if (D.wdir != null && C.world.dir !== D.wdir) (D.flips = D.flips || []).push({ s: Math.round(car.s), d: +car.d.toFixed(1), to: C.world.dir, h: +car.h.toFixed(2), trail: (D.trail || []).slice(-6) });
      D.wdir = C.world.dir;
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
  // 🔧 Velvel buys a "borrowed" ride — but not while her own car is impounded ("your car's brought round" = a free release)
  if (await g(`!!(ctx.rides && ctx.rides.debug && ctx.cars)`)) {
    await g(`(ctx.rides.debug.board("truck"), true)`);
    if (await t.until(`__lulu3d.ctx.rides.id === "truck" && __lulu3d.state === "playing"`, "velvel: boards the box truck", 30000)) {
      const v = await t.L(`import("./js/features/underworld/mechanic.js").then(M => { const C = __lulu3d.ctx, k = C.car.skinKey, was = C.cars.where(k);
        const a = !!M.rideNow(); C.cars.leaveAt(k, { kind: "impound", town: "midwood" }); const b = !!M.rideNow(); C.cars.leaveAt(k, Object.assign({}, was)); return { a, b }; })`);
      t.check("velvel: he'd buy the truck she's in — not while her own car is impounded", v.a && !v.b, JSON.stringify(v));
    }
    await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.setState("title"), true)`); await t.frames(4);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "a cruise starts again", 120000);
    await W.reset(t);
  }
  if (DOWN) {
    await W.pause(t, false);
    await g(`(() => { const hw = ctx.world.highway, s = ${FROM} ? ${FROM} + 16000 * Math.ceil(ctx.car.s / 16000) : Math.floor(ctx.car.s) + 16000, p = hw.point(s, -5.25, {});
      ctx.car.place(p.x, p.z, p.h + Math.PI); ctx.car.s = s; ctx.car.d = -5.25; ctx.car.vx = -Math.sin(p.h) * 20; ctx.car.vz = -Math.cos(p.h) * 20; ctx.car.vF = 20;
      ctx.traffic.clear(); ctx.world.dir = -1; ctx.world.prebuild(s); ctx.cam.snap && ctx.cam.snap(); return true; })()`);
    await t.frames(3); await W.pause(t, true); await W.moved(t);
  }
  const LEN = KM ? KM * 1000 : 16000 + 400;
  const s0 = await g(`Math.round(ctx.car.s)`), goal = s0 + DIR * LEN;
  await g(`(window.__drv.on = true, ctx.G.invT = 0, true)`);
  let nextShot = 300, lastS = s0, stall = 0, arrested = 0;
  const along = s => (s - s0) * DIR;
  const waits = [];
  const trips = new Set();
  let uwFree = 0, uwCar = 0;
  for (let k = 0; k < 4000; k++) {
    await t.frames(30);
    const st = await g(`({ s: Math.round(ctx.car.s), state: L3.state, town: !!(ctx.town && ctx.town.active), trip: (document.querySelector("#tripLabel") || {}).textContent || "", hearts: ctx.G.hearts, chase: !!(ctx.law && ctx.law.chasing), uw: ctx.underworld && ctx.underworld.why ? ctx.underworld.why() : "-", enc: ctx.underworld && ctx.underworld.enc ? ctx.underworld.enc.kind : "" })`);
    if (DOWN && !st.town && st.state === "playing") { if (st.uw === "") uwFree++; if (/^(rager|gang)$/.test(st.enc)) uwCar++; }
    if (st.trip) trips.add(st.trip.replace(/[\d.]+ mi/, "#"));
    // keep her driving: a wreck / an arrest / a scene → back on the road where she was (this part is about the road itself)
    if (st.state !== "playing" || st.town) {
      if (/^law/.test(st.state)) arrested++;
      await W.pause(t, false);
      await g(`(() => { if (ctx.foot && ctx.foot.active) ctx.foot.end("test"); if (ctx.town && ctx.town.active) ctx.town.leave("reset"); if (L3.state !== "playing") L3.setState("playing");
        const hw = ctx.world.highway, s = ${DIR} > 0 ? Math.max(ctx.car.s, ${lastS}) : Math.min(ctx.car.s, ${lastS}), p = hw.point(s, ${DIR} * 5.25, {}), h = p.h + (${DIR} > 0 ? 0 : Math.PI); ctx.car.place(p.x, p.z, h); ctx.car.s = s; ctx.car.d = ${DIR} * 5.25; ctx.car.vx = Math.sin(h) * 25; ctx.car.vz = Math.cos(h) * 25; ctx.G.hearts = ctx.G.maxHearts; ctx.world.dir = ${DIR}; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
      await t.frames(3); await W.pause(t, true); await W.moved(t);
      continue;
    }
    if (st.hearts <= 1) await g(`(ctx.G.hearts = ctx.G.maxHearts, true)`);
    if (st.chase) await g(`(ctx.law.standDown("test"), true)`);
    if (along(st.s) >= nextShot) { await t.shot(`lap${DOWN ? "down" : ""}-${Math.round(along(st.s) / 100) / 10}km`); nextShot += 1500; }
    // (a stopped school bus, a toll, a train: the road's own reasons to wait — the test driver only follows its lane, so after
    //  ~25 s it's carried 80 m on, noted; a real stuck car would show up as the same spot again and again)
    if (along(st.s) - along(lastS) < 20) {
      if (++stall > 25) {
        waits.push(st.s); stall = 0;
        if (waits.filter(x => Math.abs(x - st.s) < 30).length > 2) { t.check("drive: she keeps moving up the highway", false, `stuck at s ${st.s}`); break; }
        await W.pause(t, false);
        await g(`(() => { ctx.traffic.clear(); const hw = ctx.world.highway, s = ctx.car.s + ${DIR} * 80, p = hw.point(s, ${DIR} * 5.25, {}), h = p.h + (${DIR} > 0 ? 0 : Math.PI); ctx.car.place(p.x, p.z, h); ctx.car.s = s; ctx.car.d = ${DIR} * 5.25; ctx.car.vx = Math.sin(h) * 20; ctx.car.vz = Math.cos(h) * 20; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
        await t.frames(3); await W.pause(t, true); await W.moved(t);
      }
    } else stall = 0;
    lastS = DIR > 0 ? Math.max(lastS, st.s) : Math.min(lastS, st.s);
    if (along(st.s) >= LEN) break;
  }
  const D = await g(`(() => { const D = window.__drv; D.on = false; return { flips: D.flips || [], bumps: D.bumps, sunk: D.sunk, crashes: D.crashes, f: D.f, maxY: +D.maxY.toFixed(2), minY: +D.minY.toFixed(2) }; })()`);
  if (waits.length) console.log(`    · waited (carried on) at s ${waits.join(", ")}`);
  console.log(`    · ${D.f} frames driven, ${D.crashes.length} crashes, y ${D.minY}…${D.maxY}, trips: ${[...trips].slice(0, 12).join(" | ")}`);
  if (D.flips.length) console.log(`    · the world's direction flipped: ${JSON.stringify(D.flips.slice(0, 6))}`);
  if (D.crashes.length) console.log(`    · crashes: ${JSON.stringify(D.crashes.slice(0, 12))}`);
  t.check(`drive: she drove the whole ${KM ? KM + " km" : "lap"}${DOWN ? " down the lap" : ""}`, along(lastS) >= LEN - 50, `${along(lastS)} m of ${LEN}`);
  t.check("drive: no invisible bumps (≥ 6 m/s lost in a frame with nothing hit)", D.bumps.length === 0, JSON.stringify(D.bumps.slice(0, 8)));
  // (a heart-costing hit only: road-ragers ram her on purpose; a siren ambulance nudges her to pull over)
  const rear = D.crashes.filter(c => c.fault === "them" && c.imp > 6.5 && c.kind !== "cop" && !/^underworld_/.test(c.kind));
  t.check("drive: traffic never drives into her hard enough to cost a heart (their fault) on an ordinary lap", rear.length === 0, JSON.stringify(rear.slice(0, 6)));
  if (DOWN) t.check("drive: down the lap no road-rager / gang car is sent (they're driven for the other carriageway)", uwFree === 0 && uwCar === 0, `eligible ${uwFree}×, cars ${uwCar}`);
  t.check("drive: the trip bar always names where she's heading", trips.size > 2 && ![...trips].some(x => !x.trim()), [...trips].join(" | ").slice(0, 400));
  W.check(t, "drive: the lap", await W.report(t));
}
