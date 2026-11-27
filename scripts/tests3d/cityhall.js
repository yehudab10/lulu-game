// 🏛️ City hall (features/cityhall, roadmap 17) — stage 1: a city hall in each town (Lakewood's on Minivan Way, Midwood's
// on Avenue K) on a block face of its own, its ✋ door (warmed → a soft cut, never a black screen), the room (the take-a-
// number machine, the three windows with one BACK IN 5 MINUTES, the notice board, the mayor's office: the mayor in, or out
// cutting a ribbon), nothing pays, nobody stands in a wall, every hot-spot reachable, the draw calls, the layouts; the
// mayor's ribbon cutting out in town (starts up her sidewalk, ✋ hold the ribbon → the snip, then it clears).
const W = require("../lib/qawatch.js");

const LAYOUTS = [["desktop", 1280, 720, false], ["phone-portrait", 390, 844, false], ["phone-landscape", 844, 390, false], ["tv", 1920, 1080, true]];
module.exports = {
  name: "cityhall",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cityhall",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const PART = (process.env.CITYHALL_PART || "").split(",").filter(Boolean);
    const want = k => !PART.length || PART.includes(k);
    const step = async (label, fn) => { if (!want(label.split(" ")[0]) && !want(label.split(" ")[1] || "-")) return; try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const room = expr => g(`(() => { const r = window.__interiors.room; return ${expr}; })()`);
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
    const onFoot = async () => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
    };
    const onFootAtDoor = async (out = 1.2) => {
      await onFoot();
      await g(`(() => { const sp = ctx.cityhall.spot(); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${out}, 0.05, sp.z + sp.nz * ${out}); F.phase = "walk"; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      await t.frames(6);
    };
    const curtain = () => t.L(`(() => { const o = []; for (const id of ["townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && +getComputedStyle(e).opacity > 0.4) o.push(id); } return o; })()`);
    const inside = () => t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "cityhall"`, "inside city hall", 60000);
    const walkIn = async () => { await onFootAtDoor(); await W.reset(t); await g(`ctx.cityhall.enter()`); return inside(); };
    const walkOut = async () => {
      await g(`(window.__interiors.room && window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back out of city hall (footRun)", 30000);
      await t.frames(20);
    };
    const promptText = () => t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);
    const perf = async frames => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, calls: Math.round(P.calls / Math.max(1, P.n)), maxCalls: P.maxCalls, tris: Math.round(P.tris / Math.max(1, P.n)), maxTris: P.maxTris }; })()`);
    };
    const onScreen = sel => t.L(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.offsetParent === null) return "absent"; const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; })()`);
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const tapThrough = async n => { for (let i = 0; i < n; i++) await t.tap(0); };
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    /** Answer the open dialogue: the option matching re (else tap through lines) until \`done\` (page code) is true. */
    async function answer(re, done = null, max = 200) {
      for (let i = 0; i < max; i++) {
        if (done && await g(done)) return true;
        const o = await opts();
        if (o.length) {
          const idx = o.findIndex(x => re.test(x));
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

    t.check("ctx.cityhall service + the interior exist", await g(`!!(ctx.cityhall && ctx.cityhall.enter && ctx.interiors.cityhall)`));
    t.check("the town keeps the room (bank.js TOWN_INTERIORS)", await t.L(`fetch("js/features/heist/bank.js").then(r => r.text()).then(s => /TOWN_INTERIORS = new Set\\(\\[[^\\]]*"cityhall"/.test(s))`));
    t.check("friends share the room (SHARED.cityhall)", await g(`import("./js/features/together/rooms.js").then(m => typeof m.SHARED.cityhall === "function")`).catch(() => false) || await t.L(`import("./js/features/together/rooms.js").then(m => typeof m.SHARED.cityhall === "function")`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await g(`(ctx.cityhall.debug.force.noDing = true, ctx.cityhall.debug.RB.next = 1e9, true)`);
    await W.install(t);

    for (const id of ["lakewood", "midwood"]) {
      // ════ 1. the building: on its own block face, beside a street, its door a ✋ spot; a soft cut in and out ════
      await step(`${id} door`, async () => {
        if (!await town(id)) return;
        const info = await g(`(() => { const sp = ctx.cityhall.spot(); if (!sp) return null; const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {}); const L = ctx.town.plan.local(sp.x, sp.z, {});
          return { d: n.d, street: n.street && n.street.name, lx: L.x, lz: L.z, others: Object.entries(ctx.town.spots).filter(([k, v]) => v && v.x != null && k !== "cityhall" && Math.hypot(v.x - sp.x, v.z - sp.z) < 9).map(([k]) => k) }; })()`);
        t.check(`${id}: city hall's door is a spot on a sidewalk beside a street (${JSON.stringify(info)})`, !!info && Math.abs(info.d) > 4 && Math.abs(info.d) < 16);
        t.check(`${id}: on the street the plan says (${info && info.street})`, !!info && info.street === (id === "lakewood" ? "Minivan Way" : "Avenue K"));
        t.check(`${id}: no other building's door in the way (${info && info.others.join(",")})`, !!info && info.others.filter(k => !/^lot_|^van/.test(k)).length === 0);
        // walk up: it warms, ✋ offers ENTER
        await onFootAtDoor(8);
        await t.frames(30);
        t.check(`${id}: walking up to the door warms the room (a soft cut, not a loading screen)`, await g(`ctx.interiors.cityhall.ready()`));
        await onFootAtDoor(1.2);
        await t.frames(6);
        const p = await promptText();
        t.check(`${id}: ✋ offers ENTER at the door (${JSON.stringify(p).slice(0, 70)})`, /ENTER (CITY|BOROUGH) HALL/i.test(p) || /CITY HALL/.test(p));
        // the building seen from the street (a screenshot)
        await g(`(() => { const sp = ctx.cityhall.spot(); const f = ctx.foot.pos, x = sp.x + sp.nx * 17, z = sp.z + sp.nz * 17; f.set(x, 0.05, z); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f);
          const F = ctx.cam.free; if (F) { F.yaw = Math.atan2(sp.x - sp.nx * 6 - x, sp.z - sp.nz * 6 - z); F.pitch = 0.22; F.idle = 0; } ctx.foot.obj.rotation.y = Math.atan2(-sp.nx, -sp.nz); if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
        await t.frames(40);
        await t.shot(`cityhall-${id}-street`);
        await onFootAtDoor(1.2);
        await W.reset(t);
        await g(`ctx.cityhall.enter()`);
        let black = 0;
        for (let i = 0; i < 40; i++) { await t.frames(1); if ((await curtain()).length) black++; }
        t.check(`${id}: going in shows no black curtain (${black} frames)`, black === 0);
        t.check(`${id}: inside city hall`, await inside());
        t.check(`${id}: named for this town`, await room(`/${id === "lakewood" ? "LAKEWOOD CITY HALL" : "MIDWOOD BOROUGH HALL"}/.test(r.def.title)`));
        await walkOut();
        t.check(`${id}: she's back on the street at city hall's own door`, await g(`(() => { const sp = ctx.cityhall.spot(), p = ctx.foot.pos; return !!sp && Math.hypot(sp.x - p.x, sp.z - p.z) < 7 && ctx.town.active; })()`));
        t.check(`${id}: no black curtain after`, (await curtain()).length === 0);
        await seg(`${id}: in and out of city hall`, ["jump", "nan", "overlay", "stuck", "nocontrol"]);
      });

      // ════ 2. the room: mayor in / out, each window closed in turn ════
      for (const [label, f] of [["mayor in · permits closed", { closed: 0, mayorOut: false }], ["mayor out · taxes closed", { closed: 1, mayorOut: true }], ["complaints closed", { closed: 2, mayorOut: false }]]) {
        await step(`${id} room · ${label}`, async () => {
          if (!await town(id)) return;
          // (hour 10: the mayor's out to lunch 12:00–12:59 by the device's clock — a CI run at noon UTC found him gone)
          await g(`(Object.assign(ctx.cityhall.debug.force, { hour: 10 }, ${JSON.stringify(f)}), ctx.cityhall.debug.RUN.ribbon && ctx.cityhall.debug.endRibbon(), true)`);
          if (!await walkIn()) return;
          const info = await room(`({ people: r.people.map(q => ({ id: q.id, x: q.p.obj.position.x, z: q.p.obj.position.z })), hots: r.hots.filter(h => !h.enabled || h.enabled(r)).map(h => h.id),
            cols: r.cols.map(c => [c.x0, c.x1, c.z0, c.z1]), closed: r.data.V.closed, mayor: r.data.V.mayor, labels: r.hots.filter(h => /^win_/.test(h.id)).map(h => typeof h.label === "function" ? h.label() : h.label) })`);
          t.check(`${id} ${label}: window ${f.closed} is the closed one (${info.labels.join(" / ")})`, info.closed === f.closed && /back in 5/i.test(info.labels[f.closed]) && info.labels.filter(l => /back in 5/i.test(l)).length === 1);
          t.check(`${id} ${label}: two clerks at the open windows`, info.people.filter(q => /^clerk_/.test(q.id)).length === 2);
          t.check(`${id} ${label}: the mayor is ${f.mayorOut ? "out (no mayor, an empty chair)" : "in his office"}`, f.mayorOut ? (!info.mayor && !info.people.some(q => q.id === "mayor")) : (info.mayor && info.people.some(q => q.id === "mayor")));
          t.check(`${id} ${label}: a handful of people (${info.people.length} rigs ≤ 8)`, info.people.length <= 8);
          for (const h of ["ticket", "board", "poster", "secretary", "mayor", "scissors", "win_permits", "win_taxes", "win_complaints"]) t.check(`${id} ${label}: has ${h}`, info.hots.includes(h));
          const bad = info.people.filter(q => !/^wait|^expediter/.test(q.id) && info.cols.some(c => q.x > c[0] - 0.05 && q.x < c[1] + 0.05 && q.z > c[2] - 0.05 && q.z < c[3] + 0.05));
          t.check(`${id} ${label}: nobody stands inside a wall (${bad.map(b => b.id).join(",") || "ok"})`, bad.length === 0);
          const unreachable = await room(`r.hots.filter(h => !h.enabled || h.enabled(r)).filter(h => { const p = r.lulu.obj.position; p.set(h.x, 0, h.z); const x0 = p.x, z0 = p.z; r.collide(p, 0.32); const moved = Math.hypot(p.x - x0, p.z - z0) > 0.06; const near = r.findNear(); return moved || !near || near.id !== h.id; }).map(h => h.id)`);
          t.check(`${id} ${label}: every hot-spot is reachable, standable and the nearest at its own spot (${unreachable.join(",") || "ok"})`, unreachable.length === 0);
          await room(`(r.lulu.obj.position.set(0, 0, 2.0), r.updateCamera(0, true), true)`);
          await t.frames(20);
          const pf = await perf(24);
          console.log(`   PERF cityhall ${id} ${label}`, JSON.stringify(pf));
          t.check(`${id} ${label}: the room stays light (≤ 200 draw calls — the town budget is 240 — and ≤ 80k tris) (${pf.maxCalls} / ${pf.maxTris})`, pf.maxCalls <= 200 && pf.maxTris <= 80000);
          for (const [nm, x] of [["lobby", 0], ["office", -6.0], ["windows", 6.0]]) { await room(`(r.lulu.obj.position.set(${x}, 0, 1.2), r.updateCamera(0, true), true)`); await t.frames(18); if (id === "midwood" || !f.mayorOut) await t.shot(`cityhall-${id}-${nm}${f.mayorOut ? "-out" : ""}`); }
          // using every hot-spot pays / costs nothing (with nothing owed: the Taxes window CAN take a payment — two presses)
          await g(`(ctx.cityhall.tax && (ctx.cityhall.tax.ledger.bills.length = 0), ctx.cityhall.permits && (ctx.cityhall.permits.PM.open.length = 0), true)`);
          const c0 = await coins(), h0 = await g(`ctx.G.hearts`);
          for (const hid of info.hots.filter(h => h !== "door")) {
            await room(`(() => { const h = r.hots.find(h => h.id === ${JSON.stringify(hid)}); r.lulu.obj.position.set(h.x, 0, h.z); if (!h.enabled || h.enabled(r)) r.use(h); return true; })()`);
            await tapThrough(8); await t.frames(8);
          }
          t.check(`${id} ${label}: using every hot-spot (${info.hots.length}) pays / costs nothing (coins ${c0} → ${await coins()})`, await coins() === c0 && await g(`ctx.G.hearts`) === h0);
          await walkOut();
          await g(`(ctx.cityhall.debug.force.closed = null, ctx.cityhall.debug.force.mayorOut = false, ctx.cityhall.debug.force.hour = null, true)`);
          await seg(`${id} ${label}: the visit`, ["jump", "nan", "overlay", "stuck", "nocontrol"]);
        });
      }
    }

    // ════ 3. the take-a-number machine: her number goes up, NOW SERVING stays 37 ════
    await step("ticket", async () => {
      if (!await town("lakewood")) return;
      if (!await walkIn()) return;
      const n0 = await g(`ctx.cityhall.debug.S.ticket`);
      for (let i = 0; i < 3; i++) { await room(`(() => { const h = r.hots.find(h => h.id === "ticket"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`); await drain(); await t.frames(8); }
      t.check(`three pulls: her number went up by 3 (${n0} → ${await g(`ctx.cityhall.debug.S.ticket`)})`, await g(`ctx.cityhall.debug.S.ticket`) === n0 + 3);
      await walkOut();
    });

    // ════ 4. the mayor's ribbon cutting out in town ════
    await step("ribbon", async () => {
      if (!await town("midwood")) return;
      await onFootAtDoor(40);
      await g(`(ctx.cityhall.debug.endRibbon("test"), ctx.cityhall.debug.RB.n = 0, ctx.cityhall.debug.force.ribbonNow = true, true)`);
      await t.until(`!!__lulu3d.ctx.cityhall.ribbon`, "a ribbon cutting starts", 5000);
      await t.frames(20); await W.reset(t);          // (the town switch + the teleport above are the test's, not the game's)
      const r0 = await g(`ctx.cityhall.ribbon`);
      const d = await g(`(() => { const R = ctx.cityhall.ribbon, p = ctx.foot.pos; return R ? Math.hypot(R.x - p.x, R.z - p.z) : -1; })()`);
      t.check(`a ribbon cutting starts up her sidewalk (${r0 && r0.what}, ${d.toFixed ? d.toFixed(1) : d} m away)`, !!r0 && d > 15 && d < 45);
      t.check("…the mayor is out of his office while it's on", await g(`ctx.cityhall.mayorIn() === false`));
      t.check("…it stands on a sidewalk, not a lane", await g(`(() => { const R = ctx.cityhall.ribbon; const n = ctx.world.road.nearest(R.x, R.z, ctx.car.s, {}); return Math.abs(n.d) > (n.street ? n.street.curb : 4) - 0.2; })()`));
      await t.frames(60);
      await t.until(`__lulu3d.ctx.cityhall.debug.RUN.ribbon && __lulu3d.ctx.cityhall.debug.RUN.ribbon.people.length >= 4`, "the mayor + the crowd", 15000);
      // walk to it: ✋ offers the ribbon; hold the ribbon → the snip
      await g(`(() => { const R = ctx.cityhall.debug.RUN.ribbon; const F = ctx.foot.debug.F; F.pos.set(R.x + R.nx * 1.4, 0.05, R.z + R.nz * 1.4); if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      await t.frames(10);
      await t.shot("cityhall-ribbon");
      const p = await promptText();
      t.check(`✋ offers THE RIBBON CUTTING (${JSON.stringify(p).slice(0, 60)})`, /RIBBON/i.test(p));
      const c0 = await coins();
      const ok = await g(`(() => { const sp = ctx.cityhall.debug.RUN.ribbon; return !!sp; })()`);
      if (ok) {
        for (let i = 0; i < 6 && !await g(`ctx.dialogOpen`); i++) { await t.tap(0); await t.frames(3); }
        t.check("…✋ opens the mayor's card", await g(`ctx.dialogOpen`));
        await answer(/Hold the ribbon/); await drain();
      }
      t.check("holding the ribbon → the snip", await t.until(`__lulu3d.ctx.cityhall.ribbon && __lulu3d.ctx.cityhall.ribbon.snipped`, "snipped", 8000));
      t.check(`…it pays nothing (coins ${c0} → ${await coins()})`, await coins() === c0);
      // walk away: it clears; the mayor is back in
      await g(`(() => { const R = ctx.cityhall.debug.RUN.ribbon; const F = ctx.foot.debug.F; F.pos.set(R.x + R.ux * 95, 0.05, R.z + R.uz * 95); if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
      await t.frames(20);
      t.check("walking far away clears it", await t.until(`!__lulu3d.ctx.cityhall.ribbon`, "cleared", 5000));
      t.check("…and the mayor is back", await g(`ctx.cityhall.mayorIn() || new Date().getHours() === 12`));
      await seg("the ribbon cutting", ["jump", "nan", "overlay", "stuck", "nocontrol"]);
    });

    // ════ 5. phone portrait / landscape + TV ════
    await step("layouts", async () => {
      if (!await town("midwood")) return;
      if (!await walkIn()) return;
      for (const [name, w, h, tv] of LAYOUTS) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
        await g(`(ctx.applySettings(), true)`);
        await t.frames(12);
        await room(`(r.lulu.obj.position.set(0, 0, 2.0), r.updateCamera(0, true), true)`);
        await t.frames(10);
        t.check(`${name}: the title chip is on screen`, (await onScreen(".int-title")) === true);
        await t.shot(`cityhall-layout-${name}`);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
      await g(`(ctx.applySettings(), true)`);
      await walkOut();
    });
  },
};
