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
| `08b-foot-world.js`      | **Lulu on Foot** — GTA-lite walking world when her car is wrecked. Foot mode (`state === "footRun"`) **reuses the real driving sim** — `updatePlaying`/`drawPlaying` branch on `onFoot = (state === "footRun")`, so NOTHING is missing (all traffic/cops/animals/toll/train/parade/signs/coins). She walks (run/slow on the LEFT) the full width incl. sidewalks, is **NOT invincible** (clipped by a car → `footKnockout`, lose a life, 0 → game over). Hand button (RIGHT / `E`) does context interactions: talk to peds, pet animals, ENTER buildings (→ interiors), BORROW a parked car (→ driving; in front of a cop → `beginCopChase`). Smooth no-tap intro. This fragment is the foot LAYER only (`updateFootExtras`/`drawFootWorld`/`drawFootHUD`/`drawFootIntro`/`footKnockout`) + the `footInterior` dispatch contract |
| `08c-foot-bar.js`        | Foot interior: **the bar** ("The Thirsty Scholar") — bartender, drunk flirts, jukebox dance, passed-out guy, bouncer |
| `08d-foot-school-hospital.js` | Foot interiors: **school** (cheder hallway — morah, kids, bake sale) + **hospital** (waiting room — receptionist, hypochondriac, doctor, vending machine, Heshy) |
| `08e-foot-police-beach.js` | Foot interiors: **police precinct** (desk cop / impound, holding cell, most-wanted board, coffee) + **beach** (boardwalk — lifeguard, ice-cream stand, seagull, sandcastle, Heshy) |
| `09-dina-home-morgan.js` | Dina's bedroom, home-object routing, Morgan plushie scene |
| `09b-sticker-book.js`    | Sticker Book minigame (spend ⭐ stars to decorate a scrapbook) |
| `10-dina-nap-salon.js`   | Dina nap, Avigail scene (randomized), salon scene |
| `10b-cookie-catch.js`    | Cookie Catch minigame (Dina's bedroom snack activity) |
| `11-game-loop.js`        | main gameLoop + init + IIFE close |

## Testing

Syntax / sync check: `node build.js --check`.
For behavior, serve locally (`http-server -p 8099 -c-1`) and drive the canvas
in a browser — scenes are click/keyboard driven.
