# What only you can do — Lulu's Road Trip 2.0 on the App Store

Everything an agent could do is done (the build setup, the update channel, the listing text, the privacy policy,
the screenshots). These are the steps that need YOU (your logins, your phone, your decisions), in order.
All the text to paste is in `STORE_LISTING.md`; the build details are in `IOS_BUILD.md`.

---

## First: two decisions (they change some answers you paste)

### Decision 1 — children and ads
The game is rated **13+** (Apple no longer has 12+), but younger children play it too, and the app shows Google
ads after asking permission to track. *This is not legal advice — if you're unsure, ask a lawyer who knows
children's privacy law (COPPA in the US, GDPR in Europe).* What AdMob lets you choose:

| choice | what it does | cost |
|---|---|---|
| **A. Maximum ad content rating** (G = all ages · PG = parental guidance · T = teen · MA = mature) | Google only shows ads up to that level. Set in the AdMob website: Apps → Lulu's Road Trip → Blocking controls → Content → Maximum ad content rating. No app update needed. | slightly fewer ads to choose from |
| **B. Non-personalised ads only** | ads are never based on the person's history or the advertising ID; the tracking prompt can be removed and the privacy answers become "not used for tracking" | noticeably lower ad income |
| **C. "Child-directed" tag** (US COPPA) | tells Google every player is a child: no personalised ads, only family-safe ads, and the app takes on the legal duties of an app *made for* children | the lowest ad income; only right if the game is aimed at kids |
| **D. "Under the age of consent" tag** (Europe) | like C, for European players under 16 | lower income in Europe |

**My recommendation:** do **A = PG** today (5 minutes in AdMob, no update). Keep the tracking prompt as it is (only
people who tap "Allow" get personalised ads). Don't use C/D for everyone unless you believe most players are under 13
— if you do, tell an agent: C + G is a small change that can reach the app over the air, and then the App
Privacy answers change too (an agent will tell you which).

### Decision 2 — how fast the app follows the website
| choice | what it means |
|---|---|
| **A. Every green commit** (set up now) | an app player gets the same game as the website within minutes of a change passing the automatic test — at their next launch |
| B. Once a day | an agent changes the workflow to publish once a day (say 4 am) — bad changes caught during the day never reach the app |
| C. Only when you press "promote" | nothing reaches the app until you press a button in GitHub |

**My recommendation: A** — it's what you asked for ("I can't have something working on the website and not the iOS
app"), a copy that doesn't start is rolled back automatically, and if a bad change gets through you press the brake
(GitHub → Actions → **App updates (stable channel)** → Run workflow → `pause` or `revert`; `resume` to undo).

---

## The steps

1. **Nothing to do for the update channel.** It switches itself on when this work lands on `main`. (To check later:
   GitHub → Actions → "App updates (stable channel)" shows a green tick after each green "Smoke test".)

2. **Build in Codemagic.** codemagic.io → Lulu's Road Trip → workflow `ios-capacitor` → **Start new build** (branch
   `main`). What you should see and the three likely first-time errors: `IOS_BUILD.md` › *Press Start in Codemagic*.
   If it fails, copy the red step's log and paste it to an agent. (From now on Codemagic builds by itself only
   when something *native* changes; game changes go over the air.)

3. **TestFlight on your iPhone.** App Store Connect → TestFlight → the new build → install with the TestFlight app.
   Check: the tracking prompt appears in the first seconds; your old coins and cars are there; you can drive, walk
   into a building, add a friend. Then close the app fully, open it again, play — still fine.

4. **Record the tracking-prompt video** (Apple asked for it after the July rejection): delete the app or reset
   Settings → Privacy & Security → Tracking, start the screen recording, open the app, let the prompt appear,
   tap either answer, play for a few seconds, stop the recording.

5. **App Store Connect → the app → App Information**: subtitle, categories, content rights, privacy policy URL —
   `STORE_LISTING.md` §1. **Age Rating** → Edit → answer item by item from §5 (it should come out **13+**).

6. **App Privacy** (needs the Account Holder / Admin): answer item by item from `STORE_LISTING.md` §4, then
   **Publish**.

7. **Create version 2.0.0** ("+" next to iOS App → `2.0.0`): paste the promotional text, description, keywords,
   What's New, support + marketing URLs, copyright (§3). Upload the screenshots: `store/screenshots/iphone-6.9/`
   (and `iphone-6.5/` if asked) and `store/screenshots/ipad-13/`.

8. **App Review Information** (same page): untick "Sign-in required", your contact details, paste the **Notes**
   from §6, attach the tracking-prompt video from step 4.

9. **Build**: in the version page's "Build" section choose the build from step 2. If it asks about encryption:
   §7 (the app already says "exempt").

10. **Add for Review → Submit.** Typical review: 1–3 days. If Apple replies, paste their message to an agent.

11. **After approval:** release it (or let it release automatically). From then on, game changes reach players
    at their next launch — no more App Store releases unless an agent says "this one needs native code".

---

## Good to know
- **Cost:** the update channel costs nothing (GitHub's free Actions + file hosting for a public repo; no other
  accounts). Codemagic builds now only run for native changes, which saves build minutes.
- **The brakes** (GitHub → Actions → "App updates (stable channel)" → Run workflow): `pause` · `revert` (back to the
  copy inside the app) · `pin` (stay on one version) · `resume` · `promote-latest`.
- **When a store update IS needed:** an agent will say so (a new plugin, ad changes, the icon, permissions). Then:
  steps 2, 3, 7 (a new version number), 9, 10.
