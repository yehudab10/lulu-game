// Lulu on Foot + Avigail's wedding: pull over and climb out with ✕, walk / run with the
// stick, talk / pet / busk, get clipped by a car (a heart), walk into a storefront door
// (a stand-in interior), hotwire a parked car and drive it, then the wedding start to
// finish (petals, 7 circles, the glass, the hora, catching the bouquet), and finally a
// knockout with no hearts left → game over. Checks rewards land in the shared wallet,
// footRunsPlayed / footRunHigh persist, and the states hand over cleanly.
module.exports = {
  name: "foot",
  query: "&enable=foot",
  save2d: { totalCoins: 100, avigailRel: 50, footRunsPlayed: 2, footRunHigh: 0 },
  async run(t) {
    const F = k => t.game(`ctx.foot.debug.F && ctx.foot.debug.F.${k}`);
    const wallet = () => t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").totalCoins || 0)`);
    const save2d = k => t.L(`(JSON.parse(localStorage.getItem("luluSaveV2") || "{}").${k})`);
    t.check("ctx.foot service is registered", await t.game(`!!(ctx.foot && ctx.foot.start && ctx.foot.addSpot)`));

    // ── drive, pull onto the shoulder, stop: "Get out & walk" → ✕ ──
    await t.game(`L3.startRun({ mode: "story" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "drive starts")) return;
    await t.hold(7, 1); await t.frames(25); await t.hold(7, 0);
    await t.game(`(() => { const r = ctx.world.road, s = ctx.car.s + 30, p = r.point(s, 7.7, {}); ctx.traffic.clear(); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; })()`);
    await t.frames(55);
    t.check("stopped on the shoulder → the get-out prompt shows", await t.L(`/Get out/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
    await t.tap(0);
    if (await t.until(`__lulu3d.state === "footRun"`, "✕ climbs out (footRun)", 30000)) t.check("✕ climbs out (footRun)", true);
    else { await t.game(`ctx.foot.start("droveOff")`); if (!await t.until(`__lulu3d.state === "footRun"`, "ctx.foot.start works")) return; }
    t.check("reason droveOff, her car parked + drivable", await t.game(`ctx.foot.debug.F.reason === "droveOff" && ctx.foot.debug.F.car.drivable`));
    t.check("footRunsPlayed persists (2 → 3)", await save2d("footRunsPlayed") === 3);
    t.check("difficulty level follows footRunsPlayed", await t.game(`ctx.foot.level`) === 3);
    await t.frames(10);
    await t.shot("climb-out");
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "intro hands over to walking");

    // ── walking + running with the left stick (R1 = sprint) ──
    const s0 = await F("s");
    await t.stick(0, -1); await t.frames(40);
    const s1 = await F("s");
    t.check("stick up walks her down the road", s1 - s0 > 2.5, `${(s1 - s0).toFixed(1)} m`);
    await t.hold(5, 1); await t.frames(40); await t.hold(5, 0);
    const s2 = await F("s");
    t.check("R1 sprints (faster than walking)", (s2 - s1) > (s1 - s0) * 1.4, `${(s1 - s0).toFixed(1)} → ${(s2 - s1).toFixed(1)} m`);
    await t.stick(0, 0); await t.frames(10);
    t.check("the world streams around her (car anchor follows)", await t.game(`Math.abs(ctx.car.s - ctx.foot.debug.F.s) < 0.5`));
    await t.shot("walking");

    // ── talk to a pedestrian (forced tip) ──
    await t.frames(30);
    const ped = await t.game(`(() => { const F = ctx.foot.debug.F; const p = ctx.foot.debug.spawnPed({ s: F.s + 1.2, d: F.d + 0.4, speed: 0, drunk: false }); return !!p; })()`);
    t.check("a pedestrian can stand next to her", ped);
    await t.frames(4);
    t.check("prompt offers 💬 TALK", await t.L(`/TALK/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
    const w0 = await wallet();
    await t.game(`ctx.foot.force.tip = true`);
    await t.tap(0);
    t.check("talking pops speech bubbles", await t.L(`document.querySelectorAll("#footBubbles .fbub").length >= 2`));
    await t.shot("talk");
    await t.frames(40);
    t.check("a tip lands in the shared wallet", await wallet() - w0 >= 1, `${w0} → ${await wallet()}`);
    await t.game(`ctx.foot.force.tip = false`);

    // ── pet an animal ──
    await t.game(`(() => { const F = ctx.foot.debug.F; ctx.foot.debug.F.peds.forEach(p => p.s += 200); })()`);
    await t.frames(4);
    const an = await t.game(`(() => { const F = ctx.foot.debug.F; return !!ctx.foot.debug.spawnAnimal({ key: "foot_duck", s: F.s + 0.9, d: F.d }); })()`);
    if (an) {
      for (let i = 0; i < 4; i++) await t.game(`(() => { const a = ctx.foot.debug.F.animals.at(-1); a.wait = 9; a.ts = a.s; a.td = a.d; })()`);
      await t.frames(3);
      t.check("prompt offers 🐾 PET", await t.L(`/PET/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
      const c0 = await F("coins");
      await t.tap(0);
      t.check("petting earns a coin", (await F("coins")) > c0);
      await t.shot("pet");
    } else t.check("the duck model loads", false);

    // ── a car clips her: lose a heart, get knocked flat, get up ──
    await t.frames(70);   // let any shield run out
    const h0 = await t.game(`ctx.G.hearts`);
    await t.game(`(() => { const F = ctx.foot.debug.F; ctx.G.invT = 0; ctx.foot.debug.F.animals.forEach(a => a.s += 300);
      const c = ctx.traffic.add("sedan", F.s - 14, F.d, 1, 18); c.data.footAttn = false; })()`);
    await t.until(`__lulu3d.ctx.foot.phase === "knock"`, "a speeding car knocks her down", 30000);
    t.check("a speeding car knocks her down", await t.game(`ctx.foot.phase === "knock"`));
    t.check("…and it costs a heart", await t.game(`ctx.G.hearts`) === h0 - 1, `${h0} → ${await t.game(`ctx.G.hearts`)}`);
    await t.frames(8);
    await t.shot("knocked");
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "she gets back up");

    // ── a storefront door → the interiors contract (a stand-in interior) ──
    await t.game(`(() => {
      window.__inside = 0;
      ctx.interiors.bar = { name: "The Thirsty Scholar", emoji: "🍺", enter({ exit }) { window.__inside++; window.__exitBar = exit; } };
    })()`);
    const door = await t.game(`ctx.foot.debug.nextDoorAt(ctx.foot.debug.F.s, "bar")`);
    t.check("Main Street has a bar ahead", !!door);
    if (door) {
      // walk there the quick way: teleport just short of it and let the chunks build
      await t.game(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, p = r.point(${door.s} - 40, ${door.side} * 9.5, {});
        F.pos.set(p.x, 0, p.z); F.s = ${door.s} - 40; ctx.traffic.clear(); })()`);
      await t.until(`__lulu3d.ctx.foot.debug.allDoors().some(d => d.id === "bar")`, "the block with the bar is built", 60000);
      await t.shot("main-street");
      await t.game(`(() => { const F = ctx.foot.debug.F, d = ctx.foot.debug.allDoors().find(d => d.id === "bar");
        const r = ctx.world.road, p = r.point(d.s, d.side * (Math.abs(d.d) - 0.6), {}); F.pos.set(p.x, 0, p.z); F.s = d.s; F.peds.forEach(x => x.s += 300); })()`);
      await t.frames(6);
      t.check("prompt offers 🚪 ENTER BAR", await t.L(`/ENTER BAR/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
      await t.shot("bar-door");
      await t.tap(0);
      await t.frames(40);
      t.check("✕ walks in and calls ctx.interiors.bar.enter()", await t.L(`window.__inside === 1`));
      t.check("ctx.foot.active stays true while inside", await t.game(`ctx.foot.active`));
      await t.L(`window.__exitBar()`);
      await t.frames(6);
      t.check("exit() resumes walking outside the door", await t.game(`ctx.state === "footRun" && ctx.foot.phase === "walk"`));
      await t.shot("bar-exit");
    }

    // ── hotwire a parked car and drive it ──
    await t.game(`(() => { const F = ctx.foot.debug.F; ctx.traffic.clear(); F.peds.forEach(x => x.s += 300); F.parked.forEach(x => { x.s -= 500; x.busted = true; });
      ctx.foot.debug.spawnParked({ vtype: "cop", s: F.s + 4, side: Math.sign(F.d) || 1, lemon: null }); })()`);
    await t.game(`(() => { const F = ctx.foot.debug.F, pc = F.parked.at(-1); const r = ctx.world.road, p = r.point(pc.s, pc.d + Math.sign(pc.d) * 2.0, {}); F.pos.set(p.x, 0, p.z); })()`);
    await t.frames(5);
    t.check("prompt offers 🚓 HOTWIRE COP CAR", await t.L(`/HOTWIRE COP CAR/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
    await t.tap(0);
    await t.until(`__lulu3d.ctx.foot.phase === "hotwire"`, "she sidles up and the hotwire challenge opens", 30000);
    t.check("hotwire slider is on screen", await t.L(`!document.querySelector("#footHot").classList.contains("hidden")`));
    await t.shot("hotwire");
    await t.game(`ctx.foot.force.hotwire = true`);
    await t.tap(0); await t.tap(0);
    if (await t.until(`__lulu3d.state === "playing"`, "two clean pins → she drives off in it", 30000)) {
      t.check("two clean pins → she drives off in it", true);
      t.check("it's the cop car shell (G.borrowed)", await t.game(`ctx.G.borrowed === "cop" && ctx.foot.borrowed === "cop"`));
      t.check("foot session ended", await t.game(`!ctx.foot.active`));
      await t.hold(7, 1); await t.frames(30); await t.hold(7, 0);
      t.check("the borrowed ride drives", await t.game(`ctx.car.speed > 4`), `${(await t.game(`ctx.car.speed`)).toFixed(1)} m/s`);
      await t.shot("borrowed-cop-car");
    }
    await t.game(`ctx.foot.force.hotwire = null`);

    // ── Avigail's wedding (forced) ──
    await t.game(`ctx.foot.start("carWreck")`);
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "back on foot after a wreck");
    t.check("wreck → the stub of the wrecked ride stays on the road", await t.game(`ctx.foot.debug.F.car && ctx.foot.debug.F.car.wrecked && ctx.traffic.cars.includes(ctx.foot.debug.F.car.stub)`));
    const w1 = await wallet();
    const rel0 = await save2d("avigailRel");
    await t.game(`ctx.foot.meetAvigail("wedding")`);
    if (!await t.until(`__lulu3d.state === "footWedding"`, "meeting Avigail → her wedding", 60000)) return;
    t.check("meeting Avigail → her wedding", true);
    await t.frames(30);
    await t.shot("wedding-procession");
    for (let i = 0; i < 6; i++) await t.tap(0);
    t.check("✕ throws petals + hurries her down the aisle", await t.game(`ctx.foot.debug.weddingState().prog > 0.4`));
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().phase === 1`, "she reaches the chuppah", 60000);
    await t.frames(20);
    await t.shot("wedding-circles");
    for (let i = 0; i < 14 && (await t.game(`ctx.foot.debug.weddingState().circles`)) < 7; i++) { await t.tap(0); await t.frames(6); }
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().circles >= 7`, "seven circles", 60000);
    t.check("seven circles", true);
    await t.frames(10);
    await t.shot("wedding-glass");
    await t.tap(0);
    t.check("✕ stomps the glass", await t.game(`ctx.foot.debug.weddingState().stomped`));
    await t.frames(4);
    t.check("MAZEL TOV!!! shows", await t.L(`getComputedStyle(document.querySelector("#footWed .mazel")).display !== "none"`));
    await t.shot("wedding-mazel-tov");
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().phase === 2`, "the hora", 60000);
    await t.frames(40);
    await t.shot("wedding-hora");
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().bq > 0.66`, "the bouquet flies toward Lulu", 60000);
    await t.tap(0);
    t.check("✕ in the window catches the bouquet", await t.game(`ctx.foot.debug.weddingState().caught === true`));
    await t.frames(6);
    await t.shot("wedding-bouquet-caught");
    if (await t.until(`__lulu3d.state === "footRun"`, "back to walking after the wedding", 60000)) t.check("back to walking after the wedding", true);
    await t.frames(40);
    t.check("bouquet reward: +41 (40 💰 + 1 ⭐)", await wallet() - w1 >= 41, `${w1} → ${await wallet()}`);
    t.check("Avigail friendship +20", (await save2d("avigailRel")) - (rel0 || 50) === 20, `${rel0} → ${await save2d("avigailRel")}`);

    // ── phone portrait with touch controls, then TV mode ──
    await t.page.setViewportSize({ width: 390, height: 780 });
    await t.L(`window.dispatchEvent(new Event("touchstart"))`);
    await t.game(`(() => { const F = ctx.foot.debug.F; ctx.foot.debug.spawnPed({ s: F.s + 1.5, d: F.d + 0.5, speed: 0, drunk: true }); })()`);
    await t.frames(8);
    t.check("touch: the ✋ hand button shows on foot", await t.L(`(() => { const b = document.querySelector("#tx_foot_hand"); return !!b && b.offsetParent !== null; })()`));
    t.check("touch: the driving pedals are hidden on foot", await t.L(`getComputedStyle(document.querySelector("#touch .pedals")).display === "none"`));
    await t.shot("phone-portrait");
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.tap(13);
    await t.L(`document.body.classList.add("tv")`);
    await t.frames(6);
    await t.shot("tv-mode");
    await t.L(`document.body.classList.remove("tv")`);

    // ── out of hearts on foot → game over (ER forced off) ──
    await t.game(`(() => { ctx.foot.force.er = false; ctx.G.hearts = 1; ctx.G.invT = 0; const F = ctx.foot.debug.F;
      const r = ctx.world.road, p = r.point(F.s + 40, 3.5, {}); F.pos.set(p.x, 0, p.z); F.s += 40; F.d = 3.5; ctx.traffic.cars.filter(c => !c.free).forEach(c => ctx.traffic.remove(c));
      const c = ctx.traffic.add("truck", F.s - 16, 3.5, 1, 20); c.data.footAttn = false; })()`);
    if (await t.until(`__lulu3d.state === "gameover"`, "last heart on foot → game over", 60000)) {
      t.check("last heart on foot → game over", true);
      t.check("foot ended", await t.game(`!ctx.foot.active`));
      t.check("footRunHigh saved to the shared 2D save", (await save2d("footRunHigh")) > 0, String(await save2d("footRunHigh")));
      await t.shot("gameover");
    }
  },
};
