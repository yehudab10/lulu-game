// ⏱️ The home start's cost on a phone (roadmap 14: Lulu lives in Midwood — "keep the title → walking time about what it
// is now"). For LOW and MEDIUM graphics, on a phone-sized landscape screen:
//   • boot → the title screen (ms, real time)
//   • ▶ PLAY → walking at home (ms, real time)
//   • the first 10 s at home (300 game frames): real ms per frame — p50 / p95 / max — plus draw calls and triangles
// Prints one PERF line per quality; the checks are loose guards (the numbers are for before / after comparisons —
// software WebGL on a CI runner is far slower than a phone, so only the ratios mean anything).
module.exports = {
  name: "homeperf",
  viewport: { width: 844, height: 390 },
  query: "&enable=world,foot,day,town,decor,exits,community",
  save2d: { totalCoins: 300 },
  async run(t) {
    const g = t.game;
    const out = {};
    for (const q of ["low", "medium"]) {
      // a fresh boot at this quality (the 3D save's settings), timed from navigation
      // (through the game's own save: it writes itself on pagehide, so a localStorage edit would be overwritten)
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = "${q}"; m.saveNow(); return true; })`);
      const url = new URL(t.page.url());
      const t0 = Date.now();
      await t.page.goto(url.href);
      if (!await t.until(`window.__lulu3d && __lulu3d.state === "title"`, `${q}: boots to the title`, 120000)) return;
      const boot = Date.now() - t0;
      await t.frames(30);
      // (home in a town — roadmap 14: the town engine builds it in slices behind the title; a player who taps ▶ PLAY
      //  before that's done gets the rest in one go. `early`: measured before it's built; then the normal case)
      const town = await g(`!!(ctx.town && ctx.town.home)`);
      let built = null;
      if (town && q === "low") {
        const tb = Date.now(), fb = await g(`ctx.frames`);
        await t.until(`(__lulu3d.ctx.town.standing || []).some(s => s.town === __lulu3d.ctx.town.home.town && s.ready)`, `${q}: home town built behind the title`, 120000);
        built = { ms: Date.now() - tb, frames: (await g(`ctx.frames`)) - fb };
      }
      // ▶ PLAY → walking at home
      const t1 = Date.now();
      await t.click(/PLAY/);
      if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${q}: walking at home`, 30000)) return;
      const walk = Date.now() - t1;
      // the first 10 s: real frame intervals + what's drawn
      await t.L(`(() => { const r = __lulu3d.renderer; window.__hp = { dts: [], calls: 0, tris: 0, n: 0, last: performance.now() };
        if (!window.__hpWrap) { window.__hpWrap = true; const o = r.render.bind(r); r.render = (s, c) => { o(s, c); const P = window.__hp; if (!P) return; const now = performance.now(); P.dts.push(now - P.last); P.last = now; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; }; } })()`);
      await t.frames(300);
      const R = await t.L(`(() => { const P = window.__hp; window.__hp = null; const d = P.dts.slice(1).sort((a, b) => a - b), pc = f => +d[Math.min(d.length - 1, Math.floor(d.length * f))].toFixed(1);
        return { p50: pc(0.5), p95: pc(0.95), max: +d[d.length - 1].toFixed(1), calls: Math.round(P.calls / P.n), tris: Math.round(P.tris / P.n), tier: __lulu3d.ctx.gfx ? __lulu3d.ctx.gfx.tier : "?", town: !!(__lulu3d.ctx.town && __lulu3d.ctx.town.active) }; })()`);
      out[q] = Object.assign({ boot, walk }, built ? { titleBuild: built } : {}, R);
      console.log(`   PERF home ${q}`, JSON.stringify(out[q]));
      t.check(`${q}: title → walking at home in < 15 s (real time)`, walk < 15000, `${walk} ms`);
    }
  },
};
