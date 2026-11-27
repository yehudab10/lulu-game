// 🏪 Player-owned shops, stage 1 (features/playershops — client only; the plan: 3d/docs/playershops-plan.md): FOR LEASE
// storefronts in town, the landlord (lease: two presses), Midwood's cap of one (Marxdani's edict — struck down → two),
// licences per kind, the 📦 depot into her car (what the car holds), carrying boxes in, baking (⭐), shelving by hand at
// a price inside the band, the lease's daily payment + three missed days → the locks, handing the keys back (deposit).
// Nobody buys yet (stage 2: only real players, through the relay — waiting for the owner's OK).
module.exports = {
  name: "playershops",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,foot,day,town,decor,cityhall,places,parking,onegame,exits",
  save2d: { totalCoins: 50000 },
  async run(t) {
    const g = t.game;
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    /** Answer a dialogue: for each regex in order, tap through lines until options show, then click the first match. */
    async function flow(res, max = 80) {
      let k = 0;
      for (let i = 0; i < max && k < res.length; i++) {
        const o = await opts();
        if (o.length) {
          const idx = o.findIndex(x => res[k].test(x));
          if (idx < 0) { t.check(`(dialog) an option matching ${res[k]}`, false, JSON.stringify(o)); return false; }
          await t.L(`(b => b && b.click())([...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${idx}])`);
          k++; await t.frames(3); continue;
        }
        if (!await g(`ctx.dialogOpen`)) { await t.frames(4); continue; }
        await t.tap(0); await t.frames(2);
      }
      return k === res.length;
    }
    const drain = async (n = 16) => { for (let i = 0; i < n && await g(`ctx.dialogOpen`); i++) { if ((await opts()).length) return; await t.tap(0); await t.frames(2); } };
    const P = "ctx.playershops";

    // ▶ PLAY: on foot at home in Midwood
    await g(`L3.setState("title")`);
    await t.frames(10);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "midwood"`, "home in Midwood", 60000)) return;
    await g(`(${P}.debug.clear(), true)`);
    const st = await g(`({ stores: ctx.town.stores.length, lease: ${P}.leasable().length, keys: [...new Set(ctx.town.stores.map(s => s.key))] })`);
    t.check("Midwood's plain storefronts are listed (ctx.town.stores)", st.stores >= 6, JSON.stringify(st));
    t.check("…the FOR LEASE ones are ci/storefronts' (a few at least)", st.lease >= 4, JSON.stringify(st));
    await t.frames(30);
    const cl = await g(`(() => { const v = [...${P}.debug.CL.values()]; return { lease: v.filter(x => x === "lease").length, n: ${P}.leasable().length, sf: ctx.storefronts ? ctx.storefronts.leasable().length : -1 }; })()`);
    t.check("…each claimed through ctx.storefronts (its ✋ → our landlord)", cl.lease === cl.n && cl.n > 0 && cl.sf === 0, JSON.stringify(cl));

    // the ✋ at a FOR LEASE front
    const F = await g(`(() => { const f = ${P}.leasable()[0]; return { id: f.id, ap: f.ap, nx: f.nx, nz: f.nz, address: f.address }; })()`);
    await g(`(() => { const Fp = ctx.foot.debug.F; Fp.pos.set(${F.ap.x} - ${F.nx} * 0.4, 0.05, ${F.ap.z} - ${F.nz} * 0.4); ctx.foot.obj.position.copy(Fp.pos); ctx.foot.obj.rotation.y = Math.atan2(-(${F.nx}), -(${F.nz})); Fp.h = ctx.foot.obj.rotation.y; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
    await t.frames(20);
    const lab0 = String(await g(`((ctx.foot.debug.interactables() || {}).label || "")`));
    t.check("✋ at the door: 🪧 FOR LEASE (the storefront's ✋, our line)", /FOR LEASE/.test(lab0), lab0);
    await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } window.__camAt = [${F.ap.x} + (${F.nx}) * 6, 2.4, ${F.ap.z} + (${F.nz}) * 6, ${F.ap.x} - (${F.nx}) * 2, 1.4, ${F.ap.z} - (${F.nz}) * 2]; return true; })()`);
    await t.frames(10);
    await t.shot("for-lease");
    await t.L(`(window.__camAt = null, true)`);

    // lease it: two presses (Lease it → kind → ✅ Sign)
    const c0 = await g(`L3.wallet.coins`);
    await g(`(${P}.debug.landlord(${P}.debug.frontById(${JSON.stringify(F.id)})), true)`);
    t.check("the landlord: lease → a kugel shop → sign", await flow([/Lease it/, /kugel shop/, /Sign the lease/]));
    await drain();
    const sh = await g(`${P}.debug.S.shops[${JSON.stringify(F.id)}]`);
    t.check("…it's hers: a kugel shop on a lease", !!sh && sh.kind === "kugel" && sh.how === "lease", JSON.stringify(sh && { kind: sh.kind, how: sh.how }));
    t.check("…the deposit taken (300)", c0 - await g(`L3.wallet.coins`) === 300, `${c0} → ${await g(`L3.wallet.coins`)}`);
    t.check("…City Hall wants a permit", await g(`!!(ctx.cityhall && ctx.cityhall.permits && ctx.cityhall.permits.PM && JSON.stringify(ctx.cityhall.permits.PM).includes('"shop"'))`) || await g(`JSON.stringify(ctx.cityhall.debug.S.permits || {}).includes('"shop"')`));
    t.check("licences: Midwood has 2 kugel licences → 1 left", await g(`${P}.licencesLeft("midwood", "kugel")`) === 1);
    await t.frames(20);
    await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } window.__camAt = [${F.ap.x} + (${F.nx}) * 9, 3.4, ${F.ap.z} + (${F.nz}) * 9, ${F.ap.x} - (${F.nx}) * 2, 2.0, ${F.ap.z} - (${F.nz}) * 2]; return true; })()`);
    await t.frames(10);
    await t.shot("my-shop-front");
    await t.L(`(window.__camAt = null, true)`);

    // the cap: Midwood allows one (the edict) — struck down in court → two
    t.check("Midwood: a second shop is refused (Marxdani's edict)", /One shop per person/.test(await g(`${P}.capBlock("midwood")`)));
    await g(`(ctx.cityhall.mayor31.strike("shops"), true)`);
    t.check("…the court strikes the edict down → Midwood allows 2", await g(`${P}.capOf("midwood")`) === 2 && (await g(`${P}.capBlock("midwood")`)) === "");
    t.check("Lakewood allows 3", await g(`${P}.capOf("lakewood")`) === 3);

    // the depot: what her car holds, two presses a box
    t.check("what her car holds: a regular car 6", await g(`${P}.carCap()`) === 6);
    await g(`(ctx.car.__sk = ctx.car.skinKey, ctx.car.skinKey = "minivan", true)`);
    t.check("…Ima's minivan 12", await g(`${P}.carCap()`) === 12);
    await g(`(ctx.car.skinKey = "mazelati", true)`);
    t.check("…a Mazelati 2", await g(`${P}.carCap()`) === 2);
    await g(`(ctx.car.skinKey = ctx.car.__sk, true)`);
    const c1 = await g(`L3.wallet.coins`);
    await g(`(${P}.debug.depotTalk(), true)`);
    t.check("📦 the depot: ingredients for potato kugel, loaded, twice", await flow([/Ingredients: potato kugel/, /Load it/, /Ingredients: potato kugel/, /Load it/, /That's all/]));
    await drain();
    t.check("…2 boxes in the car", await g(`${P}.carBoxes()`) === 2);
    t.check("…paid 2 × 48", c1 - await g(`L3.wallet.coins`) === 96, `${c1} → ${await g(`L3.wallet.coins`)}`);

    // carried in (≤ 3 a trip) → baked → shelved by hand
    t.check("carried in from the car", await g(`${P}.debug.carryIn(${JSON.stringify(F.id)})`) === 2);
    await g(`(${P}.debug.ROOM.bakeAuto = 3, true)`);
    await g(`(${P}.debug.enterShop(${P}.debug.frontById(${JSON.stringify(F.id)}), "owner"), true)`);
    if (await t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "inside her shop", 30000)) {
      const hots = await t.L(`window.__interiors.room.hots.map(h => h.id)`);
      t.check("inside: 4 shelf units, the counter, the back room, the oven, the keys", ["shelf:0", "shelf:1", "shelf:2", "shelf:3", "counter", "stock", "oven", "keys"].every(h => hots.includes(h)), JSON.stringify(hots));
      await t.L(`(r => { r.hots.find(h => h.id === "oven").action(r); return true; })(window.__interiors.room)`);
      t.check("🔥 the oven: bake the kugel ingredients", await flow([/potato kugel/]));
      await drain();
      const stock = await g(`${P}.debug.S.shops[${JSON.stringify(F.id)}].stock`);
      t.check("…4 potato kugels, ⭐⭐⭐", stock.some(x => x.g === "kugel" && x.n === 4 && x.stars === 3 && !x.ing), JSON.stringify(stock));
      await t.L(`(r => { r.hots.find(h => h.id === "shelf:0").action(r); return true; })(window.__interiors.room)`);
      t.check("🧺 shelf 1: spot 1 → the kugels → a price", await flow([/^1\. \(empty\)/, /potato kugel ×4/, /🏷️/]));
      await drain();
      const s0 = await g(`${P}.debug.S.shops[${JSON.stringify(F.id)}].shelf[0]`), band = await g(`${P}.debug.band("kugel", 3)`);
      t.check("…on the shelf: 4 kugels at a price inside the band", !!s0 && s0.g === "kugel" && s0.n === 4 && s0.price >= band[0] && s0.price <= band[1], JSON.stringify({ s0, band }));
      await t.L(`(r => { r.lulu.obj.position.set(r.data.V.SF - 0.6, 0, 1.2); return true; })(window.__interiors.room)`);
      await t.frames(30);
      await t.shot("inside-shelved");
      await t.L(`(window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out", 15000);
    }

    // the lease's days: due each played day; three missed → the locks (stock home in boxes, the deposit back)
    const C = "ctx.realestate.debug.CLOCK";
    const day = async n => { await g(`(${C}.offset = ${n}, ${P}.debug.dayTick(), true)`); await t.frames(2); };
    const id = JSON.stringify(F.id), sh0 = () => g(`${P}.debug.S.shops[${id}] || {}`);
    const cA = await g(`L3.wallet.coins`);
    await day(1); await t.frames(60);
    t.check("a played day: the lease (60) is paid the moment she has the coins", cA - await g(`L3.wallet.coins`) === 60 && !(await sh0()).due, `${cA} → ${await g(`L3.wallet.coins`)}`);
    await g(`(L3.wallet.spend(L3.wallet.coins), true)`);
    await day(2); await day(3); await day(4);
    t.check("…no coins: two days missed (a note under the door)", (await sh0()).missed === 2, JSON.stringify(await sh0()).slice(0, 120));
    t.check("…the kugels went stale on day 4 (food lasts 3 real days): off the shelf", !(await sh0()).shelf[0]);
    await day(5);
    t.check("…three missed → the landlord changes the locks", !(await g(`${P}.owns(${id})`)));
    t.check("…the deposit back (300)", await g(`L3.wallet.coins`) === 300, String(await g(`L3.wallet.coins`)));
    await g(`(${C}.offset = 0, L3.wallet.add(40000), true)`);

    // ── Lakewood (three allowed): buy a building for cash, another on the bank's mortgage ──
    await g(`(ctx.town.load("lakewood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 120000);
    await g(`(ctx.foot.active && ctx.foot.end("test"), L3.setState("playing"), ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood", 0), speed: 0 }), true)`);
    if (await t.until(`__lulu3d.ctx.town.id === "lakewood" && __lulu3d.ctx.playershops.leasable().length > 1`, "in Lakewood", 30000)) {
      const L = await g(`(() => { const l = ${P}.leasable(); return { n: l.length, a: l[0].id, b: l[1].id, keys: [...new Set(ctx.town.stores.map(s => s.key))] }; })()`);
      t.check("Lakewood: storefronts FOR LEASE (≥ 2)", L.n >= 2, JSON.stringify(L));
      const cB = await g(`L3.wallet.coins`);
      await g(`(${P}.debug.landlord(${P}.debug.frontById(${JSON.stringify(L.a)})), true)`);
      t.check("buy the building for cash: Buy → handy things → Cash → ✅", await flow([/Buy the building/, /handy things/, /^💰 Cash/, /Buy it/]));
      await drain();
      t.check("…it's hers (owned), 14,000 paid", await g(`(${P}.debug.S.shops[${JSON.stringify(L.a)}] || {}).how`) === "own" && cB - await g(`L3.wallet.coins`) === 14000, `${cB} → ${await g(`L3.wallet.coins`)}`);
      t.check("…City Hall taxes the building with her homes", await g(`${P}.taxed().some(x => x.id === ${JSON.stringify(L.a)})`));
      await g(`(${P}.debug.landlord(${P}.debug.frontById(${JSON.stringify(L.b)})), true)`);
      t.check("another on a mortgage: Buy → party goods → 🏦 a plan → ✅ Sign", await flow([/Buy the building/, /party goods/, /^🏦/, /Sign/]));
      await drain();
      t.check("…hers, with a mortgage at the same bank as her homes", await g(`!!${P}.debug.S.shops[${JSON.stringify(L.b)}] && ctx.realestate.debug.MG.mortgages().some(m => m.id === ${JSON.stringify(L.b)})`));
      t.check("…Lakewood: one more allowed (3)", (await g(`${P}.capBlock("lakewood")`)) === "");
      await t.frames(20);
      await t.shot("lakewood-shops");
    }

    // ── the 📦 depot stand at a rest area ──
    await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("highway"), L3.startRun({ mode: "cruise", quick: true }), true)`);
    await t.until(`!__lulu3d.ctx.town.active && __lulu3d.state === "playing"`, "on the highway (Cruise)", 15000);
    await g(`ctx.exits.debug.restAhead(260)`);
    if (await t.until(`__lulu3d.ctx.parking.debug.courses().length > 0`, "a rest area's lot", 12000)) {
      const bo = (await g(`ctx.parking.debug.courses()`))[0];
      await g(`ctx.foot.start("droveOff", { noIntro: true })`);
      await t.until(`__lulu3d.state === "footRun"`, "on foot", 4000);
      const place = (x, z, hint) => g(`(() => { const F = ctx.foot.debug.F, n = ctx.world.road.nearest(${x}, ${z}, ${hint}, {}); F.pos.set(${x}, 0.05, ${z}); F.s = n.s; F.d = n.d; F.vel.set(0, 0, 0); return true; })()`);
      await place(bo.bx, bo.bz, bo.s + 160);
      await t.frames(40);
      const sp = await g(`(() => { const D = ${P}.debug.DEPOT_STATE; if (!D.at) return null; const c = D.at, x = c.O.x + (14.7 + 4.2 - 1.6) * c.cos + (6.6 + 0.6) * c.sin, z = c.O.z - (14.7 + 4.2 - 1.6) * c.sin + (6.6 + 0.6) * c.cos; return { x, z }; })()`);
      t.check("the depot stands in the rest area's lot", !!sp);
      if (sp) {
        await place(sp.x, sp.z, bo.s + 160);
        await t.frames(20);
        const lab = await g(`((ctx.foot.debug.interactables() || {}).label || "")`);
        t.check("…✋ FELDMAN'S WHOLESALE (her car's boxes)", /FELDMAN/.test(lab), lab);
        await t.shot("depot");
      }
    }
    t.check("nothing went below zero", (await g(`L3.wallet.coins`)) >= 0);
  },
};
