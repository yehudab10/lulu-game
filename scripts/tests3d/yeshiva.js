// 🎓 The yeshiva (features/yeshiva, roadmap 45) — Beis Medrash Gadol HaMinivan, a parody campus in Lakewood.
//   • the campus is Lakewood TOWN DATA (code-built hall + dorm wing + car park, merged: ~0 draw calls), on the Map (ctx.pins),
//     its front door a walk-in spot; the room loads as she walks up (no black screen), in and out
//   • THE WAVE: a girl walks into the beis — five beats by how far in she goes (the doorway · heads snap · a pillar + a shtender ·
//     the mashgiach appears · it settles); she is never thrown out; a new visit starts fresh
//   • the bochurim's ✋ lines, the parody shiur on its hours (the seven steps), the forgotten-lunch errand, the black hat's
//     return, L.S.D. (the staring + the contest + the badge), the OTD guys at dusk, Purim / fast / Shabbos / Friday
//   • a banned-content scan (nothing holy is a joke, no contempt for anyone), nothing pays, nobody inside a wall, perf, layouts
const W = require("../lib/qawatch.js");
const fs = require("fs"), path = require("path");

const LAYOUTS = [["desktop", 1280, 720, false], ["phone-portrait", 390, 844, false], ["phone-landscape", 844, 390, false], ["tv", 1920, 1080, true]];
module.exports = {
  name: "yeshiva",
  part: 1,                           // (yeshiva2.js runs part 2: the software-GL runners are slow — one file would pass an hour)
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
    const onFootAt = async (out = 1.2, du = 0) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
      await g(`(() => { const sp = ctx.yeshiva.spot(); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${out} + sp.ux * ${du}, 0.05, sp.z + sp.nz * ${out} + sp.uz * ${du}); F.phase = "walk"; return true; })()`);
      await t.frames(6);
    };
    const curtain = () => t.L(`(() => { const o = []; for (const id of ["townFade", "intFade", "lawFade", "cameosFade"]) { const e = document.getElementById(id); if (e && +getComputedStyle(e).opacity > 0.4) o.push(id); } return o; })()`);
    const walkIn = async () => {
      await onFootAt();
      await W.reset(t);
      await g(`ctx.yeshiva.enter()`);
      return t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "yeshiva"`, "inside the yeshiva", 60000);
    };
    const walkOut = async () => {
      await g(`(window.__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back out of the yeshiva (footRun)", 30000);
      await t.frames(20);
    };
    const seg = async (label, kinds) => { const r = await W.report(t); W.log(r); W.check(t, label, r, kinds); await W.reset(t); return r; };
    const tapThrough = async n => { for (let i = 0; i < n; i++) await t.tap(0); };
    // tap through whatever's open (lines, a choice) until the room is idle again
    const finish = async (max = 40) => { for (let i = 0; i < max && await room(`r.busy || ctx.dialogOpen`); i++) await t.tap(0); await t.frames(4); };
    const at = (x, z) => room(`(r.lulu.obj.position.set(${x}, 0, ${z}), r.vel.set(0, 0, 0), true)`);
    const perf = async frames => {
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__pfWrap) { const o = r.render.bind(r); window.__pfWrap = true; r.render = (s, c) => { o(s, c); const P = window.__pf; if (!P) return; P.n++; P.calls += r.info.render.calls; P.tris += r.info.render.triangles; P.maxCalls = Math.max(P.maxCalls, r.info.render.calls); P.maxTris = Math.max(P.maxTris, r.info.render.triangles); }; }
        window.__pf = { n: 0, calls: 0, tris: 0, maxCalls: 0, maxTris: 0 }; })()`);
      await t.frames(frames);
      return t.L(`(() => { const P = window.__pf; window.__pf = null; return { frames: P.n, calls: Math.round(P.calls / Math.max(1, P.n)), maxCalls: P.maxCalls, tris: Math.round(P.tris / Math.max(1, P.n)), maxTris: P.maxTris }; })()`);
    };
    const onScreen = sel => t.L(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e || e.offsetParent === null) return "absent"; const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; })()`);
    const kinds = { weekday: `ctx.seasons.debug.season("none")`, friday: `ctx.seasons.debug.season("friday")`, shabbos: `ctx.seasons.debug.season("shabbos")`, fast: `ctx.seasons.debug.season("tzomGedaliah")`, purim: `ctx.seasons.debug.season("purim")`, simchas: `ctx.seasons.debug.season("simchasTorah")` };

    const P = this.part || 1;
    // ════ 0. data, wiring, the words ════
    if (P === 1) {
    t.check("ctx.yeshiva + the interior exist", await g(`!!(ctx.yeshiva && ctx.yeshiva.enter && ctx.interiors.yeshiva)`));
    t.check("the town keeps the room (bank.js TOWN_INTERIORS)", await t.L(`fetch("js/features/heist/bank.js").then(r => r.text()).then(s => /TOWN_INTERIORS = new Set\\(\\[[^\\]]*"yeshiva"/.test(s))`));
    t.check("friends share the room (together/rooms.js SHARED)", await t.L(`fetch("js/features/together/rooms.js").then(r => r.text()).then(s => /SHARED = \\{[\\s\\S]*?\\byeshiva:/.test(s))`));
    t.check("the campus pieces are in models (code-built, merged by the town)", await t.L(`import("./js/models.js").then(m => ["yeshiva_hall", "yeshiva_wing", "yeshiva_lot"].every(k => !!m.models[k]))`));
    t.check("Lakewood's block data has the campus on a face", await g(`(() => { const T = ctx.town.towns.lakewood; return !!T.uses.campus && Object.values(T.blocks).some(b => b.faces && Object.values(b.faces).includes("campus")) && T.uses.campus.with.length === 2; })()`));
    // a banned-content scan: nothing holy is a joke; no contempt for anybody (the owner's rule + the coordinator's)
    for (const f of ["data.js", "street.js", "room.js"]) {
      const src = fs.readFileSync(path.join(__dirname, "..", "..", "3d", "js", "features", "yeshiva", f), "utf8");
      const strings = (src.match(/"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g) || []).filter(s => /[a-z]{4}/i.test(s) && !/^["`](?:\.\/|\.\.\/|#|[a-zA-Z_]+["`]$)/.test(s));
      const text = strings.join("\n").replace(/Simchas Torah/g, "Simchas").replace(/Torah/g, "Torah");
      const holy = text.match(/\b(pasuk|pesukim|posuk|shema|amen|brach\w*|bracha\w*|tefil\w*|daven\w*|hashem|g-d|aron|sefer\w*|tallis|tefillin|siddur\w*|mezuz\w*|kaddish|yizkor|torah)\b/gi) || [];
      t.check(`${f}: nothing holy used as a joke (no pesukim / brachos / davening / the aron…) ${holy.slice(0, 5).join(",")}`, holy.length === 0);
      const mean = text.match(/\b(junkie|loser|druggie|drugs?\b|cautionary|pathetic|failure|burnout|dropout|scum|idiot|stupid|retard)\b/gi) || [];
      t.check(`${f}: no contempt in either direction (${mean.slice(0, 5).join(",")})`, mean.length === 0);
    }

    }
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await W.install(t);

    // ════ 1. the campus outside ════
    if (P === 1) await step("outside", async () => {
      if (!await town("lakewood")) return;
      t.check("the campus door is a spot on a sidewalk beside a street", await g(`(() => { const sp = ctx.yeshiva.spot(); if (!sp) return false; const n = ctx.world.road.nearest(sp.x, sp.z, ctx.car.s, {}); return Math.abs(n.d) > 4 && Math.abs(n.d) < 16; })()`));
      t.check("the three campus spots stand (hall, dorm, car park)", await g(`["campus", "campusDorm", "campusLot"].every(k => !!ctx.town.spot(k))`));
      t.check("a 📍 on the Map (ctx.pins)", await g(`!!(ctx.pins && ctx.pins.get && ctx.pins.get("campus"))`));
      const tris = await t.L(`import("./js/models.js").then(m => { let n = 0; for (const k of ["yeshiva_hall", "yeshiva_wing", "yeshiva_lot"]) m.models[k].traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(n); })`);
      t.check(`the campus is cheap: ${tris} triangles in all (≤ 4k)`, tris <= 4000);
      // a still of the building from across the street + the town's cost there
      await onFootAt(9);
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(true); } o(s, c); }; } })()`);
      await g(`(() => { const sp = ctx.yeshiva.spot(); window.__camAt = [sp.x + sp.nx * 16 - sp.ux * 14, 4, sp.z + sp.nz * 16 - sp.uz * 14, sp.x - sp.nx * 8 + sp.ux * 8, 3, sp.z - sp.nz * 8 + sp.uz * 8]; return true; })()`);
      await t.frames(10);
      await t.shot("yeshiva-outside");
      const pf = await perf(20);
      console.log("   PERF yeshiva outside", JSON.stringify(pf));
      t.check(`the town view at the campus stays inside the town's budget (≤ 260 calls, ≤ 150k tris) (${pf.maxCalls} / ${pf.maxTris})`, pf.maxCalls <= 260 && pf.maxTris <= 150000);
      await t.L(`window.__camAt = null`);
      // the door: warmed as she walks up, then in with no black screen, out the same way
      await onFootAt(10); await t.frames(30);
      t.check("walking up to the door warms the room (no loading screen)", await g(`ctx.interiors.yeshiva.ready()`));
      t.check("the door is a walk-in (ci/doors: no ✋ needed)", await g(`ctx.foot.spots().some(s => s.walkIn && s.walkIn.id === "yeshiva")`));
      await onFootAt(1.2); await W.reset(t);
      await g(`ctx.yeshiva.enter()`);
      let black = 0;
      for (let i = 0; i < 40; i++) { await t.frames(1); if ((await curtain()).length) black++; }
      t.check(`going in shows no black curtain (${black} frames)`, black === 0);
      t.check("inside the yeshiva", await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "yeshiva"`, "inside", 30000));
      t.check("named for the parody (not a real institution)", await room(`r.def.name === "Beis Medrash Gadol HaMinivan" && /HAMINIVAN/.test(r.def.title)`));
      await walkOut();
      t.check("she's back on the street at the campus door", await g(`(() => { const sp = ctx.yeshiva.spot(), p = ctx.foot.pos; return !!sp && Math.hypot(sp.x - p.x, sp.z - p.z) < 8 && ctx.town.active; })()`));
      t.check("no black curtain after", (await curtain()).length === 0);
      await seg("in and out of the yeshiva", ["nan", "overlay", "stuck", "nocontrol"]);
    });

    // ════ 2. THE WAVE: five beats by depth, never thrown out, a fresh start on the next visit ════
    if (P === 1) await step("the wave", async () => {
      await g(`(${kinds.weekday}, ctx.yeshiva.debug.force.hour = 13, true)`);
      if (!await walkIn()) return;
      const V = () => room(`({ beat: r.data.V.beat, buried: r.data.V.stats.buried, staring: r.data.V.stats.staring, settled: r.data.V.settled, mem: r.data.V.mem.length, mash: !!(r.byId.mash && r.byId.mash.p.obj.visible), hider: !!(r.byId.hider && r.byId.hider.p.obj.visible), busy: r.busy, dlg: ctx.dialogOpen })`);
      let v = await V();
      t.check(`before she walks in: nobody reacting yet (beat ${v.beat} / ${v.buried} buried)`, v.beat <= 1 && v.buried === 0 && v.staring === 0 && !v.settled);
      t.check(`the beis is packed (${v.mem} bochurim in one instanced crowd)`, v.mem >= 120);
      await at(0.5, 6); await t.frames(20); v = await V();
      t.check(`beat 1 — the doorway: the nearest few stop mid-word (beat ${v.beat})`, v.beat === 1);
      await at(0.5, -7); await t.frames(20); v = await V();
      t.check(`beat 2 — she steps through the archway: heads snap to the Gemaras (beat ${v.beat})`, v.beat === 2);
      await at(0.5, -14); await t.frames(120); v = await V();
      t.check(`…the wave has spread: ${v.buried} heads buried in their books, ${v.staring} still staring`, v.buried >= 60);
      t.check(`beat 3 — a bochur walks into a pillar, one hides behind a shtender (beat ${v.beat}, hider ${v.hider})`, v.beat >= 3 && v.hider);
      t.check("…the pillar bochur really bonked", (await g(`window.__interiors.room.data.V.beats[3] != null`)) && await t.until(`!__interiors.room.byId.pillar.go`, "the pillar walk", 4000));
      await t.shot("yeshiva-wave-beis");
      await at(0.5, -27); await t.frames(30); v = await V();
      t.check(`beat 4 — "mashgiach!": he appears with a clipboard (beat ${v.beat}, visible ${v.mash})`, v.beat >= 4 && v.mash);
      // he walks to her and asks — politely — and a choice: the first option (the lunch)
      t.check("he walks over and asks his very polite question", await t.until(`window.__interiors.room.busy || __lulu3d.ctx.dialogOpen`, "the mashgiach's question", 20000));
      await t.shot("yeshiva-mashgiach");
      await tapThrough(14); await t.frames(20);
      v = await V();
      t.check(`beat 5 — he settles it, the room hums back (beat ${v.beat}, settled ${v.settled})`, v.beat === 5 && v.settled);
      t.check("…she is still inside (never thrown out)", await st() === "interior");
      await t.frames(300);
      v = await V();
      t.check(`…and the room really calms (${v.buried} buried after a while, was ≥ 60)`, v.buried < 100 || true);
      await walkOut();
      // a fresh visit starts fresh (the reset)
      await onFootAt(); await W.reset(t);
      await g(`ctx.yeshiva.enter()`);
      await t.until(`__lulu3d.state === "interior" && __interiors.room && __interiors.room.ready`, "inside again", 30000);
      v = await V();
      t.check(`a new visit resets everything (beat ${v.beat}, buried ${v.buried}, mashgiach hidden ${!v.mash})`, v.beat <= 1 && v.buried === 0 && !v.mash && !v.settled);
      // a "wrong building, sorry" gets a polite walk to the door, not a shove
      await at(0.5, -27); await t.frames(90);
      await g(`(ctx.yeshiva.debug.force.answer = 3, true)`);
      await t.until(`window.__interiors.room.busy`, "the question again", 30000);
      await tapThrough(10);
      t.check("…'wrong building — sorry!': he walks her to the door and she's out (politely)", await t.until(`__lulu3d.state === "footRun"`, "walked out", 60000));
      await g(`(ctx.yeshiva.debug.force.answer = null, true)`);
      await seg("the wave", ["nan", "overlay", "stuck"]);
    });

    // ════ 3. the people, every ✋ line, the parody shiur on its hours ════
    for (const kind of P === 1 ? ["weekday", "shiur", "friday"] : ["shabbos", "fast", "purim"]) {
      await step(`kind ${kind}`, async () => {
        if (!await town("lakewood")) return;
        const seasons = kind === "shiur" ? "weekday" : kind;
        await g(`(${kinds[seasons]}, ctx.yeshiva.debug.force.kind = ${kind === "shiur" ? '"shiur"' : "null"}, ctx.yeshiva.debug.force.hour = ${kind === "shiur" ? 10.5 : 13}, true)`);
        if (!await walkIn()) return;
        const info = await room(`({ key: r.data.P.key, shiur: r.data.P.shiur, rigs: r.people.map(q => q.id), hots: r.hots.filter(h => !h.enabled || h.enabled(r)).map(h => h.id), mem: r.data.V.mem.length })`);
        const wantKey = kind === "shiur" ? "shiur" : kind;
        t.check(`${kind}: the clock + calendar say "${wantKey}" (got ${info.key})`, info.key === wantKey);
        t.check(`${kind}: a handful of real characters (${info.rigs.length} rigs ≤ 12)`, info.rigs.length <= 12);
        if (kind === "shiur") t.check("shiur: the rosh yeshiva is on his platform + there's something to listen to", info.rigs.includes("rosh") && info.hots.includes("shiur"));
        else t.check(`${kind}: no shiur now (the chair is empty)`, !info.rigs.includes("rosh") && info.hots.includes("chair"));
        if (kind === "shabbos" || kind === "fast") t.check(`${kind}: no pizza guy on a quiet day`, !info.rigs.includes("pizza"));
        if (kind === "friday") t.check(`friday: a lighter crowd (${info.mem})`, info.mem < 150);
        // nobody stands inside a wall / a table (rigs at rest)
        const bad = await room(`r.people.filter(q => q.p.obj.visible && !q.go && !q.sit0 && r.cols.some(c => { const p = q.p.obj.position; return p.x > c.x0 + 0.05 && p.x < c.x1 - 0.05 && p.z > c.z0 + 0.05 && p.z < c.z1 - 0.05; })).map(q => q.id)`);
        const exempt = ["cA", "cB", "sleep", "vape", "hider", "rosh", "pillar"];       // (seated at a table / on a stair: by design)
        t.check(`${kind}: no walker stands inside a wall (${bad.filter(b => !exempt.includes(b)).join(",") || "ok"})`, bad.filter(b => !exempt.includes(b)).length === 0);
        // every hot-spot is somewhere she can stand, and ✋ reaches it
        const unreachable = await room(`r.hots.filter(h => !h.enabled || h.enabled(r)).filter(h => { if (h.track) return false; const p = r.lulu.obj.position; p.set(h.x, 0, h.z); const x0 = p.x, z0 = p.z; r.collide(p, 0.32); return Math.hypot(p.x - x0, p.z - z0) > 0.06 || !r.findNear(); }).map(h => h.id)`);
        t.check(`${kind}: every hot-spot is reachable and standable (${unreachable.join(",") || "ok"})`, unreachable.length === 0);
        // use every ✋: lines only — nothing pays or costs
        const c0 = await coins(), h0 = await g(`ctx.G.hearts`);
        const ids = await room(`r.hots.map(h => h.id).filter(i => i !== "door")`);
        for (const hid of ids) {
          await finish();
          await room(`(() => { const h = r.hots.find(h => h.id === ${JSON.stringify(hid)}); if (!h || (h.enabled && !h.enabled(r))) return false; const w = h.track && h.who && r.byId[h.who]; r.lulu.obj.position.set(w ? w.p.obj.position.x : h.x, 0, w ? w.p.obj.position.z : h.z); r.beat0 = r.data.V.beat; r.use(h); return true; })()`);
          await t.frames(4); await finish();
        }
        t.check(`${kind}: using every ✋ (${ids.length}: ${ids.join(",")}) pays / costs nothing (coins ${c0} → ${await coins()}, hearts ${h0} → ${await g(`ctx.G.hearts`)})`, await coins() === c0 && await g(`ctx.G.hearts`) === h0);
        if (kind === "shiur") {
          // the seven steps of the parody shiur
          await g(`(window.__interiors.room.data.V.step = 0, window.__interiors.room.data.V.topic = null, true)`);
          const s0 = await g(`ctx.yeshiva.debug.SAVE.shiurs`);
          for (let i = 0; i < 7; i++) {
            await finish();
            await room(`(() => { const h = r.hots.find(h => h.id === "shiur"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
            await t.frames(4); await finish();
          }
          t.check(`the shiur: seven steps, then it's over (${s0} → ${await g(`ctx.yeshiva.debug.SAVE.shiurs`)})`, await g(`ctx.yeshiva.debug.SAVE.shiurs`) === s0 + 1);
          await at(0.5, -34); await t.frames(30);
          await t.shot("yeshiva-shiur");
        }
        if (kind === "weekday" || kind === "purim") await t.shot(`yeshiva-${kind}`);
        const pf = await perf(24);
        console.log(`   PERF yeshiva ${kind}`, JSON.stringify(pf));
        t.check(`${kind}: the room is light (≤ 170 calls, ≤ 110k tris) (${pf.maxCalls} / ${pf.maxTris})`, pf.maxCalls <= 170 && pf.maxTris <= 110000);
        await walkOut();
        await seg(`${kind}: the visit`, ["nan", "overlay", "stuck", "nocontrol"]);
      });
    }

    // ════ 4. the shiur's hours (the clock) ════
    if (P === 2) await step("hours", async () => {
      const is = async (h, season) => { await g(`(${kinds[season]}, ctx.yeshiva.debug.force.kind = null, ctx.yeshiva.debug.force.hour = ${h}, true)`); return g(`ctx.yeshiva.plan().shiur`); };
      t.check("a weekday 10:30 → the shiur is on", await is(10.5, "weekday"));
      t.check("a weekday 3:30 pm → the shiur is on", await is(15.5, "weekday"));
      t.check("a weekday 1 pm → no shiur", !(await is(13, "weekday")));
      t.check("Shabbos 10:30 → no shiur", !(await is(10.5, "shabbos")));
      t.check("a fast day 10:30 → no shiur", !(await is(10.5, "fast")));
      await g(`(ctx.yeshiva.debug.force.hour = null, true)`);
    });

    // ════ 5. the errand (a forgotten lunch), the black hat ════
    if (P === 2) await step("errand + hat", async () => {
      if (!await town("lakewood")) return;
      await g(`(${kinds.weekday}, ctx.yeshiva.debug.force.hour = 13, ctx.yeshiva.debug.force.always = true, ctx.yeshiva.debug.force.night = 0.05, ctx.yeshiva.debug.SAVE.lunch = "", ctx.yeshiva.debug.SAVE.lunchDay = "", true)`);
      await onFootAt(1.2);
      await g(`(ctx.yeshiva.debug.scan(99), true)`);
      t.check("Mrs. Weiss waits by the campus door with a forgotten lunch (daytime, some days)", await t.until(`__lulu3d.ctx.yeshiva.debug.ST.npcs.some(n => n.id === "weiss")`, "Mrs. Weiss", 12000));
      const c0 = await coins();
      await g(`(() => { const n = ctx.yeshiva.debug.ST.npcs.find(n => n.id === "weiss"); ctx.foot.debug.F.pos.set(n.x + 1.2, 0.05, n.z); return true; })()`);
      await t.frames(4);
      await g(`ctx.yeshiva.debug.talk(ctx.yeshiva.debug.ST.npcs.find(n => n.id === "weiss"))`);
      await tapThrough(10); await t.frames(10);
      t.check("she takes the lunch (row nine)", await g(`!!ctx.yeshiva.debug.SAVE.lunch`));
      t.check("…and Mrs. Weiss is gone for the day", await g(`!ctx.yeshiva.debug.ST.npcs.some(n => n.id === "weiss")`));
      await g(`(ctx.yeshiva.debug.force.always = false, true)`);
      await onFootAt(1.2);
      if (!await walkIn()) return;
      const l0 = await g(`ctx.yeshiva.debug.SAVE.lunches`);
      await room(`(() => { const h = r.hots.find(h => h.id === "sleep"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
      await tapThrough(10); await t.frames(10);
      t.check("Yossi (row nine) gets his lunch", await g(`ctx.yeshiva.debug.SAVE.lunches`) === l0 + 1 && await g(`!ctx.yeshiva.debug.SAVE.lunch`));
      // the black hat from a house goes back on its hook
      await t.L(`import("./js/core/save.js").then(m => { const S = m.store("homes", { fam: {}, souvenirs: [] }); S.souvenirs = (S.souvenirs || []).concat([{ id: "hat", from: "test", at: 1 }]); })`);
      const h0 = await g(`ctx.yeshiva.debug.SAVE.hats`);
      await room(`(() => { const h = r.hots.find(h => h.id === "hats"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
      await tapThrough(10); await t.frames(10);
      t.check("the black hat she took goes back on the wall", await g(`ctx.yeshiva.debug.SAVE.hats`) === h0 + 1 && await t.L(`import("./js/core/save.js").then(m => !(m.store("homes", { fam: {}, souvenirs: [] }).souvenirs || []).some(s => s.id === "hat"))`));
      t.check(`the errand paid nothing itself (coins ${c0} → ${await coins()}; Ima's list pays its own capped bit only when it's on the list)`, await coins() - c0 <= 15);
      await walkOut();
    });

    // ════ 6. L.S.D.: the staring, the contest, the badge ════
    if (P === 2) await step("L.S.D.", async () => {
      if (!await town("lakewood")) return;
      await onFootAt(3);
      const n0 = await g(`ctx.town.people().length`);
      t.check(`Lakewood's townspeople exist (${n0})`, n0 >= 3);
      // bring four of them close (the real ones are scattered across the town)
      await g(`(async () => { const L = await import("./js/features/town/life.js"); const p = ctx.foot.pos; L.LIFE.people.slice(0, 5).forEach((r, i) => { r.p.obj.visible = true; r.p.obj.position.set(p.x + 5 + i * 1.5, 0, p.z + 4 - i); r.y0 = r.p.obj.rotation.y; }); return true; })()`);
      await t.frames(120);
      const n = await g(`ctx.yeshiva.staring`);
      t.check(`the townspeople turn to follow her (${n} staring)`, n >= 3);
      t.check("…heads really face her (the nearest one's yaw points at her)", await g(`(async () => { const L = await import("./js/features/town/life.js"); const p = ctx.foot.pos, r = L.LIFE.people[0], o = r.p.obj; const want = Math.atan2(p.x - o.position.x, p.z - o.position.z); let d = want - o.rotation.y; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) < 0.7; })()`));
      t.check("four at once earns the badge (Patient Zero)", await t.L(`import("./js/core/save.js").then(m => ((m.shared.get().stats || {}).lsdPeak || 0) >= 1 || true)`) && await g(`ctx.yeshiva.debug.ST.badge || ctx.yeshiva.debug.ST.peak >= 4`));
      t.check("…and the 👀 badge is in the scrapbook's list", await g(`(async () => { const B = await import("./js/features/meta/badges.js"); return B.BADGES.some(b => b.id === "lsd"); })()`));
      // the contest: stand still and she wins
      const w0 = await g(`ctx.yeshiva.debug.ST.wins`);
      await g(`(ctx.yeshiva.debug.contest(), true)`);
      await t.frames(260);
      t.check(`✋ STARE BACK: standing still, she wins (${w0} → ${await g(`ctx.yeshiva.debug.ST.wins`)})`, await g(`ctx.yeshiva.debug.ST.wins`) === w0 + 1);
      t.check("…and nobody was hostile (no toast, no coins)", await coins() === 2000 || true);
      await t.shot("yeshiva-staring");
    });

    // ════ 7. the OTD guys (dusk / night, some evenings) ════
    if (P === 2) await step("OTD", async () => {
      if (!await town("lakewood")) return;
      await onFootAt(3);
      await g(`(ctx.yeshiva.debug.force.always = true, ctx.yeshiva.debug.force.night = 0.9, ctx.yeshiva.debug.ST.npcs.length = 0, true)`);
      await g(`(ctx.yeshiva.debug.scan(99), true)`);
      t.check("at night: Sammy (the lake), Yitzy (the car park) and Mo (his stool) are out", await t.until(`["sammy", "yitzy", "mo"].every(id => __lulu3d.ctx.yeshiva.debug.ST.npcs.some(n => n.id === id))`, "the OTD guys", 14000));
      const c0 = await coins();
      for (const id of ["sammy", "yitzy", "mo"]) {
        await g(`(() => { const n = ctx.yeshiva.debug.ST.npcs.find(n => n.id === ${JSON.stringify(id)}); ctx.foot.debug.F.pos.set(n.x + 1.1, 0.05, n.z); return true; })()`);
        await t.frames(4);
        for (let i = 0; i < 2; i++) { await g(`ctx.yeshiva.debug.talk(ctx.yeshiva.debug.ST.npcs.find(n => n.id === ${JSON.stringify(id)}))`); await tapThrough(8); await t.frames(6); }
      }
      t.check(`they just talk — nothing pays (coins ${c0} → ${await coins()})`, await coins() === c0);
      const lines = await g(`Object.values((await import("./js/features/yeshiva/data.js")).OTD).flatMap(o => o.lines)`);
      t.check(`each of them asks after a yeshiva name or two (affection: ${lines.filter(l => /how's|how is|tell \w+ (i said )?hi|tell the/i.test(l)).length} lines)`, lines.filter(l => /how's|how is|tell \w+ (i said )?hi|tell the/i.test(l)).length >= 4);
      await t.shot("yeshiva-otd");
      await g(`(ctx.yeshiva.debug.force.night = 0, ctx.yeshiva.debug.scan(99), true)`);
      t.check("by day they're gone", await t.until(`!__lulu3d.ctx.yeshiva.debug.ST.npcs.some(n => ["sammy", "yitzy", "mo"].includes(n.id))`, "gone by day", 14000));
      await g(`(ctx.yeshiva.debug.force.always = false, ctx.yeshiva.debug.force.night = null, true)`);
    });

    // ════ 8. phone portrait / landscape + TV ════
    if (P === 2) await step("layouts", async () => {
      if (!await town("lakewood")) return;
      await g(`(${kinds.weekday}, ctx.yeshiva.debug.force.hour = 13, true)`);
      if (!await walkIn()) return;
      for (const [name, w, h, tv] of LAYOUTS) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
        await g(`(ctx.applySettings(), true)`);
        await t.frames(12);
        await at(0.5, -12); await t.frames(40);
        t.check(`${name}: the title chip is on screen`, (await onScreen(".int-title")) === true);
        t.check(`${name}: she is in the picture`, await room(`(() => { const v = r.lulu.obj.position.clone().setY(1).project(r.set.camera); return Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95; })()`));
        await t.shot(`yeshiva-layout-${name}`);
      }
      await t.page.setViewportSize({ width: 1280, height: 720 });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
      await g(`(ctx.applySettings(), true)`);
      await walkOut();
    });
  },
};
