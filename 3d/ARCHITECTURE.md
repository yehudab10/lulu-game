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
  js/spatial.js                             positional 3D audio (A.spatial): pooled panner voices, listener on the camera
  js/features/feel/                         sound kinds + passing whooshes + muffled music on foot; damage on Lulu's car
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
| `wreck` | (info) → `true` claims | out of hearts: arrest, ER, Lulu on foot… (first claimer wins; return true only when you take over) |
| `runStart` | (G, opts) | add run fields, set `G.goText`, pick biomes |
| `hud` | (dt) | every frame while the driving HUD shows |
| `titleCamera` | (dt, camera) → true | own the title-screen camera |

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
Built-in: `title`, `intro` (3-2-1), `playing`, `wrecked`, `gameover`, plus journey's
`arriving` / `arrivedScreen`. To drive the car from your state call
`updateDriving(dt, P, controlsOn, ctlOverride)` from `core/driving.js`.

### Menus
`addMenuItem("title" | "pause" | "settings" | "titleInfo" | <your own>, { id, order, label, visible, action, group, sub, short })`.
**The home screen is grouped** (keep it uncluttered — don't add info lines or buttons to the home card):
- title `group`: `"play"` (a home tile; the first by order is the pink hero tile — Story Trip), `"garage"`,
  `"book"` (scrapbook) or `"more"` (each a soft tile that opens a tabbed sub-menu; L1/R1 switch tabs, ○ backs out).
  Without `group`, the order decides: < 70 play · 70–79 garage · ≥ 80 more. More than 6 play tiles spill into
  "🎲 More to play". `sub` = a subtitle line (string or fn); `short` = the name in its group tile's summary.
- Title order guide: 10 story · 20 cruise · 30 shop · 32 car · 35 Dina · 40 parking challenge · 50 scrapbook ·
  55 quests · 57 💼 side jobs (book) · 60 🎉 party (Shared Road lives inside its hub) · 65 📸 photo · 72 distracted · 80 settings · 86 controls · 99 2D.
- `titleInfo` items: `bar: true` (a chip in the home top bar — bar orders: 4 🕯️ erev-Shabbos chip (Fridays) · 5 holiday · 6 streak), `for: "<item id>"` (appended to that item's
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
A `runStart` hook may set `G.introState = "<state>"` to replace the 3-2-1 countdown with its own departure
state (world's driveway pull-out); `startRun({ quick: true })` asks for the plain countdown.
**Paved ground off the highway** — `paved` (an array) / `pavedAt(s, d)`: features push predicates `(s, d) → 0 | 1 | 2` in
highway road coords (ignored in a district). 2 = asphalt: the car drives it like road (no grass drag, no shoulder rumble —
town's exit ramps, a rest area's lot); 1 = walkable grounds (a lawn: grass for the car, but foot's bounds skip the tall grass /
mud / fence there, zone `"grounds"`).

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
  behaviour checks `ctx.town && ctx.town.active`.
* `world.addSign({s, d, lines:[...], bg, fg, w, h})` before that chunk is built (in `boot` or ≥700 m ahead).
* `world.biomeAt = s => ({ ...world.defaultBiome(), trees: {...}, density, houses, houseModel, walls, roofs, poles, coins, ground: "#hex" })`.
* `registerScenery("palm", { model, collide, scale: [a, b], tint: [matNames], colors: {Mat: "#hex"} })` then use it in a biome's trees mix.
* `world.setSky({top, mid, bottom, fog, fogNear, fogFar})`; `ctx.lights.hemi/sun` for day/night.
* `world.config.speedTraps` (bool) — the built-in parked-cop speed traps.
* Exports for set pieces: `ribbon(road, s0, s1, d0, d1, y, vScale)`, `signTexture(lines, bg, fg, w, h)`,
  `worldMaterials()` (road, shoulder, drive, pole, metal, coin…), `canvasTex`, `mulberry32`, `HALF_ROAD`, `SHOULDER`, `LANE`, `CHUNK`.

## Traffic (`js/traffic.js`)
`registerKind(name, { len, halfW, circles, r, mass, model, paint | colors })`.
`ctx.traffic.add(kind, s, d, dir(+1 ours / −1 oncoming), speed, { ai(dt, car, traffic), data, onRemove, noNearMiss, immune, keep })`
→ car `{obj, s, d, dTarget, speed, dir, x, z, h, hit, data, free}`. A custom `ai` drives it
(change s/d/speed, or set `car.free = true` and drive x/z/h in world space). Set `car.onCrash = e => false`
to stop a crash with it costing a heart. `traffic.config = { enabled, ours, oncoming, mix, honkMoves }`.
`traffic.remove(car)`, `traffic.clear()`, `traffic.cars`. `traffic.road` is a getter for `world.road` (a district's streets while one is active).

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
`input.stick2d = true` makes the touch stick 2-D (on foot / Dina). `rumble(strong, weak, ms)` (controller: Gamepad API;
touch play: `setHapticSink(fn)` — features/native routes it to the iPhone's Taptic engine — else `navigator.vibrate`).

## UI (`js/hud.js`, `js/core/dialog.js`)
`H.showScreen(html, buttons, {onBack, onTab, focus, wide})` → card (all `<button>`/`.nav` are
controller-focusable), `H.hideScreen()`, `H.menuInput(P)` (call from your update while a screen is open),
`H.refreshFocus()` after re-rendering part of a card, `H.setFocus(idOrEl)`, `H.toast(text, "gold"|"pink"|"red"|"big", {key, merge})`,
`H.banner(html, ms, {prio, key})`, `H.hudSlot("left"|"center"|"right"|"bottom")`, `H.prompt(html)`, `H.flash()`.
**Keep pop-ups off the road:** toasts are a feed on the right edge; while driving/walking
(`playing`, `footRun`, `arriving` → `body.in-play`) a banner is a compact card at the top of the
"center" slot. Don't add your own big centred text over the road in those states — use these.
**The notification manager** (game time): a repeated toast becomes one with a ×N count, signed numbers
sum (+5 💰 ×3 → "+15 💰"), at most 3 toasts show (extras wait, stale ones drop); banners show one at a time
from a priority queue (`prio`; same `key` replaces), and nothing new pops up while a dialogue line or menu is
open. **HUD style** (Settings → Full / Clean, `save3d.settings.hudMode`): Clean hides the score and anything
with class `hud-secondary` — mark your optional HUD chips with it. **Lulu's chatter** (Chatty / Normal /
Quiet, `save3d.settings.chatter`) is respected by banter.
Dialogue: `await say(name, text, {emoji, color})`, `await choose(name, text, [opts])` → index,
`await script([[who, text], …], {emoji: {who: "👵"}})`. While a line is open, input goes to the dialogue.

## Sets (`js/core/sets.js`)
`const set = makeSet({ light: "day"|"indoor"|"night"|"dusk", sky, fog, ground })` → `{scene, camera, add, own, show, hide, dispose}`.
`makeRoom(set, {w, d, h, floor, walls})`, `textPlane(lines, {w, h, bg, fg})`. In your state:
`enter → set.show()`, `exit → set.hide()` (or dispose), update the set camera yourself.
**An OUTDOOR set that follows a drive must match the world's sky:** after `set.show()` call `ctx.atmos && ctx.atmos.dress(set, { lamps: [[x, y, z]…] })` (see ctx.atmos) — never a fixed daytime preset at night or sunshine in a storm.

## Audio (`js/audio.js`)
`sfxCoin sfxCloseCall sfxBoost sfxCrash sfxBump sfxHorn(on) sfxSiren sfxFanfare sfxSelect sfxMove`,
`setMusic(url)` (`musicSrc()` = what's playing; the 📻 radio uses it to tell the game's pick from its own) — reuse the 2D tracks: `../lulu.mp3 ../luludriving.mp3 ../dina.mp3 ../avigail.mp3
../parking.mp3 ../salon.mp3 ../wedding.mp3 ../prison.mp3 ../court.mp3 ../walking.mp3 ../er1.mp3 ../er2.mp3
../story-relax.mp3 ../story-electric.mp3 ../story-beach.mp3`. Synthesize new SFX with WebAudio if needed
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
| world | **shared constants**, personal pull-in | Gas 'n' Go / the Lookout / driveways are fixed spots (`where("party")`); a Road Trip has no driveways from Bubbe's on; the visit beat is yours |
| hustle | **seeded** markers, personal jobs | `hustle/party.js`: ☎️ payphones + 📋 boards from the road plan; taking one, the riders, props, pay are yours; my 📱 still rings at random (nobody else hears it); 💼 Jobs app on the party highway; the getaway only when the party has the law on. "Follow that car" is a `partyLocal` car |
| community | **seeded** in a 🌍 Free Roam town, personal help | `community/party.js`: org cruisers on openworld's block loops (pure f(seed, loop, clock)); roadside scenes in 50 s windows of the party clock (kind, kerb, call-in time seeded); the Bais Yaakov line on the party clock; 📞 Call + help visits are yours (local responders); Shomrim chases only with the law on in the party (local cars; a loop cruiser never leaves its loop). Off: highway sightings (the party's highway traffic is the seeded conveyor) |
| memory | **personal** | grudges, notoriety, the log, texts + recognition lines record / play in a party; grudge cars + WANTED billboards wait for a solo run (a local car in shared traffic / a roadside reservation on one screen) |
| banter | **personal** | Lulu's lines (+ a party opener); NPC reactions skip party cars (they're `ai`); billboards are the party's (seeded); banter's random sidewalk walkers stay out (roadevents' are seeded) |
| meta | **personal** | stats, quests, badges, streak record in a party; a party run is banked (`endRun("party")` once → run:end); no first-drive tutorial with friends |
| shabbos | **off** | the Rush owns the run's goal + sky (`G.mode = "shabbos"`, `G.atmosClock` = the deadline); in a party both belong to the party (the activity, `ctx.party.atmosClock`), so one player's rush would split the sky. A party-wide 🕯️ rush would be its own lobby activity (`addActivity`: a seeded deadline on the party clock, the shops from the road plan, a group candle-lighting at Bubbe's) — not built yet (its shops / timer / sky / ending are all solo-shaped: not a cheap port) |
| journey | **off** (Road Trip borrows Bubbe's) | Story mode is one player's chapters, stop scenes, calls and G.mode; the 🏡 Road Trip already drives to the journey's stop 0 (Bubbe's house, built in every mode) with a group arrival |
| dina | **off** | Dina's mode is its own world from the title (bus, house, minigames), not the road |
| foot 🚶 | **personal** | Get out & walk on a 🏡 Road Trip / 🌍 Free Roam (not mid-Race / Dash / Cop Tag: `G.arrived`). Her pose is published as HER (`d.p` = her position / velocity / facing, `d.x.f` = [anim, look]) → friends draw a walking Lulu (hair, jumpsuit / disguise, roll · slide · vault · knocked flat · busk · wave); her parked car `d.x.pc`. Peds, animals, parked cars to hotwire, the booth, Avigail, the foot cop are her personal props; no cars spawn behind her (the shared traffic is the party's). Shared traffic + friends' cars knock her flat (no heart); two walkers step aside. |
| interiors 🏠 | **personal** | The bar / school / hospital / precinct / beach are hers alone; friends get presence "🍺 in The Thirsty Scholar" + her nametag over the door (`d.x.at`) and her parked car; the world keeps running. |
| law 🚓 | **personal** | Her own traps / patrols / chases (cops are local cars, never crash a shared car — a cruiser that hits one bounces off). Friends see up to 3 lit cruisers on her tail as puppets (`d.x.cp`) + her stars on the nametag (`d.x.ws`). Arrest / jail / court are personal (presence 🚔 / ⚖️). Stands down in a Race / Dash / Cop Tag and during any 🌍 game she plays (🚓 Cops & Robbers has its own cop): `law/index.js partyStandDown`. |
| streets 🔑 | **on**: seeded props + booths · personal heat · carjack via a **claim** | Carjack like solo: she steps in front of / flags down / rams a SHARED car → it's **claimed** (pulls over the same way on every screen, see above) → she jacks it (or 🚕 hops in, if she flagged it) → `ctx.party.claimTraffic(car)`: gone for everyone (`"j"` + `d.x.jk`, never re-added), friends see her ride's model (`d.x.v`); a passing car can still be jacked on the move. Town loop minivans + the school bus (Free Roam) the same way. Hotwiring a parked car on the shoulder: foot's personal parked cars. Props: per chunk from `ctx.party.rng("streets:props:" + k)` (identical on every screen); smashing is personal, a FRIEND's car ploughing through one smashes it on my screen too (cosmetic, no bill). 🎨 Paint & Pray booths: from the road plan (`road.claim("streets", {paint})`, planned ~1.4 km ahead), the drive-through personal (presence 🎨). Roadblocks: personal (`partyLocal` cruisers on the SHOULDERS + spikes across her lanes — never parked in a lane the shared traffic drives). 🔧 Shmuel's calls: personal (the wanted car is a `partyLocal` car riding a gap in the conveyor at lane speed; step in front of it to stop it). Sports coupes join the shared traffic. Her empty car coasting into a shared car only spins itself. |
| rides 🚓🚑🍦 | **on**: fleet **seeded** · personal jobs | The taxi / ambulance / ice-cream truck / bus fleet rides the SHARED traffic (`ctx.party.addTrafficKind`: the same ambulance at the same place for everyone) — claim / jack it like any shared car. Handling, horn, trick per ride; siren / air-horn yields only move local cars (shared ones have an `ai`); the 🚨 pull-over CLAIMS the shared car ahead (it pulls over on every screen; a car she already claimed counts too); dispatch, patients, ice-cream kids, bus riders are her personal props. |
| feel (damage) | personal | Hearts are never lost in a party, so there are no dents to show (nothing published). |
| moves 🏁 | personal | On already (skill, not chance); roll / slide / vault show on her walker. |
| openworld 🌍 | shared | (see Open world) |
| native (ads) | **off** | `ads` is in party's OFF set and `ads.js` also checks `ctx.party.active`: no interstitial, no 📺 rewarded button with friends (haptics stay — they're personal) |
| exits 🅿️ | **seeded** rest areas · personal visit | Planned from fixed data + the party seed only (never the reserved road): a 🏡 Road Trip gets one on the way to Bubbe's (s = 2350 + seeded 0–400, slid clear of the places), 🌍 Free Roam one after ~every other interchange (`h01("exits:rest", E) < 0.55` → at E + 1600, snug between that exit's ramp and the next one's mile sign); the road plan keeps its big things off them (plan.js `busyAt`). Pulling in, walking the lot, the pumps / Mendel's bays, food, souvenirs: personal; friends see presence "⛽ at the <name>". The town's interchanges are planned from s = 0 from fixed data only (the places' constant spots), so every friend's ramps land on the same metre. No town exits on a Road Trip (towns are Free Roam's: a zone change needs the activity's frame / show / pose hooks, which only 🌍 Free Roam has) |
| town 🏘️ | **on** in 🌍 Free Roam towns | Seeded block-loop traffic (openworld), seeded townsfolk / geese / e-bike starts; stop signs, speed bumps, one-way streets, gossip, the 🗞️ Kvetch app, geese charging HER, the e-bikes' rides: personal. Loop minivans / the school bus can be claimed + jacked (above). |
| heist 🏦 | **off** | robberies, snatchers, car thieves, the cops' nets / spikes and Lulu's own heist are one player's random set pieces (a getaway car in the shared traffic, a bank job's chase). The bank building is town data, so it stands in a 🌍 Free Roam town, but its door stays shut. A party version would need: robberies from the road plan (`ctx.party.road.claim("heist", …)` + a seeded getaway route — a `partyLocal` car only the foiler drives, or a seeded loop car like openworld's), the foil credited to whoever stops it first (a host-validated event, like openworld's `owb`), and a co-op heist as its own lobby activity (`addActivity`: one driver, friends as lookouts, the chase personal to the driver) |

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
| `ctx.foot` | foot | `start(reason, opts)` — Lulu climbs out and walks (reasons: `carWreck`, `crashReprieve`, `droveOff`, `copWalk`, `jailbreak`, `parked`, `bailout`, `discharged` (out of the ER with no car of hers); `opts.noIntro` when your scene already showed her getting out — she starts on her feet, no second climb-out; `at {x,z}` where she stands, `stubAi(dt, car)` to drive the car she left, `drivable`) · `active` · `script({update(dt,P,F) → true while running, camera?(dt), abort?(why)})` hands Lulu to your animation on foot · `drive(v)` puts her behind the wheel of `{vtype, key, colors, x, z, h, handling?}` (a borrowed-vehicle shell; `handling` = car stats while she drives it) · `shellObj` · `say(obj, text, sec)` · `addSpot(spot)` (`spot.short` = the ✋ button's label; `spot.first` = urgent, it wins the ✋ button over anything else in reach) · `chasing` (a cop on foot is after her) · `dropChase()` (he gives up) · `startChase({x, z})`  · `ownCar` — her OWN car this run: `"ok"` / `"parked"` / `"wrecked"` / `"gone"` (impounded, left behind for a borrowed ride; survives the walk ending — law and the ER read it to decide whether she gets a car back) · `dropRide()` (the borrowed ride is gone) · `facing` (her yaw on foot) · `sprayTargets()` (peds / critters / the foot cop for the garage pepper spray) · for a 🎉 party: `vel` (her walking velocity) · `animCode` / `lookCode` (what friends' walker does / wears) · `parkedCar` (`{x, z, h, key, paint, wrecked}` the car she left) · `bump({h, speed, who})` (a friend's car knocked her flat — no heart in a party) |
| `ctx.foot.bounds` | foot | (`features/foot/bounds.js`) the soft world edges + nudges: `EDGE` (terrain bands by \|d\|: tall grass 30 m, mud 42 m, the fence line 52 m — tune here) · `NUDGE` (the aimless clock: sore feet 40 s, Ima 70 s, a ride 95 s, then every 45 s; `gap` between nudges; jaywalking warn/★) · `state` · `zone` · `visuals` · `debug.{shoo(kind), aim(s)}`. Off during a foot chase / law flow (only the fence stays solid), in interiors and cutscenes (footRun isn't updating), in the town (`ctx.town.active`) and parties (both get the old far fence); the nudges are gated `ctx.enabled("foot") && ctx.enabled("footbounds")`. Events `foot:shoo` {kind}, `foot:nudge` {kind}; stats `footShooed`, `footRides`, `footBenchSits` |
| `ctx.interiors[id]` | interiors | `{ name, emoji, enter({ exit }) }` — foot shows a door and calls `enter({ exit: () => back to walking })`. ids: `bar`, `school`, `hospital`, `police`, `beach` |
| `ctx.law` | law | `startChase(reason, {heat, msg, at: {x, z} (the witness who saw it leads the chase)})` · **heat before a chase** (cops.js `notice` / `callIn` / `changeLook`): `notice(charge, {msg, warn, witness, src, amount})` a PETTY offense a cop saw — the first is a ⚠️ WARNING (`suspicion` 0–1, drains ~22 s of clean driving), another while it is live (or `amount` 1: reckless — nitro / > 92 mph) is the chase · `callIn(charge, {msg, delay})` a witness phoned it in: 📞 `reported`, after 8–14 s one unlit cruiser prowls up the road looking for the car she is in (sees her ~1 s → chase; she switches cars / paints / ditches it / keeps out of its way 35 s → called off) · `changeLook(how)` a new car / paint / disguise unseen: drops a call-in + the warning, and `lowKey` — the warrant file does not know her this run (`wanted` 0) · `copSees(x, z, r)` a cop with a clear line of sight (crimes only count when SEEN) · `hiding` mid-chase she is stopped (≤ 4 m/s) + tucked away while they search (`cops.js hideInfo()`): "lot" (a rest area's lot) / "verge" (> 9.2 m off the highway's centre line) / "town" (`ctx.town.hideSpot`: at the kerb among parked cars, or off the street surface — never a travel lane, a crossing or an empty kerb); verge + town also need no chasing cruiser with a clear line of sight within `tune.hideSeen` (25 m). Hidden, cruisers only spot her within 10 m and the LOSING THEM meter runs 2×; stopped somewhere that does not count, the HUD hint says why ("not hidden — park at the kerb or get out of sight"). Searching cruisers drive on to where she was heading (in a town: `ctx.town.searchPoint`, then crossing to crossing with `prowlPoint` — they do not know where she is) · `lose(how)` (unseen: she got away — `town:enter` while they search does it) · events `law:warning` {charge, heat}, `law:bolo` {active, charge | why}, `law:look` {how, had} · `arrest(charges[], opts)` · `wanted` (0–5) · `chasing` · `searching` (lost sight of her: the stars flash) · `searchProgress` 0–1 · `clearHeat(msg)` · `copNear(x, z, r)` · `addWarrant(charges)` · `hold(sec)` · `spot(sec)` (a tip-off — features/community's Shomrim radio: mid-chase she counts as SEEN for `sec`) · `lightBar(obj)` → `{set(on, t)}` · `tune` (the pursuit table: cop speed × her top speed, sight range, search time by ★ — tuned with the streets chase lab)  **Releases follow her wheels:** `service.js` `captureRide()` notes at the arrest whether she was in her own intact car (`own`), a `stolen` ride, a `wrecked` car or none (`impounded`); bail / a fine / dismissal / a jailbreak hand back only her own car — otherwise she walks out (copWalk / the jumpsuit jailbreak on foot); served time always walks. The ER does the same (`discharged`). · for a 🎉 party: `partyUnits(n)` (her lit cruisers as `[x×10, z×10, h×1000, …]` for friends' puppets) · `standDown(why)` (a pursuit winds down — law/index.js does it during party races and Free Roam games) |
| `ctx.streets` | streets | `carjack(car?)` (on foot) · `ride` {kind, color} · `jacking` · `canBail()` / `bail()` · `bailHint()` · `rides` (jackable kinds + handling — features/rides adds its fleet here) · `cams` (ride model key → {d, h}: a roomier chase cam for big rides) · `roadblock(ahead, {gap, spikes})` · `spikes(s, d)` · `flat` / `puncture()` / `repairTyres()` · `paint.{cost(), nearest(), enter(), repaint(color), color}` · `damage` ($ this drive) · `smashNear(x, z, r)` · `chop.{request(), job}` · `debug.sim({stars, seed, bot, gap})` (the chase lab) |
| `ctx.er` | cameos | `admit(reason)` — the ER visit (a softer landing than game over) |
| `ctx.avigail` | cameos | `rel()` 0–100 · `bump(d)` (writes shared `avigailRel`) |
| `ctx.phone` | journey + phone | journey: `call({ from, emoji, lines, onAnswer, onDecline })` — the in-car call card (Ima's calls use it) · `text({ from, emoji, color, msg, dur, thread? })` · `active` / `talking` / `busy()` / `hangUp()` / `prop(on, pose)`. phone (`features/phone/`): the 📱 phone screen + apps — see **Lulu's phone** below |
| `ctx.parking` | parking | `start(opts)` — pull over into the parking minigame |
| `ctx.journey` | journey | `stop()` (current stop def), `stopIndex`, `mode` |
| `ctx.garage` | garage | `items()` (counts), `use(id)` |
| `ctx.play` | play | `dreidels` (lifetime ✨), `jump` (live stunt-jump state or null), `photo`, `openPhoto(from)` — 📸 photo mode is state `playPhoto` (it freezes the current state WITHOUT `setState`: no exit/enter/`state` event, restored exactly on exit) |
| `ctx.banter` | banter | `say(cat, opts)` · `billboard(…)` · `reply(car)` · `gesture(name)` · `bubble(text, object3D, {dur, y, cls})` (a pooled speech bubble over anyone) · `addAd(def)` (another feature's billboard design, never random) · `billboardAt(chunk, s, side, id)` — Lulu's one-liners (`banter:line` {cat, text}) and the in-car rig |
| `ctx.atmos` | atmos | `night` (0–1), `clock` (0–1, the Cruise day), `weather`, `info()` · `debug.{time(name\|t), freeze, weather(kind, strength, instant), rainbow, strike, flock(kind), plane(text), balloon}` — in Cruise it blends the sky/fog/sun over journey's per-leg palette (Story keeps the leg's lighting), wets/snows the road + ground materials, lights house windows; all restored on the title. A run may drive the Cruise-style day itself: set `G.atmosClock = () => 0..1` (+ `G.atmosClear = true` for a clear sky) and atmos runs its day/lamps off that clock in any mode, skips the phase toasts, and puts the Cruise clock back afterwards (shabbos uses it: the sunset IS the deadline) · `look()` (the sky + light + weather the driving scene last showed) · `dress(set, {lamps, sky, stars, fog, lights, weather})` / `undress(set)` — an OUTDOOR cutscene set wears that sky (dome, stars, fog, light, rain/snow + its sound, lamps after dark); the clock stands still behind a set, so walking in and out match (`features/atmos/dress.js`; the precinct steps, the roadside parking lot, Avigail's porch, the wedding, the beach) |
| `ctx.party` | party | `active` (in a party), `connected`, `code`, `seed`, `clock()` (the shared party clock, s), `isHost`, `players`, `activity`, `hostParty()` / `joinParty(code)` / `leave()` / `openHub()`, `trafficAt(t)`, `atmosClock()` / `atmosWeather()` — Party with friends (`features/party/`: `net.js` netcode over relay protocol v1, `remote.js` friends' cars, `traffic.js` the seeded traffic, `stage.js` the lobby/podium). Events `party:status`, `party:act`, `party:host`, `party:player`, `party:bc`, `party:synced` · **for another feature's lobby activity** (openworld's 🌍 Free Roam): `addActivity(k, def)` (def: `emoji name blurb go`, `init(A)` → extra A fields, `slotIn(A)` late join, `respawnAt()` ↺, `label(icon)` / `progress()` trip bar, `show(p)` / `frame(p)` / `decorate(rc, p)` friends' cars, `pose()` → `{s, d, h}` my pose in another frame, `planFirst`, `ownTraffic()`) · `sendEvent` / `broadcast` / `onHostEvent` / `setA` / `members()` / `peer(uid)` / `fresh(p)` / `setExtra(x)` (rides in `d.x`) / `displayName` / `skinOf` / `skinHex` / `remoteCar(uid)` / `beginRun` / `placeCar` / `respawned()` / `visuals` · **the shared world** (`plan.js`): `rng(key)` · `seeded(key, fn)` · `h01(key, k)` · `road.{claim(id, kinds), slot(k), list(s0, s1), span}` (see Testing › party). A party run ends with `endRun("party")` (run:end) · **presence** (`presence.js`): `presence({ mode, icon, label }, { sticky })` what I am doing (held until my state changes; null = automatic: drive · chase · foot · in · law · jail · court · er · scene · lobby …) / `presenceOf(uid)` → `{ mode, icon, label }` / `presenceBadge(uid)` (the nametag chip) / `setX(k, v)` a per-feature key in my snapshot extras `d.x` (tiny; keys in use: `pr f pc v cp ws at jk cl`) / `claimTraffic(car)` (a shared car leaves the traffic for everyone — carjack) / `trafficGone(key)` · **claims** (see Testing › party): `claim(car, {L, dS, hail, how})` / `canClaim(car)` / `claimKinds(prefix, handler)` / `sharedCrash(car, e)` / `claimsLive()` / `claimPose(key, T)` · `addTrafficKind(kind, w, on)` (a special vehicle in the shared traffic, at boot) · `friendCars()` (friends' cars as drawn: cosmetic contact) · events `party:claim` {key, how, hail}; stats `partyClaims`, `partyHails` · `_debug.world(uid)` / `_debug.xk()` (tests) |
| `ctx.hustle` | hustle | `job` (the active side job `{id: "cab" \| "getaway" \| "delivery", phase, def…}` or null) · `start(id, opts)` · `end(result, why)` · `offer(id, "marker" \| "phone")` · `marker` · `hold(s)` (no random offers) · `radio` `{station, name, stations, cycle(dir), tune(id), state()}` · `log` · `openLog()`. Events `hustle:start` {id, via}, `hustle:end` {id, result, why, pay}, `hustle:heist`, `hustle:bag` {lost}, `hustle:radio` {station}. Riders sit in roadevents' seat (`ctx.roadevents.seat(person, {keep, pose})` / `unseat(person)`) |
| `ctx.town` | town | `active` · `id` / `name` · `street` (the street she's on) · `streets` · `occluders` (world rects) · `enter({town: "lakewood" | "midwood", speed})` / `leave(why)` (no ramp: tests/debug) · `load(id)` / `loaded(id)` (a town's models) · for law: `blocksSight(ax, az, bx, bz)` · `copRoute(car, u, to?)` → `{gap, aim(la, out)}` (to her, or to `to` {x, z, s}) · `hideSpot(x, z)` → `{ok, spot: kerb | mall | walk | yard | lane | junction, why: lane | empty}` · `searchPoint(last)` / `prowlPoint(at, car)` (where a searching cruiser drives) · `copSpawn(how)` → `{s, d, dir}` · for foot: `footYaw(F, roadH, dt)` · `towns` (the data) · for features that live in a town: `def` (the current town's data), `allowState(name)` (your state may play in town), `spot(name)` (a built spot in world coords: pizza, hall, a `uses` landmark…), `exits` (`[{s, id, name, town, emoji, no, label, branch}]` this run: one row per town an interchange offers) · `span` ({a, b}: an exit's signs → ramps, relative to its s), `addDriver(kind, {minD})` (a lane-following town driver the town never respawns), `curbSpot({len, near, minD, maxD, still})` (a free stretch of parking lane; `still`: only parked cars count — a party's seeded pick) · `debug`. Events `town:enter` {town, exitS}, `town:leave` {town, why: highway \| wreck \| quiet \| reset}, `town:gossip` {kind, msg}, `town:talk` {id, line}, `town:stopSign`, `town:bump`, `town:geese`, `town:bike`, `town:oneway` {street}, `town:train` {line}; stats `townVisits`, `townStopSigns`, `townTalks`, `townGossip`, `townEscapes`, `townWrongWay` · for openworld: `plan` (PL, local frame) · `spots` (landmarks, local) · `coins` · `people()` → [{id, name, x, z}] |
| `ctx.community` | community | `active` (in a town with volunteer orgs) · `towns` / `register(id, cfg)` / `config(id)` (the per-town registry, `features/community/towns.js`) · `vehicles` · `scene` · `chase` · `help` · `by` · `heat` · `startScene(kind)` · `call(org, reason)` / `reasons(org)` · `request(kind)` (`fix` `gas` `tow` `unlock` `patch` `fine` `visit` `geese`) · `shomrim(reason, {join, withCops})` / `endShomrim(why)` · `blend({auto})` · `stats` · `debug`. Events `community:scene` {kind, org, phase, byLulu}, `community:help` {kind, org, phase}, `community:shomrim` {active, reason, lead, join, called, why}, `community:hold` {result}, `community:by` {phase, result}, `community:call` {org}; stats `communityChesed`, `communityHelped`, `communityPatched`, `communityCalls`, `communityShomrimChases`, `communityHolds`, `communityBlends`, `communityBlendTries`, `communitySelfReports`, `communitySurrenders` |
| `ctx.openworld` | openworld | `partyTowns()` (towns on in a party = 🌍 Free Roam) · `seeded(key, fn)` (Math.random seeded from the party for fn) · `zone` ("" highway \| town id) · `game` (a copy of the live game) · `start(k)` → "" or why not (`cnr` `pin` `kugel` `photo`) · `end()` (host) · `warpTo(uid)` · `pin({x, z, name, icon, uid?})` / `unpin()` / `pinned` · `townLoops()` (a party town's block loops, read-only: community's org cruisers ride them) · `debug`. Events `openworld:start` {k, n}, `openworld:warp` {zone}; stats `owGames`, `owWins`, `owBusts`, `owStashes`, `owSnaps`, `owWarps` |
| `ctx.memory` | memory | `grudges` (live list of remembered carjack victims `{id, name, key, colors, kind, color, run, seen, lastRun}`, ≤ 6) · `notoriety()` → `{score, level 0–4, title, arrests, mugshots, escapes, er, carjacks, maxStars, grudges}` · `remember(kind, data)` (`"grudge"` streets:carjack-shaped · `"poster"` {heat, why} owes a WANTED billboard · `"text"` queues a text · anything else → a capped log) · `recall(kind)` (a copy) · `recognize(who, info)` → a rate-limited line or `""` (`"cop"`, `"moishe"` {color}, `"hitch"` {event: pick\|pass\|drop}, `"avigailRoad"`, `"avigailPorch"`) · `spawnGrudge(rec?, {act, behind})` → Promise<car> (acts `yell` `tailgate` `brakecheck` `cops` `forgive`) · `canMeet()` · `forgive(rec)` · `text(t, {next, after})` · `poster(ahead, side, variant)` · `runs`. Events `memory:grudge` {name, kind, color, act, seen}, `memory:billboard` {variant, key, s, side} |
| `ctx.places` | world | `add(def)` a pull-in place (`{id, name, icon, kind, where(mode) → [s…], d, bay: {half, d0, d1}, model, sign, colliders(spot), host(spot), cam(spot, t, pos, look), dur, beats: [{t, run(spot)}]}` — a town can register its own) · `get(id)` · `list()` · `spots()` (built ones near the car) · `at(id)` (positions this mode) · `visits(id)` · `inside` · `visit(key)` · `home {ready, phase: "parked" \| "arriving", park {x,z,h,s,d}, parked(), depart(), holiday(), decor, extras}` · `debug {clock(v), localClock(date), parkNow(), holiday()}`. Events `world:depart` {mode}, `world:home`, `world:visit` {id, s}, `world:holiday` {id} |
| `ctx.exits` | exits | `rests` (`[{s, k, name}]` planned this run) · `spans()` (`[{a, b}]` each rest area's signs → accel lane: town's exit planner keeps out) · `inside` (the rest area she's in, or null) · `next` (what the next-exit chip shows) · `dealOfDay` · `debug.{RS, LY, LIFE, restAhead(ahead), pt(i, u, d), actAt(kind), modelsReady()}` — 🛣️ highway exits & 🅿️ rest areas (`features/exits/`). Events `exits:rest` {phase: enter \| leave, s, name}, `exits:talk` {id}, `exits:food` {id, cost}, `exits:restroom` {gag}, `exits:vending` {result}, `exits:souvenir` {id}, `exits:picnic`, `exits:dog`, `exits:pump` {result}, `exits:mechanic` {result}; stats `restStops`, `restMeals`, `restRestrooms`, `restSnacks`, `restKicks`, `restSouvenirs`, `restPicnics`, `restDogPets`, `restTalks`, `restFills`, `restRepairs` |
| `ctx.feel` | feel | `damage.{k, stage, info(), repair(why) → bool, hit(side), undo(n)}` — the wear on Lulu's own car (k = hits shown, stage 0–4: dents → cracked windshield → smoking hood → last heart: hubcap off + dragging bumper; never more than the hearts lost) · `debug.{wear(k, side), audio(), emitters(), passes(), muffle()}` |
| `ctx.shabbos` | shabbos | `active` · `phase` ("drive" \| "arrive" \| "done" \| "late") · `left` (s to candles) · `total` · `dest` (Bubbe's house = `ctx.journey.stopS(0)`) · `start(via)` (a fresh rush, `G.mode = "shabbos"`) · `offer()` (Cruise: Ima's "Oy, it's erev Shabbos!" call; letting it ring turns the drive into the rush) · `friday()` · `records` · `debug.{date(iso), setLeft(s), setFrac(u), line(), props(), info()}` — 🕯️ Erev Shabbos Rush (`features/shabbos/`). Events `shabbos:start` {via, total, dest}, `shabbos:call` {i, result}, `shabbos:candles` {margin, pay}, `shabbos:late`, `shabbos:end` {made, margin}; stats `shabbosMade`, `shabbosLate`, `shabbosCandles`, `shabbosMargin` (best) |
| `ctx.rides` | rides | `add(def)` a ride keyed by the shell's model key (see **Rides** below — a town brings its own vehicles + tricks) · `get(id)` · `list()` · `forKey(key)` · `current` (the live ride `{id, def, key, obj, t, siren, data}` or null) · `id` · `siren` / `setSiren(on)` · `act()` → the trick on offer `{id, emoji, label, ready}` · `use(via)` · `horn()` · `holdsHorn` (holding the horn is the trick right now — Shared Road's emote wheel stands down) · `nudge(range)` (cars ahead move over) · `stats` · `debug.{board(id), R, yieldingCount(), amb, ice, bus}` — 🚓🚑🍦 every vehicle Lulu drives is its own thing (`features/rides/`). Events `rides:enter` {id, key}, `rides:exit` {id, why}, `rides:siren` {id, on}, `rides:horn` {id, kind}, `rides:ability` {id, act, via}, `rides:ticket` {seen, left}, `rides:impostor`, `rides:spikes` {left}, `rides:megaphone`, `rides:patient` {phase: dispatch \| pickup \| drop \| late, pay?}, `rides:jingle` {parked}, `rides:cone` {served}, `rides:busstop` {s, riders}, `rides:fares` {n}; stats `ridesTried`, `ridesTickets`, `ridesImpostor`, `ridesSpikes`, `ridesPatients`, `ridesPatientsLost`, `ridesPatchUps`, `ridesCones`, `ridesFares`, `ridesTaxiBonus` |
| `ctx.moves` | moves | (`features/moves/`) 🏁 the skill moves + the style combo: `on` (get/set — the Moves page switch; off in `?test` unless `&enable=moves`) · `combo` {n, pts, mult, t, distinct, kinds} · `addMove(id, pts, label, {color, foot})` (feed the combo from your feature) · `keepAlive(sec)` (a link: hold the combo open) · `bank(why)` · `break(why)` · `turbo(tier 1–3, src)` (a mini-turbo) · `airBotched()` (play's touchdown asks) · `footMove()` (start the on-foot roll / slide / vault) · `drifting` · `driftTier` · `turboLeft` · `stars(id)` · `list` · `openPage(from)` (📒 › 🏁 Moves) · `debug {D, T, R, DR, W, B, X, TUNE, AIR, FOOT, PERF, LOG, foot(), callout()}`. Events `moves:move` {id, pts, combo, mult} · `moves:bank` {n, mult, pts, total, coins, why} · `moves:break` {n, mult, why} · `moves:turbo` {tier, src} · `moves:drift` {on, dir \| tier} · `moves:pit` {car} · `moves:air` {tricks, flips, rolls, spins, clean}; stats `moves3d`, `movesTurbo1/2/3`, `movesPerfectStart`, `movesSlingshot`, `movesBootleg`, `movesPit`, `movesAirTricks`, `movesCombo3`, best `movesCombo` |
| `ctx.meta` | meta | `stat(id, n)` / `best(id, v)` · `holiday()` · `calm()` · `openScrapbook(from, tab?)` (tab = an index or an added tab's id) · `openQuests(from)` · `addScrapbookTab({ id, icon, name, render(S) → html, wire?(card, rerender) })` (a page after Badges · Record · Crew · Stats) · `addBadge(def)` (a 3D badge, same shape as `BADGES`) |
| `ctx.ads` | native | (`features/native/ads.js`, the iOS app's AdMob — a port of `src/10c-ads.js`: same ad unit IDs / `isTesting`) `native` (Capacitor + the AdMob plugin) · `ready` (initialized) · `att` (the ATT answer seen) · `rewardedReady` · `rewardedAvailable()` · `showRewarded(onReward)` · `debug.{S, ADMOB, log}`. Launch: ~1.2 s in it asks App Tracking Transparency (only while undetermined) and only THEN `AdMob.initialize` (Apple Guideline 2.1). Placements: entering `gameover` → an interstitial every 2nd time + the opt-in "📺 WATCH → +50 💰" button (`#adReward`, second on the card, only while an ad is loaded, one reward per game over). Never mid-drive, in a party or Dina's mode; on the web / in `?test` without `&enable=ads` it never touches anything. Event `ads:ready` {att}; stat `adRewards`. `ctx.native` {active, platform} · `ctx.haptics` {native, debug} (touch-play `rumble()` → `Capacitor.Plugins.Haptics.impact` HEAVY / MEDIUM / LIGHT, throttled per level, off with Settings → 📳 Rumble & haptics). Test: `scripts/tests3d/native.js` (boots the staged `www/3d/` with a fake Capacitor) |
| `ctx.heist` | heist | `job` (Lulu's heist `{town, plan, bags, lost, phase: inside \| getaway \| pulled, stars}`) · `plan` (a cased bank / the tip `{town \| null, plan, via}`) · `robbery` / `snatcher` / `thief` (the live event) · `busy(except)` · `planHeist(town, planId)` · `cooldownLeft()` · `gear.{fireNet(from, {sure}), laySpikes(ahead, d), ripNet(), flatTyres(dur), netted, flat}` · `store` · `tune` / `pay` / `plans` · `debug.{robbery(opts), endRobbery, schedRobbery(), job, tip, snatch(mode), carTheft, enterBank, bypass(on)}` — 🏦 (`features/heist/`). Events `heist:robbery` {phase: staged \| start \| foiled \| escaped, where, how, pay}, `heist:job` {phase: tip \| plan \| start \| escaped \| busted \| failed}, `heist:snatch` {phase: approach \| dodged \| grab \| caught \| lost, n}, `heist:theft` {phase: warn \| stopped \| stolen \| recovered \| ditched}, `heist:gear` {kind: net \| spikes, phase}; stats `heistFoils`, `heistTackles`, `heistJobs`, `heistJobsClean`, `heistBusted`, `heistCased`, `heistBankVisits`, `heistSnatched`, `heistSnatchDodged`, `heistSnatchCaught`, `heistCarStolen`, `heistCarsRecovered`, `heistTheftStopped`, `heistNetted`, `heistSpiked`, best `heistBestPay` |
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

**Out of hearts (`hooks.wreck`) priorities:** law **30** (claims only when a cop/cop car caused
the wreck → arrest), cameos **10** (claims every other wreck and plays the 2D crash aftermath: the
angry man / Hillel the adjuster / animal swarm…, then sends Lulu to the ER (~35%), lets her walk
on (`ctx.foot.start("crashReprieve")`, rare), or game over via `setState("gameover", {quote})`).

**The home street (world):** the title is a live scene, not an attract loop. `features/world` wraps the
title state's `update` (menu input + its own tick instead of core's `autopilot`), owns the title camera
(`titleCamera` hook at priority −1000, so every other titleCamera hook still runs first) and parks the car at
`ctx.places.home.park` (`car.showDriver(false)`; on-foot Lulu stands beside it). Coming back to the title
from anywhere else, the car drives up the street and parks. A run started FROM THE TITLE at the start of the
road (Cruise, Story leg 1) gets the pull-out: a `runStart` hook (priority −100) sets **`G.introState =
"worldDepart"`** and core's `startRun` enters that state instead of `intro` (a skippable state that hands over
to `playing` with the car rolling in its lane and the chase cam where it'll be). `startRun({ quick: true })`,
Restart / Try again, checkpoints and parties keep the instant 3-2-1. atmos: `ctx.atmos.titleClock` (a
function, set by world) keeps the day + weather running on the title on the device's clock; Cruise continues
from that clock. Holiday dressing reads `ctx.meta.holiday()`.

**Title menu orders:** see Menus (grouped home screen). 🎉 Party with friends is 60 (🌐 Shared Road is
inside its hub; its own title button shows only when the party feature is off).
**Pause menu orders:** resume 0 · ⏭ skip 5 · camera 10 · 📱 phone 11 (the radio lives in the phone now) · 📸 photo mode 12 · settings 35 (the button guide is
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
rotation about the car's middle. The rocket start wraps `intro` / `worldDepart`'s `update` at boot to sample the gas.
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

**Towns (town):** a Cruise run has an INTERCHANGE every few km (`towns/<id>.js` › `highway: {first, every, no, label}`) and
every one offers every town in `towns/index.js` › `INTERCHANGE` (its own sign copy; `{no}`/`{label}` fill per town): advance
signs (1 MI, ½ MI, a last-chance board), the `exits_gantry` (features/exits' Blender module: EXIT ONLY over the decel lane,
↑ THRU TRAFFIC over the through lanes), a dashed line that keeps the right lane straight, the decel lane, the painted gore and
ONE ramp that splits at u = 0 (`exit.js`: the inner branch `rampD` → towns[0] = Lakewood, the outer `outerD` → Midwood). A town
is only entered from a branch past `COMMIT` (55 m, ~23 m off the highway) — `rampPhase(e, s, d)` → `decel` / `ramp` / `branch`;
before that the light ramp cue (`H.prompt`, never a popup) names the choices and she can steer back across the gore. The ramps
are paved (core `paved`). Planning slides an exit clear of pull-in places, rest areas (`ctx.exits.spans()`) and big reserved
right-side stretches (the coast's ocean, a family's yard). `exitAhead(ahead, id)` (debug) plans the interchange, or a one-town
exit with that town's own signs. Event `town:exit` {town, s, no} when she takes a branch. A town's models load only as her car
nears its exit (the first town's), and every offered town's once she's in the decel lane (`def.models`, per town). The town is a
district (see World) built when she takes the ramp and disposed when she leaves; everything about a
town is DATA in `features/town/towns/<id>.js` (streets with names and extents, block uses, landmarks,
jams, signs, people + lines, traffic mix, the entry and the exits) read by a generic engine
(`plan.js` → streets / crossings / blocks / graph / TownRoad). While she's in town `ctx.enabled()` is
false for the highway's random content (roadevents, cameos, foot's spawners, interiors, journey, hustle,
play, banter's random parts, law's random cops); chases, carjacking and walking still work through the
district. Hooks into other features (all guarded by `ctx.town && ctx.town.active`): **law** —
`clearLine` uses `ctx.town.blocksSight`, a chasing cruiser steers by `ctx.town.copRoute`, new
cruisers join at `ctx.town.copSpawn`, hiding asks `ctx.town.hideSpot` (the kerb among parked cars / off the street — a travel lane never counts), a SEARCHING cruiser drives to `ctx.town.searchPoint` then prowls crossing to crossing (`prowlPoint`); **foot** — the walking frame comes from `ctx.town.footYaw`;
**streets** — no roadblocks and the chop-shop order pauses in town. A scene the town can't host (jail,
the ER, any set) first sends her back to the highway; out of hearts she's towed to the highway's
shoulder and the usual aftermath plays there (`hooks.wreck` priority 40, never claims). The group-chat
gossip goes through `ctx.phone.text` (thread = the town's group) and the 📱 phone gets a 🗞️ **Kvetch** app
(order 70: the town's parody local news + what Lulu just did).
**Performance:** static pieces are merged by `kit.js` into vertex-coloured 60 m clusters (one material per
look), culled every few frames by distance and by the town's own blocks (a cluster is hidden when every
sample point is behind another block), every bit of text is one atlas mesh,
parked cars use the light `town_minivan_lod` (no shadow, a dark patch underneath), townsfolk cast no
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
Orders: 🗺️ map 10 · 👯 party 15 (openworld, Free Roam only) · 💬 messages 20 · 📍 nearby 25 (openworld) · 📻 radio 30 · 💼 jobs 40 · 🎨 paint 50 · 📸 camera 60 · 📞 call 65 (community: in a town only) · 🗞️ Kvetch 70 (town) — keep the grid ≤ ~8 apps.
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

**Banks, heists & robberies (heist):** CARTOON ONLY (the owner's call; 12+): the robbers' "weapons" are a banana, a water
pistol, a baguette and a confetti blaster (`heist_props` Prop_* nodes), nobody is ever shot, nobody is hurt beyond the
usual knock-down / heart rules, the cops bring a stun net and a spike strip. **The bank is town DATA**: `uses.bank` in
`towns/lakewood.js` (Main St, beside the Simcha Palace) and `towns/midwood.js` (Avenue J, re-tinted limestone + a green roof)
places `heist_bank` (merged by kit.js like any building: ~0 extra draw calls) with its sign in the town's atlas; `T.spots.bank`
is its door. On foot ✋ ENTER (a `ctx.foot.addSpot`) opens the interiors engine's `bank` (`defineInterior` from
`interiors/engine.js`; the town `allowState("interior")` — but only the bank keeps her in town, any other interior there still
leaves it quietly). **Robberies** (`robbery.js`, gated `ctx.enabled("heist")`, Cruise only, never in a chase / a job / the
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
(`.heist-chip`, sub-lines `.hud-secondary`) + one pooled beacon cone; no other HUD. Test: `scripts/tests3d/heist.js`.

**Rest areas (exits):** a service plaza off the highway every ~7 km in Cruise and Story (`REST` in `exits/index.js`), planned
≥ 2 km ahead and slid clear of the town's interchanges, pull-in places, big reserved stretches and (Story) the family stops.
No district and no fade: everything is in the highway's road coords (u = s − rest.s, d) — `layout.js` is the whole plaza as
DATA (decel lane, off-ramp, the lot, on-ramp, accel lane; props, colliders, people, ✋ spots, the two drive-up bays) — and
`build.js` draws it in `chunk:build` (ONE asphalt mesh, stall lines, gores, the props merged with town's `kit.js` Merger,
every sign face from one atlas: ~8–10 draw calls a chunk). Its asphalt is `paved` 2 and its lawn / verges 1, so the car drives
the lot at road speed and foot walks it without the wilderness (the reserve also clears foot's grass / mud / fence visuals).
Drive-up bays go through `ctx.places` (`exits_pump`: nitro for coins; `exits_garage`: Mendel takes the dents out via
`ctx.feel.damage.repair("mechanic")`, and a flat via `ctx.streets.repairTyres()`); on foot one `ctx.foot.addSpot` spot picks the
nearest thing (talk to travellers, the food court `choose()` menu, the restroom gag and the picnic sit in `ctx.foot.script`, the
vending machine, the souvenir stand's deal of the day written to the shared save, Kugel the dog). The cast is pooled npcMan /
npcWoman / npcKid (+ law's K9 as the dog) spawned only within ~250 m, casting no shadow and hidden past 40 m from the camera; parked cars are merged, shadowless. While she's in the lot
`G.noPullOver` is set (stop = get out & walk, not the parking minigame). HUD: the decel-lane cue (a prompt) and the next-exit
chip (`.exits-chip.hud-secondary` in the "center" slot, only ≤ 1 mi ahead — interchanges and rest areas). Gated by
`ctx.enabled("exits")`; in a 🎉 party the rest areas are seeded (see the parity table) and the visit is personal (presence ⛽).
`scripts/tests3d/exits.js` covers passing / both branches / the rest area; `partyplus.js` the party side.
