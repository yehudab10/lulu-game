// 🎉🏦 heist in a party — two real pages against the LOCAL relay (server/local-relay.js on a private port; never
// production). Only heist's PERSONAL bits run with friends; nothing of it touches the shared traffic:
//   GATE      heist is ON in a party (not in the OFF set); Lulu's own heist stays solo (live("job") false), the
//             robbery is party-OK but only in a Free Roam TOWN (foiled together — tests3d/bankfriends.js), so out on
//             the highway the robbery scheduler stages nothing; the personal bits are live
//   🛵 SNATCH the host stops on the shoulder → the scheduler sends a moped (a scene prop, never in the traffic): a
//             HONK dodges it; too slow → he grabs a CAPPED share; clip him → it all comes back (+ the bonus)
//   🚗 THEFT  she parks + walks off → a thief drives off in HER parked car (foot's local stub) → ✋ YANK HIM OUT
//   🫳 UNDERWORLD only its pickpocket runs with friends: on foot the scheduler sends one, he lifts a CAPPED amount,
//             ✋ TACKLE → it all comes back; while she DRIVES no bad-guy car ever joins the shared traffic
//   🕸️ GEAR   a 4★ chase of her own: a stun net lands and wears off; a spike strip → a flat
//   SYNC      all the while the shared traffic sits exactly where the party clock says on both screens, the guest
//             never freezes, has none of it (no snatcher / thief / net on the guest), and no stray local cars
const { spawn } = require("child_process");
const path = require("path");
const { waitOn } = require("../lib/party3d.js");
const PORT = 25000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=party,foot,law,heist,underworld,community,streets,rides,world,atmos,phone&mpurl=${encodeURIComponent(URL)}`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");
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
      t.check(`${label}: ${what}`, false, "timed out in " + await page.evaluate(`window.__lulu3d && __lulu3d.state`).catch(() => "?"));
      return false;
    },
    shot: name => page.screenshot({ path: path.join(SHOTS, `3d-partyheist-${name}.png`) }).catch(() => { }),
  };
}
async function hostUntil(t, code, what, ms = 90000) {
  if (await waitOn(t.page, code, ms)) return true;   // GAME time (frames), not wall time
  t.check(what, false, "timed out in " + await t.game(`ctx.state`).catch(() => "?"));
  return false;
}
const clickSel = async (t, sel) => { const ok = await t.L(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b) b.click(); return !!b; })()`); await sleep(250); return ok; };
/** Every live shared car sits where the party clock says (gone ones excluded); claimed cars where claimPose says. */
const SYNC = `(() => { const live = ctx.party.trafficLive(); let bad = 0; for (const c of live) { const w = ctx.party.trafficAt(c.at, c.s - 5, c.s + 5).find(x => x.key === c.key); if (!w || Math.abs(w.s - c.s) > 0.05 || ctx.party.trafficGone(c.key)) bad++; }
  let cbad = 0; const cl = ctx.party.claimsLive(); for (const c of cl) { const p = ctx.party.claimPose(c.key, c.at); if (!p || Math.abs(p.s - c.s) > 0.05 || Math.abs(p.d - c.d) > 0.05) cbad++; }
  return { n: live.length, bad, claims: cl.length, cbad, locals: ctx.traffic.cars.filter(c => !(c.data && c.data.party)).map(c => Object.keys(c.data || {}).filter(k => c.data[k]).join("+")) }; })()`;

module.exports = {
  name: "partyheist",
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
  await t.game(`(ctx.party.hostParty(), true)`);     // (the lobby has no hub button any more: games are votes in 🌍 Free Roam — ci/friends stage 2)
  if (!await hostUntil(t, `ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`, "host: lobby")) return;
  const code = await g(`ctx.party.code`);
  const A = await guestPage(t, "guest", { totalCoins: 400, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `&party=${code}`);
  guests.push(A);
  if (!await A.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "joins from the link", 180000)) return;
  await hostUntil(t, `ctx.party.players.length === 2`, "two in the lobby");
  await clickSel(t, "#pt_act_trip");
  await clickSel(t, "#pt_go");
  const pages = [{ label: "host", game: c => t.game(c), until: (c, w, ms) => hostUntil(t, c, w, ms) }, A];
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "trip"`, "road trip: GO", 90000)) return;
  // quiet the dice we don't test here (the law's traps, Shmuel's calls); heist's own schedulers stay as they are
  for (const p of pages) await p.game(`(ctx.law.hold(9999), ctx.streets.debug.CHOP.nextT = 1e9, true)`);
  await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["heist:robbery", "heist:job", "heist:snatch", "heist:theft", "heist:gear"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 120))); })`);
  await A.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["heist:robbery", "heist:job", "heist:snatch", "heist:theft", "heist:gear"]) m.on(n, e => __ev.push(n)); })`);
  const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
  const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
  const HD = `ctx.heist.debug`;
  const sync = async what => {
    const s1 = await g(SYNC), s2 = await A.game(SYNC);
    t.check(`sync (${what}): the shared traffic sits where the party clock says on both screens`, s1.bad === 0 && s1.cbad === 0 && s2.bad === 0 && s2.cbad === 0 && s2.n >= 2, JSON.stringify({ s1, s2 }).slice(0, 260));
    t.check(`sync (${what}): the guest has no stray local cars`, s2.locals.every(k => /footStub|law|local|partyClaim|partyLocal/.test(k)), JSON.stringify(s2.locals));
  };
  const frozen = async what => {
    // (a crawling CI page can draw no frame in a fixed 1.2 s: give it up to 30 s to show it's alive)
    const a = await A.game(`({ t: ctx.time, c: ctx.party.clock() })`); let b = a;
    for (let i = 0; i < 25; i++) { await sleep(1200); b = await A.game(`({ t: ctx.time, c: ctx.party.clock() })`); if (b.t > a.t && b.c > a.c + 700) break; }
    t.check(`guest never frozen (${what})`, b.t > a.t && b.c > a.c + 700, JSON.stringify({ a, b }));
  };

  // ── the gate ──
  t.check("party: heist is ON with friends (not in the OFF set)", await g(`ctx.enabled("heist")`) && await A.game(`ctx.enabled("heist")`));
  t.check("party: Lulu's own heist stays solo; the snatcher / thief / the cops' gear are live (robberies: towns only, foiled together)",
    await g(`!${HD}.live("job") && ${HD}.live("snatch") && ${HD}.live("gear")`));
  t.check("party: on the highway the robbery scheduler stages nothing", (await g(`${HD}.schedRobbery()`)) === false && await g(`!ctx.heist.robbery`));
  await t.L(`import("./js/models.js").then(m => m.ensureModels(["heistMoped", "heistRobber", "heistProps", "heistNet", "heistSpikes"]))`);

  // ── 🛵 the moped snatcher: she stops on the shoulder, the scheduler sends one ──
  const s0 = await g(`Math.round(ctx.car.s) + 60`);
  await g(`(ctx.party.placeCar(${s0}, 7.9, 0), true)`);
  await A.game(`(ctx.party.placeCar(${s0} - 40, 5.25, 0), true)`);
  // (two pages in software WebGL run the game at a crawl: skip the waits that are only game time — the stop's 2.4 s,
  //  the moped's creep-up, the thief's sneak — and give everything else plenty of real time)
  await g(`(${HD}.SN.nextT = 0, ${HD}.SN.still = 99, true)`);
  const SKIP = `(ctx.heist.snatcher && ctx.heist.snatcher.phase === "approach" && (ctx.heist.snatcher.t = 9), true)`;
  const sent = await hostUntil(t, `!!ctx.heist.snatcher`, "stopped in a party: the scheduler sends a moped", 60000);
  if (sent) await g(SKIP);
  if (sent && await hostUntil(t, `ctx.heist.snatcher && ctx.heist.snatcher.phase === "warn"`, "…it creeps up (the warning)", 60000)) {
    await t.shot("snatch-warn");
    t.check("the moped is a scene prop, not a car in the traffic", await g(`!ctx.traffic.cars.some(c => c.obj === ctx.heist.snatcher.obj)`));
    await sync("a moped creeping up");
    const c0 = await coins();
    await t.tap(4);
    await hostUntil(t, `window.__ev.some(e => /heist:snatch.*"dodged"/.test(e))`, "HONK → he wobbles off", 30000);
    t.check("a honk dodges him (no coins lost)", (await coins()) === c0, `${c0} → ${await coins()}`);
    await g(`${HD}.endSnatch()`);
  }
  // too slow: he grabs a capped share; clip him → it all comes back
  const before = await coins();
  t.check("a moped grab (debug start)", await g(`${HD}.snatch("car")`), `wallet ${before}`);
  await g(SKIP);
  if (await hostUntil(t, `ctx.heist.snatcher && ctx.heist.snatcher.phase === "flee"`, "too slow: he grabs and flees", 60000)) {
    const take = await g(`ctx.heist.snatcher.take`), mid = await coins();
    t.check("the snatch is CAPPED (≤ 12 % of the wallet, ≤ 45)", take > 0 && take <= 45 && take <= Math.ceil(before * 0.12) && before - mid === take, `took ${take} of ${before}`);
    await g(`(() => { const e = ctx.heist.snatcher, car = ctx.car, p = ctx.world.road.point(ctx.world.road.nearest(e.x, e.z, car.s, {}).s - 1.5, e.d, {}); car.place(p.x, p.z, p.h); car.vx = Math.sin(p.h) * 12; car.vz = Math.cos(p.h) * 12; return true; })()`);
    await hostUntil(t, `window.__ev.some(e => /heist:snatch.*"caught"/.test(e))`, "clip the moped → caught", 30000);
    const after = await coins();
    t.check("catching him refunds it all (+ the bonus)", after >= before + 10 && after <= before + 40, `${before} → ${mid} → ${after}`);
    await g(`${HD}.endSnatch()`);
  }
  t.check("guest: no snatcher on the guest's screen (it's hers)", await A.game(`!ctx.heist.snatcher && !window.__ev.length`));
  await frozen("snatch");

  // ── 🚗 the car thief: she parks + walks off, he drives off in HER car ──
  const s1 = await g(`Math.round(ctx.car.s) + 40`);
  await g(`(ctx.party.placeCar(${s1}, 7.9, 0), true)`);
  await sleep(500);
  await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  if (await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "parked + out walking", 30000)) {
    await g(`(() => { const F = ctx.foot.debug.F, p = ctx.world.road.point(F.s + 32, 9.5, {}); F.pos.set(p.x, 0.05, p.z); F.peds.forEach(x => x.s += 400); return true; })()`);
    await t.frames(4);
    t.check("a thief tries her parked car (in a party)", await g(`${HD}.carTheft()`));
    await g(`(ctx.heist.thief && (ctx.heist.thief.t = 3.3), true)`);
    if (await hostUntil(t, `ctx.heist.thief && ctx.heist.thief.phase === "drive"`, "too late — he drives off in it", 60000)) {
      await t.frames(20);
      t.check("the stolen car is her own local stub (never a shared car)", await g(`(() => { const c = ctx.heist.thief.car; return !!c && !!c.data && !c.data.party && !!c.data.footStub; })()`));
      await t.shot("theft-drive");
      await sync("a thief in her car");
      await g(`(() => { const c = ctx.heist.thief.car, F = ctx.foot.debug.F, lx = Math.cos(c.h), lz = -Math.sin(c.h); F.pos.set(c.x + lx * 2.6, 0.05, c.z + lz * 2.6); F.phase = "walk"; return true; })()`);
      await t.frames(2);
      await t.tap(0);
      await hostUntil(t, `window.__ev.some(e => /heist:theft.*"recovered"/.test(e))`, "✋ YANK HIM OUT", 30000);
      t.check("her car is hers again", await g(`ctx.foot.ownCar === "parked" && !!ctx.foot.parkedCar && !ctx.foot.parkedCar.wrecked`));
      await g(`(() => { const c = ctx.foot.parkedCar, F = ctx.foot.debug.F; F.pos.set(c.x + Math.cos(c.h) * 1.8, 0.05, c.z - Math.sin(c.h) * 1.8); return true; })()`);
      await t.frames(60);
      await t.tap(0);
      await hostUntil(t, `ctx.state === "playing" && !ctx.foot.active`, "✋ GET BACK IN — her own car", 40000);
    }
    if (await g(`ctx.heist.thief`)) await g(`${HD}.endTheft()`);
  }
  t.check("guest: no thief on the guest's screen", await A.game(`!ctx.heist.thief && !window.__ev.length`));
  await frozen("theft");

  // ── 🫳 underworld: only the pickpocket, on foot ──
  const UD = `ctx.underworld.debug`;
  t.check("underworld: ON with friends, but only the pickpocket (no bad-guy cars / offers / Fixer)", await g(`ctx.enabled("underworld") && !ctx.underworld.live && ctx.underworld.liveFor("pickpocket")`));
  if (await g(`ctx.state === "playing"`)) {
    t.check("underworld: while she drives no bad guy can show up in a party", (await g(`ctx.underworld.why()`)) !== "", await g(`ctx.underworld.why()`));
    await g(`ctx.underworld.spawn("rager").then(r => (window.__rager = r === null))`);
    await t.frames(4);
    t.check("underworld: a bad-guy car is refused (it would sit in the shared traffic on one screen)", await g(`window.__rager === true && !ctx.underworld.enc && !ctx.traffic.cars.some(c => c.data && c.data.uw)`));
    const sp = await g(`Math.round(ctx.car.s) + 50`);
    await g(`(ctx.party.placeCar(${sp}, 7.9, 0), true)`);
    await sleep(500);
    await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
  }
  if (await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "on foot for the pickpocket", 30000)) {
    await t.L(`import("./js/models.js").then(m => m.ensureModels(["uw_pickpocket", "npcMan"]))`);
    await g(`(ctx.foot.debug.F.t = 99, ctx.foot.debug.F.peds.forEach(x => x.s += 400), ${UD}.UW.runT = 999, ${UD}.UW.nextT = 0, ${UD}.UW.force.always = true, true)`);
    const w0 = await coins();
    if (await hostUntil(t, `!!ctx.underworld.debug.E && !!ctx.underworld.debug.E.p`, "on foot in a party: the scheduler sends a pickpocket", 60000)) {
      await g(`(${UD}.UW.force.always = false, ${UD}.UW.nextT = 1e9, true)`);
      await g(`(() => { const E = ${UD}.E, F = ctx.foot.pos; E.x = F.x + 0.6; E.z = F.z + 0.4; return true; })()`);
      if (await hostUntil(t, `ctx.underworld.debug.E && ctx.underworld.debug.E.phase === "run"`, "the bump-and-lift", 60000)) {
        const stolen = await g(`${UD}.E.stolen`), w1 = await coins();
        t.check("he lifts a CAPPED amount (≤ 30)", stolen > 0 && stolen <= 30 && w0 - w1 === stolen, `${stolen} (${w0} → ${w1})`);
        await t.shot("pickpocket");
        await sync("a pickpocket on the run");
        await g(`(() => { const E = ${UD}.E, F = ctx.foot.debug.F; const n = ctx.world.road.nearest(E.x, E.z, ctx.car.s, {}); const p = ctx.world.road.point(n.s - E.dir * 1.5, n.d, {}); F.pos.set(p.x, 0, p.z);
          const pr = ctx.foot.debug.interactables(); if (pr && /TACKLE/.test(pr.label)) pr.ent.act(); else ${UD}.tackle(${UD}.E, "lulu"); return true; })()`);
        await t.frames(6);
        const w2 = await coins();
        t.check("TACKLE: the coins come back (+ a little)", w2 >= w1 + stolen && w2 <= w1 + stolen + 10, `${w1} → ${w2} (stolen ${stolen})`);
      }
    }
    t.check("guest: no pickpocket on the guest's screen (he's hers)", await A.game(`!ctx.underworld.debug.E`));
    await g(`(() => { const c = ctx.foot.parkedCar, F = ctx.foot.debug.F; if (c) F.pos.set(c.x + Math.cos(c.h) * 1.8, 0.05, c.z - Math.sin(c.h) * 1.8); return true; })()`);
    await t.frames(30);
    await t.tap(0);
    await hostUntil(t, `ctx.state === "playing" && !ctx.foot.active`, "back in her car after the pickpocket", 40000);
  }
  await frozen("pickpocket");

  // ── 🕸️ the cops' gear in a chase of her own ──
  if (await g(`ctx.state === "playing"`)) {
    const s2 = await g(`Math.round(ctx.car.s) + 80`);
    await g(`(ctx.party.placeCar(${s2}, 1.75, 30), ctx.law.startChase("RECKLESS DRIVING", { heat: 4 }), true)`);
    await t.frames(5);
    t.check("a 4★ chase of her own (law is personal in a party)", await g(`ctx.law.chasing && ctx.law.wanted >= 4`));
    t.check("a stun net is fired", await g(`ctx.heist.gear.fireNet(null, { sure: true })`));
    if (await hostUntil(t, `ctx.heist.gear.netted`, "the net lands on her", 30000)) {
      await t.shot("netted");
      await sync("netted in a chase");
      await hostUntil(t, `!ctx.heist.gear.netted`, "the net rips off (wears off)", 120000);
    }
    await g(`(ctx.law.standDown("test"), true)`);
    await g(`(ctx.party.placeCar(Math.round(ctx.car.s) + 30, 1.75, 24), true)`);
    await t.frames(2);
    t.check("a spike strip is tossed ahead", await g(`ctx.heist.gear.laySpikes(12, 1.75)`));
    if (await hostUntil(t, `window.__ev.some(e => /heist:gear.*"spikes".*"hit"/.test(e))`, "over the spike strip → flat", 40000)) {
      t.check("spiked: a flat", await g(`ctx.heist.gear.flat`));
    }
    t.check("guest: none of her gear on the guest's screen", await A.game(`!ctx.heist.gear.netted && !ctx.heist.gear.flat && !window.__ev.length`));
  }
  await frozen("gear");
  await sync("the end");
  t.check("no robbery was ever staged in the party", (await evs(`/heist:robbery/`)).length === 0);
  await A.shot("guest-end");
  await g(`ctx.party.leave()`);
}
