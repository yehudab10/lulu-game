// 🍳 House items (features/houseitems, roadmap 32 · stage D): what she walks out of a house holding comes with her
// (stolen from a stranger's / hers from Fayge's), one in hand (drawn in her hand), the item button uses it — the first
// verb that makes sense: BONK (a chasing cop stops, his hat spins), EAT (a heart; capped a run), DROP (food: a chasing
// cop stops to look), GIVE (its owner knows it: homes remembers a favour), WEAR, SHOW; used-up things are gone; using
// it in front of its owner → they notice (homes remembers); the item button doesn't spray pepper while she holds
// something; swap; nothing pays coins.
module.exports = {
  name: "houseitems",
  viewport: { width: 1280, height: 720 },
  query: `&enable=homes,town,law,foot,atmos,interiors,seasons,memory,houseitems,crime,garage`,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", pepperSpray: 2 },
  async run(t) {
    const g = t.game, I = `ctx.houseitems`;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    await g(`ctx.town.load("lakewood")`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood models", 90000);
    await g(`(ctx.town.enter({ town: "lakewood", speed: 0 }), true)`);
    if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.homes.crowd().on`, "in Lakewood", 60000)) return;
    await g(`ctx.foot.start("droveOff", { noIntro: true })`);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000)) return;
    await g(`(ctx.homes.debug.stopCrowd(), ${I}.debug.clear(), true)`);       // (no neighbours wandering into GIVE range)
    const c0 = await g(`ctx.G.coins`);
    const key = await g(`(ctx.homes.homes().find(h => h.status === null && h.cast.includes("mom")) || {}).key`);
    const K = JSON.stringify(key);
    const stand = (x, z) => g(`(() => { if (window.__qa) window.__qa.cutF = ctx.frames + 4; const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.obj.position.copy(f); if (ctx.cam && ctx.cam.snap) ctx.cam.snap(); return true; })()`);

    await step("take", async () => {
      const h = await g(`ctx.homes.household(${K})`);
      await stand(h.ap.x, h.ap.z); await t.frames(4);
      await g(`ctx.homes.enter(${K}, "sneak", "window")`);
      if (!await t.until(`__lulu3d.state === "interior" && __lulu3d.ctx.homes.debug.VISIT.cur && __lulu3d.ctx.homes.debug.VISIT.cur.rt.ready`, "inside", 60000)) return;
      await g(`(ctx.homes.debug.VISIT.cur.V.held = "pan", true)`);
      await g(`(() => { const c = ctx.homes.debug.VISIT.cur; c.V.exit = "window"; c.rt.leave(); return true; })()`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "back outside", 60000);
      await t.frames(20);
      const b = await g(`${I}.bag`);
      t.check("out of the window holding the frying pan → it's in her bag, in hand (stolen, from that house)", b.length === 1 && b[0].id === "pan" && b[0].stolen && b[0].from === key && (await g(`${I}.hand`)) === "pan", JSON.stringify(b));
      t.check("…drawn in her hand", await t.until(`__lulu3d.ctx.houseitems.debug.prop()`, "the pan in her hand", 10000));
    });

    await step("BONK", async () => {
      await stand(...(await g(`(() => { const h = ctx.homes.household(${K}); const dx = h.ap.x - h.door.x, dz = h.ap.z - h.door.z, d = Math.hypot(dx, dz) || 1; return [h.ap.x + dx / d * 30, h.ap.z + dz / d * 30]; })()`)));
      await t.frames(4);
      await g(`(() => { const p = ctx.foot.pos; return ctx.foot.startChase({ x: p.x + 2, z: p.z + 1.5 }); })()`);
      await t.until(`!!__lulu3d.ctx.foot.debug.F.chase`, "a cop chasing her", 10000);
      await g(`(() => { const F = ctx.foot.debug.F; F.chase.p.obj.position.set(ctx.foot.pos.x + 2, 0, ctx.foot.pos.z + 1); return true; })()`);
      const r = await g(`${I}.use()`);
      t.check("BONK: the chasing cop stops (his hat spins)", r && r.verb === "BONK" && r.target === "cop" && await g(`ctx.foot.debug.F.chase.stunT > 0`), JSON.stringify(r));
      t.check("…the pan isn't used up", (await g(`${I}.hand`)) === "pan");
      await g(`(() => { const F = ctx.foot.debug.F; if (F.chase) { ctx.scene.remove(F.chase.p.obj); F.chase = null; } return true; })()`);
    });

    await step("EAT + the cap", async () => {
      const heals = [];
      for (let k = 0; k < 3; k++) {
        await g(`(${I}.add("kugel", null, false), ctx.G.hearts = Math.max(1, ctx.G.maxHearts - 1), true)`);
        const h0 = await g(`ctx.G.hearts`);
        const r = await g(`${I}.use()`);
        heals.push([r && r.verb, (await g(`ctx.G.hearts`)) - h0]);
      }
      t.check("EAT: a kugel = a heart back, then the per-run cap (2)", heals[0][0] === "EAT" && heals[0][1] === 1 && heals[1][1] === 1 && heals[2][1] === 0, JSON.stringify(heals));
      t.check("…eaten = gone", !(await g(`${I}.bag`)).some(x => x.id === "kugel"));
    });

    await step("DROP", async () => {
      await g(`(ctx.G.hearts = ctx.G.maxHearts, ${I}.add("kugel", null, false), true)`);
      await g(`(() => { const p = ctx.foot.pos; return ctx.foot.startChase({ x: p.x + 20, z: p.z + 6 }); })()`);
      await t.until(`!!__lulu3d.ctx.foot.debug.F.chase`, "a cop chasing her", 10000);
      const r = await g(`${I}.use()`);
      t.check("DROP (full hearts): a kugel on the pavement — the chasing cop stops to look", r && r.verb === "DROP" && await g(`ctx.foot.debug.F.chase.stunT > 3`), JSON.stringify(r));
      await g(`(() => { const F = ctx.foot.debug.F; if (F.chase) { ctx.scene.remove(F.chase.p.obj); F.chase = null; } return true; })()`);
    });

    await step("GIVE back to its owner", async () => {
      const f0 = await g(`(ctx.homes.family(${K}) || {}).favours | 0`);
      await g(`(${I}.add("kugel", ${K}, true), ${I}.debug.R.force.give = { kind: "neighbour", owner: true, obj: ctx.foot.obj }, true)`);
      const r = await g(`${I}.use()`);
      await g(`(${I}.debug.R.force.give = null, true)`);
      t.check("GIVE: the owner gets their kugel back (\"THAT'S MY KUGEL!\") — homes remembers a favour", r && r.verb === "GIVE" && ((await g(`(ctx.homes.family(${K}) || {}).favours | 0`)) === f0 + 1), JSON.stringify(r));
    });

    await step("in front of its owner", async () => {
      const h = await g(`ctx.homes.household(${K})`);
      { const dx = h.ap.x - h.door.x, dz = h.ap.z - h.door.z, d = Math.hypot(dx, dz) || 1; await stand(h.ap.x + dx / d * 3, h.ap.z + dz / d * 3); } await t.frames(4);
      const k0 = await g(`(ctx.homes.family(${K}) || {}).kept | 0`);
      const r = await g(`${I}.use()`);
      t.check("the pan in front of its own family's door → they notice (WEAR, and homes remembers)", r && r.verb === "WEAR" && (await g(`${I}.debug.R.log.some(e => e.ev === "owner")`)) && ((await g(`(ctx.homes.family(${K}) || {}).kept | 0`)) === k0 + 1), JSON.stringify(r));
      t.check("…on her head now", (await g(`${I}.debug.worn()`)) === "pan");
      await g(`${I}.use()`);
      t.check("…and off again", (await g(`${I}.debug.worn()`)) === null);
    });

    await step("the button + swap", async () => {
      await stand(...(await g(`(() => { const h = ctx.homes.household(${K}); const dx = h.ap.x - h.door.x, dz = h.ap.z - h.door.z, d = Math.hypot(dx, dz) || 1; return [h.ap.x + dx / d * 30, h.ap.z + dz / d * 30]; })()`)));
      await g(`(${I}.add("chicken", null, true), true)`);
      t.check("two things: the newest in hand", (await g(`${I}.hand`)) === "chicken");
      await g(`${I}.swap()`);
      t.check("swap → the pan", (await g(`${I}.hand`)) === "pan");
      const p0 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}").pepperSpray`);
      const n0 = await g(`${I}.debug.R.log.filter(e => e.ev === "use").length`);
      await t.key("KeyG"); await t.frames(40);
      t.check("the item button uses what's in hand (once, after a beat)", (await g(`${I}.debug.R.log.filter(e => e.ev === "use").length`)) === n0 + 1);
      const p1 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}").pepperSpray`);
      t.check("…and doesn't spray pepper meanwhile", p1 === p0, `${p0} → ${p1}`);
      await t.key("KeyG"); await t.frames(3); await t.key("KeyG"); await t.frames(30);
      t.check("twice quickly → swap", (await g(`${I}.hand`)) === "chicken");
    });

    await step("round 2: new pickups in houses", async () => {
      const keys = await g(`ctx.homes.homes().filter(h => h.status === null && h.cast.includes("mom")).slice(1, 4).map(h => h.key)`);
      let got = null;
      for (const k of keys) {
        const h = await g(`ctx.homes.household(${JSON.stringify(k)})`);
        await stand(h.ap.x, h.ap.z); await t.frames(4);
        await g(`ctx.homes.enter(${JSON.stringify(k)}, "sneak", "window")`);
        if (!await t.until(`__lulu3d.state === "interior" && __lulu3d.ctx.homes.debug.VISIT.cur && __lulu3d.ctx.homes.debug.VISIT.cur.rt.ready`, "inside", 60000)) return;
        const extra = await g(`Object.keys(ctx.homes.debug.VISIT.cur.V.items).filter(id => ${I}.debug.ITEMS[id] && ${I}.debug.ITEMS[id].make)`);
        t.check(`a house has two of the new things to pick up (${extra.join(", ")})`, extra.length === 2, JSON.stringify(extra));
        if (extra.length && !got) { got = extra[0]; await g(`(ctx.homes.debug.VISIT.cur.V.held = ${JSON.stringify(got)}, true)`); }
        await g(`(() => { const c = ctx.homes.debug.VISIT.cur; c.V.exit = "window"; c.rt.leave(); return true; })()`);
        await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "back outside", 60000);
        await t.frames(10);
        if (got) break;
      }
      t.check(`…and one comes out with her (${got})`, !!got && (await g(`${I}.hand`)) === got);
      t.check("…its code-built prop is in her hand", await t.until(`__lulu3d.ctx.houseitems.debug.prop()`, "the prop", 10000));
    });

    await step("from the car", async () => {
      await g(`(${I}.debug.clear(), ${I}.add("lampshade", null, true), ${I}.add("chicken", null, true), ${I}.add("balloon", null, true), true)`);
      if (!await g(`ctx.foot.debug.getIn()`)) { t.check("back in her car", false); return; }
      if (!await t.until(`__lulu3d.state === "playing"`, "driving", 30000)) return;
      await t.frames(10);
      t.check("the swap cycle includes her pepper spray (3 things + 🌶️)", (await g(`${I}.slots()`)) === 4);
      // the water balloon (in hand): at a road-rager → soaked
      await g(`(${I}.debug.R.force.toss = { kind: "rager", hit() { window.__soaked = 1; } }, true)`);
      const pep0 = await t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}").pepperSpray`);
      await t.key("KeyG"); await t.frames(6);
      t.check("the item button at the wheel: the balloon out of the window at the road-rager (soaked)", (await g(`${I}.debug.R.log.filter(e => e.ev === "use").pop()`)).verb === "CAR:TOSS" && await g(`window.__soaked === 1`));
      t.check("…no pepper sprayed meanwhile", (await t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}").pepperSpray`)) === pep0);
      await g(`(${I}.debug.R.force.toss = null, true)`);
      // the rubber chicken on the horn
      await g(`(${I}.debug.S.hand = ${I}.debug.S.bag.findIndex(x => x.id === "chicken"), true)`);
      const r1 = await g(`${I}.useCar()`);
      t.check("the rubber chicken goes on the horn (her honk squeaks this drive)", r1 && r1.verb === "CAR:HORN" && await g(`${I}.debug.R.chickenHorn === true`));
      // the lampshade: on her head while driving, and off again
      await g(`(${I}.debug.S.hand = ${I}.debug.S.bag.findIndex(x => x.id === "lampshade"), true)`);
      await g(`${I}.useCar()`);
      t.check("the lampshade on her head at the wheel", await g(`!!(ctx.car.attached && ctx.car.attached.head) && ${I}.debug.R.carWorn === "lampshade"`));
      await g(`${I}.useCar()`);
      t.check("…and off", await g(`!(ctx.car.attached && ctx.car.attached.head) && ${I}.debug.R.carWorn === null`));
      // rugelach to Avigail riding shotgun
      await g(`(${I}.add("rugelach", null, false), ctx.G.avigailRide = true, true)`);
      const r2 = await g(`${I}.useCar()`);
      t.check("rugelach handed to Avigail in the passenger seat", r2 && r2.verb === "CAR:GIVE_AVIGAIL" && r2.target === "avigail" && !(await g(`${I}.bag`)).some(x => x.id === "rugelach"));
      await g(`(ctx.G.avigailRide = false, true)`);
      // a kugel at a chasing cruiser behind her: it swerves for it
      await g(`(${I}.add("kugel", null, false), true)`);
      const cop = await g(`(() => { const c = ctx.traffic.add("cop", ctx.car.s - 20, ctx.car.d, 1, 12, {}); return !!c; })()`);
      const r3 = await g(`${I}.useCar()`);
      t.check("a kugel out of the window: the cruiser behind her swerves for it", cop && r3 && r3.target === "cop", JSON.stringify(r3));
    });

    t.check("nothing pays coins", (await g(`ctx.G.coins`)) === c0, `${c0} → ${await g(`ctx.G.coins`)}`);
  },
};
