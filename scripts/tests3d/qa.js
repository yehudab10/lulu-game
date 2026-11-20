// 🐞 QA sweep: real flows with EVERY feature on, watched frame by frame by the watchdog (scripts/lib/qawatch.js).
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa",
  query: "&enable=all",
  viewport: { width: 960, height: 540 },
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async label => { const r = await W.report(t); W.log(r); W.check(t, label, r); await W.reset(t); return r; };
    const walkTo = async (x, z, max = 40) => {
      for (let i = 0; i < max; i++) {
        const v = await g(`(() => { const F = ctx.foot.debug.F, p = F.pos, h = F.frameYaw != null ? F.frameYaw : F.h, dx = ${x} - p.x, dz = ${z} - p.z, d = Math.hypot(dx, dz);
          if (d < 1.6) return null; return [(-dx * Math.cos(h) + dz * Math.sin(h)) / d, -(dx * Math.sin(h) + dz * Math.cos(h)) / d]; })()`);
        if (!v) break;
        await t.stick(v[0], v[1]); await t.frames(3);
      }
      await t.stick(0, 0);
    };

    // ── the home start: walk to the car, get in, pull out ──
    await t.click(/Cruise|PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "starts on foot at home", 6000)) return;
    await t.frames(20);
    const car = await g(`({ x: ctx.foot.parkedCar.x, z: ctx.foot.parkedCar.z })`);
    await walkTo(car.x, car.z);
    await t.frames(4);
    await t.tap(0);
    await t.until(`__lulu3d.state === "worldPullOut"`, "hops in", 3000);
    await t.hold(7, 0.6);
    await t.until(`__lulu3d.state === "playing"`, "pulls out onto the street", 20000);
    await t.hold(7, 1);
    await t.frames(150);
    await t.hold(7, 0);
    await t.shot("home-driving");
    await seg("home start → driving");

    // ── pull over on the highway, get out, walk the shoulder + the fields, back in ──
    await t.hold(6, 1); await t.frames(60); await t.hold(6, 0);
    await g(`(ctx.foot.start("droveOff"), true)`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    for (const [x, y, n] of [[1, 0, 40], [1, -1, 60], [0, 1, 40], [-1, 0, 80], [0, -1, 40]]) { await t.stick(x, y); await t.frames(n); }
    await t.stick(0, 0);
    await t.L(`(__pad.axes[2] = 1, true)`); await t.frames(40); await t.L(`(__pad.axes[2] = 0, __pad.axes[3] = -1, true)`); await t.frames(20); await t.L(`(__pad.axes[3] = 0, true)`);
    await t.shot("fields");
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`__lulu3d.state === "playing"`, "back in the car", 3000);
    await t.frames(30);
    await seg("highway: out, walk, back in");

    // ── Lakewood: into town, park at the kerb, get out, walk ──
    await g(`(ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.hold(7, 1); await t.frames(60); await t.hold(7, 0); await t.hold(6, 1); await t.frames(40); await t.hold(6, 0);
    await g(`(ctx.foot.start("droveOff"), true)`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car in town", 6000);
    for (const [x, y, n] of [[1, 0, 40], [1, -1, 60], [0, 1, 40], [-1, 0, 80], [0, -1, 60], [-1, -1, 60]]) { await t.stick(x, y); await t.frames(n); }
    await t.stick(0, 0);
    for (const a of [1, -1]) { await t.L(`(__pad.axes[2] = ${a}, true)`); await t.frames(30); }
    await t.L(`(__pad.axes[2] = 0, true)`);
    await t.shot("town-walk");
    await seg("Lakewood on foot");

    // ── the monkey: random sticks, looks and buttons (✋, jump, roll, emote, gas, brake) in town, on foot and in the car ──
    const monkey = async (frames, seed) => {
      let r = seed;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let f = 0; f < frames; f += 6) {
        await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1.2).toFixed(2)}, __pad.axes[2] = ${rnd() < 0.3 ? (rnd() * 2 - 1).toFixed(2) : 0}, __pad.axes[3] = ${rnd() < 0.15 ? (rnd() * 2 - 1).toFixed(2) : 0}, true)`);
        const b = [0, 1, 2, 3, 7, 6, null, null][Math.floor(rnd() * 8)];
        if (b != null) await t.L(`__btn(${b}, 1)`);
        await t.frames(3);
        if (b != null) await t.L(`__btn(${b}, 0)`);
        await t.frames(3);
      }
      await t.L(`(__pad.axes[0] = __pad.axes[1] = __pad.axes[2] = __pad.axes[3] = 0, true)`);
    };
    await monkey(900, 7);
    await t.shot("town-monkey");
    await seg("Lakewood monkey run");
  },
};
