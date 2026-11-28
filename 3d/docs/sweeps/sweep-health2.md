# ci/sweep-health2 — keep main green (part 2 of `sweep-health.md`)

Sweep agent notes (rules: `RULES.md`). Started 2026-11-28 09:10 UTC; the owner is back 22:00 UTC.

Lanes right now (don't double-fix): camera cases → `ci/sweep-camera`; anything driving (traffic, law, cops, exits,
fuel, dealers, impound, `schlepnav`) → `ci/sweep-road`; state / dead ends → `ci/sweep-logic2`; accounts / multiplayer /
party* / qafriends / openworld relay → `ci/oneserver-place` / `ci/friends` while they move. Everything else red is mine.

## Whole suite #1 — 46129251917 on ci/sweep-health2 (= main 93b4110f), 2026-11-28 09:11Z

| check | verdict / status |
|---|---|
| fuel — "an exit is planned" timed out → town pump / charge / dry threw (8 checks) | test: towns are off in a test that didn't opt in (`ctx.enabled("town")`), so a run never plans its exits; the lap map used to plan them the first time something asked it mid-run. Since two-way round 4 the U-turn paint asks the lap map early and it's cached, so nothing re-plans after the run start's `clearExits`. Real game unaffected (towns on → runStart plans). The test plans the route itself (`ctx.town.exitOf`) — reproduced + checked on CI (probe 46130706764) |
| parking — level 1 pays 1×25 + 15 per ★ (500 → 500) | timing: the test read `localStorage` 20 frames after the park; the wallet writes ~0.8 s after coins come in (save.js scheduleFlush) and on the fast clock 20 frames are 0.33 s. Green on a re-run; the test flushes before reading now |
| movement — a coach line names the jump the first walks (empty) | stale test: since `ci/sweep-phone` 55881dd9 (one hint at a time) the moves coach waits while the 6 s "you're on foot" hint is up. The test waits for it now |

## Findings + status

## Left for other branches
