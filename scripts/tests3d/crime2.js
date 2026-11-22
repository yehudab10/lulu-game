// 🦹 features/crime — stage 2: CRIME THAT ISN'T HERS (solo, Lakewood), with the QA watchdog on.
//   🥄 the cups table: ✋ → play (rigged: −bet, capped plays a day) · a cop turns the corner → it folds, comes back ·
//      report (911 in person) → a beat cop nabs Yanky → paid once a day, he remembers (wary next time) ·
//      be his shill → marks → paid (capped); a cop who sees it → the look + the table folds
//   ⌚ the watch guy: buy (−price, once a day) · report → nabbed, paid · a snitch walks up → he's gone
//   📦 the porch pirate: tackle (the real ✋) → pick up → return at THAT door → paid + the family remembers ·
//      📞 Shomrim catch him → paid a little · let him go → gone · keep it → the doorbell camera's call-in
//   + the 📞 Phone lists the table / the watch guy (911) and the running pirate (Shomrim) while she's near
const W = require("../lib/qawatch.js");

module.exports = {
  name: "crime2",
  query: "&enable=crime,town,foot,law,places,community",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const C = "ctx.crime.debug", CU = "__lulu3d.ctx.crime.debug", O = "ctx.crime.debug.others", OU = "__lulu3d.ctx.crime.debug.others";
    const ONLY = process.env.CRIME_ONLY ? new RegExp(process.env.CRIME_ONLY) : null;
    const step = async (label, fn) => {
      if (ONLY && !ONLY.test(label)) return;
      try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      await t.L(`import("./js/core/dialog.js").then(m => { if (m.isOpen()) m.closeDialog(); })`);
      if (process.env.CRIME_LOG) console.log(`    [${label}] log:`, JSON.stringify(await g(`${C}.log.slice(-12)`)));
    };
    const logHas = (ev, phase) => g(`${C}.log.some(e => e.ev === ${JSON.stringify(ev)} && e.phase === ${JSON.stringify(phase)})`);
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    /** Answer the open dialogue: the option matching re (else tap through lines) until `done` (page code) is true. */
    async function answer(re, done, max = 200) {
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
    const promptText = () => t.L(`(() => { const e = document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);
    const press = async (doneCode, n = 6) => { for (let i = 0; i < n && !await g(doneCode); i++) { await t.tap(0); await t.frames(3); } return g(doneCode); };

    await W.install(t);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__porch = []; m.on("crime:porch", e => __porch.push(e)); })`);
    if (!await town("lakewood")) return;
    await g(`(${C}.CR.force.cop = false, ${C}.SAVE.paid = {}, ${C}.SAVE.mem = {}, ${C}.SAVE.day = ${C}.today(), true)`);

    // ════ 🥄 the cups ════
    await step("cups", async () => {
      t.check("🥄 Yanky's table stands by the bank", await g(`!!${O}.MONTE.table && !!${O}.MONTE.table.parent`));
      const P = await g(`(() => { const T = ${O}.MONTE.table.position, a = ${O}.MONTE.at; return { x: T.x + a.nx * 0.8, z: T.z + a.nz * 0.8 }; })()`);
      if (!await footAt(P.x, P.z)) return;
      await t.until(`${OU}.MONTE.yanky.p && ${OU}.MONTE.berel.p`, "Yanky + Berel turn up when she's near", 6000);
      await t.frames(4);
      t.check("✋ at the table: \"Find the kugel!\"", /kugel/i.test(await promptText()), await promptText());
      // play (rigged)
      const c0 = await coins();
      if (!await press(`ctx.dialogOpen`)) { t.check("the table's card opens", false); return; }
      await answer(/Play/);
      await t.until(`!${OU}.MONTE.game`, "the cups shuffle", 8000);
      await answer(/Middle/);
      await t.frames(10);
      t.check(`it's rigged: the bet is gone (${c0} → ${await coins()})`, c0 - (await coins()) === 3 && await logHas("monte", "lost"));
      await g(`(${O}.MONTE.yanky && 0, (() => { const m = ${C}.SAVE.mem.yanky; m.plays = 3; return true; })())`);
      const c1 = await coins();
      await press(`ctx.dialogOpen`); await answer(/Play/); await t.frames(10);
      t.check("past the day's plays he won't take her money", (await coins()) === c1 && !(await g(`!!${O}.MONTE.game`)));
      // a cop turns the corner → it folds → it comes back
      await g(`(${C}.CR.force.cop = true, true)`);
      await t.until(`${OU}.MONTE.state === "folded"`, "a cop turns the corner: the table folds", 3000);
      t.check("the cups are packed away", await g(`${O}.MONTE.cups.every(c => !c.visible)`));
      await g(`(${C}.CR.force.cop = false, ${O}.MONTE.foldT = 0.2, true)`);
      t.check("…and it's back once the coast is clear", await t.until(`${OU}.MONTE.state === "open"`, "back", 3000));
      // be his shill
      await press(`ctx.dialogOpen`); await answer(/shill/);
      t.check("🤝 shill: the shift starts", await g(`!!${O}.MONTE.shift`));
      const c2 = await coins();
      await t.until(`!${OU}.MONTE.shift`, "the shift ends", 60000);
      const sh = await coins() - c2;
      t.check(`a shift of marks pays the cut (+${sh}, ≤ 8)`, sh > 0 && sh <= 8, JSON.stringify((await g(`${C}.log.filter(e => e.ev === "monte").slice(-3)`))));
      t.check("Yanky remembers a partner", await g(`${C}.SAVE.mem.yanky.mood === "partner"`));
      // report: 911 → a beat cop → nabbed → paid once
      const c3 = await coins();
      await press(`ctx.dialogOpen`); await answer(/Report/, `${C}.log.some(e => e.ev === "monte" && e.phase === "reported")`, 400);
      const rp = await coins() - c3;
      t.check(`report: a beat cop nabs Yanky → a thank-you (+${rp})`, rp === 8);
      t.check("Yanky remembers the snitch", await g(`${C}.SAVE.mem.yanky.mood === "snitch"`));
      let r = await W.report(t); W.log(r);
      W.check(t, "the cups table", r, ["nan", "flat", "underground", "teleport", "lulu-jump"]);
    });

    // ════ ⌚ the watch guy ════
    await step("watches", async () => {
      await g(`(${C}.rebuild(), true)`);
      const P = await g(`({ x: ${O}.WATCH.guy.x, z: ${O}.WATCH.guy.z })`);
      if (!await footAt(P.x + 1.2, P.z)) return;
      await t.until(`${OU}.WATCH.guy.p`, "Shmuly turns up", 6000);
      await g(`(() => { const w = ${O}.WATCH, F = ctx.foot.debug.F; F.pos.x = w.guy.x + 1.1; F.pos.z = w.guy.z; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); w.talkT = 30; return true; })()`);
      await t.frames(4);
      t.check("✋ by Shmuly: \"wanna buy a watch?\"", /watch/i.test(await promptText()), await promptText());
      const c0 = await coins();
      await press(`ctx.dialogOpen`); await answer(/Buy/); await t.frames(6);
      t.check(`⌚ bought a "Rolecks" (−6: ${c0} → ${await coins()})`, c0 - (await coins()) === 6);
      const c1 = await coins();
      await g(`(${O}.WATCH.talkT = 30, true)`);
      await press(`ctx.dialogOpen`); await answer(/Buy/); await t.frames(6);
      t.check("one a day", (await coins()) === c1);
      await g(`(${O}.WATCH.talkT = 30, true)`);
      await press(`ctx.dialogOpen`); await answer(/Report/, `${C}.log.some(e => e.ev === "watch" && e.phase === "reported")`, 400);
      t.check(`report → nabbed → +6 (${c1} → ${await coins()})`, (await coins()) - c1 === 6);
      await g(`(${C}.rebuild(), true)`);
      const Q = await g(`({ x: ${O}.WATCH.guy.x, z: ${O}.WATCH.guy.z })`);
      await footAt(Q.x + 20, Q.z);
      await t.until(`${OU}.WATCH.guy.p`, "Shmuly's back next visit", 6000);
      await footAt(Q.x + 3, Q.z);
      t.check("…and he's off the moment the snitch walks up", await t.until(`${OU}.WATCH.state === "away"`, "he leaves", 3000));
    });

    // ════ 📦 the porch pirate ════
    await step("porch", async () => {
      await g(`(${C}.rebuild(), true)`);
      // a front door, and her on the sidewalk 25 m from it
      const D = await g(`(() => { const h = ctx.homes.homes()[3]; return h ? { i: h.i, x: h.ap.x, z: h.ap.z, name: h.name } : null; })()`);
      t.check("the town has front doors", !!D);
      if (!D) return;
      const stand = async (dx) => footAt(D.x + dx, D.z + dx * 0.3);
      await stand(22);
      t.check("a porch pirate turns up at that door", await g(`${O}.spawnPorch({ i: ${D.i} })`));
      await t.until(`${OU}.PORCH.E && ${OU}.PORCH.E.phase === "run"`, "he grabs the box and runs", 20000);
      // run him down: put her right by him (in the same breath — he's quick), ✋
      const reasons = await g(`(() => { const E = ${O}.PORCH.E, F = ctx.foot.debug.F; E.dir = 0; /* (he stops to catch his breath: the test's page is slow) */ F.pos.x = E.x + 1.4; F.pos.z = E.z; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return ctx.community.reasons("shomrim"); })()`);
      t.check("📞 Shomrim lists the running porch pirate", reasons.includes("crimePorch"), JSON.stringify(reasons));
      await t.frames(2);
      t.check("✋ TACKLE", await press(`${O}.PORCH.E && ${O}.PORCH.E.phase !== "run"`));
      await t.until(`${OU}.PORCH.E && (${OU}.PORCH.E.phase === "dropped" || ${OU}.PORCH.E.pt > 0.9)`, "the box is down", 4000);
      await g(`(() => { const E = ${O}.PORCH.E, F = ctx.foot.debug.F; F.pos.x = E.box.position.x + 0.8; F.pos.z = E.box.position.z; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(3);
      t.check("✋ pick it up", await press(`${O}.PORCH.E && ${O}.PORCH.E.phase === "carry"`));
      const c0 = await coins();
      await footAt(D.x + 0.6, D.z + 0.2);
      await t.frames(3);
      t.check("✋ RETURN at the family's door", await press(`${O}.PORCH.E && ${O}.PORCH.E.phase === "done"`));
      t.check(`the family's thanks: +6 (${c0} → ${await coins()})`, (await coins()) - c0 === 6);
      t.check("…and the household hears who brought it back (crime:porch → features/homes)", (await t.L(`window.__porch.some(e => e.phase === "back")`)));
      await g(`${O}.dropPorch()`);
      // 📞 Shomrim
      await stand(22);
      await g(`${O}.spawnPorch({ i: ${D.i} })`);
      await t.until(`${OU}.PORCH.E && ${OU}.PORCH.E.phase === "run"`, "another one runs", 20000);
      const c1 = await coins();
      await g(`${O}.porchShomrim()`);
      t.check("📞 a Shomer runs him down and brings it back", await t.until(`${OU}.PORCH.E && ${OU}.PORCH.E.phase === "done"`, "the Shomer", 30000));
      t.check(`…a little thank-you (+${(await coins()) - c1})`, (await coins()) - c1 === 3);
      await g(`${O}.dropPorch()`);
      // let him go
      await stand(22);
      await g(`${O}.spawnPorch({ i: ${D.i} })`);
      await t.until(`${OU}.PORCH.E && ${OU}.PORCH.E.phase === "run"`, "a third runs", 20000);
      await g(`(${O}.PORCH.E.runT = 99, true)`);
      t.check("let him go → he's gone with it", await t.until(`${OU}.PORCH.E && ${OU}.PORCH.E.phase === "gone"`, "gone", 4000));
      await g(`${O}.dropPorch()`);
      // keep it → the doorbell camera's call-in
      await stand(22);
      await g(`${O}.spawnPorch({ i: ${D.i} })`);
      await t.until(`${OU}.PORCH.E && ${OU}.PORCH.E.phase === "run"`, "a fourth runs", 20000);
      await g(`${O}.tacklePorch("lulu")`);
      await t.frames(30);
      await g(`(() => { const E = ${O}.PORCH.E, F = ctx.foot.debug.F; F.pos.x = E.box.position.x + 0.8; F.pos.z = E.box.position.z; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(3);
      await press(`${O}.PORCH.E && ${O}.PORCH.E.phase === "carry"`);
      await stand(85);
      await t.frames(6);
      t.check("walked off with it: KEPT → the family's doorbell camera calls it in", await logHas("porch", "kept") && await g(`ctx.law.reported || ctx.law.chasing`));
      let r = await W.report(t); W.log(r);
      W.check(t, "the porch pirate", r, ["nan", "flat", "underground"]);
    });
  },
};
