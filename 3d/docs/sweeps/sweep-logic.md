# ci/sweep-logic — the game's rules, coins and state

Sweep started 2026-11-27 21:10 UTC. Scope: the economy (faucets / sinks / caps), the law, dead ends, per-day caps +
the calendar, the save, numbers that disagree. See `RULES.md`. Test: `scripts/tests3d/sweeplogic.js`.

Local browser note: the shared `/tmp/lulu3d-browser.lock` queue was 3–6 jobs deep all evening (other sweeps' long
files), so the proofs below are code reading + the CI "3D full suite" on this branch.

## The big pattern: "once a run" is not a cap

A RUN restarts for free: ⏸ › ↺ Restart, ⌂ Title → ▶ PLAY, a reload, going home (`onegame.home()`), a jail release.
Every `run:start` reset re-arms whatever was capped "per run". So any COIN reward capped only per run is a loop
(walk to it, take it, Restart, walk back). Hearts / nitro / score per run are fine (a new run refills hearts anyway).

## Findings

| # | what the player sees | where | status |
|---|---|---|---|
| 1 | The precinct's free coffee (+30), the bar's seltzer / clink / chip clip, the school bake sale, the hospital snack + Heshy's gelt, the beach ice cream (+25 +1): Restart → walk back in → paid again. | `interiors/engine.js` `RUN_USED` (per run) | **fixed** — `rt.onceToday(key)`: once per REAL day per room, saved (`f.interiors.daily`); a new run's room already knows (labels / "again" lines agree) |
| 2 | Couch coins in the neighbours' houses: the line says "Lakewood's pockets are closed **for today**", but the 30-coin cap was per run (Restart = 30 more). | `homes/house.js` `couch()`, `homes/data.js` `COUCH` | **fixed** — `COUCH.dayCap` 30 a real day across runs (`f.homes.couchDay`); the cholent line "no more hearts from cholent today" (a per-RUN heart cap, harmless) now says "for now" |
| 3 | Mashing the roll button on foot (or tapping the road on a phone: every tap is a dodge roll) builds the style combo to ×11 → ~27 coins every ~13 s, forever. No skill, no cap. | `moves/common.js` `bank()` (`multOf` counts every repeat) | **fixed** — the COINS count each kind of move at most 3× (`COMBO_COINS.perKind`) + 200 a real day (`dayCap`); the SCORE multiplier is unchanged. A real mix (drift / near-miss / slingshot / air…) still pays up to the old max. The Moves page blurb says "mix your moves" |
| 4 | Hillel the insurance adjuster: "you filed a claim TODAY already… one a day" — but the cap was `G.insurancePaid` (per run): Restart → another 60–150 payout. | `cameos/crash.js` | **fixed** — one payout a real day, saved (`f.cameosInsurance.day`); cameos test checks a second claim in a new run pays nothing |
| 5 | `wallet.spend(-n)` PAID her n coins; `wallet.spend(NaN)` / `wallet.add(Infinity)` could write a non-number. No caller does it today, but a bad sum anywhere would. | `core/save.js` | **fixed** — spend refuses negative / non-finite (0 is free), add ignores non-finite |

## Judgment calls — owner may want to tune

- Combo coin daily cap 200, per-kind 3 (`COMBO_COINS` in `moves/common.js`).
- Couch coins 30 a real day (`COUCH.dayCap`) = the old per-run number.
- The daily login streak (`meta/progress.js`) rolls over at UTC midnight (7 pm in New York), while every other "once a
  day" thing rolls at local midnight. It's shared with the Classic 2D save's `dayNum` (same formula there), so changing
  one side alone would break the streak — left.
- Changing the device clock (back a day) re-opens every per-day cap. Normal for an offline game — left.

## Faucet / sink table

(in progress — see the next commit)
