# Lulu's Road Trip 3D

**Play:** [lulu.boats/3d](https://lulu.boats/3d/) — with a game controller (PS5 DualSense,
Xbox, Switch Pro…), keyboard, or touch. There's also a 🕹️ **3D** button on the 2D game's menu.

The whole 2D game, rebuilt in 3D. The coin wallet, cars, items, hairstyle, Avigail friendship,
scrapbook, quests, sticker book and lifetime stats are **shared with the 2D game**: earn coins in
one, spend them in the other.

## What's in it

| | |
|---|---|
| 📖 **Story Trip** | Lakewood → Bubbe's house → Heshy's pool → the beach → Avigail's place → Viva Vegas on one continuous road; the scenery, sky, traffic and music change each leg (autumn suburbs, pool town, the coast, golden-dusk boutiques, desert, the neon Strip at night). Arrival cutscenes with Bubbe, Heshy, Dina, Avigail and the Vegas family; chapter tasks + stars, postcards, tours with bigger payouts, a 3D story map, story calls and interludes, and **Ima's calls** (honk to decline, or take the call with flipped steering for gas money). |
| 🛣️ **Cruise** | Endless driving with traffic both ways, coin trails, close calls, nitro, handbrake drifts. |
| 🚓 **Cops & court** | Hidden speed traps, patrols, K9s, helicopters, pursuits that try to box you in, pull-overs, arrest → precinct → jail cell (escape, bail, lawyers) → a full courtroom visual novel (Avigail testifies for or against you), the 3-strikes rule, fugitive mode. |
| 🛒 **Shop & bling** | All 8 cars with real handling stats, missiles, pepper spray, the Bubble Shield, Distracted Mode, 6 custom horns, 7 car decorations — in a 3D showroom. |
| 🚧 **Road events** | Toll plazas, railroad crossings with real trains, parades and marathons, animals (ducks, raccoons, ostriches), construction zones, the steamroller you can commandeer, hitchhikers who ride along, ice-cream trucks, drive-thrus, school buses, ambulances, drunk/texting drivers… |
| 💅 **Cameos** | Avigail driving around and her porch visits (friendship meter), Fabio's salon (new hairstyle + colour), sasquatch, Heshy's pool, the uncles, the crash aftermath (the angry driver, the revenge car, Hillel the adjuster) and **the ER**. |
| 🚶‍♀️ **Lulu on Foot** | When the car's done for (or you pull onto the shoulder): walk the real road, talk to people, pet animals, busk, borrow cars (hotwire!), Main Street doors into **the bar, the cheder, the hospital, the police precinct and the beach boardwalk** — and, rarely, **Avigail's wedding**. |
| 🅿️ **Parking** | Pull over to park, or the 10-level Parking Challenge, with security cameras, dents and stars. |
| 👧 **Dina's world** | The school bus, the run home (beat Mom!), Dina's bedroom, Morgan, the sticker book, the nap and Cookie Catch. |
| 📒 **Scrapbook & quests** | Badges, rap sheet, ER punch card, Avigail meter, records, save-code backup (works across 2D/3D), weekly quests, the daily streak, Jewish holidays (Chanukah menorah on the car, Purim hat + grogger, Sukkot, Pesach, Rosh Hashana), and a first-drive tutorial. |
| 🌐 **Shared Road** | See other players — from the 2D *and* the 3D game — as ghost cars; friend rooms, races, emotes, the leaderboard. |

## Controls

| | PS5 / PS4 | Xbox | Keyboard | Touch |
|---|---|---|---|---|
| Steer / walk | left stick, D-pad | left stick, D-pad | ← → / A D (WASD on foot) | thumb stick |
| Gas · brake/reverse | R2 · L2 (analog), ✕ · ○ | RT · LT, A · B | ↑ · ↓ / W · S | GAS · BRAKE |
| Handbrake drift | □ | X | Space | — |
| Nitro · horn | R1 · L1 | RB · LB | Shift · H | NITRO · HONK |
| Missile · item | D-pad ↑ · ↓ | D-pad ↑ · ↓ | M · G | 🚀 · 🧴 |
| Interact (on foot) | ✕ | A | E | ✋ |
| Camera · look | △ · right stick (R3 = behind) | Y · right stick | C · V | CAM |
| Map / scrapbook · pause | touchpad · OPTIONS | View · Start | Tab · P/Esc | 📒 · ❚❚ |

Menus: D-pad/stick to move, ✕/A to pick, ○/B to go back, L1/R1 to switch tabs.
The controller **rumbles** (crashes, rumble strips, nitro…). On Chrome/Edge on a computer,
Settings → **DualSense lights & triggers** also makes the light bar match Lulu's car (red/blue in a
chase), shows your hearts on the player LEDs and adds adaptive-trigger resistance.
**TV mode** (auto on console/TV browsers, or in Settings) enlarges everything for the couch.
Sound starts after the first click/tap/key (browsers don't count controller buttons as a "gesture").

**PlayStation 5 note:** the PS5's built-in browser is hidden and can't run WebGL games, so the page
shows a card pointing to the 2D game there. A native PS5 version would need Sony's developer
program (PlayStation Partners) and a port to a console engine.

## How it's built

Plain ES modules + a vendored three.js r170 — no bundler, no build step. A small core
(`js/core/`) and one module per feature (`js/features/<id>/`) that plug in through events, hooks,
states and services. **Read [`ARCHITECTURE.md`](ARCHITECTURE.md)** for the full contract.

Every model (219 of them: cars, people, buildings, props, whole sets like the courtroom, the bar
and the Vegas Strip) is built **from code in Blender** by `blender/assets_<id>.py`, exported to
`assets/*.glb`, with an editable `blender/blend/<id>.blend` per module:

```sh
blender -b -P 3d/blender/make_assets.py                    # rebuild everything
blender -b -P 3d/blender/make_assets.py -- --only journey  # one module
# no Blender app?  pip install bpy  &&  python 3d/blender/make_assets.py [--only <id>]
```

## Testing

`npm run smoke:3d` runs every `scripts/tests3d/*.js` in headless Chromium with a fake controller
(`SMOKE3D_ONLY=core,law` for a subset, `--shots` for screenshots). The whole suite takes a couple
of hours in software WebGL, so CI runs `core,platform` on every push and the full suite on demand
(GitHub → Actions → **3D full suite** → Run workflow).
