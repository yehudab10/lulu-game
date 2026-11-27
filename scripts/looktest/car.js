// Look test › ONE CAR three ways: today's lulu_car · our own model improved (looktest_car) · Kenney's CC0 sedan fitted
// (looktest_kenney). Same street, same noon, same camera, TODAY's light for all three (so only the car changes).
// Each is also repainted (blue), dented (feel/damage), given a dealer body kit (Mazelati) and checked for the hooks
// the game uses (wheels, steering wheel, tail lights, anchors, Lulu at the wheel, hair).
//   NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/car.js     (→ 3d/docs/looktest/car-*.jpg, car-hooks.json)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const L = require("./lib.js");

const ALL = [
  ["today", ""],
  ["ours", "&look=2&car=good&lulu=0&light=0&glow=0"],
  ["lite", "&look=2&car=lite&lulu=0&light=0&glow=0"],
  ["kenney", "&look=2&car=kenney&lulu=0&light=0&glow=0"],
];
const VARIANTS = ALL.filter(([id]) => (process.env.CAR_VARIANTS || "today,ours,kenney").split(",").includes(id));
const VIEWS = { front: { pos: [3.6, 1.6, 4.6], look: [0, 0.7, 0], fov: 45 }, rear: { pos: [-3.4, 2.0, -4.8], look: [0, 0.7, 0], fov: 45 } };

(async () => {
  const out = L.OUT, tmp = process.env.LOOK_TMP || "/tmp/looktest-car";
  fs.mkdirSync(tmp, { recursive: true });
  const hooks = {};
  for (const [id, q] of VARIANTS) {
    const s = await L.open({ query: q });
    await L.toMidwood(s, ["Avenue J", 120, 1.75]);
    await L.timeOfDay(s, "noon");
    await L.clean(s);
    for (const [v, cam] of Object.entries(VIEWS)) { await L.pinCamera(s, cam); await L.shot(s, path.join(tmp, `${id}-${v}.png`)); }
    hooks[id] = await s.g(`(() => { const c = ctx.car, m = c.model; let tris = 0, meshes = 0;
      m.traverse(o => { if (o.isMesh) { meshes++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; } });
      return { wheels: c.wheels.length, steeredFront: c.wheels.filter(w => w.front).length, steeringWheel: !!c.steeringWheel, taillights: c.taillights.length,
        anchors: Object.keys(c.anchors).sort().join(" "), driver: !!c.driver, hair: c.hairs.length, windscreenPivot: !!m.getObjectByName("ws"),
        bodyMesh: (() => { let b = false; m.traverse(o => { if (o.isMesh && o.material.name === "Body" && /LuluCar_body/.test(o.parent.name + o.name)) b = true; }); return b; })(),
        triangles: Math.round(tris), meshes }; })()`);
    // repaint + dents
    await s.g(`(ctx.car.setSkin("blue"), true)`);
    await s.frames(3);
    hooks[id].dents = await s.L(`import("/3d/js/features/feel/damage.js").then(m => { const r = m.wear(4, "mix"); return r ? (r.dents != null ? r.dents : JSON.stringify(r).slice(0, 120)) : null; })`);
    await s.frames(3);
    await L.pinCamera(s, VIEWS.front);
    await L.shot(s, path.join(tmp, `${id}-blue-dented.png`));
    // a dealer body kit (Mazelati's chrome + ornament) on the same car
    const kit = await s.L(`import("/3d/js/car.js").then(m => { const id = Object.keys(m.SKINS).find(k => m.SKINS[k].kit === "mazelati"); if (id) __lulu3d.ctx.car.setSkin(id); return id || ""; })`);
    hooks[id].kit = kit;
    await s.frames(3);
    await L.shot(s, path.join(tmp, `${id}-kit.png`));
    hooks[id].errors = s.errors.slice(0, 3);
    console.log(id, hooks[id]);
    await s.close();
  }
  fs.writeFileSync(path.join(out, `car-hooks${process.env.CAR_VARIANTS ? "-" + process.env.CAR_VARIANTS.replace(/,/g, "-") : ""}.json`), JSON.stringify(hooks, null, 1));
  // the contact sheets: a row per view, the three cars side by side, labelled
  const label = (f, txt, o) => execFileSync("convert", [f, "-resize", "1280x720", "-gravity", "north", "-fill", "white", "-undercolor", "#000000a0", "-font", "DejaVu-Sans",
    "-pointsize", "34", "-annotate", "+0+14", ` ${txt} `, o]);
  const NAMES = { today: "TODAY", ours: "OUR MODEL, IMPROVED", lite: "IMPROVED, LITE (for phones)", kenney: "FREE CC0 MODEL (Kenney), FITTED" };
  const SET = process.env.CAR_VARIANTS ? "-" + VARIANTS.map(v => v[0]).join("-") : "";
  for (const v of ["front", "rear", "blue-dented", "kit"]) {
    const parts = VARIANTS.map(([id]) => { const o = path.join(tmp, `${id}-${v}-l.png`); label(path.join(tmp, `${id}-${v}.png`), NAMES[id], o); return o; });
    execFileSync("convert", [...parts, "+append", "-quality", "86", path.join(out, `car-${v}${SET}.jpg`)]);
    for (const [id] of VARIANTS) execFileSync("convert", [path.join(tmp, `${id}-${v}.png`), "-quality", "88", path.join(out, `car-${v}-${id}.jpg`)]);
  }
  console.log("done");
})().catch(e => { console.error(e); process.exit(1); });
