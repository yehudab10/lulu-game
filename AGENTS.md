# AGENTS.md — start here (any AI coding agent)

This file is for **every** AI agent working on this repo — Codex, Gemini, Cursor,
Copilot, Claude, anything. Several different agents (and accounts) take turns on
this project, so **this file + the docs it points to are the shared memory**.
Read it fully before touching anything, and **update the "In-flight work" table
below when you start, pause, or finish something.**

Read in this order:
1. **This file** — the owner, the rules, how work is organised, what's in flight.
2. **`CLAUDE.md`** — the project's dev notes. Despite the name, it applies to *all*
   agents: layout, build, deploy, tests, the 2D fragment map, the 3D overview.
3. **`3d/ARCHITECTURE.md`** — how the 3D game (the real game) is built: the core,
   `ctx`, the feature modules, the party (multiplayer) parity table, towns.
4. Then the feature you're touching: `3d/js/features/<id>/` and its test
   `scripts/tests3d/<id>.js`.

---

## 1. The project in one minute

**Lulu's Road Trip** — a browser game live at **https://lulu.boats** (GitHub
Pages from `main`), also shipped as an iOS app (Capacitor; Codemagic builds a
TestFlight build on every push to `main`).

- **2.0 = the 3D game in `3d/`** (three.js r170 vendored, plain ES modules, no
  build step, no framework). All new work goes here.
- **Classic 2D** (`classic.html` + `game.js`, generated from `src/`) is legacy:
  fix bugs only, never add features. `game.js` is generated — edit `src/`, run
  `node build.js`.
- Lulu (18) and her little sister Dina (8) — a frum Jewish family comedy:
  Lakewood, Midwood (Brooklyn), the highway, Bubbe's house, cholent, Shabbos,
  Chaverim/Shomrim/Hatzalah. These references are intentional and welcome.

## 2. The owner (adjust how you talk)

- **Not a coder.** Explain results in plain English: what changed for the
  player, what's live, what's left. No jargon, no code dumps.
- They test by playing on lulu.boats (phone, desktop, PS5 controller) and report
  bugs in casual messages. Reproduce before fixing.
- **Tone rules:** colourful low-poly cartoon, wholesome + silly. **Cartoon-only
  violence** (decided by the owner): robbers wave banana "guns", water pistols,
  confetti blasters; cops use stun nets and spike strips; nobody is ever shot, no
  blood, nobody hurt beyond the game's knock-down / lose-a-heart rules. Keeps the
  App Store **12+** rating. Dina's mode is strictly PG and never scary.

## 2b. Where the game is going (the owner's roadmap — agreed 2026-11-19)

**One line:** a small, dense, funny town-and-road world that you LIVE in, alone or with friends — "less a driving
game, more an open world; a weird mixture of Roblox and Fortnite; everything flows". Not a bigger map: a more
continuous one, where the car is something you use rather than the whole game. Every new piece is judged against that.

| # | step | branch |
|---|---|---|
| 1 | **One continuous world** — towns joined to the highway (no cut), buildings you walk into without a loading screen, fields you can wander into | `ci/oneworld` |
| 2 | **Start at home, on foot** — she walks out of her front door, the pink car is in the driveway (today the game opens with her already driving) | `ci/home` |
| 3 | **No more "game over"** — knocked out = back on her feet at home / outside the hospital within a couple of seconds; no wall of cards, no countdown | `ci/home` |
| 4 | **Jail, court and the ER are real places in town** — a precinct, a courthouse, a hospital she can walk past, be taken to and walk out of; the comedy stays, in the world, skippable | after 1 + 3 |
| 5 | **Movement that's fun on its own** — a jump, a free-look camera, the roll / slide / vault moves made central | `ci/seasons` | 🕎 A WORLD THAT FOLLOWS THE REAL CALENDAR (roadmap 8) — a new `features/seasons` that reads today's Hebrew date (device `Intl`, the party's date in a party) and dresses the world: Chanukah menorahs in the windows (+1 candle a night) + doughnut stands, a Purim costume parade + mishloach manos, sukkahs going up before Sukkos, Pesach clean-up at the kerb, Lag BaOmer bonfires, Shavuos flowers, quiet fast days / Nine Days, Friday bustle + Shabbos candles after dark; a 📱 calendar note, one small capped thing to collect; preview `?season=chanukah&night=5` | **being worked on now (started 2026-11-19, night)** — owns `features/seasons/**`, `blender/assets_seasons.py`, `assets/seasons_*.glb`, `scripts/tests3d/seasons.js`. Hooks only (chunk:build, town:enter / leave, ctx.town / ctx.homes public surface, ctx.atmos); Chanukah first (nearest), then Purim, Sukkos, the rest |
| `ci/move` |
| 6 | **A reason to play each day** — "a day in Lulu's life": Ima's errands, a job or two, something silly in town, as markers in the world (not menus), ending back at home | after 2 |
| 7 | **The town as a hangout** — Free Roam with friends as the normal way to play, emotes, the party games started from spots in the world | `ci/hangout` |
| 8 | **A world that follows the real calendar** — Chanukah lights across town, a Purim parade, sukkahs before Sukkos… (the device's Hebrew calendar) | `ci/seasons` |
| 9 | **Somewhere for coins to go** — decorating Lulu's room / house, on top of cars and outfits | after 2 |

**Deliberately NOT:** shooting / battle royale (tone + the 12+ rating — the cartoon chase humour is the strength);
player-built worlds; a huge empty map (two rich towns and the road between them beat ten thin ones, and phones stay fast).
The flow rules every step follows are in `3d/ARCHITECTURE.md` › Flow (no hard cuts, no blinking, no countdown after a
scene, nothing built in one long frame). `ci/flow` step 1 already landed those tools.

## 3. Golden rules

1. **Finished work goes straight to `main`** (that's how the site updates — the
   owner's standing instruction; don't wait for approval). Unfinished work goes
   on a **`ci/<name>` branch** — push it often (see §5).
2. Before every push to `main`: `node build.js --check` and
   `node scripts/copy-web.js` (it fails if the iOS bundle would miss a file the 3D
   game references). Run the tests for what you touched (§4).
3. **Never deploy or modify the multiplayer relay server (`server/`,
   `.github/workflows/deploy-shared-road.yml`) without asking the owner first.**
4. Never change the iOS bundle id, signing, AdMob IDs, or
   `submit_to_app_store` in `codemagic.yaml`. Ad unit IDs in
   `3d/js/features/native/ads.js` and `src/10c-ads.js` must stay identical.
5. **Coin economy:** no repeatable free-coin sources (the owner already had to
   kill tip/busk/pet farming). Rewards are capped or once-per-run.
6. **Party mode** (🎉 multiplayer): everything a solo drive has should work in a
   party except Story mode (`journey`) and Dina's mode (`dina`). Personal things
   (your cops, your scenes) must never desync shared traffic or freeze friends;
   shared things are seeded from the party seed/clock. Keep the **Party parity
   table** in `3d/ARCHITECTURE.md` current.
7. New 3D models come from `3d/blender/assets_<id>.py` (`3d/blender/make_assets.py
   --only <id>`); commit the regenerated `.glb` + `.blend` with the script.
8. No secrets in commits. Don't put AI model names in commit messages or code.
   Don't open pull requests unless the owner asks.
9. When you add a feature: register it in `3d/js/features/index.js`, add a row
   to `3d/ARCHITECTURE.md` (+ party parity row), add it to the feature list in
   `CLAUDE.md`, and add `scripts/tests3d/<id>.js`.

## 4. Setup and tests

```bash
node build.js --check                 # 2D game.js in sync with src/
node scripts/copy-web.js              # stage www/ for iOS + check every 3D file reference
npm run serve                         # local server on :8099 → /3d/
npm run smoke                         # classic 2D smoke test (needs playwright)
SMOKE3D_ONLY=core,platform,law npm run smoke:3d   # 3D tests (needs playwright)
```

- Tests need Node 22 + `playwright` (`npm i -g playwright@1.56.1 && npx playwright install chromium`,
  or `NODE_PATH` pointing at an install). They boot the game in headless Chromium
  with a fake controller.
- 3D tests run in **software WebGL and are slow** (the full suite is ~2 h on one
  machine). Don't run everything locally — use CI:
- **CI (GitHub Actions):**
  - `smoke.yml` runs on every push (2D smoke + `core,platform,skip,ux`).
  - **"3D full suite"** (`smoke3d-full.yml`, manual) splits test files across up
    to 16 machines (~45 min). Inputs: `only` (comma list) or `groups`
    (`;`-separated groups, each on its own machine). Works on any branch:
    ```bash
    git push origin HEAD:ci/<name>
    gh workflow run smoke3d-full.yml --ref ci/<name> -f groups="core,platform,skip,ux;law;town"
    gh run list --workflow smoke3d-full.yml --branch ci/<name> --limit 1
    gh run view <run-id> --log-failed
    ```
    (Or GitHub → Actions → "3D full suite" → Run workflow.) Screenshots are
    uploaded as artifacts.
- Minimum before pushing a 3D change: `core,platform,skip,ux` + the test files of
  every feature you touched. Some tests are timing-sensitive on slow runners —
  if one fails, re-run it once before assuming you broke it, and check whether it
  also fails on `main`.

## 5. How work is organised

- **One feature = one `ci/<name>` branch**, branched from `main`.
- **Push after every commit** and commit work-in-progress at least every ~30 min
  with a message saying *what's done and what's left* — another agent may have to
  take over mid-task when one runs out of usage.
- **Before picking up an in-flight branch**, check its last commit time
  (`git log -1 --format=%cr origin/ci/<name>`). If it moved in the last hour,
  someone may still be on it — pick something else or coordinate via this file.
- **Landing a branch on `main`:** merge the latest `origin/main` into it, resolve
  conflicts keeping both sides (every import line in `features/index.js`, every
  doc/parity row, the party `OFF` set = the union minus what's been turned on),
  run CI on the merged head, then fast-forward `main` to it. Then update the
  table below.

## 6. In-flight work (update me!)

_Last updated 2026-11-19 (night). `ci/heist` is LANDED on `main` (🏦 banks, robberies to foil, Lulu's own heist,
snatchers, nets + spike strips — see `3d/ARCHITECTURE.md` › Banks, heists & robberies). `ci/townfix` is LANDED (🏘️ cars in town drawn by line of sight, solid + shove-able + hotwirable parked cars, town drivers jackable in solo, a real interchange: taper, decel lane, curved ramp + guardrails, a T-junction with a STOP sign, gas station and "Welcome to" sign, an on-ramp + accel lane; nothing stands on any lane — `world.offLanes`). `ci/party2` is LANDED too (🎉 claim shared cars so carjacking / ✋ flag-down / 🚕 hop-in work with friends; streets, rides, rest areas and the towns' extras are on in a party — ARCHITECTURE › the party parity table). `ci/homes` is LANDED (🏠 living towns — an instanced crowd on every sidewalk, porches, lawns, e-bikes, porch lights — and every front door a ✋ spot: knock, try the door or sneak in a window; view cones + the "?"→"!" meter, household items with cartoon reactions, couch coins capped at 30 a run, BURGLARY + the call-in, families remember her — ARCHITECTURE › Homes). `ci/underworld` is LANDED (😈 the crooked cop's Kugel Fund + Internal Affairs stings, Velvel's no-questions garage, the Fixer's jobs + heat, road-ragers / gang cars / pickpockets — every knob is `SPAWN` in `features/underworld/data.js`; off in a party until `ci/party3` gets to it). `ci/flow` step 1 is LANDED (🌊 the owner's new direction — fewer hard cuts, less stutter, a more open world: the camera glides instead of cutting, Lulu hops into the seat, soft cuts for town exits and warps, no 3-2-1 after a scene, music crossfades; its row lists what's next). Nobody is working on the
branches below right now — pick one up. Each is based on an older `main`: merge `origin/main` into it first
(`features/index.js`, the ARCHITECTURE tables and the party `OFF` set will conflict with heist's rows — keep both)._

| branch | what it is | where it stopped / what's left |
|---|---|---|
| `ci/hangout` | 🎉 THE TOWN AS A HANGOUT (roadmap 7) — Free Roam with friends as the normal way to play (join a link/code → straight next to your friend, late joiners just appear, one-tap leave), emotes friends see on your puppet (wave / dance / cheer / point / facepalm / mazel tov) + quick chat on foot, party games started from spots in each town (a notice board / arcade cabinet), greetings when you pass a friend | **being worked on now (started 2026-11-19, night)** — owns features/party, openworld, multiplayer + the emote / social layer. Lands piece by piece: emotes → join flow → game spots. Emote button: asks `ci/move` for a free slot / hold-for-wheel; joiner placement: decided with `ci/home` here. Don't pick it up while its last commit is < 1 h old |
| `ci/oneworld` | 🌍 ONE WORLD — the towns attached to the highway: drive down the exit ramp into Lakewood / Midwood with no cut (and back out the same way); the town built in slices ahead of time as she nears the exit | **being worked on now (started 2026-11-19, night)** — staged: (1) town placed at the interchange + visible from the ramp, (2) sliced build ahead of time, (3) no swap / no cut, (4) leaving, on foot, Free Roam warps + late joiners. Don't pick it up while its last commit is < 1 h old |
| `ci/home` | 🏠 START AT HOME + NO MORE GAME OVER (roadmap 2 + 3, then 6) — a run opens with Lulu on foot at her front door (Ima at the door, the pink car in the driveway, hop in = the run starts); out of hearts = back on her feet in a couple of seconds with a funny line and a small cost, no card, no countdown; then "a day in Lulu's life" | **being worked on now (started 2026-11-19, night)** — owns features/world/home.js + depart.js, the start / wreck / game-over flow in core/driving.js + core/screens.js, cameos' crash → aftermath → ER chain, foot's start / knock-out reasons. Don't pick it up while its last commit is < 1 h old |
| `ci/move` | 🤸 MOVEMENT THAT'S FUN ON ITS OWN (roadmap step 5) — a jump on foot (real height, gravity, landing, hop kerbs / low fences / hedges / benches / bonnets, chains into roll / slide / vault + the style combo) and a FREE-LOOK camera that stays where the player puts it (right stick / mouse / right-half drag), movement relative to the camera, moves made central (prompts, feedback) | **being worked on now (started 2026-11-19, night)** — owns foot's `walk()` / movement, features/moves' on-foot moves, `core/input.js` + the button map + the touch-button layout, the look controls in `core/camera.js`. `ci/hangout`: the emote slot on foot will be noted here once the button map is settled |
| `ci/flow` | 🌊 Flow + open world — the owner's direction for the game: "less a driving game, more an open world (a mix of Roblox and Fortnite) — everything flows, fewer hard transitions, less choppy". **LANDED so far** (see `3d/ARCHITECTURE.md` › Flow; test `flow`): `ctx.cam.blend`, `ctx.dissolve` (towns, warps, warmed interiors), the hop-in, rolling starts, the music crossfade, no courtesy-shield blink, road chunks built in slices (`Chunk.advance`), shaders compiled when a model loads | **Next steps, none started — pick one, re-start the branch from `main`:** (a) more stutter: split the two biggest chunk steps (scenery placement ≤ 5 ms, the bake ≤ 7 ms here; × 3–4 on a phone), warm a SET's shaders before it shows (each `makeSet` has its own lights: interiors, jail, court, ER compile on first show), an idle model preloader, town people / e-bikes (~20 draw calls each — gfx's note); (b) the remaining hard cuts: jail / court / ER sets, the wreck chain (2.6 s + all traffic deleted + a card), parking's white flash; (c) ONE WORLD: towns attached to the highway (today a town is a grid at a far origin, entered by a soft cut at the ramp's STOP sign), walking into shops without a set, fields you can wander into (the world is a ±50–70 m ribbon); (d) play like an open-world game: start on foot at home / in town, a jump + free-look, a quick respawn instead of game-over cards, Free Roam as the default. The owner was asked two taste questions (start on foot in a hub? keep jail / court / ER as full scenes or make them optional detours?) — check the chat / ask before (d) |
| `ci/party3` | 🎉 Party round 3 — **LANDED 2026-11-19 ~07:50** for what was on `main`: heist (personal bits) and underworld (the pickpocket only) are on with friends; each feature's parity row says what the rest would need. Nobody is on it now | **Left (pick it up any time):** nothing for `homes` — it landed already ON with friends (never in the `OFF` set: the crowd is seeded in a 🌍 Free Roam town, a house is personal, presence "🏠 in the …s' house"; its parity row + the party section of `homes.js` cover it). Robberies / bad-guy cars / roadside stops need the shared road plan — bigger jobs |

`ci/gfx` is **LANDED** (2026-11-19 ~12:10 UTC, on top of everything above incl. homes + flow step 1): ⚙️ Settings → 🖼️ Graphics AUTO / HIGH /
MEDIUM / LOW, merged roadside scenery + far-car LODs (~25–40 % fewer draw calls on the highway), road-sign textures freed with their
chunks, contact shadows, wind sway, sky reflections, bloom on HIGH; before/after numbers + screenshots in `3d/docs/gfx-perf.md`,
the tiers in `3d/ARCHITECTURE.md` › Graphics & performance. Measure any perf change with `node scripts/perf3d.js`.

Branches not listed (`ci/gfx`, `ci/heist`, `ci/underworld`, `ci/townfix`, `ci/party2`, `ci/uwdiag` (a throwaway test-diagnostics branch that could not be deleted from a cloud session — never merge it), `ci/copheat`, `ci/exits`, `ci/partyfoot`, …) are already
merged — ignore them.

## 7. Backlog / known rough edges (good next tasks)

- Cops: the red "not hidden" toast can linger after she reaches a real hiding
  spot (`core/hud.js` has no toast dismiss); a call-in cruiser in town still
  routes straight to her; bailing out mid-chase files a permanent warrant (2★ on
  later chases until court) — maybe too harsh.
- Heist: in a party only its personal bits are on (robberies + her own bank job would need a road-plan slot, a host-validated foil and a co-op lobby activity — see the parity table); robberies that start while she WALKS are capped at 2 a run
  (`TUNE.robbery.footMax` — the tackle is the easy foil, keep it capped); the highway Quik-Mart robbery has no on-foot
  version; tests that drive with no steering must keep distances short (a bend carries the car out of its lane —
  that was the `heist` spike-strip flake).
- Exits: the interchange's far end (gas station, houses) is just scenery — you can't drive the cross roads, the town
  fades in at the STOP sign; rest-area props sit slightly off on tight bends; Kugel the dog bobs on a loop;
  rest areas aren't on the 🗺️ map; no test drives a rest area in Story mode.
- Towns (from `ci/townfix`): a parked car she shoves stays where it slid for the visit (no tow); hotwiring a town
  parked car in a 🎉 party removes it only from her own kerb (friends still see it parked); test traps — the
  exits lane scans must refine `nearest()`'s hint (it only searches ±120 m round it), and a cruiser dropped onto a
  town street can land on a town driver (a 💥 cop pile-up: it sits there) — clear the spot first (`town` test does).
- Homes (landed 2026-11-19): after she jumps out a window the camera can sit inside a yard bush for a moment; the shop
  avenues look quiet from the car (the ~100-strong crowd lives mostly on the residential blocks); the cholent heals a
  heart once per house per run — with ~200 doors that is near-unlimited hearts for a determined burglar (coins are capped
  at 30 a run, hearts aren't — maybe cap it); the crowd's own GPU cost is `ctx.homes.crowd().calls / .tris` (≈ 1–25 draw
  calls, < 40 budget) — compare that, not the town's off → on totals (they swing with the minivans driving in and out of
  view). Heist's bank keeps her in town for the town's own interiors only (`TOWN_INTERIORS` in `heist/bank.js`: bank +
  home) — a new in-town interior must be added there or the town unloads behind her. Court charge lines are first-match
  priority: BURGLARY sits right under BANK HEIST.
- Party (round 2 landed 2026-11-19): our-direction traffic only exists AHEAD of the start wave (nothing of ours sits
  behind the grid at GO, and that wave rolls up the road at lane speed): she's always ahead of it while driving, but
  someone who dawdles near the start, or walks for minutes, can end up behind it — then only ONCOMING cars come by to
  flag down / step in front of (fix: let the forward lanes refill a gap behind the wave; a traffic change = every
  screen must update together). Flagging down an oncoming car leaves her driving the wrong way on the far shoulder.
  The moped snatcher's +15 catch bonus repeats every few minutes she sits still (solo too) — maybe cap it a run.
  No quick chat on foot; a long main-thread stall (loading a
  building on a slow phone) can hand hosting to someone else (4 s rule).
- Underworld: off in a party; a pull-over has law's own 10 % "walk" outcome BEFORE the Kugel Fund offer (tests pin
  `ctx.law._dbg.FORCE.bustOutcome`); urgent on-foot actions (tackles, the purse clutch, the car-thief yank) are
  `ctx.foot.addSpot({ first: true })` so a door / a car in reach can't steal the ✋ button — use it for any new one.
- Party tests (partyplus): on this repo's 4-core cloud container two game pages crawl (~0.1 game-s per real s), and
  the ✋ FLAG IT DOWN press sometimes doesn't take there although the prompt shows (calling the spot's act() directly
  works; on CI it passes) — not reproduced on a real device; worth a look if a player says flagging "does nothing".
- `shabbos` "tv-1080: the card fits" fails on CI (seen on `ci/gfx` twice and on `ci/flow` twice) and passes in the cloud
  container — a DOM-layout check that depends on the runner's fonts; nobody has looked at whether the card really
  overflows on a 1080p TV. `exits` takes ~1 h on a CI runner (1280×720 in software WebGL): give it its own group.
- Party tests wait in REAL time (`hostUntil` / `until` in `partyfoot.js`, `party.js`): a 2–3 page CI runner can drop to
  ~1 fps, and then a 6 s scene takes minutes ("bailed out… timed out in lawExit", "race results… timed out in
  partyWait", missing host buttons after a > 4 s stall hands hosting over). Same code failed twice then passed — re-run
  before blaming your change; better: move those waits to frames.
- Party tests: `partyworld` and `party` ("dash: claims settled") occasionally fail
  on slow CI runners because of the random party seed — re-run once.
- Graphics (from `ci/gfx`, landed 2026-11-19): AUTO's first guess comes from the GPU's name (`core/quality.js`
  `guessTier`) — never tried on a real phone yet: worth a look on the owner's iPhone (⚙️ Settings → 🖼️ Graphics shows
  "AUTO · MEDIUM"). MEDIUM's sky reflections (car paint, the wet road) cost ~5 % frame time in software GL; if a phone
  feels slow, make them HIGH-only. Far traffic cars (`lod.js`) cache their merged far copy per model + paint: a
  feature that REPAINTS a traffic car after it was far away keeps the old colour beyond ~55 m (none does today).
  Town e-bike riders / people are ~20 draw calls each — the next big draw-call win (a far LOD or instancing).
  On LOW, flow's dissolve snapshot frame renders without LOW's pulled-in fog (one frozen frame).
  Bloom is OFF in `?test` runs unless the URL has `&enable=bloom` (only `gfx` / `perf` do) — it nearly doubles
  software-GL frame time. Measure with `node scripts/perf3d.js` (numbers: `3d/docs/gfx-perf.md`).
- `multiplayer` (the Shared Road relay test) has real-time checks that flaked on CI during gfx's runs — "2D player's ghost
  shows ~26 m ahead" / "di = s × 56000/4800" (a 1.5 s `peer.pump`) and "🏆 winner banner"; each passed on other runs of
  the same code. `party`'s BONK / race-results steps likewise. Re-run once before blaming a change.
- iOS: classic 2D letterboxes in landscape; the "Groceries" chip touches the
  speedometer for ~8 s in iPhone portrait; photo saving uses the share sheet
  (unverified on a real device).

## 8. Owner-only to-dos (agents can't do these — remind the owner if relevant)

- App Store Connect for **2.0**: set the version to 2.0, new iPhone + iPad
  screenshots (landscape now works), refresh the description/promo text/review
  notes (`STORE_LISTING.md` still describes the 1.0 2D app), re-record the ATT
  prompt screen capture, then submit the TestFlight build for review.

## 9. When you finish a session

1. Push your branch (or land it on `main` if it's done and green).
2. Update §6 (and §7 if you found new rough edges) in this file — commit that to
   `main` too, so the next agent sees it.
3. Tell the owner, in plain English, what's live and what's left.
