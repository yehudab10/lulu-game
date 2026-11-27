// 🐞 QA sweep, part 19 — THE NAME CARD AS A PLAYER (ci/accounts), on a phone (412 × 915, fingers), EVERY feature on,
// against the LOCAL relay (never production):
//   • fresh start, server up: the card over the title fits the phone; "Later" → the title → ▶ PLAY → at home, and no
//     name card (or any account card) while she plays; back on the title it isn't asked again right away
//   • the server goes DOWN while the card is open: picking a name says so plainly, "Later" still works, ▶ PLAY works
//   • ⚙️ › 🪪 › delete my online account, then play on: coins untouched, ▶ PLAY works, no card pops up in play
const { startRelay, setWallCap } = require("../lib/party3d.js");
const W = require("../lib/qawatch.js");
const PORT = 31500 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const Q = `&enable=all&acctname=1&mpurl=${encodeURIComponent(URL)}`;
let relay = null;

module.exports = {
  name: "qa19",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: Q,
  save2d: { totalCoins: 321, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(10 * 60000);
    try { await this.body(t); } catch (e) { t.check("qa19 threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally { try { relay.kill(); } catch (e) { } W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    const card = () => t.L(`!!document.getElementById("acctIdeas")`);
    const fits = () => t.L(`(() => { const c = document.getElementById("screenCard"); if (!c) return "no card"; const r = c.getBoundingClientRect();
      const btns = [...c.querySelectorAll("button, input")].filter(b => b.offsetParent !== null).map(b => b.getBoundingClientRect());
      return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && !btns.some(b => b.bottom > innerHeight + 1 || b.right > innerWidth + 1) ? "" : JSON.stringify({ r: [r.left, r.top, r.right, r.bottom].map(Math.round), W: innerWidth, H: innerHeight }); })()`);
    const coins = () => g(`L3.wallet.coins`);
    // (the page booted before the relay was listening on some machines: back to the title once so it asks)
    if (!await t.until(`!!document.getElementById("acctIdeas")`, "the name card over the title", 20000)) {
      await g(`(L3.setState("title"), true)`);
      if (!await t.until(`!!document.getElementById("acctIdeas")`, "the name card over the title (2nd try)", 20000)) return;
    }
    // ── 1 · Later → PLAY: no card in play; not asked again right away ──
    t.check("the name card fits a 412 × 915 phone", (await fits()) === "", await fits());
    await t.shot("name-card");
    const c0 = await coins();
    await t.L(`document.getElementById("acctLater").click()`);
    await t.frames(10);
    t.check("Later → the card is gone, the title is back", !await card() && await g(`L3.state === "title"`) && await t.L(`!!document.querySelector("#screenCard [data-title-seq]")`));
    await W.install(t);
    await t.click(/PLAY/);
    t.check("▶ PLAY → on her feet at home", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "at home", 60000));
    let popped = false;
    for (let i = 0; i < 20; i++) { await t.frames(15); if (await card() || await t.L(`!!document.querySelector(".acct-card")`)) { popped = true; break; } }
    t.check("…and no name card pops up while she plays (10 s)", !popped);
    await g(`(L3.setState("title"), true)`);
    await t.frames(60);
    t.check("back on the title after 'Later': not asked again right away", !await card());
    // (the first run of a day pays the daily streak — 25 × streak, once a day, as ever: meta/progress.js)
    const dc = (await coins()) - c0;
    t.check("…coins untouched (apart from the once-a-day streak, 25 × n)", dc === 0 || (dc > 0 && dc % 25 === 0 && dc <= 175), `${c0} → ${await coins()}`);

    // ── 2 · the server goes down while the card is open ──
    // (⚙️ › 🪪 Your name › 🪪 Pick a name: the same card)
    await t.L(`import("./js/features/accounts/ui.js").then(m => (m.accountCard(() => __lulu3d.L3.H.hideScreen()), true))`);
    await t.frames(5);
    await t.L(`(() => { const b = document.getElementById("acctPick"); if (b) b.click(); return !!b; })()`);
    if (await t.until(`!!document.getElementById("acctIdeas")`, "the name card again (for the server-down case)", 10000)) {
      relay.kill();
      await new Promise(r => setTimeout(r, 1500));
      await t.L(`(() => { const b = document.getElementById("acctIdea0"); if (b) b.click(); return !!b; })()`);
      await t.until(`!/Checking/.test((document.getElementById("acctWhy") || {}).textContent || "")`, "the answer (server down)", 20000);
      const why = await t.L(`(document.getElementById("acctWhy") || {}).textContent || ""`);
      console.log("   server down, picked an idea →", JSON.stringify(why));
      t.check("server down: picking a name says so plainly (not stuck on 'Checking…', no silent nothing)", why.length > 3 && !/Checking/.test(why), why);
      await t.L(`(() => { const b = document.getElementById("acctLater"); if (b) b.click(); return true; })()`);
      await t.frames(10);
      t.check("…Later still closes it", !await card());
      await t.L(`import("./js/core/screens.js").then(m => (m.showTitle(true), true))`);
      await t.frames(20);
      await t.click(/PLAY/);
      t.check("…and ▶ PLAY works with the server down", await t.until(`__lulu3d.state === "footRun"`, "playing offline", 60000));
    } else console.log("   (no way to reopen the first-time card from a test: skipped the server-down case)");
    relay = await startRelay(PORT);
    await g(`(L3.state !== "title" ? L3.setState("title") : 0, true)`);
    await t.frames(30);
    if (await card()) { await t.L(`document.getElementById("acctLater").click()`); await t.frames(10); }
    await t.L(`import("./js/core/screens.js").then(m => (m.showTitle(true), true))`);
    await t.frames(10);
    // (a name, so there's an account on this relay to delete)
    console.log("   a name for the delete case →", JSON.stringify(await g(`ctx.accounts.setName("Qa Kugel " + Math.floor(Math.random() * 900 + 100))`)));

    // ── 3 · delete my online account, then play on ──
    const has = await g(`!!(ctx.accounts && ctx.accounts.deleteAccount)`);
    if (has) {
      const c1 = await coins();
      const ok = await g(`ctx.accounts.deleteAccount()`);
      console.log("   delete my online account →", ok);
      await t.frames(30);
      await t.click(/PLAY/);
      t.check("deleted the account → ▶ PLAY still works", await t.until(`__lulu3d.state === "footRun"`, "playing after delete", 60000));
      popped = false;
      for (let i = 0; i < 20; i++) { await t.frames(15); if (await card()) { popped = true; break; } }
      t.check("…no name card pops up in play after deleting", !popped);
      t.check("…coins, cars, progress untouched", (await coins()) === c1, `${c1} → ${await coins()}`);
    } else console.log("   (no delete call on ctx.accounts)");
    const r = await W.report(t); W.log(r); W.check(t, "the watchdog", r, ["nan", "overlay", "stuck"]);
  },
};
