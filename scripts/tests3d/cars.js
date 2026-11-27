// 🚗 features/cars — every car she owns is somewhere (stage 1: the service, left where she left it, the Map), with the
// QA watchdog on. Three cars (pink selected): the first look puts pink "with" her, the others at home · in Lakewood she
// parks + gets out (her car, foot's) → walks far off: still there · drives off in someone else's minivan → pink is
// LEFT there, a real parked car on the same spot · the next lap's Lakewood: the same local spot · Midwood: it isn't
// drawn, the 📱 Map says "parked in Lakewood" · back: ✋ GET IN her own pink (the minivan stays) · a second car left
// near her → ✋ swaps (pink stays parked where she got out) · a reload → both still out there · a new day → she starts
// with the car that's at home (orange), not the ones she left · the 💾 save code carries it.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "cars",
  query: "&enable=cars,town,foot,world,day,phone,shops,garage",
  save2d: { totalCoins: 400, cruiseUnlocked: true, ownedSkins: ["pink", "purple", "orange"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const D = "ctx.cars.debug";
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      if (process.env.CARS_LOG) console.log(`    [${label}]`, JSON.stringify(await g(`${D}.S.log.slice(-8)`))); };
    const recs = () => g(`JSON.stringify(${D}.SAVE.cars)`);
    const kind = k => g(`${D}.rec("${k}").kind`);
    const tick = () => g(`(${D}.track(), ${D}.syncProps(), true)`);
    const prop = k => g(`(() => { const p = ${D}.S.props["${k}"]; return p && ctx.traffic.cars.includes(p.c) ? { x: p.c.x, z: p.c.z, h: p.c.h } : null; })()`);
    const footAt = (x, z) => g(`(() => { const F = ctx.foot.debug.F; F.pos.x = ${x}; F.pos.z = ${z}; F.vel.set(0, 0, 0); F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); return true; })()`);
    const walkOut = async label => {
      await g(`(ctx.foot.start("droveOff", { noIntro: true, drivable: true }), true)`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, `${label}: on foot`, 8000);
    };
    const press = async (code, n = 8) => { for (let i = 0; i < n && !await g(code); i++) { await t.tap(0); await t.frames(4); } return g(code); };
    const lakewood = async (exitS = null) => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      const ok = await g(`ctx.town.warp({ town: "lakewood", exitS: ${exitS == null ? "ctx.town.exitOf('lakewood', 0)" : exitS}, quiet: true })`);
      await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "lakewood"`, "in Lakewood", 8000);
      await g(`(L3.setState("playing"), true)`);
      await t.frames(6);
      return ok;
    };
    const mapHtml = () => t.L(`import("./js/features/phone/apps.js").then(m => { const x = m.MAP_EXTRAS.find(e => e.id === "cars"); return x ? x.html() : ""; })`);

    await W.install(t);
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run starts", 9000);
    await g(`(${D}.S.migrated || ${D}.migrate(), true)`);

    // ════ the first look: pink's with her, the others at home ════
    await step("migrate", async () => {
      t.check("first look: the car she drives is with her, the other two are at home", await kind("pink") === "with" && await kind("purple") === "home" && await kind("orange") === "home", await recs());
    });

    await g(`(ctx.town.load("lakewood"), ctx.town.load("midwood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood") && __lulu3d.ctx.town.loaded("midwood")`, "the towns load", 120000)) return;
    if (!await lakewood()) { t.check("warped into Lakewood", false); return; }
    const lap1 = await g(`ctx.town.highwayS`);
    await W.reset(t);

    // ════ park at a kerb, get out, walk far off: it's still there ════
    let spot = null;
    await step("park", async () => {
      spot = await g(`(() => { const k = ctx.town.curbSpot({ near: { x: ctx.car.pos.x, z: ctx.car.pos.z }, minD: 0, maxD: 160, len: 6 }); if (!k) return null; ctx.car.place(k.x, k.z, k.h); ctx.car.s = k.s; ctx.car.d = k.d; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; return { x: k.x, z: k.z, h: k.h }; })()`);
      t.check("a free kerb spot in Lakewood", !!spot);
      t.check("out of the car", await walkOut("park"));
      await tick();
      const pend = await g(`JSON.stringify(${D}.SAVE.pend)`);
      t.check("her own car, parked out in town: with her, its spot written down (in case the page closes)", await kind("pink") === "with" && /lakewood/.test(pend), pend);
      // far off across town (the farthest crossing from the car)
      const far = await g(`(() => { const P = ctx.town.plan; let best = null, bd = 0; for (const n of P.NODES) { const x = P.ORIGIN.x + n.x * P.COS + n.z * P.SIN, z = P.ORIGIN.z - n.x * P.SIN + n.z * P.COS, d = Math.hypot(x - ${spot.x}, z - ${spot.z}); if (d > bd) { bd = d; best = { x, z, d }; } } return best; })()`);
      if (far) { await footAt(far.x, far.z); await t.frames(10); await tick(); }
      const stub = await g(`(() => { const c = ctx.foot.parkedCar; return c ? +Math.hypot(c.x - ${spot.x}, c.z - ${spot.z}).toFixed(2) : -1; })()`);
      t.check(`${far ? Math.round(far.d) : "?"} m away across town: her car is right where she left it`, stub >= 0 && stub < 0.5 && await kind("pink") === "with", String(stub));
    });

    // ════ she drives off in someone else's minivan: pink is LEFT there ════
    await step("ride", async () => {
      await footAt(spot.x + 6, spot.z + 6);
      await g(`ctx.foot.drive({ vtype: "car", key: "town_minivan", colors: null, x: ${spot.x + 30}, z: ${spot.z}, h: 0, how: "car" })`);
      await t.until(`__lulu3d.state === "playing"`, "driving the minivan", 4000);
      await tick(); await tick();
      const r = await g(`JSON.stringify(${D}.rec("pink"))`);
      t.check("in a borrowed ride: her pink car is LEFT in Lakewood", await kind("pink") === "left" && /lakewood/.test(r), r);
      const p = await prop("pink");
      t.check("…a real parked car on the very spot (one car: foot's stand-in is gone)", !!p && Math.hypot(p.x - spot.x, p.z - spot.z) < 0.3
        && await g(`ctx.traffic.cars.filter(c => c.data && c.data.footStub).length === 0`), JSON.stringify(p));
      t.check("…solid (the other drivers steer round it, she can't drive through it)", await g(`(() => { const c = ${D}.S.props.pink.c; return c.keep && c.free && c.spec.circles.length === 2; })()`));
    });

    // ════ the next lap's Lakewood: the same spot ════
    await step("lap2", async () => {
      const ex2 = await g(`ctx.town.exitOf("lakewood", ${lap1} + 15000)`);
      t.check("the next lap's Lakewood exit is ~16 km on", ex2 != null && Math.abs(ex2 - lap1 - 16000) < 200, String(ex2));
      await lakewood(ex2);
      t.check("…she's in that copy now", Math.abs((await g(`ctx.town.highwayS`)) - ex2) < 300);
      const w = await g(`(() => { const w = ${D}.worldOf(${D}.rec("pink")); ctx.car.place(w.x + 12, w.z, 0); ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; return w; })()`);
      await tick(); await tick();
      const p = await prop("pink");
      const loc = p && await g(`(() => { const a = ${D}.poseOf({ x: ${p.x}, z: ${p.z}, h: ${p.h} }), r = ${D}.rec("pink"); return Math.hypot(a.lx - r.lx, a.lz - r.lz); })()`);
      t.check("lap 2: her pink car is parked on the same street spot (local frame)", !!p && loc < 0.3 && Math.hypot(p.x - w.x, p.z - w.z) < 0.3, JSON.stringify({ p, w, loc }));
    });

    // ════ another town: not drawn there, the Map says where ════
    await step("midwood", async () => {
      if (await g(`ctx.foot.active`)) await g(`(ctx.foot.end("test"), true)`);
      await g(`ctx.town.warp({ town: "midwood", quiet: true })`);
      await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "in Midwood", 8000);
      await g(`(L3.setState("playing"), true)`); await t.frames(4); await tick();
      t.check("in Midwood: no Lakewood car drawn here", await g(`Object.keys(${D}.S.props).length === 0 && ctx.traffic.cars.every(c => !(c.data && c.data.carsKey))`));
      const html = await mapHtml();
      t.check("📱 🗺️ Map › Your cars: pink parked in Lakewood (up the road), the others at home", /Your cars/.test(html) && /Classic Pink[^]*parked in Lakewood/.test(html) && /Sunset Glow[^]*at home/.test(html), html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 300));
      t.check("ctx.cars.atHome: pink isn't, orange is", !(await g(`ctx.cars.atHome("pink")`)) && await g(`ctx.cars.atHome("orange")`));
    });

    // ════ back in Lakewood: ✋ GET IN her own pink car (the minivan stays on the street) ════
    await step("getin", async () => {
      await lakewood(lap1);
      await g(`(() => { const w = ${D}.worldOf(${D}.rec("pink")); ctx.car.place(w.x + 6, w.z + 6, 0); ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; return true; })()`);
      t.check("out of the minivan", await walkOut("minivan"));
      await tick(); await tick();
      const p = await prop("pink");
      t.check("her pink car stands there", !!p);
      if (!p) return;
      await footAt(p.x + 1.6 * Math.cos(p.h), p.z - 1.6 * Math.sin(p.h));
      await t.frames(6);
      const pr = await t.L(`(() => { const e = document.querySelector(".prompt"); return e ? e.textContent : ""; })()`);
      t.check("✋ says GET IN — your Classic Pink", /GET IN.*Classic Pink/.test(pr), pr);
      const ok = await press(`L3.state === "playing" && !ctx.foot.active && !ctx.foot.vehicle && ctx.car.skinKey === "pink"`);
      t.check("✋ → she's driving her own pink car", ok, await g(`JSON.stringify({ st: L3.state, veh: ctx.foot.vehicle, k: ctx.car.skinKey })`));
      await tick();
      t.check("…with her now, the parked copy gone, the minivan still a car on the street", await kind("pink") === "with" && !(await prop("pink"))
        && await g(`ctx.traffic.cars.some(c => /minivan/.test(c.kind) || (c.data && c.data.footStub))`));
    });

    // ════ a second car near her: ✋ swaps — the one she got out of stays parked ════
    let pinkAt = null;
    await step("swap", async () => {
      const k = await g(`(() => { const k = ctx.town.curbSpot({ near: { x: ctx.car.pos.x, z: ctx.car.pos.z }, minD: 8, maxD: 120, len: 6 }); return k ? { x: k.x, z: k.z, h: k.h } : null; })()`);
      t.check("another kerb spot", !!k);
      if (!k) return;
      await g(`ctx.cars.leaveAt("purple", Object.assign({ kind: "left" }, (p => ({ town: p.town, lx: p.lx, lz: p.lz, h: p.h }))(${D}.poseOf(${JSON.stringify(k)}))))`);
      t.check("out of pink", await walkOut("pink"));
      pinkAt = await g(`(() => { const c = ctx.foot.parkedCar; return c ? { x: c.x, z: c.z } : null; })()`);
      await tick(); await tick();
      const p = await prop("purple");
      t.check("purple stands at its kerb", !!p && Math.hypot(p.x - k.x, p.z - k.z) < 0.3);
      if (!p) return;
      await footAt(p.x + 1.6 * Math.cos(p.h), p.z - 1.6 * Math.sin(p.h));
      await t.frames(6);
      const ok = await press(`L3.state === "playing" && ctx.car.skinKey === "purple"`);
      t.check("✋ → she's driving purple", ok);
      await tick(); await tick();
      const pp = await prop("pink");
      t.check("…pink stays parked where she got out of it", await kind("pink") === "left" && await kind("purple") === "with" && !!pp && pinkAt && Math.hypot(pp.x - pinkAt.x, pp.z - pinkAt.z) < 0.3, JSON.stringify({ pp, pinkAt, r: await recs() }));
      t.check("…the garage's choice follows (purple selected in the save)", await t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}").selectedSkin`) === "purple");
    });

    // ════ a reload with purple parked out: both still there ════
    await step("reload", async () => {
      t.check("out of purple, in Lakewood", await walkOut("purple"));
      await tick();
      t.check("(its spot written down)", /purple/.test(await g(`JSON.stringify(${D}.SAVE.pend)`)));
      const r0 = await W.report(t); W.log(r0);
      W.check(t, "cars (before the reload)", r0, ["nan", "flat", "underground"]);
      await t.L(`import("./js/core/save.js").then(m => (m.saveNow(), true))`);
      await t.page.reload();
      t.check("reloads to the title", await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reload", 120000));
      await W.install(t);
      await g(`(${D}.S.migrated || ${D}.migrate(), true)`);
      t.check("after a reload: purple + pink still parked in Lakewood, orange at home (the title's driveway shows it)", await kind("purple") === "left" && await kind("pink") === "left" && /^(home|with)$/.test(await kind("orange")), await recs());
    });

    // ════ a new day: she starts with the car that's at home ════
    await step("newday", async () => {
      await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home({ via: "test" }) : L3.startRun({ home: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "the day starts", 30000);
      await t.frames(10); await tick();
      t.check("a new day: her car at home (orange) is the one in the driveway; pink + purple stay out in Lakewood",
        await g(`ctx.car.skinKey`) === "orange" && await kind("orange") === "with" && await kind("purple") === "left" && await kind("pink") === "left", await recs());
    });

    // ════ the 💾 save code carries it ════
    await step("savecode", async () => {
      const code = await t.L(`import("./js/features/meta/screens.js").then(m => m.saveToCode())`);
      const back = await t.L(`import("./js/features/meta/screens.js").then(m => { const o = m.codeToSave(${JSON.stringify(code)}); return o && o.lulu3d && o.lulu3d.f && o.lulu3d.f.cars ? JSON.stringify(o.lulu3d.f.cars.cars) : ""; })`);
      t.check("the save code round-trips where every car is", /"purple":\{"kind":"left"[^}]*"town":"lakewood"/.test(back) && /"orange":\{"kind":"with"/.test(back), back.slice(0, 300));
    });

    // ════ home: three cars at Ima's — the one she uses in the driveway, the others along her kerb; walk up to pick ════
    await step("home", async () => {
      await g(`(ctx.cars.leaveAt("pink", { kind: "home" }), ctx.cars.leaveAt("purple", { kind: "home" }), true)`);
      if (await g(`ctx.foot.active`)) await g(`(ctx.foot.end("test"), true)`);
      await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home({ via: "test" }) : L3.startRun({ home: true }), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "home, on foot", 30000);
      await t.frames(6); await tick(); await tick();
      const at = await g(`(() => { const P = ctx.home.park, out = {}; for (const k of ["pink", "purple"]) { const p = ${D}.S.props[k]; out[k] = p ? +Math.hypot(p.c.x - P.x, p.c.z - P.z).toFixed(1) : -1; } const c = ctx.foot.parkedCar; out.drive = c ? +Math.hypot(c.x - P.x, c.z - P.z).toFixed(1) : -1; out.sel = ctx.car.skinKey; return out; })()`);
      t.check("at Ima's: orange in the driveway, pink + purple stand along her kerb (two different spaces, close by)", at.sel === "orange" && at.drive >= 0 && at.drive < 1 && at.pink > 5 && at.pink < 60 && at.purple > 5 && at.purple < 60
        && await g(`(() => { const a = ${D}.S.props.pink.c, b = ${D}.S.props.purple.c; return Math.hypot(a.x - b.x, a.z - b.z) > 5; })()`), JSON.stringify(at));
      t.check("…the 🔑 MY CARS card steps aside (the cars are right there)", !(await t.L(`(() => { const e = document.querySelector(".prompt"); return e ? e.textContent : ""; })()`)).includes("MY CARS"));
      const slots = await g(`JSON.stringify(ctx.cars.slots)`);
      const p = await prop("purple");
      await footAt(p.x + 1.6 * Math.cos(p.h), p.z - 1.6 * Math.sin(p.h));
      await t.frames(6);
      t.check("✋ purple at the kerb → she's driving it", await press(`L3.state === "playing" && ctx.car.skinKey === "purple"`));
      await tick(); await tick();
      const o = await g(`(() => { const p = ${D}.S.props.orange, P = ctx.home.park; return p ? +Math.hypot(p.c.x - P.x, p.c.z - P.z).toFixed(2) : -1; })()`);
      t.check("…orange stays in the driveway (at home), pink still at the kerb", await kind("orange") === "home" && o >= 0 && o < 0.5 && await kind("purple") === "with" && !!(await prop("pink")), JSON.stringify({ o, r: await recs() }));
      t.check("…Ima's kerb spaces are kept (the same ones next time)", (await g(`JSON.stringify(ctx.cars.slots)`)) === slots, slots);
    });

    const r = await W.report(t); W.log(r);
    W.check(t, "cars (after the reload)", r, ["nan", "flat", "underground"]);
  },
};
