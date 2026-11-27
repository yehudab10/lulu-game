// 🐞 QA sweep, part 26b — THE 📱 PHONE on a phone ON ITS SIDE (667 × 375, fingers): qa26's fit checks — every app opens on
// foot and driving, every control inside the handset, ≥ 40 px, nothing clipped; 💼 Jobs' reason on screen (it opened
// scrolled to the bottom, the reason off the top, under six greyed-out rows).
const W = require("../lib/qawatch.js");
const A = require("./qa26.js");

module.exports = {
  name: "qa26b",
  viewport: { width: 667, height: 375 },
  hasTouch: true,
  query: "&enable=all",
  save2d: A.save2d,
  save3d: A.save3d,
  async run(t) { try { await this.body(t); } finally { W.dropRelayErrors(t); } },
  async body(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "▶ PLAY: at home", 60000)) return;
    await t.frames(30);
    await A.fitAll(t, "on its side, on foot");
    await A.openP(t, "jobs");
    const why = await t.L(`(() => { const n = document.querySelector("#lpApp .lp-note"), sc = document.querySelector("#lpBody"); if (!n) return null; const r = n.getBoundingClientRect(), s = (document.getElementById("lpApp").closest(".lp-appbody") || sc).getBoundingClientRect(); return { top: Math.round(r.top), bot: Math.round(r.bottom), s: [Math.round(s.top), Math.round(s.bottom)], t: n.textContent }; })()`);
    t.check("💼 Jobs on its side: the reason she can't take one is ON screen", !!why && why.top >= why.s[0] - 1 && why.bot <= why.s[1] + 1, JSON.stringify(why));
    await g(`(ctx.phone.closePhone(), true)`);
    await g(`(ctx.foot.active && ctx.foot.end && ctx.foot.end("test"), L3.startRun({ mode: "cruise", quick: true }))`);
    if (await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "driving", 20000)) {
      await t.frames(20);
      await g(`(ctx.G.invT = 1e6, ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
      await A.fitAll(t, "on its side, driving");
    }
  },
};
