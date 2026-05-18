# How to update lulu.boats with the new version

You've already deployed once, so DNS + GitHub Pages are configured. To push new code, you just upload the new files — DNS doesn't change. Should take **3 minutes**.

## The easy way (drag & drop, no terminal)

### 1. Open your GitHub repo
- Go to **https://github.com/yehudab10/lulu-game** (or wherever your repo lives)

### 2. Upload all the files at once
- Click **Add file** → **Upload files** (top right above the file list)
- Drag **every file** from your `lulu game` folder onto the upload area:
  - `index.html`
  - `game.js`
  - `style.css`
  - `manifest.webmanifest`
  - `icon-192.svg`
  - `icon-512.svg`
  - `CNAME` (already there — uploading again is fine)
  - `.nojekyll` (already there — same)
  - `README.md`, `DEPLOY.md`, `UPDATE.md` (optional)
- GitHub will show "X files modified" — that's good
- Scroll down to **Commit changes**
- Commit message: something like *"Add Parking Challenge mode + fix mobile"*
- Click the green **Commit changes** button

> **Tip:** Hidden files like `.nojekyll` need File Explorer → **View → Show → Hidden items** to be visible.

### 3. Wait ~1 minute for GitHub Pages to deploy
- Look for the green ✓ check mark next to your commit on the repo page.

### 4. Open lulu.boats on your phone
- **Pull down to refresh** to bust the old cache, or:
- If you installed it as an app on your home screen, **uninstall and reinstall** (the app cache is sticky).

---

## What's new in this version (v3 — Parking Challenge)

### 🅿️ PARKING CHALLENGE — a whole new game mode
A new blue **"🅿 PARKING"** button on the main menu, right between PLAY and SHOP. Click it to enter a dedicated parking-only mode.

- **10 progressive levels** — each with a fun name:
  1. **Downtown Block** (intro)
  2. **Busy Street**
  3. **Tight Squeeze** (narrower spot)
  4. **Cone Zone** (cone obstacle in the middle of the spot — knock it for fun, but lose your ★)
  5. **Rush Hour**
  6. **Dusk Drive** (orange sky theme)
  7. **Tight & Dark**
  8. **Diagonal Danger**
  9. **Midnight Park** (night theme — your car's headlights light the scene)
  10. **BOSS LEVEL**
- **3 lives** per run. Each level you fail you lose a life. Each level you pass you advance.
- **Star rating per level:**
  - ⭐⭐⭐ — Perfect park: no scratches, no cones knocked
  - ⭐⭐ — Clean park: no car-to-car damage
  - ⭐ — Made it (with damage)
- **Day → dusk → night** sky themes as you progress. Buildings change color, stars come out at night, your car's headlights illuminate the parking spot.
- **1–3 security cameras** track you live with red laser sight lines (more cameras on harder levels).
- **Cone obstacles** placed inside the parking spot from level 4 onward.
- **Pedestrians** walk across the sidewalk from level 5 onward — hit one = instant fail (don't worry, they always cross above the curb so you only hit them if you drive on the sidewalk).
- **Tighter parking spots** and **shorter timer** each level.
- **End-of-run screen** with stats: level reached, stars earned, coins earned, all-time best level, total stars, perfect parks count.
- **All progress saves** to localStorage — your best level + total stars appear on the main menu.

### 📱 Mobile controls FIXED for parking
The parking minigame now has a proper **D-pad** at the bottom of the screen:
- **◀ ▶** (bottom-left, white): steer left / right
- **▲** (bottom-right, green): drive forward
- **▼** (bottom-right, red): reverse

Labels "STEER" and "DRIVE" appear under the buttons. They work on both touch and desktop (clicking with mouse also fires them). Keyboard arrow keys still work too.

### 🎁 Bonus rewards
Successful parks in challenge mode earn:
- Coins (more per level — 25 × level, plus 15 per star)
- Stars (saved to your all-time total)

### Other fixes
- The parking scene now reliably initializes even when accessed directly from the menu (no road game required)
- The result screen now shows your **star rating** for the level
- The game now draws the first frame synchronously so it shows up faster on slow connections

---

## Controls reference

### Main game
- **← → / A D**: steer
- **↑ / W**: speed boost
- **↓ / S**: slow down
- **M**: fire missile
- **H**: honk
- **P / Esc**: pause
- **Space / Enter / Click**: confirm / restart

### Parking mini-game
- **← → / A D / on-screen ◀ ▶**: steer the wheels
- **↑ / W / on-screen ▲**: drive forward
- **↓ / S / on-screen ▼**: reverse
- **P / Esc**: pause

**To park successfully:** get the car into the dashed yellow rectangle, with the car roughly horizontal (parallel to the curb), and hold still for ~1 second.

---

## Troubleshooting

**The PARKING button doesn't do anything**
→ Hard refresh (Ctrl+Shift+R on desktop, pull-down on mobile). If installed as a home-screen app, reinstall.

**Mobile D-pad buttons don't show up**
→ The page detects touch devices automatically. If you don't see them, you're probably on desktop — use arrow keys instead.

**Lulu keeps crashing into the parked cars**
→ Drive SLOWLY. Hold ▲ for short bursts. Use ▼ to back up. The bicycle-model steering means the car turns more when moving — pivot-steering won't work.

**Cone in the spot is annoying**
→ You can knock it over with the side of the car and still park successfully, but you'll lose your 3-star rating (becomes 2 stars). To get ⭐⭐⭐ on cone levels, steer around it carefully.

**Pedestrian got hit and I lost instantly**
→ Pedestrians always walk along the sidewalk at the top of the scene. Don't drive into the sidewalk strip — stay below the yellow curb line.

**Game crashed / blank screen**
→ Open dev tools (F12 → Console) and send me any red errors.

---

## To make further updates later
Same process: edit files → GitHub → Upload → Commit → wait 1 min.

You never have to touch DNS, Namecheap, or terminal. 🎉
