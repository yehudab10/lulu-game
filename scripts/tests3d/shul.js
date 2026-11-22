// 🕍 The shul (features/shul, roadmap 18): a walk-in shul in each town — Lakewood's (the Carpool Lane yeshiva building)
// and Midwood's (Young Israel of East 15½ St). The ✋ door (warmed as she walks up → a soft cut, never a black screen),
// the room (women's section → lobby → kiddush room; the men's hall seen through the lattice), what's going on by the clock +
// the calendar (weekday · Friday · Shabbos davening / kiddush / afternoon · a fast · Yom Kippur · Chanukah), the lollipop
// (once a real day, pays nothing), nothing pays, nobody stands in a wall, the draw calls, phone portrait / landscape + TV,
// and — when cheap — two friends inside together (the room is in together/rooms.js SHARED).
const W = require("../lib/qawatch.js");

const LAYOUTS = [["desktop", 1280, 720, false], ["phone-portrait", 390, 844, false], ["phone-landscape", 844, 390, false], ["tv", 1920, 1080, true]];
module.exports = {
  name: "shul",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,seasons",
  save2d: { totalCoins: 2000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
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
    const onFootAtDoor = async (out = 1.2) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
      await g(`(() => { const sp = ctx.shul.spot(); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${out}, 0.05, sp.z + sp.nz * ${out}); F.phase = "walk"; return true; })()`);
      await t.frames(6);
    };
    const curtain = () => t.L(`(() => { const o = []; for (const id of ["townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && +getComputedStyle(e).opacity > 0.4) o.push(id); } return o; })()`);
    const walkIn = async () => {
      await onFootAtDoor();
      await W.reset(t);
      await g(`ctx.shul.enter()`);
      return t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "shul"`, "inside the shul", 60000);
    };
    const walkOut = async () => {
      await g(`(window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back out of the shul (footRun)", 30000);
      await t.frames(20);
    };
    const kinds = { weekday: `ctx.seasons.debug.season("none")`, friday: `ctx.seasons.debug.season("friday")`, davening: `(ctx.seasons.debug.season("shabbos"), ctx.shul.debug.force.hour = 9)`,
      kiddush: `(ctx.seasons.debug.season("shabbos"), ctx.shul.debug.force.hour = 13)`, afternoon: `(ctx.seasons.debug.season("shabbos"), ctx.shul.debug.force.hour = 16)`,
      fast: `ctx.seasons.debug.season("tzomGedaliah")`, yk: `ctx.seasons.debug.season("yomKippur")`, chanukah: `ctx.seasons.debug.season("chanukah", 5)` };

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

    t.check("ctx.shul service + the interior exist", await g(`!!(ctx.shul && ctx.shul.enter && ctx.interiors.shul)`));
    t.check("the town keeps the room (bank.js TOWN_INTERIORS)", await t.L(`fetch("js/features/heist/bank.js").then(r => r.text()).then(s => /TOWN_INTERIORS = new Set\\(\\[[^\\]]*"shul"/.test(s))`));
    t.check("friends share the room (together/rooms.js SHARED)", await t.L(`fetch("js/features/together/rooms.js").then(r => r.text()).then(s => /SHARED = \\{[\\s\\S]*?\\bshul:/.test(s))`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await W.install(t);

    const QUIET_OK = ["quiet", "rebb", "shelf", "hats", "memorial", "candy", "table", "saver", "menorah", "regs"];
    for (const id of ["lakewood", "midwood"]) {
      // ════ 1. the door: ✋ offered, warmed, a soft cut in and out ════
      await step(`${id} door`, async () => {
        if (!await town(id)) return;
        t.check(`${id}: the shul's door is a spot on a sidewalk beside a street`, await g(`(() => { const sp = ctx.shul.spot(); if (!sp) return false; const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {}); return Math.abs(n.d) > 4 && Math.abs(n.d) < 16; })()`));
        await g(`ctx.seasons.debug.season("none")`);
        await onFootAtDoor(8);
        await t.frames(30);
        t.check(`${id}: walking up to the door warms the room (a soft cut, not a loading screen)`, await g(`ctx.interiors.shul.ready()`));
        await onFootAtDoor(1.2);
        await t.frames(6);
        await W.reset(t);
        const p = await promptText();
        t.check(`${id}: ✋ offers ENTER THE SHUL at the door (${JSON.stringify(p).slice(0, 70)})`, /ENTER THE SHUL/i.test(p) || /SHUL/.test(p));
        await seg(`${id}: walking up to the shul`, ["jump", "nan", "overlay", "stuck"]);
        await g(`ctx.shul.enter()`);
        let black = 0;
        for (let i = 0; i < 40; i++) { await t.frames(1); if ((await curtain()).length) black++; }
        t.check(`${id}: going in shows no black curtain (${black} frames)`, black === 0);
        t.check(`${id}: inside the shul`, await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "shul"`, "inside", 30000));
        t.check(`${id}: named for this town`, await room(`r.def.name === ctx.shul.debug.def.name && /${id === "lakewood" ? "Carpool Lane" : "Young Israel"}/i.test(r.def.title)`));
        t.check(`${id}: she comes in by the women's entrance (the women's section, not the men's hall)`, await room(`(() => { const p = r.lulu.obj.position; return p.x > -1.6 && p.x < 3.4; })()`));
        await walkOut();
        await t.frames(20);
        t.check(`${id}: she's back on the street at the shul's own door`, await g(`(() => { const sp = ctx.shul.spot(), p = ctx.foot.pos; return !!sp && Math.hypot(sp.x - p.x, sp.z - p.z) < 7 && ctx.town.active; })()`));
        t.check(`${id}: no black curtain after`, (await curtain()).length === 0);
        await seg(`${id}: in and out of the shul`, ["jump", "nan", "overlay", "stuck", "nocontrol"]);
      });

      // ════ 2. what's going on, by the clock + the calendar ════
      for (const kind of ["weekday", "friday", "davening", "kiddush", "afternoon", "fast", "yk", "chanukah"]) {
        await step(`${id} ${kind}`, async () => {
          if (!await town(id)) return;
          await g(`(ctx.shul.debug.force.hour = null, ${kinds[kind]}, true)`);
          await W.reset(t);
          if (!await walkIn()) return;
          const info = await room(`({ kind: r.data.P.kind, chanukah: r.data.P.chanukah, people: r.people.map(q => ({ id: q.id, x: q.p.obj.position.x, z: q.p.obj.position.z })), hots: r.hots.filter(h => !h.enabled || h.enabled(r)).map(h => h.id),
            cols: r.cols.map(c => [c.x0, c.x1, c.z0, c.z1]), crowd: r.data.V.crowd, lit: r.data.V.menorahLit || 0, hats: !!r.data.V.hats })`);
          const want = kind === "chanukah" ? "weekday" : kind;
          t.check(`${id} ${kind}: the clock + calendar say "${want}" (got ${info.kind})`, info.kind === want || (kind === "chanukah" && ["weekday", "friday", "davening", "kiddush", "afternoon"].includes(info.kind)));
          t.check(`${id} ${kind}: a handful of people (${info.people.length} rigs ≤ 8)`, info.people.length <= 8);
          t.check(`${id} ${kind}: the hundred hats are on the rack`, info.hats);
          if (kind === "chanukah") t.check(`${id}: the menorah by the door has 5 nights + the helper lit (${info.lit})`, info.lit === 6);
          if (kind === "davening" || kind === "yk") {
            t.check(`${id} ${kind}: people are davening — only quiet things to do (${info.hots.join(",")})`, info.hots.every(h => QUIET_OK.includes(h) || h === "door"));
            t.check(`${id} ${kind}: the hall is full (${info.crowd.men} men)`, info.crowd.men >= 20);
          }
          if (kind === "weekday") t.check(`${id}: weekday — the gabbai looking for a tenth is there`, info.hots.includes("gabbai"));
          if (kind === "friday") t.check(`${id}: Friday — someone setting up`, info.hots.includes("setup"));
          if (kind === "kiddush") t.check(`${id}: kiddush — the regulars + the seat-saver + a crowd (${info.crowd.standing} standing)`, info.hots.includes("regs") && info.hots.includes("saver") && info.crowd.standing >= 15);
          // nobody stands inside a wall / the furniture
          const bad = info.people.filter(q => info.cols.some(c => q.x > c[0] - 0.05 && q.x < c[1] + 0.05 && q.z > c[2] - 0.05 && q.z < c[3] + 0.05));
          t.check(`${id} ${kind}: nobody stands inside a wall (${bad.map(b => b.id).join(",") || "ok"})`, bad.length === 0);
          // every hotspot she can use is somewhere she can stand, and ✋ reaches it
          const unreachable = await room(`r.hots.filter(h => !h.enabled || h.enabled(r)).filter(h => { const p = r.lulu.obj.position; const w = h.track && h.who && r.byId[h.who]; if (w) return false; p.set(w ? w.p.obj.position.x : h.x, 0, w ? w.p.obj.position.z : h.z); const x0 = p.x, z0 = p.z; r.collide(p, 0.32); const moved = Math.hypot(p.x - x0, p.z - z0) > 0.06; const near = r.findNear(); return moved || !near; }).map(h => h.id)`);
          t.check(`${id} ${kind}: every hot-spot is reachable and standable (${unreachable.join(",") || "ok"})`, unreachable.length === 0);
          await room(`(r.lulu.obj.position.set(0.5, 0, 3.4), r.updateCamera(0, true), true)`);
          await t.frames(20);
          const pf = await perf(24);
          console.log(`   PERF shul ${id} ${kind}`, JSON.stringify(pf));
          t.check(`${id} ${kind}: the room is a handful of draw calls (≤ 130) and light (≤ 70k tris) (${pf.maxCalls} / ${pf.maxTris})`, pf.maxCalls <= 130 && pf.maxTris <= 70000);
          if (id === "midwood" || kind === "kiddush") await t.shot(`shul-${id}-${kind}`);
          if (id === "midwood" && (kind === "kiddush" || kind === "friday")) { await room(`(r.lulu.obj.position.set(7.0, 0, 0.5), r.updateCamera(0, true), true)`); await t.frames(25); await t.shot(`shul-${id}-${kind}-table`); }
          await walkOut();
          await seg(`${id} ${kind}: the visit`, ["jump", "nan", "overlay", "stuck", "nocontrol"]);
        });
      }
    }

    // ════ 3. the candy man's lollipop (once a real day) + nothing pays ════
    await step("lollipop", async () => {
      if (!await town("midwood")) return;
      for (const kind of ["weekday", "davening", "fast"]) {
        await g(`(ctx.shul.debug.force.hour = null, ctx.shul.debug.SAVE.lastPop = "", ctx.shul.debug.SAVE.pops = 0, ctx.shul.debug.force.dayKey = "test-day-1", ${kinds[kind]}, true)`);
        if (!await walkIn()) return;
        const c0 = await coins(), h0 = await g(`ctx.G.hearts`), s0 = await g(`ctx.G.score || 0`);
        const use = async () => { await room(`(() => { const h = r.hots.find(h => h.id === "candy"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`); await tapThrough(14); await t.frames(30); };
        await use();
        const pops = () => g(`ctx.shul.debug.SAVE.pops`);
        if (kind === "fast") {
          t.check(`fast day: the candy man declines (pops ${await pops()})`, await pops() === 0 && await g(`ctx.shul.poppedToday === false`));
        } else {
          t.check(`${kind}: ONE lollipop (pops ${await pops()})`, await pops() === 1 && await g(`ctx.shul.poppedToday`));
          t.check(`${kind}: …she's holding it`, await room(`!!r.data.pop`));
          await use(); await use();
          t.check(`${kind}: …but only one a real day (pops ${await pops()} after two more asks)`, await pops() === 1);
          await g(`(ctx.shul.debug.force.dayKey = "test-day-2", true)`);
          await use();
          t.check(`${kind}: …tomorrow there's another (pops ${await pops()})`, await pops() === 2);
        }
        t.check(`${kind}: the lollipop pays nothing (coins ${c0} → ${await coins()}, hearts ${h0} → ${await g(`ctx.G.hearts`)})`, await coins() === c0 && await g(`ctx.G.hearts`) === h0 && await g(`(ctx.G.score || 0)`) === s0);
        await walkOut();
      }
      // everything else in the room: use every hot-spot once — nothing is paid
      await g(`(ctx.shul.debug.force.hour = null, ctx.shul.debug.force.dayKey = "test-day-3", ctx.seasons.debug.season("friday"), true)`);
      if (!await walkIn()) return;
      const c0 = await coins(), h0 = await g(`ctx.G.hearts`);
      const ids = await room(`r.hots.map(h => h.id).filter(i => i !== "door")`);
      for (const hid of ids) {
        await room(`(() => { const h = r.hots.find(h => h.id === ${JSON.stringify(hid)}); r.lulu.obj.position.set(h.x, 0, h.z); if (!h.enabled || h.enabled(r)) r.use(h); return true; })()`);
        await tapThrough(10); await t.frames(10);
      }
      t.check(`using every hot-spot (${ids.length}: ${ids.join(",")}) pays / costs nothing (coins ${c0} → ${await coins()}, hearts ${h0} → ${await g(`ctx.G.hearts`)})`, await coins() === c0 && await g(`ctx.G.hearts`) === h0);
      t.check("…and the aron, bimah, benches and the hats are not hot-spots (nothing holy is interactive)", await room(`!r.hots.some(h => /aron|bimah|torah|bench|parochet|siddur/i.test(h.id))`));
      await walkOut();
      await g(`(ctx.shul.debug.force.dayKey = null, true)`);
    });

    // ════ 4. phone portrait / landscape + TV ════
    await step("layouts", async () => {
      if (!await town("midwood")) return;
      await g(`(${kinds.weekday}, true)`);
      if (!await walkIn()) return;
      for (const [name, w, h, tv] of LAYOUTS) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
        await g(`(ctx.applySettings(), true)`);
        await t.frames(12);
        await room(`(r.lulu.obj.position.set(0.5, 0, 3.4), r.updateCamera(0, true), true)`);
        await t.frames(10);
        t.check(`${name}: the title chip is on screen`, (await onScreen(".int-title")) === true);
        const chip = await onScreen(".int-hint");
        t.check(`${name}: the hint chip is on screen (or gone after a few seconds)`, chip === true || chip === "absent");
        await room(`(() => { const h = r.hots.find(h => h.id === "rebb"); r.lulu.obj.position.set(h.x, 0, h.z); return true; })()`);
        await t.frames(8);
        const pr = await onScreen("#slot-bottom .prompt");
        t.check(`${name}: the ✋ prompt is on screen (${pr})`, pr === true || pr === "absent");
        t.check(`${name}: she is in the picture (not scrolled out of the camera)`, await room(`(() => { const v = r.lulu.obj.position.clone().setY(1).project(r.set.camera); return Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95; })()`));
        await t.shot(`shul-layout-${name}`);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
      await g(`(ctx.applySettings(), true)`);
      await walkOut();
    });
  },
};
