// Stage the static web assets into www/ so Capacitor can bundle them into the
// native app. Run after `node build.js`. This keeps the native bundle free of
// node_modules / src / .git / tooling — only the actual runtime files ship.
//
// The web + GitHub Pages deploy still serves straight from the repo root; www/
// exists ONLY for the native wrapper and is gitignored (regenerated on build).
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "www");

// Everything index.html actually loads at runtime.
const ASSETS = [
  "index.html",
  "game.js",
  "style.css",
  "manifest.webmanifest",
  "icon-192.svg",
  "icon-512.svg",
  "lulu.mp3",
  "dina.mp3",
  "avigail.mp3",
  "parking.mp3",
  "salon.mp3"
];

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const f of ASSETS) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(OUT, f));
    copied++;
  } else {
    console.warn("copy-web: WARNING missing asset " + f);
  }
}
console.log("copy-web: staged " + copied + "/" + ASSETS.length + " files into www/");
