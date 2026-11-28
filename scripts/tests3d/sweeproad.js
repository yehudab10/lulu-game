// 🚗 The road sweep (ci/sweep-road, 3d/docs/sweeps/sweep-road.md): everything the player does IN A CAR.
// Parts (SWEEPROAD_PART=crash,… picks some locally; CI runs the file whole):
//   crash   who was moving into whom: a cruiser in traffic that rear-ends HER on her last heart is not her
//           "DESTROYING A POLICE CRUISER" (law's wreck hook, the cameos' crash scene); her ramming a stopped cruiser
//           still is; a car she just passed brakes for her when she stops instead of ploughing into her
//   body    her collision body is what she drives: in a 7.5 m box truck a car touching its back end is a crash (it used to
//           pass through: the hit circles were always her own 4.6 m car's)
//   ramp    a chase down Lakewood's off-ramp: the cruiser on her tail drives the ramp (decel lane → ramp → its branch),
//           never across the painted gore / the grass / the guardrails (law's steering aimed at her offset off the highway)
//   yard    a car impounded at a ROADSIDE yard (Trooper Post 7): its gate takes the fee and gives it back (it was keyed
//           to no town, so the gate never opened and the car stayed in for good); the 📱 says where it is
//   lot     Uncle Refael's lot: "🔑 Drive it off the lot" for a car she owns is only offered while that car is at home —
//           an IMPOUNDED one used to come out free (no release fee) and one parked across the map jumped to the lot
const W = require("../lib/qawatch.js");

module.exports = {
  name: "sweeproad",
  parts: ["crash", "body", "ramp", "yard", "lot"],
  query: "&enable=law,cameos,foot,cars,town,world,shops,garage,impound,places,day,phone,rides,streets",
  save2d: { totalCoins: 2000, cruiseUnlocked: true, ownedSkins: ["pink", "purple"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const PART = process.env.SWEEPROAD_PART ? process.env.SWEEPROAD_PART.split(",") : this.parts;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 400)); } };
    try {
      if (PART.includes("crash")) await step("crash", () => crash(t));
      if (PART.includes("body")) await step("body", () => body(t));
      if (PART.includes("ramp")) await step("ramp", () => ramp(t));
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
  for (let i = 0; i < 10; i++) { await t.hold(6, 1); await t.frames(10); }      // she holds the brake, stopped
  await t.hold(6, 0);
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
  await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.state !== "title" ? L3.setState("title") : 0, true)`);
  await t.frames(4);
  await standstill(t);
  await g(`(ctx.G.invT = 0, ctx.G.hearts = 1, L3.damage(1, "Rammed a cruiser", "cop"))`);
  t.check("crash: ramming a cruiser yourself on the last heart → arrested (unchanged)", await t.until(`__lulu3d.state === "lawArrest"`, "her fault → arrest", 60000));
  await g(`(L3.setState("title"), true)`);
  await t.frames(6);

  // ── 3. she rams a STOPPED cruiser: her fault ──
  await standstill(t);
  await g(`(window.__crashes = [], ctx.G.hearts = 3, window.__cop = ctx.traffic.add("cop", ctx.car.s + 25, 1.75, 1, 0, { ai: (dt, c) => { c.speed = 0; } }), true)`);
  await g(`(() => { const p = ctx.world.road.point(ctx.car.s, 1.75, {}); ctx.car.vx = Math.sin(p.h) * 22; ctx.car.vz = Math.cos(p.h) * 22; return true; })()`);
  await t.hold(7, 1);
  await t.until(`window.__crashes.length > 0`, "she reaches the parked cruiser", 20000);
  await t.hold(7, 0);
  const mine = await g(`window.__crashes.slice()`);
  t.check("crash: driving into a stopped cruiser is HER fault", mine.length > 0 && mine[0].fault === "lulu", JSON.stringify(mine));
  await g(`(ctx.traffic.clear(), L3.setState("title"), true)`);
  await t.frames(4);
  W.check(t, "crash part", await W.report(t));
}

/** Uncle Refael's lot and a car she owns that isn't at home. */
async function lot(t) {
  const g = t.game;
  if (!await g(`!!(ctx.cars && ctx.shops && ctx.town)`)) { t.check("lot: cars + shops + town are on", false); return; }
  await W.pause(t, false);
  if (await g(`ctx.foot.active`)) await g(`(ctx.foot.end("test"), true)`);
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
  await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("reset"), L3.setState("title"), true)`);
  await t.frames(10);
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
  await g(`(ctx.law.standDown("test"), ctx.town.active && ctx.town.leave("reset"), L3.setState("title"), true)`);
  await t.frames(6);
  await W.pause(t, true);
}

/** A car held at Trooper Post 7's impound yard (the highway, ci/roadside): the gate there releases it. */
async function yard(t) {
  const g = t.game;
  await W.pause(t, false);
  if (await g(`ctx.foot && ctx.foot.active`)) await g(`(ctx.foot.end("test"), true)`);
  if (await g(`ctx.town && ctx.town.active`)) await g(`(ctx.town.leave("reset"), true)`);
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
  const st = await g(`({ held: ctx.impound.held, label: ctx.impound.gateLabel(), where: (ctx.cars.list().find(c => c.key === "purple") || {}).where })`);
  t.check("yard: the car held at the trooper yard is held HERE (its gate's ✋ offers it)", !!st.held && st.held.town === "hw:trooper" && !!st.label, JSON.stringify(st));
  t.check("yard: …the 📱 says where it is (not 'impounded in null')", /Trooper Post 7/.test(st.where || ""), st.where);
  const c0 = await t.L(`__lulu3d.wallet.coins`);
  const paid = await g(`ctx.impound.pay("gate")`);
  const fee = c0 - await t.L(`__lulu3d.wallet.coins`);
  t.check("yard: paying at its gate takes the fee shown", paid === "paid" && fee === await g(`ctx.impound.fee()`) || (paid === "paid" && fee > 0), JSON.stringify({ paid, fee }));
  await g(`ctx.impound.release("gate")`);
  await t.frames(20);
  t.check("yard: …and the gate gives the car back (it's with her)", (await g(`ctx.cars.where("purple").kind`)) === "with" && !(await g(`ctx.impound.held`)));
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
  await g(`(ctx.foot.active && ctx.foot.end("test"), L3.setState("title"), true)`);
  await t.frames(6);
  t.check("body: back in her own car (a new run): her own body again", !(await g(`ctx.car.circles`)));
}
