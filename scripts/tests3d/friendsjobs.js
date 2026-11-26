// 👯 MISSIONS TOGETHER (ci/friends stage 2, step 3) — two real pages against the LOCAL relay (never production):
//   SMOOTH     a friend's car shoved 15 m sideways in one go slides over on my screen (party/remote.js glideRate)
//   SIDE JOBS FOR TWO  👯 › Missions lists 🚕 Lulu Cab · 🔥 Hot Delivery · 💰 The Getaway "for two"; A offers the cab,
//                      B joins, A goes → A is driving the cab job, B is her navigator; each fare is SPLIT (A keeps her
//                      half, B's half lands in B's wallet) — together never more than the solo fare; the job ends →
//                      "shift over" on B, and no more shares
//   CRIMES FOR TWO + THE BANK JOB  listed too (partners' 🎲 / 🚗 / 🔔, heist's 💰): a 🎲 Double dare offer → both
//                      screens get the same briefing naming the partner (the crimes still happen by doing them)
//   IMA'S LIST TOGETHER  A offers 📝 her list, B helps: B does the thing on A's list → it ticks on A's screen (A's
//                      once-a-day coins, B none); B sees A's list in a chip; home for dinner → B gets Ima's thank-you
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 31000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = url => `&enable=party,openworld,foot,town,phone,friends,hustle,law,heist,partners,day&mpurl=${encodeURIComponent(url)}`;
const COINS = `JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`;

module.exports = {
  name: "friendsjobs",
  viewport: { width: 960, height: 540 },
  query: Q(URL),
  save2d: { totalCoins: 100, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(6 * 60000);
    const pages = [];
    try { await body(t, pages); }
    catch (e) { t.check("friendsjobs threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const g of pages) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

const QUIET = `(ctx.traffic.clear(), ctx.traffic.config.enabled = false, ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.hustle.hold(900), ctx.G.invT = 999, true)`;

async function body(t, pages) {
  const A = hostPage(t);
  await A.game(`(ctx.party.hostRoam(), true)`);
  if (!await A.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "A: 🌍 Free Roam", 120000)) return;
  await A.game(QUIET);
  const code = await A.game(`ctx.party.code`), au = await A.game(`ctx.party.uid`);
  const B = await guestPage(t, "B", { totalCoins: 0, ownedSkins: ["pink", "gold"], selectedSkin: "gold", mpName: "Latke Legend" }, Q(URL));
  pages.push(B);
  await B.until(`__lulu3d && __lulu3d.state === "title"`, "B boots", 120000);
  await B.game(`(ctx.party.join(${JSON.stringify(code)}, { with: ${JSON.stringify(au)} }), true)`);
  if (!await B.until(`ctx.party.active && ctx.party.activity && ctx.party.activity.k === "roam" && (ctx.state === "playing" || ctx.state === "footRun")`, "B joins A in Free Roam", 120000)) return;
  await B.game(QUIET);
  await A.until(`ctx.party.players.length === 2`, "A sees B", 30000);

  // ── a friend's car shoved 15 m sideways: on my screen it SLIDES (never a one-frame jump) ──
  await B.until(`ctx.state === "playing"`, "B: driving", 60000);
  if (await A.until(`!!(ctx.party.remoteCar(${JSON.stringify(await B.game(`ctx.party.uid`))}) || {}).shown`, "A: B's car is on my screen", 60000)) {
    const BU = JSON.stringify(await B.game(`ctx.party.uid`));
    await B.game(`(() => { const c = ctx.car; c.vx = c.vz = 0; c.vF = 0; return true; })()`);
    await A.frames(40);
    await A.L(`(() => { const L3 = __lulu3d, rc = L3.ctx.party.remoteCar(${BU}); rc.trace = []; window.__rs0 = L3.ctx.party.peer(${BU}).rs; window.__steps = []; let last = [rc.x, rc.z], lt = performance.now(); const tick = () => { const r = L3.ctx.party.remoteCar(${BU}), w = performance.now(); if (r && r.shown) { const m = Math.hypot(r.x - last[0], r.z - last[1]); window.__steps.push(m / Math.max(4, 60 * (w - lt) / 1000)); last = [r.x, r.z]; window.__moved = (window.__moved || 0) + m; } lt = w; if (window.__steps.length < 240) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`);
    await B.game(`(() => { const c = ctx.car, p = ctx.world.road.point(c.s, c.d + 15 > 6 ? c.d - 15 : c.d + 15, {}); c.place(p.x, p.z, c.h); c.d = c.d + 15 > 6 ? c.d - 15 : c.d + 15; c.vx = c.vz = 0; c.vF = 0; return true; })()`);
    await A.until(`window.__steps.length >= 240`, "A: watched B's car for 240 frames", 60000);
    const st = await A.L(`({ worst: +Math.max(...window.__steps).toFixed(2), moved: +window.__moved.toFixed(1), snaps: (__lulu3d.ctx.party.remoteCar(${BU}).trace || []).filter(x => x.snap).length })`);
    // (QA's watchdog allowance: 4 m a frame, or 60 m/s on a slow frame — worst = the biggest step ÷ that allowance)
    t.check("a friend's car shoved 15 m: it slides over on my screen (no frame over the jump allowance, no snap)", st.worst < 1 && st.moved > 10 && st.snaps === 0, JSON.stringify(st));
    // a short RESPAWN hop (a new frame at the town line, an unstuck rescue): glides too, no poof
    await A.L(`(() => { const L3 = __lulu3d, rc = L3.ctx.party.remoteCar(${BU}); rc.trace = []; window.__steps = []; window.__moved = 0; let last = [rc.x, rc.z], lt = performance.now(); const tick = () => { const r = L3.ctx.party.remoteCar(${BU}), w = performance.now(); if (r && r.shown) { const m = Math.hypot(r.x - last[0], r.z - last[1]); window.__steps.push(m / Math.max(4, 60 * (w - lt) / 1000)); last = [r.x, r.z]; window.__moved += m; } lt = w; if (window.__steps.length < 240) requestAnimationFrame(tick); }; requestAnimationFrame(tick); return true; })()`);
    await B.game(`(() => { const c = ctx.car, p = ctx.world.road.point(c.s + 10, c.d, {}); c.place(p.x, p.z, c.h); c.s += 10; c.vx = c.vz = 0; c.vF = 0; ctx.party.respawned(); return true; })()`);
    await A.until(`window.__steps.length >= 240`, "A: watched B's respawn hop for 240 frames", 60000);
    const st2 = await A.L(`({ worst: +Math.max(...window.__steps).toFixed(2), moved: +window.__moved.toFixed(1), snaps: (__lulu3d.ctx.party.remoteCar(${BU}).trace || []).filter(x => x.snap).length })`);
    t.check("a friend's short respawn hop (10 m): it glides on my screen, no poof", st2.worst < 1 && st2.moved > 7 && st2.snaps === 0, JSON.stringify(st2));
  }

  // ── the list ──
  const ids = await A.game(`ctx.group.missions().map(m => m.id)`);
  t.check("👯 › Missions lists the cab, the delivery and the getaway for two", ["hustle.cab", "hustle.delivery", "hustle.getaway"].every(i => ids.includes(i)), JSON.stringify(ids));
  t.check("…and the crimes for two + the bank job", ["partners.dare", "partners.grab", "partners.ring", "heist.bank"].every(i => ids.includes(i)), JSON.stringify(ids));
  // ── A offers the cab; B joins; A goes ──
  const off = await A.game(`ctx.group.offer("hustle.cab")`);
  t.check("A offers 🚕 Lulu Cab for two", off === "", off);
  if (!await B.until(`(ctx.group.offerNow() || {}).id === "hustle.cab"`, "B: the cab offer arrives", 30000)) return;
  await B.game(`ctx.group.joinOffer()`);
  // (max 2: it starts by itself the moment B is in — or A taps ▶ go now)
  await A.until(`!!ctx.hustle.job || ((ctx.group.offerNow() || {}).ins || []).length === 2`, "A: B is in", 30000);
  await A.game(`ctx.hustle.job || ctx.group.goNow()`);
  if (!await A.until(`!!ctx.hustle.job && ctx.hustle.job.def.id === "cab"`, "A: the cab job starts", 30000)) return;
  const crew = await A.game(`ctx.hustle._dbg.together()`);
  t.check("A drives the cab with a crew of two", Array.isArray(crew.crew) && crew.crew.length === 2 && !!crew.key, JSON.stringify(crew));
  await B.until(`ctx.hustle._dbg.together().driver === ${JSON.stringify(au)}`, "B: navigating A's cab", 30000);
  t.check("B is NOT running a job of her own (she's the navigator)", await B.game(`!ctx.hustle.job`));

  // ── a fare: split ──
  const b0 = await B.game(COINS), a0 = await A.game(COINS);
  const mine = await A.L(`import("./js/features/hustle/together.js").then(m => m.payCrew(__lulu3d.ctx.hustle.job, 31))`);
  t.check("a 31-coin fare: the driver keeps 16 (her half + the odd coin)", mine === 16, String(mine));
  const got = await B.until(`${COINS} === ${b0 + 15}`, "B: her 15-coin share arrives", 30000);
  t.check("…the navigator gets 15 — together exactly the solo fare", got);
  await A.L(`import("./js/features/hustle/together.js").then(m => m.payCrew(__lulu3d.ctx.hustle.job, 10))`);
  await B.until(`${COINS} === ${b0 + 20}`, "B: the next share (5)", 30000);
  await B.frames(60);
  t.check("shares are counted once (no repeats from the running total)", (await B.game(COINS)) === b0 + 20, String(await B.game(COINS)));
  t.check("the driver's wallet didn't move (the job's own pay line adds her share)", (await A.game(COINS)) === a0);
  // ── a solo job pays in full ──
  t.check("solo (no crew) payCrew → the whole pay", await A.L(`import("./js/features/hustle/together.js").then(m => m.payCrew({ def: { id: "cab" } }, 31))`) === 31);
  // ── the job ends → shift over; no more shares ──
  await A.game(`(ctx.hustle.end("quit", "test"), true)`);
  t.check("job over → B's shift ends (\"shift over\")", await B.until(`!ctx.hustle._dbg.together().driver`, "B: shift over", 30000));
  t.check("after the job, payCrew pays the driver everything again", await A.L(`import("./js/features/hustle/together.js").then(m => m.payCrew({ def: { id: "cab" }, crew: ["a", "b"] }, 31))`) === 31);

  // ── a crime for two: the invitation + the same briefing on both screens ──
  await A.until(`!ctx.group.offerNow()`, "A: the cab offer is closed", 30000);
  const off2 = await A.game(`ctx.group.offer("partners.dare")`);
  t.check("A offers 🎲 Double dare", off2 === "", off2);
  if (!await B.until(`(ctx.group.offerNow() || {}).id === "partners.dare"`, "B: the dare offer arrives", 30000)) return;
  await B.game(`ctx.group.joinOffer()`);
  const BAN = `(() => { const b = document.getElementById("banner"); return b && !b.classList.contains("hidden") ? b.textContent : ""; })()`;
  const ba = await A.until(`/Double dare/.test(${BAN})`, "A: the dare briefing", 30000), bb = await B.until(`/Double dare/.test(${BAN})`, "B: the dare briefing", 30000);
  const bt = await B.L(BAN);
  t.check("both get the 🎲 briefing, naming the partner", ba && bb && /Kugel Kid/.test(bt), bt);

  // ── 📝 Ima's list together: A's list, B helps ──
  await A.until(`!ctx.group.offerNow()`, "A: the dare offer is closed", 30000);
  const off3 = await A.game(`ctx.group.offer("day.list")`);
  t.check("A offers 📝 Ima's list together", off3 === "", off3);
  if (!await B.until(`(ctx.group.offerNow() || {}).id === "day.list"`, "B: the list offer arrives", 30000)) return;
  await B.game(`ctx.group.joinOffer()`);
  await A.until(`((ctx.group.offerNow() || {}).ins || []).length === 2 || ctx.day.active`, "A: B is in", 30000);
  await A.game(`ctx.day.active || ctx.group.goNow()`);
  if (!await A.until(`ctx.day.active`, "A: her list is on (in a party)", 30000)) return;
  const list = await A.game(`ctx.day.list()`);
  const chipOk = await B.until(`(() => { const c = document.querySelector(".day-chip"); return !!c && /Kugel Kid's list/.test(c.textContent); })()`, "B: A's list in a chip", 30000);
  t.check("B sees A's list in a chip", chipOk);
  // B does the first thing on A's list
  const first = list.find(x => !x.done);
  const it = await A.game(`ctx.day.ITEMS ? Object.values(ctx.day.ITEMS).flat().find(x => x.id === ${JSON.stringify(first.id)}) : null`);
  const fire = it.kind === "place" ? `m.emit("world:visit", { id: ${JSON.stringify(it.place)} })` : it.kind === "job" ? `m.emit("hustle:end", { id: "cab", result: "pass" })`
    : it.kind === "stat" ? `m.emit("stat", { id: ${JSON.stringify(it.stat)}, n: ${it.n || 1} })` : `m.emit(${JSON.stringify(it.ev)}, {})`;
  const a1 = await A.game(COINS), b1 = await B.game(COINS);
  await B.L(`import("./js/core/ctx.js").then(m => { ${fire}; return true; })`);
  const ticked = await A.until(`ctx.day.done(${JSON.stringify(first.id)})`, "A: B's help ticks A's list", 30000);
  t.check(`B helps (${first.id}) → it ticks on A's list`, ticked);
  const paid = await A.until(`${COINS} === ${a1 + 15}`, "A: the item's coins", 30000);
  t.check("…A gets her once-a-day item coins (as solo)", paid, `${a1} → ${await A.game(COINS)}`);
  // the rest done on A's screen, then home for dinner
  await A.L(`import("./js/features/day/index.js").then(m => { for (const id of m.DAYX.DAY.list) m.DAYX.bump(id, 5); return true; })`);
  // (her home is on its lot in Midwood since ci/hometown: into Midwood first — its models by name — then into the driveway)
  await A.game(`(ctx.town.load && ctx.town.load("midwood"), true)`);
  await A.until(`!ctx.town.loaded || ctx.town.loaded("midwood")`, "A: Midwood's models", 120000);
  if (!await A.game(`ctx.town.active && ctx.town.id === "midwood"`)) {
    if (await A.game(`ctx.town.active`)) await A.game(`(ctx.town.leave("reset"), true)`);
    await A.game(`(ctx.town.enter({ town: "midwood", exitS: ctx.town.exitOf ? ctx.town.exitOf("midwood") : undefined, speed: 0 }), true)`);
  }
  await A.until(`ctx.town.active && ctx.town.id === "midwood" && !!ctx.places.home.park`, "A: in Midwood, her home's driveway there", 60000);
  t.check("with friends, her home is there in Midwood (the list can end)", await A.game(`!!ctx.places.home.park && ctx.party.active && ctx.town.id === "midwood"`));
  // (a teleport inside a town must also set her road position, or the town engine reads the old one and takes her out)
  await A.game(`(() => { const P = ctx.places.home.park, c = ctx.car, n = ctx.world.road.nearest(P.x, P.z, c.s, {}); c.place(P.x, P.z, P.h || 0); c.s = n.s; c.d = n.d; c.vx = c.vz = 0; c.vF = 0; return true; })()`);
  const home = await A.until(`ctx.day.home`, "A: home for dinner", 30000);
  const hd = await A.game(`(() => { const P = ctx.places.home.park, c = ctx.car; return { d: P ? +Math.hypot(c.pos.x - P.x, c.pos.z - P.z).toFixed(1) : -1, st: ctx.state, sp: +(c.speed || 0).toFixed(2), town: ctx.town.id, zone: ctx.openworld.zone, active: ctx.day.active, done: ctx.day.complete, home: ctx.day.home }; })()`);
  t.check("A pulls into her driveway → home for dinner (and stays in the group)", home && await A.game(`ctx.party.active && ctx.party.activity.k === "roam"`), JSON.stringify(hd));
  t.check("B gets Ima's thank-you at dinner", await B.until(`/Thank you for helping/.test(${BAN})`, "B: the thank-you", 30000));
  t.check("…and no coins for the helper (they're A's)", (await B.game(COINS)) === b1, `${b1} → ${await B.game(COINS)}`);
}
