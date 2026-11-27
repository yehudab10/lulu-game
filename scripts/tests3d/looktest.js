// 🎨 The look test (features/looktest): WITHOUT ?look=2 nothing changes (today's car + Lulu, no extra model loaded,
// the renderer as it was); WITH it the improved car keeps every hook the game uses (4 wheels, 2 steered, the steering
// wheel, tail lights, the 9 anchors, Lulu + her hair, the Body mesh feel/damage dents, the windscreen pivot), a
// repaint works, Lulu on foot is the skinned one with Idle / Walk / Run blending by speed, her clothes sockets are
// there, the old poses still play, and the scene is lit by the sky.
module.exports = {
  name: "looktest",
  query: "&enable=atmos,foot",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { best: 1000, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    // ── off: today's game ──
    t.check("no flag → the look test is asleep", await g(`ctx.look && ctx.look.on === false`));
    t.check("…no look-test model loaded", await t.L(`import("./js/models.js").then(m => !m.models.looktestCar && !m.models.looktestLulu)`));
    t.check("…today's tone mapping (ACES)", await g(`L3.renderer.toneMapping === 4`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    await t.frames(10);
    t.check("…today's car (lulu_car: 9.3k triangles)", await g(`(() => { let n = 0; ctx.car.model.traverse(o => { if (o.isMesh) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return n < 12000; })()`));

    // ── on ──
    if (!await t.boot("&enable=atmos,foot&look=2")) return;
    t.check("?look=2 → on", await g(`ctx.look.on && ctx.look.car === "good" && ctx.look.lulu && ctx.look.light`));
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "drives")) return;
    await t.frames(10);
    const h = await g(`(() => { const c = ctx.car, m = c.model; let body = false, tris = 0;
      m.traverse(o => { if (o.isMesh) { tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; if (o.material.name === "Body" && /LuluCar_body/.test(o.parent.name + o.name)) body = true; } });
      return { w: c.wheels.length, f: c.wheels.filter(w => w.front).length, sw: !!c.steeringWheel, tl: c.taillights.length, a: Object.keys(c.anchors).length,
        d: !!c.driver, hair: c.hairs.length, ws: !!m.getObjectByName("ws"), body, tris }; })()`);
    t.check("the improved car keeps the hooks", h.w === 4 && h.f === 2 && h.sw && h.tl >= 1 && h.a === 9 && h.d && h.hair >= 1 && h.ws && h.body && h.tris > 20000, JSON.stringify(h));
    await g(`(ctx.car.setSkin("blue"), true)`);
    t.check("a repaint recolours it", await g(`(() => { let c = null; ctx.car.model.traverse(o => { if (o.isMesh && o.material.name === "Body") c = o.material.color.getHexString(); }); return c === "2196f3"; })()`));
    t.check("the scene is lit by the sky + Neutral tone mapping", await g(`!!ctx.scene.environment && L3.renderer.toneMapping === 7`));

    // ── Lulu on foot ──
    await g(`ctx.foot.start("droveOff")`);
    if (!await t.until(`__lulu3d.state === "footRun" && ctx.foot.obj`, "on foot")) return;
    await t.frames(60);
    const p = await g(`(() => { const L1 = ctx.foot.debug.F.lulu; const n = {}; L1.obj.traverse(o => { if (o.isBone) n.bones = (n.bones || 0) + 1; if (o.isSkinnedMesh) n.skinned = true; if (/^(Body|Arm_L|Arm_R)$/.test(o.name)) n[o.name] = true; });
      return Object.assign(n, { look: !!L1.look, clips: !!(L1.idle && L1.walkA && L1.runA), w: L1.w }); })()`);
    t.check("on foot she's the skinned Lulu (bones, 3 cycles)", p.look && p.skinned && p.bones >= 15 && p.clips, JSON.stringify(p));
    t.check("…with the clothes sockets (Body, Arm_L, Arm_R)", p.Body && p.Arm_L && p.Arm_R);
    await t.page.keyboard.down("KeyW");
    await t.frames(45);
    const walk = await g(`ctx.foot.debug.F.lulu.w`);
    t.check("walking → the Walk cycle takes over", walk.walk > 0.8, JSON.stringify(walk));
    await t.page.keyboard.down("ShiftLeft");
    await t.frames(45);
    const run = await g(`ctx.foot.debug.F.lulu.w`);
    t.check("running → the Run cycle", run.run > 0.8, JSON.stringify(run));
    await t.page.keyboard.up("ShiftLeft"); await t.page.keyboard.up("KeyW");
    await t.frames(45);
    const stop = await g(`ctx.foot.debug.F.lulu.w`);
    t.check("stopping → back to Idle", stop.idle > 0.8, JSON.stringify(stop));
    const wave = await g(`(() => { const L1 = ctx.foot.debug.F.lulu, b = L1.bones.UpperArmR, q0 = b.quaternion.clone(); L1.update(1 / 30, { walk: 0, wave: true }); return 1 - Math.abs(q0.dot(b.quaternion)); })()`);
    t.check("an old pose (wave) still moves her arm", wave > 0.05, String(wave));
    await t.shot("looktest-foot");
  },
};
