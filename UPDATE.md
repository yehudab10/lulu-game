# lulu.boats v8 — Real music + Avigail + Salon + Esti

Big update! Real MP3 music, two new ~1-minute story modes, and an ex-bff text.

## ⚠️ IMPORTANT — this update adds an `audio/` FOLDER

Unlike past updates (one `game.js` file), this one adds **5 music files in a new `audio/` folder**. You MUST upload that folder to GitHub or the music won't play.

The `audio/` folder contains:
- `audio/lulu.mp3` (Lulu driving music)
- `audio/dina.mp3` (Dina mode music)
- `audio/parking.mp3` (parking music)
- `audio/avigail.mp3` (Avigail mode music)
- `audio/salon.mp3` (salon music)

### How to upload a folder to GitHub
1. Go to your repo → **Add file → Upload files**
2. **Drag the entire `audio` folder** from your `lulu game` directory into the upload box (GitHub preserves the folder structure — you'll see `audio/lulu.mp3` etc. listed)
3. Also drag the updated **`game.js`**
4. Commit
5. Wait ~1 min, then hard-refresh lulu.boats

> If you only upload `game.js` and forget the `audio` folder, the game still works but is silent. The browser will just fail to load the missing files (no crash).

---

## 🎵 Real background music (replaces the synthesized beeps)
Each mode now plays its own real MP3 track, looping:
| Mode | Track |
|---|---|
| Menu / Character select / Lulu driving | `lulu.mp3` |
| Dina mode (bus, run, home, Morgan) | `dina.mp3` |
| Parking challenge | `parking.mp3` |
| **Avigail mode** (new) | `avigail.mp3` |
| **Salon mode** (new) | `salon.mp3` |

**Music starts after your first tap** (browsers block autoplay until you interact — this is normal).

## ⏸️ Pause menu upgrades
The pause menu now has **three toggle buttons**:
- **▶ RESUME**
- **♪ MUSIC: ON/OFF** — turn the music off without muting sound effects
- **🔊 SOUND: ON/OFF** — toggle sound effects
- **QUIT TO MENU**

## 💔 Esti's texts (ex-best-friend)
While driving as Lulu, you'll sometimes get a text from **Esti** — Lulu's ex-bff — saying she misses her. Shows up as a purple "💔 ESTI" phone notification (vs the pink "📞 IMA" ones). Bittersweet messages like:
- "hey... i miss u 🥺"
- "we used to be best friends..."
- "saw ur car today. u didn't wave 😢"
- "miss our drives together 💔"

## 💜 AVIGAIL MODE (new ~1-min event)
While driving, **Avigail** sometimes walks along the road (purple top, curly black hair, gold hoops). A pulsing "AVIGAIL!" label appears above her. **Drive into her** to trigger the event:

1. **Lulu knocks on Avigail's door** ("AVIGAIL'S LAIR" nameplate, "GO AWAY :)" doormat)
2. **4 branching dialogue decisions**, each with 2-3 tappable choices. It's a whole bit:
   - Avigail pretends she's the cat ("Nobody's home! This is her cat speaking.")
   - She's mad Lulu left her on read for 9 days ("You sent a THUMBS UP, Lulu.")
   - Why was she walking? ("It's RESTING. It's not broken, it's RESTING.")
   - The aux cord standoff ("It was a JOURNEY and you weren't ready.")
3. Each choice gets a funny comeback, with Avigail's face changing expression (suspicious / annoyed / dramatic / excited)
4. She finally agrees and gets in: **"AVIGAIL JOINED! 2× POINTS!"**

**Reward:** Avigail rides shotgun (you'll see her curly hair in the car) and **all points are doubled for the rest of the run.**

## 💇‍♀️ SALON MODE (new ~1-min event)
While driving, **hit the pink SALON sign** on the road to enter the hair salon:

1. **Fabio Von Fluff** — a dramatic stylist with a towering teal pompadour and pencil mustache — greets you ("Ah, bonjour! You sit in zee chair of GENIUS!")
2. **Pick a hair color** from 6 swatches: Platinum Blonde, Golden Blonde, Brunette, Jet Black, Pink, Blue
3. Dramatic processing beat (sparkles, music swell, "Mixing zee potion… Patience is beauty… ALMOST…")
4. **The reveal:**
   - **Pick BLONDE** (Platinum or Golden) → Lulu is ECSTATIC: "I'm BLONDE! I'm basically a different person now!"
   - **Pick anything else** → Lulu is DEVASTATED with color-specific meltdowns:
     - Brunette: "It's the SAME?! I paid for a personality change!!"
     - Jet Black: "I look like I joined a SAD BAND!"
     - Pink: "I'm a COTTON CANDY GOBLIN! My LAWYER will hear of this!"
     - Blue: "I look like a TROLL doll!! ...tell my car I loved it."
   - Fabio, unbothered: "Art is pain, darling."

**The chosen hair color carries onto Lulu PERMANENTLY** — it's saved and shows on her car, her portrait, everywhere, across sessions (until you visit the salon again).

## 🔧 Under the hood
- Replaced Web Audio synth music with HTML5 `<audio>` file playback (cached, looped)
- `save.luluHair` stores the chosen hair color (defaults to brown), used everywhere Lulu's hair is drawn
- Added `pointMult` global (2× when Avigail's aboard)
- Game loop now falls back to `setTimeout` when the tab is hidden (so music doesn't hard-freeze on tab switch)
- Avigail spawns as a reachable roadside walker; salon spawns as a roadside sign — both like the existing parking/ice-cream pickups

---

## Deploy checklist
- [ ] Upload the **`audio/` folder** (all 5 mp3s) to GitHub — **don't skip this**
- [ ] Upload updated **`game.js`**
- [ ] Commit + wait 1 min
- [ ] Hard-refresh lulu.boats (or uninstall+reinstall the home-screen app)
- [ ] Tap once to start music (autoplay needs a tap)
- [ ] Test: drive into Avigail → door scene plays → 2× points after
- [ ] Test: hit salon sign → pick a color → it sticks on Lulu's car
- [ ] Test: pause → toggle music off/on

Enjoy the drama! 💜💇‍♀️🎵
