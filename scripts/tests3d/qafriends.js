// 🐞 QA with FRIENDS (ci/together) — two real pages in one 🎉 party against the LOCAL relay (never production), the watchdog
// (scripts/lib/qawatch.js) on BOTH screens. Riding in a friend's car (openworld/ride.js):
//   • the driver drives across an ATTACHED town's line with the passenger in → on the passenger's screen: no freeze, no
//     long cut, she ends up in town, still riding
//   • hop out MOVING in town → her car beside the driver's, not inside a parked car / a wall
//   • the driver takes a hard hit (a party pratfall) / is arrested / leaves the party mid-ride → the passenger is let out (or rides on) cleanly,
//     never stuck riding a car that's gone
//   • a Free Roam warp (📱 👯 → go to a friend) into an attached town
// Waits are in GAME frames (scripts/lib/party3d.js).
const { startRelay, guestPage, hostPage, setWallCap, waitOn } = require("../lib/party3d.js");
const W = require("../lib/qawatch.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,homes,places,law&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

module.exports = {
  name: "qafriends",
  fast: false,     // (two pages on the relay, which keep a REAL performance.now: flaky on the fast clock — 1 red in 2 full runs — the old clock)
  viewport: { width: 960, height: 540 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("qafriends threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

async function body(t, guests) {
  const g = t.game, Hp = hostPage(t);
  await t.game(`L3.startRun({ mode: "cruise", quick: true })`);     // (▶ PLAY first, then 📱 👯 › Play with a friend — the title has no Friends tile any more)
  await t.until(`["playing", "footRun"].includes(__lulu3d.ctx.state)`, "▶ PLAY: her run starts", 120000);
  await t.game(`(ctx.party.hostRoam(), true)`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`, { width: 960, height: 540 });
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing" && !ctx.party.joining`, "guest joins Free Roam (beside the host)", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const P of [Hp, A]) await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
  // the watchdog on both screens (the guest's report is checked against the host page's t)
  const AW = { L: A.L };
  await W.install(t); await W.install(AW);
  const seg = async (label, P, kinds) => { const r = await W.report(P === A ? AW : t); W.log(r); W.check(t, `${P.label}: ${label}`, r, kinds); await W.reset(P === A ? AW : t); return r; };
  const moved = P => W.moved(P === A ? AW : t);
  const ride = async label => {
    await A.game(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
    await A.until(`ctx.state === "playing"`, `guest in her car (${label})`, 30000);
    // (asks again while the host's page catches up — building a town can stall a crawling page for seconds and a ride is
    //  refused while the driver's packets are > 2.5 s old: a player just taps again)
    let r = "";
    for (let i = 0; i < 10; i++) {
      r = await A.game(`ctx.openworld.riding === ${HU} ? "" : ctx.openworld.ride(${HU})`);
      if (await waitOn(A.page, `__lulu3d.ctx.openworld.riding === ${HU}`, 3000)) return true;
    }
    return A.until(`ctx.openworld.riding === ${HU}`, `guest riding with the host (${label}: ${r})`, 3000);
  };
  const hostDrive = async () => {
    await g(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
    return Hp.until(`ctx.state === "playing"`, "host driving", 30000);
  };

  // ════ 1. the driver crosses an ATTACHED town's line with the passenger in ════
  await moved(Hp); await moved(A);
  const E = await g(`ctx.town.exitOf("lakewood") || 0`);   // (Lakewood's own exit — each town has its own)
  for (const P of [Hp, A]) await P.game(`(ctx.town.load("lakewood"), ctx.town.load("midwood"), true)`);
  for (const P of [Hp, A]) await P.until(`ctx.town.loaded("lakewood") && ctx.town.loaded("midwood")`, `${P.label}: both towns' models`, 120000);
  // both up the lane toward the interchange (the towns build in slices from 900 m out, on each screen)
  await g(`ctx.party._debug.place(${E} - 650, 5.25, 12)`);
  await A.game(`ctx.party._debug.place(${E} - 670, 1.75, 0)`);
  await t.hold(7, 0.45);
  await Hp.until(`ctx.town.standing.some(b => b.town === "lakewood" && b.ready)`, "host: Lakewood stands at its interchange", 90000);
  await t.hold(7, 0);
  if (!await A.until(`ctx.town.standing.some(b => b.town === "lakewood" && b.ready)`, "guest: Lakewood stands there too", 90000))
    console.log("   STANDDIAG guest", JSON.stringify(await A.game(`({ st: ctx.state, foot: ctx.foot.active, s: Math.round(ctx.car.s), d: +ctx.car.d.toFixed(1), x: Math.round(ctx.car.pos.x), z: Math.round(ctx.car.pos.z), E: ${E}, town: ctx.town.active, standing: ctx.town.standing.map(b => b.town + ":" + b.ready + ":" + Math.round(b.exitS || b.s || 0)), exits: ctx.town.exits.map(e => e.id + "@" + Math.round(e.s)), joining: ctx.party.joining, riding: ctx.openworld.riding, loaded: ctx.town.loaded("lakewood") })`)));
  // the host stops on Lakewood's approach just short of the line; the guest hops in
  const ap = await g(`(() => { const en = ctx.town.debug.S.built.find(e => e.def.id === "lakewood" && e.ready); if (!en) return null;
    const [fx, fz] = en.def.approach.from, [tx, tz] = en.def.approach.to, L = Math.hypot(tx - fx, tz - fz), ux = (tx - fx) / L, uz = (tz - fz) / L, co = Math.cos(en.at.rot), si = Math.sin(en.at.rot);
    const W = (lx, lz) => ({ x: en.at.x + lx * co + lz * si, z: en.at.z - lx * si + lz * co }); const a = W(fx - ux * 16 + uz * 1.6, fz - uz * 16 - ux * 1.6), b = W(fx - ux * 15 + uz * 1.6, fz - uz * 15 - ux * 1.6);
    return { x: a.x, z: a.z, h: Math.atan2(b.x - a.x, b.z - a.z) }; })()`);
  if (ap) {
    await moved(Hp);
    await g(`(() => { const car = ctx.car, n = ctx.world.road.nearest(${ap.x}, ${ap.z}, car.s, {}); car.place(${ap.x}, ${ap.z}, ${ap.h}); car.s = n.s; car.d = n.d; car.vx = car.vz = car.vF = 0; ctx.cam.snap(); return true; })()`);
    await moved(A);
    await A.game(`(() => { const car = ctx.car, h = ${ap.h}, x = ${ap.x} - Math.sin(h) * 12, z = ${ap.z} - Math.cos(h) * 12, n = ctx.world.road.nearest(x, z, car.s, {}); car.place(x, z, h); car.s = n.s; car.d = n.d; car.vx = car.vz = car.vF = 0; ctx.cam.snap(); return true; })()`);
    await A.frames(20);
    if (await ride("before the line")) {
      await A.frames(10);
      await W.reset(AW); await W.reset(t);
      // the host drives in across the line — on the passenger's screen: frames with the soft-cut overlay up, frames her car
      // stood still while still riding (a freeze)
      await A.L(`(() => { const Q = window.__seamR = { cut: 0, still: 0, maxStill: 0, last: null, f: -1 }; const L3 = __lulu3d, c = L3.ctx;
        const tick = () => { requestAnimationFrame(tick); if (c.frames === Q.f) return; Q.f = c.frames; const sc = document.getElementById("softCut"); if (sc && sc.style.display === "block") { Q.cut++; if (!Q.at) Q.at = { town: c.town.active, zone: c.openworld.zone, state: c.state, standing: c.town.standing.map(b => b.town + (b.ready ? "+" : "-") + Math.round(b.exitS)), car: [Math.round(c.car.pos.x), Math.round(c.car.pos.z)], trans: c.town.transitioning }; }
          const p = c.car.pos; if (c.openworld.riding && Q.last && Math.hypot(p.x - Q.last.x, p.z - Q.last.z) < 0.01) { Q.still++; Q.maxStill = Math.max(Q.maxStill, Q.still); } else Q.still = 0; Q.last = { x: p.x, z: p.z }; };
        requestAnimationFrame(tick); return true; })()`);
      const f0 = await A.game(`ctx.frames`);
      await t.hold(7, 0.5);
      await Hp.until(`ctx.town.active`, "host drives into Lakewood across the line", 30000);
      await A.until(`ctx.town.active && ctx.openworld.riding === ${HU}`, "the passenger comes along into town, still riding", 60000);
      const took = (await A.game(`ctx.frames`)) - f0;
      await t.frames(40); await t.hold(7, 0);
      const cut = await A.L(`!!(window.__qa && window.__qa.issues.some(i => i.kind === "jump"))`);
      const sr = await A.L(`window.__seamR`);
      console.log(`   the passenger crossed the line ${took} frames after the driver set off`, JSON.stringify({ cut: sr.cut, maxStill: sr.maxStill }));
      t.check("riding across the line: no frozen picture (her car never stands still > 1 s while the driver drives on)", sr.maxStill <= 30, JSON.stringify(sr));
      t.check("…and no soft cut / dissolve at the line (the town is attached: it's one road)", sr.cut === 0, JSON.stringify(sr));
      await A.page.screenshot({ path: require("path").join(__dirname, "..", "..", "smoke-shots", "3d-qafriends-ride-in.png") }).catch(() => { });
      await seg("riding across the town line", A, ["nan", "overlay", "flat", "underground", "stuck", "hidden", "jump"]);
      await seg("driving across the town line with a passenger", Hp, ["nan", "overlay", "flat", "underground", "jump", "hidden"]);

      // ════ 2. hop out MOVING in town: her car beside the driver's, not in a parked car / a wall ════
      await t.hold(7, 0.4); await t.frames(30);
      await A.game(`ctx.openworld.hopOut({ moving: true })`);
      await A.until(`ctx.openworld.riding == null && ctx.state === "playing"`, "hop out moving → in her own car alongside", 30000);
      await t.hold(7, 0);
      await A.frames(6);
      const inSolid = await A.L(`(() => { const c = __lulu3d.ctx.car.pos; return window.__qa.solidAt(c.x, c.z, 0.6, 0.6); })()`);
      t.check("hop out moving in town: her car lands clear of walls / parked cars", !inSolid, String(inSolid));
      await seg("hop out moving in town", A, ["nan", "overlay", "jump", "hidden"]);
    }
  } else t.check("Lakewood's approach on the host's screen", false);

  // ════ 3. the driver takes a hard hit mid-ride (a pratfall in a party: no knock-out) ════
  await hostDrive();
  if (await ride("before the knock-out")) {
    await A.frames(15);
    await W.reset(AW);
    await g(`(ctx.party.debug && ctx.party.debug.noBonk ? 0 : 0, ctx.G.invT = 0, ctx.G.invSoft = false, ctx.G.hearts = 1, L3.damage(5, "QA", "qa"), true)`);
    await Hp.until(`ctx.state === "footRun" || ctx.state === "playing"`, "host after the hit", 20000);
    // (in a party nobody loses a heart — a hit is a pratfall, the driver drives on: the ride just goes on)
    await A.frames(60);
    console.log("   after the driver's knock-out:", JSON.stringify(await A.game(`({ state: ctx.state, riding: ctx.openworld.riding, foot: !!ctx.foot.active })`)), "host", await g(`ctx.state`));
    // (the driver's pratfall shove reaches the passenger's screen as network snapshots: the remote car glides it out —
    //  party/remote.js glideRate — so the jump check is on here too)
    await seg("the driver hit mid-ride", A, ["nan", "overlay", "flat", "hidden", "stuck", "nocontrol", "jump"]);
  }

  // ════ 4. the driver is arrested mid-ride ════
  await hostDrive();
  if (await ride("before the arrest")) {
    await A.frames(15);
    await W.reset(AW);
    await g(`(ctx.law.hold && ctx.law.hold(0), ctx.law.arrest(["RECKLESS DRIVING"]), true)`);
    await Hp.until(`ctx.state === "lawArrest"`, "host arrested", 20000);
    // the passenger mustn't be left riding a car that's gone (a frozen picture): let out, or able to hop out
    let stuck = 0;
    for (let i = 0; i < 12; i++) { await A.frames(15); if (await A.game(`ctx.openworld.riding != null && !(ctx.party.remoteCar(${HU}) || {}).shown`)) stuck++; }
    console.log("   during the driver's arrest:", JSON.stringify(await A.game(`({ state: ctx.state, riding: ctx.openworld.riding, shown: !!(ctx.party.remoteCar(${HU}) || {}).shown })`)));
    t.check("the driver arrested: the passenger isn't left riding a car that's vanished (≤ 2 s)", stuck <= 4, `${stuck} × 0.5 s`);
    if (await A.game(`ctx.openworld.riding != null`)) { await A.game(`ctx.openworld.hopOut({ moving: false })`); await A.frames(20); }
    await seg("the driver arrested mid-ride", A, ["nan", "overlay", "flat", "jump", "hidden", "stuck"]);
    await g(`(L3.setState("playing"), ctx.law.hold && ctx.law.hold(99999), true)`);
    await Hp.frames(10);
  }

  // ════ 5. a Free Roam warp to a friend who's in an ATTACHED town ════
  await hostDrive();
  await A.game(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
  await A.until(`ctx.state === "playing" && ctx.openworld.riding == null`, "guest driving on her own", 30000);
  if (!await g(`ctx.town.active`)) await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
  await Hp.until(`ctx.town.active`, "host in Lakewood", 30000);
  if (await A.game(`ctx.town.active`)) { await moved(A); await A.game(`ctx.town.leave("reset")`); await A.game(`ctx.party._debug.place(${E} - 2000, 1.75, 0)`); await A.frames(20); }
  await W.reset(AW);
  await A.game(`(ctx.openworld.warpTo(${HU}), true)`);
  await A.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "the warp lands her in Lakewood with the host", 60000);
  await A.frames(60);
  const near = await A.game(`(() => { const rc = ctx.party.remoteCar(${HU}); return rc && rc.shown ? +Math.hypot(rc.x - ctx.car.pos.x, rc.z - ctx.car.pos.z).toFixed(1) : -1; })()`);
  t.check("…beside the host (≤ 30 m)", near >= 0 && near <= 30, String(near));
  await A.page.screenshot({ path: require("path").join(__dirname, "..", "..", "smoke-shots", "3d-qafriends-warp.png") }).catch(() => { });
  await seg("a Free Roam warp into an attached town", A, ["nan", "overlay", "flat", "underground", "inwall", "stuck", "hidden"]);

  // ════ 6. the driver leaves the party mid-ride ════
  if (await ride("before the driver leaves")) {
    await A.frames(15);
    await W.reset(AW);
    await g(`(ctx.party.leave ? ctx.party.leave() : 0, true)`);
    await A.until(`ctx.openworld.riding == null`, "the driver left the party → the passenger is let out", 40000);
    await A.frames(40);
    t.check("…and she's in control (driving or on foot)", await A.L(`window.__qa.control()`), await A.game(`ctx.state`));
    await seg("the driver leaves the party mid-ride", A, ["nan", "overlay", "flat", "jump", "hidden", "stuck"]);
  }
}
