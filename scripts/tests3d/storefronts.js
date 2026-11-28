// 3D smoke: features/storefronts — EVERY SHOPFRONT HAS A STATE (owner, 2026-11-27: "fill every building … I don't
// necessarily want a bunch of stores repeating themselves … this could clutter the map … done smartly"):
//  1. each town: every front has a state; no shop name shows twice; Midwood's long Avenue M front is the bowling alley's
//  2. a probe walks into EVERY open one-joke shop (the one shared room, dressed as it) and back out
//  3. the hours follow the clock: a Tuesday morning / afternoon, Thursday night's cholent, Shabbos (all shut), Motzei Shabbos
//  4. the street directory: a board per shopping street, its card lists the shops + today's hours, a tap pings one
//  5. discover by walking: a non-essential place isn't on her Map until she's walked past it — then it is, once, with a dot
const Q = "&enable=town,world,foot,discover";
module.exports = {
  name: "storefronts",
  viewport: { width: 1280, height: 720 },
  query: Q,
  async run(t) {
    const g = c => t.game(c);
    const st = () => t.L(`__lulu3d.state`);
    const step = async (name, fn) => { try { await fn(); } catch (e) { t.check(`${name}: no exception`, false, String(e && e.stack || e).slice(0, 300)); } };
    const setDate = iso => t.L(`import("./js/features/seasons/calendar.js").then(m => (m.setDate(${JSON.stringify(iso)}), true))`);
    await t.until(`__lulu3d.state === "title"`, "title", 90000);
    await g(`(L3.startRun({ mode: "cruise", quick: true }), true)`);
    await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "a run", 60000);
    const town = async id => {
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), true)`); await t.frames(10); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id} loads`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)} && __lulu3d.ctx.storefronts.fronts().length > 0`, `into ${id}`, 30000);
    };
    const onFoot = async () => {
      if (await st() !== "footRun" || !await g(`!!(ctx.foot.active && ctx.foot.debug.F)`)) {
        if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(4); }
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun" && !!__lulu3d.ctx.foot.debug.F`, "on foot", 8000);
      }
    };
    const at = (x, z) => g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${x}, 0.05, ${z}); F.phase = "walk"; return true; })()`);

    for (const id of ["midwood", "lakewood"]) {
      // ════ 1. every front has a state; no name twice ════
      await step(`${id}: states`, async () => {
        await setDate("2026-11-24T11:00");          // a Tuesday, 11 am
        if (!await town(id)) return;
        const fr = await g(`ctx.storefronts.fronts().map(f => ({ id: f.id, name: f.name, s: f.st && f.st.state, state: f.state, shop: f.st && f.st.shop, door: !!f.door, facade: f.facade, landmark: f.landmark, bowl: !!(f.st && f.st.bowling) }))`);
        const none = fr.filter(f => !f.s);
        t.check(`${id}: every one of its ${fr.length} shopfronts has a state`, fr.length > 10 && none.length === 0, JSON.stringify(none.slice(0, 4)));
        const by = {};
        for (const f of fr) if (f.shop) by[f.name] = (by[f.name] || 0) + 1;
        const twice = Object.keys(by).filter(k => by[k] > 1);
        t.check(`${id}: no shop's name shows twice (${Object.keys(by).length} shops)`, twice.length === 0, twice.join(", "));
        const count = {};
        for (const f of fr) count[f.s] = (count[f.s] || 0) + 1;
        console.log(`   STOREFRONTS ${id}`, JSON.stringify(count));
        t.check(`${id}: every front has a door + a façade point`, fr.every(f => f.door && (f.facade || f.landmark)), JSON.stringify(fr.filter(f => !f.door || !(f.facade || f.landmark)).slice(0, 3)));
        if (id === "midwood") t.check("midwood: Brooklyn Kollege's registrar has a door too (a landmark)", fr.some(f => f.landmark === "college" && f.s === "open"));
        if (id === "midwood") t.check("midwood: the long Avenue M front is kept for the bowling alley (COMING SOON: EAST MIDWOOD LANES)", fr.filter(f => f.bowl).length >= 4, String(fr.filter(f => f.bowl).length));
        const sc = await g(`ctx.town.debug.S.T.signs.scale`);
        // (Lakewood 0.590 → 0.578 as more signs went up on 2026-11-28 — the yeshiva campus, the fronts' fixes — 2 % smaller texels, no
        //  visible change; the floor guards against a big drop, it is not a budget for new places — sweep-health)
        t.check(`${id}: the town's signs stay sharp (atlas scale ${sc && sc.toFixed(3)} — before: midwood 0.531, lakewood 0.590, 0.578 on 11-28)`, sc >= (id === "midwood" ? 0.52 : 0.57));
        // FOR LEASE fronts for ci/playershops: enough, spread out (not all on one street / bunched)
        const lease = await g(`ctx.storefronts.leasable()`);
        const streets = new Set(lease.map(l => l.list)), near = lease.filter((a, i) => lease.some((b, j) => j !== i && Math.hypot(a.x - b.x, a.z - b.z) < 9)).length;
        t.check(`${id}: FOR LEASE fronts for player shops (${lease.length} on ${streets.size} street(s), ${near} right next to another)`,
          id === "midwood" ? lease.length >= 10 && streets.size >= 3 : lease.length >= 4 && lease.length <= 6, JSON.stringify(lease.map(l => l.id)));
        if (id === "midwood") {
          const cc = await g(`ctx.storefronts.reservedFor("carcare").length`), ln = await g(`ctx.storefronts.reservedFor("lanes").length`);
          t.check(`midwood: kept for ci/carcare: the 4 named Coney Island Ave shops + the Minivan Wash (${cc}) · for ci/lanes: the Avenue M run (${ln})`, cc === 5 && ln >= 4);
        } else t.check("lakewood: its Minivan Wash is kept for ci/carcare", (await g(`ctx.storefronts.reservedFor("carcare").map(f => f.name)`)).includes("MINIVAN WASH"));
        // never nothing open: on a weekday, 6 am–midnight ≥ a third of each street's shops; overnight at least one
        const cov = await t.L(`Promise.all([import("./js/features/storefronts/hours.js"), import("./js/core/ctx.js")]).then(([H, C]) => {
          const fr = C.ctx.storefronts.fronts().filter(f => f.st && f.st.shop && f.list !== "landmark"), rows = C.ctx.storefronts.debug.F.list, bad = [];
          const byList = {};
          for (const f of fr) (byList[f.list] = byList[f.list] || []).push(C.ctx.storefronts.debug.F.list.find(x => x.id === f.id));
          for (const [list, shops] of Object.entries(byList)) for (const wd of [1, 2, 3, 4]) for (let hr = 0; hr < 24; hr++) {
            const d = new Date(2026, 10, 22 + wd, hr, 30), n = shops.filter(f => H.openAt((C.ctx.storefronts.debug.row(f) || {}).hours, d, { holy: false })).length;
            const need = hr >= 6 ? Math.ceil(shops.length / 3) : 1;
            if (n < need) bad.push(list + " d" + wd + " " + hr + ":30 " + n + "/" + shops.length);
          }
          return bad; })`);
        t.check(`${id}: never nothing open — weekdays 6 am–midnight a third of each street's shops, overnight at least one`, cov.length === 0, cov.slice(0, 6).join(" · "));
        t.check(`${id}: one merged mesh for the door cards + papered windows`, await g(`(() => { const G = ctx.storefronts.debug.F.group; return !!G && G.children.length === 1 && ctx.storefronts.debug.F.look > 10; })()`));
      });

      // ════ 2. walk into every open shop (Tuesday 11 am) and back out ════
      await step(`${id}: walk-ins`, async () => {
        await setDate("2026-11-24T11:00");
        if (!await town(id)) return;
        await onFoot();
        const open = await g(`ctx.storefronts.fronts().filter(f => f.state === "open").map(f => f.id)`);
        t.check(`${id}: shops are open on a Tuesday at 11 (${open.length})`, open.length >= (id === "midwood" ? 15 : 5));
        let ok = 0, bad = [];
        for (const fid of open) {
          await onFoot();
          const d = await g(`ctx.storefronts.fronts().find(f => f.id === ${JSON.stringify(fid)}).door`);
          await at(d.x, d.z);
          await t.frames(4);
          if (!await g(`ctx.storefronts.enter(${JSON.stringify(fid)})`)) { bad.push(fid + ": enter refused"); continue; }
          if (!await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "storefront"`, `inside ${fid}`, 60000)) { bad.push(fid + ": no room"); continue; }
          await t.frames(ok === 0 ? 45 : 6);
          const r = await t.L(`({ people: __interiors.room.people.length, hots: __interiors.room.hots.length, title: __interiors.room.def.title })`);
          if (ok === 0) await t.shot(`room-${id}`);
          if (r.people < 1 || r.hots < 3) bad.push(`${fid}: ${JSON.stringify(r)}`);
          // her ONE thing (a 5-coin buy is a sink: never below 0)
          await g(`(window.__interiors.room.leave(), true)`);
          for (let i = 0; i < 20 && await st() !== "footRun"; i++) await t.tap(0);
          if (!await t.until(`__lulu3d.state === "footRun"`, `back out of ${fid}`, 30000)) { bad.push(fid + ": stuck inside"); continue; }
          const back = await g(`(() => { const p = ctx.foot.pos; return +Math.hypot(p.x - ${d.x}, p.z - ${d.z}).toFixed(1); })()`);
          if (back > 7) bad.push(`${fid}: out ${back} m from its door`); else ok++;
        }
        t.check(`${id}: walked into every open shop and back out of its door (${ok}/${open.length})`, bad.length === 0, bad.slice(0, 5).join(" · "));
      });

      // ════ 3. the hours ════
      await step(`${id}: hours`, async () => {
        if (!await town(id)) return;
        const S = async iso => { await setDate(iso); return g(`Object.fromEntries(ctx.storefronts.fronts().filter(f => f.st && f.st.shop).map(f => [f.st.shop, f.state]))`); };
        if (id === "midwood") {
          const tue11 = await S("2026-11-24T11:00"), tue13 = await S("2026-11-24T13:00"), thu20 = await S("2026-11-26T20:00"), fri20 = await S("2026-11-27T20:00"), sat2130 = await S("2026-11-28T21:30");
          t.check("Rugelach Rush: open Tuesday 11 am, SOLD OUT by 1 pm", tue11["RUGELACH RUSH"] === "open" && tue13["RUGELACH RUSH"] === "closed", `${tue11["RUGELACH RUSH"]}/${tue13["RUGELACH RUSH"]}`);
          t.check("Cholent & Chill: shut Tuesday, open Thursday night", tue11["CHOLENT & CHILL"] === "closed" && thu20["CHOLENT & CHILL"] === "open", `${tue11["CHOLENT & CHILL"]}/${thu20["CHOLENT & CHILL"]}`);
          t.check("Friday night (Shabbos): every shop is shut", Object.values(fri20).every(s => s === "closed"), JSON.stringify(Object.entries(fri20).filter(([, s]) => s !== "closed")));
          t.check("Motzei Shabbos: Sushi Shmushi is open again, the butcher isn't", sat2130["SUSHI SHMUSHI"] === "open" && sat2130["GLATT-ITUDE BUTCHER"] === "closed", `${sat2130["SUSHI SHMUSHI"]}/${sat2130["GLATT-ITUDE BUTCHER"]}`);
          // the closed door says so (✋ label + her bubble), and the walk-through door doesn't open
          await setDate("2026-11-24T13:00");
          const fid = await g(`(ctx.storefronts.fronts().find(f => f.st && f.st.shop === "RUGELACH RUSH") || {}).id`);
          const lab = await g(`ctx.storefronts.debug.label(${JSON.stringify(fid)})`);
          t.check(`a closed shop's ✋ says so + when it opens (${lab})`, /CLOSED/.test(lab) && /opens/.test(lab));
          t.check("…and walking into it does nothing (no room)", !(await g(`ctx.storefronts.enter(${JSON.stringify(fid)})`)) && await st() !== "interior");
        } else {
          const early = await S("2026-11-24T06:00"), late = await S("2026-11-24T08:00"), fri10 = await S("2026-11-27T10:00");
          t.check("Bagel Barn: open at 6 am, WE RAN OUT by 8", early["BAGEL BARN"] === "open" && late["BAGEL BARN"] === "closed", `${early["BAGEL BARN"]}/${late["BAGEL BARN"]}`);
          t.check("Kugel Korner: Fridays only", fri10["KUGEL KORNER"] === "open" && late["KUGEL KORNER"] === "closed", `${fri10["KUGEL KORNER"]}/${late["KUGEL KORNER"]}`);
        }
        await setDate("2026-11-24T11:00");
      });

      // ════ 4. the street directory ════
      await step(`${id}: directory`, async () => {
        if (!await town(id)) return;
        await onFoot();
        const boards = await g(`ctx.storefronts.debug.F.boards.map(b => ({ list: b.list, name: b.name, x: b.x + b.nx * 0.8, z: b.z + b.nz * 0.8 }))`);
        t.check(`${id}: a street directory board on each shopping street (${boards.map(b => b.name).join(", ")})`, boards.length >= (id === "midwood" ? 4 : 1));
        if (!boards.length) return;
        const b = boards[0];
        await at(b.x, b.z); await t.frames(8);
        t.check(`✋ at the ${b.name} board`, /DIRECTORY/.test(await g(`ctx.storefronts.debug.F && (ctx.storefronts.debug.nearBoard() ? "DIRECTORY" : "")`)));
        await g(`ctx.storefronts.debug.openDirectory(ctx.storefronts.debug.nearBoard())`);
        await t.frames(6);
        const card = await t.L(`(document.querySelector("#screenCard") || {}).textContent || ""`);
        t.check(`the ${b.name} directory lists its shops + today's hours`, /street directory/i.test(card) && /am|pm|closed/.test(card), card.slice(0, 120));
        await t.shot(`directory-${id}`);
        // (the LAST shop on the street: the first is right beside the board — a ping there is "arrived" at once)
        await t.L(`window.__pinged = []; import("./js/core/ctx.js").then(m => m.on("pins:ping", e => __pinged.push(e.id)))`);
        const first = await t.L(`(() => { const o = [...document.querySelectorAll("#screenCard .dp-opt")].pop(); return o ? o.dataset.opt : ""; })()`);
        await t.L(`(() => { const o = [...document.querySelectorAll("#screenCard .dp-opt")].pop(); if (o) o.click(); return true; })()`);
        await t.frames(6);
        t.check(`a tap pings the shop (${first})`, !!first && (await t.L(`__pinged`)).includes("shop:" + first), JSON.stringify(await t.L(`__pinged`)));
        t.check("…its pin isn't listed on the Map (one-joke shops never get a pin)", await g(`!ctx.pins.list().some(p => p.id === ${JSON.stringify("shop:" + first)})`));
        await g(`(ctx.pins.clear(), true)`);
        for (let i = 0; i < 6 && await t.L(`!!document.querySelector("#screenCard .sp")`); i++) { await t.tap(1); await t.frames(3); }
      });
    }

    // ════ 5. discover by walking ════
    await step("discovery", async () => {
      if (!await town("midwood")) return;
      await onFoot();
      const P = "midwood:bakery";
      await g(`(() => { const S = ctx.pins.debug.PS; delete (S.found || {})[${JSON.stringify(P)}]; delete (S.fresh || {})[${JSON.stringify(P)}]; return true; })()`);
      t.check("the bakery isn't on her Map before she's been near it", await g(`!ctx.pins.shown(ctx.pins.get(${JSON.stringify(P)}))`));
      t.check("…but the precinct is (an essential)", await g(`ctx.pins.shown(ctx.pins.get("midwood:precinct"))`));
      const tg = await g(`ctx.pins.target(${JSON.stringify(P)})`);
      await t.L(`window.__found = []; import("./js/core/ctx.js").then(m => m.on("pins:found", e => __found.push(e.id)))`);
      await at(tg.x, tg.z); await t.frames(60);
      t.check("walking past it puts it on her Map, with a new dot", await g(`ctx.pins.shown(ctx.pins.get(${JSON.stringify(P)})) && ctx.pins.isFresh(${JSON.stringify(P)})`));
      await t.frames(60);
      t.check("…found once (one event)", (await t.L(`__found.filter(x => x === ${JSON.stringify(P)}).length`)) === 1, JSON.stringify(await t.L(`__found`)));
    });
    await setDate(null);
  },
};
