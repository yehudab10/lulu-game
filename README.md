# Lulu's Road Trip 🚗💨

A cute Sneaky-Sasquatch-style driving game where Lulu tries not to crash — and
gets into a LOT of trouble on the way to Vegas. Plain HTML5 canvas + JavaScript,
no framework.

**🎮 Play it at: [lulu.boats](https://lulu.boats)** — that's **Lulu's Road Trip 2.0**, the 3D game
(controller, keyboard or touch), and the version everything new goes into. See [`3d/README.md`](3d/README.md).

**🕹️ Classic 2D (legacy):** [lulu.boats/classic.html](https://lulu.boats/classic.html) — the original canvas game,
linked from 2.0's ⚙️ More menu. Same coins and cars (shared save). It's frozen: no new features, only
fixes if something breaks. The iOS native app ships 2.0 too (with the classic game behind ⚙️ More) —
see [IOS_BUILD.md](IOS_BUILD.md).

_The rest of this README describes the classic 2D game._

## What's inside
- 🚗 Endless driving with traffic, cops, animals, tolls, trains, parades and roadside cameos
- 📖 **The Road to Vegas** — a five-stop story with chapter tasks, phone calls and replayable tours
- 🚶 **Lulu on Foot** — when the car's wrecked: walk the city, visit the bar, school, hospital, police station and beach
- ⚖️ Arrests, jail, courtroom drama and the ER
- 🛒 8 cars with real handling stats, missiles, pepper spray, Distracted Mode
- ✨ **Bling** — custom horns (yes, a shofar) and car decorations
- 📒 **Lulu's Scrapbook** — badges, a rap sheet, the ER punch card, Avigail's friendship meter, records and a save backup code
- 📞 Ima calls mid-drive · 🕎 Jewish holidays celebrated in-game
- 🌐 **Shared Road** — see other players' cars, friend rooms and races
- 📜 Weekly quests and a daily streak

## Controls
**Desktop:** ← → steer · ↑ boost · ↓ slow · M missile · H honk · P pause
**Mobile:** drag to steer · on-screen buttons (and you can drag them where you like)

## Privacy
The web game has no ads and no analytics; progress is saved in your browser.
Cruise mode joins Shared Road automatically (you can switch to solo), which
shares a nickname picked from a fun list plus your scores with the game's relay.
The iOS app shows ads (see [privacy.html](privacy.html)).

## For developers
The source lives in `src/` and is assembled into `game.js` by `node build.js` —
see [`CLAUDE.md`](CLAUDE.md) for the fragment map, `npm run smoke` for the
headless test, and [`DEPLOY.md`](DEPLOY.md) for hosting your own copy.
