# ci/sweep-logic2 — game logic part 2: state, dead ends, two things at once

Sweep started 2026-11-28 08:40 UTC (rules: `RULES.md`; part 1: `sweep-logic.md`). Scope: every state / screen has a way
out; two things at once; where an activity's end leaves her (and her car); one "today"; names / numbers that disagree;
the playershops till. Test: `scripts/tests3d/sweeplogic2.js`.

## Findings

| # | what the player sees | where | status |
|---|---|---|---|
| 1 | Two clocks. In a Cruise day the sky runs its own ~9-minute day (the 📱's clock and the households' schedules follow it), but shop doors, the car-care row and the school-zone speed cameras read the DEVICE's clock: "🕐 CLOSED · opens 7 am" under the noon sun with the 📱 saying 12:40 pm; shops open under the stars at 1 am; a school-zone camera flashing at night. Proved in the game (sweeplogic2 §1, before the fix: a 7–7 shop open at sky-midnight, closed at sky-noon). | `storefronts/hours.js` (clock), `cameras/index.js` `schoolHours` | **fixed** — `worldNow()`: the real date (weekday, Shabbos, holidays) at the hour the sky shows while the Cruise day runs (the title / a Story Trip / tests without atmos: the device's time, as before). The sky's "next morning" is still today's weekday ("opens 7 am", not "opens tomorrow" / "Sun"); on Shabbos / Yom Tov the "opens …" line reads the real clock. School cameras: never on Shabbos / Yom Tov (a Friday night by the real calendar). The 24 HR Gas & Gossip keeps the real hour (it's today's schedule: protests' hours, a new tip each real hour). `carcare` test pins the sky at late morning |
| 2 | ☰ Options (a controller) in the middle of a question ANSWERED it — it's "start" too, and "start" advances a line / picks the highlighted answer ("Yes, buy it"). | `core/dialog.js` `dialogUpdate` | **fixed** — ☰ / Esc pause the game (the question waits) |
| 3 | Paused with a question open (the tab went to the background — every phone app switch pauses) → ✕ / Enter on "▶ Resume" went to the QUESTION behind the pause card (picked its answer), and the pause card got nothing; a line with an auto-advance kept running behind the card. | `app.js` `step` | **fixed** — while paused, the pause card has the controls; the question waits |
| 5 | One activity at a time had holes: a 🚑 ambulance patient run (the ER clock), Uncle Refael's 60 s test drive and the 🔦 Shomrim on her tail (filming, about to call the cops) weren't on `ctx.engaged()`'s list — a robbery to foil, a snatcher, a cameo, the Fixer's / a job's offer could start on top (the owner's friend's "five chips at once"). And the ambulance's dispatcher sent her to a patient in the middle of a robbery / a side job (it only checked a police chase). | `rides/ambulance.js`, `shops/dealer.js`, `community/shomrim.js` | **fixed** — each adds its activity (`ride`, `testdrive`, `shomrim`); dispatch waits while she's in something else |
| 6 | Arrested (or taken to the ER) with a hitchhiker / a parade marcher / Dina in the passenger seat: they sat through the booking, the cell and court, and she drove out of jail with them still there — the 2× coins still to come. (Getting out on foot already let them go; Avigail's ride ends on foot too.) | `roadevents/passengers.js` | **fixed** — they're let go (quietly) at the arrest / the ER; a job's own rider (`keep`) stays |
| 7 | (with #1) Inside the shul / the yeshiva, what's on (davening, kiddush, the shiur) followed the device's hour while the 📱 showed the sky's. | `shul/room.js`, `yeshiva/room.js` `plan()` | **fixed** — the same `worldNow()` hour |
| 8 | Riding in a friend's passenger seat past a speed camera: her own (hidden) car rides along at the friend's speed, and the camera flashed HER — a ticket in the mail for the friend's driving (the ride promises "she's never ticketed or chased for the driver's driving"). | `cameras/index.js` `noTicket` | **fixed** — no ticket while riding |
| 9 | 📝 Ima's list "🚪 Pop into a shop on foot" never ticked in the town's shops — the one-joke walk-ins (most shopfronts in Midwood + Lakewood) entered without the stat the list counts; only the pizza shop / bakery / clothes / the lanes / the highway's rooms counted. | `storefronts/index.js` `enter` | **fixed** — a walk-in counts |
| 4 | Two features' lines at once: a second `say` / `choose` opening over one still waiting replaced it without answering it — the first feature's `await` hung forever (its "busy" flag stuck for the run). | `core/dialog.js` | **fixed (defensive)** — the covered line / question answers -1 ("closed", like `closeDialog`); `script()` stops at a -1 (a closed / covered line), so an old conversation doesn't keep talking over the new one |

## Checked and fine

- `playershops` till (part 1's "what's left"): the till lives on the relay (`server/shops.mjs` `/shops/collect` sets it to 0 in
  the same request that hands it over); the client adds what it was handed. A reload / a new run asks again and gets 0. No
  local (offline) selling. Nothing to fix.
- Side jobs: their clocks count `update` dt (driving only) — a cutscene, a room, the 📱 or ❚❚ stop them; on foot / a wreck /
  any of the law's states the job fails cleanly (`hustle/jobs.js`).
- Random phone calls (Ima's mid-drive call etc.) are OFF in the game (`phone.randomCalls`, the owner's switch); the ones
  the player makes ring anyway. A call hangs up on any state change.
- The 📱 pauses the world (the same pause as ❚❚). A background tab: ❚❚ (pausable states), and requestAnimationFrame
  stops; on return a frame is at most 0.05 s — nothing jumps.
- Per-day keys: all LOCAL dates except the daily streak / weekly quests (UTC, shared with 2D — part 1). The seasons stall
  treat is keyed by the civil date (not the Hebrew day that rolls at sundown) — no double treat at sunset.
- Clothes' limited pieces: paid → `pending` in the save → the next launch confirms or refunds.

## Owner may want to decide

- The road's 🚑 "Ambulance coming up behind you!" (pull over → "Good citizen! +50") still starts during an activity (seen in
  an `enable=all` highway run: mid road-rager encounter). It's traffic, not an offer card — left; gating it with
  `ctx.engaged()` like the drive-thru / ice-cream van would be one line in `roadevents/index.js` (the `ambulance` spawn).

- **The town's EVENTS still run on the real clock**: City Hall's protests (`PROTEST_HOURS`, e.g. lunchtime), the
  "wrong address" picket (lunchtime) and public comment night (evenings), the "back in 5 minutes" window (changes each
  real hour) and the 24 HR Gas & Gossip (a new tip each real hour, quoting those hours). Everything the player can SEE the
  hour of — the sky, the 📱 clock, households, Fayge's day + the Avenue M Ballroom's wedding, shop doors, car care, school
  cameras, the shul / yeshiva — now follows the sky's ~9-minute day. Moving the protests to the sky's clock would make each
  one last ~45 real seconds per cycle (2 sky-hours), so they were left on the real clock; Bracha's gossip ("a protest in
  Midwood today, 12 pm–2 pm") can then disagree with the 📱. Options: show the device time on the 📱 (and drop the sky's
  day), or lengthen the sky's day, or make the events' hours sky-hours with longer spans.

## For other branches

- for `ci/sweep-health` (red on plain main, 2026-11-28 09:15 — checked locally with main's `3d/js`): `fuel` › "an exit is
  planned" (`ctx.town.debug.X.exits` stays empty after 15 s; town pump / charge / dry then throw) and `movement` › "a coach
  line names the jump the first walks" (ci/sweep-phone's `foot/index.js` coachHint now waits while a walk hint is up — the
  first-ever walk hint stays until she's in the car). Both red with or without this branch.
  Also `qa27` › "hospital (roadsideHatzalah): in every corner the camera stays inside… (the room went away)" + "👜 …inside:
  no wall" — red locally on plain main too (rooms / camera: ci/sweep-camera's area now).
  Also `parking` › "level 1 pays 1×25 + 15 per ★ to the shared wallet" (500 → 500 with 3 ★) — red locally on plain main too.

- for `ci/sweep-phone` (the 📱): the handset's clock (`phone/ui.js` `clock()`) shows the sky's hour only when
  `G.mode === "cruise"`; in a 🎉 party run the sky is the party's (atmos `mode` "cruise") but the 📱 shows the device's time.
  `storefronts/hours.js` `worldNow()` is the one clock now (the sky's hour whenever atmos runs the Cruise day) — the 📱
  could read it too. Not edited here (the phone is that sweep's).

## Landed

## What's left
