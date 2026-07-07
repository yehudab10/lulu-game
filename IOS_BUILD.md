# Shipping Lulu's Road Trip to the App Store (Capacitor wrapper)

This wraps the **existing web game** (`index.html` + `game.js`) in a native iOS
shell using [Capacitor](https://capacitorjs.com/), with **AdMob** ads. It is a
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
| `scripts/copy-web.js`     | Stages the runtime web assets into `www/` for bundling |
| `src/10c-ads.js`          | The ad manager (no-op on web; AdMob in the native app) |
| `codemagic.yaml`          | iOS build + TestFlight pipeline (workflow `ios-capacitor`) |
| `www/`, `ios/`            | **Generated** (gitignored) — rebuilt on every build |

---

## Ads (AdMob)

The game ships with **Google's official TEST ad unit IDs** in `src/10c-ads.js`
(`ADMOB.*`). These are safe to tap during development.

- **Interstitial** — shown on the *game-over* screen, every **2nd** loss
  (`ADMOB.interstitialEveryN`).
- **Rewarded** — an opt-in "📺 WATCH → +50 ★" button on the game-over screen
  (only appears when an ad is loaded).

### Before release — IMPORTANT
1. Create an [AdMob](https://admob.google.com/) account + app, and make an
   **Interstitial** and a **Rewarded** ad unit. Copy their IDs.
2. In `src/10c-ads.js`, set `ADMOB.interstitialId` / `ADMOB.rewardedId` to your
   real IDs and set **`isTesting: false`**.
3. Put your AdMob **App ID** in the native app's `Info.plist` as
   `GADApplicationIdentifier` (Capacitor/AdMob requires this — done on the Mac).
4. Run `node build.js` and commit.

> ⚠️ Tapping your **own live ads** gets the AdMob account banned. Keep
> `isTesting: true` until you're truly shipping.

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
MUST actually appear. As of v1.12.2, `Ads.init()` (src/10c-ads.js) requests
tracking authorization ~1.2s after launch — BEFORE `AdMob.initialize()` — and
only when the user hasn't answered yet. Denial is fine (non-personalized ads).
codemagic.yaml injects `NSUserTrackingUsageDescription` into Info.plist.

**Replying to the rejection:** record a screen capture on a physical iPhone of
(1) fresh install (or Settings → Privacy & Security → Tracking → reset), (2)
launching the game, (3) the ATT sheet appearing over the menu ~1–2s in, (4)
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
codemagic.yaml locks the app to portrait on iPhone AND iPad (both portrait
variants) with `UIRequiresFullScreen` — reviewers can't reach the web build's
"rotate your phone" nag. The canvas clamps logical H to ≥700 on iPad; menus
switch to a compact layout below H=860 (see menuBaseY()/menuCompact()).
