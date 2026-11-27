// 🚗 features/impound — getting an impounded car back (solo, Lakewood), with the QA watchdog on.
//   impounded → the gate's window: pay (the first-time price) → the car rolls out to the kerb → ✋ in → driving, coins down by
//   the fee exactly once · impounded again → City Hall's Permits window (the normal fee) → the slip → the gate → out ·
//   📞 Contacts › City Hall: two taps · can't afford → told, nothing taken, still held — a new run = the car's home ·
//   the break-in: clean (unseen, hotwire) → her car, no fee · seen → Bruno's look → seen again → chase → caught →
//   GRAND THEFT AUTO (HER OWN CAR) in court → out of the precinct, the car back behind the fence · the day's cap (extra awake)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "impound",
  query: "&enable=impound,cityhall,town,foot,law,places,community,phone",
  save2d: { totalCoins: 600, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const D = "ctx.impound.debug", DU = "__lulu3d.ctx.impound.debug";
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      await t.L(`import("./js/core/dialog.js").then(m => { if (m.isOpen()) m.closeDialog(); })`);
      if (process.env.IMP_LOG) console.log(`    [${label}]`, JSON.stringify(await g(`${D}.log.slice(-8)`))); };
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    async function answer(re, done, max = 160) {
      for (let i = 0; i < max; i++) {
        if (done && await g(done)) return true;
        const o = await opts();
        if (o.length) { const idx = o.findIndex(x => re.test(x)); await t.L(`(b => b && b.click())([...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${Math.max(0, idx)}])`); await t.frames(3); if (!done) return true; continue; }
        if (!done && !await g(`ctx.dialogOpen`)) return false;
        await t.tap(0);
      }
      return false;
    }
    const town = async () => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000);
      await g(`(ctx.town.load("lakewood"), ctx.civic.load(), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood loads", 90000)) return false;
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      await t.until(`__lulu3d.ctx.town.active && !!__lulu3d.ctx.civic.spot("impound")`, "in Lakewood (the impound lot stands)", 8000);
      await t.frames(20); await W.reset(t);
      return true;
    };
    // impounded: she walks (her car is "gone"), her car behind the fence, the places:out a walk-out sends
    const impound = async () => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      await g(`(() => { const sp = ctx.civic.spot("impound"); const c = ctx.car; c.place(sp.x + sp.nx * 6, sp.z + sp.nz * 6, Math.atan2(sp.nx, sp.nz)); c.vx = c.vz = 0; const n = ctx.world.road.nearest(c.pos.x, c.pos.z, c.s, {}); c.s = n.s; c.d = n.d; return true; })()`);
      await g(`(ctx.foot.start("copWalk", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 8000);
      await g(`(ctx.civic.impound.show(true), true)`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("places:out", { kind: "law", door: "precinct", town: "lakewood", car: false, here: true }))`);
      await t.frames(2);
      return g(`!!ctx.impound.held && ctx.foot.ownCar === "gone" && !!ctx.civic.impound.car()`);
    };
    const toGate = async () => {
      await g(`(() => { const sp = ctx.civic.spot("impound"), F = ctx.foot.debug.F; F.pos.x = sp.x + sp.nx * 0.6; F.pos.z = sp.z + sp.nz * 0.6; F.vel.set(0, 0, 0); F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(6);
    };
    const promptText = () => t.L(`(() => { const e = document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);
    const press = async (code, n = 6) => { for (let i = 0; i < n && !await g(code); i++) { await t.tap(0); await t.frames(3); } return g(code); };
    const outAtKerb = async label => {
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.foot.ownCar === "parked"`, `${label}: her car's out at the kerb`, 8000);
      const d = await g(`(() => { const sp = ctx.civic.spot("impound"), F = ctx.foot.debug.F, c = F.car && F.car.stub; return c ? +Math.hypot(c.x - sp.x, c.z - sp.z).toFixed(1) : -1; })()`);
      t.check(`${label}: her own car is at the kerb right by the gate (${d} m), nothing left behind the fence`, d >= 0 && d < 16 && !(await g(`!!ctx.civic.impound.car()`)));
    };

    await W.install(t);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__arrests = []; m.on("law:arrest", e => __arrests.push((e && e.charges || []).slice())); })`);
    if (!await town()) return;

    // ════ the gate's window (the first-time price) → drive out ════
    await step("gate", async () => {
      t.check("impounded: her car's behind the fence and she's on foot", await impound());
      await t.frames(10);
      const chip = await t.L(`(document.querySelector(".impound-chip") || {}).textContent || ""`);
      t.check("the objective line (its lowest slot) says where to get it back", /impounded/i.test(chip) && /City Hall|precinct/i.test(chip), chip);
      await toGate();
      t.check("✋ at the gate: YOUR CAR (IMPOUNDED)", /YOUR CAR/i.test(await promptText()), await promptText());
      const c0 = await coins();
      await press(`ctx.dialogOpen`);
      await answer(/Pay the release/, `L3.state === "footRun" && !ctx.impound.held && ctx.foot.ownCar === "parked"`);
      await outAtKerb("the gate's window");
      t.check(`paid the first-time price once (${c0} → ${await coins()}: 60)`, c0 - (await coins()) === 60);
      // ✋ into her own car and away
      await g(`(() => { const F = ctx.foot.debug.F, c = F.car.stub; F.pos.x = c.x + Math.cos(c.h) * 1.6; F.pos.z = c.z - Math.sin(c.h) * 1.6; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(4);
      await press(`L3.state === "playing"`, 12);
      t.check("✋ → she's driving her own car again", await t.until(`__lulu3d.state === "playing"`, "driving", 8000));
      t.check("…and nothing's held any more", await g(`!ctx.impound.held`));
      let r = await W.report(t); W.log(r);
      W.check(t, "the gate", r, ["nan", "flat", "underground", "teleport", "lulu-jump", "cam-jump", "car-jump"]);
    });

    // ════ City Hall's Permits window → the slip → the gate ════
    await step("cityhall", async () => {
      t.check("impounded again", await impound());
      const c0 = await coins();
      const hooks = await g(`(ctx.cityhall.windows.permits || []).length`);
      t.check("City Hall's Permits window has the vehicle release", hooks > 0);
      // (the window's own flow: a choose → yes → a say — the room's runtime stand-in answers yes)
      await g(`(async () => { const rt = { disposed: false, choose: async () => 0, say: async () => {} }; for (const h of ctx.cityhall.windows.permits) if (await h.fn(rt, null, "Mr. Stempler")) break; })().then(() => true)`);
      await t.frames(3);
      t.check(`stamped in triplicate: the normal fee (${c0} → ${await coins()}: 120), the slip in hand`, c0 - (await coins()) === 120 && await g(`ctx.impound.released`));
      const chip = await t.L(`(document.querySelector(".impound-chip") || {}).textContent || ""`);
      t.check("the line now says: the slip ✓ → the gate", /slip/i.test(chip), chip);
      await toGate();
      t.check("✋ at the gate offers the slip", /RELEASE/i.test(await promptText()), await promptText());
      await press(`ctx.dialogOpen`);
      await answer(/./, `L3.state === "footRun" && !ctx.impound.held`);
      await outAtKerb("City Hall's slip");
      t.check("no second charge at the gate", c0 - (await coins()) === 120);
    });

    // ════ 📞 Contacts › City Hall: two taps ════
    await step("phone", async () => {
      t.check("impounded again (phone)", await impound());
      const c0 = await coins();
      const ok = await g(`(() => { const el = document.createElement("div"); ctx.cityhall.contactRender(el); let b = el.querySelector("#imPay"); if (!b) return "no row"; b.click(); b = el.querySelector("#imPay"); if (!b) return "no 2nd"; b.click(); return ctx.impound.released ? "ok" : "not released"; })()`);
      t.check(`📞 City Hall: tap, tap → paid (${ok}; −${c0 - (await coins())})`, ok === "ok" && c0 - (await coins()) === 120);
      await toGate(); await press(`ctx.dialogOpen`); await answer(/./, `!ctx.impound.held`);
      await outAtKerb("the phone's slip");
    });

    // ════ can't afford it → told, nothing taken; a new run = the car's home ════
    await step("broke", async () => {
      t.check("impounded again (broke)", await impound());
      const keep = await coins();
      await t.L(`import("./js/core/save.js").then(m => m.wallet.spend(m.wallet.coins - 10))`);
      await toGate(); await press(`ctx.dialogOpen`);
      await answer(/Pay the release/);
      await t.frames(6);
      const txt = await t.L(`(document.querySelector("#dialog") || {}).textContent || ""`);
      t.check("can't afford it: told so (it'll be home by tomorrow), nothing taken", (await coins()) === 10 && await g(`${D}.log.some(e => e.ev === "broke")`) && /You need/i.test(txt), txt.slice(0, 120));
      t.check("…still held", await g(`!!ctx.impound.held`));
      await t.L(`import("./js/core/dialog.js").then(m => { if (m.isOpen()) m.closeDialog(); })`);
      await t.L(`import("./js/core/save.js").then(m => m.wallet.add(${keep - 10}))`);
      if (!await town()) return;
      t.check("a new run (home): nothing's held, she has her car", await g(`!ctx.impound.held && ctx.foot.ownCar !== "gone"`));
    });

    // ════ the break-in: clean ════
    await step("breakin-clean", async () => {
      t.check("impounded again (break-in)", await impound());
      await g(`(${D}.SAVE.breakDay = "", true)`);
      await t.frames(20);
      const pn = await g(`ctx.impound.panel()`);
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.x = ${pn.x}; F.pos.z = ${pn.z}; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(6);
      t.check("✋ at the loose fence panel", /PANEL|sneak/i.test(await promptText()), await promptText());
      const c0 = await coins();
      await press(`!!${D}.BR.run`);
      t.check("she squeezes in (the guard + the camera are on duty)", await g(`!!${D}.BR.run && !!${D}.BR.fanG`));
      // unseen: straight to her car, ✋ hotwire
      await g(`(${D}.BR.force.seen = false, (() => { const car = ctx.civic.impound.car().position, R = ${D}.BR.run; R.x = car.x + 1.4; R.z = car.z; return true; })())`);
      await t.frames(4);
      for (let i = 0; i < 4; i++) { await t.tap(0); await t.frames(2); }
      await g(`(${D}.BR.force.wire = true, true)`);
      await outAtKerb("a clean break-in");
      t.check(`clean getaway: her car, no fee (${c0} → ${await coins()})`, (await coins()) === c0 && await g(`${D}.log.some(e => e.ev === "breakin" && e.phase === "clean")`));
      await g(`(${D}.BR.force = {}, true)`);
    });

    // ════ the break-in: seen → look → chase → caught → court ════
    await step("breakin-caught", async () => {
      t.check("impounded again (caught)", await impound());
      await t.frames(20);
      t.check("the day's cap: Bruno's extra awake after a try today", /awake/i.test(await g(`ctx.impound.debug.SAVE.breakDay === new Date().getFullYear() + "-" + (new Date().getMonth() + 1) + "-" + new Date().getDate() ? "awake" : "no"`)));
      await g(`ctx.impound.breakIn()`);
      await g(`(${D}.BR.force.seen = "guard", true)`);
      await t.until(`${DU}.log.some(e => e.ev === "breakin" && e.phase === "look")`, "Bruno's ⚠️ look", 6000);
      await g(`(${D}.BR.meter = 0, true)`);
      await t.until(`${DU}.log.some(e => e.ev === "breakin" && e.phase === "chase")`, "seen again → the chase", 8000);
      t.check("seen twice: a cop on foot's after her", await g(`ctx.foot.chasing`));
      await g(`(${D}.BR.force = {}, ctx.law._dbg.FORCE.verdict = "dismissed", true)`);
      await t.until(`window.__arrests.length > 0`, "caught", 60000);
      const ar = await t.L(`window.__arrests.slice(-1)[0] || []`);
      t.check("arrested for GRAND THEFT AUTO (HER OWN CAR)", ar.some(c => /HER OWN CAR/.test(c)), JSON.stringify(ar));
      const lines = [];
      for (let i = 0; i < 400 && await st() !== "footRun"; i++) {
        const txt = await t.L(`(document.querySelector("#dialog") || {}).textContent || ""`); if (txt) lines.push(txt);
        if (await t.L(`!!document.querySelector("#lawCourtBtn") && document.querySelector("#lawCourtBtn").offsetParent !== null`)) { await t.L(`document.querySelector("#lawCourtBtn").click()`); await t.frames(3); continue; }
        const o = await opts();
        if (o.length) { const idx = Math.max(0, o.findIndex(x => !/💰|Plea|plea|[Bb]ribe|costs/.test(x))); await t.L(`(b => b && b.click())([...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${idx}])`); await t.frames(3); continue; }
        await t.tap(0);
      }
      t.check("in court: the victim is… her (the charge's own moment)", lines.some(l => /press charges against herself|registered owner/i.test(l)), lines.filter(l => /JUDGE|PROSECUTOR/.test(l)).slice(0, 3).join(" | "));
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "out on foot", 60000);
      t.check("out of the building on foot — the car's back behind the fence, the fee still owed", await g(`ctx.foot.ownCar === "gone" && !!ctx.impound.held && !ctx.impound.released`));
      await g(`(ctx.law._dbg.FORCE.verdict = null, true)`);
    });
  },
};
