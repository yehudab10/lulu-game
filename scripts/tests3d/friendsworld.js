// 👯 FRIENDS = THE SAME GAME (ci/friends, the owner 2026-11-27: "joining should just teleport one to the other", "lives
// should exist", "one world") — two real pages against the LOCAL relay (never production):
//   JOIN      A mid-run in Lakewood (2 hearts, some coins) hosts 🌍 from her run; B (at home, her own run) joins → B is
//             taken BESIDE A (a teleport); A's run is untouched: same run, spot, hearts, coins, car, town; B keeps hers
//   LIVES     with friends a crash costs a heart (no party run: no bounce-only rules), 0 hearts → the wreck → the ER like
//             solo — and the group stays together; a friend's bump costs nothing
//   LEAVE     one tap: B stays exactly where she is, alone, same run
// Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 33000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = url => `&enable=party,openworld,foot,town,phone,friends,cameos,places,law&mpurl=${encodeURIComponent(url)}`;
const COINS = `JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`;

module.exports = {
  name: "friendsworld",
  viewport: { width: 960, height: 540 },
  query: Q(URL),
  save2d: { totalCoins: 200, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(6 * 60000);
    const pages = [];
    try { await body(t, pages); }
    catch (e) { t.check("friendsworld threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally {
      for (const g of pages) {
        t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await g.page.close(); } catch (e) { }
      }
      relay.kill();
    }
  },
};

const QUIET = `(ctx.traffic.clear(), ctx.traffic.config.enabled = false, ctx.law && ctx.law.hold && ctx.law.hold(900), true)`;
const RUN = `({ mode: ctx.G.mode, startS: ctx.G.startS, runTime: +ctx.G.runTime.toFixed(1), hearts: ctx.G.hearts, coins: ctx.G.coins, skin: ctx.car.skinKey, town: ctx.town.id, state: ctx.state, x: ctx.car.pos.x, z: ctx.car.pos.z })`;

async function body(t, pages) {
  const A = hostPage(t);
  // ── A: her own run, into Lakewood, 2 hearts, some coins ──
  await A.game(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await A.until(`ctx.state === "playing" || ctx.state === "footRun"`, "A: her run starts", 120000)) return;
  await A.game(`(() => { if (ctx.foot.active) { const p = ctx.foot.pos; ctx.foot.drive({ own: true, x: p.x, z: p.z, h: ctx.foot.facing || 0 }); } return true; })()`);
  await A.until(`ctx.state === "playing"`, "A: driving", 30000);
  await A.game(QUIET);
  await A.game(`(ctx.town.load("lakewood"), true)`);
  await A.until(`ctx.town.loaded("lakewood")`, "A: Lakewood's models", 120000);
  await A.game(`(ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 }), true)`);
  if (!await A.until(`ctx.town.active && ctx.town.id === "lakewood"`, "A: in Lakewood", 60000)) return;
  await A.game(`(ctx.G.hearts = 2, ctx.G.coins = 37, ctx.car.vx = ctx.car.vz = 0, ctx.car.vF = 0, true)`);
  await A.frames(10);
  const a0 = await A.game(RUN);
  // ── A hosts 🌍 from her run: nothing about her run changes ──
  await A.game(`(ctx.party.hostRoam(), true)`);
  if (!await A.until(`ctx.party.active && ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam"`, "A: the group is up", 120000)) return;
  await A.frames(20);
  const a1 = await A.game(RUN);
  t.check("A hosts from her run: the SAME run (no reset, no lobby, no new world)", a1.mode === "cruise" && a1.startS === a0.startS && a1.runTime >= a0.runTime && a1.state === "playing" && a1.town === "lakewood", JSON.stringify([a0, a1]));
  t.check("…her hearts, coins, car and spot unchanged", a1.hearts === 2 && a1.coins === 37 && a1.skin === a0.skin && Math.hypot(a1.x - a0.x, a1.z - a0.z) < 3, JSON.stringify([a0, a1]));
  t.check("…and her hearts are on screen", await A.L(`!document.body.classList.contains("party-drive")`));
  const code = await A.game(`ctx.party.code`), au = await A.game(`ctx.party.uid`);

  // ── B: her own run at home ──
  const B = await guestPage(t, "B", { totalCoins: 50, ownedSkins: ["pink", "gold"], selectedSkin: "gold", mpName: "Latke Legend" }, Q(URL));
  pages.push(B);
  await B.until(`__lulu3d && __lulu3d.state === "title"`, "B boots", 120000);
  await B.game(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await B.until(`ctx.state === "playing" || ctx.state === "footRun"`, "B: her run starts", 120000)) return;
  await B.game(QUIET);
  await B.frames(10);
  const b0 = await B.game(RUN), bw0 = await B.game(COINS);
  // ── B joins A: a teleport beside her ──
  await B.game(`(ctx.party.join(${JSON.stringify(code)}, { with: ${JSON.stringify(au)} }), true)`);
  if (!await B.until(`ctx.party.active && ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam"`, "B: in the group", 120000)) return;
  const near = await B.until(`ctx.town.active && ctx.town.id === "lakewood" && Math.hypot(ctx.car.pos.x - ${a0.x.toFixed(2)}, ctx.car.pos.z - ${a0.z.toFixed(2)}) < 40`, "B: taken to A (Lakewood)", 120000);
  t.check("B joins → taken right beside A (a teleport, into Lakewood)", near);
  const b1 = await B.game(RUN);
  t.check("B keeps HER run: same run, her hearts, her coins", b1.mode === "cruise" && b1.startS === b0.startS && b1.hearts === b0.hearts && b1.coins === b0.coins, JSON.stringify([b0, b1]));
  t.check("…and her wallet", (await B.game(COINS)) === bw0);
  const a2 = await A.game(RUN);
  t.check("A sees NOTHING change: same run, spot, hearts, coins, car, town", a2.mode === "cruise" && a2.startS === a0.startS && a2.hearts === 2 && a2.coins === 37 && a2.skin === a0.skin && a2.town === "lakewood" && Math.hypot(a2.x - a0.x, a2.z - a0.z) < 3, JSON.stringify([a0, a2]));
  const bu = await B.game(`ctx.party.uid`);
  t.check("A draws B in her world", await A.until(`!!(ctx.party.remoteCar(${JSON.stringify(bu)}) || {}).shown`, "A: B's car is drawn", 60000));

  // ── a friend's bump costs nothing ──
  await B.game(`(() => { const c = ctx.car; c.place(${a0.x.toFixed(2)} + 1.2, ${a0.z.toFixed(2)} + 0.5, c.h); c.vx = c.vz = 0; c.vF = 0; return true; })()`);
  await A.until(`ctx.party._debug.P.bonks > 0`, "A: a BONK with B", 30000);
  t.check("a friend's bump costs no heart", (await A.game(`ctx.G.hearts`)) === 2);

  // ── lives are on: a crash costs a heart; 0 hearts → the wreck → the ER, the group together ──
  await A.game(`(ctx.G.invT = 0, ctx.G.invSoft = false, L3.damage(1, "QA", "qa"), true)`);
  t.check("with friends a crash costs a heart (2 → 1)", (await A.game(`ctx.G.hearts`)) === 1);
  await A.game(`(ctx.G.invT = 0, ctx.G.invSoft = false, L3.damage(1, "QA", "qa"), true)`);
  const er = await A.until(`ctx.state === "wrecked" || ctx.state === "cameosER" || (ctx.civic && ctx.civic.place && ctx.civic.place.kind === "er")`, "A: 0 hearts → the wreck / the ER", 60000);
  t.check("0 hearts → the wreck and the ER, as when alone", er, await A.game(`ctx.state`));
  t.check("…and the group stays together", await A.game(`ctx.party.active && ctx.party.connected`) && await B.game(`ctx.party.active`));

  // ── leave: B stays exactly where she is ──
  await B.game(QUIET);
  await B.frames(10);
  const b2 = await B.game(RUN);
  await B.game(`(ctx.group.leave(), true)`);
  await B.frames(30);
  const b3 = await B.game(RUN);
  t.check("B leaves → out of the group, still playing right where she was, same run", !(await B.game(`ctx.party.active`)) && b3.mode === "cruise" && b3.startS === b2.startS && (b3.state === "playing" || b3.state === "footRun") && Math.hypot(b3.x - b2.x, b3.z - b2.z) < 5, JSON.stringify([b2, b3]));
}
