# Shipping Lulu's Road Trip to the App Store (Capacitor wrapper)

This wraps the web game in a native iOS shell using
[Capacitor](https://capacitorjs.com/), with **AdMob** ads. **The app ships
Lulu's Road Trip 2.0 — the 3D game in `3d/`** — exactly like lulu.boats (the
classic 2D game rides along behind ⚙️ More → "Classic 2D"). It is the App
Store app with bundle id **`boats.lulu.game`** (never change it — AGENTS.md golden rule 4), built by the
**Codemagic** workflow `ios-capacitor` in `codemagic.yaml`.

**Since 2.0 the app updates itself from the server**: the web game inside it follows the website's
**stable** channel (every commit whose Smoke test is green), downloaded in the background and switched in at
the next launch — see "Updates from the server" below. A new App Store build is only needed when something
**native** changes.

**Jump to:** "Press Start in Codemagic — the checklist" · "What can ship over the air" · "App Review
compliance" · the store listing + review notes: `STORE_LISTING.md` · the owner's to-do page:
`store/OWNER_TODO.md`.

---

## What's in the repo

| File | Purpose |
|------|---------|
| `package.json`            | Capacitor + plugins; `version` = the APP version Codemagic stamps in; `ota.minNative` = the lowest app version the web game on this commit can run in |
| `capacitor.config.json`   | App id, name, AdMob config and the updater's config (fully self-hosted: every Capgo URL blank). `webDir` is `www/`. |
| `3d/js/features/native/ota.js` | The in-app updater logic: read the stable manifest, decide, download in the background, switch at the next launch, roll back + remember bad copies |
| `scripts/ota-channel.js` + `.github/workflows/app-updates.yml` | Publish the **stable** channel (`stable.json` on the bot-only `ota` branch) after main's Smoke test is green; the PAUSE / REVERT / PIN / RESUME brakes |
| `scripts/ios-configure.sh` + `ios-config/` | Run by Codemagic after `cap sync`: app version, export compliance, SKAdNetwork ids, the app's privacy manifest, plugin + icon checks |
| `scripts/copy-web.js`     | Stages the runtime web assets into `www/` for bundling **and fails if a file the 3D game references is missing** |
| `3d/js/features/native/`  | 2.0's native glue: AdMob + ATT (`ads.js`), Taptic haptics (`haptics.js`) — a no-op on the web |
| `src/10c-ads.js`          | The classic 2D game's ad manager (same IDs; still active if a player opens Classic 2D in the app) |
| `scripts/tests3d/native.js` | Boots the game from the staged `www/3d/` with a fake Capacitor: zero 404s, ATT before AdMob init, ad placements, haptics — and the updates: offline first launch, download + next-launch switch, save untouched, corrupted download rejected, a too-new copy ignored, a copy that never starts rolled back |
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

The `ios-capacitor` workflow in `codemagic.yaml` builds on Codemagic's Mac and uploads to **TestFlight**
(`submit_to_testflight: true`). It never submits for review on its own (`submit_to_app_store: false` —
leave it; you press Submit in App Store Connect). It starts by itself on a push to `main` **only when
something native changed** (`package.json`, the lock file, `capacitor.config.json`, `codemagic.yaml`,
`ios-config/`, `scripts/ios-configure.sh`, `assets/`) — web changes reach the app over the air.
**Start new build** in Codemagic works any time.

The steps, in order (each fails with a plain "✗ …" line saying what went wrong):

| # | step | what it does |
|---|------|--------------|
| 1 | Install npm dependencies | `npm ci` — exactly the versions in `package-lock.json` |
| 2 | Build web bundle + stage www/ | `node build.js` + `node scripts/copy-web.js` (fails if the game references a missing file; writes `www/ota-build.json`, the bundled copy's own file list) |
| 3 | Generate the iOS native project | `npx cap add ios` (the `ios/` folder is NOT in git — it's created fresh every build) + `npx cap sync ios` |
| 4 | Generate app icon + splash | `@capacitor/assets` from `assets/icon.png` (1024×1024, no transparency — checked) + `assets/splash.png` |
| 5 | Inject AdMob App ID | `GADApplicationIdentifier` (unchanged), the ATT prompt text, status bar hidden, orientations, full screen |
| 6 | Audio session | `.ambient` (obeys the mute switch, no background audio) |
| 7 | Finish the iOS project | `scripts/ios-configure.sh`: app version from `package.json`, `ITSAppUsesNonExemptEncryption = NO`, 50 SKAdNetwork ids, the privacy manifest added to the App target, then checks every plugin and the icon are in |
| 8 | Set the build number | `agvtool new-version -all $BUILD_NUMBER` (Codemagic's counter — always above every 1.x build) |
| 9 | Set up code signing | fetch / create the distribution certificate + App Store profile for `boats.lulu.game` (the "Jogley" key + `CERTIFICATE_PRIVATE_KEY`) |
| 10 | Build the .ipa | `xcode-project build-ipa` → uploaded to TestFlight |

**What was verified without a Mac (2026-11-22, Linux container):** `npm install` with Capacitor 8.3.4 + all five
plugins (every one declares Capacitor 8 as its peer, all ship a `Package.swift`); `node build.js`;
`node scripts/copy-web.js`; **`npx cap add ios` and `npx cap sync ios` both succeed** and list the five plugins
(AdMob 8.0.0, App 8.1.0, Haptics 8.0.2, Network 8.0.1, the updater 8.54.2) in `ios/App/CapApp-SPM/Package.swift`;
the updater's own sync hook writes `ota-builtin-hashes.json` into the app's web folder; `codemagic.yaml` parses;
`scripts/ios-configure.sh` passes `bash -n`; the privacy manifest is a valid plist.
**Not verifiable here — only a real build can say:** that Xcode resolves the Swift packages (Google Mobile Ads
12.14.x from GitHub) and compiles; the PlistBuddy / `xcodeproj` / `sips` steps of `ios-configure.sh` (macOS
tools); signing; the upload. If anything fails, paste the log back to an agent.

### App version + build number (a 2.0 update of the existing app)
- **Version** (`CFBundleShortVersionString`, what the App Store shows): `package.json` → `"version": "2.0.0"`,
  stamped in by `ios-configure.sh`. In App Store Connect, create version **2.0.0** (the same text) for the
  existing app before submitting. The updater compares this number with each update's `minNative`, so
  bump it only for a store release (2.0.1, 2.1.0 …).
- **Build number** (`CFBundleVersion`): Codemagic's `$BUILD_NUMBER`, which keeps counting up across all builds
  of this workflow, so it's always higher than the 1.x builds already uploaded.

### App icons, launch screen
`assets/icon.png` is a flat **1024×1024 RGB PNG (no alpha)** — App Store icons must not be transparent
(`ios-configure.sh` fails the build if it ever is). Capacitor 8's template uses Xcode's **single-size** app
icon (one 1024 image; Xcode makes every smaller size itself), so "all sizes" are covered. The launch screen is
the template's `LaunchScreen.storyboard` with `assets/splash.png` (2732×2732) on `#1a1a2e`.

### Privacy manifest (`PrivacyInfo.xcprivacy`)
Apple requires one per app (and per SDK). What ships:
- **Capacitor** ships its own (nothing collected, no required-reason APIs).
- **Google Mobile Ads** (12.14.x, pulled in by the AdMob plugin) ships its own — its tracking domains and the
  advertising data it collects.
- **The app's own** — `ios-config/PrivacyInfo.xcprivacy`, added to the App target by `ios-configure.sh`:
  tracking **yes** (AdMob, only after the ATT "Allow"); data the game itself sends = a random **User ID** and
  **Gameplay Content** (the online world, friends, leaderboards), not linked to the person, not for tracking,
  App Functionality only; and the required-reason APIs of the updater plugin, which ships no manifest of its
  own: UserDefaults `CA92.1`, file timestamps `C617.1`, disk space `E174.1`.
- AdMob, Haptics, App and Network plugins use no required-reason API themselves (checked in their sources).

### Export compliance (`ITSAppUsesNonExemptEncryption = NO`)
The game uses encryption only through what iOS itself provides: HTTPS / secure WebSockets (lulu.boats, the
multiplayer relay, the update files) and WebKit's standard Web Crypto; the updater plugin hashes files
(SHA-256, Apple's CryptoKit — hashing is not encryption) and its optional encrypted-bundle feature is unused.
Apple's export-compliance rules treat encryption that is limited to what's built into the operating system as
exempt, so the answer to "Does your app use encryption?" in App Store Connect is the exempt case, and the
plist key says **NO** so you aren't asked on every build. (Not legal advice — this is the standard answer for a
game that only uses HTTPS. If App Store Connect still asks: "uses encryption → only exempt / standard
encryption within Apple's operating system".)

---

## Updates from the server (over the air)

**The idea:** the app still carries a full copy of the game (it works offline and on first launch), but a
newer copy of the WEB game — anything in `3d/`, the root page, the classic game, music, models — is downloaded
from the server and used from the next launch, so the app follows the website without an App Store release.

### How it works
1. **The stable channel.** `.github/workflows/app-updates.yml` runs after every **green** "Smoke test" of a push
   to `main`. `scripts/ota-channel.js` checks that commit out, stages `www/` with that commit's own
   `copy-web.js`, verifies every file is byte-identical to the repo at that commit, and publishes
   **`stable.json`** (the commit, `minNative`, the brakes, and every file's SHA-256 + size) on the bot-only
   branch **`ota`** — one commit, force-pushed. Never on `main`: no collisions with agents' pushes, no
   Codemagic build, no Pages deploy. It only moves **forward** (an older green run finishing late is ignored).
   The website keeps deploying from `main` exactly as before.
2. **Where it's served from.** The app reads `https://raw.githubusercontent.com/yehudab10/lulu-game/ota/stable.json`
   (GitHub's file server over HTTPS; the repo is public — checked) and downloads each file **pinned to the
   published commit** (`raw.githubusercontent.com/<repo>/<commit>/<path>` — `www/` paths are repo paths), so it
   gets exactly the green commit even after `main` has moved on. Why not lulu.boats: GitHub Pages serves only
   what's on `main`, so a pointer that moves without bots committing to `main` can't live there. Integrity
   doesn't depend on the host: every file is SHA-256 checked against the manifest, files may only come from
   `raw.githubusercontent.com/yehudab10/lulu-game/` or `lulu.boats` (allow-list in `ota.js`), HTTPS only.
3. **In the app** (`3d/js/features/native/ota.js` + the open-source plugin **`@capgo/capacitor-updater` 8.54.2**,
   MPL-2.0, pinned exactly):
   - 20 s after the game reaches its first screen (then at most every 30 min while open), it reads the
     manifest. New + compatible + not known-bad → the plugin downloads it **in the background**: only files
     whose fingerprint the phone doesn't have (the bundled copy's files and earlier downloads are reused —
     usually a few MB), each one SHA-256-checked natively; finished files are kept, so an interrupted download
     **resumes**. Up to **30 MB on any connection**; bigger waits for **Wi-Fi**; over **150 MB** never comes over
     the air (that's an App Store release).
   - It is switched in at the **next launch**, during the loading screen — **never under a running game**. (The
     plugin's own `next()` would apply it on a background/foreground cycle, which could reload a paused game,
     so `ota.js` uses `set()` at launch instead.)
   - The new copy calls **`notifyAppReady()`** when it reaches its first screen. If it doesn't within **40 s**
     (`appReadyTimeout`), the plugin's **native** timer throws it away and goes back to the last good copy;
     `ota.js` remembers that version as bad and never tries it again. The **bundled copy** is always the last
     resort and is never deleted.
   - **No Capgo account, no Capgo server**: `capacitor.config.json` sets `autoUpdate: false` and blanks
     `updateUrl`, `statsUrl` and `channelUrl` (the plugin's code skips every network call when they're empty —
     checked in its source), no shake menu, no preview mode, HTTPS only.
4. **The start page.** The app opens `/3d/index.html` first (`server.appStartPath`); a reload or an update switch
   opens the copy's root `index.html`, which forwards to `/3d/index.html` on `capacitor:`. `copy-web.js` fails the
   build if that page isn't in `www/`, writes it into `ota-build.json` as `startPath`, the channel refuses to
   publish a copy without it, and `ota.js` ignores a manifest that lacks it.
5. **The save survives.** Every copy is served from the same origin, `capacitor://localhost` — only the folder
   behind it changes (Capacitor's `setServerBasePath`) — so `localStorage` (`luluSaveV2`, `lulu3dSave`, …) is
   the same storage before and after. **Never set `server.url`** in `capacitor.config.json` (that would change
   the origin and lose every save) and never change the scheme / hostname. (`server.appStartPath` only picks the
   first page inside the same origin — it's safe.)
6. **A new App Store build resets to its own bundled copy** (`resetWhenUpdate`, keyed on the build number), then
   follows stable again.

### The brakes (no app release needed)
GitHub → **Actions** → **App updates (stable channel)** → **Run workflow** → pick:

| action | what phones do |
|---|---|
| `promote-latest` | take the newest green commit on main now (also lifts a hold) |
| `pin` (+ a commit) | go to that exact commit and stay there — automatic promotions stop |
| `pause` | keep what they have; download nothing new (a downloaded-but-not-yet-used copy is dropped) |
| `revert` | go back to the copy bundled in the app, at their next launch |
| `resume` | undo pause / revert / pin |

### What can ship over the air, and what needs the App Store
**Over the air (just land it on `main`, green):** anything under `3d/` (code, CSS, models, the vendored
three.js), `index.html`, `classic.html` + `game.js` + `style.css`, the music, icons inside the web game — every
file `scripts/copy-web.js` stages into `www/`.

**Needs an App Store release:** adding / removing / updating a Capacitor plugin (`package.json`
dependencies), `capacitor.config.json`, anything in `Info.plist` (permission texts, orientations, keys),
`ios-config/` (privacy manifest, SKAdNetwork), the AdMob SDK or ad unit / app ids, the app icon or launch
screen, `codemagic.yaml`, and **any web code that calls a native API the installed app doesn't have yet**.

**The rule for agents:** when web code starts needing new native code, in the SAME commit raise
`package.json` → `"version"` (e.g. 2.0.0 → 2.1.0) **and** `"ota"."minNative"` to that version. Apps older than
`minNative` then keep their last compatible copy and show one quiet "📱 A new version of the app is in the App
Store" note; they catch up after the store update. Also feature-detect in code
(`Capacitor.isPluginAvailable(...)` / `plugin(name)` returning null) so an older app never crashes on a missing
plugin. Never raise `minNative` for a web-only change — that freezes every installed app.

### Apple's rules on downloaded code (checked 2026-11-22)
- **Apple Developer Program License Agreement § 3.3.1(B) "Executable Code"** (read from
  developer.apple.com/support/terms on 2026-11-22): *"…an Application may not download or install executable
  code. Interpreted code may be downloaded to an Application but only so long as such code: (a) does not change
  the primary purpose of the Application by providing features or functionality that are inconsistent with the
  intended and advertised purpose of the Application (b) does not bypass signing, sandbox, or other security
  features of the OS; and (c) for Applications distributed on the App Store, does not create a store or
  storefront for other Applications."* — Our updates are JavaScript / HTML / CSS / models run by WebKit
  (interpreted code), they are the same game the listing describes (a), they run inside WebKit's sandbox and the
  app's container and add no native capability (b), and there is no store of other apps (c).
- **App Review Guideline 2.5.2**: *"Apps should be self-contained in their bundles, and may not read or write data
  outside the designated container area, nor may they download, install, or execute code which introduces or
  changes features or functionality of the app…"* — read together with the licence clause above, this is the
  basis on which every Capacitor / Cordova / React Native live-update system (Ionic Appflow, Expo Updates,
  CodePush, Capgo) ships web-code updates; it is why the rule above forbids using updates to add native
  capabilities, and why each new feature still goes into the next App Store release's review notes
  (**Guideline 2.3.1(a)**: *"All new features, functionality, and product changes must be described with
  specificity in the Notes for Review section of App Store Connect…"*).
- **Guideline 2.5.19**: *"Don't include any hidden, dormant, or undocumented features in your app…"* — so: no
  remote switch that turns the game into something else, nothing gated for (or hidden from) reviewers; the
  manifest has only `paused` / `revert` / `minNative` brakes, and the review notes describe the update
  mechanism openly (`STORE_LISTING.md`).
- **Guideline 4.7** (HTML5 mini apps / mini games offered *inside* an app) is about software from others
  offered in your app — not our case (it's our own game), noted only because reviewers sometimes cite it.
- **Could not verify:** how strictly a given reviewer reads 2.5.2 — Apple publishes no explicit "live updates are
  OK" statement; the licence clause is the written basis. Honest description in the review notes is the best
  protection.

### Tests
`scripts/tests3d/native.js` part 3 runs the updater against a fake plugin that behaves like the real one
(reuses bundled files, SHA-256-checks downloads, `set()` = reload into the copy, rolls back a copy that never
says ready): offline first launch boots; a copy downloads only the changed file and is NOT used until the next
launch; the next launch boots it; the save is untouched; a corrupted download is rejected; a copy needing a
newer app is ignored with one note; a copy that never reaches the title is rolled back and never retried. The
real plugin's native parts (hash checks, the timer) are its own code, read in its source but only testable on a
device — check them once on TestFlight (see the checklist).

---

## If the app doesn't start (no silent screens)
A start that breaks before the game's own code runs can't be fixed over the air, so the pages the app opens guard
themselves — plain ES5, no imports, inside the app only:
- **Root `index.html`** (the launcher): counts its own loads in `sessionStorage`; on the 4th within 10 s it stops
  redirecting and says *"The game keeps restarting before it opens"* with the app + game-copy version, **Try again** and
  (for a downloaded copy) **Use the built-in copy**. The native test also checks that, in the app, the launcher's
  target is a FILE that isn't itself (Capacitor iOS answers any folder address with the root page — the Nov 2026
  TestFlight loop).
- **`3d/index.html`** (the game page): if the game hasn't reached its first screen **25 s** after launch, a panel says
  *"The game didn't start"* with the last errors it caught (scripts / files that failed to load), the app + game-copy
  version and **Use the built-in copy** (marks that copy bad + resets the updater) · **Try again** · **Keep waiting**.
  It disappears by itself if the game comes up.
- **⚙️ More → 📱 App 2.0.0 (build N)** shows the installed build, the game copy, and *"Needs a newer app"* when the
  stable channel needs a newer native build; tapping it checks for an update now.
- **When does Codemagic build by itself?** On a push to `main` that changes a native file (`when: changeset` in
  `codemagic.yaml`) — but only if Codemagic's webhook for this repo is connected, which can only be seen in the
  Codemagic UI (app → Settings → Webhooks / the Builds list). Agents can't see Codemagic: after a native change,
  check the Builds list, and press **Start new build** if nothing started.

## Press Start in Codemagic — the checklist

1. **codemagic.io → Lulu's Road Trip → `ios-capacitor` → Start new build** (branch `main`).
2. **What you should see** (≈ 15–25 min): each step turns green; in **Finish the iOS project** the lines
   `✓ app version 2.0.0`, `✓ Info.plist: encryption = exempt (NO), 50 SKAdNetwork ids…`, `✓ privacy manifest
   in the App target`, `✓ plugins: AdMob, App, Haptics, Network, the updater`, `✓ app icon…`; then
   **Build the .ipa** and **Publishing → App Store Connect → uploaded**. 10–30 min later the build appears in
   App Store Connect → TestFlight (status "Processing", then "Ready to Test" / "Missing Compliance" should NOT
   appear because of the encryption key).
3. **On TestFlight, on your iPhone:** install. **First check: the title screen appears and stays, with no
   flashing / reloading loop** (the app opens `/3d/index.html` directly — `capacitor.config.json` ›
   `server.appStartPath` — because Capacitor iOS answers a folder address like `/3d/` with the root page, which
   used to bounce back and forth). Then: the tracking prompt appears over the loading/title screen; play;
   your coins/cars from the old app are there. Leave it open 1 minute, close it fully, open again — still fine
   (it may have switched to the latest stable copy).

**The three most likely first-build errors:**
1. **"xcodebuild … Package resolution failed" / "could not resolve package dependencies"** in *Build the .ipa* —
   Xcode couldn't download a Swift package (Google Mobile Ads from GitHub, or the updater). Usually a network
   hiccup on Codemagic's side: press **Start** again. If it repeats with a version message, an agent pins the
   plugin version.
2. **"No matching profiles found" / "Signing for 'App' requires a development team"** in *Set up code signing* —
   the certificate/profile step. Check in Codemagic that the `ios_signing` group still has
   `CERTIFICATE_PRIVATE_KEY` and the "Jogley" App Store Connect key is still valid (keys can be revoked in App
   Store Connect → Users and Access → Integrations).
3. **"✗ ios-configure: …"** in *Finish the iOS project* — one of the new checks; the line after ✗ says exactly
   what's missing (e.g. a plugin not picked up, the icon). Or, at upload: **"The bundle version must be higher
   than the previously uploaded version"** — the build number collided; press Start again (the counter moves on).

Anything else: copy the red step's log and paste it to an agent.

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
- **App Privacy** (needs Account Holder/Admin): the full item-by-item answers
  are in `STORE_LISTING.md` › App Privacy (tracking = YES while AdMob ships).
- **Age rating**: item-by-item answers for 2.0 in `STORE_LISTING.md` › Age rating.
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

### Moving the app to 2.0
Everything to paste into App Store Connect is in `STORE_LISTING.md`; the owner's step-by-step is
`store/OWNER_TODO.md`; screenshots are in `store/screenshots/`.

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
