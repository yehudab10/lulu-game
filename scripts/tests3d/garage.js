// Garage: the 🛒 Shop (cars / items / bling over the 3D showroom) driven with
// the fake controller, purchases landing in the SHARED 2D save + wallet, then a
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
    t.check("title has the 🛒 Shop item", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Shop/.test(b.textContent))`));
    t.check("title shows the next-ride nudge", await t.L(`!!document.querySelector(".gx-next")`));

    // ── open the shop ──
    await t.click(/Shop/);
    t.check("Shop opens the shop state", await t.game(`ctx.state === "shop"`));
    t.check("shop card renders all 8 cars", await t.L(`document.querySelectorAll("#gx_body [data-kind=skin]").length === 8`));
    if (!await t.until(`window.__lulu3d.ctx.garage.shop.loaded`, "showroom loads")) return;
    t.check("showroom loads", true);
    t.check("the 3D showroom is what's rendered", await t.game(`!!ctx.view && ctx.view === ctx.garage.shop.set.view`));
    await t.frames(25);
    await t.shot("cars");

    // D-pad right → Royal Purple: the showroom car repaints live
    await t.tap(15); await t.frames(4);
    t.check("D-pad focuses the next car", await t.L(`document.querySelector(".gx-it.focus").id === "gx_skin_purple"`));
    t.check("showroom previews the focused skin", await t.game(`ctx.garage.shop.carSkin === "purple"`));
    t.check("detail panel shows the 2D flavour text", await t.L(`/Royalty rides easy/.test(document.getElementById("gx_detail").textContent)`));
    // ✕ arms, ✕ again buys (2D: preview first, then buy)
    await t.tap(0);
    t.check("first ✕ only arms the purchase", await t.L(`${save}.ownedSkins.length === 1 && !!document.querySelector(".gx-it.armed")`));
    await t.tap(0); await t.frames(4);
    const s1 = await t.L(save);
    t.check("second ✕ buys Royal Purple (shared ownedSkins)", s1.ownedSkins.includes("purple") && s1.selectedSkin === "purple");
    t.check("150 coins spent from the shared wallet", s1.totalCoins === 5850, String(s1.totalCoins));
    t.check("the real car switches skin", await t.game(`ctx.car.skinKey === "purple"`));
    // moving focus disarms a pending purchase
    await t.tap(15); await t.tap(0); await t.tap(14); await t.frames(2);
    t.check("moving focus away disarms", await t.L(`!document.querySelector(".gx-it.armed")`));
    await t.shot("cars-bought");
    // phone portrait + TV layouts
    await t.page.setViewportSize({ width: 390, height: 844 }); await t.frames(18);
    t.check("portrait: the card sits below the showroom", await t.L(`(() => { const r = document.getElementById("screenCard").getBoundingClientRect(); return r.top > 250 && r.bottom <= 844 && r.width > 360; })()`));
    await t.shot("portrait");
    await t.page.setViewportSize({ width: 960, height: 540 });
    await t.L(`document.body.classList.add("tv")`); await t.frames(18);
    await t.shot("tv");
    await t.L(`document.body.classList.remove("tv")`); await t.frames(2);

    // ── R1 → Items ──
    await t.tap(5); await t.frames(4);
    t.check("R1 switches to the Items tab", await t.L(`document.querySelectorAll("#gx_body [data-kind=item]").length === 5`));
    t.check("pedestal shows the missile", await t.game(`ctx.garage.shop.show === "prop" && ctx.garage.shop.propKey === "Item_missile"`));
    await t.tap(0);                       // missile ×1
    await t.tap(15); await t.tap(0);      // mega pack ×5
    await t.tap(15); await t.tap(0);      // pepper
    await t.tap(15); await t.tap(0); await t.tap(0);   // shield ×2
    await t.frames(6);
    await t.shot("items-shield");
    await t.tap(15); await t.tap(0); await t.tap(0);   // distracted (arm + buy)
    const s2 = await t.L(save);
    t.check("bought 6 missiles (1 + Mega 5-Pack)", s2.missiles === 6, String(s2.missiles));
    t.check("bought pepper spray", s2.pepperSpray === 1);
    t.check("bought 2 shields", s2.shields === 2, String(s2.shields));
    t.check("unlocked Distracted Mode", s2.distractedUnlocked === true);
    t.check("item prices match 2D (20+80+15+50+50+1000)", s2.totalCoins === 5850 - 1215, String(s2.totalCoins));
    await t.tap(0);   // owned → toggles it ON
    t.check("✕ on owned Distracted Mode toggles it on", await t.game(`ctx.garage.distracted === true`));

    // ── R1 → Bling: buy the shofar + the crown ──
    await t.tap(5); await t.frames(4);
    t.check("Bling tab lists 6 horns + 7 decorations", await t.L(`document.querySelectorAll("#gx_body [data-kind=horn]").length === 6 && document.querySelectorAll("#gx_body [data-kind=decor]").length === 7`));
    await t.game(`document.getElementById("gx_horn_shofar").dispatchEvent(new Event("pointerenter"))`); await t.frames(3);
    await t.tap(0); await t.tap(0);
    t.check("bought + equipped the Shofar", await t.L(`${save}.horn === "shofar" && ${save}.ownedHorns.includes("shofar")`));
    await t.game(`document.getElementById("gx_decor_crown").dispatchEvent(new Event("pointerenter"))`); await t.frames(3);
    t.check("focusing a decoration tries it on the showroom car", await t.game(`ctx.garage.shop.carDecor.id === "crown"`));
    await t.tap(0); await t.tap(0); await t.frames(30);
    t.check("bought + equipped the Crown", await t.L(`${save}.decor === "crown" && ${save}.ownedDecor.includes("crown")`));
    t.check("the crown is attached to Lulu's real car", await t.game(`!!(ctx.car.attached && ctx.car.attached.head && ctx.car.attached.head.userData.garageDecor === "crown")`));
    await t.shot("bling-crown");
    for (const id of ["flames", "unicorn", "lashes", "dice", "surf"]) {
      await t.game(`document.getElementById("gx_decor_${id}").dispatchEvent(new Event("pointerenter"))`);
      await t.frames(24);
      await t.shot("bling-" + id);
    }

    // ○ back to the title
    await t.tap(1); await t.frames(3);
    t.check("○ leaves the shop", await t.game(`ctx.state === "title" && ctx.view === null`));
    t.check("title shows the Distracted toggle", await t.L(`[...document.querySelectorAll("#screenCard .btn")].some(b => /Distracted: ON/.test(b.textContent))`));

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
