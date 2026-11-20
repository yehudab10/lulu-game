// 🎉➕ MORE of the solo game in a party — two real pages against the LOCAL relay (server/local-relay.js on a
// private port; never production), with streets · rides · exits · town ON in the party:
//   OFF SET   only journey / dina / shabbos / ads stay off with friends
//   PLAN      the seeded rest area + Paint & Pray booths (ctx.party.road) are the same on both screens; the street
//             props of a chunk match prop for prop
//   FLEET     the rides fleet rides the SHARED traffic: the same ambulance (or taxi…) at the same place at the same party time
//   🛑 CLAIM  the host walks out in front of a shared car → it's CLAIMED: it brakes onto the shoulder and parks the
//             same way on both screens (live poses = the pure claimPose) → she carjacks it → it's gone on both
//             screens, and the guest sees the host driving that model
//   ✋ FLAG    she flags one down from the shoulder → it stops beside her → 🚕 HOP IN (no crime)
//   🔑 HOTWIRE a parked car on the shoulder → she drives it, the guest sees that model
//   ⛽ REST    the host drives into the rest area → the guest sees "⛽ at the …" presence
//   SYNC      the shared traffic stays exactly on the clock on both screens; the guest never freezes
//   🌍 TOWN   Free Roam, both in Lakewood: a town minivan she steps in front of leaves its loop the same way on both
//             screens; Kvetch is on the phone in a party town; the e-bikes ride
const { spawn } = require("child_process");
const path = require("path");
const { waitOn } = require("../lib/party3d.js");
const PORT = 25000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=party,foot,law,streets,rides,exits,town,world,atmos,phone&mpurl=${encodeURIComponent(URL)}`;
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
    shot: name => page.screenshot({ path: path.join(SHOTS, `3d-partyplus-${name}.png`) }).catch(() => { }),
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
/** a shared car coming at s in lane d, 70–260 m off. (The steps use the ONCOMING lanes: our own lanes only fill the
 *  road ahead of their start wave — nothing of ours sits behind the grid at GO — and that wave rolls up the road at
 *  lane speed, so a test that teleports her to a fixed s after a slow boot can land behind it, where nothing of ours
 *  ever comes up behind her. The oncoming lanes have no such wave.) */
const APPROACHING = (s, d) => `(() => { const dir = ${d} > 0 ? 1 : -1; const cs = ctx.traffic.cars.filter(c => c.data && typeof c.data.party === "string" && c.dir === dir && Math.abs(c.d - ${d}) < 0.3 && dir * (${s} - c.s) > 70 && dir * (${s} - c.s) < 260 && ctx.streets.rides[c.kind]);
  cs.sort((a, b) => dir * (b.s - a.s)); return cs[0] ? { key: cs[0].data.party, s: cs[0].s, kind: cs[0].kind } : null; })()`;

module.exports = {
  name: "partyplus",
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
  t.check("ctx.party claim API", await g(`typeof ctx.party.claim === "function" && typeof ctx.party.claimPose === "function" && typeof ctx.party.addTrafficKind === "function"`));
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
  const hostUid = await g(`ctx.party.uid`);
  const H = JSON.stringify(hostUid);
  // quiet the dice we don't test here: the law's traps, Shmuel's calls
  for (const p of pages) await p.game(`(ctx.law.hold(9999), ctx.streets.debug.CHOP.nextT = 1e9, true)`);
  t.check("party: streets · rides · exits · town are ON; journey · dina · shabbos · ads stay off",
    await g(`ctx.enabled("streets") && ctx.enabled("rides") && ctx.enabled("exits") && ctx.enabled("town") && ctx.enabled("foot") && !ctx.enabled("journey") && !ctx.enabled("dina") && !ctx.enabled("shabbos") && !ctx.enabled("ads")`));

  // ── the seeded plan: rest area + Paint & Pray booths ──
  const plan = c => c.game(`({ rests: ctx.exits.rests.map(r => Math.round(r.s) + ":" + r.name), paint: ctx.party.road.list(0, 6000).filter(s => s.id === "streets").map(s => s.kind + "@" + s.s.toFixed(1)), slots: ctx.party.road.list(0, 6000).map(s => s.key).join(",") })`);
  const p1 = await plan(pages[0]), p2 = await plan(A);
  t.check("road trip: one seeded rest area on the way to Bubbe's", p1.rests.length === 1, JSON.stringify(p1.rests));
  t.check("plan: the rest area is the same on both screens", JSON.stringify(p1.rests) === JSON.stringify(p2.rests), JSON.stringify({ p1: p1.rests, p2: p2.rests }));
  t.check("plan: the Paint & Pray booths + every big roadside slot match", p1.slots === p2.slots && JSON.stringify(p1.paint) === JSON.stringify(p2.paint), JSON.stringify({ p1: p1.paint, p2: p2.paint }));
  console.log("   PLAN partyplus", JSON.stringify(p1));
  const restS = p1.rests.length ? +p1.rests[0].split(":")[0] : null;

  // ── seeded street props: both screens at the same stretch → the same props ──
  // (on the shoulder: parked IN the slow lane a shared car bumps her and she claims it as a ram)
  for (const p of pages) await p.game(`(ctx.party.placeCar(700, 7.9, 0), true)`);
  await sleep(2500);
  const props = c => c.game(`ctx.streets.debug.PROPS.all.filter(p => !p.loose && p.s > 700 && p.s < 1300).map(p => p.kind + "@" + p.s.toFixed(1) + "/" + p.d.toFixed(1)).sort().join(",")`);
  const pr1 = await props(pages[0]), pr2 = await props(A);
  t.check("props: the street props of the same chunks match on both screens", !!pr1 && pr1 === pr2, JSON.stringify({ pr1: pr1.slice(0, 160), pr2: pr2.slice(0, 160) }));
  t.check("props: a party seeds its own (not the solo layout)", pr1.split(",").length >= 2, pr1.slice(0, 120));

  // ── the rides fleet in the SHARED traffic ──
  const T0 = await g(`Math.round(ctx.party.clock())`);
  const fleet = c => c.game(`ctx.party.trafficAt(${T0}, 0, 40000).filter(x => /^rides_|streets_sports/.test(x.kind)).map(x => x.key + ":" + x.kind + "@" + x.s.toFixed(2)).join(",")`);
  const f1 = await fleet(pages[0]), f2 = await fleet(A);
  t.check("fleet: ambulances / taxis / ice-cream trucks / buses in the shared traffic, the same on both screens", f1.length > 0 && f1 === f2 && /rides_ambulance/.test(f1), f1.slice(0, 200));
  // drive both up to the nearest fleet vehicle (an ambulance if there's one) SHORT OF BUBBE'S — teleporting past the
  // trip's end (≈ 4.8 km) finishes the trip — and see it live on both screens, on the clock (either direction: our
  // own lanes only fill the road ahead of their start wave)
  const amb = await g(`(() => { const T = ctx.party.clock() + 4000; const end = (ctx.journey && ctx.journey.stopS ? ctx.journey.stopS(0) : 4800) - 500;
    const fl = ctx.party.trafficAt(T, 300, end).filter(x => /^rides_/.test(x.kind)).sort((a, b) => (b.kind === "rides_ambulance") - (a.kind === "rides_ambulance") || a.s - b.s);
    const a = fl[0]; return a ? { key: a.key, s: a.s, kind: a.kind, T } : null; })()`);
  t.check("fleet: a fleet vehicle (an ambulance / taxi / ice-cream truck / bus) up the road, short of Bubbe's", !!amb, JSON.stringify(amb));
  if (amb) {
    const K = JSON.stringify(amb.key);
    for (const p of pages) await p.game(`(ctx.party.placeCar(${amb.s} - 60, 7.6, 0), true)`);
    await hostUntil(t, `ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`, "host: the fleet vehicle is live", 60000);
    await A.until(`ctx.traffic.cars.some(c => c.data && c.data.party === ${K})`, "guest: the fleet vehicle is live", 60000);
    const live = c => c.game(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.party === ${K}); if (!c) return null; const w = ctx.party.trafficAt(c.data.at, c.s - 5, c.s + 5).find(x => x.key === ${K}); return { kind: c.kind, model: !!c.obj, ok: !!w && Math.abs(w.s - c.s) < 0.05 }; })()`);
    const l1 = await live(pages[0]), l2 = await live(A);
    t.check("fleet: the SAME vehicle on both screens, exactly where the party clock says", !!l1 && !!l2 && l1.kind === amb.kind && l2.kind === amb.kind && l1.ok && l2.ok, JSON.stringify({ l1, l2 }));
    await A.shot("guest-ambulance");
  }

  // ── 🛑 CLAIM: the host steps out in front of a shared car ──
  const hs0 = 1500;
  await g(`(ctx.party.placeCar(${hs0}, 7.4, 0), true)`);
  await A.game(`(ctx.party.placeCar(${hs0} - 30, 7.6, 0), true)`);
  await sleep(800);
  await g(`(ctx.foot.start("droveOff"), true)`);
  if (!await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the host is walking", 30000)) return;
  await g(`(ctx.party._debug.claimCool(), true)`);
  const before = JSON.stringify((await g(`ctx.party._debug.claims()`)).map(c => c.key));
  // stand in the oncoming slow lane, facing the traffic, as one comes
  const fs = await g(`ctx.foot.debug.F.s`);
  await hostUntil(t, `!!${APPROACHING(fs, -5.25)}`, "a shared car coming down the oncoming slow lane", 60000);
  await g(`(() => { const F = ctx.foot.debug.F, p = ctx.world.road.point(F.s, -5.25, {}); F.pos.set(p.x, 0, p.z); F.d = -5.25; ctx.G.invT = 30; return true; })()`);
  const NEW = `ctx.party._debug.claims().find(c => c.mine && !c.dead && !${before}.includes(c.key))`;
  const claimed = await hostUntil(t, `!!${NEW}`, "stepping out in front of a shared car claims it", 40000);
  let ck = null;
  if (claimed) {
    // back onto the shoulder (her own pratfalls are fine, the test wants her standing)
    await g(`(() => { const F = ctx.foot.debug.F, p = ctx.world.road.point(F.s, -9.6, {}); F.pos.set(p.x, 0, p.z); return true; })()`);
    const cl = await g(NEW);
    ck = cl.key;
    const K = JSON.stringify(ck);
    t.check("claim: it brakes onto its own shoulder", Math.abs(Math.abs(cl.dS) - 7.9) < 0.01 && cl.L > 8, JSON.stringify(cl));
    t.check("claim: it left the shared conveyor (gone for the sync, not dead)", await g(`ctx.party.trafficGone(${K}) && !ctx.party._debug.claims().find(c => c.key === ${K}).dead`));
    await A.until(`ctx.party._debug.claims().some(c => c.key === ${K} && c.by === ${H})`, "the guest hears the claim", 30000);
    await A.until(`ctx.party.claimsLive().some(c => c.key === ${K})`, "the guest draws the claimed car", 30000);
    // both stopped: the same pose on both screens, and live = the pure formula
    await hostUntil(t, `(() => { const c = ctx.party.claimsLive().find(c => c.key === ${K}); return c && c.speed === 0; })()`, "host: it comes to a stop", 30000);
    await A.until(`(() => { const c = ctx.party.claimsLive().find(c => c.key === ${K}); return c && c.speed === 0; })()`, "guest: it comes to a stop", 30000);
    const c1 = await g(`ctx.party.claimsLive().find(c => c.key === ${K})`), c2 = await A.game(`ctx.party.claimsLive().find(c => c.key === ${K})`);
    t.check("claim: parked on the same spot on both screens", !!c1 && !!c2 && Math.abs(c1.s - c2.s) < 0.02 && Math.abs(c1.d - c2.d) < 0.02 && c1.mine && !c2.mine, JSON.stringify({ c1, c2 }));
    t.check("claim: hers only — jackable on the host, not on the guest", await g(`ctx.streets.debug.nearestCandidate !== undefined && (() => { const c = ctx.traffic.cars.find(c => c.data && c.data.partyClaim === ${K}); return !!c && c.data.streetsHold; })()`) && await A.game(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.partyClaim === ${K}); return !!c && !c.data.streetsHold; })()`));
    await A.shot("guest-sees-claimed-car");
    await t.shot("host-claimed-car");
    const s1 = await g(SYNC), s2 = await A.game(SYNC);
    t.check("sync: with a claim out, the shared traffic + the claimed car sit where the clock says (host)", s1.bad === 0 && s1.cbad === 0 && s1.claims >= 1, JSON.stringify(s1).slice(0, 220));
    t.check("sync: …and on the guest", s2.bad === 0 && s2.cbad === 0 && s2.claims >= 1, JSON.stringify(s2).slice(0, 220));
    // carjack it (the real animation)
    const ok = await g(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.partyClaim === ${K}); if (!c) return "gone?";
      const F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }; F.pos.set(c.x + l.x * 1.8, 0, c.z + l.z * 1.8);
      return ctx.streets.carjack(c) ? "ok" : "refused"; })()`);
    t.check("carjack: the claimed car (stopped for her) is jackable", ok === "ok", ok);
    t.check("carjack: friends still see it parked while she's yanking the door", await A.game(`ctx.traffic.cars.some(c => c.data && c.data.partyClaim === ${K})`));
    if (await hostUntil(t, `ctx.state === "playing" && !!ctx.foot.vehicle`, "the host drives off in it", 60000)) {
      const kind = await g(`ctx.foot.vehicle.kind`);
      await A.until(`!ctx.traffic.cars.some(c => c.data && (c.data.partyClaim === ${K} || c.data.party === ${K}))`, "the jacked car vanishes on the guest's screen", 30000);
      t.check("carjack: gone for good on both screens", !(await g(`ctx.traffic.cars.some(c => c.data && (c.data.partyClaim === ${K} || c.data.party === ${K}))`)) && await A.game(`ctx.party._debug.claims().find(c => c.key === ${K}).dead`));
      await A.until(`(() => { const rc = ctx.party.remoteCar(${H}); return !!rc && rc.shown && !rc.foot && (rc.v.rideKey || "").startsWith(${JSON.stringify(kind)} + "|"); })()`, "the guest sees the host IN that car", 60000);
      t.check("guest: the host drives the claimed car's model", await A.game(`(ctx.party.remoteCar(${H}).v.rideKey || "").startsWith(${JSON.stringify(kind)} + "|")`));
      await A.shot("guest-sees-host-in-jacked-car");
    }
  }

  // ── ✋ FLAG one down from the shoulder → it stops beside her → 🚕 HOP IN ──
  if (await g(`ctx.state === "playing"`)) {
    const s = await g(`ctx.car.s`);
    await g(`(ctx.party.placeCar(${s} + 40, 7.4, 0), true)`);
    await A.game(`(ctx.party.placeCar(${s} + 10, 7.6, 0), true)`);
    await sleep(600);
    await g(`(ctx.foot.start("droveOff"), ctx.party._debug.claimCool(), true)`);
    await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "on foot again", 30000);
    const PUT = `(() => { const F = ctx.foot.debug.F, p = ctx.world.road.point(F.car.stub.s + 30, -8.4, {}); F.pos.set(p.x, 0, p.z); F.peds.forEach(x => x.s += 400); F.animals.forEach(x => x.s += 400); F.parked.forEach(x => { x.s -= 500; x.busted = true; }); return true; })()`;
    await g(PUT);
    const FDIAG = `(() => { const F = ctx.foot.debug.F, fp = ctx.foot.pos; return { phase: ctx.foot.phase, at: { s: +F.s.toFixed(1), d: +(F.d || 0).toFixed(1) }, cars: ctx.traffic.cars.filter(c => c.data && typeof c.data.party === "string").map(c => { const dx = fp.x - c.x, dz = fp.z - c.z, fx = Math.sin(c.h), fz = Math.cos(c.h); return { k: c.kind, s: Math.round(c.s), d: +c.d.toFixed(1), v: +c.speed.toFixed(1), lon: Math.round(dx * fx + dz * fz), lat: +(dx * fz - dz * fx).toFixed(1), ride: !!(ctx.streets.rides || {})[c.kind] }; }).filter(c => Math.abs(c.lon) < 120) }; })()`;
    if (!await hostUntil(t, `!!ctx.party._debug.flag()`, "a shared car coming her way to flag down", 60000)) console.log("   FLAG cars", JSON.stringify(await g(FDIAG)).slice(0, 1500));
    await g(PUT);
    await t.frames(2);
    const promptOk = await hostUntil(t, `/FLAG IT DOWN/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`, "the prompt offers ✋ FLAG IT DOWN", 20000);
    if (!promptOk) console.log("   FLAG diag", JSON.stringify(await g(`({ flag: ctx.party._debug.flag(), prompt: (document.querySelector("#slot-bottom .prompt") || {}).textContent, list: (ctx.foot.debug.interactables() || null) && [ctx.foot.debug.interactables()].map(p => p && { kind: p.kind, label: p.label, score: p.score }), phase: ctx.foot.phase, d: ctx.foot.debug.F.d })`)));
    // (press whenever the prompt is up — on a slow runner one car's window can close between seeing it and the tap)
    const HAILED = `ctx.party._debug.claims().some(c => c.mine && c.hail && !c.dead)`;
    for (let i = 0, end = Date.now() + 45000; Date.now() < end && !(await g(HAILED)); i++) {
      if (await g(`/FLAG IT DOWN/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`)) await t.tap(0);
      else { await g(PUT); await sleep(300); }
    }
    const fl = await hostUntil(t, HAILED, "flagging one down claims it (hail)", 5000);
    if (fl) {
      const fk = JSON.stringify((await g(`ctx.party._debug.claims()`)).find(c => c.mine && c.hail && !c.dead).key);
      await A.until(`ctx.party._debug.claims().some(c => c.key === ${fk} && c.hail)`, "the guest hears the hail claim", 30000);
      await hostUntil(t, `(() => { const c = ctx.party.claimsLive().find(c => c.key === ${fk}); return c && c.speed === 0; })()`, "the flagged car stops", 30000);
      const near = await g(`(() => { const c = ctx.party.claimsLive().find(c => c.key === ${fk}), F = ctx.foot.debug.F; return Math.abs(c.s - F.s); })()`);
      t.check("flag: it stops right beside her", near < 9, `${near.toFixed(1)} m`);
      await g(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.partyClaim === ${fk}), F = ctx.foot.debug.F; F.pos.set(c.x - Math.cos(c.h) * 1.7, 0, c.z + Math.sin(c.h) * 1.7); F.peds.forEach(x => x.s += 400); return true; })()`);
      await hostUntil(t, `/HOP IN/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`, "the prompt offers 🚕 HOP IN on the passenger side", 20000);
      await t.tap(0);
      await hostUntil(t, `ctx.state === "playing" && !!ctx.foot.vehicle`, "she hops in and drives", 20000);
      await A.until(`!ctx.traffic.cars.some(c => c.data && (c.data.partyClaim === ${fk} || c.data.party === ${fk}))`, "the hailed car is gone on the guest's screen", 30000);
      await t.shot("host-hopped-in");
    }
  }

  // ── 🔑 hotwire a parked car on the shoulder ──
  if (await g(`ctx.state === "playing"`)) {
    await g(`(ctx.foot.start("droveOff"), true)`);
    await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "on foot for the hotwire", 30000);
    await g(`(() => { const F = ctx.foot.debug.F; F.peds.forEach(x => x.s += 400); F.parked.forEach(x => { x.s -= 500; x.busted = true; });
      ctx.foot.debug.spawnParked({ vtype: "car", s: F.s + 4, side: 1, lemon: null }); const pc = F.parked.at(-1); const p = ctx.world.road.point(pc.s, pc.d + 2.0, {}); F.pos.set(p.x, 0, p.z); return true; })()`);
    await t.frames(5);
    await hostUntil(t, `/HOTWIRE/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`, "the prompt offers HOTWIRE", 20000);
    await t.tap(0);
    if (await hostUntil(t, `ctx.foot.phase === "hotwire"`, "the hotwire challenge opens", 30000)) {
      await g(`ctx.foot.force.hotwire = true`);
      await t.tap(0); await t.tap(0);
      if (await hostUntil(t, `ctx.state === "playing" && !!ctx.foot.vehicle`, "hotwired: she drives it", 30000)) {
        const kind = await g(`ctx.foot.vehicle.kind`);
        await A.until(`(() => { const rc = ctx.party.remoteCar(${H}); return !!rc && rc.shown && (rc.v.rideKey || "").startsWith(${JSON.stringify(kind)} + "|"); })()`, "the guest sees her in the hotwired car", 60000);
        t.check("hotwire: works in a party and friends see the ride", true);
      }
      await g(`ctx.foot.force.hotwire = null`);
    }
  }

  // ── ⛽ the rest area: personal visit, presence for friends ──
  if (restS != null) {
    await g(`(ctx.party.placeCar(${restS} + 120, 27, 0), true)`);
    await A.game(`(ctx.party.placeCar(${restS} - 40, 5.25, 0), true)`);
    await hostUntil(t, `ctx.exits.inside`, "the host is in the rest area lot", 30000);
    await A.until(`(ctx.party.presenceOf(${H}) || {}).mode === "rest"`, "the guest sees '⛽ at the …'", 60000);
    const pr = await A.game(`ctx.party.presenceOf(${H})`);
    t.check("rest area: presence '⛽ at the <rest area>'", !!pr && pr.icon === "⛽" && /^at the /.test(pr.label), JSON.stringify(pr));
    t.check("rest area: the guest's world keeps going (driving state, clock advancing)", await A.game(`ctx.state === "playing"`));
    await t.shot("host-rest-area");
    await A.shot("guest-rest-presence");
  }

  // ── the guest never froze; the traffic stayed on the clock ──
  const tg0 = await A.game(`({ t: ctx.time, c: ctx.party.clock() })`);
  await sleep(1500);
  const tg1 = await A.game(`({ t: ctx.time, c: ctx.party.clock() })`);
  t.check("guest: never frozen (game time + party clock advance)", tg1.t > tg0.t && tg1.c > tg0.c + 800, JSON.stringify({ tg0, tg1 }));
  const s1 = await g(SYNC), s2 = await A.game(SYNC);
  t.check("sync: every live shared car sits where the party clock says (host)", s1.n >= 4 && s1.bad === 0 && s1.cbad === 0, JSON.stringify(s1).slice(0, 220));
  t.check("sync: …and on the guest", s2.n >= 4 && s2.bad === 0 && s2.cbad === 0, JSON.stringify(s2).slice(0, 220));
  t.check("sync: the guest has no stray local cars", s2.locals.every(k => /footStub|law|local|partyClaim|partyLocal/.test(k)), JSON.stringify(s2.locals));

  // ── 🌍 Free Roam: a town minivan leaves its loop the same way on both screens ──
  const boss = (await g(`ctx.party.isHost`)) ? pages[0] : A;
  await boss.game(`(ctx.party._debug.toLobby(), true)`);
  for (const p of pages) await p.until(`ctx.state === "partyLobby"`, "back in the lobby", 40000);
  await boss.game(`(ctx.party._debug.start("roam"), true)`);
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "roam"`, "free roam: GO", 90000)) return;
  for (const p of pages) {
    await p.game(`(ctx.law.hold(9999), ctx.streets.debug.CHOP.nextT = 1e9, true)`);
    await p.until(`ctx.town.debug.S.loaded`, "town models", 90000);
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    await p.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "in Lakewood", 90000);
  }
  const fr1 = await g(`({ rests: ctx.exits.rests.map(r => Math.round(r.s)), exits: ctx.town.exits.map(e => Math.round(e.s)) })`), fr2 = await A.game(`({ rests: ctx.exits.rests.map(r => Math.round(r.s)), exits: ctx.town.exits.map(e => Math.round(e.s)) })`);
  t.check("free roam: the seeded rest areas (between interchanges) match on both screens", JSON.stringify(fr1.rests) === JSON.stringify(fr2.rests), JSON.stringify({ fr1, fr2 }));
  t.check("town: the e-bikes ride in a party town", await g(`ctx.town.debug && ctx.town.debug.LIFE ? ctx.town.debug.LIFE.bikes.length > 0 : true`));
  t.check("town: Kvetch (the local gossip app) is on the phone in a party town", await g(`!ctx.phone || !ctx.phone.apps || ctx.phone.apps().includes("town")`));
  await g(`(ctx.foot.start("droveOff"), ctx.party._debug.claimCool(), true)`);
  await hostUntil(t, `ctx.state === "footRun" && ctx.foot.phase === "walk"`, "the host walks in Lakewood", 60000);
  // a minivan on its loop: stand 16 m ahead of it on its path (wait for one to be live near her first —
  // only the loop cars around her are on the road, and right after she climbs out there may be none)
  // (walk her out in front of the nearest loop minivan by its PURE pose first — the live town cars are only the ones
  //  near her, and where she climbed out there may be none)
  const near = await g(`(() => { const F = ctx.foot.debug.F, T = ctx.party.clock() + 1500; const cs = ctx.openworld.debug.townCarsAt(T).filter(c => c.kind === "town_van");
    cs.sort((a, b) => Math.hypot(a.x - F.pos.x, a.z - F.pos.z) - Math.hypot(b.x - F.pos.x, b.z - F.pos.z)); const c = cs[0]; if (!c) return null;
    F.pos.set(c.x + Math.sin(c.h) * 30, 0, c.z + Math.cos(c.h) * 30); ctx.G.invT = 30; return c.key; })()`);
  if (!await hostUntil(t, `ctx.traffic.cars.some(c => c.data && typeof c.data.party === "string" && /^tw:/.test(c.data.party) && c.kind === "town_van" && c.speed > 2)`, "a loop minivan is live in town", 40000))
    console.log("   TOWN diag", JSON.stringify({ near, live: await g(`ctx.traffic.cars.map(c => c.kind + ":" + (c.data && c.data.party) + ":" + (+c.speed).toFixed(1)).slice(0, 20)`), zone: await g(`ctx.openworld.zone`) }));
  const tw = await g(`(() => { const F = ctx.foot.debug.F; const cs = ctx.traffic.cars.filter(c => c.data && typeof c.data.party === "string" && /^tw:/.test(c.data.party) && c.kind === "town_van" && c.speed > 2);
    cs.sort((a, b) => Math.hypot(a.x - F.pos.x, a.z - F.pos.z) - Math.hypot(b.x - F.pos.x, b.z - F.pos.z)); const c = cs[0]; if (!c) return null;
    F.pos.set(c.x + Math.sin(c.h) * 16, 0, c.z + Math.cos(c.h) * 16); ctx.G.invT = 30; return { key: c.data.party }; })()`);
  t.check("town: a loop minivan nearby", !!tw);
  if (tw) {
    const K = JSON.stringify(tw.key);
    let got = await hostUntil(t, `ctx.party._debug.claims !== undefined && ctx.openworld.debug.townClaims.claimed(${K})`, "stepping in front of a town minivan claims it", 6000);
    if (!got) {   // (it turned a corner first: claim it straight)
      got = await g(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.party === ${K}); return !!c && ctx.party.claim(c, { how: "step" }); })()`);
    }
    if (got) {
      await A.until(`ctx.openworld.debug.townClaims.claimed(${K})`, "the guest hears the town claim", 30000);
      await sleep(4000);
      const at = await g(`Math.round(ctx.party.clock())`);
      const q1 = await g(`ctx.openworld.debug.townClaims.pose(${K}, ${at})`), q2 = await A.game(`ctx.openworld.debug.townClaims.pose(${K}, ${at})`);
      t.check("town: the claimed minivan pulls over the same way on both screens", !!q1 && !!q2 && Math.hypot(q1.x - q2.x, q1.z - q2.z) < 0.02 && q1.speed === 0, JSON.stringify({ q1, q2 }));
      const live = c => c.game(`ctx.openworld.debug.townLive().filter(c => c.claimed).map(c => { const p = ctx.openworld.debug.townClaims.pose(c.key, c.at); return !!p && Math.hypot(p.x - c.x, p.z - c.z) < 0.05; })`);
      const lv1 = await live(pages[0]);
      t.check("town: the live claimed car = its pure pose", lv1.length >= 1 && lv1.every(Boolean), JSON.stringify(lv1));
      const ok = await g(`(() => { const c = ctx.traffic.cars.find(c => c.data && c.data.partyClaim === ${K}); if (!c) return "gone?";
        const F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }; F.pos.set(c.x + l.x * 1.9, 0, c.z + l.z * 1.9);
        return ctx.streets.carjack(c) ? "ok" : "refused"; })()`);
      t.check("town: the claimed minivan is jackable", ok === "ok", ok);
      if (await hostUntil(t, `ctx.state === "playing" && !!ctx.foot.vehicle`, "the host drives off in the minivan", 60000)) {
        await A.until(`!ctx.traffic.cars.some(c => c.data && (c.data.partyClaim === ${K} || c.data.party === ${K}))`, "the minivan is gone on the guest's screen", 30000);
        t.check("town: it never comes back to its loop", !(await A.game(`ctx.traffic.cars.some(c => c.data && (c.data.partyClaim === ${K} || c.data.party === ${K} || c.data.key === ${K}))`)));
        await A.shot("guest-town-after-jack");
      }
    }
    const lvA = await A.game(`ctx.openworld.debug.townLive().filter(c => !c.claimed).map(c => { const w = ctx.openworld.debug.townCarsAt(c.at).find(x => x.key === c.key); return !!w && Math.hypot(w.x - c.x, w.z - c.z) < 0.05; })`);
    t.check("town: every other loop car stays on the clock (guest)", lvA.length > 0 && lvA.every(Boolean), JSON.stringify(lvA));
  }
  await g(`ctx.party.leave()`);
}
