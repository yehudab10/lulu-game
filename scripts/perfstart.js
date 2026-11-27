// ⏱️ How long ▶ PLAY takes — the REAL game (no ?test), the way a player meets it:
//   title: first paint (FCP) and "interactive" (the title screen is up with ▶ PLAY), from navigation
//   PLAY → control: from the click until she's walking at home (footRun / walk)
//   …and what that time is made of: files fetched after the click (count, KB, ms), main-thread long tasks,
//   new shader programs compiled, and the home town's slices already built behind the title before the click.
//
//   node scripts/perfstart.js                       # every profile, cold + warm, 3 runs each → a table
//   PERFSTART_PROFILES=phone,desktop PERFSTART_RUNS=2 PERFSTART_OUT=file.json node scripts/perfstart.js
//
// Profiles: desktop (unthrottled, 1280×720) · phone (CPU 4× slower + a slow-4G network, iPhone-sized, touch) ·
// app (CPU 4× slower, no network throttle: the iOS app reads its files locally). Cold = a fresh browser profile;
// warm = the same profile reloaded (HTTP cache, max-age like GitHub Pages). The live multiplayer relay is blocked
// (a measurement must never create accounts or presence on the real server) — the game then runs offline.
// Software WebGL (SwiftShader) makes GPU work CPU work: compare before / after, not against a real phone.
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const RUNS = +(process.env.PERFSTART_RUNS || 3);
const PROFILES = (process.env.PERFSTART_PROFILES || "desktop,phone,app").split(",");
const EXTRA = process.env.PERFSTART_QUERY || "";          // e.g. "&nopreload" to compare
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".glb": "model/gltf-binary", ".json": "application/json", ".webp": "image/webp", ".woff2": "font/woff2" };
const SAVE2D = { totalCoins: 300, ownedSkins: ["pink"], selectedSkin: "pink" };
const SAVE3D = { best: 1000, f: { meta: { tutorialDone: true } } };

function serve() {
  const server = http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url.endsWith("/")) url += "index.html";
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": "max-age=600" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, "127.0.0.1", () => r(server)));
}

const PROFILE = {
  desktop: { ctx: { viewport: { width: 1280, height: 720 } }, cpu: 1, net: null },
  phone: { ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, cpu: 4,
    net: { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 } },
  app: { ctx: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, cpu: 4, net: null },
};

// installed before the game: paint + long-task + resource observers, all kept on window.__ps
const PROBE = () => {
  const P = window.__ps = { long: [], res: [], fcp: null };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.long.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true }); } catch (e) { }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") P.fcp = e.startTime; }).observe({ type: "paint", buffered: true }); } catch (e) { }
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) P.res.push([e.startTime, e.responseEnd, e.encodedBodySize || e.transferSize || 0, e.name.replace(location.origin, "")]); }).observe({ type: "resource", buffered: true }); } catch (e) { }
};

async function once(browser, base, prof, ctxHolder, warm) {
  const pr = PROFILE[prof];
  let context = ctxHolder.ctx;
  if (!context) {
    context = ctxHolder.ctx = await browser.newContext(pr.ctx);
    await context.addInitScript(({ s2, s3 }) => {
      if (!localStorage.getItem("luluSaveV2")) localStorage.setItem("luluSaveV2", JSON.stringify(s2));
      if (!localStorage.getItem("lulu3dSave")) localStorage.setItem("lulu3dSave", JSON.stringify(s3));
    }, { s2: SAVE2D, s3: SAVE3D });
    await context.addInitScript(PROBE);
    await context.route(/fonts\.(googleapis|gstatic)\.com|workers\.dev/, r => r.abort());
    await context.routeWebSocket(/workers\.dev|lulu-shared-road/, ws => ws.close());
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));
  const cdp = await context.newCDPSession(page);
  if (pr.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: pr.cpu });
  if (pr.net) { await cdp.send("Network.enable"); await cdp.send("Network.emulateNetworkConditions", pr.net); }
  const t0 = Date.now();
  await page.goto(`${base}/3d/${EXTRA ? "?" + EXTRA.replace(/^&/, "") : ""}`);
  await page.waitForFunction(() => window.__lulu3d && __lulu3d.state === "title" && !!document.querySelector("#screenCard #play"), null, { timeout: 300000, polling: 50 });
  const title = await page.evaluate(() => ({ interactive: performance.now(), fcp: window.__ps.fcp }));
  // a player looks at the title a moment (the time the game already uses behind it) — 4 s, then ▶ PLAY
  // (PERFSTART_EXPERIMENT=models: load the models the home start fetches, behind the title, first — the upper bound of a preload)
  if (process.env.PERFSTART_EXPERIMENT === "models") await page.evaluate(() => import("./js/models.js").then(m => { const f = m.modelFiles();
    return m.ensureModels(Object.keys(f).filter(k => /homes_|foot_|town_bochur|avigail_person/.test(f[k]))); }));
  await page.waitForTimeout(4000);
  const pre = await page.evaluate(() => { const L3 = window.__lulu3d, ctx = L3.ctx, T = ctx.town;
    window.__progKeys = new Set((L3.renderer.info.programs || []).map(p => p.cacheKey));
    return { now: performance.now(), programs: (L3.renderer.info.programs || []).length, standing: T && T.standing ? T.standing.filter(s => s.ready).length : null,
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; });
  if (process.env.PERFSTART_CPUPROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); await cdp.send("Profiler.start"); }
  const clickAt = await page.evaluate(() => { const b = document.querySelector("#screenCard #play"); const t = performance.now(); b.click(); return t; });
  await page.waitForFunction(() => { const c = window.__lulu3d.ctx; return c.state === "footRun" && c.foot && c.foot.phase === "walk"; }, null, { timeout: 300000, polling: 50 });
  if (process.env.PERFSTART_CPUPROFILE) {
    const { profile } = await cdp.send("Profiler.stop");
    // self time by function (top 25) and inclusive time for a few game entry points
    const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), dt = profile.timeDeltas, smp = profile.samples;
    for (let i = 0; i < smp.length; i++) { const n = byId.get(smp[i]); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").slice(-2).join("/")}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); }
    const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
    const incl = new Map(); for (let i = 0; i < smp.length; i++) { const seen = new Set(); for (let id = smp[i]; id; id = parent.get(id)) { const n = byId.get(id); const k = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").slice(-2).join("/")}:${n.callFrame.lineNumber + 1}`; if (seen.has(k)) continue; seen.add(k); incl.set(k, (incl.get(k) || 0) + (dt[i] || 0) / 1000); } }
    console.log("    SELF  " + [...self].sort((a, b) => b[1] - a[1]).slice(0, 22).map(([k, v]) => `${Math.round(v)}ms ${k}`).join("\n          "));
    console.log("    INCL  " + [...incl].filter(([k]) => /3d\/js|features/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `${Math.round(v)}ms ${k}`).join("\n          "));
  }
  const post = await page.evaluate(([clickAt]) => { const L3 = window.__lulu3d, P = window.__ps, now = performance.now();
    const res = P.res.filter(r => r[0] >= clickAt), longs = P.long.filter(l => l[0] >= clickAt);
    const byExt = {};
    for (const r of res) { const ext = (r[3].split("?")[0].match(/\.(\w+)$/) || [, "other"])[1]; const b = byExt[ext] || (byExt[ext] = [0, 0, 0]); b[0]++; b[1] += r[2]; b[2] = Math.max(b[2], r[1] - clickAt); }
    return { now, programs: (L3.renderer.info.programs || []).length, files: res.length, kb: Math.round(res.reduce((a, r) => a + r[2], 0) / 1024),
      lastFileMs: Math.round(res.reduce((a, r) => Math.max(a, r[1] - clickAt), 0)), byExt,
      longMs: Math.round(longs.reduce((a, l) => a + l[1], 0)), longN: longs.length, maxLong: Math.round(longs.reduce((a, l) => Math.max(a, l[1]), 0)),
      titleFiles: P.res.filter(r => r[0] < clickAt).length, titleKb: Math.round(P.res.filter(r => r[0] < clickAt).reduce((a, r) => a + r[2], 0) / 1024),
      newProgs: (L3.renderer.info.programs || []).filter(p => !window.__progKeys.has(p.cacheKey)).map(p => p.cacheKey), oldProgs: [...window.__progKeys],
      names: res.map(r => r[3].split('/').pop().split('?')[0] + ':' + Math.round(r[1] - clickAt)),
      heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }; }, [clickAt]);
  await page.close();
  return { prof, warm, wallBootMs: Date.now() - t0, fcp: Math.round(title.fcp || 0), titleInteractive: Math.round(title.interactive),
    playToControl: Math.round(post.now - clickAt), newPrograms: post.programs - pre.programs, programsAtClick: pre.programs, standingAtClick: pre.standing,
    files: post.files, kb: post.kb, lastFileMs: post.lastFileMs, byExt: post.byExt, longMs: post.longMs, longN: post.longN, maxLong: post.maxLong,
    newProgs: post.newProgs, oldProgs: post.oldProgs, names: post.names, titleFiles: post.titleFiles, titleKb: post.titleKb, heapTitle: pre.heap, heapHome: post.heap, errors };
}

const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--autoplay-policy=no-user-gesture-required"] });
  const all = [];
  for (const prof of PROFILES) for (let i = 0; i < RUNS; i++) {
    const holder = { ctx: null };
    for (const warm of [false, true]) {
      const r = await once(browser, base, prof, holder, warm);
      all.push(r);
      console.log(`  ${prof} ${warm ? "warm" : "cold"} #${i + 1}: FCP ${r.fcp} · title ${r.titleInteractive} · PLAY→control ${r.playToControl} ms · ${r.files} files ${r.kb} KB (last ${r.lastFileMs} ms) · long tasks ${r.longMs} ms (${r.longN}, max ${r.maxLong}) · +${r.newPrograms} shaders (${r.programsAtClick} at click) · town slices ${r.standingAtClick} · heap ${r.heapTitle}→${r.heapHome} MB${r.errors.length ? " · ERR " + r.errors[0] : ""}`);
      if (Object.keys(r.byExt).length) console.log(`      after PLAY by type: ${JSON.stringify(r.byExt)}`);
      if (process.env.PERFSTART_NAMES) console.log(`      files: ${r.names.join(' ')}\n      new programs:\n        ${r.newProgs.join('\n        ')}`);
    }
    await holder.ctx.close();
  }
  await browser.close(); server.close();
  console.log("\n| profile | cache | FCP | title interactive | ▶ PLAY → control | fetched after PLAY | long tasks after PLAY | new shaders |");
  console.log("|---|---|---|---|---|---|---|---|");
  const sum = {};
  for (const prof of PROFILES) for (const warm of [false, true]) {
    const rs = all.filter(r => r.prof === prof && r.warm === warm);
    const row = { fcp: med(rs.map(r => r.fcp)), title: med(rs.map(r => r.titleInteractive)), play: med(rs.map(r => r.playToControl)), files: med(rs.map(r => r.files)), kb: med(rs.map(r => r.kb)), long: med(rs.map(r => r.longMs)), sh: med(rs.map(r => r.newPrograms)) };
    sum[`${prof}-${warm ? "warm" : "cold"}`] = row;
    console.log(`| ${prof} | ${warm ? "warm" : "cold"} | ${row.fcp} ms | ${row.title} ms | **${row.play} ms** | ${row.files} files, ${row.kb} KB | ${row.long} ms | ${row.sh} |`);
  }
  if (process.env.PERFSTART_OUT) fs.writeFileSync(process.env.PERFSTART_OUT, JSON.stringify({ when: new Date().toISOString(), query: EXTRA, runs: all, summary: sum }, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
