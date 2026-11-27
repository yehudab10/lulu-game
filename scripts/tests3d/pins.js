// 📍 PLACES ON THE MAP + PING (features/pins; the owner 2026-11-27: "an easier way for players to see where each store
// is … on the map … they should be able to ping it").
//   • the registry lists every place (both towns' shops / town / help places, the rest areas, JFK, Ima's house) and
//     each town place has a spot she can really stand on — in Midwood AND in Lakewood on the SECOND lap's copy
//   • the 📱 🗺️ Map shows them (the picture + the list + the filter row); 📍 Ping → ONE beam + ONE edge pointer + the
//     objective line's lowest slot; a second ping replaces it; ✕ Clear; arriving clears it
//   • from the highway it points at the place's town exit (the next one along the road, lap 2 too); a chase outranks it
//   • 🛍️ Where to shop marks through it (one system)
module.exports = {
  name: "pins",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=town,law,world,day,unstuck",
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    await this.body(t);
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "PLAY: the run starts", 30000)) return;
    await g(`(ctx.law.hold(99999), true)`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async (id, exitS = null) => {
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0${exitS != null ? ", exitS: " + exitS : ""} })`);
      const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 15000);
      await t.frames(30);
      return ok;
    };
    // every place of the town she's in: found, and standing somewhere she can stand (unstuck's own test)
    const reachable = async id => {
      const bad = await g(`ctx.pins.list().filter(p => p.town === ${JSON.stringify(id)} && !p.local).map(p => { const t = ctx.pins.target(p.id); if (!t || t.kind !== "at") return p.id + ": no spot"; const why = ctx.unstuck.normal(t.x, t.z, "foot"); return why ? p.id + ": " + why : ""; }).filter(Boolean)`);
      const n = await g(`ctx.pins.list().filter(p => p.town === ${JSON.stringify(id)}).length`);
      return { bad, n };
    };

    // ── the registry ──
    const L = await g(`ctx.pins.list().map(p => ({ id: p.id, name: p.name, cat: p.cat, group: p.group }))`);
    const ids = new Set(L.map(p => p.id));
    const want = ["midwood:dealer", "midwood:makolet", "midwood:clothes", "midwood:pizza", "midwood:bakery", "midwood:bank", "midwood:realty", "midwood:cityhall", "midwood:shul",
      "midwood:precinct", "midwood:court", "midwood:hospital", "lakewood:clothes", "lakewood:bank", "lakewood:shul", "hw:rest:0", "hw:rest:1", "hw:jfk", "jfk:gelt", "home:ima"];
    t.check("the map knows every place (shops, town, help, rest areas, JFK, Ima's house) in both towns", want.every(i => ids.has(i)) && ids.size === L.length, want.filter(i => !ids.has(i)).join(", ") || `${L.length} places`);
    t.check("…each with a real name (Avenue J'adore, Simcha's Classic Clothing, Maison de Gelt…)", L.every(p => p.name && !/undefined/.test(p.name)) && L.some(p => p.name === "Avenue J'adore") && L.some(p => p.name === "Simcha's Classic Clothing"));
    const gr = await g(`ctx.pins.groups().map(x => x.id)`);
    t.check("…grouped by where they are along the lap (Midwood · the highway · JFK · Lakewood)", ["midwood", "highway", "jfk", "lakewood"].every(x => gr.includes(x)), gr.join(" → "));
    await g(`ctx.pins.add({ id: "test:post", name: "Test trooper post", icon: "🚔", cat: "help", lap: 9000, group: "highway" })`);
    t.check("a feature can add a place and it shows by itself", await g(`!!ctx.pins.get("test:post") && ctx.pins.groups().find(x => x.id === "highway").places.some(p => p.id === "test:post")`));
    t.check("…with a label instead of a name (impound's shape), and remove() takes it off (and un-pins it)", await g(`(() => { const P = ctx.pins; const p = P.add({ id: "test:lbl", icon: "🚗", label: "Your impounded car", town: "midwood", spot: "impound" });
      const ok1 = !!p && P.get("test:lbl").name === "Your impounded car"; P.ping("test:lbl"); const pinned = P.current === "test:lbl"; P.remove("test:lbl");
      return ok1 && pinned && !P.get("test:lbl") && P.current == null; })()`));

    // ── Midwood: every place reachable ──
    if (!await town("midwood")) return;
    const mw = await reachable("midwood");
    t.check(`Midwood: all ${mw.n} places have a spot she can stand on`, !mw.bad.length, mw.bad.join(" · "));

    // ── the 📱 🗺️ Map ──
    await g(`(ctx.phone.openPhone("lapmap"), true)`);
    await t.frames(6);
    const card = await t.L(`(() => { const a = document.getElementById("lpApp"); return a ? { rows: a.querySelectorAll("[data-pin]").length, f: a.querySelectorAll("[data-pcat]").length, cv: !!a.querySelector("canvas.pin-map") } : null; })()`);
    t.check("📱 🗺️ Map: the picture + a row per place + the filter row", !!card && card.cv && card.rows >= 30 && card.f === 5, JSON.stringify(card));
    const dots = await g(`import("./js/features/pins/map.js").then(m => m.mapDebug.pts().length)`).catch(() => 0) || await t.L(`import("./js/features/pins/map.js").then(m => m.mapDebug.pts().length)`);
    t.check("…in town, the picture has the town's places on it", dots >= 10, dots);
    await t.L(`document.querySelector('#lpApp [data-pcat="shops"]').click()`); await t.frames(3);
    const shopsOnly = await t.L(`[...document.querySelectorAll("#lpApp [data-pin]")].every(b => /^(midwood|lakewood):(dealer|bling|makolet|clothes|pizza|bakery|van)$|^jfk:gelt$/.test(b.dataset.pin))`);
    t.check("🛍️ Shops filter: only shops", shopsOnly);
    await t.shot("map-shops");
    await t.L(`document.querySelector('#lpApp [data-pin="midwood:clothes"]').click()`); await t.frames(3);
    await t.L(`document.querySelector('#lpApp [data-ping]').click()`); await t.frames(10);
    t.check("tap a place → 📍 Ping → pinned, the phone closes", await g(`ctx.pins.current === "midwood:clothes" && !ctx.phone.isOpen`));
    if (await g(`ctx.foot.active`) === false) { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000); }
    // stand away from it
    await g(`(() => { const T = ctx.pins.target(); const F = ctx.foot.debug.F; F.pos.set(T.x + 60, 0.05, T.z + 20); return true; })()`);
    const far = await g(`(() => { const sp = ctx.unstuck.spot("foot"); if (sp) { const F = ctx.foot.debug.F; F.pos.set(sp.x, 0.05, sp.z); } return true; })()`);
    await t.frames(30);
    const vis = await t.L(`(async () => { const M = await import("./js/features/openworld/marks.js"); const P = __lulu3d.ctx.together.debug.pointers().filter(p => p.uid === "pin"); const ob = __lulu3d.H.objectives(); const c = document.querySelector(".pin-chip"); return { beams: M.beaconCount(), ptr: P.length ? P[0] : null, ob, chip: c ? c.textContent : "", d: __lulu3d.ctx.pins.target().d }; })()`);
    t.check("…ONE beam over it", vis.beams === 1, JSON.stringify(vis));
    const cw = await t.L(`(() => { const c = __lulu3d.H.clearWindow(); return { x0: c.x0 * innerWidth, x1: c.x1 * innerWidth, y0: c.y0 * innerHeight, y1: c.y1 * innerHeight }; })()`);
    const p0 = vis.ptr;
    t.check("…the pointer keeps out of the clear window around her", !p0 || !p0.shown || !(p0.x < cw.x1 && p0.x + p0.w > cw.x0 && p0.y < cw.y1 && p0.y + p0.h > cw.y0), JSON.stringify({ p0, cw }));
    t.check("…ONE edge pointer with the distance (unless she's looking right at it)", !vis.ptr || (vis.ptr.shown ? /\d/.test(vis.ptr.text) : true), JSON.stringify(vis.ptr));
    t.check("…the objective line shows it: 📍 Avenue J'adore · distance", /📍 Avenue J'adore · [\d.]+ (m|mi)/.test(vis.chip) && (vis.ob.main.includes("ping") || vis.ob.badges.includes("ping")), JSON.stringify(vis.ob) + " " + vis.chip);
    await t.shot("pinged");
    // a second ping replaces it
    await g(`ctx.pins.ping("midwood:bakery")`); await t.frames(10);
    const beams2 = await t.L(`import("./js/features/openworld/marks.js").then(m => m.beaconCount())`);
    t.check("a second ping replaces the first (still one beam)", await g(`ctx.pins.current === "midwood:bakery"`) && beams2 === 1, beams2);
    // a chase outranks it (in the car)
    await playing();
    await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("SPEEDING", { heat: 1 }), true)`);
    await t.frames(20);
    const ob2 = await t.L(`__lulu3d.H.objectives()`);
    t.check("a chase outranks it: the chase is the objective, the ping a badge (or out of the way)", await g(`ctx.law.chasing`) && ob2.main[0] === "chase" && !ob2.main.includes("ping"), JSON.stringify(ob2));
    t.check("…and its edge pointer steps aside during the chase", await g(`!ctx.together.debug.pointers().some(p => p.uid === "pin" && p.shown)`));
    await g(`(ctx.law.clearHeat("", { lowKey: false }), ctx.law.hold(99999), true)`);
    await t.frames(10);
    // arriving clears it (on foot, at the door)
    if (await st() !== "footRun") { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "on foot again", 8000); }
    await g(`(() => { const T = ctx.pins.target(); const F = ctx.foot.debug.F; F.pos.set(T.x, 0.05, T.z); return true; })()`);
    await t.frames(20);
    t.check("arriving clears the ping (beam, pointer, line)", await t.until(`!__lulu3d.ctx.pins.current`, "arrived", 4000) && await t.L(`import("./js/features/openworld/marks.js").then(m => m.beaconCount() === 0)`));
    // ✕ Clear
    await g(`ctx.pins.ping("midwood:bank")`);
    await g(`(ctx.phone.openPhone("lapmap"), true)`); await t.frames(6);
    await t.L(`document.getElementById("pinClear").click()`); await t.frames(4);
    t.check("✕ Clear ping in the map clears it", await g(`!ctx.pins.current`));
    await g(`(ctx.phone.closePhone(), true)`);

    // ── 🛍️ Where to shop marks through the ping ──
    await g(`ctx.shops.setDest("makolet")`); await t.frames(6);
    t.check("🛍️ Where to shop → the same ping (this town's makolet)", await g(`ctx.pins.current === "midwood:makolet" && ctx.pins.from === "shops"`) && await t.until(`!!document.querySelector(".shops-dest")`, "chip", 3000));
    await g(`ctx.pins.clear()`);

    // ── Lakewood on the SECOND lap: every place reachable on that copy ──
    if (!await town("lakewood", 12000 + 16000)) return;
    t.check("(Lakewood entered on lap 2)", await g(`ctx.town.highwayS > 16000`), await g(`ctx.town.highwayS`));
    const lw = await reachable("lakewood");
    t.check(`Lakewood (lap 2): all ${lw.n} places have a spot she can stand on`, !lw.bad.length, lw.bad.join(" · "));
    await g(`ctx.pins.ping("midwood:clothes")`); await t.frames(4);
    t.check("in another town: it points the way out of town", /head out of town/.test(await g(`(ctx.pins.target() || {}).label || ""`)));

    // ── the highway, lap 2: the next exit into the place's town ──
    await playing();
    await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing();
    await g(`(ctx.car.s = 16000 + 8000, ctx.car.d = 3.5, true)`); await t.frames(10);
    const hw = await g(`(() => { const T = ctx.pins.target(); const x = ctx.town.exitOf("midwood"); return { k: T && T.kind, d: T && T.d, label: T && T.label, ex: x, s: ctx.car.s }; })()`);
    t.check("on the highway (lap 2): it points at the next Midwood exit up the road", hw.k === "exit" && hw.ex > hw.s && hw.d > 0 && hw.d < 16000 && /exit/.test(hw.label), JSON.stringify(hw));
    await g(`ctx.pins.ping("lakewood:clothes")`);
    await g(`(ctx.phone.openPhone("lapmap"), true)`); await t.frames(8);
    await t.L(`document.querySelector('#lpApp [data-pcat=""]').click()`); await t.frames(4);
    t.check("on the highway the map is the lap ring, each town's places beside its exit", await t.L(`import("./js/features/pins/map.js").then(m => m.mapDebug.pts().length >= 25)`));
    await t.shot("map-highway");
    await g(`(ctx.phone.closePhone(), true)`); await t.frames(4);
    await g(`ctx.pins.ping("hw:rest:1")`); await t.frames(4);
    const rs = await g(`(() => { const T = ctx.pins.target(); return { k: T && T.kind, d: T && T.d }; })()`);
    t.check("a rest area: up the road, less than a lap away", rs.d > 0 && rs.d < 16000, JSON.stringify(rs));
    await g(`ctx.pins.clear()`);
  },
};
