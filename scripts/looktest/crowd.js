// Look test › A CROWD, by graphics tier: on foot in Midwood (Avenue J), measured three ways in one session —
//   street     the street as it is (Lulu on foot, the town's own people + traffic)
//   crowd      + 30 more Lulus walking up and down the street in view (today: the stiff 5-piece Lulu · ?look=2: the
//              skinned one with its walk cycle — animation LOD on) + 12 more of Lulu's car driving past (today's car · the
//              improved one)
// at LOW (weak phones), MEDIUM (what phones get) and HIGH (laptops), today vs ?look=2.
// Per phase: the wall-clock frame (software WebGL: compare runs, don't read it as fps), the JS ms per frame (rAF work),
// draw calls + triangles (the renderer), every real WebGL draw incl. shadows + bloom.
//   NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/crowd.js   (LOOK_TIERS=low,medium,high  → 3d/docs/looktest/perf/crowd.json)
const fs = require("fs");
const path = require("path");
const L = require("./lib.js");

const TIERS = (process.env.LOOK_TIERS || "low,medium,high").split(",");
const FRAMES = +(process.env.LOOK_FRAMES || 60);
const PROBE = `(() => {
  const P = window.__lt = { on: false, js: 0, gl: 0, n: 0, t0: 0 };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) if (C) for (const f of ["drawElements", "drawArrays", "drawElementsInstanced", "drawArraysInstanced"]) {
    const o = C.prototype[f]; if (!o) continue; C.prototype[f] = function () { if (P.on) P.gl++; return o.apply(this, arguments); }; }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const t0 = performance.now(); try { cb(ts); } finally { if (P.on) { P.js += performance.now() - t0; P.n++; } } });
})()`;

async function measure(s) {
  await s.frames(10);
  // (the main scene's own numbers: renderer.render is wrapped so only the game's scene render is counted — the
  //  minimap / portraits / bloom passes render too, and renderer.info only keeps the LAST render of a frame)
  await s.L(`(() => { const r = __lulu3d.renderer; if (!window.__ltWrap) { window.__ltWrap = true; const o = r.render;
    r.render = function (sc, cam) { const x = o.apply(this, arguments); if (__lt.on && sc === __lulu3d.ctx.scene) { __lt.calls += r.info.render.calls; __lt.tris += r.info.render.triangles; } return x; }; }
    Object.assign(__lt, { on: true, js: 0, gl: 0, n: 0, t0: performance.now(), calls: 0, tris: 0, f0: __lulu3d.frames }); return true; })()`);
  await s.frames(FRAMES);
  return s.L(`(() => { const P = __lt; P.on = false; const n = Math.max(1, __lulu3d.frames - P.f0);
    return { frames: n, frameMs: +((performance.now() - P.t0) / n).toFixed(1), jsMs: +(P.js / n).toFixed(2), gl: Math.round(P.gl / n), calls: Math.round(P.calls / n), tris: Math.round(P.tris / n), tier: __lulu3d.gfx.tier }; })()`);
}

const CROWD = `import("/3d/js/core/people.js").then(async P => {
  const M = await import("/3d/js/models.js"), THREE = await import("three"), C = await import("/3d/js/core/ctx.js");
  const c = __lulu3d.ctx, F = c.foot.debug.F, me = F.lulu.obj, h = me.rotation.y, fx = Math.sin(h), fz = Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
  const people = [], cars = [];
  for (let i = 0; i < 30; i++) {
    const p = P.spawnPerson("luluPerson", { outfit: false });
    const lane = (i % 6) - 2.5, row = Math.floor(i / 6);
    p.base = { x: me.position.x + rx * lane * 1.6 + fx * (8 + row * 7), z: me.position.z + rz * lane * 1.6 + fz * (8 + row * 7) };
    p.dir = i % 2 ? 1 : -1; p.sp = i % 3 === 0 ? 6.5 : 2.6; p.k = (i * 7.3) % 20;
    c.scene.add(p.obj); people.push(p);
  }
  for (let i = 0; i < 12; i++) {
    const o = M.cloneWithColors(M.models.lulu, { Body: ["#E91E63", "#2196F3", "#8BC34A", "#FFC107"][i % 4] });
    o.userData.lane = (i % 2 ? 1 : -1) * (5 + (i % 3) * 3.2); o.userData.k = i * 9; c.scene.add(o); cars.push(o);
  }
  window.__crowd = { people, cars };
  C.hook("tick", dt => {
    for (const p of people) { p.k += dt * p.sp * p.dir; const along = ((p.k % 40) + 40) % 40;
      p.obj.position.set(p.base.x + fx * along, 0.05, p.base.z + fz * along); p.obj.rotation.y = h + (p.dir > 0 ? 0 : Math.PI); p.update(dt, { walk: p.sp }); }
    for (const o of cars) { o.userData.k += dt * 9; const along = (o.userData.k % 90) - 20;
      o.position.set(me.position.x + rx * o.userData.lane + fx * along, 0, me.position.z + rz * o.userData.lane + fz * along); o.rotation.y = h;
      o.traverse(w => { if (w.name && w.name.startsWith("Wheel_")) w.rotation.x += dt * 25; }); }
  });
  return people.length + cars.length;
})`;

(async () => {
  const file = path.join(L.OUT, "perf", "crowd.json");
  const out = process.env.LOOK_KEEP && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};    // (LOOK_KEEP=1: re-measure some, keep the rest)
  const RUNS = [["today", ""], ["look", "&look=2"]].filter(([id]) => !process.env.LOOK_ONLY || process.env.LOOK_ONLY.split(",").includes(id));
  for (const tier of TIERS) for (const [id, q] of RUNS) {
    const s = await L.open({ query: q, quality: tier, viewport: { width: 960, height: 540 }, scale: 1 });
    await s.page.addInitScript(PROBE);
    await s.page.reload();
    await s.until(`window.__lulu3d && __lulu3d.state === "title"`, "boot", 240000);
    await L.toMidwood(s, ["Avenue J", 150, 1.75]);
    await L.timeOfDay(s, "noon");
    await s.g(`ctx.foot.start("droveOff")`);
    await s.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.lulu`, "on foot");
    await s.frames(60);
    await L.clean(s);
    await L.pinCamera(s, { pos: [0, 4.5, -7], look: [0, 1.2, 14], fov: 60, follow: "foot", hideCar: true });   // (behind her, looking down the street)
    const street = await measure(s);
    await s.L(CROWD);
    await s.frames(10);
    const crowd = await measure(s);
    await L.shot(s, path.join(L.OUT, `crowd-${tier}-${id}.jpg`));
    out[`${tier}-${id}`] = { street, crowd, errors: s.errors.slice(0, 2) };
    console.log(tier, id, JSON.stringify(out[`${tier}-${id}`]));
    await s.close();
  }
  fs.mkdirSync(path.join(L.OUT, "perf"), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
