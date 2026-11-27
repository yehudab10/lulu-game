// 🐞 QA sweep, part 25 — MISSILES, PEPPER SPRAY + THE BUBBLE SHIELD as a player (the owner, 2026-11-27: "I'm not sure if
// the rockets and peppery spray work properly"), solo, EVERY feature on, a phone (412 × 915, fingers) then on its side
// (667 × 375) then a controller:
//   • none bought: no 🚀 / 🌶️ button, pressing fire does nothing (no spend, a plain "go buy some" line)
//   • 3 missiles, 2 sprays, 1 shield: the chips show the counts, the buttons are ON SCREEN and clear of the other
//     touch buttons (also in a chase — an activity — where she needs them most)
//   • ONE tap = ONE missile (count −1, saved), it hits the car ahead (a blast, "💥 BOOM! +50"); at a cop ahead in a
//     chase; at a road-rager; pepper at nothing = a whiff, nothing spent; the shield eats a hit (hearts kept, −1)
//   • counts survive a reload; 0 left → nothing fires; the controller's D-pad ↑ fires
const W = require("../lib/qawatch.js");

module.exports = {
  name: "qa25",
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  query: "&enable=all",
  save2d: { totalCoins: 500, cruiseUnlocked: true, missiles: 0, pepperSpray: 0, shields: 0, convictions: 0, offenses: 0, wanted: [] },
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const g = t.game, GD = "ctx.garage";
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    const items = () => g(`(() => { const i = ${GD}.items(); return { m: i.missiles, p: i.pepper, s: i.shields }; })()`);
    const saved = () => t.L(`(() => { const s = JSON.parse(localStorage.getItem("luluSaveV2") || "{}"); return { m: s.missiles | 0, p: s.pepperSpray | 0, s: s.shields | 0 }; })()`);
    const btn = id => t.L(`(() => { const b = document.getElementById("tx_${id}"); if (!b) return null; const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
      const shown = cs.display !== "none" && cs.visibility !== "hidden" && r.width > 10 && b.offsetParent !== null;
      const others = [...document.querySelectorAll("#touch .tbtn")].filter(o => o !== b && o.offsetParent !== null).map(o => o.getBoundingClientRect()).filter(o => o.width > 10);
      const clash = others.some(o => Math.min(o.right, r.right) - Math.max(o.left, r.left) > 4 && Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top) > 4);
      return { shown, on: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, clash, r: [r.left, r.top, r.right, r.bottom].map(Math.round) }; })()`);
    const tap = id => t.L(`(() => { const b = document.getElementById("tx_${id}"); if (!b) return false; const o = { bubbles: true, pointerId: 7, pointerType: "touch" };
      b.dispatchEvent(new PointerEvent("pointerdown", o)); setTimeout(() => b.dispatchEvent(new PointerEvent("pointerup", o)), 60); return true; })()`);
    const ahead = (m = 45, kind = "sedan") => g(`(() => { const c = ctx.car; const t = ctx.traffic.add("${kind}", c.s + ${m}, c.d, 1, Math.max(8, c.speed * 0.5), {}); return !!t; })()`);
    const toasts = () => t.L(`[...document.querySelectorAll("#toasts > *")].map(e => e.textContent).join(" | ")`);
    await W.install(t);

    // ── a drive ──
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts", 15000)) return;
    await g(`(ctx.law.hold(99999), ctx.traffic.clear(), true)`);
    // (a short roll with the pad's trigger, then let go — a held pad keeps the game on "controller" and the touch buttons hide)
    await t.hold(7, 0.6); await t.frames(40); await t.hold(7, 0);

    // 1 · none bought
    const b0 = await btn("garage_missile");
    t.check("none bought: no 🚀 FIRE button", !b0 || !b0.shown, JSON.stringify(b0));
    const f0 = await g(`ctx.G.missilesFired || 0`);
    await t.tap(12); await t.frames(10);
    t.check("none bought: D-pad ↑ fires nothing (no spend)", (await g(`ctx.G.missilesFired || 0`)) === f0 && (await items()).m === 0);
    console.log("   with none:", JSON.stringify(await toasts()));

    // 2 · 3 missiles, 2 sprays, 1 shield (the counters' buy writes the same fields: garage/buy.js)
    await g(`(${GD}.give("missile", 3), ${GD}.give("pepper", 2), ${GD}.give("shield", 1), true)`);
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.frames(15);
    const chips = await t.L(`[...document.querySelectorAll(".gx-hud .gx-chip")].map(e => e.textContent.trim())`);
    t.check("the chips show 🚀 3 · 🌶️ 2 · 🛡️ 1", chips.some(c => /🚀\s*3/.test(c)) && chips.some(c => /🌶️\s*2/.test(c)) && chips.some(c => /🛡️\s*1/.test(c)), JSON.stringify(chips));
    for (const [id, nm] of [["garage_missile", "🚀 FIRE"], ["garage_pepper", "🌶️ SPRAY"]]) {
      const b = await btn(id);
      t.check(`upright 412 × 915: the ${nm} button is on screen, clear of the other buttons`, b && b.shown && b.on && !b.clash, JSON.stringify(b));
    }
    await t.shot("items-upright");

    // 3 · one tap = one missile, it hits the car ahead
    await ahead(45);
    await t.frames(4);
    const h0 = await g(`ctx.G.missileHits || 0`);
    await tap("garage_missile");
    await t.frames(4);
    t.check("one tap = one missile (3 → 2)", (await items()).m === 2, JSON.stringify(await items()));
    const hit = await t.until(`(__lulu3d.ctx.G.missileHits || 0) > ${h0}`, "the missile hits the car ahead", 8000);
    t.check("…it hits the car ahead", hit);
    console.log("   after the hit:", JSON.stringify(await toasts()));
    t.check("…a player can tell: 💥 BOOM! on screen", /BOOM/.test(await toasts()), await toasts());
    await t.frames(40);
    t.check("…saved (the shared save says 2)", (await saved()).m === 2, JSON.stringify(await saved()));
    await t.shot("missile-hit");

    // 4 · in a chase (an activity): the buttons stay; a missile at a cruiser ahead
    await g(`(ctx.law.hold(0), ctx.law._dbg.L.grace = 0, ctx.law.startChase("SPEEDING", { heat: 2 }), true)`);
    await t.until(`__lulu3d.ctx.law._dbg.L.units.some(u => u.mode === "chase" && u.car)`, "a cruiser", 15000);
    const bc = await btn("garage_missile");
    t.check("in a chase: the 🚀 FIRE button is still there (on screen)", bc && bc.shown && bc.on, JSON.stringify(bc));
    await g(`(() => { const u = ctx.law._dbg.L.units.find(u => u.mode === "chase" && u.car); const c = ctx.car; u.car.x = c.pos.x + Math.sin(c.h) * 40; u.car.z = c.pos.z + Math.cos(c.h) * 40; u.car.s = c.s + 40; return true; })()`);
    const ch0 = await g(`({ heat: ctx.law.wanted, charges: ctx.law._dbg.L.chase.charges.slice() })`);
    const hc = await g(`ctx.G.missileHits || 0`);
    await tap("garage_missile");
    const copHit = await t.until(`(__lulu3d.ctx.G.missileHits || 0) > ${hc}`, "the missile at the cruiser ahead", 8000);
    await t.frames(10);
    const ch1 = await g(`({ state: L3.state, chasing: ctx.law.chasing, heat: ctx.law.wanted, charges: ctx.law._dbg.L.chase ? ctx.law._dbg.L.chase.charges.slice() : null })`);
    console.log("   missile at a cruiser mid-chase:", JSON.stringify({ hit: copHit, before: ch0, after: ch1 }));
    t.check("a missile at a cruiser ahead: it hits", copHit);
    await g(`(ctx.law.standDown && ctx.law.standDown(), ctx.law.hold(99999), true)`);
    await t.frames(20);

    // 5 · a road-rager ahead
    const rg = await g(`ctx.underworld.debug.spawn ? ctx.underworld.debug.spawn("rager", { force: true }) : null`);
    if (rg !== null) {
      await t.until(`!!(__lulu3d.ctx.underworld.debug.E && __lulu3d.ctx.underworld.debug.E.car)`, "a road-rager", 15000);
      await g(`(() => { const E = ctx.underworld.debug.E; if (!E || !E.car) return false; const c = ctx.car; E.car.x = c.pos.x + Math.sin(c.h) * 40; E.car.z = c.pos.z + Math.cos(c.h) * 40; E.car.s = c.s + 40; E.car.d = c.d; return true; })()`);
      const hr = await g(`ctx.G.missileHits || 0`);
      await tap("garage_missile");
      t.check("a missile at a road-rager ahead: it hits", await t.until(`(__lulu3d.ctx.G.missileHits || 0) > ${hr}`, "the road-rager hit", 8000));
      await t.frames(10);
    }
    t.check("three missiles fired → none left", (await items()).m === 0, JSON.stringify(await items()));
    const fz = await g(`ctx.G.missilesFired || 0`);
    await t.tap(12); await t.frames(10);
    t.check("0 left: nothing fires, nothing goes below 0", (await g(`ctx.G.missilesFired || 0`)) === fz && (await items()).m === 0);

    // 6 · pepper at nothing → a whiff, nothing spent
    await g(`(ctx.traffic.clear(), true)`);
    const p0 = (await items()).p;
    await tap("garage_pepper"); await t.frames(10);
    t.check("pepper at nothing: a whiff, nothing spent", (await items()).p === p0, `${p0} → ${(await items()).p}`);
    // pepper at a person walking out ahead (roadevents' pedestrian)
    await g(`(ctx.roadevents && ctx.roadevents.spawn ? ctx.roadevents.spawn("pedestrian", { kind: "adult" }) : 0, true)`);
    const ped = await t.until(`(() => { const C = __lulu3d.ctx, c = C.car; return C.actors.some(a => { const p = a.obj && a.obj.position || a.pos; if (!p || p.x == null) return false; const dx = p.x - c.pos.x, dz = p.z - c.pos.z, lon = dx * Math.sin(c.h) + dz * Math.cos(c.h); return lon > 2 && lon < 26 && /ped|walker|person|npc/i.test(String(a.kind || a.type || a.name || "")); }); })()`, "a pedestrian ahead", 10000);
    if (ped) {
      const pp = (await items()).p, sp0 = await g(`ctx.garage.debug.sprays`);
      await tap("garage_pepper"); await t.frames(8);
      const pr = { left: (await items()).p, sprays: (await g(`ctx.garage.debug.sprays`)) - sp0, toasts: await toasts() };
      console.log("   pepper at a pedestrian:", JSON.stringify(pr));
      t.check("pepper at a person ahead: sprayed, one spent, a line on screen", pr.sprays === 1 && pr.left === pp - 1, JSON.stringify(pr));
    } else console.log("   (no pedestrian came out ahead)");

    // 7 · the bubble shield eats a hit
    // (a fresh shield, full hearts: an earlier bump may already have used the first one — as it should)
    await g(`(ctx.garage.items().shields < 1 ? ctx.garage.give("shield", 1) : 0, ctx.G.hearts = ctx.G.maxHearts, ctx.G.shieldReady = true, true)`);
    await t.frames(4);
    const hb = await g(`ctx.G.hearts`);
    await g(`(ctx.G.invT = 0, L3.damage(1, "qa", "qa"), true)`);
    await t.frames(10);
    const sh = await g(`({ hearts: ctx.G.hearts, shields: ctx.garage.items().shields, pops: ctx.garage.debug.shieldPops })`);
    console.log("   the shield:", JSON.stringify({ before: hb, after: sh }), JSON.stringify(await toasts()));
    t.check("the bubble shield eats a hit: hearts kept, 1 → 0", sh.hearts === hb && sh.shields === 0, JSON.stringify(sh));

    // 8 · on its side: the buttons on screen
    await g(`(${GD}.give("missile", 1), ${GD}.give("pepper", 1), true)`);
    await t.page.setViewportSize({ width: 667, height: 375 });
    await t.frames(20);
    for (const [id, nm] of [["garage_missile", "🚀 FIRE"], ["garage_pepper", "🌶️ SPRAY"]]) {
      const b = await btn(id);
      t.check(`on its side 667 × 375: the ${nm} button is on screen, clear of the other buttons`, b && b.shown && b.on && !b.clash, JSON.stringify(b));
    }
    await t.shot("items-side");

    // 9 · a controller: D-pad ↑ fires
    await t.L(`(() => { const e = new Event("gamepadconnected"); e.gamepad = window.__pad; window.dispatchEvent(e); return 0; })()`);
    await ahead(45);
    const m1 = (await items()).m;
    await t.tap(12); await t.frames(6);
    t.check("a controller: D-pad ↑ fires one (1 → 0)", m1 === 1 && (await items()).m === 0, `${m1} → ${(await items()).m}`);

    const r = await W.report(t); W.log(r);
    // 10 · a reload keeps what's left
    const before = await items();
    await t.frames(40);
    await t.page.reload();
    await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "reboots", 120000);
    t.check("a reload keeps the counts", JSON.stringify(await items()) === JSON.stringify(before), JSON.stringify([before, await items()]));
  },
};
