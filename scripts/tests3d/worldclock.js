// 🌍 ONE SHARED WORLD, steps 1 + 2 (ci/oneserver) — real pages against the LOCAL relay (server/world.mjs is the same code
// the worker runs).
//   CLOCK     page B's own clock is 7 s WRONG (as on a phone set by hand): both pages still agree on the world clock
//             (ctx.worldClock.now()) to within a few ms of the relay's; the relay's kill switches arrive (flags)
//   EVENTS    A sends a reliable event (ctx.mp.event) → B gets it exactly once (mp:event), even if A's retry repeats it;
//             C, who arrives LATER, still gets it (late: true)
//   RESTING   a relay over its free daily allowance → ONE quiet line "Online play is resting until …" and play goes on
const { startRelay, waitOn, framesOn, setWallCap } = require("../lib/party3d.js");
const PORT = 32500 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = u => `&enable=multiplayer,party,openworld,foot,atmos,phone&mpurl=${encodeURIComponent(u)}`;

async function page(t, label, query, skewMs = 0) {
  const browser = t.page.context().browser();
  const pg = await browser.newPage({ viewport: { width: 480, height: 270 } });
  const errors = [];
  pg.on("pageerror", e => errors.push(String(e && e.stack || e)));
  pg.on("console", m => { const x = m.text(); if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(x)) errors.push(x); });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pg.addInitScript(({ skewMs }) => {
    if (skewMs) { const real = Date.now.bind(Date); Date.now = () => real() + skewMs; }
    if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify({ totalCoins: 0, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" }));
    sessionStorage.setItem("__seeded", "1");
  }, { skewMs });
  const base = t.page.url().split("/3d/")[0];
  await pg.goto(`${base}/3d/?test${query}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`);
  const P = {
    label, page: pg, errors,
    L: c => pg.evaluate(c),
    game: c => pg.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${c}); })()`),
    async until(c, what, ms = 90000) { if (await waitOn(pg, c, ms)) return true; t.check(`${label}: ${what}`, false, "timed out"); return false; },
  };
  await P.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots");
  return P;
}
async function drive(P) {
  await P.game(`L3.startRun({ mode: "cruise", quick: true })`);
  await P.until(`__lulu3d.state === "playing"`, "drives");
  await P.game(`(ctx.law && ctx.law.hold && ctx.law.hold(900), ctx.G.invT = 999, ctx.traffic.config.enabled = false, ctx.traffic.clear(), window.__ev = [], L3.on("mp:event", e => window.__ev.push(e)), true)`);
  await P.until(`ctx.mp._debug.connected && ctx.mp._debug.room === "lobby"`, "online");
}

module.exports = {
  name: "worldclock",
  viewport: { width: 480, height: 270 },
  query: "",
  async run(t) {
    setWallCap(8 * 60000);
    const relay = await startRelay(PORT);
    const pages = [];
    let rest = null;
    try {
      const A = await page(t, "A", Q(URL)); pages.push(A);
      const B = await page(t, "B (clock 7 s fast)", Q(URL), 7000); pages.push(B);
      await drive(A); await drive(B);
      t.check("the relay's kill switches arrive", await A.until(`ctx.worldClock.flags && ctx.worldClock.flags.clock === 1 && ctx.worldClock.flags.reliable === 1`, "flags"));
      t.check("both pages measure the world clock", await A.until(`ctx.worldClock.synced && ctx.worldClock.rtt >= 0 && ctx.worldClock.rtt < 1000`, "A synced") && await B.until(`ctx.worldClock.synced`, "B synced"));
      // A's device clock is right (the relay runs on this machine): offset ≈ 0. B's is 7 s fast: offset ≈ −7000.
      await framesOn(B.page, 60);
      const oa = await A.game(`ctx.worldClock.offset`), ob = await B.game(`ctx.worldClock.offset`);
      t.check("A's offset ≈ 0 (its clock is right)", Math.abs(oa) < 60, oa);
      t.check("B's offset ≈ −7 s: its world clock is right although its own clock is wrong", Math.abs(ob + 7000) < 60, ob);
      const wa = await A.game(`ctx.worldClock.now() - performance.timeOrigin - performance.now()`), wb = await B.game(`ctx.worldClock.now() - performance.timeOrigin - performance.now()`);
      t.check("both pages' world time is the real time (within 60 ms)", Math.abs(wa) < 60 && Math.abs(wb) < 60, `${Math.round(wa)} / ${Math.round(wb)}`);

      // ── reliable events ──
      const id = await A.game(`ctx.mp.event("ping", { x: 12, z: 34 })`);
      t.check("A sends a reliable event", typeof id === "string" && id.length > 2, id);
      t.check("B gets it", await B.until(`window.__ev.some(e => e.k === "ping" && e.d && e.d.x === 12)`, "B's event", 30000));
      await A.game(`(ctx.mp._debug.sock.send(JSON.stringify({ t: "r", id: ${JSON.stringify(id)}, k: "ping", d: { x: 12, z: 34 } })), true)`);   // a retry with the same id
      await framesOn(B.page, 30);
      t.check("…exactly once (a repeat with the same id is dropped)", await B.game(`window.__ev.filter(e => e.k === "ping").length`) === 1);
      t.check("…marked as from A, with the relay's time", await B.game(`(() => { const e = window.__ev.find(e => e.k === "ping"); return e.from === ${JSON.stringify(await A.game(`ctx.mp._debug.myId`))} && typeof e.st === "number" && !e.late; })()`));
      t.check("A's send was acknowledged", await A.until(`ctx.mp._debug.relOut.size === 0`, "acked", 20000));
      const C = await page(t, "C (arrives later)", Q(URL)); pages.push(C);
      await drive(C);
      t.check("C, who came later, still gets it (late)", await C.until(`window.__ev.some(e => e.k === "ping" && e.late)`, "C's late event", 30000));

      // ── resting: the relay is over its free daily allowance ──
      process.env.WORLD_RESTING = "1";
      rest = await startRelay(PORT + 1);
      delete process.env.WORLD_RESTING;
      const D = await page(t, "D (resting relay)", Q(`ws://127.0.0.1:${PORT + 1}`)); pages.push(D);
      await D.L(`import("./js/features/multiplayer/worldclock.js").then(m => m.checkResting())`);
      t.check("a resting relay → one quiet line, and she plays on", await D.until(`ctx.worldClock.resting && [...document.querySelectorAll(".toast")].some(e => /resting until/.test(e.textContent))`, "the resting line", 20000));
      t.check("…and it's the only one", await D.game(`[...document.querySelectorAll(".toast")].filter(e => /resting until/.test(e.textContent)).length`) === 1);
    } catch (e) {
      t.check("worldclock threw", false, String(e && e.stack || e).slice(0, 500));
    } finally {
      for (const g of pages) { t.check(`${g.label}: no page errors`, g.errors.length === 0, g.errors.slice(0, 3).join(" | ").slice(0, 500)); try { await g.page.close(); } catch (e) { } }
      relay.kill(); if (rest) rest.kill();
    }
  },
};
