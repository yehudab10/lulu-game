// 📱 The phone sweep, part 1 — THE FIRST FIVE MINUTES on a phone held upright (390 × 844, touch), EMPTY save: the title →
// ▶ PLAY → at home on foot (one clear next thing on screen, nothing stacked, no controller words) → into the car → the
// first drive (the tutorial's cards point at real touch buttons) → out again. Screenshots: SWEEP_SHOTS=1 →
// smoke-shots/sweepphone/.
const { make, W } = require("../lib/sweepphone.js");

module.exports = {
  name: "sweepphone",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: "&enable=all",
  save3d: { settings: { quality: "low" } },
  async run(t) {
    try { await this.body(t); } finally { W.dropRelayErrors(t); }
  },
  async body(t) {
    const S = make(t), g = t.game;
    await W.install(t);
    const VW = await t.L(`innerWidth`), VH = await t.L(`innerHeight`), tag = this.tag || "";
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.frames(10);
    await S.shot(tag + "01-title");
    await S.dump("title");
    await S.badText("title", { touch: true, w: VW });
    const ok = await t.click(/PLAY/);
    t.check("▶ PLAY is on the title", ok);
    for (let i = 0; i < 8; i++) {
      await t.frames(30);
      const st = await g(`L3.state`);
      S.log(`+${i + 1}s state ${st}`);
      if (i === 1 || i === 3 || i === 7) { await S.shot(tag + `02-home-${i + 1}s`); await S.dump(`home ${i + 1}s`); }
    }
    await S.badText("at home", { touch: true, w: VW });
    const home8 = await S.texts();
    t.check("at home: ONE hint at a time (the walk-to-the-car line, no moves coach under it)", !home8.some(x => /JUMP ·|tap JUMP/.test(x.tx) && /prompt/.test(x.cls)), home8.filter(x => /prompt|padHint/.test(x.cls + x.id)).map(x => x.tx).join(" | "));
    t.check("at home: the 🔥 streak card waits for the drive (not on top of Ima's line)", !home8.some(x => /streak/.test(x.tx)));
    // the WALK stick: a thumb resting 3 px off its middle doesn't move her; a full push is a full push
    const stick = async dx => {
      await t.L(`(() => { const z = document.getElementById("stickZone"), b = document.getElementById("stickBase").getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2;
        z.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 21, clientX: cx + ${dx}, clientY: cy }));
        z.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerType: "touch", pointerId: 21, clientX: cx + ${dx}, clientY: cy })); return 0; })()`);
      await t.frames(2);
      const v = await g(`L3.input.moveX`);
      await t.L(`(document.getElementById("stickZone").dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", pointerId: 21 })), 0)`);
      await t.frames(2);
      return v;
    };
    const rest = await stick(3), full = await stick(70);
    t.check(`the touch stick has a small dead zone (3 px → ${rest}) and still reaches 1 (→ ${full})`, rest === 0 && full > 0.99);
    // where's her car? (on screen, so "drag the WALK pad to your car" means something)
    const carView = () => g(`(() => { const c = ctx.foot.parkedCar, cam = ctx.camera; if (!c) return null; const v = new cam.position.constructor(c.x, 1, c.z).project(cam);
      const F = ctx.foot.debug.F; return { sx: Math.round((v.x + 1) * innerWidth / 2), sy: Math.round((1 - v.y) * innerHeight / 2), front: v.z < 1, d: +Math.hypot(c.x - F.pos.x, c.z - F.pos.z).toFixed(1) }; })()`);
    const cv = await carView();
    S.log("car on screen: " + JSON.stringify(cv));
    t.check("the first start: her car is in the picture (the hint says walk to it)", cv && cv.front && cv.sx > 0 && cv.sx < VW && cv.sy > 0 && cv.sy < VH, JSON.stringify(cv));
    for (let i = 0; i < 2; i++) { await t.frames(150); await S.shot(tag + `03-home-${10 + i * 5}s`); await S.dump(`home ${10 + i * 5}s`); }
    // walk up to the car (put her beside it, facing it) → the HAND button says GET IN → tap it
    await g(`(() => { const c = ctx.foot.parkedCar, F = ctx.foot.debug.F; const a = Math.atan2(F.pos.x - c.x, F.pos.z - c.z); F.pos.x = c.x + Math.sin(a) * 2.2; F.pos.z = c.z + Math.cos(a) * 2.2; F.lulu.obj.rotation.y = a + Math.PI; return true; })()`);
    await W.moved(t);
    await t.frames(20);
    await S.shot(tag + "04-at-car");
    const hand = await S.dump("at the car");
    t.check("at her car the HAND button / prompt says how to get in", hand.some(x => /GET IN|hop in|DRIVE/i.test(x.tx)), hand.filter(x => /tx_foot_hand|prompt/.test(x.id + x.cls)).map(x => x.tx).join(" | "));
    await S.tapEl("tx_foot_hand");
    await t.until(`!__lulu3d.ctx.foot.active`, "in the car", 20000);
    let gasHint = false, streak = false;
    for (let i = 0; i < 4; i++) { await t.frames(60); await S.shot(tag + `05-drive-${(i + 1) * 2}s`); const all = await S.dump(`drive ${(i + 1) * 2}s`); gasHint = gasHint || all.some(x => /Hold GAS to pull out/.test(x.tx)); streak = streak || all.some(x => /streak/.test(x.tx)); }
    t.check("in the driveway, still: \"Hold GAS to pull out\"", gasHint);
    t.check("the 🔥 streak card shows once she's in the car", streak);
    // GAS: out of the driveway → the first-drive tutorial's cards
    await t.L(`(() => { const e = document.getElementById("tGas"); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 11 })); return 0; })()`);
    await t.until(`__lulu3d.state === "playing"`, "pulled out → playing", 30000);
    let both = 0;
    for (let i = 0; i < 4; i++) {
      await t.frames(90); await S.shot(tag + `06-tut-${i}`);
      const all = await S.dump(`tutorial ${i}`);
      if (all.some(x => /metaTutBox/.test(x.id)) && all.some(x => /Lulu's phone/.test(x.tx))) both++;
      // the tutorial's card clear of the touch buttons (it points at them)
      const hit = await t.L(`(() => { const c = document.querySelector("#metaTutBox .meta-tut"); if (!c) return ""; const a = c.getBoundingClientRect();
        return [...document.querySelectorAll("#touch .tbtn, #touchExtra button, #stickBase")].filter(e => { for (let n = e; n && n !== document.body; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === "none" || cs.visibility === "hidden") return false; } const b = e.getBoundingClientRect();
          return b.width && Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2; }).map(e => e.id || e.textContent.trim()).join(", "); })()`);
      t.check(`the first drive (${i}): the tutorial's card is clear of the touch buttons`, !hit, hit);
    }
    await t.L(`(() => { const e = document.getElementById("tGas"); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", pointerId: 11 })); return 0; })()`);
    t.check("the first drive: the tutorial's card and the 📱 phone's intro banner never on screen together", both === 0, `${both} of 4 looks`);
    await S.badText("first drive", { touch: true, w: VW });
    S.log("state " + await g(`L3.state`) + " tutorial " + await g(`JSON.stringify(ctx.meta && ctx.meta.tutorial ? ctx.meta.tutorial : null)`));
  },
};
