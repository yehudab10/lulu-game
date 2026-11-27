// 🚪 Doors that are easy to use (ci/doors, roadmap 29, stage 0): every door's ✋ shows anywhere a player would stand to
// go in — across the doorway / shopfront, from the step out to the kerb — not one square metre. For each town: every
// registered door-like ✋ spot (`door:` spots — places, shul, city hall, bank, pizza / bakery, clothes, the realtor,
// the makolet counter, Bling Bay, the impound gate) found at its town spot, then a probe walked across its front (3 × 3
// points: left · middle · right × the step · the spot · the kerb) asserting the ✋ prompt is THAT door; a sample of
// strangers' front doors (features/homes) the same way; then each building door is actually entered and left. Last: the
// on-foot ✋ button on a phone (412 × 915, 667 × 375) is big and nothing covers it.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "doors",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,seasons,homes",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async id => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
    };
    const onFoot = async () => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
      await g(`(ctx.foot.debug.F.phase = "walk", true)`);
    };
    // every door-like spot standing at a town spot: { name, i (index in ctx.foot.spots()), short, at: {x, z, ux, uz, nx, nz} }
    const findDoors = () => g(`(() => {
      const F = ctx.foot.debug.F, list = ctx.foot.spots(), T = ctx.town.debug.S.T, out = [];
      for (const name of Object.keys(T.spots)) {
        const sp = ctx.town.spot(name);
        if (!sp || sp.nx == null) continue;
        F.pos.set(sp.x, 0.05, sp.z);
        list.forEach((s, i) => {
          if (!s.door || out.some(o => o.i === i)) return;
          let at = null; try { at = s.pos ? s.pos() : s; } catch (e) { return; }
          if (at && at.nx != null && Math.hypot(at.x - sp.x, at.z - sp.z) < 0.3) out.push({ name, i, short: s.short || "", at: { x: at.x, z: at.z, ux: at.ux, uz: at.uz, nx: at.nx, nz: at.nz } });
        });
      }
      return out;
    })()`);
    // walk a probe across the door's front; → the probe points where the ✋ prompt was NOT this door (+ what won)
    const probe = (i, at, U, N) => g(`(() => {
      const F = ctx.foot.debug.F, s = ctx.foot.spots()[${i}], at = ${JSON.stringify(at)}, miss = [];
      const keep = { parked: F.parked, peds: F.peds, animals: F.animals };
      F.parked = []; F.peds = []; F.animals = [];       // (a chat / a parked car right beside her may fairly win — not the question here)
      try {
        for (const u of ${JSON.stringify(U)}) for (const n of ${JSON.stringify(N)}) {
          F.pos.set(at.x + at.ux * u + at.nx * n, 0.05, at.z + at.uz * u + at.nz * n);
          const pr = ctx.foot.debug.interactables();
          if (!pr || pr.ent !== s) miss.push(u + "," + n + "→" + (pr ? pr.label : "nothing"));
        }
      } finally { Object.assign(F, keep); }
      return miss;
    })()`);

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

    const ROOMS = new Set(["precinct", "court", "hospital", "shul", "cityhall", "bank", "pizza", "bakery", "clothes", "realty"]);
    for (const id of ["midwood", "lakewood"]) {
      if (!await town(id)) continue;
      await onFoot();
      await t.frames(30);
      const doors = await findDoors();
      console.log(`  · ${id}: ${doors.length} doors — ${doors.map(d => d.name).join(", ")}`);
      t.check(`${id}: the town's doors are found (${doors.length})`, doors.length >= 8, doors.map(d => d.name).join(","));
      for (const d of doors) {
        const miss = await probe(d.i, d.at, [-1.2, 0, 1.2], [-1.2, 0, 2.4]);
        t.check(`${id} ${d.name}: ✋ shows across the doorway, step → kerb`, miss.length === 0, miss.join(" | "));
      }
      // strangers' front doors: a sample (a duplex has two doors side by side → narrower: ±0.6 along the street)
      const hi = await g(`ctx.foot.spots().findIndex(s => s.short === "HOUSE")`);
      // (the houses whose door is the homes ✋ — not her own / one for sale: those are real estate's)
      const homes = await g(`(() => { const F = ctx.foot.debug.F, s = ctx.foot.spots()[${hi}]; if (!s || !ctx.homes || !ctx.homes.homes) return [];
        return ctx.homes.homes().filter(h => h.ap && h.ap.nx != null).filter(h => { F.pos.set(h.ap.x, 0.05, h.ap.z); return !!s.pos(); }).slice(0, 60).filter((h, k) => k % 10 === 0).map(h => h.ap); })()`);
      t.check(`${id}: strangers' houses have doors to test (${homes.length})`, homes.length >= 3 && hi >= 0);
      for (const [k, ap] of homes.entries()) {
        const miss = await probe(hi, ap, [-0.6, 0, 0.6], [-0.4, 0.6, 1.8]);
        t.check(`${id} house ${k}: ✋ shows across the front path`, miss.length === 0, miss.join(" | "));
      }
      // …and every building door actually opens: in, then out again
      for (const d of doors.filter(d => ROOMS.has(d.name))) {
        await onFoot();
        await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(d.at)}; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); return true; })()`);
        await t.frames(4);
        const lbl = await g(`(() => { const pr = ctx.foot.debug.interactables(); if (!pr || pr.kind !== "spot") return "nothing"; pr.ent.act(); return pr.label; })()`);
        const inside = await t.until(`__lulu3d.state !== "footRun"`, `${id} ${d.name}: went in (${lbl})`, 60000);
        t.check(`${id} ${d.name}: walking up + ✋ goes in (${lbl})`, inside);
        if (!inside) continue;
        await t.until(`!window.__interiors || !__interiors.room || __interiors.room.ready`, `${id} ${d.name}: the room is up`, 60000);
        await g(`(window.__interiors && __interiors.room ? __interiors.room.leave() : 0, true)`);
        t.check(`${id} ${d.name}: and back out on foot`, await t.until(`__lulu3d.state === "footRun"`, `${id} ${d.name}: out`, 30000));
        await t.frames(10);
      }
    }

    // the ✋ button on a phone: big, and nothing on top of it
    for (const [name, w, h] of [["phone", 412, 915], ["phone-land", 667, 375]]) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
      await onFoot();
      await t.frames(12);
      const b = await t.L(`(() => { const e = document.getElementById("tx_foot_hand"); if (!e || e.offsetParent === null) return null; const r = e.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom, iw: innerWidth, ih: innerHeight, covered: !!top && !e.contains(top) ? (top.id || top.className || top.tagName) : "" }; })()`);
      t.check(`${name}: the ✋ button is shown on foot`, !!b);
      if (!b) continue;
      t.check(`${name}: the ✋ button is big (≥ 80 px: ${Math.round(b.w)} × ${Math.round(b.h)})`, b.w >= 80 && b.h >= 80);
      t.check(`${name}: the ✋ button is on screen`, b.l >= 0 && b.t >= 0 && b.r <= b.iw && b.b <= b.ih);
      t.check(`${name}: nothing covers the ✋ button`, !b.covered, b.covered);
      await t.shot(`doors-hand-${name}`);
    }
    await t.page.setViewportSize({ width: 1280, height: 720 });
  },
};
