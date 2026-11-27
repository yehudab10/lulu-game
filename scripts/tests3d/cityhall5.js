// 🏛️ City hall roadmap 38 — the owner's two parodies (features/cityhall wrongaddress.js / comment.js / parodyday.js):
//   THE DAY RULES (a whole year, pure): each on about WRONG_ADDRESS.rate / COMMENT_NIGHT.rate of the eligible days, the same
//   for every friend (a hash of the date); never on Shabbos, a Friday, Yom Tov or a fast (the evening one never on the eve
//   of one); a week doesn't repeat (the shop, the people, the signs, the cranks' lines rotate) · THE WORDS: no banned word
//   anywhere (the conflict's words, real slogans, flags as emoji, a hashed slur list) and the premise ("land in Israel")
//   only on the flyer + its explanation · 🪧 THE WRONG ADDRESS in Midwood: a small crowd on the sidewalk, the shop's door
//   clear, ✋ at it, buying costs the shop's price exactly (never below 0), the chant / talk / picture pay nothing, no texts,
//   one by one they go in for lunch → packed up for the day · 🎤 PUBLIC COMMENT NIGHT in Lakewood City Hall: two cranks,
//   their neighbours, Pothole Phil, the mic → the vote (deferred), nothing pays, the windows still work; not on a Friday.
const W = require("../lib/qawatch.js");

const SLUR_HASHES = ["dc08ae09", "dbaaaa0e", "45bd3c79", "d2e583be", "f01478b3", "20603511", "d7200eed", "32d2fa6f", "fd84968f", "13b9aeb4", "f729446a",
  "2ef6335b", "f3d231f7", "2c97da77", "71da786d", "e9afdc03", "121ac38d", "a4705559", "6d6111e", "d9eb56dd", "1414e96a", "b5eaf25b", "36c9c3b0", "f6a4b84e",
  "f9603045", "955b3ec5", "b1f8089d", "883eef41", "2428a2b8", "540a2bea", "cbedab6c", "6b7a2c6e", "5d735a9f"];
const BANNED = ["palestin", "zionis", "genocide", "intifada", "hamas", "jihad", "apartheid", "from the river", "nazi", "coloniz", "colonis", "settler", "idf",
  "occupation", "free free", "\u{1F1EE}\u{1F1F1}", "\u{1F1F5}\u{1F1F8}", "war ", "bomb", "terror"];

module.exports = {
  name: "cityhall5",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cityhall,phone,community,places,foot,shops",
  save2d: { totalCoins: 200, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const PART = (process.env.CH5_PART || "").split(",").filter(Boolean);
    const step = async (label, fn) => { if (PART.length && !PART.includes(label)) return; try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); }
      if (process.env.CH5_LOG) console.log(`    [${label}]`, JSON.stringify(await g(`({ wa: ctx.cityhall.parody.WAS.log.slice(-8), cn: ctx.cityhall.parody.CNS.log.slice(-6) })`))); };
    const st = () => g(`L3.state`);
    const P = `ctx.cityhall.parody`;
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const setCoins = n => t.L(`import("./js/core/save.js").then(m => { const c = m.wallet.coins; if (c > ${n}) m.wallet.spend(c - ${n}); else m.wallet.add(${n} - c); return m.wallet.coins; })`);
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
    const onFoot = async () => { if (await st() !== "footRun") { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 8000); } };
    const footAt = async (x, z) => { await onFoot(); await g(`(() => { const F = ctx.foot.debug.F; F.pos.x = ${x}; F.pos.z = ${z}; F.vel.set(0, 0, 0); F.lulu.obj.position.set(F.pos.x, 0, F.pos.z); if (window.__qa) { window.__qa.cutF = ctx.frames + 6; window.__qa.last = null; } return true; })()`); await t.frames(6); };
    const promptText = () => t.L(`((document.querySelector("#slot-bottom .prompt") || {}).textContent || "") + " | " + ((document.getElementById("tx_foot_hand") || {}).textContent || "")`);
    const opts = () => t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
    async function answer(re, done = null, max = 120) {
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
    const drain = async (n = 16) => { for (let i = 0; i < n && await g(`ctx.dialogOpen`); i++) { if ((await opts()).length) return; await t.tap(0); await t.frames(2); } };
    const inside = () => t.until(`__lulu3d.state === "interior" && __interiors.room && __interiors.room.ready && __interiors.room.def.id === "cityhall"`, "inside city hall", 60000);

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.cityhall.debug.RB.next = 1e9, ctx.cityhall.debug.force.protest = false, ctx.cityhall.debug.force.noDing = true, ctx.law.hold(9999), true)`);
    await W.install(t);

    // ════ the day rules (pure, a whole year) ════
    await step("rules", async () => {
      const r = await t.L(`Promise.all([import("./js/features/cityhall/parodyday.js"), import("./js/features/seasons/calendar.js"), import("./js/features/cityhall/data.js")]).then(([D, C, X]) => {
        const out = { days: 0, elig: { wa: 0, pcn: 0 }, on: { wa: 0, pcn: 0 }, both: 0, bad: [] };
        const holy = d => { const h = C.hebrewOf(d); if (!h) return false; const ids = C.classify(h.m, h.d, d.getDay()); return C.isYomTov(h.m, h.d) || ids.some(i => C.DAYS[i] && /fast|solemn/.test(C.DAYS[i].kind)); };
        for (let k = 0; k < 365; k++) {
          const d = new Date(2027, 0, 1 + k, 12), wd = d.getDay(), next = new Date(2027, 0, 2 + k, 12);
          out.days++;
          const wa = D.dayOn("wa", d), pcn = D.dayOn("pcn", d);
          if (!D.quietDay(d)) out.elig.wa++;
          if (!D.quietDay(d, true)) out.elig.pcn++;
          if (wa) out.on.wa++; if (pcn) out.on.pcn++; if (wa && pcn) out.both++;
          if ((wa || pcn) && (wd === 5 || wd === 6 || holy(d))) out.bad.push(D.dayKey(d) + (wa ? " wa" : " pcn"));
          if (pcn && holy(next)) out.bad.push(D.dayKey(d) + " pcn (eve)");
        }
        out.yk = { wa: D.dayOn("wa", new Date(2027, 9, 11, 12)), pcnEve: D.dayOn("pcn", new Date(2027, 9, 10, 12)) };
        out.rates = { wa: X.WRONG_ADDRESS.rate, pcn: X.COMMENT_NIGHT.rate };
        // a week doesn't repeat
        const wk = []; const pk = [];
        for (let k = 0; k < 7; k++) { const d = new Date(2027, 2, 1 + k, 12); const a = window.__lulu3d.ctx.cityhall.parody.waPlan(d); wk.push(a.shop + "|" + a.ids.join(",") + "|" + a.signs.map(s => s[0]).join(",")); const b = window.__lulu3d.ctx.cityhall.parody.pcnPlan(d); pk.push(b.script.map(s => s[1]).join("|")); }
        out.weekWa = new Set(wk).size; out.weekPcn = new Set(pk).size;
        return out;
      })`);
      const fw = r.on.wa / r.elig.wa, fp = r.on.pcn / r.elig.pcn;
      t.check(`each is one number in data.js (rate ${r.rates.wa} / ${r.rates.pcn})`, r.rates.wa === 0.5 && r.rates.pcn === 0.5);
      t.check(`🪧 the wrong address: ${r.on.wa} of ${r.elig.wa} eligible days (${(fw * 100).toFixed(0)} %) ≈ the rate`, fw > 0.38 && fw < 0.62, JSON.stringify(r));
      t.check(`🎤 public comment night: ${r.on.pcn} of ${r.elig.pcn} eligible days (${(fp * 100).toFixed(0)} %) ≈ the rate`, fp > 0.38 && fp < 0.62);
      t.check(`never on Shabbos, a Friday, Yom Tov, a fast (or, at night, the eve of one) — a year checked`, r.bad.length === 0, r.bad.slice(0, 6).join(" · "));
      t.check("Yom Kippur 2027: neither (nor the meeting on its eve)", !r.yk.wa && !r.yk.pcnEve);
      t.check(`a week doesn't repeat (${r.weekWa} / 7 different line-ups, ${r.weekPcn} / 7 meetings)`, r.weekWa >= 6 && r.weekPcn >= 5);
    });

    // ════ 👀 the preview switch (?parody=address | comment &day=N &shop=…) — for this page load only ════
    await step("preview", async () => {
      const r = await g(`(() => { const P = ${P}, F = P.PD.force; const keep = JSON.stringify(F), off = P.PD.dayOff;
        const none = P.fromQuery("?parody=nope");
        const a = P.fromQuery("?parody=address&day=3&shop=bakery"); const planA = P.waPlan();
        const on = P.onNow("wa", new Date(2027, 2, 5, 23));          // (a Friday, at 11 pm: forced on anyway)
        const b = P.fromQuery("?parody=comment"); const onB = P.onNow("pcn", new Date(2027, 2, 6, 9));
        for (const k of Object.keys(F)) delete F[k]; Object.assign(F, JSON.parse(keep)); P.PD.dayOff = off;
        return { none, a, shop: planA.shop, on, b, onB, saved: !!localStorage.getItem("parody") }; })()`);
      t.check("?parody=address&day=3&shop=bakery → on now, whatever the day + hour, the bakery, the line-up 3 days on", !!r.a && r.a.wa && r.a.day === 3 && r.shop === "bakery" && r.on, JSON.stringify(r));
      t.check("?parody=comment → the meeting on (a Saturday morning, forced)", !!r.b && r.b.pcn && r.onB);
      t.check("anything else → no preview; nothing saved", r.none === null && !r.saved);
    });

    // ════ the words ════
    await step("words", async () => {
      const txt = await t.L(`import("./js/features/cityhall/data.js").then(X => JSON.stringify([X.WRONG_ADDRESS, X.COMMENT_NIGHT]))`);
      const low = txt.toLowerCase();
      const hits = BANNED.filter(b => low.includes(b));
      t.check(`no banned word, slogan or flag anywhere in either (${BANNED.length} checked)`, hits.length === 0, hits.join(", "));
      const fnv = s => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
      const words = low.match(/[a-z][a-z'-]*/g) || [];
      const slurs = words.filter(w => SLUR_HASHES.includes(fnv(w)));
      t.check(`no slur from anyone (${words.length} words hashed against the list)`, slurs.length === 0, `${slurs.length} found`);
      const israel = (low.match(/israel/g) || []).length;
      t.check(`the premise appears only on the flyer + its explanation (${israel}×)`, israel === 2);
    });

    // ════ 🪧 the wrong address (Midwood) ════
    await step("wrongaddress", async () => {
      if (!await town("midwood")) return;
      await setCoins(200);
      const msgs0 = await g(`ctx.phone.inbox.msgs.length`);
      await g(`(${P}.PD.force.wa = true, ${P}.WAS.done = "", true)`);
      if (!await t.until(`!!(__lulu3d.ctx.cityhall.parody.WAS.on && __lulu3d.ctx.cityhall.parody.WAS.on.ready)`, "the crowd stands", 15000)) return;
      const info = await g(`(() => { const W = ${P}.WAS.on, all = W.people.map(m => [m.x, m.z]).concat(W.counter.map(m => [m.x, m.z])); if (W.table) all.push([W.cmid.x, W.cmid.z]);
        const dDoor = Math.min(...all.map(([x, z]) => Math.hypot(x - W.door.x, z - W.door.z)));
        const road = all.map(([x, z]) => { const n = ctx.world.road.nearest(x, z, ctx.car.s, {}); return Math.abs(n.d) - (n.street ? n.street.curb : 4); });
        return { shop: W.shop, n: W.people.length, flyer: W.people[0].signText, dDoor: +dDoor.toFixed(2), onWalk: road.every(v => v > 0), counter: W.counter.length, bubbe: !!W.bubbe }; })()`);
      t.check(`a small crowd outside ${info.shop} (${info.n} people${info.counter ? ", a counter-protest" : ""}${info.bubbe ? " + Bubbe" : ""})`, info.n >= 4 && info.n <= 5, JSON.stringify(info));
      t.check(`the first sign is their flyer ("${info.flyer}")`, /THIS SHOP SELLS/.test(info.flyer));
      t.check(`the shop's door stays clear (nearest person ${info.dDoor} m)`, info.dDoor >= 2.0);
      t.check("everyone stands on the sidewalk, not in a lane", info.onWalk);
      await t.L(`(() => { const r = __lulu3d.renderer; if (!window.__camWrap) { const o = r.render.bind(r); window.__camWrap = true; r.render = (s, c) => { const V = window.__camAt; if (V && c === __lulu3d.ctx.camera) { c.position.set(V[0], V[1], V[2]); c.lookAt(V[3], V[4], V[5]); c.updateMatrixWorld(); } o(s, c); }; } return true; })()`);
      { const W0 = await g(`${P}.WAS.on.mid`); const nn = await g(`[${P}.WAS.on.nx, ${P}.WAS.on.nz]`); await footAt(W0.x + nn[0] * 5, W0.z + nn[1] * 5); }
      await g(`(() => { const W = ${P}.WAS.on; window.__camAt = [W.mid.x + W.nx * 11 + W.ux * 3, 3.6, W.mid.z + W.nz * 11 + W.uz * 3, W.mid.x, 1.6, W.mid.z]; return true; })()`);
      await t.frames(30);
      if (process.env.CH5_LOG) console.log("    [wa dbg]", JSON.stringify(await g(`(() => { const W = ${P}.WAS.on, c = ctx.camera.position; return { p0: [W.people[0].x, W.people[0].z], sign: W.people[0].sign && W.people[0].sign.position.toArray().map(v => +v.toFixed(1)), vis: W.people[0].sign && W.people[0].sign.visible, rigs: Object.fromEntries(Object.entries(W.rigs).map(([k, r]) => [k, r.list.map(P => P.im.count)])), inScene: !!W.group.parent, t: W.t, cam: [c.x, c.y, c.z].map(v => +v.toFixed(1)), mid: W.mid }; })()`)));
      await t.shot("cityhall5-wrongaddress"); await t.L(`(window.__camAt = null, true)`); await W.reset(t);
      // ✋ at it
      const mid = await g(`${P}.WAS.on.mid`);
      await footAt(mid.x + 0.4, mid.z + 0.4);
      const p = await promptText();
      t.check(`✋ at the crowd: "${p.trim()}"`, /PROTEST\?/i.test(p));
      // what's it about → nothing pays
      const c0 = await coins();
      await g(`(${P}.talk(), true)`); await t.frames(3);
      await answer(/about/i); await drain();
      await g(`(${P}.talk(), true)`); await t.frames(3);
      await answer(/picture/i); await drain();
      t.check("talking + a picture pay nothing", (await coins()) === c0);
      // buying: the shop's price exactly; with nothing → refused, never below 0
      const price = await g(`${P}.WAS.on.SH.price`);
      const n0 = await g(`${P}.WAS.on.people.filter(m => m.state === "stand").length`);
      await g(`(${P}.buy(), true)`); await t.frames(3); await drain();
      t.check(`buying ${await g(`${P}.WAS.on.SH.item`)} costs exactly ${price} (and someone gives up for lunch)`, (await coins()) === c0 - price && (await g(`${P}.WAS.on.people.filter(m => m.state === "stand").length`)) === n0 - 1);
      await setCoins(0);
      await g(`(${P}.buy(), true)`); await t.frames(3); await drain();
      t.check("can't afford it → refused, coins stay 0", (await coins()) === 0);
      await setCoins(200);
      // her chant (no presses → it still ends, pays nothing)
      const c1 = await coins();
      await g(`(${P}.chant(), true)`);
      await t.until(`!!(__lulu3d.ctx.cityhall.parody.WAS.on && __lulu3d.ctx.cityhall.parody.WAS.on.chant)`, "her chant starts", 4000);
      const words = await t.L(`[...document.querySelectorAll(".ch-chant span")].map(s => s.textContent).join(" / ")`);
      t.check(`her chant is lunch ("${words}")`, /LUNCH/.test(words) && !/LAND|ISRAEL/i.test(words));
      await t.until(`!__lulu3d.ctx.cityhall.parody.WAS.on || !__lulu3d.ctx.cityhall.parody.WAS.on.chant`, "her chant ends", 10000);
      t.check("the chant pays nothing", (await coins()) === c1);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("honk", {}))`); await t.frames(3);
      t.check("a honk gets an eye-roll", await g(`${P}.WAS.log.some(l => l.ev === "honk")`));
      // one by one they go in for lunch → packed up for the day (and not back today)
      for (let k = 0; k < 6; k++) { await g(`(${P}.leaveOne(), true)`); await t.frames(2); }
      await t.until(`!__lulu3d.ctx.cityhall.parody.WAS.on`, "they've all gone in for lunch", 15000);
      t.check("the last one goes in → the sidewalk is clear", await g(`!${P}.WAS.on && ${P}.WAS.log.some(l => l.ev === "packed")`));
      await t.frames(20);
      t.check("…and it doesn't come back today", await g(`!${P}.WAS.on`));
      const newMsgs = await g(`ctx.phone.inbox.msgs.slice(${msgs0}).map(m => (m.from || "") + ": " + (m.msg || ""))`);
      t.check("no texts from it (bubbles only)", !newMsgs.some(m => /protest|sign|flyer|boycott|crowd|sample|pizza|babka|pickle|lunch/i.test(m)), newMsgs.join(" · "));
      await g(`(${P}.PD.force.wa = false, ctx.foot.end("test"), true)`); await t.frames(3); await playing();
    });

    // ════ 🎤 public comment night (Lakewood City Hall) ════
    await step("comment", async () => {
      if (!await town("lakewood")) return;
      await g(`(${P}.PD.force.pcn = true, true)`);
      const sp = await g(`ctx.cityhall.spot()`);
      await footAt(sp.x + sp.nx * 2, sp.z + sp.nz * 2);
      await W.reset(t);
      await g(`ctx.cityhall.enter()`);
      if (!await inside()) return;
      await t.frames(20);
      const who = await g(`Object.keys(__interiors.room.byId).filter(k => /^pcn_/.test(k))`);
      const plan = await g(`${P}.pcnPlan().cranks`);
      t.check(`the meeting: two cranks (${plan.join(" + ")}), their neighbours, Pothole Phil`, who.length === 5 && plan.every(c => who.includes("pcn_" + c)) && who.includes("pcn_linda") && who.includes("pcn_tom") && who.includes("pcn_phil"), who.join(","));
      t.check("the mic + the agenda are ✋ spots; every window is still there", await g(`["pcn_mic", "pcn_agenda", "win_permits", "win_taxes", "win_complaints"].every(id => __interiors.room.hots.some(h => h.id === id))`));
      await g(`(__interiors.room.lulu.obj.position.set(${"__interiors.room.hots.find(h => h.id === 'pcn_mic').x"}, 0, 1.0), __interiors.room.updateCamera(0, true), true)`);
      await t.frames(30); await t.shot("cityhall5-comment");
      await t.until(`__lulu3d.ctx.cityhall.parody.CNS.log.filter(l => l.ev === "line").length >= 2`, "the meeting goes on", 20000);
      t.check("the meeting talks on its own (bubbles)", await g(`${P}.CNS.log.filter(l => l.ev === "line").length >= 2`));
      const c0 = await coins();
      await g(`(${P}.mic(__interiors.room), true)`); await t.frames(3);
      await answer(/dimensions/i, `ctx.cityhall.parody.CNS.log.some(l => l.ev === "mic")`, 80);
      await drain();
      t.check("her turn at the mic → the vote → deferred", await g(`${P}.CNS.log.some(l => l.ev === "mic")`));
      t.check("nothing pays", (await coins()) === c0);
      // leave; a night without the meeting has none of it
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back outside", 15000);
      await g(`(${P}.PD.force.pcn = false, true)`);
      await g(`ctx.cityhall.enter()`);
      if (await inside()) {
        await t.frames(10);
        t.check("a night without it: no meeting in the lobby", await g(`!Object.keys(__interiors.room.byId).some(k => /^pcn_/.test(k))`));
        await g(`(__interiors.room.leave(), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "back outside", 15000);
      }
      t.check("never on a Friday evening (the real rule)", await g(`(() => { const F = ${P}.PD.force; const was = F.pcn; delete F.pcn; const r = ${P}.dayOn("pcn", new Date(2027, 2, 5, 19)); F.pcn = was; return r === false; })()`));
      await g(`(delete ${P}.PD.force.pcn, delete ${P}.PD.force.wa, true)`);
    });

    // (the test teleports her and the chant holds her for its 4 beats on purpose: those kinds aren't glitches here)
    const r = await W.report(t); W.log(r); W.check(t, "cityhall5", r, ["nan", "overlay", "flat", "underground", "inwall"]);
  },
};
