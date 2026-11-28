# ci/sweep-health2 — keep main green (part 2 of `sweep-health.md`)

Final whole suite: **46173386522** on main a025a083 (dispatched 17:59 UTC) — the table below is replaced when it finishes.

## FINAL TABLE (first version — from whole suite #2, 46153406621 on main b789aeb0, finished 16:01 UTC; the last run updates it)

194 test files on 16 machines: **11 machines green, 5 red — 5 test files red out of 194**.

| group (machine) | result | why |
|---|---|---|
| town, sweepphone3, parking-levels, gfx, party, dealers, clothes, hidden, qaplaces, shabbos, cityhall… | ✅ green | |
| looktest, sweeplogic2, yeshiva, homelife, qaweekend, life2, qafriends, native, accounts, qa3, hometown… | ✅ green | accounts green again (the name-ticket fix, batch 2) |
| mpworld, sweepphone5, exits, qa6, cityhall, underworld, realestate, realestateworld, qaweekend-air… | ✅ green | |
| friendsworld, storefronts, sweeproad, homeperf, openworld, qacar, foot, life, meta, crime2, moveout… | ✅ green | |
| playershops, sweepphone2, midwood, places, seasons, hudfit, footbounds, ux, qa23, qaweekend-party… | ✅ green | sweepphone2 green again (room bubbles sized by depth, batch 3) |
| pinroute, sweepphone, yeshiva2, qa18, law, journey, qa2, courts, cityhall3, playgate, qa25, qa12, cars… | ✅ green | |
| unstuck, sweepphone4, community, shops, qa27, flow, partyplus, qa7, dina, rides, qatown, decor… | ✅ green | qa27's hospital corners green (sweep-camera) |
| calm, playershopsfriends, sweepplaces2, partyhang, life3, interiors, accountsfriends… | ✅ green | calm: every minute within budget (on-foot calmer, batch 2) |
| airport | ✅ green | |
| lanes, sweeplogic, worldplace, core, calls, family, qa, memory, qa20, qa26, partyheist, qa26b… | ✅ green | |
| carcare, playershopsworld, sweepplaces3, partners2, qaseam, partyfoot, world, atmos, worldclock… | ✅ green | |
| perf, qa9, **streets**, bankfriends, qafriends2, music, play, qa5, platform, gadgets | ❌ streets | "a cop SAW it → an instant chase (CARJACKING)" — red in both whole suites; cops = `ci/sweep-road` |
| homes, sweepplaces, crime3, qa15, shul, partners3, parking, qa10, qa8, home, cameras, qa24 | ❌ homes | "a speeding car: peds scatter (AAH!)" — mine, investigating |
| install, sweephealth, **sweeproad3**, heist, friends, qa14, roadevents, roadside, qa17, nocalls, multiplayer… | ❌ sweeproad3 | `ci/sweep-road`'s own lap test (a Hatzalah van's bump at 3.45 km) — theirs |
| dealersui, schlepnav, sweepplaces4, cameos, **partyworld**, airport-terminal, crime, phone, unstuck-air… | ❌ partyworld | "paused in a party: never rolls backwards" — red in every whole suite since part 1; party = `ci/friends` |
| fuel, **sweepcamera**, sweeproad2, together, doors, partners, adhold, hustle, moves, friendsjobs… | ❌ sweepcamera | `ci/sweep-camera`'s own rest-area check (landed after this run: camera batch 1b) — theirs |

Sweep agent notes (rules: `RULES.md`). Started 2026-11-28 09:10 UTC; the owner is back 22:00 UTC.

Lanes right now (don't double-fix): camera cases → `ci/sweep-camera`; anything driving (traffic, law, cops, exits,
fuel, dealers, impound, `schlepnav`) → `ci/sweep-road`; state / dead ends → `ci/sweep-logic2`; accounts / multiplayer /
party* / qafriends / openworld relay → `ci/oneserver-place` / `ci/friends` while they move. Everything else red is mine.

## Whole suite #1 — 46129251917 on ci/sweep-health2 (= main 93b4110f), 2026-11-28 09:11Z

| check | verdict / status |
|---|---|
| fuel — "an exit is planned" timed out → town pump / charge / dry threw (8 checks) | test: towns are off in a test that didn't opt in (`ctx.enabled("town")`), so a run never plans its exits; the lap map used to plan them the first time something asked it mid-run. Since two-way round 4 the U-turn paint asks the lap map early and it's cached, so nothing re-plans after the run start's `clearExits`. Real game unaffected (towns on → runStart plans). The test plans the route itself (`ctx.town.exitOf`) — reproduced + checked on CI (probe 46130706764) |
| parking — level 1 pays 1×25 + 15 per ★ (500 → 500) | timing: the test read `localStorage` 20 frames after the park; the wallet writes ~0.8 s after coins come in (save.js scheduleFlush) and on the fast clock 20 frames are 0.33 s. Green on a re-run; the test flushes before reading now |
| accounts — A sees B's USERNAME over B's car (got "Pink 56"), then names back on / the report row | `ci/oneserver-place` landed + quiet → mine. Probe (46131740184): B sees A's name; A asked the server about B's ticket and got null (cached 10 min). FIXED: probe 2 showed it — her lobby-bridge copy (net.js placeTick) carried her PLACE room's ticket into the lobby; A, still in the lobby, asked the server with (LOBBY, the bridge's id) → no; `ghostName` cached that no by ticket alone for 10 min, so on her real car in WL0 the same ticket stayed "Pink 56". The cache is keyed room + relay id + ticket now, a no is asked again after 30 s, the bridge copy carries no ticket (realestate's hidden-names reader follows the new key). Green: accounts, multiplayer (46143939884). Old note: `ghostName` caches the server's answer by TICKET alone, but a ticket is only valid with the (room, relay id) it was queued with — queued with a stale id / room (mid room-switch) → null for 10 min. Probe 2 (46143461305, branch ci/sweep-health2-probe, logs what A sends to /acct/names + every un change) was running when I stopped |
| playershopsworld — threw: "Execution context was destroyed" (B's page navigated at line 108) | not found in code (no reload / href in playershops); green on the re-run (46143677433): a flake |
| shul — midwood friday: nobody stands inside a wall (kid) | REAL: the Friday kid's loop ran along the kiddush room's archway dwarf wall (x 6.55 vs the wall's 6.52); loop moved (cx 8.05, rx 1.38) + shul.js now checks every kid's WHOLE loop, not one instant — green on CI 46143677433, landed 12:40 |
| calm — on foot in town ≤ 12 pop-ups a minute (banner 2, bubble 10, toast 3) | REAL (UX): her first idle line came 2.5–4.5 s after stepping out, on top of the walk hint + the town's arrival line (3 of her lines in ~3 s); a Route 9 jam could yell the same line twice running; weather toasts on foot said "hold the wheel" / "headlights on". Fixed on ci/sweep-health2 (first line 8–12 s in, no repeat yell, foot weather lines) — green on CI 46143677433 (calm: on foot 8 a minute), landed 12:40 |
| streets — a cop SAW it → an instant chase (CARJACKING) | cops → `ci/sweep-road` |
| schlepnav — …still self-driving in town | `ci/sweep-road` (part 1 left it there too) |
| qa27 — 10.7 km hospital: the room went away in a corner (2 viewports); qaweekend — home → highway: the camera inside block@128,195 | camera → `ci/sweep-camera` |
| partyworld — paused in a party: never rolls backwards (min vF -16) | party → `ci/friends` (moving) |
| movement — a coach line names the jump the first walks (empty) | stale test: since `ci/sweep-phone` 55881dd9 (one hint at a time) the moves coach waits while the 6 s "you're on foot" hint is up. The test waits for it now |

## After whole suite #1

| check | verdict / status |
|---|---|
| sweepphone2 — phone-stranger: the room's speech bubbles are whole on screen ("Hand me the wrench…" −1.04..0.76; "Who put a SPOON down here?" −0.67..1.13) | REAL, red on main since logic2's one-clock change put a different household scene in the test's house: a room bubble's width cap used the straight-line distance, so off to a side it came out wider than the screen and the slide-in couldn't fit it. Sized by depth now + its ends re-checked after the resize (`interiors/fx.js`) — green 46148202879, landed 13:45 |
| sweepphone — first drive: no text off the sides (a pedestrian's "Shalom!" 379..448 on a 390 px phone) | REAL (intermittent, green on a re-run 46149453258): outdoor NPC bubbles had no side clamp. They slide in now (`banter/bubbles.js` placeNpc) — green 46150264657, landed 13:45 |
| sweeproad3 — no invisible bumps (s 1687) | `ci/sweep-road`'s own test, red on their run 46143702743 too — theirs |

## Whole suite #2 — 46153406621 on ci/sweep-health2 (= main b789aeb0: sweep-road part 5, sweep-logic2 batch 2, sweep-camera batch 1 in), 2026-11-28 14:13Z

see the FINAL TABLE at the top.

## After whole suite #2

| check | verdict / status |
|---|---|
| partyworld — paused in a party: never rolls backwards (min vF −6.3; −16, −11.5 in earlier runs) | REAL: paused in a party, `holdCtl` pulled the HANDBRAKE at once — at 16 m/s the car slid round (forward speed negative for a moment). Placing the host away from the guest didn't help (−3.8), so it wasn't a bump. The handbrake goes on only once she's nearly stopped (`party/index.js` holdCtl) — partyworld green 46171036930. (`ci/friends` landed + quiet → mine.) The test also places the host 150 m behind the stopped guest now |
| homes — a speeding car: peds scatter (AAH!) | flake: green on the re-run 46169211630 |
| streets — a cop SAW it → an instant chase (CARJACKING) | flake (red in both whole suites, green on the re-run 46169211630); cops = `ci/sweep-road` — told in the report |
| sweeproad3, sweepcamera | the other sweeps' own tests — theirs |

## Findings + status

## Left for other branches

## Where it stands (handed back 2026-11-28 ~12:40 UTC)

- On main: b3f41968 (fuel / parking / movement test fixes). Main's Smoke green on it.
- On `ci/sweep-health2`, NOT on main: the shul kid + loop check, the calmer on-foot lines (first idle line, jam yells,
  weather on foot). Land after CI 46143677433 (core, platform, shul, foot, movement, sweephealth · atmos, life, life2,
  town, playershopsworld, feel · calm) is green.
- accounts: probe 2 on `ci/sweep-health2-probe` (TEMP branch — never merge it). Read its `PROBE Alog` line.
- Next whole suite: once ci/sweep-road (landed c78e759a 12:25), ci/sweep-logic2 and ci/sweep-camera are in; last ~20:00.
