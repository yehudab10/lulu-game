// 🚗 The road sweep (ci/sweep-road, 3d/docs/sweeps/sweep-road.md): everything the player does IN A CAR.
// Parts (SWEEPROAD_PART=crash,… picks some locally; CI runs the file whole):
//   crash   who was moving into whom: a cruiser in traffic that rear-ends HER on her last heart is not her
//           "DESTROYING A POLICE CRUISER" (law's wreck hook, the cameos' crash scene); her ramming a stopped cruiser
//           still is; a car she just passed brakes for her when she stops instead of ploughing into her
const W = require("../lib/qawatch.js");

module.exports = {
  name: "sweeproad",
  parts: ["crash"],
  query: "&enable=law,cameos,foot",
  save2d: { totalCoins: 2000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const PART = process.env.SWEEPROAD_PART ? process.env.SWEEPROAD_PART.split(",") : this.parts;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 400)); } };
    if (PART.includes("crash")) await step("crash", () => crash(t));
  },
};

/** A fresh cruise, traffic off, her car stopped in the right lane at s. */
async function standstill(t) {
  const g = t.game;
  if (await g(`L3.state !== "playing"`)) {
    await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.startRun({ mode: "cruise" }), true)`);
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
  await g(`L3.startRun({ mode: "cruise" })`);
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
