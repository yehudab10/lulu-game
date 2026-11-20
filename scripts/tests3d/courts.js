// ⚖️ The courthouses' own stories (features/places courts.js + shloime.js):
//   • LAKEWOOD — "In re: Baby Gitty": Shloime + the baby on the lobby bench, the case on the docket, ✋ sit in on the
//     hearing (a scene on the courtroom set) — skippable, ONE a real day, five of them, Lulu once a character witness,
//     ends well; then Shloime pushes the stroller outside the courthouse; nothing pays; a badge
//   • MIDWOOD — tried there, her lawyer is ABBA (whatever counsel she has, or uninvited), the verdict maths unchanged
//     (the same jury-mood factors as the regular lawyer in Lakewood); Abba in the Midwood lobby; Midwood's 2B stays locked
//   • phone + TV layouts of the hearing's dialogue
module.exports = {
  name: "courts",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["places:hearing", "law:verdict", "stat"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 160))); window.__states = []; m.on("state", e => __states.push(e.to)); })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    // COURTS_PART=1 → only Lakewood's hearings, =2 → only the trials + Midwood's lobby (both by default)
    const PART = +(process.env.COURTS_PART || 0), T0 = Date.now();
    const step = async (label, fn, part) => { if (PART && part !== PART) return; console.log(`   … ${label} (${Math.round((Date.now() - T0) / 1000)} s)`); try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const CD = `ctx.civic.courts.debug`;
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async (id) => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
    };
    const carAt = (kind, dist = 6) => g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(kind)}); if (!sp) return false; const car = ctx.car;
        const x = sp.x + sp.nx * ${dist}, z = sp.z + sp.nz * ${dist}, h = Math.atan2(sp.ux, sp.uz);
        car.place(x, z, h); car.vx = car.vz = 0; const n = ctx.world.road.nearest(x, z, car.s, {}); car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);
    const intoLobby = async () => {
      if (await st() !== "footRun") { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000); }
      await g(`(() => { const sp = ctx.civic.spot("court"); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); F.phase = "walk"; return true; })()`);
      await t.frames(4);
      await g(`ctx.civic.enter("court")`);
      return t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "courthouse"`, "inside the courthouse lobby", 60000);
    };
    const hot = id => g(`(() => { const r = window.__interiors.room, h = r && r.hots.find(h => h.id === ${JSON.stringify(id)}); if (!h) return null; return typeof h.label === "function" ? h.label() : h.label; })()`);
    const useHot = id => g(`(() => { const r = window.__interiors.room; const h = r.hots.find(h => h.id === ${JSON.stringify(id)}); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
    const dialog = () => t.L(`(document.querySelector("#dialog.open") || {}).textContent || ""`);
    async function tapUntil(code, label, max = 300, pickRe = null) {
      for (let i = 0; i < max; i++) {
        if (await g(code)) return true;
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length) { const k = pickRe ? Math.max(0, opts.findIndex(o => pickRe.test(o))) : 0; await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${k}].click()`); await t.frames(3); continue; }
        await t.tap(0);
      }
      t.check(label, false, "never reached: " + code + " · state " + await st());
      return false;
    }
    const skip = () => t.L(`import("./js/core/skip.js").then(m => m.skipNow())`);
    const backInLobby = () => t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "courthouse"`, "back in the lobby after the hearing", 60000);

    t.check("ctx.civic.counsel + the courts service", await g(`typeof ctx.civic.counsel === "function" && !!ctx.civic.courts`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ${CD}.reset(), ${CD}.D.today = "2026-11-20", true)`);
    const c0 = await coins();

    // ════ LAKEWOOD: Shloime's case ════
    await step("hearing 1 (skipped)", async () => {
      if (!await town("lakewood")) return;
      await carAt("court", 6);
      if (!await intoLobby()) return;
      t.check("Shloime + the baby are on the lobby bench", await g(`(() => { const r = window.__interiors.room; return r.byId.bench0.name === "Shloime" && r.byId.bench1.name === "Baby Gitty"; })()`));
      await useHot("docket");
      t.check("the docket lists the case (hearing 1 of 5 · TODAY)", await t.until(`/BABY GITTY.*1 of 5.*TODAY/s.test((document.querySelector("#dialog.open") || {}).textContent || "")`, "the docket's text", 8000), (await dialog()).slice(0, 120));
      await tapUntil(`!document.querySelector("#dialog.open")`, "the docket closes", 20);
      t.check("✋ at 2B: 'Sit in on the hearing'", /Sit in on the hearing/.test(await hot("doors2b")), await hot("doors2b"));
      await t.shot("lobby-shloime");
      await useHot("doors2b");
      if (!await t.until(`__lulu3d.state === "placesHearing"`, "into Courtroom 2B (the hearing)", 60000)) return;
      t.check("the town stays (Lakewood)", await g(`ctx.town.active && ctx.town.id === "lakewood"`));
      await t.until(`/IN RE: BABY GITTY|Docket 2B/.test((document.querySelector("#dialog.open") || {}).textContent || "")`, "the hearing opens", 30000);
      await t.frames(20);
      await t.shot("hearing-1");
      t.check("the hearing is skippable (⏭)", await t.L(`import("./js/core/skip.js").then(m => m.canSkip())`));
      await skip();
      if (!await backInLobby()) return;
      t.check("hearing 1 counted (shloime = 1, today)", await g(`${CD}.CS.shloime === 1 && ${CD}.CS.day === "2026-11-20"`), await g(`JSON.stringify(${CD}.CS)`));
      t.check("…one a day: no second hearing today", !/Sit in/.test(await hot("doors2b")), await hot("doors2b"));
      await useHot("doors2b");
      t.check("…2B says 'continued until TOMORROW'", await t.until(`/TOMORROW/.test((document.querySelector("#dialog.open") || {}).textContent || "")`, "2B's note", 8000), (await dialog()).slice(0, 100));
      await tapUntil(`!document.querySelector("#dialog.open")`, "the line closes", 20);
    }, 1);

    await step("hearing 2 (played) + 3 (witness)", async () => {
      await g(`(${CD}.D.today = "2026-11-21", true)`);
      if (!/Sit in/.test(await hot("doors2b") || "")) { t.check("a new day: the next hearing is on", false, await hot("doors2b")); return; }
      await useHot("doors2b");
      if (!await t.until(`__lulu3d.state === "placesHearing"`, "hearing 2", 60000)) return;
      const seen = [];
      for (let i = 0; i < 120 && await st() === "placesHearing"; i++) { const d = await dialog(); if (d && seen[seen.length - 1] !== d) seen.push(d); await t.tap(0); }
      t.check("hearing 2 plays line by line (the 400 photographs, the baby asleep on the bailiff)", seen.some(s => /four hundred/i.test(s)) && seen.some(s => /BAILIFF/.test(s) && /shoes/.test(s)), seen.length + " lines");
      if (!await backInLobby()) return;
      await g(`(${CD}.D.today = "2026-11-22", true)`);
      await useHot("doors2b");
      if (!await t.until(`__lulu3d.state === "placesHearing"`, "hearing 3", 60000)) return;
      await tapUntil(`!!document.querySelector("#dialog .opt")`, "Lulu on the stand: what does she say? (the character witness choice)", 120);
      const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].map(b => b.textContent)`);
      t.check("Lulu is a character witness: three (unhelpful) answers", opts.length === 3, JSON.stringify(opts));
      await t.shot("hearing-3-witness");
      // phone portrait + TV: the dialogue + its options fit
      await t.page.setViewportSize({ width: 390, height: 800 });
      await t.frames(6);
      t.check("phone portrait: the witness card fits", await t.L(`(() => { const r = document.querySelector("#dialog").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0; })()`));
      await t.shot("hearing-3-phone");
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`document.body.classList.add("tv")`);
      await t.frames(6);
      t.check("TV: the witness card fits", await t.L(`(() => { const r = document.querySelector("#dialog").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; })()`));
      await t.shot("hearing-3-tv");
      await t.L(`document.body.classList.remove("tv")`);
      await t.L(`document.querySelectorAll("#dialog .opt")[1].click()`);
      await tapUntil(`__lulu3d.state !== "placesHearing"`, "hearing 3 ends", 200);
      await backInLobby();
      t.check("three hearings seen", await g(`${CD}.CS.shloime === 3`), await g(`JSON.stringify(${CD}.CS)`));
    }, 1);

    await step("hearings 4 + 5 → the case closes", async () => {
      for (const day of ["2026-11-23", "2026-11-24"]) {
        await g(`(${CD}.D.today = ${JSON.stringify(day)}, true)`);
        await useHot("doors2b");
        if (!await t.until(`__lulu3d.state === "placesHearing"`, "hearing " + day, 60000)) return;
        await t.until(`!!document.querySelector("#dialog.open")`, "it opens", 30000);
        await skip();
        if (!await backInLobby()) return;
      }
      t.check("the case is closed after five hearings (one a day)", await g(`ctx.civic.courts.caseDone() && ${CD}.CS.shloime === 5`));
      t.check("…a scrapbook badge for seeing it through (the shloimeCase stat → 'Friend of the Court')", (await evs(`/shloimeCase/`)).length === 1 && await t.L(`import("./js/features/meta/badges.js").then(m => { const b = m.BADGES.find(b => b.id === "shloime"); return !!b && b.test({ stats: { shloimeCase: 1 } }) && !b.test({ stats: {} }); })`));
      t.check("no more hearings once it's over", !/Sit in/.test(await hot("doors2b") || ""), await hot("doors2b"));
      t.check("nothing paid out (coins unchanged)", (await coins()) === c0, `${c0} → ${await coins()}`);
      await g(`(window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on the street", 30000);
      await t.until(`!!__lulu3d.ctx.civic.courts.debug.N.p`, "Shloime + the stroller outside the courthouse", 30000);
      t.check("after the case: Shloime pushes the stroller outside the courthouse", await g(`!!${CD}.N.p && ${CD}.N.p.obj.parent === ctx.scene`));
      await g(`(() => { const p = ${CD}.N.p.obj.position, sp = ${CD}.N.sp, F = ctx.foot.debug.F; F.pos.set(p.x + sp.ux * 1.2, 0.05, p.z + sp.uz * 1.2); return true; })()`);
      await t.frames(6);
      t.check("✋ TALK TO SHLOIME", await g(`(() => { const p = ctx.foot.debug.interactables(); return !!p && /SHLOIME/.test(p.label); })()`), await g(`JSON.stringify((ctx.foot.debug.interactables() || {}).label || null)`));
      await t.shot("shloime-stroller");
      await g(`(ctx.foot.end("test"), true)`);
    }, 1);

    // ════ MIDWOOD: Abba defends her; the maths is the regular lawyer's ════
    const CELL = `__lulu3d.ctx.law._dbg.jail && __lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
    // a trial with no hired lawyer and a quiet court: plead the first defence, read the jury's inputs (law court.js courtLog)
    const trial = async (id) => {
      if (!await town(id)) return null;
      await carAt("court", 10);
      await t.frames(4);
      await g(`(() => { const D = ctx.law._dbg; for (const k of Object.keys(D.FORCE)) delete D.FORCE[k]; D.FORCE.quietCourt = true; D.FORCE.guest = "nobody"; D.FORCE.verdict = "dismissed"; return true; })()`);
      await g(`ctx.law.arrest(["SPEEDING", "LOITERING NEAR A KNISH"], { skipCinematic: true })`);
      if (!await tapUntil(CELL, `booked in ${id}`, 500)) return null;
      await t.L(`document.querySelector("#lawCourtBtn").click()`);
      await t.until(`__lulu3d.state === "lawCourt"`, "to court", 30000);
      const said = [];
      for (let i = 0; i < 400 && await st() === "lawCourt"; i++) {
        const d = await dialog(); if (d && said[said.length - 1] !== d) said.push(d);
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length) {
          const k = Math.max(0, opts.findIndex(o => !/💰|Plea|plea|[Bb]ribe/.test(o)));
          await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${k}].click()`);
          await t.frames(3); continue;
        }
        await t.tap(0);
      }
      const maths = await t.L(`import("./js/features/law/court.js").then(m => JSON.stringify(m.courtLog[m.courtLog.length - 1] || null))`);
      await t.until(`__lulu3d.state === "footRun"`, "out of the courthouse", 120000);
      return { said, maths };
    };
    let lw = null, mw = null;
    await step("tried in Lakewood: the regular court", async () => {
      lw = await trial("lakewood");
      if (!lw) return;
      t.check("Lakewood: the regular court (no Abba voice)", await g(`ctx.civic.counsel(null, ["SPEEDING"]) === null`));
      t.check("Lakewood: no Abba at her side (no lawyer hired)", !lw.said.some(s => /^ABBA/.test(s) || /ABBA/.test(s.slice(0, 20))), lw.said.filter(s => /ABBA/.test(s)).slice(0, 2).join(" | "));
    }, 2);
    await step("tried in Midwood: ABBA", async () => {
      mw = await trial("midwood");
      if (!mw) return;
      const abba = mw.said.filter(s => /ABBA/.test(s.slice(0, 30)));
      t.check(`Midwood: Abba defends her (${abba.length} lines)`, abba.length >= 3, abba.slice(0, 3).join(" | ").slice(0, 300));
      console.log("   ABBA in Midwood:", abba.slice(0, 4).map(s => s.slice(0, 120)).join(" || "));
      // the verdict is one roll on (the jury's mood factors + lean, the chosen defence's own odds): Abba changes neither
      if (lw) {
        const L0 = JSON.parse(lw.maths || "null"), M0 = JSON.parse(mw.maths || "null"), core = o => o && JSON.stringify([o.factors, o.lean, o.mistrial, o.strikes]);
        const own = await t.L(`import("./js/features/law/data.js").then(d => ${JSON.stringify([L0, M0])}.every(o => { const p = o && d.DEFENSE_POOL.find(p => p.label === o.plea); return !!p && JSON.stringify(p.outcomes) === JSON.stringify(o.outcomes); }))`);
        t.check("the verdict maths is unchanged: the same jury-mood factors + lean as Lakewood's regular court, each defence with its own odds", !!L0 && !!M0 && core(L0) === core(M0) && own, `${lw.maths} vs ${mw.maths}`);
      }
      // with a hired lawyer: Abba plays THAT lawyer — the same tier object (its factor, blunder odds, fee), the rules' own argument
      const hired = await t.L(`Promise.all([import("./js/features/law/data.js"), import("./js/features/law/rules.js")]).then(([d, r]) => { const tier = d.LAWYER_TIERS[0], cl = ["SPEEDING"];
          const v = __lulu3d.ctx.civic.counsel(tier, cl); if (!v) return "no voice"; const arg = r.lawyerChargeArgument(tier, cl);
          return { name: v.name, key: v.key, argue: v.argue(arg, tier), arg }; })`);
      t.check("…hired counsel in Midwood: 'ABBA (as <that lawyer>)', and he argues the rules' own argument", hired && /^ABBA \(as /.test(hired.name) && hired.key === "lawAbba" && /Lulu-bear/.test(hired.argue) && hired.argue.length > 40, JSON.stringify(hired).slice(0, 300));
    }, 2);
    await step("Midwood lobby: Abba is there; 2B stays locked", async () => {
      if (!await town("midwood")) return;
      await carAt("court", 6);
      if (!await intoLobby()) return;
      t.check("Abba is in the Midwood lobby", await g(`!!window.__interiors.room.byId.abba`));
      await useHot("abba");
      t.check("…with a line ('I have a 2 o'clock…')", await t.until(`/2 o'clock/.test((document.querySelector("#dialog.open") || {}).textContent || "")`, "Abba's line", 8000), (await dialog()).slice(0, 100));
      await tapUntil(`!document.querySelector("#dialog.open")`, "Abba's line closes", 20);
      t.check("Midwood's 2B: no hearing (locked)", !/Sit in/.test(await hot("doors2b")), await hot("doors2b"));
      await t.shot("midwood-lobby-abba");
    }, 2);
  },
};
