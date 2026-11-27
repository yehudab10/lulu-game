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
const RUNS = [["today", ""], ["light", "&look=2&car=0&lulu=0"]];
const TIERS = (process.env.LOOK_TIERS || "medium,high").split(",");
const TNAME = { low: "WEAK PHONES (LOW)", medium: "PHONES (MEDIUM)", high: "LAPTOPS (HIGH)" };

(async () => {
  const out = L.OUT, tmp = process.env.LOOK_TMP || "/tmp/looktest-street";
  fs.mkdirSync(tmp, { recursive: true });
  const stats = {};
  for (const tier of TIERS) for (const [id0, q] of RUNS) {
    const id = `${tier}-${id0}`;
    const s = await L.open({ query: q, quality: tier });
    await L.toMidwood(s, ["Avenue J", 120, 1.75]);
    await L.clean(s);
    for (const tod of ["noon", "dusk"]) {
      await L.timeOfDay(s, tod);
      for (const [c, cam] of Object.entries(CAMS)) {
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
    "-pointsize", "30", "-annotate", "+0+14", ` ${txt} `, o]);
  for (const tier of TIERS) for (const tod of ["noon", "dusk"]) for (const c of Object.keys(CAMS)) {
    const a = path.join(tmp, `a-${tier}-${tod}-${c}.png`), b = path.join(tmp, `b-${tier}-${tod}-${c}.png`);
    label(path.join(tmp, `${tier}-today-${tod}-${c}.png`), `TODAY · ${TNAME[tier]} · ${tod}`, a);
    label(path.join(tmp, `${tier}-light-${tod}-${c}.png`), `NEW LIGHT · ${TNAME[tier]} · ${tod}`, b);
    execFileSync("convert", [a, b, "+append", "-quality", "84", path.join(out, `light-${tier}-${tod}-${c}.jpg`)]);
  }
  console.log("done");
})().catch(e => { console.error(e); process.exit(1); });
