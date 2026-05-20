# lulu.boats v7 — Critical bug fixes + redesigns

Targeting the issues you flagged. Deploy is the same 3-min process.

## 🚨 Important — how to verify the version actually deployed

If you keep seeing the old version on your phone:
1. **Pull-to-refresh** on lulu.boats (or hard refresh: hold the refresh button)
2. If you installed it as an app on your home screen, **uninstall and reinstall** — the PWA cache is sticky
3. Try a different device or **Incognito/Private** browsing window to confirm the new version IS deployed

The file you upload to GitHub must literally be the `game.js` that's currently in your `lulu game` folder. The most common cause of "old version showing" is that the upload to GitHub got skipped or replaced the wrong file.

## What's fixed in v7

### 🔴 Major bug: Mom was catching Dina in 8 seconds
**Before:** Mom's catchup rate was 0.12/sec — over a 45-second run she'd close 5.4 units of distance. Starting distance was only 1.0, so she'd catch Dina at ~8 seconds. Game-breaking.

**After:** Mom no longer naturally catches up at all. She only gains ground when:
- **Dina stumbles** (small +0.10/sec while stumble timer is active)
- **Dina is in slow-walk mode** (small +0.04/sec)
- **Final 10 seconds of the run** (+0.025/sec — tension builds at the end)
- **Sprinting actively pushes Mom back** (Dina pulls ahead)

Now if you run cleanly, you make it home. Mom only catches up if you slow down a LOT or take too many hits. Both endings still possible — just earned, not arbitrary.

### 🔴 Major bug: Morgan back button didn't work
**Before:** The visible "BACK" button was at y=80, but the click hitbox was at y=30 (50px above the visible button). Tapping the button did nothing.

**After:** Hitbox enlarged to (10, 70, 80, 80) — covers the button AND its label, with extra padding. Plus it now plays a click sound for confirmation.

### 🐒 "Lulu looked like a monkey" — face redesigned
**Before:** Olive skin (#E8B89A) + very small dark almond eyes + freckles + dark brown hair → at 16px wide, this read as monkey-esque.

**After:**
- **Brighter skin tone** (#FFD4B8 — peachy, clearly human)
- **Warm brown hair** (#8B5A2B — was too dark before)
- **Bigger feminine eyes** with eye sparkles (almond shape, brown iris)
- **Eyebrows** added (small thin arcs — gives expression)
- **Soft pink blush** on cheeks
- **Pink lips** restored (clearly feminine)
- **Eyelashes** more visible (small upward curves on outer corners)
- **Subtle face outline** for definition

Applied to BOTH `drawLuluCar` (in-game) AND `drawLuluCarFull` (parking scene) so she looks consistent everywhere.

### 🐻 "Dina looked fat" — coat slimmed down
**Before:** Dina's pink puffy coat was an ellipse 16×14 (Big!) plus highlight puffs adding to the bulk. The character-select portrait had a 65×50 coat with 14px-radius puff points all around — she really looked spherical.

**After:**
- **Top-down body:** ellipse reduced to 12×10 with chunky 1px outline for definition
- **Portrait:** ellipse 44×38 with smaller 8px puff bumps (was 14px)
- **Head outline** added (1px black) for the cartoon definition
- **Arms slimmer + closer to body** (4px wide, was 5px)
- **Hands smaller and tucked in**

She now looks like a kid in a puffy coat, not a marshmallow.

### 🏠 Bedroom redesigned (objects no longer overlap)
**Before:** Door (x:380-460) overlapped Bed (x:340-470, y:280-460). Tablet (x:350-410, y:320-360) was entirely inside the bed. Tapping the tablet triggered "nap".

**After (completely new layout):**
- **Door + sign:** LEFT WALL upper area (x:8-78, y:90-220). Has a yellow "DINA'S ROOM" sign above it.
- **Crayon drawing** of mom + dina holding hands: above-left wall (x:95-155, y:100-160). Cute little artifact.
- **Bed:** RIGHT-MIDDLE area (x:280-460, y:320-480). With chunky outline, quilted pattern, white pillow with a tiny teddy bear on it, mint blanket folded at the foot.
- **Cookie + milk:** bottom-center on a little wooden side table (x:130-190, y:510-560). Tap to eat (+5 coins, crunch sound!).
- **Tablet:** bottom-center, free-standing (x:230-290, y:510-554). Now shows a mini Lulu game preview on its screen. Tap to play Lulu's game on her tablet.
- **Sticker book:** bottom-right (x:320-390, y:510-570). New! Tap to see your collected stars count.
- **Morgan plushie:** bottom-left (x:30-94, y:540-610). Bigger draw (scale 0.7 instead of 0.6) so she's more visible. Tap to enter Morgan play mode.
- **Big rug** at the bottom (200×60 ellipse) tying it all together.

Now **6 interactive items** (was 4), all clearly separated, none overlapping.

### 🎨 Other touches
- Home message banner appears when you interact (e.g., "🍪 Yum! +5 coins")
- HUD header simplified to "🏠 Dina's Bedroom"
- Hint text changed from "Arrow keys to walk · Space to interact" → "Walk with arrows · Tap any item to interact"

---

## How to deploy

1. GitHub → your `lulu-game` repo → **Add file → Upload files**
2. Drag every file from `lulu game` folder
3. Commit ("v7: critical bug fixes + bedroom redesign + Lulu/Dina face fixes")
4. Wait ~1 minute for green ✓
5. **Critical:** Pull-to-refresh on lulu.boats. If installed as app on home screen, **uninstall + reinstall**.

---

## Quick test checklist after deploying

- [ ] **Character select:** Lulu portrait looks like a young woman (brighter skin, pink lips). Dina portrait isn't spherical anymore.
- [ ] **Lulu mode:** Lulu's face in the car looks human (not monkey).
- [ ] **Dina mode:** start a run, do nothing — Mom should NOT catch you in 8 seconds. You should easily reach home.
- [ ] **Dina mode:** stumble into a hydrant 5+ times — Mom slowly closes in.
- [ ] **Bedroom:** all 6 items are visible, none overlap. Tap each one and it triggers the correct interaction.
- [ ] **Morgan play:** tap the BACK button → returns to bedroom (not stuck).

If anything still looks broken on your phone but works in a private/incognito browser → it's a cache issue. Try clearing app data or reinstalling.
