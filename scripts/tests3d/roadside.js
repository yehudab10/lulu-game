// 🚔🚑 Roadside places (features/places/roadside.js, ci/roadside): jail, court and the ER on the HIGHWAY.
//   • three pull-offs, once a lap at fixed lap metres + fixed addresses: Hatzalah 4.8 km, Trooper Post 13 + the Highway
//     Traffic Court 13.2 km, Doc-in-a-Box 15.4 km — on the 📱 🗺️ map, a sign before each
//   • ONE rule (ctx.civic.nearest): the nearest place of the kind along the lap, either way, towns included
//   • knocked out at 6 km → wakes at Hatzalah (not Midwood); arrested at 13 km on lap 2 → the trooper post → court in the
//     trailer → jail → out of ITS door, her car behind ITS impound fence; arrested at 2 km → still Midwood's precinct
//   • walking in freely (✋ at each door → its own room), out of the same door
module.exports = {
  name: "roadside",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cameos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game, D = "ctx.law._dbg", LAP = 16000;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const CELL = `__lulu3d.ctx.law._dbg.jail && __lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
    const resetLaw = () => g(`(() => { const D = ${D}; for (const k of Object.keys(D.FORCE)) delete D.FORCE[k]; D.FORCE.quietCourt = true; ctx.law.clearHeat && ctx.law.clearHeat("test", { lowKey: false }); return true; })()`);
    const curtain = () => t.L(`(() => { const o = []; for (const id of ["townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && +getComputedStyle(e).opacity > 0.4) o.push(id); } return o; })()`);
    async function talk(untilCode, label, pickRe = null, max = 300) {
      for (let i = 0; i < max; i++) {
        if (await g(untilCode)) return true;
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length) {
          const idx = pickRe ? opts.findIndex(o => pickRe.test(o)) : 0;
          if (idx >= 0) { await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${idx}].click()`); await t.frames(3); continue; }
        }
        await t.tap(0);
      }
      t.check(label, false, "never reached: " + untilCode + " · state " + await st());
      return false;
    }
    /** On the highway at metre s, standing still in the right lane, the world built there. */
    const hwAt = async s => {
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(6); await playing(); }
      await g(`(() => { const c = ctx.car, p = ctx.world.highway.point(${s}, 5.25, {}); c.place(p.x, p.z, p.h); c.s = ${s}; c.d = 5.25; c.vx = c.vz = c.vF = 0; ctx.world.prebuild(${s}); ctx.cam.snap(); return true; })()`);
      await t.frames(20);
    };
    /** Out on foot at a ROADSIDE place's door (on the highway, not in a town); her car parked out front or not. */
    const outHw = async (door, hw, car, label) => {
      if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${label}: out on foot`, 120000)) return false;
      t.check(`${label}: on the highway (no town)`, !(await g(`ctx.town.active`)), await g(`ctx.town.active ? ctx.town.id : "highway"`));
      const d = await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(door)}), p = ctx.foot.pos; return sp && p && sp.hw === ${JSON.stringify(hw)} ? +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1) : -1; })()`);
      t.check(`${label}: she walks out of ${hw}'s ${door} door (${d} m from it)`, d >= 0 && d < 6);
      if (car) {
        const cd = await g(`(() => { const F = ctx.foot.debug.F, sp = ctx.civic.spot(${JSON.stringify(door)}); return F.car && F.car.stub ? +Math.hypot(F.car.stub.x - sp.x, F.car.stub.z - sp.z).toFixed(1) : -1; })()`);
        t.check(`${label}: her car is in a stall out front (${cd} m) and drivable`, cd >= 0 && cd < 18 && await g(`ctx.foot.ownCar === "parked"`), await g(`ctx.foot.ownCar`));
      } else t.check(`${label}: no car to drive off in`, await g(`ctx.foot.ownCar === "gone"`), await g(`ctx.foot.ownCar`));
      await t.frames(24);
      t.check(`${label}: no black curtain while she has control`, (await curtain()).length === 0, JSON.stringify(await curtain()));
      return true;
    };

    // ════ 0. data: three places, fixed addresses, THE rule, the map ════
    t.check("ctx.civic knows the roadside places", await g(`ctx.civic.roadside.map(R => R.addr + "@" + R.m).join(",")`) === "hw:hatzalah@4800,hw:trooper@13200,hw:clinic@15400");
    const rule = await g(`[[2000, "law"], [2000, "er"], [6000, "er"], [6000, "law"], [13000, "law"], [13000, "er"], [14200, "er"], [9000, "law"], [15900, "law"]].map(([m, k]) => { const n = ctx.civic.nearest(k, m); return m + k + ":" + (n.town || n.hw.id); }).join(",")`);
    t.check("THE rule — nearest along the lap, either way, towns included", rule === "2000law:midwood,2000er:midwood,6000er:hatzalah,6000law:midwood,13000law:trooper,13000er:lakewood,14200er:clinic,9000law:lakewood,15900law:trooper", rule);
    t.check("the interiors exist (trooper post, traffic court, Hatzalah, Doc-in-a-Box)", await g(`["roadsideTrooper", "roadsideCourt", "roadsideHatzalah", "roadsideClinic"].every(k => !!ctx.interiors[k])`));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts", 60000)) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    const map = await t.L(`import("./js/features/world/lapmap.js").then(m => m.lapPlaces().filter(p => p.kind === "roadside").map(p => p.addr + "@" + p.m).join(","))`);
    t.check("📱 🗺️ the lap map lists them", map === "hw:hatzalah@4800,hw:trooper@13200,hw:clinic@15400", map);

    // ════ 1. the buildings stand at their lap metre on lap 2, with a sign before each ════
    await step("buildings", async () => {
      await hwAt(LAP + 13200 - 70);
      const sp = await g(`ctx.places.spots().filter(s => /^roadside_/.test(s.id)).map(s => s.id + "@" + s.s + (s.built ? "+" : "-"))`);
      t.check("Trooper Post 13 stands at lap 2's 13.2 km (built)", sp.includes("roadside_trooper@29200+"), JSON.stringify(sp));
      t.check("its doors: precinct, court (hw:court), impound (a car bay)", await g(`(() => { const a = ctx.civic.spot("precinct"), b = ctx.civic.spot("court"), c = ctx.civic.spot("impound"); return !!a && a.addr === "hw:trooper" && !!b && b.addr === "hw:court" && !!c && !!c.car; })()`));
      t.check("a sign before it (190 m)", await g(`ctx.world.signs.some(s => Math.abs(s.s - (29200 - 190)) < 2 && /TROOPERS/.test((s.lines || []).join(" ")))`));
      await g(`(() => { const sp = ctx.civic.spot("precinct"), c = ctx.camera; window.__camAt = [sp.x + sp.nx * 38 + sp.ux * 8, 12, sp.z + sp.nz * 38 + sp.uz * 8, sp.x - sp.nx * 4 + sp.ux * 10, 2, sp.z - sp.nz * 4 + sp.uz * 10];
        const r = L3.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, cam) => { const V = window.__camAt; if (V && cam === c) { cam.position.set(V[0], V[1], V[2]); cam.lookAt(V[3], V[4], V[5]); cam.updateMatrixWorld(); } o(s, cam); }; } return true; })()`);
      await t.frames(4); await t.shot("trooper-post"); await t.L(`window.__camAt = null`);
    });

    // ════ 2. arrested at 13 km on LAP 2 → the trooper post → the trailer court → jail → out of ITS door, car in ITS impound ════
    await step("arrest at 13 km (lap 2)", async () => {
      await resetLaw();
      await hwAt(LAP + 13000);
      const c0 = await coins();
      await g(`(${D}.FORCE.verdict = "jail", ctx.law.arrest(["SPEEDING ROUND THE LOOP"], { skipCinematic: true }))`);
      if (!await talk(CELL, "booked (13 km)")) return;
      const P = await g(`ctx.civic.place && Object.assign({}, ctx.civic.place)`);
      t.check("taken to Trooper Post 13 — lap 2's copy (s 29200), not Lakewood", !!P && P.hw === "trooper" && P.s === LAP + 13200, JSON.stringify(P));
      await t.L(`window.__dlg = []; window.__dlgT = setInterval(() => { const e = document.querySelector("#dialog"); if (e && e.textContent) { const s = e.textContent.slice(0, 160); if (window.__dlg[window.__dlg.length - 1] !== s) window.__dlg.push(s); } }, 120)`);
      await t.L(`document.querySelector("#lawCourtBtn").click()`);
      await talk(`__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "serve"`, "guilty → serving", /./);
      const dl = await t.L(`(clearInterval(window.__dlgT), window.__dlg.join(" ¦ "))`);
      t.check("court is the Highway Traffic Court: Judge Kessler's tee time", /tee time|trailer|putter|1:40/i.test(dl), dl.slice(0, 300));
      await g(`${D}.jail().serve.serveDays = ${D}.jail().serve.total - 1`);
      for (let i = 0; i < 6; i++) await t.tap(0);
      if (!await outHw("precinct", "trooper", false, "served (13 km)")) return;
      const imp = await g(`(() => { const o = ctx.civic.debug.impoundedCar(), sp = ctx.civic.spot("impound"); return o && sp && sp.car ? +Math.hypot(o.position.x - sp.car.x, o.position.z - sp.car.z).toFixed(1) : -1; })()`);
      t.check(`her car is behind Trooper Post 13's impound fence (${imp} m from its bay)`, imp >= 0 && imp < 0.5);
      t.check(`…the same fines as anywhere (no new coins: ${c0} → ${await coins()})`, (await coins()) <= c0);
      t.check("…and she's on lap 2 by the post (s ≈ 29200)", Math.abs((await g(`ctx.foot.debug.F.s`)) - (LAP + 13200)) < 80, String(await g(`ctx.foot.debug.F.s`)));
      await t.shot("out-of-trooper-post");
    });

    // ════ 3. knocked out at 6 km → Hatzalah (not Midwood), out of its door ════
    await step("ER at 6 km", async () => {
      await resetLaw();
      await hwAt(6000);
      const c0 = await coins();
      await g(`ctx.er.admit("knockout", { force: { intro: false, visitor: false } })`);
      if (!await t.until(`__lulu3d.state === "cameosER"`, "the ER (6 km)", 60000)) return;
      const P = await g(`ctx.civic.place && Object.assign({}, ctx.civic.place)`);
      t.check("the ER is Hatzalah Highway Station (4.8 km), not Midwood", !!P && P.kind === "er" && P.hw === "hatzalah" && P.s === 4800, JSON.stringify(P));
      if (!await talk(`__lulu3d.state === "footRun"`, "discharged (Hatzalah)", /patch|GOOD|scan|cholent|cheapest|Bandage|works|Set|Pocket|concussed|VIP/)) return;
      await outHw("hospital", "hatzalah", true, "Hatzalah");
      t.check(`the bill as always (${c0} → ${await coins()})`, (await coins()) <= c0);
      await t.shot("out-of-hatzalah");
    });

    // ════ 4. arrested at 2 km → still Midwood's precinct (the town is nearest) ════
    await step("arrest at 2 km → Midwood", async () => {
      await resetLaw();
      await hwAt(2000);
      await g(`ctx.law.arrest(["DOUBLE PARKING AT THE GAS 'N' GO"], { skipCinematic: true })`);
      if (!await talk(CELL, "booked (2 km)")) return;
      const P = await g(`ctx.civic.place && Object.assign({}, ctx.civic.place)`);
      t.check("taken to Midwood's precinct (3.6 km beats the trooper post round the lap)", !!P && P.id === "midwood" && !P.hw, JSON.stringify(P));
      await t.L(`document.querySelector("#lawBail").click()`);
      if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "bail (2 km): out on foot", 120000)) return;
      t.check("…out in Midwood", await g(`ctx.town.active && ctx.town.id === "midwood"`));
    });

    // ════ 5. walking in freely: each door → its own room → back out of the same door ════
    for (const [s, door, hw, room] of [[15400 - 40, "hospital", "clinic", "roadsideClinic"], [13200 - 40, "precinct", "trooper", "roadsideTrooper"], [13200 - 40, "court", "trooper", "roadsideCourt"], [4800 - 40, "hospital", "hatzalah", "roadsideHatzalah"]]) {
      await step(`walk in: ${room}`, async () => {
        await resetLaw();
        await hwAt(s);
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        if (!await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000)) return;
        await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(door)}), F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); F.phase = "walk"; return true; })()`);
        await t.frames(8);
        const p = await t.L(`(() => { const e = document.querySelector("#prompt") || document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);
        t.check(`✋ ${hw}'s ${door} door is offered (${JSON.stringify(p).slice(0, 60)})`, /ENTER/i.test(p));
        await g(`ctx.civic.enter(${JSON.stringify(door)})`);
        if (!await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === ${JSON.stringify(room)}`, `inside ${room}`, 60000)) return;
        await t.frames(20);
        await t.shot("room-" + room);
        t.check(`${room}: its own people + hotspots`, await t.L(`__interiors.room.people.length >= 2 && __interiors.room.hots.length >= 3`));
        await g(`(window.__interiors.room.leave(), true)`);
        for (let i = 0; i < 20 && await st() !== "footRun"; i++) await t.tap(0);
        await t.until(`__lulu3d.state === "footRun"`, `back out of ${room}`, 30000);
        const d = await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(door)}), p = ctx.foot.pos; return sp && p ? +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1) : -1; })()`);
        t.check(`…back out of the same door (${d} m)`, d >= 0 && d < 7);
      });
    }
  },
};
