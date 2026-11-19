// 🌊 Flow (core/camera.js cam.blend · core/transition.js dissolve · foot's hop-in): the picture never jumps where it
// used to cut.
//   • getting out of the car: the camera glides from the chase cam to her (no jump between two frames), and she's
//     in control as soon as she's on her feet
//   • getting back in: she hops INTO the seat (a "getin" phase), then the camera glides to the chase cam; the car
//     doesn't flicker while her courtesy shield runs
//   • a teleport is still a cut (cam.blend refuses a jump of more than 70 m)
//   • leaving a town whose models are loaded is a SOFT CUT (the frozen frame melts away; the black fade stays out)
//   • a building's inside can be warmed ahead of the door
module.exports = {
  name: "flow",
  query: "&enable=town",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    // every frame: how far the picture moved since the last one (the hud hook runs after the camera)
    await t.L(`import("./js/core/ctx.js").then(m => { const W = window.__cam = { on: false, max: 0, n: 0, last: null, hid: 0 };
      m.hook("hud", () => { const p = m.ctx.camera.position; if (W.on && W.last) { W.max = Math.max(W.max, Math.hypot(p.x - W.last.x, p.y - W.last.y, p.z - W.last.z)); W.n++; } W.last = { x: p.x, y: p.y, z: p.z };
        if (m.ctx.state === "playing" && !m.ctx.car.obj.visible) W.hid++; }); })`);
    const watch = on => t.L(`(window.__cam.on = ${on}, window.__cam.max = 0, window.__cam.n = 0, true)`);
    const moved = () => t.L(`({ max: +window.__cam.max.toFixed(2), n: window.__cam.n })`);

    t.check("ctx.cam.blend + ctx.dissolve are there", await g(`typeof ctx.cam.blend === "function" && typeof ctx.dissolve === "function"`));

    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a cruise starts")) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    // parked on the right shoulder, standing still
    await g(`(() => { const r = ctx.world.road, s = ctx.car.s + 40, p = r.point(s, 8.0, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 8.0; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
    await t.frames(30);

    // ── out of the car: one move ──
    await watch(true);
    await g(`(ctx.foot.start("droveOff"), true)`);
    t.check("getting out starts a camera blend (not a snap)", await g(`ctx.cam.blending === true`));
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.debug.F.phase === "walk"`, "she's on her feet and walking", 6000);
    const walkAt = await g(`+ctx.foot.debug.F.t.toFixed(2)`);
    t.check("in control within ~0.6 s of getting out", walkAt <= 0.75, String(walkAt));
    await t.frames(30);
    let m = await moved();
    t.check("out of the car: the picture never jumps (≤ 1.5 m between two frames)", m.n > 20 && m.max <= 1.5, JSON.stringify(m));
    await t.shot("out-of-the-car");

    // ── back in: she hops into the seat, then the camera glides ──
    await g(`(() => { const F = ctx.foot.debug.F, c = F.car.stub; F.pos.set(c.x + Math.cos(c.h) * 2.0, 0.05, c.z - Math.sin(c.h) * 2.0); return true; })()`);
    await t.frames(4);
    await watch(true);
    t.check("✋ offers her own car", /GET BACK IN/.test(await g(`(ctx.foot.debug.interactables() || {}).label || ""`)));
    await t.tap(0);
    const hop = await g(`(() => { const F = ctx.foot.debug.F; return F ? F.phase : "gone"; })()`);
    t.check("she HOPS in (a getin phase, not a vanish)", hop === "getin", hop);
    await t.shot("hop-in");
    await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "she's driving again", 4000);
    t.check("…and the camera blends to the chase cam", await g(`ctx.cam.blending === true`));
    await t.frames(30);
    m = await moved();
    t.check("back in the car: the picture never jumps (≤ 1.5 m between two frames)", m.n > 20 && m.max <= 1.5, JSON.stringify(m));
    t.check("the blend has ended", await g(`ctx.cam.blending === false`));
    t.check("her car doesn't blink after she hops in (a courtesy shield, no flicker)", await t.L(`window.__cam.hid === 0`) && await g(`ctx.G.invT > 0`), String(await t.L(`window.__cam.hid`)));

    // ── a teleport is still a cut ──
    await g(`(() => { ctx.cam.blend(0.6); const r = ctx.world.road, s = ctx.car.s + 400, p = r.point(s, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = s; ctx.car.d = 1.75; ctx.world.prebuild(s); return true; })()`);
    await t.frames(2);
    t.check("a 400 m jump is not blended (it cuts)", await g(`ctx.cam.blending === false && Math.hypot(ctx.camera.position.x - ctx.car.pos.x, ctx.camera.position.z - ctx.car.pos.z) < 20`));
    await watch(false);

    // ── leaving a town: the soft cut, no black ──
    await g(`(ctx.town.load("lakewood"), true)`);
    if (!await t.until(`__lulu3d.ctx.town.loaded("lakewood")`, "Lakewood's models load", 90000)) return;
    await g(`ctx.town.enter({ town: "lakewood", speed: 0 })`);
    if (!await t.until(`__lulu3d.ctx.town.active`, "in Lakewood", 8000)) return;
    await t.frames(10);
    await t.L(`(window.__black = 0, window.__blk = setInterval(() => { const f = document.getElementById("townFade"); if (f) window.__black = Math.max(window.__black, +f.style.opacity || 0); }, 10), true)`);
    t.check("the ramp's transition starts", await g(`ctx.town.debug.trans("leave")`));
    await t.frames(2);
    const soft = await t.L(`({ shown: !!document.getElementById("softCut") && document.getElementById("softCut").style.display === "block", active: __lulu3d.ctx.town.active })`);
    t.check("back on the highway behind a frozen frame (the soft cut is up)", soft.shown && !soft.active, JSON.stringify(soft));
    await t.shot("soft-cut");
    await t.until(`!__lulu3d.ctx.town.transitioning`, "the transition ends", 4000);
    await t.page.waitForTimeout(700);
    const after = await t.L(`(clearInterval(window.__blk), { black: window.__black, gone: document.getElementById("softCut").style.display === "none" || +document.getElementById("softCut").style.opacity === 0 })`);
    t.check("…it melts away, and the black fade never showed", after.gone && after.black === 0, JSON.stringify(after));
    t.check("she's driving on the highway", await g(`L3.state === "playing" && !ctx.world.road.town`));

    // ── a building's inside can be warmed ahead of the door ──
    t.check("interiors can be warmed (ctx.interiors.<id>.warm)", await g(`typeof ctx.interiors.bar.warm === "function" && (ctx.interiors.bar.warm(), ctx.interiors.bar.warm(), true)`));
    await t.frames(10);
  },
};
