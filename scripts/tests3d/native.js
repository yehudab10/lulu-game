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
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..");

// The fake Capacitor bridge (what the native app injects before any script runs).
function fakeCapacitor() {
  if (!/\/www\//.test(location.pathname)) return;           // only the staged app bundle gets it
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
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: { AdMob, Haptics } };
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
  },
};
