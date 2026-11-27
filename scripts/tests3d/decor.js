// 🛋️ DECOR — the family house + the decorating catalogue (roadmap step 9; roadmap 23 — ci/moveout: it's IMA'S house).
//
//  • the home start: her front door is a ✋ spot (🏠 GO INSIDE), warmed on the porch → a SOFT cut into the house
//    (no black), the kitchen with Ima, the living room, her room; back out lands her on the porch steps
//  • NOTHING to decorate at Ima's: no ✋ redecorate spots inside, no porch / mailbox / yard spots outside, and what she
//    buys (through the catalogue — her own homes' picker, features/realestate) never shows on Ima's house or street
//  • buying: coins − price, hers for good (saved); swapping between owned things is free; can't go below 0; nothing
//    here ever pays coins out; a 🎉 party: nothing sold; the picker card fits phone (portrait + landscape) and TV
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
    t.check("Ima's house: no redecorate spots (the door + Ima are there)", !R0.hots.some(h => /^slot:/.test(h)) && ["door", "ima"].every(h => R0.hots.includes(h)), R0.hots.join(","));
    t.check("Dina is in the living room, with a hotspot to talk to", (await g(`(() => { const r = window.__interiors.room; return !!r.byId.dina && r.hots.some(h => h.id === "dina"); })()`)), "no Dina inside");
    await t.frames(20);
    await t.shot("inside");

    // ── buying (what her own homes' picker does): coins − price, hers, Ima's house unchanged ──
    const c0 = await coins();
    const B1 = await g(`(() => { const r = ctx.decor.buy("bed", "fluffy"); return { ok: r.ok, owns: ctx.decor.owns("bed", "fluffy"), coins: L3.wallet.coins, spent: ctx.decor.spent }; })()`);
    t.check("buying a bed: −80 coins, hers", B1.ok && B1.owns && B1.coins === c0 - 80 && B1.spent === 80, JSON.stringify(B1));
    const shownBed = await g(`(() => { const V = ctx.decor.debug.room().data.V, c = V.cache.bed || {}; return Object.keys(c).filter(k => c[k] && c[k].visible); })()`);
    t.check("…Ima's house still shows Ima's own bed", shownBed.join() === "basic", shownBed.join());
    await g(`(ctx.decor.place("bed", "basic"), true)`);
    t.check("swapping back to something she owns is free", (await g(`ctx.decor.placed("bed")`)) === "basic" && (await coins()) === c0 - 80);
    await g(`(ctx.decor.place("bed", "fluffy"), true)`);
    t.check("…and back again, still free", (await g(`ctx.decor.placed("bed")`)) === "fluffy" && (await coins()) === c0 - 80);
    await g(`(L3.wallet.spend(L3.wallet.coins - 50), true)`);
    const B2 = await g(`(() => { const r = ctx.decor.buy("lamp", "disco"); return { ok: r.ok, owns: ctx.decor.owns("lamp", "disco"), coins: L3.wallet.coins }; })()`);
    t.check("a buy she can't afford: refused, no coins taken, not hers", !B2.ok && !B2.owns && B2.coins === 50, JSON.stringify(B2));
    await g(`(L3.wallet.add(3000), true)`);
    for (const [s, o] of [["door", "mint"], ["mailbox", "fish"], ["lawn", "flamingo"], ["porch", "lights"], ["wallpaper", "clouds"]]) await g(`ctx.decor.buy("${s}", "${o}")`);
    const calls = await g(`(() => { const r = L3.renderer; r.info.reset(); r.render(window.__interiors.room.set.scene, window.__interiors.room.set.camera); return r.info.render.calls; })()`);
    t.check("the whole house is a modest number of draw calls", calls > 0 && calls < 200, calls + " calls");

    // ── out the front door: on the porch steps ──
    await g(`(window.__interiors.room.leave(), true)`);
    t.check("leaving → back on foot", await t.until(`__lulu3d.state === "footRun"`, "outside", 4000));
    await t.frames(4);
    const O1 = await g(`({ p: { x: ctx.foot.pos.x, z: ctx.foot.pos.z }, door: ctx.decor.debug.spotAt("door") })`);
    t.check("…on her own porch steps", near(O1.p, O1.door) < 3.5, near(O1.p, O1.door).toFixed(2) + " m from the door");
    await t.frames(30);
    const camL = await g(`ctx.decor.debug.houseLocal(ctx.camera.position)`);
    const inHouse = camL.x > -10.6 && camL.x < 5.2 && camL.z > -4.2 && camL.z < 4.2, underPorch = camL.x > -3.7 && camL.x < 4.3 && camL.z > 3.9 && camL.z < 6.7 && camL.y < 3.2;
    t.check("…and the camera is out on the lawn, not inside the house", !inHouse && !underPorch, JSON.stringify(camL));
    // ── outside: nothing to decorate, and nothing she bought shows on Ima's house ──
    const O2 = await g(`({ door: ctx.decor.debug.doorColor(), out: ctx.decor.debug.outside(), yard: ctx.decor.debug.yard(), calls: ctx.decor.debug.calls() })`);
    t.check("outside: still Ima's pink door, no decorations, nothing solid in the yard", /e91e63/i.test(O2.door) && O2.out.length === 0 && O2.yard.length === 0 && O2.calls === 0, JSON.stringify(O2));
    const spots = await g(`ctx.foot.debug.spots ? ctx.foot.debug.spots().map(s => s.short) : null`);
    t.check("…and no porch / mailbox / yard ✋ spots", !spots || !spots.includes("DECOR"), JSON.stringify(spots));
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

    // ── layouts: the picker card (her own homes use it) fits a phone (both ways) and a TV ──
    await t.L(`Promise.all([import("./js/features/decor/picker.js"), import("./js/features/decor/data.js")]).then(([P, D]) => { const c = __lulu3d.ctx.decor; P.openPicker(D.slotById("lawn"), { owns: c.owns, placed: c.placed, buy: () => ({ ok: false, why: "bad" }), place: () => false, preview: () => {} }, null); return true; })`);
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
    await t.L(`import("./js/features/decor/picker.js").then(P => { P.closePicker(true); return true; })`);
    await t.frames(3);

    // ── reload: still there ──
    const keep = await g(`({ bed: ctx.decor.placed("bed"), mailbox: ctx.decor.placed("mailbox"), door: ctx.decor.placed("door"), coins: L3.wallet.coins })`);
    await flush();
    await t.page.reload();
    t.check("reloads to the title", await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reload", 120000));
    await t.frames(10);
    const K = await g(`({ bed: ctx.decor.placed("bed"), mailbox: ctx.decor.placed("mailbox"), door: ctx.decor.placed("door"), coins: L3.wallet.coins,
      doorColor: ctx.decor.debug.doorColor(), out: ctx.decor.debug.outside() })`);
    t.check("after a reload: everything is still hers (her picks kept for her own place)", K.bed === keep.bed && K.mailbox === "pink" && K.door === "mint" && K.coins === keep.coins, JSON.stringify(K));
    t.check("…and the title shows Ima's house as Ima keeps it", /e91e63/i.test(K.doorColor) && K.out.length === 0, JSON.stringify(K));
    await t.shot("title-after");
  },
};
