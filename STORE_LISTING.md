# App Store Connect — Lulu's Road Trip 2.0 (copy-and-paste)

Everything to paste into App Store Connect for the **2.0** update of the existing app (`boats.lulu.game`).
Character limits are checked (the counts are in brackets). The step-by-step order is in
`store/OWNER_TODO.md`; screenshots are in `store/screenshots/` (captions in `store/screenshots/CAPTIONS.md`).

---

## 1. App Information  (App Store Connect → the app → App Information)

| Field | Paste |
|---|---|
| **Name** | `Lulu's Road Trip` |
| **Subtitle** (≤ 30) | `Funny open world with friends` [29] |
| **Primary category** | Games → **Simulation** (sub-category: **Adventure**) — or Games → Adventure; NOT the Kids category (ads aren't allowed there) |
| **Secondary category** | Entertainment |
| **Content Rights** | "No, it does not contain, show, or access third-party content" — the game, art, music and characters are your own (the parody airline/shop names are made up; the real place names — Midwood, Lakewood — are just places) |
| **Age Rating** | answer as in §5 → Apple calculates **13+** |
| **Privacy Policy URL** | `https://lulu.boats/privacy.html` |
| **Bundle ID / SKU** | already set (`boats.lulu.game`) — don't change |

## 2. Pricing and Availability
Free. All countries (or your choice).

---

## 3. Version 2.0.0  (the version page — "+ Version" → `2.0.0`)

**Promotional Text** (≤ 170, can be changed any time without review):
```
2.0 is a whole new 3D world: start at home in Midwood, take the pink car down the highway to Lakewood, and walk into shops, shul and court — alone or with friends.
```
[163]

**Description** (≤ 4000):
```
Lulu's Road Trip is a funny little open world you live in. Lulu is 18, she has a pink car, a mother with a list, a little sister called Dina, and a talent for getting into trouble.

START AT HOME
Every game starts on Lulu's street in Midwood, Brooklyn. Ima is at the door with today's errands. The car is in the driveway. Where you go from there is up to you.

ONE WORLD, NO MENUS
• Drive the highway between Midwood and Lakewood — each town has its own exit
• Park and walk: knock on doors, go into houses, shops, the pizza place, the bakery and the shul
• Every place is real in the game: the police precinct, the courthouse and the hospital are buildings you can walk into
• Rest areas, side jobs, deliveries and a Story Trip all start from places in the world

CARTOON TROUBLE
• Jaywalking sprees, shopping-cart joyrides, double-parking empires and other very small crimes
• The cops notice — then it's a chase, a night in a cartoon cell and a day in court (Abba might be your lawyer)
• Crooked meter maids, a towing racket and a garage that asks no questions
Everything is slapstick: no blood, nothing realistic, all played for laughs.

FRIENDS
• Other players who are online are simply there, as see-through ghosts — no lobby, no chat
• Add friends with a code or a link and join them in one tap
• Do things together: share a wanted level, get caught together, break out together
• Online play is safe by design: preset emoji reactions only, no typing, generated names, strangers can't touch you, and you can remove or block a friend any time. One switch turns online play off.

YOUR STUFF
• Earn coins, buy cars at Uncle Moishe's Pre-Loved Cars, add horns and decorations
• Decorate Lulu's house and her room
• Your coins, cars and progress from earlier versions carry over

ALL YEAR ROUND
The town follows the real Jewish calendar: menorahs in the windows at Chanukah, a Purim parade, sukkahs going up before Sukkos, Friday stalls before Shabbos.

PLAY YOUR WAY
• Touch controls on iPhone and iPad, portrait or landscape
• Game controllers (PlayStation, Xbox, Switch) with rumble
• Dina's mode for younger players
• The classic 2D game is still inside, under More → Classic 2D

Free to play, with occasional ads (never while you drive). No account, no login.
```

**Keywords** (≤ 100, no spaces after commas):
```
open world,driving,car,town,friends,multiplayer,funny,family,jewish,brooklyn,lakewood,cops,3d,walk
```
[98]

**What's New in This Version** (≤ 4000):
```
Lulu's Road Trip 2.0 — the whole game rebuilt as a 3D world.

• Start at home in Midwood and go anywhere: the highway, Lakewood, rest areas
• Walk into houses, shops, the pizza place, the shul, the courthouse and the hospital
• Friends: add each other and play in the same world
• Buy cars at Uncle Moishe's, decorate Lulu's house
• Game controller support, portrait and landscape, iPad
• Your coins, cars and progress carry over
• The game now gets new things and fixes without waiting for an App Store update

The classic 2D game is still there under More → Classic 2D.
```

**Support URL:** `https://lulu.boats/support.html`
**Marketing URL:** `https://lulu.boats`
**Copyright:** `2026 [your name or company]`
**Version:** `2.0.0` (must match the build — `package.json` "version")

**Screenshots** (`store/screenshots/`): upload the **iPhone 6.9"** set (`iphone-6.9/`) — App Store Connect
scales it for smaller iPhones; also upload `iphone-6.5/` if it asks for 6.5". Upload the **iPad 13"** set
(`ipad-13/`) — required because the app runs on iPad. Portrait or landscape, both are fine (the game rotates);
use one orientation per set so the gallery looks tidy. Up to 10 per set; order = the file numbers.

---

## 4. App Privacy  (App Store Connect → App Privacy — needs the Account Holder or an Admin)

"Do you or your third-party partners collect data from this app?" → **Yes.** Then, data type by data type
(from what the code actually does — the game itself, plus the Google AdMob SDK):

| Data type | Collected by | Purposes | Linked to the user? | Used for tracking? |
|---|---|---|---|---|
| **Identifiers → Device ID** | Google AdMob (the advertising identifier — only readable if the player taps "Allow" on the tracking prompt; Google also uses app-scoped ids) | Third-Party Advertising, Analytics | No | **Yes** |
| **Usage Data → Advertising Data** (ads seen / tapped) | Google AdMob | Third-Party Advertising, Analytics | No | **Yes** |
| **Usage Data → Product Interaction** (app launches, taps on ads) | Google AdMob | Third-Party Advertising, Analytics | No | **Yes** |
| **Location → Coarse Location** (approximate, from the IP address — the game itself never asks for location) | Google AdMob | Third-Party Advertising, Analytics | No | **Yes** |
| **Diagnostics → Crash Data** | Google AdMob (its own SDK crashes) | Analytics | No | No |
| **Diagnostics → Performance Data** | Google AdMob | Third-Party Advertising, Analytics | No | No |
| **Identifiers → User ID** (a random player id the game makes on the device — no name, email, phone or account) | The game (online world, friends list, home ownership) | App Functionality | No | No |
| **User Content → Gameplay Content** (position in the world, car, preset emoji reactions, scores on leaderboards under a generated name, friends list codes, the homes you own) | The game | App Functionality | No | No |

Everything else → **not collected**: no contact info, no name, no email, no precise location, no contacts, no
photos (📸 photo mode saves only to the phone), no messages (there is no chat), no health, no financial info,
no purchases (there are no in-app purchases), no browsing or search history, no sensitive info.

> If you ever switch AdMob to non-personalised ads only (see `store/OWNER_TODO.md` › decision 1), the "Used for
> tracking" answers above can become "No" AND the tracking prompt can go — but only change these answers in the
> same release as that switch.

---

## 5. Age Rating  (App Information → Age Rating → Edit) — target **13+**

Apple's 2025 ratings are 4+, 9+, 13+, 16+, 18+ (12+ no longer exists). The game's honest answers make it
**13+** (because of the bar / alcohol references and frequent cartoon violence). Item by item:

| Question | Answer | Why |
|---|---|---|
| Parental Controls | No | — |
| Age Assurance | No | — |
| Unrestricted Web Access | **No** | the game never opens arbitrary web pages; links go to its own pages only |
| User-Generated Content | **No** | players can't post text, images or anything they made; names are generated |
| Messaging and Chat | **No** | no chat or messages; online players can only show 6 preset emoji reactions |
| Social Media | No | — |
| Shared Location | **No** | the game never uses the device's location; other players see only where your car is in the game |
| Advertising | **Yes** | Google AdMob interstitial + opt-in rewarded ads |
| Cartoon or Fantasy Violence | **Frequent** | car crashes, chases, knock-outs, pepper spray, cartoon "missiles", stun nets, bumping — slapstick, no blood |
| Realistic Violence | None | nothing realistic |
| Prolonged Graphic or Sadistic Realistic Violence | None | — |
| Guns or Other Weapons | **Infrequent** | water pistols, a banana pointed like a gun, cartoon missiles from a van, pepper spray — no real guns are used by the player |
| Profanity or Crude Humor | **Infrequent** | mild insults and slapstick ("idiot", "shut up", bathroom-ish jokes); no swear words |
| Mature or Suggestive Themes | **Infrequent** | crime played for laughs (robbing a bingo hall's jackpot, burglary jokes, crooked cops, bribes), a bar with tipsy regulars who flirt clumsily, a wedding |
| Horror / Fear Themes | None | — |
| Medical or Treatment Information | None | the ER is a comedy scene (a joke diagnosis, a silly bill) — no real medical information. (Answering "Infrequent" instead would still give 13+.) |
| Health or Wellness Topics | No | — |
| Alcohol, Tobacco, or Drug Use or References | **Infrequent** | the bar ("The Thirsty Scholar"), drunk regulars, L'chaim toasts, a beer; no tobacco or drugs |
| Sexual Content or Nudity | None | — |
| Graphic Sexual Content and Nudity | None | — |
| Dating and Relationships | No | (that question is about dating apps) |
| Simulated Gambling | **None** | no betting or games of chance for coins: "Viva Vegas" is just the Story Trip's last stop, the bingo hall is a place in a cartoon robbery (no bingo is played), golden dreidels are collectibles (not spun for stakes), and the precinct coffee machine "jackpot" is a joke line |
| Gambling (real money) | No | — |
| Loot Boxes | No | no paid random rewards (coins are earned in play; there are no in-app purchases) |
| Contests | None | leaderboards only, no prizes |

Calculated: **13+** (Infrequent alcohol → 13+, Frequent cartoon violence → 13+). If Apple's calculator shows
something else, keep the answers honest and accept its result — don't change answers to get a lower rating.

---

## 6. App Review Information  (the version page → App Review Information)

- **Sign-in required:** No (uncheck "Sign-in required").
- **Contact:** [first name] [last name] · [phone] · [email]
- **Attachment:** the ATT screen recording (see `store/OWNER_TODO.md` step 7).
- **Notes** (paste):
```
Lulu's Road Trip 2.0 is a 3D open-world comedy game built with web technology (Capacitor + WebKit). No login or account. It works fully offline (online play is optional and on by default).

SEEING EVERYTHING IN 2 MINUTES
1. Launch: the App Tracking Transparency prompt appears over the loading/title screen about 1-2 seconds in (either answer is fine). Then tap the big PLAY.
2. You start at home on foot (Midwood). Walk with the on-screen stick; the hand button interacts (doors, people). The pink car is in the driveway: walk up to it and tap GET IN to drive.
3. Drive onto the highway; the exits lead to the towns (Midwood, Lakewood) and rest areas. In town, park anywhere and walk into the open doors: shops, the pizza place, the shul, the police precinct, the courthouse, the hospital.
4. The phone button in the corner opens Lulu's phone: the Map (tap a place for a guide line), Jobs and Friends.
5. The pause button: settings, "I'm stuck", and under More the Classic 2D game.

ONLINE PLAY (no user-generated content)
- Other players who are online appear as see-through "ghost" cars/people labelled only with a car colour and a number. They cannot touch, push or follow you.
- The only way to communicate is 6 preset emoji reactions. There is no text chat, no voice, no free-text names (names are generated from a fixed list), no photos or other content shared.
- Friends: two players add each other with a code or link (both must agree). A friend can be removed or blocked at any time (Friends > Remove or block). "Who can join me" can be set to nobody.
- Settings > Play online turns all online play off. Online play is always off in Dina's mode (for younger players).

ADS
- Google AdMob. An occasional full-screen ad only at a stop in play: after every second knock-out (once Lulu is back on her feet) and at most once during a jail stay; never while driving, never during a scene or dialogue, never with friends, never in Dina's mode. The game is fully paused while an ad is up.
- An optional "Watch an ad for 50 coins" button after a knock-out.
- Tracking permission is asked before ads start; "Ask App Not to Track" works normally (non-personalised ads).

UPDATES OF THE GAME CONTENT
The app contains the complete game. Like other Capacitor / web-based games, it can download newer versions of its own HTML/JavaScript/models (interpreted code run by WebKit, per section 3.3.1(B) of the Developer Program License Agreement) from our server, so content fixes reach players without an App Store update. These updates only change the game itself (same game, same features as described), never add native code or capabilities, run inside the WebKit sandbox, and fall back to the bundled version if anything fails. New features will continue to be described in these notes with each App Store version.

The game is a family comedy set in the Orthodox Jewish neighbourhoods of Brooklyn and Lakewood; all crime is cartoon slapstick played for laughs.
```

---

## 7. Export compliance
`ITSAppUsesNonExemptEncryption = NO` is in the app (Codemagic adds it), so App Store Connect shouldn't ask.
If it does: "Does your app use encryption?" → **Yes** → "Does it qualify for any of the exemptions…?" → **Yes**:
it only uses the encryption built into iOS (HTTPS / secure WebSockets and WebKit's standard Web Crypto). No
documents need uploading. (Not legal advice; this is the standard answer for a game that only uses HTTPS.)

---

## 8. TestFlight — Test Information
- **Feedback Email:** [your email]
- **Beta App Description:** `Lulu's Road Trip 2.0 — the 3D open-world version. Please report crashes, layout problems or anything confusing.`
- **What to Test:** `Start at home, drive to Lakewood, walk into a few buildings, try online with a friend (Friends → add with a code). Check your old coins and cars carried over.`
- External testers only: the Beta App Review contact (same as §6).

---

## 9. Where things live
| What | Where |
|---|---|
| Privacy policy | `privacy.html` → https://lulu.boats/privacy.html |
| Support page | `support.html` → https://lulu.boats/support.html |
| Screenshots + captions | `store/screenshots/` |
| The owner's step-by-step | `store/OWNER_TODO.md` |
| Build / Codemagic / updates / Apple's rules | `IOS_BUILD.md` |
