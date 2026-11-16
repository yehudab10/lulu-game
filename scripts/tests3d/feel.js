// Feel: positional 3D audio + visible damage on Lulu's own car.
//
// Audio — nothing throws while audio is still locked (no gesture yet: play/loop → null,
// law falls back to its flat siren); after the unlock a cruiser behind-left is heard
// left (pan < 0) and behind (z > 0, the "behind you" lowpass closes); a pursuit gives
// every lit cruiser its own located siren and silences the flat one; the voice cap holds
// with 24 emitters (and a lower cap steals the quietest); traffic passing her whooshes;
// on foot the music is routed through a lowpass (muffled) and the rain switches from a
// drum on the car to the open-air hiss; back in the car both come back.
// Damage — a left-side hit dents the left (decals + nudged vertices) and cracks the
// windshield; the last heart pops a hubcap that rolls away and drops the bumper (sparks);
// a heart pickup undoes a stage; Paint & Pray repairs; a new run is clean; a skin change
// keeps it; photo mode shows it; 20 hits leak no geometry / scene objects.
const W = `(globalThis.__feelA || (globalThis.__feelA = await import("/3d/js/audio.js")))`;

module.exports = {
  name: "feel",
  query: "&enable=feel,atmos",
  async run(t) {
    const g = t.game;
    const A = code => t.L(`(async () => { const A = ${W}; const L3 = window.__lulu3d, ctx = L3.ctx; return (${code}); })()`);
    const D = () => g(`ctx.feel.damage.info()`);
    t.check("ctx.feel service is up", await g(`!!(ctx.feel && ctx.feel.damage && ctx.feel.debug)`));

    // ── locked audio: nothing throws, nothing plays ──
    const locked = await A(`({ unlocked: A.spatial.unlocked, play: A.spatial.play("horn", { x: 0, y: 1, z: 5 }), loop: A.spatial.loop("siren", ctx.car.obj),
      stop: (A.spatial.stopAll(), A.spatial.update(1 / 30, ctx.camera, ctx.car.pos, true), "ok"), mute: (A.setMusicMuffle(0.7), A.musicMuffleInfo()) })`);
    t.check("before the first gesture: play/loop return null, update/stopAll/muffle are safe", !locked.unlocked && locked.play === null && locked.loop === null && locked.stop === "ok", JSON.stringify(locked));
    await g(`(L3.startRun({ mode: "cruise", s: 400 }), true)`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts (locked audio)")) return;
    await g(`(ctx.G.invT = 0, L3.emit("crash", { impact: 12, x: ctx.car.pos.x, z: ctx.car.pos.z + 3 }), L3.damage(0.6, "locked test"))`);
    await g(`ctx.law.startChase("TEST", { heat: 1 })`);
    await t.frames(10);
    t.check("a pursuit with locked audio uses the flat-siren fallback (no spatial sirens, no errors)", (await A(`A.spatial.stats().emitters`)) === 0 && t.errors.length === 0);
    await g(`(ctx.law.clearHeat && ctx.law.clearHeat(""), true)`);

    // ── unlock (the first gesture) ──
    await A(`(A.unlockAudio(), true)`);
    if (!await t.until(`window.__feelA && __feelA.spatial.ready`, "audio unlocks (AudioContext running)", 30000)) return;
    t.check("the voice pool is built (12 voices, cap 8 on desktop)", await A(`A.spatial.voices.length === 12 && A.spatial.maxVoices === 8`));
    await g(`(L3.startRun({ mode: "cruise", s: 400 }), true)`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts")) return;
    t.check("a new run starts clean", (await D()).k === 0);
    await g(`(ctx.traffic.clear(), ctx.traffic.config.enabled = false, true)`);
    await t.until(`__feelA.spatial.stats().generated >= 8`, "the sound kinds are synthesized in idle time", 20000);

    // ── a cruiser behind-left is heard left + behind ──
    await A(`(globalThis.__cop = ctx.traffic.add("cop", ctx.car.s - 22, -1.75, 1, 0), globalThis.__copH = A.spatial.loop("siren", __cop.obj), true)`);
    await t.frames(8);
    const cop = await A(`(() => { const i = __copH.info(), v = __copH.e.voice; return { i, px: v ? v.pan.positionX.value : null, pz: v ? v.pan.positionZ.value : null, model: v ? v.pan.panningModel : null }; })()`);
    t.check("cruiser behind-left: listener-space x < 0 (left), z > 0 (behind)", cop.i && cop.i.x < -1 && cop.i.z > 5, JSON.stringify(cop));
    t.check("…its PannerNode sits left + behind, and pans left", cop.px < 0 && cop.pz > 0 && cop.i.pan < -0.05 && cop.model === "equalpower", `pos ${cop.px} ${cop.pz} pan ${cop.i.pan}`);
    t.check("…'behind you' lowpass closes in (cutoff well under the open 18 kHz)", cop.i.cutoff < 8000 && cop.i.voiced, `cutoff ${cop.i.cutoff}`);
    await A(`(__copH.stop(), globalThis.__cop2 = ctx.traffic.add("cop", ctx.car.s + 22, 5.25, 1, 0), globalThis.__copH2 = A.spatial.loop("siren", __cop2.obj), true)`);
    await t.frames(8);
    const cop2 = await A(`__copH2.info()`);
    t.check("a cruiser ahead-right: x > 0, z < 0 and an open lowpass", cop2 && cop2.x > 1 && cop2.z < -5 && cop2.cutoff > cop.i.cutoff, JSON.stringify(cop2));
    await A(`(__copH2.stop(), ctx.traffic.clear(), true)`);

    // ── the law: every lit cruiser is a located siren ──
    await g(`ctx.law.startChase("SPEEDING", { heat: 2 })`);
    await t.frames(40);
    const law = await A(`({ list: A.spatial.list().filter(e => /siren/.test(e.kind)), units: ctx.law.chasing })`);
    t.check("pursuit: each lit cruiser carries its own positional siren", law.units && law.list.length >= 1, JSON.stringify(law.list.slice(0, 3)));
    await t.shot("chase");
    await g(`(ctx.law.clearHeat && ctx.law.clearHeat(""), true)`);
    await t.frames(4);

    // ── the voice cap ──
    const cap = await A(`(() => {
      const hs = [];
      for (let i = 0; i < 24; i++) hs.push(A.spatial.loop("siren", { x: ctx.car.pos.x + Math.cos(i) * (6 + i * 4), y: 1, z: ctx.car.pos.z + Math.sin(i) * (6 + i * 4) }));
      globalThis.__capH = hs; return hs.filter(Boolean).length; })()`);
    await t.frames(6);
    const s1 = await A(`A.spatial.stats()`);
    t.check("24 emitters → at most 8 voices (the hard cap holds)", cap === 24 && s1.voiced <= 8 && s1.voiced >= 6 && s1.peak <= 8, JSON.stringify(s1));
    const near = await A(`__capH.slice(0, 4).every(h => h.info().voiced)`);
    t.check("…the nearest (loudest) emitters got the voices", near);
    await A(`A.spatial.setMaxVoices(3)`);
    await t.frames(6);
    const s2 = await A(`A.spatial.stats()`);
    t.check("a lower cap (3) steals the quietest, loops go virtual", s2.voiced <= 3 && s2.emitters >= 24, JSON.stringify(s2));
    await A(`(A.spatial.setMaxVoices(8), __capH.forEach(h => h.stop()), A.spatial.stopAll(), true)`);
    await t.frames(4);
    t.check("stopAll frees every emitter", (await A(`A.spatial.stats().emitters`)) === 0);

    // ── passing traffic whooshes ──
    const p0 = await g(`ctx.feel.debug.passes().n`);
    await g(`(ctx.traffic.add("truck", ctx.car.s + 45, -1.75, -1, 18), ctx.traffic.add("sedan", ctx.car.s + 30, -5.25, -1, 16), true)`);
    await t.frames(110);
    const pas = await g(`ctx.feel.debug.passes()`);
    t.check("an oncoming truck + car passing her whoosh (the truck its heavier one)", pas.n >= p0 + 2 && pas.trucks >= 1, JSON.stringify(pas));

    // ── on foot: the music is muffled, the rain is open-air ──
    await g(`(ctx.atmos.debug.weather("rain", 1, true), true)`);
    await t.frames(20);
    const rainCar = await t.L(`import("/3d/js/features/atmos/sfx.js").then(m => m.rainInfo())`);
    t.check("rain in the car: the drum on the bodywork", rainCar && rainCar.where === "car" && rainCar.drum > 0.05, JSON.stringify(rainCar));
    await g(`ctx.foot.start("parked")`);
    if (await t.until(`__lulu3d.state === "footRun"`, "on foot")) {
      await t.frames(30);
      const mf = await A(`A.musicMuffleInfo()`);
      t.check("on foot: the music is routed through the lowpass (MediaElementSource) and muffled", mf.muffle > 0.6 && mf.routed && mf.target < 2000, JSON.stringify(mf));
      const rainFoot = await t.L(`import("/3d/js/features/atmos/sfx.js").then(m => m.rainInfo())`);
      t.check("rain on foot: open-air hiss, no drum", rainFoot && rainFoot.where === "foot" && rainFoot.drum < 0.02 && rainFoot.hiss > rainCar.hiss, JSON.stringify(rainFoot));
      await t.shot("onfoot-rain");
    }
    await g(`(ctx.atmos.debug.weather("clear", 1, true), L3.startRun({ mode: "cruise", s: 400 }), true)`);
    if (!await t.until(`__lulu3d.state === "playing"`, "back in the car")) return;
    await t.frames(6);
    t.check("back in the car: the music is clear again", (await A(`A.musicMuffleInfo().muffle`)) === 0);

    // ── damage: before / after ──
    await g(`(ctx.traffic.clear(), ctx.traffic.config.enabled = false, ctx.G.invT = 0, true)`);
    const side = `(ctx.states.playing.camera = () => { const c = ctx.car, h = c.h; ctx.camera.position.set(c.pos.x + Math.cos(h) * 4.6 - Math.sin(h) * 3.4, 2.1, c.pos.z - Math.sin(h) * 4.6 - Math.cos(h) * 3.4); ctx.camera.lookAt(c.pos.x, 0.7, c.pos.z); return true; }, true)`;
    await g(side);
    await t.frames(4);
    await t.shot("before");
    const k0 = await D();
    // a hit on her LEFT side (model +X = world (cos h, −sin h))
    await g(`(ctx.G.invT = 0, L3.emit("crash", { impact: 14, x: ctx.car.pos.x + Math.cos(ctx.car.h) * 1.4, z: ctx.car.pos.z - Math.sin(ctx.car.h) * 1.4 }), L3.damage(0.7, "test left"))`);
    await t.frames(4);
    let d = await D();
    t.check("a heart lost → stage applied (3 hearts: dents + a cracked windshield)", k0.k === 0 && d.k === 1 && d.stage === 2 && d.crack, JSON.stringify({ k0: k0.k, k: d.k, stage: d.stage, crack: d.crack }));
    t.check("impact side → dent placement (left: decals at x ≈ +0.9 in model space)", d.sides[0] === "left" && d.hits[0].x > 0.8 && d.dentTris > 0 && d.scratchTris > 0 && d.dentCenter[0] > 0.7,
      JSON.stringify({ hit: d.hits[0], dentTris: d.dentTris, scratchTris: d.scratchTris, centre: d.dentCenter, moved: d.movedVerts }));
    await g(`(ctx.G.invT = 0, true)`);                         // no i-frame blink in the photo
    await t.frames(40);
    await t.shot("after-1-left");
    // the last heart: a rear hit
    await g(`(ctx.G.invT = 0, ctx.car.vx = Math.sin(ctx.car.h) * 14, ctx.car.vz = Math.cos(ctx.car.h) * 14, L3.emit("crash", { impact: 14, x: ctx.car.pos.x - Math.sin(ctx.car.h) * 2.3, z: ctx.car.pos.z - Math.cos(ctx.car.h) * 2.3 }), L3.damage(0.7, "test rear"))`);
    await t.until(`(() => { const i = __lulu3d.ctx.feel.damage.info(); return i.hub && i.hub.inScene; })()`, "last heart: the hubcap pops off", 15000);
    const hub0 = await g(`[ctx.feel.damage.info().hub.x, ctx.feel.damage.info().hub.z]`);
    d = await D();
    t.check("last heart: rear dent, hubcap off (bare hub on the wheel), bumper droops", d.k === 2 && d.stage === 4 && d.sides[1] === "rear" && d.rimHidden > 0 && d.bumperDroop && d.movedVerts > 0,
      JSON.stringify({ k: d.k, stage: d.stage, sides: d.sides, rim: d.rimHidden, bare: d.bareHub }));
    await g(`(ctx.G.invT = 1e9, true)`);
    for (let i = 0; i < 10; i++) { await g(`(ctx.car.vx = Math.sin(ctx.car.h) * 14, ctx.car.vz = Math.cos(ctx.car.h) * 14, true)`); await t.frames(3); }
    d = await D();
    t.check("…the hubcap rolls away", Math.hypot(d.hub.x - hub0[0], d.hub.z - hub0[1]) > 1 && d.bareHub, JSON.stringify(d.hub));
    t.check("…the dragging bumper throws sparks and scrapes (positional)", d.stats.sparks > 5 && d.scrape, `sparks ${d.stats.sparks} scrape ${d.scrape}`);
    await t.shot("after-2-lastheart");
    await g(`(ctx.car.vx = ctx.car.vz = 0, true)`);
    await t.frames(30);
    await t.shot("after-2-smoke");

    // ── photo mode shows it ──
    await g(`(delete ctx.states.playing.camera, true)`);
    if (await g(`!!(ctx.play && ctx.play.openPhoto)`)) {
      await g(`(ctx.play.openPhoto("test"), true)`);
      await t.frames(10);
      t.check("photo mode keeps the damage on the car", (await g(`ctx.state`)) === "playPhoto" && (await D()).dentTris > 0);
      await t.shot("photo");
      await t.L(`import("/3d/js/features/play/photo.js").then(m => (m.closePhoto(), true))`);
      await t.frames(4);
      t.check("…and closes back to the drive", (await g(`ctx.state`)) === "playing");
    }
    await g(side);

    // ── a skin change keeps it ──
    await g(`(ctx.car.setSkin("blue"), true)`);
    await t.frames(4);
    d = await D();
    t.check("a skin change rebuilds the damage on the new model", d.onModel && d.k === 2 && d.dentTris > 0 && d.rimHidden > 0, JSON.stringify({ on: d.onModel, k: d.k, tris: d.dentTris }));
    await t.shot("after-blue");

    // ── a heart pickup undoes one stage ──
    await g(`(ctx.G.hearts = Math.min(ctx.G.maxHearts, ctx.G.hearts + 1), L3.emit("heart", { n: 1 }), true)`);
    await t.frames(4);
    d = await D();
    t.check("heart pickup → one stage undone (hubcap back on, bumper straight)", d.k === 1 && d.stage === 2 && d.rimHidden === 0 && !d.bareHub && !(d.hub && d.hub.active), JSON.stringify({ k: d.k, stage: d.stage, rim: d.rimHidden }));

    // ── Paint & Pray repairs ──
    await g(`L3.emit("streets:paint", { cost: 30, color: "Test", cleared: 0 })`);
    await t.frames(4);
    d = await D();
    t.check("Paint & Pray → repaired (original geometry back, no decals, no crack)", d.k === 0 && d.stage === 0 && !d.ownGeo && d.dentTris === 0 && !d.crack, JSON.stringify({ k: d.k, own: d.ownGeo, crack: d.crack }));
    await t.shot("repaired");

    // ── a new run is clean ──
    await g(`(ctx.G.hearts = 1, ctx.feel.debug.wear(2, "mix"))`);
    t.check("(wear again)", (await D()).k === 2);
    await g(`(delete ctx.states.playing.camera, L3.startRun({ mode: "cruise", s: 400 }), true)`);
    await t.until(`__lulu3d.state === "playing"`, "new run");
    d = await D();
    t.check("new run → clean", d.k === 0 && !d.ownGeo && !(d.hub && d.hub.active));

    // ── on foot / ER ──
    await g(`(L3.emit("er:admit", {}), ctx.feel.debug.wear(2, "front"), L3.emit("cameos:resume", {}), true)`);
    t.check("the ER visit repairs the car", (await D()).k === 0);

    // ── no leaks across 20 hits ──
    await g(`(ctx.traffic.clear(), ctx.G.invT = 1e9, ctx.G.hearts = 1, true)`);
    await t.frames(4);
    const mem0 = await g(`({ geo: L3.renderer.info.memory.geometries, tex: L3.renderer.info.memory.textures, kids: ctx.scene.children.length })`);
    const sides = ["left", "rear", "right", "front"];
    for (let i = 0; i < 20; i++) {
      await g(`(ctx.feel.damage.hit("${sides[i % 4]}"), ${i % 3 === 2 ? `ctx.feel.damage.undo(1),` : ""} ${i % 5 === 4 ? `ctx.feel.damage.repair("t"),` : ""} true)`);
      await t.frames(2);
    }
    await g(`ctx.feel.damage.repair("t")`);
    await t.frames(6);
    const mem1 = await g(`({ geo: L3.renderer.info.memory.geometries, tex: L3.renderer.info.memory.textures, kids: ctx.scene.children.length })`);
    const st = await g(`ctx.feel.damage.info().stats`);
    t.check("20 hits (with heals + repairs): no leaked geometries / textures / scene objects", mem1.geo <= mem0.geo + 1 && mem1.tex <= mem0.tex + 1 && mem1.kids <= mem0.kids,
      `${JSON.stringify(mem0)} → ${JSON.stringify(mem1)} · ${JSON.stringify(st)}`);
    t.check("spatial emitters stay bounded", (await A(`A.spatial.stats().emitters`)) <= 8);
    await g(`(ctx.traffic.config.enabled = true, true)`);
  },
};
