// 📈 The 3D perf harness (scripts/tests3d/perf.js) from the command line.
//
//   node scripts/perf3d.js                          # run it (PERF3D_TIER, PERF3D_DRIVE, PERF3D_SCENES… pass through)
//   node scripts/perf3d.js --shots                  # + a screenshot per scene: smoke-shots/3d-perf-<tier>-<scene>.png
//   node scripts/perf3d.js --compare before.json after.json   # the before → after table
//
// Each run writes smoke-shots/perf3d-<tier>.json (or PERF3D_OUT). Serialize with the other
// browser users: flock /tmp/lulu3d-browser.lock node scripts/perf3d.js
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const COLS = ["calls", "gl", "shadowGl", "tris", "jsMs", "updateMs", "renderMs", "domMut", "textures", "geometries", "programs"];

function compare(a, b) {
  const A = JSON.parse(fs.readFileSync(a, "utf8")), B = JSON.parse(fs.readFileSync(b, "utf8"));
  console.log(`before: ${a} (${A.tier}, ${A.when})\nafter:  ${b} (${B.tier}, ${B.when})\n`);
  console.log("| scene | " + COLS.join(" | ") + " |");
  console.log("|---|" + COLS.map(() => "---").join("|") + "|");
  for (const k of Object.keys(Object.assign({}, A.scenes, B.scenes))) {
    const x = A.scenes[k] || {}, y = B.scenes[k] || {};
    const cell = c => {
      if (x[c] == null || y[c] == null) return `${x[c] ?? "–"} → ${y[c] ?? "–"}`;
      const pct = x[c] ? Math.round((y[c] - x[c]) / x[c] * 100) : 0;
      return `${x[c]} → ${y[c]}${pct ? ` (${pct > 0 ? "+" : ""}${pct}%)` : ""}`;
    };
    console.log(`| ${k} | ${COLS.map(cell).join(" | ")} |`);
  }
  for (const [n, R] of [["before", A], ["after", B]]) {
    if (!R.drive || !R.drive.length) continue;
    const s0 = R.drive[0], s1 = R.drive[R.drive.length - 1];
    console.log(`\n${n} drive: ${s1.s - s0.s} m · geometries ${s0.geometries} → ${s1.geometries} · textures ${s0.textures} → ${s1.textures} · materials ${s0.materials} → ${s1.materials} · objects ${s0.objects} → ${s1.objects} · heap ${s0.heapMB} → ${s1.heapMB} MB`);
  }
}

const i = process.argv.indexOf("--compare");
if (i >= 0) { compare(process.argv[i + 1], process.argv[i + 2]); process.exit(0); }

const env = Object.assign({}, process.env, { SMOKE3D_ONLY: "perf" });
if (!env.NODE_PATH && fs.existsSync("/opt/node-tools/node_modules")) env.NODE_PATH = "/opt/node-tools/node_modules";
const args = [path.join(__dirname, "smoke3d.js")];
if (process.argv.includes("--shots")) args.push("--shots");
const r = spawnSync(process.execPath, args, { stdio: "inherit", env });
process.exit(r.status || 0);
