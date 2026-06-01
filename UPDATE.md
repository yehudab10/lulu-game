# lulu.boats v9 — Big polish + bug fixes

This update fixes the broken music, makes Lulu actually look like a girl, fixes
Dina's weird walk, and adds a bunch more story/personality everywhere.

## 🐛 The big fixes

### 🎵 Music works again
The music was pointing at the wrong place and silently failing. The 5 song
files now live in an **`audio/` folder** and the game finds them correctly.
**Music starts after your first tap** (browsers block autoplay until you touch
the screen — that's normal).

### 👧 Lulu actually looks like a girl now
Her little in-car face was a muddy brown blob. She now has center-parted hair
that flows down both sides of her face, big sparkly eyes, blush, and a smile —
cute and clearly a young woman.

### 🏃 Dina's walk home is fixed
The objects on Dina's run used to hang in the air while the ground rushed past
(it looked like everything was running *with* her). Now the hazards, fences, and
ground all move **toward her** at the same speed — and when she sprints,
everything speeds up like it should.

## ✨ More depth & story

### 💜 Avigail door scene — twice as long, way funnier
Grew from 4 to **8 dialogue decisions** with new comebacks, new facial
expressions (smug, panic, lovestruck), and a little memory: if you tell her you
brought rugelach at the door but then admit you didn't, she calls you out on it.

### 💇‍♀️ Salon — a whole experience now
Before the color pick, Fabio now gives you a **consultation** ("I see GREAT
trauma in zis hair") and lets you pick a **style** (Zee Sheitel / Big & Bouncy /
The 'Avigail'). He reacts differently to every color you choose, and there's a
rare **"the cat knocked the bottle" oops** moment. The hair color still saves
permanently onto Lulu.

### 🎀 Dina mode
Dina now **chatters cheerfully** while she runs ("Wheee!", "Hi doggy!", "Almost
there!"), with different lines when she sprints, stumbles, or gets close to home.

## 💅 UI polish
- **Buttons now squish** satisfyingly when you tap them.
- **Back buttons and tabs are bigger** and consistent, so they're easier to tap
  on a phone.

## 🔧 Under-the-hood fixes
- Fixed a few small glitches where things could "leak" between runs (leftover
  screen-shake, etc.).
- Fixed the mute button trying to restore a song that didn't exist.
- Made the Dina character-select transition more reliable.

---

## Deploy checklist
- [ ] Upload the **`audio/` folder** (all 5 mp3s) to GitHub — **don't skip this**
- [ ] Upload updated **`game.js`**
- [ ] Commit + wait ~1 min
- [ ] Hard-refresh lulu.boats (or uninstall + reinstall the home-screen app)
- [ ] Tap once to start music
- [ ] Check: Lulu's face looks cute; music plays; Dina's run looks right

Enjoy! 🚗💨💜
