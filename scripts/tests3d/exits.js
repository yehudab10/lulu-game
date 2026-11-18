// 🛣️ Highway exits + 🅿️ rest areas (features/exits, with features/town's interchanges).
//   • a Cruise run plans interchanges that offer BOTH towns, and rest areas clear of them
//   • passing an interchange in the right lane enters no town; drifting into the decel lane and back doesn't either
//   • the inner branch → Lakewood, the outer branch → Midwood (Brooklyn); the cue + the next-exit chip show
//   • a rest area: decel lane → off-ramp → the lot; the pump bay fills nitro for coins; out on foot: the food
//     court heals, the restrooms gag, the vending machine, the souvenir stand, a picnic table, the dog, a trucker;
//     back in the car, Mendel's bay takes the dents out; the on-ramp merges back onto the highway
//   • perf (busy Cruise vs. the rest area), screenshots (desktop / TV / phone portrait + landscape), party keeps it OFF
module.exports = {
  name: "exits",
  viewport: { width: 1280, height: 720 },
  query: "&enable=exits,town,world,foot,atmos",
  save2d: { totalCoins: 3000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [], missiles: 0, shields: 0, pepperSpray: 0 },
  async run(t) {
    const g = t.game;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["town:exit", "town:enter", "town:leave", "exits:rest", "exits:pump", "exits:mechanic", "exits:food", "exits:restroom", "exits:vending", "exits:souvenir", "exits:picnic", "exits:dog", "exits:talk", "foot:start"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 90)));
      // a test driver: steer toward waypoints (world x/z) at a target speed; W.stop = brake to a halt at the end
      m.hook("controls", (ctl, dt) => { const W = window.__route, car = m.ctx.car; if (!W) return;
        if (W.lane != null) { const r = m.ctx.world.road, p = r.point(car.s + Math.max(8, car.speed * 0.9), W.lane, {}); W.aim = p; }
        else { if (!W.pts.length) { if (W.stop) { ctl.steer = 0; ctl.throttle = 0; ctl.brake = 1; ctl.handbrake = false; } return; }
          const p0 = W.pts[0]; if (Math.hypot(p0.x - car.pos.x, p0.z - car.pos.z) < (W.r || 4)) { W.pts.shift(); if (!W.pts.length) return; } W.aim = W.pts[0]; }
        const q = W.aim, want = Math.atan2(q.x - car.pos.x, q.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const v = W.pts && W.pts.length <= 2 && W.stop ? Math.min(W.v, 5) : W.v;
        ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < v ? 0.7 : 0; ctl.brake = car.speed > v + 3 ? 0.5 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000);
    })`);
    const evs = () => t.L(`window.__ev.slice()`);
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const place = (s, d, v = 0) => g(`(() => { const r = ctx.world.road, p = r.point(${s}, ${d}, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s}; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; ctx.car.vF = ${v}; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
    // a route through (u, d) pairs relative to s0
    const route = (s0, pairs, v, opts = {}) => g(`(() => { const r = ctx.world.road, pts = ${JSON.stringify(pairs)}.map(([u, d]) => { const p = r.point(${s0} + u, d, {}); return { x: p.x, z: p.z }; });
        window.__route = { pts, v: ${v}, r: ${opts.r || 5}, stop: ${!!opts.stop} }; return true; })()`);
    const lane = (d, v) => g(`(window.__route = { pts: [], lane: ${d}, v: ${v} }, true)`);
    const noRoute = () => g(`(window.__route = null, true)`);
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, w0: performance.now() }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), frameMs: +((performance.now() - P.w0) / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length }; })()`);
    };
    const rampD = u => 8.75 + 0.0011 * Math.max(0, u + 60) ** 2, outerD = u => rampD(u) + 0.0025 * Math.max(0, u) ** 2;
    const sm = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    const offD = u => 8.9 + 18.1 * sm((u + 80) / 90), onD = u => 27 - 18.1 * sm((u - 222) / 100);
    const toTown = (outer) => { const pts = []; for (let u = -230; u <= (outer ? 100 : 140); u += 10) pts.push([u, u < -170 ? 5.25 : u < -60 ? 5.25 + (u + 170) / 110 * 3.5 : outer ? outerD(u) : rampD(u)]); return pts; };
    // advance / close any dialogue (a stray ✕ that re-opens a menu gets "Just looking")
    const dialogOut = async () => {
      for (let i = 0; i < 16; i++) {
        await t.frames(4);
        if (!await g(`ctx.dialogOpen`)) { await t.frames(8); if (!await g(`ctx.dialogOpen`)) return; }
        if (await t.L(`!!document.querySelector("#dialog .opt")`)) await t.click(/Just looking/); else await t.tap(0);
      }
    };

    t.check("ctx.exits service is registered", await g(`!!(ctx.exits && ctx.exits.spans && ctx.exits.debug && ctx.exits.debug.restAhead)`));
    t.check("party keeps exits (and the towns) OFF", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"exits"/.test(s) && /const OFF = new Set\\([^)]*"town"/.test(s))`));
    t.check("the ramps + the lot are paved (core's paved registry has entries)", await t.L(`import("./js/core/driving.js").then(m => m.paved.length >= 2)`));

    // ── 1. a Cruise run: interchanges with both towns, rest areas clear of them ──
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 0 && __lulu3d.ctx.exits.rests.length > 0`, "a Cruise run plans an interchange and a rest area", 10000);
    t.check("every interchange offers both towns (Lakewood · Midwood)", await g(`ctx.town.debug.X.exits.every(e => e.towns.map(t => t.id).join(",") === "lakewood,midwood")`), await g(`ctx.town.debug.X.exits.map(e => e.towns.map(t => t.id).join("+")).join(" | ")`));
    t.check("ctx.town.exits lists a row per town (91 Lakewood, 9 Brooklyn)", await g(`(() => { const x = ctx.town.exits; return x.some(e => e.id === "lakewood" && e.no === "91") && x.some(e => e.id === "midwood" && e.no === "9"); })()`));
    t.check("the interchange signs list both (EXITS 91 · 9 · LAKEWOOD · BROOKLYN)", await g(`ctx.world.signs.some(s => /EXITS 91 · 9/.test(s.lines.join(" ")) && /LAKEWOOD · BROOKLYN/.test(s.lines.join(" ")))`));
    t.check("a rest area is signed ahead (REST AREA · 1 MI · … REGRET)", await g(`ctx.world.signs.some(s => /REST AREA · 1 MI/.test(s.lines.join(" ")) && /REGRET/.test(s.lines.join(" ")))`));
    t.check("rest areas keep clear of the interchanges", await g(`(() => { const sp = ctx.exits.spans(), T = ctx.town.span; return ctx.town.debug.X.exits.every(e => sp.every(o => o.b < e.s + T.a || o.a > e.s + T.b)); })()`), JSON.stringify(await g(`[ctx.town.exits.map(e => Math.round(e.s)), ctx.exits.rests.map(r => Math.round(r.s))]`)));
    t.check("…and of the pull-in places (Gas 'n' Go, the Lookout)", await g(`(() => { const P = ctx.places, near = []; for (const p of P.list()) if (!/^exits_/.test(p.id)) for (const x of P.at(p.id)) near.push(x); return ctx.exits.rests.every(r => near.every(x => x < r.s - 320 || x > r.s + 520)); })()`));
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    // busy-Cruise perf baseline
    await lane(5.25, 28); await t.frames(60);
    const busy = await perf(120);
    console.log("   PERF busy cruise", JSON.stringify(busy));
    await noRoute();
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold && ctx.law.hold(900), true)`);
    await place(25000, 5.25, 20);
    await t.frames(10);

    await step("pass", async () => {
      // ── 2. stay in lane: the interchange goes by; a drift into the decel lane and back doesn't take her either ──
      const E = await g(`ctx.town.debug.exitAhead(700)`);
      t.check("an interchange can be planned ahead", typeof E === "number", String(E));
      await place(E - 330, 5.25, 22);
      await t.frames(8);
      t.check("the next-exit chip shows both towns (≤ 1 mi ahead)", await t.L(`/EXIT.*91.*LAKEWOOD.*9.*BROOKLYN/.test((document.querySelector(".exits-chip") || {}).textContent || "")`), await t.L(`(document.querySelector(".exits-chip") || {}).textContent || "none"`));
      t.check("…as a .hud-secondary chip (HUD Clean hides it)", await t.L(`!!document.querySelector(".exits-chip.hud-secondary")`));
      // into the decel lane (the cue), then back into the right lane before the gore
      await route(E, [[-260, 5.25], [-200, 6.2], [-150, 8.6], [-110, 8.7], [-70, 8.4], [-40, 6.2], [-10, 5.25], [80, 5.25], [260, 5.25]], 20, { r: 6 });
      await t.until(`__lulu3d.ctx.car.s > ${E} - 120`, "drives down to the gantry", 40000);
      t.check("in the decel lane: the EXIT ONLY cue (steer left to stay on)", await t.until(`/EXIT ONLY/.test(__lulu3d.ctx.town.debug.S.cue || "") || __lulu3d.ctx.car.s > ${E} - 50`, "cue or past", 20000) && /EXIT ONLY/.test(await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`) + await g(`ctx.town.debug.S.cue || ""`)));
      await t.shot("decel-lane-gantry");
      await t.until(`__lulu3d.ctx.car.s > ${E} + 240`, "she drives on past the interchange", 60000);
      t.check("passing the exit in lane enters no town", !(await evs()).some(e => e.startsWith("town:exit")) && await g(`!ctx.town.active && !ctx.town.transitioning`), await g(`[Math.round(ctx.car.s - ${E}), ctx.car.d.toFixed(1), ctx.town.active]`));
      t.check("…and she's still on the highway, in the right lane", await g(`ctx.car.d > 3 && ctx.car.d < 7.2`), await g(`ctx.car.d.toFixed(2)`));
      await noRoute();
    });

    for (const [which, outer, id] of [["lakewood", false, "lakewood"], ["brooklyn", true, "midwood"]]) {
      await step(which, async () => {
        // ── 3. the inner branch → Lakewood, the outer branch → Brooklyn (Midwood) ──
        if (await g(`ctx.town.active`)) await g(`ctx.town.leave("quiet")`);
        const s0 = await g(`ctx.car.s`);
        await place(s0 + 1200, 5.25, 15);
        const E = await g(`ctx.town.debug.exitAhead(600)`);
        await g(`ctx.town.load("${id}")`);
        await t.until(`__lulu3d.ctx.town.loaded("${id}")`, `${id}'s models load`, 60000);
        await place(E - 240, 5.25, 15);
        await route(E, toTown(outer), 16, { r: 6 });
        if (outer) {
          await t.until(`(() => { const p = __lulu3d.ctx.town.debug.rampPhase(); return p && p.phase === "ramp" || __lulu3d.ctx.town.active; })()`, "on the shared ramp", 40000);
          t.check("on the ramp: the cue names both branches", /LAKEWOOD.*BROOKLYN/.test(await g(`ctx.town.debug.S.cue || ""`)) || await g(`ctx.town.active`), await g(`ctx.town.debug.S.cue || ""`));
          await t.shot("split");
        }
        if (!await t.until(`__lulu3d.ctx.town.active`, `the ${outer ? "outer" : "inner"} branch takes her into ${id}`, 60000)) { await noRoute(); return; }
        await noRoute();
        t.check(`town:exit + town:enter for ${id}`, (await evs()).some(e => e.startsWith("town:exit") && e.includes(id)) && (await evs()).some(e => e.startsWith("town:enter") && e.includes(id)));
        t.check(`she's in ${id}`, await g(`ctx.town.id === "${id}"`), await g(`ctx.town.id`));
        await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
        await t.frames(10);
        await t.shot(`in-${id}`);
        // leaving by the town's own exit routes still works (back just past the interchange)
        await g(`ctx.town.leave("highway")`);
        t.check(`back on the highway past the interchange (${id})`, await g(`!ctx.town.active && Math.abs(ctx.car.s - (${E} + 190)) < 30`), await g(`Math.round(ctx.car.s - ${E})`));
        await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
      });
    }

    let RSs = null;
    await step("rest", async () => {
      // ── 4. a rest area: the off-ramp, the pump bay ──
      if (await g(`ctx.town.active`)) await g(`ctx.town.leave("quiet")`);
      await place(await g(`ctx.car.s + 1800`), 5.25, 15);
      RSs = await g(`ctx.exits.debug.restAhead(500)`);
      t.check("a rest area can be planned ahead", typeof RSs === "number", String(RSs));
      await t.until(`__lulu3d.ctx.exits.debug.modelsReady()`, "rest-area models load", 60000);
      await place(RSs - 230, 5.25, 14);
      await t.frames(6);
      t.check("the chip says REST AREA ahead", await t.L(`/REST AREA/.test((document.querySelector(".exits-chip") || {}).textContent || "")`), await t.L(`(document.querySelector(".exits-chip") || {}).textContent || "none"`));
      const pts = [];
      for (let u = -220; u <= 10; u += 10) pts.push([u, u < -190 ? 5.25 : u < -80 ? 5.25 + (u + 190) / 110 * 3.6 : offD(u)]);
      pts.push([30, 27], [70, 27.5], [120, 28], [170, 28.6], [186, 28.6], [194, 28.6]);
      await route(RSs, pts, 13, { r: 5, stop: true });
      await t.until(`__lulu3d.ctx.car.s > ${RSs} - 90`, "down to the rest-area exit", 40000);
      t.check("in the decel lane: the REST AREA cue", await t.until(`/REST AREA/.test(__lulu3d.ctx.exits.debug.RS.cue || "") || __lulu3d.ctx.car.s > ${RSs} - 20`, "rest cue", 20000));
      await t.until(`__lulu3d.ctx.car.s > ${RSs} - 30`, "on the off-ramp", 30000);
      t.check("the ramp is paved (no grass drag)", await g(`(() => { const m = ctx.car; return m.offroad === 0; })()`), await g(`[ctx.car.d.toFixed(1), ctx.car.offroad]`));
      await t.shot("off-ramp");
      await t.until(`!!__lulu3d.ctx.exits.inside`, "into the lot (exits:rest enter)", 40000);
      t.check("the welcome banner + exits:rest enter", (await evs()).some(e => e.startsWith("exits:rest") && /enter/.test(e)));
      await g(`(ctx.G.boost = 0.1, true)`);
      if (await t.until(`__lulu3d.state === "worldVisit" || (__lulu3d.ctx.exits.debug.RS.inside && __lulu3d.ctx.car.speed < 0.3 && __lulu3d.ctx.car.s > ${RSs} + 186)`, "stopping at the pump bay starts the fill-up", 60000)) {
        await t.until(`__lulu3d.state === "playing" && (window.__ev || []).some(e => e.startsWith("exits:pump"))`, "the pump beat plays (exits:pump)", 30000);
        t.check("⛽ nitro full after paying at the pump", await g(`ctx.G.boost > 0.95`), await g(`ctx.G.boost.toFixed(2)`));
      }
      await noRoute();
    });

    await step("foot", async () => {
      // ── 5. park, climb out, walk round: food, restrooms, vending, souvenirs, picnic, the dog, a trucker ──
      if (!RSs) return;
      await route(RSs, [[160, 30], [120, 39], [100, 39.5], [92, 39.5]], 7, { r: 3, stop: true });
      await t.until(`__lulu3d.ctx.car.speed < 0.3 && __lulu3d.ctx.car.s < ${RSs} + 110`, "parks in the aisle", 40000);
      await noRoute();
      await g(`(ctx.G.hearts = 1, true)`);
      await g(`ctx.foot.start("droveOff")`);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "out on foot in the lot", 30000)) return;
      t.check("on the lot she's on 'grounds' (no tall grass / mud / fence)", await g(`ctx.foot.bounds.zone === "grounds"`), await g(`ctx.foot.bounds.zone`));
      const walkTo = async (u, d) => { await g(`(() => { const p = ctx.exits.debug.pt(ctx.exits.debug.RS.list.findIndex(R => Math.abs(R.s - ${RSs}) < 1), ${u}, ${d}); const F = ctx.foot.debug.F; F.pos.set(p.x, 0, p.z); F.vel.set(0, 0, 0); return true; })()`); await t.frames(6); };
      const prompt = () => t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
      // the food court
      await walkTo(75.4, 49.2);
      t.check("by the food court door: ✋ FOOD COURT", /FOOD COURT/.test(await prompt()), await prompt());
      const h0 = await g(`ctx.G.hearts`), c0 = await g(`L3.wallet ? L3.wallet.coins : 0`);
      await t.tap(0);
      await t.until(`__lulu3d.ctx.dialogOpen`, "the counter guy asks", 6000);
      await t.frames(30);
      await t.shot("food-court");
      await t.click(/knish/i);
      await t.frames(10);
      await dialogOut();
      t.check("a knish heals a heart (exits:food)", (await g(`ctx.G.hearts`)) > h0 && (await evs()).some(e => e.startsWith("exits:food")), `${h0} → ${await g(`ctx.G.hearts`)}`);
      // the restrooms
      await walkTo(67, 49.2);
      t.check("by the restrooms: ✋ RESTROOMS", /RESTROOMS/.test(await prompt()), await prompt());
      await t.tap(0);
      await t.frames(20);
      await t.shot("restroom-gag");
      await t.until(`!__lulu3d.ctx.exits.debug.LIFE.busy && __lulu3d.ctx.foot.phase === "walk"`, "the restroom gag plays out", 20000);
      t.check("the restroom gag (exits:restroom)", (await evs()).some(e => e.startsWith("exits:restroom")));
      // the vending machine (twice: a stuck bag gets a kick)
      await walkTo(104, 48.6);
      t.check("by the vending machines: ✋ SNACKS", /SNACKS|KICK/.test(await prompt()), await prompt());
      await t.tap(0); await t.frames(8);
      if (await g(`ctx.exits.debug.LIFE.vend.stuck`)) { t.check("stuck: ✋ KICK THE MACHINE", /KICK/.test(await prompt()), await prompt()); await t.tap(0); await t.frames(8); }
      t.check("the vending machine (exits:vending)", (await evs()).some(e => e.startsWith("exits:vending")));
      // the souvenir stand
      await walkTo(112, 48.3);
      t.check("by the stand: ✋ SOUVENIRS", /SOUVENIRS/.test(await prompt()), await prompt());
      await t.tap(0);
      await t.until(`__lulu3d.ctx.dialogOpen`, "the souvenir lady asks", 6000);
      await t.frames(20);
      await t.shot("souvenir");
      await t.click(/A souvenir/);
      await t.frames(10);
      await dialogOut();
      t.check("a souvenir (exits:souvenir)", (await evs()).some(e => e.startsWith("exits:souvenir")));
      // a picnic table, the dog, a trucker
      await walkTo(36, 50.6);
      t.check("by a picnic table: ✋ SIT", /SIT/.test(await prompt()), await prompt());
      await t.tap(0); await t.frames(30);
      await t.shot("picnic");
      await t.until(`!__lulu3d.ctx.exits.debug.LIFE.busy`, "she gets up again", 10000);
      t.check("sat at the picnic table (exits:picnic)", (await evs()).some(e => e.startsWith("exits:picnic")));
      const dog = await g(`(() => { const D = ctx.exits.debug.LIFE.dog; return D ? { x: D.obj.position.x, z: D.obj.position.z } : null; })()`);
      if (t.check("Kugel the dog is in the pet area", !!dog)) {
        await g(`(() => { const D = ctx.exits.debug.LIFE.dog, F = ctx.foot.debug.F; D.petT = 3; F.pos.set(D.obj.position.x + 1.1, 0, D.obj.position.z); return true; })()`);
        await t.frames(4);
        await t.tap(0); await t.frames(10);
        t.check("petting Kugel (exits:dog)", (await evs()).some(e => e.startsWith("exits:dog")), await prompt());
        await t.shot("dog");
      }
      await walkTo(193, 51.6);
      t.check("by the trucker: ✋ TALK", /Big Sal|TALK/.test(await prompt()), await prompt());
      await t.tap(0); await t.frames(10);
      t.check("talking to a traveller (exits:talk)", (await evs()).some(e => e.startsWith("exits:talk")));
      await t.shot("trucker");
      // back to the car
      await g(`(() => { const c = ctx.foot.debug.F.car.stub, F = ctx.foot.debug.F; F.pos.set(c.x + Math.cos(c.h) * 1.6, 0, c.z - Math.sin(c.h) * 1.6); return true; })()`);
      await t.frames(5);
      t.check("by her car: ✋ GET BACK IN", /GET BACK IN/.test(await prompt()), await prompt());
      await t.tap(0);
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "back behind the wheel", 30000);
    });

    await step("mechanic", async () => {
      // ── 6. Mendel's bay: dents out for coins ──
      if (!RSs || await g(`ctx.foot.active`)) return;
      await g(`(ctx.feel && ctx.feel.debug && ctx.feel.debug.wear ? ctx.feel.debug.wear(2, "left") : 0, true)`);
      const k0 = await g(`ctx.feel ? ctx.feel.damage.k : 0`);
      await route(RSs, [[110, 40], [132, 46], [143.5, 52], [143.5, 57.5], [143.5, 59.5]], 5, { r: 2.2, stop: true });
      if (await t.until(`(window.__ev || []).some(e => e.startsWith("exits:mechanic"))`, "stopping in Mendel's bay (exits:mechanic)", 60000)) {
        t.check("Mendel took the dents out", k0 === 0 || await g(`ctx.feel.damage.k === 0`), `${k0} → ${await g(`ctx.feel ? ctx.feel.damage.k : -1`)}`);
        await t.shot("mendel");
      }
      await noRoute();
      await t.until(`__lulu3d.state === "playing"`, "drives on", 20000);
    });

    await step("perf", async () => {
      if (!RSs) return;
      await place(RSs + 40, 27, 0);
      await g(`(ctx.car.h = ctx.world.road.at(${RSs} + 40).h, true)`);
      await t.frames(20);
      const rest = await perf(120);
      console.log("   PERF rest area", JSON.stringify(rest));
      t.check("rest-area draw calls stay within a busy Cruise's (+60)", rest.calls <= busy.calls + 60, `${rest.calls} vs ${busy.calls}`);
      t.check("rest-area triangles ≤ 160k", rest.tris <= 160000, String(rest.tris));
      await t.shot("lot-desktop");
      for (const [label, w, h] of [["tv", 1920, 1080], ["phone-portrait", 390, 844], ["phone-landscape", 844, 390]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.frames(15);
        await t.shot(label);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await g(`ctx.atmos.debug.time("night")`);
      await t.frames(30);
      await t.shot("lot-night");
      await g(`ctx.atmos.debug.time("noon")`);
    });

    await step("leave", async () => {
      // ── 7. the on-ramp back onto the highway ──
      if (!RSs) return;
      await place(RSs + 150, 27.5, 8);
      const pts = [[170, 27.5], [210, 27.3]];
      for (let u = 222; u <= 330; u += 9) pts.push([u, onD(u)]);
      pts.push([360, 7.5], [400, 5.6], [460, 5.25]);
      await route(RSs, pts, 14, { r: 5 });
      if (await t.until(`(window.__ev || []).some(e => e.startsWith("exits:rest") && /leave/.test(e))`, "the on-ramp puts her back on the highway (exits:rest leave)", 60000)) {
        t.check("back in the right lane past the rest area", await g(`ctx.car.s > ${RSs} + 300 && ctx.car.d < 8.5`), await g(`[Math.round(ctx.car.s - ${RSs}), ctx.car.d.toFixed(1)]`));
        await t.shot("back-on-highway");
      }
      await noRoute();
      await g(`L3.setState("title")`);
      await t.frames(5);
      t.check("the title clears the rest areas", await g(`ctx.exits.rests.length === 0 && !ctx.exits.debug.LIFE.R`));
    });
  },
};
