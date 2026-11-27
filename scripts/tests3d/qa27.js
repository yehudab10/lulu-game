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
      await W.moved(t);          // (ending her walk by script is the test's own cut — ci/doors: this was the "Hatzalah jump")
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(6); await playing(); }
      await W.moved(t);
      await g(`(() => { const c = ctx.car, p = ctx.world.highway.point(${s}, 5.25, {}); c.place(p.x, p.z, p.h); c.s = ${s}; c.d = 5.25; c.vx = c.vz = c.vF = 0; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
      await W.moved(t);          // (…and the car put down at the next place: the test's teleport, the chase cam re-seats)
      await t.frames(20);
    };
    let phoneIndoors = null;
    for (const [lap, w, h] of [[0, 412, 915], [1, 667, 375]]) {
      if (lap) { await t.page.setViewportSize({ width: w, height: h }); await L(`(window.dispatchEvent(new Event("touchstart")), 0)`); await t.frames(10); }
      const tag = `${w}×${h} lap ${lap + 1}`;
      for (const P of PLACES) {
        const s = P.m - 40 + lap * LAP;
        for (const door of P.doors) {
          const where = `${tag} · ${P.m / 1000} km ${door}`;
          await hwAt(s);
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
          // (Hatzalah's walk-out jump — she was put back 0.7 m inside the building's collision circle — fixed in ci/doors: checked)
          const rep = await W.report(t);
          W.check(t, `${where}: the watchdog`, rep);
          await W.reset(t);
        }
      }
    }
  },
};
