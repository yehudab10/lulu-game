// 🏡 Homelife (features/homes, roadmap 15 — houses with something going on).
//   stage 0 — the real-estate hook + STABLE door ids:
//     • every door's id is "town:lx:lz" (the door in the town's own frame — the same scheme as ctx.realestate.keyOf)
//     • a landmark replacing a neighbour: every other door keeps its id AND its family
//     • ctx.homes.claim(fn): a claimed door has no household (status), no ✋ from homes, no knock / break-in, no porch scene
//     • moveOut / moveIn (saved); household(id) / householdAt(x, z) — "who lives here"
//   stage 1 — households with a life:
//     • schedules (the seasons preview hooks + the game clock): 3 a.m. → cereal over the sink, Friday afternoon → erev
//       Shabbos, Friday night → the Shabbos table, Motzei Shabbos → pizza, a weekday morning → quiet / the morning rush;
//       the same door + hour → the same scene (friends see one scene); the street isn't all one scene
//     • every scene stages in two layouts, nobody inside a wall (the QA watchdog on too)
//     • who catches her: Zeidy → the cleaning lady; a kid → play; the Shabbos table → a guest (no phone on Shabbos)
//     • the cholent's hearts are capped per run (CHOLENT_CAP)
const W = require("../lib/qawatch.js");
module.exports = {
  name: "homelife",
  viewport: { width: 1280, height: 720 },
  query: `&enable=homes,town,law,foot,atmos,interiors,seasons,memory`,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, pepperSpray: 3 },
  async run(t) {
    const g = t.game, D = `ctx.homes.debug`;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    const inTown = async (town = "lakewood") => {
      if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
      await g(`ctx.town.load("${town}")`);
      await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town} models`, 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.homes.crowd().on`, `in ${town} with its crowd`, 60000);
    };
    const onFoot = async () => {
      if (!await g(`ctx.foot.active && L3.state === "footRun"`)) { await g(`ctx.foot.start("droveOff", { noIntro: true })`); await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000); }
    };
    // (a dialog ignores taps for a moment after it opens: wait, click, and again until it's taken)
    const choose = async re => { for (let k = 0; k < 12; k++) { await t.frames(6); const was = await g(`ctx.dialogOpen`); if (!was) return true; await t.click(re); await t.frames(4); if (!await t.L(`[...document.querySelectorAll("#dialog button")].some(b => ${re}.test(b.textContent))`)) return true; } return false; };
    const toDoor = async key => {
      await onFoot();
      await g(`(() => { if (window.__qa) { window.__qa.cutF = ctx.frames + 4; window.__qa.last = null; } const h = ctx.homes.household(${JSON.stringify(key)}), f = ctx.foot.pos; f.set(h.ap.x, 0.05, h.ap.z); ctx.foot.obj.position.copy(f);
        // (walked up to it: facing the door, the camera behind her on the street side)
        const yaw = Math.atan2(h.door.x - h.ap.x, h.door.z - h.ap.z); ctx.foot.obj.rotation.y = yaw; if (ctx.cam && ctx.cam.free) ctx.cam.free.yaw = yaw; if (ctx.cam && ctx.cam.snap) ctx.cam.snap(); return true; })()`);
      await t.frames(3);
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);

    // ── stage 0: stable ids + the real-estate hook ──
    await step("ids", async () => {
      if (!await inTown("lakewood")) return;
      const r = await g(`(() => { const H = ctx.homes.homes(), P = ctx.town.plan;
        const same = H.every(h => { const L = P.local(h.door.x, h.door.z, {}); return h.key === "lakewood:" + Math.round(L.x) + ":" + Math.round(L.z); });
        return { n: H.length, uniq: new Set(H.map(h => h.key)).size, same, ex: H[0] && H[0].key }; })()`);
      t.check("door ids are town + position in the town's frame (= ctx.realestate.keyOf)", r.n > 40 && r.same, JSON.stringify(r));
      t.check("door ids are unique", r.uniq === r.n, JSON.stringify(r));
      // a landmark takes a lot: drop house #2 from the town's list, rebuild — nobody else moves
      const st = await g(`(() => { const before = ctx.homes.homes().map(h => h.key + "|" + h.name);
        const T = ctx.town.debug.S.T, gone = T.homes.splice(2, 1)[0]; ${D}.rebuild();
        const after = new Set(ctx.homes.homes().map(h => h.key + "|" + h.name));
        T.homes.splice(2, 0, gone); ${D}.rebuild();
        const kept = before.filter(k => after.has(k)).length;
        return { before: before.length, after: after.size, kept }; })()`);
      t.check("a landmark replaces a house: every other door keeps its id and its family", st.after < st.before && st.kept === st.after, JSON.stringify(st));
    });
    await step("claim", async () => {
      if (!await g(`ctx.town.active`)) return;
      const key = await g(`ctx.homes.homes()[5].key`);
      t.check("household(id): who lives here", await g(`(() => { const h = ctx.homes.household(${JSON.stringify(key)}); return !!(h && h.name && h.cast.length && h.status === null && /^the /.test(h.family)); })()`));
      t.check("householdAt(x, z): the nearest door's family", await g(`(() => { const h = ctx.homes.household(${JSON.stringify(key)}); const a = ctx.homes.householdAt(h.ap.x + 0.5, h.ap.z); return !!a && a.id === h.id; })()`));
      await toDoor(key);
      t.check("an ordinary door: homes' ✋", (await g(`${D}.spot()`) || {}).key === key);
      // real estate claims it (Lulu's own house)
      await g(`(window.__unclaim = ctx.homes.claim(id => id === ${JSON.stringify(key)} ? "mine" : null), ctx.homes.refresh(), true)`);
      await t.frames(3);
      t.check("claimed: status 'mine', livedIn false", await g(`ctx.homes.household(${JSON.stringify(key)}).status === "mine" && !ctx.homes.livedIn(${JSON.stringify(key)})`));
      t.check("claimed: no ✋ from homes at that door", !(await g(`${D}.spot()`)));
      t.check("claimed: no knock, no break-in", !(await g(`ctx.homes.knock(${JSON.stringify(key)})`)) && !(await g(`ctx.homes.enter(${JSON.stringify(key)}, "sneak", "window")`)));
      t.check("claimed: no porch scene at that door", await g(`!ctx.homes.debug.CR.peds.some(p => p.home && p.home.key === ${JSON.stringify(key)})`));
      await g(`(window.__unclaim(), ctx.homes.refresh(), true)`);
      await t.frames(2);
      t.check("unclaimed: the family's back", await g(`ctx.homes.livedIn(${JSON.stringify(key)})`) && (await g(`${D}.spot()`) || {}).key === key);
      // the family moves out (saved)
      t.check("moveOut: the house is empty", await g(`ctx.homes.moveOut(${JSON.stringify(key)}) && ctx.homes.household(${JSON.stringify(key)}).status === "moved" && !!ctx.homes.debug.S.moved[${JSON.stringify(key)}]`));
      t.check("moveIn: back again", await g(`ctx.homes.moveIn(${JSON.stringify(key)}) && ctx.homes.livedIn(${JSON.stringify(key)})`));
    });

    // ── stage 1: households with a life ──
    const share = async (season, n, opts, hour) => {
      await g(`(ctx.seasons.debug.season(${JSON.stringify(season)}, ${n}, ${JSON.stringify(opts || {})}), ${D}.hour(${hour}), true)`);
      return g(`(() => { const c = {}; for (const h of ${D}.HS.homes.filter(h => !h.dark && ctx.homes.livedIn(h.key))) { const id = ${D}.sceneNow(h.key); c[id] = (c[id] || 0) + 1; } return c; })()`);
    };
    const top = c => Object.entries(c).sort((a, b) => b[1] - a[1])[0] || ["", 0];
    const frac = (c, id) => (c[id] || 0) / Object.values(c).reduce((a, b) => a + b, 0);
    await step("schedules", async () => {
      if (!await g(`ctx.town.active`)) return;
      t.check("households have traits + identity", await g(`ctx.homes.homes().every(h => h.traits.length === 2)`) && await g(`${D}.HS.homes.some(h => h.cast.includes("zeidy"))`));
      let c = await share("none", 1, { wd: 2, eve: false }, 3);
      t.check("3 a.m. on a Tuesday: most houses — cereal over the sink", frac(c, "cereal") > 0.6, JSON.stringify(c));
      c = await share("friday", 1, {}, 14);
      t.check("Friday 2 p.m.: erev Shabbos panic up and down the street", frac(c, "erevShabbos") > 0.6, JSON.stringify(c));
      c = await share("shabbos", 1, {}, 20);
      t.check("Friday night (Shabbos, 8 p.m.): the Shabbos table", frac(c, "shabbosTable") > 0.6, JSON.stringify(c));
      c = await share("shabbos", 1, {}, 15.5);
      t.check("Shabbos 3:30 p.m.: the Shabbos nap", frac(c, "shabbosNap") > 0.6, JSON.stringify(c));
      c = await share("none", 1, { wd: 0, eve: true }, 19.5);
      t.check("Motzei Shabbos: pizza", frac(c, "pizza") > 0.5, JSON.stringify(c));
      c = await share("none", 1, { wd: 2, eve: false }, 11);
      t.check("a weekday at 11: quiet houses (work + school), some plumbers / mah-jongg", frac(c, "quiet") > 0.4 && Object.keys(c).length >= 3, JSON.stringify(c));
      c = await share("none", 1, { wd: 3, eve: false }, 18.5);
      t.check("a weekday at 6:30 p.m.: supper, homework, violins — the street isn't one scene", Object.keys(c).length >= 4 && frac(c, top(c)[0]) < 0.8, JSON.stringify(c));
      t.check("a house the town left dark (life's windows never light it): out for the evening", await g(`(() => { const h = ${D}.HS.homes.find(h => h.dark); return !h || ${D}.sceneNow(h.key) === "out"; })()`));
      const same = await g(`(() => { const k = ${D}.HS.homes.map(h => h.key); const a = k.map(x => ${D}.sceneNow(x)); const b = k.map(x => ${D}.sceneNow(x)); return a.join() === b.join(); })()`);
      t.check("the same door at the same hour → the same scene (friends at one door see one scene)", same);
      const move = await g(`(() => { const k = ${D}.HS.homes.slice(0, 60).map(h => h.key); ${D}.hour(17.6); const a = k.map(x => ${D}.sceneNow(x)); ${D}.hour(20.2); const b = k.map(x => ${D}.sceneNow(x)); return a.filter((x, i) => x !== b[i]).length; })()`);
      t.check("…and the same house changes as the evening goes on", move >= 15, String(move));
    });

    // every scene, staged in two layouts
    const inside = () => t.until(`__lulu3d.state === "interior" && __lulu3d.ctx.homes.debug.room() && __lulu3d.ctx.homes.debug.room().res.length >= 0 && __lulu3d.ctx.homes.debug.VISIT.cur && __lulu3d.ctx.homes.debug.VISIT.cur.rt.ready`, "inside the house", 60000);
    const leave = async () => { await g(`(() => { const c = ctx.homes.debug.VISIT.cur; if (c) { c.V.exit = "door"; c.rt.leave(); } return true; })()`); await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000); await t.frames(3); };
    const enter = async (key, mode, scene) => {
      await g(`${D}.scene(${JSON.stringify(scene)})`);
      await toDoor(key);
      if (!await g(`ctx.homes.enter(${JSON.stringify(key)}, ${JSON.stringify(mode)}, "door")`)) return false;
      return inside();
    };
    const WALL = `(() => { const r = ${D}.room(); const walls = r.cols.filter(c => /^([pq]\\d|back|f\\d)$/.test(c.id)), B = r.bounds, bad = [];
      for (const q of r.res) {
        const inWall = walls.some(c => q.x > c.x0 - 0.12 && q.x < c.x1 + 0.12 && q.z > c.z0 - 0.12 && q.z < c.z1 + 0.12);
        const out = q.x < B.x0 - 0.3 || q.x > B.x1 + 0.3 || q.z < B.z0 - 0.3 || q.z > B.z1 + 0.3;
        const inFurn = !q.sit && !q.lie && !q.sleep && r.cols.some(c => !walls.includes(c) && q.x > c.x0 + 0.12 && q.x < c.x1 - 0.12 && q.z > c.z0 + 0.12 && q.z < c.z1 - 0.12);
        if (inWall || out || inFurn) bad.push(q.id + (inWall ? " in a wall" : out ? " outside" : " in furniture") + " @" + q.x + "," + q.z);
      }
      return { scene: r.scene, rooms: r.rooms.join("+"), n: r.res.length, bad }; })()`;
    await step("scenes", async () => {
      if (!await g(`ctx.town.active`)) return;
      await W.install(t);
      await g(`(ctx.seasons.debug.season("none", 1, { wd: 2, eve: false }), ${D}.hour(12), true)`);
      const ids = await g(`Object.keys(${D}.SCENES)`);
      for (const id of ids) {
        // two doors this scene can play in: one with kids (a kids' room), one without if the scene allows it
        const keys = await g(`(() => { const S = ${D}.SCENES[${JSON.stringify(id)}], ok = h => !S.needs || S.needs(h);
          const H = ${D}.HS.homes.filter(h => ctx.homes.livedIn(h.key) && ok(h) && h.cast.filter(k => !["cat", "dog", "baby"].includes(k)).length >= 2);
          const a = H.find(h => h.cast.some(k => k === "boy" || k === "girl")), b = H.find(h => h !== a && !h.cast.some(k => k === "boy" || k === "girl")) || H.find(h => h !== a && h.cast.length !== (a && a.cast.length));
          return [a, b].filter(Boolean).map(h => h.key); })()`);
        const seen = [];
        for (const key of keys) {
          if (!await enter(key, "sneak", id)) { t.check(`${id}: inside ${key}`, false); continue; }
          await t.frames(20);
          const r = await g(WALL);
          seen.push(r.rooms + "/" + r.n);
          t.check(`${id} in ${r.rooms} (${r.n} people): nobody inside a wall / outside / in furniture`, r.scene === id && r.bad.length === 0, JSON.stringify(r).slice(0, 300));
          await leave();
        }
        t.check(`${id}: staged in two layouts`, keys.length >= 2 && new Set(seen).size >= 2, seen.join(" · "));
      }
      W.check(t, "into + out of every scene", await W.report(t));
    });

    await step("catch", async () => {
      if (!await g(`ctx.town.active`)) return;
      // Zeidy wakes up: the cleaning lady
      const zk = await g(`(${D}.HS.homes.find(h => h.cast.includes("zeidy") && ctx.homes.livedIn(h.key)) || {}).key`);
      if (zk && await enter(zk, "sneak", "zeidyNap")) {
        await g(`${D}.notice("zeidy")`);
        await t.until(`(ctx => { const c = ctx.homes.debug.VISIT.cur; return c && c.V.caughtBy && c.V.caughtBy.length; })(__lulu3d.ctx)`, "Zeidy catches her", 15000);
        const r = await g(`(() => { const V = ctx.homes.debug.VISIT.cur.V; return { by: V.caughtBy, alarm: V.alarm, cleaner: !!V.cleaner }; })()`);
        t.check("Zeidy catches her → thinks she's the cleaning lady (no alarm)", r.cleaner && !r.alarm && r.by[0].how === "cleaning", JSON.stringify(r));
        await leave();
      } else t.check("a house with a Zeidy", false);
      // a kid in a homework scene: 7 × 8
      const kk = await g(`(${D}.HS.homes.find(h => h.cast.includes("boy") && h.cast.includes("mom") && ctx.homes.livedIn(h.key)) || {}).key`);
      if (kk && await enter(kk, "sneak", "homework")) {
        await g(`${D}.notice("boy")`);
        await t.until(`__lulu3d.ctx.dialogOpen`, "the kid asks", 15000);
        await choose(/Fifty-six/);
        await t.until(`(ctx => { const c = ctx.homes.debug.VISIT.cur; return c && c.V.caughtBy && c.V.caughtBy.length; })(__lulu3d.ctx)`, "…answered", 15000);
        const r = await g(`(() => { const V = ctx.homes.debug.VISIT.cur.V; const b = V.res.find(q => q.kind === "boy"); return { by: V.caughtBy, alarm: V.alarm, friendly: b.friendly }; })()`);
        t.check("a kid at homework catches her → 7 × 8 → \"Mommy, a TUTOR!\" (a guest, no alarm)", r.friendly && !r.alarm && r.by[0].how === "homework" && await g(`${D}.room().mode === "guest"`), JSON.stringify(r));
        await leave();
      }
      // the Shabbos table: spotted → a guest; nobody phones on Shabbos
      await g(`ctx.seasons.debug.season("shabbos", 1, {})`);
      const sk = await g(`(${D}.HS.homes.find(h => h.cast.includes("mom") && ctx.homes.livedIn(h.key)) || {}).key`);
      if (sk && await enter(sk, "sneak", "shabbosTable")) {
        t.check("Shabbos: noPhone", await g(`ctx.homes.debug.room().noPhone`));
        await g(`${D}.notice("mom")`);
        await t.until(`__lulu3d.ctx.homes.debug.room().converted`, "the Shabbos table sets a place", 15000);
        await t.frames(30);
        const r = await g(`(() => { const R = ctx.homes.debug.room(); return { mode: R.mode, converted: R.converted, reported: R.reported, calling: R.res.some(q => q.state === "calling") }; })()`);
        t.check("spotted at the Shabbos table → \"Gut Shabbos, sit!\" — a guest, no phone call", r.mode === "guest" && r.converted === "shabbos" && !r.reported && !r.calling, JSON.stringify(r));
        await leave();
        t.check("…and the family counts it as a guest visit", await g(`(ctx.homes.family(${JSON.stringify(sk)}) || {}).guest >= 1`));
      }
      await g(`(ctx.seasons.debug.season(null), ${D}.scene(null), true)`);
    });

    await step("cholent cap", async () => {
      if (!await g(`ctx.town.active`)) return;
      const key = await g(`(${D}.HS.homes.filter(h => ctx.homes.livedIn(h.key))[7] || {}).key`);
      if (!await enter(key, "guest", "ordinary")) return;
      const eat = () => g(`(() => { const c = ctx.homes.debug.VISIT.cur; const h = c.rt.hots.find(h => h.id === "cholent"); if (!h) return null; ctx.homes.debug.RUN.cholent.delete(c.V.home.key); const before = ctx.G.hearts; h.action(c.rt, h); return { before, after: ctx.G.hearts, n: ctx.homes.debug.RUN.hearts }; })()`);
      await g(`(ctx.homes.debug.RUN.hearts = 0, ctx.G.hearts = 1, true)`);
      const a = await eat();
      t.check("cholent: +1 heart (counted)", a && a.after === a.before + 1 && a.n === 1, JSON.stringify(a));
      await g(`(ctx.homes.debug.RUN.hearts = 3, ctx.G.hearts = 1, true)`);
      const b = await eat();
      t.check("cholent: capped at 3 hearts a run — the 4th is just delicious", b && b.after === b.before && b.n === 3, JSON.stringify(b));
      await leave();
    });

    // ── stage 2: reasons to knock ──
    await step("offers", async () => {
      if (!await g(`ctx.town.active`)) return;
      await g(`(ctx.seasons.debug.season("none", 1, { wd: 2, eve: false }), ${D}.hour(11), ${D}.VISITS.S.jobs = null, true)`);
      const n = await g(`${D}.HS.homes.filter(h => ${D}.offerFor(h.key)).length`), all = await g(`${D}.HS.homes.length`);
      t.check("about one door in six has something today", n >= all * 0.06 && n <= all * 0.32, `${n}/${all}`);
      await g(`ctx.seasons.debug.season("shabbos", 1, {})`);
      t.check("…and nothing on Shabbos (no errands, no money)", await g(`${D}.HS.homes.filter(h => ${D}.offerFor(h.key)).length`) === 0);
      await g(`ctx.seasons.debug.season("none", 1, { wd: 2, eve: false })`);
      t.check("the same offers all day (pure: door + the real day)", await g(`(() => { const a = ${D}.HS.homes.map(h => JSON.stringify(${D}.offerFor(h.key))).join(); return a === ${D}.HS.homes.map(h => JSON.stringify(${D}.offerFor(h.key))).join(); })()`));
    });
    await step("delivery", async () => {
      if (!await g(`ctx.town.active`)) return;
      const [a, b] = await g(`(() => { const H = ${D}.HS.homes.filter(h => ctx.homes.livedIn(h.key)); const A = H[3]; const B = H.find(h => h !== A && h.name !== A.name && Math.hypot(h.ap.x - A.ap.x, h.ap.z - A.ap.z) > 30); return [A.key, B.key]; })()`);
      await g(`(${D}.VISITS.S.jobs = null, ${D}.job(${JSON.stringify(a)}, "mail", ${JSON.stringify(b)}), true)`);
      t.check("📬 a delivery: carrying the mail to another family", (await g(`ctx.homes.delivery`) || {}).to === b);
      await toDoor(b);
      t.check("…their ✋ says DELIVER", /DELIVER/.test(await g(`${D}.label()`) || ""), await g(`${D}.label()`));
      await g(`${D}.door(${JSON.stringify(b)})`);
      await t.until(`__lulu3d.ctx.dialogOpen`, "the door menu", 10000);
      await choose(/Hand over/);
      for (let k = 0; k < 6 && await g(`ctx.dialogOpen || ctx.homes.debug.HS.busy`); k++) { await t.frames(30); if (await g(`ctx.dialogOpen`)) await t.tap(0); }
      await t.until(`!__lulu3d.ctx.homes.debug.HS.busy`, "delivered", 20000);
      const j = await g(`ctx.homes.jobs()`);
      t.check("delivered: +5 coins, both families remember the favour", j.n.mail === 1 && j.coins === 5 && (ctx => true)() && await g(`(ctx.homes.family(${JSON.stringify(a)}) || {}).favours >= 1 && (ctx.homes.family(${JSON.stringify(b)}) || {}).favours >= 1`), JSON.stringify(j));
      const pays = [];
      for (let k = 0; k < 3; k++) { await g(`${D}.job(${JSON.stringify(a)}, "mail", ${JSON.stringify(b)})`); pays.push(await g(`${D}.deliver(${JSON.stringify(b)})`)); }
      t.check("mail pays at most 3 times a real day (the 4th: thanks only)", pays.join() === "5,5,0", pays.join());
      await g(`(${D}.VISITS.S.jobs.coins = 36, true)`);
      await g(`${D}.job(${JSON.stringify(a)}, "dish", ${JSON.stringify(b)})`);
      t.check("all homes jobs: at most 40 coins a real day", await g(`${D}.deliver(${JSON.stringify(b)})`) === 4);
      t.check("a family she's done favours for greets her BY NAME from the porch (and waves her in)", /lulu/i.test(await g(`(${D}.VISITS.porchSaid.clear(), ${D}.porch(${JSON.stringify(b)}))`) || ""));
    });
    await step("porch pirate", async () => {
      if (!await g(`ctx.town.active`)) return;
      const k = await g(`${D}.HS.homes.filter(h => ctx.homes.livedIn(h.key))[11].key`);
      const f0 = await g(`(ctx.homes.family(${JSON.stringify(k)}) || {}).favours | 0`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("crime:porch", { id: ${JSON.stringify(k)}, fam: "x", phase: "back" }))`);
      await t.frames(2);
      const f = await g(`ctx.homes.family(${JSON.stringify(k)})`);
      t.check("📦 she got a family's package back (features/crime): a favour remembered, said at the door next time", f && (f.favours | 0) === f0 + 1 && f.pkg === "back", JSON.stringify(f));
    });
    await step("wave-in", async () => {
      if (!await g(`ctx.town.active`)) return;
      const b = await g(`Object.keys(${D}.S.fam).find(k => ctx.homes.livedIn(k) && (${D}.S.fam[k].favours | 0) >= 2)`);
      if (!b) { t.check("a liked family", false); return; }
      await g(`(() => { ${D}.VISITS.porchSaid.clear(); for (let k = 0; k < 6 && !${D}.invited(${JSON.stringify(b)}); k++) { ${D}.VISITS.porchSaid.clear(); ${D}.porch(${JSON.stringify(b)}); } return true; })()`);
      t.check("waved in: the door says so", await g(`${D}.invited(${JSON.stringify(b)})`));
      await toDoor(b);
      t.check("…✋ WAVING YOU IN", /WAVING/.test(await g(`${D}.label()`) || ""));
      await g(`${D}.door(${JSON.stringify(b)})`);
      await t.until(`__lulu3d.ctx.dialogOpen`, "the door menu", 10000);
      await choose(/waved you in/);
      if (await inside()) {
        t.check("…straight in as a guest", await g(`${D}.room().mode === "guest"`));
        await leave();
      }
    });
    const jobIn = async (type, need) => {
      const key = await g(`(${D}.HS.homes.find(h => ctx.homes.livedIn(h.key) && (${need})(h)) || {}).key`);
      if (!key) { t.check(`${type}: a house`, false); return null; }
      await toDoor(key);
      await g(`(${D}.VISITS.S.jobs = null, ${D}.job(${JSON.stringify(key)}, ${JSON.stringify(type)}))`);
      return (await inside()) ? key : null;
    };
    const hotAct = id => g(`(() => { const c = ctx.homes.debug.VISIT.cur; const h = c.rt.hots.find(h => h.id === ${JSON.stringify(id)}); if (!h || (h.enabled && !h.enabled(c.rt))) return false; h.action(c.rt, h); return true; })()`);
    await step("groceries", async () => {
      if (!await g(`ctx.town.active`) || !await jobIn("groceries", `h => h.cast.includes("mom")`)) return;
      for (let k = 0; k < 3; k++) { await hotAct("job_bag"); await t.frames(2); await hotAct("job_put"); await t.frames(2); }
      const j = await g(`${D}.room().job`);
      t.check("🛍️ three bags door → counter: done, +8", j && j.done && j.paid === 8, JSON.stringify(j));
      await leave();
      t.check("…a favour remembered", await g(`Object.values(${D}.S.fam).some(f => f.favours >= 1)`));
    });
    await step("glasses", async () => {
      if (!await g(`ctx.town.active`) || !await jobIn("glasses", `h => h.cast.includes("bubbe") || h.cast.includes("zeidy")`)) return;
      const ids = await g(`ctx.homes.debug.VISIT.cur.rt.hots.filter(h => /^job_look_/.test(h.id)).map(h => h.id)`);
      for (const id of ids) { if ((await g(`${D}.room().job`)).done) break; await hotAct(id); await t.frames(2); }
      const j = await g(`${D}.room().job`);
      t.check("👓 looked in up to four places: found, +5", ids.length >= 3 && j.done && j.paid === 5, JSON.stringify(j) + " " + ids.join());
      await leave();
    });
    await step("babysit", async () => {
      if (!await g(`ctx.town.active`) || !await jobIn("babysit", `h => h.cast.includes("boy") && h.cast.includes("mom")`)) return;
      t.check("🍼 the parents stepped out", await g(`!${D}.room().res.some(r => ["mom", "dad", "bubbe", "zeidy"].includes(r.kind))`));
      await g(`(ctx.homes.debug.VISIT.cur.V.job.next = 0, true)`);
      await t.frames(10);
      const kid = await g(`(() => { const V = ctx.homes.debug.VISIT.cur.V; const r = V.res.find(q => q.mischief); return r ? r.id : null; })()`);
      t.check("…a kid starts some mischief", !!kid);
      if (kid) t.check("…settle them down", await g(`(() => { const c = ctx.homes.debug.VISIT.cur; const r = c.V.res.find(q => q.id === ${JSON.stringify(kid)}); return c.V.jobUse(c.rt, r) && !r.mischief; })()`));
      await g(`(ctx.homes.debug.VISIT.cur.V.job.left = 0.05, ctx.homes.debug.VISIT.cur.V.job.chaos = 0, true)`);
      await t.frames(6);
      const j = await g(`${D}.room().job`);
      t.check("…sixty seconds later, a calm house: +15", j.done && j.paid === 15, JSON.stringify(j));
      await leave();
    });
  },
};
