// 🦹 features/crime — stage 1: her own crimes in town (solo), with the QA watchdog on.
//   🛒 the shopping-cart joyride: ✋ RIDE with the real button → it rolls → pays (capped: 2 paying rides a real day) ·
//      a cop who sees it → the ⚠️ look, then a foot chase → caught → the charge in court (its own courtroom moment)
//   🚶‍♀️ the jaywalking spree: mid-block crossings → a combo → pays from ×2 (capped a day) · a crossing at the corner
//      doesn't count · a cop who sees two → the foot chase with SERIAL JAYWALKING
//   🅿️ the double-parking empire: stopped in the outside lane → the prompt → ✕ → a town driver queues behind = a honk →
//      drive off → pays (capped) · Midwood: the patrol shrugs at the hazards; Lakewood past the grace: the law's warning
//   + off in a party / without the feature; the charges are registered with their court lines.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "crime",
  query: "&enable=crime,town,foot,law,places",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const C = "ctx.crime.debug", CU = "__lulu3d.ctx.crime.debug";
    const ONLY = process.env.CRIME_ONLY ? new RegExp(process.env.CRIME_ONLY) : null;
    const step = async (label, fn) => {
      if (ONLY && !ONLY.test(label)) return;
      try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      if (process.env.CRIME_LOG) console.log(`    [${label}] log:`, JSON.stringify(await g(`${C}.log.slice(-14)`)));
    };
    const logOf = (re) => g(`${C}.log.filter(e => ${re}.test(e.ev + ":" + (e.phase || e.kind || "")))`);
    const playing = async () => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
    };
    const town = async (id = "lakewood") => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000)) return false;
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.crime.active`, `in ${id} with crime on`, 8000);
      await t.frames(30);
      await W.reset(t);       // (a town switch is a declared cut: watch from here)
      return ok;
    };
    const resetLaw = () => g(`(() => { const L = ctx.law._dbg.L; if (L.chase) ctx.law.standDown("test"); L.sus = 0; L.grace = 0; L.hold = 0; ${C}.CR.sus = {}; if (ctx.foot.active && ctx.foot.chasing) ctx.foot.dropChase(); return true; })()`);
    // on foot at (x, z) — she climbs out where her car stands, then is put there
    const footAt = async (x, z) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "out on foot", 8000)) return false;
      }
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.x = ${x}; F.pos.z = ${z}; F.vel.set(0, 0, 0); F.lulu.obj.position.set(${x}, 0, ${z}); ctx.cam.snap(); return true; })()`);
      await t.frames(4);
      return true;
    };
    const promptText = () => t.L(`(() => { const e = document.querySelector("#prompt") || document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);

    await W.install(t);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__arrests = []; m.on("law:arrest", e => __arrests.push((e && e.charges || []).slice())); })`);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;

    // ── the charges are on file with the law (arrest lines + the courtroom moment) ──
    t.check("each crime's charge has its own courtroom moment (law.chargeEvent)",
      await g(`["GRAND THEFT SHOPPING CART", "SERIAL JAYWALKING", "DOUBLE PARKING (\\"ONE SECOND\\")"].every(c => !!(ctx.law.chargeEvent([c]) || {}).lines)`));

    // ════ 🛒 the cart ════
    await step("cart", async () => {
      if (!await town("lakewood")) return;
      t.check("🛒 the cart stands outside a shop in Lakewood", await g(`!!${C}.CART.obj && !!${C}.CART.obj.parent`));
      await resetLaw();
      await g(`(${C}.CR.force.cop = false, ${C}.SAVE.rides = 0, ${C}.SAVE.paid = {}, ${C}.SAVE.day = ${C}.today(), true)`);
      const cp = await g(`(() => { const o = ${C}.CART.obj.position; return { x: o.x, z: o.z }; })()`);
      if (!await footAt(cp.x + 0.9, cp.z + 0.4)) return;
      await t.frames(6);
      const pr = await promptText();
      t.check("✋ next to the cart offers the ride", /cart/i.test(pr), pr);
      const c0 = await coins();
      for (let i = 0; i < 6 && !await g(`!!${C}.CART.ride`); i++) { await t.tap(0); await t.frames(3); }
      t.check("✋ RIDE: she's in the cart and rolling", await g(`!!${C}.CART.ride || ${C}.log.some(e => e.ev === "cart" && e.phase === "start")`));
      if (!await t.until(`!${CU}.CART.ride`, "the ride ends", 40000)) console.log("    ride:", JSON.stringify(await g(`(() => { const R = ${CU}.CART.ride, F = __lulu3d.ctx.foot.debug.F; return { R: R && { t: R.t, v: R.v, d: R.dist }, phase: F && F.phase, st: L3.state }; })()`)));
      const end = (await logOf(/^cart:end/)).slice(-1)[0] || {};
      t.check(`the ride rolled somewhere (${end.dist} m, ended: ${end.why})`, end.dist >= 6, JSON.stringify(end));
      const c1 = await coins();
      t.check(`a ride pays a little (+${c1 - c0}, ≤ ${15})`, c1 - c0 > 0 && c1 - c0 <= 15);
      t.check("she's back on her feet, walking", await g(`L3.state === "footRun" && ctx.foot.phase === "walk"`));
      await t.shot("cart-ridden");
      // the cap: two paying rides a real day
      await g(`(${C}.SAVE.rides = 2, true)`);
      await g(`(() => { const F = ctx.foot.debug.F, o = ${C}.CART.obj.position; F.pos.x = o.x + 0.8; F.pos.z = o.z; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(3);
      const c2 = await coins();
      await g(`ctx.crime.start("cart")`);
      await t.until(`!${CU}.CART.ride`, "the 3rd ride ends", 120000);
      t.check(`the 3rd ride of the day pays nothing (${c2} → ${await coins()})`, (await coins()) === c2);
      // the risk: a cop sees it → the look → the chase
      await resetLaw();
      await g(`(${C}.CR.force.cop = true, true)`);
      await g(`(() => { const F = ctx.foot.debug.F, o = ${C}.CART.obj.position; F.pos.x = o.x + 0.8; F.pos.z = o.z; F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
      await t.frames(3);
      await g(`ctx.crime.start("cart")`);
      await t.until(`!${CU}.CART.ride`, "the seen ride ends", 120000);
      const seen = (await logOf(/^(warn|chase):/)).map(e => e.ev + ":" + e.kind);
      t.check("seen in the street: a ⚠️ look first, then the chase", seen.join(",").includes("warn:cart") && seen.join(",").includes("chase:cart"), seen.join(","));
      t.check("a cop on foot is after her", await g(`ctx.foot.chasing`));
      await g(`(${C}.CR.force.cop = null, true)`);
      // caught: stand still → arrested with the charge
      await t.until(`["lawArrest", "placesArrive", "lawJail"].includes(__lulu3d.state)`, "caught by the cop", 60000);
      const ar = (await t.L(`window.__arrests.slice(-1)[0] || []`));
      t.check("arrested for GRAND THEFT SHOPPING CART", ar.some(c => /SHOPPING CART/.test(c)), JSON.stringify(ar));
      // …and the court: the charge's own moment plays
      const D = "ctx.law._dbg";
      await g(`(${D}.FORCE.verdict = "dismissed", true)`);
      const seenLines = [];
      for (let i = 0; i < 400 && await st() !== "footRun"; i++) {
        const txt = await t.L(`(document.querySelector("#dialog") || {}).textContent || ""`);
        if (txt) seenLines.push(txt);
        if (await t.L(`!!document.querySelector("#lawCourtBtn") && document.querySelector("#lawCourtBtn").offsetParent !== null`)) { await t.L(`document.querySelector("#lawCourtBtn").click()`); await t.frames(3); continue; }
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length) {
          const idx = Math.max(0, opts.findIndex(o => !/💰|Plea|plea|[Bb]ribe|costs/.test(o)));
          await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${idx}].click()`); await t.frames(3); continue;
        }
        await t.tap(0);
      }
      t.check("in court, the cart is Exhibit A (the charge's courtroom moment)", seenLines.some(l => /shopping cart|quarter in it/i.test(l)), seenLines.filter(l => /cart|JUDGE/i.test(l)).slice(0, 3).join(" | "));
      t.check("…and she walks out on foot", await st() === "footRun");
      await g(`(${D}.FORCE.verdict = null, true)`);
      let r = await W.report(t); W.log(r);
      W.check(t, "the cart + its arrest", r, ["nan", "flat", "underground"]);
    });

    // ════ 🚶‍♀️ jaywalking ════
    await step("jaywalk", async () => {
      if (!await town("lakewood")) return;
      await resetLaw();
      await g(`(${C}.CR.force.cop = false, ${C}.SAVE.paid = {}, ${C}.SAVE.day = ${C}.today(), true)`);
      // a long block of a street with a parking lane: the middle of it, and a corner
      const S = await g(`(() => { const sts = ctx.town.plan.STREETS.filter(s => s.parkLane && s.cross.length > 1); let best = null;
          for (const s of sts) for (let k = 0; k < s.cross.length - 1; k++) { const len = s.cross[k + 1].a - s.cross[k].a; if (!best || len > best.len) best = { id: s.id, base: s.base, a: (s.cross[k].a + s.cross[k + 1].a) / 2, corner: s.cross[k].a + 4, len, curb: s.curb }; }
          return best; })()`);
      t.check("found a long block to cross", !!S && S.len > 40, JSON.stringify(S));
      if (!S) return;
      const cross = async (along) => {
        const a = await g(`(() => { const r = ctx.world.road, p = r.point(${S.base} + ${along}, ${S.curb + 1.6}, {}); return { x: p.x, z: p.z }; })()`);
        if (!await footAt(a.x, a.z)) return;
        for (let i = 0; i <= 20; i++) {
          const d = (S.curb + 1.6) * (1 - i / 10);
          await g(`(() => { const r = ctx.world.road, p = r.point(${S.base} + ${along}, ${d}, {}), F = ctx.foot.debug.F; F.pos.x = p.x; F.pos.z = p.z; F.lulu.obj.position.set(p.x, 0, p.z); return true; })()`);
          await t.frames(2);
        }
        await t.frames(4);
      };
      const c0 = await coins();
      await cross(S.a);
      await cross(S.a + 3);
      await cross(S.a - 3);
      const j = await g(`${C}.JAY.combo`);
      t.check(`three mid-block crossings → JAYWALK ×3 (${j})`, j === 3, JSON.stringify(await logOf(/^jaywalk/)));
      await cross(S.corner);
      t.check("a crossing at the corner isn't a jaywalk", (await g(`${C}.JAY.combo`)) === 3);
      await g(`${C}.settleJay()`);
      const c1 = await coins();
      t.check(`the spree pays from ×2 (+${c1 - c0})`, c1 - c0 > 0 && c1 - c0 <= 12);
      // the cap: a day's worth already paid → nothing
      await g(`(${C}.SAVE.paid.jaywalk = 12, true)`);
      await cross(S.a); await cross(S.a + 2);
      await g(`${C}.settleJay()`);
      t.check("past the day's cap a spree pays nothing", (await coins()) === c1);
      // the risk: a cop sees two → the chase
      await resetLaw();
      await g(`(${C}.CR.force.cop = true, true)`);
      await cross(S.a);
      t.check("a cop sees a jaywalk → the ⚠️ look", (await logOf(/^warn:/)).some(e => e.kind === "jaywalk"));
      await cross(S.a + 2);
      t.check("…a second one → a cop on foot gives chase", await g(`ctx.foot.chasing`), JSON.stringify((await logOf(/^(warn|chase):/)).slice(-3)));
      await g(`(${C}.CR.force.cop = null, ctx.foot.dropChase(), true)`);
      await t.frames(90);
      let r = await W.report(t); W.log(r);
      W.check(t, "jaywalking", r, ["nan", "flat", "underground", "teleport", "lulu-jump"]);
    });

    // ════ 🅿️ double-parking ════
    const parkHere = async () => {
      // the outside travel lane of a long block, mid-block, a town driver 20 m behind in the same lane
      return g(`(() => { const sts = ctx.town.plan.STREETS.filter(s => s.parkLane && s.cross.length > 1 && !s.oneway); let best = null;
          const jam = new Set((ctx.town.def.jams || []).map(j => j.street)), r0 = ctx.world.road;
          for (const s of sts) for (let k = 0; k < s.cross.length - 1; k++) { const len = s.cross[k + 1].a - s.cross[k].a, a = (s.cross[k].a + s.cross[k + 1].a) / 2 + 8;
            if (jam.has(s.name) || len < 40) continue;
            const q = r0.point(s.base + a, 3.5 * s.lanes - 1.75, {}); if (ctx.traffic.cars.some(c => Math.hypot(c.x - q.x, c.z - q.z) < 12)) continue;
            if (!best || len > best.len) best = { s, a, len }; }
          if (!best) return null;
          const st = best.s, r = ctx.world.road, d = 3.5 * st.lanes - 1.75, p = r.point(st.base + best.a, d, {});
          const n = r.nearest(p.x, p.z, st.base + best.a, {}), car = ctx.car;
          car.place(p.x, p.z, n.h); car.vx = car.vz = 0; car.s = n.s; car.d = n.d; ctx.cam.snap();
          return { base: st.base, a: best.a, d, h: n.h }; })()`);
    };
    await step("double-park (Lakewood)", async () => {
      if (!await town("lakewood")) return;
      await playing();
      await resetLaw();
      await g(`(${C}.CR.force.cop = false, ${C}.SAVE.paid = {}, ${C}.SAVE.day = ${C}.today(), true)`);
      const P = await parkHere();
      t.check("stopped double-parked mid-block", !!P);
      if (!P) return;
      if (!await t.until(`${CU}.PARK.shown`, "the double-park prompt", 4000)) console.log("    park why:", await g(`${C}.PARK.why + " speed " + ctx.car.speed.toFixed(2) + " foot " + !!ctx.foot.active + " chase " + ctx.law.chasing + " st " + L3.state + " live " + ctx.crime.active`));
      const pr = await promptText();
      t.check("the prompt offers to double-park", /Double-park/i.test(pr), pr);
      for (let i = 0; i < 6 && !await g(`!!${C}.PARK.on`); i++) { await t.tap(0); await t.frames(3); }
      t.check("✕ → hazards on, 'one second'", await g(`!!${C}.PARK.on`));
      // a town driver comes up behind her and has to wait
      await g(`(() => { const r = ctx.world.road, q = r.point(${P.base} + ${P.a} - 22, ${P.d}, {}); return !!ctx.town.addDriver("town_van", { at: { x: q.x, z: q.z, dir: 1 }, speed: 5 }); })()`);
      await t.until(`${CU}.PARK.on && ${CU}.PARK.on.honks.size >= 1`, "a car stuck behind her honks", 15000);
      const honks = await g(`${C}.PARK.on ? ${C}.PARK.on.honks.size : 0`);
      t.check(`a town driver queues up behind her and honks (${honks})`, honks >= 1);
      // drive off → paid
      const c0 = await coins();
      await g(`(() => { const c = ctx.car; c.vx = Math.sin(c.h) * 9; c.vz = Math.cos(c.h) * 9; return true; })()`);
      await t.hold(7, 1); await t.frames(40); await t.hold(7, 0);
      await t.until(`!${CU}.PARK.on`, "she drives off", 6000);
      const c1 = await coins();
      t.check(`driving off pays for the held-up cars (+${c1 - c0}, ≤ 8)`, c1 - c0 >= 1 && c1 - c0 <= 8, JSON.stringify((await logOf(/^park:end/)).slice(-1)));
      // Lakewood, past the grace, a cop who sees it: the law's ⚠️ warning
      await resetLaw();
      await g(`(${C}.CR.force.cop = true, true)`);
      if (!await parkHere()) return;
      await t.frames(4);
      await g(`ctx.crime.start("park")`);
      await g(`(${C}.PARK.on.t = ${C}.PARK.on.grace + 1, true)`);
      await t.until(`${CU}.log.some(e => e.ev === "park" && (e.phase === "warn" || e.phase === "chase"))`, "the law notices", 5000);
      t.check("Lakewood past the grace: the patrol's ⚠️ warning (law.notice)", await g(`ctx.law.suspicion > 0 || ctx.law.chasing`));
      await g(`(${C}.CR.force.cop = null, ${C}.parkEnd("test"), true)`);
    });
    await step("double-park (Midwood)", async () => {
      if (!await town("midwood")) return;
      await playing();
      await resetLaw();
      await g(`(${C}.CR.force.cop = true, true)`);
      if (!await parkHere()) { t.check("a block to double-park on in Midwood", false); return; }
      await t.frames(4);
      t.check("Midwood: double-park starts", await g(`ctx.crime.start("park")`));
      await t.until(`${CU}.log.some(e => e.ev === "park" && e.phase === "legal")`, "the patrol shrugs", 4000);
      t.check("Midwood: hazards on = the cop shrugs (no warning inside the grace)", await g(`${C}.log.some(e => e.ev === "park" && e.phase === "legal") && !(ctx.law.suspicion > 0) && !ctx.law.chasing`));
      await g(`(${C}.CR.force.cop = null, ${C}.parkEnd("test"), true)`);
      await t.shot("double-parked-midwood");
      let r = await W.report(t); W.log(r);
      W.check(t, "double-parking", r, ["nan", "flat", "underground"]);
    });

    // ════ off where it should be ════
    await step("off", async () => {
      const off = await g(`(() => { const p = ctx.party; const was = Object.getOwnPropertyDescriptor(p, "active"); Object.defineProperty(p, "active", { configurable: true, get: () => true }); const a = ctx.crime.active; if (was) Object.defineProperty(p, "active", was); else delete p.active; return a; })()`);
      t.check("solo only: off in a 🎉 party (friends have partners' crimes)", off === false);
    });
  },
};
