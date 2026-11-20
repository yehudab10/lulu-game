# Shipping Lulu's Road Trip to the App Store (Capacitor wrapper)

This wraps the web game in a native iOS shell using
[Capacitor](https://capacitorjs.com/), with **AdMob** ads. **The app ships
Lulu's Road Trip 2.0 — the 3D game in `3d/`** — exactly like lulu.boats (the
classic 2D game rides along behind ⚙️ More → "Classic 2D"). It is a
**completely separate app** from anything else you have:

- Its own **bundle id** (`boats.lulu.game` — change it if you like, but it must
  be **unique** and different from your other app).
- Its own **App Store Connect** record.
- Its own **Codemagic workflow** (`codemagic.yaml` → `ios-capacitor`).

Nothing here touches your existing Codemagic app. The web game at **lulu.boats**
is also unaffected — these files are purely additive, and the game behaves
identically on the web (ads are a no-op unless running inside the native app).

---

## What's in the repo

| File | Purpose |
|------|---------|
| `package.json`            | Capacitor + AdMob dependencies and helper scripts |
| `capacitor.config.json`   | App id, name, and AdMob config. `webDir` is `www/`. |
| `scripts/copy-web.js`     | Stages the runtime web assets into `www/` for bundling **and fails if a file the 3D game references is missing** |
| `3d/js/features/native/`  | 2.0's native glue: AdMob + ATT (`ads.js`), Taptic haptics (`haptics.js`) — a no-op on the web |
| `src/10c-ads.js`          | The classic 2D game's ad manager (same IDs; still active if a player opens Classic 2D in the app) |
| `scripts/tests3d/native.js` | Boots the game from the staged `www/3d/` with a fake Capacitor: zero 404s, ATT before AdMob init, ad placements, haptics |
| `codemagic.yaml`          | iOS build + TestFlight pipeline (workflow `ios-capacitor`) |
| `www/`, `ios/`            | **Generated** (gitignored) — rebuilt on every build |

---

## What the app bundles (`www/`, built by `scripts/copy-web.js`)

```
www/index.html          the repo's index.html: forwards to 3d/ (keeps ?query + #hash)
www/3d/                 2.0: index.html, style3d.css, js/, vendor/ (three.js), assets/*.glb
www/*.mp3               the music (the 3D game loads it as ../<name>.mp3)
www/classic.html        the classic 2D game + game.js, style.css, icons, manifest
```

Left out: `3d/blender/`, `3d/docs/`, every `*.md`, `.blend` and `.py` file,
`src/`, `server/`, `scripts/`. About **62 MB** (≈33 MB of models, ≈24 MB of
music). After copying, the script checks every module import, the import map,
`../*.mp3` and other asset paths, `<script>`/`<link>` tags and CSS `url()`s
against `www/` and **exits 1** (failing the Codemagic build, and the GitHub
smoke workflow) if anything is missing. `scripts/tests3d/native.js` goes
further: it boots the game *from* `www/3d/` in headless Chromium with a fake
Capacitor and asserts zero 404s, every registered model present, the save
shared, and the ads / ATT / haptics flow.

**Saves carry over.** The app's origin is `capacitor://localhost` for both
`www/index.html` (where the classic app used to run) and `www/3d/`, so 2.0
reads the same `localStorage.luluSaveV2` — coins, cars, items, hair, the
scrapbook — that players built up in the classic app. Keep `3d/` exactly one
level under `index.html` and never change the app's scheme / hostname
(`capacitor.config.json` → `server`), or players lose their saves.

**Links inside the app.** ⚙️ More → Classic 2D opens `../classic.html`, the 2D
menu's 🕹️ 3D button opens `3d/`, and 2.0's no-WebGL fallback card links to
`../classic.html` — all inside the bundle. A 🎉 party invite shares
`https://lulu.boats/3d/?party=CODE` (friends open it on the web; app players
type the code). 📸 Photo mode can't download inside WKWebView, so in the app a
snap goes to the album and the album's button opens the iOS share sheet.

**Fonts.** Fredoka comes from Google Fonts without blocking the first paint;
offline (or until it arrives) the game falls back to SF Rounded (`ui-rounded`).

**Audio.** iOS only unlocks WebAudio on `touchend` / `click`, and suspends it
("interrupted") after a call, an ad or backgrounding — 2.0 resumes it on the
next touch. codemagic.yaml keeps the `.ambient` audio session.

**Multiplayer.** The relay (`wss://lulu-shared-road…workers.dev`, `server/`)
has no Origin allow-list and its board API sends `Access-Control-Allow-Origin: *`,
so the app's `capacitor://localhost` origin is accepted (checked against the
live relay: `101 Switching Protocols` with `Origin: capacitor://localhost`).

---

## Ads (AdMob)

The REAL ad unit IDs + `isTesting: false` live in **two** places that must
stay identical: `3d/js/features/native/ads.js` (`ADMOB` — what 2.0 shows) and
`src/10c-ads.js` (the classic game, still active if a player opens Classic 2D
in the app). The AdMob **App ID** is injected into Info.plist by codemagic.yaml.

- **Interstitial** (owner, 2026-11-20) — every **2nd knock-out** (out of hearts; there is no game-over
  card in normal play any more), shown only once Lulu is back on her feet and walking; **one per jail
  stay**, at a quiet moment in the cell; and every 2nd game-over card that still exists (parking's
  challenge). One break counter (`ADMOB.interstitialEveryN`), never two within `minGapMs` (90 s).
- **Rewarded** — the opt-in "📺 WATCH → +50 💰": on a game-over card (one per card), and in the ❚❚ pause
  menu after a knock-out (one per knock-out, at most 3 a run).
- **The rule (AGENTS golden rule 4b): an ad never costs the player a moment.** It never STARTS during a
  cutscene, a dialogue, a card, the spin-out / climb-out, while driving or in a chase. While any ad is up
  the WHOLE game holds (`ctx.hold`: no game time, no scripts, no traffic, no world; music paused, sound
  suspended) and picks up exactly where it was when the plugin says **dismissed** (v8's
  `showInterstitial()` resolves as the ad APPEARS — only the `interstitialAdDismissed` /
  `onRewardedVideoAdDismissed` events mean closed). If the ad never appears within `showWaitMs` (8 s — no
  network, the app backgrounded) or never says closed within `maxAdMs` (60 s), the game comes back anyway.
  Test: `scripts/tests3d/adhold.js` (a fake plugin holds each ad open and checks nothing moved).
- **Never** in a 🎉 party (`ads` is in party's OFF set, and `ctx.party.active` is checked too), or in
  Dina's mode.

> ⚠️ Tapping your **own live ads** gets the AdMob account banned. To test on
> your own phone, add its AdMob test-device ID to `testingDevices` in both
> files (printed in the Xcode console on the first ad request).

> ⚠️ **App Store "Kids" category:** most ad SDKs are *banned* there. List this
> under **Games → Casual/Arcade**, NOT the Kids category, to run ads. Use
> non-personalized ads to stay clean for a young audience.

---

## Build it (on a Mac with Xcode)

```bash
npm install
npm run add:ios        # builds game.js, stages www/, generates the ios/ project
npm run open:ios       # opens Xcode — set your team/signing, then Run on a device
```

After any change to the game, re-sync the web layer into the native shell:

```bash
npm run sync:ios       # build + copy:web + cap sync ios
```

---

## Build it (Codemagic — no Mac needed)

The `ios-capacitor` workflow in `codemagic.yaml` does the whole thing on
Codemagic's Mac runners and publishes to TestFlight.

One-time setup in the Codemagic UI:
1. **Integrations → App Store Connect**: add your API key. Replace
   `APP_STORE_CONNECT` in `codemagic.yaml` with that integration's name.
2. **Code signing → iOS**: upload (or let Codemagic manage) a distribution
   certificate + an App Store provisioning profile for `boats.lulu.game`.
3. In **App Store Connect**, create the app with bundle id `boats.lulu.game`.
4. Push to the branch wired to this workflow and start a build.

The build produces a signed `.ipa` and uploads it to TestFlight. Flip
`submit_to_app_store: true` when you're ready for App Store review.

---

## App icons & splash

Capacitor uses native icon/splash assets (not the web SVG favicons). Generate
them on the Mac with:

```bash
npm i -D @capacitor/assets
# put a 1024x1024 icon.png (and optional splash.png) in ./assets, then:
npx capacitor-assets generate --ios
```

---

## App Review compliance (read before every submission)

### App Tracking Transparency (fixes the July 2026 Guideline 2.1 rejection)
The AdMob SDK links Apple's ATT framework, so the tracking-permission prompt
MUST actually appear. 2.0 does it exactly like the classic game did (v1.12.2):
`3d/js/features/native/ads.js` asks for tracking authorization ~1.2 s after
launch (over the loading / title screen) — BEFORE `AdMob.initialize()` — and
only when the user hasn't answered yet (the AdMob plugin's
`trackingAuthorizationStatus` / `requestTrackingAuthorization`, same as
src/10c-ads.js). Denial is fine (non-personalized ads). codemagic.yaml injects
`NSUserTrackingUsageDescription` into Info.plist. The order is covered by
`scripts/tests3d/native.js`.

**Replying to the rejection:** record a screen capture on a physical iPhone of
(1) fresh install (or Settings → Privacy & Security → Tracking → reset), (2)
launching the game, (3) the ATT sheet appearing over the loading / title screen ~1–2s in, (4)
tapping either choice and playing normally. Attach it in the App Store Connect
message thread AND keep a copy in the App Review Information notes.

### App Store Connect settings (owner tasks — not in code)
- **App Privacy** (needs Account Holder/Admin): declare tracking = YES.
  Data types: Identifiers → Device ID, and Advertising Data; purposes:
  Third-Party Advertising; "used for tracking" = Yes. (This matches AdMob
  with personalized ads. Do NOT declare "no tracking" while AdMob ships.)
- **Age rating**: answer the questionnaire towards a 12+ rating —
  Cartoon/Fantasy Violence: Infrequent/Mild; Alcohol/Tobacco/Drug References:
  Infrequent/Mild (the bar scene / "liquid courage"); Simulated Gambling: None
  (the Vegas dice boon has no wager); Profanity/Crude Humor: Infrequent/Mild.
- **Multiplayer**: no accounts, no free-text chat, curated names only, no UGC —
  nothing extra to declare.

### Orientation / iPad
2.0 lays out in portrait AND landscape, so codemagic.yaml allows portrait +
both landscapes on iPhone and all four orientations on iPad, and keeps
`UIRequiresFullScreen` (no Split View / Slide Over). The status bar is hidden;
the notch / Dynamic Island is handled with `viewport-fit=cover` +
`env(safe-area-inset-*)` in `3d/style3d.css` (the HUD, touch controls and
menus stay inside the safe area, left/right of the notch in landscape). The
classic 2D game (⚙️ More → Classic 2D) letterboxes its tall canvas in landscape.

### Moving the app to 2.0 — owner checklist (App Store Connect)
- **Screenshots**: the listing still shows the 2D game. Upload new iPhone
  (6.9" / 6.5") and iPad (13") screenshots of 2.0 — landscape shots are fine
  now that the app rotates.
- **Version**: bump the marketing version (e.g. 2.0) for the first 2.0 build —
  codemagic only sets the build number (`agvtool new-version`), so set
  `CFBundleShortVersionString` / MARKETING_VERSION yourself.
- **What's New / description**: mention the 3D game, controller support and
  that saves carry over.
- **App Privacy**: unchanged — same AdMob SDK, same ATT prompt, same data
  types (Device ID + Advertising Data, third-party advertising, used for
  tracking). Multiplayer is the same relay as before (curated names, no
  accounts, no free text).
- **Age rating**: the existing answers still fit (same content).
- **Review notes**: re-record the ATT screen capture on 2.0 (see above).

## Haptics
`@capacitor/haptics` ships in package.json — `npx cap sync ios` (already in
the codemagic workflow) bundles it automatically; no extra Info.plist keys.
2.0's feedback layer is `rumble()` in `3d/js/input.js` (crashes, bumps, nitro,
the countdown): a controller rumbles through the Gamepad API, and in the app
touch play goes to the Taptic engine (`3d/js/features/native/haptics.js`:
HEAVY / MEDIUM / LIGHT impacts by strength, throttled per level; weak-only
buzzes like the rumble strips stay silent). ⚙️ Settings → "📳 Rumble &
haptics" turns both off. (The classic game keeps its own bridge,
src/10h-haptics.js.)
