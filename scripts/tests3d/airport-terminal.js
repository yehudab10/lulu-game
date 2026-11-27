// ✈️ THE JFK TERMINAL (features/airport/terminal*.js — stage 2 of roadmap 12): one walk-in hall on the interiors engine.
//   ENTER / EXIT  from on foot (ctx.airport.debug.enterTerminal(): stage 1's doors call the same enter()) — warmed →
//                 a SOFT cut in and out: no black, Lulu never hidden, the camera never jumps (+ the QA watchdog)
//   CHECK-IN      each airline's desk talks + its questions; Bubbe Faigy's bag on the scale (sweaters · kugel · sit)
//   THE BOARD     reads a row; the statuses flip
//   SECURITY      wait the snake → the BEEP-O-MATIC (keys → kugel → Rex) → airside; duck under the ropes → the line's
//                 outrage + the Segway guard → back of the line / plead (CHUTZPAH DETECTED); the one-way EXIT lane
//   FOOD COURT    a snack costs a fixed price + restores a heart; nothing when full; capped at FOOD_CAP a run; never pays
//   THE GATE      sit in a seat (pose sit, pinned, stands up on the stick); the desk; the window (a takeoff)
//   ARRIVALS      the doors open, people walk out with suitcases; greeters' signs; the VIP carpet (stage 3)
//   LAW           walked in WANTED: the guard + Rex slow her, the real cops come in and catch her → law's arrest
//   PERF          draw calls / triangles inside on LOW + MEDIUM (limits below)
//   FRIENDS       two pages in a party (LOCAL relay): both inside see each other; presence "✈️ in the JFK terminal"
// Set AIRPORT_TERMINAL_PART=solo | perf | friends to run one part.
const path = require("path");
const W = require("../lib/qawatch.js");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");

const PORT = 27000 + (process.pid % 20000);
const RELAY = `ws://127.0.0.1:${PORT}`;
const PART = process.env.AIRPORT_TERMINAL_PART || "all";
const LIMITS = {
  // the hall at 1280×720, the worst of three views (check-in / security / the gate). Measured 2026-11-20:
  // MEDIUM 71–90 calls, 109–118k triangles · LOW 72–90 calls, 84–89k (8 full-detail people instead of 14). See AGENTS.md §7.
  medium: { calls: 110, maxCalls: 130, tris: 140000 },
  low: { calls: 110, maxCalls: 130, tris: 110000 },
};
const QF = `&enable=airport,interiors,foot`;

module.exports = {
  name: "airport-terminal",
  viewport: { width: 1280, height: 720 },
  query: QF,
  save2d: { totalCoins: 300, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { f: { meta: { tutorialDone: true } } },
  async run(t) {
    try {
      if (PART === "all" || PART === "solo") await solo(t);
      if (PART === "all" || PART === "perf") await perf(t);
      if (PART === "all" || PART === "friends") await friends(t);
    } catch (e) { t.check("airport-terminal threw", false, String(e && e.stack || e).slice(0, 500)); }
  },
};

const R = `window.__interiors.room`;
async function helpers(t) {
  await t.game(`(window.__at = {
    room: () => window.__interiors && window.__interiors.room,
    // stand next to a hotspot, facing it
    at(id) { const r = this.room(), h = r && r.hots.find(h => h.id === id); if (!h) return false;
      const o = r.lulu.obj; o.position.x = h.x; o.position.z = h.z + Math.min(h.r * 0.5, 0.6); r.collide(o.position, 0.32);
      r.vel.set(0, 0, 0); o.rotation.y = Math.atan2(h.x - o.position.x, h.z - o.position.z); return true; },
    near: () => { const r = window.__interiors.room; return r && r.near ? r.near.id : null; },
    dialog: () => (document.querySelector("#dialog") || {}).textContent || "",
    opts: () => [...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent),
  }, true)`);
}
async function enterHall(t, label = "enter") {
  await t.game(`(window.__entered = ctx.airport.debug.enterTerminal(), true)`);
  return t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.def.id === "terminal" && window.__interiors.room.ready`, `${label}: inside the terminal`, 90000);
}
/** Click through dialogue; pick the option matching pickRe when options show; stop when untilCode holds. */
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
  await t.game(`L3.startRun({ mode: "cruise" })`);
  if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "a run starts", 60000)) return false;
  if (await t.game(`ctx.state === "playing" && !ctx.foot.active`)) await t.game(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 60000);
}

// ═══ solo ═════════════════════════════════════════════════════════════════
async function solo(t) {
  const g = t.game;
  await t.frames(10);
  t.check("ctx.airport.terminal + the debug entry", await g(`!!(ctx.airport && ctx.airport.terminal && ctx.airport.debug && ctx.airport.debug.enterTerminal && ctx.interiors.terminal)`));
  t.check("…registered as a shared room for friends", await g(`ctx.together && ctx.together.shared().includes("terminal")`));
  if (!await startOnFoot(t)) return;
  await helpers(t);
  await W.install(t);
  // ── in: warmed → soft cut ──
  await g(`ctx.airport.terminal.warm()`);
  await t.until(`__lulu3d.ctx.airport.terminal.ready()`, "the hall warms (models loaded)", 90000);
  await t.L(`(window.__cut = { black: 0, hidden: 0, frames: 0, maxCam: 0 }, (function loop() { const C = window.__cut; C.frames++;
      const f = document.getElementById("intFade"), w = document.getElementById("footWash");
      const op = el => el ? +getComputedStyle(el).opacity : 0;
      if (op(f) > 0.6 && getComputedStyle(f).backgroundColor !== "rgba(0, 0, 0, 0)") C.black++;
      if (op(w) > 0.6) C.black++;
      const r = window.__interiors && window.__interiors.room;
      if (r && r.ready && !r.disposed && r.lulu && (!r.lulu.obj.visible || !r.lulu.obj.parent)) C.hidden++;
      if (r && r.ready && r.set) { const p = r.set.camera.position; if (C.lp) C.maxCam = Math.max(C.maxCam, p.distanceTo(C.lp)); C.lp = p.clone(); }
      if (C.on !== false) requestAnimationFrame(loop); })(), true)`);
  if (!await enterHall(t)) return;
  await t.frames(20);
  t.check("in: a soft cut (no black screen, no loading fade)", await t.L(`window.__cut.black === 0`), JSON.stringify(await t.L(`window.__cut`)));
  t.check("…the room came in through the soft path (warmed)", await g(`${R}.soft === true`));
  t.check("presence: ✈️ in the JFK terminal", await g(`(() => { const r = ctx.interiors.terminal; return r.emoji === "✈️" && /JFK terminal/.test(r.name); })()`));
  const crowd = await g(`ctx.airport.terminal.debug.crowd()`);
  t.check("the hall is busy (≥ 45 people on instanced rigs)", crowd && crowd.n >= 45, JSON.stringify(crowd));
  await t.shot("enter");
  // ── check-in ──
  for (const k of ["kugel", "eloy", "shmear"]) {
    await use(t, "desk_" + k, `${k} desk`);
    const seen = [];
    await talk(t, `!!__at.opts().length`, `${k}: the agent talks, then asks`, null, 20, seen);
    const opts = await t.L(`__at.opts()`);
    t.check(`${k}: 3 questions + never mind`, opts.length === 4, opts.join(" | "));
    await talk(t, idle, `${k}: an answer`, /Check in/, 30, seen);
    t.check(`${k}: the agent's lines show`, seen.length >= 2, seen.join(" / ").slice(0, 200));
  }
  await t.shot("checkin");
  // Bubbe's bag: sweaters (bag lighter, Lulu puffs up), then sit on it (the scale goes up)
  await use(t, "scale", "the bag scale");
  await talk(t, `__at.opts().some(o => /sweaters/.test(o))`, "the bag gag asks", null, 20);
  await talk(t, idle, "…sweaters", /sweaters/, 30);
  t.check("sweaters: the bag is 12 lb lighter, Lulu puffs up", await g(`${R}.data.bagLb === 29 && ${R}.lulu.obj.scale.x > 1.15`), JSON.stringify(await g(`[${R}.data.bagLb, ${R}.lulu.obj.scale.x]`)));
  await t.shot("bag-sweaters");
  await use(t, "scale", "the bag scale again");
  await talk(t, `__at.opts().some(o => /Sit on/.test(o))`, "the bag gag asks again", null, 20);
  await talk(t, `${R}.data.onBag > 0`, "…sit on the bag", /Sit on/, 30);
  t.check("sit: the scale goes UP", await g(`${R}.data.bagLb > 100`));
  await talk(t, idle, "…off the bag", null, 30);
  // ── the departures board ──
  await use(t, "board", "the departures board");
  const seenB = [];
  await talk(t, idle, "the board reads a row", null, 20, seenB);
  t.check("…a flight + its silly status, then Lulu", seenB.length >= 2 && /to /.test(seenB[0]), seenB.join(" / ").slice(0, 200));
  const flapped = await g(`(ctx.airport.terminal.debug.flap(), ${R}.data.rows[0].s)`);
  await t.frames(30);
  t.check("the statuses flip (split-flap)", typeof flapped === "string" && !(await g(`!!${R}.data.flap`)), flapped);
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(-8, 0, -1.5); return true; })()`);
  await t.frames(8);
  await t.shot("board");
  // ── arrivals ──
  await use(t, "arrivals", "the arrivals door");
  await t.frames(20);
  t.check("arrivals: the doors slide open, people walk out with suitcases", await g(`${R}.data.doorOpen > 0.5 && (${R}.data.arrivers || []).length >= 1 && ${R}.data.arrivers.every(a => !!a.bag)`));
  await t.shot("arrivals");
  await talk(t, idle, "arrivals line", null, 20);
  await use(t, "greeters", "the greeters' signs"); await talk(t, idle, "greeters line", null, 20);
  await use(t, "vip", "the VIP carpet"); await talk(t, idle, "VIP line", null, 20);
  t.check("stage 3's spot: ctx.airport.terminal.vip()", await g(`(() => { const v = ctx.airport.terminal.vip(); return !!v && Math.abs(v.x - 3) < 0.1; })()`));
  // ── the one-way exit lane (from landside it's shut) ──
  await g(`(() => { const r = __at.room(), s = r.spot("exitWrong"); r.lulu.obj.position.set(s.x, 0, s.z); return true; })()`);
  await t.stick(1, 0); await t.frames(30); await t.stick(0, 0); await t.frames(2);
  t.check("the EXIT lane is one-way: landside can't walk in through it", await g(`${R}.lulu.obj.position.x < 12`), String(await g(`${R}.lulu.obj.position.x`)));
  // ── security: duck under the ropes → plead → the scanner with CHUTZPAH ──
  const coins0 = await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
  await use(t, "line", "the security line");
  await talk(t, `__at.opts().some(o => /Duck/.test(o))`, "the line asks", null, 20);
  await talk(t, `__at.opts().some(o => /Bubbe/.test(o))`, "duck → the line's outrage → the guard stops her", /Duck/, 200);
  await t.shot("security-duck");
  await talk(t, `!!(${R}.data.scan && ${R}.data.scan.done) && ${idle}`, "plead → the BEEP-O-MATIC", /Bubbe/, 300);
  const scan = await g(`${R}.data.scan`);
  t.check("the scanner beeped at her keys, then her kugel (Rex found it), then CHUTZPAH", !!scan && scan.kugel && scan.chutzpah && scan.done, JSON.stringify(scan));
  t.check("…and she's airside", await g(`${R}.data.side === "air" && ${R}.lulu.obj.position.x > 12`));
  t.check("the guard went back to his patrol", await t.until(`!!${R}.data.A.guard.path`, "…the guard patrols again", 20000));
  // the long way (the snake): back out through the exit lane, then wait in line
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(4.0, 0, 3.0); r.data.side = "land"; return true; })()`);
  await t.frames(4);
  await use(t, "line", "the security line (again)");
  await talk(t, `__at.opts().some(o => /Wait/.test(o))`, "the line asks again", null, 20);
  await talk(t, `!!${R}.data.inLine`, "wait in line", /Wait in line/, 30);
  let sawCaption = false;
  for (let i = 0; i < 80 && !sawCaption; i++) { await t.frames(5); sawCaption = await t.L(`/Hour/.test((document.querySelector(".int-caption") || {}).textContent || "")`); }
  t.check("waiting the snake: the captions run", sawCaption);
  await t.shot("security-line");
  await talk(t, `!${R}.data.inLine && ${idle}`, "…through the snake and the scanner", null, 300);
  t.check("the second time: keys + a bobby pin (Rex already has the kugel)", await g(`${R}.data.scan.done && !${R}.data.scan.kugel && ${R}.data.side === "air"`));
  t.check("the line + scanner cost nothing", (await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`)) === coins0);
  await use(t, "dog", "Rex"); await talk(t, idle, "Rex guards the kugel", null, 20);
  await use(t, "guard", "the Segway guard"); await talk(t, idle, "the guard talks", null, 20);
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(13.4, 0, -4.4); r.yaw = 0; return true; })()`);
  await t.frames(10);
  await t.shot("security-scanner");
  // ── the food court: fixed price, +1 heart, capped, never pays ──
  await g(`(ctx.G.hearts = 1, ctx.G.maxHearts = 3, true)`);
  const w0 = await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
  await use(t, "deli", "Shmuley's deli");
  await talk(t, `__at.opts().some(o => /knish/.test(o))`, "the deli's menu", null, 20);
  const menu = await t.L(`__at.opts()`);
  t.check("the menu has prices", menu.some(o => /knish · 💰8/.test(o)) && menu.some(o => /Pastrami.*💰14/.test(o)), menu.join(" | "));
  await talk(t, idle, "buy a knish", /knish/, 40);
  t.check("a knish: −8 coins, +1 heart", (await g(`ctx.G.hearts`)) === 2 && (await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`)) === w0 - 8, JSON.stringify(await g(`[ctx.G.hearts, JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins, ${R}.data.lastBuy]`)));
  await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(16.2, 0, -2.6); r.yaw = 0; return true; })()`);
  await t.frames(8);
  await t.shot("food-court");
  await use(t, "water", "the water bar");
  await talk(t, `__at.opts().some(o => /bottle/.test(o))`, "the water menu", null, 20);
  await talk(t, idle, "buy a water", /bottle/, 40);
  t.check("water: −12 coins, +1 heart (full now)", (await g(`ctx.G.hearts`)) === 3 && (await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`)) === w0 - 20);
  // full → no sale; capped → no sale; nothing ever pays out
  let res = await g(`ctx.airport.terminal.debug.buy("deli", "knish")`);
  await talk(t, idle, "…full", null, 20);
  t.check("full hearts: no sale, no charge", (await g(`${R}.data.lastBuy.res`)) === "full" && (await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`)) === w0 - 20);
  await g(`(ctx.G.hearts = 1, true)`);
  res = await g(`ctx.airport.terminal.debug.buy("deli", "pastrami")`);
  await talk(t, idle, "…capped", null, 20);
  t.check(`the cap: ${2} hearts a run from the terminal — no sale past it`, (await g(`${R}.data.lastBuy.res`)) === "capped" && (await g(`ctx.G.hearts`)) === 1 && (await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`)) === w0 - 20);
  t.check("no free coins anywhere in the hall", (await g(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`)) <= coins0);
  // walking out and back in doesn't refill the cap (the engine's per-run flags)
  t.check("the cap is per run (rt.used survives the door)", await g(`${R}.used.healed === 2`));
  // ── the gate: sit, the desk, the window ──
  await use(t, "seats1", "a row of seats");
  await t.until(`!!${R}.data.sit && ${R}.luluPose && ${R}.luluPose.sit`, "she sits down", 20000);
  await t.frames(40);
  const sit = await g(`(() => { const r = __at.room(), o = r.lulu.obj.position, s = r.data.sit; return { dx: Math.abs(o.x - s.x), dz: Math.abs(o.z - s.z), ry: r.lulu.obj.rotation.y }; })()`);
  t.check("sitting: pinned in the seat, facing the window", sit.dx < 0.05 && sit.dz < 0.05 && Math.abs(Math.abs(sit.ry) - Math.PI) < 0.3, JSON.stringify(sit));
  t.check("…the camera looks out of the window", await g(`!!${R}.focusAt`));
  await g(`ctx.airport.terminal.debug.takeoff()`);
  await t.frames(40);
  t.check("a plane takes off past the window", await g(`${R}.data.planes.length >= 1`));
  await t.shot("gate-window");
  await t.stick(0, 1); await t.frames(8); await t.stick(0, 0); await t.frames(4);
  t.check("the stick stands her up", await g(`!${R}.data.sit && !${R}.luluPose`));
  await use(t, "gateDesk", "the gate desk");
  const seenG = [];
  await talk(t, idle, "the gate agent", null, 20, seenG);
  t.check("…a gate line", seenG.length >= 1);
  await use(t, "window", "the window"); await talk(t, idle, "the window line", null, 20);
  await use(t, "sleeper", "the sleeper"); await talk(t, idle, "the sleeper line", null, 20);
  await use(t, "family", "the family with ten kids"); await talk(t, idle, "the family line", null, 20);
  t.check("the family has ten kids", await g(`${R}.data.family.filter(a => a.look === "kid").length === 10`));
  // every hotspot is reachable (its prompt wins where it stands)
  const ids = await g(`__at.room().hots.filter(h => !h.enabled || h.enabled(__at.room())).map(h => h.id)`);
  const bad = [];
  for (const id of ids) { await g(`__at.at(${JSON.stringify(id)})`); await t.frames(2); const n = await g(`__at.near()`); if (n !== id) bad.push(`${id}→${n}`); }
  t.check(`all ${ids.length} hotspots reachable`, bad.length === 0, bad.join(", "));
  // ── out: the door, a soft cut, back on her feet ──
  await t.L(`(window.__cut.black = 0, window.__cut.hidden = 0, true)`);
  await use(t, "door", "the terminal doors");
  await t.until(`__lulu3d.state === "footRun"`, "out: back on her feet outside", 30000);
  await t.frames(20);
  t.check("out: a soft cut (no black)", await t.L(`window.__cut.black === 0`), JSON.stringify(await t.L(`window.__cut`)));
  t.check("…Lulu was never hidden inside", await t.L(`window.__cut.hidden === 0`));
  t.check("…walking, in control", await g(`ctx.foot.active && ctx.foot.phase === "walk"`));
  const rep = await W.report(t);
  W.check(t, "the terminal visit", rep);
  await t.L(`(window.__cut.on = false, true)`);
  // ── walked in WANTED: Rex + the guard slow her, the real cops come in and catch her ──
  await g(`(ctx.law.addWarrant("JAYWALKING"), true)`);
  t.check("she's wanted (a warrant on file)", await g(`ctx.law.wanted > 0`));
  if (!await enterHall(t, "wanted")) return;
  await t.until(`!!${R}.data.law && ${R}.data.law.spotted`, "security spots her", 20000);
  await t.stick(1, 0);
  await t.until(`${R}.data.law.slowed`, "Rex has her shoelace (slowed)", 30000);
  t.check("…she walks slower", await g(`${R}.def.walkSpeed < 2.5`));
  await t.shot("wanted");
  await t.stick(0, 0);
  await t.until(`!!${R}.data.law.cops`, "the real cops walk in", 60000);
  await t.until(`__lulu3d.state === "lawArrest" || __lulu3d.state === "lawJail"`, "…they catch her → law's arrest", 90000);
  t.check("arrested with the warrant + RUNNING FROM A SEGWAY", await g(`(() => { const c = (ctx.stateData && ctx.stateData.charges) || []; return c.includes("RUNNING FROM A SEGWAY"); })()`), JSON.stringify(await g(`ctx.stateData && ctx.stateData.charges`)));
  await g(`(L3.setState("title"), true)`);
  await t.frames(5);
}

// ═══ perf ═════════════════════════════════════════════════════════════════
async function perf(t) {
  const g = t.game;
  // (no warrants on file: a wanted Lulu would bring the cops in mid-measurement)
  await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.wanted = []; }); return true; })`);
  for (const tier of ["medium", "low"]) {
    await g(`(L3.setState("title"), true)`); await t.frames(3);
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = ${JSON.stringify(tier)}; window.__lulu3d.ctx.applySettings(); return true; })`);
    await t.frames(3);
    if (!await startOnFoot(t)) return;
    await helpers(t);
    if (!await enterHall(t, `perf ${tier}`)) return;
    const tierNow = await g(`ctx.gfx ? ctx.gfx.tier : "?"`);
    await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true;
        r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; const C = __lulu3d.ctx; if (!(C.view && s === C.view.scene)) return; P.n++; P.ms += performance.now() - t0;
          P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; } return true; })()`);
    const out = {};
    // three views: landside (check-in), security, the gate — the worst frame counts
    for (const [k, x, z] of [["checkin", -18, -1.5], ["security", 6, 0.5], ["gate", 22, -2.5]]) {
      await g(`(() => { const r = __at.room(); r.lulu.obj.position.set(${x}, 0, ${z}); r.updateCamera(0, true); return true; })()`);
      await t.frames(6);
      await t.L(`(window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, w0: performance.now() }, true)`);
      await t.frames(30);
      out[k] = await t.L(`(() => { const P = window.__pf; window.__pf = null; return { calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, renderMs: +(P.ms / P.n).toFixed(2), frameMs: +((performance.now() - P.w0) / P.n).toFixed(1) }; })()`);
      if (tier === "medium") await t.shot(`perf-${k}`);
    }
    const crowd = await g(`ctx.airport.terminal.debug.crowd()`);
    console.log(`   PERF airport-terminal ${tier} (${tierNow}) ${JSON.stringify(out)} crowd ${JSON.stringify(crowd)}`);
    const Lm = LIMITS[tier];
    const worst = Object.values(out).reduce((a, b) => ({ calls: Math.max(a.calls, b.calls), maxCalls: Math.max(a.maxCalls, b.maxCalls), tris: Math.max(a.tris, b.tris) }), { calls: 0, maxCalls: 0, tris: 0 });
    t.check(`perf ${tier}: ≤ ${Lm.calls} draw calls avg, ≤ ${Lm.maxCalls} worst, ≤ ${Lm.tris / 1000}k triangles`, worst.calls <= Lm.calls && worst.maxCalls <= Lm.maxCalls && worst.tris <= Lm.tris, JSON.stringify(worst));
    await g(`(__at.room().leave(), true)`);
    await t.until(`__lulu3d.state === "footRun"`, `perf ${tier}: out`, 30000);
  }
}

// ═══ friends ══════════════════════════════════════════════════════════════
async function friends(t) {
  const relay = await startRelay(PORT);
  setWallCap(8 * 60000);
  const guests = [];
  try {
    const g = t.game, Hp = hostPage(t);
    const Q = `&enable=party,foot,openworld,airport,interiors&mpurl=${encodeURIComponent(RELAY)}`;
    await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.wanted = []; }); return true; })`);
    await t.frames(5);
    await t.boot(Q);
    await t.click(/Friends/);
    await t.L(`document.getElementById("pt_roam").click()`);
    if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
    const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
    const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q}&party=${code}&with=${hostUid}`, { width: 960, height: 540 });
    guests.push(A);
    if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
    const guestUid = await A.game(`ctx.party.uid`);
    for (const P of [Hp, A]) await P.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
    // both walk in through the same doors (here: the same stretch of road)
    await g(`ctx.party._debug.place(400, 5.25, 0)`);
    await A.game(`ctx.party._debug.place(404, 5.25, 0)`);
    await t.frames(10);
    for (const P of [Hp, A]) {
      await P.game(`(window.__e = ctx.airport.debug.enterTerminal(), true)`);
      await P.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready && window.__interiors.room.def.id === "terminal"`, `${P.label}: inside the terminal`, 120000);
    }
    if (!await Hp.until(`ctx.together.debug.room().room === "terminal" && ctx.together.debug.room().mates.some(m => m.uid === ${JSON.stringify(guestUid)})`, "host sees the guest inside the terminal", 90000)) {
      const dg = u => `(() => { const p = ctx.party.peer(${JSON.stringify("")} + ${JSON.stringify(u)}); const N = ctx.party._debug.N; return { net: { maxLen: N.maxLen | 0, slim: N.slim | 0, bcBig: N.bcBig | 0 }, me: { st: ctx.state, mode: ctx.G.mode, m: N.mode, zone: ctx.openworld.zone, room: ctx.together.debug.room() }, peer: p && { m: p.m, aid: p.aid, x: p.x, fresh: ctx.party.fresh(p, 8000) } }; })()`;
      console.log("   TERMINAL diag host", JSON.stringify(await g(dg(guestUid))).slice(0, 900));
      console.log("   TERMINAL diag guest", JSON.stringify(await A.game(dg(hostUid))).slice(0, 900));
    }
    await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${JSON.stringify(hostUid)})`, "guest sees the host inside the terminal", 90000);
    t.check("…one terminal for both (the same instance)", (await g(`ctx.together.debug.room().inst`)) === "jfk" && (await A.game(`ctx.together.debug.room().inst`)) === "jfk");
    t.check("presence: the guest reads ✈️ in the JFK terminal", await g(`(() => { const p = ctx.party.presenceOf(${JSON.stringify(guestUid)}); return !!p && p.icon === "✈️" && /JFK terminal/.test(p.label); })()`), JSON.stringify(await g(`ctx.party.presenceOf(${JSON.stringify(guestUid)})`)));
    // the guest walks to the gate and sits; the host sees her move there + sit
    await A.game(`(() => { const r = window.__interiors.room; r.lulu.obj.position.set(23.0, 0, -0.2); return true; })()`);
    await A.game(`(() => { const r = window.__interiors.room; r.use(r.hots.find(h => h.id === "seats1")); return true; })()`);
    await A.until(`!!window.__interiors.room.data.sit`, "guest sits at the gate", 30000);
    await g(`(() => { const r = window.__interiors.room; r.lulu.obj.position.set(21.0, 0, -2.6); return true; })()`);
    await Hp.until(`(() => { const m = ctx.together.debug.room().mates.find(m => m.uid === ${JSON.stringify(guestUid)}); return !!m && m.x > 20 && m.z > 0.3; })()`, "host sees the guest over at the seats", 60000);
    t.check("…and sitting (pose bit)", await Hp.until(`(() => { const r = window.__interiors.room; const pp = ctx.party.peer(${JSON.stringify(guestUid)}); return !!pp && pp.x && Array.isArray(pp.x.in) && (pp.x.in[5] & 1) === 1; })()`, "host gets the guest's sit bit", 30000));
    await t.frames(20);
    await t.shot("friends");
    await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-airport-terminal-friends-guest.png") }).catch(() => { });
    // strangers never inside: only party members publish / match d.x.in (the room's mates are all party members)
    t.check("only party members are drawn inside", await g(`ctx.together.debug.room().mates.every(m => ctx.party.members().includes(m.uid))`));
  } finally {
    for (const gp of guests) {
      t.check(`${gp.label}: no page errors`, gp.errors.length === 0, gp.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
      try { await gp.page.close(); } catch (e) { }
    }
    relay.kill();
  }
}
