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

## For other branches

- **ci/dealers-ui** (`features/dealers`): the same as #5 at Mazelati (`lux.js` "🔑 Drive this one") and Tushla (`ev.js`
  `buyHere`, `config.js` `order`) — `equipSkin(id)` for a car she owns, wherever it is (impounded → out free). Gate it on
  `ctx.cars.atHome(id)` like `shops/dealer.js` `away()` now does.

## Landed

(none yet)
