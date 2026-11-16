// 🏙️ Towns (features/town): Lakewood, a town you can turn into.
//   • the exit: LAKEWOOD signs + the off-ramp appear in Cruise → steer onto it → town:enter
//   • the district: world.road is the TownRoad, the trip bar is a street chip, drive round a corner
//   • law: a cruiser loses line of sight behind a block (the town's occluders), and routes round corners
//   • on foot: get out, talk to a local, carjack a (silver) minivan
//   • the on-ramp: Route 9 South → back on the highway just past the exit
//   • a random mash in town, perf numbers (busy Cruise vs. town), screenshots at
//     desktop / TV / phone portrait / phone landscape, and party keeps it OFF.
module.exports = {
  name: "town",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,streets,law,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const D = `ctx.town.debug`;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["town:enter", "town:leave", "town:talk", "town:gossip", "cop:chase", "streets:carjack"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 80)));
      // a test driver: steer toward waypoints (world x/z) at a target speed
      m.hook("controls", (ctl, dt) => { const W = window.__route; if (!W || !W.pts.length) return; const car = m.ctx.car;
        const p = W.pts[0]; if (Math.hypot(p.x - car.pos.x, p.z - car.pos.z) < (W.r || 4)) { W.pts.shift(); if (!W.pts.length) return; }
        const q = W.pts[0], want = Math.atan2(q.x - car.pos.x, q.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < (W.v || 9) ? 0.7 : 0; ctl.brake = car.speed > (W.v || 9) + 3 ? 0.4 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000);
    })`);
    const evs = () => t.L(`window.__ev.slice()`);
    const route = (pts, v = 9, r = 4) => g(`(window.__route = { pts: ${JSON.stringify(pts)}.map(([x, z]) => ({ x: ctx.town.debug.PL.ORIGIN.x + x, z: ctx.town.debug.PL.ORIGIN.z + z })), v: ${v}, r: ${r} }, true)`);
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, w0: performance.now() }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), frameMs: +((performance.now() - P.w0) / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length }; })()`);
    };

    t.check("ctx.town service is registered", await g(`!!(ctx.town && ctx.town.enter && ctx.town.leave && ctx.town.blocksSight && ctx.town.copRoute && ctx.town.copSpawn)`));
    t.check("party keeps the town OFF", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"town"/.test(s))`));
    t.check("the town is data: Lakewood's streets come from towns/lakewood.js", await g(`ctx.town.streets.includes("Route 9") && ctx.town.streets.includes("Main St") && !!ctx.town.towns.lakewood`));

    // ── 1. busy Cruise baseline (for the perf comparison) ────────────────
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 0`, "a Cruise run plans a Lakewood exit", 10000);
    t.check("the first exit is planned ahead (with its signs)", await g(`(() => { const e = ctx.town.debug.X.exits[0]; return e.s > ctx.car.s + 900 && ctx.world.signs.some(s => /LAKEWOOD/.test(s.lines.join(" "))); })()`));
    await g(`ctx.atmos.debug.weather("clear"); ctx.atmos.debug.time("noon"); ctx.atmos.debug.freeze(true)`);
    await route([], 0);
    await g(`(window.__auto = true, true)`);
    await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => c.hook("controls", (ctl, dt) => { if (window.__auto && !window.__route?.pts?.length) Object.assign(ctl, m.autoDrive(dt, 5.25, 30)); }, 999)))`);
    await t.frames(60);
    const busy = await perf(150);
    console.log("   PERF busy cruise", JSON.stringify(busy));
    await g(`(window.__auto = false, true)`);

    // ── 2. the exit: signs, the gantry, the ramp → steer onto it → town:enter ──
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(120), true)`);
    const E = await g(`ctx.town.debug.exitAhead(560)`);
    t.check("an exit can be planned right ahead", typeof E === "number", String(E));
    await g(`(() => { const r = ctx.world.road, s = ${E} - 380, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * 2; ctx.car.vz = Math.cos(p.h) * 2; return true; })()`);
    await t.frames(20);
    await t.shot("exit-gantry");
    // steer: keep right, take the decel lane, follow the ramp
    await g(`(() => { const r = ctx.world.road, E = ${E}, pts = [];
        for (let u = -300; u <= 140; u += 10) { const d = u < -170 ? 5.25 : u < -60 ? 5.25 + (u + 170) / 110 * 3.5 : 8.75 + 0.0011 * Math.max(0, u + 60) ** 2; const p = r.point(E + u, d, {}); pts.push({ x: p.x, z: p.z }); }
        window.__route = { pts, v: 17, r: 6 }; return true; })()`);
    await t.until(`__lulu3d.ctx.car.s > ${E} - 120`, "she drives down to the exit", 40000);
    await t.shot("exit-ramp");
    if (!await t.until(`__lulu3d.ctx.town.active`, "steering onto the off-ramp takes her into town (town:enter)", 40000)) return;
    await g(`(window.__route = null, true)`);
    t.check("town:enter fired", (await evs()).some(e => e.startsWith("town:enter")));
    t.check("in town: world.road is the TownRoad, still the 'playing' state", await g(`ctx.world.road.town === true && L3.state === "playing"`));
    t.check("the highway's chunks are hidden, not streamed", await g(`[...ctx.world.chunks.values()].every(c => !c.group.visible)`));
    t.check("the trip bar is a street chip (Route 9 · LAKEWOOD)", await t.L(`/Route 9 · LAKEWOOD/.test(document.getElementById("tripLabel").textContent)`), await t.L(`document.getElementById("tripLabel").textContent`));
    await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
    await t.frames(10);
    await t.shot("welcome");
    t.check("drivers are out (silver minivans, a bus, the patrol)", await g(`ctx.town.debug.C.cars.length >= 6 && ctx.traffic.cars.some(c => c.kind === "town_van")`), String(await g(`ctx.town.debug.C.cars.map(c => c.kind).join(",")`)));

    // ── 3. drive round a corner: north on Route 9, LEFT onto 14th St (east) ──
    await g(`${D}.place("Route 9", -36, 1.75, 6, 1)`);
    await route([[-1.75, -18], [-1.5, -6], [3, 0.6], [12, 1.75], [40, 1.75]], 8, 3.5);
    await t.until(`__lulu3d.ctx.town.street === "14th St"`, "she turns the corner onto 14th St", 30000);
    t.check("…heading east along it", await g(`Math.abs(Math.sin(ctx.car.h) - 1) < 0.25`), String(await g(`ctx.car.h.toFixed(2)`)));
    await t.frames(20);
    await t.shot("corner");
    await g(`(window.__route = null, true)`);

    // ── 4. a cruiser loses line of sight behind a block ─────────────────
    // Lulu on 14th St between Route 9 and Clifton; a cruiser on Carpool Ln on the far side of block (0,0)
    await g(`${D}.place("14th St", 40, 1.75, 0, 1)`);
    t.check("a building block hides Carpool Ln from 14th St", await g(`(() => { const o = ${D}.PL.ORIGIN; return ctx.town.blocksSight(o.x + 40, o.z + 76, o.x + 40, o.z + 1.75); })()`));
    t.check("…but not down the same street", await g(`(() => { const o = ${D}.PL.ORIGIN; return !ctx.town.blocksSight(o.x + 0, o.z + 1.75, o.x + 60, o.z + 1.75); })()`));
    await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 1 }))`);
    await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.mode === "chase" && u.car)`, "a cruiser joins the chase in town", 10000);
    t.check("the cruiser spawned on a town street", await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.car); return !!u && u.car.s > 499000; })()`));
    const route1 = await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.car); const r = ctx.town.copRoute(u.car); return r ? Math.round(r.gap) : -1; })()`);
    t.check("copRoute: a path through the grid", route1 > 0, `${route1} m`);
    await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.car && u.mode === "chase"), o = ${D}.PL.ORIGIN, c = u.car;
        c.x = o.x + 40; c.z = o.z + 76 - 1.75; c.h = -Math.PI / 2; c.s = ${D}.PL.byName["Carpool Ln"].base + 40; c.speed = 0; window.__cop = c; return true; })()`);
    await t.until(`__lulu3d.ctx.law.searching`, "behind the block, the cops lose sight: SEARCHING", 6000);
    await t.shot("cop-search");
    await t.frames(60);
    t.check("the cruiser drives round the block to find her (it moved)", await g(`Math.hypot(window.__cop.x - (${D}.PL.ORIGIN.x + 40), window.__cop.z - (${D}.PL.ORIGIN.z + 74.25)) > 8`));
    await g(`(ctx.law.clearHeat ? ctx.law.clearHeat("test") : null, true)`);
    await t.frames(10);

    // ── 5. on foot: talk to a local, carjack a minivan ───────────────────
    await g(`(ctx.law.hold(200), true)`);
    const hz = await g(`(() => { const c = ctx.town.debug.C.hazards[0]; return c ? { x: c.x, z: c.z, h: c.h } : null; })()`);
    t.check("hazard-light minivans are double-parked at the wedding hall", !!hz);
    await g(`(() => { const c = ctx.town.debug.C.hazards[0]; ctx.car.place(c.x - Math.sin(c.h) * 12, c.z - Math.cos(c.h) * 12 + 0.0, c.h); ctx.car.s = ctx.world.road.nearest(ctx.car.pos.x, ctx.car.pos.z, c.s, {}).s; return true; })()`);
    await t.frames(4);
    await g(`ctx.foot.start("droveOff")`);
    if (await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "she's out on foot in town", 30000)) {
      // a local first
      const ok = await g(`(() => { const r = ctx.town.debug.LIFE.people.find(p => p.lines); if (!r) return false; const F = ctx.foot.debug.F, o = r.p.obj.position; F.pos.set(o.x + 1.4, 0, o.z + 0.4); window.__who = r.id; return true; })()`);
      await t.frames(5);
      if (ok) {
        t.check("next to a local: the ✋ shows TALK", await t.L(`/TALK|💬/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") || /TALK/.test((document.getElementById("tx_foot_hand") || {}).textContent || "")`));
        await t.tap(0);
        await t.frames(8);
        t.check("talking: a line (town:talk)", (await evs()).some(e => e.startsWith("town:talk")));
        await t.shot("talk");
        await t.frames(60);
      }
      // now the minivan
      await g(`(() => { const c = ctx.town.debug.C.hazards[0], F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }, f = { x: Math.sin(c.h), z: Math.cos(c.h) };
          F.pos.set(c.x + l.x * 1.6 + f.x * 0.6, 0, c.z + l.z * 1.6 + f.z * 0.6); return true; })()`);
      await t.frames(5);
      t.check("next to the minivan: ✕ JACK", await t.L(`/JACK/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`), await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`));
      await t.tap(0);
      t.check("✕ starts the carjack", await g(`ctx.streets.jacking`));
      await t.frames(20);
      await t.shot("carjack");
      if (await t.until(`__lulu3d.state === "playing"`, "…and she drives off in it", 30000)) {
        t.check("she's driving the silver town minivan", await g(`ctx.streets.ride && ctx.streets.ride.kind === "town_van" && ctx.town.active`));
        t.check("the carjack happened in town (streets:carjack)", (await evs()).some(e => e.startsWith("streets:carjack")));
      }
    }

    // ── 6. the on-ramp: Route 9 South → the highway, just past the exit ───
    await g(`${D}.place("Route 9", -30, -1.75, 12, -1)`);
    await route([[1.75, -60], [1.75, -90]], 12, 3);
    if (await t.until(`!__lulu3d.ctx.town.active`, "driving south out of town takes the on-ramp", 30000)) {
      t.check("town:leave fired (why: highway)", (await evs()).some(e => e.startsWith("town:leave") && /highway/.test(e)));
      t.check("back on the highway, just past the exit she took", await g(`ctx.world.road.town !== true && Math.abs(ctx.car.s - (${E} + 190)) < 30 && Math.abs(ctx.car.d - 5.25) < 2`), String(await g(`[Math.round(ctx.car.s), ctx.car.d.toFixed(1)]`)));
      t.check("the highway chunks are back", await g(`[...ctx.world.chunks.values()].every(c => c.group.visible) && ctx.world.chunks.size > 2`));
      t.check("the town's scene is disposed", await g(`!ctx.scene.children.some(o => /^Town:/.test(o.name))`));
      await g(`(window.__route = null, true)`);
      await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
      await t.shot("back-on-highway");
    }

    // ── 7. perf in town + the screenshots ────────────────────────────────
    await g(`ctx.town.enter({ speed: 0 })`);
    await t.until(`__lulu3d.ctx.town.active`, "ctx.town.enter() goes straight in", 5000);
    await g(`(${D}.place("Main St", 20, 1.75, 6, 1), window.__route = null, true)`);
    // drive Main St east toward the circle (the busiest view) for the measurement
    await route([[60, 153.75], [132, 153.75], [142, 162], [150.25, 172], [150.25, 236]], 10, 4);
    await t.frames(40);
    const town = await perf(150);
    console.log("   PERF town", JSON.stringify(town));
    t.check("town draw calls ≤ busy Cruise", town.calls <= busy.calls * 1.05, `${town.calls} vs ${busy.calls}`);
    t.check("town triangles ≤ busy Cruise", town.tris <= busy.tris * 1.05, `${town.tris} vs ${busy.tris}`);
    await g(`(window.__route = null, true)`);
    await g(`${D}.place("Main St", 118, 1.75, 0, 1)`);
    await t.frames(20);
    await t.shot("desktop-main-st");
    await g(`${D}.place("Madison Ave", 124, 1.75, 0, 1)`);
    await t.frames(15);
    await t.shot("circle");
    await g(`${D}.place("Lake Dr", 70, -1.75, 0, -1)`);
    await t.frames(40);
    await t.shot("lake-geese");
    await g(`${D}.place("Route 9", 40, -1.75, 0, -1)`);
    await t.frames(15);
    await t.shot("route9-jam");
    await g(`ctx.atmos.debug.time("night")`);
    await g(`${D}.place("Main St", 118, 1.75, 0, 1)`);
    await t.frames(40);
    await t.shot("night");
    t.check("night: windows + lamps glow", await g(`ctx.town.debug.S.T.mats.glow.emissiveIntensity > 0.5 && ctx.town.debug.S.T.halos.visible`));
    await g(`ctx.atmos.debug.time("noon")`);
    for (const [label, w, h] of [["tv", 1920, 1080], ["phone-portrait", 390, 844], ["phone-landscape", 844, 390]]) {
      await t.page.setViewportSize({ width: w, height: h });
      await g(`${D}.place("Main St", 118, 1.75, 0, 1)`);
      await t.frames(20);
      await t.shot(label);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });

    // ── 8. a random mash in town ─────────────────────────────────────────
    await g(`${D}.place("Clifton Ave", 100, 1.75, 0, 1)`);
    for (let i = 0; i < 70; i++) {
      const b = [0, 1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15][Math.floor(Math.random() * 12)];
      await t.stick(Math.random() * 2 - 1, Math.random() * 2 - 1);
      await t.hold(7, Math.random() < 0.6 ? 1 : 0);
      if (b !== 9) await t.tap(b);
      if (await g(`ctx.paused`)) await t.tap(9);
    }
    await t.stick(0, 0); await t.hold(7, 0);
    await t.frames(10);
    t.check("still alive after the mash", await g(`["playing", "footRun", "wrecked", "lawBust", "gameover", "hustleResult"].includes(L3.state) || !!L3.state`), await g(`L3.state`));
    if (await g(`ctx.paused`)) await t.tap(9);
    await g(`L3.setState("title")`);
    await t.frames(5);
    t.check("the title tears the town down", await g(`!ctx.town.active && !ctx.world.district`));
  },
};
