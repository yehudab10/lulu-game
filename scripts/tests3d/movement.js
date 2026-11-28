// 🤸 Movement that's fun on its own (ci/move): the on-foot JUMP (height with the button held vs a tap,
// gravity, landing), the LOW OBSTACLES (blocked by a guardrail on foot, over it with a jump; up on a
// bench; a parked car's hood then its roof), the jump chaining into the style combo (slide → LONG JUMP,
// a roll pressed in the air → a landing roll), the FREE camera (the right stick turns it and it STAYS;
// "up" walks away from it; R3 brings it back behind her), the car's HELD look (it stays, then drifts back),
// and the button map on every device (controller ○ / B jumps + □ / X rolls; keyboard Space / C;
// glyphs for PlayStation, Xbox, Switch, keyboard and touch; the △ / Y emote slot is reserved). The touch
// layout (JUMP + ROLL buttons, a drag on the picture to look) is movetouch.js.
module.exports = {
  name: "movement",
  query: "&enable=moves",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink" },
  async run(t) {
    const G = code => t.game(code);
    const FF = `ctx.foot.debug.F`;
    const release = async () => { await t.stick(0, 0); await t.L(`(__pad.axes[2] = 0, __pad.axes[3] = 0)`); for (const b of [0, 1, 2, 3, 5, 6, 7, 11]) await t.hold(b, 0); };
    // watch her feet's height every frame (the game's own loop; the test only reads it)
    await t.boot();
    await G(`(() => { const C = window.__lulu3d.ctx; window.__air = { peak: 0, on: false };
      const tick = () => { requestAnimationFrame(tick); const F = C.foot && C.foot.debug.F; if (!F || !window.__air.on) return;
        window.__air.peak = Math.max(window.__air.peak, F.y || 0); }; requestAnimationFrame(tick); return true; })()`);
    // the stick + ○ in ONE instant (two separate presses can land a game frame apart → a different jump)
    const runJump = (y = -1) => t.L(`(__pad.axes[0] = 0, __pad.axes[1] = ${y}, __btn(1, 1), 0)`);
    const letGo = () => t.L(`(__pad.axes[0] = 0, __pad.axes[1] = 0, __btn(1, 0), 0)`);
    const peakReset = () => G(`(window.__air.peak = 0, window.__air.on = true, true)`);
    const peak = () => G(`window.__air.peak`);

    // ── on foot ──
    await G(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.until(`__lulu3d.state === "intro" || __lulu3d.state === "playing"`, "a run starts");
    await G(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await t.until(`__lulu3d.state === "playing"`, "driving", 20000);
    await G(`(() => { const p = ctx.world.road.point(1600, 6.5, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = 1600; ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; return true; })()`);
    await t.frames(4);
    await G(`ctx.foot.start("droveOff")`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "Lulu's on foot", 15000);
    await G(`(ctx.traffic.config.enabled = false, ctx.law && ctx.law.hold && ctx.law.hold(300), true)`);
    // a few steps away from her car, out on the open shoulder
    await t.stick(0, -1); await t.frames(40); await t.stick(0, 0); await t.frames(10);
    t.check("input.foot is on while she walks", await t.L(`import("./js/input.js").then(I => I.input.foot === true)`) && await t.L(`document.body.classList.contains("onfoot")`));

    // ── the button map on each device ──
    const gl = await G(`(() => { const out = {}; return import("./js/input.js").then(I => { for (const k of ["ps", "xbox", "nintendo", "keyboard", "touch"]) { const g = I.glyphSet(k); out[k] = [g.jump, g.footMove, g.emote, g.freeLook, g.recentre]; } return out; }); })()`);
    t.check("glyphs: PlayStation ○ jump · □ roll · △ emote", JSON.stringify(gl.ps.slice(0, 3)) === JSON.stringify(["○", "□", "△"]), JSON.stringify(gl.ps));
    t.check("glyphs: Xbox B jump · X roll · Y emote", JSON.stringify(gl.xbox.slice(0, 3)) === JSON.stringify(["B", "X", "Y"]), JSON.stringify(gl.xbox));
    t.check("glyphs: Switch A jump · Y roll", gl.nintendo[0] === "A" && gl.nintendo[1] === "Y", JSON.stringify(gl.nintendo));
    t.check("glyphs: keyboard Space jump · C roll · mouse drag look", gl.keyboard[0] === "Space" && gl.keyboard[1] === "C" && /Mouse/.test(gl.keyboard[3]), JSON.stringify(gl.keyboard));
    t.check("glyphs: touch JUMP · ROLL", gl.touch[0] === "JUMP" && gl.touch[1] === "ROLL", JSON.stringify(gl.touch));
    t.check("the button guide lists Jump + Look around", await G(`import("./js/core/screens.js").then(S => { const h = S.controlsHtml(); return /Jump/.test(h) && /Look around/.test(h); })`));
    // (one hint at a time since ci/sweep-phone 55881dd9: the coach waits while the "you're on foot" walk hint is up — 6 s)
    const coachUp = `/JUMP/.test((document.querySelector(".prompt") || {}).textContent || "")`;
    if (await t.until(coachUp, "a coach line names the jump the first walks (once the walk hint is gone)", 12000))
      t.check("a coach line names the jump the first walks", true, await t.L(`(document.querySelector(".prompt") || {}).textContent || ""`));

    // ── the JUMP: held = high, a tap = a hop ──
    const y0 = await G(`${FF}.y`);
    await peakReset();
    await t.hold(1, 1); await t.frames(16); await t.hold(1, 0);
    await t.until(`!__lulu3d.ctx.foot.airborne`, "she lands", 5000);
    const hi = await peak();
    t.check("○ / B held on foot = a real jump (≥ 1.1 m)", y0 === 0 && hi >= 1.1 && hi <= 1.45, `peak ${hi.toFixed(2)} m`);
    t.check("…and she lands back on the ground", await G(`${FF}.y === 0 && !${FF}.air && ctx.state === "footRun"`));
    await t.frames(6);
    await peakReset();
    await t.tap(1);
    await t.until(`!__lulu3d.ctx.foot.airborne`, "she lands from a hop", 5000);
    const lo = await peak();
    t.check("a quick tap = a small hop (lower than held)", lo > 0.25 && lo < hi - 0.3, `tap ${lo.toFixed(2)} vs held ${hi.toFixed(2)}`);
    t.check("jumping doesn't open anything (○ is not 'back' on foot)", await G(`ctx.state === "footRun" && !ctx.paused`));
    t.check("both jumps counted", await G(`${FF}.jumps >= 2`));

    // keyboard: Space jumps on foot, C rolls (moves)
    await t.L(`(window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " })), 0)`);
    await t.frames(2);
    const kbAir = await G(`ctx.foot.airborne`);
    await t.L(`(window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " " })), 0)`);
    t.check("keyboard Space jumps on foot", kbAir, String(kbAir));
    await t.until(`!__lulu3d.ctx.foot.airborne`, "lands (keyboard)", 5000);
    await t.frames(4);
    await t.key("KeyC");
    t.check("keyboard C → the roll (moves)", await G(`ctx.moves.debug.foot().on && ctx.moves.debug.foot().kind === "roll"`), JSON.stringify(await G(`ctx.moves.debug.foot()`)));
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on && __lulu3d.ctx.foot.phase === "walk"`, "the roll ends", 5000);
    await G(`(window.__lulu3d.ctx.moves.combo.t = 0.01, true)`); await t.frames(3);

    // ── a low obstacle: a guardrail stops her walking, a jump clears it ──
    const putAhead = (kind, dist, r) => G(`(() => { const F = ${FF}, y = ctx.cam.free.yaw; const x = F.pos.x + Math.sin(y) * ${dist}, z = F.pos.z + Math.cos(y) * ${dist};
      const ch = ctx.world.activeChunks().find(c => Math.abs(c.s0 + 100 - F.s) < 120); window.__low = ch.addCollider({ x, z, r: ${r}, kind: "${kind}" }); return true; })()`);
    const dropLow = () => G(`((window.__lows || [window.__low]).forEach(c => c && (c.off = true)), window.__lows = null, true)`);
    // a guardrail across her path: a row of circles (one small circle she'd just walk round)
    const railAhead = dist => G(`(() => { const F = ${FF}, y = ctx.cam.free.yaw; const ch = ctx.world.activeChunks().find(c => Math.abs(c.s0 + 100 - F.s) < 120);
      window.__lows = []; for (let k = -6; k <= 6; k++) { const x = F.pos.x + Math.sin(y) * ${dist} - Math.cos(y) * k * 0.5, z = F.pos.z + Math.cos(y) * ${dist} + Math.sin(y) * k * 0.5;
        window.__lows.push(ch.addCollider({ x, z, r: 0.35, kind: "rail" })); } window.__low = window.__lows[6]; return true; })()`);
    // face the camera's way first (walk a step), then a rail 2 m ahead
    await t.stick(0, -0.5); await t.frames(6); await t.stick(0, 0); await t.frames(10);
    await railAhead(2.2);
    const s0 = await G(`({ x: ${FF}.pos.x, z: ${FF}.pos.z, y: ctx.cam.free.yaw })`);
    await t.stick(0, -1); await t.frames(45); await t.stick(0, 0); await t.frames(4);
    const past = () => G(`(() => { const F = ${FF}; return (F.pos.x - window.__low.x) * Math.sin(${s0.y}) + (F.pos.z - window.__low.z) * Math.cos(${s0.y}); })()`);
    const blocked = await past();
    t.check("walking into a guardrail: it's solid (she stops at it)", blocked < 0, `${blocked.toFixed(2)} m past it`);
    await t.stick(0, 1); await t.frames(16); await t.stick(0, 0); await t.frames(4);     // back off a step
    await t.stick(0, -1); await t.frames(6); await t.hold(1, 1); await t.frames(30); await t.hold(1, 0); await t.stick(0, 0);
    await t.until(`!__lulu3d.ctx.foot.airborne`, "lands past the rail", 5000);
    const over = await past();
    t.check("a running jump clears the guardrail (a low obstacle)", over > 0.4, `${over.toFixed(2)} m past it`);
    t.check("…a 🦘 HOP for the style combo", await G(`(ctx.moves.save.n.hop || 0) >= 1`), JSON.stringify(await G(`ctx.moves.save.n`)));
    await dropLow();

    // ── a bench: jump up, stand on it ──
    await t.frames(20);
    // walking steadily, then the bench appears 1.6 m ahead in the same instant she presses ○ (deterministic)
    await t.stick(0, -1);
    await t.until(`Math.hypot(__lulu3d.ctx.foot.debug.F.vel.x, __lulu3d.ctx.foot.debug.F.vel.z) > 3.3`, "walking", 3000);
    await G(`(() => { const F = ${FF}, y = ctx.cam.free.yaw; const x = F.pos.x + Math.sin(y) * 1.6, z = F.pos.z + Math.cos(y) * 1.6;
      const ch = [...ctx.world.activeChunks()].find(c => Math.abs(c.s0 + 100 - F.s) < 120); window.__low = ch.addCollider({ x, z, r: 0.55, kind: "bench" }); window.__lows = null; __btn(1, 1); return true; })()`);
    await t.until(`__lulu3d.ctx.foot.airborne && __lulu3d.ctx.foot.debug.F.vy < 0`, "past the top", 5000);
    await t.stick(0, 0);                         // (let go of the stick in the air: she keeps her momentum)
    await t.until(`!__lulu3d.ctx.foot.airborne`, "lands on the bench", 5000);
    await letGo();
    const bench = await G(`({ y: ${FF}.y, g: ${FF}.ground })`);
    t.check("she lands UP on the bench and stands there", Math.abs(bench.y - 0.55) < 0.02, JSON.stringify(bench));
    await t.shot("on-bench");
    t.check("…🧍‍♀️ UP TOP chains into the combo", await G(`(ctx.moves.save.n.perch || 0) >= 1 && ctx.moves.combo.n >= 1`), JSON.stringify(await G(`({ n: ctx.moves.combo.n, kinds: ctx.moves.combo.kinds })`)));
    // jump off + press roll in the air → a landing roll (a chain)
    await t.stick(0, -1); await t.tap(1); await t.frames(3); await t.tap(2);
    await t.until(`__lulu3d.ctx.moves.debug.foot().on || __lulu3d.ctx.foot.phase === "walk" && !__lulu3d.ctx.foot.airborne && __lulu3d.ctx.foot.debug.F.landT <= 0`, "lands off the bench", 5000);
    await t.until(`__lulu3d.ctx.moves.debug.foot().on`, "the roll pressed in the air rolls out of the landing", 3000);
    await t.stick(0, 0);
    await t.until(`!__lulu3d.ctx.moves.debug.foot().on && __lulu3d.ctx.foot.phase === "walk"`, "the landing roll ends", 5000);
    t.check("…bench → jump → landing roll = one combo", await G(`ctx.moves.combo.n >= 2`), JSON.stringify(await G(`({ n: ctx.moves.combo.n, kinds: ctx.moves.combo.kinds })`)));
    await dropLow();
    await G(`(ctx.moves.combo.t = 0.01, true)`); await t.frames(3);

    // ── a parked car: hood, then roof ──
    await t.stick(0, -1);
    await t.until(`Math.hypot(__lulu3d.ctx.foot.debug.F.vel.x, __lulu3d.ctx.foot.debug.F.vel.z) > 3.3`, "walking", 3000);
    await G(`(() => { const F = ${FF}, y = ctx.cam.free.yaw; const p = { x: F.pos.x + Math.sin(y) * 3.1, z: F.pos.z + Math.cos(y) * 3.1 }; const n = ctx.world.road.nearest(p.x, p.z, F.s, {});
      const c = window.__pk = ctx.traffic.add("sedan", n.s, n.d, 1, 0, { ai: (dt, cc) => { cc.speed = 0; } }); c.free = true; c.x = p.x; c.z = p.z; c.h = y; ctx.traffic.place(c, 0); __btn(1, 1); return true; })()`);
    // lengthwise: the car's back end ~0.9 m ahead — a running jump lands on the trunk / roof
    await t.until(`__lulu3d.ctx.foot.airborne && __lulu3d.ctx.foot.debug.F.vy < 0`, "past the top", 5000);
    await t.stick(0, 0);
    await t.until(`!__lulu3d.ctx.foot.airborne`, "lands on the car", 5000);
    await letGo();
    const hood = await G(`${FF}.y`);
    t.check("a jump at a parked car lands her on it (hood / trunk ~0.95 m)", hood > 0.85 && hood < 1.5, hood.toFixed(2));
    await t.frames(4);
    // already on the roof? fine; else hop up from the hood
    // (a hop toward the roof — a few tries: where on the trunk she landed varies a little with the machine's timing)
    for (let i = 0; i < 4 && await G(`${FF}.y < 1.3 && ${FF}.y > 0.5`); i++) {
      await G(`(() => { const F = ${FF}, c = window.__pk; F.lulu.obj.rotation.y = Math.atan2(c.x - F.pos.x, c.z - F.pos.z); ctx.cam.free.yaw = F.lulu.obj.rotation.y; return true; })()`);
      await t.until(`Math.hypot(__lulu3d.ctx.foot.debug.F.vel.x, __lulu3d.ctx.foot.debug.F.vel.z) < 0.05`, "standing still", 3000);
      await runJump(-0.4); await t.frames(3);
      await t.until(`!__lulu3d.ctx.foot.airborne`, "lands again", 5000); await letGo(); await t.frames(3);
    }
    const roof = await G(`${FF}.y`);
    t.check("…and another jump gets her up on the ROOF (1.45 m)", Math.abs(roof - 1.45) < 0.05, roof.toFixed(2));
    await t.shot("car-roof");
    await t.stick(0, -1);
    await t.until(`!__lulu3d.ctx.foot.airborne && __lulu3d.ctx.foot.debug.F.y === 0`, "she steps off the car back to the ground", 8000);
    await t.stick(0, 0);
    await G(`(ctx.traffic.remove(window.__pk), ctx.moves.combo.t = 0.01, true)`); await t.frames(3);

    // ── sprint → slide → jump = LONG JUMP ──
    await t.stick(0, -1); await t.hold(5, 1); await t.frames(14);
    await t.tap(2);
    t.check("sprint + □ → a slide", await G(`ctx.moves.debug.foot().kind === "slide" && ctx.moves.debug.foot().on`));
    const ls0 = await G(`({ x: ${FF}.pos.x, z: ${FF}.pos.z })`);
    await t.frames(3); await t.tap(1);
    await t.frames(2);
    t.check("…○ mid-slide launches her", await G(`ctx.foot.airborne && ${FF}.longJump`));
    await t.until(`!__lulu3d.ctx.foot.airborne`, "lands the long jump", 5000);
    await t.hold(5, 0); await t.stick(0, 0);
    const ls1 = await G(`({ x: ${FF}.pos.x, z: ${FF}.pos.z })`);
    t.check("🦘 LONG JUMP lands in the combo", await G(`(ctx.moves.save.n.longjump || 0) >= 1`), JSON.stringify(await G(`ctx.moves.save.n`)));
    t.check("…and it goes a long way", Math.hypot(ls1.x - ls0.x, ls1.z - ls0.z) > 4.5, Math.hypot(ls1.x - ls0.x, ls1.z - ls0.z).toFixed(1) + " m");
    await G(`(ctx.moves.combo.t = 0.01, true)`); await t.frames(3);
    await t.shot("after-long-jump");

    // ── the FREE camera: turn it, it stays; "up" walks away from it ──
    const yawA = await G(`ctx.cam.free.yaw`);
    await t.L(`(__pad.axes[2] = 1)`); await t.frames(14); await t.L(`(__pad.axes[2] = 0)`); await t.frames(2);
    const yawB = await G(`ctx.cam.free.yaw`);
    const turned = Math.abs(((yawB - yawA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    t.check("the right stick turns the camera", turned > 0.8, turned.toFixed(2) + " rad");
    await t.frames(90);
    const yawC = await G(`ctx.cam.free.yaw`);
    t.check("…and it STAYS where she put it (3 s later, standing still)", Math.abs(yawC - yawB) < 0.02, `${yawB.toFixed(3)} → ${yawC.toFixed(3)}`);
    await t.stick(0, -1); await t.frames(20);
    const dir = await G(`(() => { const F = ${FF}, v = Math.hypot(F.vel.x, F.vel.z) || 1, y = ctx.cam.free.yaw; return (F.vel.x * Math.sin(y) + F.vel.z * Math.cos(y)) / v; })()`);
    t.check("stick up walks AWAY from the camera (third-person)", dir > 0.95, dir.toFixed(3));
    await t.stick(0.8, -0.6); await t.frames(40); await t.stick(0, 0); await t.frames(2);
    const yawD = await G(`ctx.cam.free.yaw`);
    t.check("walking diagonally doesn't spin the camera round", Math.abs(((yawD - yawC + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.35, `${yawC.toFixed(2)} → ${yawD.toFixed(2)}`);
    // the look stick pitch: down raises the camera
    const camY0 = await G(`ctx.camera.position.y`);
    await t.L(`(__pad.axes[3] = 1)`); await t.frames(10); await t.L(`(__pad.axes[3] = 0)`); await t.frames(6);
    t.check("right stick down → the camera rises (looks down)", await G(`ctx.camera.position.y`) > camY0 + 0.5);
    // R3: back behind her
    await t.tap(11); await t.frames(20);
    const behind = await G(`Math.abs(((ctx.cam.free.yaw - ${FF}.lulu.obj.rotation.y) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI)`);
    t.check("R3 swings the camera back behind her", behind < 0.2, behind.toFixed(2));
    // invert look flips the pitch
    await G(`(() => { const s = ctx.cam; return import("./js/core/save.js").then(S => { S.save3d.settings.invertLook = true; return true; }); })()`);
    const p0 = await G(`ctx.cam.free.pitch`);
    await t.L(`(__pad.axes[3] = 1)`); await t.frames(6); await t.L(`(__pad.axes[3] = 0)`); await t.frames(2);
    t.check("invert look: stick down lowers the camera instead", await G(`ctx.cam.free.pitch`) < p0 - 0.1);
    await G(`import("./js/core/save.js").then(S => { S.save3d.settings.invertLook = false; return true; })`);
    // a mouse drag on the picture turns it too (desktop)
    const yawE = await G(`ctx.cam.free.yaw`);
    await t.page.mouse.move(600, 300); await t.page.mouse.down(); await t.page.mouse.move(700, 300, { steps: 4 }); await t.frames(3); await t.page.mouse.up(); await t.frames(3);
    t.check("a mouse drag on the picture turns the camera (and it stays)", Math.abs(await G(`ctx.cam.free.yaw`) - yawE) > 0.3, (await G(`ctx.cam.free.yaw`) - yawE).toFixed(2));
    await t.shot("free-look");

    // ── in the car: the look is HELD a moment, then drifts back ──
    await release();
    await G(`(() => { const F = ${FF}; ctx.foot.drive({ own: true, x: F.pos.x, z: F.pos.z, h: F.h }); return true; })()`);
    await t.until(`__lulu3d.state === "playing"`, "back in the car", 10000);
    t.check("input.foot is off in the car (B brakes again, Space is the handbrake)", !(await t.L(`document.body.classList.contains("onfoot")`)));
    await t.frames(20);
    await t.L(`(__pad.axes[2] = 1)`); await t.frames(10); await t.L(`(__pad.axes[2] = 0)`); await t.frames(10);
    const held = await G(`ctx.cam.state.lookYaw`);
    t.check("car: the right stick turns the view and it HOLDS after letting go", Math.abs(held) > 0.6, held.toFixed(2));
    await t.frames(150);
    t.check("…then drifts back behind the car", Math.abs(await G(`ctx.cam.state.lookYaw`)) < 0.15, (await G(`ctx.cam.state.lookYaw`)).toFixed(2));
    // Space is the handbrake in the car (not a jump)
    await t.L(`(window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space", key: " " })), 0)`); await t.frames(2);
    t.check("keyboard Space in the car = handbrake", await t.L(`import("./js/input.js").then(I => I.input.handbrake === true && !I.input.jumpHeld)`));
    await t.L(`(window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space", key: " " })), 0)`);
    t.check("no errors", t.errors.length === 0, t.errors.slice(0, 3).join(" | "));
  },
};
