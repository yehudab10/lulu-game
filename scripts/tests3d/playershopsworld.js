// 🏪🌍 PLAYER SHOPS ON THE RELAY (features/playershops/server.js + server/shops.mjs, stage 2) — two players who are NOT
// friends, one LOCAL relay (never production):
//   • both see the relay's shops (/shops/config); A leases a kugel shop (the relay says yes FIRST) and shelves kugel →
//     the shelf reaches the relay a few seconds later
//   • B (an account a few days old) sees it as A's shop on the street (not FOR LEASE), walks in, buys one with HER coins
//     → the kugel is in her bag (features/houseitems); B can't lease A's shop
//   • A's next hello: what sold comes off her shelf and the till (85 %) comes to her phone
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const PORT = 29000 + (process.pid % 20000);
const RELAY = `http://127.0.0.1:${PORT}`;
const Q = `&enable=town,foot,accounts,houseitems&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
let relay = null;

module.exports = {
  name: "playershopsworld",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("playershopsworld threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  const A = hostPage(t);
  const B = await guestPage(t, "B", { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Latke Legend" }, Q);
  guests.push(B);
  if (!await B.until(`window.__lulu3d && __lulu3d.state === "title"`, "B boots", 120000)) return;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // both get a username (an account: shops need one)
  const names = {};
  for (const [P, tag] of [[A, "a"], [B, "b"]]) {
    const nm = "zzshop" + tag + Math.random().toString(36).slice(2, 7);
    const r = await P.L(`__lulu3d.ctx.accounts.setName(${JSON.stringify(nm)})`);
    t.check(`${P.label || "A"}: an account with a username`, !!(r && r.ok), JSON.stringify(r));
    names[tag] = nm;
  }
  const idB = await B.game(`ctx.player.id()`);
  await A.L(`fetch(${JSON.stringify(RELAY)} + "/shops/_made", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid: ${JSON.stringify(idB)}, ago: 4 * 86400000 }) }).then(r => r.ok)`);
  for (const P of [A, B]) {
    await P.game(`(L3.setState("playing"), ctx.town.load("lakewood"), true)`);
    if (!await P.until(`ctx.town.loaded("lakewood")`, `${P.label || "A"}: Lakewood loads`, 90000)) return;
    await P.game(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await P.until(`ctx.town.active && ctx.playershops.fronts().length > 10`, `${P.label || "A"}: in Lakewood`, 30000)) return;
    await P.game(`(ctx.foot.start("parked", { noIntro: true }), true)`);
    await P.until(`ctx.state === "footRun"`, `${P.label || "A"}: on foot`, 20000);
    if (!await P.until(`ctx.playershops.debug.SVR.SV.on`, `${P.label || "A"}: the relay's shops are up`, 30000)) return;
  }
  t.check("both pages see the relay's shops (/shops/config)", true);
  // A leases a shop: the relay says yes first, then the deposit; she shelves 4 kugel at 15
  const F = await A.game(`(() => { const f = ctx.playershops.leasable()[0]; return { id: f.id, ap: f.ap, nx: f.nx, nz: f.nz }; })()`);
  const FJ = JSON.stringify(F.id);
  const ok = await A.L(`(async () => { const P = __lulu3d.ctx.playershops, f = P.debug.frontById(${FJ}); const c = await P.debug.SVR.claim(f.id, "kugel"); if (!c.ok) return c; P.debug.open(f, "kugel", { how: "lease", deposit: 300 }); const sh = P.debug.S.shops[f.id]; sh.stock.push({ g: "kugel", n: 4, stars: 2, day: P.debug.today() }); P.debug.shelve(f.id, 0, 0, 15); return { ok: true }; })()`);
  t.check("A leases a kugel shop (claimed on the relay first) and shelves 4 at 15", ok && ok.ok === true, JSON.stringify(ok));
  // (poll the relay itself — an until() on a Promise would pass at once)
  let onRelay = false;
  for (let k = 0; k < 40 && !onRelay; k++) { onRelay = await A.L(`fetch(${JSON.stringify(RELAY)} + "/shops/view?id=" + ${JSON.stringify(F.id.replace(/^shop:/, ""))}, { cache: "no-store" }).then(r => r.json()).then(j => !!(j.ok && j.shelf.length === 1 && j.shelf[0].n === 4))`); if (!onRelay) await sleep(1000); }
  t.check("…her shelf reaches the relay a few seconds later", onRelay);
  // B: sees A's shop on the street
  await B.game(`(ctx.playershops.debug.SVR.SV.listAt = -1e9, true)`);
  t.check("B sees it as A's shop", await B.until(`ctx.playershops.others().some(x => x.id === ${FJ} && x.server && x.kind === "kugel" && x.name === ${JSON.stringify(names.a)})`, "A's shop on B's screen", 30000));
  t.check("…not FOR LEASE for B", !(await B.game(`ctx.playershops.leasable().some(f => f.id === ${FJ})`)));
  const tk = await B.L(`__lulu3d.ctx.playershops.debug.SVR.claim(${FJ}, "kugel")`);
  t.check("…B can't take it (the relay: taken)", tk.ok === false && tk.why === "taken", JSON.stringify(tk));
  await B.game(`(() => { const Fp = ctx.foot.debug.F, n = ctx.world.road.nearest(${F.ap.x}, ${F.ap.z}, Fp.s, {}); Fp.pos.set(${F.ap.x} - ${F.nx} * 0.4, 0.05, ${F.ap.z} - ${F.nz} * 0.4); Fp.s = n.s; Fp.d = n.d; ctx.foot.obj.position.copy(Fp.pos); return true; })()`);
  await B.until(`(() => { const P = ctx.playershops.debug, f = P.frontById(${FJ}); return !!(f && f.sid && /^other:/.test(P.CL.get(f.sid) || "")); })()`, "B's storefront ✋ follows A's shop", 20000);
  const lab = await B.game(`(() => { const P = ctx.playershops.debug, f = P.frontById(${FJ}); return f && f.sid && ctx.storefronts ? String(ctx.storefronts.debug.label(f.sid) || "") : ((ctx.foot.debug.interactables() || {}).label || ""); })()`);
  t.check("B at the door: ✋ 🛍️ SHOP AT <A>'S", /SHOP AT/.test(lab) && lab.includes(names.a.toUpperCase()), lab);
  // in → shelf 1 → the kugel → ✅ Buy it
  const cB = await B.game(`L3.wallet.coins`);
  await B.L(`__lulu3d.ctx.playershops.debug.visitShop(__lulu3d.ctx.playershops.debug.frontById(${FJ}), __lulu3d.ctx.playershops.others().find(x => x.id === ${FJ}))`);
  if (!await B.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "B inside A's shop", 30000)) return;
  const RI = await B.game(`(() => { const r = window.__interiors.room, P = ctx.playershops.debug; return { slots: r.data.V.slots.length, units: r.data.V.unitAt.length, cur: P.ROOM.cur ? { mode: P.ROOM.cur.mode, shelf: (P.ROOM.cur.friend && P.ROOM.cur.friend.shelf || []).filter(Boolean) } : null, hots: r.hots.map(h => h.id) }; })()`);
  const relayNow = await A.L(`fetch(${JSON.stringify(RELAY)} + "/shops/view?id=" + ${JSON.stringify(F.id.replace(/^shop:/, ""))}).then(r => r.json())`);
  t.check("…her shelves as A stocked them", RI.slots === 1, JSON.stringify(RI) + " | B saw: " + JSON.stringify(await B.game(`ctx.playershops.debug.SVR.SV.lastView`)) + " | relay now: " + JSON.stringify(relayNow) + " | A's log: " + JSON.stringify(await A.game(`ctx.playershops.debug.SVR.SV.log.slice(-6)`)) + " | A's shelf: " + JSON.stringify(await A.game(`ctx.playershops.debug.S.shops[${FJ}].shelf.filter(Boolean)`)));
  const opts = () => B.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
  const pickOpt = async re => { for (let i = 0; i < 60; i++) { const o = await opts(); if (o.length) { const k = o.findIndex(x => re.test(x)); if (k < 0) return false; await B.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${k}].click()`); await sleep(400); return true; } await B.L(`(document.querySelector("#dialog") || document.body).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))`); await sleep(300); } return false; };
  await B.game(`(r => { r.hots.find(h => h.id === "shelf:0").action(r); return true; })(window.__interiors.room)`);
  t.check("B: shelf 1 → the potato kugel (15) → ✅ Buy it", await pickOpt(/potato kugel.*15/) && await pickOpt(/Buy it/));
  t.check("…the relay said yes, then 15 of HER coins", await B.until(`L3.wallet.coins === ${cB} - 15`, "B paid", 20000), String(await B.game(`L3.wallet.coins`)));
  t.check("…the kugel is in her bag (features/houseitems)", await B.game(`ctx.houseitems.bag.some(x => x.id === "kugel")`));
  // A: the next hello — what sold comes off her shelf, the till (85 % of 15 = 12) comes to her phone
  const cA = await A.game(`L3.wallet.coins`);
  const hr = await A.L(`__lulu3d.ctx.playershops.debug.helloNow()`);
  t.check("A's hello: the till (12) comes to her phone", (await A.game(`L3.wallet.coins`)) >= cA + 12, `${cA} → ${await A.game(`L3.wallet.coins`)} ${JSON.stringify(hr)}`);
  t.check("…and the one that sold is off her shelf (3 left)", (await A.game(`ctx.playershops.debug.S.shops[${FJ}].shelf[0].n`)) === 3);
  // stage 3: A in her own shop = at the counter → B can tip her (from B's coins, inside the caps)
  await A.game(`(ctx.playershops.debug.enterShop(ctx.playershops.debug.frontById(${FJ}), "owner"), true)`);
  await A.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "A inside her shop", 30000);
  let atCounter = false;
  for (let k = 0; k < 30 && !atCounter; k++) { atCounter = await A.L(`fetch(${JSON.stringify(RELAY)} + "/shops/view?id=" + ${JSON.stringify(F.id.replace(/^shop:/, ""))}, { cache: "no-store" }).then(r => r.json()).then(j => j.shop.at === 1)`); if (!atCounter) await sleep(1000); }
  t.check("A inside her shop: the relay says she's at the counter", atCounter);
  await B.game(`(window.__interiors.room && window.__interiors.room.leave(), true)`);
  await B.until(`ctx.state === "footRun"`, "B out", 15000);
  const cB2 = await B.game(`L3.wallet.coins`);
  await B.L(`__lulu3d.ctx.playershops.debug.visitShop(__lulu3d.ctx.playershops.debug.frontById(${FJ}), __lulu3d.ctx.playershops.others().find(x => x.id === ${FJ}))`);
  if (await B.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "B back inside", 30000)) {
    await B.game(`(r => { r.hots.find(h => h.id === "shelf:0").action(r); return true; })(window.__interiors.room)`);
    t.check("B: another kugel → ✅ Buy it → 💝 Tip 5", await pickOpt(/potato kugel/) && await pickOpt(/Buy it/) && await pickOpt(/Tip 5/));
    t.check("…20 of her coins (15 + the tip)", await B.until(`L3.wallet.coins === ${cB2} - 20`, "B paid with the tip", 20000), String(await B.game(`L3.wallet.coins`)) + " " + JSON.stringify(await B.game(`ctx.playershops.debug.SVR.SV.lastBuy`)));
    const cA2 = await A.game(`L3.wallet.coins`);
    await A.L(`__lulu3d.ctx.playershops.debug.helloNow()`);
    t.check("…A's till: 12 + the 5 tip", (await A.game(`L3.wallet.coins`)) === cA2 + 17, `${cA2} → ${await A.game(`L3.wallet.coins`)}`);
  }
}
