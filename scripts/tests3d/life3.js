// 🍃 Life, round 3 (features/life: windows.js, breath.js, radio.js + alarm.js' hotwire + foot's `foot:hotwireFail`):
//   • 🪟 dusk in Lakewood: no panes by day; as night comes the houses' windows light up a few at a time (some lit, some
//     still dark at mid-dusk); at full night most are lit; bedtime turns some off; morning → gone
//   • 🌬️ a cold night on foot: Lulu's breath clouds; running → huffing; a warm night → none; the car's tailpipe
//     steams while it idles on a cold day
//   • 🌫️ dawn in town: low mist banks around her; noon → none
//   • 🚨 a fumbled hotwire on a parked car in town: the alarm goes off (hazards blink, the tail plays)
//   • 📻 the radio's DJ mentions the rain (a talking station; hustle's topical hook)
//   • nothing on the title; the walk had no glitches (QA watchdog)
//   • PERF: Lakewood at night on foot — round 3 adds ≤ 1 mesh (the panes; breath + mist ride the puffs mesh)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "life3",
  viewport: { width: 1280, height: 720 },
  query: "&enable=life,town,foot,atmos,homes,law,feel,hustle",
  save2d: { totalCoins: 200, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, mpName: "Window Watcher" },
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
    const standAt = async (x, z, look) => {
      await g(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f); ctx.cam.snap && ctx.cam.snap(); if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);
      if (look) await g(`(() => { const F = ctx.cam.free; F.yaw = Math.atan2(${look.x} - ${x}, ${look.z} - ${z}); F.pitch = ${look.pitch == null ? -0.12 : look.pitch}; F.idle = 0; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      await t.frames(3);
    };
    const clock = async name => { await g(`(ctx.atmos.debug.time(${typeof name === "string" ? `"${name}"` : name}), true)`); await t.frames(8); return g(`+ctx.atmos.night.toFixed(2)`); };

    t.check("ctx.life service (round 3 parts)", await g(`!!(ctx.life && ctx.life.debug.pane && ctx.life.debug.mist && ctx.life.info().windows && ctx.life.info().breath && ctx.life.info().radio)`));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ${D}.season("autumn"), ${D}.cold(false), ${D}.mist(false), ${D}.rain(0), true)`);
    await W.install(t);

    // ── 0. the radio's DJ mentions the rain (on the highway, before town) ──
    await step("radio", async () => {
      if (!await g(`L3.state === "playing" && !!(ctx.hustle && ctx.hustle.radio)`)) { t.check("the car radio is there (hustle)", false); return; }
      await t.frames(5);
      t.check("life hooked into the radio (hustle's topical hook)", (await info()).radio.hooked, JSON.stringify((await info()).radio));
      await g(`(ctx.hustle.radio.tune("simcha"), true)`);
      await t.frames(10);
      await g(`(ctx.atmos.debug.weather("rain"), true)`);
      await t.frames(20);
      t.check("rain starts → the radio has a topic", (await info()).radio.topic === "rain" || (await info()).radio.said > 0, JSON.stringify((await info()).radio));
      let said = false;
      for (let i = 0; i < 60 && !said; i++) { await g(`ctx.hustle.radio.debugMsgT(0)`); await t.frames(10); said = (await info()).radio.log.includes("rain"); }
      const log = await g(`ctx.hustle.radio.state().log.slice(-3).map(l => l.text)`);
      t.check("…and the DJ talks about the rain (on the radio's own ticker)", said && log.some(l => /rain|umbrella|wipers|puddle/i.test(l)), JSON.stringify(log));
      await t.shot("radio-rain");
      await g(`(ctx.hustle.radio.tune("auto"), ctx.atmos.debug.weather("clear"), true)`);
    });

    // ── 1. windows at dusk ──
    await step("windows", async () => {
      if (!await inTown("lakewood")) return;
      if (!await onFoot()) return;
      await t.frames(20);
      let I = await info();
      t.check("by day: no panes drawn", I.windows.drawn === 0 && !I.windows.visible, JSON.stringify(I.windows));
      // the nearest lit-able house: stand across the street from it, looking at its front
      await clock(0.6); await t.frames(10);
      const h = await g(`${D}.house()`);
      t.check("Lakewood's houses have front-window panes (from the models)", !!h && h.n >= 4, JSON.stringify((await info()).windows));
      if (!h) return;
      const ex = h.x + h.nx * 11, ez = h.z + h.nz * 11;
      await standAt(ex, ez, { x: h.cx, z: h.cz, pitch: 0.05 });
      // walk the clock through dusk: the lit share should only grow, with some still dark half way
      const steps = [0.49, 0.52, 0.55, 0.58, 0.64, 0.72], seen = [];
      for (const c of steps) {
        const n = await clock(c);
        await t.frames(14);
        const w = (await info()).windows;
        seen.push({ c, night: n, lit: w.lit, dark: w.dark, drawn: w.drawn });
        if (c === 0.55) await t.shot("windows-dusk");
      }
      console.log(`  dusk: ${JSON.stringify(seen)}`);
      const mid = seen.find(s => s.lit > 0 && s.dark > 0);
      t.check("as it gets dark the windows light up a few at a time (some lit, some still dark)", !!mid, JSON.stringify(seen));
      let mono = true; for (let i = 1; i < seen.length; i++) if (seen[i].lit + 2 < seen[i - 1].lit) mono = false;
      t.check("…more and more of them (never a big drop through dusk)", mono && seen.at(-1).lit > seen[0].lit, JSON.stringify(seen.map(s => s.lit)));
      I = await info();
      t.check("at night most panes near her are lit", I.windows.lit > I.windows.dark && I.windows.visible, JSON.stringify(I.windows));
      await t.shot("windows-night");
      // bedtime: after a while at full night some go dark
      const lit0 = I.windows.lit;
      await g(`(${D}.WN.fullT = 400, true)`);
      await t.frames(40);
      I = await info();
      t.check("late at night some of them go dark (bedtime)", I.windows.lit < lit0 && I.windows.lit > 0, `${lit0} → ${I.windows.lit}`);
      // morning: all gone
      await clock("morning"); await t.frames(30);
      I = await info();
      t.check("morning: the panes are gone (the town's own glass)", I.windows.drawn === 0 && !I.windows.visible, JSON.stringify(I.windows));
    });

    // ── 2. breath on a cold night ──
    await step("breath", async () => {
      if (!await g(`ctx.town.active && ctx.foot.active`)) return;
      await clock("night");
      await g(`(${D}.cold(true), ${D}.lineReady(), true)`);
      const h = await g(`${D}.house()`);
      if (h) await standAt(h.x + h.nx * 11, h.z + h.nz * 11);
      const b0 = (await info()).breath.breaths;
      await t.frames(200);
      let I = await info();
      t.check("a cold night: Lulu's breath clouds (puffs)", I.breath.on && I.breath.breaths - b0 >= 2, JSON.stringify(I.breath));
      // a picture: the camera in front of her, her facing it
      // (looking along the street — no house or parked car between — and Lulu turned to face the camera)
      await g(`(() => { const F = ctx.cam.free, yaw = ${h ? `Math.atan2(-(${h.nz}), ${h.nx})` : 0.4}; F.yaw = yaw; F.pitch = 0.12; F.idle = 0; ctx.foot.obj.rotation.y = yaw + Math.PI; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      let shot = false;
      for (let i = 0; i < 40 && !shot; i++) { await t.frames(3); const n = await g(`${D}.BR.t`); if (n > 1.7) { await t.frames(10); await t.shot("breath-night"); shot = true; } }
      // running → huffing (quicker breaths)
      // (a real run: the stick + RB, down the street)
      await t.stick(0, -1); await t.hold(5, 1);
      let huff = false, top = 0;
      for (let i = 0; i < 30 && !huff; i++) { await t.frames(10); huff = (await info()).breath.huff; top = Math.max(top, await g(`ctx.foot.vel ? Math.hypot(ctx.foot.vel.x, ctx.foot.vel.z) : 0`)); }
      await t.stick(0, 0); await t.hold(5, 0);
      t.check("after a run she's huffing", huff, `top speed ${top.toFixed(1)} m/s · ` + JSON.stringify((await info()).breath));
      await g(`${D}.cold(false)`); await t.frames(10);
      const b1 = (await info()).breath.breaths; await t.frames(150);
      I = await info();
      t.check("a warm night: no breath", !I.breath.on && I.breath.breaths === b1, JSON.stringify(I.breath));
    });

    // ── 3. dawn mist ──
    await step("mist", async () => {
      if (!await g(`ctx.town.active && ctx.foot.active`)) return;
      await g(`(${D}.mist(null), true)`);
      await clock("dawn");
      await t.frames(120);
      let I = await info();
      t.check("dawn in town: mist banks around her", I.breath.mistOn && I.breath.mist >= 6 && I.puffs.puffs >= 6, JSON.stringify({ b: I.breath, puffs: I.puffs.puffs }));
      const h = await g(`${D}.house()`);
      if (h) await standAt(h.x + h.nx * 10, h.z + h.nz * 10, { x: h.cx, z: h.cz, pitch: -0.05 });
      await t.frames(20);
      await t.shot("dawn-mist");
      await clock("noon");
      const m0 = (await info()).breath.mist; await t.frames(60);
      I = await info();
      t.check("noon: no more mist", !I.breath.mistOn && I.breath.mist === m0, JSON.stringify(I.breath));
    });

    // ── 4. a fumbled hotwire sets the car alarm off ──
    await step("hotwire", async () => {
      if (!await g(`ctx.town.active && ctx.foot.active`)) return;
      await clock("dusk");
      const DD = "ctx.town.debug";
      const ok = await g(`(() => { const T = ${DD}.S.T, O = ${DD}.PL.ORIGIN, F = ctx.foot.debug.F; let best = null, bd = 1e9;
          for (const p of T.pcars) { if (p.gone || p.live) continue; const d = Math.hypot(O.x + p.x - F.pos.x, O.z + p.z - F.pos.z); if (d < bd) { bd = d; best = p; } }
          if (!best) return false; window.__fp = best; F.pos.set(O.x + best.x + Math.cos(best.rot) * 1.7, 0, O.z + best.z - Math.sin(best.rot) * 1.7); ctx.foot.obj.position.copy(F.pos); ctx.cam.snap && ctx.cam.snap();
          if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);
      if (!ok) { t.check("a parked car to hotwire", false); return; }
      await t.frames(12);
      const prompt = await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
      t.check("next to a parked car: ✋ HOTWIRE", /HOTWIRE/.test(prompt), prompt);
      await t.L(`import("./js/core/ctx.js").then(m => { window.__hw = []; if (!window.__hwOn) { window.__hwOn = true; m.on("foot:hotwireFail", e => window.__hw.push(!!(e && e.obj))); } })`);
      const a0 = (await info()).alarm;
      await t.tap(0);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "hotwire"`, "the hotwire challenge opens", 20000)) return;
      // fumble it: the green zone shrinks to nothing, two slips
      await g(`(ctx.foot.debug.F.hotwire.zoneW = 0, true)`);
      await t.frames(4); await t.tap(0); await t.frames(10); await t.tap(0);
      // (the camera up over her shoulder, looking down at the car)
      await g(`(() => { const F = ctx.cam.free, p = window.__fp, O = ctx.town.debug.PL.ORIGIN, f = ctx.foot.pos; F.yaw = Math.atan2(O.x + p.x - f.x, O.z + p.z - f.z); F.pitch = 0.45; F.idle = 0; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      let A = a0, shot = false;
      for (let i = 0; i < 60; i++) {
        await t.frames(3);
        A = (await info()).alarm;
        if (A.hotwires > a0.hotwires && A.lit && !shot) { await t.shot("hotwire-alarm"); shot = true; }
        if (A.hotwires > a0.hotwires && A.tails > a0.tails && shot) break;
      }
      t.check("foot says so (foot:hotwireFail, with the car)", (await t.L(`window.__hw`)).includes(true), JSON.stringify(await t.L(`window.__hw`)));
      t.check("a fumbled hotwire: the alarm goes off — hazards blink", A.hotwires > a0.hotwires && A.blinks > a0.blinks, JSON.stringify(A));
      t.check("…and the alarm sounds (its tail is played on the car)", A.tails > a0.tails || !(await g(`ctx.life.sounds`)), JSON.stringify(A));
      await t.frames(220);
      t.check("…for a few seconds, then stops", (await info()).alarm.live === 0, JSON.stringify((await info()).alarm));
    });

    // ── 5. the tailpipe on a cold day ──
    await step("exhaust", async () => {
      if (!await g(`ctx.town.active`)) return;
      await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, true)`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 10000);
      await g(`(ctx.town.debug.place("Route 9", 40, -1.75, 0, -1), ${D}.cold(true), ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, true)`);
      await clock("dusk");
      const e0 = (await info()).breath.exhaust;
      await t.frames(90);
      const I = await info();
      t.check("a cold day: the car's tailpipe steams while it idles", I.breath.exhaust - e0 >= 8, JSON.stringify(I.breath));
      await t.shot("tailpipe");
    });

    // ── 7. the walk had no glitches ──
    await step("watchdog", async () => { W.check(t, "life3: dusk, breath, mist, a hotwire", await W.report(t)); });

    // ── 8. PERF: Lakewood at night on foot, cold (panes + breath + puffs) ──
    await step("perf", async () => {
      if (!await g(`ctx.town.active`)) return;
      if (!await onFoot()) return;
      await clock("night");
      await g(`(${D}.cold(true), ${D}.WN.fullT = 0, true)`);
      const h = await g(`${D}.house()`);
      if (h) await standAt(h.x + h.nx * 11, h.z + h.nz * 11, { x: h.cx, z: h.cz, pitch: 0.05 });
      await t.frames(40);
      await g(`${D}.off(true)`); await t.frames(5);
      const off = await perf(60);
      await g(`${D}.off(false)`); await t.frames(40);
      await g(`(${D}.stats.maxMs = 0, ${D}.stats.ms = 0, true)`);
      const on = await perf(60);
      const ms = await g(`[+${D}.stats.ms.toFixed(2), +${D}.stats.maxMs.toFixed(2)]`);
      const I = await info();
      console.log(`  perf (Lakewood, night, cold, on foot): off ${JSON.stringify(off)} · on ${JSON.stringify(on)} · tick avg ${ms[0]} ms max ${ms[1]} ms · panes ${I.windows.drawn} (lit ${I.windows.lit}) puffs ${I.puffs.puffs}`);
      const mine = await g(`ctx.scene.children.filter(o => /^life/.test(o.name) && o.visible).map(o => o.name)`);
      t.check("round 3 adds ≤ 1 mesh (lifeWindows); breath rides the puffs", mine.includes("lifeWindows") && mine.filter(n => !/^life(Puffs|Pigeons|Manholes|Windows|Puddles|Leaves|Piles|Flyers)$/.test(n)).length === 0, `${mine.join(", ")} · renderer avg ${off.calls} → ${on.calls}, peak ${off.maxCalls} → ${on.maxCalls}`);
      t.check("life's tick stays cheap with round 3 (avg ≤ 1.5 ms in software GL)", ms[0] <= 1.5, `avg ${ms[0]} ms, max ${ms[1]} ms`);
    });

    // ── 9. not on the title ──
    await step("title", async () => {
      await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("reset"), L3.setState("title"), true)`);
      await t.frames(20);
      const vis = await g(`ctx.scene.children.filter(o => /^life(Windows|Puffs)$/.test(o.name) && o.visible).map(o => o.name)`);
      t.check("nothing of round 3 on the title", vis.length === 0, vis.join(", "));
    });
  },
};
