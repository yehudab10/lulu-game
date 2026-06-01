# 🤖 AGENT HANDOFF — read this first

Hello, future me. This is the context dump for **Lulu's Road Trip**, a browser game I (Claude) have been building for a non-technical user across many sessions. Read this before touching anything — it'll save you hours of rediscovery.

---

## 0. The user (important — adjust your tone)
- **Non-coder.** Explain things in plain English, no jargon. They can drag files and click around web UIs but cannot read code.
- Loves the **Sneaky Sasquatch** art style (chunky cartoon, bold outlines, wholesome + silly).
- The game stars two real sisters: **Lulu** (18) and **Dina** (8), surname **Bruck**. There's also **Avigail** (Lulu's friend), **Esti** (Lulu's ex-best-friend), and **Morgan** (Dina's plushie cat). Jewish family — references like "Ima", "Abba", "cholent", "Lev Bais Yaakov", "sheitel" are intentional and welcome.
- Wants funny/dramatic/absurd content. Lulu mode = PG-13+ humor OK. Dina mode = strictly PG, never scary.

---

## 1. What the project is
- A single-page **HTML5 Canvas** game. **No frameworks, no build step, no server.** Pure vanilla JS.
- Everything game-logic lives in **one file: `game.js`** (~349 KB, ~8,500 lines). It's one big IIFE `(function(){ ... })()`.
- Canvas is **480×854** (portrait phone). Scaled to fit screen via CSS + `fitToScreen()`.
- Mobile-first (touch controls) but also works with keyboard on desktop.
- Saves progress to **`localStorage` key `"luluSaveV2"`**.

---

## 2. Deployment (you now have GitHub access — this is the big change)
- **Live site:** https://lulu.boats
- **GitHub repo:** `github.com/yehudab10/lulu-game` (user is `yehudab10`)
- **Host:** GitHub Pages (deploy from `main` branch, `/root`)
- **Domain:** `lulu.boats`, registered at **Namecheap**, DNS = 4 A-records to GitHub Pages IPs (185.199.108–111.153) + a `www` CNAME to `yehudab10.github.io`. The `CNAME` file in the repo contains `lulu.boats`. **DNS is already set up and working — don't touch it.**
- `.nojekyll` is present so GitHub Pages serves files as-is.

### To deploy (now that you have git/GitHub access)
The user historically deployed by hand (drag-drop in GitHub web UI). Now you can likely `git push` directly. **Confirm the workflow with the user**, then typically:
```
git add -A && git commit -m "..." && git push
```
GitHub Pages redeploys in ~1 minute. **Always verify on the live site** after — see §6.
- **CRITICAL:** the `audio/` folder (5 mp3s, ~10 MB total) must be committed or the music 404s (game still runs, just silent).
- After deploy, the user must **hard-refresh** (or uninstall/reinstall the PWA) because the page caches aggressively.

---

## 3. File structure
```
lulu game/
├── index.html          # viewport, PWA meta, OG tags, SVG favicon, rotate-prompt
├── game.js             # THE WHOLE GAME (one IIFE)
├── style.css           # mobile-friendly, safe-area padding, landscape rotate msg
├── manifest.webmanifest# PWA install support
├── icon-192.svg        # app icon (pink Lulu car)
├── icon-512.svg
├── CNAME               # "lulu.boats"
├── .nojekyll
├── audio/              # MUST be deployed for music
│   ├── lulu.mp3        # menu + Lulu driving
│   ├── dina.mp3        # Dina mode
│   ├── parking.mp3     # parking challenge
│   ├── avigail.mp3     # Avigail door scene
│   └── salon.mp3       # salon scene
├── README.md           # repo landing page
├── DEPLOY.md           # original first-time GitHub Pages + Namecheap setup guide
├── UPDATE.md           # rewritten each version — current deploy/changelog for the user
└── AGENT_HANDOFF.md    # this file
```

---

## 4. Architecture

### State machine
One global `var state = "charSelect"` (the initial screen). The main loop near the bottom of `game.js` dispatches `update<State>(dt)` then `draw<State>()`. Full state list:
```
charSelect      → pick Lulu or Dina (first screen)
menu            → Lulu's main menu (PLAY / PARKING / SHOP / DISTRACTED toggle)
playing         → Lulu driving (the core game)
paused          → pause overlay (RESUME / MUSIC toggle / SOUND toggle / QUIT)
crash           → death sequence (explosion + angry white-hair man runs up)
gameover        → score screen
shop            → buy skins / missiles / distracted mode
parkingIntro / parking / parkingResult / parkingEnd   → parallel-parking challenge (10 levels)
dinaBus         → school bus intro (Lev Bais Yaakov)
dinaRun         → Dina runs home, Mom chases
dinaCaught      → run outcome (reached home OR mom caught up)
dinaHome        → Dina's bedroom (6 interactables)
dinaMorgan      → pet the plushie cat
dinaNap         → take a nap
avigailScene    → knock on Avigail's door, branching dialogue (NEW v8)
salon           → Fabio Von Fluff hair salon, pick a color (NEW v8)
```
Scene transitions use `gotoState(newState)` for a fade, or `state = "..."` directly for instant.

### Save object (`save`, localStorage `luluSaveV2`)
Keys: `highScore, totalCoins, ownedSkins[], selectedSkin, missiles, shields, distractedUnlocked, parkingBestLevel, parkingTotalStars, parkingPerfectRuns, luluHair`. `loadSave()` merges defaults so old saves don't break. `persistSave()` writes.

### Canvas / scaling
`resizeCanvas()` sets the backing store with DPR; `fitToScreen()` scales the element to the viewport. Everything is drawn at logical 480×854.

---

## 5. Feature inventory (so you know what already exists — don't rebuild)

**Lulu driving (`playing`):** 3-lane road, enemy cars, cones, puddles, pedestrians (pick up = passenger = 2× coins 30s), animals (duck/raccoon/ostrich), ducks parade, coins, hearts (3 lives), speed boost (↑) / brake (↓), missiles (M), honk (H, "Honk Symphony" plays a scale), distracted mode (reversed controls, 2× score), billboards with funny text, Sasquatch sightings (honk near him → he hitchhikes, 20s, +coins), parking-sign pickup → parking challenge, ice-cream sign, **Avigail walker → Avigail scene**, **salon sign → salon scene**, Ima + **Esti** text messages.

**Parking challenge (`parking*`):** 10 progressive levels, bicycle-model car physics, 1-3 live-tracking security cameras, cones, pedestrians, day/dusk/night themes, star ratings, persistent best-level.

**Dina mode (`dina*`):** school-bus intro → run home (lane-dodge, sprint meter, hazards: hydrant/dog/butterfly/squirrel/kickball/sprinkler/hopscotch/mailbox/cat, **Mrs. Greenblatt** crossing guard), Mom chases (only catches up if Dina stumbles/slow-walks/final-10s), two endings → bedroom (tap: tablet=play Lulu game, Morgan=pet cat, cookie+milk, sticker book, bed=nap, door=exit).

**Avigail (`avigailScene`, v8):** door-knock → 4 branching dialogue decisions (data in `AVIGAIL_SCRIPT`) → she joins → `avigailInCar=true`, `pointMult=2` for rest of run. Draws shotgun passenger.

**Salon (`salon`, v8):** Fabio Von Fluff stylist, 6 color swatches (`SALON_COLORS`), dramatic processing, reveal reaction (ecstatic if blonde, meltdown otherwise). Commits `save.luluHair` → permanent.

**Audio:** file-based music per state (`startMusic`/`stopMusic`/`pauseMusic`/`resumeMusic`, `MUSIC_FILES` map). SFX still synthesized via `playTone` + helpers (`playCoin`, `playExplosion`, `playWompWomp`, `playHonkPitched`, `playSchoolBell`, etc.). `audioMuted` (SFX) and `musicMuted` (music) are separate. Both toggle in pause menu.

**Animation helpers:** `easeOutBack/Quad/Elastic`, `floaters[]` ("+1" popups via `spawnFloater`), `btnPressFx` (button press flash), `sceneFade`.

---

## 6. ⚠️ CRITICAL GOTCHAS (learned the hard way)

1. **The preview tool's tab is often HIDDEN → `requestAnimationFrame` fully pauses → the canvas freezes after the first frame.** Screenshots then time out. I added a `setTimeout` fallback in the game loop (`if (document.hidden) setTimeout(...)`) so it keeps running, but when hidden the **`dt` is capped at 0.05 and the loop runs ~1 fps → everything is ~20× slow motion.** This makes timed/click-sequence testing in the preview nearly useless.
   - **Now that you have GitHub access: deploy and test on the REAL https://lulu.boats in a visible browser instead.** Much more reliable than the preview.
   - For the preview, **pixel-sampling via `preview_eval` + `getImageData` works** even when screenshots don't. Sample distinctive colors to confirm a scene rendered.

2. **Audio needs a user gesture.** `audioUnlocked` is set true on first touch/mousedown. Music won't autoplay before that — this is correct, not a bug.

3. **Lulu's hair color** is drawn in 3 places (`drawLuluCar`, `drawLuluCarFull`, `drawLuluPortrait`). They all read `save.luluHair`. If you add another Lulu drawing, use `save.luluHair` not a hardcoded hex.

4. **Big edits to one giant file:** prefer targeted `Edit` calls. Parallel agents writing to `game.js` will conflict — use agents for *design specs*, then YOU integrate sequentially.

5. **Always run a syntax check after edits:**
   `cd "...lulu game" && node -e "new Function(require('fs').readFileSync('game.js','utf8'))"` → prints nothing if OK, else the error.

6. **`resetGame()`** must reset every per-run global or state leaks between runs (this bit me repeatedly — Mom chase, parking, Avigail, etc. all needed resets added).

---

## 7. How to test now (with GitHub access)
1. Make edits to `game.js` (and assets).
2. Syntax-check with node (above).
3. Commit + push (confirm workflow with user first).
4. Wait ~1 min, open https://lulu.boats in a **foreground** browser tab (or the preview, but foreground it / resize so it's visible).
5. Hard-refresh to bust cache. Verify the specific feature.
6. If you must test locally, the preview server works for static serving but watch the hidden-tab freeze (§6.1).

---

## 8. Deferred / nice-to-have (designed but not built)
- Offscreen-canvas caching for the bedroom + parking backdrop (perf; game runs fine without it).
- More idea-agent features never built: Coffee-run minigame, Raccoon yard sale, Phone-call-from-Mom forcing distracted mode, Weather wheel, Billboard photo-mode, Shabbos countdown.
- The angry-man crash sequence and some scenes still call `drawPlaying()` behind their overlay even from non-driving states (cosmetic only).

---

## 9. Version history (what shipped each session)
- **v1–v3:** core Lulu driving, shop, skins, parking challenge, sounds, mobile controls.
- **v4:** Character select + Dina mode (bus, run home, bedroom, Morgan, nap, tablet-game-within-game).
- **v5:** 10-agent QA pass — bug fixes, chunky outlines, mobile button sizing, animations, SFX.
- **v6:** run-cycle bounce, scene fades, Sasquatch hitchhiker, Mrs. Greenblatt, Ima texts, synth music.
- **v7:** fixed Mom-catches-too-fast, Morgan back button, bedroom redesign (no overlaps), Lulu face ("looked like a monkey"), Dina coat slimmed.
- **v8 (latest):** real MP3 music + pause music toggle, Esti ex-bff texts, Avigail door scene (2× points), Salon mode (permanent hair color).

---

## 10. Quick orientation grep cheatsheet
- Main loop / state dispatch: search `// ── Main Loop`
- Save system: search `function defaultSave`
- Music: search `MUSIC_FILES` / `function startMusic`
- Lulu's car + face: search `function drawLuluCar`
- Avigail: search `AVIGAIL_SCRIPT` / `function startAvigailScene`
- Salon: search `SALON_COLORS` / `function startSalon`
- Spawning on the road: inside `function updatePlaying`
- `resetGame`: search `function resetGame`

Good luck. The user is lovely and excited — keep it funny, keep it cute, and **test on the live site now that you can.** 🚗💨
