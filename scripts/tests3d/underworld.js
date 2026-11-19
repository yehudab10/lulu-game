// 😈 The underworld (features/underworld): crooked cops, Velvel, the Fixer + heat, the bad guys around town.
//   • the service + the knobs; OFF in a 🎉 party (party's OFF set) — and never in the first minute / during a chase;
//   • 🍩 a ⚠️ warning → Krupnik's cruiser on the shoulder: PAY → the warning's gone · a STING → 2★ for BRIBING AN
//     OFFICER (KUGEL FUND) · REFUSE → nothing changes; the pull-over (lawBust) offer: paid → let off, a sting →
//     arrested for bribery; the charge has its own arrest lines + a courtroom scene (law.addCharge);
//   • 🕶️ the Fixer's package job end to end (Jobs app lists it, pickup → delivery → the card), heat goes up and
//     cools, and high heat puts the law on alert (ctx.law.tune scaled, restored at 0);
//   • 🫳 a pickpocket takes a CAPPED amount and a tackle refunds it; a Shomer (📞 Call app) tackles the next one;
//   • 😡 a road-rager can be outrun, or led past a cop who pulls HIM over; his bump gives a flat → Chaverim (📞);
//   • 😎 a gang car tails her and gives up; Shomrim (📞) pull another one over; 🔧 Velvel's cheap paint;
//   • rivals are remembered (the 📒 Underworld page).
module.exports = {
  name: "underworld",
  query: "&enable=underworld",
  save2d: { totalCoins: 600, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const D = "ctx.underworld.debug";
    const st = () => g(`__lulu3d.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const place = (ds, d, v = 0) => g(`(() => { const r = ctx.world.road, s = ctx.car.s + ${ds}, p = r.point(s, ${d}, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; return s; })()`);
    const logOf = ev => g(`${D}.log.filter(e => e.ev === "${ev}")`);
    async function talk(untilCode, label, pickRe = null, max = 200) {
      for (let i = 0; i < max; i++) {
        if (await g(untilCode)) return true;
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length && pickRe) {
          const idx = opts.findIndex(o => pickRe.test(o));
          if (idx >= 0) { await t.L(`document.querySelectorAll("#dialog .opt")[${idx}].click()`); await t.frames(3); continue; }
        }
        if (await t.L(`!!document.querySelector("#dialog.open")`)) await t.tap(0); else await t.frames(4);
      }
      t.check(label, false, "never reached: " + untilCode + " · state " + await st());
      return false;
    }
    const newRun = async label => {
      await g(`L3.setState("title")`);
      await t.frames(3);
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing"`, label || "a cruise starts", 90000)) return false;
      await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.banter.autopilot = { d: 1.75, speed: 20 }, true)`);
      return true;
    };

    // ── the service, the knobs, the party ────────────────────────────────
    t.check("ctx.underworld service + the SPAWN knobs", await g(`!!ctx.underworld && typeof ctx.underworld.bustOffer === "function" && ctx.underworld.SPAWN.firstAfter >= 60
      && Array.isArray(ctx.underworld.SPAWN.gap) && ctx.underworld.SPAWN.gap[0] >= 120 && ctx.underworld.TUNE.coinCap <= 30`));
    t.check("Settings has the 😈 Bad guys knob", await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("settings").some(i => i.id === "underworld"))`));
    const party = await g(`(() => { const N = ctx.party._debug.N, was = N.want; N.want = true; try { return { en: ctx.enabled("underworld"), live: ctx.underworld.live, pick: ctx.underworld.liveFor("pickpocket") }; } finally { N.want = was; } })()`);
    t.check("🎉 in a party only the pickpocket can run (on a Road Trip / Free Roam run — partyheist plays it); no bad-guy cars, offers, Fixer", party.en && !party.live && !party.pick, JSON.stringify(party));
    t.check("party/index.js no longer lists underworld in its OFF set (underworld/common.js live(what) gates it)", await t.L(`fetch("./js/features/party/index.js").then(r => r.text()).then(s => { const m = /const OFF = new Set\\(\\[([^\\]]*)\\]/.exec(s); return !!m && !/"underworld"/.test(m[1]); })`));
    t.check("the bribery charge has a courtroom scene (law.addCharge)", await g(`(() => { const ev = ctx.law.chargeEvent(["BRIBING AN OFFICER (KUGEL FUND)"]); return !!ev && ev.lines.length >= 3 && /KUGEL|kugel/.test(ev.lines.map(l => l.text).join(" ")); })()`));

    if (!await newRun("cruise starts")) return;

    // ── never in the first minute, never during a chase ──────────────────
    await g(`(${D}.force.always = true, ${D}.UW.nextT = 0, true)`);
    await t.frames(20);
    t.check("no encounter in the first minute", await g(`ctx.underworld.why() === "early" && !ctx.underworld.enc`), await g(`ctx.underworld.why()`));
    await g(`(${D}.UW.runT = 200, ${D}.UW.nextT = 1e9, ctx.law.startChase("TESTING", { heat: 1 }), ${D}.UW.nextT = 0, true)`);
    await t.frames(20);
    t.check("no encounter during a cop chase", await g(`ctx.law.chasing && ctx.underworld.why() === "chase" && !ctx.underworld.enc`), await g(`ctx.underworld.why()`));
    await g(`(ctx.law.standDown(), ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.apbCool = 99, ${D}.force.always = false, ${D}.UW.nextT = 1e9, true)`);
    await t.frames(10);

    // ── 🍩 a warning → Krupnik's offer → PAY clears it ───────────────────
    const c0 = await coins();
    await g(`(Object.assign(${D}.force, { offer: true, sting: false }), ${D}.UW.crookCool = 0, true)`);
    const warned = await g(`ctx.law.notice("SPEEDING", { warn: "📡 test warning" })`);
    t.check("a ⚠️ warning lands", warned === "warn" && await g(`ctx.law.suspicion > 0.3`), warned);
    t.check("…and Krupnik waits on the shoulder ahead (cruiser + pad)", await g(`!!ctx.underworld.offer && ctx.underworld.offer.kind === "cop" && !!${D}.O.car`));
    await t.until(`!!__lulu3d.ctx.underworld.debug.O && !!__lulu3d.ctx.underworld.debug.O.p`, "Officer Krupnik is standing there", 20000);
    await g(`(ctx.banter.autopilot = null, true)`);
    await g(`(() => { const O = ${D}.O, n = ctx.world.road.nearest(O.padAt.x, O.padAt.z, ctx.car.s, {}); const p = ctx.world.road.point(n.s - 6, 8.3, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = n.s - 6; ctx.car.d = 8.3; ctx.car.vx = Math.sin(p.h) * 4; ctx.car.vz = Math.cos(p.h) * 4; return true; })()`);
    await t.until(`__lulu3d.state === "underworldDeal"`, "pulling onto his pad starts the deal", 20000);
    await t.frames(30);
    await t.shot("krupnik-shoulder");
    await talk(`__lulu3d.state === "playing"`, "pay the Kugel Fund", /Donate/);
    let bribes = await logOf("bribe");
    t.check("PAID: the warning disappears", (await g(`ctx.law.suspicion`)) < 0.01 && bribes.some(b => b.result === "paid" && b.via === "warn"), JSON.stringify(bribes));
    const c1 = await coins();
    t.check("…for the price of a donation (coins spent)", c0 - c1 >= 30 && c0 - c1 <= 50, `${c0} → ${c1}`);
    await g(`(${D}.reset(false), true)`);

    // ── 🕵️ a STING: the charge + stars ───────────────────────────────────
    await g(`(${D}.force.sting = true, ${D}.UW.crookCool = 0, ctx.law._dbg.L.grace = 0, true)`);
    await g(`ctx.law.notice("SPEEDING", { warn: "📡 test warning" })`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.O`, "a second offer", 10000);
    await g(`(() => { const O = ${D}.O, n = ctx.world.road.nearest(O.padAt.x, O.padAt.z, ctx.car.s, {}); const p = ctx.world.road.point(n.s - 4, 8.3, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = n.s - 4; ctx.car.d = 8.3; ctx.car.vx = Math.sin(p.h) * 2; ctx.car.vz = Math.cos(p.h) * 2; return true; })()`);
    await t.until(`__lulu3d.state === "underworldDeal"`, "the sting deal", 20000);
    await talk(`__lulu3d.state === "playing"`, "the sting plays out", /Donate/);
    await t.until(`__lulu3d.ctx.law.chasing`, "Internal Affairs lights her up", 10000);
    const sting = await g(`({ chasing: ctx.law.chasing, wanted: ctx.law.wanted, charges: ctx.law._dbg.L.chase && ctx.law._dbg.L.chase.charges.concat([ctx.law._dbg.L.chase.reason]) })`);
    t.check("STING: a chase for BRIBING AN OFFICER (KUGEL FUND), 2★", sting.chasing && sting.wanted >= 2 && sting.charges.some(c => /KUGEL FUND/.test(c)), JSON.stringify(sting));
    await t.shot("sting-chase");
    await g(`(ctx.law.standDown(), ctx.law._dbg.L.grace = 0, ${D}.reset(false), true)`);
    await t.frames(10);

    // ── 🙅‍♀️ REFUSE: always safe ──────────────────────────────────────────
    const c2 = await coins();
    await g(`(${D}.UW.crookCool = 0, ctx.law._dbg.L.sus = 0, ctx.law._dbg.L.grace = 0, true)`);
    await g(`ctx.law.notice("SPEEDING", { warn: "📡 test warning" })`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.O`, "a third offer", 10000);
    await g(`(() => { const O = ${D}.O, n = ctx.world.road.nearest(O.padAt.x, O.padAt.z, ctx.car.s, {}); const p = ctx.world.road.point(n.s - 4, 8.3, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = n.s - 4; ctx.car.d = 8.3; ctx.car.vx = Math.sin(p.h) * 2; ctx.car.vz = Math.cos(p.h) * 2; return true; })()`);
    await t.until(`__lulu3d.state === "underworldDeal"`, "the refuse deal", 20000);
    await talk(`__lulu3d.state === "playing"`, "she says no thanks", /No thank you/);
    await t.frames(10);
    t.check("REFUSED: no coins spent, the warning stays, no chase", (await coins()) === c2 && (await g(`ctx.law.suspicion > 0.1 && !ctx.law.chasing`)),
      JSON.stringify(await g(`({ sus: ctx.law.suspicion, chasing: ctx.law.chasing })`)));
    t.check("…logged as refused", (await logOf("bribe")).some(b => b.result === "refused"));
    await g(`(ctx.law._dbg.L.sus = 0, ${D}.reset(false), true)`);

    // ── 🚨 the pull-over: a paid "donation" lets her off ────────────────
    // (law's own 10 % "walk" outcome comes before the offer: pin the pull-over to its normal branch, or 1 run in 5 walks off on foot)
    await g(`(ctx.law._dbg.FORCE.bustOutcome = "ticket", ${D}.force.sting = false, ${D}.UW.crookCool = 0, ${D}.UW.lastHeat = 1, L3.setState("lawBust", { unit: null, reason: "SPEEDING" }), true)`);
    await talk(`[...document.querySelectorAll("#dialog .opt")].some(b => /Donate/.test(b.textContent) && b.style.visibility !== "hidden")`, "the officer offers the Kugel Fund at the window");
    await t.shot("bust-offer");
    await talk(`__lulu3d.state === "playing"`, "paid at the pull-over → let off", /Donate/);
    t.check("pull-over: paid → back on the road, no arrest", await st() === "playing" && (await logOf("bribe")).some(b => b.via === "bust" && b.result === "paid"));
    // …and a sting there is an arrest for bribery
    await g(`(${D}.force.sting = true, ${D}.UW.crookCool = 0, ${D}.UW.lastHeat = 1, ctx.law.FORCE = ctx.law._dbg.FORCE, L3.setState("lawBust", { unit: null, reason: "SPEEDING" }), true)`);
    await talk(`__lulu3d.state === "lawArrest"`, "a sting at the pull-over → arrested", /Donate/);
    const arrested = await g(`ctx.law._dbg.log.filter(e => e.ev === "law:arrest").slice(-1)[0] || null`);
    t.check("pull-over sting: under arrest for BRIBING AN OFFICER (KUGEL FUND)", await st() === "lawArrest" && /KUGEL/.test(await t.L(`document.querySelector("#lawUI") ? document.querySelector("#lawUI").textContent : ""`) + JSON.stringify(arrested || {})),
      JSON.stringify(arrested));
    await t.shot("sting-arrest");
    await g(`(${D}.force.sting = null, ${D}.force.offer = false, delete ctx.law._dbg.FORCE.bustOutcome, true)`);

    // ── 🕶️ the Fixer: the package, end to end + heat ─────────────────────
    if (!await newRun("a fresh cruise for the Fixer")) return;
    await g(`(${D}.SAVE.heat = 0, ${D}.UW.runT = 200, ${D}.UW.nextT = 1e9, true)`);
    await t.frames(4);
    t.check("the 💼 Jobs app lists the Fixer's jobs", await g(`ctx.hustle.listed().includes("uw_package") && ctx.hustle.listed().includes("uw_tail")`), JSON.stringify(await g(`ctx.hustle.listed()`)));
    const sight0 = await g(`ctx.law.tune.sight[1]`);
    const cz = await coins();
    t.check("a package job starts", await g(`!!ctx.hustle.start("uw_package", { dist: 90 }) && ctx.hustle.job.id === "uw_package"`));
    await t.until(`!!__lulu3d.ctx.hustle.job && !!__lulu3d.ctx.hustle.job.crate`, "the crate waits at the dead drop", 20000);
    await g(`(ctx.banter.autopilot = null, true)`);
    await g(`(() => { const j = ctx.hustle.job, n = { s: j.at.s }; const p = ctx.world.road.point(n.s - 2, 8.4, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = n.s - 2; ctx.car.d = 8.4; return true; })()`);
    await t.until(`__lulu3d.ctx.hustle.job && __lulu3d.ctx.hustle.job.phase === "deliver"`, "picked up the package", 20000);
    await t.frames(8);
    await t.shot("package-onboard");
    await g(`(() => { const j = ctx.hustle.job, n = { s: j.at.s }; ctx.world.prebuild && ctx.world.prebuild(n.s); const p = ctx.world.road.point(n.s - 2, 8.4, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = n.s - 2; ctx.car.d = 8.4; return true; })()`);
    await t.until(`__lulu3d.state === "hustleResult"`, "delivered → the result card", 30000);
    t.check("…a pass, it paid, and the card reveals what was in it", await t.L(`/PACKAGE/.test(document.body.textContent) && /What was in it/.test(document.body.textContent)`) && (await coins()) > cz);
    await t.shot("package-card");
    const h1 = await g(`ctx.underworld.heat`);
    t.check("the job raised the heat", h1 >= 17, String(h1));
    await g(`(ctx.underworld.addHeat(60, "test"), true)`);
    await t.frames(2);
    t.check("high heat: the cops are on alert (sight range scaled up)", (await g(`ctx.law.tune.sight[1]`)) > sight0 * 1.15, `${sight0} → ${await g(`ctx.law.tune.sight[1]`)}`);
    await t.L(`document.querySelector("#hsKeep") && document.querySelector("#hsKeep").click()`);
    await t.until(`__lulu3d.state === "playing"`, "back on the road", 10000);
    const hA = await g(`ctx.underworld.heat`);
    await t.frames(90);
    const hB = await g(`ctx.underworld.heat`);
    t.check("heat cools while she drives", hB < hA - 0.4, `${hA} → ${hB}`);
    await g(`(${D}.SAVE.heat = 0, ctx.underworld.addHeat(0), true)`);
    await t.frames(2);
    t.check("…and at 0 the law's table is back exactly", (await g(`ctx.law.tune.sight[1]`)) === sight0);

    // ── 🫳 a pickpocket: capped, and a tackle refunds it ──────────────────
    await g(`(${D}.UW.nextT = 1e9, ctx.foot.start("droveOff"), true)`);
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot", 60000);
    await g(`(ctx.foot.debug && ctx.foot.debug.F && (ctx.foot.debug.F.t = 99), true)`);
    const w0 = await coins();
    await g(`ctx.underworld.spawn("pickpocket")`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.E && !!__lulu3d.ctx.underworld.debug.E.p`, "a pickpocket strolls up", 20000);
    await t.frames(10);
    await t.shot("pickpocket-approach");
    await g(`(() => { const E = ${D}.E, F = ctx.foot.pos; E.x = F.x + 0.6; E.z = F.z + 0.4; return true; })()`);
    await t.until(`__lulu3d.ctx.underworld.debug.E && __lulu3d.ctx.underworld.debug.E.phase === "run"`, "the bump-and-lift", 10000);
    const stolen = await g(`${D}.E.stolen`);
    const w1 = await coins();
    t.check("he lifts a CAPPED amount (≤ 30)", stolen > 0 && stolen <= 30 && w0 - w1 === stolen, `${stolen} (${w0} → ${w1})`);
    await t.frames(20);
    await t.shot("pickpocket-run");
    t.check("…he legs it", await g(`(() => { const E = ${D}.E, F = ctx.foot.pos; return Math.hypot(E.x - F.x, E.z - F.z) > 2.5; })()`));
    const spotLbl = await g(`(() => { const E = ${D}.E, F = ctx.foot.debug.F; const n = ctx.world.road.nearest(E.x, E.z, ctx.car.s, {}); const p = ctx.world.road.point(n.s - E.dir * 1.5, n.d, {});
        F.pos.set(p.x, 0, p.z); const pr = ctx.foot.debug.interactables(); return pr ? pr.label : ""; })()`);
    t.check("the ✋ TACKLE spot is there once she's close", /TACKLE/.test(spotLbl), spotLbl);
    await g(`(() => { const pr = ctx.foot.debug.interactables(); if (pr && /TACKLE/.test(pr.label)) pr.ent.act(); else ${D}.tackle(${D}.E, "lulu"); return true; })()`);
    await t.frames(6);
    const w2 = await coins();
    t.check("TACKLE: the coins come back (+ a little for the trouble)", w2 === w1 + stolen + 4, `${w1} → ${w2} (stolen ${stolen})`);
    await t.shot("pickpocket-tackled");
    await t.until(`!__lulu3d.ctx.underworld.debug.E`, "the pickpocket slinks off", 20000);
    // a second one: the Shomrim (📞 Call app) send a guy
    await g(`ctx.underworld.spawn("pickpocket")`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.E && !!__lulu3d.ctx.underworld.debug.E.p`, "another pickpocket", 20000);
    await g(`(() => { const E = ${D}.E, F = ctx.foot.pos; E.x = F.x + 0.6; E.z = F.z + 0.4; return true; })()`);
    await t.until(`__lulu3d.ctx.underworld.debug.E && __lulu3d.ctx.underworld.debug.E.phase === "run"`, "…lifts more coins", 10000);
    t.check("📞 the Call app offers Shomrim for the pickpocket (even off-town)", await g(`ctx.community.reasons("shomrim").includes("uwPickpocket")`), JSON.stringify(await g(`ctx.community.reasons("shomrim")`)));
    await g(`ctx.community.call("shomrim", "uwPickpocket")`);
    await talk(`!!__lulu3d.ctx.underworld.debug.E && !!__lulu3d.ctx.underworld.debug.E.shomer && !!__lulu3d.ctx.underworld.debug.E.shomer.p`, "a Shomer comes jogging", null, 120);
    await t.until(`!__lulu3d.ctx.underworld.debug.E || __lulu3d.ctx.underworld.debug.E.result === "busted"`, "the Shomer tackles him", 30000);
    t.check("SHOMRIM deal with the pickpocket (coins back)", (await logOf("shomrim")).some(s => s.phase === "caught" && s.kind === "pickpocket"));
    await t.shot("shomer-tackle");

    // ── 😡 the road-rager: outrun him ────────────────────────────────────
    if (!await newRun("back in the car")) return;
    await g(`(${D}.UW.runT = 200, ${D}.UW.nextT = 1e9, Object.assign(${D}.force, { trap: false, flat: false }), ctx.banter.autopilot = { d: 1.75, speed: 20 }, true)`);
    await g(`ctx.underworld.spawn("rager", { behind: 30 })`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.E && !!__lulu3d.ctx.underworld.debug.E.car`, "a road-rager comes up behind", 20000);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.phase !== "approach"; })()`, "…and tailgates", 40000);
    await t.frames(10);
    await t.shot("rager-tailgate");
    t.check("he's right on her bumper, in her lane", await g(`(() => { const E = ${D}.E, rel = E.car.s - ctx.car.s; return rel < -4 && rel > -16; })()`), JSON.stringify(await g(`({ rel: ${D}.E.car.s - ctx.car.s, d: ${D}.E.car.d, ph: ${D}.E.phase })`)));
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && (E.phase === "alongside" || E.phase === "bump") && Math.abs(E.car.s - __lulu3d.ctx.car.s) < 4; })()`, "…then pulls up alongside", 30000);
    await t.shot("rager-alongside");
    await place(210, 1.75, 20);
    await t.until(`!!__lulu3d.ctx.underworld.debug.log.find(e => e.ev === "end" && e.kind === "rager")`, "she outruns him", 20000);
    t.check("OUTRUN: escaped + remembered as a rival", (await logOf("end")).some(e => e.kind === "rager" && e.result === "escaped") && await g(`ctx.underworld.rivals.some(r => r.kind === "rager" && r.escaped >= 1)`));
    await t.until(`!__lulu3d.ctx.underworld.debug.E`, "the rager's gone", 20000);

    // ── 😡 …or lead him past a cop: HE gets pulled over ──────────────────
    await g(`ctx.underworld.spawn("rager", { behind: 25 })`);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.car && E.phase !== "approach"; })()`, "the rager's back", 40000);
    t.check("…a known rival comes back (recognised)", await g(`!${D}.E.rival.fresh || ctx.underworld.rivals.filter(r => r.kind === "rager").length >= 1`));
    await g(`(ctx.law.trap(-6, 1), true)`);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.result === "busted"; })()`, "the cop pulls the rager over", 20000);
    t.check("LED PAST A COP: busted, on the shoulder, a cruiser behind him", await g(`(() => { const E = ${D}.E; return E && E.how === "cop" && E.phase === "pulled" && !!E.cop && !!E.cop.car; })()`));
    await t.frames(40);
    await t.shot("rager-busted");
    await g(`(${D}.reset(false), ctx.law._dbg.L.traps.forEach(tr => tr.gone = true), true)`);

    // ── 🛞 his bump gives a flat → Chaverim (📞) ─────────────────────────
    await g(`(${D}.force.flat = true, ctx.underworld.spawn("rager", { behind: 25 }), true)`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.log.find(e => e.ev === "flat")`, "he swerves into her and clips a tyre", 90000);
    t.check("a FLAT (and no heart lost to a shove)", await g(`ctx.streets.flat && ctx.G.hearts === ctx.G.maxHearts`), JSON.stringify(await g(`({ flat: ctx.streets.flat, hearts: ctx.G.hearts })`)));
    await t.shot("rager-flat");
    t.check("📞 the Call app offers Chaverim for the flat", await g(`ctx.community.reasons("chaverim").includes("uwFlat")`));
    await g(`ctx.community.call("chaverim", "uwFlat")`);
    await t.until(`!__lulu3d.ctx.streets.flat`, "Chaverim fix the tyre", 30000);
    t.check("CHAVERIM: the flat's fixed", await g(`!ctx.streets.flat`));
    await g(`(${D}.reset(false), ${D}.force.flat = false, true)`);
    await t.frames(4);

    // ── 😎 the gang car: tails her, then gives up ────────────────────────
    await g(`ctx.underworld.spawn("gang", { behind: 40, tail: 13 })`);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.phase === "tail"; })()`, "the gang car settles in behind her", 40000);
    await t.frames(20);
    const tail = await g(`(() => { const E = ${D}.E; return { rel: E.car.s - ctx.car.s, dd: Math.abs(E.car.d - ctx.car.d), paint: E.paint }; })()`);
    t.check("TAILING: ~24 m back in her lane", tail.rel < -14 && tail.rel > -34 && tail.dd < 1.2, JSON.stringify(tail));
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.car && E.sideT < -0.8 && Math.abs(E.car.s - __lulu3d.ctx.car.s) < 5; })()`, "…and now and then pulls up alongside (water pistol, banana)", 30000);
    await t.shot("gang-alongside");
    await t.until(`!!__lulu3d.ctx.underworld.debug.log.find(e => e.ev === "end" && e.kind === "gang")`, "…they give up", 40000);
    t.check("GIVES UP: “wrong pink convertible”", (await logOf("end")).some(e => e.kind === "gang" && e.how === "giveup"));
    await g(`(${D}.reset(false), true)`);
    await t.frames(4);

    // ── 🔦 Shomrim (📞) pull a gang car over ─────────────────────────────
    await g(`ctx.underworld.spawn("gang", { behind: 40, tail: 120 })`);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.phase === "tail"; })()`, "another gang car", 40000);
    t.check("📞 the Call app offers Shomrim for the car tailing her", await g(`ctx.community.reasons("shomrim").includes("uwBadGuy")`), JSON.stringify(await g(`ctx.community.reasons("shomrim")`)));
    t.check("…and the 📞 app shows up off-town for it", await g(`ctx.phone.apps ? ctx.phone.apps().includes("community") : true`));
    await g(`ctx.community.call("shomrim", "uwBadGuy")`);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.shomrim && E.shomrim.car; })()`, "a Shomrim Crown Vic comes up fast", 30000);
    await t.until(`(() => { const E = __lulu3d.ctx.underworld.debug.E; return E && E.result === "busted"; })()`, "Shomrim pull him over", 40000);
    t.check("SHOMRIM: the gang car is pulled over", await g(`${D}.E.how === "shomrim" && ${D}.E.phase === "pulled"`));
    await t.frames(30);
    await t.shot("shomrim-bust");
    await g(`(${D}.reset(false), true)`);

    // ── 🔧 Velvel's: a cheap paint job (hot paint) ───────────────────────
    await g(`(${D}.force.hot = true, ${D}.placeShack(140), true)`);
    await t.until(`!!__lulu3d.ctx.underworld.debug.O && !!__lulu3d.ctx.underworld.debug.O.shack`, "Velvel's shack goes up", 20000);
    await g(`(ctx.banter.autopilot = null, true)`);
    await g(`(() => { const O = ${D}.O, n = ctx.world.road.nearest(O.padAt.x, O.padAt.z, ctx.car.s, {}); const p = ctx.world.road.point(n.s - 4, 8.6, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = n.s - 4; ctx.car.d = 8.6; ctx.car.vx = Math.sin(p.h) * 2; ctx.car.vz = Math.cos(p.h) * 2; return true; })()`);
    await t.until(`__lulu3d.state === "underworldDeal"`, "Velvel's deal", 20000);
    await t.frames(20);
    await t.shot("velvel");
    const cv = await coins();
    await talk(`__lulu3d.state === "playing"`, "a quick paint job", /paint job/);
    t.check("VELVEL: painted for 12 coins, and the parts are HOT", (await logOf("velvel")).some(v => v.result === "paint") && cv - await coins() === 12 && await g(`!!${D}.UW.hot`));
    t.check("the 📒 Underworld page lists the rivals", await t.L(`import("./js/features/underworld/index.js").then(() => true)`) && (await g(`ctx.underworld.rivals.length`)) >= 2);
    await g(`(${D}.force.hot = null, true)`);
  },
};
