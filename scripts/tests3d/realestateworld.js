// 🏘️🌍 THE WORLD-WIDE PROPERTY REGISTRY (features/realestate/server.js + server/homes.mjs) — two players who are NOT
// friends, one LOCAL relay (never production):
//   • both see the registry (the relay has /homes/*); A buys a home → B sees it as A's (a generated label), not listed,
//     can't buy it, nobody's coins move on B's side
//   • two claims on the same home at once: exactly one wins
//   • bought offline while someone else claimed it on the server → refunded, every coin
//   • THE GOVERNMENT: 15 days without a hello (the relay's dev clock) → A's home is seized: no key, a SEIZED board, the
//     Council's letter, no rent / mortgage billed
//   • an OLD server (no /homes): the client quietly stays local — buying still works
//   • a hacked client can't release someone else's home
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
const PORT = 28000 + (process.pid % 20000);
const RELAY = `http://127.0.0.1:${PORT}`;
const Q = `&enable=town,foot&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
let relay = null;
// (before ci/friends' core/player.js lands, a page has no ctx.player: give each page a stand-in with the same shape)
const PLAYER = name => `(() => { if (__lulu3d.ctx.player && __lulu3d.ctx.player.id) return __lulu3d.ctx.player.id(); const B = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; const id = Array.from({ length: 16 }, () => B[Math.floor(Math.random() * 32)]).join(""); const sec = Array.from({ length: 32 }, () => "abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789-_"[Math.floor(Math.random() * 46)]).join(""); let label = "${name} #1"; __lulu3d.ctx.player = { id: () => id, secret: () => sec, label: () => label, setLabel: l => { label = l; return true; } }; return id; })()`;

module.exports = {
  name: "realestateworld",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("realestateworld threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  const idA = await A.L(PLAYER("Kugel Kid")), idB = await B.L(PLAYER("Latke Legend"));
  t.check("two different players (random ids, nothing personal)", idA !== idB && /^[A-Z2-7]{16}$/.test(idA));
  // both: into Lakewood on foot; the registry comes up
  for (const P of [A, B]) {
    await P.game(`(L3.setState("playing"), true)`);
    await P.game(`(ctx.town.load("lakewood"), true)`);
    if (!await P.until(`ctx.town.loaded("lakewood")`, `${P.label}: Lakewood loads`, 90000)) return;
    await P.game(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await P.until(`ctx.town.active && ctx.realestate.homes().length > 40`, `${P.label}: in Lakewood`, 20000)) return;
    await P.game(`(ctx.foot.start("parked", { noIntro: true }), true)`);
    await P.until(`ctx.state === "footRun"`, `${P.label}: on foot`, 20000);
    if (!await P.until(`ctx.realestate.debug.SV.on`, `${P.label}: the world-wide registry is up (the relay has /homes)`, 30000)) return;
  }
  t.check("both pages see the shared registry", true);
  // A buys a home
  const X = await A.game(`ctx.realestate.listings()[0].id`), XJ = JSON.stringify(X);
  const rA = await A.game(`ctx.realestate.debug.buyServer(${XJ})`);
  t.check("A buys a home: claimed on the server", rA.ok && (await A.game(`ctx.realestate.debug.S.owned[${XJ}].reg`)) === true, JSON.stringify(rA));
  await B.game(`(ctx.realestate.debug.SVR.poll("lakewood"), true)`);
  if (!await B.until(`(() => { const o = ctx.realestate.ownerOf(${XJ}); return !!o && o.server && /Kugel Kid #\\d+/.test(o.name); })()`, "B sees it as A's (a generated label)", 30000)) return;
  t.check("…not listed for B", !(await B.game(`ctx.realestate.debug.isListed(${XJ})`)));
  const cB = await B.game(`L3.wallet.coins`);
  const rB = await B.game(`ctx.realestate.debug.buyServer(${XJ})`);
  t.check("…B can't buy it (and pays nothing)", !rB.ok && (await B.game(`L3.wallet.coins`)) === cB, JSON.stringify(rB));
  await B.until(`ctx.realestate.debug.W.friends.some(r => r.id === ${XJ})`, "B: a mailbox at A's house", 20000);
  // the same home at once: exactly one wins
  const Y = await A.game(`ctx.realestate.listings().map(r => r.id).find(i => i !== ${XJ})`), YJ = JSON.stringify(Y);
  const [y1, y2] = await Promise.all([A.game(`ctx.realestate.debug.SVR.claim(${YJ})`), B.game(`ctx.realestate.debug.SVR.claim(${YJ})`)]);
  t.check("two claims on one home at the same moment: exactly one wins", (y1.ok && y1.server) !== (y2.ok && y2.server), JSON.stringify([y1, y2]));
  await (y1.ok ? A : B).game(`(ctx.realestate.debug.SVR.release(${YJ}), true)`);
  // bought OFFLINE on B while A claimed it on the server → B is refunded, every coin
  await A.game(`(ctx.realestate.debug.SVR.poll("lakewood"), true)`);
  const Z = await B.game(`ctx.realestate.listings().map(r => r.id).find(i => i !== ${XJ} && i !== ${YJ})`), ZJ = JSON.stringify(Z);
  const c0 = await B.game(`L3.wallet.coins`);
  await B.game(`(ctx.realestate.debug.SV.on = false, true)`);
  t.check("B (offline) buys a home locally", await B.game(`ctx.realestate.debug.buyNow(${ZJ})`));
  const zA = await A.game(`ctx.realestate.debug.SVR.claim(${ZJ})`);
  t.check("…meanwhile A claims the same home on the server", zA.ok && zA.server, JSON.stringify(zA));
  await B.game(`(ctx.realestate.debug.SV.on = true, ctx.realestate.debug.SV.q.push({ op: "claim", id: ${ZJ} }), ctx.realestate.debug.SV.qAt = -99, true)`);
  if (!await B.until(`!ctx.realestate.owns(${ZJ})`, "B back online: the world got there first → B lets go", 40000)) return;
  await B.frames(40);
  t.check("…and B gets every coin back", (await B.game(`L3.wallet.coins`)) === c0, `${c0} → ${await B.game(`L3.wallet.coins`)}`);
  // a hacked client can't release A's home (B's own creds)
  const hack = await B.L(`fetch(${JSON.stringify(RELAY)} + "/homes/release", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pid: __lulu3d.ctx.player.id(), sec: __lulu3d.ctx.player.secret(), h: ${XJ} }) }).then(r => r.json())`);
  t.check("a hacked client can't release someone else's home", hack.ok === false, JSON.stringify(hack));
  // THE GOVERNMENT: 15 days without A → seized
  await t.L(`fetch(${JSON.stringify(RELAY)} + "/homes/_clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offset: 15 * 86400000 }) }).then(r => r.json())`);
  await B.game(`(ctx.realestate.debug.SVR.poll("lakewood"), true)`);    // (any call runs the sweep)
  await B.frames(10);
  await A.game(`(ctx.realestate.debug.SVR.hello(), true)`);
  if (!await A.until(`!!ctx.realestate.debug.S.owned[${XJ}].seized`, "A comes back after 15 days: the Ordinance seized her home", 30000)) return;
  await A.frames(30);
  const S1 = await A.game(`({ seized: ctx.realestate.debug.counts().seized, owned: ctx.realestate.debug.W.owned.some(r => r.id === ${XJ}), letter: (ctx.phone.inbox && ctx.phone.inbox.threads ? ctx.phone.inbox.threads() : []).some(th => /council/i.test(JSON.stringify(th))) })`);
  t.check("…a SEIZED board on the lawn, no key, the Council's letter", S1.seized >= 1 && !S1.owned && S1.letter, JSON.stringify(S1));
  await B.game(`(ctx.realestate.debug.SVR.poll("lakewood"), true)`);
  await B.until(`(() => { const o = ctx.realestate.ownerOf(${XJ}); return !!o && o.seized; })()`, "B sees it held by the Town Council", 20000);
  await t.shot("seized");
  // an OLD server: a page pointed at a relay with no /homes → local only, buying still works
  const O = await guestPage(t, "old-server", { totalCoins: 60000, ownedSkins: ["pink"], selectedSkin: "pink" }, `&enable=town,foot&mpurl=${encodeURIComponent("ws://127.0.0.1:9")}`);
  guests.push(O);
  if (!await O.until(`window.__lulu3d && __lulu3d.state === "title"`, "old-server page boots", 120000)) return;
  await O.L(PLAYER("Babka Baron"));
  await O.game(`(L3.setState("playing"), ctx.town.load("lakewood"), true)`);
  await O.until(`ctx.town.loaded("lakewood")`, "old-server: Lakewood loads", 90000);
  await O.game(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
  await O.until(`ctx.town.active && ctx.realestate.homes().length > 40`, "old-server: in Lakewood", 20000);
  await O.frames(60);
  t.check("no registry on the server → the client stays local, quietly", !(await O.game(`ctx.realestate.debug.SV.on`)));
  t.check("…and buying still works (the local registry)", await O.game(`ctx.realestate.debug.buyNow(ctx.realestate.listings()[0].id)`));
}
