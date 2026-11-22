// 🆘 "I'M STUCK" at JFK (`?airport=1`, features/unstuck + features/airport): the car wedged into the terminal's front →
// back on one of the airport's own roads (inside the landside, heading along it, not the highway); on foot inside the
// terminal's front → out on clear ground in the landside; in the terminal hall through a wall → the hall's entry spot;
// 1,500 frames of a player mashing about at the kerb → no automatic rescue. The watchdog reports nothing afterwards.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "unstuck-air",
  query: "&enable=all,unstuck&airport=1",
  save2d: { totalCoins: 600, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    if (!await t.check("?airport=1: the airport is on", await g(`!!(ctx.airport && ctx.airport.on)`))) return;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a drive starts", 30000)) return;
    await W.install(t);
    if (!await t.until(`!!__lulu3d.ctx.airport.planned`, "the airport is planned", 60000)) return;
    const E = await g(`ctx.airport.planned.s`);
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(1e6), true)`);
    const K = await g(`(() => { const L = ctx.airport.debug.LY; return { lane: L.KERB_LANE, door: L.DOORS[1], r0: L.TERM.r0 }; })()`);
    const hw = await g(`(() => { const p = ctx.world.highway.point(${E} - 300, 5.25, {}); return { x: p.x, z: p.z, h: ctx.world.highway.at(${E} - 300).h }; })()`);
    await W.moved(t);
    await g(`(() => { const n = ctx.world.highway.nearest(${hw.x}, ${hw.z}, ctx.car.s, {}); ctx.car.place(${hw.x}, ${hw.z}, ${hw.h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.world.prebuild(n.s); ctx.cam.snap(); return true; })()`);
    if (!await t.until(`__lulu3d.ctx.airport.ready`, "the airport builds", 180000)) return;
    const kp = await g(`(() => { const p = ctx.airport.debug.world(-62, ${K.lane}), F = ctx.airport.debug.G().F; return { x: p.x, z: p.z, h: F.yaw(1, 0) }; })()`);
    const toKerb = async () => { await W.moved(t); return g(`(() => { const n = ctx.world.highway.nearest(${kp.x}, ${kp.z}, ${E} + 300, {}); ctx.car.place(${kp.x}, ${kp.z}, ${kp.h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(n.s); ctx.cam.snap(); return true; })()`); };
    await toKerb();
    await t.frames(30);
    t.check("at the DEPARTURES kerb, inside the landside", await g(`ctx.airport.inside`));
    await W.reset(t);
    const ready = () => g(`(ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.debug.U.autoLast = -1e9, true)`);
    const press = async (label, go = "unstuckGo") => {
      await t.tap(9);
      if (!await t.until(`__lulu3d.ctx.paused`, `${label}: the pause menu opens`, 3000)) return false;
      const has = await t.L(`(() => { const b = document.querySelector('#screenCard [data-pi="unstuck"]'); if (b) b.click(); return !!b; })()`);
      t.check(`${label}: 🆘 in the pause menu`, has, await g(`L3.state`));
      if (!has) { await t.tap(1); return false; }
      await t.frames(2);
      const ok = await t.L(`(() => { const b = document.getElementById("${go}"); if (b) b.click(); return !!b; })()`);
      t.check(`${label}: "${go}"`, ok);
      await t.frames(12);
      await W.reset(t);
      return ok;
    };
    // the terminal's front: a point a couple of metres inside its wall, between the doors
    const wall = await g(`ctx.airport.debug.world(${K.door} + 6, ${K.r0} + 2.5)`);

    // 1 · the car wedged into the terminal → an airport road, inside the landside, heading along it
    await W.moved(t);
    await g(`(() => { const c = ctx.car, n = ctx.world.highway.nearest(${wall.x}, ${wall.z}, ${E} + 300, {}); c.place(${wall.x}, ${wall.z}, c.h); c.s = n.s; c.d = n.d; ctx.cam.snap(); return true; })()`);
    await t.frames(3);
    await ready();
    if (await press("JFK: the car in the terminal")) {
      const c = await g(`(() => { const c = ctx.car, n = ctx.world.highway.nearest(c.pos.x, c.pos.z, c.s, {}), L = ctx.unstuck.normal(c.pos.x, c.pos.z, "car");
        // which way does the road run under her? (the paved run straight ahead vs. sideways)
        const run = a => { let k = 0; for (let r = 2; r <= 10; r += 2) { const q = ctx.world.highway.nearest(c.pos.x + Math.sin(a) * r, c.pos.z + Math.cos(a) * r, c.s, {}); if (L3.pavedAt ? L3.pavedAt(q.s, q.d) >= 3 : true) k++; } return k; };
        return { why: L, inside: ctx.airport.inside, d: +n.d.toFixed(1), v: +c.speed.toFixed(2), state: L3.state, dist: Math.hypot(c.pos.x - ${wall.x}, c.pos.z - ${wall.z}), log: ctx.unstuck.debug.U.log.slice(-1)[0] }; })()`);
      t.check("JFK: the car is on clear ground, still in the landside (not the highway)", c.why == null && c.inside && c.state === "playing" && c.v < 0.5 && Math.abs(c.d) > 9, JSON.stringify(c));
      t.check("JFK: …near the terminal (≤ 90 m)", c.dist <= 90, c.dist.toFixed(1));
      await t.shot("jfk-car-out");
    }

    // 2 · on foot inside the terminal's front → out (automatic: inside a solid, not moving)
    await toKerb();
    await t.frames(10);
    await g(`ctx.foot.start("droveOff")`);
    if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "JFK: out on foot", 30000)) {
      await ready();
      const n0 = await g(`ctx.unstuck.debug.U.log.length`);
      await W.moved(t);
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${wall.x}, 0, ${wall.z}); F.vel.set(0, 0, 0); F.lulu.obj.position.copy(F.pos); ctx.cam.snap(); return true; })()`);
      await t.frames(150);
      const f = await g(`(() => { const F = ctx.foot.debug.F; return { why: ctx.unstuck.normal(F.pos.x, F.pos.z, "foot"), bad: ctx.unstuck.debug.badNow(), inside: ctx.airport.inside, dist: Math.hypot(F.pos.x - ${wall.x}, F.pos.z - ${wall.z}), log: ctx.unstuck.debug.U.log.slice(${n0}) }; })()`);
      console.log("   JFK on foot in the terminal wall →", JSON.stringify(f));
      if (f.log.length === 0 && f.bad == null) t.check("JFK: on foot pushed out of the terminal by the game itself", true);
      else {
        if (f.log.length === 0) { await ready(); await press("JFK: on foot inside the terminal"); }
        const f2 = await g(`(() => { const F = ctx.foot.debug.F; return { why: ctx.unstuck.normal(F.pos.x, F.pos.z, "foot"), inside: ctx.airport.inside, dist: Math.hypot(F.pos.x - ${wall.x}, F.pos.z - ${wall.z}) }; })()`);
        t.check("JFK: on foot out of the terminal, on clear ground, ≤ 90 m", f2.why == null && f2.dist <= 90, JSON.stringify(f2));
      }
      await W.reset(t);
      // 3 · 1,500 frames mashing about at the kerb on foot: no automatic rescue
      const n1 = await g(`ctx.unstuck.debug.U.log.length`);
      await g(`(ctx.G.hearts = 99, ctx.G.maxHearts = 99, true)`);
      let r = 7;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let k = 0; k < 1500; k += 6) {
        await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1.2).toFixed(2)}, true)`);
        const b = [2, 3, 7, null, null][Math.floor(rnd() * 5)];
        if (b != null) await t.L(`__btn(${b}, 1)`);
        await t.frames(3);
        if (b != null) await t.L(`__btn(${b}, 0)`);
        await t.frames(3);
        if (await g(`L3.state !== "footRun"`)) break;
      }
      await t.L(`(__pad.axes[0] = __pad.axes[1] = 0, true)`);
      const extra = await g(`ctx.unstuck.debug.U.log.slice(${n1})`);
      t.check("JFK: 1,500 frames at the kerb — no automatic rescue", extra.length === 0, JSON.stringify(extra));
      await g(`(ctx.G.maxHearts = 3, ctx.G.hearts = 3, true)`);
      W.check(t, "JFK: after the rescues", await W.report(t), ["nan", "overlay", "underground", "hidden", "stuck", "inside"]);
      await W.reset(t);
    }

    // 4 · the terminal hall: Lulu through a wall → the hall's entry spot
    const entered = await g(`(() => { if (L3.state !== "footRun") return false; const d = ctx.airport.debug; return !!(d.enterTerminal && (d.enterTerminal(), true)); })()`);
    if (entered && await t.until(`__lulu3d.state === "interior" && window.__interiors && window.__interiors.room && window.__interiors.room.ready`, "JFK: in the terminal hall", 120000)) {
      await t.frames(20);
      await g(`(() => { const r = window.__interiors.room; r.lulu.obj.position.set(r.bounds.x1 + 8, 0, r.bounds.z1 + 8); return true; })()`);
      await t.frames(3);
      await ready();
      if (await press("JFK: through the terminal's wall")) {
        const r = await g(`(() => { const r = window.__interiors.room, p = r.lulu.obj.position, sp = r.spots.lulu || r.spots.door; return { state: L3.state, d: Math.hypot(p.x - sp.x, p.z - sp.z), inB: p.x >= r.bounds.x0 - 0.5 && p.x <= r.bounds.x1 + 0.5 && p.z >= r.bounds.z0 - 0.5 && p.z <= r.bounds.z1 + 0.5 }; })()`);
        t.check("JFK: back at the hall's entry spot, inside its walls", r.state === "interior" && r.d < 0.5 && r.inB, JSON.stringify(r));
        await t.shot("jfk-hall");
      }
    } else console.log("   (no way into the terminal from here)", entered);
  },
};
