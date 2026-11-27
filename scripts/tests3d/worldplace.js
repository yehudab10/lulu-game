// 🌍 ROOMS BY PLACE (ci/oneserver step 3 — on ci/oneserver-place; NOT deployed while the owner is on the Free plan) —
// real pages against a LOCAL relay with the place flag on (WORLD_PLACE=1).
//   SAME SPOT = SAME ROOM   A and B on the same stretch of the lap are both in "WL0" and see each other
//   ACROSS A BOUNDARY       A just past the 500 m line ("WL1"), B just before it ("WL0"): each LISTENS to the other's
//                           room near the line and they still see each other
//   NO BLINK                B drives across into "WL1": on A's screen B is the SAME entry (key "S:" + B's session tag)
//                           before and after — she never vanishes or pops in
//   OLD COPIES              a raw old-style client in the lobby (no session tag) sees A (the lobby bridge, ~1 a second),
//                           and A sees it; A doesn't see B twice (B's bridge copy is marked pl and skipped)
//   KILL SWITCH             a relay without the flag → everyone stays in the old lobby (the other multiplayer tests)
const { startRelay, waitOn, framesOn, setWallCap } = require("../lib/party3d.js");
const PORT = 33500 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=multiplayer,party,openworld,foot,atmos,phone&mpurl=${encodeURIComponent(URL)}`;

async function page(t, label) {
  const browser = t.page.context().browser();
  const pg = await browser.newPage({ viewport: { width: 480, height: 270 } });
  const errors = [];
  pg.on("pageerror", e => errors.push(String(e && e.stack || e)));
  pg.on("console", m => { const x = m.text(); if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(x)) errors.push(x); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.addInitScript(() => { if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify({ totalCoins: 0, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" })); sessionStorage.setItem("__seeded", "1"); });
  const base = t.page.url().split("/3d/")[0];
  await pg.goto(`${base}/3d/?test${Q}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`);
  const P = {
    label, page: pg, errors,
    L: c => pg.evaluate(c),
    game: c => pg.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${c}); })()`),
    async until(c, what, ms = 90000) { if (await waitOn(pg, c, ms)) return true; t.check(`${label}: ${what}`, false, "timed out in " + await pg.evaluate(`JSON.stringify({ st: __lulu3d.state, room: __lulu3d.ctx.mp._debug.room, c: __lulu3d.ctx.mp._debug.connected, peers: Object.keys(__lulu3d.ctx.mp._debug.peers) })`).catch(() => "?")); return false; },
  };
  await P.until(`window.__lulu3d && __lulu3d.state === "title" && ctx.worldClock.flags && ctx.worldClock.flags.place === 1`, "boots (place flag on)");
  return P;
}
const PLACE = s => `(() => { const p = ctx.world.road.point(${s}, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = 1.75; ctx.car.vx = ctx.car.vz = 0; ctx.car.vF = 0; return true; })()`;
async function drive(P, s) {
  await P.game(`L3.startRun({ mode: "cruise", quick: true })`);
  await P.until(`__lulu3d.state === "playing"`, "drives");
  await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.G.invT = 999, ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.banter && (ctx.banter.autopilot = { d: 1.75, speed: 0 }), true)`);
  await P.game(PLACE(s));
}
const MOVE = (P, s) => P.game(`(ctx.banter && (ctx.banter.autopilot = { d: 1.75, speed: 0 }), ${PLACE(s)})`);
const keysOf = P => P.game(`Object.keys(ctx.mp._debug.peers).filter(k => ctx.mp._debug.peers[k].seen)`);

module.exports = {
  name: "worldplace",
  viewport: { width: 480, height: 270 },
  query: "",
  async run(t) {
    setWallCap(8 * 60000);
    process.env.WORLD_PLACE = "1";
    const relay = await startRelay(PORT);
    delete process.env.WORLD_PLACE;
    const pages = [];
    let raw = null;
    try {
      const A = await page(t, "A"); pages.push(A);
      const B = await page(t, "B"); pages.push(B);
      await drive(A, 200); await drive(B, 260);
      t.check("same stretch of road → the same place room", await A.until(`ctx.mp.placeRoom === "WL0" && ctx.mp._debug.connected`, "A in WL0") && await B.until(`ctx.mp.placeRoom === "WL0" && ctx.mp._debug.connected`, "B in WL0"));
      t.check("…and they see each other", await A.until(`Object.values(ctx.mp._debug.peers).some(p => p.seen && p.room === "WL0")`, "A sees B") && await B.until(`Object.values(ctx.mp._debug.peers).some(p => p.seen)`, "B sees A"));
      t.check("the rest of the game still calls it the everyone world", await A.game(`ctx.mp.room`) === "lobby");
      // across the 500 m line
      await MOVE(A, 560); await MOVE(B, 470);
      t.check("A past the line → WL1; B just before it stays in WL0", await A.until(`ctx.mp.placeRoom === "WL1" && ctx.mp._debug.connected`, "A in WL1") && await B.until(`ctx.mp.placeRoom === "WL0"`, "B in WL0"));
      t.check("…they still see each other across the line (each listens next door)", await A.until(`Object.values(ctx.mp._debug.peers).some(p => p.seen && p.room === "WL0")`, "A hears B in WL0", 60000) && await B.until(`Object.values(ctx.mp._debug.peers).some(p => p.seen && p.room === "WL1")`, "B hears A in WL1", 60000));
      const bKey = (await keysOf(A)).find(k => k.startsWith("S:"));
      t.check("A keeps B under B's session tag", !!bKey, JSON.stringify(await keysOf(A)));
      // B crosses into WL1: the same entry on A's screen, never gone
      await A.game(`(window.__gone = 0, window.__watch = setInterval(() => { const p = __lulu3d.ctx.mp._debug.peers[${JSON.stringify(bKey)}]; if (!p || p.left) window.__gone++; }, 50), true)`);
      await MOVE(B, 540);
      t.check("B drives across → B is in WL1 now", await B.until(`ctx.mp.placeRoom === "WL1" && ctx.mp._debug.connected`, "B in WL1"));
      t.check("…on A's screen B is the SAME entry, now heard in WL1", await A.until(`(() => { const p = ctx.mp._debug.peers[${JSON.stringify(bKey)}]; return !!p && p.room === "WL1" && !p.left; })()`, "B moved rooms on A's screen", 60000));
      await framesOn(A.page, 30);
      t.check("…and B never vanished from A's screen while crossing", await A.game(`(clearInterval(window.__watch), window.__gone)`) === 0, await A.game(`window.__gone`));
      t.check("…exactly one entry for B", (await keysOf(A)).filter(k => k.startsWith("S:")).length === 1, JSON.stringify(await keysOf(A)));
      // an old copy of the game in the lobby
      raw = rawOld(URL);
      t.check("A sees an old copy in the lobby (through the bridge)", await A.until(`Object.keys(ctx.mp._debug.peers).some(k => k.startsWith("L:") && ctx.mp._debug.peers[k].seen)`, "A sees the old copy", 60000));
      await framesOn(A.page, 60);
      t.check("…and doesn't see B a second time through the bridge (only the old copy comes in that way)", (await keysOf(A)).filter(k => k.startsWith("L:")).length === 1, JSON.stringify(await keysOf(A)));
      t.check("the old copy sees A and B (once a second, marked as new copies)", await waitFor(() => raw.states.filter(d => d.pl === 1).length >= 4, 30000), raw.states.length);
    } catch (e) {
      t.check("worldplace threw", false, String(e && e.stack || e).slice(0, 500));
    } finally {
      for (const g of pages) { t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).join(" | ").slice(0, 500)); try { await g.page.close(); } catch (e) { } }
      if (raw) raw.close();
      relay.kill();
    }
  },
};
async function waitFor(fn, ms) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await new Promise(r => setTimeout(r, 200)); } return false; }
/** An old-style client in the lobby: no session tag, the old fields only. */
function rawOld(url) {
  const ws = new WebSocket(url + "/room/LOBBY");
  const o = { states: [], close: () => { clearInterval(iv); try { ws.close(); } catch (e) { } } };
  let iv = null;
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: "j", v: 1, room: "LOBBY", name: "Kugel Kid", sk: "gold" }));
    iv = setInterval(() => { try { ws.send(JSON.stringify({ t: "s", d: { m: 0, x: 240, di: 300 * 5, sp: 0, vk: "car" } })); } catch (e) { } }, 300);
  };
  ws.onmessage = e => { try { const m = JSON.parse(e.data); if (m.t === "s") o.states.push(m.d); } catch (x) { } };
  return o;
}
