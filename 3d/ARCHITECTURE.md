# Lulu's Road Trip 3D — architecture & feature contract

The 3D game (`3d/`, live at lulu.boats/3d) is plain ES modules + a vendored
three.js r170 — no bundler, no build step. The core is small; **everything
else is a feature module** that plugs in through `js/core/ctx.js`.

```
3d/
  index.html  style3d.css                   page + HUD markup + base styles
  js/main.js                                boot, renderer, main loop, settings
  js/core/ctx.js                            ctx object, events, hooks, states, menus, actors
  js/core/save.js                           3D save, per-feature store(), SHARED 2D save + wallet
  js/core/driving.js                        run lifecycle, driving sim, damage/wreck, coins, states intro/playing/wrecked/gameover
  js/core/camera.js                         chase / far / Lulu's-eyes cams + cinematic()/follow() helpers
  js/core/screens.js                        title, pause overlay, controls, settings
  js/core/dialog.js                         visual-novel dialogue box: say() / choose() / script()
  js/core/people.js                         animate Blender-built people (walk, wave, talk, cheer, sit, dance)
  js/core/sets.js                           self-contained 3D scenes for interiors/minigames (makeSet, makeRoom, textPlane)
  js/core/platform.js                       PS5 / console / TV detection, TV mode
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
});
setState("myScene", { any: "data" });
```
Built-in: `title`, `intro` (3-2-1), `playing`, `wrecked`, `gameover`, plus journey's
`arriving` / `arrivedScreen`. To drive the car from your state call
`updateDriving(dt, P, controlsOn, ctlOverride)` from `core/driving.js`.

### Menus
`addMenuItem("title" | "pause" | "settings" | "titleInfo" | <your own>, { id, order, label, cls, visible, action })`.
Title order guide: 10 story · 20 cruise · 30–60 features (shop 30, Dina 35, parking 40,
scrapbook 50, quests 55, shared road 60) · 70 car · 80 controls · 85 settings · 99 2D.
`cls`: "" (green) | "alt" (brown) | "pink" | "purple". `titleInfo` items add HTML lines to the title card.

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
fire item interact map tabPrev tabNext`. Controller: ✕/A confirm+interact, ○/B back, D-pad ↑ fire,
↓ item, L1/R1 tabs in menus, touchpad/View map. `glyph(action)` → the right button label for the
current device (PlayStation symbols on a DualSense). `addTouchButton({id, emoji, label, action, visible})`.
`input.stick2d = true` makes the touch stick 2-D (on foot / Dina). `rumble(strong, weak, ms)`.

## UI (`js/hud.js`, `js/core/dialog.js`)
`H.showScreen(html, buttons, {onBack, onTab, focus, wide})` → card (all `<button>`/`.nav` are
controller-focusable), `H.hideScreen()`, `H.menuInput(P)` (call from your update while a screen is open),
`H.refreshFocus()` after re-rendering part of a card, `H.toast(text, "gold"|"pink"|"red"|"big")`,
`H.banner(html, ms)`, `H.hudSlot("left"|"center"|"right"|"bottom")`, `H.prompt(html)`, `H.flash()`.
Dialogue: `await say(name, text, {emoji, color})`, `await choose(name, text, [opts])` → index,
`await script([[who, text], …], {emoji: {who: "👵"}})`. While a line is open, input goes to the dialogue.

## Sets (`js/core/sets.js`)
`const set = makeSet({ light: "day"|"indoor"|"night"|"dusk", sky, fog, ground })` → `{scene, camera, add, own, show, hide, dispose}`.
`makeRoom(set, {w, d, h, floor, walls})`, `textPlane(lines, {w, h, bg, fg})`. In your state:
`enter → set.show()`, `exit → set.hide()` (or dispose), update the set camera yourself.

## Audio (`js/audio.js`)
`sfxCoin sfxCloseCall sfxBoost sfxCrash sfxBump sfxHorn(on) sfxSiren sfxFanfare sfxSelect sfxMove`,
`setMusic(url)` — reuse the 2D tracks: `../lulu.mp3 ../luludriving.mp3 ../dina.mp3 ../avigail.mp3
../parking.mp3 ../salon.mp3 ../wedding.mp3 ../prison.mp3 ../court.mp3 ../walking.mp3 ../er1.mp3 ../er2.mp3
../story-relax.mp3 ../story-electric.mp3 ../story-beach.mp3`. Synthesize new SFX with WebAudio if needed
(`unlockAudio()` already happened by the time gameplay runs).

## Testing
**Determinism rule:** gate every RANDOM or surprise thing you add (spawned events, cameos,
patrols, popups, tutorials, daily-gift dialogs) with `ctx.enabled("<id>")`. It's always true in
the real game; in `?test` runs it's false unless the test opts in with `query: "&enable=<id>"` in
its module export. Never put a blocking modal in the title → Story Trip → playing path.

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
| `ctx.foot` | foot | `start(reason, opts)` — Lulu climbs out and walks (reasons: `carWreck`, `crashReprieve`, `droveOff`, `copWalk`, `jailbreak`, `parked`) · `active` |
| `ctx.interiors[id]` | interiors | `{ name, emoji, enter({ exit }) }` — foot shows a door and calls `enter({ exit: () => back to walking })`. ids: `bar`, `school`, `hospital`, `police`, `beach` |
| `ctx.law` | law | `startChase(reason)` · `arrest(charges[], opts)` · `wanted` (0–5) |
| `ctx.er` | cameos | `admit(reason)` — the ER visit (a softer landing than game over) |
| `ctx.avigail` | cameos | `rel()` 0–100 · `bump(d)` (writes shared `avigailRel`) |
| `ctx.phone` | journey | `call({ from, emoji, lines, onAnswer, onDecline })` — the in-car phone UI (Ima's calls use it) |
| `ctx.parking` | parking | `start(opts)` — pull over into the parking minigame |
| `ctx.journey` | journey | `stop()` (current stop def), `stopIndex`, `mode` |
| `ctx.garage` | garage | `items()` (counts), `use(id)` |

Events between features: `item:use` {id: "missile" | "pepper" | "shield", x, z} (garage → law
reacts to pepper spray near a cop), `missile:hit` {car}, `cop:chase` {active}, `foot:start`/`foot:end`,
`parking:result` {stars, coins}, `avigail:rel` {rel}, `stat` {id, n} (use the 2D quest/stat ids from
`src/06b-quests.js` when one fits — grep `questAdd("` in the 2D fragment you are porting).

**Out of hearts (`hooks.wreck`) priorities:** law **30** (claims only when a cop/cop car caused
the wreck → arrest), cameos **10** (claims every other wreck and plays the 2D crash aftermath: the
angry man / Hillel the adjuster / animal swarm…, then sends Lulu to the ER (~35%), lets her walk
on (`ctx.foot.start("crashReprieve")`, rare), or game over via `setState("gameover", {quote})`).

**Title menu orders:** story 10 · cruise 20 · shop 30 · Dina 35 · parking challenge 40 ·
scrapbook 50 · quests 55 · Shared Road 60 · car 70 · controls 80 · settings 85 · 2D 99.

**Hair:** the salon (cameos) adds styles with `car.addHairStyle(style, obj)` and registers
`luluPerson_<style>` models for on-foot Lulu; foot uses `models["luluPerson_" + style] || models.luluPerson`.
