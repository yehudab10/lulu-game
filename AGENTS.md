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
| 5 | **Movement that's fun on its own** — a jump, a free-look camera, the roll / slide / vault moves made central | `ci/move` |
| 6 | **A reason to play each day** — "a day in Lulu's life": Ima's errands, a job or two, something silly in town, as markers in the world (not menus), ending back at home | after 2 |
| 7 | **The town as a hangout** — Free Roam with friends as the normal way to play, emotes, the party games started from spots in the world | `ci/hangout` |
| 8 | **A world that follows the real calendar** — Chanukah lights across town, a Purim parade, sukkahs before Sukkos… (the device's Hebrew calendar) | `ci/seasons` |
| 9 | **Somewhere for coins to go** — decorating Lulu's room / house, on top of cars and outfits | after 2 |
| 10 | **One game, not a menu of modes** (owner, 2026-11-20: "too many modes is too confusing… the main thing should be the open world") — the title has ONE big ▶ PLAY (the open world, starting at home on foot) plus two small tiles (👯 Friends, 👧 Dina). Story Trip, the Parking Challenge and the Erev Shabbos Rush stop being title modes: you start them from INSIDE the world (the suitcase by the car / the phone's map, a booth at a lot, Ima at the door on a Friday) and they end back in the world | `ci/onegame` |
| 11 | **Everyone in the same world** (owner: "maybe even open world with everyone playing") — PLAY is online by default: other players who are on right now are simply there (drop-in, no lobby), friends are a private group inside it (invite link). Safe by design: preset emotes only, strangers can't hurt / drag / spam you, one switch turns it off, never in Dina's mode. Existing relay protocol ONLY — a server change needs the owner's OK first (golden rule 3) | `ci/calm` | 🧘 A CALM SCREEN (the owner, 2026-11-20: "lesser pop ups also especially in party mode") — one pop-up BUDGET in `hud.js` (toast priorities: must-see / normal / flavour; one toast at a time on a phone; flavour toasts dropped, never queued, when one is up, when she's busy or too soon after the last; much rarer with friends or strangers around; the answer to a button she pressed always shows) + `bubbleOk()` for speech bubbles over other people; `features/calm` tells it when it's quiet / busy and makes Lulu's chatter Quiet by default in a party; strangers never pop up anything (their records live in 📍 Nearby). Test `calm` (pop-ups per minute in 4 situations). Started 2026-11-20 | **LANDED 2026-11-20** — pop-ups a minute on a phone (one random minute each, before → after): solo highway 25 (3 toasts at once) → 16 (1); on foot in a town 17 → 8; two friends in town + strangers 21 (5 at once, strangers' record pop-ups) → 7 (1); online with strangers 14 (stranger records) → 5 (1). Lulu's lines a little rarer (her on-foot remarks were every 4–7 s whatever the setting — now ⚙️ chatter), town gossip texts ≥ 30 s apart. Also: a `?test` page never connects to the real relay (party + Shared Road need `&mpurl=`). Left: see §7 › Calm |
| `ci/everyone` | 🌐 EVERYONE IN THE SAME WORLD (roadmap 11) — online by default with whoever is playing, friends as a private group inside it; owns `features/multiplayer`, `features/party`, `features/openworld` networking and the 👯 Friends hub. No relay-server change without the owner. Started 2026-11-20 | **Stages 1 + 2 LANDED 2026-11-20** — out in the world she joins the EVERYONE room by herself (sharded `lobby`…`lobby8` client-side when one is full; ⚙️ Settings › 🌐 Play online + the phone's 👯 "Go solo"; Dina's mode offline; an unreachable relay = silent solo). Strangers: see-through ghosts labelled colour + number (never a name they sent), no collision, can't start races / tag / the lot on your screen, emote / honk / record floods dropped on the receiving side, every field validated. 3D riders publish `d.w` (zone + place) so they show in towns and on foot; the nearest 6 are drawn, each ghost car ONE merged mesh (~58 → ~2 draw calls). The title item is **👯 Friends** (invite · code · 🎮 Party games = the lobby · Play online · 🕹️ Classic 2D friends + who's around); a party keeps EVERYONE in 🌍 Free Roam (friends = real cars with names, drawn once via `d.pt`; strangers stay ghosts), lobby activities hide strangers. Test `mpworld`. **Left:** see §7 › Everyone |

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
4b. **Ads (iOS app) never cost the player a moment** (owner, 2026-11-20): an occasional full-screen ad after a
   knock-out, and one during a jail stay, is fine — but while an ad is up the game is fully PAUSED (game time, cutscene
   scripts, timers, traffic, music) and picks up exactly where it was; an ad never starts during a cutscene or a
   dialogue, never while driving, never in a party, never in Dina's mode.
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
  - `smoke.yml` runs on every push (2D smoke + `core,platform,skip,ux,music`).
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

_Last updated 2026-11-20 (`ci/everyone` stages 1 + 2 landed). Before that 2026-11-19 (night). `ci/heist` is LANDED on `main` (🏦 banks, robberies to foil, Lulu's own heist,
snatchers, nets + spike strips — see `3d/ARCHITECTURE.md` › Banks, heists & robberies). `ci/townfix` is LANDED (🏘️ cars in town drawn by line of sight, solid + shove-able + hotwirable parked cars, town drivers jackable in solo, a real interchange: taper, decel lane, curved ramp + guardrails, a T-junction with a STOP sign, gas station and "Welcome to" sign, an on-ramp + accel lane; nothing stands on any lane — `world.offLanes`). `ci/party2` is LANDED too (🎉 claim shared cars so carjacking / ✋ flag-down / 🚕 hop-in work with friends; streets, rides, rest areas and the towns' extras are on in a party — ARCHITECTURE › the party parity table). `ci/homes` is LANDED (🏠 living towns — an instanced crowd on every sidewalk, porches, lawns, e-bikes, porch lights — and every front door a ✋ spot: knock, try the door or sneak in a window; view cones + the "?"→"!" meter, household items with cartoon reactions, couch coins capped at 30 a run, BURGLARY + the call-in, families remember her — ARCHITECTURE › Homes). `ci/underworld` is LANDED (😈 the crooked cop's Kugel Fund + Internal Affairs stings, Velvel's no-questions garage, the Fixer's jobs + heat, road-ragers / gang cars / pickpockets — every knob is `SPAWN` in `features/underworld/data.js`; off in a party until `ci/party3` gets to it). `ci/flow` step 1 is LANDED (🌊 the owner's new direction — fewer hard cuts, less stutter, a more open world: the camera glides instead of cutting, Lulu hops into the seat, soft cuts for town exits and warps, no 3-2-1 after a scene, music crossfades; its row lists what's next). Nobody is working on the
branches below right now — pick one up. Each is based on an older `main`: merge `origin/main` into it first
(`features/index.js`, the ARCHITECTURE tables and the party `OFF` set will conflict with heist's rows — keep both)._

| branch | what it is | where it stopped / what's left |
|---|---|---|
| `ci/together` | 👯 FRIENDS INDOORS + FINDING FRIENDS (owner, 2026-11-20: "in party mode friends should be able to go to the same house and both be visible to each other. We also need some sort of way for finding friends in the map — need to be clean") — `features/together`. Started 2026-11-20. | **Stages 1 + 2 + D LANDED 2026-11-20.** (1) THE FRIEND FINDER: in a party's 🌍 Free Roam the 📱 🗺️ Map (the story map's slot) shows each friend as a dot (a town's streets from above / the highway as a strip) + a row; tap = a destination (one beam over them, their pointer ringed with the distance, clears when you meet); ≤ 3 quiet edge pointers (top = ahead, sides = beside / behind, fade when they're on screen and close, clear of every HUD bit / touch button), at the DOOR when a friend is inside ("in the Friedmans' house"), at the EXIT when they're in another town / on the highway; 🧭 Friend pointers switch (the map; ⚙️ Settings while in a party). (2) FRIENDS IN THE SAME BUILDING: one layer over the interiors engine (`d.x.in`): two friends in the same house / Lulu's house / the roadside bar, school, hospital, precinct, beach, the town's precinct / courthouse / hospital lobbies (ci/places — opened in Free Roam) see each other walk, sit, crouch, emote (the wheel works inside), with nametags; in and out through the door; outside you see a friend step in through the door. Houses: the door menu offers 👯 Join <friend> inside; each player's own residents / stealth / loot / law. Lulu's house: GO INSIDE works in Free Roam — the first one in hosts, the others see THEIR decorations (`d.x.dc`); no decorating / buying with friends. Strangers never inside; nothing pays or costs coins. **Part D — IN THE SAME CAR** (owner: "We should also be able to get into the same car together"): on foot by a friend's stopped / crawling car, ✋ "🚗 HOP IN with <name>" at the PASSENGER door (never the driver's); one seat ("💺 seat's taken"); her own car always comes along, so hop out slow = on her feet with her car parked right there, moving = back in her own car alongside; the driver can't trap her (parks / walks off / goes inside = she's let out), she can't drive for them, never ticketed for their driving; Free Roam only, not mid-game. Test `together` (two pages). **Left:** the bank stays shut in a party (the heist); a pizza shop / shops you can walk into don't exist yet (no interior); back seats (a second / third friend in one car — needs an anchor per seat in the car models); see §7 › Together |
| `ci/places` | 🏥 JAIL, COURT AND THE ER ARE REAL PLACES IN TOWN (roadmap 4; owner 2026-11-20: "add the precinct and hospitals in town so she can walk out of there as well") — `features/places` (`ctx.civic`) + models `assets_places.py`; see `3d/ARCHITECTURE.md` › Places | **LANDED 2026-11-20** (after `ci/oneworld`). Nobody on it now. In each town: a police precinct (+ an IMPOUND LOT) and a courthouse sharing one block face (Lakewood: Minivan Way behind the Simcha Palace · Midwood: Avenue K, green lamps) + a hospital (St. Shloimy's on Route 9 · Midwood General on Avenue L) — town `uses.civic` / `uses.hospital`, merged (~0 draw calls, ~3k triangles a town, replacing ~6 houses; POLICE / AMBULANCE ONLY kerbs via `clearParking`), on 📍 Nearby. Walk in freely (✋ at each door → interiors' police / hospital + a new courthouse LOBBY; lines only). Arrested IN a town → the arrest plays there → a cruiser pulls up at THAT precinct (`placesArrive`) → booking / cell / court (the same sets, skippable) → she walks out of the precinct / courthouse door on foot, her car at the kerb out front if it's hers and intact, else behind the impound fence (it comes back as before: next run / knock-out). Arrested on the highway (solo Cruise) → the nearest interchange's town, built in slices while she's in the cell. The ER (a knock-out's, now also on foot in a town) → that town's hospital, out of ITS door. A 🎉 party / Story / the Shabbos run keep the old highway flow for highway arrests. No rule or amount changed. Test `places` (`PLACES_PART=3` = the arrests / court / ER part). Small additions in others' files: town `build.js` (a `with` entry can be a landmark; the spot stands at `Anchor_door`), town `index.js` (`prebuild`, `placeOf`, `load` of `with` models), law (arrest / jail / court / service: `claim`, `goExit`, `walkOutOf`), cameos/er.js (`claim`, `dischargeToTown`), foot `erChance`, heist/bank.js `TOWN_INTERIORS`, openworld `SPOT_NAMES` |
| `ci/calm` | 🤫 FEWER POP-UPS (owner: "Lesser pop ups also especially in party mode") — a pop-up budget in the HUD layer (one at a time on phones, low-priority ones dropped), strangers never toast, friends' chatter as bubbles; measured per minute before/after. Started 2026-11-20. |
| `ci/calls` | 📞 SHE CAN ALWAYS MAKE A CALL (owner 2026-11-20, on an iPhone: "I couldn't find the phone call options when in midwood or the highway?") — the 📞 Phone app on the phone everywhere; Midwood's volunteer orgs; help that shows up on the highway + at rest areas. Started 2026-11-20. | **LANDED on main 2026-11-20** — `features/community`: the app is **📞 Phone** (id `community`, order 22: right after 💬 Messages), always on the phone (highway, rest areas, both towns, car + foot); contacts Chaverim · Hatzalah · Shomrim · 911 · 👩 Ima (a sweater, no reward) · 🏡 Family & places (world's old app, now `ctx.community.addContact` — the phone stays 9 apps); a contact with nothing to call about says one line (`ctx.community.nothing(org)`). Help on the highway (from behind; in the car once stopped — at speed the call card says pull over; on foot to where SHE stands), across a rest area's lot. Midwood: `towns.js` entry, all three orgs, **0 cruisers** (its budget: one org car in view = +~17 calls / +~1.8k tris), Brooklyn lines (`FLAVOR` + `local()`). Caps: ❤️ from the volunteers 3 a run, 60 s apart (`help.js HEAL`); Chaverim nitro every 90 s. Test `calls`. **Left:** a Midwood Bais Yaakov-style local gag (Brooklyn has its own), Ima's call could pick up today's 📝 list (`ctx.day`) one day. |
| `ci/places` | 🏥 JAIL, COURT AND THE ER ARE REAL PLACES IN TOWN (roadmap 4; owner 2026-11-20: "add the precinct and hospitals in town so she can walk out of there as well") — a precinct, a courthouse and a hospital as buildings in Lakewood and Midwood: she can walk past them, is TAKEN to them (arrest → the precinct; a knock-out's ER moment → the hospital) and WALKS OUT of their front doors into the street; the comedy stays, in the world, skippable. Builds on `ci/oneworld`'s attached towns (a block-face `uses` entry in `towns/<id>.js` + `build.js` › `layoutFace`). Started 2026-11-20. |
| `ci/qa` | 🔎 PLAY-TEST SWEEP (owner, 2026-11-20: "I'm noticing glitches. Especially with walking… find and fix other issues") — plays the real flows (home start → highway → a town → out of the car → doors → back in → knock-outs → jail…) with every feature on and a per-frame watchdog (teleports, a black overlay left up, the camera inside a wall, a hidden Lulu, a stuck state), fixes what it finds with small targeted changes, leaves the watchdog as a test. Does NOT restructure towns (`ci/oneworld`), the title (`ci/onegame`) or networking (`ci/everyone`). Started 2026-11-20. **Batch 1 LANDED 2026-11-20** (see §7 › QA sweep): the free camera on foot keeps out of walls (`foot/jump.js` `camClip` → `ctx.cam.orbit({ clip })`), no 15 m yank getting out past the field fence, the climb-out shot clear of houses, no camera jump as she starts walking, `cam.snap()` ends a running glide, a cop car's 🚨 PULL OVER plays in town (`TOWN_OK` had a typo'd state), arrested on foot in town is framed, the ✋ prompt clear of the ✋ button in phone portrait. Tests: `scripts/lib/qawatch.js` (the watchdog — use it in your own tests: `W.install(t)` … `W.check(t, label, await W.report(t))`) + `qa`, `qa2`, `qa3`, `qafoot`, `qatown`, `qalaw`, `qatouch`. **Batch 2 LANDED 2026-11-20** (+ the camera's town-wall check made to work in ci/oneworld's TURNED attached towns — use `plan.local` / `plan.world`, never `ORIGIN ±`): the ✋ touch button's label follows what's in reach, the free camera stays out of tree canopies + right against a wall goes over her head, a camera glide never runs across a teleport (`cam.snap()` ends it; a big move mid-glide cuts). Tests added: `qa4` (carjack / hot-wire / the bank / a shoved car with the real ✋), `qa5` (arrested in town all the way through jail and back; the ER after a knock-out on foot). **Batch 3 LANDED** (coordinator's asks after ci/oneworld + ci/places): the DRIVING chase cam keeps out of houses / blocks / the circle's statue / big trunks / leaves in a town (`ctx.cam.carClip`, set by foot only while she's in a town — nothing on the highway); on foot no invisible fence on ramps / the cross roads (walking from the T into Midwood was turned back at 60 m, its line is ~75 m out); arriving at the precinct cuts instead of swooping across town. New tests: `qacar` (the chase cam), `qaseam` (the one-world line in the car + on foot: crossing both ways, stopping / out / back in / knocked out / arrested ON it, a chase across it — both towns), `qaplaces` (precinct / courthouse / hospital: walk in with ✋ + out, arrested in town → out, the ER → out). **Batch 4** (ci/together, two pages, the watchdog on both — `qafriends`, `qafriends2`): riding across an attached town's line (no freeze, no dissolve), hop out moving in town (clear of walls), the driver arrested / leaving the party mid-ride (the passenger is let out, in control), a Free Roam warp into an attached town (lands ≤ 30 m from the friend), both friends into the courthouse lobby in the same frame and out / in crossing, a phone with friends + riding (🚪 HOP OUT, pointers — nothing overlaps), Lulu's house when the host walks out / leaves the party: all clean, nothing to fix. `phone`'s toast check now watches for the toast (no real-time race). In a party friends' cars move on the REAL clock: the watchdog allows speed × real time between frames (a crawling CI page). Seen once, unconfirmed: the passenger's car stepped 11 m in one frame as the driver took a hit (a ~1 fps CI page). **Paused** — the open items are in §7 › QA sweep |
| `ci/onegame` | 🎮 ONE GAME, NOT A MENU OF MODES (roadmap 10) — one ▶ PLAY on the title; Story Trip / Parking Challenge / Shabbos Rush entered from inside the world; owns the title layout (`core/screens.js` title groups) and how each mode is ENTERED and ENDED. Started 2026-11-20. | **LANDED on main 2026-11-20** — `features/onegame` + `core/screens.js`: the title = ▶ PLAY (id `play`, the old `cruise` run, never locked) + 👯 Friends / 👧 Dina tiles (`TILE_FIRST`, extra play items go to ⚙️ More — no overflow); 🧳 suitcase by the car + a stop on the 📱 🗺️ Map (leg 1 at home, later legs ROLLING — `startRun({ rolling })`); 🅿️ booth + attendant in every rest-area lot + a card in 📱 💼 Jobs (`JOB_EXTRAS` in phone/apps.js — the phone stays 9 apps; ends where it started); ✋ Play as Dina on the porch (picking Lulu walks back out); Friday afternoon = Ima's ask at the door, the hop-in arms the rush (`ctx.shabbos.atDoor`); trip / rush / parking cards + the dinner beat end in the world (`ctx.onegame.home()`). **Tests now click `/PLAY/`, not `/Cruise/` or `/Story Trip/`** (`ctx.onegame.roadTrip("test")` starts the road trip). **For `ci/everyone`:** the Friends tile is whichever play item has id `friends` (or the old `party`) — relabel it freely, its slot stays. **Left:** a town lot booth (after `ci/oneworld`), a 🧳 marker on the 🗺️ map, maybe a decline line for Ima on Fridays |
| `ci/everyone` | 🌐 EVERYONE IN THE SAME WORLD (roadmap 11) — online by default with whoever is playing, friends as a private group inside it; owns `features/multiplayer`, `features/party`, `features/openworld` networking and the 👯 Friends hub. No relay-server change without the owner. Started 2026-11-20 | **Stages 1 + 2 LANDED 2026-11-20** — out in the world she joins the EVERYONE room by herself (sharded `lobby`…`lobby8` client-side when one is full; ⚙️ Settings › 🌐 Play online + the phone's 👯 "Go solo"; Dina's mode offline; an unreachable relay = silent solo). Strangers: see-through ghosts labelled colour + number (never a name they sent), no collision, can't start races / tag / the lot on your screen, emote / honk / record floods dropped on the receiving side, every field validated. 3D riders publish `d.w` (zone + place) so they show in towns and on foot; the nearest 6 are drawn, each ghost car ONE merged mesh (~58 → ~2 draw calls). The title item is **👯 Friends** (invite · code · 🎮 Party games = the lobby · Play online · 🕹️ Classic 2D friends + who's around); a party keeps EVERYONE in 🌍 Free Roam (friends = real cars with names, drawn once via `d.pt`; strangers stay ghosts), lobby activities hide strangers. Test `mpworld`. **Left:** see §7 › Everyone | 🌐 EVERYONE IN THE SAME WORLD (roadmap 11) — online by default with whoever is playing, friends as a private group inside it; owns `features/multiplayer`, `features/party`, `features/openworld` networking and the 👯 Friends hub. No relay-server change without the owner. Started 2026-11-20. |
| `ci/decor` | 🛋️ SOMEWHERE FOR COINS TO GO (roadmap 9) — **LANDED 2026-11-20**: Lulu's own house (✋ 🏠 GO INSIDE at the top of her porch steps → a soft cut: kitchen with Ima, living room, her room) + decorating it with coins: 11 spots (bed, wallpaper, wall art, rug, light, shelf, couch, front door, porch, mailbox, front yard) × 5–6 choices (20–700 💰), a picker card that previews in place → asks → buys; owned for good, swaps free; the outside pieces show from the street + the title; 4 themed sets (noticed, never paid); a coin SINK only; off in a party. See ARCHITECTURE › Lulu's house + decorating; test `decor` | Nobody on it now. **Left / ideas:** more spots (the fridge door — Dina's drawings, magnets; the kitchen; Dina's room; the garage + the driveway), Dina at home with a line, a 🛋️ "my house" page in the 📱 phone, a set reward that isn't coins (a badge in the scrapbook), outside pieces have no colliders (she walks through the flamingos), the 📬 / 🌷 cameras assume she walked up from the street. Tune prices / add choices in `SLOTS` (`features/decor/data.js`); every model is code in `props.js` |
| `ci/seasons` | 🕎 A WORLD THAT FOLLOWS THE REAL CALENDAR (roadmap 8) — `features/seasons` reads today's Hebrew date (device `Intl`, sundown rollover; the HOST's day in a 🎉 party) and dresses the world: Chanukah menorahs in every front window (+1 candle each evening) + the big menorah + a sufganiyot stall, the Purim costume parade + mishloach manos + hamantaschen, sukkahs going up before Sukkos then on every duplex deck / Midwood yard, the pre-Pesach kerb clean-out, Lag BaOmer bonfires, Shavuos planters + cheesecake / flowers, Rosh Hashana apples & honey, Tu B'Shvat fruit, Friday challah & flowers + Shabbos / Yom Tov candles after dark; fast days / the Three Weeks / Yom Kippur quiet. Ima's 📱 note, Lulu's line, a ✋ stall treat (coins once per REAL day), ⚙️ Holidays in the world ON / OFF. Preview `?season=chanukah&night=5` | **ROUND 2 LANDED 2026-11-19 (night)**: Chanukah string lights, lulav + esrog walkers, Yom Kippur families in white, Tashlich, Simchas Torah dancing with flags, Purim collectors + a music van, the chametz burning, a quieter 📻 radio in the Three Weeks (features/hustle/radio.js asks `ctx.seasons.radioQuiet()`), and meta's car menorah slimmed (`features/meta/menorah.js`: 34 draw calls + 7 shadow → 4 + 2). Round 1 **LANDED 2026-11-19** (see `3d/ARCHITECTURE.md` › Seasons + the parity row; test `seasons`). No new hooks were needed: it uses `chunk:build` / `chunk:dispose` (+ `chunk.houses`, `chunk.addCollider`), `town:enter` / `town:leave`, `ctx.town.homes` / `spot()`, `ctx.homes.homes()` (doors) and imports homes' `rig.js` (`Rig`, `crowdMaterial`) for the parade. **`ci/oneworld`:** when a town is built ahead of time, seasons dresses it on `town:enter` (today a quick plan + one `addSet`, < 2 ms) — if the town becomes visible before `town:enter`, fire a `town:built` (or call `ctx.seasons.debug.rebuild()`) so the menorahs don't appear in view. meta's car menorah now rolls over at sundown too. **Left / ideas:** see §7 › Seasons |
| `ci/hangout` | 🎉 THE TOWN AS A HANGOUT (roadmap 7) | **LANDED 2026-11-19 (evening)** — 🎉 → **🌍 Hang out with friends** hosts straight into Free Roam (no lobby, no 3-2-1; the lobby for races is the second button); an invite link carries the sender (`&with=`) and the friend lands right beside them (on foot if they're walking); 📱 👯 has 📤 Invite + 🚪 Leave (one tap). **Emotes** (party/emotes.js, `ctx.emotes`): 8 gestures with fixed friendly phrases (👋 Hi! · 👉 Follow me! · ✋ Wait up! · 🙌 Woohoo! · 💃 · 🤦 Oy vey! · 🥂 Mazel tov! · 👏 GG!) — hold D-pad ↑ / F (on foot also ci/move's △ / Y slot once it lands), tap = 👋, 1–8, the 😀 touch button; on foot (solo + party) and from the car with friends; friends see them on your puppet (`d.x.e`); combos when two friends emote at each other; a 👋 greeting when you pass a friend. **Game spots**: a 🕹️ arcade by the pizza shop + a 📋 notice board by the hall / shul in each town (walk up → ✋ GAMES, or stop beside it → ✕). **Games with friends are INVITATIONS** now (phone too): the starter is in, friends opt in by coming to the spot / tapping the chip / 📱 👯 Join — nobody is warped or held unless they said yes. Party tests now wait in GAME frames (`scripts/lib/party3d.js`). Test: `partyhang`. **Left / ideas:** see §7 (Hangout) |
| `ci/oneworld` | 🌍 ONE WORLD — the towns attached to the highway (`3d/ARCHITECTURE.md` › Towns › Attached; tests `flow`, `town`) | **LANDED 2026-11-20**: Lakewood + Midwood STAND at every interchange (Lakewood straight on off the inner T, Midwood behind the ramp by a new Avenue P), built in ~600–1100 small slices from 900 m out, in view from the ramp; she drives down the ramp, through the T and in — and back out, on foot too — with no fade, no frozen frame, no jump (≤ 0.5 m a frame measured). **For other agents:** an attached town is TURNED to its interchange (`PL.ROT`): every world heading / point `ctx.town` hands out (`TownRoad`, `spot`, `footYaw`'s roadH, `occluders`, `copRoute`) already includes the turn — never add a town's local x/z to `PL.ORIGIN` by hand, use `ctx.town.spot` / `debug.world(lx, lz)`. A new landmark building (precinct, courthouse, hospital): a block-face `uses` entry in `towns/<id>.js` + its look in build.js › layoutFace (the Bais Yaakov / bank pattern) — it then stands in both the attached and the stand-alone town. **Left (pick up any time):** (a) the town's drivers / people / the crowd start when she crosses the line (out of the camera's view, ~150 m off) — they could start as the town stands; (b) a highway cop chasing her vanishes at the line (law's units think in one road: make them puppets like the plain traffic); (c) the stand-alone town (`ctx.town.enter()` with no exitS, tests) still lives at its far origin — tests could move to the attached one; (d) a Free Roam warp into a town is still a dissolve (it's a teleport); (e) drive straight from Lakewood into Midwood (they're neighbours now — a road between them would be the next "open world" step); (f) a scene state the town can't host (jail, the ER by force, a cutscene set) still moves her to the highway first (`on("state")` → `leaveTown("quiet")`) — it should play where she is; (g) getting in / out of the car at the very edges of a town's grid isn't tested (the middle of town and the T are — `flow`, `qatown`). Tests: in a page, a town's local → world is `ctx.town.plan.world(lx, lz, {})` (+ `plan.wh(h)`), never `ORIGIN + local`. |
| `ci/home` | 🏠 START AT HOME + NO MORE GAME OVER (roadmap 2 + 3) and 📝 A DAY IN LULU'S LIFE (roadmap 6) — **all LANDED 2026-11-19 (night)**. Nobody is on it now | **Steps 2 + 3:** a run from the title (or Restart) starts ON FOOT at the porch steps (Ima in the doorway with one line, the car nose-out in the driveway with a marker, ✋ GET IN = foot's hop-in → `worldPullOut` → playing); out of hearts = a KNOCK-OUT: ~1 s spin-out → back on her feet beside her patched-up car (score banked + reset, tow fee 10 +5 a knock-out ≤ 30, hearts full) — the crash comedy ~1 in 3 (skippable, the road only cleared within 90 m), the ER ~30 % of those / ~20 % on foot; the iOS interstitial every 2nd knock-out once she's back on her feet and walking + once a jail stay in the quiet cell, the 📺 reward on the pause menu once per knock-out (≤ 3 a run) — the whole game HOLDS while any ad is up (2026-11-20, see §7 › Ads). **Step 6 (`features/day`):** a Cruise from home hands Ima's list for today (seeded by the date: an errand at a real place, a side job, something silly), a HUD chip + a light column, 15 💰 an item and 40 for dinner, once a day; home for dinner = a short beat at the house → the title. ARCHITECTURE › Run API › the knock-out, › the home street, `ctx.day`. **Left (pick up any time):** more list items (town shops once `ci/oneworld` lands, Dina's school pickup…), a 📱 phone view of the list, a party version (a shared list), a knock-out IN town standing her up in town, the ER as a building (step 4). **For the others:** tests must start runs with `quick: true` when `world` is enabled; `ctx.foot.start(reason, { camBlend, face, home })`, `ctx.foot.bubble`, `ctx.foot.debug.getIn()` |
| `ci/move` | 🤸 MOVEMENT THAT'S FUN ON ITS OWN (roadmap 5) — **LANDED 2026-11-19 (evening)**: a JUMP on foot (○ / B · Space · the pink JUMP touch button; hold = higher, a tap = a hop; coyote time + a jump buffer; a landing dip / dust / thud / rumble) over and ONTO low things (benches + planters 0.55 m, the lawn chair, guardrails 0.8 m hop-over, parked / stopped cars: hood ~0.95 m then roof 1.45 m — `features/foot/jump.js` `LOW` + `carDims`; anything else stays solid); a FREE camera on foot (right stick / mouse drag / finger drag on the picture; it stays; walking is relative to it; a gentle straighten along the road only while walking forward close to its line; R3 / V = behind her; 🎥 Look speed in Settings; invert-look respected) and a HELD look in the car (stays 1.4 s, then drifts back); the moves made central (a coach line the first walks, 🦘 HOP / 🧍‍♀️ UP TOP / 🚗 ON THE ROOF / 🦘 LONG JUMP out of a slide / a roll pressed in the air = a landing roll, a 🦘 Jumps entry on the Moves page); friends see her jump (`d.x.f[2]`). Tests `movement`, `movetouch` | **Button map on foot: ○ / B · Space · JUMP = jump; □ / X · C · ROLL = roll / slide / vault; △ / Y + keyboard B = `P.emote` / `input.emoteHeld` / `glyph("emote")` — ci/hangout's emote slot (no look while `body.emote-wheel`).** Left (nobody on it): camera collision with town walls, hedges / low fences in towns + homes' yards aren't colliders yet (give them `kind: "rail"` / `"bench"` when they become solid), no jump inside interiors (their own walking), puddles to splash in, a ledge-grab onto a car roof from the ground |
| `ci/flow` | 🌊 Flow + open world — the owner's direction for the game: "less a driving game, more an open world (a mix of Roblox and Fortnite) — everything flows, fewer hard transitions, less choppy". **LANDED so far** (see `3d/ARCHITECTURE.md` › Flow; test `flow`): `ctx.cam.blend`, `ctx.dissolve` (towns, warps, warmed interiors), the hop-in, rolling starts, the music crossfade, no courtesy-shield blink, road chunks built in slices (`Chunk.advance`), shaders compiled when a model loads | **Next steps, none started — pick one, re-start the branch from `main`:** (a) more stutter: split the two biggest chunk steps (scenery placement ≤ 5 ms, the bake ≤ 7 ms here; × 3–4 on a phone), warm a SET's shaders before it shows (each `makeSet` has its own lights: interiors, jail, court, ER compile on first show), an idle model preloader, town people / e-bikes (~20 draw calls each — gfx's note); (b) the remaining hard cuts: jail / court / ER sets, the wreck chain (2.6 s + all traffic deleted + a card), parking's white flash; (c) ONE WORLD: towns attached to the highway (today a town is a grid at a far origin, entered by a soft cut at the ramp's STOP sign), walking into shops without a set, fields you can wander into (the world is a ±50–70 m ribbon); (d) play like an open-world game: start on foot at home / in town, a jump + free-look, a quick respawn instead of game-over cards, Free Roam as the default. The owner was asked two taste questions (start on foot in a hub? keep jail / court / ER as full scenes or make them optional detours?) — check the chat / ask before (d) |
| `ci/party3` | 🎉 Party round 3 — **LANDED 2026-11-19 ~07:50** for what was on `main`: heist (personal bits) and underworld (the pickpocket only) are on with friends; each feature's parity row says what the rest would need. Nobody is on it now | **Left (pick it up any time):** nothing for `homes` — it landed already ON with friends (never in the `OFF` set: the crowd is seeded in a 🌍 Free Roam town, a house is personal, presence "🏠 in the …s' house"; its parity row + the party section of `homes.js` cover it). Robberies / bad-guy cars / roadside stops need the shared road plan — bigger jobs |

`ci/gfx` is **LANDED** (2026-11-19 ~12:10 UTC, on top of everything above incl. homes + flow step 1): ⚙️ Settings → 🖼️ Graphics AUTO / HIGH /
MEDIUM / LOW, merged roadside scenery + far-car LODs (~25–40 % fewer draw calls on the highway), road-sign textures freed with their
chunks, contact shadows, wind sway, sky reflections, bloom on HIGH; before/after numbers + screenshots in `3d/docs/gfx-perf.md`,
the tiers in `3d/ARCHITECTURE.md` › Graphics & performance. Measure any perf change with `node scripts/perf3d.js`.

Branches not listed (`ci/gfx`, `ci/heist`, `ci/underworld`, `ci/townfix`, `ci/party2`, `ci/uwdiag` (a throwaway test-diagnostics branch that could not be deleted from a cloud session — never merge it), `ci/copheat`, `ci/exits`, `ci/partyfoot`, …) are already
merged — ignore them.

## 7. Backlog / known rough edges (good next tasks)

- Calm (`ci/calm`, landed 2026-11-20): still OUTSIDE the pop-up budget — phone texts + the call card (`ctx.phone.text`,
  journey's `.jphone`), `metaToast` (meta/util.js), law's own toasts (law/ui.js), Lulu's own speech bubbles (banter's
  `showLulu`, her chatter setting rations them). A big moment can still stack a banner + a call card + a toast (a wreck
  during a job call: ~38/min for that half-minute). Many features' toasts have no `prio`: the inference (big / red /
  money) covers most; a must-see toast that's plain or gold should pass `{ prio: 3 }`. Join line says "Friend" when the
  friend's name hasn't arrived yet.

- Everyone in one world (`ci/everyone`, landed 2026-11-20): the lobby activities (🏁 race, 🏡 road trip, ✨ dreidel dash, 🚓 cop tag)
  are still a LOBBY under 👯 › 🎮 Party games — a party shares ONE activity, so making them spot invitations needs "only the
  opted-in friends switch activity" (a sub-party, or porting them into openworld's game engine like Race to a Pin). A party still
  starts at the highway grid, not at home (`world/depart.js wantsDeparture` excludes parties; 📤 Invite from mid-drive banks the solo
  run and starts Free Roam at the grid). Strangers can only be ghosts + the 6 Shared Road emoji (no games with strangers — by
  design). EVERYONE holds 8 × 24 = 192 riders at once (client-side shards; beyond that: silently solo) and the 2D game only
  meets 3D riders in the first shard; more would need the owner's OK for a relay change. Relay traffic grows with online
  players (each rider ~5 states/s to everyone in its shard): the owner should keep an eye on the Cloudflare free-tier usage.

- `phone` "…D-pad + ✕ reach its buttons; api.toast/refresh work" fails LOCALLY in this cloud container on plain `main` (seen 2026-11-20 right after `ci/calls` + `ci/calm` landed; `ci/together` saw it pass on CI before those) — worth a look on CI.
- **Together (`ci/together`, landed 2026-11-20):** each screen runs its OWN copy of a room's people (the bartender, a house's
  residents, Ima) — a friend inside is a visitor nobody there reacts to on my screen, so two friends can see different
  dialogue / outcomes at the same moment (by design: nobody's coins, law or stealth depend on a friend). Lulu's house from the
  STREET still shows each player's own decorations (only the inside is the host's). Room positions ride at ~7 Hz (party/net.js
  sends at the driving rate while `d.x.in` is set) and are drawn ~220 ms behind. The pointers measure the HUD's boxes ~3×/s
  (`AVOID` in `together/pointers.js` — a new HUD element that must never be covered: add its selector there). Interiors with
  their own camera modes (the bar's dance floor, a picker) keep the friend walking where they are; jumps inside rooms don't
  exist yet (ci/move's note), so there's nothing to show.

- **Ads (rule 4b, done 2026-11-20 by `ci/home`):** `features/native/ads.js` holds the WHOLE game while any ad is up
  (`ctx.hold` → app.js skips frames; `A.holdAll` pauses music + suspends sound) and releases on the plugin's
  `…Dismissed` / `…FailedToShow` events, or after `showWaitMs` (8 s, never appeared) / `maxAdMs` (60 s, never closed).
  Ads START only at calm moments: `ctx.ads.calmNow("foot" | "cell")`. A NEW placement must go through
  `showInterstitialHeld(why)` behind a calm check, and get a case in `scripts/tests3d/adhold.js`. Unverified on a real
  iPhone: that the WebView keeps the paused frame on screen under the ad (it should — nothing is drawn while held).

- Home start + knock-outs (`ci/home`, steps 2 + 3): a knock-out IN TOWN now stands her up in town too (2026-11-20: the old
  tow-to-the-highway left the screen black until she drove again — the owner hit it; tests `town` › knockout + attached
  Midwood). She can WALK in and out of a town now (ci/oneworld: the cross road on foot, no cut). Jail / court / the ER now
  play IN town (`ci/places`); other scene sets (roadside cutscenes, parking, Dina) still drop her on the highway first. `moves`' rocket
  start only samples the 3-2-1 now (a home start has no countdown). Parking's challenge still ends on a game-over
  card (the only one left). Restart is only in the pause menu while driving (not on foot). A party still starts at the
  grid (`ci/hangout` owns that); the start at home is solo.

- Town triangle budget (`town` test, now ≤ 120k at 1280×720, ⚙️ MEDIUM — RESET from 115k by ci/oneworld, 2026-11-20): the
  same busiest view measured 111.7k–117.5k across CI runs of the SAME code (main before it: 116.8k) — it swings with how
  many cars / walkers are in sight (~27k of the view is cars + people, ~10.6k the sky's clouds — atmos `sky.js`, 132
  puffs × 80 triangles, in every scene). The town's own blocks / ground didn't grow. Pulling the
  town's draw distances in (MAX_D solid 300 → 250, flat 140 → 120) only saves 1–3k and starts to show pop-in down the
  long avenues, so it wasn't done. The real levers if it creeps over again: the town's ground (asphalt / walks / marks,
  ~14k, always drawn whole — split it into the cluster cells so it culls like the blocks) and the town's people / cars
  (~27k for 11 cars + walkers: a far LOD). Keep new town props merged into the clusters (build.js), never loose meshes.
- Decor (landed 2026-11-20): `core` fails LOCALLY in this cloud container on plain `main` too ("coins land in the shared 2D wallet", "B resumes", "reaches Bubbe's house" — it ends up in footRun) while CI passes it — worth a look if it ever shows on CI. `home`'s "knocked flat on foot" flaked once here (passed on a re-run).
- Places (`ci/places`): her impounded car stands behind the impound fence but can't be taken back early (impound has no
  fee in the 3D game — springing it for coins would be an economy change: **the owner's call**); the precinct / court /
  hospital doors are on one side of the building only (no back door for the jailbreak — she bolts out the front); the
  arrival beat's cruiser is a plain clone (no traffic car), the town's drivers freeze while it plays (~4 s); highway arrests
  in a 🎉 party keep the old flow (a warp into a town would split her from her friends); the courthouse lobby's 2B doors
  are always locked when she walks in freely (court only sits for her own case).
- **Dovid Dov** (the radio's 🎤 DOVID DOV FM plays the owner's real song, `dont-wanna-be-frum.mp3`): in the game he is
  an anonymous mystery singer AND Lulu's brother. Lulu, the family (Ima, Bubbe, Heshy) and close friends (Avigail) know
  and keep it quiet; strangers, DJs, billboards and town group chats only wonder who he is. Keep every new line on the
  right side of that, and keep the references small.
- **iPhone traps (both bit the owner on 2026-11-19, neither shows in headless Chromium):** (1) a page can't set an
  `<audio>` element's volume there, and a set READS BACK for one task before it is 1 again — never read `el.volume`
  (audio.js counts its own levels; test `music` imitates it). (2) resizing the WebGL canvas empties it, and a canvas
  resized after its frame was drawn shows blank (a white flash) until the next frame — resize only right before a
  draw (app.js `applyGfxPending`; test `gfx`). The flash fix is UNVERIFIED on a real phone: if the owner still sees
  flashes with ⚙️ Graphics on MEDIUM (no resolution sliding), look elsewhere.
- Cops: the red "not hidden" toast can linger after she reaches a real hiding
  spot (`core/hud.js` has no toast dismiss); a call-in cruiser in town still
  routes straight to her; bailing out mid-chase files a permanent warrant (2★ on
  later chases until court) — maybe too harsh.
- Heist: in a party only its personal bits are on (robberies + her own bank job would need a road-plan slot, a host-validated foil and a co-op lobby activity — see the parity table); robberies that start while she WALKS are capped at 2 a run
  (`TUNE.robbery.footMax` — the tackle is the easy foil, keep it capped); the highway Quik-Mart robbery has no on-foot
  version; tests that drive with no steering must keep distances short (a bend carries the car out of its lane —
  that was the `heist` spike-strip flake).
- Exits: the cross roads now run straight on into the attached towns (ci/oneworld); rest-area props sit slightly off on tight bends; Kugel the dog bobs on a loop;
  rest areas aren't on the 🗺️ map; no test drives a rest area in Story mode. Planning slides an interchange up to ~1.3 km (50 m steps) until both towns
  stand ≥ 100 m clear of the highway (`FIT`) — `exitAhead` in a test looks either way for a spot every rule allows, but a crowded stretch can still put it km away.
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
- `town` "town triangles within a busy Cruise's budget (≤ 115k)" fails on `main` itself since the evening landings (main b055546: 116,841 at the test's Main St view; ci/hangout's game spots add ≤ 142 there — measured): someone owning town / gfx should trim or re-baseline it.
- Hangout (landed 2026-11-19, `ci/hangout`): the wheel is AIMED with the right stick — `ci/move`'s free-look should skip while `body.emote-wheel` is set (asked in its row); until ci/move's input lands, the on-foot emote button is D-pad ↑ / F (`fire`, unused on foot) — switch the hints to `glyph("emote")` when it does (party/ui.js `emoteGlyph`). The host's ⏸ "Everyone back to the lobby" still pulls everyone out of Free Roam (a host-only action, not an invitation) — a lobby race could become an invitation too. Game spots are plain three.js boxes (no Blender model, no collider: she can walk through the cabinet) placed from `ctx.town.spot` — ci/oneworld moving towns is fine; a third town needs a `pizza`/`bakery` + `hall`/`shul`/`yeshiva`/`welcome` spot or `PLACES` in openworld/spots.js. Invitations are 15 s of party (real) clock (45 s in `?test`). Emotes / combos / greetings pay nothing (stats only: `partyEmotes`, `partyCombos`, `partyGreets`). No emotes in the lobby stage or from a solo car (↑ = missiles there). Joining a walking friend climbs out with `foot.start("droveOff")` (her car parked behind). A party still starts Free Roam at the highway start, not at home — `ci/home` may want to hook `hostRoam` / `enterActivity`.
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
- Seasons (landed 2026-11-19; round 2 the same evening): the sundown rollover is a per-month table for the north-east
  US (a player in Israel / LA gets the new count up to ~2 h early or late); if the day changes mid-drive (sundown,
  midnight) everything is taken down and put back in one go (the candle count can pop in view once); the parade's route is
  a straight 70 m of sidewalk through the pizza shop / bakery spot and crosses the side streets; the town stall stands on
  the strip between the sidewalk and the shop (it can touch a shop's awning); the parade and the dancers aren't synced in a
  party (each screen animates its own; where they stand is the same). Round 2 (the owner approved the details left out in
  round 1): string lights, lulav walkers, Yom Kippur in white, Tashlich, Simchas Torah, Purim collectors + music van, the
  chametz burning, the quieter radio, a slim car menorah — all in. (The candle side is settled — the owner: "not
  important", so it stays as built.) **Still open (asked the owner):** whether LULU FM (the game's own soundtrack) should also go quiet in the Three Weeks (today
  only the radio's music stations do); Midwood has no water in the game, so no Tashlich there; hakafos only on 23 Tishri
  (not the night of Shemini Atzeres, which some communities also do); no breadcrumbs at Tashlich; men + boys carry the
  lulav (women may too); the chametz barrel burns all day of the 14th (really it's the morning); the music van is solo-only.
- iOS: classic 2D letterboxes in landscape; the "Groceries" chip touches the
  speedometer for ~8 s in iPhone portrait; photo saving uses the share sheet
  (unverified on a real device).

- Movement (ci/move, landed 2026-11-19): the free camera's wall collision landed with `ci/qa` (it comes in to her side of
  houses / town blocks / big colliders); a stopped traffic car she stands on that drives off just lets her slide off (no knockdown, by design);
  standing on a moving car isn't carried along; roll / slide still use flat collision (a roll into a bench stops at it).
  Jump feel = `JUMP` in `features/foot/jump.js`, camera feel = `LOOK` in `core/camera.js`.

- **QA sweep (`ci/qa`, 2026-11-20):** the watchdog (`scripts/lib/qawatch.js`) flags one-frame jumps of Lulu / the car /
  the camera, NaN, an opaque full-screen overlay left up (> 4 s, or while she has control), a flat-colour picture, the
  camera under ground / inside a block or a big collider, Lulu hidden, standing inside something, an invisible wall
  (stick pushed, not moving, nothing near), stuck states and lost control. It treats as declared cuts: the soft-cut
  overlay, an opaque fade, a set, a state change, `town:enter` / `town:leave`, a camera-view switch (△ / Y).
  Deliberately NOT flagged: the camera brushing a thin pole / a street tree's trunk (r < 0.8 m — the free camera
  doesn't pull in for those, it would pop in and out past every tree), a camera looking straight down at a lot. With
  `&enable=all` the 🎉 presence dials the REAL relay server: when it's down that WebSocket error is the outside world's
  (`W.dropRelayErrors(t)`). Pressed right against a wall the free camera rises over her head (`orbit`'s lift under 1.5 m). Open (not
  fixed, for the owners): `ctx.town.leave()` moves only the CAR — called while she's ON FOOT in a town (a scene the town
  can't host starting from a walk) it leaves her standing where the town was, in empty space, and foot's `near.s < 4`
  rule then shoves her 4 m a frame (seen only from a test today: `places` hosts the arrest / jail / ER states now); by
  design a fugitive can't walk into the precinct / courthouse / hospital (the ✋ just doesn't offer them); when she stands UNDER a big tree the free camera behind her can pass the edge of its
  leaves for a moment (camera parked inside leaves while she's in the open is fixed — `foot/jump.js` `canopyR`); law's lawBust / lawStop pull the cars to
  d = 7.9, which in a town is the sidewalk.

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
