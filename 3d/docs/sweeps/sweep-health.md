# ci/sweep-health — tests red on main + the bugs behind them

Sweep agent notes (rules: `RULES.md`). Started 2026-11-27 21:30 UTC.

Starting point: "3D full suite" run 46048987239 on dd56065 (2026-11-27 18:22Z) failed; 45985729938 (10:52Z) was the last green.

## Failing checks

Main's own recent "3D full suite" dispatches were targeted (a few files each), so the list also takes the two whole-suite
runs of `ci/fasttests(-slow)` at 0cca3d3 (13:23Z, main + the fast-clock branch: 46006762536 slow clock, 46006757882 fast)
and `ci/fasttests-slow` 46049897488 (18:29Z).

| check | run | verdict / status |
|---|---|---|
| qa27 — the watchdog: no jump glitch (camera 5 m in a frame at the highway's court / hospital) | 46048987239 | the test's own teleports; fixed by `ci/qa` 5a03010 (18:43, on main) |
| calm — solo highway ≤ 18 pop-ups a minute (20: banner 4, speech 7, toast 5, bubble 4) | 46048987239 | real: a pothole showed a "🕳️ POTHOLE!" toast on top of Lulu's pothole line (two pop-ups for one bump; twice in that minute). Toast removed (like the old SPLASH toast) — this branch |
| unstuck — `Installation process exited with code: 100` | 45996797903 | CI machine's apt install, not the game (unstuck's real failure in the fast run is `ci/fasttests` bc1e2cd: the rescue log is capped at 30) |
| world — the family app lists who lives where | 45990798461, 46006762536 | stale: the 🏡 Family app became a 📞 Contacts entry (roadmap 39, `ci/qa` 5fd5e0e, test updated); green locally on main |
| exits — interchange triangles ≤ the same highway + 80k (242k vs 86k) | 46006762536, 46006757882, 46036938441, 46049897488 | investigating (last green 45968955181 at 08:51: 168k vs 222k — the highway baseline got much cheaper AND the T got +74k) |
| qa18 — 📱 for a fresh player: nothing unread (badge 1) | 46006762536 | investigating |
| qaweekend — Lakewood on foot in the rain: no flat glitch | 46006762536 | watchdog; re-check on a fresh run |
| qa — Lakewood monkey run: no hidden glitch (Lulu invisible ×130) | 46006762536 | re-check on a fresh run |
| qol — parking: the hint names reverse | 46006762536, 46006757882 | stale test: since fb51215 the hint speaks the device's words (a controller: "LT goes back"); test checks the intent now — this branch |
| footbounds — the ride pulls onto the shoulder (timed out in footWedding) | 46006762536 | the random on-foot wedding is gone (`ci/family` 0434adc: it plays at the hall); green locally on main |
| courts — the docket checks | 46006762536 | fixed on main (`ci/docket`); green locally |
| impound — the line now says: the slip ✓ → the gate | 46006762536 | fixed on main (5acab08); green locally |
| qa15 / cityhall — a ribbon cutting starts up her sidewalk | 46006762536 / 46006757882 | green in the other run; re-check on a fresh run |
| multiplayer — di = s × 56000/4800, ghost, emote, daily board | 46006762536 | green locally on main (`ci/fasttests` keeps the old clock for it) |
| partners — one court clock | 46006762536 | fixed on main (`ci/friends` a6bd69f) |
| onegame — next to Dina: ✋ PLAY AS DINA (got 🏠 GO INSIDE) | 46049897488 | re-check on a fresh run |

## Findings + status

## Left for other branches

- `ci/fasttests` (other account, moving) is reworking test timing (the fast test clock): timing flakes that its
  clock work covers are left to it — its test fixes not on main yet: unstuck (bc1e2cd), crime2 (7136f90),
  movetouch / movement / playgate (06647cf), hometown / partners / partyhang / together opt-outs.
