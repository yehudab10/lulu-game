// 🏪👯 PLAYER SHOPS WITH FRIENDS (features/playershops stage 1) — two real pages in one party against the LOCAL relay
// (never production), in 🌍 Free Roam, both in Lakewood: the host leases a shop and shelves kugel → the guest sees that
// front as the host's shop (her sign, not FOR LEASE, not leasable), ✋ 👀 LOOK ROUND <host>'S SHOP → inside: the shelves
// as she stocked them, nothing to buy (stage 2: only real players, through the relay — waiting for the owner's OK), no
// keys / oven / back room for the guest; nobody's coins move.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 27000 + ((process.pid + 7) % 20000);
const Q0 = `&enable=party,foot,town,openworld&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

module.exports = {
  name: "playershopsfriends",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("playershopsfriends threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  await t.game(`L3.startRun({ mode: "cruise", quick: true })`);     // (▶ PLAY first, then 👯 — the title has no Friends tile any more)
  await t.until(`["playing", "footRun"].includes(__lulu3d.ctx.state)`, "▶ PLAY: her run starts", 120000);
  await t.game(`(ctx.party.hostRoam(), true)`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  await g(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
  const A = await guestPage(t, "guest", { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  await A.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  for (const p of [Hp, A]) await p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.playershops.debug.clear(), true)`);
  for (const P of [Hp, A]) {
    await P.game(`(ctx.town.load("lakewood"), true)`);
    if (!await P.until(`ctx.town.loaded("lakewood")`, `${P.label}: Lakewood's models`, 120000)) return;
    await P.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
    if (!await P.until(`ctx.town.active && ctx.town.id === "lakewood" && ctx.playershops.leasable().length > 0`, `${P.label} in Lakewood`, 60000)) return;
    await P.game(`ctx.foot.start("parked")`);
    if (!await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label} on foot`, 60000)) return;
  }
  // the host leases a shop + shelves kugel (the shop's own functions; the dialogue is playershops' test)
  const F = await g(`(() => { const P = ctx.playershops, f = P.leasable()[0]; P.debug.open(f, "kugel", { how: "lease", deposit: 300 }); const sh = P.debug.S.shops[f.id]; sh.stock.push({ g: "kugel", n: 4, stars: 2, day: P.debug.today() }); P.debug.shelve(f.id, 0, 0, 18); return { id: f.id, ap: f.ap, nx: f.nx, nz: f.nz }; })()`);
  const FJ = JSON.stringify(F.id);
  t.check("host: her kugel shop, 4 on the first shelf", await g(`(ctx.playershops.debug.S.shops[${FJ}].shelf[0] || {}).n === 4`));
  const cA = await A.game(`L3.wallet.coins`);
  t.check("guest: sees it as the host's shop (d.x.ps)", await A.until(`ctx.playershops.debug.SHOP_PARTY.cache.some(x => x.id === ${FJ} && x.kind === "kugel" && x.shelf[0] && x.shelf[0].n === 4)`, "the host's shop on the guest's screen", 30000));
  t.check("…not FOR LEASE for the guest", !(await A.game(`ctx.playershops.leasable().some(f => f.id === ${FJ})`)));
  t.check("…the licence counts for both (Lakewood: 3 kugel → 2 left)", await A.game(`ctx.playershops.licencesLeft("lakewood", "kugel")`) === 2);
  await A.game(`(() => { const Fp = ctx.foot.debug.F, n = ctx.world.road.nearest(${F.ap.x}, ${F.ap.z}, Fp.s, {}); Fp.pos.set(${F.ap.x} - ${F.nx} * 0.4, 0.05, ${F.ap.z} - ${F.nz} * 0.4); Fp.s = n.s; Fp.d = n.d; ctx.foot.obj.position.copy(Fp.pos); return true; })()`);
  await new Promise(r => setTimeout(r, 2000));
  // (the host's own front, as the storefronts ✋ labels it on the guest's screen — next door may be FOR LEASE)
  const lab = await A.game(`(() => { const P = ctx.playershops.debug, f = P.frontById(${FJ}); return f && f.sid && ctx.storefronts ? String(ctx.storefronts.debug.label(f.sid) || "") : ((ctx.foot.debug.interactables() || {}).label || ""); })()`);
  const why = await A.game(`(() => { const P = ctx.playershops.debug, f = P.frontById(${FJ}); return { sid: f && f.sid, cl: f && f.sid ? P.CL.get(f.sid) : null, near: (ctx.foot.debug.interactables() || {}).label || "" }; })()`);
  t.check("guest: the host's front says ✋ 👀 LOOK ROUND <host>'S SHOP", /LOOK ROUND/.test(lab), lab + " " + JSON.stringify(why));
  await A.game(`(ctx.playershops.debug.enterShop(ctx.playershops.debug.frontById(${FJ}), "visit", ctx.playershops.debug.SHOP_PARTY.cache.find(x => x.id === ${FJ})), true)`);
  if (await A.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "guest inside the host's shop", 30000)) {
    const R = await A.game(`(() => { const r = window.__interiors.room; return { hots: r.hots.map(h => h.id), goods: r.data.V.slots.length }; })()`);
    t.check("inside: her shelves as she stocked them (one stack of kugel)", R.goods === 1, JSON.stringify(R));
    t.check("…no keys for the guest", !R.hots.includes("keys"), JSON.stringify(R.hots));
    await A.game(`(window.__interiors.room.leave(), true)`);
    await A.until(`ctx.state === "footRun"`, "guest out", 15000);
  }
  t.check("nobody's coins moved on the guest's side (nothing for sale yet)", await A.game(`L3.wallet.coins`) === cA);
}
