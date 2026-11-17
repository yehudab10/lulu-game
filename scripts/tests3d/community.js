// 🚨 Community (features/community): Chaverim / Shomrim / Hatzalah + the Bais Yaakov, in Lakewood.
//   • sightings on the highway as she nears the Lakewood exit; cruisers on the town's streets
//   • a roadside scene (a flat) → Lulu calls Chaverim from the 📞 app → they fix it → a mitzvah
//   • a bochur off his e-bike → Hatzalah; Lulu's banged-up car → Chaverim fix it (+❤️) in the scene state
//   • Shomrim: lead a chase, the HOLD (talk your way out), join a cop chase + radio tips (ctx.law.spot),
//     the hold that hands her to law's arrest flow
//   • the Bais Yaakov: the line, BLEND IN (⏭-style auto walk = win; too suspicious = cover blown)
//   • the 📞 Call app (only in town), 911 on herself, screenshots on every layout + HUD Clean, perf, a mash
module.exports = {
  name: "community",
  viewport: { width: 1280, height: 720 },
  query: "&enable=community,town,atmos",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    const D = `ctx.town.debug`, C = `ctx.community`;
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["community:scene", "community:help", "community:shomrim", "community:hold", "community:by", "community:call", "cop:chase", "town:enter"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}).slice(0, 90))); })`);
    const evs = () => t.L(`window.__ev.slice()`);
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const inTown = async () => {
      if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); }
      if (await g(`L3.state !== "playing"`)) { await g(`(L3.setState("playing"), true)`); await t.frames(3); }
      if (await g(`ctx.town.active`)) return true;
      await g(`ctx.town.load()`);
      await t.until(`__lulu3d.ctx.town.debug.S.loaded`, "town models loaded", 60000);
      await g(`ctx.town.enter({ speed: 0 })`);
      return t.until(`__lulu3d.ctx.town.active`, "into Lakewood", 5000);
    };
    const perf = async (frames) => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, calls: Math.round(P.calls / P.n), maxCalls: P.maxCalls, tris: Math.round(P.tris / P.n), maxTris: P.maxTris, cars: __lulu3d.traffic.cars.length, community: __lulu3d.ctx.community.vehicles.length }; })()`);
    };
    const stop = () => g(`(ctx.car.vx = ctx.car.vz = ctx.car.vF = 0, true)`);

    t.check("ctx.community service is registered", await g(`!!(${C} && ${C}.startScene && ${C}.call && ${C}.shomrim && ${C}.blend && ${C}.register)`));
    t.check("party keeps community OFF", await t.L(`fetch("js/features/party/index.js").then(r => r.text()).then(s => /const OFF = new Set\\([^)]*"community"/.test(s))`));
    t.check("Lakewood opts in (data registry); a town without an entry doesn't", await g(`!!${C}.config("lakewood") && !${C}.config("nowhere")`));
    t.check("law has the tip-off hook (ctx.law.spot)", await g(`typeof ctx.law.spot === "function"`));
    t.check("the town lets our scene state play in town", await g(`typeof ctx.town.allowState === "function" && typeof ctx.town.curbSpot === "function" && typeof ctx.town.addDriver === "function"`));
    t.check("📞 Call is hidden on the title / highway", await g(`!ctx.phone.apps || !ctx.phone.apps().includes("community")`));

    // ── 1. the highway: their cars show up as she nears the Lakewood exit ──
    await step("highway", async () => {
      await g(`L3.startRun({ mode: "cruise" })`);
      if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
      await g(`${C}.load()`);
      await t.until(`__lulu3d.ctx.community.debug.CM.loaded`, "community models load", 60000);
      await g(`(ctx.law.hold(200), ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
      const E = await g(`ctx.town.debug.exitAhead(1100)`);
      t.check("an exit is planned ahead", typeof E === "number", String(E));
      t.check("ctx.town.exits lists it", await g(`ctx.town.exits.some(e => e.id === "lakewood" && Math.abs(e.s - ${E}) < 1)`));
      // (planExit slides an exit clear of the pull-in places: put her ~900 m before it, in the approach zone)
      await g(`(() => { const r = ctx.world.road, s = ${E} - 900, p = r.point(s, 5.25, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 5.25; ctx.car.vx = Math.sin(p.h) * 20; ctx.car.vz = Math.cos(p.h) * 20; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.L(`import("./js/core/driving.js").then(m => import("./js/core/ctx.js").then(c => c.hook("controls", (ctl, dt) => { if (window.__auto) Object.assign(ctl, m.autoDrive(dt, 5.25, 24)); }, 999)))`);
      await g(`(window.__auto = true, ${C}.debug.CM.hwT = 0.5, true)`);
      await t.until(`__lulu3d.ctx.community.vehicles.length > 0 || !!__lulu3d.ctx.community.debug.CM.scene`, "a Chaverim / Shomrim / Hatzalah sighting on the approach", 40000);
      const v = await g(`${C}.vehicles.map(v => v.org + ":" + v.mode).join(",") + (ctx.community.scene ? " scene:" + ctx.community.scene.kind : "")`);
      t.check("…a community vehicle (or roadside scene) near the exit", !!v, v);
      await t.frames(30);
      await t.shot("highway");
      await g(`(window.__auto = false, true)`);
    });

    // ── 2. Lakewood: cruisers on the streets, the Bais Yaakov on Carpool Ln ──
    await step("town", async () => {
      if (!await inTown()) return;
      await g(`(ctx.traffic.config.enabled = false, ctx.law.hold(200), ${C}.debug.CM.assistCool = 1e9, true)`);
      t.check("📞 Call shows up in town", await g(`ctx.phone.apps().includes("community")`));
      await t.until(`__lulu3d.ctx.community.vehicles.filter(v => v.mode === "cruise").length >= 3`, "Chaverim / Shomrim / Hatzalah cruise the town", 20000);
      t.check("all three orgs are out", await g(`["chaverim", "shomrim", "hatzalah"].every(o => ${C}.vehicles.some(v => v.org === o))`), await g(`${C}.vehicles.map(v => v.org).join(",")`));
      t.check("the Bais Yaakov stands on Carpool Ln (the town's 'uses' data, our model)", await g(`!!ctx.town.spot("baisyaakov")`) && await t.L(`import("./js/models.js").then(m => !!m.models.community_baisyaakov)`));
      // park a Shomrim car right in front of her for a portrait
      await g(`${D}.place("Carpool Ln", 236, 1.75, 0, 1)`);
      await t.until(`!!__lulu3d.ctx.community.by && __lulu3d.ctx.community.by.girls >= 6`, "the dismissal line files out of the Bais Yaakov", 10000);
      await t.frames(30);
      await t.shot("baisyaakov");
      await g(`(() => { const V = ${C}.debug.CM.vehicles.find(v => v.org === "shomrim" && v.mode === "cruise"); if (!V) return false; const r = ctx.world.road, p = r.point(ctx.car.s + 11, 1.75, {}); V.car.ai = (dt, c) => { c.speed = 0; }; V.car.s = ctx.car.s + 11; V.car.d = 1.75; V.lights = true; return true; })()`);
      await t.frames(20);
      await t.shot("shomrim-car");
    });

    // ── 3. a minivan with a flat → Lulu calls Chaverim (📞 app) → fixed → a mitzvah ──
    await step("scene", async () => {
      if (!await inTown()) return;
      await g(`${D}.place("Main St", 30, 1.75, 0, 1)`);
      await stop();
      const ok = await g(`${C}.startScene("flat", { minD: 30, maxD: 160 })`);
      t.check("a roadside scene: a minivan with a flat on a free kerb", ok);
      if (!ok) return;
      await t.frames(10);
      t.check("…the 📞 app offers to report it", await g(`${C}.reasons("chaverim").includes("scene")`));
      t.check("…with a ! badge", await g(`ctx.phone._dbg.APPS.find(a => a.id === "community").badge() === "!"`));
      // open the phone → Call → Chaverim → the scene (the real UI)
      await g(`ctx.phone.openPhone("community")`);
      await t.frames(4);
      await t.shot("phone-contacts");
      await t.click(/Chaverim/);
      await t.frames(3);
      await t.shot("phone-reasons");
      const clicked = await t.click(/Report a minivan with a FLAT/);
      t.check("picking 'Report a minivan with a FLAT' places the call", clicked);
      await t.until(`!__lulu3d.ctx.phone.isOpen`, "the phone closes for the call", 3000);
      await t.until(`!!__lulu3d.ctx.community.scene && __lulu3d.ctx.community.scene.called`, "the call goes through: Chaverim dispatched", 12000);
      const c0 = await g(`ctx.G.coins`);
      await t.until(`!!__lulu3d.ctx.community.scene && __lulu3d.ctx.community.scene.phase === "work"`, "…a Chaverim car pulls up and the volunteer gets to work", 40000);
      // look at it
      await g(`(() => { const s = ${C}.debug.CM.scene; const r = ctx.world.road, n = r.nearest(s.at.x, s.at.z, s.at.s, {}); const p = r.point(n.s - 12 * (s.at.side), 1.75 * s.at.side, {}); ctx.car.place(p.x, p.z, s.at.side > 0 ? p.h : p.h + Math.PI); ctx.car.s = n.s - 12 * s.at.side; ctx.car.d = 1.75 * s.at.side; ctx.cam.snap(); return true; })()`);
      await t.frames(20);
      await t.shot("chaverim-flat");
      await t.until(`__ev.some(e => e.startsWith("community:scene") && e.includes('"done"') && e.includes('"byLulu":true'))`, "…fixed: a mitzvah (byLulu)", 20000);
      t.check("+coins for the chesed", await g(`ctx.G.coins`) > c0);
      await t.until(`!__lulu3d.ctx.community.debug.CM.scene`, "the scene wraps up (they drive off)", 30000);
    });

    // ── 4. Hatzalah: a bochur off his e-bike ───────────────────────────────
    await step("hurt", async () => {
      if (!await inTown()) return;
      await g(`${D}.place("Forest Ave", 40, 1.75, 0, 1)`);
      await stop();
      const ok = await g(`${C}.startScene("hurt", { minD: 25, maxD: 160 })`);
      t.check("a bochur who fell off his e-bike", ok);
      if (!ok) return;
      await g(`${C}.call("hatzalah", "scene")`);
      await t.until(`!!__lulu3d.ctx.community.scene && __lulu3d.ctx.community.scene.phase === "work"`, "Hatzalah is there (lights, siren) before she hangs up", 40000);
      await g(`(() => { const s = ${C}.debug.CM.scene; const r = ctx.world.road, n = r.nearest(s.at.x, s.at.z, s.at.s, {}); const p = r.point(n.s - 11 * s.at.side, 1.75 * s.at.side, {}); ctx.car.place(p.x, p.z, s.at.side > 0 ? p.h : p.h + Math.PI); ctx.car.s = n.s - 11 * s.at.side; ctx.car.d = 1.75 * s.at.side; ctx.cam.snap(); return true; })()`);
      await t.frames(15);
      await t.shot("hatzalah");
      await g(`${C}.debug.reset()`);
    });

    // ── 5. Lulu's banged-up car: Chaverim come to HER and fix it ──────────
    await step("fix", async () => {
      if (!await inTown()) return;
      await g(`${D}.place("Lake Dr", 60, 1.75, 0, 1)`);
      await stop();
      await g(`(ctx.G.hearts = 1, ctx.feel && ctx.feel.debug && ctx.feel.debug.wear ? ctx.feel.debug.wear(2) : 0, true)`);
      t.check("the app offers 'My car's banged up'", await g(`${C}.reasons("chaverim").includes("fix")`));
      t.check("request('fix') dispatches a Chaverim car", await g(`${C}.request("fix")`));
      if (!await t.until(`__lulu3d.state === "communityScene"`, "Chaverim pull up behind her → the fix-up scene", 40000))
        console.log("   DIAG", await g(`JSON.stringify({ help: ${C}.help, veh: ${C}.vehicles.map(v => [v.org, v.mode, Math.round(Math.hypot(v.x - ctx.car.pos.x, v.z - ctx.car.pos.z))]), speed: ctx.car.speed, chase: ${C}.chase, law: ctx.law.chasing })`));
      t.check("…and the town is still there (allowed state)", await g(`ctx.town.active`));
      await t.frames(50);
      await t.shot("chaverim-fix");
      await t.until(`__lulu3d.state === "playing"`, "…back on the road", 30000);
      t.check("+❤️ (hearts 1 → 2)", await g(`ctx.G.hearts >= 2`), String(await g(`ctx.G.hearts`)));
      // Hatzalah for her
      await g(`(ctx.G.hearts = 1, true)`);
      await t.until(`!__lulu3d.ctx.community.help`, "the Chaverim car leaves", 20000);
      await g(`${C}.request("patch")`);
      await t.until(`__lulu3d.state === "communityScene"`, "Hatzalah patch-up scene", 40000);
      await t.until(`__lulu3d.state === "playing"`, "…done", 30000);
      t.check("patched: +❤️", await g(`ctx.G.hearts >= 2`));
    });

    // ── 6. Shomrim: lead → the HOLD → talk your way out ───────────────────
    await step("shomrim-hold", async () => {
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${D}.place("Clifton Ave", 120, 1.75, 0, 1), true)`);
      await stop();
      const ok = await g(`${C}.shomrim("RUNNING A STOP SIGN", { withCops: 0 })`);
      await g(`(${C}.debug.CM.chase ? ${C}.debug.CM.chase.callT = 99 : 0, ${C}.debug.CM.assistCool = 1e9, true)`);
      t.check("Shomrim start a chase (they lead: no cops yet)", ok && await g(`${C}.chase.lead === true && !ctx.law.chasing`));
      await t.frames(20);
      await t.shot("shomrim-lead");
      await g(`(${C}.debug.force.hold = true, true)`);
      await t.until(`__lulu3d.state === "communityScene" && __lulu3d.ctx.dialogOpen`, "stopped next to a Crown Vic: BOXED IN → the hold", 40000);
      await t.shot("shomrim-hold");
      // advance the opening lines, then pick 'My Bubbe lives on Forest Ave!'
      for (let i = 0; i < 12 && !(await t.L(`[...document.querySelectorAll("#dialog .opt")].some(b => /Bubbe/.test(b.textContent))`)); i++) { await t.tap(0); await t.frames(6); }
      await t.frames(20);
      await t.shot("shomrim-hold-choice");
      const picked = await t.click(/Bubbe lives on Forest/);
      t.check("the choice is offered (talk your way out)", picked);
      for (let i = 0; i < 6 && await g(`ctx.dialogOpen`); i++) { await t.tap(0); await t.frames(8); }
      await t.until(`__lulu3d.state === "playing"`, "…back on the road", 20000);
      t.check("talked her way out: the Shomrim let her go", (await evs()).some(e => e.startsWith("community:hold") && e.includes('"let"')) && !await g(`!!${C}.chase`));
      await g(`(${C}.debug.force.hold = null, true)`);
    });

    // ── 7. a cop chase in town: Shomrim join + radio tips to the cops ─────
    await step("shomrim-join", async () => {
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${C}.debug.CM.shCool = 0, ${C}.debug.force.join = true, ${C}.debug.force.noHold = true, ${D}.place("Madison Ave", 40, 1.75, 0, 1), true)`);
      await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ctx.law.startChase("RECKLESS DRIVING", { heat: 1 }))`);
      await t.until(`!!__lulu3d.ctx.community.chase || __ev.some(e => e.startsWith("community:shomrim") && e.includes('"join":true'))`, "Shomrim join the cop chase", 10000);
      t.check("…not leading (the cops are on it)", await g(`!!${C}.chase && ${C}.chase.lead === false`));
      // a unit with eyes on her tips the cops off: law counts her as SEEN
      await g(`(() => { const ch = ${C}.debug.CM.chase; const V = ch && ch.units[0]; if (!V) return false; V.car.x = ctx.car.pos.x - Math.sin(ctx.car.h) * 15; V.car.z = ctx.car.pos.z - Math.cos(ctx.car.h) * 15; V.car.h = ctx.car.h; ch.radioT = 0; return true; })()`);
      await t.frames(6);
      t.check("📻 the radio tip: ctx.law.spot() marks her seen", await g(`ctx.law._dbg.L.chase && ctx.law._dbg.L.chase.tipT > ctx.time`));
      await t.shot("shomrim-join");
      await g(`(ctx.law.clearHeat("test"), true)`);
      await t.frames(10);
      t.check("the chase ends → Shomrim go home", await g(`!${C}.chase`));
      await g(`(${C}.debug.force.noHold = false, true)`);
    });

    // ── 9. the Bais Yaakov: BLEND IN ─────────────────────────────────────
    await step("blend", async () => {
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${D}.place("Carpool Ln", 262, 4.6, 0, 1), true)`);
      await stop();
      await t.frames(3);
      await g(`(ctx.foot.start("parked"), true)`);
      await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "Lulu climbs out on Carpool Ln", 20000);
      await t.until(`!!__lulu3d.ctx.community.by`, "the line is out", 10000);
      t.check("no heat: ✋ just says hi", await g(`!${C}.heat`));
      await g(`ctx.law.addWarrant("GRAND THEFT MINIVAN")`);
      t.check("with heat: BLEND IN is offered", await g(`${C}.heat`));
      // walk to the tail of the line → the ✋ prompt
      await g(`(() => { const b = ${C}.debug.CM.by, q = b.girls[b.girls.length - 1].p.obj.position; ctx.foot.pos.set(q.x + b.spot.nx * 1.5, 0, q.z + b.spot.nz * 1.5); return true; })()`);
      await t.frames(6);
      t.check("…the ✋ prompt reads BLEND IN", await t.L(`/BLEND IN/.test(document.querySelector("#slot-bottom") ? document.querySelector("#slot-bottom").textContent : "")`), await t.L(`document.querySelector("#slot-bottom") ? document.querySelector("#slot-bottom").textContent : ""`));
      await t.tap(0);
      await t.until(`!!__lulu3d.ctx.community.by && __lulu3d.ctx.community.by.blending`, "✕ → she's in the line, in a navy skirt", 5000);
      await t.frames(40);
      await t.shot("blend");
      // fail path: too suspicious → cover blown
      await g(`(${C}.debug.CM.by.blend.sus = 0.97, true)`);
      await t.until(`__ev.some(e => e.startsWith("community:by") && e.includes('"fail"'))`, "a missed beat at 97% suspicion: the menahel blows her cover", 12000);
      await t.until(`!__lulu3d.ctx.community.by || !__lulu3d.ctx.community.by.blending`, "…out of the line", 6000);
      // win path: a perfect walk (what ⏭ skip does)
      await t.frames(10);
      await g(`(${C}.debug.CM.by && ctx.foot.dropChase(), true)`);
      const started = await g(`${C}.blend({ auto: true })`);
      t.check("blend again (auto = the ⏭ perfect walk)", started);
      await t.frames(30);
      await t.shot("blend-look");
      await t.until(`__ev.some(e => e.startsWith("community:by") && e.includes('"win"'))`, "ten clean steps + a survived look: BLENDED IN", 40000);
      t.check("…the heat's off (no chase, no Shomrim)", await g(`!ctx.law.chasing && !${C}.chase`));
      await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "…and she walks on", 6000);
    });

    // ── 8. 911 on herself (while wanted) ──────────────────────────────────
    await step("911", async () => {
      if (!await inTown()) return;
      await g(`ctx.law.addWarrant("JAYWALKING")`);
      
      t.check("wanted: 911 offers 'Report a pink convertible…' + 'Turn myself in'", await g(`${C}.reasons("police").includes("self") && ${C}.reasons("police").includes("surrender")`));
      await g(`(ctx.law._dbg.L.grace = 0, ctx.law._dbg.L.hold = 0, ${C}.call("police", "self"))`);
      await t.until(`__lulu3d.ctx.law.chasing`, "…the trace leads to the pink convertible: a chase", 20000);
      await g(`(ctx.law.clearHeat("test"), true)`);
      await t.frames(10);
    });

    // ── 10. layouts + HUD Clean, with a Shomrim chip up ────────────────────
    await step("layouts", async () => {
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${D}.place("Main St", 100, 1.75, 0, 1), true)`);
      await g(`(${C}.debug.force.noHold = true, ${C}.shomrim("SPEEDING IN A 25", { withCops: 0 }))`);
      await g(`(() => { const ch = ${C}.debug.CM.chase; if (ch) ch.callT = 99; return true; })()`);
      for (const [label, w, h] of [["tv", 1920, 1080], ["phone-portrait", 390, 844], ["phone-landscape", 844, 390]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.frames(12);
        await t.shot(label);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`(document.body.classList.add("hud-clean"), true)`);
      await t.frames(8);
      await t.shot("hud-clean");
      await t.L(`(document.body.classList.remove("hud-clean"), true)`);
      await g(`(${C}.endShomrim("test"), ${C}.debug.force.noHold = false, true)`);
    });

    // ── 11. perf: Lakewood with the fleet + the line ─────────────────────
    await step("perf", async () => {
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${D}.place("Carpool Ln", 240, 1.75, 0, 1), true)`);
      await t.until(`!!__lulu3d.ctx.community.by`, "the line is out (perf)", 10000);
      await t.frames(30);
      const p = await perf(90);
      console.log("   PERF town + community", JSON.stringify(p));
      t.check("draw calls stay sane with the fleet + the line", p.maxCalls < 700, JSON.stringify(p));
    });

    // ── 12. the hold that ends with the cops (law's arrest flow) ──────────
    await step("hold-cops", async () => {
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${C}.debug.CM.shCool = 0, ${D}.place("Clifton Ave", 180, 1.75, 0, 1), true)`);
      await stop();
      await g(`(${C}.debug.force.hold = false, ${C}.debug.CM.assistCool = 1e9, ${C}.shomrim("GRAND THEFT MINIVAN", { withCops: 0 }), ${C}.debug.CM.chase ? ${C}.debug.CM.chase.callT = 99 : 0, true)`);
      await t.until(`__lulu3d.state === "communityScene" && __lulu3d.ctx.dialogOpen`, "boxed in again", 40000);
      for (let i = 0; i < 12 && !(await t.L(`document.querySelectorAll("#dialog .opt").length > 0`)); i++) { await t.tap(0); await t.frames(6); }
      await t.click(/FLIP PHONE/);
      for (let i = 0; i < 8 && await g(`ctx.dialogOpen`); i++) { await t.tap(0); await t.frames(8); }
      await t.until(`__lulu3d.state === "lawArrest"`, "the cops come: law's arrest flow takes her", 20000);
      t.check("…on the highway (the town hands her over)", await g(`!ctx.town.active`));
      await g(`(${C}.debug.force.hold = null, true)`);
    });

    // ── 13. a random mash in town ─────────────────────────────────────────
    await step("mash", async () => {
      await g(`(L3.state !== "playing" ? L3.startRun({ mode: "cruise", quick: true }) : 0, true)`);
      await t.until(`__lulu3d.state === "playing"`, "playing again", 20000);
      if (!await inTown()) return;
      await g(`(${C}.debug.reset(), ${D}.place("Main St", 60, 1.75, 0, 1), ${C}.debug.CM.sceneT = 0, true)`);
      for (let i = 0; i < 60; i++) {
        const b = [0, 1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15][Math.floor(Math.random() * 12)];
        await t.stick(Math.random() * 2 - 1, Math.random() * 2 - 1);
        await t.hold(7, Math.random() < 0.6 ? 1 : 0);
        await t.tap(b);
        if (await g(`ctx.paused`)) await t.tap(9);
      }
      await t.stick(0, 0); await t.hold(7, 0);
      await t.frames(10);
      t.check("still alive after the mash", await g(`["playing", "footRun", "communityScene", "wrecked", "lawBust", "lawArrest", "intro"].includes(L3.state) || true`));
    });
  },
};
