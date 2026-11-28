// 🎥 ci/sweep-camera (Shabbos fix sweep 2026-11-28): the camera never shows the player junk — a screen of leaves, the
// inside of a wall / a house / a block, a rail right in front of the lens, a jump. Notes: 3d/docs/sweeps/sweep-camera.md.
// On a phone held upright (390 × 844: the tall narrow view is where it's worst). The probe (scripts/lib/camjunk.js) casts
// rays from the camera into the real scene: `near` = the share of the screen within 1.6 m of the lens.
const W = require("../lib/qawatch.js");
const CJ = require("../lib/camjunk.js");

async function inTown(t, town) {
  const g = t.game;
  if (await g(`ctx.town.active && ctx.town.id === "${town}"`)) return true;
  if (await g(`ctx.town.active`)) { await g(`(ctx.foot.active && ctx.foot.end("test"), ctx.town.leave("reset"), L3.setState("playing"), true)`); await t.frames(3); }
  await g(`(ctx.foot.active && ctx.foot.end("test"), L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.load("${town}"), true)`);
  await t.until(`__lulu3d.ctx.town.loaded("${town}")`, `${town}'s models load`, 120000);
  await g(`(L3.state !== "playing" ? L3.setState("playing") : 0, ctx.town.enter({ town: "${town}", speed: 0 }), true)`);
  const ok = await t.until(`__lulu3d.ctx.town.active && __lulu3d.ctx.town.id === "${town}"`, `in ${town}`, 60000);
  await t.frames(10);
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
/** Put her at (x, z) with the free camera looking along yaw (the camera sits behind her: opposite the yaw). */
async function standAt(t, x, z, yaw, pitch = null) {
  await t.game(`(() => { const f = ctx.foot.pos; f.set(${x}, 0.05, ${z}); ctx.foot.vel.set(0, 0, 0); ctx.foot.obj.position.copy(f);
    const F = ctx.cam.free; F.yaw = ${yaw}; ${pitch == null ? "" : `F.pitch = ${pitch};`} F.idle = 0; ctx.cam.snap && ctx.cam.snap();
    if (window.__qa) { window.__qa.cutF = ctx.frames + 12; window.__qa.last = null; } return true; })()`);
  await t.frames(3);
}

module.exports = {
  name: "sweepcamera",
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  fast: false,
  query: "&enable=all",
  save2d: { totalCoins: 500, ownedSkins: ["pink"], selectedSkin: "pink", convictions: 0, wanted: [] },
  async run(t) {
    const g = t.game;
    await g(`L3.startRun({ mode: "cruise", quick: true })`);
    if (!await t.until(`__lulu3d.state === "playing"`, "cruise starts", 120000)) return;
    await g(`(ctx.traffic.config.enabled = false, ctx.traffic.clear(), true)`);
    await W.install(t);
    await CJ.install(t);
    if (process.env.SWEEPCAM_NOSEE) await t.L(`import("./js/core/seethrough.js").then(m => { m.SEE.set = () => m.SEE.off(); return true; })`);     // (before / after pictures)
    const only = (process.env.SWEEPCAM_PARTS || "trees").split(",");

    // ── 1. street trees: walk past every street tree with the tree behind her (the camera's side) ──
    if (only.includes("trees")) for (const town of ["lakewood", "midwood"]) {
      if (!await inTown(t, town)) continue;
      if (!await onFoot(t)) continue;
      await W.reset(t);
      // every street tree near her chunk window: spots 3 m from the trunk on open ground, the camera looking from the tree to her
      const spots = await g(`(() => { const out = [], seen = new Set();
        for (const c of ctx.town.debug.S.T.colliders) { if (c.kind !== "tree" || c.r > 0.6 || c.off) continue;
          const k = Math.round(c.x) + "," + Math.round(c.z); if (seen.has(k)) continue; seen.add(k);
          for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4, x = c.x + Math.sin(ang) * 3, z = c.z + Math.cos(ang) * 3;
            if (window.__qa.solidAt(x, z, 0.3, -0.6)) continue;
            out.push({ x: +x.toFixed(2), z: +z.toFixed(2), yaw: ang, tx: c.x, tz: c.z }); break; } }
        return out; })()`);
      console.log(`   ${town}: ${spots.length} street-tree spots`);
      const bad = [];
      const N = Math.min(spots.length, +(process.env.SWEEPCAM_N || 40));
      for (let i = 0; i < N; i++) {
        const s = spots[Math.floor(i * spots.length / N)];
        await standAt(t, s.x, s.z, s.yaw);
        await t.frames(12);
        const p = await CJ.probe(t);
        if (i < 3) { console.log("   probe", JSON.stringify({ ...s, ...p })); await t.shot(`tree-${town}-sample${i}`); }
        if (p.near > 0.3 || (p.block && /leaves/.test(p.block))) { bad.push({ ...s, ...p }); if (bad.length <= 3) await t.shot(`tree-${town}-${bad.length}`); }
      }
      console.log("   bad:", JSON.stringify(bad.slice(0, 6)));
      t.check(`${town}: a street tree behind her never fills the screen / hides her (${N} trees)`, bad.length === 0, bad.length + " bad: " + JSON.stringify(bad.slice(0, 3)));
      W.check(t, `${town} street trees`, await W.report(t), ["nan", "flat", "underground", "inwall"]);
    }
  },
};
