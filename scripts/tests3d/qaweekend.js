// 🐞 QA: A PLAY-TEST OF THE WEEKEND'S LANDINGS (ci/qaweekend, owner away for Shabbos 2026-11-21) — played like a
// 12-year-old would, the QA watchdog (scripts/lib/qawatch.js) on throughout:
//   TOWN    (a phone, 390 × 844 touch) home start on foot → ✋ into the car → the highway → Lakewood: rain + puddles,
//           honking at the crowd + the pigeons (the touch HONK button), ramming parked cars, out on foot (jumping in
//           puddles, running at pigeons) → Midwood (manholes) → back out on the highway: no sound left looping, no
//           life mesh left up, no coins out of honks / bumps / splashes
//   PHONE   📱 → 💬 Messages → the 🗞️ Kvetch pin on a phone, a desktop and a TV: on screen, no text running out of its row
//   AIRPORT (`?airport=1`) up to EXIT 12, the kerb, out on foot, in through the doors (the real ✋), check-in / security /
//           the suitcase, out again; wanted at the airport (the cops come, the airport doesn't break); a 🚕 taxi run
//   PARTY   two pages in one 🌍 Free Roam (the LOCAL relay) in Lakewood with the rain on: puddles + pigeons + an alarm
//           on both screens, no errors
// The parts run as three files on CI (a machine each): qaweekend (town + phone), qaweekend-air (airport) and
// qaweekend-party (party). Locally QAW_PART=town | phone | airport | party (a comma list) picks some.
const W = require("../lib/qawatch.js");
const { startRelay, guestPage, hostPage, setWallCap } = require("../lib/party3d.js");

const PORT = 28000 + (process.pid % 20000);
const Q0 = `&enable=all&mpurl=${encodeURIComponent(`ws://127.0.0.1:${PORT}`)}`;

module.exports = {
  name: "qaweekend",
  parts: ["town", "phone"],
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  query: Q0,
  save2d: { totalCoins: 300, cruiseUnlocked: true, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, offenses: 0, wanted: [], mpName: "Kugel Kid" },
  save3d: { settings: { quality: "low" }, f: { meta: { tutorialDone: true } } },
  async run(t) {
    const PART = process.env.QAW_PART ? process.env.QAW_PART.split(",") : this.parts;
    let relay = null;
    const guests = [];
    try {
      relay = await startRelay(PORT);
      const step = async (label, fn) => { try { await fn(); } catch (e) { t.check(`${label}: threw`, false, String(e && e.stack || e).slice(0, 400)); } };
      if (PART.includes("town")) await step("town", () => town(t));
      if (PART.includes("phone")) await step("phone", () => phone(t));
      if (PART.includes("airport")) await step("airport", () => airport(t));
      if (PART.includes("party")) await step("party", () => party(t, guests));
    } finally {
      for (const gp of guests) {
        t.check(`${gp.label}: no page errors`, gp.errors.length === 0, gp.errors.slice(0, 3).map(s => s.slice(0, 300)).join(" | "));
        try { await gp.page.close(); } catch (e) { /* closed */ }
      }
      if (relay) relay.kill();
      W.dropRelayErrors(t);
    }
  },
};

const D = "ctx.life.debug";
/** A test teleport: the watchdog looks away while the code moves her / the car (declared before it happens — a frame
 *  can tick between an eval and the next one). */
async function tp(t, code) { await W.pause(t, false); const r = await t.game(code); await t.frames(2); await W.pause(t, true); return r; }
const info = t => t.game(`ctx.life.info()`);
const coins = t => t.L(`window.__lulu3d.wallet.coins`);
// every life sound / mesh that's still going (should be none away from town)
const lifeLeft = t => t.L(`import("./js/spatial.js").then(m => { const C = __lulu3d.ctx;
  const snd = m.spatial.list().filter(e => /^life/.test(e.kind || "")).map(e => e.kind + (e.loop ? "(loop)" : ""));
  const mesh = C.scene.children.filter(o => /^life/.test(o.name || "") && o.visible).map(o => o.name);
  return { snd, mesh, loops: m.spatial.stats().loopsActive }; })`);
async function standAt(t, x, z, look) {
  await t.game(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f); ctx.cam.snap && ctx.cam.snap(); if (window.__qa) { window.__qa.cutF = ctx.frames + 3; window.__qa.last = null; } return true; })()`);
  if (look) await t.game(`(() => { const F = ctx.cam.free; F.yaw = Math.atan2(${look.x} - ${x}, ${look.z} - ${z}); F.pitch = ${look.pitch == null ? -0.12 : look.pitch}; F.idle = 0; if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
  await t.frames(3);
}
async function inTown(t, town) {
  const g = t.game;
  if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
  await W.pause(t, false);
  if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
  await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.load("${town}"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town}'s models load`, 120000);
  await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
  const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "${town}"`, `in ${town}`, 60000);
  await t.frames(10);
  await W.pause(t, true);
  await W.reset(t);
  return ok;
}
async function onFoot(t) {
  const g = t.game;
  if (await g(`ctx.foot.active && L3.state === "footRun"`)) return true;
  await g(`ctx.foot.start("droveOff", { noIntro: true })`);
  const ok = await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "on foot", 20000);
  await t.frames(6);
  return ok;
}
async function backInCar(t) {
  const g = t.game;
  if (await g(`ctx.foot.active`)) await g(`(ctx.foot.debug.getIn ? ctx.foot.debug.getIn() : ctx.foot.end("test"), true)`);
  return t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "back in the car", 20000);
}
/** A 12-year-old on the controls for `n` frames: the stick / gas wandering, the odd honk / jump / ✋. */
async function mash(t, n, { foot = false, honk = true } = {}) {
  for (let k = 0; k < n; k += 6) {
    const r = Math.random();
    if (foot) await t.stick(Math.sin(k * 0.07) * 0.9, -0.6 - 0.4 * Math.random());
    else { await t.stick(Math.sin(k * 0.05) * 0.6, 0); await t.hold(7, r < 0.85 ? 0.8 : 0); }
    if (honk && r < 0.08) await t.tap(4);
    if (foot && r > 0.93) await t.tap(1);
    await t.frames(6);
  }
  await t.stick(0, 0); await t.hold(7, 0);
}
/** Elements whose text runs out of their box (scrollWidth past clientWidth, not an ellipsis), inside `sel`. */
const overflow = (t, sel) => t.L(`(() => { const out = []; for (const e of document.querySelectorAll(${JSON.stringify(sel)} + " *")) {
    const cs = getComputedStyle(e); if (cs.display === "none" || cs.visibility === "hidden" || !e.offsetParent) continue;
    if (cs.textOverflow === "ellipsis" || cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
    if (e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && /hidden|clip/.test(cs.overflowX + cs.overflow)) out.push((e.className || e.tagName) + ": " + e.textContent.trim().slice(0, 40));
    const r = e.getBoundingClientRect(); if (r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) && e.textContent.trim()) out.push("off-screen " + (e.className || e.tagName) + ": " + e.textContent.trim().slice(0, 30));
  } return out.slice(0, 8); })()`);

// ═══ TOWN: home → highway → Lakewood → Midwood → highway (on a phone) ═════════════════════════════
async function town(t) {
  const g = t.game;
  await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
  await t.click(/PLAY/);
  if (!await t.until(`__lulu3d.state === "footRun"`, "PLAY: starts on foot at home", 20000)) return;
  await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
  await W.install(t);
  await g(`(ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), true)`);
  await t.frames(30);
  await t.shot("home");
  // over to the car (the stick), ✋ GET IN
  await tp(t, `(() => { const F = ctx.foot.debug.F, c = F.car.stub; F.pos.set(c.x + Math.cos(c.h) * 2.0, 0.05, c.z - Math.sin(c.h) * 2.0); return true; })()`);
  await t.frames(6);
  await t.tap(0);
  if (!await t.until(`__lulu3d.state === "playing" && !__lulu3d.ctx.foot.active`, "✋ GET IN: driving", 30000)) return;
  const c0 = await coins(t);
  // backed up against her own house, the chase cam behind the car stays out of the house (it showed one flat colour)
  const hc = await g(`(() => { const hp = ctx.world.road.point(30, 21, {}); let best = null; for (const ch of ctx.world.activeChunks()) for (const c of ch.colliders) if (c.kind === "house" && !c.off && c.r >= 2 && Math.hypot(c.x - hp.x, c.z - hp.z) < 14 && (!best || c.r > best.r)) best = { x: c.x, z: c.z, r: c.r }; return best; })()`);
  if (hc) {
    const camIn = [], before = [];
    await W.pause(t, false);       // (a staged scene: the watchdog would flag the before-the-fix camera)
    for (const off of [true, false]) for (const a of [0, 0.5, -0.5]) {
      await g(`(window.__ccf = window.__ccf || ctx.cam.carClip, ctx.cam.carClip = ${off} ? null : window.__ccf, true)`);      // (off: the camera as it was before the fix)
      await g(`(() => { const hp = ctx.world.road.point(30, 0, {}), ux = hp.x - ${hc.x}, uz = hp.z - ${hc.z}, L = Math.hypot(ux, uz), h = Math.atan2(ux, uz) + ${a};
        ctx.car.place(${hc.x} + ux / L * (${hc.r} + 3.0), ${hc.z} + uz / L * (${hc.r} + 3.0), h); ctx.car.vx = ctx.car.vz = ctx.car.vF = 0; ctx.cam.snap(); return true; })()`);
      await t.frames(20);
      const r = await t.L(`(() => { const c = __lulu3d.ctx.camera.position; return window.__qa.solidAt(c.x, c.z, c.y, 0.05); })()`);
      if (r) (off ? before : camIn).push(a + ": " + r);
    }
    await W.pause(t, true);
    console.log("   (without the home-street camera clip it sat inside the house", before.length, "of 3 times:", before.join(" | ") + ")");
    t.check("backed up to her own house: the chase cam never sits inside it", camIn.length === 0, camIn.join(" | "));
    await t.shot("home-backed-up");
  }
  await tp(t, `(() => { const p = ctx.world.road.point(40, 1.75, {}); ctx.car.place(p.x, p.z, p.h); ctx.car.s = 40; ctx.car.d = 1.75; ctx.cam.snap(); return true; })()`);
  await mash(t, 240);
  t.check("out on the highway (she drove off)", await g(`ctx.state === "playing" && ctx.car.s > 30`), String(await g(`ctx.car.s`)));
  W.check(t, "home → highway", await W.report(t));
  await W.reset(t);
  await t.shot("highway");

  // ── Lakewood, a rainy day: drive the puddles, honk, ram parked cars ──
  await g(`(ctx.law.hold(9999), ctx.hustle && ctx.hustle.hold && ctx.hustle.hold(1e6), ctx.atmos.debug.weather("rain"), ${D}.rain(1), ${D}.season("autumn"), ${D}.cold(true), true)`);
  if (!await inTown(t, "lakewood")) return;
  await t.frames(60);
  let I = await info(t);
  t.check("Lakewood in the rain: life is on, puddles drawn", I.on && I.town && I.puddles.sites > 0 && I.puddles.visible, JSON.stringify(I.puddles));
  // 📝 Ima's list chip: in town the errand's distance is measured from the exit (ctx.car.s is the town's own road there)
  const chip = await t.L(`(document.querySelector(".day-chip") || {}).textContent || ""`);
  const mi = /([\d.]+) mi/.exec(chip);
  t.check("in town, 📝 Ima's list says how far the errand is from here (not hundreds of miles)", !mi || +mi[1] < 30, chip);
  const hz0 = await g(`ctx.homes && ctx.homes.debug.CR ? ctx.homes.debug.CR.peds.length : 0`);
  // honk with the real touch HONK button a few times while rolling down a street
  await tp(t, `(ctx.town.debug.place("Route 9", 40, -1.75, 6, 1), ctx.cam.snap(), true)`);
  let honks = 0;
  await t.L(`import("./js/core/ctx.js").then(m => { window.__hkN = 0; m.on("honk", () => { window.__hkN++; }); return true; })`);
  for (let i = 0; i < 6; i++) {
    await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`); await t.frames(3);      // (her thumb is on the screen: the touch controls show)
    const ok = await t.L(`(() => { const b = document.getElementById("tHonk"); if (!b || !b.offsetParent) return false; const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const T = (type, list) => b.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: list, targetTouches: list, changedTouches: [new Touch({ identifier: 9, target: b, clientX: x, clientY: y })] }));
      T("touchstart", [new Touch({ identifier: 9, target: b, clientX: x, clientY: y })]); window.__th = () => T("touchend", []); return true; })()`);
    await t.frames(4);
    await t.L(`(window.__th && window.__th(), true)`);
    if (ok) honks++;
    await t.frames(20);
  }
  const hkN = await t.L(`window.__hkN`);
  t.check("the touch HONK button is there while driving (a phone) and honks", honks > 0 && hkN > 0, `${honks} taps, ${hkN} honks, crowd ${hz0}`);
  await t.shot("lakewood-rain-honk");
  // drive through a puddle
  const pd = await g(`${D}.puddle("lane") || ${D}.puddle("gutter")`);
  if (pd) {
    await tp(t, `(() => { const r = ctx.world.road, n = r.nearest(${pd.x}, ${pd.z}, ctx.car.s, {}), a = r.point(n.s - 25, n.d, {}); ctx.car.place(a.x, a.z, a.h); ctx.car.s = n.s - 25; ctx.car.d = n.d; ctx.car.vx = Math.sin(a.h) * 12; ctx.car.vz = Math.cos(a.h) * 12; ctx.car.vF = 12; ctx.cam.snap(); return true; })()`);
    await t.hold(7, 0.7); await t.frames(60); await t.hold(7, 0);
  }
  I = await info(t);
  console.log("   life after the puddle drive", JSON.stringify({ carSplashes: I.carSplashes, soaked: I.soaked, puddles: I.puddles }));
  // ram parked cars, again and again (a kid would): the shoved car stays out of the houses and the lanes clear of nonsense
  const DD = "ctx.town.debug";
  const ram = await g(`(() => { const T = ${DD}.S.T, O = ${DD}.PL.ORIGIN, car = ctx.car; let best = null, bd = 1e9;
      for (const p of T.pcars) { if (p.gone || p.live) continue; const d = Math.hypot(O.x + p.x - car.pos.x, O.z + p.z - car.pos.z); if (d > 8 && d < bd) { bd = d; best = p; } }
      window.__pc = best; return best ? { x0: best.x, z0: best.z } : null; })()`);
  t.check("a parked car to ram", !!ram);
  let bumpLog = [];
  if (ram) {
    for (let i = 0; i < 8; i++) {
      await tp(t, `(() => { const p = window.__pc, O = ${DD}.PL.ORIGIN, r = ctx.world.road, P = { x: O.x + p.x, z: O.z + p.z }, n = r.nearest(P.x, P.z, ctx.car.s, {});
          const q = r.point(n.s, 0, {}), dx = P.x - q.x, dz = P.z - q.z, L = Math.hypot(dx, dz) || 1, h = Math.atan2(dx, dz), back = Math.max(0, L - 6);
          ctx.car.place(q.x + dx / L * back * 0.3, q.z + dz / L * back * 0.3, h); ctx.car.vx = Math.sin(h) * 9; ctx.car.vz = Math.cos(h) * 9; ctx.car.vF = 9; ctx.car.s = n.s; ctx.cam.snap && ctx.cam.snap(); return true; })()`);
      await t.hold(7, 1); await t.frames(30); await t.hold(7, 0); await t.hold(6, 1); await t.frames(15); await t.hold(6, 0);
      bumpLog.push(await g(`(() => { const p = window.__pc, O = ${DD}.PL.ORIGIN; return { x: +(p.x).toFixed(1), z: +(p.z).toFixed(1), live: !!p.live }; })()`));
    }
    const pc = await g(`(() => { const p = window.__pc, O = ${DD}.PL.ORIGIN, PL = ${DD}.PL; const inBlock = PL.OCCLUDERS.some(r => p.x > r.x0 - 0.5 && p.x < r.x1 + 0.5 && p.z > r.z0 - 0.5 && p.z < r.z1 + 0.5);
        return { moved: +Math.hypot(p.x - ${ram.x0}, p.z - ${ram.z0}).toFixed(1), inBlock, alarms: ctx.life.info().alarm.alarms }; })()`);
    console.log("   rammed", JSON.stringify(pc), JSON.stringify(bumpLog));
    t.check("a parked car rammed 8 times never ends up inside a block of houses", !pc.inBlock, JSON.stringify(pc));
    t.check("…its alarm went off (life's hazards)", pc.alarms > 0, JSON.stringify(pc));
    await t.shot("rammed");
  }
  await t.frames(200);
  t.check("…and the alarm is over a few seconds later (no sound left looping)", (await info(t)).alarm.live === 0 && !(await info(t)).alarm.tail, JSON.stringify((await info(t)).alarm));
  W.check(t, "Lakewood driving in the rain", await W.report(t), ["jump", "nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol"]);
  await W.reset(t);

  // ── on foot in Lakewood: jump in puddles, run at the pigeons, mash ──
  if (await onFoot(t)) {
    await W.reset(t);
    const fp = await g(`${D}.puddle("walk") || ${D}.puddle("")`);
    if (fp) {
      await standAt(t, fp.x - 2, fp.z);
      const s0 = (await info(t)).splashes;
      for (let i = 0; i < 3; i++) { await standAt(t, fp.x, fp.z); await t.tap(1); await t.frames(30); }
      t.check("jumping in a puddle: a splash", (await info(t)).splashes > s0, JSON.stringify({ s0, s1: (await info(t)).splashes }));
    }
    const fl = await g(`${D}.flock("ground")`);
    if (fl) {
      const ul = Math.hypot(fl.ux, fl.uz) || 1;
      await standAt(t, fl.x + fl.ux / ul * 6, fl.z + fl.uz / ul * 6, { x: fl.x, z: fl.z, pitch: 0.2 });
      await t.frames(10);
      await t.shot("pigeons-rain");
      // every flying pigeon, every frame: never inside a block of houses below its roofs (≤ 9.4 m)
      await t.L(`(() => { const C = __lulu3d.ctx, PG = C.life.debug.PG, PL = C.town.plan; window.__pgHit = { n: 0, frames: 0, ex: [] }; window.__pgOn = true;
        const tick = () => { if (!window.__pgOn) return; requestAnimationFrame(tick); window.__pgHit.frames++;
          for (const f of PG.live) if (f.kind === "ground") for (const b of f.birds) { if (!b.mode || b.y > 9.4) continue; const q = PL.local(b.x, b.z, {});
            if (PL.OCCLUDERS.some(r => q.x > r.x0 + 0.3 && q.x < r.x1 - 0.3 && q.z > r.z0 + 0.3 && q.z < r.z1 - 0.3)) { window.__pgHit.n++; if (window.__pgHit.ex.length < 4) window.__pgHit.ex.push([f.kind, b.mode, +b.y.toFixed(1)]); } } };
        tick(); return true; })()`);
      await t.L(`import("./js/core/ctx.js").then(m => m.emit("honk", {}))`);
      await g(`(() => { for (const f of ctx.life.debug.PG.live) if (f.kind === "ground") f.cool = 0; return ${D}.scatter("ground"); })()`);
      await t.frames(60);
      await t.shot("pigeons-up");
      await standAt(t, fl.x + fl.ux / ul * 28, fl.z + fl.uz / ul * 28, { x: fl.x, z: fl.z, pitch: -0.1 });     // (she walks on: they come back)
      await t.frames(330);
      const hit = await t.L(`(window.__pgOn = false, window.__pgHit)`);
      t.check("scattered pavement pigeons circle + come back without flying through the houses", hit.n === 0 && hit.frames > 100, JSON.stringify(hit));
    }
    await mash(t, 300, { foot: true });
    await t.shot("lakewood-foot");
    W.check(t, "Lakewood on foot in the rain", await W.report(t));
    await W.reset(t);
  }
  const c1 = await coins(t);
  t.check("no coins out of honking, splashing, ramming parked cars (the economy rule)", c1 <= c0, `${c0} → ${c1}`);

  // ── Midwood, the rain stopped: manholes, steam, mash on foot + in the car ──
  await g(`(ctx.atmos.debug.weather("clear"), ${D}.rain(0.6), true)`);
  if (await inTown(t, "midwood")) {
    if (await onFoot(t)) {
      await W.reset(t);
      const m = await g(`${D}.puff("manhole")`);
      if (m) { await standAt(t, m.x + 0.3, m.z + 0.2); await t.frames(20); }
      await mash(t, 240, { foot: true });
      await t.shot("midwood-foot");
      W.check(t, "Midwood on foot", await W.report(t));
      await W.reset(t);
    }
    await backInCar(t);
    await mash(t, 200);
    W.check(t, "Midwood driving", await W.report(t), ["jump", "nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol"]);
    await W.reset(t);
  }
  // ── back out on the highway: nothing of life left going ──
  await W.pause(t, false);
  await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.active && ctx.town.leave("reset"), L3.setState("playing"), true)`);
  await t.frames(90);
  const left = await lifeLeft(t);
  t.check("back on the highway: no life sound still playing / looping, no life mesh up", left.snd.length === 0 && left.mesh.length === 0, JSON.stringify(left));
  await W.pause(t, true);
  await t.shot("highway-after");
}

// ═══ PHONE: 📱 → 💬 Messages → 🗞️ Kvetch, on a phone, a desktop, a TV ═══════════════════════════════
async function phone(t) {
  const g = t.game;
  const setSave = code => t.L(`import("./js/core/save.js").then(m => { ${code} })`);
  if (await g(`ctx.state === "title"`)) {
    await t.click(/PLAY/);
    await t.until(`__lulu3d.state === "footRun" || __lulu3d.state === "playing"`, "PLAY", 20000);
  }
  if (!await g(`ctx.town.active`)) await inTown(t, "lakewood");
  const LAYOUTS = [["phone", 390, 844, false, true], ["phone-land", 844, 390, false, true], ["desktop", 1280, 720, false, false], ["tv", 1920, 1080, true, false]];
  for (const [name, w, h, tv, touch] of LAYOUTS) {
    await t.page.setViewportSize({ width: w, height: h });
    await setSave(`m.save3d.settings.tv = ${tv ? '"on"' : '"off"'};`);
    await g(`(ctx.applySettings(), true)`);
    if (touch) await t.L(`(window.dispatchEvent(new Event("touchstart")), 0)`);
    else await t.L(`(window.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" })), 0)`);
    await t.frames(6);
    await g(`ctx.phone.openPhone("messages")`);
    await t.frames(12);
    const pins = await g(`ctx.phone._dbg.APPS ? [...document.querySelectorAll("#screenCard .lp-row")].map(b => b.textContent.trim().slice(0, 30)) : []`);
    const kv = await t.L(`(() => { const b = [...document.querySelectorAll("#screenCard .lp-row")].find(b => /Kvetch/.test(b.textContent)); if (!b) return null; const r = b.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, W: innerWidth, H: innerHeight }; })()`);
    t.check(`${name}: 💬 Messages shows the 🗞️ Kvetch pin, on screen`, !!kv && kv.l >= -1 && kv.r <= kv.W + 1 && kv.t >= -1 && kv.b <= kv.H + 1, JSON.stringify({ kv, pins }));
    const ov1 = await overflow(t, "#screenCard");
    await t.shot(`phone-messages-${name}`);
    await t.L(`(() => { const b = [...document.querySelectorAll("#screenCard .lp-row")].find(b => /Kvetch/.test(b.textContent)); if (b) b.click(); return !!b; })()`);
    await t.frames(8);
    const kvOpen = await t.L(`!!document.querySelector("#screenCard .town-kvetch")`);
    t.check(`${name}: tapping it opens the local news`, kvOpen);
    const ov2 = await overflow(t, "#screenCard");
    t.check(`${name}: no text runs out of its box (Messages + the Kvetch)`, ov1.length === 0 && ov2.length === 0, JSON.stringify(ov1.concat(ov2)));
    await t.shot(`phone-kvetch-${name}`);
    await g(`ctx.phone.closePhone()`);
    await t.frames(4);
    t.check(`${name}: the phone closes (game unpaused)`, await g(`!ctx.phone.isOpen && !ctx.paused`));
  }
  await t.page.setViewportSize({ width: 390, height: 844 });
  await setSave(`m.save3d.settings.tv = "off";`);
  await g(`(ctx.applySettings(), true)`);
}

// ═══ AIRPORT (?airport=1): EXIT 12, the kerb, the terminal, wanted, a taxi run ═════════════════════
async function airport(t) {
  const g = t.game;
  await t.page.setViewportSize({ width: 1280, height: 720 });
  if (!await g(`!!(ctx.airport && ctx.airport.on)`)) await t.page.goto(t.page.url().replace(/[?].*$/, "") + `?test&airport=1${Q0}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`);
  if (!await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "airport: boots", 120000)) return;
  t.check("?airport=1 switches stage 1 on", await g(`!!(ctx.airport && ctx.airport.on)`));
  await g(`L3.startRun({ mode: "cruise", quick: true })`);
  if (!await t.until(`__lulu3d.state === "playing"`, "airport: a drive starts", 30000)) return;
  await W.install(t);
  if (!await t.until(`!!__lulu3d.ctx.airport.planned`, "the airport is planned", 60000)) return;
  const E = await g(`ctx.airport.planned.s`);
  await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.atmos.debug.weather("rain"), ctx.atmos.debug.time("noon"), ctx.atmos.debug.freeze(true), ctx.law.hold(900), true)`);
  // straight onto the kerb (airport.js drives the ramp; here: what a player does once there)
  const K = await g(`(() => { const L = ctx.airport.debug.LY; return { lane: L.KERB_LANE, door: L.DOORS[1], r0: L.TERM.r0 }; })()`);
  const hw = await g(`(() => { const p = ctx.world.highway.point(${E} - 300, 5.25, {}); return { x: p.x, z: p.z, h: ctx.world.highway.at(${E} - 300).h }; })()`);
  await tp(t, `(() => { const n = ctx.world.highway.nearest(${hw.x}, ${hw.z}, ctx.car.s, {}); ctx.car.place(${hw.x}, ${hw.z}, ${hw.h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.world.prebuild(n.s); ctx.cam.snap(); return true; })()`);
  if (!await t.until(`__lulu3d.ctx.airport.ready`, "the airport builds", 180000)) return;
  const kp = await g(`(() => { const p = ctx.airport.debug.world(-62, ${K.lane}), F = ctx.airport.debug.G().F; return { x: p.x, z: p.z, h: F.yaw(1, 0) }; })()`);
  await tp(t, `(() => { const n = ctx.world.highway.nearest(${kp.x}, ${kp.z}, ${E} + 300, {}); ctx.car.place(${kp.x}, ${kp.z}, ${kp.h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.world.prebuild(n.s); ctx.cam.snap(); return true; })()`);
  await t.frames(30);
  t.check("at the DEPARTURES kerb, inside the landside", await g(`ctx.airport.inside`));
  await t.shot("airport-kerb-rain");
  // a kid at the kerb: honk at the taxis, rev into the kerb
  await mash(t, 120);
  W.check(t, "the airport kerb (driving)", await W.report(t), ["jump", "nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol"]);
  await W.reset(t);
  await tp(t, `(() => { const n = ctx.world.highway.nearest(${kp.x}, ${kp.z}, ${E} + 300, {}); ctx.car.place(${kp.x}, ${kp.z}, ${kp.h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
  // out on foot, walk to the doors (the stick), ✋ in
  await g(`ctx.foot.start("droveOff")`);
  if (!await t.until(`__lulu3d.ctx.foot.phase === "walk"`, "out on foot at the kerb", 30000)) return;
  // out of the car at the kerb (the airport's own frame, across the highway's line): beside it, never standing in its seats
  const besideCar = () => g(`(() => { const F = ctx.foot.debug.F, c = F.car && F.car.stub; if (!c) return null; const dx = F.pos.x - c.x, dz = F.pos.z - c.z;
    const along = dx * Math.sin(c.h) + dz * Math.cos(c.h), lat = dx * Math.cos(c.h) - dz * Math.sin(c.h); return { along: +along.toFixed(2), lat: +lat.toFixed(2), inside: Math.abs(lat) < 1.05 && Math.abs(along) < 2.3 }; })()`);
  const bc = await besideCar();
  t.check("out of the car at the kerb: she stands beside it, not in it", !!bc && !bc.inside, JSON.stringify(bc));
  await t.shot("airport-out-of-car");
  const door = await g(`ctx.airport.debug.world(${K.door}, ${K.r0} - 1.2)`);
  for (let k = 0; k < 500; k += 6) {
    const done = await g(`(() => { const F = ctx.foot.debug.F, dx = ${door.x} - F.pos.x, dz = ${door.z} - F.pos.z, L = Math.hypot(dx, dz); if (L < 1.2) { __pad.axes[0] = 0; __pad.axes[1] = 0; return true; }
      const fy = ctx.foot.frameYaw, fx = Math.sin(fy), fz = Math.cos(fy), rx = -fz, rz = fx; __pad.axes[0] = (dx * rx + dz * rz) / L; __pad.axes[1] = -(dx * fx + dz * fz) / L; return false; })()`);
    if (done) break;
    await t.frames(6);
  }
  await t.stick(0, 0);
  const pr = await t.L(`(document.querySelector("#slot-bottom .prompt") || document.querySelector(".prompt") || {}).textContent || ""`);
  t.check("walked to the terminal doors: ✋ prompt", /TERMINAL/.test(pr), pr);
  await t.shot("airport-doors");
  W.check(t, "walking the kerb in the rain", await W.report(t));
  await W.reset(t);
  await t.tap(0);
  const inside = await t.until(`__lulu3d.state === "interior" && !!(__lulu3d.ctx.airport.terminal && __lulu3d.ctx.airport.terminal.inside) && window.__interiors && window.__interiors.room && window.__interiors.room.ready`, "✋ in through the doors: the hall", 120000);
  if (inside) {
    await t.frames(30);
    await t.shot("terminal-hall");
    // mash around the hall + use every hotspot we reach (check-in, security, the board, the deli…)
    const hots = await g(`window.__interiors.room.hots.map(h => h.id)`);
    console.log("   hall hotspots", hots.join(","));
    const c0 = await coins(t);
    const seen = [];
    for (const id of hots.filter(h => /check|secur|board|deli|water|gate|s3_perl|kiosk|scale/i.test(h)).slice(0, 8)) {
      await g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === ${JSON.stringify(id)}); if (!h) return false; const o = r.lulu.obj; o.position.x = h.x; o.position.z = h.z + Math.min(h.r * 0.5, 0.6); r.collide(o.position, 0.32); r.vel.set(0, 0, 0); return true; })()`);
      await t.frames(4);
      await t.tap(0);
      for (let i = 0; i < 40; i++) {
        if (await g(`!ctx.dialogOpen && !window.__interiors.room.busy && !window.__interiors.room.auto`)) break;
        const opts = await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden").map(b => b.textContent)`);
        if (opts.length) await t.L(`[...document.querySelectorAll("#dialog .opt")].filter(b => b.style.visibility !== "hidden")[0].click()`);
        else await t.tap(0);
        await t.frames(3);
      }
      seen.push(id + (await g(`ctx.dialogOpen || window.__interiors.room.busy`) ? "(stuck)" : ""));
    }
    t.check("every hall hotspot tried lets go of her (no dialog / busy left on)", !seen.some(s => /stuck/.test(s)), seen.join(","));
    // the same hotspots again (the economy: nothing pays twice)
    const c1 = await coins(t);
    for (const id of hots.filter(h => /deli|water|check|scale/i.test(h)).slice(0, 4)) {
      await g(`(() => { const r = window.__interiors.room, h = r.hots.find(h => h.id === ${JSON.stringify(id)}); if (!h) return false; const o = r.lulu.obj; o.position.x = h.x; o.position.z = h.z + Math.min(h.r * 0.5, 0.6); r.collide(o.position, 0.32); r.vel.set(0, 0, 0); return true; })()`);
      await t.frames(4); await t.tap(0);
      for (let i = 0; i < 40; i++) { if (await g(`!ctx.dialogOpen && !window.__interiors.room.busy`)) break; await t.tap(0); await t.frames(3); }
    }
    const c2 = await coins(t);
    console.log(`   hall coins ${c0} → ${c1} → ${c2}`);
    t.check("the hall's things don't pay again on a second go (no farm)", c2 <= c1, `${c0} → ${c1} → ${c2}`);
    await t.shot("terminal-after");
    await g(`(window.__interiors.room.leave(), true)`);
    await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "back out of the terminal", 60000);
    await t.frames(20);
    await W.reset(t);
  }
  // ── knocked out at the kerb: back on her feet BESIDE her patched-up car ──
  await backInCar(t);
  await tp(t, `(() => { const n = ctx.world.highway.nearest(${kp.x}, ${kp.z}, ${E} + 300, {}); ctx.car.place(${kp.x}, ${kp.z}, ${kp.h}); ctx.car.s = n.s; ctx.car.d = n.d; ctx.car.vx = ctx.car.vz = 0; ctx.cam.snap(); return true; })()`);
  await g(`(ctx.foot.start("knockout"), true)`);
  if (await t.until(`__lulu3d.state === "footRun" && __lulu3d.ctx.foot.phase === "walk"`, "knocked out at the kerb: on her feet", 30000)) {
    const kb = await besideCar();
    t.check("knocked out at the kerb: on her feet beside the car, not standing in it", !!kb && !kb.inside, JSON.stringify(kb));
    await t.shot("airport-knockout");
  }
  // ── wanted at the airport: the cops come, she runs to the car, drives round the loop ──
  await g(`(ctx.law.hold(0), true)`);
  await backInCar(t);
  await g(`(ctx.law.startChase("speeding"), true)`);
  await t.frames(20);
  t.check("wanted at the airport: a chase starts", await g(`ctx.law.chasing`));
  await mash(t, 360);
  await t.shot("airport-wanted");
  const st = await g(`({ state: ctx.state, chasing: ctx.law.chasing, inside: ctx.airport.inside })`);
  console.log("   wanted at the airport", JSON.stringify(st));
  W.check(t, "wanted at the airport", await W.report(t), ["jump", "nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol"]);
  await W.reset(t);
  await g(`(ctx.law.standDown && ctx.law.standDown(), ctx.law.hold(900), L3.state !== "playing" && !/jail|court|law|arrest/i.test(L3.state) ? L3.setState("playing") : 0, true)`);
  await t.until(`__lulu3d.state === "playing"`, "back to driving after the chase", 60000);
  // ── a taxi run (the 💼 job, offered at the airport only) ──
  const S3 = "ctx.airport.stage3";
  const why = await g(`${S3} && ${S3}.taxi ? ${S3}.taxi.why() : "no stage3"`);
  const listed = await g(`ctx.hustle && ctx.hustle.listed ? ctx.hustle.listed() : []`);
  t.check("at the airport the 🚕 JFK taxi run is offered (💼 Jobs)", why === "" && listed.includes("jfk_taxi"), `why=${why} listed=${listed.join(",")}`);
  W.check(t, "the airport, all told", await W.report(t));
}

// ═══ PARTY: two friends in 🌍 Free Roam in Lakewood, the rain on ═══════════════════════════════════
async function party(t, guests) {
  const g = t.game, Hp = hostPage(t);
  setWallCap(10 * 60000);
  await t.page.setViewportSize({ width: 960, height: 540 });
  if (!await g(`ctx.state === "title"`)) await t.page.goto(t.page.url().replace(/[?].*$/, "") + `?test${Q0}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`);
  if (!await t.until(`window.__lulu3d && __lulu3d.state === "title"`, "party: boots", 120000)) return;
  await t.click(/Friends/);
  await t.L(`document.getElementById("pt_roam").click()`);
  if (!await Hp.until(`ctx.state === "playing" && ctx.party.activity && ctx.party.activity.k === "roam"`, "host: Free Roam", 120000)) return;
  const code = await g(`ctx.party.code`), hostUid = await g(`ctx.party.uid`);
  const A = await guestPage(t, "guest", { totalCoins: 50, ownedSkins: ["pink", "blue"], selectedSkin: "blue", mpName: "Latke Legend" }, `${Q0}&party=${code}&with=${hostUid}&shabbosDate=2026-11-16T15:00&seasonDate=2026-11-16T12:00`, { width: 640, height: 360 });
  guests.push(A);
  if (!await A.until(`ctx.party.connected && ctx.party.activity && ctx.party.activity.k === "roam" && ctx.state === "playing"`, "guest joins Free Roam", 240000)) return;
  const AW = { L: A.L };
  await A.frames(90);
  const gc0 = await A.L(`window.__lulu3d.wallet.coins`);     // (after joining: the day's streak gift is not the town's)
  for (const P of [Hp, A]) await P.game(`(ctx.law.hold(99999), ctx.traffic.config.enabled = false, ctx.traffic.clear(), ctx.life.debug.rain(1), ctx.life.debug.cold(true), true)`);
  await W.install(t); await W.install(AW);
  for (const P of [Hp, A]) await P.game(`(ctx.town.load("lakewood"), true)`);
  for (const P of [Hp, A]) await P.until(`ctx.town.loaded("lakewood")`, `${P.label}: Lakewood's models`, 120000);
  for (const P of [Hp, A]) await P.game(`(ctx.town.enter({ town: "lakewood", speed: 0 }), true)`);
  for (const P of [Hp, A]) await P.until(`ctx.town.active && ctx.town.id === "lakewood"`, `${P.label}: in Lakewood`, 60000);
  await W.reset(t); await W.reset(AW);
  const site = async P => P.game(`(() => { const S = ctx.life.info().puddles; return { sites: S.sites, visible: S.visible, flocks: ctx.life.info().pigeons.flocks }; })()`);
  await t.frames(60);
  const h1 = await site(Hp), g1 = await site(A);
  t.check("party: both screens have the same puddles + pigeons in Lakewood (hashed from the plan)", h1.sites > 0 && h1.sites === g1.sites && h1.flocks === g1.flocks, JSON.stringify({ h1, g1 }));
  // the host honks + rams a parked car, the guest walks about
  await A.game(`ctx.foot.start("droveOff", { noIntro: true })`);
  await mash(t, 200);
  await A.page.keyboard.down("KeyW");
  for (let i = 0; i < 20; i++) { const k = i % 4 < 2 ? "KeyA" : "KeyD"; await A.page.keyboard.down(k); await A.frames(6); await A.page.keyboard.up(k); }
  await A.page.keyboard.up("KeyW");
  await t.shot("party-lakewood-host");
  await A.page.screenshot({ path: require("path").join(__dirname, "..", "..", "smoke-shots", "3d-qaweekend-party-lakewood-guest.png") }).catch(() => { });
  const rh = await W.report(t), rg = await W.report(AW);
  W.log(rh); W.log(rg);
  W.check(t, "party host in Lakewood", rh, ["jump", "nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol"]);
  W.check(t, "party guest in Lakewood", rg, ["jump", "nan", "overlay", "flat", "underground", "hidden", "stuck", "nocontrol"]);
  const gc1 = await A.L(`window.__lulu3d.wallet.coins`);
  t.check("party: no coins for the guest out of the town's life (puddles, pigeons, walking about)", gc1 <= gc0, `${gc0} → ${gc1}`);
}
