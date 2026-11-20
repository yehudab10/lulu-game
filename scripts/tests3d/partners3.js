// 🔗 CRIMES FOR TWO (features/partners) — two real pages in one party against the LOCAL relay (never production):
//   🎲 DOUBLE DARE     both warned for the same thing, close together → 15 💰 each (the 30 pot split), the daily cap holds,
//                      a friend far away = nothing
//   🚗 FLAG & GRAB     one flags a car, the other jacks it → partners (one crew) + 15 💰 each, the run cap holds
//   🔔 RING & SNEAK    one sneaks into a house, the other rings the bell → everyone inside goes to the door on HER
//                      screen; out clean → 10 💰 each
//   🍌 GETAWAY PEELS   riding in a chased friend's car: a peel → a cruiser behind the DRIVER spins out
//   A hacked friend's broadcast can never pay me: every share is paid by MY screen for MY own part
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 29000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,homes&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const D = `ctx.law._dbg`, CR = `ctx.law.crew`, PZ = `ctx.partners`;

module.exports = {
  name: "partners3",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("partners3 threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  t.check("ctx.partners service", await g(`!!${PZ} && typeof ${PZ}.ring === "function" && ${PZ}.PAY.dare.pot === 30`));
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 300, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  const both = [Hp, A];
  const all = fn => Promise.all(both.map(fn));
  await all(p => p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ${PZ}.debug.resetCaps(),
      window.__noBust = setInterval(() => { const L = ${D}.L; if (L.chase) L.chase.bust = 0; }, 10), true)`));
  const coins = p => p.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
  const calm = () => all(p => p.game(`(() => { const L = ${D}.L; if (L.chase) ctx.law.standDown("test"); L.units.length = 0; L.sus = 0; return true; })()`));
  const warn = (p, c) => p.game(`(${D}.L.grace = 0, ${D}.L.hold = 0, ${D}.L.partyHold = 0, ${D}.L.sus = 0, ctx.law.notice(${JSON.stringify(c)}, { msg: "⚠️" }))`);

  // ── 🎲 DOUBLE DARE: far apart first (nothing), then side by side ──
  await g(`ctx.party._debug.place(400, 1.75, 0)`); await A.game(`ctx.party._debug.place(950, 1.75, 0)`);
  await all(p => p.frames(12));
  let h0 = await coins(Hp), g0 = await coins(A);
  await warn(Hp, "RUNNING A STOP SIGN"); await warn(A, "RUNNING A STOP SIGN");
  await all(p => p.frames(60));
  t.check("a dare 550 m apart pays nothing", (await coins(Hp)) === h0 && (await coins(A)) === g0);
  await calm(); await all(p => p.frames(10));
  await A.game(`ctx.party._debug.place(410, -1.75, 0)`);
  await all(p => p.frames(12));
  h0 = await coins(Hp); g0 = await coins(A);
  await warn(Hp, "SPEEDING IN A SCHOOL ZONE"); await warn(A, "SPEEDING IN A SCHOOL ZONE");
  const dareOk = await Promise.all([Hp.until(`${PZ}.debug.S.dare >= 1`, "host: DOUBLE DARE", 30000), A.until(`${PZ}.debug.S.dare >= 1`, "guest: DOUBLE DARE", 30000)]);
  if (dareOk.every(Boolean)) {
    const dh = (await coins(Hp)) - h0, dg = (await coins(A)) - g0;
    t.check(`DOUBLE DARE pays the pot split: 15 + 15 (host +${dh}, guest +${dg})`, dh === 15 && dg === 15);
  }
  // the daily cap: 3 a day on each device
  await calm(); await all(p => p.game(`(${PZ}.debug.S.dare = 3, true)`)); await all(p => p.frames(10));
  h0 = await coins(Hp);
  await warn(Hp, "HONKING AT A SHUL"); await warn(A, "HONKING AT A SHUL");
  await all(p => p.frames(60));
  t.check("…capped at 3 a real day (the 4th pays nothing)", (await coins(Hp)) === h0);
  // a hacked friend shouting "dare!" while I did nothing: nothing for me
  h0 = await coins(Hp);
  await A.game(`(ctx.party.broadcast("pzd", "LOITERING", 0, 0), ctx.party.broadcast("pzs", "x", ${HU}), ctx.party.broadcast("pzg", "k", ${HU}), true)`);
  await all(p => p.frames(60));
  t.check("a friend's broadcasts alone never pay me", (await coins(Hp)) === h0);
  await calm(); await all(p => p.game(`(${PZ}.debug.resetCaps(), true)`));

  // ── 🚗 FLAG & GRAB: the guest flags a car, the host jacks it ──
  await g(`ctx.party._debug.place(400, 1.75, 0)`); await A.game(`ctx.party._debug.place(412, -1.75, 0)`);
  await all(p => p.frames(12));
  h0 = await coins(Hp); g0 = await coins(A);
  await A.game(`${PZ}.debug.flag("pt:test:1")`);
  await A.frames(20);
  if (await Hp.until(`${PZ}.debug.R.flags.has("pt:test:1")`, "host hears the flag", 30000)) await g(`${PZ}.debug.jack("pt:test:1")`);
  const grab = await Promise.all([Hp.until(`${PZ}.debug.R.grab >= 1`, "host: FLAG & GRAB", 30000), A.until(`${PZ}.debug.R.grab >= 1`, "guest: FLAG & GRAB", 30000)]);
  if (!grab.every(Boolean)) t.check("FLAG & GRAB: why not", false, JSON.stringify(await g(`({ why: ${PZ}.debug.R.why, flags: [...${PZ}.debug.R.flags.entries()], me: ctx.car.pos })`)));
  if (grab.every(Boolean)) t.check(`FLAG & GRAB: 15 + 15 (host +${(await coins(Hp)) - h0}, guest +${(await coins(A)) - g0})`, (await coins(Hp)) - h0 === 15 && (await coins(A)) - g0 === 15);
  const crewG = await Promise.all(both.map(p => p.until(`!!${CR}.current() && ${CR}.current().why === "FLAG & GRAB"`, `${p.label}: partners for the FLAG & GRAB`, 40000)));
  if (crewG.every(Boolean)) t.check("…and they're partners (one crew)", true);

  // ── 🍌 GETAWAY PEELS: the guest rides with the host; the host is chased; a peel spins a cruiser ──
  await calm(); await all(p => p.frames(10));
  await A.game(`ctx.party._debug.place(406, 1.75, 0)`); await g(`ctx.party._debug.place(400, 1.75, 0)`);
  await all(p => p.frames(10));
  await g(`(${D}.L.grace = 0, ctx.law.startChase("SPEEDING", { msg: "🚨" }))`);
  if (!await Hp.until(`ctx.law.chasing && ${D}.L.units.some(u => u.mode === "chase" && u.car)`, "host: chased, a cruiser behind", 30000)) return;
  const why = await A.game(`ctx.openworld.ride(${HU})`);
  if (!await A.until(`ctx.openworld.riding === ${HU}`, "guest rides in the host's car", 30000)) { t.check("ride", false, String(why)); return; }
  if (!await A.until(`${PZ}.peelOk`, "guest: 🍌 PEEL is offered (her driver's being chased)", 30000)) return;
  t.check("…the 🍌 PEEL touch button exists", await A.L(`!!document.getElementById("tx_pzPeel")`));
  await A.game(`${PZ}.peel()`);
  if (await Hp.until(`${D}.L.units.some(u => u.car && u.car.hit)`, "host: a cruiser behind her spins out", 30000)) t.check("a peel from the passenger spins out a cruiser on the DRIVER's screen", true);
  await A.game(`(ctx.openworld.hopOut(), true)`);
  await A.until(`!ctx.openworld.riding`, "guest hops out", 20000);
  await calm(); await all(p => p.frames(10));

  // ── 🔔 RING & SNEAK: Lakewood; the guest sneaks into a house, the host rings the bell ──
  for (const p of both) {
    await p.game(`(() => { if (ctx.foot.active) ctx.foot.end("test"); if (ctx.state !== "playing") L3.setState("playing"); return true; })()`);
    await p.frames(4);
    await p.game(`(ctx.town.load("lakewood"), true)`);
    if (!await p.until(`ctx.town.loaded("lakewood")`, `${p.label}: Lakewood's models`, 120000)) return;
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    if (!await p.until(`ctx.town.active && ctx.town.id === "lakewood"`, `${p.label}: in Lakewood`, 60000)) return;
    await p.game(`ctx.foot.start("parked")`);
    if (!await p.until(`ctx.state === "footRun" && ctx.foot.phase === "walk" && ctx.homes.homes().length > 0`, `${p.label}: walking in town`, 60000)) return;
  }
  await all(p => p.game(`(${PZ}.debug.resetCaps(), true)`));
  const hi = 3;
  const key = await A.game(`(() => { const h = ctx.homes.homes()[${hi}]; ctx.foot.debug.F.pos.set(h.ap.x, 0.05, h.ap.z); return h.key; })()`);
  await A.frames(4);
  await A.game(`ctx.homes.enter(${hi}, "sneak", "door")`);
  if (!await A.until(`ctx.state === "interior" && ctx.homes.house && ctx.homes.house.mode !== "guest"`, "guest sneaks in", 60000)) return;
  if (!await Hp.until(`${PZ}.palInside(${JSON.stringify(key)}) === ${GU}`, "host: knows her friend is inside that house", 30000)) return;
  h0 = await coins(Hp); g0 = await coins(A);
  await A.L(`window.__rung = 0; import("./js/core/ctx.js").then(m => m.on("partners:rung", e => { window.__rung = e.n; }))`);
  t.check("the bell rings", await g(`${PZ}.ring(${JSON.stringify(key)})`));
  if (!await A.until(`window.__rung > 0`, "guest: everyone inside heads for the door", 30000)) return;
  t.check(`…the residents are distracted on HER screen (${await A.L(`window.__rung`)})`, true);
  await A.L(`import("./js/features/interiors/engine.js").then(m => m.current().leave())`);
  const ring = await Promise.all([Hp.until(`${PZ}.debug.R.ring >= 1`, "host: CLEAN JOB", 60000), A.until(`${PZ}.debug.R.ring >= 1`, "guest: CLEAN JOB", 60000)]);
  if (ring.every(Boolean)) t.check(`RING & SNEAK out clean: 10 + 10 (host +${(await coins(Hp)) - h0}, guest +${(await coins(A)) - g0})`, (await coins(Hp)) - h0 === 10 && (await coins(A)) - g0 === 10);
}
