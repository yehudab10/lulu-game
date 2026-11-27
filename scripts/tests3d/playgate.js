// ▶ PLAY always starts at home (features/onegame/playgate.js). Before: a ▶ PLAY pressed while the home town's models
// were still downloading (a slow phone connection) silently started a plain drive. Now ▶ PLAY waits on the title with a
// progress line on its own tile and starts the home start the moment it's ready. The home town's model downloads are
// held back here (page.route) so "not ready yet" is deterministic:
//   • ▶ PLAY while not ready → still on the title, the tile says "Getting your street ready… N%"
//   • a second tap stops waiting (and says so); a third waits again
//   • once the models are let through → on foot at home (never a plain drive)
//   • a failed download (the route aborts) → "Couldn't load your street…" and the next tap tries again → home
module.exports = {
  name: "playgate",
  viewport: { width: 844, height: 390 },
  query: "&enable=world,foot,day,town,decor,exits,community",
  save2d: { totalCoins: 300, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { best: 1000, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const sub = () => t.L(`(document.querySelector("#screenCard #play .t-s") || {}).textContent || ""`);
    const info = () => g(`ctx.playGateInfo ? ctx.playGateInfo() : null`);
    const atHome = `__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`;
    const base = t.page.url().split("?")[0], query = t.page.url().split("?")[1];
    // hold the home town's models: "hold" (wait), "fail" (abort), "go" (let through)
    let mode = "hold";
    const held = [];
    await t.page.route(/\/3d\/assets\/town_[^/]*\.glb/, r => {
      if (mode === "go") return r.continue();
      if (mode === "fail") return r.abort();
      held.push(r);
    });
    const release = async () => { mode = "go"; while (held.length) await held.shift().continue().catch(() => {}); };
    const failHeld = async () => { mode = "fail"; while (held.length) await held.shift().abort().catch(() => {}); };

    // a fresh boot with the route in place (no cached models)
    await t.page.goto(`${base}?${query}`);
    if (!await t.until(`window.__lulu3d && __lulu3d.state === "title" && !!document.querySelector("#screenCard #play")`, "boots to the title", 120000)) return;
    await t.frames(10);
    let I = await info();
    t.check("the gate is there and applies (home is in a town, not ready yet)", !!I && I.applies && !I.ready, JSON.stringify(I));

    // ── ▶ PLAY while not ready: waits on the title, says so ──
    await t.click(/PLAY/);
    await t.frames(10);
    I = await info();
    t.check("▶ PLAY waits on the title (no plain drive)", (await g(`ctx.state`)) === "title" && I.waiting, JSON.stringify(I));
    t.check("…the tile says it's getting the street ready, with a percentage", /Getting your street ready… \d+%/.test(await sub()), await sub());
    await t.shot("waiting");
    // ── a second tap stops, a third waits again ──
    await t.click(/PLAY/);
    await t.frames(4);
    t.check("a second tap stops waiting", !(await info()).waiting && /Stopped/.test(await sub()), await sub());
    await t.click(/PLAY/);
    await t.frames(4);
    t.check("…a third waits again", (await info()).waiting);

    // ── a failed download: says so, the next tap retries ──
    await failHeld();
    const failedShown = await t.until(`/Couldn't load your street/.test((document.querySelector("#screenCard #play .t-s") || {}).textContent || "")`, "a failed download says so", 60000);
    t.check("a failed download: 'Couldn't load your street…', not a stuck button", failedShown, await sub());
    t.check("…and it isn't waiting any more", !(await info()).waiting);
    await t.shot("failed");

    // ── let the models through, tap again → the home start ──
    await release();
    await t.click(/PLAY/);
    t.check("after a failure, ▶ PLAY tries again (waiting)", (await info()).waiting || await g(`ctx.state !== "title"`));
    // (never a plain drive: while it waits the state stays "title"; then the home start)
    t.check("▶ PLAY → on foot at home (the home start)", await t.until(atHome, "walking at home", 120000));
    t.check("…and it's home: Ima's (or her own) street", await g(`ctx.town && ctx.town.active`));
    await t.shot("home");
  },
};
