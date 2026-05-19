# How to update lulu.boats with v5 — 10-Agent Quality Pass (complete)

This is a HUGE update — 10 specialized agents each audited one area of the game (QA, bug hunting, visual polish, character art, animation, audio, UI/UX, mobile, performance, new features) and their fixes have been integrated.

Deploy is the same: drag files to GitHub, commit, refresh. **~3 minutes total.**

---

## What's fixed / new in v5

### 🐛 Critical bug fixes (would have broken your playthrough)

1. **Tablet trap** — tapping the tablet in Dina's room dropped you into Lulu's game **with no way back**. Now: pause/QUIT and game-over MAIN-MENU route back to Dina's home when you came via tablet.
2. **Tablet hidden inside bed hitbox** — tapping the tablet on the bed used to trigger "Take a nap" instead. Fixed.
3. **Pause toggled on its own** — same keystroke counted as pause + action. Fixed.
4. **State leaks** — dying in challenge parking → starting a regular game carried over stale data. Fixed by resetting everything in `resetGame()`.
5. **Morgan back-button invisible hitbox** — drawn at y=80 but click hitbox at y=30 — fixed.
6. **Morgan "chin" pet zone unreachable** — removed, replaced with head/back/belly only.
7. **Dina target position undefined** if bus intro was skipped — fixed.
8. **Mom's first speech bubble was empty** — sayTimer now initializes properly.
9. **Angry-man / revenge-car leftover state** lingered into game over — cleaned up.

### 📱 Mobile-friendly improvements

- All touch buttons **standardized at 64×64** (was 40-58px). Comfortably above Apple's 44pt minimum.
- **12-16px gaps** between adjacent buttons (was 6-8px).
- Buttons moved **above iPhone home-indicator zone** (last 34px).
- **Pause button bumped to 48×48** in top-left.
- **New 📣 honk button** on right side of main game (above missile) — no keyboard needed.

### 🎨 Visual polish (chunky Sneaky-Sasquatch-style outlines everywhere)

- **Sky-to-grass gradient** on Lulu's road + road drop shadows + **chunky 3px black outline**
- **Char-select gradient** unified with the rest of the game (sky-green-to-grass instead of pink-orange sunset)
- **"LEV BAIS YAAKOV"** text now sits in a white outlined panel — much more readable
- **All parking buildings** got chunky outlines + **proper trapezoid roofs**
- **Dina's sidewalk** now has shadow edges + chunky outline + lawn flower pops + proper picket fences with crossbars (instead of floating white rectangles)
- **Dina bus scene** uses unified greens + lane lines + **houses now have proper window crosses + door + outlines**
- **Dina's distant home** in run-home now has outlines + lit windows with pane crosses + outlined door
- **Dina's bedroom** has wallpaper polka dots + white baseboard with dark trim line
- **Pedestrians** now have sparkly Sneaky-Sasquatch eyes with highlights + rosy cheek dots + "oh!" surprised mouth (instead of dead black dots)
- **School girls** got chunky outlines + cheek blush + sparkly eyes + tiny smiles + 3-tone hair shading
- **Sasquatch** got bigger friendlier eyes + brow ridge + lighter muzzle + fur tufts + chunky outline
- **Angry old man** hair has darker base under the white for depth + sticky-up tufts
- **Mom** got chunky head outline + cheek blush + proper eyes with whites + worried brows + small "o" mouth
- **Small Morgan plushie** (in Dina's arms) now has proper triangular ears + pink inner ears + pink nose + sleepy happy-arc eyes (was just two ovals)

### 🎵 New sound effects (all Web Audio — no files)

- **Character select** — bright two-note "ding" when you pick a sister
- **School bus door hiss** — proper filtered white noise
- **School bell** — overtone-rich ring with delayed echo
- **Dog bark** when you pet the golden retriever
- **Hopscotch jump** — pitch-up "boing"
- **Star sparkle** for achievements

### 🎺 Honk Symphony (NEW feature)

Press **H** repeatedly — each honk plays the **next note up a C-major scale**. Chain 4+ in a row and you get a sparkly **"♪ 4x!"** floater above your car. Pedestrians wave, animals scatter faster.

### ✨ Pickup animations

Coins collected now spawn a **floating "+1"** that drifts up and fades. Same for:
- 🌟 Stickers — "+⭐"
- 🦋 Butterflies — "+1 🦋"
- 🐕 Dogs — "+2 🐕"
- 💧 Sprinklers — "+⚡"

### 🎬 Easing helpers + button press feedback

- New easing functions: `easeOutBack`, `easeOutQuad`, `easeOutElastic`
- **Every touchable button flashes** briefly when pressed (visual confirmation your tap registered)
- Floater system used by anything spawning a temporary text effect

### 🧹 Code quality

- Removed dead code (`spawnCop` was never called)
- Renamed shadowed `keys` variables (conflicted with keyboard state)
- Fixed `parkingExtras` hoisting fragility
- Added all missing resets to `resetGame()`

---

## How to deploy

1. Open your GitHub repo (lulu-game)
2. **Add file → Upload files**
3. Drag every file from your `lulu game` folder
4. Commit with a message like "v5: 10-agent quality pass"
5. Wait ~1 minute for the green checkmark
6. **Pull down to refresh** on lulu.boats (or if installed as an app, **uninstall and reinstall** to bust cache)

## What's deferred for next batch (already designed)

These were flagged by agents but require deeper changes — design specs saved:
- Offscreen-canvas caching for bedroom (perf win)
- Background music loops (atmospheric pads per state)
- Sasquatch hitchhiker mini-event
- Ima's text messages mini-event
- Mrs. Greenblatt the crossing guard NPC
- Run-cycle bouncing animation
- Scene fade transitions

---

The game should now feel **significantly more polished and less buggy** on real devices. Enjoy! 🎀👯
