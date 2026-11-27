// Headless smoke tests for the 3D version (3d/index.html).
//
//   node scripts/smoke3d.js                           # every test file in scripts/tests3d/
//   SMOKE3D_ONLY=law,garage node scripts/smoke3d.js   # just those (comma list / regex on the file name)
//   node scripts/smoke3d.js --shots                   # also save screenshots to smoke-shots/3d-*.png
//
// Each scripts/tests3d/<name>.js exports { name, async run(t) } and gets a FRESH
// page (headless Chromium, software WebGL via SwiftShader) with a fake,
// scriptable controller plugged in. The game runs at a fixed 1/30 s per frame
// in ?test mode, so wait in FRAMES (t.frames(n)) or on a condition (t.until), never in milliseconds —
// under the fast test clock (below) a real-time sleep is worth a different number of frames.
//
//   SMOKE3D_FAST=0          every file on the old clock (default: the fast test clock, except `fast: false` files)
//   SMOKE3D_PROF=1          a PROF line per file: wall, boot, game frames, draws, ms per game frame
//   SMOKE3D_TIMES=<file>    each file's seconds + pass, as JSON (CI → scripts/durations.js)
//
// Running several test processes at once on a small machine? Serialize them:
//   flock /tmp/lulu3d-browser.lock node scripts/smoke3d.js
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) {
  console.error("smoke3d: the `playwright` package isn't installed.\n" +
    "  npm install --no-save playwright && npx playwright install chromium");
  process.exit(2);
}

const ROOT = path.resolve(__dirname, "..");
const { installVirtualClock } = require("./lib/vclock.js");
const FW = require("./lib/fastwait.js");
const TESTS = path.join(__dirname, "tests3d");
const SHOTS = process.argv.includes("--shots");
const PROF = !!process.env.SMOKE3D_PROF;
// THE FAST TEST CLOCK (3d/js/core/testclock.js): the picture is drawn every 6th frame on a small canvas, the game runs
// a step every browser frame while a test waits (and the old pace between its commands), t.frames / t.until hold
// the game exactly where they stop, and the page's timers follow game time (scripts/lib/vclock.js). Same game time,
// same checks — far fewer draws.
//   ON BY DEFAULT for every file, except a file that says `fast: false` (it measures draws / pictures per frame, or
//   it's `core`, the real-time canary).  SMOKE3D_FAST=0 → every file on the old clock (one draw per 1/30 s step);
//   SMOKE3D_FAST=1 → the same as the default.
const FAST_ENV = process.env.SMOKE3D_FAST;
const FAST_CFG = { every: +process.env.SMOKE3D_FAST_EVERY || 6, scale: +process.env.SMOKE3D_FAST_SCALE || 0.25, anim: +process.env.SMOKE3D_FAST_ANIM || 8 };
const fastFor = mod => mod.fast === false ? false : FAST_ENV !== "0";
const ONLY = process.env.SMOKE3D_ONLY ? new RegExp("^(" + process.env.SMOKE3D_ONLY.split(",").join("|") + ")$") : null;
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".json": "application/json" };

function serve() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url.endsWith("/")) url += "index.html";
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

const results = [];

/** Every page a test file opens (its own + any friend's page via browser.newPage) gets the fast clock when it's on,
 *  and its screenshots draw one full-size frame first. */
function fastPage(page, on) {
  if (!on) return page;
  page.addInitScript(installVirtualClock, FAST_CFG);     // (sets window.__luluFast + the page's game-time clock)
  FW.track(page);
  // CSS transitions / animations run on WALL time: a toast or the phone sliding in took a few game frames on the old
  // clock (~150–280 ms a frame) but ~7× more frames now — a test measured it mid-slide. Play the page's animation
  // timeline faster to match (they still play, and still fire their end events)
  page.context().newCDPSession(page).then(async cdp => {
    await cdp.send("Animation.enable");
    await cdp.send("Animation.setPlaybackRate", { playbackRate: FAST_CFG.anim });
    page.on("framenavigated", f => { if (f === page.mainFrame()) cdp.send("Animation.setPlaybackRate", { playbackRate: FAST_CFG.anim }).catch(() => { }); });
  }).catch(() => { });
  const shot = page.screenshot.bind(page);
  page.screenshot = async (...a) => {
    await page.evaluate(() => window.__lulu3d && window.__lulu3d.realFrame && window.__lulu3d.realFrame()).catch(() => { });
    try { return await shot(...a); } finally { await page.evaluate(() => window.__lulu3d && window.__lulu3d.afterShot && window.__lulu3d.afterShot()).catch(() => { }); }
  };
  return page;
}

async function runFile(browser, base, file) {
  const mod = require(path.join(TESTS, file));
  const name = mod.name || file.replace(/\.js$/, "");
  const FAST = fastFor(mod);
  const page = fastPage(await browser.newPage({ viewport: mod.viewport || { width: 960, height: 540 }, userAgent: mod.userAgent || undefined, hasTouch: !!mod.hasTouch }), FAST);
  const newPage0 = browser.newPage;
  browser.newPage = async (...a) => fastPage(await newPage0.apply(browser, a), FAST);
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => {
    const txt = m.text();
    if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(txt)) errors.push(txt);
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  if (PROF) await page.addInitScript(() => {
    // SMOKE3D_PROF: where a test's wall time goes — each rAF callback's JS time, the renderer.render share of it
    // (wrapped once ctx.renderer exists), and the gap between callbacks (the browser presenting / the GPU process)
    const P = window.__prof = { n: 0, cb: 0, render: 0, gap: 0, last: 0, rn: 0 };
    const pnow = () => (window.__luluRealNow || performance.now.bind(performance))();
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = fn => raf(ts => {
      const a = pnow();
      if (P.last) P.gap += a - P.last;
      const L3 = window.__lulu3d, r = L3 && L3.ctx && L3.ctx.renderer;
      if (r && !r.__profWrapped) { const orig = r.render; r.render = function (...x) { const b = pnow(); try { return orig.apply(this, x); } finally { P.render += pnow() - b; P.rn++; } }; r.__profWrapped = true; }
      try { fn(ts); } finally { const e = pnow(); P.cb += e - a; P.n++; P.last = e; }
    });
  });
  await page.addInitScript(({ padId, save2d, save3d }) => {
    if (save2d && !sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify(save2d));
    if (save3d && !sessionStorage.getItem("__seeded")) localStorage.setItem("lulu3dSave", JSON.stringify(save3d));
    sessionStorage.setItem("__seeded", "1");
    const pad = {
      id: padId, index: 0, connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 18 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: {
        effects: ["dual-rumble", "trigger-rumble"],
        playEffect(type, p) { (window.__rumbles = window.__rumbles || []).push({ type, s: p.strongMagnitude }); return Promise.resolve("complete"); },
        reset() { return Promise.resolve("complete"); },
      },
    };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
    window.__btn = (i, v) => { pad.buttons[i].value = v; pad.buttons[i].pressed = v > 0.5; };
  }, { padId: mod.padId || "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", save2d: mod.save2d || null, save3d: mod.save3d || null });

  const fails = [];
  let bootS = 0;
  const L = code => page.evaluate(code);
  /** Fast clock (scripts/lib/fastwait.js): a gate in the game — true (hit) · false (gave up) · null (poll instead). */
  const gate = (spec, maxFrames, wallCap) => FW.gateWait(page, spec, maxFrames, wallCap);
  const t = {
    page, L, errors,
    check(label, ok, detail = "") {
      console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? "  (" + detail + ")" : ""}`);
      if (!ok) fails.push(label);
      return ok;
    },
    async frames(n) {
      if (FAST && (n | 0) <= 0) return;
      if (FAST && await gate(`{ frames: ${n | 0} }`)) return;
      const f0 = await L(`__lulu3d.frames`);
      await page.waitForFunction(f => window.__lulu3d.frames >= f, f0 + n, { polling: 16, timeout: 30 * 60000 });
    },
    /** Wait for an expression to become truthy. `timeout` is GAME time in ms (test mode runs
     *  30 frames per game second), so a busy CPU can't fail a correct test; a wall-clock cap
     *  (30 min, or 3× timeout before the game has booted) still catches real hangs. */
    async until(code, label, timeout = 90000) {
      const frames = () => L(`window.__lulu3d ? __lulu3d.frames : -1`).catch(() => -1);
      const f0 = await frames();
      const maxFrames = Math.ceil(timeout / 1000 * 30);
      const wallCap = Date.now() + (f0 < 0 ? timeout * 3 : Math.max(timeout * 3, 30 * 60000));
      // (fast clock: the game itself checks the condition after every step and holds at the first true one)
      if (FAST && f0 >= 0) { const r = await gate(`{ code: ${JSON.stringify(code)}, scope: false }`, maxFrames, wallCap); if (r === true) return true; }
      for (;;) {
        const ok = await L(`(() => { try { return !!(${code}); } catch (e) { return false; } })()`).catch(() => false);
        if (ok) return true;
        const f = await frames();
        if ((f0 >= 0 && f >= 0 && f - f0 > maxFrames) || Date.now() > wallCap) break;
        await page.waitForTimeout(100);
      }
      const st = await L(`window.__lulu3d ? __lulu3d.state + " @ frame " + __lulu3d.frames : "not booted"`).catch(() => "?");
      t.check(label, false, "timed out in state " + st);
      return false;
    },
    /** Hold a pad button for 2 frames, release, wait 2 frames.
     *  0 A/✕ 1 B/○ 2 X/□ 3 Y/△ 4 LB/L1 5 RB/R1 6 LT/L2 7 RT/R2 8 View/Share 9 Start/Options 10 L3 11 R3 12-15 D-pad ↑↓←→ 17 touchpad */
    async tap(i) { await L(`__btn(${i}, 1)`); await t.frames(2); await L(`__btn(${i}, 0)`); await t.frames(2); },
    async hold(i, v = 1) { await L(`__btn(${i}, ${v})`); },
    async stick(x, y = 0) { await L(`(__pad.axes[0] = ${x}, __pad.axes[1] = ${y})`); },
    async key(k) { await page.keyboard.press(k); await t.frames(2); },
    /** Evaluate an expression inside the game: t.game("ctx.G.hearts"). `ctx` and `L3` (= window.__lulu3d) are in scope. */
    game: code => L(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`),
    /** Click the first button on the open screen whose text matches. A title item tucked into
     *  a sub-menu (🚗 Garage, 📒 Scrapbook, ⚙️ More…) is revealed first; the group tiles
     *  themselves only match when nothing else does. */
    async click(re) {
      const find = groups => `[...document.querySelectorAll("#screenCard button, #dialog button, #screenCard .nav")].find(b => ${groups ? "true" : "!b.dataset.groupTile"} && ${re}.test(b.textContent))`;
      const tryClick = groups => L(`(() => { const b = ${find(groups)}; if (b) b.click(); return !!b; })()`);
      let ok = await tryClick(false);
      if (!ok && await L(`!!(window.__lulu3d && __lulu3d.revealMenuItem && __lulu3d.revealMenuItem("title", ${re}))`)) ok = await tryClick(false);
      if (!ok) ok = await tryClick(true);
      await t.frames(2);
      return ok;
    },
    /** Every title item (any group), as plain text — for "the title lists X" checks. */
    titleItems: () => L(`window.__lulu3d && __lulu3d.titleLabels ? __lulu3d.titleLabels().map(i => i.label) : []`),
    async shot(label) {
      if (!SHOTS) return;
      fs.mkdirSync(path.join(ROOT, "smoke-shots"), { recursive: true });
      await page.screenshot({ path: path.join(ROOT, "smoke-shots", `3d-${name}-${label}.png`) });
    },
    async boot(query = mod.query || "") {
      // The game follows the REAL calendar (Erev Shabbos asks for the rush at the door, holidays dress the town), so a test
      // run on a Friday afternoon / during Chanukah saw a different game. Pin an ordinary Monday unless the test says otherwise
      // (a test that wants a Friday sets ctx.shabbos.debug.date(...) / its own ?shabbosDate= / ?season=).
      if (!/[?&]shabbosDate=/.test(query)) query += "&shabbosDate=2026-11-16T15:00";
      if (!/[?&]season(Date)?=/.test(query)) query += "&seasonDate=2026-11-16T12:00";
      // Random incoming calls are PAUSED in the game (ctx.phone.randomCalls, off by default); the tests that wait for one
      // run with them on — a test that checks the paused behaviour (nocalls, calls) says &randomCalls=0 itself.
      if (!/[?&]randomCalls=/.test(query)) query += "&randomCalls=1";
      const b0 = Date.now();
      await page.goto(`${base}/3d/?test${query}`);
      const ok = await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots to the title screen", 120000);
      bootS += (Date.now() - b0) / 1000;
      return ok;
    },
  };
  console.log(`▶ ${name}${FAST ? "  (fast clock)" : ""}`);
  const t0 = Date.now();
  try {
    if (await t.boot()) await mod.run(t);
  } catch (e) {
    t.check("test threw", false, String(e && e.message || e).slice(0, 300));
  }
  t.check("no page errors", errors.length === 0, errors.slice(0, 3).map(s => s.slice(0, 400)).join(" | "));
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (PROF) {
    const P = await page.evaluate(() => window.__prof).catch(() => null);
    if (P) {
      const wall = (Date.now() - t0) / 1000, s = ms => (ms / 1000).toFixed(1);
      const gf = await page.evaluate(() => window.__lulu3d ? window.__lulu3d.frames : 0).catch(() => 0);
      const line = { name, wall: +wall.toFixed(1), boot: +bootS.toFixed(1), gameFrames: gf, msPerGameFrame: +(gf ? (wall - bootS) * 1000 / gf : 0).toFixed(1), rafs: P.n, renders: P.rn, cbS: +s(P.cb), renderS: +s(P.render), gapS: +s(P.gap),
        msPerFrame: +(P.n ? (P.cb + P.gap) / P.n : 0).toFixed(1), jsPerFrame: +(P.n ? P.cb / P.n : 0).toFixed(1), renderPerFrame: +(P.rn ? P.render / P.rn : 0).toFixed(1) };
      console.log("  PROF " + JSON.stringify(line));
    }
  }
  results.push({ name, fails, s: Math.round((Date.now() - t0) / 1000), fast: FAST });
  browser.newPage = newPage0;
  await page.close();
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const files = fs.readdirSync(TESTS).filter(f => f.endsWith(".js"))
    .sort((a, b) => (a !== "core.js") - (b !== "core.js") || a.localeCompare(b))
    .filter(f => !ONLY || ONLY.test(f.replace(/\.js$/, "")));
  for (const f of files) await runFile(browser, base, f);
  await browser.close();
  server.close();
  // (SMOKE3D_TIMES=<file>: each file's wall time + clock + pass, for scripts/durations.js — CI uploads it)
  if (process.env.SMOKE3D_TIMES) {
    fs.mkdirSync(path.dirname(path.resolve(process.env.SMOKE3D_TIMES)), { recursive: true });
    fs.writeFileSync(process.env.SMOKE3D_TIMES, JSON.stringify(results.map(r => ({ name: r.name, s: r.s, clock: r.fast ? "fast" : "slow", pass: !r.fails.length, fails: r.fails })), null, 1));
  }
  const bad = results.filter(r => r.fails.length);
  if (bad.length) {
    console.log(`\nsmoke3d: FAILED — ${bad.map(r => `${r.name} (${r.fails.join(", ")})`).join("; ")}`);
    process.exit(1);
  }
  console.log(`\nsmoke3d: all ${results.length} test file(s) passed.`);
})().catch(e => { console.error(e); process.exit(1); });
