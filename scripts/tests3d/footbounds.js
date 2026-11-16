// On foot, but not forever: the soft world edges + the gentle nudges back into a car
// (features/foot/bounds.js).
//   · run straight out into the fields: tall grass slows her, then the mud, and at the
//     fence line a goose turns her back — she never crosses the fence, never stands still
//     grinding against it (a per-frame probe: position keeps changing, no big jumps)
//   · keep pushing along the fence: she slides along it, and the critters keep coming
//   · a long aimless walk → sore feet (slower) + a bench; then Ima texts; the nudges are
//     rate-limited (NUDGE.gap); then a ride pulls onto the shoulder and ✋ HOP IN drives it
//   · walking down the lanes → a cop's "Ma'am, this is a HIGHWAY" → a mild JAYWALKING warrant
//   · none of it during a foot chase (no slow-down, no shoo, no nudges — the fence still holds)
//     or inside an interior (the clock doesn't run), nor in the town (ctx.town.active)
const PROBE = `(() => {
  const L3 = window.__lulu3d, ctx = L3.ctx;
  const P = window.__fb = { maxStep: 0, stuck: 0, maxStuck: 0, frames: 0, maxD: 0, on: true };
  let last = null, lf = -1;
  const tick = () => {
    if (!P.on) return;
    requestAnimationFrame(tick);
    if (ctx.frames === lf) return;
    lf = ctx.frames;
    const F = ctx.foot.debug.F;
    if (!F || ctx.state !== "footRun" || F.phase !== "walk") { last = null; P.stuck = 0; return; }
    const push = Math.hypot(__pad.axes[0], __pad.axes[1]) > 0.5;
    if (last) {
      const st = Math.hypot(F.pos.x - last.x, F.pos.z - last.z);
      P.frames++;
      if (st > P.maxStep) P.maxStep = st;
      if (push && st < 0.004) { P.stuck++; P.maxStuck = Math.max(P.maxStuck, P.stuck); } else P.stuck = 0;
    }
    P.maxD = Math.max(P.maxD, Math.abs(F.d));
    last = { x: F.pos.x, z: F.pos.z };
  };
  requestAnimationFrame(tick);
  return true;
})()`;

const RUN = 7.6, WALK = 3.4;

module.exports = {
  name: "footbounds",
  query: "&enable=foot,footbounds",
  save2d: { totalCoins: 100, footRunsPlayed: 2, wanted: [] },
  async run(t) {
    const g = t.game;
    const B = k => g(`ctx.foot.bounds.state && ctx.foot.bounds.state.${k}`);
    const sample = () => g(`(() => { const F = ctx.foot.debug.F, b = F && F.bx; return F ? { d: +F.d.toFixed(2), s: +F.s.toFixed(2), v: +Math.hypot(F.vel.x, F.vel.z).toFixed(2),
      zone: b && b.zone, shoo: b && b.shoo ? b.shoo.kind : null, shoos: b ? b.shoos : 0, phase: F.phase } : null; })()`);
    // put her at (s, d) on the road frame, standing still, nothing in the way
    const place = (d, ds = 0) => g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, s = F.s + ${ds}, p = r.point(s, ${d}, {});
      F.pos.set(p.x, 0, p.z); F.vel.set(0, 0, 0); F.s = s; F.d = ${d}; F.behindT = 1e9; ctx.traffic.clear();
      F.peds.forEach(x => x.s += 400); F.animals.forEach(a => a.s += 400); return true; })()`);
    // a stretch of road whose right-hand side is clear of houses / trees all the way out to the fence
    // (so running straight out never runs into a house — that's collision, not the soft edge)
    const clearS = () => g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, cols = [];
      for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders) { if (c.off) continue; const n = r.nearest(c.x, c.z, F.s, {}); if (n.d > 7 && n.d < 56) cols.push([n.s, c.r]); }
      for (let ds = 10; ds < 170; ds += 2) { const s = F.s + ds; if (cols.every(([cs, cr]) => Math.abs(cs - s) > cr + 1.6)) return ds; }
      return 10; })()`);
    const prompt = () => t.L(`(document.querySelector("#slot-bottom .prompt") || {}).textContent || ""`);
    t.check("ctx.foot.bounds is exposed", await g(`!!(ctx.foot.bounds && ctx.foot.bounds.EDGE && ctx.foot.bounds.NUDGE)`));
    const EDGE = await g(`ctx.foot.bounds.EDGE`);

    // ── on foot, on a quiet road ──
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "drive starts")) return;
    await t.frames(20);
    await g(`(ctx.traffic.clear(), ctx.traffic.config.enabled = false, ctx.foot.start("droveOff", { noIntro: true }))`);
    if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot")) return;
    // test-speed knobs: a short gap between nudges
    await g(`(ctx.foot.bounds.NUDGE.gap = 6, ctx.foot.bounds.debug.aim(0), true)`);
    await t.until(`(() => { const v = __lulu3d.ctx.foot.bounds.visuals; return v && v.fence > 20 && v.grass > 40 && v.mud > 8 && v.shown; })()`, "the fence line, tall grass and mud are laid out around her", 60000);
    t.check("the field scenery is laid out (fence / grass / mud)", await g(`(() => { const v = ctx.foot.bounds.visuals; return !!v && v.fence > 20 && v.grass > 40 && v.mud > 8; })()`),
      JSON.stringify(await g(`ctx.foot.bounds.visuals`)));

    // ── 1. run straight out into the fields ──
    await place(9.5, await clearS());
    await t.frames(10);
    await place(9.5, await clearS());   // (again, once the chunks round her new spot are built)
    await t.frames(4);
    await t.L(PROBE);
    await t.stick(1, 0); await t.hold(5, 1);
    const log = [];
    for (let i = 0; i < 75; i++) {
      await t.frames(5);
      const smp = await sample();
      log.push(smp);
      if (smp.zone === "grass" && !log.shotGrass && smp.d > 34) { log.shotGrass = true; await t.shot("tall-grass"); }
      if (smp.zone === "mud" && !log.shotMud && smp.d > 44) { log.shotMud = true; await t.shot("mud"); }
      if (smp.shoo === "goose" && !log.shotGoose) { log.shotGoose = true; await t.frames(10); await t.shot("goose"); }
      if (log.shotGoose && smp.shoos >= 2 && i > 40) break;
    }
    const verge = log.filter(x => x.zone === "verge" && !x.shoo && x.d > 15 && x.d < 27).map(x => x.v);
    const grass = log.filter(x => x.zone === "grass" && !x.shoo && x.d > 36.5).map(x => x.v);
    const mud = log.filter(x => x.zone === "mud" && !x.shoo && x.d > 45.5).map(x => x.v);
    const avg = a => a.length ? a.reduce((p, c) => p + c, 0) / a.length : NaN;
    t.check("full sprint on the verge", avg(verge) > RUN * 0.9, `${avg(verge).toFixed(2)} m/s`);
    t.check("tall grass slows her (~70%)", avg(grass) < RUN * 0.8 && avg(grass) > RUN * 0.55, `${avg(grass).toFixed(2)} m/s`);
    t.check("the mud slows her more (~45%)", avg(mud) < RUN * 0.55, `${avg(mud).toFixed(2)} m/s`);
    const first = log.findIndex(x => x.shoo);
    t.check("at the fence line something turns her back — a goose first", first >= 0 && log[first].shoo === "goose", first >= 0 ? JSON.stringify(log[first]) : "no shoo");
    t.check("the goose is out there", await g(`!!(ctx.foot.bounds.state.critter || ctx.foot.bounds.state.shoos > 1)`));
    if (first >= 0) {
      const after = log.slice(first, first + 8);
      const dMin = Math.min(...after.map(x => x.d));
      t.check("…and she turns and runs back toward the road (≥ 3 m)", log[first].d - dMin > 3, `${log[first].d} → ${dMin}`);
    }
    t.check("she keeps getting turned back as long as she pushes out", (await B("shoos")) >= 2, `${await B("shoos")} shoos`);
    let P = await t.L(`({ ...window.__fb })`);
    t.check("never past the fence", P.maxD < EDGE.fence, `max |d| ${P.maxD.toFixed(2)} (fence ${EDGE.fence})`);
    t.check("no grinding: her position keeps changing while she pushes (≤ 2 still frames)", P.maxStuck <= 2, JSON.stringify(P));
    t.check("smooth: no teleport-y jumps (≤ sprint step)", P.maxStep < RUN / 30 * 1.5, `${P.maxStep.toFixed(3)} m/frame`);

    // ── 2. push diagonally along the fence: she slides along it, no wall to grind on ──
    await t.L(`Object.assign(window.__fb, { maxStep: 0, stuck: 0, maxStuck: 0, maxD: 0 })`);
    await place(48.5);
    await t.frames(3);
    await t.L(`Object.assign(window.__fb, { maxStep: 0, stuck: 0, maxStuck: 0, maxD: 0 })`);
    const s0 = (await sample()).s;
    await t.stick(0.7, -0.7);
    await t.frames(90);
    await t.shot("fence-line");
    await t.frames(60);
    const s1 = (await sample()).s;
    P = await t.L(`({ ...window.__fb })`);
    t.check("pushing along the fence she still makes progress down the road", s1 - s0 > 4, `${(s1 - s0).toFixed(1)} m`);
    t.check("…still never past the fence, never stuck", P.maxD < EDGE.fence && P.maxStuck <= 2, JSON.stringify(P));
    t.check("the critters rotate (goose → sprinkler → dog → mosquitoes)", (await B("shooN")) >= 2, `shooN ${await B("shooN")}`);
    await t.stick(0, 0); await t.hold(5, 0);
    await t.frames(40);

    // ── 3. the town / a party: none of it (the old far fence) ──
    if (!await g(`!!ctx.town`)) {
      await g(`(ctx.town = { active: true }, true)`);
      await place(38);
      await t.stick(1, 0); await t.hold(5, 1);
      await t.frames(20);
      const tw = await sample();
      t.check("in the town: no tall-grass slow-down, no field scenery", tw.v > RUN * 0.9 && !(await g(`ctx.foot.bounds.visuals.shown`)), JSON.stringify(tw));
      await t.stick(0, 0); await t.hold(5, 0);
      await g(`(delete ctx.town, true)`);
      await t.frames(10);
      t.check("…back out of the town: the fields come back", await g(`ctx.foot.bounds.visuals.shown`));
    } else t.check("(ctx.town is real here — town guard covered by its own tests)", true);

    // ── 4. a long aimless walk: sore feet → Ima → a ride, rate-limited ──
    await place(9.6);
    await g(`(ctx.foot.bounds.state.gapT = 0, ctx.foot.bounds.debug.aim(0), true)`);
    await t.frames(60);
    const aim2 = await B("aim");
    t.check("standing about on the shoulder, the aimless clock runs (~1 s per s)", aim2 > 1.4 && aim2 < 2.6, `${aim2.toFixed(2)} s after 60 frames`);
    await g(`(ctx.foot.bounds.debug.aim(ctx.foot.bounds.NUDGE.feet - 1), true)`);
    await t.until(`__lulu3d.ctx.foot.bounds.state.count >= 1`, "a long idle → the first nudge", 30000);
    t.check("first nudge: sore feet", (await B("log")).join() === "feet" && await B("sore"), JSON.stringify(await B("log")));
    t.check("a bench turns up on the verge", await g(`!!ctx.foot.bounds.state.bench`));
    await t.frames(50);
    t.check("the ON FOOT chip says so", /sore feet/.test(await t.L(`(document.querySelector(".foot-chip") || {}).textContent || ""`)));
    await t.stick(0, -1);
    await t.frames(30);
    const sv = (await sample()).v;
    await t.stick(0, 0);
    t.check("sore feet: she walks slower", sv < WALK * 0.85 && sv > WALK * 0.6, `${sv.toFixed(2)} m/s (walk ${WALK})`);
    await t.shot("sore-feet");
    // rate limit: way past the next thresholds, but the gap holds the next nudge back
    await g(`(ctx.foot.bounds.state.gapT = 6, ctx.foot.bounds.debug.aim(ctx.foot.bounds.NUDGE.ima + 5), true)`);
    await t.frames(90);   // 3 s < gap
    t.check("nudges are rate-limited (nothing new inside the gap)", (await B("count")) === 1, `count ${await B("count")}`);
    await t.until(`__lulu3d.ctx.foot.bounds.state.count >= 2`, "after the gap: the next nudge", 30000);
    t.check("then Ima texts", (await B("log"))[1] === "ima" && /IMA/.test(await t.L(`[...document.querySelectorAll(".jtext")].map(e => e.textContent).join(" ")`)),
      await t.L(`[...document.querySelectorAll(".jtext")].map(e => e.textContent).join(" | ")`));
    await t.shot("ima-texts");
    // the bench: ✋ SIT
    await g(`(() => { const F = ctx.foot.debug.F, b = ctx.foot.bounds.state.bench; F.pos.set(b.sx, 0, b.sz); F.vel.set(0, 0, 0); ctx.foot.bounds.state.gapT = 99; return true; })()`);
    await t.frames(4);
    t.check("prompt offers 🪑 SIT", /SIT/.test(await prompt()), await prompt());
    await t.tap(0);
    await t.until(`__lulu3d.ctx.foot.phase === "script"`, "she sits down", 10000);
    await t.frames(40);
    await t.shot("bench");
    await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "…and gets back up", 20000);
    t.check("a sit fixes her feet", !(await B("sore")));
    // a ride pulls up
    await place(9.6);
    await g(`(ctx.foot.bounds.state.gapT = 0, ctx.foot.bounds.debug.aim(ctx.foot.bounds.state.next + 1), true)`);
    await t.until(`__lulu3d.ctx.foot.bounds.state.count >= 3`, "the third nudge", 30000);
    t.check("third nudge: a ride", (await B("log"))[2] === "ride" && await g(`!!ctx.foot.bounds.state.ride`), JSON.stringify(await B("log")));
    if (await t.until(`(() => { const r = __lulu3d.ctx.foot.bounds.state.ride; return r && r.phase === "wait"; })()`, "the ride pulls onto the shoulder beside her", 40000)) {
      const where = await g(`(() => { const r = ctx.foot.bounds.state.ride, F = ctx.foot.debug.F; return { dd: Math.abs(r.car.d), ds: Math.abs(r.car.s - F.s), kind: r.kind }; })()`);
      t.check("…stopped on the shoulder, right by her", where.dd > 7 && where.dd < 8.8 && where.ds < 40, JSON.stringify(where));
      await g(`(() => { const r = ctx.foot.bounds.state.ride, F = ctx.foot.debug.F, p = ctx.world.road.point(r.car.s, Math.sign(r.car.d) * 9.6, {}); F.pos.set(p.x, 0, p.z); return true; })()`);
      await t.frames(6);
      t.check("prompt offers HOP IN", /HOP (IN|ON)/.test(await prompt()), await prompt());
      await t.shot("ride");
      await t.tap(0);
      if (await t.until(`__lulu3d.state === "playing"`, "✋ hops in and drives off", 20000)) {
        t.check("✋ hops in and drives off", await g(`!ctx.foot.active && !!ctx.G.borrowed`), await g(`ctx.G.borrowed`));
      }
    }

    // ── 5. jaywalking down the lanes ──
    await g(`(ctx.traffic.clear(), ctx.foot.start("droveOff", { noIntro: true }))`);
    if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "back on foot")) return;
    await g(`(Object.assign(ctx.foot.bounds.NUDGE, { laneWarn: 3, laneStar: 3, gap: 4 }), ctx.foot.bounds.debug.aim(0), true)`);
    await place(3.5);
    await t.stick(0, -0.45);
    for (let i = 0; i < 60 && !(await g(`!!(ctx.foot.bounds.state.cop && ctx.foot.bounds.state.cop.phase === "wait")`)); i++) {
      await t.frames(10);
      await g(`(() => { const F = ctx.foot.debug.F; if (Math.abs(F.d - 3.5) > 0.3) { const p = ctx.world.road.point(F.s, 3.5, {}); F.pos.set(p.x, 0, p.z); } F.behindT = 1e9; ctx.G.invT = 5; return true; })()`);
    }
    t.check("walking down the lanes: a cop pulls up — Ma'am, this is a HIGHWAY", await g(`!!ctx.foot.bounds.state.cop && ctx.foot.bounds.state.warned`));
    await t.frames(8);
    await t.shot("cop-warning");
    for (let i = 0; i < 40 && !(await B("starred")); i++) {
      await t.frames(10);
      await g(`(() => { const F = ctx.foot.debug.F; const p = ctx.world.road.point(F.s, 3.5, {}); F.pos.set(p.x, 0, p.z); ctx.G.invT = 5; return true; })()`);
    }
    t.check("…keep at it: a mild ★ (a JAYWALKING warrant)", await B("starred") && await g(`!ctx.law || ctx.law.warrants.includes("JAYWALKING")`), JSON.stringify(await g(`ctx.law && ctx.law.warrants`)));
    await t.stick(0, 0);
    await t.L(`import("./js/core/save.js").then(m => (m.shared.update(s => { s.wanted = []; }), true))`);
    await g(`(ctx.traffic.clear(), true)`);

    // ── 6. a foot chase: chases keep their own rules ──
    await place(9.5, await clearS());
    await t.frames(10);
    await place(9.5, await clearS());
    await g(`(Object.assign(ctx.foot.bounds.NUDGE, { gap: 6, laneWarn: 10, laneStar: 12 }), true)`);
    // (atomically: the clock is way past due, and the chase starts in the same frame)
    const pre = await g(`(() => { const b = ctx.foot.bounds.state; b.gapT = 0; b.aim = 500; const ok = !!ctx.foot.debug.startChase(); return { ok, count: b.count, shoos: b.shoos }; })()`);
    const c0 = pre.count, sh0 = pre.shoos;
    t.check("a foot chase starts", pre.ok);
    await t.L(`Object.assign(window.__fb, { maxStep: 0, stuck: 0, maxStuck: 0, maxD: 0 })`);
    await t.stick(1, 0); await t.hold(5, 1);
    const clog = [];
    for (let i = 0; i < 60; i++) {
      await t.frames(5);
      // keep the cop on her heels (so the chase doesn't end while we look)
      await g(`(() => { const F = ctx.foot.debug.F, ch = F && F.chase; if (!ch) return false; ch.escapeT = 0; ch.giveUp = 0; const p = ch.p.obj.position;
        const dx = p.x - F.pos.x, dz = p.z - F.pos.z, l = Math.hypot(dx, dz) || 1; if (l > 12 || l < 8) { p.x = F.pos.x + dx / l * 10; p.z = F.pos.z + dz / l * 10; } return true; })()`);
      clog.push(await sample());
      if (i === 30) await t.shot("chase-in-the-field");
    }
    const cg = clog.filter(x => Math.abs(x.d) > 36.5 && Math.abs(x.d) < 41).map(x => x.v);
    t.check("chase: no tall-grass slow-down (chases keep their rules)", cg.length > 0 && avg(cg) > RUN * 0.88, `${avg(cg).toFixed(2)} m/s`);
    t.check("chase: no shoo, no nudges", (await B("shoos")) === sh0 && (await B("count")) === c0, `shoos ${sh0}→${await B("shoos")}, nudges ${c0}→${await B("count")}`);
    P = await t.L(`({ ...window.__fb })`);
    t.check("chase: the fence still holds (smoothly)", P.maxD < EDGE.fence && P.maxStep < RUN / 30 * 1.5, JSON.stringify(P));
    await t.stick(0, 0); await t.hold(5, 0);
    await g(`(() => { const F = ctx.foot.debug.F; if (F.chase) { ctx.scene.remove(F.chase.p.obj); F.chase = null; } return true; })()`);

    // ── 7. inside an interior the clock doesn't run ──
    await g(`(() => { window.__inside = 0; ctx.interiors.bar = { name: "The Thirsty Scholar", emoji: "🍺", enter({ exit }) { window.__inside++; window.__exitBar = exit; } }; return true; })()`);
    const door = await g(`ctx.foot.debug.nextDoorAt(ctx.foot.debug.F.s, "bar")`);
    if (door) {
      await g(`(() => { const F = ctx.foot.debug.F, r = ctx.world.road, p = r.point(${door.s} - 40, ${door.side} * 9.5, {}); F.pos.set(p.x, 0, p.z); F.s = ${door.s} - 40; ctx.traffic.clear(); return true; })()`);
      await t.until(`__lulu3d.ctx.foot.debug.allDoors().some(d => d.id === "bar")`, "the block with the bar is built", 60000);
      await g(`(() => { const F = ctx.foot.debug.F, d = ctx.foot.debug.allDoors().find(d => d.id === "bar"); const r = ctx.world.road, p = r.point(d.s, d.side * (Math.abs(d.d) - 0.6), {});
        F.pos.set(p.x, 0, p.z); F.s = d.s; F.peds.forEach(x => x.s += 300); ctx.foot.bounds.state.gapT = 0; return true; })()`);
      await t.frames(5);
      await t.tap(0);
      await t.until(`window.__inside === 1`, "✋ walks into the bar", 20000);
      const in0 = await g(`({ aim: ctx.foot.bounds.state.aim, count: ctx.foot.bounds.state.count })`);
      await t.frames(120);
      const in1 = await g(`({ aim: ctx.foot.bounds.state.aim, count: ctx.foot.bounds.state.count })`);
      t.check("inside an interior: no nudges, the clock is paused", in1.count === in0.count && Math.abs(in1.aim - in0.aim) < 0.01, `${JSON.stringify(in0)} → ${JSON.stringify(in1)}`);
      await t.L(`window.__exitBar()`);
      await t.frames(8);
      t.check("back outside: walking again", await g(`ctx.state === "footRun" && ctx.foot.phase === "walk"`));
    } else t.check("Main Street has a bar ahead", false);

    await t.L(`window.__fb.on = false`);
  },
};
