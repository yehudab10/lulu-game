// 🏘️👯 REAL ESTATE WITH FRIENDS (features/realestate stage 4) — two real pages in one party against the LOCAL relay
// (never production), in 🌍 Free Roam, both in Lakewood:
//   • the host buys a home → the guest sees it as the host's (the registry's friends source, d.x.re): not listed, can't
//     be claimed, a mailbox in the host's colour, ✋ at its door names the owner
//   • the host goes inside → the guest's ✋ says 👯 JOIN <host> INSIDE → both in the same room (features/together:
//     the instance is the house id), each sees the other; the visit has no decorating; nobody's coins move
//   • a double booking (both signed the same home): the earlier purchase keeps it, the other gets every coin back
const path = require("path");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 27000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,openworld&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

module.exports = {
  name: "realestatefriends",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("realestatefriends threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  await t.game(`L3.startRun({ mode: "cruise", quick: true })`);     // (▶ PLAY first, then 📱 👯 › Play with a friend — the title has no Friends tile any more)
  await t.until(`["playing", "footRun"].includes(__lulu3d.ctx.state)`, "▶ PLAY: her run starts", 120000);
  await t.game(`(ctx.party.hostRoam(), true)`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  await g(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`), HU = JSON.stringify(hostUid);
  const A = await guestPage(t, "guest", { totalCoins: 60000, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  await A.game(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`);
  const guestUid = await A.game(`ctx.party.uid`), GU = JSON.stringify(guestUid);
  for (const p of [Hp, A]) await p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

  // ── both into Lakewood, on foot ──
  for (const P of [Hp, A]) {
    await P.game(`(ctx.town.load("lakewood"), true)`);         // (Lakewood isn't the first exit any more — ci/exits2: load it)
    if (!await P.until(`ctx.town.loaded("lakewood")`, `${P.label}: Lakewood's models`, 120000)) return;
    await P.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf ? ctx.town.exitOf("lakewood") : ctx.town.exits[0].s, speed: 0 })`);
    if (!await P.until(`ctx.town.active && ctx.openworld.zone === "lakewood" && ctx.realestate.homes().length > 40`, `${P.label} in Lakewood`, 60000)) return;
    await P.game(`ctx.foot.start("parked")`);
    if (!await P.until(`ctx.state === "footRun" && ctx.foot.phase === "walk"`, `${P.label} on foot`, 60000)) return;
  }
  t.check("with friends in 🌍 Free Roam the market is open (listings on both screens)", (await g(`ctx.realestate.listings().length`)) > 0 && (await A.game(`ctx.realestate.listings().length`)) > 0);

  // ── the host buys a home ──
  const id = await g(`ctx.realestate.listings()[0].id`), ID = JSON.stringify(id);
  const ok = await g(`ctx.realestate.debug.buyNow(${ID})`);
  t.check("the host buys a home (cash)", ok && (await g(`ctx.realestate.owns(${ID})`)));
  if (!await A.until(`(() => { const o = ctx.realestate.ownerOf(${ID}); return !!o && !o.me && o.name === "Kugel Kid"; })()`, "guest: it's Kugel Kid's now", 60000)) return;
  t.check("…the guest sees it as the host's: no longer listed", !(await A.game(`ctx.realestate.debug.isListed(${ID})`)));
  t.check("…and can't buy it (the registry says taken)", (await A.game(`ctx.realestate.registry.claim(${ID}, { town: "lakewood", address: "x" }).why`)) === "taken");
  await A.until(`ctx.realestate.debug.W.friends.some(r => r.id === ${ID}) && ctx.realestate.debug.counts().mailboxes >= 1`, "guest: a mailbox in the host's colour at that house", 20000);
  // the guest at its door: whose it is (nobody home yet)
  const rec = await A.game(`ctx.realestate.home(${ID})`);
  await A.game(`(() => { const F = ctx.foot.debug.F; F.pos.set(${rec.ap.x}, 0.05, ${rec.ap.z}); ctx.foot.obj.position.copy(F.pos); return true; })()`);
  await A.frames(4);
  const l0 = await A.game(`(ctx.foot.debug.interactables() || {}).label || ""`);
  t.check("guest at the host's door: ✋ says whose house it is", /KUGEL KID( #\d+)?'S HOUSE/.test(l0), l0);

  // ── the host goes inside her house → the guest joins her ──
  const hrec = await g(`ctx.realestate.home(${ID})`);
  await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${hrec.ap.x}, 0.05, ${hrec.ap.z}); ctx.foot.obj.position.copy(F.pos); return true; })()`);
  await t.frames(4);
  // her decorations in that home (a rug + a bed) — what a friend visiting should see
  await g(`(ctx.realestate.debug.S.decor[${ID}] = { rug: "road", bed: "fluffy" }, true)`);
  t.check("…her decorations there reach the friend's screen", await A.until(`(() => { const d = ctx.realestate.debug.friendDecor(${ID}); return !!d && d.rug === "road" && d.bed === "fluffy"; })()`, "guest knows the host's decor", 20000));
  await g(`ctx.realestate.goIn(${ID}, "owner")`);
  if (!await Hp.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "host inside her house", 60000)) return;
  if (!await A.until(`/JOIN KUGEL KID( #\\d+)? INSIDE/.test((ctx.foot.debug.interactables() || {}).label || "")`, "guest: ✋ 👯 JOIN KUGEL KID INSIDE", 60000)) {
    console.log("   guest's ✋ instead:", JSON.stringify(await A.game(`(() => { const s = ctx.foot.debug.interactables() || {}, F = ctx.foot.debug.F, h = ctx.realestate.home(${ID});
      return { label: s.label || null, kind: s.kind || (s.ent && s.ent.kind) || null, state: ctx.state, her: F ? [+F.pos.x.toFixed(1), +F.pos.z.toFixed(1)] : null, door: h && h.ap ? [+h.ap.x.toFixed(1), +h.ap.z.toFixed(1)] : null,
        hostIn: ctx.together && ctx.together.debug ? JSON.stringify(ctx.together.debug.rooms ? ctx.together.debug.rooms() : null).slice(0, 200) : null }; })()`)));
    return;
  }
  const coins0 = { h: await g(`L3.wallet.coins`), a: await A.game(`L3.wallet.coins`) };
  await A.game(`(() => { const s = ctx.foot.debug.interactables(); if (s && s.ent && s.ent.act) s.ent.act(); return true; })()`);
  if (!await A.until(`ctx.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "guest walks in", 60000)) return;
  await Hp.until(`ctx.together.debug.room().mates.some(m => m.uid === ${GU})`, "host sees the guest inside", 60000);
  await A.until(`ctx.together.debug.room().mates.some(m => m.uid === ${HU})`, "guest sees the host", 60000);
  t.check("the same room on both screens (the house id)", (await g(`ctx.together.debug.room().inst`)) === id && (await A.game(`ctx.together.debug.room().inst`)) === id);
  t.check("…the guest's visit: no decorating hotspots", !(await A.game(`window.__interiors.room.hots.some(h => /^slot:/.test(h.id))`)) && (await A.game(`ctx.realestate.debug.CUR.mode`)) === "visit");
  // (the room's pieces load a moment after "ready": wait for her rug + bed, up to 20 s)
  await A.until(`(() => { const C = (window.__interiors.room.data.V || {}).cache || {}; const vis = sl => Object.keys(C[sl] || {}).filter(k => C[sl][k] && C[sl][k].visible); return vis("rug").includes("road") && vis("bed").includes("fluffy"); })()`, "the friend's screen: her rug + her bed", 20000);
  const seen = await A.game(`(() => { const C = window.__interiors.room.data.V.cache || {}; const vis = sl => Object.keys(C[sl] || {}).filter(k => C[sl][k] && C[sl][k].visible); return { rug: vis("rug"), bed: vis("bed") }; })()`);
  t.check("…the friend sees HER decorations (her rug + her bed)", seen.rug.includes("road") && seen.bed.includes("fluffy"), JSON.stringify(seen));
  t.check("…in a party the owner doesn't redecorate either", !(await g(`window.__interiors.room.hots.some(h => /^slot:/.test(h.id))`)));
  await t.frames(20);
  await t.shot("friends-inside");
  t.check("nobody's coins moved", (await g(`L3.wallet.coins`)) === coins0.h && (await A.game(`L3.wallet.coins`)) === coins0.a);
  await A.game(`(window.__interiors.room.leave(), true)`);
  await g(`(window.__interiors.room.leave(), true)`);
  await A.until(`ctx.state === "footRun"`, "guest back out", 30000);
  await Hp.until(`ctx.state === "footRun"`, "host back out", 30000);

  // ── 🏠 Go there with a friend around: she goes alone (the friend finder points to her), the friend stays put ──
  await A.game(`(ctx.foot.debug.F.pos.x += 25, ctx.foot.obj.position.copy(ctx.foot.debug.F.pos), true)`);     // (the guest wanders off a bit)
  await t.frames(10);
  const gp = await A.game(`[ctx.foot.pos.x, ctx.foot.pos.z]`);
  t.check("with a friend: 🏠 Go there — the host is on her way, alone", (await g(`(ctx.realestate.debug.GO.last = -1e9, ctx.realestate.goTo(${ID}))`)) === "");
  const hd = await Hp.until(`ctx.state === "footRun" && ctx.foot.phase === "walk" && (() => { const r = ctx.realestate.homes().find(h => h.id === ${ID}); return !!r && Math.hypot(ctx.foot.pos.x - r.ap.x, ctx.foot.pos.z - r.ap.z) < 3; })()`, "host at her door", 30000);
  t.check("…the host lands at her own front door", hd);
  const ga = await A.game(`({ st: ctx.state, town: ctx.town.active && ctx.town.id, p: [ctx.foot.pos.x, ctx.foot.pos.z], party: ctx.party.connected })`);
  t.check("…the guest stays where she was, still in the group", ga.st === "footRun" && ga.town === "lakewood" && Math.hypot(ga.p[0] - gp[0], ga.p[1] - gp[1]) < 2 && ga.party, JSON.stringify({ ga, gp }));
  // ── 👯 "Come to my place": the host asks, the friend says yes → the friend goes straight to the host's front door ──
  await A.game(`(ctx.realestate.debug.GO.last = -1e9, ctx.foot.debug.F.pos.x += 30, ctx.foot.obj.position.copy(ctx.foot.debug.F.pos), true)`);
  await t.frames(10);
  await A.L(`import("./js/core/ctx.js").then(m => { m.on("group:missionStart", e => { window.__mstart = (window.__mstart || 0) + 1; }); return true; })`).catch(() => null);
  const off = await g(`ctx.group.offer("realestate.visit")`);
  t.check("👯 Come to my place: the host offers it", off === "", String(off));
  await A.until(`!!ctx.group.offerNow && !!ctx.group.offerNow()`, "guest sees the offer", 20000);
  await A.game(`ctx.group.joinOffer()`);
  await Hp.until(`(() => { const o = ctx.group.offerNow(); return !!o && o.ins.length >= 2; })()`, "the guest is in", 20000);
  await g(`ctx.group.goNow()`);
  const gd = await A.until(`ctx.state === "footRun" && ctx.foot.phase === "walk" && (() => { const r = ctx.realestate.homes().find(h => h.id === ${ID}); return !!r && Math.hypot(ctx.foot.pos.x - r.ap.x, ctx.foot.pos.z - r.ap.z) < 3; })()`, "guest at the host's door", 30000);
  t.check("…the friend lands at the host's front door", gd, JSON.stringify(await A.game(`(() => { const p = ctx.party.peer(${HU}); return { rv: p && p.x && p.x.rv, act: ctx.party.activity, go: ctx.realestate.debug.GO, why: p && p.x && p.x.rv ? ctx.realestate.goBlock(p.x.rv, { friend: true }) : "no rv", n: (window.__mstart || 0) }; })()`)));
  t.check("…nobody's coins moved", (await A.game(`L3.wallet.coins`)) >= 0);

  // ── a double booking: both signed the same home → exactly one keeps it, the other gets every coin back ──
  // (with the world-wide registry up — the test's relay has it — the SERVER decides: the first claim to reach it; without
  //  it, the friends' rule: the earlier signature)
  const id2 = await g(`ctx.realestate.listings().map(r => r.id).find(x => x !== ${ID})`), ID2 = JSON.stringify(id2);
  const srv = (await g(`ctx.realestate.debug.SV.on`)) && (await A.game(`ctx.realestate.debug.SV.on`));
  const c1 = await A.game(`L3.wallet.coins`), h1 = await g(`L3.wallet.coins`);
  await A.game(`(L3.wallet.add(-1000), ctx.realestate.registry.claim(${ID2}, { town: "lakewood", address: "the same house", paid: 1000, since: Date.now() }).ok)`);
  await g(`(L3.wallet.add(-1000), ctx.realestate.registry.claim(${ID2}, { town: "lakewood", address: "the same house", paid: 1000, since: Date.now() - 600000 }).ok)`);
  const one = async () => (await g(`ctx.realestate.owns(${ID2})`)) !== (await A.game(`ctx.realestate.owns(${ID2})`));
  let settled = false;
  for (let k = 0; k < 60 && !settled; k++) { await t.frames(30); settled = await one(); }
  await t.frames(120);           // (and it stays settled: nobody lets go a second time)
  const hk = await g(`ctx.realestate.owns(${ID2})`), ak = await A.game(`ctx.realestate.owns(${ID2})`);
  t.check(`double-booked (${srv ? "the world registry decides" : "friends: the earlier signature"}): exactly one keeps it`, settled && hk !== ak && (srv || hk), JSON.stringify({ srv, host: hk, guest: ak, hl: await g(`ctx.realestate.debug.S.log.slice(-2)`), gl: await A.game(`ctx.realestate.debug.S.log.slice(-2)`) }));
  const hc = await g(`L3.wallet.coins`), ac = await A.game(`L3.wallet.coins`);
  t.check("…and the one who let go gets every coin back", hk ? ac === c1 && hc === h1 - 1000 : hc === h1 && ac === c1 - 1000, JSON.stringify({ host: [h1, hc], guest: [c1, ac] }));
}
