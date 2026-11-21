// 🛋️ DECOR — Lulu's own house + decorating it with coins (roadmap step 9).
//
//  • the home start: her front door is a ✋ spot (🏠 GO INSIDE), warmed on the porch → a SOFT cut into the house
//    (no black), the kitchen with Ima, the living room, her room; back out lands her on the porch steps
//  • inside, ✋ at the bed → the picker: moving over a choice previews it in place (no coins), the first press asks,
//    the second BUYS (coins − price, it appears, it's saved); swapping back to something she owns is free
//  • can't go below 0: a too-dear buy fails and changes nothing; nothing here ever pays coins out
//  • outside: ✋ at the mailbox → buy one → it shows on the street; the door's paint
//  • reload → still there (on the title, from the street)
//  • a 🎉 party: nothing sold; the picker card fits phone (portrait + landscape) and TV layouts
const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

module.exports = {
  name: "decor",
  query: "&enable=world,foot,phone",
  viewport: { width: 1280, height: 720 },
  save2d: { totalCoins: 1000, cruiseUnlocked: true, cruisePlayed: true, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const g = t.game;
    const coins = () => g(`L3.wallet.coins`);
    const st = () => g(`ctx.state`);
    const flush = () => t.L(`import("./js/core/save.js").then(m => { m.flushShared(); m.saveNow(); return true; })`);
    // every coin event (nothing in decor may pay out)
    await g(`(window.__decorCoins = [], L3.on("coin", e => window.__decorCoins.push(e)), L3.on("wallet", e => { if (e.delta > 0) window.__decorCoins.push({ wallet: e.delta }); }), true)`);
    await t.frames(10);

    // ── the title: the house with its default look ──
    const T0 = await g(`({ door: ctx.decor.debug.doorColor(), out: ctx.decor.debug.outside(), calls: ctx.decor.debug.calls() })`);
    t.check("title: the front door is the classic pink", T0.door === "e91e63" || /e91e63/i.test(T0.door), T0.door);
    t.check("…no decorations yet (no extra draw calls)", T0.out.length === 0 && T0.calls === 0, JSON.stringify(T0));

    // ── Cruise → on foot at home; the front door is a ✋ spot ──
    await t.click(/PLAY/);   // the title is one big ▶ PLAY (features/onegame)
    t.check("Cruise starts on foot at home", await t.until(`__lulu3d.state === "footRun"`, "footRun", 3000));
    await t.frames(20);
    const I0 = await g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check("at the bottom of the steps: not the door yet", !/GO INSIDE/.test(I0), I0);
    const door = await g(`ctx.decor.debug.spotAt("door")`);
    await g(`(ctx.foot.pos.set(${door.x}, 0.05, ${door.z + 0}), ctx.foot.obj.position.copy(ctx.foot.pos), true)`);
    await t.frames(3);
    const I1 = await g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check("at the front door: ✋ 🏠 GO INSIDE", /GO INSIDE/.test(I1), I1);
    // (the door warms the house while she's on the porch)
    t.check("the house loads while she's on the porch", await t.until(`__lulu3d.ctx.interiors.luluHome.ready()`, "house warmed", 60000));
    await t.frames(2);
    await t.tap(0);
    t.check("✋ → inside her house", await t.until(`__lulu3d.state === "interior" && window.__interiors.room && window.__interiors.room.ready`, "inside", 8000));
    const R0 = await g(`(() => { const r = window.__interiors.room; return { id: r.def.id, soft: !!r.soft, ima: !!r.byId.ima, hots: r.hots.map(h => h.id), fade: +getComputedStyle(document.getElementById("intFade")).opacity }; })()`);
    t.check("it's Lulu's house", R0.id === "luluHome", R0.id);
    t.check("a soft cut (warmed: no black loading screen)", R0.soft && R0.fade < 0.05, JSON.stringify({ soft: R0.soft, fade: R0.fade }));
    t.check("Ima is in the kitchen", R0.ima);
    t.check("every inside spot is a hotspot", ["slot:bed", "slot:lamp", "slot:art", "slot:shelf", "slot:rug", "slot:wallpaper", "slot:couch", "door", "ima"].every(h => R0.hots.includes(h)), R0.hots.join(","));
    t.check("Dina is in the living room, with a hotspot to talk to", (await g(`(() => { const r = window.__interiors.room; return !!r.byId.dina && r.hots.some(h => h.id === "dina"); })()`)), "no Dina inside");
    await t.frames(20);
    await t.shot("inside");

    // ── the bed: preview, ask, buy ──
    const to = async id => {
      const sp = await g(`ctx.decor.debug.houseSpots.${id}`);
      await g(`(() => { const L = window.__interiors.room.lulu.obj; L.position.set(${sp.x}, 0, ${sp.z} + 0.25); L.rotation.y = Math.PI; return true; })()`);
      await t.frames(3);
      return g(`(() => { const n = window.__interiors.room.near; return n ? n.id : ""; })()`);
    };
    t.check("walk up to the bed: its hotspot", (await to("bed")) === "slot:bed");
    const c0 = await coins();
    await t.tap(0);
    await t.frames(3);
    t.check("✋ → the picker for the bed", (await g(`ctx.decor.debug.pickerSlot`)) === "bed");
    const tiles = await t.L(`[...document.querySelectorAll(".dp-opt")].map(b => b.dataset.opt + "|" + b.querySelector("em").textContent)`);
    t.check("…every choice with its price, the old bed already in place", tiles.length === 5 && /basic\|✓ In place/.test(tiles[0]) && /fluffy\|80/.test(tiles[1]), tiles.join(" · "));
    await t.tap(15);                                    // D-pad → : Pink & fluffy
    await t.frames(3);
    const P1 = await g(`(() => { const V = window.__interiors.room.data.V; return { shown: Object.keys(V.cache.bed).filter(k => V.cache.bed[k] && V.cache.bed[k].visible), placed: ctx.decor.placed("bed") }; })()`);
    t.check("moving over it PREVIEWS it in place (not bought)", P1.shown.join() === "fluffy" && P1.placed === "basic" && (await coins()) === c0, JSON.stringify(P1));
    await t.shot("picker-preview");
    await t.tap(0);
    const ask = await t.L(`document.querySelector(".dp-opt.focus em").textContent`);
    t.check("the first press asks (no coins yet)", /Buy/.test(ask) && (await coins()) === c0, ask);
    await t.tap(0);
    await t.frames(2);
    const B1 = await g(`({ owns: ctx.decor.owns("bed", "fluffy"), placed: ctx.decor.placed("bed"), coins: L3.wallet.coins, spent: ctx.decor.spent })`);
    t.check("the second press BUYS it: −80 coins, placed", B1.owns && B1.placed === "fluffy" && B1.coins === c0 - 80 && B1.spent === 80, JSON.stringify(B1));
    await t.frames(10);
    await t.shot("bought-bed");
    // back to the old bed: free (she owns it), and the fluffy one stays hers
    await t.tap(14);
    await t.tap(0);
    await t.frames(2);
    t.check("swapping back to something she owns is free", (await g(`ctx.decor.placed("bed")`)) === "basic" && (await coins()) === c0 - 80);
    await t.tap(15); await t.tap(0); await t.frames(2);
    t.check("…and back again, still free", (await g(`ctx.decor.placed("bed")`)) === "fluffy" && (await coins()) === c0 - 80);

    // ── can't go below 0: a too-dear buy fails and changes nothing ──
    await g(`(L3.wallet.spend(L3.wallet.coins - 50), true)`);
    await t.frames(2);
    await t.tap(15); await t.tap(15);                   // → Race-car bed (450)
    await t.frames(2);
    await t.tap(0); await t.tap(0);
    await t.frames(2);
    const B2 = await g(`({ owns: ctx.decor.owns("bed", "racecar"), placed: ctx.decor.placed("bed"), coins: L3.wallet.coins })`);
    t.check("a buy she can't afford: refused, no coins taken, not hers", !B2.owns && B2.placed === "fluffy" && B2.coins === 50, JSON.stringify(B2));
    t.check("…and the wallet never goes below 0", (await g(`(ctx.decor.buy("lamp", "disco"), L3.wallet.coins)`)) === 50);
    // close: the preview goes back to what's placed
    await t.tap(1);
    await t.frames(3);
    const P2 = await g(`(() => { const V = window.__interiors.room.data.V; return { open: ctx.decor.debug.pickerSlot, shown: Object.keys(V.cache.bed).filter(k => V.cache.bed[k] && V.cache.bed[k].visible) }; })()`);
    t.check("○ closes the picker; the placed bed shows again", !P2.open && P2.shown.join() === "fluffy", JSON.stringify(P2));
    // walking is back
    t.check("…and she can walk again", !(await g(`window.__interiors.room.mode`)));

    // ── the wallpaper (a paint, not a model) + a whole room's draw calls ──
    await g(`(L3.wallet.add(1000), true)`);
    await t.frames(3);
    t.check("the wallpaper spot", (await to("wallpaper")) === "slot:wallpaper");
    await g(`ctx.decor.buy("wallpaper", "clouds")`);
    t.check("bought the clouds: the walls change", (await g(`ctx.decor.placed("wallpaper")`)) === "clouds");
    const calls = await g(`(() => { const r = L3.renderer; r.info.reset(); r.render(window.__interiors.room.set.scene, window.__interiors.room.set.camera); return r.info.render.calls; })()`);
    t.check("the whole house is a modest number of draw calls", calls > 0 && calls < 200, calls + " calls");

    // ── out the front door: on the porch steps ──
    await g(`(window.__interiors.room.leave(), true)`);
    t.check("leaving → back on foot", await t.until(`__lulu3d.state === "footRun"`, "outside", 4000));
    await t.frames(4);
    const O1 = await g(`({ p: { x: ctx.foot.pos.x, z: ctx.foot.pos.z }, door: ctx.decor.debug.spotAt("door") })`);
    t.check("…on her own porch steps", near(O1.p, O1.door) < 3.5, near(O1.p, O1.door).toFixed(2) + " m from the door");
    await t.frames(30);
    const camL = await g(`(() => { const h = ctx.places.home ? null : null; const H = ctx.decor.debug.houseLocal(ctx.camera.position); return H; })()`);
    const inHouse = camL.x > -10.6 && camL.x < 5.2 && camL.z > -4.2 && camL.z < 4.2, underPorch = camL.x > -3.7 && camL.x < 4.3 && camL.z > 3.9 && camL.z < 6.7 && camL.y < 3.2;
    t.check("…and the camera is out on the lawn, not inside the house", !inHouse && !underPorch, JSON.stringify(camL));

    // ── outside: the mailbox ──
    const mb = await g(`ctx.decor.debug.spotAt("mailbox")`);
    await g(`(ctx.foot.pos.set(${mb.x}, 0.05, ${mb.z}), ctx.foot.obj.position.copy(ctx.foot.pos), true)`);
    await t.frames(3);
    const I2 = await g(`(ctx.foot.debug.interactables() || {}).label || ""`);
    t.check("at the mailbox: ✋ JAZZ UP THE MAILBOX", /MAILBOX/.test(I2), I2);
    const c1 = await coins();
    await t.tap(0);
    await t.frames(4);
    t.check("✋ → the mailbox picker (the camera frames it)", (await g(`ctx.decor.debug.pickerSlot`)) === "mailbox" && (await g(`ctx.foot.phase`)) === "script");
    await t.tap(15); await t.tap(15);                    // → fish (90)
    await t.frames(3);
    const pv = await g(`ctx.decor.debug.outside()`);
    t.check("…the fish previews on the street (not bought yet)", pv.includes("mailbox:fish") && (await g(`ctx.decor.placed("mailbox")`)) === "plain" && (await coins()) === c1, pv.join());
    await t.tap(0); await t.tap(0);
    await t.frames(10);
    await t.shot("mailbox-fish");
    t.check("bought the fish mailbox (−90)", (await g(`ctx.decor.placed("mailbox")`)) === "fish" && (await coins()) === c1 - 90);
    await t.tap(1);
    await t.frames(4);
    t.check("closed: she walks again", (await g(`ctx.foot.phase`)) === "walk" && !(await g(`ctx.decor.debug.pickerSlot`)));
    // the door paint + a flamingo, straight through the service
    await g(`(ctx.decor.buy("door", "mint"), ctx.decor.buy("lawn", "flamingo"), ctx.decor.buy("porch", "lights"), true)`);
    await t.frames(3);
    const O2 = await g(`({ door: ctx.decor.debug.doorColor(), out: ctx.decor.debug.outside(), calls: ctx.decor.debug.calls() })`);
    t.check("outside: the mint door, the fish, the flamingo, the lights", /5fd3b3/i.test(O2.door) && ["mailbox:fish", "lawn:flamingo", "porch:lights"].every(x => O2.out.includes(x)), JSON.stringify(O2));
    t.check("…a few draw calls for all of it", O2.calls > 0 && O2.calls <= 8, O2.calls + " calls");
    await g(`(() => { const c = ctx.camera, h = ctx.places.home; return true; })()`);
    await t.shot("outside");

    // ── the flamingo is solid (she can't walk through it); the gnomes are low (she hops them) ──
    const Y1 = await g(`ctx.decor.debug.yard()`);
    t.check("the flamingo is a solid piece of the yard (and only it)", Y1.length === 1 && Y1[0].opt === "flamingo" && Y1[0].kind === "pole", JSON.stringify(Y1));
    await g(`(() => { const y = ctx.decor.debug.yard()[0], F = ctx.foot; F.pos.set(y.x + 0.05, 0, y.z + 0.05); F.obj.position.copy(F.pos); return 1; })()`);
    await t.frames(6);
    const Y3 = await g(`(() => { const y = ctx.decor.debug.yard()[0], F = ctx.foot; return Math.hypot(F.pos.x - y.x, F.pos.z - y.z); })()`);
    t.check("standing in the flamingo's spot, she's pushed out of it", Y3 > 0.3, Y3.toFixed(2) + " m from its middle");
    await g(`(ctx.decor.buy("lawn", "gnomes"), true)`);
    await t.frames(3);
    const Y4 = await g(`ctx.decor.debug.yard()`);
    t.check("the gnomes: three low pieces she can hop; the flamingo's collider is off", Y4.length === 3 && Y4.every(y => y.opt === "gnomes" && y.kind === "bench"), JSON.stringify(Y4));
    await g(`(ctx.decor.place("lawn", "flamingo"), true)`);
    // ── 🏠 My house, inside 💬 Messages (no tenth app): what she's bought + how close each set is ──
    await g(`(ctx.phone.openPhone("messages"), true)`);
    await t.frames(6);
    t.check("📱 Messages: a 🏠 My house row (with how many things)", await t.L(`(() => { const b = document.querySelector("#lpHouse"); return !!b && /My house/.test(b.textContent) && /things/.test(b.textContent); })()`));
    await t.L(`document.querySelector("#lpHouse").click()`);
    await t.frames(4);
    const MH = await t.L(`document.querySelector(".lp-chat").textContent`);
    t.check("…tap it: the sets with n/m, and the things she bought", /Pink Dream/.test(MH) && /Disco Night/.test(MH) && /\d\/\d/.test(MH) && /flamingo/i.test(MH), MH.slice(0, 200));
    await g(`(ctx.phone.closePhone(), true)`);
    await t.frames(4);

    // ── a set: Pink Dream noticed (never coins) ──
    const before = await coins();
    await g(`(() => { for (const [s, o] of [["porch","baskets"],["mailbox","pink"],["lawn","flamingo"],["bed","fluffy"],["wallpaper","pink"],["rug","round"],["shelf","plush"],["couch","velvet"]]) ctx.decor.buy(s, o); return true; })()`);
    const SET = await g(`ctx.decor.sets`);
    t.check("wearing every Pink Dream piece completes the set", SET.includes("pink"), SET.join());
    t.check("…and pays nothing back (coins only went down)", (await coins()) < before);

    // ── nothing in decor ever paid out ──
    const paid = await g(`window.__decorCoins.filter(e => (e.why && /decor/.test(e.why)))`);
    t.check("nothing in decor paid coins", paid.length === 0, JSON.stringify(paid).slice(0, 200));

    // ── a 🎉 party: nothing sold ──
    const party = await g(`(() => { const m = ctx.G.mode; ctx.G.mode = "party"; const r = ctx.decor.buy("rug", "zebra"); const sp = ctx.foot.debug.interactables(); ctx.G.mode = m; return { r, owns: ctx.decor.owns("rug", "zebra"), label: sp ? sp.label : "" }; })()`);
    t.check("in a party: no buying", !party.r.ok && party.r.why === "party" && !party.owns, JSON.stringify(party));

    // ── layouts: the picker card fits a phone (both ways) and a TV ──
    await g(`(ctx.foot.pos.set(${mb.x}, 0.05, ${mb.z}), ctx.foot.obj.position.copy(ctx.foot.pos), true)`);
    await t.frames(2);
    await g(`ctx.decor.pick("lawn")`);
    await t.frames(4);
    for (const [name, w, h, tv] of [["phone-portrait", 390, 844, false], ["phone-landscape", 844, 390, false], ["tv-1080", 1920, 1080, true], ["desktop", 1280, 720, false]]) {
      await t.page.setViewportSize({ width: w, height: h });
      await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = ${tv ? '"on"' : '"off"'}; })`);
      await g(`(ctx.applySettings(), true)`);
      await t.frames(4);
      const f = await t.L(`(() => { const c = document.getElementById("screenCard"), r = c.getBoundingClientRect(), opts = [...c.querySelectorAll(".dp-opt")];
        const small = opts.filter(b => { const q = b.getBoundingClientRect(); return q.width < 44 || q.height < 44; }).length;
        return { ok: r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= -1 && c.scrollWidth <= c.clientWidth + 2, top: Math.round(r.top), h: innerHeight, small, n: opts.length,
          scrolls: c.scrollHeight > c.clientHeight + 2, tv: document.body.classList.contains("tv") }; })()`);
      t.check(`the picker fits ${name} (${w}×${h})`, f.ok && f.small === 0 && f.n === 6, JSON.stringify(f));
      t.check(`…and leaves the top of the screen for the view (${name})`, f.top > h * 0.35, `card top ${f.top} of ${h}`);
      await t.shot(`picker-${name}`);
    }
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.tv = "off"; })`);
    await g(`(ctx.applySettings(), true)`);
    await t.tap(1);
    await t.frames(3);

    // ── reload: still there ──
    const keep = await g(`({ bed: ctx.decor.placed("bed"), mailbox: ctx.decor.placed("mailbox"), door: ctx.decor.placed("door"), coins: L3.wallet.coins })`);
    await flush();
    await t.page.reload();
    t.check("reloads to the title", await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reload", 120000));
    await t.frames(10);
    const K = await g(`({ bed: ctx.decor.placed("bed"), mailbox: ctx.decor.placed("mailbox"), door: ctx.decor.placed("door"), coins: L3.wallet.coins,
      doorColor: ctx.decor.debug.doorColor(), out: ctx.decor.debug.outside() })`);
    t.check("after a reload: everything is still hers and in place", K.bed === keep.bed && K.mailbox === "pink" && K.door === "mint" && K.coins === keep.coins, JSON.stringify(K));
    t.check("…and the street shows it on the title", /5fd3b3/i.test(K.doorColor) && K.out.includes("mailbox:pink") && K.out.includes("lawn:flamingo"), JSON.stringify(K.out));
    await t.shot("title-after");
  },
};
