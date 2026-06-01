// One-time splitter: carve game.js into ordered src/ fragments.
// Safe by construction — fragments are exact line-slices; concatenation is
// byte-identical to the original. Cut points are all verified top-level
// function starts so whole functions stay intact in one file.
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync("game.js", "utf8");
const lines = SRC.split("\n");

// [name, startLine, endLine] inclusive, 1-based.
const groups = [
  ["01-engine-core.js",   1,    942],   // constants, save, audio, input, utils, particles, decorations, road
  ["02-art-vehicles.js",  943,  2122],  // Lulu's car + enemies, obstacles, pedestrians, animals, signs, NPCs
  ["03-art-parking-hud.js", 2123, 3139],// parking-scene art, camera, damage, buttons, HUD, level config
  ["04-parking-logic.js", 3140, 3843],  // resetGame, spawners, parking minigame update/result/flow
  ["05-driving-loop.js",  3844, 4658],  // updatePlaying + paused/crash/gameover/menu/shop updates, drawPlaying/drawCrash
  ["06-screens.js",       4659, 5592],  // parking/paused/gameover/menu/shop draws, portraits
  ["07-dina-world.js",    5593, 6398],  // character select, Dina/mom top-down, school bus intro
  ["08-dina-run.js",      6399, 7125],  // Dina's run-home scene + dinaCaught ending
  ["09-dina-home-morgan.js", 7126, 7859],// Dina's bedroom, scene routing, Morgan plushie
  ["10-dina-nap-salon.js",7860, 8649],  // Dina nap, Avigail scene, salon scene
  ["11-game-loop.js",     8650, lines.length], // main gameLoop + init + IIFE close
];

if (!fs.existsSync("src")) fs.mkdirSync("src");

let cursor = 1;
for (const [name, start, end] of groups) {
  if (start !== cursor) {
    console.error("GAP/OVERLAP before " + name + ": expected " + cursor + " got " + start);
    process.exit(1);
  }
  fs.writeFileSync(path.join("src", name), lines.slice(start - 1, end).join("\n"));
  cursor = end + 1;
}
if (cursor - 1 !== lines.length) {
  console.error("COVERAGE MISMATCH: covered " + (cursor - 1) + " of " + lines.length);
  process.exit(1);
}
console.log("wrote " + groups.length + " fragments, lines 1.." + (cursor - 1));
