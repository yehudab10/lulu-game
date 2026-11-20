// 📺 Ads never cost the player a moment (AGENTS golden rule 4b) — the iOS app, with a fake AdMob plugin that keeps
// each ad on screen for a few real seconds:
//   • a KNOCK-OUT's ad starts only once she's back on her feet and walking (not in the spin-out / the climb-out);
//   • while it's up NOTHING moves: game time, frames, a script waiting on game time, her position, the traffic, the
//     day list, the music (paused) and the sound (held) — and afterwards play simply continues;
//   • the 📺 rewarded ad from the pause menu holds the same way (and pays once);
//   • a JAIL stay's ad starts only in the quiet cell (not the arrest, not the booking), the court clock and the
//     cellmate freeze behind it, and it's once a stay;
//   • the plugin never answers → the game comes back after showWaitMs; it "shows" but never says dismissed → maxAdMs.
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");

function fakeCapacitor() {
  if (!/\/www\//.test(location.pathname)) return;
  const log = window.__capLog = [];
  const listeners = {};
  const fire = (ev, d) => (listeners[ev] || []).forEach(f => f(d || {}));
  window.__adMode = "dismiss";      // "dismiss" (appears, then closes after __adMs) | "hang" (never answers) | "noDismiss" (appears, never says closed)
  window.__adMs = 4000;
  window.__adOpen = false;
  const AdMob = {
    trackingAuthorizationStatus: async () => ({ status: "denied" }),
    requestTrackingAuthorization: async () => ({ status: "denied" }),
    initialize: async () => { log.push("admob:initialize"); },
    prepareInterstitial: async () => { log.push("admob:prepareInterstitial"); return {}; },
    prepareRewardVideoAd: async () => { log.push("admob:prepareRewardVideoAd"); return {}; },
    showInterstitial: () => {
      log.push("admob:showInterstitial");
      if (window.__adMode === "hang") return new Promise(() => {});
      window.__adOpen = true;
      fire("interstitialAdShowed");
      if (window.__adMode === "dismiss") setTimeout(() => { window.__adOpen = false; fire("interstitialAdDismissed"); }, window.__adMs);
      return Promise.resolve();
    },
    showRewardVideoAd: () => {
      log.push("admob:showRewardVideoAd");
      window.__adOpen = true;
      fire("onRewardedVideoAdShowed");
      return new Promise(res => setTimeout(() => {
        fire("onRewardedVideoAdReward", { type: "coins", amount: 50 });
        window.__adOpen = false;
        fire("onRewardedVideoAdDismissed");
        res({ type: "coins", amount: 50 });
      }, window.__adMs));
    },
    addListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); return Promise.resolve({ remove() {} }); },
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios", Plugins: { AdMob, Haptics: { impact: async () => {}, notification: async () => {} } } };
}

// everything that must stand still behind an ad
const SNAP = `(() => { const c = ctx, f = c.foot && c.foot.pos, st = c.law && c.law._dbg && c.law._dbg.jail ? c.law._dbg.jail() : null;
  return JSON.stringify({ time: +c.time.toFixed(4), frames: c.frames, state: c.state, script: window.__w || 0,
    foot: f ? [+f.x.toFixed(3), +f.z.toFixed(3)] : null, car: [+c.car.pos.x.toFixed(3), +c.car.pos.z.toFixed(3)],
    traffic: c.traffic.cars.map(t => +(t.s || 0).toFixed(3)).join(","),
    day: c.day ? JSON.stringify(c.day.list()) : "", jail: st ? [st.phase, +(st.courtT || 0).toFixed(3), +(st.cellmateT || 0).toFixed(3)] : null }); })()`;

module.exports = {
  name: "adhold",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 500, cruiseUnlocked: true },
  async run(t) {
    const g = t.game;
    const log = () => t.L(`window.__capLog || []`);
    const realUntil = async (expr, ms) => { try { await t.page.waitForFunction(expr, null, { timeout: ms, polling: 50 }); return true; } catch (e) { return false; } };
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    try { execFileSync(process.execPath, [path.join(ROOT, "scripts", "copy-web.js")], { cwd: ROOT, encoding: "utf8" }); }
    catch (e) { t.check("copy-web.js stages www/", false, String(e.stdout || e.message).slice(-300)); return; }
    await t.page.addInitScript(fakeCapacitor);
    const origin = new URL(t.page.url()).origin;
    await t.page.goto(`${origin}/www/3d/?test&enable=ads,world,foot,day`);
    if (!await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots the app bundle", 120000)) return;
    if (!await t.until(`window.__lulu3d.ctx.ads.ready`, "AdMob initializes", 60000)) return;
    await g(`(() => { const A = ctx.ads.debug.ADMOB; A.minGapMs = 0; A.showWaitMs = 2500; A.maxAdMs = 12000; ctx.day.debug.date(20261120); return true; })()`);
    // a script that waits on GAME time (the way every cutscene / dialogue beat waits) — it must not tick behind an ad
    await t.L(`import("./js/features/cameos/common.js").then(m => { window.__w = 0; (async () => { for (;;) { await m.wait(0.25); window.__w++; } })(); return true; })`);

    // ── a run from home, driving: no ad while she drives ──
    await t.click(/Cruise/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "home start", 5000)) return;
    t.check("the day list is on", await g(`ctx.day.active`));
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`["worldPullOut", "playing"].includes(__lulu3d.state)`, "in the car", 5000);
    await g(`L3.setState("playing")`);
    await t.hold(7, 1); await t.frames(40); await t.hold(7, 0);
    t.check("no ad while driving", !(await log()).includes("admob:showInterstitial"));

    // ── the knock-out (the 2nd break → its ad) ──
    await g(`(ctx.ads.debug.S.gameOvers = 1, true)`);
    await g(`(() => { ctx.traffic.config.enabled = true; for (let i = 0; i < 3; i++) { ctx.G.invT = 0; L3.damage(1, "test", "test"); } return true; })()`);
    t.check("no ad in the spin-out", !(await log()).includes("admob:showInterstitial") && (await g(`ctx.state`)) === "wrecked");
    if (!await realUntil(`window.__lulu3d.ctx.ads.holding`, 60000)) { t.check("the knock-out's ad shows", false, JSON.stringify(await log())); return; }
    const H1 = await g(`(() => { const h = ctx.ads.debug.S.hold; return { state: h.state, phase: h.phase, why: h.why }; })()`);
    t.check("the knock-out's ad starts once she's on her feet, walking", H1.why === "ko" && H1.state === "footRun" && H1.phase === "walk", JSON.stringify(H1));
    const a1 = await g(SNAP);
    await sleep(2500);
    const b1 = await g(SNAP);
    t.check("behind the ad NOTHING moved (time, frames, scripts, Lulu, traffic, the day list)", a1 === b1, a1 === b1 ? "" : `${a1}\n  vs ${b1}`);
    t.check("…the sound is held and the music paused", await t.L(`import("./js/audio.js").then(A => A.audioHeld() && A.musicPlaying().playing.length === 0)`));
    t.check("…and no pause menu was put up for it", !(await g(`ctx.paused`)));
    await t.shot("ko-ad-up");
    if (!await realUntil(`!window.__lulu3d.ctx.ads.holding`, 10000)) { t.check("the ad closes → the game comes back", false); return; }
    const f0 = await g(`ctx.frames`), w0 = await t.L(`window.__w`);
    await t.frames(20);
    t.check("after the ad, play continues (time + scripts move again)", (await g(`ctx.frames`)) > f0 && (await t.L(`window.__w`)) > w0);
    t.check("…the sound is back", await t.L(`import("./js/audio.js").then(A => !A.audioHeld())`));
    t.check("…she's still walking where she was", (await g(`ctx.state`)) === "footRun" && JSON.parse(b1).foot !== null);
    t.check("the hold ended on the plugin's 'dismissed'", (await g(`ctx.ads.debug.S.holds.at(-1).how`)) === "dismissed");

    // ── the 📺 rewarded ad from the pause menu holds the same way ──
    await t.key("Escape");
    await t.frames(3);
    const hasRw = await t.L(`!!document.querySelector('[data-pi="adReward"]')`);
    t.check("pause menu offers 📺 WATCH after the knock-out", hasRw);
    if (hasRw) {
      const c0 = await t.L(`window.__lulu3d.wallet.coins`);   // the live wallet (the save is written in a batch ~0.8 s later)
      await t.L(`document.querySelector('[data-pi="adReward"]').click()`);
      if (await realUntil(`window.__lulu3d.ctx.ads.holding`, 5000)) {
        const a2 = await g(SNAP); await sleep(2000); const b2 = await g(SNAP);
        t.check("rewarded: nothing moves behind it either", a2 === b2, a2 === b2 ? "" : `${a2}\n  vs ${b2}`);
      } else t.check("rewarded: holds", false);
      await realUntil(`!window.__lulu3d.ctx.ads.holding`, 10000);
      await t.frames(6);
      const c1 = await t.L(`window.__lulu3d.wallet.coins`);
      t.check("rewarded: pays +50 once", c1 - c0 === 50, `${c0} → ${c1}`);
      await t.key("Escape");
      await t.frames(3);
    }

    // ── jail: one ad in the quiet cell, nowhere else ──
    await g(`(ctx.ads.debug.S.holds.length = 0, ctx.law.arrest(["JAYWALKING WITH ATTITUDE"]), true)`);
    if (!await t.until(`(() => { const st = __lulu3d.ctx.law._dbg.jail(); return __lulu3d.state === "lawJail" && st && st.phase === "cell"; })()`, "booked into the cell", 120000)) return;
    t.check("no ad during the arrest or the booking", !(await g(`ctx.ads.holding`)) && (await g(`ctx.ads.debug.S.holds.length`)) === 0);
    if (await realUntil(`window.__lulu3d.ctx.ads.holding`, 60000)) {
      const H2 = await g(`(() => { const h = ctx.ads.debug.S.hold; return { state: h.state, why: h.why, phase: ctx.law._dbg.jail().phase, dialog: !!ctx.dialogOpen }; })()`);
      t.check("the jail ad starts in the quiet cell", H2.why === "jail" && H2.state === "lawJail" && H2.phase === "cell" && !H2.dialog, JSON.stringify(H2));
      const a3 = await g(SNAP); await sleep(2500); const b3 = await g(SNAP);
      t.check("behind the jail ad the court clock + the cellmate stand still", a3 === b3, a3 === b3 ? "" : `${a3}\n  vs ${b3}`);
      await t.shot("jail-ad-up");
      await realUntil(`!window.__lulu3d.ctx.ads.holding`, 10000);
      const ct0 = await g(`ctx.law._dbg.jail().courtT`);
      await t.frames(15);
      t.check("…and the court clock runs again after it", (await g(`ctx.law._dbg.jail() ? ctx.law._dbg.jail().courtT : -1`)) < ct0);
      await t.frames(90);
      t.check("once a stay (no second jail ad)", (await g(`ctx.ads.debug.S.holds.filter(h => h.why === "jail").length`)) === 1);
    } else t.check("a jail stay shows its ad", false, JSON.stringify((await log()).slice(-8)));

    // ── the plugin never answers → the game comes back after showWaitMs ──
    await t.L(`(window.__adMode = "hang", true)`);
    await g(`ctx.ads.debug.interstitial("hang")`);
    t.check("hang: holding", await g(`ctx.ads.holding`));
    const t0 = Date.now();
    const back = await realUntil(`!window.__lulu3d.ctx.ads.holding`, 10000);
    t.check("hang: the game comes back on its own (~2.5 s)", back && Date.now() - t0 < 6000 && (await g(`ctx.ads.debug.S.holds.at(-1).how`)) === "noshow", `${Date.now() - t0} ms`);
    // it appeared but never said it closed → maxAdMs
    await t.L(`(window.__adMode = "noDismiss", true)`);
    await g(`(ctx.ads.debug.ADMOB.maxAdMs = 3000, true)`);
    await g(`ctx.ads.debug.interstitial("lost")`);
    const t1 = Date.now();
    const back2 = await realUntil(`!window.__lulu3d.ctx.ads.holding`, 10000);
    t.check("lost 'dismissed': back after maxAdMs", back2 && (await g(`ctx.ads.debug.S.holds.at(-1).how`)) === "timeout", `${Date.now() - t1} ms`);
    const f1 = await g(`ctx.frames`);
    await t.frames(5);
    t.check("…and the game runs", (await g(`ctx.frames`)) > f1);
  },
};
