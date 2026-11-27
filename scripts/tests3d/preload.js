// 📥 Loading in the right order (roadmap 37e, models.js › the download line) — measured first with scripts/perfstart.js:
// on a slow phone network the title used to start ~150 model downloads at once and ▶ PLAY's home start waited behind
// all of them. Checks:
//   • the title is up and interactive BEFORE any warm-up work starts (never before first paint)
//   • the warm-up is the home start's models, capped (a memory ceiling for phones), and the heap stays sane
//   • ▶ PLAY pressed while the warm-up is still going works (she starts at home, on foot)
//   • ▶ PLAY → walking at home is not slower with the warm-up than without (?noline&nopreload, same build)
//   • on a SLOW connection (CDP throttle) the line kicks in: only a few title-time downloads at once, the home street
//     still arrives, and ▶ PLAY still starts her at home
const Q = "&enable=preload,world,foot,day,town,decor,exits,community";

module.exports = {
  name: "preload",
  viewport: { width: 844, height: 390 },
  query: Q,
  save2d: { totalCoins: 300, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { best: 1000, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const info = () => t.L(`import("./js/models.js").then(m => m.downloadInfo())`);
    // (until() checks are synchronous: keep a handle on the home module)
    const grabHome = () => t.L(`import("./js/features/world/home.js").then(m => { window.__wh = m.home; return true; })`);
    const HOME_READY = `!!(window.__wh && __wh.ready)`;
    const atHome = `__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`;
    const base = t.page.url().split("?")[0];
    const go = async (extra = "") => { await t.page.goto(`${base}?test${Q}${extra}`); const ok = await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "boots to the title", 120000); await grabHome(); return ok; };
    const playTime = async () => {
      await t.until(`!!document.querySelector("#screenCard #play")`, "▶ PLAY is up", 30000);
      const t0 = Date.now();
      await t.click(/PLAY/);
      if (!await t.until(atHome, "walking at home", 120000)) return null;
      return Date.now() - t0;
    };

    // ── 1. the title first, the warm-up after it ──
    await t.until(`!!document.querySelector("#screenCard #play")`, "▶ PLAY is up", 30000);
    await t.until(`window.__lulu3d && __lulu3d.frames > 0`, "frames", 5000);
    let I = await info();
    for (let i = 0; i < 40 && !I.kicked; i++) { await t.frames(5); I = await info(); }
    t.check("the warm-up starts behind the title (after it's up)", I.kicked && I.titleAt > 0 && I.kickedAt >= I.titleAt, JSON.stringify(I));
    t.check("the warm-up is the home start's models, capped for phones", I.warmed > 0 && I.warmed <= I.max, `${I.warmed} ≤ ${I.max}`);
    const heap = await t.L(`performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : 0`);
    t.check("the heap stays sane on the title (≤ 400 MB)", heap <= 400, `${heap} MB`);

    // ── 2. ▶ PLAY pressed while the warm-up is still going ──
    await go();
    const early = await playTime();
    t.check("▶ PLAY during the warm-up still starts her at home, on foot", early != null, `${early} ms`);
    await t.shot("early-play");

    // ── 3. not slower than without it (same build: ?noline&nopreload ≈ main) ──
    await go("&noline&nopreload");
    await t.until(HOME_READY, "home ready (before)", 120000);
    await t.frames(60);
    const before = await playTime();
    await go();
    await t.until(HOME_READY, "home ready (after)", 120000);
    await t.frames(60);
    const after = await playTime();
    console.log(`   PERF preload PLAY→home: before ${before} ms · after ${after} ms`);
    t.check("▶ PLAY → walking at home is not slower with the warm-up (≤ before × 1.25 + 0.5 s)", before != null && after != null && after <= before * 1.25 + 500, `${before} → ${after} ms`);

    // ── 4. a slow connection: the line ──
    const cdp = await t.page.context().newCDPSession(t.page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 400 * 1024 / 8 });
    await go();
    let maxOut = 0, slow = false;
    for (let i = 0; i < 60; i++) {
      I = await info(); slow = slow || I.slow;
      if (I.slow) maxOut = Math.max(maxOut, I.out - I.now);
      if (I.slow && I.line > 0 && I.out <= I.slots) break;
      await t.page.waitForTimeout(1000);
    }
    t.check("a slow connection is noticed (measured on the first downloads)", slow, JSON.stringify(I));
    t.check("…and title-time downloads go a few at a time (the line)", maxOut <= I.slots + 1, `${maxOut} out, ${I.slots} slots`);
    const ready = await t.until(HOME_READY, "the home street arrives on a slow connection", 600000);
    t.check("…the home street still arrives first", ready);
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (ready) {
      const p = await playTime();
      t.check("…and ▶ PLAY starts her at home", p != null, `${p} ms`);
    }
  },
};
