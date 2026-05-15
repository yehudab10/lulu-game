# How to update lulu.boats with the new version

You've already deployed once, so DNS + GitHub Pages are configured. To push new code, you just upload the new files — DNS doesn't change. Should take **3 minutes**.

## The easy way (drag & drop, no terminal)

### 1. Open your GitHub repo
- Go to **https://github.com/yehudab10/lulu-game** (or wherever your repo lives)
- You should see your existing files: `game.js`, `index.html`, `style.css`, `CNAME`, etc.

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
- GitHub will show ✏️ "X files modified" or "X files added" — that's good
- Scroll down to the **Commit changes** section
- Commit message: something like *"Add parking minigame + cameras + sasquatch"*
- Click the green **Commit changes** button

> **Tip:** If you don't see hidden files like `.nojekyll`, open File Explorer and turn on **View → Show → Hidden items**.

### 3. Wait ~1 minute for GitHub Pages to deploy
- On the repo's main page, look for a small green ✓ check mark next to your latest commit hash. That means it's deployed.
- Or visit the repo's **Actions** tab — you'll see a "pages build and deployment" run with a green ✓ when done.

### 4. Open lulu.boats on your phone
- Hard refresh: pull down to reload on mobile, or in Chrome menu → Reload.
- You should see the new version with parking signs, sasquatch sightings, billboards, etc.

> **Pro tip:** If you've installed lulu.boats as an app (home-screen icon), it might cache the old version. Tap and hold → uninstall, then re-add.

---

## What's new in this update

### 🅿️ Parallel Parking Mini-Game
- Every 45–80 seconds, a **blue P sign** spawns on the road
- Drive through it → smooth zoom transition → parking scene
- **1–3 security cameras** track your car live with red laser sight lines
- Use **↑↓ to drive forward/reverse**, **←→ to steer** (real bicycle-model physics)
- Park between the two cars and **hold still** for ~1 sec to succeed
- **Success** → 2 kids appear in the back seat, +50 coins, +500 score, ice cream message!
- **Fail** (hit a car or run out of 60s) → damage decals appear on BOTH cars where you hit, angry man runs up yelling "WHO TAUGHT YOU TO DRIVE!?", Lulu cries with big tear drops, -1 life

### 🍦 Ice Cream Stand
- Roadside sign with a giant ice cream cone (pink scoop, cherry on top)
- Drive over it → +5 coins + kids appear in your back seat

### 🦍 Sasquatch Easter Egg
- Rare appearance (~30% chance every 50–120 sec) — a furry brown bigfoot waves at you from the roadside
- Spot one → +10 coins (auto-rewarded)

### 📋 Funny Billboards
- Roadside billboards rotate through 12 silly messages: *"SLOW DOWN, LULU!"*, *"OSTRICH CROSSING 500ft"*, *"BEWARE OF SASQUATCH"*, etc.

### 🦆 Duck Parade
- Sometimes the duck obstacle is replaced by a **mama duck leading 6 ducklings** across the road
- The last duckling trips and waddles to catch up

### 📣 Honk Button (H key)
- Press **H** to beep your horn
- Pedestrians get startled, animals scatter

### Other quality-of-life improvements
- New `manifest.webmanifest` makes the site installable as a mobile app
- Cute pink-car app icons (SVG, crisp at any size)
- Better damage decal system (dents + scratches + glass shards)

---

## Troubleshooting

**I don't see the new features after updating**
→ Hard refresh: Ctrl+Shift+R on desktop, or pull-to-refresh on mobile. Mobile installed apps might need uninstall + reinstall.

**The Pages deploy is stuck or failed**
→ Repo → Actions tab → click the failed run → see the error. Usually it's a file conflict — re-upload everything and try again.

**Something looks broken**
→ Open browser dev tools (F12 → Console tab) and look for red errors. Send them to me and I'll fix.

---

## To make further updates in the future
Same process: edit files locally → upload to GitHub via web UI → wait 1 minute → refresh lulu.boats.

You never have to touch DNS, Namecheap, or terminal again. 🎉
