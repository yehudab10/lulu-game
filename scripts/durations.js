#!/usr/bin/env node
// Refresh scripts/tests3d-durations.json (what scripts/affected.js + the full-suite workflow pack machines by) from
// a "3D full suite" run's `times-*` artifacts (scripts/smoke3d.js writes them with SMOKE3D_TIMES).
//
//   node scripts/durations.js <run id> [<run id> …]      # needs `gh` (the cloud container has it)
//   node scripts/durations.js --local smoke-times/        # or from local SMOKE3D_TIMES files
//
// Each file keeps one number per clock ("slow" = the old clock, "fast" = the fast test clock), in seconds on one
// GitHub machine; a new measurement is blended in (⅔ new, ⅓ old) so one noisy run doesn't swing the packing.
// Failed files count too (a failure usually ends a file early, so their time is only used when there is none yet).
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const FILE = path.join(ROOT, "scripts", "tests3d-durations.json");
const REPO = process.env.GITHUB_REPOSITORY || "yehudab10/lulu-game";
const args = process.argv.slice(2);

function fromRun(id) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "times-"));
  const list = JSON.parse(execSync(`gh api "repos/${REPO}/actions/runs/${id}/artifacts?per_page=100"`).toString()).artifacts || [];
  const out = [];
  for (const a of list.filter(x => /^times-/.test(x.name) && !x.expired)) {
    const zip = path.join(dir, a.name + ".zip");
    fs.writeFileSync(zip, execSync(`gh api repos/${REPO}/actions/artifacts/${a.id}/zip`, { maxBuffer: 64 << 20 }));
    execSync(`unzip -o -q "${zip}" -d "${path.join(dir, a.name)}"`);
    for (const f of fs.readdirSync(path.join(dir, a.name))) out.push(...JSON.parse(fs.readFileSync(path.join(dir, a.name, f), "utf8")));
  }
  return out;
}
function fromDir(d) { return fs.readdirSync(d).filter(f => f.endsWith(".json")).flatMap(f => JSON.parse(fs.readFileSync(path.join(d, f), "utf8"))); }

const rows = args[0] === "--local" ? fromDir(args[1] || "smoke-times") : args.flatMap(fromRun);
if (!rows.length) { console.error("durations: no timings found (give a run id with times-* artifacts, or --local <dir>)"); process.exit(1); }
const D = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { files: {} };
let n = 0;
for (const r of rows) {
  const e = D.files[r.name] = D.files[r.name] || {};
  const k = r.clock === "fast" ? "fast" : "slow";
  if (!r.pass && e[k]) continue;
  e[k] = e[k] ? Math.round((2 * r.s + e[k]) / 3) : r.s;
  n++;
}
D.updated = new Date().toISOString().slice(0, 10);
D.files = Object.fromEntries(Object.entries(D.files).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(FILE, JSON.stringify(D, null, 1) + "\n");
console.log(`durations: ${n} timing(s) merged into ${path.relative(ROOT, FILE)}`);
