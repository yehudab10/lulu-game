// 🤸 Movement on a PHONE (ci/move): portrait touch layout on foot — the JUMP + ROLL buttons show (and only
// on foot), they sit clear of the stick and of each other, the ✋ hand sits above them; tapping JUMP jumps,
// ROLL rolls (moves); a finger dragged across the picture turns the free camera and it stays; a quick tap
// on the road still rolls. Then landscape: everything still on screen, nothing overlapping.
module.exports = {
  name: "movetouch",
  query: "&enable=moves",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const G = code => t.game(code);
    const FF = `ctx.foot.debug.F`;
    await t.boot();
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await G(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "playing"`, "driving", 30000);
    await G(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    t.check("no JUMP button while driving", await t.L(`getComputedStyle(document.getElementById("footPad")).display === "none"`));
    await G(`(() => { const p = ctx.world.road.point(1600, 6.5, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = 1600; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; return true; })()`);
    await G(`ctx.foot.start("droveOff")`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 15000);
    await G(`(ctx.traffic.config.enabled = false, ctx.law && ctx.law.hold && ctx.law.hold(300), true)`);
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    await t.frames(4);
    const box = id => t.L(`(() => { const e = document.getElementById("${id}"); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { l: r.left, t: r.top, r: r.right, b: r.bottom } : null; })()`);
    const overlap = (a, b) => a && b && a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const inView = (a, w, h) => a && a.l >= 0 && a.t >= 0 && a.r <= w && a.b <= h;
    const check = async (w, h, tag) => {
      const jump = await box("tJump"), roll = await box("tRoll"), stick = await box("stickBase"), hand = await box("tx_foot_hand");
      t.check(`${tag}: JUMP + ROLL show on foot`, !!jump && !!roll, JSON.stringify({ jump, roll }));
      t.check(`${tag}: JUMP is big (≥ 80 px) and in the bottom-right`, jump && jump.r - jump.l >= 80 && jump.l > w / 2 && jump.t > h / 2, JSON.stringify(jump));
      t.check(`${tag}: on screen`, inView(jump, w, h) && inView(roll, w, h) && (!hand || inView(hand, w, h)), JSON.stringify({ jump, roll, hand }));
      t.check(`${tag}: nothing overlaps (stick · JUMP · ROLL · ✋)`, !overlap(jump, roll) && !overlap(jump, stick) && !overlap(roll, stick) && !overlap(hand, jump) && !overlap(hand, roll), JSON.stringify({ jump, roll, stick, hand }));
    };
    await check(390, 844, "portrait");
    await t.shot("portrait");
    // tap JUMP
    const tapEl = async (id, hold = 2) => {
      await t.L(`(() => { const e = document.getElementById("${id}"); e.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch", pointerId: 7 })); return 0; })()`);
      await t.frames(hold);
      await t.L(`(() => { const e = document.getElementById("${id}"); e.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", pointerId: 7 })); return 0; })()`);
    };
    await tapEl("tJump", 12);
    await t.frames(1);
    t.check("tapping JUMP jumps", await G(`ctx.foot.airborne || ${FF}.jumps >= 1`));
    await t.until(`!__lulu3d.ctx.foot.airborne`, "lands", 5000);
    await t.frames(4);
    await tapEl("tRoll");
    await t.frames(1);
    t.check("tapping ROLL rolls", await G(`ctx.moves.debug.foot().kind === "roll" && ctx.moves.debug.foot().n >= 1`), JSON.stringify(await G(`ctx.moves.debug.foot()`)));
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on && __lulu3d.ctx.foot.phase === "walk"`, "the roll ends", 5000);
    // a finger drag across the picture turns the camera (and it stays)
    const y0 = await G(`ctx.cam.free.yaw`);
    await t.L(`(() => { const cv = document.getElementById("scene"); const ev = (type, x) => cv.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", pointerId: 9, clientX: x, clientY: 300 }));
      ev("pointerdown", 250); window.__drag = ev; return 0; })()`);
    for (const x of [262, 280, 300, 320, 340]) { await t.L(`(window.__drag("pointermove", ${x}), 0)`); await t.frames(1); }
    await t.L(`(window.__drag("pointerup", 340), 0)`);
    await t.frames(30);
    const y1 = await G(`ctx.cam.free.yaw`);
    t.check("a finger drag on the picture turns the camera", Math.abs(y1 - y0) > 0.5, (y1 - y0).toFixed(2));
    t.check("…a drag is not a roll (no tap-the-road)", await G(`!ctx.moves.debug.foot().on`));
    await t.frames(40);
    t.check("…and the camera stays there", Math.abs(await G(`ctx.cam.free.yaw`) - y1) < 0.02);
    // landscape
    await t.page.setViewportSize({ width: 844, height: 390 });
    await t.frames(6);
    await check(844, 390, "landscape");
    await t.shot("landscape");
    t.check("no errors", t.errors.length === 0, t.errors.slice(0, 3).join(" | "));
  },
};
