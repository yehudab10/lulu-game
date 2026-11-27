// 📥 Recompute the models' version key in /sw.json (the service worker drops its kept .glb files when it changes, so a
// regenerated model reaches installed players on their next start). Run after regenerating ANY model:
//   node scripts/sw-version.js            # rewrite sw.json's "assets"
//   node scripts/sw-version.js --check    # exit 1 if sw.json is out of date (scripts/tests3d/install.js checks this)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, ".."), DIR = path.join(ROOT, "3d", "assets"), FILE = path.join(ROOT, "sw.json");
function assetsKey() {
  const h = crypto.createHash("sha1");
  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".glb")).sort()) h.update(f).update(crypto.createHash("sha1").update(fs.readFileSync(path.join(DIR, f))).digest());
  return h.digest("hex").slice(0, 12);
}
module.exports = { assetsKey };
if (require.main !== module) return;
const cur = JSON.parse(fs.readFileSync(FILE, "utf8")), want = assetsKey();
if (process.argv.includes("--check")) { if (cur.assets !== want) { console.error(`sw.json "assets" is ${cur.assets}, the models hash to ${want}: run node scripts/sw-version.js`); process.exit(1); } console.log("sw.json assets key ok"); process.exit(0); }
cur.assets = want;
fs.writeFileSync(FILE, JSON.stringify(cur, null, 2) + "\n");
console.log(`sw.json assets = ${want}`);
