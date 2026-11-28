# While you were away (Shabbos, 2026-11-27 → 11-28)

A fix sweep, not new features: bugs, logic flaws, inconsistencies and rough edges found by playing the game and reading
the code, fixed and tested. Newest first. Work is checked hourly and restarted automatically if a usage limit or a
machine restart stops it. The detailed notes per sweep are in `3d/docs/sweeps/`.

- 2026-11-28 17:30 UTC — 🔍 Game logic, part 2e: playing with friends, the 📱's clock now shows the same time of day as the
  sky (and the shop doors), not the device's.
- 2026-11-28 17:30 UTC — 🚗 On the road, part 6. The "🚑 pull aside for the ambulance!" on the highway no longer
  turns up in the middle of a police chase, a road-rager or a side job. Driving the highway the other way (the far side):
  the other driver being pulled over by the police is now up ahead of her where she can see it (it used to happen behind
  her, out of sight), and road-ragers / gang cars no longer show up there — they're built for the other side of the road
  and could come at her head-on.
- 2026-11-28 17:20 UTC — 🔍 Game logic, part 2d: City Hall's ribbon cutting no longer starts while Lulu is busy with
  something else (a robbery, the Shomrim on her tail), and rushing a patient to the ER in an ambulance with the siren on
  no longer gets her a speed-camera ticket in the mail.
- 2026-11-28 14:35 UTC — 🔍 Game logic, part 2c: casing the bank for a heist no longer makes the rest of the world go
  quiet until she robs it (no robberies to foil, cameos, job offers or street scenes used to start while the plan waited);
  and paying off speed-camera tickets at the precinct's fines window closes the tickets too (they stayed owed).
- 2026-11-28 14:10 UTC — 🎥 The camera, part 1: a tree no longer fills the phone with leaves. When a tree, a tree trunk or a
  lamp post stands between the camera and Lulu (or her car), it now thins out in a soft see-through patch so you always see
  her — before, walking along a street with a tree behind her could turn the whole screen olive green. Walking into the
  pizza shop, the bakery, the clothes shop and the little roadside buildings on the highway (the trooper post, the traffic
  court, Hatzalah), Lulu now faces INTO the room (she used to walk in facing the door, so pushing forward walked her right
  back out). When the camera is very close to her in a small room she turns see-through as before, but now cleanly (her face
  no longer showed through the back of her head). Smaller fixes: the camera no longer slides through the neighbours' house
  when PLAY starts the day, scene shots (arrests, crashes…) stay out of the houses, the driving camera keeps out of the rest
  areas' buildings and the on-foot camera out of the airport terminal, and the room camera no longer sits behind a big table
  or a pizza oven.
- 2026-11-28 13:45 UTC — 🔍 Game logic, part 2b: paused in the middle of a question and then ⌂ Title / ↺ Restart, the
  question no longer follows her onto the title screen (it swallowed every button press there). Turning herself in by
  📞 phone in a town — or being held by the Shomrim until the police come — now ends in that town's own precinct, not
  on the highway out of nowhere; and riding in a friend's passenger seat, the Shomrim don't chase her for the friend's
  speeding.
- 2026-11-28 13:50 UTC — 🚗 On the road, part 5. Police chases now work when Lulu drives the highway the other way (on the
  far side, down the lap): the police cars come from behind her and follow her way — before, they started in front of her
  facing the wrong way and simply fell behind — and if she's pulled over there she stops on her own side of the road
  instead of being steered across both carriageways. On that side, hidden speed traps and WANTED posters used to vanish
  the moment they appeared (so there were none), police dogs and missiles were let loose behind her, and a police car
  out looking for her drove on the wrong side of the highway — all fixed. Also on that side: cars catching up behind her
  no longer flash their lights and honk at her as if she were coming at them, and her horn now makes the slow car in
  front move over, as it does on the other side.
- 2026-11-28 13:45 UTC — 🩺 Tests + small fixes, part 3. On a phone held upright, speech bubbles no longer run off
  the side of the screen: inside a house (someone standing off to the side, a long line like "Who put a SPOON down
  here?") and out on the street (a passer-by's "Shalom!" at the edge) — they slide in so every word shows.
- 2026-11-28 13:30 UTC — 🚗 On the road, part 4. Velvel, the no-questions mechanic by the highway, no longer offers to buy
  Ima's family minivan (the car Lulu borrows when none of hers is at home), and he won't buy any car while Lulu's own car
  is in the impound — his "we'll bring your car round" used to get it out of the impound for free.
- 2026-11-28 12:45 UTC — 🔍 Game logic, part 2: one clock — shop doors, the car-care row, the school-zone speed cameras
  and what's on in the shul / yeshiva now follow the hour the sky (and the 📱) shows, not the device's (a shop said
  "CLOSED · opens 7 am" under the noon sun). Pressing ☰ in the middle of a question pauses the game instead of picking
  the highlighted answer, and back from another app ✕ "Resume" no longer answers the question behind the pause card.
  Nothing new (a robbery to foil, a cameo, a job's offer) starts during an ambulance patient run, a test drive or with
  the Shomrim on her tail. A hitchhiker doesn't wait in the car through an arrest; riding in a friend's passenger seat
  never gets her a speed-camera ticket; walking into one of the town's shops ticks Ima's "pop into a shop"; the
  inspector doesn't wait on her path mid-chase; an arrest no longer freezes mid-cuffs when the cruiser has gone.
- 2026-11-28 12:40 UTC — 🩺 Tests + small fixes, part 2. Walking around town is a little calmer: Lulu's first
  "where's a car" grumble waits until the on-foot tip has gone (she used to talk over it, and over the town's own welcome
  line), the drivers stuck in the Route 9 jam don't yell the same thing twice in a row, and the rain / storm / fog
  messages on foot are about walking (they told her to "hold the wheel" and put the headlights on). In the shul on a
  Friday the kid running round the kiddush table no longer brushes through the doorway's low wall. Online, other
  players' usernames over their cars show again (a name could stay "Pink 56" for ten minutes after crossing between
  parts of the world). Three tests that had gone stale were brought up to date.
- 2026-11-28 12:20 UTC — 🚗 On the road, part 3. Pulled over by the police on an exit ramp, in a rest area's car park, at
  Trooper Post 7 or a dealership's lot, Lulu now stops right where she is and the police car pulls up behind her — before,
  the game steered her back across the grass to the side of the highway. Driving straight on past an exit, the green
  "EXIT … NOW" line no longer hangs on for a while after the exit has gone by, and an electric car charging at a rest
  area's pumps is no longer also told "electric? try a charger".
- 2026-11-28 08:30 UTC — 📱 Phones, part 5: on a phone, the ✋ button by her car says DRIVE (it said "OWN"), and a few
  lines that told touch players to "press Tap" / "mash Tap (or tap)" say it in plain words.
- 2026-11-28 08:15 UTC — 📱 Phones, part 4: on a small phone held sideways, the first-drive lesson's card no longer
  covers the NITRO button it's telling you to press.
- 2026-11-28 08:10 UTC — 📱 Phones, part 3: the on-screen stick no longer creeps Lulu (or the car) along when a thumb
  just rests on it. Inside rooms a speech bubble at the edge of an upright phone slides in so its first words aren't cut
  off, the over-the-shoulder camera picks the side of her with room (in a small kitchen it got squeezed up over her
  head), and the "weekly quests unlocked" note now says where the quests really are.
- 2026-11-28 08:05 UTC — 🚗 On the road, part 2. Being arrested on the highway near Midwood or at Trooper Post 7, the
  ride to the station and the booking now name the station she's actually taken to (they always said Lakewood's
  "Precinct 18½"). Shmuel's chop shop no longer calls while Lulu's own car is in the impound — "his guy brings your car
  round" after the job used to get it out of the impound for free.
- 2026-11-28 07:20 UTC — 📱 Phones, part 2: on a small phone the Scrapbook's longer badge names ("Neighbourhood Hero")
  stay inside their spot instead of running into the next one.
- 2026-11-28 07:20 UTC — 🚗 On the road, part 1. A police car that rear-ends Lulu is now the police car's fault — on
  her last heart it used to get HER arrested for "destroying a police cruiser". Cars she has just passed no longer plough
  into her when she slows down or stops (they brake and go round her), and a car pulling out to pass doesn't swerve into
  her lane. Cops chasing her down an exit ramp or into a rest area now drive the ramp instead of cutting across the grass
  and the barriers; a cruiser that's given up stops where it is; the "you're not hidden" tip goes away once she IS hidden;
  and a cruiser sent after a phoned-in report in town has to look for her instead of driving straight to her. A car
  impounded at Trooper Post 7 or the Weigh Station can now actually be collected there (its gate never opened before —
  the car was stuck for good), and it rolls out into the yard, not onto the highway. Her other cars can't be "brought
  round" any more from Uncle Refael's lot, a dealership or the title's Car button while they're impounded or parked
  across the map (that let an impounded car out for free). Driving a borrowed car, a ride or Ima's minivan no longer uses
  up her own car's gas. The trip bar and the exit chip now count down to the JFK exit too; the "½ mile" and "1 mile"
  boards before an exit or a rest area stand about that far away (some were much closer); a long ride like the box truck
  is solid along its whole length. Small text fixes: the impound window names her car (not always "pink convertible"),
  the impound line names the highway yard, and a Lakewood speed-camera ticket comes from Lakewood, not Midwood.
- 2026-11-28 05:30 UTC — 📱 Phones, part 1 (what a player on a phone sees): a brand-new player at the porch gets ONE
  thing to do — "drag the WALK pad to your car", and the camera now looks at the car (on a phone held upright it was off
  the edge of the screen), so pushing up walks straight to it; the "tap JUMP" tip and the Day-1 streak card no longer
  pile on top of Ima at the same moment (the streak shows once she drives), and sitting still in the driveway says
  "Hold GAS to pull out". The phone's intro banner waits for the first-drive tutorial to finish, and the tutorial's first
  card no longer talks about "the open road" while she's on her own street. Inside small rooms on a phone, Lulu turns
  see-through when the camera is right behind her, and the camera looks over her shoulder at the person she walked up
  to, so her head no longer hides the shopkeeper. Facing someone, the ✋ is for that person, not the bottle on the
  counter in front of them. ⚙️ Music OFF now stays off after closing the game; a long username no longer pushes the
  Settings rows off the card; the 📱's Back / Menu buttons are bigger for fingers and the handset fits on iPhones in
  Safari. Smaller things: speech bubbles stay whole on the screen, the ON FOOT chip lost its meaningless "🏡 100%", the
  clothes counter says "Chat at the counter" (paying happens after trying on), and four emoji that older iPhones show
  as empty boxes were swapped.
- 2026-11-28 04:16 UTC — 🏬 Places, part 3: coming out of a front door (a neighbour's house, Lakewood's shul) the camera
  no longer starts inside the building — the screen used to be one flat colour until she walked away; now you see her
  on the pavement right away.
- 2026-11-28 03:30 UTC — 🏬 Places, part 2: walking into a house on a phone (a neighbour's, Ima's, a home for sale)
  no longer shows one flat grey screen — the camera was stuck inside the front door; now the door goes see-through and
  you see the room. The camera inside the newer buildings (houses, shops, City Hall, the bowling alley) also stops at
  their walls instead of going through them, and a speech bubble never rises off the top of the screen.
- 2026-11-28 02:27 UTC — 🏬 Places, part 1 (walking into buildings in town): speech bubbles from the street ("No car? No
  problem.", a protester's line) no longer stay frozen on screen inside the shop you just walked into, and neither does
  the "Find a car to borrow" hint or the town's WELCOME banner. On a phone, a room's speech bubbles are never wider than
  the screen any more (some filled it in giant letters) and long ones wrap into a few lines; a friend's name tag right
  by the camera no longer fills the screen. Walking out of East Midwood Lanes no longer drops Lulu on the highway far
  from Midwood — she comes out of the same front she went in by — and the alley's front now has its own sign instead of
  COMING SOON. On a controller, ○ / B on a question now picks its "never mind" answer ("Stay a bit", "Not now"…).
  Shops don't let her hide from the police any more, and three shop doors whose signs contradicted their opening hours
  say the right thing.
- 2026-11-27 23:02 UTC — 🪙 Coins and rules, part 1: no more free-coin loops from restarting. The one-time treats inside
  buildings (the precinct's free coffee, the bar's seltzer, the beach ice cream, the school bake sale, the hospital
  snack…) now pay once a DAY — restarting used to refill them. Couch coins in the neighbours' houses really stop for the
  day, like Lulu says; Hillel's insurance payout is once a day, like he says; the easy on-foot robbery tackle and the
  moped thief's catch bonus have a daily limit too. Mashing the roll button (or tapping the road on a phone) no longer
  pays combo coins — mix different moves and it still does, up to 200 a day. Cookie Catch with Dina pays up to 300 a day,
  then the rounds are free, just for fun. Ima's list no longer asks Lulu to drop the challah at Bubbe's (Bubbe's house
  isn't on the open-world map, so that list could never be finished), and pulling into the hair salon no longer gets her
  out of a police chase. Small text fixes: Midwood's "LAKEWOOD 64 MI" sign, the precinct's phone line, and the family card
  now says home is in Midwood. The full list of where coins come from and go is in `3d/docs/sweeps/sweep-logic.md`.
- 2026-11-28 09:00 UTC (fixes) — Walking up a driveway to a parked minivan in town (to borrow it) no longer lets the
  camera slide into the house next to it. In the shul on a Friday, the kid running round the kiddush table no longer runs
  through the end of the table. Three automatic checks that were tripping over their own timing were fixed.
- 2026-11-28 07:20 UTC (fixes) — The shop and street signs in Lakewood and Midwood are a little sharper: their pictures are
  packed together more tightly, so each one gets more pixels (the new yeshiva's signs had made Lakewood's slightly
  blurrier). Test screenshots inside buildings no longer come out as a plain blue picture.
- 2026-11-28 05:15 UTC (fixes) — 🗺️ On the phone's Map, tapping the place Lulu is already standing at (say, Ima's house
  while she's on the porch) used to close the phone and do nothing; now the phone stays open and the place says
  "📍 you're here!". ✈️ At the JFK kerb, a police car that wrecked itself ramming her could keep sliding right through her
  car; the wreck now stops against her car like a solid thing. Two automatic checks that timed things on the wrong clock
  were fixed.
- 2026-11-28 02:15 UTC (tests) — The speed check at the Lakewood exit compared it with a bare stretch of fields with no
  trees; it now compares it with the same kind of countryside, and the exit is well within budget (nothing changed in
  the game).
- 2026-11-28 00:40 UTC (tests) — Standing right beside her own car after getting out, the ✋ button now says GET BACK IN
  even when a shop's door is a few steps away — before, the shop door won and she walked into the shop instead of her
  car. Two more automatic checks that had gone out of date were fixed.
- 2026-11-27 22:20 UTC (tests) — Hitting a pothole on the highway no longer pops up a "🕳️ POTHOLE!" message on top of
  whatever Lulu says about it: the jolt, the thud and her line already say it (one less pop-up while driving). Two
  automatic checks that had gone out of date were brought up to date.
- 2026-11-27 21:15 UTC — Started the fix sweep (three at a time: the tests that are red on main, the game's rules and
  coins, and this week's new places; then the road, the screen / phone, friends, and phone speed).

---

# While you were away (Shabbos, 2026-11-20 → 11-21)

Plain-English log of everything that landed on lulu.boats while the owner was offline. Newest first.
Work is checked hourly and restarted automatically if a usage limit or a machine restart stops it.

- 2026-11-21 (evening) — 🍃 The town feels alive, part 3: as the sun goes down in Lakewood and Midwood the houses' windows now
  light up a few at a time — each house when its family gets home, room by room, warm lamp light (some with the curtains half
  drawn, now and then the blue flicker of a TV) — and late at night some go dark again for bedtime; at dawn they switch off. On a
  cold night you can see Lulu's breath (faster when she's been running), the neighbours' and your friends' too, and the car's
  exhaust steams while it waits at a light; at dawn a low mist lies over the town and burns off as the sun comes up. Fumble a
  hotwire and the car alarm goes off for real now — hazard lights, the WHOOP-WHOOP, and the owner yelling "Young lady! That is
  NOT your car!". And the radio DJs notice the weather: when it starts raining (or snowing, or foggy) or the sun sets, the next
  thing the DJ says is about that. In a thunderstorm in town the dogs start barking after a big clap and the lit windows
  flicker for a moment, like the power nearly went. No new pop-ups; the sounds follow ⚙️ 🐦 Street sounds.
- 2026-11-21 (airport kerb) — ✈️ Two small JFK fixes (the airport is still switched off in the real game until the "each town its
  own exit" work lands): when the police pull Lulu over at the terminal kerb she now stops right where she is, facing along the
  kerb road, with the police car right behind her — before, she crept forward and turned toward the far-away highway while
  braking. And a police car that bumps or rams her at the kerb can no longer shove her car up onto the sidewalk in front of the
  terminal (it stops at the kerb, and the police car can't push through her either).
- 2026-11-21 (screen layout) — 📏 Nothing on the screen sits on anything else any more, on a phone held either way, a small
  phone, a tablet, a laptop and a TV, with fingers or a controller: on a phone on its side the WALK stick no longer covers
  📝 Ima's list / ON FOOT (the hearts + coins share a row, the stick is a touch smaller, and while a text message is up the ON FOOT
  chip steps aside); the ⏭ SKIP button slides down out of the way instead of sitting on the street name; with a controller on a
  phone held upright the screen is laid out like the touch one (no more "Talk to Heshy" and the controls hint on the speedometer —
  they sit above it, and the speedometer is smaller); and the "WELCOME TO LAKEWOOD" sign-in card waits below the 📝 list and the
  text messages instead of covering them. A new test checks every pair of things on the screen at 11 screen sizes.
- 2026-11-21 17:20 UTC (airport polish) — ✈️ JFK got its rough edges fixed (it's still switched off in the real game until the
  "each town its own exit" work lands — the exact steps to switch it on are written down now). Police cars chasing Lulu off the highway
  now follow the airport's ramps and roads round to the kerb instead of driving through the fence and the terminal, and can see her across
  the open car park (not through the terminal). Bumping a taxi or shuttle bus is a real crash now: it slides and spins, the driver yells
  ("Lady! It's a TAXI, not a bumper car!"), then pulls back into line. If Lulu is wanted, airport security (Officer Segal on his Segway,
  with Rex the kugel-sniffing dog) rolls out of the terminal and slows her right down until the real cops catch up. On LOW graphics the
  airport is now lighter than on MEDIUM (about 10 % fewer triangles at the kerb). The "½ MI" sign's words fit, and the terminal doors no
  longer say "opening soon", and the camera no longer ends up inside the terminal during a chase. A picture of the airport's highway signs is in `3d/docs/airport-signs.jpg`.
- 2026-11-21 17:15 UTC — ⚡ Smoother on phones, part 3: everyone's shadow — Lulu at the wheel, Ima, Dina, the neighbours, people
  walking by — is now drawn in one go instead of piece by piece (iPhones since iOS 15 can do that), so the shadows on the
  title screen take about a quarter of the drawing steps they did, and on foot about an eighth. The street lamps along the
  highway are drawn together too, and on the lowest graphics setting the tall grass far away from Lulu is a little
  thinner. Looks the same (checked picture by picture). Also fixed a rare hidden error some online sessions logged.
- 2026-11-21 (play-test of the weekend) — 🔎 Played everything that landed this weekend like a kid would (on a phone, a computer and
  a TV; Lakewood, Midwood, the highway, JFK with `?airport=1`, and with a friend) and fixed what was off: the PIGEONS on the
  sidewalk no longer fly through the houses when you scare them (they climb over the roofs, circle up high and come back down over
  the sidewalk); 📝 Ima's list in town said things like "Drop off Bubbe's challah · 307.8 mi back" — it now says how far it really is;
  pulling out of the driveway and backing into the house no longer puts the camera inside the house (a screen of one flat colour);
  after a crash leaves the car sideways, Lulu gets back on her feet BESIDE it instead of standing in its hood; a parked car you
  ram again and again stops at the houses instead of sliding into them; on a narrow phone a big score no longer sits on the trip
  bar; and with a controller on a phone held upright, the hint at the bottom wraps instead of running off both edges. Checked and fine: puddles, splashes,
  honking at the crowd and the pigeons, car alarms (they stop), no sound left playing after leaving town, no coins to be farmed from
  any of it, the phone's 💬 Messages + 🗞️ Kvetch on every screen size. For the airport team: the "TERMINAL OPENING SOON" poster is
  still on the doors though they open now, and the camera can end up inside an airport building during a police chase.
- 2026-11-21 12:40 UTC — ⚡ Smoother on phones, part 2: people's eyes, cheeks and mouths no longer each cast their own tiny
  shadow (they're smaller than what the shadow can even show), so every person on screen costs the phone four fewer
  drawing steps — the title screen now draws its shadows in about half the steps it used to. Looks exactly the same.
  Measured against today's game: walking in Lakewood ~36 % fewer drawing steps on MEDIUM, Midwood 17–24 %, the highway
  6–14 %, and the shadows alone 17–40 % less everywhere.
- 2026-11-21 (main fixes) — 📞 Lulu's phone is one tidy 3 × 3 screen again, with the 📞 Phone app right next to 💬 Messages
  (the new 👯 Friends app had made it 10 apps and squeezed in between). The 🗞️ Kvetch local news now lives as a pinned row at the top
  of 💬 Messages instead of its own app. Fewer pop-ups again: the little "💥 Oy vey!" crash quips only show when Lulu didn't just say
  something (and so do other little "colour" notes), walking's mud / mosquito / sore-feet notes take turns with her lines, an uncle
  waving from the roadside is one pop-up (his +8 💰 tip is in it), an ambulance is one warning instead of two, a run of golden
  dreidels is one note (the counter up top still counts each), and Avigail chats a bit less when she tags along on a walk. On a big TV the 🕯️ "Made it for candles!" card fits without scrolling.

- 2026-11-21 08:40 UTC (life round 2) — 🍃 More little things that make the towns feel lived-in (still no new buttons or pop-ups). PIGEONS: rows of them on the roofs and little gangs pecking on the sidewalk (always a few outside the bakery and the pizza shop) — honk, run at them or zoom past and they burst up with a clatter of wings, circle the block and land back in the same spot once she's gone; you hear them coo now and then. It's cold out, so CHIMNEY SMOKE drifts up from about half the houses (more at night; it stops on its own when the weather warms up in the spring). Midwood now has MANHOLE COVERS in the street, most of them steaming like a real Brooklyn street — drive through and the car swirls the steam, walk into it and Lulu has opinions ("It's like the subway sneezed on me"). The bakery and the pizza shop have a warm puff coming off the oven vent on the roof, and walking past the bakery she sometimes smells it ("Is that KUGEL? It's not even Friday!"). Bump a parked car and now its HAZARD LIGHTS blink, the alarm keeps going for a few seconds, and the owner (or somebody at a window) yells "Nu?! That's MY car!". When she honks near people they each react their own way — a kid waves back ("HONK AGAIN!"), a grown-up jumps ("Nu?!"). With friends, you can now hear your friends' footsteps when they walk near you. All the new sounds follow ⏸ → ⚙️ Settings → 🐦 Street sounds.
- 2026-11-21 07:00 UTC — ⚡ Smoother on phones (a performance pass, nothing new to see): the game now asks the phone's graphics
  chip to draw a lot less each frame. Walking or driving in Lakewood and Midwood draws about 20–28 % less on LOW and
  MEDIUM, the highway 8–17 % less, and on MEDIUM the shadows cost a third less (the title screen 36 % less) — cars, Lulu's
  car, her house and the e-bikes now cast their shadow in one go instead of one piece at a time, the sky's clouds are
  16 objects instead of 80, and the score counter stopped doing slow work every frame. Screenshots before and after are
  pixel-for-pixel the same. Numbers: `3d/ARCHITECTURE.md` › Graphics & performance › Phone pass.
- 2026-11-21 04:15 UTC — 🍃 The world feels more alive (lots of small things to notice, no new buttons or pop-ups). Walking now has FOOTSTEPS that sound different on the sidewalk, the street, grass, gravel, snow, up on a car roof or a bench — and splashy after rain. After it rains in Lakewood or Midwood, PUDDLES collect in the gutters and on the sidewalk (you can see the raindrop rings on them) and slowly dry up after; walk through one and it splashes, jump into one for a big SPLOSH, drive through one fast and it sprays both sides (if somebody is standing at the curb, they let her know about it: "MY SHEITEL!"). Every so often a gust of WIND blows leaves across the street (autumn colours now, pink blossom petals in the spring) and sometimes a paper notice off a lamppost — "LOST CAT: KUGEL", "UMBRELLA GEMACH: 14 umbrellas, all black" — and if it blows into Lulu she reads it out. It's the fall, so there are raked LEAF PILES by the curb: walk or drive through one and it bursts. And the town SOUNDS lived-in: birds, a dog barking (and the neighbour's dog answering), a screen door, a kid with a basketball, somebody hammering (a lot before Sukkos, never on Shabbos), wind chimes, crickets on summer nights, an owl. If any of the sounds get annoying: pause (⏸) → ⚙️ Settings → 🐦 Street sounds OFF.
- 2026-11-21 (stage 1 landing) — ✈️ JFK stage 1, the exit and the kerb, is built and tested — but switched OFF in the real game
  for now (it waits for the "each town its own exit" work, so the two never land on top of each other). Its own exit, EXIT 12, signed
  "✈ JFK AIRPORT" a mile ahead; a ramp and a road in to a fenced drop-off loop past Terminal 4½ — DEPARTURES, then ARRIVALS —
  with a parking lot in the middle, yellow taxis queuing and shuttle buses stopping at the kerb, a control tower, parked jets at the
  gates (Kugel Air, El Oy, Shmear Jet, Nu? Air), and planes taking off and landing right over the highway with their shadows
  sweeping the road. Drive in, get out, walk the kerb, try the terminal doors (they now lead into the stage 2 hall), push the runway
  fence and Officer Segal rolls up on his Segway ("Ma'am. That side is for PLANES."), then drive back out onto the highway — no
  loading screen anywhere. To try it before it's switched on: lulu.boats/3d/?airport=1 (about 5½ miles into a drive).

- 2026-11-21 00:55 UTC — ✈️ JFK stage 3, things to do at the airport. Inside the terminal: a very frazzled Mrs. Shpilkes has lost
  her pink suitcase — find it (on Bubbe's scale, under a tired man's feet, by a plant… or a man with an IDENTICAL bag is doing laps
  with it) and bring it back for a small reward (once a day). Now and then the singer Dovid Dov walks down the VIP red carpet with
  screaming fans who have no idea who he is; Lulu (his sister — shh) can take a selfie, get an autograph on Ima's kugel, or pretend
  they're strangers, and once a day he slips her a little gas money (plus a new scrapbook badge). He only shows up when she's playing
  alone. The hint at the bottom of the screen inside the terminal no longer says "find a car to borrow". Also built and tested:
  🚕 airport taxi runs (pick up a traveller at arrivals — a yenta, a yeshiva boy back from Israel, a tourist hunting for "the Brooklyn
  Bridge", a Zeidy with grapefruits — and drive them to a real place in Lakewood or Midwood; 40 coins a run, 3 a day). The taxi runs
  switch on by themselves once the airport exit itself (stage 1) is in the game — until then nobody can be offered one. Like the terminal itself,
  none of this can be reached in the real game yet: the terminal's doors open when stage 1 lands.
- 2026-11-20 22:40 UTC — ✈️ The JFK terminal hall is built (stage 2): check-in at Kugel Air, El Oy and Shmear Jet (and
  Bubbe Faigy's overweight bag), a departures board full of silly delays, a security line that's one long gag (Rex the dog only
  ever finds kugel), a deli + a very expensive water bar (a snack gives a heart back, capped), the gate with a window onto the
  runway and seats to sit in, and the arrivals door. Friends inside see each other. You can't walk in yet — the doors open when
  stage 1 (the exit and the kerb) lands.
- 2026-11-20 21:10 UTC — Started: ✈️ JFK stage 1 (the exit, the drop-off loop, parking, planes overhead) and
  stage 2 (the terminal you walk into). Your 12 answers are in `3d/docs/airport-plan.md` › Decisions.
