// 🐞 QA sweep, part 28 — THE 📱 PHONE INSIDE ROOMS (the coordinator for the owner, 2026-11-27: with walk-through doors "outside"
// and "inside" are one world — a 📱 that turned into ❚❚ at every doorway was a seam). EVERY feature on, fingers: a phone
// upright (412 × 915) then on its side (667 × 375), and a controller; three rooms — a shop (the pizza place), a lobby (Midwood's
// Borough Hall), her own home (Ima's house):
//   • the corner is 📱 (not ❚❚) in the room; a tap opens the phone; the game pauses; every app opens and FITS
//   • the home line + the 🗺️ Map say where she is ("inside …")
//   • 📞 Contacts › Chaverim says "step outside" in one line (no call rows); Ima the same as a phone toast
//   • closing it: back in the room, walking, not paused; the touchpad opens it, ○ ○ closes it
//   • mid-chat (a dialog open) the phone stays shut — the corner falls back to the pause menu
const W = require("../lib/qawatch.js");
const Q = require("./qa26.js");

module.exports = {
  name: "qa28",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 900, cruiseUnlocked: true, convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) { try { await this.body(t); } finally { W.dropRelayErrors(t); } },
  async body(t) {
    const g = t.game, L = s => t.L(s);
    await L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await W.install(t);
    await t.click(/PLAY/);
    if (!await t.until(`__lulu3d.state === "footRun"`, "▶ PLAY: at home", 60000)) return;
    await t.frames(30);
    const vis = id => L(`(() => { const e = document.getElementById(${JSON.stringify(id)}); return !!e && e.offsetParent !== null && getComputedStyle(e).display !== "none"; })()`);
    const outOfRoom = async () => {
      if (await g(`L3.state === "interior"`)) { await L(`import("./js/features/interiors/engine.js").then(m => { const r = m.current(); if (r && r.leave) r.leave(); return true; })`); for (let i = 0; i < 20 && await g(`L3.state !== "footRun"`); i++) await t.tap(0); }
      return t.until(`__lulu3d.state === "footRun"`, "back out on foot", 30000);
    };
    const ROOMS = [
      ["Ima's house", `(ctx.onegame && ctx.onegame.home ? ctx.onegame.home() : 0, true)`, `ctx.decor.enter()`],
      ["the pizza shop", null, `ctx.shops.enterShop("pizza")`],
      ["Borough Hall", null, `(() => { const sp = ctx.cityhall.spot(); const F = ctx.foot.debug.F; F.pos.set(sp.x + sp.nx * 1.2, 0.05, sp.z + sp.nz * 1.2); F.phase = "walk"; return ctx.cityhall.enter(); })()`],
    ];
    // (walking in, someone may greet her — a chat keeps the phone shut, by design: let it finish)
    const free = async tag => {
      for (let i = 0; i < 60; i++) {
        const s = await L(`import("./js/features/phone/ui.js").then(m => ({ free: m.roomFree(), dlg: !!__lulu3d.ctx.dialogOpen }))`);
        if (s.free && !s.dlg) return true;
        if (s.dlg) await L(`import("./js/core/dialog.js").then(m => { m.closeDialog && m.closeDialog(); return true; })`);
        await t.frames(10);
      }
      const why = await L(`import("./js/features/interiors/engine.js").then(m => { const r = m.current(); return r ? { ready: r.ready, busy: r.busy, lock: r.lock, leaving: r.leaving, active: !!r.active, mode: !!r.mode, dlg: !!__lulu3d.ctx.dialogOpen } : null; })`);
      t.check(`${tag}: the room settles (free to use the phone)`, false, JSON.stringify(why));
      return false;
    };
    for (const [w, h] of [[412, 915], [667, 375]]) {
      if (w !== 412) { await t.page.setViewportSize({ width: w, height: h }); await L(`(window.dispatchEvent(new Event("touchstart")), 0)`); await t.frames(10); }
      for (const [name, pre, enter] of ROOMS) {
        const tag = `${w}×${h} ${name}`;
        if (!await outOfRoom()) continue;
        await W.moved(t);
        if (pre) { await g(pre); await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, `${tag}: at home`, 30000); await t.frames(20); }
        await g(enter);
        if (!await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready`, `${tag}: inside`, 60000)) continue;
        await t.frames(40);
        if (!await free(tag)) continue;
        await L(`(window.dispatchEvent(new Event("touchstart")), 0)`); await t.frames(2);
        t.check(`${tag}: the corner is 📱, not ❚❚`, await vis("phoneBtn") && !(await vis("pauseBtn")));
        await L(`document.getElementById("phoneBtn").click()`); await t.frames(6);
        t.check(`${tag}: a tap opens the phone (paused)`, await g(`ctx.phone.isOpen && ctx.paused`));
        const hello = await L(`(document.querySelector("#screenCard .lp-hello") || {}).textContent || ""`);
        t.check(`${tag}: the home line says she's inside`, /inside/.test(hello), hello);
        await g(`(ctx.phone.closePhone(), true)`); await t.frames(4);
        await Q.fitAll(t, tag);
        // where she is
        await Q.openP(t, "lapmap");
        const note = await L(`[...document.querySelectorAll("#lpApp .lp-note")].map(e => e.textContent).join(" ")`);
        t.check(`${tag}: 🗺️ Map says she's inside`, /inside/.test(note), note);
        // 📞 Chaverim: step outside
        await Q.openP(t, "community");
        await L(`(document.querySelector('#lpApp [data-org="chaverim"]') || {}).click && document.querySelector('#lpApp [data-org="chaverim"]').click()`); await t.frames(4);
        const ch = await L(`({ out: !!document.querySelector("#lpApp .lp-stepout"), rows: document.querySelectorAll("#lpApp [data-i]").length })`);
        t.check(`${tag}: 📞 Chaverim says "step outside", no call rows`, ch.out && ch.rows === 0, JSON.stringify(ch));
        await g(`(ctx.phone.closePhone(), true)`); await t.frames(6);
        t.check(`${tag}: closed → back in the room, not paused`, await g(`L3.state === "interior" && !ctx.paused && !ctx.phone.isOpen`));
      }
    }
    // a controller in a room: the touchpad opens it, ○ ○ closes it; mid-chat it stays shut
    await outOfRoom();
    await g(`(ctx.onegame && ctx.onegame.home ? ctx.onegame.home() : 0, true)`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "at home (pad)", 30000); await t.frames(20);
    await g(`ctx.decor.enter()`);
    if (await t.until(`__lulu3d.state === "interior" && window.__interiors && __interiors.room && __interiors.room.ready`, "Ima's house (pad)", 60000)) {
      await t.frames(40);
      await free("pad");
      await t.tap(17); await t.frames(6);
      t.check("🎮 in a room the touchpad opens the phone", await g(`ctx.phone.isOpen`));
      await t.tap(1); await t.frames(4);
      t.check("…○ closes it, back in the room", await g(`!ctx.phone.isOpen && !ctx.paused && L3.state === "interior"`));
      await L(`import("./js/core/dialog.js").then(m => { m.say("Ima", "Did you eat? You didn't eat.", {}); return true; })`); await t.frames(6);
      await t.tap(17); await t.frames(6);
      t.check("…mid-chat the phone stays shut", !(await g(`ctx.phone.isOpen`)));
      await L(`import("./js/core/dialog.js").then(m => { m.closeDialog && m.closeDialog(); return true; })`); await t.frames(4);
      if (await g(`ctx.paused`)) { await t.key("Escape"); await t.frames(4); }
    }
  },
};
