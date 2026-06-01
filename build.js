// Build game.js from ordered src/ fragments.
//
//   node build.js          -> regenerate game.js
//   node build.js --check  -> verify game.js is in sync (exit 1 if stale)
//
// Fragments are exact line-slices of the game body; joining them with "\n"
// reproduces the original source verbatim. A banner comment is prepended so
// nobody hand-edits the generated file.
const fs = require("fs");
const path = require("path");

const BANNER =
  "// ⚠️ GENERATED FILE — do not edit directly.\n" +
  "// Edit the fragments in src/ and run `node build.js`.\n";

function assemble() {
  const files = fs.readdirSync("src").filter(f => f.endsWith(".js")).sort();
  const body = files.map(f => fs.readFileSync(path.join("src", f), "utf8")).join("\n");
  return { body, files };
}

const { body, files } = assemble();
const out = BANNER + body;

if (process.argv.includes("--check")) {
  const cur = fs.existsSync("game.js") ? fs.readFileSync("game.js", "utf8") : "";
  if (cur !== out) {
    console.error("game.js is OUT OF SYNC with src/. Run: node build.js");
    process.exit(1);
  }
  console.log("game.js in sync (" + files.length + " fragments).");
} else {
  fs.writeFileSync("game.js", out);
  console.log("built game.js from " + files.length + " fragments (" + body.split("\n").length + " lines).");
}
