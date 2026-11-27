// Look test (ci/looktest): a tiny harness that boots the 3D game in headless Chromium, puts Lulu somewhere, fixes
// the time of day and photographs it from a camera WE choose — so a "before" (no flag) and an "after" (?look=2)
// picture are taken from exactly the same spot. Used by scripts/looktest/*.js; nothing in the game depends on it.
const http = require("http");
const fs = require("fs");
const path = require("path");
let chromium;
try { ({ chromium } = require("playwright")); } catch (e) { console.error("needs playwright (NODE_PATH=/opt/node-tools/node_modules)"); process.exit(2); }

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "3d", "docs", "looktest");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".json": "application/json", ".hdr": "application/octet-stream" };

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

const SETTINGS = q => ({ quality: q, vibration: true, invertLook: false, steerSens: 1, calm: true, tv: "off", hud: 1, hudMode: "full", chatter: "quiet" });

/** Seeded Math.random (same road events / traffic in the before and the after) — installed before the game loads. */
const SEED = `(() => { let a = 1234567; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })()`;

async function open({ query = "", quality = "medium", viewport = { width: 1280, height: 720 }, scale = 2, video = null } = {}) {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, recordVideo: video ? { dir: video, size: viewport } : undefined });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.stack || e)));
  page.on("console", m => { if (m.type() === "error" && !/fonts\.g|ERR_|Failed to load resource|net::/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.addInitScript(SEED);
  await page.addInitScript(({ s2, s3 }) => {
    if (!sessionStorage.getItem("__seeded")) { localStorage.setItem("luluSaveV2", JSON.stringify(s2)); localStorage.setItem("lulu3dSave", JSON.stringify(s3)); }
    sessionStorage.setItem("__seeded", "1");
  }, { s2: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink" },
       s3: { best: 1000, settings: SETTINGS(quality), music: false, sound: false, f: { meta: { tutorialDone: true } } } });
  const L = code => page.evaluate(code);
  const g = code => L(`(() => { const L3 = __lulu3d, ctx = L3.ctx; return ${code}; })()`);
  const frames = async n => { const f0 = await L(`__lulu3d.frames`); await page.waitForFunction(f => window.__lulu3d.frames >= f, f0 + n, { polling: 16, timeout: 20 * 60000 }); };
  const until = async (code, label, ms = 180000) => {
    const t0 = Date.now();
    for (;;) {
      if (await L(`(() => { try { return !!(${code}); } catch (e) { return false; } })()`).catch(() => false)) return true;
      if (Date.now() - t0 > ms) throw new Error("timed out: " + label);
      await page.waitForTimeout(150);
    }
  };
  const q = `&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00&randomCalls=0&enable=atmos,town,world,homes,life,feel,foot,interiors,bloom${query}`;
  await page.goto(`${base}/3d/?test${q}`);
  await until(`window.__lulu3d && __lulu3d.state === "title"`, "boot", 240000);
  return {
    page, L, g, frames, until, errors, base,
    async close() { await context.close(); await browser.close(); server.close(); },
  };
}

/** Into Midwood, on a street, stopped. place = [street, metres along, lateral offset]. */
async function toMidwood(s, [street, along, d] = ["Avenue J", 120, 1.75]) {
  await s.g(`L3.startRun({ mode: "cruise", quick: true })`);
  await s.frames(5);
  await s.g(`(ctx.town.load("midwood"), true)`);
  await s.until(`__lulu3d.ctx.town.loaded("midwood")`, "midwood models", 240000);
  await s.g(`ctx.town.enter({ town: "midwood", speed: 0 })`);
  await s.until(`__lulu3d.ctx.town.active`, "into midwood");
  await s.until(`!__lulu3d.ctx.town.transitioning`, "fade");
  await s.g(`ctx.town.debug.place(${JSON.stringify(street)}, ${along}, ${d}, 0, 1)`);
  await s.frames(20);
}

/** Fix the time of day (atmos' clock: noon, golden, sunset, dusk, night…) and freeze it. */
async function timeOfDay(s, name) {
  await s.g(`(ctx.atmos.debug.time(${JSON.stringify(name)}), ctx.atmos.debug.freeze(true), ctx.atmos.debug.weather && ctx.atmos.debug.weather("clear", 0, true), true)`);
  await s.frames(30);
}

/** Our camera: every frame, right before the draw (the "prerender" hook), the game camera is put here.
 *  pos / look are relative to the car (x right, z forward in the car's frame) unless world: true. */
async function pinCamera(s, { pos, look, fov = 50, world = false, follow = "car", hideCar = false }) {
  await s.L(`import("/3d/js/core/ctx.js").then(m => {
    const L3 = __lulu3d, c = L3.ctx;
    if (window.__lookPin) window.__lookPin.off = true;
    const P = window.__lookPin = { pos: ${JSON.stringify(pos)}, look: ${JSON.stringify(look)}, fov: ${fov}, world: ${world}, follow: ${JSON.stringify(follow)}, hideCar: ${hideCar}, off: false };
    m.hook("prerender", (dt, cam) => {
      if (P.off) return;
      if (P.hideCar && c.car && c.car.obj) c.car.obj.visible = false;
      let ox = 0, oz = 0, h = 0;
      if (!P.world) {
        const who = P.follow === "foot" && c.foot && c.foot.obj ? c.foot.obj : null;
        if (who) { ox = who.position.x; oz = who.position.z; h = P.heading != null ? P.heading : (P.h0 != null ? P.h0 : (P.h0 = who.rotation.y)); }
        else { ox = c.car.pos.x; oz = c.car.pos.z; h = c.car.h; }
      }
      const tf = (v) => { const s = Math.sin(h), co = Math.cos(h); return [ox + v[0] * co + v[2] * s, v[1], oz - v[0] * s + v[2] * co]; };
      const p = P.world ? P.pos : tf(P.pos), l = P.world ? P.look : tf(P.look);
      cam.position.set(p[0], p[1], p[2]); cam.lookAt(l[0], l[1], l[2]);
      if (cam.fov !== P.fov) { cam.fov = P.fov; cam.updateProjectionMatrix(); }
      cam.updateMatrixWorld();
    }, 100);
  })`);
  await s.frames(3);
}

/** Hide the HUD / touch chrome for a clean picture. */
async function clean(s) {
  await s.page.addStyleTag({ content: `#hud, .hud, #touch, #toasts, .toast, #objective, #padHint, #minimap, .chip, #notify, #phoneBtn, .touch, #pauseBtn { display: none !important; visibility: hidden !important; }` });
}

/** What the renderer drew in the last frame (draw calls, triangles) + the WebGL memory counts. */
async function info(s) {
  return s.g(`(() => { const r = L3.renderer; r.info.autoReset = true; return { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures, progs: (r.info.programs || []).length, tier: L3.gfx.tier, pr: L3.gfx.pixelRatio }; })()`);
}

async function shot(s, file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await s.page.screenshot({ path: file, type: file.endsWith(".jpg") ? "jpeg" : "png", quality: file.endsWith(".jpg") ? 88 : undefined });
  console.log("  saved", path.relative(ROOT, file));
}

module.exports = { open, toMidwood, timeOfDay, pinCamera, clean, info, shot, OUT, ROOT };
