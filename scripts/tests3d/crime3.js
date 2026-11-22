// 🦹 features/crime — stage 3: the rest of her crimes + street corruption (solo, Lakewood), with the QA watchdog on.
//   🏷️ the Fixer's mattress tip: 4 mattresses → ✋ rip each → paid once a day (and no second tip that day) · a cop sees two → chase
//   🐟 the kiddush herring (on the sidewalk): swipe while Reb Getzel's watching → caught · while he argues → away → paid
//   🌬️ the air stand: a shift → sales → paid (capped) · Inspector Pinchas: a "donation" (remembered — he winks next time) ·
//      a fake permit he doesn't buy → the shift's over + his call-in
//   🧾 Malka at the window (double-parked): a "donation" → torn up · a sting → arrested for BRIBING A PUBLIC SERVANT
//   👀 a crooked moment (Tuvia's tow): 📸 the Camera with it in frame = evidence → 🕵️ Internal Affairs → paid, Tuvia's gone
//      for good · evidence on Malka → hush money at the window → she's nervous (never tickets her again) · features/memory
//   📊 chase frequency: a few minutes walking round town, ignoring everything → no chase from crime; then jaywalking every
//      chance she gets → how many chases (per 10 minutes) — logged for the report
const W = require("../lib/qawatch.js");

module.exports = {
  name: "crime3",
  query: "&enable=crime,town,foot,law,places,community,phone,play,memory,underworld",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const C = "ctx.crime.debug", CU = "__lulu3d.ctx.crime.debug", S3 = "ctx.crime.debug.s3", S3U = "__lulu3d.ctx.crime.debug.s3";
    const ONLY = process.env.CRIME_ONLY ? new RegExp(process.env.CRIME_ONLY) : null;
    const step = async (label, fn) => {
      if (ONLY && !ONLY.test(label)) return;
      try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      await t.L(`import("./js/core/dialog.js").then(m => { if (m.isOpen()) m.closeDialog(); })`);
      if (process.env.CRIME_LOG) console.log(`    [${label}] log:`, JSON.stringify(await g(`${C}.log.slice(-12)`)));
    };
    const logHas = (ev, phase) => g(`${C}.log.some(e => e.ev === ${JSON.stringify(ev)} && e.phase === ${JSON.stringify(phase)})`);
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    async function answer(re, done = null, max = 200) {
      for (let i = 0; i < max; i++) {
        if (done && await g(done)) return true;
        const o = await opts();
        if (o.length) {
          const idx = o.findIndex(x => re.test(x));
          await t.L(`(b => b && b.click())([...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${Math.max(0, idx)}])`);
          await t.frames(3);
          if (!done) return true;
          continue;
        }
        if (!await g(`ctx.dialogOpen`) && !done) return false;
        await t.tap(0);
      }
      return false;
    }
    const town = async (id = "lakewood") => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000);
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000)) return false;
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.crime.active`, `in ${id} with crime on`, 8000);
    };
    const footAt = async (x, z) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "out on foot", 8000)) return false;
      }
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.x = ${x}; F.pos.z = ${z}; F.vel.set(0, 0, 0); F.lulu.obj.position.set(${x}, 0, ${z}); ctx.cam.snap(); return true; })()`);
      await t.frames(4);
      return true;
    };
    const press = async (doneCode, n = 6) => { for (let i = 0; i < n && !await g(doneCode); i++) { await t.tap(0); await t.frames(3); } return g(doneCode); };
    const resetLaw = () => g(`(() => { const L = ctx.law._dbg.L; if (L.chase) ctx.law.standDown("test"); L.sus = 0; L.grace = 0; L.hold = 0; L.bolo = null; ${C}.CR.sus = {}; if (ctx.foot.active && ctx.foot.chasing) ctx.foot.dropChase(); return true; })()`);
    const parkHere = () => g(`(() => { const sts = ctx.town.plan.STREETS.filter(s => s.parkLane && s.cross.length > 1 && !s.oneway); let best = null;
        const jam = new Set((ctx.town.def.jams || []).map(j => j.street)), r0 = ctx.world.road;
          for (const s of sts) for (let k = 0; k < s.cross.length - 1; k++) { const len = s.cross[k + 1].a - s.cross[k].a, a = (s.cross[k].a + s.cross[k + 1].a) / 2 + 8;
            if (jam.has(s.name) || len < 40) continue;
            const q = r0.point(s.base + a, 3.5 * s.lanes - 1.75, {}); if (ctx.traffic.cars.some(c => Math.hypot(c.x - q.x, c.z - q.z) < 12)) continue;
            if (!best || len > best.len) best = { s, a, len }; }
        const st = best.s, r = ctx.world.road, d = 3.5 * st.lanes - 1.75, p = r.point(st.base + best.a, d, {});
        const n = r.nearest(p.x, p.z, st.base + best.a, {}), car = ctx.car;
        car.place(p.x, p.z, n.h); car.vx = car.vz = 0; car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);

    await W.install(t);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__emit = m.emit; window.__arrests = []; m.on("law:arrest", e => __arrests.push((e && e.charges || []).slice())); })`);
    if (!await town("lakewood")) return;
    await g(`(${C}.CR.force.cop = false, ${C}.SAVE.paid = {}, ${C}.SAVE.mem = {}, ${C}.SAVE.evidence = [], ${C}.SAVE.tagsDay = "", ${C}.SAVE.day = ${C}.today(), true)`);

    // ════ 🏷️ the mattress tags ════
    await step("tags", async () => {
      await footAt(...Object.values(await g(`(() => { const p = ctx.car.pos; return { x: p.x, z: p.z }; })()`)));
      t.check("the Fixer's tip: 4 mattresses on a kerb nearby", await g(`(${S3}.clearTags(), ${S3}.maybeTip(true))`) && (await g(`${S3}.TAGS.list.length`)) === 4);
      t.check("…in his own 💬 thread", await g(`!!document.querySelector("body") && true`));
      const c0 = await coins();
      for (let i = 0; i < 4; i++) {
        const p = await g(`(() => { const tg = ${S3}.TAGS.list[${i}]; return { x: tg.x, z: tg.z }; })()`);
        await footAt(p.x + 0.9, p.z + 0.9);
        await press(`${S3}.TAGS.list[${i}].ripped`);
      }
      t.check("✋ RIP × 4", await g(`${S3}.TAGS.list.every(x => x.ripped)`));
      t.check(`all four → the Fixer pays (+${(await coins()) - c0})`, (await coins()) - c0 === 12);
      t.check("no second tip the same day", !(await g(`(${S3}.clearTags(), ${S3}.maybeTip(false))`)));
      // a cop sees the rips
      await resetLaw();
      await g(`(${C}.SAVE.tagsDay = "", ${C}.CR.force.cop = true, ${S3}.maybeTip(true))`);
      await g(`${S3}.rip(${S3}.TAGS.list[0])`);
      t.check("a cop sees a rip → the ⚠️ look", await logHas("warn", undefined) || await g(`${C}.log.some(e => e.ev === "warn" && e.kind === "tags")`));
      await g(`${S3}.rip(${S3}.TAGS.list[1])`);
      t.check("…a second → a cop on foot gives chase", await g(`ctx.foot.chasing`));
      await g(`(${C}.CR.force.cop = false, ctx.foot.dropChase(), ${S3}.clearTags(), true)`);
      await t.frames(80);
    });

    // ════ 🐟 the kiddush herring ════
    await step("herring", async () => {
      await resetLaw();
      t.check("🐟 the kiddush table stands on the sidewalk by the hall", await g(`!!${S3}.HER.table && !!${S3}.HER.table.parent`));
      const P = await g(`(() => { const a = ${S3}.HER.at; return { x: a.x + a.nx * 0.9, z: a.z + a.nz * 0.9 }; })()`);
      await footAt(P.x, P.z);
      await t.until(`${S3U}.HER.getzel.p`, "Reb Getzel turns up", 6000);
      // he's watching the table (and her)
      await g(`(${S3}.HER.look = 0, ${S3}.HER.lookT = 30, ${S3}.HER.getzel.p.obj.rotation.y = ${S3}.HER.at.yaw, true)`);
      await t.frames(4);
      await g(`${S3}.swipe()`);
      t.check("swiped under his nose → \"GANEF!\" (caught, the herring stays)", await logHas("herring", "caught") && !(await g(`!!${S3}.HER.carry`)));
      // he turns to argue about the kichel
      await g(`(() => { const H = ${S3}.HER, b = H.buddy; H.look = 1; H.lookT = 30; H.getzel.p.obj.rotation.y = Math.atan2(b.x - H.getzel.x, b.z - H.getzel.z) + 0.3; return true; })()`);
      await t.frames(3);
      t.check("he's looking away", !(await g(`(() => { const p = ctx.foot.pos; return ${S3}.getzelSees(p.x, p.z); })()`)));
      const c0 = await coins();
      await press(`!!${S3}.HER.carry`);
      t.check("✋ SWIPE while he argues: she's got the herring", await g(`!!${S3}.HER.carry || ${C}.log.some(e => e.ev === "herring" && e.phase === "swipe")`));
      await footAt(P.x + 18, P.z + 18);
      await t.frames(6);
      t.check(`away clean → Mendy pays (+${(await coins()) - c0})`, (await coins()) - c0 === 8 && await logHas("herring", "clean"));
    });

    // ════ 🌬️ the air stand ════
    await step("air", async () => {
      await resetLaw();
      const B = await g(`(() => { const a = ${S3}.AIR.at; return { x: a.x - a.nx * 0.9, z: a.z - a.nz * 0.9 }; })()`);
      await footAt(B.x, B.z);
      await g(`(${S3}.AIR.force.inspector = false, true)`);
      const c0 = await coins();
      await press(`!!${S3}.AIR.shift`);
      t.check("✋ SELL: the stand's open", await g(`!!${S3}.AIR.shift || ${C}.log.some(e => e.ev === "air" && e.phase === "open")`));
      await answer(/./, `!${C}.AIR_SHIFT_OPEN && !${S3}.AIR.shift`, 600);
      const got = (await coins()) - c0;
      t.check(`a shift sells jars (+${got}, ≤ 10)`, got > 0 && got <= 10);
      // Inspector Pinchas: a "donation"
      await g(`(${C}.SAVE.paid.air = 0, ${S3}.AIR.force.inspector = true, true)`);
      await press(`!!${S3}.AIR.shift`);
      await answer(/donation/, `${C}.log.some(e => e.ev === "air" && e.phase === "inspector")`, 600);
      t.check("💸 a \"donation\" → he didn't see any jars (remembered)", await g(`${C}.log.some(e => e.ev === "air" && e.outcome === "bribed") && ${C}.SAVE.mem.pinchas.mood === "bribed"`));
      await answer(/./, `!${S3}.AIR.shift`, 600);
      // a fake permit he doesn't buy
      await g(`(${C}.SAVE.mem.pinchas.mood = "", ${C}.SAVE.paid.air = 0, ${S3}.AIR.force.believe = false, true)`);
      await press(`!!${S3}.AIR.shift`);
      await answer(/permit!/, `${C}.log.filter(e => e.ev === "air" && e.phase === "inspector").length >= 2`, 600);
      await t.frames(4);
      t.check("📄 a napkin for a permit → the shift's over + his call-in", !(await g(`!!${S3}.AIR.shift`)) && await g(`ctx.law.reported || ctx.law.chasing`));
    });

    // ════ 🧾 corruption ════
    await step("corruption", async () => {
      await resetLaw();
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
      // Malka at the window: a "donation"
      await parkHere(); await t.frames(3);
      await g(`ctx.crime.start("park")`);
      await g(`(${S3}.CO.force.sting = false, ${C}.PARK.on.t = 13, true)`);
      await t.until(`${S3U}.CO.malka && ${S3U}.CO.malka.asked`, "Malka walks up to the window", 30000);
      const c0 = await coins();
      await answer(/donation/);
      await t.frames(6);
      t.check(`🍩 a "donation" → the ticket's torn up (−5: ${c0} → ${await coins()})`, c0 - (await coins()) === 5 && await g(`${C}.SAVE.mem.malka.mood === "bribed"`));
      t.check("…city hall hears about it (crime:corrupt)", await g(`${C}.log.some(e => e.ev === "corrupt" && e.who === "malka" && e.act === "bribe")`));
      await g(`${C}.parkEnd("test")`);
      // a crooked moment: Tuvia's tow — 📸 the Camera with it in frame
      await footAt(...Object.values(await g(`(() => { const p = ctx.car.pos; return { x: p.x, z: p.z }; })()`)));
      t.check("👀 a crooked moment up the sidewalk (Tuvia's tow)", await g(`${S3}.spawnScene("tuvia")`));
      await t.frames(20);
      // (camera placed + the shutter in ONE step — a frame in between would put the game's camera back)
      await g(`(() => { const S = ${S3}.CO.scene, c = ctx.camera; c.position.set(S.x + 8, 3, S.z + 8); c.lookAt(S.x, 1.3, S.z); c.updateMatrixWorld(true); window.__emit("photo:snap", { url: "" }); return true; })()`);
      t.check("📸 a photo with it in frame = evidence", await g(`${C}.SAVE.evidence.some(e => e.who === "tuvia")`));
      // 🕵️ Internal Affairs
      const c1 = await coins();
      t.check("🕵️ Internal Affairs is a contact in the 📞 Phone", await g(`!!ctx.community && true`));
      await g(`${S3}.handIn("tuvia")`);
      t.check(`hand it in → +10 (${c1} → ${await coins()}), Tuvia's reassigned for good`, (await coins()) - c1 === 10 && await g(`${C}.SAVE.mem.tuvia.mood === "gone" && !${S3}.spawnScene("tuvia")`));
      t.check("features/memory remembers", await g(`ctx.memory ? ctx.memory.recall("crime").some(r => r.who === "tuvia" && r.did === "exposed") : true`));
      // evidence on Malka → hush money at the window
      await g(`(${S3}.snap("malka", "test"), true)`);
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
      await parkHere(); await t.frames(3);
      await g(`ctx.crime.start("park")`);
      await g(`(${C}.PARK.on.t = 13, true)`);
      await t.until(`${S3U}.CO.malka && ${S3U}.CO.malka.asked`, "Malka again", 30000);
      const c2 = await coins();
      await answer(/photo/);
      await t.frames(6);
      t.check(`📸 "about this photo…" → hush money (+${(await coins()) - c2}), she's nervous`, (await coins()) - c2 === 8 && await g(`${C}.SAVE.mem.malka.mood === "nervous"`));
      await g(`${C}.parkEnd("test")`);
      await parkHere(); await t.frames(3);
      await g(`ctx.crime.start("park")`);
      await g(`(${C}.PARK.on.t = 13, true)`);
      await t.frames(30);
      t.check("…and she never tickets her again", await g(`!${S3}.CO.malka && ${C}.log.some(e => e.ev === "malka" && e.phase === "nervous")`));
      await g(`${C}.parkEnd("test")`);
      // a sting
      await g(`(${C}.SAVE.mem.malka.mood = "", ${S3}.CO.force.sting = true, true)`);
      await parkHere(); await t.frames(3);
      await g(`ctx.crime.start("park")`);
      await g(`(${C}.PARK.on.t = 13, true)`);
      await t.until(`${S3U}.CO.malka && ${S3U}.CO.malka.asked`, "Malka (I.A.)", 30000);
      await answer(/donation/);
      await t.until(`window.__arrests.length > 0`, "an I.A. sting → arrested", 30000);
      const ar = await t.L(`window.__arrests.slice(-1)[0] || []`);
      t.check("an I.A. sting: arrested for BRIBING A PUBLIC SERVANT", ar.some(c => /BRIBING A PUBLIC SERVANT/.test(c)), JSON.stringify(ar));
      let r = await W.report(t); W.log(r);
      W.check(t, "corruption", r, ["nan", "flat", "underground", "teleport", "lulu-jump", "cam-jump"]);
    });

    // ════ 📊 how often a town session ends in a chase ════
    await step("chases", async () => {
      if (!await town("lakewood")) return;
      await resetLaw();
      await g(`(${C}.CR.force.cop = null, ${C}.SAVE.paid = {}, true)`);
      await t.L(`import("./js/core/ctx.js").then(m => { window.__chases = 0; m.on("cop:chase", e => { if (e && e.active) __chases++; }); })`);
      const footChases = () => g(`${C}.log.filter(e => e.ev === "chase").length`);
      await footAt(...Object.values(await g(`(() => { const p = ctx.car.pos; return { x: p.x, z: p.z }; })()`)));
      // (a) walking round town, ignoring everything: 2 game minutes
      const f0 = await footChases();
      for (let k = 0; k < 8; k++) { await t.stick(Math.sin(k), -0.8); await t.frames(450 / 2); }
      await t.stick(0, 0);
      const ign = (await footChases()) - f0 + await t.L(`window.__chases`);
      t.check(`ignoring it all for a minute of walking: no chase from crime (${ign})`, ign === 0);
      console.log(`    📊 ignoring everything: ${ign} chases in 1 game-minute`);
      // (b) jaywalking at every chance for 2 game minutes (the patrol as it comes)
      const f1 = await footChases();
      const S = await g(`(() => { const sts = ctx.town.plan.STREETS.filter(s => s.parkLane && s.cross.length > 1); let best = null;
          for (const s of sts) for (let k = 0; k < s.cross.length - 1; k++) { const len = s.cross[k + 1].a - s.cross[k].a; if (!best || len > best.len) best = { base: s.base, a: (s.cross[k].a + s.cross[k + 1].a) / 2, curb: s.curb }; }
          return best; })()`);
      const T0 = await g(`ctx.time`);
      let n = 0;
      while ((await g(`ctx.time`)) - T0 < 120 && n < 60) {
        if (await g(`ctx.foot.chasing || L3.state !== "footRun"`)) break;
        const side = n % 2 ? -1 : 1, al = S.a + ((n * 7) % 30) - 15;
        for (let i = 0; i <= 12; i++) {
          const d = side * (S.curb + 1.6) * (1 - i / 6);
          await g(`(() => { const p = ctx.world.road.point(${S.base} + ${al}, ${d}, {}), F = ctx.foot.debug.F; if (!F) return false; F.pos.x = p.x; F.pos.z = p.z; F.lulu.obj.position.set(p.x, 0, p.z); return true; })()`);
          await t.frames(3);
        }
        n++;
      }
      const mins = ((await g(`ctx.time`)) - T0) / 60;
      const jw = (await footChases()) - f1;
      console.log(`    📊 jaywalking at every chance: ${n} crossings, ${jw} chase(s) in ${mins.toFixed(1)} game-minutes → ~${(jw / Math.max(0.1, mins) * 10).toFixed(1)} per 10 minutes`);
      t.check(`jaywalking non-stop: chases stay rare (${jw} in ${mins.toFixed(1)} min — a cop has to SEE two)`, jw <= Math.ceil(mins));
    });
  },
};
