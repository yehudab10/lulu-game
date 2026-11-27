# Lulu's Road Trip 3D — architecture & feature contract

The 3D game (`3d/`, live at lulu.boats/3d) is plain ES modules + a vendored
three.js r170 — no bundler, no build step. The core is small; **everything
else is a feature module** that plugs in through `js/core/ctx.js`.

```
3d/
  index.html  style3d.css                   page + HUD markup + base styles
  js/main.js                                tiny bootstrap: WebGL check → import app.js (else index.html's fallback card)
  js/app.js                                 renderer, boot, main loop, settings
  js/core/ctx.js                            ctx object, events, hooks, states, menus, actors
  js/core/save.js                           3D save, per-feature store(), SHARED 2D save + wallet
  js/core/driving.js                        run lifecycle, driving sim, damage/wreck, coins, states intro/playing/wrecked/gameover
  js/core/camera.js                         chase / far / Lulu's-eyes cams + cinematic()/follow() helpers
  js/core/screens.js                        title, pause overlay, controls, settings
  js/core/dialog.js                         visual-novel dialogue box: say() / choose() / script()
  js/core/people.js                         animate Blender-built people (walk, wave, talk, cheer, sit, dance)
  js/core/sets.js                           self-contained 3D scenes for interiors/minigames (makeSet, makeRoom, textPlane)
  js/core/platform.js                       PS5 / console / TV detection, TV mode
  js/features/dualsense/                    DualSense light bar + adaptive triggers + heart LEDs (WebHID)
  js/features/native/                       the iOS app (Capacitor): AdMob + ATT, Taptic haptics — a no-op on the web
  js/features/heist/                        🏦 banks in the towns, cartoon robberies to foil, Lulu's own heist, road snatchers, the cops' stun nets + spike strips
  js/features/underworld/                   😈 crooked cops, Velvel's garage, the Fixer's jobs + heat, road-ragers / gang cars / pickpockets
  js/features/seasons/                      🕎 the world follows the real Hebrew calendar: menorahs in the windows, the Purim parade, sukkahs, …
  js/features/onegame/                      🎮 one game, not a menu of modes: the 🧳 road trip / 🅿️ booth / Dina / Friday rush entered from the world, 🏠 home()
  js/features/airport/                      ✈️ the JFK exit (stage 1: its own interchange, the kerb loop, parking, the terminal outside, the tower, the runway fence + joke, planes overhead; polish: chase routes, kerb collisions, kerb security, a lighter LOW; ON since ci/exits2; ?airport=0 turns it off)
  js/features/cityhall/                     🏛️ city hall in each town (take-a-number, Permits · Taxes · Complaints, the mayor's office), the mayors + their ribbon cuttings
  js/spatial.js                             positional 3D audio (A.spatial): pooled panner voices, listener on the camera
  js/features/feel/                         sound kinds + passing whooshes + muffled music on foot; damage on Lulu's car
  js/features/life/                         🍃 ambient life: footsteps by surface, puddles after rain, wind (leaves, flyers, leaf piles), the neighbourhood's sounds; pigeons, chimney smoke + steam, car-alarm lights, friends' footsteps
  js/world.js  car.js  traffic.js           road + scenery chunks, Lulu's car, traffic
  js/input.js  audio.js  hud.js  models.js  controller/keyboard/touch, sound, HUD + menus, model loading
  js/features/<id>/index.js                 ← ONE DIRECTORY PER FEATURE (imported by features/index.js)
  blender/lib.py  lib_people.py             Blender helpers (meshes, materials, baking) + character builder
  blender/assets_<id>.py                    ← one Blender asset module per feature
  blender/make_assets.py                    runner → assets/<name>.glb + blender/blend/<id>.blend
  assets/*.glb                              exported models
scripts/smoke3d.js + scripts/tests3d/<id>.js  headless tests (one file per feature)
```

## Ground rules for feature work

* **Own your files**: `3d/js/features/<id>/**`, `3d/blender/assets_<id>.py`,
  `3d/assets/<your files>.glb`, `3d/blender/blend/<id>.blend`, `scripts/tests3d/<id>.js`.
  `features/index.js` already imports `./<id>/index.js` for every planned feature.
* **Don't edit core files** (`js/*.js`, `js/core/*`, `style3d.css`, `index.html`) unless
  there's truly no hook for what you need. If you must, keep it tiny and additive (a new
  optional parameter, a new hook call), never change existing behaviour, and list it in
  your final report. Prefer asking ctx for things over reaching into internals.
* Put your CSS in your feature via `css(id, text)` from ctx.js; your DOM in your own elements.
* **Every screen must work with a controller** (D-pad + ✕/A + ○/B — the PS5 DualSense is a
  first-class target), keyboard and touch. Use `<button>` (or `.nav`) elements inside
  `showScreen` cards — spatial navigation is automatic. Show prompts with `glyph(action)`.
* Everything in-world is 3D (three.js / Blender models), not 2D sprites. DOM is for HUD,
  menus and dialogue only.
* Port the 2D game's humour, names and story faithfully (it's in `src/*.js` — read the
  relevant fragment). Jewish-family warmth, gentle slapstick, nothing mean. Reuse its text.
* Keep it fast: instancing for repeated scenery, dispose what you create, lazy-load models
  your feature only needs in its own scenes (`ensureModels`), target 60 fps on a phone.
* Errors must never break the frame: listeners/hooks/actors are already wrapped, but guard
  your own async code.

## ctx — the shared context (`js/core/ctx.js`)

```js
import { ctx, on, emit, hook, registerState, setState, addMenuItem, addActor, removeActor, css, MPH, pick, rand, wrapAngle, fmtTime } from "../../core/ctx.js";
ctx.renderer ctx.scene ctx.camera ctx.lights{hemi,sun,sunOffset}   // the driving scene
ctx.world ctx.car ctx.traffic ctx.cam                                // created at boot (use them in on("boot") or later)
ctx.G            // per-run state: mode, hearts, maxHearts, coins, score, closeCalls, combo, boost, boosting,
                 // invT (invincible seconds), runTime, startS, distance, tickets, crashes… add your own fields in hooks.runStart
ctx.state ctx.stateT ctx.stateData ctx.paused ctx.dialogOpen ctx.time ctx.frames ctx.TEST ctx.tv ctx.platform
ctx.view         // null → render the driving scene; {scene,camera} → render your set instead
ctx.trip         // { label(), progress() } for the HUD trip bar (journey owns it)
```

### Events (`on(name, fn)` / `emit(name, payload)`)
| event | payload | when |
|---|---|---|
| `boot` | ctx | world/car/traffic exist — do world setup (signs, reserve, biomes) here |
| `state` | {from,to,data} | after every state change |
| `run:start` / `run:end` | {mode,opts} / {reason,score,coins,distance,G} | run lifecycle |
| `coin` | {n, why} | coins earned (also added to the wallet) |
| `closeCall` | {oncoming, combo} | near miss |
| `crash` | {impact, kind, car?, collider?, actor?} | any bump (impact in m/s) |
| `damage` | {power, why, source} | a heart was lost |
| `wreck` | {why, source} | out of hearts (before the wrecked state) |
| `knockout` | {n, banked, fee, where: car \| foot \| scene, why, source} | out of hearts was a KNOCK-OUT: the cost was just applied (see Run API) |
| `score:bank` | {reason, score, best, G} | a knock-out banked the score so far (best + lifetime); the score starts over |
| `heart` | {n} | healed |
| `speedTrap` | {mph, ticketed, trap, handled} | passed a parked cop — set `handled = true` to take over |
| `honk` / `boost` | {} | player honked / started nitro |
| `stat` | {id, n} | generic lifetime counter (meta/scrapbook listens) — emit your own! |
| `chunk:build` / `chunk:dispose` | {chunk, world, rnd, s0, s1, biome} | a 200 m road chunk was built / recycled |
| `title` `pause` `quit` `pad` `device` `skin` `wallet` `shared:changed` | | UI-level |

### Hooks (`hook(name, fn, priority)` — higher priority runs first)
| hook | signature | use |
|---|---|---|
| `controls` | (ctl, dt) | mutate `{steer, throttle, brake, handbrake}` before physics (Ima's call flips steering) |
| `update` | (dt, P, controlsOn) | every frame of the driving sim (playing/intro/wrecked/arriving) |
| `damage` | (info) → `false` vetoes | shields, invincibility items |
| `wreck` | (info) → `true` claims | out of hearts, after a ~1 s spin-out: an arrest (law), now and then the crash comedy (cameos)… (first claimer wins; return true only when you take over). Unclaimed = core's knock-out: back on her feet beside her car |
| `runStart` | (G, opts) | add run fields, set `G.goText`, pick biomes |
| `hud` | (dt) | every frame while the driving HUD shows |
| `titleCamera` | (dt, camera) → true | own the title-screen camera |
| `prerender` | (dt, camera) | right before the driving scene is drawn, every frame in every state (app.js `present`): pack what's in view (atmos' street lamps) |

### States
```js
registerState("myScene", {
  hud: false,        // driving HUD (hearts/coins/speedo/trip)
  touch: false,      // driving touch controls (stick + pedals)
  pausable: true,    // Start/Esc/❚❚ opens the pause overlay (ctx.paused; your update() stops)
  driving: false,    // true = this is a driving state (camera cycles with △/Y, Restart in pause)
  world: true,       // keep streaming/animating the road world (ignored while ctx.view is set)
  enter(data, prev) {}, exit(next) {},
  update(dt, P) {},  // P = edge-triggered input this frame (see Input)
  camera(dt) { return true; },   // own the driving-scene camera (cutscenes); omit for default
  skip: true,        // a CUTSCENE: show the ⏭ Skip pill (or a () => bool, e.g. only some phases)
  onSkip() {},       // optional: called when the player skips (for anything waiting on real time)
});
setState("myScene", { any: "data" });
```
**⏭ Skip** (`core/skip.js`): in a `skip` state the player can hold ○/B (Backspace), click the
pill, or pick "Skip this scene" in the pause menu. Skipping FAST-FORWARDS your scene behind a veil
(many game-time steps per frame, dialogue lines advance themselves) so every side effect still
happens in order; it stops at a `choose()`, a `showScreen` card, a state change, or when `skip()`
turns false. So: time your beats in GAME time (`ctx.time`/`dt`, a Flow's `sleep`), not
`setTimeout`. A cutscene inside another state: `ctx.cutscene.begin(id, {onSkip})` … `end(id)`.
`ctx.skipping` is true meanwhile (keep sound effects quiet).
Built-in: `title`, `intro` (3-2-1), `playing`, `wrecked` (the ~1 s spin-out before a knock-out), `gameover` (a card — no longer
reached by running out of hearts, or by parking: the 🅿️ challenge ends with the attendant's board on the lot), parking's `parking` (a driving state: the challenge on a rest area's lot), world's `worldPullOut` (pulling out of the
home driveway — a driving state with its own camera until she's on the street), `worldHomeBeat` (the day's ending at home → back on her feet at home, `ctx.onegame.home`), plus journey's
`arriving` / `arrivedScreen`. To drive the car from your state call
`updateDriving(dt, P, controlsOn, ctlOverride)` from `core/driving.js`.

### Menus
`addMenuItem("title" | "pause" | "settings" | "titleInfo" | <your own>, { id, order, label, visible, action, group, sub, short })`.
**ONE GAME, NOT A MENU OF MODES** (roadmap 10, the owner 2026-11-20: "too many modes is too confusing… the main thing
should be the open world"). **Don't add a play mode to the title** — add a place / a ✋ spot / a 📱 app in the world
(`features/onegame` shows how), and end it back in the world (`ctx.onegame.home()`), not on the title.
**The home screen is grouped** (keep it uncluttered — don't add info lines or buttons to the home card):
- The hero is core's **▶ PLAY** (`id: "play"`, order 5): `startRun({ mode: "cruise" })` — the open world, starting at
  home on foot; never locked (the old "Cruise unlocks at Bubbe's" gate is gone). Its subtitle: the first non-empty
  `addPlaySub(fn, priority)` line (`core/screens.js`; shabbos: "🕯️ Erev Shabbos!" on a Friday afternoon) or a default.
- Under it, at most `PLAY_TILES` (2) small tiles from the other `"play"` items: `TILE_FIRST` ids first
  (`friends` / `party` — 👯 Friends, owned by `ci/everyone` — then `dina`), then by order. **There is no "More to play"
  overflow**: any further `"play"` item is listed under ⚙️ More (`T.overflow`).
- other title `group`s: `"garage"`, `"book"` (scrapbook) or `"more"` (each a soft tile that opens a tabbed sub-menu;
  L1/R1 switch tabs, ○ backs out). Without `group`, the order decides: < 70 play · 70–79 garage · ≥ 80 more.
  `sub` = a subtitle line (string or fn); `short` = the name in its group tile's summary.
- Title order guide: 5 ▶ PLAY · 12 🗺️ story map (book) · 30 shop · 32 car · 35 Dina · 50 scrapbook ·
  55 quests · 57 💼 side jobs (book) · 60 🎉 party / 👯 Friends (Shared Road lives inside its hub) · 65 📸 photo · 72 distracted · 80 settings · 86 controls · 99 2D.
  (Gone from the title, entered in the world instead — `features/onegame`: 📖 Story Trip → the 🧳 suitcase / 📱 🗺️ Map
  app (tap a stop); 🛣️ Cruise → ▶ PLAY; 🅿️ Parking Challenge → pull into the START box at a rest area's course (the booth's ✋ unlocks it, the 📱 💼 Jobs card marks it); the 🕯️ Friday chip → Ima at the door.)
- `titleInfo` items: `bar: true` (a chip in the home top bar — bar orders: 5 holiday · 6 streak), `for: "<item id>"` (appended to that item's
  subtitle) or `group: "<group>"` (a line atop that sub-menu); otherwise a small note at the foot of the home card.
- pause `group`: `"main"` (full width), `"tools"` (2-column grid) or `"exit"` (quiet bottom row); default by
  order < 10 main · 10–69 tools · 70–89 main · ≥ 90 exit.
- The layout picks the colours: `cls` is ignored on the title and pause menus (it still works on your own
  `showScreen` buttons). A `settings` event {id} fires after any settings change.
- Tests: `__lulu3d.openMenuItem(menu, id)`, `revealMenuItem("title", re)`, `titleLabels()`, `openView(view)`;
  the harness's `t.click(re)` reveals items tucked in groups, `t.titleItems()` lists every title label.

### Actors (things on the road)
```js
addActor({ update(dt) { …; return stillAlive; }, collide(car) { return hit ? { impact, why, source, harmless } : null; }, dispose() {}, foot: false });
```
Core calls `update` every driving frame (and on foot if `foot: true`) and turns
`impact > 6.5` into lost hearts. Actors are cleared at every run start.

## Run API (`js/core/driving.js`)
`startRun({mode, s})`, `resetRun(opts)`, `endRun(reason)`, `damage(power, why, source)`,
`wreck(why, source)`, `heal(n)`, `addCoins(n, why)` (HUD + shared wallet),
`addScore(n, why)`, `updateDriving(...)`, `updateActors(dt, onFoot)`, `roadPos()`,
`autoDrive(dt, d, speed)` (returns a ctl that steers along lane d), `statsHtml(extra)`, `MAX_HEARTS`.
A `runStart` hook may set `G.introStart = opts => bool` (world: the run starts ON FOOT at home — it sets the state
itself; `false` = it couldn't, count down) or `G.introState = "<state>"` to replace the 3-2-1 countdown;
`startRun({ quick: true })` asks for the plain countdown. `startRun` ends a run that's still going first
(`endRun("restart")`), and going to the title ends it too (`endRun("quit")`) — with no game-over card those are where
`run:end` fires for an endless Cruise.
**No game over — the knock-out** (`KO`, `knockout(info, {fee, hearts, where})`, `bankScore(reason)`,
`recoverFromWreck(info)`): out of hearts in the car = `wreck` → ~1 s spin-out (`KO.spin`) → `hooks.wreck` claimers →
otherwise `recoverFromWreck`: the cost, then `ctx.foot.start("knockout")` (she climbs out beside her patched-up,
drivable car; ✋ back in) — or, with no foot feature, back in her lane rolling. Out of hearts ON FOOT = foot's
knock-out (she sits up seeing stars and walks on; ~1 in 5 the ER instead). **What it costs (the rule):** the score
so far is banked (best + lifetime + the scoreboard, `score:bank`) and starts over (combo too); hearts go back to full;
a tow &amp; patch-up fee of `KO.feeBase` (10) + `KO.feeStep` (5) per earlier knock-out this run, capped at `KO.feeMax`
(30) and never more than she has (the ER's bill replaces it; Hillel's insurance claim waives it). Nothing about it
pays coins, and nothing resets a run's caps (G is NOT reset — couch coins, robbery caps, the one-a-run insurance
payout stay spent). A cop's wreck is still law's arrest; warrants / fines / bail are untouched.
**Paved ground off the highway** — `paved` (an array) / `pavedAt(s, d)` (the registry lives in `world.js`; `driving.js`
re-exports it): features push predicates `(s, d) → 0 | 1 | 2 | 3` in highway road coords (ignored in a district).
2 = asphalt: the car drives it like road (no grass drag, no shoulder rumble — a rest area's lot); 3 = a LANE off the highway
(an exit's decel / accel lane, a ramp, a painted gore, a cross road, a lot's drive aisle): asphalt too, and **nothing may stand
on it**; 1 = walkable grounds (a lawn: grass for the car, but foot's bounds skip the tall grass / mud / fence there, zone
`"grounds"`). **The rule for anything placed beside the road: check `offLanes(s, d, halfD, halfS)` (world.js) first** —
`Chunk.addSign` does it for every sign (one that would stand on a lane slides out past the asphalt; `sign.builtD` = where it
went), roadevents' zones slide past interchanges and rest areas, and `exits.js` / `midwood.js`… scan their layouts in tests.

## Saves (`js/core/save.js`)
* `store("myFeature", defaults)` → your persistent object (3D save). Call `saveSoon()` after changing it.
* `save3d.settings` — quality, vibration, invertLook, steerSens, calm, tv, hud.
* **`shared`** = the 2D game's save (`localStorage.luluSaveV2`). Shared across versions — use it
  for anything the 2D game also has: `totalCoins` (use `wallet`), `ownedSkins`, `selectedSkin`,
  `missiles`, `pepperSpray`, `shields`, `distractedUnlocked`, `horn`, `ownedHorns`, `decor`, `ownedDecor`,
  `luluHair`, `luluHairStyle`, `avigailRel` (0–100), `postcards`, `storyStop`, `storyCycle`,
  `storyStars`, `parkingBestLevel`, `parkingTotalStars`, `convictions`, `offenses`, `erVisits`,
  `stats`, `badges`, `quests`, `stickerBook`, `dinaBest`, `cookieBest`, `streak`, `dayNum`…
  (see `defaultSave()` in `src/01-engine-core.js`). Read with `shared.get()` (fresh copy, don't
  cache), write with `shared.update(s => { s.missiles++; })` (read-modify-write, safe with an open 2D tab).
  `shared.stat(id, n)` / `shared.best(id, v)` feed the 2D scrapbook's `save.stats`.
* `wallet.coins`, `wallet.add(n)`, `wallet.spend(n) → bool`.
* **`ctx.player`** (`js/core/player.js`) — ONE player identity for every online feature (👯 friends, 🏘️ the property
  registry): `id()` a random public id (16 base32 chars, made on first use, nothing personal) · `secret()` a separate
  192-bit secret that leaves the device ONLY to prove "I am id X" to a server keeping its hash (never in a party / Shared
  Road / friends message) · `label()` "Kugel Kid #37" (the shared save's `mpName` + `#` + a number from the id;
  `setLabel(l)` caches one a server handed out) · `backup.code()` / `restore(code)` = the scrapbook's 💾 save code (a
  restore replaces the id + secret too: a new phone is the same player) · `backup.add(section, get, set)` a feature's own
  little section (snapshotted by `saveToCode`, handed back on the first boot after a restore). Stored as
  `save3d.player = { id, secret, made, label?, sx? }`.

## Models & Blender
* JS: `registerModels({ key: "file_name" }, { preload })` at import; `await ensureModels([...])`
  before use; `models[key]`; `cloneWithColors(models.key, { MatName: "#hex" })`;
  `instanced(template, n, tintMatNames)`; `findNodes(root, "NamePrefix")`.
  Preload only what driving needs (set pieces built in `chunk:build`); lazy-load scene models.
* Blender: create `3d/blender/assets_<id>.py`:
  ```python
  from lib import *
  from lib_people import build_person
  def setup(): pass                       # optional; runs after lib.reset()
  def build_heshy_pool(): coll = scene_coll("HeshyPool"); root = root_empty(coll, "HeshyPool"); …; bake(parts, "HeshyPool_body", coll, parent=root); return coll
  ASSETS = [("heshy_pool", build_heshy_pool), ("heshy", lambda: build_person("Heshy", dict(hair="short", extras=["kippah"], …)))]
  ```
  Build: `<bpy-python> 3d/blender/make_assets.py --only <id>` (bpy venv:
  `/tmp/claude-0/-home-user-lulu-game/42007f9f-6ed4-510c-86fb-af583029b013/scratchpad/bpyenv/bin/python`).
  Only rebuild YOUR module. Helpers: `Part(coll, name, bm, material, loc, rot, smooth)` with
  `.bevel(w, segs)` / `.cut(cutterPart)`, `bm_box/bm_cyl/bm_sphere/bm_ico/bm_torus/bm_prism/bm_text`,
  `limb(a, b, r)`, `bake(parts, name, coll, parent)` (joins → 1 object, N materials = N draw calls),
  `bake_at(..., pivot)` (origin at a joint), `anchor(coll, root, name, loc)`, `mat(name, "#hex", rough, metal, emit)`,
  `shared()` (Tire, Chrome, Glass, Headlight…), `wheel/four_wheels`, `house_parts` (in assets_core).
* Conventions: metres; FRONT = Blender −Y (= +Z in three.js); y-up export; materials are
  matched by NAME at runtime (Paint/Body/Walls/Roof are recolourable; Glass* transparent;
  Water* translucent; Headlight/Taillight/LightRed/LightBlue/Neon* emissive & animatable).
* People: `build_person(name, spec)` → Body + Arm_L/Arm_R (shoulder pivot) + Leg_L/Leg_R (hip pivot).
  Animate with `spawnPerson(key, {colors, scale})` → `person.update(dt, {walk, wave, talk, cheer, sit, point, dance})`, `person.face(x, z, dt)`.
  Core already has `luluPerson`, `dinaPerson` (preloaded) and, lazily (`ensureModels`), the recurring cast
  `avigailPerson`, `heshyPerson`, `imaPerson`, `copPerson`, `hillelPerson` plus townsfolk `npcWoman`, `npcMan`,
  `npcKid` (recolour `Top`/`Bottom`/`Hair` for crowds). **Use these for the recurring characters** so Avigail,
  Heshy, Ima, cops and Hillel look the same in every feature. Prefix your own model keys/files with your
  feature id (`law_judge`, `garage_unicorn`) so they never collide.

## World (`js/world.js`)
* Road coordinates: `s` = metres along the road, `d` = metres to the RIGHT of the centre line.
  Our lanes `d = +1.75, +5.25`; oncoming `−1.75, −5.25`; asphalt `|d| ≤ 7`; shoulder to 8.8.
  `road.point(s, d) → {x, z, h}`; `road.at(s)`; `road.nearest(x, z, hintS) → {s, d, h}`.
  Heading h: forward = (sin h, cos h); right = (−cos h, sin h). `facingRoad(h, side)` = rotation.y
  for a model whose front faces the road from side ±1.
* `on("chunk:build", ({chunk, world, rnd, s0, s1, biome}) => …)` — add set pieces inside [s0, s1):
  `chunk.add(obj)`, `chunk.addMesh(geo, mat)`, `chunk.own(disposable)`, `chunk.addCollider({x, z, r, kind, onHit?(impact) → false to ignore})`,
  `chunk.onAnimate(t => …)`, `chunk.sign(world, def)`, `chunk.coins` (push `{x, z, s, d, taken, value}` before end of build).
  Chunks are recycled ~160 m behind the car; the same chunk is rebuilt identically (seeded `rnd`).
* `world.reserve(s0, s1, side, dMin, dMax)` keeps random trees/houses/poles out of a stretch.
* **Districts** (features/town): `world.setDistrict({ road, chunks, ground })` takes the player off the
  highway into a separate street network in the same scene. While one is set, `world.road` IS the
  district's road (same `at / point / nearest` API, `s`/`d` along whichever street she's on),
  `activeChunks()` yields the district's chunk-likes (`{s0, s1, colliders, coins, hearts, traps}`),
  the highway's chunks stay built but hidden and stop streaming, and `traffic.road` follows
  `world.road`. `world.highway` is always the highway's Road; `setDistrict(null)` puts everything back.
  So code that asks `ctx.world.road` keeps working in a town; code that needs highway-only
  behaviour checks `ctx.town && ctx.town.active`. `keepHighway: true` (a town ATTACHED to the highway, see Towns): the
  highway's chunks stay drawn (culled to the fog like on the road — `world.cullChunks` — and hidden behind the town's
  blocks: `district.see(chunk)`), and with `highwayS` the highway keeps streaming round that s, every chunk in slices (a
  warp into an attached town lands with nothing built there; `chunk:build` listeners that skip districts must let a
  `keepHighway` one through — exitbuild / exits do).
* `world.addSign({s, d, lines:[...], bg, fg, w, h})` before that chunk is built (in `boot` or ≥700 m ahead).
* `world.biomeAt = s => ({ ...world.defaultBiome(), trees: {...}, density, houses, houseModel, walls, roofs, poles, coins, ground: "#hex" })`.
* `registerScenery("palm", { model, collide, scale: [a, b], tint: [matNames], colors: {Mat: "#hex"} })` then use it in a biome's trees mix.
* `world.setSky({top, mid, bottom, fog, fogNear, fogFar})`; `ctx.lights.hemi/sun` for day/night.
* `world.config.speedTraps` (bool) — the built-in parked-cop speed traps.
* Exports for set pieces: `ribbon(road, s0, s1, d0, d1, y, vScale)`, `signTexture(lines, bg, fg, w, h)`,
  `worldMaterials()` (road, shoulder, drive, pole, metal, coin…), `canvasTex`, `mulberry32`, `HALF_ROAD`, `SHOULDER`, `LANE`, `CHUNK`.
* **A chunk is cheap by construction:** its trees, bushes, houses and power poles are baked by `js/merge.js`
  (`ChunkMerger`) into a few vertex-coloured meshes — one per look (roughness / metalness), split into
  shadow-casting (|d| ≤ 40 m) and not, leaves on their own look (they sway: `core/gfx.js`). Parts with a texture,
  transparency, a glow or an animatable name (Neon, LightRed…) stay instanced, so a feature's scenery keeps its look;
  `Window` parts merge into a look that SHARES the template window's emissive (atmos lights it). Shoulders and
  driveways are one mesh each, a sign is two (metal + face, one cached material per sign texture), a heart one.
  A chunk wholly beyond the fog (× `world.drawScale`, the tier's draw distance) isn't drawn (`noCull` if it holds a
  `fog: false` material).

## Graphics & performance (`js/core/quality.js`, `gfx.js`, `post.js`, `js/lod.js`)
* **Tiers** — ⚙️ Settings → 🖼️ Graphics cycles AUTO / HIGH / MEDIUM / LOW (`save3d.settings.quality`); `ctx.gfx`
  = `{ setting, tier, T, pixelRatio, info() }`. Read `ctx.gfx.tier` (or atmos' `quality()`), never the raw setting.
  LOW: no shadow map (blob contact shadows instead), 65 % draw distance + the fog pulled in to match, LOD from 40 m,
  30 % particles, no headlight spot, no sway / reflections / bloom, pixel ratio 1. MEDIUM: 1024 shadows over ±38 m,
  85 % draw distance, LOD 55 m, sway + reflections, ≤ 1.5 px ratio. HIGH: 2048 shadows, all of it,
  bloom. AUTO guesses from the GPU / device (software GL, old mobile GPUs, consoles / TVs → LOW; phones, tablets,
  integrated GPUs → MEDIUM; else HIGH — `?test` runs keep the desktop guess), then holds 60 fps: the pixel ratio
  slides between the tier's floor and cap, and when the floor isn't enough it steps a tier down for the session
  (a 30 fps-capped display isn't mistaken for a slow GPU). The `gfx` event fires after a change.
* **Far LODs** (`lod.js`): `farLod(obj)` → past `LOD.dist` the model shows ONE merged vertex-coloured mesh
  (traffic cars, the speed-trap cop); Headlight / LightRed / LightBlue / Neon / Glass parts stay real.
  `updateLods(camera)` runs before each render. Parts a feature adds later are never touched.
* **`core/gfx.js`** (before each driving render): contact shadows under Lulu's car + nearby traffic (one instanced
  mesh), the leaves' wind sway (stronger in rain), a PMREM of the current sky on car paint (`Paint` / `Body` /
  `CopPaint`…) and on the wet road (`ctx.atmos.wet`), the exposure lift at night. **`core/post.js`** (HIGH): a soft
  bloom on anything brighter than white (headlights, neon, windows, nitro, the sun) + the tone mapping. Only the scene goes
  through the public `renderer.render`; the bloom passes (and the PMREM rebuild) use `ctx.rawRender` and `renderer.info`
  is put back to the scene's numbers, so draw-call counts in tests / the perf harness are the game's. A `?test` run
  has no bloom unless it opts in with `&enable=bloom` (`gfx`, `perf` do): in software WebGL it nearly doubles the
  frame time. Test: `scripts/tests3d/gfx.js` (the setting by pad / keys / touch, saved + reloaded, each tier, bloom
  fallback, AUTO's step-down).
* **The sun's shadow** follows Lulu snapped to whole shadow texels (no shimmering edges).
* **Shadow proxies** (`lod.js` › `shadowProxy(root, { skip, lod })`, MEDIUM / HIGH): a multi-part model's shadow-casting
  parts are baked (positions only, in the root's space) into one mesh that is hidden in the main pass and switched on
  only inside `renderer.shadowMap.render` (`installShadowProxies`, app.js); the baked parts stop casting on their own.
  Same silhouette (a same-frame A/B is pixel-identical), one shadow draw instead of 10–25. Used by every traffic car
  (`Traffic.make`, with its far LOD: far = no shadow, as before), Lulu's car (body + rear wheels — NOT her, her hair,
  the steering wheel, the steered front wheels or anything on an `Anchor_*`), the towns' e-bikes, Lulu's house (not its
  `Deco_*` holiday pieces / anchors) and the title's lapping minivan (the title on MEDIUM: 108 → 69 shadow draws). A part that is
  hidden / removed / switched back to `castShadow` hands the casting straight back to the real parts (never a missing
  shadow) and the proxy re-bakes from what's there ~30 frames later. **Animated figures don't get one** (a baked pose
  would freeze their shadow). Adding parts to a proxied model later is fine (they cast on their own); `shadowProxyInfo()`
  / `shadowProxiesOn(false)` for tests. Note: `renderer.info.render.calls` never includes the shadow pass (three
  resets it after the shadow map) — the perf harness counts real WebGL draws (`gl`, `shadowGl`).
* **The clouds** (`world.clouds`) are 16 baked meshes, one per cloud (5 puffs each; was 80 meshes ≈ 10–22 draws whenever
  the sky shows, now ~3–6; each cloud is frustum-culled on its own — one mesh for the whole ring put all 6.4k cloud
  triangles on every frame); the group still turns / follows the camera and atmos tints their one shared material.
* **Before / after numbers + screenshots** of this work: `3d/docs/gfx-perf.md`.
* **Measure** with `node scripts/perf3d.js` (`scripts/tests3d/perf.js`; `--compare a.json b.json`; `PERF3D_TIER`,
  `PERF3D_DRIVE`, `PERF3D_TOP=1` lists what's on screen by draws): busy Cruise, a storm at night, a rest area,
  Lakewood, on foot, the bar, a 🌍 Free Roam convoy — draw calls, triangles, JS ms (update vs render), DOM
  mutations a frame — and a long drive that fails on geometries / textures / materials that leave the scene undisposed.
  Since `ci/perf`: `gl` / `shadowGl` (every real WebGL draw / the ones in the sun's shadow pass), render median / p90 /
  max, the scenes `highway` (1.5 km on — `cruise` is measured ~100 m from the start, by Lulu's house), `towndrive` /
  `townfoot` (Lakewood's Main St) and `middrive` / `midfoot` (Midwood's Avenue J), `PERF3D_TOP` also lists the shadow
  casters, and `PERF3D_PROFILE=1` adds a CPU profile + an allocation sample per scene (ms a frame by file / function,
  "(garbage collector)", KB allocated a frame).
* **Phone pass (`ci/perf`, 2026-11-21)** — `main` (ab85486) → `ci/perf`, measured back to back on the same machine with
  `node scripts/perf3d.js` (`PERF3D_ADD=all`: every feature on, like the real game; 40 frames a scene; 1280×720, software GL
  in the container). LOW draws no shadow map, so its `calls` are all its draws; MEDIUM's real draws are `gl` (`calls` + the
  sun's shadow pass, which `renderer.info` never counts). Render JS = the median ms three.js spends issuing a frame (× ~3–4
  on a mid-range phone; frame ms in software GL are noisy — compare the draws). LOW is batch 1; MEDIUM is batches 1 + 2.
  † re-measured with the same road events on both sides (a barrier set / a pedestrian / a billboard came and went between
  runs: ±40 draws of content).

  | scene | LOW draws | MEDIUM real draws (gl) | MEDIUM shadow-pass draws | MEDIUM render JS (median ms) |
  |---|---|---|---|---|
  | cruise (by Lulu's house) | 211 → 182 (−14 %) | 301 → 260 (−14 %) | 107 → 71 (−34 %) | 3.9 → 3 |
  | highway (open road) | 320 → 316 (−1 %) † | 433 → 406 (−6 %) | 120 → 100 (−17 %) | 5.1 → 4.8 |
  | rain (storm at night) | 315 → 310 (−2 %) | 344 → 313 (−9 %) | 64 → 48 (−25 %) | 4.3 → 4.9 |
  | towndrive (Lakewood) | 201 → 172 (−14 %) | 272 → 198 (−27 %) | 59 → 44 (−25 %) | 4.7 → 4.5 |
  | townfoot (Lakewood) | 225 → 160 (−29 %) | 325 → 209 (−36 %) | 70 → 42 (−40 %) | 5.5 → 4.7 |
  | middrive (Midwood) | 167 → 135 (−19 %) | 235 → 178 (−24 %) | 58 → 43 (−26 %) | 4.5 → 3.7 |
  | midfoot (Midwood) | 205 → 172 (−16 %) | 275 → 229 (−17 %) | 64 → 40 (−37 %) | 5.7 → 4.6 |
  | tee (the interchange) | 262 → 257 (−2 %) † | 328 → 308 (−6 %) | 60 → 45 (−25 %) | 6 → 5.9 |
  | attached (Lakewood from the highway) | 245 → 183 (−25 %) † | 311 → 224 (−28 %) | 71 → 49 (−31 %) | 6.9 → 5.5 |
  | foot (on the highway) | 276 → 262 (−5 %) | 377 → 352 (−7 %) | 87 → 64 (−26 %) | 5.5 → 5.1 |

  **Batch 1**: the shadow proxies (MEDIUM / HIGH), the clouds in 16 meshes (was 80), the towns' e-bikes far-LOD'd (bike +
  rider were ~20 draws each at any distance) and the HUD score's number formatter made once (`toLocaleString` built a new
  one every frame: ~0.3 ms). **Batch 2**: face parts (`Eye` / `EyeShine` / `Cheek` / `Mouth`, `models.js` › `prepare`)
  don't cast — 1–7 cm patches on the head, under a shadow texel (7.4 cm MEDIUM / 4.5 cm HIGH) and inside the head's own
  shadow, but ~4 shadow draws a person: −12…−24 shadow draws on the title / a run's start / on foot; a same-frame A/B is
  identical on the title and ≤ 8/255 elsewhere (24 pixels up to 18/255 on HIGH, not visible zoomed in). The title on
  MEDIUM: 108 → ~56 shadow draws in all. Steady allocation is small everywhere (2–7 KB a frame); the GC pauses measured
  are after a town is built / torn down, not churn. Left: §7 › Performance.
* **Batch 3 (`ci/perf`, 2026-11-21)** — main (326790f) → after, matched scenes:
  * **The people's shadow batch** (`lod.js` › `shadowBatch(root, { skip })`, MEDIUM / HIGH): every spawned person
    (`core/people.js` › `spawnPerson` registers it) and Lulu at the wheel (`car.js`) cast through ONE shadow-only
    `THREE.BatchedMesh` per material side. Each shadow pass copies every part's live `matrixWorld` + visibility in,
    so walk cycles / waves / Lulu's head stay exact, and the batch culls per part against the shadow camera. It is
    drawn with ONE `WEBGL_multi_draw` call — Safari on iOS 15+, desktop Safari 15+, Chrome / Android; not Firefox,
    where three draws the parts one by one (no worse than before). A part that is removed, or whose `castShadow` a
    feature turns back on (together's rooms, feel's damage…), hands that person back to casting on their own;
    people out of the drawn scene ~10 s free their slots and re-join later. Same-frame A/B: identical pixels (one
    pixel at 1/255). Shadow-pass draws, MEDIUM: the title 53 → 15, a run's start 54 → 16, on foot on the highway
    59 → 8 (HIGH: 57 → 19, 55 → 17, 72 → 8). `shadowBatchInfo(renderer)` / `shadowBatchOn(false)` for tests; the
    perf harness counts a multi-draw call as one draw.
  * **Street lamps** (`atmos/lights.js`): every chunk's lamps in ONE pole / bulb / light-cone instanced set (was 2–3
    draws PER CHUNK + one shadow draw per chunk), repacked each frame from the core `prerender` hook — only lamps in
    a chunk that's drawn AND within 60 m (anything that can cast into view) or inside the view, so per-lamp culling,
    finer than the old per-chunk boxes. Highway, LOW: the chunks' lamp meshes 37 → 31 + the 2–3 batched draws.
  * **LOW: tall grass on foot** (`foot/bounds.js`): one clump per 3 m cell beyond ±24 m of her (was two; the same
    deterministic clumps, every other one left out) — grass triangles 16.3k → 9.1k in that view.
  * **`compileAsync` that survives a disposed material** (`models.js` › `safeCompileAsync`, installed on the renderer
    at boot): three's version polls each compiled material's program from a timer and threw "reading 'isReady'" as
    an uncaught page error when a material was disposed meanwhile (`mpworld`, on main too). Same work, same promise.

  | scene (LOW, matched) | draws | triangles |
  |---|---|---|
  | highway | 316 → 279 (−12 %) | 119.3k → 113.3k (−5 %) |
  | attached (Lakewood from the highway) | 177 → 160 (−10 %) | 122.7k → 121.1k |
  | foot (on the highway) | 271 → 242 (−11 %) | 139.6k → 127.5k (−9 %) |
  | tee (the interchange) | 244 → 242 (−1 %) | 154.7k → 156.3k |

  The interchange's remaining weight is the two standing towns (`features/town` — `ci/exits2` is reworking the
  interchange, so not touched here) and each chunk's road + shoulders + signs.

## Traffic (`js/traffic.js`)
`registerKind(name, { len, halfW, circles, r, mass, model, paint | colors })`.
`ctx.traffic.add(kind, s, d, dir(+1 ours / −1 oncoming), speed, { ai(dt, car, traffic), data, onRemove, noNearMiss, immune, keep })`
→ car `{obj, s, d, dTarget, speed, dir, x, z, h, hit, data, free}`. A custom `ai` drives it
(change s/d/speed, or set `car.free = true` and drive x/z/h in world space). Set `car.onCrash = e => false`
to stop a crash with it costing a heart. `traffic.config = { enabled, ours, oncoming, mix, honkMoves }`.
`traffic.remove(car)`, `traffic.clear()`, `traffic.cars`. Car bodies are pooled per kind; `add()` always hands one back
VISIBLE (a feature that hides its far cars — the town's LOD, Free Roam's loops — must never leak an invisible body to the
next owner, e.g. a chase cruiser). `traffic.road` is a getter for `world.road` (a district's streets while one is active).

## Lulu's car (`js/car.js`)
`car.pos (Vector3) car.h car.vx car.vz car.vF car.speed car.s car.d car.spin car.boosting`,
`car.place(x, z, h)`, `car.applyImpulse(ix, iz, spin)`, `car.setSkin(key)`, `SKINS` (same as 2D),
`car.setHair(color, style)` (shows `Hair_<style>` if the model has it), `car.showDriver(bool)`,
`car.attach(slot, obj)` with slots `hood deck front rear head dash passenger mirrorL mirrorR`
(Object3D anchors on the model), `car.fx.emit/burst` (particles), `car.obj` (root), `car.tilt` (body).

## Input (`js/input.js`)
`input.steer throttle brake handbrake boost honkHeld moveX moveY lookX lookY interactHeld fireHeld device padKind padConnected`.
Edges in `P` (passed to update): `confirm back up down navLeft navRight start pause honk camera boost
fire item interact map phone tabPrev tabNext music radio`. Controller: ✕/A confirm+interact, ○/B back, D-pad ↑ fire,
↓ item, L1/R1 tabs in menus, touchpad `phone` (Xbox / Switch have no touchpad: L3 is `phone` there; on a PlayStation
pad L3 is `map`, the story-map shortcut), View/Create (button 8) `radio` (keyboard T), keyboard Tab `phone`.
`P.phone` always sets `P.map` too, so where there's no phone (title, pause menu, photo mode) the button keeps its old
"map · scrapbook · album" meaning. `H.showScreen(…, { onPause })` — Start / OPTIONS / Esc on that card (else they act as ✕ / ○). `glyph(action)` → the right button label for the
current device (PlayStation symbols on a DualSense). `addTouchButton({id, emoji, label, action, visible})`.
`input.stick2d = true` makes the touch stick 2-D (on foot / Dina).
**On foot** (`input.foot = true`, set by foot's `footRun`) three buttons change meaning — never in the car: ○ / B (button 1)
and keyboard Space = **`P.jump`** + `input.jumpHeld` (Space is NOT the handbrake on foot), □ / X (button 2), keyboard C and
the ROLL touch button = **`P.roll`** (features/moves' roll / slide / vault; `P.roll` fires from □ in the car too, unused there),
R3 / V = `P.recentre` (the free camera back behind her), and **△ / Y (button 3) + keyboard B = `P.emote` + `input.emoteHeld` —
RESERVED for the emote wheel (ci/hangout): nothing consumes it yet; tap = a quick emote, hold = the wheel** (△'s `P.camera`
still fires and does nothing on foot). Touch on foot: `#footPad` (index.html: `tJump`, `tRoll`; shown by `body.onfoot`) at the
bottom right, feature buttons (`#touchExtra`, the ✋ hand) stack above it in portrait / to its left in landscape. **Look:** a drag
on the picture (`#scene`: the mouse, any button; a finger anywhere off the stick / buttons) → `input.lookDX / lookDY` (radians this
frame) + `input.lookDrag`; `lookDragged()` tells a drag from a tap. Glyphs: `jump footMove emote recentre freeLook` on every device. `rumble(strong, weak, ms)` (controller: Gamepad API;
touch play: `setHapticSink(fn)` — features/native routes it to the iPhone's Taptic engine — else `navigator.vibrate`).

## UI (`js/hud.js`, `js/core/dialog.js`)
`H.showScreen(html, buttons, {onBack, onTab, focus, wide})` → card (all `<button>`/`.nav` are
controller-focusable), `H.hideScreen()`, `H.menuInput(P)` (call from your update while a screen is open),
`H.refreshFocus()` after re-rendering part of a card, `H.setFocus(idOrEl)`, `H.toast(text, "gold"|"pink"|"red"|"big", {key, merge})`,
`H.banner(html, ms, {prio, key})`, `H.hudSlot("left"|"center"|"right"|"bottom")`, `H.prompt(html)`, `H.flash()`.
**Keep pop-ups off the road:** toasts are a feed on the right edge; while driving/walking
(`playing`, `footRun`, `arriving` → `body.in-play`) a banner is a compact card at the top of the
"center" slot. Don't add your own big centred text over the road in those states — use these.
**HUD fit (`ci/hudfit`):** the slots have a starting place per layout (`style3d.css` › "HUD fit"), and `H.fitHud()` (every 0.2 s
of game time + when a banner / prompt shows) nudges them — the CSS `translate` property, `data-fit-dy`, only as far as needed —
off what they'd cover: "left" / "right" under the pills, "center" (the WELCOME banner, task chips) under the trip bar + the
left / right chips, the ✋ prompt and the controller's `#padHint` UP off the speedo / touch buttons / each other; ⏭ SKIP
(core/skip.js) slides down the right edge off the trip bar + chips. `H.keepClear(el, selectors, dir)` is the helper. Layouts:
a phone held upright (touch, or a controller / keyboard ≤ 600 px wide: pills in a row, the trip bar full width under them, a
compact speedo) — the "center" stack carries on the left column under the chips, clear of the speedo's column; a phone on its
side (touch, ≤ 520 px tall) — the pills in two rows, chips ≤ 260 px wide, a 128 px stick under them, the centre stack between
the chips and the buttons, the prompt low between the stick and the pedals (on foot: right above the ✋ button). On any phone
(touch, ≤ 760 px tall) the ON FOOT chip steps aside while a phone call / text card is up and only the newest of two text cards
shows (both are in 💬 Messages); upright on foot the prompt sits just above the WALK stick; on a small upright phone the
banner's second line stays one line. A piece that keeps clear of the centre stack ITSELF on a wide screen (hustle's 📻 ticker steps
down the right column) is marked `data-fit="self"` so there the centre doesn't also dodge it (two pieces dodging each other
chase each other down the screen); held upright (`H.PORTRAIT`) it stays put and the centre ducks under it. Test:
`scripts/tests3d/hudfit.js` (every pair of HUD pieces, by rect, at 390×844 / 844×390 / 375×667 / 667×375 / 768×1024 touch,
390×844 / 375×667 / 768×1024 controller, 1280×720, TV 720p / 1080p, driving + on foot, the HUD at its busiest — 📝, a 💬 text,
⏭, WELCOME, ✋, the hint — + the Clean HUD on the phones) — add a new HUD piece's selector to its `PIECES` (and to together's
`AVOID`).
**The play HUD's layout contract (`ci/hud`, 2026-11-26 — the owner's friend's Android, upright, with every chip at once
over the car):** a top band (hearts, coins, 📱) and a bottom band (touch controls) as before, and between them ONE
**objective line** (`#objLine`): the chip that matters most right now, by `H.OBJ` priority — `chase` 50 > `timed` 40 (a
side job, the 🅿️ challenge) > `mission` 30 (a robbery to foil / a snatcher / a game / Shomrim) > `errand` 20 (a story task, a
test drive, a ride) > `list` 10 (📝 Ima's list, a shop marker, a friend's ask) > `bonus` 5 (2× coins, nitro turbo, dreidels) >
`info` 2 (the next-exit chip, no badge). Everything else that's on folds (`.obj-folded`) into a small icon **badge** on that
line (a number on the first two — ⏱ 0:42, 0/3, 30s; a tap shows that chip for 5 s; the 📱 has the detail). On a phone
(≤ 600 px wide or ≤ 520 px tall) that's the ONE full chip, drawn as one compact line (its meters inside it; a long one
shrinks to 78 %, then wraps — never "…"), under the top band upright / between the pills and the 📱 on its side; a tablet
shows 2, a big screen / TV 3, stacked at the top of the centre stack. **A feature registers its chip once**, after putting it
in its slot: `H.objective(el, { prio: H.OBJ.timed, id, icon?, badge?: ".tm" | el => text | false })` — the HUD core moves
it into the line or back to its slot and folds it; never position an objective yourself. `H.objectives()` → `{ main, badges,
full }` (tests). **The trip bar** is the line's quiet default on a phone: it shows only while nothing outranks it —
`ctx.trip.prio` (a getter; none = 9, a town's street name: just under Ima's list; journey's story leg `errand`; the Shabbos
countdown and a party race `timed`); on the open road (`ctx.trip.label()` → null) app.js labels it with the next exit / rest
stop on the lap and how far ("🛣️ Lakewood exit in 1.2 mi") and fills the bar from the last place to the next. **The clear
window** `H.clearWindow()` (screen fractions: upright x 0.26–0.74, y 0.36–0.68; on its side x 0.3–0.7, y 0.4–1) holds
no persistent HUD, ever — Lulu's car and the road ahead; the ✋ prompt keeps its one place, bubbles and toasts are pop-ups.
On its side `#touchExtra` (BAIL, 🚀…) is a column beside the stick, not a row under the car. Tests:
`scripts/tests3d/hudworst.js` (every chip at once at 360×800 / 390×844 / 412×915 / 430×932 / 800×360 / 844×390 / 932×430,
a tablet with fingers + a controller, a laptop, TV 720p / 1080p: no overlaps, the window empty, ≤ 1 / 2 / 3 full chips,
no "…"; before / after pictures in `3d/docs/hud/`), `hudfit.js`, and `calm` (on a phone ≤ 1 full objective and ≤ 3 chips at once).
**One activity at a time (`ci/hud`):** `ctx.engaged(except)` (core/ctx.js) → the activity she's in ("" = free): `chase`
(law / a foot chase), `job` (a side job, the Fixer's too), `heist` (a robbery to foil, a snatcher, her own heist),
`parking`, `shabbos` (the rush), `underworld` (a bad-guy encounter), + whatever a feature adds with `ctx.addActivity(id,
fn)`. Every scheduler that STARTS or OFFERS something new asks it, passing its own family as `except`, and stays quiet
while she's busy. That covers robberies, snatchers, the heist tip, bad-guy cars, the Fixer, payphones / the job phone,
cameos, drive-thru / ice cream, the town's street scenes and crimes, the chop shop and the Shabbos call. A player's own
choice (📱 Jobs, a booth) isn't blocked. Test `oneact`. **Speech bubbles on a phone:** Lulu's line docks in the left
column outside the clear window (`H.dockSpot(w, h)` → a spot, `null` = wait, `undefined` = not a phone); a line over
someone else that would land in the window hides. **The 📱 (landing 3):** 💬 Messages keeps only texts that need her —
`ctx.phone.text({ …, need: true })`, or the threads realtor / council / bank / City Hall / fixer / jfk (`inbox.js › NEED`).
Any other text doesn't happen: no inbox line and no card. Only `"phone:text"` fires, with `quiet: true`. `react: true`
shows the card for a line answering something she just did, never during an activity. The 📱 badge = kept unread +
friends' requests / asks to join. Home screen: 👯 Friends · 🗺️ Map · 💼 Jobs · 💬 Messages · 📞 Contacts · 📻 Radio ·
📸 Camera. An app with `home: false` is opened from another app (📍 Nearby from Friends, 🎨 Paint & Pray from a Jobs
row while she's wanted).

**Places on the map + 📍 ping (`features/pins`, `ci/hud`, 2026-11-27 — the owner: "an easier way for players to see
where each store is … they should be able to ping it"):** a registry, `ctx.pins.add({ id, name, icon, cat: "shops" |
"town" | "help" | "mine", town + spot (a town build's spot) | local: [lx, lz] | lap: m | "jfk", group?, sub? })` — the
places that exist today are registered by `pins/data.js` from each feature's own name data; a NEW place registers itself
(one line in its feature) and shows on the map with nothing else to do. Her homes come live from realestate's registry.
The 📱 🗺️ Map (solo: phone/apps.js › lapmap; with friends: together/map.js) shows them: in a town its streets with every
place an icon where it stands, on the highway the lap ring with each town's places beside its exit; a list grouped by
where it is along the lap, in the order she'd reach them (`ctx.pins.groups()`); a filter row 🛍️ · 🏛️ · 🚑 · 🏠. Tap →
📍 Ping = ONE destination: openworld's beacon at the place (`target()`: the spot nudged out to the first point
`ctx.unstuck.normal` accepts — the town copy she's in, so every lap is right), one edge pointer (together/pointers.js ›
`extra(fn)`: the friend pointers' pill, kept out of the clear window on a phone, hidden in an activity) and the
objective line's lowest slot (`H.OBJ.info`). In another town it points at the way out, on the highway at the place's
town's next exit; arriving clears it (a town place within 12 m, a rest area / JFK when she's in it), a new ping replaces
it, ✕ Clear in the map. 🛍️ Where to shop (shops/guide.js) marks through it (`pingKind`). With friends: `d.x.pg` = my
ping's id (the party packet — no relay change); a friend's ping = their beam in their colour + one quiet line for 8 s.
⚙️ 📍 Destination pointer (off = no beam, no edge pointer; the map + the line stay). Test `pins`.

**📶 Show connection (`features/netping`, ⚙️, OFF by default):** a small "📶 48 ms" pill in the top band by the coins;
it times the relay heartbeat the game already sends (`multiplayer/net.js › pingRelay()`: "pi" → the relay's "po" →
`MP.rtt`) every 10 s while it's on and online, never while ⚙️ Play online is off ("📶 offline"); amber ≥ 250 ms, red
≥ 500 ms; hidden in Dina's mode. No server change. Test `netping`.
**The notification manager** (game time): a repeated toast becomes one with a ×N count, signed numbers
sum (+5 💰 ×3 → "+15 💰"); banners show one at a time from a priority queue (`prio`; same `key` replaces), and
nothing new pops up while a dialogue line or menu is open. **The pop-up budget (ci/calm — the owner: "lesser pop
ups, especially in party mode"):** every toast has a priority — `opts.prio` 3 must-see / 2 normal / 1 flavour; without
one it's inferred: a `big` toast or money SPENT (−N 💰, 💸, a fine / bill) = 3, `red` or money earned = 2, anything else
= 1. One toast at a time on a phone-sized screen (two elsewhere). A FLAVOUR toast is dropped — never queued — when
another toast is up or waiting, when she's busy (a chase, a dialogue, any state that isn't the open road), or within
7 s of the last flavour toast (15 s when it's "quiet": in a party or with strangers' ghosts around); flavour toasts
are a little smaller on touch and shorter. While a phone call's card is up (`ctx.phone.active`) flavour toasts drop
and, on a phone, flavour banners wait (gone after 3 s). A toast within 1 s of a button press is the ANSWER to it (🎥 camera, "not
here") and counts as normal. `features/calm` feeds the budget (`H.setCalmGate(() => ({quiet, busy, chase, acted, call}))`).
Speech bubbles over OTHER people (roadevents `bubble`, foot `bubble`, banter `npcBubble`) ask `H.bubbleOk(dur)`: at
most one at a time on a phone (or when quiet), ≥ 5 s apart (10 s quiet), none in a chase, always when she just acted —
a refused bubble is still created, only hidden (`.calm-off`), so callers keep working. **Give your toast a `prio`** when
it matters more than flavour (Ima's list ticks are 3), and don't add new overlay channels: go through `H.toast` /
`H.banner` / a bubble helper so the budget sees it. Still outside the budget: phone texts / calls (`ctx.phone.text`,
the call card), `metaToast`, law's toasts. Test: `scripts/tests3d/calm.js` (pop-ups a minute in four situations). **HUD style** (Settings → Full / Clean, `save3d.settings.hudMode`): Clean hides the score and anything
with class `hud-secondary` — mark your optional HUD chips with it. **Lulu's chatter** (Chatty / Normal /
Quiet, `save3d.settings.chatter`) is respected by banter.
Dialogue: `await say(name, text, {emoji, color})`, `await choose(name, text, [opts])` → index,
`await script([[who, text], …], {emoji: {who: "👵"}})`. While a line is open, input goes to the dialogue.

## Sets (`js/core/sets.js`)
`const set = makeSet({ light: "day"|"indoor"|"night"|"dusk", sky, fog, ground })` → `{scene, camera, add, own, show, hide, dispose}`.
`makeRoom(set, {w, d, h, floor, walls})`, `textPlane(lines, {w, h, bg, fg})`. In your state:
`enter → set.show()`, `exit → set.hide()` (or dispose), update the set camera yourself.
**An OUTDOOR set that follows a drive must match the world's sky:** after `set.show()` call `ctx.atmos && ctx.atmos.dress(set, { lamps: [[x, y, z]…] })` (see ctx.atmos) — never a fixed daytime preset at night or sunshine in a storm.

## Flow: no hard cuts (`js/core/camera.js`, `js/core/transition.js`)
The owner's rule: the game should feel like ONE continuous place — nothing pops, cuts or blinks if it can glide.
- **The FREE camera on foot** (`ctx.cam.orbit(obj, { dist, look, fov, y, auto })`, state `ctx.cam.free`): the player turns it
  (right stick = a rate, a drag = a delta; Settings › 🔃 Invert look + 🎥 Look speed `save3d.settings.lookSens`) and it STAYS;
  walking is relative to it (`ctx.foot.frameYaw`). `auto` (foot's `autoFollow`) only straightens it onto the road / street axis
  while she walks roughly "up" and it is already within ~40° of that axis — strafing, crossing, standing still: untouched.
  `free.fromCamera()` starts it from the picture on screen (foot's `beginWalk`: no swing out of the car); a frame where it
  didn't run before (a cutscene / script camera) starts a 0.45 s blend on its own, so a script's shot → walking never cuts.
  In the CAR the look is HELD (`st.lookYaw / lookPitch` stay `LOOK.hold` 1.4 s after the stick / drag lets go, then drift
  back; R3 still looks behind). `snap()` / `blend()` reset the car's look. Tuning: `LOOK` in `core/camera.js`.
- **Same place, another camera** (car ↔ on foot, into / out of a roadside scene): `ctx.cam.blend(sec = 0.6)` instead of
  `ctx.cam.snap()`. The rigs still jump (so the next rig is settled), but the PICTURE eases from the pose on screen to
  wherever the next rig puts it. A jump of more than 70 m is a teleport and stays a cut, so it is safe to call anywhere.
  `ctx.cam.blending` (tests). Keep `snap()` for a new run, a set → world return and anything behind a fade.
- **Another place** (a town's street grid is far from the highway; a warp to a friend): `ctx.dissolve(swap, { ms })`
  (`import { dissolve } from "…/core/transition.js"`) — the frame on screen is frozen onto an overlay, `swap()` runs
  behind it (the teleport, the district swap, even a long building frame), the overlay melts over the new picture. Only
  when the next place is READY (models loaded): a frozen frame that lasts seconds reads as a hang — a download still
  wants a real fade with a label (the town keeps its black + name card for that case).
- **Into a car:** `foot`'s `hopIn(v, { before, after })` — a 0.42 s hop into the seat, then `enterCar` + a blend;
  `before()` takes the other car off the road at the moment she lands. The courtesy shield after it sets
  `G.invSoft` (no blink; a real hit clears it).
- **Back on the road after a scene:** a rolling start (moving + shielded), never the 3-2-1 — that is for a fresh run.
- **Loading ahead:** `ctx.interiors[id].warm()` (foot calls it within 22 m of a door, heist at the bank, homes at a
  front door); a town loads from 900 m. **A warmed building is a soft cut in and out**: `ready()` → `enterInterior`
  builds the room in the same frame behind `dissolve` (`Room.loadNow`, `room.soft`), foot skips its black wash, and
  leaving melts back the same way. Not ready yet → the old emoji-on-black loading fade.
- **Music:** `setMusic` crossfades (0.7 s) and every track resumes where it left off.
- **No build hitches:** a road chunk that enters the 640 m window is built a STEP at a time (`Chunk.build` is a
  generator: the road + scenery, the bake, then one `chunk:build` listener per step; `World.update` gives it ~3 ms a
  frame — one step a frame in a `?test` run), so the worst frame is one step, not a whole chunk plus every feature's set
  pieces. A missing chunk within 300 m of her (a restart, a warp) and `world.prebuild()` build at once, as before. A
  `chunk:build` listener therefore must not assume the other listeners ran in the same frame, and `chunk.building` is
  true until the last step. `world.sliceLog = []` collects `[chunk, step, ms, name]` (a perf probe).
- **No first-sight hitches:** a model that finishes loading has its shaders compiled at once, as if it stood in the
  driving scene (`models.js` `warmShaders` → `renderer.compileAsync(model, camera, scene)`), instead of mid-frame the
  first time it is drawn. (A set with its own lights still compiles on first show; only the party lobby warms the
  whole road — `party` `warmShaders`.)
- **One world — the towns stand at the interchange:** she drives down the ramp, through the T and into Lakewood / Midwood
  with no fade, no frozen frame, no jump, and back out the same way, on foot too (Towns › Attached). A town is built in
  slices (`buildTownSteps`, ~1000+ steps of 1–3 ms) from 900 m out, so the town appears without a hitch and is in view from
  the ramp. Only a warp into a town (Free Roam) or a town whose download is late still dissolves / fades.
- **Doors you just walk through (`ci/doors`, roadmap 29):** a door's ✋ reaches across the whole doorway, from the step
  out to the kerb. A foot spot with `door: true` (or `door: { w, inn, out }`) whose `pos()` returns the town's spot WITH
  its axes (`{x, z, ux, uz, nx, nz}`, as `ctx.town.spot()` gives it) gets that strip from `features/foot`
  (`doorReach`; `ctx.foot.doorReach(at, o, p)` for features that pick the nearest of many doors — homes, real estate).
  **Every new door spot (roadside buildings too) should use `door: true`.** Test: `scripts/tests3d/doors.js` (a probe
  walked across every door's front in both towns + strangers' houses; each building entered and left; the phone ✋).
  **Inside, the same camera as outside** (stage 1, `features/interiors/engine.js` › ORBIT): every room uses the free
  on-foot rig (`ctx.cam.orbit(obj, { camera: room's camera, clip })` — same yaw / pitch / look settings / stick
  directions, run on boost), clipped to the room's box, its ceiling (`def.ceil`, default 3 m) and its big shell meshes;
  furniture-sized meshes between the lens and her fade; a chat turns it over her shoulder. `def.cam` is now only a hint;
  `def.cam.fixed: true` (and any `rt.mode` mini-game) keeps the old from-above follow. **No cut** (stage 2): a spot with
  `walkIn: { id, n? }` (id = its interior) is entered by walking into the doorway — the room was warmed from ~24 m; not
  ready → the handle rattles; ready → the swap happens on that frame, no dissolve (`ctx.foot.walkingIn`). Inside, walking
  back into the room's `Spot_door` heading out leaves the same way (`def.noWalkOut` opts out) and she's back in THAT
  doorway facing the street, still walking (`ctx.foot.stepOut()`). Doors with a choice (strangers' houses, her own
  homes, counters, the impound gate) keep ✋ only.
- **A run starts in the world, and never ends in a card:** from the title the camera glides down to Lulu on foot at
  her porch (world › home street) and a knock-out puts her back on her feet beside her car (Run API › the knock-out) —
  the world keeps running through both. Test: `scripts/tests3d/home.js`.
Test: `scripts/tests3d/movement.js` + `movetouch.js` (the jump, low obstacles, the free camera + the car's held look, the
button map per device, the phone layout); `scripts/tests3d/flow.js` (the picture moves ≤ 1.5 m between two frames across a car ↔ foot change; the hop-in;
a teleport still cuts; leaving a stand-alone town is a soft cut with no black; down the ramp into an attached Lakewood and
back out: ≤ 1.5 m a frame, no fade, both towns built before the ramp in small slices, Lakewood in view before the STOP sign).

## Audio (`js/audio.js`)
`sfxCoin sfxCloseCall sfxBoost sfxCrash sfxBump sfxHorn(on) sfxSiren sfxFanfare sfxSelect sfxMove`,
`setMusic(url)` (a 0.7 s crossfade where the browser can set an element's volume — an iPhone can't, and there a set READS BACK for one task before it is 1 again, so audio.js never reads `el.volume`, counts its own levels, and stops every track that isn't the current one: test `music`; one kept `<audio>` per track; `musicSrc()` = what's playing; the 📻 radio uses it to tell the game's pick from its own) — reuse the 2D tracks: `../lulu.mp3 ../luludriving.mp3 ../dina.mp3 ../avigail.mp3
../parking.mp3 ../salon.mp3 ../wedding.mp3 ../prison.mp3 ../court.mp3 ../walking.mp3 ../er1.mp3 ../er2.mp3
../story-relax.mp3 ../story-electric.mp3 ../story-beach.mp3`, plus the one song that is 3D-only, `../dont-wanna-be-frum.mp3`
(“I Don't Wanna Be Frum” — Dovid Dov: the radio's 🎤 DOVID DOV FM station, `features/hustle/data.js`; a new root mp3 must also go in
`scripts/copy-web.js`'s list or the iOS app won't have it). **Dovid Dov canon:** an anonymous singer nobody can identify — and Lulu's
brother. Lulu, the family (Ima, Bubbe, Heshy) and close friends (Avigail) know and keep it quiet; strangers, DJs, billboards and town
group chats only wonder who he is. Keep new lines on the right side of that. Synthesize new SFX with WebAudio if needed
(`unlockAudio()` already happened by the time gameplay runs).

**Positional audio — `A.spatial`** (`js/spatial.js`, on the core AudioContext, so Sound off mutes it).
Sounds you can LOCATE: a fixed pool of voices (`src → env → lowpass → gain → PannerNode` equalpower →
spatial bus → master), a hard cap (8 voices, 6 on phones/consoles; the quietest is stolen — loops go
virtual and come back, one-shots are dropped), distance roll-off, a "behind you" lowpass (front/back
without HRTF's cost), air absorption and a Doppler pitch shift from the distance rate. The listener
sits on the camera's axes, 75 % of the way to Lulu (`ctx.car.pos`, which follows her on foot); app.js
calls `A.spatial.update(dt, camera, focus, open)` after every render (closed = faded out: paused, a
set (`ctx.view`) on screen, skipping). Nothing allocates per frame.
```js
A.spatial.ready                                  // false until the first gesture → play/loop return null: fall back to your flat sound
A.spatial.play(kind, obj3d | {x, y, z}, { gain, rate, delay, dur, prio, key })  → handle | null   // one-shot (key: replaces the last with that key)
const h = A.spatial.loop(kind, obj3d | {x, y, z}, { gain, rate, floor, prio })   → handle | null   // looping emitter
h.set({ gain, rate, floor, kind }); h.stop(); h.alive; h.info()   // an Object3D target that leaves the scene ends it too
A.spatial.define(kind, { gen: sr => Float32Array, loop, ref, max, gain, prio, lift, doppler })   // your own sound (synthesized once, 24 kHz)
A.spatial.stopAll() · has(kind) · setMaxVoices(n) · stats() · list()
```
Kinds (defined by `features/feel/kinds.js`): `siren` `sirenYelp` `rotor` `ambulance` (loops), `whoosh`
`whooshTruck` `horn` `hornVan` `hornCop` `hornTruck` `trainHorn` `bell` `jingle` `hubcap`, `scrape` (loop).
Users: law (one siren loop per lit cruiser, `spatialSirens()`; the chopper's rotor), banter (`npcHorn(kind, vol,
beeps, obj)`), roadevents (`sfx.bell/trainHorn/jingle/honk/ambulance(…, at)`), feel (passing traffic, the
dragging bumper, the hubcap). For an ambience bed (a town square, a fountain) use `loop(kind, {x, y, z})`.
**Music muffle:** `A.setMusicMuffle(0..1)` routes the music `<audio>` through a MediaElementSource → lowpass
(only once a muffle is first asked for; cheap to call every frame); `A.musicMuffleInfo()`. Feel muffles it
while Lulu is on foot. **Rain** (atmos `sfx.rainLoop(level, "car" | "foot")`): a drum on the car vs. the open-air hiss.

## Testing
**Determinism rule:** gate every RANDOM or surprise thing you add (spawned events, cameos,
patrols, popups, tutorials, daily-gift dialogs) with `ctx.enabled("<id>")`. It's always true in
the real game; in `?test` runs it's false unless the test opts in with `query: "&enable=<id>"` in
its module export. Never put a blocking modal in the title → Story Trip → playing path.
The same gate keeps a 🎉 **party** fair: during a party `ctx.enabled()` is false for the features in party's
`OFF` set (see the parity table below), so every friend's world stays identical (traffic, ramps, dreidels and
billboards come from the party seed; atmos takes its clock + weather from `ctx.party`). The features that are ON
in a party are party-AWARE: what everyone sees comes from the seed, what you do is yours. Anything random you add
must check `ctx.enabled("<id>")` and, if friends could see it, take its dice from the party in a party:
**the road plan** (`features/party/plan.js`) — `ctx.party.road.claim(id, { kind: weight(A) })` at boot, then
`ctx.party.road.slot(k)` → `{ id, kind, k, s, side, key }` (at most one big thing per 200 m chunk, a pure hash of
the activity seed: build yours when `slot.id === id` and your car is near) · `ctx.party.rng(key)` (a seeded
generator) · `ctx.party.seeded(key, fn)` (Math.random seeded for SYNC code) · `ctx.party.h01(key, k)`. A car only
one player should see (a job's prop car, a responder for HER) sets `data.partyLocal` so the party's traffic sync
keeps it. Your random solo scheduler must stand down in a party (`ctx.party.active`).
The party's OFF set is now just `journey`, `dina`, `shabbos`, `ads`. `town` is on, but only **🌍 Free Roam**
(openworld) opens its exits: the town asks `ctx.openworld.partyTowns()` — no random drivers (openworld's seeded
block loops instead), townsfolk + geese + e-bikes built under `ctx.openworld.seeded()` (bikes / charging geese
then go their own way on each screen: personal).
**A special vehicle in the SHARED traffic:** `ctx.party.addTrafficKind(kind, w, on)` at boot (rides' fleet, streets'
coupe) — a hash of its own per conveyor slot, so the plain sedan / van / truck picks never move.
**Claiming a shared car** (party/index.js `claimShared`, traffic.js `claimPose`): a shared car can't stop for her,
so when she steps out in front of one (on foot, in its lane, far enough for it to stop), flags one down (✋ FLAG IT
DOWN from the shoulder / kerb), rams one (impact ≥ 5) or pulls one over in a cop car (law's 🚨 PULL OVER), she
CLAIMS it: one broadcast `"cl"` (+ `d.x.cl` for late joiners) and every screen takes it off the conveyor and brakes
it evenly onto its shoulder by the same pure formula of (claim, party clock); first claim wins. It's hers: her copy
is `data.partyClaim` + `streetsHold` (streets' carjack takes it; a flagged one also offers 🚕 HOP IN on the
passenger side — no crime); friends' copies are puppets nobody else can take. When she drives off in it it's gone
for everyone (`"j"`). Another feature's shared cars plug in with `ctx.party.claimKinds(prefix, handler)` (openworld's
town loops: `"tw:<town>:<loop>:<n>"`). Claims are a streets thing: Road Trip / Free Roam with `streets` on.

**Everything in a party, like the regular game** — a feature is one of: **shared** (the same on every screen:
a pure function of the party seed + clock, or host state), **personal** (only this player's screen runs it; what
friends need to see goes out as *presence* / snapshot extras), **seeded** (random, but from the party seed) or
**still off**. The rules for anything personal: never touch the shared traffic (party cars are `immune` and have an
`ai` — skip `c.immune` / `c.data.party` / `c.ai` cars; a local-only car you add must carry `data.local` (or be a law
unit / foot stub / jack) or the party sync deletes it), nobody loses hearts (damage is vetoed; a knock is a pratfall),
and say what you're doing with `ctx.party.presence?.({ mode, icon, label })` (an automatic presence covers driving /
on foot / an interior / the law's states / the ER / cutscenes). A scene that leaves the road (jail, the ER…) and comes
back through core's `intro` is put straight back into the party (`playing`, no 3-2-1) where it left her car.

**Party parity** (what a 🎉 party has of the solo game — keep this table current when you touch a feature):

| feature | in a party | how / why |
|---|---|---|
| roadevents | **seeded** (Road Trip, 🌍 Free Roam; Race / Dash / Tag: hazards only) | `roadevents/party.js`: big set pieces (🍦 stand, 🍔 drive-thru, ⛽ station + nitro cans) from the road plan, small ones (cones, puddles, potholes, animals, strollers, hitchhikers) from per-chunk sub-slots — the same s on every screen, each screen builds its own copy; rewards personal. Off: anything that drives (ambulance, buses, ice-cream truck, drunk / texting drivers, steamroller, fender benders) or must stop the traffic (toll, train, parade, crossing guards, work zones) — party traffic is a pure function of the clock |
| cameos | **seeded** + personal scenes | `cameos/party.js`: Avigail on foot, Chez Fabio, Heshy's pool, an uncle, the sasquatch from the road plan, their verge spot from `ctx.party.seeded`; the porch / salon scenes are YOUR states (no pause — friends keep driving); two friends at one cameo each get their own copy. Off: Avigail's coupe (it drives); the crash aftermath (no wrecks in a party) |
| world | **shared constants**, personal pull-in | Gas 'n' Go / the Lookout / driveways are fixed spots (`where("party")`); a Road Trip has no driveways from Bubbe's on; the visit beat is yours. The start at home on foot is solo only (`wantsDeparture`: a party keeps its own grid start) |
| accounts 🪪 | **on** (personal) | Her username is the party's name for her (party `nameOf`); every member's game sends its name ticket in the snapshot extras (`x.un`, bound to the party room + relay id) and the others ask the server for the name — shown even with ⚙️ other players' names off (people she plays with). Friend requests / the server list work the same in a party. |
| friends 👯 | **on** (personal) | The list, the doorbell and ▶ Join work the same in a party (a JOIN answers with the party's own code); 👯 › a friend → ➕ Add as a friend (`x.fr`, `x.fid` marks who's already on your list). Since ci/accounts the list, requests and blocks are also on the server (`friends/server.js`). |
| onegame 🎮 | **solo only** | The 🧳 suitcase, the 🅿️ rest-area booth (+ its attendant), ✋ Play as Dina, Ima's Friday rush at the door and the 📱 Jobs card all hide in a party (`solo()`; journey, dina and shabbos are in the party's `OFF` set anyway). ▶ PLAY / 👯 Friends on the title are unchanged by a party |
| hustle | **seeded** markers, personal jobs | `hustle/party.js`: ☎️ payphones + 📋 boards from the road plan; taking one, the riders, props, pay are yours; my 📱 still rings at random (nobody else hears it); 💼 Jobs app on the party highway; the getaway only when the party has the law on. "Follow that car" is a `partyLocal` car |
| community | **seeded** in a 🌍 Free Roam town, personal help | `community/party.js`: org cruisers on openworld's block loops (pure f(seed, loop, clock)); roadside scenes in 50 s windows of the party clock (kind, kerb, call-in time seeded); the Bais Yaakov line on the party clock; 📞 Phone calls + help visits are yours (local responders); Shomrim chases only with the law on in the party (local cars; a loop cruiser never leaves its loop). Off: highway sightings (the party's highway traffic is the seeded conveyor) |
| memory | **personal** | grudges, notoriety, the log, texts + recognition lines record / play in a party; grudge cars + WANTED billboards wait for a solo run (a local car in shared traffic / a roadside reservation on one screen) |
| banter | **personal** | Lulu's lines (+ a party opener); NPC reactions skip party cars (they're `ai`); billboards are the party's (seeded); banter's random sidewalk walkers stay out (roadevents' are seeded) |
| meta | **personal** | stats, quests, badges, streak record in a party; a party run is banked (`endRun("party")` once → run:end); no first-drive tutorial with friends |
| shabbos | **off** | the Rush owns the run's goal + sky (`G.mode = "shabbos"`, `G.atmosClock` = the deadline); in a party both belong to the party (the activity, `ctx.party.atmosClock`), so one player's rush would split the sky. A party-wide 🕯️ rush would be its own lobby activity (`addActivity`: a seeded deadline on the party clock, the shops from the road plan, a group candle-lighting at Bubbe's) — not built yet (its shops / timer / sky / ending are all solo-shaped: not a cheap port) |
| day 📝 | **off** | Ima's list belongs to a solo Cruise that starts at home (world's home start is solo; `day` also checks `ctx.party.active`). A party version would be a shared list for the group from the party seed — not built |
| journey | **off** (Road Trip borrows Bubbe's) | Story mode is one player's chapters, stop scenes, calls and G.mode; the 🏡 Road Trip already drives to the journey's stop 0 (Bubbe's house, built in every mode) with a group arrival |
| dina | **off** | Dina's mode is its own world from the title (bus, house, minigames), not the road |
| foot 🚶 | **personal** | Get out & walk on a 🏡 Road Trip / 🌍 Free Roam (not mid-Race / Dash / Cop Tag: `G.arrived`). Her pose is published as HER (`d.p` = her position / velocity / facing, `d.x.f` = [anim, look]) → friends draw a walking Lulu (hair, jumpsuit / disguise, roll · slide · vault · knocked flat · busk · wave); her parked car `d.x.pc`. Peds, animals, parked cars to hotwire, the booth, Avigail, the foot cop are her personal props; no cars spawn behind her (the shared traffic is the party's). Shared traffic + friends' cars knock her flat (no heart); two walkers step aside. |
| interiors 🏠 | **shared room**, personal scripts | Two friends who walk in the same door (the bar / school / hospital / precinct / beach) are in the same room and see each other walk, sit, dance, emote (features/together `rooms.js`: `d.x.in`); the bartender, the cell, the coffee, every reward / bill run on each screen for its own player only. Friends outside get presence "🍺 in The Thirsty Scholar" + her nametag over the door (`d.x.at` / `d.x.dr`), see her step in through the door, and the 📱 map / pointers point at it. The bank (heist) stays personal + shut in a party |
| homes 🏠 | **seeded** crowd in a 🌍 Free Roam town · **personal** houses (the scene inside is **seeded**: house + the host's day + the shared clock — friends at one door see the same household doing the same thing; while she's inside, `d.x.hs` = [door id, scene id] (a few bytes, removed on the way out) so a friend who follows later adopts that scene; jobs, pay, catches are each screen's own) | the crowd's layout (who stands on which porch, the walkers' starting streets) is built under `ctx.openworld.seeded("<town>:crowd")` — the same on every screen; walkers' corner choices and every reaction (wave, gossip, scatter, honk) are local, so nothing is synced; no delivery e-bikes (they'd ride through the shared traffic). A house is a **shared room** (features/together): friends in the same house see each other; at a door a friend is behind, the menu offers 👯 Join <name> inside (in as a guest). Residents, view cones, loot, the call-in / foot chase stay each player's own (a friend can't get you spotted or reported); friends outside get presence "🏠 in the Goldbergs' house" + her nametag over the door |
| law 🔗 partners (`law/crew.js`) | **personal**, joined into a **crew** by the host | Friends seen breaking the law together (≤ 8 s, ≤ 45 m, same zone) or who all asked (`ctx.law.crew.partners`) share ONE wanted level, LOST 'EM only when all are out of sight, split up = the cops pick one; caught together (≤ 20 s, or ✋ GIVE YOURSELF UP beside her) → the same precinct, the same cell on every screen (partners drawn, emotes, one court clock), co-defendants in court, break out together / spring her from the door, out of the door side by side; any friend can bail a friend out at the precinct desk from her OWN wallet. A screen only joins a crew while its own player is in trouble; every coin / verdict on the player's own screen (solo rules). See Partners in crime |
| partners 🔗 (crimes for two) | **personal**, friends' parts by broadcast | Double dare · flag & grab · ring & sneak · getaway peels — each player does her own part on her own screen; a fixed pot split, each share paid + capped on its own screen; party only (Free Roam / Road Trip), never in Dina's mode or solo. See Crimes for two |
| crime 🦹 (town crimes) | **off** (solo only) | Her own town crimes (🛒 cart, 🚶‍♀️ jaywalking, 🅿️ double-parking, 🏷️ tags, 🐟 herring, 🌬️ air), the street's (🥄 cups, ⌚ watches, 📦 porch pirate) and the corruption (🧾 Malka, 👀 crooked moments, 🕵️ I.A.) are solo; with friends the crimes are `partners`' crimes for two. A party would need: the cart / the props seeded per town (they already are — fixed spots), each player's own pay on her own screen (already), a remote Lulu sitting in a cart (`d.x`). See Town crimes |
| law 🚓 | **personal** | Her own traps / patrols / chases (cops are local cars, never crash a shared car — a cruiser that hits one bounces off). Friends see up to 3 lit cruisers on her tail as puppets (`d.x.cp`) + her stars on the nametag (`d.x.ws`). Arrest / jail / court are personal (presence 🚔 / ⚖️). In a town (features/places) the arrest → precinct → court plays in THAT town and she reappears on foot at the precinct / courthouse door — friends just see her puppet come back there; arrested on the highway in a party she's released on the highway as before (no warp into a town away from her friends). Stands down in a Race / Dash / Cop Tag and during any 🌍 game she plays (🚓 Cops & Robbers has its own cop): `law/index.js partyStandDown`. |
| streets 🔑 | **on**: seeded props + booths · personal heat · carjack via a **claim** | Carjack like solo: she steps in front of / flags down / rams a SHARED car → it's **claimed** (pulls over the same way on every screen, see above) → she jacks it (or 🚕 hops in, if she flagged it) → `ctx.party.claimTraffic(car)`: gone for everyone (`"j"` + `d.x.jk`, never re-added), friends see her ride's model (`d.x.v`); a passing car can still be jacked on the move. Town loop minivans + the school bus (Free Roam) the same way. Solo, every town driver is jackable (once it's stopped). Hotwiring a parked car on the shoulder: foot's personal parked cars. Props: per chunk from `ctx.party.rng("streets:props:" + k)` (identical on every screen); smashing is personal, a FRIEND's car ploughing through one smashes it on my screen too (cosmetic, no bill). 🎨 Paint & Pray booths: from the road plan (`road.claim("streets", {paint})`, planned ~1.4 km ahead), the drive-through personal (presence 🎨). Roadblocks: personal (`partyLocal` cruisers on the SHOULDERS + spikes across her lanes — never parked in a lane the shared traffic drives). 🔧 Shmuel's calls: personal (the wanted car is a `partyLocal` car riding a gap in the conveyor at lane speed; step in front of it to stop it). Sports coupes join the shared traffic. Her empty car coasting into a shared car only spins itself. |
| rides 🚓🚑🍦 | **on**: fleet **seeded** · personal jobs | The taxi / ambulance / ice-cream truck / bus fleet rides the SHARED traffic (`ctx.party.addTrafficKind`: the same ambulance at the same place for everyone) — claim / jack it like any shared car. Handling, horn, trick per ride; siren / air-horn yields only move local cars (shared ones have an `ai`); the 🚨 pull-over CLAIMS the shared car ahead (it pulls over on every screen; a car she already claimed counts too); dispatch, patients, ice-cream kids, bus riders are her personal props. |
| feel (damage) | personal | Hearts are never lost in a party, so there are no dents to show (nothing published). |
| life 🍃 | **on** (local + cosmetic) | Footsteps, puddles, wind / leaves / flyers / leaf piles and the neighbourhood sounds are drawn and played on each screen only — nothing is published, nothing touches shared traffic. Puddle + pile SITES are hashed from the town's plan, so every friend has the same puddles and piles in the same gutters; the water level follows the weather (the party's shared sky in a party). A kicked pile / a soaked townsperson is personal. Round 2: the chimneys / manholes / vents / pigeon perches are hashed from the town's build too (the same for every friend; chimney smoke follows each device's date); a scatter, an alarm, a smelled vent are personal; a friend walking near her gets footsteps from `ctx.party.remoteCar(uid)` (read-only, nothing sent). Round 3: which houses light up when, the TV windows and bedtime are hashed from the town's build (the same order for every friend; each lights on its own sky — a party's shared clock); breath, the tailpipe, dawn mist, a hotwire's alarm and the radio's weather line are personal (a friend near her breathes too, read from `remoteCar`). Off in Dina's mode |
| moves 🏁 | personal | On already (skill, not chance); roll / slide / vault show on her walker. The JUMP (foot) too: `d.x.f` = [anim 10 = in the air, look, her feet's height in dm] — friends' walker rises with her (a jump, up on a bench / a car roof), eased between the ~10 Hz snapshots. |
| openworld 🌍 | shared | (see Open world) · games start as an **invitation** (host state `g.ph = "in"`: the starter in, friends opt in by coming to the spot / the chip / 📱 👯 Join, ≤ 15 s) — nobody is warped or held unless they opted in · 🕹️ / 📋 **game spots** in each town (`spots.js`): personal props (built from `ctx.town.spot`, the same place on every screen); the invitation itself is host state |
| multiplayer 🌐 (EVERYONE) | **on** in 🌍 Free Roam · hidden in lobby activities | Strangers stay ghosts around the group (their own `d.w` places, no collision, flood-guarded); party members tag `d.pt` and are drawn once, by the party. In a race / dash / cop tag / road trip strangers aren't drawn and don't see you (`"~"`). The emote wheel there is the party's |
| emotes 👋 (party/emotes.js) | **personal**, friends SEE them | 8 gestures + fixed phrases (no free text). My `d.x.e = [slot, seq]` while one plays → friends' walker poses (core/people.js) / their car's arm + bubble + emoji. Combos (two gestures at each other ≤ 14 m, ≤ 3 s) and greetings (passing ≤ 9 m, 1 per friend per 90 s) are worked out on each screen from what it saw — nothing extra on the wire, cosmetic only, no coins. Never moves / blocks / holds anyone |
| native (ads) | **off** | `ads` is in party's OFF set and `ads.js` also checks `ctx.party.active`: no interstitial, no 📺 rewarded button with friends (haptics stay — they're personal) |
| exits 🅿️ | **seeded** rest areas · personal visit | Planned from fixed data + the party seed only (never the reserved road): a 🏡 Road Trip gets one on the way to Bubbe's (s = 2350 + seeded 0–400, slid clear of the places), 🌍 Free Roam one after ~every other interchange (`h01("exits:rest", E) < 0.55` → at E + 1600, snug between that exit's ramp and the next one's mile sign); the road plan keeps its big things off them (plan.js `busyAt`). Pulling in, walking the lot, the pumps / Mendel's bays, food, souvenirs: personal; friends see presence "⛽ at the <name>". The town's interchanges are planned from s = 0 from fixed data only (the places' constant spots), so every friend's ramps land on the same metre. No town exits on a Road Trip (towns are Free Roam's: a zone change needs the activity's frame / show / pose hooks, which only 🌍 Free Roam has) |
| town 🏘️ | **on** in 🌍 Free Roam towns | Attached towns stand where `placeAt(def, exitS, k)` puts them — a pure function of the exit's s (planned from fixed data) and the seeded highway, so every friend's Lakewood is on the same metre; a warp / late join into a friend's town enters that same placement (`enter({town, exitS})`), built at once behind the dissolve. Seeded block-loop traffic (openworld), seeded townsfolk / geese / e-bike starts; stop signs, speed bumps, one-way streets, gossip, the 🗞️ Kvetch app, geese charging HER, the e-bikes' rides: personal. Loop minivans / the school bus can be claimed + jacked (above). The kerbside parked cars are the same on every screen (built from the town data); shoving one (its alarm) and hotwiring one off the kerb are personal — it's gone only from her own kerb, friends see her drive off in it. Exits: the interchange (ramps, T-junctions, gas station) is built from the exit's s, so it's identical for everyone. |
| places 🏛️ | **personal** (the buildings are **shared** town data) | The precinct / courthouse / hospital stand in every friend's town (seeded data, same metre). Walking in works in a party's 🌍 Free Roam (`canWalkIn`; still off in a lobby activity, and the bank stays shut): the lobbies are shared rooms (features/together — friends inside see each other; the clerk, the desk cop, the receptionist run on each screen for its own player). Being taken there is personal: in a town she's booked / tried / treated in THAT town and reappears at its door (friends see her puppet leave and come back at the door; presence as law / cameos give it); on the highway in a party the law and the ER keep the old flow (`claim` returns null — a warp into a town would split her from her friends). Nothing breaks for friends; no shared traffic is touched (the arrival cruiser is a plain clone). Shloime's hearings (Lakewood's Courtroom 2B) are **solo only** — in a party 2B stays locked (a set scene, not shared); Abba as her lawyer in Midwood is just her own trial's words. |
| shul 🕍 | **shared room** (the clock + calendar are the host's day) | `shul` is in `together/rooms.js` SHARED (the door tells two copies apart, like the bar): friends in a party's 🌍 Free Roam who walk into the same shul see each other (the women's section, the lobby, the kiddush room) with nametags; each screen runs its OWN gabbai / rebbetzin / candy man (a friend is a visitor nobody reacts to). The lollipop is each player's own (once per real day, in their own save, pays nothing). Strangers are never inside. What's on follows `ctx.seasons.day()` (the host's day in a party). Off in a lobby activity and in Dina's mode (the door's `canWalkIn`). |
| heist 🏦 | **personal** bits on · robberies + her own heist **off** | ON in a 🏡 Road Trip / 🌍 Free Roam run (never while a party game — race / dash / tag / a Free Roam game she's in — is on: `heist/common.js` `partyFree()`), gated per kind by `live(what)`: the cops' 🕸️ stun net + spike strip in a chase of HER OWN (law is personal; her car only, nothing touches the traffic), the 🛵 moped snatcher (a scene prop, never in the traffic; her wallet, capped + refundable) and the 🚗 thief at her parked car (foot's local stub, `footStub`). Friends see none of it (no presence needed: she's just stopped / on foot / in a chase, which presence already shows). **Still off:** Lulu's own SOLO heist (`live("job")`; in a party the vault offers the crew job instead). **Robberies are ON in a party's 🌍 Free Roam TOWNS** (ci/bankfriends stage 2, `heist/party.js`): one at a time across the party, on the screen whose scheduler drew it (it owns the robber, the getaway car — a local town driver — and the cops) and published in `d.x.rb = [id, phase 1 run · 2 flee · 3 foiled · 4 away, robber x/z ×10, car x/z ×10, car h ×1000, prop]`; friends in that town draw it (the getaway car is SOLID on their screen — a collider actor), get the same chip + beacon, and can RAM it / BOX IT IN / ✋ TACKLE the robber — their screen broadcasts `hk` AND keeps it ~5 s in its own snapshot (`d.x.hk = [owner, id, how, seq]` — a one-off broadcast can be missed by a slow screen), and the OWNER counts it (each once, re-checked every frame for ~2 s: their pose reaches it a beat late) only if it sees that friend's car / walker right there; the owner's foil goes to the party HOST (`hfo` reliable event), which checks it (a new id, members only, ≤ the solo maximum pay, ≤ `PAY_CAP` 3 paying foils per player a party session) and broadcasts the shares (`hfa` — only the host's counts): the solo pay SPLIT among the crew (helpers + friends within 60 m, ≤ 4; each ≥ 5, rounded to 5), never multiplied. Still solo: the highway Quik-Mart robbery (it reserves roadside space). **THE BANK JOB WITH FRIENDS** (stage 3, `heist/crew.js`): in the shared lobby ✋ at the vault → "💰 Plan a job with the crew" + a plan: that friend LEADS; an INVITATION is open 20 s (friends in the lobby: "💰 Join <leader>'s job" at the vault — opt-in, nobody dragged; joining needs your OWN one-a-run + cooldown to allow it); at GO the roles by join order — 🔓 THE VAULT (the leader, at the vault), 🗣️ THE TALKER (a ridiculous story at the teller's window), 🏎️ THE DRIVER (out to your car, pull up out front), 👀 THE LOOKOUT (by the guard) — one ✋ each; all done (or 45 s) → THE ALARM: the crew is out of the lobby and the law chases them TOGETHER — each member's screen asked for the partnership when the job went in (`ctx.law.crew.partners(crew, "BANK ROBBERY")`, features/law's 🔗 partners in crime), so the getaway is one crew wanted level (`ctx.law.crew.wanted(stars)`: caught together → the same precinct, the same cell, one court; coins / charges / verdicts each player's own); where law has its one call `ctx.law.partners.crime({ id, crew, charge, heat, msg })` (ci/partners) the alarm uses that instead on each member's screen (a foot cop at once on foot; its `law:crew` { id, uid, result } is her result); no crew formed (a friend left) → her own chase as solo (`law.startChase` in a car, a cop on foot after 6 s walking). Nets / strips as usual; friends can pile into one car — a passenger gets the driver's result (and features/partners' 🍌 peels). Results from each screen (`hjx`): shook them = ok, `law:arrest` = busted (in town → the precinct, out of its door — features/places). The leader asks the HOST (`hjo`) once with the solo take (the town's base × the plan + heat); the host checks it (members, ≤ `MAX_TAKE` 715, one paying crew job per friend a session) and broadcasts the shares (`hja`, host-only): the take SPLIT among the ones who got away (caught = 0). Taking part spends each friend's own heist (one a run + the cooldown). The leader leaving calls it off for everyone (no pay; chases stay personal). Wire: the leader's `d.x.hj`, broadcasts `hjin` / `hjd` / `hjx` / `hja`, reliable `hjo`. **The bank's lobby is OPEN in a party's 🌍 Free Roam** (`bank.js door()`, ci/bankfriends stage 1): a shared room (features/together, one lobby per town copy) — the teller, the line, the napping guard and the lollipop run on each screen for its own player. A party version would need: robberies from the road plan (`ctx.party.road.claim("heist", …)` for the highway Quik-Mart + a seeded getaway route — a `partyLocal` car riding a gap in the shared traffic like streets' chop target, or a seeded loop car like openworld's in a town), the foil credited to whoever stops it first (a host-validated event, like openworld's `owb`), and a co-op heist as its own lobby activity (`addActivity`: one driver, friends as lookouts, the chase personal to the driver). Test: `partyheist` |
| underworld 😈 | **pickpocket** on · the rest **off** | ON in a 🏡 Road Trip / 🌍 Free Roam run (no party game on — `underworld/common.js` `partyFree()`), gated per kind by `live(what)`: only the 🫳 pickpocket on foot (a scene prop; her own wallet, the take capped and always coming home; her rivals, the Shomrim who jog after him and his mother's text are all hers). Friends see nothing of it (she's just on foot). `why()` answers "party" while she drives and `spawn()` refuses a bad-guy car. **Still off:** the road-rager / gang car (a local car in the SHARED traffic, one screen only), Krupnik's cruiser + Velvel's shack (they reserve roadside space), the Fixer's jobs and the street's heat. A party version would need: the road-rager / gang car as `ctx.party.road` slots (seeded kind + s, a pure f(clock) tail behind the party's leader or a `partyLocal` car only HER screen draws, with friends seeing it as presence), Krupnik's / Velvel's pull-ins as seeded road-plan places (like hustle's payphones), the Fixer's jobs through hustle's party path (`partyLocal` props), heat kept personal, and the pickpocket as a personal foot prop. Test: `partyheist` (the pickpocket) |
| seasons 🕎 | **shared** (the HOST's day) | Every player publishes its own day in `d.x.cal` (`{ f: a preview \| null, t: local "YYYY-MM-DDTHH:MM" }`, `seasons/party.js`); everyone dresses the world for the host's (a guest dresses nothing until it's known — no flicker from one holiday to another). Every placement is a hash of the place (road chunk index + world seed, town + house index), never Math.random, so the same house has the same menorah on every screen. The parade's march and the people of the day (lulav walkers, the dancers, Tashlich…) stand in the same places on every screen; their animation is each screen's own (not synced). The Purim music van is solo-only (it's a town driver; a party town's traffic is the party's seeded loops). The ✋ stall treat, Ima's note and Lulu's line are personal (the treat's coins capped per real day on each device). Test: `seasons` (two real pages: the host's Purim wins over the guest's own Chanukah) |
| shops 🛍️ | **on**, personal | The places are seeded town data (the same lot, the same metre on every screen). In 🌍 Free Roam she can walk up and buy (`canShop`: not in a lobby activity); every purchase is her own wallet + save; driving a car she owns off the lot works. The test drive is solo-only (it swaps her car under her for a minute). Uncle Refael / the keepers / Shmerel's van run on each screen. The walk-in pizza shop + bakery are SHARED rooms (together/rooms.js — one per town: friends inside see each other); the one-a-run snack is each player's own. Her garage at home: solo (a party starts at the grid). |
| together 👯 (friend finder + same car) | **personal**, reads what friends already publish | The 📱 🗺️ Map (friends' dots, a destination beam), ≤ 3 edge pointers, 🧭 switch — all from the party's existing snapshots (`d.w` / the flat frame, `d.x.z`, `d.x.ex`, `d.x.at`, `d.x.pc`, `d.x.pr`) + `d.x.dr` (the door I'm in by). Party members only — never a stranger. No coins |
| unstuck 🆘 | **personal** · refused in a party game / race | The rescue only moves HER (friends see her appear at the new spot through the normal position sync, `ctx.party.respawned()`); a passenger's 🆘 = hop out beside the friend's car (`ctx.openworld.hopOut`) — the driver isn't moved. Refused while she plays a 🌍 game (`openworld.game.ph === "go"` with her in `ps`) or a race (`party.activity.k === "race"`): a reset would be a free shortcut. The automatic rescue still runs there (it only ever puts her at the nearest spot — no gain). Test: `unstuck2` (two pages) |
| airport ✈️ | **on** in a 🌍 Free Roam | Since `ci/exits2` the towns' interchanges keep out of the airport's zones (both from fixed data), so every friend plans it at the same metre: the placement is a pure function of fixed data (the same metre on every screen — tested), the planes are a pure function of the party clock (shared), the kerb vehicles / doors / the fence joke are personal props (never the shared traffic), presence "✈️ at JFK" over her car / walker in the landside |
| decor 🛋️ | **visits** on · decorating **off** | In 🌍 Free Roam (`canEnter()`) ✋ GO INSIDE works with friends — the house is right by the party's start: the first friend inside hosts the visit and everyone who comes in after sees THEIR decorations (`d.x.dc`), all of them see each other (features/together). Decorating stays hers alone: in a party the porch, mailbox and yard ✋ spots don't show, the inside slots have no picker, `buy` / `place` refuse (`why: "party"`). Outside, each screen still shows its own player's decorations (her copy of the home street) |
| realestate 🏘️ | **personal homes, shared ownership** (🌍 Free Roam only) | Every home's address / price / today's listing is a pure function of the town data + the device's date. In a party the market, the office, the bank's mortgage desk, viewings and buying work only in 🌍 Free Roam (`locked()`: a lobby activity / a race keeps it shut). Each player publishes the homes they own IN THE TOWN THEY'RE IN as `d.x.re` (`["l178,240,<minute bought>", …]`, ≤ 10) — `party.js` turns friends' lists into a registry SOURCE: a friend's home is never listed and can't be claimed, gets a mailbox in that friend's colour, and ✋ at its door says whose it is / 👯 JOIN <name> INSIDE when they're in (features/together `SHARED.realestateHouse` — the room's instance is the house id; a viewing stays personal). Visitors look, nobody redecorates in a party (like decor), no coins move. A double booking (two friends signed one home at once): the earlier purchase keeps it, the other gets every coin back + a text. Mortgage payments, rent and tenants are each player's own. Strangers never publish / see any of it. Test: `realestatefriends` (two pages). |
| airport ✈️ terminal | **shared room**, personal scripts | The JFK terminal hall is `SHARED.terminal` (one instance, "jfk"): friends in a 🌍 Free Roam party who walk in see each other walk, sit (the gate seats) and emote; presence "✈️ in the JFK terminal". Everything else in the hall is each screen's own: the crowd, the check-in / bag / security gags, the snacks (each pays her own, capped per run), the planes. The law inside is personal: walked in wanted, the guard + Rex slow her, but the real cops only come in solo. Strangers are never inside. Not enterable mid-chase; with friends only in 🌍 Free Roam (`canEnter()`). |
| airport ✈️ stage 3 (taxi runs, the lost suitcase, Dovid Dov) | **personal**; Dovid Dov **solo only** | 🚕 A JFK taxi run is a personal hustle job, and it is only offered where stage 1's airport is — stage 1 is off in a party for now, so `taxiWhy()` answers "party" (when the airport opens in a party it can follow hustle's party path: her fare, her seat, her pay). 🧳 The lost suitcase is each screen's own scene inside the SHARED terminal (Mrs. Shpilkes, the bag, Mr. Pilkes are crowd records only she sees; friends just see her walk and carry nothing special). 🎤 **Dovid Dov is SOLO ONLY** (chosen 2026-11-21): in a party the VIP carpet stays empty ("his flight's delayed") — a scene where one friend chats to a singer who isn't on the other friends' screens would look like talking to the air, and a shared version would need a host-seeded schedule on the relay. Every reward is capped per real day on each device. |
| cityhall 🏛️ | **shared room**; everything else personal / local | `cityhall` is in `together/rooms.js` SHARED (set from `features/cityhall`, the town tells two copies apart): friends in a party's 🌍 Free Roam who walk into the same town's city hall see each other; each screen runs its OWN clerks / secretary / mayor / expediter (which window is "back in 5 minutes" follows each device's clock). The ribbon cuttings and the protests are local + cosmetic (each screen its own, nothing pays). Tax, fees, permits and the lien are each player's own save (billed on THEIR played days). The inspector at her homes and the paving crew (the corruption story) are SOLO (not in a party). Off in a lobby activity and in Dina's mode (the door's `canWalkIn`). |
| clothes 👗 | **shared room**, personal buys; friends SEE her outfit | The shop is town data (`uses.clothes`) and a room in `together/rooms.js` SHARED (one per town + `"jfk"`: `ctx.clothes.shopNow()`). Trying on / buying / the fitting room / the closet are her own (her wallet, her save). Her outfit rides in the party state as `d.x.ot` (a short comma list of piece ids — `ctx.clothes.encode` / `decode`; old clients ignore it, a client that sends none = the default look); a friend's Lulu is dressed with it on the street (party/remote's walker — not in a disguise / the jumpsuit), in a shared room (together/rooms' Mate, re-dressed in place when it changes), stepping in (together/outside) and in the passenger seat (openworld/ride). Strangers in the EVERYONE room stay plain ghosts (no outfits on crowds). |

`scripts/tests3d/<id>.js`:
```js
module.exports = { name: "garage", query: "&enable=garage", save2d: { totalCoins: 5000 }, async run(t) {
  await t.click(/Shop/); t.check("shop opens", await t.L(`!!document.querySelector(".shop")`));
  await t.game(`L3.startRun({ mode: "cruise" })`); await t.until(`__lulu3d.state === "playing"`, "drives");
  await t.tap(12); await t.frames(30); t.check("missile fired", await t.game(`ctx.G.missilesFired > 0`));
  await t.shot("missile");
}};
```
Run ONLY yours, serialized with the other agents:
`flock /tmp/lulu3d-browser.lock env NODE_PATH=/opt/node-tools/node_modules SMOKE3D_ONLY=<id> node scripts/smoke3d.js --shots`.
Look at your screenshots in `smoke-shots/3d-<id>-*.png`. The game advances 1/30 s per
frame in `?test` mode (≈3–6 fps in software WebGL) — wait with `t.frames(n)` / `t.until(...)`.
`t.game(expr)` evaluates with `ctx` and `L3` (= `window.__lulu3d`: startRun, setState, damage, addCoins, emit…) in scope.

## Cross-feature contracts

Features talk to each other only through these `ctx` services and events. Provide yours at
import time (`ctx.law = {...}`); always null-check others (`if (ctx.foot) ctx.foot.start("carWreck")`),
and keep working sensibly when another feature is missing.

| service | owner | API |
|---|---|---|
| `ctx.foot` | foot | `start(reason, opts)` — Lulu climbs out and walks (reasons: `carWreck`, `crashReprieve`, `droveOff`, `copWalk`, `jailbreak`, `parked`, `bailout`, `discharged` (out of the ER with no car of hers); `opts.noIntro` when your scene already showed her getting out — she starts on her feet, no second climb-out; `at {x,z}` where she stands, `stubAi(dt, car)` to drive the car she left, `drivable`) · `active` · `script({update(dt,P,F) → true while running, camera?(dt), abort?(why)})` hands Lulu to your animation on foot · `drive(v)` puts her behind the wheel of `{vtype, key, colors, x, z, h, handling?}` (a borrowed-vehicle shell; `handling` = car stats while she drives it) · `shellObj` · `say(obj, text, sec)` · `addSpot(spot)` (`spot.short` = the ✋ button's label; `spot.first` = urgent, it wins the ✋ button over anything else in reach) · `addParked(pc)` (another feature's parked car she can hotwire — a town's kerbside cars: `{ vtype, key (the shell), colors, obj, x, z, h, circles, r, ext: { taken, drop } }`, never pruned by distance; → remover) · `chasing` (a cop on foot is after her) · `dropChase()` (he gives up) · `startChase({x, z}, {charges})` (charges: what the arrest says when he catches her) · `handoff(id, door)` (walk into `ctx.interiors[id]` from your own ✋ spot; `door` = {s, d, side} where the walk resumes) · `ownCar` — her OWN car this run: `"ok"` / `"parked"` / `"wrecked"` / `"gone"` (impounded, left behind for a borrowed ride; survives the walk ending — law and the ER read it to decide whether she gets a car back) · `dropRide()` (the borrowed ride is gone) · `facing` (her yaw on foot) · `sprayTargets()` (peds / critters / the foot cop for the garage pepper spray) · for a 🎉 party: `vel` (her walking velocity) · `animCode` / `lookCode` (what friends' walker does / wears) · `parkedCar` (`{x, z, h, key, paint, wrecked}` the car she left) · `bump({h, speed, who})` (a friend's car knocked her flat — no heart in a party) · `heightCode` (her feet's height, dm, rides in `d.x.f[2]`) · **the jump** (`features/foot/jump.js`): `airborne` · `height` (her feet, m) · `ground` (what's under her: 0, a bench 0.55, a hood ~0.95, a roof 1.45) · `jump(opts)` (launch on her next walking frame; moves' slide → `{ long: true, vx, vz }`) · `frameYaw` (the yaw "up on the stick" walks toward = the free camera's) · `JUMP` (tuning) · `LOW` (collider kind → `{ top, stand }`: **a collider of one of these kinds is only solid below its top** — `bench` 0.55 + `chair` 0.5 standable, `rail` 0.8 hop-over, `car` 0.95; any other kind stays solid at every height; parked / stopped car-shaped cars are two boxes, hood + roof, `carDims`). Events `foot:jump` {long, from} · `foot:land` {y, hard, over, kind, long}; stats `footJumps`, `footPerches`. A new low thing: give its collider one of these kinds (or add a kind to `LOW`) |
| `ctx.foot.bounds` | foot | (`features/foot/bounds.js`) the soft world edges + nudges: `EDGE` (terrain bands by \|d\|: tall grass 30 m, mud 42 m, the fence line 52 m — tune here) · `NUDGE` (the aimless clock: sore feet 40 s, Ima 70 s, a ride 95 s, then every 45 s; `gap` between nudges; jaywalking warn/★) · `state` · `zone` · `visuals` · `debug.{shoo(kind), aim(s)}`. Off during a foot chase / law flow (only the fence stays solid), in interiors and cutscenes (footRun isn't updating), in the town (`ctx.town.active`) and parties (both get the old far fence); the nudges are gated `ctx.enabled("foot") && ctx.enabled("footbounds")`. Events `foot:shoo` {kind}, `foot:nudge` {kind}; stats `footShooed`, `footRides`, `footBenchSits` |
| `ctx.interiors[id]` | interiors | `{ name, emoji, enter({ exit }) }` — foot shows a door and calls `enter({ exit: () => back to walking })`. ids: `bar`, `school`, `hospital`, `police`, `beach`, `home` (features/homes: any town house — a procedural Room, entered via `ctx.foot.handoff`), `luluHome` (features/decor: Lulu's own house, from her porch) |
| `ctx.law` | law | `startChase(reason, {heat, msg, at: {x, z} (the witness who saw it leads the chase)})` · **heat before a chase** (cops.js `notice` / `callIn` / `changeLook`): `notice(charge, {msg, warn, witness, src, amount})` a PETTY offense a cop saw — the first is a ⚠️ WARNING (`suspicion` 0–1, drains ~22 s of clean driving), another while it is live (or `amount` 1: reckless — nitro / > 92 mph) is the chase · `callIn(charge, {msg, delay})` a witness phoned it in: 📞 `reported`, after 8–14 s one unlit cruiser prowls up the road looking for the car she is in (sees her ~1 s → chase; she switches cars / paints / ditches it / keeps out of its way 35 s → called off) · `changeLook(how)` a new car / paint / disguise unseen: drops a call-in + the warning, and `lowKey` — the warrant file does not know her this run (`wanted` 0) · `copSees(x, z, r)` a cop with a clear line of sight (crimes only count when SEEN) · `hiding` mid-chase she is stopped (≤ 4 m/s) + tucked away while they search (`cops.js hideInfo()`): "lot" (a rest area's lot) / "verge" (> 9.2 m off the highway's centre line) / "town" (`ctx.town.hideSpot`: at the kerb among parked cars, or off the street surface — never a travel lane, a crossing or an empty kerb); verge + town also need no chasing cruiser with a clear line of sight within `tune.hideSeen` (25 m). Hidden, cruisers only spot her within 10 m and the LOSING THEM meter runs 2×; stopped somewhere that does not count, the HUD hint says why ("not hidden — park at the kerb or get out of sight"). Searching cruisers drive on to where she was heading (in a town: `ctx.town.searchPoint`, then crossing to crossing with `prowlPoint` — they do not know where she is) · `lose(how)` (unseen: she got away — `town:enter` while they search does it) · events `law:warning` {charge, heat}, `law:bolo` {active, charge | why}, `law:look` {how, had} · `arrest(charges[], opts)` · `wanted` (0–5) · `chasing` · `searching` (lost sight of her: the stars flash) · `searchProgress` 0–1 · `clearHeat(msg)` · `copNear(x, z, r)` · `addWarrant(charges)` · `hold(sec)` · `crew` (🔗 partners in crime with friends — `law/crew.js`: `current()` · `partners(uids, why)` · `wanted(n, reason)` · `bust(charges)` · `leave()` · `friendsInside()` · `bailOut(uid)` · `springOut(uid)`; see Partners in crime) · `spot(sec)` (a tip-off — features/community's Shomrim radio: mid-chase she counts as SEEN for `sec`) · `trap(ahead, side)` (park a hidden speed trap up the road — another feature wants a cop around) · `clearWarning()` (wipe a live ⚠️) · `addCharge({key, name, weight, cop, lulu, defense, court, nudge})` (a feature's charge gets its own arrest lines, the lawyer's argument and a courtroom event that always plays — `chargeEvent(charges)`) · the pull-over asks `ctx.underworld.bustOffer()` before her tactics · `lightBar(obj)` → `{set(on, t)}` · `tune` (the pursuit table: cop speed × her top speed, sight range, search time by ★ — tuned with the streets chase lab)  **Releases follow her wheels:** `service.js` `captureRide()` notes at the arrest whether she was in her own intact car (`own`), a `stolen` ride, a `wrecked` car or none (`impounded`); bail / a fine / dismissal / a jailbreak hand back only her own car — otherwise she walks out (copWalk / the jumpsuit jailbreak on foot); served time always walks. The ER does the same (`discharged`). · for a 🎉 party: `partyUnits(n)` (her lit cruisers as `[x×10, z×10, h×1000, …]` for friends' puppets) · `standDown(why)` (a pursuit winds down — law/index.js does it during party races and Free Roam games) |
| `ctx.streets` | streets | `carjack(car?)` (on foot) · `ride` {kind, color} · `jacking` · `canBail()` / `bail()` · `bailHint()` · `rides` (jackable kinds + handling — features/rides adds its fleet here) · `cams` (ride model key → {d, h}: a roomier chase cam for big rides) · `roadblock(ahead, {gap, spikes})` · `spikes(s, d)` · `flat` / `puncture()` / `repairTyres()` · `paint.{cost(), nearest(), enter(), repaint(color), color}` · `damage` ($ this drive) · `smashNear(x, z, r)` · `chop.{request(), job}` · `debug.sim({stars, seed, bot, gap})` (the chase lab) |
| `ctx.er` | cameos | `admit(reason)` — the ER visit (now and then after a knock-out; its bill instead of the tow fee; a patch-up leaves 2 hearts, a bonus 3). In a town (or, solo Cruise, the nearest town) it's that town's hospital and she walks out of its door (features/places) |
| `ctx.civic` | places | the civic buildings (precinct, courthouse, hospital, impound lot): `spot(kind)` (the door, world coords; `cx/cz` the model centre) · `here` · `names()` · `enter(kind)` (walk in) · `place` (where she's being taken: `{kind: law \| er, id, exitS, here}`) · `claim(kind)` · `tick()` · `ready()` · `walkOut({door, car, reason, impound, soft})` · `arrive({charges, sResume})` (the `placesArrive` beat) · `clear()` · `roadside` · `nearest(kind, lapM?)` (THE rule, ci/roadside) · `judgeLine()` · `debug.{impoundedCar(), STAY}`. ARCHITECTURE › Places, › Roadside places |
| `ctx.crime` | crime | 🦹 town crimes (solo): `active` (in a town with the feature on) · `PAY` / `TUNE` (data.js — every cap and knob) · `paidToday(kind)` · `start(kind)` (`"cart"` beside the cart on foot · `"park"` stopped double-parked · `"air"` at the stand · `"herring"` at the kiddush table) · `corruption.{who(id), list(), evidence}` (for `ci/cityhall`: Malka / Tuvia / Pinchas — mood friendly · bribed · partner · nervous · gone) · `debug.{CR, SAVE, CART, JAY, PARK, force: {cop: true \| false}, settleJay(), parkEnd(), today(), day (a Date: tests), log}`. Events `crime:<ev>` (pay, warn, chase, cart, jaywalk, park, monte, watch, porch, tags, herring, air, malka, scene, evidence, hush, ia, cop) + `crime:corrupt` {who, act: bribe · cut · hush · exposed · wink} + `crime:porch` {id, fam, phase: back · kept · gone} (features/homes); stats `crimeCartRides`, `crimeCartMeters`, `crimeJaywalks`, `crimeJaywalkSprees`, `crimeDoubleParks`, `crimeChases`. ARCHITECTURE › Town crimes |
| `ctx.avigail` | cameos | `rel()` 0–100 · `bump(d)` (writes shared `avigailRel`) |
| `ctx.phone` | journey + phone | journey: `call({ from, emoji, lines, onAnswer, onDecline })` — the in-car call card (Ima's calls use it) · `text({ from, emoji, color, msg, dur, thread? })` · `active` / `talking` / `busy()` / `hangUp()` / `prop(on, pose)`. phone (`features/phone/`): the 📱 phone screen + apps — see **Lulu's phone** below |
| `ctx.parking` | parking | the 🅿️ Parking Challenge on a REAL lot (`features/parking/course.js`: a course in every rest area's truck lot). `start({ challenge: true, from, level })` — at a course's START box (in her car, state `playing`) the run begins (state `parking`: a DRIVING state — `updateDriving` with the lot governor, its own camera); anywhere else the nearest / next course is MARKED (a beacon over the START box) · `active` · `phase` (`setup` · `drive` · `result` · `box`) · `here()` · `mark()` · `holdsStop()` (foot's get-out stands down in a START box) · `pose()` → null (the roadside lot's party poses are gone) · `debug.{toBox, place, bay, local, courses, autopark, endRun, unlock, CO}` · events `parking:run` {phase, level, victory, why}, `parking:result`, `parking:unlock` |
| `ctx.journey` | journey | `stop()` (current stop def), `stopIndex`, `mode`, `start(i, extra)` (a story run at leg i; `extra` = more startRun opts — onegame's `home` / `homeAt` / `rolling`). The trip card's way out is 🏠 Head home (`ctx.onegame.home`) and a map launch goes through `ctx.onegame.roadTrip` (no 3-2-1) |
| `ctx.garage` | garage | `items()` (counts), `use(id)` |
| `ctx.play` | play | `dreidels` (lifetime ✨), `jump` (live stunt-jump state or null), `photo`, `openPhoto(from)` — 📸 photo mode is state `playPhoto` (it freezes the current state WITHOUT `setState`: no exit/enter/`state` event, restored exactly on exit) |
| `ctx.banter` | banter | `say(cat, opts)` · `billboard(…)` · `reply(car)` · `gesture(name)` · `bubble(text, object3D, {dur, y, cls})` (a pooled speech bubble over anyone) · `addAd(def)` (another feature's billboard design, never random) · `billboardAt(chunk, s, side, id)` — Lulu's one-liners (`banter:line` {cat, text}) and the in-car rig |
| `ctx.atmos` | atmos | `night` (0–1), `clock` (0–1, the Cruise day), `weather`, `info()` · `debug.{time(name\|t), freeze, weather(kind, strength, instant), rainbow, strike, flock(kind), plane(text), balloon}` — in Cruise it blends the sky/fog/sun over journey's per-leg palette (Story keeps the leg's lighting), wets/snows the road + ground materials, lights house windows; all restored on the title. A run may drive the Cruise-style day itself: set `G.atmosClock = () => 0..1` (+ `G.atmosClear = true` for a clear sky) and atmos runs its day/lamps off that clock in any mode, skips the phase toasts, and puts the Cruise clock back afterwards (shabbos uses it: the sunset IS the deadline) · `look()` (the sky + light + weather the driving scene last showed) · `dress(set, {lamps, sky, stars, fog, lights, weather})` / `undress(set)` — an OUTDOOR cutscene set wears that sky (dome, stars, fog, light, rain/snow + its sound, lamps after dark); the clock stands still behind a set, so walking in and out match (`features/atmos/dress.js`; the precinct steps, the roadside parking lot, Avigail's porch, the wedding, the beach) |
| `ctx.accounts` | accounts | 🪪 accounts + usernames (server/accounts.mjs): `on` (the server answered) · `name` (hers, or null) · `view` (the last hello: `me` {name, gen, ask, next, who}, `friends`, `inReq`, `outReq`, `blocks`, `badge`) · `hideNames` (⚙️ other players' names off) · `off` (she deleted her account) · `rules` (rules.js) · `hello(force)` · `check(n)` → {ok, why, sugg} · `ideas(base)` · `setName(n)` · `nextChange()` · `needsName()` · `ticketFor(room, rid)` (my signed ticket for a relay connection) · `ghostName(room, rid, ticket, {always})` (another player's name from the server, or null) · `report({f} \| {t, room, rid})` · `deleteAccount()` · `call(path, body)` · `addHelloExtra(fn)`. Events `accounts:me`, `accounts:view`, `accounts:names`, `accounts:deleted` |
| `ctx.mp` | multiplayer | 🌐 Shared Road + the ambient EVERYONE layer: `connected` · `riders` · `room` · `online` (⚙️ Play online) · `setOnline(on)` · `near` (riders drawn right now) · `ghostStats()` → `{built, shown, cap}` · `open(from)` (the Shared Road screen: name + EVERYONE / a 2D friend code) · `connect(room)` / `disconnect()` · `emote(idx)` · parking `parkingRng()` / `parkingSpotIndex()` / `parkingGhosts()` · boards `postWanted(charges)` / `wantedList()` / `scoresList()` · `_debug` (= `MP`). Events `mp:status`, `mp:riders`, `mp:online` {on}, `mp:race`, `mp:honk`; stats `mpEmotes`, `mpRaceWins`, `mpBonks` |
| `ctx.party` | party | `active` (in a party), `connected`, `code`, `seed`, `clock()` (the shared party clock, s), `isHost`, `players`, `activity`, `hostParty({act})` / `hostRoam()` (🌍 Hang out: straight into Free Roam, no lobby / grid) / `joinParty(code)` / `leave()` / `openHub()` / `invite()` (share the link: `…/3d/?party=CODE&with=<my uid>`) / `inviter` (whose link I opened — Free Roam drops me beside them), `trafficAt(t)`, `atmosClock()` / `atmosWeather()` — Party with friends (`features/party/`: `net.js` netcode over relay protocol v1, `remote.js` friends' cars, `traffic.js` the seeded traffic, `stage.js` the lobby/podium). Events `party:status`, `party:act`, `party:host`, `party:player`, `party:bc`, `party:synced` · **for another feature's lobby activity** (openworld's 🌍 Free Roam): `addActivity(k, def)` (def: `emoji name blurb go`, `init(A)` → extra A fields, `slotIn(A)` late join, `respawnAt()` ↺, `label(icon)` / `progress()` trip bar, `show(p)` / `frame(p)` / `decorate(rc, p)` friends' cars, `pose()` → `{s, d, h}` my pose in another frame, `planFirst`, `ownTraffic()`, `noGrid` (no 3-2-1: everyone just goes)) · `sendEvent` / `broadcast` / `onHostEvent` / `setA` / `members()` / `peer(uid)` / `fresh(p)` / `setExtra(x)` (rides in `d.x`) / `displayName` / `skinOf` / `skinHex` / `remoteCar(uid)` / `beginRun` / `placeCar` / `respawned()` / `visuals` · **the shared world** (`plan.js`): `rng(key)` · `seeded(key, fn)` · `h01(key, k)` · `road.{claim(id, kinds), slot(k), list(s0, s1), span}` (see Testing › party). A party run ends with `endRun("party")` (run:end) · **presence** (`presence.js`): `presence({ mode, icon, label }, { sticky })` what I am doing (held until my state changes; null = automatic: drive · chase · foot · in · law · jail · court · er · scene · lobby …) / `presenceOf(uid)` → `{ mode, icon, label }` / `presenceBadge(uid)` (the nametag chip) / `setX(k, v)` a per-feature key in my snapshot extras `d.x` (tiny; keys in use: `pr f pc v cp ws at jk cl e`) / `claimTraffic(car)` (a shared car leaves the traffic for everyone — carjack) / `trafficGone(key)` · **claims** (see Testing › party): `claim(car, {L, dS, hail, how})` / `canClaim(car)` / `claimKinds(prefix, handler)` / `sharedCrash(car, e)` / `claimsLive()` / `claimPose(key, T)` · `addTrafficKind(kind, w, on)` (a special vehicle in the shared traffic, at boot) · `friendCars()` (friends' cars as drawn: cosmetic contact) · events `party:claim` {key, how, hail}; stats `partyClaims`, `partyHails` · `_debug.world(uid)` / `_debug.xk()` (tests) |
| `ctx.hustle` | hustle | `job` (the active side job `{id: "cab" \| "getaway" \| "delivery", phase, def…}` or null) · `start(id, opts)` · `end(result, why)` · `offer(id, "marker" \| "phone")` · `marker` · `hold(s)` (no random offers) · `register(id, create, def, {listed})` (another feature's job type on this framework — underworld's Fixer; `listed()` → the extra ids the 💼 Jobs app shows) · `radio` `{station, name, stations, cycle(dir), tune(id), state()}` · `log` · `openLog()`. Events `hustle:start` {id, via}, `hustle:end` {id, result, why, pay}, `hustle:heist`, `hustle:bag` {lost}, `hustle:radio` {station}. Riders sit in roadevents' seat (`ctx.roadevents.seat(person, {keep, pose})` / `unseat(person)`) |
| `ctx.town` | town | `active` · `id` / `name` · `street` (the street she's on) · `streets` · `occluders` (world rects) · `enter({town: "lakewood" | "midwood", speed})` / `leave(why)` (no ramp: tests/debug) · `load(id)` / `loaded(id)` (a town's models) · for law: `blocksSight(ax, az, bx, bz)` · `copRoute(car, u, to?)` → `{gap, aim(la, out)}` (to her, or to `to` {x, z, s}) · `hideSpot(x, z)` → `{ok, spot: kerb | mall | walk | yard | lane | junction, why: lane | empty}` · `searchPoint(last)` / `prowlPoint(at, car)` (where a searching cruiser drives) · `copSpawn(how)` → `{s, d, dir}` · for foot: `footYaw(F, roadH, dt)` · `towns` (the data) · for features that live in a town: `def` (the current town's data), `allowState(name)` (your state may play in town), `spot(name)` (a built spot in world coords: pizza, hall, a `uses` landmark…), `exits` (`[{s, id, name, town, emoji, no, label, branch}]` this run: one row per town an interchange offers) · `span` ({a, b}: an exit's signs → ramps, relative to its s), `addDriver(kind, {minD})` (a lane-following town driver the town never respawns), `curbSpot({len, near, minD, maxD, still})` (a free stretch of parking lane; `still`: only parked cars count — a party's seeded pick) · `debug`. Events `town:enter` {town, exitS}, `town:leave` {town, why: highway \| wreck \| quiet \| reset}, `town:gossip` {kind, msg}, `town:talk` {id, line}, `town:stopSign`, `town:bump`, `town:geese`, `town:bike`, `town:oneway` {street}, `town:train` {line}; stats `townVisits`, `townStopSigns`, `townTalks`, `townGossip`, `townEscapes`, `townWrongWay` · for openworld: `plan` (PL, local frame) · `spots` (landmarks, local) · `coins` · for homes: `homes` (the houses' model origin + frame + lot point, world) / `drives` (driveway minivans) · `people()` → [{id, name, x, z}] |
| `ctx.community` | community | The 📞 **Phone** app (`calls.js`, app id `community`, order 22 — right after 💬 Messages) is on the phone EVERYWHERE she has it (highway, rest areas, both towns; car and foot): Chaverim · Hatzalah · Shomrim · 911 · 👩 Ima (a sweater, no reward) · added contacts. Help comes anywhere: in town round the grid, on the highway from behind (in the car once she's stopped — at speed the call card says "pull over"; on foot to where SHE stands, `luluRoad()`), across a rest area's lot (off the lanes the responder drives straight to her). Shomrim only in a town. Lines name the town (`towns.js` FLAVOR + `local()`: Midwood says Coney Island Ave / Avenue J); Midwood has all three orgs but NO cruisers (its triangle / draw-call budget — they come when called). `active` (in a town with volunteer orgs) · `towns` / `register(id, cfg)` / `config(id)` (the per-town registry, `features/community/towns.js`) · `vehicles` · `scene` · `chase` · `help` · `by` · `heat` · `startScene(kind)` · `call(org, reason)` / `reasons(org)` · `addReason(org, fn)` (another feature's reason to call an org: fn() → {id, icon, label, sub, run} | null) · `addContact({id, icon, name, tag, color, render(el)})` (a contact with a page of its own in the 📞 **Phone** app, below Ima — world's 🏡 Family & places is one; the phone stays one 3 × 3 screen) · `nothing(org)` (the one line an org says when there's nothing to call about here) · `heal` {max 3, gap 60 s, left} (hearts from the volunteers, called or not, per run) · `gasGap` (90 s between Chaverim nitro refills) · `callOut(org, lines, then, done)` · `request(kind)` (`fix` `gas` `tow` `unlock` `patch` `fine` `visit` `geese`) · `shomrim(reason, {join, withCops})` / `endShomrim(why)` · `blend({auto})` · `stats` · `debug`. Events `community:scene` {kind, org, phase, byLulu}, `community:help` {kind, org, phase}, `community:shomrim` {active, reason, lead, join, called, why}, `community:hold` {result}, `community:by` {phase, result}, `community:call` {org}; stats `communityChesed`, `communityHelped`, `communityPatched`, `communityCalls`, `communityShomrimChases`, `communityHolds`, `communityBlends`, `communityBlendTries`, `communitySelfReports`, `communitySurrenders` |
| `ctx.homes` | homes | `inside` · `house` ({name, key, mode} \| null) · `homes()` (this town's front doors: `[{i, key, name, cast, ap, door, model}]`, `ap` = where to stand) · `enter(i, mode: "sneak" \| "guest" \| "kid", via: "door" \| "window")` · `knock(i)` · `family(key)` → what that family remembers `{visits, seen, burgled, guest, items}` · `crowd()` (counts + LOD / perf numbers) · `debug.{room(), use(item, kind), near(kind), report(i), force.{knock, unlocked, cop}, startCrowd(), stopCrowd(), RUN, VISIT, CR}` — 🏠 living towns + houses (`features/homes/`). Events `homes:enter` {key, name, mode, via} · `homes:exit` {key, name, exit, reported, spotted} · `homes:knock` {key, outcome: kvetch \| meal \| kid \| nobody \| again_bad \| again_good} · `homes:use` {item, who, fx, line} · `homes:spotted` · `homes:called` · `homes:report` {key, charges, chase} · `homes:couch` {coins, capped} · `homes:recognized` · `homes:grab` · `homes:cholent` · `homes:souvenir` · `homes:hit` · crowd: `homes:wave` · `homes:gossip` · `homes:scatter` · `homes:honked` · `homes:talk` · `homes:jingle`; stats `homesVisits`, `homesBreakIns`, `homesGuest`, `homesKnocks`, `homesItemUses`, `homesCouchCoins`, `homesSpotted`, `homesReported`, `homesWindowExits`, `homesCholent`, `homesSouvenirs`, `homesScatters`, `homesGossip`, `homesChats`, `homesLemonade` · **who lives here** (stable door ids `town:lx:lz` = the door in the town's own frame, the same as `ctx.realestate.keyOf`): `household(id)` → `{id, name, family, cast, names, ap, door, status}` · `householdAt(x, z, r)` · `livedIn(id)` · `idAt(x, z)` · `claim(fn(id, home) → status \| null)` (any status = homes gives the door up: no family, porch scene, knock, break-in or ✋ — real estate uses `mine` / `rented` / `empty`…; homes' own: `lulu`, `moved`) → unregister fn · `refresh()` · `moveOut(id, why)` / `moveIn(id)` · **life**: `sceneAt(id)` → `{id, name, emoji, here, traits}` · `opinion(key)` · `jobs()` (today's ledger + caps) · `delivery`. Events `homes:moved`, `homes:caught` {who, how}, `homes:guest`, `homes:treat`, `homes:wet`, `homes:waveIn`, `homes:offer`, `homes:job` {type, paid, capped}, `homes:jobStart`, `homes:jobDone`, `homes:task`; stats `homesFavours`, `homesJobCoins`, `homesPlayed`, `homesCleaningLady`, `homesWaveIns`, `homesAfikoman` · **households other features bring** (features/family): `addHousehold(fn(townId, ctx.town) → [{key, name, cast, names, colors, door, ap, nx, nz, rooms, palette, basement, scenes, scene(w), menu(api), talk(kind), label, inside}])` · their jobs on homes' ledger: `jobsAdd({type: {emoji, name, pay, cap, deliver}})` · `pay(type)` · `paid(type)` · `errand({type, to, fromName, label})` |
| `ctx.family` | family | `avigail()` ({where, hall, door, rode, pending}) · `secret` ({n, of, day}: Shloime + Toby's beats) · `where()` → Fayge's `{where: home \| playgroup \| makolet \| bakery \| clothes \| ima \| walk \| away, scene, ash}` · `isFamily(x, z)` (her house: real estate never lists it) · `fayge` ({x, z, where} \| null) · `debug.{F, SAVE, force.{where, scene}, placeOf(where), talk(), home()}` — 👨‍👩‍👧 Lulu's sister Fayge, Ash + Chani (`features/family/`). Events `family:place` {where} · `family:knock` · `family:talk` · `family:chani` · `family:circle` {paid} · `family:bags` {paid}; stats `familyVisits`, `familyCircle` |
| `ctx.openworld` | openworld | `partyTowns()` (towns on in a party = 🌍 Free Roam) · `seeded(key, fn)` (Math.random seeded from the party for fn) · `zone` ("" highway \| town id) · `game` (a copy of the live game) · `start(k)` → "" or why not (`cnr` `pin` `kugel` `photo`) · `end()` (host) · `warpTo(uid)` · `pin({x, z, name, icon, uid?})` / `unpin()` / `pinned` · `townLoops()` (a party town's block loops, read-only: community's org cruisers ride them) · `debug`. Events `openworld:start` {k, n}, `openworld:warp` {zone}; stats `owGames`, `owWins`, `owBusts`, `owStashes`, `owSnaps`, `owWarps` |
| `ctx.memory` | memory | `grudges` (live list of remembered carjack victims `{id, name, key, colors, kind, color, run, seen, lastRun}`, ≤ 6) · `notoriety()` → `{score, level 0–4, title, arrests, mugshots, escapes, er, carjacks, maxStars, grudges}` · `remember(kind, data)` (`"grudge"` streets:carjack-shaped · `"poster"` {heat, why} owes a WANTED billboard · `"text"` queues a text · anything else → a capped log) · `recall(kind)` (a copy) · `recognize(who, info)` → a rate-limited line or `""` (`"cop"`, `"moishe"` {color}, `"hitch"` {event: pick\|pass\|drop}, `"avigailRoad"`, `"avigailPorch"`) · `spawnGrudge(rec?, {act, behind})` → Promise<car> (acts `yell` `tailgate` `brakecheck` `cops` `forgive`) · `canMeet()` · `forgive(rec)` · `text(t, {next, after})` · `poster(ahead, side, variant)` · `runs`. Events `memory:grudge` {name, kind, color, act, seen}, `memory:billboard` {variant, key, s, side} |
| `ctx.underworld` | underworld | `heat` (0–100) · `level` {i, name} · `addHeat(n, why)` · `enc` (the live bad-guy encounter {kind: rager \| gang \| pickpocket, phase, result, rival, stolen}) · `offer` (Krupnik's cruiser / Velvel's shack up the road {kind, s, done}) · `rivals` · `SPAWN` / `TUNE` (the knobs, `data.js`) · `bustOffer({reason})` (law/bust.js asks at a pull-over) · `live` · `why()` ("" = a bad guy could show up now) · `spawn(kind, opts)` · `debug {UW, SAVE, force: {offer, sting, hot, flat, trap, always, report}, log, shoulderCop, placeShack, fixerOffer, callShomrim, chaverimFlat, shomerAfter, tackle, payOwed, reset}`. Events `underworld:<ev>` (offer, bribe, velvel, hot, encounter, bump, flat, end, shomrim, chaverim, pick, owed, job, fixer, heat); stats `uwBribes`, `uwStings`, `uwVelvelFixes`, `uwVelvelPaints`, `uwVelvelSales`, `uwJobs`, `uwRagers`, `uwGangs`, `uwPickpockets`, `uwBumps`, `uwCopBusts`, `uwShomrimCalls`, `uwShomrimBusts`, `uwTackles`, `uwChaverim`, `uwBadBusts`, `uwBadEscapes` |
| `ctx.shops` | shops | `guide(back)` (the 🛍️ Where to shop card) · `places()` (rows: id, name, sells, where) · `dest()` / `setDest(id)` (the marked place: `dealer`, `garage`, …) · `openLot(skin)` · `openGarage()` · `debug { dealer, garage, guide, card }`. Buying anywhere: `garage/buy.js` (`buy(kind, id)`, `buyCar`, `buyItem`, `buyHorn`, `buyDecor`, `equipSkin`, `owns`, `countOf`, `priceOf`). Foot helpers it added: `ctx.foot.parkedCar` ({x, z, h, drivable} of her parked car), `ctx.foot.repaintCar()` |
| `ctx.clothes` | clothes | `current()` (what she wears: `{ top, skirt, tights, shoes, outer, acc }` piece ids) · `owns(id)` · `owned` · `wear(outfit, why)` (ONLY from a closet / a fitting room) · `dress(obj, outfit)` (dress any Lulu model) · `encode` / `decode` (the compact form for other players) · `pieces` / `slots` / `shops` · `enterShop()` / `enterAs(id, {exit})` · `shopNow()` · `placeCloset(rt, opts)` · `outfitOf(partyPlayer)` (a friend's, from `d.x.ot`) |
| `ctx.places` | world | `add(def)` a pull-in place (`{id, name, icon, kind, where(mode) → [s…], d, bay: {half, d0, d1}, model, sign, colliders(spot), host(spot), cam(spot, t, pos, look), dur, beats: [{t, run(spot)}]}` — a town can register its own) · `get(id)` · `list()` · `spots()` (built ones near the car) · `at(id)` (positions this mode) · `visits(id)` · `inside` · `visit(key)` · `home {ready, phase: "parked" \| "arriving", park {x,z,h,s,d}, parked(), depart(), holiday(), decor, extras}` · `debug {clock(v), localClock(date), parkNow(), holiday()}`. Events `world:depart` {mode}, `world:home`, `world:visit` {id, s}, `world:holiday` {id} |
| `ctx.exits` | exits | `rests` (`[{s, k, name}]` planned this run) · `spans()` (`[{a, b}]` each rest area's signs → accel lane: town's exit planner keeps out) · `inside` (the rest area she's in, or null) · `next` (what the next-exit chip shows) · `dealOfDay` · `debug.{RS, LY, LIFE, restAhead(ahead), pt(i, u, d), actAt(kind), modelsReady()}` — 🛣️ highway exits & 🅿️ rest areas (`features/exits/`). Events `exits:rest` {phase: enter \| leave, s, name}, `exits:talk` {id}, `exits:food` {id, cost}, `exits:restroom` {gag}, `exits:vending` {result}, `exits:souvenir` {id}, `exits:picnic`, `exits:dog`, `exits:pump` {result}, `exits:mechanic` {result}; stats `restStops`, `restMeals`, `restRestrooms`, `restSnacks`, `restKicks`, `restSouvenirs`, `restPicnics`, `restDogPets`, `restTalks`, `restFills`, `restRepairs` |
| `ctx.unstuck` | unstuck | 🆘 "I'm stuck": `now({ car })` (rescue now — no confirm, no cooldown check; `car: true` on foot brings her parked car too) · `offer()` (is 🆘 in the pause menu now) · `refusal()` (why it'd be refused — a party game, a race, the parking challenge — or null) · `cooldown` (s left) · `spot("car" \| "foot" \| "kerb")` (the nearest surely-normal spot) · `normal(x, z, kind)` (why a spot isn't normal: `collider:<kind>` \| `block` \| `water` \| `car` \| `parked` \| `nan` — or null) · `debug.{U (log, autoOff…), badNow(), clearFades(), carBad(), hatch, button}`. `ctx.pauseHatch` (set by it every 0.5 s): a non-pausable world state that has hung — app.js / `pause()` let Esc / Options / ❚❚ pause it. Event `unstuck` {how, auto, dist}; stat `unstucks`. ARCHITECTURE › I'm stuck |
| `ctx.feel` | feel | `damage.{k, stage, info(), repair(why) → bool, hit(side), undo(n)}` — the wear on Lulu's own car (k = hits shown, stage 0–4: dents → cracked windshield → smoking hood → last heart: hubcap off + dragging bumper; never more than the hearts lost) · `debug.{wear(k, side), audio(), emitters(), passes(), muffle()}` |
| `ctx.life` | life | 🍃 ambient details, all local + cosmetic (`features/life/`): `info()` (`{on, foot, town, season, steps {n, kinds, surf}, puddles {level, sites, drawn}, wind {gusts, leaves, flyers, piles, pilesKicked}, ambience {sounds, kinds, crickets}, splashes, carSplashes, soaked, flyersRead, pilesKicked, puffs {chimneys, smoking, manholes, steaming, vents, chim, steam, vent, smelled}, pigeons {flocks, live, drawn, flying, scattered}, alarm {live, alarms, blinks, lines}, friends {near, steps, surf}, lines}`) · `sounds` (get/set: ⚙️ 🐦 Street sounds) · `debug.{rain(level \| null), season(s \| null), gust({dir, leaves, flyer, flyerIdx}), flyer(i, dir, lat), happen(kind), puddle(kind), pile(), probe(kind), off(v), stats, WIND, cold(v \| null), puff(kind), flock(kind), scatter(kind), lineReady(), fakeParty(p), PUFF, PIG, ALARM}`. Events `life:gust` {dir} · `life:pile` {x, z, car} · `life:flyer` {i, title} · `life:pigeons` {x, z, why, kind, n}; stat `leafPiles`. Round 3: `info().windows {houses, panes, drawn, lit, tv, dark, flips, fullT}`, `info().breath {on, breaths, people, exhaust, mist, mistOn, huff}`, `info().radio {hooked, topic, said, log}`, `info().storm {claps, dogs, blips, eeks}`; `debug.{pane(kind), house(), mist(v \| null), radio(kind), WIN, WN, BREATH, BR}`. Listens to `town:parkedHit` ({obj, alarm} — the bumped car), `foot:hotwireFail` ({obj, key, x, z, town}) and `atmos:thunder` ({near}); offers DJ lines through `ctx.hustle.radio.topical(fn)`. Reads (never writes) `ctx.atmos` (`night`, `wet`, `weather`), `ctx.town` (`plan`, `hideSpot`, `people()`, `homes`, `spot(name)`), `ctx.party` (`members()`, `remoteCar(uid)`), `ctx.foot` (`pos`, `vel`, `ground`, `airborne`, `bounds.zone`, `say`), `ctx.seasons` (`is`, `day`), `ctx.banter.bubble`, `ctx.car.fx` |
| `ctx.shabbos` | shabbos | `active` · `phase` ("drive" \| "arrive" \| "done" \| "late") · `left` (s to candles) · `total` · `dest` (Bubbe's house = `ctx.journey.stopS(0)`) · `start(via)` (a fresh rush, `G.mode = "shabbos"`) · `offer()` (Cruise: Ima's "Oy, it's erev Shabbos!" call; letting it ring turns the drive into the rush) · `friday()` · `atDoor()` (a Friday afternoon she hasn't made it yet, solo: world's home start makes it Ima's line, and her hop-in at home (`world:depart`, not `left`) arms the rush with via "home"; ▶ PLAY's subtitle says so — no title chip) · the result card's way out is 🏠 Head home · `records` · `debug.{date(iso), setLeft(s), setFrac(u), line(), props(), info()}` — 🕯️ Erev Shabbos Rush (`features/shabbos/`). Events `shabbos:start` {via, total, dest}, `shabbos:call` {i, result}, `shabbos:candles` {margin, pay}, `shabbos:late`, `shabbos:end` {made, margin}; stats `shabbosMade`, `shabbosLate`, `shabbosCandles`, `shabbosMargin` (best) |
| `ctx.seasons` | seasons | **stable "what is today" API for other features:** `day()` → the calendar day whether or not the decorations setting is on (the host's in a 🎉 party, null until it arrives; `?season=` previews count) and `is(id)` (`"friday"` = Friday afternoon, `"shabbos"`, `"chanukah"`, any id in `seasons/calendar.js › DAYS`) — read these, don't re-derive dates; `today()` (what the world is DRESSED for — null with the setting off) → `{ key, heb: {m, d}, wd (the Hebrew day's weekday, 6 = Shabbos), evening, ids, main, chanukah (1–8), shabbos, yomtov, erev (Friday afternoon), candles, quiet, forced, source: device \| pinned \| forced \| host }` · `ids` · `main` · `on` · `dressed` · `info()` · `debug.{season(id, n, {wd, eve}), date(iso), lit(0..1 \| null), rebuild(), treat(x, z), stands(), items(kind), resetPaid(), D, S, SAVE}` — 🕎 the world follows the real Hebrew calendar (`features/seasons/`). Events `seasons:day` {main, ids, key}, `seasons:dress` {where, n}, `seasons:treat` {id, coins, paid}; stats `seasonsTreats`, `seasonsTreatCoins` |
| `ctx.decor` | decor | `owns(slot, opt)` · `placed(slot)` · `buy(slot, opt)` → `{ok, why: bought \| owned \| coins \| party \| bad}` · `place(slot, opt)` (free — she owns it) · `allowed()` (false in a 🎉 party) · `enter()` (✋ GO INSIDE from her porch) · `pick(slot)` · `slots` · `spent` · `sets` · `debug.{S, pickerSlot, outside(), doorColor(), calls(), spotAt(id), houseSpots, houseLocal(p), room(), reset()}` — 🛋️ Lulu's own house + decorating it (`features/decor/`). Events `decor:buy` {slot, opt, price} · `decor:place` {slot, opt, bought} · `decor:set` {id}; stats `decorBought`, `decorSpent`, `decorSets`, `decorVisits` |
| `ctx.onegame` | onegame | `home({ via, line, camBlend })` — back in the world at home on foot (a fresh `cruise` run: `startRun({ mode: "cruise", home: true, homeLine, camBlend })`, behind a `dissolve` unless `camBlend` glides it) — **use it wherever an activity used to end on the title** · `roadTrip(via, leg?)` (the Story Trip from inside the world: leg 1 = `ctx.journey.start(0, { home, homeAt })` — right where she stands at home; a later leg = `{ rolling: true }`, already moving, no 3-2-1) · `tripBlock()` ("" or why not) · `parking(via)` (the challenge: `ctx.parking.start({ challenge, from: via })`) · `parkBlock()` · `dina()` (`ctx.dina.start({ ret: "world" })`) · `tripLine()` (the next stop / tour / stamps html) · `info()` · `debug.{OG, SC, BT, BOOTH, suitcaseSpot, dinaSpot, boothSpot, unlockParking}`. Events `onegame:home` {via}, `onegame:trip` {via, leg}, `onegame:parking` {via}, `onegame:dina`. The 📱 gets NO new app (it stays one 3 × 3 screen): the 🗺️ Map app launches road-trip legs, and the 🅿️ challenge is a card at the bottom of 💼 Jobs — `JOB_EXTRAS` in `phone/apps.js` (`{ id, html(), bind(el, api) }`), the way to add a card instead of an app. startRun opts it adds: `home` (wantsDeparture from anywhere, not just the title), `homeAt {x, z, face}`, `homeLine`, `camBlend`, `rolling`. Test: `onegame` |
| `ctx.rides` | rides | `add(def)` a ride keyed by the shell's model key (see **Rides** below — a town brings its own vehicles + tricks) · `get(id)` · `list()` · `forKey(key)` · `current` (the live ride `{id, def, key, obj, t, siren, data}` or null) · `id` · `siren` / `setSiren(on)` · `act()` → the trick on offer `{id, emoji, label, ready}` · `use(via)` · `horn()` · `holdsHorn` (holding the horn is the trick right now — Shared Road's emote wheel stands down) · `nudge(range)` (cars ahead move over) · `stats` · `debug.{board(id), R, yieldingCount(), amb, ice, bus}` — 🚓🚑🍦 every vehicle Lulu drives is its own thing (`features/rides/`). Events `rides:enter` {id, key}, `rides:exit` {id, why}, `rides:siren` {id, on}, `rides:horn` {id, kind}, `rides:ability` {id, act, via}, `rides:ticket` {seen, left}, `rides:impostor`, `rides:spikes` {left}, `rides:megaphone`, `rides:patient` {phase: dispatch \| pickup \| drop \| late, pay?}, `rides:jingle` {parked}, `rides:cone` {served}, `rides:busstop` {s, riders}, `rides:fares` {n}; stats `ridesTried`, `ridesTickets`, `ridesImpostor`, `ridesSpikes`, `ridesPatients`, `ridesPatientsLost`, `ridesPatchUps`, `ridesCones`, `ridesFares`, `ridesTaxiBonus` |
| `ctx.moves` | moves | (`features/moves/`) 🏁 the skill moves + the style combo: `on` (get/set — the Moves page switch; off in `?test` unless `&enable=moves`) · `combo` {n, pts, mult, t, distinct, kinds} · `addMove(id, pts, label, {color, foot})` (feed the combo from your feature) · `keepAlive(sec)` (a link: hold the combo open) · `bank(why)` · `break(why)` · `turbo(tier 1–3, src)` (a mini-turbo) · `airBotched()` (play's touchdown asks) · `footMove()` (start the on-foot roll / slide / vault) · `drifting` · `driftTier` · `turboLeft` · `stars(id)` · `list` · `openPage(from)` (📒 › 🏁 Moves) · `debug {D, T, R, DR, W, B, X, TUNE, AIR, FOOT, PERF, LOG, foot(), callout()}`. Events `moves:move` {id, pts, combo, mult} · `moves:bank` {n, mult, pts, total, coins, why} · `moves:break` {n, mult, why} · `moves:turbo` {tier, src} · `moves:drift` {on, dir \| tier} · `moves:pit` {car} · `moves:air` {tricks, flips, rolls, spins, clean}; stats `moves3d`, `movesTurbo1/2/3`, `movesPerfectStart`, `movesSlingshot`, `movesBootleg`, `movesPit`, `movesAirTricks`, `movesCombo3`, best `movesCombo` |
| `ctx.meta` | meta | `stat(id, n)` / `best(id, v)` · `holiday()` · `calm()` · `openScrapbook(from, tab?)` (tab = an index or an added tab's id) · `openQuests(from)` · `addScrapbookTab({ id, icon, name, render(S) → html, wire?(card, rerender) })` (a page after Badges · Record · Crew · Stats) · `addBadge(def)` (a 3D badge, same shape as `BADGES`) |
| `ctx.day` | day | 📝 A DAY IN LULU'S LIFE (`features/day/`): a Cruise that starts at home hands Ima's list for today (seeded by the device's local date — the same all day): one errand at a real place (⛽ / 🌄 / 🏡 Bubbe's via `world:visit`, a town via `town:exit`), a side job (`hustle:end` pass), something silly (counted from `stat` events: pets, closeCalls, footChats, footInteriors); a HUD chip (the next thing + how far) and a light column over the target; all done → 🏠 home for dinner (pull into the driveway / walk up): world's `ctx.places.home.comeHome({ line })` plays the ending beat (state `worldHomeBeat`, skippable: parked, she walks up to the porch, Ima waves) and then glides down behind her on her feet at home (`ctx.onegame.home({ camBlend })` — a fresh run; the title without onegame). On a Friday afternoon (`world:homeStart` `friday`) the list waits: Ima asks for the Erev Shabbos Rush instead (walk off and the list is back). Each item pays `PAY.item` (15) once a day, dinner `PAY.home` (40) once a day. `active` · `today` · `list()` · `done(id)` · `complete` · `home` · `imaLine()` (world's door line) · `ITEMS` · `PAY` · `debug.{date(yyyymmdd), target, beacon, chip, activate}`. Events `day:start` {list}, `day:tick` {id, pay}, `day:home` {pay}; stats `dayItems`, `dayDone`. Test: `scripts/tests3d/day.js` |
| `ctx.ads` | native | (`features/native/ads.js`, the iOS app's AdMob — a port of `src/10c-ads.js`: same ad unit IDs / `isTesting`) `native` (Capacitor + the AdMob plugin) · `ready` (initialized) · `att` (the ATT answer seen) · `rewardedReady` · `rewardedAvailable()` · `showRewarded(onReward)` · `debug.{S, ADMOB, log}`. Launch: ~1.2 s in it asks App Tracking Transparency (only while undetermined) and only THEN `AdMob.initialize` (Apple Guideline 2.1). Placements (owner, 2026-11-20 — AGENTS rule 4b): an interstitial every 2nd BREAK (a knock-out — the `knockout` event — or a `gameover` card; one counter, `interstitialEveryN`, never two within `minGapMs`): a knock-out's starts only once she's back on her feet and WALKING (`calmNow("foot")`, within `KO_WINDOW` s, else dropped); plus ONE per jail stay when the cell is quiet (law/jail.js emits `law:cellQuiet` once a stay; `calmNow("cell")`). The opt-in "📺 WATCH → +50 💰": on a `gameover` card (`#adReward`, one per card) and, after a knock-out, on the ❚❚ pause menu (item `adReward`, one per knock-out, at most `REWARD_KO_MAX` = 3 a run). **While any ad is up the game HOLDS**: `ctx.hold` (app.js skips whole frames — no game time, no state update, no traffic, no world, no render), `A.holdAll` (music paused, AudioContext suspended); released on the plugin's `interstitialAdDismissed` / `onRewardedVideoAdDismissed` / `…FailedToShow` (v8's show() resolves as the ad APPEARS), or after `showWaitMs` if it never appeared / `maxAdMs` if it never closed. `ctx.ads.holding`, `ctx.ads.calmNow(where)`, `debug.{S.holds, interstitial(why), release()}`. Test `scripts/tests3d/adhold.js`. Never mid-drive, in a party or Dina's mode; on the web / in `?test` without `&enable=ads` it never touches anything. Event `ads:ready` {att}; stat `adRewards`. `ctx.native` {active, platform} · `ctx.haptics` {native, debug} (touch-play `rumble()` → `Capacitor.Plugins.Haptics.impact` HEAVY / MEDIUM / LIGHT, throttled per level, off with Settings → 📳 Rumble & haptics). Test: `scripts/tests3d/native.js` (boots the staged `www/3d/` with a fake Capacitor) |
| `ctx.heist` | heist | `job` (Lulu's heist `{town, plan, bags, lost, phase: inside \| getaway \| pulled, stars}`) · `plan` (a cased bank / the tip `{town \| null, plan, via}`) · `robbery` / `snatcher` / `thief` (the live event) · `busy(except)` · `planHeist(town, planId)` · `cooldownLeft()` · `gear.{fireNet(from, {sure}), laySpikes(ahead, d), ripNet(), flatTyres(dur), netted, flat}` · `store` · `tune` / `pay` / `plans` · `debug.{robbery(opts), endRobbery, schedRobbery(), job, tip, snatch(mode), carTheft, enterBank, bypass(on)}` — 🏦 (`features/heist/`). Events `heist:robbery` {phase: staged \| start \| foiled \| escaped, where, how, pay}, `heist:job` {phase: tip \| plan \| start \| escaped \| busted \| failed}, `heist:snatch` {phase: approach \| dodged \| grab \| caught \| lost, n}, `heist:theft` {phase: warn \| stopped \| stolen \| recovered \| ditched}, `heist:gear` {kind: net \| spikes, phase}; stats `heistFoils`, `heistTackles`, `heistJobs`, `heistJobsClean`, `heistBusted`, `heistCased`, `heistBankVisits`, `heistSnatched`, `heistSnatchDodged`, `heistSnatchCaught`, `heistCarStolen`, `heistCarsRecovered`, `heistTheftStopped`, `heistNetted`, `heistSpiked`, best `heistBestPay` |
| `ctx.airport` | airport | ✈️ the JFK exit (ON by default; `?airport=0` off; tests `&enable=airport`): `on` · `planned` ({s, no, name} — its exit metre, a pure function of fixed data) · `ready` (built) · `inside` (she's in the fenced landside) · `spans()` ([{a, b}] signs → accel lane: other planners keep out) · `kerb.pickup()` (the ARRIVALS pickup point {x, z, h} in the kerb lane at f 24 — null until it's built; stage 3's taxi runs) · `zones(s0, s1)` ([{s, a, b}] where the airport WILL be, fixed data only — empty until the switch-on; the towns' + rest areas' planners keep out) · stage 2 attaches `terminal` (`enter({door})`, `warm()`, `canEnter()`) on boot · `debug.{S, LY, AIR, BUILD, PLANES, VEH, JOKE, KERB_HIT, SEC, enable(v), party(v), townsKeepOut(v), placeAt(s, {force}), ahead(m), buildNow(), fits(E), findSpot(s), frame(E), world(f, r), local(x, z), roads(), G(), planes(), vehicles(), kerbStats(), route(fx, fz, tx, tz), routes(), pullSpots(), kerbHolds(), KERB_EDGE, netDist(x, z), security(), low(), nearFence(x, z), fenceJoke(force), jokePhase(), perf()}` — ARCHITECTURE › The airport (+ › Polish) |
| `ctx.cutscene` | core | `begin(id, {onSkip})` / `end(id)` / `active(id)` — an in-state cutscene gets the ⏭ Skip pill (see States) |

**Damage you can see (feel):** a lost heart (`damage` event) dents Lulu's car where the last `crash` (within
0.3 s) landed — emit `crash` with `x, z` (or a `collider` / `car`) before calling `damage()` and the dent goes
there (front / rear / left / right); otherwise the front. Only her own car (not on foot, not a borrowed /
jacked ride); in a party it's local and cosmetic. Repairs: `run:start`, the title, `streets:paint` (Paint &
Pray), the ER (`er:admit` → `cameos:resume`); `heart` undoes a stage; a garage/mechanic can call
`ctx.feel.damage.repair(why)`. Cheap: the Body/Chrome geometry is cloned once and vertex-nudged, dents +
scratches are projected decals in two pre-allocated buffers (2 draw calls), the crack is a quad under the
car's `ws` node, the hubcap/bare hub are `feel_hubcap` / `feel_barehub` (Blender), smoke + sparks go into `car.fx`.
Events: `feel:wear` {k, stage, side} (a hit or a heal changed the wear) · `feel:repair` {why} · `feel:hubcap` {x, z}.

Street events (streets): `streets:carjack` {kind, model, color, x, z, witnessed, driver: {key, colors}} · `streets:bail` {speed, ride} ·
`streets:roadblock` {s, gap} · `streets:spiked` · `streets:paint` {cost, color, cleared} · `streets:smash` {kind, value, total, x, z} ·
`streets:crime` {charge} · `streets:chop` {kind, color, pay}; stats `carjacks`, `bailouts`, `roadblocks`, `spiked`, `resprays`, `propsSmashed`, `chopJobs`.

Events between features: `item:use` {id: "missile" | "pepper" | "shield", x, z} (garage → law
reacts to pepper spray near a cop), `missile:hit` {car}, `cop:chase` {active}, `foot:start`/`foot:end`,
`parking:result` {stars, coins}, `avigail:rel` {rel}, `stat` {id, n} (use the 2D quest/stat ids from
`src/06b-quests.js` when one fits — grep `questAdd("` in the 2D fragment you are porting).

**Out of hearts (`hooks.wreck`) priorities:** town **40** (tows her out of town, never claims), law **30** (claims
only when a cop/cop car caused the wreck → arrest), cameos **10** (claims ~1 in 3 car / animal wrecks — never two
knock-outs running, `ctx.cameos.force.scene` true/false for tests — and plays the 2D crash aftermath in the world:
the angry man / Hillel the adjuster / animal swarm…; only the traffic within 90 m is cleared; skippable; it ends in the
ER (~30%) or the knock-out beside her car), foot **1** (only `ctx.foot.force.wreck === true`: the old "borrow a car"
walk-away). Unclaimed → core's knock-out (Run API).

**Home is in MIDWOOD (world, roadmap 14 — `ci/hometown`):** the family house stands on its own lot on a Midwood street
— E 16th St between Avenue L and Avenue K, an EMPTY `uses.luluHome` lot (~14 × 24 m) the town engine reserves among
ordinary Midwood houses (no generated house, `homes` door or parked cars there; the block's ring of colliders is open
across its frontage). `home.js` builds the house, porch, driveway slab, car pose, Ima + Dina and the holiday dressing
around that lot (`ctx.town.spotOf(home.town, "luluHome", home.exitS)` — pure data, ready before the town is built; the
house is solid via `ctx.town.addCollider`). `ctx.town.home` = `{ town, exitS }` (Midwood's own exit, the route's first —
fixed). The town engine builds the home town in slices behind the title (its own idle loop) and keeps it standing across
the title + a run's start. **A day starts IN town:** the `runStart` hook makes home's town the district first
(`ctx.town.warp({ town, exitS, at: the driveway, quiet: true, home: true })` — no welcome sign / gossip) — then the
porch start below; the pull-out + the dinner beat are `ctx.town.allowState`'d. `ctx.onegame.home()` from anywhere
(the highway, Lakewood, a rest area…) lands her on the porch the same way. Pulling out means driving through her own
neighbourhood: Ima's list points a highway errand at `ctx.town.wayOut()` (the beam + "this way to the highway") and the
first drive-off ever gets one "🛣️ To the highway: take Avenue P" line. Features that measure along the HIGHWAY skip /
translate town streets (their s isn't the highway's): the journey's trip layer waits in a town and a leg that started in
town counts from where she joins the road; foot's "you WALKED to Bubbe's" never fires in a town; the Erev Shabbos Rush
measures with `ctx.town.highwayS` (the exit) and Ima's mid-cruise Friday call waits for the highway.
`ctx.home` = `{ site ("town" | "highway"), town, lot, ready, park {x, z, h}, isFamily(x, z), near(x, z, r), startAt,
setStartAt(v) }` — `startAt` (features/realestate's "🏠 Start my day here": `{ town, key, door, face, label, car? }`) starts
a day on foot at THAT door (its town, its kerb; no Ima); "home for dinner" (`onegame.home({ via: "dinner" })`) and
`{ family: true }` always mean the family house. The old highway cul-de-sac (s ≈ 0) is only a FALLBACK now — towns off
(`?test` without `town`) or no town engine; with towns on nothing of it is built.

**The home street (world):** the title is a live scene, not an attract loop. `features/world` wraps the
title state's `update` (menu input + its own tick instead of core's `autopilot`), owns the title camera
(`titleCamera` hook at priority −1000, so every other titleCamera hook still runs first) and parks the car at
`ctx.places.home.park` — NOSE-OUT in front of the garage (`car.showDriver(false)`; on-foot Lulu stands at the porch
steps, chatting with Dina). Coming back to the title from anywhere else, the car drives up the street, stops past
the driveway and backs in. **A run starts at home, on foot** (`world/depart.js`): a run started from the title
(or the pause menu's Restart, `opts.restart`) at the start of the road (Cruise, Story leg 1, the 🕯️ Shabbos Rush) —
a `runStart` hook (priority −100) sets **`G.introStart`** → `ctx.foot.start("home", {at, noIntro, camBlend, home})`:
the camera glides in from the title shot to behind her, she walks at once (no countdown, no card), Ima stands in the
doorway with one line (`imaPerson`), a pink marker bobs over the car, the first-ever start gets a gentler hint
(`store("worldHome").starts`), Ima nudges once if she just stands there; no random townsfolk / busking / "get in a
car" nudges on her own street (`home.quiet`). ✋ GET IN = foot's hop-in into the `worldPullOut` state (driving, its own
camera from the lawn side so the chase cam isn't in the garage — on a town lot, from out by the kerb looking back at
the car, the house and Ima) → `playing` once she's on the street (a glide in town). `startRun({ quick: true })` (every test), checkpoints, mid-run starts and parties keep the instant 3-2-1. atmos: `ctx.atmos.titleClock` (a
function, set by world) keeps the day + weather running on the title on the device's clock; Cruise continues
from that clock. Holiday dressing reads `ctx.meta.holiday()`.

**Title menu orders:** see Menus (grouped home screen). 👯 Friends is 60 (🌐 Shared Road is
inside its hub; its own title button shows only when the party feature is off).
**Pause menu orders:** resume 0 · ⏭ skip 5 · 🆘 I'm stuck 8 (features/unstuck) · camera 10 · 📱 phone 11 (the radio lives in the phone now) · 📸 photo mode 12 · settings 35 (the button guide is
inside) · Shared Road 40 · 💼 quit job 78 (exit row, only during a job) · restart 80 · party: everyone back to the lobby 86 · leave the party 88 · title 90.

**Lulu's in-car rig (banter):** at runtime the car's `Driver` mesh is carved into `BanterBody`,
`BanterHead`, `BanterArmL`, `BanterArmR` pivots (meshes named `BanterPart`, original materials, so
matching by material name — law's jumpsuit, the salon — still works). In driving states the rig drives
`Hair_*` and `Anchor_head`. Photo-mode poses (play) hide arm pieces by position, so they work on either.

**Moves & tricks (moves):** everything rides the existing hooks — a `controls` hook (priority 6/7, before play's
air-steering at 5) turns the handbrake at speed into a kart drift (the wheel sets the ARC, the body hangs out at a visual
angle on `car.model.rotation.y`, sparks go straight into `car.fx`'s buffers), assists the bootlegger (`car.spin`) and reads
air-trick input; an `update` hook (priority −10, after play's) adds turbo acceleration after the physics step (and lights
`car.boosting` flames — visual only, `G.boosting` stays the nitro's), slipstream, the wrong lane and the flip/roll
rotation about the car's middle. The rocket start wraps `intro`'s `update` at boot to sample the gas (a home start has no
countdown, so no rocket start there; `worldDepart` is gone).
PIT: a `crash` with a cruiser at its rear quarter (impact 0.8–8, so law's `onCopCrash` never costs a heart) sets
`car.hit`, a directed `spinV` and `hitT = −2.5` (law shakes it off at 2.8 → ~5 s out). On foot each move is a
`ctx.foot.script` (foot skips its car checks during a script — the i-frames). UI: one pooled `#mvCall` in `#hud`
(its numbers are `.hud-secondary`), the 🏁 Moves page via `ctx.meta.addScrapbookTab`, 3 badges via `ctx.meta.addBadge`,
the button guide via `setControlRow` + a `footMove` glyph. `ctx.dualsense.flash(rgb, sec)` flashes the light bar.
Not in the party OFF set: deterministic per player. Scaled by `car.stats` (a borrowed ride's handling) and, when it
exists, `ctx.rides.moveScale()`.

**Runtime wrappers (play):** stunt jumps wrap `ctx.traffic.collide` (no hit when she's above a car →
LEAPFROG) and `ctx.states.playing.update` (slow-mo `dt` scale, exactly 1 outside a jump).

**Hair:** the salon (cameos) adds styles with `car.addHairStyle(style, obj)` and registers
`luluPerson_<style>` models for on-foot Lulu; foot uses `models["luluPerson_" + style] || models.luluPerson`.

**Side hustles (hustle):** random offers (a ringing payphone / the HELP WANTED board 720 m up the road, or a
`ctx.phone.call`) come only in Cruise, never in Story / a party / a chase / on foot / the tutorial, and only
when `ctx.enabled("hustle")`. A job's UI is the objective line + a distance chip (`.hud-secondary`) at the
top of the "center" slot and a pooled beacon in the world — nothing shows outside a job. Pass / fail is the
state `hustleResult` (a card; the car rolls to a stop behind it); a job that fails while Lulu is elsewhere
(busted → law's scenes, a wreck) shows its card the next time she's driving in the same run. The heist exit
is the ⏭-skippable state `hustleHeist`. **The radio** only steers the music while she's in the car (driving
states, not on foot); scenes still set their own music and it takes over again afterwards; LULU FM (default)
leaves the game's music alone. Its ticker is `.hud-secondary`, top-right under the pause button.

**🌍 One world — the lap (`ci/onemap`, roadmap 20; the owner: "I want one main world and that's it"):** the highway is a
`LAP` of 16 km (`world.js` › `LAP`, `lapS(s)` = the lap metre, `lapOf(s)`, `lapAt(s, m)`, `lapWorld()` = a Cruise / 🌍
Free Roam). `Road.headingFn` repeats every lap — the first lap is the old endless road metre for metre; its last
`LAP_BLEND` (600 m) ease into the next lap's straight start, so the road under her never jumps — and the scenery chunks
seed by lap chunk (`k % (LAP / CHUNK)`: the same trees every lap). `s` keeps counting (distance, score, chases); every
PLACE comes round once a lap at a FIXED lap metre — the same place, not a copy: Midwood's exit 3600 (home, E 34th St) ·
rest area 5700 · JFK 8800 (`airport/plan.js` › `AIR.every = LAP`) · Lakewood 12000 (`towns/index.js` › `ROUTE`, period
`LAP`) · rest area 14200 (`exits` › `REST.lap`, placed at its metre every lap, the same name) · the roadside places
(ci/roadside): Trooper Post 7 + the Highway Traffic Court 6800 (`hw:trooper`, `hw:court`), Hatzalah 10700 (`hw:hatzalah`),
the Weigh Station + Doc-in-a-Box 15700 (`hw:weigh`, `hw:clinic`) · Gas 'n' Go 1300 / 6900 +
the Lookout 2400 / 8200 (`world/places.js`) · the roadside storefront blocks (`foot/street.js`: the first lap's, repeated).
The Story Trip's family stops (Bubbe's, the beach…) are its own road: not built on the lap (Story is hidden for now).
Test `exits` › "lap". **ADDRESSES (stage 2):** a place's identity is a fixed string — the same every lap, every run, every
friend's screen; NEVER an exit metre or a lap number (those only say where on the road the one place stands this lap).
In a town: `"<town>:<lx>:<lz>"` (the town's local metres, rounded — `ctx.town.addressOf(x, z)`; the key `homes` › `doorId`
and `realestate` already use for a house; shared rooms' `inst` too) or `"<town>:<spot>"` for a named spot
(`ctx.town.addressOf("luluHome")` → `"midwood:luluHome"`). On the highway: `"hw:rest:<slot>"` (a rest area's `R.address`),
`"hw:exit:<town>"`, `"hw:jfk"`, `"hw:gas:<n>"` / `"hw:lookout:<n>"` (n = its index on the lap). **THE MAP + REAL
DISTANCES (stage 3):** `world/lapmap.js` › `lapPlaces()` (every place on the lap from fixed data — `{ addr, name, emoji,
m, kind }`, sorted by lap metre, cached once a world exists), `ahead(m, from)` (metres on — the road goes one way),
`myLapM()` (in a town: its exit's), `drawLap(cv, { me, dots })` (the ring: lap line at the top, clockwise, names inside).
The 📱 🗺️ Map is the `lapmap` app solo in a lap world (the story `map` hides there); the 👯 friends' map on the highway
draws the same ring with friends as dots. `world/lapsigns.js`: just past each town's and JFK's on-ramp a green board lists
the next three big places in real miles (added 1.2–4.2 km ahead, once per lap per board). Next stage: hooks.

**Towns (town):** a Cruise run has an INTERCHANGE every few km, and **each town has its OWN** (owner 2026-11-20: "Brooklyn
and Lakewood shouldn't share the same exit"): the route is data — `towns/index.js` › `ROUTE` = `{ period, stops: [{town, at}] }`
(Midwood @ 3600, Lakewood @ 7600, every 8 km), `routeAt(k)` → the k-th stop `{town, s}`, `routeFrom(s)`. The planner
(`index.js` › `planRoute`) slides each nominal metre to the first clear one (`exitFitS`: fixed data only — rest areas, a
bridge, the last exit — never what happens to be on the road), so the exits are the SAME metres on every run and on every
friend's screen. **A new place gets its own interchange by adding a `ROUTE` stop** (a `towns/<id>.js` def with `attach`).
`ctx.town.home` = `{ town: "midwood", exitS }` — the route's first exit, where Lulu lives: block 4,2's west face (E 34th St between Avenues K and J — the owner's address) is an
EMPTY LOT (`uses.luluHome`: `{ lot: true, among, dims }` — the face's houses fill round it; its ring of colliders is open
over the frontage) whose spot (`door`, `drive` nose-out, `kerb`, `street` — its address) is pure data: `ctx.town.spotOf("midwood", "luluHome", exitS)`
answers before the town is built and the same after. `ctx.town.addCollider(c, {town, exitS})` (her house's walls),
`ctx.town.wayOut()` (where the streets hand over to the cross road), `ctx.town.warp({ town, exitS?, at: {x, z, h}, quiet, home })`
(leave the town she's in with no cut of its own, then a QUIET enter: no welcome sign, no lines, no visit counted;
`town:enter` carries `quiet` / `home`). On the title the home town prebuilds in slices (its own rAF loop). The interchange
signs name the one town (`towns/index.js` › `INTERCHANGE` sign copy; `{no}`/`{label}` fill per town). The
layout is data in `exit.js` (u = s − exit.s): advance signs (1 MI, ½ MI with exit-number TABS — `sign.tab`, a last-chance
board), a 55 m taper (u −230) into a parallel deceleration lane with EXIT ONLY + a lane-drop arrow painted in it, the
`exits_gantry` at −110 (its EXIT ONLY board has the exit tab and the yellow EXIT ONLY strip; ↑ THRU TRAFFIC over the through
lanes), a dashed line that keeps the right lane straight, the gore nose at −60 (a painted gore, then grass with a crash cushion
and the gore sign), a RAMP 25 MPH advisory, ONE ramp that S-curves out (one town's exit uses the inner branch `rampD`, u 172.2; the old two-town split — outer
`outerD` → Midwood — is still in the engine: `debug.exitAhead(d, "both")`), guardrails with flared end terminals, and each branch ends at a STOP line
(u 168 / 118) at a T-junction with a two-lane local cross road (`crossRoads(e)`): a green guide board across the T
(`SIGNS.tee`), a gas station (canopy + price pylon, `SIGNS.gas`), "Welcome to …" (`SIGNS.welcome`) and the first houses along
the road into town. The inner cross road's near end turns into the ON-RAMP back (u 181 → 300, a merge gore, an accel lane to
420). `exitbuild.js` draws it all in `chunk:build` (one mesh per surface, the props merged by `kit.js`, every face from one
atlas; models in `assets_exits.py`). A town is only entered from a branch past `COMMIT` (55 m) — `rampPhase(e, s, d)` →
`decel` / `ramp` / `branch`; before that the light ramp cue (`H.prompt`, never a popup) names the choices and she can steer
back across the gore. At COMMIT `town:exit` fires and she drives on down the branch; the fade into town starts 16 m short of
its STOP line (or 7 s after committing, or the moment she leaves the branch). Driving out of town puts her back on that
on-ramp (`onRampSpot`), heading down it at speed — she merges from the accel lane. Every lane is `paved` level 3
(`laneAt(e, u, d)`): nothing stands on it. Planning slides an exit clear of pull-in places, rest areas (`ctx.exits.spans()`) and big reserved
right-side stretches (the coast's ocean, a family's yard). `exitAhead(ahead, id)` (debug) plans the interchange, or a one-town
exit with that town's own signs. Event `town:exit` {town, s, no} when she takes a branch. Every attachable town an interchange offers loads its models
from 1.5 km out (`def.models`, per town).
**Attached (one world):** a town with `attach` data (`towns/<id>.js` › `attach: { join, dir, streets, addStreets, woods,
skyline, barricades, exits, dropSigns }`, applied by `towns/index.js` `attachedDef`) STANDS at each interchange, turned so
its branch's cross road runs straight on into its first street — Lakewood straight on off the inner T (Route 9, the town
ahead of the ramp), Midwood off the outer T by a new Avenue P to Ocean Pkwy's south corner (the town behind the ramp).
`placeAt(def, exitS, k)` (index.js) is a pure function of the exit's s + the highway → `{x, z, rot}`: the same metre on every
friend's screen. The plan has a frame: `PL.ORIGIN` + `PL.ROT` (a local heading h is world h + ROT; `toWorld` / `toLocal` /
`wH` / `lH` / `dirWorld` in plan.js, and `ctx.town.plan.world(lx, lz)` / `.wh(h)` for other features — never add ORIGIN by
hand). Its APPROACH (`PL.APPROACH`, plan.js) is the cross road itself from 6 m past the T to where the town's drawn street
takes over: a street of the plan the build never draws and nothing in town uses (no nodes, parking, people, drivers;
`hideSpot` calls it a lane). Planning (exit.js `FIT.fits`) slides an exit on in 50 m steps until both towns' footprints
(`boxOf`) are ≥ 100 m from the highway's centre line 3 km back to 4 km on (a third of the spots fit; slides ≤ ~1.3 km). The
cross roads are drawn STRAIGHT (exitbuild.js `crossStrip`, their houses off the same line — two lines of constant u fanned
apart by metres on a bend). From 900 m out `tendAttached` builds the exit's towns in slices (`buildTownSteps` — a generator:
a block face / a few parked cars / 6 atlas signs / 40k merged vertices a step, `Merger.buildSteps`; ~3 ms a frame; each
step's plan swapped in by `withPlan`), culls the standing ones, drops them 600 m past. She's IN when she's 4 m past the line
on the approach (or inside a footprint): `enterTown({entry, drove})` swaps the road model with her position, heading and
speed untouched — the district keeps the highway drawn, the highway's plain traffic carries on down it as puppets
(`data.hwPuppet`: its own s, which the TownRoad answers with the highway, gone 520 m off), the town's drivers start where the
camera can't see them pop in (`randomSpot(…, unseen)`) — plus the ones she already saw: while she's within 520 m of a
standing town (outside it) `ambient.js` drives a few light minivans (the parked cars' LOD model baked to one vertex-coloured
geometry, ONE instanced draw call per town, no shadows) up and down the streets nearest the join, so it isn't frozen from the
ramp, and on the way in `convertAmbient` makes each one a real driver right where it is (counted against `def.traffic`;
off in a 🎉 party). A cruiser on her tail (`data.law`) isn't a puppet and isn't removed: law steers its units off whatever
road is under them, so it follows her in (round the corners — `copRoute`) and back out (its s re-found from the highway).
She's OUT 2 m short of the line (or 20 m outside the footprint and
25 m off the approach): `leaveTown("highway", {drove})` hands her to the highway's road where she stands (car.s and foot's
F.s re-found from the exit — a town s as a hint would send the highway's search 500 km down the road); the town stays
standing. On foot it's the same line (an always-on foot actor). Leaving any other way while she WALKS in a town (a scene
state the town can't host, a reset, a party hand-back) never strands her: in a town standing by the road she stays exactly
where she is (only the road under her is the highway's again); otherwise she's put beside her car on the highway side
(`besideCar`), and her parked car (foot's stub) goes with it. Not attached: `ctx.town.enter()` with no exitS (tests /
debug) builds the stand-alone town at its own far `origin`, and a branch whose town isn't built yet (a slow download) still
fades in at the STOP sign. `ctx.town.attached` · `ctx.town.standing` ([{town, exitS, k, ready, at, steps, ms, worst, p95,
p99}]) · events `town:built` {town, exitS, ms, steps, worst}, `town:enter` / `town:leave` carry `attached` / `drove`.
The stand-alone town is a district (see World) built when she's put there and disposed when she leaves; everything about a
town is DATA in `features/town/towns/<id>.js` (streets with names and extents, block uses, landmarks,
jams, signs, people + lines, traffic mix, the entry and the exits) read by a generic engine
(`plan.js` → streets / crossings / blocks / graph / TownRoad). While she's in town `ctx.enabled()` is
false for the highway's random content (roadevents, cameos, foot's spawners, interiors, journey, hustle,
play, banter's random parts, law's random cops); chases, carjacking and walking still work through the
district. Hooks into other features (all guarded by `ctx.town && ctx.town.active`): **law** —
`clearLine` uses `ctx.town.blocksSight`, a chasing cruiser steers by `ctx.town.copRoute`, new
cruisers join at `ctx.town.copSpawn`, hiding asks `ctx.town.hideSpot` (the kerb among parked cars / off the street — a travel lane never counts), a SEARCHING cruiser drives to `ctx.town.searchPoint` then prowls crossing to crossing (`prowlPoint`); **foot** — the walking frame comes from `ctx.town.footYaw`;
**streets** — no roadblocks and the chop-shop order pauses in town. The town HOSTS the law's arrest → booking → cell →
court → walk-out, the ER and the interiors (features/places — see Places below: `allowState` for `lawArrest`, `lawJail`,
`lawCourt`, `lawExit`, `placesArrive`, `cameosER`, `interior`); any OTHER scene it can't host (a roadside cutscene set,
the ER's ambulance ride-in — skipped in town, parking, Dina…) still sends her back to the highway first (`TOWN_OK`). Out of
hearts in town stands her up on the street she crashed on, beside her car (no tow, no fade; on foot the ER can scoop her
up now that the town has a hospital — `ctx.foot.erChance()`). The group-chat
gossip goes through `ctx.phone.text` (thread = the town's group) and the 📱 phone gets 🗞️ **Kvetch**
(the town's parody local news + what Lulu just did) — a pinned row in 💬 Messages (`ctx.phone.addPin`, id `town`), not an app: the phone stays one 3 × 3 screen.
**Performance:** static pieces are merged by `kit.js` into vertex-coloured 60 m clusters (one material per
look), culled every few frames by distance and by the town's own blocks (a cluster is hidden when every
sample point is behind another block), every bit of text is one atlas mesh,
parked cars use the light `town_minivan_lod` (no shadow, a dark patch underneath) — but every one is SOLID (two
collider circles) and TAGGED in the merge (`kit.js` `opts.tag` → its vertex ranges; `hideTagged`): `parked.js` lifts one out
into a real model when it matters — she bumps it (it's shoved: a slide, a spin, a rock, its alarm; `town:parkedHit`) or walks up
to it (it joins foot's parked cars through `ctx.foot.addParked`, so ✋ HOTWIRE CAR works like the highway's; she drives off in
the full model — `town_minivan` / `sedan` — and it's gone from the kerb, `town:borrow`); an untouched one goes back into the
merge once she's walked on. On foot the town chunk's colliders follow HER, not the car she left on another street. Town
drivers that stopped for her on foot wait a couple of seconds, and one she walks up to stays put, so she can carjack it
(streets only takes a stopped / crawling car); the school bus, the city bus and the sweeper are jackable too. Townsfolk cast no
shadow, and far town cars / people / geese are hidden. The test (`scripts/tests3d/town.js`) logs
`PERF busy cruise` vs `PERF town`.
**Adding a town** (Midwood is the second): a new `features/town/towns/<id>.js` (+ its lines file) registered in
`towns/index.js` and given a turn in `townFor()`. Streets are `ns` / `ew` lines (any spacing) or a `diag` one
(`from: [x, z], to: [x, z]` — Kings Highway); each street can say `lanes: 2`, `park: false`, `boulevard: { mall,
service }` (Ocean Parkway: malls + service roads), `oneway: ±1` (the drivers keep to it; going the wrong way is
`town:oneway` + gossip + a crime if the patrol sees) and `priority` (no stop sign facing it at a side street; the
side street waits for its traffic). `plan.js` carries every width per street (`st.curb / outer / walk / front /
park`) and `cutAt(st, node, dir, d, w)` gives stop lines, crosswalks and sidewalk ends square or slanted, so
nothing assumes a 90° crossing or a default street. Blocks are the rectangles between the grid's streets plus
the 4-sided blocks between a diagonal and the nearest avenue (key `"k,<diag name>"`; a diagonal must bound the
grid, not cut through a row of rectangles); `strips` are frontage rows along a street outside the blocks (a
city town's edges; `use: "college"` lays out a whole quad). More data: `rail` (rail.js: an embankment railway
mid-block — berm, girder bridges where streets pass under, stations, trains that run, stop and rumble),
`skyline` (cheap apartment-house boxes in the far looks), `barricades`, `parked` (models + paints, `parkRate`),
`routes` (which streets a traffic kind keeps to), `flock` (`timid`: pigeons that scatter instead of geese that
charge), `notices` (Lulu's first-sight lines), `bikeRider`, `seed`, `models`. New block uses are cases in
`build.js`'s `layoutFace` (+ `DIMS`) with models in their own Blender module (`assets_town.py`,
`assets_midwood.py`). The far looks (`far` / `farglow`, culled at 700 m, no shadows) and a second 150 m merger
keep a skyline to a handful of draw calls. `scripts/tests3d/midwood.js` covers the second town.
A town's `uses: { <kind>: { key, fallback, dims, u, sign, spot, with } }` is plain DATA that places a model another
feature builds (Lakewood's Bais Yaakov is `community_baisyaakov`, loaded with the town's models when it's registered,
else the fallback stands there).

**Erev Shabbos Rush (shabbos):** a run in `G.mode = "shabbos"` from the start of the road to BUBBE'S HOUSE
(the journey's stop 0, built in every mode — we only add Bubbe's door, the candle table and Ima on its transform).
No new home tile: on Fridays (device clock, 12:00–19:59) a `titleInfo` **bar** chip (`#shabbosChip`, a `<button>`
handled by a delegated click; the default title focus stays on the Story hero) starts it; on any day a rare Cruise
event (`ctx.enabled("shabbos")`, once per run, ~8 % / 35 % on Fridays, only in daylight with ≥ 1.7 km to Bubbe's)
is Ima's call — letting it ring arms the rush in place. The countdown is folded into the trip bar (shabbos wraps
`ctx.trip` at boot and hands back to the journey's outside a rush); escalation writes `traffic.config` (restored
after) and adds pooled props (≤ 2 storefronts on world-reserved slots, 1 LED trailer, ≤ 3 sidewalk people). During a
rush the only Ima calls are the two scripted ones (a boot-time wrapper on `ctx.phone.call` drops other `from: "IMA"`
calls; ours pass `shabbos: true`). States: `shabbosArrive` (⏭ skippable; beats in game time) and `shabbosResult`
(the made-it / late card; Retry = `startRun({mode: "shabbos"})`, so pause → Restart and game over → Try again also
restart the rush).

**Seasons (seasons):** 🕎 the world follows the real Hebrew calendar (the device's `Intl` Hebrew calendar, like meta's
holidays — no date table). `calendar.js`: a Hebrew day starts at about SUNSET (a per-month table for the north-east US),
so Chanukah's first candle is the evening of 24 Kislev and each evening adds one; `classify(m, d, wd, chanukahDay)` is
pure (fast days that land on Shabbos move: Tzom Gedalia / 17 Tamuz / 9 Av to Sunday, Taanis Esther back to Thursday;
the Three Weeks / Nine Days; Friday afternoon = `erev`; Shabbos / Yom Tov = `candles`). `data.js` `RECIPES[id]` says what
a day dresses (`windows` menorah | candles, `big`, `stand` {goods, awning, sign, treat, lines, coins}, `sukkah` done |
going-up, `baskets`, `kerb`, `bonfire`, `planters`, `parade`, Ima's note, Lulu's line); quiet days (fasts, the Three
Weeks, Yom Kippur, Tisha B'Av) have only Ima's note — `places.js recipesFor(day)` strips anything festive from them.
**Where** (`places.js`, every dice roll a hash of the place): the highway on `chunk:build` from `chunk.houses` (windows
found from the house model's own front-facing `Window` faces — `frontWindows(key)`, cached per model; a sukkah in the
yard, a planter by the door, the kerb pile at the driveway's end, a stall ~1 chunk in 9 at |d| = 13.6 off any lane /
reservation / pole, a bonfire 44–58 m out in a field; colliders through `chunk.addCollider`, removed again if the
season changes); a town on `town:enter` from `ctx.town.homes` (the same model frame homes uses: +X = −u, +Z = n), the
duplex's own sukkah deck (local 7.0, 3.12, −0.6), Midwood's front strip, homes' doors (`ctx.homes.homes()`) for baskets /
planters / kerb piles, `ctx.town.spot()` for the big menorah (hall → shul → yeshiva lawn) and the stall (beside the
bakery / pizza shop, on the strip between the sidewalk and the lot). **How it stays cheap** (`dress.js`): each prop
(`seasons_props.glb`, `Prop_<Name>`, `3d/blender/assets_seasons.py`) is baked once into a vertex-coloured geometry (+ a
glowing one for `Flame*` parts); each KIND is ONE InstancedMesh for the whole world, re-filled every 6 frames with the
nearest placements (`KIND_DEFS`: ≤ max within R m — a window menorah ≤ 36 within 48 m, a sukkah ≤ 22 within 170 m);
every candle / lamp / fire (`Light_<k>` empties) is one point in one `THREE.Points` per size (an additive glow sprite,
fogged, depth-tested, ≥ 2.5 px far away, faded in by `ctx.atmos.night`; fires burn all day). A whole Chanukah town:
~6 draw calls, ≤ 9k triangles of props, 3700 lights. A stall's sign is a textured quad (`signTexture`). Sets come
and go with their chunk / town (`addSet` / `dropSet`, a `vis()` that hides a chunk's things while she's in a district).
**The parade** (`parade.js`, Purim): 12 marchers on homes' instanced rigs (`features/homes/rig.js`) + instanced hats,
there and back along the main street's sidewalk through `spot("pizza" | "bakery" | "hall" | "shul")`, a banner between
the first two, a positional grogger (`A.spatial.define("seasonsGrogger")`). **Noticing it:** Ima's 📱 note in the family
chat once per day (`run:start` + 4 s), Lulu's line the first time something is in view, a home-screen chip for the days
meta's greeting doesn't cover (order 5.5). **The treat:** the stall is a ✋ `ctx.foot.addSpot` (or pull up slowly within
9 m) — its coins once per REAL day across every stall and holiday (`store("seasons").paid`). ⚙️ Settings → 🕎 Holidays in
the world ON / OFF. Previews: `?season=chanukah&night=5` (any id of `calendar.js DAYS`, + `shabbos` / `friday` / `none`;
`&seasonWd=` / `&seasonEve=0`), `?seasonDate=2026-12-07T19:30` (the real path on a pinned clock); add
`&holiday=chanukah&holidayDay=5` to dress Lulu's own car + house too (meta's). Test: `scripts/tests3d/seasons.js`.
**Round 2 (the owner's approved extras):** 🕎 **string lights** — `strings` in a recipe: a scalloped row of blue / white
bulbs along a share of the houses' front eaves (from `frontWindows` + the model's height), drawn as ONE `bulb` Points
layer with per-bulb colours (a neutral white glow texture) + ONE `SeasonsWire` LineSegments for the whole world; faint
by day, bright at night. **People of the day** (`groups.js`, recipe `groups: [...]`): small groups on homes' instanced
rigs + instanced held props (`HeldLulav`, `HeldEsrog`, `Book`, `Torah`, `Flag`, `Pushke`, `BreadBag`, costume hats) —
`walk` (there and back along a sidewalk through a town spot), `stand` (facing something), `ring` (dancing round a
centre, one in the middle); drawn within 110 m; `groupsAdd(key, specs, {vis})` per town / road chunk. Placed in
`places.js` `groupsForTown` / `groupsForChunk`: Sukkos lulav + esrog walkers (never on Shabbos), Yom Kippur families
in white (a quiet day: no stall, no sound), Tashlich at Lakewood's lake (`ctx.town.spot("lake")`) + a pond in a field
off the highway on Rosh Hashana (not on Shabbos), Simchas Torah hakafos on the lawn in front of the hall / shul (23
Tishri only) with kids waving flags, Purim's costumed collectors with a pushke at four front doors, erev Pesach's
chametz-burning barrel (`BurnBarrel`, a bucket of water beside it) with a firefighter and neighbours (`erevPesach`:
14 Nisan, or Friday the 13th when the 14th is Shabbos). **The Purim music van** (`musicvan.js`): one of the town's own
drivers (`ctx.town.addDriver("van")`) with the `SpeakerKit` on its roof, a sign on both sides of the board and a
synthesized freylekhs (`A.spatial.define("seasonsMusicVan")`, a loop on the van); taken off again in its `onRemove`
(traffic cars are pooled); solo only (a party town's traffic is the party's). **The radio** (`features/hustle/radio.js`):
`ctx.seasons.radioQuiet()` (the Three Weeks / Nine Days / the fasts in them, and only while the setting is on) → SIMCHA
101.3, SMOOTH 88.8 and DOVID DOV FM play no music, their DJs only talk (Three-Weeks lines + the talk station's babble); LULU FM (the
game's soundtrack) and KVETCH 1450 AM are unchanged. **meta's car menorah** is built by `features/meta/menorah.js`
`slimMenorah()` (2 body meshes + 1 instanced flame mesh + 1 glow Points: 34 draw calls + 7 shadow → 4 + 2, the same
look; Lulu's window menorah on the home street uses it too).

**Rides (rides):** whatever Lulu drives that isn't her own car is foot's borrowed-vehicle shell (`ctx.foot.shellObj`,
`ctx.foot.vehicle.kind` = its model key) — jacked (streets), hotwired on foot, hailed. Every frame rides polls the
shell and, when its key has a def, makes that ride live (and undoes it all when the shell goes):
```js
ctx.rides.add({
  id: "cop", name: "Cop car", emoji: "🚓", keys: ["cop"],      // shell model keys this ride covers
  handling: { top, acc, grip, brake },  // only when the shell brought none (a jacked ride already has streets' numbers)
  mass: 1.4,                            // shove in traffic collisions (core: traffic.collide uses `player.mass || 1`)
  sturdy: 1.2,                          // heavy: a crash with LIGHTER traffic below this damage power costs no heart
  nitro: { top: 1.5, acc: 15, drain: 0.7 },   // car.stats.nitroTop / nitroAcc (core car.js, defaults 1.32 / 9)
  feel: "heavy" | "floaty",             // steering lag (when streets' jacked-ride feel isn't already on it)
  horn: "siren" | "jingle" | "air" | "plain" | R => …,   siren: "siren" | "ambulance" (spatial kind), lightBar: [x, y, z],
  ability: R => ({ id, emoji, label, short, ready, why }) | null,   use(R, act, via),   // the ONE trick (return a reused object)
  hint: R => html,                      // the first-time card (once per ride per save, store("rides").seen)
  status: R => html | "",               // the chip's status line (a timer, metres to a stop…)
  enter(R), exit(R, why), update(dt, R, playing),   onSiren(R, on),
  traffic: { kind, spec, mix, models, jack: {streets RIDES row}, alsoKinds, cam: {d, h} },   // join traffic (live() only) + jackable
});
```
**Input — no new buttons:** the horn (L1 / LB, H, HONK) IS the ride's horn — rides swallows `P.honk` in a `controls`
hook (priority 60) before the driving sim sees it, except while a phone call rings / talks (honk = decline). Rides with
a trick: TAP the horn = the horn (siren on/off…), HOLD it 0.42 s = the trick (glyph `rideAct`: "hold L1"); keyboard X;
touch: one contextual button (`#tx_rides_act`) that exists only in a ride with a trick. The air horn emits `honk` with
`{ ride }` (the garage then skips its own horn sound). HUD: one `.rides-hud` stack in the "right" slot (a status chip,
the trick chip with its glyph, a blinking 🚨 while the siren's on) — empty outside a ride.
**Siren:** law's `lightBar(shell)` strobes the ride's own LightRed/LightBlue, a spatial loop rides on her car, and
every non-scripted traffic car (no `ai`) ahead in her direction eases onto the shoulder at ≤ 3.5 m/s, oncoming ones
hug theirs — released (back to lane 2, `want = base`) once she's past or the siren goes off. Real cops: a siren near a
cop for ~7 s, or a pull-over (`ctx.law.pullOver()` → law's `lawStop` copStop scene) in view of one →
`startChase("IMPERSONATING AN OFFICER", {heat: 2})`; in a chase the cop car's trick is spike strips (`ctx.streets.spikes`).
Random content (dispatch calls, kids, bus riders, the taxi / ambulance / ice-cream / bus fleet in traffic) is gated by
`ctx.enabled("rides")`; in a 🎉 party the fleet is seeded into the shared traffic (`ctx.party.addTrafficKind`), and the ride she drives keeps its handling / horn / trick and its personal props (patients, kids, riders — her screen only; the siren never touches a shared car, the pull-over CLAIMS one). Set pieces (the ER bay, bus shelters) go up past the
built road with `world.reserve` (released when they're gone); people come from a small pool, one shared beacon.

**Lulu's phone (phone):** one GTA-style entry point for the extras, so features add an APP instead of a button.
The phone opens in `playing` and `footRun` (touchpad / Tab / Xbox L3, the 📱 corner button — it takes the ❚❚ spot in
those states; its ☰ Menu or Start/Esc is the pause menu — or the pause menu's 📱 Phone) and **pauses the game** exactly
like the pause menu (`ctx.paused`, `pause` event). It's a `showScreen` card (class `lphone`), so focus is spatial:
```js
ctx.phone.addApp({ id: "lakewood", icon: "🏘️", name: "Lakewood", order: 70,
  visible: () => !!ctx.town,                 // hide when it makes no sense (missing feature, a 🎉 party for random features)
  badge: () => n || null,                    // a number / "!" on the icon (null = none)
  open: () => …,                             // EITHER hand off to your own view (the phone closes first, the game resumes)
  render(el, api, arg) { el.innerHTML = '<button class="btn lp-row">…</button>'; } });   // OR draw into the phone screen
// api = { close(), back(), refresh(), toast(text), open(appId, arg) } · every <button> / .btn / .nav in el is focusable
// optional app.back(api) → true when it handled ○ itself (a sub-view); optional color / color2 (the icon gradient)
ctx.phone.openPhone(appId?, arg?) · ctx.phone.closePhone() · ctx.phone.isOpen · ctx.phone.apps() (visible ids)
```
Orders: 🗺️ map 10 (together's 🗺️ in a Free Roam) · 👯 party 15 (openworld, Free Roam only) · 💬 messages 20 · 📞 Phone 22 (community, everywhere) · 👯 Friends 23 (friends, outside a Free Roam) · 📍 nearby 25 (openworld) · 📻 radio 30 · 💼 jobs 40 · 🎨 paint 50 · 📸 camera 60 — **that's 9: the grid is ONE 3 × 3 screen** (tests `calls`, `onegame`, `day` check ≤ 9). Something that isn't worth a 10th app goes in 💬 Messages as a pinned row:
`ctx.phone.addPin({ id, order?, visible?, row: () => ({ icon, color, title, sub, badge }), render(el, api) })` (under 📝 Ima's list + 🏠 My house; tap → its view above "‹ All messages"; the badge shows on the row only; `ctx.phone.pins()` = the ids showing) — 🗞️ Kvetch (town) is one.
Styling helpers inside an app: `.btn.lp-row` (a row: `.lp-av` icon, `.lp-tx` with `<b>` + `<small>`, `.lp-meta`),
`.lp-card`, `.lp-note`, `.lp-fine`, `.lp-empty`. **Inbox:** every `ctx.phone.text(…)` still pops the driving bubble
AND is stored in 💬 Messages (thread = `thread` or `from`, case-insensitive; the last 50 in `store("phone")`), with
unread badges on the app + the corner button; tapping the bubble opens its thread. `ctx.phone.inbox` = `{ post(opts)
(store only, no bubble), unread(thread?), threads(), markRead(k), clear(), msgs }`. The family group chat is thread
`"mishpacha"` (shown as *Mishpacha 💕🙄*; Ima / Bubbe / Heshy react at `run:end`, gated by `ctx.enabled("phone")`).
Events: `phone:open` {app} · `phone:close` {how} · `phone:app` {app} · `phone:text` {from, thread, msg}.
The story map opened from the phone (`ctx.journey.openMap({ from: "phone" })`) sits OVER the live run (frozen without
`setState`, like photo mode); ○ returns to it exactly, and picking a chapter ends that run first.

**World memory (memory):** a capped record in `save3d.f.memory` (≤ 6 grudges, ≤ 6 queued texts, ≤ 8 records per
logged kind, ≤ 16 kinds, ≤ 5 paint colours) paid off in later runs, never on the HUD: the grudge car is a plain
traffic car (`traffic.add` + a custom `ai`, Paint restyled and a seated `npcMan`/`npcWoman`/`copPerson`, both undone
in `onRemove`; `onCrash` → no hearts), at most one visit a run, never two runs in a row for the same grudge,
forgiven after three. Texts go out through `ctx.phone.text({ from, … })` — one 💬 Messages thread per sender, `from` is its title — (≥ 40 s apart, ≤ 3 a run, never during a
call / chase / job / on foot). The WANTED poster is banter's pooled billboard with a design added through
`ctx.banter.addAd({ id, dynamic })` (an ad's `art` may be a draw function) and hung with `ctx.banter.billboardAt`.
Other features ask for recognitions in place of their usual line: law's pull-over (`recognize("cop")`), streets'
Paint & Pray (`"moishe"`), roadevents' hitchhiker (`"hitch"` — it also records pick / pass / drop), cameos'
Avigail coupe + porch (`"avigailRoad"`, `"avigailPorch"`).

**The volunteer orgs (community):** Chaverim / Shomrim / Hatzalah + Lakewood's Bais Yaakov. Which town has which orgs
is DATA keyed by town id (`features/community/towns.js` › `COMMUNITY`; a later town opts in with one entry or
`ctx.community.register(id, cfg)`). Their vehicles are ordinary pooled traffic cars with a record
(`fleet.js`): highway sightings on the plain lane AI within `approach` m of that town's exit (`ctx.town.exits`),
town cruisers on the town's own lane AI (`ctx.town.addDriver`), responders that drive to a kerb in road coords or
follow Lulu round corners (`ctx.town.copRoute`, the same routing law's cruisers use), and drive off. Light bars
flash per org on `LightAmber/Blue/Red/White` (cloned once per pooled car); a responding Hatzalah wails through
`A.spatial` (`ambulance`). Roadside scenes sit on `ctx.town.curbSpot()` (or the highway's shoulder) as a stopped
traffic car (crash into it, carjack it) + pooled people. Scenes for Lulu run in the ⏭-skippable state
**`communityScene`** (car held, a roadside camera; `ctx.town.allowState` keeps it in town) or, on foot, in
`ctx.foot.script`. **Shomrim never arrest**: they `ctx.law.startChase` (the call-in), `ctx.law.spot` (radio tips while
a unit sees her) and, after a hold that goes badly, hand her to `ctx.law.arrest` on the highway (`ctx.town.leave("quiet")`
first, so law's scenes play where they always do). The Bais Yaakov is a town `uses` landmark; its dismissal line is
pooled people on a loop in front of the gate, spawned within 75 m. BLEND IN (with heat, on foot) is a rhythm
minigame in `ctx.foot.script` (an in-state cutscene: ⏭ = a perfect walk) with a contextual 👟 STEP touch button and a
center-slot card. The 📞 **Call** app (order 65) is visible only in a town with orgs; a call is the in-car call card
while driving (`ctx.phone.call`) and a short dialogue on foot. Nothing new on the HUD outside a Shomrim lead (a small
"calling it in…" chip) and the minigame. **TODO(rides):** when `features/rides` lands, register the three org
vehicles there (guarded) instead of growing abilities here.

**Homes (homes):** 🏠 living towns + breaking into houses. **The crowd** (`crowd.js`, `rig.js`): on `town:enter` (gated by
`ctx.enabled("homes")`) ~35–40 walkers (strollers, scooters, pairs, dog walkers on leashes, bochurim, the mail carrier) walk the
sidewalks (round corners, across, back), up to ~40 porch / lawn / driveway scenes sit on the houses (`ctx.town.homes`: a reader on a
rocker, chatters, a family on the stoop, a dad washing a driveway minivan from `ctx.town.drives`, a lemonade stand, season yard work —
raking (Sep–Nov), shovelling (Dec–Feb or snow), watering — and kids playing ball), plus delivery e-bikes in the street (not in a
party). Every figure is an **instanced rig**: a template (lib_people's Body / Arm / Leg pivots, the dog's legs + tail, a prop's
`Prop_` sub-root) is baked once into one vertex-coloured geometry per moving part, one `InstancedMesh` each, sharing ONE material
whose shader swaps per-instance `Top` / `Bottom` / `Hair` colours by a vertex slot; each frame `begin → add → end` fills only what's
drawn. Full rigs within `TUNE.NEAR` (30 m, ≤ `MAX_NEAR` 26 of them), a ~70-triangle LOD figure (one draw call for the whole town) to
`TUNE.FAR` (96 m), nothing beyond / behind a block (`sightBlocked`, staggered); far ones simulate every 3rd frame; no shadows (one
blob draw call), one leash line draw call, porch lights are one `Points` (lit by `ctx.atmos.night`; the town's window glow already
lights the houses). Kids / yard work go in at night, half the walkers stay home in the rain. Reactions: a wave / a line as she passes
slowly, gossip once she's notorious (`ctx.memory.notoriety()`, a wanted level, a house she broke into this run), scatter (a jump
sideways + a yell) from a car over 8.5 m/s heading at them, a yell at a `honk`. Sound: a synthesized `homesKids` spatial loop at the
nearest kids' lawn, the `jingle` far off every ~minute. Perf budget (`scripts/tests3d/homes.js` logs `PERF town (crowd off/on)` + what the crowd itself draws, `ctx.homes.crowd().calls / .tris`):
≤ 40 draw calls, ≤ 170k triangles of its own, crowd tick ≤ 2 ms. **Doors:** door offsets per house model (`DOORS` in `homes/index.js`, from
the Blender builders) → one ✋ `ctx.foot.addSpot` for the nearest front door; a door's family is a pure hash of (town, house, door).
The doorstep scene holds her in `ctx.foot.script` (knock → an answering resident at the door + dialogue; `choose()` menus). Going in
is `ctx.foot.handoff("home", door)` → the interiors engine (`ctx.interiors.home`, `house.js`: `defineInterior` with a `build` that lays
out 2–4 rooms from `homes_kit.glb` pieces + JS walls/floors, sets `rt.bounds` / `rt.cols` / spots / hotspots itself). Residents are
`rt.person`s with an AI in `tick`: routine waypoints (through the doorways), a view cone mesh on the floor + a "?"/"!" sprite meter,
LOS against partitions and tall furniture (low pieces — the couch — only hide her crouched), noise from grabbing / digging. Spotted:
per-kind reactions, the alarm spreads, the best adult caller walks to the wall phone (5 s; stunning them drops the call). Items:
`ITEMS` + `REACT[item][kind]` (data.js) → an `fx` (dizzy / wet / laugh / feathers / eat / blown / sneeze / startle / fooled), lines,
fight-backs (Bubbe's rolling pin dizzies Lulu — no hearts — the boy's foam darts). Loot: couch coins once per house per run + a run cap
(`COUCH.runCap`), a souvenir, the cholent (+1 heart). Leaving (door / a window jump) → `backOutside()` puts her by the house, the family
record (`store("homes").fam`, ≤ 60) and `ctx.memory.remember("homes", …)` update, the group chat texts, and a call → `ctx.law.callIn`
per charge (📞 REPORTED) or, with a cop / the town patrol near, `ctx.foot.startChase(from, { charges })`. BURGLARY's court lines and
weight are added to law's tables at boot (`law/data.js` `CHARGE_DIALOGUE` / `CHARGE_DEFENSE` / `CHARGE_WEIGHT`; the lists are in priority order — BURGLARY goes right under heist's BANK HEIST). Town hooks:
`ctx.town.homes` / `ctx.town.drives` (build.js records them), `ctx.town.allowState("interior")`; foot hooks: `ctx.foot.handoff(id, door)`,
`startChase(from, { charges })`.

**Fayge's family (features/family, roadmap 32 — `fayge.js`, `scenes.js`, `data.js`):** Lulu's older married sister Fayge,
her husband Ash (a mashgiach at a Lakewood catering hall; four words a day) and Chani (2) live in the BASEMENT of the
landlords' house on East 15th St, Midwood (Avenue M → L; the house at town-local (26, −21) — the landlords stay an
ordinary household). Her side door (a few steps down by the driveway — a dark well + rail + sign, code-built, one draw
call) is a household homes knows through `ctx.homes.addHousehold`: its own id `midwood:fayge`, cast + colours, a fixed
layout (`rooms`), its own scenes (`faygeMorning` / `Supper` / `Bedtime` / `Night` / `Friday` / `Out`, picked by the
clock — never by chance), its own ✋ door menu (she knocks; Fayge or Ash answers; family walks in as a guest; nobody home
→ the note on the door says where she is) and talk lines (sister banter that follows `ctx.moveout`'s days). Real estate
never lists the house (`market.js isFamily` → `ctx.family.isFamily`). Her day (`data.js dayOf(w)`, homes' `when()`, so a
party sees one Fayge): Sun–Thu 8:30–1 Morah Leah's playgroup (the driveway of the house at local (23, 24) on Avenue L —
a baby gate, tiny chairs, six toddlers + Chani), 1–4:30 errands with the stroller (Yanky's makolet, the bakery, Avenue
J'adore's window — rotating by weekday), 4:30–5:30 Ima's, then supper / bedtime / the night at home; Friday the bakery
then cooking for Ima's table; Shabbos at Ima's (a walk past it 2–5). Out in town she's a ✋: talk, say hi to Chani, and
two tiny jobs on homes' ledger (`ctx.homes.jobsAdd`): 🎵 circle time (5) and 🛍️ her bags home — a delivery to her door
(6); each once a real day, inside homes' DAY_CAP. She moves between places only while Lulu isn't standing next to her.

**Avigail at home + the Avenue M Ballroom (features/family, roadmap 32 · stage C — `avigail.js`):** no random Avigail
any more (the owner: "a more willing way for the player to choose"): cameos' roadside walker is off its timer (the
function stays for tests), foot's random wedding roll is 0, and her toasts / banners are gone — the meter moves quietly,
Lulu's replies are her banter line, Avigail's own lines are speech bubbles (her coupe still drives around as a car). She
LIVES at a fixed door on East 34th St between Avenue L and K (the town house nearest local (98, 95); homes gives the door
up with a claim "avigail", real estate never lists it — `ctx.family.isFamily`). Her day (`avDay`): the nail salon in the
morning, home in the afternoon (Sunday morning too), Sunday shopping on Avenue J, the hall in the evening, asleep at
night, Shabbos at her parents'. ✋ at her door: home → cameos' randomized porch conversation ON HER PORCH (she steps out),
the meter +6 (+4 for rugelach) once a real day, and she rides shotgun the next time Lulu gets in her car (cameos'
`startRide`, 2× points) — at most once a run; not home → the note on her door. The hall: town data `uses.simchahall`
(Lakewood's `town_hall` model on Avenue M between the rail and Ocean Ave, block "4,Kings Hwy" north face, spot
`simchaHall`), a marquee by the door that follows `hallNow()`: Sun–Thu 6 pm – midnight "TONIGHT: AVIGAIL & AVIEL" — ✋ →
foot's wedding (`ctx.foot.wedding({ hall: true, paid })`, staged in a ballroom: plum walls, parquet, chandeliers, round
tables); the bouquet pays as before (40 caught / 15 missed) at most once a real day (`store("family").bouquet`), again →
the dancing only; afternoons a vort, mornings the caterer setting up, otherwise closed. `ctx.family.avigail()` →
{ where, hall, door, rode, pending }.

**Shloime + Toby (features/family, roadmap 32 — `couple.js`, `couple-data.js`):** a secret couple found in the world,
never a pop-up. Shloime Pollack (Lakewood, Courtroom 2B's single dad, Baby Gitty) and Lulu's cousin Toby (Brooklyn; her
family on East 8th St, Midwood) are quietly seeing each other — he went out with her older sister RAIZY at seventeen and
Toby's mother (Aunt Brochie) never got over it. Six BEATS in order (`BEATS`), one a real day (`store("family").couple`
{ n, day, cover, picks }), each out at a real place on its hours (never Shabbos / Yom Tov): the little table outside
Midwood's pizza shop · Lakewood's makolet ("strangers") · a walk by Lakewood's lake (Raizy walks up: pick a cover) · the
far end of Midwood's municipal lot (Fayge walks up: distract her) · Toby needs a ride from Lakewood's pizza shop (a soft
beacon round the corner from her house: E 8th St & Avenue L) · Ima on her porch with a Look. From a distance they're
terrible at hiding (bubbles); up close a ✋ plays the beat (dialog + a choice; every cover works, badly). Story only —
nothing pays; the last beat → 🤫 Secret Keeper (secret badge, stat `familySecretKept`). `ctx.family.secret` → { n, of, day }.

**Households with a life (homes, roadmap 15 — `life.js`, `scenes.js`, `stage.js`, `visits.js`, `jobs.js`):** every door's family is
a pure function of its STABLE id (`town:lx:lz`, the door in the town's own frame — the same id as features/realestate; a landmark
replacing a neighbour never renames a family; old index-keyed saves migrate once per town) + two `TRAITS` (bakers, musical, neat,
hosts, night owls…) and sometimes a Zeidy. What they think of her (`opinion`: stranger · knows · likes · loves · wary · furious) comes
from the saved record (guest visits + favours − break-ins − reports); a family that likes her greets her BY NAME at the door and from
the porch. **The schedule:** `life.js › when()` = the game clock's hour (the phone's formula on `ctx.atmos.clock`; a 🎉 party shares
it) + `ctx.seasons.day()` (weekday, Shabbos, erev Shabbos, Motzei Shabbos, the holiday ids — the host's day in a party) →
`sceneFor(home)` picks one of `SCENES` by weight × traits, seeded by house + day + a two-hour slot (+ the party seed), so friends at
one door see one scene and a house changes as the evening goes on. **A scene** is data + one `stage(S)` (scenes.js header): who's
away (work, school, shul, the sukkah), where everyone sits / stands / lies (anchors from the furniture: the table's seats, the couch,
the stove, the bunk bed — `stage.js anchors()`, every standing spot pushed clear of colliders), ≤ 3 extra people (mah-jongg ladies,
the plumber, vort guests: the same rigs recoloured), ≤ 8 props merged into ONE `Kit` (decor's primitive builder: 1–3 draw calls),
zones (erev Shabbos' wet kitchen floor: squeaky footprints → "THE FLOOR!!"), ambient bubbles, what she hears from the doorstep (the
door menu's line), the knock odds / its own answer, `noPhone` (Shabbos / Yom Tov / the seder: nobody phones anything in), `hush`
(violin practice covers her footsteps), the cholent state (`notYet` on Friday). ~30 scenes: supper, homework wars, violin practice,
Bubbe's mah-jongg, the plumber, packing the minivan, the morning rush, a quiet weekday, Zeidy's nap, 3 a.m. cereal over the sink,
bedtime, erev Shabbos panic, the Shabbos table, the Shabbos nap, a kiddush, a quiet Shabbos afternoon, Motzei Shabbos pizza, a sheva
brachos, a vort, an upsherin + the year: a Chanukah party (tonight's candles in the menorah), packing mishloach manos, the Purim seudah
(costumes), everyone out in the sukkah / the rain dash inside, Pesach cleaning (a toothbrush), the seder (find the afikoman), Yom
Kippur. **Who catches her** (`stage.js CATCH`, per scene × kind): a kid makes her play / do their maths, Zeidy thinks she's the
cleaning lady, the mah-jongg ladies deal her in, the plumber takes her for his apprentice, the 3 a.m. cereal eater makes a pact, a
Shabbos / seder table sets a place (→ a guest visit: `toGuest`, counted as one). **Reasons to knock** (`visits.js`): porch wave-ins
(crowd.js `HOOKS.porch`), about one door in six with a job today (pure: door + real day; none on Shabbos / Yom Tov): 📬 misdelivered
mail / 🥘 a kugel dish / 🎁 mishloach manos on Purim (a beacon over the other family's door — openworld/marks.js), 🛍️ groceries,
👓 the glasses, 🍼 sixty seconds of babysitting (`jobs.js`); PAY per job (`JOBS`: 5–15) with a per-type cap a REAL day and `DAY_CAP`
40 coins a real day for all of them — past a cap, thanks only. The cholent's hearts: `CHOLENT_CAP` (3) a run across every house.
Phones: nothing loads at the door beyond what the house already loaded; a scene adds ≤ 3 rigs + 1–3 prop draw calls inside the house
and nothing in the street (porch wave-ins reuse the crowd's own figures + bubbles). Test `homelife`.

**Lulu's house + decorating (decor):** 🛋️ roadmap step 9, "somewhere for coins to go". `features/decor/`: `data.js` (the
catalogue: `SLOTS` — 11 spots × 5–6 choices, cheapest first, the first one = what the house has today, free; `SETS`; the lines),
`props.js` (every decoration built from primitives: a `Kit` merges boxes / balls / cylinders into ONE vertex-coloured mesh per material
— four shared materials: solid, shiny, glow (bulbs, neon), glass — so a placed thing is 1–3 draw calls and swapping never compiles a
shader; pictures / the welcome mat get a cached canvas texture; `BUILD.outside[slot][opt]` in the house's own metres, `BUILD.inside`
in Lulu's-room metres), `picker.js` (the card), `house.js` (the interior), `index.js` (save, buying, the outside, the ✋ spots).
**Outside:** `features/world`'s home street is untouched — decor adds ONE group (`DecorOutside`, the house's transform) to
`home.group` (so it hides with the street ~900 m away) and gives the house's `HomeDoor` material its own copy for the paint (the
mailbox flag shares it). ✋ spots (`ctx.foot.addSpot`, only within 32 m of the house, on foot, solo): 🏠 GO INSIDE at the front door
(house-local 0.6, 5.0 — not reachable from where a run starts at the bottom of the steps, so ✋ GET IN at the car stays the first
thing she sees), 🪑 the porch, 📬 the mailbox, 🌷 the front yard. Picking outside is a `ctx.foot.script` (she waits, facing it) with
its own camera that glides to a framing of the spot. **Inside:** `defineInterior({ id: "luluHome", model: "homesKit" })` — the kit's
furniture (homes' `homes_kit.glb`) + JS walls: kitchen (Ima at the stove, the kugel on the table), living room (the front door, the
family couch, TV), Lulu's room (bed, nightstand, a shelf unit, a sign for Dina, one warm point light — off on LOW — that the disco
ball / neon / lava lamp tint). The door spot warms it (`warm()` within 9 m, not in a run's first 1.6 s) → a soft cut in and out
(interiors engine › Flow); out the door she stands on the porch steps facing her car (the free camera then sits on the lawn, never
inside the house). Every slot is a hotspot (`slot:<id>`; the front door's asks: head outside / paint the door / stay); the picker
runs as a Room `runMode` with `rt.focusAt` leaning the camera on the spot (aimed under it: it sits above the card). **The picker**
(`openPicker(slot, api)` / `pickerTick(P)` from the host's frame): a bottom card (`body.decor-picking` makes the screen see-through
above it; fits phone portrait / landscape and TV — test), one tile per choice with its tag (✓ In place · Yours · 120 💰); moving over
a tile PREVIEWS it in place (`api.preview`, cached per slot while the card is up, trimmed to what's placed after); a press on something
she owns places it (free); on something new the first press asks "Buy · 120 💰?" and the second buys. If the pause menu takes the
screen the card closes itself. **Coins:** a SINK only — `wallet.spend` (never below 0); owned for good (`store("decor")`:
`owned {slot: [ids]}`, `placed {slot: id}`, `spent`, `bought`, `sets`, `visits`); no refunds, no resale; a SET (every piece placed at
once) is a banner + `decorSets`, never coins. Prices 20–700 (cars are 150–2500). Lines: Ima reacts to buys (a disco ball, the
flamingo flock, Bubbe's portrait…); the 🎤 mystery-singer poster is the only Dovid Dov wink (Ima nearly says it). Test:
`scripts/tests3d/decor.js` (the soft cut in, preview / ask / buy, swap free, can't go below 0, nothing pays out, the mailbox from
outside, a set, a party refuses, the picker fits phone / TV, reload → still there on the title).

**Open world (openworld):** 🌍 **Free Roam** is a party lobby activity registered through `ctx.party.addActivity("roam", …)`:
everyone drives the seeded highway and can take the town exits (planned from s = 0 for every friend, all of them up to
`startS + 1800` at run start so a late joiner's first chunks already have their ramps; `planFirst` makes the party
plan the billboards AFTER that). In a party town the town's own drivers stay home and `towntraffic.js` runs **right-turn
block loops** — a car's pose is a pure function of (party seed, block, party clock); loops never share a lane or cross
in a box, so no AI. Friends: on the highway the party's road-frame netcode; in a town the pose is published in a
**flat frame** (`s = z + 20000`, `d = −x`, heading 0; `remote.js` interpolates it 2-D, `frame(p)` → `{free: true}`) so a
corner never snaps; a frame / zone change bumps the respawn counter (friends poof instead of sliding); friends in
another zone are hidden (`show(p)`), the 👯 app says where they are and **🚀 warps** you there. My extras ride in `d.x`
(`{z: zone, ex: exit s}`), town coin pickups reuse the party's `"k"` broadcast (`"c-1:i"`, chunk −1 = the town).
**Games** (`games.js`): the host owns `A.g` (a plain object in the activity state: the whole truth in every host
snapshot); screens claim only what they saw (reliable events `owg` start · `owf` finish · `owb` bust · `owd` delivered
· `owk` kugel pass · `owp` snap) and the host validates against `g` (game number, holder, head start…). Solo, the
same rules run on a local `g` ("the host" is you) on a game-time clock. Start = everyone **warps** behind the
starter (`g.at`), 3-2-1 on the party clock (the car is held by a `controls` hook), one objective chip (`#owChip`,
top-centre, with an arrow) + a score list (`#owBoard`, `.hud-secondary`), pooled beacons + roof props
(`marks.js`: 🚓 light bar, 🥘 kugel, 💰 stash); the scoreboard + 🔁 Rematch open in the phone. **Nearby** (📍 app,
solo + party): people / landmarks / coins / exits in a town, the next exit + places + a ringing job on the highway
→ a pin (beacon + chip) that clears on arrival. Test: `scripts/tests3d/openworld.js` (logs `PERF party town`).
**The town as a hangout (ci/hangout):** 🎉 → **🌍 Hang out with friends** hosts straight into Free Roam (`hostRoam`: the activity
starts the moment we're the connected host; `noGrid` — no lobby wall, no 3-2-1); the lobby (races, road trip…) is the second
button. The invite link carries the sender (`&with=<uid>`): a joiner's `lateJoin` lands beside THAT friend (else the host) — in
their town via the warp, and on foot if they're walking (`joinOnFoot`). 📱 👯 has 📤 Invite friends + 🚪 Leave the party (one
tap; friends keep playing). **Invitations:** with friends, every game (phone, rematch or a spot) opens as `g = { ph: "in", k, n,
at, by, spot, ps: [starter], until, req }` in the host state; `owi` opts in (host adds the uid), `owgo` = the starter's "start
now", `owx` = called off; the host launches it (`launch(g)` → `G.setup` with only the opted-in `ps`) at `until`, when everyone's
in or the starter leaves; too few → `ph: "off"` + `why`. Coming within `JOIN_R` (24 m) of the spot opts you in; the chip is
tappable (`HUD.chip(…, tap)`); an on-foot player who opted in is put back in her car at GO (`backInCar`). Players who didn't opt
in are never warped / held (`controls` + the warp only look at `g.ps`). **Game spots** (`spots.js`): a 🕹️ arcade cabinet by the
pizza shop and a 📋 notice board by the hall / shul (first of `PLACES[].keys` the town has — data), plain three.js boxes + one
canvas texture each, built on `town:enter`, disposed on leave; on foot a `ctx.foot.addSpot` (✋ GAMES), in the car a stop
beside one → ✕ prompt; the card lists who's around + the games; solo it starts the solo games. **Emotes** (`party/emotes.js`,
`ctx.emotes`): the wheel = party/ui.js's (hold D-pad ↑ / F / M, aim with the right stick, let go; a quick tap = 👋; 1–8; the 😀
touch button) — on foot (solo + party: ↑ has no other job on foot) and in a party car (↑ is blanked there); my pose is posed on
top of foot's in a `hud` hook (`person.update(0, pose)`), moving off cancels it. Test: `scripts/tests3d/partyhang.js`.

**Roadside places (places/roadside.js, ci/roadside; the owner 2026-11-27: "more hospitals and different prisons/jails/courts
to the highway so people don't end up back in the city")**: three short pull-offs, once a lap at fixed lap metres where they
halve the gaps between the towns, code-built (one model each, shared materials), each with a sign 190 m before and a hello if
she stops in the bay (world/places `addPlace`, kind `roadside`): 🚔 **Trooper Post 7** 6800 (`hw:trooper`: the barracks —
Sgt. Feldman, Lenny in the two-bunk cell — its first-aid room with Trooper Ruthie, its impound yard; and `hw:court`: the
**Highway Traffic Court** in a double-wide next door, Judge Kessler with a tee time), 🚑 **Hatzalah Highway Station** 10700
(`hw:hatzalah`: the garage, the ambulance, Yossi), ⚖️ **the Weigh Station** 15700 (`hw:weigh`: a scale house with a one-bunk
lock-up, Officer Dot, Judge Pfeffer on a video screen from Boca, an impound corner; and `hw:clinic`: **Doc-in-a-Box** next
door). The judges' openers: `ctx.civic.judgeLine` (law/court.js). Worst distance from anywhere on the lap: a jail / court
2.6 km (inside JFK's zone), a hospital / clinic 1.95 km (the towns alone: 4.2 km). `ctx.civic.spot(door)` on the highway is
the roadside door (`hwSpot`: `sp.hw`, `sp.addr`, `sp.kerbAt(ahead)` its stalls, `sp.car` the impound bay); walking in → their
own rooms (`places/roadrooms.js`, code-built on the interiors engine, lines only); the scenes are law's / the ER's unchanged
(same fines, bail, bills). A 🎉 party on the highway keeps the old flow (as for towns). On the 📱 🗺️ map (lapmap `kind:
roadside`). Test `roadside`.

**Places (places): jail, court and the ER are real places in town** (roadmap 4). **The buildings are town DATA**: each
town's `uses.civic` (`places_precinct` + — its `with` entries are landmarks too, build.js `layoutFace` — `places_court` and
`places_impound`, sharing ONE block face: the towns are tight) and `uses.hospital` (`places_hospital`, an ambulance in its
bay) — Lakewood: Minivan Way behind the Simcha Palace + St. Shloimy's on Route 9; Midwood: Avenue K (green precinct lamps)
+ Midwood General on Avenue L. Models: `assets_places.py` (low-poly, merged by kit.js: ~0 extra draw calls; ~3k triangles
a town, replacing ~6 houses' worth), signs in the town atlas (`SIGNS.precinct / court / hospital / impound` in the
lines files), tints per town (ALWAYS give Walls / Trim / Roof explicitly — materials are shared by name across models).
`T.spots.precinct / court / hospital / impound` are the doors (the spot stands in front of a model's `Anchor_door`);
📍 Nearby lists them (`openworld` `SPOT_NAMES`). **Walking in freely** (`places/index.js`): on foot in a town, ✋ at a door
(warmed from 24 m: a soft cut) → the interiors engine — the precinct is interiors' `police` (Officer Pomerantz, the cell,
the MOST WANTED board, the fines window — its existing rules), the hospital interiors' `hospital` (the waiting room), the
courthouse `places/lobby.js` (`courthouse`: the metal detector + bailiff, the clerk, the docket, the bench, the locked
Courtroom 2B, the fountain; lines only, nothing pays); titles per town (`data.js` NAMES); heist/bank.js `TOWN_INTERIORS`
keeps them in town; she walks back out of the same door. Not in a chase / a party / while ✋ is a tackle. Walking past:
one Lulu line per building per visit. **Being taken there** (`places/out.js`, `ctx.civic`): `claim(kind)` at the arrest
(law/arrest.js enter, `law.arrest({skipCinematic})`) or the admission (cameos/er.js `admit`) decides WHERE: in a town that
town (`here`); on the highway in a SOLO Cruise **the nearest place of that kind ALONG THE LAP, either way round, towns and
roadside places alike** (ci/roadside, `places/roadside.js` › `nearest(kind)` = `ctx.civic.nearest`; the same answer on every
lap — a town: its copy nearest her, `exitOf(id, s − LAP/2)`; a roadside place: `{kind, id, hw, s}` at its copy on THIS lap);
otherwise null = the old flow (the stand-in precinct set, back on the highway; Story / Shabbos / a 🎉 party / the tests that
don't enable town). In town the arrest plays on the street (no `leave("quiet")`), the cruiser pulls away, then
**`placesArrive`** (⏭, a soft cut): a cruiser rolls up to the kerb in front of THAT precinct and she's walked up its steps
in cuffs → a soft cut into booking (`lawJail {placed}` — no stand-in precinct steps). The cell, the courtroom and the ER
bedside are the same sets as before (the INSIDES of the buildings), all skippable. While she's in one (on the highway
case) `ctx.civic.tick()` builds the target town in ~3 ms slices (`ctx.town.prebuild(id, exitS)` — a small addition to
town/index.js); `ready()` says when walking out is possible. **Walking out** — law/service.js `walkOutOf(door, …)` (same
bookkeeping as `resumeDriving`) → `ctx.civic.walkOut({ door, car, reason, impound, soft })`: into the town if needed
(`ctx.town.enter({ town, exitS })`, already built), on foot on the sidewalk 1 m from the door (precinct: bail / time
served / a jailbreak in the jumpsuit; courthouse: dismissed / fined; hospital: discharged), facing the street, in control
at once; HER CAR: at the kerb out front (`ctx.town.curbSpot` near the door, a drivable stub — ✋ GET IN) when it's hers
and in one piece (law's `carBack()` / the ER's `noCar`), else she walks and — the law's cases — her own car stands
behind the IMPOUND LOT's fence beside the precinct (`impoundedCar()`; ✋ at the gate: "🚗 YOUR CAR (IMPOUNDED)") — it
comes back as before (the next run / the next knock-out); nothing about impound / fine / bail / warrants / the bill
changed. Every way out is a SOFT cut (`goExit` / `ctx.dissolve`), never a black dip; if the town isn't built yet she
waits in the set with a "processing your release…" caption (≤ 40 s, then the old way). Events `places:enter` {kind, town},
`places:arrive`, `places:out` {kind, door, town, car, here}; stats `placesVisits`, `placesWalkOuts`, `placesBeeps`. Ads
(golden rule 4b): the jail ad's quiet moment in the cell is untouched (the cell is the same state). Test:
`scripts/tests3d/places.js` (`PLACES_PART=3` runs only the arrests / court / ER part).

**Real estate (realestate): own, buy and sell homes** (roadmap 16, `ci/realestate`; the owner: "realtors, mortgages yada
yada… a maximum of 10 buildings owned per player"). `features/realestate/`: `data.js` (EVERY number + the words: base price per
house model — a Midwood rowhouse 7,000 "cozy", a Lakewood townhouse 9,000, a duplex half 11,000, a Midwood house 16,000 —
× the street (`STREETS`: Ocean Pkwy 1.6 … Route 9 0.85), × next to the B/Q (0.8) / the precinct (0.9), × a per-house
neighbour quirk; the market; `CAP` = 10; the mortgage / rent / sale rules for the later stages), `registry.js` (**who owns
what — ONE swappable interface**: `claim(id, info)`, `release(id, why)`, `ownerOf(id)`, `listFor(town)`, `onChange(fn)`,
`addSource(src)` — her own homes live in `store("realestate").owned`; a 🎉 party's friends (stage 4) or, one day, a server
(golden rule 3: the owner decides) plug in as a SOURCE), `market.js` (every front door of the town she's in as a home:
`catalogue()` from `ctx.town.homes` + the same door offsets as homes' `DOORS`; ids are POSITION-based —
`"<town>:<local x>:<local z>"` of the door, rounded — never the index in `ctx.town.homes`, which shifts when a landmark
replaces houses; a house moved ≤ 3 m by a lot change is found again (`migrate`), a house that's gone is bought back at what
she paid (`compensate`, a text from the realtor); `today()` = the device's local day number (+ `CLOCK.offset` for tests);
`valueOf(rec, day)` = price × (1 ± 3.5 % on a 23-day wave): top to bottom ≤ ~7.5 %, under the 10 % sale fee, so
buy-then-sell always loses; `isListed(rec, day)` — ~7 a town, a listing stays 4 days, staggered, never hers / anyone's /
the family's (`ctx.home.isFamily(x, z)` or a spot `home` within 14 m) / a shtiebel), `signs.js` (a FOR SALE board on a
two-post frame on the lawn of every listed home + her pink mailbox with a "LULU ♥" plate: 4 InstancedMeshes for the whole
town, ≤ 4 draw calls, no shadows, rebuilt only when the listings / owners / the day change), `office.js` (the realtor's
office — interiors engine `realty`, built from homes' furniture kit: the realtor at her desk, today's LISTINGS board on the
wall → a listing → her pitch → 📍 show me (an openworld pin) / 💰 buy it now; a waiting area, a coffee machine that only
gurgles), `house.js` (interiors engine `realestateHouse`: a VIEWING — the sellers' things half packed, the realtor follows
her room to room with a line per room, ✋ at her = make an offer — or HER OWN HOUSE — empty, a beanbag, a mattress, boxes to
unpack, one pickle in the fridge), `rooms.js` (the dollhouse rooms both are built from). **The buildings are town DATA**:
`uses.realty` (Lakewood: Main St across from the bank, a `town_shop` between two shops; Midwood: the Avenue M store row) —
`T.spots.realty` is the door; heist/bank.js `TOWN_INTERIORS` keeps `realty` / `realestateHouse` in town; 📍 Nearby lists
it. **On foot in a town** (`ctx.foot.addSpot`, solo): 🏘️ ENTER <firm> at the office door (warmed from 24 m: a soft cut);
🪧 FOR SALE · price — VIEW at a sign → a `ctx.foot.script` on the lawn with its own framing camera: the realtor hurries up
the sidewalk (homes-style `spawnPerson`), her pitch (`PITCH[kind]`, the street's spin, the neighbours, `PATTER`) → 🏠 look
inside (`ctx.foot.handoff("realestateHouse", …)`; out = back on that front path) / 💰 buy / 🏦 a mortgage / not today;
🔑 YOUR HOUSE — GO IN at her own door (r 3.2 — beats homes' knock menu at the same door; no knocking, no burglary);
📬 YOUR MAILBOX (`first` within 1.3 m). **Buying** (`buy(rec, opts)`): solo only; not if it's hers / not listed today / she
has 10; too dear = the realtor says so and nothing changes; otherwise TWO presses — 💰 buy → ✍️ Sign — n 💰 — then
`wallet.spend` (never below 0), `registry.claim`, ONE must-see banner (🔑 YOUR HOUSE!, prio 3), the realtor's SOLD line; the
rest is dialogue. **📞 Phone › 🏘️ The realtor** (a `ctx.community.addContact` — the phone stays 9 apps): 🔑 YOUR PLACES
(n / 10) + today's listings in this town, tap = 📍 a pin. **For city hall** (`ci/cityhall`): `ctx.realestate.addBill(id,
{ what, amount })` / `bills(id)` / `payBill(id, i)` (a per-home list anyone can add to; real estate never charges it) + the
`realestate:owner` event {id, from, to, price, why} whenever a home changes hands. **For features/homes**:
`ctx.realestate.claims(id)` → "mine" | "listed" | null, `keyOf(x, z)` (the position id of any door). Save: `store("realestate")`
— 3D-only, the classic 2D game never sees it. Test: `scripts/tests3d/realestate.js`.
**🏠 Go there** (`goto.js`, the owner 2026-11-26): 📞 the realtor's contact › Your places has a "🏠 Go there" per home — a
soft cut and she stands at its front door on foot (facing it: the camera stays on the sidewalk), her car at the nearest
kerb, from anywhere (the highway, the other town, a room — out by its own door first). Engine ways only: `ctx.town.warp`
into the NEAREST copy of the town (every lap has one; in that town: the very copy she's in), the door looked up there by
its fixed address, `ctx.town.curbSpot`, `ctx.foot.start("home")`. Free; refused with one plain line (`goBlock(id)`) while
wanted / chased, on a job / heist, in a game with friends, on a test drive, arrested / in court / jail / the ER, on the
road trip / the Friday rush, in Dina's mode, mid-scene in a room, in a borrowed or wrecked / impounded car, for the
Council's or a tenant's home; a 20 s cooldown. With friends she goes alone (the friend finder points to her). The house
list is cached per COPY of a town (lap 2's doors aren't lap 1's), and "🏠 Start my days here" stores the door of lap 1's
copy (`startAtFor`) — a house picked on lap 2+ starts the day at the right door. Test `realestatego` (+ realestatefriends).

**Moving out of Ima's + her home is where friends visit** (roadmap 23 d, the owner 2026-11-26). **d1** (data only, no coin
source): the `STARTER.perTown` (3) cheapest homes nobody owns in each town are ALWAYS listed (`market.js › starters()` — no
discount: a home's value never depends on it, so nothing to flip); her FIRST home's mortgage (`mortgage.js › offers()`: nothing
owned, nothing bought yet) asks 10 / 20 / 35 % down over 30 or 45 played days; one goal line at the top of 📞 the realtor's
contact (`moveOutStep()`: office → look inside a starter home → buy → "Start my days here"; gone once her days start at a home
of her own). A played day earns ~500–650; starter homes are ~5,200 (Midwood) / ~7,000 (Lakewood). **d2**: a friend in her home
sees HER decorations — `party.js` publishes them as `d.x.rd` (one base-36 char per decor slot, parallel to `d.x.re`; a separate
key so older clients ignore it) → `friendDecor(id)` → `house.js` (inside) + `yard.js` (outside); 👯 "Come to my place"
(`visit.js`, a `ctx.group.invitable`): the home's id rides as `d.x.rv` for 30 s, friends who say yes get 🏠 Go there to it
(`goBlock(id, { friend: true })`). The five things Ima's house had that her homes didn't: the couch (inside — the kit couch in
her colours) and the front door's paint, the porch, the mailbox, the front yard (`yard.js`: features/decor's own models moved
onto HER house by an anchor — the door / the stoop or deck found by one short ray / where her mailbox stands / the lawn —
mirrored to her lot's open side; the pink LULU mailbox stands aside for a decor one); decorated from inside (✋ "🏡 Decorate the
outside" → decor's picker, previews on the street). Anything she owns is free to place (ci/moveout's boxes are owned items;
its `seed` puts her room pieces up in her first home). Tests `realestateyard`, `realestatefriends`, `realestatehome`.

**The mortgage desk** (`mortgage.js`, stage 2): added to heist's `bank` lobby from here on `interior:enter` (a desk, a
tower of paperwork, a MORTGAGES sign, the banker — Mr. Pinkus in Lakewood, Mrs. Teitelbaum in Midwood — and ONE hotspot;
heist's file only lists the two rooms in `TOWN_INTERIORS`). 🏠 buy a home with a mortgage = today's listings → 20 / 35 /
50 % down → 10 / 20 / 30 PLAYED days with a flat 5 / 10 / 15 % fee on the loan → the forty-signature comedy + the terms
said plainly → ✍️ Sign (two presses) → `take(rec, plan)`: the down payment, `finalize` (deal.js — shared with cash),
`S.mortgage[id] = {down, loan, fee, total, days, perDay, paid, n, missed, last, due, paidIn}`. `tick()` (index.js's ~2 Hz
hud check, only in `playing` / `footRun`, no dialog): a NEW played day settles the last one (unpaid = `missed++`: 1 → a
stern letter, 2 → the realtor's "we should talk", 3 → `foreclose`: the house goes back and she gets the LARGER of
(today's value − 10 % − what she owes) or half of everything she paid in; never below 0) and bills today; a bill due is
paid by itself the moment the wallet has it (`payToday`, a 🏦 text in 📱 Messages thread `bank`). Days she doesn't play
never happen. 💳 my mortgages: pay today's now / 🏁 pay it all off (`payoff`: owed − half the fee still in it; two
presses). Events `realestate:mortgage` {id, phase: start | payment | missed | foreclosed | paidOff}.

**Decorating, rent, selling** (stage 3). Her own house's bedroom is the SAME size as decor's room (`rooms.js` W 6.2 × D
5.6), so decor's `HOUSE_SPOTS` (shifted to her bedroom) are ✋ hotspots and decor's `openPicker` runs with this house's
api: `owns` = decor's (anything she bought for Lulu's room is free to place here too), `placed` / `place` = this house
(`S.decor[houseId]`), `buy` = `ctx.decor.buy` then her family house gets its old piece back — the same catalogue, prices,
wallet, toasts; `buildOption` / `wallTex` draw it. Solo only, not with a tenant. `rent.js`: the realtor's 🔑 My places →
🧑 find a tenant (`TENANTS`, moves in the next played day; ✋ inside: their lines) / 👋 ask them to leave; each new played
day a tenant pays 1 % of the home's value into ITS mailbox (`RENT.dayCap` 150 across ALL her homes, scaled down; a pile
≤ 3 days); ✋ 📬 collects (`addCoins(n, "rent")`). 🪧 sell it: `quote(id)` = value − 10 % − the bank's pay-off (≥ 0),
two presses, the house goes back on the market (its tenant, decorations and uncollected rent go with it — the rent is
paid out). The value drifts ±3.5 % (≤ ~7.5 % top to bottom) and the fee is 10 %, so buy → sell always loses (test: the
best day-pair over 46 days ≤ 0.97).

**The world-wide market + the government** (stages 5–6; the OWNER approved the shared market and the relay change for
it, 2026-11-20 — scope: the property registry only). `server/homes.mjs` (see `server/README.md`: endpoints, what's
stored, the government's knobs, rollback) + `server.js` here: probes `/homes/config` (an old server = 404 → local,
retried every 5 min; a `?test` page only talks to `&mpurl=`); identity = `ctx.player` (core/player.js, shared with 👯
friends: a random id + a device secret the server only hashes; the 💾 save code carries both); `claim` BEFORE the
coins move (taken / seized / cap → the realtor says so, nothing spent), every release queued + retried, `hello` every
10 min (the idle clock; a restored phone gets its homes back), the town's homes polled every 90 s as a registry SOURCE
(`{ name: "Kugel Kid #37" }` — generated labels only; "a neighbour" while ⚙️ 🌐 Play online is off). A home bought
offline that the world got first → refunded (`refundLost`). **The government:** 14 days without a hello → the
server seizes every home (the Abandoned Kugel Ordinance): `S.owned[id].seized` — no key, a SEIZED board on the lawn
(a 5th InstancedMesh), the Council's letter (📱 thread `council`), no rent and no mortgage billed; 7 days later it's
back on the market (`lost`). **Court** (`court.js`): a case per held home on that town's Courtroom 2B docket
(ci/courts' `ctx.civic.courts.addCase`, data only — the Council's lawyer, three defences, an async `verdict` act) or
the clerk's fast track at her SEIZED board: a held home → the SERVER rolls (`appealWin` 50 %): won → hers again, lost
→ back on the market + 25 % of what she paid in; an already-lost home → the judge rolls 50 %: 50 % of what she paid in,
else 10 %. Once per house, never more than she paid, never below 0. Every notice and deed ends "Subject to change if
the government decides differently." Tests: `realestateworld` (two players, one local relay: shared ownership, a race,
an offline refund, a hacked client, the seizure, the court, an old server), `node server/test-homes.mjs`.

**Shul (shul): a shul you can walk into** (roadmap 18; the owner: "More immersion overall through the cities… A shul?").
One per town, **no new building**: Lakewood's is the existing yeshiva on Carpool Ln (`T.spots.yeshiva`; its sign got a second
line "Shul · Beis Medrash · Minyanim"), Midwood's the existing `town_mw_shul` on E 15½ St (`T.spots.shul`, "Young Israel of East
15½ Street"). The front door is a ✋ spot (`shul/index.js`, the Places pattern: warmed from 24 m → `ctx.interiors.shul.enter()`
is a soft cut; she walks back out of the same door; not in a chase / party outside Free Roam; heist/bank.js `TOWN_INTERIORS`
keeps the town). The outside adds nothing to the town (0 triangles, one walk-by line per visit). **The room** (`shul/room.js`, the
interiors engine with `homesKit` as its base model — built from kit pieces + boxes, no new asset): left → right, seen
dollhouse-style: the men's HALL (aron kodesh behind its parochet, the bimah, benches + shtenders, seforim shelves — seen
through the lattice, never walked: she can't open the aron or touch anything holy, and nothing there is a hot-spot), the
**mechitza** (a wooden lattice), the WOMEN'S SECTION (her own entrance; chairs, a seforim shelf), the LOBBY (the coat rack with
100 identical black hats, the memorial board with its little lights, the candy man's seat), the KIDDUSH ROOM (a long table,
herring, kichel, a wobbling kugel with a DO-NOT-ASK note). Cost: the structure is ONE merged vertex-coloured mesh + a
translucent lattice; benches / shtenders / chairs / hats / the crowd are InstancedMeshes; ≤ 8 people rigs. **What's on**
(`plan()` — `ctx.seasons.day()` + the clock; `ctx.shul.debug.force` in tests): `weekday` (a few learning, the gabbai pacing "we need a
tenth", the kid on his laps), `friday` (setting up the kiddush room), `davening` (Shabbos before 12 / after 17: the hall full, quiet
— only quiet hot-spots), `kiddush` (12–15: a crowd, the regulars, the seat-saver), `afternoon` (15–17), `fast` (subdued light, the
candy man declines, a bare table), `yk` (everyone in white, parochet white, nobody to talk to), + Chanukah's menorah by the door
(n + the helper lit). **Rules**: the jokes are about people; nothing holy is interactive; no coins change hands (the candy man's
lollipop — `SAVE.lastPop` day key, ONE a real day, nothing but a smile; tested: coins, hearts, score unchanged); lines are in
`shul/data.js`. Tests `scripts/tests3d/shul.js`.

**Clothes (clothes, ci/clothes — roadmap 24):** 👗 a clothing shop in each town + outfits on Lulu herself. **Outfits** (`wear.js`):
six slots (top · skirt · tights · shoes · coat · one extra). Top / skirt / tights / shoes RECOLOUR the materials her model already
has (`Top`, `Bottom`, `Tights`, `Shoes` — no extra draw call; the car's Lulu: `Shirt`); a coat recolours her sleeves (`Top`) and
adds its own shape (a lathe coat / robe, the puffer, a cardigan's front), an extra adds one (shades, headband, scarf, pearls, a bag,
the big pocketbook, the iced coffee) — ONE merged vertex-coloured mesh per limb it sits on (`Outfit_Body` / `Outfit_Arm_R|L`,
geometry cached per look and shared), so ≤ 2 extra draws on her and nothing on crowds. **`core/people.js` dresses every Lulu it
spawns** (`setDresser`): her outfit by default, `outfit: {…}` for someone else's, `outfit: false` for none; a Lulu whose `colors`
set `Top` (the jumpsuit, the ER gown, a disguise, a stranger's ghost) is left alone. Her Lulus are remembered and re-dressed in place
on a change (`clothes:changed`). A save without clothes = today's Lulu exactly. **The shop** (`shop.js`, the interiors engine,
built from boxes like shops/rooms.js): town data `uses.clothes` (`clothesUse(town)` in `data.js`) — Lakewood: Simcha's Classic
Clothing on Main St (block 2,1 n, between Pizza Shmizza and the realtor), Midwood: Avenue J'adore on Avenue J (block 1,2 n); the
door is a ✋ foot spot (`spot "clothes"`), the room is in heist/bank.js TOWN_INTERIORS (the town stays) and together SHARED. Racks
→ shops' card (`card.js`: the pieces, a colour dot, the price, one line; ✋ again = Try on, two presses = Buy) → TRY ON in the
fitting room (free; `changeAnim`: the curtain closes, a spin, it opens ≈ 1.1 s, ✕ / ○ skips; the mirror view = the room camera
eased in front of her) → BUY at the counter (`garage/buy.js › buyClothes`: never below 0; the bag crosses the counter while the price
counts down over the till) → put it on (the fitting room). Changing clothes happens ONLY in a fitting room or at a closet.
**The closet** (`closet.js`, `placeCloset(rt, { x, z, ry, col, where })` — one call from each room): in her room at Ima's
(`decor/house.js`, on the far wall in front of Dina's door — changing only, nothing decorated) and in every home she owns
(`realestate/house.js`, the front corner of her room — not a friend's visit, not a tenant's). ✋ → the doors swing open, the
mirror view, shops' card of what she owns slot by slot (+ "my old top" / "no coat" / "no extra"), a preview on her as she picks,
👗 Put it on (the same spin) and ≤ 3 saved looks (`S.saved`). `stage.js` holds what both share (`changeAnim`, `mirrorOn`: the room
def's camera swapped for a close one, put back on any exit). **JFK** (stage 3): `SHOPS.jfk` — Maison de Gelt, the luxury house
(2,000–25,000; one bag costs more than the cheapest house), the same room via `ctx.clothes.enterAs("jfk", { exit })`. Its door
(`airdoor.js`; the owner allowed this one change at the airport): a sign on Terminal 4½'s front past the last door + a ✋ spot on
the pavement (`ctx.airport.at(f, r)`, the airport's one helper for it; logged in `docs/airport-plan.md` › Sync log); out = the
same spot. `?maison=0` shuts it. **Numbered pieces, world-wide** (`limited.js`; the relay's `server/wear.mjs`, golden rule 3's
third exception): `LIMITED` (bag 25 · trench 50 · wrap 75 · shades 100) — the shelf asks `stockOf(id)` (the relay's
`/wear/stock`, cached a minute): "12 of 75 left" / SOLD OUT behind glass / "No. 17 of 50" once hers; buying = `/wear/reserve`
(her number held 5 min) → the coins (`buyClothes`) → `/wear/confirm`; a failed pay cancels, a hold that ran out refunds, a paid
buy not yet confirmed (`S.pending`) finishes at the next launch, `/wear/mine` restores numbers on a new phone (never charged
twice). Needs an account with a username; offline / the relay down → "come back when you're online", the rest of the shop works.
Every number + line: `data.js`. Test `clothes`.

**City hall (cityhall, ci/cityhall — roadmap 17: "a town that governs (badly)"):** 🏛️ the owner: "Taxes. Banks. Annoying
government regulation. Mayor. Protests… more corruption. More immersion." `features/cityhall/`, landed in stages.
**Stage 1 — the building + the mayors.** The building is TOWN DATA: `uses.cityhall` = `cityhallUse(town, { with })`
(`place.js`, like shops' `dealerUse`) — Lakewood City Hall on Minivan Way (block 3,2 n, next door to the precinct + court),
Midwood Borough Hall on Avenue K (block 2,2 s, across from them), a plain house either side; the face's old houses are
gone (realestate's `migrate` / `compensate` handle any home that was bought there). The model `cityhall_hall` is CODE-BUILT
(`models.js`, registered into `models` when the town file imports `place.js`; merged by kit.js like any Blender model:
~0 draw calls, ~1.5k triangles, tints by material name Walls / Trim / Roof / Accent): a columned portico + pediment
(the town's atlas sign on the frieze), steps, a clock tower stuck at ten to five with a little dome, two flagpoles,
benches, planters and the mayor's statue of himself. `T.spots.cityhall` is the door; 📍 Nearby lists it (openworld
`SPOT_NAMES`); heist/bank.js `TOWN_INTERIORS` keeps the room in town. **Walking in** (`index.js`, the Places pattern):
✋ 🏛️ ENTER CITY HALL at the door (warmed from 24 m → a soft cut), not in a chase / a party outside Free Roam / a robbery;
out by the same door. **The room** (`lobby.js`, interiors engine `cityhall` on `homesKit` + boxes, `rooms.js`): three
dollhouse rooms — the MAYOR'S OFFICE (desk between two flags, his self-portrait, the giant scissors; the mayor himself
unless `mayorIn()` is false: out cutting a ribbon, or lunch 12–13), the LOBBY (the take-a-number machine: her number
`S.ticket` goes up, NOW SERVING stays 37 — now and then it flicks to 38 and straight back; two benches of people waiting
since Chanukah; the notice board; the mayor's poster; his secretary), the WINDOWS (PERMITS · TAXES · COMPLAINTS — one is
always BACK IN 5 MINUTES: `closedWindow()` = the hour mod 3). Later stages hang a window's real business on
`ctx.cityhall.windows[id] = async (rt, who, clerkName) → handled`. **The mayors** (fictional; no party, no real-world
politics): Lakewood's Mayor Fishel Kugelman (ribbon-cutter-in-chief), Midwood's Mayor Hershel Pickleman (nobody else ran)
— lines in `data.js` `MAYOR`. **Ribbon cuttings** (`ribbon.js`): on foot in a town, now and then (≤ 2 a run, gap
150–260 s, `ctx.enabled("cityhall")`), 22–40 m up her sidewalk: two posts + a red ribbon, the absurd thing (a pothole, a
bench, a speed bump, a meter / a trash can, a hydrant, a crosswalk, a bike rack — one baked mesh), the mayor with giant
scissors + three onlookers; his speech → *SNIP* → polite clapping; ✋ before the snip: 🎀 hold the ribbon / 📸 a photo /
walk on. Bubbles only (the pop-up budget), nothing pays. Events `cityhall:enter` {town}, `cityhall:mayor` {town, ask},
`cityhall:complaint` {about}, `cityhall:ribbon` {phase, what, town, held}; stats `cityhallVisits`, `cityhallTickets`,
`cityhallComplaints`, `cityhallSelfies`, `cityhallRibbonsHeld`, `cityhallRibbonPhotos`. Save `store("cityhall")` (3D only).
`ctx.cityhall` = `{ spot, enter, mayorIn, closedWindow, here, mayor(town), ribbon, windows, tax, fees, contactRender, permits,
inspect, protest, story, debug }`. Later stages extend the room through `addWindowHook(id, fn, prio)` / `WIN_LABELS` /
`LOBBY_BUILDERS` / `MAYOR_LINES` (lobby.js) and the phone contact through `CONTACT_EXTRAS` (pay.js).
**Stage 2 — property tax, silly fees, the lien** (`tax.js`, `fees.js`, `pay.js`, `court.js`; numbers in `data.js` › `TAX`,
`FEES`, `FEE_CAP`, `FEE_TUNE`). ONE ledger (`S.ledger.bills`: kind `tax` · `fee` · `lien`) and its own played-day clock: a new
device day (real estate's `today()`, so its test CLOCK moves both) becomes a PLAYED day only once she's out in the world
(`taxTick`, ~2 Hz, `playing` / `footRun`, Cruise / Story, no dialog) — days away never happen, the first day only starts the
clock. Each played day: tax = 0.2 % of each home's listed `price` (stable, mortgage or not; else what she paid / `valueOf`; not `seized` / `lost`),
≤ 50 a day across all homes (scaled down), and unpaid tax stops growing at 7 days' worth; every tax line is mirrored on real
estate's per-home list (`addBill` with a `ref`, `payBill` when settled). NOTHING is taken by itself: she pays at the TAXES
window (`addWindowHook("taxes")`: what she owes → 💰 pay it all / pay what I can → ✍️ Pay — two presses) or from 📞 Phone ›
🏛️ City Hall (`ctx.community.addContact`, the phone stays 9 apps: the bills + two taps) — whole bills oldest first, only
what the wallet has, never below 0. Late (oldest unpaid tax): 3 played days → a stern letter (📱 Messages › City Hall), 6 →
the LIEN ("on your mailbox flag") + a 10-coin lien fee + a case on that town's Courtroom 2B docket (`court.js`,
`ctx.civic.courts.addCase` — the Town Attorney, three silly defences; `LIEN_COURT.win` 50 %: won = the fee waived + the lien
lifted, lost = she pays now, only what she has); everything paid lifts it. Tax NEVER touches who owns a home (real estate's
server-side Abandoned Kugel Ordinance is the only thing that does). **Fees** (`fees.js`): 🔊 loud-honk surcharge (6 honks in
30 s in town) · 🚒 parking near a hydrant (in spirit) (out of her car in town, 30 %) · 🪑 porch-sitting licence (a played day
she owns a home, 40 %) · 📣 complaint filing fee · 📋 inspection finding (stage 3) — each kind once a real day, ≤ 10 a real day
in all, posted quietly to the inbox (`ctx.phone.inbox.post`, no pop-up), expired after 7 played days unpaid. Events
`cityhall:bill` / `cityhall:day` / `cityhall:paid` / `cityhall:letter` / `cityhall:lien` {phase: filed | won | lost | lifted}.
**Stage 3 — permits + the inspector** (`permits.js`, `inspect.js`). Nothing ever WAITS for a permit: a tenant moving into one
of her homes (`realestate:tenant` {phase: "in"}) or a bought change outside her family house (`decor:place` {bought} on
door / porch / mailbox / lawn) → a quiet 📝 note → the errand: PERMITS (the form "in triplicate": two silly questions) →
the stamp at TAXES (or COMPLAINTS when Taxes is "back in 5 minutes") → PERMITS: PERMIT GRANTED (free; one must-see banner).
While a form waits, Permits is never the closed window. The windows' labels say what's next (`WIN_LABELS`). **The
inspector** is crime's Inspector Pinchas (`ctx.crime.corruption.who("pinchas").mood`: `gone` → Inspector Pnina, by the
book; `nervous` → "everything's fine!" and off; bribed / partner / a past donation → a wink): once a real day, walking within
30 m of one of her homes in a town (solo), 60 % (always while that home waits on a permit) he's on the front path with an
absurd finding → ✋ 📄 show the permit (granted → he leaves) · 🙄 write it up (a finding fee on the ledger) · 🍩 a
"donation" (3 coins if she has them → no finding; `cityhall:corrupt` {who: "pinchas", act: "donation"}) · 👋 walk away.
Once a run he's inspecting the pizza shop / makolet / bakery as she walks past (bubbles only).
**Stage 4 — protests** (`protest.js`, `PROTESTS` / `PROTEST_HOURS`). In a town's protest hours (Lakewood 10–13, 15–19 ·
Midwood 11–14, 16–20, the device clock) a picket line of 9 walks a loop on the sidewalk by city hall (or the pizza shop, for
the sauce) — homes' instanced rigs + one InstancedMesh per slogan + one for the sticks (≈ +12 draw calls in view). The topic
follows the real day: the crooked eruv wire · the pizza shop's new sauce · alternate-side parking · the Kugel Ordinance ·
double strollers; the day she got the loud-honk surcharge it's HER honking (a marcher points). Chants pass down the line in
bubbles (`H.bubbleOk`); ✋ 🪧 THE PROTEST: join in → a 4-beat rhythm chant (foot's `script`: ✕ while each word is lit) → the
crowd's verdict · what's it about? · walk on; honking near it → "HONK IF YOU AGREE!". Local + cosmetic, nothing pays.
Never real-world politics, never a real group.
**Stage 5 — the corruption thread** (`story.js`, `STORY` / `STORY_PAY`), one story per town: SHMULY THE EXPEDITER on a
folding chair in the lobby (`LOBBY_BUILDERS`) — with a form waiting, 5 coins and it's "stamped" (a sink) → the NOTICE BOARD's
"PAVING CONTRACT AWARDED: <firm>. Number of bids: 1." starts it → from then the brother-in-law's crew is repaving the smooth
street in front of city hall (solo): ✋ 📸 a photo (evidence) · 🤝 a cut (+6 once per town; 15 % an Internal Affairs sting →
`ctx.law.arrest(["BRIBING A PUBLIC SERVANT (MINOR)"])`, crime's charge) · walk on → the photo in 📞 City Hall
(`CONTACT_EXTRAS`): 📰 the local paper (+10) / 🕵️ Internal Affairs (+10) → exposed: the crew gone, the mayor sheepish
(`MAYOR_LINES`) · 💰 sell it back (+6) → the mayor friendly. Every payout once per town, ≤ 15 a real day; `cityhall:corrupt`
{who, act}, `cityhall:story` {town, step, how}, `ctx.memory.remember("cityhall", …)`.
**Roadmap 31 — Midwood's new mayor** (`mayor.js`; owner 2026-11-27). The owner asked for a parody of a real politician
written as an enemy of Jews; the agents declined THAT part (a real, identifiable person is not written as persecuting a
community, and no edict is aimed at one) and the coordinator told the owner. What's built is a communist-wannabe planner,
POLICY satire only. His name is ONE constant (`data.js` › `MIDWOOD_MAYOR`, "Mayor Marxdani" — the owner asked for a name that
rhymes with a real mayor's; the pun is on politics, never on the person or where a name comes from); a generic young
politician in a suit; no religion / ethnicity / looks, no real party or quotes, nobody singled out. Pickleman
lost by 3 votes: his pickle stand on the sidewalk outside Borough Hall (✋ 🥒 PICKLEMAN'S RECOUNT, lines only). `EDICTS`
(10, every one landing on EVERYONE equally: the People's Grocery's one cabbage, free buses that never come, the rent freeze
that froze the boilers, a Five-Year Plan for one pothole, one People's Kugel Kitchen, Avenue K-for-Kollective, the People's
Bench, a ticket quota, one umbrella per block, the People's Loaf) — `todayEdict()` by the real day, skipping struck ones —
drive Midwood's protest topic (protest.js asks `edictTopic()`), the notice board (`LOBBY_BUILDERS`), a Complaints line
(`COMPLAINT_EXTRAS`, lobby.js), staff eye-rolls, and a Courtroom 2B case per edict (`cityhall:edict:<id>`, priority 5, one
hearing a real day, solo): Lulu speaks for the neighbours and the edict is STRUCK DOWN for good (`S.struck`, event
`cityhall:edict` {phase: "struck"}). Ribbon cuttings in Midwood are "the People's ___"; the paving story's Midwood crew is
"The People's Paving Collective"; Kugelman is delighted by comparison. Nothing pays or charges; no new pop-ups / texts.
`ctx.cityhall.mayor31` = `{ today, topic, strike, addCase, standStart, standStop, MY }`.
**Roadmap 38 — the owner's two requested parodies** (`wrongaddress.js`, `comment.js`, `parodyday.js`; owner 2026-11-27).
These are the owner's REQUESTED EXCEPTIONS to "never real-world politics", agreed with the coordinator before anything was
built, with the guardrails written in: the target is the BEHAVIOUR (blaming a neighbourhood shop for a foreign conflict;
conspiracy thinking at a town meeting), never a people — no ethnic, national or religious markers or costume on anyone, no
flags of any real country, no real chants or slogans, nothing about any war or anyone's suffering, no slurs, no violence
toward anyone, nobody is "the enemy"; the owner's first wording ("make [one side] look foolish") was declined and this
version approved. The App Store risk (Apple's rule on content about religion / national origin; satire is usually allowed)
was flagged to the owner. WHEN (`parodyday.js`, pure functions of the date): `dayOn(kind)` = a hash of the real date (the same
for every friend) below `WRONG_ADDRESS.rate` / `COMMENT_NIGHT.rate` (0.5 each — the owner asked for 5× the proposed 1-in-10),
never on a Friday, Shabbos, Yom Tov or a fast / solemn day (the evening one also never on the eve of one: after sunset it's
that day — `quietDay(date, evening)` reads seasons' `calendar.js`); `onNow` adds the hours (11:30–15:00 · 18:00–21:30);
`PD.force` for tests; 👀 a PREVIEW for one page load (never saved, like seasons' `?season=`): `?parody=address` / `?parody=comment` (or `both`) forces it on whatever the date and the hour, `&day=N` steps through the rotation, `&shop=pizza|bakery|makolet` picks the shop (`fromQuery`). Each day's line-up is a seeded shuffle of the date (`waPlan` / `pcnPlan`), so a week doesn't repeat.
🪧 THE WRONG ADDRESS (Midwood, lunchtime): 4–5 archetypes (the clipboard, the man at every protest, the lady who thought it
was the lunch line, a livestreamer with no viewers, megaphone guy, the sign fixer…) on the sidewalk on one side of today's
shop (Slice of Sinai / the bakery / Yanky's makolet — `shops[].crowd`, the door kept ≥ 2 m clear), homes' instanced rigs +
one sign each (the back of every sign blank — "DOWN WITH (see other side)"); the first sign is their own flyer — "THIS SHOP
SELLS LAND IN ISRAEL", the only place the subject appears; the shopkeeper hands out samples; every `leaveEvery` s near her one
gives up and walks into the shop for lunch, and when the last one goes it's packed up for the day (`WAS.done`). Half the days
a counter-protest table (WE BROUGHT SNACKS) + somebody's Bubbe walking between the two with rugelach. ✋ 🪧: her own rhythm
chant (protest.js's bar: "WHAT DO WE WANT? / A SLICE! / … / LUNCH!"), 💬 a line, 📢 what's it about (the flyer vs. the
shopkeeper: "I sell pizza"), 🛒 buy the shop's thing (its price; never below 0; she never earns), 📸 a picture (a stat); ✋ 🥨
the counter-protest. A honk → an eye-roll. Bubbles near her only; no pop-ups, no texts; no cops. 🎤 PUBLIC COMMENT NIGHT
(Lakewood City Hall, evenings — a `LOBBY_BUILDERS` entry): a mic stand, an agenda easel (ITEM 1: THE POTHOLE ON MINIVAN WAY),
a row of folding chairs; two of three named cranks (Gary, Darlene, Ron) give the "they're taking over" speech and it
collapses under its own evidence; the secretary as clerk ("Sir. The item is the pothole."); the mayor asleep in his office;
their own neighbours (Linda, Tom) sit them down by name ("Gary. The Goldbergs shovelled your driveway all winter. Sit."),
Pothole Phil only talks about the pothole — a normal town with a couple of cranks, never two sides. The meeting runs as
bubbles every `beat` s while she's inside (`rt.every`); ✋ 🎤 her turn (the pothole's dimensions · yield her time to the pothole
· ask Gary about the cholent, only when he's there) → the vote → deferred. No collisions on any of them: the doorway, the
benches and the windows room stay free (she can still pay a ticket). Nothing pays anywhere. `ctx.cityhall.parody` = `{ waPlan,
waStart, waStop, leaveOne, buy, chant, talk, WAS, fill, pcnPlan, mic, CNS, dayOn, onNow, quietDay, PD }`; event
`cityhall:parody` {kind: "wa" | "pcn", phase}; stats `parodyChants`, `parodyBuys`, `parodyPhotos`, `parodyMeetings`, `parodyMic`.
Tests: `cityhall` (stage 1), `cityhall2` (stage 2), `cityhall3` (stages 3–5; `CITYHALL_PART=permits,inspector,protest,story`), `cityhall4` (roadmap 31), `cityhall5` (roadmap 38: a year of day rules, a banned-word scan with a hashed slur list, both scenes).

**Shops (shops, ci/shops): the shop moved into the world** (the owner, 2026-11-20: "the shop button … seems pretty hidden
for the average person … move the shop to places in game"). `features/shops/`: the places you buy things at, one buying
pattern for all of them, and the old 🛒 Shop button turned into directions. **The places are town DATA** like the civic
buildings: a town's `uses.<kind>` with code-built models (`shops/models.js` — boxes with named materials registered straight
into `models[key]`, merged by kit.js like any Blender model: ~0 draw calls). **🚗 Uncle Refael's Pre-Loved Cars**
(`shops/lot.js` › `dealerUse()` → `uses.dealer`; Lakewood: block 0,0 on Route 9 — the first thing on the right driving in;
Midwood: Coney Island Ave between Avenues M and L, its frontage kept free of parked cars by `clearParking`): the showroom
(`shops_dealer`: glass front, a fascia for the town's sign, bunting over the lot, a resting tube guy) + one `with` entry per
car for sale (`shops_lotcar`: a ~330-triangle stand-in for Lulu's convertible tinted Body / BodyLight / BodyDark, its pad and a
price board — a 256 px sign in the town's atlas, `signW`); each car's spot is `lot_<skin>` and its merge is TAGGED (build.js:
a `tag: true` landmark → `T.spots[spot].tag`, its `Fixed_*` nodes stay put) so `dealer.js` can lift it out and stand the REAL
car there while she looks (one real car at a time). **Buying in the world** (`card.js`, decor's picker generalised: the same
`decor-card` / `dp-*` styles): walk up, ✋, a bottom card of tiles for THAT place (the lot: every car, D-pad walks the camera
down the row), the focused one's details above (a car: the 4 stat bars + its flavour line); a press on something free does it,
on something for sale the first press asks "Buy · 150 💰?", the second buys (`wallet.spend` — never below zero; a short wallet
shakes the tile and says how much more), one must-see toast. **`garage/buy.js` is the ONE writer** for every place: the same
shared-save fields the old Shop wrote (cars: `ownedSkins` + `selectedSkin`; items: `missiles` / `pepperSpray` / `shields` /
`distractedUnlocked`; horns: `ownedHorns` + `horn`; decorations: `ownedDecor` + `decor`) — the classic 2D game reads them.
A bought car is her ride at once (like the old Shop): a soft cut and she drives it off the lot from the kerb (her old car
"goes home"); **🔑 TEST DRIVE** (solo, a car she doesn't own, her own car around — `ownCar` parked / ok): a soft cut into it
at the kerb (`ctx.car.setSkin` only — the save is untouched), 60 s (`TEST.secs`) with a HUD line + a light over the lot; it
ends when she stops at the lot, gets out, the time's up (a soft cut: on her feet at the lot, her own car at the kerb out front —
`foot.start("droveOff")`, places' `kerbAt`), leaves town (swapped back where she is) or a scene takes over (an arrest, a
knock-out: swapped back at once). **🔑 Her garage at home** (`home.js`): cars she owns wait at home — ✋ 🔑 MY CARS by the
garage door (beside the parked car's rear) → the same card with every car: hers to pick (free: `equipSkin` +
`ctx.foot.repaintCar()` repaints the car in the driveway), the rest dimmed with "at Uncle Refael's". **🛍️ Where to shop**
(`guide.js`; the Garage drawer's item `shop` — same id, order 30 — and the pause menu's tools): every place, what it sells and
where; ✕ on one MARKS it (`store("shops").dest`): openworld's pooled beacon (key `shopsDest`) + one `day-chip`-style HUD line —
over the door in a town that has it, over the next exit into such a town on the highway, over the garage door at home; it
clears when she gets there. **🛒 The makolet** (`counter.js`; town data `uses.makolet`: Lakewood ZISSY'S MAKOLET & PHARMACY on Main St
— block 1,2, a `town_shop` between two others; Midwood YANKY'S 24-HOUR MAKOLET on Avenue J — block 0,2, a `town_mw_store`):
✋ at the door → pepper spray, the bubble shield ("Bubble Wrap for Cars — as seen on TV") and Distracted Mode ("the phone
plan"); the keeper in the doorway, the focused item turning on a crate by the door (garage's item models, loaded when she
walks up). **😈 Shmerel's van** (the black market — Velvel's cousin; cartoon "fireworks"): a dark minivan at the kerb by
Lakewood's construction site on 14th St / outside Midwood's car service on Coney Island Ave (`BLACK.spot`: a town spot + metres
along, that frontage kept clear by `clearParking`) — missiles, the Mega 5-Pack, pepper spray ("the label's in Russian"); the van
and Shmerel are spawned only within 70 m (no collider: the van stands in the parking lane). **✨ Refael's Bling Bay** (`bling.js`;
the dealership's second door — a `with` entry `shops_blingsign`, spot `bling`, pink neon): every horn (focus = hear it) and every
decoration (focus = fitted on a copy of HER car — her paint, `garage/decor.js` `makeDecor` / `attachToModel` — pulled up at the
kerb out front, clear of her parked car); free on what she owns (a horn back on, a decoration on / off). With all three the old
counter is empty (`garage/shop.js` `retireTab` — `cars`, `items`, `bling`; the "shop" state still exists but nothing opens it).
**🍕 Walk-in shops** (`rooms.js`): the pizza shop (Lakewood PIZZA SHMIZZA · Midwood SLICE OF SINAI — the town's `pizza` spot)
and Midwood's bakery (CHALLAH-DAY INN, `bakery`) are interiors (`shopsPizza`, `shopsBakery`) built from boxes on the engine
(model `shops_roomkit`: two empties), warmed within 24 m (a soft cut in and out of the same door): a counter with the brick oven
/ the display case, a menu board, tables, the server, a line of three, someone eating; ✋ lines from all of them. The counter
sells ONE snack a run across every shop (`G.shopsSnack`): a slice 6 💰 / a rugelach 4 💰 that heals one heart — never free,
never a coin source. Both are SHARED rooms (together/rooms.js, one per town) and town interiors (heist/bank.js
`TOWN_INTERIORS`). Ima's list can also ask for milk at the makolet (`shops:makolet`). The makolet itself stays a storefront card.
Ima's list (features/day `ctx.day.addItem`) can say "say hi to Uncle Refael" (`shops:open`) — 15 💰 once a day like every
item. The showroom is solid from the lot too (town data `walls: [w, d]` on a landmark → circles along its front + sides, town/build.js),
the lot is OPEN GROUND inside its block (`ctx.shops.onLot(x, z)` — unstuck + the QA watchdog treat it like Lulu's own lot, and foot's
camera stays over it: `foot/jump.js camClip` stops where the lot ends), and stopping her CAR at the lot says on the prompt line
"get out and walk up to a car". Uncle Refael (npcMan, a dark work jacket — gruff, short, no haggling; the owner renamed him 2026-11-22) stands at the door while she's within 70 m (spawned / dropped — nothing loaded far
away). Events `shops:open` {place, town}, `shops:buy` {kind, id, price}, `shops:car` {id, how}, `shops:test` {id, phase};
stats `shopsVisits`, `shopsTestDrives`, `skinsBought`. Test: `scripts/tests3d/shops.js` (`SHOPS_PART=guide,home,lot,…`).

**The Parking Challenge on a lot** (`features/parking`, ci/parkinglot; the owner, 2026-11-22: "I want one main world and that's
it… parking challenge should move to a lot"). No separate scene any more (the old roadside lot set, its sky, the zoom-in and the
white flash are gone; `parkingEnd` is gone). **The course** (`course.js`): one in every rest area, in the open corner of the truck
lot beside Mendel's garage — rest-area coords u 148.65…168, d 41.6…66: the kerb along the garage's side, the bay row, a 14 m
lane out to the semis, bollards at the lot's edge (the closed end), and at the open end by the lamp the attendant (npcMan +
a clipboard, spawned within 150 m) beside his 🅿️ booth, a painted START box and a sign. A course has its own flat frame: local
X along the kerb, Z away from it, laid out in the 2D game's lot pixels (`lot.js`: X = (x − 240) / 17, Z = (y − 150) / 17) — so
every level's bay, parked cars and numbers are the 2D ones; `toWorld` / `toLocal` / `hWorld` turn it by the highway's heading.
The static course is merged by material into the highway chunk that holds its middle (~10 draw calls, its bollards / booth /
sign posts are chunk colliders). **Starting**: pull into the START box and stop (unlocked: the level starts — no button; locked:
hold ✕ to spend the 1,000 💰, once); foot's "get out & walk" stands down there. The booth's ✋ (on foot) unlocks + marks, the 📱 💼
Jobs card marks (a beacon `parkDest`), neither moves her. **A level** (state `parking`, `driving: true` — `updateDriving` with
`lotCtl()`: 2D's governor 4 / 2.5 m/s, reverse from a stop, gas while rolling back brakes; her real car, the world and its traffic
going on round her; the lot itself is closed to other cars): the crew sets out the level in a group turned with the course (the
parked cars — real clones, dents on their bodywork —, the security cameras on the sidewalk with their lasers, a cone in the bay
4+, a stray shopping cart 6+, a pedestrian 5+ who waits for her and then steps round, cars cutting through from the gap between
the semis 7+ who stop for her, Sasquatch on the sidewalk at 10), popping in with a puff; the attendant whistles. Scoring exactly
2D (★★★ no contact · ★★ no car touched · ★ dinged; level × 25 + 15/★; a hard hit / the pedestrian / a car cutting through /
the clock → CRASH, −1 of 3 lives, the grandpa). **Between levels no card**: the attendant holds up a board (a sprite: the stars +
coins / CRASH) + one toast, and she pulls out into the lane and stops (a beacon) — the crew re-sets the course round her for
the next level (the START box is for level 1). After 10 / the last life: the board shows the run + one line, and she's in `playing` again. Driving out of the course or
❚❚ › Leave the Parking Challenge ends it. HUD: one chip in the left slot (`.day-chip.park-chip`: LVL · ♥ · ★ · 💰 · ⏱ + the level
name; 📝 Ima's list steps aside while she parks — `body.park-on`), the level's name (a moment) / the hints / HOLD STILL TO PARK
on the prompt line, the red low-time vignette and bump flash (`hud.js`). 🎥 cycles Lot cam (higher + further back, eased behind her heading, reversing doesn't swing it) · Overhead (her
+ the bay, the kerb at the top, like 2D) · Chase (the regular camera). The weekly quest `parks3` counts the course's parks.
**The roadside pull-over is retired** (the highway has no kerb to park at and its lanes can't be closed while she manoeuvres;
stopping on the shoulder still gets her out and walking) — with it the Shared Road party lot (`pose()` → null). Ads: there's no
card, so no ad. Test: `scripts/tests3d/parking.js` (`PARKING_PART=basic,levels,layouts`; `debug.autopark()` — a real reverse
parallel park with the car's physics, both directions, and the pull-out between levels — parks all ten levels).

**Car dealerships off the highway** (`features/dealers`, ci/dealers; the owner, 2026-11-27: "a car dealership for real good
luxury cars somewhere near the highway … a sales man and with real negotiating and upselling packages. And real luxuries for
certain cars"). Both stand at **lap metre 800** (`data.js` › `LAP_M`), once a lap, the same place for every friend.
**Mazelati of Monsey** ("hand-built in Monsey, Italy"): a `world/places.js` pull-off on the right (d 30; `reserve` 766–834,
`paved` 2 for the forecourt), a code-built glass showroom (`models.js` › `dealers_mazelati`: one merged vertex-coloured
mesh + the glass + the fascia; `SHOW` = its layout), four cars on pedestals out front (real car clones + the kit, spawned
only within ~110 m of her — `index.js`) and Sal Mazel at the door. The cars are new car ids registered at import into
`car.js` › `SKINS` (stats over Uncle Refael's best + `nitro`, `perks`, `kit: "mazelati"`) and `garage/data.js` ›
`SKIN_SHOP` / `SKIN_KEYS` (price, flavour, `where`); `car.js` › `KITS[sk.kit](model, anchors, sk)` hangs a few parts on the
one convertible (a hood ornament, chrome). Old clients don't know the ids and draw the pink car; the classic 2D game falls
back to pink too. On foot: ✋ at a car → the card (`shops/card.js`; the stat bars on their own longer scale) → 🤝 Sal:
**the haggle** (`haggle.js`, the numbers in `data.js` › `HAGGLE`): a counter (−5 / −10 %) meets her halfway and costs his
patience 1, "final offer" (≈ −12 %, floor −15 %) costs 2; out of patience → back to the sticker, take it or leave it ("you
lost the deal, not your coins"); walking toward the door with a counter on the table → "let me talk to my manager" once
(5 % more off, never under the floor). The deal is paid through `garage/buy.js` › `buyCar(id, { price })` (clamped to
85–100 % of the sticker; never below 0). Then **the F&I office**: one card per option her car can still take (they work —
`perks.js`: 🚀 launch control, 🔋 a bigger nitro tank (`ctx.G.nitroTank`, read by `core/driving.js`), 💆 massage seats
(+1 ♥ once a run), 🥂 the fridge (a nitro sip once a run), 🛎️ the concierge horn) and the nonsense (undercoating,
nitrogen, VIN etching, Platinum Peace of Mind — a joke, remembered: `remembered()`), paid with `buyExtra`. The Machatunim
GT's 🅿️ self-park: ❚❚ › "Let the car park itself" in a Parking Challenge level (`ctx.parking.selfPark()`, once a level,
★ and no level bonus). Nothing here pays coins. 3D save `dealers` (options per car, the nonsense, deals / walk-outs).
`ctx.dealers` = { open(id), haggle(id), perks(id), has(k), debug }; events `dealers:haggle` / `dealers:option` /
`dealers:nonsense` / `dealers:perk`. 📱 Map: `ctx.pins.add` (when ci/hud's registry exists). Test: `dealers`.
**Tushla Motors** (stage 2, `ev.js`): across the highway at the same lap metre — a LEFT pull-off (d −30, `reserve` side −1),
reached by crossing the oncoming lanes like any left turn (never driving along them the wrong way). White, minimalist, no
salesmen: a tablet kiosk (✋ → the card: four EVs at a fixed price, two taps to buy; acceleration off Refael's chart) and
the founder, Reb Zev Volt, who posts too much (toasts while she's there). **⚡ Full Schlep Driving** (`schlep.js`, the
numbers in `data.js` › `SUB`): 100 coins per 30 REAL days, "renews in N days"; cancel any time (it runs to the end of
what she paid); at the end it renews once if not cancelled and she has the coins, else it lapses quietly — never a debt
(`buyExtra`). In a Tushla on the highway, ❚❚ › "⚡ Let the car drive": a `controls` hook (after `core/driving.js` ›
`autoDrive`) holds a lane of OUR side at the mode's speed — 👵 Bubbe 50 mph / 🙂 Normal / 🌶️ Meshuga at the limit
(`law/data.js` › `SPEED_LIMIT` − 1 mph: a radar never flags it), a gap to the car ahead, overtakes when the next lane is
clear (`traffic.laneFree`). Steer / brake / nitro / handbrake take over; it hands back with a chime for a chase, a work
zone ahead (`roadevents/construction.js` › `zoneAhead`), a 💼 job, a town, getting out, a crash. `ctx.G.selfDriving`
turns off close calls (`core/driving.js`) and style moves (`moves/common.js` › `addMove`). Quirks (a phantom brake…).
Not yet: through town to the 📍 Ping (needs ci/hud's ping). `ctx.dealers.schlep` = { subscribe, cancel, renewCheck,
active(), daysLeft(), engage(), handBack(why), setMode(m), on, mode }; events `dealers:sub` / `dealers:selfdrive` /
`dealers:ev`. Tests move the clock with `ctx.schlepNow`.

**The courthouses' own stories** (`places/courts.js` + the words in `places/shloime.js`; owner, 2026-11-20).
**Lakewood — "In re: Baby Gitty"**: Shloime (and the baby) on the lobby bench rehearsing, the case on the docket, ✋ at
Courtroom 2B "⚖️ Sit in on the hearing" → state **`placesHearing`** (⏭ skippable, a soft cut both ways): a spectator scene
on law's courtroom set (`law/court.js` › `courtStage()` hands over the built set — Lulu-in-the-dock + the jury hidden,
Shloime / his hopeless lawyer Fishbein / Malky / the baby added, her very good lawyer is the prosecutor's body, Lulu in the
gallery), then straight back into the lobby. FIVE hearings (`HEARINGS`: steps `[who, text]` / `{do}` / `{choose}`), ONE a
real local day (`store("courts")` `shloime` 0–5 + `day`), hearing 3 puts Lulu on the stand as a character witness (a
choice, all three hopeless); a skipped hearing counts as seen. After the case: Shloime pushes `homesStreet`'s stroller (baby Gitty in it)
up and down the sidewalk BESIDE Lakewood's courthouse door (never across it), ✋ "👶 TALK TO SHLOIME" (bubbles). Pays nothing; stats `shloimeHearings` /
`shloimeCase` / `shloimeChats`, the 3D badge 👶 "Friend of the Court". Solo only: in a 🎉 party 2B stays locked (the scene
isn't shared). **Midwood — Abba is her lawyer**: law/court.js asks `ctx.civic.counsel(tier, charges)` → in Midwood's court a
VOICE `{key, speaker, name, emoji, opening, argue, afterProsecutor, uninvited, beforeJury, verdict}` (null elsewhere): the
lawyer's body is `lawAbba`, his lines replace the lawyer's words (he wraps the rules' own `lawyerChargeArgument`), and with no
lawyer hired he sits in uninvited; tried WITH friends (law/crew.js co-defendants) he represents them all (`codefendants`). The tier, the factors, the random draws and the verdict are exactly the regular lawyer's
(the lines rotate, no `Math.random`). Abba also sits on the Midwood lobby's bench ("I have a 2 o'clock. …It's you, isn't it.");
Midwood's 2B stays locked (a small-claims case through the door) unless a case is on its docket. **New cases are DATA**:
`ctx.civic.courts.addCase({ id, town, title, cast, hearings, oneADay, solo, available(), setup / tick / shot / acts, done(H),
label, models })` (the full shape is documented at the top of courts.js' CASES section) — the lobby's docket + the ✋ at 2B
pick up the first open case in that town, the hearing player seats its cast (`seat`: petitioner / petCounsel / respondent /
respCounsel / judge / bailiff / gallery / stand or coordinates; `model` + `colors`), plays its steps (`[who, text]`, `{do}`,
`{choose}` → `H.choices`), and `done(H)` tells the case's owner how it went (`H.last` = over) — rewards and consequences are
the owner's; progress is saved per case (`store("courts").cases[id]`). Shloime's case is the first one registered. Test:
`scripts/tests3d/courts.js` (`COURTS_PART=1` the hearings, `=2` the trials, Midwood's lobby + a data-only test case).

**Partners in crime (law, `features/law/crew.js` — ci/partners):** 🔗 the owner (2026-11-20): "friends be arrested together
if they're both caught committing a crime at the same time… see the same screen and somehow go to court or both escape
together." The law stays PERSONAL in a 🎉 party (each friend's own cops / chase / cell / court on her own screen); this is one
layer on top that joins 2–4 friends into a CREW (only in 🌍 Free Roam / 🏡 Road Trip — the law stands down in races):
**together** = (a) both are SEEN breaking the law — a chase starts, in the car or on foot — within `CREW_TUNE.crimeMs` (8 s)
and `near` (45 m) of each other in the same zone (the highway / the same town), or (b) every one of them asked for the same
partnership (`ctx.law.crew.partners(uids, why)` — a crime for two, ci/bankfriends' bank job). The HOST pairs them from what
each screen reports about ITSELF (`pzc` / `pzp` events) into `activity.pz.c`; a screen only ADOPTS a crew while its own
player is in trouble (chasing / in custody) or asked for it — so a friend (or a hacked page) can never put you in a crew,
raise your stars or get you arrested; strangers are never party members. **Wanted together:** 🔗 PARTNERS · <names> above
the stars on both HUDs; each member's chase climbs to the crew's highest stars (one star a second, never down); LOST 'EM
waits for the crew — a member's meter holds at the top (`L.crewHold`, cops.js) while a partner is still seen, and lands
for everyone once they're all out of sight. **Split up** (more than `splitD` 150 m apart for `splitMs` 5 s): the host picks
who the cops stay on — the one they can SEE, then more stars, then whoever's driving, then the first in (`pickKept`); the
others slip away ("they went after …"), the crew is over. **Caught together** = cuffed (lawArrest / straight to booking)
within `bustMs` (20 s) of the first, in the same zone (`pzb`); once a partner's caught, ✋ 🚔 GIVE YOURSELF UP with <name>
(on foot within `giveR` 35 m — an urgent spot) or stopping right beside her (≤ 20 m, 2.5 s) while the cops are still on you =
cuffed too (AIDING AND ABETTING). Caught together → the same precinct (features/places; on the highway in a party the old
stand-in set) → **the same cell**: each screen draws its partners in the cell set (a jumpsuit Lulu with her hair + a nametag,
`CellMate`), their emotes (the cell card's 👋 🙌 🤦 💃 — `d.x.e`, the party's own slots), "🔗 Cellmates: you & …" on the card;
ONE court clock (it holds while a caught partner is on her way in — ≤ `waitCell` 40 s — then restarts at 22 s for all).
**The cell's choice:** ⚖️ court (the default — the clock) or 🏃 BREAK OUT TOGETHER (the Escape button becomes a vote; the
break starts on every screen once everyone in the cell said yes; each picks HER OWN lock, eased — a pin fewer, a wider zone
— "<name> makes a scene for the guard"; each her own result). Both out → they wait for each other at the door (≤ 10 s) and
run out of the precinct side by side, fugitives (the fugitive rules per player, unchanged). One out, one in → the one
outside gets ✋ 🔓 SPRING <name> at the precinct door → the one inside gets "🔓 <name> is at the back door — GO!" on her
card (her choice) → the escape vignette → out beside her; the helper gets AIDING AN ESCAPE on her OWN record. **Court as
co-defendants:** the partner in court at the same time stands beside her in the dock (`courtTick`), the judge's pair line
("the two of you AGAIN?!"), they blame each other (her line + a bubble from the partner), each her OWN charges / plea /
verdict / fine from her own save, and her partner's verdict as her screen ruled it (`d.x.pz[6]`). **Out of the door
together:** the release waits (≤ `waitDoor` 10 s) for a partner still inside, then both walk out of the precinct /
courthouse side by side (`walkOut({ side })` ±1.6 m, their cars one behind the other at the kerb); on the highway both come
back to the road at the crew's spot a few car lengths apart (`crewResume`). **Bail a friend out:** any party friend in a
cell in THIS town — the precinct desk (interiors' `police`, Officer Pomerantz) offers 💰 Bail out <name> · 💰<her bail>; the
helper pays from HER OWN wallet, only once the prisoner's screen took it (host-validated `pzh` → the prisoner's `pzha`);
the prisoner's wallet is untouched, she's out on bail (still WANTED till court — the solo rule). A lowball / self / not-in-a-
cell request is refused by the host; nobody is ever paid coins, so nothing can be minted. **Fair + calm:** a leaver (closed
the app, left the party) drops out of the crew at once — the others carry on solo from where they are (no wait is longer
than a few seconds; every wait has a timeout); every coin / verdict / bail amount is computed on the player's own screen
from her own save (the solo rules and amounts unchanged); the iOS jail ad stays "never in a party" (native's OFF); no new
pop-ups beyond one 🔗 toast when a crew forms (prio 3) — the rest is the HUD's crew line + the cell card. **On the wire**
(existing relay protocol only): `d.x.pz = [crew n, stars, flags, evade %, x×10, z×10, verdict, bail]` (~7 Hz while it
changes); events → host `pzc` `pzp` `pzb` `pzx` `pzh` `pzha`; host state `activity.pz = { n, c: [crews], h: {help} }`.
**API** (`ctx.law.crew`): `current()` · `partners(uids, why)` · `wanted(n, reason)` · `bust(charges)` · `leave()` ·
`friendsInside()` · `bailOut(uid)` · `springOut(uid)` · `peel()` · `tune` (`CREW_TUNE`) · `debug`; **`ctx.law.partners.crime({ id, crew,
charge, heat, msg })`** — another feature's crime for a crew (ci/bankfriends' co-op bank job): call it once on EACH member's
screen (idempotent per id): she asks to be partners with `crew` and her own chase starts at `heat` (in a car the pursuit, on
foot a foot cop); when it's over for HER, that screen emits `law:crew` { id, uid, result: "ok" (got away) | "busted" (taken
into custody) }. Events `law:crewFormed` {n, ps, why, mates}, `law:crewSplit`, `law:crewCaught`, `law:crewCell`, `law:crewVote`, `law:crewBail`, `law:crewSpring`; stats
`crewFormed`, `crewSurrenders`, `crewBails`, `crewSprings`. Tests: `scripts/tests3d/partners.js` (together / not together /
a hacked friend / a stranger, one wanted level, hiding together, splitting up, caught together in Lakewood → the same cell
on both screens + a cell emote + one court clock → co-defendants → out of the courthouse side by side) and `partners2.js`
(breaking out together, one out one in → spring, bailing a friend out at the desk + a lowball refused, a leaver mid-cell).

**Crimes for two (partners, `features/partners` — ci/partners):** small cartoon crimes that are funny with a friend, in a 🎉
party's 🌍 Free Roam / 🏡 Road Trip; each is opt-in by DOING your own part (nobody is dragged in) and makes the two PARTNERS
(each screen calls `ctx.law.crew.partners` for itself → the crew above). 🎲 **DOUBLE DARE** — both warned / chased for the
SAME thing (a stop sign, a speed trap…) within `TUNE.dareMs` 6 s and `dareR` 40 m: pot 30 split (15 each for two), ≤ 3 a
real day per device. 🚗 **FLAG & GRAB** — one ✋ FLAGS DOWN a car (the party's claim with a hail), a friend nearby JACKS it
within `grabMs` 20 s: partners, pot 30 split (15 each), ≤ 2 a run; the flagger can 🚗 HOP IN beside her (features/together).
🔔 **RING & SNEAK** — a friend is sneaking around inside a house: its door menu offers "🔔 Ring the bell — cover for <name>"
→ on HER screen everyone inside comes to the door for `ringSec` 12 s (homes' `ctx.homes.distract` — the "fooled" pose, no view
cones); out unseen within `ringMs` 90 s = CLEAN JOB, pot 20 split (10 each), ≤ 2 a run. 🍌 **GETAWAY PEELS** — riding in a
friend's car (`ctx.openworld.riding`) while the cops chase HER: the horn button / the 🍌 PEEL touch button tosses a peel →
the nearest chasing cruiser on the DRIVER's screen spins out (`ctx.law.crew.peel()`), ≤ 3 a ride, no coins. **Coins** (golden
rule 5): a fixed pot SPLIT, never multiplied by the party; each share paid by the player's OWN screen into her own wallet
for her own part, capped there — a friend's message can never pay you (a hacked page can only ever pay itself its capped
share). On the wire: party broadcasts only (`pzd` `pzf` `pzg` `pzr` `pzs` `pzt`; the job-settling ones go out three times,
every handler ignores a repeat); small additions in others' files: `streets:carjack` carries the car's party `key`, homes'
door menu + `ctx.homes.distract`. Tune `PAY` / `TUNE` in `features/partners/index.js`. Events `partners:job` {kind, with,
coins}, `partners:ring`, `partners:rung`, `partners:peel`, `partners:peeled`; stats `partnerJobs`, `partnerPeels`,
`crewPeelHits`. Test `scripts/tests3d/partners3.js`.

**Getting an impounded car back (impound, `features/impound` — ci/impound, roadmap 30):** 🚗 when the law walks her out of a
precinct on foot, her car stays behind that town's impound fence (features/places `walkOut(impound)` → `places:out` {car: false} →
`IM.held = {town}`; `ctx.foot.ownCar === "gone"`). THE LEGAL WAY: one fee (`FEE` in `data.js`: 120, the very first time ever 60 —
a sink, never below 0) at ONE of: the lot's own window (✋ at its gate — places' gate spot asks `ctx.impound.gate()` first) ·
City Hall's PERMITS window (`cityhall/lobby.js addWindowHook("permits", …)`, prio 30: "Form VR-7, in triplicate") · 📞 Contacts ›
City Hall (`cityhall/pay.js CONTACT_EXTRAS`: tap, tap; one `need: true` text). City Hall / the phone give a slip
(`IM.released`); the gate with it (or paying there) → `release()`: the clone behind the fence goes, her car is placed at the
kerb in front of the gate (`places/out.js kerbAt`) and foot restarts `droveOff` beside it (ownCar "parked" — ✋ in and away).
Can't afford it → told, nothing taken, still held: a new run (home) resets it — today's fallback. THE BREAK-IN (`breakin.js`):
✋ at the loose panel (the front fence, left of the gate) → `ctx.foot.script`: she sneaks inside the 12 × 12 lot (camera-relative
stick, run = faster + a faster meter; the fence, her car and the two cruisers are solid); Bruno (heist's guard model) paces the
back with a flashlight cone and a camera sweeps from the front-right post (both drawn as fans on the ground); in a cone the "?"
meter fills — full = spotted: first his ⚠️ look (`TUNE.lookLife` 25 s), again while that's live → she's put outside the gate and
`ctx.foot.startChase(gate, { charges: ["GRAND THEFT AUTO (HER OWN CAR)"] })` (its arrest + court lines via `law.addCharge` —
the victim is the defendant); caught → the usual arrest → out of the precinct on foot, the car back behind the fence, the fee
still owed. ✋ at her car unseen for `TUNE.hotwire` s → `release("breakin")` (no fee). One try a REAL day (`SAVE.breakDay`):
after it Bruno is "extra awake" (a wider, longer light that sweeps, no sandwich breaks). Shown on the objective line's LOWEST slot
(`H.OBJ.info`, `.impound-chip`) and on the 📱 Map via `ctx.pins` when that exists. Gated by `ctx.enabled("impound")` (off → the
gate says its old line). Friends: each her own car + fee (all local). `ctx.impound { held, released, fee(), pay(where), gate(),
gateLabel(), release(how), panel(), breakIn(), debug }`; events `impound:<held | paid | broke | release | breakin>`; stats
`impoundPaid`, `impoundReleases`, `impoundBreakIns`, `impoundBreakOuts`, `impoundBreakClean`, `impoundBreakBusts`. Test
`scripts/tests3d/impound.js`.

**Speed cameras (cameras, `features/cameras` — ci/cameras, roadmap 36):** 📸 the owner (2026-11-27): "speed cameras… only on
ocean parkway for now at 25mph and only trigger if going above 35mph… a flash… a few days later it'll come on the mail to one of
lulus houses with the pic attached and the fine… court or cops will come after her… speed cameras to all schools as well with
maybe a 15mph limit for that block". THE POLES (built on the town tick, keyed by town id + ORIGIN so a town placed somewhere new
gets new poles; disposed on `town:leave` / title; one baked mesh + a canvas sign each, school ones + a beacon): Ocean Parkway
(Midwood) — `PKWY.at` local z 95 + 200 (between the avenues), on the sidewalk (`st.outer + 1`); the zone is the whole boulevard
(|lx − c| < outer + 1, ±6 m along). Every school block — town spots `school` / `yeshiva` / `baisyaakov`: the same street as the
spot (`road.nearest`) within `SCHOOL.reach` m; only in school hours (device clock, `SCHOOL_HOURS`: Sun–Thu 7:30–16:30, Fri to 13:00,
never Shabbos) — the beacon blinks then. Numbers (all in `data.js`): parkway limit 25, fires ONLY above 35, fine 40; school limit
15, fires above 25, fine 60. One ticket per pass (re-armed `TUNE.rearm` m past the pole), ≤ `TUNE.dayCap` (3) a REAL day, never in
a chase / as a fugitive, never outside cruise / story mode, never a self-driving car. THE FLASH (`fire()`): a white overlay pop
(`#camFlash`; reduced motion → a fainter, slower fade), a point light on the car for 0.15 s, Lulu's one bubble line (banter, only
when `H.bubbleOk`) — no toast; and THE PICTURE: the scene rendered from the pole into a 192 × 112 target (a pale clear colour for
the sky), gamma-fixed, a caption strip (mph · limit · where) → a ~5 kB JPEG data URL kept on the ticket (≤ `TUNE.photos`; the
oldest closed ticket's picture goes first). THE LADDER runs on `cityhall:day` (City Hall's played-day clock, `tax.ledger.played` —
playing rarely never misses a step, not playing can't dodge one): `mailAfter` (2) played days after the flash → `addLine("fine",
…)` on City Hall's ledger (paid at the Taxes window / 📞 Contacts › City Hall like the property tax, `cityhall:paid` closes the
ticket), the notice is unread, ONE `need: true` 💬 line ("📬 Mail from the Borough of Midwood"), Ima's one line when the day
starts at the family house, and "📬 You have mail" on the objective line's LOWEST slot (`H.OBJ.info`, `.cam-chip`) until she reads
it; + `dueAfter` (3) unpaid → a late fee (`TUNE.lateFee` 20, another line) + a SECOND NOTICE; + `summonsAfter` (3) → a SUMMONS: a
case `cameras:<id>` in that town's Courtroom 2B (`ctx.civic.courts.addCase`, the Borough Attorney, three defences; `rule()`:
dismissed `TUNE.dismiss` → its lines waived, else upheld → she pays what she has, the rest stays owed, never below 0); an
unanswered summons `warrantAfter` (3) played days, or `warrantUnpaid` (3) OVERDUE tickets at once → a BENCH WARRANT on law's own
file (`ctx.law.addWarrant("UNPAID SPEED CAMERA TICKETS")` — a cop who gets a good look at her lights her up; only a judge clears
it; the charge's cop / Lulu / court lines via `law.addCharge`); `law:arrest` while it's on → the warrant's served (its open
tickets closed). Licence points: none. THE MAILBOX: where her day starts — `ctx.home.startAt.door` (her own house, realestate's
"🏠 Start my day here") or the family house's mailbox (house-local 3.0, 12.4 — decor/props.js); a `ctx.foot.addSpot` (`first`,
"📬 MAIL FROM THE CITY") while anything's unread → `read()`: one `H.showScreen` card, every notice with its photo, where, the speed,
the fine owed and the pay-by. 📱 Map: a "Pay tickets here" pin (`ctx.pins`, cat mine) at the city hall of the town she owes in.
`ctx.cameras { cams, tickets(), unread(), mailbox(), read(), schoolHours(), warrant, debug }`; events `cameras:<built | flash |
capped | skip | mail | late | summons | ruled | paid | warrant | served | read>`; stats `camFlashes`, `camPaid`, `camDismissed`,
`camUpheld`, `camWarrants`. Test `scripts/tests3d/cameras.js` (tests set `debug.CM.force.manual` and drive `check()` themselves).

**Town crimes (crime, `features/crime` — ci/crime, roadmap 18):** 🦹 the owner (2026-11-20): "More crime. More corruption.
More immersion… more to do in cities". Small, complete loops the law already understands, SOLO, in a town (Cruise / Story run;
never in a party — friends have Crimes for two — or Dina's mode; `ctx.enabled("crime")`). Each: a spot / a moment in the world →
a risk → a small CAPPED reward (per REAL day — `PAY` in `data.js`) → caught = its charge in court (`law.addCharge`: arrest lines,
the lawyer's argument, a courtroom moment that always plays). **Who's watching** (`common.js copWatching`): the law's own units /
traps (`law.copSees`) or the town's patrol car with a clear line of sight (`ctx.town.blocksSight`) — strangers' ghosts and friends
never count. **On foot** (`footCrime`): the first petty thing a cop SEES is a ⚠️ look (a banner, `TUNE.susLife` 30 s), the same
kind again while it's live = `ctx.foot.startChase(cop, { charges })` (caught → `law.arrest` → the town's precinct → court).
**In the car**: `law.notice(charge, { witness })` (the law's own warning → chase). 🛒 **The cart** (`cart.js`): a baked
one-draw-call cart on the sidewalk by the pizza shop / bakery (`ctx.town.spot`, u +7.5 — the arcade is at −7.5); ✋ RIDE →
`ctx.foot.script` (she sits in it; downhill for 4.5 s, then drag; the stick steers); townsfolk within 2.6 m scatter
(`ctx.town.people()`); ends on a stop / a building front / a car; pays 4 + 1 per 12 m + 2 a scatter (≤ 15 a ride; only the first
2 rides of a real day pay); a cop who sees it: look → chase (GRAND THEFT SHOPPING CART); it rolls home 12 s after she's walked
off. 🚶‍♀️ **Jaywalking** (`jaywalk.js`): kerb → the other kerb of the SAME street, mid-block (≥ 11 m from every crossing), in
≤ 9 s; another within 14 s = the combo (a bubble); a car > 3 m/s within 4.2 m = a close one; the combo settles when it lapses:
from ×2, 2 a crossing (+1 a close one), ≤ 12 a real day; each crossing a cop sees counts for the look → chase (SERIAL
JAYWALKING). 🅿️ **Double-parking** (`doublepark.js`, a `hook("update")` — driving frames only): stopped ≥ 1.6 s in the
outside travel lane of a street with a parking lane, mid-block → the prompt → ✕ hazards on: the town drivers that queue up
behind her (their own gap rule) = a honk each; drive off → 1 a car (≤ 8 a stop, + 3 for "the order" after 24 s), ≤ 16 a real
day; out of the car / any other state = no pay. A cop who sees it past the grace (Midwood 40 s — "hazards are on, it's legal",
the patrol shrugs; Lakewood 14 s) → `law.notice("DOUBLE PARKING")`. **Pop-ups:** one must-see toast a crime (its payout); the
rest are speech bubbles. **Cost:** the cart is built on `town:enter` and disposed on `town:leave`; per frame a street lookup
(`TownRoad.nearest`, sticky) while she walks / stands still in the car. Tune `PAY` / `TUNE` / `LINES` in `data.js`. Test
`scripts/tests3d/crime.js`.

**Crime that isn't hers (crime stage 2 — `others.js` wires `monte.js`, `watches.js`, `porch.js`; `street.js`):** street
characters exist only while she's near (`Character`: spawned within 90 m, dropped past 120 m), each one something she can
REPORT (✋ in person → `community.callOut("police" | "shomrim")`, or from the 📞 Phone — `community.addReason`), foil, ignore
or join. A report sends a BEAT COP (`sendCop`: walks in from ~28 m up the street, nabs the perp — a hand on the shoulder,
cartoon). 🥄 **Find the kugel** (Yanky Three-Cups' folding table by the bank / hall / bakery, u −10): play = rigged, −3 💰
(≤ 3 plays a real day: a sink) · report → +8 once a real day, he remembers ("Not YOU again." — the table folds when she walks
up) · be his shill → a mark every 5 s, 2 💰 each, ≤ 8 a real day, +heat; a cop who SEES her shilling: the ⚠️ look. The table
FOLDS whenever a cop is in sight of it (`copWatching`, 40 m) and is back 45 s after they've gone. ⌚ **The coat of watches**
(Shmuly "Rolecks", pacing 9 m of sidewalk up from the bakery / pizza shop, u +20): buy one (−6, once a real day) · report →
+6 once a real day · a cop in sight / the snitch walking up → he's gone for a minute. 📦 **The porch pirate** (an event while
she walks in town: the first after 45 s, then every 80–150 s, ≤ 2 a run): he takes the parcel off a lived-in front door
12–45 m from her (`ctx.homes.homes()` + homelife's `householdAt` / `livedIn` when present) and runs along the sidewalk
(road coords); ✋ TACKLE → ✋ pick it up → ✋ RETURN at that door (`first: true` only while she's carrying it — it never
fights the door's KNOCK) → +6 (≤ 12 a real day) · 📞 Shomrim → a Shomer runs him down and brings it back: +3 · let him go →
the town's group chat · walk off with it (> 70 m, or into a car) = KEPT: +4 (≤ 4 a real day), heat, and the family's
doorbell camera → `law.callIn("PORCH PACKAGE THEFT")`. Every outcome is `emit("crime:porch", { id, fam, phase: back | kept |
gone })` for features/homes (the household remembers) + `features/memory`'s log.

**Her other crimes + street corruption (crime stage 3 — `tags.js`, `herring.js`, `air.js`, `corrupt.js`):** 🏷️ **The
mattress-tag ring** — once a REAL day coming into a town (60 %, not when underworld's heat > 70) the Fixer texts in his own 💬
thread: 4 mattresses lean on a kerb 30–110 m away; ✋ RIP each (*RRRIP*, passers-by gasp) → all four within 120 s = +12
(once a real day) + 3 heat; a cop who SEES a rip: the look, then the chase (MATTRESS TAG REMOVAL). 🐟 **The kiddush heist** —
ON THE SIDEWALK ONLY (a folding table outside the hall / the bakery; nothing inside a shul is ever a crime scene): Reb Getzel
guards the good herring with a view cone (70°, 9 m) and turns every 3.5–6 s to argue with his friend about the kichel; ✋
SWIPE while he's looking away → 22 m away unseen = +8 (once a real day); seen = "GANEF!", he snatches it back (and a cop
who SEES it: the look). 🌬️ **Authentic air** — a stand by the welcome sign / bakery: ✋ SELL → a 30 s shift, a customer
every 6 s, pick a pitch, 2 💰 a jar, ≤ 10 a real day; INSPECTOR PINCHAS (60 %) asks for a permit: 💸 a "donation" (4) → he
didn't see any jars (remembered: next time he just winks) · 📄 "of course I have a permit" (half the time) · 🏃‍♀️ run — not
believed / ran = the shift's over unpaid + his `law.callIn`. 🧾 **Corruption** (`corrupt.js`; city hall proper is
`ci/cityhall`'s — it gets `crime:corrupt` {who, act} and `ctx.crime.corruption.{who(id), list(), evidence}`): MALKA THE METER
MAID walks up to her window after 12 s double-parked → 🧾 the ticket (10, a sink) · 🍬 sweet-talk (35 %, 70 % once she likes
her; fail = 12) · 🍩 a "donation" (5: torn up; 15 % an I.A. STING → `law.arrest(["BRIBING A PUBLIC SERVANT (MINOR)", …])`)
· 📸 "about this photo of you…" (with evidence: hush money). CROOKED MOMENTS (one every 90–160 s while she walks in town,
≤ 3 a run, 18–45 m up her sidewalk, ~18 s): Malka taking an envelope, TUVIA'S TOWING hooking up a legally parked minivan
(the plain traffic truck at the kerb), INSPECTOR PINCHAS pocketing a challah. **Evidence**: a 📸 Camera (photo mode) snap with
it in frame (`photo:snap` + a frustum test, ≤ 34 m) or ✋ → "📸 Snap it" → `SAVE.evidence` (one per character). ✋ → "🤝 for a
cut" = +4 (≤ 8 a real day), heat, 12 % a sting. **🕵️ Internal Affairs** is a 📞 Phone contact (`community.addContact`): hand
it in → +10 (≤ 20 a real day) and that character is REASSIGNED for good (Malka → Officer Pnina: tickets only; no more tows /
inspections) — or sell it back to them (+8, ≤ 8 a real day, +5 heat) and they're NERVOUS for good (Malka never tickets her
again). Every choice: `SAVE.mem[who]` (mood: friendly · bribed · partner · nervous · gone · snitch) + `ctx.memory.remember
("crime", …)`. Tests `crime2.js`, `crime3.js` (+ the chase-frequency measure).

**Everyone in one world (ci/everyone, roadmap 11 — `features/multiplayer`):** out in the open world (driving, or on foot
outside: `def.driving` or `footRun`) the game is **online by default**: `index.js` `ambientTick` joins the relay's EVERYONE
room (`lobby`, the one the Classic 2D game uses; the relay caps a room at 24 → close 4001 → straight on to `lobby2` …
`lobby8`, client-side) — no lobby, no code, no screen. Off: ⚙️ Settings › **🌐 Play online** (`ctx.mp.setOnline(on)`, the
shared save's `mpAutoOff` — the 2D game reads the same flag; the phone's 👯 app has the same switch as one tap: Go solo / Hide
other drivers), **Dina's mode** (any `dina*` state disconnects; reconnects back in the world). **A 🎉 party stays in EVERYONE**
(two sockets: the party's room + EVERYONE) during 🌍 Free Roam, so strangers stay in the world around a group of friends; a
lobby activity (race, dash, cop tag, road trip) hides strangers and hides you from them ("~"). Party members send `d.pt` (a hash of
the code — it tells nobody the code), so a friend is drawn ONCE, as the party's real car with their name, never also as a ghost.
Only a Classic-2D **friend room** is left when a party starts (one group at a time). Unreachable relay → silently solo (the socket backs off
≤ 10 s, no chip, no toast; the riders chip shows only when someone else is there). Anywhere that isn't the open world (indoors,
a scene, Story cutscenes, menus) she's `"~"`: hidden from everyone, nobody drawn, nothing sent but a 1 Hz "hidden" beat.
**Where a 3D rider is** (`d.w = [zone, a, b, h]`, ignored by 2D): zone `""` the highway (a = s, b = d, h = yaw relative to the
road — riders' roads can bend differently), a town id (a, b = metres from that town's `plan.ORIGIN`, h = yaw: the same spot in
everyone's copy of the town), `"~"` hidden. Receivers place 3D riders by `d.w` (no ring aliasing: someone 5 km on isn't "here";
other zone = not drawn) and 2D riders on the highway only (the old ring). In town a 3D rider's 2D fields say "parked by the
exit" (di = the town's exit, x = 470, sp 0). **Strangers vs friends:** in EVERYONE every rider is a **stranger**: labelled
"colour + number" (`strangerLabel`: their skin's colour + a hash of the relay's random id — never a string they sent), drawn as
a translucent ghost, no collision (BONK / slipstream / convoy are friend-room only), and nothing a stranger sends can start
anything on my screen: race invites, tag markers, the parking lot are ignored outside a code room; their emotes (≥ 1.5 s apart),
honks / waves (≥ 0.8 s) and record toasts (≥ 90 s, only when they're on screen) are flood-guarded on the RECEIVING side
(`MP.recv` counts what was dropped); every field is range / format checked (`sk`, `co`, `vk`, numbers). Friends (a 🎉 party or a
Shared Road code room) see each other's curated names. The emote wheel / 1–7 keys / 😀 button appear only when someone is
actually around (alone, the horn is just a horn) and not in a party (the party's wheel is the emote system there). **Cost:** at
most `CAP` = 6 riders are drawn (`ghosts.js`: the nearest in range, a little stickiness so equal distances don't flicker). A
ghost CAR is baked into ONE vertex-coloured mesh (geometry shared per model + paint, its own see-through material; the wheels
don't spin): measured, the full model was ~58 draw calls a ghost (1 ghost 265 → 6 ghosts 555 calls); merged it's ~2 (body +
name sprite), so a full road adds ≤ ~15 calls. A walking ghost is the Person rig (a handful of calls). Anyone else has no model at all, a ghost that drops out of the nearest few is freed after 3 s; nobody around =
no per-player cost (the peer loop is empty). **Nothing personal leaves the device:** the relay gets a curated name, the car's
skin, where Lulu is in the GAME world, and (in a party) a random id — no location, no contacts, no device or account info, no
free text. **👯 Friends** (the title item, id `party`; `party/index.js openHub`): 📤 Invite friends (`hostRoam`: straight into 🌍 Free Roam,
friends who open the link land beside you — from mid-drive the solo run is banked first) · 🔑 Join with a code · 🎮 Party games
(the lobby: races, road trip, dreidel dash, cop tag — what can't be a spot invitation yet) · 🌐 Play online on/off · 🕹️ Classic 2D
friends (the Shared Road screen: a 2D-compatible code room + your rider name) + a line saying who's around. The phone's 👯 app is
there solo too (who's near you, 📤 invite, 🌐 go solo). **Strangers vs friends on screen:** a stranger is a see-through ghost
(~55 %, a soft tint of their paint) with a "Gold 72" label, never solid, never a name; a friend is a solid car / walker with
their curated name, the 👑 / presence chips, emotes with phrases, rides, games. Test: `scripts/tests3d/mpworld.js` (offline
boot · two pages with no code see each other · a hostile stranger · the cap with 14 riders · a rider in town · ⚙️ Play online ·
Dina · the 👯 hub · a party still sees strangers · a friend drawn once, as a friend · the phone's go solo).

**A friends list that lasts (friends, ci/friends, roadmap 19 stage 1 — `features/friends`):** the owner (2026-11-20):
"combine party mode into the main world so friends could just friend each other and teleport and join their friends". No
server change: everything rides the relay's protocol v1 in rooms the CLIENT names. **Identity**: the friend id IS `ctx.player.id()`
(core/player.js — one identity with the property registry); `store.js` (the save's `f.friends`) adds a random 11-character **doorbell** (room `"B" + bell`), made once; the list (≤ 30:
id, curated name, car skin, THEIR doorbell, our shared secret), `blocked` (≤ 50), `join` (`always` / `ask` / `nobody`, default
ask), `hidden` (🙈 appear offline). It rides in the scrapbook's 💾 save code with the rest of `save3d` (restored → the same id,
the same friends, they find her again). **Making a friendship** (`handshake.js`, both must say yes): a channel = the EVERYONE
room (Shared Road state `d.fr`, from 📍 Nearby › a driver), a 🎉 party (snapshot extras `x.fr`, from 👯 › a friend), or a
friend-code room (`"F" + CODE`, open only while 👯 › ➕ Add by code is on screen, or a `?friend=CODE` link). An entry
`{ to, pk, f, c? }`: A's fresh ECDH P-256 public key → B says yes (or had asked A too: mutual) with B's key + B's CARD sealed
with the ECDH secret (HKDF → AES-GCM, `crypto.js`) → A opens it, sends A's card → both keep each other. Strangers watching see
two public keys and two sealed blobs. `f` (the random id, in the clear) lets a BLOCKED player's ask be dropped before anything
is sent. A stranger's ask is never a pop-up: one line on their row in 📍 Nearby ("🤝 wants to be friends"). **Presence + join**
(`bell.js`): while she plays with ≥ 1 friend (not hidden, not Dina's mode, relay allowed) her game sits in her doorbell with
state `{ o: 1 }` — one idle socket. A friend's game KNOCKS (👯 opened, once ~6 s after boot): joins the doorbell for a moment,
state `{ k: { f, c: sealed({ q: "where"|"join", ts, nn, n, sk, w, i, nb? }) } }`; her answer (state `{ o: 1, r: [{ to, c }] }`,
sealed for that friend; ≤ 4 kept) → `{ on, w: "in Midwood · …", i, j, code?, u?, wait?, no? }`. Not a friend / doesn't open /
> 10 min skew / a replayed nonce → no answer. A knock also tells HER the friend is on (presence both ways). **JOIN**: `nobody` → a
friendly no; she's not out in the world (a scene, a menu) → "busy"; `always` → `letIn`: she's in a party already, or her game
hosts a 🌍 Free Roam silently (`ctx.party.hostRoam()`), and answers with the party code + her uid; `ask` → ONE quiet chip
(`#frChip`, "🙋 Kugel Kid #37 wants to join you · 📱 👯") + ✓ / ✗ in 👯, the friend waits ≤ 30 s. The friend then
`ctx.party.join(code, { with: uid })` → lands next to her. **Remove / block** → her doorbell changes (`newBell`): the ex-friend's
knocks find nobody; every friend left is owed the new name (`nb`), handed over inside her next knock at THEIR door. Names: the
12 curated ones + `#NN` from the id (many players share a name), never free text. **Phone:** the 👯 Friends app (outside a
party's Free Roam; inside one, openworld's 👯 has "📇 My friends list" → the same views) — playing now (▶ Join / with you) ·
not playing · ➕ Add by code · 🚪 Who can join me · 🙈 Appear offline · ✏️ remove / block · 🚫 blocked (the 👯 app is their only home: ⚙️ Settings must fit 720p). 👯 is order 23 (after 💬 Messages + 📞 Phone); with it the phone is exactly 9 apps solo (🗞️ Kvetch moved to a pinned row in 💬 Messages) — the grid still goes four across past 9 so a 10th never falls off, but keep it one 3 × 3 screen. **Cost:** nothing without friends; with friends one idle
socket + a burst of ≤ 30 short knocks (3 at a time) when 👯 opens. **`ctx.group`** (`group.js`, stage 2 step 1): "with
friends" as a GROUP you're in — today it IS the party (`active`, `roaming` = in 🌍 Free Roam, `members` [{ uid, name, me,
friend }], `size`, `leave()`, `invite()`, `isFriend(uid)`; event `group:status`). **Read `ctx.group.active` instead of
`ctx.party.active`** when you mean "with friends" — the party can then dissolve into the world (§7 › Friends STAGE 2)
without touching your feature again. **Step 2 (forming / leaving):** joining a friend (▶ Join) or 📤 inviting forms the
group; 👯 › **🚪 Leave the group** is one tap and she carries on ALONE FROM HOME (`ctx.group.leave()` → `ctx.party.leave(false)`
+ `ctx.onegame.home({ via: "group" })`, not the title screen; friends keep playing; the list stays). Pulling into a town none
of her friends are in (≥ 12 s, once per town, ~9 s) shows ONE quiet chip "🚪 Your friends are in Midwood — leave the group?"
(`ctx.group.away`, the friends chip; a tap opens 👯 — never automatic). **Step 4 (the lobby games as invitations, `vote.js`):** in 🌍 Free Roam 👯 › Games
also lists 🏁 Race · 🏡 Road trip · 🕎 Dreidel dash · 🚓 Cop tag "(everyone)": anyone asks (`ctx.group.vote.propose(k)`),
everyone who hasn't answered gets ONE quiet chip ("🏁 Kugel Kid wants a race — 1/3 in · 📱 👯") + a ✅ I'm in row, and the
HOST starts it (`ctx.party.hostStart(k, { fromRoam: 1 })`) only when EVERY member said yes within 40 s (a party shares one
activity — a maybe never pulls anyone in); the asker can ✖ call it off. Votes are reliable host events (`gvp` / `gvy` /
`gvx`), the tally is the host's snapshot extra `x.gv` = [n, key, byUid, yesUids, untilClock]. A voted game's results offer
🔁 again (still from Free Roam) and **🌍 Back to Free Roam** instead of the lobby (`pt_roamback`). **Step 5 (👯 is just "Friends"):** the title's 👯 Friends
hub leads with YOUR FRIENDS — up to 4 "▶ Join Kugel Kid #37 · in Midwood" (it knocks on opening; `hubJoin` → the same JOIN as
the phone) + a line (how many, how many playing, "add or manage them in 📱 👯") — then 📤 Invite friends · 🔑 Join with a
code · 🌐 Play online · 🕹️ Classic 2D. **No lobby to host** (the old `pt_host` "🎮 Party games" is gone: those games are votes
in Free Roam); `ctx.party.hostParty()` still hosts the lobby for tests / old flows. The host's pause item reads "🌍 Everyone
back to Free Roam" during a voted game (hidden while roaming). **Step 3 (missions together, `missions.js` — the API each
feature adopts in its own branch):** `ctx.group.invitable({ id, icon, title, blurb, max, canStart() → "" | why, start({
members, me, by, seed }) })` registers something friends can join (a side job, Ima's list, a road-trip leg, a crime for two,
the bank job). `ctx.group.offer(id)` (👯 › Missions, or the feature's own button) → the others get ONE quiet chip ("🔥 Kugel
Kid: Hot Delivery — join?") + ✅ Join in; whoever opts in within 30 s plays (the offerer can ▶ Go now once one friend is in;
`max` starts it at once), everyone else carries on. The HOST starts it: a broadcast `gms` [n, id, members, seed, by] → `start()` on
every participant's screen at once (only the host's `gms` counts). Offers / opt-ins are reliable host events (`gmp` / `gmy`
/ `gmg` / `gmx`), the open offer is the host's extra `x.gm`. **Rewards are the feature's own rules** (per player as solo, or a
pot split + capped) — never multiplied by the group (golden rule 5). `ctx.group.offerNow()`, `missions()`.
**Registered (2026-11-22, `ci/friends`):** 🚕 / 🔥 / 💰 **side jobs for two** (`features/hustle/together.js`: the offerer
drives the normal job, a friend rides along as navigator (openworld's ride-along); every pay line goes through
`payCrew(job, pay)` — the driver keeps her share, the crew's arrives through a running total in her party extra `x.hc`
[jobKey, totalEach, crew], credited once per navigator; together = the solo pay, same caps) · 📝 **Ima's list together**
(`features/day/together.js`: the OFFERER's list on her screen as solo; helpers see it in a chip (her `x.dl` [key, ids,
doneBits, home]) and whatever they do on it ticks hers (a `dlb` broadcast she checks against her list); home for
dinner → the helpers get Ima's thank-you, no coins; in a group the solo home beat is skipped so nobody leaves) ·
🎲 / 🚗 / 🔔 **the crimes for two** (`features/partners/missions.js`) and 💰 **the bank job** (`features/heist/missions.js`)
as invitations + one shared briefing (who does what, where to meet) — they still happen by doing them, their own
triggers unchanged. The road-trip leg waits (the Story Trip is hidden, roadmap 21); ci/crime's solo crimes stay solo in a
party (a race / duet version isn't cheap: each is built around one player's cops + court). Test: `scripts/tests3d/friendsjobs.js`.
**The list on the server (ci/accounts, `friends/server.js`):** the list, friend REQUESTS and blocks also live on the relay
per account, so a request waits for a player who is offline. 👯 › ➕ Add a friend by name (or 📍 Nearby › a driver with a
name: a server request by ticket, it waits if they drive off) → `/acct/ask`; she sees it next time as a quiet number on
the 👯 app (`badge`, no pop-up) and a "Friend requests" row → Be friends / No thanks (they aren't told) / Block / Report
this name; "Waiting for an answer" rows can be cancelled; 📨 Friend requests from: Everyone / Friends of friends / Nobody.
A friendship made on the server has no doorbell yet: each side seals its card ({ f, n, sk, b } — the handshake's card) with
the secret ECDH(my long-term key, their public key) gives both (my key pair: `S.ek`, a JWK in the save → the 💾 code), and
posts it on the friendship at hello; the other side opens it (`cin`) — the server only holds the sealed note; a changed
doorbell re-posts (`pb`). `store.ready(f)` = has a secret + a doorbell (knocks / ▶ Join skip a friend until then). Every
on-device friend is CLAIMED at hello (migration); when the other side claims back the server has the friendship; a friend
the server once confirmed (`sv`) and then dropped (they removed / blocked her) leaves her list; removals that couldn't
reach the server wait in `S.rm`. Labels: `f.u` (their username from the server) wins over "Kugel Kid #37". Deleting the
online account clears the list. Test: `scripts/tests3d/accountsfriends.js` (B's page closed while A asks, reopened → badge
→ accept; A reopened sees B; the sealed cards cross; A's knock finds B playing; decline; block; remove; who-can-ask;
migration of an on-device friendship with one side updating first).
**Friends among the ghosts (2026-11-22):** the sealed knock + its answer carry `m` = which ghost the sender is in EVERYONE
(her relay connection id there) → `ctx.friends.byMp(id)` → multiplayer's `labelFor` shows 👯 + the friend's name
(`ctx.mp.relabel()` on `friends:presence`); coming online re-knocks (≤ 1 a minute). **Tap a name over a car**
(`ctx.mp.ghostAt(x, y)` / `tagOnScreen(id)` in multiplayer/ghosts.js; a short still tap, not on a button) → 📍 Nearby's
driver page (➕). Test: `scripts/tests3d/friends.js` (add from Nearby, no
pop-up for a stranger · presence, also off the EVERYONE room · nobody / ask me (the chip) → join lands next to her · a
stranger at a leaked doorbell gets nothing · appear offline · add by code + the code dies with its screen · the save code
restores the list · remove (new doorbell) · block).

**Accounts + unique usernames (accounts, ci/accounts — `features/accounts` + `server/accounts.mjs`):** the owner (2026-11-26):
"add real usernames … unique … make the friends thing work even if a player is offline. Like a real multiplayer game."
**One account** = `ctx.player`'s random id + device secret (the pair the property registry already used; the server keeps
the secret's SHA-256 only; the 💾 save code carries both — a new phone is the same account). `hello` (boot, every 5 min,
👯 opened) makes it on first sight and brings back her name + friends + requests + blocks. **The name rules are ONE file,
`features/accounts/rules.js`**, imported by the game (instant feedback) AND by the worker (`server/accounts.mjs` imports it;
wrangler bundles it) — the server's answer counts: 3–16 characters, letters / digits / `_`, starts with a letter, no `__`,
no `_` at the end; unique on `norm()` (lower case, `_` dropped, look-alikes 0/o 1/l/i 3/e 4/a 5/s 7/t 8/b rn/m vv/w folded);
the filter (rude words + slurs + sexual words incl. leet / stretched letters, staff impersonation, contact details: 5+
digits, social apps, "dm me", www) works on folded words — SUB lists match anywhere, short / ambiguous words only as a
whole word, so "Annalise", "Classy", "Something" pass. **The name card** (`ui.js`): the first time she's on the title
with the server up (never in a test unless `&acctname=1`): 3 one-tap ideas (the server's, free), a text box checked as she
types (rules here, "taken" from the server 350 ms after she stops, with ideas), "Don't use your real name", Later (asked
again after 3 days). Offline / server down → she plays at once as "Kugel Kid #37" and is asked on a later title.
⚙️ › 🪪 Your name (only when the server is up or she has a name): change it (once every 30 days; a first pick and a name the
server replaced are free), 👀 Other players' names On / Off, 🗑️ Delete my online account (the server deletes the account,
its friendships, requests, blocks, reports; coins / cars / homes stay; no account is made again until she picks a name).
`ctx.player.label()` is the username once she has one (the curated `mpName` stays untouched — the 2D game and the board
still use it). **Other players' names are never read off the wire:** her game asks the server for a TICKET for each relay
connection (`/acct/ticket` {room, rid} → `pid.exp.HMAC(pid|room|rid|exp)` with a key the server made itself) and sends it
as `d.un` (EVERYONE) / the party extra `x.un`; a receiver asks `/acct/names` [[room, rid, ticket]…] (batched, cached 10 min)
→ the name, or null for a forged / copied / expired ticket — so nobody can appear under someone else's name (and get THEM
reported). multiplayer's `labelFor` order: 👯 friend → the server's name (unless hidden) → the curated name in a code room →
colour + number; party's `nameOf` shows members' names always (people she plays with). **🚩 Report this name** (📍 Nearby ›
a driver with a name): hidden on her screen at once; the server counts DIFFERENT accounts at least a day old (≤ 5 reports a
day each) within 14 days — 3 → the name is replaced by a generated one ("Knish4821"), the old one retired for good, and
the owner is asked to pick again (the card says why). No human in the loop. Old clients: they never send `un` and ignore it
(colour + number / curated names as before). Test: `scripts/tests3d/accounts.js` (+ `node server/test-accounts.mjs`).

**Friends together (together, ci/together):** 👯 the owner (2026-11-20): "in party mode friends should be able to go to
the same house and both be visible to each other. We also need some sort of way for finding friends in the map — need
to be clean." `features/together/`: **`where.js`** — ONE answer to "where is friend X, from here": `locate(uid)` →
`{ kind, x, z, dist, label, zone, inside }` — `"here"` (drawn on my screen: `ctx.party.remoteCar(uid)`), `"door"` (inside
somewhere in my zone: the door they went in by — `d.x.dr`, else `d.x.at` / their parked car), `"track"` (same zone, not drawn:
their last pose) or `"exit"` (another zone: on the highway the exit into their town — their `d.x.ex` — "in Lakewood · take the
Lakewood exit"; in a town the nearest ramp out, "on the highway · head out of town"). Only party members — strangers (the
EVERYONE room's ghosts) are never located, pointed at or on the map. **`pointers.js`** — at most `MAX` = 3 small pills
("➤ Dina 240 m" + a second line when they're inside / elsewhere), the nearest friends + the destination: on the TOP edge
when they're ahead (right above where they really are when they're in the picture), down the LEFT / RIGHT sides when beside
/ behind (never the bottom 30 %: the car, the road, the pedals); a friend drawn on screen within 140 m fades out (their
nametag says it); each pill slides along the edge to keep clear of every HUD bit / touch button (`AVOID`, measured ~3×/s)
and sits out if there's no room. **`map.js`** — the 📱 🗺️ Map in a 🎉 party's 🌍 Free Roam (app id `tgmap`, order 10: the
story map's slot — that one hides in a party): a canvas sized to the phone (labels at real px) — in a town its streets from
above (fixed orientation), the 🛣️ ramps, me (an arrow), each friend as a dot in their colour + name (🏠 when inside, 🚶‍♀️ on
foot); on the highway one straight strip (ahead = up) zoomed to fit the friends + the next exit, the exits, friends in a town
at their exit — plus a row per friend ("in the Friedmans' house · 260 m"), 🧭 the pointers switch. Tap a dot / row → the
**destination**: openworld's beacon (`marks.js`, key `"tg"`, in the friend's colour) over them / their door / the exit,
their pointer stays on (ringed) with the distance; it clears when we meet (≤ 12 m) or they leave. The 👯 app's friend page
"📍 Head to …" sets the same destination. ⚙️ Settings › **🧭 Friend pointers** (`store("together").pointers`, ON by default;
the same switch in the map). Runs in its own rAF, nothing at all outside a party. `ctx.together = { dest(), setDest(uid),
pointersOn(), setPointers(on), locate(uid), locateAll(), debug }`. Wire: `d.x.dr = [x×10, z×10]` (the door I went in by,
while inside — world coords). **Friends in the same building (`rooms.js`):** every walk-in place runs on the interiors
engine, so ONE layer covers them all: while I'm inside a SHARED room in a party, `d.x.in = [room id, instance, x×100, z×100,
facing×100, pose bits]` (~7 Hz: party/net.js sends at the driving rate while `d.x.in` is set; ~40 bytes); every party member
whose `d.x.in` is MY room (same id + instance — a house's `town:house:door`, Lulu's house's owner uid — or, for the roadside
doors, `d.x.dr` within 25 m of mine) is drawn in my room's own scene: their Lulu (`luluPerson` + hair) walking where they walk
(~220 ms behind, eased), sitting / dancing / crouching (pose bits: 1 sit · 2 dance · 4 point · 8 cheer · 16 crouch · 32 talk),
their emotes (`d.x.e` — party/emotes.js allows the wheel in a shared room: `ctx.together.inRoom()`, my pose via
`roomPose`) and a nametag; they come in at the door and walk out through it. **What stays each screen's own:** the room's
people and scripts (the bartender, residents + view cones, Ima), every reward and every bill — a friend can't spend my coins,
get me spotted / arrested or lock me in: on my screen they're a visitor nobody reacts to. Strangers are never inside (only
party members publish / match `d.x.in`; indoors the EVERYONE layer already hides everyone). `SHARED` (rooms.js): `home`
(homes' houses — knock, sneak or 👯 **Join <friend> inside**: homes' door menu offers it when `ctx.together.friendIn("home",
key)`; it goes in as a guest; each player's own stealth / residents), `luluHome` (decor: in 🌍 Free Roam ✋ GO INSIDE works;
the first friend through the door hosts — whoever comes in after sees THAT friend's decorations, `d.x.dc` = the option index
per inside slot + the door, published by everyone inside; no picker, nothing sold, nobody's save touched), `bar`, `school`,
`hospital`, `police`, `beach` (the roadside doors) and `courthouse` + the town's precinct / hospital (features/places reuses the `police` / `hospital` rooms — the door tells a town's from a roadside one). and `bank` (heist's lobby, one per town copy — ci/bankfriends; the solo job still can't be planned with friends). Every
match also checks the two doors are within 80 m (a town can stand at more than one interchange). From OUTSIDE (`outside.js`): a walking friend who goes in is seen taking the
last steps through the door (a stand-in for ~0.6 s, `together:stepin`) instead of blinking out; they come back out at the door.
Cost: one Person rig + one nametag sprite per friend inside; nothing when alone. **In the same car (`car.js` + openworld's
`ride.js`):** on foot by a friend's car (stopped or crawling ≤ 3 m/s, their own car — not a borrowed ride) its PASSENGER
door (their right side) is a ✋ spot "🚗 HOP IN with <name>" — never the driver's door (no carjacking a friend); one hop
(`ctx.foot.hopInto(v, { after })` — foot's hop-in beat, `v.seat: "passenger"`) and `ctx.openworld.ride(uid)` sits her in
their seat (`d.x.rd`; everyone draws her there). ONE passenger a car (`seatOf`): a taken seat reads "💺 SEAT'S TAKEN (Dina)"
and its ✋ is a "shotgun!" line. Her own car comes along on every ride (hidden, following), so it's never lost: ✋ / ROLL /
the 🚪 HOP OUT touch button → slow (< 4 m/s) on her feet at the passenger door with her car parked right there; moving → back
in her own car alongside, rolling at the driver's speed (no heart). Fair: the driver can't keep her in (hop out always works;
a driver who parks / walks off / goes inside lets her out at the kerb); she can't steer, brake or honk for them (her honk +
emotes are a wave from the seat); she's never ticketed or chased for the driver's driving (law holds while she rides, a
`speedTrap` is handled). Riding = 🌍 Free Roam only, not while she's in a party game (a game that starts with her in it lets
her out); through a town exit she warps along; friends only — strangers' ghosts are never a car.

**A world that feels alive (life, `features/life`, ci/life — the owner, away for Shabbos 2026-11-21: "add more features to make it more
immersive"):** small ambient details you NOTICE rather than use — no menus, no modes, no toasts (a line Lulu says is her own speech
bubble on foot, `ctx.foot.say`, and only on Normal / Chatty chatter). Four parts, each one file, ticked from `hook("hud")` (+ `update`
when the state has no HUD) once per game step, only while the world is on screen in a run (`footRun` / a driving state; not the title,
not a set / interior (`ctx.view`), not Dina's mode):
- 👣 **Footsteps** (`steps.js`): a step on every half-turn of her walk cycle (core/people.js swings the legs at 2.2 + 2.4·speed rad/s), the
  sound picked by what's under her (every 0.22 s): a car's hood / roof (`ctx.foot.ground` > 0.85) → metal, a bench → wood, a puddle → a
  splash, in town `ctx.town.hideSpot` (walk → concrete, yard / mall → grass, else asphalt), on the highway `ctx.foot.bounds.zone` (verge →
  gravel, grass, mud); snow → crunch; a wet road (`ctx.atmos.wet` > 0.35) → splashy.
- 💧 **Puddles** (`puddles.js`): sites from the town's plan (`ctx.town.plan`: every street, every 7 m, each side, a hash → ~10 % a gutter
  puddle, ~5 % one in the lane, ~6 % a sag in the sidewalk; never within 13 m of a crossing) — the same for everyone, every visit. The
  water level fills over ~20 s of rain and drains over ~3–6 min after (it outlasts atmos' wet road). ONE InstancedMesh (≤ 44 drawn, the
  nearest within 75 m, re-picked every 0.5 s or 6 m), a small shader: an irregular rim, the sky's (fog's) colour, rain rings while it
  rains, the scene fog. Splashes go into `ctx.car.fx` (no new particles): a step (5 drops), a jump landing in one (`foot:land` → 18 + a
  SPLOSH + now and then a line), the car through one at > 5.5 m/s (30 drops off both sides; a townsperson within 5.5 m — `ctx.town.people()`
  — gets a `ctx.banter.bubble`, ≤ 1 every 25 s).
- 🍂 **Wind** (`wind.js`, tune `WIND`): a gust every 26–60 s (16–40 s in the fall) in town or on foot (not the desert): its sound upwind,
  20-odd leaves (autumn colours Sep 20 – Dec 12, blossom petals Mar 25 – May 15, a few dry ones otherwise, none in snow / heavy rain)
  blowing across, now and then (in town, dry) a paper flyer tumbling straight past her — `FLYERS`: 8 community notices on one canvas atlas
  ("LOST CAT: KUGEL", "UMBRELLA GEMACH — 14 umbrellas, all black"…); walking into one → she reads it out (once per notice per run, ≤ 1 / 30 s).
  In the fall leaves drift down around her in town, and LEAF PILES (the same site walk: ~12 % per 7 m at the sidewalk's kerb edge, not on a
  boulevard) burst when she walks / drives through (a crunch, 18–30 leaves, stat `leafPiles`; flat for the rest of the visit). Three
  InstancedMeshes: leaves (≤ 120, typed arrays), piles (≤ 36, a lumpy vertex-coloured dome), flyers (≤ 3, an atlas cell per instance).
- 🏘️ **The neighbourhood** (`ambience.js`): every 4.5–10 s (9–16 s driving through town) a positional one-shot 10–45 m off — in town a
  songbird, a dog (and ~45 % of the time the one next door answers), a screen door, a basketball being dribbled, someone hammering (much more
  before Sukkos — `ctx.seasons.is("sukkosPrep")` — and never on Shabbos / Yom Tov), wind chimes when it's gusty; at night dogs, doors, an owl
  (fall / winter) and a crickets bed (2 looping emitters, warm months only); rain hushes the birds. On the highway on foot: birds in the
  fields, a far dog, an owl.
**Sound**: every kind is synthesized once (`sounds.js`, 24 kHz, core `spatial.define`, ids `life*`, prio 1 — anything of the game's own
wins a voice), played at pooled `{x, y, z}` points. ⚙️ **🐦 Street sounds** (Settings, order 64, listed only in a run — ⏸ → ⚙️ — because the title's Settings card is at its 720p limit; saved in the 3D save's `life` store)
turns all of it off; the visuals have no switch (they're quiet). **Seasons** follow the device's date (`?lifeSeason=autumn|spring|summer|winter`
to preview). **Perf**: ≤ 4 draw calls (only while there's something to draw), nothing allocated per frame (typed arrays, pooled points,
in-place sorts); the `life` test measures it on vs off in Lakewood in the rain in the fall. Test: `scripts/tests3d/life.js`.

**Round 2 (ci/life2, 2026-11-21):** four more files, the same rules (ticked from index.js, local + cosmetic, hashed sites, no toasts).
- 🐦 **Pigeons** (`pigeons.js`, tune `PIG`): rows of 3–6 on ~20 % of the houses' roofs (`PERCH` per model: the duplex's ridge, the
  townhouses' parapet, the Midwood house's flat top, the rowhouses' cornice — model frame, through `ctx.town.homes` like homes' `DOORS`), gangs
  of 3–7 pecking on the pavement (~3.5 % per 7 m of a street side) and always one outside the bakery / the pizza shop (`ctx.town.spot`). Only the
  flocks within 75 m are simulated + drawn (≤ 72 birds, ONE InstancedMesh, the wing flap in the vertex shader like atmos' birds). A `honk`
  within 35 m, running (> 4.2 m/s) within 3.6 m of a gang, the car > 8 m/s within 8 m (> 15 m/s within 13 m) → they burst up (a flutter,
  event `life:pigeons` {x, z, why, kind, n}), circle the block, and glide back to the same perch once she's ≥ 14 m off (roofs: 10 m). A coo
  from a flock within 18 m every 7–15 s (not at night / in the rain).
- 💨 **Smoke + steam** (`puffs.js`, tune `PUFF`): ONE InstancedMesh of camera-facing soft puffs (a small shader, premultiplied blending so
  the alarm's glows are additive in the same draw; typed arrays, ≤ 220 + 16). Chimney smoke on a COLD day (`coldNow()`: snow, winter, or
  Nov–Mar by the device's date; `?lifeCold=1|0`) from ~50 % of the chimneys (75 % at night) — `CHIMNEY` tops per model (the duplex, the
  Midwood house), the nearest 10 within 150 m; the wind's gusts lean it over. Midwood's MANHOLES: covers in the lanes (~4.5 % per 7 m, not
  at a crossing; a second InstancedMesh, "CON ED" on a canvas), 70 % of them steaming (thicker when cold), the nearest 5; her car swirls
  the cloud as it punches through; a hiss loop at the nearest one within 12 m. The bakery's / pizza shop's OVEN VENT on the roof (`VENTS`, from
  `ctx.town.spot`). Walking into the steam / past a vent → Lulu's line (once a visit each).
- 🚨 **Car alarms** (`alarm.js`, tune `ALARM`): town/parked.js already shoves a bumped car and plays 4 whoops; its `town:parkedHit` now also
  carries `obj` + `alarm` (the tiny additive hook). Then: the hazards blink amber at the model's four corners (its bounding box, measured
  once per model) for 5.2 s, the alarm's tail plays positionally ON the car (WHOOP ×6 … BEEP ×3, kind `lifeAlarm`), and at 1.8 s the
  nearest townsperson (`ctx.town.people()`, ≤ 28 m) or a window of the nearest house yells (a bubble).
- 👣 **Friends' footsteps** (`friends.js`): the 4 nearest friends walking (`ctx.party.members()` + `remoteCar(uid)`: `foot`, `anim` 0 / 3,
  `vx/vz`) within 26 m step on the same rhythm as hers with the surface under THEM (town `hideSpot`, a puddle, snow, a car roof by `footY`).
- 🙋 **The crowd answers a honk** (features/homes/crowd.js `crowdHonk`, a small additive change): a kid waves back ("HONK AGAIN!"), a grown-up
  jumps + points and yells (`PED.honk`) or "Nu?!" (`PED.honkNu`); `homes:honked` carries `kid`.
- **Lines**: every round-2 line (Lulu's, a neighbour's) goes through ONE budget in common.js (`lineFree` / `luluLine` / `npcLine`: ≥ 40 s apart,
  chatter Quiet = none) so the `calm` per-minute count doesn't move. **Perf**: ≤ 3 more draw calls (puffs, manholes — Midwood only — and
  pigeons, each only while it has something to draw); the `life2` test measures Midwood on vs off. Test: `scripts/tests3d/life2.js`
  (friends' footsteps through `debug.fakeParty`: a real party needs two pages + the relay).

**Round 3 (ci/life3, 2026-11-21):** three more files + two tiny additive hooks, the same rules.
- 🪟 **Windows at dusk** (`windows.js`, tune `WIN`): the town engine warms every house window at once (one shared material —
  right far away, a switch up close). Over the houses within 110 m life lays its own pane on each FRONT window (measured once per
  model from its own geometry: front-facing "Window" faces merged into rectangles — like seasons' `frontWindows`): until a room
  lights it's deep-blue glass covering the town's glow; each house has its own night level between 0.1 and 0.62 (atmos' `night`)
  and its rooms come on a beat apart (84 % ever light), so the street lights up a few windows at a time; ~1 house in 9 has a
  ground-floor TV (a flickering blue); after a while at full night ~⅓ of the rooms go dark (bedtime); at dawn the rest switch
  off as the night level falls. Houses the town built `dark` (nobody home) are left alone. ONE InstancedMesh (≤ 360 panes, nearest
  houses first; matrices written only when the set changes — every 0.5 s / 8 m — per frame one vec4 each), premultiplied blending
  (a dark pane covers, a lit one adds), faded out over its last 30 m into the town's own glow.
- 🌬️ **Cold air** (`breath.js`, tune `BREATH`): on a cold day (`coldNow()`) when it's dark / snowing / winter: Lulu's breath
  (2–3 small puffs in front of her face every 2.5–3.4 s, every 1.1–1.5 s running and for 6 s after a run), the named townsfolk
  within 22 m (`ctx.town.people()`) and friends walking near her (`remoteCar`); on any cold day in town the car's tailpipe steams while
  it idles / crawls (< 9 m/s, thinning with speed); 🌫️ at DAWN in town (atmos' clock > 0.86 or < 0.06, not snow / heavy rain;
  thicker when the ground is wet) up to 26 low mist banks 5–34 m around her drift with the wind and burn off — her car stirs them.
  All are puffs.js' instances (no new draw call); puffs.js now also ticks outside town (her breath on foot / a hotwired shoulder car's alarm).
  `?lifeMist=1|0` previews. One "Brrr!" line a run (the shared line budget).
- 🚨 **A fumbled hotwire** (alarm.js): foot's `hotwireFail` now emits `foot:hotwireFail` {obj, key, x, z, town} (the tiny hook) →
  the same hazards + alarm tail as a bump, starting at once (no shove whoops before it), and in town the owner / a window yells
  about THAT ("Young lady! That is NOT your car!"). Works on the highway's shoulder cars too (no yell there: nobody around).
- 📻 **The radio looks out of the window** (`radio.js`): rain / snow / fog starting, the rain stopping, the sunset (clock 0.47) and
  nightfall (0.66) are offered for 70 s as a TOPIC; the next time a talking station (SIMCHA / SMOOTH / KVETCH / DOVID DOV FM)
  picks a line, its DJ talks about that instead (per-station lines; LULU FM has no DJ). Through `ctx.hustle.radio.topical(fn)`
  (the tiny hook in hustle/radio.js: fn(station) → a line | null, asked after the live news) — the radio's own ticker and timing.
- ⛈️ **After the thunder** (`storm.js`): atmos' clap now emits `atmos:thunder` {near} (the tiny hook in weather.js); in town a dog
  barks 0.4–1.1 s later (two after a close one, the next door may answer — ambience.js' `happen`), a close clap (near > 0.55) makes
  the lit panes flicker for 0.5 s (windows.js `blip`: the power nearly went) and Lulu on foot jumps ("EEK! …I meant to do that.",
  once a visit, the shared line budget).
**Perf**: +1 draw call (the panes, only in town at dusk / night); see the `life3` test (Lakewood, night, cold, on foot).
Test: `scripts/tests3d/life3.js`.

**Banks, heists & robberies (heist):** CARTOON ONLY (the owner's call; 12+): the robbers' "weapons" are a banana, a water
pistol, a baguette and a confetti blaster (`heist_props` Prop_* nodes), nobody is ever shot, nobody is hurt beyond the
usual knock-down / heart rules, the cops bring a stun net and a spike strip. **The bank is town DATA**: `uses.bank` in
`towns/lakewood.js` (Main St, beside the Simcha Palace) and `towns/midwood.js` (Avenue J, re-tinted limestone + a green roof)
places `heist_bank` (merged by kit.js like any building: ~0 extra draw calls) with its sign in the town's atlas; `T.spots.bank`
is its door. On foot ✋ ENTER (a `ctx.foot.addSpot`) opens the interiors engine's `bank` (`defineInterior` from
`interiors/engine.js`; the town `allowState("interior")` — but only the town's own buildings keep her in town — the bank and features/homes' houses (`home`; `TOWN_INTERIORS` in `bank.js`) —
any other interior there still leaves it quietly). **Robberies** (`robbery.js`, gated `ctx.enabled("heist")`, Cruise only, never in a chase / a job / the
tutorial): in a town the getaway car is a town driver started at the door (`ctx.town.addDriver(kind, { at, cruise })`, an additive
option), on the highway it's a traffic car fleeing in its lanes at 0.8 × her top with a cosmetic cruiser (`ctx.law.lightBar` + an
`A.spatial` siren) behind — in a town that cruiser joins at `ctx.town.copSpawn` and chases the getaway car round the corners with `ctx.town.copRoute(c, u, target)` (the optional target: anything with `{x, z, s}`, default Lulu); `data.pit` lets features/moves PIT it (a one-word addition to its `isCop`), `onCrash → false` makes rams
free; `ctx.law.hold()` every frame while it plays (helping is never a crime). The scheduler also runs while she WALKS round a
town (the `hud` hook; at most `TUNE.robbery.footMax` a run): it picks a door 8–30 m from her and the robber fights his money
bag in the doorway for `footFumble` s before he lugs it to the car — the window for the ✋ TACKLE (an `addSpot` with `first`). **The job** (`job.js`): state `heistJob` (⏭, in game
time; `ctx.town.allowState`) → `ctx.law.startChase("BANK HEIST (WITH A BANANA)", { heat })`; results come from `cop:chase` {result}
(escaped / disguise / left / safe → paid; busted → wait for `law:arrest` or a talked-out pull-over) and `law:arrest` (law's arrest now leaves a town BEFORE making its cruiser — the town's quiet exit used to clear it); a clean escape
`ctx.law.addWarrant`s the charge. law's `data.js` carries the charge's weight, cop / Lulu lines, the lawyer's argument and
`CHARGE_COURT` (prosecutor + judge lines, read by `rules.js courtLineFor` in court.js). **Snatchers** (`snatch.js`): the moped is a
plain Object3D (never a traffic car — on foot that would knock her flat), the take is `min(45, 12 % of the wallet)` and catching
him `wallet.add`s exactly that back (+ a bonus); the car thief swaps the `ai` of foot's parked-car stub (found via
`ctx.foot.parkedCar`) for a lurching learner that brakes when she's within 5 m, and every ending leaves her car parked and
drivable. **Gear** (`gear.js`): hooks only (`controls` / `update`), reads law's chasing cruisers from the traffic (`data.law.mode`),
uses streets' `puncture()` for the flat when it's there and `ctx.feel.damage.hit()` for a dent. One objective chip
(`.heist-chip`, sub-lines `.hud-secondary`) + one pooled beacon cone; no other HUD. **In a 🎉 party** every gate is
`common.js live(what)`: only `PARTY_OK` (`gear`, `snatch` — which also covers the car thief) runs, on a Road Trip / Free Roam
run with no party game on (`partyFree()`); robberies and the job stay solo (the parity table). Tests: `scripts/tests3d/heist.js`,
`partyheist.js` (the party side).

**Rest areas (exits):** a service plaza off the highway every ~7 km in Cruise and Story (`REST` in `exits/index.js`), planned
≥ 2 km ahead and slid clear of the town's interchanges, pull-in places, big reserved stretches and (Story) the family stops.
No district and no fade: everything is in the highway's road coords (u = s − rest.s, d) — `layout.js` is the whole plaza as
DATA (decel lane, off-ramp, the lot, on-ramp, accel lane; props, colliders, people, ✋ spots, the two drive-up bays) — and
`build.js` draws it in `chunk:build` (ONE asphalt mesh, stall lines, gores, the props merged with town's `kit.js` Merger,
every sign face from one atlas: ~8–10 draw calls a chunk). Its lanes (decel lane, ramps, gores, the drive aisle, the accel
lane) are `paved` 3 — nothing stands on them — the rest of the lot 2 and its lawn / verges 1, so the car drives
the lot at road speed and foot walks it without the wilderness (the reserve also clears foot's grass / mud / fence visuals).
Drive-up bays go through `ctx.places` (`exits_pump`: nitro for coins; `exits_garage`: Mendel takes the dents out via
`ctx.feel.damage.repair("mechanic")`, and a flat via `ctx.streets.repairTyres()`); on foot one `ctx.foot.addSpot` spot picks the
nearest thing (talk to travellers, the food court `choose()` menu, the restroom gag and the picnic sit in `ctx.foot.script`, the
vending machine, the souvenir stand's deal of the day written to the shared save, Kugel the dog). The cast is pooled npcMan /
npcWoman / npcKid (+ law's K9 as the dog) spawned only within ~250 m, casting no shadow and hidden past 40 m from the camera; parked cars are merged, shadowless. While she's in the lot
`G.noPullOver` is set (stop = get out & walk; the roadside pull-over is retired anyway). The 🅿️ Parking Challenge's
course stands in the truck lot beside Mendel's garage (features/parking/course.js — see **The Parking Challenge on a lot**). HUD: the decel-lane cue (a prompt) and the next-exit
chip (`.exits-chip.hud-secondary` in the "center" slot, only ≤ 1 mi ahead — interchanges and rest areas). Gated by
`ctx.enabled("exits")`; in a 🎉 party the rest areas are seeded (see the parity table) and the visit is personal (presence ⛽).
`scripts/tests3d/exits.js` covers passing / both branches / the rest area; `partyplus.js` the party side.

**The airport (airport): ✈️ JFK, stage 1 — the exit and the kerb** (roadmap 12; plan + the owner's decisions:
`3d/docs/airport-plan.md`). **ON by default** since the interchange planner was split per town (`ci/exits2`): it is planned FIRST from
fixed data and the towns' exits keep out of its zones (`town/exit.js` › `clearOfPlaces`); `?airport=0` turns it off, `?test` runs
need `&enable=airport`, or `ctx.airport.debug.placeAt(s)`. `features/airport/`:
`layout.js` (DATA) · `plan.js` (where + world geometry) · `build.js` (drawing) · `planes.js` · `life.js` (the kerb vehicles,
the doors, the fence joke) · `lines.js` (all text; parody airlines only — Kugel Air, El Oy, Shmear Jet, Nu? Air).
**Engine choice — a small engine of its own** that borrows from both existing ones: the INTERCHANGE is the town exit's
shape in highway coords (u = s − exit, d — taper, a parallel decel lane with EXIT ONLY, the `exits_gantry`, a painted gore +
cushion, a RAMP 30 advisory, an off-ramp that eases away to d 30 at u 60, guardrails; from u 600 the on-ramp back, a merge
gore, the accel lane to u 840; advance signs ✈ JFK AIRPORT 1 MI / ½ MI / LAST EXIT with an EXIT 12 tab) and, like a
REST AREA, everything is in the driving scene on `paved` ground with its colliders in the highway's chunks — no district, no
fade. But the airport itself is RIGID: its own frame (`frameAt(E)`: origin on the highway's centre line at u = `UA` 330, f
along the road's heading there, r to its right — like an attached town's `PL.ROT`), because an airport isn't a ribbon that
bends with the road (a straight runway, a rectangular terminal). Not the town engine: an airport isn't a street grid
(no blocks, no drivers, no TownRoad), and a district swap would cost a cut / a ~1000-step build for a car park. Two cubic
Béziers (world space, built from both ends' exact poses) join the ramps' ends to the loop's legs, so the joints are exact
on any bend. **Layout (f, r):** the fenced LANDSIDE f ±175, r 55 → 245: a one-way loop (up the west leg at f −150, the kerb
road at r 190 — three lanes, the terminal on her right: DEPARTURES then ARRIVALS — round to the east leg, down and out), the
lot inside the loop (seeded parked cars, a pay booth), the kerb sidewalk r 195 → 203, Terminal 4½ (`airport_facade`, the
OUTSIDE — stage 2's hall is `airport_terminal`) r 203 → 238; the AIRSIDE behind the runway fence: the apron + three gates (jet
bridges, parked jets in liveries), the tower, the taxiway, the runway (r 330 → 375, f ±450). **Placement** (`plan.js`) is a
pure function of FIXED data (the constant highway, the world's places, the journey's stops + the coast — Cruise layout), so it
is the same metre every run and on every friend's screen: from `AIR.first` (5.9 km) it slides on in 50 m steps until FIT (no
highway sample inside its box `BOX` from 3 km back to 3.6 km on, and every landside / airside point finds its nearest highway
point with the road's own ±120 m local search — `car.s` / foot's s stay smooth in there) and clear of places, the journey's
stops (±1.1 km) + the coast's ocean, the towns' planned interchanges (± `townGap` 1.5 km: their attached towns) and the rest
areas. The search runs a few candidates a frame (`searchSteps`). `plan(E)` reserves the ramps (d 7.2 → 70), the airport
(±640 m round E + UA, d 7.2 → 3000) and a thin strip (d 9 → 22, signs → accel lane + 1.5 km) that the towns' and rest areas'
SOLO planners see as busy (`reservedRight` / `clearAt`), and adds the three highway signs. **Ground:** a `paved` predicate —
3 on every lane (the highway-side lanes in (u, d), the roads as world polylines in a hash grid), 2 on the whole landside (the
car drives it like road; a lawn too — no world fence push at |d| > 70). **Foot:** `ctx.foot.bounds.free` (a tiny registry in
foot's `bounds.js`: predicates (x, z) → no world fence there) holds the landside, so walking 200 m off the highway isn't pulled
back; its own fence (posts every 1.4 m, `kind: "fence"`) keeps her in. **Colliders** ride in the highway chunk of their
nearest s (`G.byChunk`, added on `chunk:build`); the kerb vehicles' circles are live objects in the kerb's chunk. **World:**
`world.keepBehind` (a tiny core addition) keeps 900 m of highway chunks behind her while she's round the airport (the ramps
stay drawn from the kerb). **Build** (`build.js`): its own group, ~120 small steps (~3 ms a frame from 2.6 km out; dropped
3.2 km away; the sign font + emoji are warmed at boot, the atlas is drawn a cell a step and kept for the next build): ~40k
triangles, 40 meshes — every surface one mesh (ramps, the loop, the lot, stall lines, walks, gores, the
kerb paint, apron, taxiway, runway), the chain-link fence one alpha-tested mesh, every static model + guardrails + fence posts
merged by the town's `kit.js` Merger (160 m clusters), every face of text one quad mesh from one atlas. **Planes** (`planes.js`):
3 planes, each livery's model BAKED into one vertex-coloured geometry (`bake.js`) and instanced — packed, so only the live ones are
drawn (~5 draw calls for the sky; the gear its own set that folds to nothing in the air), a pure function of
one clock (the party clock with friends): every 32 s a departure (roll, lift off past the terminal, a climbing left turn back
over the landside and the highway) or an arrival (in from over the highway, line up, touch down, roll out); a soft shadow quad
under each along the sun; a jet roar on `A.spatial` (kind `airportJet`). **Life** (`life.js`): 5 taxis + 2 shuttle buses
(baked + instanced: one draw call a kind) drive their own closed loop (the right-hand lane all round, through the lot's aisle), the taxis queue on the
ARRIVALS kerb, the shuttles stop at DEPARTURES and pull out to the middle lane; they stop for her (car or foot) and her parked
car. The terminal doors: ✋ "🚪 TERMINAL 4½" — opening soon; once stage 2's hall is in, `ctx.airport.terminal.warm()` within
22 m and `enter({ door })`. **The runway fence joke**: pressed against the airside fence (~0.7 s on foot, or nosing the car into
it) → Officer Segal of airport security rolls up on his Segway (sometimes a parked jet honks first), two lines, Lulu answers, he
rolls off — speech bubbles only, 4 variants in turn (`SEGAL`), at most 2 a visit 25 s apart (after that, one line of Lulu's).
Cartoon only: nothing about real security procedures. **Budget** (test `airport`, 1280×720, the kerb's busiest view; AGENTS §7 › Airport): ≤ 240 draw calls / ≤ 120k triangles
on MEDIUM and LOW (measured 209 / 118.9k), the build's slices p95 ≤ 10 ms / worst ≤ 60 ms on a CI runner (3.9 / 30.5).
**HUD:** the decel-lane / ramp cue (a prompt) and ONE banner on the first
arrival of a visit (`prio 1`) — no toasts. `G.noPullOver` in the landside (stop = get out). **Party:** OFF in a 🎉 party for now
(the towns' party planner doesn't know about it — `ctx.airport.debug.party(true)` turns it on); the placement is already fixed
data, presence "✈️ at JFK" and the planes on the party clock are wired. `ctx.airport` { on, planned, ready, inside, spans(),
debug }; events `airport:enter` / `airport:leave` {s}, `airport:door` {f, in?}, `airport:fence` {variant}, `airport:built`
{ms, steps, worst}; stats `airportVisits`, `airportDoors`, `airportFenceTries`. Models: `3d/blender/assets_airport.py`
(`airport_facade`, `_tower`, `_jetbridge`, `_plane`, `_taxi`, `_shuttle`, `_booth`, `_segway`, `_guard`, `_windsock`,
`_suitcase`; it reuses the exits' gantry / cushion / advisory / guide / lamp and the town's LOD cars). Test:
`scripts/tests3d/airport.js`. The advance signs + the gantry: `3d/docs/airport-signs.jpg` (1 MI · ½ MI · LAST EXIT · the gantry).
**Airport › Polish (`ci/airport-polish`, 2026-11-21).** **The chase** (`chase.js`): highway cruisers that follow her off the exit
drive the airport's ROAD NET — six world polylines meeting at four junctions: the highway's right lane → the decel lane → A (the
gore) · A → the highway → B (the merge) · B → the accel lane → on · A → the off-ramp → the road in → up the west leg → WA (the lot's
aisle) · WA → the kerb road past the terminal → EA · WA → the aisle → EA · EA → down the east leg → the road out → the on-ramp → B.
A route = the cruiser's nearest point on the net → the shorter way round the junctions (Dijkstra on 6 nodes) → her nearest point →
straight to her (she may be in the lot); while they SEARCH it goes to where they last saw her, on a pull-over to its stop behind her
car. Law asks through two small hooks in `features/law/cops.js`: `hook("copRoute", (c, u, chase) → { gap, aim(la, out) } | null)`
(used for `chase` / `pull` units outside a town; null while both are on the highway's own lanes) and `hook("copSight", (ax, az, bx,
bz) → true | false | undefined)` (the terminal + the tower block the view; the open landside doesn't — the highway's "roadside on a
bend" test would have blinded them past 11 m off the road). Any other place off the highway with roads of its own can use them.
**Kerb collisions** (`life.js` `V.collide`, an actor): her car meets the taxis + shuttles with traffic.js's own collision —
circles, a push apart by mass (taxi 1.2, shuttle 5), the impulse — so a hit over 6.5 m/s costs a heart like traffic; past `KERB_HIT
.knock` (taxi 3.5 m/s, shuttle 9) the vehicle slides + spins (damped like a traffic wreck), its driver yells (`L.KERB`), then eases
back onto its place in the loop (1.6 s; the ones behind queue, they also stop for a cruiser). The vehicles' circles in the kerb chunk
are now foot's only (`off` while she drives). **LOW** (`build.js` `setLow`): what the LOW tier leaves out — two of the three parked
jets (+ their livery faces), every other parked car, 8 of the 20 lamps, the bottom fence's trees, the windsock, the facade's trim /
door mats / hedges (`splitTemplate`) — is merged LAST into the same clusters, so LOW is one draw range per merged mesh (no extra draw
call on MEDIUM) and the atlas mesh's last quads; their colliders switch off with them (`notLow`). ~9.3k triangles left out at the
kerb (AGENTS §7 › Airport for the numbers; the test counts the shadow pass too now). Also: the roads in / out share the ramps' mesh
(2 draw calls fewer). **Airport security at the kerb** (`security.js`, the owner's decision 10): a WANTED Lulu (law's stars — a
chase, a fugitive stretch, warrants she hasn't changed her look since) in the landside → Officer Segal's Segway (12.5 m/s — "it has a
WARRANTY") + Rex roll out of the nearest door: at the wheel he rides at her window and holds her car to `SEC.carCap` 4.5 m/s
(a "controls" hook: throttle off, a touch of brake, no nitro); mid-chase he keeps the cops' eyes on her (`ctx.law.spot`), with
warrants only he radios it in (`ctx.law.callIn`); on foot Rex has her shoelace (`ctx.foot.bounds.slow` × 0.5) and after 3.5 s a
foot cop comes out of the doors (`ctx.foot.startChase`). He gives up at the landside's edge ("Next time, ma'am!"), when she's no
longer wanted or after 32 s (the battery). Once a visit, solo only, speech bubbles only; events `airport:security` {how: kerb |
radio | gone}, `airport:bump` {kind, impact}; stats `airportSecurity`, `airportKerbBumps`. **Switch-on model** (`plan.js`
`PLANNING` / `zones()`): the airport FITs only at a few stretches of the constant road (8.8–8.9 km, 22.4–29 km…), so after
`ci/exits2` it is planned FIRST from fixed data and the towns + rest areas keep out of `ctx.airport.zones(s0, s1)` — the steps:
`3d/docs/airport-plan.md` › Sync log, AGENTS §7 › Airport. `ON_BY_DEFAULT` in `index.js` is the switch. **The chase cam's walls**:
`ctx.airport.camClip(tgt, dx, dy, dz, D)` — Terminal 4½ and the tower as boxes in the airport frame (a pad of 0.3 m), asked by
foot's `cam.carClip` (the same slot a town's blocks use; null away from the airport) — a chase round the kerb no longer parks the
camera inside the terminal (ci/qaweekend's flat-colour frame; `qaweekend-air` checks it). The doors' boards are a plain door sign.
**Airport › Kerb (`ci/airport-kerb`, 2026-11-21) — the polish's two leftovers.** **A bust at the kerb** stops right where she
is: law's pull-over (`features/law/bust.js` `autoLulu`) used to steer for the highway's shoulder (`pullDAt` → d 7.9) — at the
kerb, 190 m from it, she crept a few metres and turned ~30° toward the highway while braking. Law now asks one more small additive
hook first, `hook("pullOverSpot", car → { h } | null)` (`bust.js` `pullOverSpot()`, exported): an answer = brake right there,
facing `h`, no roll-on; the roadside shot (`roadsideShot`, also the arrest's) is taken along `h` too. Null = law's own shoulder,
unchanged everywhere else. The airport answers (`chase.js` `pullOverSpot`) off the highway's own lanes on its right side (the
ramps, the roads in / out, the loop, the kerb road, the lot): `h` = the road net's direction at her nearest point, the way she's
already facing (off the net, in the stalls: her own heading); the cruiser's `copRoute` already brings it to its stop 7.2 m behind
her. Any other place off the highway with roads of its own can answer it. **A cruiser's shove** can't put her car on the kerb
sidewalk (`chase.js` `KERB_EDGE`, no geometry): law's `crash` event with a law car (`e.car.data.law`) arms the kerb edge for
`hold` 2.5 s (only if she's on the road then — she may still drive up on the sidewalk herself); while armed, every frame after
traffic her car's outer edge toward Terminal 4½ (its two circles + radius) is held at the kerb line `WALK.r0` + `give` 0.25 m along
the terminal's kerb (f `TERM` ± 22), her velocity into it is dropped (`bounce` 0.2), and a cruiser pressing on her is pushed back
off her car (nosing into her: it stops, then eases on at law's own pace) — so it can't drive through her either; still pressing =
still armed. Debug `ctx.airport.debug.pullSpots()` / `kerbHolds()` / `KERB_EDGE`; test `airport` steps "kerb bust" + "kerb shove"
(a lean + a ram; before the fix: 29.5° off at the window, the lean put her car at r 200.6 — against the terminal).
**Airport › Terminal (airport, stage 2 of roadmap 12 — `features/airport/terminal*.js`, `ci/airport-terminal`):** ✈️ ONE
walk-in hall at JFK ("TERMINAL 4½") on the interiors engine (`defineInterior("terminal")`, model `airport_terminal` +
`airport_terminal_props` from `assets_airport_terminal.py`). The plan + the owner's decisions: `3d/docs/airport-plan.md`; stage 1
(`ci/airport`: the interchange, the kerb loop, the terminal's OUTSIDE + its doors) owns `features/airport/index.js` and calls
`ctx.airport.terminal.enter({ door, exit })` from the doors' ✋ spot (warm it within ~22 m: `warm()` → the step in is a soft cut).
**The hall, left (landside) → right (airside)**, x ±28 m: the terminal doors (Spot_door) · check-in for the parody airlines
(Kugel Air, El Oy, Shmear Jet — `AIRLINES` in `terminal-data.js`: an agent each, a hello pool + three questions) + Bubbe Faigy's
overweight bag on the Kugel Air scale (wear her sweaters: Lulu puffs up · "lighten" a kugel · sit on it: the scale goes UP) · the
departures board (a canvas: `FLIGHTS` + `STATUSES`, a row split-flaps every ~9 s, redrawn only while it flaps) · ARRIVALS (the
frosted doors are movers `ArrDoor_L/R`; every ~18 s or on ✋ 1–2 people walk out with suitcases, a greeter cheers + hugs;
greeters hold signs — four quads on one canvas) + an empty VIP red carpet (`vip()` — stage 3's Dovid Dov comes through here)
· SECURITY: the snake (one collider, `Col_snake`), the BEEP-O-MATIC 3000 arch (`ScanLamp_red/green`), the tray belt, the glass
divider at x = 12 and a ONE-WAY exit lane (`Col_exitGate` is on only while she's landside). ✋ the line → ⏳ wait (an auto-walk
through the snake with captions) or 🏃 duck under the ropes (crouched; the line's outrage bubbles; Officer Segal Segways to the
arch → 😇 back of the line, or 🥺 plead → the scanner adds CHUTZPAH DETECTED); the scanner: keys (a tray rides the belt) → her
kugel (Ima packed it; Rex the sniffer dog only ever finds kugel — once a run, `rt.used.kugel`; after that a bobby pin) → clear →
airside. Cartoon only: nothing about real screening. · THE FOOD COURT: Shmuley's Sky-High Deli (knish 8, pastrami 14, a pickle 3)
and the H2-OY! water bar (water 12): a snack is a fixed price and +1 ❤️, nothing sold when her hearts are full, at most
`TUNE.FOOD_CAP` (2) hearts a run (`rt.used.healed` — survives the door), nothing ever pays a coin. · THE GATE (GATE 18, "CHAI!"):
three rows of seats — ✋ 💺 sit (pose sit, pinned in the seat by `luluPost`, the camera turns to the window; the stick stands her up;
friends see her sitting), the gate desk ("BOARDING SOON — NOT YOU"), the man asleep across four seats, the window onto the apron:
a parked Kugel Air plane at the jet bridge, planes (`Prop_Plane`, livery per airline) taking off down the runway every ~18 s, the
runway fence, the tower. **The crowd** (`terminal-crowd.js`): ~55 people on homes' instanced rigs (`Rig` per body: man / woman /
kid / cop — ~5 draw calls each for all of them; the far ones homes' `LodCrowd` figure; the nearest `TUNE.FULL[tier]` full) —
desk agents, the check-in lines, the snake (it shuffles forward… then reconsiders), walkers rolling suitcases (one instanced mesh,
a colour per instance), the family with ten kids doing laps of the food court looking for gate 18, the sleeper; Rex is law's K9
on a rig of its own. People are records, not Object3Ds (an empty anchor each for speech bubbles); Lulu is pushed out of the
standing / walking ones. The hall casts no shadows; the sun's shadow box follows her. The PA is an in-world bubble (no toasts).
**The law:** walked in WANTED (`ctx.law.wanted > 0`, not low-key): Officer Segal + Rex follow her and slow her (`TUNE.SLOW` while
Rex is at her heels — "Rex has your shoelace"), after `TUNE.COPS_AT` s two real cops walk in through the doors; caught → the room
melts back out (soft) and law's arrest plays on the kerb (`ctx.law.arrest([warrants…, "RUNNING FROM A SEGWAY"], { onFoot })`).
Leave first and they lose her. In a 🎉 party only the guard + Rex play (the law stays on its own screen). Not enterable mid-chase.
**Friends:** a SHARED room (`together/rooms.js` › `SHARED.terminal = "jfk"`): friends in a party (🌍 Free Roam) see each other walk,
sit and emote inside; presence "✈️ in the JFK terminal" (the interior's name + emoji); strangers are never inside. Each screen's
crowd, gags, purchases and law stay its own. **Service:** `ctx.airport.terminal = { enter({ door, exit }), canEnter(), warm(),
ready(), inside, vip(), addBuilder(fn) (stage 3: runs at the end of every build with the room), tune, debug }`;
`ctx.airport.debug.enterTerminal()` walks in from wherever she's standing (tests; until stage 1's doors). Events `airport:terminal`
{in, wanted}, `airport:checkin`, `airport:bag`, `airport:security` {how}, `airport:scanned` {kugel, chutzpah}, `airport:snack`,
`airport:sit`, `airport:arrival`, `airport:takeoff`, `airport:cops`, `airport:caught`; stats `airportTerminalVisits`,
`airportScans`, `airportLineCuts`, `airportSnacks`, `airportSits`, `airportBagGags`… **Budget** (1280×720, measured — see
AGENTS.md §7): measured MEDIUM 71–90 draw calls, 109–118k triangles · LOW 72–90, 84–89k; the test's limits: MEDIUM ≤ 110 calls (≤ 130 worst
frame), ≤ 140k triangles · LOW ≤ 110 / 130, ≤ 110k. Test:
`scripts/tests3d/airport-terminal.js` (`AIRPORT_TERMINAL_PART=solo|perf|friends`; the QA watchdog), and
`PERF3D_SCENES=foot,terminal node scripts/perf3d.js`. **Stage 3 hooks:** `addBuilder`, the VIP carpet (`vip()`), the arrivals door
(`debug.arrive`), the empty Shmear Jet line, `airport:*` events.

**Airport › Stage 3 — things to do (`features/airport/stage3*.js`, `ci/airport-stage3`; the owner's decision 8):** three capped
things at JFK, in their own files, hooked in from outside (no edits to stage 1's or stage 2's files): `stage3.js` (the service, the
day ledger, the hall's hint, wiring) · `stage3-taxi.js` · `stage3-hall.js` (a stage-2 builder: `ctx.airport.terminal.addBuilder`) ·
`stage3-data.js` (every line, `PAY`, `TUNE`). **🚕 The JFK taxi run** — a hustle side job (`ctx.hustle.register("jfk_taxi", …)`, so
the 💼 Jobs app lists it and the pass card / log are hustle's): a traveller (Mrs. Gittel Blabberman the yenta → the Simcha Palace,
Yanky the bochur back from yeshiva in Israel → Midwood's pizza shop, Gary from Ohio looking for "the Brooklyn Bridge" → Brooklyn
College, Mr. Shapiro back from Florida → the lake) waits at the ARRIVALS kerb; pull up slow → they hop into roadevents' passenger
seat; the beacon sits on the next interchange that offers their town (`ctx.town.exits`), then on the landmark in town
(`ctx.town.spot(key)`, with fallbacks); the wrong town = a ↩️ line and no beacon; stop by the landmark → pass. A FIXED fare
(`PAY.taxi` 40), `PAY.taxiPerDay` (3) paid runs a real day — past that it isn't offered at all. **Only from the airport:** `taxiWhy()`
needs stage 1 (`ctx.airport.on` + `planned` + `inside`, the kerb from `ctx.airport.kerb.pickup()` if stage 1 adds it, else
`ctx.airport.debug.world(24, 193.5)` = the ARRIVALS kerb lane) — until `ci/airport` lands it is never offered. Also: JFK dispatch
texts once a visit when she drives into the landside, and a traveller at the terminal's arrivals door can be BOOKED ("Taxi? Are you
a taxi?") — the run starts when she's back behind the wheel at the airport. **🧳 The lost suitcase** — Mrs. Perl Shpilkes by
ARRIVALS: her pink suitcase (a pom-pom, FRAGILE: KUGEL) is on Bubbe's scale / under a tired man's feet by the board / by the plant at
the doors, or Mr. Pilkes is doing laps of the landside with it (his is identical; hers has a name tag). Carry it back (`rt.luluHold`)
→ `PAY.bag` (15) once a real day, a rugelach after that. **🎤 Dovid Dov on tour** (canon: Lulu's brother — the family knows, strangers
don't): ~40 % of solo visits (`TUNE.dovidChance`; never in a party, never while she's wanted, never at random in `?test`) the PA
announces a VIP, stage 2's arrivals doors open, he walks behind the rail and down the red carpet (`vip()`), six fans gather in an
arc, Officer Segal Segways round by the exit lane and stands guard ("…who IS he?"); ✋ → he whispers, then 🤳 a selfie (a flash +
confetti) / ✍️ an autograph on Ima's kugel / 🤫 "strangers"; once a real day `PAY.dovid` (10) "gas money"; the stat `airportDovid` →
the scrapbook badge 🎤 Front Row (`ctx.meta.addBadge`). He leaves through the hall after ~70 s either way. Everyone is a
terminal-crowd record (no new draw calls; the suitcase is one cloned prop): measured with him + the fans in view, the hall stays
inside its MEDIUM budget. **The hint:** inside the hall `ctx.G.hint` reads "✈️ Explore the terminal · ✋ talk / look · leave" instead
of foot's "Find a car to “borrow”" (put back on the way out). **Service:** `ctx.airport.stage3 = { today(), ledger(), PAY, TUNE,
taxi: { id, why(), offered(), book(id), booked, pickup() }, debug: { date(v), fakeAirport({x, z} | null), dovidNext(v), bagNext(v),
hall(), SV, HALL } }`. Events `airport:taxi` {phase: offer · book · start · pickup · wrong · drop}, `airport:bag` {phase: ask · found ·
return, variant, pay}, `airport:dovid` {phase: arrive · here · meet · leave, choice, pay}; stats `airportTaxiRuns`,
`airportBagsReturned`, `airportDovid`. Test: `scripts/tests3d/airport-stage3.js` (`AIRPORT_STAGE3_PART=hall|taxi`; the taxi part
pretends the airport with `fakeAirport`).

**The underworld (underworld):** corrupt people + bad guys, cartoon only (`features/underworld/`). Everything random is gated by
`live(what)` = `ctx.enabled("underworld")` && (no party, or — in a 🎉 party's Road Trip / Free Roam — `what` is the pickpocket) && Settings › 😈 Bad guys ≠ Off; **every knob is `SPAWN` in `data.js`**
(rate × Settings Rare 0.5 · Normal 1 · Often 2; `firstAfter` 60 s; `gap` 150–260 s between bad guys; `roll`; the crooked cop's
`warn` / `bust` / `sting` / `price` / `cool`; Velvel's `every` / `fix` / `paint` / `hot` / `buy` / `report`; the Fixer's `every` / `maxHeat`)
and `TUNE` (heat add / cool / what it does to the law; `coinCap` 30; per-bad-guy speeds and distances). One actor (`foot: true`) ticks it
all. The scheduler (`why()`) never spawns in the first minute of a run, during a chase / call-in, in a job, on a call, in a town (cars)
or while slow; one encounter at a time; a chase on HER makes any bad guy scram. **Hooks elsewhere (small, additive):** law
`bust.js` (the pull-over asks `bustOffer` before the tactics), `service.js` (`trap`, `clearWarning`, `addCharge` / `chargeEvent`),
`court.js` (a charge's event always plays); hustle `register` / `listed` (+ phone/apps.js lists them); community `addReason` / `callOut`
(+ the 📞 app shows an org off-town when another feature has a reason); party's OFF set. **Crooked cop:** `law:warning` → a parked
`cop` traffic car on the shoulder 230 m ahead (lit via `ctx.law.lightBar`, `uw_krupnik` with the `uw_kugelcan`), a glowing pad;
stopping on it → the state **`underworldDeal`** (car eased to a stop, a roadside camera, core dialog `say` / `choose`; `D.after(fn)`
runs on the road a frame later — the sting's `startChase(…, {heat: 2})`). Pay → `ctx.law.clearWarning()`; sting → the 2★ chase; drive
past / refuse → nothing. Pull-over (only after a ≤ 2★ chase, `UW.lastHeat`): pay → released; sting → `law.arrest([BRIBING AN OFFICER
(KUGEL FUND), reason])` (its arrest lines, the lawyer's line and the courtroom's Exhibit A kugel come from `law.addCharge`).
**Velvel:** the `uw_shack` 720 m ahead (`world.reserve`d, round colliders) + a pad → the deal (fix: `feel.damage.repair` + `heal` +
`streets.repairTyres`; paint: `streets.paint.repaint` + `law.changeLook("paint")`; sell a borrowed ride: `foot.drive({own: true})`,
maybe a `law.callIn`). Hot parts: a cop that sees her 1.2 s → `law.notice(…, {witness: true})`. **The Fixer:** `ctx.hustle.register`
of `uw_package` / `uw_wheelman` (a 2★ `startChase`, lose it, drop off) / `uw_tail` (the gang car's AI, grey); offers = a text +
`ctx.hustle.offer(id, "marker")`. **Heat** (`heat.js`, 3D save): + per job / bribe / sting / sale, − 0.2 per s of play and 2 per
real minute away; it scales `ctx.law.tune` (`sight` up to +35 %, `susDecay` −50 %, `warrantSee` −40 %) from a snapshot of the base
values, restored exactly at 0 or when not live. **Bad-guy cars** (`badguys.js`): `underworld_rager` / `underworld_gangcar` traffic kinds
with a road-coords `ai` (highway only), `keep`, `data.local`, `onCrash` → no heart under impact 9.5 (a shove is slapstick); a seated
`npcMan` / `uw_goon`; removed out of sight. Any law unit / trap `copSees` him 0.5 s → our own cruiser pulls him onto the shoulder.
Shomrim (📞) = a `community_shomrim` car (falls back to `cop`) closing at 1.25 × her top speed. **Pickpocket** (`pickpocket.js`):
a person in the scene walking up, `takeCoins` (≤ `coinCap`), runs along `world.road` (works on a town street too), the ✋ TACKLE
`ctx.foot.addSpot`, `refund` (+4); escaped coins → `SAVE.owed`, paid back with a text later. **Rivals:** ≤ 6 in the 3D save
(name, met / busted / escaped), ~55 % come back, `ctx.memory.remember("underworld", …)` + a `ctx.memory.text`. 📒 Scrapbook ›
🕶️ Underworld (heat, rivals, numbers). Models: `3d/blender/assets_underworld.py` (10, `underworld_*`). Test: `scripts/tests3d/underworld.js`.

**I'm stuck (unstuck):** 🆘 the owner (2026-11-20): "a respawn button that respawns the player to the closest for sure
normal point … in case someone ever gets stuck to a glitch in the map." `features/unstuck/index.js`. **The button:** ❚❚ ›
🆘 I'm stuck (pause order 8, main group) → a card ("Lulu goes … — the nearest spot that's surely clear") → 🆘 Yes / 🚗
Bring my car here too (on foot, only when her parked car is itself stuck) / ↩ Back. Offered in `playing`, `footRun`,
`interior`; in any other WORLD state only once it has run `HUNG` (12) s or a fade is stuck; never in Dina's mode, a
party lobby, the shop / parking challenge / photo mode, or while an ad holds the game. **Surely normal** (`normal()`):
a spot made ON a lane / a sidewalk / a shoulder / a lot (the candidates: her nearest street — or stretch of highway /
ramp / rest-area lot — ±64 m along it, nearest first) that is finite and clear of the world's colliders (a car keeps a
body's width from anything tall, 1.1 m from a rail, 1.3 m from a parked car's ring; on foot she may stand beside a low
thing), outside every town block (`PL.OCCLUDERS`) and lake (`def.water`), and not on a car. **Where:** the car → upright
on the nearest lane heading its way (a town: her side of the nearest street; the highway: our side, or the oncoming
side if she faces that way on it; a ramp: the ramp, heading down it; a lot: a free bit of the lot), velocity zero, the
non-`keep` cars within 40 m in that lane removed (as `rollingRecover`); on foot → the nearest clear sidewalk (town) /
shoulder or lot (highway), facing along it, the free camera behind her; her parked car stays where it is unless it's
the stuck thing; in a room (the interiors engine — bars, lobbies, homes, Lulu's house, the bank) → the room's
`Spot_lulu` / door spot (a pending `walkTo` resolves), and a room that isn't ready / is leaving / is busy → its
`finishLeave()` (out of the front door); a passenger → `ctx.openworld.hopOut`; a hung scene → `skipNow()` (then, if
she still isn't somewhere normal, the quiet rescue), or — not skippable and run for 30 s, never a law / party / Dina /
heist scene — `setState("playing")` + the car on the nearest lane. Every move is a `ctx.dissolve` soft cut + a 2.5 s
soft shield (`G.invT` / `invSoft`); stuck fades (`#townFade #footWash #intFade #cameosFade #lawFade #softCut`) are
cleared (class-driven ones keep no inline opacity). **No cheating:** nothing touches the law (wanted, a chase), a job,
coins or hearts; 10 s between presses (the card says "one moment"); refused in a party game / race / the parking
challenge (`refusal()`); an arrest / a knock-out / the climb-out / a hot-wire on foot is never cut short ("one moment").
**Automatic** (every 0.5 s of game time via app.js's `tick` hook — an add and a compare per frame): `playing` (not
riding) / `footRun` walking: a NaN position → at once; below the ground (y < −1.5) → 1 s; inside a town block / a lake /
a big collider (r ≥ 1 car, ≥ 0.6 foot, not low things) while still (car < 1 m/s, her < 0.6) → 2 s; off the world (a
town: > 90 m car / 120 m foot from every street; the highway: |d| > 90 / 240 on unpaved ground) → 1 s. One quiet line
("🆘 back on the road"). In `?test` it runs only with `&enable=…,unstuck` (not `all`: other tests teleport her about).
**Always reachable:** `ctx.pauseHatch` opens Esc / Options / ❚❚ for a non-pausable world state that has run 12 s (or
whose fade is stuck 4 s) — never Dina's / a party's / the shop / parking / photo mode (they use ○ / Esc as "back"); a
spare touch ❚❚ (`#unstuckPause`, top-right) shows there and in a pausable state whose HUD is hidden for that long;
while paused `body.unstuck-paused #screen` sits above every fade (law's / cameos' fades have z-index 30–35).
Tests: `scripts/tests3d/unstuck.js` (each stuck case on the highway, a ramp, a rest area, both towns, a room, the home
start; a chase / a job untouched; the cooldown; hung scenes; every fade; 3,000-frame monkey runs with no false rescue),
`unstuck2.js` (two pages: a passenger, friends see the auto-rescue, refused in a party game).
