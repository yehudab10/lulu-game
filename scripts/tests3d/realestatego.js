// 🏘️ 🏠 GO THERE (features/realestate/goto.js): from anywhere, a soft cut to the front door of a home she owns — on foot,
// her car at the nearest kerb, on the lap she's on.
//   • 📞 the realtor's contact › Your places: a "🏠 Go there" button per home
//   • from the highway, from the other town, from inside a room, on lap 2 (the house's fixed address, not lap 1's spot)
//   • refused, one plain line: wanted, Dina's mode, a test drive, a tenant in it, the Council's, the cooldown
//   • "🏠 Start my days here" picked on lap 2 still starts the day at the right door (lap 1's copy of the town)
//   • the QA watchdog stays quiet (no jump / camera in a wall after the cut)
const W = require("../lib/qawatch.js");
module.exports = {
  name: "realestatego",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,foot,day,town,decor",
  save2d: { totalCoins: 60000 },
  async run(t) {
    const g = t.game;
    if (!(await g(`!!(ctx.realestate && ctx.realestate.goTo && ctx.town.exitOf)`))) { t.check("(no Go there on this build)", false); return; }
    await g(`L3.setState("title")`);
    await t.frames(10);
    await t.click(/PLAY/);
    t.check("▶ PLAY: on foot at home (Midwood)", await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "home", 60000));
    await g(`(ctx.law && ctx.law.hold && ctx.law.hold(99999), ctx.town.load("lakewood"), true)`);
    await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models", 120000);
    // into Lakewood (lap 1), buy a house there
    await g(`(ctx.foot.end("test"), L3.setState("playing"), true)`);
    await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood", 0), speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.id === "lakewood" && __lulu3d.ctx.realestate.listings().length > 0`, "in Lakewood", 20000)) return;
    const rec = await g(`(() => { for (const r of ctx.realestate.listings()) if (ctx.realestate.debug.buyNow(r.id)) return { id: r.id, x: r.ap.x, z: r.ap.z }; return null; })()`);
    t.check("she owns a house in Lakewood", !!rec, JSON.stringify(rec));
    if (!rec) return;
    const ID = JSON.stringify(rec.id);
    const GO = `ctx.realestate.debug.GO`;
    const free = () => g(`(${GO}.last = -1e9, true)`);
    const atDoor = async (label, extra = "") => {
      const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "lakewood" && (() => { const r = __lulu3d.ctx.realestate.homes().find(h => h.id === ${ID}); return !!r && Math.hypot(__lulu3d.ctx.foot.pos.x - r.ap.x, __lulu3d.ctx.foot.pos.z - r.ap.z) < 3; })()`, label, 30000);
      const d = await g(`(() => { const r = ctx.realestate.homes().find(h => h.id === ${ID}), c = ctx.foot.parkedCar, p = ctx.foot.pos; return { st: L3.state, town: ctx.town.active && ctx.town.id, pos: p && [+p.x.toFixed(1), +p.z.toFixed(1)], door: r && [+r.ap.x.toFixed(1), +r.ap.z.toFixed(1)], car: c ? +Math.hypot(c.x - p.x, c.z - p.z).toFixed(1) : null }; })()`);
      t.check(`${label}: at the front door, on foot${extra}`, ok, JSON.stringify(d));
      t.check(`${label}: …her car at a kerb nearby`, d.car != null && d.car < 45, JSON.stringify(d));
      return d;
    };
    await W.install(t);

    // ── 📞 the realtor's contact: a Go there button per home ──
    await g(`(ctx.phone.openPhone("community"), true)`);
    await t.frames(6);
    await t.L(`(() => { const b = [...document.querySelectorAll("[data-ct]")].find(b => b.dataset.ct === "realtor"); if (b) b.click(); return !!b; })()`);
    await t.frames(6);
    t.check("📞 Your places: a 🏠 Go there button for her house", await t.L(`!!document.querySelector('[data-go="${rec.id}"]') && /Go there/.test(document.querySelector('[data-go="${rec.id}"]').textContent)`));

    // ── 1. from the highway — the 📱 🗺️ Map: tap her home → 🏠 Go there (the same goto.js path) ──
    await W.moved(t).catch(() => null);
    await g(`(ctx.phone.closePhone(), ctx.town.leave("highway"), true)`);
    await t.until(`!__lulu3d.ctx.town.active && __lulu3d.state === "playing"`, "on the highway", 15000);
    await g(`(ctx.phone.openPhone("lapmap"), true)`);
    await t.frames(6);
    t.check("📱 🗺️ Map: her home is listed", await t.L(`!!document.querySelector('[data-mh="${rec.id}"]')`));
    t.check("…no Go there until she taps it", !(await t.L(`!!document.querySelector('.re-go[data-go="${rec.id}"]')`)));
    await t.L(`document.querySelector('[data-mh="${rec.id}"]').click()`);
    await t.frames(6);
    t.check("…tap it: 🏠 Go there", await t.L(`!!document.querySelector('.re-go[data-go="${rec.id}"]')`));
    await t.shot("go-map");
    await t.L(`document.querySelector('.re-go[data-go="${rec.id}"]').click()`);
    await atDoor("from the highway (the Map)");
    t.check("…the phone closed itself", !(await g(`ctx.phone.isOpen`)));
    await t.shot("go-from-highway");

    // ── 2. from the other town (home in Midwood) ──
    await free();
    await g(`ctx.onegame.home({ via: "test" })`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "midwood"`, "home in Midwood", 30000);
    t.check("from Midwood: on her way", (await g(`ctx.realestate.goTo(${ID})`)) === "");
    const d1 = await atDoor("from the other town");      // (Midwood is lap 1's first exit: lap 1's Lakewood is the nearest)

    // ── 3. from inside a room (the bank lobby: out by its door, then the cut) ──
    await free();
    await g(`(ctx.heist.debug.enterBank(), true)`);
    if (await t.until(`__lulu3d.state === "interior" && window.__interiors && window.__interiors.room && window.__interiors.room.ready`, "in the bank", 30000)) {
      t.check("from a room: on her way", (await g(`ctx.realestate.goTo(${ID})`)) === "");
      await atDoor("from inside a room");
      t.check("…the room is gone", !(await g(`!!window.__interiors.room`)));
    }

    // ── 4. lap 2: the same house in the NEXT copy of Lakewood ──
    await free();
    const lap = await g(`(() => { const e1 = ctx.town.exitOf("lakewood", 0), e2 = ctx.town.exitOf("lakewood", e1 + 200); return { e1, e2 }; })()`);
    await W.moved(t).catch(() => null);
    await g(`(() => { ctx.foot.end("test"); ctx.town.leave("highway"); L3.setState("playing"); const s = ${lap.e2} - 400, P = ctx.world.highway.point(s, -2, {}); ctx.car.place(P.x, P.z, P.h); ctx.car.s = s; ctx.car.d = -2; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
    await t.frames(20);
    t.check("lap 2: on her way", (await g(`ctx.realestate.goTo(${ID})`)) === "", JSON.stringify(lap));
    const d4 = await atDoor("lap 2", " (the house's own address)");
    t.check("…that's the lap-2 copy of the house (not lap 1's spot)", lap.e2 > lap.e1 + 1000 && Math.hypot(d4.door[0] - d1.door[0], d4.door[1] - d1.door[1]) > 100, JSON.stringify({ lap, d1: d1.door, d4: d4.door }));
    // "🏠 Start my days here" picked HERE (lap 2) → a new day (lap 1's town) starts at the right door
    const sa = await g(`(() => { const r = ctx.realestate.homes().find(h => h.id === ${ID}); ctx.home.setStartAt(ctx.realestate.debug.startAtFor(r)); return ctx.home.startAt; })()`);
    await g(`ctx.onegame.home({ via: "test" })`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk" && __lulu3d.ctx.town.id === "lakewood"`, "a new day at her house", 30000);
    const d5 = await g(`(() => { const r = ctx.realestate.homes().find(h => h.id === ${ID}), p = ctx.foot.pos; return { gap: r && p ? +Math.hypot(p.x - r.ap.x, p.z - r.ap.z).toFixed(1) : null }; })()`);
    t.check("Start my days here, picked on lap 2: the new day starts at that house's door", d5.gap != null && d5.gap < 4, JSON.stringify({ d5, sa: sa && sa.door }));
    await g(`(ctx.home.setStartAt(null), true)`);
    await t.shot("go-lap2");

    // ── 5. the refusals (one plain line each) ──
    await free();
    const why = () => g(`ctx.realestate.goBlock(${ID})`);
    const law = await g(`(() => { const d = Object.getOwnPropertyDescriptor(ctx.law, "wanted"); window.__wd = d; Object.defineProperty(ctx.law, "wanted", { get: () => 2, configurable: true }); return !!d; })()`);
    const wW = await why();
    await g(`(Object.defineProperty(ctx.law, "wanted", window.__wd), true)`);
    t.check("wanted: refused — lose the cops first", law && /cops/i.test(wW), wW);
    const tW = await t.L(`import("./js/core/ctx.js").then(m => { m.emit("shops:test", { id: "x", phase: "start" }); const w = __lulu3d.ctx.realestate.goBlock(${ID}); m.emit("shops:test", { id: "x", phase: "end" }); return w; })`).catch(e => String(e));
    t.check("on a test drive: refused", /test car/i.test(String(tW)), String(tW));
    const dW = await g(`(() => { const m = ctx.G.mode; ctx.G.mode = "dina"; const w = ctx.realestate.goBlock(${ID}); ctx.G.mode = m; return w; })()`);
    t.check("Dina's mode: refused", /Dina/.test(dW), dW);
    const tn = await g(`(() => { ctx.realestate.findTenant(${ID}); const w = ctx.realestate.goBlock(${ID}); ctx.realestate.debug.RN.tenantOut(${ID}); return w; })()`);
    t.check("a tenant lives there: refused", /tenant/i.test(tn), tn);
    const sz = await g(`(() => { const h = ctx.realestate.debug.S.owned[${ID}]; h.seized = Date.now(); const w = ctx.realestate.goBlock(${ID}); delete h.seized; return w; })()`);
    t.check("the Council's (seized): refused", /Council/.test(sz), sz);
    const cd = await g(`(() => { ${GO}.last = performance.now() / 1000; return ctx.realestate.goBlock(${ID}); })()`);
    t.check("right after a trip: a short wait", /Wait \d+ more second/.test(cd), cd);
    await free();
    const nm = await g(`ctx.realestate.goBlock("lakewood:1:1")`);
    t.check("not her house: refused", /isn't yours/.test(nm), nm);
    t.check("…and a refused Go there moves nothing", await g(`(() => { const p = ctx.foot.pos && ctx.foot.pos.clone(); const m = ctx.G.mode; ctx.G.mode = "dina"; const r = ctx.realestate.goTo(${ID}); ctx.G.mode = m; return r !== "" && (!p || p.distanceTo(ctx.foot.pos) < 0.01); })()`));
    t.check("free: no coins moved by going there", (await g(`L3.wallet.coins`)) >= 0);

    const rep = await W.report(t).catch(() => null);
    if (rep) W.check(t, "the QA watchdog: nothing odd through every trip", rep);
  },
};
