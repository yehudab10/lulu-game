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
snatchers, nets + spike strips — see `3d/ARCHITECTURE.md` › Banks, heists & robberies). `ci/townfix` is LANDED (🏘️ cars in town drawn by line of sight, solid + shove-able + hotwirable parked cars, town drivers jackable in solo, a real interchange: taper, decel lane, curved ramp + guardrails, a T-junction with a STOP sign, gas station and "Welcome to" sign, an on-ramp + accel lane; nothing stands on any lane — `world.offLanes`). `ci/party2` is LANDED too (🎉 claim shared cars so carjacking / ✋ flag-down / 🚕 hop-in work with friends; streets, rides, rest areas and the towns' extras are on in a party — ARCHITECTURE › the party parity table). `ci/underworld` is LANDED (😈 the crooked cop's Kugel Fund + Internal Affairs stings, Velvel's no-questions garage, the Fixer's jobs + heat, road-ragers / gang cars / pickpockets — every knob is `SPAWN` in `features/underworld/data.js`; off in a party until `ci/party3` gets to it). `ci/flow` is NEW (the owner's ask: fewer hard cuts, less stutter, a more open world — see its row). Nobody is working on the
branches below right now — pick one up. Each is based on an older `main`: merge `origin/main` into it first
(`features/index.js`, the ARCHITECTURE tables and the party `OFF` set will conflict with heist's rows — keep both)._

| branch | what it is | where it stopped / what's left |
|---|---|---|
| `ci/flow` | 🌊 Flow + open world (the owner: "less a driving game, more an open world — everything flows, fewer hard transitions, less choppy"). Step 1: `ctx.cam.blend(sec)` (the picture glides instead of cutting; > 70 m = still a cut), Lulu hops INTO the seat (`foot` `hopIn`), roadside scenes ease in, a rolling start after jail / court instead of the 3-2-1 | **🔧 BEING WORKED ON NOW by the coordinator session (2026-11-19 ~06:30 UTC).** Step 1 built, `foot` green locally; left: its test groups, land. Then (after `ci/gfx` lands, it rewrites `Chunk.build`): chunk building in time slices, a shared shader warm-up, an idle model preloader; then towns attached to the highway (no fade + teleport), interiors without a loading cut |
| `ci/homes` | 🏠 Living towns (crowds, porches, lit windows, reactions) + breaking into houses: knock or sneak in, view-cone "?"→"!" detection, shocked residents, household items used on them with cartoon reactions, capped couch coins, burglary charge + call-in, residents remember her; docs done | **🔧 BEING FINISHED NOW (picked up 2026-11-19 04:00 UTC — leave it alone until this note goes).** Last work: crowd lives near her, residents route through doorways. Left: finish/verify `homes` test, then `core,platform,skip,ux;homes;town;midwood;foot;interiors;law;memory;banter;openworld;partyfoot;native`; perf check in town; land |
| `ci/party3` | 🎉 Party round 3: features on `main` but still OFF with friends, one at a time. **heist** done on the branch (its personal bits — the cops' net / spikes in her own chase, the moped snatcher, the thief at her parked car — on in a party; robberies + her own heist stay solo, written up in the parity table; `partyheist` test passes locally) | **🔧 BEING WORKED ON NOW (2026-11-19 ~05:00 UTC).** Left: CI `core,platform,skip,ux;partyheist;heist;party;partyplus;partyfoot;law`, land; then `underworld` once it's on main, `homes` later |
| `ci/gfx` | ⚡ Performance + graphics: perf harness + leak tracker, no per-frame allocations, road-sign textures freed, contact shadows, bloom (only where supported), Auto/Low/Medium/High setting | **🔧 BEING FINISHED NOW (picked up 2026-11-19 03:51 UTC — lands LAST, after underworld/townfix/homes/party2).** Left: finish tiers + settings UI, before/after numbers + screenshots, then the FULL suite (`only` and `groups` empty) since render changes touch everything; land |

Suggested order: homes → party3 (turns each landed feature on in a party) → gfx (touches everything, so land it last and re-run the full suite).

Branches not listed (`ci/heist`, `ci/underworld`, `ci/townfix`, `ci/party2`, `ci/copheat`, `ci/exits`, `ci/partyfoot`, …) are already
merged — ignore them.

## 7. Backlog / known rough edges (good next tasks)

- Cops: the red "not hidden" toast can linger after she reaches a real hiding
  spot (`core/hud.js` has no toast dismiss); a call-in cruiser in town still
  routes straight to her; bailing out mid-chase files a permanent warrant (2★ on
  later chases until court) — maybe too harsh.
- Heist: in a party only its personal bits are on (`ci/party3`); robberies that start while she WALKS are capped at 2 a run
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
- Party tests wait in REAL time (`hostUntil` / `until` in `partyfoot.js`, `party.js`): a 2–3 page CI runner can drop to
  ~1 fps, and then a 6 s scene takes minutes ("bailed out… timed out in lawExit", "race results… timed out in
  partyWait", missing host buttons after a > 4 s stall hands hosting over). Same code failed twice then passed — re-run
  before blaming your change; better: move those waits to frames.
- Party tests: `partyworld` and `party` ("dash: claims settled") occasionally fail
  on slow CI runners because of the random party seed — re-run once.
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
