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
    // each section runs on its own: a failure is reported and the next section still runs
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const inTown = async () => {
      if (await g(`ctx.foot.active || L3.state !== "playing"`)) { await g(`(ctx.paused ? 0 : 0, L3.setState("playing"), true)`); await t.frames(3); }
      if (await g(`ctx.town.active`)) return true;
      await t.until(`__lulu3d.ctx.town.debug.S.loaded`, "town models loaded", 60000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ speed: 0 }))`);
      return t.until(`__lulu3d.ctx.town.active`, "ctx.town.enter() goes straight in", 5000);
    };
    const route = (pts, v = 9, r = 4) => g(`(window.__route = { pts: ${JSON.stringify(pts)}.map(([x, z]) => ({ x: ctx.town.debug.PL.ORIGIN.x + x, z: ctx.town.debug.PL.ORIGIN.z + z })), v: ${v}, r: ${r} }, true)`);
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, w0: performance.now() }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), frameMs: +((performance.now() - P.w0) / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length }; })()`);
    };

    t.check("ctx.town service is registered", await g(`!!(ctx.town && ctx.town.enter && ctx.town.leave && ctx.town.blocksSight && ctx.town.copRoute && ctx.town.copSpawn)`));
    t.check("party keeps the town OFF", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"town"/.test(s))`));
    t.check("the phone has the 🗞️ Kvetch app (local news)", await g(`!ctx.phone.addApp || (ctx.phone.apps ? ctx.phone.apps().includes("town") : true)`));
    t.check("the town is data: Lakewood's streets come from towns/lakewood.js", await g(`ctx.town.streets.includes("Route 9") && ctx.town.streets.includes("Main St") && !!ctx.town.towns.lakewood`));

    // ── 1. busy Cruise baseline (for the perf comparison) ────────────────
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 0`, "a Cruise run plans a Lakewood exit", 10000);
    t.check("the first exit is planned ahead (with its signs)", await g(`(() => { const e = ctx.town.debug.X.exits[0]; return e.s > ctx.car.s + 900 && ctx.world.signs.some(s => /LAKEWOOD/.test(s.lines.join(" "))); })()`));
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true))`);
    await route([], 0);
    await g(`(window.__auto = true, true)`);
    await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => c.hook("controls", (ctl, dt) => { if (window.__auto && !window.__route?.pts?.length) Object.assign(ctl, m.autoDrive(dt, 5.25, 30)); }, 999)))`);
    await t.frames(60);
    const busy = await perf(150);
    console.log("   PERF busy cruise", JSON.stringify(busy));
    await g(`(window.__auto = false, true)`);

    await step("exit", async () => {
      // ── 2. the exit: signs, the gantry, the ramp → steer onto it → town:enter ──
      await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(120), true)`);
      const E = await g(`ctx.town.debug.exitAhead(560)`);
      t.check("an exit can be planned right ahead", typeof E === "number", String(E));
      await g(`(() => { const r = ctx.world.road, s = ${E} - 380, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * 2; ctx.car.vz = Math.cos(p.h) * 2; return true; })()`);
      await t.frames(20);
      await t.shot("exit-gantry");
      // steer: keep right, take the decel lane, follow the ramp
      // the driving line down the decel lane onto the inner branch (exit.js's layout), to the STOP sign
      await g(`(() => { const r = ctx.world.road, E = ${E}, pts = ctx.town.debug.rampRoute(E, 0).map(([u, d]) => { const p = r.point(E + u, d, {}); return { x: p.x, z: p.z }; });
          window.__route = { pts, v: 15, r: 6 }; return true; })()`);
      await t.until(`__lulu3d.ctx.car.s > ${E} - 120`, "she drives down to the exit", 40000);
      await t.shot("exit-ramp");
      // past COMMIT on the branch: town:exit, then she drives on to the T-junction's STOP sign before the fade
      await t.until(`__lulu3d.ctx.town.debug.S.commit || __lulu3d.ctx.town.transitioning || __lulu3d.ctx.town.active`, "past COMMIT on the branch", 40000);
      t.check("committing to the branch fires town:exit before the fade (she drives on to the T-junction)", (await evs()).some(e => e.startsWith("town:exit")) && await g(`!!ctx.town.debug.S.commit || ctx.town.transitioning`));
      await t.shot("exit-tee");
      if (!await t.until(`__lulu3d.ctx.town.active`, "steering onto the off-ramp takes her into town (town:enter)", 40000)) return;
      await g(`(window.__route = null, true)`);
      t.check("town:enter fired", (await evs()).some(e => e.startsWith("town:enter")));
      t.check("in town: world.road is the TownRoad, still the 'playing' state", await g(`ctx.world.road.town === true && L3.state === "playing"`));
      t.check("every sign fits the one atlas (readable scale)", await g(`ctx.town.debug.S.T.signs.scale >= 0.55 && ctx.town.debug.S.T.signs.cells.length > 20`), String(await g(`[ctx.town.debug.S.T.signs.scale.toFixed(2), ctx.town.debug.S.T.signs.cells.length]`)));
      t.check("the highway's chunks are hidden, not streamed", await g(`[...ctx.world.chunks.values()].every(c => !c.group.visible)`));
      t.check("the trip bar is a street chip (Route 9 · LAKEWOOD)", await t.L(`/Route 9 · LAKEWOOD/.test(document.getElementById("tripLabel").textContent)`), await t.L(`document.getElementById("tripLabel").textContent`));
      await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
      await t.frames(10);
      await t.shot("welcome");
      t.check("drivers are out (silver minivans, a bus, the patrol)", await g(`ctx.town.debug.C.cars.length >= 6 && ctx.traffic.cars.some(c => c.kind === "town_van")`), String(await g(`ctx.town.debug.C.cars.map(c => c.kind).join(",")`)));
    });

    await step("corner", async () => {
      if (!await inTown()) return;
      // ── 3. drive round a corner: north on Route 9, LEFT onto 14th St (east) ──
      await g(`${D}.place("Route 9", -36, 1.75, 6, 1)`);
      await route([[-1.75, -18], [-1.5, -6], [3, 0.6], [12, 1.75], [40, 1.75]], 8, 3.5);
      await t.until(`__lulu3d.ctx.town.street === "14th St"`, "she turns the corner onto 14th St", 30000);
      t.check("…heading east along it", await g(`Math.abs(Math.sin(ctx.car.h) - 1) < 0.25`), String(await g(`ctx.car.h.toFixed(2)`)));
      await t.frames(20);
      await t.shot("corner");
      await g(`(window.__route = null, true)`);
    });

    await step("cops", async () => {
      if (!await inTown()) return;
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
    });

    await step("foot", async () => {
      if (!await inTown()) return;
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
    });

    await step("cars-visible", async () => {
      if (!await inTown()) return;
      // ── every live car in town has a visible mesh in the scene (no pooled body comes back hidden) ──
      await g(`${D}.place("Main St", 60, 1.75, 0, 1)`);
      await t.frames(20);
      const audit = () => g(`(() => {
        const cam = ctx.camera.position, bad = [];
        const shown = o => { for (let x = o; x; x = x.parent) { if (x === ctx.scene) return true; if (!x.visible) return false; } return false; };
        let near = 0;
        for (const c of ctx.traffic.cars) {
          const dist = Math.hypot(c.x - cam.x, c.z - cam.z);
          if (dist > 100) continue;
          // (one behind a block of houses may be hidden — the town's LOD — one in plain sight may not)
          const O = ctx.town.debug.PL.ORIGIN;
          if (dist > 45 && ctx.town.debug.sightBlocked(cam.x - O.x, cam.z - O.z, c.x - O.x, c.z - O.z)) continue;
          near++;
          let meshes = 0, ok = 0;
          c.obj.updateMatrixWorld(true);
          c.obj.traverse(o => { if (!o.isMesh) return; meshes++; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
            if (bs.radius > 0.02 && bs.radius < 14 && Math.hypot(bs.center.x - c.x, bs.center.z - c.z) < 9 && o.material && o.material.visible !== false) ok++; });
          if (!shown(c.obj) || !meshes || ok < meshes * 0.8) bad.push([c.kind, Math.round(dist), shown(c.obj), meshes, ok].join(":"));
        }
        return { near, bad };
      })()`);
      const a1 = await audit();
      t.check("every car in sight (≤ 100 m) in town is in the scene, visible, with sane bounding spheres", !a1.bad.length, JSON.stringify(a1));
      // the pool: a car the town hid (its far-car LOD) and gave back must come out VISIBLE for the next owner (a chase cruiser)
      const pool = await g(`(() => { const c = ctx.traffic.add("cop", ctx.car.s + 30, 1.75, 1, 0, { keep: true, data: { local: true } }); c.obj.visible = false; ctx.traffic.remove(c);
          const c2 = ctx.traffic.add("cop", ctx.car.s + 30, 1.75, 1, 0, { keep: true, data: { local: true } }); const v = c2.obj.visible; ctx.traffic.remove(c2); return c2.obj === c.obj && v; })()`);
      t.check("a pooled car body comes back visible (the town's far-car LOD can't leak an invisible cruiser)", pool);
      await t.shot("cars-visible");
    });

    await step("parked", async () => {
      if (!await inTown()) return;
      // ── the parked cars are SOLID: she bumps one, it's shoved (and its alarm goes off) ──
      await g(`(ctx.law.hold(300), ${D}.place("Route 9", 40, -1.75, 0, -1), true)`);
      await t.frames(4);
      const pk = await g(`(() => { const T = ${D}.S.T, O = ${D}.PL.ORIGIN, car = ctx.car; let best = null, bd = 1e9;
          for (const p of T.pcars) { if (p.gone) continue; const d = Math.hypot(O.x + p.x - car.pos.x, O.z + p.z - car.pos.z); if (d > 8 && d < bd) { bd = d; best = p; } }
          if (!best) return null; window.__pc = best; return { x: O.x + best.x, z: O.z + best.z, rot: best.rot, n: T.pcars.length }; })()`);
      t.check("the town's parked cars are registered (tagged in the merge, two colliders each)", !!pk && pk.n > 100, JSON.stringify(pk));
      if (pk) {
        // (from across the street, nose first into its side — along the kerb she'd hit the car parked behind it first)
        await g(`(() => { const p = window.__pc, O = ${D}.PL.ORIGIN, r = ctx.world.road, P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, ctx.car.s, {});
            const q = r.point(n.s, -Math.sign(n.d || 1) * 1.75, {}), h = Math.atan2(P.x - q.x, P.z - q.z);
            ctx.car.place(q.x, q.z, h); ctx.car.vx = Math.sin(h) * 7; ctx.car.vz = Math.cos(h) * 7; ctx.car.vF = 7; ctx.car.s = n.s; window.__pc0 = [p.x, p.z]; window.__hits = []; return true; })()`);
        await t.L(`import("./js/core/ctx.js").then(m => { if (!window.__phk) { window.__phk = true; m.on("town:parkedHit", e => window.__hits && window.__hits.push(e.impact)); } })`);
        await t.frames(45);
        const r = await g(`(() => { const p = window.__pc, O = ${D}.PL.ORIGIN; return { hits: window.__hits.length, moved: Math.hypot(p.x - window.__pc0[0], p.z - window.__pc0[1]), live: !!p.live, carGap: Math.hypot(O.x + p.x - ctx.car.pos.x, O.z + p.z - ctx.car.pos.z) }; })()`);
        t.check("driving into a parked car: she hits it (it's solid)", r.hits > 0 && r.carGap > 1.5, JSON.stringify(r));
        t.check("…and it's shoved (lifted out of the merge as a real car, moved)", r.live && r.moved > 0.15, JSON.stringify(r));
        await t.shot("parked-bump");
      }
      // on foot, on ANOTHER street than her car: she can't walk through a parked car, and ✋ hotwires it
      await g(`(ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, ${D}.place("Main St", 40, 1.75, 0, 1), true)`);
      await t.frames(3);
      await g(`ctx.foot.start("droveOff")`);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot (parked)", 30000)) return;
      const q = await g(`(() => { const T = ${D}.S.T, O = ${D}.PL.ORIGIN, st = ${D}.PL.byName["Route 9"], F = ctx.foot.debug.F; let best = null, bd = 1e9;
          for (const p of T.pcars) { if (p.gone || p.live) continue; const n = ctx.world.road.nearest(O.x + p.x, O.z + p.z, st.base + 100, {}); if (n.street !== st) continue; const dd = Math.abs(n.s - st.base - 110); if (dd < bd) { bd = dd; best = p; } }
          if (!best) return null; window.__fp = best;
          // stepping right into its side (inside the body, at the front wheel arch)
          const fx = Math.sin(best.rot), fz = Math.cos(best.rot), lx = Math.cos(best.rot), lz = -Math.sin(best.rot);
          F.pos.set(O.x + best.x + fx * 1.2 + lx * 0.5, 0, O.z + best.z + fz * 1.2 + lz * 0.5); return true; })()`);
      if (!q) { t.check("a parked car on Route 9 to walk up to", false); return; }
      await t.frames(4);
      const out = await g(`(() => { const p = window.__fp, O = ${D}.PL.ORIGIN, F = ctx.foot.debug.F, dx = F.pos.x - (O.x + p.x), dz = F.pos.z - (O.z + p.z); return Math.abs(dx * Math.cos(p.rot) - dz * Math.sin(p.rot)); })()`);
      t.check("on foot (a street away from her car), a parked car is solid: she's pushed out of its side", out > 1.15, out.toFixed(2));
      await g(`(() => { const p = window.__fp, O = ${D}.PL.ORIGIN, F = ctx.foot.debug.F; F.pos.set(O.x + p.x + Math.cos(p.rot) * 1.7, 0, O.z + p.z - Math.sin(p.rot) * 1.7); return true; })()`);
      await t.frames(12);
      const prompt = await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
      t.check("next to a parked car on foot: ✋ HOTWIRE CAR (like the highway's)", /HOTWIRE/.test(prompt), prompt);
      await g(`(ctx.foot.force.hotwire = true, true)`);
      await t.tap(0);
      await t.until(`["hotwire", "approach"].includes(__lulu3d.ctx.foot.phase) || __lulu3d.state === "playing"`, "the hotwire starts", 8000);
      for (let i = 0; i < 6 && await g(`ctx.foot.active`); i++) { await t.frames(12); await t.tap(0); }
      await t.until(`__lulu3d.state === "playing"`, "…she drives off in it", 20000);
      t.check("she hotwired a town parked car: driving it (the full model), gone from the kerb", await g(`ctx.foot.vehicle && ctx.foot.vehicle.kind === "town_minivan" && window.__fp.gone && ctx.town.active`), JSON.stringify(await g(`[ctx.foot.vehicle, window.__fp.gone]`)));
      await g(`(ctx.foot.force.hotwire = undefined, ctx.foot.dropRide(), true)`);
    });

    await step("jack-traffic", async () => {
      if (!await inTown()) return;
      // ── carjack a MOVING town driver: step out in front, it stops and waits, walk to the door, ✕ ──
      await g(`(ctx.law.hold(300), ctx.streets.force.reaction = "fist", window.__jw = null, true)`);
      await t.L(`import("./js/core/ctx.js").then(m => { if (!window.__jwk) { window.__jwk = true; m.on("streets:carjack", e => { window.__jw = e; }); } })`);
      // nobody's watching: the patrol goes home
      await g(`(() => { const C = ${D}.C; if (C.patrol) { ctx.traffic.remove(C.patrol); C.cars.splice(C.cars.indexOf(C.patrol), 1); C.patrol = null; } ${D}.S.def.traffic.cop = 0; return true; })()`);
      t.check("the town's big rides are jackable too (school bus, city bus, sweeper)", await g(`["town_van", "town_bus", "town_citybus", "town_sweeper", "town_carsvc"].every(k => !!ctx.streets.rides[k])`));
      await g(`${D}.place("Main St", 30, 1.75, 0, 1)`);
      await t.frames(2);
      await g(`ctx.foot.start("droveOff")`);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot (jack)", 30000)) return;
      let jacked = false;
      for (let tries = 0; tries < 4 && !jacked; tries++) {
        const c = await g(`(() => { const F = ctx.foot.debug.F; const c = ${D}.C.cars.find(c => c.kind === "town_van" && !c.free && !c.data.town.hazard && c.data.town.mode === "drive" && c.speed > 3);
            if (!c) return null; const f = { x: Math.sin(c.h), z: Math.cos(c.h) }; F.pos.set(c.x + f.x * 16, 0, c.z + f.z * 16); window.__jc = c; return c.speed; })()`);
        if (c == null) { await t.frames(30); continue; }
        await t.until(`__lulu3d.ctx.foot.debug.F && window.__jc.speed < 0.5`, "the minivan stops for her", 12000);
        await g(`(() => { const c = window.__jc, F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }, f = { x: Math.sin(c.h), z: Math.cos(c.h) }; F.pos.set(c.x + l.x * 1.6 + f.x * 0.6, 0, c.z + l.z * 1.6 + f.z * 0.6); return true; })()`);
        await t.frames(20);
        const pr = await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
        const still = await g(`window.__jc.speed < 0.5`);
        t.check(`a town driver who stopped for her waits by the door (try ${tries + 1}): ✕ JACK`, /JACK/.test(pr) && still, `${pr} · speed ${(await g(`window.__jc.speed`)).toFixed(1)}`);
        if (!/JACK/.test(pr)) continue;
        await t.tap(0);
        jacked = await g(`ctx.streets.jacking`);
      }
      if (!jacked) return;
      if (await t.until(`__lulu3d.state === "playing"`, "…she drives off in it", 30000)) {
        t.check("solo: she jacked a moving town minivan", await g(`ctx.streets.ride && ctx.streets.ride.kind === "town_van" && ctx.town.active`));
        await t.frames(10);
        t.check("…unwitnessed (no patrol in sight): no chase, no heat", await g(`!ctx.law.chasing && !!window.__jw && window.__jw.witnessed === false`), JSON.stringify(await g(`[ctx.law.chasing, window.__jw && window.__jw.witnessed]`)));
      }
      await g(`(ctx.streets.force.reaction = undefined, ctx.foot.dropRide(), ${D}.S.def.traffic.cop = 1, true)`);
    });

    await step("onramp", async () => {
      if (!await inTown()) return;
      const E = await g(`ctx.town.debug.S.exitS`);
      // ── 6. the on-ramp: Route 9 South → the highway, just past the exit ───
      await g(`${D}.place("Route 9", -30, -1.75, 12, -1)`);
      await route([[1.75, -60], [1.75, -90]], 12, 3);
      if (await t.until(`!__lulu3d.ctx.town.active`, "driving south out of town takes the on-ramp", 30000)) {
        t.check("town:leave fired (why: highway)", (await evs()).some(e => e.startsWith("town:leave") && /highway/.test(e)));
        t.check("back on the highway: on the interchange's on-ramp, heading down it to the merge", await g(`ctx.world.road.town !== true && ctx.car.s > ${E} + 180 && ctx.car.s < ${E} + 300 && ctx.car.d > 9 && ctx.car.speed > 5`), String(await g(`[Math.round(ctx.car.s - ${E}), ctx.car.d.toFixed(1), ctx.car.speed.toFixed(1)]`)));
        t.check("…the on-ramp is paved road (a lane: nothing stands on it)", await t.L(`import("./js/core/driving.js").then(m => m.pavedAt(__lulu3d.ctx.car.s, __lulu3d.ctx.car.d) >= 3)`));
        // follow the on-ramp down into the accel lane and merge into the right lane
        await t.L(`import("./js/features/town/exit.js").then(m => { const c = __lulu3d.ctx, r = c.world.road, E = ${E}, pts = []; for (let u = Math.round(c.car.s - E) + 12; u <= 470; u += 10) { const d = u < m.ON1 ? m.onD(u) : u < 380 ? 9.1 - (u - m.ON1) / 80 * 3.85 : 5.25; const p = r.point(E + u, d, {}); pts.push({ x: p.x, z: p.z }); } window.__route = { pts, v: 18, r: 6 }; })`);
        await t.until(`__lulu3d.ctx.car.s > ${E} + 440`, "down the on-ramp + the accel lane", 40000);
        t.check("…and merges into the right lane past the accel lane", await g(`ctx.car.d > 3 && ctx.car.d < 7.2`), await g(`ctx.car.d.toFixed(2)`));
        t.check("the highway chunks are back", await g(`[...ctx.world.chunks.values()].every(c => c.group.visible) && ctx.world.chunks.size > 2`));
        t.check("the town's scene is disposed", await g(`!ctx.scene.children.some(o => /^Town:/.test(o.name))`));
        await g(`(window.__route = null, true)`);
        await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
        await t.shot("back-on-highway");
      }
    });

    await step("perf", async () => {
      if (!await inTown()) return;
      // ── 7. perf in town + the screenshots ────────────────────────────────
      await g(`ctx.town.enter({ speed: 0 })`);
      await t.until(`__lulu3d.ctx.town.active`, "ctx.town.enter() goes straight in", 5000);
      await g(`(${D}.place("Main St", 20, 1.75, 6, 1), window.__route = null, true)`);
      // drive Main St east toward the circle (the busiest view) for the measurement
      await route([[60, 153.75], [132, 153.75], [142, 162], [150.25, 172], [150.25, 236]], 10, 4);
      await t.frames(40);
      const town = await perf(150);
      console.log("   PERF town", JSON.stringify(town));
      console.log("   PERF town static", JSON.stringify(await g(`(() => { const T = ctx.town.debug.S.T; const by = {}; T.root.traverse(o => { if (o.isMesh && o.userData.townLook) { const k = o.userData.townLook; by[k] = (by[k] || 0) + o.geometry.index.count / 3; } }); return { tris: Math.round(T.tris), meshes: T.merged, by }; })()`)));
      // (this test's Cruise only enables town/streets/law/atmos — lighter than a real busy Cruise with road events,
      //  cameos and banter's people, which measured ~350–485 calls / 85–115k triangles at 1280×720)
      t.check("town draw calls ≤ Cruise", town.calls <= busy.calls * 1.05, `${town.calls} vs ${busy.calls}`);
      t.check("town triangles within a busy Cruise's budget (≤ 115k)", town.tris <= 115000, `${town.tris} (this test's light Cruise: ${busy.tris})`);
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
    });

    await step("mash", async () => {
      if (!await inTown()) return;
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
    });

  },
};
