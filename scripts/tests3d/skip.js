// ⏭ Skip + pop-up placement: the skip pill shows in cutscenes (not while
// driving), holding ○/B fast-forwards the arrest to the precinct (the arrest
// still counts: law:arrest fires), braking into a cutscene with ○ already held
// doesn't skip by accident, the pause menu offers "Skip this scene", and the
// driving pop-ups stay off the road (toasts on the right edge, banners tucked
// under the trip bar).
module.exports = {
  name: "skip",
  query: "&enable=law",
  save2d: { totalCoins: 500, convictions: 0, offenses: 0, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const st = () => t.game(`ctx.state`);
    const pill = () => t.L(`document.getElementById("skipBtn").classList.contains("show")`);
    const hud = code => t.L(`import("./js/hud.js").then(H => { ${code} })`);

    await t.game(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.game(`(ctx.traffic.config.enabled = false, ctx.traffic.clear())`);
    t.check("no skip pill while driving", !(await pill()));

    // ── pop-ups stay off the road ──
    await hud(`H.toast("+5 CLOSE CALL!", "gold", { prio: 2 }); H.banner("🎫 <b>TOLL AHEAD!</b><small>Pick a green lane</small>", 3000);`);
    await t.frames(8);
    const r = await t.L(`(() => {
      const t = document.querySelector("#toasts .toast").getBoundingClientRect(), b = document.getElementById("banner").getBoundingClientRect();
      return { tl: t.left, tr: t.right, bt: b.top, bb: b.bottom, bc: (b.left + b.right) / 2, w: innerWidth, h: innerHeight,
               compact: document.getElementById("banner").classList.contains("compact") };
    })()`);
    t.check("toasts sit on the right edge, off the road", r.tl > r.w * 0.55 && r.tr <= r.w, JSON.stringify(r));
    t.check("the driving banner is compact, under the trip bar", r.compact && r.bt > 40 && r.bb < r.h * 0.32 && Math.abs(r.bc - r.w / 2) < 30, JSON.stringify(r));
    await t.shot("popups");

    // ── arrest → hold ○ → straight to the precinct ──
    await t.L(`window.__arrests = 0`);
    await t.L(`import("./js/core/ctx.js").then(m => m.on("law:arrest", () => { window.__arrests++; }))`);
    await t.hold(1, 1);                                     // braking with ○ as the cops get her…
    await t.game(`ctx.law.arrest(["SPEEDING"])`);
    if (!await t.until(`__lulu3d.state === "lawArrest"`, "the arrest cutscene starts")) return;
    await t.until(`document.getElementById("skipBtn").classList.contains("show")`, "the skip pill shows in the arrest");
    await t.frames(30);                                     // …still holding: must NOT skip by accident
    t.check("○ held from braking doesn't skip", (await st()) === "lawArrest");
    await t.hold(1, 0);
    await t.frames(3);
    const f0 = await t.game(`ctx.frames`);
    await t.hold(1, 1);                                     // a fresh hold → skip
    await t.until(`__lulu3d.state === "lawJail"`, "holding ○ skips the arrest to the precinct", 8000);
    await t.hold(1, 0);
    const f1 = await t.game(`ctx.frames`);
    t.check("…in a blink", f1 - f0 < 120, `${f1 - f0} frames`);
    t.check("the skipped arrest still counts (law:arrest fired)", (await t.L(`window.__arrests`)) === 1);
    t.check("sound is back on after the skip", await t.game(`!ctx.skipping`));

    // the booking (arrive/intake) is skippable too, and the pill goes away in the cell
    await t.until(`document.getElementById("skipBtn").classList.contains("show")`, "the skip pill shows during booking", 20000);
    await t.frames(3);
    await t.hold(1, 1);
    await t.until(`__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell"`, "holding ○ skips booking to the cell", 15000);
    await t.hold(1, 0);
    await t.frames(6);
    t.check("no skip pill in the cell (it's interactive)", !(await pill()));
    await t.shot("cell");

    // ── the pause menu offers "Skip this scene" ──
    await t.game(`L3.setState("title")`);
    await t.frames(4);
    await t.game(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a fresh cruise starts")) return;
    await t.game(`ctx.law.arrest(["JAYWALKING"])`);
    if (!await t.until(`__lulu3d.state === "lawArrest"`, "a second arrest")) return;
    await t.frames(4);
    await t.tap(9);                                          // OPTIONS → pause
    await t.until(`__lulu3d.ctx.paused`, "the arrest can be paused");
    t.check("the pause menu has Skip this scene", await t.click(/Skip this scene/));
    await t.until(`__lulu3d.state === "lawJail"`, "Skip this scene (pause menu) skips to the precinct", 8000);
    t.check("unpaused after skipping", !(await t.game(`ctx.paused`)));

    // ── click / tap the pill ──
    await t.until(`document.getElementById("skipBtn").classList.contains("show")`, "pill shows at the precinct", 20000);
    await t.L(`document.getElementById("skipBtn").click()`);
    await t.until(`__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell"`, "clicking the pill skips booking", 15000);
  },
};
