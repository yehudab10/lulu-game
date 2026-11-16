// Playground: ✨ golden dreidels (run counter, lifetime total, the CHAI! reward
// every 18), 🛹 stunt ramps (visual lift-off, mid-air spin, LEAPFROG over a car,
// a harmless landing, she keeps driving), and 📸 photo mode from the pause menu
// (stick orbit, zoom, filters, frames, poses, save → PNG download + album entry,
// and ○ back to the EXACT paused run: camera, HUD, car, run clock).
const save3 = `JSON.parse(localStorage.getItem("lulu3dSave") || "{}")`;

module.exports = {
  name: "play",
  query: "&enable=play",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 1 },
  save3d: { f: { play: { dreidels: 16 } } },
  async run(t) {
    const G = code => t.game(code);
    const place = (s, d, v) => G(`(() => { const p = ctx.world.road.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; })()`);
    let downloads = 0;
    t.page.on("download", () => { downloads++; });
    await t.frames(6);

    // ── title: photo mode opens and comes back to the title ──
    t.check("title has 📸 Photo mode", (await t.titleItems()).some(s => /Photo mode/.test(s)));
    await t.click(/Photo mode/);
    t.check("photo mode opens from the title", await G(`ctx.state === "playPhoto" && !document.getElementById("pp-root").classList.contains("hidden")`));
    await t.frames(4);
    await t.tap(1);
    await t.until(`__lulu3d.state === "title" && !!document.querySelector("#screenCard .logo")`, "○ goes back to the title screen");

    // ── drive ──
    await G(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await G(`(ctx.traffic.config.enabled = false, ctx.traffic.clear())`);

    // ── ✨ golden dreidels: a line of 4 in her lane ──
    const life0 = await G(`ctx.play.dreidels`);
    const coins0 = await G(`ctx.G.coins`);
    await place(14, 1.75, 6);
    await G(`ctx.play.debug.spawnDreidels(22, 1.75, 4, 6)`);
    await t.frames(4);
    await t.shot("dreidels");
    await t.hold(7, 0.7);
    await t.until(`__lulu3d.ctx.G.playDreidels >= 4`, "drives through 4 golden dreidels", 20000);
    t.check("the run counter counts them", (await G(`ctx.G.playDreidels`)) === 4, String(await G(`ctx.G.playDreidels`)));
    t.check("the lifetime total goes up by 4", (await G(`ctx.play.dreidels`)) === life0 + 4, `${life0} → ${await G(`ctx.play.dreidels`)}`);
    t.check("HUD chip shows ✨ 4", await t.L(`(() => { const c = document.querySelector(".pl-chip"); return !!c && c.offsetParent !== null && c.querySelector("b").textContent === "4"; })()`));
    t.check("18 lifetime → CHAI! milestone (+36 coins, golden trail)", (await G(`ctx.G.coins`)) >= coins0 + 36 && await G(`ctx.G.playTrail === true`),
      `coins ${coins0} → ${await G(`ctx.G.coins`)}`);
    await t.frames(6);
    await t.shot("dreidel-chai");
    await t.until(`(${save3}).f && (${save3}).f.play && (${save3}).f.play.dreidels === ${life0 + 4}`, "lifetime total saved (lulu3dSave → f.play.dreidels)");

    // ── 🛹 a stunt ramp in her lane, with a sedan to leapfrog ──
    await t.hold(7, 0);
    await place(10, 1.75, 0);
    await t.frames(2);
    t.check("spawns a ramp", await G(`ctx.play.debug.spawnRamp(34, 1.75)`));
    const car2 = await G(`(() => { const c = ctx.traffic.add("sedan", 44 + 2.5 + 15, 1.75, 1, 0); c.want = 0; c.base = 0; return ctx.traffic.cars.length; })()`);
    t.check("a parked sedan past the ramp", car2 === 1);
    await place(10, 1.75, 27);
    await t.hold(7, 1);
    await t.frames(2);
    await t.shot("ramp-approach");
    if (!await t.until(`__lulu3d.ctx.play.jump.air`, "hits the ramp and takes off", 8000)) return;
    await t.frames(5);
    const y = await G(`ctx.car.model.position.y`);
    t.check("the car model lifts off (visual y > 0)", y > 1, y.toFixed(2));
    t.check("…while her physics stay on the road (root y = 0)", (await G(`ctx.car.obj.position.y`)) === 0);
    await t.shot("ramp-air");
    await t.stick(1);                                   // steer → spin
    await t.frames(10);
    t.check("steering mid-air spins the car", Math.abs(await G(`ctx.car.model.rotation.y`)) > 0.3, String(await G(`ctx.car.model.rotation.y`)));
    await t.shot("ramp-spin");
    if (!await t.until(`!__lulu3d.ctx.play.jump.air`, "lands", 8000)) return;
    await t.stick(0);
    const j = await G(`({ jumps: ctx.play.jump.jumps, air: ctx.play.jump.lastAir, spin: ctx.play.jump.lastSpin, clean: ctx.play.jump.lastClean, leaps: ctx.play.jump.leaps })`);
    t.check("a real jump (airtime > 0.8 s)", j.air > 0.8, JSON.stringify(j));
    t.check("🐸 LEAPFROG over the parked sedan", j.leaps >= 1 && await G(`!ctx.traffic.cars[0].hit`), JSON.stringify(j));
    t.check("spun in the air (a trick or a harmless wobble)", j.spin !== 0 || !j.clean, JSON.stringify(j));
    t.check("landing is harmless: still playing, 3 hearts", await G(`ctx.state === "playing" && ctx.G.hearts === 3`));
    await t.frames(4);
    await t.shot("ramp-landed");
    await t.frames(30);
    t.check("she keeps driving", await G(`ctx.car.speed > 5 && ctx.state === "playing"`), String(await G(`ctx.car.speed`)));
    t.check("the car model is back on the road", Math.abs(await G(`ctx.car.model.position.y`)) < 0.01 && Math.abs(await G(`ctx.car.model.rotation.y`)) < 0.05);
    t.check("jump stats saved", (await G(`ctx.play.save.jumps`)) >= 1 && (await G(`ctx.play.save.bestAir`)) > 0.8);
    // the same ramp again from "Lulu's eyes": the first-person camera rides the jump
    await t.hold(7, 0);
    await G(`(() => { ctx.traffic.clear(); while (ctx.cam.mode !== 2) ctx.cam.cycle(); })()`);
    await place(10, 1.75, 27);
    await t.hold(7, 1);
    if (await t.until(`__lulu3d.ctx.play.jump.air && __lulu3d.ctx.play.jump.y > 1.5`, "first-person: takes off again", 8000)) {
      t.check("Lulu's eyes rise with the car", (await G(`ctx.camera.position.y`)) > 2.9, String(await G(`ctx.camera.position.y`)));
      await t.shot("ramp-eyes");
    }
    await t.until(`!__lulu3d.ctx.play.jump.air`, "first-person: lands", 8000);
    await G(`(() => { while (ctx.cam.mode !== 0) ctx.cam.cycle(); })()`);
    await t.hold(7, 0);

    // ── 📸 photo mode from the pause menu ──
    await G(`ctx.traffic.clear()`);
    await place(120, 1.75, 0);
    await t.frames(20);
    await G(`ctx.play.debug.spawnDreidels(9, 5.25, 3, 4)`);
    // let the chase camera settle completely (it keeps easing while paused) so "exactly" is checkable
    await G(`(ctx.cam.snap(), ctx.camera.fov = 60, ctx.camera.updateProjectionMatrix())`);
    await t.frames(4);
    await t.tap(9);
    t.check("Start pauses", await G(`ctx.paused === true`));
    t.check("pause menu has 📸 Photo mode", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Photo mode/.test(b.textContent))`));
    const before = await G(`({ pos: ctx.camera.position.toArray(), q: ctx.camera.quaternion.toArray(), fov: ctx.camera.fov,
      car: [ctx.car.pos.x, ctx.car.pos.z, ctx.car.h], rt: ctx.G.runTime, score: ctx.G.score, cam: ctx.cam.state.pos.toArray() })`);
    await t.click(/Photo mode/);
    t.check("photo mode opens", await G(`ctx.state === "playPhoto" && ctx.paused === false`));
    t.check("driving HUD hidden, photo UI shown", await t.L(`document.getElementById("hud").classList.contains("hidden") && !document.getElementById("pp-root").classList.contains("hidden") && !!document.querySelector(".pp-bar .pp-btn.snap")`));
    await t.frames(16);
    await t.shot("photo-open");
    const c0 = await G(`ctx.camera.position.toArray()`);
    await t.stick(1, 0); await t.frames(16); await t.stick(0, 0); await t.frames(4);
    const c1 = await G(`ctx.camera.position.toArray()`);
    const moved = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
    t.check("the left stick orbits the camera", moved > 1, moved.toFixed(2) + " m");
    t.check("…around a frozen car", await G(`Math.abs(ctx.car.pos.x - ${before.car[0]}) < 1e-9 && Math.abs(ctx.car.pos.z - ${before.car[1]}) < 1e-9`));
    const d0 = await G(`ctx.play.photo.state.dist`);
    await t.hold(7, 1); await t.frames(10); await t.hold(7, 0); await t.frames(3);
    t.check("R2 zooms in", (await G(`ctx.play.photo.state.dist`)) < d0 - 0.5);
    await t.L(`(__pad.axes[3] = -1)`); await t.frames(10); await t.L(`(__pad.axes[3] = 0)`); await t.frames(2);
    t.check("the right stick raises the camera", (await G(`ctx.play.photo.state.rise`)) > 0.3);

    // filters (R1), frames (□), poses (△)
    await t.tap(5);
    t.check("R1 → Golden Hour filter on the canvas", await t.L(`/sepia/.test(document.getElementById("scene").style.filter)`) && await G(`ctx.play.photo.state.filter === 1`));
    await t.tap(2);
    t.check("□ → the postcard frame", await G(`ctx.play.photo.state.frame === 1`));
    await t.tap(3);
    t.check("△ → Lulu waves (a posable arm on the car)", await G(`!!ctx.car.model.getObjectByName("playPose")`));
    await t.frames(10);
    await t.shot("photo-postcard-golden-wave");

    // save the photo (✕)
    const album0 = await G(`ctx.play.save.album.length`);
    await t.tap(0);
    const shot = await G(`(ctx.play.photo.state.lastPhoto || "").slice(0, 22) + "|" + (ctx.play.photo.state.lastPhoto || "").length`);
    t.check("✕ saves a PNG (data URL)", /^data:image\/png;base64/.test(shot) && +shot.split("|")[1] > 20000, shot);
    t.check("…downloaded", (await G(`ctx.play.photo.state.downloads`)) >= 1);
    t.check("…and added to the album", (await G(`ctx.play.save.album.length`)) === Math.min(6, album0 + 1) && /^data:image\/jpeg/.test(await G(`ctx.play.save.album[0].img.slice(0, 15)`)));
    const thumbKB = (await G(`ctx.play.save.album[0].img.length`)) / 1024;
    t.check("album thumbnail stays small", thumbKB < 30, thumbKB.toFixed(1) + " KB");
    await t.until(`(${save3}).f.play.album.length >= 1`, "album persisted in lulu3dSave");

    // more looks for the screenshots
    const P = `ctx.play.photo`;
    for (const [f, fr, pose, label] of [["vintage", "hearts", "peace", "vintage-hearts"], ["noir", "polaroid", "shades", "noir-polaroid"],
      ["pop", "stickers", "hands", "pop-stickers"], ["pink", "wanted", "wave", "pink-wanted"]]) {
      const got = await G(`[${P}.setFilter("${f}"), ${P}.setFrame("${fr}"), ${P}.setPose("${pose}")].join(",")`);
      t.check(`look: ${f} + ${fr} + ${pose}`, got === `${f},${fr},${pose}`, got);
      await t.frames(8);
      await t.shot("photo-" + label);
    }
    // album (OPTIONS) → card with the thumbnail, ○ back
    await t.tap(9);
    t.check("OPTIONS opens the album", await t.L(`document.querySelectorAll("#screenCard .pp-th").length >= 1`));
    await t.shot("photo-album");
    await t.tap(1);
    t.check("○ closes the album (still in photo mode)", await G(`ctx.state === "playPhoto"`) && !(await t.L(`!document.getElementById("screen").classList.contains("hidden")`)));

    // close-ups for the screenshots: each pose from the front, a dreidel, the ramp, a clean (UI hidden) frame
    const aim = (code, label, n = 8) => G(`(() => { const s = ctx.play.photo.state; s.t = 2; s.roll = 0; ${code} })()`).then(() => t.frames(n)).then(() => t.shot(label));
    await G(`(${P}.setFilter("natural"), ${P}.setFrame("none"))`);
    for (const p of ["wave", "peace", "shades", "hands"]) {
      await G(`${P}.setPose("${p}")`);
      await aim(`s.yaw = ctx.car.h + 0.62; s.pitch = 0.16; s.dist = 3.6; s.rise = 0.45; s.target.set(ctx.car.pos.x, 0.85, ctx.car.pos.z);`, "pose-" + p);
    }
    const pd = await G(`ctx.play.debug.pose()`);
    t.check("hands-up: both baked arms hidden (shirt + hands), two posable arms", pd && pd.id === "hands" && pd.arms.length === 2 &&
      pd.swaps.some(s => /Shirt/.test(s.mat) && s.removed > 0) && pd.swaps.some(s => s.mat === "Skin" && s.removed > 0), JSON.stringify(pd));
    await aim(`const d = ctx.play.debug.dreidels.find(x => !x.taken && x.k !== -2 && Math.abs(x.s - ctx.car.s) < 30) || ctx.play.debug.dreidels[0];
      s.target.set(d.x, d.y + 0.6, d.z); s.yaw = ctx.car.h + 2.6; s.pitch = 0.12; s.dist = 2.6; s.rise = 0;`, "closeup-dreidel", 10);
    await G(`ctx.play.debug.spawnRamp(30, 1.75)`);
    await aim(`const r = ctx.play.debug.ramps[ctx.play.debug.ramps.length - 1].obj;
      s.target.set(r.position.x, 0.6, r.position.z); s.yaw = r.rotation.y + Math.PI + 0.75; s.pitch = 0.32; s.dist = 9; s.rise = 0;`, "closeup-ramp", 10);
    t.check("a parked truck spot on the shoulder", await G(`ctx.play.debug.spawnTruck(48)`));
    await aim(`const p = ctx.world.road.point(ctx.car.s + 48, 8.75, {});
      s.target.set(p.x, 1.2, p.z); s.yaw = p.h + 0.55; s.pitch = 0.2; s.dist = 13; s.rise = 0;`, "closeup-truck", 10);
    await G(`(() => { const s = ctx.play.photo.state; s.target.set(ctx.car.pos.x, 0.85, ctx.car.pos.z); s.yaw = ctx.car.h + Math.PI + 0.5; s.pitch = 0.3; s.dist = 7; s.rise = 0; ${P}.setFrame("postcard"); })()`);
    await t.tap(13);
    t.check("D-pad ↓ hides the photo UI", await t.L(`document.getElementById("pp-ui").classList.contains("off")`));
    await t.frames(6);
    await t.shot("photo-clean-postcard");
    await t.tap(1);
    t.check("○ with the UI hidden just brings the UI back", await G(`ctx.state === "playPhoto"`) && !(await t.L(`document.getElementById("pp-ui").classList.contains("off")`)));
    await t.page.setViewportSize({ width: 390, height: 844 }); await t.frames(10);
    await t.shot("photo-phone");
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.L(`document.body.classList.add("tv")`); await t.frames(8);
    await t.shot("photo-tv");
    await t.L(`document.body.classList.remove("tv")`); await t.frames(4);

    // ○ → back to the paused run, exactly
    await t.tap(1);
    t.check("○ leaves photo mode → back in the paused run", await G(`ctx.state === "playing" && ctx.paused === true`));
    t.check("the pause menu is back", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Resume/.test(b.textContent))`));
    const after = await G(`({ pos: ctx.camera.position.toArray(), q: ctx.camera.quaternion.toArray(), fov: ctx.camera.fov,
      car: [ctx.car.pos.x, ctx.car.pos.z, ctx.car.h], rt: ctx.G.runTime, score: ctx.G.score, cam: ctx.cam.state.pos.toArray() })`);
    const same = (a, b, e = 1e-6) => a.every((v, i) => Math.abs(v - b[i]) < e);
    t.check("camera restored exactly", same(after.pos, before.pos) && same(after.q, before.q) && Math.abs(after.fov - before.fov) < 1e-6 && same(after.cam, before.cam),
      JSON.stringify([after.pos, before.pos]));
    t.check("car, run clock and score untouched", same(after.car, before.car) && after.rt === before.rt && after.score === before.score);
    t.check("no pose left on the car, no filter on the canvas", await G(`!ctx.car.model.getObjectByName("playPose") && !document.getElementById("scene").style.filter`));
    t.check("HUD is back", await t.L(`!document.getElementById("hud").classList.contains("hidden") && document.getElementById("pp-root").classList.contains("hidden")`));
    t.check("the download event fired", downloads >= 1, String(downloads));
    await t.shot("photo-back-to-pause");
    await t.tap(1);
    t.check("○ resumes the drive", await G(`ctx.paused === false && ctx.state === "playing"`));
    await t.hold(7, 0.6); await t.frames(10); await t.hold(7, 0);
    t.check("…and the run clock ticks again", (await G(`ctx.G.runTime`)) > before.rt);

    // ── the planner scatters dreidels / ramps / trucks down the road ──
    await place(1900, 1.75, 0);
    await t.frames(40);
    const planned = await G(`({ dreidels: ctx.play.debug.dreidels.filter(d => d.k >= 0).length, ramps: ctx.play.debug.ramps.filter(r => r.k >= 0).length })`);
    t.check("random spots: golden dreidels down the road", planned.dreidels > 0, JSON.stringify(planned));

    // ── photo mode on foot: Lulu poses with the people.js gestures, and the walk resumes ──
    if (await G(`!!(ctx.foot && ctx.foot.start)`)) {
      await G(`ctx.foot.start("droveOff")`);
      if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot (walking)", 60000)) {
        const fp0 = await G(`ctx.foot.obj.position.toArray()`);
        t.check("photo mode opens on foot", await G(`ctx.play.openPhoto("debug") && ctx.state === "playPhoto"`));
        t.check("…with on-foot poses", await G(`ctx.play.photo.state.poseKind === "foot" && ctx.play.photo.setPose("dance") === "dance"`));
        await G(`(() => { const s = ctx.play.photo.state, o = ctx.foot.obj; s.t = 2; s.yaw = o.rotation.y + 0.4; s.pitch = 0.15; s.dist = 3.4; s.rise = 0; })()`);
        await t.frames(12);
        await t.shot("photo-foot-dance");
        await t.tap(1);
        t.check("○ goes straight back to the walk", await G(`ctx.state === "footRun" && ctx.foot.phase === "walk" && !ctx.paused`));
        t.check("…exactly where she stood", await G(`ctx.foot.obj.position.toArray()`).then(p => p.every((v, i) => Math.abs(v - fp0[i]) < 1e-9)));
        await t.stick(0, -1); await t.frames(15); await t.stick(0, 0);
        const fp1 = await G(`ctx.foot.obj.position.toArray()`);
        t.check("…and she can keep walking", Math.hypot(fp1[0] - fp0[0], fp1[2] - fp0[2]) > 0.5);
      }
    }
  },
};
