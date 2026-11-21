// 🍃 Life (features/life): small ambient details that make the open world feel alive.
//   • the sound kinds synthesize (finite, not silent)
//   • 👣 footsteps follow her walk and the ground: the sidewalk, the asphalt, a front lawn, a puddle
//   • 💧 puddles in town after rain (drawn, rippling), splashy steps + a SPLOSH when she jumps in, spray off the car
//   • 🍂 the fall: raked leaf piles at the kerb burst when she walks through one; a gust blows leaves + a flyer past
//     (and she reads the flyer when it blows into her)
//   • 🏘️ the neighbourhood soundscape plays positional one-shots around her; ⚙️ 🐦 Street sounds switches it off
//   • Midwood gets puddles + piles too; nothing shows on the title; no glitches (the QA watchdog) on the walk
//   • PERF: Lakewood in the rain in the fall, life on vs off (budget ≤ +4 draw calls, its tick ≤ 1.5 ms here)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "life",
  viewport: { width: 1280, height: 720 },
  query: "&enable=life,town,foot,atmos,homes,law,feel",
  save2d: { totalCoins: 200, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, mpName: "Puddle Jumper" },
  async run(t) {
    const g = t.game, D = "ctx.life.debug";
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    const info = () => g(`ctx.life.info()`);
    const perf = async frames => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n) }; })()`);
    };
    const inTown = async (town = "lakewood") => {
      if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
      await g(`ctx.town.load("${town}")`);
      await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town} models`, 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "${town}"`, `in ${town}`, 60000);
    };
    const onFoot = async () => {
      if (await g(`ctx.foot.active && L3.state === "footRun"`)) return true;
      // (a test-forced climb-out from wherever the car stands: not what this test watches — the watchdog looks away)
      await W.pause(t, false);
      await g(`ctx.foot.start("droveOff", { noIntro: true })`);
      const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000);
      await t.frames(6);
      await W.pause(t, true);
      return ok;
    };
    // stand her at (x, z) (world), facing `h`
    const standAt = async (x, z) => {
      await g(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f); ctx.cam.snap && ctx.cam.snap(); if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);       // (a test teleport, not a glitch: a declared cut in the same frame)
      await t.frames(3);
    };
    // a point on the first long street of the plan: lateral `d` from its centre line (world coords)
    const streetPoint = d => g(`(() => { const P = ctx.town.plan; const st = P.STREETS.find(s => s.cross.length >= 2 && !s.boulevard) || P.STREETS[0];
      const a = (st.cross[0].a + st.cross[1].a) / 2, dd = ${d} === "walk" ? (st.outer + st.walk) / 2 : ${d} === "yard" ? st.walk + 1.2 : ${d} === "lane" ? 1.75 : ${d};
      let lx, lz; if (st.axis === "ns") { lx = st.c - dd; lz = a; } else if (st.axis === "ew") { lx = a; lz = st.c + dd; } else { lx = st.px + st.ux * a + st.rx * dd; lz = st.pz + st.uz * a + st.rz * dd; }
      const w = P.world(lx, lz, {}); return { x: w.x, z: w.z, h: P.wh(st.h) }; })()`);

    t.check("ctx.life service", await g(`!!(ctx.life && ctx.life.info && ctx.life.debug)`));

    // ── 1. the sounds synthesize ──
    await step("sounds", async () => {
      const bad = await g(`${D}.SOUND_KINDS.map(k => [k, ${D}.probe(k)]).filter(([k, p]) => !p || p.nan || p.peak < 0.1 || p.sec <= 0).map(([k]) => k)`);
      t.check("every life sound kind synthesizes (finite, audible)", bad.length === 0, bad.join(", "));
    });

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ${D}.season("autumn"), true)`);
    await W.install(t);

    // ── 2. footsteps by surface ──
    await step("footsteps", async () => {
      if (!await inTown("lakewood")) return;
      if (!await onFoot()) return;
      await g(`${D}.rain(0)`);
      const surf = async where => { const p = await streetPoint(JSON.stringify(where)); await standAt(p.x, p.z); await t.frames(10); return g(`ctx.life.info().steps.surf`); };
      const sw = await surf("walk"), ln = await surf("lane"), yd = await surf("yard");
      t.check("on the sidewalk: concrete steps", sw === "concrete", sw);
      t.check("in the street: asphalt steps", ln === "asphalt", ln);
      t.check("on a front lawn: grass steps", yd === "grass", yd);
      const p = await streetPoint(JSON.stringify("walk"));
      await standAt(p.x, p.z);
      const n0 = (await info()).steps.n;
      await t.stick(0, -1); await t.frames(60); await t.stick(0, 0); await t.frames(4);
      const I = await info();
      t.check("walking makes steps in her rhythm (~3 a second)", I.steps.n - n0 >= 4 && I.steps.n - n0 <= 16, `${I.steps.n - n0} steps in 2 s`);
      t.check("standing still makes none", await (async () => { const a = (await info()).steps.n; await t.frames(20); return (await info()).steps.n === a; })());
      await t.shot("sidewalk");
    });

    // ── 3. puddles after the rain ──
    await step("puddles", async () => {
      if (!await g(`ctx.town.active && ctx.foot.active`)) return;
      await g(`(ctx.atmos.debug.weather("rain", 1, true), ${D}.rain(null), true)`);
      await t.frames(90);        // they fill up over ~20 s of rain: ~3 s in, a start
      let I = await info();
      t.check("rain starts filling the puddles", I.puddles.level > 0.05 && I.puddles.level < 0.9, `level ${I.puddles.level}`);
      await g(`${D}.rain(1)`);
      await t.frames(20);
      I = await info();
      t.check("puddles lie in the town's streets (the nearest drawn, one mesh)", I.puddles.sites > 20 && I.puddles.drawn > 3 && I.puddles.visible, `${I.puddles.drawn} drawn of ${I.puddles.sites}`);
      const pd = await g(`${D}.puddle("walk") || ${D}.puddle("")`);
      t.check("there's a puddle near her", !!pd, JSON.stringify(pd));
      if (!pd) return;
      await standAt(pd.x, pd.z);
      await g(`ctx.cam.orbit && ctx.cam.orbit({ yaw: ${pd.h} + 2.4, pitch: 0.5 })`).catch(() => { });
      await t.frames(10);
      t.check("standing in it: puddle steps", (await info()).steps.surf === "puddle", (await info()).steps.surf);
      await t.shot("puddles-rain");
      const s0 = (await info()).splashes;
      await g(`ctx.foot.jump && ctx.foot.jump({})`);
      await t.until(`__lulu3d.ctx.foot.airborne`, "she jumps", 3000);
      await t.until(`!__lulu3d.ctx.foot.airborne`, "she lands", 5000);
      await t.frames(3);
      t.check("jumping into a puddle: a big splash", (await info()).splashes > s0, `${s0} → ${(await info()).splashes}`);
      await t.shot("splash");
      // the rain stops: they shrink away slowly (outlast the wet road)
      await g(`(${D}.rain(null), ctx.atmos.debug.weather("clear", 1, true), true)`);
      await t.frames(60);
      I = await info();
      t.check("after the rain the puddles linger, drying", I.puddles.level > 0.5 && I.puddles.level < 1 && I.puddles.visible, `level ${I.puddles.level} wet ${I.wet}`);
    });

    // ── 4. the car through a puddle: spray ──
    await step("car spray", async () => {
      if (!await g(`ctx.town.active`)) return;
      await g(`${D}.rain(1)`);
      await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 10000);
      await t.frames(20);
      const pd = await g(`${D}.puddle("lane") || ${D}.puddle("gutter")`);
      t.check("a puddle in the street", !!pd, JSON.stringify(pd));
      if (!pd) return;
      // line up behind it along the street, rolling at ~14 m/s
      const c0 = (await info()).carSplashes;
      await g(`(() => { const h = ${pd.h}, fx = Math.sin(h), fz = Math.cos(h); const x = ${pd.x} - fx * 9, z = ${pd.z} - fz * 9;
        ctx.car.place(x, z, h); ctx.car.vx = fx * 14; ctx.car.vz = fz * 14; ctx.car.vF = 14; ctx.car.s = ctx.world.road.nearest(x, z, ctx.car.s, {}).s; ctx.cam.snap && ctx.cam.snap(); if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);
      await t.hold(7, 0.4);
      let hit = false;
      for (let i = 0; i < 12 && !hit; i++) { await t.frames(2); hit = (await info()).carSplashes > c0; if (hit) await t.shot("car-spray"); }
      await t.hold(7, 0);
      t.check("driving through a puddle throws spray off both sides", hit, `${c0} → ${(await info()).carSplashes}`);
      await t.frames(10);
    });

    // ── 5. the fall: leaf piles + a gust ──
    await step("leaves", async () => {
      if (!await g(`ctx.town.active`)) return;
      await g(`(${D}.rain(0), ctx.atmos.debug.weather("clear", 1, true), true)`);
      if (!await onFoot()) return;
      await t.frames(30);
      let I = await info();
      t.check("raked leaf piles at the kerb in the fall", I.wind.pilesVisible && I.wind.piles > 2, `${I.wind.piles} piles`);
      const pl = await g(`${D}.pile()`);
      if (pl) {
        const dx = 2.2;
        await standAt(pl.x - dx, pl.z);
        await g(`ctx.cam.orbit && ctx.cam.orbit({ yaw: Math.PI * 0.5 + 0.6, pitch: 0.45 })`).catch(() => { });
        await t.frames(8);
        await t.shot("leafpile");
        const k0 = (await info()).pilesKicked;
        // walk through it (whichever way the camera faces: push her straight at it)
        for (let i = 0; i < 25; i++) { await g(`(() => { const f = ctx.foot.pos; f.x += 0.18; ctx.foot.vel.set(5.4, 0, 0); ctx.foot.obj.position.copy(f); return true; })()`); await t.frames(1); if ((await info()).pilesKicked > k0) break; }
        await t.frames(6);
        I = await info();
        t.check("walking through a pile bursts it", I.pilesKicked > k0 && I.wind.leaves > 8, `kicked ${k0} → ${I.pilesKicked}, ${I.wind.leaves} leaves flying`);
        await t.shot("leafpile-burst");
      } else t.check("a pile near her", false);
      // a gust with a flyer aimed straight at her
      await g(`(ctx.foot.vel.set(0, 0, 0), true)`);
      const r0 = (await info()).flyersRead;
      await g(`${D}.gust({ flyer: false, dir: 1.2 })`);
      await g(`${D}.flyer(1, 1.2, 0)`);
      await t.frames(30);
      I = await info();
      t.check("a gust blows leaves across + a flyer tumbles past", I.wind.gusts >= 1 && I.wind.leaves > 10 && I.wind.flyers >= 1, `${I.wind.gusts} gusts, ${I.wind.leaves} leaves, ${I.wind.flyers} flyers`);
      await t.shot("gust");
      let read = false;
      for (let i = 0; i < 20 && !read; i++) { await t.frames(5); read = (await info()).flyersRead > r0; }
      t.check("a flyer that blows into her gets read out (a speech bubble, not a pop-up)", read, `read ${(await info()).flyersRead}`);
    });

    // ── 6. the neighbourhood ──
    await step("ambience", async () => {
      const s0 = (await info()).ambience.sounds;
      const k = await g(`[${D}.happen("lifeBark"), ${D}.happen("lifeChirp"), ${D}.happen("lifeDoor"), ${D}.happen("")]`);
      const I = await info();
      t.check("the neighbourhood plays positional sounds around her", I.ambience.sounds >= s0 + 4, `${s0} → ${I.ambience.sounds} (${k.join(" ")})`);
      // ⚙️ the switch
      const lbl = await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("settings").filter(i => i.id === "lifeSounds").map(i => typeof i.label === "function" ? i.label() : i.label))`);
      t.check("⚙️ 🐦 Street sounds is in Settings (in a run: ⏸ → ⚙️)", lbl.length === 1 && /Street sounds/.test(lbl[0]), lbl.join(""));
      await g(`ctx.life.sounds = false`);
      t.check("…and turns the sounds off", (await g(`ctx.life.sounds`)) === false && !(await info()).ambience.crickets);
      await g(`ctx.life.sounds = true`);
    });

    // ── 7. the walk had no glitches ──
    await step("watchdog", async () => { W.check(t, "life: walking, jumping, puddles, piles", await W.report(t)); });

    // ── 8. Midwood ──
    await step("midwood", async () => {
      await g(`(ctx.foot.active && ctx.foot.end("test"), true)`);
      await t.frames(4);
      if (!await inTown("midwood")) return;
      await g(`${D}.rain(1)`);
      await t.frames(30);
      const I = await info();
      t.check("Midwood has puddles + leaf piles too", I.puddles.sites > 10 && I.puddles.drawn > 0 && I.wind.piles > 0, `${I.puddles.drawn}/${I.puddles.sites} puddles, ${I.wind.piles} piles`);
      await t.shot("midwood");
    });

    // ── 9. PERF: life on vs off, Lakewood, the rain, the fall ──
    await step("perf", async () => {
      if (!await inTown("lakewood")) return;
      if (!await onFoot()) return;
      await g(`(${D}.rain(1), ctx.atmos.debug.weather("rain", 1, true), true)`);
      const p = await streetPoint(JSON.stringify("walk"));
      await standAt(p.x, p.z);
      await g(`${D}.gust({ flyer: true })`);
      await t.frames(20);
      await g(`${D}.off(true)`); await t.frames(5);
      const off = await perf(60);
      await g(`${D}.off(false)`); await t.frames(5);
      await g(`(${D}.stats.maxMs = 0, ${D}.gust({ flyer: true }))`);
      const on = await perf(60);
      const ms = await g(`[+${D}.stats.ms.toFixed(2), +${D}.stats.maxMs.toFixed(2)]`);
      console.log(`  perf (Lakewood, rain, autumn, on foot): off ${JSON.stringify(off)} · on ${JSON.stringify(on)} · tick avg ${ms[0]} ms max ${ms[1]} ms`);
      // (the town's crowd + traffic move between the two windows, so the renderer's totals are reported, not judged:
      //  what life itself draws is its own meshes — each one draw call)
      const mine = await g(`ctx.scene.children.filter(o => /^life/.test(o.name) && o.visible).map(o => o.name)`);
      t.check("life draws ≤ 4 meshes (≤ 4 draw calls)", mine.length <= 4 && mine.length >= 2, `${mine.join(", ")} · renderer peak ${off.maxCalls} → ${on.maxCalls}, avg ${off.calls} → ${on.calls}`);
      t.check("life's tick is cheap (avg ≤ 1.5 ms in software GL)", ms[0] <= 1.5, `avg ${ms[0]} ms, max ${ms[1]} ms`);
    });

    // ── 10. not on the title ──
    await step("title", async () => {
      await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("reset"), L3.setState("title"), true)`);
      await t.frames(20);
      const I = await info();
      t.check("nothing of it on the title", !I.on && !I.wind.pilesVisible && !I.puddles.visible && I.wind.leavesDrawn === 0, JSON.stringify({ on: I.on, piles: I.wind.pilesVisible, pud: I.puddles.visible, leaves: I.wind.leavesDrawn }));
    });
  },
};
