// (temporary, ci/perf4: the perf harness twice on ONE machine — `&nobatch` (the game drawn as before ci/perf4) then the
//  batches on — so the frame times compare; tier from the group name's env below. Not to be merged.)
const path = require("path");
const TIER = process.env.ZZ_TIER || "low";
Object.assign(process.env, { PERF3D_TIER: TIER, PERF3D_SCENES: process.env.ZZ_SCENES || "cruise,highway,towndrive,townfoot,middrive,midfoot,attached,foot", PERF3D_ADD: "all", PERF3D_FRAMES: "60" });
if (process.env.ZZ_PROFILE) process.env.PERF3D_PROFILE = "1";
const perf = require("./perf.js");
const base = perf.query;
module.exports = Object.assign({}, perf, {
  name: "zzperfab",
  query: base + "&nobatch",
  async run(t) {
    const dir = path.join(__dirname, "..", "..", "smoke-shots");
    for (const [label, q] of [["OFF", base + "&nobatch"], ["ON", base], ["OFF2", base + "&nobatch"], ["ON2", base]]) {
      console.log(`=== AB ${TIER} ${label}`);
      this.query = q;          // (t.boot() reads the runner's module object: this)
      process.env.PERF3D_OUT = path.join(dir, `perf3d-${TIER}-${label}.json`);
      if (label !== "OFF") t.page.addInitScript = async () => { };     // (the probe is installed once: it stays for every reload)
      await perf.run.call(this, t);
    }
  },
});
