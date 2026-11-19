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

_Last updated 2026-11-19 (evening). All Claude agents are STOPPED; every branch below is pushed and
up to date. Nobody is working on any of them right now — pick one up. Each branch is based on an older
`main`: merge `origin/main` into it first._

| branch | what it is | where it stopped / what's left |
|---|---|---|
| `ci/heist` | 🏦 Banks in Lakewood + Midwood, foil cartoon robberies, Lulu's own opt-in heist (case → plan → getaway with a real cruiser chasing round town corners → jail/court), moped snatchers + car thieves, stun nets + spike strips. Off in party | **Nearly done.** Feature complete; last fix widened the tackle reach. Left: CI green on `heist`, then the groups `core,platform,skip,ux;heist;law;town;midwood;streets;foot;hustle;community;native;party`; look at the screenshots (cutscene camera, getaway car in a town lane); land on main |
| `ci/underworld` | 🕶️ Crooked cop (Policeman's Kugel Fund bribe / Internal Affairs sting), Velvel's no-questions garage, the Fixer's dirty jobs + heat, pickpockets, road-ragers, a gang car; Shomrim/Chaverim tie-ins; tunables in one SPAWN-style block. Off in party | **Nearly done.** `underworld` test was 43/44 before the last fix (encounter trap). Left: re-run `underworld`, then `core,platform,skip,ux;underworld;law;town;streets;foot;hustle;community;memory;banter;native;party`; land on main |
| `ci/townfix` | 🏘️ Town bugs (invisible cars, ghost parked cars → solid + hotwirable, carjacking town traffic in solo, nothing standing on the lanes/ramps) + realistic exits (taper, curved ramp, guardrails, T-junction with a stop sign + gas-station/"Welcome to" context, accel lane) | **Code done, unverified.** The last commit is a WIP save of test edits (town visibility judged from behind a town driver). Left: CI `core,platform,skip,ux;town;midwood;exits;streets;foot;openworld;partyfoot;law;native`, fix failures, land |
| `ci/homes` | 🏠 Living towns (crowds, porches, lit windows, reactions) + breaking into houses: knock or sneak in, view-cone "?"→"!" detection, shocked residents, household items used on them with cartoon reactions, capped couch coins, burglary charge + call-in, residents remember her; docs done | **WIP, mostly built.** Last work: crowd lives near her, residents route through doorways. Left: finish/verify `homes` test, then `core,platform,skip,ux;homes;town;midwood;foot;interiors;law;memory;banter;openworld;partyfoot;native`; perf check in town; land |
| `ci/party2` | 🎉 Party round 2: claim shared cars (they pull over identically on every screen) so carjacking works with friends; streets / rides / exits (rest areas) / town extras ON in a party; docs + parity table + wire format done | **WIP, mostly built.** Left: the flag-down test step (CI re-run pending), groups `core,platform,skip,ux;party;partyfoot;partyworld;openworld;multiplayer;streets;rides;exits;town;midwood;law;foot`; then, once heist/underworld/homes are on main, turn them on in a party too (personal/seeded) |
| `ci/gfx` | ⚡ Performance + graphics: perf harness + leak tracker, no per-frame allocations, road-sign textures freed, contact shadows, bloom (only where supported), Auto/Low/Medium/High setting | **WIP.** Left: finish tiers + settings UI, before/after numbers + screenshots, then the FULL suite (`only` and `groups` empty) since render changes touch everything; land |

Suggested order: heist → underworld → townfix → homes → party2 (it builds on the others) → gfx (touches
everything, so land it last and re-run the full suite).

Branches not listed (`ci/copheat`, `ci/exits`, `ci/partyfoot`, …) are already
merged — ignore them.

## 7. Backlog / known rough edges (good next tasks)

- Cops: the red "not hidden" toast can linger after she reaches a real hiding
  spot (`core/hud.js` has no toast dismiss); a call-in cruiser in town still
  routes straight to her; bailing out mid-chase files a permanent warrant (2★ on
  later chases until court) — maybe too harsh.
- Exits: ramp ends currently stop in an open field (being fixed on `ci/townfix`);
  rest-area props sit slightly off on tight bends; Kugel the dog bobs on a loop;
  rest areas aren't on the 🗺️ map; no test drives a rest area in Story mode.
- Party: carjacking a moving shared car needs timing (being fixed on
  `ci/party2`); no quick chat on foot; a long main-thread stall (loading a
  building on a slow phone) can hand hosting to someone else (4 s rule).
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
