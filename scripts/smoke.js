// Headless smoke test for the whole game.
//
//   node scripts/smoke.js            # run it (needs `playwright` + Chromium)
//   node scripts/smoke.js --shots    # also save a screenshot per scene to smoke-shots/
//
// What it does: serves the repo root on a throwaway local port, boots
// index.html in headless Chromium with a FRESH save, then visits every major
// scene through its real entry function (via a test-only hook injected into
// the served copy of game.js — the file on disk is never touched) and mashes
// random taps + keys in each one. It fails on any uncaught page error and on
// any "Lulu frame error" the game loop swallowed (those would otherwise be
// invisible on the live site).
//
// Run it after `node build.js` and before pushing to main.
const http = require("http");
const fs = require("fs");
const path = require("path");

let chromium;
try { ({ chromium } = require("playwright")); }
catch (e) {
  console.error("smoke: the `playwright` package isn't installed.\n" +
    "  npm install --no-save playwright && npx playwright install chromium");
  process.exit(2);
}

const ROOT = path.resolve(__dirname, "..");
const SHOTS = process.argv.includes("--shots");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".mp3": "audio/mpeg",
  ".webmanifest": "application/manifest+json", ".json": "application/json" };

// Expose a direct-eval hook INSIDE the game's IIFE so scenes can be entered
// through their real start functions: window.__lulu("startCookieCatch()").
function instrumentedGameJs() {
  const src = fs.readFileSync(path.join(ROOT, "game.js"), "utf8");
  const close = src.lastIndexOf("})();");
  if (close < 0) throw new Error("smoke: couldn't find the IIFE close in game.js");
  return src.slice(0, close) +
    "    window.__lulu = function (code) { return eval(code); };\n" +
    src.slice(close);
}

function serve() {
  const game = instrumentedGameJs();
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/game.js") { res.writeHead(200, { "Content-Type": MIME[".js"] }); return res.end(game); }
    const file = path.join(ROOT, url === "/" ? "index.html" : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end();
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

// Every scene: [name, setup code evaluated inside the game, seconds to mash].
// Setups start from a fresh save with the tutorial done (except the first).
const SCENES = [
  ["menu (fresh player)",   "state = 'menu'", 2],
  ["story drive + tutorial", "save.tutorialDone = false; runMode = 'story'; resetGame(); state = 'playing'", 6],
  ["menu (veteran)",        "save.cruiseUnlocked = true; state = 'menu'", 3],
  ["cruise drive",          "runMode = 'cruise'; resetGame(); state = 'playing'", 8],
  ["story map",             "save.cruiseUnlocked = true; state = 'storyMap'", 3],
  ["shop",                  "state = 'shop'; shopTab = 'skins'; shopDetail = null", 4],
  ["quests",                "save.lifetimeScore = 300000; state = 'quests'; questScreenT = 0", 3],
  ["pause menu",            "runMode = 'cruise'; resetGame(); prevState = 'playing'; state = 'paused'", 3],
  ["parking minigame",      "runMode = 'cruise'; resetGame(); state = 'playing'; triggerParkingMinigame()", 5],
  ["parking challenge",     "startParkingChallenge()", 5],
  ["avigail porch",         "runMode = 'cruise'; resetGame(); startAvigailScene()", 5],
  ["salon",                 "runMode = 'cruise'; resetGame(); startSalonScene()", 5],
  ["cop bust",              "runMode = 'cruise'; resetGame(); state = 'playing'; startCopBust()", 5],
  ["arrest",                "runMode = 'cruise'; resetGame(); beginArrest(['SPEEDING'])", 5],
  ["jail cell",             "runMode = 'cruise'; resetGame(); goToJail(['SPEEDING'])", 5],
  ["courtroom",             "runMode = 'cruise'; resetGame(); openCourt(['SPEEDING'])", 6],
  ["hospital",              "runMode = 'cruise'; resetGame(); beginHospital('crash')", 5],
  ["on foot",               "runMode = 'cruise'; resetGame(); startFootWorld('carWreck')", 6],
  ["bar",                   "runMode = 'cruise'; resetGame(); startFootWorld('carWreck'); enterFootInterior('bars')", 4],
  ["school",                "runMode = 'cruise'; resetGame(); startFootWorld('carWreck'); enterFootInterior('school')", 4],
  ["hospital lobby",        "runMode = 'cruise'; resetGame(); startFootWorld('carWreck'); enterFootInterior('hospital')", 4],
  ["police precinct",       "runMode = 'cruise'; resetGame(); startFootWorld('carWreck'); enterFootInterior('police')", 4],
  ["beach",                 "runMode = 'cruise'; resetGame(); startFootWorld('carWreck'); enterFootInterior('beach')", 4],
  ["wedding",               "runMode = 'cruise'; resetGame(); startFootWorld('carWreck'); startFootWedding()", 6],
  ["sister picker",         "state = 'charSelect'", 2],
  ["dina bus",              "startDinaMode()", 3],
  ["dina run",              "startDinaMode(); startDinaRun()", 6],
  ["dina bedroom",          "enterDinaHome()", 4],
  ["morgan",                "enterDinaHome(); state = 'dinaMorgan'", 3],
  ["nap",                   "enterDinaHome(); state = 'dinaNap'", 3],
  ["cookie catch",          "save.totalCoins = 500; enterDinaHome(); startCookieCatch()", 5],
  ["sticker book",          "save.totalCoins = 500; enterDinaHome(); startStickerBook()", 4],
  ["random mash from menu", "save.cruiseUnlocked = true; save.totalCoins = 5000; state = 'menu'", 25],
];

// Behavior checks: [name, async fn(page, ev) → throws on failure]. `ev` runs
// code inside the game. Each gets a fresh page + save, like the scenes.
const CHECKS = [
  ["Dina's run coins bank once (no sticker-book farming)", async (page, ev) => {
    await ev("save.totalCoins = 100; dinaCoinsRun = 50; enterDinaHome(); startStickerBook(); enterDinaHome(); enterDinaHome()");
    const c = await ev("save.totalCoins");
    if (c !== 100) throw new Error("coins went 100 → " + c);
  }],
  ["hiding the tab auto-pauses a drive", async (page, ev) => {
    await ev("runMode = 'cruise'; resetGame(); state = 'playing'");
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const st = await ev("state + '/' + prevState");
    if (st !== "paused/playing") throw new Error("state after hide: " + st);
  }],
  ["MUSIC / SOUND toggles survive a reload", async (page, ev) => {
    await ev("runMode = 'cruise'; resetGame(); prevState = 'playing'; state = 'paused'");
    await page.waitForTimeout(200);
    const h2 = (await ev("H")) / 2;   // logical canvas height varies (iPad clamps it)
    const box = await page.locator("#gameCanvas").boundingBox();
    const sy = box.height / (await ev("H"));
    await page.mouse.click(box.x + box.width / 2, box.y + (h2 + 26 + 23) * sy);   // MUSIC row
    await page.waitForTimeout(200);
    await page.mouse.click(box.x + box.width / 2, box.y + (h2 + 74 + 23) * sy);   // SOUND row
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForFunction(() => typeof window.__lulu === "function");
    const m = await ev("musicMuted + '/' + audioMuted");
    if (m !== "true/true") throw new Error("after reload music/sound muted = " + m);
  }],
  ["a corrupted save recovers from the backup", async (page, ev) => {
    await ev("save.totalCoins = 777; persistSave()");
    await page.reload();   // load → snapshots the good save into _bak
    await page.waitForFunction(() => typeof window.__lulu === "function");
    await page.evaluate(() => localStorage.setItem("luluSaveV2", "{not json"));
    await page.reload();
    await page.waitForFunction(() => typeof window.__lulu === "function");
    const c = await ev("save.totalCoins");
    if (c !== 777) throw new Error("coins after corrupt reload: " + c);
    const bad = await page.evaluate(() => localStorage.getItem("luluSaveV2_corrupt"));
    if (bad !== "{not json") throw new Error("corrupt text wasn't parked");
  }],
  ["CALM screen stills shake and softens flashes", async (page, ev) => {
    await ev("save.calmFx = true; runMode = 'cruise'; resetGame(); state = 'playing'; shakeTimer = 1; shakeIntensity = 12");
    await page.waitForTimeout(200);
    const r = await ev("shakeIntensity + '/' + flashA(0.8)");
    if (r !== "0/0.2") throw new Error("shake/flash in calm mode = " + r);
  }],
  ["tablet mode can't leak past the menu", async (page, ev) => {
    await ev("inTabletMode = true; runMode = 'cruise'; resetGame(); state = 'playing'");
    await page.waitForTimeout(200);
    await ev("state = 'menu'");   // e.g. a tablet run that exited via jail → menu
    await page.waitForTimeout(200);
    if (await ev("inTabletMode")) throw new Error("inTabletMode still set on the menu");
  }],
];

const KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "m", "h", "e"];

async function mash(page, seconds, rnd) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const r = rnd();
    if (r < 0.55) await page.mouse.click(Math.floor(rnd() * 480), Math.floor(rnd() * 854));
    else {
      const k = KEYS[Math.floor(rnd() * KEYS.length)];
      await page.keyboard.down(k); await page.waitForTimeout(80 + rnd() * 200); await page.keyboard.up(k);
    }
    // Never pause/quit via keyboard (Escape/P) — random taps already cover menus.
    await page.waitForTimeout(60 + rnd() * 160);
  }
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

(async () => {
  const server = await serve();
  const base = "http://127.0.0.1:" + server.address().port + "/index.html";
  const browser = await chromium.launch();
  if (SHOTS) fs.mkdirSync(path.join(ROOT, "smoke-shots"), { recursive: true });

  const only = process.env.SMOKE_ONLY ? new RegExp(process.env.SMOKE_ONLY, "i") : null;
  const failures = [];

  for (const [name, fn] of CHECKS) {
    if (only && !only.test("check: " + name)) continue;
    const ctx = await browser.newContext({ viewport: { width: 480, height: 854 } });
    const page = await ctx.newPage();
    const ev = code => page.evaluate(c => window.__lulu(c), code);
    let err = null;
    try {
      await page.goto(base);
      await page.waitForFunction(() => typeof window.__lulu === "function", null, { timeout: 15000 });
      await page.mouse.click(5, 840);
      await ev("save.tutorialDone = true; save.mpAutoOff = true");
      await fn(page, ev);
    } catch (e) { err = e.message.split("\n")[0]; }
    console.log((err ? "✗ " : "✓ ") + "check: " + name);
    if (err) { console.log("     " + err); failures.push("check: " + name); }
    await ctx.close();
  }

  for (let i = 0; i < SCENES.length; i++) {
    const [name, setup, secs] = SCENES[i];
    if (only && !only.test(name)) continue;
    const ctx = await browser.newContext({ viewport: { width: 480, height: 854 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", e => errs.push("pageerror: " + (e.stack || e.message).split("\n").slice(0, 3).join(" | ")));
    page.on("console", m => {
      if (m.type() !== "error") return;
      const t = m.text();
      // Network noise (offline relay, missing optional assets) isn't a game bug.
      if (/Failed to load resource|WebSocket|net::ERR_/i.test(t)) return;
      errs.push("console: " + t.slice(0, 300));
    });
    try {
      await page.goto(base);
      await page.waitForFunction(() => typeof window.__lulu === "function", null, { timeout: 15000 });
      await page.mouse.click(5, 840);   // first gesture: unlocks audio (harmless spot)
      await page.evaluate(code => window.__lulu(
        "save.tutorialDone = true; save.mpAutoOff = true; " + code), setup);
      await page.waitForTimeout(400);
      if (SHOTS) await page.screenshot({ path: path.join(ROOT, "smoke-shots", String(i).padStart(2, "0") + "-" + name.replace(/\W+/g, "_") + ".png") });
      await mash(page, secs, seeded(1000 + i));
    } catch (e) {
      errs.push("harness: " + e.message.split("\n")[0]);
    }
    const st = await page.evaluate(() => { try { return window.__lulu("state"); } catch (e) { return "?"; } }).catch(() => "?");
    console.log((errs.length ? "✗ " : "✓ ") + name.padEnd(24) + " (ended in " + st + ")");
    // A broken draw repeats every frame — show each distinct error once.
    const uniq = [...new Set(errs)];
    uniq.slice(0, 5).forEach(e => console.log("     " + e.split("\n").slice(0, 3).join(" | ")));
    if (errs.length > 1) console.log("     (" + errs.length + " errors, " + uniq.length + " distinct)");
    if (errs.length) failures.push(name);
    await ctx.close();
  }
  await browser.close();
  server.close();
  if (failures.length) {
    console.error("\nsmoke: " + failures.length + " failure(s): " + failures.join(", "));
    process.exit(1);
  }
  console.log("\nsmoke: all checks passed and every scene ran clean.");
})();
