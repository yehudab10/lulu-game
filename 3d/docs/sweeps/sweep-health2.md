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
| accounts — A sees B's USERNAME over B's car (got "Pink 56"), then names back on / the report row | `ci/oneserver-place` landed + quiet → mine. Probe (46131740184): B sees A's name; A asked the server about B's ticket and got null (cached 10 min). FIXED: probe 2 showed it — her lobby-bridge copy (net.js placeTick) carried her PLACE room's ticket into the lobby; A, still in the lobby, asked the server with (LOBBY, the bridge's id) → no; `ghostName` cached that no by ticket alone for 10 min, so on her real car in WL0 the same ticket stayed "Pink 56". The cache is keyed room + relay id + ticket now, a no is asked again after 30 s, the bridge copy carries no ticket (realestate's hidden-names reader follows the new key). Green: accounts, multiplayer (46143939884). Old note: `ghostName` caches the server's answer by TICKET alone, but a ticket is only valid with the (room, relay id) it was queued with — queued with a stale id / room (mid room-switch) → null for 10 min. Probe 2 (46143461305, branch ci/sweep-health2-probe, logs what A sends to /acct/names + every un change) was running when I stopped |
| playershopsworld — threw: "Execution context was destroyed" (B's page navigated at line 108) | not found in code (no reload / href in playershops); green on the re-run (46143677433): a flake |
| shul — midwood friday: nobody stands inside a wall (kid) | REAL: the Friday kid's loop ran along the kiddush room's archway dwarf wall (x 6.55 vs the wall's 6.52); loop moved (cx 8.05, rx 1.38) + shul.js now checks every kid's WHOLE loop, not one instant — green on CI 46143677433, landed 12:40 |
| calm — on foot in town ≤ 12 pop-ups a minute (banner 2, bubble 10, toast 3) | REAL (UX): her first idle line came 2.5–4.5 s after stepping out, on top of the walk hint + the town's arrival line (3 of her lines in ~3 s); a Route 9 jam could yell the same line twice running; weather toasts on foot said "hold the wheel" / "headlights on". Fixed on ci/sweep-health2 (first line 8–12 s in, no repeat yell, foot weather lines) — green on CI 46143677433 (calm: on foot 8 a minute), landed 12:40 |
| streets — a cop SAW it → an instant chase (CARJACKING) | cops → `ci/sweep-road` |
| schlepnav — …still self-driving in town | `ci/sweep-road` (part 1 left it there too) |
| qa27 — 10.7 km hospital: the room went away in a corner (2 viewports); qaweekend — home → highway: the camera inside block@128,195 | camera → `ci/sweep-camera` |
| partyworld — paused in a party: never rolls backwards (min vF -16) | party → `ci/friends` (moving) |
| movement — a coach line names the jump the first walks (empty) | stale test: since `ci/sweep-phone` 55881dd9 (one hint at a time) the moves coach waits while the 6 s "you're on foot" hint is up. The test waits for it now |

## Findings + status

## Left for other branches

## Where it stands (handed back 2026-11-28 ~12:40 UTC)

- On main: b3f41968 (fuel / parking / movement test fixes). Main's Smoke green on it.
- On `ci/sweep-health2`, NOT on main: the shul kid + loop check, the calmer on-foot lines (first idle line, jam yells,
  weather on foot). Land after CI 46143677433 (core, platform, shul, foot, movement, sweephealth · atmos, life, life2,
  town, playershopsworld, feel · calm) is green.
- accounts: probe 2 on `ci/sweep-health2-probe` (TEMP branch — never merge it). Read its `PROBE Alog` line.
- Next whole suite: once ci/sweep-road (landed c78e759a 12:25), ci/sweep-logic2 and ci/sweep-camera are in; last ~20:00.
