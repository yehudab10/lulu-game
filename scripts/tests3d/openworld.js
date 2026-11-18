// 🌍 Open world (features/openworld): things to DO, especially with friends.
//   SOLO — the 📍 Nearby app on the highway (the next town exit) and in Lakewood (people,
//          landmarks, coins, the way out) → a pin (beacon + chip) that clears when you get
//          there; a solo 🏁 time trial and a 📸 photo hunt: start → 3-2-1 → play → scoreboard.
//   PARTY (two real pages against the LOCAL relay, never production) — the lobby's 🌍 Free
//          Roam → both screens enter Lakewood: the town's party traffic is identical on both
//          (pure function of seed + clock, and the live cars follow it), so are the townsfolk;
//          friends see each other on the town's streets (flat frame, no corner snaps) → 👯
//          app → 🚓 Cops & Robbers (warp to the start, the cop busts the robber), 🥘 Hot Kugel
//          (a bump passes it, the fuse blows), 📍 Race to a Pin (both finish → scoreboard →
//          🔁 Rematch from the guest) → perf numbers with two players in town.
const { spawn } = require("child_process");
const path = require("path");
const PORT = 23000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=party,town,atmos&mpurl=${encodeURIComponent(URL)}`;
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
      const end = Date.now() + ms;
      while (Date.now() < end) {
        const ok = await page.evaluate(`(() => { try { const L3 = window.__lulu3d, ctx = L3 && L3.ctx; return !!(${code}); } catch (e) { return false; } })()`).catch(() => false);
        if (ok) return true;
        await sleep(150);
      }
      t.check(`${label}: ${what}`, false, "timed out");
      return false;
    },
  };
}
async function hostUntil(t, code, what, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await t.game(`(() => { try { return !!(${code}); } catch (e) { return false; } })()`).catch(() => false)) return true;
    await sleep(150);
  }
  t.check(what, false, "timed out in " + await t.game(`ctx.state`).catch(() => "?"));
  return false;
}
const clickSel = async (t, sel) => { const ok = await t.L(`(() => { const b = document.querySelector(${JSON.stringify(sel)}); if (b) b.click(); return !!b; })()`); await sleep(250); return ok; };
/** Put my car at world (x, z) facing h, stopped (an instant "drive there"). */
const PLACE = (x, z, h = 0) => `(() => { const c = ctx.car, n = ctx.world.road.nearest(${x}, ${z}, null, {}); c.place(${x}, ${z}, ${h}); c.s = n.s; c.d = n.d; c.vx = c.vz = 0; c.vF = 0; return true; })()`;
/** A clear spot in Lakewood: Lake Dr's southbound lane (no blocks east of it → no loop traffic, no jam). */
const CLEAR = `(() => { const pl = ctx.town.plan, st = pl.byName["Lake Dr"]; return { x: pl.ORIGIN.x + st.c + 1.75, z: pl.ORIGIN.z + 50, h: Math.PI }; })()`;
const PERF = async (t, frames) => {
  await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
    window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0 }; })()`);
  await sleep(frames * 120);
  return t.L(`(() => { const P = window.__pf; window.__pf = null; return P && P.n ? { frames: P.n, calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length } : null; })()`);
};

module.exports = {
  name: "openworld",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 300, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    await step("solo", () => solo(t));
    await startRelay();
    const guests = [];
    try { await step("party", () => partyRun(t, guests)); }
    finally {
      for (const g of guests) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      try { relay.kill(); } catch (e) { }
    }
  },
};

// ── SOLO ─────────────────────────────────────────────────────────────────
async function solo(t) {
  const g = t.game;
  t.check("ctx.openworld service", await g(`!!(ctx.openworld && ctx.openworld.partyTowns && ctx.openworld.seeded && ctx.openworld.start)`));
  t.check("the lobby has 🌍 Free Roam (party.addActivity)", await t.L(`fetch("js/features/openworld/index.js").then(r => r.text()).then(s => /addActivity\\("roam"/.test(s))`));
  t.check("no new title tiles", !(await t.titleItems()).some(x => /roam|open world|nearby/i.test(x)));
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold && ctx.law.hold(600), true)`);
  await t.frames(10);
  t.check("phone: 📍 Nearby is there, 👯 Party isn't (no party)", await g(`ctx.phone.apps().includes("nearby") && !ctx.phone.apps().includes("owparty")`));
  t.check("nothing on the HUD outside a game / pin", await t.L(`!document.getElementById("owChip") || getComputedStyle(document.getElementById("owChip")).display === "none"`));

  // Nearby on the highway: the next town exit
  await t.until(`__lulu3d.ctx.town.exits().length > 0`, "a town exit is planned", 15000);
  await g(`ctx.phone.openPhone("nearby")`);
  await t.frames(4);
  t.check("Nearby (highway): the next Lakewood exit is listed", await t.L(`/Lakewood exit/.test(document.getElementById("lpApp").textContent)`), (await t.L(`document.getElementById("lpApp").textContent`)).slice(0, 160));
  await t.shot("nearby-highway");
  await t.L(`[...document.querySelectorAll("#lpApp [data-pin]")].find(b => /Lakewood/.test(b.textContent)).click()`);
  await t.frames(14);
  const pinSt = await g(`({ open: ctx.phone.isOpen, pin: !!ctx.openworld.pinned, beacons: ctx.openworld.debug.beaconCount() })`);
  t.check("pinning closes the phone, shows a beacon", !pinSt.open && pinSt.pin && pinSt.beacons === 1, JSON.stringify(pinSt));
  t.check("…and the chip with an arrow", await t.L(`getComputedStyle(document.getElementById("owChip")).display !== "none" && /Lakewood/.test(document.getElementById("owChip").textContent)`));
  await t.shot("pin-chip");
  await g(`ctx.openworld.unpin()`);

  // into town
  await t.until(`__lulu3d.ctx.town.debug.S.loaded`, "town models loaded", 60000);
  await g(`ctx.town.enter({ speed: 0 })`);
  if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.openworld.zone === "lakewood"`, "in Lakewood", 8000)) return;
  await t.frames(20);
  await g(`ctx.phone.openPhone("nearby")`);
  await t.frames(4);
  const txt = await t.L(`document.getElementById("lpApp").textContent`);
  t.check("Nearby (town): people to talk to, landmarks, coins, the way out", /People to talk to/.test(txt) && /PIZZA SHMIZZA|SIMCHA PALACE/i.test(txt) && /coin/.test(txt) && /Route 9 South|County Line/.test(txt), txt.slice(0, 200));
  t.check("Nearby (town): solo time trial + photo hunt offered", await t.L(`!!document.querySelector('#lpApp [data-k="pin"]:not([disabled])') && !!document.querySelector('#lpApp [data-k="photo"]:not([disabled])')`));
  await t.shot("nearby-town");
  // pin a person → drive up to them → the pin clears
  await t.L(`[...document.querySelectorAll('#lpApp [data-pin^="p"]')].pop().click()`);   // the farthest of the people listed
  await t.frames(4);
  const pn = await g(`ctx.openworld.pinned`);
  t.check("a person pinned (talk hint)", !!pn && pn.talk === true, JSON.stringify(pn).slice(0, 120));
  await g(PLACE(pn.x + 3, pn.z + 3));
  await t.until(`!__lulu3d.ctx.openworld.pinned`, "arriving clears the pin", 8000);
  t.check("arriving at a pin clears it (and its beacon)", await g(`!ctx.openworld.pinned && ctx.openworld.debug.beaconCount() === 0`));

  // a solo time trial across town
  const why = await g(`ctx.openworld.start("pin")`);
  t.check("time trial starts", why === "", why);
  await t.until(`__lulu3d.ctx.openworld.game && __lulu3d.ctx.openworld.game.ph === "go"`, "game state", 5000);
  await t.frames(4);
  await t.shot("countdown");
  const G1 = await g(`ctx.openworld.game`);
  t.check("countdown holds the car", await g(`(() => { const G = ctx.openworld.game; return ctx.openworld.debug.SOLO.ms < G.t0; })()`) && await t.L(`getComputedStyle(document.getElementById("owCount")).display !== "none"`));
  await t.until(`__lulu3d.ctx.openworld.debug.SOLO.ms > __lulu3d.ctx.openworld.game.t0 + 300`, "GO", 15000);
  t.check("the pin is far (a real trip across town) and marked", Math.hypot(G1.pin.x - (await g(`ctx.car.pos.x`)), G1.pin.z - (await g(`ctx.car.pos.z`))) > 150 && await g(`ctx.openworld.debug.beaconCount() >= 1`));
  t.check("one objective chip while it runs (+ arrow)", await t.L(`/Race to/.test(document.getElementById("owChip").textContent) && getComputedStyle(document.querySelector("#owChip .ar")).display !== "none"`));
  await t.shot("trial-chip");
  await g(PLACE(G1.pin.x, G1.pin.z));
  await t.until(`__lulu3d.ctx.openworld.game && __lulu3d.ctx.openworld.game.ph === "done"`, "reaching the pin finishes the trial", 10000);
  await t.until(`__lulu3d.ctx.phone.isOpen`, "the scoreboard opens in the phone", 8000);
  t.check("scoreboard: a time + 🔁 Rematch", await t.L(`/Rematch/.test(document.getElementById("lpApp").textContent) && /\\d:\\d\\d\\.\\d/.test(document.getElementById("lpApp").textContent)`));
  await t.shot("trial-results");
  await t.L(`document.getElementById("owDone").click()`);
  await t.frames(4);

  // a solo photo hunt
  await g(`(ctx.car.vx = ctx.car.vz = 0, true)`);
  const w2 = await g(`ctx.openworld.start("photo")`);
  t.check("photo hunt starts in town", w2 === "", w2);
  await t.until(`__lulu3d.ctx.openworld.debug.SOLO.ms > (__lulu3d.ctx.openworld.game || { t0: 1e12 }).t0 + 200`, "photo hunt GO", 15000);
  const spots = await g(`ctx.openworld.game.spots`);
  t.check("4 sights, each a beacon", spots.length === 4 && await g(`ctx.openworld.debug.beaconCount() >= 4`));
  for (const s of spots) { await g(PLACE(s.x + 2, s.z)); await t.frames(6); }
  await t.until(`__lulu3d.ctx.openworld.game && __lulu3d.ctx.openworld.game.ph === "done"`, "every sight snapped → done", 10000);
  t.check("photo hunt: all 4 snapped", await g(`Object.keys(ctx.openworld.debug.CL.last.got).length === 4`));
  await t.until(`__lulu3d.ctx.phone.isOpen`, "photo results", 8000);
  await t.shot("photo-results");
  await g(`ctx.phone.closePhone()`);
  await t.frames(3);
  // the layouts with a live chip
  await g(`ctx.openworld.start("pin")`);
  await t.until(`__lulu3d.ctx.openworld.debug.SOLO.ms > (__lulu3d.ctx.openworld.game || { t0: 1e12 }).t0 + 200`, "trial #2 GO", 15000);
  for (const [label, w, h] of [["tv", 1920, 1080], ["phone-portrait", 390, 844], ["phone-landscape", 844, 390]]) {
    await t.page.setViewportSize({ width: w, height: h });
    await t.frames(6);
    const fit = await t.L(`(() => { const r = document.getElementById("owChip").getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.width > 40; })()`);
    t.check(`chip fits (${label})`, fit);
    await t.shot("chip-" + label);
  }
  await t.page.setViewportSize({ width: 1280, height: 720 });
  await g(`ctx.openworld.end()`);
  await t.frames(4);
  if (await g(`ctx.phone.isOpen`)) await g(`ctx.phone.closePhone()`);
  await g(`(ctx.town.leave("reset"), L3.setState("title"), true)`);
  await t.frames(6);
}

// ── PARTY ────────────────────────────────────────────────────────────────
async function partyRun(t, guests) {
  const g = t.game;
  await g(`(ctx.phone.isOpen && ctx.phone.closePhone(), ctx.town.active && ctx.town.leave("reset"), L3.state !== "title" && L3.setState("title"), true)`);
  await t.frames(6);
  await t.click(/Party with friends/);
  await t.click(/Host a party/);
  if (!await hostUntil(t, `ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`, "host: lobby")) return;
  const code = await g(`ctx.party.code`);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `&party=${code}`);
  guests.push(A);
  if (!await A.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "joins from the link", 180000)) return;
  await hostUntil(t, `ctx.party.players.length === 2`, "two in the lobby");
  t.check("the lobby offers 🌍 Free Roam", await t.L(`!!document.getElementById("pt_act_roam")`));
  await clickSel(t, "#pt_act_roam");
  await t.shot("lobby-roam");
  await clickSel(t, "#pt_go");
  const pages = [{ label: "host", game: c => t.game(c), until: (c, w, ms) => hostUntil(t, c, w, ms), L: c => t.L(c) }, A];
  for (const p of pages) if (!await p.until(`ctx.state === "playing" && ctx.party.activity.k === "roam"`, "free roam: GO", 60000)) return;
  t.check("roam: the 👯 Party app appears", await g(`ctx.phone.apps().includes("owparty")`) && await A.game(`ctx.phone.apps().includes("owparty")`));
  t.check("roam: towns are on for this party only", await g(`ctx.openworld.partyTowns() && ctx.town.exits().length > 0`));
  const ex = [];
  for (const p of pages) ex.push(JSON.stringify(await p.game(`ctx.town.exits().map(e => Math.round(e.s))`)));
  t.check("roam: the same town exits on both screens", ex[0] === ex[1] && ex[0] !== "[]", ex.join(" / "));

  // both into Lakewood (no ramp needed in a test)
  for (const p of pages) {
    await p.until(`ctx.town.debug.S.loaded`, "town models", 90000);
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits()[0].s, speed: 0 })`);
    await p.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, "in Lakewood", 10000);
  }
  await sleep(2500);
  const T0 = await g(`Math.round(ctx.party.clock() + 2000)`);
  const lists = [];
  for (const p of pages) lists.push(JSON.stringify(await p.game(`ctx.openworld.debug.townCarsAt(${T0}).map(c => [c.key, c.kind, +c.x.toFixed(2), +c.z.toFixed(2)])`)));
  t.check("town traffic: identical cars + positions on both screens at the same party time", lists[0] === lists[1] && JSON.parse(lists[0]).length >= 6, `${JSON.parse(lists[0]).length} cars`);
  let bad = 0, n = 0;
  for (const p of pages) {
    const live = await p.game(`ctx.openworld.debug.townLive().map(c => { const w = ctx.openworld.debug.townCarsAt(c.at).find(x => x.key === c.key); return !!w && Math.hypot(w.x - c.x, w.z - c.z) < 0.05; })`);
    n += live.length; bad += live.filter(x => !x).length;
  }
  t.check("town traffic: every live car sits where the shared clock says", n >= 12 && bad === 0, `${n} live, ${bad} off`);
  t.check("town traffic: no random town drivers in a party", await g(`ctx.town.debug.C.cars.filter(c => !c.data.town.hazard).length === 0 && ctx.traffic.cars.every(c => c.data && (c.data.party || (c.data.town && c.data.town.hazard)))`));
  const folk = [];
  for (const p of pages) folk.push(JSON.stringify(await p.game(`ctx.town.debug.LIFE.people.map(r => [r.p.obj.position.x.toFixed(2), r.p.obj.position.z.toFixed(2)]).concat(ctx.town.debug.LIFE.geese.map(q => [q.home.x.toFixed(2), q.home.z.toFixed(2)]))`)));
  const fA = JSON.parse(folk[0]), fB = JSON.parse(folk[1]), diff = fA.map((x, i) => JSON.stringify(x) === JSON.stringify(fB[i]) ? null : i).filter(i => i != null);
  t.check("townsfolk + geese: seeded the same on both screens (no e-bikes)", folk[0] === folk[1] && await g(`ctx.town.debug.LIFE.bikes.length === 0`), `${fA.length}/${fB.length} placed; differ at ${diff.slice(0, 6).map(i => i + ":" + JSON.stringify(fA[i]) + "≠" + JSON.stringify(fB[i])).join(" ")}`);

  // friends see each other on the streets: the guest catches up with the host
  const hostUid = await g(`ctx.party.uid`), guestUid = await A.game(`ctx.party.uid`);
  await A.game(`ctx.openworld.warpTo(${JSON.stringify(hostUid)})`);
  await sleep(3000);
  const seen = await g(`(() => { const rc = ctx.party.remoteCar(${JSON.stringify(guestUid)}); return rc && rc.shown ? { x: rc.x, z: rc.z } : null; })()`);
  const real = await A.game(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`);
  t.check("in town: the host sees the guest's car where it really is (flat frame)", !!seen && Math.hypot(seen.x - real.x, seen.z - real.z) < 4, JSON.stringify({ seen, real }));
  t.check("in town: the guest sees the host", await A.game(`(() => { const rc = ctx.party.remoteCar(${JSON.stringify(hostUid)}); return !!rc && rc.shown; })()`));
  await t.shot("town-friend");
  await g(`ctx.phone.openPhone("owparty")`);
  await sleep(600);
  t.check("👯 app: the friend is listed (here in Lakewood) + the games", await t.L(`/Latke Legend/.test(document.getElementById("lpApp").textContent) && /Lakewood/.test(document.getElementById("lpApp").textContent) && !!document.querySelector('#lpApp [data-k="cnr"]')`));
  await t.shot("party-app");
  await g(`ctx.phone.closePhone()`);

  // 🚗 ride along: the guest hops into the host's passenger seat
  t.check("ride: the guest hops in", (await A.game(`ctx.openworld.ride(${JSON.stringify(hostUid)})`)) === "");
  await sleep(3000);
  t.check("ride: the host sees a Lulu in the passenger seat (and no guest car)", await g(`!!ctx.car.anchors.passenger && ctx.car.anchors.passenger.children.length > 0 && (() => { const rc = ctx.party.remoteCar(${JSON.stringify(guestUid)}); return !rc || !rc.shown; })()`));
  const rideSt = await A.game(`(() => { const rc = ctx.party.remoteCar(${JSON.stringify(hostUid)}); return { riding: ctx.openworld.riding, shown: !!rc && rc.shown, vis: ctx.car.obj.children.some(c => c.visible), d: rc ? +Math.hypot(rc.x - ctx.car.pos.x, rc.z - ctx.car.pos.z).toFixed(2) : -1, st: ctx.state }; })()`);
  t.check("ride: the guest's car rides with the host's (camera follows it)", rideSt.shown && !rideSt.vis && rideSt.d < 1.5, JSON.stringify(rideSt));
  await A.page.screenshot({ path: path.join(__dirname, "..", "..", "smoke-shots", "3d-openworld-ride-guest.png") }).catch(() => { });
  await t.shot("ride-host");
  await A.game(`ctx.openworld.hopOut()`);
  await sleep(1500);
  t.check("ride: hop out → her own car again", await A.game(`ctx.car.obj.children.some(c => c.visible) && !ctx.openworld.riding`));
  await sleep(1500);
  t.check("ride: the seat empties on the host's screen", await g(`ctx.car.anchors.passenger.children.every(c => !c.visible || !c.parent || c.parent !== ctx.car.anchors.passenger) || ctx.car.anchors.passenger.children.length === 0`));

  const settle =async (k, what) => { for (const p of pages) if (!await p.until(`ctx.openworld.game && ctx.openworld.game.k === "${k}" && ctx.openworld.game.ph === "go" && ctx.party.clock() > ctx.openworld.game.t0 + 300`, what, 40000)) return false; return true; };
  const done = async (k, what) => { for (const p of pages) if (!await p.until(`ctx.openworld.game && ctx.openworld.game.k === "${k}" && ctx.openworld.game.ph === "done"`, what, 40000)) return false; return true; };

  // 🚓 COPS & ROBBERS — started by the GUEST from the phone
  t.check("C&R: the guest asks, the host starts it", (await A.game(`ctx.openworld.start("cnr")`)) === "");
  if (!await settle("cnr", "C&R: GO")) return;
  const cnr = await g(`ctx.openworld.game`);
  t.check("C&R: same game + roles on both screens", JSON.stringify(await A.game(`[ctx.openworld.game.n, ctx.openworld.game.cop]`)) === JSON.stringify([cnr.n, cnr.cop]) && !!cnr.drop);
  const copP = cnr.cop === hostUid ? pages[0] : A, robP = copP === A ? pages[0] : A;
  t.check("C&R: the cop has the light bar, the robber the stash (on both screens)", await copP.game(`ctx.car.tilt.children.some(c => c.userData.kind === "cop" && c.visible)`) && await robP.game(`ctx.car.tilt.children.some(c => c.userData.kind === "stash" && c.visible)`));
  t.check("C&R: both line up in town (the warp keeps them out of the on-ramp)", await copP.game(`ctx.openworld.zone === "lakewood"`) && await robP.game(`ctx.openworld.zone === "lakewood"`), JSON.stringify([await copP.game(`[ctx.openworld.zone, ctx.car.pos.x, ctx.car.pos.z]`), await robP.game(`[ctx.openworld.zone, ctx.car.pos.x, ctx.car.pos.z]`)]));
  await copP.until(`ctx.party.clock() > ctx.openworld.game.copGo + 200`, "cop head start over", 20000);
  await sleep(800);
  await t.shot("cnr");
  const rp = await robP.game(CLEAR);
  await robP.game(PLACE(rp.x, rp.z, rp.h));
  await copP.game(PLACE(rp.x - Math.sin(rp.h) * 4.2, rp.z - Math.cos(rp.h) * 4.2, rp.h));
  await sleep(2500);
  const robUid = cnr.cop === hostUid ? guestUid : hostUid;
  const cnrDbg = await copP.game(`({ zone: ctx.openworld.zone, touch: ctx.openworld.debug.touching(${JSON.stringify(robUid)}), seen: ctx.openworld.debug.posOf(${JSON.stringify(robUid)}), me: { x: ctx.car.pos.x, z: ctx.car.pos.z, h: ctx.car.h }, L: ctx.openworld.debug.CL.L, out: ctx.openworld.game.out, ph: ctx.openworld.game.ph, late: ctx.party.clock() - ctx.openworld.game.copGo })`);
  const robNow = await robP.game(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`);
  if (!await done("cnr", "C&R: the bust ends it (one robber) " + JSON.stringify({ cnrDbg, rp, robNow }).slice(0, 600))) return;
  const cnrEnd = await g(`({ out: ctx.openworld.game.out, cut: !!ctx.openworld.game.cut })`);
  await A.until(`ctx.openworld.debug.CL.lastTitle`, "guest has a C&R title", 10000);
  const cnrTitle = await A.game(`ctx.openworld.debug.CL.lastTitle`);
  t.check("C&R: busted on both screens; the cop wins", Object.values(cnrEnd.out).includes("b") && /cop|busted/i.test(cnrTitle || ""), JSON.stringify(cnrEnd) + " " + cnrTitle);
  for (const p of pages) await p.until(`ctx.phone.isOpen && /Rematch/.test(document.getElementById("lpApp").textContent)`, "C&R scoreboard in the phone", 10000);
  await t.shot("cnr-results");
  for (const p of pages) await p.game(`ctx.phone.closePhone()`);

  // 🥘 HOT KUGEL — a bump passes it, then the fuse blows
  t.check("kugel starts", (await g(`ctx.openworld.start("kugel")`)) === "");
  if (!await settle("kugel", "kugel: GO")) return;
  await g(`ctx.party.clock() > ctx.openworld.game.guard`) || await hostUntil(t, `ctx.party.clock() > ctx.openworld.game.guard + 100`, "kugel guard", 10000);
  const it0 = await g(`ctx.openworld.game.it`);
  const holder = it0 === hostUid ? pages[0] : A, other = holder === A ? pages[0] : A;
  const op = await other.game(CLEAR);
  await other.game(PLACE(op.x, op.z, op.h));
  await holder.game(PLACE(op.x - Math.sin(op.h) * 4.2, op.z - Math.cos(op.h) * 4.2, op.h));
  for (const p of pages) await p.until(`ctx.openworld.game.itN >= 1`, "kugel: passed on contact", 30000);
  t.check("kugel: the bump passed it (both screens agree)", (await g(`ctx.openworld.game.it`)) !== it0 && (await A.game(`ctx.openworld.game.it`)) === (await g(`ctx.openworld.game.it`)));
  await sleep(600);
  await t.shot("kugel");
  await g(`ctx.party.setA(Object.assign({}, ctx.party.activity, { g: Object.assign({}, ctx.openworld.game, { fuse: Math.round(ctx.party.clock() + 300), guard: 1e15 }) }))`);
  if (!await done("kugel", "kugel: the fuse blows")) return;
  t.check("kugel: the holder at the bang loses", (await g(`ctx.openworld.game.loser`)) === (await g(`ctx.openworld.game.it`)) && /kugel|KABOOM/i.test(await A.game(`ctx.openworld.debug.CL.lastTitle`)));
  for (const p of pages) { await p.until(`ctx.phone.isOpen`, "kugel scoreboard", 10000); await p.game(`ctx.phone.closePhone()`); }

  // 📍 RACE TO A PIN — both finish → scoreboard → the guest's 🔁 Rematch
  t.check("race to a pin starts", (await g(`ctx.openworld.start("pin")`)) === "");
  if (!await settle("pin", "pin: GO")) return;
  const pin = await g(`ctx.openworld.game.pin`);
  t.check("pin: the same pin on both screens", JSON.stringify(await A.game(`ctx.openworld.game.pin`)) === JSON.stringify(pin));
  await t.shot("pin-race");
  await A.game(PLACE(pin.x, pin.z)); await sleep(1500); await g(PLACE(pin.x + 3, pin.z + 3));
  if (!await done("pin", "pin: both finish")) return;
  const rows = await g(`ctx.openworld.debug.CL.lastRows.map(r => r.uid + ":" + r.val)`);
  t.check("pin: the guest got there first", rows[0].startsWith(guestUid), rows.join(" | "));
  await A.until(`ctx.phone.isOpen && document.getElementById("owRematch")`, "guest scoreboard", 10000);
  await A.L(`document.getElementById("owRematch").click()`);
  await hostUntil(t, `ctx.openworld.game && ctx.openworld.game.k === "pin" && ctx.openworld.game.ph === "go"`, "the guest's rematch starts a new race", 20000);
  t.check("rematch: a new race (n + 1)", (await g(`ctx.openworld.game.n`)) > 0 && (await g(`ctx.openworld.game.ph`)) === "go");
  await sleep(4000);
  const perf = await PERF(t, 40);
  console.log("   PERF party town (2 players)", JSON.stringify(perf));
  t.check("perf: draw calls reported for a 2-player party town", !!perf && perf.calls > 0, JSON.stringify(perf));
  await g(`ctx.openworld.end()`);
  await sleep(1500);
  for (const p of pages) if (await p.game(`ctx.phone.isOpen`)) await p.game(`ctx.phone.closePhone()`);
  // the party keeps the world going: leaving town in a party → back on the highway with friends hidden/shown by zone
  await A.game(`ctx.town.leave("highway")`);
  await sleep(2500);
  t.check("zones: a friend on the highway is hidden from the town (and vice versa)", await g(`(() => { const rc = ctx.party.remoteCar(${JSON.stringify(guestUid)}); return !rc || !rc.shown; })()`) && await A.game(`(() => { const rc = ctx.party.remoteCar(${JSON.stringify(hostUid)}); return !rc || !rc.shown; })()`));
  await A.game(`ctx.openworld.warpTo(${JSON.stringify(hostUid)})`);
  await A.until(`ctx.town.active`, "the 👯 warp takes her back into town", 20000);
  await t.game(`ctx.party.leave()`);
}
