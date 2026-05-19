# How to update lulu.boats with v5 — 10-Agent Quality Pass

This update is the result of **10 specialized agents** each auditing one area of the game (QA, bug hunting, visual polish, character art, animation, audio, UI/UX, mobile, performance, new features). Their reports flagged dozens of issues — this release fixes the highest-impact ones.

Deploy is the same as before — drag files to GitHub, commit, refresh. ~3 minutes.

## What's fixed / new in v5

### 🐛 Critical bug fixes (would have broken your playthrough)

1. **Tablet trap** — Before: tapping the tablet in Dina's bedroom dropped you into Lulu's driving game with **no way back to Dina's home**. Now: the pause-menu QUIT and the game-over MAIN-MENU buttons route back to Dina's home when you entered via tablet.

2. **Tablet was hidden inside the bed hitbox** — Before: tapping the tablet on the bed actually triggered "Take a nap". The tablet was unreachable. Fixed.

3. **Pause toggling on its own** — Before: pressing P or clicking pause could instantly resume because the same keystroke counted as both "pause" and "action". Fixed.

4. **State leaks between runs** — Before: dying in challenge parking and starting a regular game could carry over stale lives/cameras/parking-cars to the wrong place. Fixed by resetting everything on resetGame.

5. **Morgan plushie back button was invisible** — Before: the BACK button was drawn at y=80 but its click hitbox was at y=30, so tapping it did nothing. Fixed.

6. **Morgan's "chin" pet zone unreachable** — Removed (you can pet head/back/belly).

7. **Dina target position undefined** if the bus intro was skipped — could cause NaN movement. Fixed.

8. **Mom's first speech bubble was empty** for the first second of the run home. Now starts properly.

9. **Angry-man revenge sequence didn't clean up** — old objects lingered into game over. Fixed.

### 📱 Mobile-friendly improvements

- All touch buttons are now **64×64 pixels** (up from 40-56px). Comfortably above Apple's 44pt minimum.
- **More space between adjacent buttons** — 12-16px gaps instead of 6-8px.
- Buttons moved **above the iPhone home-indicator zone** (last 34px of screen).
- **Pause button moved to 48×48** in top-left (was 40×40).
- **New 📣 honk button** on the right side of the main game (above missile), so you don't need a keyboard.

### 🎨 Visual polish

- **Sky-to-grass gradient** on the Lulu road instead of one flat green. Adds depth.
- **Drop shadows on road edges** — the road feels like it sits on the world instead of floating.
- **Chunky 3px black outlines** on the road, matching Sneaky-Sasquatch style.
- **Character-select gradient** now matches the rest of the game (sky-green-to-grass) instead of pink-orange-purple sunset.
- **"LEV BAIS YAAKOV"** text on the bus is now in a white panel with proper outline — much more readable.
- **Pedestrians** got proper big eyes with sparkles, rosy cheek dots, and an "oh!" surprised mouth instead of dead black dots.

### 🎵 New sound effects (all Web Audio — no files)

10+ new synthesized sounds added:
- **Character select** — bright two-note "ding" when you pick a sister
- **School bus door hiss** — proper filtered white noise
- **School bell** — overtone-rich ring with a delayed echo
- **Dog bark** when you pet the golden retriever
- **Hopscotch jump** — pitch-up "boing" when you earn a sticker
- **Star sparkle** for achievements
- **Sprinkler water**, **squirrel chitter** (in code, ready to wire)

### 🎺 Honk Symphony (NEW feature)

Press **H** repeatedly — each honk plays the **next note up a C-major scale**. Chain 4+ in a row and you get a sparkly "♪ 4x!" floater. Pedestrians wave, animals scatter faster. Pure delight.

### ✨ Coin pop + sparkle animations

Coins collected now spawn a **floating "+1" number** that drifts up and fades out — instant visual feedback that you got it. Same for stickers (+⭐), butterflies (+1 🦋), dogs (+2 🐕), sprinklers (+⚡).

### 🎬 Easing helpers + button press fx

- New easing functions: `easeOutBack`, `easeOutQuad`, `easeOutElastic` (used internally)
- **Button press flash** — every touchable button now triggers a brief visual flash when pressed, so your taps feel responsive
- Floater system used by anything that wants to spawn a temporary "+N" or text effect

### 🧹 Code quality

- Removed dead code (`spawnCop` was never called)
- Renamed shadowed `keys` variables that conflicted with the keyboard state
- Moved `parkingExtras` declaration earlier so it's not relying on JS hoisting
- Added missing resets in `resetGame()` so all sub-modes start clean
- Added missing reset of `dinaRunTimer` when entering home

## How to deploy

1. Open your GitHub repo (lulu-game)
2. **Add file → Upload files**
3. Drag every file from your `lulu game` folder
4. Commit with a message like "v5: 10-agent quality pass"
5. Wait ~1 minute for the green checkmark
6. **Pull down to refresh** on lulu.boats (or if installed as an app, **uninstall and reinstall** to bust the cache)

## What's still pending (deferred for next batch)

These were flagged by agents but require more invasive changes — saved for v6:
- **Offscreen canvas caching** for the bedroom interior (perf win)
- **Background music loops** (atmospheric pads for each state)
- **Sasquatch hitchhiker** mini-event
- **Ima's text messages** mini-event
- **Mrs. Greenblatt the crossing guard** NPC
- **Run-cycle bouncing** for all characters
- **Scene fade transitions** between states

All have detailed designs ready — just need the next session to implement.

---

Have fun! The game should now feel **significantly less buggy and more polished** on your phone.
