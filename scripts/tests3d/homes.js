// 🏠 Homes (features/homes): living towns + breaking into houses.
//   • the living town: Lakewood's crowd (walkers, strollers, scooters, dogs, porches, e-bikes) is up against the town's
//     own townsfolk, PERF with the crowd on vs off (budget: ≤ +40 draw calls, ≤ +170k triangles, crowd tick ≤ 2 ms),
//     reactions (a honk → a yell, a speeding car → they scatter), Midwood gets its own crowd
//   • a front door is a ✋ spot: KNOCK → someone answers (forced: a family mid-meal) → in as a guest
//   • SNEAK in through a window: crouched, view cones + the "?"→"!" detection meter; standing in front of someone fills it
//   • every item has a reaction on ≥ 2 kinds of resident (pan, seltzer, rubber chicken, pillow, kugel, leaf blower,
//     water balloon + pepper spray, the horn, a disguise)
//   • couch coins: paid once per house per run (a second dig is lint), capped across houses
//   • a resident calls it in → 📞 law's call-in with BURGLARY; with a cop near → a foot chase → arrest → BURGLARY in court
//   • the family REMEMBERS her next time (knock → "YOU!"); out the window lands her beside the house
//   • a 🎉 party: presence "🏠 in the …s' house" in her snapshot extras (what friends read)
const { spawn } = require("child_process");
const path = require("path");
const PORT = 26000 + (process.pid % 20000);
const URL = `ws://127.0.0.1:${PORT}`;
let relay = null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function startRelay() {
  return new Promise((resolve, reject) => {
    relay = spawn(process.execPath, [path.join(__dirname, "..", "..", "server", "local-relay.js")], { env: Object.assign({}, process.env, { PORT: String(PORT) }), stdio: ["ignore", "pipe", "pipe"] });
    let done = false; const ok = () => { if (!done) { done = true; resolve(); } };
    relay.stdout.on("data", d => { if (/listen/i.test(String(d))) ok(); });
    relay.on("error", reject); setTimeout(ok, 1500);
  });
}
process.on("exit", () => { try { relay && relay.kill(); } catch (e) { } });

module.exports = {
  name: "homes",
  viewport: { width: 1280, height: 720 },
  query: `&enable=homes,town,law,foot,atmos,interiors,party&mpurl=${encodeURIComponent(URL)}`,
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, pepperSpray: 3, mpName: "Kugel Kid" },
  async run(t) {
    const g = t.game, D = `ctx.homes.debug`;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 300)); } };
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["homes:enter", "homes:exit", "homes:knock", "homes:use", "homes:spotted", "homes:called", "homes:report", "homes:couch", "homes:recognized", "homes:honked", "homes:scatter", "law:bolo", "cop:chase"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 160))); })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    const perf = async frames => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { const t0 = performance.now(); o(s, c); const P = window.__pf; if (!P) return; P.n++; P.ms += performance.now() - t0; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); }; }
        window.__pf = { n: 0, ms: 0, calls: 0, tris: 0, maxCalls: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, renderMs: +(P.ms / P.n).toFixed(1), calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n) }; })()`);
    };
    const inTown = async (town = "lakewood") => {
      if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
      if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
      await g(`ctx.town.load("${town}")`);
      await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town} models`, 90000);
      await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
      return t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.homes.crowd().on`, `in ${town} with its crowd`, 60000);
    };
    // on foot at door i's step, facing it
    const toDoor = async i => {
      if (!await g(`ctx.foot.active && L3.state === "footRun"`)) { await g(`ctx.foot.start("droveOff", { noIntro: true })`); await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000); }
      await g(`(() => { const h = ctx.homes.homes()[${i}], f = ctx.foot.pos; f.set(h.ap.x, 0.05, h.ap.z); ctx.foot.obj.position.copy(f); return true; })()`);
      await t.frames(3);
    };
    const inside = () => t.until(`__lulu3d.state === "interior" && __lulu3d.ctx.homes.debug.room() && __lulu3d.ctx.homes.debug.room().res.length > 0`, "inside the house", 60000);
    const leave = async () => { await g(`(() => { const c = ctx.homes.debug.VISIT.cur; if (c) { c.V.exit = "door"; c.rt.leave(); } return true; })()`); await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000); await t.frames(4); };

    t.check("ctx.homes service", await g(`!!(ctx.homes && ctx.homes.enter && ctx.homes.crowd && ctx.interiors.home)`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
    // (households have a schedule now — features/homes life.js: this test wants everybody home on an ordinary day, and the
    //  classic alarm; homelife tests the scenes + who-catches-her)
    await g(`(${D}.scene("ordinary"), ${D}.force.noCatch = true, true)`);

    // ── 1. the living town ──
    await step("crowd", async () => {
      if (!await inTown("lakewood")) return;
      await t.frames(20);
      const ci = await g(`ctx.homes.crowd()`);
      const base = await g(`ctx.town.debug.LIFE.people.length`);
      console.log("   CROWD lakewood", JSON.stringify(ci), "town's own people:", base);
      t.check("ped counts are up: ≥ 50 townsfolk in Lakewood (the town's own ~15 + the crowd)", ci.peds >= 50 && ci.peds > base * 3, `${ci.peds} crowd + ${base}`);
      t.check("variety: strollers, scooters, dogs, porches, e-bikes, the mail carrier", ci.strollers > 0 && ci.dogs > 0 && ci.porch >= 8 && ci.bikes > 0 && ci.types.includes("scooter") && ci.types.includes("mail"), ci.types.join(","));
      t.check("front doors to knock on: ≥ 40", await g(`ctx.homes.homes().length`) >= 40, String(await g(`ctx.homes.homes().length`)));
      // perf: the same view with the crowd off → on
      await g(`ctx.town.debug.place("Main St", 60, 1.75, 0, 1)`);
      await t.frames(10);
      await g(`${D}.stopCrowd()`); await t.frames(4);
      const off = await perf(60);
      await g(`${D}.startCrowd()`); await t.frames(10);
      // (the crowd's own draw calls / triangles, sampled over the same frames: the off → on totals also swing with the
      //  town's minivans driving in and out of view, so the budget is checked on what the crowd itself draws)
      await t.L(`(() => { window.__cd = { n: 0, calls: 0, tris: 0, max: 0 }; const tick = () => { const D = window.__cd; if (!D) return; const c = __lulu3d.ctx.homes.crowd(); D.n++; D.calls += c.calls; D.tris += c.tris; D.max = Math.max(D.max, c.calls); requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`);
      const on = await perf(60);
      const cd = await t.L(`(() => { const D = window.__cd; window.__cd = null; return { calls: Math.round(D.calls / Math.max(1, D.n)), max: D.max, tris: Math.round(D.tris / Math.max(1, D.n)) }; })()`);
      const ci2 = await g(`ctx.homes.crowd()`);
      console.log("   PERF town (crowd off)", JSON.stringify(off));
      console.log("   PERF town (crowd on) ", JSON.stringify(on), "near", ci2.near, "far", ci2.far, "tick ms", ci2.ms, "· the crowd itself", JSON.stringify(cd));
      t.check("perf budget: the crowd draws ≤ 40 draw calls", cd.max <= 40, `avg ${cd.calls}, max ${cd.max} (town ${off.calls} → ${on.calls})`);
      t.check("perf budget: ≤ 170k triangles", cd.tris <= 170000, `${cd.tris} (town ${off.tris} → ${on.tris})`);
      t.check("perf budget: ≤ " + 26 + " full-rig peds, the crowd tick ≤ 2 ms", ci2.near <= 26 && ci2.ms <= 2, `${ci2.near} near, ${ci2.ms} ms`);
      await t.shot("crowd-street");
      // a honk → somebody yells; a speeding car → they scatter
      // (the horn reaches folks within 26 m — stop the car in the lane beside a walker first: the perf spot may have nobody near)
      await g(`(() => { const C = ctx.homes.debug.CR, PL = ctx.town.debug.PL, p = C.peds.find(q => q.kind === "walker" && q.st && q.st.a1 - q.along > 30 && q.along - q.st.a0 > 30); if (!p) return false;
        const c = ctx.town.debug.pt(p.st.name, p.along - p.dir * 8, p.side * 1.75), h = p.dir > 0 ? p.st.h : p.st.h + Math.PI;
        ctx.car.place(PL.ORIGIN.x + c.x, PL.ORIGIN.z + c.z, h); ctx.car.vx = 0; ctx.car.vz = 0; ctx.car.vF = 0; C.honkT = 0; return true; })()`);
      await t.frames(2);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("honk", {}))`);
      await t.frames(4);
      t.check("a honk: the nearest folks yell", (await evs(/homes:honked/)).length > 0);
      // a walker on the road's edge, her car 5 m behind it in the same direction at 14 m/s — in the travel lane
      // (d ±1.75: the parking lane is lined with minivans now, and a parked one would stop her dead)
      await g(`(() => { const C = ctx.homes.debug.CR, PL = ctx.town.debug.PL, p = C.peds.find(q => q.kind === "walker" && q.st && q.st.a1 - q.along > 30 && q.along - q.st.a0 > 30); if (!p) return false;
        p.flee = null; p.lat = p.st.curb + 0.4; p.want = p.lat;
        const c = ctx.town.debug.pt(p.st.name, p.along - p.dir * 5, p.side * 1.75), h = p.dir > 0 ? p.st.h : p.st.h + Math.PI;
        C.said = 0;     // (the honk above just yelled: the crowd's one-voice-at-a-time cooldown would mute the AAH!)
        ctx.car.place(PL.ORIGIN.x + c.x, PL.ORIGIN.z + c.z, h); ctx.car.vx = Math.sin(h) * 14; ctx.car.vz = Math.cos(h) * 14; ctx.car.vF = 14; window.__sc = p.id; return true; })()`);
      // (a jump aside lasts 0.75 s — on a slow software-GL frame that's only a couple of frames: watch each one)
      let fled = false;
      for (let k = 0; k < 8 && !fled; k++) { await t.frames(1); fled = (await evs(/homes:scatter/)).length > 0 || await g(`ctx.homes.debug.CR.peds.some(p => p.flee)`); }
      t.check("a speeding car: peds scatter (AAH!)", fled);
      await g(`(ctx.car.vx = 0, ctx.car.vz = 0, ctx.car.vF = 0, true)`);
    });

    // ── 2. knock → answered → in as a guest ──
    await step("knock", async () => {
      await toDoor(0);
      t.check("a front door is a ✋ spot", /THE .*S$/.test(await g(`(ctx.foot.debug.interactables() || {}).label || ""`)), await g(`(ctx.foot.debug.interactables() || {}).label`));
      await g(`(${D}.force.knock = "meal", ctx.homes.knock(0))`);
      await t.until(`window.__ev.some(e => /homes:knock/.test(e))`, "knock: someone answers", 20000);
      for (let k = 0; k < 40 && !(await g(`L3.state === "interior"`)); k++) {
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length) { const i = opts.findIndex(o => /Go in/.test(o)); await t.L(`document.querySelectorAll("#dialog .opt")[${Math.max(0, i)}].click()`); await t.frames(3); }
        else await t.tap(0);
      }
      t.check("the knock was answered (a family mid-meal)", (await evs(/homes:knock.*meal/)).length > 0);
      if (!await inside()) return;
      t.check("…and invited her in as a guest", await g(`ctx.homes.debug.room().mode === "guest"`));
      await t.frames(20);
      await t.shot("guest");
      await leave();
      t.check("out the front door: back on foot", await g(`L3.state === "footRun" && ctx.foot.active`));
      // (heist's bank used to send her back to the highway from ANY other interior in a town — houses included)
      t.check("…still in town (a house visit doesn't unload Lakewood)", await g(`ctx.town.active && ctx.homes.homes().length > 40`), JSON.stringify(await g(`({ town: ctx.town.active, doors: ctx.homes.homes().length })`)));
    });

    // ── 3. sneak in a window: detection ──
    let house = 1;
    await step("sneak", async () => {
      house = await g(`ctx.homes.homes().findIndex((h, i) => i > 0 && h.cast.filter(k => ["bubbe", "dad", "mom", "boy", "girl"].includes(k)).length >= 2)`);
      await toDoor(house);
      await g(`ctx.homes.enter(${house}, "sneak", "window")`);
      if (!await inside()) return;
      await t.frames(12);
      const r0 = await g(`${D}.room()`);
      t.check("in through the window: crouched, sneaking", r0.mode === "sneak" && r0.crouch, JSON.stringify({ mode: r0.mode, crouch: r0.crouch }));
      t.check("residents have view cones on the floor", r0.res.some(r => r.cone), JSON.stringify(r0.res.map(r => r.kind + ":" + r.cone)));
      t.check("rooms are procedural from the templates", r0.rooms.includes("living") && r0.rooms.includes("kitchen"), r0.rooms.join(","));
      await t.shot("sneak-window");
      const who = r0.res.find(r => ["bubbe", "dad", "mom", "boy", "girl"].includes(r.kind)).kind;
      await g(`(${D}.near("${who}", 1.6), true)`);
      await t.frames(6);
      const mid = await g(`${D}.room().res.find(r => r.kind === "${who}")`);
      t.check("in front of a resident: the meter fills (\"?\")", mid.meter > 0 && (mid.ind === "?" || mid.ind === "!"), JSON.stringify(mid));
      await t.shot("sneak-question");
      await t.until(`__lulu3d.ctx.homes.debug.room().res.find(r => r.kind === "${who}").state === "alarm"`, "…then \"!\": spotted", 15000);
      t.check("spotted → homes:spotted", (await evs(/homes:spotted/)).length > 0);
      t.check("the HUD shows the detection chip", await t.L(`/SPOTTED|CALLING|SNEAKING|STANDING/.test((document.querySelector(".int-extra") || {}).textContent || "")`));
      await t.shot("sneak-spotted");
    });

    // ── 4. items × residents ──
    await step("items", async () => {
      if (!await g(`L3.state === "interior"`)) return;
      const kinds = await g(`${D}.room().res.map(r => r.kind)`);
      const items = ["pan", "seltzer", "chicken", "pillow", "kugel", "blower", "balloon", "pepper", "horn", "disguise"];
      const got = {};
      for (const it of items) {
        got[it] = [];
        for (const k of kinds) {
          const r = await g(`(() => { const c = ctx.homes.debug.VISIT.cur; const q = c.V.res.find(r => r.kind === "${k}"); q.stun = 0; q.fx = null; const x = ${D}.use("${it}", "${k}"); return x && x.line; })()`);
          if (r && r.length > 3) got[it].push(k);
          await t.frames(1);
        }
      }
      // the table covers every kind, not just this house's
      const table = await t.L(`import("./js/features/homes/data.js").then(m => Object.fromEntries(Object.entries(m.REACT).map(([i, v]) => [i, Object.keys(v).filter(k => v[k].line)])))`);
      for (const it of items) t.check(`${it}: a reaction on ≥ 2 kinds of resident`, (table[it] || []).length >= 2 && got[it].length >= Math.min(2, kinds.length), `table ${table[it] && table[it].join(",")} · here ${got[it].join(",")}`);
      await t.frames(8);
      await t.shot("items");
      t.check("homes:use events", (await evs(/homes:use/)).length >= 10);
    });

    // ── 5. couch coins: once per house per run ──
    await step("couch", async () => {
      if (!await g(`L3.state === "interior"`)) return;
      const coins0 = await g(`ctx.G.coins`);
      const dig = () => g(`(() => { const c = ctx.homes.debug.VISIT.cur; const h = c.rt.hots.find(h => h.id === "couch"); if (!h) return false; h.action(c.rt, h); return true; })()`);
      const has = await dig();
      t.check("the living room couch has cushions to dig in", has);
      await t.frames(4);
      const c1 = await g(`ctx.G.coins`);
      await dig(); await t.frames(4);
      const c2 = await g(`ctx.G.coins`);
      t.check("couch coins paid once (3–8)", c1 - coins0 >= 3 && c1 - coins0 <= 8, `${coins0} → ${c1}`);
      t.check("a second dig in the same house pays nothing", c2 === c1, `${c1} → ${c2}`);
      t.check("the run cap is tracked", await g(`${D}.RUN.coins === ${c1 - coins0} && ${D}.RUN.couch.size === 1`));
    });

    // ── 6. the call-in + the window exit ──
    await step("call", async () => {
      if (!await g(`L3.state === "interior"`)) return;
      // make the call finish: everyone's alarmed, the caller's at the phone
      await g(`(() => { const c = ctx.homes.debug.VISIT.cur; for (const r of c.V.res) { r.stun = 0; r.fx = null; r.fight = null; r.friendly = false; r.meter = 1; r.state = "alarm"; } return true; })()`);
      const adult = await g(`${D}.room().res.some(r => ["bubbe", "dad", "mom"].includes(r.kind))`);
      if (adult) await t.until(`__lulu3d.ctx.homes.debug.room().reported`, "a resident gets to the phone and calls it in", 40000);
      else await g(`(ctx.homes.debug.VISIT.cur.V.reported = true)`);
      t.check("homes:called (📞)", !adult || (await evs(/homes:called/)).length > 0);
      await t.shot("calling");
      const win = await g(`(() => { const c = ctx.homes.debug.VISIT.cur; const h = c.rt.hots.find(h => /^win_/.test(h.id)); h.action(c.rt, h); return true; })()`);
      await t.until(`__lulu3d.state === "footRun"`, "out the window", 30000);
      await t.frames(6);
      const ex = (await evs(/homes:exit/)).pop() || "";
      t.check("the window exit: back outside, beside the house", /"exit":"window"/.test(ex), ex);
      const pos = await g(`(() => { const h = ctx.homes.homes()[${house}], f = ctx.foot.pos; return Math.hypot(f.x - h.ap.x, f.z - h.ap.z); })()`);
      t.check("…landing within a few metres of the house", pos < 9, pos.toFixed(1));
      const rep = (await evs(/homes:report/)).pop() || "";
      t.check("the report: BURGLARY, a call-in (no cop around)", /BURGLARY/.test(rep) && /"chase":false/.test(rep), rep);
      t.check("law's 📞 call-in is out with BURGLARY", await g(`!!(ctx.law._dbg && ctx.law._dbg.L.bolo && ctx.law._dbg.L.bolo.charges.some(c => /BURGLARY/.test(c)))`) || (await evs(/law:bolo.*BURGLARY/)).length > 0);
      await t.shot("window-out");
    });

    // ── 7. the family remembers her ──
    await step("memory", async () => {
      const key = await g(`ctx.homes.homes()[${house}].key`);
      const fam = await g(`ctx.homes.family(${JSON.stringify(key)})`);
      t.check("the family remembers (seen + burgled)", fam && fam.seen >= 1 && fam.burgled >= 1, JSON.stringify(fam));
      await g(`(${D}.force.knock = null, true)`);
      await toDoor(house);
      await g(`ctx.homes.knock(${house})`);
      await t.until(`window.__ev.some(e => /homes:knock.*again_bad/.test(e))`, "knock again: they recognise her", 20000);
      t.check("next time they recognise her (\"YOU!\")", (await evs(/homes:recognized/)).length > 0);
      await t.shot("recognized");
      for (let k = 0; k < 30 && await g(`ctx.dialogOpen`); k++) await t.tap(0);
      await t.frames(10);
    });

    // ── 8. a cop nearby: a foot chase with BURGLARY → arrest → court ──
    await step("court", async () => {
      if (!await g(`L3.state === "footRun"`)) return;
      await g(`(ctx.law._dbg && ctx.law._dbg.L.bolo ? (ctx.law._dbg.L.bolo = null) : 0, ${D}.force.cop = true, ${D}.report(${house}), true)`);
      t.check("a cop nearby: an instant foot chase", (await evs(/homes:report.*"chase":true/)).length > 0 && await g(`ctx.foot.chasing`));
      await g(`(() => { const ch = ctx.foot.debug.F.chase; ch.p.obj.position.copy(ctx.foot.pos); return true; })()`);
      await t.until(`["lawArrest", "lawJail", "lawCourt"].includes(__lulu3d.state)`, "caught → arrested", 30000);
      const ch = await g(`JSON.stringify(ctx.stateData && ctx.stateData.charges || [])`);
      t.check("arrested for BURGLARY", /BURGLARY/.test(ch), ch);
      const cd = await t.L(`import("./js/features/law/rules.js").then(m => { const d = m.chargeDialogueFor(${ch}); return d ? d.key + " | " + d.cop[0] : ""; })`);
      t.check("court has its own BURGLARY lines", /BURGLARY/.test(cd), cd);
      await g(`(${D}.force.cop = false, true)`);
      await t.shot("arrest");
      await g(`(L3.setState("title"), true)`);
      await t.frames(10);
    });

    // ── 9. Midwood: its own crowd ──
    await step("midwood", async () => {
      await g(`L3.startRun({ mode: "cruise", quick: true })`);
      await t.until(`__lulu3d.state === "playing"`, "cruise again");
      await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law.hold(9999), true)`);
      if (!await inTown("midwood")) return;
      await t.frames(10);
      const ci = await g(`ctx.homes.crowd()`);
      console.log("   CROWD midwood", JSON.stringify(ci));
      t.check("Midwood: a crowd of its own (more e-bikes)", ci.peds >= 50 && ci.bikes >= 4, `${ci.peds} peds, ${ci.bikes} bikes`);
      t.check("Midwood: brownstone + house doors to knock on", await g(`ctx.homes.homes().some(h => h.model === "town_mw_rowhouse") && ctx.homes.homes().some(h => h.model === "town_mw_house")`));
      await g(`ctx.town.debug.place("Avenue J", -120, 1.75, 0, 1)`);
      await t.frames(12);
      const p = await perf(45);
      console.log("   PERF midwood (crowd on)", JSON.stringify(p), JSON.stringify(await g(`(() => { const c = ctx.homes.crowd(); return { near: c.near, far: c.far, ms: c.ms, crowdCalls: c.calls, crowdTris: c.tris }; })()`)));
      await t.shot("midwood-crowd");
      await g(`(ctx.town.leave("reset"), L3.setState("title"), true)`);
      await t.frames(6);
    });

    // ── 10. a 🎉 party: presence ──
    await step("party", async () => {
      await startRelay();
      await g(`(L3.state !== "title" && L3.setState("title"), true)`); await t.frames(4);
      await t.click(/Friends/);
      if (!await t.click(/Party games/)) await g(`(ctx.party.hostParty(), true)`);
      if (!await t.until(`__lulu3d.ctx.state === "partyLobby" && __lulu3d.ctx.party.connected`, "host: lobby", 120000)) { await t.shot("party-fail"); return; }
      await t.L(`document.getElementById("pt_act_roam") && document.getElementById("pt_act_roam").click()`); await t.frames(4);
      await t.L(`document.getElementById("pt_go") && document.getElementById("pt_go").click()`);
      if (!await t.until(`__lulu3d.ctx.state === "playing" && __lulu3d.ctx.party.activity && __lulu3d.ctx.party.activity.k === "roam"`, "free roam", 120000)) return;
      await g(`(ctx.law.hold(9999), true)`);
      await g(`ctx.town.load("lakewood")`);
      await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "town models", 90000);
      await g(`ctx.town.enter({ town: "lakewood", exitS: ctx.town.exitOf("lakewood"), speed: 0 })`);
      await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.homes.crowd().on`, "party town crowd", 60000);
      const ab = await g(`(() => { const f = () => JSON.stringify(ctx.homes.debug.CR.peds.slice(0, 16).map(p => [p.type, Math.round(p.x), Math.round(p.z)])); ${D}.startCrowd(); const a = f(); ${D}.startCrowd(); return [a, f()]; })()`);
      const [a, b] = ab;
      t.check("Free Roam: the crowd is seeded from the party (the same layout every time)", a === b, a.slice(0, 120));
      await toDoor(2);
      await g(`ctx.homes.enter(2, "sneak", "door")`);
      if (!await inside()) return;
      await t.frames(30);
      const pr = await g(`ctx.party._debug.xk().pr`);
      t.check("party presence: \"🏠 in the …s' house\" in her snapshot", Array.isArray(pr) && pr[1] === "🏠" && /s' house/.test(pr[2]), JSON.stringify(pr));
      await t.shot("party-inside");
      await leave();
      await t.frames(30);
      const pr2 = await g(`ctx.party._debug.xk().pr`);
      t.check("…and back to \"on foot\" when she's out", Array.isArray(pr2) && pr2[0] === "foot", JSON.stringify(pr2));
      try { relay.kill(); } catch (e) { }
    });
  },
};
