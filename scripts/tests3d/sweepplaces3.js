// 🔎 The places sweep, part 3 — MIDWOOD's shopfronts on a phone (390 × 844, touch), in the rain: East Midwood Lanes +
// a few of the one-joke shops (one shared room, dressed per shop) + what a closed one says; then a cop on her tail (every
// door is shut to her, kindly — the shops too); then a stranger's house (knock), Lulu's own house and a home for sale
// (the interiors engine's houses), each audited as in part 1 (scripts/lib/sweepplaces.js).
const { make, W } = require("../lib/sweepplaces.js");

module.exports = {
  name: "sweepplaces3",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 5000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t), g = S.g;
    await W.install(t);
    if (!await S.start()) return;
    await g(`(ctx.atmos.debug.weather("rain"), true)`);

    // ── the shopfronts (+ the lanes, a claimed front) ──
    await S.sweepFronts("midwood", { open: 3 });
    // the alley's front reads as the alley (not COMING SOON) once features/lanes is open
    const bowl = await g(`ctx.storefronts.fronts().filter(f => f.st && f.st.bowling).map(f => (f.st.lines || []).join(" / ") + " · " + ctx.storefronts.debug.label(f))`);
    t.check(`the lanes' front: its own sign + ✋ (${bowl[0] || "none"})`, bowl.length > 0 && bowl.every(x => !/COMING SOON/.test(x)), bowl.slice(0, 2).join(" | "));

    // ── a cop on her tail: no door takes her in (the ✋ isn't a door; a shop says so) ──
    await S.onFoot();
    const doors = await S.findDoors();
    const shul = doors.find(d => d.name === "shul");
    const front = await g(`(() => { const SF = ctx.storefronts, f = SF.debug.F.list.find(f => SF.stateOf(f) === "open"); return f ? { x: f.door.x, z: f.door.z, nx: f.nx, nz: f.nz } : null; })()`);
    await g(`(ctx.law.addWanted && ctx.law.addWanted(["JAYWALKING"]), true)`);
    if (shul) {
      await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(shul.at)}; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); ctx.cam.snap(); return true; })()`);
      await W.moved(t);
      const ch = await g(`ctx.foot.startChase({ x: ctx.foot.pos.x + 14, z: ctx.foot.pos.z })`);
      await t.frames(8);
      const pr = await g(`(() => { const pr = ctx.foot.debug.interactables(); return pr ? pr.label : "nothing"; })()`);
      t.check(`chased (${ch}): the shul's ✋ doesn't offer to go in («${pr}»)`, !/SHUL|ENTER|GO IN/i.test(pr) || !ch);
      if (front) {
        await W.moved(t);
        await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(front)}; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); ctx.cam.snap(); return true; })()`);
        await t.frames(8);
        const lb = await g(`(() => { const pr = ctx.foot.debug.interactables(); if (pr && pr.ent && pr.ent.act) pr.ent.act(); return pr ? pr.label : "nothing"; })()`);
        await t.frames(20);
        t.check(`chased: a shop's ✋ («${lb}») doesn't walk her in`, await S.st() === "footRun");
        await S.shot("chased-at-a-shop");
      }
      await g(`(ctx.foot.dropChase(), ctx.law.clearHeat ? ctx.law.clearHeat("") : 0, true)`);
      await t.frames(90);
    }

    // ── houses: a stranger's (knock), Lulu's own, one for sale (the interiors engine, entered through foot's hand-off) ──
    await t.L(`Promise.all([import("./js/features/homes/house.js"), import("./js/features/realestate/house.js")]).then(([homes, re]) => { window.__dm = { homes, re }; return true; })`);
    const houses = [
      ["stranger", `window.__dm.homes.prepare({ home: { name: "Katz", key: "sweep:katz", cast: ["dad", "mom", "girl"], seed: 4242 }, mode: "guest", via: "door", cast: ["dad", "mom", "girl"], noCatch: true })`, "home"],
      ["her-house", `0`, "luluHome"],
      ["for-sale", `window.__dm.re.nameHouse({ id: "sweep:re3", rooms: 3, address: "1 Sweep St" }, "viewing")`, "realestateHouse"],
    ];
    for (const [label, setup, id] of houses) {
      await S.onFoot();
      await W.moved(t);
      const ok = await g(`Promise.resolve(${setup}).then(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(F.pos.x, F.pos.z, F.s, {}); return ctx.foot.handoff(${JSON.stringify(id)}, { id: ${JSON.stringify(id)}, s: n.s, d: n.d, side: Math.sign(n.d) || 1 }); })`);
      if (!t.check(`${label}: in through the door`, !!ok)) continue;
      if (!await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, `${label}: the room is up`, 60000)) continue;
      const a = await S.audit(`midwood-${label}`, { skip: ["sneak", "steal", "grab"] });
      S.report(`midwood-${label}`, a);
      await S.shot(`midwood-${label}-end`);
      await g(`(window.__interiors && __interiors.room ? __interiors.room.leave() : 0, true)`);
      await t.until(`__lulu3d.state === "footRun"`, `${label}: back out`, 30000);
      const r = await W.report(t); W.log(r); W.check(t, `${label}: in + out`, r); await W.reset(t);
    }
  },
};
