# ci/sweep-road — everything the player does in a car

Sweep started 2026-11-27 23:55 UTC (rules: `RULES.md`). Scope: the lap + exits, the cars, traffic + crashes, cops +
chases, car care / dealers / impound / cameras, getting in + out, touch driving. Tests: `scripts/tests3d/sweeproad.js`
(parts: crash fairness, long-ride bodies + fuel, ramps / rest areas, DOWN the lap (chase, traps, K9, call-in, traffic
honks, the flavour pull-over), the call-in in town, roadside impound yards, Refael's lot + the title's car switch, the
ambulance; `SWEEPROAD_PART=`), `sweeproad2.js` (a lap survey on a phone: every board, the trip bar, the exit chip),
`sweeproad3.js` (a whole lap DRIVEN with traffic, a controller at 1280×720, the watchdog on; `SWEEPROAD3_DOWN=1` drives
it down the lap, `_KM` / `_FROM` a stretch).

Not touched (still moving on another branch when this started): `features/fuel` (`ci/fuel`, not landed),
`features/dealers` (`ci/dealers-ui`, moved minutes before).

## Findings

| # | what the player sees | where | status |
|---|---|---|---|
| 1 | A police car in ordinary traffic rear-ends her on her last heart → she's ARRESTED for "DESTROYING A POLICE CRUISER". The crash had no idea whose fault it was. | `law/index.js` wreck hook; `traffic.js` crash event | **fixed** — the crash event says who was moving into whom (`fault: "them" / "lulu"`, along the contact line); the wreck carries it; the law charges her only when SHE drove into it (the chase's "COP DOWN" charge too); the cameos' crash scene no longer arrests her for a cruiser that hit her (an embarrassed officer instead); Hillel's fault sum weighs it |
| 2 | Stop on the highway (or brake hard) right after passing a car → it ploughs into her from behind ("Tailgating doesn't pay", a heart). Traffic followed the car ahead of it — but never HER. | `traffic.js` update | **fixed** — a car in her lane behind her car follows her like a car ahead (brakes, then pulls round); it keeps braking until its side is clear of hers (2.6 m). On foot unchanged (foot's own drivers' rules). Rear-ended anyway → "They drove right into you!" (not "Tailgating") |
| 3 | Driving toward JFK, the trip bar says "Lakewood exit in 3.1 mi" and no exit chip shows, while the green boards count down to ✈ JFK EXIT 12. | `app.js` `nextPlace`, `exits/index.js` chip | **fixed** — both count down to the JFK exit like a town's |
| 4 | The impound window: "…Pink convertible. Yeah, it's here." whatever car she's getting back. | `impound/data.js` `gateAsk` | **fixed** — names her car (`SKINS[key].name`) |
| 5 | Uncle Refael's lot: "🔑 Drive it off the lot" for ANY car she owns — an impounded car came out free (no 120 release fee) and a car parked in the other town jumped to the lot. | `shops/dealer.js` | **fixed** — only for a car at home (or with her); otherwise the card says where it is ("impounded in Midwood. Go get it!") |
| 6 | The title's 🚗 Car switch cycled every car she owns — the same free release from the impound / a car teleporting home. | `core/screens.js` `cycleSkin` | **fixed** — cycles the car she has + the ones at home; the row says when the others aren't home |

| 7 | In a chase, she takes a town's off-ramp → the cruiser behind her cuts straight across the painted gore, the grass and the guardrails (law steers at her sideways offset off the highway, and the ramp curves away). | `law/cops.js` steerUnit; `town/exit.js` | **fixed** — town exits answer law's `copRoute` hook (as JFK's roads do): a cruiser behind her drives the decel lane → ramp → her branch, then straight at her past its end; back out of town: down the cross road and along the on-ramp. The same for a REST AREA (decel lane → off-ramp → drive aisle → on-ramp). Only a cruiser that SEES her: while they search they stay on the highway (taking an exit unseen / hiding in a lot still shakes them). A cruiser giving up off the highway stops where it is (it used to cut back across the grass) |
| 8 | The cops' red "you're not hidden" tip stays up after she's tucked away (AGENTS §7 known issue). | `law/cops.js`, `hud.js` | **fixed** — `H.dropToast(key)`; the tip goes the moment she's hiding |
| 9 | An oncoming car she hits while she's in ITS lane (slowly) counted as "their fault". | `traffic.js` | **fixed** — on its side of the road, heading against it = her fault (driving down the far carriageway WITH it — ci/twoway — isn't) |
| 10 | A car impounded at a ROADSIDE yard (Trooper Post 7 / the Weigh Station, ci/roadside): held under no town, so the yard's gate never offered it (paying at City Hall gave a slip no gate took) and the 📱 said "impounded in null" — the car was gone for good. | `impound/index.js` `heldHere`, `cars/index.js` `townName` | **fixed** — held under the yard's address (`hw:trooper` / `hw:weigh`); its gate takes the fee (the one shown) and gives it back; the 📱 names the yard; the Map pin is at its lap metre. (The break-in stays a town-lot thing.) |
| 11 | Driving a long ride (the box truck, a bus, the ambulance): her hit circles were always her own 4.6 m car's — traffic and walls passed through the back half of a 10 m bus. | `traffic.js` collide, `car.js` collideStatic, `rides/index.js` | **fixed** — a ride's shell gives her its kind's circles + radius (`specOfModel`); her own car: unchanged |

| 12 | A roadside yard's released car rolled out INTO a highway lane (the town kerb rule). | `impound/index.js` release | **fixed** — the yard's own stalls (`sp.kerbAt`) |
| 13 | A town's "NEXT EXIT ½ MI" board stood 420 m out (≈ ¼ mi); a rest area's "1 MI" at 0.66 mi, "½ MI" at 0.26 mi — a busy spot slid the board TOWARD the exit. | `town/exit.js` `add`, `exits/index.js` `sign` | **fixed** — the advance boards slide back, away from the exit (the lap survey checks every board's distance, the trip bar and the chip — `sweeproad2`) |
| 14 | A car pulling out to pass a slow car swerved into the lane she was in (`laneFree` only looked at other traffic) — seen on the lap drive. | `traffic.js` | **fixed** — `laneFree` sees her car |
| 15 | ⛽ Driving anything that isn't her car but wasn't CARJACKED — a hotwired parked car, a ride, Ima's minivan (no gauge by design) — drained HER car's tank, and a pump filled hers. | `fuel/index.js` `key()` | **fixed** — any borrowed shell has its own tank (Ima's minivan: none); a new shell = a new tank |
| 16 | A call-in (BOLO) cruiser in town drove the street grid straight to her car, wherever she'd gone (AGENTS §7 known issue). | `law/cops.js` steerUnit | **fixed** — it prowls round where the call came from (town's searchPoint / prowlPoint), slow, until it sees her |
| 17 | The dealerships' "🔑 Drive this one" (Mazelati card, Tushla's tablet + configurator): the same free release / teleport as #5. | `dealers/lux.js`, `ev.js`, `config.js` | **fixed** — one helper `garage/buy.js` `carAway(id)`; the button says where the car is |
| 18 | The impound HUD line said "City Hall or the precinct" for a car held at a roadside yard. | `impound/index.js` | **fixed** — "City Hall or Trooper Post 7's yard" |

| 19 | Arrested anywhere, the haul's progress bar and the booking caption said "PRECINCT 18½" (Lakewood's) — also when she was taken to Midwood's 70½th Precinct or Trooper Post 7; and places' `names()` used the town she was IN, not the one she was taken to. | `law/arrest.js`, `law/jail.js`, `law/ui.js`, `places/index.js` | **fixed** — `UI.precinctName()` from `ctx.civic.names()` (which now follows `STAY.place`) |
| 21 | BUSTED on a town's exit ramp / its cross road / the on-ramp, or in a rest area's lot: law's pull-over steered her back across the grass to the highway's shoulder (d 7.9), and the cruiser pulled up there. | `law/bust.js` (hooks), `town/exit.js`, `exits/index.js` | **fixed** — both answer law's `pullOverSpot` (she stops where she is, as at JFK) and its `copRoute` in pull-over mode too (the cruiser stops 7 m behind her, on the ramp / in the lot); and anywhere else well off the asphalt (a roadside place's lot, a dealership's) law's own `pullOverSpot` stops her where she is |
| 22 | Driving straight on past an exit, the chip still said "EXIT 9 BROOKLYN · NOW ↗" for 120 m after it. | `exits/index.js` `nextAhead` | **fixed** — gone 25 m past (kept while she's down its ramp); the lap survey checks it |
| 23 | 🔋 An EV pulled into a rest area's pump bay: it starts charging (the bay has a charger) AND Yanky's "Electric? Try a charger" joke pops up — two messages that disagree (and it isn't Yanky's station). | `fuel/index.js` `fill` | **fixed** — no joke at a rest area's bay (still at Yanky's Gas 'n' Go) |
| 24 | Velvel's no-questions garage buys the "borrowed" car she's in — including IMA'S FAMILY MINIVAN (the never-stuck ride when none of her cars is home), and while her own car was impounded "your car's brought round" released it for free. | `underworld/mechanic.js` `rideNow` | **fixed** — he won't buy Ima's minivan, nor anything while her own car is impounded |
| 25 | A chase while she drives DOWN the lap (ci/twoway's far carriageway, landed): the cruisers spawned ahead of her facing up the lap, aimed up the lap and fell behind for good (never a real chase); the pull-over aimed her up the lap at the RIGHT shoulder (across both carriageways). | `law/cops.js` steerUnit, spawnChaser, pullDAt, scriptedCruiser · `law/bust.js` | **fixed** — `travelDir()` (±1): chasers spawn behind HER and drive her way, the gaps / look-ahead / the pull-over's stop + shoulder / the camera mirror with it |
| 26 | Still DOWN the lap: a hidden speed trap and a WANTED poster were placed ahead of her (ci/twoway mirrored that) but their "keep me" test still read +s — both were thrown away the frame they spawned (no speed traps at all on the far carriageway); a K9 / a missile was loosed BEHIND her running away; the BOLO cruiser came from ahead facing the wrong way. | `law/cops.js` traps, poster, K9, missile, BOLO | **fixed** — all read `travelDir()`; checks in `sweeproad` › downlap |
| 27 | Driving DOWN the lap with the traffic on the far carriageway: every car catching up behind her in her lane flashed its brights and honked at her (it took her for a car coming at it), and a HONK never moved the slow car in front (honk-to-pass only looked up the lap). Found with sweeproad3's new down-the-lap drive (`SWEEPROAD3_DOWN=1`). | `traffic.js` update | **fixed** — no flash / honk when she's going its way; the honk works her way (`traffic.dir`) |
| 28 | The road's 🚑 "Pull aside for the ambulance!" started in the middle of a police chase, a road-rager, a side job (ci/sweep-logic2 flagged it for this sweep). | `roadevents/index.js` scheduler | **fixed** — waits for `ctx.engaged()` to be free, like the drive-thru / the ice-cream van; `sweeproad` › amb |
| 29 | Down the lap, "somebody else gets pulled over" (law's flavour scene) picked a car BEHIND her on the other carriageway — she never saw it, and the cruiser + the car stayed kept (never recycled) for the rest of the run. | `law/cops.js` startFlavour | **fixed** — a car up ahead of her, her way, pulled to her side's shoulder |
| 30 | Down the lap, a road-rager / gang car was still sent — spawned "behind" her up the lap (i.e. AHEAD of her) driving up the lap in her carriageway: head-on. Its whole AI is written for the up-the-lap side. | `underworld/index.js` `why` | **fixed (gate)** — no bad-guy car while she's heading down the lap ("downlap"); mirroring their AI left to ci/twoway's owner |
| 31 | In TOWN, finding #1 again: the town's patrol car driving into her (stopped at a corner, say) → "🚨 YOU HIT THE PATROL CAR!" RAMMING A POLICE CRUISER; a Shomrim car / any town car hitting her → a witness for "RAMMING A SHOMRIM CAR" / "FENDER BENDER (AND DRIVING OFF)". | `town/index.js`, `community/index.js` crash handlers | **fixed** — not when traffic.js says it was their fault; `sweeproad` › bolo |
| 20 | Shmuel's chop shop: "his guy brings Lulu's own car round" after a drop-off — even when her car was IMPOUNDED (a free release). | `streets/chop.js` | **fixed** — no chop-shop call while her own car is impounded (a car parked away is still "brought round": his guy's service) |

- (from ci/sweep-health) `schlepnav` "…still self-driving in town": NOT a game bug — on the fast test clock the harness stops on
  the very frame the town turns active, and the self-drive plans its town route on the next controls frame (10 frames later:
  on, route "town"). The test now waits for the plan.

## Left (not fixed yet)

- sweeproad3's down-the-lap drive (`SWEEPROAD3_DOWN=1`, 16 km, ~22 min locally): she left the road a few times and hit a
  pole / trees — explained: Ima's call rings, "let it ring to pick up" answers it, and the call FLIPS the steering (by
  design); the test driver now flips back. A few "their fault" hits from drunk / texting cars weaving into her (by
  design, both carriageways) remain in that run's log; not a down-the-lap bug. The full down-the-lap drive wasn't re-run
  after the driver fix (the local browser was busy, and CI can't pass the env switch).

- A long ride's (truck / bus) own hit circles: driven nose-first across a town street into a parked car's side, the truck
  ends up overlapping it — but a 7.5 m truck turned across a ~9 m street also touches the parked car BEHIND it, and the two
  push-outs squeeze it through. Not a real way to drive; car-sized shells keep her car's circles (#11). Left.

- (ci/twoway handled the trip bar going DOWN the lap itself — `nextPlace` › `down`.)
- (fixed here as #25 once ci/twoway had landed and moved on:) a chase / a pull-over while she drives DOWN the lap (the far carriageway) — law's chase + pull-over still
  assume +s: `spawnChaser` puts cruisers at `car.s − back`, the pull-over's `pullDAt` is the RIGHT shoulder (7.9) and
  `stopS = car.s − 7.2`, and bust.js `autoLulu` aims at `car.s + 12` — busted going down the lap she'd be steered across both
  carriageways. (Traps + patrols already mirror with `downLap()`.) Not touched: it's that branch's model.

## For other branches

- **ci/twoway's owner (the town-engine agent)**: going DOWN the lap, roadevents' set pieces (toll, train crossing, school
  bus stop, work zones, the steamroller…) still place themselves up the lap (`roadevents/common.js` `claimSlot`:
  `carS() + 420` / `builtEnd()`), i.e. behind her, where she never meets them; their "keep me" tests (`car.s < s + 250`)
  stay true for as long as she drives on, so each one stays `busy` and no other of its kind spawns. Nothing breaks — the
  far carriageway just has no set pieces. Mirroring them is a per-piece job (each is built for one direction); not done here.
  The same goes for atmos' roadside life (`atmos/life.js`, `car.s + 110…190`), cameos placed `car.s + …` and the
  underworld's road-ragers / gang cars (`underworld/badguys.js`, all `car.s − …`; gated off down the lap here, #30).

- **ci/sweep-health**: `partyworld` "paused in a party (the 📱 phone): the car stops and never rolls backwards" is flaky on
  plain main (a shared, clock-driven party car rams her stopped car — they can't stop for her; seen again in CI
  46150503359 as `{"min":-7.71,"ds":9}`: placed at 16 m/s in lane 1.75 she eases into a shared car ahead of her and bounces
  back — the test's placement, not a reverse); `feel` "rain on foot" sits
  right at its 0.02 drum threshold on the fast clock.

- **ci/sweep-health / ci/fasttests**: on the fast test clock a test's `t.shot()` comes out as flat sky blue (the HUD drawn
  over it) — `sweeproad2` / `sweeproad3` pictures; with `SMOKE3D_FAST=0` they're right. Screenshots someone looks at need the old clock.

## Landed

- 2026-11-28 17:35 UTC — part 7 on main: a given-up cruiser is let go 170 m on her way (down the lap too); the `amb`
  check no longer races the chase; sweeproad3's driver flips back for Ima's call (the down-the-lap "veers"). CI 46170331613
  (core, platform, sweeproad, law, lawstruck, qalaw ✓).
- 2026-11-28 17:30 UTC — part 6 on main: findings 28–30 (the ambulance waits for an activity to end; down the lap the
  flavour pull-over ahead of her; no bad-guy cars down the lap). CI 46169171987 (core, platform, sweeproad, law, oneact,
  underworld, roadevents, lawstruck, qacar ✓). Main's Smoke after part 5: 46151341698 ✓.
- 2026-11-28 13:50 UTC — part 5 on main: findings 25–27 (down the lap: chases, the pull-over, traps, posters, K9 / missiles,
  the call-in cruiser, traffic flashing + the honk) + sweeproad3's down-the-lap drive. CI 46149112139 (core, platform, sweeproad,
  law, qalaw, lawstruck, town, qacar, heist, crime ✓), 46150503359 (core, platform, sweeproad, qacar, atmos, moves, pinroute,
  foot, law ✓; partyworld ✗ — the known flake, see For other branches) + local law, lawstruck, sweeproad downlap after the last tweak.
- 2026-11-28 12:58 UTC — part 4 on main (8f76b59f): finding 24 + sweeproad3's bump / ragers fixes. CI 46146705028
  (underworld, core, platform ✓; sweeproad3 still running at landing).
- 2026-11-28 12:25 UTC — part 3 on main: findings 21–23 + the schlepnav test wait. CI 46124201678 (core, platform,
  sweeproad, law, town, roadside, qaplaces, qalaw, lawstruck, airport, exits ✓) + local after the merge (core, sweeproad, qalaw ✓).
- 2026-11-28 08:05 UTC — part 2 on main: findings 19–20. CI 46121235380 (core, platform, sweeproad, law, places, roadside,
  qaplaces, interiors, partners, streets, nocalls ✓); main's Smoke test after part 1: 46120263706 ✓.
- 2026-11-28 07:25 UTC — part 1 on main (e7241646, fast-forward): findings 1–18. CI 3D full suite run 46110858388 on the branch (core, platform,
  sweeproad, sweeproad2, law, town, impound, cars2, cars, rides, roadside, qalaw, dealers, dealersui, shops, cameras, qacar,
  lawstruck, cameos, exits, fuel, carcare ✓; partyworld ✗ — see below) + the wide run 46096797384 earlier. Reds judged not ours: `partyworld`
  "paused in a party … never rolls backwards" (a shared car rams her stopped car — fails on plain main too, 1 in 2 locally) and
  its "community: the same roadside scenes" (once); `feel` "rain on foot: no drum" (passes 2/2 locally on the branch — a
  real-time audio fade on the fast clock); `exits` "interchange triangles" (red on main); `partners2`, `together`, `partyplus`,
  `sweeplogic` (fetch) — flaky, green locally on the branch.
