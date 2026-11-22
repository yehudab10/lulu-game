// 🐞 QA: the ONE-WORLD SEAM (ci/oneworld) — the line on each attached town's approach road where the highway's road hands
// over to the town's and back (in at 4 m past it, out 2 m short). With the watchdog (scripts/lib/qawatch.js) on, for
// both towns: drive across it in and out, walk across it in and out, stop / get out / get back in right ON it, be
// knocked out on it (in the car and on foot), be arrested on it, and run a cop chase across it.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qaseam",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    // the approach road of the standing town `id`, as world points: A(along, lat) → {x, z}, and its heading (inward)
    const AP = id => `(() => { const en = __lulu3d.ctx.town.debug.S.built.find(e => e.def && (e.def.id === "${id}" || (e.def.base && e.def.base.id === "${id}")) && e.ready); if (!en) return null;
      const [fx, fz] = en.def.approach.from, [tx, tz] = en.def.approach.to, L = Math.hypot(tx - fx, tz - fz), ux = (tx - fx) / L, uz = (tz - fz) / L, co = Math.cos(en.at.rot), si = Math.sin(en.at.rot);
      const W = (lx, lz) => ({ x: en.at.x + lx * co + lz * si, z: en.at.z - lx * si + lz * co });
      return { A: (al, lat = 0) => W(fx + ux * al - uz * lat, fz + uz * al + ux * lat), dir: W(fx + ux, fz + uz), o: W(fx, fz), len: L }; })()`;
    const at = (id, along, lat = 0) => `(() => { const a = ${AP(id)}; if (!a) return null; const p = a.A(${along}, ${lat}), q = a.A(${along} + 1, ${lat}); return { x: p.x, z: p.z, h: Math.atan2(q.x - p.x, q.z - p.z) }; })()`;
    const placeCar = async (id, along, lat, v, back = false) => {
      await W.moved(t);
      return g(`(() => { const p = ${at(id, along, lat)}; if (!p) return false; const car = ctx.car, h = p.h + (${back} ? Math.PI : 0), n = ctx.world.road.nearest(p.x, p.z, car.s, {});
        car.place(p.x, p.z, h); car.s = n.s; car.d = n.d; car.vx = Math.sin(h) * ${v}; car.vz = Math.cos(h) * ${v}; car.vF = ${v}; ctx.cam.snap(); return true; })()`);
    };
    const onFoot = async () => {
      await g(`(ctx.foot.start("droveOff"), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    };
    // walk along the approach (+1 inward / -1 outward) for n frames, camera behind her
    const walkAlong = async (id, sign, n) => {
      await W.moved(t);     // (the test turns the camera round itself: a declared cut)
      await g(`(() => { const a = ${AP(id)}; const d = { x: a.dir.x - a.o.x, z: a.dir.z - a.o.z }; ctx.cam.free.yaw = Math.atan2(d.x * ${sign}, d.z * ${sign}); return true; })()`);
      await t.stick(0, -1); await t.frames(n); await t.stick(0, 0);
    };
    const inTown = () => g(`ctx.town.active`);

    for (const id of ["lakewood", "midwood"]) {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing"`, "a cruise", 9000)) return;
      await g(`(ctx.law.hold && ctx.law.hold(1200), true)`);
      // an interchange ahead, its towns standing (built in slices from 900 m out)
      await W.moved(t);
      const s0 = await g(`ctx.car.s`);
      await g(`(() => { const r = ctx.world.road, s = ${s0} + 1200, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      // (as flow's one-world check: both towns' models, then come up the lane toward the interchange — the towns build in
      //  slices from 900 m out while she drives)
      await g(`(ctx.town.load("lakewood"), ctx.town.load("midwood"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood") && __lulu3d.ctx.town.loaded("midwood")`, "both towns' models", 120000)) continue;
      const E = await g(`ctx.town.debug.exitAhead(700, "${id}")`);   // (each town its own exit)
      await W.moved(t);
      await g(`(() => { const s = ${E} - 600, p = ctx.world.highway.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25;
        ctx.car.vx = Math.sin(p.h) * 14; ctx.car.vz = Math.cos(p.h) * 14; ctx.car.vF = 14; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.hold(7, 0.5);
      const ok = await t.until(`!!(${AP(id)})`, `${id} stands at its interchange (built)`, 60000);
      await t.hold(7, 0);
      if (!ok) continue;
      const len = await g(`(${AP(id)}).len`);
      console.log(`   ${id}: approach ${len.toFixed(0)} m`);

      // ── in the car: across the line inward, then outward ──
      await placeCar(id, -14, 1.5, 7);
      await t.frames(4);
      await W.reset(t);
      await t.hold(7, 0.4); await t.until(`__lulu3d.ctx.town.active`, `${id}: drove across the line (in)`, 12000); await t.frames(20); await t.hold(7, 0);
      t.check(`${id}: driving in across the line → in town`, await inTown());
      await placeCar(id, 14, -1.5, 7, true);
      await t.frames(2);
      await t.hold(7, 0.4); await t.until(`!__lulu3d.ctx.town.active`, `${id}: drove across the line (out)`, 12000); await t.frames(20); await t.hold(7, 0);
      t.check(`${id}: driving out across the line → back on the highway's road`, !await inTown());
      await t.hold(6, 1); await t.frames(30); await t.hold(6, 0);
      await seg(`${id}: driving across the line, in and out`);

      // ── on foot: across the line inward, then outward ──
      await placeCar(id, -8, 3.5, 0);
      await t.frames(4);
      if (await onFoot()) {
        // (she climbs out on the car's far side now — over its own side, ci/qaweekend: put her on the approach's edge so the
        //  walk is along the road, as a player would walk it)
        await W.moved(t);
        await g(`(() => { const p = (${AP(id)}).A(-6, 2); const F = ctx.foot.debug.F; F.pos.set(p.x, 0, p.z); F.vel.set(0, 0, 0); F.lulu.obj.position.copy(F.pos); return true; })()`);
        await t.frames(3);
        await W.reset(t);
        await walkAlong(id, 1, 120);
        t.check(`${id}: walking in across the line → in town`, await inTown(), JSON.stringify(await g(`({ s: ctx.foot.debug.F.s, d: ctx.foot.debug.F.d })`)));
        await walkAlong(id, -1, 150);
        t.check(`${id}: walking out across the line → back on the highway's road`, !await inTown());
        await t.shot(`${id}-seam-foot`);
        await seg(`${id}: walking across the line, in and out`);
        await g(`ctx.foot.debug.getIn()`);
        await t.until(`__lulu3d.state === "playing"`, "back in", 4000);
      }

      // ── stopped right ON the line (in the hysteresis band): out, a few steps each way, back in ──
      for (const al of [1, 3, 5]) {
        await placeCar(id, al, 1.5, 0);
        await t.frames(6);
        await W.reset(t);
        if (!await onFoot()) continue;
        for (const [x, y, n] of [[0, -1, 20], [0, 1, 30], [1, 0, 20], [-1, 0, 25]]) { await t.stick(x, y); await t.frames(n); }
        await t.stick(0, 0);
        await g(`ctx.foot.debug.getIn()`);
        await t.until(`__lulu3d.state === "playing"`, `${id}: back in on the line`, 4000);
        await t.frames(20);
        await seg(`${id}: stopped on the line at +${al} m, out and back in`);
      }

      // ── knocked out ON the line, in the car ──
      await placeCar(id, 3, 1.5, 0);
      await t.frames(4);
      await W.reset(t);
      await g(`(ctx.cameos && ctx.cameos.force ? (ctx.cameos.force.scene = false) : 0, ctx.G.invT = 0, ctx.G.invSoft = false, ctx.G.hearts = 1, L3.damage(5, "QA", "qa"), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, `${id}: on her feet after a knock-out on the line`, 12000);
      await t.stick(0, -1); await t.frames(30); await t.stick(0, 0); await t.frames(10);
      await t.shot(`${id}-seam-ko`);
      await seg(`${id}: knocked out on the line (car)`);

      // ── arrested ON the line, on foot ──
      if (await g(`L3.state === "footRun"`)) {
        await W.moved(t);
        await g(`(() => { const p = ${at(id, 3, 4)}; const F = ctx.foot.debug.F; F.pos.set(p.x, 0, p.z); return true; })()`);
        await t.frames(6);
        await W.reset(t);
        await g(`(() => { const F = ctx.foot.debug.F, a = { x: F.pos.x, z: F.pos.z, h: F.h }; ctx.foot.end("arrest"); ctx.law.arrest(["JAYWALKING"], Object.assign({ foot: true, onFoot: true }, a)); return true; })()`);
        await t.until(`__lulu3d.state === "lawArrest"`, `${id}: the arrest on the line`, 3000);
        let far = 0;
        for (let i = 0; i < 8; i++) { await t.frames(15); far = Math.max(far, await g(`Math.hypot(ctx.camera.position.x - ctx.car.pos.x, ctx.camera.position.z - ctx.car.pos.z)`)); }
        t.check(`${id}: arrested on the line — the scene frames her (camera ≤ 25 m from her spot)`, far <= 25, far.toFixed(1));
        await t.shot(`${id}-seam-arrest`);
        await seg(`${id}: arrested on the line`, ["nan", "flat", "underground", "overlay"]);
        await g(`(L3.setState("playing"), true)`);
        await t.frames(10);
      }

      // ── a cop chase across the line (in) ──
      await g(`(ctx.law.hold && ctx.law.hold(0), true)`);
      await placeCar(id, -30, 1.5, 9);
      await t.frames(4);
      await W.reset(t);
      const chased = await g(`ctx.law.startChase("RECKLESS DRIVING")`);
      await t.hold(7, 0.5); await t.until(`__lulu3d.ctx.town.active`, `${id}: chased across the line`, 15000); await t.frames(60); await t.hold(7, 0);
      console.log(`   ${id}: chase`, JSON.stringify(await g(`({ chased: ${!!chased}, chasing: !!ctx.law.chasing, town: ctx.town.active, state: L3.state })`)));
      await t.shot(`${id}-seam-chase`);
      await seg(`${id}: a cop chase across the line`, ["jump", "nan", "overlay", "flat", "underground", "inwall", "hidden"]);
      await g(`(ctx.law.hold && ctx.law.hold(1200), true)`);
    }
  },
};
