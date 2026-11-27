// 🎉 The party's SHARED WORLD — two real pages (host + guest) against the LOCAL relay (never production),
// with the roadside features ON in the party (roadevents · cameos · world · hustle · community · memory ·
// banter · meta):
//   ROAD TRIP — the seeded road plan (ctx.party.road) is identical on both screens; each screen builds the
//   same roadside events / cameos / payphones at the same s as its car gets near; the fixed pull-in places
//   match; a world visit (a personal scene) on the host doesn't freeze the guest (car + party clock keep
//   going, traffic still where the clock says); the party traffic stays in sync with everything on; the
//   💼 Jobs app works; arriving at Bubbe's banks the run (run:end → lifetime stats) + a place visit stat.
//   🌍 FREE ROAM — both in Lakewood: the Chaverim / Shomrim / Hatzalah cruisers ride the same seeded block
//   loops at the same party time on both screens (live cars follow the clock); the seeded roadside scenes
//   (kind + kerb) match; openworld's town traffic is untouched; the 📞 Call app is there. Perf logged.
const { spawn } = require("child_process");
const path = require("path");
const { waitOn } = require("../lib/party3d.js");
const PORT = 25000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=party,atmos,play,town,roadevents,cameos,world,hustle,community,memory,banter,meta,phone&mpurl=${encodeURIComponent(URL)}`;
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
    shot: name => page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", `3d-partyworld-${name}.png`) }).catch(() => { }),
  };
}
async function hostUntil(t, code, what, ms = 90000) {
  if (await waitOn(t.page, code, ms)) return true;   // GAME time (frames), not wall time
  t.check(what, false, "timed out in " + await t.game(`ctx.state`).catch(() => "?"));
  return false;
}
const clickSel = async (t, sel) => { const ok = await t.L(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b) b.click(); return !!b; })()`); await sleep(250); return ok; };
const STATS = `import("./js/core/save.js").then(m => { try { m.flushShared && m.flushShared(); } catch (e) { } const s = m.shared.get(); return Object.assign({ lifetimeScore: s.lifetimeScore || 0 }, s.stats || {}); })`;
const PERF = async (L, ms) => {
  await L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
    window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, t0: performance.now(), f0: __lulu3d.frames }; })()`);
  await sleep(ms);
  return L(`(() => { const P = window.__pf; window.__pf = null; return P && P.n ? { frames: P.n, fps: +(P.n / ((performance.now() - P.t0) / 1000)).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length, actors: __lulu3d.ctx.actors.length } : null; })()`);
};
/** Every live party car where the shared clock says it should be (pure function of seed + clock)? */
const TRAFFIC_OK = `(() => { const live = ctx.party.trafficLive(); let bad = 0; for (const c of live) { const w = ctx.party.trafficAt(c.at, c.s - 3, c.s + 3).find(x => x.key === c.key); if (!w || Math.abs(w.s - c.s) > 0.05) bad++; } return { n: live.length, bad, stray: ctx.traffic.cars.filter(c => !c.data || !(c.data.party || c.data.partyLocal)).length }; })()`;

module.exports = {
  name: "partyworld",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 300, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    const step = async (label, fn) => { try { return await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); return null; } };
    await startRelay();
    const guests = [];
    try {
      const ok = await step("road trip", () => roadTrip(t, guests));
      if (ok) await step("free roam", () => freeRoam(t, guests));
    } finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      try { relay.kill(); } catch (e) { }
    }
  },
};

// ── ROAD TRIP: the seeded road ──────────────────────────────────────────
async function roadTrip(t, guests) {
  const g = t.game;
  t.check("party plan service (rng / seeded / road)", await g(`!!(ctx.party.rng && ctx.party.seeded && ctx.party.road && ctx.party.road.slot)`));
  t.check("the party OFF set no longer holds the shared-world features", await g(`(() => { const N = ctx.party._debug.N, was = N.want; N.want = true; try { return ["roadevents", "cameos", "world", "hustle", "community", "memory", "banter", "meta"].every(id => ctx.enabled(id)) && !ctx.enabled("journey") && !ctx.enabled("dina"); } finally { N.want = was; } })()`));
  await t.game(`(ctx.party.hostParty(), true)`);     // (the lobby has no hub button any more: games are votes in 🌍 Free Roam — ci/friends stage 2)
  if (!await hostUntil(t, `ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`, "host: lobby")) return false;
  const code = await g(`ctx.party.code`);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `&party=${code}`);
  guests.push(A);
  if (!await A.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "joins from the link", 180000)) return false;
  await hostUntil(t, `ctx.party.players.length === 2`, "two in the lobby");
  // everybody's roadside models ready (the plan only builds what's loaded — it would build it a frame later otherwise)
  for (const P of [g, A.game]) await P(`Promise.all([ctx.roadevents.loadModels(), ctx.community.load()]).then(() => true)`);
  await clickSel(t, "#pt_act_trip");
  await clickSel(t, "#pt_go");
  const pages = [{ label: "host", game: c => t.game(c), until: (c, w, ms) => hostUntil(t, c, w, ms), L: c => t.L(c), shot: n => t.shot(n) }, A];
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "trip" && ctx.G.mode === "party"`, "road trip: GO", 60000)) return false;
  // (no random 📱 job call mid-test: it would make the phone busy)
  for (const p of pages) await p.game(`(ctx.banter.autopilot = { d: 5.25, speed: 0 }, ctx.hustle.hold(900), true)`);

  // 1. the plan: identical on both screens
  const plans = [];
  for (const p of pages) plans.push(await p.game(`ctx.party.road.list(0, 4300).map(s => s.key + "@" + s.s.toFixed(2) + ":" + s.side)`));
  t.check("road plan: the same big slots at the same s on both screens", JSON.stringify(plans[0]) === JSON.stringify(plans[1]) && plans[0].length >= 1, `${plans[0].length} slots: ${plans[0].slice(0, 6).join(" ")}`);
  const kinds = [];
  for (const p of pages) kinds.push(JSON.stringify(await p.game(`ctx.party.road.kinds`)));
  t.check("road plan: roadevents, cameos and hustle registered, in the same order everywhere", kinds[0] === kinds[1] && ["roadevents:", "cameos:", "hustle:"].every(i => kinds[0].includes(i)), kinds[0]);
  const rePlans = [];
  for (const p of pages) rePlans.push(await p.game(`JSON.stringify(ctx.roadevents.party.plan(0, 4300))`));
  t.check("roadevents plan (big + small): identical on both screens", rePlans[0] === rePlans[1] && JSON.parse(rePlans[0]).length >= 10, `${JSON.parse(rePlans[0]).length} events`);

  // 2. drive past a handful of planned things on both screens: the same event spawns at the same s
  const slots = await g(`ctx.party.road.list(600, 3900).map(s => ({ key: s.key, id: s.id, kind: s.kind, s: s.s }))`);
  const smalls = (await g(`ctx.roadevents.party.plan(600, 3900)`)).filter(e => !/^roadevents:/.test(e.key));
  const visits = [];
  for (const id of ["roadevents", "cameos", "hustle"]) { const sl = slots.find(x => x.id === id); if (sl) visits.push(sl); }
  for (const ev of ["cone", "animal", "puddle", "pothole", "pedestrian"]) { const e = smalls.find(x => x.ev === ev && !visits.some(v => Math.abs(v.s - x.s) < 400)); if (e) { visits.push({ key: e.key, id: "small", ev: e.ev, s: e.s }); if (visits.length >= 7) break; } }
  visits.sort((a, b) => a.s - b.s);
  // how far before it to stop (each kind is set up a set distance out; a stopped car meets an animal late)
  const back = v => v.id === "roadevents" ? 200 : v.id === "cameos" ? 150 : v.id === "hustle" ? 420 : v.ev === "animal" ? 40 : 110;
  for (const v of visits) {
    for (const [i, p] of pages.entries()) await p.game(`ctx.party._debug.place(${(v.s - back(v)).toFixed(2)}, ${i ? 1.75 : 5.25}, 0)`);
    await sleep(1800);
  }
  await sleep(1500);
  const logs = [];
  for (const p of pages) logs.push(await p.game(`({ re: ctx.roadevents.party.log.map(x => x.key + "@" + x.s), cm: ctx.cameos.party.log.map(x => x.key + "@" + x.s + "/" + JSON.stringify(x.spot)), hu: ctx.hustle._dbg.party.log.map(x => x.key + "@" + x.s + "=" + x.job) })`));
  for (const v of visits) {
    const pick = L => (v.id === "cameos" ? L.cm : v.id === "hustle" ? L.hu : L.re).filter(x => x.startsWith(v.key + "@"));
    const a = pick(logs[0]), b = pick(logs[1]);
    t.check(`same event, same place on both screens: ${v.key} @ ${v.s.toFixed(1)}`, a.length === 1 && JSON.stringify(a) === JSON.stringify(b), `${a.join(" ")} | ${b.join(" ")}`);
  }
  t.check("the solo random scheduler stays out of a party (only planned events)", await g(`ctx.roadevents.party.log.length > 0 && !ctx.roadevents.zonePlan`));
  await t.shot("roadside-host");
  await A.shot("roadside-guest");

  // 3. the fixed pull-in places (Gas 'n' Go at 1300, the Lookout at 2400) — the same spots everywhere
  const at = [];
  for (const p of pages) at.push(await p.game(`JSON.stringify([ctx.places.at("gas").filter(s => s < 5000), ctx.places.at("lookout").filter(s => s < 5000), ctx.places.at("family_bubbe")])`));
  t.check("places: the same Gas 'n' Go + Lookout on both screens (no Bubbe's driveway on a road trip)", at[0] === at[1] && /1300/.test(at[0]) && /2400/.test(at[0]) && /\[\]\]$/.test(at[0]), at.join(" / "));
  for (const [i, p] of pages.entries()) await p.game(`ctx.party._debug.place(1180, ${i ? 1.75 : 5.25}, 0)`);
  await sleep(2500);
  const sp = [];
  for (const p of pages) sp.push(await p.game(`JSON.stringify(ctx.places.spots().filter(x => x.id === "gas").map(x => x.key))`));
  t.check("places: Gas 'n' Go built at the same spot on both screens", sp[0] === sp[1] && /gas@1300/.test(sp[0]), sp.join(" / "));
  await t.shot("gas-host");

  // 4. a personal scene (pull in at Gas 'n' Go) on the host: the guest's world doesn't stop
  const st0 = await g(STATS);
  const gb = await A.game(`({ s: ctx.car.s, T: ctx.party.clock() })`);
  await A.game(`(ctx.banter.autopilot = { d: 1.75, speed: 18 }, ctx.party._debug.place(1180, 1.75, 18), true)`);
  await sleep(1200);
  const gb2 = await A.game(`({ s: ctx.car.s, T: ctx.party.clock(), f: L3.frames })`);
  // the real pull-in: into the bay, stop → the visit beat starts by itself
  await g(`(ctx.banter.autopilot = null, ctx.party._debug.place(1300, 12.0, 0))`);
  t.check("host pulls in at the Gas 'n' Go (a personal world visit)", await hostUntil(t, `ctx.state === "worldVisit"`, "host: the Gas 'n' Go visit starts", 60000));
  await sleep(2500);
  await A.until(`L3.frames > ${gb2.f} + 8`, "guest: frames keep coming", 60000);     // (a slow runner: wait in frames)
  const mid = await A.game(`({ s: ctx.car.s, T: ctx.party.clock(), st: ctx.state, speed: ctx.car.speed, f: L3.frames })`);
  t.check("…the guest keeps driving meanwhile (no shared pause)", mid.st === "playing" && mid.f > gb2.f + 3 && mid.s > gb2.s + 0.5 && mid.speed > 8 && mid.T > gb2.T + 2000, JSON.stringify({ gb, gb2, mid }));
  const tr = await A.game(TRAFFIC_OK);
  t.check("…and the guest's traffic is still exactly where the party clock says", tr.n >= 4 && tr.bad === 0 && tr.stray === 0, JSON.stringify(tr));
  await t.shot("visit-host");
  await A.shot("visit-guest");
  if (!await hostUntil(t, `ctx.state === "playing"`, "the visit ends by itself, back to driving", 150000)) return false;
  await A.game(`(ctx.banter.autopilot = { d: 1.75, speed: 0 }, true)`);
  // the 📱 phone / pause in a party doesn't stop the world: her car eases to a stop and STAYS there
  // (it used to hold the brake at a standstill — and the brake is reverse: it backed down the highway)
  await g(`(ctx.banter.autopilot = null, ctx.party._debug.place(1500, 1.75, 16), true)`);
  await t.L(`import("./js/core/ctx.js").then(m => { window.__pv = { min: 9, n: 0 }; m.hook("hud", () => { if (m.ctx.paused && m.ctx.state === "playing") { window.__pv.min = Math.min(window.__pv.min, m.ctx.car.vF); window.__pv.n++; } }); return true; })`);
  const s0p = await g(`ctx.car.s`);
  await g(`(ctx.paused = true, true)`);
  await hostUntil(t, `window.__pv.n > 240`, "host: paused for 8 s of frames", 120000);
  const pv = await g(`({ min: +window.__pv.min.toFixed(2), vF: +ctx.car.vF.toFixed(2), ds: +(ctx.car.s - ${"${s0p}"}).toFixed(1), n: window.__pv.n })`.replace("${s0p}", s0p));
  t.check("paused in a party (the 📱 phone): the car stops and never rolls backwards", pv.min > -0.3 && Math.abs(pv.vF) < 0.6 && pv.ds > -0.5, JSON.stringify(pv));
  await g(`(ctx.paused = false, true)`);
  // a cameo scene too (Avigail's porch) — personal, the guest carries on
  await g(`ctx.cameos.trigger("porch")`);
  if (await hostUntil(t, `ctx.state === "cameosPorch"`, "host: Avigail's porch (a personal scene)", 30000)) {
    const a0 = await A.game(`ctx.party.clock()`);
    await sleep(2000);
    t.check("porch on the host: the guest's party clock + state carry on", await A.game(`ctx.state === "playing" && ctx.party.clock() > ${a0} + 1500`));
    await t.shot("porch-host");
    await g(`(L3.setState("playing"), true)`);
    await hostUntil(t, `ctx.state === "playing" && !ctx.dialogOpen`, "host: back from the porch, no dialogue left over", 30000);
  }

  // 5. shared traffic stays in sync with every roadside feature on
  for (const [i, p] of pages.entries()) await p.game(`(ctx.banter.autopilot = { d: ${i ? 1.75 : 5.25}, speed: 20 }, ctx.party._debug.place(2900, ${i ? 1.75 : 5.25}, 18))`);
  await sleep(3000);
  const T0 = await g(`Math.round(ctx.party.clock() + 1500)`);
  const lists = [];
  for (const p of pages) lists.push(JSON.stringify(await p.game(`ctx.party.trafficAt(${T0}, 2600, 3800).map(c => [c.key, +c.s.toFixed(2)])`)));
  t.check("traffic: identical cars + positions on both screens at the same party time", lists[0] === lists[1] && JSON.parse(lists[0]).length >= 4, `${JSON.parse(lists[0]).length} cars`);
  for (const p of pages) {
    const r = await p.game(TRAFFIC_OK);
    t.check(`traffic (${p.label}): every live car where the clock says, no strays`, r.n >= 4 && r.bad === 0 && r.stray === 0, JSON.stringify(r));
  }
  // the 💼 Jobs app works on the party highway
  t.check("💼 Jobs app on the party highway", await g(`ctx.phone.apps().includes("jobs")`));
  await g(`ctx.phone.openPhone("jobs")`);
  await sleep(800);
  t.check("…listing the jobs (cab + delivery)", await t.L(`document.querySelectorAll("#lpApp .lp-job").length >= 2`), (await t.L(`(document.getElementById("lpApp") || {}).textContent || ""`)).slice(0, 200));
  await t.shot("jobs-app");
  await g(`ctx.phone.closePhone()`);
  const perf = await PERF(t.L, 4000);
  console.log("   PERF partyworld highway (2 players, roadside on)", JSON.stringify(perf));
  t.check("perf: the party highway renders with the roadside on", !!perf && perf.calls > 0 && perf.maxCalls < 900, JSON.stringify(perf));

  // 6. arriving at Bubbe's banks the run: personal stats record in a party
  const S = await g(`ctx.journey ? ctx.journey.stopS(0) : 4800`);
  for (const [i, p] of pages.entries()) await p.game(`(ctx.banter.autopilot = { d: ${i ? 1.75 : 5.25}, speed: 16 }, ctx.party._debug.place(${S - 70 - i * 10}, ${i ? 1.75 : 5.25}, 14))`);
  for (const p of pages) if (!await p.until(`ctx.state === "partyResults" && ctx.party.activity.ph === "done"`, "group arrival at Bubbe's", 150000)) return false;
  for (const p of pages) await p.game(`(ctx.banter.autopilot = null, true)`);
  await sleep(1200);
  const st1 = await g(STATS);
  t.check("stats: the party run was banked (runs3d +1, lifetime score, miles)", (st1.runs3d || 0) === (st0.runs3d || 0) + 1 && st1.lifetimeScore >= st0.lifetimeScore && (st1.miles3d || 0) >= (st0.miles3d || 0), JSON.stringify({ before: [st0.runs3d, st0.lifetimeScore, st0.miles3d], after: [st1.runs3d, st1.lifetimeScore, st1.miles3d] }));
  t.check("stats: the Gas 'n' Go visit counted (placeVisits, gasStops)", (st1.placeVisits || 0) >= (st0.placeVisits || 0) + 1 && (st1.gasStops || 0) >= 1, JSON.stringify({ placeVisits: [st0.placeVisits, st1.placeVisits], gasStops: st1.gasStops }));
  t.check("stats: the run is over once (G.ended)", await g(`ctx.G.ended === true && ctx.G.mode === "party"`));
  await t.shot("arrival");
  return true;
}

// ── 🌍 FREE ROAM: the orgs in a party town ───────────────────────────────
async function freeRoam(t, guests) {
  const g = t.game, A = guests[0];
  const pages = [{ label: "host", game: c => t.game(c), until: (c, w, ms) => hostUntil(t, c, w, ms), L: c => t.L(c), shot: n => t.shot(n) }, A];
  // (whoever hosts now: a starved runner can hand the party over mid-test)
  const hp = await g(`ctx.party.isHost`) ? pages[0] : A;
  await hp.game(`ctx.party._debug.toLobby()`);
  for (const p of pages) if (!await p.until(`ctx.state === "partyLobby"`, "back to the lobby", 40000)) return;
  const hp2 = await g(`ctx.party.isHost`) ? pages[0] : A;
  await hp2.game(`ctx.party._debug.start("roam")`);
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "roam"`, "free roam: GO", 60000)) return;
  for (const p of pages) await p.game(`(ctx.banter.autopilot = { d: 5.25, speed: 0 }, ctx.hustle.hold(900), true)`);
  // the long road: every kind of slot shows up, the same on both screens — and the big ones build the same
  // (each screen plans the road as features reserve their slots: on a slow runner one can still be catching up — compare
  //  again for a few seconds of game frames before calling it different)
  let rp = [];
  for (let i = 0; i < 8; i++) {
    rp = [];
    for (const p of pages) rp.push(await p.game(`ctx.party.road.list(0, 24000).map(s => ({ key: s.key, id: s.id, s: +s.s.toFixed(2) }))`));
    if (JSON.stringify(rp[0]) === JSON.stringify(rp[1])) break;
    await t.frames(30);
  }
  const rdiff = rp[0].findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(rp[1][i]));
  t.check("free roam plan: identical on both screens, every feature gets slots", JSON.stringify(rp[0]) === JSON.stringify(rp[1]) && ["roadevents", "cameos", "hustle"].every(i => rp[0].some(x => x.id === i)), `${rp[0].length}/${rp[1].length} slots; first difference at ${rdiff}: ${JSON.stringify(rp[0][rdiff])} ≠ ${JSON.stringify(rp[1][rdiff])}`);
  // (friends = the same game: 🌍 Free Roam rides on each one's OWN run now — her own highway set pieces, payphones and
  //  traffic, like solo; the seeded road plan is the 🏡 Road Trip's, checked above. What's shared in Free Roam: the towns'
  //  loop traffic + the org cruisers below, the claims, the friends themselves.)
  for (const p of pages) t.check(`${p.label}: Free Roam on her own run (no party run)`, await p.game(`ctx.G.mode === "cruise" && ctx.party.ownRun`));
  // each town its own exit, in the route's fixed order: the same metres on both screens (planned from fixed data only)
  const ex = [];
  for (const p of pages) ex.push(await p.game(`(["midwood", "lakewood", "midwood"].reduce((a, id) => { const s = ctx.town.exitOf(id, a.s); return { s: s + 1, out: a.out.concat(id + "@" + Math.round(s)) }; }, { s: 20000, out: [] }).out.join(","))`));
  t.check("the same exits, same towns, same order and metres on both screens", !!ex[0] && ex[0] === ex[1] && /midwood@/.test(ex[0]) && /lakewood@/.test(ex[0]), ex.join(" | "));
  for (const p of pages) {
    await p.until(`(ctx.town.load("lakewood"), ctx.town.debug.S.loaded) && ctx.community.debug.CM.loaded`, "town + community models", 120000);
    await p.game(`(ctx.town.load("lakewood"), true)`); await p.until(`ctx.town.loaded("lakewood")`, "Lakewood's models", 120000);   // (Lakewood isn't the first exit any more: load it)
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
    await p.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "in Lakewood", 15000);
  }
  await sleep(3000);
  const T0 = await g(`Math.round(ctx.party.clock() + 2000)`);
  const cm = [];
  for (const p of pages) cm.push(JSON.stringify(await p.game(`ctx.community.debug.party.cruisersAt(${T0}).map(c => [c.key, c.org, +c.x.toFixed(2), +c.z.toFixed(2)])`)));
  const cmA = JSON.parse(cm[0]);
  t.check("community: the same org cruisers at the same places on both screens (party time)", cm[0] === cm[1] && cmA.length >= 3 && new Set(cmA.map(c => c[1])).size >= 3, `${cmA.length} cars: ${cmA.map(c => c[0]).join(" ")}`);
  let bad = 0, n = 0;
  for (const p of pages) {
    const live = await p.game(`ctx.community.debug.party.live().map(c => { const w = ctx.community.debug.party.cruisersAt(c.at).find(x => x.key === c.key); return !!w && Math.hypot(w.x - c.x, w.z - c.z) < 0.05; })`);
    n += live.length; bad += live.filter(x => !x).length;
  }
  t.check("community: every live org cruiser sits where the shared clock says", n >= 6 && bad === 0, `${n} live, ${bad} off`);
  let tbad = 0, tn = 0;
  for (const p of pages) {
    const live = await p.game(`ctx.openworld.debug.townLive().map(c => { const w = ctx.openworld.debug.townCarsAt(c.at).find(x => x.key === c.key); return !!w && Math.hypot(w.x - c.x, w.z - c.z) < 0.05; })`);
    tn += live.length; tbad += live.filter(x => !x).length;
  }
  t.check("town traffic (openworld's minivans) still on their loops alongside the orgs", tn >= 12 && tbad === 0, `${tn} live, ${tbad} off`);
  const strays = await g(`ctx.traffic.cars.filter(c => !(c.data && (c.data.party || c.data.partyLocal || (c.data.town && c.data.town.hazard)))).map(c => c.kind + ":" + Object.keys(c.data || {}).join("/") + ":" + Math.round(c.s || 0))`);
  t.check("no random town drivers / no strays in a party town", strays.length === 0, strays.slice(0, 6).join(" "));
  // the org cruisers never share a spot with a minivan (a quarter loop apart at least)
  t.check("org cruisers keep clear of the minivans on their loop", await g(`(() => { const a = ctx.community.debug.party.cruisersAt(ctx.party.clock()), b = ctx.openworld.debug.townCarsAt(ctx.party.clock()); return a.every(c => b.every(v => Math.hypot(v.x - c.x, v.z - c.z) > 2.6)); })()`));
  const sc = [];
  for (const p of pages) sc.push(JSON.stringify(await p.game(`[1, 2, 3, 4, 5, 6, 7, 8].map(w => { const s = ctx.community.debug.party.sceneFor(w), a = s && ctx.community.debug.party.sceneAt(w); return s ? [s.kind, s.anchor, +s.callT.toFixed(2), a ? [+a.x.toFixed(1), +a.z.toFixed(1)] : null] : null; })`)));
  t.check("community: the same roadside scenes (kind, kerb, call-in time) on both screens", sc[0] === sc[1] && JSON.parse(sc[0]).filter(Boolean).length >= 3, sc[0].slice(0, 220));
  t.check("📞 Call app in the party town", await g(`ctx.phone.apps().includes("community")`));
  // look at an org cruiser
  const c0 = await g(`(() => { const c = ctx.community.debug.party.live()[0]; return c ? { x: c.x, z: c.z } : null; })()`);
  if (c0) {
    await g(`(() => { const c = ctx.car, x = ${c0.x} + 14, z = ${c0.z} + 14, n = ctx.world.road.nearest(x, z, null, {}); c.place(x, z, Math.atan2(${c0.x} - x, ${c0.z} - z)); c.s = n.s; c.d = n.d; c.vx = c.vz = 0; c.vF = 0; if (ctx.cam) ctx.cam.snap(); return true; })()`);
    await sleep(2500);
    await t.shot("town-orgs");
  }
  const perf = await PERF(t.L, 4000);
  console.log("   PERF partyworld town (2 players, orgs on)", JSON.stringify(perf));
  t.check("perf: the party town renders with the org cruisers", !!perf && perf.calls > 0 && perf.maxCalls < 1200, JSON.stringify(perf));
  await A.shot("town-guest");
  await g(`ctx.party.leave()`);
}
