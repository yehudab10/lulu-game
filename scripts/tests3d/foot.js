// Lulu on Foot + Avigail's wedding: pull over and climb out with ✕, walk / run with the
// stick, talk / pet / busk, get clipped by a car (a heart), walk into a storefront door
// (a stand-in interior), hotwire a parked car and drive it, then the wedding start to
// finish (petals, 7 circles, the glass, the hora, catching the bouquet), and finally a
// knockout with no hearts left → game over. Checks rewards land in the shared wallet,
// footRunsPlayed / footRunHigh persist, and the states hand over cleanly. A spun wreck and the parking
// pull-over each play exactly ONE get-out animation (no second climb-out, no camera swoop).
// What plays when Lulu gets out of the car (the owner saw a "double animation"): `exits` counts get-out
// animations (the parking lot's walk-out + every foot session that hops out of the seat), `footStarts` the
// foot:start events; once she's in the foot world, `maxJump` is the biggest one-frame camera move (a swoop)
// and `minCam` how close the intro camera gets to her (it used to sit on top of a spun wreck).
const EXIT_PROBE = `Promise.all([import("./js/core/ctx.js")]).then(([C]) => {
  const ctx = C.ctx, P = window.__exit = { exits: 0, footStarts: 0, maxJump: 0, minCam: 99, on: true };
  C.on("foot:start", () => { if (!P.on) return; P.footStarts++; const F = ctx.foot.debug.F; if (F.phase === "intro" && F.hopFrom.distanceTo(F.hopTo) > 0.5) P.exits++; P.f0 = ctx.frames; });
  let last = null, park = null;
  const tick = () => {
    if (!P.on) return;
    requestAnimationFrame(tick);
    const ph = ctx.parking && ctx.parking._debug && ctx.parking._debug.active ? ctx.parking._debug.phase : null;
    if (ph === "walkout" && park !== "walkout") P.exits++;
    park = ph;
    const F = ctx.foot && ctx.foot.debug.F, cp = ctx.camera.position;
    if (F && ctx.state === "footRun" && !ctx.view && P.f0 != null && ctx.frames > P.f0 + 1 && F.t < 4) {
      if (last) P.maxJump = Math.max(P.maxJump, +cp.distanceTo(last).toFixed(2));
      if (F.phase === "intro") P.minCam = Math.min(P.minCam, +cp.distanceTo(F.lulu.obj.position).toFixed(2));
      last = cp.clone();
    } else last = null;
  };
  requestAnimationFrame(tick);
  return true;
})`;

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

    // ── talk to a pedestrian: bubbles + a chat stat, but NO coins (tips were an endless coin tap) ──
    await t.frames(30);
    const ped = await t.game(`(() => { const F = ctx.foot.debug.F; const p = ctx.foot.debug.spawnPed({ s: F.s + 1.2, d: F.d + 0.4, speed: 0, drunk: false }); return !!p; })()`);
    t.check("a pedestrian can stand next to her", ped);
    await t.frames(4);
    t.check("prompt offers 💬 TALK", await t.L(`/TALK/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
    const w0 = await wallet(), fc0 = await F("coins");
    await t.L(`import("./js/core/ctx.js").then(m => { window.__coinEv = []; m.on("coin", e => window.__coinEv.push(e.why)); return true; })`);
    await t.tap(0);
    t.check("talking pops speech bubbles", await t.L(`document.querySelectorAll("#footBubbles .fbub").length >= 2`));
    await t.shot("talk");
    await t.frames(40);
    // talk again a few times (it used to pay 30% of the time)
    for (let i = 0; i < 5; i++) { await t.game(`(() => { const p = ctx.foot.debug.F.peds.at(-1); if (p) p.talkT = 0; })()`); await t.tap(0); await t.frames(8); }
    t.check("talking pays no coins (wallet + run tally unchanged)", await wallet() === w0 && await F("coins") === fc0, `${w0} → ${await wallet()}`);
    // busk (the hand button with nothing to interact with): the peds cheer, no coins
    await t.game(`(() => { const F = ctx.foot.debug.F; F.peds.forEach(p => p.s += 200); for (let i = 0; i < 3; i++) ctx.foot.debug.spawnPed({ s: F.s + 6 + i * 2, d: F.d + 3, speed: 0, drunk: false }); })()`);
    await t.frames(4);
    const pr0 = await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
    t.check("nothing to interact with → the hand button busks", !/TALK|PET|HAIL|BORROW|GET BACK|CARJACK|ENTER/.test(pr0), pr0);
    for (let i = 0; i < 4; i++) { await t.game(`ctx.foot.debug.F.buskT = 0`); await t.tap(0); await t.frames(6); }
    t.check("busking: the crowd cheers (👏)", await t.L(`[...document.querySelectorAll("#footBubbles .fbub")].some(b => /👏/.test(b.textContent))`));
    t.check("busking pays no coins either", await wallet() === w0 && await F("coins") === fc0, `${w0} → ${await wallet()}`);

    // ── pet an animal ──
    await t.game(`(() => { const F = ctx.foot.debug.F; ctx.foot.debug.F.peds.forEach(p => p.s += 200); })()`);
    await t.frames(4);
    const an = await t.game(`(() => { const F = ctx.foot.debug.F; return !!ctx.foot.debug.spawnAnimal({ key: "foot_duck", s: F.s + 0.9, d: F.d }); })()`);
    if (an) {
      for (let i = 0; i < 4; i++) await t.game(`(() => { const a = ctx.foot.debug.F.animals.at(-1); a.wait = 9; a.ts = a.s; a.td = a.d; })()`);
      await t.frames(3);
      t.check("prompt offers 🐾 PET", await t.L(`/PET/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`));
      const c0 = await F("coins"), pw0 = await wallet();
      await t.tap(0);
      await t.frames(3);
      t.check("petting: the critter scoots off happy", await t.game(`ctx.foot.debug.F.animals.at(-1).petT > 0`));
      t.check("petting pays no coins (it was an endless coin tap)", (await F("coins")) === c0 && await wallet() === pw0, `${pw0} → ${await wallet()}`);
      await t.shot("pet");
      t.check("no 'tip' / 'busk' / 'pet' coin events on foot", await t.L(`!(window.__coinEv || []).some(w => /^(tip|busk|pet)$/.test(w))`), await t.L(`JSON.stringify(window.__coinEv || [])`));
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

    // ── a wreck that left the car spun sideways: she still climbs out ONCE, framed from the road ──
    await t.L(EXIT_PROBE);
    await t.game(`(ctx.car.h += 1.7, ctx.foot.start("carWreck"))`);
    await t.frames(20);
    await t.shot("wreck-climb-out");
    await t.until(`__lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.foot.debug.F.t > 3.6`, "back on foot after a wreck");
    const X = await t.L(`({ ...window.__exit })`);
    t.check("spun wreck: one get-out animation, one foot:start", X.exits === 1 && X.footStarts === 1, JSON.stringify(X));
    t.check("spun wreck: the intro camera frames her from the road (not on top of the car), no swoop into walking", X.minCam > 3.5 && X.maxJump < 1.5, JSON.stringify(X));
    await t.L(`window.__exit.on = false`);

    // ── Avigail's wedding (forced) ──
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
    for (let i = 0; i < 12 && (await t.game(`ctx.foot.debug.weddingState().prog`)) < 1; i++) await t.tap(0);
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().phase === 1`, "she reaches the chuppah", 240000);
    await t.frames(20);
    await t.shot("wedding-circles");
    for (let i = 0; i < 14 && (await t.game(`ctx.foot.debug.weddingState().circles`)) < 7; i++) { await t.tap(0); await t.frames(6); }
    if (await t.until(`__lulu3d.ctx.foot.debug.weddingState().circles >= 7`, "seven circles", 240000)) t.check("seven circles", true);
    await t.frames(10);
    await t.shot("wedding-glass");
    await t.tap(0);
    t.check("✕ stomps the glass", await t.game(`ctx.foot.debug.weddingState().stomped`));
    await t.frames(4);
    t.check("MAZEL TOV!!! shows", await t.until(`(() => { const m = document.querySelector("#footWed .mazel"); return !!m && getComputedStyle(m).display !== "none"; })()`, "MAZEL TOV banner", 4000));
    await t.shot("wedding-mazel-tov");
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().phase === 2`, "the hora", 240000);
    await t.frames(40);
    await t.shot("wedding-hora");
    await t.until(`__lulu3d.ctx.foot.debug.weddingState().bq > 0.66`, "the bouquet flies toward Lulu", 240000);
    await t.tap(0);
    t.check("✕ in the window catches the bouquet", await t.game(`ctx.foot.debug.weddingState().caught === true`));
    await t.frames(6);
    await t.shot("wedding-bouquet-caught");
    if (await t.until(`__lulu3d.state === "footRun"`, "back to walking after the wedding", 240000)) t.check("back to walking after the wedding", true);
    await t.frames(40);
    t.check("bouquet reward: +41 (40 💰 + 1 ⭐)", await wallet() - w1 >= 41, `${w1} → ${await wallet()}`);
    t.check("Avigail friendship +20", (await save2d("avigailRel")) - (rel0 || 50) === 20, `${rel0} → ${await save2d("avigailRel")}`);

    await t.frames(75);   // the 2 s re-entry shield runs out
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

    // ── out of hearts on foot → a KNOCK-OUT: she sits up and walks it off (no game over; ER forced off) ──
    await t.until(`__lulu3d.state === "footRun"`, "walking again before the last test", 240000);
    await t.game(`(() => { ctx.foot.force.er = false; ctx.G.hearts = 1; ctx.G.invT = 0; window.__ko0 = ctx.G.knockouts || 0; const F = ctx.foot.debug.F;
      const r = ctx.world.road, p = r.point(F.s + 40, 3.5, {}); F.pos.set(p.x, 0, p.z); F.s += 40; F.d = 3.5; ctx.traffic.cars.filter(c => !c.free).forEach(c => ctx.traffic.remove(c));
      const c = ctx.traffic.add("truck", F.s - 16, 3.5, 1, 20); c.data.footAttn = false; })()`);
    let koed = await t.until(`(__lulu3d.ctx.G.knockouts || 0) > window.__ko0`, "last heart on foot → knocked out", 40000);
    for (let i = 0; i < 2 && !koed; i++) {     // (the truck can miss her — a fresh one aimed at where she stands now)
      await t.game(`(() => { ctx.G.hearts = 1; ctx.G.invT = 0; const F = ctx.foot.debug.F; ctx.traffic.cars.filter(c => !c.free).forEach(c => ctx.traffic.remove(c));
        const c = ctx.traffic.add("truck", F.s - 14, F.d, 1, 18); c.data.footAttn = false; })()`);
      koed = await t.until(`(__lulu3d.ctx.G.knockouts || 0) > window.__ko0`, "last heart on foot → knocked out (again)", 40000);
    }
    if (koed) {
      t.check("last heart on foot → a knock-out, not game over", (await t.game(`ctx.state`)) !== "gameover");
      t.check("…she gets up and walks on, hearts full", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.G.hearts === __lulu3d.ctx.G.maxHearts`, "up again", 20000));
      t.check("footRunHigh saved to the shared 2D save", (await save2d("footRunHigh")) > 0, String(await save2d("footRunHigh")));
      await t.shot("knockout");
    }
    await t.game(`(ctx.foot.end("test"), true)`);

    // ── pulled over into the roadside lot: she walks out of the parked car THERE, and the foot world picks
    //    up with her already on her feet — no second climb-out from the driver's seat ──
    await t.game(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a fresh drive")) return;
    await t.game(`(ctx.foot.force.er = null, ctx.traffic.config.enabled = false, ctx.traffic.clear())`);
    await t.L(EXIT_PROBE);
    await t.game(`ctx.parking.start({ from: "pullover" })`);
    const PK = `__lulu3d.ctx.parking._debug`;
    if (!await t.until(`${PK}.phase === "drive"`, "the roadside lot is ready", 90000)) return;
    await t.game(`(() => { const s = ctx.parking._debug, L = s.L; s.lot.car.place((L.zx0 + L.zx1) / 2, (Math.max(L.curbZ, L.zz0) + L.zz1) / 2, -Math.PI / 2); })()`);
    if (!await t.until(`${PK}.phase === "result"`, "parked in the bay")) return;
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.t > 3.6`, "walk-out → Lulu on foot", 90000)) return;
    const W = await t.L(`({ ...window.__exit })`);
    t.check("pull-over: ONE get-out (the lot's walk-out), one foot:start — no second climb-out", W.exits === 1 && W.footStarts === 1, JSON.stringify(W));
    t.check("…she starts on her feet next to her parked car", await t.game(`ctx.foot.debug.F.reason === "droveOff" && ctx.foot.debug.F.car.drivable && ctx.foot.phase === "walk"`));
    t.check("pull-over: no camera swoop into the foot world", W.maxJump < 1.5, JSON.stringify(W));
    await t.L(`window.__exit.on = false`);
    await t.shot("pullover-on-foot");
  },
};
