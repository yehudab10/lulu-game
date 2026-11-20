// 🏙️ Towns (features/town): Lakewood, a town you can turn into.
//   • the exit: LAKEWOOD signs + the off-ramp appear in Cruise → steer onto it → town:enter
//   • the district: world.road is the TownRoad, the trip bar is a street chip, drive round a corner
//   • law: a cruiser loses line of sight behind a block (the town's occluders), and routes round corners
//   • on foot: get out, talk to a local, carjack a (silver) minivan
//   • the on-ramp: Route 9 South → back on the highway just past the exit
//   • a random mash in town, perf numbers (busy Cruise vs. town), screenshots at
//     desktop / TV / phone portrait / phone landscape, and it is ON in a party (partyplus).
module.exports = {
  name: "town",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,streets,law,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const D = `ctx.town.debug`;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["town:exit", "town:enter", "town:leave", "town:talk", "town:gossip", "cop:chase", "streets:carjack"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 80)));
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
    t.check("party: the town is ON (not in the OFF set — partyplus tests it)", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => { const m = /const OFF = new Set\\(\\[([^\\]]*)\\]/.exec(s); return !!m && !/"town"/.test(m[1]); })`));
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
      // past COMMIT on the branch: town:exit, then she drives on to the T-junction's STOP sign — and on through it:
      // the towns stand right there (built in slices as she came up the highway), so there's no fade at all
      await t.until(`__lulu3d.ctx.town.debug.S.commit || __lulu3d.ctx.town.transitioning || __lulu3d.ctx.town.active`, "past COMMIT on the branch", 40000);
      t.check("committing to the branch fires town:exit (she drives on to the T-junction)", (await evs()).some(e => e.startsWith("town:exit")) && await g(`!!ctx.town.debug.S.commit || ctx.town.transitioning`));
      t.check("Lakewood + Midwood are built and standing at the interchange by then", await g(`ctx.town.standing.filter(b => Math.abs(b.exitS - ${E}) < 1 && b.ready).length === 2`), JSON.stringify(await g(`ctx.town.standing`)));
      await g(`(() => { const hw = ctx.world.highway, pts = window.__route.pts; for (const d of [44, 70, 110, 160, 210]) { const p = hw.point(${E} + 172.2, d, {}); pts.push({ x: p.x, z: p.z }); } window.__route.v = 11; return true; })()`);
      await t.until(`__lulu3d.ctx.car.s > ${E} + 150`, "at the T", 40000);
      await t.shot("exit-tee");
      t.check("no fade at the STOP sign (the town is right there)", await g(`!ctx.town.transitioning`));
      if (!await t.until(`__lulu3d.ctx.town.active`, "through the T and out the cross road: into town (town:enter)", 40000)) return;
      t.check("town:enter fired — attached, she drove in", (await evs()).some(e => e.startsWith("town:enter") && /"drove":true/.test(e)));
      t.check("in town: world.road is the TownRoad, still the 'playing' state", await g(`ctx.world.road.town === true && L3.state === "playing" && ctx.town.attached`));
      t.check("every sign fits the one atlas (readable scale)", await g(`ctx.town.debug.S.T.signs.scale >= 0.55 && ctx.town.debug.S.T.signs.cells.length > 20`), String(await g(`[ctx.town.debug.S.T.signs.scale.toFixed(2), ctx.town.debug.S.T.signs.cells.length]`)));
      t.check("the highway's chunks are still there (drawn, not streamed): she drove off it, it's behind her", await g(`[...ctx.world.chunks.values()].some(c => c.group.visible)`));
      t.check("the trip bar is a street chip (Route 9 · LAKEWOOD)", await t.L(`/Route 9 · LAKEWOOD/.test(document.getElementById("tripLabel").textContent)`), await t.L(`document.getElementById("tripLabel").textContent`));
      await t.until(`!__lulu3d.ctx.town.debug.S.att || !window.__route.pts.length`, "on up Route 9", 40000);
      await t.shot("welcome");
      t.check("drivers are out (silver minivans, a bus, the patrol)", await g(`ctx.town.debug.C.cars.length >= 6 && ctx.traffic.cars.some(c => c.kind === "town_van")`), String(await g(`ctx.town.debug.C.cars.map(c => c.kind).join(",")`)));
      await attached(t, g, E, perf);
      // (the rest of this test drives the stand-alone town — ctx.town.enter() — the same engine, unturned; its way out is this exit's on-ramp)
      await g(`(window.__route = null, ctx.town.leave("reset"), ctx.town.enter({ town: "lakewood", exitS: ${E}, attach: false, speed: 0 }), true)`);
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
      // (no town driver near the block for this: the cruiser is dropped onto Carpool Ln, and one it lands on or meets on
      //  the way round is a 💥 cop pile-up — it sits there spun out, and the check below reads that as "never moved")
      await g(`(() => { const o = ${D}.PL.ORIGIN; for (const c of ctx.traffic.cars.slice()) if (!(c.data && c.data.law) && Math.hypot(c.x - o.x - 20, c.z - o.z - 40) < 110) ctx.traffic.remove(c); return true; })()`);
      await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.car && u.mode === "chase"), o = ${D}.PL.ORIGIN, c = u.car;
          c.x = o.x + 40; c.z = o.z + 76 - 1.75; c.h = -Math.PI / 2; c.s = ${D}.PL.byName["Carpool Ln"].base + 40; c.speed = 0; window.__cop = c; return true; })()`);
      await t.until(`__lulu3d.ctx.law.searching`, "behind the block, the cops lose sight: SEARCHING", 6000);
      await t.shot("cop-search");
      await t.frames(60);
      t.check("the cruiser drives round the block to find her (it moved)", await g(`Math.hypot(window.__cop.x - (${D}.PL.ORIGIN.x + 40), window.__cop.z - (${D}.PL.ORIGIN.z + 74.25)) > 8`));
      await g(`(ctx.law.clearHeat ? ctx.law.clearHeat("test") : null, true)`);
      await t.frames(10);
    });

    await step("hiding", async () => {
      if (!await inTown()) return;
      // ── 4b. hiding in town: a travel lane is NOT a hiding place; the kerb among parked cars, out of sight, is ──
      const LAW = `ctx.law._dbg`, P = `${D}.PL`;
      const hud = () => t.L(`(document.querySelector(".law-wanted") || {}).textContent || ""`);
      await g(`(ctx.traffic.config.enabled = false, ctx.law.clearHeat ? ctx.law.clearHeat("test") : null, ${LAW}.L.hint2 = 0, true)`);
      t.check("Lakewood: every street has a parking lane with hiding spots at the kerb (among parked cars)", await g(`${P}.STREETS.every(st => { if (!st.parkLane) return false;
          for (let a = st.cross[0].a + 12; a < st.cross[st.cross.length - 1].a - 12; a += 3) for (const sd of [-1, 1]) { const p = ${D}.pt(st.name, a, sd * st.park), h = ctx.town.hideSpot(${P}.ORIGIN.x + p.x, ${P}.ORIGIN.z + p.z); if (h.ok && h.spot === "kerb") return true; }
          return false; })`));
      t.check("…a travel lane never is", await g(`${P}.STREETS.every(st => { for (let a = st.a0; a < st.a1; a += 5) for (const d of [-1.75, 1.75]) { const p = ${D}.pt(st.name, a, d); if (ctx.town.hideSpot(${P}.ORIGIN.x + p.x, ${P}.ORIGIN.z + p.z).ok) return false; } return true; })`));
      t.check("…up on the sidewalk / a driveway apron is off the street", await g(`(() => { const p = ${D}.pt("Clifton Ave", 120, 9.6); return ctx.town.hideSpot(${P}.ORIGIN.x + p.x, ${P}.ORIGIN.z + p.z).ok; })()`));
      // a cruiser behind the block (Route 9 / Madison Ave are a block away from Clifton Ave)
      const unit = `${LAW}.L.units.find(u => u.car && u.mode === "chase")`;
      const putUnit = (name, along, d, h) => g(`(() => { const u = ${unit}; if (!u) return false; const st = ${P}.byName[${JSON.stringify(name)}], p = ${D}.pt(${JSON.stringify(name)}, ${along}, ${d}), o = ${P}.ORIGIN;
          Object.assign(u.car, { x: o.x + p.x, z: o.z + p.z, h: ${h}, s: st.base + ${along}, speed: 0, hit: false }); return true; })()`);
      // (1) stopped MID-LANE on Clifton Ave while they search: not hidden — and a cruiser coming down the street sees her
      await g(`${D}.place("Clifton Ave", 120, 1.75, 0, 1)`);
      await g(`(${LAW}.L.grace = 0, ${LAW}.L.hold = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 1 }))`);
      await t.until(`!!__lulu3d.ctx.law._dbg.L.units.find(u => u.car && u.mode === "chase")`, "a cruiser joins (lane test)", 10000);
      await putUnit("Route 9", 120, -1.75, 0);
      await t.until(`__lulu3d.ctx.law.searching`, "behind the block: SEARCHING (lane test)", 8000);
      await t.frames(60);
      const laneInfo = await g(`${LAW}.hideInfo()`);
      t.check("stopped mid-lane while they search: NOT hiding", await g(`ctx.law.searching && ctx.law.hiding === ""`) && laneInfo.why === "lane", JSON.stringify(laneInfo));
      t.check("…the HUD says 👀 SEARCHING + 'not hidden — park at the kerb or get out of sight'", /SEARCHING/.test(await hud()) && /not hidden/.test(await hud()) && /kerb/.test(await hud()), await hud());
      t.check("…and a toast says so (once)", await g(`${LAW}.L.hint2 === 1`));
      await t.shot("hide-not-in-lane");
      // a cruiser turns onto Clifton Ave 60 m up the street and drives toward her: it sees her
      await putUnit("Clifton Ave", 180, -1.75, Math.PI);
      await g(`(() => { const u = ${unit}; window.__ai0 = u.car.ai; u.car.ai = (dt, c) => { c.z -= 9 * dt; c.s -= 9 * dt; c.speed = 9; }; return true; })()`);
      t.check("a cruiser driving down the street re-spots her in the travel lane", await t.until(`__lulu3d.ctx.law._dbg.L.chase && __lulu3d.ctx.law._dbg.L.chase.seen && !__lulu3d.ctx.law.searching`, "a passing cruiser re-spots her", 6000));
      t.check("…from well beyond the 10 m 'tucked away' range", await g(`(() => { const u = ${unit}; return Math.hypot(u.car.x - ctx.car.pos.x, u.car.z - ctx.car.pos.z) > 25; })()`));
      await g(`(() => { const u = ${unit}; if (u && window.__ai0) u.car.ai = window.__ai0; return true; })()`);
      await g(`(ctx.law.clearHeat("test"), true)`);
      await t.frames(5);

      // (2) PARKED AT THE KERB among parked cars on Forest Ave, out of sight: hiding — and she loses them
      const kerb = await g(`(() => { const st = ${P}.byName["Forest Ave"], T = ${D}.S.T, o = ${P}.ORIGIN;
          for (let a = 96; a < 140; a += 1) for (const sd of [1, -1]) { const p = ${D}.pt("Forest Ave", a, sd * st.park), h = ctx.town.hideSpot(o.x + p.x, o.z + p.z);
            if (!h.ok || h.spot !== "kerb") continue;
            if (T.parked.some(q => Math.hypot(q.x - p.x, q.z - p.z) < 5.6)) continue;          // a free slot
            return { a, d: sd * st.park, dir: sd }; }
          return null; })()`);
      t.check("there's a free kerb slot among parked cars on Forest Ave", !!kerb, JSON.stringify(kerb));
      if (!kerb) return;
      await g(`${D}.place("Madison Ave", 100, 1.75, 0, 1)`);           // seen here…
      await g(`(${LAW}.L.grace = 0, ${LAW}.L.hold = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 1 }))`);
      await t.until(`!!__lulu3d.ctx.law._dbg.L.units.find(u => u.car && u.mode === "chase")`, "a cruiser joins (kerb test)", 10000);
      await putUnit("Route 9", 100, -1.75, 0);
      await t.until(`__lulu3d.ctx.law.searching`, "behind the blocks: SEARCHING (kerb test)", 8000);
      await g(`${D}.place("Forest Ave", ${kerb.a}, ${kerb.d}, 0, ${kerb.dir})`);   // …and slips round the block into a parking spot
      const k0 = await g(`ctx.time`);
      await t.until(`__lulu3d.ctx.law.hiding === "town"`, "parked at the kerb out of sight: HIDING", 6000);
      const kerbInfo = await g(`${LAW}.hideInfo()`);
      t.check("parked at the kerb among parked cars, out of sight: ctx.law.hiding = 'town' (kerb)", kerbInfo.kind === "town" && kerbInfo.spot === "kerb", JSON.stringify(kerbInfo));
      await t.frames(3);
      t.check("the HUD says 🤫 HIDING… + 'stay put'", /HIDING/.test(await hud()) && /stay put/.test(await hud()), await hud());
      await t.shot("hide-kerb");
      // a cruiser looking down Forest Ave from 55 m (a clear line, but she's one of the parked row): still hidden
      const sv = await g(`(() => { const u = ${unit}; return { x: u.car.x, z: u.car.z, h: u.car.h, s: u.car.s }; })()`);
      await putUnit("Forest Ave", kerb.a - 55, kerb.dir * 1.75, kerb.dir > 0 ? 0 : Math.PI);
      await t.frames(6);
      t.check("…a cruiser 55 m down the same street doesn't pick her out of the parked row", await g(`ctx.law.searching && ctx.law.hiding === "town"`), JSON.stringify(await g(`${LAW}.hideInfo()`)));
      await g(`(() => { const u = ${unit}; Object.assign(u.car, ${JSON.stringify(sv)}, { speed: 0 }); return true; })()`);
      await t.until(`!__lulu3d.ctx.law.chasing`, "hiding at the kerb loses them", 30000);
      const took = (await g(`ctx.time`)) - k0;
      t.check("hiding at the kerb loses them (1★: ≤ 6 s)", await g(`${LAW}.log.filter(e => e.ev === "cop:chase").slice(-1)[0].result === "escaped"`) && took <= 6, `${took.toFixed(1)} s`);
      t.check("…counted as a hide (lawHides)", await g(`${LAW}.log.some(e => e.ev === "stat" && e.id === "lawHides")`));
      await g(`(ctx.law.hold(200), true)`);
      await t.frames(5);
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

      // (behind a town driver, 25 m back down its street, so there IS a car in sight to judge)
      await g(`(() => { const c = ${D}.C.cars.find(c => !c.free && c.data.town.mode === "drive" && c.kind !== "cop"); if (!c) return false; ctx.traffic.config.enabled = false;
          const f = { x: Math.sin(c.h), z: Math.cos(c.h) }; ctx.car.place(c.x - f.x * 25, c.z - f.z * 25, c.h); ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; ctx.car.s = c.s - 25 * c.dir; ctx.cam.snap(); return true; })()`);
      await t.frames(12);
      const audit = () => g(`(() => {
        const cam = ctx.camera.position, bad = [];
        const shown = o => { for (let x = o; x; x = x.parent) { if (x === ctx.scene) return true; if (!x.visible) return false; } return false; };
        let near = 0;
        for (const c of ctx.traffic.cars) {
          const dist = Math.hypot(c.x - cam.x, c.z - cam.z);
          if (dist > 100) continue;
          // (one behind a block of houses may be hidden — the town's LOD — one in plain sight may not)
          const la = ctx.town.debug.local(cam.x, cam.z), lb = ctx.town.debug.local(c.x, c.z);
          if (dist > 45 && ctx.town.debug.sightBlocked(la.x, la.z, lb.x, lb.z)) continue;
          near++;
          let meshes = 0, ok = 0;
          c.obj.updateMatrixWorld(true);
          c.obj.traverse(o => { if (!o.isMesh) return; meshes++; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere.clone().applyMatrix4(o.matrixWorld);
            if (bs.radius > 0.02 && bs.radius < 14 && Math.hypot(bs.center.x - c.x, bs.center.z - c.z) < 9 && o.material && o.material.visible !== false) ok++; });
          if (!shown(c.obj) || !meshes || ok < meshes * 0.8) bad.push([c.kind, Math.round(dist), shown(c.obj), meshes, ok, c.obj.visible, !!c.obj.parent, ${D}.C.cars.includes(c), (c.data && c.data.town && c.data.town.mode) || "-"].join(":"));
        }
        return { near, bad };
      })()`);
      // (the town judges its drivers every 3rd frame: one just rounding a corner may be a frame behind — look again)
      let a1 = await audit();
      if (a1.bad.length) { await t.frames(6); const a2 = await audit(); a1 = { near: a2.near, bad: a2.bad, first: a1.bad }; }
      t.check("every car in sight (≤ 100 m) in town is in the scene, visible, with sane bounding spheres", a1.near > 0 && !a1.bad.length, JSON.stringify(a1));
      // the pool: a car the town hid (its far-car LOD) and gave back must come out VISIBLE for the next owner (a chase cruiser)
      const pool = await g(`(() => { const c = ctx.traffic.add("cop", ctx.car.s + 30, 1.75, 1, 0, { keep: true, data: { local: true } }); c.obj.visible = false; ctx.traffic.remove(c);
          const c2 = ctx.traffic.add("cop", ctx.car.s + 30, 1.75, 1, 0, { keep: true, data: { local: true } }); const v = c2.obj.visible; ctx.traffic.remove(c2); return c2.obj === c.obj && v; })()`);
      // the parked cars' merged clusters: one in plain sight (in view, no block between) is never culled away
      let seen = 0, hid = [];
      for (const [name, a0, a1] of await g(`${D}.PL.STREETS.map(s => [s.name, s.a0, s.a1])`)) for (const f of [0.2, 0.5, 0.8]) {
        await g(`(${D}.place(${JSON.stringify(name)}, ${a0} + (${a1} - ${a0}) * ${f}, 1.75, 0, 1), ctx.cam.snap(), true)`);
        await t.frames(7);
        const r = await g(`(() => { const T = ${D}.S.T, O = ${D}.PL.ORIGIN, cam = ctx.camera; cam.updateMatrixWorld();
            const cl = ${D}.local(cam.position.x, cam.position.z), out = { seen: 0, bad: [] };
            for (const p of T.pcars) { if (p.live || p.gone) continue; const d = Math.hypot(p.x - cl.x, p.z - cl.z); if (d > 120) continue;
              const v = cam.position.clone().set(O.x + p.x, 1, O.z + p.z).project(cam); if (Math.abs(v.x) > 0.95 || Math.abs(v.y) > 0.95 || v.z > 1 || v.z < -1) continue;
              if (${D}.sightBlocked(cl.x, cl.z, p.x, p.z)) continue;
              out.seen++;
              const m = T.clusters.find(m => m.userData.townLook === "flat" && p.x >= m.userData.cell.x0 && p.x < m.userData.cell.x1 && p.z >= m.userData.cell.z0 && p.z < m.userData.cell.z1);
              if (!m || !m.visible) out.bad.push(Math.round(d)); }
            return out; })()`);
        seen += r.seen; if (r.bad.length) hid.push(`${name}@${f}:${r.bad.join("/")}`);
      }
      t.check(`no parked car in plain sight is culled with its cluster (${seen} checked)`, seen > 50 && !hid.length, hid.slice(0, 6).join(" "));
      t.check("a pooled car body comes back visible (the town's far-car LOD can't leak an invisible cruiser)", pool);
      await t.shot("cars-visible");
    });

    await step("parked", async () => {
      if (!await inTown()) return;
      // ── the parked cars are SOLID: she bumps one, it's shoved (and its alarm goes off) ──
      await g(`(ctx.law.hold(300), ${D}.place("Route 9", 40, -1.75, 0, -1), true)`);
      await t.frames(4);
      // (a car with a clear run-up from the centre line: none of the others — a double-parked one in the lane, say — in the way)
      const pk = await g(`(() => { const T = ${D}.S.T, O = ${D}.PL.ORIGIN, car = ctx.car, r = ctx.world.road; let best = null, bd = 1e9;
          const clear = p => { const P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, car.s, {}), q = r.point(n.s, 0, {});
            const ex = P.x - q.x, ez = P.z - q.z, L2 = ex * ex + ez * ez || 1;
            return !T.pcars.some(o => { if (o === p || o.gone) return false; const ox = O.x + o.x - q.x, oz = O.z + o.z - q.z, u = Math.max(0, Math.min(1, (ox * ex + oz * ez) / L2));
              return Math.hypot(ox - ex * u, oz - ez * u) < 3.2; }); };
          for (const p of T.pcars) { if (p.gone) continue; const d = Math.hypot(O.x + p.x - car.pos.x, O.z + p.z - car.pos.z); if (d > 8 && d < bd && clear(p)) { bd = d; best = p; } }
          if (!best) return null; window.__pc = best; return { x: O.x + best.x, z: O.z + best.z, rot: best.rot, n: T.pcars.length }; })()`);
      t.check("the town's parked cars are registered (tagged in the merge, two colliders each)", !!pk && pk.n > 100, JSON.stringify(pk));
      if (pk) {
        // (from across the street, nose first into its side — along the kerb she'd hit the car parked behind it first;
        //  she starts on the centre line: from the far lane her tail reached into the far kerb's parking lane, and with
        //  the kerbs lined with minivans (features/homes) she bumped the car parked behind her instead)
        await t.L(`import("./js/core/ctx.js").then(m => { if (!window.__phk) { window.__phk = true; m.on("town:parkedHit", e => window.__hits && window.__hits.push(e.impact)); } })`);
        await g(`(() => { const p = window.__pc, O = ${D}.PL.ORIGIN, r = ctx.world.road, P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, ctx.car.s, {});
            const q = r.point(n.s, 0, {}), h = Math.atan2(P.x - q.x, P.z - q.z);
            ctx.car.place(q.x, q.z, h); ctx.car.vx = Math.sin(h) * 7; ctx.car.vz = Math.cos(h) * 7; ctx.car.vF = 7; ctx.car.s = n.s; window.__pc0 = [p.x, p.z]; window.__hits = []; return true; })()`);
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

    await step("knockout", async () => {
      if (!await inTown()) return;
      // ── out of hearts IN TOWN: she gets up right there beside her car (no tow to the highway, no black screen) ──
      await g(`(${D}.place("Main St", 20, 1.75, 4, 1), window.__route = null, true)`);
      await t.frames(20);
      const at = await g(`({ x: ctx.car.pos.x, z: ctx.car.pos.z })`);
      await g(`(ctx.G.hearts = 1, ctx.G.invT = 0, ctx.foot.force.er = null, L3.damage(1, "a test minivan", "crash"))`);
      if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "knocked out in town: back on her feet", 12000)) return;
      const K = await g(`(() => { const F = ctx.foot.debug.F, e = document.getElementById("townFade"); return { town: ctx.town.active, d: Math.hypot(F.pos.x - ${"${at.x}"}, F.pos.z - ${"${at.z}"}), fade: e ? +getComputedStyle(e).opacity : 0, hearts: ctx.G.hearts, max: ctx.G.maxHearts, car: !!(F.car && F.car.drivable), reason: F.reason }; })()`.replace("${at.x}", at.x).replace("${at.z}", at.z));
      t.check("…still IN town, a few steps from where she crashed", K.town === true && K.d < 14, JSON.stringify(K));
      t.check("…no black screen over the street", K.fade < 0.05, JSON.stringify(K));
      t.check("…hearts back, her car right there to get back into", K.hearts === K.max && K.car && K.reason === "knockout", JSON.stringify(K));
      await g(`ctx.foot.debug.getIn()`);
      await t.until(`__lulu3d.state === "playing"`, "she gets back in", 8000);
      t.check("…and drives on in town", await g(`ctx.town.active && ctx.car.obj.visible`));
      // on foot in town the ER can scoop her up only where the town has its hospital (features/places: she wakes up in it and
      // walks out of its door — the places test plays that); without one it never does (it would dump her on the highway)
      await g(`(ctx.foot.start("droveOff"), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car again", 8000);
      t.check("on foot in town: an ER trip only where the town has a hospital", await g(`ctx.foot.erChance() === (ctx.civic && ctx.civic.here ? 0.2 : 0)`), String(await g(`ctx.foot.erChance()`)));
      await g(`ctx.foot.debug.getIn()`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 8000);
    });

    await step("leave-on-foot", async () => {
      if (!await inTown()) return;
      // leaving a town while she WALKS in it (any scene the town can't host, a reset): never left standing where the town was
      const E0 = await g(`ctx.town.debug.S.exitS`);
      for (const why of ["quiet", "reset"]) {
        if (!await inTown()) return;
        await g(`(${D}.place("Main St", 60, 1.75, 0, 1), true)`);
        await g(`(ctx.foot.start("droveOff"), true)`);
        if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, `on foot in town (${why})`, 8000)) return;
        await g(`(ctx.town.leave(${JSON.stringify(why)}), true)`);
        const a = await g(`(() => { const F = ctx.foot.debug.F; return { x: F.pos.x, z: F.pos.z, s: F.s, d: F.d, car: F.car && F.car.stub ? Math.hypot(F.car.stub.x - F.pos.x, F.car.stub.z - F.pos.z) : -1, active: ctx.town.active, st: L3.state }; })()`);
        await t.frames(12);
        const b = await g(`(() => { const F = ctx.foot.debug.F; return { x: F.pos.x, z: F.pos.z, s: F.s, d: F.d }; })()`);
        t.check(`leaving a town on foot (${why}): she's on the highway side beside her car, standing still (no shove)`,
          !a.active && a.car >= 0 && a.car < 5 && Math.abs(a.d) < 40 && a.s > 4 && Math.hypot(b.x - a.x, b.z - a.z) < 0.6, JSON.stringify({ a, b }));
        // (back in her car, and back in the town the way the rest of this test had it — at the same exit)
        await g(`ctx.foot.debug.getIn()`);
        await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "back in the car", 8000);
        await g(`(ctx.town.enter({ town: "lakewood", exitS: ${E0}, attach: false, speed: 0 }), true)`);
        await t.until(`__lulu3d.ctx.town.active`, "back in town", 8000);
      }
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
        t.check("the town's scene is disposed (only towns standing at an interchange are left)", await g(`!ctx.scene.children.some(o => /^Town:/.test(o.name) && !ctx.town.debug.S.built.some(b => b.T && b.T.root === o))`));
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
      //  The highway's chunks are now merged (merge.js: ~35 % fewer draw calls than when this check was written), so the
      //  yardstick moved, not the town: hold the town to the light Cruise's budget from then (~240) or today's, whichever is higher.
      t.check("town draw calls ≤ Cruise (≤ 240, the light Cruise before merged chunks)", town.calls <= Math.max(busy.calls * 1.05, 240), `${town.calls} vs ${busy.calls}`);
      // (re-measured 2026-11-20, ci/oneworld: the same view swings 111.7k–117.5k between runs of the same code with the
      //  traffic / walkers in sight — ~27k of it is cars + people, ~10.6k the sky's clouds, neither the town's; the town's
      //  own blocks / ground are unchanged. 120k keeps the yardstick (a busy Cruise's 85–115k + that swing); AGENTS §7.)
      t.check("town triangles within a busy Cruise's budget (≤ 120k)", town.tris <= 120000, `${town.tris} (this test's light Cruise: ${busy.tris})`);
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

/** ONE WORLD: the attached towns' placement, Midwood by Avenue P, on foot across the line, the budget in an attached town. */
async function attached(t, g, E, perf) {
  const D = `ctx.town.debug`;
  // placement: the inner cross road runs straight on into Route 9 (same line, same heading); both towns clear the highway
  const pl = await g(`(() => { const P = ${D}.placeAt("lakewood", ${E}, 0), hw = ctx.world.highway, a = hw.point(${E} + P.cu, P.d0, {}), b = hw.point(${E} + P.cu, 160, {});
    const w0 = ${D}.world(P.approach.from[0], P.approach.from[1], "lakewood"), w1 = ${D}.world(0, -96, "lakewood");
    return { from: +Math.hypot(w0.x - a.x, w0.z - a.z).toFixed(2), r9: +Math.abs((b.x - a.x) * (w1.z - a.z) - (b.z - a.z) * (w1.x - a.x)) / Math.hypot(b.x - a.x, b.z - a.z) }; })()`);
  t.check("attached: Lakewood's Route 9 continues the inner cross road (on its line, from its far end)", pl.from < 0.5 && pl.r9 < 0.5, JSON.stringify(pl));
  t.check("…and every planned interchange has both towns ≥ 100 m clear of the highway", await g(`ctx.town.debug.exits().every(s => ${D}.fits(s))`));
  t.check("the approach isn't somewhere to hide (a travel lane)", await g(`(() => { const P = ${D}.placeAt("lakewood", ${E}, 0), w = ${D}.world(P.approach.from[0], P.approach.from[1] + 30, "lakewood"); const h = ctx.town.hideSpot(w.x, w.z); return h && !h.ok && h.why === "lane"; })()`));
  // the budget in an attached town (the highway's chunks and Midwood stand nearby): Main St east, the busiest view
  await g(`(window.__route = null, ${D}.place("Main St", 60, 1.75, 6, 1))`);
  await t.frames(40);
  const town = await perf(120);
  console.log("   PERF attached town", JSON.stringify(town));
  // (the stand-alone town's budget is 240 calls / 115k triangles; an attached town also shows the interchange down Route 9
  //  — ~+10k triangles here, perf3d "attached" vs "town" — and stays well under the highway's own cost at the same spot:
  //  the exits test measures 250–270 calls / 180–255k triangles on the highway by an interchange)
  t.check("attached town draw calls ≤ the stand-alone town's budget (240)", town.calls <= 240, String(town.calls));
  t.check("attached town triangles ≤ 125k (the town's 115k + the interchange in view)", town.tris <= 125000, String(town.tris));
  await t.shot("attached-main-st");
  // back out by Route 9 and the T, then Midwood: the outer branch's cross road runs on as Avenue P to Ocean Pkwy's corner
  // (the run's next interchange: she's put on the highway 300 m short of it, so its towns are planned + built)
  const E2 = await g(`${D}.exits().find(s => s > ${E} + 600)`);
  await g(`(ctx.town.leave("reset"), ctx.law.hold(600), (() => { const s = ${E2} - 300, p = ctx.world.highway.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.world.prebuild(s); ctx.cam.snap(); })(), true)`);
  await t.frames(5);
  await g(`${D}.buildNow()`);
  await t.until(`__lulu3d.ctx.town.standing.filter(b => Math.abs(b.exitS - ${E2}) < 1 && b.ready).length === 2 || (${D}.buildNow(), false)`, "Midwood + Lakewood built at the next interchange", 30000);
  await g(`(() => { const hw = ctx.world.highway, p = hw.point(${E2} + 122.2, 64, {}), q = hw.point(${E2} + 122.2, 90, {}), h = Math.atan2(q.x - p.x, q.z - p.z);
    ctx.car.place(p.x, p.z, h); ctx.car.s = ${E2} + 122.2; ctx.car.d = 64; ctx.car.vx = Math.sin(h) * 8; ctx.car.vz = Math.cos(h) * 8; ctx.car.vF = 8; ctx.world.prebuild(${E2}); ctx.cam.snap();
    const P = ${D}.placeAt("midwood", ${E2}, 1), pts = [];
    for (const [x, z] of [[-470, -345], [-420, -345], [-372, -345], [-320, -345], [-268, -343], [-253, -330], [-252.5, -300], [-252.5, -250]]) pts.push(${D}.world(x, z, "midwood"));
    window.__route = { pts, v: 9, r: 5 }; return true; })()`);
  // a cruiser on her tail as she drives in: it follows her into town (it used to vanish at the line)
  await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 1 }), true)`);
  const tailed = await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.car && u.mode === "chase" && __lulu3d.ctx.traffic.cars.includes(u.car))`, "a cruiser on her tail", 15000);
  if (tailed) await g(`(window.__cop = ctx.law._dbg.L.units.find(u => u.car && u.mode === "chase" && ctx.traffic.cars.includes(u.car)).car, true)`);
  if (await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "the outer cross road takes her into Midwood (attached)", 40000)) {
    if (tailed) {
      const c0 = await g(`({ in: ctx.traffic.cars.includes(window.__cop), d: Math.hypot(window.__cop.x - ctx.car.pos.x, window.__cop.z - ctx.car.pos.z) })`);
      await t.frames(30);
      const c1 = await g(`({ in: ctx.traffic.cars.includes(window.__cop), d: Math.hypot(window.__cop.x - ctx.car.pos.x, window.__cop.z - ctx.car.pos.z), chasing: ctx.law.chasing })`);
      t.check("the cruiser on her tail follows her into town (the same car, still behind her — not gone at the line)", c0.in && c1.in && c1.d < 150, JSON.stringify({ c0, c1 }));
      await g(`(ctx.law.standDown(), ctx.law.hold(120), true)`);
    }
    t.check("…on Avenue P", await g(`ctx.town.street === "Avenue P" && ctx.town.attached`), await g(`ctx.town.street`));
    await t.until(`__lulu3d.ctx.town.street === "Ocean Pkwy" || !window.__route.pts.length`, "round the corner onto Ocean Pkwy", 60000);
    t.check("…round the corner onto Ocean Pkwy (Midwood stands behind the ramp)", await g(`ctx.town.street === "Ocean Pkwy"`), await g(`ctx.town.street`));
    await t.shot("attached-midwood");
    // knocked out in town: on her feet beside her car, right here (no tow to the highway, no fade)
    await g(`(window.__route = null, window.__townFade = 0, window.__tfI = setInterval(() => { const f = document.getElementById("townFade"); if (f && +f.style.opacity > 0) window.__townFade++; }, 10),
        (() => { for (let i = 0; i < 5; i++) { ctx.G.invT = 0; L3.damage(1, "Lulu vs. a test", "test"); } })(), true)`);
    if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "knocked out in town → on her feet", 15000)) {
      t.check("knocked out in town: on her feet in Midwood, beside her car (not towed out)", await g(`ctx.town.active && ctx.town.id === "midwood" && ctx.town.attached && ctx.car.pos.distanceTo(ctx.foot.debug.F.pos) < 8`),
        JSON.stringify(await g(`[ctx.town.active, ctx.town.id, ctx.car.pos.distanceTo(ctx.foot.debug.F.pos)]`)));
      t.check("…and no fade", await t.L(`(clearInterval(window.__tfI), window.__townFade === 0)`), String(await t.L(`window.__townFade`)));
      await g(`(L3.setState("playing"), true)`);
      await t.frames(3);
    }
  }
  await g(`(window.__route = null, true)`);
  // on foot across the line: out of the car at the inner T (the highway's road), walk out the cross road → in town; back → out
  await g(`ctx.town.active ? ctx.town.leave("reset") : 0`);
  await g(`(() => { const hw = ctx.world.highway, p = hw.point(${E2} + 172.2, 38, {}); ctx.car.place(p.x, p.z, p.h - Math.PI / 2); ctx.car.s = ${E2} + 172.2; ctx.car.d = 38; ctx.world.prebuild(${E2}); ctx.cam.snap(); return true; })()`);
  await t.frames(5);
  await t.until(`(__lulu3d.ctx.town.debug.buildNow(), __lulu3d.ctx.town.standing.filter(b => Math.abs(b.exitS - ${E2}) < 1 && b.ready).length === 2)`, "the towns stand at the T again", 20000);
  await g(`(ctx.foot.start("droveOff"), true)`);
  if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "on foot at the T", 8000)) {
    t.check("on foot at the T: still the highway's road", await g(`!ctx.town.active`));
    const walk = async (d0, d1) => { for (let d = d0; Math.sign(d1 - d0) * (d1 - d) > 0; d += Math.sign(d1 - d0) * 1.2) { await g(`(() => { const p = ctx.world.highway.point(${E2} + 172.2 - 1, ${d}, {}); ctx.foot.debug.F.pos.set(p.x, 0.05, p.z); return true; })()`); await t.frames(1); } };
    await walk(40, 60);
    await t.frames(3);
    t.check("…walking out the cross road takes her into Lakewood (on foot, no cut)", await g(`ctx.town.active && ctx.town.attached && ctx.town.id === "lakewood" && L3.state === "footRun"`), await g(`[ctx.town.active, ctx.town.id, L3.state]`));
    // the town left while she walks in it (a scene, a party hand-back…): she stays exactly where she is, her road position the highway's
    {
      const b = await g(`(() => { const F = ctx.foot.debug.F; return { x: F.pos.x, z: F.pos.z }; })()`);
      const a = await g(`(() => { ctx.town.leave("quiet"); const F = ctx.foot.debug.F; return { s: F.s, d: F.d, active: ctx.town.active }; })()`);
      await t.frames(10);
      const c = await g(`(() => { const F = ctx.foot.debug.F; return { x: F.pos.x, z: F.pos.z, st: L3.state }; })()`);
      t.check("leaving an attached town while on foot: she stays where she is (no shove), the highway's road position",
        !a.active && Math.hypot(c.x - b.x, c.z - b.z) < 1 && a.s > E2 && a.s < E2 + 400 && c.st === "footRun", JSON.stringify({ b, a, c }));
      await t.frames(5);
    }
    await walk(60, 40);
    await t.frames(3);
    t.check("…and walking back past the line, the highway's road again (her road position sane)", await g(`!ctx.town.active && ctx.foot.debug.F.s < ${E2} + 400 && ctx.foot.debug.F.s > ${E2}`), String(await g(`ctx.foot.debug.F.s`)));
    await g(`(L3.setState("playing"), true)`);
    await t.frames(3);
  }
}
