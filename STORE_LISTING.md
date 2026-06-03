# App Store Connect — copy-paste listing for Lulu's Road Trip

Everything below is ready to paste into App Store Connect. Replace the few
**[IN BRACKETS]** bits with your real details.

---

## 1. App Information  (My Apps → Lulu's Road Trip → App Information)

| Field | Value |
|---|---|
| **Name** | `Lulu's Road Trip` |
| **Subtitle** | `Drive, dodge & cozy minigames` |
| **Bundle ID** | `boats.lulu.game` (already set) |
| **SKU** | `lulu-roadtrip` (already set) |
| **Primary Category** | Games |
| **Secondary Category** | Entertainment (optional) |
| **Game subcategories** | Casual, Family |
| **Content Rights** | "I confirm it does not contain third-party content" (your own art/code) |
| **Age Rating** | 4+ — answer **None / No** to every content question (cartoon only, no real violence, no objectionable content) |

---

## 2. Pricing and Availability
- **Price:** Free
- **Availability:** All countries (or pick your own)

---

## 3. Privacy  (App Privacy section)

A privacy policy URL is **required** because the app shows ads.

- **Privacy Policy URL:** `https://lulu.boats/privacy.html`
  *(I generated `privacy.html` in this repo — once it deploys to GitHub Pages it lives at that URL.)*

**Data collection answers** (because of Google AdMob ads):
- Do you collect data? **Yes**
- Data types: **Identifiers → Device ID** and **Usage Data → Product Interaction**
- Used for: **Third-Party Advertising** and **Analytics**
- Linked to identity? **No**
- Used for tracking? If you keep AdMob personalized ads: **Yes** (and you must show the App Tracking Transparency prompt — the app already includes the `NSUserTrackingUsageDescription` text). If you switch AdMob to non-personalized ads only, you can answer **No**.

---

## 4. Version Information  (the 1.0 version page)

**Promotional Text** (≤170 chars, editable anytime without review):
```
Help Lulu drive without crashing, race Dina home from school, catch cookies, and decorate her room. Cute, cozy, and endlessly replayable!
```

**Description** (≤4000 chars):
```
Buckle up for Lulu's Road Trip — a cute, cozy driving adventure packed with bite-sized minigames the whole family will love.

Steer Lulu's little pink car down a busy road, dodge traffic, grab coins, and unlock fun new car skins. When you're ready for a change of pace, switch to Dina and race her home from school, then relax in her bedroom with a whole world of cozy activities.

WHAT'S INSIDE
• Endless driving — swerve through traffic, collect coins, and beat your high score
• Car skins — unlock 8 colorful rides, from Classic Pink to Black Ninja
• Park the car — a 10-level parking challenge that tests your precision
• Race home — guide Dina down the sidewalk, dodge obstacles, and stay ahead of Mom
• Cozy bedroom — play with Morgan the cat plushie, take a nap, and earn stars
• Cookie Catch — slide the plate to catch falling treats (and dodge the burnt ones!)
• Sticker Book — spend your stars to decorate a scrapbook that's all your own

EASY TO PLAY
• Simple one-finger controls — just drag to move
• No account, no login, fully single-player
• Gentle, kid-friendly fun with no scary content

Hop in and hit the road — Lulu's waiting!
```

**Keywords** (≤100 chars, comma-separated):
```
driving,car,cute,casual,arcade,kids,girls,dodge,cozy,minigame,cookie,pet,sticker,parking,family
```

**Support URL:** `https://lulu.boats`
**Marketing URL:** `https://lulu.boats`
**Copyright:** `© 2026 [YOUR NAME / COMPANY]`
**Version:** `1.0`

---

## 5. App Review Information
- **Sign-in required?** No
- **Contact:** [FIRST NAME] / [LAST NAME] / [PHONE] / [EMAIL]
- **Notes:**
```
Fully offline single-player casual game. No login or account needed.
Ads are served via Google AdMob (currently configured with TEST ad units).
To reach the Dina scenes: tap PLAY, choose Dina at the character select,
finish the run-home, then everything (nap, Morgan, Cookie Catch, Sticker
Book) is reachable from Dina's bedroom.
```

---

## 6. TestFlight — Test Information  (fixes the "missing test info" error)
TestFlight → Test Information:
- **Feedback Email:** `[YOUR EMAIL]`
- **Beta App Description:** `Early build of Lulu's Road Trip — a cute driving game with minigames. Please report any crashes or layout issues.`
- **Beta App Review Information (for external testing):** First Name, Last Name, Phone Number, Email — same as App Review above.
*(You only need this for EXTERNAL testers. To test on your own phone, use Internal Testing — no review or forms needed.)*

---

## 7. Screenshots — how to make them (no fake renders needed)

Apple wants **real screenshots**, and the easiest source is your own iPhone.

**Required:** 3–10 portrait screenshots for the **6.9" iPhone** size
(`1320 × 2868`), or **6.7"** (`1290 × 2796`). One set covers all phones.

**Easiest path:**
1. Open the app on your iPhone (from TestFlight).
2. Press **Side button + Volume Up** to screenshot each screen you want.
3. AirDrop/email them to yourself and upload in App Store Connect.
   - If your iPhone is a **Pro Max**, the screenshots are already the exact required size.
   - If not, tell me your iPhone model and I'll give you a one-line resize so they fit the required pixels.

**Best screens to capture (3–5 is plenty):**
1. Lulu driving (the main game, mid-action)
2. The car-skins shop
3. Dina racing home
4. Cookie Catch
5. Dina's cozy bedroom

Want me to add eye-catching captions/backgrounds to your raw screenshots
later? Send them over and I can frame them.
