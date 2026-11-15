// Atmosphere: the Cruise day cycle (clock advances, forced golden hour / sunset /
// night), night lights (headlights, lamps, traffic glows, windows, stars), weather
// (rain → particles + wet road + windscreen wipers in Lulu's eyes, lightning, fog,
// snow, a rainbow after), ambient life (birds scatter on a honk, the banner plane,
// balloons, autumn leaves), Story mode leaving the journey's lighting alone, and
// nothing left behind back on the title screen.
module.exports = {
  name: "atmos",
  query: "&enable=atmos",
  async run(t) {
    const g = t.game;
    const info = () => g(`ctx.atmos.info()`);
    t.check("service is up", await g(`!!ctx.atmos && typeof ctx.atmos.info === "function"`));
    const kids0 = await g(`ctx.scene.children.length`);

    // ── Cruise: the clock runs ─────────────────────────────────────────
    await g(`(ctx.atmos.debug.time("morning"), L3.startRun({ mode: "cruise", s: 560 }))`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`ctx.atmos.debug.cruise(24)`);                   // test cruise control keeps her in lane
    const c0 = (await info()).clock;
    await t.frames(45);
    let I = await info();
    t.check("cruise mode is active", I.mode === "cruise" && I.active, `${I.mode} active=${I.active}`);
    t.check("the day clock advances while driving", I.clock > c0, `${c0.toFixed(5)} → ${I.clock.toFixed(5)}`);
    t.check("autumn leaves swirl behind the car in the fall leg", I.life.leaves > 0, `biome ${I.biome}, ${I.life.leaves} leaves`);
    await t.shot("morning");

    // ── golden hour + sunset blend over the journey's palette ──────────
    await g(`ctx.atmos.debug.freeze(true)`);
    await g(`ctx.atmos.debug.time("golden")`);
    await t.frames(8);
    I = await info();
    t.check("golden hour takes over the palette", I.w > 0.5 && I.sky.writing, `w ${I.w.toFixed(2)}`);
    t.check("the sun disc shows low in the sky", I.sky.sun > 0.3 && I.sky.sunEl < 20, `sun ${I.sky.sun.toFixed(2)} el ${I.sky.sunEl.toFixed(1)}`);
    await t.shot("golden");
    await g(`ctx.atmos.debug.time("sunset")`);
    await t.frames(8);
    await t.shot("sunset");
    await g(`ctx.atmos.debug.time("dusk")`);
    await t.frames(8);
    await t.shot("dusk");

    // ── night: lights on ───────────────────────────────────────────────
    await g(`ctx.atmos.debug.time("night")`);
    await g(`(ctx.traffic.add("sedan", ctx.car.s + 60, -1.75, -1, 14), ctx.traffic.add("van", ctx.car.s + 35, 5.25, 1, 12), true)`);
    await t.frames(20);
    I = await info();
    t.check("night falls", I.night > 0.9 && I.phase === "night", `night ${I.night.toFixed(2)} ${I.phase}`);
    t.check("headlights are on", I.lightsOn > 0.9 && I.lights.pools > 0, `lightsOn ${I.lightsOn.toFixed(2)} pools ${I.lights.pools}`);
    t.check("street lamps line the cruise road", I.lights.lamps > 0, `${I.lights.lamps} lamps in ${I.lights.lampChunks} chunks`);
    t.check("traffic + lamps glow (flares)", I.lights.glows >= 8, `${I.lights.glows} glows`);
    t.check("stars and the moon are out", I.sky.stars > 0.5 && I.sky.moon > 0.5, `stars ${I.sky.stars.toFixed(2)} moon ${I.sky.moon.toFixed(2)}`);
    t.check("house windows glow", I.lights.windowGlow > 0.5 && I.lights.windows > 0, `${I.lights.windows} mats @ ${I.lights.windowGlow.toFixed(2)}`);
    await t.shot("night");
    await t.tap(3); await t.tap(3); await t.frames(6);       // Lulu's eyes
    await t.shot("night-eyes");

    // ── rain (at night, in Lulu's eyes: wipers) ────────────────────────
    await g(`ctx.atmos.debug.weather("rain", 1, true)`);
    await t.frames(12);
    I = await info();
    t.check("rain falls (GPU streaks)", I.weather.rainVisible && I.weather.drops > 300, `${I.weather.drops} drops`);
    t.check("the road gets wet", I.weather.wet > 0.8 && I.weather.roadRough < 0.5, `wet ${I.weather.wet.toFixed(2)} rough ${I.weather.roadRough.toFixed(2)}`);
    t.check("windscreen drops + wipers in Lulu's eyes", I.fp && I.weather.screen, `fp ${I.fp} screen ${I.weather.screen}`);
    await t.shot("rain-eyes-night");
    await t.tap(3); await t.frames(4);                         // back to the chase cam
    await g(`ctx.atmos.debug.strike()`);
    await t.frames(2);
    I = await info();
    t.check("lightning flashes", I.weather.flash > 0.2, `flash ${I.weather.flash.toFixed(2)}`);
    await t.shot("lightning");
    await g(`ctx.atmos.debug.time("noon")`);
    await t.frames(14);
    await t.shot("rain-day");

    // ── the rain stops → rainbow; fog bank; snow ───────────────────────
    await g(`(ctx.atmos.debug.weather("clear", 1, true), ctx.atmos.debug.time("morning"), ctx.atmos.debug.rainbow(60))`);
    await t.frames(20);
    I = await info();
    t.check("a rainbow after the rain", I.sky.rainbow > 0.3, `rainbow ${I.sky.rainbow.toFixed(2)}`);
    t.check("rain particles cleaned up", !I.weather.rainVisible, `rain ${I.weather.rain.toFixed(2)}`);
    await t.shot("rainbow");
    await g(`ctx.atmos.debug.weather("fog", 1, true)`);
    await t.frames(10);
    I = await info();
    t.check("a fog bank rolls in", await g(`ctx.scene.fog.far < 160`), `fog far ${(await g(`ctx.scene.fog.far`)).toFixed(0)}`);
    await t.shot("fog");
    await g(`ctx.atmos.debug.weather("snow", 1, true)`);
    await t.frames(12);
    I = await info();
    t.check("snow falls and settles", I.weather.snowVisible && I.weather.snowCover > 0.5, `cover ${I.weather.snowCover.toFixed(2)}`);
    await t.shot("snow");
    // an interior set (ctx.view) hides it all, coming back brings it back
    await g(`(window.__set = new ctx.THREE.Scene(), ctx.view = { scene: window.__set, camera: ctx.camera }, true)`);
    await t.frames(4);
    I = await info();
    t.check("an interior (ctx.view) hides the weather", !I.active && !I.weather.snowVisible, `active ${I.active} snow ${I.weather.snowVisible}`);
    await g(`(ctx.view = null, true)`);
    await t.frames(4);
    I = await info();
    t.check("…and it comes back outside", I.active && I.weather.snowVisible);
    await g(`ctx.atmos.debug.weather("clear", 1, true)`);

    // ── ambient life ───────────────────────────────────────────────────
    await g(`ctx.atmos.debug.time("noon")`);
    const text = await g(`ctx.atmos.debug.plane("CALL YOUR MOTHER! — IMA")`);
    await g(`ctx.atmos.debug.balloon({ ahead: 260, d: 70, side: 1, y: 55 })`);
    await t.frames(40);
    I = await info();
    t.check("the banner plane flies with a family message", I.life.plane && /MOTHER/.test(text), I.life.planeText);
    t.check("a hot-air balloon drifts by", I.life.balloons >= 1);
    await t.shot("banner-plane");
    await g(`(ctx.atmos.debug.cruise(0), ctx.car.vx = ctx.car.vz = 0, true)`);
    const n = await g(`ctx.atmos.debug.flock("ground", { ahead: 30, d: 10, side: 1 })`);
    await t.frames(4);
    t.check("a flock lands in the field", n > 4, `${n} birds`);
    await t.shot("birds");
    await t.tap(4);                                             // honk!
    await t.frames(20);
    I = await info();
    t.check("honking scatters the birds", I.life.scattered >= 1 && I.life.flying > 0, `scattered ${I.life.scattered}, flying ${I.life.flying}`);
    await t.shot("birds-scatter");

    // on foot (the foot feature): the world keeps its weather, the car's lights go out
    if (await g(`!!(ctx.foot && ctx.foot.start)`)) {
      await g(`(ctx.atmos.debug.time("night"), ctx.atmos.debug.weather("rain", 0.7, true), ctx.foot.start("droveOff"), true)`);
      if (await t.until(`__lulu3d.state === "footRun"`, "Lulu climbs out and walks", 30000)) {
        await t.frames(30);
        I = await info();
        t.check("on foot: rain + night go on, no headlights", I.active && I.weather.rainVisible && I.night > 0.9 && I.lights.spot <= 0,
          `active ${I.active} rain ${I.weather.rainVisible} spot ${I.lights.spot}`);
        await t.shot("on-foot-rain");
      }
    }

    // ── back to the title: everything off, nothing leaks ───────────────
    await g(`(ctx.atmos.debug.weather("rain", 1, true), ctx.atmos.debug.time("night"), true)`);
    await t.frames(4);
    await g(`L3.setState("title")`);
    await t.frames(8);
    I = await info();
    t.check("title: atmosphere off", I.mode === "off" && !I.active && !I.sky.writing, `${I.mode} writing=${I.sky.writing}`);
    t.check("title: rain + lights + life cleared", !I.weather.rainVisible && I.lights.glows === 0 && I.lights.windowGlow === 0 && I.life.birds === 0 && !I.life.plane && I.life.balloons === 0,
      JSON.stringify({ rain: I.weather.rainVisible, glows: I.lights.glows, win: I.lights.windowGlow, birds: I.life.birds, bal: I.life.balloons }));
    t.check("title: the road is dry again", I.weather.roadRough > 0.85, `rough ${I.weather.roadRough}`);
    const kids1 = await g(`ctx.scene.children.length`);
    // run 2: way down the road on the Vegas Strip, at the day cycle's NOON — the leg itself is
    // night, so we only add night touches (stars, moon, lights) on top of the journey's palette
    await g(`(ctx.atmos.debug.time("noon"), L3.startRun({ mode: "cruise", s: 41500 }))`);
    await t.until(`__lulu3d.state === "playing"`, "second cruise starts");
    await g(`(ctx.atmos.debug.plane(), ctx.atmos.debug.balloon(), ctx.atmos.debug.flock("ground"), true)`);
    await t.frames(24);
    I = await info();
    t.check("the Strip is already night: stars + headlights, no day-cycle override", I.baseNight > 0.8 && I.sky.stars > 0.3 && I.lightsOn > 0.8 && I.w < 0.01,
      `baseNight ${I.baseNight.toFixed(2)} stars ${I.sky.stars.toFixed(2)} lights ${I.lightsOn.toFixed(2)} w ${I.w}`);
    t.check("no extra lamps on the Strip (the journey has its own)", I.lights.lamps === 0 || I.biome !== "strip", `${I.lights.lamps} lamps, biome ${I.biome}`);
    await t.shot("strip-night");
    await g(`L3.setState("title")`);
    await t.frames(6);
    const kids2 = await g(`ctx.scene.children.length`);
    t.check("no scene objects leak between runs", kids2 <= kids1, `boot ${kids0} · after run 1 ${kids1} · after run 2 ${kids2}`);

    // ── Story mode: the journey keeps its lighting ─────────────────────
    await g(`(ctx.atmos.debug.weather(null), L3.startRun({ mode: "story" }))`);
    await t.until(`__lulu3d.state === "playing"`, "story starts");
    await t.frames(20);
    I = await info();
    t.check("story: no day-cycle override, no weather", I.mode === "base" && I.w < 0.01 && !I.sky.writing && !I.weather.rainVisible && I.weather.fog === 0,
      `${I.mode} w=${I.w} writing=${I.sky.writing}`);
    t.check("story: no cruise street lamps", I.lights.lamps === 0, `${I.lights.lamps}`);
    await g(`L3.setState("title")`);
    await t.frames(4);

    // ── Chanukah (meta's holiday preview): snow flurries even in the Story Trip's leafy
    //    first leg — particles + snowy fields only, the journey's lighting stays put ──
    if (!await t.boot("&enable=atmos&holiday=chanukah&holidayDay=3")) return;
    await g(`L3.startRun({ mode: "story" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "Chanukah story drive starts")) return;
    await t.frames(40);
    I = await info();
    t.check("Chanukah: snow flurries in the story's fall leg, no lighting override", I.weather.holiday === "chanukah" && I.weather.snowTarget > 0.3 && I.weather.snowVisible && !I.sky.writing,
      `holiday ${I.weather.holiday} target ${I.weather.snowTarget} snow ${I.weather.snow.toFixed(2)} writing ${I.sky.writing}`);
    await t.shot("chanukah-story");
    await g(`L3.setState("title")`);
    await t.frames(4);
  },
};
