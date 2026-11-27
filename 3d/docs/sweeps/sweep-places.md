# ci/sweep-places — notes

Sweep: everything a player WALKS INTO or does on foot in the towns (see RULES.md). Test: `scripts/tests3d/sweepplaces.js`.

## Skipped (branch moving, not landed)
- `ci/yeshiva`, `ci/playershops`, `ci/dealers`, `ci/fuel`, `ci/roadside` (not on main, moved < 2 h before the start).

## Findings
(newest last; status = fixed <hash> / left + why)

1. **Street speech bubbles frozen over the room** — walk out of the car / out of one room ("No car? No problem.", "I'll
   leave it here…", a protester's line) and into a door within ~2 s: the bubble stayed on screen, frozen, for the whole
   visit (hospital, shul, clothes shop, realtor, precinct, Borough Hall — every screenshot). Cause: the ✋ / the doorway
   swaps the state INSIDE foot's frame; foot's exit() hid the bubbles, then the rest of the same frame showed them again
   (`foot/index.js` footUpdate → `showBubbles(...)`). Fix: foot's frame stops when the state changed under it. — fixed
2. **"Find a car to “borrow”" hint at the bottom of rooms** (controller / keyboard) — the 6 s hint from climbing out was
   only cleared by the street's frames, so walking straight into the hospital / shul / Borough Hall kept it for the
   whole visit (the airport terminal + the clothes shop had their own workarounds). Fix: foot's exit() clears it. — fixed
3. **Giant speech bubbles in rooms on a phone** — the clothes shop's selfie wall, the bakery's tzedakah box…: the
   room's 3D bubbles are 2.6 m wide; with the on-foot camera close to the walls (ci/doors) a bubble near the lens filled
   a phone held upright in giant clipped letters. Fix: `interiors/fx.js` Bubbles never wider than ~90 % of the view /
   a third of its height at their distance. — fixed
4. **B on a question did nothing** (controller) — "Head back outside? [Leave] [Stay a bit]", "[…] [Not now]": ○ / B
   was swallowed. Fix: `core/dialog.js` — B picks the question's never-mind answer when it has one (Not now · Never
   mind · Maybe later · No thanks · Just looking · Stay a bit · Leave it · Nah · ✖ / ‹ …); a question without one still
   waits for a pick. — fixed
5. **Shop doors contradicting their hours** — "GONE FISHING (back tomorrow, 8 am)" + "— opens 6 am"; the cholent
   place "(it's not Thursday)" on a Thursday afternoon; "Motzei Shabbos: we open 40 minutes after havdala" on a Tuesday
   morning. `storefronts/data.js` lines made to match. — fixed
6. **A shop was a hiding place from the police** — every town door (precinct, shul, city hall, clothes, lanes, the
   realtor, the counters) is shut while she's chased, but a shopfront walked her in. Now it says "Not with the police
   right behind her!" (and the doorway doesn't take her in). — fixed

7. **East Midwood Lanes' front said COMING SOON** — the alley is open (walk in, bowl), but its Avenue M front still
   had the "COMING SOON: EAST MIDWOOD LANES" sign and brown paper taped over the windows. Now its own sign, no paper
   (`storefronts/assign.js` + `index.js` buildLook, when features/lanes is here). — fixed
8. **Midwood's precinct answered the phone as "Precinct 18½"** (the highway precinct's name) — the line is generic now
   (`interiors/police.js`). — fixed

## Left (owner's call / not a fix)
- Yanky's makolet's sign says "closed Shabbos · it's complicated", but none of the big places (makolet, clothes, pizza,
  bakery, bank, realtor, city hall, the lanes) close on Shabbos while the shopfronts do. Closing them is a design call.

## For other sweeps
- for `ci/sweep-logic`: free coins from interiors' one-off ✋ (precinct coffee +30, hospital vending +5, Heshy +4…)
  are "once per interior per RUN" (`interiors/engine.js` RUN_USED) — a new run (title → ▶ PLAY) pays them again.
