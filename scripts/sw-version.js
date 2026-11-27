// 📥 Recompute the version key of every CACHE-FIRST file in /sw.json "assets" — everything sw.js's BIG_RE matches:
// .glb models, vendor/ (three.js), audio, images (the service worker drops its kept copies when it changes, so a
// regenerated model / a new three.js / a changed texture reaches installed players on their next start).
// Run it before every push to main (AGENTS.md golden rule 2; make_assets.py runs it too; the Smoke workflow checks it):
//   node scripts/sw-version.js            # rewrite sw.json's "assets"
//   node scripts/sw-version.js --check    # exit 1 if sw.json is out of date (scripts/tests3d/install.js checks this)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), FILE = path.join(ROOT, "sw.json");
// the same test as sw.js (read from it, so the two can never disagree)
const BIG_RE = new Function("return " + /const BIG_RE = (\/.*\/i);/.exec(fs.readFileSync(path.join(ROOT, "sw.js"), "utf8"))[1])();
// (pictures the game never asks for — docs, the Blender preview, App Store art — don't count)
const NOT_GAME = /^(store|docs|3d\/docs|3d\/blender|scripts|ios|android|www|\.github)\//;
/** Every file the site serves (tracked + new, not ignored) that the worker keeps cache-first. */
function bigFiles() {
  const out = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
  return [...new Set(out.split("\0").filter(Boolean))].filter(f => BIG_RE.test("/" + f) && !NOT_GAME.test(f) && fs.existsSync(path.join(ROOT, f))).sort();
}
function assetsKey() {
  const h = crypto.createHash("sha1");
  for (const f of bigFiles()) h.update(f).update(crypto.createHash("sha1").update(fs.readFileSync(path.join(ROOT, f))).digest());
  return h.digest("hex").slice(0, 12);
}
module.exports = { assetsKey, bigFiles };
if (require.main !== module) return;
const cur = JSON.parse(fs.readFileSync(FILE, "utf8")), want = assetsKey();
if (process.argv.includes("--check")) { if (cur.assets !== want) { console.error(`sw.json "assets" is ${cur.assets}, the models hash to ${want}: run node scripts/sw-version.js`); process.exit(1); } console.log("sw.json assets key ok"); process.exit(0); }
cur.assets = want;
fs.writeFileSync(FILE, JSON.stringify(cur, null, 2) + "\n");
console.log(`sw.json assets = ${want}`);
