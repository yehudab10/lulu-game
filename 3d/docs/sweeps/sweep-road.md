# ci/sweep-road — everything the player does in a car

Sweep started 2026-11-27 23:55 UTC (rules: `RULES.md`). Scope: the lap + exits, the cars, traffic + crashes, cops +
chases, car care / dealers / impound / cameras, getting in + out, touch driving. Tests: `scripts/tests3d/sweeproad.js`
(crash fairness, Refael's lot + the title's car switch), `sweeproad2.js` (a lap survey on a phone: every board, the trip
bar, the exit chip), `sweeproad3.js` (a whole lap DRIVEN with traffic, a controller at 1280×720, the watchdog on).

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
| 20 | Shmuel's chop shop: "his guy brings Lulu's own car round" after a drop-off — even when her car was IMPOUNDED (a free release). | `streets/chop.js` | **fixed** — no chop-shop call while her own car is impounded (a car parked away is still "brought round": his guy's service) |

## Left (not fixed yet)

- ci/twoway (moving): driving DOWN the lap (the far carriageway) the trip bar + the exit chip still count to the next exit UP
  the lap (`app.js` `nextPlace`, `exits/index.js` `nextAhead`) — i.e. behind her. Theirs to decide (exits are on the other side).

## For other branches

- **ci/sweep-health**: `partyworld` "paused in a party (the 📱 phone): the car stops and never rolls backwards" is flaky on
  plain main (a shared, clock-driven party car rams her stopped car — they can't stop for her); `feel` "rain on foot" sits
  right at its 0.02 drum threshold on the fast clock.

- **ci/sweep-health / ci/fasttests**: on the fast test clock a test's `t.shot()` comes out as flat sky blue (the HUD drawn
  over it) — `sweeproad2` / `sweeproad3` pictures; with `SMOKE3D_FAST=0` they're right. Screenshots someone looks at need the old clock.

## Landed

- 2026-11-28 07:25 UTC — part 1 on main (e7241646, fast-forward): findings 1–18. CI 3D full suite run 46110858388 on the branch (core, platform,
  sweeproad, sweeproad2, law, town, impound, cars2, cars, rides, roadside, qalaw, dealers, dealersui, shops, cameras, qacar,
  lawstruck, cameos, exits, fuel, carcare ✓; partyworld ✗ — see below) + the wide run 46096797384 earlier. Reds judged not ours: `partyworld`
  "paused in a party … never rolls backwards" (a shared car rams her stopped car — fails on plain main too, 1 in 2 locally) and
  its "community: the same roadside scenes" (once); `feel` "rain on foot: no drum" (passes 2/2 locally on the branch — a
  real-time audio fade on the fast clock); `exits` "interchange triangles" (red on main); `partners2`, `together`, `partyplus`,
  `sweeplogic` (fetch) — flaky, green locally on the branch.
