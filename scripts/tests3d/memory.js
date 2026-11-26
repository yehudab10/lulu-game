// 🧠 A world that remembers Lulu (features/memory):
//   • a real carjack → the driver is remembered (look, name, model, colour) → NOT this run →
//     the next run the same car (same paint, the driver at the wheel) pulls alongside, honks,
//     yells a bubble; it tailgates / calls the cops; the grudge is rate-limited (never two runs
//     in a row) and forgiven after a while;
//   • a cab shift → a fare texts afterwards (ctx.phone.text → a 💬 Messages thread per sender); texts are spaced out;
//   • a 4★ chase → the next run's roadside has the WANTED: LULU billboard (and its variants);
//   • small recognitions (the cop at 3+ arrests, Moishe's colours, the hitchhiker, Avigail) are
//     once-a-run; the save round-trips through a reload and every list is capped; a 🎉 party
//     keeps it personal (no grudge cars / posters in the shared world);
//   • busy-Cruise frame time + draw calls with and without the grudge car + poster on screen.
module.exports = {
  name: "memory",
  query: "&enable=memory",
  save2d: { totalCoins: 800, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 3, offenses: 4, erVisits: 2, stats: { booked: 3, carjacks: 0 }, wanted: [] },
  async run(t) {
    const g = t.game;
    const D = `ctx.memory.debug`;
    const place = (ds, d, v = 0) => g(`(() => { const r = ctx.world.road, s = ctx.car.s + ${ds}, p = r.point(s, ${d}, {});
        ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = ${d}; ctx.car.vx = Math.sin(p.h) * ${v}; ctx.car.vz = Math.cos(p.h) * ${v}; return s; })()`);
    const newRun = async label => {
      await g(`L3.setState("title")`);
      await t.frames(3);
      await g(`L3.startRun({ mode: "cruise" })`);
      return t.until(`__lulu3d.state === "playing"`, label || "a new run starts", 60000);
    };
    // every memory event lands in window.__mem
    await t.L(`import("./js/core/ctx.js").then(m => { window.__mem = []; for (const n of ["memory:grudge", "memory:billboard", "streets:carjack"]) m.on(n, e => window.__mem.push([n, e])); })`);
    const events = name => t.L(`window.__mem.filter(e => e[0] === "${name}").map(e => e[1])`);

    t.check("ctx.memory service: grudges · notoriety() · remember() · recall() · recognize()",
      await g(`!!ctx.memory && Array.isArray(ctx.memory.grudges) && ["notoriety", "remember", "recall", "recognize", "spawnGrudge"].every(k => typeof ctx.memory[k] === "function")`));
    const n0 = await g(`ctx.memory.notoriety()`);
    t.check("notoriety reads the shared save (3 arrests, 2 ER visits)", n0.arrests === 3 && n0.er === 2 && n0.level >= 1, JSON.stringify(n0));
    t.check("the WANTED design is registered with banter (never random)", await g(`!!ctx.banter && ctx.banter.staticAds().indexOf("memWanted") < 0`));

    // ── 🎉 party: personal only ────────────────────────────────────────────
    const partyOff = await g(`(() => { const N = ctx.party._debug.N, was = N.want; N.want = true;
        const r = { enabled: ctx.enabled("memory"), live: ${D}.live(), line: ctx.memory.recognize("cop") };
        N.want = was; return r; })()`);
    // (memory is PERSONAL in a party: it records + talks, but no grudge car / WANTED billboard in the shared world)
    t.check("a 🎉 party: memory on but personal (no world surprises)", partyOff.enabled && !partyOff.live, JSON.stringify(partyOff));
    t.check("party/index.js no longer keeps memory / banter in its OFF set", await t.L(`fetch("./js/features/party/index.js").then(r => r.text()).then(s => { const m = /const OFF = new Set\\(\\[([^\\]]*)\\]/.exec(s); return !!m && !/"memory"/.test(m[1]) && !/"banter"/.test(m[1]) && /"journey"/.test(m[1]); })`));     // (anchor: Story mode stays off with friends — streets went on in party round 2)

    // ── 😤 1. a real carjack → remembered ───────────────────────────────────
    await g(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    const runs1 = await g(`ctx.memory.runs`);
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.law && ctx.law.hold(120), true)`);
    await g(`ctx.foot.start("droveOff")`);
    let jacked = false;
    if (await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "on foot", 60000)) {
      await t.until(`!!__lulu3d.ctx.streets`, "streets is up");
      await g(`(() => { const F = ctx.foot.debug.F; const c = ctx.traffic.add("sedan", F.s + 9, 5.25, 1, 0); c.want = 0; c.base = 0; window.__victim = c;
        const p = ctx.world.road.point(c.s + 0.1, 5.25 - 1.6, {}); F.pos.set(p.x, 0, p.z); return true; })()`);
      await t.frames(4);
      jacked = await g(`ctx.streets.carjack(window.__victim)`);
      t.check("Lulu carjacks a sedan", jacked);
      if (jacked) await t.until(`__lulu3d.state === "playing"`, "…and drives off in it", 30000);
    }
    const ev = (await events("streets:carjack"))[0];
    t.check("streets:carjack carries the driver's look", !!(ev && ev.driver && /npc(Man|Woman)/.test(ev.driver.key) && ev.driver.colors && ev.driver.colors.Top), JSON.stringify(ev));
    let rec = (await g(`ctx.memory.recall("grudge")`))[0];
    t.check("the carjacked driver is remembered (name, look, model, colour, run)",
      !!(rec && rec.name && rec.key && rec.kind === "sedan" && /^#[0-9a-f]{6}$/i.test(rec.color || "") && rec.run === runs1), JSON.stringify(rec));
    t.check("…but not in the SAME run", (await g(`${D}.eligible().length`)) === 0);

    // ── 😤 2. the next run: the grudge car pulls alongside and yells ───────
    if (!await newRun("next run")) return;
    t.check("next run: the grudge is ripe", (await g(`${D}.eligible().length`)) === 1);
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ${D}.knobs.always = true, ${D}.knobs.act = "tailgate", ctx.banter.autopilot = { d: 1.75, speed: 22 }, true)`);
    await place(0, 1.75, 22);
    await g(`(${D}.GR.sched = 0.5, true)`);
    await t.until(`!!__lulu3d.ctx.memory.debug.GR.enc && !!__lulu3d.ctx.memory.debug.GR.enc.car`, "the grudge car shows up in traffic", 30000);
    const enc = await g(`(() => { const E = ${D}.GR.enc, c = E.car; let paint = null; c.obj.traverse(o => { if (o.isMesh && o.material.name === "Paint") paint = "#" + o.material.color.getHexString(); });
        return { kind: c.kind, paint, person: !!(E.person && E.person.obj.parent === c.obj), rel: c.s - ctx.car.s, d: c.d }; })()`);
    t.check("same model + same paint + the same driver at the wheel", enc.kind === rec.kind && enc.paint === rec.color.toLowerCase() && enc.person, JSON.stringify(enc));
    t.check("it creeps up from behind in the next lane", enc.rel < -10 && Math.abs(enc.d - 5.25) < 0.6, JSON.stringify(enc));
    t.check("memory:grudge fired", (await events("memory:grudge")).length === 1);
    await t.until(`(() => { const E = __lulu3d.ctx.memory.debug.GR.enc; return E && E.phase !== "approach"; })()`, "it pulls alongside", 40000);
    await t.frames(4);
    const yell = await g(`({ line: ${D}.GR.enc.lastLine, rel: ${D}.GR.enc.car.s - ctx.car.s, bubble: [...document.querySelectorAll("#banterBubbles .bn-npc:not(.hide)")].map(b => b.textContent).join(" | ") })`);
    t.check("alongside: it honks and yells a speech bubble", !!yell.line && yell.bubble.includes(yell.line.slice(0, 12)) && Math.abs(yell.rel) < 4, JSON.stringify(yell));
    await t.shot("grudge-alongside");
    await t.until(`(() => { const E = __lulu3d.ctx.memory.debug.GR.enc; return E && E.phase === "tailgate" && E.said.tg; })()`, "…then drops back and TAILGATES her", 40000);
    await t.frames(10);
    const tg = await g(`({ rel: ${D}.GR.enc.car.s - ctx.car.s, dd: Math.abs(${D}.GR.enc.car.d - ctx.car.d) })`);
    t.check("tailgating: right behind her, in her lane, never inside her", tg.rel < -6 && tg.rel > -16 && tg.dd < 1, JSON.stringify(tg));
    await t.shot("grudge-tailgate");
    await t.until(`!__lulu3d.ctx.memory.debug.GR.enc || __lulu3d.ctx.memory.debug.GR.enc.phase === "leave"`, "…and drives off", 40000);
    // the call to the cops (a second visit, forced)
    await g(`(${D}.GR.enc && ctx.traffic.remove(${D}.GR.enc.car), ctx.memory.spawnGrudge(null, { act: "cops", behind: 12 }), true)`);
    await t.until(`(() => { const E = __lulu3d.ctx.memory.debug.GR.enc; return E && E.said && E.said.called; })()`, "a grudge calls the cops", 40000);
    // (a phone call, not a cop on her bumper: law's call-in — a cruiser comes looking later)
    t.check("…a call-in (📞 REPORTED), no instant chase", await g(`!ctx.law || (ctx.law.reported && !ctx.law.chasing)`), String(await g(`ctx.law && [ctx.law.reported, ctx.law.chasing]`)));
    await g(`(ctx.law && ctx.law.clearHeat(""), true)`);
    await t.frames(4);
    rec = (await g(`ctx.memory.recall("grudge")`))[0];
    t.check("the visit is remembered (seen, lastRun)", rec && rec.seen === 2 && rec.lastRun === await g(`ctx.memory.runs`), JSON.stringify(rec));

    // rate limit: never two runs in a row
    await g(`(${D}.knobs.always = false, ${D}.knobs.act = null, ctx.banter.autopilot = null, true)`);
    if (!await newRun("run 3")) return;
    t.check("rate limit: not two runs in a row (nothing scheduled)", (await g(`${D}.eligible().length`)) === 0 && (await g(`${D}.GR.sched`)) < 0);
    // a third visit and the grudge moves on (forgive)
    if (!await newRun("run 4")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.banter.autopilot = { d: 1.75, speed: 22 }, true)`);
    await place(0, 1.75, 22);
    await g(`ctx.memory.spawnGrudge(null, { act: "forgive", behind: 14 })`);
    await t.until(`(() => { const E = __lulu3d.ctx.memory.debug.GR.enc; return E && E.said && E.said.fg; })()`, "a grudge forgives her", 40000);
    t.check("forgiven: the grudge is gone", (await g(`ctx.memory.grudges.length`)) === 0);
    await t.shot("grudge-forgive");
    await g(`(ctx.banter.autopilot = null, ${D}.GR.enc && ctx.traffic.remove(${D}.GR.enc.car), true)`);

    // ── 📱 3. a cab shift → a fare texts later ──────────────────────────────
    await g(`(${D}.knobs.always = true, ctx.memory.debug.M.texts.length = 0, true)`);
    await g(`ctx.hustle.start("cab", { fares: ["groom", "influencer", "chicken"] })`);
    t.check("a cab shift starts", await g(`!!ctx.hustle.job && ctx.hustle.job.id === "cab"`));
    // (the hustle test drives a whole shift; here: two fares carried, then the shift ends)
    await g(`(() => { const j = ctx.hustle.job; j.i = 2; j.names = ["🤵", "🤳"]; j.paid = 2; return ctx.hustle.end("pass", "shift"); })()`);
    const q = await g(`ctx.memory.recall("texts")`);
    t.check("the shift queues follow-up texts from the fares it carried", q.length === 2 && q.every(x => /^(Mendel \(the groom\)|@LuxeLeah)$/.test(x.from)), JSON.stringify(q.map(x => [x.from, x.run])));
    await t.until(`__lulu3d.state === "hustleResult"`, "the result card", 20000);
    await t.tap(0);
    await t.until(`__lulu3d.state === "playing"`, "back to driving", 20000);
    const sent0 = await g(`${D}.TX.sent`);
    await g(`(${D}.TX.cool = 0, ${D}.M.texts.forEach(x => { x.run = ctx.memory.runs; x.after = 0; }), true)`);
    await t.until(`!!document.querySelector(".jtext")`, "a fare texts Lulu (ctx.phone.text)", 20000);
    const tx = await t.L(`document.querySelector(".jtext").textContent`);
    t.check("…the groom's wedding photo / @LuxeLeah's tag", /Mendel|LuxeLeah/.test(tx), tx);
    // (the names go in as a JSON list: a regex's \( inside this template string would lose its backslash)
    t.check("…a passing bubble only: it doesn't fill the phone's 💬 Messages (ci/hud — filler is never kept)", await g(`!ctx.phone.inbox || !ctx.phone.inbox.threads().some(th => ${JSON.stringify(["Mendel (the groom)", "@LuxeLeah"])}.includes(th.title))`),
      JSON.stringify(await g(`ctx.phone.inbox ? ctx.phone.inbox.threads().map(th => th.title) : null`)));
    await t.frames(10);
    await t.shot("cab-text");
    await t.frames(20);
    t.check("rate limit: the next text waits (≥ 40 s apart)", (await g(`${D}.TX.sent`)) === sent0 + 1 && (await g(`${D}.M.texts.length`)) === 1);
    t.check("a text never goes out during a job / chase / on foot", await g(`(() => { ${D}.TX.cool = 0; ctx.law && ctx.law.startChase("TEST", { heat: 1 }); return true; })()`));
    await t.frames(10);
    t.check("…(still waiting while the cops chase her)", (await g(`${D}.TX.sent`)) === sent0 + 1);
    await g(`(ctx.law && ctx.law.clearHeat(""), true)`);

    // ── 🪧 4. a 4★ chase → the WANTED billboard next run ────────────────────
    await g(`ctx.law.startChase("RECKLESS DRIVING", { heat: 4 })`);
    await t.frames(6);
    await g(`(ctx.law.clearHeat(""), true)`);
    await t.frames(3);
    const owed = await g(`ctx.memory.recall("poster")`);
    t.check("a 4★ chase owes her a WANTED poster", !!owed && owed.heat >= 4 && owed.left === 2, JSON.stringify(owed));
    if (!await newRun("next run (poster)")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    t.check("next run: a poster is booked for this run", await g(`${D}.PS.want || !!${D}.PS.booked`));
    await t.until(`!!__lulu3d.ctx.memory.debug.PS.booked`, "the spot is booked past the built road", 20000);
    const bs = await g(`${D}.PS.booked.s`);
    for (let k = 0; k < 8 && !(await g(`!!${D}.PS.placed`)); k++) { await place(Math.min(150, bs - 70 - (await g(`ctx.car.s`))), 1.75, 0); await t.frames(6); }
    await t.until(`!!__lulu3d.ctx.memory.debug.PS.placed`, "the billboard is hung when its chunk is built", 30000);
    const bb = await events("memory:billboard");
    t.check("memory:billboard fired; banter shows the board", bb.length === 1 && (await g(`ctx.banter.activeBillboards().some(b => /^mem/.test(b.key))`)), JSON.stringify(bb));
    await place((await g(`${D}.PS.placed.s`)) - 42 - (await g(`ctx.car.s`)), 1.75, 0);
    await t.frames(30);
    await t.shot("wanted-billboard");
    // the faces themselves, full size (banter paints them; we save the canvas)
    if (process.argv.includes("--shots")) {
      const fs = require("fs"), path = require("path");
      for (const v of ["wanted", "honk", "free"]) {
        const url = await t.L(`import("./js/features/banter/ads.js").then(m => { const M = __lulu3d.ctx.memory.debug; M.PS.variant = "${v}"; const t = m.adTexture(M.posterDesign()); const c = t.image; return c.toDataURL ? c.toDataURL("image/png") : null; })`);
        if (url) fs.writeFileSync(path.join(__dirname, "..", "..", "smoke-shots", `3d-memory-face-${v}.png`), Buffer.from(url.split(",")[1], "base64"));
      }
    }
    const des = await g(`(${D}.PS.variant = "wanted", ${D}.posterDesign())`);
    t.check("WANTED: LULU · REWARD: 36 COINS AND A KUGEL · MUGSHOTS ON FILE", /WANTED: LULU/.test(des.head) && /36 COINS AND A KUGEL/.test(des.sub) && /MUGSHOTS ON FILE: 3/.test(des.strip || ""), JSON.stringify([des.head, des.sub, des.strip]));
    t.check("it evolves with notoriety (honk + fan-made FREE LULU unlocked)", JSON.stringify(await g(`${D}.variants()`)) === JSON.stringify(["wanted", "honk", "free"]));
    for (const v of ["free", "honk"]) {
      await place(140, 1.75, 0);
      await t.frames(4);
      await g(`ctx.memory.poster(40, -1, "${v}")`);
      await t.frames(20);
      await t.shot("billboard-" + v);
    }
    // two runs, then the poster comes down
    if (!await newRun("run +2")) return;
    t.check("the poster shows again the run after", await g(`${D}.PS.want || !!${D}.PS.booked`));
    if (!await newRun("run +3")) return;
    t.check("…and then it's gone", await g(`!${D}.PS.want && !${D}.PS.booked && !ctx.memory.recall("poster")`));

    // ── 👀 5. recognitions (rate-limited) ───────────────────────────────────
    await g(`(${D}.knobs.always = false, true)`);
    const cop = await g(`(${D}.knobs.always = true, ctx.memory.recognize("cop"))`);
    t.check("the cop at the window: \"Oh, it's YOU again\" (3 arrests)", /Oh, it's YOU again/.test(cop), cop);
    await g(`(${D}.knobs.always = false, true)`);
    t.check("rate limit: once a run", (await g(`ctx.memory.recognize("cop")`)) === "");
    await g(`(L3.emit("streets:paint", { cost: 30, color: "Bubbe's Plum" }), true)`);
    await g(`(${D}.knobs.always = true, true)`);
    const moishe = await g(`ctx.memory.recognize("moishe", { color: "Bubbe's Plum" })`);
    t.check("Moishe remembers the colour (\"… again? Bold.\")", /Bubbe's Plum AGAIN|Bubbe's Plum again/.test(moishe), moishe);
    await g(`ctx.memory.recognize("hitch", { event: "pass" })`);
    const hitch = await g(`ctx.memory.recognize("hitch", { event: "pick" })`);
    t.check("the hitchhiker remembers being left behind", /NOW you stop|drove RIGHT past/.test(hitch), hitch);
    const avi = await g(`ctx.memory.recognize("avigailRoad")`);
    t.check("Avigail's taunt knows Lulu's record", !!avi, avi);
    const porch = await g(`ctx.memory.recognize("avigailPorch")`);
    t.check("…and so does Avigail's door", /police|HELICOPTER|news|car|ER/.test(porch), porch);
    await g(`(${D}.M.avi = {}, ${D}.M.last.aviText = -1, true)`);
    await g(`(L3.setState("title"), true)`);
    await t.frames(2);
    await g(`L3.startRun({ mode: "cruise" })`);
    await t.until(`__lulu3d.state === "playing"`, "run (avigail)");
    t.check("Avigail texts about the news (her own Messages thread)", await g(`ctx.memory.recall("texts").some(x => x.from === "Avigail" && !x.thread)`));
    await g(`(${D}.knobs.always = false, true)`);

    // ── 📉 perf: busy Cruise (a fixed set of traffic), with / without the grudge car + poster ──
    if (!await newRun("perf run")) return;
    await g(`(() => { ctx.traffic.config.enabled = false; ctx.traffic.clear(); ctx.banter.autopilot = { d: 1.75, speed: 24 };
        const s = ctx.car.s; for (let i = 0; i < 10; i++) ctx.traffic.add(["sedan", "van", "truck"][i % 3], s + 30 + i * 24, i % 2 ? -1.75 : 5.25, i % 2 ? -1 : 1, i % 2 ? 18 : 23);
        return true; })()`);
    await place(0, 1.75, 24);
    const perf = async label => {
      await t.frames(20);
      return g(`new Promise(res => { const r = ctx.renderer, f0 = L3.frames, t0 = performance.now(); let calls = 0, tris = 0, n = 0;
        const tick = () => { calls += r.info.render.calls; tris += r.info.render.triangles; n++; if (L3.frames - f0 >= 45) res({ label: "${label}", ms: +((performance.now() - t0) / (L3.frames - f0)).toFixed(1), calls: Math.round(calls / n), tris: Math.round(tris / n), cars: ctx.traffic.cars.length });
          else requestAnimationFrame(tick); }; requestAnimationFrame(tick); })`);
    };
    const before = await perf("busy cruise");
    await g(`(() => { ctx.memory.remember("grudge", { kind: "van", color: "#7E57C2", driver: { key: "npcWoman", colors: { Top: "#F06292" } } });
        ctx.memory.debug.M.grudges.forEach(r => r.run = -5); ctx.memory.poster(70, -1, "wanted"); ctx.memory.spawnGrudge(null, { act: "yell", behind: 4 }); return true; })()`);
    await t.until(`!!(__lulu3d.ctx.memory.debug.GR.enc && __lulu3d.ctx.memory.debug.GR.enc.car)`, "perf: grudge car on screen", 30000);
    const after = await perf("busy cruise + grudge car + WANTED poster");
    console.log(`  perf: ${JSON.stringify(before)}  →  ${JSON.stringify(after)}`);
    t.check("perf: the grudge car + poster cost about one more traffic car", after.calls - before.calls <= 30, `${before.calls} → ${after.calls} draw calls`);
    await t.shot("perf-grudge-poster");
    // a brake-check: overtakes, cuts in ahead with room to spare, taps the brakes, no hearts lost
    await g(`(ctx.traffic.clear(), ${D}.GR.enc = null, true)`);
    const hearts0 = await g(`ctx.G.hearts`);
    await g(`ctx.memory.spawnGrudge(null, { act: "brakecheck", behind: 8 })`);
    if (await t.until(`(() => { const E = __lulu3d.ctx.memory.debug.GR.enc; return E && E.said && E.said.bc; })()`, "a grudge brake-checks her", 40000)) {
      const bc = await g(`({ rel: ${D}.GR.enc.car.s - ctx.car.s, dd: Math.abs(${D}.GR.enc.car.d - ctx.car.d) })`);
      t.check("brake-check: cut in AHEAD, in her lane, with room", bc.rel > 8 && bc.dd < 1, JSON.stringify(bc));
      await t.shot("grudge-brakecheck");
      await t.until(`!__lulu3d.ctx.memory.debug.GR.enc || __lulu3d.ctx.memory.debug.GR.enc.phase === "leave"`, "…and speeds off", 30000);
      t.check("…no hearts lost", (await g(`ctx.G.hearts`)) === hearts0);
    }
    await g(`(ctx.banter.autopilot = null, true)`);

    // ── 💾 6. caps + the save round trip ────────────────────────────────────
    await g(`(() => { for (let i = 0; i < 10; i++) ctx.memory.remember("grudge", { kind: "sedan", color: "#123456", name: "Test " + i });
        for (let i = 0; i < 12; i++) ctx.memory.remember("pothole", { i });
        for (let i = 0; i < 9; i++) ctx.memory.text({ from: "T", msg: "m" + i }, { next: true });
        for (let i = 0; i < 20; i++) ctx.memory.remember("kind" + i, { i }); return true; })()`);
    const caps = await g(`({ g: ctx.memory.grudges.length, last: ctx.memory.grudges[5].name, texts: ctx.memory.recall("texts").length, kinds: Object.keys(${D}.M.log).length })`);
    t.check("caps: 6 grudges (oldest dropped), 6 texts, 16 kinds", caps.g === 6 && caps.last === "Test 9" && caps.texts === 6 && caps.kinds <= 16, JSON.stringify(caps));
    const runsNow = await g(`ctx.memory.runs`);
    await g(`(${D}.save(), true)`);
    await g(`L3.setState("title")`);
    await t.boot();
    const back = await g(`({ runs: ctx.memory.runs, g: ctx.memory.grudges.length, last: ctx.memory.grudges[5] && ctx.memory.grudges[5].name, hitch: ctx.memory.recall("hitch"), paint: ctx.memory.recall("paint").length, maxStars: ${D}.M.maxStars })`);
    t.check("the save round-trips through a reload", back.runs === runsNow && back.g === 6 && back.last === "Test 9" && back.hitch.passes === 1 && back.hitch.picks === 1 && back.paint === 1 && back.maxStars >= 4, JSON.stringify(back));
  },
};
