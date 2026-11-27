// 🏡👯 Homelife WITH FRIENDS (features/homes + features/together) — two real pages in one party against the LOCAL relay
// (never production): both walk to the same Lakewood door → the same household is doing the same thing on both screens
// (the scene is seeded from the house + the party's shared day + the shared clock), both go in as guests → each sees the
// other in the room (together), the household's scene + people match, nobody inside a wall on either screen; a friend
// in the room never sets off the residents. Waits are in GAME frames (scripts/lib/party3d.js), never wall time.
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");
let relay = null;
const PORT = 31000 + (process.pid % 20000);
const Q0 = `&enable=party,foot,town,atmos,openworld,homes,seasons,interiors&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;
const D = `ctx.homes.debug`;

module.exports = {
  name: "homelife2",
  viewport: { width: 1280, height: 720 },
  query: Q0,
  save2d: { totalCoins: 500, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    const guests = [];
    try { await body(t, guests); }
    catch (e) { t.check("homelife2 threw", false, String(e && e.stack || e).slice(0, 500)); }
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
  await t.game(`(ctx.party.hostRoam(), true)`);     // (📱 👯 › Play with a friend — the title has no Friends tile any more)
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
  const A = await guestPage(t, "guest", { totalCoins: 300, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}`);
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const both = [Hp, A];
  const all = fn => Promise.all(both.map(fn));
  await all(p => p.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold && ctx.law.hold(99999), true)`));
  for (const p of both) {
    await p.game(`(() => { if (ctx.foot.active) ctx.foot.end("test"); if (ctx.state !== "playing") L3.setState("playing"); return true; })()`);
    await p.frames(4);
    await p.game(`(ctx.town.load("lakewood"), true)`);
    if (!await p.until(`ctx.town.loaded("lakewood")`, `${p.label}: Lakewood's models`, 120000)) return;
    await p.game(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf ? ctx.town.exitOf("lakewood") : ctx.town.exits.find(e => e.town === "lakewood").s, speed: 0 })`);
    if (!await p.until(`ctx.town.active && ctx.town.id === "lakewood"`, `${p.label}: in Lakewood`, 60000)) return;
    await p.game(`ctx.foot.start("parked")`);
    if (!await p.until(`ctx.state === "footRun" && ctx.foot.phase === "walk" && ctx.homes.homes().length > 0`, `${p.label}: walking in town`, 60000)) return;
  }
  // the same doors, the same ids, the same families on both screens
  const ids = await all(p => p.game(`ctx.homes.homes().slice(0, 40).map(h => h.key + "|" + h.name + "|" + h.cast.join("")).join()`));
  t.check("both screens: the same doors, ids and families", ids[0] === ids[1] && ids[0].length > 100);
  // the same scenes up and down the street (the party's shared day + clock)
  await all(p => p.game(`(${D}.hour(19), true)`));
  await all(p => p.frames(30));
  const sc = await all(p => p.game(`ctx.homes.homes().slice(0, 60).map(h => ${D}.sceneNow(h.key)).join()`));
  const same = sc[0].split(",").filter((x, i) => x === sc[1].split(",")[i]).length;
  t.check(`both screens: the same household scenes (${same}/60 doors agree)`, same >= 54, sc[0].slice(0, 120) + " vs " + sc[1].slice(0, 120));
  // a door with a family of 3+, a scene with people in it: both go in as guests
  const key = await g(`(() => { const H = ctx.homes.homes().filter(h => ctx.homes.livedIn(h.key) && h.cast.filter(k => !["cat", "dog", "baby"].includes(k)).length >= 3); const h = H.find(h => (ctx.homes.sceneAt(h.key) || {}).here.length >= 3) || H[0]; return h.key; })()`);
  const K = JSON.stringify(key);
  for (const p of both) {
    await p.game(`(() => { const h = ctx.homes.household(${K}); ctx.foot.debug.F.pos.set(h.ap.x, 0.05, h.ap.z); return true; })()`);
    await p.frames(4);
    await p.game(`ctx.homes.enter(${K}, "guest", "door")`);
    if (!await p.until(`ctx.state === "interior" && ctx.homes.house && ctx.homes.debug.room() && ctx.homes.debug.VISIT.cur.rt.ready`, `${p.label}: inside as a guest`, 90000)) return;
  }
  await all(p => p.frames(40));
  const R = await all(p => p.game(`(() => { const r = ${D}.room(); return { scene: r.scene, rooms: r.rooms.join("+"), people: r.res.map(q => q.id).sort().join(","), pos: r.res.map(q => q.id + "@" + Math.round(q.x) + "," + Math.round(q.z)).sort().join(" ") }; })()`));
  t.check("one house, one household: the same scene, rooms and people on both screens", R[0].scene === R[1].scene && R[0].rooms === R[1].rooms && R[0].people === R[1].people, JSON.stringify(R));
  // each sees the other (features/together)
  const sees = await all(p => p.until(`ctx.together && ctx.together.debug && ctx.together.debug.room().mates.length >= 1`, `${p.label}: sees the friend in the room`, 60000));
  t.check("…and each sees the other in the room", sees.every(Boolean));
  // nobody inside a wall on either screen
  const WALL = `(() => { const r = ${D}.room(); const walls = r.cols.filter(c => /^([pq]\\d|back|f\\d)$/.test(c.id)); return r.res.filter(q => walls.some(c => q.x > c.x0 - 0.1 && q.x < c.x1 + 0.1 && q.z > c.z0 - 0.1 && q.z < c.z1 + 0.1)).map(q => q.id); })()`;
  const bad = await all(p => p.game(WALL));
  t.check("nobody inside a wall (either screen)", bad.every(b => b.length === 0), JSON.stringify(bad));
  // a friend in the room never sets the household off (a guest visit: nobody's meter moves)
  await all(p => p.frames(60));
  const m = await all(p => p.game(`${D}.room().res.reduce((a, q) => Math.max(a, q.meter), 0)`));
  t.check("a friend in the room: nobody notices anything odd", m.every(v => v === 0), JSON.stringify(m));
  for (const p of both) { await p.game(`(() => { const c = ctx.homes.debug.VISIT.cur; if (c) { c.V.exit = "door"; c.rt.leave(); } return true; })()`); await p.until(`ctx.state === "footRun"`, `${p.label}: back outside`, 60000); }
}
