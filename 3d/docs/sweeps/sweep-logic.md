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
| 6 | Walking robberies (the easy flying tackle, ~110–135 coins each) were capped at 2 a RUN — Restart, wait ~95 s by a bank door, tackle. | `heist/robbery.js` `sched` | **fixed** — also `TUNE.robbery.footDay` 4 a real day (`f.heistFoot`); heist test checks it |
| 7 | The moped snatcher's +15 catch bonus repeats every few minutes she sits still (AGENTS §7 known issue). | `heist/snatch.js` `caught` | **fixed** — the bonus at most `PAY.snatchBonusDay` 3 a real day; what he took always comes back; the banner drops "(+15 bonus)" when there's none |
| 8 | Cookie Catch (Dina): a repeatable 30-second skill game paying its whole score, uncapped (a good round ≫ the 10 fee). | `dina/cookie.js` | **fixed** — banks at most `COOKIE_DAY_CAP` 300 a real day; past it the rounds are free ("Dina's piggy bank is full for today — more rounds are just for fun!") and still count for the best |
| 5 | `wallet.spend(-n)` PAID her n coins; `wallet.spend(NaN)` / `wallet.add(Infinity)` could write a non-number. No caller does it today, but a bad sum anywhere would. | `core/save.js` | **fixed** — spend refuses negative / non-finite (0 is free), add ignores non-finite |

## Judgment calls — owner may want to tune

- Combo coin daily cap 200, per-kind 3 (`COMBO_COINS` in `moves/common.js`).
- Couch coins 30 a real day (`COUCH.dayCap`) = the old per-run number.
- The daily login streak (`meta/progress.js`) rolls over at UTC midnight (7 pm in New York), while every other "once a
  day" thing rolls at local midnight. It's shared with the Classic 2D save's `dayNum` (same formula there), so changing
  one side alone would break the streak — left.
- Changing the device clock (back a day) re-opens every per-day cap. Normal for an offline game — left.
- The precinct's fines window costs 50 + 40 a charge, while a court "fine" verdict is the bounty (13 × the charges'
  weights, ≤ 400) and a plea is 0.3× that — turning yourself in at the window costs more than being caught and pleading
  (e.g. 1 jaywalking: window 90, court fine 13). It's the Classic 2D's own formula (`src/08e…` `polWantedFee`) and a fair
  "skip the cell + court" premium — left.
- Shops that are real gameplay (pizza, garage, clothes, dealers, City Hall, bank, realtor) stay open on Shabbos / Yom Tov,
  while the one-joke storefronts, the bowling alley and car care close. Closing gameplay shops would take things away on
  Friday night / Saturday — left; flag for the owner.
- ER paramedic perk (`rides/ambulance.js`): ≤ 30 coins each time she's admitted to the ER after driving patients; the ER
  has a free "RUN for it" option, so a wreck → run → +30. Slow (a wreck takes all her hearts) — left.
- 🌍 party games pay 20 a win with 2+ players, uncapped: two friends could trade wins. Slow (a game is minutes) — left.
- Cookie Catch 300 a day (`COOKIE_DAY_CAP`), robbery foot tackles 4 a day (`TUNE.robbery.footDay`).

## Faucet / sink table (2026-11-27, main @ 7e29128 + this branch)

The wallet is the Classic 2D save's `totalCoins` (`core/save.js` `wallet`); run coins go through `core/driving.js`
`addCoins(n, why)` (→ the wallet + the HUD + the `coin` event). ⭐ stars in rooms bank into the same wallet. "Run" = until the
next ↺ Restart / reload / title (cheap — see the pattern above), "day" = the device's local date unless noted.

### Faucets (coins IN)

| source | where | amount | cap | notes |
|---|---|---|---|---|
| road coins | `core/driving.js` chunk coins | 1–5 each | none — the core loop | not while self-driving (dealers) |
| party convoy doubling | `party/index.js` | = road coins | none | party only, by design |
| a passenger doubling road coins | `roadevents/passengers.js` | = road coins | the ride | |
| style combo | `moves/common.js` | ≤ 40 a combo | **200 a day + each kind ≤ 3× (this sweep)** | was uncapped + mashable |
| knock-out fee refund? | — | — | — | (the KO fee is a sink) |
| Hillel insurance | `cameos/crash.js` | 60–150 | **1 a day (this sweep)** | was 1 a run |
| sasquatch / uncle cameos | `cameos/roadside.js` | 8–50 | spawn-rate (rare) | |
| ER paramedic perk | `rides/ambulance.js` | ≤ 30 | each ER admission | see judgment calls |
| ambulance / bus / ice-cream van / taxi rides | `rides/*` | fares | the ride's own pace | work |
| hustle jobs (cab, delivery, getaway) | `hustle/*` | ~50–150 a job | none (work) | split with a crew, never multiplied |
| JFK taxi / lost bag / Dovid Dov | `airport/stage3*.js` | fixed | 3 taxis a day, bag + Dovid 1 a day | |
| chop shop | `streets/chop.js` | 90–180 | job offers every 60–100 s | a stolen car each |
| fixer / Velvel / bad guys | `underworld/*` | 10–230 | spawn-rate, heat | pickpocket refunds +2 / +4 |
| crime (street) | `crime/common.js` `payCapped` | per kind | per day per kind | |
| heist: own job | `heist/job.js` | ~360–420 base | 20 real min cooldown, warrant | |
| heist: foil a robbery | `heist/robbery.js` | 55–135 | driving: every 140–220 s; walking: 2 a run + **4 a day (this sweep)** | |
| heist: snatch / theft bonus | `heist/snatch.js` | bonus | spawn-rate | the taken coins come back |
| room one-offs (coffee, seltzer, ice cream…) | `interiors/*`, `rt.onceToday` | 2–30 | **1 a day per room (this sweep)** | was 1 a run |
| couch coins (burglary) | `homes/house.js` | 3–8 a house | 30 a run **+ 30 a day (this sweep)** | |
| homes favours | `homes/visits.js` `payJob` | per job | per type + DAY_CAP a day | |
| Ima's list | `day/index.js` | 15 an item, 40 home | once a day | |
| Erev Shabbos rush | `shabbos/index.js` | ≤ TUNE.pay.max | a real Friday | |
| Story Trip arrivals / tasks / jackpot / dice | `journey/trip.js` | stop reward × tour (≤ 3×) | each leg driven | work |
| Ima's call, story extras | `journey/phone.js`, `story.js` | 5–… | per call / once | |
| seasons stall treat | `seasons/index.js` | small | 1 a real day | |
| holiday gift | `meta/holidays.js` | per holiday | once per holiday key | |
| daily streak | `meta/progress.js` | 25 × streak (≤ 175) | once a UTC day | shared with 2D |
| weekly quests | `meta/progress.js` | per quest | once a week each | |
| City Hall story | `cityhall/story.js` | 5–10 | 15 a day | |
| real estate rent | `realestate/rent.js` | rent pile | accrues per real day | buy→sell always loses ≥ 3 % |
| party games (🌍 openworld) | `openworld/index.js` | 20 a win (2+ players), 5 a pin best | none | see judgment calls |
| partners (crimes for two) | `partners/index.js` | pot split | ≤ 2 a run each + per day | |
| dreidels chai milestone | `play/dreidels.js` | CHAI_COINS | every 18 collected | |
| Dina: run home / cookie / Morgan / nap | `dina/*` | run coins; cookie score | cookie **300 a day (this sweep)**; others +1 | |
| AdMob reward (iOS app only) | `native/ads.js` | ADMOB.rewardCoins | per KO, REWARD_KO_MAX a run | owner's monetisation — untouched |

### Sinks (coins OUT)

Garage (cars 150–2500, items 15–1000, horns 120–600, decorations 100–900), Bling, 🛋️ decor (house), 👗 clothes (+ limited
editions), 🏘️ real estate (buy / mortgage down + payments), 🏎️ dealers + EV subscription, the knock-out tow fee (10 + 5 per
earlier KO, ≤ 30), the ER bill (~25–130), Hillel's deductible (40–110 at fault), the law (bail 0.4×bounty, plea 0.3×, court
fine 1×bounty ≤ 400, bribe ≤ 120, lawyers, release fee ≤ 50, the precinct window 50 + 40 a charge), impound 120 (60 the first
time) / tow 60 / Tuvia's delivery, City Hall (tax, inspection "donation", expediter, wrong-address), 🅿️ parking unlocks, 🎨
re-paint (streets/paint), underworld bribes, crime (watches, monte, the permit), rest-area shops, the bar's courage, the beach
cabana (40), airport food, bowling + knish, the sticker book, Cookie Catch (10), lemonade (1), Dina's cookie fee.
