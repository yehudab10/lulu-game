// 🍃 Life, round 2 (features/life: pigeons.js, puffs.js, alarm.js, friends.js + homes' honk reactions):
//   • the new sound kinds synthesize (finite, audible)
//   • 💨 cold day in Lakewood: chimneys smoke (puffs rising from real chimney tops); not cold → no smoke
//   • 🐦 pigeons: rows on roofs + gangs on the pavement; a HONK sends the near ones up, running at a gang does too;
//     once she's walked on they come back down to where they were
//   • 🙋 a honk by the crowd: someone reacts (homes:honked)
//   • 🚨 bumping a parked car: its hazards blink (glows), the alarm carries on, someone yells (a bubble, not a toast)
//   • 🕳️ Midwood: manholes in the lanes, most of them steaming; walking into the steam → Lulu's line; the bakery's vent
//     puffs and walking past it → she smells it (the shared line budget: one line ≥ 40 s apart)
//   • 👣 friends' footsteps: a (stand-in) friend walking near her makes surface-aware steps
//   • nothing shows on the title; the walk had no glitches (QA watchdog)
//   • PERF: Midwood, cold, on foot — life2's meshes ≤ 3 draw calls, life's tick ≤ 1.5 ms avg
const W = require("../lib/qawatch.js");

module.exports = {
  name: "life2",
  viewport: { width: 1280, height: 720 },
  query: "&enable=life,town,foot,atmos,homes,law,feel",
  save2d: { totalCoins: 200, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, mpName: "Pigeon Pal" },
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
      await W.pause(t, false);
      await g(`ctx.foot.start("droveOff", { noIntro: true })`);
      const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000);
      await t.frames(6);
      await W.pause(t, true);
      return ok;
    };
    // stand her at (x, z) and (optionally) turn the free camera to look at (lx, ly, lz) from behind her
    const standAt = async (x, z, look) => {
      await g(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f); ctx.cam.snap && ctx.cam.snap(); if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);
      // (turning the camera is the test's too: the watchdog looks away while the rig's wall clip settles)
      if (look) await g(`(() => { const F = ctx.cam.free; F.yaw = Math.atan2(${look.x} - ${x}, ${look.z} - ${z}); F.pitch = ${look.pitch == null ? -0.12 : look.pitch}; F.idle = 0; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      await t.frames(3);
    };
    // a point `back` m from (x, z) along heading `ang` (a manhole: along its street — still in the street)
    const from = (p, back, ang = 0.6) => ({ x: p.x - Math.sin(ang) * back, z: p.z - Math.cos(ang) * back });

    t.check("ctx.life service (round 2 parts)", await g(`!!(ctx.life && ctx.life.debug.puff && ctx.life.debug.flock && ctx.life.info().puffs && ctx.life.info().pigeons)`));

    // ── 1. the new sounds synthesize ──
    await step("sounds", async () => {
      const bad = await g(`["lifeFlutter", "lifeCoo", "lifeAlarm", "lifeHiss"].map(k => [k, ${D}.probe(k)]).filter(([k, p]) => !p || p.nan || p.peak < 0.1 || p.sec <= 0).map(([k]) => k)`);
      t.check("pigeons' flutter + coo, the alarm's tail, the steam's hiss synthesize", bad.length === 0, bad.join(", "));
    });

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ${D}.season("autumn"), ${D}.cold(true), ${D}.rain(0), true)`);
    await W.install(t);

    // ── 2. chimney smoke on a cold day ──
    await step("chimneys", async () => {
      if (!await inTown("lakewood")) return;
      if (!await onFoot()) return;
      // (on the sidewalk in front of the nearest house with a chimney: among the houses, not out by the town's edge)
      const hz = await g(`${D}.puff("house")`);
      if (hz) await standAt(hz.fx, hz.fz);
      await t.frames(70);
      let I = await info();
      t.check("Lakewood's duplexes have chimneys, about half of the near ones smoke on a cold day", I.puffs.chimneys > 6 && I.puffs.smoking > 0, `${I.puffs.smoking} smoking of ${I.puffs.chimneys}`);
      t.check("…puffs rise (one mesh, drawn)", I.puffs.chim >= 3 && I.puffs.visible, JSON.stringify(I.puffs));
      const c = await g(`${D}.puff("chimney")`);
      if (c) {
        // out in the street in front of it (the sidewalk point + 7 m toward the street; the camera behind her, across it)
        const nx = c.fx - c.x, nz = c.fz - c.z, nl = Math.hypot(nx, nz) || 1;
        await standAt(c.fx + nx / nl * 7, c.fz + nz / nl * 7, { x: c.x, z: c.z, pitch: -0.05 });
        await t.frames(40);
        I = await info();
        t.check("…from the chimney tops (≥ 8.5 m up), rising", I.puffs.chimLo >= 8.4 && I.puffs.chimHi > I.puffs.chimLo + 1, `${I.puffs.chimLo}–${I.puffs.chimHi} m`);
        await t.shot("chimney-smoke");
      } else t.check("a smoking chimney near her", false);
      await g(`${D}.cold(false)`);
      await t.frames(200);          // (the last puffs live ≤ 5.6 s)
      I = await info();
      t.check("a warm day: no chimney smoke", I.puffs.chim === 0 && I.puffs.smoking === 0, JSON.stringify(I.puffs));
      await g(`${D}.cold(true)`);
    });

    // ── 3. pigeons ──
    await step("pigeons", async () => {
      if (!await g(`ctx.town.active && ctx.foot.active`)) return;
      let I = await info();
      t.check("pigeons in town: rows on roofs + gangs on the pavement", I.pigeons.flocks > 4, JSON.stringify(I.pigeons));
      const f = await g(`${D}.flock("ground")`);
      t.check("a gang pecking on the pavement", !!f, JSON.stringify(f));
      if (!f) return;
      const ul = Math.hypot(f.ux, f.uz) || 1, ux = f.ux / ul, uz = f.uz / ul;       // (along the pavement: never into a building)
      await standAt(f.x + ux * 6.5, f.z + uz * 6.5, { x: f.x, z: f.z, pitch: 0.25 });
      await t.frames(20);
      I = await info();
      t.check("they're drawn (one instanced mesh)", I.pigeons.drawn >= f.n && I.pigeons.visible && I.pigeons.flying === 0, JSON.stringify(I.pigeons));
      await t.shot("pigeons");
      const s0 = I.pigeons.scattered;
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("honk", {}))`);
      await t.frames(18);
      I = await info();
      t.check("a HONK sends them up (a clatter of wings)", I.pigeons.scattered > s0 && I.pigeons.flying > 0, JSON.stringify(I.pigeons));
      await t.shot("pigeons-honk");
      // she walks on (≥ 14 m): they circle, then glide back down to where they were
      await standAt(f.x + ux * 22, f.z + uz * 22, { x: f.x, z: f.z, pitch: 0.1 });
      let back = false;
      for (let i = 0; i < 30 && !back; i++) { await t.frames(15); back = (await g(`${D}.flock("ground")`)).away === 0; }
      t.check("…and once she's moved on they come back to the same spot", back, JSON.stringify(await g(`${D}.flock("ground")`)));
      // running straight at them
      await standAt(f.x - ux * 3, f.z - uz * 3);
      const s1 = (await info()).pigeons.scattered;
      for (let i = 0; i < 12; i++) { await g(`(() => { const F = ctx.foot.pos; F.x += ${ux} * 0.2; F.z += ${uz} * 0.2; ctx.foot.vel.set(${ux} * 6, 0, ${uz} * 6); ctx.foot.obj.position.copy(F); return true; })()`); await t.frames(1); }
      await g(`(ctx.foot.vel.set(0, 0, 0), true)`);
      await t.frames(4);
      t.check("running at a gang scatters it", (await info()).pigeons.scattered > s1, JSON.stringify((await info()).pigeons));
    });

    // ── 4. the crowd answers a honk (homes' crowd, one reaction each) ──
    await step("crowd honk", async () => {
      if (!await g(`ctx.town.active`)) return;
      await t.L(`import("./js/core/ctx.js").then(m => { window.__hk = []; if (!window.__hkOn) { window.__hkOn = true; m.on("homes:honked", e => window.__hk.push(e)); } })`);
      // stand by the nearest pedestrian of the crowd and honk
      const ok = await g(`(() => { const C = ctx.homes && ctx.homes.debug.CR; if (!C || !C.peds || !C.peds.length) return false; const p = ctx.foot.pos; let best = null, bd = 1e9;
        for (const q of C.peds) { if (q.kind === "bike") continue; const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < bd) { bd = d; best = q; } }
        if (!best) return false; p.set(best.x + 0.8, 0.05, best.z); ctx.foot.obj.position.copy(p); C.honkT = 0; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      if (!ok) { t.check("the town's crowd is out (homes)", false); return; }
      await t.frames(3);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("honk", {}))`);
      await t.frames(6);
      const hk = await t.L(`window.__hk`);
      t.check("a honk by the crowd: somebody reacts (a kid waves back, a grown-up jumps)", hk.length > 0 && "kid" in hk[0], JSON.stringify(hk));
    });

    // ── 5. a car alarm ──
    await step("alarm", async () => {
      if (!await g(`ctx.town.active`)) return;
      await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 10000);
      await g(`(ctx.law.hold(300), ctx.town.debug.place("Route 9", 40, -1.75, 0, -1), ${D}.lineReady(), true)`);
      await t.frames(4);
      const DD = "ctx.town.debug";
      const pk = await g(`(() => { const T = ${DD}.S.T, O = ${DD}.PL.ORIGIN, car = ctx.car, r = ctx.world.road; let best = null, bd = 1e9;
          const clear = p => { const P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, car.s, {}), q = r.point(n.s, 0, {});
            const ex = P.x - q.x, ez = P.z - q.z, L2 = ex * ex + ez * ez || 1;
            return !T.pcars.some(o => { if (o === p || o.gone) return false; const ox = O.x + o.x - q.x, oz = O.z + o.z - q.z, u = Math.max(0, Math.min(1, (ox * ex + oz * ez) / L2));
              return Math.hypot(ox - ex * u, oz - ez * u) < 3.2; }); };
          for (const p of T.pcars) { if (p.gone || p.live) continue; const d = Math.hypot(O.x + p.x - car.pos.x, O.z + p.z - car.pos.z); if (d > 8 && d < bd && clear(p)) { bd = d; best = p; } }
          if (!best) return null; window.__pc = best; return { x: O.x + best.x, z: O.z + best.z }; })()`);
      t.check("a parked car to bump", !!pk);
      if (!pk) return;
      const a0 = (await info()).alarm;
      await g(`(() => { const p = window.__pc, O = ${DD}.PL.ORIGIN, r = ctx.world.road, P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, ctx.car.s, {});
          const q = r.point(n.s, 0, {}), h = Math.atan2(P.x - q.x, P.z - q.z);
          ctx.car.place(q.x, q.z, h); ctx.car.vx = Math.sin(h) * 7; ctx.car.vz = Math.cos(h) * 7; ctx.car.vF = 7; ctx.car.s = n.s; ctx.cam.snap && ctx.cam.snap(); if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);
      let A = a0, shot = false;
      for (let i = 0; i < 40; i++) {
        await t.frames(3);
        A = (await info()).alarm;
        if (A.alarms > a0.alarms && A.blinks > a0.blinks && !shot) { await t.hold(0, 0); await t.frames(2); await t.shot("car-alarm"); shot = true; }
        if (A.alarms > a0.alarms && A.lines > a0.lines) break;
      }
      t.check("bumping a parked car: its hazards blink", A.alarms > a0.alarms && A.blinks > a0.blinks, JSON.stringify(A));
      t.check("…and somebody yells about it (a speech bubble)", A.lines > a0.lines, JSON.stringify(A));
      await g(`(ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, true)`);
      await t.frames(200);
      t.check("…for a few seconds, then it stops", (await info()).alarm.live === 0, JSON.stringify((await info()).alarm));
      // a picture of it: on foot in the street by the car, the alarm going again (another bump), on a lit blink
      if (await onFoot()) {
        const at = await g(`(() => { const p = window.__pc, O = ${DD}.PL.ORIGIN, r = ctx.world.road, P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, ctx.car.s, {}), q = r.point(n.s, 0, {});
          const dx = q.x - P.x, dz = q.z - P.z, L = Math.hypot(dx, dz) || 1; return { x: P.x + dx / L * 4.5, z: P.z + dz / L * 4.5, cx: P.x, cz: P.z }; })()`);
        await standAt(at.x, at.z, { x: at.cx, z: at.cz, pitch: 0.3 });
        await t.L(`import("./js/core/ctx.js").then(m => { const p = window.__pc; if (p && p.live) m.emit("town:parkedHit", { impact: 3, key: p.key, obj: p.live.obj, alarm: true }); })`);
        let lit = false;
        for (let i = 0; i < 30 && !lit; i++) { await t.frames(1); const A = (await info()).alarm; lit = A.live > 0 && A.lit; }
        await t.frames(1);
        await t.shot("car-alarm-lights");
        t.check("…its lights blink (seen on foot)", lit, JSON.stringify((await info()).alarm));
      }
    });

    // ── 6. the walk had no glitches ──
    await step("watchdog", async () => { W.check(t, "life2: chimneys, pigeons, an alarm", await W.report(t)); });

    // ── 7. Midwood: manholes, steam, the bakery ──
    await step("midwood", async () => {
      await g(`(ctx.foot.active && ctx.foot.end("test"), true)`);
      await t.frames(4);
      if (!await inTown("midwood")) return;
      if (!await onFoot()) return;
      await t.frames(40);
      let I = await info();
      t.check("Midwood: manhole covers in the lanes, most of them steaming", I.puffs.manholes > 4 && I.puffs.manholesDrawn > 0, JSON.stringify(I.puffs));
      t.check("…Midwood's detached houses smoke too (cold)", I.puffs.chimneys > 3, JSON.stringify(I.puffs));
      const m = await g(`${D}.puff("manhole")`);
      t.check("a steaming manhole near her", !!m, JSON.stringify(m));
      if (m) {
        const p = from(m, 7, m.h || 0);
        await standAt(p.x, p.z, { x: m.x, z: m.z, pitch: 0.2 });
        await t.frames(60);
        I = await info();
        t.check("steam rises off it (puffs)", I.puffs.steam > 6, JSON.stringify(I.puffs));
        await t.shot("manhole-steam");
        const l0 = (await info()).lines;
        await g(`${D}.lineReady()`);
        await standAt(m.x + 0.3, m.z + 0.2);
        await t.frames(10);
        I = await info();
        t.check("walking into the steam: Lulu has a word about it (her bubble)", I.puffs.steamed > 0 && I.lines > l0 && I.puffs.smelled.includes("steam"), JSON.stringify({ lines: I.lines, p: I.puffs.smelled, steamed: I.puffs.steamed }));
      }
      const b = await g(`${D}.puff("bakery")`);
      t.check("the bakery's oven vent", !!b, JSON.stringify(I.puffs.vents));
      if (b) {
        const bn = Math.hypot(b.fx - b.x, b.fz - b.z) || 1;      // (out in the street in front of it, looking up at the roof)
        await standAt(b.fx + (b.fx - b.x) / bn * 8 + b.ux * 4, b.fz + (b.fz - b.z) / bn * 8 + b.uz * 4, { x: b.x, z: b.z, pitch: -0.2 });
        await t.frames(60);
        I = await info();
        t.check("…puffs warm air", I.puffs.vent >= 2, JSON.stringify(I.puffs));
        await t.shot("bakery-vent");
        await g(`${D}.lineReady()`);
        await standAt(b.fx, b.fz);
        await t.frames(8);
        I = await info();
        t.check("walking past the bakery: she smells it (a line, once)", I.puffs.smelled.includes("bakery"), JSON.stringify(I.puffs.smelled));
        const l1 = I.lines;
        await standAt(b.fx + b.ux * 10, b.fz + b.uz * 10); await standAt(b.fx, b.fz); await t.frames(8);
        t.check("…and only once a visit", (await info()).lines === l1);
      }
    });

    // ── 8. friends' footsteps (a stand-in friend walking circles near her) ──
    await step("friends", async () => {
      if (!await g(`ctx.foot.active`)) return;
      await g(`(() => { const p = ctx.foot.pos, rc = { shown: true, foot: true, walker: {}, anim: 0, footY: 0, x: p.x + 4, z: p.z, vx: 0, vz: 0, t: 0 };
        window.__frc = rc; return ${D}.fakeParty({ active: true, uid: "me", members: () => ["me", "f1"], remoteCar: u => u === "f1" ? rc : null }); })()`);
      const s0 = (await info()).friends.steps;
      for (let i = 0; i < 20; i++) { await g(`(() => { const rc = window.__frc, p = ctx.foot.pos; rc.t += 0.1; rc.x = p.x + Math.cos(rc.t) * 4; rc.z = p.z + Math.sin(rc.t) * 4; rc.vx = -Math.sin(rc.t) * 3; rc.vz = Math.cos(rc.t) * 3; return true; })()`); await t.frames(3); }
      const F = (await info()).friends;
      t.check("a friend walking near her makes footsteps (their own ground)", F.steps - s0 >= 4 && F.near === 1 && !!F.surf, JSON.stringify(F));
      await g(`(window.__frc.anim = 8, true)`); await t.frames(20);
      const s1 = (await info()).friends.steps; await t.frames(20);
      t.check("…and none while they're sitting / busy", (await info()).friends.steps === s1);
      await g(`${D}.fakeParty(null)`);
    });

    // ── 9. PERF: life on vs off, Midwood, cold, on foot (smoke + steam + pigeons) ──
    await step("perf", async () => {
      if (!await g(`ctx.town.active && ctx.foot.active`)) return;
      const m = await g(`${D}.puff("manhole")`);
      if (m) { const p = from(m, 6, m.h || 0); await standAt(p.x, p.z, { x: m.x, z: m.z, pitch: 0.1 }); }
      await t.frames(30);
      await g(`${D}.off(true)`); await t.frames(5);
      const off = await perf(60);
      await g(`${D}.off(false)`); await t.frames(40);
      await g(`(${D}.stats.maxMs = 0, ${D}.stats.ms = 0, true)`);
      const on = await perf(60);
      const ms = await g(`[+${D}.stats.ms.toFixed(2), +${D}.stats.maxMs.toFixed(2)]`);
      const I = await info();
      console.log(`  perf (Midwood, cold, on foot): off ${JSON.stringify(off)} · on ${JSON.stringify(on)} · tick avg ${ms[0]} ms max ${ms[1]} ms · puffs ${I.puffs.puffs} pigeons ${I.pigeons.drawn}`);
      const mine = await g(`ctx.scene.children.filter(o => /^life(Puffs|Pigeons|Manholes)$/.test(o.name) && o.visible).map(o => o.name)`);
      t.check("round 2 draws ≤ 3 meshes (≤ 3 draw calls)", mine.length <= 3 && mine.length >= 1, `${mine.join(", ")} · renderer peak ${off.maxCalls} → ${on.maxCalls}, avg ${off.calls} → ${on.calls}`);
      t.check("life's tick stays cheap with round 2 (avg ≤ 1.5 ms in software GL)", ms[0] <= 1.5, `avg ${ms[0]} ms, max ${ms[1]} ms`);
    });

    // ── 10. not on the title ──
    await step("title", async () => {
      await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("reset"), L3.setState("title"), true)`);
      await t.frames(20);
      const vis = await g(`ctx.scene.children.filter(o => /^life(Puffs|Pigeons|Manholes)$/.test(o.name) && o.visible).map(o => o.name)`);
      t.check("nothing of round 2 on the title", vis.length === 0, vis.join(", "));
    });
  },
};
