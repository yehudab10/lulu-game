// 🚔 HITTING SOMEONE MID-CHASE IS NOT AN AUTOMATIC BUST (the owner, 2026-11-27: "Cops shouldn't be able to pull a
// player over automatically if the player hits a person while being chased by a cop") — features/law › law.struck:
//   • chased, a cruiser right behind her, she hits a pedestrian at speed → still driving, still chased, HIT AND RUN on
//     the chase's sheet, the heat up a star
//   • an animal, a cone, a parked car hit mid-chase → no arrest either
//   • the normal bust still works: she stops beside the cruiser → the BUSTED meter fills → the arrest
//   • outside a chase the old rule stands: seen hitting a pedestrian at speed → arrested
module.exports = {
  name: "lawstruck",
  query: "&enable=law,roadevents,atmos",
  save2d: { totalCoins: 300, cruiseUnlocked: true, convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    const g = t.game, D = "ctx.law._dbg";
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 15000)) return;
    await t.frames(20);
    // a chase with a cruiser right behind her, driving at ~67 mph
    const behind = `(() => { const u = ${D}.L.units.find(u => u.mode === "chase" && u.car); if (!u) return false; const c = ctx.car, h = c.h;
      u.car.x = c.pos.x - Math.sin(h) * 9; u.car.z = c.pos.z - Math.cos(h) * 9; u.car.h = h; return true; })()`;
    const fast = `(ctx.car.vx = Math.sin(ctx.car.h) * 30, ctx.car.vz = Math.cos(ctx.car.h) * 30, ctx.car.vF = 30, ctx.G.invT = 0, ctx.G.hearts = 3, true)`;
    await g(`(ctx.law.hold(0), ${D}.L.grace = 0, ctx.law.startChase("SPEEDING", { heat: 2 }), true)`);
    await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.mode === "chase" && u.car)`, "a cruiser on her tail", 15000);
    await g(behind); await g(fast);
    const h0 = await g(`ctx.law.wanted`);
    t.check("a cop sees her (the cruiser right behind)", await g(`ctx.law.copSees(ctx.car.pos.x, ctx.car.pos.z, 70)`));
    // ── a pedestrian, mid-chase ──
    await g(`(${D}.L.grace = 0, L3.emit("crash", { kind: "ped" }), true)`);
    await t.frames(8);
    const a = await g(`({ state: L3.state, chasing: ctx.law.chasing, heat: ctx.law.wanted, charges: ${D}.L.chase ? ${D}.L.chase.charges.slice() : null })`);
    t.check("chased + hits a pedestrian → still driving (no automatic bust)", a.state === "playing", JSON.stringify(a));
    t.check("…still chased", a.chasing, JSON.stringify(a));
    t.check("…HIT AND RUN on the chase's sheet", !!a.charges && a.charges.includes("HIT AND RUN"), JSON.stringify(a));
    t.check("…the heat up a star", a.heat > h0, `${h0} → ${a.heat}`);
    // law.struck straight (what the parade / a bonked walker use)
    t.check("law.struck mid-chase piles on, never arrests", (await g(`ctx.law.struck(["HIT AND RUN"])`)) === "chase");
    await t.frames(8);
    t.check("…still driving, still chased", await g(`L3.state === "playing" && ctx.law.chasing`));
    // ── an animal, a cone, a parked car mid-chase ──
    for (const kind of ["deer", "cone", "parked"]) {
      await g(behind); await g(fast);
      await g(`(L3.emit("crash", { kind: "${kind}" }), true)`);
      await t.frames(6);
      t.check(`chased + hits a ${kind} → no arrest`, await g(`L3.state === "playing" && ctx.law.chasing`), await g(`L3.state`));
    }
    // ── the normal bust still works: she stops right beside the cruiser ──
    await g(`(ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, true)`);
    for (let i = 0; i < 40 && await g(`L3.state === "playing"`); i++) { await g(behind); await g(`(ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, true)`); await t.frames(6); }
    // (cops.js bust() → "lawBust": the cop at her window — the arrest / the ticket from there)
    t.check("stopped beside the cruiser → BUSTED (the normal way still works)", await t.until(`["lawBust", "lawStop", "lawArrest"].includes(__lulu3d.state) || (__lulu3d.ctx.law._dbg.log || []).some(e => e.ev === "cop:chase" && e.result === "busted")`, "the bust", 20000), await g(`L3.state`));
    // ── outside a chase: the old rule (seen hitting someone at speed → arrested) ──
    await g(`(L3.setState("title"), true)`);
    await t.frames(10);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (await t.until(`__lulu3d.state === "playing"`, "a fresh cruise", 15000)) {
      await t.frames(10);
      await g(`(${D}.spawnPatrol({ fast: false, oncoming: false }), true)`);
      await t.frames(4);
      await g(`(() => { const u = ${D}.L.units[0]; if (!u || !u.car) return false; const c = ctx.car; u.car.free = true; u.car.ai = () => {}; u.car.x = c.pos.x - Math.sin(c.h) * 9; u.car.z = c.pos.z - Math.cos(c.h) * 9; return true; })()`);
      await g(fast);
      await g(`(${D}.L.grace = 0, L3.emit("crash", { kind: "ped" }), true)`);
      t.check("NOT chased + seen hitting a pedestrian at speed → arrested (as before)", await t.until(`__lulu3d.state === "lawArrest"`, "the arrest (no chase)", 10000), await g(`L3.state`));
    }
  },
};
