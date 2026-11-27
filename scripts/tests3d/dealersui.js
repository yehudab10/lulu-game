// 🏎️⚡ THE DEALERS' SCREENS ON EVERY SCREEN (the owner, 2026-11-27: "the player isn't able to switch between vehicles to
// compare stats since it brings up the sales person right away … make the ui look better and more luxury … the tushla
// dealership should also be more of a Tesla experience"):
//   • the Mazelati card + the Tushla configurator fit a phone held upright and on its side, a small phone and a laptop:
//     on screen, no sideways overflow, readable type, the main button reachable
//   • a swipe on the Mazelati card flips to the next car (no Sal); on the configurator a model tap changes the price
//   • pictures of both for the owner
const VIEWS = [["phone", 390, 844], ["phone-land", 844, 390], ["small-land", 667, 375], ["desktop", 1280, 720]];
module.exports = {
  name: "dealersui",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "",
  save2d: { totalCoins: 20000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "a run starts", 60000)) return;
    if (!await g(`ctx.foot.active`)) { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000); }
    const fits = sel => t.L(`(() => { const c = document.querySelector("#screenCard"), r = c.getBoundingClientRect(), W = innerWidth, H = innerHeight;
      const small = [...c.querySelectorAll("${sel}")].map(e => parseFloat(getComputedStyle(e).fontSize)).reduce((a, b) => Math.min(a, b), 99);
      const act = c.querySelector(".menu .btn"); return { on: r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1, over: c.scrollWidth - c.clientWidth, small, act: !!act, w: Math.round(r.width), h: Math.round(r.height), W, H }; })()`);
    for (const [name, w, h] of VIEWS) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.frames(6);
      // Mazelati
      await g(`(ctx.dealers.open("kvetchtoria"), true)`); await t.frames(4);
      const L = await fits(".lux-row b, .lux-row em, .lux-perks div");
      t.check(`${name}: the Mazelati card fits (on screen, no sideways scroll, type ≥ 11 px)`, L.on && L.over <= 1 && L.small >= 11 && L.act, JSON.stringify(L));
      await t.shot(`lux-${name}`);
      if (name === "phone") {
        // a swipe → the next car; Sal stays put
        await t.L(`(() => { const e = document.querySelector("#screenCard .lux"), r = e.getBoundingClientRect(), y = r.top + r.height / 2;
          e.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.right - 30, clientY: y, bubbles: true })); e.dispatchEvent(new PointerEvent("pointerup", { clientX: r.left + 30, clientY: y, bubbles: true })); })()`);
        await t.frames(3);
        t.check("phone: a swipe flips to the next car — no salesman", await t.L(`(document.querySelector("#screenCard .lux") || {}).dataset.lux`) === "machatunim" && !await g(`ctx.dealers.debug.D.busy`));
      }
      await g(`(ctx.dealers.debug.lux.close(), true)`); await t.frames(3);
      // Tushla
      await g(`(ctx.dealers.tablet("tushla_shh"), true)`); await t.frames(4);
      const T = await fits(".tsl-opts .btn, .tsl-g, .tsl-specs small");
      t.check(`${name}: the Tushla configurator fits (on screen, no sideways scroll, type ≥ 11 px)`, T.on && T.over <= 1 && T.small >= 11 && T.act, JSON.stringify(T));
      if (name === "phone" || name === "phone-land") {
        await t.L(`document.querySelector('#screenCard [data-tg="paint"][data-to="pepper"]').click()`); await t.frames(3);
        t.check(`${name}: a tap on a paint → the price updates (16,000 + 450)`, /16,450/.test(await t.L(`document.querySelector("#tslOrder").textContent`)));
      }
      await t.shot(`tushla-${name}`);
      await g(`(ctx.dealers.debug.ev.config.close(), true)`); await t.frames(3);
    }
  },
};
