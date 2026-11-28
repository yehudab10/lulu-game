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
   upright the camera faced the house and the car stood 120 px past the left edge. The camera now turns just enough to
   show it (`world/depart.js`, from the real field of view). — fixed
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

## For other sweeps

## Left
- No browser-back handling: an Android back gesture / an iOS Safari edge swipe leaves the page (the root page uses
  location.replace, so it doesn't loop). A history trap would be a new behaviour — owner's call.
- `ci/install` (the install prompt) is the other account's and still moving: not looked at / not edited.
