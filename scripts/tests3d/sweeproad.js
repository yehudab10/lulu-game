// 🚗 The road sweep (ci/sweep-road, 3d/docs/sweeps/sweep-road.md): everything the player does IN A CAR.
// Parts (SWEEPROAD_PART=crash,… picks some locally; CI runs the file whole):
//   crash   who was moving into whom: a cruiser in traffic that rear-ends HER on her last heart is not her
//           "DESTROYING A POLICE CRUISER" (law's wreck hook, the cameos' crash scene); her ramming a stopped cruiser
//           still is; a car she just passed brakes for her when she stops instead of ploughing into her
//   body    her collision body is what she drives: in a 7.5 m box truck a car touching its back end is a crash (it used to
//           pass through: the hit circles were always her own 4.6 m car's)
//   ramp    a chase down Lakewood's off-ramp: the cruiser on her tail drives the ramp (decel lane → ramp → its branch),
//           never across the painted gore / the grass / the guardrails (law's steering aimed at her offset off the highway)
//   bolo    someone CALLS IN her car in town: the cruiser that comes looking prowls round where the call came from — it
//           used to drive the street grid straight to her car, wherever she'd gone
//   yard    a car impounded at a ROADSIDE yard (Trooper Post 7): its gate takes the fee and gives it back (it was keyed
//           to no town, so the gate never opened and the car stayed in for good); the 📱 says where it is
//   lot     Uncle Refael's lot: "🔑 Drive it off the lot" for a car she owns is only offered while that car is at home —
//           an IMPOUNDED one used to come out free (no release fee) and one parked across the map jumped to the lot
const W = require("../lib/qawatch.js");

module.exports = {
  name: "sweeproad",
  parts: ["crash", "body", "ramp", "bolo", "yard", "lot"],
  query: "&enable=law,cameos,foot,cars,town,world,shops,garage,impound,places,day,phone,rides,streets,exits,fuel",
  save2d: { totalCoins: 2000, cruiseUnlocked: true, ownedSkins: ["pink", "purple"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const PART = process.env.SWEEPROAD_PART ? process.env.SWEEPROAD_PART.split(",") : this.parts;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 400)); } };
    await W.install(t);
    try {
      if (PART.includes("crash")) await step("crash", () => crash(t));
      if (PART.includes("body")) await step("body", () => body(t));
      if (PART.includes("ramp")) await step("ramp", () => ramp(t));
      if (PART.includes("bolo")) await step("bolo", () => bolo(t));
      if (PART.includes("yard")) await step("yard", () => yard(t));
      if (PART.includes("lot")) await step("lot", () => lot(t));
    } finally { W.dropRelayErrors(t); }
  },
};

/** A fresh cruise, traffic off, her car stopped in the right lane at s. */
async function standstill(t) {
  const g = t.game;
  if (await g(`L3.state !== "playing"`)) {
    await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.startRun({ mode: "cruise", quick: true }), true)`);
    await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 120000);
  }
  await g(`(() => { ctx.traffic.config.enabled = false; ctx.traffic.clear(); const r = ctx.world.road, s = ctx.car.s + 30, p = r.point(s, 1.75, {});
    ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = 0; ctx.car.vz = 0; ctx.G.invT = 0; return true; })()`);
  await W.moved(t);
  await t.frames(3);
}

async function crash(t) {
  const g = t.game;
  await W.install(t);
  if (!await t.until(`__lulu3d.state === "title"`, "title")) return;
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts", 120000)) return;
  await g(`(ctx.cameos && (ctx.cameos.force.scene = false), true)`);

  // ── 1. a plain car she just passed: she stops, it brakes behind her (no heart, no "Tailgating") ──
  await standstill(t);
  await g(`(window.__crashes = [], L3.on("crash", e => window.__crashes.push({ kind: e.kind, fault: e.fault, imp: +e.impact.toFixed(1) })), window.__sedan = ctx.traffic.add("sedan", ctx.car.s - 60, 1.75, 1, 24), true)`);
  const h0 = await g(`ctx.G.hearts`);
  // she sits still (no pedals: holding the brake at a stop would REVERSE her into it)
  for (let i = 0; i < 10; i++) { await g(`(ctx.car.vx = ctx.car.vz = 0, ctx.car.vF = 0, true)`); await t.frames(10); }
  const after = await g(`({ hearts: ctx.G.hearts, crashes: window.__crashes.slice(), gap: +(ctx.car.s - __sedan.s).toFixed(1), sp: +__sedan.speed.toFixed(1), d: +__sedan.d.toFixed(2) })`);
  t.check("traffic: a car coming up behind her stopped car brakes (or goes round) — no crash", after.crashes.length === 0 && after.hearts === h0, JSON.stringify(after));

  // ── 2. a cruiser in traffic rear-ends HER on her last heart: not her fault, no arrest ──
  await standstill(t);
  await g(`(window.__crashes = [], ctx.G.hearts = 1, ctx.G.invT = 0, window.__cop = ctx.traffic.add("cop", ctx.car.s - 14, 1.75, 1, 27, { ai: (dt, c) => { c.s += c.speed * dt; } }), true)`);
  await t.until(`window.__crashes.length > 0 || __lulu3d.state !== "playing"`, "the cruiser reaches her", 20000);
  const hit = await g(`({ crashes: window.__crashes.slice(), info: ctx.G.wreckInfo, state: L3.state })`);
  t.check("crash: a cruiser driving into her stopped car is THEIR fault (traffic.js e.fault)", hit.crashes.length > 0 && hit.crashes[0].fault === "them", JSON.stringify(hit));
  let states = new Set();
  for (let i = 0; i < 40; i++) { states.add(await g(`L3.state`)); await t.frames(8); }
  const charges = await t.L(`(document.querySelector("#lawUI .law-head") || {}).textContent || ""`);
  t.check("crash: …so her last heart going doesn't get her arrested for DESTROYING A POLICE CRUISER", !states.has("lawArrest") && !/DESTROYING/.test(charges), [...states].join(","));
  t.check("crash: …the wreck remembers whose fault it was", hit.info && hit.info.fault === "them" || (await g(`ctx.G.wreckInfo && ctx.G.wreckInfo.fault`)) === "them");
  // the law hook alone, both ways (no physics)
  await W.pause(t, false);
  await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.state !== "title" ? L3.setState("title") : 0, true)`);
  await t.frames(4);
  await standstill(t);
  await W.pause(t, true);
  await g(`(ctx.G.invT = 0, ctx.G.hearts = 1, L3.damage(1, "Rammed a cruiser", "cop"))`);
  t.check("crash: ramming a cruiser yourself on the last heart → arrested (unchanged)", await t.until(`__lulu3d.state === "lawArrest"`, "her fault → arrest", 60000));
  await W.pause(t, false);
  await g(`(L3.setState("title"), true)`);
  await t.frames(6);

  // ── 3. she rams a STOPPED cruiser: her fault ──
  await standstill(t);
  await W.pause(t, true);
  await g(`(window.__crashes = [], ctx.G.hearts = 3, window.__cop = ctx.traffic.add("cop", ctx.car.s + 25, 1.75, 1, 0, { ai: (dt, c) => { c.speed = 0; } }), true)`);
  await g(`(() => { const p = ctx.world.road.point(ctx.car.s, 1.75, {}); ctx.car.vx = Math.sin(p.h) * 22; ctx.car.vz = Math.cos(p.h) * 22; return true; })()`);
  await t.hold(7, 1);
  await t.until(`window.__crashes.length > 0`, "she reaches the parked cruiser", 20000);
  await t.hold(7, 0);
  const mine = await g(`window.__crashes.slice()`);
  t.check("crash: driving into a stopped cruiser is HER fault", mine.length > 0 && mine[0].fault === "lulu", JSON.stringify(mine));
  await W.pause(t, false);
  await g(`(ctx.traffic.clear(), L3.setState("title"), true)`);
  await t.frames(4);
  W.check(t, "crash part", await W.report(t));
  // 🚓 the haul + booking captions name the precinct she's taken to (they said PRECINCT 18½ everywhere)
  const pn = await t.L(`import("./js/features/law/ui.js").then(U => { const S = __lulu3d.ctx.civic.debug.STAY, was = S.place;
    S.place = { kind: "law", id: "midwood" }; const a = U.precinctName(); S.place = { kind: "law", hw: "trooper", id: "trooper", s: 6800 }; const b = U.precinctName(); S.place = was; return [a, b]; })`);
  t.check("law: hauled to Midwood → '70½TH PRECINCT'; to the highway post → 'TROOPER POST 7'", pn[0] === "70½TH PRECINCT" && pn[1] === "TROOPER POST 7", JSON.stringify(pn));
}


/** From the title: pink is the car she uses, purple waits at home (a run can start in whichever car is at home). */
async function pinkInHand(t) {
  const g = t.game;
  await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), ctx.town && ctx.town.active && ctx.town.leave("reset"), L3.state !== "title" ? L3.setState("title") : 0, true)`);
  await t.frames(4);
  await t.L(`import("./js/features/garage/buy.js").then(m => (m.equipSkin("pink"), true))`);
  await g(`(ctx.cars && ctx.cars.leaveAt("purple", { kind: "home" }), true)`);
  await t.frames(2);
}
/** Uncle Refael's lot and a car she owns that isn't at home. */
async function lot(t) {
  const g = t.game;
  if (!await g(`!!(ctx.cars && ctx.shops && ctx.town)`)) { t.check("lot: cars + shops + town are on", false); return; }
  await W.pause(t, false);
  await pinkInHand(t);
  if (await g(`L3.state !== "playing"`)) {
    await g(`(L3.state !== "title" ? L3.setState("title") : 0, true)`); await t.frames(4);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "lot: a cruise starts", 120000);
  }
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.town.load("lakewood"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "lot: Lakewood's models load", 120000);
  await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
  if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "lot: into Lakewood", 20000)) return;
  await t.frames(20);
  await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  await t.until(`__lulu3d.state === "footRun"`, "lot: out on foot", 10000);
  await g(`(() => { const sp = ctx.town.spot("lot_purple"), F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 0.6, 0.05, sp.z + sp.nz * 0.6); F.phase = "walk"; return true; })()`);
  await t.frames(6);
  // her purple car is IMPOUNDED in Midwood (an arrest there)
  await g(`(ctx.cars.leaveAt("purple", { kind: "impound", town: "midwood" }), true)`);
  const buttons = () => t.L(`[...document.querySelectorAll("#screenCard button")].filter(b => b.offsetParent).map(b => b.textContent.trim())`);
  t.check("lot: (she came in her pink car)", (await g(`ctx.car.skinKey`)) === "pink");
  await g(`ctx.shops.debug.dealer.openLot("purple")`);
  await t.until(`!!document.querySelector("#screenCard .sp")`, "lot: the car card opens", 10000);
  await t.frames(6);
  const b1 = await buttons();
  t.check("lot: an IMPOUNDED car she owns can't be driven off Refael's lot (no free release)", !b1.some(x => /Drive it off the lot/.test(x)), b1.join(" | "));
  await t.shot("lot-impounded");
  await g(`(document.querySelector('#screenCard .dp-opt[data-opt="purple"]') && document.querySelector('#screenCard .dp-opt[data-opt="purple"]').click(), true)`);
  await t.frames(4);
  const said = await t.L(`(document.getElementById("screenCard") || {}).textContent || ""`);
  t.check("lot: …the card says where it is instead", /impounded in Midwood/i.test(said), said.slice(0, 300));
  t.check("lot: …and it's still impounded", (await g(`ctx.cars.where("purple").kind`)) === "impound");
  // the same rule for the dealerships' "🔑 Drive this one" (Mazelati / Tushla): garage/buy.js carAway
  const away = await t.L(`import("./js/features/garage/buy.js").then(m => [m.carAway("purple"), m.carAway("pink")])`);
  t.check("lot: carAway says where an impounded car is (the dealerships' Drive-this-one asks it) — '' for the one she has", /impounded in Midwood/.test(away[0]) && away[1] === "", JSON.stringify(away));
  await t.tap(1); await t.frames(10);
  // at home: the old way still works
  await g(`(ctx.cars.leaveAt("purple", { kind: "home" }), true)`);
  if (await g(`L3.state === "footRun" && !document.querySelector("#screenCard .sp")`)) {
    await g(`ctx.shops.debug.dealer.openLot("purple")`);
    await t.until(`!!document.querySelector("#screenCard .sp")`, "lot: the card opens again", 10000);
    await t.frames(6);
    const b2 = await buttons();
    t.check("lot: a car she owns that's AT HOME can still be driven off the lot", b2.some(x => /Drive it off the lot/.test(x)), b2.join(" | "));
    await t.tap(1); await t.frames(10);
  }
  // the title's 🚗 Car switch: the same rule (it cycled every car she owns, wherever it was)
  await pinkInHand(t);
  await t.frames(6);
  await g(`(ctx.cars.leaveAt("purple", { kind: "impound", town: "midwood" }), true)`);
  const k0 = await g(`ctx.car.skinKey`);
  await t.click(/Car:/);
  await t.frames(4);
  const after = await g(`({ skin: ctx.car.skinKey, purple: ctx.cars.where("purple").kind })`);
  t.check("title: the 🚗 Car switch skips a car that's impounded (it stays impounded)", after.skin === k0 && after.purple === "impound", JSON.stringify(after));
  await g(`(ctx.cars.leaveAt("purple", { kind: "home" }), true)`);
  await t.click(/Car:/);
  await t.frames(4);
  t.check("title: …and still switches to a car at home", (await g(`ctx.car.skinKey`)) === "purple");
  // 🔧 Shmuel doesn't offer a chop job while her own car is impounded ("his guy brings your car round" = a free release)
  const chop = await g(`(() => { const k = ctx.car.skinKey; ctx.cars.leaveAt(k, { kind: "impound", town: "midwood" }); const a = !!ctx.streets.chop.request({ instant: true });
    ctx.cars.leaveAt(k, { kind: "with" }); const b = !!ctx.streets.chop.request({ instant: true }); ctx.streets.debug.CHOP.job = null; return { a, b }; })()`);
  t.check("chop: no chop-shop job while her own car is impounded (one when it isn't)", !chop.a && chop.b, JSON.stringify(chop));
  await W.pause(t, true);
}

/** A chase down a town exit's off-ramp: where does the cruiser drive? */
async function ramp(t) {
  const g = t.game;
  await W.pause(t, false);
  if (await g(`ctx.foot && ctx.foot.active`)) await g(`(ctx.foot.end("test"), true)`);
  if (await g(`ctx.town && ctx.town.active`)) await g(`(ctx.town.leave("reset"), true)`);
  if (await g(`L3.state !== "playing"`)) {
    await g(`(L3.state !== "title" ? L3.setState("title") : 0, true)`); await t.frames(4);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "ramp: a cruise starts", 120000);
  }
  // the cops' "not hidden" tip (key law:hint) can be taken down once it stops being true (hud.dropToast)
  await t.L(`import("./js/hud.js").then(H => { H.toast("🚨 TEST: you're not hidden", "red", { key: "law:hint" }); return true; })`);
  await t.frames(6);
  const up = await t.L(`[...document.querySelectorAll(".toast")].some(e => /TEST: you're not hidden/.test(e.textContent) && !e.classList.contains("out"))`);
  await t.L(`import("./js/hud.js").then(H => (H.dropToast("law:hint"), true))`);
  await t.frames(20);
  const gone = await t.L(`![...document.querySelectorAll(".toast")].some(e => /TEST: you're not hidden/.test(e.textContent) && !e.classList.contains("out"))`);
  t.check("hud: a toast whose words stopped being true can be taken down (the cops' 'not hidden' tip once she hides)", up && gone, JSON.stringify({ up, gone }));
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.town.load("lakewood"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "ramp: Lakewood's models load", 120000);
  const E = await g(`ctx.town.debug.exitAhead(900)`);
  if (!t.check("ramp: Lakewood's exit planned ahead", E > 0, String(E))) return;
  // the test driver (a controls hook: the player's own steering) down the ramp to the stop line
  await t.L(`import("./js/core/ctx.js").then(m => { if (window.__rdrv) return; window.__rdrv = true; m.hook("controls", (ctl, dt) => { const W = window.__route; if (!W || !W.pts.length) return; const car = m.ctx.car;
      const p = W.pts[0]; if (Math.hypot(p.x - car.pos.x, p.z - car.pos.z) < (W.r || 4)) { W.pts.shift(); if (!W.pts.length) return; }
      const q = W.pts[0], want = Math.atan2(q.x - car.pos.x, q.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < (W.v || 9) ? 0.7 : 0; ctl.brake = car.speed > (W.v || 9) + 3 ? 0.4 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000); })`);
  await g(`(() => { const s = ${E} - 520, p = ctx.world.highway.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25;
    ctx.car.vx = Math.sin(p.h) * 20; ctx.car.vz = Math.cos(p.h) * 20; ctx.car.vF = 20; ctx.world.prebuild(s); ctx.cam.snap(); ctx.G.invT = 99; return true; })()`);
  await W.moved(t);
  await g(`(window.__route = { pts: ctx.town.debug.rampRoute(${E}, 0, -500).map(([u, d]) => ctx.world.highway.point(${E} + u, d, {})).map(p => ({ x: p.x, z: p.z })), v: 17, r: 5 }, true)`);
  await g(`(ctx.law.startChase("SPEEDING", { msg: "🚨 TEST" }), true)`);
  // every few frames: where is each chasing cruiser? (on the highway's asphalt, or on a paved exit lane)
  const off = [], seen = [];
  for (let k = 0; k < 90; k++) {
    await t.frames(5);
    const r = await t.L(`import("./js/world.js").then(m => { const C = __lulu3d.ctx, hw = C.world.highway, out = [];
      for (const u of C.law._dbg.L.units) { if (!u.car || u.mode !== "chase" || u.car.hit) continue; const n = hw.nearest(u.car.x, u.car.z, u.car.s, {});
        const uu = n.s - ${E}; out.push({ u: Math.round(uu), d: +n.d.toFixed(1), ok: Math.abs(n.d) <= 8.8 || m.pavedAt(n.s, n.d) >= 2 }); }
      return { me: Math.round(C.car.s - ${E}), town: C.town.active, st: C.state, cops: out }; })`);
    seen.push(r.cops.length);
    for (const c of r.cops) if (!c.ok && c.u > -240 && c.u < 175) off.push(c);
    if (r.town || r.st !== "playing" || (!r.cops.length && k > 30)) break;
    if (r.me > 150 && k % 6 === 0) await t.shot("ramp-chase-" + r.me);
  }
  await g(`(window.__route = null, true)`);
  t.check("ramp: a cruiser chased her down the ramp", seen.some(n => n > 0), seen.join(","));
  t.check("ramp: …on the decel lane / ramp, never across the gore or the grass", off.length === 0, JSON.stringify(off.slice(0, 8)));
  // BUSTED on the ramp: she stops where she is (law's pull-over used to steer her back across the grass to the highway's
  // shoulder) and the cruiser pulls up behind her on the ramp
  await g(`(window.__route = null, ctx.law.standDown("test"), ctx.town.active && ctx.town.leave("reset"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`);
  await t.frames(10);
  // (law's pull-over asks "pullOverSpot": on the ramp → stop right here; on the highway → law's own shoulder)
  const po = await t.L(`import("./js/features/law/bust.js").then(B => { const C = __lulu3d.ctx, hw = C.world.highway, car = C.car, E = ${E}, keep = { x: car.pos.x, z: car.pos.z, s: car.s, d: car.d, h: car.h };
    const at = (u, d) => { const p = hw.point(E + u, d, {}); car.place(p.x, p.z, p.h); car.s = E + u; car.d = d; return !!B.pullOverSpot(car); };
    const ramp = at(70, C.town.debug.rampRoute(E, 0, 70)[0][1]), hwy = at(-400, 5.25);
    car.place(keep.x, keep.z, keep.h); car.s = keep.s; car.d = keep.d; return { ramp, hwy }; })`);
  await W.moved(t);
  t.check("ramp: busted ON the ramp she stops where she is (law's pull-over used to steer her back across the grass to the shoulder)", po.ramp && !po.hwy, JSON.stringify(po));
  await g(`(ctx.law.standDown("test"), ctx.town.active && ctx.town.leave("reset"), true)`);
  await t.frames(30);
  // ── the same into a REST AREA: down its off-ramp into the drive aisle ──
  if (await g(`!!(ctx.exits && ctx.exits.debug && ctx.exits.debug.restAhead)`)) {
    await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.law._dbg.L.units.length = 0, ctx.traffic.clear(), true)`);
    const R = await g(`ctx.exits.debug.restAhead(900)`);
    if (t.check("ramp: a rest area planned ahead", R > 0, String(R))) {
      await g(`(() => { const s = ${R} - 520, p = ctx.world.highway.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25;
        ctx.car.vx = Math.sin(p.h) * 20; ctx.car.vz = Math.cos(p.h) * 20; ctx.car.vF = 20; ctx.world.prebuild(s); ctx.cam.snap(); ctx.G.invT = 99; return true; })()`);
      await W.moved(t);
      // her line: the right lane → the decel lane → the off-ramp → the drive aisle (d 27) to the pumps
      await g(`(() => { const P = []; for (let u = -500; u <= 190; u += 10) { const d = u < -190 ? 5.25 : u < -80 ? 5.25 + 3.65 * (u + 190) / 110 : u <= 10 ? 8.9 + 18.1 * Math.min(1, Math.max(0, (u + 80) / 90)) : 27; const p = ctx.world.highway.point(${R} + u, d, {}); P.push({ x: p.x, z: p.z }); } window.__route = { pts: P, v: 15, r: 5 }; return true; })()`);
      await g(`(ctx.law.startChase("SPEEDING", { msg: "🚨 TEST" }), true)`);
      const off2 = [], seen2 = [];
      for (let k = 0; k < 80; k++) {
        await t.frames(5);
        const r = await t.L(`import("./js/features/exits/layout.js").then(LY => { const C = __lulu3d.ctx, hw = C.world.highway, out = [];
          for (const u of C.law._dbg.L.units) { if (!u.car || u.mode !== "chase" || u.car.hit) continue; const n = hw.nearest(u.car.x, u.car.z, u.car.s, {});
            const uu = n.s - ${R}; out.push({ u: Math.round(uu), d: +n.d.toFixed(1), ok: Math.abs(n.d) <= 8.8 || LY.groundAt(uu, n.d) >= 2 }); }
          return { me: Math.round(C.car.s - ${R}), st: C.state, cops: out }; })`);
        seen2.push(r.cops.length);
        for (const c of r.cops) if (!c.ok && c.u > -200 && c.u < 230) off2.push(c);
        if (r.st !== "playing" || r.me > 185 || (!r.cops.length && k > 30)) break;
      }
      await g(`(window.__route = null, true)`);
      const po2 = await t.L(`import("./js/features/law/bust.js").then(B => { const C = __lulu3d.ctx, hw = C.world.highway, car = C.car, keep = { x: car.pos.x, z: car.pos.z, s: car.s, d: car.d, h: car.h };
        const p = hw.point(${R} + 100, 33, {}); car.place(p.x, p.z, p.h); car.s = ${R} + 100; car.d = 33; const r = !!B.pullOverSpot(car);
        car.place(keep.x, keep.z, keep.h); car.s = keep.s; car.d = keep.d; return r; })`);
      await W.moved(t);
      t.check("ramp: busted in a rest area's lot she stops where she is", po2, String(po2));
      t.check("ramp: into a rest area too, the cruiser keeps to its ramp + aisle (not across the grass)", seen2.some(n => n > 0) && off2.length === 0, JSON.stringify(off2.slice(0, 8)) + " · " + seen2.slice(0, 20).join(","));
      await g(`(ctx.law.standDown("test"), true)`);
    }
  }
  await g(`(L3.setState("title"), true)`);
  await t.frames(6);
  await W.pause(t, true);
}

/** A car held at Trooper Post 7's impound yard (the highway, ci/roadside): the gate there releases it. */
async function yard(t) {
  const g = t.game;
  await W.pause(t, false);
  await pinkInHand(t);
  if (await g(`L3.state !== "playing"`)) {
    await g(`(L3.state !== "title" ? L3.setState("title") : 0, true)`); await t.frames(4);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "yard: a cruise starts", 120000);
  }
  // by Trooper Post 7 (lap metre 6800) on this lap, on foot at its impound gate
  await g(`(() => { ctx.traffic.config.enabled = false; ctx.traffic.clear(); const L = 16000, s = Math.floor(ctx.car.s / L) * L + 6800 + (ctx.car.s % L > 6800 ? L : 0) - 30;
    const p = ctx.world.highway.point(s, 9, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 9; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
  await t.frames(10);
  await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  await t.until(`__lulu3d.state === "footRun"`, "yard: out on foot", 10000);
  const sp = await g(`(() => { const sp = ctx.civic.spot("impound"); return sp ? { hw: sp.hw, x: sp.x, z: sp.z, nx: sp.nx, nz: sp.nz } : null; })()`);
  if (!t.check("yard: Trooper Post 7's impound yard is there", !!sp && sp.hw === "trooper", JSON.stringify(sp))) return;
  await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${sp.x} + ${sp.nx} * 0.8, 0.05, ${sp.z} + ${sp.nz} * 0.8); F.phase = "walk"; return true; })()`);
  await g(`(ctx.cars.leaveAt("purple", { kind: "impound", town: "hw:trooper", why: "arrest" }), true)`);
  await t.frames(20);
  t.check("yard: (she came in her pink car; purple is the impounded one)", (await g(`ctx.car.skinKey`)) === "pink");
  const st = await g(`({ held: ctx.impound.held, label: ctx.impound.gateLabel(), where: (ctx.cars.list().find(c => c.key === "purple") || {}).where })`);
  t.check("yard: the car held at the trooper yard is held HERE (its gate's ✋ offers it)", !!st.held && st.held.town === "hw:trooper" && !!st.label, JSON.stringify(st));
  t.check("yard: …the 📱 says where it is (not 'impounded in null')", /Trooper Post 7/.test(st.where || ""), st.where);
  const chip = await t.L(`(document.querySelector(".impound-chip") || {}).textContent || ""`);
  t.check("yard: …and the HUD line says where to go", /Trooper Post 7's yard/.test(chip), chip);
  const c0 = await t.L(`__lulu3d.wallet.coins`);
  const paid = await g(`ctx.impound.pay("gate")`);
  const fee = c0 - await t.L(`__lulu3d.wallet.coins`);
  t.check("yard: paying at its gate takes the fee shown", paid === "paid" && fee === await g(`ctx.impound.fee()`) || (paid === "paid" && fee > 0), JSON.stringify({ paid, fee }));
  await g(`ctx.impound.release("gate")`);
  await t.frames(20);
  t.check("yard: …and the gate gives the car back (it's with her)", (await g(`ctx.cars.where("purple").kind`)) === "with" && !(await g(`ctx.impound.held`)));
  const cd = await g(`+ctx.world.highway.nearest(ctx.car.pos.x, ctx.car.pos.z, ctx.car.s, {}).d.toFixed(1)`);
  t.check("yard: …out in the yard's stalls, not in a highway lane", Math.abs(cd) > 9, String(cd));
  // 📸 a Lakewood speed-camera ticket is mailed by Lakewood (it said "the Borough of Midwood" for every ticket)
  const mail = await t.L(`import("./js/features/cameras/data.js").then(m => [m.L.mailFrom("lakewood"), m.L.mailFrom("midwood"), m.L.court.title({ town: "lakewood", where: "the cheder" })])`);
  t.check("cameras: a Lakewood ticket comes from the City of Lakewood (its court case too)", /Lakewood/.test(mail[0]) && /Midwood/.test(mail[1]) && /^THE CITY/.test(mail[2]), JSON.stringify(mail));
  await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.setState("title"), true)`);
  await t.frames(6);
  await W.pause(t, true);
}

/** Driving a long ride (the box truck): its whole length is solid. */
async function body(t) {
  const g = t.game;
  if (await g(`L3.state !== "playing"`)) {
    await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.state !== "title" ? L3.setState("title") : 0, true)`); await t.frames(4);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "body: a cruise starts", 120000);
  }
  await standstill(t);
  // a parked car 5.2 m behind her centre, in her lane: clear of her own car (its front circle 3.9 m back, her rear one 1.15 m: 2.75 > 0.93 + 0.95) — inside the truck (its rear circle 2.6 m back: 1.3 < 1.25 + 0.95)
  const probe = () => g(`(() => { const r = ctx.world.road, p = r.point(ctx.car.s - 5.2, ctx.car.d, {});
    const c = ctx.traffic.add("sedan", ctx.car.s - 5.2, ctx.car.d, 1, 0, { ai: () => {} }); c.x = p.x; c.z = p.z; c.h = ctx.car.h;
    const x0 = ctx.car.pos.x, z0 = ctx.car.pos.z, vx = ctx.car.vx, vz = ctx.car.vz; ctx.car.vx = -Math.sin(ctx.car.h) * 3; ctx.car.vz = -Math.cos(ctx.car.h) * 3;
    const hit = !!ctx.traffic.collide(c, ctx.car); ctx.car.pos.x = x0; ctx.car.pos.z = z0; ctx.car.vx = vx; ctx.car.vz = vz; ctx.traffic.remove(c); return hit; })()`);
  t.check("body: her own car — a car 5.2 m behind her centre isn't touching", !(await probe()));
  if (!await g(`!!(ctx.rides && ctx.rides.debug)`)) { t.check("body: rides on", false); return; }
  await g(`(ctx.rides.debug.board("truck"), true)`);
  if (!await t.until(`__lulu3d.ctx.rides.id === "truck" && __lulu3d.state === "playing"`, "body: boards the box truck", 30000)) return;
  await t.frames(3);
  const c = await g(`({ circles: ctx.car.circles, r: ctx.car.radius })`);
  t.check("body: in the box truck her hit circles are the truck's (3 along 7.5 m)", !!c.circles && c.circles.length === 3, JSON.stringify(c));
  t.check("body: …so a car at the truck's back end is a crash (it used to pass through)", await probe());
  // ⛽ the truck has its own tank: driving it doesn't drain HER car's (it used to — only a carjacked ride had its own)
  if (await g(`!!ctx.fuel`)) {
    const f0 = await g(`({ key: ctx.fuel.key(), own: ctx.fuel.level(ctx.car.skinKey) })`);
    await g(`(() => { const p = ctx.world.road.point(ctx.car.s, ctx.car.d, {}); ctx.car.vx = Math.sin(p.h) * 25; ctx.car.vz = Math.cos(p.h) * 25; return true; })()`);
    await t.hold(7, 1); await t.frames(60); await t.hold(7, 0);
    const f1 = await g(`({ key: ctx.fuel.key(), own: ctx.fuel.level(ctx.car.skinKey) })`);
    t.check("fuel: in the truck the gauge is the TRUCK's tank, and her own car's stays as it was", /^ride:/.test(f0.key) && f1.own === f0.own, JSON.stringify({ f0, f1 }));
  }
  await g(`(ctx.foot.active && ctx.foot.end("test"), L3.setState("title"), true)`);
  await t.frames(6);
  t.check("body: back in her own car (a new run): her own body again", !(await g(`ctx.car.circles`)));
}

/** A call-in in Lakewood: the cruiser looks for her; it doesn't know where she is. */
async function bolo(t) {
  const g = t.game;
  await W.pause(t, false);
  await pinkInHand(t);
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "bolo: a cruise starts", 120000)) return;
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.town.load("lakewood"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "bolo: Lakewood's models load", 120000);
  await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
  if (!await t.until(`__lulu3d.ctx.town.active`, "bolo: into Lakewood", 20000)) return;
  await t.frames(20);
  await g(`(ctx.town.debug.place("Main St", 60, 1.75, 0, 1), ctx.law.callIn("RECKLESS DRIVING", { delay: 0.2 }), true)`);
  if (!await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.bolo && u.car)`, "bolo: the cruiser comes out looking", 20000)) return;
  // she drives off somewhere else (a far street), quietly
  await g(`(ctx.town.debug.place("County Line Rd", 200, 1.75, 0, 1), ctx.cam.snap && ctx.cam.snap(), true)`);
  await t.frames(90);
  const r = await g(`(() => { const L = ctx.law._dbg.L, u = L.units.find(u => u.bolo && u.car), car = ctx.car.pos; if (!u) return { gone: true, bolo: !!L.bolo };
    return { prowl: !!u.prowl, to: u.prowl ? Math.round(Math.hypot(u.prowl.to.x - car.x, u.prowl.to.z - car.z)) : -1, cop: Math.round(Math.hypot(u.car.x - car.x, u.car.z - car.z)), chase: !!L.chase }; })()`);
  t.check("bolo: the call-in's cruiser prowls (not routed straight to her car)", r.chase || (r.prowl && r.to > 25), JSON.stringify(r));
  await g(`(ctx.law.standDown("test"), ctx.law._dbg.L.bolo && (ctx.law._dbg.L.bolo = null), ctx.town.leave("reset"), L3.setState("title"), true)`);
  await t.frames(6);
  await W.pause(t, true);
}
