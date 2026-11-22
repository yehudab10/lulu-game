// 🏙️ Towns (features/town): MIDWOOD, Brooklyn — the second town, on the same engine as Lakewood.
//   • Cruise's exits take turns (Lakewood, then Midwood); the MIDWOOD exit's signs + ramp → town:enter
//   • the plan: a real DIAGONAL (Kings Hwy), 4-sided blocks beside it, one-way East streets,
//     the Ocean Pkwy boulevard, priority avenues; the street chip says where she is
//   • drive round the corner from Ocean Pkwy onto Kings Hwy (the diagonal)
//   • traffic keeps to the one-ways; the wrong way down one is a group-chat event
//   • the B/Q: embankment, bridges, a train that runs and stops at the station
//   • on foot: the car-service guy, the bubby on the bench ("LAKEWOOD? Sorry for your loss"),
//     carjack a double-parked minivan on Avenue J
//   • cops round the blocks; the on-ramp back; Lakewood still works after Midwood
//   • perf (busy Cruise vs. Midwood), screenshots at desktop / TV / phone, a random mash
module.exports = {
  name: "midwood",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,streets,law,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const D = `ctx.town.debug`;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["town:enter", "town:leave", "town:talk", "town:gossip", "town:oneway", "town:train", "cop:chase", "streets:carjack"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 120)));
      m.hook("controls", (ctl, dt) => { const W = window.__route; if (!W || !W.pts.length) return; const car = m.ctx.car;
        const p = W.pts[0]; if (Math.hypot(p.x - car.pos.x, p.z - car.pos.z) < (W.r || 4)) { W.pts.shift(); if (!W.pts.length) return; }
        const q = W.pts[0], want = Math.atan2(q.x - car.pos.x, q.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < (W.v || 9) ? 0.7 : 0; ctl.brake = car.speed > (W.v || 9) + 3 ? 0.4 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000);
    })`);
    const evs = () => t.L(`window.__ev.slice()`);
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const inMidwood = async () => {
      if (await g(`ctx.foot.active || L3.state !== "playing"`)) { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
      if (await g(`ctx.town.active && ctx.town.id === "midwood"`)) return true;
      if (await g(`ctx.town.active`)) { await g(`ctx.town.leave("quiet")`); await t.frames(2); }
      await g(`(ctx.town.load("midwood"), true)`);
      await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 60000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "midwood", speed: 0 }))`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "ctx.town.enter({ town: 'midwood' }) goes straight in", 5000);
    };
    // a route through LOCAL street points: [[name, along, d], …] (computed in the page from the plan)
    const route = (pts, v = 9, r = 4) => g(`(() => { const o = ${D}.PL.ORIGIN; window.__route = { pts: ${JSON.stringify(pts)}.map(([n, a, d]) => { const p = ${D}.pt(n, a, d); return { x: o.x + p.x, z: o.z + p.z }; }), v: ${v}, r: ${r} }; return true; })()`);
    const khA = x => (x + 77.5) / 0.976218;          // along Kings Hwy where it crosses local x (towns/midwood.js › khA)
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, w0: performance.now() }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), frameMs: +((performance.now() - P.w0) / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length }; })()`);
    };

    t.check("both towns are data (towns/lakewood.js + towns/midwood.js)", await g(`!!(ctx.town.towns.lakewood && ctx.town.towns.midwood)`));
    t.check("each town has its OWN exit, in a fixed order along the road: Midwood (home), then Lakewood", await t.L(`import("./js/features/town/towns/index.js").then(m => m.ROUTE.stops.map(s => s.town.id).join(","))`) === "midwood,lakewood");

    // ── 1. busy Cruise baseline + the second exit is Midwood's ───────────
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 0`, "a Cruise run plans its first exit", 10000);
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true))`);
    await g(`(window.__auto = true, true)`);
    await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => c.hook("controls", (ctl, dt) => { if (window.__auto && !window.__route?.pts?.length) Object.assign(ctl, m.autoDrive(dt, 5.25, 30)); }, 999)))`);
    await t.frames(60);
    const busy = await perf(150);
    console.log("   PERF busy cruise", JSON.stringify(busy));
    await g(`(window.__auto = false, true)`);

    await step("alternate", async () => {
      // drive (teleport) up to the first exit: the planner adds the next one, and it's Midwood's
      await g(`(() => { const e = ${D}.X.exits[0], r = ctx.world.road, s = e.s - 950, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; return true; })()`);
      await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 1`, "the next exit gets planned", 10000);
      const ex = await g(`${D}.X.exits.map(e => e.towns.map(t => t.id).join("+") + "@" + Math.round(e.s))`);
      t.check("exit #1 is Midwood's alone (home), exit #2 Lakewood's alone — no ramp that splits", /^midwood@/.test(ex[0] || "") && /^lakewood@/.test(ex[1] || ""), ex.join(","));
      t.check("…exit #1 is ctx.town.home's", await g(`(() => { const h = ctx.town.home; return !!h && h.town === "midwood" && Math.abs(h.exitS - ${D}.X.exits[0].s) < 1; })()`), JSON.stringify(await g(`ctx.town.home`)));
      t.check("Midwood's exit has its own signs (BROOKLYN · MIDWOOD, PARALLEL PARK) and no 'LAKEWOOD OR BROOKLYN?' board", await g(`ctx.world.signs.some(s => /PARALLEL PARK/.test(s.lines.join(" "))) && ctx.world.signs.some(s => /BROOKLYN/.test(s.lines.join(" "))) && !ctx.world.signs.some(s => /LAKEWOOD OR BROOKLYN/.test(s.lines.join(" ")))`));
      // the same metres on every run (a pure function of the road — friends and the title see the same exits)
      await g(`L3.startRun({ mode: "cruise" })`);
      await t.until(`__lulu3d.state === "playing"`, "a second run");
      await g(`(() => { const e = ${D}.X.exits[0], r = ctx.world.road, s = e.s - 950, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; return true; })()`);
      await t.until(`__lulu3d.ctx.town.debug.X.exits.length > 1`, "the next exit gets planned (2nd run)", 10000);
      const ex2 = await g(`${D}.X.exits.map(e => e.towns.map(t => t.id).join("+") + "@" + Math.round(e.s))`);
      t.check("…and the same exits at the same metres on a second run", ex2.slice(0, 2).join(",") === ex.slice(0, 2).join(","), ex.slice(0, 2).join(",") + " | " + ex2.slice(0, 2).join(","));
    });

    await step("home", async () => {
      // ── the home start (ci/hometown): Lulu's empty lot in Midwood + a QUIET warp onto its driveway ──
      await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood's models load", 60000);
      const H = await g(`ctx.town.home`);
      const sp = await g(`ctx.town.spotOf("midwood", "luluHome", ${H.exitS})`);
      t.check("the home lot is a spot before the town is built (door, drive, kerb)", !!(sp && sp.door && sp.drive && sp.kerb), JSON.stringify(sp).slice(0, 200));
      await t.L(`import("./js/core/ctx.js").then(m => { window.__visits = 0; m.on("stat", e => { if (e && e.id === "townVisits") window.__visits++; }); })`);
      const n0 = (await evs()).length;
      const ok = await g(`ctx.town.warp({ town: "midwood", at: { x: ${sp.drive.x}, z: ${sp.drive.z}, h: ${sp.drive.h} }, quiet: true, home: true })`);
      t.check("ctx.town.warp puts her in Midwood (attached, at the home exit)", ok && await g(`ctx.town.active && ctx.town.id === "midwood" && ctx.town.attached && Math.abs(${D}.S.exitS - ${H.exitS}) < 1`));
      t.check("…on her driveway, standing still", await g(`Math.hypot(ctx.car.pos.x - ${sp.drive.x}, ctx.car.pos.z - ${sp.drive.z}) < 0.5 && ctx.car.speed < 0.1`), JSON.stringify(await g(`[ctx.car.pos.x, ctx.car.pos.z, ctx.car.speed]`)));
      const ev = (await evs()).slice(n0).find(e => e.startsWith("town:enter")) || "";
      t.check("…quietly: town:enter says quiet + home, no visit counted", /"quiet":true/.test(ev) && /"home":true/.test(ev) && await t.L(`window.__visits`) === 0, ev);
      const sp2 = await g(`ctx.town.spotOf("midwood", "luluHome", ${H.exitS})`);
      // the owner: "Lulu's house should specifically be on East 34th St between J and K" (in Midwood now: its plan is the current one)
      const JK = await g(`(() => { const P = ${D}.PL; return [P.byName["Avenue K"].c, P.byName["Avenue J"].c]; })()`);
      t.check("…on East 34th St, between Avenue K and Avenue J (the owner's address)", sp2 && sp2.street === "E 34th St" && sp2.lz > Math.min(...JK) && sp2.lz < Math.max(...JK), JSON.stringify({ street: sp2 && sp2.street, lz: sp2 && sp2.lz, JK }));
      t.check("…and the lot's spot is the same once the town stands", sp2 && sp2.built && Math.hypot(sp2.door.x - sp.door.x, sp2.door.z - sp.door.z) < 0.01, JSON.stringify([sp.door, sp2 && sp2.door]));
      // a second warp while in town (to the same place): she leaves the town she's in without a cut, then is put down again
      t.check("warp again from inside the town works", await g(`ctx.town.warp({ town: "midwood", at: { x: ${sp.drive.x}, z: ${sp.drive.z}, h: ${sp.drive.h} }, quiet: true }) && ctx.town.active`));
      await t.frames(30);
      t.check("…the road under her is the town's (s/d sane)", await g(`ctx.world.road.town === true && Math.abs(ctx.car.d) < 60`), String(await g(`[ctx.car.s, ctx.car.d]`)));
      await g(`(ctx.town.leave("reset"), true)`);
    });

    await step("exit", async () => {
      // ── 2. the Midwood exit: signs, the gantry, the ramp → town:enter ──
      await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(120), true)`);
      const E = await g(`ctx.town.debug.exitAhead(560, "midwood")`);
      t.check("a Midwood exit can be planned right ahead", typeof E === "number", String(E));
      await g(`(() => { const r = ctx.world.road, s = ${E} - 380, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.vx = Math.sin(p.h) * 2; ctx.car.vz = Math.cos(p.h) * 2; return true; })()`);
      await t.frames(20);
      await t.shot("exit-gantry");
      // (down the ramp, through the T and out the cross road: Midwood stands right there — attached, no fade)
      await g(`(() => { const r = ctx.world.road, E = ${E}, pts = ctx.town.debug.rampRoute(E, 0).concat([[172.2, 48], [172.2, 70], [172.2, 110], [172.2, 160]]).map(([u, d]) => { const p = r.point(E + u, d, {}); return { x: p.x, z: p.z }; });
          window.__route = { pts, v: 11, r: 6 }; return true; })()`);
      await t.until(`__lulu3d.ctx.car.s > ${E} - 120`, "she drives down to the exit", 40000);
      if (!await t.until(`__lulu3d.ctx.town.active`, "steering onto the MIDWOOD off-ramp takes her into town", 60000)) return;
      await g(`(window.__route = null, true)`);
      t.check("town:enter fired for Midwood", (await evs()).some(e => e.startsWith("town:enter") && /midwood/.test(e)));
      t.check("in Midwood: world.road is the TownRoad, still 'playing'", await g(`ctx.town.id === "midwood" && ctx.world.road.town === true && L3.state === "playing"`));
      t.check("…attached: she drove in off the cross road (Avenue P runs on from it)", await g(`ctx.town.attached && ctx.town.street === "Avenue P"`), await g(`ctx.town.street`));
      t.check("the trip bar is a street chip (Avenue P · MIDWOOD)", await t.L(`/(Avenue P|Ocean Pkwy) · MIDWOOD/.test(document.getElementById("tripLabel").textContent)`), await t.L(`document.getElementById("tripLabel").textContent`));
      t.check("every sign fits the one atlas (readable scale)", await g(`${D}.S.T.signs.scale >= 0.5 && ${D}.S.T.signs.cells.length > 40`), String(await g(`[${D}.S.T.signs.scale.toFixed(2), ${D}.S.T.signs.cells.length]`)));
      await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
      await t.frames(20);
      await t.shot("welcome");
      t.check("drivers are out (car services, minivans, the city bus, the sweeper, the patrol)", await g(`(() => { const k = ${D}.C.cars.map(c => c.kind); return k.length >= 8 && k.includes("town_carsvc") && k.includes("town_citybus") && k.includes("town_sweeper") && k.includes("cop"); })()`), String(await g(`${D}.C.cars.map(c => c.kind).join(",")`)));
      // (the rest of this test drives the stand-alone Midwood — the same engine, unturned — left by Ocean Pkwy South at this exit)
      await g(`(window.__route = null, ctx.town.leave("reset"), ctx.town.enter({ town: "midwood", exitS: ${E}, attach: false, speed: 0 }))`);
    });

    await step("plan", async () => {
      if (!await inMidwood()) return;
      // ── 3. the plan: real streets, a real diagonal ───────────────────────
      const P = await g(`(() => { const P = ${D}.PL; return { names: P.STREETS.map(s => s.name), kh: P.byName["Kings Hwy"].axis, khH: P.byName["Kings Hwy"].h, nodes: P.NODES.length, quads: P.BLOCKS.filter(b => b.quad).length, blocks: P.BLOCKS.length,
        oneway: P.STREETS.filter(s => s.oneway).map(s => s.name + ":" + s.oneway), op: [P.byName["Ocean Pkwy"].outer, !!P.byName["Ocean Pkwy"].boulevard], strips: P.STRIPS.length, occ: P.OCCLUDERS.length }; })()`);
      for (const n of ["Ocean Pkwy", "E 8th St", "Coney Island Ave", "E 15th St", "E 34th St", "Ocean Ave", "Avenue J", "Avenue K", "Avenue L", "Avenue M", "Kings Hwy"]) t.check(`street: ${n}`, P.names.includes(n));
      t.check("Kings Hwy is a real diagonal (not on the grid)", P.kh === "diag" && Math.abs(P.khH - Math.PI / 2) > 0.1, `${P.kh} h=${P.khH}`);
      t.check("4-sided blocks between Kings Hwy and Avenue M", P.quads === 5, `${P.quads} of ${P.blocks}`);
      t.check("one-way East streets (E 8th N, E 15th N, E 34th S)", P.oneway.join(",") === "E 8th St:1,E 15th St:1,E 34th St:-1", P.oneway.join(","));
      t.check("Ocean Pkwy is a boulevard (malls + service roads)", P.op[1] && P.op[0] > 15, String(P.op));
      t.check("the town's edges have frontage strips + occluders", P.strips >= 5 && P.occ > 20, `${P.strips} strips, ${P.occ} occluders`);
      t.check("the B/Q: an embankment with bridges, stations and a train", await g(`(() => { const T = ${D}.S.T; return T.rail && T.rail.gaps.length === 5 && T.rail.stations.length === 3 && T.trains.length >= 1; })()`), String(await g(`(() => { const T = ${D}.S.T; return T.rail ? [T.rail.gaps.length, T.rail.stations.length, T.trains.length] : "none"; })()`)));
      t.check("landmarks were built (pizza, bakery, car service, shul, school, college, bench, station, pigeons, ASP row)", await g(`["pizza", "bakery", "carsvc", "shul", "school", "college", "bench", "station", "pigeons", "asp", "jam", "welcome", "hazards"].every(k => ${D}.S.T.spots[k])`),
        String(await g(`["pizza", "bakery", "carsvc", "shul", "school", "college", "bench", "station", "pigeons", "asp", "jam", "welcome", "hazards"].filter(k => !${D}.S.T.spots[k]).join(",")`)));
    });

    await step("diagonal", async () => {
      if (!await inMidwood()) return;
      // ── 4. round the corner: north up Ocean Pkwy, onto Kings Hwy (east) ──
      await g(`${D}.place("Ocean Pkwy", -236, 1.75, 6, 1)`);
      await route([["Ocean Pkwy", -226, 1.75], ["Ocean Pkwy", -214, 1.75], ["Kings Hwy", khA(-238), 1.75], ["Kings Hwy", khA(-215), 1.75], ["Kings Hwy", khA(-170), 1.75]], 8, 3.5);
      await t.until(`__lulu3d.ctx.town.street === "Kings Hwy"`, "she turns onto Kings Hwy (the diagonal)", 30000);
      t.check("…heading along it (77° — not east, not north)", await g(`Math.abs(ctx.car.h - ${D}.PL.byName["Kings Hwy"].h) < 0.3`), String(await g(`ctx.car.h.toFixed(2)`)));
      t.check("…and her d is measured across the diagonal", await g(`Math.abs(ctx.car.d) < 6`), String(await g(`ctx.car.d.toFixed(2)`)));
      await t.frames(30);
      await t.shot("kings-hwy");
      await g(`(window.__route = null, true)`);
    });

    await step("oneway", async () => {
      if (!await inMidwood()) return;
      // ── 5. the drivers keep to the one-ways; she doesn't ──────────────────
      await t.frames(120);
      const wrong = await g(`(() => { const P = ${D}.PL; return ${D}.C.cars.filter(c => { const T = c.data.town; if (!T || T.hazard || T.mode !== "drive") return false; const st = P.STREETS[T.street]; return st.oneway && T.dir !== st.oneway; }).length; })()`);
      t.check("no town driver goes the wrong way down a one-way", wrong === 0, `${wrong} wrong-way`);
      await g(`(ctx.law.hold(60), ${D}.place("E 34th St", -40, -1.75, 10, 1))`);      // E 34th runs SOUTH: she heads north
      await route([["E 34th St", 0, -1.75], ["E 34th St", 30, -1.75]], 10, 3);
      t.check("wrong way down E 34th: the block notices (town:oneway)", await t.until(`window.__ev.some(e => e.startsWith("town:oneway"))`, "town:oneway", 15000));
      await g(`(window.__route = null, ctx.law.clearHeat ? ctx.law.clearHeat("test") : null, true)`);
    });

    await step("train", async () => {
      if (!await inMidwood()) return;
      // ── 6. the B/Q: a Q comes in to Avenue M and stops ──────────────────
      await g(`${D}.place("Avenue M", 8, 1.75, 0, 1)`);
      const zm = await g(`${D}.S.T.rail.stations.find(s => s.name === "AVENUE M").zc`);
      await g(`(() => { const tr = ${D}.S.T.trains.find(t => t.cfg.local); tr.state = "run"; tr.served = new Set(); tr.z = ${zm} - 70 * tr.cfg.dir; tr.v = 9; tr.obj.visible = true; window.__tr = tr; return true; })()`);
      t.check("the Q pulls into Avenue M and stops (dwell)", await t.until(`window.__tr.state === "dwell"`, "Q dwells at Ave M", 20000));
      t.check("…at the platform", await g(`Math.abs(window.__tr.z - ${zm}) < 1`), String(await g(`window.__tr.z.toFixed(1)`)));
      await t.shot("bq-station");
      t.check("…then it leaves", await t.until(`window.__tr.state === "run" && window.__tr.v > 2`, "Q departs", 20000));
      t.check("Lulu noticed the train (town:train)", (await evs()).some(e => e.startsWith("town:train")));
    });

    await step("foot", async () => {
      if (!await inMidwood()) return;
      // ── 7. on foot: the car-service guy, the bubby, a double-parked minivan ──
      await g(`(ctx.law.hold(200), true)`);
      await g(`(() => { const c = ${D}.C.hazards[0]; ctx.car.place(c.x - Math.sin(c.h) * 14, c.z - Math.cos(c.h) * 14, c.h); ctx.car.s = ctx.world.road.nearest(ctx.car.pos.x, ctx.car.pos.z, c.s, {}).s; return true; })()`);
      await t.frames(4);
      await g(`ctx.foot.start("droveOff")`);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "she's out on foot in Midwood", 30000)) return;
      for (const who of ["driver", "bubby"]) {
        const ok = await g(`(() => { const r = ${D}.LIFE.people.find(p => p.id === "${who}"); if (!r) return false; const F = ctx.foot.debug.F, o = r.p.obj.position; F.pos.set(o.x + Math.sin(r.face) * 1.5, 0, o.z + Math.cos(r.face) * 1.5); return true; })()`);
        t.check(`the ${who} is in town`, ok);
        if (!ok) continue;
        await t.frames(5);
        await t.tap(0);
        await t.frames(8);
        t.check(`talking to the ${who} (town:talk)`, (await evs()).some(e => e.startsWith("town:talk") && e.includes(`"${who}"`)));
        if (who === "bubby") t.check("the bubby: 'You came from LAKEWOOD? Sorry for your loss.'", (await evs()).some(e => e.startsWith("town:talk") && /LAKEWOOD/.test(e)));
        await t.shot(`talk-${who}`);
        await t.frames(70);
      }
      t.check("the bubby sits on her Ocean Pkwy bench", await g(`!!${D}.LIFE.people.find(p => p.id === "bubby" && p.sit)`));
      await g(`(() => { const c = ${D}.C.hazards[0], F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }, f = { x: Math.sin(c.h), z: Math.cos(c.h) };
          F.pos.set(c.x + l.x * 1.6 + f.x * 0.6, 0, c.z + l.z * 1.6 + f.z * 0.6); return true; })()`);
      await t.frames(5);
      t.check("next to a double-parked minivan: ✕ JACK", await t.L(`/JACK/.test((document.querySelector("#slot-bottom .prompt") || {}).textContent || "")`), await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`));
      await t.tap(0);
      t.check("✕ starts the carjack", await g(`ctx.streets.jacking`));
      if (await t.until(`__lulu3d.state === "playing"`, "…and she drives off in it", 30000)) {
        t.check("she's driving a Midwood minivan (still in town)", await g(`ctx.streets.ride && ctx.streets.ride.kind === "town_van" && ctx.town.active && ctx.town.id === "midwood"`));
        t.check("the group chat heard about it (town:gossip)", await t.until(`window.__ev.some(e => e.startsWith("town:gossip"))`, "gossip", 15000));
      }
    });

    await step("hiding spots", async () => {
      if (!await inMidwood()) return;
      // ── 7b. where she can hide from a search in Midwood (ctx.town.hideSpot; law adds the line of sight) ──
      await g(`(ctx.traffic.clear(), true)`);
      const P = `${D}.PL`, at = (name, a, d) => `(() => { const p = ${D}.pt(${JSON.stringify(name)}, ${a}, ${d}); return ctx.town.hideSpot(${P}.ORIGIN.x + p.x, ${P}.ORIGIN.z + p.z); })()`;
      const kerbStreets = await g(`${P}.STREETS.filter(st => { const lanes = st.boulevard ? [st.svcPark] : st.parkLane ? [st.park] : [];
          for (let a = st.cross[0].a + 12; a < st.cross[st.cross.length - 1].a - 12; a += 3) for (const sd of [-1, 1]) for (const pd of lanes) {
            const p = ${D}.pt(st.name, a, sd * pd), h = ctx.town.hideSpot(${P}.ORIGIN.x + p.x, ${P}.ORIGIN.z + p.z); if (h.ok && h.spot === "kerb") return true; }
          return false; }).map(st => st.name)`);
      t.check("every Midwood street has kerb hiding spots among its parked cars (Ocean Pkwy: the service roads)", kerbStreets.length === await g(`${P}.STREETS.length`), kerbStreets.join(", "));
      t.check("…a travel lane is never one (Coney Island Ave's 2 lanes, Ocean Pkwy's main road + service lane)", await g(`[${at("Coney Island Ave", 100, 1.75)}, ${at("Coney Island Ave", 100, -5.25)}, ${at("Ocean Pkwy", 100, 5.25)}, ${at("Ocean Pkwy", 100, -15.1)}].every(h => !h.ok)`));
      t.check("…Ocean Pkwy's tree mall is", await g(`(${at("Ocean Pkwy", 100, 10)}).spot === "mall"`));
      t.check("…E 8th's swept side (alternate-side parking) is an EMPTY kerb — not a hiding spot", await g(`(${at("E 8th St", 100, 4.6)}).why === "empty"`), JSON.stringify(await g(at("E 8th St", 100, 4.6))));
    });

    await step("cops", async () => {
      if (!await inMidwood()) return;
      // ── 8. cops in Midwood: blocks hide her, the cruiser routes round them ──
      await g(`${D}.place("Avenue L", -120, 1.75, 0, 1)`);
      t.check("a block hides Avenue K from Avenue L", await g(`(() => { const o = ${D}.PL.ORIGIN; return ctx.town.blocksSight(o.x - 120, o.z + 145, o.x - 120, o.z + 46.75); })()`));
      t.check("…but not down the same street", await g(`(() => { const o = ${D}.PL.ORIGIN; return !ctx.town.blocksSight(o.x - 200, o.z + 46.75, o.x - 100, o.z + 46.75); })()`));
      await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("DOUBLE PARKING (TRIPLE, ACTUALLY)", { heat: 1 }))`);
      await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.mode === "chase" && u.car)`, "a cruiser joins the chase in Midwood", 10000);
      t.check("the cruiser spawned on a Midwood street", await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.car); return !!u && u.car.s > 499000; })()`));
      const gap = await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.car); const r = ctx.town.copRoute(u.car); return r ? Math.round(r.gap) : -1; })()`);
      t.check("copRoute: a path through the grid", gap > 0, `${gap} m`);
      await t.frames(60);
      await t.shot("cops");
      await g(`(ctx.law.clearHeat ? ctx.law.clearHeat("test") : null, true)`);
      await t.frames(10);
    });

    await step("perf", async () => {
      if (!await inMidwood()) return;
      // ── 9. perf in Midwood (down Avenue J, the busiest strip) + the screenshots ──
      await g(`(ctx.law.hold(300), ${D}.place("Avenue J", 150, -1.75, 6, -1))`);
      await route([["Avenue J", 100, -1.75], ["Avenue J", 40, -1.75], ["Avenue J", -40, -1.75], ["Avenue J", -160, -1.75]], 10, 4);
      await t.frames(40);
      const town = await perf(150);
      console.log("   PERF midwood", JSON.stringify(town));
      console.log("   PERF midwood static", JSON.stringify(await g(`(() => { const T = ${D}.S.T; const by = {}; T.root.traverse(o => { if (o.isMesh && o.userData.townLook) { const k = o.userData.townLook; by[k] = (by[k] || 0) + o.geometry.index.count / 3; } }); return { tris: Math.round(T.tris), meshes: T.merged, colliders: T.colliders.length, signs: T.signs.cells.length, by }; })()`)));
      // (the highway's chunks are merged now — merge.js: ~35 % fewer calls than when this was written — so the yardstick
      //  moved, not Midwood: the light Cruise's budget from then, 240 + 10 %, or today's, whichever is higher)
      t.check("Midwood draw calls ≤ busy Cruise (+10%; ≤ 264, the light Cruise before merged chunks)", town.calls <= Math.max(busy.calls * 1.1, 264), `${town.calls} vs ${busy.calls}`);
      t.check("Midwood triangles within a busy Cruise's budget (≤ 120k)", town.tris <= 120000, `${town.tris} (this test's light Cruise: ${busy.tris})`);
      await g(`(window.__route = null, true)`);
      const views = [
        ["avenue-j", `${D}.place("Avenue J", -10, -1.75, 0, -1)`, 20],
        ["ocean-pkwy", `${D}.place("Ocean Pkwy", -150, 1.75, 0, 1)`, 20],
        ["ocean-pkwy-mall", `${D}.place("Ocean Pkwy", -120, -15.2, 0, 1)`, 20],
        ["avenue-m-underpass", `${D}.place("Avenue M", 12, 1.75, 0, 1)`, 20],
        ["kings-hwy-jam", `${D}.place("Kings Hwy", ${khA(-150)}, 1.75, 0, 1)`, 20],
        ["alternate-side", `${D}.place("E 8th St", 80, 1.75, 0, 1)`, 20],
        ["college", `${D}.place("E 34th St", 212, 1.75, 0, 1)`, 25],
        ["coney-island-ave", `${D}.place("Coney Island Ave", 0, 5.25, 0, 1)`, 20],
        ["ocean-ave", `${D}.place("Ocean Ave", 60, -1.75, 0, -1)`, 20],
      ];
      for (const [label, code, n] of views) { await g(code); await t.frames(n); await t.shot(label); }
      await g(`ctx.atmos.debug.time("night")`);
      await g(`${D}.place("Avenue J", -10, -1.75, 0, -1)`);
      await t.frames(40);
      await t.shot("night");
      t.check("night: windows, lamps and the skyline glow", await g(`${D}.S.T.mats.glow.emissiveIntensity > 0.5 && ${D}.S.T.halos.visible`));
      await g(`ctx.atmos.debug.time("noon")`);
      for (const [label, w, h] of [["tv", 1920, 1080], ["phone-portrait", 390, 844], ["phone-landscape", 844, 390]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await g(`${D}.place("Avenue J", -10, -1.75, 0, -1)`);
        await t.frames(20);
        await t.shot(label);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
    });

    await step("cars-parked", async () => {
      if (!await inMidwood()) return;
      // ── every live car in Midwood is visible in the scene; the parked cars are solid and hotwirable ──
      await g(`(ctx.law.hold(300), ${D}.place("Avenue J", 120, 1.75, 0, 1), true)`);

      // (behind a town driver, 25 m back down its street, so there IS a car in sight to judge)
      await g(`(() => { const c = ${D}.C.cars.find(c => !c.free && c.data.town.mode === "drive" && c.kind !== "cop"); if (!c) return false; ctx.traffic.config.enabled = false;
          const f = { x: Math.sin(c.h), z: Math.cos(c.h) }; ctx.car.place(c.x - f.x * 25, c.z - f.z * 25, c.h); ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; ctx.car.s = c.s - 25 * c.dir; ctx.cam.snap(); return true; })()`);
      await t.frames(12);
      const a = await g(`(() => {
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
            if (bs.radius > 0.02 && bs.radius < 14 && Math.hypot(bs.center.x - c.x, bs.center.z - c.z) < 9) ok++; });
          if (!shown(c.obj) || !meshes || ok < meshes * 0.8) bad.push([c.kind, Math.round(dist), shown(c.obj), meshes, ok].join(":"));
        }
        return { near, bad };
      })()`);
      t.check("Midwood: every car in sight (≤ 100 m) is in the scene, visible, with sane bounding spheres", a.near > 0 && !a.bad.length, JSON.stringify(a));
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
      t.check("Midwood's parked cars are solid + tagged (sedans and minivans)", await g(`(() => { const P = ${D}.S.T.pcars; return P.length > 100 && P.some(p => /sedan/.test(p.key)) && P.every(p => p.cols.length === 2 && p.tag.parts && p.tag.parts.length); })()`));
      // on foot by a parked car-service sedan: ✋ HOTWIRE, and she drives off in a sedan
      await g(`ctx.foot.start("droveOff")`);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot (Midwood parked)", 30000)) return;
      const ok = await g(`(() => { const T = ${D}.S.T, O = ${D}.PL.ORIGIN, F = ctx.foot.debug.F; let best = null, bd = 1e9;
          for (const p of T.pcars) { if (p.gone || p.live || !/sedan/.test(p.key)) continue; const d = Math.hypot(O.x + p.x - F.pos.x, O.z + p.z - F.pos.z); if (d < bd) { bd = d; best = p; } }
          if (!best) return false; window.__fp = best; F.pos.set(O.x + best.x + Math.cos(best.rot) * 1.7, 0, O.z + best.z - Math.sin(best.rot) * 1.7); return true; })()`);
      if (!ok) { t.check("a parked sedan to hotwire", false); return; }
      await t.frames(12);
      const prompt = await t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
      t.check("next to a parked sedan: ✋ HOTWIRE CAR", /HOTWIRE/.test(prompt), prompt);
      await g(`(ctx.foot.force.hotwire = true, true)`);
      await t.tap(0);
      for (let i = 0; i < 6 && await g(`ctx.foot.active`); i++) { await t.frames(12); await t.tap(0); }
      await t.until(`__lulu3d.state === "playing"`, "…she drives off in it (Midwood)", 20000);
      t.check("she drives off in the hotwired sedan; it's gone from the kerb", await g(`ctx.foot.vehicle && ctx.foot.vehicle.kind === "sedan" && window.__fp.gone && ctx.town.id === "midwood"`), JSON.stringify(await g(`[ctx.foot.vehicle, window.__fp.gone]`)));
      await g(`(ctx.foot.force.hotwire = undefined, ctx.foot.dropRide(), true)`);
    });

    await step("onramp", async () => {
      if (!await inMidwood()) return;
      const E = await g(`${D}.S.exitS`);
      // ── 10. Ocean Pkwy South → the highway, just past the exit ──────────
      await g(`${D}.place("Ocean Pkwy", -290, -1.75, 12, -1)`);
      await route([["Ocean Pkwy", -310, -1.75], ["Ocean Pkwy", -328, -1.75]], 12, 3);
      if (await t.until(`!__lulu3d.ctx.town.active`, "driving south down Ocean Pkwy takes the on-ramp", 30000)) {
        t.check("town:leave fired (Midwood, why: highway)", (await evs()).some(e => e.startsWith("town:leave") && /midwood/.test(e) && /highway/.test(e)));
        t.check("back on the highway: on the interchange's on-ramp", await g(`ctx.world.road.town !== true && ctx.car.s > ${E} + 180 && ctx.car.s < ${E} + 300 && ctx.car.d > 9`), String(await g(`[Math.round(ctx.car.s - ${E}), ctx.car.d.toFixed(1)]`)));
        t.check("Midwood's scene is disposed (and the trains with it) — only towns standing at an interchange are left", await g(`!ctx.scene.children.some(o => /^Town:/.test(o.name) && !ctx.town.debug.S.built.some(b => b.T && b.T.root === o))`));
        await g(`(window.__route = null, true)`);
        await t.until(`!__lulu3d.ctx.town.transitioning`, "the fade clears", 10000);
      }
      // ── 11. …and Lakewood still works after Midwood ──────────────────────
      await g(`(ctx.town.load("lakewood"), true)`);
      await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 60000);
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      t.check("Lakewood after Midwood: its own streets, blocks and circle", await g(`ctx.town.id === "lakewood" && ctx.town.streets.includes("Route 9") && ${D}.PL.BLOCKS.length === 16 && !!${D}.PL.circle && !${D}.S.T.rail`));
      await t.frames(10);
      await t.shot("lakewood-after");
      await g(`ctx.town.leave("quiet")`);
    });

    await step("mash", async () => {
      if (!await inMidwood()) return;
      // ── 12. a random mash in Midwood ─────────────────────────────────────
      await g(`${D}.place("Avenue K", -100, 1.75, 0, 1)`);
      for (let i = 0; i < 70; i++) {
        const b = [0, 1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15][Math.floor(Math.random() * 12)];
        await t.stick(Math.random() * 2 - 1, Math.random() * 2 - 1);
        await t.hold(7, Math.random() < 0.6 ? 1 : 0);
        await t.tap(b);
        if (await g(`ctx.paused`)) await t.tap(9);
      }
      await t.stick(0, 0); await t.hold(7, 0);
      await t.frames(10);
      t.check("still alive after the mash", await g(`!!L3.state`), await g(`L3.state`));
      if (await g(`ctx.paused`)) await t.tap(9);
      await g(`L3.setState("title")`);
      await t.frames(5);
      t.check("the title tears Midwood down", await g(`!ctx.town.active && !ctx.world.district`));
    });
  },
};
