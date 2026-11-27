// 👜 Maison de Gelt's door at JFK (features/clothes/airdoor.js — the owner allowed the luxury store's door at the airport):
//   • a sign on Terminal 4½'s front + a ✋ GO INTO MAISON DE GELT on the pavement in front of it (ctx.airport.at(f, r))
//   • in = the luxury room (dressed "jfk"); out = the same spot on the pavement, still on the landside
const W = require("../lib/qawatch.js");
module.exports = {
  name: "clothesjfk",
  viewport: { width: 1280, height: 720 },
  query: "&enable=airport,foot,atmos&maison=1",
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await W.install(t);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await W.pause(t, false);        // (the test moves her car into the landside: a declared teleport)
    if (!await t.until(`!!__lulu3d.ctx.airport.planned`, "the airport planned", 60000)) return;
    await g(`ctx.airport.debug.ahead(500)`);
    if (!await t.until(`!!__lulu3d.ctx.airport.at(0, 200)`, "the landside built", 90000)) return;
    const k = await g(`(() => { const p = ctx.airport.debug.world(80, 193.5), h = ctx.airport.debug.G().F.yaw(1, 0); const n = ctx.world.highway.nearest(p.x, p.z, ctx.car.s, {}); ctx.car.place(p.x, p.z, h); ctx.car.s = n.s; ctx.car.d = n.d; ctx.cam.snap(); return true; })()`);
    if (!await t.until(`__lulu3d.ctx.airport.inside`, "on the landside", 20000)) return;
    await g(`ctx.foot.start("droveOff")`);
    if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "out on foot at the kerb", 30000)) return;
    await t.frames(60);
    t.check("the MAISON DE GELT sign hangs on Terminal 4½'s front", await g(`(() => { const D = ctx.clothes.debug.air.D, q = D.sign && ctx.airport.debug.local(D.sign.position.x, D.sign.position.z); return !!(D.sign && D.sign.parent && q && q.f > 80 && q.f < 95 && q.r > 202 && q.r < 203.2); })()`));
    const at = await g(`ctx.clothes.debug.air.D.at`);
    await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${at.x}, 0.05, ${at.z}); F.phase = "walk"; ctx.foot.obj.position.copy(F.pos); ctx.cam.snap(); return true; })()`);
    await t.frames(6);
    const l = await g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check(`✋ at the shopfront: ${l}`, /MAISON DE GELT/.test(l));
    await t.shot("maison-front");
    await t.tap(0);
    const inn = await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && /MAISON/.test(__interiors.room.def.title)`, "inside Maison de Gelt", 60000);
    t.check("…in: the luxury room", inn);
    await t.frames(20);
    await g(`(__interiors.room.leave(), true)`);
    await t.until(`__lulu3d.state === "footRun"`, "back out", 30000);
    await t.frames(10);
    const back = await g(`(() => { const p = ctx.foot.pos; return { d: +Math.hypot(p.x - ${at.x}, p.z - ${at.z}).toFixed(1), inside: ctx.airport.inside }; })()`);
    t.check(`…out: the same spot on the pavement (${back.d} m), still on the landside`, back.d < 3 && back.inside, JSON.stringify(back));
  },
};
