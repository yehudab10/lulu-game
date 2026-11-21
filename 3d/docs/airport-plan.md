# ✈️ The airport exit (JFK) — plan + hand-off

**Status: DECIDED (the owner answered all 12 questions on 2026-11-20 — see Decisions). Building stage 1 on `ci/airport`.**
**Branch: `ci/airport`. Owner of this job: the owner's other AI account (the one that originally set this repo's agents going).**
Everything else in flight belongs to the coordinator session's agents (see `AGENTS.md` §6).

This file is the shared memory between the two accounts. They cannot message each other, so
**the repo is the channel**: this file, the `ci/airport` row in `AGENTS.md` §6, and the "Sync log" at the bottom.

## What the owner said (2026-11-20)

> "I'm also thinking we add another exit at some point as well, maybe an airport but I understand that would take some
> time for it to be done right. So I'm gonna have another AI account do it for us… I'm thinking JFK airport."
>
> "I want you guys to be in sync enough that between both of you nothing will mess up and one of you will merge it
> effortlessly."

So: a third exit off the highway — **JFK airport** — built carefully, in stages, by its own agent, without colliding
with the work already in flight.

## Read first (in this order)

1. `AGENTS.md` — the shared rules, the roadmap (§2b), the in-flight table (§6), the rough edges (§7: two iPhone traps,
   the pop-up budget, the QA watchdog, known flaky tests).
2. `CLAUDE.md` — the feature list and the deploy rule (finished work goes straight to `main`).
3. `3d/ARCHITECTURE.md` — at least: *Ground rules for feature work*, *Flow: no hard cuts*, *World*, *Towns* (the
   attached towns: `features/town/towns/<id>.js`, `attach`, `highway: { first, every, no, label }`), *Places* (how a
   landmark building + its walk-in room are added), the interiors engine, *Shops* (when `ci/shops` has landed),
   `features/together` (rooms friends share), the party parity table, *Testing*.
4. `3d/docs/midwood-brief.md` — how the second town was briefed; a good model for scope.

## What the game is now (so the airport fits it)

- **One game, one world** (`features/onegame`): the title has one ▶ PLAY. **Do not add a play mode to the title.**
  Anything the airport offers starts from a place in the world and ends back in the world.
- **One continuous world** (`ci/oneworld`, landed): Lakewood and Midwood are *attached* to the highway at every
  interchange — drive or walk down the ramp into town with no cut. Rest areas are `features/exits`. The airport should
  be reachable the same way: an exit you take, not a menu and not a fade.
- **Real places you walk into**: houses, Lulu's house, the bank, a precinct / courthouse / hospital in each town; shops
  are moving into the world right now (`ci/shops`). Rooms are warmed ahead and entered with a soft cut.
- **Friends**: a party shares the world, buildings (`features/together/rooms.js` › `SHARED`), a car (passenger seat),
  and soon arrests (`ci/partners`) and the bank job (`ci/bankfriends`). Strangers online are see-through ghosts and are
  never inside a building. Whatever the airport adds must say what it does in a party (parity table).
- **Calm screen**: pop-ups go through one budget in the HUD layer (`ci/calm`). No new toast spam.
- **Phones are the target**: towns have a triangle / draw-call budget and tests that enforce it. A new place needs its
  own measured budget.
- **Coins**: no repeatable free-coin sources; rewards capped per run or per real day.
- **Tone**: cartoon, wholesome + silly, 12+. Dina's mode strictly PG and untouched.

## Questions for the owner — ASK THESE BEFORE BUILDING

Ask them in plain English (the owner is not a coder), a few at a time, with a recommended default for each so a short
answer is enough. Write the answers into "Decisions" below, then build.

1. **What is the airport FOR?** Pick the main thing: (a) a place to explore and do errands (pick Bubbe up from
   arrivals, drop Abba at departures, a taxi-line job), (b) a way to TRAVEL somewhere (a flight to a new place, or to
   the Story Trip's far stops), (c) both. *Suggested default: (a) first, with the door left open for (b).*
2. **Do planes go anywhere?** If yes: where (Vegas from the Story Trip? Israel? Florida — Bubbe's?), and is the
   destination a new map (big) or a short scene (small)? *Suggested default: not in the first version.*
3. **How much can she walk into?** Kerb + parking only · a terminal hall (check-in, a cartoon security line, a food
   court, a gate with a window on the runway) · more. *Suggested default: one terminal hall, done well.*
4. **Can she drive / walk onto the runway?** (Funny, but it needs fences, security chasing her, planes that react.)
   *Suggested default: no — a fence, and a great joke when she tries.*
5. **Where on the highway?** Its own interchange (after the towns' exits? how far from home?) or a third branch at
   the existing interchanges. *Suggested default: its own interchange, signed "✈️ JFK", further out than the towns.*
6. **Real name or parody?** "JFK" on the signs is fine; airlines, shops and logos should be parodies (Kugel Air,
   El Oy…). Any names the owner wants? *Suggested default: JFK + parody airlines.*
7. **Who is there?** Family (Bubbe arriving with five suitcases), Avigail off to somewhere, Uncle Moishe "importing"
   things, a mystery singer on tour (Dovid Dov canon: he is Lulu's brother; family and Avigail know, strangers don't)?
8. **Jobs and the daily list?** Airport taxi runs for the side jobs, "pick up Bubbe from JFK" on Ima's list, a lost
   suitcase to return? *Suggested default: one of each, capped like the existing ones.*
9. **With friends?** Everyone can go; the terminal is a shared room; anything else (racing luggage carts)?
10. **The law at the airport?** Cartoon airport security instead of town police? What happens to a fugitive there?
11. **Must-have jokes or things to avoid?** (For example: nothing about real incidents or real security procedures —
    keep it a cartoon.)
12. **Order of delivery?** Suggested stages below — does the owner want something earlier?

## A suggested shape (a starting point for the conversation, not a decision)

- **Stage 1 — the exit and the kerb.** A new interchange with "✈️ JFK" signs; an approach road, the departures /
  arrivals loop, a parking lot, taxis and shuttle buses, planes taking off overhead (cheap: a few instanced planes on a
  path, sound, a shadow sweeping the road). Driveable and walkable, no cut, back out the same way.
- **Stage 2 — the terminal.** One walk-in hall on the interiors engine (shared with friends): check-in desks, a
  security line that is one long gag, a food court, a gate with a window on the runway, an arrivals door where people
  come out.
- **Stage 3 — things to do.** The family errands, a side job, an Ima's-list item, a couple of characters.
- **Stage 4 (only if the owner wants travel).** A flight as a short scene to somewhere.

Implementation hint: the attached-town engine (`features/town`, one data file per place in `towns/<id>.js`, `attach`,
`highway`) and the rest-area engine (`features/exits`) are the two existing ways to hang a place off the highway. An
airport is not a street grid, so decide early which one fits — or whether it is a new small engine that borrows the
interchange and the slicing ("built in small pieces ahead of her") from them. Ask the `ci/oneworld` notes in
`AGENTS.md` §6/§7 before touching the interchange planner: towns are ROTATED to face their interchange, and "every
interchange offers both towns" is assumed in several places.

## Ground rules so the two accounts never collide

1. **Your branch is `ci/airport`.** Push work-in-progress there after every commit. Keep your row in `AGENTS.md` §6
   current (what is done, what is next, what you touched outside your folder).
2. **Your code lives in a new folder, `3d/js/features/airport/`** (plus `3d/blender/assets_airport.py` and its
   `.glb`), registered in `features/index.js`, with its own test file(s) `scripts/tests3d/airport*.js`, a section in
   `3d/ARCHITECTURE.md`, a line in `CLAUDE.md`'s feature list and rows in the party parity table.
3. **Shared files: small, additive edits only**, and say so in the Sync log below. The ones you will probably need:
   the interchange / exit planner in `features/town` (owned by the `ci/oneworld` follow-up work), `world.js` (chunk
   slicing), `features/day` (an Ima's-list item), `features/hustle` (a job), `features/together/rooms.js` (one line
   to share the terminal), `features/phone` (the map). Prefer hooking in through `ctx` (events, hooks,
   `ctx.foot.addSpot`, the interiors registry) over editing another feature's file.
4. **Do not touch**: `server/` and the relay deploy workflow, iOS ids / signing / AdMob IDs, the classic 2D game
   (`src/`, `game.js`), and the folders the in-flight agents own right now — see `AGENTS.md` §6 for the live list. At
   the time of writing: `ci/shops` (`features/garage` shop flow + new shop rooms), `ci/bankfriends` (`features/heist`
   party behaviour), `ci/partners` (`features/law` party behaviour + `features/partners`), `ci/courts` (court lines),
   `ci/oneworld` follow-ups (the town engine: town life starting earlier, the chase hand-over at the town line),
   `ci/qa` (camera + on-foot fixes, the watchdog).
5. **Merge `origin/main` into `ci/airport` at least daily** (main moves fast — several landings a day). Keep both
   sides in conflicts, and check for leftover conflict markers before every merge commit
   (`grep -rIl "^<<<<<<< \|^>>>>>>> " --include=*.js --include=*.md .`).
6. **Landing is yours, in stages, straight to `main`** (the owner's standing instruction — no pull request, no waiting
   for the other account): merge main → `node build.js --check` → `node scripts/copy-web.js` → tests green
   (`core,platform,skip,ux,music` + your `airport` tests + `town`, `midwood`, `exits`, `flow`, `home`, `day`, and the
   tests of anything you touched; use `scripts/lib/qawatch.js`, the per-frame watchdog, in your own tests) → push to
   `main` → confirm lulu.boats serves it. A stage that is tested and additive lands without anyone else doing anything.
7. **Budgets**: measure the airport like a town (triangles, draw calls, worst slice in ms, frame time on LOW / MEDIUM)
   and write the numbers and the limit into your test and into `AGENTS.md` §7.
8. **Flow rules**: no hard cuts, no black screen while she has control, nothing built in one long frame, scenes
   skippable, no countdowns.
9. **No AI model names in commits or code. No secrets in commits.**

## What the coordinator's side promises

- Its agents are told (via `AGENTS.md` §6) that `ci/airport` exists and owns `features/airport/`; none of them will
  create or edit that folder.
- When one of them must change something the airport depends on (the interchange planner, `world.js` slicing, the
  shared-rooms list, the HUD budget), it notes it in the Sync log below in one line.
- If the airport needs a change in a file an in-flight agent owns, write the request in the Sync log (what, why, the
  smallest version) — the coordinator reads this file whenever it merges main, and will route it.

## Decisions (fill in from the owner's answers)

| # | question | the owner's answer | date |
|---|---|---|---|
| 1 | what the airport is for | **Travel** is the long-term purpose. The first version builds everything up to the flight (exit, kerb, terminal with check-in, security, departures board, gate); the flight itself is a later stage | 2026-11-20 |
| 2 | do planes go anywhere | **Not in the first version.** Planes take off overhead and she watches from the gate. A flight (destination TBD) is stage 4 | 2026-11-20 |
| 3 | how much is walk-in | **One terminal hall, done well**: check-in, the security-line gag, a food court, a gate window on the runway, the arrivals door | 2026-11-20 |
| 4 | the runway | **No**: a fence all round, and a great joke when she tries (Segway security / a giant plane horn) | 2026-11-20 |
| 5 | where on the highway | **Its own interchange, signed ✈️ JFK, further out than the town exits** (waits for `ci/exits2`'s split interchanges) | 2026-11-20 |
| 6 | names | **JFK on the signs + parody airlines / shops / logos** (Kugel Air, El Oy, Shmear Jet…; the agent writes the jokes) | 2026-11-20 |
| 7 | who is there | **Dovid Dov on tour** (family knows he's Lulu's brother; strangers don't). Not chosen: Bubbe arriving, Avigail, Uncle Moishe | 2026-11-20 |
| 8 | jobs + the daily list | **Airport taxi runs** (hustle side job), **a lost suitcase** to return, **a Dovid Dov meet-up** — each capped. Not chosen: an Ima's-list item | 2026-11-20 |
| 9 | with friends | **A shared terminal** (friends see each other inside, like the bank / houses); jobs + scenes stay personal. No luggage-cart races for now | 2026-11-20 |
| 10 | the law there | **Cartoon airport security** instead of town police (Segway guard, a sniffer dog that only finds kugel); if she's wanted, security slows her and the real cops can catch up | 2026-11-20 |
| 11 | must-haves / avoid | **Cartoon only**: parody airlines, nothing about real incidents or real security procedures | 2026-11-20 |
| 12 | order of delivery | **The suggested order**: 1) exit + kerb loop + parking + planes overhead · 2) the terminal · 3) things to do (taxi runs, lost suitcase, Dovid Dov) · 4) later: a real flight | 2026-11-20 |

## Sync log (newest first — one line each, both accounts write here)

- 2026-11-21 · airport-stage3 · STAGE 3 LANDED on main. In the hall (a stage-2 builder): 🧳 the lost suitcase (Mrs. Shpilkes by ARRIVALS; 15 💰 once a real day) and 🎤 Dovid Dov on tour down the VIP carpet (SOLO only; ~40 % of visits; fans + Officer Segal; 10 💰 once a real day + the badge 🎤 Front Row); the hall's bottom hint no longer says "borrow a car". 🚕 JFK TAXI RUNS (`ctx.hustle.register("jfk_taxi")`, 40 💰 × 3 a real day) are built + tested with a pretend kerb but are OFF until stage 1 lands. **For stage 1 (`ci/airport`):** nothing to change — stage 3 reads `ctx.airport.on`, `planned`, `inside`, `ready` and `debug.world(24, 193.5)` (the ARRIVALS kerb lane, short of the taxi queue at f 70) and listens to `airport:enter` / `airport:leave`. Nicer: expose `ctx.airport.kerb = { pickup() → {x, z} }` and stage 3 uses it first. When you land, run `airport-stage3` with `airport` and keep `import "./airport/stage3.js"` after the terminal's line in `features/index.js`.
- 2026-11-21 · airport-stage3 · STAGE 3 (things to do) started on `ci/airport-stage3`, in its own files only: `features/airport/stage3*.js` (+ `scripts/tests3d/airport-stage3.js`). It hooks into the hall through `ctx.airport.terminal.addBuilder` / `vip()` and reads stage 1's `ctx.airport` (`on`, `planned`, `ready`, `inside`, `debug.world(f, r)` for the ARRIVALS kerb) — every stage-1 call guarded, so it is a no-op until `ci/airport` lands. It does not edit `index.js`/`life.js`/`terminal*.js`. One line added to `features/index.js` (after the terminal's). **For stage 1:** if you'd rather expose the kerb pickup point as a real API, `ctx.airport.kerb = { pickup() → {x, z} }` is the one stage 3 tries first.
- 2026-11-20 · airport-terminal · STAGE 2 LANDED on main (behind the airport flag: only stage 1's doors or `ctx.airport.debug.enterTerminal()` get her in). `ctx.airport.terminal = { enter({ door, exit }), canEnter(), warm(), ready(), inside, vip(), addBuilder(fn), tune, debug }` — `ci/airport`'s life.js door already matches it. Shared: `together/rooms.js` › `SHARED.terminal = "jfk"` (one instance; friends' doors within 80 m), presence "✈️ in the JFK terminal". The hall has its own plane + Segway props (`airport_terminal_props`); when stage 1's `airport_plane` lands the window could reuse it (cosmetic). **Stage 3 hooks:** `addBuilder(fn(rt, api))`, the empty VIP carpet by ARRIVALS (`vip()`, for Dovid Dov), `debug.arrive()`, events `airport:*` (see ARCHITECTURE › Airport › Terminal). Budget: MEDIUM ≤ 110 calls / 140k tris, LOW ≤ 110 / 110k (measured 71–90 calls).
- 2026-11-20 · airport-terminal · STAGE 2 (the terminal hall) is being built on `ci/airport-terminal` in its own files: `features/airport/terminal.js` (+ `terminal-data.js`, `terminal-crowd.js`), `assets_airport_terminal.py` → `airport_terminal(_props).glb`, `scripts/tests3d/airport-terminal.js`. It does NOT create `features/airport/index.js` (stage 1's): `features/index.js` imports `./airport/terminal.js` directly (keep both lines when merging). **For stage 1's doors:** call `ctx.airport.terminal.warm()` within ~22 m and `ctx.airport.terminal.enter({ door: { s, d, side } })` from the doors' ✋ spot (check `canEnter()` first) — foot resumes at `door` on the way out; stage 1 may define `ctx.airport` itself: the terminal re-attaches `ctx.airport.terminal` + `ctx.airport.debug.enterTerminal` on `boot` (so keep `ctx.airport` an object you extend, or assign before boot). If the airport becomes a town zone (`features/town`), add `"terminal"` to heist/bank.js `TOWN_INTERIORS` or the town will send her back to the highway on the way in. Shared files touched: `features/together/rooms.js` › `SHARED.terminal` (one line), `scripts/tests3d/perf.js` (an opt-in `terminal` scene).
- 2026-11-20 · airport · the owner answered all 12 questions (Decisions above). `ci/airport` created from main. Stage 1 (exit + kerb loop + parking + planes overhead) starts in `3d/js/features/airport/`; its interchange waits for `ci/exits2` to land — until then I build the airport place itself and hang it off the highway behind a test flag. I will log here before touching the interchange planner in `features/town`.
- 2026-11-20 · coordinator · HEADS-UP for question 5 (where on the highway): the owner asked that Lakewood and Midwood
  stop sharing one exit — `ci/exits2` (the town-engine agent) is splitting them into separate interchanges now, and
  Lulu's house is moving into Midwood (`ci/hometown`). The interchange planner in `features/town` will change shape:
  wait for `ci/exits2` to land (see `AGENTS.md` §6) before hanging the airport's interchange on it. New buildings in
  towns are claimed in `AGENTS.md` › "Town lots" — the airport is its own place and needs no town lot.
- 2026-11-20 · coordinator · plan file created; `ci/airport` row added to `AGENTS.md` §6 and roadmap row 12 to §2b.
  Nothing built. In flight on the coordinator's side today: `ci/shops`, `ci/bankfriends`, `ci/partners`, `ci/courts`,
  `ci/oneworld` follow-ups, `ci/qa`.
