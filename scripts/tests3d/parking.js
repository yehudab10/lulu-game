// Parking minigame: unlock the 🅿️ Parking Challenge with shared coins, drive
// the lot car with the fake controller (speed governor, cameras tracking),
// park a level for ⭐⭐⭐ (coins + shared save fields), fail one by ramming a
// parked car (lives, the angry grandpa), finish the challenge end screen — then
// the in-drive pull-over: crawl in the outer lane, ✕ to pull over, park, and
// get back on the road (no foot feature in this test → returns to driving).
const S = `__lulu3d.ctx.parking._debug`;
module.exports = {
  name: "parking",
  save2d: { totalCoins: 1500, ownedSkins: ["pink", "purple"], selectedSkin: "purple" },
  async run(t) {
    await t.frames(10);
    const lab = await t.L(`[...document.querySelectorAll("#screenCard .btn")].map(b => b.textContent).find(s => /Parking Challenge/.test(s)) || ""`);
    t.check("title lists 🅿️ Parking Challenge, locked at 1,000", /🔒/.test(lab) && /1,000/.test(lab), lab);

    // ── unlock with the shared wallet ──
    await t.click(/Parking Challenge/);
    t.check("unlock screen offers the 1,000-coin unlock", await t.L(`/Unlock/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("unlock");
    await t.click(/Unlock/);
    await t.frames(4);
    const s2 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2"))`);
    t.check("unlock spends 1,000 shared coins + sets parkingUnlocked", s2.parkingUnlocked === true && s2.totalCoins === 500, `coins ${s2.totalCoins}`);
    await t.click(/Start Level 1/);
    if (!await t.until(`__lulu3d.state === "parking" && ${S}.phase === "drive"`, "challenge level 1 starts")) return;
    t.check("challenge level 1 starts", true);
    t.check("lot car wears the shared skin", await t.game(`${S}.lot.car.skinKey`) === "purple");
    await t.shot("level1");

    // ── drive with the controller: RT forward, stick steers, the lot governor caps speed ──
    const x0 = await t.game(`${S}.lot.car.pos.x`);
    await t.hold(7, 1); await t.stick(-0.4);
    await t.frames(25);
    const sp = await t.game(`${S}.lot.car.speed`);
    await t.hold(7, 0); await t.stick(0);
    const x1 = await t.game(`${S}.lot.car.pos.x`);
    t.check("RT drives the lot car (left, toward the bay)", x0 - x1 > 1.5, `${(x0 - x1).toFixed(2)} m`);
    t.check("lot speed governor (≤ 4.5 m/s)", sp <= 4.5 && sp > 1, `${sp.toFixed(2)} m/s`);
    const camYaw = await t.game(`${S}.L.cams.map(c => c.yaw.toFixed(2)).join(",")`);
    t.check("security cameras track the car", camYaw.length > 0, camYaw);
    await t.shot("driving");
    // triangle cycles the lot camera
    await t.tap(3); await t.frames(10);
    await t.shot("chasecam");
    await t.tap(3); await t.tap(3);

    // ── a perfect park: slot her into the bay, lined up, stopped ──
    const w0 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
    await t.game(`(() => { const s = ${S}, L = s.L, c = s.lot.car; c.place((L.zx0 + L.zx1) / 2, (Math.max(L.curbZ, L.zz0) + L.zz1) / 2, Math.PI / 2); })()`);
    if (!await t.until(`${S}.phase === "result"`, "holding still in the bay parks")) return;
    t.check("holding still in the bay parks", await t.game(`${S}.result`) === "success");
    t.check("untouched park = ⭐⭐⭐", await t.game(`${S}.stars`) === 3);
    await t.frames(30);
    await t.shot("parked");
    const w1 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2")).totalCoins`);
    t.check("level 1 pays 1×25 + 3×15 = 70 coins to the shared wallet", w1 - w0 === 70, `${w0} → ${w1}`);
    const s3 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2"))`);
    t.check("shared save: best level 1, +3 total stars, a perfect park",
      s3.parkingBestLevel === 1 && s3.parkingTotalStars === 3 && s3.parkingPerfectRuns === 1, JSON.stringify([s3.parkingBestLevel, s3.parkingTotalStars, s3.parkingPerfectRuns]));
    await t.tap(0);   // ✕ skips the result
    if (!await t.until(`${S}.level === 2 && ${S}.phase === "drive"`, "on to level 2")) return;
    t.check("✕ skips to level 2 (kids ride along with ice cream)", await t.game(`${S}.kidsInCar === true`));

    // ── a fail: ram a parked car ──
    await t.game(`(() => { const s = ${S}, p = s.L.parked[0], c = s.lot.car; c.place(p.obj.position.x + 5.2, p.obj.position.z, -Math.PI / 2); c.vx = -4.2; })()`);
    if (!await t.until(`${S}.phase === "result"`, "ramming a parked car fails")) return;
    t.check("ramming a parked car = CRASH!", await t.game(`${S}.result === "fail" && ${S}.failHit.who === "parked"`));
    t.check("a challenge fail costs a life", await t.game(`${S}.lives`) === 2);
    await t.frames(45);
    await t.shot("crash");
    t.check("the angry grandpa storms over", await t.game(`!!${S}.angry`));
    await t.tap(0);
    if (!await t.until(`${S}.level === 2 && ${S}.phase === "drive"`, "retry the same level")) return;
    t.check("retry the same level", true);

    // ── run out of lives → the end screen ──
    await t.game(`${S}.lives = 1`);
    await t.game(`${S}.timeLeft = 0.2`);
    if (!await t.until(`${S}.phase === "result"`, "the clock runs out")) return;
    t.check("out of time = fail", await t.game(`${S}.failHit.who`) === "timeout");
    await t.tap(0);
    if (!await t.until(`__lulu3d.state === "parkingEnd"`, "challenge end screen")) return;
    t.check("PARKING OVER screen", await t.L(`/PARKING OVER/.test(document.querySelector("#screenCard").textContent) && /Level 2/.test(document.querySelector("#screenCard").textContent)`));
    await t.shot("end");
    await t.click(/Title screen/);
    await t.until(`__lulu3d.state === "title"`, "back to title");
    t.check("lot set released on the title", await t.game(`ctx.view === null && !${S}.active`));

    // ── the pull-over from a real drive ──
    await t.game(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.game(`(() => { ctx.traffic.clear(); ctx.traffic.config.enabled = false; const r = ctx.world.road, p = r.point(300, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = 300; ctx.car.vx = Math.sin(p.h) * 7; ctx.car.vz = Math.cos(p.h) * 7; })()`);
    await t.hold(6, 0.35);
    await t.frames(60);
    t.check("crawling in the outer lane offers 🅿️ Pull over", await t.L(`/Pull over/.test((document.getElementById("slot-bottom") || {}).textContent || "")`));
    await t.shot("pullover-prompt");
    await t.hold(6, 0);
    const c0 = await t.game(`ctx.G.coins`), sc0 = await t.game(`ctx.G.score`);
    await t.tap(0);
    await t.frames(6);
    t.check("a quick ✕ tap doesn't hijack (pull-over is a hold)", await t.game(`ctx.state === "playing" && !ctx.parking._debug.active`));
    await t.hold(0, 1);
    await t.frames(24);
    await t.hold(0, 0);
    if (!await t.until(`__lulu3d.state === "parking"`, "holding ✕ pulls over into the lot")) return;
    t.check("holding ✕ pulls over into the lot", await t.game(`${S}.from === "pullover" && !${S}.challenge`));
    if (!await t.until(`${S}.phase === "drive"`, "the roadside lot is ready")) return;
    await t.shot("roadside-lot");
    const nParked = await t.game(`${S}.L.parked.length`);
    t.check("roadside lot: 2–4 parked cars", nParked >= 2 && nParked <= 4, `${nParked}`);
    // a 1-star park (dinged gently first)
    await t.game(`${S}.touched = true; ${S}.perfect = false`);
    await t.game(`(() => { const s = ${S}, L = s.L, c = s.lot.car; c.place((L.zx0 + L.zx1) / 2, (Math.max(L.curbZ, L.zz0) + L.zz1) / 2, -Math.PI / 2); })()`);
    if (!await t.until(`${S}.phase === "result"`, "pull-over park")) return;
    t.check("pull-over park: ⭐ (touched a car)", await t.game(`${S}.stars`) === 1);
    const hasFoot = await t.game(`!!(ctx.foot && ctx.foot.start)`);
    await t.tap(0);
    if (hasFoot) {
      // with the foot feature: Lulu climbs out, walks a few steps, then ctx.foot takes over
      if (!await t.until(`${S}.phase === "walkout"`, "Lulu climbs out of the parked car")) return;
      await t.frames(16);
      await t.shot("walkout");
      if (!await t.until(`__lulu3d.ctx.foot.active || __lulu3d.state !== "parking"`, "hands off to Lulu on foot (droveOff)")) return;
      t.check("hands off to Lulu on foot (droveOff)", true);
    } else if (!await t.until(`__lulu3d.state === "playing"`, "back on the road (no foot feature here)")) return;
    const c1 = await t.game(`ctx.G.coins`), sc1 = await t.game(`ctx.G.score`);
    t.check("pull-over pays 50 + 15 = 65 coins and +500 score", c1 - c0 === 65 && sc1 - sc0 >= 500, `+${c1 - c0} coins, +${Math.round(sc1 - sc0)} score`);
    await t.frames(10);
    await t.shot("after-pullover");

    // ── layouts: phone portrait (touch) + TV mode ──
    await t.page.setViewportSize({ width: 390, height: 844 });
    await t.game(`L3.setState("title")`);
    await t.frames(3);
    await t.click(/Parking Challenge/);
    if (!await t.until(`__lulu3d.state === "parking" && ${S}.phase === "drive"`, "portrait challenge")) return;
    await t.L(`(__lulu3d.input.device = "touch", document.body.classList.add("touch"), document.getElementById("touch").classList.remove("hidden"))`);
    await t.frames(12);
    await t.shot("portrait");
    t.check("portrait: HUD bar fits the screen", await t.L(`(() => { const r = document.querySelector("#parkHud .ph-bar").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; })()`));
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.game(`(document.body.classList.add("tv"), __lulu3d.input.device = "gamepad", document.body.classList.remove("touch"), document.getElementById("touch").classList.add("hidden"))`);
    await t.frames(12);
    await t.shot("tv");
  },
};
