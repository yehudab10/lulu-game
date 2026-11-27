// 🐞 QA sweep, part 24 — DINA'S MODE STAYS OFFLINE AND UNTOUCHED (after ci/hud, ci/accounts, ci/moveout, ci/realestate),
// EVERY feature on, a LOCAL relay up (never production): out in the world she's online; into Dina's mode → no relay
// connection, no ghosts, no friends doorbell, no name card, no pop-up over her; coins unchanged; back out → online again.
const { startRelay, setWallCap } = require("../lib/party3d.js");
const PORT = 32500 + (process.pid % 20000);
let relay = null;

module.exports = {
  name: "qa24",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: `&enable=all&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`,
  save2d: { totalCoins: 444, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    relay = await startRelay(PORT);
    setWallCap(8 * 60000);
    try { await this.body(t); } catch (e) { t.check("qa24 threw", false, String(e && e.stack || e).slice(0, 400)); }
    finally { try { relay.kill(); } catch (e) { } }
  },
  async body(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "▶ PLAY: at home", 60000)) return;
    const online = await t.until(`__lulu3d.ctx.mp && __lulu3d.ctx.mp.connected`, "online out in the world (the EVERYONE room)", 30000);
    console.log("   online at home:", online);
    const c0 = await g(`L3.wallet.coins`);
    // into Dina's mode (the 👧 tile is hidden since 2026-11-22; the porch ✋ / ctx.dina.start is the way in)
    await g(`(ctx.dina.start(), true)`);
    if (!await t.until(`__lulu3d.ctx.dina.active`, "in Dina's mode", 30000)) return;
    let worst = { mp: false, ghosts: 0, bell: false, card: false };
    for (let i = 0; i < 20; i++) {
      await t.frames(15);
      const s = await g(`({ mp: !!(ctx.mp && ctx.mp.connected), ghosts: ctx.mp && ctx.mp.ghosts ? (ctx.mp.ghosts.size || ctx.mp.ghosts.length || 0) : 0,
        bell: !!document.querySelector(".fr-bell:not(.hidden), #friendBell:not(.hidden)"), card: !!document.getElementById("acctIdeas") || !!document.querySelector(".acct-card") })`);
      worst = { mp: worst.mp || s.mp, ghosts: Math.max(worst.ghosts, s.ghosts), bell: worst.bell || s.bell, card: worst.card || s.card };
    }
    await t.shot("dina-offline");
    t.check("Dina's mode: no relay connection the whole time", !worst.mp, JSON.stringify(worst));
    t.check("…no ghosts, no friends doorbell, no name card", !worst.ghosts && !worst.bell && !worst.card, JSON.stringify(worst));
    t.check("…coins untouched", (await g(`L3.wallet.coins`)) === c0, `${c0} → ${await g(`L3.wallet.coins`)}`);
    // back out: online again
    await g(`(ctx.dina.leave ? ctx.dina.leave() : ctx.onegame.home(), true)`);
    await t.until(`!__lulu3d.ctx.dina.active`, "out of Dina's mode", 30000);
    if (online) t.check("out of Dina's mode → online again", await t.until(`__lulu3d.ctx.mp && __lulu3d.ctx.mp.connected`, "back online", 40000));
  },
};
