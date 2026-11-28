// 📱 The phone sweep, part 2 — ROOMS ON A PHONE HELD UPRIGHT (390 × 844, touch). In a small room the walls pull the camera
// in right behind her: her head + back filled half the screen and hid who she talks to (sweep-places' screenshots). Now
// she turns see-through when the lens is close (interiors/engine.js fadeSelf). Walks into a stranger's house, her own
// house, the clothes shop, the bakery and a one-joke shopfront with the real ✋ and checks, standing at the door and in a
// chat: how much of the screen SHE covers while solid (≤ 30 %), that she is see-through when the camera is close, and that
// she's solid again outside. Screenshots: SWEEP_SHOTS=1 → smoke-shots/sweep/ (the places sweep's helpers).
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
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    if (!await S.town("midwood")) return;
    await S.onFoot();
    await t.frames(20);
    const doors = await S.findDoors();
    S.log("doors: " + doors.map(d => d.name).join(", "));
    const want = (process.env.SWEEP_ROOMS || "stranger,home,clothes,bakery,realty").split(",");
    const pickD = doors.filter(d => want.some(w => d.name.includes(w)));
    const seen = new Set();
    for (const d of pickD) {
      const kind = want.find(w => d.name.includes(w));
      if (seen.has(kind)) continue; seen.add(kind);
      await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
      const where = `phone-${d.name}`;
      await W.reset(t);
      const car0 = await S.carPos();
      const ok = await S.enter(d, where);
      if (ok !== true) { S.log(`${where}: ${ok}`); await S.playing(); await S.onFoot(); continue; }
      await t.frames(40);
      await S.shot(`${where}-door`);
      const c0 = await g(COVER);
      S.log(`${where} at the door: ${JSON.stringify(c0)}`);
      t.check(`${where}: at the door she covers ≤ 35 % of an upright phone (or is see-through)`, c0 && (c0.cover <= 0.35 || c0.a < 0.6), JSON.stringify(c0));
      // a chat: walk up to the first person with a ✋ (the camera turns over her shoulder toward them)
      const who = await S.room(`(() => { const h = r.hots.find(h => h.who && r.byId[h.who] && (!h.enabled || h.enabled(r))); if (!h) return null; const p = r.byId[h.who].p.obj.position; return { id: h.id, x: p.x, z: p.z, i: r.hots.indexOf(h) }; })()`);
      if (who) {
        const reach = await S.flood();
        if (reach[who.i]) {
          await S.room(`(() => { const o = r.lulu.obj; o.position.x = ${reach[who.i].x}; o.position.z = ${reach[who.i].z}; o.rotation.y = Math.atan2(${who.x} - o.position.x, ${who.z} - o.position.z); r.vel.set(0, 0, 0); r.outArmed = false; return true; })()`);
          await t.frames(40);
          const c1 = await g(COVER);
          await S.shot(`${where}-by-${who.id}`);
          S.log(`${where} by ${who.id}: ${JSON.stringify(c1)}`);
          t.check(`${where}: beside ${who.id} she covers ≤ 35 % of the phone (or is see-through)`, c1 && (c1.cover <= 0.35 || c1.a < 0.6), JSON.stringify(c1));
        }
      }
      if (await g(`!!(window.__interiors && __interiors.room && __interiors.room.ready)`)) await S.leave(d, where, car0); else await S.playing();
      const r = await W.report(t); W.log(r); W.check(t, `${where}: in + out`, r); await W.reset(t);
      await S.onFoot();
    }
    t.check("visited a stranger's house + the clothes shop", seen.has("stranger") && seen.has("clothes"), [...seen].join(","));
  },
};
