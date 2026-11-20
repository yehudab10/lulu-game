// 🐞 QA sweep, part 4 (every feature on, the watchdog in scripts/lib/qawatch.js on), in Lakewood with the REAL ✋ button:
// carjacking a double-parked minivan, hot-wiring a kerbside car, walking into the bank and out, and getting back into
// her own car after it was shoved down the street.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa4",
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
    const prompt = () => t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);
    const town = async () => {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 9000)) return false;
      await g(`(ctx.town.load("lakewood"), true)`);
      if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return false;
      await W.moved(t);
      await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
      if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return false;
      await g(`(ctx.law.hold && ctx.law.hold(400), true)`);
      await t.frames(10);
      return true;
    };
    const onFoot = async () => {
      await g(`(ctx.foot.start("droveOff"), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "out of the car", 6000);
    };
    if (!await town()) return;

    // ── carjack the double-parked minivan at the wedding hall (✋) ──
    await W.moved(t);
    await g(`(() => { const c = ctx.town.debug.C.hazards[0]; if (!c) return false; ctx.car.place(c.x - Math.sin(c.h) * 12, c.z - Math.cos(c.h) * 12, c.h); ctx.car.s = ctx.world.road.nearest(ctx.car.pos.x, ctx.car.pos.z, c.s, {}).s; ctx.cam.snap(); return true; })()`);
    await t.frames(4);
    await W.reset(t);
    if (await onFoot()) {
      await W.moved(t);
      await g(`(() => { const c = ctx.town.debug.C.hazards[0], F = ctx.foot.debug.F, l = { x: Math.cos(c.h), z: -Math.sin(c.h) }, f = { x: Math.sin(c.h), z: Math.cos(c.h) };
          F.pos.set(c.x + l.x * 1.6 + f.x * 0.6, 0, c.z + l.z * 1.6 + f.z * 0.6); return true; })()`);
      await t.frames(5);
      const p = await prompt();
      t.check("by the double-parked minivan: ✋ offers the JACK", /JACK/.test(p), p);
      await t.tap(0);
      if (await t.until(`__lulu3d.state === "playing"`, "she drives off in the minivan", 30000)) {
        await t.hold(7, 1); await t.frames(40); await t.hold(7, 0); await t.frames(20);
        t.check("…in town, in the minivan", await g(`ctx.town.active && !!ctx.streets.ride`));
      }
      await t.shot("jacked");
      await seg("carjacking a minivan in town");
    }

    // ── hot-wire a kerbside car (✋, then the minigame's taps) ──
    if (await onFoot()) {
      const pc = await g(`(() => { const F = ctx.foot.debug.F; let best = null, bd = 1e9; for (const p of F.parked) { if (p.vtype !== "car") continue; const d = Math.hypot(p.x - F.pos.x, p.z - F.pos.z); if (d < bd) { bd = d; best = p; } } return best ? { x: best.x, z: best.z, h: best.h } : null; })()`);
      if (pc) {
        await W.moved(t);
        await g(`(() => { const F = ctx.foot.debug.F, rx = Math.cos(${pc.h}), rz = -Math.sin(${pc.h}); F.pos.set(${pc.x} + rx * 1.8, 0, ${pc.z} + rz * 1.8); F.vel.set(0, 0, 0); return true; })()`);
        await t.frames(5);
        const p = await prompt();
        t.check("by a kerbside car: ✋ offers to hot-wire / borrow it", /HOT|WIRE|BORROW|STEAL|🔧|🔑/i.test(p), p);
        await g(`(ctx.foot.force.hotwire = true, true)`);       // (the minigame is a timing tap — the test always hits the green)
        await t.tap(0);
        for (let i = 0; i < 40 && await g(`L3.state === "footRun"`); i++) { await t.tap(0); await t.frames(4); }
        await t.until(`__lulu3d.state === "playing"`, "she drives off in the hot-wired car", 20000);
        await t.frames(30);
        await t.shot("hotwired");
        await seg("hot-wiring a kerbside car in town");
      }
    }

    // ── the bank: walk in at its door (✋), walk back out ──
    await W.moved(t);
    await g(`(() => { const sp = ctx.town.spot("bank"); if (!sp) return false; const p = { x: sp.x + sp.nx * 15, z: sp.z + sp.nz * 15 }, n = ctx.world.road.nearest(p.x, p.z, ctx.car.s, {}); ctx.car.place(p.x, p.z, n.h); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
    await t.frames(5);
    if (await onFoot()) {
      await W.moved(t);
      await g(`(() => { const sp = ctx.town.spot("bank"); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); return true; })()`);
      await t.frames(5);
      const p = await prompt();
      t.check("at the bank's door: ✋ offers the bank", /BANK/i.test(p), p);
      t.check("…and the ✋ button's own label says so too (not the last thing in reach)", /BANK/i.test(await t.L(`(document.getElementById("tx_foot_hand") || {}).textContent || ""`)), await t.L(`(document.getElementById("tx_foot_hand") || {}).textContent || ""`));
      await t.tap(0);
      if (await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready`, "inside the bank", 60000)) {
        await t.frames(40);
        await t.shot("bank-in");
        await g(`(window.__interiors.room.leave(), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "back out of the bank", 20000);
        await t.frames(40);
        t.check("out of the bank: still in Lakewood, walking, in front of the bank", await g(`(() => { const sp = ctx.town.spot("bank"), F = ctx.foot.debug.F; return ctx.town.active && F.phase === "walk" && Math.hypot(F.pos.x - sp.x, F.pos.z - sp.z) < 8; })()`));
        await t.shot("bank-out");
      }
      await seg("in and out of the bank");
    }

    // ── her car shoved down the street while she's out, then back in ──
    if (await g(`L3.state === "footRun" && !!ctx.foot.debug.F.car`)) {
      await W.moved(t);
      const st = await g(`(() => { const F = ctx.foot.debug.F, c = F.car.stub; c.x += Math.sin(c.h) * 3.5; c.z += Math.cos(c.h) * 3.5; c.h += 0.5; c.obj.position.set(c.x, c.obj.position.y, c.z); c.obj.rotation.y = c.h;
        F.pos.set(c.x + Math.cos(c.h) * 2.0, 0.05, c.z - Math.sin(c.h) * 2.0); return { x: c.x, z: c.z, h: c.h }; })()`);
      await t.frames(6);
      const p = await prompt();
      t.check("by her shoved car: ✋ GET BACK IN", /GET/.test(p), p);
      await t.tap(0);
      await t.until(`__lulu3d.state === "playing"`, "driving her own car again", 4000);
      const at = await g(`({ d: Math.hypot(ctx.car.pos.x - ${st.x}, ctx.car.pos.z - ${st.z}), h: Math.abs(((ctx.car.h - ${st.h}) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) })`);
      t.check("…she drives off from where the car WAS (not where it used to be)", at.d < 1.0 && at.h < 0.2, JSON.stringify(at));
      await t.frames(30);
      await seg("back into a shoved car");
    }
  },
};
