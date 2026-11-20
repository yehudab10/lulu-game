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

    // ════ 1. the buildings stand in both towns ════
    for (const id of ["lakewood", "midwood"]) {
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
    for (const id of ["lakewood", "midwood"]) {
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
  },
};
