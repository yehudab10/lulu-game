// 🐞 QA sweep, part 11 — the new solo crimes (features/crime) × 🆘 (features/unstuck), the watchdog on: 🆘 pressed in the
// middle of the shopping-cart joyride (the ride ends the way its own end does — she's on her feet, on the sidewalk, the
// cart left behind — and a cop who saw it is STILL after her: no wiping the crime) and in the middle of double-parking
// (she's put in a clear lane; the "one second" is over; nothing paid for it).
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa11",
  query: "&enable=crime,town,foot,law,places,unstuck",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game, C = "ctx.crime.debug", CU = "__lulu3d.ctx.crime.debug";
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await W.moved(t);
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.frames(30);
    // ── the cart: on foot beside it, a cop forced to see it, ride, 🆘 mid-ride ──
    if (await t.check("the cart stands outside a shop", await g(`!!${C}.CART.obj && !!${C}.CART.obj.parent`))) {
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "out on foot", 8000);
      await W.moved(t);
      await g(`(() => { const F = ctx.foot.debug.F, o = ${C}.CART.obj.position; F.pos.x = o.x + 0.9; F.pos.z = o.z + 0.4; F.vel.set(0, 0, 0); F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); ctx.cam.snap(); return true; })()`);
      await t.frames(4);
      await g(`(${C}.CR.force.cop = true, ctx.crime.start("cart"), true)`);
      const riding = await t.until(`!!${CU}.CART.ride`, "riding the cart", 4000);
      if (riding) {
        await t.until(`${CU}.log.some(e => e.ev === "chase" && e.kind === "cart") || !${CU}.CART.ride`, "a cop sees it", 20000);
        const seen = await g(`${C}.log.some(e => e.ev === "chase" && e.kind === "cart")`);
        const c0 = await coins();
        await g(`(ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.now(), true)`);
        await t.frames(15);
        const r = await g(`(() => { const F = ctx.foot.debug.F; return { ride: !!${C}.CART.ride, state: L3.state, phase: F && F.phase, why: F ? ctx.unstuck.normal(F.pos.x, F.pos.z, "foot") : "?", chasing: ctx.foot.chasing || ctx.law.chasing, last: ctx.unstuck.debug.U.log.slice(-1)[0] }; })()`);
        t.check("🆘 mid cart ride: the ride is over, she's on her feet on clear ground", !r.ride && r.state === "footRun" && r.phase === "walk" && r.why == null, JSON.stringify(r));
        if (seen) t.check("…and the cop who saw it is still after her (🆘 never wipes a crime)", !!r.chasing, JSON.stringify(r));
        t.check("…no coins for a ride cut short by 🆘", (await coins()) <= c0, `${c0} → ${await coins()}`);
        await t.shot("cart-unstuck");
      }
      await g(`(${C}.CR.force.cop = null, (() => { const L = ctx.law._dbg && ctx.law._dbg.L; if (L && L.chase) ctx.law.standDown("test"); if (ctx.foot.active && ctx.foot.chasing) ctx.foot.dropChase(); })(), true)`);
      await t.frames(20);
      await seg("🆘 mid cart ride", ["nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "inside"]);
      await g(`(ctx.foot.active && ctx.foot.debug.getIn(), true)`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 8000);
    }
    // ── double-parking: in the outside lane, "one second", 🆘 ──
    await W.moved(t);
    const park = await g(`(() => { const sts = ctx.town.plan.STREETS.filter(s => s.parkLane && s.cross.length > 1 && !s.oneway); let best = null; const jam = new Set((ctx.town.def.jams || []).map(j => j.street)), r0 = ctx.world.road;
      for (const s of sts) for (let k = 0; k < s.cross.length - 1; k++) { const len = s.cross[k + 1].a - s.cross[k].a, a = (s.cross[k].a + s.cross[k + 1].a) / 2 + 8; if (jam.has(s.name) || len < 40) continue; if (!best || len > best.len) best = { s, a, len }; }
      if (!best) return null; const st = best.s, r = ctx.world.road, d = 3.5 * st.lanes - 1.75, p = r.point(st.base + best.a, d, {}); const n = r.nearest(p.x, p.z, st.base + best.a, {}), car = ctx.car;
      car.place(p.x, p.z, n.h); car.vx = car.vz = 0; car.s = n.s; car.d = n.d; ctx.cam.snap(); return { d }; })()`);
    if (park && await g(`L3.state === "playing"`)) {
      await t.frames(4);
      const on = await g(`ctx.crime.start("park")`);
      if (t.check("double-parking starts", !!on)) {
        await t.frames(30);
        const c0 = await coins();
        await g(`(ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.now(), true)`);
        await t.frames(30);
        const r = await g(`({ park: !!${C}.PARK.on, state: L3.state, why: ctx.unstuck.normal(ctx.car.pos.x, ctx.car.pos.z, "car"), d: +ctx.car.d.toFixed(2) })`);
        t.check("🆘 while double-parked: a clear lane, the double-park over (or still just a car stopped in a lane)", r.state === "playing" && r.why == null, JSON.stringify(r));
        t.check("…no pay for it", (await coins()) <= c0 + 8, `${c0} → ${await coins()}`);
      }
      await g(`(${C}.parkEnd ? ${C}.parkEnd("test") : 0, true)`);
      await t.frames(20);
      await seg("🆘 while double-parked", ["nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck"]);
    }
  },
};
