// 📱 The phone sweep, part 2 — ROOMS ON A PHONE HELD UPRIGHT (390 × 844, touch). In a small room the walls pull the camera
// in right behind her: her head + back filled half the screen and hid who she talks to (sweep-places' screenshots). Now
// she turns see-through when the lens is close (interiors/engine.js fadeSelf). Walks into the clothes shop, the bakery,
// the realtor, a stranger's house, her own house and a one-joke shopfront and checks, standing at the door and beside
// someone with a ✋: she covers ≤ 35 % of the screen while solid (else she's see-through), and outside she's solid again.
// Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweep/ (the places sweep's helpers). On the old clock: the fast test clock
// draws rooms as one flat colour in page screenshots.
const { make, W } = require("../lib/sweepplaces.js");

// her silhouette on screen: the 8 corners of a 0.7 × 1.75 × 0.7 box around her, projected → the screen share it covers
const COVER = `(() => { const r = window.__interiors && __interiors.room; if (!r) return null; const cam = r.set.camera, o = r.lulu.obj, V = cam.position.constructor;
  let x0 = 1, x1 = -1, y0 = 1, y1 = -1, behind = 0;
  for (const dx of [-0.35, 0.35]) for (const dz of [-0.35, 0.35]) for (const y of [0, 1.75]) { const v = new V(o.position.x + dx, o.position.y + y, o.position.z + dz).project(cam);
    if (v.z > 1) { behind++; continue; } x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const cl = a => Math.max(-1, Math.min(1, a)), area = Math.max(0, cl(x1) - cl(x0)) * Math.max(0, cl(y1) - cl(y0)) / 4;
  return { cover: +area.toFixed(2), d: +cam.position.distanceTo(new V(o.position.x, o.position.y + 1.2, o.position.z)).toFixed(2), a: r.selfA == null ? 1 : +r.selfA.toFixed(2), faded: !!r.selfFaded, behind }; })()`;

module.exports = {
  name: "sweepphone2",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  fast: false,
  query: "&enable=all",
  save2d: { totalCoins: 5000, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t), g = t.game;
    await W.install(t);
    if (!await S.start()) return;
    const touch = () => t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await touch();
    if (!await S.town("midwood")) return;
    await S.onFoot();
    await t.frames(20);
    const seen = new Set();
    // in the room: at the door, then beside the first person with a ✋ (a chat turns the camera over her shoulder)
    const measure = async where => {
      seen.add(where);
      await touch();
      await t.frames(40);
      await S.shot(`${where}-door`);
      const c0 = await g(COVER);
      S.log(`${where} at the door: ${JSON.stringify(c0)}`);
      t.check(`${where}: at the door she covers ≤ 35 % of an upright phone (or is see-through)`, c0 && (c0.cover <= 0.35 || c0.a < 0.6), JSON.stringify(c0));
      const who = await S.room(`(() => { const h = r.hots.find(h => h.who && r.byId[h.who] && (!h.enabled || h.enabled(r))); if (!h) return null; const p = r.byId[h.who].p.obj.position; return { id: h.id, x: p.x, z: p.z, i: r.hots.indexOf(h) }; })()`);
      if (!who) return;
      const reach = await S.flood();
      if (!reach[who.i]) return;
      await S.room(`(() => { const o = r.lulu.obj; o.position.x = ${reach[who.i].x}; o.position.z = ${reach[who.i].z}; o.rotation.y = Math.atan2(${who.x} - o.position.x, ${who.z} - o.position.z); r.vel.set(0, 0, 0); r.outArmed = false; return true; })()`);
      await t.frames(40);
      const c1 = await g(COVER);
      await S.shot(`${where}-by-${who.id}`);
      S.log(`${where} by ${who.id}: ${JSON.stringify(c1)}`);
      t.check(`${where}: beside ${who.id} she covers ≤ 35 % of the phone (or is see-through)`, c1 && (c1.cover <= 0.35 || c1.a < 0.6), JSON.stringify(c1));
      const nr = await S.room(`(() => { const L = r.lulu.obj.position, ry = r.lulu.obj.rotation.y; return { near: r.near ? r.near.id : null, all: r.hots.filter(h => !h.enabled || h.enabled(r)).map(h => { const w = h.track && h.who && r.byId[h.who], x = w ? w.p.obj.position.x : h.x, z = w ? w.p.obj.position.z : h.z, d = Math.hypot(x - L.x, z - L.z);
        return d <= h.r ? h.id + "@" + d.toFixed(2) + "/" + ((x - L.x) * Math.sin(ry) / Math.max(d, 0.01) + (z - L.z) * Math.cos(ry) / Math.max(d, 0.01)).toFixed(2) : null; }).filter(Boolean) }; })()`);
      S.log(`${where} ✋ by ${who.id}: ${JSON.stringify(nr)}`);
      t.check(`${where}: beside ${who.id}, facing them, the ✋ is theirs`, nr && nr.near === who.id, JSON.stringify(nr));
    };
    const out = async where => {
      await g(`(window.__interiors && __interiors.room ? __interiors.room.leave() : 0, true)`);
      await t.until(`__lulu3d.state === "footRun"`, `${where}: back out`, 30000);
      await t.frames(10);
      t.check(`${where}: outside, she's solid again`, await g(`(() => { let ok = true; ctx.foot.debug.F.lulu.obj.traverse(m => { if (m.isMesh && m.userData.selfFade) ok = false; }); return ok; })()`));
      const r = await W.report(t); W.log(r); W.check(t, `${where}: in + out`, r); await W.reset(t);
      await S.onFoot();
    };
    // the town's doors (a shop, the bakery, the realtor)
    const doors = await S.findDoors();
    for (const name of (process.env.SWEEP_ROOMS || "clothes,bakery,realty").split(",")) {
      const d = doors.find(d => d.name === name);
      if (!d) { S.log(`no door ${name}`); continue; }
      await W.reset(t);
      if (await S.enter(d, `phone-${name}`) !== true) { await S.playing(); await S.onFoot(); continue; }
      await measure(`phone-${name}`);
      await out(`phone-${name}`);
    }
    // a stranger's house (knock) — the small hallway the camera was pulled into
    {
      await W.moved(t);
      const ap = await g(`(() => { const F = ctx.foot.debug.F, s = ctx.foot.spots().find(s => s.short === "HOUSE"); if (!s || !ctx.homes || !ctx.homes.homes) return null;
        const h = ctx.homes.homes().filter(h => h.ap && h.ap.nx != null).find(h => { F.pos.set(h.ap.x + h.ap.nx * 0.6, 0.05, h.ap.z + h.ap.nz * 0.6); return !!s.pos(); });
        if (!h) return null; F.vel.set(0, 0, 0); ctx.cam.snap(); return { x: h.ap.x, z: h.ap.z, nx: h.ap.nx, nz: h.ap.nz, name: h.name }; })()`);
      if (ap) {
        await t.frames(6);
        await g(`(() => { const pr = ctx.foot.debug.interactables(); if (pr && pr.ent && pr.ent.act) pr.ent.act(); return true; })()`);
        for (let k = 0; k < 60 && await S.st() !== "interior"; k++) {
          await t.frames(8);
          const f = await S.dialogFit();
          if (f && f.opts.length) { const i = Math.max(0, f.opts.findIndex(o => /Knock/i.test(o))); await t.L(`(() => { const o = document.querySelectorAll("#dialog .opt")[${i}]; if (o) { o.click(); o.click(); } return true; })()`); }
          else if (f) await t.tap(0);
        }
        if (await S.st() === "interior" && await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, "the house is up", 60000)) { await measure("phone-stranger"); await out("phone-stranger"); }
        else { S.log("the knock didn't take her in"); await S.playing(); await S.onFoot(); }
      }
    }
    // her own house (Ima's) + a one-joke shopfront
    await W.moved(t);
    if (await g(`(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(F.pos.x, F.pos.z, F.s, {}); return ctx.foot.handoff("luluHome", { id: "luluHome", s: n.s, d: n.d, side: Math.sign(n.d) || 1 }); })()`)
      && await t.until(`window.__interiors && __interiors.room && __interiors.room.ready`, "her house is up", 60000)) { await measure("phone-her-house"); await out("phone-her-house"); }
    const front = await g(`(() => { const SF = ctx.storefronts; if (!SF) return null; const f = SF.debug.F.list.find(f => f.door && SF.stateOf(f) === "open"); return f ? { name: f.name, at: { x: f.door.x, z: f.door.z, nx: f.nx, nz: f.nz } } : null; })()`);
    if (front) {
      await S.onFoot();
      await W.moved(t);
      await g(`(() => { const F = ctx.foot.debug.F, a = ${JSON.stringify(front.at)}; F.peds.length = 0; F.pos.set(a.x + a.nx * 1.4, 0.05, a.z + a.nz * 1.4); F.vel.set(0, 0, 0); F.lulu.obj.rotation.y = Math.atan2(-a.nx, -a.nz); return true; })()`);
      await t.frames(8);
      const i = await g(`(() => { const pr = ctx.foot.debug.interactables(); return pr && pr.ent ? ctx.foot.spots().indexOf(pr.ent) : -1; })()`);
      if (await S.enter({ name: front.name, i, at: front.at }, "phone-front") === true) { await measure("phone-front"); await out("phone-front"); }
    }
    // on its side (844 × 390): the realtor's small office — the camera has more room sideways; she's solid unless it's close
    await t.page.setViewportSize({ width: 844, height: 390 });
    await t.frames(6);
    {
      const d = doors.find(d => d.name === "realty");
      if (d && await S.enter(d, "phone-land-realty") === true) { await measure("phone-land-realty"); await out("phone-land-realty"); }
    }
    await t.page.setViewportSize({ width: 390, height: 844 });
    t.check("visited the rooms (a stranger's house, her house, the clothes shop, a shopfront)", ["phone-stranger", "phone-her-house", "phone-clothes", "phone-front"].every(w => seen.has(w)), [...seen].join(","));
  },
};
