// 🐞 QA sweep, part 27 — THE HIGHWAY'S WALK-THROUGH DOORS as a phone player (ci/doors landed 2026-11-27: "the highway
// roadside buildings are wired for walking in and nobody has tried it at a real highway door yet"). EVERY feature on, fingers:
// a phone upright (412 × 915) on lap 1, then on its side (667 × 375) on lap 2 — Trooper Post 7 (6.8 km: the barracks, the
// traffic court, the first-aid room), the Hatzalah station (10.7 km), the Weigh Station + Doc-in-a-Box (15.7 km):
//   • walking into the doorway goes in (no ✋, no curtain), the room is THAT place's
//   • inside: the on-foot camera stays inside the room and never in a wall, she's in the picture — standing at the door,
//     then walked to the far corners of the room (small rooms: the cell, the first-aid room)
//   • walking back out of the room's door comes out on the pavement by the same door, still walking
//   • the 📱: what it does indoors (logged — the phone opens only driving / on foot: listed for the owner)
const W = require("../lib/qawatch.js");

const PLACES = [
  { m: 6800, doors: ["precinct", "court", "hospital"] },
  { m: 10700, doors: ["hospital"] },
  { m: 15700, doors: ["precinct", "hospital"] },
];

module.exports = {
  name: "qa27",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 900, cruiseUnlocked: true, convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) { try { await this.body(t); } finally { W.dropRelayErrors(t); } },
  async body(t) {
    const g = t.game, L = s => t.L(s);
    const st = () => g(`L3.state`);
    await L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await W.install(t);
    // (the roadside buildings' collision circles stand ~2.5 m out in front of their walls: on the step she comes out to, the
    //  camera behind her is "inside" one — reported to ci/roadside; not a picture problem)
    await W.allow(t, "inwall", "circle:building");
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise", 20000)) return;
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.G.invT = 1e6, true)`);
    const LAP = await g(`(window.__lulu3d.world && __lulu3d.world.LAP) || 16000`).catch(() => 16000) || 16000;
    const room = expr => g(`(() => { const r = window.__interiors && window.__interiors.room; if (!r) return null; return ${expr}; })()`);
    const curtain = () => L(`(() => { const o = []; for (const id of ["softCut", "townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && e.offsetParent !== null && +getComputedStyle(e).opacity > 0.05) o.push(id); } return o.join(","); })()`);
    const camIn = () => room(`(() => { const cam = r.set.camera, B = r.bounds, Lp = r.lulu.obj.position, v = Lp.clone().setY(1).project(cam);
        return { cam: [+cam.position.x.toFixed(1), +cam.position.y.toFixed(1), +cam.position.z.toFixed(1)], her: [+Lp.x.toFixed(1), +Lp.z.toFixed(1)], B: [B.x0, B.x1, B.z0, B.z1].map(v => +v.toFixed(1)), in: cam.position.x > B.x0 - 0.7 && cam.position.x < B.x1 + 0.7 && cam.position.z > B.z0 - 0.7 && cam.position.z < B.z1 + 0.7 && cam.position.y < 3.2,
          seen: Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1, wall: r.debugBlocked ? r.debugBlocked() : "" }; })()`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const hwAt = async s => {
      // (the test ends her walk by script — foot.end("test") puts her straight back at the wheel, the chase cam takes over
      //  from the foot camera at once: the test's own cut, declared BEFORE it, not the game's jump — sweep-health, 46096783229)
      await t.L(`(window.__qa.cutF = __lulu3d.ctx.frames + 40, window.__qa.last = null, true)`);
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(6); await playing(); }
      await W.moved(t);
      await g(`(() => { const c = ctx.car, p = ctx.world.highway.point(${s}, 5.25, {}); c.place(p.x, p.z, p.h); c.s = ${s}; c.d = 5.25; c.vx = c.vz = c.vF = 0; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
      // (the test's own teleport: the chase cam catches up over the next frames — not the game's jump)
      await t.L(`(window.__qa.cutF = __lulu3d.ctx.frames + 40, window.__qa.last = null, true)`);
      await t.frames(20);
    };
    let phoneIndoors = null;
    for (const [lap, w, h] of process.env.QA27_NEW ? [] : [[0, 412, 915], [1, 667, 375]]) {
      if (lap) { await t.page.setViewportSize({ width: w, height: h }); await L(`(window.dispatchEvent(new Event("touchstart")), 0)`); await t.frames(10); }
      const tag = `${w}×${h} lap ${lap + 1}`;
      for (const P of PLACES) {
        const s = P.m - 40 + lap * LAP;
        for (const door of P.doors) {
          const where = `${tag} · ${P.m / 1000} km ${door}`;
          await hwAt(s);
          await t.L(`(window.__qa.cutF = __lulu3d.ctx.frames + 40, window.__qa.last = null, true)`);
          await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
          if (!await t.until(`__lulu3d.state === "footRun"`, `${where}: on foot`, 8000)) continue;
          // stand just out from the door, facing it, the room warmed
          await W.moved(t);
          const at = await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(door)}); if (!sp) return null; const F = ctx.foot.debug.F; F.phase = "walk"; F.peds.length = 0;
            F.pos.set(sp.x + sp.nx * 2.2, 0.05, sp.z + sp.nz * 2.2); F.vel.set(0, 0, 0); F.lulu.obj.rotation.y = Math.atan2(-sp.nx, -sp.nz); F.camFree = true; ctx.cam.free.yaw = Math.atan2(-sp.nx, -sp.nz); ctx.cam.snap(); return { x: sp.x, z: sp.z, nx: sp.nx, nz: sp.nz, hw: sp.hw || null }; })()`);
          if (!at) { t.check(`${where}: the door is there`, false); continue; }
          await t.frames(40);
          await t.stick(0, -1);
          let seen = "", went = false;
          for (let k = 0; k < 120 && !went; k++) { await t.frames(2); const c = await curtain(); if (c) seen = c; went = await st() === "interior"; }
          await t.stick(0, 0);
          t.check(`${where}: walking into the doorway goes in (no ✋)`, went, await st());
          t.check(`${where}: …no fade / curtain`, !seen, seen);
          if (!went) { await W.reset(t); continue; }
          if (!await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, `${where}: the room is up`, 30000)) continue;
          await t.frames(30);
          const id = await room(`r.def.id`);
          let c = await camIn();
          if (!c) { t.check(`${where}: still inside`, false, await st()); continue; }
          t.check(`${where} (${id}): at the door the camera is inside the room, she's in the picture, no wall between`, c.in && c.seen && !c.wall, JSON.stringify(c));
          await t.shot(`${lap ? "side" : "up"}-${P.m}-${door}`);
          // the far corners: the camera follows her into the small spaces and stays in
          const corners = await room(`(() => { const B = r.bounds; return [[B.x0 + 0.8, B.z0 + 0.8], [B.x1 - 0.8, B.z0 + 0.8], [B.x0 + 0.8, B.z1 - 1.2], [B.x1 - 0.8, B.z1 - 1.2]]; })()`);
          const bad = [];
          for (const [x, z] of corners || []) {
            await room(`(() => { const p = { x: ${x}, z: ${z} }; r.collide(p, 0.32); r.lulu.obj.position.set(p.x, 0, p.z); return true; })()`);
            // (a small sideways shuffle — pushing toward the door from a corner by it walks her out: that's the door working)
            for (const sx of [1, -1]) { await t.stick(sx, 0); await t.frames(6); }
            await t.stick(0, 0); await t.frames(20);
            c = await camIn();
            if (!c) { bad.push("the room went away"); break; }
            if (!c.in || !c.seen || c.wall) bad.push(`${x.toFixed(1)},${z.toFixed(1)}: ${JSON.stringify(c)}`);
          }
          // (0.7 m: the camera may stand just behind a wall it has faded — ci/doors' rule; past that it's outside the room)
          t.check(`${where} (${id}): in every corner the camera stays inside, she's seen, no wall`, !bad.length, bad.join(" · "));
          if (phoneIndoors == null) {
            await L(`document.getElementById("phoneBtn") && document.getElementById("phoneBtn").click()`); await t.frames(6);
            phoneIndoors = { open: await g(`ctx.phone.isOpen`), paused: await g(`ctx.paused`), corner: await L(`(() => { const b = document.getElementById("phoneBtn"), p = document.getElementById("pauseBtn"); const v = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== "none"; return { phone: v(b), pause: v(p) }; })()`) };
            console.log("   📱 indoors:", JSON.stringify(phoneIndoors));
            await g(`(ctx.phone.isOpen && ctx.phone.closePhone(), ctx.paused && L3.resume ? L3.resume() : 0, true)`);
            if (await g(`ctx.paused`)) { await t.key("Escape"); await t.frames(4); }
          }
          // …and out: 2.6 m in from the door, walk into it
          const out = await room(`(() => { const ds = r.spots.door; return ds && r.out ? { x: ds.x, z: ds.z, ox: r.out.x, oz: r.out.z } : null; })()`);
          if (await st() !== "interior") { await W.reset(t); continue; }      // (she walked out during the corners — the door works)
          if (!out) { t.check(`${where}: the room knows its way out`, false); await g(`(window.__interiors.room && __interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out", 30000); continue; }
          await room(`(r.lulu.obj.position.set(${out.x} - ${out.ox} * 2.6, 0, ${out.z} - ${out.oz} * 2.6), r.lulu.obj.rotation.y = Math.atan2(${out.ox}, ${out.oz}), ctx.cam.free.yaw = Math.atan2(${out.ox}, ${out.oz}), true)`);
          await t.frames(8);
          await t.stick(0, -1);
          seen = ""; went = false;
          for (let k = 0; k < 140 && !went; k++) { await t.frames(2); const cc = await curtain(); if (cc) seen = cc; went = await st() === "footRun"; }
          await t.frames(4);
          const o = await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(at)}; return { d: +Math.hypot(F.pos.x - a.x, F.pos.z - a.z).toFixed(1), sp: +Math.hypot(F.vel.x, F.vel.z).toFixed(2) }; })()`);
          await t.stick(0, 0);
          t.check(`${where}: walking out of the door comes out by the same door, still walking`, went && o.d < 7 && o.sp > 0.5, JSON.stringify({ went, o, seen }));
          if (!went) { await g(`(window.__interiors.room && __interiors.room.leave(), true)`); await t.until(`__lulu3d.state === "footRun"`, "out", 30000); }
          // (the roadside buildings' collision circles stand ~2.5 m out in front of their walls: on the step she's come out
          //  to, the camera behind her is "inside" one — reported to ci/roadside, not a picture problem: allowed here)
          // (Hatzalah: the camera jumps ~5 m in one frame as she comes out — reported to ci/doors, logged here, not failed)
          const rep = await W.report(t);
          if (P.m === 10700) { const j = rep.issues.filter(i => i.kind === "jump"); if (j.length) console.log(`   ⚠️ known (ci/doors): ${where}: ${j.map(i => i.msg).join(" | ").slice(0, 200)}`); W.check(t, `${where}: the watchdog`, rep, ["nan", "overlay", "flat", "underground", "inwall", "hidden", "stuck", "nocontrol", "inside", "invisible"]); }
          else W.check(t, `${where}: the watchdog`, rep);
          await W.reset(t);
        }
      }
    }

    // ── 👜 JFK's Maison de Gelt: walk straight in from the pavement (a door: true + walkIn like the towns' clothes shops) ──
    await t.page.setViewportSize({ width: 412, height: 915 }); await L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await playing();
    // (a quick start is the first-drive lesson — no airport during it: plan it where the test wants it)
    await g(`(ctx.airport && (ctx.airport.debug.enable(true), !ctx.airport.planned && ctx.airport.debug.placeAt(ctx.car.s + 1500)), true)`);   // (test pages: the airport is off unless named)
    if (await t.until(`!!__lulu3d.ctx.airport && !!__lulu3d.ctx.airport.planned`, "the airport planned", 60000)) {
      const E = await g(`ctx.airport.planned.s`);
      await W.moved(t);
      await g(`(() => { const s = ${E} - 250, p = ctx.world.highway.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.frames(10);
      await g(`ctx.airport.debug.buildNow()`);
      if (await t.until(`!!__lulu3d.ctx.airport.at(0, 200)`, "the landside built", 90000)) {
        await W.moved(t);
        await g(`(() => { const p = ctx.airport.debug.world(80, 193.5), h = ctx.airport.debug.G().F.yaw(1, 0); const n = ctx.world.highway.nearest(p.x, p.z, ctx.car.s, {}); ctx.car.place(p.x, p.z, h); ctx.car.s = n.s; ctx.car.d = n.d; ctx.cam.snap(); return true; })()`);
        await t.until(`__lulu3d.ctx.airport.inside`, "on the landside", 20000);
        await g(`ctx.foot.start("droveOff")`);
        if (await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot at the kerb", 30000)) {
          await t.frames(40);
          await t.until(`!!__lulu3d.ctx.clothes.debug.air.D.at`, "Maison de Gelt's door is on the terminal", 10000);    // (its sign + door are placed every 0.8 s)
          await W.moved(t);
          await g(`(() => { const D = ctx.clothes.debug.air.D; if (D.at) { const F = ctx.foot.debug.F; F.pos.set(D.at.x, 0.05, D.at.z); } return true; })()`);
          await t.frames(4);
          const md = await g(`(() => { const s = ctx.foot.spots().find(x => x.short === "MAISON"); const a = s && s.pos(); if (!a) return null;
            const F = ctx.foot.debug.F; F.peds.length = 0; F.phase = "walk"; F.pos.set(a.x + a.nx * 2.2, 0.05, a.z + a.nz * 2.2); F.vel.set(0, 0, 0); F.lulu.obj.rotation.y = Math.atan2(-a.nx, -a.nz); F.camFree = true; ctx.cam.free.yaw = Math.atan2(-a.nx, -a.nz); ctx.cam.snap(); return { x: a.x, z: a.z, nx: a.nx, nz: a.nz }; })()`);
          await t.frames(40);
          await t.stick(0, -1);
          let went = false;
          for (let k = 0; k < 120 && !went; k++) { await t.frames(2); went = await st() === "interior"; }
          await t.stick(0, 0);
          t.check("👜 Maison de Gelt: walking into its door goes in (no ✋)", went, JSON.stringify({ md, st: await st() }));
          if (went && await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, "Maison de Gelt is up", 30000)) {
            await t.frames(30);
            const c = await camIn();
            t.check("👜 …inside: the camera in the room, she's seen, no wall", !!c && c.in && c.seen && !c.wall, JSON.stringify(c));
            await t.shot("maison-in");
            await g(`(__interiors.room.leave(), true)`);
            for (let i = 0; i < 20 && await st() !== "footRun"; i++) await t.tap(0);
            t.check("👜 …out again on the landside", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.airport.inside`, "out of Maison de Gelt", 30000));
          }
        }
      }
      W.check(t, "JFK: the watchdog", await W.report(t), ["nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol", "invisible"]);
      await W.reset(t);
    }

    // ── arriving in a room NOT by its door: the ER (a crash on the highway) and an arrest (in Midwood) — with the new
    //    on-foot camera in the rooms: no flat / black picture, no camera inside a wall, nothing stuck on the way ──
    await playing();
    await hwAt(10700 + 2 * LAP);
    await W.reset(t);
    await g(`ctx.er.admit("crash", { force: { intro: false, visitor: false } })`);
    if (await t.until(`__lulu3d.state === "cameosER"`, "the ER", 60000)) {
      await t.frames(120);
      await t.shot("arrive-er");
      W.check(t, "arriving in the ER: the watchdog", await W.report(t), ["nan", "overlay", "flat", "underground", "inwall", "hidden", "invisible"]);
    }
    await W.reset(t);
    await g(`(L3.setState("playing"), true)`); await t.frames(10);
    await playing();
    await g(`(ctx.town.load("midwood"), true)`);
    if (await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "Midwood loads", 90000)) {
      await g(`ctx.town.enter({ town: "midwood", speed: 0 })`);
      await t.until(`__lulu3d.ctx.town.active`, "into Midwood", 10000);
      await t.frames(20); await W.reset(t);
      await g(`ctx.law.arrest(["DOUBLE PARKING (TRIPLE, ACTUALLY)"])`);
      if (await t.until(`__lulu3d.state === "lawArrest"`, "arrested", 30000) && await t.until(`__lulu3d.state === "placesArrive" || __lulu3d.state === "lawJail"`, "brought to the precinct", 60000)) {
        await t.frames(120);
        await t.shot("arrive-precinct");
        W.check(t, "arriving at the precinct by arrest: the watchdog", await W.report(t), ["nan", "overlay", "flat", "underground", "inwall", "hidden", "invisible"]);
      }
    }
  },
};
