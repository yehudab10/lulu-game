// The iOS app (Capacitor) build of 2.0 — features/native + the staged bundle.
//
// 1. On the web (the harness's normal boot, no window.Capacitor) everything
//    native is a no-op: no ad SDK calls, no 📺 button, rumble untouched.
// 2. Then it stages the app bundle (scripts/copy-web.js → www/) and boots the
//    game FROM www/3d/ (exactly the layout the app ships) with a fake
//    window.Capacitor carrying stub AdMob (incl. App Tracking Transparency) and
//    Haptics plugins, and checks:
//      • zero 404s / failed requests from the bundle, every registered model,
//        the music and the Classic 2D page are in www/, and the save is shared;
//      • ATT is requested BEFORE AdMob initializes (Apple Guideline 2.1);
//      • game over #1 offers the rewarded "📺 WATCH" button (focusable with the
//        D-pad) and it pays +50 💰 once; game over #2 shows the interstitial;
//      • nothing shows mid-drive or in a 🎉 party;
//      • touch rumbles go to the Haptics plugin (and the toggle still stops them).
// 3. Updates from the server (features/native/ota.js) against a fake updater plugin that behaves like
//    @capgo/capacitor-updater (reuses unchanged bundled files, SHA-256-checks every downloaded one, set() =
//    reload into the copy, a copy that never calls notifyAppReady() is rolled back after a timeout):
//      • offline first launch boots normally; • a copy is downloaded (only the changed file) and boots at the
//      next launch; • the save is untouched; • a corrupted download is rejected; • a manifest that needs a
//      newer app is ignored (one App Store note); • a copy that never reaches the title is rolled back and
//      never tried again.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");

// The fake Capacitor bridge (what the native app injects before any script runs).
function fakeCapacitor() {
  const m = /^\/(www(?:-ota-[\w-]+)?)\//.exec(location.pathname);
  if (!m) return;                                            // only the staged app bundle (+ test update copies) gets it
  // ── a fake @capgo/capacitor-updater: its state survives reloads like the real plugin's (UserDefaults) ──
  const FK = "__fakeCapgo";
  const st = JSON.parse(localStorage.getItem(FK) || '{"current":"builtin","fallback":"builtin","bundles":{}}');
  const saveSt = () => localStorage.setItem(FK, JSON.stringify(st));
  const dirOf = id => (id === "builtin" || !st.bundles[id]) ? "/www/" : st.bundles[id].dir;
  const go = id => location.replace(dirOf(id) + "3d/" + location.search);
  // a launch always opens the CURRENT copy (what the real plugin serves at capacitor://localhost/)
  if ("/" + m[1] + "/" !== dirOf(st.current)) { go(st.current); return; }
  const ulog = window.__otaLog = [];
  const cur = () => st.current === "builtin" ? { id: "builtin", version: "builtin", status: "success" } : Object.assign({ id: st.current }, st.bundles[st.current]);
  if (st.current !== "builtin" && st.bundles[st.current].status !== "success") {
    setTimeout(() => {                                        // appReadyTimeout: never said ready → roll back
      const s2 = JSON.parse(localStorage.getItem(FK));
      if (s2.current !== st.current || s2.bundles[st.current].status === "success") return;
      s2.bundles[st.current].status = "error"; s2.current = s2.fallback; localStorage.setItem(FK, JSON.stringify(s2));
      location.replace((s2.current === "builtin" ? "/www/" : s2.bundles[s2.current].dir) + "3d/" + location.search);
    }, 12000);
  }
  const hex = b => Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, "0")).join("");
  const CapacitorUpdater = {
    current: async () => ({ bundle: cur(), native: "2.0.0" }),
    list: async () => ({ bundles: Object.entries(st.bundles).map(([id, b]) => ({ id, version: b.version, status: b.status })) }),
    notifyAppReady: async () => { ulog.push("ready"); if (st.current !== "builtin") { st.bundles[st.current].status = "success"; st.fallback = st.current; saveSt(); } return { bundle: cur() }; },
    download: async ({ url, version, manifest }) => {
      ulog.push("download:" + version);
      const own = await (await fetch("/www/ota-build.json")).json();          // the bundled copy's files
      let fetched = 0;
      for (const e of manifest) {
        if (!/^https?:\/\//.test(e.download_url)) throw new Error("bad url");
        if (own.files[e.file_name] && own.files[e.file_name][0] === e.file_hash) continue;   // reused, not downloaded
        const r = await fetch(e.download_url);
        if (!r.ok) throw new Error("HTTP " + r.status + " " + e.file_name);
        fetched++;
        if (hex(await crypto.subtle.digest("SHA-256", await r.arrayBuffer())) !== e.file_hash) throw new Error("Checksum failed for " + e.file_name);
      }
      ulog.push("fetched:" + fetched);
      const id = "b" + Math.random().toString(36).slice(2, 8);
      st.bundles[id] = { version, status: "pending", dir: new URL(url).pathname.replace(/index\.html$/, "") };
      saveSt();
      return { id, version, status: "pending" };
    },
    set: async ({ id }) => { ulog.push("set:" + id); st.current = id; saveSt(); go(id); },
    reset: async () => { st.current = "builtin"; saveSt(); go("builtin"); },
    delete: async ({ id }) => { delete st.bundles[id]; saveSt(); },
  };
  const App = { getInfo: async () => ({ version: "2.0.0", build: "200" }), addListener: () => Promise.resolve({ remove() {} }) };
  const Network = { getStatus: async () => ({ connected: true, connectionType: "wifi" }) };
  const log = window.__capLog = [];
  const listeners = {};
  let att = "notDetermined";
  const AdMob = {
    trackingAuthorizationStatus: async () => { log.push("att:status"); return { status: att }; },
    requestTrackingAuthorization: async () => { log.push("att:request"); att = "denied"; return { status: att }; },
    initialize: async () => { log.push("admob:initialize"); },
    prepareInterstitial: async () => { log.push("admob:prepareInterstitial"); return { adUnitId: "x" }; },
    // (like the real v8 plugin: the promise resolves as the ad APPEARS; "dismissed" comes when it's closed)
    showInterstitial: async () => { log.push("admob:showInterstitial"); setTimeout(() => (listeners.interstitialAdDismissed || []).forEach(f => f({})), 300); },
    prepareRewardVideoAd: async () => { log.push("admob:prepareRewardVideoAd"); return { adUnitId: "y" }; },
    showRewardVideoAd: async () => {
      log.push("admob:showRewardVideoAd");
      // the plugin fires the reward event AND resolves with the item: it must pay once
      (listeners.onRewardedVideoAdReward || []).forEach(f => f({ type: "coins", amount: 50 }));
      setTimeout(() => (listeners.onRewardedVideoAdDismissed || []).forEach(f => f({})), 300);
      return { type: "coins", amount: 50 };
    },
    addListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); log.push("admob:listen:" + ev); return Promise.resolve({ remove() {} }); },
  };
  const Haptics = {
    impact: async o => { log.push("haptics:" + o.style); },
    notification: async o => { log.push("haptics:n:" + o.type); },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: { AdMob, Haptics, CapacitorUpdater, App, Network } };
}

// ── update copies for part 3: www/ hard-linked, the changed files written fresh, + a manifest each ──────────
function makeCopy(name, change) {
  const src = path.join(ROOT, "www"), dst = path.join(ROOT, name);
  fs.rmSync(dst, { recursive: true, force: true });
  const walk = d => fs.readdirSync(d).forEach(f => {
    const a = path.join(d, f), b = path.join(dst, path.relative(src, a));
    if (fs.statSync(a).isDirectory()) { fs.mkdirSync(b, { recursive: true }); walk(a); }
    else if (f !== "ota-build.json") fs.linkSync(a, b);
  });
  fs.mkdirSync(dst, { recursive: true });
  walk(src);
  for (const [rel, fn] of Object.entries(change)) {
    const f = path.join(dst, rel), txt = fn(fs.readFileSync(f, "utf8"));
    fs.unlinkSync(f); fs.writeFileSync(f, txt);
  }
}
function manifestOf(name, origin, extra = {}) {
  const dir = path.join(ROOT, name), files = {};
  const walk = d => fs.readdirSync(d).forEach(f => {
    const a = path.join(d, f);
    if (fs.statSync(a).isDirectory()) return walk(a);
    const buf = fs.readFileSync(a);
    files[path.relative(dir, a).split(path.sep).join("/")] = [crypto.createHash("sha256").update(buf).digest("hex"), buf.length];
  });
  walk(dir);
  return Object.assign({ schema: 1, channel: "stable", version: "test-" + name.replace(/^www-ota-/, ""), commit: "0".repeat(40), minNative: "2.0.0", paused: false, revert: false, base: origin + "/" + name + "/", files }, extra);
}

module.exports = {
  name: "native",
  async run(t) {
    const g = t.game;
    const log = () => t.L(`window.__capLog || []`);
    const wallet2d = () => t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`);

    // ── 1. the web: a no-op ───────────────────────────────────────────────
    t.check("web: no Capacitor → native off", await g(`!!ctx.native && ctx.native.active === false && ctx.ads.native === false && ctx.haptics.native === false`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "web: drives")) return;
    await g(`(ctx.G.invT = 0, window.__rumbles = [], L3.damage(1, "test", "test"))`);
    await t.frames(4);
    t.check("web: damage rumbles the controller", await t.L(`(window.__rumbles || []).some(r => r.s >= 0.9)`));
    await g(`L3.setState("gameover", {})`);
    await t.frames(6);
    await g(`L3.setState("gameover", {})`);
    await t.frames(6);
    t.check("web: game over shows no 📺 button", await t.L(`!document.getElementById("adReward")`));
    t.check("web: no ad bookkeeping at all", await g(`ctx.ads.debug.S.gameOvers === 0 && ctx.ads.debug.S.started === false && ctx.ads.debug.log.length === 0`));
    await g(`L3.setState("title")`);
    await t.frames(4);
    // a coin balance written by "the old app" (the classic 2D game at the same origin)
    await t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2") || "{}"); s.totalCoins = 4321; s.ownedSkins = ["pink", "blue"]; localStorage.setItem("luluSaveV2", JSON.stringify(s)); })()`);

    // ── 2. the staged app bundle (www/) with a fake Capacitor ─────────────
    let staged = "";
    try { staged = execFileSync(process.execPath, [path.join(ROOT, "scripts", "copy-web.js")], { cwd: ROOT, encoding: "utf8" }); }
    catch (e) { t.check("copy-web.js stages www/ cleanly", false, String(e.stdout || e.message).slice(-400)); return; }
    t.check("copy-web.js stages www/ cleanly", /every referenced file is in www/.test(staged), staged.trim().split("\n")[0]);

    const bad = [];
    t.page.on("response", r => { if (r.status() >= 400) bad.push(r.status() + " " + r.url()); });
    // (ERR_ABORTED = the game itself cancelled it, e.g. the music switching tracks — not a missing file)
    t.page.on("requestfailed", r => { const why = (r.failure() || {}).errorText || ""; if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url()) && !/ABORTED/.test(why)) bad.push("failed " + r.url() + " " + why); });
    await t.page.addInitScript(fakeCapacitor);
    const origin = new URL(t.page.url()).origin;
    await t.page.goto(`${origin}/www/3d/?test&enable=ads`);
    if (!await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "app bundle: boots www/3d/ to the title", 120000)) return;
    t.check("app bundle: the page is www/3d/", await t.L(`location.pathname`) === "/www/3d/");
    t.check("app bundle: native on (Capacitor + AdMob + Haptics)", await g(`ctx.native.active && ctx.ads.native && ctx.haptics.native`));
    t.check("app bundle: the shared save carried over (same origin, new path)",
      await g(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2")); return s.totalCoins === 4321 && s.ownedSkins.includes("blue"); })()`));

    // everything the game can load is in the bundle (lazy models too), plus the Classic 2D page + music
    const missing = await t.L(`(async () => {
      const m = await import(new URL("js/models.js", location.href).href);
      const urls = Object.values(m.modelFiles()).concat(["../classic.html", "../game.js", "../style.css", "../luludriving.mp3", "../story-beach.mp3", "../dina.mp3", "../"]);
      const out = [];
      for (const u of urls) { const r = await fetch(u); if (!r.ok) out.push(r.status + " " + u); else await r.arrayBuffer(); }   // GET + read it all (a HEAD the test server answers with a body counts as a failed request)
      const fwd = await (await fetch("../")).text();
      if (!/location\\.replace\\("3d\\/"/.test(fwd)) out.push("www/index.html does not forward to 3d/");
      return out;
    })()`);
    t.check("app bundle: every registered model, the music and Classic 2D are in www/", missing.length === 0, missing.slice(0, 5).join(" | "));
    t.check("app bundle: everything the page loaded came from www/", await t.L(`performance.getEntriesByType("resource").filter(e => e.name.startsWith(location.origin) && !new URL(e.name).pathname.startsWith("/www/")).length === 0`));

    // ATT → AdMob.initialize (after the ~1.2 s launch delay)
    await t.until(`window.__lulu3d.ctx.ads.ready`, "AdMob initializes", 60000);
    let L0 = await log();
    const iStat = L0.indexOf("att:status"), iReq = L0.indexOf("att:request"), iInit = L0.indexOf("admob:initialize");
    t.check("ATT is requested BEFORE AdMob initializes", iStat >= 0 && iReq > iStat && iInit > iReq, L0.slice(0, 6).join(" → "));
    t.check("both ad kinds preload after init", L0.includes("admob:prepareInterstitial") && L0.includes("admob:prepareRewardVideoAd"));
    t.check("ATT answer is remembered", await g(`ctx.ads.att`) === "denied");

    // a drive: never an ad mid-drive
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "app: drives")) return;
    await t.hold(7, 1); await t.frames(30); await t.hold(7, 0);
    t.check("no ad mid-drive", !(await log()).some(x => /show/.test(x)));

    // haptics: a touch-play crash → the Taptic engine; the setting turns it off
    await g(`(L3.input.device = "touch", ctx.G.invT = 0, L3.damage(1, "test", "test"))`);
    await t.frames(2);
    t.check("touch rumble → Capacitor Haptics impact (HEAVY)", (await log()).includes("haptics:HEAVY"), (await log()).filter(x => /hapt/.test(x)).join(","));
    const nH = (await log()).filter(x => /^haptics/.test(x)).length;
    await t.frames(20);
    await g(`(L3.input.rumbleOn = false, ctx.G.invT = 0, L3.damage(1, "test", "test"))`);
    await t.frames(2);
    t.check("the Rumble & haptics toggle silences it", (await log()).filter(x => /^haptics/.test(x)).length === nH);
    await g(`(L3.input.rumbleOn = true, ctx.G.hearts = Math.max(ctx.G.hearts, 2))`);

    // game over #1: no interstitial, the 📺 rewarded button
    await g(`L3.setState("gameover", {})`);
    await t.frames(6);
    t.check("game over #1: no interstitial yet", !(await log()).includes("admob:showInterstitial"));
    t.check("game over #1: the 📺 WATCH button is offered", await t.L(`!!document.getElementById("adReward") && /WATCH/.test(document.getElementById("adReward").textContent)`));
    await t.shot("gameover-rewarded");
    const w0 = await wallet2d();
    // the controller reaches it: D-pad ↓ from "Try again", ✕/A presses it
    await t.tap(13); await t.frames(2);
    t.check("the 📺 button is controller-focusable", await t.L(`document.getElementById("adReward") && document.getElementById("adReward").classList.contains("focus")`));
    await t.tap(0);
    await t.frames(40);
    const w1 = await wallet2d();
    t.check("watching pays +50 💰 once (event + result)", w1 - w0 === 50, `${w0} → ${w1}`);
    t.check("one reward per game over (button gone)", await t.L(`!document.getElementById("adReward")`) && await g(`ctx.ads.debug.S.rewards === 1`));

    // game over #2: the interstitial
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "app: drives again");
    await g(`L3.setState("gameover", {})`);
    await t.frames(6);
    t.check("game over #2: interstitial", (await log()).filter(x => x === "admob:showInterstitial").length === 1);

    // a 🎉 party: never any ads (party.active stubbed on just for the game-over moment)
    const nShow = (await log()).filter(x => /show/.test(x)).length;
    for (let i = 0; i < 2; i++) {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      await t.until(`__lulu3d.state === "playing"`, "party: drives");
      await g(`(() => { window.__partyDesc = Object.getOwnPropertyDescriptor(ctx.party, "active"); Object.defineProperty(ctx.party, "active", { get: () => true, configurable: true }); L3.setState("gameover", {}); })()`);
      await t.frames(6);
      t.check(`party game over #${i + 1}: no 📺 button`, await t.L(`!document.getElementById("adReward")`));
      await g(`Object.defineProperty(ctx.party, "active", window.__partyDesc)`);
    }
    t.check("no ads in a party", (await log()).filter(x => /show/.test(x)).length === nShow);
    const partySrc = require("fs").readFileSync(path.join(ROOT, "3d/js/features/party/index.js"), "utf8");
    t.check("party's OFF set turns ads off", /const OFF = new Set\(\[[^\]]*"ads"/.test(partySrc));
    await g(`L3.setState("title")`);
    await t.frames(6);

    t.check("app bundle: zero 404s / failed requests", bad.length === 0, bad.slice(0, 5).join(" | "));
    await t.shot("app-title");

    // ── 3. updates from the server ────────────────────────────────────────
    const OTA_DIRS = ["www-ota-next", "www-ota-bad", "www-ota-test"].map(d => path.join(ROOT, d));
    try {
      t.check("ota: on in the app, running the bundled copy", await g(`ctx.native.ota.active && ctx.native.ota.debug.current.id === "builtin"`));
      t.check("ota: the bundled copy told the updater it's ready", (await t.L(`window.__otaLog || []`)).includes("ready"));
      t.check("ota: it read its own file list (what the phone already has)", await g(`ctx.native.ota.debug.state.have.split(",").length > 500 && ctx.native.ota.debug.state.builtin.length === 40`));
      await t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2")); s.otaSentinel = "keep-me"; localStorage.setItem("luluSaveV2", JSON.stringify(s)); })()`);
      const saveNow = () => t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2")); return JSON.stringify([s.totalCoins, s.ownedSkins, s.otaSentinel]); })()`);
      const saveBefore = await saveNow();

      makeCopy("www-ota-next", { "3d/index.html": h => h.replace("</head>", '<script>window.__otaMarker = "next";</script></head>') });
      makeCopy("www-ota-bad", { "3d/index.html": h => h.replace('<script type="module" src="js/main.js"></script>', "") });
      fs.mkdirSync(OTA_DIRS[2], { recursive: true });
      const put = (f, m) => fs.writeFileSync(path.join(OTA_DIRS[2], f), JSON.stringify(m));
      const next = manifestOf("www-ota-next", origin);
      put("next.json", next);
      const corrupt = JSON.parse(JSON.stringify(next));
      corrupt.version = "test-corrupt"; corrupt.files["3d/index.html"][0] = "f".repeat(64);
      put("corrupt.json", corrupt);
      put("future.json", Object.assign({}, next, { version: "test-future", minNative: "9.0.0" }));
      put("bad.json", manifestOf("www-ota-bad", origin));
      put("old.json", Object.assign({}, next, { version: "test-old", committed: "2000-01-01T00:00:00Z" }));
      const open = (q, label) => t.page.goto(`${origin}/www/3d/?test&otaManifest=${q}`).then(() => t.until(`window.__lulu3d && __lulu3d.state === "title"`, label, 120000));
      const otaLog = () => t.L(`window.__otaLog || []`);
      const fake = () => t.L(`JSON.parse(localStorage.getItem("__fakeCapgo"))`);

      // a first launch with no internet: the bundled copy boots; the check fails quietly
      await t.L(`localStorage.removeItem("luluOtaV1")`);
      const offline = u => !u.href.startsWith(origin);
      await t.page.route(offline, r => r.abort("internetdisconnected"));
      await open("https://raw.githubusercontent.com/yehudab10/lulu-game/ota/stable.json", "ota: offline first launch boots to the title");
      t.check("ota: offline, the check fails quietly", await g(`ctx.native.ota.check()`) === "offline");
      await t.page.unroute(offline);

      // an app built from a newer commit than stable never goes BACK to the older copy
      await open("/www-ota-test/old.json", "ota: launches the bundled copy");
      t.check("ota: an older stable than the app's own copy is ignored", await g(`ctx.native.ota.check()`) === "bundled copy is newer");

      // a new copy: downloaded in the background, only the changed file, NOT switched under the running game
      await open("/www-ota-test/next.json", "ota: launches the bundled copy");
      t.check("ota: a new copy downloads", await g(`ctx.native.ota.check()`) === "downloaded", await g(`ctx.native.ota.debug.state.log.slice(-2).join(" | ")`));
      t.check("ota: only the changed file came down (the rest reused from the app)", (await otaLog()).includes("fetched:1"), (await otaLog()).join(","));
      t.check("ota: the running game is left alone", await t.L(`location.pathname === "/www/3d/" && !window.__otaMarker`));
      // the next launch switches it in, before the title
      await t.page.goto(`${origin}/www/3d/?test&otaManifest=/www-ota-test/next.json`);
      const booted = await t.until(`location.pathname.startsWith("/www-ota-next/") && window.__lulu3d && __lulu3d.state === "title"`, "ota: the next launch boots from the downloaded copy", 120000);
      if (booted) {
        t.check("ota: it is the new copy", await t.L(`window.__otaMarker === "next"`));
        await t.until(`(window.__otaLog || []).includes("ready") && !__lulu3d.ctx.native.ota.debug.state.trying`, "ota: the new copy says ready", 60000);
        const f = await fake();
        t.check("ota: …and the updater keeps it", f.bundles[f.current].status === "success" && f.bundles[f.current].version === "test-next");
        t.check("ota: the save is untouched across the update", (await saveNow()) === saveBefore, (await saveNow()) + " vs " + saveBefore);
        t.check("ota: now up to date", await g(`ctx.native.ota.check()`) === "up to date");
      }

      // a corrupted download is rejected (a file's fingerprint doesn't match)
      await open("/www-ota-test/corrupt.json", "ota: relaunch");
      t.check("ota: a corrupted download is rejected", await g(`ctx.native.ota.check()`) === "download failed" && await g(`ctx.native.ota.debug.state.pending === null`));
      t.check("ota: …and nothing was installed", Object.values((await fake()).bundles).every(b => b.version !== "test-corrupt"));

      // a copy that needs a newer app (native code this app doesn't have) is ignored, with one App Store note
      await open("/www-ota-test/future.json", "ota: relaunch");
      t.check("ota: a copy needing a newer app is ignored", await g(`ctx.native.ota.check()`) === "needs a newer app" && !(await otaLog()).some(x => /test-future/.test(x)));
      t.check("ota: …one 'new version in the App Store' note", await g(`ctx.native.ota.debug.state.storeNote === "9.0.0@2.0.0"`));

      // a copy that never reaches the title: rolled back to the last good copy, never tried again
      await open("/www-ota-test/bad.json", "ota: relaunch");
      t.check("ota: the broken copy downloads", await g(`ctx.native.ota.check()`) === "downloaded");
      await t.page.goto(`${origin}/www/3d/?test&otaManifest=/www-ota-test/bad.json`);
      const back = await t.until(`location.pathname.startsWith("/www-ota-next/") && window.__lulu3d && __lulu3d.state === "title" && __lulu3d.ctx.native.ota.debug.state.bad.includes("test-bad")`,
        "ota: a copy that never reaches the title is rolled back to the last good one", 180000);
      if (back) {
        t.check("ota: …it really was tried (and marked failed)", Object.values((await fake()).bundles).some(b => b.version === "test-bad" && b.status === "error"));
        t.check("ota: …and is never tried again", await g(`ctx.native.ota.check()`) === "known bad");
        t.check("ota: the save is still untouched", (await saveNow()) === saveBefore);
      }
    } finally {
      for (const d of OTA_DIRS) fs.rmSync(d, { recursive: true, force: true });
    }
  },
};
