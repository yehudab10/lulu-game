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
- `titleInfo` items: `bar: true` (a chip in the home top bar), `for: "<item id>"` (appended to that item's
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
`traffic.remove(car)`, `traffic.clear()`, `traffic.cars`.

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
`input.stick2d = true` makes the touch stick 2-D (on foot / Dina). `rumble(strong, weak, ms)`.

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
The same gate keeps a 🎉 **party** fair: during a party `ctx.enabled()` is false for roadevents, cameos,
law, journey, meta, foot, interiors, dina, hustle, streets, memory, world and banter's random parts, so every friend's world stays identical
(traffic, ramps, dreidels and billboards come from the party seed; atmos takes its clock + weather from
`ctx.party`). Anything random you add must check `ctx.enabled("<id>")` (or `ctx.party.active`).

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
| `ctx.foot` | foot | `start(reason, opts)` — Lulu climbs out and walks (reasons: `carWreck`, `crashReprieve`, `droveOff`, `copWalk`, `jailbreak`, `parked`, `bailout`; `opts.noIntro` when your scene already showed her getting out — she starts on her feet, no second climb-out; `at {x,z}` where she stands, `stubAi(dt, car)` to drive the car she left, `drivable`) · `active` · `script({update(dt,P,F) → true while running, camera?(dt), abort?(why)})` hands Lulu to your animation on foot · `drive(v)` puts her behind the wheel of `{vtype, key, colors, x, z, h, handling?}` (a borrowed-vehicle shell; `handling` = car stats while she drives it) · `shellObj` · `say(obj, text, sec)` · `addSpot(spot)` (`spot.short` = the ✋ button's label) |
| `ctx.interiors[id]` | interiors | `{ name, emoji, enter({ exit }) }` — foot shows a door and calls `enter({ exit: () => back to walking })`. ids: `bar`, `school`, `hospital`, `police`, `beach` |
| `ctx.law` | law | `startChase(reason, {heat, msg})` · `arrest(charges[], opts)` · `wanted` (0–5) · `chasing` · `searching` (lost sight of her: the stars flash) · `searchProgress` 0–1 · `clearHeat(msg)` · `copNear(x, z, r)` · `addWarrant(charges)` · `hold(sec)` · `lightBar(obj)` → `{set(on, t)}` · `tune` (the pursuit table: cop speed × her top speed, sight range, search time by ★ — tuned with the streets chase lab) |
| `ctx.streets` | streets | `carjack(car?)` (on foot) · `ride` {kind, color} · `jacking` · `canBail()` / `bail()` · `bailHint()` · `rides` (jackable kinds + handling) · `roadblock(ahead, {gap, spikes})` · `spikes(s, d)` · `flat` / `puncture()` / `repairTyres()` · `paint.{cost(), nearest(), enter(), repaint(color), color}` · `damage` ($ this drive) · `smashNear(x, z, r)` · `chop.{request(), job}` · `debug.sim({stars, seed, bot, gap})` (the chase lab) |
| `ctx.er` | cameos | `admit(reason)` — the ER visit (a softer landing than game over) |
| `ctx.avigail` | cameos | `rel()` 0–100 · `bump(d)` (writes shared `avigailRel`) |
| `ctx.phone` | journey + phone | journey: `call({ from, emoji, lines, onAnswer, onDecline })` — the in-car call card (Ima's calls use it) · `text({ from, emoji, color, msg, dur, thread? })` · `active` / `talking` / `busy()` / `hangUp()` / `prop(on, pose)`. phone (`features/phone/`): the 📱 phone screen + apps — see **Lulu's phone** below |
| `ctx.parking` | parking | `start(opts)` — pull over into the parking minigame |
| `ctx.journey` | journey | `stop()` (current stop def), `stopIndex`, `mode` |
| `ctx.garage` | garage | `items()` (counts), `use(id)` |
| `ctx.play` | play | `dreidels` (lifetime ✨), `jump` (live stunt-jump state or null), `photo`, `openPhoto(from)` — 📸 photo mode is state `playPhoto` (it freezes the current state WITHOUT `setState`: no exit/enter/`state` event, restored exactly on exit) |
| `ctx.banter` | banter | `say(cat, opts)` · `billboard(…)` · `reply(car)` · `gesture(name)` · `bubble(text, object3D, {dur, y, cls})` (a pooled speech bubble over anyone) · `addAd(def)` (another feature's billboard design, never random) · `billboardAt(chunk, s, side, id)` — Lulu's one-liners (`banter:line` {cat, text}) and the in-car rig |
| `ctx.atmos` | atmos | `night` (0–1), `clock` (0–1, the Cruise day), `weather`, `info()` · `debug.{time(name\|t), freeze, weather(kind, strength, instant), rainbow, strike, flock(kind), plane(text), balloon}` — in Cruise it blends the sky/fog/sun over journey's per-leg palette (Story keeps the leg's lighting), wets/snows the road + ground materials, lights house windows; all restored on the title |
| `ctx.party` | party | `active` (in a party), `connected`, `code`, `seed`, `clock()` (the shared party clock, s), `isHost`, `players`, `activity`, `hostParty()` / `joinParty(code)` / `leave()` / `openHub()`, `trafficAt(t)`, `atmosClock()` / `atmosWeather()` — Party with friends (`features/party/`: `net.js` netcode over relay protocol v1, `remote.js` friends' cars, `traffic.js` the seeded traffic, `stage.js` the lobby/podium). Events `party:status`, `party:act`, `party:host`, `party:player`, `party:bc`, `party:synced` |
| `ctx.hustle` | hustle | `job` (the active side job `{id: "cab" \| "getaway" \| "delivery", phase, def…}` or null) · `start(id, opts)` · `end(result, why)` · `offer(id, "marker" \| "phone")` · `marker` · `hold(s)` (no random offers) · `radio` `{station, name, stations, cycle(dir), tune(id), state()}` · `log` · `openLog()`. Events `hustle:start` {id, via}, `hustle:end` {id, result, why, pay}, `hustle:heist`, `hustle:bag` {lost}, `hustle:radio` {station}. Riders sit in roadevents' seat (`ctx.roadevents.seat(person, {keep, pose})` / `unseat(person)`) |
| `ctx.memory` | memory | `grudges` (live list of remembered carjack victims `{id, name, key, colors, kind, color, run, seen, lastRun}`, ≤ 6) · `notoriety()` → `{score, level 0–4, title, arrests, mugshots, escapes, er, carjacks, maxStars, grudges}` · `remember(kind, data)` (`"grudge"` streets:carjack-shaped · `"poster"` {heat, why} owes a WANTED billboard · `"text"` queues a text · anything else → a capped log) · `recall(kind)` (a copy) · `recognize(who, info)` → a rate-limited line or `""` (`"cop"`, `"moishe"` {color}, `"hitch"` {event: pick\|pass\|drop}, `"avigailRoad"`, `"avigailPorch"`) · `spawnGrudge(rec?, {act, behind})` → Promise<car> (acts `yell` `tailgate` `brakecheck` `cops` `forgive`) · `canMeet()` · `forgive(rec)` · `text(t, {next, after})` · `poster(ahead, side, variant)` · `runs`. Events `memory:grudge` {name, kind, color, act, seen}, `memory:billboard` {variant, key, s, side} |
| `ctx.places` | world | `add(def)` a pull-in place (`{id, name, icon, kind, where(mode) → [s…], d, bay: {half, d0, d1}, model, sign, colliders(spot), host(spot), cam(spot, t, pos, look), dur, beats: [{t, run(spot)}]}` — a town can register its own) · `get(id)` · `list()` · `spots()` (built ones near the car) · `at(id)` (positions this mode) · `visits(id)` · `inside` · `visit(key)` · `home {ready, phase: "parked" \| "arriving", park {x,z,h,s,d}, parked(), depart(), holiday(), decor, extras}` · `debug {clock(v), localClock(date), parkNow(), holiday()}`. Events `world:depart` {mode}, `world:home`, `world:visit` {id, s}, `world:holiday` {id} |
| `ctx.feel` | feel | `damage.{k, stage, info(), repair(why) → bool, hit(side), undo(n)}` — the wear on Lulu's own car (k = hits shown, stage 0–4: dents → cracked windshield → smoking hood → last heart: hubcap off + dragging bumper; never more than the hearts lost) · `debug.{wear(k, side), audio(), emitters(), passes(), muffle()}` |
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
Orders: 🗺️ map 10 · 💬 messages 20 · 📻 radio 30 · 💼 jobs 40 · 🎨 paint 50 · 📸 camera 60 — keep the grid ≤ ~8 apps.
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
