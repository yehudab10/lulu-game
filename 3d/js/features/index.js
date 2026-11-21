// Every feature module, imported for its side effects (each registers its own
// states, menu items, hooks, models and event listeners with core/ctx.js).
// One directory per feature; see 3d/ARCHITECTURE.md for the contract.
import "./journey/index.js";     // Story Trip: the five stops to Vegas, chapter tasks, story map, Ima's calls
import "./law/index.js";         // cops, pursuits, arrests, jail, the courtroom
import "./garage/index.js";      // shop (skins, items), Bling (horns, decorations), missiles / shields / pepper spray
import "./parking/index.js";     // the parking minigame + parking challenge
import "./roadevents/index.js";  // tolls, trains, parades, animals, construction, ice cream, drive-thru, hitchhikers…
import "./cameos/index.js";      // Avigail (car + porch), the salon, sasquatch, Heshy's pool, Uncle, the ER
import "./foot/index.js";        // Lulu on Foot: walking the road world, peds, animals, borrowing cars, the wedding
import "./interiors/index.js";   // foot interiors: the bar, school, hospital waiting room, police precinct, beach boardwalk
import "./dina/index.js";        // Dina's world: school bus, run home, bedroom, Morgan, sticker book, cookie catch, nap
import "./meta/index.js";        // scrapbook, badges, weekly quests, daily streak, holidays, tutorial
import "./multiplayer/index.js"; // Shared Road: ghost cars from 2D + 3D players, rooms, races
import "./dualsense/index.js";   // PS5 DualSense extras: light bar + adaptive triggers (WebHID)
import "./play/index.js";        // playground: 📸 photo mode, ✨ golden dreidels, 🛹 stunt ramps
import "./banter/index.js";      // personality: Lulu alive at the wheel, her one-liners, the road talks back, funny billboards
import "./atmos/index.js";       // atmosphere: Cruise day/night cycle, weather (rain, fog, snow, rainbows), birds, banner planes, balloons, leaves
import "./party/index.js";       // 🎉 Party with friends: host / join by code or link, a 3D lobby, Road Trip together, races (seeded shared world)
import "./hustle/index.js";      // 💼 side hustles: GTA-style side jobs (Lulu Cab, The Getaway, Hot Delivery) + the 📻 car radio
import "./streets/index.js";     // 🚗 street mayhem: carjack anything, bail out, wanted stars + search, roadblocks, Paint & Pray, smashable props
import "./phone/index.js";       // 📱 Lulu's phone: one entry point for the extras (map, messages, radio, jobs, Paint & Pray, camera)
import "./memory/index.js";      // 🧠 a world that remembers Lulu: grudges in traffic, texts from fares, WANTED billboards, recognitions
import "./world/index.js";       // 🌍 a world, not a menu: Lulu's street behind the title, a run starts there on foot, places to pull into
import "./feel/index.js";        // 🔊 feel: positional 3D audio (sirens, passing traffic, horns, the train…) + visible damage on Lulu's car
import "./shabbos/index.js";     // 🕯️ Erev Shabbos Rush: beat the sunset to Bubbe's before candle-lighting (Friday title chip · a rare Cruise call)
import "./town/index.js";        // 🏙️ towns you can turn into: Lakewood (an exit off the Cruise highway → a drivable grid of streets)
import "./community/index.js";   // 🚨 community: Chaverim / Shomrim / Hatzalah in town, the Bais Yaakov blend-in, 📞 calls
import "./homes/index.js";       // 🏠 living towns (instanced crowds, porches, kids, dogs, e-bikes) + breaking into houses (knock / sneak in, shocked residents, household items, the call-in)
import "./rides/index.js";       // 🚓🚑🍦 rides: every vehicle Lulu drives has its own handling, horn and trick (siren, pull-overs, patients, ice cream, bus stops)
import "./day/index.js";         // 📝 a day in Lulu's life: Ima's list (an errand at a real place, a job, something silly) → home for dinner
import "./moves/index.js";       // 🏁 moves & tricks: drift-boost tiers, rocket starts, slipstream, air tricks, bootlegger, PIT, dodge/slide/vault on foot, the style combo + 🏁 Moves page
import "./openworld/index.js";    // 🌍 open world: Free Roam with friends (highway + towns), party games from the 📱 (Cops & Robbers, Race to a Pin, Hot Kugel, Photo Hunt), 📍 Nearby
import "./exits/index.js";       // 🛣️ highway exits & 🅿️ rest areas: service plazas off the Cruise/Story highway (food, gas, restrooms, a gift shop, Mendel's garage, travellers on foot) + the next-exit chip
import "./native/index.js";      // 📱 the iOS app (Capacitor): AdMob + App Tracking Transparency (ATT before init, an interstitial every 2nd game over, the 📺 rewarded button) + Taptic haptics — a no-op on the web
import "./heist/index.js";       // 🏦 banks + cartoon heists: a bank in each town (+ its interior), foil robberies (ram / PIT / box in the getaway car, tackle on foot), Lulu's own opt-in heist (case it → a plan → a rugelach stick-up → a big getaway), moped snatchers + car thieves (capped, recoverable), the cops' stun nets + spike strips
import "./underworld/index.js";   // 😈 underworld: crooked cops (the Kugel Fund), Velvel's no-questions garage, the Fixer's dirty jobs + heat, pickpockets, road-ragers, the gang car
import "./seasons/index.js";      // 🕎 seasons: the world follows the real Hebrew calendar — menorahs in every window (+1 candle a night), the Purim parade, sukkahs going up, Pesach clean-out, Lag BaOmer bonfires, Shavuos flowers, Friday stalls + Shabbos candles; quiet fast days; a capped stall treat
import "./decor/index.js";        // 🛋️ decor: Lulu's own house (✋ GO INSIDE from the home start — the kitchen with Ima, the living room, her room) + decorating it with coins: walk up to a spot (bed, wallpaper, rug, lamp, shelf, couch, the porch, the mailbox, the yard…), ✋ → pick, preview, buy — a coin sink, saved, seen from the street
import "./onegame/index.js";      // 🎮 one game, not a menu of modes: ▶ PLAY is the open world; the 🧳 road trip (suitcase by the car / 📱), the 🅿️ parking booth at rest areas (/ 📱), Dina from the porch, Ima's Friday rush at the door, 🏠 back home after each
import "./together/index.js";     // 👯 friends together: the friend finder (📱 🗺️ map dots + a destination beam, ≤ 3 quiet edge pointers) and friends seeing each other inside the same building
import "./partners/index.js";     // 🔗 crimes for two with friends (double dare · flag & grab · ring & sneak · getaway peels) — partners share the law's crew (law/crew.js)
import "./friends/index.js";      // 👯 a friends list that lasts: add (both say yes · from 📍 Nearby / a party / a friend code), presence + one-tap JOIN through private doorbell rooms on the existing relay, who-can-join-me, appear offline
import "./places/index.js";       // 🏛️ places: a police precinct (+ its impound lot), a courthouse and a hospital in each town — walk in freely; arrests, court and the ER happen IN them, and she walks out of the front door
import "./calm/index.js";         // 🧘 a calm screen: tells the pop-up budget (hud.js) when it's quiet (friends / strangers around) or she's busy; chatter defaults to Quiet with friends
import "./airport/index.js";      // ✈️ the airport exit — JFK (stage 1: its own interchange, the kerb loop, parking, taxis + shuttles, the terminal outside, the tower, the runway fence + its joke, planes overhead; OFF by default until ci/exits2: ?airport=1)
import "./airport/terminal.js";       // ✈️ the JFK terminal (airport stage 2): one walk-in hall — check-in (Kugel Air, El Oy, Shmear Jet), the departures board, the security-line gag, a food court, the gate window, arrivals; shared with friends
import "./airport/stage3.js";         // ✈️ JFK stage 3: 🚕 airport taxi runs (a hustle job, only from the airport), 🧳 the lost suitcase, 🎤 Dovid Dov on tour down the VIP carpet — each capped per real day
import "./life/index.js";           // 🍃 a world that feels alive: footsteps by surface, puddles after rain (splashes + spray), wind gusts with leaves / petals / flyers + raked leaf piles, the neighbourhood soundscape (birds, dogs, a screen door, crickets) — local + cosmetic, ⚙️ 🐦 Street sounds
