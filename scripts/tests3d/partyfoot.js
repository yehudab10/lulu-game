// 🎉🚶 Everything in a party, like the regular game — two real pages against the LOCAL relay
// (server/local-relay.js on a private port; never production). A 🏡 Road Trip:
//   PRESENCE  ctx.party.presence + the automatic one ride in d.x.pr; the friend's nametag / 👯 app read it
//   🚶 FOOT   the host pulls onto the shoulder → "Get out & walk" (a party allows it now) → the guest sees a
//             WALKING Lulu (not a car), moving, + the host's PARKED car where she left it; presence "on foot"
//   🏠 INSIDE the host walks into The Thirsty Scholar (personal) → the guest sees presence "in The Thirsty
//             Scholar" + her nametag over the door; the party world keeps running; she comes back out
//   🔑 JACK   the host carjacks a SHARED party car on the move → it vanishes on BOTH screens (gone for good,
//             never re-added) → the guest sees the host's car as that ride's model
//   🚓 LAW    the host's own chase → the guest sees puppet cruisers (light bars) on her tail → arrest → presence
//             "in jail" on the guest → bail → back in the party world (no 3-2-1)
//   SYNC      the shared traffic still sits where the party clock says on both screens; PERF numbers
const { spawn } = require("child_process");
const path = require("path");
const { waitOn } = require("../lib/party3d.js");
const PORT = 25000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=party,foot,law,interiors,town,atmos&mpurl=${encodeURIComponent(URL)}`;
let relay = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function startRelay() {
  return new Promise((resolve, reject) => {
    relay = spawn(process.execPath, [path.join(__dirname, "..", "..", "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ["ignore", "pipe", "pipe"] });
    let done = false;
    const ok = () => { if (!done) { done = true; resolve(); } };
    relay.stdout.on("data", d => { if (/listen/i.test(String(d))) ok(); });
    relay.on("error", reject);
    setTimeout(ok, 1500);
  });
}
process.on("exit", () => { try { relay && relay.kill(); } catch (e) { } });

async function guestPage(t, label, save2d, query) {
  const browser = t.page.context().browser();
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { const x = m.text(); if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(x)) errors.push(x); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(({ save2d }) => {
    if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify(save2d));
    sessionStorage.setItem("__seeded", "1");
  }, { save2d });
  const base = t.page.url().split("/3d/")[0];
  await page.goto(`${base}/3d/?test${Q}${query || ""}`);
  return {
    label, page, errors,
    L: code => page.evaluate(code),
    game: code => page.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`),
    async until(code, what, ms = 90000) {
      if (await waitOn(page, code, ms)) return true;   // GAME time (frames), not wall time: scripts/lib/party3d.js
      t.check(`${label}: ${what}`, false, "timed out");
      return false;
    },
  };
}
async function hostUntil(t, code, what, ms = 90000) {
  if (await waitOn(t.page, code, ms)) return true;   // GAME time (frames), not wall time
  t.check(what, false, "timed out in " + await t.game(`ctx.state`).catch(() => "?"));
  return false;
}
const clickSel = async (t, sel) => { const ok = await t.L(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b) b.click(); return !!b; })()`); await sleep(250); return ok; };
const PERF = async (t, ms) => {
  await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); }; }
    window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, ms: 0, t0: performance.now() }; })()`);
  await sleep(ms);
  return t.L(`(() => { const P = window.__pf; window.__pf = null; return P && P.n ? { frames: P.n, fps: +(P.n / ((performance.now() - P.t0) / 1000)).toFixed(1), renderMs: +(P.ms / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), cars: __lulu3d.traffic.cars.length } : null; })()`);
};
/** Every live shared car must sit where the party clock says it should (gone ones excluded). */
const SYNC = `(() => { const live = ctx.party.trafficLive(); let bad = 0; for (const c of live) { const w = ctx.party.trafficAt(c.at, c.s - 5, c.s + 5).find(x => x.key === c.key); if (!w || Math.abs(w.s - c.s) > 0.05 || ctx.party.trafficGone(c.key)) bad++; } return { n: live.length, bad, locals: ctx.traffic.cars.filter(c => !(c.data && c.data.party)).map(c => Object.keys(c.data || {}).filter(k => c.data[k]).join("+")) }; })()`;

module.exports = {
  name: "partyfoot",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 5000, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid", luluHair: "#8D6E63" },
  async run(t) {
    await startRelay();
    const guests = [];
    try { await partyRun(t, guests); }
    catch (e) { t.check("party run threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      try { relay.kill(); } catch (e) { }
    }
  },
};

async function partyRun(t, guests) {
  const g = t.game;
  t.check("ctx.party.presence API", await g(`typeof ctx.party.presence === "function" && typeof ctx.party.presenceOf === "function" && typeof ctx.party.setX === "function"`));
  await t.click(/Party with friends/);
  await t.click(/Host a party/);
  if (!await hostUntil(t, `ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`, "host: lobby")) return;
  const code = await g(`ctx.party.code`);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `&party=${code}`);
  guests.push(A);
  if (!await A.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "joins from the link", 180000)) return;
  await hostUntil(t, `ctx.party.players.length === 2`, "two in the lobby");
  await clickSel(t, "#pt_act_trip");
  await clickSel(t, "#pt_go");
  const pages = [{ label: "host", game: c => t.game(c), until: (c, w, ms) => hostUntil(t, c, w, ms) }, A];
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "trip"`, "road trip: GO", 90000)) return;
  const hostUid = await g(`ctx.party.uid`), guestUid = await A.game(`ctx.party.uid`);
  const H = JSON.stringify(hostUid);
  // the law stays quiet until we ask for it (random traps would make the run flaky)
  for (const p of pages) await p.game(`(ctx.law.hold(9999), true)`);
  t.check("party: foot / interiors / law are on (streets + rides too since party round 2: not in the OFF set — partyplus plays them)", await g(`ctx.enabled("foot") && ctx.enabled("law") && ctx.enabled("interiors")`) && await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => { const m = /const OFF = new Set\\(\\[([^\\]]*)\\]/.exec(s); return !!m && !/"streets"/.test(m[1]) && !/"rides"/.test(m[1]); })`));
  t.check("presence: driving by default", (await A.game(`(ctx.party.presenceOf(${H}) || {}).mode`)) === "drive" || await A.until(`(ctx.party.presenceOf(${H}) || {}).mode === "drive"`, "presence drive", 60000));

  // ── 🚶 the host pulls onto the shoulder and climbs out ──
  await g(`(ctx.party.placeCar(ctx.car.s + 40, 7.2, 0), true)`);
  await A.game(`(ctx.party.placeCar(${await g(`ctx.car.s`)} - 26, 5.25, 0), true)`);
  await hostUntil(t, `ctx.foot.offering === true`, "a party offers 🚶‍♀️ Get out & walk on the shoulder", 120000);
  t.check("G.arrived is off on a road trip (climbing out is allowed)", await g(`!ctx.G.arrived`));
  await t.tap(0);
  if (!await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the host is walking", 30000)) return;
  t.check("host publishes presence 'on foot' + a foot pose + her parked car", await g(`(() => { const x = ctx.party._debug.xk(); return x.pr && x.pr[0] === "foot" && Array.isArray(x.f) && Array.isArray(x.pc); })()`), JSON.stringify(await g(`ctx.party._debug.xk()`)).slice(0, 200));
  const seeWalker = `(() => { const rc = ctx.party.remoteCar(${H}); return !!rc && rc.shown && rc.foot && !!rc.walker && rc.walker.obj.visible && !rc.v.tilt.visible; })()`;
  await A.until(seeWalker, "the guest sees a WALKING Lulu (not a car)", 120000);
  t.check("guest: the host is a walker", await A.game(seeWalker));
  const pk = await g(`ctx.foot.parkedCar`);
  await A.until(`(() => { const w = ctx.party._debug.world(${H}); return w && w.parked; })()`, "the guest sees the parked car", 90000);
  const pkSeen = await A.game(`ctx.party._debug.world(${H})`);
  t.check("guest: the host's parked car sits where she left it", !!pk && !!pkSeen && pkSeen.parked && Math.hypot(pkSeen.parked.x - pk.x, pkSeen.parked.z - pk.z) < 0.3, JSON.stringify({ pk, pkSeen }));
  t.check("guest: presence 'on foot' on the nametag", await A.game(`ctx.party.presenceOf(${H}).mode === "foot" && /🚶/.test(ctx.party.remoteCar(${H}).tag.st || "")`));
  // she walks (stick forward) — the guest sees her move
  const p0 = await A.game(`(() => { const rc = ctx.party.remoteCar(${H}); return { x: rc.x, z: rc.z }; })()`);
  await t.stick(0, -1);
  await t.frames(75);
  await t.stick(0, 0);
  const real = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`);
  await A.until(`(() => { const rc = ctx.party.remoteCar(${H}); return Math.hypot(rc.x - ${real.x}, rc.z - ${real.z}) < 2.5; })()`, "the walker catches up", 60000);
  const p1 = await A.game(`(() => { const rc = ctx.party.remoteCar(${H}); return { x: rc.x, z: rc.z }; })()`);
  t.check("guest: the walker moves with her (and ends up where she really is)", Math.hypot(p1.x - p0.x, p1.z - p0.z) > 2 && Math.hypot(p1.x - real.x, p1.z - real.z) < 2.5, JSON.stringify({ p0, p1, real }));
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-partyfoot-guest-sees-walker.png") }).catch(() => { });
  await t.shot("host-walking");

  // ── 🏠 into The Thirsty Scholar (personal: only she goes in) ──
  const door = await g(`ctx.foot.debug.nextDoorAt(ctx.foot.debug.F.s, "bar")`);
  t.check("there's a bar up the road", !!door);
  if (door) {
    await g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, p = r.point(${door.s} - 30, ${door.side} * 9.5, {}); F.pos.set(p.x, 0, p.z); F.s = ${door.s} - 30; return true; })()`);
    await A.game(`(ctx.party.placeCar(${door.s} - 45, 5.25, 0), true)`);
    await hostUntil(t, `ctx.foot.debug.allDoors().some(d => d.id === "bar")`, "the block with the bar is built", 60000);
    await g(`(() => { const F = ctx.foot.debug.F, d = ctx.foot.debug.allDoors().find(d => d.id === "bar");
      const r = ctx.world.road, p = r.point(d.s, d.side * (Math.abs(d.d) - 0.6), {}); F.pos.set(p.x, 0, p.z); F.s = d.s; F.peds.forEach(x => x.s += 300); return true; })()`);
    await t.frames(8);
    await t.tap(0);
    if (await hostUntil(t, `ctx.state === "interior"`, "the host walks into the bar", 30000)) {
      await A.until(`(ctx.party.presenceOf(${H}) || {}).mode === "in"`, "presence: inside", 90000);
      const pr = await A.game(`ctx.party.presenceOf(${H})`);
      t.check("guest: presence 'in The Thirsty Scholar'", !!pr && pr.mode === "in" && /Thirsty Scholar/.test(pr.label), JSON.stringify(pr));
      await A.until(`(() => { const w = ctx.party._debug.world(${H}); return w && w.tag; })()`, "her nametag over the door", 90000);
      t.check("guest: her car (walker) is hidden while she's inside; the world keeps going", await A.game(`(() => { const rc = ctx.party.remoteCar(${H}); return (!rc || !rc.shown) && ctx.state === "playing"; })()`));
      await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-partyfoot-guest-sees-inside.png") }).catch(() => { });
      await t.frames(30);
      await t.shot("host-inside");
      // out again (○ / Esc leaves an interior)
      // ○ asks "Head back outside?" → ✕ leaves
      for (let i = 0; i < 8 && await g(`ctx.state === "interior"`); i++) { await t.tap(1); await t.frames(12); await t.tap(0); await t.frames(30); }
      await hostUntil(t, `ctx.state === "footRun"`, "back out on the sidewalk", 120000);
    }
  }

  // ── 🔑 carjack a SHARED party car on the move ──
  await A.game(`(ctx.party.placeCar(${await g(`ctx.car.s`)} - 30, 5.25, 0), true)`);
  await sleep(1500);
  const pick = await g(`(() => { const F = ctx.foot.debug.F; const cs = ctx.traffic.cars.filter(c => c.data && c.data.party && ["sedan", "van", "truck"].includes(c.kind) && c.s > F.s - 150 && c.s < F.s + 300);
    cs.sort((a, b) => Math.abs(a.s - F.s) - Math.abs(b.s - F.s)); return cs[0] ? { key: cs[0].data.party, kind: cs[0].kind, s: cs[0].s } : null; })()`);
  t.check("a shared car is nearby to jack", !!pick, JSON.stringify(pick || await g(`({ st: ctx.state, Fs: ctx.foot.debug.F && ctx.foot.debug.F.s, cs: ctx.car.s, n: ctx.traffic.cars.length, cars: ctx.traffic.cars.slice(0, 12).map(c => [c.kind, Math.round(c.s), c.dir, c.data && c.data.party]), pt: ctx.party._debug.traffic.cars.size, on: ctx.party._debug.traffic.on })`)));
  if (pick) {
    const K = JSON.stringify(pick.key);
    await A.until(`ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`, "the guest has that shared car too", 60000);
    const ok = await g(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.party === ${K}); if (!c) return "gone?";
      const F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }; F.pos.set(c.x + l.x * 1.6, 0, c.z + l.z * 1.6);
      return ctx.streets.carjack(c) ? "ok" : "refused"; })()`);
    t.check("streets' carjack takes a moving party car", ok === "ok", ok);
    t.check("host: it left the shared traffic (gone, a local car now)", await g(`ctx.party.trafficGone(${K}) && !ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`));
    await A.until(`ctx.party.trafficGone(${K}) && !ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`, "the jacked car vanishes on the guest's screen", 90000);
    t.check("guest: the jacked car is gone for good", await A.game(`ctx.party.trafficGone(${K})`));
    await hostUntil(t, `ctx.state === "playing" && !!ctx.foot.vehicle`, "the host drives off in it", 120000);
    t.check("host drives the jacked ride", (await g(`ctx.foot.vehicle && ctx.foot.vehicle.kind`)) === pick.kind);
    await A.until(`(() => { const rc = ctx.party.remoteCar(${H}); return !!rc && rc.shown && !rc.foot && (rc.v.rideKey || "").startsWith(${JSON.stringify(pick.kind)} + "|"); })()`, "the guest sees the host IN that ride (its model)", 120000);
    await sleep(2500);
    t.check("…and it is never re-added on either screen", !(await g(`ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`)) && !(await A.game(`ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`)));
    await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-partyfoot-guest-sees-ride.png") }).catch(() => { });
  }

  // ── 🚓 her own chase → the guest sees puppet cruisers on her tail ──
  if (await g(`ctx.state !== "playing"`)) await hostUntil(t, `ctx.state === "playing"`, "host driving", 120000);
  await A.game(`(ctx.party.placeCar(${await g(`ctx.car.s`)} - 70, 5.25, 0), true)`);
  await g(`(ctx.law.hold(0), ctx.law._dbg.L.hold = 0, ctx.law._dbg.L.grace = 0, ctx.law.startChase("GRAND THEFT AUTO", { msg: "🚨 TEST" }), true)`);
  t.check("host: a pursuit on her", await g(`ctx.law.chasing`));
  await hostUntil(t, `Array.isArray(ctx.party._debug.xk().cp)`, "host publishes her cruisers (d.x.cp)", 120000);
  await A.until(`(() => { const w = ctx.party._debug.world(${H}); return w && w.cops.length >= 1; })()`, "the guest sees puppet cruisers", 120000);
  const cw = await A.game(`ctx.party._debug.world(${H})`), real2 = await g(`ctx.law._dbg.L.units.filter(u => u.car && u.mode === "chase").map(u => ({ x: u.car.x, z: u.car.z }))`);
  t.check("guest: a puppet cruiser (light bar) is near where her real one is", cw && cw.cops.length >= 1 && cw.cops[0].lit && real2.some(r => cw.cops.some(c => Math.hypot(c.x - r.x, c.z - r.z) < 12)), JSON.stringify({ cw, real2 }));
  t.check("guest: her nametag shows the heat", await A.game(`/🚨/.test(ctx.party.remoteCar(${H}).tag.st || "") || (ctx.party.presenceOf(${H}) || {}).mode === "chase"`));
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-partyfoot-guest-sees-cops.png") }).catch(() => { });
  await t.shot("host-chase");

  // ── 🚔 arrested → "in jail" for friends → bail → back in the party ──
  await g(`(ctx.law.arrest(["GRAND THEFT AUTO"], { skipCinematic: true }), true)`);
  await hostUntil(t, `ctx.state === "lawJail"`, "the host is hauled to the precinct", 120000);
  await A.until(`(ctx.party.presenceOf(${H}) || {}).mode === "jail"`, "presence: in jail", 90000);
  t.check("guest: presence 'in jail'", (await A.game(`ctx.party.presenceOf(${H}).label`)) === "in jail");
  t.check("guest: no puppet cruisers left once she's inside", await A.until(`(() => { const w = ctx.party._debug.world(${H}); return !w || w.cops.length === 0; })()`, "puppets cleared", 15000));
  await t.shot("host-jail");
  if (await hostUntil(t, `ctx.law._dbg.jail() && ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawBail")`, "the cell menu", 240000)) {
    await t.game(`document.querySelector("#lawBail").click()`);
    // (a REAL-time wait, and a 2-page CI runner can drop to ~1 fps: the ~6 s walk out of the precinct is then minutes long)
    await hostUntil(t, `(ctx.state === "playing" || ctx.state === "footRun") && ctx.G.mode === "party"`, "bailed out: back in the party world", 420000);
    t.check("host: back in the party run (no 3-2-1 countdown)", await g(`ctx.G.mode === "party" && ["playing", "footRun"].includes(ctx.state)`), await g(`ctx.state`));
    await A.until(`(ctx.party.presenceOf(${H}) || {}).mode !== "jail"`, "presence clears the jail", 90000);
  }

  // ── the shared traffic never split ──
  await sleep(1500);
  const s1 = await g(SYNC), s2 = await A.game(SYNC);
  t.check("sync: every live shared car sits where the party clock says (host)", s1.n >= 4 && s1.bad === 0, JSON.stringify(s1).slice(0, 200));
  t.check("sync: …and on the guest", s2.n >= 4 && s2.bad === 0, JSON.stringify(s2).slice(0, 200));
  t.check("sync: the guest has no stray local cars", s2.locals.every(k => /footStub|law|local/.test(k)), JSON.stringify(s2.locals));

  // ── perf: the host (the page in front) with a WALKING friend right beside her ──
  await A.game(`(ctx.party.placeCar(${await g(`ctx.car.s`)} + 12, 7.2, 0), ctx.foot.start("droveOff"), true)`);
  await A.until(`ctx.state === "footRun"`, "the guest walks too", 120000);
  await hostUntil(t, `(() => { const rc = ctx.party.remoteCar(${JSON.stringify(guestUid)}); return !!rc && rc.shown && rc.foot; })()`, "the host sees the walking guest", 120000);
  const perf = await PERF(t, 4000);
  console.log("   PERF party foot (host, 2 players, a walking friend)", JSON.stringify(perf));
  t.check("perf: draw calls / frame time with a walking friend", !!perf && perf.frames >= 1 && perf.calls > 0, JSON.stringify(perf));
  await t.shot("host-sees-walking-guest");

  // ── 🌍 Free Roam: walking on a town's streets too ──
  // (a slow test machine can stall a page long enough for the host to hand over: ask whoever hosts now)
  const boss = (await g(`ctx.party.isHost`)) ? pages[0] : A;
  await boss.game(`(ctx.party._debug.toLobby(), true)`);
  for (const p of pages) await p.until(`ctx.state === "partyLobby"`, "back in the lobby", 40000);
  t.check("the lobby takes her out of her walk", await g(`!ctx.foot.active`));
  await boss.game(`(ctx.party._debug.start("roam"), true)`);
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "roam"`, "free roam: GO", 90000)) return;
  for (const p of pages) {
    await p.game(`(ctx.law.hold(9999), true)`);
    await p.until(`ctx.town.debug.S.loaded`, "town models", 90000);
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    await p.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "in Lakewood", 90000);
  }
  // (warp only once the host's town snapshots have landed — a warp to a friend still "on the highway" leaves town)
  await A.until(`(() => { const p = ctx.party.peer(${H}); return !!p && p.x && p.x.z === "lakewood" && p.samples.length > 2; })()`, "the guest hears the host is in Lakewood", 120000);
  await A.game(`ctx.openworld.warpTo(${H})`);
  await sleep(2500);
  if (!await A.game(`ctx.openworld.zone === "lakewood"`)) {
    await A.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    await A.until(`ctx.openworld.zone === "lakewood"`, "guest back in Lakewood", 60000);
  }
  await g(`(ctx.foot.start("droveOff"), true)`);
  await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the host walks in Lakewood", 120000);
  await t.stick(0.6, -1); await t.frames(45); await t.stick(0, 0);
  const tr = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z, zone: ctx.openworld.zone })`);
  // (wall-clock: on a slow CI machine the guest's frames + the host's snapshots take a while to land)
  await A.until(`(() => { const rc = ctx.party.remoteCar(${H}); return !!rc && rc.shown && rc.foot && Math.hypot(rc.x - ${tr.x}, rc.z - ${tr.z}) < 3; })()`, "town walker shown", 60000);
  const tw = await A.game(`(() => { const rc = ctx.party.remoteCar(${H}); return rc ? { shown: rc.shown, foot: rc.foot, x: rc.x, z: rc.z, zone: ctx.openworld.zone } : null; })()`);
  t.check("town: the guest sees the host WALKING on Lakewood's streets, where she really is", !!tw && tw.shown && tw.foot && Math.hypot(tw.x - tr.x, tw.z - tr.z) < 3 && tr.zone === "lakewood", JSON.stringify({ tw, tr }));
  t.check("town: and her parked car", await A.until(`(() => { const w = ctx.party._debug.world(${H}); return w && w.parked; })()`, "parked car in town", 30000));
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-partyfoot-guest-town-walker.png") }).catch(() => { });
  await g(`ctx.party.leave()`);
}
