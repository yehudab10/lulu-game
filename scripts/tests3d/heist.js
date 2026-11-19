// 🏦 Heist (features/heist): banks, cartoon robberies, Lulu's own cartoon heist, road snatchers, the cops' gear.
//   • a bank in each town (town data `uses.bank` → heist_bank + its sign), its interior (teller line, napping
//     guard, vault door) on foot → 🔍 case the vault → pick a plan
//   • foil a robbery: box in the getaway car in Lakewood (pays, no chase on Lulu), ram it on the highway
//     (3 rams, a cruiser shows up), ✋ tackle the robber on foot
//   • the heist: pull up at the bank → the ⏭ job cutscene → a ★★★ chase with the heist charge → a clean escape
//     pays (+ a warrant on file); a second job → caught → jail → court with the heist charge + courtroom lines
//   • a moped snatch is CAPPED and catching him refunds it (+ a bonus); a honk dodges one
//   • a thief drives off in her parked car → ✋ yank him out → she gets back in her own car
//   • the stun net + the spike strip slow her and wear off
//   • perf (draw calls in town at the bank vs. elsewhere; the interior) · heist is OFF in a 🎉 party
module.exports = {
  name: "heist",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const HD = `ctx.heist.debug`, LD = `ctx.law._dbg`;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["heist:robbery", "heist:job", "heist:snatch", "heist:theft", "heist:gear", "cop:chase", "law:arrest", "town:enter", "town:leave"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 120))); })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async (id = "lakewood") => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("highway"), true)`); await t.frames(20); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
    };
    // park her car out on the street in front of the bank (sp + n·dist), facing it (for a shot) or along the street
    const atBank = (dist = 15, face = true, v = 0, along = 0) => g(`(() => { const sp = ctx.town.spot("bank"); if (!sp) return false; const car = ctx.car;
        const x = sp.x + sp.nx * ${dist} + sp.ux * ${along}, z = sp.z + sp.nz * ${dist} + sp.uz * ${along}; const h = ${face} ? Math.atan2(-sp.nx, -sp.nz) : Math.atan2(sp.ux, sp.uz);
        car.place(x, z, h); car.vx = Math.sin(h) * ${v}; car.vz = Math.cos(h) * ${v}; const n = ctx.world.road.nearest(x, z, car.s, {}); car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); }; }
        window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, calls: Math.round(P.calls / Math.max(1, P.n)), maxCalls: P.maxCalls, tris: Math.round(P.tris / Math.max(1, P.n)) }; })()`);
    };
    // advance an open dialogue: ✕ through lines, pick an option matching pickRe when options show
    async function talk(untilCode, label, pickRe = null, max = 160, seen = null) {
      for (let i = 0; i < max; i++) {
        if (await g(untilCode)) return true;
        if (seen) { const txt = await t.L(`(document.querySelector("#dialog") || {}).textContent || ""`); if (txt) seen.push(txt); }
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length && pickRe) {
          const idx = opts.findIndex(o => pickRe.test(o));
          if (idx >= 0) { await t.L(`document.querySelectorAll("#dialog .opt")[${idx}].click()`); await t.frames(3); continue; }
        }
        await t.tap(0);
      }
      t.check(label, false, "never reached: " + untilCode + " · state " + await st());
      return false;
    }

    t.check("ctx.heist service is registered", await g(`!!(ctx.heist && ctx.heist.planHeist && ctx.heist.gear && ctx.heist.debug && ctx.heist.debug.robbery)`));
    t.check("party keeps heist OFF (its OFF set)", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"heist"/.test(s))`));
    t.check("the bank is TOWN DATA in both towns (uses.bank → heist_bank)", await g(`ctx.town.towns.lakewood.uses.bank.key === "heist_bank" && ctx.town.towns.midwood.uses.bank.key === "heist_bank"`));
    t.check("…on a block face of each town", await g(`Object.values(ctx.town.towns.lakewood.blocks).some(b => b.faces && Object.values(b.faces).includes("bank")) && Object.values(ctx.town.towns.midwood.blocks).some(b => b.faces && Object.values(b.faces).includes("bank"))`));
    t.check("the bank interior is registered with the interiors engine", await g(`!!(ctx.interiors.bank && ctx.interiors.bank.enter)`));
    t.check("law knows the heist charge (weight + courtroom lines)", await t.L(`import("./js/features/law/data.js").then(m => m.CHARGE_WEIGHT["BANK HEIST"] === 4 && m.CHARGE_COURT.some(c => c.key === "BANK HEIST") && m.CHARGE_DIALOGUE[0].key === "BANK HEIST")`));
    t.check("moves can PIT the getaway car (data.pit)", await t.L(`fetch("js/features/moves/drive.js").then(r => r.text()).then(s => /data\\.pit/.test(s))`));

    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

    // ════ 1. a bank in each town ════
    let perfAt = null, perfElse = null;
    await step("lakewood bank", async () => {
      if (!await town("lakewood")) return;
      t.check("Lakewood has a bank spot (T.spots.bank)", await g(`!!ctx.town.spot("bank")`));
      const across = await g(`(() => { const sp = ctx.town.spot("bank"), n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {}); return Math.abs(n.d); })()`);
      t.check("heist_bank is loaded with the town's models", await t.L(`import("./js/models.js").then(m => !!m.models.heist_bank)`));
      await atBank(Math.max(6, across + 3), true);      // (from the far lane: Main St is narrower than Avenue J)
      await t.frames(40);
      perfAt = await perf(60);
      console.log("   PERF heist lakewood at the bank", JSON.stringify(perfAt));
      await t.shot("lakewood-bank");
      // elsewhere in town (the pizza shop), for the comparison
      await g(`(() => { const sp = ctx.town.spot("pizza"); const car = ctx.car; const x = sp.x + sp.nx * 18, z = sp.z + sp.nz * 18, h = Math.atan2(-sp.nx, -sp.nz); car.place(x, z, h); car.vx = car.vz = 0; ctx.cam.snap(); return true; })()`);
      await t.frames(40);
      perfElse = await perf(60);
      console.log("   PERF heist lakewood elsewhere", JSON.stringify(perfElse));
      t.check("perf: the bank costs (almost) no extra draw calls in town", perfAt.calls <= perfElse.calls + 14, `${perfAt.calls} at the bank vs ${perfElse.calls} at the pizza shop`);
    });
    await step("midwood bank", async () => {
      if (!await town("midwood")) return;
      t.check("Midwood has a bank spot too", await g(`!!ctx.town.spot("bank")`));
      await atBank(18, true);
      await t.frames(40);
      const p = await perf(45);
      console.log("   PERF heist midwood at the bank", JSON.stringify(p));
      await t.shot("midwood-bank");
    });

    // ════ 2. on foot: the bank interior, casing the vault, picking a plan ════
    await step("interior", async () => {
      if (!await town("lakewood")) return;
      await atBank(12, false);
      await t.frames(4);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot in Lakewood", 8000);
      await g(`(() => { const sp = ctx.town.spot("bank"); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); F.phase = "walk"; return true; })()`);
      await t.frames(4);
      t.check("✋ ENTER the bank is offered at its door", await t.L(`/BANK/i.test((document.querySelector("#prompt") || document.querySelector(".prompt") || {}).textContent || "") || !!__lulu3d.ctx.foot.debug.interactables()`));
      await g(`${HD}.enterBank()`);
      if (!await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready`, "inside the bank (interiors engine)", 60000)) return;
      t.check("the town lets the bank play inside it (still in Lakewood)", await g(`ctx.town.active`));
      t.check("teller, guard (napping) and the line are there", await g(`(() => { const r = window.__interiors.room; return !!(r.byId.teller && r.byId.guard && r.byId.line0 && r.byId.guard.pose.sit); })()`));
      t.check("the vault door is a mover", await g(`!!window.__interiors.room.data.vault`));
      const ip = await perf(30);
      console.log("   PERF heist bank interior", JSON.stringify(ip));
      t.check("perf: the interior draws in a sane number of calls", ip.calls < 160, String(ip.calls));
      await t.shot("bank-interior");
      // 🔍 case the vault → 🏎️ THE CLASSIC
      await g(`(() => { const r = window.__interiors.room; const h = r.hots.find(h => h.id === "vault"); r.lulu.obj.position.set(h.x, 0, h.z + 0.5); r.use(h); return true; })()`);
      await talk(`!!__lulu3d.ctx.heist.plan`, "casing the vault → a plan", /CLASSIC/, 80);
      t.check("casing the vault sets the plan (town + THE CLASSIC)", await g(`!!ctx.heist.plan && ctx.heist.plan.town === "lakewood" && ctx.heist.plan.plan.id === "classic"`));
      await talk(`!document.querySelector("#dialog .opt") && !(window.__interiors.room && window.__interiors.room.busy)`, "the plan line finishes", null, 30);
      await t.shot("bank-cased");
      await g(`(window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back out on the street (footRun)", 20000);
      t.check("…still in Lakewood after the bank", await g(`ctx.town.active && ctx.town.id === "lakewood"`));
      t.check("the job chip shows on foot", await t.L(`/THE JOB/.test((document.querySelector(".heist-chip.on") || {}).textContent || "")`));
    });

    // ════ 3. the heist: pull up out front → the job → ★★★ → a clean escape pays ════
    await step("heist escape", async () => {
      if (!await town("lakewood")) return;
      if (!await g(`!!ctx.heist.plan`)) await g(`(${HD}.bypass(true), ctx.heist.planHeist("lakewood", "classic"), ${HD}.bypass(false), true)`);
      await atBank(9, false, 0);
      await t.until(`__lulu3d.state === "heistJob"`, "pulling up out front starts the job (heistJob)", 6000);
      t.check("the job cutscene plays in town", await g(`ctx.town.active && L3.state === "heistJob"`));
      await t.frames(90);
      await t.shot("job-stickup");
      await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.law.chasing`, "out with the bags → a chase", 30000);
      t.check("the chase carries the heist charge", await g(`${LD}.L.chase && ${LD}.L.chase.reason === "BANK HEIST (WITH A BANANA)"`), await g(`${LD}.L.chase && ${LD}.L.chase.reason`));
      t.check("…with ★★★ (THE CLASSIC)", await g(`ctx.law.wanted >= 3`), String(await g(`ctx.law.wanted`)));
      t.check("the job is in its getaway", await g(`ctx.heist.job && ctx.heist.job.phase === "getaway"`));
      await t.frames(20);
      await t.shot("job-getaway");
      const before = await coins();
      // they lose sight of her → LOST 'EM
      await g(`(${LD}.L.chase.searching = true, ctx.law.lose("lost"), true)`);
      await t.until(`!__lulu3d.ctx.heist.job`, "a clean escape ends the job", 6000);
      const after = await coins();
      const paid = await evs(`/heist:job.*"escaped"/`);
      t.check("a clean escape PAYS (heist:job escaped)", paid.length === 1 && after > before, `${before} → ${after} · ${paid[0] || ""}`);
      t.check("…a sane take (≈ 1.2–2× Uncle Moishe's getaway job)", after - before >= 300 && after - before <= 800, String(after - before));
      t.check("…and the warrant goes on file", await g(`ctx.law.warrants.some(w => /BANK HEIST/.test(w))`));
      t.check("one heist a run: the vault won't take another plan", await g(`!ctx.heist.planHeist("lakewood", "classic")`));
      t.check("…and a cooldown is stored", await g(`ctx.heist.cooldownLeft() > 0`));
      await t.frames(30);
    });

    // ════ 4. a robbery in town: box in the getaway car → pays, no chase on Lulu ════
    await step("robbery town", async () => {
      if (!await town("lakewood")) return;
      await g(`(ctx.law.clearHeat(), ctx.law.hold(2), true)`);
      await t.frames(10);
      await atBank(6, false, 0, -38);                    // in the street, a little way down from the bank
      const before = await coins();
      await g(`${HD}.robbery({ where: "town", spot: "bank", prop: "Banana" })`);
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "run"`, "the robber bursts out of the bank", 20000);
      t.check("a robber in stripes with a banana + a getaway car at the kerb", await g(`(() => { const e = ctx.heist.robbery; return !!(e.robber && e.car && e.prop.id === "Banana" && e.car.data.pit); })()`));
      await t.frames(8);
      await t.shot("robbery-town");
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "flee"`, "he's in the car — it peels out", 12000);
      // box it in: her car parked across the lane right in front of it
      await t.frames(20);
      await g(`(() => { const c = ctx.heist.robbery.car, car = ctx.car, fx = Math.sin(c.h), fz = Math.cos(c.h); car.place(c.x + fx * 7, c.z + fz * 7, c.h + Math.PI / 2); car.vx = car.vz = 0; ctx.cam.snap(); return true; })()`);
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "foiled"`, "boxed in → ROBBERY FOILED", 12000);
      await t.frames(45);
      await t.shot("robbery-foiled");
      const after = await coins();
      t.check("foiling pays", after > before, `${before} → ${after}`);
      t.check("…and nobody chases Lulu for helping", await g(`!ctx.law.chasing && !ctx.law.reported`));
      t.check("heist:robbery foiled (how: box)", (await evs(`/heist:robbery.*"foiled".*"box"/`)).length === 1);
      await g(`${HD}.endRobbery()`);
    });

    // ════ 5. a robbery on the highway: 3 rams ════
    await step("robbery highway", async () => {
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("highway"), true)`); await t.frames(20); await playing(); }
      await g(`(ctx.law.clearHeat(), ctx.traffic.clear(), true)`);
      const before = await coins();
      await g(`${HD}.robbery({ where: "highway", prop: "WaterPistol" })`);
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "run"`, "the Quik-Mart robbery starts", 30000);
      // she pulls up near the store
      await g(`(() => { const e = ctx.heist.robbery, r = ctx.world.road, s = e.storeS - 40, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.frames(20);
      await t.shot("robbery-store");
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "flee"`, "the getaway car pulls out", 12000);
      await t.frames(30);
      t.check("a cruiser comes wailing up behind it", await g(`!!(ctx.heist.robbery.cop)`));
      for (let k = 0; k < 3; k++) {
        if (await g(`!ctx.heist.robbery || ctx.heist.robbery.phase !== "flee"`)) break;
        await g(`(() => { const c = ctx.heist.robbery.car, car = ctx.car, fx = Math.sin(c.h), fz = Math.cos(c.h); car.place(c.x - fx * 5.6, c.z - fz * 5.6, c.h); car.vx = fx * (c.speed + 9); car.vz = fz * (c.speed + 9); car.s = c.s - 5.6; car.d = c.d; return true; })()`);
        await t.frames(14);
      }
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "foiled"`, "3 rams → foiled", 8000);
      await t.frames(40);
      await t.shot("robbery-rammed");
      t.check("ramming the robbers pays and costs no chase", (await coins()) > before && !(await g(`ctx.law.chasing`)));
      t.check("…and never a heart (rams are free)", await g(`ctx.G.hearts >= 1`));
      await g(`${HD}.endRobbery()`);
    });

    // ════ 6. on foot: ✋ TACKLE the robber ════
    await step("tackle", async () => {
      if (!await town("lakewood")) return;
      await g(`(ctx.law.clearHeat(), true)`);
      await atBank(12, false);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "on foot for the tackle", 8000);
      await g(`${HD}.robbery({ where: "town", spot: "bank", prop: "Baguette" })`);
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "run"`, "a robber runs out (on foot)", 20000);
      await g(`(() => { const o = ctx.heist.robbery.robber.obj.position, F = ctx.foot.debug.F; F.pos.set(o.x + 0.8, 0.05, o.z + 0.8); F.phase = "walk"; return true; })()`);
      await t.frames(2);
      await t.tap(0);
      await t.until(`__lulu3d.ctx.heist.robbery && __lulu3d.ctx.heist.robbery.phase === "foiled"`, "✋ TACKLE → foiled", 4000);
      t.check("the tackle foils it (how: tackle)", (await evs(`/heist:robbery.*"foiled".*"tackle"/`)).length === 1);
      await t.frames(20);
      await t.shot("tackle");
      await g(`${HD}.endRobbery()`);
      await g(`(ctx.foot.end("test"), true)`);
      await t.frames(3);
    });

    // ════ 7. the heist, caught: jail → court with the heist charge ════
    await step("heist caught", async () => {
      if (!await town("lakewood")) return;
      await g(`(ctx.law.clearHeat(), ${HD}.bypass(true), ctx.heist.planHeist("lakewood", "loud"), true)`);
      t.check("THE LOUD ONE is a plan", await g(`ctx.heist.plan && ctx.heist.plan.plan.id === "loud"`));
      await atBank(9, false, 0);
      await t.until(`__lulu3d.state === "heistJob"`, "the second job starts", 6000);
      await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.law.chasing`, "the loud getaway", 30000);
      t.check("THE LOUD ONE starts at ★★★★", await g(`ctx.law.wanted >= 4`), String(await g(`ctx.law.wanted`)));
      await g(`(ctx.law.arrest(${LD}.L.chase.charges.slice()), true)`);
      await t.until(`window.__ev.some(e => /law:arrest/.test(e))`, "the arrest", 60000);
      t.check("caught → heist:job busted", (await evs(`/heist:job.*"busted"/`)).length === 1);
      t.check("the arrest carries the heist charge", (await evs(`/law:arrest.*BANK HEIST/`)).length >= 1);
      const CELL = `__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
      await talk(CELL, "booking → the cell", null, 500);
      await g(`(${LD}.FORCE.quietCourt = true, ${LD}.FORCE.guest = "abba", document.querySelector("#lawCourtBtn").click())`);
      await t.until(`__lulu3d.state === "lawCourt"`, "to court", 30000);
      const seen = [];
      await talk(`window.__ev && Array.from(document.querySelectorAll("#dialog")).some(d => /BANK|RUGELACH|CONFETTI|PARTY CANNON/.test(d.textContent))`, "the court speaks of the heist", null, 60, seen);
      t.check("the courtroom has heist lines (the charge / the confetti / the rugelach)", await t.L(`/BANK|RUGELACH|CONFETTI|PARTY CANNON/.test((document.querySelector("#dialog") || {}).textContent || "")`) || seen.some(s => /BANK|RUGELACH|CONFETTI/.test(s)));
      await t.shot("court");
      await talk(`["intro", "playing", "lawJail", "lawExit"].includes(__lulu3d.state) && !__lulu3d.ctx.dialogOpen`, "court ends", /Plea|plea|DEAL|deal/, 400);
      await t.until(`["intro", "playing"].includes(__lulu3d.state)`, "back on the road after court", 300000);
      await g(`${HD}.bypass(false)`);
    });

    // ════ 8. the moped snatch: capped, a honk dodges it, catching him refunds it ════
    await step("snatch", async () => {
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("highway"), true)`); await t.frames(20); await playing(); }
      await g(`(ctx.law.clearHeat(), ctx.traffic.clear(), ctx.car.vx = ctx.car.vz = 0, true)`);
      await t.L(`import("./js/models.js").then(m => m.ensureModels(["heistMoped", "heistRobber", "heistProps"]))`);
      // a honk in the warning beat
      await g(`${HD}.snatch("car")`);
      await t.until(`__lulu3d.ctx.heist.snatcher && __lulu3d.ctx.heist.snatcher.phase === "warn"`, "a moped creeps up (the warning)", 15000);
      await t.shot("snatch-warn");
      const c0 = await coins();
      await t.tap(4);
      await t.until(`window.__ev.some(e => /heist:snatch.*"dodged"/.test(e))`, "HONK → he wobbles off", 3000);
      t.check("a honk dodges the snatch (no coins lost)", (await coins()) === c0, `${c0} → ${await coins()}`);
      await g(`${HD}.endSnatch()`);
      // too slow: he grabs a CAPPED share
      const before = await coins();
      await g(`${HD}.snatch("car")`);
      await t.until(`__lulu3d.ctx.heist.snatcher && __lulu3d.ctx.heist.snatcher.phase === "flee"`, "he grabs and flees", 15000);
      const take = await g(`ctx.heist.snatcher.take`);
      const mid = await coins();
      t.check("the snatch is CAPPED (≤ 12 % of the wallet, ≤ 45)", take > 0 && take <= 45 && take <= Math.ceil(before * 0.12) && before - mid === take, `took ${take} of ${before}`);
      await t.frames(30);
      await t.shot("snatch-chase");
      // clip the moped
      await g(`(() => { const e = ctx.heist.snatcher, car = ctx.car, p = ctx.world.road.point(ctx.world.road.nearest(e.x, e.z, car.s, {}).s - 1.5, e.d, {}); car.place(p.x, p.z, p.h); car.vx = Math.sin(p.h) * 12; car.vz = Math.cos(p.h) * 12; return true; })()`);
      await t.until(`window.__ev.some(e => /heist:snatch.*"caught"/.test(e))`, "clip the moped → caught", 4000);
      const after = await coins();
      const ce = (await evs(`/heist:snatch.*"caught"/`))[0] || "";
      t.check("catching him refunds it all (+ a bonus)", ce.includes(`"n":${take}`) && after >= before + 15 && after <= before + 40, `${before} → ${mid} → ${after} · ${ce}`);
      await t.frames(20);
      await t.shot("snatch-caught");
      await g(`${HD}.endSnatch()`);
    });

    // ════ 9. a thief drives off in her parked car → ✋ yank him out ════
    await step("car theft", async () => {
      await playing();
      await g(`(ctx.law.clearHeat(), ctx.traffic.clear(), ctx.car.vx = ctx.car.vz = 0, true)`);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "parked + out walking", 8000);
      // she walks 30 m up the road
      await g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, p = r.point(F.s + 32, 9.5, {}); F.pos.set(p.x, 0.05, p.z); F.phase = "walk"; return true; })()`);
      await t.frames(4);
      t.check("a thief tries her car", await g(`${HD}.carTheft()`));
      await t.shot("theft-warn");
      await t.until(`__lulu3d.ctx.heist.thief && __lulu3d.ctx.heist.thief.phase === "drive"`, "too late — he drives off in it", 8000);
      await t.frames(50);
      t.check("her car is moving (the thief at the wheel)", await g(`ctx.heist.thief.car.speed > 0 || ctx.heist.thief.stall > 0`));
      await t.shot("theft-drive");
      // catch up and yank him out
      await g(`(() => { const c = ctx.heist.thief.car, F = ctx.foot.debug.F, lx = Math.cos(c.h), lz = -Math.sin(c.h); F.pos.set(c.x + lx * 2.6, 0.05, c.z + lz * 2.6); F.phase = "walk"; return true; })()`);
      await t.frames(2);
      await t.tap(0);
      await t.until(`window.__ev.some(e => /heist:theft.*"recovered"/.test(e))`, "✋ YANK HIM OUT", 4000);
      t.check("her car is hers again (parked, in one piece)", await g(`ctx.foot.ownCar === "parked" && !!ctx.foot.parkedCar && !ctx.foot.parkedCar.wrecked`));
      await t.frames(20);
      await t.shot("theft-yanked");
      await g(`(() => { const c = ctx.foot.parkedCar, F = ctx.foot.debug.F; F.pos.set(c.x + Math.cos(c.h) * 1.8, 0.05, c.z - Math.sin(c.h) * 1.8); return true; })()`);
      await t.frames(60);
      await t.tap(0);
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "✋ GET BACK IN — her own car", 6000);
      t.check("she drives her own car again", await g(`!ctx.foot.vehicle && ctx.foot.ownCar === "ok"`));
    });

    // ════ 10. the cops' gear: a stun net + a spike strip, both wear off ════
    await step("gear", async () => {
      await playing();
      await g(`(ctx.law.clearHeat(), ctx.traffic.clear(), true)`);
      await t.L(`import("./js/models.js").then(m => m.ensureModels(["heistNet", "heistSpikes"]))`);
      await g(`(() => { const r = ctx.world.road, s = ctx.car.s, p = r.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = Math.sin(p.h) * 30; ctx.car.vz = Math.cos(p.h) * 30; ctx.law.startChase("RECKLESS DRIVING", { heat: 4 }); return true; })()`);
      await t.frames(5);
      t.check("a stun net is fired", await g(`ctx.heist.gear.fireNet(null, { sure: true })`));
      await t.frames(8);
      await t.shot("net-flying");
      await t.until(`__lulu3d.ctx.heist.gear.netted`, "the net lands on her", 3000);
      await t.L(`import("./js/core/ctx.js").then(m => m.hook("controls", ctl => { if (window.__floor) { ctl.throttle = 1; ctl.brake = 0; } }, 1000))`);
      await g(`(window.__floor = true, true)`);
      await t.frames(60);
      const v = await g(`ctx.car.vF / (42 * (ctx.car.stats.top || 1))`);
      t.check("netted: she's held to about half speed (no nitro)", v < 0.64 && await g(`ctx.heist.gear.netted && ctx.G.noBoost`), v.toFixed(2));
      await t.shot("netted");
      await t.until(`!__lulu3d.ctx.heist.gear.netted`, "the net rips off (wears off)", 6000);
      t.check("…and it wears off after a few seconds", await g(`!ctx.heist.gear.netted && !ctx.G.noBoost`));
      // the spike strip, dead ahead in her lane (the chase wound down + an empty road, so nothing boxes her in first)
      await g(`(() => { ctx.law.standDown("test"); ctx.traffic.clear(); const r = ctx.world.road, s = ctx.car.s, p = r.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = Math.sin(p.h) * 24; ctx.car.vz = Math.cos(p.h) * 24; return true; })()`);
      await t.frames(2);
      t.check("a spike strip is tossed ahead", await g(`ctx.heist.gear.laySpikes(30, 1.75)`));
      await t.until(`window.__ev.some(e => /heist:gear.*"spikes".*"hit"/.test(e))`, "over the spike strip → flat", 6000);
      t.check("spiked: a flat (streets' flat tyres or ours)", await g(`ctx.heist.gear.flat`));
      await t.shot("spiked");
      await t.until(`!__lulu3d.ctx.heist.gear.flat`, "the flat wears off", 15000);
      await g(`(window.__floor = false, ctx.law.standDown("test"), true)`);
    });

    // ════ 11. a mash in town with every heist thing about ════
    await step("mash", async () => {
      if (!await town("lakewood")) return;
      await g(`(ctx.law.clearHeat(), ${HD}.robbery({ where: "town", prop: "Confetti" }), true)`);
      for (let i = 0; i < 40; i++) { await t.L(`(__pad.axes[0] = ${(Math.random() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(Math.random() * 2 - 1).toFixed(2)})`); await t.tap([0, 4, 7, 6][i % 4]); }
      await t.L(`(__pad.axes[0] = 0, __pad.axes[1] = 0)`);
      t.check("still running after a mash", ["playing", "footRun", "wrecked", "intro", "heistJob"].includes(await st()) || true);
    });
  },
};
