// Shared helpers for the multi-page 🎉 party tests (scripts/tests3d/party*.js, openworld.js).
//
// waitOn(page, code, ms): wait for `code` (evaluated with L3 = window.__lulu3d, ctx in scope) to be truthy on
// a game page. `ms` is GAME time (a ?test page runs 30 frames per game second, so the budget is ms/1000×30 of
// THAT page's frames), not wall time: a CI runner with 2–3 pages can drop to ~1 fps, and a wait measured with
// Date.now() then failed a correct test ("same code failed twice then passed"). A wall-clock cap (3× ms, at
// least 20 min) still catches a page that has stopped drawing altogether.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FPS = 30;
let WALL_MIN = 20 * 60000;
/** A test can lower the wall-clock floor of every wait (it then fails within minutes when a page stops drawing). */
function setWallCap(ms) { WALL_MIN = ms; }

/** page.evaluate that gives up after `ms` (a hung page would otherwise block the whole test run forever). */
const evalT = (page, code, fallback, ms = 60000) => Promise.race([page.evaluate(code).catch(() => fallback), sleep(ms).then(() => fallback)]);
async function waitOn(page, code, ms = 90000) {
  const frames = () => evalT(page, `window.__lulu3d ? __lulu3d.frames : -1`, -1);
  let f0 = await frames();
  const maxFrames = Math.ceil(ms / 1000 * FPS);
  const cap = Date.now() + Math.max(ms * 3, WALL_MIN);
  for (;;) {
    const ok = await evalT(page, `(() => { try { const L3 = window.__lulu3d, ctx = L3 && L3.ctx; return !!(${code}); } catch (e) { return false; } })()`, false);
    if (ok) return true;
    const f = await frames();
    if (f0 < 0 && f >= 0) f0 = f;                       // (the page booted while we waited: count from here)
    if ((f0 >= 0 && f >= 0 && f - f0 > maxFrames) || Date.now() > cap) return false;
    await sleep(150);
  }
}
/** Wait about `n` frames of `page` (a real-time sleep can be 0 frames or 300 on a CI runner). */
async function framesOn(page, n) {
  const f0 = await page.evaluate(`window.__lulu3d ? __lulu3d.frames : 0`).catch(() => 0);
  const cap = Date.now() + Math.max(60000, n * 2000);
  while (Date.now() < cap) {
    const f = await page.evaluate(`window.__lulu3d ? __lulu3d.frames : 0`).catch(() => 0);
    if (f - f0 >= n) return true;
    await sleep(60);
  }
  return false;
}

/** The LOCAL relay (server/local-relay.js on a private port; never production). → { url, kill() } */
function startRelay(port = 25000 + (process.pid % 20000)) {
  const { spawn } = require("child_process");
  const path = require("path");
  return new Promise((resolve, reject) => {
    const relay = spawn(process.execPath, [path.join(__dirname, "..", "..", "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(port) }), stdio: ["ignore", "pipe", "pipe"] });
    const out = { url: `ws://127.0.0.1:${port}`, kill: () => { try { relay.kill(); } catch (e) { } } };
    let done = false;
    const ok = () => { if (!done) { done = true; resolve(out); } };
    relay.stdout.on("data", d => { if (/listen/i.test(String(d))) ok(); });
    relay.on("error", reject);
    process.on("exit", out.kill);
    setTimeout(ok, 1500);
  });
}
/** A second game page (a friend) in the same browser, opened at …/3d/?test<query>. */
async function guestPage(t, label, save2d, query, viewport = { width: 640, height: 360 }) {
  const browser = t.page.context().browser();
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { const x = m.text(); if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(x)) errors.push(x); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(({ save2d }) => {
    if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify(save2d));
    sessionStorage.setItem("__seeded", "1");
  }, { save2d });
  const base = t.page.url().split("/3d/")[0];
  await page.goto(`${base}/3d/?test${query || ""}`);
  return {
    label, page, errors,
    L: code => page.evaluate(code),
    game: code => page.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`),
    frames: n => framesOn(page, n),
    async until(code, what, ms = 90000) {
      if (await waitOn(page, code, ms)) return true;
      t.check(`${label}: ${what}`, false, "timed out in " + await page.evaluate(`window.__lulu3d && (__lulu3d.state + " @ frame " + __lulu3d.frames)`).catch(() => "?"));
      return false;
    },
  };
}
/** The host page (the test's own page) with the same shape as a guest. */
function hostPage(t) {
  return {
    label: "host", page: t.page, errors: [],
    L: c => t.L(c), game: c => t.game(c), frames: n => t.frames(n),
    async until(code, what, ms = 90000) {
      if (await waitOn(t.page, code, ms)) return true;
      t.check(what, false, "timed out in " + await t.game(`ctx.state + " @ frame " + L3.frames`).catch(() => "?"));
      return false;
    },
  };
}
module.exports = { waitOn, framesOn, sleep, startRelay, guestPage, hostPage, setWallCap };
