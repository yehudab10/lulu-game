// 🏛️ City hall stages 3–5 (features/cityhall permits.js / inspect.js / protest.js / story.js): a tenant → a permit note →
// the errand (form at PERMITS → stamp at TAXES or COMPLAINTS → granted) — never blocking; the inspector at her home (crime's
// Pinchas; Pnina once I.A. reassigned him; nervous = nothing) — write-up = a fee on the ledger, a donation = 3 coins, never
// below 0; a protest in protest hours (instanced, a handful of draw calls), the rhythm chant, honk → cheer, her honking = the
// topic; the corruption thread: the board → the crew → the photo → the paper / I.A. / hush — once per town, ≤ 15 a real day,
// the sting arrests her.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "cityhall3",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cityhall,realestate,phone,community,places,crime",
  save2d: { totalCoins: 30000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const PART = (process.env.CITYHALL_PART || "").split(",").filter(Boolean);
    const step = async (label, fn) => { if (PART.length && !PART.includes(label)) return; try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const setCoins = n => t.L(`import("./js/core/save.js").then(m => { const c = m.wallet.coins; if (c > ${n}) m.wallet.spend(c - ${n}); else m.wallet.add(${n} - c); return m.wallet.coins; })`);
    const CH = `ctx.cityhall`;
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async id => {
      await playing();
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
    };
    const onFoot = async () => { if (await st() !== "footRun") { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000); } };
    const footAt = async (x, z) => { await onFoot(); await g(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f); if (window.__qa) { window.__qa.cutF = ctx.frames + 6; window.__qa.last = null; } return true; })()`); await t.frames(4); };
    const promptText = () => t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);
    const press = async (doneCode, n = 6) => { for (let i = 0; i < n && !await g(doneCode); i++) { await t.tap(0); await t.frames(3); } return g(doneCode); };
    const tapThrough = async n => { for (let i = 0; i < n; i++) await t.tap(0); };
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    /** Answer the open dialogue: the option matching re (else tap through lines) until \`done\` (page code) is true. */
    async function answer(re, done = null, max = 200) {
      for (let i = 0; i < max; i++) {
        if (done && await g(done)) return true;
        const o = await opts();
        if (o.length) {
          const idx = typeof re === "number" ? re : o.findIndex(x => re.test(x));
          await t.L(`(b => b && b.click())([...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[${Math.max(0, idx)}])`);
          await t.frames(3);
          if (!done) return true;
          continue;
        }
        if (!await g(`ctx.dialogOpen`) && !done) return false;
        await t.tap(0);
      }
      return false;
    }
    /** Tap through spoken lines until no dialogue is open (≤ n taps). */
    const drain = async (n = 12) => { for (let i = 0; i < n && await g(`ctx.dialogOpen`); i++) { if ((await opts()).length) return; await t.tap(0); await t.frames(2); } };
    const inside = () => t.until(`__lulu3d.state === "interior" && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "cityhall"`, "inside city hall", 60000);
    const useHot = async id => { await g(`(() => { const r = __interiors.room, h = r.hots.find(h => h.id === ${JSON.stringify(id)}); if (!h) return false; r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`); };
    const ledgerFees = () => g(`${CH}.tax.ledger.bills.filter(b => b.kind === "fee" && !b.paid).map(b => b.fee)`);
    const perf = async frames => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); }; } window.__pf = { n: 0, maxCalls: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return P.maxCalls; })()`);
    };

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ${CH}.debug.RB.next = 1e9, ${CH}.debug.force.protest = false, true)`);
    await W.install(t);
    if (!await town("lakewood")) return;
    let home = null;

    // ════ permits ════
    await step("permits", async () => {
      home = await g(`(() => { const R = ctx.realestate; for (const r of R.listings()) if (R.debug.buyNow(r.id)) return r.id; return null; })()`);
      if (!t.check(`she owns a home (${home})`, !!home)) return;
      await g(`(${CH}.permits.PM.open.length = 0, ${CH}.permits.PM.granted.length = 0, true)`);
      await g(`ctx.realestate.findTenant(${JSON.stringify(home)})`);
      t.check("a tenant → a permit is asked for (never blocked: the tenant's in)", await g(`${CH}.permits.open().some(p => p.kind === "tenant" && p.home === ${JSON.stringify(home)}) && !!ctx.realestate.tenant(${JSON.stringify(home)})`));
      t.check("…a quiet note in 📱 Messages › City Hall", await g(`ctx.phone.inbox.msgs.some(m => m.title === "City Hall" && /permit/i.test(m.msg))`));
      t.check("…Permits is never the 'back in 5 minutes' window while a form waits", await g(`(() => { const f = ${CH}.debug.force; f.closed = null; f.hour = 9; const c = ${CH}.closedWindow(); f.hour = null; return c !== 0; })()`));
      // the errand
      await g(`(${CH}.debug.force.closed = 2, true)`);
      await footAt(...Object.values(await g(`(() => { const sp = ${CH}.spot(); return { x: sp.x + sp.nx, z: sp.z + sp.nz }; })()`)));
      await g(`${CH}.enter()`);
      if (!await inside()) return;
      t.check("the Permits window says a form is waiting", /form/i.test(await g(`(() => { const h = __interiors.room.hots.find(h => h.id === "win_permits"); return h.label(); })()`)));
      await useHot("win_permits");
      await answer(0); await answer(1); await drain(); await t.frames(10);
      t.check("step 1: the form filled in (two questions)", await g(`${CH}.permits.PM.open.some(p => p.step === 1)`));
      t.check(`…the stamp is at ${await g(`${CH}.permits.stampWindow()`)} — its window says so`, /stamp/i.test(await g(`(() => { const h = __interiors.room.hots.find(h => h.id === "win_" + ${CH}.permits.stampWindow()); return h.label(); })()`)));
      await useHot("win_" + await g(`${CH}.permits.stampWindow()`));
      await drain(); await t.frames(10);
      t.check("step 2: stamped", await g(`${CH}.permits.PM.open.some(p => p.step === 2)`));
      const c0 = await coins();
      await useHot("win_permits"); await drain(); await t.frames(10);
      t.check("step 3: PERMIT GRANTED", await g(`${CH}.permits.has(${JSON.stringify(home)}) && !${CH}.permits.open().length`));
      t.check(`…and it's free (coins ${c0} → ${await coins()})`, await coins() === c0);
      // the stamp moves to Complaints when Taxes is out
      await g(`(${CH}.debug.force.closed = 1, true)`);
      t.check("Taxes out → the stamp is at Complaints", await g(`${CH}.permits.stampWindow() === "complaints"`));
      await g(`(${CH}.debug.force.closed = null, __interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000);
      // a decor change outside her family house asks for a permit too (only a real purchase)
      await g(`(L3.emit("decor:place", { slot: "porch", opt: "x", bought: true }), true)`);
      t.check("a new porch → a porch permit", await g(`${CH}.permits.open().some(p => p.kind === "porch")`));
      await g(`(L3.emit("decor:place", { slot: "porch", opt: "x", bought: false }), L3.emit("decor:place", { slot: "bed", opt: "x", bought: true }), true)`);
      t.check("…moving things round / inside changes need nothing", await g(`${CH}.permits.open().length === 1`));
    });

    // ════ the inspector ════
    const ensureHome = async () => { if (!home) home = await g(`(() => { const R = ctx.realestate; const mine = R.owned().find(h => h.town === ctx.town.id); if (mine) return mine.id; for (const r of R.listings()) if (R.debug.buyNow(r.id)) return r.id; return null; })()`); return home; };
    await step("inspector", async () => {
      if (!await ensureHome()) return;
      // (a permit granted for it: the errand's own test is the "permits" part)
      await g(`(${CH}.permits.PM.granted.some(x => x.home === ${JSON.stringify(home)}) || ${CH}.permits.PM.granted.push({ kind: "tenant", home: ${JSON.stringify(home)}, at: Date.now() }), true)`);
      const h = await g(`${CH}.inspect.homesHere().find(h => h.id === ${JSON.stringify(home)})`);
      if (!t.check("her home's door is found in the town", !!h)) return;
      await g(`(${CH}.inspect.IN.force.day = "insp-1", ${CH}.inspect.IN.force.always = true, ${CH}.inspect.IN.force.mood = "", ${CH}.fees.FE.force.day = "insp-1", true)`);
      await footAt(h.x + 12, h.z + 12);
      await footAt(h.x + 6, h.z + 4);
      await t.until(`!!__lulu3d.ctx.cityhall.inspect.IN.cur`, "walking up to her home: the inspector is there", 8000);
      await t.until(`__lulu3d.ctx.cityhall.inspect.IN.cur && __lulu3d.ctx.cityhall.inspect.IN.cur.p`, "…as a person", 15000);
      const ip = await g(`(() => { const c = ${CH}.inspect.IN.cur; return { who: c.who, x: c.x, z: c.z }; })()`);
      t.check(`…it's Inspector Pinchas (${ip.who})`, ip.who === "pinchas");
      await footAt(ip.x + 0.8, ip.z + 0.8);
      await t.shot("cityhall3-inspector");
      t.check(`✋ offers the inspector (${(await promptText()).slice(0, 50)})`, /INSPECTOR/i.test(await promptText()));
      // show the permit (granted above) → he leaves; nothing charged
      const f0 = (await ledgerFees()).length;
      if (!await press(`ctx.dialogOpen`)) return;
      await answer(0); await drain(); await t.frames(10);
      t.check("📄 the permit → he leaves, disappointed, no fee", await g(`${CH}.inspect.IN.log.some(l => l.ev === "done" && l.how === "permit")`) && (await ledgerFees()).length === f0);
      // the next real day: write it up → a fee; a donation → 3 coins; Pnina won't take one; nervous → nothing
      for (const [mood, opt, want] of [["", 1, "written"], ["", 2, "donation"], ["gone", 2, "written"], ["nervous", 0, "nervous"]]) {
        await g(`(${CH}.inspect.end(), ${CH}.inspect.IN.force.day = "insp-${mood}-${opt}", ${CH}.inspect.IN.force.mood = ${JSON.stringify(mood)}, ${CH}.fees.FE.force.day = "insp-${mood}-${opt}", true)`);
        await footAt(h.x + 12, h.z + 12); await footAt(h.x + 6, h.z + 4);
        if (!await t.until(`__lulu3d.ctx.cityhall.inspect.IN.cur && __lulu3d.ctx.cityhall.inspect.IN.cur.p`, `inspector (${mood || "normal"})`, 15000)) continue;
        const who = await g(`${CH}.inspect.IN.cur.who`);
        const pp = await g(`(() => { const c = ${CH}.inspect.IN.cur; return { x: c.x, z: c.z }; })()`);
        await footAt(pp.x + 0.8, pp.z + 0.8);
        const c0 = await coins(), fees0 = (await ledgerFees()).filter(f => f === "inspection").length;
        if (!await press(`ctx.dialogOpen`)) continue;
        if (mood !== "nervous") { await answer(opt); }
        await drain(); await t.frames(10);
        const how = await g(`(${CH}.inspect.IN.log.filter(l => l.ev === "done").pop() || {}).how`);
        const fees1 = (await ledgerFees()).filter(f => f === "inspection").length, c1 = await coins();
        t.check(`${mood || "normal"} (${who}) · option ${opt} → ${how} (want ${want}); coins ${c0} → ${c1}; finding fees ${fees0} → ${fees1}`,
          how === want && (want === "donation" ? c0 - c1 === 3 && fees1 === fees0 : want === "written" ? fees1 === fees0 + 1 && c1 === c0 : c1 === c0 && fees1 === fees0));
        if (mood === "gone") t.check("…I.A. reassigned Pinchas → it's Inspector Pnina", who === "pnina");
      }
      // once a real day
      await g(`(${CH}.inspect.end(), true)`);
      await footAt(h.x + 12, h.z + 12); await footAt(h.x + 6, h.z + 4); await t.frames(30);
      t.check("…once a real day (no second visit the same day)", await g(`!${CH}.inspect.IN.cur`));
      // a donation with no coins: refused, a finding instead; never below 0
      await setCoins(1);
      await g(`(${CH}.inspect.IN.force.day = "insp-broke", ${CH}.inspect.IN.force.mood = "", ${CH}.fees.FE.force.day = "insp-broke", true)`);
      await footAt(h.x + 12, h.z + 12); await footAt(h.x + 6, h.z + 4);
      if (await t.until(`__lulu3d.ctx.cityhall.inspect.IN.cur && __lulu3d.ctx.cityhall.inspect.IN.cur.p`, "inspector (broke)", 15000)) {
        const pp = await g(`(() => { const c = ${CH}.inspect.IN.cur; return { x: c.x, z: c.z }; })()`);
        await footAt(pp.x + 0.8, pp.z + 0.8);
        if (await press(`ctx.dialogOpen`)) { await answer(2); await drain(); await t.frames(10); }
        t.check(`a "donation" with 1 coin → refused, never below 0 (coins ${await coins()})`, await coins() === 1);
      }
      await setCoins(30000);
      await g(`(${CH}.inspect.end(), ${CH}.inspect.IN.force.always = false, true)`);
      // the shops: once a run
      await g(`(${CH}.inspect.IN.shopN = 0, ${CH}.inspect.IN.shopNext = 0, true)`);
      const pz = await g(`(() => { const sp = ctx.town.spot("pizza"); return sp ? { x: sp.x + sp.nx * 20, z: sp.z + sp.nz * 20 } : null; })()`);
      if (pz) { await footAt(pz.x, pz.z); await t.frames(20); t.check("walking past the pizza shop: the inspector is inspecting it", await t.until(`!!__lulu3d.ctx.cityhall.inspect.IN.shop`, "shop inspection", 6000)); }
    });

    // ════ protests ════
    await step("protest", async () => {
      await playing();
      if (!await town("midwood")) return;
      for (const topic of ["eruv", "sauce", "parking", "kugel", "strollers", "honk"]) {
        await g(`(${CH}.debug.force.protest = true, ${CH}.debug.force.topic = ${JSON.stringify(topic)}, ${CH}.protest.stop(), true)`);
        await t.frames(4);
        if (!await t.until(`__lulu3d.ctx.cityhall.protest.PR.on && __lulu3d.ctx.cityhall.protest.PR.on.ready`, `the ${topic} protest`, 15000)) continue;
        const P = await g(`(() => { const W = ${CH}.protest.PR.on; return { x: W.x, z: W.z, topic: W.topic.id, n: W.marchers.length, nx: W.nx, nz: W.nz }; })()`);
        t.check(`${topic}: a picket line of ${P.n} on a sidewalk`, P.topic === topic && P.n >= 6 && await g(`(() => { const n = ctx.world.road.nearest(${P.x}, ${P.z}, ctx.car.s, {}); return Math.abs(n.d) > (n.street ? n.street.curb : 4) - 0.3; })()`));
        if (topic === "eruv" || topic === "sauce" || topic === "honk") {
          await footAt(P.x + P.nx * 9, P.z + P.nz * 9);
          await g(`(() => { const F = ctx.cam.free; if (F) { F.yaw = Math.atan2(${P.x} - ctx.foot.pos.x, ${P.z} - ctx.foot.pos.z); F.pitch = 0.05; F.idle = 0; } if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
          await t.frames(30);
          await t.shot(`cityhall3-protest-${topic}`);
        }
      }
      // the draw calls with the crowd in view
      await g(`(${CH}.debug.force.topic = "eruv", ${CH}.protest.stop(), true)`);
      await t.until(`__lulu3d.ctx.cityhall.protest.PR.on && __lulu3d.ctx.cityhall.protest.PR.on.ready`, "the eruv protest again", 15000);
      const P = await g(`(() => { const W = ${CH}.protest.PR.on; return { x: W.x, z: W.z, nx: W.nx, nz: W.nz }; })()`);
      await footAt(P.x + P.nx * 9, P.z + P.nz * 9);
      const withCrowd = await perf(20);
      await g(`(${CH}.debug.force.protest = false, true)`); await t.frames(4);
      const without = await perf(20);
      t.check(`the protest costs a handful of draw calls (${without} → ${withCrowd}: +${withCrowd - without} ≤ 22)`, withCrowd - without <= 22);
      await g(`(${CH}.debug.force.protest = true, true)`);
      await t.until(`__lulu3d.ctx.cityhall.protest.PR.on && __lulu3d.ctx.cityhall.protest.PR.on.ready`, "back on", 15000);
      // ✋ join → the rhythm chant (press on every beat)
      await footAt(P.x + P.nx * 2.2, P.z + P.nz * 2.2);
      t.check(`✋ offers THE PROTEST (${(await promptText()).slice(0, 40)})`, /PROTEST/i.test(await promptText()));
      const c0 = await coins();
      if (await press(`ctx.dialogOpen`)) { await answer(0); await drain(); }
      if (await t.until(`!!(__lulu3d.ctx.cityhall.protest.PR.on && __lulu3d.ctx.cityhall.protest.PR.on.chant)`, "the chant starts", 6000)) {
        // hit each beat right after it lights up
        for (let b = 0; b < 4; b++) {
          await t.until(`(() => { const C = __lulu3d.ctx.cityhall.protest.PR.on.chant; return !C || C.beat >= ${b}; })()`, `beat ${b}`, 6000);
          await t.tap(0);
        }
        await t.until(`!__lulu3d.ctx.cityhall.protest.PR.on.chant`, "the chant ends", 8000);
        t.check(`the chant scored (${await g(`${CH}.protest.PR.lastHits`)} / 4) and the crowd cheered`, (await g(`${CH}.protest.PR.lastHits`)) >= 2 && await g(`${CH}.protest.PR.log.some(l => l.ev === "chant" && l.phase === "done")`));
      }
      t.check(`…joining pays nothing (${c0} → ${await coins()})`, await coins() === c0);
      t.check("she's back in control after the chant", await g(`ctx.state === "footRun" && ctx.foot.phase === "walk"`));
      // honk near it → the crowd answers
      const n0 = await g(`${CH}.protest.PR.log.filter(l => l.ev === "honk").length`);
      await g(`(L3.emit("honk", {}), true)`);
      t.check("honking near it: the crowd cheers", await g(`${CH}.protest.PR.log.filter(l => l.ev === "honk").length`) === n0 + 1);
      // the honk surcharge today → the topic is her honking
      await g(`(${CH}.debug.force.topic = null, true)`);
      await g(`(() => { const S = ${CH}.debug.S; const d = new Date(); S.fees = { day: d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(), n: 2, kinds: { honk: true } }; return true; })()`);
      t.check("got the loud-honk surcharge today → the protest is about HER", await g(`${CH}.protest.topic().id === "honk"`));
      // out of hours → gone
      await g(`(${CH}.debug.force.protest = false, true)`); await t.frames(4);
      t.check("out of protest hours: gone", await g(`!${CH}.protest.PR.on`));
      t.check("never real-world politics: every topic is local + made up", await g(`(() => { const all = [...ctx.cityhall.protest.PR.log.map(l => l.topic).filter(Boolean)]; return all.every(id => ["eruv", "sauce", "parking", "kugel", "strollers", "honk"].includes(id)); })()`));
      await g(`(${CH}.debug.force.protest = null, true)`);
    });

    // ════ the corruption thread ════
    await step("story", async () => {
      await playing();
      if (!await town("lakewood")) return;
      await g(`(() => { const S = ${CH}.debug.S; S.story = {}; S.storyPaid = { day: "", n: 0 }; ${CH}.story.ST.force.day = "story-1"; ${CH}.story.ST.force.sting = false; return true; })()`);
      t.check("before the board: no crew", await g(`!${CH}.story.ST.crew`));
      // read the board (inside) → step 1
      const door = await g(`(() => { const sp = ${CH}.spot(); return { x: sp.x + sp.nx, z: sp.z + sp.nz }; })()`);
      await footAt(door.x, door.z);
      await g(`${CH}.enter()`);
      if (!await inside()) return;
      t.check("Shmuly the Expediter sits in the lobby", await g(`!!__interiors.room.byId.expediter`));
      await useHot("board"); await drain(); await t.frames(8);
      t.check("the notice board: the paving contract with ONE bid → the story starts", await g(`${CH}.story.state("lakewood").step === 1`));
      // the expediter: a waiting permit → skip the line for 5
      await g(`(${CH}.permits.need("yard", "family"), true)`);
      const c0 = await coins();
      await useHot("expediter"); await answer(0); await drain(); await t.frames(8);
      t.check(`the expediter: 5 coins and the form's 'stamped' (${c0} → ${await coins()})`, c0 - await coins() === 5 && await g(`${CH}.permits.PM.open.some(p => p.kind === "yard" && p.step === 2)`));
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000);
      // the crew outside
      await t.until(`!!__lulu3d.ctx.cityhall.story.ST.crew`, "the crew is repaving the street in front of city hall", 6000);
      const C = await g(`(() => { const C = ${CH}.story.ST.crew; return { x: C.x, z: C.z }; })()`);
      await footAt(C.x + 1.5, C.z + 1.5);
      await t.frames(30);
      await t.shot("cityhall3-crew");
      t.check(`✋ at the crew (${(await promptText()).slice(0, 40)})`, /FEIVISH/i.test(await promptText()));
      // a cut (no sting) → +6 once
      const c1 = await coins();
      if (await press(`ctx.dialogOpen`)) { await answer(1); await drain(); }
      t.check(`🤝 a cut: +6 (${c1} → ${await coins()})`, await coins() - c1 === 6);
      if (await press(`ctx.dialogOpen`)) { await answer(1); await drain(); }
      t.check(`…only once (${await coins()})`, await coins() - c1 === 6);
      // 📸 the photo → step 2
      if (await press(`ctx.dialogOpen`)) { await answer(0); await drain(); }
      t.check("📸 the photo → evidence", await g(`${CH}.story.state("lakewood").step === 2`));
      // the phone: the paper → +10, exposed, crew gone, the mayor's line changes; the day cap (15) leaves room for 9
      const c2 = await coins();
      const html = await t.L(`(() => { const el = document.createElement("div"); document.body.appendChild(el); window.__chEl = el; __lulu3d.ctx.cityhall.contactRender(el); return el.textContent; })()`);
      t.check("📞 City Hall offers the photo to the paper / I.A. / hush", /Kvetch/.test(html) && /Internal Affairs/.test(html));
      await t.L(`__chEl.querySelector('[data-story="lakewood:0"]').click()`);
      const paid = await coins() - c2;
      t.check(`📰 the paper: exposed, paid within the day cap (+${paid}: 6 + ${paid} ≤ 15)`, paid === 9 && await g(`${CH}.story.state("lakewood").how === "paper"`));
      t.check("…the crew is gone", await g(`!${CH}.story.ST.crew`));
      await t.L(`(__chEl.remove(), true)`);
      // a sting: Midwood's crew, sting forced → arrested for bribery
      await playing();
      if (!await town("midwood")) return;
      await g(`(() => { const S = ${CH}.story.state("midwood"); S.step = 1; ${CH}.story.ST.force.sting = true; return true; })()`);
      await onFoot();
      await t.until(`!!__lulu3d.ctx.cityhall.story.ST.crew`, "Midwood's crew", 6000);
      const M = await g(`(() => { const C = ${CH}.story.ST.crew; return { x: C.x, z: C.z }; })()`);
      await footAt(M.x + 1.5, M.z + 1.5);
      if (await press(`ctx.dialogOpen`)) { await answer(1); await drain(); }
      t.check("a sting → the law takes her in (BRIBING A PUBLIC SERVANT)", await t.until(`/^law/.test(__lulu3d.state) || __lulu3d.state === "placesArrive"`, "arrested", 20000));
    });
    const r = await W.report(t); W.log(r); W.check(t, "city hall stages 3–5", r, ["nan", "overlay"]);
  },
};
