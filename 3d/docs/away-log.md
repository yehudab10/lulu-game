# While you were away (Shabbos, 2026-11-20 → 11-21)

Plain-English log of everything that landed on lulu.boats while the owner was offline. Newest first.
Work is checked hourly and restarted automatically if a usage limit or a machine restart stops it.

- 2026-11-21 UTC — ⚡ Smoother on phones, part 2: people's eyes, cheeks and mouths no longer each cast their own tiny
  shadow (they're smaller than what the shadow can even show), so every person on screen costs the phone four fewer
  drawing steps — the title screen now draws its shadows in about half the steps it used to. Looks exactly the same.
  Measured against today's game: walking in Lakewood ~36 % fewer drawing steps on MEDIUM, Midwood 17–24 %, the highway
  6–14 %, and the shadows alone 17–40 % less everywhere.
- 2026-11-21 UTC — ⚡ Smoother on phones (a performance pass, nothing new to see): the game now asks the phone's graphics
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
