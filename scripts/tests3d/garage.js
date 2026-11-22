// Garage: purchases (garage/buy.js — what every shop place in the world uses; the 🛒 Shop menu itself moved into the
// world, see shops.js) landing in the SHARED 2D save + wallet, then a
// drive with missiles, the bubble shield, pepper spray, Distracted Mode, the
// equipped horn and a decoration on the car.
const save = `JSON.parse(localStorage.getItem("luluSaveV2") || "{}")`;

module.exports = {
  name: "garage",
  query: "&enable=garage",
  save2d: { totalCoins: 6000, ownedSkins: ["pink"], selectedSkin: "pink", missiles: 0, pepperSpray: 0, shields: 0,
    distractedUnlocked: false, horn: "beep", ownedHorns: ["beep"], decor: "none", ownedDecor: [] },
  async run(t) {
    await t.frames(10);
    // (the 🛒 Shop menu moved into the world — features/shops: the dealership, the makolet, Shmerel's van, the Bling Bay;
    //  their buying is tested in shops.js. Here: the same purchases through garage/buy.js — the one writer they all use —
    //  land in the SHARED 2D save exactly as the old Shop wrote them, then the drive uses them.)
    t.check("the Garage drawer has 🛍️ Where to shop", (await t.titleItems()).some(s => /Where to shop/.test(s)));
    await t.game(`L3.openView("garage")`);
    t.check("its row shows the next-ride nudge", await t.L(`!!document.querySelector("#shop .gx-next")`));
    const buy = (kind, id) => t.L(`import("./js/features/garage/buy.js").then(m => m.buy(${JSON.stringify(kind)}, ${JSON.stringify(id)}).ok)`);
    t.check("buy a car: Royal Purple", await buy("car", "purple"));
    const s1 = await t.L(save);
    t.check("…shared ownedSkins + selectedSkin", s1.ownedSkins.includes("purple") && s1.selectedSkin === "purple");
    t.check("150 coins spent from the shared wallet", s1.totalCoins === 5850, String(s1.totalCoins));
    t.check("the real car switches skin", await t.game(`ctx.car.skinKey === "purple"`));
    t.check("a car she owns can't be bought twice", !await buy("car", "purple") && (await t.L(save)).totalCoins === 5850);
    for (const id of ["missile", "megapack", "pepper", "shield", "shield", "distracted"]) await buy("item", id);
    const s2 = await t.L(save);
    t.check("bought 6 missiles (1 + Mega 5-Pack)", s2.missiles === 6, String(s2.missiles));
    t.check("bought pepper spray", s2.pepperSpray === 1);
    t.check("bought 2 shields", s2.shields === 2, String(s2.shields));
    t.check("unlocked Distracted Mode", s2.distractedUnlocked === true);
    t.check("item prices match 2D (20+80+15+50+50+1000)", s2.totalCoins === 5850 - 1215, String(s2.totalCoins));
    await t.game(`(ctx.garage.setDistracted(true), true)`);
    t.check("Distracted Mode toggles on", await t.game(`ctx.garage.distracted === true`));
    t.check("bought + equipped the Shofar", await buy("horn", "shofar") && await t.L(`${save}.horn === "shofar" && ${save}.ownedHorns.includes("shofar")`));
    t.check("bought + equipped the Crown", await buy("decor", "crown") && await t.L(`${save}.decor === "crown" && ${save}.ownedDecor.includes("crown")`));
    await t.frames(30);
    t.check("the crown is attached to Lulu's real car", await t.game(`!!(ctx.car.attached && ctx.car.attached.head && ctx.car.attached.head.userData.garageDecor === "crown")`));
    t.check("can't go below zero", await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 10; }); return import("./js/features/garage/buy.js").then(b => { const r = b.buy("car", "ninja"); return !r.ok && r.why === "poor" && m.wallet.coins === 10; }); })`));
    await t.L(`import("./js/core/save.js").then(m => { m.shared.update(s => { s.totalCoins = 4635; }); })`);
    await t.game(`(L3.showTitle ? L3.showTitle(true) : L3.setState("title"), true)`); await t.frames(3);
    t.check("title shows the Distracted toggle", (await t.titleItems()).some(s => /Distracted: ON/.test(s)));

    // ── drive ──
    await t.game(`L3.startRun({ mode: "cruise" })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "drive starts")) return;
    t.check("the garage plays the horn (core horn muted)", await t.game(`ctx.G.customHorn === true`));
    t.check("Distracted Mode is on for the run", await t.game(`ctx.G.distracted === true`));
    t.check("HUD shows item chips", await t.L(`/🚀/.test(document.querySelector(".gx-hud").textContent) && /🛡️/.test(document.querySelector(".gx-hud").textContent)`));
    t.check("touch buttons exist for missiles + pepper", await t.L(`!!document.getElementById("tx_garage_missile") && !!document.getElementById("tx_garage_pepper")`));
    t.check("phone in Lulu's hand", await t.game(`!!(ctx.car.attached && ctx.car.attached.mirrorL)`));

    // distracted: the wheel is reversed — hold the stick right, she drifts LEFT
    await t.game(`ctx.traffic.config.enabled = false, ctx.traffic.clear()`);
    await t.hold(7, 0.6); await t.frames(16);
    const d0 = await t.game(`ctx.car.d`);
    await t.stick(1); await t.frames(16); await t.stick(0);
    const d1 = await t.game(`ctx.car.d`);
    t.check("distracted steering is reversed (stick right → she drifts left)", d1 < d0 - 0.15, `${d0.toFixed(2)} → ${d1.toFixed(2)}`);
    const sc0 = await t.game(`[ctx.G.score, ctx.G.distance]`);
    await t.frames(20);
    const sc1 = await t.game(`[ctx.G.score, ctx.G.distance]`);
    t.check("distracted doubles the distance score", (sc1[0] - sc0[0]) >= 1.9 * (sc1[1] - sc0[1]), `${(sc1[0] - sc0[0]).toFixed(0)} pts / ${(sc1[1] - sc0[1]).toFixed(0)} m`);
    await t.game(`ctx.garage.setDistracted(false)`);
    // straighten up into the lane
    await t.game(`(() => { const p = ctx.world.road.point(ctx.car.s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.vx = Math.sin(p.h) * 18; ctx.car.vz = Math.cos(p.h) * 18; })()`);
    await t.game(`ctx.garage.setDistracted(true)`);
    await t.tap(3); await t.tap(3); await t.frames(8);     // △ △ → Lulu's eyes: the phone in her hand
    await t.shot("phone");
    await t.tap(3); await t.game(`ctx.garage.setDistracted(false)`);

    // honk: the shofar plays (L1)
    await t.tap(4); await t.frames(2);
    t.check("L1 honks the equipped horn", await t.game(`ctx.garage.debug.lastHorn === "shofar"`));

    // missile: a car ahead in our lane, D-pad ↑ fires
    await t.game(`(ctx.G.invT = 99, window.__tgt = ctx.traffic.add("sedan", ctx.car.s + 45, 1.75, 1, 12), true)`);
    await t.tap(12); await t.frames(2);
    t.check("D-pad ↑ fires a missile", await t.game(`ctx.G.missilesFired === 1`));
    t.check("a missile is spent from the shared save", await t.L(`${save}.missiles === 5`));
    await t.frames(6);
    await t.shot("missile-flight");
    await t.until(`window.__lulu3d.ctx.G.missileHits >= 1`, "missile hits the car ahead", 60000);
    t.check("missile hits the car ahead", await t.game(`ctx.G.missileHits === 1 && window.__tgt.hit === true`));
    await t.frames(3);
    await t.shot("missile-boom");
    await t.frames(12);
    t.check("the car is blasted into the air", await t.game(`window.__tgt.obj.position.y > 0.3 || Math.abs(window.__tgt.obj.rotation.z) > 0.3`));
    await t.shot("missile-tumble");

    // shield: a hit is absorbed (no heart lost), one shield used
    await t.game(`ctx.G.invT = 0`);
    const h0 = await t.game(`ctx.G.hearts`);
    await t.game(`L3.damage(1, "test hit", "test")`);
    await t.frames(4);
    t.check("the bubble shield absorbs the hit", await t.game(`ctx.G.hearts`) === h0);
    t.check("a shield is spent", await t.L(`${save}.shields === 1`));
    await t.shot("shield-pop");

    // pepper spray with nothing ahead: a free whiff
    await t.game(`ctx.traffic.clear()`);
    await t.tap(13); await t.frames(2);
    t.check("pepper with no target is a free whiff", await t.L(`${save}.pepperSpray === 1`) && await t.game(`ctx.garage.debug.whiffs === 1`));
    // a cop ahead: item:use fires (the law feature reacts) and a spray is spent
    await t.game(`(window.__cop = ctx.traffic.add("cop", ctx.car.s + 14, ctx.car.d, 1, ctx.car.speed), true)`);
    await t.tap(13); await t.frames(4);
    t.check("pepper at a cop spends a spray", await t.L(`${save}.pepperSpray === 0`) && await t.game(`ctx.garage.debug.sprays === 1`));
    await t.shot("pepper");
    await t.until(`window.__lulu3d.ctx.G.shieldReady === true`, "the shield re-arms", 60000);
    t.check("the shield re-arms", await t.game(`ctx.G.shieldReady === true`));
    await t.hold(7, 0);
    // out of missiles → deny (no crash), and ctx.garage API
    t.check("ctx.garage.items() reports counts", await t.game(`ctx.garage.items().missiles === 5 && ctx.garage.items().shields === 1`));
    await t.game(`ctx.garage.give("missile", 2)`);
    t.check("ctx.garage.give adds items", await t.L(`${save}.missiles === 7`));

    // the decoration survives a skin change on the real car
    await t.game(`ctx.car.setSkin("pink")`);
    t.check("decor survives a skin change", await t.game(`!!(ctx.car.attached.head && ctx.car.attached.head.parent)`));
  },
};
