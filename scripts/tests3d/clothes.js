// 👗 Clothes (features/clothes, roadmap 24): a clothing shop in each town + outfits on Lulu herself.
//   • a save without clothes = today's Lulu exactly (no extra shapes, her own colours)
//   • Lakewood's Simcha's Classic Clothing + Midwood's Avenue J'adore are walk-in rooms (town data `uses.clothes`, ✋ at the door)
//   • try on (free): the fitting room changes her, the mirror view, "take it off" puts her own clothes back, nothing saved
//   • buy at the counter: through garage/buy.js, the coins go down by the price, never below 0, the piece is hers
//   • keep it on: the outfit is saved, she walks out in it (on foot) and the car's Lulu wears the colour; ≤ 2 extra draws
//   • listed in 🛍️ Where to shop; the watchdog stays quiet
const W = require("../lib/qawatch.js");
module.exports = {
  name: "clothes",
  viewport: { width: 1280, height: 720 },
  query: "&enable=town,law,atmos,world,day",
  save2d: { totalCoins: 600, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game;
    const st = () => g(`L3.state`);
    const coins = () => t.L(`import("./js/core/save.js").then(m => m.wallet.coins)`);
    const label = () => g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    const room = id => `window.__interiors && __interiors.room && __interiors.room.ready && __interiors.room.def.id === ${JSON.stringify(id)}`;
    const topOf = expr => g(`(() => { let c = null; (${expr}).traverse(o => { if (o.isMesh && o.material && (o.userData.clBase || o.material).name === "Top" && !c) c = "#" + o.material.color.getHexString(); }); return c; })()`);
    const shapes = expr => g(`(() => { let n = 0; (${expr}).traverse(o => { if (o.userData && o.userData.outfit) n++; }); return n; })()`);
    const playing = async () => { if (await g(`ctx.foot.active`)) { await g(`(ctx.foot.end("test"), true)`); await t.frames(3); } if (await st() !== "playing") { await g(`(L3.setState("playing"), true)`); await t.frames(3); } };
    const town = async id => {
      if (await g(`ctx.town.active && ctx.town.id === ${JSON.stringify(id)}`)) return true;
      await W.pause(t, false);
      await playing();
      if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); await playing(); }
      await g(`(ctx.town.load(${JSON.stringify(id)}), true)`);
      await t.until(`__lulu3d.ctx.town.loaded(${JSON.stringify(id)})`, `${id}'s models load`, 90000);
      await g(`ctx.town.enter({ town: ${JSON.stringify(id)}, speed: 0 })`);
      const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === ${JSON.stringify(id)}`, `into ${id}`, 8000);
      await t.frames(30); await W.pause(t, true); await W.moved(t);
      return ok;
    };
    const onFootAt = async (name, out = 0.3) => {
      if (await st() !== "footRun") {
        await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
        await t.until(`__lulu3d.state === "footRun"`, "out on foot", 8000);
      }
      await W.pause(t, false);
      await g(`(() => { const sp = ctx.town.spot(${JSON.stringify(name)}); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * ${out}, 0.05, sp.z + sp.nz * ${out}); F.phase = "walk"; return true; })()`);
      await t.frames(2); await g(`(ctx.cam && ctx.cam.snap && ctx.cam.snap(), true)`);
      await t.frames(6); await W.pause(t, true); await W.moved(t);
    };
    const walkIn = async re => {
      await onFootAt("clothes");
      const l = await label();
      t.check(`✋ at the clothing shop's door (${l})`, re.test(l));
      await W.pause(t, false);
      await t.tap(0);
      const ok = await t.until(`__lulu3d.state === "interior" && ${room("clothesShop")}`, "inside the clothing shop", 60000);
      await t.frames(10); await W.pause(t, true); await W.moved(t);
      return ok;
    };
    const walkOut = async () => {
      await W.pause(t, false);
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "out of the shop", 30000);
      await t.frames(10); await W.pause(t, true); await W.moved(t);
    };
    // (a flow started the way a ✋ spot starts it: the room is busy until it's over)
    const run = code => g(`(() => { const rt = __interiors.room, D = ctx.clothes.debug.shop, P = id => ctx.clothes.pieces.find(p => p.id === id), o = rt.lulu.obj.position; rt.use({ id: "test", x: o.x, z: o.z + 1, action: () => { ${code}; } }); return true; })()`);
    const idle = what => t.until(`!__lulu3d.ctx.dialogOpen && !__interiors.room.busy && !__interiors.room.mode`, what, 15000);

    await W.install(t);

    // ════ 1. a save without clothes = today's Lulu ════
    t.check("ctx.clothes is there", await g(`!!ctx.clothes && Array.isArray(ctx.clothes.pieces) && ctx.clothes.pieces.length >= 20`));
    t.check("…nothing on: an empty outfit, nothing owned", await g(`JSON.stringify(ctx.clothes.current()) === "{}" && ctx.clothes.owned.length === 0`));
    await W.pause(t, false);      // (the test puts her out on foot: a declared cut)
    await playing();
    await g(`(ctx.foot.start("parked", { noIntro: true }), true)`);
    await t.until(`__lulu3d.state === "footRun" && !!__lulu3d.ctx.foot.obj`, "out on foot", 15000);
    t.check("…on foot she's her old self (sky-blue top, no extra shapes)", await topOf(`ctx.foot.obj`) === "#4fc3f7" && await shapes(`ctx.foot.obj`) === 0, String(await topOf(`ctx.foot.obj`)));
    t.check("every piece has a price, a slot, a shop and one line; the shop prices sit in 40–900",
      await g(`ctx.clothes.pieces.every(p => p.price > 0 && p.slot && p.shop && p.line && p.brand) && ctx.clothes.pieces.filter(p => p.shop !== "jfk").every(p => p.price >= 40 && p.price <= 900)`));
    t.check("🛍️ Where to shop lists the clothing shops", await g(`ctx.shops.places().some(r => r.id === "clothes" && /Simcha/.test(r.where) && /Avenue J/.test(r.where))`));

    // ════ 2. Lakewood: Simcha's Classic Clothing ════
    if (!await town("lakewood")) return;
    t.check("Lakewood has the shop on its street (town data uses.clothes → a spot)", await g(`!!ctx.town.spot("clothes")`));
    t.check("…walk in (✋ at the door → a room)", await walkIn(/SIMCHA/));
    t.check("…the room: racks, the counter + Mrs. Rosenbaum, the fitting room, a mannequin",
      await g(`["rackA", "rackB", "table", "counter", "fitting", "mannequin"].every(id => __interiors.room.hots.some(h => h.id === id)) && !!__interiors.room.byId.clerk`));
    await t.shot("simchas");
    const lulu = `__interiors.room.lulu.obj`;
    t.check("…Lulu walks in in her own clothes (sky-blue top, no extra shapes)", await topOf(lulu) === "#4fc3f7" && await shapes(lulu) === 0, `${await topOf(lulu)} · ${await shapes(lulu)}`);

    // try on (free): the blouse
    const W0 = await coins();
    await W.pause(t, false);
    await run(`return D.tryOn(rt, P("lk_blouse"))`);
    await t.until(`__lulu3d.ctx.dialogOpen`, "the mirror's question", 12000);
    await t.frames(20);
    await t.shot("tryon-mirror");
    t.check("trying on: she's wearing the white blouse in the fitting room", await topOf(lulu) === "#ffffff", await topOf(lulu));
    t.check("…it's free and nothing is saved yet", await coins() === W0 && await g(`!ctx.clothes.current().top`));
    await t.click(/Take it off/);
    await idle("back out of the fitting room");
    t.check("…take it off: her own top again, still nothing saved", await topOf(lulu) === "#4fc3f7" && await g(`!ctx.clothes.current().top`));

    // buy at the counter: the coat (450) — then the robe (300) is more than she has left
    await run(`return D.buyAtCounter(rt, P("lk_coat"), false)`);
    await idle("the coat bought + handed over");
    t.check("buying the navy coat: −450 coins, it's hers", await coins() === W0 - 450 && await g(`ctx.clothes.owns("lk_coat")`), `${W0} → ${await coins()}`);
    t.check("…the bag is in her hand", await g(`!!__interiors.room.inHand`));
    const W1 = await coins();
    await run(`return D.buyAtCounter(rt, P("lk_robe"), false)`);
    await idle("no sale");
    t.check("the robe (300) with 150 left: no sale, the wallet unchanged (never below 0)", await coins() === W1 && await g(`!ctx.clothes.owns("lk_robe")`));

    // keep it on: the coat she owns
    await run(`return D.tryOn(rt, P("lk_coat"))`);
    await t.until(`__lulu3d.ctx.dialogOpen`, "the mirror's question", 12000);
    await t.frames(30);      // (the line types out first: a tap then would only finish it)
    const opts = await t.L(`[...document.querySelectorAll("#dialog button")].map(b => b.textContent).join(" | ")`);
    t.check("…the mirror asks: keep it on (she owns it)", await t.click(/Keep it on/), opts);

    await idle("out of the fitting room");
    t.check("keep it on: the coat is her outfit now (saved)", await g(`ctx.clothes.current().outer === "lk_coat"`));
    t.check("…the coat is on her: navy sleeves + one coat shape", await topOf(lulu) === "#1d2a5c" && await shapes(lulu) === 1, `${await topOf(lulu)} · ${await shapes(lulu)}`);
    await t.shot("coat-on");
    await W.pause(t, true); await W.moved(t);
    await walkOut();
    { const d = await g(`(() => { const sp = ctx.town.spot("clothes"), p = ctx.foot.pos; return +Math.hypot(sp.x - p.x, sp.z - p.z).toFixed(1); })()`);
      t.check(`…out of the shop's own door (${d} m), still in town`, d < 7 && await g(`ctx.town.active`)); }
    t.check("she walks out of the shop in it (on foot: the coat)", await topOf(`ctx.foot.obj`) === "#1d2a5c" && await shapes(`ctx.foot.obj`) === 1, `${await topOf(`ctx.foot.obj`)}`);
    t.check("…at the wheel too (the car's Lulu: the coat's colour)", await g(`(() => { let c = null; ctx.car.driver && ctx.car.driver.traverse(o => { if (o.isMesh && (o.userData.clBase || o.material).name === "Shirt") c = "#" + o.material.color.getHexString(); }); return c; })()`) === "#1d2a5c");
    t.check("…the save holds it (owned + wearing) for the 💾 save code", await t.L(`(() => { const s = JSON.parse(localStorage.getItem("lulu3dSave") || "{}"); const c = (s.f || {}).clothes || {}; return c.owned && c.owned.includes("lk_coat") && c.wear && c.wear.outer === "lk_coat"; })()`).catch(() => false) || await g(`ctx.clothes.debug.S.wear.outer === "lk_coat"`));
    t.check("…the compact form for other players round-trips", await g(`ctx.clothes.decode(ctx.clothes.encode(ctx.clothes.current())).outer === "lk_coat" && JSON.stringify(ctx.clothes.decode("junk,,,,nope")) === "{}"`));
    await t.shot("street-coat");
    { const r = await W.report(t); W.log(r); W.check(t, "Lakewood's clothing shop", r); await W.reset(t); }

    // ════ 3. Midwood: Avenue J'adore ════
    if (!await town("midwood")) return;
    t.check("Midwood: Avenue J'adore is walk-in", await walkIn(/AVENUE J'ADORE/));
    t.check("…its own stock (the puffer, the It Bag, the iced coffee)", await g(`["mw_puffer", "mw_itbag", "mw_coffee"].every(id => ctx.clothes.pieces.find(p => p.id === id).shop === "midwood")`));
    await run(`return D.tryOn(rt, P("mw_coffee"))`);
    await t.until(`__lulu3d.ctx.dialogOpen`, "the mirror's question", 12000);
    await t.frames(30);
    t.check("trying on the iced coffee: one shape in her hand (+ the coat: 2 extra at most)", await shapes(lulu) === 2, String(await shapes(lulu)));
    await t.shot("javenue-tryon");
    await t.click(/Take it off/);
    await idle("out of the fitting room");
    // a line-up of every shape (a still for people to look at; removed again)
    const lined = await t.L(`import("./js/core/people.js").then(m => { const rt = __interiors.room, out = []; const looks = [{ outer: "mw_puffer", acc: "mw_shades" }, { outer: "mw_camel", acc: "mw_itbag" }, { outer: "lk_robe" }, { outer: "lk_cardigan", top: "lk_blouse", acc: "lk_pearls" }, { top: "mw_sweater", skirt: "mw_tennis", shoes: "mw_sneakers", acc: "mw_headband" }, { top: "lk_blue", skirt: "lk_navy", acc: "lk_pocketbook", shoes: "lk_shoes" }]; looks.forEach((o, i) => { const p = m.spawnPerson("luluPerson", { outfit: o }); p.obj.position.set(-3.2 + i * 1.25, 0, 2.2); rt.add(p.obj); out.push(p.obj); }); window.__lineup = out; rt.def.cam = Object.assign({}, rt.def.cam, { dist: 5.2, height: 1.6, lookY: 0.9, clampX: 0 }); rt.lulu.obj.position.set(0, 0, 0.6); return out.length; })`);
    await t.frames(40);
    await t.shot("lineup");
    t.check("the line-up: every coat + extra shape builds (6 Lulus, one or two shapes each)", lined === 6 && await t.L(`window.__lineup.every(o => { let n = 0; o.traverse(x => { if (x.userData.outfit) n++; }); return n >= 1 && n <= 2; })`));
    await t.L(`(window.__lineup.forEach(o => o.removeFromParent()), true)`);
    await walkOut();
    { const r = await W.report(t); W.log(r); W.check(t, "Midwood's clothing shop", r); }

    // ════ 4. her closet at Ima's: the only place at home she changes ════
    await W.pause(t, false);          // (the test takes her home through the title: not gameplay)
    await playing();
    if (await g(`ctx.town.active`)) { await g(`(ctx.town.leave("reset"), true)`); await t.frames(10); }
    await g(`(L3.setState("title"), true)`);
    await t.frames(20);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot at home", 60000)) return;
    t.check("at home she's still in the coat (the save)", await topOf(`ctx.foot.obj`) === "#1d2a5c");
    const door = await g(`ctx.decor.debug.spotAt("door")`);
    await g(`(() => { const F = ctx.foot.debug.F; F.pos.set(${door.x}, 0.05, ${door.z}); F.phase = "walk"; ctx.foot.obj.position.copy(F.pos); return true; })()`);
    await t.frames(3);
    await t.until(`__lulu3d.ctx.interiors.luluHome.ready()`, "house warmed", 60000);
    await g(`ctx.decor.enter()`);
    if (!await t.until(`__lulu3d.state === "interior" && ${room("luluHome")}`, "inside Ima's house", 30000)) return;
    await t.frames(10);
    t.check("a closet in her room at Ima's (✋ outside every wall)", await g(`(() => { const r = __interiors.room, h = r.hots.find(x => x.id === "closet"); if (!h) return false; return !r.cols.some(c => c.on !== false && h.x > c.x0 && h.x < c.x1 && h.z > c.z0 && h.z < c.z1); })()`));
    t.check("…and still no decorating at Ima's", !(await g(`__interiors.room.hots.some(h => /^slot:/.test(h.id))`)));
    await run(`return ctx.clothes.debug.closet.openCloset(rt)`);
    await t.until(`!!document.querySelector("#screenCard .sp")`, "the closet card", 15000);
    await t.frames(20);
    t.check("the closet card: her coat + 'No coat'", await t.L(`["lk_coat", "plain:outer"].every(id => !!document.querySelector('#screenCard .dp-opt[data-opt="' + id + '"]'))`));
    await t.L(`document.querySelector('#screenCard .dp-opt[data-opt="plain:outer"]').click()`);
    await t.frames(4);
    t.check("…picking 'No coat' previews it on her (no coat shape), nothing saved yet", await shapes(lulu) === 0 && await g(`ctx.clothes.current().outer === "lk_coat"`));
    await t.shot("closet");
    await t.click(/Put it on/);
    await idle("changed at the closet");
    t.check("…👗 Put it on: changed (the coat off, saved)", await g(`!ctx.clothes.current().outer`) && await topOf(lulu) === "#4fc3f7");
    await run(`return ctx.clothes.debug.closet.openCloset(rt)`);
    await t.until(`!!document.querySelector("#screenCard .sp")`, "the closet card again", 15000);
    await t.frames(10);
    await t.L(`document.querySelector('#screenCard .dp-opt[data-opt="lk_coat"]').click()`);
    await t.frames(3);
    await t.click(/Save this look/);
    t.check("…💾 save this look: kept as Look 1", await g(`ctx.clothes.debug.S.saved.length === 1 && ctx.clothes.debug.S.saved[0].outer === "lk_coat"`));
    await t.click(/^Done/);
    await idle("closet closed");
    t.check("…Done without putting it on: back in what she wore", await g(`!ctx.clothes.current().outer`) && await shapes(lulu) === 0);
    await W.pause(t, false);
    await g(`(window.__interiors.room.leave(), true)`);
    await t.until(`__lulu3d.state === "footRun"`, "back out on the porch", 30000);

    // ════ 5. friends see it: her look rides in the party state; a friend's Lulu wears what she sends ════
    t.check("a friend's outfit (d.x.ot) dresses the Lulu drawn for her; an old client's (none) = the default look", await t.L(`import("./js/core/people.js").then(m => {
      const C = __lulu3d.ctx.clothes, n = o => { let k = 0; o.traverse(x => { if (x.userData.outfit) k++; }); return k; };
      const a = m.spawnPerson("luluPerson", { outfit: C.outfitOf({ x: { ot: C.encode({ outer: "mw_puffer", acc: "mw_shades" }) } }) });
      const b = m.spawnPerson("luluPerson", { outfit: C.outfitOf({ x: {} }) });
      const c = m.spawnPerson("luluPerson", { colors: { Top: "#FF6D2E", Bottom: "#FF6D2E" } });
      return n(a.obj) === 1 && n(b.obj) === 0 && n(c.obj) === 0;
    })`));

    // ════ 6. JFK's luxury house (built + waiting for its door from the airport: direct entry) ════
    t.check("Maison de Gelt's stock: 8 pieces at 2,000–25,000; the bag costs more than the cheapest house",
      await g(`(() => { const L = ctx.clothes.pieces.filter(p => p.shop === "jfk"); const bag = L.find(p => p.id === "jfk_bag"); return L.length === 8 && L.every(p => p.price >= 2000 && p.price <= 25000) && bag.price > 7000; })()`));
    await W.pause(t, false);
    await g(`ctx.clothes.enterAs("jfk", { exit: () => L3.setState("footRun", { resume: "interior" }) })`);
    if (await t.until(`__lulu3d.state === "interior" && ${room("clothesShop")}`, "inside Maison de Gelt", 60000)) {
      await t.frames(20);
      t.check("…walk in: MAISON DE GELT, Giselle (born Gittel) at the counter", /MAISON DE GELT/.test(await g(`__interiors.room.def.title`)) && /Gittel/.test(await g(`__interiors.room.byId.clerk.name`)));
      await t.shot("maison-de-gelt");
      const W2 = await coins();
      await run(`return D.buyAtCounter(rt, P("jfk_bag"), false)`);
      await idle("no sale at Maison de Gelt");
      t.check("…Le Sac Kugel (25,000) with " + W2 + " coins: no sale, nothing spent", await coins() === W2 && await g(`!ctx.clothes.owns("jfk_bag")`));
      // ── 👜 numbered pieces, world-wide (a fake relay behind a stubbed fetch: reserve → pay → confirm) ──
      await t.L(`(() => {
        const W = window.__fakeWear = { stock: { jfk_bag: { total: 25, left: 0 }, jfk_trench: { total: 50, left: 0 }, jfk_wrap: { total: 75, left: 12 }, jfk_shades: { total: 100, left: 40 } }, held: {}, mine: {}, expireNext: false, calls: [] };
        const real = window.__realFetch = window.__realFetch || window.fetch;
        window.fetch = async (url, o) => {
          const u = String(url); if (!u.startsWith("http://fake-relay")) return real(url, o);
          const p = u.slice("http://fake-relay".length), b = o && o.body ? JSON.parse(o.body) : {}; W.calls.push(p);
          const J = (j, st = 200) => ({ status: st, json: async () => j });
          if (p === "/wear/stock") return J({ v: 1, stock: W.stock });
          if (p === "/wear/mine") return J({ mine: Object.entries(W.mine).map(([k, n]) => ({ p: k, n, st: 2 })), stock: W.stock });
          const s = W.stock[b.p];
          if (p === "/wear/reserve") { if (W.mine[b.p]) return J({ ok: false, why: "owned", n: W.mine[b.p] }); if (!s.left) return J({ ok: false, why: "soldout" }); W.held[b.p] = s.total - s.left + 1; s.left--; return J({ ok: true, n: W.held[b.p], total: s.total }); }
          if (p === "/wear/confirm") { if (W.expireNext) { W.expireNext = false; delete W.held[b.p]; s.left++; return J({ ok: false, why: "expired" }); } const n = W.held[b.p]; delete W.held[b.p]; W.mine[b.p] = n; return J({ ok: true, n, total: s.total }); }
          if (p === "/wear/cancel") { if (W.held[b.p]) { delete W.held[b.p]; s.left++; } return J({ ok: true }); }
          return J({ error: "nf" }, 404);
        };
        const L = __lulu3d.ctx.clothes.debug.limited.L; L.testBase = "http://fake-relay"; L.testAccount = true;
        return true;
      })()`);
      await g(`ctx.clothes.refreshStock(true)`);
      await t.frames(5);
      t.check("the shelf: the bag SOLD OUT, the wrap '12 of 75 left', a plain luxury piece has no tag", await g(`(() => { const T = ctx.clothes.debug.shop; const s = ctx.clothes.stockOf; return s("jfk_bag").left === 0 && s("jfk_wrap").left === 12 && s("jfk_wrap").total === 75 && !s("jfk_silk").limited; })()`));
      await g(`(ctx.clothes.debug.S.owned.length, true)`);
      await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 10000; }); })`);
      const C0 = await coins();
      await run(`return D.buyAtCounter(rt, P("jfk_wrap"), false)`);
      await idle("the wrap bought");
      t.check("buying the wrap: the server's number (No. 64 of 75), −6,500 coins, hers", await g(`ctx.clothes.owns("jfk_wrap") && ctx.clothes.debug.S.nums.jfk_wrap === 64`) && await coins() === C0 - 6500, `${C0} → ${await coins()} · ${await g(`JSON.stringify(ctx.clothes.debug.S.nums)`)}`);
      t.check("…reserve → confirm on the relay, nothing pending", await t.L(`window.__fakeWear.calls.includes("/wear/reserve") && window.__fakeWear.calls.includes("/wear/confirm") && Object.keys(__lulu3d.ctx.clothes.debug.S.pending).length === 0`));
      const C1 = await coins();
      await run(`return D.buyAtCounter(rt, P("jfk_bag"), false)`);
      await idle("the bag: sold out");
      t.check("the bag (sold out): no sale, no coins", await coins() === C1 && await g(`!ctx.clothes.owns("jfk_bag")`));
      await t.L(`(window.__fakeWear.expireNext = true, true)`);
      await run(`return D.buyAtCounter(rt, P("jfk_shades"), false)`);
      await idle("the shades: the hold ran out");
      t.check("a hold that ran out before confirm: the coins come back, the piece isn't hers", await coins() === C1 && await g(`!ctx.clothes.owns("jfk_shades")`), `${C1} → ${await coins()}`);
      await g(`(ctx.clothes.debug.limited.L.testAccount = false, true)`);
      const accountOn = await g(`!!(ctx.accounts && ctx.accounts.name)`);
      if (!accountOn) {
        await run(`return D.buyAtCounter(rt, P("jfk_shades"), false)`);
        await idle("no account");
        t.check("no username: a numbered piece can't be bought (one line at the counter), no coins", await coins() === C1 && await g(`!ctx.clothes.owns("jfk_shades")`));
      }
      await g(`(ctx.clothes.debug.limited.L.testAccount = true, true)`);
      // a new phone: the server says the trench is hers → it comes back, never charged
      await t.L(`(window.__fakeWear.mine.jfk_trench = 7, true)`);
      await g(`ctx.clothes.restore()`);
      await t.frames(3);
      t.check("restore: a numbered piece the server says is hers comes back (No. 7 of 50), no charge", await g(`ctx.clothes.owns("jfk_trench") && ctx.clothes.debug.S.nums.jfk_trench === 7`) && await coins() === C1);
      await t.L(`(() => { window.fetch = window.__realFetch; const L = __lulu3d.ctx.clothes.debug.limited.L; L.testBase = null; L.testAccount = false; return true; })()`);
      await g(`(__interiors.room.leave(), true)`);
      await t.until(`__lulu3d.state === "footRun"`, "back out", 30000);
    }
  },
};
