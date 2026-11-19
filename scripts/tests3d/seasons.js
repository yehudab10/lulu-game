// 🕎 Seasons (features/seasons): the world follows the real Hebrew calendar.
//   • the calendar: real dates → the right days (Chanukah starts at SUNDOWN, +1 candle each evening; fast days that fall
//     on Shabbos move; Taanis Esther on Thursday; the Three Weeks / Nine Days / Tisha B'Av; Friday + Shabbos)
//   • every holiday previewed through the override (ctx.seasons.debug.season): the right things appear on the highway
//     and in Lakewood / Midwood (menorahs with tonight's candles + the shamash, the big menorah, the stall + its goods,
//     sukkahs / frames, baskets + the parade, kerb piles, bonfires, planters, Shabbos candles); quiet days dress nothing
//   • the budgets: a decorated town vs. the same town undecorated (draw calls / triangles) + the town tests' ceilings
//   • the stall treat pays ONCE per real day; the ⚙️ setting turns it all off; Ima's 📱 note; Lulu's line
//   • Dina's mode: nothing of it in her world (it's a set), and every prop kind is on the wholesome list
//   • a 🎉 party: the guest dresses the world for the HOST's day (two real pages, the local relay)
const { spawn } = require("child_process");
const path = require("path");
const PORT = 26000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let relay = null;
function startRelay() {
  return new Promise((resolve, reject) => {
    relay = spawn(process.execPath, [path.join(__dirname, "..", "..", "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ["ignore", "pipe", "pipe"] });
    let done = false; const ok = () => { if (!done) { done = true; resolve(); } };
    relay.stdout.on("data", d => { if (/listen/i.test(String(d))) ok(); });
    relay.on("error", reject); setTimeout(ok, 1500);
  });
}
process.on("exit", () => { try { relay && relay.kill(); } catch (e) { } });
const Q = `&enable=seasons,town,homes,atmos,phone,party,foot&mpurl=${encodeURIComponent(URL)}`;
const WHOLESOME = /^(menorah|candles|bigMenorah|stand:#[0-9A-F]{6}|Goods_\w+|sukkah|sukkahFrame|basket|kerb|bonfire|logBench|planter|banner)$/;

module.exports = {
  name: "seasons",
  viewport: { width: 1280, height: 720 },
  query: Q,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", mpName: "Kugel Kid" },
  save3d: { f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    const step = async (label, fn) => { try { return await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 400)); return null; } };
    const info = () => g(`ctx.seasons.info()`);
    const items = kind => g(`ctx.seasons.debug.items(${kind ? JSON.stringify(kind) : ""})`);
    const season = async (id, n = 1, opts = {}) => { await g(`ctx.seasons.debug.season(${JSON.stringify(id)}, ${n}, ${JSON.stringify(opts)})`); await t.until(`(() => { const i = __lulu3d.ctx.seasons.info(); return !i.want || i.sets.length > 0; })()`, `${id} dressed`, 30000); await t.frames(3); };
    // a fixed camera for screenshots (the chase cam keeps running underneath)
    await t.L(`import("./js/core/ctx.js").then(m => { const o = m.ctx.cam.update.bind(m.ctx.cam); m.ctx.cam.update = dt => { o(dt); const c = window.__camAt; if (!c) return; const cam = m.ctx.camera; cam.position.set(c.x, c.y || 2.2, c.z); cam.lookAt(c.lx, c.ly || 1.6, c.lz); }; })`);
    const look = (x, z, lx, lz, y = 2.2, ly = 1.6) => g(`(window.__camAt = { x: ${x}, z: ${z}, lx: ${lx}, lz: ${lz}, y: ${y}, ly: ${ly} }, true)`);
    const unlook = () => g(`(window.__camAt = null, true)`);
    const park = (x, z, h) => g(`(ctx.car.place(${x}, ${z}, ${h}), ctx.car.vx = ctx.car.vz = 0, ctx.car.speed = 0, ctx.cam.snap(), true)`);
    const night = () => g(`(ctx.atmos.debug.time("night"), ctx.atmos.debug.freeze(true), true)`);
    const noon = () => g(`(ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    const perf = async frames => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles);
          const D = __lulu3d.ctx.seasons.debug.D.stats; P.own = Math.max(P.own, D.calls); P.ownTris = Math.max(P.ownTris, D.tris); }; }
        window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0, own: 0, ownTris: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, own: P.own, ownTris: P.ownTris }; })()`);
    };

    // ── the calendar (pure) ─────────────────────────────────────────────
    await step("calendar", async () => {
      const cases = [
        ["2026-11-19T12:00", "", 0, "an ordinary Thursday (9 Kislev)"],
        ["2026-11-20T15:00", "friday", 0, "Friday afternoon → the erev-Shabbos bustle"],
        ["2026-11-20T19:00", "shabbos", 0, "Friday night → Shabbos (candles)"],
        ["2026-12-04T15:00", "friday", 0, "erev Chanukah, before sunset: no candles yet"],
        ["2026-12-04T18:00", "chanukah", 1, "Friday 4 Dec 2026 after sunset → Chanukah night 1"],
        ["2026-12-07T19:30", "chanukah", 4, "Monday evening → night 4"],
        ["2026-12-11T19:00", "chanukah", 8, "the eighth night"],
        ["2026-12-12T18:00", "", 0, "Chanukah is over Saturday night"],
        ["2027-03-22T12:00", "taanisEsther", 0, "Taanis Esther (13 Adar II 5787)"],
        ["2027-03-23T12:00", "purim", 0, "Purim, 14 Adar II"],
        ["2027-04-15T12:00", "pesachPrep", 0, "Pesach cleaning (8 Nisan)"],
        ["2027-05-24T21:00", "lagBaomer", 0, "Lag BaOmer starts the evening before"],
        ["2027-06-11T12:00", "shavuos", 0, "Shavuos, 6 Sivan"],
        ["2027-07-22T12:00", "tamuz17", 0, "the 17th of Tamuz"],
        ["2027-08-07T12:00", "nineDays", 0, "the Nine Days (on Shabbos: still quiet)"],
        ["2027-08-12T12:00", "tishaBav", 0, "Tisha B'Av 5787"],
        ["2027-10-14T12:00", "sukkosPrep", 0, "sukkahs going up (13 Tishri)"],
        ["2027-10-16T12:00", "sukkos", 0, "Sukkos"],
      ];
      const got = await t.L(`import("./js/features/seasons/calendar.js").then(m => { const out = ${JSON.stringify(cases)}.map(([iso]) => { m.setDate(iso); const d = m.today(); return [d.main || "", d.chanukah, d.quiet, d.candles]; }); m.setDate(null); return out; })`);
      cases.forEach(([iso, main, ch, what], i) => t.check(`calendar: ${what}`, got[i][0] === main && (!ch || got[i][1] === ch), `${iso} → ${JSON.stringify(got[i])}`));
      // a fast day on Shabbos moves: 9 Av 5785 fell on Shabbos (2 Aug 2025) → Tisha B'Av on Sunday 3 Aug
      const tb = await t.L(`import("./js/features/seasons/calendar.js").then(m => { const r = []; for (const iso of ["2025-08-02T12:00", "2025-08-03T12:00"]) { m.setDate(iso); r.push(m.today().ids.join(",")); } m.setDate(null); return r; })`);
      t.check("calendar: Tisha B'Av on Shabbos is pushed to Sunday", !/tishaBav/.test(tb[0]) && /tishaBav/.test(tb[1]), JSON.stringify(tb));
      const quiet = await t.L(`import("./js/features/seasons/places.js").then(m => import("./js/features/seasons/calendar.js").then(c => { c.setDate("2027-08-12T12:00"); const r = m.recipesFor(c.today()); c.setDate(null); return r.filter(x => x.recipe.stand || x.recipe.windows === "menorah" || x.recipe.parade).length; }))`);
      t.check("a fast day dresses nothing festive", quiet === 0, String(quiet));
    });

    t.check("ctx.seasons service + ⚙️ setting", await g(`!!ctx.seasons && !!ctx.seasons.debug`) && (await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("settings").some(i => i.id === "seasons"))`)));
    t.check("no new home tile", !(await t.titleItems()).some(l => /holiday|season/i.test(l)));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "drives", 20000);
    await g(`(ctx.atmos.debug.cruise(0), true)`);

    // ── 🕎 Chanukah on the highway ───────────────────────────────────────
    await step("chanukah highway", async () => {
      await season("chanukah", 5);
      const it = await items("menorah");
      t.check("chanukah: menorahs in the highway houses' windows", it.length >= 2, `${it.length}`);
      t.check("chanukah: night 5 → 5 candles (+ the shamash) burn", it.length && it.every(i => i.lights === 5));
      await night();
      const s = await g(`(() => { for (const c of [...ctx.world.chunks.values()].sort((a, b) => a.k - b.k)) if (c.houses && c.houses.length && !c.building && ctx.seasons.debug.D.sets.has("c" + c.k)) return { s: c.houses[0].s, d: c.houses[0].d, x: c.houses[0].x, z: c.houses[0].z }; return null; })()`);
      if (s) {
        await g(`(() => { const r = ctx.world.road, p = r.point(${s.s} - 30, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s.s} - 30; ctx.car.d = 1.75; ctx.world.prebuild(${s.s} - 30); ctx.cam.snap(); return true; })()`);
        const p = await g(`(() => { const r = ctx.world.road, p = r.point(${s.s}, ${s.d > 0 ? 9 : -9}, {}); return p; })()`);
        await look(p.x, p.z, s.x, s.z, 2.4, 1.6);
        await t.frames(12);
        await t.shot("chanukah-highway-house-night");
        await unlook();
      }
      const st = await info();
      t.check("chanukah: the lights are lit at night", st.lit > 0.5 && st.stats.lights > 0, JSON.stringify(st.stats));
    });

    // ── 🕎 Chanukah in Lakewood: windows, the big menorah, the stall; perf ──
    let lakewoodOk = false;
    await step("chanukah lakewood", async () => {
      await g(`ctx.town.load("lakewood")`);
      await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "lakewood models", 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "lakewood", speed: 0 }), true)`);
      lakewoodOk = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.seasons.info().sets.includes("town")`, "lakewood dressed", 15000);
      await t.frames(5);
      const n = (await items("menorah")).filter(i => i.set === "town");
      t.check("lakewood: a menorah in (almost) every house's front windows", n.length >= 80, `${n.length}`);
      const big = await items("bigMenorah");
      t.check("lakewood: the big menorah by the town hall, night 5", big.length === 1 && big[0].lights === 5, JSON.stringify(big));
      const stands = await g(`ctx.seasons.debug.stands()`);
      t.check("lakewood: the sufganiyot stall + its doughnuts", stands.length >= 1 && (await items("Goods_Donuts")).length >= 1, JSON.stringify(stands));
      // the shots: a duplex at night, the big menorah, the stall (day + night)
      const h = await g(`(() => { const h = ctx.town.homes.find(h => h.key === "town_duplex"); return h; })()`);
      await park(h.lotX + h.nx * 7 + h.ux * 6, h.lotZ + h.nz * 7 + h.uz * 6, Math.atan2(h.ux, h.uz));
      await night();
      await look(h.lotX + h.nx * 7, h.lotZ + h.nz * 7, h.x, h.z, 2.2, 1.8);
      await t.frames(10);
      await t.shot("chanukah-lakewood-windows-night");
      await look(h.lotX + h.nx * 9 - h.ux * 30, h.lotZ + h.nz * 9 - h.uz * 30, h.lotX + h.ux * 10, h.lotZ + h.uz * 10, 1.8, 2.0);
      await t.frames(10);
      await t.shot("chanukah-lakewood-street-night");
      if (big[0]) {
        const sp = await g(`ctx.town.spot("hall")`);
        await look(sp.x + sp.nx * 9 + sp.ux * 6, sp.z + sp.nz * 9 + sp.uz * 6, big[0].x, big[0].z, 2.0, 2.8);
        await t.frames(10);
        await t.shot("chanukah-lakewood-big-menorah-night");
      }
      if (stands[0]) {
        const a = stands[0];
        await noon();
        await look(a.x + Math.sin(0) * 0 + 6, a.z + 6, a.x, a.z, 2.0, 1.4);
        await t.frames(10);
        await t.shot("chanukah-lakewood-stall-day");
      }
      await unlook();
    });

    await step("budget", async () => {
      if (!lakewoodOk) return;
      // the same pose with and without the dressing: a residential street at night (the worst case: every light on)
      // (the town test's own ceilings are without homes' crowd: it has its own budget in the homes test)
      const h = await g(`ctx.town.homes.find(h => h.key === "town_duplex")`);
      await g(`(ctx.homes.debug.stopCrowd(), true)`);
      await park(h.lotX + h.nx * 8.5 - h.ux * 20, h.lotZ + h.nz * 8.5 - h.uz * 20, Math.atan2(h.ux, h.uz));
      await night();
      await season("none");
      await t.frames(8);
      const off = await perf(30);
      await season("chanukah", 8);
      await t.frames(8);
      const on = await perf(30);
      const ds = await g(`Object.assign({}, ctx.seasons.debug.D.stats)`);
      await season("sukkos");
      await noon();
      await t.frames(8);
      const sk = await perf(30);
      await night();
      console.log("   PERF seasons town", JSON.stringify({ off, chanukah8: on, sukkos: sk, dress: ds }));
      // (what the dressing itself draws — the off → on totals also swing with the minivans driving in and out of view)
      t.check("budget: the dressing draws ≤ 12 draw calls (Chanukah night 8 / Sukkos)", on.own <= 12 && sk.own <= 12, `chanukah ${on.own}, sukkos ${sk.own} (town ${off.calls} → ${on.calls} / ${sk.calls})`);
      t.check("budget: the dressing draws ≤ 9k triangles", on.ownTris <= 9000 && sk.ownTris <= 9000, `chanukah ${on.ownTris}, sukkos ${sk.ownTris} (town ${off.tris} → ${on.tris} / ${sk.tris})`);
      t.check("budget: a decorated Lakewood stays inside the town test's ceilings (≤ 240 calls, ≤ 115k triangles)", Math.max(on.calls, sk.calls) <= 240 && Math.max(on.tris, sk.tris) <= 115000, JSON.stringify({ on, sk }));
      await g(`(ctx.homes.debug.startCrowd(), true)`);
    });

    // ── 🎭 Purim: the parade + mishloach manos ─────────────────────────
    await step("purim", async () => {
      if (!lakewoodOk) return;
      await season("purim");
      await t.until(`__lulu3d.ctx.seasons.info().parade.ready`, "the parade is out", 30000);
      const P = await g(`ctx.seasons.info().parade`);
      t.check("purim: a costume parade marches in Lakewood", P.marchers >= 10 && Object.values(P.hats).reduce((a, b) => a + b, 0) >= 6, JSON.stringify(P));
      t.check("purim: mishloach manos on the doorsteps", (await items("basket")).length >= 20, String((await items("basket")).length));
      t.check("purim: the hamantaschen stall", (await items("Goods_Hamantaschen")).length >= 1);
      t.check("purim: no menorahs left over", (await items("menorah")).length === 0);
      await noon();
      const r = await g(`(() => { const s = ctx.seasons.debug.D.sets.get("parade"); const b = s && s.items[0]; return b ? { x: b.x, z: b.z } : null; })()`);
      if (r) {
        await look(r.x + 9, r.z + 9, r.x, r.z, 2.6, 1.2);
        await t.frames(14);
        await t.shot("purim-lakewood-parade-day");
      }
      const d = await g(`(() => { const d = ctx.homes.homes()[3]; return d; })()`);
      if (d) { await look(d.ap.x + (d.ap.x - d.door.x) * 2.5, d.ap.z + (d.ap.z - d.door.z) * 2.5, d.door.x, d.door.z, 1.9, 0.8); await t.frames(8); await t.shot("purim-lakewood-doorstep"); }
      await unlook();
    });

    // ── 🔨🌿 Sukkos: going up, then done ──────────────────────────────
    await step("sukkos", async () => {
      if (!lakewoodOk) return;
      await season("sukkosPrep", 1);
      const fr = (await items("sukkahFrame")).length, dn = (await items("sukkah")).length;
      t.check("before Sukkos: frames going up (and a few finished)", fr >= 10 && fr > dn, `${fr} frames, ${dn} done`);
      t.check("before Sukkos: the lulav & esrog stall", (await items("Goods_Lulavim")).length >= 1);
      await season("sukkos");
      const sk = await items("sukkah");
      t.check("Sukkos: sukkahs on the duplexes' decks", sk.filter(i => i.y > 3).length >= 10 && (await items("sukkahFrame")).length === 0, `${sk.length} (${sk.filter(i => i.y > 3).length} on decks)`);
      const h = await g(`ctx.town.homes.find(h => h.key === "town_duplex")`);
      await noon();
      await look(h.lotX + h.nx * 10 + h.ux * 10, h.lotZ + h.nz * 10 + h.uz * 10, h.x - h.ux * 5, h.z - h.uz * 5, 3.0, 3.0);
      await t.frames(10);
      await t.shot("sukkos-lakewood-deck-day");
      await night();
      await t.frames(6);
      await t.shot("sukkos-lakewood-deck-night");
      await unlook();
    });

    // ── 🧹 💐 🕯️ the rest in Lakewood ─────────────────────────────────
    await step("pesach shavuos shabbos", async () => {
      if (!lakewoodOk) return;
      await season("pesachPrep");
      t.check("before Pesach: the clean-out piled at the kerb", (await items("kerb")).length >= 15);
      const k = (await items("kerb"))[2];
      if (k) { await noon(); await look(k.x + 6, k.z + 5, k.x, k.z, 2.0, 0.5); await t.frames(8); await t.shot("pesach-lakewood-kerb-day"); await unlook(); }
      await season("shavuos");
      t.check("Shavuos: planters by the doors + the cheesecake stall", (await items("planter")).length >= 15 && (await items("Goods_Cheesecake")).length >= 1);
      await season("friday");
      t.check("Friday: the challah & flowers stall", (await items("Goods_Challah")).length >= 1);
      await season("shabbos");
      const c = await items("candles");
      t.check("Shabbos: candles in a front window of most houses, two burning", c.length >= 40 && c.every(i => i.lights === 2), `${c.length}`);
      const h = await g(`ctx.town.homes.find(h => h.key === "town_duplex")`);
      await night();
      await look(h.lotX + h.nx * 6, h.lotZ + h.nz * 6, h.x, h.z, 1.8, 1.5);
      await t.frames(10);
      await t.shot("shabbos-lakewood-candles-night");
      await unlook();
      for (const id of ["tishaBav", "threeWeeks", "taanisEsther", "yomKippur"]) {
        await season(id);
        const all = await items();
        t.check(`${id}: quiet — nothing festive in the world`, all.every(i => i.kind === "candles"), all.map(i => i.kind).slice(0, 5).join(","));
      }
    });

    // ── the stall treat: once per real day ───────────────────────────
    await step("treat", async () => {
      if (!lakewoodOk) return;
      await g(`ctx.seasons.debug.resetPaid()`);
      await season("chanukah", 2);
      const w0 = await t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
      const a = await g(`(() => { const s = ctx.seasons.debug.stands()[0]; return ctx.seasons.debug.treat(s.x, s.z); })()`);
      const b = await g(`(() => { const s = ctx.seasons.debug.stands()[0]; return ctx.seasons.debug.treat(s.x, s.z); })()`);
      await season("purim");
      const c = await g(`(() => { const s = ctx.seasons.debug.stands()[0]; return s ? ctx.seasons.debug.treat(s.x, s.z) : null; })()`);
      const w1 = await t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
      t.check("treat: the first one pays (once)", a && a.paid && a.coins > 0 && b && !b.paid && b.coins === 0, JSON.stringify([a, b]));
      t.check("treat: another holiday's stall the same real day pays nothing (capped per REAL day)", !c || (!c.paid && c.coins === 0), JSON.stringify(c));
      t.check("treat: the wallet grew by exactly one treat", w1 - w0 === a.coins, `${w0} → ${w1}`);
      // on foot: the ✋ spot at the stall
      await season("chanukah", 2);
      const s = (await g(`ctx.seasons.debug.stands()`))[0];
      await g(`ctx.foot.start("parked", { noIntro: true, at: { x: ${s.x + 0.5}, z: ${s.z + 0.5} } })`);
      await t.until(`__lulu3d.ctx.foot.active`, "on foot", 8000);
      await t.frames(6);
      const hint = await t.L(`(() => { const e = document.querySelector("#footHint, .foot-hint, #actBtn"); return document.body.innerText; })()`);
      t.check("treat: the ✋ prompt at the stall on foot", /SUFGANIYAH/.test(hint), hint.slice(0, 160).replace(/\n/g, " "));
    });

    // ── ⚙️ off ───────────────────────────────────────────────────────
    await step("setting", async () => {
      await t.L(`import("./js/core/save.js").then(m => { m.store("seasons").on = false; })`);
      await g(`ctx.seasons.debug.rebuild()`);
      await t.frames(3);
      t.check("⚙️ Holidays in the world OFF: nothing dressed", (await items()).length === 0 && !(await info()).want);
      await t.L(`import("./js/core/save.js").then(m => { m.store("seasons").on = true; })`);
      await g(`ctx.seasons.debug.rebuild()`);
      await t.frames(3);
      t.check("… and back ON", (await items()).length > 0);
    });

    // ── Midwood ───────────────────────────────────────────────────────
    await step("midwood", async () => {
      await g(`(ctx.foot.active ? ctx.foot.end("test") : 0, true)`);
      await t.frames(3);
      await g(`ctx.town.leave("reset")`);
      await t.frames(3);
      await g(`ctx.town.load("midwood")`);
      await t.until(`__lulu3d.ctx.town.loaded("midwood")`, "midwood models", 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "midwood", speed: 0 }), true)`);
      await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "midwood"`, "in midwood", 15000);
      await season("chanukah", 8);
      await t.frames(4);
      t.check("midwood: menorahs in the windows + the big menorah", (await items("menorah")).filter(i => i.set === "town").length >= 60 && (await items("bigMenorah")).length === 1);
      const h = await g(`ctx.town.homes.find(h => h.key === "town_mw_house") || ctx.town.homes[0]`);
      await night();
      await look(h.lotX + h.nx * 9 - h.ux * 12, h.lotZ + h.nz * 9 - h.uz * 12, h.x + h.ux * 6, h.z + h.uz * 6, 2.0, 2.4);
      await t.frames(10);
      await t.shot("chanukah-midwood-night");
      await season("sukkos");
      t.check("midwood: sukkahs in the front yards", (await items("sukkah")).length >= 8);
      await noon();
      await t.frames(8);
      await t.shot("sukkos-midwood-day");
      await unlook();
      await g(`ctx.town.leave("reset")`);
      await t.frames(3);
    });

    // ── 🔥 Lag BaOmer on the highway ──────────────────────────────────
    await step("lag baomer", async () => {
      await season("lagBaomer");
      // drive the road forward far enough that a few chunks are built with the bonfire dice
      let bf = [];
      for (let i = 0; i < 8 && !bf.length; i++) {
        const s0 = 900 + i * 600;
        await g(`(() => { const r = ctx.world.road, p = r.point(${s0}, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = ${s0}; ctx.car.d = 1.75; ctx.world.prebuild(${s0}); ctx.cam.snap(); return true; })()`);
        await t.frames(4);
        bf = await items("bonfire");
      }
      t.check("Lag BaOmer: a bonfire out in a field", bf.length >= 1, String(bf.length));
      if (bf[0]) {
        const b = bf[0];
        await night();
        await look(b.x + 9, b.z + 9, b.x, b.z, 3.0, 0.8);
        await t.frames(10);
        await t.shot("lagbaomer-bonfire-night");
        await unlook();
      }
    });

    // ── Dina's mode: none of it ──────────────────────────────────────
    await step("dina", async () => {
      await season("lagBaomer");
      const kinds = await g(`[...ctx.seasons.debug.D.kinds.keys()]`);
      t.check("every prop kind is on the wholesome list", kinds.every(k => WHOLESOME.test(k)), kinds.join(","));
      await g(`L3.setState("title")`);
      await t.frames(4);
      await t.click(/Dina/);
      await t.until(`__lulu3d.state === "dinaSelect"`, "Dina's picker");
      await t.tap(0);
      await t.until(`__lulu3d.state === "dinaBus" && !!__lulu3d.ctx.view`, "Dina's bus intro", 30000);
      await t.frames(10);
      await t.shot("dina-bus");
      const inDina = await g(`(() => { const v = ctx.view; let n = 0; if (v && v.scene) v.scene.traverse(o => { if (/^Seasons/.test(o.name || "")) n++; }); return { view: !!v, n }; })()`);
      t.check("Dina's mode: her own world, no seasonal props in it", inDina.view && inDina.n === 0, JSON.stringify(inDina));
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      await t.until(`__lulu3d.state === "playing"`, "back on the road", 20000);
    });

    // ── Ima's note ──────────────────────────────────────────────────
    await step("ima", async () => {
      await g(`ctx.seasons.debug.resetPaid()`);
      await season("chanukah", 3);
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      await t.frames(160);
      const msgs = await g(`(ctx.phone.inbox && ctx.phone.inbox.msgs || []).filter(m => /Chanukah/.test(m.msg || m.text || "")).length`);
      t.check("Ima's 📱 note in the family chat (night 3)", msgs >= 1, String(msgs));
    });

    // ── 🎉 a party: the guest takes the host's day ─────────────────────
    await step("party", async () => {
      await startRelay();
      await g(`ctx.seasons.debug.season("purim")`);
      await g(`L3.setState("title")`);
      await t.frames(3);
      await t.click(/Party with friends/);
      await t.click(/Host a party/);
      const until = async (code, what, ms = 90000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await g(`(() => { try { return !!(${code}); } catch (e) { return false; } })()`).catch(() => false)) return true; await sleep(200); } t.check(what, false, "timed out"); return false; };
      if (!await until(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.isHost`, "host: lobby")) return;
      const code = await g(`ctx.party.code`);
      const browser = t.page.context().browser();
      const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
      const errors = [];
      page.on("pageerror", e => errors.push(String(e && e.stack || e)));
      await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      await page.addInitScript(() => { if (!sessionStorage.getItem("__seeded")) localStorage.setItem("luluSaveV2", JSON.stringify({ totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" })); sessionStorage.setItem("__seeded", "1"); });
      const base = t.page.url().split("/3d/")[0];
      // the guest's own device says it's Chanukah night 3 — the host's Purim must win
      await page.goto(`${base}/3d/?test${Q}&season=chanukah&night=3&party=${code}`);
      const G = c => page.evaluate(`(() => { const L3 = window.__lulu3d, ctx = L3.ctx; return (${c}); })()`);
      const guntil = async (c, what, ms = 120000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await G(`(() => { try { return !!(${c}); } catch (e) { return false; } })()`).catch(() => false)) return true; await sleep(200); } t.check(what, false, "timed out"); return false; };
      try {
        if (!await guntil(`ctx.state === "partyLobby" && ctx.party.connected && ctx.party.host`, "guest joins")) return;
        await t.L(`(() => { const b = document.querySelector("#pt_act_trip"); if (b) b.click(); })()`);
        await sleep(300);
        await t.L(`(() => { const b = document.querySelector("#pt_go"); if (b) b.click(); })()`);
        await until(`ctx.state === "playing" && ctx.G.mode === "party"`, "host: GO", 60000);
        await guntil(`ctx.state === "playing" && ctx.G.mode === "party"`, "guest: GO", 60000);
        await guntil(`ctx.seasons.info().source === "host" && ctx.seasons.main === "purim"`, "guest: the host's day (Purim), not its own Chanukah", 30000);
        const hm = await g(`ctx.seasons.main`), gm = await G(`ctx.seasons.main`);
        t.check("party: host and guest dress the world for the same day", hm === "purim" && gm === "purim", `${hm} / ${gm}`);
        await sleep(1500);
        const sig = c => `ctx.seasons.debug.items().filter(i => /^c\\d+$/.test(i.set)).map(i => i.set + ":" + i.kind + "@" + i.x.toFixed(1) + "," + i.z.toFixed(1)).sort()`;
        const a = await g(sig()), b = await G(sig());
        const common = a.filter(x => b.includes(x)).length, sets = new Set(a.map(x => x.split(":")[0])).size;
        const both = a.filter(x => new Set(b.map(y => y.split(":")[0])).has(x.split(":")[0]));
        t.check("party: the same highway chunks hold the same things at the same spots", both.length === 0 || both.every(x => b.includes(x)), `${common} shared of ${a.length} / ${b.length} (${sets} chunks)`);
        t.check("party guest: no page errors", errors.length === 0, errors.slice(0, 2).join(" | ").slice(0, 300));
      } finally {
        try { await page.close(); } catch (e) { }
        try { await g(`ctx.party.leave()`); } catch (e) { }
        try { relay.kill(); } catch (e) { }
      }
    });
  },
};
