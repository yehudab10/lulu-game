// 🎥 The camera-junk probe (ci/sweep-camera): what does the player actually SEE right now? A test-side helper that casts
// rays from the camera into the real scene (three.js Raycaster against every visible mesh) and reports:
//   • near   the share of the screen whose first thing is closer than `near` m to the lens (a tree's leaves, a wall, a rail
//            right in front of the lens — "one flat colour" / "a screen of leaves")
//   • block  the first thing between the camera and Lulu's chest / head (null = she's in clear view), its distance
//   • fill   the biggest single object's share of the screen (by name), when it's close
// It lives in the test page only. Install once after boot: await CJ.install(t); then await CJ.probe(t) → the numbers.
const SRC = String.raw`
(async () => {
  if (window.__camjunk) return true;
  const THREE = await import("three");
  const SEEM = await import("./js/core/seethrough.js");
  const L3 = window.__lulu3d, ctx = L3.ctx;
  const rc = new THREE.Raycaster(), v = new THREE.Vector3(), dir = new THREE.Vector3(), ndc = new THREE.Vector2();
  const nameOf = o => { const parts = []; for (let p = o; p && parts.length < 3; p = p.parent) if (p.name) parts.push(p.name); const m = Array.isArray(o.material) ? o.material[0] : o.material; return (parts.join("<") || o.type) + (m && m.name ? " [" + m.name + "]" : ""); };
  // her own body + things that don't hide anything (sprites, lines, points, see-through stuff, the sky)
  const skip = new Set();
  const usable = o => {
    if (!o.visible) return false;
    for (let p = o; p; p = p.parent) if (!p.visible || skip.has(p)) return false;
    if (!(o.isMesh || o.isInstancedMesh) || o.isSprite) return false;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!m || m.visible === false || (m.transparent && m.opacity < 0.5) || m.colorWrite === false) return false;
    if (o.geometry && o.geometry.boundingSphere && o.geometry.boundingSphere.radius > 3000) return false;     // (the sky dome / the ground plane far out)
    if (/sky|stars|rain|snow|fx|particle|shadow|beam|glow|bubble|label|tag/i.test(o.name || "")) return false;
    return true;
  };
  function targets(cam, maxD) {
    const out = [];
    const root = ctx.scene;
    root.traverseVisible(o => {
      if (!usable(o)) return;
      const g = o.geometry; if (!g) return;
      if (!g.boundingSphere) g.computeBoundingSphere();
      if (!g.boundingSphere) return;
      v.copy(g.boundingSphere.center).applyMatrix4(o.matrixWorld);
      const s = o.matrixWorld.getMaxScaleOnAxis(), r = g.boundingSphere.radius * s;
      if (o.isInstancedMesh) { out.push(o); return; }
      if (v.distanceTo(cam) - r < maxD) out.push(o);
    });
    return out;
  }
  // (a leaf the game cuts away along the line of sight — core/seethrough.js — isn't on screen: skip that hit)
  const cutAway = h => {
    const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material;
    const mode = m && m.userData && m.userData.seeThrough, S = SEEM.SEE.debug;
    if (!mode || !S.on) return false;
    if (mode === "flag") { const c = h.object.geometry.attributes.color, r = c && h.face ? c.array[h.face.a * 3] : 0; if (r < SEEM.LEAF_FLAG - 1) return false; }
    const A = new THREE.Vector3(...S.a), B = new THREE.Vector3(...S.b), ab = B.clone().sub(A), p = h.point;
    if (p.y <= SEEM.SEE_TUBE.minY) return false;
    const t = p.clone().sub(A).dot(ab) / Math.max(ab.lengthSq(), 1e-4);
    if (t <= 0 || t >= 1) return false;
    const r = SEEM.SEE_TUBE.r0 + (SEEM.SEE_TUBE.r1 - SEEM.SEE_TUBE.r0) * t, d = p.clone().sub(A.clone().addScaledVector(ab, t)).length();
    return d < r * 0.8;
  };
  const first = hs => { for (const h of hs) if (!cutAway(h)) return h; return null; };
  const isLeaf = h => { const m = Array.isArray(h.object.material) ? h.object.material[0] : h.object.material; if (m && m.userData && (m.userData.leaf || m.userData.seeThrough === "all")) return true; const c = h.object.geometry.attributes.color; const r = c && h.face ? c.array[h.face.a * 3] : 0; return r > 3 && r < 7; };
  window.__camjunk = {
    /** opts: near (m), cols, rows, who (a Vector3-ish: what she is — default foot / the car) */
    probe(opts = {}) {
      const camera = ctx.camera, cam = camera.position, near = opts.near || 1.6, cols = opts.cols || 7, rows = opts.rows || 11;
      camera.updateMatrixWorld();
      skip.clear();
      const me = ctx.foot && ctx.foot.active && ctx.foot.obj ? ctx.foot.obj : ctx.car && ctx.car.obj;
      if (me) skip.add(me);
      for (const x of opts.skip || []) skip.add(x);
      const list = targets(cam, Math.max(near, 30));
      let nearN = 0, n = 0; const fill = {};
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        ndc.set(-0.9 + 1.8 * i / (cols - 1), -0.9 + 1.8 * j / (rows - 1));
        rc.setFromCamera(ndc, camera); rc.near = 0.0; rc.far = near;
        const h = first(rc.intersectObjects(list, false));
        n++;
        if (h) { nearN++; const k = nameOf(h.object); fill[k] = (fill[k] || 0) + 1; }
      }
      // what stands between the lens and her (chest + head)
      let block = null, bd = 0;
      const who = opts.who || (ctx.foot && ctx.foot.active && ctx.foot.pos) || (ctx.car && ctx.car.pos);
      if (who) for (const hy of [1.0, 1.45]) {
        v.set(who.x, (opts.whoY != null ? opts.whoY : (ctx.foot && ctx.foot.active ? (ctx.foot.debug && ctx.foot.debug.F ? (ctx.foot.debug.F.y || 0) : 0) : 0)) + hy, who.z);
        dir.subVectors(v, cam); const D = dir.length(); dir.normalize();
        rc.set(cam, dir); rc.near = 0; rc.far = Math.max(0, D - 0.45);
        const h = first(rc.intersectObjects(targets(cam, D), false));
        if (!h) { block = null; break; }
        block = nameOf(h.object) + (isLeaf(h) ? " (leaves)" : ""); bd = +h.distance.toFixed(2);
      }
      let top = null, tn = 0; for (const k in fill) if (fill[k] > tn) { tn = fill[k]; top = k; }
      return { near: +(nearN / n).toFixed(2), block, bd, top, topShare: +(tn / n).toFixed(2), cam: [+cam.x.toFixed(1), +cam.y.toFixed(1), +cam.z.toFixed(1)],
        clipD: ctx.cam && ctx.cam.free ? +(+ctx.cam.free.clipD).toFixed(2) : null };
    },
  };
  return true;
})()`;

module.exports = {
  async install(t) { return t.L(SRC); },
  /** → { near, block, bd, top, topShare, cam, clipD } */
  async probe(t, opts = {}) { return t.L(`window.__camjunk.probe(${JSON.stringify(opts)})`); },
};
