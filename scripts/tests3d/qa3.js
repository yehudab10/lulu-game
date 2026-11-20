// 🐞 QA sweep, part 3 (every feature on, the watchdog in scripts/lib/qawatch.js on): the EDGES of each town on foot
// (where does she stop, and is there something there?), jumping onto a parked car in town, a hit on foot on the
// highway, and quitting to the title from the pause menu while she walks in a town.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa3",
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
    const onFoot = async () => {
      await g(`(ctx.foot.start("droveOff"), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    };
    // walk (camera-relative stick) toward a world direction for n frames
    const walkDir = async (dx, dz, n) => {
      for (let i = 0; i < n; i += 6) {
        const v = await g(`(() => { const F = ctx.foot.debug.F, h = F.frameYaw != null ? F.frameYaw : F.h, X = ${dx}, Z = ${dz}, d = Math.hypot(X, Z); return [(-X * Math.cos(h) + Z * Math.sin(h)) / d, -(X * Math.sin(h) + Z * Math.cos(h)) / d]; })()`);
        await t.stick(v[0], v[1]); await t.frames(6);
      }
      await t.stick(0, 0);
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;

    for (const town of ["lakewood", "midwood"]) {
      await g(`(ctx.town.load("${town}"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town}'s models load`, 90000)) continue;
      if (await g(`ctx.town.active`)) { await g(`L3.startRun({ mode: "cruise", quick: true })`); await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.town.active`, "a fresh cruise", 9000); }
      await W.moved(t);
      await W.moved(t);
      await g(`ctx.town.enter({ town: "${town}", speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active`, `in ${town}`, 8000)) continue;
      await t.frames(10);
      if (!await onFoot()) continue;
      // the four outermost streets: walk off the grid from each, past the sidewalk, as far as she goes
      const edges = await g(`(() => { const T = ctx.town, PL = T.plan; let b = { minx: 1e9, maxx: -1e9, minz: 1e9, maxz: -1e9 };
        const pts = []; for (const st of PL.STREETS) for (let a = st.a0; a <= st.a1; a += 20) { const p = T.debug.pt(st.name, a, 0); pts.push([p.x, p.z, st.name, a]); b.minx = Math.min(b.minx, p.x); b.maxx = Math.max(b.maxx, p.x); b.minz = Math.min(b.minz, p.z); b.maxz = Math.max(b.maxz, p.z); }
        // (local → world with the town's turn — PL.world / COS / SIN)
        const pick = (f, lx, lz) => { const p = pts.reduce((m, q) => f(q) > f(m) ? q : m), W = PL.world(p[0], p[1], {}); return { x: W.x, z: W.z, dx: lx * PL.COS + lz * PL.SIN, dz: -lx * PL.SIN + lz * PL.COS, st: p[2], a: p[3] }; };
        return [pick(q => -q[0], -1, 0), pick(q => q[0], 1, 0), pick(q => -q[1], 0, -1), pick(q => q[1], 0, 1)]; })()`);
      const ends = [];
      for (const e of edges) {
        await W.moved(t);
        await g(`(() => { const F = ctx.foot.debug.F; F.pos.set((${e.x}), 0, (${e.z})); F.vel.set(0, 0, 0); ctx.cam.free.yaw = Math.atan2((${e.dx}), (${e.dz})); return true; })()`);
        await t.frames(6);
        await walkDir(e.dx, e.dz, 150);
        const r = await g(`(() => { const F = ctx.foot.debug.F; return { out: +((F.pos.x - (${e.x})) * (${e.dx}) + (F.pos.z - (${e.z})) * (${e.dz})).toFixed(1), d: +F.d.toFixed(1) }; })()`);
        ends.push(Object.assign({ st: e.st, dir: [e.dx, e.dz] }, r));
      }
      console.log(`   ${town} edges:`, JSON.stringify(ends));
      await t.shot(`${town}-edge`);
      await seg(`${town}: walking off every edge of the grid`, ["jump", "nan", "overlay", "flat", "underground", "inside", "invisible", "hidden"]);
    }

    // ── jump onto a parked car at the kerb (a town's parked cars are hood / roof boxes) ──
    if (await g(`ctx.town.active && L3.state === "footRun"`)) {
      const pc = await g(`(() => { const F = ctx.foot.debug.F; let best = null, bd = 1e9; for (const p of F.parked) { if (!(p.vtype === "car")) continue; const d = Math.hypot(p.x - F.pos.x, p.z - F.pos.z); if (d < bd) { bd = d; best = p; } } return best ? { x: best.x, z: best.z, h: best.h } : null; })()`);
      if (pc) {
        // stand 2.2 m off its side, facing it, and jump twice (hood, then roof)
        await W.moved(t);
        await g(`(() => { const F = ctx.foot.debug.F, rx = Math.cos(${pc.h}), rz = -Math.sin(${pc.h}); F.pos.set(${pc.x} + rx * 2.2, 0, ${pc.z} + rz * 2.2); F.vel.set(0, 0, 0); ctx.cam.free.yaw = Math.atan2(-rx, -rz); return true; })()`);
        await t.frames(6);
        for (let i = 0; i < 2; i++) { await t.stick(0, -1); await t.hold(1, 1); await t.frames(8); await t.hold(1, 0); await t.frames(20); }
        await t.stick(0, 0); await t.frames(20);
        const top = await g(`+(ctx.foot.debug.F.ground || 0).toFixed(2)`);
        console.log("   up on a parked car:", top);
        await t.shot("on-a-parked-car");
        await t.stick(1, 0); await t.frames(30); await t.stick(0, 0); await t.frames(20);
        await seg("jumping onto a parked car in town", ["jump", "nan", "inside", "invisible", "hidden"]);
      }
    }

    // ── quit to the title from the pause menu while walking in town ──
    await t.key("Escape");
    await t.frames(3);
    const quit = await t.L(`(() => { const b = [...document.querySelectorAll("#screenCard button, [data-pi]")].find(b => /quit|title|home/i.test(b.textContent)); if (b) b.click(); return b ? b.textContent.trim() : null; })()`);
    t.check("the pause menu on foot has a way back to the title", !!quit, String(quit));
    await t.until(`__lulu3d.state === "title"`, "back at the title", 6000);
    await t.frames(30);
    t.check("…the town is gone, nothing left covering the screen", await g(`!ctx.town.active`) && (await t.L(`window.__qa.covered()`)).length === 0, JSON.stringify(await t.L(`window.__qa.covered()`)));
    await seg("quit to the title from town", ["nan", "overlay", "stuck"]);

    // ── hit on foot on the highway (a heart), knocked out on foot (out of hearts) ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "a cruise again", 9000);
    await t.frames(10);
    if (await onFoot()) {
      await W.moved(t);
      await g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, p = r.point(F.s, 1.75, {}); F.pos.set(p.x, 0, p.z); ctx.G.invT = 0; ctx.G.invSoft = false; ctx.G.hearts = 2; ctx.foot.force.er = false; ctx.traffic.add("sedan", F.s - 2.6, 1.75, 1, 14, { keep: true }); return true; })()`);
      await t.until(`__lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "knock"`, "a car knocks her flat", 3000);
      await t.until(`__lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "up again", 9000);
      await t.frames(30);
      await seg("hit on foot on the highway");
    }
  },
};
