// 👨‍👩‍👧 Family (features/family, roadmap 32):
//   Stage B — Fayge, Ash + Chani: her day (the playgroup in the morning, errands, Ima's, home for supper / bedtime /
//     the night, Friday cooking, Shabbos at Ima's) at fixed places; her basement door (✋, real estate never lists it,
//     nobody home → the note); a visit (she knocks, Fayge answers, in as family: Fayge + Ash + Chani at supper); the two
//     tiny jobs (🎵 circle time, 🛍️ her bags home) pay once a real day inside homes' caps.
//   Stage A — Shloime + Toby (couple.js): the first three beats (the pizza table, the makolet aisle, the lake + a
//     cover-for-them choice when Raizy walks by), one beat a real day, nothing pays.
module.exports = {
  name: "family",
  viewport: { width: 1280, height: 720 },
  query: `&enable=homes,town,law,foot,atmos,interiors,seasons,memory,family,realestate,cameos`,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const g = t.game, D = `ctx.family.debug`;
    const step = async (label, fn) => { if (process.env.FAMILY_STEP && !label.includes(process.env.FAMILY_STEP)) return; try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    // (a dialog ignores taps for a moment after it opens: wait, click, and again until it's taken)
    const choose = async re => { for (let k = 0; k < 14; k++) { await t.frames(6); if (!await g(`ctx.dialogOpen`)) return false; await t.click(re); await t.frames(4); if (!await t.L(`[...document.querySelectorAll("#dialog button")].some(b => ${re}.test(b.textContent))`)) return true; } return false; };
    const talkThrough = async (max = 30) => { for (let k = 0; k < max; k++) { await t.frames(8); if (!await g(`ctx.dialogOpen`)) return; if (await t.L(`document.querySelectorAll("#dialog button").length > 0`)) return; await t.tap(0); } };
    const inTown = async town => {
      if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
      await g(`ctx.town.load("${town}")`);
      await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town} models`, 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
      if (!await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "${town}"`, `in ${town}`, 60000)) return false;
      await g(`ctx.foot.start("droveOff", { noIntro: true })`);
      return t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000);
    };
    const stand = (x, z, fx, fz) => g(`(() => { if (window.__qa) { window.__qa.cutF = ctx.frames + 4; window.__qa.last = null; } const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.obj.position.copy(f); const yaw = Math.atan2(${fx} - ${x}, ${fz} - ${z}); ctx.foot.obj.rotation.y = yaw; if (ctx.cam && ctx.cam.free) ctx.cam.free.yaw = yaw; if (ctx.cam && ctx.cam.snap) ctx.cam.snap(); return true; })()`);
    const day = (wd, hour, season = "none") => g(`(ctx.seasons.debug.season(${JSON.stringify(season)}, 1, { wd: ${wd}, eve: false }), ctx.homes.debug.hour(${hour}), true)`);
    const coins = () => g(`ctx.homes.jobs().coins`);

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.freeze(true), true)`);
    if (!await inTown("midwood")) return;
    const H = await g(`${D}.home()`);
    t.check("Fayge's household is a door homes knows (her own id, Fayge + Ash + Chani)", !!H && await g(`(() => { const h = ctx.homes.household("midwood:fayge"); return !!h && h.status === null && h.names.mom === "Fayge" && h.names.dad === "Ash" && h.names.baby === "Chani"; })()`));

    await step("her day", async () => {
      // a Tuesday: 7:30 home · 9 + 12 the playgroup · 14 an errand · 17 Ima's · 19 supper · 21 bedtime · 3 the night
      const want = [[7.6, "home", "faygeMorning"], [9, "playgroup"], [12.5, "playgroup"], [14, /^(makolet|bakery|clothes)$/], [17, "ima"], [19, "home", "faygeSupper"], [21, "home", "faygeBedtime"], [3, "home", "faygeNight"]];
      for (const [h, where, scene] of want) {
        await day(2, h); await t.frames(4);
        const w = await g(`ctx.family.where()`);
        const ok = (where instanceof RegExp ? where.test(w.where) : w.where === where) && (!scene || w.scene === scene);
        t.check(`Tuesday ${h}:00 → Fayge is ${w.where}${scene ? " (" + w.scene + ")" : ""}`, ok, JSON.stringify(w));
        if (w.where !== "home") {
          // drawn at that place (she moves on while Lulu isn't standing right next to her)
          const p = await g(`${D}.placeOf(${JSON.stringify(w.where)})`);
          await stand(p.x + p.nx * 9, p.z + p.nz * 9, p.x, p.z);
          await t.frames(12);
          const f = await g(`ctx.family.fayge`);
          t.check(`…and she's there (${w.where})`, !!f && f.where === w.where && Math.hypot(f.x - p.x, f.z - p.z) < 1.5, JSON.stringify({ f, p }));
        }
      }
      await day(5, 14); t.check("Friday 2 p.m.: cooking for Ima's table", (await g(`ctx.family.where()`)).scene === "faygeFriday");
      await day(6, 11, "shabbos"); t.check("Shabbos morning: at Ima's", (await g(`ctx.family.where()`)).where === "away");
      await day(6, 15, "shabbos"); t.check("Shabbos afternoon: a walk past Ima's", (await g(`ctx.family.where()`)).where === "walk");
    });

    await step("the basement door", async () => {
      t.check("real estate never lists her house (the landlords' or hers)", await g(`(() => { const R = ctx.realestate.homes(); const near = R.filter(r => ctx.family.isFamily(r.door.x, r.door.z)); return near.length >= 1 && near.every(r => r.family) && !ctx.realestate.listings().some(r => ctx.family.isFamily(r.door.x, r.door.z)); })()`));
      await day(2, 10);              // (she's at the playgroup: nobody home)
      await stand(H.ap.x, H.ap.z, H.door.x, H.door.z); await t.frames(6);
      t.check("✋ at her side door", /FAYGE/.test(await g(`ctx.homes.debug.label()`) || ""), await g(`ctx.homes.debug.label()`));
      await g(`ctx.homes.debug.door("midwood:fayge")`);
      if (!await t.until(`__lulu3d.ctx.dialogOpen`, "her door menu", 10000)) return;
      await choose(/Knock/);
      t.check("nobody home at 10 a.m. → the note on the door (the playgroup)", await t.until(`/AT PLAYGROUP/.test((document.getElementById("dialog") || {}).textContent || "") && __lulu3d.ctx.dialogOpen && !document.querySelectorAll("#dialog button").length`, "the note", 15000));
      await talkThrough();
      await t.until(`!__lulu3d.ctx.dialogOpen`, "note closed", 10000);
      await t.frames(20);
      // a visit: Tuesday 7 p.m. — Fayge answers, she walks in, supper with Ash + Chani
      await day(2, 19); await t.frames(4);
      await stand(H.ap.x, H.ap.z, H.door.x, H.door.z); await t.frames(4);
      const c0 = await coins();
      await g(`ctx.homes.debug.door("midwood:fayge")`);
      if (!await t.until(`__lulu3d.ctx.dialogOpen`, "her door menu", 10000)) return;
      await choose(/Knock/);
      t.check("Fayge answers the door", await t.until(`/Fayge/.test((document.getElementById("dialog") || {}).textContent || "") && !document.querySelectorAll("#dialog button").length`, "Fayge answers", 15000));
      await talkThrough();
      if (!await t.until(`__lulu3d.state === "interior" && __lulu3d.ctx.homes.debug.VISIT.cur && __lulu3d.ctx.homes.debug.VISIT.cur.rt.ready`, "inside Fayge's", 60000)) return;
      await t.frames(30);
      const r = await g(`(() => { const V = ctx.homes.debug.VISIT.cur.V; return { mode: V.mode, scene: V.scene.def.id, who: V.res.map(q => q.name).sort().join(","), title: ctx.homes.debug.DEF.title }; })()`);
      t.check("in as family (a guest): supper with Fayge, Ash + Chani", r.mode === "guest" && r.scene === "faygeSupper" && r.who === "Ash,Chani,Fayge", JSON.stringify(r));
      await t.shot("supper");
      // talk to each: Fayge's opinions, Ash's four words, Chani's vocabulary
      t.check("a visit costs nothing and pays nothing", (await coins()) === c0);
      await g(`(() => { const c = ctx.homes.debug.VISIT.cur; c.V.exit = "door"; c.rt.leave(); return true; })()`);
      await t.until(`__lulu3d.state === "footRun"`, "back outside", 60000);
      t.check("back out at the top of her steps", await g(`(() => { const f = ctx.foot.pos; return Math.hypot(f.x - ${H.ap.x}, f.z - ${H.ap.z}) < 3; })()`));
    });

    await step("tiny jobs", async () => {
      await day(2, 9.5); await g(`(${D}.force.where = "playgroup", true)`); await t.frames(4);
      const p = await g(`${D}.placeOf("playgroup")`);
      await stand(p.x + p.nx * 1.6, p.z + p.nz * 1.6, p.x, p.z); await t.frames(10);
      const c0 = await coins();
      await g(`(${D}.talk(), true)`);
      if (!await t.until(`__lulu3d.ctx.dialogOpen`, "Fayge talks", 10000)) return;
      await talkThrough();
      await choose(/circle time/i);
      await talkThrough();
      await choose(/Wheels on the Bus/);
      await talkThrough(40);
      await t.until(`!__lulu3d.ctx.dialogOpen`, "circle done", 15000);
      const c1 = await coins();
      t.check("🎵 circle time pays 5 (homes' ledger)", c1 - c0 === 5 && await g(`ctx.homes.jobs().n.circle === 1`), `${c0} → ${c1}`);
      await t.frames(20);
      await g(`(${D}.talk(), true)`);
      await t.until(`__lulu3d.ctx.dialogOpen`, "Fayge talks again", 10000);
      await talkThrough();
      await choose(/circle time/i);
      await talkThrough(); await t.until(`!__lulu3d.ctx.dialogOpen`, "closed", 15000);
      t.check("…once a real day (again: a thank-you, no coins)", (await coins()) === c1);
      // 🛍️ her bags: at the makolet → her door
      await day(2, 14); await g(`(${D}.force.where = "makolet", true)`); await t.frames(6);
      const q = await g(`${D}.placeOf("makolet")`);
      await stand(q.x + q.nx * 1.5, q.z + q.nz * 1.5, q.x, q.z); await t.frames(10);
      await g(`(${D}.talk(), true)`);
      await t.until(`__lulu3d.ctx.dialogOpen`, "Fayge at the makolet", 10000);
      await talkThrough();
      await choose(/bags/i);
      await talkThrough(); await t.until(`!__lulu3d.ctx.dialogOpen`, "closed", 15000);
      t.check("🛍️ her bags: a delivery to her door", await g(`!!ctx.homes.delivery && ctx.homes.delivery.to === "midwood:fayge"`));
      await stand(H.ap.x, H.ap.z, H.door.x, H.door.z); await t.frames(6);
      t.check("…her door says so", /BAGS/.test(await g(`ctx.homes.debug.label()`) || ""));
      await g(`ctx.homes.debug.door("midwood:fayge")`);
      await t.until(`__lulu3d.ctx.dialogOpen`, "door menu", 10000);
      await choose(/Drop off/);
      await talkThrough();
      for (let k = 0; k < 10 && await g(`ctx.dialogOpen`); k++) { if (await t.L(`[...document.querySelectorAll("#dialog button")].some(b => /Leave/.test(b.textContent))`)) { await choose(/Leave/); break; } await talkThrough(); }
      await t.until(`!__lulu3d.ctx.dialogOpen`, "closed", 15000);
      const c2 = await coins();
      t.check("…dropped off: +6 (and no more delivery)", c2 - c1 === 6 && !(await g(`ctx.homes.delivery`)), `${c1} → ${c2}`);
      t.check("never past homes' day cap", await g(`ctx.homes.jobs().coins <= ctx.homes.jobs().cap`));
      await g(`(${D}.force.where = null, true)`);
    });

    await step("Shloime + Toby", async () => {
      const K = `${D}.couple`;
      if (!await g(`!!(ctx.family.debug.couple)`)) { t.check("couple.js wired", false); return; }
      await g(`(${K}.reset(), true)`);
      const g0 = await g(`ctx.G.coins`), j0 = await coins();
      const meet = async (town, wd, hour, id) => {
        if (!await inTown(town)) return false;
        await day(wd, hour); await t.frames(8);
        if (!await t.until(`__lulu3d.ctx.family.debug.couple.beat() === "${id}"`, `the ${id} beat is out`, 20000)) return false;
        const p = await g(`${K}.at()`), o = await g(`${K}.who()`);
        await stand(o.x + p.nx * 1.6, o.z + p.nz * 1.6, o.x, o.z); await t.frames(4);
        t.check(`${id}: ✋ over them`, !!(await g(`${K}.spot()`)), JSON.stringify({ label: await g(`${K}.label()`), who: await g(`${K}.who()`), me: await g(`({ x: ctx.foot.pos.x, z: ctx.foot.pos.z })`) }));
        await g(`(${K}.play(), true)`);
        return t.until(`__lulu3d.ctx.dialogOpen`, `${id} starts`, 10000);
      };
      // 1 · the pizza table (Midwood): sworn to secrecy
      if (await meet("midwood", 2, 14, "pizza")) {
        await talkThrough(); await choose(/swear/i); await talkThrough(); await t.until(`!__lulu3d.ctx.dialogOpen`, "beat 1 over", 20000); await t.frames(10);
        t.check("beat 1 (the pizza table): done + saved", await g(`${K}.C.n === 1 && !!${K}.C.day`));
      }
      // one a real day: the next beat isn't out today
      await inTown("lakewood"); await day(2, 14); await t.frames(10);
      t.check("one beat a real day: nothing more today", await g(`${K}.now() === null && ${K}.beat() === null`));
      // 2 · the makolet aisle (Lakewood): play along
      await g(`(${K}.nextDay(), true)`);
      if (await meet("lakewood", 3, 14, "makolet")) {
        await talkThrough(); await choose(/Play along/); await talkThrough(); await t.until(`!__lulu3d.ctx.dialogOpen`, "beat 2 over", 20000); await t.frames(10);
        t.check("beat 2 (the makolet aisle): done", await g(`${K}.C.n === 2 && ${K}.C.picks[1] === 0`));
      }
      // 3 · the lake — Raizy walks by: cover for them
      await g(`(${K}.nextDay(), true)`);
      if (await meet("lakewood", 4, 16, "lake")) {
        for (let k = 0; k < 60 && !await t.L(`[...document.querySelectorAll("#dialog button")].some(b => /LAWYER/.test(b.textContent))`); k++) { await t.frames(10); if (await g(`ctx.dialogOpen`) && !await t.L(`document.querySelectorAll("#dialog button").length`)) await t.tap(0); }
        t.check("…Raizy walks up (the near miss)", await g(`${K}.extra() === "raizy"`));
        await choose(/LAWYER/); await talkThrough(); await t.until(`!__lulu3d.ctx.dialogOpen`, "beat 3 over", 20000); await t.frames(10);
        t.check("beat 3 (the lake): Lulu covered for them (\"he's my LAWYER\")", await g(`${K}.C.n === 3 && ${K}.C.cover[2] === 1`), await g(`JSON.stringify(${K}.C)`));
      }
      t.check("story only: no coins from the couple", (await g(`ctx.G.coins`)) === g0 && (await coins()) === j0);
    });
    await step("Avigail", async () => {
      // Stage C: no random Avigail; her house (a fixed door, real estate never lists it); the porch visit at her door; the
      // hall's wedding with the bouquet paid once a real day; no Avigail toast / banner
      const V = `${D}.avigail`;
      if (!await inTown("midwood")) return;
      t.check("no roadside Avigail walker on the cameos timer", await g(`!ctx.actors.some(a => a.kind === "avigailWalker")`));
      const av = await g(`ctx.family.avigail()`);
      t.check("her house: a fixed door in Midwood", !!av.door, JSON.stringify(av));
      t.check("real estate never lists it, homes gave the door up", await g(`(() => { const a = ctx.family.avigail().door; const h = ctx.homes.householdAt(a.x, a.z, 4); return (!h || h.status === "avigail") && !ctx.realestate.listings().some(r => Math.hypot(r.ap.x - a.x, r.ap.z - a.z) < 4); })()`));
      // not home (Tuesday 11 a.m.: the nail salon) → the note
      await day(2, 11); await t.frames(4);
      t.check("Tuesday 11 a.m.: at the nail salon", (await g(`ctx.family.avigail()`)).where === "salon");
      await stand(av.door.x, av.door.z, av.door.x - 1, av.door.z); await t.frames(6);
      await g(`(${V}.porch(), true)`);
      await talkThrough();
      t.check("…the note on her door says so", await t.until(`/NAIL SALON/.test((document.getElementById("dialog") || {}).textContent || "")`, "the note", 15000));
      await talkThrough(); await t.until(`!__lulu3d.ctx.dialogOpen`, "note closed", 15000); await t.frames(10);
      // home (Tuesday 3 p.m.): the porch visit on her porch → she's coming along (once a run)
      await day(2, 15); await t.frames(4);
      const rel0 = await g(`ctx.avigail.rel()`);
      await g(`(${V}.porch(), true)`);
      for (let k = 0; k < 80 && (await g(`ctx.dialogOpen || ctx.family.debug.avigail.A.busy`)); k++) {
        if (await t.L(`document.querySelectorAll("#dialog button").length > 0`)) { await t.L(`document.querySelectorAll("#dialog button")[0].click()`); await t.frames(8); }
        else { await t.tap(0); await t.frames(8); }
      }
      t.check("the porch visit at her door: she'll ride shotgun (pending)", (await g(`ctx.family.avigail()`)).pending === true);
      t.check("…the meter thawed (quietly)", (await g(`ctx.avigail.rel()`)) > rel0);
      // back in her car → Avigail rides shotgun (2×), once a run
      if (await g(`ctx.foot.debug.getIn()`)) {
        await t.until(`__lulu3d.state === "playing"`, "back in the car", 30000);
        t.check("…in the car: Avigail rides shotgun (2× points)", await t.until(`!!__lulu3d.ctx.G.avigailRide`, "the ride", 15000));
        t.check("…once a run", (await g(`ctx.family.avigail()`)).rode === true);
        await g(`ctx.foot.start("droveOff", { noIntro: true })`);
        await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot again", 20000);
      } else t.check("her car to get back in", false);
      // the hall: a wedding on a Tuesday evening — the bouquet pays once a real day
      await day(2, 19); await t.frames(10);
      t.check("the hall's marquee: TONIGHT — Avigail & Aviel", (await g(`ctx.family.avigail()`)).hall === "wedding");
      const c0 = await g(`ctx.G.coins`);
      const wed = async () => {
        await g(`(${V}.hall(), true)`);
        if (!await t.until(`__lulu3d.state === "footWedding"`, "the wedding in the hall", 30000)) return false;
        await t.frames(60); await t.shot("hall");
        await g(`(() => { for (let i = 0; i < 6; i++) ; return true; })()`);
        for (let k = 0; k < 400 && await g(`ctx.state === "footWedding"`); k++) { await t.tap(0); await t.frames(6); }
        return t.until(`__lulu3d.state === "footRun"`, "back outside the hall", 60000);
      };
      if (await wed()) {
        const c1 = await g(`ctx.G.coins`);
        t.check("the bouquet pays (first wedding today)", c1 - c0 >= 15, `${c0} → ${c1}`);
        await t.frames(30);
        if (await wed()) t.check("…a second wedding the same real day: the dancing only, no coins", (await g(`ctx.G.coins`)) === c1);
      }
      t.check("no Avigail toast or banner", !(await t.L(`[...document.querySelectorAll(".toast, .banner, #toasts *, #banner")].some(e => /Avigail|AVIGAIL/.test(e.textContent || ""))`)));
    });
  },
};
