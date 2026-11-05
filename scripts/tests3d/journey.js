// The Story Trip: title (Story Trip first, cruise locked for a fresh player,
// "Next stop"), a leg with its banner + story call + chapter task chip, Ima's call
// (honk declines, let it ring → flipped steering → gas money), the mid-leg
// interlude, a road event, every stop's arrival (rewards, postcards, checkpoints,
// stars, the cruise unlock, the boon), the beach gear, Avigail's "don't bump"
// task, the Vegas finale (tour jackpot, TOUR 2) and the story map launching a
// chapter on the longer tour-2 road. Saves persist across a reload.
const SAVE = `JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`;

module.exports = {
  name: "journey",
  query: "&enable=journey",
  save2d: { totalCoins: 100, avigailRel: 70 },
  async run(t) {
    const G = code => t.game(code);
    /** Put the car at s (lane d) rolling at v m/s, traffic cleared. */
    const tp = (s, v = 22, d = 5.25) => G(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {});
      ctx.traffic.clear(); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.cam.snap(); return true; })()`);
    const legS = f => G(`(() => { const a = ctx.G.jLegStart, b = ctx.journey.stopS(ctx.journey.stopIndex) - 90; return a + (b - a) * ${f}; })()`);
    /** Drive into stop i, skip the cutscene with ✕ and land on the arrival screen. */
    async function arrive(i, label) {
      const S = await G(`ctx.journey.stopS(${i})`);
      await G(`ctx.G.invT = 99`);
      await tp(S - 150, 24);
      if (!await t.until(`__lulu3d.state === "arriving"`, `reaches stop ${i}`)) return false;
      await t.frames(40);
      await shot(`arrive-${label}`);
      for (let k = 0; k < 14 && await t.L(`__lulu3d.state`) === "arriving"; k++) { await t.tap(0); await t.frames(4); }
      if (!await t.until(`__lulu3d.state === "arrivedScreen"`, `arrival screen ${i}`)) return false;
      await t.frames(6);
      return true;
    }
    /** Wait for a leg interlude, screenshot it, and ✕ through the dialogue. */
    async function interlude(label, re) {
      if (!await t.until(`__lulu3d.state === "storyTalk"`, `${label} interlude starts`)) return false;
      await t.until(`document.getElementById("dialog").classList.contains("open")`, `${label} dialogue opens`);
      await t.frames(20);
      if (re) t.check(`${label} interlude line`, await t.L(`${re}.test(document.querySelector("#dialog .text").textContent)`));
      await shot(`interlude-${label}`);
      for (let k = 0; k < 24 && await t.L(`__lulu3d.state`) === "storyTalk"; k++) { await t.tap(0); await t.frames(3); }
      return t.check(`back on the road after the ${label} interlude`, await t.L(`__lulu3d.state`) === "playing");
    }
    /** Screenshot with the invincibility blink off (the test keeps Lulu invincible while it teleports). */
    const shot = async label => { await G(`ctx.G.invT = 0`); await t.frames(2); await t.shot(label); await G(`ctx.G.invT = 1e6`); };
    const skipBeats = (talk, event) => G(`(ctx.journey.debug.beats.talkDone = ${talk}, ctx.journey.debug.beats.eventDone = ${event}, true)`);

    await t.frames(10);
    // ── title ──
    const items = await t.L(`[...document.querySelectorAll("#screenCard .menu .btn")].map(b => b.textContent)`);
    t.check("Story Trip is the first title item", /Story Trip/.test(items[0]), items[0]);
    t.check("cruise is locked for a fresh player (2D onboarding rule)", !items.some(x => /Cruise/.test(x)));
    t.check("title shows the next stop", await t.L(`/Next stop:.*BUBBE/.test((document.querySelector(".jtitle") || {}).textContent)`));
    await shot("title");

    // ── Story Trip → leg 1 ──
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "playing"`, "story run starts")) return;
    t.check("leg 1 is Bubbe's house, at 4800 m", await G(`ctx.journey.stopIndex === 0 && ctx.journey.stop().id === "bubbe" && ctx.journey.stopS(0) === 4800`));
    await G(`ctx.G.invT = 1e6`);   // no wrecks while the test teleports around
    await t.hold(7, 0.6);
    await t.frames(30);
    t.check("leg intro banner", await t.L(`/LEG 1\\/5/.test(document.getElementById("banner").textContent)`));
    await shot("leg-banner");
    const called = await t.until(`!!document.querySelector(".jphone")`, "Bubbe calls as the leg starts", 90000);
    if (called) {
      t.check("story call from Bubbe", await t.L(`/BUBBE/.test(document.querySelector(".jphone").textContent)`));
      await t.frames(8);
      await shot("story-call");
    }
    t.check("chapter task chip: groceries", await t.L(`/Groceries/.test((document.querySelector(".jtask") || {}).textContent)`));
    await t.until(`!__lulu3d.ctx.phone.busy()`, "story call ends", 60000);

    // ── Ima is calling: HONK declines (+10) ── (Lulu parks first so road coins / speed traps don't muddy the count)
    await t.hold(7, 0);
    await G(`(ctx.car.vx = 0, ctx.car.vz = 0, ctx.traffic.clear(), ctx.traffic.config.enabled = false, true)`);
    await t.frames(4);
    let c0 = await G(`ctx.G.coins`);
    await G(`ctx.journey.debug.imaCall() && true`);
    await t.frames(4);
    t.check("Ima rings", await G(`ctx.phone.active && ctx.phone.active.phase === "ring"`));
    await shot("ima-ring");
    await t.tap(4);                   // L1 / LB = horn
    t.check("a honk declines (+10, she's proud)", await G(`ctx.phone.active && ctx.phone.active.result === "declined" && ctx.phone.active.pay === 10`));
    await t.until(`!__lulu3d.ctx.phone.busy()`, "declined call clears");
    t.check("declining pays +10 into the run's coins", (await G(`ctx.G.coins`)) - c0 === 10, `${c0} → ${await G(`ctx.G.coins`)}`);
    // let it ring → Lulu picks up → flipped steering → +30 gas money
    c0 = await G(`ctx.G.coins`);
    await G(`ctx.journey.debug.imaCall() && true`);
    await t.until(`__lulu3d.ctx.phone.talking`, "letting it ring picks up");
    t.check("steering is flipped while Lulu talks", await G(`ctx.phone.flipped === true`));
    t.check("Lulu holds the phone to her ear", await G(`ctx.car.anchors.head.children.length > 0`));
    await t.frames(6);
    await shot("ima-talk");
    await t.until(`!__lulu3d.ctx.phone.talking`, "the call finishes", 60000);
    t.check("a full chat pays +30 gas money", (await G(`ctx.G.coins`)) - c0 === 30, `${c0} → ${await G(`ctx.G.coins`)}`);
    t.check("steering back to normal", await G(`ctx.phone.flipped === false`));
    await G(`(ctx.traffic.config.enabled = true, true)`);
    await t.hold(7, 0.6);

    // ── chapter task: 40 coins on the grocery run ──
    await G(`L3.addCoins(40, "test")`);
    await t.frames(3);
    t.check("grocery task met", await G(`ctx.journey.task.met === true`));

    // ── the mid-leg interlude (35%): Lulu pulls over, Bubbe calls about the POT ──
    await tp(await legS(0.4), 20);
    await interlude("bubbe", "/POT/");
    // ── the road event (60%): Ima's convoy paces Lulu ──
    await tp(await legS(0.62), 22);
    await t.frames(50);
    t.check("road event fired (Ima's convoy)", await G(`ctx.journey.debug.beats.eventDone === true`));
    await shot("ima-convoy");

    // ── arrive at Bubbe's ──
    const w0 = await t.L(`(${SAVE}.totalCoins || 0)`);
    if (!await arrive(0, "bubbe")) return;
    await shot("arrived-bubbe");
    let sv = await t.L(SAVE);
    t.check("postcard collected", (sv.postcards || []).includes("bubbe"));
    t.check("checkpoint: storyStop = 1", sv.storyStop === 1, `storyStop ${sv.storyStop}`);
    t.check("chapter star for Bubbe", sv.storyStars && sv.storyStars.bubbe === true);
    t.check("first arrival unlocks endless cruise", sv.cruiseUnlocked === true);
    t.check("tripBest = 1", sv.tripBest === 1);
    await t.frames(40);
    const w1 = await t.L(`(${SAVE}.totalCoins || 0)`);
    t.check("arrival reward 60 + task 40 land in the wallet", w1 - w0 >= 100, `${w0} → ${w1}`);
    // the boon: Bubbe's cholent (+1 heart for the next leg)
    await G(`ctx.G.hearts = 2`);
    await t.click(/cholent/);
    t.check("the boon is taken", await t.L(`/✓/.test(document.getElementById("jBoon").textContent)`));
    await t.click(/Keep driving/);
    t.check("Keep driving resumes the next leg", await G(`ctx.state === "playing" && ctx.journey.stopIndex === 1`));
    t.check("Bubbe's cholent heals a heart", await G(`ctx.G.hearts === 3`));

    // ── leg 2: Heshy's pool — chain 3 close calls; Heshy flags Lulu down; the cannonball crossing ──
    await G(`(L3.emit("closeCall", { oncoming: false, combo: 1 }), L3.emit("closeCall", { oncoming: false, combo: 2 }), L3.emit("closeCall", { oncoming: true, combo: 3 }))`);
    t.check("Heshy task: a 3-chain", await G(`ctx.journey.task.met === true`));
    await tp(await legS(0.4), 20);
    await interlude("heshy", "/Real talk/");
    await tp(await legS(0.62), 22);
    await t.frames(45);
    await shot("cannonball");
    if (!await arrive(1, "heshy")) return;
    await shot("arrived-heshy");
    await t.click(/Keep driving/);

    // ── leg 3: the beach — the runaway gear ──
    await skipBeats(true, true);
    await tp(await legS(0.31), 20);
    await t.until(`__lulu3d.ctx.journey.debug.gear.length > 0`, "beach gear spawns at 30%");
    await t.frames(10);
    await shot("beach-gear");
    for (let k = 0; k < 3; k++) {
      const g = await G(`(() => { const g = ctx.journey.debug.gear[0]; return g ? { s: g.s, d: g.d } : null; })()`);
      if (g) { await tp(g.s - 2.5, 4, g.d); await t.frames(20); }
      if (k === 0) { await tp(await legS(0.51), 20); await t.until(`__lulu3d.ctx.journey.debug.gear.length > 0`, "next gear spawns"); await t.frames(30); await shot("coast"); }
      if (k === 1) { await tp(await legS(0.71), 20); await t.until(`__lulu3d.ctx.journey.debug.gear.length > 0`, "last gear spawns"); }
    }
    t.check("caught all 3 pieces of beach gear", await G(`ctx.journey.task.met === true`), await G(`ctx.journey.task.line`));
    if (!await arrive(2, "beach")) return;
    await shot("arrived-beach");
    await t.click(/Keep driving/);

    // ── leg 4: Avigail's place — stranded Avigail, the race, don't bump her car ──
    await skipBeats(false, true);
    await tp(await legS(0.4), 20);
    await interlude("avigail", "/car|BESTIE|Say/");
    await tp(await legS(0.5), 22);
    await t.frames(30);
    await shot("dusk");
    await G(`ctx.journey.debug.fireEvent(3)`);
    await t.frames(30);
    t.check("Avigail races alongside", await G(`ctx.traffic.cars.some(c => c.data && c.data.journeyAvi)`));
    await shot("avigail-race");
    await G(`L3.emit("crash", { kind: "journey_avigail", impact: 4 })`);
    t.check("bumping Avigail's car fails the task", await G(`ctx.journey.task.met === false`));
    if (!await arrive(3, "avigail")) return;
    t.check("Avigail's greeting matches the friendship (bestie)", await t.L(`/BESTIE|spritzers|whatever|Obsessed/.test(document.getElementById("screenCard").textContent)`));
    t.check("task: not this time", await t.L(`/not this time/.test(document.getElementById("screenCard").textContent)`));
    await shot("arrived-avigail");
    await t.click(/Keep driving/);

    // ── leg 5: Viva Vegas — desert heat → Burry's box drop → neon night ──
    await skipBeats(true, false);
    await tp(await legS(0.3), 24);
    await t.frames(40);
    await shot("desert");
    await tp(await legS(0.62), 22);
    await t.frames(60);
    t.check("Burry's box drop fired", await G(`ctx.journey.debug.beats.eventDone === true`));
    await shot("box-drop");
    await tp(await legS(0.85), 24);
    await t.frames(40);
    t.check("night falls over the Strip", await G(`ctx.journey.env === "strip"`));
    await shot("strip");
    const cyc0 = (await t.L(SAVE)).storyCycle || 0;
    if (!await arrive(4, "vegas")) return;
    sv = await t.L(SAVE);
    t.check("STORY COMPLETE banks a new tour", (sv.storyCycle || 0) === cyc0 + 1 && sv.storyStop === 0, `cycle ${sv.storyCycle}, stop ${sv.storyStop}`);
    t.check("tour jackpot shown", await t.L(`/TOUR JACKPOT \\+250/.test(document.getElementById("screenCard").textContent)`));
    t.check("all 5 postcards", (sv.postcards || []).length === 5);
    await shot("arrived-vegas");
    // phone portrait: the (long) finale card still fits and scrolls
    await t.page.setViewportSize({ width: 390, height: 844 });
    await t.frames(8);
    await shot("arrived-vegas-portrait");
    t.check("portrait: Keep cruising button reachable", await t.L(`(() => { const b = document.getElementById("jKeep"); return !!b && b.getBoundingClientRect().width > 100; })()`));
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.frames(4);
    await t.click(/Keep cruising/);
    t.check("endless cruise after the finale", await G(`ctx.state === "playing" && ctx.G.jDone === true`));

    // ── the story map: tour 2, launch the beach chapter on the longer road ──
    await t.tap(9); await t.frames(2);
    await t.click(/Title/);
    await t.until(`__lulu3d.state === "title"`, "back to the title");
    const items2 = await t.L(`[...document.querySelectorAll("#screenCard .menu .btn")].map(b => b.textContent)`);
    t.check("cruise unlocked on the title", items2.some(x => /Cruise/.test(x)));
    t.check("title shows TOUR 2", await t.L(`/TOUR 2/.test(document.querySelector(".jtitle").textContent)`));
    await t.click(/Road to Vegas/);
    if (await t.until(`__lulu3d.state === "storyMap"`, "the story map opens")) {
      await t.frames(30);
      await shot("map");
      await t.tap(15); await t.tap(15);   // D-pad → twice: Bubbe → Heshy → the beach
      await t.frames(20);
      t.check("map info follows the focused stop", await t.L(`/THE BEACH/.test(document.getElementById("jmInfo").textContent)`));
      await shot("map-beach");
      await t.tap(0);
      if (await t.until(`__lulu3d.state === "playing"`, "map launches the beach chapter")) {
        t.check("beach leg on the tour-2 road (×1.5)", await G(`ctx.journey.stopIndex === 2 && Math.abs(ctx.journey.stopS(2) - 1.5 * 19972) < 3`));
        t.check("starts just past Heshy's pool", await G(`Math.abs(ctx.car.s - (ctx.journey.stopS(1) + 34)) < 30`));
      }
    }
    // ── saves persist across a reload ──
    await t.boot();
    await t.frames(5);
    t.check("after a reload: TOUR 2 + postcards on the title", await t.L(`/TOUR 2/.test(document.querySelector(".jtitle").textContent) && document.querySelectorAll(".jtitle .stamp:not(.no)").length === 5`));
    await shot("title-tour2");
    // the map in phone portrait and on a TV
    await t.page.setViewportSize({ width: 390, height: 844 });
    await t.click(/Road to Vegas/);
    if (await t.until(`__lulu3d.state === "storyMap"`, "map opens (portrait)")) {
      await t.frames(25);
      await shot("map-portrait");
      t.check("portrait: all five chapter buttons visible", await t.L(`[...document.querySelectorAll(".jm-node")].filter(b => b.getBoundingClientRect().width > 40).length === 5`));
      await t.tap(1);
      await t.until(`__lulu3d.state === "title"`, "○ backs out of the map");
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`document.body.classList.add("tv")`);
    await t.click(/Road to Vegas/);
    if (await t.until(`__lulu3d.state === "storyMap"`, "map opens (TV)")) {
      await t.frames(25);
      await shot("map-tv");
    }
  },
};
