// PS5 / TV / DualSense: a PlayStation 5 browser user agent turns on the
// 10-foot TV layout, a DualSense shows PlayStation glyphs everywhere, the
// menus are fully D-pad navigable, and a browser without WebGL gets a
// friendly card that points to the 2D game instead of a stuck loading screen.
module.exports = {
  name: "platform",
  userAgent: "Mozilla/5.0 (PlayStation; PlayStation 5/2.26) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Safari/605.1.15",
  padId: "DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)",
  viewport: { width: 1280, height: 720 },
  async run(t) {
    await t.frames(10);
    t.check("PS5 browser → TV mode", await t.L(`document.body.classList.contains("tv")`));
    t.check("DualSense detected as PlayStation layout", await t.game(`L3.input.padKind`) === "ps");
    t.check("title shows the ✕ glyph", await t.L(`document.querySelector("#screenCard").textContent.includes("✕")`));
    t.check("title says PlayStation layout", await t.L(`/PlayStation layout/.test(document.querySelector(".pad-status").textContent)`));
    await t.shot("tv-title");

    // D-pad navigation through the title menu, then into Controls and back with ○
    await t.tap(13); await t.tap(13); await t.tap(13);
    const focused = await t.L(`(document.querySelector("#screenCard .focus") || {}).textContent || ""`);
    t.check("D-pad moves the focus", !/Story Trip/.test(focused), focused.trim());
    await t.click(/Controls/);
    t.check("controls screen lists PlayStation buttons", await t.L(`/R2/.test(document.querySelector("#screenCard").textContent) && /✕/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("tv-controls");
    await t.tap(1);
    t.check("○ goes back to the title", await t.L(`/Story Trip/.test(document.querySelector("#screenCard").textContent)`));

    // drive briefly in TV mode with the DualSense (R2 = gas)
    await t.tap(0);
    if (await t.until(`__lulu3d.state === "playing"`, "✕ starts the story drive")) {
      t.check("✕ starts the story drive", true);
      await t.hold(7, 1); await t.frames(30); await t.hold(7, 0);
      t.check("R2 drives", await t.game(`ctx.car.speed > 5`));
      await t.shot("tv-driving");
    }

    // no WebGL → friendly fallback card with a link to the 2D game
    await t.page.goto(t.page.url().replace(/\?.*$/, "?test&nowebgl"));
    await t.page.waitForTimeout(1500);
    t.check("no-WebGL fallback card", await t.L(`/2D game/.test((document.getElementById("loading") || {}).textContent || "")`));
    t.check("fallback mentions the PlayStation", await t.L(`/PlayStation/.test(document.getElementById("loading").textContent)`));
    await t.shot("nowebgl");
  },
};
