// ✈️ JFK STAGE 3 (features/airport/stage3*.js — the owner's decision 8): things to do at the airport.
//   HINT      inside the terminal the bottom hint fits the hall (not foot's "Find a car to borrow")
//   SUITCASE  Mrs. Shpilkes → find her pink suitcase (by the plant) → carry it back → PAY.bag once a real day;
//             the look-alike (Mr. Pilkes doing laps with it) → back again → nothing paid (today's cap)
//   DOVID     forced on: the arrivals doors, the red carpet, the fans, Segal clears a path; ✋ a selfie → PAY.dovid once a
//             real day, the stat (+ the scrapbook badge); he leaves; the hall stays inside its draw-call budget with him in it
//   TAXI      never offered without the airport (stage 1); with a pretend kerb: the 💼 Jobs listing, the pickup, the ride
//             into town, the drop at the landmark → a FIXED fare; the wrong town; the daily cap (not offered past it);
//             a fare booked at the terminal's arrivals door starts when she's back in her car
// Set AIRPORT_STAGE3_PART=hall | taxi to run one part.
const W = require("../lib/qawatch.js");

const PART = process.env.AIRPORT_STAGE3_PART || "all";
const LIMITS = { calls: 110, maxCalls: 130, tris: 140000 };      // the terminal's MEDIUM budget (airport-terminal.js)
const DAY = "2026-11-21";

module.exports = {
  name: "airport-stage3",
  viewport: { width: 1280, height: 720 },
  query: `&enable=airport,interiors,foot,hustle,town,roadevents,banter,meta`,
  save2d: { totalCoins: 300, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { f: { meta: { tutorialDone: true } } },
  async run(t) {
    try {
      if (PART === "all" || PART === "hall") await hall(t);
      if (PART === "all" || PART === "taxi") await taxi(t);
    } catch (e) { t.check("airport-stage3 threw", false, String(e && e.stack || e).slice(0, 500)); }
  },
};

const R = `window.__interiors.room`;
const S3 = `ctx.airport.stage3`;
const coins = t => t.L(`window.__lulu3d.wallet.coins`);
async function helpers(t) {
  await t.game(`(window.__at = {
    room: () => window.__interiors && window.__interiors.room,
    at(id) { const r = this.room(), h = r && r.hots.find(h => h.id === id); if (!h) return false;
      const o = r.lulu.obj; o.position.x = h.x; o.position.z = h.z + Math.min(h.r * 0.5, 0.6); r.collide(o.position, 0.32);
      r.vel.set(0, 0, 0); o.rotation.y = Math.atan2(h.x - o.position.x, h.z - o.position.z); return true; },
    near: () => { const r = window.__interiors.room; return r && r.near ? r.near.id : null; },
    dialog: () => (document.querySelector("#dialog") || {}).textContent || "",
    opts: () => [...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent),
  }, true)`);
}
async function enterHall(t, label = "enter") {
  await t.game(`ctx.airport.terminal.warm()`);
  await t.until(`__lulu3d.ctx.airport.terminal.ready()`, `${label}: the hall warms`, 90000);
  await t.game(`(window.__entered = ctx.airport.debug.enterTerminal(), true)`);
  return t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.def.id === "terminal" && window.__interiors.room.ready`, `${label}: inside the terminal`, 90000);
}
async function leaveHall(t, label) {
  await t.game(`(__at.room().leave(), true)`);
  return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${label}: back outside on foot`, 30000);
}
async function talk(t, untilCode, label, pickRe = null, max = 120, seen = null) {
  for (let i = 0; i < max; i++) {
    if (await t.game(untilCode)) return true;
    const txt = await t.L(`__at.dialog()`);
    if (seen && txt && seen[seen.length - 1] !== txt) seen.push(txt);
    const opts = await t.L(`__at.opts()`);
    if (opts.length && pickRe) {
      const k = opts.findIndex(o => pickRe.test(o));
      if (k >= 0) { await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${k}].click()`); await t.frames(3); continue; }
    }
    await t.tap(0);
  }
  t.check(label, false, "never reached: " + untilCode + " · " + (await t.L(`__at.dialog()`)).slice(0, 120));
  return false;
}
async function use(t, id, label) {
  await t.game(`__at.at(${JSON.stringify(id)})`);
  await t.frames(3);
  const near = await t.game(`__at.near()`);
  t.check(`${label}: ✋ prompt shows`, near === id, `near=${near}`);
  if (near === id) await t.tap(0); else await t.game(`(() => { const r = __at.room(); r.use(r.hots.find(h => h.id === ${JSON.stringify(id)})); return true; })()`);
  await t.frames(3);
}
const idle = `(!ctx.dialogOpen && !__at.room().busy && !__at.room().auto)`;
async function startOnFoot(t) {
  await t.game(`(L3.state !== "title" ? L3.setState("title") : 0, true)`);
  await t.frames(3);
  await t.game(`L3.startRun({ mode: "cruise" })`);
  if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "a run starts", 60000)) return false;
  if (await t.game(`ctx.state === "playing" && !ctx.foot.active`)) await t.game(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 60000);
}

// ═══ the hall: the hint, the lost suitcase, Dovid Dov ═════════════════════
async function hall(t) {
  const g = t.game;
  await t.frames(10);
  t.check("ctx.airport.stage3 + the hall builder", await g(`!!(${S3} && ${S3}.taxi && ctx.airport.terminal)`));
  t.check("the taxi run is a registered side job (hustle)", await g(`!!ctx.hustle && !!ctx.hustle._dbg.J.makers.jfk_taxi`));
  t.check("the scrapbook badge (🎤 Front Row) is registered", await t.L(`import("./js/features/meta/badges.js").then(m => m.BADGES.some(b => b.id === "jfkDovid"))`));
  await g(`(${S3}.debug.date(${JSON.stringify(DAY)}), true)`);
  await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.wanted = []; }); m.save3d.settings.quality = "medium"; window.__lulu3d.ctx.applySettings(); return true; })`);
  if (!await startOnFoot(t)) return;
  t.check("no airport (stage 1 not in): no JFK taxi run offered", await g(`${S3}.taxi.why() !== "" && !ctx.hustle.listed().includes("jfk_taxi")`), await g(`${S3}.taxi.why()`));
  await helpers(t);
  await W.install(t);
  // ── visit 1: the plant suitcase, no Dovid ──
  await g(`(${S3}.debug.bagNext("plant"), ${S3}.debug.dovidNext(false), true)`);
  const footHint = await g(`ctx.G.hint || ""`);
  if (!await enterHall(t, "visit 1")) return;
  await t.frames(20);
  const hint = await g(`ctx.G.hint || ""`), pad = await t.L(`(document.getElementById("padHint") || {}).textContent || ""`);
  t.check("the hint inside fits the terminal (no 'borrow a car')", !/borrow/i.test(hint) && /terminal/i.test(hint) && !/borrow/i.test(pad), `foot: ${footHint} · hall: ${hint} · pad: ${pad}`);
  t.check("no fare at the arrivals door without the airport kerb", await g(`!__at.room().hots.some(h => h.id === "s3_fare")`));
  t.check("no Dovid Dov this visit (forced off)", await g(`${R}.data.s3.dv.phase === "none"`));
  t.check("Mrs. Shpilkes is by ARRIVALS (a named crowd record)", await g(`!!${R}.data.crowd.byId.perl`));
  await t.shot("hint");
  const c0 = await coins(t);
  await use(t, "s3_perl", "Mrs. Shpilkes");
  await talk(t, `__at.opts().some(o => /find it/.test(o))`, "she asks for help", null, 20);
  await talk(t, idle, "…I'll find it!", /find it/, 30);
  t.check("the hunt: her pink suitcase is out there (by the plant)", await g(`(() => { const B = ${R}.data.s3.bag; return B.phase === "hunt" && B.obj.visible && B.obj.position.x < -25; })()`));
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(-23.6, 0, 3.6); r.vel.set(0, 0, 0); return true; })()`);
  await t.frames(12);
  await t.shot("bag-plant");
  await use(t, "s3_bag", "the pink suitcase");
  await talk(t, idle, "found it", null, 20);
  t.check("she carries it (in her hand)", await g(`(() => { const B = ${R}.data.s3.bag; return B.phase === "carry" && !!B.obj.parent && ${R}.inHand === B.obj; })()`));
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(-10.5, 0, -0.9); r.lulu.obj.rotation.y = 0; r.vel.set(0, 0, 0); return true; })()`);
  await t.frames(12);
  await t.shot("bag-carry");
  await use(t, "s3_perl", "give it back");
  await talk(t, idle, "she's un-frazzled", null, 30);
  await t.frames(40);
  const c1 = await coins(t);
  t.check(`returned: +15 💰 once today`, (await g(`${R}.data.s3.bag.phase`)) === "done" && c1 - c0 === 15, `coins ${c0} → ${c1}`);
  await t.shot("bag-return");
  if (!await leaveHall(t, "visit 1")) return;
  t.check("…the hint is put back outside", !/terminal/i.test(await g(`ctx.G.hint || ""`)));
  // ── visit 2: Dovid Dov (forced) + the look-alike suitcase ──
  await g(`(${S3}.debug.bagNext("lookalike"), ${S3}.debug.dovidNext(true), true)`);
  if (!await enterHall(t, "visit 2")) return;
  await helpers(t);
  t.check("Mr. Pilkes is doing laps with a pink suitcase", await g(`(() => { const p = ${R}.data.crowd.byId.pilkes; return !!p && p.bag === "#EC407A" && !!p.path; })()`));
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(3.0, 0, 1.6); r.lulu.obj.rotation.y = Math.PI; r.vel.set(0, 0, 0); return true; })()`);
  await t.until(`${R}.data.s3.dv.phase === "walk"`, "Dovid Dov: the arrivals doors open", 20000);
  t.check("the doors slide open for him", await g(`${R}.data.doorOpen > 0.3 || ${R}.data.doorT > 0`));
  await t.frames(60);
  await t.shot("dovid-arrive");
  await t.until(`${R}.data.s3.dv.phase === "here"`, "…down the red carpet", 60000);
  await t.frames(30);
  const dv = await g(`(() => { const D = ${R}.data.s3.dv, A = ${R}.data.A; return { fans: D.fans.length, dx: D.dov.x, dz: D.dov.z, gx: A.guard.x, gz: A.guard.z, vip: ${R}.hots.find(h => h.id === "vip").enabled(${R}) }; })()`);
  t.check("he's at the end of the carpet, six fans round him", dv.fans === 6 && Math.abs(dv.dx - 3) < 0.2 && Math.abs(dv.dz + 3.5) < 0.2, JSON.stringify(dv));
  t.check("Officer Segal cleared a path (he's by the carpet)", Math.hypot(dv.gx - 5.4, dv.gz) < 0.6, JSON.stringify(dv));
  t.check("the empty-carpet hotspot steps aside for his", dv.vip === false);
  // the budget with him + the fans in the hall (the arrivals view)
  await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true;
      r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; const C = __lulu3d.ctx; if (!(C.view && s === C.view.scene)) return; P.n++;
        P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); }; } return true; })()`);
  await t.L(`(window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0 }, true)`);
  await t.frames(30);
  const pf = await t.L(`(() => { const P = window.__pf; window.__pf = null; return { tier: __lulu3d.ctx.gfx && __lulu3d.ctx.gfx.tier, calls: Math.round(P.calls / Math.max(1, P.n)), maxCalls: P.maxCalls, tris: Math.round(P.tris / Math.max(1, P.n)) }; })()`);
  console.log(`   PERF airport-stage3 (Dovid + fans, arrivals) ${JSON.stringify(pf)}`);
  t.check(`perf with Dovid Dov + fans: ≤ ${LIMITS.calls} calls avg, ≤ ${LIMITS.maxCalls} worst, ≤ ${LIMITS.tris / 1000}k triangles`, pf.calls <= LIMITS.calls && pf.maxCalls <= LIMITS.maxCalls && pf.tris <= LIMITS.tris, JSON.stringify(pf));
  await t.shot("dovid-carpet");
  const d0 = await coins(t);
  await use(t, "s3_dovid", "Dovid Dov");
  await talk(t, `__at.opts().some(o => /selfie/.test(o))`, "he whispers, then asks", null, 20);
  let shot = false;
  for (let i = 0; i < 160; i++) {
    if (!shot && await g(`!!${R}.data.s3.dv.selfie`)) { shot = true; await t.frames(4); await t.shot("dovid-selfie"); }
    if (await g(`/^(leave|gone)$/.test(${R}.data.s3.dv.phase) && ${idle}`)) break;
    const opts = await t.L(`__at.opts()`);
    if (opts.length) { const k = opts.findIndex(o => /selfie/.test(o)); await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${Math.max(0, k)}].click()`); await t.frames(3); continue; }
    await t.tap(0);
  }
  t.check("the selfie happened (flash + confetti)", shot);
  await t.frames(40);
  const d1 = await coins(t), DV = await g(`(() => { const D = ${R}.data.s3.dv; return { phase: D.phase, pay: D.pay, choice: D.choice }; })()`);
  t.check("once today: +10 💰 gas money", DV.pay === 10 && d1 - d0 === 10, `${JSON.stringify(DV)} coins ${d0} → ${d1}`);
  t.check("…then he leaves (his car's here)", /leave|gone/.test(DV.phase));
  t.check("the stat for the badge (shared save: airportDovid)", await t.until(`((JSON.parse(localStorage.getItem("luluSaveV2")).stats || {}).airportDovid || 0) >= 1`, "the stat lands", 20000));
  // the look-alike: stop him (he's doing laps) and ask about the bag
  await use(t, "s3_perl", "Mrs. Shpilkes (again)");
  await talk(t, `__at.opts().some(o => /find it/.test(o))`, "she asks again", null, 20);
  await talk(t, idle, "…I'll find it! (the look-alike)", /find it/, 30);
  await g(`(() => { const p = ${R}.data.crowd.byId.pilkes; p.path = null; p.target = null; return true; })()`);
  await t.frames(3);
  await use(t, "s3_pilkes", "Mr. Pilkes");
  await t.frames(10);
  await t.shot("lookalike");
  await talk(t, idle, "the bag swap", null, 40);
  t.check("he hands it over; she carries it", await g(`${R}.data.s3.bag.phase === "carry" && !${R}.data.crowd.byId.pilkes.bag`));
  const b0 = await coins(t);
  await use(t, "s3_perl", "give it back (again)");
  await talk(t, idle, "un-frazzled again", null, 30);
  await t.frames(40);
  t.check("the second suitcase today pays nothing (capped: a rugelach)", (await g(`${R}.data.s3.bag.pay`)) === 0 && (await coins(t)) === b0);
  t.check("the day's ledger: 1 bag, 1 Dovid", await g(`(() => { const L = ${S3}.ledger(); return L.bag === 1 && L.dovid === 1 && L.day === ${JSON.stringify(DAY)}; })()`));
  if (!await leaveHall(t, "visit 2")) return;
  // ── a new real day: the caps reset ──
  await g(`(${S3}.debug.date("2026-11-22"), true)`);
  t.check("a new day: the caps reset", await g(`(() => { const L = ${S3}.ledger(); return L.bag === 0 && L.dovid === 0 && L.taxi === 0; })()`));
  await g(`(${S3}.debug.date(${JSON.stringify(DAY)}), true)`);
  const rep = await W.report(t);
  W.check(t, "the stage-3 hall visits", rep);
}

// ═══ 🚕 the JFK taxi run ═══════════════════════════════════════════════════
async function taxi(t) {
  const g = t.game;
  await g(`(${S3}.debug.date(${JSON.stringify(DAY)}), ${S3}.debug.SV.taxi = 0, ${S3}.debug.SV.day = ${JSON.stringify(DAY)}, true)`);
  await g(`(L3.state !== "title" ? L3.setState("title") : 0, true)`);
  await t.frames(3);
  await g(`L3.startRun({ mode: "cruise" })`);
  if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "taxi: a run starts", 60000)) return;
  if (await g(`ctx.state === "footRun"`)) { await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "taxi: on foot", 30000); await g(`(ctx.foot.drive({ own: true, x: ctx.car.pos.x, z: ctx.car.pos.z, h: ctx.car.h }), true)`); }
  if (!await t.until(`__lulu3d.state === "playing"`, "taxi: driving", 30000)) return;
  await g(`(ctx.hustle.hold(1e6), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.G.invT = 0, true)`);
  await t.frames(10);
  t.check("taxi: not listed in 💼 Jobs without the airport", await g(`!ctx.hustle.listed().includes("jfk_taxi") && ${S3}.taxi.why() === "away"`), await g(`${S3}.taxi.why()`));
  t.check("…and it can't be started there either", await g(`!ctx.hustle.start("jfk_taxi", { fare: "yenta" })`));
  // a pretend airport (stage 1 isn't on main yet): the ARRIVALS kerb 120 m up the right shoulder
  const kerbAt = ds => g(`(() => { const s = ctx.car.s + ${ds}, p = ctx.world.road.point(s, 9.4, {}); ${S3}.debug.fakeAirport({ x: p.x, z: p.z }); return s; })()`);
  const kS = await kerbAt(120);
  t.check("at the airport: listed in 💼 Jobs", await g(`ctx.hustle.listed().includes("jfk_taxi") && ${S3}.taxi.why() === ""`), await g(`${S3}.taxi.why()`));
  const c0 = await coins(t);
  await g(`(ctx.hustle.start("jfk_taxi", { fare: "zeidy", via: "test" }), true)`);
  t.check("the run starts: pick up at the kerb", await g(`!!ctx.hustle.job && ctx.hustle.job.id === "jfk_taxi" && ctx.hustle.job.phase === "pickup"`));
  await t.until(`!!__lulu3d.ctx.hustle.job.standing`, "the traveller waits at the kerb", 20000);
  const tp = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
  await tp(kS - 30, 5.25);
  await t.frames(10);
  await t.shot("taxi-kerb");
  await tp(kS - 3, 7.2);
  await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "ride"`, "pull up: they hop in", 20000);
  await t.until(`!!__lulu3d.ctx.hustle.job.seated`, "…in the passenger seat", 20000);
  t.check("the HUD line: to the Lakewood exit", /Lakewood/.test(await g(`ctx.hustle.job.line()`)), await g(`ctx.hustle.job.line()`));
  await t.frames(30);
  await t.shot("taxi-ride");
  // into Lakewood (the debug way in: no ramp), then to the landmark
  await g(`(ctx.town.load("lakewood"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 60000);
  await g(`(ctx.town.enter({ town: "lakewood", speed: 0 }), true)`);
  if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "into Lakewood", 30000)) return;
  await g(`(ctx.traffic.config.enabled = false, ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  await t.frames(10);
  const tg = await g(`(() => { const j = ctx.hustle.job, p = j && j.target(); return p ? { x: p.x, z: p.z, key: p.key, line: j.line() } : null; })()`);
  t.check("in Lakewood: the beacon moves to the lake", !!tg && /lake/.test(tg.key) && /Drop/.test(tg.line), JSON.stringify(tg));
  if (!tg) return;
  await g(`(() => { const c = ctx.car, p = ${JSON.stringify(tg)}; c.place(p.x + 4, p.z + 4, c.h); c.vx = 0; c.vz = 0; c.speed = 0; ctx.cam.snap(); return true; })()`);
  await t.until(`__lulu3d.state === "hustleResult"`, "the drop-off: the pass card", 20000);
  await t.frames(20);
  await t.shot("taxi-drop");
  t.check("the card: JFK TAXI RUN, a fixed fare", /JFK TAXI RUN/.test(await t.L(`document.querySelector("#screenCard").textContent`)) && /\+40/.test(await t.L(`document.querySelector("#screenCard").textContent`)));
  await t.frames(40);
  t.check("+40 💰 (fixed, no tips)", (await coins(t)) - c0 === 40, `${c0} → ${await coins(t)}`);
  await t.L(`document.getElementById("hsKeep").click()`);
  await t.until(`__lulu3d.state === "playing"`, "keep driving", 20000);
  // the wrong town: a Midwood fare picked up here in Lakewood
  await g(`(() => { const c = ctx.car; ${S3}.debug.fakeAirport({ x: c.pos.x + Math.sin(c.h) * 3, z: c.pos.z + Math.cos(c.h) * 3 }); c.vx = 0; c.vz = 0; return true; })()`);
  await g(`(ctx.hustle.start("jfk_taxi", { fare: "bochur", via: "test" }), true)`);
  await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "ride"`, "the bochur hops in", 20000);
  await t.frames(10);
  t.check("the wrong town: no beacon, a ↩️ line", await g(`ctx.hustle.job.target() === null && /Wrong town/.test(ctx.hustle.job.line())`), await g(`ctx.hustle.job.line()`));
  await g(`(ctx.hustle.end("quit", "quit"), true)`);
  // the cap: the 3rd paid run today, then it's not offered
  await g(`(${S3}.debug.SV.taxi = 2, true)`);
  await g(`(() => { const c = ctx.car; ${S3}.debug.fakeAirport({ x: c.pos.x + Math.sin(c.h) * 3, z: c.pos.z + Math.cos(c.h) * 3 }); return true; })()`);
  const c2 = await coins(t);
  await g(`(ctx.hustle.start("jfk_taxi", { fare: "yenta", via: "test" }), true)`);
  await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "ride"`, "the yenta hops in", 20000);
  const tg2 = await g(`(() => { const p = ctx.hustle.job.target(); return p ? { x: p.x, z: p.z, key: p.key } : null; })()`);
  t.check("the yenta's landmark (the Simcha Palace / a fallback)", !!tg2, JSON.stringify(tg2));
  if (tg2) {
    await g(`(() => { const c = ctx.car, p = ${JSON.stringify(tg2)}; c.place(p.x + 4, p.z + 4, c.h); c.vx = 0; c.vz = 0; c.speed = 0; ctx.cam.snap(); return true; })()`);
    await t.until(`__lulu3d.state === "hustleResult"`, "the 3rd drop-off", 20000);
    await t.frames(40);
    t.check("the 3rd run pays +40", (await coins(t)) - c2 === 40);
    await t.L(`document.getElementById("hsKeep").click()`);
    await t.until(`__lulu3d.state === "playing"`, "keep driving (2)", 20000);
  }
  t.check("past today's cap: not offered", await g(`${S3}.taxi.why() === "capped" && !ctx.hustle.listed().includes("jfk_taxi") && !ctx.hustle.start("jfk_taxi", { fare: "yenta" })`), await g(`${S3}.taxi.why()`));
  // a fare booked at the terminal's arrivals door → the run starts when she's back in her car at the airport
  await g(`(${S3}.debug.SV.taxi = 0, true)`);
  await g(`(() => { const c = ctx.car; ${S3}.debug.fakeAirport({ x: c.pos.x + Math.sin(c.h) * 6, z: c.pos.z + Math.cos(c.h) * 6 }); return true; })()`);
  await helpers(t);
  await g(`(${S3}.debug.dovidNext(false), true)`);
  await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "out of the car", 30000);
  if (!await enterHall(t, "taxi door")) return;
  t.check("a fare waits at the arrivals door (the airport is 'in')", await g(`__at.room().hots.some(h => h.id === "s3_fare")`));
  await use(t, "s3_fare", "the traveller at arrivals");
  await talk(t, `__at.opts().some(o => /Sure/.test(o))`, "Taxi? Are you a taxi?", null, 20);
  await t.shot("taxi-door");
  await talk(t, idle, "…booked", /Sure/, 30);
  t.check("booked", !!(await g(`${S3}.taxi.booked`)));
  if (!await leaveHall(t, "taxi door")) return;
  await g(`(ctx.foot.drive({ own: true, x: ctx.car.pos.x, z: ctx.car.pos.z, h: ctx.car.h }), true)`);
  t.check("back in her car → the booked run starts (pickup at the kerb)", await t.until(`!!__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.id === "jfk_taxi" && __lulu3d.ctx.hustle.job.phase === "pickup"`, "the booked run", 20000));
  await g(`(ctx.hustle.end("quit", "quit"), ${S3}.debug.fakeAirport(null), true)`);
  t.check("no airport again: not offered", await g(`${S3}.taxi.why() !== ""`));
  await g(`(L3.setState("title"), true)`);
}
