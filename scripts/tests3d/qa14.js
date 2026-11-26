// 🐞 QA sweep, part 14 — THE NEW FIRST MINUTE + ONE WORLD (ci/hometown + ci/onemap), every feature on, the watchdog on:
// ▶ PLAY → on her porch on E 34th St → 🏠 GO INSIDE and back out → ✋ into her car → down E 34th St → out of Midwood by
// the real on-ramp (Ocean Pkwy south) → one full 16 km LAP of the highway (driven a stretch at a time, all the way round)
// → Midwood's exit again on the next lap → in → 🏠 home. No jump / NaN / camera in a wall / screen covered / stuck anywhere.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa14",
  query: "&enable=all,unstuck",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const ALL = ["jump", "nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "inside"];
    const seg = async (label, kinds = ALL) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const walk = async () => t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on her feet", 60000);

    // ── ▶ PLAY: her porch ──
    await t.click(/PLAY/);
    if (!t.check("▶ PLAY → on her feet at home", await walk())) return;
    t.check("…in Midwood", await g(`ctx.town.active && ctx.town.id === "midwood"`), await g(`ctx.town.id`));
    await t.frames(60);
    await seg("the first minute: the porch");

    // ── 🏠 GO INSIDE and back out ──
    if (await g(`!!(ctx.decor && ctx.decor.enter)`)) {
      await g(`(() => { const sp = ctx.town.spot("luluHome"), d = sp.door || sp, F = ctx.foot.debug.F; F.pos.set(d.x, 0.05, d.z); F.lulu.obj.position.copy(F.pos); ctx.cam.snap(); return true; })()`);
      await t.frames(6);
      await W.moved(t);
      const ok = await g(`ctx.decor.enter()`);
      if (t.check("🏠 GO INSIDE at her front door", ok) && await t.until(`__lulu3d.state === "interior" && window.__interiors && window.__interiors.room && window.__interiors.room.ready`, "inside her house", 60000)) {
        await t.frames(20);
        for (const [x, y, n] of [[0, -1, 30], [1, 0, 25], [0, 1, 30], [-1, 0, 25]]) { await t.stick(x, y); await t.frames(n); }
        await t.stick(0, 0);
        await t.shot("inside-home");
        await seg("inside her house: a walk round", ["nan", "overlay", "stuck"]);
        await W.moved(t);
        await g(`(window.__interiors.room.leave(), true)`);
        if (t.check("…and back out on her porch", await walk())) {
          await t.frames(30);
          const p = await g(`(() => { const sp = ctx.town.spot("luluHome"), d = sp.door || sp, F = ctx.foot.debug.F; return { d: +Math.hypot(F.pos.x - d.x, F.pos.z - d.z).toFixed(1), town: ctx.town.id, cov: window.__qa.covered() }; })()`);
          t.check("…by her front door, in Midwood, nothing covering the screen", p.d <= 12 && p.town === "midwood" && !p.cov.length, JSON.stringify(p));
          await seg("out of her house");
        }
      }
    }

    // ── ✋ into her car, down E 34th St ──
    await W.moved(t);
    const inCar = await g(`ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : false`);
    if (!t.check("✋ into her car at home", inCar && await t.until(`__lulu3d.state === "playing"`, "driving (after the pull-out of her driveway)", 30000))) return;
    await t.frames(20);
    await W.reset(t);
    await t.hold(7, 0.7); await t.frames(150); await t.hold(7, 0);
    await t.hold(6, 1); await t.frames(30); await t.hold(6, 0);
    await t.shot("driving-off");
    await seg("driving off from home");

    // ── out of Midwood by the real on-ramp ──
    const D = "ctx.town.debug";
    const E = await g(`${D}.S.exitS`);
    await W.moved(t);
    await g(`(ctx.law.hold(99999), ${D}.place("Ocean Pkwy", -290, -1.75, 12, -1), true)`);
    await t.frames(4);
    await W.reset(t);
    // (a per-frame trace of the car + the camera through the on-ramp: printed if the camera jumps there)
    await t.L(`(() => { const c = __lulu3d.ctx, PL = window.__places = [], P0 = c.car.place; c.car.place = function (...a) { PL.push([c.frames, +a[0].toFixed(1), +a[1].toFixed(1), (new Error().stack || "").split("\\n").slice(2, 6).map(l => l.trim().replace(/^at /, "").replace(/https?:\\/\\/[^/]+\\//, "")).join(" ← ")]); if (PL.length > 60) PL.shift(); return P0.apply(this, a); }; return true; })()`);
    await t.L(`(() => { const c = __lulu3d.ctx, T = window.__ramp = []; let f0 = -1; const rec = () => { if (!window.__ramp) return; if (c.frames !== f0) { f0 = c.frames; const k = c.camera.position, p = c.car.pos;
      T.push([c.frames, c.state, +p.x.toFixed(1), +p.z.toFixed(1), +k.x.toFixed(1), +k.z.toFixed(1), c.town.active ? 1 : 0, c.town.transitioning ? 1 : 0, c.cam && c.cam.mode, +(c.car.h || 0).toFixed(2), Math.round(c.car.s), +(+c.car.d).toFixed(1)]); if (T.length > 900) T.shift(); } requestAnimationFrame(rec); }; rec(); return true; })()`);
    await t.hold(7, 0.6);
    const out = await t.until(`!__lulu3d.ctx.town.active`, "south down Ocean Pkwy onto the on-ramp", 30000);
    await t.hold(7, 0);
    if (!t.check("out of Midwood by the on-ramp, onto the highway", out && await g(`ctx.car.s > ${E} + 150`), String(await g(`[Math.round(ctx.car.s - ${E}), ctx.car.d.toFixed(1)]`)))) return;
    await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
    await t.hold(7, 0.8); await t.frames(240); await t.hold(7, 0);
    const rr = await seg("the on-ramp + the highway");
    const fJ = ((rr.issues || []).find(i => i.kind === "jump") || {}).f;
    const jumps = fJ == null ? [] : await t.L(`(() => { const T = window.__ramp || [], i = T.findIndex(r => r[0] >= ${fJ}); window.__ramp = null; return i < 0 ? [] : T.slice(Math.max(0, i - 40), i + 8); })()`);
    if (fJ != null) console.log("   car.place calls round it:", JSON.stringify(await t.L(`(window.__places || []).filter(p => p[0] >= ${fJ} - 12 && p[0] <= ${fJ} + 4)`), null, 1));
    if (jumps.length) console.log("   on-ramp trace [f, state, car x, z, cam x, z, town, fade, cam mode, h, s, d]:\n     " + jumps.map(r => JSON.stringify(r)).join("\n     "));
    if (process.env.QA14_STOP === "ramp") return;

    // ── one full 16 km lap: a stretch at a time, all the way round ──
    const s0 = await g(`ctx.car.s`);
    const L = await g(`import("./js/world.js").then(W => W.LAP)`);
    t.check("the highway is a 16 km lap", L === 16000, String(L));
    const bad = [];
    for (let s = s0 + 800; s < s0 + L - 400; s += 800) {
      await W.moved(t);
      await g(`(() => { ctx.traffic.clear(); const p = ctx.world.highway.point(${s}, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = 5.25; ctx.car.vx = Math.sin(p.h) * 25; ctx.car.vz = Math.cos(p.h) * 25; ctx.world.prebuild && ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
      await t.frames(4);
      await W.reset(t);
      await t.hold(7, 0.8); await t.frames(60); await t.hold(7, 0);
      const r = await W.report(t);
      const st = await g(`({ s: Math.round(ctx.car.s), d: +ctx.car.d.toFixed(1), state: L3.state, town: !!ctx.town.active, v: +Math.hypot(ctx.car.vx, ctx.car.vz).toFixed(1) })`);
      const kinds = [...new Set((r.issues || []).map(i => i.kind).filter(k => ["jump", "nan", "overlay", "flat", "underground", "stuck"].includes(k)))];
      if (kinds.length || st.state !== "playing" || st.town || !(st.v > 5) || Math.abs(st.d) > 14) bad.push({ lap: Math.round((s - s0) % L), st, kinds, first: (r.issues || []).slice(0, 2).map(i => i.msg.slice(0, 160)) });
      await W.reset(t);
    }
    console.log("   lap stretches with trouble:", JSON.stringify(bad).slice(0, 1500));
    t.check("one full 16 km lap: every stretch drives clean (on the road, moving, nothing flagged)", bad.length === 0, JSON.stringify(bad).slice(0, 600));
    await t.shot("lap-end");

    // ── Midwood's exit again on the next lap → in → home ──
    const E2 = await g(`ctx.town.exitOf("midwood", ${s0} + ${L} - 2000)`);
    t.check("Midwood's exit comes round again one lap on (the same lap metre)", E2 != null && Math.abs(((E2 - E) % L + L) % L) < 2, JSON.stringify({ E, E2 }));
    if (E2 != null) {
      await W.moved(t);
      await g(`(() => { const s = ${E2} - 240, p = ctx.world.highway.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.cam.snap(); return true; })()`);
      await g(`ctx.town.enter({ town: "midwood", exitS: ${E2}, speed: 0 })`);
      if (t.check("into Midwood at its exit on the next lap", await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "in Midwood again", 30000))) {
        await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
        await t.frames(20);
        // 🌍 her house on E 34th St on THIS lap's Midwood (features/world builds it at ctx.town.home's exit — lap 0's)
        const hl = await g(`(() => { const sp = ctx.town.spot("luluHome"), lot = ctx.home && ctx.home.lot; return { spot: sp ? [Math.round(sp.x), Math.round(sp.z)] : null, house: lot ? [Math.round(lot.x), Math.round(lot.z)] : null, homeExit: ctx.town.home && ctx.town.home.exitS, here: ctx.town.debug.S.exitS }; })()`);
        t.check("one lap on, her house stands on E 34th St in this Midwood too", !!(hl.spot && hl.house && Math.hypot(hl.spot[0] - hl.house[0], hl.spot[1] - hl.house[1]) < 2), JSON.stringify(hl));
        await t.shot("lap2-e34");
        await W.moved(t);
        await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home() : 0, true)`);
        if (t.check("🏠 home: on her feet", await walk())) {
          await t.frames(30);
          const h = await g(`(() => { const sp = ctx.town.spot("luluHome"), d = sp.door || sp, F = ctx.foot.debug.F; return { town: ctx.town.id, d: +Math.hypot(F.pos.x - d.x, F.pos.z - d.z).toFixed(1), cov: window.__qa.covered() }; })()`);
          t.check("…at her own door on E 34th St, nothing covering the screen", h.town === "midwood" && h.d <= 25 && !h.cov.length, JSON.stringify(h));
          await seg("back in Midwood → home after a lap");
        }
      }
    }
  },
};
