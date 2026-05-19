# How to update lulu.boats with v4 — Bruck Sisters update

This is the biggest update yet! Adds a whole new character (Dina) with her own mini-mode, a character-select screen, plus Lulu's appearance is refined to match the photo.

Deploy is the same as before — drag files to GitHub, commit, refresh. ~3 minutes.

## The easy way (drag & drop, no terminal)

### 1. Open your GitHub repo
- Go to your repo (e.g., **https://github.com/yehudab10/lulu-game**)

### 2. Upload all the files
- Click **Add file** → **Upload files**
- Drag every file from your `lulu game` folder onto the upload area
- The two big ones that changed: **`game.js`** and **`index.html`**
- Scroll to the bottom → **Commit changes** with a message like "Add Bruck Sisters character select + Dina mode"
- Click the green Commit button

### 3. Wait ~1 minute
- The repo will show a green ✓ check mark when GitHub Pages finishes deploying.

### 4. Open lulu.boats on your phone
- Pull down to refresh (this busts the old cache).
- If you have it installed as a home-screen app, **uninstall and reinstall** to get the new version.

---

## What's new in v4 — The Bruck Sisters Update 👯

### 🎀 Character Select Screen (NEW first screen)
When you open the game now, you'll see **"Pick a Bruck Sister!"** with two cards:

**Lulu — 18**
- Long brown hair, brown eyes, white floral tee, gold necklace
- Drives the pink car
- Pink magenta card border
- *"Pink car. Big sister energy."*

**Dina — 8**
- Brown ponytail, big smile with dimples, pink puffy coat
- Holding Morgan the cat plushie
- Lilac purple card border
- *"Has Morgan. Runs fast."*

Sunset gradient background with drifting confetti. Tap a card to enter that sister's mode. Tap the ◀ button on either menu to come back to character select.

### 👧 Dina Mode — Brand New
**Dina is in 2nd grade** and just got off the school bus. Her mom is late picking her up, so she walks home herself. Then she's at home — what does she want to do?

**1. School bus intro (8 seconds)**
- A yellow **"LEV BAIS YAAKOV"** school bus pulls up with flashing red/orange lights and a deployed stop sign
- The door hisses open, **6 girls in school uniforms** (navy skirts, white shirts, backpacks) hop off and scatter
- Dina is the last off, carrying her backpack with a unicorn keychain
- She looks around — thought bubble: *"Where's mom?"*
- Determined: *"Hmph! I'll walk!"*
- Bus drives off and the run-home mini-game begins
- Tap to skip the intro if you want

**2. Run Home mini-game (~45 seconds)**
- Top-down view scrolling up
- Dina runs along the sidewalk in 3 lanes (left grass / center / right grass)
- **Controls:**
  - **← → / ◀ ▶ buttons:** switch lanes
  - **↑ / ⚡ button:** sprint (uses a 3-second sprint meter, recharges over time)
  - **↓ / 🐢 button:** slow walk (lets you sneak past sleeping cats)
- **Mom chases on screen** behind her (purple sweater, handbag). She says cute things: *"Wait up!"*, *"Dinaaaa!"*, *"Hold on!"*. A "!" appears above Dina's head when mom is close.
- **9 kid-friendly hazards/treats** (all non-scary):
  - 🚰 Fire hydrant — bump = small stumble
  - 🐕 Golden retriever — pet it (+2 coins, but pauses you)
  - 🦋 Butterfly — follow for coin
  - 🐿️ Squirrel with acorn — darts across, can trip you
  - ⚽ Stray kickball — dodge it
  - 💧 Sprinkler — refills sprint meter
  - ✏️ Hopscotch chalk — earns a sticker
  - 📬 Mailbox — has a crayon "GO DINA!" sign
  - 🐈 Mr. Whiskers the cat — basking on sidewalk, judges you silently
- **Progress bar** at top shows how close to home Dina is
- **Home appears in the distance** at 80% progress (welcome mat, "HOME ♥" sign)
- **Two endings, both cute** — no fail state:
  - **Reach home before mom:** *"I BEAT YOU, MOM!"* fist pump on porch
  - **Mom catches up:** *"Fine, let's walk together."* They hold hands and walk in
- All coins and stickers carry over

**3. Home Interior**
After arriving home, you're in Dina's bedroom — a top-down view of a cozy kid's room:
- **Walls:** cream
- **Wood plank floor** with grain lines
- **Bed:** big pink quilt with white pillow, mint blanket at foot — **tap to take a nap**
- **Tablet on the bed** — **tap to play the Lulu game on her tablet!** (game-within-a-game!)
- **Morgan the cat plushie** on the rug — **tap to pet her**
- **Window** with curtains and sun streaming through (sunbeam on floor)
- **"BE BRAVE" poster** with a fox on it
- **Glow-in-the-dark stars** on the ceiling (faintly pulsing)
- **Cookie + milk** on the desk corner (half-eaten)
- **Crayon drawing** of mom and Dina holding hands (taped near the door)
- **Toy bin** with plushies poking out (star, rainbow)
- **Door** to go back outside
- HUD shows time (3:45 PM), happiness meter, coin count, "Mom: kitchen"
- Walk Dina around with arrow keys, tap or press SPACE to interact

**4. Morgan the Plushie**
A whole sub-mode dedicated to playing with her purple-grey cat plushie:
- Big Morgan filling the screen, sitting on a pink blanket
- **Tap her head/back** = pet her (3 hearts float up)
- **Tap her belly** = hug (8 hearts burst!)
- A glowing yellow circle highlights what she wants pet
- **Happiness bar** at top fills with each interaction
- **At 100%** Morgan bounces, winks, big celebration with star burst (+1 ⭐ saved to your stars)
- Back button (◀) returns to bedroom

**5. Take a Nap**
Tap the bed → dimming-dusk transition → Dina tucked in with mint blanket → floating Z's → "RESTED! +1 ⭐"

**6. Tablet Game**
Tap the tablet → drops you into the regular Lulu driving game ("Dina playing Lulu's game on her tablet"). Hilarious meta moment.

### 💄 Lulu's Look — Refined
Updated to match the photo reference:
- **Hair** changed from very-dark-curly-with-bow → **medium brown, long, flowing, center-parted**
- **Eyes** softened from anime → adult almond with brown iris
- **Freckles** added across nose bridge
- **Smile** changed from pursed pink lips → soft natural curve
- **Skin tone** warmed (peachy olive)
- **Tiny gold necklace dot** at chest

Same change applies in both the road driving view AND the parking mini-game.

---

## Controls reference (everything)

### Character select
- Tap either card to choose
- Lulu = drives. Dina = runs.

### Lulu mode
Same as before: ←→ steer, ↑ boost, ↓ slow, M missile, H honk, P pause. ◀ button (top-left) goes back to character select.

### Dina Run Home
- ← → lane switch
- ↑ sprint (limited meter)
- ↓ slow walk (sneak past cat)
- On mobile: ◀ ▶ ⚡ 🐢 buttons at bottom

### Dina home
- Arrow keys to walk around her bedroom
- Tap an object OR press SPACE next to it to interact
- 4 interactables: **bed (nap)** · **tablet (Lulu game)** · **Morgan (plushie)** · **door (back outside)**

### Morgan plushie
- Tap anywhere on Morgan (head, back, belly)
- ◀ button (top-left) to exit

### Nap
- Tap to wake up

---

## Troubleshooting

**Black screen / nothing loads**
→ Open dev tools (F12 → Console). Send me any red errors.

**Old version showing**
→ Hard refresh (Ctrl+Shift+R on desktop). On mobile, pull-to-refresh. Installed app cache is sticky — uninstall and reinstall.

**Can't get to character select**
→ It's the new first screen. If you're stuck in Lulu mode, tap the ◀ button at the top-left of the main menu.

**Dina's run feels too fast/slow**
→ Use the slow walk (↓ / 🐢) to sneak. Use sprint (↑ / ⚡) to outrun mom near the end.

**Mom always catches Dina**
→ Try sprinting on the last 25%. Save sprint for emergencies. Petting the dog is a *trap* — it pauses you long enough for mom to catch up.

---

That's it! Enjoy the Bruck Sisters game. 👯
