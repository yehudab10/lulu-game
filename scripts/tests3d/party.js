// 🎉 Party with friends — three real browser pages against the LOCAL relay
// (server/local-relay.js on a private port; never production).
//   host creates → a friend joins by CODE (the letter keyboard) → another by LINK
//   (?party=CODE) → the lobby lines up three cars → ready-up, host picks Race →
//   synced start (party-clock offsets agree to a few ms) → remote cars move
//   smoothly (no frame-to-frame jump beyond what their speed allows) → everyone
//   sees the same traffic (pure function of party seed + clock, and the live cars
//   follow it) → BONK on both screens → finish → results podium → back to lobby →
//   the host leaves → a guest takes over (host migration) → a client's socket drops
//   and it rejoins as the same player → the old host rejoins mid-ROAD TRIP and
//   slots into the convoy → everyone arrives at Bubbe's → group arrival.
const { spawn } = require("child_process");
const path = require("path");
const PORT = 21000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=party,atmos,play&mpurl=${encodeURIComponent(URL)}`;
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

/** A second / third player: its own browser context (own localStorage), a small viewport. */
async function guestPage(t, label, save2d, query) {
  const browser = t.page.context().browser();
  const page = await browser.newPage({ viewport: { width: 520, height: 300 } });
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
  const g = {
    label, page, errors,
    L: code => page.evaluate(code),
    game: code => page.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`),
    async until(code, what, ms = 90000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const ok = await page.evaluate(`(() => { try { const L3 = window.__lulu3d, ctx = L3 && L3.ctx; return !!(${code}); } catch (e) { return false; } })()`).catch(() => false);
        if (ok) return true;
        await sleep(150);
      }
      t.check(`${label}: ${what}`, false, "timed out");
      return false;
    },
    async click(sel) { const ok = await page.evaluate(s => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel); await sleep(250); return ok; },
  };
  return g;
}
/** Wall-clock wait on the main page (several pages share the CPU, so frames are slow and uneven). */
async function hostUntil(t, code, what, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await t.game(`(() => { try { return !!(${code}); } catch (e) { return false; } })()`).catch(() => false)) return true;
    await sleep(150);
  }
  t.check(what, false, "timed out in " + await t.game(`ctx.state`).catch(() => "?"));
  return false;
}
async function clickSel(t, sel) { const ok = await t.L(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b) b.click(); return !!b; })()`); await sleep(250); return ok; }
/** party clock − wall clock, averaged — same machine, so the pages' answers must agree. */
const OFFSET = `(() => { let a = 0; for (let i = 0; i < 5; i++) a += ctx.party.clock() - (performance.timeOrigin + performance.now()); return a / 5; })()`;

/** Per built road chunk: its billboards, golden dreidels and ramps (all must match across screens). */
const WORLD = `(() => {
  const out = {};
  for (const ch of ctx.world.activeChunks()) out[ch.k] = { bb: [], dr: [], rp: [] };
  for (const b of ctx.banter.activeBillboards()) { const k = Math.floor(b.chunkS / 200); if (out[k]) out[k].bb.push(b.key + "@" + b.s + ":" + b.side); }
  for (const d of ctx.play.debug.dreidels) if (out[d.k]) out[d.k].dr.push(d.s.toFixed(1) + ":" + d.d.toFixed(2));
  for (const r of ctx.play.debug.ramps) if (out[r.k]) out[r.k].rp.push(r.s.toFixed(1) + ":" + r.d.toFixed(2));
  for (const k in out) for (const x of ["bb", "dr", "rp"]) out[k][x].sort();
  return out;
})()`;

module.exports = {
  name: "party",
  query: Q,
  save2d: { totalCoins: 300, ownedSkins: ["pink", "gold", "blue"], selectedSkin: "pink", mpName: "Kugel Kid", ownedHorns: ["beep", "duck"], horn: "beep" },
  async run(t) {
    await startRelay();
    const guests = [];
    try { await body(t, guests); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      try { relay.kill(); } catch (e) { }
    }
  },
};

async function body(t, guests) {
  await t.frames(4);
  const titleBtns = await t.L(`[...document.querySelectorAll("#screenCard .btn")].map(b => b.textContent)`);
  t.check("title has ONE multiplayer entry: 🎉 Party with friends", titleBtns.some(x => /Party with friends/.test(x)) && !titleBtns.some(x => /Shared Road/.test(x)), titleBtns.join(" / ").slice(0, 200));
  t.check("nothing connects until the player opts in", await t.game(`!ctx.party.active`));

  // ── host ──
  await t.click(/Party with friends/);
  t.check("hub: host / join / open road", await t.L(`["pt_host", "pt_join", "pt_open"].every(id => !!document.getElementById(id))`));
  await t.shot("hub");
  await t.click(/Host a party/);
  if (!await hostUntil(t, `ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`, "host: lobby + connected")) return;
  const code = await t.game(`ctx.party.code`);
  t.check("party code: 4 unambiguous letters", /^[ABCDEFGHJKMNPQRTWXYZ]{4}$/.test(code), code);
  t.check("invite link shown", await t.L(`/\\?party=${code}/.test(document.getElementById("pt_link").textContent)`));

  // ── a friend joins by CODE, typed on the letter keyboard ──
  const A = await guestPage(t, "guest A", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" });
  guests.push(A);
  await A.until(`L3.state === "title"`, "boots", 180000);
  await A.until(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Party with friends/.test(b.textContent))`, "sees the party entry");
  await A.L(`[...document.querySelectorAll("#screenCard .btn")].find(b => /Party with friends/.test(b.textContent)).click()`);
  await sleep(300);
  await A.click("#pt_join");
  t.check("join screen: letter keyboard (20 keys)", await A.L(`document.querySelectorAll("#screenCard .pt-keys .btn").length === 20`));
  for (const ch of code) await A.click("#ptk_" + ch);
  t.check("typed code fills the boxes", await A.L(`[...document.querySelectorAll("#screenCard .pt-code span")].map(s => s.textContent).join("")`) === code);
  await A.click("#ptk_go");
  if (!await A.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "joins the party by code")) return;

  // ── another joins by LINK ──
  const B = await guestPage(t, "guest B", { totalCoins: 50, ownedSkins: ["pink", "red"], selectedSkin: "red", mpName: "Babka Baron" }, `&party=${code}`);
  guests.push(B);
  if (!await B.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "auto-joins from the invite link", 180000)) return;

  // ── the lobby: three cars lined up ──
  await hostUntil(t, `ctx.party.players.length === 3 && ctx.party._debug.stageCars() === 3`, "lobby lines up 3 cars");
  t.check("host lobby: 3 players, 3 cars on the stage", await t.game(`ctx.party.players.length === 3 && ctx.party._debug.stageCars() === 3`));
  t.check("crew chips list everyone (👑 host)", await t.L(`(() => { const c = document.getElementById("pt_crew"); return c && c.children.length === 3 && /👑/.test(c.textContent) && /Latke Legend/.test(c.textContent) && /Babka Baron/.test(c.textContent); })()`));
  await A.click("#pt_go"); await B.click("#pt_go");
  await hostUntil(t, `/2 of 2 friends ready/.test(document.getElementById("pt_status").textContent)`, "host sees both friends ready");
  t.check("ready-up reaches the host", true);
  await clickSel(t, "#pt_act_race");
  await A.until(`/Race/.test(document.querySelector(".pt-next") && document.querySelector(".pt-next").textContent)`, "guest sees the host's pick (Race)");
  await t.frames(3);
  await t.shot("lobby");

  // ── RACE: synced start ──
  const pages = [{ g: null, game: c => t.game(c), until: (c, w, ms) => hostUntil(t, c, w, ms) }, A, B];
  await clickSel(t, "#pt_go");
  for (const p of pages) if (!await p.until(`ctx.state === "partyGrid" || ctx.state === "playing"`, "race: on the grid", 30000)) return;
  await t.shot("grid");
  for (const p of pages) await p.until(`ctx.state === "playing" && ctx.party._debug.P.goAt`, "race: GO", 30000);
  const offs = [], gos = [];
  for (const p of pages) { offs.push(await p.game(OFFSET)); gos.push(await p.game(`ctx.party._debug.P.goAt`)); }
  const spread = Math.max(...offs) - Math.min(...offs);
  t.check("synced start: every screen agrees on the party clock (≤ 30 ms)", spread < 30, `offset spread ${spread.toFixed(1)} ms`);
  t.check("synced start: same scheduled GO everywhere", gos.every(g => g && g.t0 === gos[0].t0), JSON.stringify(gos.map(g => g && g.t0)));
  // (the first frame at/after t0 — in software WebGL with three pages that can be a while; never early)
  t.check("synced start: GO never fires early on any screen", gos.every(g => g && g.party >= g.t0 - 1), `first frame after t0: ${JSON.stringify(gos.map(g => g && Math.round(g.party - g.t0)))} ms`);

  // everyone holds their lane at a cruise (banter's test autopilot), already rolling
  for (const [i, p] of pages.entries()) await p.game(`(ctx.banter.autopilot = { d: ${[1.75, 5.25, 1.75][i]}, speed: 24 }, ctx.party._debug.place(${[90, 82, 74][i]}, ${[1.75, 5.25, 1.75][i]}, 22))`);
  await sleep(2500);
  await t.game(`ctx.party._debug.trace(true)`);
  await sleep(6000);
  const tr = await t.game(`[...ctx.party._debug.cars.values()].map(rc => ({ uid: rc.uid, tr: rc.trace || [] }))`);
  await t.game(`ctx.party._debug.trace(false)`);
  let worst = 0, moved = 0, snaps = 0, samples = 0, latJump = 0;
  for (const c of tr) {
    const pts = c.tr.filter(x => x.s != null);
    snaps += c.tr.filter(x => x.snap).length;
    for (let i = 1; i < pts.length; i++) {
      const dt = (pts[i].T - pts[i - 1].T) / 1000, ds = Math.abs(pts[i].s - pts[i - 1].s), dd = Math.abs(pts[i].d - pts[i - 1].d);
      if (dt <= 0) continue;
      samples++;
      worst = Math.max(worst, ds - (45 * dt + 1.5));
      latJump = Math.max(latJump, dd - (8 * dt + 1.0));
    }
    if (pts.length > 1) moved = Math.max(moved, pts[pts.length - 1].s - pts[0].s);
  }
  // where each friend really is vs where the host draws them (drawn ~150–450 ms of party time in the past)
  const gap2 = [];
  for (const g of [A, B]) {
    const me = await g.game(`({ u: ctx.party.uid, s: ctx.car.s })`);
    const drawn = await t.game(`(() => { const rc = ctx.party._debug.cars.get(${JSON.stringify(me.u)}); return rc && rc.shown ? rc.s : null; })()`);
    gap2.push(drawn == null ? 999 : Math.abs(me.s - drawn));
  }
  t.check("remote cars stream and move with their drivers", tr.length === 2 && moved > 0.2 && gap2.every(x => x < 6), `${tr.length} cars, moved ${moved.toFixed(1)} m over ${samples} frames; drawn vs actual ${gap2.map(x => x.toFixed(2)).join(", ")} m`);
  t.check("smooth: no frame-to-frame jump beyond what speed allows", worst <= 0 && latJump <= 0, `worst excess ${worst.toFixed(2)} m, lateral ${latJump.toFixed(2)} m`);
  t.check("smooth: no snaps while streaming", snaps === 0, `${snaps} snaps`);
  await t.shot("race-hud");
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-party-guest-race.png") }).catch(() => { });

  // ── everyone sees the same traffic ──
  const T0 = await t.game(`Math.round(ctx.party.clock() + 1000)`);
  const lists = [];
  for (const p of pages) lists.push(JSON.stringify(await p.game(`ctx.party.trafficAt(${T0}, 0, 4000).map(c => [c.key, c.kind, c.paint, +c.s.toFixed(3), c.d])`)));
  t.check("same traffic: identical cars/lanes/positions at the same party time", lists.every(l => l === lists[0]) && JSON.parse(lists[0]).length > 10, `${JSON.parse(lists[0]).length} cars`);
  let liveBad = 0, liveN = 0, common = 0;
  const lives = [];
  for (const p of pages) lives.push(await p.game(`ctx.party.trafficLive().map(c => ({ key: c.key, s: c.s, at: c.at, ok: (() => { const w = ctx.party.trafficAt(c.at, c.s - 2, c.s + 2).find(x => x.key === c.key); return !!w && Math.abs(w.s - c.s) < 0.01; })() }))`));
  for (const l of lives) for (const c of l) { liveN++; if (!c.ok) liveBad++; }
  const keys0 = new Set(lives[0].map(c => c.key));
  for (const c of lives[1]) if (keys0.has(c.key)) common++;
  t.check("same traffic: every live car on every screen sits where the shared clock says", liveN > 6 && liveBad === 0 && common > 2, `${liveN} live cars, ${liveBad} off, ${common} shared host↔A`);
  t.check("party traffic is immune (no random spawns)", await t.game(`ctx.traffic.config.enabled === false && ctx.traffic.cars.every(c => c.data && c.data.party)`));
  t.check("random features off in a party", await t.game(`!ctx.enabled("roadevents") && !ctx.enabled("cameos") && !ctx.enabled("law") && ctx.enabled("party")`));
  const skies = [];
  for (const p of pages) skies.push(await p.game(`ctx.atmos ? { c: ctx.atmos.clock, w: ctx.atmos.weather, m: ctx.atmos.info().mode, pc: ctx.party.atmosClock(), pw: ctx.party.atmosWeather().kind } : null`));
  // the rest of the shared world: banter's billboards (party-seeded spots), play's ramps + golden dreidels (seeded per chunk)
  const sameWorld = async label => {
    const worlds = [];
    for (const p of pages) worlds.push(await p.game(WORLD));
    const common = worlds.map(w => Object.keys(w)).reduce((a, b) => a.filter(k => b.includes(k)));
    const pick = w => JSON.stringify(common.map(k => w[k]));
    const n = common.reduce((acc, k) => acc + worlds[0][k].bb.length + worlds[0][k].dr.length + worlds[0][k].rp.length, 0);
    t.check(`same world (${label}): billboards, ramps + golden dreidels identical on every screen`, common.length >= 3 && worlds.every(w => pick(w) === pick(worlds[0])),
      `${common.length} shared chunks, ${n} set pieces`);
  };
  await sameWorld("start");
  t.check("same sky: atmos day + weather come from the party clock", skies.every(x => x && x.m === "cruise" && Math.abs(x.pc - skies[0].pc) < 0.003 && x.pw === skies[0].pw && Math.abs(x.c - x.pc) < 0.01),
    JSON.stringify(skies.map(x => x && [x.m, +x.c.toFixed(4), x.w])));

  // ── BONK: guest A pulls up right beside the host (both stop) ──
  for (const p of pages) await p.game(`(ctx.banter.autopilot = { d: ctx.car.d, speed: 0 }, true)`);
  await sleep(2500);
  const hs = await t.game(`({ s: ctx.car.s, d: ctx.car.d })`);
  await A.game(`(ctx.banter.autopilot = null, ctx.party._debug.place(${hs.s.toFixed(2)}, ${(hs.d + 1.3).toFixed(2)}, 0))`);
  await A.game(`(ctx.banter.autopilot = { d: ${(hs.d + 1.3).toFixed(2)}, speed: 0 }, true)`);
  await hostUntil(t, `ctx.party._debug.P.bonks > 0`, "BONK on the host's screen", 30000);
  await A.until(`ctx.party._debug.P.bonks > 0`, "BONK on the friend's screen", 30000);
  t.check("BONK! symmetric — both screens bounced", await t.game(`ctx.party._debug.P.bonks > 0`) && await A.game(`ctx.party._debug.P.bonks > 0`));
  t.check("a bump costs no hearts", await t.game(`ctx.G.hearts === 3`) && await A.game(`ctx.G.hearts === 3`));
  await t.shot("bonk");

  // ── finish → results podium ──
  for (const [i, p] of pages.entries()) await p.game(`(ctx.banter.autopilot = { d: ${[1.75, 5.25, 1.75][i]}, speed: 30 }, ctx.party._debug.place(${2560 - 40 - i * 12}, ${[1.75, 5.25, 1.75][i]}, 26))`);
  for (const p of pages) if (!await p.until(`ctx.state === "partyResults"`, "race results for everyone", 90000)) return;
  t.check("results: everyone finished with a time", await t.game(`Object.keys(ctx.party.activity.fin).length === 3`));
  await sameWorld("finish");
  t.check("results podium shows 3 cars + the standings", await t.game(`ctx.party._debug.stageCars() === 3`) && await t.L(`document.querySelectorAll("#screenCard .pt-res > div").length === 3`));
  t.check("host gets Rematch / Back to lobby", await t.L(`!!document.getElementById("pt_again") && !!document.getElementById("pt_lobby")`));
  t.check("guests wait for the host (no host buttons)", await A.L(`!document.getElementById("pt_again") && /picks what's next/.test(document.getElementById("screenCard").textContent)`));
  for (const p of pages) await p.game(`(ctx.banter.autopilot = null, true)`);
  await t.frames(3);
  await t.shot("podium");
  await clickSel(t, "#pt_lobby");
  for (const p of pages) if (!await p.until(`ctx.state === "partyLobby"`, "back to the lobby", 30000)) return;

  // ── the host leaves → a guest takes over ──
  const uidA = await A.game(`ctx.party.uid`), uidB = await B.game(`ctx.party.uid`);
  await clickSel(t, "#pt_leave"); await t.frames(1);
  if (await t.game(`ctx.state === "partyLobby"`)) await clickSel(t, "#pt_leave");    // first press only focuses "Leave"
  await hostUntil(t, `ctx.state === "title" && !ctx.party.active`, "host leaves to the title", 20000);
  await A.until(`ctx.party.host && ctx.party.host !== ${JSON.stringify(await t.game(`ctx.party.uid`))} && (ctx.party.isHost || ctx.party.host === ${JSON.stringify(uidB)})`, "a new host takes over", 30000);
  await B.until(`ctx.party.host === ${JSON.stringify(await A.game(`ctx.party.host`))}`, "both guests agree on the new host", 20000);
  const hA = await A.game(`ctx.party.isHost`), hB = await B.game(`ctx.party.isHost`);
  t.check("host migration: exactly one new host, both agree", hA !== hB && (await A.game(`ctx.party.host`)) === (await B.game(`ctx.party.host`)));
  const NH = hA ? A : B, OG = hA ? B : A;
  await NH.until(`/👑/.test(document.getElementById("pt_crew").textContent) && document.getElementById("pt_act_trip")`, "new host gets the host controls");

  // ── a client's socket drops → it reconnects as the same player ──
  const ogUid = await OG.game(`ctx.party.uid`);
  const drops0 = await OG.game(`ctx.party._debug.N.drops || 0`);
  await OG.game(`ctx.party._debug.blink()`);
  await OG.until(`(ctx.party._debug.N.drops || 0) > ${drops0} && ctx.party.connected && ctx.party.host`, "socket drops and reconnects by itself", 20000);
  await NH.until(`ctx.party.players.length === 2 && ctx.party.players.some(p => p.uid === ${JSON.stringify(ogUid)} && !p.status)`, "rejoins as the same player (same slot)", 20000);
  t.check("drop + rejoin: same uid, still in the party", (await OG.game(`ctx.party.uid`)) === ogUid && await NH.game(`ctx.party.players.length === 2`));

  // ── ROAD TRIP: new host starts it; the old host rejoins late and slots into the convoy ──
  await NH.click("#pt_act_trip");
  await NH.click("#pt_go");
  for (const p of [NH, OG]) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "trip"`, "road trip: GO", 40000)) return;
  for (const p of [NH, OG]) await p.game(`(ctx.banter.autopilot = { d: ${p === NH ? 1.75 : 5.25}, speed: 22 }, true)`);
  await sleep(2500);
  await t.game(`ctx.party.join(${JSON.stringify(code)})`);
  if (!await hostUntil(t, `ctx.state === "playing" && ctx.party.activity.k === "trip" && ctx.G.mode === "party"`, "late joiner slots into the road trip", 60000)) return;
  const gap = await t.game(`(() => { const ss = [...ctx.party._debug.cars.values()].filter(rc => rc.shown).map(rc => rc.s); return ss.length ? Math.min(...ss.map(s => Math.abs(s - ctx.car.s))) : -1; })()`);
  t.check("late joiner lands with the convoy (not back at the start)", gap >= 0 && gap < 80, `${gap.toFixed ? gap.toFixed(1) : gap} m from the nearest friend`);
  await t.game(`(ctx.banter.autopilot = { d: 5.25, speed: 22 }, true)`);
  await sleep(2000);
  await t.shot("roadtrip");
  // everyone gets to Bubbe's
  const S = await t.game(`ctx.journey ? ctx.journey.stopS(0) : 4800`);
  const trio = [pages[0], NH, OG];
  for (const [i, p] of trio.entries()) await p.game(`(ctx.banter.autopilot = { d: ${[5.25, 1.75, 5.25][i]}, speed: 16 }, ctx.party._debug.place(${S - 60 - i * 10}, ${[5.25, 1.75, 5.25][i]}, 14))`);
  for (const p of trio) if (!await p.until(`ctx.state === "partyResults" && ctx.party.activity.ph === "done"`, "group arrival at Bubbe's", 150000)) return;
  for (const p of trio) await p.game(`(ctx.banter.autopilot = null, true)`);
  t.check("road trip: everyone arrived", await t.game(`Object.keys(ctx.party.activity.arr).length === 3`));
  t.check("group arrival card + 📸 group photo", await t.L(`/Bubbe/.test(document.getElementById("screenCard").textContent)`) && (await t.game(`!ctx.play`) || await t.L(`!!document.getElementById("pt_photo")`)));
  await sleep(1500);
  await t.shot("arrival");

  // ── DREIDEL DASH: first claim wins (both grab the same dreidel at once) ──
  const uids = { [await pages[0].game(`ctx.party.uid`)]: pages[0], [await NH.game(`ctx.party.uid`)]: NH, [await OG.game(`ctx.party.uid`)]: OG };
  await NH.game(`ctx.party._debug.start("dash")`);
  for (const p of trio) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "dash"`, "dash: GO", 40000)) return;
  const spots = await NH.game(`ctx.party._debug.dash().map(x => [x.s, x.d])`);
  const sameSpots = JSON.stringify(await OG.game(`ctx.party._debug.dash().map(x => [x.s, x.d])`)) === JSON.stringify(spots);
  t.check("dash: the golden dreidels are in the same places on every screen", sameSpots && spots.length > 20);
  await OG.game(`ctx.party._debug.place(${spots[0][0] - 1}, ${spots[0][1]}, 3)`);
  await pages[0].game(`ctx.party._debug.place(${spots[1][0]}, ${spots[1][1]}, 0)`);
  await NH.game(`ctx.party._debug.place(${spots[1][0]}, ${spots[1][1]}, 0)`);
  for (const p of trio) await p.until(`ctx.party.activity.got && ctx.party.activity.got[0] != null && ctx.party.activity.got[1] != null`, "dash: claims settled", 30000);
  const gots = [];
  for (const p of trio) gots.push(JSON.stringify(await p.game(`[ctx.party.activity.got[0], ctx.party.activity.got[1]]`)));
  const g01 = JSON.parse(gots[0]);
  t.check("dash: the host's call is final and everyone agrees (one winner per dreidel)", gots.every(x => x === gots[0]) && g01[0] === await OG.game(`ctx.party.uid`) && !!uids[g01[1]], gots[0]);
  await t.shot("dash");
  await NH.game(`ctx.party._debug.setA(Object.assign({}, ctx.party.activity, { dur: 1 }))`);
  for (const p of trio) if (!await p.until(`ctx.state === "partyResults" && ctx.party.activity.k === "dash"`, "dash: results", 40000)) return;
  t.check("dash: results rank by dreidels", await t.L(`/✨ 1/.test(document.querySelector("#screenCard .pt-res").textContent)`));

  // ── COP TAG: the cop bumps a friend → they're the cop ──
  await NH.game(`ctx.party._debug.start("tag")`);
  for (const p of trio) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "tag"`, "tag: GO", 40000)) return;
  const cop0 = await NH.game(`ctx.party.activity.cop`);
  const copPage = uids[cop0], victimPage = trio.find(p => p !== copPage);
  t.check("tag: someone is the cop (light bar on)", !!copPage && await copPage.game(`ctx.car.tilt.children.some(c => c.children.length === 2 && c.visible)`));
  await copPage.until(`ctx.party.clock() > ctx.party.activity.guard`, "tag: head start over", 20000);
  const vs = await victimPage.game(`({ s: ctx.car.s, d: ctx.car.d })`);
  await victimPage.game(`ctx.party._debug.place(${vs.s.toFixed(2)}, ${vs.d.toFixed(2)}, 0)`);
  await copPage.game(`ctx.party._debug.place(${vs.s.toFixed(2)}, ${(vs.d > 3 ? vs.d - 1.3 : vs.d + 1.3).toFixed(2)}, 0)`);
  for (const p of trio) await p.until(`ctx.party.activity.n >= 1`, "tag: the tag goes through", 40000);
  const copNow = [];
  for (const p of trio) copNow.push(await p.game(`ctx.party.activity.cop`));
  t.check("tag: bump → the friend is the cop now, on every screen", copNow.every(c => c === copNow[0]) && copNow[0] !== cop0, JSON.stringify([cop0, copNow]));
  await t.shot("tag");
  await NH.game(`ctx.party._debug.setA(Object.assign({}, ctx.party.activity, { dur: 1 }))`);
  for (const p of trio) if (!await p.until(`ctx.state === "partyResults" && ctx.party.activity.k === "tag"`, "tag: results", 40000)) return;
  t.check("tag: results rank by time as cop", await t.L(`/as cop/.test(document.querySelector("#screenCard .pt-res").textContent)`));
  await NH.game(`ctx.party._debug.toLobby()`);

  // portrait phone: the lobby card fits
  await t.game(`ctx.party.leave()`);
  await t.page.setViewportSize({ width: 390, height: 844 });
  await t.click(/Party with friends/);
  await t.click(/Host a party/);
  await hostUntil(t, `ctx.state === "partyLobby" && ctx.party.connected`, "portrait lobby", 20000);
  await sleep(800);
  await t.shot("lobby-portrait");
  t.check("portrait: lobby card fits the width", await t.L(`document.getElementById("screenCard").getBoundingClientRect().right <= innerWidth + 1`));
  await t.game(`ctx.party.leave()`);
}
