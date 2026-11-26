// Stage the static web assets into www/ so Capacitor can bundle them into the
// native app. Run after `node build.js`. This keeps the native bundle free of
// node_modules / src / .git / tooling — only the actual runtime files ship.
//
// The web + GitHub Pages deploy still serves straight from the repo root; www/
// exists ONLY for the native wrapper and is gitignored (regenerated on build).
//
// The app ships Lulu's Road Trip 2.0 — the 3D game — exactly like lulu.boats:
//
//   www/index.html        the root forwarder (repo index.html) → 3d/
//   www/3d/               the 3D game: index.html, style3d.css, js/, vendor/, assets/*.glb
//                         (NOT 3d/blender/, 3d/docs/, *.md, .blend files)
//   www/*.mp3             the music — the 3D game loads it as ../<name>.mp3
//   www/classic.html …    the classic 2D game (game.js, style.css, icons), linked
//                         from 2.0's ⚙️ More → "Classic 2D" (../classic.html)
//
// Keeping 3d/ one level below index.html matters twice over: the 3D game's
// relative ../*.mp3 / ../classic.html links resolve, and the app's origin
// (capacitor://localhost) is unchanged, so the localStorage save the classic
// app wrote (luluSaveV2: coins, cars, progress) is the one 2.0 reads.
//
// After copying, every file the 3D game references is checked against www/
// (module imports, the import map, ../*.mp3 and other asset paths, <script>/
// <link> tags, CSS url()s). A missing file FAILS the build loudly (exit 1) —
// this runs in Codemagic before `cap sync`, so a broken bundle never ships.
// The runtime proof (a real boot against www/ with zero 404s / page errors)
// is scripts/tests3d/native.js.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "www");

// Root files: the forwarder, the classic 2D game, its icons and all the music.
const ROOT_FILES = [
  "index.html",          // forwards to 3d/ (keeps ?query + #hash)
  "classic.html",
  "game.js",
  "style.css",
  "manifest.webmanifest",
  "icon-192.svg",
  "icon-512.svg",
  "lulu.mp3",
  "luludriving.mp3",
  "dina.mp3",
  "avigail.mp3",
  "parking.mp3",
  "salon.mp3",
  "wedding.mp3",
  "prison.mp3",
  "court.mp3",
  "walking.mp3",
  "er1.mp3",
  "er2.mp3",
  "story-relax.mp3",
  "story-electric.mp3",
  "story-beach.mp3",
  "dont-wanna-be-frum.mp3"
];

// The 3D game: these files + directories, recursively, minus the excludes.
const THREE_D = ["index.html", "style3d.css", "js", "vendor", "assets"];
const EXCLUDE = [/\.md$/i, /\.blend\d*$/i, /\.py$/i, /(^|\/)__pycache__(\/|$)/, /(^|\/)\.DS_Store$/];

function copyTree(src, dst, stats) {
  const st = fs.statSync(src);
  const rel = path.relative(ROOT, src).split(path.sep).join("/");
  if (EXCLUDE.some(re => re.test(rel))) { stats.skipped.push(rel); return; }
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) copyTree(path.join(src, f), path.join(dst, f), stats);
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
    stats.files++;
    stats.bytes += st.size;
  }
}

function stage() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const stats = { files: 0, bytes: 0, skipped: [], missing: [] };
  for (const f of ROOT_FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) copyTree(src, path.join(OUT, f), stats);
    else stats.missing.push(f);
  }
  for (const f of THREE_D) {
    const src = path.join(ROOT, "3d", f);
    if (fs.existsSync(src)) copyTree(src, path.join(OUT, "3d", f), stats);
    else stats.missing.push("3d/" + f);
  }
  return stats;
}

// ── reference check ────────────────────────────────────────────────────────
// Every path the 3D game (and the forwarder / classic page) can ask for must
// exist inside www/. Paths are resolved the way the browser does:
//   • import specifiers relative to the importing module (bare "three/…" via
//     www/3d/index.html's import map);
//   • every other string literal that looks like a file (fetch, <audio>,
//     setMusic("../x.mp3"), loader paths…) relative to the PAGE (www/3d/);
//   • <script src>, <link href>, <a href>, CSS url() relative to their file.
// External (https:, data:, blob:) URLs and template strings with ${…} are skipped.
const FILE_EXT = "glb|gltf|mp3|ogg|wav|m4a|png|jpe?g|webp|gif|svg|json|css|js|mjs|woff2?|ttf|html|webmanifest|txt";
const STR_RE = new RegExp(`(["'\`])((?:\\.{1,2}\\/|\\/)?[\\w@.\\-/]+\\.(?:${FILE_EXT}))\\1`, "g");
const IMPORT_RE = /(?:\bimport\s*(?:[\w*{}\s,$]+\s*from\s*)?|\bexport\s*[\w*{}\s,$]+\s*from\s*|\bimport\s*\(\s*)(["'])([^"'\n]+)\1/g;

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const isExternal = u => /^(?:[a-z][\w+.-]*:|\/\/|#)/i.test(u);

function checkRefs() {
  const problems = [];
  const www3d = path.join(OUT, "3d");
  const pageDir = www3d;
  const need = (file, from, how) => {
    const clean = file.split(/[?#]/)[0];
    if (!clean || fs.existsSync(clean)) return;
    problems.push(`${path.relative(OUT, from)} → ${path.relative(OUT, clean)} (${how})`);
  };
  const inside = p => path.resolve(p).startsWith(OUT + path.sep);

  // import map (bare specifiers)
  const html = fs.readFileSync(path.join(www3d, "index.html"), "utf8");
  const mapM = /<script type="importmap">([\s\S]*?)<\/script>/.exec(html);
  const imap = mapM ? JSON.parse(mapM[1]).imports || {} : {};
  const resolveBare = spec => {
    if (imap[spec]) return path.join(pageDir, imap[spec]);
    const pre = Object.keys(imap).filter(k => k.endsWith("/") && spec.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    return pre ? path.join(pageDir, imap[pre] + spec.slice(pre.length)) : null;
  };
  for (const v of Object.values(imap)) need(path.join(pageDir, v), path.join(www3d, "index.html"), "import map");

  let scanned = 0;
  for (const file of walk(www3d)) {
    const ext = path.extname(file);
    if (![".js", ".mjs", ".html", ".css"].includes(ext)) continue;
    scanned++;
    const src = fs.readFileSync(file, "utf8");
    const importSpecs = new Set();
    if (ext === ".js" || ext === ".mjs" || ext === ".html") {
      for (const m of src.matchAll(IMPORT_RE)) {
        const spec = m[2];
        importSpecs.add(spec);
        if (isExternal(spec)) continue;
        if (/^\.{0,2}\//.test(spec)) need(path.resolve(path.dirname(file), spec), file, "import");
        else { const r = resolveBare(spec); if (r) need(r, file, "import (map)"); else problems.push(`${path.relative(OUT, file)} → unmapped bare import "${spec}"`); }
      }
    }
    if (ext === ".html") {
      for (const m of src.matchAll(/<(?:script|link|img|audio|source|a)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
        const u = m[1];
        if (isExternal(u) || u.includes("${")) continue;
        const target = path.resolve(path.dirname(file), u);
        need(u.endsWith("/") ? path.join(target, "index.html") : target, file, "tag");
      }
    }
    if (ext === ".css" || ext === ".js") {
      for (const m of src.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
        const u = m[1];
        if (isExternal(u) || u.includes("${") || !/\.\w+$/.test(u)) continue;
        need(path.resolve(ext === ".css" ? path.dirname(file) : pageDir, u), file, "url()");
      }
    }
    // registerModels({ key: "file", … }) → assets/<file>.glb: a model a feature loads by NAME (models.js adds the
    // path + extension at runtime, so the string scan below can't see it). Literal maps only; comment lines skipped.
    if (ext === ".js" && !/^vendor[\\/]/.test(path.relative(www3d, file))) {
      for (const m of src.matchAll(/registerModels\(\s*\{([^}]*)\}/g)) {
        const lineStart = src.lastIndexOf("\n", m.index) + 1;
        if (/^\s*(\/\/|\*)/.test(src.slice(lineStart, m.index))) continue;
        for (const p of m[1].matchAll(/[\w$]+\s*:\s*["']([\w-]+)["']/g)) need(path.join(www3d, "assets", p[1] + ".glb"), file, "registerModels");
      }
    }
    // (vendored three.js: imports only — its doc comments are full of example paths)
    if ((ext === ".js" || ext === ".mjs") && !/^vendor[\\/]/.test(path.relative(www3d, file))) {
      for (const m of src.matchAll(STR_RE)) {
        const u = m[2];
        if (importSpecs.has(u) || isExternal(u)) continue;
        // a bare word like "photo.png" in a download name isn't a URL the game fetches
        if (!/^\.{0,2}\//.test(u) && !u.includes("/")) continue;
        const target = path.resolve(pageDir, u);
        if (!inside(target)) { problems.push(`${path.relative(OUT, file)} → "${u}" points outside www/`); continue; }
        need(target, file, "path string");
      }
    }
  }
  // Pages linked from the 3D game by location.href (not caught above: they're
  // assigned, not imported) — and the forwarder's own target.
  need(path.join(OUT, "classic.html"), path.join(www3d, "js/core/screens.js"), "⚙️ More → Classic 2D");
  need(path.join(OUT, "3d", "index.html"), path.join(OUT, "index.html"), "forwarder → 3d/");
  // The classic page's own files.
  const classic = fs.readFileSync(path.join(OUT, "classic.html"), "utf8");
  for (const m of classic.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
    if (!isExternal(m[1])) need(path.resolve(OUT, m[1]), path.join(OUT, "classic.html"), "tag");
  }
  // Leftovers that must NOT ship.
  for (const f of walk(OUT)) {
    const rel = path.relative(OUT, f).split(path.sep).join("/");
    if (/^3d\/(blender|docs)\//.test(rel) || /\.(md|blend\d*|py)$/i.test(rel)) problems.push(`must not ship: ${rel}`);
  }
  return { problems, scanned };
}

// ── the bundle's own file list (www/ota-build.json) ────────────────────────
// Every staged file with its SHA-256 + size, plus the commit it was built from and the native version it
// needs. Two readers: the in-app updater (3d/js/features/native/ota.js — the BUNDLED copy's list is what the
// phone already has, so an update downloads only files whose fingerprint isn't in it) and the stable-channel
// publisher (scripts/ota-channel.js — it publishes exactly this list for a green commit). A www/ path is the
// same path in the repo (www/3d/x ← 3d/x, www/x ← x), so a file can be fetched pinned to its commit.
const OTA_FILE = "ota-build.json";
function writeBuildList() {
  const files = {};
  let bytes = 0;
  for (const f of walk(OUT).sort()) {
    const rel = path.relative(OUT, f).split(path.sep).join("/");
    if (rel === OTA_FILE) continue;
    const buf = fs.readFileSync(f);
    files[rel] = [crypto.createHash("sha256").update(buf).digest("hex"), buf.length];
    bytes += buf.length;
  }
  let commit = process.env.GITHUB_SHA || process.env.CM_COMMIT || "";
  try { commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || commit; } catch (e) { /* not a git checkout */ }
  let committed = "";
  try { committed = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch (e) { /* not a git checkout */ }
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  // the page the iOS app opens first (capacitor.config.json › server.appStartPath): every copy must have it
  const startPath = ((JSON.parse(fs.readFileSync(path.join(ROOT, "capacitor.config.json"), "utf8")).server || {}).appStartPath || "/index.html");
  const list = { schema: 1, commit, committed, startPath, appVersion: pkg.version, minNative: (pkg.ota && pkg.ota.minNative) || pkg.version, bytes, files };
  fs.writeFileSync(path.join(OUT, OTA_FILE), JSON.stringify(list));
  return list;
}

const stats = stage();
const built = writeBuildList();
const { problems, scanned } = checkRefs();
if (!built.files[built.startPath.replace(/^\//, "")]) problems.push(`the iOS start page ${built.startPath} (capacitor.config.json › server.appStartPath) is not in www/`);
const mb = n => (n / 1048576).toFixed(1) + " MB";
console.log(`copy-web: staged ${stats.files} files (${mb(stats.bytes)}) into www/ — 2.0 (3D) at www/3d/, classic 2D at www/classic.html`);
if (stats.skipped.length) console.log(`copy-web: left out ${stats.skipped.length} dev-only file(s) (${stats.skipped.slice(0, 4).join(", ")}${stats.skipped.length > 4 ? ", …" : ""})`);
console.log(`copy-web: checked the references in ${scanned} 3D file(s)`);
const bad = stats.missing.map(f => `missing source file: ${f}`).concat(problems);
if (bad.length) {
  console.error("\ncopy-web: ✗ THE APP BUNDLE IS BROKEN — " + bad.length + " problem(s):");
  for (const p of bad) console.error("  ✗ " + p);
  process.exit(1);
}
console.log(`copy-web: wrote www/${OTA_FILE} (${Object.keys(built.files).length} files, commit ${(built.commit || "?").slice(0, 7)}, needs app ${built.minNative})`);
console.log("copy-web: ✓ every referenced file is in www/");
