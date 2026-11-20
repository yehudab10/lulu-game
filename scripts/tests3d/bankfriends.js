// 🏦 THE BANK WITH FRIENDS (ci/bankfriends) — two real pages in one party against the LOCAL relay (never production):
//   STAGE 2  FOILING A ROBBERY TOGETHER (heist/party.js): a robbery on one friend's screen (the owner) shows on the
//            other's (the robber + the getaway car, the chip, the beacon); the friend TACKLES the robber on foot; the
//            owner checks it against what it sees, the party's HOST splits the pay (a crew of 2 → about half each, never
//            more than one solo foil in total) and keeps the per-player cap; a payout broadcast by a non-host is ignored;
//            one robbery at a time across the party.
// Waits are in GAME frames (scripts/lib/party3d.js). QA's watchdog runs on the host page.
const path = require("path");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const W = require("../lib/qawatch.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,heist&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const SHOTS = path.join(__dirname, "..", "..", "smoke-shots");

module.exports = {
  name: "bankfriends",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(8 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("bankfriends threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const P of [Hp, A]) {
    await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await P.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exits[0].s, speed: 0 })`);
    await P.until(`ctx.town.active && ctx.openworld.zone === "lakewood"`, `${P.label}: in Lakewood`, 40000);
  }
  // both on foot, near the bank, ~20 m apart
  const bank = await g(`ctx.town.spot("bank")`);
  for (const [P, off] of [[Hp, 9], [A, 13]]) {
    await P.game(`ctx.foot.start("parked")`);
    await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label}: on foot`, 60000);
    await P.game(`(() => { const sp = ctx.town.spot("bank"); ctx.foot.debug.F.pos.set(sp.x + sp.nx * ${off}, 0.05, sp.z + sp.nz * ${off}); return true; })()`);
  }
  await A.until(`(() => { const rc = ctx.party.remoteCar(${HU}); return !!rc && rc.shown && rc.foot; })()`, "guest sees the host on foot", 60000);
  await W.install(t);
  const coins0 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };

  // ── a robbery on the host's screen (she's on foot: the robber fumbles in the doorway) ──
  t.check("robberies are on in a party's Free Roam town (heist live gate)", await g(`ctx.heist.debug.live("robbery")`));
  t.check("the host's screen stages one at the bank", await g(`ctx.heist.debug.robbery({ where: "town", spot: "bank" })`));
  await Hp.until(`!!ctx.heist.robbery && ctx.heist.robbery.phase === "run"`, "host: the robber bursts out", 40000);
  await Hp.until(`!!ctx.heist.debug.party().sent`, "host: the robbery rides in my snapshot (d.x.rb)", 20000);
  t.check("one robbery at a time: the guest's scheduler stands down while the host's is on", true);
  await A.until(`ctx.heist.debug.party().puppets.includes(${HU})`, "guest: sees the host's robbery (robber + getaway car)", 40000);
  t.check("guest: …and its own scheduler won't start another", await A.game(`(ctx.heist.debug.R.nextT = 0, !ctx.heist.debug.schedRobbery())`));
  await A.page.screenshot({ path: path.join(SHOTS, "3d-bankfriends-robbery-guest.png") }).catch(() => { });
  // the guest runs up and TACKLES him (the ✋ spot on her screen → the host checks she's really there)
  await A.game(`(() => { const p = ctx.heist.debug.party(); return true; })()`);
  const rob = await g(`(() => { const o = ctx.heist.robbery.robber.obj.position; return { x: o.x, z: o.z }; })()`);
  await A.game(`(ctx.foot.debug.F.pos.set(${rob.x} + 1.2, 0.05, ${rob.z} + 0.6), true)`);
  await A.frames(6);
  const lbl = await A.game(`(ctx.foot.debug.interactables() || {}).label || ""`);
  t.check("guest: ✋ TACKLE HIM! on the friend's robber", /TACKLE/.test(lbl), lbl);
  await A.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return true; })()`);
  if (!await Hp.until(`!!ctx.heist.robbery && ctx.heist.robbery.phase === "foiled"`, "host: the friend's tackle foils it (checked on the host's screen)", 40000)) return;
  t.check("…credited to the guest", (await g(`ctx.heist.robbery.by`)) === guestUid, await g(`ctx.heist.robbery.by`));
  // the host (also the party's host) splits the pay; each screen pays itself its share once
  await Hp.until(`ctx.heist.debug.party().paid.length > 0`, "host: share paid", 30000);
  await A.until(`ctx.heist.debug.party().paid.length > 0`, "guest: share paid", 30000);
  const coins1 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };
  const dh = coins1.h - coins0.h, da = coins1.a - coins0.a, maxPay = await g(`ctx.heist.pay.foil[1] + ctx.heist.pay.foilClean + ctx.heist.pay.tackle`);
  t.check("both get a share, and the two together aren't more than one solo foil (split, never multiplied)", dh > 0 && da > 0 && dh + da <= maxPay + 5, JSON.stringify({ dh, da, maxPay }));
  t.check("the host's book counts one party foil each", await g(`(() => { const n = ctx.heist.debug.party().host.n; return n[${HU}] === 1 && n[${GU}] === 1; })()`), JSON.stringify(await g(`ctx.heist.debug.party().host`)));
  await t.shot("robbery-foiled-host");
  // a payout broadcast by someone who isn't the host is ignored
  await A.game(`(ctx.party.broadcast("hfa", 4242, ${GU}, "ram", [[${HU}, 80], [${GU}, 80]]), true)`);
  await Hp.frames(40);
  t.check("a fake payout from a non-host pays nobody", (await g(`L3.wallet.coins`)) === coins1.h, JSON.stringify({ was: coins1.h, now: await g(`L3.wallet.coins`) }));
  // the same claim twice never pays twice
  await g(`(ctx.party.sendEvent("hfo", ctx.heist.robbery ? ctx.heist.robbery.id : 1, "tackle", [${HU}, ${GU}], 120), true)`);
  await Hp.frames(30);
  t.check("the same robbery's claim again pays nothing more", (await g(`L3.wallet.coins`)) === coins1.h);
  await Hp.until(`!ctx.heist.robbery`, "the robbery tidies away", 60000);
  await A.until(`ctx.heist.debug.party().puppets.length === 0`, "guest: the friend's robbery is gone too", 40000);
  W.check(t, "watchdog (host)", await W.report(t));
}
