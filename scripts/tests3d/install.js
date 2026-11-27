// 📥 Install on this PC / phone (roadmap 46) — features/install + the service worker (/sw.js) + /sw.json.
//   1. the harness page (?test without &enable=install): nothing registers; the ⚙️ row stays hidden until the browser
//      offers to install (a faked `beforeinstallprompt`), shows then, opens the browser's own offer, and hides when the
//      game runs installed (display-mode standalone); sw.json's models key is up to date (scripts/sw-version.js).
//   2. its own little server (so it can go "offline" and change files) + its own browser profile:
//      • the first start registers the worker and hands it the models it already downloaded;
//      • the second start takes every model from the device (zero .glb requests) — the load times are printed;
//      • with the server gone, a start still reaches the title;
//      • a changed page is picked up on the next start (network first); a changed model only once sw.json's models
//        key changes — then on the very next start;
//      • the kill switch ("off": true in sw.json) removes the worker + its caches at the next start; so does ?sw=off;
//      • nothing registers under the iOS app (a page with window.Capacitor), and the ⚙️ row stays hidden there.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".json": "application/json", ".webmanifest": "application/manifest+json" };

function server() {
  const S = { offline: false, log: [], over: {}, glbVer: 1 };
  const srv = http.createServer((req, res) => {
    if (S.offline) { req.socket.destroy(); return; }
    let url = decodeURIComponent(req.url.split("?")[0]);
    S.log.push(url);
    if (url.endsWith("/")) url += "index.html";
    const file = path.join(ROOT, url);
    const h = { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600" };
    if (url.endsWith(".glb")) h["x-file-ver"] = String(S.glbVer);
    if (/\.(html|json)$/.test(url)) h["Cache-Control"] = "no-cache";
    if (S.over[url] != null) { res.writeHead(200, h); return res.end(S.over[url]); }
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, h);
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => { S.srv = srv; S.base = `http://127.0.0.1:${srv.address().port}`; r(S); }));
}

module.exports = {
  name: "install",
  async run(t) {
    // ── 1. the harness page ──
    await t.frames(30);
    t.check("in ?test without &enable=install nothing registers", await t.game(`!ctx.install.info().registered`)
      && await t.L(`navigator.serviceWorker.getRegistrations().then(r => r.length === 0)`));
    t.check("sw.json's models key matches the models (node scripts/sw-version.js)", (() => {
      try { execFileSync("node", [path.join(ROOT, "scripts", "sw-version.js"), "--check"], { stdio: "pipe" }); return true; } catch (e) { return false; }
    })());
    t.check("the manifest is linked from 3d/ and names the 3D game", await t.L(`fetch(document.querySelector('link[rel=manifest]').href).then(r => r.json()).then(m => m.start_url === "./3d/" && m.display === "standalone" && m.icons.some(i => i.sizes === "512x512"))`));
    await t.game(`(L3.openMenuItem("title", "settings"), true)`); await t.frames(6);
    t.check("⚙️ has no install row while the browser hasn't offered one", await t.L(`!document.getElementById("set_x_install")`));
    await t.L(`(() => { const e = new Event("beforeinstallprompt", { cancelable: true }); e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; };
      e.userChoice = Promise.resolve({ outcome: "accepted" }); window.dispatchEvent(e); window.__bipDefault = e.defaultPrevented; })()`);
    t.check("the browser's own little install bar is held back (no pop-up)", await t.L(`window.__bipDefault === true`));
    await t.game(`(L3.openMenuItem("title", "settings"), true)`); await t.frames(6);
    const label = await t.L(`(document.getElementById("set_x_install") || {}).textContent || ""`);
    t.check("…a faked offer shows one quiet row: 📥 Install on this PC", /^📥 Install on this PC$/.test(label.trim()), label);
    await t.shot("row");
    await t.L(`document.getElementById("set_x_install").click()`); await t.frames(6);
    t.check("…pressing it opens the browser's own offer, once", await t.L(`window.__prompted === 1`));
    t.check("…and the row is gone (installed)", await t.L(`!document.getElementById("set_x_install")`) && await t.game(`ctx.install.info().installed`));
    // a new offer, but the game is running installed (its own window) → hidden
    await t.L(`(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => { }; e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e);
      const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode: standalone/.test(q) ? { matches: true, media: q, addEventListener() { }, removeEventListener() { } } : mm(q); })()`);
    await t.game(`(L3.openMenuItem("title", "settings"), true)`); await t.frames(6);
    t.check("installed (display-mode standalone): no install row", await t.L(`!document.getElementById("set_x_install")`));
    t.check("…a computer's installed window offers ⛶ Go full screen instead", /Go full screen/.test(await t.L(`(document.getElementById("set_x_fullscreen") || {}).textContent || ""`)));

    // ── 2. a real start-to-start run on its own server ──
    const S = await server();
    const browser = t.page.context().browser();
    const bc = await browser.newContext({ viewport: { width: 960, height: 540 }, serviceWorkers: "allow" });
    await bc.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const errs = [];
    const page = await bc.newPage();
    page.on("pageerror", e => errs.push(String(e && e.message || e)));
    const Q = "?test&enable=install&nogate&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00";
    const ev = code => page.evaluate(code).catch(() => null);
    const wait = async (code, ms = 180000) => { const end = Date.now() + ms; for (; ;) { if (await ev(code)) return true; if (Date.now() > end) return false; await page.waitForTimeout(150); } };
    const title = `window.__lulu3d && __lulu3d.state === "title"`;
    const glbs = () => S.log.filter(u => u.endsWith(".glb")).length;
    const start = async (q = Q, label = "") => {
      S.log = [];
      const t0 = Date.now();
      await page.goto(S.base + "/3d/" + q).catch(() => { });
      const ok = await wait(title);
      const ms = Date.now() - t0;
      if (!ok) t.check(`${label} reaches the title`, false);
      return { ok, ms };
    };
    const regs = () => ev(`navigator.serviceWorker.getRegistrations().then(r => r.length)`);
    const kept = () => ev(`caches.keys().then(ks => ks.filter(k => k.startsWith("lulu-sw-")).length)`);
    try {
      const a = await start(Q, "the first start");
      const okReg = await wait(`navigator.serviceWorker.controller && __lulu3d.ctx.install.info().registered`, 60000);
      t.check("first start: the worker registers once the title is up, and looks after the page", okReg);
      const n1 = glbs();
      await wait(`__lulu3d.ctx.install.info().kept != null`, 120000);
      const k1 = await ev(`__lulu3d.ctx.install.info().kept`);
      t.check("…and keeps the models this start already downloaded", n1 > 0 && k1 > 0, `${n1} .glb downloaded, ${k1} kept`);

      const b = await start(Q, "the second start");
      const n2 = glbs();
      t.check("second start: every model comes from the device (no .glb downloads)", b.ok && n2 === 0, `${n2} .glb requests`);
      console.log(`    (start → title: first ${a.ms} ms, second ${b.ms} ms; first start downloaded ${n1} models, the second 0)`);

      S.offline = true;
      const c = await start(Q, "an offline start");
      t.check("offline: a start still reaches the title", c.ok);
      S.offline = false;

      // a changed page → the very next start
      const html = fs.readFileSync(path.join(ROOT, "3d", "index.html"), "utf8");
      S.over["/3d/index.html"] = html.replace("<head>", `<head><meta name="lulu-test" content="v2">`);
      await start(Q, "a start after a page changed");
      t.check("a changed page is picked up on the next start (network first)", !!await ev(`!!document.querySelector('meta[name="lulu-test"]')`));
      delete S.over["/3d/index.html"];
      // a changed model: kept until sw.json's models key changes, then fresh on the very next start
      const glbVer = () => ev(`(() => { const u = performance.getEntriesByType("resource").map(r => r.name).find(u => u.endsWith(".glb")); return u ? fetch(u).then(r => r.headers.get("x-file-ver")) : null; })()`);
      S.glbVer = 2;
      await start(Q, "a start after a model changed");
      const v1 = await glbVer();
      t.check("…a model changed WITHOUT a new models key stays as kept (cache first)", v1 === "1", `x-file-ver ${v1}`);
      const sw = JSON.parse(fs.readFileSync(path.join(ROOT, "sw.json"), "utf8"));
      S.over["/sw.json"] = JSON.stringify(Object.assign({}, sw, { assets: "test-new-models" }));
      await start(Q, "a start after the models key changed");
      const v2 = await glbVer();
      t.check("…a new models key: the changed model arrives on the very next start", v2 === "2" && glbs() > 0, `x-file-ver ${v2}, ${glbs()} .glb downloaded`);

      // the kill switch
      S.over["/sw.json"] = JSON.stringify(Object.assign({}, sw, { off: true }));
      await start(Q, "a start with the kill switch on");
      t.check("kill switch (\"off\": true in sw.json): the worker + its caches are gone after one start", await wait(`navigator.serviceWorker.getRegistrations().then(r => r.length === 0)`, 60000) && await wait(`caches.keys().then(ks => !ks.some(k => k.startsWith("lulu-sw-")))`, 30000), `${await regs()} registrations, ${await kept()} caches`);
      delete S.over["/sw.json"];
      await start(Q, "a start after the kill switch");
      t.check("…switched back on, the next start registers again", await wait(`navigator.serviceWorker.controller && __lulu3d.ctx.install.info().registered`, 60000));
      await start(Q + "&sw=off", "a start with ?sw=off");
      t.check("?sw=off removes it too", await wait(`navigator.serviceWorker.getRegistrations().then(r => r.length === 0)`, 60000)
        && await wait(`caches.keys().then(ks => !ks.some(k => k.startsWith("lulu-sw-")))`, 30000), `${await regs()} registrations, ${await kept()} caches`);

      // the iOS app: never
      await page.addInitScript(() => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: {} }; });
      await start(Q, "a start inside the (fake) iOS app");
      await page.waitForTimeout(4000);
      await ev(`(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => { }; e.userChoice = Promise.resolve({ outcome: "dismissed" }); window.dispatchEvent(e); })()`);
      await ev(`(__lulu3d.openMenuItem("title", "settings"), true)`); await page.waitForTimeout(500);
      t.check("inside the iOS app: nothing registers, no install row", (await regs()) === 0 && await ev(`__lulu3d.ctx.install.info().native && !__lulu3d.ctx.install.info().registered && !document.getElementById("set_x_install")`));
      t.check("no page errors on the starts", errs.length === 0, errs.slice(0, 3).join(" | "));
    } finally {
      await bc.close();
      S.srv.close();
    }
  },
};
