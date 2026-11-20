// 🐞 QA on a PHONE (touch), every feature on: on foot, in portrait and in landscape, every button a thumb can reach
// (the stick, JUMP, ROLL, ✋, the extra touch buttons, 📱, ❚❚, emotes…) is on screen and no two overlap; the ✋ prompt
// line isn't under the right thumb's buttons. Then the same in the car (pedals vs. the rest).
const W = require("../lib/qawatch.js");
const OVER = 4;      // px of overlap we tolerate (rounded corners / shadows)

module.exports = {
  name: "qatouch",
  query: "&enable=all",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const layout = () => t.L(`(() => {
      const out = [], W = innerWidth, H = innerHeight;
      const els = document.querySelectorAll("#touch button, #touch #stickBase, #phoneBtn, #pauseBtn, #skipBtn, button.tbtn, [id^=tx_], #mpChips button, #owChip, #ptChip");
      for (const e of els) {
        const cs = getComputedStyle(e);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.pointerEvents === "none" || +cs.opacity < 0.2) continue;
        let hidden = false; for (let n = e; n && n !== document.body; n = n.parentElement) { const c = getComputedStyle(n); if (c.display === "none" || c.visibility === "hidden" || n.classList.contains("hidden")) { hidden = true; break; } }
        if (hidden) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        out.push({ id: e.id || e.className, l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom) });
      }
      const pr = document.querySelector("#padHint, .prompt, #prompt");
      let prompt = null;
      for (const p of document.querySelectorAll("#prompt, .prompt, #padHint")) { const r = p.getBoundingClientRect(); if (r.width > 4 && getComputedStyle(p).display !== "none" && p.textContent.trim()) prompt = { id: p.id || p.className, text: p.textContent.trim().slice(0, 40), l: r.left, t: r.top, r: r.right, b: r.bottom }; }
      return { W, H, out, prompt };
    })()`);
    const judge = (L, tag) => {
      const off = L.out.filter(a => a.l < -2 || a.t < -2 || a.r > L.W + 2 || a.b > L.H + 2);
      t.check(`${tag}: every button is on screen`, off.length === 0, JSON.stringify(off));
      const bad = [];
      for (let i = 0; i < L.out.length; i++) for (let j = i + 1; j < L.out.length; j++) {
        const a = L.out[i], b = L.out[j];
        const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        const inside = (a.l >= b.l && a.r <= b.r && a.t >= b.t && a.b <= b.b) || (b.l >= a.l && b.r <= a.r && b.t >= a.t && b.b <= a.b);
        if (ox > OVER && oy > OVER && !inside) bad.push(`${a.id} × ${b.id}`);
      }
      t.check(`${tag}: no two buttons overlap`, bad.length === 0, bad.join(" | ") + " — " + JSON.stringify(L.out.map(a => a.id)));
      return L;
    };
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/Cruise|PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "starts on foot at home", 6000)) return;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.frames(20);
    // stand by the car so the ✋ shows
    await g(`(() => { const F = ctx.foot.debug.F, c = F.car.stub; F.pos.set(c.x + Math.cos(c.h) * 2.0, 0.05, c.z - Math.sin(c.h) * 2.0); return true; })()`);
    await t.frames(6);
    let L = judge(await layout(), "portrait, on foot");
    await t.shot("portrait-foot");
    if (L.prompt) {
      const thumb = L.out.filter(a => /tJump|tRoll|tx_/.test(a.id));
      const under = thumb.filter(a => Math.min(a.r, L.prompt.r) - Math.max(a.l, L.prompt.l) > OVER && Math.min(a.b, L.prompt.b) - Math.max(a.t, L.prompt.t) > OVER);
      t.check("portrait, on foot: the prompt line isn't under a thumb button", under.length === 0, JSON.stringify({ prompt: L.prompt, under }));
    }
    await t.page.setViewportSize({ width: 844, height: 390 });
    await t.frames(10);
    L = judge(await layout(), "landscape, on foot");
    if (L.prompt) {
      const under = L.out.filter(a => !/phoneBtn|pauseBtn/.test(a.id) && Math.min(a.r, L.prompt.r) - Math.max(a.l, L.prompt.l) > OVER && Math.min(a.b, L.prompt.b) - Math.max(a.t, L.prompt.t) > OVER);
      t.check("landscape, on foot: the prompt line isn't under a button", under.length === 0, JSON.stringify({ prompt: L.prompt, under }));
    }
    await t.shot("landscape-foot");
    // in the car
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`__lulu3d.state === "worldPullOut" || __lulu3d.state === "playing"`, "in the car", 3000);
    await t.frames(10);
    judge(await layout(), "landscape, in the car");
    await t.shot("landscape-car");
    await t.page.setViewportSize({ width: 390, height: 844 });
    await t.frames(10);
    judge(await layout(), "portrait, in the car");
    await t.shot("portrait-car");
  },
};
