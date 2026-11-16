// 🌍 World: the title is Lulu's live street (house, parked pink car, Dina on the porch,
// the sky on the device's clock), Cruise starts with the driveway pull-out → playing
// (and ⏭ skips it, ✕ jumps it), quick starts stay instant, back to the title brings her
// home (she parks), pull-in places (Gas 'n' Go, the Lookout) work, holiday dressing
// on the house (mocked dates), the party turns it off, and performance numbers.
const VIEWS = [["desktop", 1280, 720], ["tv", 1920, 1080], ["phone-portrait", 390, 844], ["phone-landscape", 844, 390]];

async function perf(t, frames = 30) {
  return t.L(`new Promise(res => {
    const L3 = window.__lulu3d, r = L3.renderer, f0 = L3.frames, t0 = performance.now();
    let calls = 0, tris = 0, n = 0;
    const tick = () => {
      if (L3.frames > f0 + n) { n++; calls += r.info.render.calls; tris += r.info.render.triangles; }
      if (n >= ${frames}) return res({ ms: +((performance.now() - t0) / n).toFixed(1), calls: Math.round(calls / n), tris: Math.round(tris / n) });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })`);
}

module.exports = {
  name: "world",
  query: "&enable=world,atmos",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const g = t.game;
    const state = () => g(`ctx.state`);
    await t.frames(10);

    // ── the title is the live home street ──
    const H0 = await g(`({ ready: ctx.places.home.ready, parked: ctx.places.home.parked(), phase: ctx.places.home.phase,
      cam: Math.hypot(ctx.camera.position.x - ctx.places.home.park.x, ctx.camera.position.z - ctx.places.home.park.z),
      driver: ctx.car.driver ? ctx.car.driver.visible : null, s: ctx.car.s })`);
    t.check("the home street is built", H0.ready);
    t.check("the pink car is parked in the driveway", H0.parked && H0.phase === "parked", JSON.stringify(H0));
    t.check("Lulu is out of the car on the title", H0.driver === false);
    t.check("the title camera is on the house", H0.cam < 40, `${H0.cam.toFixed(1)} m`);
    t.check("the title menu floats over it", await t.L(`!!document.querySelector("#screenCard .home")`));
    const A0 = await g(`ctx.atmos.info()`);
    t.check("the sky runs on the title (atmos: device clock)", A0.mode === "cruise" && A0.active, `${A0.mode} active=${A0.active}`);
    const lc = await g(`ctx.places.debug.localClock(new Date(2026, 10, 16, 22, 0))`);
    t.check("10 pm local maps to night", lc > 0.6 && lc < 0.83, lc.toFixed(3));
    for (const [name, w, h] of VIEWS) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.frames(20);
      await t.shot("title-" + name);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await g(`ctx.places.debug.clock(0.7)`);
    await t.frames(25);
    const An = await g(`ctx.atmos.info()`);
    t.check("night on the title: windows glow", An.night > 0.8 && An.lights.windowGlow > 0.4, `night ${An.night.toFixed(2)} glow ${An.lights.windowGlow}`);
    await t.shot("title-night");
    await g(`ctx.places.debug.clock(0.18)`);
    await t.frames(20);
    const pTitle = await perf(t);
    t.check("title perf measured", pTitle.calls > 0, JSON.stringify(pTitle));
    await g(`(ctx.places.home && (window.__hg = [...ctx.scene.children].find(o => o.name === "WorldHome")), window.__hg.visible = false, true)`);
    await t.frames(4);
    const pBare = await perf(t, 15);
    await g(`(window.__hg.visible = true, true)`);
    console.log(`  PERF title (home street): ${JSON.stringify(pTitle)} · without the street: ${JSON.stringify(pBare)}`);

    // ── Cruise from the title: the driveway pull-out → playing ──
    await g(`ctx.places.debug.clock(0.41)`);
    await t.frames(3);
    await t.click(/Cruise/);
    t.check("Cruise starts the pull-out", await t.until(`__lulu3d.state === "worldDepart"`, "worldDepart", 4000));
    t.check("the skip pill shows", await t.L(`document.getElementById("skipBtn").classList.contains("show")`));
    await t.frames(30);
    await t.shot("depart-reverse");
    const ph = await g(`ctx.places.home.depart().phase`);
    t.check("she's in the car and backing out", ["rev", "pause", "fwd"].includes(ph), ph);
    if (!await t.until(`__lulu3d.state === "playing"`, "the pull-out hands over to playing", 15000)) return;
    const R = await g(`({ d: ctx.car.d, v: ctx.car.speed, drv: ctx.car.driver.visible, mode: ctx.G.mode, clock: ctx.atmos.clock })`);
    t.check("she's in her lane, rolling", R.d > 0.5 && R.d < 3.5 && R.v > 6, JSON.stringify(R));
    t.check("Lulu is at the wheel", R.drv === true);
    t.check("the time of day carries into the drive", Math.abs(R.clock - 0.41) < 0.02, R.clock.toFixed(3));
    await t.frames(6);
    await t.shot("depart-handoff");
    // busy Cruise perf (a stretch with traffic)
    await t.hold(7, 1);
    await t.frames(90);
    await t.hold(7, 0);
    const pCruise = await perf(t);
    console.log(`  PERF busy cruise: ${JSON.stringify(pCruise)}`);
    t.check("cruise perf measured", pCruise.calls > 0, JSON.stringify(pCruise));

    // ── back to the title: she drives home and parks ──
    await g(`L3.setState("title")`);
    await t.frames(4);
    t.check("back on the title she drives home", (await g(`ctx.places.home.phase`)) === "arriving");
    await t.frames(40);
    await t.shot("homecoming");
    t.check("…and parks in the driveway", await t.until(`__lulu3d.ctx.places.home.phase === "parked" && __lulu3d.ctx.places.home.parked()`, "parked again", 15000));

    // ── ⏭ skip the pull-out ──
    await g(`L3.startRun({ mode: "cruise" })`);
    await t.until(`__lulu3d.state === "worldDepart"`, "pull-out again", 3000);
    await t.frames(3);
    const f0 = await g(`ctx.frames`);
    await t.hold(1, 1);
    await t.until(`__lulu3d.state === "playing"`, "holding ○ skips the pull-out", 4000);
    await t.hold(1, 0);
    t.check("skipped in a blink", (await g(`ctx.frames`)) - f0 < 45, `${(await g(`ctx.frames`)) - f0} frames`);
    t.check("skipped run lands on the road", await g(`Math.abs(ctx.car.d - 1.75) < 1.5 && ctx.car.speed > 5`));

    // ── ✕ jumps straight to the road ──
    await g(`L3.setState("title")`);
    await t.frames(3);
    await g(`ctx.places.debug.parkNow()`);
    await g(`L3.startRun({ mode: "cruise" })`);
    await t.frames(14);
    await t.tap(0);
    t.check("✕ jumps the pull-out", await t.until(`__lulu3d.state === "playing"`, "✕ → playing", 300));

    // ── quick starts stay instant ──
    await g(`L3.setState("title")`);
    await t.frames(3);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    t.check("opts.quick → the instant countdown", (await state()) === "intro");
    await t.until(`__lulu3d.state === "playing"`, "countdown → playing");
    await g(`L3.startRun({ mode: "cruise" })`);
    t.check("restart mid-run → the instant countdown", (await state()) === "intro");
    await t.until(`__lulu3d.state === "playing"`, "countdown → playing");

    // ── pull in: Gas 'n' Go ──
    const gasS = await g(`ctx.places.at("gas")[0]`);
    await g(`(() => { const p = ctx.world.road.point(${gasS} - 60, 1.75, {}); ctx.traffic.config.enabled = false; ctx.traffic.clear(); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${gasS} - 60; ctx.world.prebuild(ctx.car.s); ctx.G.boost = 0.2; ctx.G.invT = 99; })()`);
    await t.until(`__lulu3d.ctx.places.spots().some(s => s.id === "gas" && s.built)`, "the gas station is built", 8000);
    await t.frames(4);
    await t.shot("gas-approach");
    await g(`(() => { const p = ctx.world.road.point(${gasS} - 3, 12.2, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${gasS} - 3; })()`);
    t.check("stopping in the bay starts the visit", await t.until(`__lulu3d.state === "worldVisit"`, "worldVisit", 3000));
    await t.frames(30);
    await t.shot("gas-visit");
    if (!await t.until(`__lulu3d.state === "playing"`, "back to driving after the visit", 8000)) return;
    const gv = await g(`({ n: ctx.places.visits("gas"), boost: ctx.G.boost })`);
    t.check("the gas stop counts and fills the nitro", gv.n >= 1 && gv.boost > 0.95, JSON.stringify(gv));
    await t.frames(20);
    t.check("only once per run (no second visit while sitting there)", (await state()) !== "worldVisit");

    // ── pull in: the Lookout ──
    const lookS = await g(`ctx.places.at("lookout")[0]`);
    await g(`(() => { const p = ctx.world.road.point(${lookS} - 50, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${lookS} - 50; ctx.world.prebuild(ctx.car.s); })()`);
    await t.until(`__lulu3d.ctx.places.spots().some(s => s.id === "lookout" && s.built)`, "the lookout is built", 8000);
    await g(`(() => { const p = ctx.world.road.point(${lookS}, 12.0, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${lookS}; })()`);
    t.check("the lookout visit starts", await t.until(`__lulu3d.state === "worldVisit"`, "lookout visit", 3000));
    await t.frames(60);
    await t.shot("lookout");
    await t.until(`__lulu3d.state === "playing"`, "back on the road after the lookout", 8000);

    // ── the party keeps it off ──
    t.check("party: world is in the OFF set", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"world"/.test(s))`));

    // ── holiday dressing (mocked dates) ──
    for (const [hol, day, check] of [["chanukah", 3, "chanukah"], ["sukkot", 2, "sukkah"], ["purim", 1, null]]) {
      await t.boot(`&enable=world&holiday=${hol}&holidayDay=${day}`);
      await t.frames(30);
      const I = await g(`({ id: ctx.places.home.holiday(), decor: ctx.places.home.decor, extras: ctx.places.home.extras })`);
      t.check(`${hol}: the house is dressed`, I.id === hol && (check ? I.decor[check] === true : true) && (hol === "sukkot" || I.extras.length > 0), JSON.stringify(I));
      await t.shot("holiday-" + hol);
    }
    await t.boot(`&enable=world`);
    await t.frames(10);
    const I0 = await g(`({ decor: ctx.places.home.decor, extras: ctx.places.home.extras })`);
    t.check("no holiday → no dressing", !I0.decor.sukkah && !I0.decor.chanukah && I0.extras.length === 0, JSON.stringify(I0));
  },
};
