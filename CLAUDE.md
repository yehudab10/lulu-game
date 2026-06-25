# Lulu's Road Trip — dev notes

A single-page HTML5 canvas game (Sneaky-Sasquatch-style driving + minigames),
served statically via GitHub Pages → **lulu.boats**. No framework, no bundler.
`index.html` loads exactly one script: `game.js`.

## ⚠️ game.js is GENERATED — do not edit it directly

The real source lives in **`src/`**, split into ordered fragments. `game.js` is
assembled from them by `build.js`:

```
node build.js          # regenerate game.js from src/   (run after editing src/)
node build.js --check   # exit non-zero if game.js is out of sync with src/
```

How it works:
- `src/*.js` are concatenated **in filename order** (numeric prefixes matter)
  inside a single shared scope, exactly as the old single file. A fragment is a
  raw slice of the program, not independently valid JS on its own.
- The concatenated body is byte-for-byte identical to the original single file
  (plus a banner comment at the top), so the split has **zero runtime effect**.
- After editing anything in `src/`, run `node build.js` and commit **both**
  `src/` and the regenerated `game.js`.
- `split.js` is the one-time carving tool used to create the split; you won't
  normally need it again.

## Fragment map

| file | contents |
|------|----------|
| `01-engine-core.js`      | constants, skins, save system, audio, canvas/input, math/draw utils, particles, decorations, road |
| `01b-spawn-tuning.js`    | **SPAWN_CONFIG** — easily-editable rarity/timing for random roadside events (parking, Avigail, salon, sasquatch, Heshy pool, hearts) + `tickSpawn` |
| `02-art-vehicles.js`     | Lulu's car art + enemy cars, obstacles, pedestrians, animals, missiles, signs, sasquatch, cop car |
| `03-art-parking-hud.js`  | parking-scene art, security camera, damage decals, buttons, HUD, parking level config |
| `04-parking-logic.js`    | resetGame, spawners, parking minigame setup/update/result, challenge flow |
| `05-driving-loop.js`     | updatePlaying + paused/crash/gameover/menu/shop updates, drawPlaying, drawCrash |
| `06-screens.js`          | parking/paused/gameover/menu/shop draws, shop cards, Lulu/Dina portraits |
| `07-dina-world.js`       | character select, Dina/mom top-down sprites, school bus intro |
| `08-dina-run.js`         | Dina's run-home scene + hazards + dinaCaught ending |
| `08b-foot-world.js`      | **Lulu on Foot** — on-foot playthrough when her car is wrecked: run to Bubbe's for Shabbos managing a stamina bar, dodging pedestrian hazards, Mom's-minivan climax. Entered from the crash reprieve, a parking-sim crash, and 10% of cop pull-overs. WIN → back to driving; LOSE → game over |
| `09-dina-home-morgan.js` | Dina's bedroom, home-object routing, Morgan plushie scene |
| `09b-sticker-book.js`    | Sticker Book minigame (spend ⭐ stars to decorate a scrapbook) |
| `10-dina-nap-salon.js`   | Dina nap, Avigail scene (randomized), salon scene |
| `10b-cookie-catch.js`    | Cookie Catch minigame (Dina's bedroom snack activity) |
| `11-game-loop.js`        | main gameLoop + init + IIFE close |

## Testing

Syntax / sync check: `node build.js --check`.
For behavior, serve locally (`http-server -p 8099 -c-1`) and drive the canvas
in a browser — scenes are click/keyboard driven.
