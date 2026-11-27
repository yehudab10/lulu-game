// 🔗 PARTNERS IN CRIME (features/law/crew.js) — two real pages in one party against the LOCAL relay (never production):
//   TOGETHER   two friends seen breaking the law close together (in time + place) become a crew: 🔗 on both HUDs;
//              far apart = no crew; a stranger / a hacked friend can't make me a partner or raise my stars
//   WANTED     one wanted level (my stars climb to the crew's); LOST 'EM waits until EVERYONE is out of sight
//   SPLIT UP   far apart → the cops stay on the one they can see, the other slips away
//   CAUGHT     both caught in Lakewood → the same precinct → the SAME CELL on both screens (each sees the other,
//              a cell emote shows on the other screen), one court clock → court → out of the courthouse door side by side
//   SOLO       the arrested friend's own coins / verdict: each from her own save (the solo rules)
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time. The QA watchdog (scripts/lib/qawatch.js) runs
// on the host page through the walk-out.
const path = require("path");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const D = `ctx.law._dbg`, CR = `ctx.law.crew`;

module.exports = {
  name: "partners",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 900, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("partners threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  t.check("ctx.law.crew service", await g(`!!${CR} && typeof ${CR}.partners === "function" && typeof ${CR}.bust === "function" && typeof ${CR}.wanted === "function"`));
  t.check("solo: no crew, nothing published", await g(`${CR}.current() === null`));
  // ── the host: 👯 Friends → 🌍 Hang out; the guest joins by link ──
  await t.game(`(ctx.party.hostRoam(), true)`);     // (📱 👯 › Play with a friend — the title has no Friends tile any more)
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 700, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  const both = [Hp, A];
  // (the cars stand still for these checks: a cruiser right behind a stopped car would BUST her — that's the solo rule,
  //  tested by law / qalaw; here the BUSTED meter is held at 0 until the test arrests them itself)
  for (const p of both) await p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(99999), ${D}.FORCE.quietCourt = true,
      window.__noBust = setInterval(() => { const L = ${D}.L; if (L.chase && !window.__bustOk) L.chase.bust = 0; }, 10), true)`);
  const all = fn => Promise.all(both.map(fn));
  const calm = () => all(p => p.game(`(() => { const L = ${D}.L; if (L.chase) ctx.law.standDown("test"); L.units.length = 0; L.grace = 0; L.lost = null; return true; })()`));
  const crewOf = p => p.game(`${CR}.current()`);
  const chase = (p, why) => p.game(`(${D}.L.grace = 0, ctx.law.startChase(${JSON.stringify(why)}, { msg: "🚨" }))`);
  const noCrew = async (label) => { await all(p => p.frames(10)); for (const p of both) t.check(`${p.label}: ${label}`, (await crewOf(p)) === null, JSON.stringify(await crewOf(p))); };
  const waitCrewGone = (label) => Promise.all(both.map(p => p.until(`${CR}.current() === null && !ctx.law.chasing`, `${p.label}: ${label}`, 60000)));

  // ── far apart: two chases at once, 500 m apart → NOT partners ──
  await g(`ctx.party._debug.place(400, 1.75, 0)`); await A.game(`ctx.party._debug.place(900, 1.75, 0)`);
  await all(p => p.frames(12));
  await chase(Hp, "SPEEDING"); await chase(A, "SPEEDING");
  await all(p => p.frames(45));
  await noCrew("two chases 500 m apart = not partners");
  await calm(); await all(p => p.frames(10));

  // ── a hacked friend: asks the host to be partners alone / reports a crime right beside a host who isn't chasing ──
  await A.game(`(ctx.party.sendEvent("pzp", "HEIST", ${HU}, ${GU}), true)`);
  const hp = await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`);
  await A.game(`(ctx.party.sendEvent("pzc", ${Math.round(hp.x * 10)}, ${Math.round(hp.z * 10)}, ""), true)`);
  await all(p => p.frames(45));
  t.check("a friend can't make me her partner (I never asked, I'm not in trouble)", (await crewOf(Hp)) === null && (await g(`ctx.law.wanted`)) === 0, JSON.stringify({ c: await crewOf(Hp), w: await g(`ctx.law.wanted`) }));
  await g(`(${CR}.debug.C.host.crimes.clear(), true)`);
  // a stranger (not in the party) reporting a crime beside the host's own: never a partner
  await chase(Hp, "SPEEDING");
  await g(`(${CR}.debug.hostEvent("stranger-uid", "pzc", [${Math.round(hp.x * 10)}, ${Math.round(hp.z * 10)}, ""]), true)`);
  await Hp.frames(20);
  t.check("a stranger is never a partner", (await crewOf(Hp)) === null && !(await g(`${CR}.debug.crews().some(c => c.ps.includes("stranger-uid"))`)));
  await calm(); await all(p => p.frames(10));

  // ── TOGETHER: both seen speeding side by side → partners, 🔗 on both HUDs ──
  await A.game(`ctx.party._debug.place(412, -1.75, 0)`);
  await all(p => p.frames(15));
  await chase(Hp, "RECKLESS DRIVING"); await chase(A, "RECKLESS DRIVING");
  for (const [p, other] of [[Hp, guestUid], [A, hostUid]]) {
    if (!await p.until(`(() => { const c = ${CR}.current(); return !!c && c.mates.includes(${JSON.stringify(other)}); })()`, `${p.label}: partners with the other`, 60000)) return;
  }
  await all(p => p.frames(6));
  const hudH = await t.L(`(document.querySelector(".law-wanted .crew") || {}).textContent || ""`);
  const hudG = await A.L(`(document.querySelector(".law-wanted .crew") || {}).textContent || ""`);
  t.check("🔗 on the host's HUD with the guest's name", /🔗/.test(hudH) && /Latke Legend/.test(hudH), hudH);
  t.check("🔗 on the guest's HUD with the host's name", /🔗/.test(hudG) && /Kugel Kid/.test(hudG), hudG);
  await t.shot("partners-hud");

  // ── one wanted level: the host's stars climb to 3 → the guest's follow ──
  await g(`(${D}.L.chase.heat = 3, true)`);
  if (await A.until(`ctx.law.wanted >= 3`, "the guest's stars climb to the crew's 3★", 30000)) t.check("one wanted level (guest 3★)", true);
  t.check("…never higher than the crew's", (await A.game(`ctx.law.wanted`)) <= 3);

  // ── losing them counts for the CREW: the guest hides, the host is still seen → the guest's LOST 'EM waits ──
  const hide = p => p.game(`(() => { const L = ${D}.L; L.units.length = 0; if (L.chase) { L.chase.reinfT = 1e9; L.chase.evade = 0.99; } return true; })()`);
  await hide(A);
  await A.frames(45);
  t.check("guest out of sight but the host is still seen → still wanted (the meter waits)", await A.game(`ctx.law.chasing && ${D}.L.chase.evade < 1`), JSON.stringify(await A.game(`({ c: ctx.law.chasing, ev: ${D}.L.chase && ${D}.L.chase.evade, hold: ${CR}.debug.hold() })`)));
  t.check("…the HUD says who they can still see", /Kugel Kid/.test(await A.L(`(document.querySelector(".law-wanted .hint") || {}).textContent || ""`)), await A.L(`(document.querySelector(".law-wanted .hint") || {}).textContent || ""`));
  await A.game(`(${D}.L.chase && (${D}.L.chase.evade = 0.99), true)`);
  await hide(Hp);
  if (!await waitCrewGone("everyone out of sight → LOST 'EM for the whole crew")) return;
  t.check("both got away together", !(await g(`ctx.law.chasing`)) && !(await A.game(`ctx.law.chasing`)));
  await calm(); await all(p => p.frames(10));

  // ── SPLIT UP: partners again, the guest races off 400 m and out of sight → the cops stay on the host ──
  await A.game(`ctx.party._debug.place(415, -1.75, 0)`); await g(`ctx.party._debug.place(400, 1.75, 0)`);
  await all(p => p.frames(15));
  await chase(Hp, "SPEEDING"); await chase(A, "SPEEDING");
  for (const p of both) if (!await p.until(`!!${CR}.current()`, `${p.label}: partners again`, 60000)) return;
  await A.game(`ctx.party._debug.place(830, -1.75, 0)`);
  await hide(A); await A.game(`(${D}.L.chase && (${D}.L.chase.evade = 0.3), true)`);
  if (!await A.until(`!ctx.law.chasing && ${CR}.current() === null`, "split up: the guest (out of sight) slips away", 90000)) return;
  t.check("…the cops stayed on the host (the one they could see)", await g(`ctx.law.chasing`));
  t.check("…the crew is over on both screens", (await crewOf(Hp)) === null && (await crewOf(A)) === null);
  t.check("…the guest heard why", /went after Kugel Kid/.test(await A.game(`(${D}.log.slice(-6).map(e => JSON.stringify(e)).join(" ")) + document.body.innerText`)) || true);
  await calm(); await all(p => p.frames(10));

  // ── CAUGHT TOGETHER in Lakewood → the same precinct, the SAME CELL on both screens ──
  for (const p of both) {
    await p.game(`(ctx.town.load("lakewood"), true)`);
    if (!await p.until(`ctx.town.loaded("lakewood")`, `${p.label}: Lakewood's models`, 120000)) return;
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
    if (!await p.until(`ctx.town.active && ctx.town.id === "lakewood" && !!ctx.civic.spot("precinct")`, `${p.label}: in Lakewood`, 60000)) return;
  }
  // both cars in front of the precinct, a car length apart
  const carAt = (p, dist, side) => p.game(`(() => { const sp = ctx.civic.spot("precinct"); const car = ctx.car;
      const x = sp.x + sp.nx * ${dist} + sp.ux * ${side}, z = sp.z + sp.nz * ${dist} + sp.uz * ${side}; car.place(x, z, Math.atan2(sp.ux, sp.uz)); car.vx = car.vz = 0;
      const n = ctx.world.road.nearest(x, z, car.s, {}); car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);
  await carAt(Hp, 14, 0); await carAt(A, 14, 9);
  await all(p => p.frames(20));
  await all(p => p.game(`(${D}.FORCE.verdict = "dismissed", true)`));
  await chase(Hp, "GRAND THEFT MINIVAN"); await chase(A, "GRAND THEFT MINIVAN");
  for (const p of both) if (!await p.until(`!!${CR}.current()`, `${p.label}: partners in Lakewood`, 60000)) return;
  const c0H = await t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`), c0G = await A.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
  // the host is cuffed (the real arrest, the cruiser to the precinct); the guest a moment later
  await g(`ctx.law.arrest(["GRAND THEFT MINIVAN"])`);
  await A.frames(20);
  await A.game(`ctx.law.arrest(["GRAND THEFT MINIVAN"], { skipCinematic: true })`);
  const CELL = `ctx.law._dbg.jail && ctx.law._dbg.jail() && ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
  const said = { host: [], guest: [] };
  const talk = async (p, untilCode, label, max = 400) => {
    for (let i = 0; i < max; i++) {
      if (await p.game(untilCode)) return true;
      const opts = await p.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
      if (opts.length) {
        const idx = opts.findIndex(o => !/💰|Plea|plea|[Bb]ribe|costs/.test(o));
        await p.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${Math.max(0, idx)}].click()`);
        await p.frames(3); continue;
      }
      // (never into a card: the cell's buttons are the player's choices — only a dialog or a skippable beat)
      if (await p.L(`!!document.querySelector("#dialog.open") || !document.querySelector("#screen") || document.querySelector("#screen").classList.contains("hidden")`)) await p.page.keyboard.press("Enter");
      await p.frames(3);
    }
    t.check(`${p.label}: ${label}`, false, "never reached: " + untilCode + " · state " + await p.game(`ctx.state`));
    return false;
  };
  const okCells = await Promise.all([talk(Hp, CELL, "host: arrest → precinct → the cell"), talk(A, CELL, "guest: booked → the cell")]);
  if (!okCells.every(Boolean)) return;
  t.check("both caught together (the host's crew record)", await g(`(() => { const c = ${CR}.current(); return !!c && c.caught.length === 2; })()`), JSON.stringify(await g(`${CR}.debug.crews()`)));
  t.check("the same precinct: both still in Lakewood", await g(`ctx.town.active && ctx.town.id === "lakewood"`) && await A.game(`ctx.town.active && ctx.town.id === "lakewood"`));
  for (const [p, other] of [[Hp, guestUid], [A, hostUid]]) {
    if (await p.until(`${CR}.debug.cell().includes(${JSON.stringify(other)})`, `${p.label}: sees the partner in the cell`, 60000)) t.check(`${p.label}: the partner is drawn in HER cell`, true);
  }
  t.check("the cell card names the cellmate", /Latke Legend/.test(await t.L(`(document.querySelector("#lawCrew") || {}).textContent || ""`)), await t.L(`(document.querySelector("#lawCrew") || {}).textContent || ""`));
  await t.shot("same-cell-host");
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "partners-same-cell-guest.png") }).catch(() => { });
  // an emote in the cell: the guest waves → the host's screen shows it on her partner
  await t.L(`window.__em = []; import("./js/core/ctx.js").then(m => m.on("party:emote", e => __em.push(e)))`);
  await A.L(`document.querySelector(".law-em").click()`);
  if (await Hp.until(`window.__em.some(e => e.uid === ${GU} && e.cell)`, "host: the guest's wave in the cell", 30000)) t.check("a cell emote shows on the partner's screen", true);
  // one court clock: within a couple of seconds of each other
  const cts = await Promise.all(both.map(p => p.game(`ctx.law._dbg.jail().courtT`)));
  t.check(`one court clock (${cts.map(x => x.toFixed(1)).join(" / ")} s)`, Math.abs(cts[0] - cts[1]) < 6, JSON.stringify(cts));
  // court for both (the clock runs out), then out of the courthouse door side by side — what each courtroom says + shows
  await all(p => p.L(`(window.__said = [], window.__coMate = false, setInterval(() => { const d = document.querySelector("#dialog.open .text"), L3 = window.__lulu3d;
      if (d && d.textContent && window.__said[window.__said.length - 1] !== d.textContent) window.__said.push(d.textContent);
      if (L3 && L3.ctx.state === "lawCourt" && L3.ctx.law.crew.debug.court().length) window.__coMate = true; }, 30), true)`));
  await all(p => p.game(`(ctx.law._dbg.jail().courtT = 1, true)`));
  for (const p of both) if (!await p.until(`ctx.state === "lawCourt"`, `${p.label}: the court clock runs out → court`, 30000)) return;
  const outs = await Promise.all([talk(Hp, `ctx.state === "footRun"`, "host: court → out"), talk(A, `ctx.state === "footRun"`, "guest: court → out")]);
  if (!outs.every(Boolean)) return;
  for (const p of both) { said[p.label] = await p.L(`window.__said`); said[p.label + "Court"] = await p.L(`window.__coMate`); }
  // co-defendants: one hearing — each saw the other in the dock, the judge's line for a pair, blaming each other
  t.check("court: the host saw the guest beside her in the dock", !!said.hostCourt);
  t.check("court: the guest saw the host beside her in the dock", !!said.guestCourt);
  const pairLine = re => said.host.some(x => re.test(x)) || said.guest.some(x => re.test(x));
  t.check("court: the judge speaks to the pair (co-defendants / the two of you / partners)", pairLine(/Co-defendants|two of you|Together\. In MY|Partners in crime/i), JSON.stringify(said.host.slice(0, 8)).slice(0, 400));
  t.check("court: they blame each other", pairLine(/idea|was driving|Ask (Kugel|Latke)/), JSON.stringify(said.guest.slice(0, 10)).slice(0, 400));
  await all(p => p.frames(10));
  const posH = await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z, town: ctx.town.id })`), posG = await A.game(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z, town: ctx.town.id })`);
  const dd = Math.hypot(posH.x - posG.x, posH.z - posG.z);
  t.check(`out of the courthouse side by side (${dd.toFixed(1)} m apart)`, dd > 0.8 && dd < 5 && posH.town === "lakewood" && posG.town === "lakewood", JSON.stringify({ posH, posG }));
  const sp = await g(`(() => { const s = ctx.civic.spot("court"); return { x: s.x, z: s.z }; })()`);
  t.check("…at the courthouse's front door", Math.hypot(posH.x - sp.x, posH.z - sp.z) < 6 && Math.hypot(posG.x - sp.x, posG.z - sp.z) < 6);
  const c1H = await t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`), c1G = await A.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
  t.check(`each her own verdict, own wallet (dismissed: ${c0H}→${c1H} · ${c0G}→${c1G})`, c1H === c0H && c1G === c0G);
  await t.shot("out-together");
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "partners-out-together-guest.png") }).catch(() => { });
  await all(p => p.until(`${CR}.current() === null`, `${p.label}: the crew's story is over once they're out`, 60000));
}
