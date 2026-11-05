// Headless smoke tests for the 3D version (3d/index.html).
//
//   node scripts/smoke3d.js                           # every test file in scripts/tests3d/
//   SMOKE3D_ONLY=law,garage node scripts/smoke3d.js   # just those (comma list / regex on the file name)
//   node scripts/smoke3d.js --shots                   # also save screenshots to smoke-shots/3d-*.png
//
// Each scripts/tests3d/<name>.js exports { name, async run(t) } and gets a FRESH
// page (headless Chromium, software WebGL via SwiftShader) with a fake,
// scriptable controller plugged in. The game runs at a fixed 1/30 s per frame
// in ?test mode, so wait in FRAMES (t.frames(n)), never in milliseconds.
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
const TESTS = path.join(__dirname, "tests3d");
const SHOTS = process.argv.includes("--shots");
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

async function runFile(browser, base, file) {
  const mod = require(path.join(TESTS, file));
  const name = mod.name || file.replace(/\.js$/, "");
  const page = await browser.newPage({ viewport: mod.viewport || { width: 960, height: 540 }, userAgent: mod.userAgent || undefined, hasTouch: !!mod.hasTouch });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => {
    const txt = m.text();
    if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(txt)) errors.push(txt);
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
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
  const L = code => page.evaluate(code);
  const t = {
    page, L, errors,
    check(label, ok, detail = "") {
      console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? "  (" + detail + ")" : ""}`);
      if (!ok) fails.push(label);
      return ok;
    },
    async frames(n) {
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
    /** Click the first button on the open screen whose text matches. */
    async click(re) {
      const ok = await L(`(() => { const b = [...document.querySelectorAll("#screenCard button, #dialog button, #screenCard .nav")].find(b => ${re}.test(b.textContent)); if (b) b.click(); return !!b; })()`);
      await t.frames(2);
      return ok;
    },
    async shot(label) {
      if (!SHOTS) return;
      fs.mkdirSync(path.join(ROOT, "smoke-shots"), { recursive: true });
      await page.screenshot({ path: path.join(ROOT, "smoke-shots", `3d-${name}-${label}.png`) });
    },
    async boot(query = mod.query || "") {
      await page.goto(`${base}/3d/?test${query}`);
      return t.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots to the title screen", 120000);
    },
  };
  console.log(`▶ ${name}`);
  const t0 = Date.now();
  try {
    if (await t.boot()) await mod.run(t);
  } catch (e) {
    t.check("test threw", false, String(e && e.message || e).slice(0, 300));
  }
  t.check("no page errors", errors.length === 0, errors.slice(0, 3).map(s => s.slice(0, 400)).join(" | "));
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  results.push({ name, fails });
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
  const bad = results.filter(r => r.fails.length);
  if (bad.length) {
    console.log(`\nsmoke3d: FAILED — ${bad.map(r => `${r.name} (${r.fails.join(", ")})`).join("; ")}`);
    process.exit(1);
  }
  console.log(`\nsmoke3d: all ${results.length} test file(s) passed.`);
})().catch(e => { console.error(e); process.exit(1); });
