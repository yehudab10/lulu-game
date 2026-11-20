// 🏠 A run starts at HOME, ON FOOT + NO MORE GAME OVER (roadmap steps 2 + 3).
//
//  • Cruise from the title: control within a second (footRun, walking, no countdown, no card), Lulu at the
//    porch steps, Ima in the doorway with one line, a marker over the car, a gentle first-time hint; the
//    camera glides in from the title shot; walk to the car, ✋ GET IN → the hop-in → the driveway pull-out
//    (its own camera, no garage wall) → "playing" on the street, with no picture jump at the hand-over.
//  • Knocked out in the car: a ~1 s spin-out, then back on her feet beside her car within ~3 s — no
//    game-over card, no countdown; the cost: score banked + reset, a tow fee (10, +5 a knock-out, ≤ 30,
//    never more than she has), hearts full; ✋ back in → driving. Knocked out ON FOOT: she gets up.
//  • Quitting to the title ends the run once (run:end "quit"); quick starts keep the 3-2-1; Restart starts at
//    home again; Story mode starts at home too.
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

module.exports = {
  name: "home",
  query: "&enable=world,foot,banter",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 100, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const g = t.game;
    const st = () => g(`ctx.state`);
    const wallet = () => g(`L3.wallet ? L3.wallet.coins : JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
    await t.frames(10);

    // ── the title: the car nose-out in the driveway, Lulu at the porch steps ──
    const T0 = await g(`(() => { const h = ctx.places.home, P = h.park, rd = ctx.world.road;
      const toRoad = Math.sin(P.h) * (-Math.cos(rd.at(P.s).h)) * -1 + 0;   // (unused)
      const fx = Math.sin(P.h), fz = Math.cos(P.h), ahead = rd.nearest(P.x + fx * 3, P.z + fz * 3, P.s, {});
      return { parked: h.parked(), d: P.d, aheadD: ahead.d, phase: h.phase }; })()`);
    t.check("title: the car is parked in the driveway", T0.parked && T0.phase === "parked", JSON.stringify(T0));
    t.check("…nose-out (facing the street)", T0.aheadD < T0.d - 2, `d ${T0.d.toFixed(1)} → ahead ${T0.aheadD.toFixed(1)}`);
    await t.shot("title");

    // ── Cruise: on foot at home, control at once ──
    const f0 = await g(`ctx.frames`);
    await t.click(/Cruise/);
    t.check("Cruise starts ON FOOT at home", await t.until(`__lulu3d.state === "footRun"`, "footRun", 3000));
    const S0 = await g(`({ frames: ctx.frames - ${f0}, phase: ctx.foot.phase, reason: ctx.foot.debug.F.reason, card: L3.H.screenOpen(),
      countdown: ctx.G.countdown || 0, dep: ctx.places.home.depart(), pos: { x: ctx.foot.pos.x, z: ctx.foot.pos.z }, steps: { x: ctx.places.home.park.x, z: ctx.places.home.park.z },
      car: ctx.foot.parkedCar, blending: ctx.cam.blending, hazards: !ctx.foot.debug.F.car.stub.obj.userData.footHazOff })`);
    t.check("control within a second (walking, no intro hop)", S0.phase === "walk" && S0.frames <= 30, `${S0.frames} frames, phase ${S0.phase}`);
    t.check("no countdown, no card", !S0.card && !S0.countdown);
    t.check("the reason is 'home'", S0.reason === "home");
    t.check("the car waits in the driveway (her own, drivable, no hazards)", S0.car && !S0.car.wrecked && !S0.hazards && near(S0.car, S0.steps) < 0.5);
    t.check("the camera glides in from the title shot (no cut)", S0.blending);
    t.check("first-ever start: the gentle hint", S0.dep.first && /Walk to your car/.test(await g(`ctx.G.hint || ""`)));
    await t.frames(30);
    const S1 = await g(`ctx.places.home.depart()`);
    t.check("Ima is in the doorway with a line", S1.ima && S1.line.length > 5, S1.line);
    t.check("a marker bobs over the car", S1.marker);
    t.check("no ON FOOT trip chip at home", await t.L(`!document.querySelector(".foot-chip")`));
    await t.shot("start");

    // walk to the car (straight up the walk: the car is ahead, up the street)
    await t.stick(0, -1);
    for (let i = 0; i < 30; i++) { await t.frames(4); if (await g(`Math.hypot(ctx.foot.pos.x - ctx.foot.parkedCar.x, ctx.foot.pos.z - ctx.foot.parkedCar.z) < 2.6`)) break; }
    await t.stick(0, 0);
    await t.frames(4);
    const pr = await g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check("at the car: ✋ GET IN", /GET IN/.test(pr), pr);
    await t.shot("at-car");
    // the hop-in: the picture never jumps (≤ 1.5 m between frames)
    await g(`(window.__cj = 0, window.__cp = null, window.__camWatch = setInterval(() => {}, 1000), true)`);
    await t.tap(0);
    let maxJump = 0, prev = null;
    for (let i = 0; i < 40; i++) {
      const p = await g(`({ x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z, st: ctx.state })`);
      if (prev) maxJump = Math.max(maxJump, Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z));
      prev = p;
      await t.frames(1);
      if (p.st === "worldPullOut" && i > 20) break;
    }
    t.check("the hop-in lands in the driveway pull-out", (await st()) === "worldPullOut", await st());
    t.check("the picture glides through the hop-in (≤ 1.5 m a frame)", maxJump <= 1.5, maxJump.toFixed(2) + " m");
    const C = await g(`(() => { const c = ctx.camera.position, P = ctx.places.home.park, rd = ctx.world.road, n = rd.nearest(c.x, c.z, P.s, {});
      return { camD: n.d, camS: n.s, carD: ctx.car.d, drv: ctx.car.driver.visible, depart: ctx.places.home.depart().drives }; })()`);
    t.check("the camera isn't in the garage (it's on the street side of the car)", C.camD < C.carD + 0.5, `cam d ${C.camD.toFixed(1)} · car d ${C.carD.toFixed(1)}`);
    t.check("Lulu is at the wheel", C.drv && C.depart >= 1);
    await t.shot("pullout");
    // drive out: gas, then turn right up the street
    await t.hold(7, 1);
    let handed = false, jump2 = 0, prev2 = null;
    for (let i = 0; i < 160 && !handed; i++) {
      const p = await g(`(() => { const rh = ctx.world.road.at(ctx.car.s).h; return { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z, st: ctx.state, d: ctx.car.d, dh: Math.atan2(Math.sin(ctx.car.h - rh), Math.cos(ctx.car.h - rh)) }; })()`);
      if (prev2) jump2 = Math.max(jump2, Math.hypot(p.x - prev2.x, p.y - prev2.y, p.z - prev2.z));
      prev2 = p;
      await t.stick(p.d < 9.5 ? Math.max(-1, Math.min(1, p.dh * 2.5 - (p.d - 1.75) * 0.08)) : 0.9, 0);
      await t.frames(1);
      handed = p.st === "playing";
    }
    await t.stick(0, 0);
    t.check("out on the street → playing", handed, await st());
    t.check("…no picture jump at the hand-over (≤ 2.5 m a frame while driving)", jump2 < 2.5, jump2.toFixed(2) + " m");
    for (let i = 0; i < 40; i++) {     // settle in the lane
      const p = await g(`(() => { const rh = ctx.world.road.at(ctx.car.s).h; return { d: ctx.car.d, dh: Math.atan2(Math.sin(ctx.car.h - rh), Math.cos(ctx.car.h - rh)) }; })()`);
      await t.stick(Math.max(-1, Math.min(1, p.dh * 2.5 - (p.d - 1.75) * 0.12)), 0);
      await t.frames(2);
    }
    await t.hold(7, 0); await t.stick(0, 0);
    await t.shot("driving");

    // ── knocked out in the car ──
    await g(`(() => { ctx.traffic.clear(); ctx.G.score = 4321; ctx.G.combo = 3; window.__kos = []; L3.on("knockout", e => window.__kos.push(e)); })()`);
    const w0 = await wallet();
    await g(`(() => { for (let i = 0; i < 3; i++) { ctx.G.invT = 0; L3.damage(1, "Lulu vs. a test", "test"); } })()`);
    t.check("out of hearts → the spin-out", (await st()) === "wrecked");
    const k0 = await g(`ctx.frames`);
    await t.frames(6);
    await t.shot("wrecked");
    // (per frame, in the page: the max camera move once she's on foot)
    await g(`(() => { const P = window.__kj = { max: 0, last: null, f: -1 }; const tick = () => {
      if (P.done) return; requestAnimationFrame(tick);
      if (L3.frames === P.f) return; P.f = L3.frames;
      const c = ctx.camera.position;
      if (P.last && ctx.state === "footRun") P.max = Math.max(P.max, c.distanceTo(P.last));
      P.last = c.clone();
      if (ctx.state === "footRun" && ctx.foot.phase === "walk") P.done = true;
    }; requestAnimationFrame(tick); return true; })()`);
    await t.until(`window.__kj && window.__kj.done`, "probe", 8000);
    const kJump = await g(`window.__kj.max`);
    t.check("knock-out: the picture glides from the spin-out to her (≤ 1.5 m a frame)", kJump <= 1.5, kJump.toFixed(2) + " m");
    t.check("back on her feet", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on her feet", 8000));
    const K = await g(`({ frames: ctx.frames - ${k0}, hearts: ctx.G.hearts, max: ctx.G.maxHearts, score: ctx.G.score, combo: ctx.G.combo, banked: ctx.G.banked, ko: ctx.G.knockouts,
      reason: ctx.foot.debug.F.reason, car: ctx.foot.parkedCar, card: L3.H.screenOpen(), countdown: ctx.G.countdown || 0 })`);
    t.check("…within ~3 s (90 frames)", K.frames <= 90, `${K.frames} frames`);
    t.check("no game-over card, no countdown", !K.card && !K.countdown && (await st()) !== "gameover");
    t.check("knock-out cost: score banked + reset", K.score < 5 && K.banked >= 4321 && K.banked < 4400 && K.combo === 0, JSON.stringify({ s: K.score, b: K.banked, c: K.combo }));
    t.check("knock-out: hearts back to full", K.hearts === K.max);
    const w1 = await wallet();
    t.check("knock-out cost: the tow fee (10 💰)", (await g(`window.__kos[0] && window.__kos[0].fee`)) === 10 && w0 - w1 >= 8, `${w0} → ${w1}`);
    t.check("her car is right there, patched up (drivable)", K.reason === "knockout" && K.car && !K.car.wrecked);
    await t.shot("knocked-out");
    await t.frames(10);
    t.check("✋ back in the car", await g(`ctx.foot.debug.getIn()`));
    t.check("…driving again", await t.until(`__lulu3d.state === "playing"`, "driving again", 3000));

    // a second and a third knock-out: 15, then 20 — and never more than she has
    await g(`(() => { ctx.traffic.clear(); for (let i = 0; i < 3; i++) { ctx.G.invT = 0; L3.damage(1, "t", "test"); } })()`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "KO #2", 8000);
    const w2 = await wallet();
    t.check("knock-out #2: 15 💰", (await g(`window.__kos[1] && window.__kos[1].fee`)) === 15, `${w1} → ${w2}`);
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`__lulu3d.state === "playing"`, "driving again", 3000);
    await g(`(() => { L3.wallet.add(-(L3.wallet.coins - 7)); ctx.traffic.clear(); for (let i = 0; i < 3; i++) { ctx.G.invT = 0; L3.damage(1, "t", "test"); } })()`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "KO #3", 8000);
    t.check("the fee is never more than she has (7 left → 0)", (await wallet()) === 0, String(await wallet()));
    t.check("fee rule: capped at 30", await g(`(() => { const K = L3.KO; return Math.min(K.feeMax, K.feeBase + K.feeStep * 20) === 30; })()`));

    // ── knocked out ON FOOT: she sits up and walks it off ──
    await g(`(() => { L3.wallet.add(50); ctx.G.hearts = 1; ctx.G.invT = 0; ctx.foot.force.er = false; ctx.G.score = 99; })()`);
    // (she stands in an empty lane well AHEAD of her parked car — a car behind it would brake for the car, not reach her)
    const kf = await g(`(() => { const F = ctx.foot.debug.F, rd = ctx.world.road, s = F.s + 40, p = rd.point(s, 1.75, {});
      F.pos.set(p.x, 0.05, p.z); F.s = s; F.d = 1.75; F.vel.set(0, 0, 0);
      ctx.traffic.cars.filter(c => !c.free).forEach(c => ctx.traffic.remove(c));
      const c = ctx.traffic.add("sedan", s - 25, 1.75, 1, 16); if (c) c.data.footAttn = false; return !!c; })()`);
    const kf0 = await g(`ctx.frames`);
    t.check("a car comes at her", kf);
    let flat = await t.until(`__lulu3d.ctx.G.knockouts >= 4`, "knocked flat on foot", 6000);
    for (let i = 0; i < 2 && !flat; i++) {     // (a slow runner: the car can miss her — a fresh one aimed at where she stands)
      await g(`(() => { ctx.G.hearts = 1; ctx.G.invT = 0; const F = ctx.foot.debug.F; ctx.traffic.cars.filter(c => !c.free).forEach(c => ctx.traffic.remove(c));
        ctx.traffic.cars.filter(c => !c.free).forEach(c => ctx.traffic.remove(c));
        const c = ctx.traffic.add("truck", F.s - 14, F.d, 1, 18); if (c) c.data.footAttn = false; })()`);
      flat = await t.until(`__lulu3d.ctx.G.knockouts >= 4`, "knocked flat on foot (again)", 8000);
    }
    if (flat) {
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "up again", 6000);
      const KF = await g(`({ frames: ctx.frames - ${kf0}, st: ctx.state, hearts: ctx.G.hearts, banked: ctx.G.banked })`);
      t.check("on foot: back up, still walking, hearts full", KF.st === "footRun" && KF.hearts === 3, JSON.stringify(KF));
      await t.shot("foot-ko");
    }

    // ── quitting to the title ends the run (once) ──
    await g(`(window.__ends = [], L3.on("run:end", e => window.__ends.push(e.reason)), true)`);
    await g(`L3.setState("title")`);
    await t.frames(4);
    const ends = await g(`window.__ends`);
    t.check("quit to the title → run:end once (quit)", ends.length === 1 && ends[0] === "quit", JSON.stringify(ends));

    // ── quick starts keep the 3-2-1 (tests, checkpoints) ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    t.check("quick start → the countdown", (await st()) === "intro");
    await t.until(`__lulu3d.state === "playing"`, "quick → playing", 4000);

    // ── Restart from the pause menu: home again ──
    await g(`L3.openMenuItem ? true : true`);
    await t.key("Escape");
    await t.frames(3);
    const hasRestart = await t.L(`!!document.querySelector('[data-pi="restart"]')`);
    t.check("pause menu has Restart", hasRestart);
    if (hasRestart) {
      await t.L(`document.querySelector('[data-pi="restart"]').click()`);
      t.check("Restart → at home on foot", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.reason === "home"`, "restart home", 3000));
      t.check("…and the run before it was banked (run:end restart)", (await g(`window.__ends`)).includes("restart"));
    }

    // ── Story from the title: home too ──
    await g(`L3.setState("title")`);
    await t.frames(4);
    await g(`ctx.places.debug.parkNow()`);
    await t.click(/Story Trip/);
    t.check("Story Trip starts at home on foot", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.G.mode === "story"`, "story home", 3000));
    t.check("…a returning player gets no tutorial hint", !(await g(`ctx.places.home.depart().first`)));
    await t.frames(20);
    await t.shot("story-start");
    await g(`ctx.foot.debug.getIn()`);
    t.check("Story: in the car", await t.until(`["worldPullOut", "playing"].includes(__lulu3d.state)`, "story car", 3000));
  },
};
