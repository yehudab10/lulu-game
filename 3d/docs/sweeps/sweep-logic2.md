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
| 4 | Two features' lines at once: a second `say` / `choose` opening over one still waiting replaced it without answering it — the first feature's `await` hung forever (its "busy" flag stuck for the run). | `core/dialog.js` | **fixed (defensive)** — the covered line / question answers -1 ("closed", like `closeDialog`) |

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

## For other branches

## Landed

## What's left
