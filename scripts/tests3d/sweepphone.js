// 📱 The phone sweep, part 1 — THE FIRST FIVE MINUTES on a phone held upright (390 × 844, touch), EMPTY save: the title →
// ▶ PLAY → at home on foot (one clear next thing on screen, nothing stacked, no controller words) → into the car → the
// first drive (the tutorial's cards point at real touch buttons) → out again. Screenshots: SWEEP_SHOTS=1 →
// smoke-shots/sweepphone/.
const { make, W } = require("../lib/sweepphone.js");

module.exports = {
  name: "sweepphone",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t), g = t.game;
    await W.install(t);
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.frames(10);
    await S.shot("01-title");
    await S.dump("title");
    await S.badText("title", { touch: true, w: 390 });
    const ok = await t.click(/PLAY/);
    t.check("▶ PLAY is on the title", ok);
    for (let i = 0; i < 8; i++) {
      await t.frames(30);
      const st = await g(`L3.state`);
      S.log(`+${i + 1}s state ${st}`);
      if (i === 1 || i === 3 || i === 7) { await S.shot(`02-home-${i + 1}s`); await S.dump(`home ${i + 1}s`); }
    }
    await S.badText("at home", { touch: true, w: 390 });
    // where's her car? (on screen, so "drag the WALK pad to your car" means something)
    const carView = () => g(`(() => { const c = ctx.foot.parkedCar, cam = ctx.camera; if (!c) return null; const v = new cam.position.constructor(c.x, 1, c.z).project(cam);
      const F = ctx.foot.debug.F; return { sx: Math.round((v.x + 1) * innerWidth / 2), sy: Math.round((1 - v.y) * innerHeight / 2), front: v.z < 1, d: +Math.hypot(c.x - F.pos.x, c.z - F.pos.z).toFixed(1) }; })()`);
    const cv = await carView();
    S.log("car on screen: " + JSON.stringify(cv));
    t.check("the first start: her car is in the picture (the hint says walk to it)", cv && cv.front && cv.sx > 0 && cv.sx < 390 && cv.sy > 0 && cv.sy < 844, JSON.stringify(cv));
    for (let i = 0; i < 2; i++) { await t.frames(150); await S.shot(`03-home-${10 + i * 5}s`); await S.dump(`home ${10 + i * 5}s`); }
    // walk up to the car (put her beside it, facing it) → the HAND button says GET IN → tap it
    await g(`(() => { const c = ctx.foot.parkedCar, F = ctx.foot.debug.F; const a = Math.atan2(F.pos.x - c.x, F.pos.z - c.z); F.pos.x = c.x + Math.sin(a) * 2.2; F.pos.z = c.z + Math.cos(a) * 2.2; F.lulu.obj.rotation.y = a + Math.PI; return true; })()`);
    await W.moved(t);
    await t.frames(20);
    await S.shot("04-at-car");
    const hand = await S.dump("at the car");
    t.check("at her car the HAND button / prompt says how to get in", hand.some(x => /GET IN|hop in|DRIVE/i.test(x.tx)), hand.filter(x => /tx_foot_hand|prompt/.test(x.id + x.cls)).map(x => x.tx).join(" | "));
    await S.tapEl("tx_foot_hand");
    await t.until(`!__lulu3d.ctx.foot.active`, "in the car", 20000);
    for (let i = 0; i < 6; i++) { await t.frames(60); await S.shot(`05-drive-${(i + 1) * 2}s`); await S.dump(`drive ${(i + 1) * 2}s`); }
    await S.badText("first drive", { touch: true, w: 390 });
    S.log("state " + await g(`L3.state`) + " tutorial " + await g(`JSON.stringify(ctx.meta && ctx.meta.tutorial ? ctx.meta.tutorial : null)`));
  },
};
