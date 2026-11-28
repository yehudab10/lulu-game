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
8. **Midwood's precinct answered the phone as "Precinct 18½"** (the highway precinct's name) — fixed the same night on
   main by another sweep (their line kept).

9. **Walking out of East Midwood Lanes left her on the highway, ~480 km from Midwood** — the alley wasn't on the list
   of town rooms that keep the town (`heist/bank.js` TOWN_INTERIORS): going in quietly unloaded Midwood, and coming out
   put her at the door's road position on the HIGHWAY (no town, nowhere near her car). Added. — fixed
10. **The street's banners followed her inside / a room's banner showed up in the next place** — the town's "WELCOME
   TO MIDWOOD" inside the clothes shop, the pizza shop's "Slice of Sinai" banner in Borough Hall; and on a phone a room's
   title banner drew under its own chips for its first seconds. Rooms drop the street's flavour banners on the way in,
   their own title on the way out, and the banner tucks under the chips indoors (`hud.js` dropBanners / bannerCompact,
   `interiors/engine.js`). — fixed
11. **A friend's nametag right by the camera filled a phone** ("Kugel Kid" in giant letters across Borough Hall) —
   `together/rooms.js`: the tag keeps one size on screen and hides when it's on top of the lens. — fixed
12. **Rooms' long speech bubbles were squeezed into one thin unreadable strip** — they wrap now (`interiors/fx.js`). — fixed

13. **Walking into a house on a phone: one flat grey screen** — strangers' houses, Ima's house, a home for sale: the
   camera starts behind her, right inside the front door model, and the room's camera only ever looked at a room's
   MODEL — the houses, the clothes shop, the lanes, the shops are built in code, so their walls never stopped the lens
   and their furniture / front door never faded. `interiors/engine.js` rayRoots(): the camera's clip, the fading and
   the test probe see the code-built pieces too (the door fades, the room shows). — batch 2 (rooms that merge their
   boxes — City Hall's bake() — take the originals out: only what's still in the scene counts)
14. Test artefacts found + fixed in the sweep test itself (not game bugs): the parked car is the foot stub, not
   ctx.car; a teleport needs the watchdog's moved(); street counters (makolet, Bling Bay) open a card on the street;
   the impound gate only opens on an impounded car; carcare's fronts play on the street; a fake house / listing.

## Landed
- batch 1 → main d1e1ea71 (items 1–7, 9–12) · batch 2 → fc833998 (13, 15) · batch 3 → 4fd9e37b (16 + Lakewood's shul door).
- CI: 46070200525, 46075301278, 46084222813 (incl. calm + hudfit green), 46091087093; later batches on the local fast
  clock (core, platform, doors, qa, qa2, qa3, qa7, qacar, qafoot, qaseam, qatown, foot, movement, moves, unstuck,
  interiors, shops, clothes, decor, realestate, lanes, homes, family, shul, cityhall, heist, qaplaces, sweepplaces 1–4).

## Next (not started — for whoever picks this up)
- Two ✋ too close in strangers' houses: e.g. "Grab the leaf blower" vs "Grab the broom", "Talk to Mom" vs "Grab the
  seltzer" — standing at one, facing it, the prompt is the other (houseitems pickups placed by `homes/house.js`).
  Logged by sweepplaces3 ("standing at it, the prompt is …"); a spacing rule when the pickups are placed would fix it.
- The one-joke shopfront room on a phone: the camera sits right behind her and her head hides the shopkeeper (a small
  room: the camera is pulled in). A higher / further-to-the-side camera for `storefronts/room.js` would help.
- The clothes shop's "💳 Pay at the counter" ✋ only shows the clerk's hello (buying happens at the racks) — the label
  promises more than it does.
- Party: Borough Hall / the realtor are shared rooms already (friends see each other) — fine.

## Left (owner's call / not a fix)
- (Lakewood's shul door — the camera inside the yeshiva building: fixed with item 16, batch 3.)
- Yanky's makolet's sign says "closed Shabbos · it's complicated", but none of the big places (makolet, clothes, pizza,
  bakery, bank, realtor, city hall, the lanes) close on Shabbos while the shopfronts do. Closing them is a design call.

15. **A room's speech bubble rose off the top of the screen** (its first lines cut, e.g. the pizza shop's wall of fame
   at 1280 × 720) — it comes down until its top is on screen (`interiors/fx.js`). — batch 2

16. **Out of a neighbour's front door: one flat beige screen** — the camera behind her (facing out) started inside the
   house: a town block's camera outline (`town/plan.js` OCCLUDERS, FRONT + 1.2) sits ~2 m behind the houses' front
   walls, and the camera only stopped CAM_PAD (0.25 m) short of it. `foot/jump.js` camClip: the lens stops 2.4 m
   further out (at the walls). Same cause as Lakewood's shul door below (the yeshiva protrudes 1.2 m more). — batch 3

## For other sweeps
- for `ci/sweep-health`: `storefronts` › "lakewood: the town's signs stay sharp" is red on main since ci/yeshiva landed
  (02:12): Lakewood's sign atlas scale 0.578 < 0.58 (the yeshiva's new signs) — not from this sweep.
- the fast test clock (ci/fasttests) draws a small canvas every 6th frame: page screenshots at 1280 × 720 inside rooms
  come out one flat sky-blue (not a game bug — the rooms render; seen in `doors`' room shots)
- for `ci/sweep-logic`: free coins from interiors' one-off ✋ (precinct coffee +30, hospital vending +5, Heshy +4…)
  were "once per interior per RUN" — done by ci/sweep-logic (once a day now).
