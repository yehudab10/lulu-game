// 📶 ⚙️ Show connection (ping) — features/netping: OFF by default (nothing on screen), ON → a small pill by the coins
// ("📶 offline" with no relay — the test page has none), fits a phone upright (412×915) and on its side (667×375)
// without touching the other HUD pieces; hidden again when switched off. Plus pins' ⚙️ 📍 Destination pointer switch:
// off → no beam, no edge pointer (the ping itself stays).
module.exports = {
  name: "netping",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "PLAY: the run starts", 30000)) return;
    await g(`(ctx.foot.active && (ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test")), true)`);
    await t.until(`__lulu3d.state === "playing"`, "in the car", 15000);
    await t.frames(20);
    const pill = () => t.L(`(() => { const e = document.querySelector("#hud .net-ping"); if (!e || e.style.display === "none" || !e.offsetParent) return null; const r = e.getBoundingClientRect(); return { txt: e.textContent, l: r.left, t: r.top, r: r.right, b: r.bottom }; })()`);
    t.check("off by default: nothing on screen", !await g(`ctx.netping.on`) && !await pill());
    // the ⚙️ row exists and toggles it
    await g(`ctx.netping.set(true)`); await t.frames(20);
    const p1 = await pill();
    t.check("⚙️ 📶 Show connection ON → \"📶 …\" by the coins (offline: no relay here)", !!p1 && /^📶 (offline|…|\d+ ms)$/.test(p1.txt), JSON.stringify(p1));
    const clash = async () => t.L(`(() => { const e = document.querySelector("#hud .net-ping"); const a = e.getBoundingClientRect(); const out = [];
      for (const s of ["#phoneBtn", "#pauseBtn", "#hud .trip", "#objLine:not(.empty) > *", "#slot-left > *", "#slot-center > *", "#stickBase", "#touch .tbtn"]) for (const o of document.querySelectorAll(s)) {
        if (!o.offsetParent && getComputedStyle(o).position !== "fixed") continue; const b = o.getBoundingClientRect(); if (b.width < 2 || b.height < 2) continue;
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) out.push(s); }
      if (a.right > innerWidth || a.bottom > innerHeight || a.left < 0 || a.top < 0) out.push("off screen"); return out; })()`);
    const c1 = await clash();
    t.check("…fits 412×915 (no overlap with the phone / pause buttons, the trip bar, the objective line, the controls)", !c1.length, c1.join(", "));
    await t.page.setViewportSize({ width: 667, height: 375 });
    await t.frames(30);
    const c2 = await clash();
    t.check("…fits 667×375 (a phone on its side)", !!await pill() && !c2.length, c2.join(", "));
    await t.shot("netping-667x375");
    await t.page.setViewportSize({ width: 412, height: 915 });
    await t.frames(10);
    await g(`ctx.netping.set(false)`); await t.frames(10);
    t.check("switched OFF → gone", !await pill());
    // hidden in Dina's mode
    await g(`ctx.netping.set(true)`);
    await g(`(ctx.G.mode = "dina", ctx.netping.debug.tick(0.2), true)`);
    t.check("hidden in Dina's mode", !await pill());
    await g(`(ctx.G.mode = "cruise", ctx.netping.set(false), true)`);

    // ⚙️ 📍 Destination pointer
    // (a place just up the road: the beam shows from 1.2 km)
    await g(`ctx.pins.add({ id: "test:near", name: "Test stop", icon: "🧪", cat: "help", group: "highway", lap: ((ctx.car.s + 150) % 16000 + 16000) % 16000 })`);
    const near = "test:near";
    await g(`ctx.pins.ping(${JSON.stringify(near)})`); await t.frames(20);
    const beam = () => t.L(`import("./js/features/openworld/marks.js").then(m => m.beaconCount())`);
    const b1 = await beam();
    await g(`ctx.pins.setPointer(false)`); await t.frames(20);
    const b0 = await beam();
    t.check("⚙️ 📍 Destination pointer OFF → no beam, no edge pointer (the ping stays)", b1 >= 1 && b0 === 0 && await g(`ctx.pins.current === ${JSON.stringify(near)} && !ctx.together.debug.pointers().some(p => p.uid === "pin" && p.shown)`), JSON.stringify({ near, b1, b0 }));
    await g(`(ctx.pins.setPointer(true), ctx.pins.clear(), true)`);
  },
};
