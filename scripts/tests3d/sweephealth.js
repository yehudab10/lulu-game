// 🩺 ci/sweep-health (Shabbos fix sweep 2026-11-27 → 11-28): small checks for the fixes the sweep made that no
// feature test covered. Notes: 3d/docs/sweeps/sweep-health.md.
//   • a pothole is one pop-up at most: the jolt + Lulu's line, never a "🕳️ POTHOLE!" toast on top of her line
//     (calm's solo highway minute went over budget on it)
module.exports = {
  name: "sweephealth",
  viewport: { width: 1280, height: 720 },
  query: "&enable=all",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts", 120000)) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

    // ── a pothole: the bump counts, no toast ──
    await t.L(`import("./js/core/ctx.js").then(m => { window.__st = []; m.on("stat", e => { if (e && e.id === "potholes") window.__st.push(e.n); });
      window.__toasts = []; new MutationObserver(() => { for (const el of document.querySelectorAll("#toasts .toast")) window.__toasts.push(el.textContent); })
        .observe(document.body, { childList: true, subtree: true, characterData: true }); return true; })`);
    await g(`(() => { const c = ctx.car, r = ctx.world.road, p = r.point(c.s, 5.25, {}); c.place(p.x, p.z, p.h); c.s = p.s != null ? p.s : c.s; c.d = 5.25;
      c.vx = Math.sin(p.h) * 14; c.vz = Math.cos(p.h) * 14; c.vF = 14; return true; })()`);
    await g(`ctx.roadevents.spawn("pothole", { s: ctx.car.s + 30, d: ctx.car.d })`);
    await t.hold(7, 0.6);
    await t.until(`window.__st.length > 0`, "she drives over the pothole", 20000);
    await t.hold(7, 0);
    await t.frames(20);
    t.check("a pothole: the bump is counted (stat potholes)", await t.L(`window.__st.length`) >= 1, JSON.stringify(await t.L(`window.__st`)));
    const toasts = await t.L(`window.__toasts.filter(x => /POTHOLE/i.test(x))`);
    t.check("a pothole: no '🕳️ POTHOLE!' toast on top of Lulu's line", !toasts.length, JSON.stringify(toasts));

    // ── 📱 🗺️ Map: tapping the place she's standing at says so (it used to ping + close the phone on nothing: "arrived" at once) ──
    await t.hold(7, 0);
    await g(`(ctx.onegame.home(), true)`);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "home on foot", 120000)) return;
    await t.frames(10);
    const homeId = await g(`(() => { const ids = ctx.pins.list().filter(p => p.home).map(p => p.id); return ids.find(id => ctx.pins.arrivedAt(id)) || null; })()`);
    t.check("at home: a home place counts as 'she's here'", !!homeId, String(homeId));
    if (homeId) {
      await g(`(ctx.phone.isOpen && ctx.phone.closePhone(), ctx.phone.openPhone("lapmap"), true)`);
      await t.frames(6);
      const clicked = await t.L(`(() => { const b = document.querySelector('#lpApp [data-pin="${homeId}"]'); if (!b) return false; b.click(); return true; })()`);
      await t.frames(6);
      const after = await g(`({ open: ctx.phone.isOpen, ping: ctx.pins.current || null })`);
      const row = await t.L(`(document.querySelector('#lpApp [data-pin="${homeId}"]') || {}).textContent || ""`);
      t.check("🗺️ Map: a tap on the place she's at keeps the phone open, pings nothing, the row says 'you're here'", clicked && after.open && !after.ping && /you're here/.test(row), JSON.stringify({ clicked, after, row: row.slice(0, 80) }));
      await g(`(ctx.phone.closePhone(), true)`);
    }
  },
};
