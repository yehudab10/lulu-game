// 🏛️ Places (features/places, roadmap 4): jail, court and the ER are real places in town.
//   • both towns have a police precinct (+ its impound lot), a courthouse and a hospital — town DATA (uses.civic /
//     uses.hospital → places_* models merged by kit.js, signs in the atlas), their doors are T.spots, 📍 Nearby lists them
//   • walking in freely: ✋ at each door → the interiors engine (police / courthouse lobby / hospital), she stays in town,
//     walks back out of the same door; no black curtain while she has control
//   • the triangle / draw-call cost at the buildings
module.exports = {
  name: "places",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["places:enter", "town:enter", "town:leave", "law:arrest", "law:booked", "law:release", "law:verdict", "er:admit", "places:out"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 160))); })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async (id = "lakewood") => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
    };
    // her car on the street in front of a building, facing it (a shot) or along the street
    const carAt = (kind, dist = 16, face = true) => g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(kind)}); if (!sp) return false; const car = ctx.car;
        const x = sp.x + sp.nx * ${dist}, z = sp.z + sp.nz * ${dist}; const h = ${face} ? Math.atan2(-sp.nx, -sp.nz) : Math.atan2(sp.ux, sp.uz);
        car.place(x, z, h); car.vx = car.vz = 0; const n = ctx.world.road.nearest(x, z, car.s, {}); car.s = n.s; car.d = n.d; ctx.cam.snap(); return true; })()`);
    const onFootAt = async (kind, out = 1.2) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
      await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(kind)}); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${out}, 0.05, sp.z + sp.nz * ${out}); F.phase = "walk"; return true; })()`);
      await t.frames(6);
    };
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, calls: Math.round(P.calls / Math.max(1, P.n)), maxCalls: P.maxCalls, tris: Math.round(P.tris / Math.max(1, P.n)), maxTris: P.maxTris }; })()`);
    };
    // a still of a building from across the street (the chase / foot cameras would sit inside the opposite block): the
    // camera is overridden right before the frame renders
    const view = async (kind, label, side = 10, up = 7, out = 15) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } })()`);
      await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(kind)}); window.__camAt = [sp.x + sp.nx * ${out} + sp.ux * ${side}, ${up}, sp.z + sp.nz * ${out} + sp.uz * ${side}, sp.cx != null ? sp.cx : sp.x, 4, sp.cz != null ? sp.cz : sp.z]; return true; })()`);
      await t.frames(4);
      await t.shot(label);
      await t.L(`window.__camAt = null`);
    };
    // no black curtain while she has control (town's #townFade, the interiors' #intFade, law's fade, flow's dissolve)
    const curtain = () => t.L(`(() => { const o = []; for (const id of ["townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && +getComputedStyle(e).opacity > 0.4) o.push(id); } return o; })()`);
    const promptText = () => t.L(`(() => { const e = document.querySelector("#prompt") || document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);
    // walk in through a door and wait for the room
    const walkIn = async (kind, id) => {
      await onFootAt(kind);
      const p = await promptText();
      t.check(`✋ the ${kind} door is offered at its door (${JSON.stringify(p).slice(0, 60)})`, /ENTER|COURT|POLICE|HOSPITAL/i.test(p) || !!(await g(`ctx.foot.debug.interactables && ctx.foot.debug.interactables()`)));
      await g(`ctx.civic.enter(${JSON.stringify(kind)})`);
      return t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === ${JSON.stringify(id)}`, `inside the ${kind} (${id})`, 60000);
    };
    const walkOut = async (kind) => {
      await g(`(window.__interiors.room.leave(), true)`);
      // (the precinct's sneak-out gag can play on the way out: tap through it)
      for (let i = 0; i < 40 && await st() !== "footRun"; i++) await t.tap(0);
      await t.until(`__lulu3d.state === "footRun"`, `back out of the ${kind} (footRun)`, 30000);
      const d = await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(kind)}), p = ctx.foot.pos; return sp && p ? +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1) : -1; })()`);
      t.check(`…she walks out of the ${kind}'s own door (${d} m from it)`, d >= 0 && d < 7);
      t.check(`…still in town after the ${kind}`, await g(`ctx.town.active`));
      await t.frames(20);
      t.check(`…no black curtain once she's back on the street (${kind})`, (await curtain()).length === 0, JSON.stringify(await curtain()));
    };

    // ════ 0. data ════
    t.check("ctx.civic service is registered", await g(`!!(ctx.civic && ctx.civic.spot && ctx.civic.enter)`));
    for (const id of ["lakewood", "midwood"]) {
      t.check(`${id}: the civic block (precinct + court + impound) and the hospital are TOWN DATA`, await g(`(() => { const T = ctx.town.towns.${id}, u = T.uses; return u.civic.key === "places_precinct" && u.civic.with.some(w => w.key === "places_court" && w.spot === "court") && u.civic.with.some(w => w.key === "places_impound") && u.hospital.key === "places_hospital"
        && Object.values(T.blocks).some(b => b.faces && Object.values(b.faces).includes("civic")) && Object.values(T.blocks).some(b => b.faces && Object.values(b.faces).includes("hospital")); })()`));
    }
    t.check("the interiors exist (police, hospital, the courthouse lobby)", await g(`!!(ctx.interiors.police && ctx.interiors.hospital && ctx.interiors.courthouse)`));
    t.check("the town keeps them (bank.js TOWN_INTERIORS)", await t.L(`fetch("js/features/heist/bank.js").then(r => r.text()).then(s => /TOWN_INTERIORS = new Set\\(\\[[^\\]]*"police"[^\\]]*"hospital"[^\\]]*"courthouse"/.test(s))`));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);

    // (PLACES_PART=3 runs only part 3 — a quicker loop while working on it)
    const part = +(process.env.PLACES_PART || 0);
    // ════ 1. the buildings stand in both towns ════
    for (const id of part === 3 ? [] : ["lakewood", "midwood"]) {
      await step(`${id} buildings`, async () => {
        if (!await town(id)) return;
        t.check(`${id}: the places models are loaded with the town`, await t.L(`import("./js/models.js").then(m => ["places_precinct", "places_court", "places_hospital", "places_impound"].every(k => !!m.models[k]))`));
        for (const k of ["precinct", "court", "hospital", "impound"]) t.check(`${id}: a ${k} spot (its door)`, await g(`!!ctx.civic.spot(${JSON.stringify(k)})`));
        const across = await g(`["precinct", "court", "hospital"].map(k => { const sp = ctx.civic.spot(k), n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {}); return +Math.abs(n.d).toFixed(1); })`);
        t.check(`${id}: every door is on a sidewalk beside a street (|d| ${across})`, across.every(d => d > 4 && d < 16));
        const sights = await g(`(() => { const T = ctx.town, S = T.plan.def.lines.SIGNS; return ["precinct", "court", "hospital"].filter(k => T.spots[k] && Array.isArray(S[k])); })()`);
        t.check(`${id}: 📍 Nearby can list them (a sign + a spot each)`, sights.length === 3, JSON.stringify(sights));
        await carAt("precinct", 4, false);
        await t.frames(8);
        for (const k of ["precinct", "court", "hospital", "impound"]) await view(k, `${id}-${k}`, k === "hospital" ? 14 : 8);
        await view("precinct", `${id}-civic`, -2, 10, 17);
        // the chase camera in the street in front of the civic block (the town / midwood tests hold the town-wide budgets)
        await carAt("precinct", 6, false);
        await t.frames(6);
        const pf = await perf(20), cap = id === "midwood" ? 120000 : 115000;
        console.log(`   PERF places ${id} at the precinct`, JSON.stringify(pf), "static town tris", await g(`Math.round(ctx.town.debug.S.T.tris)`));
        t.check(`${id}: perf at the precinct stays inside the town budget (≤ 240 calls, ≤ ${cap / 1000}k tris)`, pf.maxCalls <= 240 && pf.maxTris <= cap, JSON.stringify(pf));
      });
    }

    // ════ 2. walking in freely (Lakewood + Midwood) ════
    for (const id of part === 3 ? [] : ["lakewood", "midwood"]) {
      await step(`${id} walk in`, async () => {
        if (!await town(id)) return;
        await carAt("precinct", 12, false);
        await t.frames(4);
        if (await walkIn("precinct", "police")) {
          t.check(`${id}: the precinct plays inside the town`, await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`));
          t.check(`${id}: the precinct is named for this town`, await g(`(() => { const n = ctx.civic.names(); return window.__interiors.room.def.name === n.precinct.name; })()`));
          if (id === "lakewood") await t.shot("precinct-inside");
          await walkOut("precinct");
        }
        if (await walkIn("court", "courthouse")) {
          t.check(`${id}: the lobby has the clerk, the bailiff, the bench + the locked 2B`, await g(`(() => { const r = window.__interiors.room; return !!(r.byId.clerk && r.byId.bailiff && r.byId.bench0 && r.hots.some(h => h.id === "doors2b") && r.hots.some(h => h.id === "detector")); })()`));
          const c0 = await coins();
          await g(`(() => { const r = window.__interiors.room; const h = r.hots.find(h => h.id === "detector"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
          for (let i = 0; i < 12; i++) await t.tap(0);
          t.check(`${id}: the lobby pays nothing (coins ${c0} → ${await coins()})`, await coins() === c0);
          if (id === "lakewood") await t.shot("courthouse-lobby");
          await walkOut("court");
        }
        if (await walkIn("hospital", "hospital")) {
          t.check(`${id}: the hospital is named for this town`, await g(`window.__interiors.room.def.name === ctx.civic.names().hospital.name`));
          if (id === "lakewood") await t.shot("hospital-inside");
          await walkOut("hospital");
        }
        await g(`(ctx.foot.end("test"), true)`);
        await t.frames(3);
      });
    }

    // ════ 3. being taken there: arrests, court, the ER — and walking out of the front door ════
    const D = "ctx.law._dbg";
    const CELL = `__lulu3d.ctx.law._dbg.jail && __lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "cell" && !!document.querySelector("#lawEsc")`;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__states = []; m.on("state", e => __states.push(e.to)); })`);
    const states = () => t.L(`window.__states.slice()`);
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
    /** She's out: on foot, in control, by `door` in town `id`; her car (if `car`) parked nearby. */
    const out = async (door, id, car, label) => {
      if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${label}: out on foot`, 120000)) return false;
      t.check(`${label}: in ${id} (not teleported to the highway)`, await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`), await g(`ctx.town.active ? ctx.town.id : "highway"`));
      const d = await g(`(() => { const sp = ctx.civic.spot(${JSON.stringify(door)}), p = ctx.foot.pos; return sp && p ? +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1) : -1; })()`);
      t.check(`${label}: she walks out of the ${door}'s front door (${d} m from it)`, d >= 0 && d < 6);
      if (car) {
        const cd = await g(`(() => { const F = ctx.foot.debug.F, sp = ctx.civic.spot(${JSON.stringify(door)}); return F.car && F.car.stub ? +Math.hypot(F.car.stub.x - sp.x, F.car.stub.z - sp.z).toFixed(1) : -1; })()`);
        t.check(`${label}: her car is parked at the kerb right out front (${cd} m) and drivable`, cd >= 0 && cd < 16 && await g(`ctx.foot.ownCar === "parked"`), await g(`ctx.foot.ownCar`));
      } else t.check(`${label}: no car to drive off in (as before)`, await g(`ctx.foot.ownCar === "gone"`), await g(`ctx.foot.ownCar`));
      await t.frames(24);
      t.check(`${label}: no black curtain while she has control`, (await curtain()).length === 0, JSON.stringify(await curtain()));
      return true;
    };
    const resetLaw = () => g(`(() => { const D = ${D}; for (const k of Object.keys(D.FORCE)) delete D.FORCE[k]; D.FORCE.quietCourt = true; return true; })()`);

    // ── arrested IN Lakewood, in her car → the precinct (the cruiser pulls up there) → bail → out of ITS door ──
    await step("arrest in town → bail", async () => {
      if (!await town("lakewood")) return;
      await resetLaw();
      await carAt("precinct", 40, false);
      await g(`(ctx.car.s += 0, ctx.G.hearts = 3, true)`);
      await t.frames(4);
      await t.L(`window.__states.length = 0; window.__ev.length = 0`);
      await g(`ctx.law.arrest(["DOUBLE PARKING (TRIPLE, ACTUALLY)"])`);
      if (!await t.until(`__lulu3d.state === "lawArrest"`, "arrested in town", 30000)) return;
      t.check("the arrest plays IN town (no trip to the highway first)", await g(`ctx.town.active && ctx.town.id === "lakewood"`));
      await t.until(`__lulu3d.state === "placesArrive"`, "the cruiser brings her to Lakewood's precinct", 60000);
      await t.frames(40);
      await t.shot("arrive-precinct");
      if (!await talk(CELL, "booked → the cell")) return;
      t.check("the cell is the precinct's: still in Lakewood", await g(`ctx.town.active && ctx.town.id === "lakewood"`));
      const bail = await g(`${D}.jail().j.bail`), c0 = await coins();
      await t.L(`document.querySelector("#lawBail").click()`);
      if (!await out("precinct", "lakewood", true, "bail")) return;
      t.check(`bail costs exactly the bail (💰${bail}: ${c0} → ${await coins()})`, c0 - (await coins()) === bail);
      t.check("…and she's still WANTED till court (the bail rule)", await g(`ctx.law.warrants.length > 0`));
      t.check("never sent to the highway (no town:leave)", !(await evs(`/^town:leave/`)).length, JSON.stringify(await evs(`/^town:leave/`)));
      t.check("the scenes in order: arrest → arrive → jail → exit → on foot", /lawArrest.*placesArrive.*lawJail.*lawExit.*footRun/.test((await states()).join(",")), (await states()).join(","));
      await t.shot("bail-out-precinct");
    });

    // ── court in Midwood: dismissed → out of the COURTHOUSE door ──
    await step("court in town → dismissed", async () => {
      if (!await town("midwood")) return;
      await resetLaw();
      await carAt("court", 30, false);
      await t.frames(4);
      await g(`(${D}.FORCE.verdict = "dismissed", ctx.law.arrest(["JAYWALKING WITH ATTITUDE"], { skipCinematic: true }))`);
      if (!await talk(CELL, "booked in Midwood")) return;
      const c0 = await coins();
      await t.L(`document.querySelector("#lawCourtBtn").click()`);
      await t.until(`__lulu3d.state === "lawCourt"`, "to court", 30000);
      t.check("court is held in Midwood's courthouse (the town stays)", await g(`ctx.town.active && ctx.town.id === "midwood"`));
      if (!await talk(`__lulu3d.state === "footRun"`, "the trial → dismissed → out", /DEFEND|Innocent|innocent|Objection|OBJECT|Beg|insanity|Plead|Blame/)) return;
      await out("court", "midwood", true, "dismissed");
      const v = (await evs(`/^law:verdict/`)).slice(-1)[0] || "";
      t.check(`a dismissal costs nothing (${c0} → ${await coins()})`, /dismissed/.test(v) ? (await coins()) === c0 : true, v);
      await t.shot("out-of-court");
    });

    // ── a jail verdict: time served → out of the precinct on foot, her car behind the impound fence ──
    await step("jail → served → impound", async () => {
      if (!await town("lakewood")) return;
      await resetLaw();
      await carAt("precinct", 30, false);
      await t.frames(4);
      await g(`(${D}.FORCE.verdict = "jail", ctx.law.arrest(["GRAND THEFT MINIVAN"], { skipCinematic: true }))`);
      if (!await talk(CELL, "booked for GTM")) return;
      await t.L(`document.querySelector("#lawCourtBtn").click()`);
      await talk(`__lulu3d.ctx.law._dbg.jail() && __lulu3d.ctx.law._dbg.jail().phase === "serve"`, "guilty → serving", /./);
      await g(`${D}.jail().serve.serveDays = ${D}.jail().serve.total - 1`);
      for (let i = 0; i < 6; i++) await t.tap(0);
      if (!await out("precinct", "lakewood", false, "served")) return;
      t.check("her own car is behind the impound lot's fence (never lost)", await g(`!!ctx.civic.debug.impoundedCar() && ctx.civic.debug.impoundedCar().parent === ctx.scene`));
      await onFootAt("impound", 1.0);
      t.check("✋ at the impound gate says it's her car", /YOUR CAR/i.test(await promptText()), await promptText());
      await view("impound", "impound-her-car", 4, 6, 10);
    });

    // ── arrested on the HIGHWAY → the nearest town's precinct (built in slices while she sits in the cell) ──
    await step("highway arrest → nearest town", async () => {
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(6); await playing(); }
      await resetLaw();
      await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
      await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a fresh cruise", 60000);
      await playing();
      await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
      if (!(await g(`ctx.town.exits.length`))) await g(`ctx.town.debug.exitAhead(1400)`);
      t.check("an interchange is planned up the road", await g(`ctx.town.exits.length > 0`));
      await t.L(`window.__ev.length = 0`);
      await g(`ctx.law.arrest(["SPEEDING ON THE TURNPIKE"], { skipCinematic: true })`);
      const place = await g(`ctx.civic.place && Object.assign({}, ctx.civic.place)`);
      t.check("she's taken to the nearest town's precinct", !!place && !place.here && !!place.id, JSON.stringify(place));
      if (!place || !await talk(CELL, "booked (highway)")) return;
      await t.frames(90);
      const pre = await g(`ctx.town.standing.find(b => b.town === ${JSON.stringify(place.id)})`);
      console.log("   PERF places town built during the cell", JSON.stringify(pre));
      t.check("the town is built in slices while she's in the cell (99 % of slices ≤ 8 ms, as flow's test)", !!pre && pre.ready && pre.steps > 50 && pre.p99 <= 8, JSON.stringify(pre));
      await t.L(`document.querySelector("#lawBail").click()`);
      await out("precinct", place.id, true, "highway bail");
      await t.shot("highway-arrest-out");
    });

    // ── the ER in town: she comes to in the hospital, the bill as always, out of ITS door ──
    await step("ER in town", async () => {
      if (!await town("lakewood")) return;
      await carAt("hospital", 25, false);
      await t.frames(4);
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "on foot in Lakewood", 8000);
      t.check("on foot in a town the ER can scoop her up again (a hospital is there)", await g(`ctx.foot.erChance() > 0`));
      const c0 = await coins();
      await g(`ctx.er.admit("knockout", { force: { intro: false, visitor: false } })`);
      await t.until(`__lulu3d.state === "cameosER"`, "the ER (Lakewood)", 60000);
      t.check("the ER is St. Shloimy's: the town stays", await g(`ctx.town.active && ctx.town.id === "lakewood" && ctx.civic.place && ctx.civic.place.kind === "er"`));
      await t.frames(30);
      await t.shot("er-in-town");
      if (!await talk(`__lulu3d.state === "footRun"`, "diagnosis → care → discharged", /patch|GOOD|scan|cholent|cheapest|Bandage|works|Set|Pocket|concussed|VIP/)) return;
      await out("hospital", "lakewood", true, "ER");
      const r = await g(`null`);
      t.check(`the bill is paid out of the wallet as before (${c0} → ${await coins()})`, (await coins()) <= c0);
      await t.shot("er-out-of-hospital");
    });

    // ── the ER on the highway → the nearest town's hospital ──
    await step("ER on the highway → nearest town", async () => {
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(6); await playing(); }
      await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
      await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a fresh cruise (ER)", 60000);
      await playing();
      await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
      if (!(await g(`ctx.town.exits.length`))) await g(`ctx.town.debug.exitAhead(1400)`);
      await g(`ctx.er.admit("crash", { force: { intro: false, visitor: false } })`);
      await t.until(`__lulu3d.state === "cameosER"`, "the ER (highway)", 60000);
      const place = await g(`ctx.civic.place && Object.assign({}, ctx.civic.place)`);
      t.check("the ER is the nearest town's hospital", !!place && place.kind === "er" && !place.here, JSON.stringify(place));
      if (!place || !await talk(`__lulu3d.state === "footRun"`, "discharged (highway ER)", /patch|GOOD|scan|cholent|cheapest|Bandage|works|Set|Pocket|concussed|VIP/)) return;
      await out("hospital", place.id, true, "highway ER");
    });
  },
};
