// Every feature module, imported for its side effects (each registers its own
// states, menu items, hooks, models and event listeners with core/ctx.js).
// One directory per feature; see 3d/ARCHITECTURE.md for the contract.
import "./journey/index.js";     // Story Trip: the five stops to Vegas, chapter tasks, story map, Ima's calls
import "./law/index.js";         // cops, pursuits, arrests, jail, the courtroom
import "./garage/index.js";      // shop (skins, items), Bling (horns, decorations), missiles / shields / pepper spray
import "./parking/index.js";     // the parking minigame + parking challenge
import "./roadevents/index.js";  // tolls, trains, parades, animals, construction, ice cream, drive-thru, hitchhikers…
import "./cameos/index.js";      // Avigail (car + porch), the salon, sasquatch, Heshy's pool, Uncle, the ER
import "./foot/index.js";        // Lulu on Foot + interiors (bar, school, hospital, police, beach) + the wedding
import "./dina/index.js";        // Dina's world: school bus, run home, bedroom, Morgan, sticker book, cookie catch, nap
import "./meta/index.js";        // scrapbook, badges, weekly quests, daily streak, holidays, tutorial
import "./multiplayer/index.js"; // Shared Road: ghost cars from 2D + 3D players, rooms, races
import "./dualsense/index.js";   // PS5 DualSense extras: light bar + adaptive triggers (WebHID)
