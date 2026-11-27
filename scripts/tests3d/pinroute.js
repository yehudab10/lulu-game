// 3D smoke: a 📍 ping guides the WHOLE way (the owner, 2026-11-27: "I pinged the dealerships but instead it only pointed
// towards outside midwood"): from inside Midwood a ping to Mazelati (the highway, lap metre 800) says the whole route
// ("leave Midwood, then 2.8 km on the highway (back the other way)") and points at the exit; on the highway it points
// the right way along it (the shorter way round — both carriageways drive their own way now, ci/twoway: "turn around"
// when she faces away), the beam stands over the showroom from 1.2 km, and arriving clears it. Plus: Midwood → a Lakewood
// place, Midwood → JFK, and from indoors.
module.exports = {
  name: "pinroute",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,world,foot,airport",
  async run(t) {
    const g = c => t.game(c);
    await t.until(`__lulu3d.state === "title"`, "title", 90000);
    await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
    await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run", 60000);
    if (await g(`ctx.foot.active`)) await g(`(ctx.foot.end("test"), L3.setState("playing"), true)`);
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await g(`(ctx.town.load("midwood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "midwood loads", 90000);
    // (in by its own exit, as she'd really come in: the ping's route starts from there)
    if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(6); }
    await g(`ctx.town.enter({ town: "midwood", exitS: ctx.town.exitOf("midwood", 0), speed: 0 })`);
    await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "in Midwood", 30000);
    await t.frames(20);
    const T = id => g(`(() => { const t = ctx.pins.target(${JSON.stringify(id)}); return t && { kind: t.kind, d: Math.round(t.d), label: t.label, x: t.x, z: t.z, px: t.px, pz: t.pz, arrived: !!t.arrived }; })()`);
    const chipText = () => t.L(`[...document.querySelectorAll(".pin-chip, #hudObj, .hud-obj")].map(e => e.textContent).join(" | ")`);

    // ── 1. in Midwood: the whole route, pointing at the way out ──
    await g(`(ctx.pins.ping("hw:mazelati", { from: "test" }), true)`);
    await t.frames(20);
    let r = await T("hw:mazelati");
    t.check(`from Midwood: points at the exit, and says the whole route (${r && r.label} · ${r && r.d} m)`, !!r && r.kind === "exit" && /leave Midwood, then .* on the highway/.test(r.label), JSON.stringify(r));
    t.check("…the shorter way round: back the other way (2–4 km, not 13 km on round the loop)", !!r && /back the other way/.test(r.label) && r.d < 5000, JSON.stringify(r));
    const chip = await chipText();
    t.check(`the objective line says it in words (${chip.slice(0, 90)})`, /leave Midwood/.test(chip), chip);
    await t.shot("in-midwood");
    // Midwood → a Lakewood place, Midwood → JFK
    const lw = await T("lakewood:pizza"), jfk = await T("hw:jfk");
    t.check(`Midwood → Lakewood's pizza: the route to the Lakewood exit (${lw && lw.label})`, !!lw && lw.kind === "exit" && /leave Midwood, then .* to the Lakewood exit/.test(lw.label), JSON.stringify(lw));
    t.check(`Midwood → JFK: the route out of town and along the highway (${jfk && jfk.label})`, !!jfk && jfk.kind === "exit" && /leave Midwood, then .* on the highway/.test(jfk.label), JSON.stringify(jfk));
    // from indoors (the bank in town: the town's own room) — the ping still knows the way
    const indoors = await g(`(() => { try { return ctx.interiors && ctx.interiors.bank ? true : false; } catch (e) { return false; } })()`);
    if (indoors) {
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000);
      const ok = await g(`(() => { const sp = ctx.town.spot("bank"); if (!sp) return false; const F = ctx.foot.debug.F; F.pos.set(sp.x, 0.05, sp.z); return true; })()`);
      if (ok) {
        await g(`ctx.interiors.bank.enter({ exit: () => L3.setState("footRun", { resume: "interior" }), door: "bank", from: "foot" })`);
        if (await t.until(`__lulu3d.state === "interior"`, "inside the bank", 60000)) {
          const ri = await T("hw:mazelati");
          t.check(`indoors: the ping still knows the way (${ri && ri.label})`, !!ri && /leave Midwood/.test(ri.label), JSON.stringify(ri));
          await g(`(window.__interiors && __interiors.room && __interiors.room.leave(), true)`);
          for (let i = 0; i < 20 && await t.L(`__lulu3d.state`) !== "footRun"; i++) await t.tap(0);
          await t.until(`__lulu3d.state === "footRun"`, "out of the bank", 30000);
        }
      }
      await g(`(ctx.foot.end("test"), L3.setState("playing"), true)`);
      await t.frames(6);
    }

    // ── 2. on the highway just past Midwood's on-ramp, heading up the lap: "turn around", pointing BACK ──
    await g(`(ctx.town.leave("highway"), true)`);
    await t.frames(10);
    const hw = s => g(`(() => { const c = ctx.car, p = ctx.world.road.point(${s}, ${3.5}, {}); c.place(p.x, p.z, p.h); c.s = ${s}; c.d = 3.5; c.vx = c.vz = 0; ctx.cam.snap(); return true; })()`);
    const exitS = await g(`ctx.town.exitOf("midwood", 0)`);
    await hw(exitS + 300); await t.frames(10);
    r = await T("hw:mazelati");
    const dot = await g(`(() => { const t = ctx.pins.target("hw:mazelati"), c = ctx.car; return (t.x - c.pos.x) * Math.sin(c.h) + (t.z - c.pos.z) * Math.cos(c.h); })()`);
    t.check(`on the highway, facing away from it: "turn around", the pointer BEHIND her (${r && r.label} · ${r && r.d} m · ${dot.toFixed(0)})`, !!r && r.kind === "road" && r.label === "turn around" && dot < 0, JSON.stringify(r));
    // turned round on the far carriageway (legal now): "back down the highway", pointing ahead of her, counting down
    await g(`(() => { const c = ctx.car, p = ctx.world.road.point(c.s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.d = -5.25; ctx.cam.snap(); return true; })()`);
    await t.frames(10);
    r = await T("hw:mazelati");
    const dot2 = await g(`(() => { const t = ctx.pins.target("hw:mazelati"), c = ctx.car; return (t.x - c.pos.x) * Math.sin(c.h) + (t.z - c.pos.z) * Math.cos(c.h); })()`);
    t.check(`turned round: "back down the highway", the pointer AHEAD of her (${r && r.label} · ${dot2.toFixed(0)})`, !!r && r.label === "back down the highway" && dot2 > 0, JSON.stringify(r));
    const d0 = r.d;
    await g(`(() => { const c = ctx.car, s = c.s - 1500, p = ctx.world.road.point(s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.s = s; c.d = -5.25; ctx.cam.snap(); return true; })()`);
    await t.frames(10);
    r = await T("hw:mazelati");
    t.check(`…the distance counts down (${d0} → ${r && r.d} m)`, !!r && r.d < d0 - 1000);
    // ── 3. within 1.2 km: the beam stands over the showroom itself (its side of the road, 30 m off) ──
    await g(`(() => { const c = ctx.car, s = 800 + 900, p = ctx.world.road.point(s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.s = s; c.d = -5.25; ctx.cam.snap(); return true; })()`);
    await t.frames(20);
    const bd = await g(`(() => { const t = ctx.pins.target("hw:mazelati"), q = ctx.world.road.point(800, 30, {}); return t && t.px != null ? Math.round(Math.hypot(t.px - q.x, t.pz - q.z)) : -1; })()`);
    t.check(`0.9 km out: the beam stands over Mazelati itself (${bd} m from it)`, bd >= 0 && bd < 5);
    await t.shot("beam-mazelati");
    // ── 4. at the door: arrived, the ping clears ──
    await g(`(() => { const c = ctx.car, p = ctx.world.road.point(800, 12, {}); c.place(p.x, p.z, p.h); c.s = 800; c.d = 12; ctx.cam.snap(); return true; })()`);
    await t.frames(30);
    t.check("at Mazelati: arrived — the ping clears itself", await g(`ctx.pins.current == null`), await g(`ctx.pins.current`));

    // (a teleported test car sits still, so the test says which way she's going — app.js sets world.dir from her velocity
    //  along the road when she really drives)
    // ── 5. signs facing the far carriageway (ci/twoway: "there's also no signs facing that direction") ──
    const cam = (sx, d, look) => g(`(() => { const a = ctx.world.road.point(${sx}, ${d}, {}), b = ctx.world.road.point(${look}, -11, {}), c = ctx.camera; window.__camAt = [a.x, 3.2, a.z, b.x, 2.6, b.z];
      const r = L3.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (sc, cm) => { const V = window.__camAt; if (V && cm === c) { cm.position.set(V[0], V[1], V[2]); cm.lookAt(V[3], V[4], V[5]); cm.updateMatrixWorld(); } o(sc, cm); }; } return true; })()`);
    // a place's board (Trooper Post 7's, 6.8 km), 190 m before it going DOWN the lap, on that side, facing those drivers
    await g(`(() => { const c = ctx.car, s = 7300, p = ctx.world.road.point(s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.s = s; c.d = -5.25; c.vx = -Math.sin(p.h) * 12; c.vz = -Math.cos(p.h) * 12; c.vF = 12; ctx.world.dir = -1; ctx.cam.snap(); return true; })()`);
    await t.frames(60);
    const ahead = await g(`[...ctx.world.activeChunks()].filter(c => c.s1 <= ctx.car.s - 200).length`);
    t.check(`going down the lap, the world is built ahead of her that way (${ahead} chunks)`, ahead >= 2);
    const placeSign = await g(`(() => { const s = 6990, h = ctx.world.road.at(s).h; let best = null;
      for (const ch of ctx.world.activeChunks()) for (const o of ch.group.children) { if (!o.isGroup) continue; const q = ctx.world.road.nearest(o.position.x, o.position.z, s, {});
        if (Math.abs(q.s - s) < 3 && q.d < -8 && q.d > -40) { const dh = Math.atan2(Math.sin(o.rotation.y - h), Math.cos(o.rotation.y - h)); best = { d: +q.d.toFixed(1), dh: +dh.toFixed(2) }; } }
      return best; })()`);
    t.check(`Trooper Post 7's board for drivers going the other way: 190 m before it their way, on their side, facing them (${JSON.stringify(placeSign)})`, !!placeSign && Math.abs(placeSign.dh) < 0.2);
    await cam(7040, -6, 6985); await t.frames(4); await t.shot("sign-place-other-way"); await t.L(`window.__camAt = null`);
    // the distance boards + "exit on the other side" boards, going down the lap past JFK
    await g(`(() => { const c = ctx.car, s = 9000, p = ctx.world.road.point(s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.s = s; c.d = -5.25; c.vx = -Math.sin(p.h) * 12; c.vz = -Math.cos(p.h) * 12; c.vF = 12; ctx.world.dir = -1; ctx.cam.snap(); return true; })()`);
    await t.frames(150);
    const back = await g(`ctx.world.signs.filter(x => x.back).map(x => ({ s: Math.round(x.s), lines: x.lines.join(" / ") }))`);
    console.log("   BACK SIGNS", JSON.stringify(back));
    t.check(`going down the lap: a green distance board facing her (the next places her way, in miles)`, back.some(b => / MI/.test(b.lines)), JSON.stringify(back));
    t.check(`…and a board saying a place's exit is on the other side`, back.some(b => /EXIT ON THE OTHER SIDE/.test(b.lines)), JSON.stringify(back));
    const xs = back.find(b => /EXIT ON THE OTHER SIDE/.test(b.lines)), ds = back.find(b => / MI/.test(b.lines));
    if (xs) { await g(`(() => { const c = ctx.car, s = ${xs.s + 150}, p = ctx.world.road.point(s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.s = s; c.d = -5.25; c.vx = -Math.sin(p.h) * 12; c.vz = -Math.cos(p.h) * 12; c.vF = 12; ctx.world.dir = -1; ctx.cam.snap(); return true; })()`); await t.frames(40); await cam(xs.s + 60, -6, xs.s); await t.frames(4); await t.shot("sign-exit-other-side"); }
    if (ds) { await g(`(() => { const c = ctx.car, s = ${ds.s + 150}, p = ctx.world.road.point(s, -5.25, {}); c.place(p.x, p.z, p.h + Math.PI); c.s = s; c.d = -5.25; c.vx = -Math.sin(p.h) * 12; c.vz = -Math.cos(p.h) * 12; c.vF = 12; ctx.world.dir = -1; ctx.cam.snap(); return true; })()`); await t.frames(40); await cam(ds.s + 60, -6, ds.s); await t.frames(4); await t.shot("sign-distance-other-way"); }
    await t.L(`window.__camAt = null`);
  },
};
