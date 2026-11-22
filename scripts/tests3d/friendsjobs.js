// 👯 MISSIONS TOGETHER (ci/friends stage 2, step 3) — two real pages against the LOCAL relay (never production):
//   SIDE JOBS FOR TWO  👯 › Missions lists 🚕 Lulu Cab · 🔥 Hot Delivery · 💰 The Getaway "for two"; A offers the cab,
//                      B joins, A goes → A is driving the cab job, B is her navigator; each fare is SPLIT (A keeps her
//                      half, B's half lands in B's wallet) — together never more than the solo fare; the job ends →
//                      "shift over" on B, and no more shares
//   CRIMES FOR TWO + THE BANK JOB  listed too (partners' 🎲 / 🚗 / 🔔, heist's 💰): a 🎲 Double dare offer → both
//                      screens get the same briefing naming the partner (the crimes still happen by doing them)
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 31000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = url => `&enable=party,openworld,foot,town,phone,friends,hustle,law,heist,partners&mpurl=${encodeURIComponent(url)}`;
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
}
