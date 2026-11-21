// (temporary, not committed: ci/perf4's GC probe — who allocates while the attached towns build / are torn down)
const SETTINGS = { quality: "low", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "off", hud: 1, hudMode: "full", chatter: "normal" };
module.exports = {
  name: "zzgc",
  viewport: { width: 640, height: 360 },
  query: "&enable=atmos,world,town,exits,law,roadevents",
  save3d: { best: 1000, settings: SETTINGS, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const cdp = await t.page.context().newCDPSession(t.page);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "run")) return;
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
    await t.L(`Promise.all([import("./js/core/ctx.js"), import("./js/core/driving.js")]).then(([m, d]) => { window.__v = 0;
      m.hook("controls", (ctl, dt) => { if (window.__v > 0) Object.assign(ctl, d.autoDrive(dt, 5.25, window.__v)); }, 1001); m.hook("damage", () => false, 9999); })`);
    await g(`(ctx.town.load("lakewood"), ctx.town.load("midwood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood") && __lulu3d.ctx.town.loaded("midwood")`, "towns loaded", 120000);
    const E = await g(`ctx.town.debug.exitAhead(1400)`);
    await t.frames(10);
    const prof = async (label, fn) => {
      await cdp.send("HeapProfiler.collectGarbage");
      await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
      await cdp.send("HeapProfiler.startSampling", { samplingInterval: 4096 });
      const f0 = await g(`L3.frames`);
      await fn();
      const frames = (await g(`L3.frames`)) - f0;
      const { profile: P } = await cdp.send("Profiler.stop"); const { profile: H } = await cdp.send("HeapProfiler.stopSampling");
      const nodes = new Map(P.nodes.map(n => [n.id, n])); let gc = 0, tot = 0; const selfFn = new Map();
      const short = u => (u || "").replace(/^.*\/3d\//, "").replace(/\?.*$/, "");
      for (let i = 0; i < P.samples.length; i++) { const dt = (P.timeDeltas[i + 1] || 0) / 1000, n = nodes.get(P.samples[i]); tot += dt; if (n.callFrame.functionName === "(garbage collector)") gc += dt;
        const cf = n.callFrame, k = (short(cf.url) || "(native)") + " › " + (cf.functionName || "(anon)") + ":" + (cf.lineNumber + 1); selfFn.set(k, (selfFn.get(k) || 0) + dt); }
      const alloc = new Map();
      const walk = (n, st) => { const cf = n.callFrame, f = short(cf.url); const s2 = f ? f + " › " + (cf.functionName || "(anon)") + ":" + (cf.lineNumber + 1) : st; const sz = (n.selfSize || 0) / 1024; if (sz) alloc.set(s2 || "(native)", (alloc.get(s2 || "(native)") || 0) + sz); for (const c of n.children || []) walk(c, s2); };
      walk(H.head, "");
      // also: inclusive allocations by the first game frame up the stack (who CAUSED the allocation)
      const allocIncl = new Map();
      const walk2 = (n, stack) => { const cf = n.callFrame, f = short(cf.url); const here = f && /^js\//.test(f) ? f + " › " + (cf.functionName || "(anon)") : null; const st2 = here ? stack.concat([here]) : stack; const sz = (n.selfSize || 0) / 1024;
        if (sz) for (const k of new Set(st2)) allocIncl.set(k, (allocIncl.get(k) || 0) + sz); for (const c of n.children || []) walk2(c, st2); };
      walk2(H.head, []);
      const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v.toFixed(0)}`);
      console.log(`GC ${label}: frames ${frames}, gc ${gc.toFixed(0)} ms of ${tot.toFixed(0)} ms profiled (${(gc / frames).toFixed(2)} ms/frame), alloc ${([...alloc.values()].reduce((a, b) => a + b, 0) / 1024).toFixed(1)} MB`);
      console.log(`GC ${label} top alloc self (KB): ` + top(alloc, 30).join(" · "));
      console.log(`GC ${label} top alloc incl (KB): ` + top(allocIncl, 40).join(" · "));
      console.log(`GC ${label} top self ms: ` + top(selfFn, 25).join(" · "));
    };
    // build: drive at the interchange from ~1.2 km out until both towns stand
    await g(`(() => { const hw = ctx.world.highway, s = ${E} - 1150, p = hw.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vF = 20; ctx.world.prebuild(s); ctx.cam.snap(); window.__v = 20; return true; })()`);
    await prof("build", async () => { await t.until(`__lulu3d.ctx.town.standing.length >= 2 && __lulu3d.ctx.town.standing.every(b => b.ready)`, "towns standing", 600000); });
    console.log("standing: " + JSON.stringify(await g(`ctx.town.standing.map(b => ({ town: b.town, steps: b.steps, ms: b.ms, worst: b.worst }))`)));
    // teardown: hop far on: both towns are dropped
    await prof("teardown", async () => {
      await g(`(() => { const hw = ctx.world.highway, s = ${E} + 2600, p = hw.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.cam.snap(); return true; })()`);
      await t.frames(150);
    });
    console.log("standing after: " + JSON.stringify(await g(`ctx.town.standing.length`)));
    t.check("done", true);
  },
};
