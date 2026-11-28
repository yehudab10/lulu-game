# ci/sweep-phone — notes

Sweep: what a player on a PHONE sees and touches — the first five minutes (empty save), rooms on a phone held upright,
the 📱 phone, menus + settings, text, touch controls (see RULES.md). Tests: `scripts/tests3d/sweepphone.js` (the first
five minutes, empty save), `sweepphone2` (rooms upright, on the old clock for real screenshots), `sweepphone3` (pause,
⚙️ Settings + a reload, the 📱 on a small phone turned on its side, a 16-letter name), `sweepphone4` (the first time
wanted, busted, knocked out, home). Helpers: `scripts/lib/sweepphone.js` (every visible text on screen, controller words
on a touch screen, text off the sides). Screenshots: `SWEEP_SHOTS=1` → `smoke-shots/sweepphone/` (+ `smoke-shots/sweep/`).

## Findings
(newest last; status = fixed <batch> / left + why)

### The first five minutes (empty save, 390 × 844, fingers)
1. **Five things at once at the porch** — in the first 2 s: Ima's speech bubble, the 🔥 "Day 1 streak! +25" card ON TOP
   of it, "Drag the WALK pad to your car" and, under it, the moves coach's "⤴ tap JUMP · hold it = higher" (for 45 s —
   the walk hint went after 14 s, so the lasting instruction for a brand-new player was about jumping), + Ima's list.
   Now: the coach waits while a walk hint is up (`foot/index.js` coachHint); the first-ever walk hint stays until she's
   in the car (`world/depart.js` hintT 60); the streak card (coins paid at once) shows when she drives
   (`meta/progress.js`). — fixed
2. **Her car was off the screen** — "drag the WALK pad to your car 🚗", Ima: "the car. Over there." — on a phone held
   upright the camera faced the house and the car stood 120 px past the left edge. When the car is off the picture the
   camera now looks at it from behind her, so up on the stick walks straight to it (`world/depart.js`, from the real
   field of view; landscape keeps the house shot when the car's already in it). — fixed
3. **Ima: "The pink one."** — her car isn't always pink (the default car is red). "In the driveway." — fixed
4. **0 MPH in the driveway, nothing on screen** — a first-time player in the car (the pull-out shot) with no hint until
   the game gave up after 15 s. Now "Hold GAS to pull out 🚗" (touch) / "Hold <gas> to pull out" after 2 s still. — fixed
5. **The 📱 intro banner + the tutorial's ROAD TRIP card together** at the first pull-out. The banner waits for the
   tutorial (`phone/index.js`). — fixed
6. **"The open road — take an exit into town"** — the tutorial's first card, read in her own town street (a cruise starts
   at home in Midwood). In a town it says "Drive anywhere you like — around town, out to the highway, other towns…". — fixed
7. **Speech bubbles cut off at the screen's edge** (foot bubbles: Ima's "The CAR, Lulu! It's not going to drive I…") —
   kept whole on screen by their real width (`foot/bubbles.js`). — fixed
8. **"🚶‍♀️ ON FOOT · 🏡 100% · best 100%"** on every walk and in every room — the old walk-to-Bubbe's run's progress,
   meaningless in the open world (always 100 % in a town). The chip says ON FOOT (+ coins / sore feet); the % only on a
   story trip. — fixed

### Rooms on a phone held upright
9. **Lulu's head + back filled half the screen** in small rooms (a shopfront, the realtor, a stranger's hallway) and hid
   the person she talks to. `interiors/engine.js` fadeSelf: when the lens is close (upright < 3 m, on its side < 1.6 m)
   she turns see-through (to 30 %), solid again further back / in a mini-game / outside. Measured: the realtor's door
   covered 64 % of the screen at 1.4 m → see-through. — fixed
10. **✋ spots a step apart: standing at one, facing it, the prompt was the other** (a house's leaf blower vs the broom,
   "Talk to Mom" vs the seltzer) — the one she FACES wins now (`interiors/engine.js` findNear: facing weighs 1.0, was
   0.6). — fixed
11. **The clothes shop's "💳 Pay at the counter"** only says hello (paying happens after a rack → the fitting room) —
   now "💬 Chat at the counter". — fixed

### Menus, settings, the 📱
12. **⚙️ 🎵 Music OFF came back ON after every reload** — the choice was saved but never read back at boot
   (`audio.js` setMusicOn, `app.js` applySettings). — fixed
13. **iPhone in Safari: the 📱 handset's bottom row under the toolbar / home bar** — its height used 100vh (taller than
   what Safari shows); now 100dvh minus the home bar (`phone/style.js`; the dealers' cards too). Menus (`.screen`) keep
   clear of the notch / home bar (safe-area padding). — fixed

14. **⚙️ Settings with a long username: every row ran past the card's edge** (a 16-letter name in "🪪 Your name" made
   the grid's column as wide as the name; the values were cut off on the right) — the value ends in "…" now, the grid
   columns can shrink (`style3d.css` .settings). — fixed
15. **In a stranger's kitchen, facing the mom, the ✋ was the seltzer bottle on the counter in front of her** — a person
   counts a little more than a thing at the same spot (`interiors/engine.js` findNear); stepping right up to the bottle
   still picks the bottle. — fixed
16. **Rooms on a phone: the camera straight behind her hid the shopkeeper she'd walked up to** (Sal at register 3 behind
   her head) — at someone's ✋ the camera eases over her shoulder (0.45 rad), as it already did mid-chat. The ON FOOT
   chip is hidden indoors (five chips were stacked at the top-left of a stranger's house). — fixed
17. **Emoji newer than an iPhone 7 / iPhone 6s can draw** (Unicode 15, iOS 16.4+: 🪿 goose, 🩷 pink heart, 🩵, 🫷 —
   empty boxes in the decor catalogue, City Hall's questions, the purse snatcher's prompt) → 🦢 💗 💙 ✋. — fixed

18. **A room's speech bubble sized against last frame's camera** — while the camera swung in for a purchase at the
   clothes counter the "−150 💰 ✓" bubble came out 110–120 % of a phone's width (`sweepplaces` red on this branch):
   the room now moves its camera before it fits the bubbles (`interiors/engine.js`). — fixed
19. **📱 ‹ Back / ☰ Menu ~26 px tall on fingers** — 40 px now (`phone/style.js`). — fixed

20. **📒 Scrapbook on a small phone: "Neighbourhood Hero" ran out of its badge cell** — badge names break inside their
   cell (`meta/style.js`). — batch 2
21. **The touch stick had no dead zone** — a thumb resting on its middle steered the car / walked her a little (the
   controllers have one). 8 % of its reach now, rescaled so a full push is still 1 (`input.js`). — batch 3
22. **A room's speech bubble cut off at a side** — the realtor's "Welcome, welcome! Sit, sit!…" started past the left
   edge of a phone held upright. It slides in along the camera's right until both ends are on screen
   (`interiors/fx.js` fit). — batch 3
23. Right behind her at a room's door she's fainter now (12 %, was 30 → 20 %): the ghost of her head still covered the
   middle of the screen. — batch 3

## Landed
- batch 1 → main (items 1–19). CI on the branch: 46111254614 (sweepplaces 1–4, interiors, clothes, sweepphone2, homes,
  houseitems, storefronts, lanes, doors, qa28, decor, family, realestate: green; cityhall + shul red — also red on main,
  see below), 46110656699 (core, platform, skip, ux, music, sweepphone 1/3/4, meta, phone, hudfit: green), 46110218885
  (home, onegame, world, qa26: green).

- batch 2 → main (item 20 + the tests: the garage / scrapbook cards, every 📱 app on a small phone, a room on its
  side). CI 46112736627 → fixes → run on the merged head (sweepphone2, sweepphone3, meta, core, platform: green).

## For other sweeps
- for `ci/sweep-health`: on main a5c02a2a (run 46112384329 on a copy of main): `cityhall` › "the ribbon cutting: no jump
  glitch" (the camera moves ~5 m a frame for 4 frames on foot) and `shul` › "midwood / lakewood friday: nobody stands
  inside a wall (kid)" are red — not from this sweep (red on main without it).

## Left
- `ci/sweep-phone-mainprobe` (a copy of main a5c02a2a used to check whether cityhall / shul were red on main too) could
  not be deleted from this session (branch deletes are refused by the session's permissions) — safe to delete by hand.
- No browser-back handling: an Android back gesture / an iOS Safari edge swipe leaves the page (the root page uses
  location.replace, so it doesn't loop). A history trap would be a new behaviour — owner's call.
- `ci/install` (the install prompt) is the other account's and still moving: not looked at / not edited.
