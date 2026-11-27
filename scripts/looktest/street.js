// Look test › ONE STREET'S LIGHT: a Midwood block (Avenue J by the bank + the college) at noon and at dusk, today vs
// ?look=2 with ONLY the light changed (today's car and Lulu, so the light is all that differs), from two cameras.
// Plus one "everything on" picture (light + the improved car).
//   NODE_PATH=/opt/node-tools/node_modules node scripts/looktest/street.js    (→ 3d/docs/looktest/light-*.jpg)
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const L = require("./lib.js");

const CAMS = {
  wide: { pos: [-14, 9, -18], look: [0, 1, 10], fov: 55 },
  low: { pos: [-6.5, 1.5, -5.5], look: [3, 2.2, 14], fov: 60 },
};
const RUNS = [["today", ""], ["light", "&look=2&car=0&lulu=0"], ["all", "&look=2"]];

(async () => {
  const out = L.OUT, tmp = process.env.LOOK_TMP || "/tmp/looktest-street";
  fs.mkdirSync(tmp, { recursive: true });
  const stats = {};
  for (const [id, q] of RUNS) {
    const s = await L.open({ query: q });
    await L.toMidwood(s, ["Avenue J", 120, 1.75]);
    await L.clean(s);
    for (const tod of ["noon", "dusk"]) {
      await L.timeOfDay(s, tod);
      for (const [c, cam] of Object.entries(CAMS)) {
        if (id === "all" && c === "low") continue;
        await L.pinCamera(s, cam);
        await s.frames(4);
        await L.shot(s, path.join(tmp, `${id}-${tod}-${c}.png`));
        stats[`${id}-${tod}-${c}`] = await L.info(s);
      }
    }
    console.log(id, "errors:", s.errors.slice(0, 2));
    await s.close();
  }
  fs.writeFileSync(path.join(out, "light-draws.json"), JSON.stringify(stats, null, 1));
  const label = (f, txt, o) => execFileSync("convert", [f, "-resize", "1280x720", "-gravity", "north", "-fill", "white", "-undercolor", "#000000a0", "-font", "DejaVu-Sans",
    "-pointsize", "34", "-annotate", "+0+14", ` ${txt} `, o]);
  for (const tod of ["noon", "dusk"]) for (const c of Object.keys(CAMS)) {
    const a = path.join(tmp, `a-${tod}-${c}.png`), b = path.join(tmp, `b-${tod}-${c}.png`);
    label(path.join(tmp, `today-${tod}-${c}.png`), `TODAY · ${tod}`, a);
    label(path.join(tmp, `light-${tod}-${c}.png`), `NEW LIGHT · ${tod}`, b);
    execFileSync("convert", [a, b, "+append", "-quality", "86", path.join(out, `light-${tod}-${c}.jpg`)]);
    for (const id of ["today", "light"]) execFileSync("convert", [path.join(tmp, `${id}-${tod}-${c}.png`), "-quality", "88", path.join(out, `light-${tod}-${c}-${id}.jpg`)]);
  }
  for (const tod of ["noon", "dusk"]) execFileSync("convert", [path.join(tmp, `all-${tod}-wide.png`), "-quality", "88", path.join(out, `everything-${tod}.jpg`)]);
  console.log("done");
})().catch(e => { console.error(e); process.exit(1); });
