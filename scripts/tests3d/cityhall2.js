// 🏛️ City hall stage 2 (features/cityhall tax.js / fees.js / pay.js / court.js): property tax on the homes she owns, only on
// PLAYED days (days away never happen), never taken by itself, never below 0, never touches ownership; the cap per day and
// the owed cap; the stern letter → the lien (+ its fee + a Courtroom 2B case) → won (fee waived, lien lifted) / lost (pays what
// she has); silly fees (once a kind a real day, ≤ 10 a real day, quiet, they expire); paying at the Taxes window (two
// presses) and from 📞 Phone › City Hall (two taps); seized homes aren't taxed.
const W = require("../lib/qawatch.js");

module.exports = {
  name: "cityhall2",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,cityhall,realestate,phone,community,places",
  save2d: { totalCoins: 30000, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const setCoins = n => t.L(`import("./js/core/save.js").then(m => { const c = m.wallet.coins; if (c > ${n}) m.wallet.spend(c - ${n}); else m.wallet.add(${n} - c); return m.wallet.coins; })`);
    const TX = `ctx.cityhall.tax`;
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
    // a new device day + one tick (the ledger's played-day clock)
    const day = async n => { await g(`(ctx.realestate.debug.CLOCK.offset = ${n}, ${TX}.tick(), true)`); await t.frames(2); };
    const L = () => g(`JSON.parse(JSON.stringify(${TX}.ledger))`);
    const texts = () => g(`ctx.phone.inbox.msgs.filter(m => m.title === "City Hall").map(m => m.msg)`);
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

    t.check("ctx.cityhall.tax exists", await g(`!!(ctx.cityhall && ctx.cityhall.tax && ctx.cityhall.tax.tick)`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "cruise starts")) return;
    await playing();
    await g(`(ctx.atmos.debug.freeze(true), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.cityhall.debug.RB.next = 1e9, true)`);
    await W.install(t);
    if (!await town("lakewood")) return;

    let home = null;
    await step("no homes", async () => {
      // the first played day only starts the clock; with no homes nothing is ever billed
      await g(`(${TX}.ledger.day = null, ${TX}.ledger.bills.length = 0, ${TX}.ledger.played = 0, ${TX}.ledger.letter = false, ${TX}.ledger.lien = null, ctx.realestate.debug.CLOCK.offset = 0, ${TX}.tick(), true)`);
      await day(1); await day(2);
      t.check("no homes → no tax", (await g(`${TX}.owed()`)) === 0);
    });

    await step("tax", async () => {
      // buy a listed home for cash (real estate's own test hook)
      home = await g(`(() => { const R = ctx.realestate; for (const r of R.listings()) if (R.debug.buyNow(r.id)) return r.id; return null; })()`);
      if (!t.check(`she owns a home (${home})`, !!home)) return;
      const value = await g(`ctx.realestate.valueOf(${JSON.stringify(home)})`);
      const c0 = await coins();
      await day(3);
      const l = await L();
      const tax = l.bills.filter(b => b.kind === "tax" && !b.paid);
      const want = Math.max(1, Math.round(value * 0.002));
      t.check(`a played day bills ~0.2 % of the value (${tax.map(b => b.amount)} for ${value}; want ${want})`, tax.length === 1 && Math.abs(tax[0].amount - want) <= 1);
      t.check(`…it's NOT taken by itself (coins ${c0} → ${await coins()})`, await coins() === c0);
      t.check("…real estate's bill list for that home has the line", await g(`ctx.realestate.bills(${JSON.stringify(home)}).some(b => b.from === "cityhall" && !b.paid)`));
      t.check("…and a quiet line in 📱 Messages › City Hall", (await texts()).some(m => /property tax/i.test(m)));
      // the same day again: nothing new
      await day(3);
      t.check("the same day twice bills once", (await L()).bills.filter(b => b.kind === "tax").length === 1);
      // five days away = ONE played day
      await day(8);
      t.check("days away never happen (5 days later = one more bill)", (await L()).bills.filter(b => b.kind === "tax").length === 2);
      t.check("never in Dina's mode / a non-world state: a tick in the title does nothing", await g(`(() => { const n = ${TX}.ledger.played; const s = ctx.state; ctx.realestate.debug.CLOCK.offset = 9; L3.setState("title"); ${TX}.tick(); const same = ${TX}.ledger.played === n; L3.startRun({ mode: "cruise", quick: true }); return same; })()`));
      await t.until(`__lulu3d.state === "playing" || __lulu3d.state === "footRun"`, "back driving", 20000);
      await playing();
      if (!await town("lakewood")) return;
    });

    await step("cap", async () => {
      if (!home) return;
      // the day cap across many homes
      const rows = await g(`(() => { const R = ctx.realestate; let n = 0; for (const r of R.listings()) if (n < 6 && R.debug.buyNow(r.id)) n++; return ${TX}.taxToday(); })()`);
      const sum = rows.reduce((a, r) => a + r.amount, 0);
      t.check(`today's tax across ${rows.length} homes is at most 50 (${sum})`, sum <= 50 && sum > 0);
      // the owed cap: 30 unpaid days ≤ 7 days' worth
      for (let d = 10; d < 40; d++) await g(`(ctx.realestate.debug.CLOCK.offset = ${d}, ${TX}.tick(), true)`);
      const daily = await g(`${TX}.taxToday().reduce((a, r) => a + r.amount, 0)`);
      const taxOwed = (await L()).bills.filter(b => b.kind === "tax" && !b.paid).reduce((a, b) => a + b.amount, 0);
      t.check(`unpaid tax stops growing at 7 days' worth (${taxOwed} ≤ ${7 * daily})`, taxOwed <= 7 * daily);
      t.check("…and she still owns every home (tax never touches ownership)", await g(`ctx.realestate.count()`) === rows.length);
    });

    await step("letter + lien", async () => {
      if (!home) return;
      const l = await L();
      t.check("a tax bill unpaid 3 played days → the stern letter", l.letter === true && (await texts()).some(m => /STERN LETTER/.test(m)));
      t.check("…6 played days → the lien + its fee", !!(l.lien && !l.lien.lifted) && l.bills.some(b => b.kind === "lien" && !b.paid) && (await texts()).some(m => /LIEN NOTICE/.test(m)));
      t.check("…and a case on Courtroom 2B's docket", await g(`(() => { const C = ctx.civic && ctx.civic.courts; if (!C) return false; const c = C.caseById ? C.caseById("cityhall:lien:1") : null; return !!c || !!(C.caseIn && C.caseIn("lakewood") && /LIEN/.test(C.caseIn("lakewood").title)); })()`));
      // the court: won → the fee waived, the lien lifted, nothing paid
      const c0 = await coins();
      const r = await g(`${TX}.ruleLien(true)`);
      const l2 = await L();
      t.check(`won in court → lien lifted, fee waived (${JSON.stringify(r)})`, r.won && !!l2.lien.lifted && l2.bills.some(b => b.kind === "lien" && b.waived));
      t.check(`…nothing paid (${c0} → ${await coins()})`, await coins() === c0);
    });

    await step("lost in court", async () => {
      if (!home) return;
      // a new lien after more unpaid days, then lost with only a few coins: pays what she has, never below 0
      for (let d = 40; d < 48; d++) await g(`(ctx.realestate.debug.CLOCK.offset = ${d}, ${TX}.tick(), true)`);
      t.check("the lien comes back after more unpaid days", await g(`${TX}.lienOn()`));
      await setCoins(25);
      const owed0 = await g(`${TX}.owed()`);
      const r = await g(`${TX}.ruleLien(false)`);
      const c = await coins();
      t.check(`lost → pays only what she has (owed ${owed0}, paid ${r.n}, coins now ${c})`, !r.won && r.n <= 25 && c >= 0 && c === 25 - r.n);
      await setCoins(30000);
    });

    await step("window", async () => {
      if (!home) return;
      // pay at the Taxes window: two presses
      await g(`(ctx.cityhall.debug.force.closed = 0, true)`);
      if (await st() !== "footRun") { await g(`(ctx.foot.start("parked", { noIntro: true }), true)`); await t.until(`__lulu3d.state === "footRun"`, "on foot", 8000); }
      await g(`(() => { const sp = ctx.cityhall.spot(); ctx.foot.debug.F.pos.set(sp.x + sp.nx, 0.05, sp.z + sp.nz); return true; })()`);
      await g(`ctx.cityhall.enter()`);
      if (!await t.until(`__lulu3d.state === "interior" && __interiors.room && __interiors.room.ready`, "inside city hall", 60000)) return;
      const owed0 = await g(`${TX}.owed()`), c0 = await coins();
      await g(`(() => { const r = __interiors.room, h = r.hots.find(h => h.id === "win_taxes"); r.lulu.obj.position.set(h.x, 0, h.z); r.use(h); return true; })()`);
      await t.until(`__lulu3d.ctx.dialogOpen`, "the clerk asks", 6000);
      await answer(/Pay it all|Pay what/);                        // 💰 Pay it all
      t.check("…one press isn't enough (a confirm)", await coins() === c0);
      await answer(/✍️ Pay/);                                       // ✍️ Pay
      await drain(); await t.frames(10);
      t.check(`paid at the window: owed ${owed0} → ${await g(`${TX}.owed()`)}, coins ${c0} → ${await coins()}`, await g(`${TX}.owed()`) === 0 && c0 - await coins() === owed0);
      t.check("…real estate's bill lines are marked paid", await g(`ctx.realestate.bills(${JSON.stringify(home)}).filter(b => b.from === "cityhall").every(b => b.paid)`));
      t.check("…everything paid lifts the lien", await g(`!${TX}.lienOn()`));
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back outside", 30000);
      await g(`(ctx.cityhall.debug.force.closed = null, true)`);
    });

    await step("fees", async () => {
      await g(`(ctx.cityhall.fees.FE.force.day = "test-1", ctx.cityhall.fees.FE.force.porch = false, true)`);
      const c0 = await coins();
      for (let i = 0; i < 6; i++) await g(`(L3.emit("honk", {}), true)`);
      const fees = () => g(`${TX}.ledger.bills.filter(b => b.kind === "fee" && !b.paid).map(b => b.fee)`);
      t.check(`six honks in town → the loud-honk surcharge (${await fees()})`, (await fees()).filter(f => f === "honk").length === 1);
      for (let i = 0; i < 12; i++) await g(`(L3.emit("honk", {}), true)`);
      t.check("…once a real day", (await fees()).filter(f => f === "honk").length === 1);
      await g(`ctx.cityhall.fees.charge("hydrant")`); await g(`ctx.cityhall.fees.charge("porch")`); await g(`ctx.cityhall.fees.charge("complaint")`);
      t.check(`all fees together ≤ 10 a real day (${await g(`ctx.cityhall.fees.feesToday()`)})`, await g(`ctx.cityhall.fees.feesToday()`) <= 10);
      t.check(`…and none is taken by itself (coins ${c0} → ${await coins()})`, await coins() === c0);
      // unpaid fees expire after 7 played days (and the tax doesn't need paying for that)
      await g(`(() => { for (const b of ${TX}.ledger.bills) if (b.kind === "tax") b.paid = true; return true; })()`);
      for (let d = 50; d < 58; d++) await g(`(ctx.realestate.debug.CLOCK.offset = ${d}, ${TX}.tick(), true)`);
      t.check("unpaid fees expire after 7 played days", (await g(`${TX}.ledger.bills.filter(b => b.kind === "fee" && !b.paid && b.at <= ${TX}.ledger.played - 7).length`)) === 0 && (await texts()).some(m => /lost the paperwork/.test(m)));
    });

    await step("phone", async () => {
      // 📞 Phone › City Hall: the list + two taps to pay
      await g(`(ctx.cityhall.fees.FE.force.day = "test-2", ctx.cityhall.fees.charge("hydrant"), true)`);
      const owed0 = await g(`${TX}.owed()`), c0 = await coins();
      const html = await t.L(`(() => { const el = document.createElement("div"); document.body.appendChild(el); window.__chEl = el; __lulu3d.ctx.cityhall.contactRender(el); return el.textContent; })()`);
      t.check(`the contact lists what she owes (${html.slice(0, 80)})`, owed0 > 0 && new RegExp(String(owed0)).test(html));
      await t.L(`__chEl.querySelector("#chPay").click()`);
      t.check("…one tap arms it (nothing paid)", await coins() === c0 && /Tap again/.test(await t.L(`__chEl.textContent`)));
      await t.L(`__chEl.querySelector("#chPay").click()`);
      t.check(`…the second tap pays (${c0} → ${await coins()})`, c0 - await coins() === owed0 && await g(`${TX}.owed()`) === 0);
      await t.L(`(__chEl.remove(), true)`);
    });

    await step("broke", async () => {
      // with no coins nothing is paid and nothing goes below 0
      await g(`(ctx.cityhall.fees.FE.force.day = "test-3", ctx.cityhall.fees.charge("hydrant"), true)`);
      await setCoins(0);
      const n = await g(`${TX}.payNow("test")`);
      t.check(`no coins → nothing paid, wallet stays 0 (${n}, ${await coins()})`, n === 0 && await coins() === 0);
      await setCoins(30000);
    });

    await step("seized", async () => {
      if (!home) return;
      // a home the Council holds isn't taxed
      const n = await g(`(() => { const S = ctx.realestate.debug.S; for (const id of Object.keys(S.owned)) S.owned[id].seized = Date.now(); return ${TX}.taxToday().length; })()`);
      t.check(`seized homes aren't taxed (${n} rows)`, n === 0);
      await g(`(() => { const S = ctx.realestate.debug.S; for (const id of Object.keys(S.owned)) delete S.owned[id].seized; ctx.realestate.debug.CLOCK.offset = 0; return true; })()`);
    });
    const r = await W.report(t); W.log(r); W.check(t, "city hall stage 2", r, ["jump", "nan", "overlay", "stuck"]);
  },
};
