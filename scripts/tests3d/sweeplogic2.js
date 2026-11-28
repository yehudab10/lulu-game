// 🔍 The logic sweep, part 2 (ci/sweep-logic2, 3d/docs/sweeps/sweep-logic2.md): state, dead ends, two things at once.
//   1. one clock: in a Cruise day the sky runs its own 9-minute day (the 📱's clock + the households follow it) — a
//      shopfront's hours, the car-care row and the school-zone cameras follow THAT hour, not the device's (a shop said
//      "CLOSED · opens 7 am" under the noon sun; a school camera flashed under the stars)
const Q = "&enable=town,world,foot,atmos";

module.exports = {
  name: "sweeplogic2",
  query: Q,
  save2d: { totalCoins: 500, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    const g = c => t.game(c);
    const step = async (name, fn) => { try { await fn(); } catch (e) { t.check(`${name}: no exception`, false, String(e && e.stack || e).slice(0, 300)); } };
    const setDate = iso => t.L(`import("./js/features/seasons/calendar.js").then(m => (m.setDate(${JSON.stringify(iso)}), true))`);
    await t.until(`__lulu3d.state === "title"`, "title", 90000);
    await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
    await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run", 60000);

    // ════ 1. one clock ════
    await step("one clock", async () => {
      await g(`(ctx.atmos.debug.freeze(true), true)`);
      // a shop open 7 am – 7 pm Sun–Thu, 7 am – 1 pm on Fridays
      const probe = (iso, sky) => t.L(`Promise.all([import("./js/features/storefronts/hours.js"), import("./js/features/seasons/calendar.js"), import("./js/features/cameras/index.js")]).then(([h, c, cam]) => {
        c.setDate(${JSON.stringify(iso)}); __lulu3d.ctx.atmos.debug.time(${JSON.stringify(sky)});
        return new Promise(r => requestAnimationFrame(() => r())).then(() => {
          const A = __lulu3d.ctx.atmos, hrs = (7.3 + A.clock * 24) % 24;
          return { mode: A.info().mode, phone: Math.floor(hrs), open: h.openAt("0-4 7-19; 5 7-13"), next: h.nextOpen("0-4 7-19; 5 7-13"), school: cam.schoolHours() };
        });
      })`);
      await t.frames(3);
      const nightAt10 = await probe("2026-11-24T10:00", "night");
      t.check("one clock: Tuesday 10 am on the device, NIGHT in the sky (the 📱 says ~midnight) → a 7–7 shop is CLOSED", nightAt10.mode === "cruise" && nightAt10.phone <= 1 && nightAt10.open === false, JSON.stringify(nightAt10));
      t.check("one clock: …and its door says it opens at 7 (this game day — not \"tomorrow\" / another weekday)", /^opens 7 am$/.test(nightAt10.next), JSON.stringify(nightAt10));
      t.check("one clock: …and no school-zone camera at night", nightAt10.school === false, JSON.stringify(nightAt10));
      const noonAt3 = await probe("2026-11-24T03:00", "noon");
      t.check("one clock: Tuesday 3 am on the device, NOON in the sky → the shop is OPEN and the school zone is on", noonAt3.open === true && noonAt3.school === true, JSON.stringify(noonAt3));
      // a Friday afternoon (game) — closed after 1 pm; the next opening is this (real) Friday's next game morning
      const fri = await probe("2026-11-27T10:00", "golden");
      t.check("one clock: a Friday's golden hour (~5 pm in the sky): a Fri 7–1 shop is closed, opens again at 7 (the same real day)", fri.open === false && fri.next === "opens 7 am", JSON.stringify(fri));
      await setDate(null);
      await g(`(ctx.atmos.debug.freeze(false), true)`);
    });

    // ════ 2. pausing in the middle of a question (a controller / keys) ════
    // ☰ Options used to ADVANCE the question (it's "start" too) — picking the highlighted answer ("Yes, buy it");
    // and once paused (the tab went to the background), ✕ / Enter went to the question behind the pause card.
    await step("pause mid-question", async () => {
      if (await g(`__lulu3d.state`) !== "playing") { await g(`(ctx.foot && ctx.foot.active && ctx.foot.end("test"), L3.setState("playing"), true)`); await t.frames(4); }
      const ask = () => t.L(`import("./js/core/dialog.js").then(m => { window.__pick = null; m.choose("Sal", "Buy the paint job for 200?", ["Yes, buy it", "Not now"]).then(i => { window.__pick = i; }); return true; })`);
      await ask();
      await t.frames(40);                       // (the line types out)
      await t.tap(9);                           // ☰ Options
      await t.frames(4);
      const a = await g(`({ pick: window.__pick, paused: ctx.paused, open: ctx.dialogOpen })`);
      t.check("pause mid-question: ☰ pauses — it doesn't pick the highlighted answer", a.pick === null && a.paused === true && a.open === true, JSON.stringify(a));
      await t.tap(0);                           // ✕ on the pause card (its first button: Resume)
      await t.frames(6);
      const b = await g(`({ pick: window.__pick, paused: ctx.paused, open: ctx.dialogOpen })`);
      t.check("pause mid-question: ✕ on the pause card works the PAUSE card (Resume), not the question behind it", b.pick === null && b.paused === false && b.open === true, JSON.stringify(b));
      await t.tap(0); await t.frames(4);
      const c = await g(`({ pick: window.__pick, open: ctx.dialogOpen })`);
      t.check("pause mid-question: back in the game, the question is still there and answers as before", c.pick === 0 && c.open === false, JSON.stringify(c));
      // the tab went to the background mid-question (app.js pauses) → back, ✕ = Resume, not the question's answer
      await ask(); await t.frames(40);
      await t.L(`import("./js/core/screens.js").then(m => (m.pause(), true))`); await t.frames(2);
      await t.tap(0); await t.frames(6);
      const d = await g(`({ pick: window.__pick, paused: ctx.paused, open: ctx.dialogOpen })`);
      t.check("pause mid-question (a background tab): ✕ resumes the game; the question is still waiting", d.pick === null && d.paused === false && d.open === true, JSON.stringify(d));
      await t.tap(0); await t.frames(4);
      // two features' lines at once: the one replaced answers -1 (closed) — its await used to hang forever
      const sup = await t.L(`import("./js/core/dialog.js").then(async m => { let a = null; m.choose("A", "Pay the meter maid?", ["Yes", "No"]).then(i => { a = i; }); const b = m.say("B", "Hey, Lulu!"); await null; await null; const r = { a, open: m.isOpen() }; m.closeDialog(); await b; return r; })`);
      t.check("two lines at once: the question that got covered answers -1 (closed), never hangs", sup.a === -1 && sup.open === true, JSON.stringify(sup));
    });

    // ════ 3. one activity at a time: the timed things that weren't on the list ════
    // (ctx.engaged() — robberies, snatchers, cameos, the Fixer, job offers, street scenes wait while it says she's busy)
    await step("one activity", async () => {
      const r = await t.L(`import("./js/features/rides/ambulance.js").then(m => { const C = __lulu3d.ctx, R = m.ambDebug.RUN, was = R.phase, out = { free: C.engaged() };
        for (const p of ["pickup", "load", "rush"]) { R.phase = p; out[p] = C.engaged(); }
        R.phase = was;
        const TD = C.shops.debug.dealer.TD, on0 = TD.on; TD.on = true; out.test = C.engaged(); TD.on = on0;
        const CM = C.community.debug.CM, ch0 = CM.chase; CM.chase = { units: [] }; out.shomrim = C.engaged(); CM.chase = ch0;
        out.after = C.engaged();
        return out; })`);
      t.check("one activity: a 🚑 patient run (to the patient, loading, the ER clock) counts — nothing new starts on top", r.free === "" && r.pickup === "ride" && r.load === "ride" && r.rush === "ride", JSON.stringify(r));
      t.check("one activity: Uncle Refael's 60 s test drive counts", r.test === "testdrive", JSON.stringify(r));
      t.check("one activity: the 🔦 Shomrim on her tail (about to call the cops) count", r.shomrim === "shomrim" && r.after === "", JSON.stringify(r));
    });
  },
};
