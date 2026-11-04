// Headless smoke test for the 3D version (3d/index.html).
//
//   node scripts/smoke3d.js           # run it (needs `playwright` + Chromium)
//   node scripts/smoke3d.js --shots   # also save screenshots to smoke-shots/3d-*.png
//
// Boots /3d/ in headless Chromium (software WebGL via SwiftShader), plugs in a
// FAKE Xbox controller through navigator.getGamepads(), and actually plays:
// starts from the title menu with A, drives with the trigger + stick, uses
// nitro, switches cameras, crashes into an oncoming car, pauses with Start, and
// drives under Bubbe's arch. Fails on any page error or broken behaviour.
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
const SHOTS = process.argv.includes("--shots");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".json": "application/json" };

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

const fails = [];
function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}`);
  if (!ok) fails.push(name);
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // block the Google Fonts request so the test never depends on the network
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());

  // A fake, scriptable Xbox controller.
  await page.addInitScript(() => {
    const pad = {
      id: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)", index: 0, connected: true,
      mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      vibrationActuator: {
        effects: ["dual-rumble", "trigger-rumble"],
        playEffect(type, p) { (window.__rumbles = window.__rumbles || []).push({ type, s: p.strongMagnitude }); return Promise.resolve("complete"); },
        reset() { return Promise.resolve("complete"); },
      },
    };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
    window.__btn = (i, v) => { pad.buttons[i].value = v; pad.buttons[i].pressed = v > 0.5; };
  });

  const L = code => page.evaluate(code);
  const until = async (code, ms, label) => {
    try { await page.waitForFunction(code, null, { timeout: ms, polling: 100 }); return true; }
    catch (e) {
      const st = await L(`window.__lulu3d ? __lulu3d.state + " @ frame " + __lulu3d.frames : "not booted"`).catch(() => "?");
      check(label, false, "timed out in state " + st); return false;
    }
  };
  // Hold a button until the game has polled it on at least two frames (software
  // WebGL can be slow), then release and let it see the release.
  const frames = () => L(`__lulu3d.frames`);
  const waitFrames = async n => { const f0 = await frames(); await page.waitForFunction(f => __lulu3d.frames >= f, f0 + n, { polling: 16 }); };
  const tap = async i => { await L(`__btn(${i}, 1)`); await waitFrames(2); await L(`__btn(${i}, 0)`); await waitFrames(2); };
  const shot = async name => { if (SHOTS) { fs.mkdirSync(path.join(ROOT, "smoke-shots"), { recursive: true }); await page.screenshot({ path: path.join(ROOT, "smoke-shots", `3d-${name}.png`) }); } };

  const t0 = Date.now();
  await page.goto(`${base}/3d/?test`);
  if (!await until(`window.__lulu3d && __lulu3d.state === "title"`, 90000, "boots to the title screen")) return finish();
  check("boots to the title screen", true);
  await page.waitForTimeout(800);
  check("controller detected on the title screen", await L(`document.querySelector(".pad-status.on") !== null`));
  await shot("title");

  // A on the menu → countdown → driving
  await tap(0);
  if (!await until(`__lulu3d.state === "playing"`, 90000, "A starts the drive (countdown → playing)")) return finish();
  check("A starts the drive (countdown → playing)", true);

  // hold the right trigger, weave with the left stick
  await L(`__btn(7, 1)`);
  const s0 = await L(`__lulu3d.car.s`);
  for (let i = 0; i < 30; i++) {
    await L(`__pad.axes[0] = ${Math.sin(i / 4).toFixed(3)} * 0.5`);
    await waitFrames(3);
  }
  await L(`__pad.axes[0] = 0`);
  const s1 = await L(`__lulu3d.car.s`);
  const mph = await L(`__lulu3d.car.speed * 2.237`);
  check("RT drives the car down the road", s1 - s0 > 40, `${(s1 - s0).toFixed(0)} m, ${mph.toFixed(0)} mph`);
  await shot("chase-cam");

  // nitro
  await L(`__lulu3d.game.boost = 1`);
  await L(`__btn(5, 1)`);
  await waitFrames(4);
  check("RB fires the nitro", await L(`__lulu3d.game.boosting === true`));
  await shot("nitro");
  await L(`__btn(5, 0)`);

  // camera cycle with Y → Lulu's eyes
  await tap(3); await tap(3);
  await waitFrames(8);
  await shot("lulus-eyes");
  await tap(3);

  // head-on crash costs a heart and rumbles the pad
  const h0 = await L(`__lulu3d.game.hearts`);
  await L(`__lulu3d.game.invT = 0; window.__rumbles = []`);
  await L(`(() => { const c = __lulu3d.car; __lulu3d.traffic.add("sedan", c.s + 14, c.d, -1, 22); })()`);
  await waitFrames(40);
  const h1 = await L(`__lulu3d.game.hearts`);
  check("a head-on crash costs a heart", h1 === h0 - 1, `${h0} → ${h1}`);
  check("the crash rumbles the controller", await L(`(window.__rumbles || []).some(r => r.s >= 0.9)`));

  // Start pauses, B resumes
  await tap(9);
  check("Start pauses", await L(`__lulu3d.state === "paused"`));
  await shot("pause");
  await tap(1);
  check("B resumes", await L(`__lulu3d.state === "playing"`));

  // jump ahead to just before Bubbe's and drive under the arch
  await L(`(() => { const L = __lulu3d, r = L.world.road, p = r.point(4800 - 120, 1.75, {});
    L.traffic.clear(); L.game.invT = 99; L.car.place(p.x, p.z, p.h); L.car.s = 4800 - 120; L.car.vx = Math.sin(p.h) * 25; L.car.vz = Math.cos(p.h) * 25; })()`);
  await waitFrames(20);
  await shot("bubbes-house");
  if (await until(`__lulu3d.state === "arriving" || __lulu3d.state === "arrivedScreen"`, 120000, "reaches Bubbe's house")) {
    check("reaches Bubbe's house", true);
    await waitFrames(30);
    await shot("arriving");
    if (await until(`__lulu3d.state === "arrivedScreen"`, 120000, "arrival screen shows")) check("arrival screen shows", true);
    await shot("arrival");
    await L(`__btn(7, 0)`);
    await tap(0); // keep cruising
    check("A on the arrival screen keeps cruising", await L(`__lulu3d.state === "playing" && __lulu3d.game.cruise === true`));
  }

  const fr = await L(`__lulu3d.frames`);
  check("renders frames", fr > 60, `${fr} frames, ~${(fr / ((Date.now() - t0) / 1000)).toFixed(0)} fps in software WebGL`);
  finish();

  async function finish() {
    check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
    await browser.close();
    server.close();
    if (fails.length) { console.log(`\nsmoke3d: ${fails.length} check(s) FAILED`); process.exit(1); }
    console.log("\nsmoke3d: all checks passed.");
  }
})().catch(e => { console.error(e); process.exit(1); });
