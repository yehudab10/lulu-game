#!/usr/bin/env node
// Which 3D test files can a change break? → a ready `groups=` string for the "3D full suite" workflow.
//
//   node scripts/affected.js                 # your branch vs origin/main (committed + uncommitted changes)
//   node scripts/affected.js <base>          # vs another base (a commit / branch)
//   node scripts/affected.js --files a,b     # pretend these paths changed
//   node scripts/affected.js --why           # also say why each test was picked
//   node scripts/affected.js --minutes 35    # target minutes per machine (default 35)
//
// How a change maps to tests:
//   • 3d/js/core/**, app.js, hud.js, world.js, models.js, car.js, traffic.js, input.js, audio.js, lod.js, …, the 3D
//     page / CSS / vendor / models (3d/assets, 3d/blender), the harness (scripts/smoke3d.js, scripts/lib/**)
//                                   → EVERYTHING (the wide set)
//   • a test file itself            → that test
//   • 3d/js/features/<id>/**        → every test that names the feature: its file name starts with <id>, its
//                                     `&enable=` lists <id>, it uses one of the services the feature sets
//                                     (`ctx.<name> =` in its files) or imports features/<id>/ — and the same for
//                                     every feature that IMPORTS the changed one directly (the import graph)
//   • anything else (docs, *.md, the classic 2D game, server/) → no 3D tests
// Always added: core + platform (cheap canaries). Packed onto machines with scripts/tests3d-durations.json (the
// fast-clock time where recorded, else the old clock's): longest first onto the least-loaded machine.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const TESTS = path.join(ROOT, "scripts", "tests3d");
const FEAT = path.join(ROOT, "3d", "js", "features");
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const WHY = args.includes("--why");
const MINUTES = +opt("--minutes") || 35;
const MAX_MACHINES = 16;
const ALWAYS = ["core", "platform"];

// ── what changed ──
function changed() {
  const f = opt("--files");
  if (f) return f.split(",").map(s => s.trim()).filter(Boolean);
  const base = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--files" && args[args.indexOf(a) - 1] !== "--minutes") || "origin/main";
  const sh = c => { try { return execSync(c, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString(); } catch (e) { return ""; } };
  const mb = sh(`git merge-base ${base} HEAD`).trim() || base;
  const out = sh(`git diff --name-only ${mb}`) + sh(`git ls-files --others --exclude-standard`);
  return [...new Set(out.split("\n").map(s => s.trim()).filter(Boolean))];
}

// ── the tests and what they touch ──
const tests = fs.readdirSync(TESTS).filter(f => f.endsWith(".js")).map(f => f.slice(0, -3)).sort();
const testSrc = Object.fromEntries(tests.map(t => [t, fs.readFileSync(path.join(TESTS, t + ".js"), "utf8")]));
const features = fs.readdirSync(FEAT).filter(d => fs.statSync(path.join(FEAT, d)).isDirectory());
const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : []; });
const featFiles = Object.fromEntries(features.map(id => [id, walk(path.join(FEAT, id))]));
/** Fields the core owns (ctx.state, ctx.paused, ctx.trip…): a feature writing one doesn't make it that feature's. */
const coreOwned = new Set();
for (const f of [...walk(path.join(ROOT, "3d", "js", "core")), ...fs.readdirSync(path.join(ROOT, "3d", "js")).filter(x => x.endsWith(".js")).map(x => path.join(ROOT, "3d", "js", x))]) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bctx\.([a-zA-Z_]\w*)\s*=(?!=)/g)) coreOwned.add(m[1]);
  if (/core[\\/]ctx\.js$/.test(f)) for (const m of src.matchAll(/^\s{4}([a-zA-Z_]\w*):/gm)) coreOwned.add(m[1]);
}
/** The services a feature sets: `ctx.<name> =` in its files (not a core-owned field). */
const services = Object.fromEntries(features.map(id => {
  const names = new Set();
  for (const f of featFiles[id]) for (const m of fs.readFileSync(f, "utf8").matchAll(/^\s*ctx\.([a-zA-Z_]\w*)\s*=(?!=)/gm)) if (!coreOwned.has(m[1])) names.add(m[1]);
  return [id, names];
}));
/** feature → the features that import it (directly). */
const importers = Object.fromEntries(features.map(id => [id, new Set()]));
for (const id of features) for (const f of featFiles[id]) {
  for (const m of fs.readFileSync(f, "utf8").matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
    const abs = path.resolve(path.dirname(f), m[1]);
    const rel = path.relative(FEAT, abs);
    if (rel.startsWith("..")) continue;
    const dep = rel.split(path.sep)[0];
    if (dep !== id && importers[dep]) importers[dep].add(id);
  }
}
const enables = t => new Set((testSrc[t].match(/enable=([a-z0-9,_-]+)/g) || []).flatMap(m => m.slice(7).split(",")));
function testsFor(id) {
  const out = new Map();
  const svc = [...services[id]];
  for (const t of tests) {
    const src = testSrc[t];
    let why = null;
    if (t === id || t.startsWith(id)) why = "named after it";
    else if (enables(t).has(id)) why = "&enable=" + id;
    else if (src.includes(`features/${id}/`)) why = `imports features/${id}/`;
    else { const s = svc.find(n => new RegExp(`ctx\\.${n}\\b`).test(src)); if (s) why = `uses ctx.${s}`; }
    if (why) out.set(t, why);
  }
  return out;
}

// ── the rules ──
const WIDE = [
  /^3d\/js\/core\//, /^3d\/js\/[^/]+\.js$/, /^3d\/index\.html$/, /^3d\/[^/]+\.css$/, /^3d\/vendor\//, /^3d\/assets\//, /^3d\/blender\/.*\.py$/,
  /^scripts\/smoke3d\.js$/, /^scripts\/lib\//, /^3d\/js\/features\/index\.js$/,
];
const files = changed();
const pick = new Map();            // test → reason
const add = (t, why) => { if (tests.includes(t) && !pick.has(t)) pick.set(t, why); };
let wide = null;
for (const f of files) {
  if (WIDE.some(r => r.test(f))) { wide = wide || f; continue; }
  let m;
  if ((m = f.match(/^scripts\/tests3d\/(.+)\.js$/))) { add(m[1], "the test changed"); continue; }
  if ((m = f.match(/^3d\/js\/features\/([^/]+)\//))) {
    // the feature + the features that import it directly (one level: a hub like law is imported by half the game,
    // and following imports further picked nearly every test for any change)
    const seen = new Set([m[1], ...(importers[m[1]] || [])]);
    for (const id of seen) for (const [t, why] of testsFor(id)) add(t, id === m[1] ? `${f.split("/").slice(3, 5).join("/")}: ${why}` : `${id} imports ${m[1]}: ${why}`);
  }
}
if (wide) for (const t of tests) add(t, `wide: ${wide}`);
if (pick.size) for (const t of ALWAYS) add(t, "always (canary)");

// ── pack ──
let dur = {};
try { dur = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "tests3d-durations.json"), "utf8")).files || {}; } catch (e) { /* none yet */ }
const sec = t => (dur[t] && (dur[t].fast || dur[t].slow)) || 300;
const chosen = [...pick.keys()];
const total = chosen.reduce((a, t) => a + sec(t), 0);
const n = Math.max(1, Math.min(MAX_MACHINES, chosen.length, Math.ceil(total / (MINUTES * 60))));
const bins = Array.from({ length: n }, () => ({ t: 0, f: [] }));
for (const t of [...chosen].sort((a, b) => sec(b) - sec(a))) { const b = bins.reduce((x, y) => y.t < x.t ? y : x); b.t += sec(t); b.f.push(t); }
const groups = bins.filter(b => b.f.length).sort((a, b) => b.t - a.t);

if (!files.length) { console.log("affected: no changes vs the base."); process.exit(0); }
if (!chosen.length) { console.log(`affected: ${files.length} changed file(s), none of them can break a 3D test (docs / 2D / server).`); process.exit(0); }
const mins = s => (s / 60).toFixed(0);
console.log(`affected: ${files.length} changed file(s) → ${chosen.length} of ${tests.length} test files${wide ? ` (WIDE: ${wide})` : ""}, ~${mins(total)} machine-min on ${groups.length} machine(s), the slowest ~${mins(groups[0].t)} min`);
if (WHY) for (const [t, why] of [...pick].sort()) console.log(`  ${t.padEnd(22)} ${why}`);
console.log(`\ngroups=${groups.map(g => g.f.join(",")).join(";")}`);
