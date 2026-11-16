// Side hustles (features/hustle): GTA-style side jobs + the car radio.
//  • the 💼 Side Jobs log in the 📒 Scrapbook group
//  • 📻 radio: keyboard T / pad View·Create / touch chip / pause item cycle LULU FM → SIMCHA →
//    SMOOTH → KVETCH → off → LULU FM; the music follows; static; the ticker sits top-right
//    (off the road); Chatter: Quiet spaces it out; Clean hides it; the station survives a reload
//  • 🚕 Lulu Cab: three fares board / pay / chain (pass card), tips for near misses + air
//  • 🔥 Hot Delivery: the spill meter (crash / pothole / jump), a review; a cold one fails
//  • 💰 The Getaway: the heist cutscene (⏭ skipped), ★★★ via ctx.law, lose them, the safehouse
//  • a mission marker (payphone) you drive into; quitting from the pause menu
//  • layouts: desktop, TV 1080 / 720, phone landscape + portrait (touch)
const STATIONS = ["auto", "simcha", "lounge", "talk", "off"];

module.exports = {
  name: "hustle",
  query: "&enable=hustle",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 500, cruiseUnlocked: true, cruisePlayed: true },
  save3d: { best: 1000, settings: { quality: "low", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "off", hud: 1, hudMode: "full", chatter: "normal" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const audioSrc = () => t.L(`import("./js/audio.js").then(m => m.musicSrc())`);
    const st = () => g(`ctx.hustle.radio.station`);
    const job = () => g(`ctx.hustle.job ? { id: ctx.hustle.job.id, phase: ctx.hustle.job.phase } : null`);
    // put the car at (s, d), heading down the road at v m/s
    const tp = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {});
      ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d};
      ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.cam.snap(); return true; })()`);
    // pull up 2.5 m short of road distance `sExpr` (a job's pickup / drop-off), on the right edge, stopped
    const tpTo = (sExpr, d = 7.2) => g(`(() => { const r = ctx.world.road, s = (${sExpr}) - 2.5, p = r.point(s, ${d}, {});
      ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = ${d}; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
    const coins = () => g(`ctx.G.coins`);
    const statLog = id => g(`ctx.law._dbg.log.filter(e => e.ev === "stat" && e.id === ${JSON.stringify(id)}).length`);
    const rectOf = sel => t.L(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; })()`);
    /** Off the road: top band (above the horizon) or the side columns — never the centre of the lower screen. */
    const offRoad = r => !!r && (r.b < r.h * 0.42 || r.x > r.w * 0.62 || r.r < r.w * 0.38);

    t.check("ctx.hustle service is up", await g(`!!ctx.hustle && typeof ctx.hustle.start === "function" && !!ctx.hustle.radio`));
    t.check("radio defaults to LULU FM (the game's own music)", await st() === "auto");

    // ── 💼 the Side Jobs log lives in the 📒 Scrapbook group (no home tile) ──
    const labels = await g(`L3.titleLabels()`);
    const jl = labels.find(i => i.id === "hustleJobs");
    t.check("💼 Side Jobs is a Scrapbook-group item, not a home tile", !!jl && jl.group === "book", JSON.stringify(jl));
    await t.click(/Side Jobs/);
    t.check("…and opens the jobs log", await t.L(`!!document.querySelector("#screenCard .hs-log")`));
    await t.shot("log");
    await t.tap(1);
    t.check("○ comes back to the Scrapbook group", await g(`L3.titleView`) === "book");

    // ── drive ────────────────────────────────────────────────────────────────
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    // no traffic, no random offers; NOT a huge invT: invincibility makes the car blink in the screenshots
    await g(`(ctx.hustle.hold(1e6), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.G.invT = 0, ctx.G.hearts = 3, true)`);
    await t.frames(10);
    const gameSrc = await audioSrc();
    t.check("Cruise plays its own track on LULU FM", /luludriving/.test(gameSrc || ""), gameSrc);

    // ── 📻 the radio ────────────────────────────────────────────────────────
    await t.key("KeyT");
    await t.frames(3);
    t.check("keyboard T → SIMCHA 101.3", await st() === "simcha");
    t.check("…the music switches to a simcha track", /wedding|story-electric|luludriving/.test(await audioSrc() || ""), await audioSrc());
    let tk = await rectOf(".hs-radio");
    t.check("…the radio ticker pops up", !!tk);
    t.check("…top-right, off the road", offRoad(tk), JSON.stringify(tk));
    t.check("…small (not a banner)", !!tk && (tk.r - tk.x) < tk.w * 0.36 && (tk.b - tk.y) < 90, JSON.stringify(tk));
    await t.shot("radio-simcha");
    await t.tap(8);                                     // pad View / Create
    t.check("pad View/Create → SMOOTH 88.8", await st() === "lounge");
    t.check("…a lounge track", /story-relax|story-beach|salon|avigail/.test(await audioSrc() || ""), await audioSrc());
    t.check("…and the camera did NOT change (View isn't a 2nd camera button any more)", await g(`ctx.cam.mode`) === 0);
    await t.tap(8);
    t.check("→ KVETCH 1450 AM", await st() === "talk");
    t.check("…talk radio sits on a quiet bed", await t.L(`import("./js/audio.js").then(m => m.musicSrc())`) === "../lulu.mp3");
    t.check("a call-in plays on the ticker", await g(`ctx.hustle.radio.debugSay("talk")`));
    await t.frames(2);
    t.check("…with the caller's line", await t.L(`/DR\\. FEH|CALLER/.test(document.querySelector(".hs-radio .tx").textContent)`));
    tk = await rectOf(".hs-radio");
    t.check("…still off the road", offRoad(tk), JSON.stringify(tk));
    await t.shot("radio-talk");
    t.check("an ad reads as an AD", await g(`ctx.hustle.radio.debugSay("ad")`) && await t.L(`/^\\s*AD\\b/.test(document.querySelector(".hs-radio .tx").textContent)`));
    await t.tap(8);
    t.check("→ RADIO OFF: no music", await st() === "off" && await audioSrc() === null);
    await t.tap(8);
    t.check("→ back to LULU FM: the game's own track again", await st() === "auto" && /luludriving/.test(await audioSrc() || ""), await audioSrc());
    t.check("the station is in the 3D save", await t.L(`import("./js/core/save.js").then(m => m.save3d.f.hustle.station)`) === "auto");
    // the pause-menu item
    await t.tap(9);
    t.check("pause: a 📻 radio item in the tools grid", await t.L(`!!document.querySelector(".pm-tools #hustleRadio")`));
    await t.L(`document.querySelector("#hustleRadio").click()`);
    await t.frames(2);
    t.check("…it tunes the next station and relabels in place", await st() === "simcha" && await t.L(`/SIMCHA/.test(document.querySelector("#hustleRadio").textContent)`));
    let f = await t.L(`(() => { const c = document.getElementById("screenCard"); return c.scrollHeight <= c.clientHeight + 2; })()`);
    t.check("pause still fits 720p", f);
    await t.shot("pause");
    await t.tap(1);
    // Lulu's chatter: Quiet spaces the DJ talk / ads out
    const gapAfter = async mode => {
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.chatter = "${mode}"; })`);
      await g(`(ctx.hustle.radio.debugMsgT(0), true)`);
      await t.until(`__lulu3d.ctx.hustle.radio.state().msgT > 5`, `next radio message scheduled (${mode})`, 60000);
      return g(`ctx.hustle.radio.state().msgT`);
    };
    const quietGap = await gapAfter("quiet"), normalGap = await gapAfter("normal");
    t.check("Chatter: Quiet → much longer gaps between DJ talk / ads", quietGap >= 36 && normalGap <= 27, `quiet ${quietGap}s · normal ${normalGap}s`);
    // HUD style: Clean hides the ticker (it's .hud-secondary)
    await g(`ctx.hustle.radio.debugSay("dj")`);
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.hudMode = "clean"; })`);
    await g(`(ctx.applySettings(), true)`);
    t.check("HUD: Clean hides the ticker", await t.L(`getComputedStyle(document.querySelector(".hs-radio")).display === "none"`));
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.hudMode = "full"; })`);
    await g(`(ctx.applySettings(), true)`);

    // ── 🚕 LULU CAB: a full shift (pass) ────────────────────────────────────
    await tp(400, 1.75, 0);
    await g(`ctx.hustle.start("cab", { fares: ["groom", "influencer", "chicken"] })`);
    t.check("a cab shift starts", (await job() || {}).id === "cab");
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.cur && __lulu3d.ctx.hustle.job.cur.ready`, "the first fare is waiting on the shoulder", 60000);
    await t.frames(4);
    t.check("job HUD: the objective line", await t.L(`/Pick up Mendel/.test(document.querySelector(".hs-obj").textContent)`));
    t.check("job HUD: a distance chip", await t.L(`/\\d+ m/.test(document.querySelector(".hs-dist").textContent)`));
    t.check("a beacon marks the fare", await g(`ctx.hustle._dbg.beacons.target.on`));
    t.check("(chase camera, Lulu's car on screen)", await g(`ctx.cam.mode === 0 && ctx.car.obj.visible`), JSON.stringify(await g(`({ mode: ctx.cam.mode, vis: ctx.car.obj.visible })`)));
    const hudR = await rectOf(".hs-job");
    t.check("the job HUD sits under the trip bar, off the road", offRoad(hudR), JSON.stringify(hudR));
    await t.shot("cab-pickup-beacon");
    const c0 = await coins();
    for (let k = 0; k < 3; k++) {
      const name = await g(`ctx.hustle.job.cur.fare.name`);
      await tpTo(`ctx.hustle.job.cur.s`);
      await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "ride"`, `fare ${k + 1} (${name}) hops in`, 60000);
      t.check(`fare ${k + 1}: ${name} is in the passenger seat`, await g(`ctx.roadevents ? ctx.roadevents.passengers >= 1 : true`));
      if (k === 0) {
        await t.frames(12);
        await t.shot("cab-ride");
        t.check("riding: the meter (⏱) is running", await t.L(`/⏱/.test(document.querySelector(".hs-obj .tm").textContent)`));
      }
      if (k === 1) {      // the influencer: near misses + air = CONTENT
        const tip0 = await g(`ctx.hustle.job.cur.tip`);
        await g(`(L3.emit("closeCall", { oncoming: true, combo: 1 }), ctx.play && (ctx.play.jump.jumps++, ctx.play.jump.lastAir = 1), true)`);
        await t.frames(3);
        t.check("influencer: a near miss + a jump raise the tip", await g(`ctx.hustle.job.cur.tip`) > tip0 + 10, `${tip0} → ${await g(`ctx.hustle.job.cur.tip`)}`);
        await t.shot("cab-influencer");
      }
      await tpTo(`ctx.hustle.job.cur.dropS`);
      await t.until(`!__lulu3d.ctx.hustle.job || __lulu3d.ctx.hustle.job.i > ${k} || __lulu3d.state === "hustleResult"`, `fare ${k + 1} dropped off`, 60000);
      await t.frames(3);
    }
    await t.until(`__lulu3d.state === "hustleResult"`, "shift over → the result card", 60000);
    t.check("PASS card: JOB DONE + payout rows + a funny line", await t.L(`/JOB DONE/.test(document.querySelector(".hs-res .top").textContent) && !!document.querySelector(".hs-res .row.tot") && !!document.querySelector(".hs-res .quote")`));
    t.check("the fares were paid (coins up)", await coins() > c0 + 60, `${c0} → ${await coins()}`);
    t.check("stats: hustleFares ×3, hustleJobs", await statLog("hustleFares") === 3 && await statLog("hustleJobs") === 1);
    await t.shot("cab-pass");
    await t.tap(0);
    t.check("✕ keeps driving", await g(`ctx.state === "playing" && !ctx.hustle.job`));

    // ── 🔥 HOT DELIVERY: spills, a review (pass) ────────────────────────────
    await t.frames(10);
    await g(`ctx.hustle.start("delivery", { food: "cholent", dist: 600 })`);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.dish && __lulu3d.ctx.hustle.job.customer`, "the cholent is on the seat, the customer waits", 60000);
    await t.frames(20);
    t.check("delivery HUD: 🔥 + 💦 meters", await t.L(`!!document.querySelector(".hs-m.heat") && !!document.querySelector(".hs-m.spill")`));
    const sp0 = await g(`ctx.hustle.job.spill`);
    await g(`(L3.emit("crash", { impact: 9, kind: "test" }), true)`);
    const sp1 = await g(`ctx.hustle.job.spill`);
    await g(`(L3.emit("stat", { id: "potholes", n: 1 }), true)`);
    const sp2 = await g(`ctx.hustle.job.spill`);
    await g(`(ctx.play && (ctx.play.jump.jumps++, ctx.play.jump.lastAir = 0.8), true)`);
    await t.frames(3);
    const sp3 = await g(`ctx.hustle.job.spill`);
    t.check("spill: a hard bump spills some", sp1 > sp0 + 0.1, `${sp0} → ${sp1}`);
    t.check("spill: a pothole spills more", sp2 > sp1 + 0.08, `${sp1} → ${sp2}`);
    t.check("spill: a jump landing spills more", sp3 > sp2 + 0.05, `${sp2} → ${sp3}`);
    await t.shot("delivery-spill");
    await tpTo(`ctx.hustle.job.dropS`);
    await t.until(`__lulu3d.state === "hustleResult"`, "delivered → the card", 60000);
    const stars = await t.L(`(document.querySelector(".hs-res .stars") || {}).textContent || ""`);
    t.check("delivery PASS with a review (spilled → fewer than 5 ★)", /JOB DONE/.test(await t.L(`document.querySelector(".hs-res .top").textContent`)) && (stars.match(/★/g) || []).length < 5 && (stars.match(/★/g) || []).length >= 1, stars);
    await t.shot("delivery-pass");
    await t.tap(0);

    // ── 🔥 a cold one (FAIL) ────────────────────────────────────────────────
    await t.frames(6);
    await g(`ctx.hustle.start("delivery", { food: "kugel", dist: 900 })`);
    await t.frames(4);
    await g(`(ctx.hustle.job.T = 0.2, true)`);
    await t.until(`__lulu3d.state === "hustleResult"`, "it went cold → the card", 60000);
    t.check("FAIL card: JOB FAILED + why + a funny line", await t.L(`/JOB FAILED/.test(document.querySelector(".hs-res .top").textContent) && /cold/i.test(document.querySelector(".hs-res").textContent) && !!document.querySelector(".hs-res .quote")`));
    t.check("…offers a retry", await t.L(`!!document.getElementById("hsAgain")`));
    await t.shot("delivery-fail");
    await t.tap(0);

    // ── 💰 THE GETAWAY ──────────────────────────────────────────────────────
    await t.frames(6);
    const w0 = await coins();
    await g(`ctx.hustle.start("getaway")`);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.ready && __lulu3d.ctx.hustle.job.hall`, "the bingo hall is up the road", 60000);
    await t.frames(4);
    t.check("objective: drive to the bingo hall", await t.L(`/BINGO HALL/.test(document.querySelector(".hs-obj").textContent)`));
    await tpTo(`ctx.hustle.job.hallS`);
    await g(`(ctx.car.vx *= 0, ctx.car.vz *= 0, true)`);
    await t.until(`__lulu3d.state === "hustleHeist"`, "pull up → the heist-exit cutscene", 60000);
    await t.frames(30);
    await t.shot("heist-cutscene");
    t.check("the cutscene has the ⏭ skip pill", await t.L(`document.getElementById("skipBtn").classList.contains("show")`));
    await t.L(`document.getElementById("skipBtn").click()`);
    await t.until(`__lulu3d.state === "playing"`, "skipping lands back in the car", 120000);
    await g(`(ctx.roadevents.autopilot = { d: 1.75, speed: 30 }, ctx.G.invT = 1e9, true)`);     // keep moving (a parked getaway car gets BUSTED), no cruiser rams
    t.check("skipped: the whole crew is in the car", await g(`ctx.hustle.job.crew.length === 3 && ctx.hustle.job.crew.every(m => m.seated)`));
    t.check("skipped: ★★★ — ctx.law.wanted jumps to 3", await g(`ctx.law.chasing && ctx.law.wanted >= 3`), String(await g(`ctx.law.wanted`)));
    t.check("objective: lose the cops", await g(`ctx.hustle.job.phase === "escape"`));
    await t.frames(30);
    await g(`(ctx.G.invT = 0, true)`);
    await t.frames(1);
    await t.shot("getaway-chase");
    await g(`(ctx.G.invT = 1e9, true)`);
    const lost0 = await g(`ctx.hustle.job.lost`);
    await g(`(L3.emit("crash", { impact: 12, kind: "test" }), true)`);
    t.check("a hard crash knocks a money bag out", await g(`ctx.hustle.job.lost`) === lost0 + 1);
    await g(`(ctx.law.clearHeat("test"), ctx.G.invT = 0, true)`);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "toSafe" && __lulu3d.ctx.hustle.job.safeAt`, "lost them → head for the safehouse", 60000);
    await t.frames(20);
    await g(`(ctx.roadevents.autopilot = null, true)`);
    await tpTo(`ctx.hustle.job.safeS`);
    await t.until(`__lulu3d.state === "hustleResult"`, "the safehouse → split the cash", 60000);
    t.check("getaway PASS: your cut, minus the lost bag", await t.L(`/JOB DONE/.test(document.querySelector(".hs-res .top").textContent) && /Bags lost/.test(document.querySelector(".hs-res").textContent)`));
    t.check("…coins up", await coins() > w0 + 100, `${w0} → ${await coins()}`);
    t.check("…stat: hustleHeists", await statLog("hustleHeists") === 1);
    t.check("getaway has no 'another one' button (the heat!)", await t.L(`!document.getElementById("hsAgain")`));
    await t.shot("getaway-pass");
    await t.tap(0);

    // ── a payphone marker you drive into ────────────────────────────────────
    await t.frames(10);
    await g(`ctx.hustle.offer("cab", "marker", { ahead: 140 })`);
    await t.until(`__lulu3d.ctx.hustle.marker && __lulu3d.ctx.hustle.marker.pad`, "a ringing payphone appears up the road", 60000);
    t.check("the marker has its beacon + pad", await g(`ctx.hustle._dbg.beacons.marker.on`));
    await t.frames(4);
    await t.shot("marker-payphone");
    await tpTo(`ctx.hustle.marker.s + 2.5`, 8.1);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.id === "cab"`, "driving into the glow takes the job", 60000);
    t.check("driving into the payphone's glow takes the job", (await job() || {}).id === "cab");
    // ── quit from the pause menu ────────────────────────────────────────────
    await t.tap(9);
    t.check("pause: 💼 Quit job (in the exit row)", await t.L(`!!document.querySelector(".pm-exit #hustleQuit")`));
    await t.L(`document.querySelector("#hustleQuit").click()`);
    await t.frames(4);
    t.check("quit: the job is gone, no card", await g(`!ctx.hustle.job && ctx.state === "playing"`));

    // ── layouts: a cab ride with the ticker up ──────────────────────────────
    await g(`ctx.hustle.start("cab", { fares: ["detective", "groom", "instructor"] })`);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.cur && __lulu3d.ctx.hustle.job.cur.ready`, "a fare for the layout shots", 60000);
    await tpTo(`ctx.hustle.job.cur.s`);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "ride"`, "the detective hops in", 60000);
    await t.frames(20);
    t.check("follow that car: a blue sedan to tail", await g(`!!ctx.hustle.job.cur.mark`));
    const layouts = [["desktop-1280", 1280, 720, false, false], ["tv-1080", 1920, 1080, true, false], ["tv-720", 1280, 720, true, false],
      ["phone-landscape", 844, 390, false, true], ["phone-portrait", 390, 844, false, true]];
    for (const [name, w, h, tv, touch] of layouts) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
      await g(`(ctx.applySettings(), true)`);
      if (touch) await t.L(`window.dispatchEvent(new Event("touchstart"))`);
      else await t.tap(11);
      await g(`(L3.setState("playing"), ctx.hustle.radio.debugSay("dj"))`);
      await t.frames(8);
      const r1 = await rectOf(".hs-radio"), r2 = await rectOf(".hs-job");
      t.check(`${name}: ticker off the road`, offRoad(r1), JSON.stringify(r1));
      t.check(`${name}: job HUD off the road`, offRoad(r2), JSON.stringify(r2));
      t.check(`${name}: ticker + job HUD on screen`, !!r1 && !!r2 && r1.x >= -1 && r1.r <= w + 1 && r2.x >= -1 && r2.r <= w + 1);
      if (touch) t.check(`${name}: the 📻 touch chip shows`, await t.L(`(() => { const b = document.querySelector("#tx_radio"); return !!b && b.offsetParent !== null; })()`));
      await t.shot(`layout-${name}`);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
    await g(`(ctx.applySettings(), true)`);
    await t.tap(11);

    // ── the station survives a reload ───────────────────────────────────────
    await g(`ctx.hustle.radio.tune("lounge")`);
    await t.L(`import("./js/core/save.js").then(m => m.saveNow())`);
    await t.page.reload();
    await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reboots", 120000);
    t.check("after a reload the radio is still on SMOOTH 88.8", await st() === "lounge");
    await g(`L3.startRun({ mode: "cruise" })`);
    await t.until(`__lulu3d.state === "playing"`, "drives again");
    await t.frames(6);
    t.check("…and plays a lounge track as soon as she drives", /story-relax|story-beach|salon|avigail/.test(await audioSrc() || ""), await audioSrc());
  },
};
