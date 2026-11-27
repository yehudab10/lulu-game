// 🏎️ Dealers (features/dealers): Mazelati of Monsey, the luxury showroom off the highway (stage 1).
//   • the cars join the car list (car.js SKINS + garage SKIN_SHOP): real stat steps over Uncle Refael's best, a coin sink
//     (6,000–38,000), a body kit on the one convertible
//   • the showroom stands at its lap metre (a right pull-off, the same place every lap): four cars on pedestals + Sal
//   • on foot: ✋ at a car → the card (stats on the luxury scale, perks) → 🤝 Sal's haggle
//   • the haggle: walking out (the manager, once), losing his patience (back to the sticker), a deal below the sticker,
//     can't afford it (nothing taken); the F&I office: real options (they work) + nonsense (Sal remembers)
//   • a working perk (launch control, the bigger tank, the fridge); never below 0 coins; the watchdog is quiet
const W = require("../lib/qawatch.js");
module.exports = {
  name: "dealers",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 50000, ownedSkins: ["pink", "ninja"], selectedSkin: "pink" },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const save = () => t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`);
    await t.L(`import("./js/core/ctx.js").then(m => { window.__ev = []; for (const n of ["dealers:haggle", "dealers:option", "dealers:nonsense", "dealers:perk", "shops:buy"]) m.on(n, e => __ev.push(n + ":" + JSON.stringify(e || {}))); })`);
    const evs = re => t.L(`window.__ev.filter(e => ${re}.test(e))`);
    // the dialogue, like a player: tap through his lines, pick an option by its words (→ its text, or null)
    const dlgOpen = () => g(`ctx.dialogOpen`);
    const lines = async (max = 12) => {
      for (let i = 0; i < max; i++) {
        if (!await dlgOpen()) return;
        if (await t.L(`document.querySelectorAll("#dialog .opt").length > 0`)) return;
        await t.L(`import("./js/core/dialog.js").then(m => m.dialogFastForward())`);
        await t.frames(3);
      }
    };
    const pick = async re => {
      await lines();
      const txt = await t.L(`(() => { const b = [...document.querySelectorAll("#dialog .opt")].find(b => ${re}.test(b.textContent)); if (!b) return null; b.click(); b.click(); return b.textContent; })()`);
      await t.frames(3);
      return txt;
    };
    const optsNow = async () => { await lines(); return t.L(`[...document.querySelectorAll("#dialog .opt")].map(b => b.textContent)`); };
    const haggle = id => t.L(`(window.__hg = null, __lulu3d.ctx.dealers.haggle(${JSON.stringify(id)}).then(r => { window.__hg = r; }), true)`);
    const result = async () => { await lines(); await t.until(`window.__hg`, "the haggle ends", 6000); return t.L(`window.__hg`); };

    await t.frames(10);
    // ── the cars ──
    await step("cars", async () => {
      const C = await t.L(`Promise.all([import("./js/car.js"), import("./js/features/garage/data.js")]).then(([c, d]) => ({ ids: ["shabbatino", "geltspyder", "kvetchtoria", "machatunim"].map(k => ({ k, sk: c.SKINS[k], shop: d.SKIN_SHOP[k], key: d.SKIN_KEYS.includes(k) })), ninja: c.SKINS.ninja }))`);
      t.check("four Mazelati cars in the car list (+ the shop catalogue)", C.ids.every(x => x.sk && x.shop && x.key));
      t.check("each beats Uncle Refael's best (the Ninja) on top speed + acceleration", C.ids.every(x => x.sk.top > C.ninja.top && x.sk.acc > C.ninja.acc));
      t.check("priced as a coin sink: 3,000–40,000", C.ids.every(x => x.shop.price >= 3000 && x.shop.price <= 40000));
      t.check("they're the one convertible with the marque's kit", C.ids.every(x => x.sk.kit === "mazelati"));
    });

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "driving")) return;
    await W.install(t);

    // ── the showroom at its lap metre ──
    await step("place", async () => {
      await W.pause(t, false);
      await g(`(() => { const s = 16000 + 800 - 110, p = ctx.world.road.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.frames(6); await W.pause(t, true); await W.moved(t);
      t.check("the showroom is built at lap metre 800 (on the right)", await t.until(`__lulu3d.ctx.dealers.debug.D.spots.some(s => Math.abs(s.s - 16800) < 1)`, "Mazelati built", 30000));
      t.check("four cars on the pedestals + Sal at the door", await t.until(`__lulu3d.ctx.dealers.debug.D.cars.length === 4 && !!__lulu3d.ctx.dealers.debug.D.sal`, "cars + Sal", 20000));
      t.check("the pull-off is paved, the trees kept off", await t.L(`import("./js/world.js").then(m => m.pavedAt(16800, 20) >= 2 && __lulu3d.ctx.world.reserved.some(r => r.s0 <= 16790 && r.s1 >= 16810 && r.side === 1))`));
      await t.shot("road");
    });

    // ── on foot: ✋ at a car → the card ──
    await step("card", async () => {
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      await W.pause(t, false);
      await g(`(() => { const sp = ctx.dealers.debug.D.at, w = ctx.dealers.debug.padWorld(sp, 1); const F = ctx.foot.debug.F; F.pos.set(w.x + Math.sin(sp.rot) * 3.4, 0.05, w.z + Math.cos(sp.rot) * 3.4); F.phase = "walk"; return true; })()`);
      await t.frames(4); await g(`(ctx.cam && ctx.cam.snap && ctx.cam.snap(), true)`); await t.frames(6); await W.pause(t, true); await W.moved(t);
      t.check("✋ at a car on show names it + its price", /GELT SPYDER.*12,000/.test(await t.L(`(document.querySelector(".prompt") || {}).textContent || ""`)), await t.L(`(document.querySelector(".prompt") || {}).textContent || ""`));
      await t.shot("showroom");
      await g(`(ctx.dealers.open("geltspyder"), true)`);
      await t.frames(4);
      const card = await t.L(`(document.querySelector("#screenCard") || {}).textContent || ""`);
      t.check("the card: the car, its stats, its perks, the sticker", /Mazelati/.test(card) && /Gelt Spyder/.test(card) && /TOP SPEED/.test(card) && /Launch control/.test(card) && /12,000/.test(card), card.slice(0, 200));
      await t.shot("card");
      await t.L(`import("./js/features/shops/card.js").then(m => m.closeCard(true))`);
      await t.frames(3);
    });

    // ── the haggle: walking out (+ the manager, once) ──
    await step("walk", async () => {
      const c0 = await coins();
      await haggle("shabbatino");
      t.check("a counter is offered (−5 %)", !!await pick(/How about 5,700/));
      t.check("walking toward the door brings out the manager", !!await pick(/Walk toward the door/));
      const o = await optsNow();
      t.check("…he comes back lower (5 % more off) — and the door is just 🚪 Leave now", /Deal — 5,550/.test(o[0]) && o.some(x => /Leave/.test(x)) && !o.some(x => /Walk toward/.test(x)), o.join(" | "));
      await pick(/Leave/);
      const r = await result();
      t.check("she walks out: nothing bought, not a coin taken", r.ok === false && r.why === "walked" && await coins() === c0 && !(await save()).ownedSkins.includes("shabbatino"));
    });
    // ── pushing too hard: back to the sticker ──
    await step("patience", async () => {
      const c0 = await coins();
      await haggle("shabbatino");
      await pick(/Final offer/);
      t.check("'final offer' meets her near the floor", /Deal — 5,280/.test((await optsNow())[0]), (await optsNow())[0]);
      await pick(/Final offer/);
      const o = await optsNow();
      t.check("out of patience: back to the sticker, take it or leave it", /Deal — 6,000/.test(o[0]) && o.length === 2, o.join(" | "));
      await pick(/Leave/);
      const r = await result();
      t.check("…a bad haggle loses the discount, never coins", r.ok === false && await coins() === c0);
    });
    // ── a deal + the F&I office ──
    await step("deal", async () => {
      const c0 = await coins();
      await haggle("geltspyder");
      await pick(/How about 10,800/);
      await pick(/How about 10,800/);
      t.check("two counters: he meets her halfway each time", /Deal — 11,100/.test((await optsNow())[0]), (await optsNow())[0]);
      await pick(/Deal/);
      // the F&I office: tank ✅, massage ❌, fridge ✅, concierge ❌, undercoating ✅, then skip the rest
      const fni = [];
      for (const want of [/Add it/, /No thanks/, /Add it/, /No thanks/, /Sure/, /Skip the rest/]) fni.push(await pick(want));
      const r = await result();
      t.check("the deal goes through below the sticker", r.ok === true && r.price === 11100, JSON.stringify(r));
      t.check("F&I: every option + package was offered one card at a time", fni.every(Boolean), JSON.stringify(fni));
      const c1 = await coins();
      t.check("paid 11,100 + 1,200 (tank) + 400 (fridge) + 250 (undercoating)", c0 - c1 === 11100 + 1200 + 400 + 250, `${c0 - c1}`);
      const s = await save();
      t.check("the shared save: owned + selected (like any car)", s.ownedSkins.includes("geltspyder") && s.selectedSkin === "geltspyder");
      t.check("her car out front is the Gelt Spyder (+ the Mazelati kit)", await g(`ctx.car.skinKey === "geltspyder" && !!ctx.car.model.getObjectByName("Kit_mazelati")`));
      t.check("the options are remembered per car, the nonsense too", await g(`(() => { const DS = ctx.dealers.debug.DS; return DS.opts.geltspyder.join() === "tank,fridge" && DS.fell.undercoat === 1 && DS.deals === 1 && DS.walked === 1; })()`));
      t.check("Sal remembers what she fell for", /undercoating/i.test(await t.L(`import("./js/features/dealers/haggle.js").then(m => m.remembered())`)));
      t.check("events: deal, 2 options, 1 package", (await evs(/dealers:haggle.*deal/)).length === 1 && (await evs(/dealers:option/)).length === 2 && (await evs(/dealers:nonsense/)).length === 1);
    });
    // ── can't afford it / never below 0 ──
    await step("poor", async () => {
      const c0 = await coins();
      await haggle("machatunim");
      await pick(/Deal/);
      const r = await result();
      t.check("can't afford the Machatunim: he says so, nothing taken", r.ok === false && r.why === "poor" && await coins() === c0, JSON.stringify(r));
      const x = await t.L(`import("./js/features/garage/buy.js").then(m => m.buyExtra("nonsense", "test", 1e9).ok)`);
      t.check("a package she can't pay for is refused (never below 0)", x === false && await coins() === c0);
      const y = await t.L(`import("./js/features/garage/buy.js").then(m => m.buyCar("kvetchtoria", { price: 1 }))`);
      t.check("a haggled price never goes under the floor (sticker × 0.85)", y.ok && y.price === 15300 && c0 - await coins() === 15300, JSON.stringify(y));
      t.check("…and coins never go below 0", await coins() >= 0);
    });

    // ── the perks work (back in the Gelt Spyder, on the road) ──
    await step("perks", async () => {
      await t.L(`import("./js/features/garage/buy.js").then(m => m.equipSkin("geltspyder"))`);
      const cP = await coins();
      await g(`(ctx.foot.active && ctx.foot.end("test"), true)`);
      await t.until(`__lulu3d.state === "playing"`, "back in the car", 8000);
      t.check("the bigger nitro tank (the car's 1.3 × the option's 1.3)", Math.abs(await g(`ctx.G.nitroTank`) - 1.69) < 0.01, String(await g(`ctx.G.nitroTank`)));
      await W.pause(t, false);
      await g(`(() => { const s = ctx.car.s, p = ctx.world.road.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.vx = ctx.car.vz = 0; return true; })()`);
      await t.frames(60);
      await t.hold(7, 1); await t.frames(4);
      const sp = await g(`ctx.car.speed`);
      await t.hold(7, 0); await t.frames(30);
      await W.pause(t, true); await W.moved(t);
      t.check("🚀 launch control: from a stop, floor it → a rocket start", (await evs(/dealers:perk.*launch/)).length >= 1 && sp > 5, `${sp.toFixed(2)} m/s`);
      await t.frames(60);
      const b0 = await g(`ctx.G.boost`);
      await g(`(ctx.dealers.debug.perks.R.stopT = 9, true)`);
      await t.frames(4);
      t.check("🥂 the fridge: a fizzy sip of nitro once a run", (await evs(/dealers:perk.*fridge/)).length === 1 && await g(`ctx.G.boost`) > b0);
      await g(`(ctx.dealers.debug.perks.R.stopT = 9, true)`);
      await t.frames(4);
      t.check("…only once", (await evs(/dealers:perk.*fridge/)).length === 1);
      t.check("no coins from any perk", await coins() === cP, `${cP} → ${await coins()}`);
    });
    { const r = await W.report(t); W.log(r); W.check(t, "Mazelati (the showroom, the haggle, the perks)", r); }
  },
};
