// 🐞 QA sweep, part 10 — HOUSEHOLDS WITH A LIFE (features/homes, ci/homelife), the watchdog on: walk into a few lived-in
// houses at 8:00, 13:00, 18:00 and 22:00 with whatever scene the hour gives them (not a pinned one — homelife.js checks
// every scene pinned): nobody standing in a wall / outside the house (sitting / sleeping / lying on furniture is fine),
// a monkey run inside (she stays inside the walls), 🆘 inside → the room's entry spot, out of the door again.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa10",
  query: "&enable=all",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game, D = "ctx.homes.debug";
    await W.install(t);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return;
    await g(`(ctx.law.hold && ctx.law.hold(1e6), ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await W.moved(t);
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active && ${D}.doors() > 20`, "in Lakewood (its households)", 15000)) return;
    await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
    if (!await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000)) return;
    await t.frames(10);
    // a few lived-in, unclaimed houses spread over the town
    const keys = await g(`(() => { const H = ctx.homes.homes().filter(h => !h.status && ctx.homes.livedIn(h.key)); const out = []; for (let i = 0; i < H.length && out.length < 8; i += Math.max(1, Math.floor(H.length / 8))) out.push(H[i].key); return out; })()`);
    t.check("some lived-in houses to visit", keys.length >= 4, JSON.stringify(keys));
    let k = 0;
    for (const hour of [8, 13, 18, 22]) {
      await g(`${D}.hour(${hour})`);
      for (const key of keys.slice(k, k + 2)) {
        await W.moved(t);
        // (walked up to its door, facing it — as homelife.js's toDoor)
        await g(`(() => { const h = ctx.homes.household(${JSON.stringify(key)}), f = ctx.foot.pos; f.set(h.ap.x, 0.05, h.ap.z); ctx.foot.obj.position.copy(f); const yaw = Math.atan2(h.door.x - h.ap.x, h.door.z - h.ap.z); ctx.foot.obj.rotation.y = yaw; if (ctx.cam.free) ctx.cam.free.yaw = yaw; ctx.cam.snap(); return true; })()`);
        await t.frames(3);
        if (!await g(`ctx.homes.enter(${JSON.stringify(key)}, "sneak", "door")`)) { console.log(`   (couldn't go into ${key} at ${hour}:00)`); continue; }
        if (!await t.until(`__lulu3d.state === "interior" && !!${D}.room()`, `${hour}:00 — into ${key}`, 60000)) { await g(`(L3.state !== "footRun" && L3.state !== "playing" ? L3.setState("playing") : 0, true)`); continue; }
        await t.frames(20);
        // (homelife.js's rule: walls = cols p*/q*/back/f*; in a wall / outside / standing in furniture (sitting, lying, asleep on it is fine))
        const r = await g(`(() => { const r = ${D}.room(); if (!r) return null; const walls = r.cols.filter(c => /^([pq]\\d|back|f\\d)$/.test(c.id)), B = r.bounds, bad = [];
          for (const q of r.res) {
            const inWall = walls.some(c => q.x > c.x0 - 0.12 && q.x < c.x1 + 0.12 && q.z > c.z0 - 0.12 && q.z < c.z1 + 0.12);
            const out = q.x < B.x0 - 0.3 || q.x > B.x1 + 0.3 || q.z < B.z0 - 0.3 || q.z > B.z1 + 0.3;
            const inFurn = !q.sit && !q.lie && !q.sleep && r.cols.some(c => !walls.includes(c) && q.x > c.x0 + 0.12 && q.x < c.x1 - 0.12 && q.z > c.z0 + 0.12 && q.z < c.z1 - 0.12);
            if (inWall || out || inFurn) bad.push(q.id + (inWall ? " in a wall" : out ? " outside" : " in furniture") + " @" + q.x + "," + q.z);
          }
          return { scene: r.scene, n: r.res.length, rooms: r.rooms.length, bad }; })()`);
        t.check(`${hour}:00 ${key} (${r && r.scene}, ${r && r.n} people): nobody in a wall / outside the house`, !!r && r.bad.length === 0, JSON.stringify(r));
        // a monkey run inside — she stays inside its walls
        let rs = hour * 7 + k;
        const rnd = () => ((rs = (rs * 1103515245 + 12345) % 2147483648) / 2147483648);
        for (let f = 0; f < 240; f += 6) {
          await t.L(`(__pad.axes[0] = ${(rnd() * 2 - 1).toFixed(2)}, __pad.axes[1] = ${(rnd() * 2 - 1).toFixed(2)}, true)`);
          await t.frames(6);
          if (await g(`L3.state !== "interior"`)) break;
        }
        await t.L(`(__pad.axes[0] = __pad.axes[1] = 0, true)`);
        if (await g(`L3.state === "interior"`)) {
          const p = await g(`(() => { const r = ${D}.room(); if (!r) return null; const b = r.bounds, q = r.lulu; return { x: +q.x.toFixed(1), z: +q.z.toFixed(1), inB: q.x >= b.x0 - 0.6 && q.x <= b.x1 + 0.6 && q.z >= b.z0 - 0.6 && q.z <= b.z1 + 0.6 }; })()`);
          t.check(`${hour}:00 ${key}: after mashing about she's still inside the house`, !p || p.inB, JSON.stringify(p));
          // 🆘 inside: the room's entry spot (a busy room — someone's talking to her — sends her out of the door instead)
          if (await g(`!!ctx.unstuck`)) {
            await g(`(ctx.unstuck.debug.U.last = -1e9, ctx.unstuck.now(), true)`);
            await t.frames(15);
            const u = await g(`({ state: L3.state, last: ctx.unstuck.debug.U.log.slice(-1)[0] })`);
            t.check(`${hour}:00 ${key}: 🆘 inside → back by the door (or out of it)`, !!u.last && (u.last.how === "room" || u.last.how === "door"), JSON.stringify(u));
          }
        }
        // out again
        if (await g(`L3.state === "interior"`)) { await g(`(window.__interiors && window.__interiors.room && window.__interiors.room.leave(), true)`); }
        await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, `${hour}:00 — out of ${key}`, 20000);
        // (a resident who saw a stranger may call it in: hold the law, clear the wanted level the sneak-in earned)
        await g(`(ctx.law.clearHeat && ctx.law.clearHeat(""), ctx.law.hold && ctx.law.hold(1e6), true)`);
        await t.frames(20);
        await seg(`${hour}:00 ${key}: in, a monkey run, 🆘, out`, ["nan", "overlay", "underground", "stuck", "hidden"]);
      }
      k += 2;
    }
  },
};
