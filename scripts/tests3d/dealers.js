// 🏎️ Dealers (features/dealers): Mazelati of Monsey, the luxury showroom off the highway (stage 1).
//   • the cars join the car list (car.js SKINS + garage SKIN_SHOP): real stat steps over Uncle Refael's best, a coin sink
//     (6,000–38,000), a body kit on the one convertible
//   • the showroom stands at its lap metre (a right pull-off, the same place every lap): four cars on pedestals + Sal
//   • on foot: ✋ at a car → the card (stats on the luxury scale, perks) → 🤝 Sal's haggle
//   • the haggle: walking out (the manager, once), losing his patience (back to the sticker), a deal below the sticker,
//     can't afford it (nothing taken); the F&I office: real options (they work) + nonsense (Sal remembers)
//   • a working perk (launch control, the bigger tank, the fridge); never below 0 coins; the watchdog is quiet
//   • stage 2: Tushla across the highway (a left pull-off), the tablet (two taps to buy), ⚡ Full Schlep Driving: subscribe /
//     cancel / lapse / renew (a moved clock), the self-drive holds our lane under the limit, pays nothing, hands back
const W = require("../lib/qawatch.js");
module.exports = {
  name: "dealers",
  viewport: { width: 1280, height: 720 },
  query: "&enable=world,law",
  save2d: { totalCoins: 50000, ownedSkins: ["pink", "ninja"], selectedSkin: "pink" },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.message || e).slice(0, 240)); } };
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const save = () => t.L(`JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await g(`L3.state`) !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
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
      t.check("both showrooms are on the 📱 Map (ctx.pins, the shops list)", await g(`!ctx.pins || (!!ctx.pins.get("hw:mazelati") && !!ctx.pins.get("hw:tushla") && ctx.pins.get("hw:mazelati").cat === "shops")`));
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
      // the F&I office: tank ✅, massage ❌, fridge ✅, concierge ❌, cruise ❌, undercoating ✅, then skip the rest
      const fni = [];
      for (const want of [/Add it/, /No thanks/, /Add it/, /No thanks/, /No thanks/, /Sure/, /Skip the rest/]) fni.push(await pick(want));
      const r = await result();
      t.check("the deal goes through below the sticker", r.ok === true && r.price === 11100, JSON.stringify(r));
      t.check("F&I: every option + package was offered one card at a time", fni.every(Boolean), JSON.stringify(fni));
      const c1 = await coins();
      t.check("paid 11,100 + 1,200 (tank) + 400 (fridge) + 250 (undercoating)", c0 - c1 === 11100 + 1200 + 400 + 250, `${c0 - c1}`);
      const s = await save();
      t.check("the shared save: owned + selected (like any car)", s.ownedSkins.includes("geltspyder") && s.selectedSkin === "geltspyder");
      t.check("her car out front is the Gelt Spyder (+ the Mazelati kit)", await g(`ctx.car.skinKey === "geltspyder" && !!ctx.car.model.getObjectByName("Kit_mazelati")`));
      t.check("the options are remembered per car, the nonsense too", await g(`(() => { const DS = ctx.dealers.debug.DS; return DS.opts.geltspyder.join() === "tank,fridge" && DS.fell.undercoat === 1 && DS.deals === 1 && DS.walked === 2; })()`));
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
      await W.pause(t, false); await playing(); await W.pause(t, true); await W.moved(t);
      t.check("back in the car", await g(`L3.state === "playing" && !ctx.foot.active`));
      t.check("the bigger nitro tank (the car's 1.3 × the option's 1.3)", Math.abs(await g(`ctx.G.nitroTank`) - 1.69) < 0.01, String(await g(`ctx.G.nitroTank`)));
      await W.pause(t, false);
      await g(`(() => { const s = ctx.car.s, p = ctx.world.road.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.vx = ctx.car.vz = 0; return true; })()`);
      await t.frames(60);
      await t.hold(7, 1); await t.frames(4);
      const sp = await g(`ctx.car.speed`);
      await t.hold(7, 0); await t.frames(30);
      await W.pause(t, true); await W.moved(t);
      t.check("🚀 launch control: from a stop, floor it → a rocket start", (await evs(/dealers:perk.*launch/)).length >= 1 && sp > 5, `${sp.toFixed(2)} m/s`);
      // (brake to a real stop first: the fridge pours only while she's standing still)
      await t.hold(6, 1); await t.until(`__lulu3d.ctx.car.speed < 0.3`, "stopped", 6000); await t.hold(6, 0);
      await t.frames(10);
      const b0 = await g(`ctx.G.boost`);
      await g(`(ctx.dealers.debug.perks.R.stopT = 9, true)`);
      await t.frames(4);
      t.check("🥂 the fridge: a fizzy sip of nitro once a run", (await evs(/dealers:perk.*fridge/)).length === 1 && await g(`ctx.G.boost`) > b0);
      await g(`(ctx.dealers.debug.perks.R.stopT = 9, true)`);
      await t.frames(4);
      t.check("…only once", (await evs(/dealers:perk.*fridge/)).length === 1);
      t.check("no coins from any perk", await coins() === cP, `${cP} → ${await coins()}`);
    });
    // ── ⏱️ cruise control (the Kvetchtoria has it built in; the poor step bought one) ──
    await step("cruise", async () => {
      await t.L(`import("./js/features/garage/buy.js").then(m => m.equipSkin("kvetchtoria"))`);
      await W.pause(t, false);
      await g(`(() => { ctx.traffic.clear(); const s = ctx.car.s + 200, p = ctx.world.road.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = Math.sin(p.h) * 20; ctx.car.vz = Math.cos(p.h) * 20; ctx.world.prebuild(s); return true; })()`);
      await t.frames(10);
      t.check("❚❚ offers ⏱️ Cruise control in the Kvetchtoria", await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("pause").some(i => i.id === "cruise"))`));
      t.check("set: it holds the speed she's doing", await g(`ctx.dealers.debug.perks.cruiseOn()`) === true);
      const v0 = await g(`ctx.dealers.debug.perks.CC.v`);
      await t.frames(120);
      const v1 = await g(`ctx.car.speed`);
      t.check("…hands off the pedals for 4 s: still within 1.5 m/s of it (she steers; it isn't self-driving)", Math.abs(v1 - v0) < 1.5 && !await g(`ctx.G.selfDriving`), `${v0.toFixed(1)} → ${v1.toFixed(1)}`);
      const cc1 = await g(`({ on: ctx.dealers.debug.perks.CC.on, off: ctx.dealers.debug.perks.CC.off })`);
      await t.hold(6, 1); await t.frames(8); await t.hold(6, 0);
      t.check("braking cancels it", !await g(`ctx.dealers.debug.perks.CC.on`) && await g(`ctx.dealers.debug.perks.CC.off`) === "brake", `${JSON.stringify(cc1)} → ${JSON.stringify(await g(`({ on: ctx.dealers.debug.perks.CC.on, off: ctx.dealers.debug.perks.CC.off, st: L3.state })`))}`);
      await W.pause(t, true); await W.moved(t);
    });
    { const r = await W.report(t); W.log(r); W.check(t, "Mazelati (the showroom, the haggle, the perks)", r); await W.reset(t); }

    // ══ stage 2: ⚡ Tushla across the highway + Full Schlep Driving ══
    const D = `__lulu3d.ctx.dealers`;
    await step("ev", async () => {
      t.check("Tushla is built across the highway (a left pull-off at the same lap metre)", await t.until(`${D}.debug.ev.E.spots.some(s => Math.abs(s.s - 16800) < 1 && s.place.side === -1)`, "Tushla built", 30000));
      t.check("…its pull-off is paved on the left, the trees kept off", await t.L(`import("./js/world.js").then(m => m.pavedAt(16800, -20) >= 2 && __lulu3d.ctx.world.reserved.some(r => r.s0 <= 16790 && r.s1 >= 16810 && r.side === -1))`));
      await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      await W.pause(t, false);
      await g(`(() => { const E = ctx.dealers.debug.ev.E, sp = E.spots.find(s => Math.abs(s.s - 16800) < 1); const F = ctx.foot.debug.F; const c = Math.cos(sp.rot), si = Math.sin(sp.rot); F.pos.set(sp.x + 0 * c + 0.9 * si, 0.05, sp.z + 0.9 * c); F.phase = "walk"; return true; })()`);
      await t.frames(6); await g(`(ctx.cam && ctx.cam.snap && ctx.cam.snap(), true)`); await t.frames(6); await W.pause(t, true); await W.moved(t);
      t.check("four EVs out front (+ the tablet)", await t.until(`${D}.debug.ev.E.cars.length === 4`, "EVs", 8000));
      t.check("✋ the tablet", /TUSHLA TABLET/.test(await t.L(`(document.querySelector(".prompt") || {}).textContent || ""`)), await t.L(`(document.querySelector(".prompt") || {}).textContent || ""`));
      await t.shot("tushla");
      await g(`(ctx.dealers.tablet("tushla_nu"), true)`); await t.frames(4);
      const card = await t.L(`(document.querySelector("#screenCard") || {}).textContent || ""`);
      t.check("the tablet card: the cars + ⚡ Full Schlep Driving", /Tushla Motors/.test(card) && /Tushla Nu/.test(card) && /Full Schlep Driving/.test(card), card.slice(0, 200));
      await t.shot("tablet");
      const c0 = await coins();
      await g(`ctx.dealers.debug.ev.buyHere("tushla_nu")`);
      t.check("one tap doesn't buy (the price is the price — two taps)", await coins() === c0 && !(await save()).ownedSkins.includes("tushla_nu"));
      await g(`ctx.dealers.debug.ev.buyHere("tushla_nu")`);
      t.check("…the second buys it: 4,000, no haggling", c0 - await coins() === 4000 && (await save()).ownedSkins.includes("tushla_nu") && await g(`ctx.car.skinKey`) === "tushla_nu");
      t.check("its acceleration beats every Mazelati", await t.L(`import("./js/car.js").then(m => m.SKINS.tushla_nu.acc > m.SKINS.machatunim.acc)`));
      await g(`(ctx.screens && ctx.screens.closeCard ? ctx.screens.closeCard() : 0, true)`);
    });
    await step("sub", async () => {
      const c0 = await coins();
      await g(`ctx.dealers.debug.ev.subHere()`); await g(`ctx.dealers.debug.ev.subHere()`);
      t.check("subscribe: 100 coins, 30 days", c0 - await coins() === 100 && await g(`ctx.dealers.schlep.active() && ctx.dealers.schlep.daysLeft() === 30`));
      t.check("the card says 'renews in 30 days'", /renews in 30 days/.test(await t.L(`document.querySelector("#screenCard").textContent`)) || /30 days left/.test(await t.L(`document.querySelector("#screenCard").textContent`)));
      await g(`ctx.dealers.debug.ev.subHere()`); await g(`ctx.dealers.debug.ev.subHere()`);
      t.check("cancel: still works to the end of what she paid", await g(`ctx.dealers.debug.DS.sub.cancelled === true && ctx.dealers.schlep.active()`));
      await g(`(ctx.schlepNow = () => Date.now() + 31 * 86400000, ctx.dealers.schlep.renewCheck(), true)`);
      t.check("…after 30 days a cancelled one lapses quietly: no charge, no debt", !await g(`ctx.dealers.schlep.active()`) && c0 - await coins() === 100);
      await g(`(ctx.schlepNow = null, true)`);
      t.check("subscribe again", await g(`ctx.dealers.schlep.subscribe().ok`) && c0 - await coins() === 200);
      await g(`(ctx.schlepNow = () => Date.now() + 31 * 86400000, ctx.dealers.schlep.renewCheck(), true)`);
      t.check("not cancelled → it renews once (100) at the end", await g(`ctx.dealers.schlep.active()`) && c0 - await coins() === 300);
      await g(`(ctx.schlepNow = null, true)`);
      await t.L(`import("./js/features/shops/card.js").then(m => m.closeCard(true))`);
      await t.frames(3);
    });
    await step("selfdrive", async () => {
      await W.pause(t, false); await playing(); await W.pause(t, true); await W.moved(t);
      t.check("back in the car", await g(`L3.state === "playing" && !ctx.foot.active`));
      // ⚡ no nitro in an electric car: no bar, no button, the boost button does nothing
      await t.frames(4);
      const ev = await t.L(`(() => { const b = document.querySelector("#hud .boost"), tb = document.getElementById("tBoost"); return { cls: document.body.classList.contains("ev-car"), bar: b ? getComputedStyle(b).display : "none", btn: tb ? getComputedStyle(tb).display : "none", ev: __lulu3d.ctx.G.evCar }; })()`);
      t.check("⚡ a Tushla has no nitro: the bar + the button are gone", ev.cls && ev.ev && ev.bar === "none" && ev.btn === "none", JSON.stringify(ev));
      await g(`(ctx.G.boost = 1, true)`); await t.hold(5, 1); await t.frames(10);
      t.check("…and the nitro button does nothing", !await g(`ctx.G.boosting`));
      await t.hold(5, 0); await t.frames(2);
      await g(`(ctx.dealers.schlep.setMode("meshuga"), true)`);
      t.check("🌶️ Meshuga drives OVER the limit (it can get tickets — that's the price)", await g(`ctx.dealers.schlep.targetSpeed() * 2.23694`) > 75, String(await g(`ctx.dealers.schlep.targetSpeed() * 2.23694`)));
      await g(`(ctx.dealers.schlep.setMode("normal"), true)`);
      await W.pause(t, false);
      await g(`(() => { const s = ctx.car.s + 300, p = ctx.world.road.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(s); ctx.cam.snap(); return true; })()`);
      await t.frames(6); await W.pause(t, true); await W.moved(t);
      const c0 = await coins(), cc0 = await g(`ctx.G.closeCalls`), s0 = await g(`ctx.car.s`);
      t.check("❚❚ offers ⚡ Let the car drive (in a Tushla, subscribed)", await t.L(`import("./js/core/ctx.js").then(m => m.menuItems("pause").some(i => i.id === "schlepOn"))`));
      t.check("engage", await g(`ctx.dealers.schlep.engage()`) && await g(`ctx.G.selfDriving === true`));
      await t.L(`(window.__sd = { max: 0, dev: 0, n: 0 }, true)`);
      for (let i = 0; i < 24; i++) {
        await t.frames(25);
        await t.L(`(() => { const c = __lulu3d.ctx.car, S = window.__sd, L = [1.75, 5.25]; S.max = Math.max(S.max, c.speed * 2.23694); S.dev = Math.max(S.dev, Math.min(...L.map(l => Math.abs(c.d - l)))); S.n++; })()`);
        if (!await g(`ctx.dealers.schlep.on`)) break;
      }
      const SDv = await t.L(`window.__sd`);
      t.check("it drives itself down our side, in a lane", await g(`ctx.dealers.schlep.on`) && await g(`ctx.car.s`) - s0 > 150 && SDv.dev < 1.4 && await g(`ctx.car.d > 0`), `${JSON.stringify(SDv)} · ${(await g(`ctx.car.s`) - s0).toFixed(0)} m · last ${await g(`ctx.dealers.schlep.debug.last`)}`);
      t.check("it never goes over the limit (70 mph)", SDv.max <= 70.5 && SDv.max > 40, SDv.max.toFixed(1));
      t.check("…no close-call bonus, no coins", await g(`ctx.G.closeCalls`) === cc0 && await coins() === c0);
      await g(`(ctx.dealers.schlep.setMode("bubbe"), true)`); await t.frames(200);
      t.check("👵 Bubbe mode slows to 50", await g(`ctx.car.speed * 2.23694`) < 52, String(await g(`ctx.car.speed * 2.23694`)));
      await g(`(ctx.dealers.schlep.setMode("normal"), true)`);
      await t.stick(0.8); await t.frames(4); await t.stick(0); await t.frames(2);
      t.check("steering takes the wheel back (a chime)", !await g(`ctx.dealers.schlep.on`) && await g(`ctx.dealers.schlep.debug.last`) === "you" && !await g(`ctx.G.selfDriving`));
      await t.frames(10);
      await g(`ctx.dealers.schlep.engage()`); await t.frames(20);
      await g(`(ctx.law.startChase("SPEEDING"), true)`); await t.frames(6);
      t.check("a chase hands the wheel back", !await g(`ctx.dealers.schlep.on`) && await g(`ctx.dealers.schlep.debug.last`) === "chase");
      t.check("…and it won't start again while she's wanted", !await g(`ctx.dealers.schlep.engage()`));
      await g(`(ctx.law.lose && ctx.law.lose("lost"), true)`);
    });
    { const r = await W.report(t); W.log(r); W.check(t, "Tushla + Full Schlep Driving", r); }
  },
};
