// 🖼️ Graphics setting (core/quality.js, gfx.js, post.js): ⚙️ Settings → 🖼️ Graphics cycles
// AUTO → HIGH → MEDIUM → LOW with the controller, the keyboard and touch; the choice lands in the 3D
// save and survives a reload; each tier really changes the renderer (shadows, pixel ratio, draw
// distance, contact shadows, bloom); bloom steps aside cleanly where half-float targets don't work;
// AUTO slides the resolution and steps a tier down on a slow device, but leaves a 30 fps-capped
// display alone; and every tier drives a stormy night with no errors.
const SETTINGS = { quality: "auto", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "off", hud: 1, hudMode: "full", chatter: "normal" };

module.exports = {
  name: "gfx",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { best: 1000, settings: SETTINGS, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const label = () => t.L(`(document.querySelector("#set_quality b") || {}).textContent || ""`);
    const saved = () => t.L(`(JSON.parse(localStorage.getItem("lulu3dSave") || "{}").settings || {}).quality`);
    const focusId = () => t.L(`(document.querySelector("#screenCard .focus") || {}).id || ""`);
    const state = () => g(`(() => { const r = L3.renderer, G = L3.gfx; return { setting: G.setting, tier: G.tier, shadows: r.shadowMap.enabled, size: ctx.lights.sun.shadow.mapSize.x,
      pr: r.getPixelRatio(), draw: ctx.world.drawScale, blob: G.T.blob, post: G.T.post }; })()`);
    const openSettings = async () => {
      await t.click(/Settings/);
      return t.until(`!!document.getElementById("set_quality")`, "⚙️ Settings opens", 20000);
    };

    // ── the default: AUTO (a ?test run keeps the desktop guess → HIGH) ──
    let s = await state();
    t.check("AUTO by default, resolved to a tier", s.setting === "auto" && s.tier === "high", JSON.stringify(s));
    if (!await openSettings()) return;
    t.check("the row says AUTO and the tier it picked", /AUTO · HIGH/.test(await label()), await label());
    await t.shot("settings-auto");

    // ── controller: D-pad onto the row, ✕ → HIGH ──
    for (let i = 0; i < 12 && await focusId() !== "set_quality"; i++) await t.tap(12);   // (it's the first row: up until it has the focus)
    t.check("the D-pad reaches 🖼️ Graphics", await focusId() === "set_quality", await focusId());
    await t.tap(0);
    t.check("✕ cycles to HIGH", /^HIGH$/.test(await label()), await label());
    t.check("…and the focus stays on the row", await focusId() === "set_quality", await focusId());
    s = await state();
    t.check("HIGH: 2048 sun shadows, full draw distance", s.tier === "high" && s.shadows && s.size === 2048 && s.draw === 1, JSON.stringify(s));

    // ── keyboard: Enter → MEDIUM ──
    await t.key("Enter");
    t.check("Enter cycles to MEDIUM", /^MEDIUM$/.test(await label()), await label());
    s = await state();
    t.check("MEDIUM: 1024 shadows, 85 % draw distance, no bloom", s.tier === "medium" && s.shadows && s.size === 1024 && s.draw === 0.85 && !s.post, JSON.stringify(s));

    // ── touch / mouse: click → LOW ──
    await t.page.click("#set_quality");
    await t.frames(2);
    t.check("a tap cycles to LOW", /^LOW$/.test(await label()), await label());
    s = await state();
    t.check("LOW: no shadow map, pixel ratio 1, 65 % draw distance, blob shadows", s.tier === "low" && !s.shadows && s.pr === 1 && s.draw === 0.65 && s.blob > 0, JSON.stringify(s));
    await t.frames(40);   // (the save is written within a second)
    t.check("LOW is in the 3D save", await saved() === "low", String(await saved()));
    await t.shot("settings-low");

    // ── it survives a reload ──
    if (!await t.boot()) return;
    s = await state();
    t.check("after a reload: still LOW, and applied", s.setting === "low" && s.tier === "low" && !s.shadows, JSON.stringify(s));

    // ── each tier drives a stormy night (contact shadows, wet-road reflections, bloom) with no errors ──
    const drive = async tier => {
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = "${tier}"; window.__lulu3d.ctx.applySettings(); })`);
      if (await g(`L3.state !== "playing"`)) {
        await g(`L3.startRun({ mode: "cruise", quick: true })`);
        if (!await t.until(`__lulu3d.state === "playing"`, `${tier}: the drive starts`)) return null;
      }
      await g(`(ctx.atmos.debug.time("night"), ctx.atmos.debug.weather("rain", 1, true), ctx.atmos.debug.freeze(true), ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
      await t.hold(7, 0.6);
      await t.frames(60);
      await t.hold(7, 0);
      const info = await t.L(`import("./js/core/gfx.js").then(m => { const L3 = __lulu3d, r = L3.renderer; return { tier: L3.gfx.tier, calls: r.info.render.calls, gfx: m.gfxInfo() }; })`);
      await t.shot(`night-${tier}`);
      return info;
    };
    const low = await drive("low");
    t.check("LOW drives: contact shadows under the cars", low && low.tier === "low" && low.gfx && low.gfx.blobsOn && low.gfx.blobs >= 1, JSON.stringify(low));
    t.check("LOW: no reflections, no sway", low && low.gfx && !low.gfx.env && low.gfx.sway === 0, JSON.stringify(low && low.gfx));
    const med = await drive("medium");
    t.check("MEDIUM drives: reflections on, the wet road shines", med && med.tier === "medium" && med.gfx && med.gfx.env && med.gfx.wetRoad && med.gfx.sway > 0, JSON.stringify(med));
    const high = await drive("high");
    const bloom = await g(`!!L3.gfx.bloom`);
    const canBloom = await t.L(`(() => { const e = __lulu3d.renderer.extensions; return !!(e.has("EXT_color_buffer_float") || e.has("EXT_color_buffer_half_float")); })()`);
    t.check("HIGH drives: bloom exactly where half-float targets work", high && high.tier === "high" && bloom === canBloom, JSON.stringify({ high, bloom, canBloom }));
    t.check("HIGH: renderer.info still reports the GAME's draw calls (not the bloom's 1-call passes)", high && high.calls > 20, JSON.stringify(high));

    // ── no half-float targets (older phones): HIGH without bloom, nothing breaks ──
    await t.L(`(() => { const e = __lulu3d.renderer.extensions, has = e.has.bind(e); e.__has = has; e.has = n => /color_buffer_(half_)?float/.test(n) ? false : has(n); })()`);
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = "medium"; __lulu3d.ctx.applySettings(); m.save3d.settings.quality = "high"; __lulu3d.ctx.applySettings(); })`);
    await t.frames(20);
    t.check("no half-float: HIGH renders without bloom", await g(`L3.gfx.tier === "high" && !L3.gfx.bloom`));
    await t.L(`(() => { const e = __lulu3d.renderer.extensions; if (e.__has) e.has = e.__has; })()`);

    // ── AUTO: holds 60 fps — resolution first, then a tier down; a 30 fps cap is left alone ──
    const auto = await t.L(`import("./js/core/quality.js").then(Q => { const G = Q.gfx;
      const S = __lulu3d.ctx; G.setting = "auto"; G.tier = "high"; G.T = Q.TIERS.high; G.prCap = 2; G.pixelRatio = 2; G.demoted = null; Q.adaptReset();
      const feed = (ms, work, secs) => { const out = []; for (let i = 0; i < secs * 1000 / ms; i++) { const r = Q.adaptFrame(ms, work); if (r) out.push(r); } return out; };
      const r0 = G.pixelRatio;
      const capped = feed(33.3, 3, 8);            // a 30 fps display, little work a frame
      const cap30 = { changes: capped.length, capped30: G.capped30 };
      const slow = feed(30, 22, 90);              // a GPU that can't keep up
      return { r0, cap30, slowChanges: slow, pr: G.pixelRatio, demoted: G.demoted }; })`);
    t.check("AUTO: a 30 fps-capped display isn't mistaken for a slow GPU", auto.cap30.changes === 0 && auto.cap30.capped30, JSON.stringify(auto));
    t.check("AUTO: a slow GPU drops the resolution first, then steps down a tier", auto.slowChanges[0] === "res" && auto.slowChanges.includes("tier") && auto.demoted === "medium", JSON.stringify(auto));
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = "auto"; __lulu3d.ctx.applySettings(); })`);
    await t.frames(10);
    t.check("after stepping down, AUTO runs MEDIUM for the session", await g(`L3.gfx.tier === "medium" && L3.gfx.setting === "auto"`), JSON.stringify(await g(`L3.gfx.info()`)));
  },
};
