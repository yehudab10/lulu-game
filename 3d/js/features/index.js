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
import "./world/index.js";       // 🌍 a world, not a menu: Lulu's street behind the title, the driveway pull-out, places to pull into
import "./feel/index.js";        // 🔊 feel: positional 3D audio (sirens, passing traffic, horns, the train…) + visible damage on Lulu's car
import "./shabbos/index.js";     // 🕯️ Erev Shabbos Rush: beat the sunset to Bubbe's before candle-lighting (Friday title chip · a rare Cruise call)
import "./rides/index.js";       // 🚓🚑🍦 rides: every vehicle Lulu drives has its own handling, horn and trick (siren, pull-overs, patients, ice cream, bus stops)
