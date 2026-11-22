// App Store screenshots — REAL in-game frames of Lulu's Road Trip 2.0 (the 3D game in 3d/).
//
//   NODE_PATH=/opt/node-tools/node_modules node store/make-screenshots.js
//   SHOT_SCENES=01,04 SHOT_DEVICES=phone node store/make-screenshots.js     # just some
//
// Boots 3d/?test (deterministic, no debug UI) in headless Chromium with software WebGL, drives each scene
// through the game's own test hooks (window.__lulu3d — the same ones scripts/tests3d/*.js use), and saves
//   store/screenshots/<iphone-6.9|iphone-6.5|ipad-13>/<NN-scene>-<portrait|landscape>.png (then converted to .jpg q90 for the store folder — see CAPTIONS.md)
// at the exact App Store sizes (viewport × deviceScaleFactor). Phones + iPad are emulated with touch, so the HUD
// is the touch layout a player sees. The scene is set up at a low resolution (fast), then rendered once at the
// full device pixel ratio for the shot. Transient pop-ups (toasts, first-run coach hints) are hidden for the shot.
// ?test keeps the JFK airport off (`enable=all` doesn't include it); only the airport scene switches it on, as the shipping game has it.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(__dirname, "screenshots");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".json": "application/json" };
const RELAY_PORT = 27000 + (process.pid % 2000);
// an ordinary weekday afternoon (no holiday / Friday overlays), every random feature ON (busy streets) — never the airport
const QUERY = "?test&enable=all&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00&mpurl=" + encodeURIComponent(`ws://127.0.0.1:${RELAY_PORT}`);
const SAVE2D = { totalCoins: 2480, cruiseUnlocked: true, cruisePlayed: true, ownedSkins: ["pink", "gold"], selectedSkin: "pink", mpName: "Kugel Kid" };
const SAVE3D = { settings: { quality: "high" }, f: { meta: { tutorialDone: true } } };

const DEVICES = {
  phone: {
    ctx: { deviceScaleFactor: 3, hasTouch: true, isMobile: true,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
    sizes: [["iphone-6.9", 440, 956], ["iphone-6.5", 414, 896]],
  },
  ipad: {
    ctx: { deviceScaleFactor: 2, hasTouch: true, isMobile: true,
      userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" },
    sizes: [["ipad-13", 1032, 1376]],
  },
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

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

// ── a game page + helpers ──────────────────────────────────────────────────
async function openGame(context, base, extra = "", enable = "all") {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e && e.message || e)));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(base + "/3d/" + QUERY.replace("enable=all", "enable=" + enable) + extra);
  await page.waitForFunction(() => window.__lulu3d && __lulu3d.state === "title", null, { timeout: 600000 });
  const P = {
    page, errors,
    g: code => page.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`),
    async frames(n) {
      const f0 = await page.evaluate(`__lulu3d.frames`);
      await page.waitForFunction(f => window.__lulu3d.frames >= f, f0 + n, { polling: 50, timeout: 1800000 });
    },
    async until(code, ms = 600000) {
      try { await page.waitForFunction(`(() => { try { const L3 = window.__lulu3d, ctx = L3.ctx; return !!(${code}); } catch (e) { return false; } })()`, null, { polling: 100, timeout: ms }); return true; }
      catch (e) { throw new Error("timed out waiting for: " + code + " (state " + await page.evaluate(`__lulu3d.state`).catch(() => "?") + ")"); }
    },
    /** The render resolution (the game's HIGH tier pixel-ratio cap, at runtime — the code on disk is untouched). */
    pr: v => page.evaluate(v => import("./js/core/quality.js").then(m => { m.TIERS.high.pr = v; m.TIERS.high.prMin = Math.min(v, 0.8); __lulu3d.ctx.applySettings(); return __lulu3d.gfx.pixelRatio; }), v),
    touch: () => page.evaluate(() => { window.dispatchEvent(new Event("touchstart")); return true; }),
    /** Hide what a store shot shouldn't freeze: toasts, the first-run coach hints. */
    clean: (opts = {}) => page.evaluate(opts => {
      let st = document.getElementById("__shotcss");
      if (!st) { st = document.createElement("style"); st.id = "__shotcss"; document.head.appendChild(st); }
      st.textContent = "#toasts, #padHint, .meta-streak { visibility: hidden !important; }" + (opts.banner ? " #banner { visibility: hidden !important; }" : "");
      for (const e of document.querySelectorAll("#slot-bottom .prompt")) e.style.visibility = /tap JUMP|Drag the|hold it|Stick to dodge/.test(e.textContent) ? "hidden" : "";
      return true;
    }, opts),
    /** On foot: put her at (x, z) — her road coords too (foot's safety net would pull her back otherwise). */
    place: (x, z) => page.evaluate(`(() => { const ctx = __lulu3d.ctx, F = ctx.foot.debug.F, n = ctx.world.road.nearest(${x}, ${z}, F.s, {}); F.pos.set(${x}, 0.05, ${z}); F.s = n.s; F.d = n.d; F.vel.set(0, 0, 0); return true; })()`),
    /** The free camera on foot: look along `yaw` (and leave it there). */
    look: (yaw, pitch = null) => page.evaluate(`(() => { const ctx = __lulu3d.ctx; ctx.cam.free.yaw = ${yaw}; ${pitch != null ? `ctx.cam.free.pitch = ${pitch};` : ""} ctx.cam.free.idle = -1e6; ctx.foot.obj.rotation.y = ${yaw}; return true; })()`),
    hand: () => page.evaluate(() => { const b = document.getElementById("tx_foot_hand"); b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); setTimeout(() => b.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })), 200); return true; }),
    sky: () => page.evaluate(`(() => { const a = __lulu3d.ctx.atmos; a.debug.time("afternoon"); a.debug.freeze(true); a.debug.weather("clear"); return true; })()`),
  };
  await P.touch();
  await P.pr(0.5);
  return P;
}
// a town spot's frame: a metres along its street (u), b metres out toward the street (n)
const at = (sp, a, b) => ({ x: sp.x + sp.ux * a + sp.nx * b, z: sp.z + sp.uz * a + sp.nz * b });
const yawAt = (sp, a, b) => Math.atan2(sp.ux * a + sp.nx * b, sp.uz * a + sp.nz * b);

async function play(P) {
  await P.page.evaluate(() => document.getElementById("play").click());
  await P.until(`L3.state === "footRun" && ctx.foot.phase === "walk"`);
  await P.sky();
}
async function cruise(P) {
  await P.g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
  await P.until(`L3.state === "playing"`);
  await P.sky();
}
async function town(P, id, exitS = null) {
  await P.g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.load("${id}"), true)`);
  await P.until(`ctx.town.loaded("${id}")`);
  await P.g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${id}", speed: 0${exitS ? `, exitS: ctx.town.exitOf("${id}")` : ""} }), true)`);
  await P.until(`ctx.town.active && ctx.town.id === "${id}"`);
  await P.frames(20);
}
async function onFoot(P) {
  await P.g(`(ctx.foot.start("droveOff", { noIntro: true }), true)`);
  await P.until(`L3.state === "footRun" && ctx.foot.phase === "walk"`);
}

// ── the scenes: setup(P) once, then frame(P) before each shot (after a resize) ─────────────
const SCENES = [
  { id: "01-home", caption: "Start at home — the whole world is yours",
    async setup(P) { await play(P); await P.frames(30); },
    async frame(P) {
      await P.place(-13.25 + 1.6, 29.4 - 1.3);
      await P.look(-0.78);
      await P.frames(14);
    } },
  { id: "02-highway", caption: "Hit the highway in Lulu's pink convertible",
    async setup(P) { await cruise(P); await P.g(`(ctx.atmos.debug.cruise(26), true)`); await P.frames(150); },
    async frame(P) {
      await P.g(`(() => { const T = ctx.traffic, s = ctx.car.s; T.clear();
        T.add("sedan", s + 4, 5.25, 1, 26.4); T.add("van", s + 15, 1.75, 1, 25.2); T.add("streets_sports", s + 24, 5.25, 1, 25.6);
        T.add("truck", s + 42, 1.75, 1, 24); T.add("truck", s + 85, -1.75, -1, 18); T.add("sedan", s + 60, -5.25, -1, 20);
        T.add("van", s + 140, -1.75, -1, 19); T.add("sedan", s + 70, 5.25, 1, 23); return true; })()`);
      await P.frames(5);
    },
    clean: { banner: true } },     // (the 📱 phone's first-drive tip card)
  { id: "03-town", caption: "Walk the streets of Midwood",
    async setup(P) {
      await cruise(P); await town(P, "midwood"); await onFoot(P);
      P.sp = await P.g(`ctx.town.spot("bakery")`);
      const c = at(P.sp, -60, 8);
      await P.g(`(ctx.car.place(${c.x}, ${c.z}, ${yawAt(P.sp, 1, 0)}), true)`);     // (her own car: out of the picture)
    },
    async frame(P, orient) {
      const L = at(P.sp, -4, 2.6);
      await P.place(L.x, L.z);
      await P.look(orient === "portrait" ? yawAt(P.sp, -0.55, -0.83) : yawAt(P.sp, -0.825, -0.565));
      await P.frames(16);
    } },
  { id: "04-car-lot", caption: "Pick your next ride at Uncle Refael's",
    async setup(P) {
      await cruise(P); await town(P, "midwood"); await onFoot(P);
      const sp = await P.g(`ctx.town.spot("lot_red")`), d = await P.g(`ctx.town.spot("dealer")`);
      const c = at(d, 40, 12);
      await P.g(`(ctx.car.place(${c.x}, ${c.z}, 0), true)`);
      const L = at(sp, 0, 1.0);
      await P.place(L.x, L.z); await P.frames(6);
      if (!await P.g(`ctx.shops.debug.dealer.openLot("red")`)) throw new Error("the lot card didn't open");
      await P.frames(50);
    },
    async frame(P) { await P.frames(12); } },
  { id: "05-friends", caption: "Play with friends in the same world",
    async setup(P, env) {
      await P.g(`(ctx.party.hostParty(), true)`);
      await P.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`);
      const code = await P.g(`ctx.party.code`);
      const gc = env.guestCtx = await env.browser.newContext({ viewport: { width: 480, height: 270 } });
      await gc.addInitScript(() => {
        if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify({ totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }));
        sessionStorage.setItem("__seeded", "1");
      });
      const Q = P.guest = await openGame(gc, env.base, "&party=" + code);
      await Q.until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`);
      await P.until(`ctx.party.players.length === 2`);
      await P.g(`ctx.party._debug.start("roam")`);
      for (const X of [P, Q]) await X.until(`ctx.state === "playing" && ctx.party.activity.k === "roam"`);
      // one sky for the shot (the party's shared clock would pick its own)
      for (const X of [P, Q]) await X.g(`(ctx.party.atmosClock = () => 0.3, ctx.party.atmosWeather = () => ({ kind: "clear", strength: 0 }), ctx.atmos.debug.weather("clear"), ctx.hustle.hold(900), true)`);
      for (const X of [P, Q]) await X.g(`(ctx.town.load("midwood"), true)`);
      for (const X of [P, Q]) await X.until(`ctx.town.loaded("midwood")`);
      for (const X of [P, Q]) await X.g(`ctx.town.enter({ town: "midwood", exitS: ctx.town.exitOf("midwood"), speed: 0 })`);
      for (const X of [P, Q]) await X.until(`ctx.town.active && ctx.openworld.zone === "midwood"`);
      for (const X of [P, Q]) await X.g(`(ctx.foot.start("droveOff", { noIntro: true }), true)`);
      for (const X of [P, Q]) await X.until(`L3.state === "footRun" && ctx.foot.phase === "walk"`);
      P.sp = await P.g(`ctx.town.spot("bakery")`);
    },
    async frame(P) {
      const sp = P.sp, y = yawAt(sp, -0.825, -0.565) + 0.25, L = at(sp, -11, 2.4);
      const fx = Math.sin(y), fz = Math.cos(y), rx = -fz, rz = fx, gy = y + Math.PI - 0.5;
      await P.place(L.x, L.z);
      await P.guest.place(L.x + rx * 1.3 + fx * 0.7, L.z + rz * 1.3 + fz * 0.7);
      await P.guest.g(`(ctx.foot.obj.rotation.y = ${gy}, ctx.foot.debug.F.yaw = ${gy}, ctx.foot.debug.F.h = ${gy}, true)`);
      await sleep(4000);
      await P.look(y);
      await P.frames(20);
      // she waves, her friend dances
      await P.guest.page.evaluate(() => import("./js/features/party/emotes.js").then(m => m.play(4)));
      await sleep(1500);
      await P.page.evaluate(() => import("./js/features/party/emotes.js").then(m => m.play(0)));
      await P.frames(10);
    },
    async teardown(P, env) { try { await P.guest.page.close(); } catch (e) { } try { await env.guestCtx.close(); } catch (e) { } } },
  { id: "06-house", caption: "Hang out at home with Ima and Dina",
    async setup(P) {
      await play(P);
      const door = await P.g(`ctx.decor.debug.spotAt("door")`);
      await P.g(`(ctx.foot.pos.set(${door.x}, 0.05, ${door.z}), ctx.foot.obj.position.copy(ctx.foot.pos), true)`);
      await P.frames(3);
      await P.until(`ctx.interiors.luluHome.ready()`);
      await P.hand();
      await P.until(`L3.state === "interior" && window.__interiors.room && window.__interiors.room.ready`);
      await P.frames(150);
    },
    async frame(P) {
      await P.g(`(() => { const r = window.__interiors.room, p = r.byId.ima.p, o = (p.obj || p).position; const L = r.lulu.obj; L.position.set(o.x + 1.1, 0, o.z + 0.6); L.rotation.y = -2.2; return true; })()`);
      await P.frames(30);
    },
    clean: { banner: true } },
  { id: "07-courtroom", caption: "Have your day in court (Courtroom 2B)",
    async setup(P) {
      await cruise(P);
      await P.g(`(ctx.civic.courts.debug.reset(), true)`);
      await town(P, "lakewood");
      await P.g(`(() => { const sp = ctx.civic.spot("court"), car = ctx.car, x = sp.x + sp.nx * 6, z = sp.z + sp.nz * 6; car.place(x, z, Math.atan2(sp.ux, sp.uz)); car.vx = car.vz = 0; const n = ctx.world.road.nearest(x, z, car.s, {}); car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);
      await P.g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await P.until(`L3.state === "footRun"`);
      await P.g(`(() => { const sp = ctx.civic.spot("court"), F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); F.phase = "walk"; return true; })()`);
      await P.frames(4);
      await P.g(`ctx.civic.enter("court")`);
      await P.until(`L3.state === "interior" && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "courthouse"`);
      await P.frames(10);
      await P.g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === "doors2b"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
      await P.until(`L3.state === "placesHearing"`);
      await P.until(`/IN RE: BABY GITTY|Docket 2B/.test((document.querySelector("#dialog.open") || {}).textContent || "")`);
      await P.frames(20);
      await P.page.evaluate(() => document.querySelector("#dialog").click());      // → the judge opens the case
      await P.frames(40);
      await P.page.evaluate(() => document.querySelector("#dialog").click());      // (finish the typing)
      await P.frames(10);
    },
    async frame(P) { await P.frames(10); } },
  { id: "08-dina", caption: "Race Dina home from the school bus",
    async setup(P) {
      await P.page.evaluate(() => document.getElementById("dina").click());
      await P.until(`L3.state === "dinaSelect"`);
      await P.frames(6);
      await P.page.evaluate(() => document.getElementById("dsDina").click());
      await P.until(`L3.state === "dinaBus"`);
      await P.frames(10);
      await P.page.evaluate(() => import("./js/core/skip.js").then(m => m.skipNow()));
      await P.until(`L3.state === "dinaRun"`);
      await P.frames(200);      // (past the first-run controls hint)
    },
    async frame(P) {
      await P.g(`(ctx.dina.debug.spawn("dog", 14), ctx.dina.debug.spawn("hopscotch", 8), true)`);
      await P.frames(4);
    } },
  { id: "09-airport", caption: "Check the board at JFK's Terminal 4½", enable: "all,airport",
    async setup(P) {
      await cruise(P);
      await P.until(`!!ctx.airport.planned`);
      const E = await P.g(`ctx.airport.planned.s`);
      await P.g(`(() => { const hw = ctx.world.highway, p = hw.point(${E - 560}, 5.25, {}), n = hw.nearest(p.x, p.z, ctx.car.s, {}); ctx.car.place(p.x, p.z, hw.at(${E - 560}).h); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(n.s); ctx.cam.snap(); ctx.law && ctx.law.hold && ctx.law.hold(900); return true; })()`);
      await P.frames(3);
      await P.g(`ctx.airport.debug.buildNow()`);
      await P.until(`ctx.airport.ready`);
      // pull up at the DEPARTURES kerb, get out
      await P.g(`(() => { const p = ctx.airport.debug.world(-62, ctx.airport.debug.LY.KERB_LANE), h = ctx.airport.debug.G().F.yaw(1, 0), n = ctx.world.highway.nearest(p.x, p.z, ctx.car.s, {}); ctx.car.place(p.x, p.z, h); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
      await P.frames(30);
      await onFoot(P);
      await P.frames(30);
      // through the doors: the terminal hall (check-in, the departures board, travellers with suitcases)
      await P.g(`(window.__e = ctx.airport.debug.enterTerminal(), true)`);
      await P.until(`L3.state === "interior" && window.__interiors.room && window.__interiors.room.def.id === "terminal" && window.__interiors.room.ready`);
      await P.frames(90);
    },
    async frame(P, orient) {
      // portrait: the check-in desks (their big parody-airline signs) · landscape: desks + the departures board + arrivals
      await P.g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === "${orient === "portrait" ? "desk_eloy" : "board"}"), o = r.lulu.obj; o.position.x = h.x + 0.6; o.position.z = h.z + 2.2; r.vel && r.vel.set(0, 0, 0); o.rotation.y = Math.atan2(h.x - o.position.x, h.z - o.position.z); return true; })()`);
      await P.frames(40);
    } },
];

async function shoot(P, scene, file, dsf) {
  if (scene.clean) await P.clean(scene.clean); else await P.clean();
  await P.pr(dsf);
  await P.frames(2);
  if (scene.clean) await P.clean(scene.clean); else await P.clean();
  await P.frames(1);
  await P.page.screenshot({ path: file, timeout: 600000 });
  await P.pr(0.5);
}

function pngSize(file) {
  const b = fs.readFileSync(file);
  return b.toString("ascii", 1, 4) === "PNG" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : null;
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const relay = spawn(process.execPath, [path.join(ROOT, "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(RELAY_PORT) }), stdio: "ignore" });
  await sleep(1500);
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
  const onlyScenes = process.env.SHOT_SCENES ? process.env.SHOT_SCENES.split(",") : null;
  const onlyDevices = process.env.SHOT_DEVICES ? process.env.SHOT_DEVICES.split(",") : Object.keys(DEVICES);
  const problems = [];
  try {
    for (const dev of onlyDevices) {
      const D = DEVICES[dev];
      const [, w0, h0] = D.sizes[0];
      const context = await browser.newContext(Object.assign({ viewport: { width: w0, height: h0 } }, D.ctx));
      await context.addInitScript(({ s2, s3 }) => {
        if (!sessionStorage.getItem("__seeded")) { localStorage.setItem("luluSaveV2", JSON.stringify(s2)); localStorage.setItem("lulu3dSave", JSON.stringify(s3)); }
        sessionStorage.setItem("__seeded", "1");
      }, { s2: SAVE2D, s3: SAVE3D });
      for (const scene of SCENES) {
        if (onlyScenes && !onlyScenes.some(s => scene.id.startsWith(s))) continue;
        const env = { browser, base };
        let P = null;
        try {
          log(`${dev} ${scene.id}: setting up`);
          P = await openGame(context, base, "", scene.enable || "all");
          await P.page.setViewportSize({ width: w0, height: h0 });
          await scene.setup(P, env);
          for (const [size, w, h] of D.sizes) {
            for (const orient of ["portrait", "landscape"]) {
              const vw = orient === "portrait" ? w : h, vh = orient === "portrait" ? h : w;
              await P.page.setViewportSize({ width: vw, height: vh });
              await P.touch();
              await P.frames(6);
              await scene.frame(P, orient);
              const dir = path.join(OUT, size);
              fs.mkdirSync(dir, { recursive: true });
              const file = path.join(dir, `${scene.id}-${orient}.png`);
              await shoot(P, scene, file, D.ctx.deviceScaleFactor);
              log(`  ${path.relative(ROOT, file)} ${pngSize(file).join("×")}`);
            }
          }
          if (P.errors.length) problems.push(`${dev} ${scene.id}: page errors: ${P.errors.slice(0, 2).join(" | ")}`);
        } catch (e) {
          problems.push(`${dev} ${scene.id}: ${String(e && e.message || e).slice(0, 300)}`);
          log("  FAILED", String(e && e.message || e).slice(0, 300));
        } finally {
          if (scene.teardown && P) await scene.teardown(P, env);
          if (P) await P.page.close().catch(() => { });
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
    relay.kill();
  }
  if (problems.length) { console.log("\nproblems:\n  " + problems.join("\n  ")); process.exitCode = 1; }
  else console.log("\nall shots done.");
})().catch(e => { console.error(e); process.exit(1); });

