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

## Whole suite on main 46073386320 (dedf7de, 2026-11-27 21:55Z) — results as they came in

| check | verdict / status |
|---|---|
| qa4 — by her shoved car: ✋ GET BACK IN (got 🏘️ ENTER GOLD STANDARD REALTY → walked into the realty) | REAL: beside her own car's door she is ~2 m from its centre, so a shop door's zone (score floor 0.5) beat it. Her own car now counts as "right next to her" by its body (foot's NEXT_TO rule) — 2b96cbf |
| qa26 — 🗺️ Map: one tap pings + closes; a tap on the pinned place clears it | stale test: the first row is Ima's house, where she stands — the ping is "arrived" at once. The test pings a place she isn't at — 2b96cbf |
| qaweekend — phone, driving in Lakewood: HUD … off-screen jtext | test: a text message sliding in / out (jphIn / jphOut, wall-time CSS) is off the edge on purpose; the check skips one mid-slide — 2b96cbf (screenshot: nothing overlaps) |
| qaweekend — Lakewood on foot in the rain: no inwall / flat glitch (camera inside block@38,38 ×37; inside a tree's leaves ×26; a re-run: one flat colour in foot phase "script") | REAL but not pinned down: the end-of-mash screenshot (`3d-qaweekend-lakewood-foot.png`, run 46085361039) is a screen full of a street tree's leaves at the Feldmans' door. Always Lakewood's E-W street at z ≈ -3190 (x -100…-180). camClip's leaf rule skips a tree she stands under and a trunk between them; not reproduced locally yet — open |
| unstuck — ramp + rest area: no inwall glitch (camera inside a big tree trunk r1.4, ×2) | same family as above (Lakewood z ≈ -3189); 2 frames after a rescue — open |
| partners2 — bail paid at the desk ("She's not in a cell here.": the guest was already called to court) | timing: the cell's court clock is real time since a6bd69f (`ci/friends`); `ci/fasttests` gives partners2 the old clock — left |
| exits — interchange triangles (242k vs 85k) | stale test: the baseline 2.6 km back is now a different scenery region (open fields, no trees: 0 leaves) vs the T's forest (106k leaf triangles). The baseline now stands in the interchange's own region — 6526f26; CI 46089119253: 242k vs 194k on the same region's highway, green |
| qaweekend-party — both screens have the same puddles + pigeons (host 0 sites) | flake: green on the re-run (46097614177) |
| partyplus — the claimed minivan pulls over the same way on both screens (guest null) | flake: green on the re-run (46097614177) |
| qafriends — guest: hop out moving in town: the car moved 5.8 m in one frame; re-run: riding across the town line, 6.2 m | a passenger's car follows the driver's packets as they arrive (two pages on the relay, real time): a burst = a jump on the guest's screen. `openworld/ride.js` (`tickSeats`) is `ci/friends`' (moved < 2 h) — left for them |

### The two machines the whole-suite run lost (re-run on this branch: 46096783229, main cd9c4de + test-only changes)

| check | verdict / status |
|---|---|
| calm (all four minutes within budget: solo highway 11 / min) | green — the pothole fix holds |
| adhold, cityhall3, homelife2, life2, onegame, places, qa20, qa9, realestatego, town | green (onegame's "next to Dina" was fixed by `ci/doors`' NEXT_TO rule) |
| crime, friendsworld, impound, movetouch, partyfoot, qa13, qatouch, shabbos | green |
| qa27 — 6.8 km court: no jump glitch (the camera 5.8 m in one frame, state playing) | test: between two places the test ends her walk by script (`foot.end("test")` → straight back at the wheel) BEFORE it declared the cut — the chase cam taking over from the foot cam. Declared first now; green on CI 46097614177 |
| perf (main run 46089441840, someone's 3-file dispatch) — the friend's car is in my world | test: checked after a frame count while the friend arrives over the relay on real time; waits for it now — green on CI 46098629151 (qafriends green there too: a flake) |

## Whole suite #2 — 46100408619 on ci/sweep-health (= main d5e43d8 + nothing), 2026-11-28 02:55Z

(Run on this branch, not main: a dispatch on main cancels a running one.)

| check | verdict / status |
|---|---|
| feel — rain on foot: open-air hiss, no drum (drum 0.047) | test: the mix fades on the AUDIO clock (real time, 0.3 s); 30 fast-clock frames can be less. Polls now |
| storefronts — lakewood: the town's signs stay sharp (atlas scale 0.578 < 0.58) | cause: the yeshiva's three signs (1024×104, 256×104, 192×112) took ~4 % more atlas area, and the atlas packed "next shelf" (a short sign never went back to the end of an earlier, taller shelf). The atlas packs FIRST-FIT now (`town/kit.js` Atlas.pack): Lakewood 0.589, Midwood 0.528 → 0.549 (sharper too); the floor stays 0.58 (the coordinator: fix the cause, not the bar) — green on CI 46110569756 (storefronts, town, midwood, doors, exits) |
| fast-clock screenshots of rooms come out flat sky-blue (`ci/sweep-places`' note) | harness/app: a test frame between `realFrame()` and the screenshot restored the small canvas (a resize clears it) and didn't draw. No restore while a shot is being taken now (`app.js` TC.shooting, cleared in afterShot) — `doors`' 20 room shots on CI 46110569756 are real pictures |
| life3 — a hotwire: no inwall + no inside glitch (Lulu AND the camera inside block@38,38 at [-125.4, -3186.1], ×215 / ×258) | Lakewood's block 2,3 area (Minivan Way) — the same block@38,38 as qaweekend's camera. `ci/yeshiva`'s campus (its car park) stands in block 2,3's south face since today: a parked car in it → she's put inside the block's occluder rect. **Left for `ci/yeshiva` / `ci/doors`** (both moved < 2 h) |
| sweeplogic — no page errors (`[cameos] model load TypeError: Failed to fetch`) | `ci/sweep-logic`'s own test: it navigates while a lazy model download is in flight (the pattern `ci/fasttests` fixed in 06647cf: let the downloads finish first) — theirs |
| sweepplaces3 — THE ONE SOCK LAUNDROMAT: at its door the ✋ is the door (got 💬 SAY HI) | `ci/sweep-places`' own test — theirs |
| partyworld — community: the same roadside scenes on both screens | party (2 pages): the re-run (46105356592) failed on ANOTHER check — "paused in a party: never rolls backwards" (min vF -11.5 for a moment, then 0, moved +9 m): her coasting car hit something while paused (the world doesn't stop in a party), not the old reverse-brake bug. Flaky 2-page test, `ci/friends`' area — left |
| 🗺️ Map — a tap on the place she's standing at | REAL (found via qa26): it pinged, was "arrived" the same moment, and closed the phone on nothing. Now the phone stays open and the row says "📍 you're here!" (`ctx.pins.arrivedAt`); sweephealth checks it (green on CI 46105356592 with qa26 + pins) |
| partners2 — bail paid at the desk ("She's not in a cell here") | test: the bail section didn't hold the jailed guest's court clock (real time since a6bd69f) like the cells above do; holds it now |
| accounts — A sees B's USERNAME over B's car (got "Pink 45"); multiplayer — the 2D ghost / emote checks | `ci/oneserver-place`'s rooms-by-place landed on main 02:49 and is still moving — left for them |
| qafriends — guest: riding across the town line (car 6.2 m in a frame), 2 runs of 3 | left for `ci/friends` (`openworld/ride.js`, moving) |
| airport — the cruiser doesn't drive through her car (ram: centres 1.3 m < 1.5), no teleport (ram 0.6 m > 0.5 a frame) | REAL (intermittent): a hard ram WRECKS the cruiser (c.hit), and the kerb's hold skipped wrecks — the tumbling wreck slid on into her car while the kerb held her in place. The kerb now holds a wreck off her too and drops its slide into her (`airport/chase.js` kerbHold) — CI 46106485955 |
| (the dealersui / schlepnav / exits / friends / qacar / partners3 / hidden / qa10 / qa28 / homelife2 / movement / cityhall4 machine) | cancelled by my own next dispatch — re-run in 46106485955 |
| schlepnav — …still self-driving in town (it plans the streets from the approach): it hands back "arrived" on entering Lakewood | REAL-looking (the ⚡ self-drive gives up at the town line); `features/dealers` is in `ci/sweep-road`'s lane (moving) — left for them |
| qa4, qa26, qa27, exits, calm, qol, qaweekend's HUD, perf | green |

## Whole suite #3 — 46120021170 on ci/sweep-health (= main 16b16df), 2026-11-28 07:22Z

| check | verdict / status |
|---|---|
| life3 + qaweekend (earlier runs) — Lulu AND the camera "inside block@38,38" in Lakewood | REAL: a house's DRIVEWAY minivan (39 of them in Lakewood) stands inside its block's rectangle; walk up to hotwire it and the watchdog / unstuck called her "inside a block", and the camera's clip treated the block as "she's inside: anything goes" — the camera could wander into the houses. Driveways are open ground now (`ctx.town.onDrive`, used by the camera clip, unstuck and the watchdog, like her own lot and Refael's car lot); sweephealth checks all 39 |
| sweeplogic — no page errors (Failed to fetch) | harness: `page.reload()` didn't wait for in-flight downloads the way `page.goto()` does (`ci/fasttests`' fix); it does now |
| memory — a fare texts Lulu (timed out) | test: a random incoming call (on in tests) holds texts back while it rings; the test turns them off + resets the run's text budget first |
| shul — lakewood friday: nobody stands inside a wall (kid) | REAL (small): the kid running round the kiddush table brushed through its far end (0.05 m); his loop now runs down the middle of the gap |
| qa27 — 10.7 km hospital: "the room went away" in a corner; 👜 Maison de Gelt: a 2.1 m rail between the camera and her | `ci/sweep-phone` (moving) changed the room cameras at 04:36–05:15 (over-the-shoulder at someone's ✋, see-through) — left for them |
| cityhall — the ribbon cutting: no jump glitch (camera 5.3 m in a frame, on foot) | likely the same camera change (`ci/sweep-phone`'s shoulder camera for people) — left for them |
| qaweekend — home → highway: no inwall (camera inside block@128,195 at f27 ×8, her lot) | `ci/sweep-phone`'s "the home start looks at the car" (05:01) — left for them |
| qa14 — one full 16 km lap: knocked out at 8.1 km | one run; two-way highway traffic — re-run later |
| (verification 46125898854) life3, doors, shul, memory, sweeplogic, sweephealth, qa7, foot, carcare, yeshiva, seasons green; unstuck: a flat white picture at the REST AREA (highway — not the driveway change: green on main in #3) — `ci/doors`' 7fdec714 family, intermittent | landed 09:00 |
| accounts, qafriends, sweepplaces, sweepphone2 | left (`ci/oneserver-place`, `ci/friends`, `ci/sweep-places`, `ci/sweep-phone`) |

## Findings + status

## Left for other branches

- **`ci/doors` (other account, moving: camClip / the camera in trees + houses, 2026-11-28 00:18–00:43):** the on-foot
  camera in Lakewood's street-tree leaves / a block / a big trunk (qaweekend, unstuck rows above) is theirs — the
  screenshot `3d-qaweekend-lakewood-foot.png` of run 46085361039 (a screen of leaves at the Feldmans' door) and the
  positions above are the repro data.
- **Party / friends checks** (partyplus' claimed minivan on the guest, qaweekend-party's puddles on the host, qafriends'
  hop-out car jump, partners2's bail on a real-time court clock): `ci/friends` / `ci/oneserver-place` / `ci/fasttests`
  are all moving in that code — left, listed above.
- **Note for every sweep:** dispatching "3D full suite" on `main` CANCELS a run already going on `main` (one run per
  branch). The whole-suite run 46073386320 lost its last two machines (calm + the adhold group) to a 3-file dispatch on
  main at 00:43. Dispatch targeted groups on your OWN `ci/` branch.

- `ci/fasttests` (other account, moving) is reworking test timing (the fast test clock): timing flakes that its
  clock work covers are left to it — its test fixes not on main yet: unstuck (bc1e2cd), crime2 (7136f90),
  movetouch / movement / playgate (06647cf), hometown / partners / partyhang / together opt-outs.
