// 🐞 QA in a town (Lakewood), the focused repros the play-test sweep found — each with the watchdog
// (scripts/lib/qawatch.js) on:
//   • the free camera on foot keeps to her side of a wall: turned toward a block of houses it comes in, never sits inside
//   • getting out of the car right up against a block (nose-in, side-on) lands her on the street side, never inside it
//   • pulling a car over in a cop car (rides' 🚨 PULL OVER → law's lawStop) plays IN town — it used to throw her back
//     onto the highway mid-scene (the town only allowed a state named "copStop", which doesn't exist)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qatown",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.frames(20);
    await W.reset(t);

    // spots along the streets where a solid block stands right behind the sidewalk on the + side: { name, along, n (unit
    // normal toward the block, world), kerb (world point at d = WALK + 1.2 — the back of the sidewalk) }
    const spots = await g(`(() => { const T = ctx.town, PL = T.plan, O = PL.ORIGIN, out = [];
      for (const st of PL.STREETS) { if (st.axis === "diag") continue;
        for (let a = st.a0 + 30; a < st.a1 - 30 && out.length < 40; a += 23) {
          const p0 = T.debug.pt(st.name, a, 0), pb = T.debug.pt(st.name, a, st.front + 4), pw = T.debug.pt(st.name, a, st.front - 1.0);
          if (!PL.OCCLUDERS.some(r => pb.x > r.x0 && pb.x < r.x1 && pb.z > r.z0 && pb.z < r.z1)) continue;
          // not at a crossing (the block must run on both ways)
          const ok = [-8, 8].every(k => { const q = T.debug.pt(st.name, a + k, st.front + 4); return PL.OCCLUDERS.some(r => q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1); });
          if (!ok) continue;
          const nx = (pb.x - p0.x) / (st.front + 4), nz = (pb.z - p0.z) / (st.front + 4);
          out.push({ name: st.name, along: a, front: st.front, nx, nz, x: O.x + pw.x, z: O.z + pw.z });
        } }
      return out.filter((s, i) => i % 3 === 0).slice(0, 6); })()`);
    t.check("found spots right beside a block of houses", spots.length >= 3, String(spots.length));

    // ── on foot: the free camera turned toward the houses ──
    await g(`(ctx.foot.start("droveOff"), true)`);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000)) return;
    let worst = null, inside = 0;
    for (const sp of spots) {
      // stand at the back of the sidewalk, camera BEHIND her toward the block (she faces the street)
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${sp.x}, 0, ${sp.z}); F.vel.set(0, 0, 0); ctx.cam.free.yaw = Math.atan2(${-sp.nx}, ${-sp.nz}); ctx.cam.free.pitch = 0.2; return true; })()`);
      await t.frames(20);
      const r = await t.L(`(() => { const c = __lulu3d.ctx.camera.position, F = __lulu3d.ctx.foot.debug.F; return { s: window.__qa.solidAt(c.x, c.z, c.y, 0.05), d: +Math.hypot(c.x - F.pos.x, c.z - F.pos.z).toFixed(2), back: +((c.x - F.pos.x) * ${sp.nx} + (c.z - F.pos.z) * ${sp.nz}).toFixed(2) }; })()`);
      if (r.s) { inside++; worst = worst || `${sp.name}@${sp.along}: ${r.s} (cam ${r.d} m back)`; }
      sp.cam = r;
    }
    await t.shot("camera-at-wall");
    t.check("turned toward a block of houses, the camera never sits inside it", inside === 0, worst || spots.map(s => s.cam.back).join(","));
    t.check("…it comes in to her side of the wall (≤ 3 m behind her toward the block)", spots.every(s => s.cam.back <= 3.0), spots.map(s => s.cam.back).join(","));
    // and with the camera turned away again it goes back out to its usual distance
    await g(`(ctx.cam.free.yaw = Math.atan2(${spots[0] ? spots[0].nx : 0}, ${spots[0] ? spots[0].nz : 1}), true)`);
    await t.frames(45);
    const back = await g(`Math.hypot(ctx.camera.position.x - ctx.foot.pos.x, ctx.camera.position.z - ctx.foot.pos.z)`);
    t.check("turned back to the street, it eases back out (≥ 5 m)", back >= 5, back.toFixed(2));

    // walking ALONG the houses (the camera right behind her, parallel to the wall): it must not hug her
    if (spots[0]) {
      const sp = spots[0];
      await W.moved(t);
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${sp.x} + ${sp.nx} * 0.9, 0, ${sp.z} + ${sp.nz} * 0.9); F.vel.set(0, 0, 0); ctx.cam.free.yaw = Math.atan2(${-sp.nz}, ${sp.nx}); ctx.cam.free.pitch = 0.29; return true; })()`);
      await t.frames(10);
      let minD = 99;
      await t.stick(0, -1);
      let why = null;
      for (let i = 0; i < 8; i++) {
        await t.frames(5);
        const d = await g(`Math.hypot(ctx.camera.position.x - ctx.foot.pos.x, ctx.camera.position.z - ctx.foot.pos.z)`);
        if (d < minD) { minD = d; if (d < 4.5) why = await t.L(`import("./js/features/foot/jump.js").then(m => { const c = __lulu3d.ctx, F = c.foot.debug.F, y = c.cam.free.yaw, p = c.cam.free.pitch, cp = Math.cos(p);
            const tgt = { x: F.pos.x, y: 1.25, z: F.pos.z }, dx = -Math.sin(y) * cp, dz = -Math.cos(y) * cp, dy = Math.sin(p), lim = m.camClip(F, tgt, dx, dy, dz, 6.6);
            const near = []; for (const ch of c.world.activeChunks()) for (const k of ch.colliders) { const q = Math.hypot(k.x - F.pos.x, k.z - F.pos.z); if (q < 7 && k.r >= 0.5) near.push(k.kind + ":" + k.r.toFixed(2) + "@" + q.toFixed(1) + "/lat " + (((k.x - F.pos.x) * dz - (k.z - F.pos.z) * dx) / Math.hypot(dx, dz)).toFixed(2)); }
            return { lim: +lim.toFixed(2), clipD: c.cam.free.clipD, near: near.slice(0, 12) }; })`); }
      }
      if (why) console.log("   along the houses:", JSON.stringify(why));
      await t.stick(0, 0);
      t.check("walking along the houses, the camera stays back behind her (≥ 4.5 m)", minD >= 4.5, minD.toFixed(2));
    }

    // ── a street tree right behind her: the camera must not end up in its leaves (a dark / black screen) ──
    const trees = await g(`(() => { const out = []; for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders) if (c.kind === "tree" && !c.off) out.push({ x: c.x, z: c.z, r: c.r }); return out.slice(0, 40).filter((c, i) => i % 8 === 0).slice(0, 4); })()`);
    t.check("street trees in town", trees.length > 0, String(trees.length));
    let leafy = [];
    for (const tr of trees) {
      // stand 4.5 m from the trunk, camera turned to look at her from the tree's side (it would sit right in the canopy)
      await W.moved(t);
      await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${tr.x} + 4.5, 0, ${tr.z}); F.vel.set(0, 0, 0); ctx.cam.free.yaw = Math.atan2(1, 0); ctx.cam.free.pitch = 0.29; return true; })()`);
      await t.frames(20);
      const c = await g(`(() => { const p = ctx.camera.position; return { y: +p.y.toFixed(2), d: +Math.hypot(p.x - ${tr.x}, p.z - ${tr.z}).toFixed(2) }; })()`);
      if (c.y > 2.1 && c.y < 6.5 && c.d < 2.0) leafy.push(Object.assign({ tree: [tr.x.toFixed(0), tr.z.toFixed(0)] }, c));
    }
    await t.shot("under-a-tree");
    t.check("a tree behind her: the camera stays out of its leaves", leafy.length === 0, JSON.stringify(leafy));

    // ── getting out right against a block: nose-in, and side-on ──
    await g(`ctx.foot.debug.getIn()`);
    await t.until(`__lulu3d.state === "playing"`, "back in the car", 3000);
    await t.frames(10);
    const outs = [];
    for (const sp of spots.slice(0, 4)) for (const how of ["nose", "side"]) {
      // the car's box right at the ring of the block (front + 0.15 is as far as anything solid lets it go)
      const d = how === "nose" ? sp.front - 2.3 : sp.front - 1.1;
      await g(`(() => { const T = ctx.town, st = T.plan.byName[${JSON.stringify(sp.name)}]; T.debug.place(${JSON.stringify(sp.name)}, ${sp.along}, ${d}, 0, 1);
        const car = ctx.car; ${how === "nose" ? `car.h = Math.atan2(${sp.nx}, ${sp.nz}); car.place(car.pos.x, car.pos.z, car.h);` : ""} car.vx = car.vz = 0; ctx.cam.snap(); return true; })()`);
      await t.frames(6);
      await W.reset(t);
      await g(`(ctx.foot.start("droveOff"), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
      await t.frames(8);
      const r = await t.L(`(() => { const F = __lulu3d.ctx.foot.debug.F; return { s: window.__qa.solidAt(F.pos.x, F.pos.z, 0.3, 0.15), back: +((F.pos.x - ${sp.x}) * ${sp.nx} + (F.pos.z - ${sp.z}) * ${sp.nz}).toFixed(2) }; })()`);
      const rep = await W.report(t);
      outs.push({ where: `${sp.name}@${sp.along} ${how}`, s: r.s, back: r.back, cam: rep.issues.filter(i => i.kind === "inwall" && !/tree's leaves/.test(i.msg)).length });
      // (a kerbside tree's leaves: the DRIVING chase cam already sat in them while the car was parked under it — the car
      //  camera has no collision; that's the glide's starting picture, not the climb-out shot — see AGENTS §7 QA sweep)
      for (const i of rep.issues) console.log(`    · ${sp.name}@${sp.along} ${how} [${i.kind}] f${i.f} ${i.msg} ×${i.n}`);
      await g(`ctx.foot.debug.getIn()`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 3000);
      await t.frames(4);
    }
    await t.shot("got-out-at-wall");
    t.check("out of a car parked against a block, she lands on the street side (never inside it)", outs.every(o => !o.s && o.back < 1.5), JSON.stringify(outs.filter(o => o.s || o.back >= 1.5)));
    t.check("…and the climbing-out shot never puts the camera inside the houses", outs.every(o => !o.cam), JSON.stringify(outs.filter(o => o.cam)));

    // ── 🚨 pulling a car over in town (a cop car's PULL OVER) ──
    await t.frames(30);
    const target = await g(`(() => { const car = ctx.car, r = ctx.world.road;
      let c = ctx.traffic.cars.find(c => c.data && c.data.town && !c.hit && c.dir >= 0 && !c.data.footStub && c !== ctx.town.debug.C.patrol);
      if (!c) c = ctx.town.addDriver("minivan", { minD: 30, speed: 6 });
      if (!c) return null;
      const p = r.point(c.s - 16, c.d, {}); car.place(p.x, p.z, p.h); car.s = c.s - 16; car.d = c.d; car.vx = Math.sin(p.h) * 5; car.vz = Math.cos(p.h) * 5; ctx.cam.snap();
      return { s: c.s, d: c.d, dir: c.dir }; })()`);
    t.check("a town driver ahead to pull over", !!target, JSON.stringify(target));
    await t.frames(2);
    const before = await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`);
    await W.reset(t);
    const pulled = await g(`ctx.law.pullOver()`);
    await t.frames(3);
    const after = await g(`({ town: ctx.town.active, state: ctx.state, moved: Math.hypot(ctx.car.pos.x - ${before.x}, ctx.car.pos.z - ${before.z}) })`);
    t.check("🚨 PULL OVER in town: the scene plays right there (still in town, the car didn't jump)", pulled && after.town && after.state === "lawStop" && after.moved < 5, JSON.stringify(Object.assign({ pulled }, after)));
    await t.frames(60);
    await t.shot("pullover-in-town");
    await g(`(L3.setState("playing"), true)`);
    await t.frames(10);
    const rep = await W.report(t); W.log(rep);
    W.check(t, "pull-over in town", rep, ["jump", "nan", "overlay", "flat"]);
  },
};
