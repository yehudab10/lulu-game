// 🐞 QA: the DRIVING chase camera in a town (attached to its interchange), with the watchdog (scripts/lib/qawatch.js) on.
// It used to have no collision at all: it sat inside the houses on a turn, inside Lakewood's traffic-circle statue,
// inside a kerbside tree's leaves. Now it comes in to this side of them (core/camera.js carClip ← foot's camClip, set
// only while she's in a town — the highway pays nothing).
//   • the car angled away from a block of houses: the camera behind it stays out of the block
//   • the car nosing out of the traffic circle: the camera behind it stays out of the statue
//   • the car stopped with a tree right behind it: the camera stays out of the leaves
//   • a random drive round town (gas, steering, the handbrake): the watchdog sees nothing
//   • back on the highway the chase cam has no clip (no cost there)
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qacar",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    // the chase cam vs. what's solid: is the camera inside a block / a big collider / a canopy right now?
    const camIn = () => t.L(`(() => { const c = __lulu3d.ctx.camera.position, Q = window.__qa; const s = Q.solidAt(c.x, c.z, c.y, 0.05, 0.8); if (s) return s;
      for (const ch of __lulu3d.ctx.world.activeChunks()) for (const k of ch.colliders) { if (k.kind !== "tree" || c.y < 2.0 || c.y > 7.5) continue; const R = Math.min(3.8, Math.max(k.r * 4.6 + 0.2, k.r < 0.42 ? 2.4 : 3.4)) - 0.3;
        if ((c.x - k.x) ** 2 + (c.z - k.z) ** 2 < R * R) return "leaves@" + k.x.toFixed(1) + "," + k.z.toFixed(1); }
      return null; })()`);
    // park the car at a world point with a heading, standing still, and let the camera settle
    const park = async (x, z, h, frames = 24) => {
      await W.moved(t);
      await g(`(() => { const car = ctx.car, n = ctx.world.road.nearest(${x}, ${z}, car.s, {}); car.place(${x}, ${z}, ${h}); car.s = n.s; car.d = n.d; car.vx = car.vz = car.vF = 0; ctx.cam.snap(); return true; })()`);
      await t.frames(frames);
    };

    for (const id of ["lakewood", "midwood"]) {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing" && __lulu3d.ctx.town.exits.length > 0`, "a cruise with its interchanges", 9000)) return;
      await g(`(ctx.law.hold && ctx.law.hold(900), ctx.town.load("${id}"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("${id}")`, `${id}'s models load`, 90000)) continue;
      await W.moved(t);
      await g(`ctx.town.enter({ town: "${id}", exitS: ctx.town.exits[0].s, speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active`, `in ${id} (attached)`, 8000)) continue;
      await t.frames(10);
      t.check(`${id}: the chase cam has its walls in town`, await g(`typeof ctx.cam.carClip === "function"`));
      await W.reset(t);

      // ── angled away from a block (the camera behind the car points into the houses) ──
      const spots = await g(`(() => { const T = ctx.town, PL = T.plan, out = [];
        for (const st of PL.STREETS) { if (st.axis === "diag") continue;
          for (let a = st.a0 + 30; a < st.a1 - 30 && out.length < 30; a += 29) {
            const p0 = T.debug.pt(st.name, a, 0), pb = T.debug.pt(st.name, a, st.front + 4), pc = T.debug.pt(st.name, a, st.front - 4.5), pa = T.debug.pt(st.name, a + 10, 0);
            if (![-8, 0, 8].every(k => { const q = T.debug.pt(st.name, a + k, st.front + 4); return PL.OCCLUDERS.some(r => q.x > r.x0 && q.x < r.x1 && q.z > r.z0 && q.z < r.z1); })) continue;
            const W = PL.world(pc.x, pc.z, {}), lnx = (pb.x - p0.x), lnz = (pb.z - p0.z), lax = (pa.x - p0.x), laz = (pa.z - p0.z);
            const rot = (x, z) => [x * PL.COS + z * PL.SIN, -x * PL.SIN + z * PL.COS], n = rot(lnx, lnz), u = rot(lax, laz), nl = Math.hypot(...n), ul = Math.hypot(...u);
            // heading: along the street, swung 50° AWAY from the block (so "behind" points into it)
            const hx = u[0] / ul * Math.cos(0.87) - n[0] / nl * Math.sin(0.87), hz = u[1] / ul * Math.cos(0.87) - n[1] / nl * Math.sin(0.87);
            out.push({ x: W.x, z: W.z, h: Math.atan2(hx, hz), st: st.name, a });
          } }
        return out.filter((s, i) => i % 4 === 0).slice(0, 4); })()`);
      const bad = [];
      for (const sp of spots) { await park(sp.x, sp.z, sp.h); const s = await camIn(); if (s) bad.push(`${sp.st}@${sp.a}: ${s}`); }
      t.check(`${id}: angled away from the houses, the chase cam stays out of them (${spots.length} spots)`, spots.length > 0 && bad.length === 0, bad.join(" | "));
      await t.shot(`${id}-angled`);

      // ── nosing out of the traffic circle (Lakewood): the statue right behind ──
      const circ = await g(`(() => { const PL = ctx.town.plan; if (!PL.circle) return null; const C = PL.world(PL.circle.x, PL.circle.z, {}); return { x: C.x, z: C.z, r: PL.circle.r }; })()`);
      if (circ) {
        const bad2 = [];
        for (const a of [0, 1.6, 3.2, 4.7]) {
          const x = circ.x + Math.sin(a) * (circ.r + 4.5), z = circ.z + Math.cos(a) * (circ.r + 4.5);
          await park(x, z, a);
          const s = await camIn(); if (s) bad2.push(`${a}: ${s}`);
        }
        t.check(`${id}: nosing out of the traffic circle, the chase cam stays out of the statue`, bad2.length === 0, bad2.join(" | "));
        await t.shot(`${id}-circle`);
      }

      // ── a tree right behind the car ──
      const trees = await g(`(() => { const out = []; for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders) if (c.kind === "tree" && !c.off) out.push({ x: c.x, z: c.z, r: c.r }); return out.filter((c, i) => i % 9 === 0).slice(0, 4); })()`);
      const bad3 = [];
      for (const tr of trees) {
        // 5 m in front of the trunk, heading away from it (the camera ~7 m back would sit in the canopy)
        await park(tr.x + 5, tr.z, Math.PI / 2);
        const s = await camIn(); if (s) bad3.push(s);
      }
      t.check(`${id}: a tree right behind the car, the chase cam stays out of its leaves`, bad3.length === 0, bad3.join(" | "));
      await seg(`${id}: the chase cam beside houses / the statue / trees`, ["nan", "inwall", "underground", "flat"]);

      // ── a random drive round town ──
      await W.moved(t);
      await g(`ctx.town.enter({ town: "${id}", exitS: ctx.town.exits[0].s, speed: 0 })`);
      await t.frames(5);
      await W.reset(t);
      let r = 41 + id.length;
      const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
      for (let f = 0; f < 900; f += 10) {
        await t.stick(+(rnd() * 2 - 1).toFixed(2), 0);
        await t.hold(7, rnd() < 0.75 ? 1 : 0); await t.hold(6, rnd() < 0.12 ? 1 : 0); await t.hold(5, rnd() < 0.06 ? 1 : 0);
        await t.frames(10);
      }
      await t.stick(0, 0); await t.hold(7, 0); await t.hold(6, 0); await t.hold(5, 0);
      await t.shot(`${id}-drive`);
      await seg(`${id}: a random drive round town`, ["jump", "nan", "overlay", "flat", "underground", "inwall", "hidden"]);
    }

    // ── back on the highway: no clip ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.town.active`, "a cruise on the highway", 9000);
    t.check("on the highway the chase cam has no walls to check (no cost)", await g(`ctx.cam.carClip === null && ctx.cam.carClipD === 99`));
  },
};
