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
| accounts — A sees B's USERNAME over B's car (got "Pink 56"), then names back on / the report row | `ci/oneserver-place` landed + quiet → mine. Probe (46131740184): B sees A's name; A asked the server about B's ticket and got null (cached 10 min). Investigating (probe 2: what A sends to /acct/names) |
| playershopsworld — threw: "Execution context was destroyed" (B's page navigated at line 108) | investigating |
| shul — midwood friday: nobody stands inside a wall (kid) | investigating (part 1 fixed Lakewood's kid) |
| calm — on foot in town ≤ 12 pop-ups a minute (banner 2, bubble 10, toast 3) | investigating |
| streets — a cop SAW it → an instant chase (CARJACKING) | cops → `ci/sweep-road` |
| schlepnav — …still self-driving in town | `ci/sweep-road` (part 1 left it there too) |
| qa27 — 10.7 km hospital: the room went away in a corner (2 viewports); qaweekend — home → highway: the camera inside block@128,195 | camera → `ci/sweep-camera` |
| partyworld — paused in a party: never rolls backwards (min vF -16) | party → `ci/friends` (moving) |
| movement — a coach line names the jump the first walks (empty) | stale test: since `ci/sweep-phone` 55881dd9 (one hint at a time) the moves coach waits while the 6 s "you're on foot" hint is up. The test waits for it now |

## Findings + status

## Left for other branches
