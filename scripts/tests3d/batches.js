// ⚡ Draw-call batches (ci/perf4, lod.js): the people's main-pass batch — every spawned person's plain parts drawn in
// ONE multi-draw (was ~13 draws a person) — checked the hard way: the same frame drawn with the batch on and off must
// be the same picture (LOW and MEDIUM, shadows included), with far fewer draw calls; a walking person keeps walking,
// a recolour shows at once, a part that turns see-through hands her back to her own meshes, a hidden person isn't
// drawn, a person moved into another scene (an interior, a portrait) is drawn there, and nothing in the scene is ever
// left on the batch's layer once she's out of it.
const SETTINGS = { quality: "low", vibration: true, invertLook: false, steerSens: 1, calm: false, tv: "off", hud: 1, hudMode: "full", chatter: "normal" };

module.exports = {
  name: "batches",
  viewport: { width: 960, height: 540 },
  query: "&enable=atmos",
  save2d: { totalCoins: 100, ownedSkins: ["pink"], selectedSkin: "pink" },
  save3d: { best: 1000, settings: SETTINGS, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "a run starts")) return;
    await g(`(ctx.atmos.debug.weather("clear"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law && ctx.law.hold && ctx.law.hold(9999), true)`);
    await t.frames(20);

    // a row of people on the road ahead of the camera, 6 … 70 m away (any person models that are loaded)
    const made = await t.L(`Promise.all([import("./js/models.js"), import("./js/core/people.js")]).then(async ([M, P]) => {
        const L3 = __lulu3d, ctx = L3.ctx;
        const want = ["npcWoman", "npcMan", "npcKid", "imaPerson", "copPerson", "hillelPerson"].filter(k => M.modelFiles()[k]);
        await M.ensureModels(want).catch(() => null);
        const keys = Object.keys(M.models).filter(k => M.models[k] && M.findNodes(M.models[k], "Arm_L").length && M.findNodes(M.models[k], "Leg_L").length).slice(0, 6);
        const cam = ctx.camera, fwd = new (cam.position.constructor)(); cam.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        const side = { x: fwd.z, z: -fwd.x };
        window.__bt = { people: [] };
        const D = [6, 9, 13, 18, 26, 38, 52, 70];
        for (let i = 0; i < D.length; i++) {
          const p = P.spawnPerson(keys[i % keys.length], { colors: i === 1 ? { Top: "#3366ff" } : null });
          p.obj.position.set(cam.position.x + fwd.x * D[i] + side.x * (i % 2 ? 1.6 : -1.6), 0, cam.position.z + fwd.z * D[i] + side.z * (i % 2 ? 1.6 : -1.6));
          p.obj.rotation.y = Math.atan2(-fwd.x, -fwd.z) + i * 0.4;
          ctx.scene.add(p.obj);
          window.__bt.people.push(p);
        }
        // they walk / wave every frame (the batch must follow live poses)
        import("./js/core/ctx.js").then(c => c.hook("update", dt => { for (const [i, p] of window.__bt.people.entries()) p.update(dt, { walk: i % 3 ? 1.2 : 0, wave: i % 3 === 0 }); }));
        return { keys, n: D.length };
      })`);
    t.check("people spawned for the test", made && made.keys.length >= 2, JSON.stringify(made));
    await t.frames(12);

    // the same frame twice in one go: batch on, batch off — draws + pixels (the buffer is readable right after a draw)
    const ab = label => t.L(`import("./js/lod.js").then(m => { const L3 = __lulu3d, r = L3.renderer, gl = r.getContext(), ctx = L3.ctx;
        const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
        let n = 0, sh = 0, inSh = false; const sm = r.shadowMap, so = sm.render;
        const wrap = (o, f) => { const x = o[f]; if (typeof x !== "function") return null; o[f] = function () { n++; if (inSh) sh++; return x.apply(this, arguments); }; return () => { o[f] = x; }; };
        const md = gl.getExtension("WEBGL_multi_draw");
        const undo = [wrap(gl, "drawElements"), wrap(gl, "drawArrays"), wrap(gl, "drawElementsInstanced"), wrap(gl, "drawArraysInstanced"), md && wrap(md, "multiDrawElementsWEBGL"), md && wrap(md, "multiDrawArraysWEBGL")].filter(Boolean);
        sm.render = function () { inSh = true; try { return so.apply(this, arguments); } finally { inSh = false; } };
        const shot = () => { n = 0; sh = 0; r.render(ctx.scene, ctx.camera); const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); return { px, n, sh, calls: r.info.render.calls }; };
        let on, off;
        try {
          m.peopleBatchOn(true); shot(); on = shot();
          const info = m.peopleBatchInfo();
          m.peopleBatchOn(false); off = shot();
          m.peopleBatchOn(true);
          let diff = 0, max = 0;
          for (let i = 0; i < on.px.length; i += 4) { const d = Math.max(Math.abs(on.px[i] - off.px[i]), Math.abs(on.px[i + 1] - off.px[i + 1]), Math.abs(on.px[i + 2] - off.px[i + 2])); if (d > 2) diff++; if (d > max) max = d; }
          return { label: ${JSON.stringify(label)}, tier: L3.gfx.tier, on: { draws: on.n, shadow: on.sh, calls: on.calls }, off: { draws: off.n, shadow: off.sh, calls: off.calls }, diff, max, pixels: w * h, info, multiDraw: !!md };
        } finally { sm.render = so; for (const u of undo) u(); } })`);
    const low = await ab("low");
    t.check("LOW: the people are drawn through the batch", low.info.people >= 6 && low.info.parts >= 40, JSON.stringify(low.info));
    t.check("LOW: the same frame with the batch on and off is the same picture", low.diff <= 40 && low.max <= 24, JSON.stringify(low));
    t.check("LOW: far fewer draw calls with the batch (≥ 40 fewer for 8 people)", low.off.draws - low.on.draws >= 40, `${low.on.draws} vs ${low.off.draws}`);
    await t.shot("low");

    // MEDIUM: shadows (the shadow camera still sees the batched parts' layer — they cast through the shadow batch)
    await t.L(`import("./js/core/save.js").then(m => { m.save3d.settings.quality = "medium"; __lulu3d.ctx.applySettings(); })`);
    await t.frames(30);
    const med = await ab("medium");
    t.check("MEDIUM: the same frame with the batch on and off is the same picture (shadows included)", med.tier === "medium" && med.diff <= 40 && med.max <= 24, JSON.stringify(med));
    t.check("MEDIUM: fewer main-pass draws, the same shadow-pass draws", med.off.draws - med.on.draws >= 40 && med.on.shadow === med.off.shadow, JSON.stringify({ on: med.on, off: med.off }));
    await t.shot("medium");

    // live poses: the batch's copy of a walking person's leg follows the real leg
    const pose = await t.L(`import("./js/lod.js").then(m => { const p = window.__bt.people[1], leg = p.limbs.Leg_L; let mesh = null; leg.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
        return { layer: mesh.layers.mask, on: mesh.layers.mask === (1 << m.PEOPLE_LAYER), y: +mesh.matrixWorld.elements[13].toFixed(3) }; })`);
    t.check("a walking person's parts sit on the batch's layer (drawn by the batch, not hidden)", pose.on, JSON.stringify(pose));

    // a recolour shows at once (still the same picture on / off)
    await t.L(`(() => { const p = window.__bt.people[0]; p.obj.traverse(o => { if (o.isMesh && o.material.name === "Top") { o.material = o.material.clone(); o.material.color.set("#ff00aa"); } }); })()`);
    await t.frames(3);
    const rc0 = await t.L(`import("./js/lod.js").then(m => m.peopleBatchInfo())`);
    await t.frames(40);
    const rc = await ab("recolour");
    t.check("a swapped material: that person hands back, then re-joins the batch", rc0.released >= 1 && rc.info.people >= 6, JSON.stringify({ rc0, info: rc.info }));
    await t.L(`(() => { const p = window.__bt.people[0]; p.obj.traverse(o => { if (o.isMesh && o.material.name === "Top") o.material.color.set("#00cc44"); }); })()`);
    await t.frames(2);
    const rc2 = await ab("recolour2");
    t.check("a colour changed in place shows in the batch straight away (same picture on / off)", rc2.diff <= 40 && rc2.max <= 24, JSON.stringify(rc2));

    // see-through: hands back to her own meshes (drawn with transparency, never in the batch)
    const tr = await t.L(`import("./js/lod.js").then(m => { const p = window.__bt.people[2]; let part = null; p.obj.traverse(o => { if (!part && o.isMesh && o.layers.mask !== 1) part = o; });
        part.material = part.material.clone(); part.material.transparent = true; part.material.opacity = 0.5;
        const r = __lulu3d.renderer, ctx = __lulu3d.ctx; r.render(ctx.scene, ctx.camera); r.render(ctx.scene, ctx.camera);
        let back = true; p.obj.traverse(o => { if (o.isMesh && o.layers.mask !== 1) back = false; });
        return { back, info: m.peopleBatchInfo() }; })`);
    t.check("a part turned see-through: that person is drawn by her own meshes again", tr.back, JSON.stringify(tr));

    // hidden: not drawn by the batch either (same picture)
    await t.L(`(window.__bt.people[3].obj.visible = false, true)`);
    await t.frames(2);
    const hid = await ab("hidden");
    t.check("a hidden person stays hidden in the batch (same picture on / off)", hid.diff <= 40 && hid.max <= 24, JSON.stringify(hid));

    // another scene (an interior / a portrait): she's drawn there by her own meshes
    const other = await t.L(`import("three").then(THREE => { const p = window.__bt.people[4], L3 = __lulu3d, r = L3.renderer, ctx = L3.ctx;
        const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight("#fff", "#888", 2)); const prev = p.obj.parent; sc.add(p.obj);
        r.render(sc, ctx.camera); let real = 0, batched = 0; p.obj.traverse(o => { if (o.isMesh) { if (o.layers.mask === 1) real++; else batched++; } });
        prev.add(p.obj); return { real, batched }; })`);
    t.check("moved into another scene: drawn there by her own meshes (nothing left on the batch's layer)", other.real > 5 && other.batched === 0, JSON.stringify(other));

    // removed from the world: nothing of hers stays on the batch's layer once the main scene draws again
    const gone = await t.L(`(() => { const p = window.__bt.people[5], r = __lulu3d.renderer, ctx = __lulu3d.ctx; ctx.scene.remove(p.obj); r.render(ctx.scene, ctx.camera);
        let stuck = 0; p.obj.traverse(o => { if (o.isMesh && o.layers.mask !== 1) stuck++; }); ctx.scene.add(p.obj); return { stuck }; })()`);
    t.check("taken out of the world: her parts are back on the normal layer", gone.stuck === 0, JSON.stringify(gone));
    await t.frames(40);
    const fin = await ab("final");
    t.check("after all that: still the same picture on / off", fin.diff <= 40 && fin.max <= 24, JSON.stringify(fin));
    t.check("no errors", t.errors.length === 0, t.errors.slice(0, 3).join(" | "));
  },
};
