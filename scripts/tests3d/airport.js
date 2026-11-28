// ✈️ The airport exit — JFK, stage 1 (features/airport): the exit and the kerb.
//   • it plans from FIXED data only (no Math.random, the same metre every run / for every friend), clear of the
//     journey's stops + the coast, signed ahead (✈ JFK · 1 MI · ½ MI · LAST EXIT, the EXIT 12 tab)
//   • nothing it builds stands on a lane (world.offLanes / pavedAt — props, boards, colliders, parked cars)
//   • DRIVEN in from the highway with no cut and no teleport (≤ 0.5 m a frame; the QA watchdog on): the decel lane (its
//     cue), the ramp, the road in, the loop up to the DEPARTURES kerb — paved lanes all the way, the landside "inside"
//   • the kerb: taxis + shuttles going round, stopping; out of the car and WALKING on the landside (grounds, no world
//     fence), the terminal's doors (✋ opening soon), the RUNWAY FENCE (she can't get past it; pushing it = the joke:
//     Officer Segal on his Segway)
//   • planes: in the sky, in view, a shadow on the ground under a low one
//   • back in the car and OUT: round the loop, down the east leg, the road out, the on-ramp, the accel lane → the
//     highway's right lane (no cut)
//   • the perf budget (the busiest airport view on MEDIUM + LOW; the build's worst slice)
const W = require("../lib/qawatch.js");

// the budget (also in AGENTS.md §7 › Airport): the kerb's busiest view at 1280×720 — the towns' numbers
const BUDGET = { calls: 240, tris: 120000, buildWorstMs: 60, buildTris: 70000, lowCut: 7000, lowLess: 6000 };

module.exports = {
  name: "airport",
  fast: false,     // (it measures draws / pictures per frame: the old clock — scripts/smoke3d.js › THE FAST TEST CLOCK)
  viewport: { width: 1280, height: 720 },
  query: "&enable=airport,foot,atmos",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const g = t.game;
    // AIRPORT_PART=<step>[,<step>…] runs just those steps after the build (local debugging: "bump", "chase", "perf",
    // "kerb bust", "kerb shove"…)
    const PART = process.env.AIRPORT_PART || "";
    const step = async (label, fn) => { if (PART && !PART.split(",").includes(label)) return; try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["airport:enter", "airport:leave", "airport:door", "airport:fence", "airport:built", "airport:bump", "airport:security", "foot:start"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 90)));
      m.on("damage", e => { const c = m.ctx.car.pos, q = m.ctx.airport.debug.local(c.x, c.z) || {}; __ev.push("damage:" + (e && e.why) + "/" + (e && e.source) + "@" + Math.round(q.f) + "," + Math.round(q.r) + " s" + Math.round(m.ctx.car.s)); });
      // the test driver: steer toward waypoints (world x / z) at a target speed; stop = brake to a halt at the end
      m.hook("controls", (ctl, dt) => { const R = window.__route, car = m.ctx.car; if (!R) return;
        if (!R.pts.length) { if (R.stop) { ctl.steer = 0; ctl.throttle = 0; ctl.brake = car.vF > 0.3 ? 1 : 0; ctl.handbrake = car.vF <= 0.3; } return; }
        let p0 = R.pts[0]; while (R.pts.length > 1 && Math.hypot(p0.x - car.pos.x, p0.z - car.pos.z) < (R.r || 5)) { R.pts.shift(); p0 = R.pts[0]; }
        if (R.pts.length === 1 && Math.hypot(p0.x - car.pos.x, p0.z - car.pos.z) < 3) { R.pts.shift(); return; }
        const want = Math.atan2(p0.x - car.pos.x, p0.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
        const v = R.pts.length <= 3 && R.stop ? Math.min(R.v, 5) : R.v;
        ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < v ? 0.7 : 0; ctl.brake = car.speed > v + 2 ? 0.6 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000);
      // the biggest one-frame step of the car / Lulu / the camera (a cut or a teleport shows up here)
      window.__steps = { car: 0, foot: 0, cam: 0, on: false };
      let last = null;
      m.hook("update", () => { const S = window.__steps; if (!S.on) { last = null; return; } const c = (m.ctx.foot && m.ctx.foot.active && m.ctx.foot.pos) || m.ctx.car.pos, cam = m.ctx.camera.position;
        if (last) { S.car = Math.max(S.car, Math.hypot(c.x - last.x, c.z - last.z)); S.cam = Math.max(S.cam, Math.hypot(cam.x - last.cx, cam.y - last.cy, cam.z - last.cz)); }
        last = { x: c.x, z: c.z, cx: cam.x, cy: cam.y, cz: cam.z }; }, -1000);
      window.__m = m; })`);
    const evs = () => t.L(`window.__ev.slice()`);
    const route = (pts, v, opts = {}) => g(`(window.__route = { pts: ${JSON.stringify(pts)}, v: ${v}, r: ${opts.r || 5}, stop: ${!!opts.stop} }, true)`);
    const noRoute = () => g(`(window.__route = null, true)`);
    const steps = (on) => t.L(`(() => { const S = window.__steps; const r = { car: +S.car.toFixed(2), cam: +S.cam.toFixed(2) }; S.car = S.cam = 0; S.on = ${on}; return r; })()`);
    const perf = async (frames) => {
      // the main pass (renderer.info, as before) + the sun's shadow pass too (three resets renderer.info AFTER the shadow
      // map is drawn, so it never shows it: here the counter is reset by hand before each render, read after the shadows)
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r), sm = r.shadowMap, so = sm.render.bind(sm); window.__pfWrap = true;
          sm.render = function () { const out = so.apply(null, arguments); const P = window.__pf; if (P) { P.shC = r.info.render.calls; P.shT = r.info.render.triangles; } return out; };
          r.render = (s, c) => { const t0 = performance.now(), P0 = window.__pf; if (P0) { r.info.autoReset = false; r.info.reset(); P0.shC = 0; P0.shT = 0; }
            try { o(s, c); } finally { r.info.autoReset = true; }
            const P = window.__pf; if (!P) return; const all = r.info.render.calls, main = all - P.shC, tri = r.info.render.triangles - P.shT;
            P.n++; P.ms += performance.now() - t0; P.all += all; P.maxAll = Math.max(P.maxAll, all); P.calls += main; P.maxCalls = Math.max(P.maxCalls, main); P.tris += tri; P.maxTris = Math.max(P.maxTris, tri); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, all: 0, maxAll: 0, tris: 0, maxCalls: 0, maxTris: 0, shC: 0, shT: 0, w0: performance.now() }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), frameMs: +((performance.now() - P.w0) / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, withShadows: Math.round(P.all / P.n), maxWithShadows: P.maxAll, tris: Math.round(P.tris / P.n), maxTris: P.maxTris }; })()`);
    };
    const setTier = q => t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = "${q}"; __lulu3d.ctx.applySettings(); return __lulu3d.ctx.gfx.tier; })`);
    const prompt = () => t.L(`(document.querySelector("#slot-bottom .prompt") || document.querySelector(".prompt") || {}).textContent || ""`);
    // a world point of the airport frame (f, r) / a highway point
    const A = (f, r) => g(`ctx.airport.debug.world(${f}, ${r})`);
    const HW = (s, d) => g(`(() => { const p = ctx.world.highway.point(${s}, ${d}, {}); return { x: p.x, z: p.z }; })()`);
    // put her car somewhere (a declared teleport: the watchdog segment restarts after it)
    const placeCar = async (x, z, h, v = 0) => {
      await g(`(() => { const n = ctx.world.highway.nearest(${x}, ${z}, ctx.car.s, {}); ctx.car.place(${x}, ${z}, ${h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = Math.sin(${h}) * ${v}; ctx.car.vz = Math.cos(${h}) * ${v}; ctx.car.vF = ${v}; ctx.world.prebuild(n.s); ctx.cam.snap(); return true; })()`);
      await t.frames(3);
      await W.reset(t);
    };

    t.check("ctx.airport is registered and ON with ?enable=airport", await g(`!!(ctx.airport && ctx.airport.on && ctx.airport.debug && ctx.airport.debug.placeAt)`));
    t.check("…switched on: its zones are live (the towns' exits keep out of them — so it's on in a 🌍 Free Roam too: every friend plans the same metre)", await g(`ctx.airport.zones(0, 60000).length > 0`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await W.install(t);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    if (!await t.until(`!!__lulu3d.ctx.airport.planned`, "a Cruise run plans the airport (fixed data)", 60000)) return;
    const E = await g(`ctx.airport.planned.s`);
    const AIR = await g(`ctx.airport.debug.AIR`), LY = await g(`(() => { const L = ctx.airport.debug.LY; return { TAPER0: L.TAPER0, RAMP0: L.RAMP0, OFF1: L.OFF1, ON0: L.ON0, ON1: L.ON1, ACC1: L.ACC1, UA: L.UA, KERB_R: L.KERB_R, KERB_LANE: L.KERB_LANE, LAND: L.LAND, TERM: L.TERM, DOORS: L.DOORS }; })()`);
    console.log("   airport exit at s =", E);

    await step("placement", async () => {
      t.check(`it's further out than the first town exits (s ≥ ${AIR.first})`, E >= AIR.first, String(E));
      t.check("clear of the journey's stops + the coast's ocean (its whole footprint)", await g(`(() => { const J = ctx.journey, E = ${E}, a = E - 600, b = E + 1030; for (let i = 0; i < 5; i++) { const s = J.stopS(i); if (s + 600 > a && s - 1100 < b) return false; } return !(b > J.stopS(1) - 400 && a < J.stopS(2) + 1100); })()`));
      // fixed data: recomputed with Math.random poisoned → the same metre + the same terminal position
      const again = await g(`(() => { const R = Math.random; let E2, F; Math.random = () => { throw new Error("Math.random in the airport's placement"); };
        try { E2 = ctx.airport.debug.findSpot(${AIR.first}); F = ctx.airport.debug.frame(E2); } finally { Math.random = R; }
        const T = ctx.airport.debug.world(0, 203); const T2 = F.world(0, 203, {}); return { E2, dx: Math.hypot(T.x - T2.x, T.z - T2.z) }; })()`);
      t.check("placement is a pure function of fixed data (no Math.random; the same metre recomputed — every friend's screen)", again.E2 === E && again.dx < 0.01, JSON.stringify(again));
      t.check("the world seed is the constant highway (the same road for everyone)", await g(`ctx.world.seed === 20261104`));
      const signs = await g(`ctx.world.signs.filter(s => /JFK|LAST EXIT/.test(s.lines.join(" "))).map(s => ({ u: Math.round(s.s - ${E}), lines: s.lines.join(" · "), tab: s.tab || null }))`);
      t.check("signed ahead: ✈ JFK AIRPORT · 1 MI, ½ MI, LAST EXIT (the EXIT 12 tab)", signs.some(s => /1 MI/.test(s.lines) && s.tab === "EXIT 12") && signs.some(s => /½ MI/.test(s.lines)) && signs.some(s => /LAST EXIT/.test(s.lines)), JSON.stringify(signs));
      t.check("its roadside is reserved (no trees / houses on the ramps or in the airport)", await g(`ctx.world.isReserved(${E} + 330, 150) && ctx.world.isReserved(${E} + 20, 20)`));
      // the switch-on model (ci/airport-polish; switched on after ci/exits2): the towns keep out of it, and the airport's
      // metres come from fixed data only (zones)
      const z = await g(`(() => { const R = Math.random; let zs;
        Math.random = () => { throw new Error("Math.random in zones()"); }; try { zs = ctx.airport.zones(0, 30000).map(o => [o.s, Math.round(o.a), Math.round(o.b)]); } finally { Math.random = R; } return { zs }; })()`);
      t.check("switched on: ctx.airport.zones() are the airport's own metres from fixed data (the first = this run's)", z.zs.length >= 1 && z.zs[0][0] === E, JSON.stringify(z));
      t.check("…and no town exit stands in a zone", await g(`(() => { const z = ctx.airport.zones(0, 40000), A = ctx.town.span.a, B = ctx.town.span.b; ctx.town.exitOf("lakewood", 30000); return !ctx.town.exits.some(e => z.some(q => e.s + A < q.b && e.s + B > q.a)); })()`), JSON.stringify(await g(`ctx.town.exits.map(e => e.town + "@" + Math.round(e.s))`)));
    });

    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law && ctx.law.hold && ctx.law.hold(900), true)`);
    // up the road to just before its signs; it builds itself in slices from 2.6 km out
    const p0 = await HW(E - 560, 5.25);
    await placeCar(p0.x, p0.z, await g(`ctx.world.highway.at(${E - 560}).h`), 0);
    if (!await t.until(`__lulu3d.ctx.airport.ready`, "the airport builds in slices", 180000)) return;
    const pf = await g(`ctx.airport.debug.perf()`);
    console.log("   PERF airport build", JSON.stringify(pf));
    t.check(`the build: small slices (95 % ≤ 10 ms on a CI runner — software GL; worst ${pf.worst} ms ≤ ${BUDGET.buildWorstMs}: ${pf.worstStep}; ${pf.steps} steps)`, pf.p95 <= 10 && pf.worst <= BUDGET.buildWorstMs, JSON.stringify(pf));
    t.check(`the build: ≤ ${BUDGET.buildTris / 1000}k triangles, ≤ 60 meshes`, pf.tris <= BUDGET.buildTris && pf.meshes <= 60, JSON.stringify(pf));

    await step("lanes", async () => {
      // nothing stands on a lane: colliders (props, posts, the fence, parked cars, rails), every prop + board
      const bad = await t.L(`import("./js/world.js").then(w => { const ctx = __lulu3d.ctx, G = ctx.airport.debug.G(), hw = ctx.world.highway, out = [];
        const test = (x, z, r, what, hint) => { const n = hw.nearest(x, z, hint, {}); if (!w.offLanes(n.s, n.d, Math.max(0.3, r * 0.7), Math.max(0.3, r * 0.7))) out.push(what + "@" + Math.round(n.s - G.E) + "," + n.d.toFixed(1)); };
        for (const c of G.col) test(c.x, c.z, c.r, c.kind, c.s);
        return { n: G.col.length, bad: out.slice(0, 12), nBad: out.length }; })`);
      t.check(`nothing it builds stands on a lane (${bad.n} colliders: offLanes)`, bad.nBad === 0, JSON.stringify(bad));
      // the route in is all lanes (paved 3): highway decel lane → ramp → the road in → the loop
      const paved = await t.L(`import("./js/world.js").then(w => { const ctx = __lulu3d.ctx, G = ctx.airport.debug.G(), hw = ctx.world.highway, R = ctx.airport.debug.roads(), miss = [];
        for (const id of ["in", "loop", "out"]) for (let i = 0; i < R[id].length; i += 5) { const p = R[id][i]; let n = null, best = 1e9; for (let h = -100; h <= 900; h += 100) { const q = hw.nearest(p.x, p.z, G.E + h, {}), b = hw.point(q.s, q.d, {}), e = Math.hypot(b.x - p.x, b.z - p.z); if (e < best) { best = e; n = q; } } if (w.pavedAt(n.s, n.d) < 3) miss.push(id + i); }
        for (let u = -220; u <= 60; u += 10) { const L = ctx.airport.debug.LY; const d = u < L.RAMP0 ? (6.9 + L.taperEdge(u)) / 2 : L.offD(u); if (w.pavedAt(G.E + u, d) < 3) miss.push("ramp" + u); }
        return miss; })`);
      t.check("the whole way in + round + out is a LANE (core's paved 3: the car drives it like road)", paved.length === 0, paved.slice(0, 10).join(" "));
      t.check("the landside (lot, sidewalks, lawns) is paved ground (2)", await t.L(`import("./js/world.js").then(w => { const ctx = __lulu3d.ctx, hw = ctx.world.highway; return [[0, 140], [0, 199], [-160, 100], [160, 230]].every(([f, r]) => { const p = ctx.airport.debug.world(f, r), n = hw.nearest(p.x, p.z, ${E} + 330 + f, {}); return w.pavedAt(n.s, n.d) >= 2; }); })`));
    });

    // ── IN: from the right lane, down the decel lane, the ramp, the road in, up the west leg, the DEPARTURES kerb ──
    await step("drive in", async () => {
      await W.reset(t);
      const pts = [];
      for (const [u, d] of [[-480, 5.25], [-300, 5.25], [-230, 5.6], [-200, 7.5], [-170, 9.1], [-120, 9.1], [-80, 9.1]]) pts.push(await HW(E + u, d));
      for (let u = -50; u <= 60; u += 10) pts.push(await HW(E + u, await g(`ctx.airport.debug.LY.offD(${u})`)));
      const R = await g(`(() => { const R = ctx.airport.debug.roads(), F = ctx.airport.debug.G().F, out = []; for (let i = 4; i < R.in.length; i += 4) out.push({ x: R.in[i].x, z: R.in[i].z });
        for (let i = 0; i < R.loop.length; i += 3) { const p = R.loop[i], q = F.local(p.x, p.z, {}); if (q.r > 186 && q.f > -64) break; const sh = q.r > 186 ? 3.4 : 0; out.push({ x: p.x - p.tz * sh, z: p.z + p.tx * sh }); } return out; })()`);
      pts.push(...R);
      pts.push(await A(-62, LY.KERB_LANE));
      await steps(true);
      await route(pts, 11, { r: 6, stop: true });
      let sawCue = false;
      for (let i = 0; i < 400 && !sawCue; i++) { await t.frames(3); const c = await g(`ctx.airport.debug.S.cue || ""`); if (/EXIT 12/.test(c)) sawCue = true; if (await g(`ctx.car.s > ${E} + 20`)) break; }
      t.check("in the decel lane: the ✈ EXIT 12 · JFK cue (a prompt, steer left to stay on)", sawCue);
      await t.until(`__lulu3d.ctx.car.s > ${E} - 40`, "down to the gore", 60000);
      await t.shot("ramp");
      const inside = await t.until(`__lulu3d.ctx.airport.inside`, "she drives into the landside", 120000);
      t.check("…no town, no fade: still 'playing', the same scene", await g(`L3.state === "playing" && !(ctx.town && ctx.town.active) && !ctx.view`));
      t.check("airport:enter + the visit counted", inside && (await evs()).some(e => e.startsWith("airport:enter")));
      await t.until(`window.__route && window.__route.pts.length === 0 && __lulu3d.ctx.car.speed < 0.5`, "she pulls up at the DEPARTURES kerb", 120000);
      const st = await steps(false);
      t.check(`driven in with no teleport: the car ≤ 0.5 m a frame (max ${st.car}), the camera ≤ 1.5 m (max ${st.cam})`, st.car <= 0.5 && st.cam <= 1.5, JSON.stringify(st));
      const q = await g(`(() => { const p = ctx.car.pos, q = ctx.airport.debug.local(p.x, p.z); return { f: Math.round(q.f), r: +q.r.toFixed(1) }; })()`);
      t.check("…at the departures kerb (the kerb lane in front of Terminal 4½)", q.f > -90 && q.f < -30 && q.r > 188 && q.r < 196, JSON.stringify(q));
      t.check("stopped here, no 🅿️ pull-over prompt (stop = get out)", await g(`ctx.G.noPullOver === true`));
      W.check(t, "driving in (exit → ramp → road in → the kerb)", await W.report(t));
      const dmg = (await evs()).filter(e => e.startsWith("damage"));
      t.check("a clean drive in costs no heart (nothing in the way)", dmg.length === 0, dmg.join(" | "));
      await t.shot("kerb-departures");
    });

    await step("kerb", async () => {
      // the taxis + shuttles going round (instanced, their own loop) and stopping at the kerb
      await t.frames(90);
      const v = await g(`ctx.airport.debug.vehicles()`), ks = await g(`ctx.airport.debug.kerbStats()`);
      t.check("taxis + shuttle buses at the kerb (5 taxis, 2 shuttles)", v.filter(c => c.kind === "taxi").length === 5 && v.filter(c => c.kind === "shuttle").length === 2, JSON.stringify(v.map(c => c.kind)));
      t.check("…moving round the loop / waiting at their stands", v.some(c => c.speed > 1) && v.some(c => c.atStop || c.speed < 0.5), JSON.stringify(v.map(c => [c.kind, +c.speed.toFixed(1), c.atStop])));
      const tq = await g(`ctx.airport.debug.vehicles().filter(c => c.kind === "taxi").map(c => { const q = ctx.airport.debug.local(c.x, c.z); return [Math.round(q.f), Math.round(q.r)]; })`);
      t.check("the taxi line queues on the ARRIVALS kerb", tq.filter(([f, r]) => f > 0 && f < 80 && r > 190 && r < 197).length >= 2, JSON.stringify(tq));
      console.log("   kerb stats", JSON.stringify(ks));
      // stage 3's taxi runs pick up at ctx.airport.kerb.pickup(): the ARRIVALS kerb lane, clear of the taxi line
      const pk = await g(`(() => { const p = ctx.airport.kerb.pickup(), q = ctx.airport.debug.local(p.x, p.z), taxis = ctx.airport.debug.vehicles().filter(c => c.kind === "taxi" && c.speed < 0.5); return { f: Math.round(q.f), r: +q.r.toFixed(1), near: Math.min(99, ...taxis.map(c => Math.hypot(c.x - p.x, c.z - p.z))) }; })()`);
      // the chase cam's walls (ci/airport-polish): a camera swung toward the terminal stops at its glass, the other way is free
      const cc = await g(`(() => { const p = ctx.airport.debug.world(0, 193), d = ctx.airport.debug.G().F.dir(0, 1); const tgt = { x: p.x, y: 1.4, z: p.z };
        return { into: ctx.airport.camClip(tgt, d.x, 0, d.z, 20), away: ctx.airport.camClip(tgt, -d.x, 0, -d.z, 20), fn: !!(ctx.cam && ctx.cam.carClip) }; })()`);
      t.check("the chase cam keeps out of Terminal 4½ (camClip stops it at the facade, ~9.7 m; free the other way; foot's carClip asks)", cc.into != null && cc.into > 9 && cc.into < 10.2 && cc.away == null && cc.fn, JSON.stringify(cc));
      t.check("the ARRIVALS pickup point (stage 3) is in the kerb lane, clear of the taxi line", pk.f > 6 && pk.f < 40 && pk.r > 191 && pk.r < 196 && pk.near > 4, JSON.stringify(pk));
    });

    await step("walk", async () => {
      await g(`ctx.foot.start("droveOff")`);
      if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "out on foot at the kerb", 30000)) return;
      await W.reset(t);
      t.check("on the landside she's on 'grounds' (no tall grass / mud / world fence)", await g(`ctx.foot.bounds.zone === "grounds"`), await g(`ctx.foot.bounds.zone`));
      // walk toward the terminal (the stick, relative to the free camera), up onto the sidewalk
      const walkTo = async (f, r, frames = 150) => {
        const p = await A(f, r);
        for (let k = 0; k < frames; k += 6) {
          const done = await g(`(() => { const F = ctx.foot.debug.F, dx = ${p.x} - F.pos.x, dz = ${p.z} - F.pos.z, L = Math.hypot(dx, dz); if (L < 1.2) { __pad.axes[0] = 0; __pad.axes[1] = 0; return true; }
            const fy = ctx.foot.frameYaw, fx = Math.sin(fy), fz = Math.cos(fy), rx = -fz, rz = fx; const fw = (dx * fx + dz * fz) / L, rt = (dx * rx + dz * rz) / L; __pad.axes[0] = rt; __pad.axes[1] = -fw; return false; })()`);
          if (done) break;
          await t.frames(6);
        }
        await t.stick(0, 0);
      };
      const door = LY.DOORS[1];
      // (the driving `update` hook doesn't run on foot: an actor measures her steps while she walks)
      await t.L(`(() => { const m = window.__m; let last = null; m.addActor({ foot: true, update() { const S = window.__steps; if (!S.on || !m.ctx.foot.active) { last = null; return true; } const p = m.ctx.foot.pos;
        if (last) S.car = Math.max(S.car, Math.hypot(p.x - last.x, p.z - last.z)); last = { x: p.x, z: p.z }; return true; } }); return true; })()`);
      await steps(true);
      await walkTo(door, LY.TERM.r0 - 1.2, 400);
      const st = await steps(false);
      t.check(`walked across the kerb to a door with no jump (Lulu ≤ 0.5 m a frame: ${st.car})`, st.car <= 0.5, JSON.stringify(st));
      t.check("at a door: ✋ 🚪 TERMINAL 4½", /TERMINAL 4½/.test(await prompt()), await prompt());
      await t.tap(0);
      await t.frames(20);
      t.check("the doors answer (opening soon — or stage 2's hall)", (await evs()).some(e => e.startsWith("airport:door")));
      await t.shot("terminal-doors");
      W.check(t, "walking the kerb", await W.report(t));
      // stage 2's hall is in: the doors lead into it, and out again onto the same sidewalk
      if (await g(`!!(ctx.airport.terminal && ctx.airport.terminal.enter)`)) {
        t.check("…stage 2's hall: the door takes her IN (airport:door in)", (await evs()).some(e => /airport:door:.*"in":true/.test(e)), (await evs()).filter(e => /door/.test(e)).join(" "));
        const inside = await t.until(`!!(__lulu3d.ctx.airport.terminal.inside)`, "inside the terminal hall", 90000);
        if (inside) {
          await t.frames(30);
          await t.shot("terminal-inside");
          await g(`(ctx.airport.terminal.debug.room().leave(), true)`);
          await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && !__lulu3d.ctx.airport.terminal.inside`, "back out of the doors", 90000);
          await t.frames(10);
          const q = await g(`(() => { const p = ctx.foot.pos, q = ctx.airport.debug.local(p.x, p.z); return { f: Math.round(q.f), r: +q.r.toFixed(1) }; })()`);
          t.check("…and back out onto the kerb sidewalk by the door she used", q.r > 190 && q.r < 204 && Math.abs(q.f - door) < 8, JSON.stringify(q));
          await W.reset(t);
        }
      }
    });

    await step("fence", async () => {
      if (!await g(`ctx.foot.active && !ctx.view`)) return;
      // round the terminal's east end to the runway fence (walk the last bit), then push into it
      await g(`(() => { const p = ctx.airport.debug.world(128, 232), F = ctx.foot.debug.F; F.pos.set(p.x, 0, p.z); F.vel.set(0, 0, 0); ctx.cam.snap(); return true; })()`);
      await t.frames(6); await W.reset(t);
      const into = await A(128, 260);
      let maxR = 0;
      for (let k = 0; k < 140; k += 4) {
        await g(`(() => { const F = ctx.foot.debug.F, dx = ${into.x} - F.pos.x, dz = ${into.z} - F.pos.z, L = Math.hypot(dx, dz) || 1; const fy = ctx.foot.frameYaw, fx = Math.sin(fy), fz = Math.cos(fy), rx = -fz, rz = fx; __pad.axes[0] = (dx * rx + dz * rz) / L; __pad.axes[1] = -(dx * fx + dz * fz) / L; return true; })()`);
        await t.frames(4);
        maxR = Math.max(maxR, await g(`ctx.airport.debug.local(ctx.foot.debug.F.pos.x, ctx.foot.debug.F.pos.z).r`));
        if (await g(`!!ctx.airport.debug.jokePhase()`)) break;
      }
      t.check(`the runway fence stops her (she never gets past r ${LY.LAND.r1}: max ${maxR.toFixed(1)})`, maxR < LY.LAND.r1 - 0.2, maxR.toFixed(2));
      t.check("pushing the runway fence = the joke (Officer Segal rolls up on his Segway)", await g(`!!ctx.airport.debug.jokePhase()`) && (await evs()).some(e => /airport:fence:\{"variant":\d/.test(e)), (await evs()).filter(e => /fence/.test(e)).join(" "));
      for (let k = 0; k < 160; k += 4) { await t.stick(0, 0); await t.frames(4); if (await g(`ctx.airport.debug.jokePhase() === "talk"`)) break; }
      await t.shot("fence-joke");
      await t.until(`!__lulu3d.ctx.airport.debug.jokePhase()`, "the guard says his piece and rolls away", 120000);
      t.check("…and rolls off again (nothing left standing)", await g(`!ctx.airport.debug.joke.guard`));
      // trying again right away: only Lulu's line (no second guard so soon)
      t.check("again right away: no second scene (a short line from Lulu instead)", await g(`ctx.airport.debug.fenceJoke(false) === false`));
      W.check(t, "the runway fence", await W.report(t));
    });

    await step("back in", async () => {
      // the kerb from the east end: the terminal, the tower behind, the loop with its taxis
      if (await g(`ctx.foot.active`)) { await g(`(() => { const c = ctx.foot.debug.F.car.stub, F = ctx.foot.debug.F; F.pos.set(c.x + Math.cos(c.h) * 1.6, 0, c.z - Math.sin(c.h) * 1.6); return true; })()`); await t.frames(5); await W.reset(t); }
      t.check("by her car: ✋ GET BACK IN", /GET BACK IN|GET IN/.test(await prompt()), await prompt());
      await t.tap(0);
      await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "back behind the wheel", 30000);
    });

    // ── OUT: round the kerb, the east leg, the road out, the on-ramp, the accel lane → the highway ──
    await step("drive out", async () => {
      await W.reset(t);
      const R = await g(`(() => { const R = ctx.airport.debug.roads(), F = ctx.airport.debug.G().F, out = []; const c = ctx.car.pos, me = F.local(c.x, c.z, {});
        for (let i = 0; i < R.loop.length; i += 3) { const p = R.loop[i], q = F.local(p.x, p.z, {}); if (q.r > 186 && q.f < me.f + 8) continue; if (q.f < 0 && q.r < 186) continue; out.push({ x: p.x, z: p.z }); }
        for (let i = 0; i < R.out.length; i += 4) out.push({ x: R.out[i].x, z: R.out[i].z }); return out; })()`);
      const pts = R.slice();
      for (let u = 610; u <= 720; u += 10) pts.push(await HW(E + u, await g(`ctx.airport.debug.LY.onD(${u})`)));
      for (const [u, d] of [[760, 7.6], [820, 5.6], [900, 5.25], [1000, 5.25]]) pts.push(await HW(E + u, d));
      await steps(true);
      await route(pts, 11, { r: 6 });
      await t.until(`__lulu3d.ctx.car.s > ${E} + ${LY.ON0} - 120 && !__lulu3d.ctx.airport.inside`, "round the kerb and down the east leg", 160000);
      await t.shot("out-leg");
      const ok = await t.until(`__lulu3d.ctx.car.s > ${E} + ${LY.ACC1} + 60`, "down the on-ramp + accel lane, back on the highway", 160000);
      const st = await steps(false);
      await noRoute();
      t.check("back on the highway, in the right lane", ok && await g(`ctx.car.d > 3 && ctx.car.d < 7.2`), await g(`ctx.car.d.toFixed(2)`));
      t.check(`driven out with no teleport: the car ≤ 0.5 m a frame (max ${st.car}), the camera ≤ 1.5 m (max ${st.cam})`, st.car <= 0.5 && st.cam <= 1.5, JSON.stringify(st));
      t.check("airport:leave", (await evs()).some(e => e.startsWith("airport:leave")));
      W.check(t, "driving out (kerb → east leg → on-ramp → highway)", await W.report(t));
    });

    await step("planes", async () => {
      // the planes are a pure function of the clock: set it, put her car where she'd look, check they're in view
      const inView = kind => g(`(() => { const cam = ctx.camera; cam.updateMatrixWorld(); const V = cam.position.clone();
        return ctx.airport.debug.planes().filter(p => !"${kind}" || p.kind === "${kind}").some(p => { V.set(p.x, p.y + 3, p.z).project(cam); return Math.abs(V.x) < 0.95 && Math.abs(V.y) < 0.95 && V.z < 1; }); })()`);
      const look = async (atF, atR, toF, toR, T, label) => {
        const p = await A(atF, atR);
        await placeCar(p.x, p.z, await g(`ctx.airport.debug.G().F.yaw(${toF - atF}, ${toR - atR})`), 0);
        await g(`(ctx.airport.debug.S.planes.clock = ${T}, true)`);
        await t.frames(4);
        await t.shot(label);
      };
      // an arrival on short final over the lot (≈ 55 m up)
      await look(-90, 150, -600, 355, 32 + 44, "planes-landing");
      const pl = await g(`ctx.airport.debug.planes()`);
      t.check("planes are flying (arrivals + departures on one clock)", pl.length >= 1, JSON.stringify(pl.map(p => [p.kind, Math.round(p.f), Math.round(p.r), Math.round(p.y)])));
      t.check("…an arrival on final is in view from the lot", await inView("arr"));
      t.check("…each in a parody livery", pl.every(p => /KUGEL AIR|EL OY|SHMEAR JET|NU\? AIR/.test(p.livery)), pl.map(p => p.livery).join(", "));
      // a departure climbing away over the landside's east end, from the kerb
      await look(60, 186, 480, 210, 44, "planes-departing");
      t.check("…a departure climbing out is in view from the kerb", await inView("dep"));
      // over the highway on the way to the exit: an arrival crossing the road low, its shadow sweeping it
      const sH = E + LY.UA - 2200, ph = await HW(sH, 5.25);
      await placeCar(ph.x, ph.z, await g(`ctx.world.highway.at(${sH}).h`), 0);
      await g(`(ctx.airport.debug.S.planes.clock = 32 + 28, true)`);
      await t.frames(4);
      await t.shot("planes-over-highway");
      const arr = (await g(`ctx.airport.debug.planes()`)).find(p => p.kind === "arr");
      t.check("an arrival comes in low over the highway before the exit (60–260 m up)", !!arr && arr.y < 260 && arr.y > 60, JSON.stringify(arr));
      t.check("…in view from the highway", await inView("arr"));
      // nearer, under its path: its shadow on the road
      const sU = E + LY.UA - 1150, pu = await HW(sU, 5.25);
      await placeCar(pu.x, pu.z, await g(`ctx.world.highway.at(${sU}).h`), 0);
      await g(`(ctx.airport.debug.S.planes.clock = 32 + 28, true)`);
      await t.frames(4);
      t.check("…its shadow on the ground near the road (it sweeps across as it passes)", await g(`ctx.airport.debug.S.planes.shadows.some(s => s.visible)`));
    });

    await step("perf", async () => {
      // the busiest view: on the kerb road at the west end looking along the terminal (the loop, the lot, the planes)
      const p = await A(-120, 188);
      await placeCar(p.x, p.z, await g(`ctx.airport.debug.G().F.yaw(1, 0.04)`), 0);
      await g(`(ctx.airport.debug.S.planes.clock = 29.5, true)`);
      const tiers = {};
      for (const q of ["medium", "low"]) {
        await setTier(q);
        await t.frames(30);
        tiers[q] = await perf(60);
        console.log(`   PERF airport kerb ${q}`, JSON.stringify(tiers[q]));
        // what's on screen, by top-level group (in the frustum; instanced counted × instances)
        const top = await t.L(`import("three").then(THREE => { const L3 = __lulu3d, cam = L3.ctx.camera, sc = L3.ctx.scene; cam.updateMatrixWorld();
          const F = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)), by = {};
          sc.traverseVisible(o => { if (!o.isMesh) return; if (o.frustumCulled && o.geometry && !o.isInstancedMesh && !F.intersectsObject(o)) return;
            let a = o; while (a.parent && a.parent !== sc) a = a.parent; const k = a.name || a.type;
            const g = o.geometry, n = g.index ? g.index.count : g.attributes.position.count, ic = o.isInstancedMesh ? o.count : 1;
            const b = by[k] || (by[k] = { d: 0, t: 0 }); b.d++; b.t += Math.round(n / 3 * ic); });
          return Object.entries(by).sort((a, b) => b[1].t - a[1].t).slice(0, 10).map(([k, v]) => k + "=" + v.d + "d/" + v.t + "t").join(" · "); })`);
        console.log(`   PERF airport kerb ${q} top: ${top}`);
      }
      const lowCut = await g(`ctx.airport.debug.low()`);
      console.log("   PERF airport LOW cut", JSON.stringify(lowCut));
      await t.shot("kerb-perf-low");
      await setTier("medium"); await t.frames(20); await t.shot("tower-kerb");
      await setTier("medium");
      const m = tiers.medium, l = tiers.low;
      t.check(`MEDIUM: draw calls ≤ ${BUDGET.calls} (${m.maxCalls}), triangles ≤ ${BUDGET.tris / 1000}k (${m.maxTris})`, m.maxCalls <= BUDGET.calls && m.maxTris <= BUDGET.tris, JSON.stringify(m));
      // LOW is LIGHTER than MEDIUM at the kerb (ci/airport-polish): two of the three jets, every other parked car + lamp, the
      // bottom fence's trees, the windsock and the facade's trim are left out (draw ranges: no extra draw call on MEDIUM),
      // and no shadow pass at all
      t.check(`LOW: the airport leaves out ≥ ${BUDGET.lowCut / 1000}k triangles (and their colliders) (${lowCut.tris}, ${lowCut.cols} colliders off)`, lowCut.low && lowCut.tris >= BUDGET.lowCut && lowCut.cols > 40, JSON.stringify(lowCut));
      t.check(`LOW: lighter than MEDIUM — triangles ≥ ${BUDGET.lowLess / 1000}k fewer (${l.maxTris} vs ${m.maxTris}), draw calls no more (${l.maxCalls} vs ${m.maxCalls}), fewer with the shadow pass (${l.maxWithShadows} vs ${m.maxWithShadows})`,
        l.maxTris <= m.maxTris - BUDGET.lowLess && l.maxCalls <= m.maxCalls + 2 && l.maxWithShadows < m.maxWithShadows, JSON.stringify(l));
      t.check("…back on MEDIUM: everything drawn and solid again", await g(`ctx.airport.debug.low().cols === 0 && !ctx.airport.debug.low().low`));
    });

    // ── her car vs. the kerb's taxis: a real collision (traffic's feel), the taxi knocked spinning, then back in line ──
    await step("bump", async () => {
      await g(`(ctx.airport.debug.S.veh.cars.forEach(c => { c.hit = null; }), true)`);
      // the taxi at the head of the queue (stopped at the ARRIVALS stand)
      let tx = null;
      for (let k = 0; k < 40 && !tx; k++) { tx = (await g(`ctx.airport.debug.vehicles()`)).find(c => c.kind === "taxi" && c.speed < 0.3 && !c.hit); if (!tx) await t.frames(15); }
      if (!t.check("a taxi waiting at the stand", !!tx)) return;
      // her car 16 m behind it in the kerb lane, nose on, rolling
      const bx = tx.x - Math.sin(tx.h) * 16, bz = tx.z - Math.cos(tx.h) * 16;
      await placeCar(bx, bz, tx.h, 6);
      const evs0 = (await evs()).length;
      await route([{ x: tx.x + Math.sin(tx.h) * 6, z: tx.z + Math.cos(tx.h) * 6 }], 11);
      let minGap = 99, bumped = false;
      for (let k = 0; k < 120 && !bumped; k += 2) {
        await t.frames(2);
        const r = await g(`(() => { const c = ctx.car.pos, v = ctx.airport.debug.vehicles(); return { gap: Math.min(...v.map(o => Math.hypot(o.x - c.x, o.z - c.z))), hit: v.some(o => o.hit) }; })()`);
        minGap = Math.min(minGap, r.gap);
        bumped = (await evs()).slice(evs0).some(e => e.startsWith("airport:bump"));
      }
      await noRoute();
      const ks = await g(`ctx.airport.debug.kerbStats()`);
      t.check("driving into a waiting taxi is a COLLISION (airport:bump) — not a ghost, not a static wall", bumped, JSON.stringify(ks));
      t.check(`…she doesn't drive through it (centres never closer than 1.6 m: ${minGap.toFixed(2)})`, minGap > 1.6, minGap.toFixed(2));
      t.check("…a real knock sends the taxi sliding / spinning (traffic's feel)", ks.knocked >= 1, JSON.stringify(ks));
      const dmg = (await evs()).slice(evs0).filter(e => e.startsWith("damage"));
      console.log("   bump:", JSON.stringify(ks), dmg.join(" | "));
      await g(`(window.__route = { pts: [], v: 0, stop: true }, true)`);
      t.check("…and the taxi driver collects himself and pulls back into line", await t.until(`!__lulu3d.ctx.airport.debug.vehicles().some(c => c.hit)`, "the knocked taxi back in line", 30000));
      await noRoute();
      W.check(t, "bumping a taxi", await W.report(t));
    });

    // ── a CHASE off the exit: the cruisers follow her on the airport's roads (not through the fence / the terminal), and
    //    airport security (Officer Segal + Rex) slows her down until they catch up (the owner's decision 10) ──
    await step("chase", async () => {
      if (!await g(`!!(ctx.law && ctx.law.startChase)`)) return;
      await g(`(ctx.law.hold(0), true)`);
      // (from the off-ramp, rolling: the cruiser joins on the highway behind her and has to take the exit after her)
      const p0 = await HW(E - 10, await g(`ctx.airport.debug.LY.offD(-10)`)), p1 = await HW(E + 10, await g(`ctx.airport.debug.LY.offD(10)`));
      await placeCar(p0.x, p0.z, Math.atan2(p1.x - p0.x, p1.z - p0.z), 12);
      await g(`ctx.law.startChase("SPEEDING", { msg: "🚨 TEST" })`);
      const pts = [];
      for (let u = 10; u <= 60; u += 10) pts.push(await HW(E + u, await g(`ctx.airport.debug.LY.offD(${u})`)));
      const R = await g(`(() => { const R = ctx.airport.debug.roads(), F = ctx.airport.debug.G().F, out = []; for (let i = 4; i < R.in.length; i += 4) out.push({ x: R.in[i].x, z: R.in[i].z });
        for (let i = 0; i < R.loop.length; i += 3) { const p = R.loop[i], q = F.local(p.x, p.z, {}); if (q.r > 186 && q.f > 40) break; const sh = q.r > 186 ? 3.4 : 0; out.push({ x: p.x - p.tz * sh, z: p.z + p.tx * sh }); } return out; })()`);
      pts.push(...R);
      await route(pts, 13, { r: 6, stop: true });
      // sample: every chasing cruiser in the airport stays on its roads (near the net, never in the terminal / past a fence)
      const T = LY.TERM, LAND = LY.LAND;
      let worst = { d: 0 }, inTerm = 0, pastFence = 0, cruiserIn = false, closest = 999, sec = null, maxHeldV = 0, heldFrames = 0, busted = false;
      let last = null;
      for (let k = 0; k < 2100; k += 3) {
        await t.frames(3);
        const r = await g(`(() => { const D = ctx.airport.debug, out = [], c = ctx.car.pos; for (const u of ctx.law._dbg.L.units) { const cc = u.car; if (!cc || u.mode !== "chase") continue; const q = D.local(cc.x, cc.z); const n = D.netDist(cc.x, cc.z); out.push({ f: q.f, r: q.r, d: n.d, p: n.p, gap: Math.hypot(cc.x - c.x, cc.z - c.z) }); }
          return { cops: out, state: L3.state, inside: ctx.airport.inside, sec: D.security(), v: ctx.car.vF, chasing: ctx.law.chasing }; })()`);
        last = r;
        if (k % 90 === 0) console.log("   chase t" + k + ":", JSON.stringify(await g(`(() => { const L = ctx.law._dbg.L, ch = L.chase, D = ctx.airport.debug, c = ctx.car.pos, q = D.local(c.x, c.z);
          return { her: [Math.round(q.f), Math.round(q.r), +ctx.car.vF.toFixed(1)], ch: ch && { heat: ch.heat, seen: ch.seen, srch: ch.searching, ev: +ch.evade.toFixed(2), bust: +ch.bust.toFixed(2) },
            units: L.units.map(u => { const cc = u.car; if (!cc) return u.mode; const p = D.local(cc.x, cc.z); return [u.mode, Math.round(p.f), Math.round(p.r), +cc.speed.toFixed(1), cc.hit ? "HIT" : ""]; }), sec: D.security().phase }; })()`)));
        if (r.state !== "playing") { busted = /law/.test(r.state); break; }
        for (const c of r.cops) {
          const inAir = c.f > LAND.f0 - 30 && c.f < LAND.f1 + 30 && c.r > 12 && c.r < LAND.r1 + 80;
          if (!inAir) continue;
          if (c.r > LAND.r0) cruiserIn = true;
          if (c.d > worst.d) worst = c;
          if (c.f > T.f0 && c.f < T.f1 && c.r > T.r0 && c.r < T.r1) inTerm++;
          if (c.r > LAND.r1 + 1 && c.f > LAND.f0 && c.f < LAND.f1) pastFence++;
          if (r.inside) closest = Math.min(closest, c.gap);
        }
        if (r.sec.phase && !sec) sec = r.sec.phase;
        if (r.sec.holding && r.sec.on > 1.2) { if (!heldFrames) await t.shot("kerb-security"); heldFrames++; maxHeldV = Math.max(maxHeldV, r.v); }
        if (r.inside && heldFrames > 20 && cruiserIn && closest < 30) break;
        if (!r.chasing && !r.sec.phase && k > 900) break;
      }
      await noRoute();
      console.log("   law log:", JSON.stringify(await g(`ctx.law._dbg.log.slice(-8).map(e => e.ev + ":" + (e.result || e.why || e.reason || ""))`)));
      console.log("   chase end:", JSON.stringify(last && { state: last.state, inside: last.inside, chasing: last.chasing, v: +last.v.toFixed(1), cops: last.cops.map(c => [Math.round(c.f), Math.round(c.r), c.p, Math.round(c.gap)]), sec: last.sec, her: await g(`(() => { const q = ctx.airport.debug.local(ctx.car.pos.x, ctx.car.pos.z); return [Math.round(q.f), Math.round(q.r)]; })()`) }));
      console.log("   chase:", JSON.stringify({ worst, inTerm, pastFence, cruiserIn, closest: +closest.toFixed(1), sec, heldFrames, maxHeldV: +maxHeldV.toFixed(1), busted, routes: await g(`ctx.airport.debug.routes()`) }));
      t.check("the chase follows her off the exit: a cruiser drives into the landside after her", cruiserIn || busted, String(closest));
      t.check("…on the airport's roads (law asks the airport for a route: ctx.airport routes > 0)", await g(`ctx.airport.debug.routes() > 0`));
      t.check(`…never through the terminal, never past the runway fence (${inTerm} / ${pastFence} frames)`, inTerm === 0 && pastFence === 0);
      t.check(`…keeping to the road net (worst ${worst.d.toFixed ? worst.d.toFixed(1) : worst.d} m off it ≤ 14: ${worst.p || "-"})`, worst.d <= 14, JSON.stringify(worst));
      t.check("airport security rolls out for a wanted Lulu at the kerb (Officer Segal on his Segway)", !!sec || (await evs()).some(e => /airport:security/.test(e)), (await evs()).filter(e => /security/.test(e)).join(" "));
      t.check(`…and slows her right down while he's beside her (≤ ${(await g(`ctx.airport.debug.SEC.carCap`)) + 1.5} m/s: ${maxHeldV.toFixed(1)} over ${heldFrames} samples)`, busted || (heldFrames > 0 && maxHeldV <= (await g(`ctx.airport.debug.SEC.carCap`)) + 1.5));
      t.check("…so the real cops catch up (a cruiser within 30 m of her in the landside — or BUSTED)", busted || closest < 30, String(closest));
      if (await g(`L3.state === "playing"`)) await g(`(ctx.law.standDown("test"), true)`);
      await t.frames(30);
    });

    // the kerb road's heading (the loop runs DEPARTURES → ARRIVALS: +f) and her car's outer edge toward the terminal
    const kerbYaw = () => g(`ctx.airport.debug.G().F.yaw(1, 0)`);
    const wrapDeg = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return Math.abs(a) * 180 / Math.PI; };
    const driving = async label => {
      if (await g(`L3.state !== "playing" && /^law/.test(L3.state)`)) { await g(`(__m.setState("playing"), true)`); await t.frames(10); }
      if (await g(`L3.state === "playing" && ctx.law && ctx.law.chasing`)) { await g(`(ctx.law.standDown("test"), true)`); await t.frames(10); }
      return t.check(`${label}: she's driving (state playing, not on foot)`, await g(`L3.state === "playing" && !(ctx.foot && ctx.foot.active)`), await g(`L3.state`));
    };

    // ── a BUST at the kerb (ci/airport-kerb): law's pull-over asks the airport (hook "pullOverSpot") — she stops right where
    //    she is, facing along the kerb road, instead of easing toward the highway's shoulder 190 m away; the cruiser pulls in
    //    behind her on the kerb road ──
    await step("kerb bust", async () => {
      if (!await g(`!!(ctx.law && ctx.law.startChase)`)) return;
      if (!await driving("kerb bust")) return;
      const KY = await kerbYaw();
      const p = await A(-40, LY.KERB_R);
      await placeCar(p.x, p.z, KY, 5);
      await route([await A(-20, LY.KERB_R), await A(10, LY.KERB_R), await A(60, LY.KERB_R), await A(100, LY.KERB_R)], 5, { r: 6 });
      await g(`(ctx.law.hold(0), ctx.law._dbg.L.grace = 0, ctx.law._dbg.FORCE.bustOutcome = "free", true)`);
      // the pull-over's track, every frame (her airport-frame f / r, heading, speed)
      await g(`(() => { if (!window.__btOn) { window.__btOn = true; __m.hook("update", () => { const L3 = window.__lulu3d, ctx = L3.ctx; if (L3.state !== "lawBust" || !window.__bt) return;
          const c = ctx.car, q = ctx.airport.debug.local(c.pos.x, c.pos.z); window.__bt.push([+q.f.toFixed(3), +q.r.toFixed(3), +c.h.toFixed(4), +c.speed.toFixed(2)]); }, -999); } window.__bt = []; return true; })()`);
      const spots0 = await g(`ctx.airport.debug.pullSpots ? ctx.airport.debug.pullSpots() : 0`);
      await g(`ctx.law.startChase("SPEEDING", { msg: "🚨 TEST" })`);
      // the first cruiser: put it on the kerb road 9 m behind her (it'd otherwise come all the way round from the highway)
      const ok = await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.mode === "chase" && u.car)`, "a cruiser joins the chase", 20000);
      if (!t.check("kerb bust: a cruiser on the chase", ok)) return;
      await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.mode === "chase" && u.car), c = u.car, car = ctx.car; c.x = car.pos.x - Math.sin(car.h) * 9; c.z = car.pos.z - Math.cos(car.h) * 9; c.h = car.h; c.s = car.s; c.speed = 5; return true; })()`);
      const busted = await t.until(`__lulu3d.state === "lawBust"`, "rolling slowly with a cruiser on her tail at the kerb = BUSTED", 60000);
      t.check("kerb bust: rolling slowly with a cruiser on her tail at the kerb = BUSTED (law's pull-over)", busted, await g(`L3.state`));
      if (!busted) { await noRoute(); return; }
      await t.until(`!!document.querySelector("#dialog.open") || __lulu3d.state !== "lawBust"`, "the officer at her window", 30000);
      await t.frames(12);
      await t.shot("kerb-bust");
      const bt = await g(`window.__bt.slice()`);
      const end = await g(`(() => { const L = ctx.law._dbg.L, car = ctx.car, F = ctx.airport.debug.G().F, fx = Math.sin(car.h), fz = Math.cos(car.h);
        const u = L.units.find(u => u.mode === "pull" && u.car), c = u && u.car; if (!c) return { cop: null };
        const dx = c.x - car.pos.x, dz = c.z - car.pos.z, q = F.local(c.x, c.z, {}); return { cop: { lon: +(dx * fx + dz * fz).toFixed(1), lat: +(-dx * fz + dz * fx).toFixed(1), f: Math.round(q.f), r: +q.r.toFixed(1) } }; })()`);
      const spots = (await g(`ctx.airport.debug.pullSpots ? ctx.airport.debug.pullSpots() : 0`)) - spots0;
      await g(`(__m.setState("playing"), delete ctx.law._dbg.FORCE.bustOutcome, true)`);
      await noRoute();
      await t.frames(5);
      if (await g(`L3.state === "playing" && ctx.law.chasing`)) await g(`(ctx.law.standDown("test"), true)`);
      await g(`(ctx.law.hold(900), true)`);
      if (!t.check("kerb bust: the pull-over was tracked", bt.length > 10, String(bt.length))) return;
      const [f0, r0] = bt[0], last = bt[bt.length - 1];
      let lat = 0, minR = 1e9, maxR = -1e9, iRest = -1, creep = 0, maxH = 0;
      bt.forEach(([f, r, h, v], i) => { lat = Math.max(lat, Math.abs(r - r0)); minR = Math.min(minR, r); maxR = Math.max(maxR, r); maxH = Math.max(maxH, wrapDeg(h - KY)); if (iRest < 0 && v < 0.3) iRest = i; });
      if (iRest >= 0) for (let i = iRest; i < bt.length; i++) creep = Math.max(creep, Math.hypot(bt[i][0] - bt[iRest][0], bt[i][1] - bt[iRest][1]));
      const along = last[0] - f0, hEnd = wrapDeg(last[2] - KY);
      console.log("   kerb bust:", JSON.stringify({ frames: bt.length, start: bt[0], end: last, along: +along.toFixed(2), lat: +lat.toFixed(2), minR, maxR, iRest, creep: +creep.toFixed(2), hEnd: +hEnd.toFixed(1), maxH: +maxH.toFixed(1), spots, cop: end.cop }));
      t.check("kerb bust: law asked the airport where to stop (hook pullOverSpot answered)", spots > 0, String(spots));
      t.check(`…she stops right where she is: ≤ 6 m on along the kerb road (${along.toFixed(1)}), no creep once stopped (${creep.toFixed(2)} ≤ 0.3 m)`, along >= -0.5 && along <= 6 && iRest >= 0 && creep <= 0.3, JSON.stringify({ along, iRest, creep }));
      t.check(`…not toward the highway: sideways ≤ 0.25 m (${lat.toFixed(2)}), still in the kerb road's lanes (r ${minR.toFixed(1)} – ${maxR.toFixed(1)})`, lat <= 0.25 && minR > LY.KERB_R - 5.25 && maxR < LY.KERB_R + 5.25, JSON.stringify({ lat, minR, maxR }));
      t.check(`…facing along the kerb road (${hEnd.toFixed(1)}° at the window, worst ${maxH.toFixed(1)}° ≤ 6°)`, maxH <= 6, JSON.stringify({ hEnd, maxH }));
      t.check("…and the cruiser pulls in right behind her on the kerb road (4–14 m back, in line)", !!end.cop && end.cop.lon < -4 && end.cop.lon > -14 && Math.abs(end.cop.lat) < 3.5 && end.cop.r > LY.KERB_R - 5.25 && end.cop.r < LY.KERB_R + 5.25, JSON.stringify(end.cop));
      await t.frames(20);
      await W.reset(t);
    });

    // ── a cruiser that SHOVES her at the kerb (ci/airport-kerb): her car stays on the kerb road — the kerb edge holds it off
    //    the sidewalk for a moment after a cop's contact (and holds the cruiser off her) — a slow lean and a hard ram ──
    await step("kerb shove", async () => {
      if (!await driving("kerb shove")) return;
      await g(`(ctx.law && ctx.law.hold && ctx.law.hold(900), true)`);
      // (the bust's cruisers, given up and parked: out of the way)
      await g(`(ctx.law && ctx.law._dbg ? ctx.law._dbg.L.units.slice().forEach(u => { if (u.car) ctx.traffic.remove(u.car); }) : 0, true)`);
      await noRoute();
      const KY = await kerbYaw(), WALK_R0 = await g(`ctx.airport.debug.LY.WALK.r0`), GIVE = await g(`ctx.airport.debug.KERB_EDGE ? ctx.airport.debug.KERB_EDGE.give : 0`);
      // the recorder: her car's outer edge toward the terminal (r of its circles + their radius), the gap to the cruiser
      await g(`(() => { if (!window.__svOn) { window.__svOn = true; __m.hook("update", dt => { const S = window.__sv; if (!S || !S.c) return; const ctx = window.__lulu3d.ctx, car = ctx.car, F = ctx.airport.debug.G().F, q = F.local(car.pos.x, car.pos.z, {});
          const dr = Math.sin(car.h) * F.rx + Math.cos(car.h) * F.rz, gap = Math.hypot(S.c.x - car.pos.x, S.c.z - car.pos.z); S.t += dt;
          if (S.contact == null && (S.c.hit || gap < 3.4)) S.contact = S.t;      // (nose to her side: ~3.2 m between centres; a hard ram wrecks the cruiser)
          S.maxOut = Math.max(S.maxOut, q.r + Math.abs(dr) * 1.15 + 0.93); S.minGap = Math.min(S.minGap, gap); }, -999); } return true; })()`);
      const res = {};
      for (const V of [{ id: "lean", v: 3, push: 1.2 }, { id: "ram", v: 9, push: 0.3 }]) {
        const p = await A(-22.5, LY.KERB_LANE);
        await placeCar(p.x, p.z, KY, 0);
        const holds0 = await g(`ctx.airport.debug.kerbHolds ? ctx.airport.debug.kerbHolds() : 0`);
        // a cruiser on the middle lane, nose toward the terminal, driving into her side (a law car: data.law)
        await g(`(() => { const car = ctx.car, F = ctx.airport.debug.G().F, w = F.world(-22.5, ${LY.KERB_LANE} - 6, {});
          const c = ctx.traffic.add("cop", car.s, 5.25, 1, 0, { keep: true, noNearMiss: true, data: { law: { test: true } } });
          c.free = true; c.x = w.x; c.z = w.z; c.h = F.yaw(0, 1); c.s = car.s; c.speed = ${V.v};
          window.__sv = { c, t: 0, v: ${V.v}, push: ${V.push}, contact: null, maxOut: 0, minGap: 99 };
          c.ai = (dt, c) => { const S = window.__sv;
            const go = S.contact == null || S.t - S.contact < S.push; c.speed = go ? Math.min(S.v, c.speed + 12 * dt) : Math.max(0, c.speed - 14 * dt); c.x += Math.sin(c.h) * c.speed * dt; c.z += Math.cos(c.h) * c.speed * dt; c.s = ctx.car.s; };
          return true; })()`);
        await steps(true);
        await t.until(`window.__sv && window.__sv.contact != null && window.__sv.t - window.__sv.contact > ${V.push} + 0.25`, `the cruiser ${V.id}s into her`, 15000);
        await t.frames(30);
        await t.shot("kerb-shove-" + V.id);
        await t.frames(30);
        const st = await steps(false);
        res[V.id] = await g(`(() => { const S = window.__sv, car = ctx.car, q = ctx.airport.debug.local(car.pos.x, car.pos.z); const out = { contact: S.contact != null, maxOut: +S.maxOut.toFixed(2), minGap: +S.minGap.toFixed(2), her: [+q.f.toFixed(1), +q.r.toFixed(1)], copHit: !!S.c.hit,
          holds: (ctx.airport.debug.kerbHolds ? ctx.airport.debug.kerbHolds() : 0) - ${holds0} }; ctx.traffic.remove(S.c); window.__sv = null; return out; })()`);
        res[V.id].step = st.car;
        await t.frames(5);
      }
      console.log("   kerb shove:", JSON.stringify(res), "limit", WALK_R0 + GIVE);
      const lim = WALK_R0 + GIVE + 0.05;
      t.check(`a cruiser leaning on her at the kerb: her car stays on the kerb road (outer edge r ${res.lean.maxOut} ≤ ${lim.toFixed(2)}, the sidewalk starts at ${WALK_R0})`, res.lean.contact && res.lean.maxOut <= lim, JSON.stringify(res.lean));
      t.check(`…and a hard ram (outer edge r ${res.ram.maxOut} ≤ ${lim.toFixed(2)})`, res.ram.contact && res.ram.maxOut <= lim, JSON.stringify(res.ram));
      t.check("…the kerb edge did the holding (airport kerbHolds > 0 on the lean)", res.lean.holds > 0, JSON.stringify(res));
      t.check(`…the cruiser doesn't drive through her car (centres ≥ 1.5 m: lean ${res.lean.minGap}, ram ${res.ram.minGap})`, res.lean.minGap >= 1.5 && res.ram.minGap >= 1.5, JSON.stringify(res));
      t.check(`…no teleport: her car ≤ 0.5 m a frame (lean ${res.lean.step}, ram ${res.ram.step})`, res.lean.step <= 0.5 && res.ram.step <= 0.5, JSON.stringify(res));
      await W.reset(t);
    });
  },
};
