// 🔗 PARTNERS IN CRIME, part 2 (features/law/crew.js) — two real pages in one party, the LOCAL relay (never production):
//   BREAK OUT TOGETHER  both in the cell vote 🏃 → each picks her own (easier) lock; one makes it, one doesn't →
//                       the one outside ✋ SPRINGS her from the precinct door → both out as fugitives
//   BAIL A FRIEND OUT   one caught alone: the other pays HER OWN coins at the desk → out on bail (still wanted), the
//                       prisoner's wallet untouched; a hacked friend's lowball bail is refused
//   A LEAVER            a partner closes the app mid-cell → the other carries on alone (the court clock runs)
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const path = require("path");
const W = require("../lib/qawatch.js");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 28000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const D = `ctx.law._dbg`, CR = `ctx.law.crew`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");

module.exports = {
  name: "partners2",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 900, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("partners2 threw", false, String(e && e.stack || e).slice(0, 500)); }
    finally {
      for (const g of guests) {
        if (!g.closed) t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

async function body(t, guests) {
  const g = t.game, Hp = hostPage(t);
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
  const A = await guestPage(t, "guest", { totalCoins: 700, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  const both = [Hp, A];
  const all = fn => Promise.all(both.map(fn));
  await all(p => p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(99999), ${D}.FORCE.quietCourt = true,
      window.__noBust = setInterval(() => { const L = ${D}.L; if (L.chase) L.chase.bust = 0; }, 10), true)`));
  const coins = p => p.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
  const chase = (p, why) => p.game(`(${D}.L.grace = 0, ctx.law.startChase(${JSON.stringify(why)}, { msg: "🚨" }))`);
  const CELL = `ctx.law._dbg.jail && ctx.law._dbg.jail() && ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
  const talk = async (p, untilCode, label, max = 400) => {
    for (let i = 0; i < max; i++) {
      if (await p.game(untilCode)) return true;
      const opts = await p.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
      if (opts.length) {
        const idx = opts.findIndex(o => !/💰|Plea|plea|[Bb]ribe|costs/.test(o));
        await p.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${Math.max(0, idx)}].click()`);
        await p.frames(3); continue;
      }
      await p.page.keyboard.press("Enter"); await p.frames(3);
    }
    t.check(`${p.label}: ${label}`, false, "never reached: " + untilCode + " · state " + await p.game(`ctx.state`));
    return false;
  };
  // both in Lakewood, cars in front of the precinct, a few metres apart
  for (const p of both) {
    await p.game(`(ctx.town.load("lakewood"), true)`);
    if (!await p.until(`ctx.town.loaded("lakewood")`, `${p.label}: Lakewood's models`, 120000)) return;
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    if (!await p.until(`ctx.town.active && ctx.town.id === "lakewood" && !!ctx.civic.spot("precinct")`, `${p.label}: in Lakewood`, 60000)) return;
  }
  const carAt = (p, dist, side) => p.game(`(() => { if (ctx.foot.active) ctx.foot.end("test"); if (ctx.state !== "playing") L3.setState("playing"); const sp = ctx.civic.spot("precinct"); const car = ctx.car;
      const x = sp.x + sp.nx * ${dist} + sp.ux * ${side}, z = sp.z + sp.nz * ${dist} + sp.uz * ${side}; car.place(x, z, Math.atan2(sp.ux, sp.uz)); car.vx = car.vz = 0;
      const n = ctx.world.road.nearest(x, z, car.s, {}); car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);
  const caughtTogether = async (label) => {
    await carAt(Hp, 14, 0); await carAt(A, 14, 9);
    await all(p => p.frames(20));
    await all(p => p.game(`(() => { const L = ${D}.L; if (L.chase) ctx.law.standDown("test"); if (L.fug) ctx.law.clearHeat("", { lowKey: false }); L.units.length = 0; return true; })()`));
    await all(p => p.frames(10));
    await chase(Hp, "GRAND THEFT MINIVAN"); await chase(A, "GRAND THEFT MINIVAN");
    for (const p of both) if (!await p.until(`!!${CR}.current() && ${CR}.current().phase === "wanted"`, `${label}: ${p.label} partners`, 60000)) return false;
    await all(p => p.game(`ctx.law.arrest(["GRAND THEFT MINIVAN"], { skipCinematic: true })`));
    const ok = await Promise.all([talk(Hp, CELL, `${label}: host → the cell`), talk(A, CELL, `${label}: guest → the cell`)]);
    if (!ok.every(Boolean)) return false;
    for (const [p, o] of [[Hp, guestUid], [A, hostUid]]) if (!await p.until(`${CR}.debug.cell().includes(${JSON.stringify(o)})`, `${label}: ${p.label} sees her cellmate`, 60000)) return false;
    return true;
  };

  // ── BREAK OUT TOGETHER: both vote 🏃 → both pick; the host makes it, the guest doesn't ──
  if (!await caughtTogether("break")) return;
  await t.L(`document.querySelector("#lawEsc").click()`);
  await Hp.frames(6);
  t.check("one vote isn't a break: the host waits (still in the cell)", await g(`ctx.law._dbg.jail().phase === "cell"`));
  if (!await A.until(`!!document.querySelector("#lawAsk")`, "guest: the card says the host wants to break out", 30000)) return;
  t.check("…in plain words", /BREAK OUT/.test(await A.L(`document.querySelector("#lawAsk").textContent`)));
  await A.L(`document.querySelector("#lawEsc").click()`);
  for (const p of both) if (!await p.until(`ctx.law._dbg.jail().phase === "pick"`, `${p.label}: both said yes → picking her lock`, 30000)) return;
  const pinsH = await g(`ctx.law._dbg.jail().lock.pins`);
  t.check(`the lock is easier with a partner making a scene (${pinsH} pins)`, pinsH <= 3);
  await g(`(() => { const lk = ctx.law._dbg.jail().lock; lk.result = "win"; lk.resultT = 0; return true; })()`);
  await A.game(`(() => { const lk = ctx.law._dbg.jail().lock; lk.result = "lose"; lk.resultT = 0; return true; })()`);
  if (!await A.until(CELL, "guest: missed → back in the cell", 30000)) return;
  if (!await Hp.until(`ctx.state === "footRun" && ctx.law.fugitive`, "host: out of the precinct as a fugitive", 60000)) return;
  const dH = await g(`(() => { const s = ctx.civic.spot("precinct"), p = ctx.foot.pos; return Math.hypot(s.x - p.x, s.z - p.z); })()`);
  t.check(`one out (at the precinct door, ${dH.toFixed(1)} m), one in`, dH < 6 && await A.game(CELL));
  // the one outside comes back for her: ✋ SPRING at the door
  await g(`(() => { const sp = ctx.civic.spot("precinct"), F = ctx.foot.debug.F; F.pos.set(sp.x - sp.nx * 1.2, 0.05, sp.z - sp.nz * 1.2); return true; })()`);
  await Hp.frames(10);
  const prompt = await t.L(`(() => { const e = document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);
  t.check("✋ SPRING <name> at the precinct door", /SPRING Latke Legend/.test(prompt), prompt);
  await t.shot("spring-at-door");
  const why = await g(`${CR}.springOut(${GU})`);
  t.check("the spring goes out", why === "", why);
  if (!await A.until(`!!document.querySelector("#lawHelp")`, "guest: 🔓 the host is at the back door — GO!", 30000)) return;
  await A.page.screenshot({ path: path.join(SHOTS, "partners2-spring-offer-guest.png") }).catch(() => { });
  await A.L(`document.querySelector("#lawHelp").click()`);
  if (!await A.until(`ctx.state === "footRun" && ctx.law.fugitive`, "guest: out of the door as a fugitive too", 60000)) return;
  const pG = await A.game(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`), pH = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`);
  t.check(`…right by her partner (${Math.hypot(pG.x - pH.x, pG.z - pH.z).toFixed(1)} m)`, Math.hypot(pG.x - pH.x, pG.z - pH.z) < 8);
  if (await Hp.until(`ctx.law.warrants.includes("AIDING AN ESCAPE")`, "host: springing her is on HER record", 30000)) t.check("the spring is the helper's own charge (AIDING AN ESCAPE)", true);

  // ── BAIL A FRIEND OUT: the guest alone in the cell; the host pays at the desk ──
  await all(p => p.game(`(() => { const L = ${D}.L; if (L.chase) ctx.law.standDown("test"); ctx.law.clearHeat("", { lowKey: false }); return true; })()`));
  await carAt(A, 14, 9);
  await A.frames(10);
  await A.game(`ctx.law.arrest(["LOITERING NEAR A KNISH"], { skipCinematic: true })`);
  if (!await talk(A, CELL, "bail: guest → the cell (alone)")) return;
  if (!await Hp.until(`${CR}.friendsInside().some(f => f.uid === ${GU} && f.bail > 0)`, "host: knows her friend's in this precinct's cell + the bail", 30000)) return;
  const bail = (await g(`${CR}.friendsInside()`)).find(f => f.uid === guestUid).bail;
  // a lowball (a hacked page): refused, she stays in
  await g(`(ctx.party.sendEvent("pzh", ${GU}, "bail", 1), true)`);
  await all(p => p.frames(40));
  t.check("a lowball bail is refused (she's still in the cell)", await A.game(CELL));
  const h0 = await coins(Hp), g0 = await coins(A);
  // the desk: the label offers it
  t.check("the desk offers it (interiors' precinct)", await g(`ctx.interiors && !!ctx.interiors.police`));
  const r = await g(`${CR}.bailOut(${GU})`);
  t.check("bail paid at the desk", r === "", r);
  if (!await A.until(`ctx.state === "footRun"`, "guest: bailed out → out the precinct door", 60000)) return;
  await Hp.until(`window.__lulu3d && true`, "", 1000);
  await Hp.frames(30);
  const h1 = await coins(Hp), g1 = await coins(A);
  t.check(`the HOST paid exactly the bail (💰${bail}: ${h0} → ${h1})`, h0 - h1 === bail);
  t.check(`the guest's wallet untouched (${g0} → ${g1})`, g1 === g0);
  t.check("…and she's still WANTED till court (the bail rule)", await A.game(`ctx.law.warrants.length > 0`));

  // ── A LEAVER mid-cell: caught together, then the guest closes the app → the host carries on alone ──
  await all(p => p.game(`(() => { ctx.law.clearHeat("", { lowKey: false }); return true; })()`));
  if (!await caughtTogether("leaver")) return;
  await W.install(t);
  const c0 = await g(`ctx.law._dbg.jail().courtT`);
  A.closed = true;
  await A.page.close();
  if (!await Hp.until(`${CR}.debug.cell().length === 0`, "host: the leaver's gone from the cell", 60000)) return;
  await Hp.frames(60);
  t.check("…the court clock still runs (nobody's stuck waiting)", (await g(`ctx.law._dbg.jail().courtT`)) < c0);
  await g(`(ctx.law._dbg.jail().courtT = 1, ${D}.FORCE.verdict = "dismissed", true)`);
  if (!await talk(Hp, `ctx.state === "footRun"`, "host: court alone → out")) return;
  W.check(t, "the leaver: host alone through court + out", await W.report(t), ["nan", "overlay", "stuck", "hidden"]);
}
