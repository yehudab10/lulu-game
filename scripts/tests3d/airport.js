// exploratory (replaced by the real test)
module.exports = {
  name: "airport",
  viewport: { width: 1280, height: 720 },
  query: "&enable=airport,foot,atmos",
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    console.log("planned", JSON.stringify(await g(`ctx.airport.planned`)));
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    const t0 = Date.now();
    const E = await g(`ctx.airport.debug.placeAt(ctx.car.s + 1800)`);
    console.log("E", E, "ms", Date.now() - t0);
    const place = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.car.vF = ${v}; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
    await place(E - 300, 5.25, 0);
    console.log("search", JSON.stringify(await g(`[ctx.airport.planned, ctx.journey && [0,1,2,3,4].map(i => ctx.journey.stopS(i))]`)));
    await t.until(`__lulu3d.ctx.airport.ready`, "built", 120000);
    console.log("perf", JSON.stringify(await g(`ctx.airport.debug.perf()`)));
    await t.frames(20);
    await t.shot("x-decel");
    const at = async (f, r, h, label) => { await g(`(() => { const w = ctx.airport.debug.world(${f}, ${r}), F = ctx.airport.debug.G().F; const n = ctx.world.road.nearest(w.x, w.z, ${E} + 330 + ${f}, {}); ctx.car.place(w.x, w.z, F.yaw(${h[0]}, ${h[1]})); ctx.car.s = n.s; ctx.car.d = n.d; ctx.world.prebuild(n.s); ctx.cam.snap(); return true; })()`); await t.frames(30); console.log(label, JSON.stringify(await g(`[ctx.car.s, ctx.car.d, ctx.airport.inside]`))); await t.shot(label); };
    await at(-140, 190, [1, 0], "x-kerb-west");
    await at(0, 186, [1, 0], "x-kerb-mid");
    await at(120, 230, [0, 1], "x-fence");
    await at(-150, 80, [0, 1], "x-inleg");
    await at(-40, 120, [0.6, 1], "x-lot");
    await at(60, 230, [0, -1], "x-back");
    console.log("planes", JSON.stringify(await g(`ctx.airport.debug.planes()`)));
    console.log("veh", JSON.stringify(await g(`ctx.airport.debug.vehicles()`)));
  },
};
