// 🌊 Flow (core/camera.js cam.blend · core/transition.js dissolve · foot's hop-in): the picture never jumps where it
// used to cut.
//   • getting out of the car: the camera glides from the chase cam to her (no jump between two frames), and she's
//     in control as soon as she's on her feet
//   • getting back in: she hops INTO the seat (a "getin" phase), then the camera glides to the chase cam; the car
//     doesn't flicker while her courtesy shield runs
//   • a teleport is still a cut (cam.blend refuses a jump of more than 70 m)
//   • the road ahead is built a step a frame (world.js Chunk.advance), never half-built near her
//   • leaving a town whose models are loaded is a SOFT CUT (the frozen frame melts away; the black fade stays out)
//   • a building's inside can be warmed ahead of the door — then stepping in and out is a soft cut too (no black)
//   • ONE WORLD: the towns stand at the interchange, built in slices before she gets there; she drives down the
//     ramp, through the T and into Lakewood with no fade, no frozen frame, no jump (and back out the same way)
module.exports = {
  name: "flow",
  query: "&enable=town",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    // every frame: how far the picture moved since the last one (the hud hook runs after the camera)
    await t.L(`import("./js/core/ctx.js").then(m => { const W = window.__cam = { on: false, max: 0, n: 0, last: null, hid: 0, hidF: 0 };
      m.hook("hud", () => { const p = m.ctx.camera.position; if (W.on && W.last) { W.max = Math.max(W.max, Math.hypot(p.x - W.last.x, p.y - W.last.y, p.z - W.last.z)); W.n++; } W.last = { x: p.x, y: p.y, z: p.z };
        if (m.ctx.state === "playing" && !m.ctx.car.obj.visible) W.hid++;
        if (m.ctx.state === "footRun" && m.ctx.foot && m.ctx.foot.obj && !m.ctx.foot.obj.visible) W.hidF++; }); })`);
    const watch = on => t.L(`(window.__cam.on = ${on}, window.__cam.max = 0, window.__cam.n = 0, true)`);
    // a test driver for the ramp: steer at waypoints (world x / z) at a target speed
    await t.L(`import("./js/core/ctx.js").then(m => m.hook("controls", (ctl, dt) => { const W = window.__route; if (!W || !W.pts.length) return; const car = m.ctx.car;
      const p = W.pts[0]; if (Math.hypot(p.x - car.pos.x, p.z - car.pos.z) < (W.r || 4)) { W.pts.shift(); if (!W.pts.length) return; }
      const q = W.pts[0], want = Math.atan2(q.x - car.pos.x, q.z - car.pos.z); let d = want - car.h; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      ctl.steer = Math.max(-1, Math.min(1, -d * 2.6)); ctl.throttle = car.speed < (W.v || 9) ? 0.7 : 0; ctl.brake = car.speed > (W.v || 9) + 3 ? 0.4 : 0; ctl.handbrake = false; ctl.analog = true; }, 1000))`);
    const moved = () => t.L(`({ max: +window.__cam.max.toFixed(2), n: window.__cam.n })`);

    t.check("ctx.cam.blend + ctx.dissolve are there", await g(`typeof ctx.cam.blend === "function" && typeof ctx.dissolve === "function"`));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    // parked on the right shoulder, standing still
    await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 40, p = r.point(s, 8.0, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 8.0; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
    await t.frames(30);

    // ── out of the car: one move ──
    await watch(true);
    await g(`(ctx.foot.start("droveOff"), true)`);
    t.check("getting out starts a camera blend (not a snap)", await g(`ctx.cam.blending === true`));
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "she's on her feet and walking", 6000);
    const walkAt = await g(`+ctx.foot.debug.F.t.toFixed(2)`);
    t.check("in control within ~0.6 s of getting out", walkAt <= 0.75, String(walkAt));
    await t.frames(30);
    let m = await moved();
    t.check("out of the car: the picture never jumps (≤ 1.5 m between two frames)", m.n > 20 && m.max <= 1.5, JSON.stringify(m));
    t.check("she doesn't blink after climbing out (a courtesy shield, no flicker — photo mode can pose her at once)", await t.L(`window.__cam.hidF === 0`) && await g(`ctx.G.invT > 0`), String(await t.L(`window.__cam.hidF`)));
    await t.shot("out-of-the-car");

    // ── back in: she hops into the seat, then the camera glides ──
    await g(`(() => { const F = ctx.foot.debug.F, c = F.car.stub; F.pos.set(c.x + Math.cos(c.h) * 2.0, 0.05, c.z - Math.sin(c.h) * 2.0); return true; })()`);
    await t.frames(4);
    await watch(true);
    t.check("✋ offers her own car", /GET BACK IN/.test(await g(`(ctx.foot.debug.interactables() || {}).label || ""`)));
    await t.tap(0);
    const hop = await g(`(() => { const F = ctx.foot.debug.F; return F ? F.phase : "gone"; })()`);
    t.check("she HOPS in (a getin phase, not a vanish)", hop === "getin", hop);
    await t.shot("hop-in");
    await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "she's driving again", 4000);
    t.check("…and the camera blends to the chase cam", await g(`ctx.cam.blending === true`));
    await t.frames(30);
    m = await moved();
    t.check("back in the car: the picture never jumps (≤ 1.5 m between two frames)", m.n > 20 && m.max <= 1.5, JSON.stringify(m));
    t.check("the blend has ended", await g(`ctx.cam.blending === false`));
    t.check("her car doesn't blink after she hops in (a courtesy shield, no flicker)", await t.L(`window.__cam.hid === 0`) && await g(`ctx.G.invT > 0`), String(await t.L(`window.__cam.hid`)));

    // ── a teleport is still a cut ──
    await g(`(() => { ctx.cam.blend(0.6); const r = ctx.world.road, s = ctx.car.s + 400, p = r.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.world.prebuild(s); return true; })()`);
    await t.frames(2);
    t.check("a 400 m jump is not blended (it cuts)", await g(`ctx.cam.blending === false && Math.hypot(ctx.camera.position.x - ctx.car.pos.x, ctx.camera.position.z - ctx.car.pos.z) < 20`));
    await watch(false);

    // ── the road ahead is built in slices (not a whole 200 m chunk + every feature's set pieces in one frame) ──
    await g(`(ctx.world.sliceLog = [], ctx.banter.autopilot = { d: 1.75, speed: 30 }, true)`);
    const sA = await g(`ctx.car.s`);
    await t.until(`__lulu3d.ctx.car.s > ${sA} + 450`, "450 m of road", 40000);
    const sl = await g(`(() => { const w = ctx.world, per = {}; for (const [k] of w.sliceLog) per[k] = (per[k] || 0) + 1;
      let near = true, ahead = 0; for (const c of w.chunks.values()) { if (c.building && c.s0 < ctx.car.s + 300) near = false; if (!c.building) ahead = Math.max(ahead, c.s1 - ctx.car.s); }
      return { chunks: Object.keys(per).length, steps: Math.max(0, ...Object.values(per)), near, ahead: Math.round(ahead) }; })()`);
    t.check("far chunks are built a step at a time (several steps each)", sl.chunks >= 1 && sl.steps >= 4, JSON.stringify(sl));
    t.check("…nothing within 300 m of her is ever half-built, and the road is finished well ahead (≥ 400 m)", sl.near && sl.ahead >= 400, JSON.stringify(sl));
    // a jump with no prebuild (a restart, a warp): what's near is built at once, not in slices
    await g(`(() => { ctx.banter.autopilot = null; ctx.world.sliceLog = null; const r = ctx.world.road, s = ctx.car.s + 3000, p = r.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
    await t.frames(4);
    t.check("after a jump the chunk under her is whole within a few frames", await g(`(() => { const c = ctx.world.chunks.get(Math.floor(ctx.car.s / 200)); return !!c && !c.building; })()`));

    // ── leaving a town: the soft cut, no black ──
    await g(`(ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.frames(10);
    await t.L(`(window.__black = 0, window.__blk = setInterval(() => { const f = document.getElementById("townFade"); if (f) window.__black = Math.max(window.__black, +f.style.opacity || 0); }, 10), true)`);
    t.check("the ramp's transition starts", await g(`ctx.town.debug.trans("leave")`));
    await t.frames(2);
    const soft = await t.L(`({ shown: !!document.getElementById("softCut") && document.getElementById("softCut").style.display === "block", active: __lulu3d.ctx.town.active })`);
    t.check("back on the highway behind a frozen frame (the soft cut is up)", soft.shown && !soft.active, JSON.stringify(soft));
    await t.shot("soft-cut");
    await t.until(`!__lulu3d.ctx.town.transitioning`, "the transition ends", 4000);
    await t.page.waitForTimeout(700);
    const after = await t.L(`(clearInterval(window.__blk), { black: window.__black, gone: document.getElementById("softCut").style.display === "none" || +document.getElementById("softCut").style.opacity === 0 })`);
    t.check("…it melts away, and the black fade never showed", after.gone && after.black === 0, JSON.stringify(after));
    t.check("she's driving on the highway", await g(`L3.state === "playing" && !ctx.world.road.town`));

    // ── ONE WORLD: down the ramp into Lakewood, no cut — and back out ──
    await oneWorld(t, g, watch, moved);

    // ── a building's inside can be warmed ahead of the door ──
    t.check("interiors can be warmed (ctx.interiors.<id>.warm)", await g(`typeof ctx.interiors.bar.warm === "function" && (ctx.interiors.bar.warm(), ctx.interiors.bar.warm(), true)`));
    await t.frames(10);

    // ── a warmed building: in and out by a soft cut (the room is built in the same frame; its black never shows) ──
    if (await t.until(`__lulu3d.ctx.interiors.bar.ready()`, "the bar's inside is loaded ahead of the door", 90000)) {
      await t.L(`(window.__blackI = 0, window.__blkI = setInterval(() => { const f = document.getElementById("intFade"); if (f) window.__blackI = Math.max(window.__blackI, +f.style.opacity || 0); }, 10), true)`);
      await g(`(window.__out = 0, ctx.interiors.bar.enter({ exit: () => { window.__out++; L3.setState("playing"); } }), true)`);
      t.check("stepping in: the room is there at once", await g(`L3.state === "interior" && !!window.__interiors.room && window.__interiors.room.ready === true`));
      await t.frames(20);
      await t.shot("soft-door");
      await g(`(window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "playing" && window.__out === 1`, "stepping out: back on the road at once", 6000);
      await t.page.waitForTimeout(700);
      t.check("…in and out without the black screen", await t.L(`(clearInterval(window.__blkI), window.__blackI === 0)`), String(await t.L(`window.__blackI`)));
    }
  },
};

/** The towns attached to the highway: built ahead in slices, entered and left by driving across a line. */
async function oneWorld(t, g, watch, moved) {
  await g(`(ctx.town.load("lakewood"), ctx.town.load("midwood"), true)`);
  if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood") && __lulu3d.ctx.town.loaded("midwood")`, "both towns' models load", 120000)) return;
  if (await g(`ctx.town.active`)) await g(`ctx.town.leave("reset")`);
  await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
  const E = await g(`ctx.town.debug.exitAhead(700)`);
  t.check("an interchange is planned ahead (where both towns fit by the road)", E > 0, String(E));
  t.check("…the towns stand ≥ 100 m clear of the highway there", await g(`ctx.town.debug.fits(${E})`));
  // she comes up the right lane toward it; the towns build in slices as she nears (BUILD_FROM 900 m)
  await g(`(() => { const s = ${E} - 600, p = ctx.world.highway.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25;
    ctx.car.vx = Math.sin(p.h) * 14; ctx.car.vz = Math.cos(p.h) * 14; ctx.car.vF = 14; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
  await g(`(window.__route = { pts: ctx.town.debug.rampRoute(${E}, 0, -580).map(([u, d]) => ctx.world.highway.point(${E} + u, d, {})).map(p => ({ x: p.x, z: p.z })), v: 13, r: 5 }, true)`);
  await t.until(`__lulu3d.ctx.town.standing.length >= 2 && __lulu3d.ctx.town.standing.every(b => b.ready)`, "both towns are built before she reaches the ramp", 60000);
  const st = await g(`ctx.town.standing`);
  t.check("…in slices (each a few hundred steps)", st.every(b => b.steps > 50), JSON.stringify(st.map(b => [b.town, b.steps, b.worst])));
  // (single spikes are the garbage collector landing in a step; 99 % of the steps are what the build itself costs)
  t.check("…the slices stay small (99 % ≤ 8 ms here — software GL on a busy CPU; the budget is ~3 ms a frame)", st.every(b => b.p99 <= 8), JSON.stringify(st.map(b => [b.town, b.p95, b.p99, b.worst, b.ms])));
  // the picture from the ramp: the town is there ahead, before the STOP sign
  await t.until(`__lulu3d.ctx.car.s > ${E} + 145`, "on the branch, nearly at the STOP sign", 60000);
  const seen = await g(`(() => { const cam = ctx.camera; cam.updateMatrixWorld();
    const town = ctx.scene.children.find(o => o.name === "Town:lakewood"); if (!town) return { town: false }; let n = 0; town.updateMatrixWorld(true);
    town.traverse(o => { if (o.isMesh && o.visible && o.userData.townLook && o.geometry.boundingSphere) { const c = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld).project(cam); if (Math.abs(c.x) < 1.1 && Math.abs(c.y) < 1.1 && c.z < 1) n++; } });
    return { town: true, inView: n, u: Math.round(ctx.car.s - ${E}), active: ctx.town.active }; })()`);
  t.check("Lakewood is in view from the ramp, before the STOP sign (its blocks drawn)", seen.town && seen.inView >= 3 && !seen.active, JSON.stringify(seen));
  await t.shot("one-world-ramp");
  // through the T and on out the cross road: the road under her becomes Lakewood's
  await t.L(`(window.__fade = 0, window.__fadeI = setInterval(() => { const f = document.getElementById("townFade"), c = document.getElementById("softCut"); if ((f && +f.style.opacity > 0) || (c && c.style.display === "block")) window.__fade++; }, 10), true)`);
  await watch(true);
  await g(`(() => { const hw = ctx.world.highway, pts = window.__route.pts; for (const d of [44, 70, 110, 150, 190, 230, 260]) { const p = hw.point(${E} + 172.2, d, {}); pts.push({ x: p.x, z: p.z }); } window.__route.v = 11; return true; })()`);
  if (!await t.until(`__lulu3d.ctx.town.active`, "she drives into Lakewood", 60000)) return;
  const at = await g(`({ att: ctx.town.attached, street: ctx.town.street, hw: [...ctx.world.chunks.values()].some(c => c.group.visible), u: Math.round(ctx.world.highway.nearest(ctx.car.pos.x, ctx.car.pos.z, ${E} + 172, {}).d), v: +ctx.car.speed.toFixed(1) })`);
  t.check("…attached: on Route 9 (the cross road IS Route 9), still moving, the highway still drawn behind her", at.att && at.street === "Route 9" && at.v > 5 && at.hw, JSON.stringify(at));
  await t.until(`!window.__route.pts.length`, "on into town", 60000);
  let m = await moved();
  t.check("down the ramp → in town: the picture never jumps (≤ 1.5 m between two frames)", m.n > 60 && m.max <= 1.5, JSON.stringify(m));
  t.check("…and no fade or frozen frame ever showed", await t.L(`window.__fade === 0`), String(await t.L(`window.__fade`)));
  await t.shot("one-world-in-town");
  // back out the way she came: around (a three-point turn's worth of steering) and down Route 9
  await g(`(() => { const hw = ctx.world.highway, P = []; for (const d of [250, 226, 200, 160, 120, 80, 50, 36, 26]) { const p = hw.point(${E} + 172.2 + (d > 240 ? -2 : -1.6), d, {}); P.push({ x: p.x, z: p.z }); } window.__route = { pts: P, v: 9, r: 5 }; return true; })()`);
  await g(`(() => { const c = ctx.car; c.vx = c.vz = 0; c.vF = 0; c.place(c.pos.x, c.pos.z, c.h + Math.PI); ctx.cam.snap(); return true; })()`);
  await t.frames(3);
  await watch(true);
  if (!await t.until(`!__lulu3d.ctx.town.active`, "she drives back out to the T", 60000)) return;
  const out = await g(`({ road: ctx.world.road === ctx.world.highway, s: Math.round(ctx.car.s - ${E}), d: +ctx.car.d.toFixed(1), standing: ctx.town.standing.length })`);
  t.check("…out past the line: the highway's road under her again, by the T — the town still standing there", out.road && out.s > 150 && out.s < 200 && out.d > 20 && out.d < 70 && out.standing >= 2, JSON.stringify(out));
  await t.frames(20);
  m = await moved();
  t.check("…and out: no jump either (≤ 1.5 m between two frames)", m.max <= 1.5, JSON.stringify(m));
  t.check("…no fade going out", await t.L(`(clearInterval(window.__fadeI), window.__fade === 0)`));
  await g(`(window.__route = null, true)`);
  await watch(false);
}
